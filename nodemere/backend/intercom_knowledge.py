"""Render and sync per-business Intercom facts without duplicating their source data."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

import requests


TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "NODEMERE_KNOWLEDGE_BASE" / "01_BUSINESS_INFORMATION"
DOCUMENT_TYPES = ("policies", "services", "staff", "about", "faq", "hours")
SERVICE_FIELDS = "name,description,price_type,price_min,price_max,unit,category,is_active,sort_order"
STAFF_FIELDS = "full_name,first_name,last_name,role,is_active,knowledge"
SHARED_PREFIXES = ("Nodemere — 04_", "Nodemere — 05_", "Nodemere — 06_")
ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/convai"


def _text(value) -> str:
    return str(value).strip() if value is not None else ""


def _markdown(value) -> str:
    # Source fields may contain prose or JSON. Never invent a prose interpretation.
    if isinstance(value, (dict, list)):
        import json
        return json.dumps(value, ensure_ascii=False, indent=2)
    return _text(value)


def _price(service: dict) -> str:
    kind = _text(service.get("price_type"))
    minimum, maximum = service.get("price_min"), service.get("price_max")
    unit = _text(service.get("unit"))
    suffix = f" per {unit}" if unit else ""
    if kind == "free":
        return "Free"
    if kind == "quote":
        return "Quote required"
    if minimum is None:
        return ""
    if kind == "range" and maximum is not None:
        return f"${minimum}–${maximum}{suffix}"
    if kind == "starting_at":
        return f"From ${minimum}{suffix}"
    return f"${minimum}{suffix}"


def _services(rows: list[dict]) -> str:
    blocks = []
    for row in sorted(rows, key=lambda item: (_text(item.get("category")), item.get("sort_order") or 0, _text(item.get("name")))):
        if row.get("is_active") is not True or not _text(row.get("name")):
            continue
        lines = [f"## {_text(row['name'])}"]
        for label, value in (("Category", row.get("category")), ("Description", row.get("description")), ("Price", _price(row))):
            if _text(value):
                lines.append(f"{label}: {_text(value)}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _staff(rows: list[dict]) -> str:
    blocks = []
    for row in sorted(rows, key=lambda item: _text(item.get("full_name") or item.get("first_name"))):
        if row.get("is_active") is not True:
            continue
        name = _text(row.get("full_name")) or " ".join(filter(None, [_text(row.get("first_name")), _text(row.get("last_name"))]))
        if not name:
            continue
        lines = [f"## {name}"]
        if _text(row.get("role")):
            lines.append(f"Role: {_text(row['role'])}")
        if _markdown(row.get("knowledge")):
            lines.append(f"Profile: {_markdown(row['knowledge'])}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _clock(value) -> str:
    try:
        minutes = round(float(value) * 60)
        return f"{minutes // 60:02d}:{minutes % 60:02d}"
    except (TypeError, ValueError):
        return _text(value)


def _hours(business: dict) -> str:
    schedule = business.get("business_hours")
    if isinstance(schedule, str):
        import json
        try:
            schedule = json.loads(schedule)
        except ValueError:
            return ""
    if not isinstance(schedule, dict):
        return ""
    days = schedule.get("days") if isinstance(schedule.get("days"), dict) else schedule
    lines = []
    for day in ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"):
        entry = days.get(day) if isinstance(days, dict) else None
        if not isinstance(entry, dict):
            continue
        if entry.get("enabled") is False:
            lines.append(f"{day}: Closed")
            continue
        layer = entry.get("layers", {}).get("business") if isinstance(entry.get("layers"), dict) else entry
        if not isinstance(layer, dict) or layer.get("enabled") is False:
            lines.append(f"{day}: Closed")
            continue
        start = layer.get("start", layer.get("open"))
        end = layer.get("end", layer.get("close"))
        if start is not None and end is not None:
            lines.append(f"{day}: {_clock(start)}–{_clock(end)}")
    if _text(business.get("business_timezone")):
        lines.append(f"Time zone: {_text(business['business_timezone'])}")
    return "\n".join(lines)


def _about(business: dict) -> str:
    lines = []
    if _text(business.get("about_us")):
        lines.append(_text(business["about_us"]))
    for label, value in (("Phone", business.get("phone")), ("Email", business.get("email")), ("Website", business.get("website"))):
        if _text(value):
            lines.append(f"{label}: {_text(value)}")
    address = ", ".join(filter(None, [_text(business.get("address")), _text(business.get("city")), _text(business.get("state")), _text(business.get("zip"))]))
    if address:
        lines.append(f"Address: {address}")
    return "\n\n".join(lines)


def render_documents(business: dict, services: list[dict], staff: list[dict]) -> dict[str, str]:
    name = _text(business.get("name")) or "This business"
    sections = {
        "policies": _markdown(business.get("policies")),
        "services": _services(services),
        "staff": _staff(staff),
        "about": _about(business),
        "faq": _markdown(business.get("faq")),
        "hours": _hours(business),
    }
    result = {}
    for kind, section in sections.items():
        if not section:
            result[kind] = ""
            continue
        template = (TEMPLATE_DIR / f"{kind}.md").read_text(encoding="utf-8")
        result[kind] = template.replace("{{business_name}}", name).replace(f"{{{{{kind}}}}}", section).strip()
    return result


def _provider_json(response):
    response.raise_for_status()
    return response.json()


def active_shared_documents(api_key: str, agent_id: str, http=requests) -> tuple[str, list[dict]]:
    headers = {"xi-api-key": api_key}
    branches = _provider_json(http.get(f"{ELEVENLABS_BASE}/agents/{agent_id}/branches", headers=headers, timeout=10)).get("results") or []
    live = [row for row in branches if float(row.get("current_live_percentage") or 0) == 100]
    if len(live) != 1:
        raise ValueError("Intercom must have one fully live ElevenLabs branch for a complete KB override")
    branch_id = live[0]["id"]
    config = _provider_json(http.get(f"{ELEVENLABS_BASE}/agents/{agent_id}", headers=headers, params={"branch_id": branch_id}, timeout=10))
    prompt = (config.get("conversation_config") or {}).get("agent", {}).get("prompt", {})
    attached = prompt.get("knowledge_base") or []
    shared = [dict(row) for row in attached if _text(row.get("name")).startswith(SHARED_PREFIXES) and row.get("id")]
    if not shared:
        raise ValueError("The live Intercom branch has no shared Nodemere documents")
    allowed = (((config.get("platform_settings") or {}).get("overrides") or {}).get("conversation_config_override") or {}).get("agent", {}).get("prompt", {}).get("knowledge_base")
    if allowed is not True:
        raise ValueError("The live Intercom branch does not allow KB overrides")
    return branch_id, shared


def sync_business_documents(store, business: dict, api_key: str, http=requests) -> list[dict]:
    business_id = business["id"]
    services = (store.table("services").select(SERVICE_FIELDS).eq("business_id", business_id).limit(1000).execute().data or [])
    staff = (store.table("staff").select(STAFF_FIELDS).eq("business_id", business_id).limit(200).execute().data or [])
    content_by_type = render_documents(business, services, staff)
    rows = store.table("knowledge_base").select("*").eq("business_id", business_id).execute().data or []
    existing = {row["document_type"]: row for row in rows if row.get("document_type") in DOCUMENT_TYPES}
    references = []
    headers = {"xi-api-key": api_key, "Content-Type": "application/json"}
    for kind, content in content_by_type.items():
        old = existing.get(kind) or {}
        if old.get("published") is False:
            continue
        old_id = old.get("elevenlabs_document_id")
        if not content:
            # An empty source must not expose an old document in this call.
            if old and old.get("content"):
                store.table("knowledge_base").update({"content": "", "version": int(old.get("version") or 0) + 1, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", old["id"]).eq("business_id", business_id).execute()
            continue
        name = f"Nodemere business {business_id} — {kind}.md"
        if not old_id:
            created = _provider_json(http.post(f"{ELEVENLABS_BASE}/knowledge-base/text", headers=headers, json={"name": name, "text": content}, timeout=20))
            document_id = created["id"]
        elif old.get("content") != content:
            _provider_json(http.patch(f"{ELEVENLABS_BASE}/knowledge-base/{old_id}", headers=headers, json={"name": name, "content": content}, timeout=20))
            document_id = old_id
        else:
            document_id = old_id
        if not old or old.get("content") != content or not old_id:
            payload = {"business_id": business_id, "document_type": kind, "content": content, "version": int(old.get("version") or 0) + 1 if old else 1, "published": True, "elevenlabs_document_id": document_id, "last_synced_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}
            store.table("knowledge_base").upsert(payload, on_conflict="business_id,document_type").execute()
        references.append({"type": "text", "name": name, "id": document_id, "usage_mode": "prompt" if len(content) <= 10000 else "auto"})
    return references


def build_intercom_knowledge(store, business: dict, api_key: str, agent_id: str, http=requests) -> tuple[str, list[dict]]:
    # The migration must run before generated business text is written to the cache.
    if store.rpc("nodemere_intercom_knowledge_ready").execute().data is not True:
        raise ValueError("The private Intercom knowledge cache is not ready")
    branch_id, shared = active_shared_documents(api_key, agent_id, http=http)
    business_documents = sync_business_documents(store, business, api_key, http=http)
    if not business_documents:
        raise ValueError("No business knowledge documents are available for this call")
    logging.info("intercom_knowledge.ready business_id=%s shared=%s business=%s", business["id"], len(shared), len(business_documents))
    return branch_id, shared + business_documents
