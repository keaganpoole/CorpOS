import unittest
from types import SimpleNamespace
from unittest.mock import patch

from backend import main


class Ledger:
    def __init__(self):
        self.events = []
        self.used_seconds = 12121
        self.rolls = 0

    def table(self, name):
        return Query(self, name)

    def rpc(self, name, params):
        assert name == "roll_business_usage_for_invoice"
        event = next(row for row in self.events if row["stripe_invoice_id"] == params["p_invoice_id"])
        if not event.get("cycle_rolled_at"):
            assert event["status"] == "invoiced"
            self.used_seconds = max(0, self.used_seconds - event["billed_usage_seconds"])
            event["cycle_rolled_at"] = "now"
            self.rolls += 1
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=True))


class Query:
    def __init__(self, ledger, name):
        self.ledger = ledger
        self.name = name
        self.filters = {}
        self.operation = "select"
        self.payload = None

    def select(self, *_args):
        return self

    def eq(self, name, value):
        self.filters[name] = value
        return self

    def limit(self, _limit):
        return self

    def insert(self, payload):
        self.operation, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.operation, self.payload = "update", payload
        return self

    def execute(self):
        if self.name == "users":
            return SimpleNamespace(data=[{"id": "user_1", "plan": "essentials", "subscription_status": "active"}])
        rows = [row for row in self.ledger.events if all(row.get(key) == value for key, value in self.filters.items())]
        if self.operation == "insert":
            row = {"id": "event_1", **self.payload}
            self.ledger.events.append(row)
            return SimpleNamespace(data=[row])
        if self.operation == "update":
            for row in rows:
                row.update(self.payload)
        return SimpleNamespace(data=rows)


class OverageInvoiceTests(unittest.TestCase):
    def setUp(self):
        self.ledger = Ledger()
        self.invoice = {
            "id": "in_renewal", "customer": "cus_1", "subscription": "sub_1",
            "billing_reason": "subscription_cycle", "status": "draft", "currency": "usd",
            "period_start": 1790000000, "period_end": 1792000000,
        }
        self.patches = [
            patch.object(main, "supabase_admin", self.ledger),
            patch.object(main, "is_payment_test_mode", return_value=False),
            patch.object(main, "get_user_plan_context", return_value={"entitlements": {"overage_enabled": True}}),
            patch.object(main, "get_usage_snapshot", return_value={
                "business_id": 42, "used_seconds": 12121, "overage_seconds": 121, "billable_overage_minutes": 3,
                "estimated_overage_amount_cents": 90,
            }),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    def test_renewal_adds_one_ninety_cent_item_even_on_retry(self):
        with patch.object(main.stripe.InvoiceItem, "create", return_value={"id": "ii_overage"}) as create:
            main.attach_overage_to_upcoming_invoice(self.invoice)
            self.ledger.used_seconds += 40  # Calls after invoice creation belong to the next cycle.
            main.attach_overage_to_upcoming_invoice(self.invoice)
        create.assert_called_once()
        self.assertEqual(create.call_args.kwargs["invoice"], "in_renewal")
        self.assertEqual(create.call_args.kwargs["amount"], 90)
        self.assertEqual(self.ledger.events[0]["status"], "invoiced")
        self.assertEqual(self.ledger.rolls, 1)
        self.assertEqual(self.ledger.used_seconds, 40)

    def test_zero_overage_still_rolls_usage_once(self):
        snapshot = {
            "business_id": 42, "used_seconds": 11900, "overage_seconds": 0,
            "billable_overage_minutes": 0, "estimated_overage_amount_cents": 0,
        }
        self.ledger.used_seconds = 11900
        with patch.object(main, "get_usage_snapshot", return_value=snapshot), \
             patch.object(main.stripe.InvoiceItem, "create") as create:
            main.attach_overage_to_upcoming_invoice(self.invoice)
            self.ledger.used_seconds += 40
            main.attach_overage_to_upcoming_invoice(self.invoice)
        create.assert_not_called()
        self.assertEqual(self.ledger.rolls, 1)
        self.assertEqual(self.ledger.used_seconds, 40)

    def test_stripe_failure_remains_retryable(self):
        with patch.object(main.stripe.InvoiceItem, "create", side_effect=RuntimeError("temporary Stripe error")):
            with self.assertRaises(RuntimeError):
                main.attach_overage_to_upcoming_invoice(self.invoice)
        self.assertEqual(self.ledger.events[0]["status"], "failed")


class InvoiceWebhookTests(unittest.IsolatedAsyncioTestCase):
    async def test_only_real_subscription_renewal_invoice_triggers_overage(self):
        class Request:
            async def body(self):
                return b"{}"

        with patch.object(main, "stripe_webhook_secret", "secret"), \
             patch.object(main.stripe.Webhook, "construct_event") as construct, \
             patch.object(main, "record_verified_billing_event"), \
             patch.object(main, "attach_overage_to_upcoming_invoice") as attach:
            for event_type, billing_reason, account in (
                ("invoice.upcoming", "subscription_cycle", None),
                ("invoice.created", "subscription_create", None),
                ("invoice.created", "subscription_cycle", "acct_connected"),
                ("invoice.created", "subscription_cycle", None),
            ):
                construct.return_value = {
                    "type": event_type, "account": account,
                    "data": {"object": {"id": "in_renewal", "billing_reason": billing_reason}},
                }
                self.assertEqual(
                    await main.stripe_webhook(Request(), stripe_signature="sig"),
                    {"status": "success"},
                )
        attach.assert_called_once_with({"id": "in_renewal", "billing_reason": "subscription_cycle"})


if __name__ == "__main__":
    unittest.main()
