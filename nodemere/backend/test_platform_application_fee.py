import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from backend import main


class PlatformApplicationFeeTests(unittest.TestCase):
    def test_only_free_plan_has_payments_disabled(self):
        self.assertFalse(main.DEFAULT_PLAN_ENTITLEMENTS["free"]["payment_processing"])
        for plan in ("essentials", "pro", "ultra"):
            self.assertTrue(main.DEFAULT_PLAN_ENTITLEMENTS[plan]["payment_processing"])

    def test_three_percent_fee_rounds_to_nearest_cent(self):
        with patch.object(main, "stripe_application_fee_percent", "3"):
            self.assertEqual(main.calculate_platform_application_fee(1099), 33)
            self.assertEqual(main.calculate_platform_application_fee(10000), 300)
            self.assertEqual(main.calculate_platform_application_fee(17), 1)
            self.assertEqual(main.calculate_platform_application_fee(16), 0)
            self.assertEqual(main.calculate_platform_application_fee(0), 0)

    def test_tax_and_tip_are_excluded_from_customer_payment_fee(self):
        with patch.object(main, "stripe_application_fee_percent", "3"):
            base = main.customer_payment_fee_base(11500, 1000, 500)
            self.assertEqual(base, 10000)
            self.assertEqual(main.calculate_platform_application_fee(base), 300)
            self.assertEqual(main.customer_payment_fee_base(11500), 11500)
        for tax, tip in ((-1, 0), (0, -1), (700, 400)):
            with self.assertRaises(HTTPException):
                main.customer_payment_fee_base(1000, tax, tip)


class PlatformFeeRefundTests(unittest.IsolatedAsyncioTestCase):
    async def test_refund_reverses_existing_application_fee_only(self):
        for fee_id in ("fee_1", None):
            with self.subTest(fee_id=fee_id):
                db = MagicMock()
                db.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[{
                    "id": "payment_1", "stripe_payment_intent_id": "pi_1", "amount": 1000,
                }])
                with patch.object(main, "supabase", db), \
                     patch.object(main, "require_payment_access"), \
                     patch.object(main, "ensure_no_unresolved_templates"), \
                     patch.object(main, "is_payment_test_mode", return_value=False), \
                     patch.object(main, "_get_connected_stripe_request_options", return_value={"stripe_account": "acct_1"}), \
                     patch.object(main, "update_payment_record", return_value={"id": "payment_1"}), \
                     patch.object(main, "serialize_stripe_refund", side_effect=lambda value: value), \
                     patch.object(main.stripe.PaymentIntent, "retrieve", return_value={
                         "latest_charge": {"application_fee": fee_id}, "customer": "cus_1",
                     }), \
                     patch.object(main.stripe.Refund, "create", return_value={
                         "id": "re_1", "amount": 1000, "customer": "cus_1", "status": "succeeded",
                     }) as create:
                    await main._refund_payment_for_user(main.RefundPaymentRequest(payment_id="pi_1"), "user_1")
                self.assertEqual(create.call_args.kwargs.get("refund_application_fee"), True if fee_id else None)


class CustomerPaymentFeeFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_all_customer_payment_flows_charge_three_percent_of_sale_only(self):
        intent = SimpleNamespace(
            id="pi_1", status="requires_confirmation", client_secret="secret", object="payment_intent",
            amount=11500, amount_received=0, currency="usd", created=0, latest_charge=None, metadata={},
        )
        session = SimpleNamespace(id="cs_1", url="https://checkout.stripe.test")
        with patch.object(main, "stripe_application_fee_percent", "3"), \
             patch.object(main, "require_payment_access"), \
             patch.object(main, "ensure_no_unresolved_templates"), \
             patch.object(main, "is_payment_test_mode", return_value=False), \
             patch.object(main, "load_business_by_user_id", return_value={"id": "business_1"}), \
             patch.object(main, "create_or_update_stripe_customer_for_user", return_value=({"id": "cus_1"}, None)), \
             patch.object(main, "_get_connected_stripe_request_options", return_value={"stripe_account": "acct_1"}), \
             patch.object(main, "insert_payment_record", return_value={"id": "payment_1"}), \
             patch.object(main, "emit_payment_trigger"), \
             patch.object(main, "get_payment_frontend_base_url", return_value="https://nodemere.test"), \
             patch.object(main, "serialize_stripe_invoice", return_value={"id": "in_1"}), \
             patch.object(main.stripe.PaymentIntent, "create", return_value=intent) as create_intent, \
             patch.object(main.stripe.checkout.Session, "create", return_value=session) as create_session, \
             patch.object(main.stripe.InvoiceItem, "create") as create_item, \
             patch.object(main.stripe.Invoice, "create", return_value={"id": "in_1"}) as create_invoice:
            details = {"amount": 11500, "tax_amount": 1000, "tip_amount": 500}
            await main._create_payment_for_user(main.PaymentCreateRequest(**details), "user_1")
            await main._send_payment_link_for_user(main.PaymentLinkCreateRequest(**details), "user_1")
            await main._create_invoice_for_user(main.InvoiceCreateRequest(**details), "user_1")

        self.assertEqual(create_intent.call_args.kwargs["amount"], 11500)
        self.assertEqual(create_intent.call_args.kwargs["application_fee_amount"], 300)
        self.assertEqual(create_intent.call_args.kwargs["metadata"]["nodemere_sale_amount_cents"], "10000")
        self.assertEqual(create_session.call_args.kwargs["line_items"][0]["price_data"]["unit_amount"], 11500)
        self.assertEqual(create_session.call_args.kwargs["payment_intent_data"]["application_fee_amount"], 300)
        self.assertEqual(create_item.call_args.kwargs["amount"], 11500)
        self.assertEqual(create_invoice.call_args.kwargs["application_fee_amount"], 300)


if __name__ == "__main__":
    unittest.main()
