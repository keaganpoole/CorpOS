"""Offline security/contract checks. Never import main or contact Supabase/Stripe."""
import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette.requests import Request

from . import visitor_intelligence as vi

NOW = datetime.now(timezone.utc).isoformat()
USER = str(uuid4())
OTHER = str(uuid4())
NODE_PATH = shutil.which("node")
NODE_ENVIRONMENT = {key: value for key, value in os.environ.items() if key.upper() in {"SYSTEMROOT", "WINDIR", "PATH", "TEMP", "TMP"}}


class DatabaseError(Exception):
    def __init__(self, message):
        self.message = message


class FakeDatabase:
    """Minimal RPC contract double. Atomic DB semantics are tested in SQL tests."""
    def __init__(self):
        self.calls, self.visitors, self.events, self.converted = [], {}, set(), set()
        self.failure = None
        self.users = [{"id": USER, "created_at": NOW, "stripe_customer_id": "cus_example", "stripe_subscription_id": None}]

    def rpc(self, name, params):
        self.calls.append((name, deepcopy(params)))
        def execute():
            if self.failure:
                raise DatabaseError(self.failure)
            if name in {"visitor_ingest", "visitor_ingest_phase2"}:
                p = params["p_payload"]
                visitor = self.visitors.get(p["visitor_id"])
                if visitor and visitor.get("revoked"):
                    raise DatabaseError("visitor_revoked")
                if visitor and not p["has_identity_proof"]:
                    raise DatabaseError("visitor_identity_required")
                if visitor is None:
                    visitor = self.visitors[p["visitor_id"]] = {"user_id": None, "session_id": p["session_id"]}
                fresh = {e["id"] for e in p["events"]} - self.events
                self.events.update(fresh)
                data = {"visitor_id": p["visitor_id"], "session_id": visitor["session_id"], "accepted": len(fresh)}
            elif name == "visitor_link_identity":
                visitor = self.visitors.get(params["p_visitor_id"])
                if not visitor:
                    raise DatabaseError("visitor_not_found")
                if visitor.get("revoked"):
                    raise DatabaseError("visitor_revoked")
                conflict = visitor["user_id"] not in (None, params["p_user_id"])
                if not conflict:
                    visitor["user_id"] = params["p_user_id"]
                data = {"visitor_id": params["p_visitor_id"], "conflict": conflict}
            elif name == "visitor_revoke":
                self.visitors[params["p_visitor_id"]]["revoked"] = True
                data = {"visitor_id": params["p_visitor_id"], "revoked": True}
            elif name == "visitor_subscription_conversion":
                sub = params["p_subscription_id"]
                data = {"accepted": 0 if sub in self.converted else 1}
                self.converted.add(sub)
            elif name == "visitor_intelligence_command_center":
                data = {"overview": {"visitors": 0}, "homepage": {"sections": [], "clicks": [], "flow": []}}
            elif name == "visitor_intelligence_visitors":
                data = {"total": 0, "page": params["p_page"], "page_size": params["p_page_size"], "items": []}
            elif name == "visitor_intelligence_profile":
                data = {"identity": {"id": params["p_visitor_id"]}, "timeline": []}
            elif name == "visitor_intelligence_activity":
                data = []
            else:
                raise AssertionError(name)
            return SimpleNamespace(data=data)
        return SimpleNamespace(execute=execute)

    def table(self, name):
        if name != "users":
            raise AssertionError(name)
        db = self
        class Query:
            def select(self, fields):
                self.fields = fields.split(",")
                return self
            def eq(self, column, value):
                self.column, self.value = column, value
                return self
            def limit(self, count):
                self.count = count
                return self
            def execute(self):
                if db.failure:
                    raise DatabaseError(db.failure)
                return SimpleNamespace(data=[{k: r.get(k) for k in self.fields} for r in db.users if r.get(self.column) == self.value][:self.count])
        return Query()


def sample():
    return {
        "visitor_id": str(uuid4()), "visitor_token": None, "session_id": str(uuid4()),
        "consent": {"analytics": True, "version": "2026-09-05", "updated_at": NOW},
        "attribution": {"landing_page": "/", "referrer": "https://search.example/path?email=PRIVATE#PRIVATE", "utm_source": "example"},
        "device": {"browser": "chrome", "os": "windows", "device_type": "desktop", "screen_width": 1920, "screen_height": 1080, "touch_support": False},
        "events": [{"id": str(uuid4()), "name": "page_view", "occurred_at": NOW, "page": "/", "metadata": {}}],
    }


class VisitorTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {"VISITOR_TRACKING_ENABLED": "true", "VISITOR_SIGNING_SECRET": "x" * 40}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.db = FakeDatabase()
        self.auth = AsyncMock(return_value=SimpleNamespace(id=USER, created_at=NOW))
        app = FastAPI()
        app.include_router(vi.build_visitor_router(self.db, self.auth))
        self.client = TestClient(app)
        self.headers = {"Origin": "https://nodemere.ai"}

    def post(self, route, payload, headers=None):
        return self.client.post("/api/public/visitor/" + route, json=payload, headers={**self.headers, **(headers or {})})

    def bootstrap(self):
        p = sample()
        response = self.post("collect", p)
        self.assertEqual(response.status_code, 200, response.text)
        return p, response.json()

    def identity_body(self, result):
        return {"visitor_id": result["visitor_id"], "visitor_token": result["visitor_token"], "consent": sample()["consent"]}

    def test_frontend_page_and_event_contract_exact(self):
        text = (Path(__file__).parents[1] / "src/lib/visitorPolicy.js").read_text(encoding="utf-8")
        for name, expected in (("PUBLIC_PAGES", vi.PUBLIC_PATHS), ("EVENT_NAMES", vi.EVENT_NAMES)):
            match = re.search(name + r" = new Set\(\[(.*?)\]\)", text)
            self.assertIsNotNone(match)
            self.assertEqual(set(re.findall(r"'([^']+)'", match.group(1))), expected)

    def test_real_frontend_device_profiles_validate_as_collect_json(self):
        node = NODE_PATH
        if not node:
            self.skipTest("Node required to execute the real frontend device parser")
        source = r"""
            import {visitorDevice} from './src/lib/visitorDevice.js';
            const agents = [
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.7339.207 Safari/537.36',
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.7339.207 Safari/537.36 Edg/140.0.3485.81',
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_2) Version/18.2 Safari/605.1.15',
              'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) Version/18.2 Mobile Safari/604.1',
              'Mozilla/5.0 (Linux; Android 14) Chrome/140.0.7339.207 Mobile Safari/537.36',
              'Mozilla/5.0 (X11; Linux x86_64) Firefox/141.0',
              'unknown',
            ];
            console.log(JSON.stringify(agents.map(userAgent => visitorDevice({
              navigator:{userAgent, language:'en-US', maxTouchPoints:0, platform:''},
              screen:{width:1920,height:1080},innerWidth:1280,innerHeight:720,devicePixelRatio:1.25
            }))));
        """
        result = subprocess.run([node, "--input-type=module", "-e", source], cwd=Path(__file__).parents[1], env=NODE_ENVIRONMENT, capture_output=True, text=True, timeout=15, check=True)
        profiles = json.loads(result.stdout)
        self.assertEqual(len(profiles), 7)
        for profile in profiles:
            payload = sample(); payload["device"] = profile
            parsed = vi.CollectInput.model_validate_json(json.dumps(payload))
            self.assertEqual(parsed.device.browser, profile["browser"])

    def test_actual_frontend_engine_payloads_pass_collection_endpoint(self):
        if not NODE_PATH:
            self.skipTest("Node required to execute the real frontend engine")
        source = "import {collectSamples} from './src/lib/visitorTestFixtures.js'; console.log(JSON.stringify(await collectSamples()));"
        result = subprocess.run([NODE_PATH, "--input-type=module", "-e", source], cwd=Path(__file__).parents[1], env=NODE_ENVIRONMENT, capture_output=True, text=True, timeout=15, check=True)
        payloads = json.loads(result.stdout)
        self.assertEqual({p["device"]["device_type"] for p in payloads}, {"desktop", "tablet", "mobile"})
        for payload in payloads:
            with self.subTest(device=payload["device"]["device_type"]):
                parsed = vi.CollectInput.model_validate_json(json.dumps(payload))
                self.assertTrue({"session_start", "page_view", "engagement", "signup_started", "field_focused"}.issubset({e.name for e in parsed.events}))
                response = self.post("collect", payload)
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(response.json()["accepted"], len(payload["events"]))
                self.assertNotIn("private=hidden", json.dumps(self.db.calls[-1]))

    def test_disabled_is_quiet_without_body_auth_key_or_database(self):
        with patch.dict(os.environ, {"VISITOR_TRACKING_ENABLED": "false", "VISITOR_SIGNING_SECRET": ""}):
            for route in ("collect", "identity"):
                response = self.client.post("/api/public/visitor/" + route, content="not json")
                self.assertEqual((response.status_code, response.content), (204, b""))
        self.assertFalse(self.db.calls)
        self.auth.assert_not_awaited()

    def test_environment_defaults(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(vi.enabled())
            os.environ["NODEMERE_ENV"] = "production"
            self.assertTrue(vi.enabled())
            os.environ["VISITOR_TRACKING_ENABLED"] = "false"
            self.assertFalse(vi.enabled())
            del os.environ["VISITOR_TRACKING_ENABLED"]
            del os.environ["NODEMERE_ENV"]
            os.environ["RENDER"] = "true"
            self.assertTrue(vi.enabled())
            self.assertFalse(vi.enabled("VISITOR_ALLOW_LOCAL"))

    def test_exact_origin_allows_prod_rejects_previews_and_proxy_spoof(self):
        for origin in vi.PRODUCTION_ORIGINS:
            self.assertEqual(self.post("collect", sample(), {"Origin": origin}).status_code, 200)
        for origin in ("https://preview.nodemere.ai", "https://nodemere.ai.attacker.test", "http://nodemere.ai", "https://nodemere.ai:444", "null", "", "https://nodemere.ai/path"):
            response = self.post("collect", sample(), {"Origin": origin, "X-Forwarded-Host": "nodemere.ai", "Forwarded": "host=nodemere.ai"})
            self.assertEqual(response.status_code, 403, origin)

    def test_local_opt_in_flags_internal(self):
        self.assertEqual(self.post("collect", sample(), {"Origin": "http://localhost:5173"}).status_code, 204)
        self.assertFalse(self.db.calls)
        with patch.dict(os.environ, {"VISITOR_ALLOW_LOCAL": "true"}):
            self.assertEqual(self.post("collect", sample(), {"Origin": "http://127.0.0.1:5173"}).status_code, 200)
        self.assertTrue(self.db.calls[-1][1]["p_payload"]["is_internal"])

    def test_privacy_headers_disable_optional_tracking(self):
        for header in ("Sec-GPC", "DNT"):
            self.assertEqual(self.post("collect", sample(), {header: "1"}).status_code, 204)
        self.assertFalse(self.db.calls)

    def test_first_collect_and_proven_retry_no_raw_identifiers(self):
        p = sample()
        response = self.post("collect", p, {"User-Agent": "PRIVATE HeadlessChrome", "X-Forwarded-For": "PRIVATE"})
        self.assertEqual(response.status_code, 200)
        normalized = self.db.calls[-1][1]["p_payload"]
        self.assertEqual((normalized["identity_confidence"], normalized["identity_match_method"]), (0, "new"))
        self.assertTrue(normalized["is_bot"])
        self.assertFalse(normalized["has_identity_proof"])
        self.assertNotIn("PRIVATE", json.dumps(normalized))
        self.assertNotIn("visitor_token", normalized)
        self.assertEqual(normalized["attribution"]["referrer"], "https://search.example")
        p["visitor_token"] = response.json()["visitor_token"]
        retry = self.post("collect", p)
        self.assertEqual(retry.json()["accepted"], 0)
        self.assertEqual(self.db.calls[-1][1]["p_payload"]["identity_confidence"], 100)
        self.assertEqual(retry.json()["session_id"], response.json()["session_id"])

    def test_lost_bootstrap_response_cannot_claim_existing_id(self):
        p, first = self.bootstrap()
        response = self.post("collect", p)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"]["code"], "visitor_identity_required")
        self.assertNotIn("visitor_token", response.json())
        self.assertEqual(self.post("collect", sample()).status_code, 200)

    def test_token_tamper_cross_visitor_and_unicode_rejected_before_db(self):
        p, first = self.bootstrap()
        count = len(self.db.calls)
        for token in (first["visitor_token"][:-1] + "z", "v1." + "f" * 64, "\u2603"):
            p["visitor_token"] = token
            self.assertEqual(self.post("collect", p).status_code, 409)
        p["visitor_id"] = str(uuid4())
        p["visitor_token"] = first["visitor_token"]
        self.assertEqual(self.post("collect", p).status_code, 409)
        self.assertEqual(len(self.db.calls), count)

    def test_fingerprint_coarse_partition_and_key_domains(self):
        p = sample()
        model = vi.CollectInput.model_validate_json(json.dumps(p))
        key = vi.signing_key()
        fp = vi.fingerprint(model.visitor_id, model.device, key)
        self.assertRegex(fp, r"^[a-f0-9]{64}$")
        second = model.device.model_copy(update={"screen_width": 1921, "browser_version": "123", "timezone": "America/New_York"})
        self.assertEqual(fp, vi.fingerprint(model.visitor_id, second, key))
        self.assertNotEqual(fp, vi.fingerprint(uuid4(), model.device, key))
        self.assertNotEqual(fp, vi.visitor_token(model.visitor_id, key)[3:])
        with patch.dict(os.environ, {"VISITOR_SIGNING_SECRET": "", "SUPABASE_SERVICE_ROLE_KEY": "service-secret"}):
            self.assertEqual(len(vi.signing_key()), 32)
            self.assertNotEqual(vi.signing_key(), b"service-secret")

    def test_extra_fields_forbidden_at_every_level_and_never_echoed(self):
        for location in ("root", "consent", "attribution", "device", "event", "metadata"):
            p = sample()
            target = p if location == "root" else p["events"][0] if location == "event" else p["events"][0]["metadata"] if location == "metadata" else p[location]
            target["PRIVATE"] = "SECRET_TOKEN"
            response = self.post("collect", p)
            self.assertEqual(response.status_code, 422, location)
            self.assertNotIn("PRIVATE", response.text)
            self.assertNotIn("SECRET_TOKEN", response.text)
        self.assertFalse(self.db.calls)

    def test_sensitive_paths_and_server_events_are_rejected(self):
        for page in ("/dashboard", "/dashboard/calendar", "/upload/token", "/auth?code=SECRET", "/auth#access_token=SECRET", "/clone", "/onboarding", "/stats"):
            p = sample(); p["events"][0]["page"] = page
            self.assertEqual(self.post("collect", p).status_code, 422, page)
        for name in ("signup_completed", "login", "subscription_created", "arbitrary"):
            p = sample(); p["events"][0]["name"] = name
            self.assertEqual(self.post("collect", p).status_code, 422, name)

    def test_consent_must_be_explicit_current_and_boolean(self):
        for value in (False, 1, "true", None):
            p = sample(); p["consent"]["analytics"] = value
            self.assertEqual(self.post("collect", p).status_code, 422)
        p = sample(); p["consent"]["version"] = "old"
        self.assertEqual(self.post("collect", p).status_code, 422)

    def test_typed_metadata_and_limits(self):
        for metadata in ({"engaged_seconds": 61}, {"engaged_seconds": "4"}, {"engaged_seconds": True}, {"scroll_depth": -1}, {"scroll_depth": 101}, {"field_id": "email@example.com"}, {"element_type": "PRIVATE"}):
            p = sample(); p["events"][0]["metadata"] = metadata
            self.assertEqual(self.post("collect", p).status_code, 422, metadata)
        p = sample(); p["events"][0]["metadata"] = {"engaged_seconds": 60, "scroll_depth": 100, "href": "/pricing?token=PRIVATE#PRIVATE"}
        self.assertEqual(self.post("collect", p).status_code, 200)
        self.assertEqual(self.db.calls[-1][1]["p_payload"]["events"][0]["metadata"]["href"], "/pricing")

    def test_phase_two_homepage_events_are_strict_and_forwarded(self):
        event_metadata = {
            "section_id": "hero", "section_index": 0, "element_id": "hero-signup", "element_type": "link",
            "device_class": "desktop", "viewport_width": 1280, "viewport_height": 800,
            "normalized_x": 0.25, "normalized_y": 0.5,
        }
        p = sample(); p["events"][0].update({"name": "homepage_click", "page": "/", "metadata": event_metadata})
        self.assertEqual(self.post("collect", p).status_code, 200)
        self.assertEqual(self.db.calls[-1][0], "visitor_ingest_phase2")
        self.assertEqual(self.db.calls[-1][1]["p_payload"]["events"][0]["metadata"]["normalized_x"], 0.25)

        for bad in (
            {**event_metadata, "normalized_x": 1.01},
            {**event_metadata, "section_id": "invented"},
            {**event_metadata, "section_index": 1},
            {**event_metadata, "viewport_width": 0},
        ):
            p = sample(); p["events"][0].update({"name": "homepage_click", "page": "/", "metadata": bad})
            self.assertEqual(self.post("collect", p).status_code, 422, bad)
        p = sample(); p["events"][0].update({"name": "homepage_click", "page": "/pricing", "metadata": event_metadata})
        self.assertEqual(self.post("collect", p).status_code, 422)

    def test_phase_two_attention_and_progression_contracts(self):
        base = {"device_class": "mobile", "viewport_width": 390, "viewport_height": 844}
        valid = [
            {"name": "section_view", "metadata": {**base, "section_id": "calendar", "section_index": 1}},
            {"name": "section_attention", "metadata": {**base, "section_id": "calendar", "section_index": 1,
                "visible_seconds": 12.5, "continued": True, "deepest_section_id": "comparison", "deepest_section_index": 4}},
            {"name": "section_progression", "metadata": {**base, "from_section_id": "calendar", "from_section_index": 1,
                "to_section_id": "comparison", "to_section_index": 4}},
        ]
        p = sample(); p["events"] = [{**p["events"][0], **event, "page": "/"} for event in valid]
        self.assertEqual(self.post("collect", p).status_code, 200)
        for change in (
            {"continued": False}, {"visible_seconds": 0}, {"deepest_section_index": 2},
        ):
            p = sample(); p["events"][0].update({"name": "section_attention", "page": "/", "metadata": {
                **valid[1]["metadata"], **change,
            }})
            self.assertEqual(self.post("collect", p).status_code, 422, change)

    def test_event_size_and_timestamp_bounds(self):
        for count in (0, 41):
            p = sample(); p["events"] = p["events"] * count
            self.assertEqual(self.post("collect", p).status_code, 422)
        for timestamp in (datetime.now(timezone.utc) - timedelta(hours=25), datetime.now(timezone.utc) + timedelta(minutes=6)):
            p = sample(); p["events"][0]["occurred_at"] = timestamp.isoformat()
            self.assertEqual(self.post("collect", p).status_code, 422)
        p = sample(); p["events"][0]["occurred_at"] = "2026-09-05T12:00:00"
        self.assertEqual(self.post("collect", p).status_code, 422)

    def test_duplicate_json_keys_and_non_json_rejected(self):
        r = self.client.post("/api/public/visitor/collect", content='{"visitor_id":"a","visitor_id":"b"}', headers={**self.headers, "Content-Type": "application/json"})
        self.assertEqual(r.status_code, 422)
        r = self.client.post("/api/public/visitor/collect", content="{}", headers=self.headers)
        self.assertEqual(r.status_code, 415)

    def test_stream_limit_without_content_length(self):
        async def exercise():
            chunks = iter([b" " * 16384, b" " * 16384, b"x"])
            async def receive():
                chunk = next(chunks)
                return {"type": "http.request", "body": chunk, "more_body": chunk != b"x"}
            request = Request({"type": "http", "headers": [(b"content-type", b"application/json")]}, receive)
            with self.assertRaises(HTTPException) as caught:
                await vi.read_payload(request, vi.CollectInput)
            self.assertEqual(caught.exception.status_code, 413)
        asyncio.run(exercise())

    def test_no_visitor_read_routes(self):
        for path in ("/api/public/visitor/collect", "/api/public/visitor/identity", "/api/public/visitor/revoke"):
            self.assertEqual(self.client.get(path).status_code, 405)

    def test_identity_verified_before_profile_or_rpc_and_request_ids_ignored(self):
        p, first = self.bootstrap()
        count = len(self.db.calls)
        self.auth.side_effect = HTTPException(401, "SECRET_TOKEN")
        response = self.post("identity", self.identity_body(first), {"Authorization": "Bearer SECRET_TOKEN"})
        self.assertEqual(response.status_code, 401)
        self.assertNotIn("SECRET_TOKEN", response.text)
        self.assertEqual(len(self.db.calls), count)
        self.auth.side_effect = None
        auth_created = (datetime.fromisoformat(NOW) - timedelta(days=3)).isoformat()
        self.auth.return_value = SimpleNamespace(id=USER, created_at=auth_created)
        response = self.post("identity", self.identity_body(first), {"Authorization": "Bearer valid"})
        self.assertEqual(response.status_code, 200, response.text)
        params = self.db.calls[-1][1]
        self.assertEqual(params["p_user_id"], USER)
        self.assertEqual(params["p_account_created_at"], auth_created)
        self.assertNotIn("valid", json.dumps(params))

    def test_shared_browser_rotation_retry_preserves_previous_history(self):
        p, first = self.bootstrap()
        self.db.visitors[p["visitor_id"]]["user_id"] = OTHER
        body = self.identity_body(first)
        headers = {"Authorization": "Bearer valid"}
        rotation = self.post("identity", body, headers)
        self.assertEqual(rotation.status_code, 200, rotation.text)
        result = rotation.json()
        self.assertTrue(result["rotated"])
        self.assertTrue(result["requires_collect"])
        self.assertEqual(self.post("identity", body, headers).json(), result)
        self.assertEqual(self.db.visitors[p["visitor_id"]]["user_id"], OTHER)
        self.assertNotIn(result["visitor_id"], self.db.visitors)
        new_payload = sample(); new_payload.update(visitor_id=result["visitor_id"], visitor_token=result["visitor_token"])
        self.assertEqual(self.post("collect", new_payload).status_code, 200)
        linked = self.post("identity", body, headers).json()
        self.assertEqual(linked["visitor_id"], result["visitor_id"])
        self.assertFalse(linked["requires_collect"])
        self.assertEqual(self.db.visitors[result["visitor_id"]]["user_id"], USER)

    def test_revoke_is_persistent_and_allowed_with_privacy_headers(self):
        p, first = self.bootstrap()
        body = {k: first[k] for k in ("visitor_id", "visitor_token")}
        response = self.post("revoke", body, {"Sec-GPC": "1"})
        self.assertEqual(response.status_code, 204)
        self.assertIn(p["visitor_id"], self.db.visitors)
        p["visitor_token"] = first["visitor_token"]
        self.assertEqual(self.post("collect", p).json()["detail"]["code"], "visitor_revoked")
        self.assertEqual(self.post("identity", self.identity_body(first), {"Authorization": "Bearer valid"}).json()["detail"]["code"], "visitor_revoked")

    def test_revoke_still_persists_while_collection_disabled(self):
        p, first = self.bootstrap()
        body = {k: first[k] for k in ("visitor_id", "visitor_token")}
        with patch.dict(os.environ, {"VISITOR_TRACKING_ENABLED": "false"}):
            self.assertEqual(self.post("collect", sample()).status_code, 204)
            self.assertEqual(self.post("revoke", body).status_code, 204)
            self.assertTrue(self.db.visitors[p["visitor_id"]]["revoked"])
            self.assertEqual(self.post("revoke", body, {"Origin": "https://attacker.test"}).status_code, 403)
            self.assertEqual(self.post("revoke", {**body, "visitor_token": "bad"}).status_code, 409)
            self.assertEqual(self.post("revoke", body, {"Origin": "http://localhost:5173"}).status_code, 204)
        p["visitor_token"] = first["visitor_token"]
        self.assertEqual(self.post("collect", p).json()["detail"]["code"], "visitor_revoked")

    def test_database_errors_do_not_disclose_payloads(self):
        self.db.failure = "SECRET_CONNECTION_STRING"
        response = self.post("collect", sample())
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": {"code": "visitor_unavailable"}})

    def test_rate_limiter_bounded_and_expiry_without_raw_peer_storage(self):
        clock = [0]
        limiter = vi.RateLimiter(maximum=2, clock=lambda: clock[0])
        for _ in range(2):
            limiter.check("peer:PRIVATE_IP", b"secret", 2)
        with self.assertRaises(HTTPException): limiter.check("peer:PRIVATE_IP", b"secret", 2)
        limiter.check("second", b"secret", 2)
        with self.assertRaises(HTTPException): limiter.check("third", b"secret", 2)
        self.assertNotIn("PRIVATE_IP", str(limiter.buckets))
        clock[0] = 61
        limiter.check("third", b"secret", 2)
        self.assertEqual(len(limiter.buckets), 1)


def paid_event(event_type="invoice.paid"):
    obj = {"customer": "cus_example", "subscription": "sub_example", "amount_paid": 5000}
    if event_type == "checkout.session.completed":
        obj.update(mode="subscription", payment_status="paid", amount_total=5000)
    return {"id": "evt_example", "type": event_type, "livemode": True, "created": int(datetime.now(timezone.utc).timestamp()), "data": {"object": obj}}


class VisitorIntelligenceAdminTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            "NODEMERE_ENV": "production",
            "VISITOR_INTELLIGENCE_ADMIN_USER_IDS": USER,
        }, clear=True)
        self.environment.start(); self.addCleanup(self.environment.stop)
        self.db = FakeDatabase()

        async def authenticate():
            return SimpleNamespace(id=USER, email="internal@example.test")

        app = FastAPI()
        app.include_router(vi.build_visitor_intelligence_router(self.db, authenticate))
        self.client = TestClient(app)

    def test_command_center_is_allowlisted_and_never_cached(self):
        access = self.client.get("/api/visitor-intelligence/access")
        self.assertEqual(access.json(), {"authorized": True})
        self.assertEqual(access.headers["cache-control"], "private, no-store")
        response = self.client.get("/api/visitor-intelligence/command-center?range=30d&device=mobile&segment=returning&conversion=converted&source=Direct")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.headers["cache-control"], "private, no-store")
        name, params = self.db.calls[-1]
        self.assertEqual(name, "visitor_intelligence_command_center")
        self.assertEqual(params["p_device"], "mobile")
        self.assertEqual(params["p_segment"], "returning")
        self.assertIs(params["p_converted"], True)
        self.assertEqual(params["p_source"], "Direct")

    def test_list_profile_and_activity_are_bounded_service_rpcs(self):
        response = self.client.get("/api/visitor-intelligence/visitors?page=2&page_size=50&status=anonymous&sort=visits_desc")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["page"], 2)
        self.assertEqual(self.db.calls[-1][0], "visitor_intelligence_visitors")
        self.assertEqual(self.db.calls[-1][1]["p_page_size"], 50)
        self.assertIs(self.db.calls[-1][1]["p_include_internal"], False)
        visitor_id = str(uuid4())
        self.assertEqual(self.client.get(f"/api/visitor-intelligence/visitors/{visitor_id}").json()["identity"]["id"], visitor_id)
        self.assertEqual(self.client.get("/api/visitor-intelligence/activity?limit=20").json(), [])
        self.assertEqual(self.db.calls[-1][1]["p_limit"], 20)

    def test_production_denies_authenticated_accounts_outside_allowlist(self):
        with patch.dict(os.environ, {"VISITOR_INTELLIGENCE_ADMIN_USER_IDS": OTHER}):
            response = self.client.get("/api/visitor-intelligence/command-center")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json(), {"detail": {"code": "visitor_intelligence_forbidden"}})
        self.assertFalse(self.db.calls)

    def test_local_authenticated_override_never_changes_production_behavior(self):
        user = SimpleNamespace(id=OTHER, email="other@example.test")
        self.assertFalse(vi.visitor_intelligence_authorized(user))
        with patch.dict(os.environ, {"NODEMERE_ENV": "development", "VISITOR_INTELLIGENCE_ALLOW_LOCAL_AUTHENTICATED": "true"}, clear=True):
            self.assertTrue(vi.visitor_intelligence_authorized(user))
        with patch.dict(os.environ, {"NODEMERE_ENV": "production", "VISITOR_INTELLIGENCE_ALLOW_LOCAL_AUTHENTICATED": "true"}, clear=True):
            self.assertFalse(vi.visitor_intelligence_authorized(user))

    def test_internal_local_traffic_visibility_is_explicit_and_development_only(self):
        with patch.dict(os.environ, {"NODEMERE_ENV": "development", "VISITOR_INTELLIGENCE_INCLUDE_INTERNAL_LOCAL": "true"}, clear=True):
            self.assertTrue(vi.visitor_intelligence_include_internal())
        with patch.dict(os.environ, {"NODEMERE_ENV": "production", "VISITOR_INTELLIGENCE_INCLUDE_INTERNAL_LOCAL": "true"}, clear=True):
            self.assertFalse(vi.visitor_intelligence_include_internal())

    def test_invalid_ranges_and_query_bounds_are_rejected_before_database(self):
        self.assertEqual(self.client.get("/api/visitor-intelligence/command-center?range=365d").status_code, 422)
        self.assertEqual(self.client.get("/api/visitor-intelligence/visitors?page_size=101").status_code, 422)
        self.assertFalse(self.db.calls)


class BillingTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {"VISITOR_TRACKING_ENABLED": "true"}, clear=True)
        self.environment.start(); self.addCleanup(self.environment.stop)
        self.db = FakeDatabase()

    def test_paid_invoice_and_checkout_dedup_same_subscription(self):
        result = vi.record_verified_billing_event(self.db, paid_event())
        self.assertEqual(result, {"accepted": 1})
        self.assertEqual(vi.record_verified_billing_event(self.db, paid_event("checkout.session.completed")), {"accepted": 0})
        params = self.db.calls[0][1]
        self.assertEqual(set(params), {"p_user_id", "p_subscription_id", "p_occurred_at"})
        self.assertEqual(params["p_user_id"], USER)

    def test_new_invoice_subscription_shape_and_expanded_ids(self):
        event = paid_event()
        obj = event["data"]["object"]
        del obj["subscription"]
        obj.update(parent={"subscription_details": {"subscription": {"id": "sub_example"}}}, customer={"id": "cus_example", "email": "PRIVATE"})
        self.assertEqual(vi.record_verified_billing_event(self.db, event), {"accepted": 1})
        self.assertNotIn("PRIVATE", json.dumps(self.db.calls))

    def test_test_connect_free_trial_status_and_non_subscription_never_convert(self):
        events = []
        for key, value in (("livemode", False), ("account", "acct_connect"), ("type", "customer.subscription.created"), ("type", "customer.subscription.updated")):
            event = paid_event(); event[key] = value; events.append(event)
        for amount in (0, -1, True, "5000", None):
            event = paid_event(); event["data"]["object"]["amount_paid"] = amount; events.append(event)
        for field, value in (("subscription", None), ("subscription", "sim_sub_example"), ("customer", "sim_cus_example")):
            event = paid_event(); event["data"]["object"][field] = value; events.append(event)
        for field, value in (("mode", "payment"), ("payment_status", "unpaid"), ("payment_status", "no_payment_required"), ("amount_total", 0)):
            event = paid_event("checkout.session.completed"); event["data"]["object"][field] = value; events.append(event)
        for event in events:
            self.assertIsNone(vi.record_verified_billing_event(self.db, event))
        self.assertFalse(self.db.calls)

    def test_customer_mapping_only_resubscriptions_work_ambiguous_records_rejected(self):
        event = paid_event(); event["data"]["object"]["metadata"] = {"supabase_user_id": OTHER}
        vi.record_verified_billing_event(self.db, event)
        self.assertEqual(self.db.calls[-1][1]["p_user_id"], USER)
        self.db.calls.clear()
        self.db.users[0]["stripe_subscription_id"] = "sub_other"
        event["data"]["object"]["subscription"] = "sub_new"
        self.assertEqual(vi.record_verified_billing_event(self.db, event), {"accepted": 1})
        self.db.calls.clear()
        self.db.users[0]["stripe_subscription_id"] = None
        self.db.users.append({**self.db.users[0], "id": OTHER})
        self.assertIsNone(vi.record_verified_billing_event(self.db, event))
        self.assertFalse(self.db.calls)

    def test_analytics_storage_failure_cannot_fail_billing_or_leak(self):
        self.db.failure = "SECRET_DATABASE_URL"
        with self.assertLogs(level="WARNING") as captured:
            self.assertIsNone(vi.record_verified_billing_event(self.db, paid_event()))
        self.assertIn("visitor_intelligence.conversion.event_1", " ".join(captured.output))
        self.assertNotIn("SECRET_DATABASE_URL", " ".join(captured.output))

    def test_disabled_billing_does_nothing(self):
        with patch.dict(os.environ, {"VISITOR_TRACKING_ENABLED": "false"}):
            self.assertIsNone(vi.record_verified_billing_event(self.db, paid_event()))
        self.assertFalse(self.db.calls)


if __name__ == "__main__":
    unittest.main()
