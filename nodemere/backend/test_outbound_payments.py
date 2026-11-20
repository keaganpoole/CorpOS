import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Lock
from unittest.mock import MagicMock, patch

import stripe
from fastapi import HTTPException
from pydantic import ValidationError
from starlette.routing import Match

from backend import main
from backend import outbound_payments as payments
from backend.email_delivery_service import EmailDeliveryError, SystemResendConfiguration
from backend.security import issue_internal_context, verify_internal_context
from backend.test_prelaunch_fixes import Database, Query


class LockedQuery(Query):
    def execute(self):
        with self.db.lock:
            return super().execute()


class TestDatabase(Database):
    def __init__(self):
        super().__init__(payments=[], services=[])
        self.lock = Lock()

    def table(self, name):
        return LockedQuery(self, name)


class OutboundPayments(unittest.TestCase):
    def setUp(self):
        self.person = dict(id=12, business_id=21, email="alex@example.com", phone="+1 202-555-0100", balance_due="45.00")
        self.db = TestDatabase()
        self.api = MagicMock()
        self.api.supabase = self.db
        self.api.internal_tool_secret = "fixture-signing-key"
        self.api.load_person_by_id_for_user.return_value = self.person
        self.api.load_business_by_id.return_value = {"name": "Example Salon"}
        self.api.is_payment_test_mode.return_value = False
        self.options = dict(api_key="sk_test_fixture", stripe_account="acct_fixture")
        self.api._get_connected_stripe_request_options.return_value = self.options
        self.api._system_resend_configuration.return_value = SystemResendConfiguration("billing@example.com", "fixture")
        self.api.get_public_backend_base_url.return_value = "https://api.example.com"
        self.api.get_payment_frontend_base_url.return_value = "https://example.com"
        self.api.calculate_platform_application_fee.side_effect = main.calculate_platform_application_fee
        self.api.build_scenario_customer_metadata.side_effect = main.build_scenario_customer_metadata
        self.api.customer_payment_fee_metadata.side_effect = main.customer_payment_fee_metadata
        self.api.create_customer_checkout.side_effect = main.create_customer_checkout
        self.api.stripe.InvalidRequestError = stripe.InvalidRequestError
        self.session = stripe.checkout.Session.construct_from({"id": "cs_fixture", "url": "https://checkout.stripe.com/test",
                                                              "status": "open", "payment_intent": None}, None)
        self.api.stripe.checkout.Session.retrieve.return_value = self.session
        self.checkout = self.enter_patch(main.stripe.checkout.Session, "create", return_value=self.session)
        self.mail = self.enter_patch(payments, "send_secure_link_email", return_value={"message_id": "msg_fixture"})
        self.enter_patch(main, "stripe_application_fee_percent", "3")
        self.claims = dict(sub="owner", business_id="21", **payments.outbound_payment_claims(self.person, "+12025550100"))

    def enter_patch(self, *args, **kwargs):
        patcher = patch.object(*args, **kwargs)
        self.addCleanup(patcher.stop)
        return patcher.start()

    def history(self, email=None):
        return json.dumps({"entries": [{"role": "user", "message": "My email is " + (email or self.person["email"])}]})

    def agreed_history(self):
        entries = json.loads(self.history())["entries"] + [
            {"role": "tool", "tool_results": [{"tool_name": "get_payments", "result_value": "{}"}]},
            {"role": "agent", "message": "May I send the $45 link to alex@example.com?"},
            {"role": "user", "message": "Yes, please email it."}]
        return json.dumps({"entries": entries})

    def lookup(self, **overrides):
        return payments.handle_payment(self.api, self.claims, payments.PaymentLookup(**{"customer_email": self.person["email"], "conversation_history": self.history(overrides.get("customer_email")), **overrides}))

    def send(self, **overrides):
        if "quote_id" not in overrides:
            quote = self.lookup(service_name=overrides.get("service_name"))["quote"]
            overrides["quote_id"] = quote["quote_id"] if quote else "unavailable"
        body = {"customer_email": self.person["email"], "conversation_history": self.agreed_history(),
                "confirmed_amount_cents": 4500, "confirmed": True, **overrides}
        return payments.handle_payment(self.api, self.claims, payments.PaymentSend(**body))

    def assert_blocked(self, code, action, **args):
        with self.assertRaises(HTTPException) as ctx:
            action(**args)
        self.assertEqual(ctx.exception.status_code, code)

    def test_routes_use_internal_authorization_before_legacy_dispatch(self):
        for name in ("get-payments", "send-payment-link"):
            scope = {"type": "http", "method": "POST", "path": "/api/tools/" + name, "root_path": ""}
            first = next(route for route in main.app.routes if route.matches(scope)[0] == Match.FULL)
            self.assertTrue(first.endpoint.__name__.startswith("outbound_"))
            self.assertIn(main.require_internal_tool_authorization, [d.call for d in first.dependant.dependencies])

    def test_signed_customer_context_and_international_number(self):
        person = {**self.person, "phone": "+44 (20) 1234 5678"}
        bound = payments.outbound_payment_claims(person, "+442012345678")
        token = issue_internal_context("fixture", {"id": 21, "user_id": "owner"}, claims=bound)
        self.assertEqual(verify_internal_context("fixture", token)["payment_person"], "12")
        self.assertEqual(payments.outbound_payment_claims(person, "+12025550101"), {})

    def test_missing_context_rejected_before_any_read(self):
        del self.claims["payment_contact"]
        self.assert_blocked(403, self.lookup)
        self.api.load_person_by_id_for_user.assert_not_called()

    def test_identity_and_contact_change(self):
        for key, value in (("business_id", 33), ("id", 14), ("phone", "+12025550177"), ("email", "other@example.com")):
            with self.subTest(key=key), patch.dict(self.person, {key: value}):
                self.assert_blocked(403, self.lookup)
        self.assert_blocked(403, self.lookup, customer_email="other@example.com")
        self.checkout.assert_not_called()

    def test_access_plan_and_checkout_mode(self):
        self.api.is_payment_test_mode.return_value = True
        self.assert_blocked(409, self.lookup)
        self.api.require_payment_access.side_effect = HTTPException(403, "Plan")
        self.assert_blocked(403, self.lookup)
        self.api._get_connected_stripe_request_options.assert_not_called()

    def test_quote_requires_positive_exact_cents_and_no_existing_invoice(self):
        for value in (0, -1, "NaN", "45.005", "", "1e100"):
            with self.subTest(value=value), patch.dict(self.person, balance_due=value):
                self.assertIsNone(self.lookup()["quote"])
        for update in ({"invoice_id": "in_external"}, {"payment_status": "paid"}):
            with patch.dict(self.person, update):
                self.assertIsNone(self.lookup()["quote"])

    def test_service_exactly_one_active_fixed_price(self):
        service = {"id": "svc", "business_id": "21", "name": "Haircut", "price_type": "fixed", "price_min": "19.00", "is_active": True}
        self.db.data["services"] = [service]
        self.assertEqual(self.lookup(service_name="Haircut")["quote"]["amount_cents"], 1900)
        for field, value in (("price_type", "range"), ("business_id", "22"), ("is_active", False)):
            with patch.dict(service, {field: value}):
                self.assertIsNone(self.lookup(service_name="Haircut")["quote"])
        self.db.data["services"].append(service.copy())
        self.assertIsNone(self.lookup(service_name="Haircut")["quote"])

    def test_requires_explicit_consent_and_authoritative_amount(self):
        self.assert_blocked(409, self.send, confirmed=False)
        self.assert_blocked(409, self.send, confirmed_amount_cents=123)
        for args in ({"confirmed_amount_cents": "4500"}, {"customer_id": "123"}, {"confirmed": "yes"}):
            with self.assertRaises(ValidationError):
                self.send(**args)
        self.assertEqual(self.db.data["payments"], [])

    def test_confirmed_checkout_scopes_amount_recipient_and_fee(self):
        self.assertEqual(self.send(), {"status": "sent"})
        args = self.checkout.call_args.kwargs
        self.assertEqual(args["stripe_account"], "acct_fixture")
        self.assertEqual(args["line_items"][0]["price_data"]["unit_amount"], 4500)
        self.assertEqual(args["payment_intent_data"]["application_fee_amount"], 135)
        self.assertEqual(args["metadata"]["person_id"], "12")
        self.assertEqual(args["customer_email"], "alex@example.com")
        self.assertEqual(args["success_url"], "https://api.example.com/payments/checkout-return")
        self.assertEqual(self.mail.call_args.kwargs["recipient_email"], "alex@example.com")
        self.assertTrue(self.db.data["payments"][0]["metadata"]["email_sent"])

    def test_repeat_request_and_new_call_reuse_same_balance(self):
        self.send()
        self.claims["payment_call"] = "second-call"
        self.assertEqual(self.send(), {"status": "sent"})
        self.checkout.assert_called_once()
        self.mail.assert_called_once()

    def test_midcall_balance_change_prevents_second_link(self):
        self.send()
        self.person["balance_due"] = "75.00"
        self.assert_blocked(409, self.send, confirmed_amount_cents=7500)
        self.checkout.assert_called_once()

    def test_concurrent_retries_have_single_reservation_and_provider_keys(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.send(), range(8)))
        self.assertEqual(results, [{"status": "sent"}] * 8)
        self.assertEqual(len(self.db.data["payments"]), 1)
        for mock in (self.checkout, self.mail):
            self.assertEqual(len({c.kwargs["idempotency_key"] for c in mock.call_args_list}), 1)

    def test_unavailable_email_or_fee(self):
        self.api._system_resend_configuration.return_value = SystemResendConfiguration(None, None)
        self.assert_blocked(503, self.send)
        self.assertEqual(self.db.data["payments"], [])
        self.api._system_resend_configuration.return_value = SystemResendConfiguration("sender@example.com", "fixture")
        self.api.calculate_platform_application_fee.side_effect = lambda amount: 0
        self.assert_blocked(409, self.send)
        self.checkout.assert_not_called()

    def test_email_failure_then_recovery_uses_same_checkout(self):
        self.mail.side_effect = [EmailDeliveryError("failed", "test"), {"message_id": "m"}]
        self.assert_blocked(503, self.send)
        self.assertEqual(self.send(), {"status": "sent"})
        self.checkout.assert_called_once()
        self.assertEqual(self.mail.call_args_list[0].kwargs["idempotency_key"], self.mail.call_args_list[1].kwargs["idempotency_key"])

    def test_missing_email_receipt_is_unknown(self):
        self.mail.return_value = {}
        self.assert_blocked(503, self.send)
        self.assertFalse(self.db.data["payments"][0]["metadata"].get("email_sent"))

    def test_lost_checkout_response_uses_same_stripe_key(self):
        self.checkout.side_effect = [TimeoutError("temporary"), self.session]
        with self.assertRaises(TimeoutError):
            self.send()
        self.assertEqual(self.send(), {"status": "sent"})
        self.assertEqual(self.checkout.call_args_list[0].kwargs, self.checkout.call_args_list[1].kwargs)

    def test_stale_reservation_after_lost_checkout_fails_closed(self):
        self.checkout.side_effect = TimeoutError()
        with self.assertRaises(TimeoutError):
            self.send()
        self.db.data["payments"][0]["created_at"] = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        self.assert_blocked(409, self.send)
        self.checkout.assert_called_once()

    def test_paid_pending_refunded_failed_and_expired(self):
        self.send()
        self.assertEqual(self.lookup()["payments"][0]["status"], "pending")
        self.session["payment_intent"] = {"status": "succeeded", "latest_charge": {}}
        self.assertEqual(self.send(), {"status": "paid"})
        for refunded, expected in ((0, "paid"), (1, "partial_refund"), (4500, "refunded")):
            self.session["payment_intent"]["latest_charge"]["amount_refunded"] = refunded
            self.assertEqual(self.lookup()["payments"][0]["status"], expected)
        self.session["payment_intent"] = {"status": "canceled"}
        self.assertEqual(self.lookup()["payments"][0]["status"], "failed")
        self.session["status"] = "expired"
        self.assertEqual(self.lookup()["payments"][0]["status"], "expired")
        self.checkout.assert_called_once()

    def test_existing_paid_checkout_cannot_be_sent_again(self):
        self.send()
        self.session["payment_intent"] = {"status": "succeeded"}
        self.assertEqual(self.send(), {"status": "paid"})
        self.mail.assert_called_once()

    def test_history_filters_person_owner_business_connect_account_and_mode(self):
        self.send()
        row = self.db.data["payments"][0]
        for key, value in (("business_id", "22"), ("user_id", "other"), ("person_id", "13")):
            self.db.data["payments"].append({**row, key: value})
        for key, value in (("voice_mode", "live"), ("account", "acct_other")):
            self.db.data["payments"].append({**row, "metadata": {**row["metadata"], key: value}})
        self.assertEqual(len(self.lookup()["payments"]), 1)
        self.assertEqual(self.api.stripe.checkout.Session.retrieve.call_count, 1)

    def test_legacy_intents_require_owner_person_and_customer(self):
        self.person["stripe_customer_id"] = "cus_A"
        intent = {"id": "pi_A", "metadata": {"user_id": "owner", "person_id": "12"}, "customer": "cus_A",
                  "amount": 1200, "currency": "usd", "created": 1000, "status": "succeeded"}
        self.api.stripe.PaymentIntent.list.return_value = {"data": [
            intent, {**intent, "customer": "cus_other"}, {**intent, "metadata": {"user_id": "owner", "person_id": "13"}},
            {**intent, "metadata": {"user_id": "other", "person_id": "12"}}]}
        self.assertEqual([r["amount_cents"] for r in self.lookup()["payments"]], [1200])

    def test_provider_outage_cannot_be_reported_as_paid(self):
        self.send()
        self.api.stripe.checkout.Session.retrieve.side_effect = TimeoutError()
        with self.assertRaises(TimeoutError):
            self.lookup()



    def test_signed_quote_cannot_be_replayed_on_another_call_or_after_price_change(self):
        quote = self.lookup()["quote"]["quote_id"]
        self.assert_blocked(409, self.send, quote_id="invented")
        with patch.dict(self.claims, payment_call="another-call"):
            self.assert_blocked(409, self.send, quote_id=quote)
        with patch.dict(self.person, balance_due="48.00"):
            self.assert_blocked(409, self.send, quote_id=quote, confirmed_amount_cents=4800)
        self.checkout.assert_not_called()

    def test_expired_link_replaced_once(self):
        self.send()
        old = self.session
        old["status"] = "expired"
        new = stripe.checkout.Session.construct_from({"id": "cs_new", "url": "https://checkout.stripe.com/new",
                                                     "status": "open", "payment_intent": None}, None)
        self.checkout.return_value = new
        self.api.stripe.checkout.Session.retrieve.side_effect = lambda key, **kw: old if key == old.id else new
        self.assertEqual(self.send(), {"status": "sent"})
        self.assertEqual(self.send(), {"status": "sent"})
        self.assertEqual(len(self.db.data["payments"]), 2)
        self.assertEqual(self.checkout.call_count, 2)
        self.assertEqual(self.mail.call_count, 2)

    def test_missing_customer_return_url_prevents_checkout(self):
        self.api.get_public_backend_base_url.return_value = None
        self.assert_blocked(503, self.send)
        self.checkout.assert_not_called()

    def test_http_flow_binds_signed_caller_and_only_accepts_returned_quote(self):
        from fastapi.testclient import TestClient
        from backend import authorization
        self.enter_patch(main, "internal_tool_secret", self.api.internal_tool_secret)
        self.enter_patch(main, "supabase", self.db)
        self.enter_patch(main, "load_business_by_id", return_value={"id": 21, "user_id": "owner", "name": "Test"})
        self.enter_patch(authorization, "account_active", return_value=True)
        for name in ("require_payment_access", "load_person_by_id_for_user", "is_payment_test_mode",
                     "_get_connected_stripe_request_options", "get_public_backend_base_url", "_system_resend_configuration"):
            self.enter_patch(main, name, getattr(self.api, name))
        client = TestClient(main.app)
        url = "/api/tools/get-payments"
        send_url = "/api/tools/send-payment-link"
        token = issue_internal_context(self.api.internal_tool_secret, {"id": 21, "user_id": "owner"}, claims=self.claims)
        headers = {"x-nodemere-internal-secret": self.api.internal_tool_secret, "x-nodemere-context": token}
        address = {"customer_email": self.person["email"], "conversation_history": self.history()}
        self.assertEqual(client.post(url, json=address).status_code, 401)
        self.assertEqual(client.post(url, json=address, headers={**headers, "x-nodemere-context": "invalid"}).status_code, 403)
        lookup = client.post(url, json=address, headers=headers)
        self.assertEqual(lookup.status_code, 200, lookup.text)
        body = {**address, "conversation_history": self.agreed_history(), "confirmed": True, "quote_id": lookup.json()["quote"]["quote_id"], "confirmed_amount_cents": 4500}
        self.assertEqual(client.post(send_url, json={**body, "quote_id": "stale"}, headers=headers).status_code, 409)
        response = client.post(send_url, json=body, headers=headers)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"status": "sent"})
        self.checkout.assert_called_once()
        self.assertEqual(client.get("/payments/checkout-return").status_code, 200)

    def test_generated_checkout_webhook_updates_the_reserved_payment(self):
        from backend.test_prelaunch_fixes import handlers
        self.send()
        row = self.db.data["payments"][0]
        self.assertEqual(row["status"], "pending")
        result = handlers(self.db)["upsert_payment_from_stripe"](
            session_id=self.session.id, payment_intent_id="pi_fixture", status="succeeded")
        self.assertEqual(result["id"], row["id"])
        self.assertEqual(row["stripe_payment_intent_id"], "pi_fixture")
        self.assertEqual(row["status"], "succeeded")
        self.assertEqual(len(self.db.data["payments"]), 1)


    def test_provider_amount_mismatch_blocks_paid_status(self):
        self.send()
        self.session["payment_intent"] = {"status": "succeeded", "currency": "usd", "amount_received": 100}
        self.assert_blocked(409, self.lookup)

    def test_normal_outbound_dispatch_binds_the_dialed_customer(self):
        from types import SimpleNamespace
        from backend import config
        from backend.test_drop_ins import ProviderDispatchTests
        fixture = ProviderDispatchTests()
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        address = "outbound@example.com"
        fixture.context["person"].update(email=address, phone="+12025550100")
        fixture.context["customer"] = fixture.context["person"].copy()
        self.enter_patch(config, "internal_tool_secret", "fixture")
        response = SimpleNamespace(ok=True, json=lambda: {"conversation_id": "fixture-call", "callSid": "fixture-sid"})
        with patch("backend.scenario_engine.requests.post", return_value=response) as provider:
            result = fixture.execute()
            self.assertTrue(result["success"], result)
            variables = provider.call_args.kwargs["json"]["conversation_initiation_client_data"]["dynamic_variables"]
        decoded = verify_internal_context("fixture", variables["secret__nodemere_context"])
        self.assertEqual(decoded["payment_person"], str(fixture.context["person"]["id"]))
        self.assertEqual(decoded["payment_contact"], payments.digest("12025550100|" + address))

    def test_service_payment_reuses_open_link_across_calls_and_paid_appointment(self):
        self.db.data["services"] = [dict(id="svc", business_id="21", name="Cut", is_active=True,
                                          price_type="fixed", price_min=45)]
        appointment = {"id": "appt", "service_id": "svc", "person_id": 12}
        self.claims.update(payments.outbound_payment_claims(self.person, self.person["phone"], appointment))
        self.assertEqual(self.send(service_name="Cut"), {"status": "sent"})
        self.claims["payment_call"] = "second-call"
        self.assertEqual(self.send(service_name="Cut"), {"status": "sent"})
        self.session["payment_intent"] = {"status": "succeeded"}
        self.assertEqual(self.send(service_name="Cut"), {"status": "paid"})
        self.checkout.assert_called_once()
        self.mail.assert_called_once()

    def test_spoken_email_gate_ignores_agent_tool_and_partial_address(self):
        for transcript in (
            {"entries": [{"role": "agent", "message": "Is it alex@example.com?"}, {"role": "user", "message": "Yes."}]},
            {"entries": [{"role": "tool", "message": "alex@example.com"}]},
            {"entries": [{"role": "user", "message": "otheralex@example.com"}]},
            {"entries": [{"role": "user", "message": "alex@example.com.fake"}]},
            {"entries": [{"role": "user", "message": "alex@example.com. Actually use other@example.com."}]},
            {}, []):
            self.assert_blocked(409, self.lookup, conversation_history=json.dumps(transcript))
        self.assert_blocked(409, self.lookup, conversation_history="invalid")
        self.api.load_person_by_id_for_user.assert_not_called()

    def test_spoken_address_and_repeat_send_from_provider_transcript(self):
        entries = [{"role": "user", "message": "It is Alex at example dot com."}]
        history = json.dumps({"entries": entries})
        self.assertEqual(self.lookup(conversation_history=history)["quote"]["amount_cents"], 4500)
        entries.append({"role": "tool", "tool_results": [{"tool_name": "send_payment_link", "result_value": "timeout"}]})
        self.assert_blocked(409, self.send, conversation_history=json.dumps({"entries": entries}))
        self.checkout.assert_not_called()

    def test_a_customer_reply_must_follow_the_quote_before_sending(self):
        entries = json.loads(self.agreed_history())["entries"]
        for incomplete in (entries[:1], entries[:2], entries[:3]):
            self.assert_blocked(409, self.send, conversation_history=json.dumps({"entries": incomplete}))
        self.checkout.assert_not_called()

    def test_resolved_elevenlabs_webhook_uses_agent_role_for_tool_results(self):
        entries = json.loads(self.agreed_history())["entries"]
        entries[1]["role"] = "agent"
        def as_wire_body():
            return json.dumps({"x-elevenlabs-history": True, "entries": entries})
        self.assertEqual(self.send(conversation_history=as_wire_body()), {"status": "sent"})
        entries.append({"role": "agent", "tool_results": [{"tool_name": "send_payment_link", "result_value": "timeout"}]})
        self.assert_blocked(409, self.send, conversation_history=as_wire_body())
        self.mail.assert_called_once()
