"""Terminal harness for testing Twilio warm escalation transfers without ElevenLabs.

This script intentionally requires TEST_CALL_TRANSFERS=true. It places a plain
Twilio call to a test phone, parks that call with simple TwiML, stores the same
transfer state the ElevenLabs tool would create, then redirects the live call
through the warm escalation Twilio endpoints.
"""

from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timezone
from uuid import uuid4

import requests
from twilio.rest import Client

from backend.env_loader import load_project_env
from backend.config import supabase_admin
from backend.main import (
    escalation_transfer_webhook_url,
    find_inbound_receptionist_for_business,
    get_escalation_staff_for_business,
    get_public_backend_base_url,
    normalize_phone_number,
    prepare_escalation_whisper_audio,
    transfer_debug_fields,
)


TRUTHY = {"1", "true", "yes", "on"}
FINAL_CALL_STATUSES = {"completed", "failed", "busy", "no-answer", "canceled"}


def section(title: str) -> None:
    print(f"\n== {title} ==")


def ok(message: str) -> None:
    print(f"[OK] {message}")


def warn(message: str) -> None:
    print(f"[WARN] {message}")


def fail(message: str) -> None:
    raise SystemExit(f"\n[STOP] {message}")


def require_enabled() -> None:
    if os.environ.get("TEST_CALL_TRANSFERS", "").strip().lower() not in TRUTHY:
        fail("Set TEST_CALL_TRANSFERS=true in backend/.env before running this live Twilio test.")


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        fail(f"Missing required environment variable: {name}")
    return value


def mask(value: str | None) -> str | None:
    if not value:
        return None
    text = str(value)
    if text.startswith("+") and len(text) >= 5:
        return f"{text[:2]}***{text[-4:]}"
    if len(text) > 12:
        return f"{text[:4]}...{text[-4:]}"
    return text


def supabase_client():
    require_env("SUPABASE_URL")
    require_env("SUPABASE_SERVICE_ROLE_KEY")
    return supabase_admin


def business_row(db, business_id: int) -> dict:
    rows = db.table("businesses").select("*").eq("id", business_id).limit(1).execute().data or []
    if not rows:
        fail(f"No business found for id {business_id}.")
    return rows[0]


def prompt(message: str, default: str = "") -> str:
    suffix = f" [{default}]" if default else ""
    value = input(f"{message}{suffix}: ").strip()
    return value or default


def prompt_phone(message: str, default: str = "") -> str:
    while True:
        value = prompt(message, default)
        normalized = normalize_phone_number(value)
        if normalized:
            return normalized
        print("Please enter a valid phone number, like +12078552084.")


def confirm(message: str, default: bool = False) -> bool:
    default_text = "Y/n" if default else "y/N"
    value = input(f"{message} [{default_text}]: ").strip().lower()
    if not value:
        return default
    return value in {"y", "yes"}


def wait_for_call_status(client: Client, call_sid: str, desired: set[str], timeout_seconds: int, *, label: str) -> str:
    deadline = time.time() + timeout_seconds
    last_status = "unknown"
    last_printed = None
    while time.time() < deadline:
        call = client.calls(call_sid).fetch()
        last_status = str(call.status or "unknown")
        if last_status != last_printed:
            print(f"{label}: {last_status}")
            last_printed = last_status
        if last_status in desired:
            return last_status
        if last_status in FINAL_CALL_STATUSES:
            return last_status
        time.sleep(2)
    return last_status


def create_test_call_log(db, *, business: dict, call_sid: str, from_number: str, to_number: str, transfer: dict) -> str:
    row = {
        "source": "transfer_test_harness",
        "provider_call_sid": call_sid,
        "conversation_id": f"transfer-test:{transfer['id']}",
        "business_id": business.get("id"),
        "user_id": business.get("user_id"),
        "from_number": normalize_phone_number(to_number),
        "to_number": normalize_phone_number(from_number),
        "direction": "inbound",
        "status": "in-progress",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "raw_payload": {
            "source": "transfer_test_harness",
            "escalation_transfer": transfer,
        },
    }
    response = db.table("call_logs").insert(row).execute()
    saved = (response.data or [row])[0]
    return str(saved.get("id") or "")


def run(args: argparse.Namespace) -> None:
    load_project_env()

    section("Warm Transfer Test")
    print("This places a real Twilio test call, then redirects it through the warm escalation transfer flow.")
    print("It does not use ElevenLabs.")

    section("Preflight")
    require_enabled()
    ok("TEST_CALL_TRANSFERS=true")

    warm_enabled = os.environ.get("TWILIO_WARM_ESCALATIONS_ENABLED", "").strip().lower() in TRUTHY
    if warm_enabled:
        ok("TWILIO_WARM_ESCALATIONS_ENABLED=true")
    else:
        warn("TWILIO_WARM_ESCALATIONS_ENABLED is not true. The terminal harness can still hit the Twilio endpoints directly, but production tool calls will not use warm transfers.")

    public_origin = get_public_backend_base_url()
    if not public_origin or not public_origin.startswith("https://"):
        fail("BACKEND_PUBLIC_URL or TWILIO_VOICE_WEBHOOK_URL must provide a public HTTPS origin, usually your ngrok URL.")

    try:
        openapi = requests.get(f"{public_origin}/openapi.json", timeout=10)
        openapi.raise_for_status()
    except requests.RequestException as exc:
        fail(f"Backend public URL is not reachable: {public_origin} ({exc})")
    ok(f"Backend is reachable at {public_origin}")

    account_sid = require_env("TWILIO_ACCOUNT_SID")
    auth_token = require_env("TWILIO_AUTH_TOKEN")
    client = Client(account_sid, auth_token)
    db = supabase_client()
    business = business_row(db, args.business_id)
    ok(f"Loaded business {business.get('id')}: {business.get('name') or 'unnamed business'}")

    default_from_number = normalize_phone_number(
        args.from_number
        or os.environ.get("TEST_CALL_TRANSFERS_FROM_NUMBER")
        or business.get("twilio_number")
        or os.environ.get("TWILIO_PHONE_NUMBER")
    )
    if default_from_number:
        from_number = default_from_number
    else:
        from_number = prompt_phone("Twilio phone number to call from")
    default_to_number = normalize_phone_number(args.to or os.environ.get("TEST_CALL_TRANSFERS_TO_NUMBER"))
    to_number = default_to_number or prompt_phone("Phone number to call for the parked caller leg")

    staff = get_escalation_staff_for_business(args.business_id)
    receptionist = find_inbound_receptionist_for_business(args.business_id, business.get("user_id"))
    target_number = normalize_phone_number((staff or {}).get("phone"))
    if not staff or not target_number:
        fail("No escalation staff member with a phone number is configured.")
    staff_name = (
        str(staff.get("full_name") or "").strip()
        or " ".join(filter(None, [str(staff.get("first_name") or "").strip(), str(staff.get("last_name") or "").strip()]))
        or "a staff member"
    )
    ok(f"Escalation staff target: {staff_name} at {mask(target_number)}")

    section("Test Plan")
    print(f"1. Twilio will call your test phone: {mask(to_number)}")
    print("2. Answer it and stay on the line.")
    print(f"3. The backend will call escalation staff: {staff_name} at {mask(target_number)}")
    print("4. Staff should hear the whisper prompt and press 1.")
    print("5. Both legs should connect.")
    print("")
    print(f"Twilio from number: {mask(from_number)}")
    print(f"Business id: {business.get('id')}")
    print(f"Public backend: {public_origin}")
    print(f"Whisper voice: {'ElevenLabs receptionist voice' if (receptionist or {}).get('elevenlabs_voice_id') else 'Twilio fallback voice'}")
    if not args.yes and not confirm("Place the live test call now?"):
        fail("Canceled before placing any Twilio call.")

    section("Running")
    print("Creating parked Twilio test call...")

    call = client.calls.create(
        to=to_number,
        from_=from_number,
        twiml=(
            "<Response>"
            "<Say>This is a Nodemere transfer test. Please hold while the warm transfer is tested.</Say>"
            "<Pause length=\"120\"/>"
            "<Say>The test call timed out.</Say>"
            "</Response>"
        ),
    )
    ok(f"Created parked caller leg: {mask(call.sid)}")
    print("Answer that phone now. The script will continue once Twilio reports the call is in progress.")

    status = wait_for_call_status(client, call.sid, {"in-progress"}, args.answer_timeout, label="Caller leg")
    if status != "in-progress":
        fail(f"Test call never became in-progress; final status was {status}.")

    transfer_id = str(uuid4())
    transfer = {
        "id": transfer_id,
        "business_id": business.get("id"),
        "user_id": business.get("user_id"),
        "receptionist_id": (receptionist or {}).get("id"),
        "receptionist_name": (
            str((receptionist or {}).get("full_name") or "").strip()
            or str((receptionist or {}).get("first_name") or "").strip()
            or "the receptionist"
        ),
        "receptionist_voice_id": (receptionist or {}).get("elevenlabs_voice_id"),
        "twilio_call_sid": call.sid,
        "target_number": target_number,
        "staff_id": str(staff.get("id") or ""),
        "staff_name": staff_name,
        "caller_name": args.caller_name,
        "reason": args.reason,
        "status": "requested",
        "requested_at": datetime.now(timezone.utc).isoformat(),
        "debug_events": [
            {
                "at": datetime.now(timezone.utc).isoformat(),
                "event": "terminal_harness_created",
                "fields": transfer_debug_fields(
                    business_id=business.get("id"),
                    call_sid=call.sid,
                    target_number=target_number,
                ),
            }
        ],
    }
    call_log_id = create_test_call_log(
        db,
        business=business,
        call_sid=call.sid,
        from_number=from_number,
        to_number=to_number,
        transfer=transfer,
    )
    ok(f"Created test call log: {call_log_id}")

    if transfer.get("receptionist_voice_id"):
        print("Preparing ElevenLabs whisper audio before staff phone rings...")
        play_url = prepare_escalation_whisper_audio(transfer_id, transfer)
        if play_url:
            ok("Prepared ElevenLabs whisper audio.")
        else:
            warn("Could not prepare ElevenLabs whisper audio. The transfer will fall back if needed.")

    redirect_url = escalation_transfer_webhook_url(transfer_id, "dial")
    print("Redirecting parked call to warm transfer...")
    client.calls(call.sid).update(url=redirect_url, method="POST")
    ok("Redirect sent. Answer the staff phone and press 1 when prompted.")

    final_status = wait_for_call_status(
        client,
        call.sid,
        FINAL_CALL_STATUSES,
        args.transfer_timeout,
        label="Caller leg after redirect",
    )

    rows = db.table("call_logs").select("raw_payload").eq("id", call_log_id).limit(1).execute().data or []
    raw_payload = rows[0].get("raw_payload") if rows and isinstance(rows[0].get("raw_payload"), dict) else {}
    saved_transfer = raw_payload.get("escalation_transfer") if isinstance(raw_payload, dict) else {}

    section("Result")
    transfer_status = saved_transfer.get("status")
    failure_reason = saved_transfer.get("failure_reason")
    print(f"Caller leg final status: {final_status}")
    print(f"Transfer status: {transfer_status or 'unknown'}")
    print(f"Failure reason: {failure_reason or 'none recorded'}")

    if transfer_status == "connected":
        ok("The backend marked the warm transfer as connected.")
    elif transfer_status in {"staff_declined", "staff_unavailable", "failed"} or failure_reason:
        warn("The backend recorded a transfer problem. The debug trail below is the useful part.")
    else:
        warn("The transfer did not reach a clear connected state before the script stopped waiting.")

    print("\nDebug events:")
    for event in saved_transfer.get("debug_events") or []:
        print(f"  - {event.get('event')}: {event.get('fields')}")

    print("\nCall log id:")
    print(f"  {call_log_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--to", default="", help="Phone number to receive the parked test call. If omitted, you will be prompted.")
    parser.add_argument("--business-id", type=int, default=1, help="Business id to use for escalation staff lookup.")
    parser.add_argument("--from-number", default="", help="Twilio number to call from. Defaults to business.twilio_number/TWILIO_PHONE_NUMBER.")
    parser.add_argument("--caller-name", default="Terminal test caller", help="Caller name used in the staff whisper.")
    parser.add_argument("--reason", default="Testing the warm transfer flow from the terminal.", help="Reason used in the staff whisper.")
    parser.add_argument("--answer-timeout", type=int, default=60, help="Seconds to wait for the parked test call to be answered.")
    parser.add_argument("--transfer-timeout", type=int, default=120, help="Seconds to wait after redirecting into warm transfer.")
    parser.add_argument("--yes", action="store_true", help="Skip the final confirmation prompt.")
    run(parser.parse_args())


if __name__ == "__main__":
    main()
