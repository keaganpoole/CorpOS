"""Render and sync per-business Intercom facts without duplicating their source data."""

from __future__ import annotations

import logging
from threading import Lock
from datetime import datetime, timezone
from pathlib import Path

import requests


TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "NODEMERE_KNOWLEDGE_BASE" / "01_BUSINESS_INFORMATION"
GENERAL_DIR = TEMPLATE_DIR.parent
GENERAL_FOLDERS = ("04_CONVERSATION_REFERENCE", "05_ERROR_AND_RECOVERY", "06_PERSONALITY_EXPRESSION")
DOCUMENT_TYPES = ("policies", "services", "staff", "about", "faq", "hours")
SERVICE_FIELDS = "name,description,price_type,price_min,price_max,unit,category,is_active,sort_order"
STAFF_FIELDS = "full_name,first_name,last_name,role,is_active,knowledge"
SHARED_PREFIXES = ("Nodemere — 04_", "Nodemere — 05_", "Nodemere — 06_")
ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/convai"
_general_cache_lock = Lock()
_general_cache: tuple[str, str, list[dict]] | None = None
_business_id_lock = Lock()
_validated_business_ids: set[str] = set()


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


def live_branch_configuration(api_key: str, agent_id: str, http=requests) -> tuple[str, dict]:
    headers = {"xi-api-key": api_key}
    branches = _provider_json(http.get(f"{ELEVENLABS_BASE}/agents/{agent_id}/branches", headers=headers, timeout=10)).get("results") or []
    live = [row for row in branches if float(row.get("current_live_percentage") or 0) == 100]
    if len(live) != 1:
        raise ValueError("Intercom must have one fully live ElevenLabs branch for a complete KB override")
    branch_id = live[0]["id"]
    config = _provider_json(http.get(f"{ELEVENLABS_BASE}/agents/{agent_id}", headers=headers, params={"branch_id": branch_id}, timeout=10))
    allowed = (((config.get("platform_settings") or {}).get("overrides") or {}).get("conversation_config_override") or {}).get("agent", {}).get("prompt", {}).get("knowledge_base")
    if allowed is not True:
        raise ValueError("The live Intercom branch does not allow KB overrides")
    return branch_id, config


def active_shared_documents(api_key: str, agent_id: str, http=requests) -> tuple[str, list[dict]]:
    branch_id, config = live_branch_configuration(api_key, agent_id, http=http)
    prompt = (config.get("conversation_config") or {}).get("agent", {}).get("prompt", {})
    attached = prompt.get("knowledge_base") or []
    shared = [dict(row) for row in attached if _text(row.get("name")).startswith(SHARED_PREFIXES) and row.get("id")]
    if not shared:
        raise ValueError("The live Intercom branch has no shared Nodemere documents")
    return branch_id, shared


def ensure_general_prompt_mode(api_key: str, agent_id: str, branch_id: str, document_ids: set[str], config: dict, http=requests) -> None:
    """Make the branch attachment settings match the per-call prompt override."""
    conversation = dict(config.get("conversation_config") or {})
    agent = dict(conversation.get("agent") or {})
    prompt = dict(agent.get("prompt") or {})
    attached = [dict(row) for row in (prompt.get("knowledge_base") or [])]
    changed = False
    for row in attached:
        if row.get("id") in document_ids and row.get("usage_mode") != "prompt":
            row["usage_mode"] = "prompt"
            changed = True
    if not changed:
        return
    prompt["knowledge_base"] = attached
    prompt.pop("tools", None)
    agent["prompt"] = prompt
    conversation["agent"] = agent
    headers = {"xi-api-key": api_key, "Content-Type": "application/json"}
    response = http.patch(
        f"{ELEVENLABS_BASE}/agents/{agent_id}", headers=headers,
        params={"branch_id": branch_id}, json={"conversation_config": conversation}, timeout=20,
    )
    response.raise_for_status()
    checked = _provider_json(http.get(
        f"{ELEVENLABS_BASE}/agents/{agent_id}", headers={"xi-api-key": api_key},
        params={"branch_id": branch_id}, timeout=10,
    ))
    checked_rows = (checked.get("conversation_config") or {}).get("agent", {}).get("prompt", {}).get("knowledge_base") or []
    actual = {row.get("id"): row.get("usage_mode") for row in checked_rows}
    if any(actual.get(document_id) != "prompt" for document_id in document_ids):
        raise ValueError("ElevenLabs branch did not retain prompt mode for general documents")


def cached_general_documents(agent_id: str) -> tuple[str, list[dict]] | None:
    with _general_cache_lock:
        if _general_cache and _general_cache[0] == agent_id:
            return _general_cache[1], [dict(row) for row in _general_cache[2]]
    return None


def sync_general_documents(api_key: str, agent_id: str, http=requests) -> tuple[str, list[dict]]:
    """Make project Markdown authoritative for the general ElevenLabs documents.

    Runs at backend startup, not per call. Existing file IDs are preserved;
    only changed source files are uploaded. The resulting IDs are cached for
    conversation overrides until the next backend restart/deployment.
    """
    global _general_cache
    branch_id, config = live_branch_configuration(api_key, agent_id, http=http)
    branch_documents = (config.get("conversation_config") or {}).get("agent", {}).get("prompt", {}).get("knowledge_base") or []
    attached = [dict(row) for row in branch_documents if _text(row.get("name")).startswith(SHARED_PREFIXES) and row.get("id")]
    # A document already attached to this branch has been validated by
    # ElevenLabs; reuse that evidence instead of making six separate GETs on
    # the first call after every deployment.
    with _business_id_lock:
        _validated_business_ids.update(row["id"] for row in branch_documents if _text(row.get("name")).startswith("Nodemere business ") and row.get("id"))
    by_name = {}
    for row in attached:
        if row["name"] in by_name:
            raise ValueError(f"Duplicate general document attachment: {row['name']}")
        by_name[row["name"]] = row
    paths = [path for folder in GENERAL_FOLDERS for path in sorted((GENERAL_DIR / folder).glob("*.md"))]
    if len(paths) != 15 or len({path.name for path in paths}) != 15:
        raise ValueError(f"Expected 15 distinct general Markdown files, found {len(paths)}")
    references = []
    newly_created = []
    updated_count = 0
    headers = {"xi-api-key": api_key}
    for path in paths:
        name = f"Nodemere — {path.parent.name} — {path.name}"
        existing = by_name.get(name)
        if existing:
            if existing.get("type") != "file":
                raise ValueError(f"General document is not a file: {name}")
            document_id = existing["id"]
            source = _provider_json(http.get(
                f"{ELEVENLABS_BASE}/knowledge-base/{document_id}/source-file-url",
                headers=headers, timeout=15,
            ))
            remote = http.get(source["signed_url"], timeout=15)
            remote.raise_for_status()
            if remote.content != path.read_bytes():
                with path.open("rb") as markdown:
                    updated = _provider_json(http.patch(
                        f"{ELEVENLABS_BASE}/knowledge-base/{document_id}/update-file",
                        headers=headers, files={"file": (path.name, markdown, "text/markdown")}, timeout=30,
                    ))
                if updated.get("id") != document_id:
                    raise ValueError(f"General document ID changed during sync: {name}")
                updated_count += 1
            reference = dict(existing)
            # General speech and behavior guidance must be available on every
            # turn.  Existing documents may have been created as ``auto``;
            # normalize the per-call reference so content updates also switch
            # them to ElevenLabs' always-include-in-prompt mode.
            reference["usage_mode"] = "prompt"
        else:
            with path.open("rb") as markdown:
                created = _provider_json(http.post(
                    f"{ELEVENLABS_BASE}/knowledge-base/file", headers=headers,
                    files={"file": (path.name, markdown, "text/markdown"), "name": (None, name)}, timeout=30,
                ))
            reference = {"type": "file", "name": name, "id": created["id"], "usage_mode": "prompt"}
            newly_created.append(reference)
        references.append(reference)
    if newly_created:
        attach_documents_to_branch(api_key, agent_id, branch_id, newly_created, http=http)
    ensure_general_prompt_mode(api_key, agent_id, branch_id, {row["id"] for row in references}, config, http=http)
    with _general_cache_lock:
        _general_cache = (agent_id, branch_id, [dict(row) for row in references])
    logging.info("intercom_knowledge.general_synced documents=%s created=%s updated=%s", len(references), len(newly_created), updated_count)
    return branch_id, references


def safe_general_override(api_key: str, agent_id: str, http=requests) -> tuple[str, list[dict]]:
    """A safe fallback: only verified general documents, never the branch default."""
    cached = cached_general_documents(agent_id)
    branch_id, config = live_branch_configuration(api_key, agent_id, http=http)
    attached_ids = {row.get("id") for row in (config.get("conversation_config") or {}).get("agent", {}).get("prompt", {}).get("knowledge_base") or []}
    if cached and cached[0] == branch_id and all(row["id"] in attached_ids for row in cached[1]):
        return cached
    return sync_general_documents(api_key, agent_id, http=http)


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
        if old_id:
            with _business_id_lock:
                already_valid = old_id in _validated_business_ids
            if not already_valid:
                check = http.get(f"{ELEVENLABS_BASE}/knowledge-base/{old_id}", headers=headers, timeout=10)
                if check.status_code == 404:
                    old_id = None
                else:
                    check.raise_for_status()
                    with _business_id_lock:
                        _validated_business_ids.add(old_id)
        if not old_id:
            created = _provider_json(http.post(f"{ELEVENLABS_BASE}/knowledge-base/text", headers=headers, json={"name": name, "text": content}, timeout=20))
            document_id = created["id"]
        elif old.get("content") != content:
            _provider_json(http.patch(f"{ELEVENLABS_BASE}/knowledge-base/{old_id}", headers=headers, json={"name": name, "content": content}, timeout=20))
            document_id = old_id
        else:
            document_id = old_id
        with _business_id_lock:
            _validated_business_ids.add(document_id)
        if not old or old.get("content") != content or not old_id:
            payload = {"business_id": business_id, "document_type": kind, "content": content, "version": int(old.get("version") or 0) + 1 if old else 1, "published": True, "elevenlabs_document_id": document_id, "last_synced_at": datetime.now(timezone.utc).isoformat(), "updated_at": datetime.now(timezone.utc).isoformat()}
            store.table("knowledge_base").upsert(payload, on_conflict="business_id,document_type").execute()
        # Business documents remain retrieval-backed.  General speech and
        # behavior documents are the only always-in-prompt resources.
        references.append({"type": "text", "name": name, "id": document_id, "usage_mode": "auto"})
    return references


def attach_documents_to_branch(api_key: str, agent_id: str, branch_id: str, documents: list[dict], http=requests) -> set[str]:
    """Ensure per-business documents are valid resources for this branch override.

    ElevenLabs rejects an override reference unless the document is attached to
    the selected agent branch. Attachments are additive; the per-call override
    still controls which business documents are actually used for the call.
    """
    if not documents:
        return set()
    headers = {"xi-api-key": api_key}
    current = _provider_json(http.get(
        f"{ELEVENLABS_BASE}/agents/{agent_id}", headers=headers,
        params={"branch_id": branch_id}, timeout=10,
    ))
    conversation = dict(current.get("conversation_config") or {})
    agent = dict(conversation.get("agent") or {})
    prompt = dict(agent.get("prompt") or {})
    attached = list(prompt.get("knowledge_base") or [])
    known = {row.get("id") for row in attached if row.get("id")}
    requested_modes = {document.get("id"): document.get("usage_mode") for document in documents if document.get("id")}
    changed = False
    for row in attached:
        requested_mode = requested_modes.get(row.get("id"))
        if requested_mode and row.get("usage_mode") != requested_mode:
            row["usage_mode"] = requested_mode
            changed = True
    for document in documents:
        if document.get("id") and document["id"] not in known:
            attached.append(document)
            known.add(document["id"])
            changed = True
    if not changed:
        return known
    prompt["knowledge_base"] = attached
    # Agent GET expands tool_ids into tools; the update API rejects both.
    prompt.pop("tools", None)
    agent["prompt"] = prompt
    conversation["agent"] = agent
    response = http.patch(
        f"{ELEVENLABS_BASE}/agents/{agent_id}", headers={**headers, "Content-Type": "application/json"},
        params={"branch_id": branch_id}, json={"conversation_config": conversation}, timeout=20,
    )
    response.raise_for_status()
    checked = _provider_json(http.get(
        f"{ELEVENLABS_BASE}/agents/{agent_id}", headers=headers,
        params={"branch_id": branch_id}, timeout=10,
    ))
    checked_ids = {row.get("id") for row in (checked.get("conversation_config") or {}).get("agent", {}).get("prompt", {}).get("knowledge_base") or []}
    checked_rows = (checked.get("conversation_config") or {}).get("agent", {}).get("prompt", {}).get("knowledge_base") or []
    checked_modes = {row.get("id"): row.get("usage_mode") for row in checked_rows}
    if not {row["id"] for row in documents}.issubset(checked_ids):
        raise ValueError("ElevenLabs branch did not retain the knowledge attachments")
    if any(checked_modes.get(row["id"]) != row.get("usage_mode") for row in documents):
        raise ValueError("ElevenLabs branch did not retain the requested knowledge usage modes")
    return checked_ids


def build_intercom_knowledge(store, business: dict, api_key: str, agent_id: str, http=requests) -> tuple[str, list[dict]]:
    # The migration must run before generated business text is written to the cache.
    if store.rpc("nodemere_intercom_knowledge_ready").execute().data is not True:
        raise ValueError("The private Intercom knowledge cache is not ready")
    branch_id, shared = cached_general_documents(agent_id) or sync_general_documents(api_key, agent_id, http=http)
    business_documents = sync_business_documents(store, business, api_key, http=http)
    if not business_documents:
        raise ValueError("No business knowledge documents are available for this call")
    attached_ids = attach_documents_to_branch(api_key, agent_id, branch_id, business_documents, http=http)
    # A deleted or detached general document would make the call's full
    # override invalid. The fallback path rebuilds general knowledge first.
    if not all(row["id"] in attached_ids for row in shared):
        branch_id, shared = sync_general_documents(api_key, agent_id, http=http)
    logging.info("intercom_knowledge.ready business_id=%s shared=%s business=%s", business["id"], len(shared), len(business_documents))
    return branch_id, shared + business_documents
