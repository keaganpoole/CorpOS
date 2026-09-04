"""Tenant-scoped operating intelligence for the Sonar dashboard.

The report deliberately uses only records the business already owns.  It does
not infer customer outcomes, revenue attribution, or automation coverage when
the underlying records are absent.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
import json
from typing import Any, Callable
from zoneinfo import ZoneInfo


SUCCESSFUL_PAYMENT_STATUSES = {"succeeded", "paid", "completed"}
COMPLETED_CALL_STATUSES = {"completed", "complete", "success", "successful"}
FAILED_CALL_STATUSES = {"failed", "error", "declined", "busy", "no_answer", "no-answer"}
MISSED_CALL_STATUSES = {"missed", "abandoned", "unanswered", "no_answer", "no-answer"}
INACTIVE_SCENARIO_STATUSES = {"disabled", "inactive", "archived", "draft"}
DAY_NAMES = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")


def metric(label: str, value: Any, explanation: str, metric_type: str = "Measured", score: int | None = None) -> dict[str, Any]:
    payload = {
        "label": label,
        "value": "Not enough data" if value is None else value,
        "explanation": explanation,
        "type": metric_type,
    }
    if score is not None:
        payload["score"] = score
    return payload


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _parse_date(value: Any) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _format_timestamp(value: Any) -> str | None:
    parsed = _parse_datetime(value)
    if not parsed:
        return None
    return parsed.astimezone().strftime("%b %-d, %Y · %-I:%M %p")


def _format_duration(seconds: float | int | None) -> str | None:
    if seconds is None:
        return None
    total = max(0, int(round(float(seconds))))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}h {minutes}m"
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def _format_hours(hours: float | int | None) -> str | None:
    if hours is None:
        return None
    rounded = round(float(hours), 1)
    return f"{int(rounded) if rounded.is_integer() else rounded}h"


def _format_currency(amount: float | int | None) -> str | None:
    if amount is None:
        return None
    return f"${float(amount):,.2f}"


def _format_percent(value: float | int | None) -> str | None:
    if value is None:
        return None
    rounded = round(float(value), 1)
    return f"{int(rounded) if rounded.is_integer() else rounded}%"


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
            return decoded if isinstance(decoded, dict) else {}
        except (TypeError, ValueError):
            return {}
    return {}


def _format_breakdown(counter: Counter[str], limit: int = 4) -> str | None:
    if not counter:
        return None
    return " · ".join(f"{name.replace('_', ' ').title()}: {count:,}" for name, count in counter.most_common(limit))


def _fetch_rows(client: Any, table: str, *, user_id: str | None = None, business_id: Any = None, limit: int = 5000) -> tuple[list[dict], bool]:
    """Fetch one tenant's records.  A failed optional table stays unavailable."""
    try:
        query = client.table(table).select("*")
        if business_id is not None:
            query = query.eq("business_id", business_id)
        elif user_id:
            query = query.eq("user_id", str(user_id))
        response = query.limit(limit).execute()
        return list(response.data or []), True
    except Exception:
        return [], False


def _fetch_scenarios(client: Any, user_id: str) -> tuple[list[dict], bool]:
    try:
        response = (
            client.table("scenarios")
            .select("*")
            .or_(f"user_id.eq.{user_id},created_by.eq.{user_id}")
            .limit(5000)
            .execute()
        )
        return list(response.data or []), True
    except Exception:
        return [], False


def _fetch_checkpoints(client: Any, user_id: str) -> tuple[list[dict], bool]:
    try:
        response = (
            client.table("checkpoints")
            .select("*")
            .eq("trigger_key", "intent_checkpoint")
            .eq("user_id", str(user_id))
            .order("created_at", desc=True)
            .limit(5000)
            .execute()
        )
        return list(response.data or []), True
    except Exception:
        return [], False


def _call_direction(row: dict) -> str | None:
    candidates = [
        row.get("direction"),
        _safe_json_object(row.get("conversation_initiation_data")).get("direction"),
        _safe_json_object(row.get("raw_payload")).get("direction"),
        _safe_json_object(row.get("conversation_metadata")).get("direction"),
    ]
    for value in candidates:
        normalized = str(value or "").strip().lower()
        if normalized in {"inbound", "incoming"}:
            return "incoming"
        if normalized in {"outbound", "outgoing"}:
            return "outgoing"
    return None


def _call_classification(row: dict) -> str:
    status = str(row.get("status") or "").strip().lower()
    outcome = str(row.get("outcome") or "").strip().lower()
    successful = str(row.get("call_successful") or "").strip().lower()
    values = {status, outcome, successful}
    if values & MISSED_CALL_STATUSES:
        return "missed"
    if values & FAILED_CALL_STATUSES or successful in {"false", "no"}:
        return "failed"
    if values & COMPLETED_CALL_STATUSES or successful in {"true", "yes"}:
        return "completed"
    return "other"


def _appointment_status(row: dict) -> str:
    return str(row.get("status") or "unknown").strip().lower() or "unknown"


def _is_active_scenario(row: dict) -> bool:
    status = str(row.get("status") or "").strip().lower()
    return row.get("is_active") is not False and status not in INACTIVE_SCENARIO_STATUSES


def _hours_for_day(value: Any, day: str, layer: str = "business") -> float | None:
    hours = _safe_json_object(value)
    if hours.get("schema_version") == 1:
        day_value = _safe_json_object(_safe_json_object(hours.get("days")).get(day))
        layer_value = _safe_json_object(_safe_json_object(day_value.get("layers")).get(layer))
        if not day_value or not layer_value or not layer_value.get("enabled"):
            return 0.0
        start, end = _safe_float(layer_value.get("start")), _safe_float(layer_value.get("end"))
        return max(0.0, min(24.0, end or 0) - max(0.0, start or 0)) if start is not None and end is not None else None
    day_value = _safe_json_object(hours.get(day))
    if not day_value or not day_value.get("enabled"):
        return 0.0
    start, end = str(day_value.get("open") or ""), str(day_value.get("close") or "")
    try:
        start_h, start_m = [int(part) for part in start.split(":")[:2]]
        end_h, end_m = [int(part) for part in end.split(":")[:2]]
        return max(0.0, ((end_h * 60 + end_m) - (start_h * 60 + start_m)) / 60)
    except (TypeError, ValueError):
        return None


def _weekly_hours(value: Any, layer: str = "business") -> float | None:
    totals = [_hours_for_day(value, day, layer) for day in DAY_NAMES]
    known = [hours for hours in totals if hours is not None]
    return sum(known) if known else None


def _appointment_minutes(row: dict) -> int | None:
    duration = _safe_int(row.get("duration"), -1)
    return duration if duration >= 0 else None


def _in_business_hours(row: dict, business_hours: Any, timezone_name: str | None) -> bool | None:
    appointment_date = _parse_date(row.get("date"))
    time_text = str(row.get("time") or "").strip()
    if not appointment_date or not time_text:
        return None
    try:
        hour, minute = [int(part) for part in time_text.split(":")[:2]]
    except (TypeError, ValueError):
        return None
    weekday = DAY_NAMES[appointment_date.weekday()]
    allowed = _hours_for_day(business_hours, weekday)
    if allowed is None:
        return None
    hours = _safe_json_object(business_hours)
    day_value = _safe_json_object(hours.get(weekday))
    if hours.get("schema_version") == 1:
        day_value = _safe_json_object(_safe_json_object(hours.get("days")).get(weekday))
        layer = _safe_json_object(_safe_json_object(day_value.get("layers")).get("business"))
        start = _safe_float(layer.get("start"))
        end = _safe_float(layer.get("end"))
        if start is None or end is None:
            return None
        current = hour + minute / 60
        return bool(layer.get("enabled")) and start <= current < end
    if not day_value.get("enabled"):
        return False
    try:
        open_h, open_m = [int(part) for part in str(day_value.get("open") or "").split(":")[:2]]
        close_h, close_m = [int(part) for part in str(day_value.get("close") or "").split(":")[:2]]
    except (TypeError, ValueError):
        return None
    current_minutes = hour * 60 + minute
    return (open_h * 60 + open_m) <= current_minutes < (close_h * 60 + close_m)


def _trend_delta(rows: list[dict], date_key: str = "created_at") -> float | None:
    now = _now()
    current_start = now.timestamp() - 30 * 86400
    previous_start = now.timestamp() - 60 * 86400
    timestamps = [(_parse_datetime(row.get(date_key)), row) for row in rows]
    current = sum(1 for parsed, _ in timestamps if parsed and parsed.timestamp() >= current_start)
    previous = sum(1 for parsed, _ in timestamps if parsed and previous_start <= parsed.timestamp() < current_start)
    if previous == 0:
        return None if current == 0 else 100.0
    return ((current - previous) / previous) * 100


def _payment_amount(row: dict) -> float | None:
    amount = _safe_float(row.get("amount"))
    if amount is None:
        return None
    # Stored payment amounts are already displayed as currency in the current live page.
    return amount


def _amount_trend_delta(rows: list[dict]) -> float | None:
    now = _now()
    current_start = now.timestamp() - 30 * 86400
    previous_start = now.timestamp() - 60 * 86400
    current_amount = 0.0
    previous_amount = 0.0
    current_seen = False
    previous_seen = False
    for row in rows:
        timestamp = _parse_datetime(row.get("created_at"))
        amount = _payment_amount(row)
        if not timestamp or amount is None:
            continue
        if timestamp.timestamp() >= current_start:
            current_amount += amount
            current_seen = True
        elif previous_start <= timestamp.timestamp() < current_start:
            previous_amount += amount
            previous_seen = True
    if not current_seen and not previous_seen:
        return None
    if previous_amount == 0:
        return None if current_amount == 0 else 100.0
    return ((current_amount - previous_amount) / previous_amount) * 100


def _datetime_in_business_hours(value: Any, business_hours: Any, timezone_name: str | None) -> bool | None:
    timestamp = _parse_datetime(value)
    if not timestamp:
        return None
    try:
        local = timestamp.astimezone(ZoneInfo(str(timezone_name or "UTC")))
    except Exception:
        local = timestamp
    weekday = DAY_NAMES[local.weekday()]
    hours = _safe_json_object(business_hours)
    if not hours:
        return None
    if hours.get("schema_version") == 1:
        day_value = _safe_json_object(_safe_json_object(hours.get("days")).get(weekday))
        layer = _safe_json_object(_safe_json_object(day_value.get("layers")).get("business"))
        start, end = _safe_float(layer.get("start")), _safe_float(layer.get("end"))
        if start is None or end is None:
            return None
        current = local.hour + local.minute / 60
        return bool(layer.get("enabled")) and start <= current < end
    day_value = _safe_json_object(hours.get(weekday))
    if not day_value:
        return None
    if not day_value.get("enabled"):
        return False
    try:
        open_h, open_m = [int(part) for part in str(day_value.get("open") or "").split(":")[:2]]
        close_h, close_m = [int(part) for part in str(day_value.get("close") or "").split(":")[:2]]
    except (TypeError, ValueError):
        return None
    current_minutes = local.hour * 60 + local.minute
    return (open_h * 60 + open_m) <= current_minutes < (close_h * 60 + close_m)


def _has_value(value: Any) -> bool:
    return value not in (None, "", [], {})


def get_business_intelligence(client: Any, *, user_id: str) -> dict[str, Any]:
    business_rows, business_available = _fetch_rows(client, "businesses", user_id=user_id, limit=1)
    business = business_rows[0] if business_rows else {}
    business_id = business.get("id")
    if not business_available or business_id is None:
        raise RuntimeError("Business context is unavailable.")

    calls, calls_available = _fetch_rows(client, "call_logs", user_id=user_id)
    appointments, appointments_available = _fetch_rows(client, "appointments", business_id=business_id)
    people, people_available = _fetch_rows(client, "people", business_id=business_id)
    payments, payments_available = _fetch_rows(client, "payments", business_id=business_id)
    staff, staff_available = _fetch_rows(client, "staff", business_id=business_id)
    services, services_available = _fetch_rows(client, "services", business_id=business_id)
    receptionists, receptionists_available = _fetch_rows(client, "hired_receptionists", user_id=user_id)
    scenarios, scenarios_available = _fetch_scenarios(client, user_id)
    checkpoints, checkpoints_available = _fetch_checkpoints(client, user_id)
    requests, requests_available = _fetch_rows(client, "requests", business_id=business_id)
    documents, documents_available = _fetch_rows(client, "people_docs", business_id=business_id)
    settings_rows, settings_available = _fetch_rows(client, "account_settings", user_id=user_id, limit=1)
    settings = settings_rows[0] if settings_rows else {}

    timezone_name = str(settings.get("business_timezone") or business.get("timezone") or "UTC")
    try:
        business_today = _now().astimezone(ZoneInfo(timezone_name)).date()
    except Exception:
        business_today = _now().date()
    business_hours = business.get("business_hours")

    # Calls
    directions = Counter(_call_direction(row) or "unknown" for row in calls)
    call_classes = Counter(_call_classification(row) for row in calls)
    durations = [_safe_int(row.get("duration_seconds"), -1) for row in calls]
    durations = [value for value in durations if value >= 0]
    caller_ids = {
        str(row.get("person_id")) for row in calls
        if row.get("person_id") is not None
    }
    caller_phones = {
        str(row.get("caller_phone") or row.get("from_number") or "").strip()
        for row in calls
        if str(row.get("caller_phone") or row.get("from_number") or "").strip()
    }
    call_statuses = Counter(str(row.get("status") or "unknown").strip().lower() or "unknown" for row in calls)
    call_outcomes = Counter(str(row.get("outcome") or "unknown").strip().lower() or "unknown" for row in calls)
    failure_reasons = Counter(str(row.get("failure_reason") or "").strip() for row in calls if row.get("failure_reason"))
    receptionist_calls: dict[str, list[dict]] = defaultdict(list)
    for row in calls:
        key = str(row.get("hired_receptionist_id") or row.get("receptionist_name") or "")
        if key:
            receptionist_calls[key].append(row)
    receptionist_success_rates = [
        (key, (sum(1 for row in rows if _call_classification(row) == "completed") / len(rows)) * 100)
        for key, rows in receptionist_calls.items()
        if rows
    ]
    receptionist_duration_summaries = []
    receptionist_last_activity = []
    for key, rows in receptionist_calls.items():
        receptionist_durations = [_safe_int(row.get("duration_seconds"), -1) for row in rows]
        receptionist_durations = [value for value in receptionist_durations if value >= 0]
        timestamps = [_parse_datetime(row.get("created_at")) for row in rows]
        timestamps = [value for value in timestamps if value]
        if timestamps:
            receptionist_last_activity.append((key, max(timestamps)))
        if receptionist_durations:
            receptionist_duration_summaries.append((key, sum(receptionist_durations), sum(receptionist_durations) / len(receptionist_durations), max(timestamps) if timestamps else None))
    hourly_calls = Counter()
    daily_calls = Counter()
    call_business_hour_results: list[bool] = []
    for row in calls:
        started = _parse_datetime(row.get("started_at") or row.get("created_at"))
        if started:
            try:
                local = started.astimezone(ZoneInfo(timezone_name))
            except Exception:
                local = started
            hourly_calls[local.hour] += 1
            daily_calls[DAY_NAMES[local.weekday()]] += 1
    for row in calls:
        inside = _datetime_in_business_hours(row.get("started_at") or row.get("created_at"), business_hours, timezone_name)
        if inside is not None:
            call_business_hour_results.append(inside)

    # Appointments
    appointment_statuses = Counter(_appointment_status(row) for row in appointments)
    active_appointments = [row for row in appointments if _appointment_status(row) not in {"cancelled", "canceled"}]
    completed_appointments = [row for row in appointments if _appointment_status(row) == "completed"]
    cancelled_appointments = [row for row in appointments if _appointment_status(row) in {"cancelled", "canceled"}]
    future_appointments = [row for row in active_appointments if (_parse_date(row.get("date")) or business_today) >= business_today]
    upcoming_week = [row for row in future_appointments if (_parse_date(row.get("date")) or business_today) <= date.fromordinal(business_today.toordinal() + 7)]
    upcoming_month = [row for row in future_appointments if (_parse_date(row.get("date")) or business_today) <= date.fromordinal(business_today.toordinal() + 30)]
    unresolved_past = [
        row for row in appointments
        if (_parse_date(row.get("date")) and _parse_date(row.get("date")) < business_today and _appointment_status(row) not in {"completed", "cancelled", "canceled"})
    ]
    appointment_minutes = [_appointment_minutes(row) for row in active_appointments]
    appointment_minutes = [value for value in appointment_minutes if value is not None]
    staff_bookings = Counter(str(row.get("staff_id")) for row in active_appointments if row.get("staff_id") is not None)
    service_bookings = Counter(str(row.get("service_id")) for row in active_appointments if row.get("service_id") is not None)
    receptionist_bookings = Counter(str(row.get("receptionist_id")) for row in active_appointments if row.get("receptionist_id") is not None)
    appointment_days = Counter()
    appointment_hours = Counter()
    booking_lead_minutes: list[float] = []
    for row in appointments:
        appointment_date = _parse_date(row.get("date"))
        if appointment_date:
            appointment_days[DAY_NAMES[appointment_date.weekday()]] += 1
        try:
            appointment_hours[int(str(row.get("time") or "").split(":")[0])] += 1
        except (TypeError, ValueError):
            pass
        created = _parse_datetime(row.get("created_at"))
        if created and appointment_date and row.get("time"):
            try:
                hour, minute = [int(part) for part in str(row["time"]).split(":")[:2]]
                appointment_at = datetime(appointment_date.year, appointment_date.month, appointment_date.day, hour, minute, tzinfo=created.tzinfo)
                if appointment_at >= created:
                    booking_lead_minutes.append((appointment_at - created).total_seconds() / 60)
            except (TypeError, ValueError):
                pass
    appointments_by_person = Counter(str(row.get("person_id")) for row in active_appointments if row.get("person_id") is not None)
    first_time_bookings = sum(1 for row in active_appointments if row.get("person_id") is not None and appointments_by_person[str(row.get("person_id"))] == 1)
    repeat_bookings = sum(1 for row in active_appointments if row.get("person_id") is not None and appointments_by_person[str(row.get("person_id"))] > 1)

    # People
    people_with_phone = sum(1 for row in people if _has_value(row.get("phone")))
    people_with_email = sum(1 for row in people if _has_value(row.get("email")))
    people_with_complete_contact = sum(1 for row in people if _has_value(row.get("phone")) and _has_value(row.get("email")))
    people_ids = {str(row.get("id")) for row in people if row.get("id") is not None}
    people_with_appointments = {person_id for person_id in appointments_by_person if person_id}

    # Payments
    successful_payments = [row for row in payments if str(row.get("status") or "").strip().lower() in SUCCESSFUL_PAYMENT_STATUSES]
    payment_amounts = [_payment_amount(row) for row in successful_payments]
    payment_amounts = [value for value in payment_amounts if value is not None]
    revenue = sum(payment_amounts) if payment_amounts else 0.0
    payment_statuses = Counter(str(row.get("status") or "unknown").strip().lower() or "unknown" for row in payments)

    # Configuration and staff capacity
    active_staff = [row for row in staff if row.get("is_active") is not False]
    active_receptionists = [row for row in receptionists if row.get("is_active") is not False and str(row.get("status") or "").lower() not in {"archived", "terminated"}]
    staff_hours = [_weekly_hours(row.get("working_hours")) for row in active_staff]
    staff_hours_known = [value for value in staff_hours if value is not None]
    business_weekly_hours = _weekly_hours(business_hours)
    active_services = [row for row in services if row.get("is_active") is not False]
    complete_services = [
        row for row in active_services
        if _has_value(row.get("name")) and _has_value(row.get("description")) and (_has_value(row.get("price_min")) or str(row.get("price_type") or "").lower() in {"quote", "free"})
    ]
    staff_names = {str(row.get("id")): str(row.get("full_name") or row.get("first_name") or f"Staff {row.get('id')}") for row in staff if row.get("id") is not None}
    service_names = {str(row.get("id")): str(row.get("name") or f"Service {row.get('id')}") for row in services if row.get("id") is not None}
    receptionist_names = {str(row.get("id")): str(row.get("full_name") or row.get("first_name") or f"Receptionist {row.get('id')}") for row in receptionists if row.get("id") is not None}
    def linked_name(identifier: str, names: dict[str, str]) -> str:
        return names.get(str(identifier), str(identifier))
    profile_fields = [business.get(key) for key in ("name", "industry", "phone", "email", "address", "city", "state", "zip", "business_hours")]
    profile_score = round((sum(1 for value in profile_fields if _has_value(value)) / len(profile_fields)) * 100)
    forwarding_config = _safe_json_object(business.get("forwarding_config"))
    forwarding_ready = bool(forwarding_config.get("enabled") or forwarding_config.get("forward_to") or forwarding_config.get("phone"))
    knowledge_fields = [business.get(key) for key in ("about_us", "policies", "faq")]
    knowledge_score = round((sum(1 for value in knowledge_fields if _has_value(value)) / len(knowledge_fields)) * 100)
    readiness_checks = [
        bool(business.get("name")), bool(business.get("phone")), business_weekly_hours is not None,
        bool(active_receptionists), bool(active_staff), bool(active_services), knowledge_score > 0, forwarding_ready,
    ]
    readiness_score = round((sum(readiness_checks) / len(readiness_checks)) * 100)
    used_seconds = _safe_int(business.get("current_cycle_used_seconds"), -1)
    included_seconds = _safe_int(business.get("current_cycle_included_seconds"), -1)
    overage_seconds = _safe_int(business.get("current_cycle_overage_seconds"), -1)
    cycle_end = _parse_datetime(business.get("current_cycle_ends_at"))
    days_in_cycle = max(0, (cycle_end - _now()).days) if cycle_end else None

    # Workflow events
    checkpoint_intents = Counter(str(row.get("intent_key") or _safe_json_object(row.get("payload")).get("intent_key") or "unknown").strip().lower() for row in checkpoints)
    checkpoint_phases = Counter(str(row.get("phase") or _safe_json_object(row.get("payload")).get("phase") or "unknown").strip().lower() for row in checkpoints)
    latest_checkpoint = max(checkpoints, key=lambda row: _parse_datetime(row.get("created_at") or row.get("timestamp")) or datetime.min.replace(tzinfo=timezone.utc), default=None)
    active_scenarios = [row for row in scenarios if _is_active_scenario(row)]
    scheduled_scenarios = [
        row for row in scenarios
        if str(row.get("trigger_key") or "").lower() in {"scheduled", "appointment_soon", "cron"}
        or _has_value(row.get("schedule_config"))
    ]

    # Documents
    request_statuses = Counter(str(row.get("status") or "unknown").strip().lower() or "unknown" for row in requests)
    completed_requests = request_statuses["completed"] + request_statuses["verified"]
    completed_request_durations = []
    for row in requests:
        created, completed = _parse_datetime(row.get("created_at")), _parse_datetime(row.get("completed_at"))
        if created and completed and completed >= created:
            completed_request_durations.append((completed - created).total_seconds())

    calls_section = [
        metric("Total calls", f"{len(calls):,}" if calls_available else None, "All call-log records retained for this business."),
        metric("Incoming calls", f"{directions['incoming']:,}" if calls_available else None, "Calls identified as inbound from their call metadata."),
        metric("Outgoing calls", f"{directions['outgoing']:,}" if calls_available else None, "Calls identified as outbound from their call metadata."),
        metric("Completed calls", f"{call_classes['completed']:,}" if calls_available else None, "Calls whose stored status or outcome is completed."),
        metric("Failed calls", f"{call_classes['failed']:,}" if calls_available else None, "Calls whose stored status or outcome indicates failure."),
        metric("Missed calls", f"{call_classes['missed']:,}" if calls_available else None, "Calls recorded as missed, abandoned, or unanswered."),
        metric("Unknown-direction calls", f"{directions['unknown']:,}" if calls_available else None, "Calls without enough metadata to classify direction."),
        metric("Call success rate", _format_percent((call_classes['completed'] / len(calls)) * 100) if calls_available and calls else None, "Completed calls divided by all logged calls.", "Calculated"),
        metric("Total talk time", _format_duration(sum(durations)) if calls_available and durations else None, "Sum of logged call durations."),
        metric("Average call length", _format_duration(sum(durations) / len(durations)) if calls_available and durations else None, "Average of calls with a stored duration.", "Calculated"),
        metric("Longest call", _format_duration(max(durations)) if calls_available and durations else None, "Longest logged call duration."),
        metric("Most recent call", _format_timestamp(max((row.get('created_at') for row in calls if row.get('created_at')), default=None)) if calls_available else None, "Newest retained call-log timestamp."),
        metric("Unique callers", f"{len(caller_phones):,}" if calls_available and caller_phones else None, "Distinct caller phone or source numbers in retained logs.", "Calculated"),
        metric("Repeat callers", f"{sum(1 for phone in caller_phones if sum(1 for row in calls if str(row.get('caller_phone') or row.get('from_number') or '').strip() == phone) > 1):,}" if calls_available and caller_phones else None, "Distinct caller numbers with more than one logged call.", "Calculated"),
        metric("Known caller match rate", _format_percent((sum(1 for row in calls if row.get('person_id') is not None) / len(calls)) * 100) if calls_available and calls else None, "Share of calls linked to a person record.", "Calculated"),
        metric("Call status breakdown", _format_breakdown(call_statuses) if calls_available and calls else None, "Most common stored call statuses."),
        metric("Call outcome breakdown", _format_breakdown(call_outcomes) if calls_available and calls else None, "Most common stored call outcomes."),
        metric("Failure-reason breakdown", _format_breakdown(failure_reasons) if calls_available and failure_reasons else None, "Recorded reasons for failed calls."),
        metric("Receptionist activity", f"{len(receptionist_calls):,} receptionists" if calls_available and receptionist_calls else None, "Receptionists with at least one linked call record.", "Calculated"),
        metric("Best receptionist call volume", None if not receptionist_calls else f"{linked_name(max(receptionist_calls, key=lambda key: len(receptionist_calls[key])), receptionist_names)} · {len(max(receptionist_calls.values(), key=len)):,} calls", "Highest logged volume, based on linked call records.", "Calculated"),
        metric("Best receptionist success rate", None if not receptionist_success_rates else f"{linked_name(max(receptionist_success_rates, key=lambda item: item[1])[0], receptionist_names)} · {_format_percent(max(receptionist_success_rates, key=lambda item: item[1])[1])}", "Highest completed-call rate among receptionists with call logs.", "Calculated"),
        metric("Receptionist average call length", None if not receptionist_duration_summaries else f"{linked_name(max(receptionist_duration_summaries, key=lambda item: item[2])[0], receptionist_names)} · {_format_duration(max(receptionist_duration_summaries, key=lambda item: item[2])[2])}", "Largest average logged call duration among receptionists with duration data.", "Calculated"),
        metric("Receptionist talk time", None if not receptionist_duration_summaries else f"{linked_name(max(receptionist_duration_summaries, key=lambda item: item[1])[0], receptionist_names)} · {_format_duration(max(receptionist_duration_summaries, key=lambda item: item[1])[1])}", "Largest total logged talk time among receptionists with duration data.", "Calculated"),
        metric("Receptionist last activity", None if not receptionist_last_activity else f"{linked_name(max(receptionist_last_activity, key=lambda item: item[1])[0], receptionist_names)} · {_format_timestamp(max(receptionist_last_activity, key=lambda item: item[1])[1])}", "Most recent call timestamp among receptionists with linked call logs.", "Calculated"),
        metric("Busiest call day", None if not daily_calls else f"{daily_calls.most_common(1)[0][0]} · {daily_calls.most_common(1)[0][1]:,} calls", "Day of week with the most retained call timestamps.", "Calculated"),
        metric("Busiest call hour", None if not hourly_calls else f"{hourly_calls.most_common(1)[0][0] % 12 or 12} {'PM' if hourly_calls.most_common(1)[0][0] >= 12 else 'AM'} · {hourly_calls.most_common(1)[0][1]:,} calls", "Local business hour with the most retained calls.", "Calculated"),
        metric("Calls during business hours", f"{sum(1 for result in call_business_hour_results if result):,}" if call_business_hour_results else None, "Calls whose timestamp falls inside the configured business schedule.", "Calculated"),
        metric("After-hours calls", f"{sum(1 for result in call_business_hour_results if not result):,}" if call_business_hour_results else None, "Calls whose timestamp falls outside the configured business schedule.", "Calculated"),
        metric("Transcript coverage", _format_percent((sum(1 for row in calls if _has_value(row.get('transcript_text')) or _has_value(row.get('transcript_jsonb'))) / len(calls)) * 100) if calls_available and calls else None, "Calls with a stored transcript.", "Calculated"),
        metric("Call-summary coverage", _format_percent((sum(1 for row in calls if _has_value(row.get('summary'))) / len(calls)) * 100) if calls_available and calls else None, "Calls with a stored summary.", "Calculated"),
        metric("Recording coverage", _format_percent((sum(1 for row in calls if row.get('has_audio') or _has_value(row.get('audio_storage_path'))) / len(calls)) * 100) if calls_available and calls else None, "Calls with an audio indicator or recording path.", "Calculated"),
        metric("AI call-analysis coverage", _format_percent((sum(1 for row in calls if _has_value(row.get('analysis_results'))) / len(calls)) * 100) if calls_available and calls else None, "Calls with stored analysis output.", "Calculated"),
    ]

    appointments_section = [
        metric("Total appointments created", f"{len(appointments):,}" if appointments_available else None, "All appointment records retained for this business."),
        metric("Scheduled appointments", f"{len(active_appointments):,}" if appointments_available else None, "Appointments not marked cancelled."),
        metric("Completed appointments", f"{len(completed_appointments):,}" if appointments_available else None, "Appointments with a completed status."),
        metric("Cancelled appointments", f"{len(cancelled_appointments):,}" if appointments_available else None, "Appointments with a cancelled status."),
        metric("Appointment completion rate", _format_percent((len(completed_appointments) / len(appointments)) * 100) if appointments_available and appointments else None, "Completed appointments divided by all appointment records.", "Calculated"),
        metric("Appointment cancellation rate", _format_percent((len(cancelled_appointments) / len(appointments)) * 100) if appointments_available and appointments else None, "Cancelled appointments divided by all appointment records.", "Calculated"),
        metric("Appointment status breakdown", _format_breakdown(appointment_statuses) if appointments_available and appointments else None, "Most common stored appointment statuses."),
        metric("Appointments today", f"{sum(1 for row in active_appointments if _parse_date(row.get('date')) == business_today):,}" if appointments_available else None, "Non-cancelled appointments on the business's local date."),
        metric("Upcoming appointments, next 7 days", f"{len(upcoming_week):,}" if appointments_available else None, "Non-cancelled appointments dated today through the next seven days."),
        metric("Upcoming appointments, next 30 days", f"{len(upcoming_month):,}" if appointments_available else None, "Non-cancelled appointments dated today through the next 30 days."),
        metric("Past appointments awaiting an outcome", f"{len(unresolved_past):,}" if appointments_available else None, "Past appointments not marked completed or cancelled."),
        metric("Total booked appointment hours", _format_hours(sum(appointment_minutes) / 60) if appointments_available and appointment_minutes else None, "Total duration of non-cancelled appointments."),
        metric("Average appointment duration", _format_duration((sum(appointment_minutes) / len(appointment_minutes)) * 60) if appointments_available and appointment_minutes else None, "Average duration of non-cancelled appointments.", "Calculated"),
        metric("Appointment assignment coverage", None if not appointments_available else f"Staff: {sum(staff_bookings.values()):,} · Services: {sum(service_bookings.values()):,} · Receptionists: {sum(receptionist_bookings.values()):,}", "Non-cancelled appointments with a linked staff member, service, or receptionist.", "Calculated"),
        metric("Most-booked staff member", None if not staff_bookings else f"{linked_name(staff_bookings.most_common(1)[0][0], staff_names)} · {staff_bookings.most_common(1)[0][1]:,} appointments", "Staff member with the most non-cancelled appointment records.", "Calculated"),
        metric("Most-booked service", None if not service_bookings else f"{linked_name(service_bookings.most_common(1)[0][0], service_names)} · {service_bookings.most_common(1)[0][1]:,} appointments", "Service with the most non-cancelled appointment records.", "Calculated"),
        metric("Receptionist booking activity", f"{len(receptionist_bookings):,} receptionists" if appointments_available and receptionist_bookings else None, "Receptionists linked to at least one non-cancelled appointment.", "Calculated"),
        metric("Busiest appointment day", None if not appointment_days else f"{appointment_days.most_common(1)[0][0]} · {appointment_days.most_common(1)[0][1]:,} appointments", "Day of week with the most retained appointment dates.", "Calculated"),
        metric("Busiest appointment hour", None if not appointment_hours else f"{appointment_hours.most_common(1)[0][0] % 12 or 12} {'PM' if appointment_hours.most_common(1)[0][0] >= 12 else 'AM'} · {appointment_hours.most_common(1)[0][1]:,} appointments", "Local hour with the most retained appointment times.", "Calculated"),
        metric("Average booking lead time", _format_duration((sum(booking_lead_minutes) / len(booking_lead_minutes)) * 60) if booking_lead_minutes else None, "Time between appointment creation and scheduled start.", "Calculated"),
        metric("First-time booked appointments", f"{first_time_bookings:,}" if appointments_available else None, "Booked appointments for people with one retained non-cancelled appointment.", "Calculated"),
        metric("Repeat booked appointments", f"{repeat_bookings:,}" if appointments_available else None, "Booked appointments for people with more than one retained non-cancelled appointment.", "Calculated"),
        metric("Repeat-booking rate", _format_percent((repeat_bookings / (first_time_bookings + repeat_bookings)) * 100) if (first_time_bookings + repeat_bookings) else None, "Repeat booked appointments among appointments linked to a person record.", "Calculated"),
        metric("Staff schedule capacity", _format_hours(sum(staff_hours_known)) if staff_available and staff_hours_known else None, "Weekly hours configured across active staff schedules."),
        metric("Staff appointment utilization", _format_percent((sum(appointment_minutes) / 60 / sum(staff_hours_known)) * 100) if appointment_minutes and staff_hours_known and sum(staff_hours_known) else None, "Booked appointment hours divided by configured weekly staff hours. This is a snapshot, not a utilization forecast.", "Calculated"),
    ]

    people_section = [
        metric("Total people records", f"{len(people):,}" if people_available else None, "All retained people records for this business."),
        metric("New people records", f"{sum(1 for row in people if (_parse_datetime(row.get('created_at')) or datetime.min.replace(tzinfo=timezone.utc)) >= _now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=30)):,}" if people_available else None, "People records created in the last 30 days."),
        metric("People-record growth", _format_percent(_trend_delta(people)) if people_available else None, "Last 30 days compared with the preceding 30 days.", "Calculated"),
        metric("Phone-number coverage", _format_percent((people_with_phone / len(people)) * 100) if people_available and people else None, "People records with a phone number.", "Calculated"),
        metric("Email-address coverage", _format_percent((people_with_email / len(people)) * 100) if people_available and people else None, "People records with an email address.", "Calculated"),
        metric("Complete-contact coverage", _format_percent((people_with_complete_contact / len(people)) * 100) if people_available and people else None, "People records with both phone and email.", "Calculated"),
        metric("People with no appointment history", f"{len(people_ids - people_with_appointments):,}" if people_available and appointments_available else None, "People records not linked to a retained non-cancelled appointment.", "Calculated"),
        metric("Average appointments per person", f"{(len(active_appointments) / len(people)):.1f}" if people_available and appointments_available and people else None, "Non-cancelled appointment records divided by people records.", "Calculated"),
        metric("Returning people", f"{sum(1 for count in appointments_by_person.values() if count > 1):,}" if appointments_available else None, "People linked to two or more retained non-cancelled appointments.", "Calculated"),
    ]

    payments_section = [
        metric("Collected revenue", _format_currency(revenue) if payments_available and payment_amounts else None, "Sum of payments with a successful status."),
        metric("Successful payments", f"{len(successful_payments):,}" if payments_available else None, "Payments marked succeeded, paid, or completed."),
        metric("Average payment amount", _format_currency(revenue / len(payment_amounts)) if payment_amounts else None, "Average amount across successful payments.", "Calculated"),
        metric("Revenue change", _format_percent(_amount_trend_delta(successful_payments)) if payments_available else None, "Successful payment amount in the last 30 days compared with the preceding 30 days.", "Calculated"),
        metric("Payment-count change", _format_percent(_trend_delta(payments)) if payments_available else None, "Last 30 days compared with the preceding 30 days.", "Calculated"),
        metric("Revenue trend", _format_currency(revenue) if payments_available and payment_amounts else None, "Collected revenue across all retained successful payments."),
        metric("Payment-status breakdown", _format_breakdown(payment_statuses) if payments_available and payments else None, "Most common stored payment statuses."),
        metric("Revenue per call", _format_currency(revenue / len(calls)) if payment_amounts and calls else None, "Aggregate revenue divided by calls. It does not attribute payments to specific calls.", "Calculated"),
        metric("Revenue per completed appointment", _format_currency(revenue / len(completed_appointments)) if payment_amounts and completed_appointments else None, "Aggregate revenue divided by completed appointments. It does not attribute payments to specific appointments.", "Calculated"),
        metric("Revenue per person record", _format_currency(revenue / len(people)) if payment_amounts and people else None, "Aggregate revenue divided by people records. It does not attribute payments to specific people.", "Calculated"),
    ]

    automation_section = [
        metric("Active scenarios", f"{len(active_scenarios):,}" if scenarios_available else None, "Scenarios not marked inactive, disabled, archived, or draft."),
        metric("Disabled scenarios", f"{len(scenarios) - len(active_scenarios):,}" if scenarios_available else None, "Scenarios marked inactive, disabled, archived, or draft."),
        metric("Scheduled scenarios", f"{len(scheduled_scenarios):,}" if scenarios_available else None, "Scenarios with a schedule-oriented trigger or schedule configuration."),
        metric("Automation checkpoint volume", f"{len(checkpoints):,}" if checkpoints_available else None, "Persisted intent checkpoints for this business user."),
        metric("Automation intent mix", _format_breakdown(checkpoint_intents) if checkpoints_available and checkpoints else None, "Most common persisted automation intents."),
        metric("Records created by automation", f"{checkpoint_intents['record_created']:,}" if checkpoints_available else None, "Persisted record-created intent checkpoints."),
        metric("Records updated by automation", f"{checkpoint_intents['record_updated']:,}" if checkpoints_available else None, "Persisted record-updated intent checkpoints."),
        metric("Appointments created by automation", f"{checkpoint_intents['appointment_created']:,}" if checkpoints_available else None, "Persisted appointment-created intent checkpoints."),
        metric("Appointments updated by automation", f"{checkpoint_intents['appointment_updated']:,}" if checkpoints_available else None, "Persisted appointment-updated intent checkpoints."),
        metric("Appointments cancelled by automation", f"{checkpoint_intents['appointment_cancelled']:,}" if checkpoints_available else None, "Persisted appointment-cancelled intent checkpoints."),
        metric("Payments received through tracked workflows", f"{checkpoint_intents['payment_received']:,}" if checkpoints_available else None, "Persisted payment-received intent checkpoints."),
        metric("Most recent live workflow route", None if not latest_checkpoint else str(latest_checkpoint.get('intent_key') or _safe_json_object(latest_checkpoint.get('payload')).get('intent_key') or 'Unknown').replace('_', ' ').title(), "Most recently persisted workflow intent."),
        metric("Current or recent execution state", None if not latest_checkpoint else str(latest_checkpoint.get('phase') or _safe_json_object(latest_checkpoint.get('payload')).get('phase') or 'Unknown').replace('_', ' ').title(), "Latest persisted checkpoint phase."),
        metric("Workflow completion or failure mix", _format_breakdown(checkpoint_phases) if checkpoints_available and checkpoints else None, "Stored workflow checkpoint phases. This reflects emitted checkpoints only."),
    ]

    operations_section = [
        metric("Active receptionists", f"{len(active_receptionists):,}" if receptionists_available else None, "Hired receptionists that are not archived or inactive."),
        metric("Receptionist direction coverage", _format_breakdown(Counter(str(row.get('direction') or 'all').title() for row in active_receptionists)) if receptionists_available and active_receptionists else None, "Configured call-direction coverage for active receptionists."),
        metric("Active staff members", f"{len(active_staff):,}" if staff_available else None, "Staff members not marked inactive."),
        metric("Weekly staff availability hours", _format_hours(sum(staff_hours_known)) if staff_available and staff_hours_known else None, "Sum of configured hours across active staff schedules."),
        metric("Business weekly open hours", _format_hours(business_weekly_hours) if business_weekly_hours is not None else None, "Configured business schedule hours across one week."),
        metric("Staff coverage against business hours", _format_percent((sum(staff_hours_known) / business_weekly_hours) * 100) if staff_hours_known and business_weekly_hours else None, "Configured staff hours divided by configured business-open hours. Over 100% means overlapping staff coverage.", "Calculated"),
        metric("Active services", f"{len(active_services):,}" if services_available else None, "Services not marked inactive."),
        metric("Service-catalog completeness", _format_percent((len(complete_services) / len(active_services)) * 100) if active_services else None, "Active services with a name, description, and usable price configuration.", "Calculated"),
        metric("Business-profile completeness", _format_percent(profile_score), "Configured business identity, contact, address, and hours fields.", "Calculated", profile_score),
        metric("Business-hours configuration", "Configured" if business_weekly_hours is not None else None, "Whether a usable business-hours schedule is saved."),
        metric("Call-forwarding readiness", "Configured" if forwarding_ready else ("Not configured" if business_available else None), "Whether forwarding settings contain an enabled or destination value."),
        metric("Knowledge-base readiness", _format_percent(knowledge_score), "Coverage across business description, policies, and FAQs.", "Calculated", knowledge_score),
        metric("Front-desk readiness score", _format_percent(readiness_score), "Configuration readiness across core business, team, service, knowledge, and forwarding setup. It is not an operating-performance score.", "Calculated", readiness_score),
        metric("Included call minutes", f"{included_seconds // 60:,} min" if included_seconds >= 0 else None, "Included minutes stored for the current billing cycle."),
        metric("Call minutes used this billing cycle", f"{used_seconds // 60:,} min" if used_seconds >= 0 else None, "Usage stored for the current billing cycle."),
        metric("Remaining included minutes", f"{max(0, included_seconds - used_seconds) // 60:,} min" if included_seconds >= 0 and used_seconds >= 0 else None, "Stored included minutes minus stored used minutes.", "Calculated"),
        metric("Overage minutes", f"{overage_seconds // 60:,} min" if overage_seconds >= 0 else None, "Stored call-minute overage for the current billing cycle."),
        metric("Days remaining in billing cycle", f"{days_in_cycle:,} days" if days_in_cycle is not None else None, "Time remaining until the stored billing-cycle end date.", "Calculated"),
    ]

    documents_section = [
        metric("Document requests created", f"{len(requests):,}" if requests_available else None, "All retained document or verification requests."),
        metric("Document-request completion rate", _format_percent((completed_requests / len(requests)) * 100) if requests_available and requests else None, "Completed or verified requests divided by all retained requests.", "Calculated"),
        metric("Pending requests", f"{request_statuses['pending']:,}" if requests_available else None, "Requests currently marked pending."),
        metric("Verified requests", f"{request_statuses['verified']:,}" if requests_available else None, "Requests currently marked verified."),
        metric("Expired or cancelled requests", f"{request_statuses['expired'] + request_statuses['cancelled']:,}" if requests_available else None, "Requests currently marked expired or cancelled."),
        metric("Uploaded documents", f"{len(documents):,}" if documents_available else None, "Document metadata retained for this business."),
        metric("Average request-completion time", _format_duration(sum(completed_request_durations) / len(completed_request_durations)) if completed_request_durations else None, "Average from request creation to recorded completion.", "Calculated"),
    ]

    hero_metrics = [
        {"label": "Total calls", "value": f"{len(calls):,}" if calls_available else "Not enough data", "explanation": "Retained call logs"},
        {"label": "Upcoming appointments", "value": f"{len(upcoming_week):,}" if appointments_available else "Not enough data", "explanation": "Next seven days"},
        {"label": "Collected revenue", "value": _format_currency(revenue) if payment_amounts else "Not enough data", "explanation": "Successful payments only"},
        {"label": "Active workflows", "value": f"{len(active_scenarios):,}" if scenarios_available else "Not enough data", "explanation": "Enabled scenarios"},
    ]

    total_metrics = sum(len(section) for section in (calls_section, appointments_section, people_section, payments_section, automation_section, operations_section, documents_section))
    return {
        "business": {
            "name": business.get("name") or "Your business",
            "industry": business.get("industry") if isinstance(business.get("industry"), str) else _safe_json_object(business.get("industry")).get("industry") or "Business operating report",
            "headline": "A clear view of the calls, bookings, revenue, workflows, and setup behind your front desk.",
            "disclaimer": "Measured values come from your retained Nodemere records. Calculated values describe those records only; they do not prove customer intent, payment attribution, or future performance.",
        },
        "metrics": {
            "calls": calls_section,
            "appointments": appointments_section,
            "people": people_section,
            "payments": payments_section,
            "automation": automation_section,
            "operations": operations_section,
            "documents": documents_section,
        },
        "hero_metrics": hero_metrics,
        "analysis_updated_at": _now().isoformat(),
        "core_metric_count": total_metrics,
        "availability": {
            "calls": calls_available,
            "appointments": appointments_available,
            "people": people_available,
            "payments": payments_available,
            "staff": staff_available,
            "services": services_available,
            "receptionists": receptionists_available,
            "scenarios": scenarios_available,
            "checkpoints": checkpoints_available,
            "requests": requests_available,
            "documents": documents_available,
            "settings": settings_available,
        },
    }
