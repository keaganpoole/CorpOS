import unittest
from types import SimpleNamespace
from unittest.mock import patch

from .partner_billing import paid_progress, stripe_paid_periods


DAY = 86400


class StripeRow(dict):
    @property
    def id(self):
        return self["id"]


def page(*rows):
    return SimpleNamespace(auto_paging_iter=lambda: iter(rows))


class PartnerBillingTests(unittest.TestCase):
    def test_counts_elapsed_union_with_gaps_and_late_payments(self):
        periods = [(0, 20 * DAY, 2 * DAY), (10 * DAY, 22 * DAY, 10 * DAY),
                   (30 * DAY, 190 * DAY, 31 * DAY)]
        self.assertEqual(paid_progress(periods, 0, 180 * DAY, 40 * DAY), (29 * DAY, None))
        self.assertEqual(paid_progress(periods, 0, 180 * DAY, 41 * DAY), (30 * DAY, 41 * DAY))

    def test_expiry_clamps_paid_service(self):
        self.assertEqual(paid_progress([(151 * DAY, 200 * DAY, 151 * DAY)],
                                       2 * DAY, 180 * DAY, 200 * DAY), (29 * DAY, None))
        self.assertEqual(paid_progress([(150 * DAY, 200 * DAY, 150 * DAY)],
                                       2 * DAY, 180 * DAY, 200 * DAY), (30 * DAY, 180 * DAY))

    def test_invoice_requires_settled_unrefunded_payment_and_eligible_recurring_product(self):
        invoice = StripeRow(id="in_1", status="paid", amount_due=2000, amount_paid=2000,
                            status_transitions={"paid_at": 5 * DAY})
        line = StripeRow(id="il_1", amount=2000, period={"start": 5 * DAY, "end": 40 * DAY},
                         parent={"subscription_item_details": {"subscription": "sub_1"}},
                         pricing={"price_details": {"price": "price_1"}})
        payment = StripeRow(id="inpay_1", payment={"type": "payment_intent", "payment_intent": "pi_1"},
                            amount_paid=2000)
        charge = StripeRow(id="ch_1", paid=True, captured=True, amount_captured=2000)
        plan = {"type": "recurring", "product": {"name": "Ultra"}}
        subscription = {"customer": "cus_1", "ended_at": 20 * DAY}
        with (
            patch("stripe.Invoice.list", return_value=page(invoice)),
            patch("stripe.Invoice.list_lines", return_value=page(line)),
            patch("stripe.Price.retrieve", return_value=plan),
            patch("stripe.Subscription.retrieve", return_value=subscription),
            patch("stripe.InvoicePayment.list", return_value=page(payment)),
            patch("stripe.PaymentIntent.retrieve", return_value={"status": "succeeded", "latest_charge": charge}) as retrieve,
        ):
            periods, evidence = stripe_paid_periods("cus_1", 0, 180 * DAY, "fixture")
            self.assertEqual(periods, [(5 * DAY, 20 * DAY, 5 * DAY)])
            self.assertEqual(evidence[0]["plan"], "ultra")
            retrieve.return_value["status"] = "requires_payment_method"
            self.assertEqual(stripe_paid_periods("cus_1", 0, 180 * DAY, "fixture"), ([], []))
            retrieve.return_value["status"] = "succeeded"
            charge["amount_refunded"] = 100
            self.assertEqual(stripe_paid_periods("cus_1", 0, 180 * DAY, "fixture"), ([], []))
            charge["amount_refunded"] = 0
            plan["product"]["name"] = "Overage"
            self.assertEqual(stripe_paid_periods("cus_1", 0, 180 * DAY, "fixture"), ([], []))

    def test_settled_plan_change_replaces_credited_service(self):
        def invoice(in_id, day):
            return StripeRow(id=in_id, status="paid", amount_due=1200, amount_paid=1200,
                             status_transitions={"paid_at": day * DAY})

        def line(line_id, plan, start, end, amount=1200, credited=None):
            details = {"subscription": "sub_1"}
            if credited:
                details["proration_details"] = {"credited_items": {"invoice_line_items": [credited]}}
            return StripeRow(id=line_id, amount=amount, period={"start": start * DAY, "end": end * DAY},
                             parent={"subscription_item_details": details},
                             pricing={"price_details": {"price": plan}})

        original = invoice("in_original", 1)
        upgrade = invoice("in_upgrade", 21)
        lines = {
            original.id: page(line("il_original", "pro", 1, 31)),
            upgrade.id: page(line("il_credit", "pro", 21, 31, -600, "il_original"),
                             line("il_upgrade", "ultra", 21, 41, 1800)),
        }
        with (
            patch("stripe.Invoice.list", return_value=page(upgrade, original)),
            patch("stripe.Invoice.list_lines", side_effect=lambda invoice_id, **kwargs: lines[invoice_id]),
            patch("stripe.Price.retrieve", side_effect=lambda price, **kwargs: {"type": "recurring", "product": {"name": price}}),
            patch("stripe.Subscription.retrieve", return_value={"customer": "cus_1"}),
            patch("backend.partner_billing.invoice_has_settled_payment", return_value=True),
        ):
            periods, evidence = stripe_paid_periods("cus_1", 0, 180 * DAY, "fixture")
            self.assertEqual({row["plan"] for row in evidence}, {"pro", "ultra"})
            self.assertIn((DAY, 21 * DAY, DAY), periods)
            self.assertEqual(paid_progress(periods, 0, 180 * DAY, 31 * DAY), (30 * DAY, 31 * DAY))
            upgrade["status"] = "open"
            periods, _ = stripe_paid_periods("cus_1", 0, 180 * DAY, "fixture")
            self.assertEqual(paid_progress(periods, 0, 180 * DAY, 41 * DAY), (20 * DAY, None))
