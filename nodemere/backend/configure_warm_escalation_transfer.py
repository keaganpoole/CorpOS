"""Safely switch the live inbound agent between native and Twilio warm transfers.

Run this only after the backend deployment has TWILIO_WARM_ESCALATIONS_ENABLED=true.
The tool itself is retained on revert so a later re-enable does not need to create
another provider resource.
"""

import argparse
import copy
import os
from urllib.parse import urlsplit, urlunsplit

import requests

from backend.env_loader import load_project_env


API_BASE = "https://api.elevenlabs.io/v1/convai"
TOOL_NAME = "warm_escalation_transfer"


def provider_json(response: requests.Response) -> dict:
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise RuntimeError("ElevenLabs returned an unexpected response.")
    return payload


def backend_origin() -> str:
    candidate = os.environ.get("BACKEND_PUBLIC_URL") or os.environ.get("TWILIO_VOICE_WEBHOOK_URL")
    parts = urlsplit(candidate or "")
    if parts.scheme != "https" or not parts.netloc:
        raise RuntimeError("BACKEND_PUBLIC_URL or TWILIO_VOICE_WEBHOOK_URL must be an HTTPS URL.")
    return urlunsplit((parts.scheme, parts.netloc, "", "", "")).rstrip("/")


def live_branch_id(session: requests.Session, agent_id: str) -> str:
    branches = provider_json(session.get(f"{API_BASE}/agents/{agent_id}/branches", timeout=30)).get("results") or []
    live = [branch for branch in branches if float(branch.get("current_live_percentage") or 0) == 100]
    if len(live) != 1:
        raise RuntimeError("Expected exactly one 100% live inbound-agent branch.")
    return str(live[0]["id"])


def branch_config(session: requests.Session, agent_id: str, branch_id: str) -> dict:
    return provider_json(session.get(f"{API_BASE}/agents/{agent_id}", params={"branch_id": branch_id}, timeout=30))


def existing_webhook_headers(config: dict) -> dict:
    tools = (((config.get("conversation_config") or {}).get("agent") or {}).get("prompt") or {}).get("tools") or []
    for tool in tools:
        schema = tool.get("api_schema") or {}
        headers = schema.get("request_headers")
        if tool.get("type") == "webhook" and isinstance(headers, dict):
            secret = headers.get("x-nodemere-internal-secret")
            context = headers.get("x-nodemere-context")
            if secret and context:
                return {
                    "x-nodemere-internal-secret": copy.deepcopy(secret),
                    "x-nodemere-context": copy.deepcopy(context),
                }
    raise RuntimeError("Could not find the existing Nodemere webhook authorization headers.")


def warm_transfer_tool(origin: str, headers: dict) -> dict:
    return {
        "type": "webhook",
        "name": TOOL_NAME,
        "description": (
            "Start a warm escalation transfer to the one staff member configured for escalations. "
            "Use only when the caller explicitly requests a human, needs human judgment, or has an issue "
            "the receptionist cannot resolve. Briefly tell the caller you are connecting them, then call this "
            "tool. Provide a concise reason for the staff member. Never include passwords, payment card details, "
            "or other secrets."
        ),
        "response_timeout_secs": 20,
        "interruption_mode": "allow",
        "tool_error_handling_mode": "auto",
        "execution_mode": "immediate",
        "api_schema": {
            "kind": "webhook",
            "url": f"{origin}/api/tools/transfer-call",
            "method": "POST",
            "path_params_schema": {},
            "query_params_schema": None,
            "content_type": "application/json",
            "request_headers": headers,
            "request_body_schema": {
                "type": "object",
                "description": "Context for the Twilio-controlled warm escalation.",
                "required": [],
                "properties": {
                    "twilio_call_sid": {
                        "type": "string",
                        "description": "",
                        "dynamic_variable": "twilio_call_sid",
                        "is_system_provided": False,
                        "is_omitted": False,
                    },
                    "customer_name": {
                        "type": "string",
                        "description": "",
                        "dynamic_variable": "customer_name",
                        "is_system_provided": False,
                        "is_omitted": False,
                    },
                    "reason": {
                        "type": "string",
                        "description": "A short, staff-facing reason for the escalation. Do not include passwords, payment details, or other secrets.",
                        "is_system_provided": False,
                        "is_omitted": False,
                    },
                },
            },
        },
    }


def find_or_create_tool(session: requests.Session, origin: str, headers: dict) -> str:
    listed = provider_json(session.get(f"{API_BASE}/tools", params={"page_size": 100}, timeout=30)).get("tools") or []
    for tool in listed:
        if (tool.get("tool_config") or {}).get("name") == TOOL_NAME:
            return str(tool["id"])
    created = provider_json(session.post(f"{API_BASE}/tools", json={"tool_config": warm_transfer_tool(origin, headers)}, timeout=30))
    return str(created["id"])


def native_transfer_tool() -> dict:
    return {
        "type": "system",
        "name": "transfer_to_number",
        "description": "Transfer the conversation to a human agent when appropriate.",
        "params": {
            "system_tool_type": "transfer_to_number",
            "transfers": [{
                "transfer_destination": {"type": "phone_dynamic_variable", "phone_number": "escalations_phone_number"},
                "transfer_type": "conference",
                "condition": "Use this when the caller needs to be escalated to a human.",
            }],
        },
        "interruption_mode": "allow",
        "tool_error_handling_mode": "auto",
    }


def configure(*, apply: bool) -> None:
    load_project_env()
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    agent_id = os.environ.get("ELEVENLABS_AGENT_ID_INBOUND")
    if not api_key or not agent_id:
        raise RuntimeError("ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID_INBOUND are required.")

    session = requests.Session()
    session.headers.update({"xi-api-key": api_key, "Content-Type": "application/json"})
    branch_id = live_branch_id(session, agent_id)
    current = branch_config(session, agent_id, branch_id)
    conversation = copy.deepcopy(current["conversation_config"])
    prompt = conversation["agent"]["prompt"]
    prompt.pop("tools", None)
    tool_ids = list(prompt.get("tool_ids") or [])
    built_in = copy.deepcopy(prompt.get("built_in_tools") or {})

    if apply:
        tool_id = find_or_create_tool(session, backend_origin(), existing_webhook_headers(current))
        if tool_id not in tool_ids:
            tool_ids.append(tool_id)
        built_in["transfer_to_number"] = None
        expected_enabled = True
    else:
        matching = [tool for tool in provider_json(session.get(f"{API_BASE}/tools", params={"page_size": 100}, timeout=30)).get("tools") or [] if (tool.get("tool_config") or {}).get("name") == TOOL_NAME]
        tool_ids = [tool_id for tool_id in tool_ids if tool_id not in {str(tool["id"]) for tool in matching}]
        built_in["transfer_to_number"] = native_transfer_tool()
        expected_enabled = False

    prompt["tool_ids"] = tool_ids
    prompt["built_in_tools"] = built_in
    provider_json(session.patch(
        f"{API_BASE}/agents/{agent_id}",
        params={"branch_id": branch_id},
        json={"conversation_config": conversation},
        timeout=30,
    ))
    checked_prompt = (((branch_config(session, agent_id, branch_id).get("conversation_config") or {}).get("agent") or {}).get("prompt") or {})
    native_enabled = (checked_prompt.get("built_in_tools") or {}).get("transfer_to_number") is not None
    names = [tool.get("name") for tool in (checked_prompt.get("tools") or [])]
    warm_enabled = TOOL_NAME in names
    if native_enabled == expected_enabled or warm_enabled != expected_enabled:
        raise RuntimeError("ElevenLabs readback did not match the requested transfer configuration.")
    print("Verified warm escalation transfer is " + ("enabled." if apply else "disabled."))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--apply", action="store_true", help="Enable the Twilio-controlled warm escalation tool.")
    selection.add_argument("--revert", action="store_true", help="Restore ElevenLabs native transfer-to-number.")
    arguments = parser.parse_args()
    configure(apply=arguments.apply)
