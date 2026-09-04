"""Attach the local backend secret to existing ElevenLabs DEVELOPMENT tools.

Read-only by default. --apply changes only authentication/context headers on tools
whose URL matches the explicitly supplied HTTPS ngrok development origin.
Never prints secret values. Does not modify agents, prompts or workflows.
"""

import argparse
import copy
import hashlib
import os
from urllib.parse import urlsplit

import requests

from backend.env_loader import load_project_env

API = "https://api.elevenlabs.io/v1/convai"
HEADER = "x-nodemere-internal-secret"


def collect_tool_ids(value):
    result = set()
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "tool_ids" and isinstance(child, list):
                result.update(item for item in child if isinstance(item, str))
            elif key == "tool_id" and isinstance(child, str):
                result.add(child)
            result.update(collect_tool_ids(child))
    elif isinstance(value, list):
        for child in value:
            result.update(collect_tool_ids(child))
    return result


def configure(origin, *, apply=False):
    parsed = urlsplit(origin)
    if (parsed.scheme != "https" or not parsed.hostname
            or not parsed.hostname.endswith((".ngrok-free.dev", ".ngrok-free.app"))
            or parsed.path not in {"", "/"} or parsed.query or parsed.fragment
            or parsed.username or parsed.password or parsed.port):
        raise ValueError("An explicit HTTPS ngrok development origin is required")
    origin = origin.rstrip("/")
    load_project_env()
    secret = os.environ.get("NODEMERE_INTERNAL_TOOL_SECRET", "")
    api_key = os.environ.get("ELEVENLABS_API_KEY", "")
    if len(secret) < 32 or not api_key:
        raise ValueError("Configure a strong local internal-tool secret and ElevenLabs API key first")
    session = requests.Session()
    session.headers["xi-api-key"] = api_key

    def call(method, path, **kwargs):
        response = session.request(method, API + path, timeout=30, **kwargs)
        if not response.ok:
            # Provider error bodies could echo credentials or other private data.
            raise RuntimeError(f"ElevenLabs {method} failed with status {response.status_code}")
        return response.json()

    tool_ids = set()
    for direction in ("INBOUND", "OUTBOUND"):
        agent_id = os.environ.get("ELEVENLABS_AGENT_ID_" + direction)
        if agent_id:
            tool_ids.update(collect_tool_ids(call("GET", "/agents/" + agent_id)))
    targets = []
    for tool_id in sorted(tool_ids):
        tool = call("GET", "/tools/" + tool_id)
        config = tool["tool_config"]
        schema = config.get("api_schema") or {}
        target = urlsplit(schema.get("url", ""))
        if (target.scheme + "://" + target.netloc == origin
                and target.path.startswith(("/api/tools/", "/api/call/", "/api/scenarios/"))):
            targets.append(tool)
    print(f"Development tools matching the selected origin: {len(targets)}", flush=True)
    if not apply or not targets:
        for tool in targets:
            print(f"Inspect only: {tool['tool_config']['name']}", flush=True)
        return

    # A distinct name per local key avoids overwriting any unrelated secret.
    secret_name = "NODEMERE_DEV_INTERNAL_TOOLS_" + hashlib.sha256(secret.encode()).hexdigest()[:12]
    secrets = call("GET", "/secrets").get("secrets", [])
    stored = next((item for item in secrets if item.get("name") == secret_name), None)
    if stored is None:
        stored = call("POST", "/secrets", json={"type": "new", "name": secret_name, "value": secret})
    reference = {"secret_id": stored["secret_id"]}
    for tool in targets:
        original = tool["tool_config"]
        updated = copy.deepcopy(original)
        headers = updated["api_schema"].setdefault("request_headers", {})
        # Avoid duplicate case-insensitive header names.
        for key in list(headers):
            if key.lower() in {HEADER, 'x-nodemere-context'}:
                del headers[key]
        headers[HEADER] = reference
        headers["x-nodemere-context"] = {"variable_name": "secret__nodemere_context"}
        if original != updated:
            body = {"tool_config": updated}
            if "response_mocks" in tool:
                body["response_mocks"] = tool["response_mocks"]
            call("PATCH", "/tools/" + tool["id"], json=body)
        verified = call("GET", "/tools/" + tool["id"])
        if verified["tool_config"] != updated or verified.get("response_mocks") != tool.get("response_mocks"):
            raise RuntimeError("Tool readback differed from the requested header-only update")
        print(f"Verified secret header: {original['name']}", flush=True)
    print("Verified all matching development tools; no agent or workflow changes.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--origin", required=True)
    parser.add_argument("--apply", action="store_true")
    arguments = parser.parse_args()
    configure(arguments.origin, apply=arguments.apply)
