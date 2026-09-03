"""Tenant-scoped normalization for the Nest dashboard activity surface.

Nest history is derived from existing source-of-truth tables. Live delivery remains
Supabase Realtime in the browser, so this module adds no poller or duplicate event
ledger while still giving users a small, durable cross-device history.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Iterable


TERMINAL_CALL_STATUSES = {
    "completed",
    "failed",
    "missed",
    "busy",
    "no-answer",
    "no_answer",
    "canceled",
    "cancelled",
}
SUCCESS_PAYMENT_STATUSES = {"paid", "succeeded", "successful", "complete", "completed"}
FAILED_PAYMENT_STATUSES = {"failed", "declined", "canceled", "cancelled"}
NEST_TABLE = "nest"

# These are intentionally stable business-level keys. They are the durable
# de-duplication boundary for milestones across browsers and devices.
MILESTONE_KEYS = {
    "first_receptionist_hired",
    "first_staff_member_added",
    "first_call_received",
    "first_successful_call",
    "first_receptionist_booking",
    "first_person_added",
    "first_appointment_booked",
    "first_appointment_completed",
    "first_successful_payment",
    "first_invoice_paid",
    "first_repeat_customer",
    "first_automated_booking",
    "first_automated_follow_up",
    "business_setup_completed",
}


def _text(value: Any) -> str:
    return str(value or "").strip()


def _status(row: dict) -> str:
    raw = _text(row.get("status") or row.get("call_status") or row.get("call_successful")).lower()
    if raw in {"true", "yes", "success", "successful", "done", "complete"}:
        return "completed"
    if raw in {"false", "no"}:
        return "failed"
    if not raw and (row.get("failure_reason") or row.get("error") or row.get("error_message")):
        return "failed"
    if not raw and row.get("ended_at"):
        return "completed"
    return raw


def _occurred_at(row: dict, *keys: str) -> str:
    for key in (*keys, "updated_at", "created_at"):
        value = row.get(key)
        if value:
            return str(value)
    return datetime.now(timezone.utc).isoformat()


def _event(
    *,
    source: str,
    row: dict,
    category: str,
    event_type: str,
    title: str,
    message: str = "",
    priority: str = "routine",
    occurred_at: str | None = None,
    payload: dict | None = None,
) -> dict:
    row_id = _text(row.get("id")) or "unknown"
    stamp = occurred_at or _occurred_at(row)
    return {
        "id": f"{source}:{row_id}:{event_type}:{stamp}",
        "source": source,
        "source_id": row_id,
        "category": category,
        "event_type": event_type,
        "priority": priority,
        "title": title,
        "message": message,
        "occurred_at": stamp,
        "payload": payload or {},
    }


def _safe_rows(
    client: Any,
    table: str,
    *,
    filters: Iterable[tuple[str, Any]],
    order_by: str = "created_at",
    limit: int = 20,
    quiet: bool = False,
) -> list[dict]:
    try:
        query = client.table(table).select("*")
        for field, value in filters:
            if value is not None:
                query = query.eq(field, value)
        response = query.order(order_by, desc=True).limit(limit).execute()
        return response.data or []
    except Exception as exc:  # Some installations do not have every optional table/column.
        if not quiet:
            logging.warning("Nest history skipped %s: %s", table, exc)
        return []


def _call_events(rows: list[dict]) -> list[dict]:
    events = []
    for row in rows:
        status = _status(row)
        if status not in TERMINAL_CALL_STATUSES:
            continue
        direction = _text(row.get("direction") or row.get("call_direction") or "incoming").lower()
        caller = _text(row.get("caller_name") or row.get("contact_name"))
        duration = row.get("duration_seconds") or 0
        completed = status == "completed" or row.get("call_successful") is True
        if completed:
            title = "Call completed"
            message = caller or ("Outgoing call" if direction.startswith("out") else "Incoming call")
            priority = "routine"
            event_type = "call_completed"
        else:
            title = "Call needs attention" if status == "failed" else "Call missed"
            message = caller or "No caller name available"
            priority = "critical" if status == "failed" else "major"
            event_type = "call_failed" if status == "failed" else "call_missed"
        events.append(_event(
            source="call_logs",
            row=row,
            category="calls",
            event_type=event_type,
            title=title,
            message=message,
            priority=priority,
            occurred_at=_occurred_at(row, "ended_at", "event_timestamp", "started_at"),
            payload={"status": status, "direction": direction, "duration_seconds": duration},
        ))
    return events


def _appointment_events(rows: list[dict]) -> list[dict]:
    events = []
    for row in rows:
        status = _status(row) or "scheduled"
        event_type = {
            "cancelled": "appointment_cancelled",
            "canceled": "appointment_cancelled",
            "completed": "appointment_completed",
            "missed": "appointment_missed",
        }.get(status, "appointment_booked")
        title = {
            "appointment_cancelled": "Appointment cancelled",
            "appointment_completed": "Appointment completed",
            "appointment_missed": "Appointment missed",
            "appointment_booked": "Appointment booked",
        }[event_type]
        message = " · ".join(part for part in (_text(row.get("date")), _text(row.get("time"))) if part)
        events.append(_event(
            source="appointments",
            row=row,
            category="appointments",
            event_type=event_type,
            title=title,
            message=message,
            priority="major" if event_type == "appointment_missed" else "routine",
            payload={"status": status, "date": row.get("date"), "time": row.get("time")},
        ))
    return events


def _people_events(rows: list[dict]) -> list[dict]:
    events = []
    for row in rows:
        name = " ".join(part for part in (_text(row.get("first_name")), _text(row.get("last_name"))) if part)
        events.append(_event(
            source="people",
            row=row,
            category="people",
            event_type="person_added",
            title="New person added",
            message=name,
        ))
    return events


def _receptionist_events(rows: list[dict]) -> list[dict]:
    events = []
    for row in rows:
        events.append(_event(
            source="hired_receptionists",
            row=row,
            category="milestones",
            event_type="receptionist_hired",
            title="Receptionist hired",
            message=_text(row.get("name") or row.get("receptionist_name")),
            priority="routine",
            occurred_at=_occurred_at(row, "hired_at"),
        ))
    return events


def _payment_events(rows: list[dict]) -> list[dict]:
    events = []
    for row in rows:
        status = _status(row)
        if status not in SUCCESS_PAYMENT_STATUSES | FAILED_PAYMENT_STATUSES:
            continue
        succeeded = status in SUCCESS_PAYMENT_STATUSES
        amount = row.get("amount") or row.get("amount_received") or row.get("amount_total")
        events.append(_event(
            source="payments",
            row=row,
            category="payments" if succeeded else "warnings",
            event_type="payment_received" if succeeded else "payment_failed",
            title="Payment received" if succeeded else "Payment failed",
            message="",
            priority="major" if succeeded else "critical",
            payload={"status": status, "amount": amount, "currency": row.get("currency") or "usd"},
        ))
    return events


def _workflow_events(rows: list[dict]) -> list[dict]:
    events = []
    for row in rows:
        status = _status(row)
        if status not in {"completed", "failed"}:
            continue
        flow_context = row.get("flow_context") if isinstance(row.get("flow_context"), dict) else {}
        trigger_event = row.get("trigger_event") if isinstance(row.get("trigger_event"), dict) else {}
        workflow_name = _text(
            row.get("scenario_name")
            or row.get("flow_name")
            or flow_context.get("_scenarioName")
            or trigger_event.get("event_type")
        )
        failed = status == "failed"
        events.append(_event(
            source="flow_executions",
            row=row,
            category="warnings" if failed else "workflows",
            event_type="workflow_failed" if failed else "workflow_completed",
            title="Workflow needs attention" if failed else "Workflow completed",
            message=workflow_name,
            priority="critical" if failed else "routine",
            occurred_at=_occurred_at(row, "completed_at", "started_at"),
            payload={"status": status, "scenario_id": row.get("scenario_id")},
        ))
    return events


def _stored_events(rows: list[dict]) -> list[dict]:
    events = []
    for row in rows:
        events.append({
            "id": _text(row.get("id")) or f"nest:{_text(row.get('idempotency_key'))}",
            "source": NEST_TABLE,
            "source_id": _text(row.get("source_id")),
            "category": _text(row.get("category")) or "workflows",
            "event_type": _text(row.get("event_type")) or "workflow_event",
            "priority": _text(row.get("priority")) or "routine",
            "title": _text(row.get("title")) or "Workflow activity",
            "message": _text(row.get("message")),
            "occurred_at": _occurred_at(row, "occurred_at"),
            "payload": row.get("payload") if isinstance(row.get("payload"), dict) else {},
        })
    return events


def record_nest_event(
    client: Any,
    *,
    business_id: Any,
    user_id: Any,
    category: str,
    event_type: str,
    title: str,
    message: str = "",
    priority: str = "routine",
    payload: dict | None = None,
    source_id: Any = None,
    idempotency_key: str | None = None,
    occurred_at: str | None = None,
) -> None:
    """Persist one normalized server event without allowing Nest failures to affect work."""

    if business_id is None or not user_id:
        return
    occurred_at = occurred_at or datetime.now(timezone.utc).isoformat()
    row = {
        "business_id": business_id,
        "user_id": str(user_id),
        "category": category,
        "event_type": event_type,
        "priority": priority,
        "title": title[:160],
        "message": message[:300],
        "payload": payload or {},
        "source_id": str(source_id) if source_id is not None else None,
        "idempotency_key": idempotency_key or f"{event_type}:{source_id or occurred_at}",
        "occurred_at": occurred_at,
    }
    try:
        client.table(NEST_TABLE).upsert(
            row,
            on_conflict="business_id,idempotency_key",
        ).execute()
    except Exception as exc:
        # Deployments may briefly run application code before the migration lands.
        logging.warning("Nest event persistence skipped: %s", exc)


def record_call_nest_event(client: Any, row: dict) -> None:
    """Persist one terminal call notification directly from the call-log writer."""

    if not isinstance(row, dict):
        return
    status = _status(row)
    if status not in TERMINAL_CALL_STATUSES:
        return
    business_id = row.get("business_id")
    user_id = row.get("user_id")
    if business_id is None or not user_id:
        return
    direction = _text(row.get("direction") or row.get("call_direction") or "incoming").lower()
    caller = _text(row.get("caller_name") or row.get("contact_name"))
    completed = status == "completed"
    event_type = "call_completed" if completed else "call_failed" if status == "failed" else "call_missed"
    title = "Call completed" if completed else "Call needs attention" if status == "failed" else "Call missed"
    priority = "routine" if completed else "critical" if status == "failed" else "major"
    message = caller or ("Outgoing call" if direction.startswith("out") else "Incoming call")
    source_id = row.get("id") or row.get("conversation_id")
    record_nest_event(
        client,
        business_id=business_id,
        user_id=user_id,
        category="calls" if completed else "warnings",
        event_type=event_type,
        title=title,
        message=message,
        priority=priority,
        payload={
            "status": status,
            "direction": direction,
            "duration_seconds": row.get("duration_seconds") or 0,
        },
        source_id=source_id,
        idempotency_key=f"call:{source_id}:{event_type}",
        occurred_at=_occurred_at(row, "ended_at", "event_timestamp", "started_at"),
    )


def claim_nest_milestone(
    client: Any,
    *,
    business_id: Any,
    user_id: Any,
    milestone_key: str,
    title: str,
    message: str = "",
    category: str = "milestones",
    priority: str = "major",
    payload: dict | None = None,
    source_id: Any = None,
) -> bool:
    """Atomically claim a milestone once for a business.

    A plain insert is deliberate: the unique business/idempotency constraint
    is the cross-device lock. A duplicate means another worker or device has
    already claimed the milestone, so it should not be displayed again.
    """

    if business_id is None or not user_id or milestone_key not in MILESTONE_KEYS:
        return False
    row = {
        "business_id": business_id,
        "user_id": str(user_id),
        "category": category,
        "event_type": milestone_key,
        "priority": priority,
        "title": title[:160],
        "message": message[:300],
        "payload": payload or {},
        "source_id": str(source_id) if source_id is not None else None,
        "idempotency_key": f"milestone:{milestone_key}",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        client.table(NEST_TABLE).insert(row).execute()
        return True
    except Exception as exc:
        # PostgreSQL's unique constraint is the expected result for a second
        # device. Treat only duplicate-key failures as an ordinary miss.
        error_text = str(exc).lower()
        if "duplicate" in error_text or "23505" in error_text or "unique" in error_text:
            return False
        logging.warning("Nest milestone claim skipped: %s", exc)
        return False


def claim_call_milestones(client: Any, row: dict) -> None:
    """Claim call milestones from a persisted call-log row when its facts are known."""

    if not isinstance(row, dict):
        return
    business_id = row.get("business_id")
    user_id = row.get("user_id")
    if business_id is None or not user_id:
        return

    raw_payload = row.get("raw_payload") if isinstance(row.get("raw_payload"), dict) else {}
    metadata = raw_payload.get("metadata") if isinstance(raw_payload.get("metadata"), dict) else {}
    phone_metadata = metadata.get("phone_call") if isinstance(metadata.get("phone_call"), dict) else {}
    direction = _text(
        row.get("direction")
        or row.get("call_direction")
        or raw_payload.get("direction")
        or raw_payload.get("call_direction")
        or phone_metadata.get("direction")
        or row.get("agent_name")
    ).lower()
    success = _status(row)
    call_successful = _text(row.get("call_successful")).lower()
    caller = _text(row.get("caller_name") or row.get("contact_name"))
    detail = caller or ("Outgoing call" if "out" in direction else "Incoming call")

    if "in" in direction and "out" not in direction:
        claim_nest_milestone(
            client,
            business_id=business_id,
            user_id=user_id,
            milestone_key="first_call_received",
            title="First call received",
            message=detail,
            source_id=row.get("id") or row.get("conversation_id"),
            payload={"direction": "inbound"},
        )

    successful = success in {"completed", "done", "success", "successful"} or call_successful in {"true", "yes", "success", "successful", "completed", "done"}
    if successful:
        claim_nest_milestone(
            client,
            business_id=business_id,
            user_id=user_id,
            milestone_key="first_successful_call",
            title="First successful call",
            message=detail,
            source_id=row.get("id") or row.get("conversation_id"),
            payload={"direction": "outbound" if "out" in direction else "inbound" if "in" in direction else "unknown"},
        )


def claim_payment_milestones(client: Any, row: dict) -> None:
    """Claim the first successful-payment milestone from a payment row."""

    if not isinstance(row, dict):
        return
    status = _status(row)
    if status not in SUCCESS_PAYMENT_STATUSES:
        return
    business_id = row.get("business_id")
    user_id = row.get("user_id")
    if business_id is None or not user_id:
        return
    amount = row.get("amount") or row.get("amount_received") or row.get("amount_total")
    claim_nest_milestone(
        client,
        business_id=business_id,
        user_id=user_id,
        milestone_key="first_successful_payment",
        title="First successful payment",
        message=str(amount) if amount is not None else "",
        source_id=row.get("id") or row.get("stripe_payment_intent_id") or row.get("stripe_session_id"),
    )

def get_nest_history(client: Any, *, business_id: Any, user_id: str, limit: int = 40) -> list[dict]:
    """Return a normalized, newest-first Nest history for one authenticated tenant."""

    per_source = max(8, min(40, limit))
    events = [
        *_stored_events(_safe_rows(client, NEST_TABLE, filters=(("business_id", business_id),), order_by="occurred_at", limit=per_source, quiet=True)),
        *_call_events(_safe_rows(client, "call_logs", filters=(("business_id", business_id),), limit=per_source)),
        *_appointment_events(_safe_rows(client, "appointments", filters=(("business_id", business_id),), limit=per_source)),
        *_people_events(_safe_rows(client, "people", filters=(("business_id", business_id),), limit=per_source)),
        *_receptionist_events(_safe_rows(client, "hired_receptionists", filters=(("business_id", business_id),), order_by="hired_at", limit=per_source)),
        *_payment_events(_safe_rows(client, "payments", filters=(("business_id", business_id),), limit=per_source)),
        *_workflow_events(_safe_rows(client, "flow_executions", filters=(("user_id", user_id),), order_by="started_at", limit=per_source)),
    ]
    events.sort(key=lambda event: event.get("occurred_at") or "", reverse=True)
    deduped = []
    seen = set()
    for event in events:
        semantic_key = (event.get("event_type"), event.get("source_id"))
        if all(semantic_key) and semantic_key in seen:
            continue
        if all(semantic_key):
            seen.add(semantic_key)
        deduped.append(event)
    return deduped[: max(1, min(limit, 100))]
