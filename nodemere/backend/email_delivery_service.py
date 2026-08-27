"""Backend-only delivery of Nodemere's secure customer links by email.

This module deliberately accepts an already-created URL.  It does not create,
store, inspect, or alter verification and document-upload requests.
"""

import base64
import html
import logging
import re
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr
from typing import Literal
from urllib.parse import urlsplit

import requests


GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
EMAIL_KIND = Literal["verification", "document_upload"]


class EmailDeliveryError(Exception):
    """A safe, structured delivery error suitable for a calling tool response."""

    def __init__(self, code: str, message: str, *, missing_configuration: tuple[str, ...] = ()):
        super().__init__(message)
        self.code = code
        self.message = message
        self.missing_configuration = missing_configuration


@dataclass(frozen=True)
class SystemGmailConfiguration:
    sender_email: str | None
    refresh_token: str | None
    google_client_id: str | None
    google_client_secret: str | None

    def missing_fields(self) -> tuple[str, ...]:
        fields = {
            "SYSTEM_GMAIL_SENDER_EMAIL": self.sender_email,
            "SYSTEM_GMAIL_REFRESH_TOKEN": self.refresh_token,
            "GOOGLE_CLIENT_ID": self.google_client_id,
            "GOOGLE_CLIENT_SECRET": self.google_client_secret,
        }
        return tuple(name for name, value in fields.items() if not str(value or "").strip())


def _clean_single_line(value: str | None, *, field: str, maximum_length: int) -> str:
    cleaned = " ".join(str(value or "").split()).strip()
    if not cleaned or "\r" in cleaned or "\n" in cleaned:
        raise EmailDeliveryError("invalid_email_content", f"{field} is required for secure email delivery.")
    return cleaned[:maximum_length]


def _validate_recipient(email_address: str | None) -> str:
    recipient = _clean_single_line(email_address, field="Customer email", maximum_length=320)
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", recipient):
        raise EmailDeliveryError("customer_email_invalid", "The caller's email address is invalid.")
    return recipient


def _validate_link(link: str) -> str:
    if "\r" in str(link or "") or "\n" in str(link or ""):
        raise EmailDeliveryError("invalid_secure_link", "The secure link could not be delivered.")
    parsed = urlsplit(str(link or ""))
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise EmailDeliveryError("invalid_secure_link", "The secure link could not be delivered.")
    return str(link)


def _email_copy(kind: EMAIL_KIND, business_name: str) -> tuple[str, str, str, str]:
    if kind == "verification":
        return (
            f"Verify your identity with {business_name}",
            "Verify Identity",
            f"{business_name} needs you to verify your identity before continuing.",
            "Verification requested",
        )
    if kind == "document_upload":
        return (
            f"Upload your document for {business_name}",
            "Upload Document",
            f"{business_name} has requested a document from you.",
            "Document requested",
        )
    raise ValueError(f"Unsupported secure email type: {kind}")


def build_secure_link_email(*, kind: EMAIL_KIND, business_name: str, secure_link: str, sender_email: str) -> EmailMessage:
    """Build a multipart, email-client-safe message without external assets."""
    business_name = _clean_single_line(business_name, field="Business name", maximum_length=160)
    sender_email = _validate_recipient(sender_email)
    secure_link = _validate_link(secure_link)
    subject, cta_label, body_copy, eyebrow = _email_copy(kind, business_name)

    escaped_business_name = html.escape(business_name)
    escaped_link = html.escape(secure_link, quote=True)
    escaped_cta = html.escape(cta_label)
    plain_text = (
        f"{eyebrow}\n\n"
        f"{body_copy}\n\n"
        f"{cta_label}: {secure_link}\n\n"
        "For your security, this link expires soon. If you did not expect this request, you can ignore this email.\n\n"
        "Securely delivered by Nodemere"
    )
    html_body = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>{html.escape(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f5f5f2;color:#171717;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;mso-hide:all;">{html.escape(body_copy)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f5f2;margin:0;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e5e5e1;border-radius:12px;">
            <tr>
              <td style="padding:32px 32px 20px;border-bottom:1px solid #ecece8;">
                <p style="margin:0 0 10px;color:#6b6b66;font-size:12px;font-weight:700;letter-spacing:1.2px;line-height:18px;text-transform:uppercase;">{html.escape(eyebrow)}</p>
                <h1 style="margin:0;color:#171717;font-size:26px;font-weight:700;letter-spacing:-0.35px;line-height:34px;">{escaped_business_name}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 12px;">
                <p style="margin:0;color:#2e2e2b;font-size:16px;line-height:25px;">{html.escape(body_copy)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 30px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" bgcolor="#171717" style="border-radius:6px;">
                      <a href="{escaped_link}" target="_blank" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:16px;font-weight:700;line-height:20px;text-align:center;text-decoration:none;">{escaped_cta}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 30px;">
                <p style="margin:0;color:#666660;font-size:13px;line-height:20px;">For your security, this link expires soon. If the button does not work, copy and paste this link into your browser:</p>
                <p style="margin:8px 0 0;font-size:13px;line-height:20px;word-break:break-all;"><a href="{escaped_link}" target="_blank" style="color:#3d3d38;text-decoration:underline;">{escaped_link}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #ecece8;">
                <p style="margin:0;color:#777771;font-size:12px;line-height:18px;">Securely delivered by Nodemere</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""

    message = EmailMessage()
    message["From"] = formataddr((business_name, sender_email))
    message["To"] = sender_email  # Replaced by the sender at dispatch time.
    message["Subject"] = subject
    message.set_content(plain_text)
    message.add_alternative(html_body, subtype="html")
    return message


def _get_gmail_access_token(configuration: SystemGmailConfiguration) -> str:
    response = requests.post(
        GMAIL_TOKEN_URL,
        data={
            "client_id": configuration.google_client_id,
            "client_secret": configuration.google_client_secret,
            "refresh_token": configuration.refresh_token,
            "grant_type": "refresh_token",
        },
        timeout=30,
    )
    if not response.ok:
        raise EmailDeliveryError("gmail_token_refresh_failed", "The email service could not authenticate with Gmail.")
    try:
        access_token = response.json().get("access_token")
    except (TypeError, ValueError):
        access_token = None
    if not access_token:
        raise EmailDeliveryError("gmail_token_refresh_failed", "The email service could not authenticate with Gmail.")
    return str(access_token)


def send_secure_link_email(
    *,
    kind: EMAIL_KIND,
    recipient_email: str,
    business_name: str,
    secure_link: str,
    configuration: SystemGmailConfiguration,
) -> dict:
    """Send one secure-link email through the configured Nodemere Gmail mailbox.

    No provider retry occurs here: after an ambiguous provider failure, retrying
    automatically could send the same live link twice.
    """
    missing_configuration = configuration.missing_fields()
    if missing_configuration:
        raise EmailDeliveryError(
            "system_gmail_not_configured",
            "Secure email delivery is not configured.",
            missing_configuration=missing_configuration,
        )

    recipient = _validate_recipient(recipient_email)
    message = build_secure_link_email(
        kind=kind,
        business_name=business_name,
        secure_link=secure_link,
        sender_email=str(configuration.sender_email),
    )
    message.replace_header("To", recipient)
    encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode("ascii")
    access_token = _get_gmail_access_token(configuration)
    response = requests.post(
        GMAIL_SEND_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        json={"raw": encoded_message},
        timeout=30,
    )
    if not response.ok:
        raise EmailDeliveryError("gmail_send_failed", "The email provider could not deliver the secure link.")
    try:
        provider_result = response.json()
    except (TypeError, ValueError):
        provider_result = {}

    return {
        "success": True,
        "status": "sent",
        "channel": "email",
        "provider": "gmail",
        "message_id": provider_result.get("id"),
    }


def log_email_delivery_failure(*, kind: str, request_id: str | None, business_id: str | int | None, error: EmailDeliveryError) -> None:
    """Log identifiers for diagnosis without logging recipients, links, or credentials."""
    logging.warning(
        "Secure email delivery failed kind=%s request_id=%s business_id=%s code=%s",
        kind,
        request_id,
        business_id,
        error.code,
    )
