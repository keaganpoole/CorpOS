"""Offline regression checks for misleading post-authentication 401 responses."""
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
from fastapi import HTTPException
from supabase_auth.errors import AuthApiError

from . import dependencies


class AuthFailureClassificationTests(unittest.IsolatedAsyncioTestCase):
    async def rejected(self, auth_error=None, profile_error=None):
        user = SimpleNamespace(id="synthetic-user", email="synthetic@example.com")
        db = MagicMock()
        query = db.table.return_value.select.return_value.eq.return_value.limit.return_value
        query.execute.return_value = SimpleNamespace(data=[{"account_status": "active"}])
        query.execute.side_effect = profile_error
        with patch.object(dependencies, "supabase_admin", db), patch.object(
            dependencies.supabase_auth.auth, "get_user",
            return_value=SimpleNamespace(user=user), side_effect=auth_error,
        ):
            with self.assertRaises(HTTPException) as caught:
                await dependencies.get_current_user(SimpleNamespace(credentials="SECRET_CANARY"))
        self.assertNotIn("SECRET_CANARY", str(caught.exception.detail))
        return caught.exception.status_code

    async def test_invalid_access_token_remains_401(self):
        self.assertEqual(await self.rejected(auth_error=AuthApiError("SECRET_CANARY", 401, "bad_jwt")), 401)

    async def test_auth_transport_timeout_is_not_invalid_credentials(self):
        self.assertEqual(await self.rejected(auth_error=httpx.ReadTimeout("SECRET_CANARY")), 503)

    async def test_auth_upstream_failure_is_not_invalid_credentials(self):
        self.assertEqual(await self.rejected(auth_error=AuthApiError("SECRET_CANARY", 503, None)), 503)

    async def test_auth_rate_limit_is_not_invalid_credentials(self):
        self.assertEqual(await self.rejected(auth_error=AuthApiError("SECRET_CANARY", 429, None)), 503)

    async def test_profile_failure_after_verified_auth_is_not_401(self):
        self.assertEqual(await self.rejected(profile_error=RuntimeError("SECRET_CANARY")), 503)

    async def test_auth_response_parsing_failure_is_not_401(self):
        self.assertEqual(await self.rejected(auth_error=ValueError("SECRET_CANARY")), 503)

    async def test_diagnostics_do_not_log_credentials_or_provider_body(self):
        with self.assertLogs(level="WARNING") as captured:
            await self.rejected(profile_error=RuntimeError("SECRET_CANARY"))
        self.assertNotIn("SECRET_CANARY", " ".join(captured.output))
        self.assertIn("profile", " ".join(captured.output))

    async def test_http_boundary_preserves_503_and_never_authorizes(self):
        from fastapi.testclient import TestClient
        from .test_phase1_security import main
        with patch.object(dependencies.supabase_auth.auth, "get_user", side_effect=httpx.ReadTimeout("SECRET_CANARY")):
            with self.assertLogs(level="WARNING"):
                response = TestClient(main.app).get(
                    "/api/workforce/session", headers={"Authorization": "Bearer SECRET_CANARY"})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("SECRET_CANARY", response.text)
        self.assertNotIn("tenant", response.json())


if __name__ == "__main__":
    unittest.main()
