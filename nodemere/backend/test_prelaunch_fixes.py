"""Offline regression tests for the prelaunch fixes; never boot the application.

main.py has import-time application/integration side effects. Compile the actual
selected handlers from its AST, then supply synthetic persistence and providers.
The scenario executor is imported normally. No handler logic is copied here.
"""
import ast
import asyncio
import copy
import hashlib
import json
import logging
import re
import unittest
from collections import defaultdict
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4, uuid5, NAMESPACE_URL

from fastapi import HTTPException, status
from pydantic import BaseModel, Field
from backend.scenario_engine import ScenarioActionExecutor, ScenarioEngine, ScenarioFlowExecutor, APPOINTMENT_REMINDER_JOB_TYPE

OWNER = "11111111-1111-4111-8111-111111111111"
APPOINTMENT = "22222222-2222-4222-8222-222222222222"


class Query:
    def __init__(self, db, table):
        self.db, self.table = db, table
        self.op, self.values = "select", None
        self.filters, self.orders = [], []
        self.bounds, self.maximum = None, None

    def select(self, *args, **kwargs): return self
    def eq(self, key, value): self.filters.append(lambda r: r.get(key) == value); return self
    def is_(self, key, value): self.filters.append(lambda r: r.get(key) is None); return self
    def in_(self, key, values): self.filters.append(lambda r: r.get(key) in values); return self
    def lte(self, key, value): self.filters.append(lambda r: r.get(key) is not None and r[key] <= value); return self
    def or_(self, expression):
        # The reconciliation guard handles legacy NULL and cumulative totals.
        key, _, tail = expression.partition(".is.null,")
        maximum = int(tail.rsplit(".", 1)[-1])
        self.filters.append(lambda r: r.get(key) is None or r[key] <= maximum)
        return self
    def limit(self, size): self.maximum = size; return self
    def range(self, start, end): self.bounds = (start, end + 1); return self
    def order(self, key, desc=False): self.orders.append((key, desc)); return self
    def insert(self, values): self.op, self.values = "insert", values; return self
    def update(self, values): self.op, self.values = "update", values; return self

    def execute(self):
        if self.db.fail_table == self.table:
            raise RuntimeError("Synthetic database outage")
        rows = self.db.data.setdefault(self.table, [])
        if self.op == "update" and self.db.before_update:
            self.db.before_update(self.table, self.values)
        selected = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "insert":
            row = copy.deepcopy(self.values)
            row.setdefault("id", str(uuid4()))
            if any(r["id"] == row["id"] for r in rows):
                raise ValueError("duplicate primary key")
            rows.append(row)
            selected = [row]
        elif self.op == "update":
            for row in selected:
                row.update(copy.deepcopy(self.values))
        for key, desc in reversed(self.orders):
            selected.sort(key=lambda r: str(r.get(key) or ""), reverse=desc)
        if self.bounds: selected = selected[slice(*self.bounds)]
        if self.maximum is not None: selected = selected[:self.maximum]
        return SimpleNamespace(data=copy.deepcopy(selected))


class Database:
    def __init__(self, **tables):
        self.data, self.fail_table = tables, None
        self.before_update = None
    def table(self, name): return Query(self, name)


def handlers(db):
    names = {
        "InvoiceCreateRequest", "RefundPaymentRequest", "AccountDeletionRequest",
        "list_sonar_people", "search_sonar_people", "list_sonar_appointments", "get_sonar_appointment_stats",
        "upsert_payment_from_stripe", "normalize_payment_record_status", "update_payment_record", "is_uuid_value",
        "reconcile_payment_refunds", "_refund_payment_for_user", "_create_invoice_for_user",
        "cancel_nodemere_subscription_for_deletion", "request_account_deletion",
        "emit_verified_payment_received", "stripe_webhook", "validate_appointment_schedule",
    }
    source = Path(__file__).with_name("main.py")
    tree = ast.parse(source.read_text(encoding="utf-8-sig"))
    nodes = [node for node in tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and node.name in names]
    for node in nodes: node.decorator_list = []
    namespace = dict(globals(), __package__="backend", __name__="backend.prelaunch_handlers")
    namespace.update(
        Depends=lambda fn: None, Header=lambda value: value, get_current_user=lambda: None,
        supabase=db, supabase_admin=db, stripe=MagicMock(), business_owner_id=lambda user: user.id,
        load_business_by_user_id=lambda owner: next((b for b in db.data.get("businesses", []) if b["user_id"] == owner), None),
        require_payment_access=MagicMock(), ensure_no_unresolved_templates=MagicMock(),
        customer_payment_fee_base=lambda amount, tax, tip: amount - tax - tip,
        calculate_platform_application_fee=lambda amount: 0,
        build_invoice_metadata=lambda **kw: kw, customer_payment_fee_metadata=lambda *a: {},
        _get_connected_stripe_request_options=lambda owner: {"stripe_account": "acct_synthetic"},
        _stripe_platform_api_key=lambda: "synthetic_platform_key", is_payment_test_mode=lambda: False,
        _stripe_object_to_dict=dict, serialize_stripe_invoice=dict, serialize_stripe_refund=dict,
        sync_business_plan_entitlement=MagicMock(), claim_payment_milestones=MagicMock(),
        create_or_update_stripe_customer_for_user=lambda **kw: ({"id": "cus_synthetic"}, None),
        get_usage_snapshot=lambda owner: {"used_seconds": 120},
        resolve_scenario_event_business_id=lambda payload: 1,
        resolve_scenario_user_id_from_stripe_event=lambda event, metadata: OWNER,
        stripe_webhook_secret=None, stripe_connect_webhook_secret="synthetic_secret",
        record_verified_billing_event=MagicMock(), emit_payment_trigger=MagicMock(),
    )
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(source), "exec", flags=__import__("__future__").annotations.compiler_flag), namespace)
    for name in ("InvoiceCreateRequest", "RefundPaymentRequest", "AccountDeletionRequest"):
        namespace[name].model_rebuild(_types_namespace=namespace)
    return namespace


class PrelaunchTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.guard = ExitStack()
        self.addCleanup(self.guard.close)
        for target in ("socket.socket.connect", "socket.create_connection", "requests.sessions.Session.request", "httpx.Client.send", "httpx.AsyncClient.send"):
            self.guard.enter_context(patch(target, side_effect=AssertionError("Live network access is forbidden in regression tests")))
        self.business = {"id": 1, "user_id": OWNER, "name": "Synthetic Salon", "timezone": "UTC"}
        self.db = Database(businesses=[self.business], people=[], appointments=[], payments=[], users=[], account_data_requests=[])
        self.h = handlers(self.db)
        self.user = SimpleNamespace(id=OWNER)

    async def test_people_search_finds_older_record_and_excludes_other_workspace(self):
        self.db.data["people"] = [{"id": f"{i:05}", "business_id": 1, "created_at": f"{i:05}", "first_name": "Usual"} for i in range(1200)]
        self.db.data["people"][0]["notes"] = "Older customer needle"
        self.db.data["people"].append({"id": "other", "business_id": 2, "notes": "needle"})
        rows = await self.h["search_sonar_people"]("needle", current_user=self.user)
        self.assertEqual([r["id"] for r in rows], ["00000"])

    async def test_appointments_pages_and_statistics_include_all_rows(self):
        self.db.data["appointments"] = [{"id": f"{i:05}", "business_id": 1, "date": "2026-12-01", "time": "12:00", "status": "confirmed" if i < 1100 else "cancelled"} for i in range(1203)]
        self.db.data["appointments"].append({"id": "other", "business_id": 2})
        page = self.h["list_sonar_appointments"](limit=500, offset=1000, current_user=self.user)
        self.assertEqual(len(page), 203)
        stats = await self.h["get_sonar_appointment_stats"](self.user)
        self.assertEqual(stats, {"total": 1203, "by_status": {"confirmed": 1100, "cancelled": 103}})

    async def test_scenario_create_rejects_closed_hours_before_insert(self):
        validator = MagicMock(return_value=(False, "Outside business hours", []))
        executor = ScenarioActionExecutor(self.db, {"validate_appointment_schedule": validator}, "")
        result = await executor._create_appointment({"appointmentConfig": {"date": "2026-12-01", "time": "23:00"}}, {"business": self.business})
        self.assertFalse(result["success"])
        self.assertEqual(result["error"], "Outside business hours")
        self.assertEqual(self.db.data["appointments"], [])
        self.assertEqual(validator.call_args.args[0], self.business)

    async def test_scenario_update_checks_effective_schedule_and_excludes_itself(self):
        appointment = {"id": APPOINTMENT, "business_id": 1, "date": "2026-12-01", "time": "12:00", "duration": 45, "staff_id": 7, "status": "confirmed"}
        self.db.data["appointments"] = [appointment.copy()]
        validator = MagicMock(return_value=(False, "Staff conflict", [{"id": "conflict"}]))
        executor = ScenarioActionExecutor(self.db, {"validate_appointment_schedule": validator}, "")
        result = await executor._update_appointment({"appointmentConfig": {"appointment_id": APPOINTMENT, "time": "13:00"}}, {"business": self.business})
        self.assertFalse(result["success"])
        self.assertEqual(self.db.data["appointments"][0], appointment)
        self.assertEqual(validator.call_args.args[1:], ("2026-12-01", "13:00", 45))
        self.assertEqual(validator.call_args.kwargs, {"staff_id": 7, "exclude_appointment_id": APPOINTMENT})

    async def test_scenario_accepts_valid_booking_and_fails_closed_without_validator(self):
        executor = ScenarioActionExecutor(self.db, {"validate_appointment_schedule": lambda *a, **k: (True, None, [])}, "")
        node = {"appointmentConfig": {"date": "2026-12-01", "time": "12:00"}}
        self.assertTrue((await executor._create_appointment(node, {"business": self.business}))["success"])
        executor.callbacks.pop("validate_appointment_schedule")
        self.assertFalse((await executor._create_appointment(node, {"business": self.business}))["success"])
        self.assertEqual(len(self.db.data["appointments"]), 1)

    async def test_payment_link_binds_intent_to_existing_row(self):
        self.db.data["payments"] = [{"id": "pay", "stripe_session_id": "cs_synthetic", "status": "pending"}]
        row = self.h["upsert_payment_from_stripe"](session_id="cs_synthetic", payment_intent_id="pi_synthetic", status="succeeded")
        self.assertEqual(row["stripe_payment_intent_id"], "pi_synthetic")
        self.assertEqual(len(self.db.data["payments"]), 1)

    async def test_refunds_use_cumulative_totals_and_ignore_old_snapshot(self):
        self.db.data["payments"] = [{"id": "pay", "user_id": OWNER, "stripe_payment_intent_id": "pi_synthetic", "amount": 1000}]
        provider = self.h["stripe"].PaymentIntent.retrieve
        for total, expected in [(300, "partial_refund"), (700, "partial_refund"), (1000, "refunded"), (300, "refunded")]:
            provider.return_value = {"latest_charge": {"amount": 1000, "amount_refunded": total}}
            row = self.h["reconcile_payment_refunds"]("pi_synthetic", OWNER, {})
            self.assertEqual(row["status"], expected)
        self.assertEqual(row["refunded_amount"], 1000)
        row = self.h["upsert_payment_from_stripe"](payment_intent_id="pi_synthetic", status="succeeded")
        self.assertEqual(row["status"], "refunded")

    async def test_refund_repairs_legacy_checkout_payment(self):
        self.db.data["payments"] = [{"id": APPOINTMENT, "user_id": OWNER, "stripe_session_id": "cs_synthetic", "amount": 1000}]
        stripe = self.h["stripe"]
        stripe.checkout.Session.retrieve.return_value = {"id": "cs_synthetic", "payment_intent": "pi_synthetic"}
        stripe.PaymentIntent.retrieve.return_value = {"latest_charge": {"amount": 1000, "amount_refunded": 300}, "customer": "cus_synthetic"}
        stripe.Refund.create.return_value = {"id": "re_synthetic", "amount": 300, "status": "succeeded"}
        await self.h["_refund_payment_for_user"](self.h["RefundPaymentRequest"](payment_id=APPOINTMENT, amount=300), OWNER)
        self.assertEqual(stripe.Refund.create.call_args.kwargs["payment_intent"], "pi_synthetic")
        self.assertEqual(self.db.data["payments"][0]["status"], "partial_refund")

    async def test_delayed_success_cannot_overwrite_concurrent_refund(self):
        self.db.data["payments"] = [{"id": "pay", "stripe_payment_intent_id": "pi_synthetic", "amount": 1000, "refunded_amount": 0, "status": "pending"}]
        def concurrent_refund(table, values):
            self.db.before_update = None
            self.db.data["payments"][0].update(status="refunded", refunded_amount=1000)
        self.db.before_update = concurrent_refund
        result = self.h["upsert_payment_from_stripe"](payment_intent_id="pi_synthetic", status="succeeded", receipt_url="synthetic receipt")
        self.assertEqual(result["status"], "refunded")
        self.assertEqual(result["receipt_url"], "synthetic receipt")

    async def test_failed_refund_reconciles_reversed_refund_total(self):
        self.db.data["payments"] = [{"id": "pay", "user_id": OWNER, "stripe_payment_intent_id": "pi_synthetic", "amount": 1000, "refunded_amount": 1000, "status": "refunded"}]
        self.h["stripe"].PaymentIntent.retrieve.return_value = {"latest_charge": {"amount": 1000, "amount_refunded": 300}}
        row = self.h["reconcile_payment_refunds"]("pi_synthetic", OWNER, {}, allow_decrease=True)
        self.assertEqual((row["status"], row["refunded_amount"]), ("partial_refund", 300))

    async def test_invoice_partial_failure_retry_adds_one_attached_item(self):
        stripe = self.h["stripe"]
        invoices, items, operations = {}, {}, []
        def create_invoice(**kw):
            operations.append("invoice")
            self.assertEqual(kw["pending_invoice_items_behavior"], "exclude")
            return invoices.setdefault(kw["idempotency_key"], {"id": "in_synthetic", "status": "draft"})
        def create_item(**kw):
            operations.append("item")
            self.assertEqual(kw["invoice"], "in_synthetic")
            items.setdefault(kw["idempotency_key"], kw)
        stripe.Invoice.create.side_effect = create_invoice
        stripe.InvoiceItem.create.side_effect = create_item
        stripe.Invoice.retrieve.side_effect = [RuntimeError("Lost response"), {"id": "in_synthetic", "amount_due": 1000}]
        request = self.h["InvoiceCreateRequest"](amount=1000, operation_id="synthetic-operation")
        with self.assertRaises(HTTPException): await self.h["_create_invoice_for_user"](request, OWNER)
        result = await self.h["_create_invoice_for_user"](request, OWNER)
        self.assertEqual(result["amount_due"], 1000)
        self.assertEqual((len(invoices), len(items)), (1, 1))
        self.assertEqual(operations, ["invoice", "item", "invoice", "item"])

    async def test_deletion_validates_name_before_touching_billing(self):
        self.db.data["users"] = [{"id": OWNER, "subscription_status": "active", "account_status": "active"}]
        request = self.h["AccountDeletionRequest"](business_name="wrong", reason="Other", acknowledged=True)
        with patch("backend.authorization.authorize_account_closure"):
            with self.assertRaises(HTTPException) as caught: await self.h["request_account_deletion"](request, self.user)
        self.assertEqual(caught.exception.status_code, 400)
        self.h["stripe"].Subscription.cancel.assert_not_called()

    async def test_deletion_cancels_platform_subscription_and_saves_usage(self):
        self.db.data["users"] = [{"id": OWNER, "subscription_status": "active", "account_status": "active", "stripe_subscription_id": "sub_synthetic", "stripe_customer_id": "cus_owner"}]
        stripe = self.h["stripe"]
        stripe.Subscription.retrieve.return_value = {"id": "sub_synthetic", "customer": "cus_owner", "status": "active"}
        stripe.Subscription.cancel.return_value = {"status": "canceled"}
        request = self.h["AccountDeletionRequest"](business_name="Synthetic Salon", reason="Other", acknowledged=True)
        with patch("backend.authorization.authorize_account_closure"):
            result = await self.h["request_account_deletion"](request, self.user)
        self.assertTrue(result["requested"])
        stripe.Subscription.cancel.assert_called_once_with("sub_synthetic", api_key="synthetic_platform_key")
        self.assertEqual(self.db.data["users"][0]["account_status"], "pending_deletion")
        details = json.loads(self.db.data["account_data_requests"][0]["details"])
        self.assertEqual(details["usage_snapshot"]["used_seconds"], 120)

    async def test_deletion_stops_when_billing_cancellation_fails(self):
        self.db.data["users"] = [{"id": OWNER, "subscription_status": "active", "account_status": "active", "stripe_subscription_id": "sub_synthetic", "stripe_customer_id": "cus_owner"}]
        self.h["stripe"].Subscription.retrieve.side_effect = RuntimeError("Provider unavailable")
        request = self.h["AccountDeletionRequest"](business_name="Synthetic Salon", reason="Other", acknowledged=True)
        with patch("backend.authorization.authorize_account_closure"):
            with self.assertRaises(HTTPException): await self.h["request_account_deletion"](request, self.user)
        self.assertEqual(self.db.data["users"][0]["account_status"], "active")
        self.assertEqual(self.db.data["account_data_requests"], [])

    async def test_payment_replays_use_durable_execution_claims(self):
        scenario = {"id": "scenario", "business_id": 1, "user_id": OWNER, "nodes_data": [{"id": "trigger", "configured": True, "categoryType": "TRIGGERS"}], "edges_data": []}
        executor = ScenarioFlowExecutor(self.db, None)
        executor._execute_from_node = AsyncMock(return_value={"success": True})
        async def delivery(): return await executor.start(scenario, {}, event_key="payment_received:1:pi_synthetic")
        results = await asyncio.gather(delivery(), delivery(), delivery())
        self.assertTrue(all(row["success"] for row in results))
        executor._execute_from_node.assert_awaited_once()
        # A new process/executor still sees the same claim.
        restarted = ScenarioFlowExecutor(self.db, None)
        restarted._execute_from_node = AsyncMock()
        self.assertTrue((await restarted.start(scenario, {}, event_key="payment_received:1:pi_synthetic"))["duplicate"])
        restarted._execute_from_node.assert_not_awaited()

    async def test_verified_payment_dispatch_retries_after_database_outage(self):
        self.h["scenario_engine"] = SimpleNamespace(handle_event=AsyncMock(return_value={"runs": []}))
        self.db.fail_table = "scenario_events"
        with self.assertRaises(RuntimeError): await self.h["emit_verified_payment_received"]({"user_id": OWNER}, "pi_synthetic")
        self.h["scenario_engine"].handle_event.assert_not_awaited()
        self.db.fail_table = None
        await self.h["emit_verified_payment_received"]({"user_id": OWNER}, "pi_synthetic")
        await self.h["emit_verified_payment_received"]({"user_id": OWNER}, "pi_synthetic")
        self.assertEqual(len(self.db.data["scenario_events"]), 1)
        calls = self.h["scenario_engine"].handle_event.await_args_list
        self.assertEqual(calls[0].kwargs["event_key"], calls[1].kwargs["event_key"])

    async def test_checkout_and_intent_webhooks_share_payment_key_in_both_orders(self):
        self.h["scenario_engine"] = SimpleNamespace(handle_event=AsyncMock(return_value={"runs": []}))
        events = [
            {"type": "checkout.session.completed", "account": "acct_synthetic", "data": {"object": {"id": "cs_synthetic", "mode": "payment", "payment_status": "paid", "payment_intent": "pi_synthetic", "metadata": {}}}},
            {"type": "payment_intent.succeeded", "account": "acct_synthetic", "data": {"object": {"id": "pi_synthetic", "status": "succeeded", "metadata": {}}}},
        ]
        request = SimpleNamespace(body=AsyncMock(return_value=b"synthetic"))
        self.h["stripe"].checkout.Session.list.return_value = {"data": [{"id": "cs_synthetic"}]}
        for ordered in (events, events[::-1]):
            self.db.data["payments"] = [{"id": "pay", "user_id": OWNER, "stripe_session_id": "cs_synthetic", "status": "pending"}]
            self.db.data["scenario_events"] = []
            for event in ordered + ordered:
                self.h["stripe"].Webhook.construct_event.return_value = event
                await self.h["stripe_webhook"](request, "synthetic_signature")
            self.assertEqual(len(self.db.data["scenario_events"]), 1)
            self.assertEqual(self.db.data["payments"][0]["stripe_payment_intent_id"], "pi_synthetic")
            self.assertEqual(self.h["scenario_engine"].handle_event.await_args.args[1]["payment"]["id"], "pay")

    async def test_refund_webhooks_reconcile_partial_full_and_stale_deliveries(self):
        self.db.data["payments"] = [{"id": "pay", "user_id": OWNER, "stripe_payment_intent_id": "pi_synthetic", "amount": 1000}]
        request = SimpleNamespace(body=AsyncMock(return_value=b"synthetic"))
        for total in (300, 700, 1000, 300):
            self.h["stripe"].PaymentIntent.retrieve.return_value = {"latest_charge": {"amount": 1000, "amount_refunded": total}}
            event = {"type": "refund.created", "account": "acct_synthetic", "data": {"object": {"id": "refund", "payment_intent": "pi_synthetic", "amount": 300, "status": "succeeded"}}}
            self.h["stripe"].Webhook.construct_event.return_value = event
            await self.h["stripe_webhook"](request, "signature")
            self.assertEqual(self.db.data["payments"][0]["status"], "partial_refund" if total < 1000 and self.db.data["payments"][0]["refunded_amount"] < 1000 else "refunded")
        self.assertEqual(self.db.data["payments"][0]["refunded_amount"], 1000)

    async def test_deletion_retry_finishes_after_request_was_already_saved(self):
        self.db.data["users"] = [{"id": OWNER, "subscription_status": "canceled", "account_status": "active"}]
        self.db.data["account_data_requests"] = [{"id": "existing", "user_id": OWNER, "request_type": "deletion", "status": "requested"}]
        request = self.h["AccountDeletionRequest"](business_name="Synthetic Salon", reason="Other", acknowledged=True)
        with patch("backend.authorization.authorize_account_closure"):
            result = await self.h["request_account_deletion"](request, self.user)
        self.assertEqual(result["request_id"], "existing")
        self.assertEqual(len(self.db.data["account_data_requests"]), 1)
        self.assertEqual(self.db.data["users"][0]["account_status"], "pending_deletion")

    async def test_reload_preserves_due_reminder_but_drops_moved_or_canceled(self):
        now = datetime.now(timezone.utc)
        start = (now + timedelta(minutes=20)).replace(second=0, microsecond=0)
        target = start - timedelta(minutes=30)
        appointment = {"id": APPOINTMENT, "business_id": 1, "date": start.date().isoformat(), "time": start.time().isoformat(), "status": "confirmed"}
        self.db.data["appointments"] = [appointment]
        scenario = {"id": "scenario", "user_id": OWNER, "business_id": 1, "status": "active"}
        reminder = {"appointment_id": APPOINTMENT, "target_at": target.isoformat(), "reminder_minutes": 30}
        self.db.data["jobs"] = [{"id": "job", "scenario_id": "scenario", "type": APPOINTMENT_REMINDER_JOB_TYPE, "status": "active", "payload": {"reminders": [reminder]}}]
        engine = ScenarioEngine(self.db, {}, "")
        engine._appointment_soon_node = lambda s: {"id": "trigger"}
        engine._appointment_reminder_targets = lambda s: ([], self.business, 30)
        with patch("backend.scenario_engine.validate_scenario_definition", return_value=[]):
            await engine._sync_appointment_reminder_job_for_scenario(scenario)
            self.assertEqual(self.db.data["jobs"][0]["next_run_at"], target.isoformat())
            appointment["status"] = "cancelled"
            await engine._sync_appointment_reminder_job_for_scenario(scenario)
            self.assertEqual(self.db.data["jobs"][0]["status"], "cancelled")

    async def test_abandoned_reminder_claim_is_recovered(self):
        self.db.data["jobs"] = [{"id": "job", "scenario_id": "scenario", "type": APPOINTMENT_REMINDER_JOB_TYPE, "status": "running", "locked_at": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(), "next_run_at": (datetime.now(timezone.utc) - timedelta(minutes=3)).isoformat()}]
        engine = ScenarioEngine(self.db, {}, "")
        engine._run_appointment_reminder_job = AsyncMock(return_value={"ok": True})
        result = await engine.run_due_appointment_reminder_jobs()
        self.assertEqual(result["claimed"], 1)
        engine._run_appointment_reminder_job.assert_awaited_once()

    async def test_reminder_checkpoint_keeps_completed_targets_out_of_retry(self):
        start = (datetime.now(timezone.utc) + timedelta(minutes=20)).replace(second=0, microsecond=0)
        reminders = []
        for key in ("first", "second"):
            self.db.data["appointments"].append({"id": key, "business_id": 1, "date": start.date().isoformat(), "time": start.time().isoformat(), "status": "confirmed"})
            reminders.append({"appointment_id": key, "target_at": (start - timedelta(minutes=30)).isoformat(), "reminder_minutes": 30})
        scenario = {"id": "scenario", "business_id": 1, "user_id": OWNER, "status": "active"}
        self.db.data["scenarios"] = [scenario]
        engine = ScenarioEngine(self.db, {}, "")
        engine._load_scenario_business = lambda s: self.business
        engine.trigger_scenario = AsyncMock(side_effect=[{"ok": True, "result": {"success": True}}, {"ok": False, "error": "Synthetic failure"}])
        job = {"id": "job", "scenario_id": "scenario", "business_id": 1, "status": "running", "locked_by": engine.scheduler_worker_id, "payload": {"reminders": reminders}}
        self.db.data["jobs"] = [copy.deepcopy(job)]
        result = await engine._run_appointment_reminder_job(job)
        self.assertFalse(result["ok"])
        saved = self.db.data["jobs"][0]
        self.assertEqual([r["appointment_id"] for r in saved["payload"]["reminders"]], ["second"])
        self.assertEqual(saved["status"], "failed")


if __name__ == "__main__":
    unittest.main()
