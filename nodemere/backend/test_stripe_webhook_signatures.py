import hashlib
import hmac
import json
import time
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from backend import main


class StripeWebhookSignatureTests(unittest.IsolatedAsyncioTestCase):
    async def _deliver(self, secret, account=None):
        event = {"id": "evt_test", "object": "event", "type": "unhandled.test", "data": {"object": {}}}
        if account:
            event["account"] = account
        payload = json.dumps(event).encode()
        timestamp = int(time.time())
        digest = hmac.new(secret.encode(), f"{timestamp}.".encode() + payload, hashlib.sha256).hexdigest()
        request = SimpleNamespace(body=AsyncMock(return_value=payload))
        return await main.stripe_webhook(request, f"t={timestamp},v1={digest}")

    async def test_platform_and_connect_secrets_accept_matching_scopes(self):
        with patch.object(main, "stripe_webhook_secret", "whsec_platform"), \
             patch.object(main, "stripe_connect_webhook_secret", "whsec_connect"), \
             patch.object(main, "stripe_connect_test_webhook_secret", "whsec_connect_test"), \
             patch.object(main.asyncio, "to_thread", new_callable=AsyncMock):
            self.assertEqual((await self._deliver("whsec_platform"))["status"], "success")
            self.assertEqual((await self._deliver("whsec_connect", "acct_123"))["status"], "success")
            self.assertEqual((await self._deliver("whsec_connect_test", "acct_test"))["status"], "success")

    async def test_signature_cannot_be_used_for_wrong_account_scope(self):
        with patch.object(main, "stripe_webhook_secret", "whsec_platform"), \
             patch.object(main, "stripe_connect_webhook_secret", "whsec_connect"), \
             patch.object(main, "stripe_connect_test_webhook_secret", "whsec_connect_test"), \
             patch.object(main.asyncio, "to_thread", new_callable=AsyncMock):
            with self.assertRaises(HTTPException) as wrong_scope:
                await self._deliver("whsec_platform", "acct_123")
            self.assertEqual(wrong_scope.exception.status_code, 400)
            with self.assertRaises(HTTPException) as wrong_signature:
                await self._deliver("whsec_other")
            self.assertEqual(wrong_signature.exception.status_code, 400)

    async def test_stripe_sdk_event_objects_are_normalized_before_scope_checks(self):
        class StripeEventObject:
            def to_dict(self):
                return {
                    "id": "evt_test",
                    "object": "event",
                    "type": "unhandled.test",
                    "account": "acct_test",
                    "data": {"object": {}},
                }

        request = SimpleNamespace(body=AsyncMock(return_value=b"{}"))
        with patch.object(main, "stripe_connect_test_webhook_secret", "whsec_connect_test"), \
             patch.object(main.stripe.Webhook, "construct_event", return_value=StripeEventObject()), \
             patch.object(main.asyncio, "to_thread", new_callable=AsyncMock):
            self.assertEqual(
                await main.stripe_webhook(request, stripe_signature="test-signature"),
                {"status": "success"},
            )
