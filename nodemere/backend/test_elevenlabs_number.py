import argparse
import json
import os
import sys
from pathlib import Path
from email.utils import parsedate_to_datetime
from typing import Optional

import requests

try:
    from .env_loader import load_project_env
except ImportError:
    from env_loader import load_project_env

# Quick-edit defaults for manual testing.
# Leave TEST_TWILIO_NUMBER as None to automatically use the most recently purchased Twilio number.
TEST_TWILIO_NUMBER = None
TEST_DESTINATION_NUMBER = "12076801233"
TEST_LABEL = "Nodemere Test Number"


def load_env() -> None:
    load_project_env()


def normalize_phone_number(phone_value: Optional[str]) -> Optional[str]:
    if phone_value is None:
        return None
    raw = str(phone_value).strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return None
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if len(digits) == 10:
        return f"+1{digits}"
    if raw.startswith("+"):
        return raw
    return f"+{digits}"


def elevenlabs_headers(api_key: str) -> dict:
    return {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
    }


def find_elevenlabs_phone_number(api_key: str, phone_number: str) -> Optional[dict]:
    normalized = normalize_phone_number(phone_number)
    response = requests.get(
        "https://api.elevenlabs.io/v1/convai/phone-numbers",
        headers=elevenlabs_headers(api_key),
        timeout=30,
    )
    response.raise_for_status()
    for item in response.json() or []:
        if normalize_phone_number(item.get("phone_number")) == normalized:
            return item
    return None


def import_phone_number(api_key: str, phone_number: str, label: str, account_sid: str, auth_token: str) -> str:
    response = requests.post(
        "https://api.elevenlabs.io/v1/convai/phone-numbers",
        headers=elevenlabs_headers(api_key),
        json={
            "provider": "twilio",
            "label": label,
            "phone_number": phone_number,
            "sid": account_sid,
            "token": auth_token,
        },
        timeout=60,
    )
    response.raise_for_status()
    payload = response.json() or {}
    phone_number_id = payload.get("phone_number_id")
    if not phone_number_id:
        raise RuntimeError(f"ElevenLabs import succeeded but no phone_number_id was returned: {payload}")
    return str(phone_number_id)


def assign_inbound_agent(api_key: str, phone_number_id: str, inbound_agent_id: str) -> None:
    response = requests.patch(
        f"https://api.elevenlabs.io/v1/convai/phone-numbers/{phone_number_id}",
        headers=elevenlabs_headers(api_key),
        json={"agent_id": inbound_agent_id},
        timeout=60,
    )
    response.raise_for_status()


def get_latest_twilio_number(account_sid: str, auth_token: str) -> tuple[str, dict]:
    response = requests.get(
        f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/IncomingPhoneNumbers.json",
        auth=(account_sid, auth_token),
        params={"PageSize": 100},
        timeout=30,
    )
    response.raise_for_status()
    numbers = (response.json() or {}).get("incoming_phone_numbers") or []
    if not numbers:
        raise RuntimeError("No Twilio incoming phone numbers were found on this account.")

    latest = max(
        numbers,
        key=lambda item: parsedate_to_datetime(item.get("date_created")) if item.get("date_created") else parsedate_to_datetime("Thu, 01 Jan 1970 00:00:00 +0000"),
    )
    phone_number = normalize_phone_number(latest.get("phone_number"))
    if not phone_number:
        raise RuntimeError(f"Latest Twilio number record did not include a usable phone number: {latest}")
    return phone_number, latest


def release_twilio_number(account_sid: str, auth_token: str, incoming_phone_number_sid: str) -> None:
    response = requests.delete(
        f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/IncomingPhoneNumbers/{incoming_phone_number_sid}.json",
        auth=(account_sid, auth_token),
        timeout=30,
    )
    response.raise_for_status()


def place_outbound_call(
    api_key: str,
    outbound_agent_id: str,
    phone_number_id: str,
    to_number: str,
    label: str,
) -> dict:
    response = requests.post(
        "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
        headers=elevenlabs_headers(api_key),
        json={
            "agent_id": outbound_agent_id,
            "agent_phone_number_id": phone_number_id,
            "to_number": to_number,
            "conversation_initiation_client_data": {
                "dynamic_variables": {
                    "company_name": label,
                    "direction": "outgoing",
                    "mission": "Outbound deliverability test",
                    "collection_required_fields": False,
                    "collection_service_id": False,
                    "collection_date": False,
                    "collection_time": False,
                    "collection_person_id": False,
                    "appointment_ready_to_create": False,
                },
            },
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json() or {}


def run_once(args) -> int:
    load_env()

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    inbound_agent_id = os.environ.get("ELEVENLABS_AGENT_ID_INBOUND")
    outbound_agent_id = os.environ.get("ELEVENLABS_AGENT_ID_OUTBOUND")
    twilio_account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    twilio_auth_token = os.environ.get("TWILIO_AUTH_TOKEN")

    missing = [
        name
        for name, value in [
            ("ELEVENLABS_API_KEY", api_key),
            ("ELEVENLABS_AGENT_ID_INBOUND", inbound_agent_id),
            ("ELEVENLABS_AGENT_ID_OUTBOUND", outbound_agent_id),
            ("TWILIO_ACCOUNT_SID", twilio_account_sid),
            ("TWILIO_AUTH_TOKEN", twilio_auth_token),
        ]
        if not value
    ]
    if missing:
        print(f"Missing required environment variables: {', '.join(missing)}", file=sys.stderr)
        return 1

    twilio_number_input = args.twilio_number or TEST_TWILIO_NUMBER
    destination_number = normalize_phone_number(args.to or TEST_DESTINATION_NUMBER)
    if not destination_number:
        print("Set TEST_DESTINATION_NUMBER at the top of the script or pass --to.", file=sys.stderr)
        return 1

    if twilio_number_input:
        twilio_number = normalize_phone_number(twilio_number_input)
        if not twilio_number:
            print("TEST_TWILIO_NUMBER or --twilio-number must be a valid phone number.", file=sys.stderr)
            return 1
        print(f"Using provided Twilio number: {twilio_number}")
        latest_record = None
    else:
        print("No Twilio number provided. Looking up the most recently purchased number ...")
        twilio_number, latest_record = get_latest_twilio_number(twilio_account_sid, twilio_auth_token)
        print(f"Using latest Twilio number: {twilio_number}")
        print(f"Twilio SID: {latest_record.get('sid')}")

    print(f"Checking ElevenLabs import for {twilio_number} ...")
    existing = find_elevenlabs_phone_number(api_key, twilio_number)
    phone_number_id = existing.get("phone_number_id") if existing else None

    if phone_number_id:
        print(f"Found existing ElevenLabs phone_number_id: {phone_number_id}")
    else:
        print("Number not imported yet. Importing now ...")
        phone_number_id = import_phone_number(
            api_key,
            twilio_number,
            args.label,
            twilio_account_sid,
            twilio_auth_token,
        )
        print(f"Imported successfully: {phone_number_id}")

    print("Assigning inbound agent ...")
    assign_inbound_agent(api_key, phone_number_id, inbound_agent_id)
    print(f"Inbound agent assigned: {inbound_agent_id}")

    if args.skip_call:
        print("Skipping outbound call as requested.")
        return 0

    print(f"Placing outbound test call to {destination_number} ...")
    result = place_outbound_call(
        api_key,
        outbound_agent_id,
        phone_number_id,
        destination_number,
        args.label,
    )
    print("Outbound call request accepted:")
    print(json.dumps(result, indent=2))

    print("\nWhat do you want to do with this number?")
    print("  [k] keep it")
    print("  [r] release it")
    choice = input("Choice: ").strip().lower()

    if choice == "r":
        release_sid = (latest_record or {}).get("sid")
        if not release_sid:
            print("This run did not use an auto-selected latest number, so there is no Twilio SID to release automatically.")
        else:
            print(f"Releasing {twilio_number} ...")
            release_twilio_number(twilio_account_sid, twilio_auth_token, release_sid)
            print("Number released.")
    else:
        print("Keeping number.")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a Twilio number into ElevenLabs and place a test outbound call.")
    parser.add_argument("--twilio-number", help="The Twilio number to test, for example +12074174801. If omitted, the most recently purchased Twilio number is used.")
    parser.add_argument("--to", help="The destination phone number to call, for example +12075550123")
    parser.add_argument("--label", default=TEST_LABEL, help="Label to use when importing the number into ElevenLabs")
    parser.add_argument("--skip-call", action="store_true", help="Only import/assign the number; do not place the outbound call")
    args = parser.parse_args()

    while True:
        exit_code = run_once(args)
        if exit_code != 0:
            return exit_code
        restart = input("\nPress Enter to test the next number, or type q to quit: ").strip().lower()
        if restart == "q":
            return 0


if __name__ == "__main__":
    raise SystemExit(main())
