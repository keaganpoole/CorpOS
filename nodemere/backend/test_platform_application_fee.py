import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

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


if __name__ == "__main__":
    unittest.main()
