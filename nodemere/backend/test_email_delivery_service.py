import unittest
from types import SimpleNamespace
from unittest.mock import patch

from backend.document_service import create_document_request
from backend.email_delivery_service import (
    EmailDeliveryError,
    SystemResendConfiguration,
    send_secure_link_email,
)
from backend.verification_service import create_verification_session


class FakeResponse:
    def __init__(self, payload, *, ok=True):
        self._payload = payload
        self.ok = ok

    def json(self):
        return self._payload


class FakeRequestTable:
    def __init__(self):
        self.row = None

    def insert(self, row):
        self.row = {**row, "id": "request-id"}
        return self

    def execute(self):
        return SimpleNamespace(data=[self.row])


class FakeSupabase:
    def __init__(self):
        self.requests = FakeRequestTable()

    def table(self, table_name):
        if table_name != "requests":
            raise AssertionError(f"Unexpected table: {table_name}")
        return self.requests


class SecureLinkEmailTests(unittest.TestCase):
    configuration = SystemResendConfiguration(
        sender_email="send@example.test",
        api_key="test-value",
    )
    secure_link = "https://app.example.test/verify/test-token"

    def _sent_message(self, kind):
        with patch(
            "backend.email_delivery_service.requests.post",
            return_value=FakeResponse({"id": "resend-message-id"}),
        ) as post:
            result = send_secure_link_email(
                kind=kind,
                recipient_email="customer@example.test",
                business_name="Oak & Ivy Salon",
                secure_link=self.secure_link,
                configuration=self.configuration,
            )

        return result, post.call_args.kwargs["json"]

    def test_verification_email_has_business_sender_and_both_body_formats(self):
        result, message = self._sent_message("verification")

        self.assertEqual(result["status"], "sent")
        self.assertEqual(message["from"], "Oak & Ivy Salon <send@example.test>")
        self.assertEqual(message["to"], ["customer@example.test"])
        self.assertEqual(message["subject"], "Verify your identity with Oak & Ivy Salon")
        self.assertIn("Verify Identity", message["text"])
        self.assertIn(self.secure_link, message["text"])
        self.assertIn("Securely delivered by Nodemere", message["html"])

    def test_document_email_uses_document_specific_copy(self):
        result, message = self._sent_message("document_upload")

        self.assertEqual(result["channel"], "email")
        self.assertEqual(message["subject"], "Upload your document for Oak & Ivy Salon")
        self.assertIn("Upload Document", message["text"])
        self.assertIn("has requested a document", message["html"])

    def test_missing_resend_configuration_returns_a_safe_error(self):
        with self.assertRaises(EmailDeliveryError) as raised:
            send_secure_link_email(
                kind="verification",
                recipient_email="customer@example.test",
                business_name="Oak & Ivy Salon",
                secure_link=self.secure_link,
                configuration=SystemResendConfiguration(None, None),
            )

        self.assertEqual(raised.exception.code, "resend_not_configured")
        self.assertEqual(
            raised.exception.missing_configuration,
            ("RESEND_FROM_EMAIL", "RESEND_API_KEY"),
        )

    def test_existing_link_generators_keep_their_paths_without_logging_tokens(self):
        with self.assertLogs(level="INFO") as captured:
            verification = create_verification_session(
                FakeSupabase(),
                base_url="https://app.example.test",
                business_id=7,
                person_id=12,
            )
            document = create_document_request(
                FakeSupabase(),
                base_url="https://app.example.test",
                business_id=7,
                person_id=12,
            )

        self.assertRegex(verification["verification_url"], r"^https://app\.example\.test/verify/")
        self.assertRegex(document["request_url"], r"^https://app\.example\.test/upload/")
        logs = "\n".join(captured.output)
        self.assertNotIn(verification["verification_url"], logs)
        self.assertNotIn(document["request_url"], logs)


if __name__ == "__main__":
    unittest.main()
