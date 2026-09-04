"""Offline Phase 1 regression suite. Never contacts Supabase or any provider.

Run explicitly: python -m unittest backend.test_phase1_security
Do not discover all backend/test*.py: some older files are live integration scripts.
"""

import asyncio
import copy
import hashlib
import hmac
import json
import logging
import os
import socket
import time
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient
from jose import jwt
from starlette.requests import Request

# Windows asyncio uses a loopback socket pair internally. Permit that, but no
# external network, and replace all application database clients below.
_original_connect = socket.socket.connect


def _offline_connect(sock, address):
    if isinstance(address, tuple) and address[0] in {"127.0.0.1", "::1"}:
        return _original_connect(sock, address)
    raise AssertionError("External network forbidden in offline security tests")


_network_guard = patch("socket.socket.connect", _offline_connect)
_network_guard.start()
with patch("backend.env_loader.load_project_env"), patch.dict(os.environ, {
    "SUPABASE_URL": "https://offline.example.test",
    "SUPABASE_SERVICE_ROLE_KEY": "offline-only",
    "SUPABASE_JWT_SECRET": "offline-oauth-signing-secret-not-for-deployment",
    "NODEMERE_INTERNAL_TOOL_SECRET": "offline-internal-secret",
    "FRONTEND_BASE_URL": "http://localhost:5173",
}, clear=True), patch("supabase.create_client", return_value=MagicMock()):
    from backend import main, dependencies
    from backend.scenario_engine import ScenarioEngine, ScenarioActionExecutor

from backend.security import safe_oauth_return_to, script_safe_json, issue_internal_context
from backend.authorization import Tenant, tenant_scope

logging.getLogger("asyncio").setLevel(logging.WARNING)

OWNER = "11111111-1111-4111-8111-111111111111"
OTHER = "22222222-2222-4222-8222-222222222222"
APPT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OTHER_APPT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
STAFF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
OTHER_STAFF = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
BUSINESS = {"id": 1, "user_id": OWNER, "name": "Synthetic business"}
USER = SimpleNamespace(id=OWNER)


class FakeDatabase:
    def __init__(self):
        self.rows = {
            "businesses": [BUSINESS.copy(), {"id": 2, "user_id": OTHER}],
            "people": [{"id": 1, "business_id": 1, "user_id": OWNER, "first_name": "Own"},
                       {"id": 2, "business_id": 2, "user_id": OTHER, "first_name": "Foreign"}],
            "appointments": [{"id": APPT, "business_id": 1, "person_id": 1, "staff_id": STAFF},
                             {"id": OTHER_APPT, "business_id": 2}],
            "staff": [{"id": STAFF, "business_id": 1, "is_active": True},
                      {"id": OTHER_STAFF, "business_id": 2, "is_active": True}],
            "services": [{"id": STAFF, "business_id": 1}, {"id": OTHER_STAFF, "business_id": 2}],
            "payments": [{"id": APPT, "user_id": OWNER}, {"id": OTHER_APPT, "user_id": OTHER}],
            "invoices": [{"id": APPT, "user_id": OWNER}, {"id": OTHER_APPT, "user_id": OTHER}],
            "hired_receptionists": [],
            "users": [{"id": OWNER, "account_status": "active"}],
            "business_memberships": [{"user_id": OWNER, "business_id": 1, "role": "OWNER", "status": "active"},
                                     {"user_id": OTHER, "business_id": 2, "role": "OWNER", "status": "active"}],
            "integrations": [], "people_schema": [],
        }
        self.calls = []

    def table(self, name):
        if name not in self.rows:
            raise AssertionError("Unexpected table: " + name)
        return FakeQuery(self, name)


class FakeQuery:
    def __init__(self, db, name):
        self.db, self.name = db, name
        self.filters, self.operation, self.values = [], "select", None
        self.maximum = None

    def select(self, *args, **kwargs):
        return self

    def eq(self, field, value):
        self.filters.append((field, value))
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, value):
        self.maximum = value
        return self

    def insert(self, values):
        self.operation, self.values = "insert", values
        return self

    def update(self, values):
        self.operation, self.values = "update", values
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def execute(self):
        self.db.calls.append((self.name, self.operation, self.filters.copy(), copy.deepcopy(self.values)))
        rows = [row for row in self.db.rows[self.name]
                if all(str(row.get(key)) == str(value) for key, value in self.filters)]
        if self.maximum is not None:
            rows = rows[:self.maximum]
        if self.operation == "insert":
            rows = [copy.deepcopy(self.values)]
            self.db.rows[self.name].extend(rows)
        elif self.operation == "update":
            for row in rows:
                row.update(self.values)
        elif self.operation == "delete":
            for row in rows:
                self.db.rows[self.name].remove(row)
        return SimpleNamespace(data=copy.deepcopy(rows))


def tool_request(secret=None):
    headers = [(b"x-nodemere-internal-secret", secret.encode("utf-8"))] if secret is not None else []
    return Request({"type": "http", "headers": headers})


class InternalToolSecurityTests(unittest.IsolatedAsyncioTestCase):
    async def test_auth_does_not_consult_any_billing_configuration(self):
        for secret in (None, "", "wrong", "non-ascii-\u00e9"):
            with self.subTest(secret=secret), patch.object(main, "internal_tool_secret", "correct"), patch.object(
                main, "is_payment_test_mode", side_effect=AssertionError("Auth must not read billing mode")
            ):
                with self.assertRaises(HTTPException) as error:
                    await main.require_internal_tool_authorization(tool_request(secret))
                self.assertEqual(error.exception.status_code, 401)
        with patch.object(main, "internal_tool_secret", "correct"), patch.object(
            main, "is_payment_test_mode", side_effect=AssertionError("Auth must not read billing mode")
        ):
            await main.require_internal_tool_authorization(tool_request("correct"))

    async def test_missing_configuration_fails_closed_even_in_test_mode(self):
        for mode in (False, True):
            with self.subTest(mode=mode), patch.object(main, "internal_tool_secret", None), patch.object(main, "is_payment_test_mode", return_value=mode):
                with self.assertRaises(HTTPException) as error:
                    await main.require_internal_tool_authorization(tool_request("anything"))
                self.assertEqual(error.exception.status_code, 503)

    def test_billing_safety_behavior_is_preserved(self):
        for env_test, real_test, row, expected in [
            (True, False, {"test_mode": False}, True),
            (False, True, {"test_mode": False}, True),
            (False, False, {"test_mode": True}, True),
            (False, False, {"test_mode": False}, False),
            (False, False, {"_system_config_read_error": True}, True),
            (False, False, {}, True),
        ]:
            with self.subTest(row=row, env_test=env_test, real_test=real_test), patch.multiple(
                main, TEST_MODE=env_test, STRIPE_REAL_TEST_MODE=real_test,
                STRIPE_TEST_SECRET_KEY="test-key", STRIPE_LIVE_SECRET_KEY="live-key",
            ), patch.object(main, "get_system_config_row", return_value=row):
                self.assertEqual(main.is_payment_test_mode(), expected)
                self.assertEqual(main.stripe.api_key, "test-key" if expected else "live-key")

    def test_all_internal_routes_reject_unsigned_requests(self):
        client = TestClient(main.app)  # no lifespan: no background schedulers
        paths = ["/api/tools/get-services", "/api/tools/set-agent-data", "/api/tools/request-docs",
                 "/api/tools/get-docs", "/api/tools/create-contract-link",
                 "/api/tools/report-intent-checkpoint", "/api/call/route", "/api/scenarios/resume"]
        with patch.object(main, "internal_tool_secret", "correct"), patch.object(main, "is_payment_test_mode", return_value=True):
            for path in paths:
                for headers in ({}, {"x-nodemere-internal-secret": "wrong"}, {"Authorization": "Bearer browser-token"}):
                    with self.subTest(path=path, headers=headers):
                        self.assertEqual(client.post(path, json={}, headers=headers).status_code, 401)

    def test_authorized_local_tool_works_in_billing_test_mode(self):
        db = FakeDatabase()
        with patch.object(main, "internal_tool_secret", "correct"), patch.object(main, "supabase", db), patch.object(
            main, "resolve_business_context", return_value={"business": BUSINESS, "user_id": OWNER}
        ), patch.object(main, "supabase_admin", db), patch.object(main, "is_payment_test_mode", return_value=True), patch.object(main, "load_business_by_id", return_value=BUSINESS):
            response = TestClient(main.app).post("/api/tools/get-services", json={"business_id": 1},
                                               headers={"x-nodemere-internal-secret": "correct",
                                                        "x-nodemere-context": issue_internal_context("correct", BUSINESS)})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertNotIn(OTHER_STAFF, response.text)
        self.assertIn(STAFF, response.text)


class UserAuthTests(unittest.IsolatedAsyncioTestCase):
    async def test_oauth_state_cannot_authenticate_any_user_route(self):
        with tenant_scope(Tenant(OWNER,1,OWNER,aal='aal2')):
            state = main._build_integration_state(OWNER, "gmail", "/dashboard")
        with patch.object(dependencies.supabase_auth.auth, "get_user", side_effect=dependencies.AuthApiError("Rejected by Supabase", 401, "bad_jwt")):
            with self.assertRaises(HTTPException) as error:
                await dependencies.get_current_user(SimpleNamespace(credentials=state))
            self.assertEqual(error.exception.status_code, 401)
            response = TestClient(main.app).get("/users/me", headers={"Authorization": "Bearer " + state})
            self.assertEqual(response.status_code, 401)
            self.assertNotIn("Rejected by Supabase", response.text)

    async def test_verified_supabase_session_is_accepted_and_closed_account_denied(self):
        db = FakeDatabase()
        with patch.object(dependencies, "supabase_admin", db), patch.object(
            dependencies.supabase_auth.auth, "get_user", return_value=SimpleNamespace(user=USER)
        ):
            self.assertEqual((await dependencies.get_current_user(SimpleNamespace(credentials="valid"))).id, OWNER)
            for state in ("closed", "pending_deletion"):
                db.rows["users"][0]["account_status"] = state
                with self.assertRaises(HTTPException) as error:
                    await dependencies.get_current_user(SimpleNamespace(credentials="valid"))
                self.assertEqual(error.exception.status_code, 403)


class ProviderSignatureTests(unittest.IsolatedAsyncioTestCase):
    async def test_twilio_signature_still_required_in_billing_test_mode(self):
        url = "https://backend.example.com/twilio/inbound"
        params = {"CallSid": "synthetic-call", "From": "+15555550100"}
        signature = main.RequestValidator("synthetic-twilio-secret").compute_signature(url, params)
        for supplied, accepted in ((None, False), ("wrong", False), (signature, True)):
            request = MagicMock()
            request.headers = {"x-twilio-signature": supplied} if supplied else {}
            request.form = AsyncMock(return_value=SimpleNamespace(multi_items=lambda: params.items()))
            with self.subTest(accepted=accepted, supplied=bool(supplied)), patch.object(main, "twilio_auth_token", "synthetic-twilio-secret"), patch.object(main, "is_payment_test_mode", return_value=True):
                if accepted:
                    await main.verify_twilio_webhook_request(request, url)
                else:
                    with self.assertRaises(HTTPException) as error:
                        await main.verify_twilio_webhook_request(request, url)
                    self.assertEqual(error.exception.status_code, 401)

    def test_stripe_signature_rejection_and_valid_event(self):
        body = json.dumps({"id": "evt_synthetic", "object": "event", "type": "synthetic.noop", "data": {"object": {}}})
        stamp = str(int(time.time()))
        signature = hmac.new(b"synthetic-stripe-secret", (stamp + "." + body).encode(), hashlib.sha256).hexdigest()
        client = TestClient(main.app)
        with patch.object(main, "stripe_webhook_secret", "synthetic-stripe-secret"), patch.object(main, "is_payment_test_mode", return_value=True):
            for header in ("", "t=" + stamp + ",v1=wrong"):
                self.assertEqual(client.post("/stripe-webhook", content=body, headers={"stripe-signature": header}).status_code, 400)
            response = client.post("/stripe-webhook", content=body, headers={"stripe-signature": f"t={stamp},v1={signature}"})
            self.assertEqual(response.status_code, 200, response.text)

    def test_elevenlabs_missing_and_invalid_auth_fail_before_processing(self):
        client = TestClient(main.app)
        with patch.object(main, "elevenlabs_webhook_secret", "synthetic-eleven-secret"), patch.object(main, "is_payment_test_mode", return_value=True):
            for headers in ({}, {"x-webhook-secret": "wrong"}, {"elevenlabs-signature": "invalid"}):
                self.assertEqual(client.post("/api/webhooks/elevenlabs/post-call", json={}, headers=headers).status_code, 401)
            # Valid authentication reaches payload validation (not any DB write).
            response = client.post("/api/webhooks/elevenlabs/post-call", json=[], headers={"x-webhook-secret": "synthetic-eleven-secret"})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()["detail"], "Webhook payload must be a JSON object")
        with patch.object(main, "elevenlabs_webhook_secret", None):
            self.assertEqual(client.post("/api/webhooks/elevenlabs/post-call", json={}).status_code, 503)


class TenantSecurityTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = FakeDatabase()
        self.patches = [
            patch.object(main, "supabase", self.db),
            patch.object(main, "load_business_by_user_id", return_value=BUSINESS),
            patch.object(main, "emit_appointment_change_triggers"),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)

    async def test_missing_business_returns_no_tenant_data(self):
        with patch.object(main, "load_business_by_user_id", return_value=None):
            self.assertEqual(await main.list_sonar_services(USER), [])
            self.assertEqual(await main.list_sonar_staff(current_user=USER), [])
            self.assertEqual(await main.list_sonar_appointments(current_user=USER), [])
        self.assertEqual(self.db.calls, [])

    async def test_missing_business_cannot_write_or_trigger(self):
        with patch.object(main, "load_business_by_user_id", return_value=None):
            for call in (
                lambda: main.create_sonar_service({"business_id": 2}, USER),
                lambda: main.create_sonar_person({"business_id": 2}, USER),
                lambda: main.create_sonar_appointment({"business_id": 2}, USER),
                lambda: main.update_sonar_appointment(OTHER_APPT, {"notes": "attack"}, USER),
                lambda: main.delete_sonar_appointment(OTHER_APPT, USER),
            ):
                with self.assertRaises(HTTPException) as error:
                    await call()
                self.assertEqual(error.exception.status_code, 404)
            with self.assertRaises(HTTPException):
                main.build_authenticated_scenario_event_payload({"business_id": 2}, OWNER)
        self.assertEqual(self.db.calls, [])

    async def test_normal_lists_are_tenant_scoped(self):
        self.assertEqual([r["business_id"] for r in await main.list_sonar_services(USER)], [1])
        self.assertEqual([r["business_id"] for r in await main.list_sonar_staff(current_user=USER)], [1])
        self.assertEqual([r["business_id"] for r in await main.list_sonar_appointments(current_user=USER)], [1])

    async def test_service_creation_cannot_assign_another_business(self):
        created = await main.create_sonar_service({"name": "Synthetic", "business_id": 2, "user_id": OTHER}, USER)
        self.assertEqual(created["business_id"], 1)
        self.assertNotIn("user_id", created)

    async def test_appointment_update_and_delete_reject_foreign_id(self):
        with self.assertRaises(HTTPException) as error:
            await main.update_sonar_appointment(OTHER_APPT, {"notes": "attack"}, USER)
        self.assertEqual(error.exception.status_code, 404)
        with self.assertRaises(HTTPException) as error:
            await main.delete_sonar_appointment(OTHER_APPT, USER)
        self.assertEqual(error.exception.status_code, 404)
        self.assertFalse(any(call[1] in {"update", "delete"} for call in self.db.calls))

    async def test_own_appointment_update_and_delete_preserve_scope(self):
        updated = await main.update_sonar_appointment(APPT, {"notes": "Synthetic update", "business_id": 2}, USER)
        self.assertEqual(updated["business_id"], 1)
        self.assertEqual(updated["notes"], "Synthetic update")
        await main.delete_sonar_appointment(APPT, USER)
        for _, operation, filters, _ in self.db.calls:
            if operation in {"update", "delete"}:
                self.assertIn(("business_id", 1), filters)

    def test_appointment_relations_are_tenant_scoped(self):
        self.assertEqual(main.safe_appointment_person_id(1, business_id=1), 1)
        self.assertIsNone(main.safe_appointment_person_id(2, business_id=1))
        self.assertEqual(main.safe_appointment_service_id(STAFF, business_id=1), STAFF)
        self.assertIsNone(main.safe_appointment_service_id(OTHER_STAFF, business_id=1))
        self.assertIsNone(main.safe_appointment_person_id(1, business_id=None))

    def test_browser_scenario_payload_cannot_override_authority(self):
        payload = main.build_authenticated_scenario_event_payload({
            "user_id": OTHER, "business_id": 2, "business": {"id": 2, "user_id": OTHER},
            "person": {"id": 2}, "receptionist": {"user_id": OTHER}, "_executionId": "spoof",
            "person_id": 2, "notes": "Synthetic trigger",
        }, OWNER)
        self.assertEqual(payload["user_id"], OWNER)
        self.assertEqual(payload["business_id"], 1)
        self.assertEqual(payload["business"]["id"], 1)
        for key in ("person", "receptionist", "_executionId"):
            self.assertNotIn(key, payload)
        self.assertEqual(payload["notes"], "Synthetic trigger")

    async def test_builder_binds_nested_payload_before_execution(self):
        engine = SimpleNamespace(_build_flow_context=AsyncMock(return_value={}),
                                 flow_executor=SimpleNamespace(start=AsyncMock(return_value={})))
        scenario = {"nodes_data": [{"id": "trigger", "categoryType": "TRIGGERS", "configured": True}]}
        with patch.object(main, "scenario_engine", engine), patch.object(main, "require_plan_access"), patch.object(
            main, "validate_scenario_definition", return_value=[]
        ):
            await main.run_builder_scenario({"scenario": scenario, "payload": {"user_id": OTHER, "business_id": 2}}, USER)
        event = engine._build_flow_context.call_args.args[2]
        self.assertEqual(event["user_id"], OWNER)
        self.assertEqual(event["business_id"], 1)
        self.assertFalse(engine.flow_executor.start.call_args.kwargs["persist_execution"])


class ScenarioIsolationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.db = FakeDatabase()
        self.engine = ScenarioEngine(self.db, {}, "http://offline.example.test")
        self.engine._hydrate_business_with_assigned_line = lambda row: row
        self.scenario = {"id": "test-scenario", "user_id": OWNER, "business_id": 1}

    async def test_all_hydrated_records_reject_cross_tenant_ids(self):
        # Phase 2 strengthens the Phase 1 behavior: reject the operation entirely
        # instead of continuing with absent foreign snapshots and foreign IDs.
        with self.assertRaises(HTTPException) as error:
            await self.engine._build_flow_context(self.scenario, "manual_trigger", {
                "business_id": 2, "user_id": OTHER, "business": {"id": 2, "user_id": OTHER},
                "appointment_id": OTHER_APPT, "person_id": 2, "staff_id": OTHER_STAFF,
                "payment_id": OTHER_APPT, "invoice_id": OTHER_APPT,
            })
        self.assertEqual(error.exception.status_code, 404)
        for table, _, filters, _ in self.db.calls:
            if table in {"people", "appointments", "staff"}:
                self.assertIn(("business_id", 1), filters)
            if table in {"payments", "invoices"}:
                self.assertIn(("user_id", OWNER), filters)

    async def test_own_hydration_preserves_appointment_person_staff_and_payments(self):
        context = await self.engine._build_flow_context(self.scenario, "manual_trigger", {
            "appointment_id": APPT, "payment_id": APPT, "invoice_id": APPT,
        })
        self.assertEqual(context["appointment"]["id"], APPT)
        self.assertEqual(context["person"]["id"], 1)
        self.assertEqual(context["staff"]["id"], STAFF)
        self.assertEqual(context["payment"]["id"], APPT)
        self.assertEqual(context["invoice"]["id"], APPT)

    async def test_missing_owner_or_business_stops_before_record_queries(self):
        for scenario in ({}, {"user_id": "unknown"}, {"user_id": OWNER, "business_id": 2}):
            with self.subTest(scenario=scenario), self.assertRaises(ValueError):
                await self.engine._build_flow_context(scenario, "manual_trigger", {"person_id": 2})
        self.assertTrue(all(call[0] == "businesses" for call in self.db.calls))

    def test_tenant_match_fails_closed_and_rejects_conflicting_ids(self):
        match = self.engine._event_matches_scenario_tenant
        self.assertFalse(match(self.scenario, {}))
        self.assertFalse(match(self.scenario, {"business_id": 1, "user_id": OTHER}))
        self.assertFalse(match(self.scenario, {"business_id": 2, "user_id": OWNER}))
        self.assertTrue(match(self.scenario, {"business_id": 1, "user_id": OWNER}))
        self.assertTrue(match(self.scenario, {"user_id": OWNER}))
        self.assertTrue(match(self.scenario, {"business_id": 1}))

    async def test_record_actions_cannot_write_owner_columns(self):
        action = self.engine.action_executor
        action._get_people_custom_field_types = lambda context: {}
        context = {"business": BUSINESS, "user_id": OWNER, "business_id": 1}
        for field in ("business_id", "user_id", "id", "created_at", "field_business_id", "field_user_id"):
            with self.subTest(field=field):
                config = {"record_id": "1", field: OTHER}
                self.assertFalse((await action._update_record({"actionConfig": config}, context))["success"])
                self.assertFalse((await action._create_record({"actionConfig": config}, context))["success"])
        self.assertFalse(any(call[1] in {"insert", "update"} for call in self.db.calls))

    async def test_record_actions_keep_normal_functionality(self):
        action = self.engine.action_executor
        action._get_people_custom_field_types = lambda context: {}
        action._emit_scenario_trigger = lambda *args, **kwargs: None
        context = {"business": BUSINESS, "user_id": OWNER, "business_id": 1}
        result = await action._update_record({"actionConfig": {"record_id": "1", "first_name": "Updated"}}, context)
        self.assertTrue(result["success"], result)
        result = await action._create_record({"actionConfig": {"first_name": "Created"}}, context)
        self.assertTrue(result["success"], result)
        self.assertEqual(result["data"]["business_id"], 1)
        self.assertEqual(result["data"]["user_id"], OWNER)


class OAuthAndIntegrationTests(unittest.IsolatedAsyncioTestCase):
    def test_state_has_dedicated_audience_and_provider(self):
        with tenant_scope(Tenant(OWNER,1,OWNER,aal='aal2')),patch.object(main,'supabase_admin',FakeDatabase()):
            state = main._build_integration_state(OWNER, "gmail", "/dashboard")
            self.assertEqual(main._decode_integration_state(state, "gmail")["sub"], OWNER)
        with self.assertRaises(HTTPException):
            main._decode_integration_state(state, "stripe")
        for payload in (
            {"sub": OWNER, "provider": "gmail"},
            {"sub": OWNER, "provider": "gmail", "aud": "nodemere-integration-state"},
            {"sub": OWNER, "provider": "gmail", "aud": "nodemere-integration-state",
             "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        ):
            with self.subTest(payload=payload), self.assertRaises(HTTPException):
                main._decode_integration_state(jwt.encode(payload, main.SECRET_KEY, algorithm=main.ALGORITHM), "gmail")

    def test_return_url_rejects_external_and_script_targets(self):
        for target in ("https://evil.test", "//evil.test", "javascript:alert(1)", "/\\evil.test",
                       "https://localhost:5173.evil.test", "http://user@localhost:5173", "/\nevil"):
            with self.subTest(target=target), self.assertRaises(HTTPException):
                safe_oauth_return_to(target, "http://localhost:5173")
        for target in ("/dashboard", "http://localhost:5173/dashboard?integration=gmail"):
            self.assertEqual(safe_oauth_return_to(target, "http://localhost:5173"), target)

    def test_json_cannot_close_script(self):
        value = {"message": "</script><img src=x onerror=alert(1)>&\u2028\u2029"}
        encoded = script_safe_json(value)
        self.assertNotIn("<", encoded)
        self.assertEqual(json.loads(encoded), value)

    def test_each_callback_renders_attacker_error_as_text(self):
        attack = '</script><img src=x onerror="alert(1)">'
        client = TestClient(main.app)
        for provider in ("gmail", "outlook", "stripe"):
            with self.subTest(provider=provider):
                response = client.get(f"/users/me/integrations/{provider}/callback", params={"error": attack})
                self.assertEqual(response.status_code, 200)
                self.assertNotIn("<img", response.text)
                self.assertEqual(response.text.count("</script>"), 1)
                # Phase 4 no longer reflects provider error text at all. Keep
                # the XSS regression, and assert the stronger generic response.
                self.assertIn("The request could not be completed", response.text)
                self.assertIn("sonar.integration.oauth_complete", response.text)

    async def test_provider_connection_fields_are_server_owned(self):
        payload = main.UserIntegrationUpdate(selected=True, status="connected",
            provider_metadata={"account_id": "acct_other"}, scopes=["everything"],
            connected_email="attacker@example.com")
        saved = {"provider": "stripe", "status": "not_connected", "selected": True,
                 "user_id": OWNER, "credentials": {}, "provider_metadata": {}, "scopes": []}
        with patch.object(main, "require_payment_access"), patch.object(main, "_upsert_integration_row", return_value=saved) as upsert:
            await main.upsert_user_integration("stripe", payload, USER)
        self.assertEqual(upsert.call_args.args, (OWNER, "stripe", {"selected": True}))

    def test_metadata_cannot_choose_stripe_account_or_live_mode(self):
        for credentials in ({}, {"stripe_user_id": "acct_own"}, {"stripe_user_id": "acct_own", "livemode": "false"}):
            row = {"status": "connected", "credentials": credentials,
                   "provider_metadata": {"account_id": "acct_other", "livemode": True}}
            with self.subTest(credentials=credentials), patch.object(main, "_fetch_integration_row", return_value=row):
                with self.assertRaises(HTTPException):
                    main._get_connected_stripe_request_options(OWNER)
        row["credentials"] = {"stripe_user_id": "acct_own", "livemode": False}
        with patch.object(main, "_fetch_integration_row", return_value=row), patch.object(main, "_stripe_platform_api_key", return_value="test-key") as key:
            self.assertEqual(main._get_connected_stripe_request_options(OWNER)["stripe_account"], "acct_own")
            key.assert_called_once_with(False)

    def test_stripe_event_metadata_cannot_select_another_tenant(self):
        with patch.object(main, "resolve_connected_account_user_id", return_value=OWNER):
            self.assertEqual(main.resolve_scenario_user_id_from_stripe_event(
                {"account": "acct_own"}, {"user_id": OTHER}), OWNER)
        with patch.object(main, "resolve_connected_account_user_id", return_value=None):
            self.assertIsNone(main.resolve_scenario_user_id_from_stripe_event(
                {"account": "acct_unknown"}, {"user_id": OTHER}))

    async def test_simulated_stripe_authorization_still_works(self):
        request = Request({"type": "http", "scheme": "http", "server": ("localhost", 8000), "path": "/", "headers": []})
        with patch.object(main, "require_payment_access"), patch.object(main, "is_payment_test_mode", return_value=True), patch.object(
            main, "_upsert_integration_row", return_value={}
        ) as upsert, patch.object(main.stripe.OAuth, "token", side_effect=AssertionError("No provider call in simulation")):
            result = await main.authorize_user_integration("stripe", request, current_user=USER)
        self.assertIn("simulated=true", result["authorization_url"])
        self.assertEqual(upsert.call_args.args[2]["credentials"], {})
        self.assertTrue(upsert.call_args.args[2]["provider_metadata"]["test_mode"])


if __name__ == "__main__":
    unittest.main()
