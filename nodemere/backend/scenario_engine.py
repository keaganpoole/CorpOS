import json
import logging
import os
import re
import calendar
import asyncio
from datetime import date, datetime, time, timezone, timedelta
from typing import Any, Callable, Optional
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import requests

from .nest_events import claim_nest_milestone, record_nest_event

BASE_TABLE_LABELS = {
    "people": {
        "first_name": "First Name",
        "last_name": "Last Name",
        "email": "Email",
        "phone": "Phone",
        "notes": "Notes",
    },
    "appointments": {
        "date": "Date",
        "time": "Time",
        "duration": "Duration",
        "status": "Status",
        "staff_id": "Staff ID",
        "assigned_receptionist": "Assigned Receptionist",
        "notes": "Appointment Notes",
    },
    "staff": {
        "full_name": "Full Name",
        "role": "Role",
        "email": "Email",
        "phone": "Phone",
    },
}

TABLE_CONTEXT_ALIASES = {
    "people": ("people", "person"),
    "appointments": ("appointments", "appointment"),
    "staff": ("staff",),
}

AGENT_REF_PREFIXES = {"rec", "agent", "receptionist"}
APPOINTMENT_ALLOWED_STATUSES = {"pending", "confirmed", "cancelled", "completed", "missed"}


def has_documented_call_consent(person: Optional[dict]) -> bool:
    if not isinstance(person, dict):
        return False
    do_not_call = person.get("do_not_call")
    if do_not_call is True or str(do_not_call or "").strip().lower() in {"1", "true", "yes", "on"}:
        return False
    value = person.get("consent_call")
    has_consent_flag = value is True or str(value or "").strip().lower() in {"1", "true", "yes", "on"}
    consent_source = str(person.get("consent_call_source") or "").strip()
    consent_recorded_at = person.get("consent_call_recorded_at")
    consent_scope = str(person.get("consent_call_scope") or "").strip()
    return has_consent_flag and bool(consent_source) and bool(consent_recorded_at) and bool(consent_scope)


def build_outbound_ai_disclosure(*, assistant_name: str, business_name: str, purpose: str) -> str:
    clean_purpose = re.sub(r"\s+", " ", str(purpose or "a service update")).strip()[:180]
    return (
        f"Hello, this is {assistant_name}, an AI assistant calling on behalf of {business_name}. "
        f"This call may be recorded and transcribed. I'm calling about {clean_purpose}. "
        "Is now an okay time to talk?"
    )

# These are the definitions exposed by the active Scenarios Builder. Keep this
# list intentionally separate from the legacy intent/checkpoint vocabulary so
# an old key cannot be activated through imported or hand-built scenario JSON.
SCENARIO_TRIGGER_KEYS = {
    "no_trigger",
    "incoming_call",
    "record_created",
    "record_updated",
    "appointment_created",
    "appointment_updated",
    "appointment_cancelled",
    "appointment_rescheduled",
    "appointment_confirmed",
    "appointment_soon",
    "appointment_completed",
    "appointment_missed",
    "payment_received",
    "payment_failed",
    "refund_issued",
    "subscription_created",
}
SCENARIO_ACTION_KEYS = {
    "call_customer",
    "search_records",
    "create_new_record",
    "update_record",
    "search_appointments",
    "create_appointment",
    "update_appointment",
    "cancel_appointment",
    "create_customer",
    "update_customer",
    "create_payment",
    "send_payment_link",
    "create_invoice",
    "send_invoice",
    "refund_payment",
    "cancel_subscription",
    "send_email",
}
SCENARIO_UTILITY_KEYS = {"router", "iterator"}


def _scenario_json_list(value: Any) -> list:
    if isinstance(value, list):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


def _scenario_value_present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    return True


def validate_scenario_definition(scenario: Optional[dict]) -> list[str]:
    """Return concrete definition errors before an active flow can run."""
    if not isinstance(scenario, dict):
        return ["Scenario payload must be an object"]

    nodes = _scenario_json_list(scenario.get("nodes_data"))
    edges = _scenario_json_list(scenario.get("edges_data"))
    errors = []
    if not nodes:
        return ["Scenario must contain at least one node"]

    node_ids = [str(node.get("id")) for node in nodes if isinstance(node, dict) and node.get("id")]
    if len(node_ids) != len(set(node_ids)):
        errors.append("Scenario node IDs must be unique")
    node_id_set = set(node_ids)
    triggers = [
        node for node in nodes
        if isinstance(node, dict) and node.get("configured") and node.get("categoryType") == "TRIGGERS"
    ]
    if len(triggers) != 1:
        errors.append("Scenario must contain exactly one configured trigger")

    for node in nodes:
        if not isinstance(node, dict):
            errors.append("Scenario contains an invalid node")
            continue
        if not node.get("configured"):
            errors.append(f"Node {node.get('id') or '(unknown)'} is not configured")
            continue

        category = str(node.get("categoryType") or "").upper()
        action_config = node.get("actionConfig") if isinstance(node.get("actionConfig"), dict) else {}
        appointment_config = node.get("appointmentConfig") if isinstance(node.get("appointmentConfig"), dict) else {}
        key = str(
            node.get("subOptionKey")
            or action_config.get("_key")
            or appointment_config.get("key")
            or ("router" if node.get("type") == "router" else "")
        ).strip().lower()
        # Appointment nodes may retain a small actionConfig (for example a
        # legacy _key) alongside their real appointmentConfig. Validate the
        # effective merged configuration so persistence/reload cannot make a
        # valid appointment look unconfigured.
        config = {**action_config, **appointment_config}

        if category == "TRIGGERS":
            if key not in SCENARIO_TRIGGER_KEYS:
                errors.append(f"Unsupported trigger: {key or '(missing)'}")
            if key == "appointment_soon":
                trigger_filter = node.get("triggerFilter") if isinstance(node.get("triggerFilter"), dict) else {}
                try:
                    offset = (int(trigger_filter.get("hours") or 0) * 60) + int(trigger_filter.get("minutes") or 0)
                except (TypeError, ValueError):
                    offset = -1
                if offset < 0:
                    errors.append("Appointment Soon requires a valid reminder offset")
        elif category == "ACTIONS":
            if key not in SCENARIO_ACTION_KEYS:
                errors.append(f"Unsupported action: {key or '(missing)'}")
        elif category == "UTILITIES":
            if key not in SCENARIO_UTILITY_KEYS:
                errors.append(f"Unsupported utility: {key or '(missing)'}")
            if key == "iterator" and not _scenario_value_present(config.get("collection_path") or config.get("collection") or config.get("array_path")):
                errors.append("Iterator requires a collection path")
        else:
            errors.append(f"Unsupported node category: {category or '(missing)'}")

        if key == "create_new_record":
            record_values = [
                value for name, value in config.items()
                if not name.startswith("_") and name not in {"target_table", "table", "record_id"}
            ]
            if not any(_scenario_value_present(value) for value in record_values):
                errors.append("Create New Person requires at least one person field")
        elif key == "update_record":
            if not _scenario_value_present(config.get("record_id")):
                errors.append("Update Person requires a record ID")
            update_values = [
                value for name, value in config.items()
                if not name.startswith("_") and name not in {"target_table", "table", "record_id", "record_lookup_value"}
            ]
            if not any(_scenario_value_present(value) for value in update_values):
                errors.append("Update Person requires at least one field to change")
        elif key == "create_appointment":
            if not _scenario_value_present(config.get("date") or config.get("field_date")):
                errors.append("Create Appointment requires a date")
            if not _scenario_value_present(config.get("time") or config.get("field_time")):
                errors.append("Create Appointment requires a time")
        elif key in {"create_payment", "send_payment_link", "create_invoice"}:
            if not _scenario_value_present(config.get("amount")):
                errors.append(f"{key} requires an amount")
        elif key == "send_email":
            if not _scenario_value_present(config.get("to")):
                errors.append("Send Email requires a recipient")
            if not _scenario_value_present(config.get("subject")):
                errors.append("Send Email requires a subject")
        elif key == "create_customer":
            if not any(_scenario_value_present(config.get(name)) for name in ("person_id", "customer_name", "customer_email", "customer_phone")):
                errors.append("Create Customer requires a person or customer details")
        elif key == "update_customer":
            if not any(_scenario_value_present(config.get(name)) for name in ("customer_id", "person_id")):
                errors.append("Update Customer requires a customer ID or person ID")

    for edge in edges:
        if not isinstance(edge, dict) or not edge.get("from") or not edge.get("to"):
            errors.append("Scenario contains an invalid edge")
            continue
        if str(edge.get("from")) not in node_id_set or str(edge.get("to")) not in node_id_set:
            errors.append(f"Edge references a missing node: {edge.get('from')} -> {edge.get('to')}")

    if len(triggers) == 1 and node_ids:
        outgoing = {}
        for edge in edges:
            if isinstance(edge, dict) and edge.get("from") and edge.get("to"):
                outgoing.setdefault(str(edge["from"]), []).append(str(edge["to"]))
        reachable = {str(triggers[0].get("id"))}
        queue = list(reachable)
        while queue:
            current = queue.pop(0)
            for target in outgoing.get(current, []):
                if target not in reachable:
                    reachable.add(target)
                    queue.append(target)
        unreachable = [node_id for node_id in node_ids if node_id not in reachable]
        if unreachable:
            errors.append(f"Scenario contains unreachable nodes: {', '.join(unreachable)}")

    trigger_key = str(triggers[0].get("subOptionKey") or "").strip().lower() if len(triggers) == 1 else ""
    if trigger_key == "no_trigger":
        schedule_config = scenario.get("schedule_config")
        if isinstance(schedule_config, str):
            try:
                schedule_config = json.loads(schedule_config)
            except Exception:
                schedule_config = {}
        if not isinstance(schedule_config, dict) or schedule_config.get("mode") != "scheduled":
            errors.append("No Trigger scenarios require an active schedule")

    return list(dict.fromkeys(errors))


def normalize_phone_number(phone_value: Optional[str]) -> Optional[str]:
    if phone_value is None:
        return None
    digits = "".join(ch for ch in str(phone_value) if ch.isdigit())
    if not digits:
        return None
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if len(digits) == 10:
        return f"+1{digits}"
    if str(phone_value).strip().startswith("+"):
        return str(phone_value).strip()
    return f"+{digits}"


def normalize_receptionist_direction(value: Any) -> str:
    normalized = str(value or "all").strip().lower()
    if normalized == "incoming":
        return "inbound"
    if normalized == "outgoing":
        return "outbound"
    if normalized in {"off", "disabled"}:
        return "none"
    return normalized if normalized in {"inbound", "outbound", "all", "none"} else "all"


def receptionist_direction_allows(call_direction: str, receptionist_direction: Any) -> bool:
    normalized_call_direction = str(call_direction or "").strip().lower()
    normalized_receptionist_direction = normalize_receptionist_direction(receptionist_direction)
    if normalized_call_direction == "inbound":
        return normalized_receptionist_direction in {"inbound", "all"}
    if normalized_call_direction in {"outbound", "outgoing"}:
        return normalized_receptionist_direction in {"outbound", "all"}
    return False


def format_person_display_name(person: Optional[dict]) -> str:
    if not person:
        return ""
    first_name = str(person.get("first_name") or "").strip()
    last_name = str(person.get("last_name") or "").strip()
    full_name = " ".join(part for part in [first_name, last_name] if part).strip()
    if full_name:
        return full_name
    return str(person.get("name") or person.get("full_name") or "").strip()


TRIGGER_EVENT_MAP = {
    "incoming_call": "incoming_call",
    "call_answered": "call_answered",
    "missed_call": "missed_call",
    "call_failed": "call_failed",
    "voicemail_received": "voicemail_received",
    "sms_received": "sms_received",
    "sms_sent": "sms_sent",
    "record_updated": "record_updated",
    "record_created": "record_created",
    "appointment_created": "appointment_created",
    "appointment_updated": "appointment_updated",
    "appointment_cancelled": "appointment_cancelled",
    "appointment_rescheduled": "appointment_rescheduled",
    "appointment_confirmed": "appointment_confirmed",
    "appointment_completed": "appointment_completed",
    "appointment_missed": "appointment_missed",
    "appointment_reminder": "appointment_reminder",
    "appointment_soon": "appointment_reminder",
    "payment_received": "payment_received",
    "payment_failed": "payment_failed",
    "refund_issued": "refund_issued",
    "subscription_created": "subscription_created",
    "payment_succeeded": "payment_received",
    "payment_link_sent": "payment_link_sent",
    "manual_trigger": "manual_trigger",
}

SCHEDULE_JOB_TYPE = "scenario_schedule"
APPOINTMENT_REMINDER_JOB_TYPE = "scenario_appointment_reminder"
SCHEDULE_TRIGGER_EVENT = "scheduled_no_trigger"
WEEKDAY_INDEX = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}

TABLE_REF_ALIASES = {
    "person": "people",
    "payment": "payments",
    "invoice": "invoices",
    "appointment": "appointments",
    "service": "services",
    "staff": "staff",
    "receptionist": "hired_receptionists",
    "business": "businesses",
}

TABLE_REF_REVERSE_ALIASES = {value: key for key, value in TABLE_REF_ALIASES.items()}
ITERATOR_STATE_KEYS = {"iterator", "_iterator_state", "_iterator_branch_mode"}


def deep_get(data: Any, dotted_key: str):
    if not dotted_key:
        return None
    value = data
    for part in dotted_key.split("."):
        if value is None:
            return None
        if isinstance(value, dict):
            if part.startswith("custom_") and isinstance(value.get("custom_fields"), dict):
                custom_value = value["custom_fields"].get(part)
                value = custom_value if custom_value is not None else value.get(part)
            else:
                value = value.get(part)
        elif isinstance(value, list):
            if not part.isdigit():
                return None
            idx = int(part)
            if idx < 0 or idx >= len(value):
                return None
            value = value[idx]
        else:
            return None
    return value


def normalize_condition_ref(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    stripped = value.strip()
    if stripped.startswith("{{") and stripped.endswith("}}"):
        return stripped[2:-2].strip()
    return stripped


def is_empty_value(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (list, dict, tuple, set)):
        return len(value) == 0
    return False


def coerce_bool(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if value == 1:
            return True
        if value == 0:
            return False
        return None
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y"}:
            return True
        if normalized in {"false", "0", "no", "n"}:
            return False
    return None


def coerce_number(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        stripped = value.strip().replace(",", "")
        if stripped == "":
            return None
        try:
            return float(stripped)
        except ValueError:
            return None
    return None


def coerce_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, date) and not isinstance(value, datetime):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    if not stripped:
        return None
    normalized = stripped.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def normalize_string(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def normalize_appointment_status(value: Any, fallback: str = "pending") -> str:
    normalized = normalize_string(value).lower()
    if normalized in APPOINTMENT_ALLOWED_STATUSES:
        return normalized
    return fallback


def normalize_appointment_duration(value: Any, fallback: int = 30) -> int:
    try:
        parsed = int(value)
    except Exception:
        return fallback
    if parsed <= 0:
        return fallback
    return min(parsed, 1440)


def normalize_appointment_date_value(value: Any, fallback: Optional[str] = None) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        stripped = value.strip()
        if stripped:
            candidate = stripped.replace("Z", "+00:00")
            try:
                return datetime.fromisoformat(candidate).date().isoformat()
            except ValueError:
                pass
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y", "%m/%d/%y", "%m-%d-%y"):
                try:
                    return datetime.strptime(stripped, fmt).date().isoformat()
                except ValueError:
                    continue
    return fallback or datetime.now().date().isoformat()


def normalize_appointment_time_value(value: Any, fallback: str = "09:00") -> str:
    if isinstance(value, time):
        return value.strftime("%H:%M")
    if isinstance(value, datetime):
        return value.strftime("%H:%M")
    if isinstance(value, str):
        stripped = value.strip()
        if stripped:
            try:
                return datetime.strptime(stripped, "%H:%M").strftime("%H:%M")
            except ValueError:
                pass
            for fmt in ("%I:%M %p", "%I:%M%p", "%I %p", "%I%p"):
                try:
                    return datetime.strptime(stripped.upper(), fmt).strftime("%H:%M")
                except ValueError:
                    continue
            return stripped
    return fallback


def uuid_or_none(value: Any) -> Optional[str]:
    if value is None:
        return None
    try:
        return str(UUID(str(value)))
    except Exception:
        return None


def values_equal(actual: Any, expected: Any) -> bool:
    actual_bool = coerce_bool(actual)
    expected_bool = coerce_bool(expected)
    if actual_bool is not None and expected_bool is not None:
        return actual_bool == expected_bool

    actual_number = coerce_number(actual)
    expected_number = coerce_number(expected)
    if actual_number is not None and expected_number is not None:
        return actual_number == expected_number

    actual_dt = coerce_datetime(actual)
    expected_dt = coerce_datetime(expected)
    if actual_dt is not None and expected_dt is not None:
        return actual_dt == expected_dt

    if isinstance(actual, list):
        expected_normalized = normalize_string(expected).lower()
        return any(normalize_string(item).lower() == expected_normalized for item in actual)

    return normalize_string(actual).lower() == normalize_string(expected).lower()


def compare_ordered_values(actual: Any, expected: Any) -> Optional[int]:
    actual_number = coerce_number(actual)
    expected_number = coerce_number(expected)
    if actual_number is not None and expected_number is not None:
        return -1 if actual_number < expected_number else (1 if actual_number > expected_number else 0)

    actual_dt = coerce_datetime(actual)
    expected_dt = coerce_datetime(expected)
    if actual_dt is not None and expected_dt is not None:
        return -1 if actual_dt < expected_dt else (1 if actual_dt > expected_dt else 0)

    actual_string = normalize_string(actual).lower()
    expected_string = normalize_string(expected).lower()
    if actual_string == "" or expected_string == "":
        return None
    return -1 if actual_string < expected_string else (1 if actual_string > expected_string else 0)


def evaluate_rule(rule: dict, context: dict) -> bool:
    variable = normalize_condition_ref(rule.get("variable") or "")
    operator = rule.get("operator") or ""
    expected = normalize_condition_ref(rule.get("value"))
    value = deep_get(context, variable)

    if operator == "equals":
        return values_equal(value, expected)
    if operator == "not_equals":
        return not values_equal(value, expected)
    if operator == "contains":
        if isinstance(value, list):
            expected_normalized = normalize_string(expected).lower()
            return any(expected_normalized in normalize_string(item).lower() for item in value)
        return normalize_string(expected).lower() in normalize_string(value).lower()
    if operator == "not_contains":
        if isinstance(value, list):
            expected_normalized = normalize_string(expected).lower()
            return not any(expected_normalized in normalize_string(item).lower() for item in value)
        return normalize_string(expected).lower() not in normalize_string(value).lower()
    if operator == "is_empty":
        return is_empty_value(value)
    if operator == "is_not_empty":
        return not is_empty_value(value)
    if operator == "greater_than":
        comparison = compare_ordered_values(value, expected)
        return comparison is not None and comparison > 0
    if operator == "less_than":
        comparison = compare_ordered_values(value, expected)
        return comparison is not None and comparison < 0
    if operator == "includes":
        if isinstance(value, list):
            expected_normalized = normalize_string(expected).lower()
            return any(normalize_string(item).lower() == expected_normalized for item in value)
        if isinstance(value, str):
            parts = [part.strip() for part in value.split(",") if part.strip()]
            expected_normalized = normalize_string(expected).lower()
            return any(part.lower() == expected_normalized for part in parts)
        return False
    if operator == "does_not_include":
        if isinstance(value, list):
            expected_normalized = normalize_string(expected).lower()
            return not any(normalize_string(item).lower() == expected_normalized for item in value)
        if isinstance(value, str):
            parts = [part.strip() for part in value.split(",") if part.strip()]
            expected_normalized = normalize_string(expected).lower()
            return not any(part.lower() == expected_normalized for part in parts)
        return True
    if operator == "before":
        comparison = compare_ordered_values(value, expected)
        return comparison is not None and comparison < 0
    if operator == "after":
        comparison = compare_ordered_values(value, expected)
        return comparison is not None and comparison > 0
    if operator == "on_or_before":
        comparison = compare_ordered_values(value, expected)
        return comparison is not None and comparison <= 0
    if operator == "on_or_after":
        comparison = compare_ordered_values(value, expected)
        return comparison is not None and comparison >= 0

    logging.warning("[ConditionEvaluator] Unknown operator: %s", operator)
    return False


def evaluate_conditions(rules: list[dict], context: dict) -> bool:
    if not rules:
        return True
    result = evaluate_rule(rules[0], context)
    for rule in rules[1:]:
        next_result = evaluate_rule(rule, context)
        if (rule.get("logic") or "and").lower() == "or":
            result = result or next_result
        else:
            result = result and next_result
    return result


def deep_merge_dicts(base: Optional[dict], updates: Optional[dict]) -> dict:
    merged = dict(base or {})
    for key, value in (updates or {}).items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge_dicts(merged.get(key), value)
        else:
            merged[key] = value
    return merged


class ScenarioActionExecutor:
    def __init__(self, supabase, callbacks: dict[str, Callable], base_url: str, plan_access_checker: Optional[Callable] = None):
        self.supabase = supabase
        self.callbacks = callbacks
        self.base_url = base_url.rstrip("/")
        self.plan_access_checker = plan_access_checker

    def _resolve_variables(self, value: Any, context: dict):
        if not isinstance(value, str):
            return value

        def replacer(match):
            key = match.group(1).strip()
            resolved = deep_get(context, key)
            parts = key.split(".")
            if resolved is None and len(parts) >= 3 and parts[0] in {"rec", "agent", "receptionist"}:
                resolved = deep_get(context, ".".join(parts[1:]))
            if resolved is None and isinstance(context.get("agent"), dict):
                resolved = context["agent"].get(key)
            return str(resolved) if resolved is not None else match.group(0)

        return re.sub(r"\{\{([^}]+)\}\}", replacer, value)

    def _normalize_table_key(self, table_key: Optional[str]) -> str:
        normalized = str(table_key or "").strip().lower()
        return TABLE_REF_ALIASES.get(normalized, normalized)

    def _preferred_table_ref(self, table_key: Optional[str]) -> str:
        normalized = self._normalize_table_key(table_key)
        return TABLE_REF_REVERSE_ALIASES.get(normalized, normalized)

    def _iter_string_values(self, value: Any):
        if isinstance(value, str):
            yield value
            return
        if isinstance(value, dict):
            for nested in value.values():
                yield from self._iter_string_values(nested)
            return
        if isinstance(value, list):
            for nested in value:
                yield from self._iter_string_values(nested)

    def _extract_agent_refs_from_string(self, value: str):
        refs = []
        if not isinstance(value, str) or not value:
            return refs

        seen = set()
        template_regex = re.compile(r"\{\{([^}]+)\}\}")
        plain_regex = re.compile(r"\b(rec|agent|receptionist)\.([a-z0-9_]+)\.([a-z0-9_.]+)\b", re.IGNORECASE)

        for match in template_regex.finditer(value):
            ref = match.group(1).strip()
            parts = [part.strip() for part in ref.split(".") if part.strip()]
            if len(parts) >= 3 and parts[0].lower() in AGENT_REF_PREFIXES:
                table_key = self._normalize_table_key(parts[1])
                field_key = ".".join(parts[2:])
                token = (table_key, field_key)
                if token not in seen:
                    refs.append({"table": table_key, "field": field_key})
                    seen.add(token)

        for match in plain_regex.finditer(value):
            table_key = self._normalize_table_key(match.group(2))
            field_key = match.group(3)
            token = (table_key, field_key)
            if token not in seen:
                refs.append({"table": table_key, "field": field_key})
                seen.add(token)
        return refs

    def _extract_template_refs_from_string(self, value: str):
        refs = []
        if not isinstance(value, str) or not value:
            return refs

        seen = set()
        template_regex = re.compile(r"\{\{([^}]+)\}\}")
        for match in template_regex.finditer(value):
            ref = match.group(1).strip()
            if not ref:
                continue
            parts = [part.strip() for part in ref.split(".") if part.strip()]
            if len(parts) >= 3 and parts[0].lower() in AGENT_REF_PREFIXES:
                prefix = parts[0].lower()
                table_key = self._normalize_table_key(parts[1])
                field_key = ".".join(parts[2:])
            elif len(parts) >= 2:
                prefix = None
                table_key = self._normalize_table_key(parts[0])
                field_key = ".".join(parts[1:])
            else:
                continue
            token = (prefix, table_key, field_key)
            if token in seen:
                continue
            seen.add(token)
            refs.append({
                "prefix": prefix,
                "table": table_key,
                "field": field_key,
                "raw_ref": ref,
            })
        return refs

    def _get_node_descendants(self, scenario: dict, start_node_id: str):
        edges = scenario.get("edges_data")
        if isinstance(edges, str):
            edges = json.loads(edges)
        edges = edges or []

        descendants = []
        visited = {start_node_id}
        queue = [start_node_id]
        while queue:
            current = queue.pop(0)
            for edge in edges:
                if edge.get("from") != current:
                    continue
                target = edge.get("to")
                if not target or target in visited:
                    continue
                visited.add(target)
                descendants.append(target)
                queue.append(target)
        return descendants

    def _format_field_label(self, table_key: str, field_key: str, context: dict) -> str:
        table_key = self._normalize_table_key(table_key)
        if table_key == "people":
            schema = self._get_people_custom_schema(context)
            custom_field = schema.get(field_key) or {}
            if custom_field.get("label"):
                return str(custom_field["label"])
            if str(field_key).startswith("custom_"):
                return ""
        base_label = ((BASE_TABLE_LABELS.get(table_key) or {}).get(field_key))
        if base_label:
            return base_label
        if field_key == "id":
            table_label = {
                "people": "Person",
                "person": "Person",
                "appointments": "Appointment",
                "appointment": "Appointment",
                "staff": "Staff",
                "services": "Service",
                "service": "Service",
            }.get(table_key, table_key.rstrip("s").replace("_", " ").title())
            return f"{table_label} ID"
        return field_key.replace("_", " ").replace(".", " ").title()

    def _format_field_description(self, table_key: str, field_key: str, context: dict) -> str:
        table_key = self._normalize_table_key(table_key)
        if table_key == "people":
            schema = self._get_people_custom_schema(context)
            config = (schema.get(field_key) or {}).get("config") or {}
            description = config.get("description")
            if description:
                return str(description)
        return ""

    def _build_requirement_key_metadata(self, table_key: str, field_key: str, label: str, context: dict) -> dict:
        table_key = self._normalize_table_key(table_key)
        ref_table = self._preferred_table_ref(table_key)
        schema = self._get_people_custom_schema(context) if table_key == "people" else {}
        schema_label = (schema.get(field_key) or {}).get("label")
        label_key = self._custom_dynamic_variable_name(schema_label or label)

        return_keys = []
        priority_keys = [label_key, f"rec.{ref_table}.{field_key}", f"{table_key}.{field_key}", field_key]
        if table_key != "people" or not str(field_key).startswith("custom_"):
            priority_keys = [f"rec.{ref_table}.{field_key}", f"{table_key}.{field_key}", label_key, field_key]

        for candidate in priority_keys:
            if candidate and candidate not in return_keys:
                return_keys.append(candidate)

        return {
            "table": table_key,
            "table_ref": ref_table,
            "field": field_key,
            "path": f"{table_key}.{field_key}",
            "ref_path": f"{ref_table}.{field_key}",
            "label": label,
            "description": self._format_field_description(table_key, field_key, context),
            "preferred_return_key": return_keys[0] if return_keys else field_key,
            "accepted_return_keys": return_keys,
        }

    def _is_valid_agent_requirement(self, table_key: str, field_key: str, context: dict) -> bool:
        table_key = self._normalize_table_key(table_key)
        if table_key == "people" and str(field_key).startswith("custom_"):
            schema = self._get_people_custom_schema(context)
            if field_key not in schema:
                logging.warning(
                    "[ActionExecutor] Skipping inactive or missing custom field requirement: %s.%s",
                    table_key,
                    field_key,
                )
                return False
        return True

    def _is_agent_safe_label(self, label: Optional[str]) -> bool:
        if not label:
            return False
        normalized = str(label).strip().lower()
        return not re.match(r"^custom\s+(text|boolean|number|date)\s+\d+", normalized)

    def _infer_required_agent_fields(self, scenario: Optional[dict], call_node_id: str, context: dict):
        if not scenario or not call_node_id:
            return []

        nodes = scenario.get("nodes_data")
        if isinstance(nodes, str):
            nodes = json.loads(nodes)
        node_map = {
            node.get("id"): node
            for node in (nodes or [])
            if isinstance(node, dict) and node.get("id")
        }

        requirements = []
        seen = set()
        for node_id in self._get_node_descendants(scenario, call_node_id):
            node = node_map.get(node_id) or {}
            for text_value in self._iter_string_values(node):
                for ref in self._extract_agent_refs_from_string(text_value):
                    table_key = ref["table"]
                    field_key = ref["field"]
                    token = (table_key, field_key)
                    if token in seen:
                        continue
                    if not self._is_valid_agent_requirement(table_key, field_key, context):
                        continue
                    seen.add(token)
                    label = self._format_field_label(table_key, field_key, context)
                    if not self._is_agent_safe_label(label):
                        logging.warning(
                            "[ActionExecutor] Skipping unsafe agent-facing field label for requirement: %s.%s label=%s",
                            table_key,
                            field_key,
                            label,
                        )
                        continue
                    requirements.append(self._build_requirement_key_metadata(table_key, field_key, label, context))
        return requirements

    def _flatten_agent_payload(self, value: Any):
        if not isinstance(value, dict):
            return value
        if "value" in value:
            candidate = value.get("value")
            if isinstance(candidate, dict):
                return self._flatten_agent_payload(candidate)
            if candidate not in (None, ""):
                return candidate
        flattened = {}
        for key, nested in value.items():
            flattened[key] = self._flatten_agent_payload(nested)
        return flattened

    def _resolve_agent_requirement_value(self, agent_data: dict, requirement: dict):
        table_key = self._normalize_table_key(requirement.get("table"))
        field_key = requirement.get("field")
        path = requirement.get("path")
        accepted_return_keys = requirement.get("accepted_return_keys") or []
        candidates = [
            deep_get(agent_data, path),
            deep_get(agent_data, f"{table_key}.{field_key}"),
            deep_get(agent_data, f"{path}.value"),
            deep_get(agent_data, f"{field_key}.value"),
            deep_get(agent_data, field_key),
            agent_data.get(path) if isinstance(agent_data, dict) else None,
            agent_data.get(field_key) if isinstance(agent_data, dict) else None,
        ]
        for return_key in accepted_return_keys:
            candidates.extend([
                deep_get(agent_data, return_key),
                deep_get(agent_data, f"{return_key}.value"),
                agent_data.get(return_key) if isinstance(agent_data, dict) else None,
            ])
        for candidate in candidates:
            if candidate not in (None, ""):
                return candidate
        return None

    def _resolve_downstream_ref_value(self, context: dict, raw_ref: str):
        resolved = self._resolve_variables(f"{{{{{raw_ref}}}}}", context)
        if self._has_unresolved_template(resolved):
            return None
        return resolved

    def _format_downstream_return_key(self, prefix: Optional[str], table_key: str, field_key: str, label: str, context: dict):
        if prefix in AGENT_REF_PREFIXES:
            ref_table = self._preferred_table_ref(table_key)
            schema = self._get_people_custom_schema(context) if table_key == "people" else {}
            schema_label = (schema.get(field_key) or {}).get("label")
            label_key = self._custom_dynamic_variable_name(schema_label or label)
            if table_key == "people" and str(field_key).startswith("custom_") and label_key:
                return label_key
            return f"rec.{ref_table}.{field_key}"
        if field_key == "id":
            return f"{self._preferred_table_ref(table_key)}_id"
        return field_key

    def _build_downstream_data(self, scenario: Optional[dict], call_node_id: str, context: dict, requirements: Optional[list[dict]] = None):
        if not scenario or not call_node_id:
            return []

        nodes = scenario.get("nodes_data")
        if isinstance(nodes, str):
            nodes = json.loads(nodes)
        node_map = {
            node.get("id"): node
            for node in (nodes or [])
            if isinstance(node, dict) and node.get("id")
        }

        downstream = []
        seen = set()

        for requirement in requirements or []:
            return_key = requirement.get("preferred_return_key") or requirement.get("field")
            if not return_key or return_key in seen:
                continue
            seen.add(return_key)
            current_value = self._resolve_agent_requirement_value(context.get("agent") or {}, requirement)
            if current_value in (None, ""):
                current_value = self._resolve_downstream_ref_value(context, requirement.get("ref_path") or return_key)
            downstream.append({
                "label": requirement.get("label"),
                "description": requirement.get("description") or "",
                "return_key": return_key,
                "current_value": current_value,
            })

        for node_id in self._get_node_descendants(scenario, call_node_id):
            node = node_map.get(node_id) or {}
            for text_value in self._iter_string_values(node):
                for ref in self._extract_template_refs_from_string(text_value):
                    if ref.get("prefix") in AGENT_REF_PREFIXES:
                        continue
                    value = self._resolve_downstream_ref_value(context, ref["raw_ref"])
                    if value in (None, ""):
                        continue
                    label = self._format_field_label(ref["table"], ref["field"], context)
                    return_key = self._format_downstream_return_key(ref.get("prefix"), ref["table"], ref["field"], label, context)
                    if not return_key or return_key in seen:
                        continue
                    seen.add(return_key)
                    downstream.append({
                        "label": label,
                        "description": self._format_field_description(ref["table"], ref["field"], context),
                        "return_key": return_key,
                        "current_value": value,
                    })

        return downstream

    def _deep_get_any(self, data: Any, paths: list[str]):
        for path in paths:
            value = deep_get(data, path)
            if value not in (None, ""):
                return value
        return None

    def _get_agent_value_any(self, context: dict, paths: list[str]):
        agent_data = context.get("agent") if isinstance(context.get("agent"), dict) else {}
        for path in paths:
            candidates = [
                deep_get(context, path),
                deep_get(agent_data, path),
                agent_data.get(path) if isinstance(agent_data, dict) else None,
            ]
            if path.startswith("agent."):
                candidates.append(deep_get(agent_data, path[6:]))
            for value in candidates:
                if value not in (None, ""):
                    return value
        return None

    def _hydrate_agent_appointment_context(self, context: dict):
        if not isinstance(context.get("agent"), dict):
            return

        mappings = [
            ("appointment", "date", ["rec.appointment.date", "appointment.date", "rec.appointment_date"]),
            ("appointment", "time", ["rec.appointment.time", "appointment.time", "rec.appointment_time"]),
            ("appointment", "service_id", ["rec.appointment.service_id", "rec.appointment.service", "rec.service.id", "rec.Service.Record ID", "service.id", "service_id"]),
            ("appointment", "staff_id", ["rec.staff.id", "rec.Staff.Record ID", "rec.appointment.staff_id", "staff.id", "staff_id"]),
            ("appointment", "person_id", ["rec.person.id", "rec.Person.Record ID", "rec.appointment.person_id", "person.id", "person_id"]),
            ("service", "id", ["rec.service.id", "rec.appointment.service", "rec.Service.Record ID", "rec.appointment.service_id", "service.id", "service_id"]),
            ("staff", "id", ["rec.staff.id", "rec.Staff.Record ID", "rec.appointment.staff_id", "staff.id", "staff_id"]),
            ("person", "id", ["rec.person.id", "rec.Person.Record ID", "rec.appointment.person_id", "person.id", "person_id"]),
        ]

        for context_key, field_key, paths in mappings:
            value = self._get_agent_value_any(context, paths)
            if value in (None, ""):
                continue
            target = context.get(context_key)
            if not isinstance(target, dict):
                target = {}
            target[field_key] = value
            context[context_key] = target

    def _project_agent_requirements_into_context(self, context: dict, agent_data: dict, requirements: list[dict]):
        if not isinstance(agent_data, dict):
            return
        for requirement in requirements:
            table_key = self._normalize_table_key(requirement.get("table"))
            field_key = requirement.get("field")
            if not table_key or not field_key:
                continue
            value = self._resolve_agent_requirement_value(agent_data, requirement)
            if value in (None, ""):
                continue
            for context_key in TABLE_CONTEXT_ALIASES.get(table_key, (table_key,)):
                current_value = context.get(context_key)
                if not isinstance(current_value, dict):
                    current_value = {}
                if table_key == "people" and str(field_key).startswith("custom_"):
                    custom_fields = current_value.get("custom_fields")
                    if not isinstance(custom_fields, dict):
                        custom_fields = {}
                    custom_fields[field_key] = value
                    current_value["custom_fields"] = custom_fields
                    context[context_key] = current_value
                    continue
                nested = current_value
                parts = [part for part in str(field_key).split(".") if part]
                for part in parts[:-1]:
                    next_cursor = nested.get(part)
                    if not isinstance(next_cursor, dict):
                        next_cursor = {}
                        nested[part] = next_cursor
                    nested = next_cursor
                nested[parts[-1]] = value
                context[context_key] = current_value

    def _build_agent_collection_state(self, context: dict, requirements: list[dict], paused_node_id: Optional[str] = None):
        agent_data = context.get("agent") if isinstance(context.get("agent"), dict) else {}
        required_fields = []
        collected_fields = []
        missing_fields = []
        for requirement in requirements:
            value = self._resolve_agent_requirement_value(agent_data, requirement)
            entry = {**requirement, "value": value}
            required_fields.append({
                k: requirement.get(k)
                for k in ("table", "table_ref", "field", "path", "ref_path", "label", "description", "preferred_return_key", "accepted_return_keys")
            })
            if value in (None, ""):
                missing_fields.append({
                    k: entry.get(k)
                    for k in ("table", "table_ref", "field", "path", "ref_path", "label", "description", "preferred_return_key", "accepted_return_keys")
                })
            else:
                collected_fields.append(entry)
        return {
            "paused_node_id": paused_node_id,
            "is_complete": len(missing_fields) == 0,
            "required_fields": required_fields,
            "collected_fields": collected_fields,
            "missing_fields": missing_fields,
        }

    def _parse_money_to_cents(self, value: Any):
        if value in (None, ""):
            return None
        if isinstance(value, (int, float)):
            return int(round(float(value) * 100))
        cleaned = str(value).strip().replace("$", "").replace(",", "")
        if not cleaned:
            return None
        return int(round(float(cleaned) * 100))

    def _get_people_custom_schema(self, context: dict) -> dict:
        business = context.get("business") or {}
        business_id = business.get("id") or context.get("business_id")
        if not business_id:
            return {}
        try:
            response = (
                self.supabase.table("people_schema")
                .select("field_key, field_type, label, config")
                .eq("business_id", str(business_id))
                .eq("is_active", True)
                .execute()
            )
            return {
                row.get("field_key"): row
                for row in (response.data or [])
                if row.get("field_key")
            }
        except Exception as exc:
            logging.warning("[ActionExecutor] Could not load people custom schema: %s", exc)
            return {}

    def _get_people_custom_field_types(self, context: dict) -> dict:
        return {
            field_key: row.get("field_type")
            for field_key, row in self._get_people_custom_schema(context).items()
        }

    def _coerce_custom_field_value(self, value: Any, field_type: Optional[str]):
        if value in (None, ""):
            return value
        if field_type == "boolean":
            if isinstance(value, bool):
                return value
            normalized = str(value).strip().lower()
            if normalized in {"true", "yes", "1", "on"}:
                return True
            if normalized in {"false", "no", "0", "off"}:
                return False
        if field_type == "number":
            try:
                return float(value)
            except (TypeError, ValueError):
                return value
        return value

    def _custom_dynamic_variable_name(self, label: Optional[str]) -> Optional[str]:
        if not label:
            return None
        key = re.sub(r"[^a-z0-9]+", "_", str(label).strip().lower()).strip("_")
        return key or None

    def _has_unresolved_template(self, value: Any) -> bool:
        return isinstance(value, str) and re.search(r"\{\{[^}]+\}\}", value) is not None

    def _add_person_custom_dynamic_variables(self, dynamic_vars: dict, context: dict):
        person = context.get("person") or context.get("customer") or {}
        custom_fields = person.get("custom_fields") if isinstance(person, dict) else None
        if not isinstance(custom_fields, dict):
            return dynamic_vars
        schema = self._get_people_custom_schema(context)
        for field_key, value in custom_fields.items():
            if value is None:
                continue
            label_key = self._custom_dynamic_variable_name((schema.get(field_key) or {}).get("label"))
            if label_key and label_key not in dynamic_vars:
                dynamic_vars[label_key] = value
        return dynamic_vars

    def _find_elevenlabs_phone_number_id_for_business(self, context: dict) -> str:
        business = context.get("business") or {}
        elevenlabs_key = os.environ.get("ELEVENLABS_API_KEY")
        business_twilio_number = normalize_phone_number(business.get("twilio_number"))
        persisted_phone_number_id = (
            business.get("elevenlabs_phone_number_id")
            or context.get("elevenlabs_phone_number_id")
        )
        if persisted_phone_number_id:
            logging.info(
                "[ActionExecutor] Using assigned business line phone_number_id=%s business_id=%s",
                persisted_phone_number_id,
                business.get("id"),
            )
        if not elevenlabs_key:
            return str(persisted_phone_number_id or "")
        if not business_twilio_number:
            return str(persisted_phone_number_id or "")

        try:
            response = requests.get(
                "https://api.elevenlabs.io/v1/convai/phone-numbers",
                headers={
                    "xi-api-key": elevenlabs_key,
                    "Content-Type": "application/json",
                },
                timeout=30,
            )
            response.raise_for_status()
            for item in response.json() or []:
                if normalize_phone_number(item.get("phone_number")) == business_twilio_number:
                    phone_number_id = str(item.get("phone_number_id") or "")
                    if phone_number_id:
                        if persisted_phone_number_id and str(persisted_phone_number_id) != phone_number_id:
                            logging.info(
                                "[ActionExecutor] Refreshing stale ElevenLabs phone number id for business %s: %s -> %s",
                                business.get("id"),
                                persisted_phone_number_id,
                                phone_number_id,
                            )
                        business["elevenlabs_phone_number_id"] = phone_number_id
                        context["business"] = business
                        context["elevenlabs_phone_number_id"] = phone_number_id
                        logging.info(
                            "[ActionExecutor] Resolved assigned business line by phone number business_id=%s phone_number=%s phone_number_id=%s",
                            business.get("id"),
                            business_twilio_number,
                            phone_number_id,
                        )
                        return phone_number_id
        except Exception as exc:
            logging.warning("[ActionExecutor] Could not resolve ElevenLabs phone number for business: %s", exc)

        return str(persisted_phone_number_id or "")

    def _string_or_none(self, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return str(value)

    async def execute(self, node: dict, context: dict):
        key = ((node.get("actionConfig") or {}).get("_key") or node.get("subOptionKey") or "").strip()
        if not key:
            return {"success": True, "data": {"action": "noop"}}

        handlers = {
            "search_records": self._search_records,
            "search_appointments": self._search_appointments,
            "update_record": self._update_record,
            "update_records": self._update_record,
            "create_new_record": self._create_record,
            "create_appointment": self._create_appointment,
            "update_appointment": self._update_appointment,
            "cancel_appointment": self._cancel_appointment,
            "call_customer": self._call_customer,
            "transfer_to_phone_number": self._transfer_call,
            "create_customer": self._create_customer,
            "update_customer": self._update_customer,
            "create_payment": self._create_payment,
            "send_payment_link": self._send_payment_link,
            "create_invoice": self._create_invoice,
            "send_invoice": self._send_invoice,
            "refund_payment": self._refund_payment,
            "cancel_subscription": self._cancel_subscription,
            "send_email": self._send_email,
            "send_to_customer": self._send_sms_placeholder,
            "hang_up": self._hang_up,
        }
        handler = handlers.get(key)
        if not handler:
            logging.warning("[ActionExecutor] Unknown action key: %s", key)
            return {"success": False, "error": f"Unknown action: {key}"}
        return await handler(node, context)

    async def _send_sms_placeholder(self, node: dict, context: dict):
        logging.info("[ActionExecutor] SMS action skipped: not configured")
        return {"success": True, "data": {"action": "send_to_customer", "skipped": True}}

    async def _hang_up(self, node: dict, context: dict):
        return {"success": True, "data": {"action": "hang_up"}}

    async def _search_records(self, node: dict, context: dict):
        try:
            config = node.get("actionConfig") or {}
            table = "people"
            limit = max(1, min(int(config.get("search_limit") or config.get("limit") or 10), 100))
            user_id = context.get("business", {}).get("user_id") or context.get("user_id")
            business_id = (context.get("business") or {}).get("id") or context.get("business_id")
            if not user_id and not business_id:
                return {"success": False, "error": "No business context for people search"}

            query = self.supabase.table(table).select("*").limit(limit)
            if business_id:
                query = query.eq("business_id", business_id)
            elif user_id:
                try:
                    query = query.eq("user_id", str(user_id))
                except Exception:
                    pass
            response = query.execute()
            records = response.data or []
            logging.info("🔎 %s: %s", table, len(records))
            return {
                "success": True,
                "data": {
                    "action": "search_records",
                    "table": table,
                    "records": records,
                    "count": len(records),
                },
            }
        except Exception as exc:
            logging.error("[ActionExecutor] searchRecords failed: %s", exc)
            return {"success": False, "error": str(exc)}

    async def _search_appointments(self, node: dict, context: dict):
        try:
            config = node.get("actionConfig") or {}
            limit = max(1, min(int(config.get("search_limit") or config.get("limit") or 10), 100))
            business_id = (context.get("business") or {}).get("id") or context.get("business_id")
            if business_id is None:
                return {"success": False, "error": "No business context for appointment search"}
            query = self.supabase.table("appointments").select("*").limit(limit)
            query = query.eq("business_id", business_id)
            response = query.execute()
            records = response.data or []
            logging.info("Search appointments: %s", len(records))
            return {
                "success": True,
                "data": {
                    "action": "search_appointments",
                    "table": "appointments",
                    "records": records,
                    "count": len(records),
                },
            }
        except Exception as exc:
            logging.error("[ActionExecutor] searchAppointments failed: %s", exc)
            return {"success": False, "error": str(exc)}

    async def _update_record(self, node: dict, context: dict):
        try:
            config = node.get("actionConfig") or {}
            table = str(config.get("target_table") or config.get("table") or "people").lower().replace(" ", "_")
            if table != "people":
                return {"success": False, "error": f"Unsupported record table: {table}"}
            record_id = self._resolve_variables(config.get("record_id") or "", context)
            if not record_id:
                return {"success": False, "error": "No record ID specified"}

            business = context.get("business") or {}
            business_id = business.get("id") or context.get("business_id")
            user_id = business.get("user_id") or context.get("user_id")
            existing_query = self.supabase.table(table).select("*").eq("id", str(record_id))
            if business_id is not None:
                existing_query = existing_query.eq("business_id", business_id)
            elif user_id:
                existing_query = existing_query.eq("user_id", str(user_id))
            existing_response = existing_query.limit(1).execute()
            existing = (existing_response.data or [None])[0]
            if not existing:
                return {"success": False, "error": f"Person {record_id} was not found for this business"}

            updates = {}
            custom_updates = {}
            custom_field_types = self._get_people_custom_field_types(context) if table == "people" else {}
            for key, value in config.items():
                if key.startswith("_") or key in {"target_table", "table", "record_id", "record_lookup_value"}:
                    continue
                if value in (None, ""):
                    continue
                column_key = key[6:] if key.startswith("field_") else key
                resolved_value = self._resolve_variables(value, context)
                if isinstance(resolved_value, str) and re.search(r"\{\{[^}]+\}\}", resolved_value):
                    return {"success": False, "error": f"Unresolved person field template: {resolved_value}"}
                if table == "people" and column_key.startswith("custom_"):
                    custom_updates[column_key] = self._coerce_custom_field_value(resolved_value, custom_field_types.get(column_key))
                else:
                    updates[column_key] = resolved_value
            if custom_updates:
                existing_custom_fields = {}
                try:
                    existing_custom_response = self.supabase.table("people").select("custom_fields").eq("id", str(record_id)).execute()
                    if existing_custom_response.data:
                        existing_custom_fields = existing_custom_response.data[0].get("custom_fields") or {}
                except Exception as exc:
                    logging.warning("[ActionExecutor] Could not load existing custom_fields for people:%s: %s", record_id, exc)
                updates["custom_fields"] = {**existing_custom_fields, **custom_updates}
            if not updates:
                return {"success": False, "error": "No person fields to update"}
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            self.supabase.table(table).update(updates).eq("id", str(record_id)).execute()
            logging.info("📝 %s:%s updated", table, record_id)
            row = {**existing, **updates, "id": record_id}
            self._emit_scenario_trigger("record_updated", {
                "record_id": row.get("id"),
                "person_id": row.get("id"),
                "user_id": row.get("user_id") or user_id,
                "business_id": row.get("business_id") or business_id,
                "person": row,
                "record": row,
            }, source_scenario_id=context.get("_scenarioId"), scenario_chain=context.get("scenario_chain"))
            return {"success": True, "data": {"action": "update_record", "table": table, **row}}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _create_record(self, node: dict, context: dict):
        try:
            config = node.get("actionConfig") or {}
            table = str(config.get("target_table") or config.get("table") or "people").lower().replace(" ", "_")
            if table != "people":
                return {"success": False, "error": f"Unsupported record table: {table}"}
            row = {}
            custom_updates = {}
            custom_field_types = self._get_people_custom_field_types(context) if table == "people" else {}
            for key, value in config.items():
                if key.startswith("_") or key in {"target_table", "table", "record_id"}:
                    continue
                if value in (None, ""):
                    continue
                column_key = key[6:] if key.startswith("field_") else key
                resolved_value = self._resolve_variables(value, context)
                if self._has_unresolved_template(resolved_value):
                    return {"success": False, "error": f"Unresolved person field template: {resolved_value}"}
                if table == "people" and column_key.startswith("custom_"):
                    custom_updates[column_key] = self._coerce_custom_field_value(resolved_value, custom_field_types.get(column_key))
                else:
                    row[column_key] = resolved_value
            if custom_updates:
                row["custom_fields"] = custom_updates
            if not row:
                return {"success": False, "error": "No person fields provided"}
            now = datetime.now(timezone.utc).isoformat()
            row.setdefault("created_at", now)
            row.setdefault("updated_at", now)
            if table == "people":
                business = context.get("business") or {}
                row.setdefault("user_id", business.get("user_id") or context.get("user_id"))
                row.setdefault("business_id", business.get("id") or context.get("business_id"))
                if not row.get("user_id") and not row.get("business_id"):
                    return {"success": False, "error": "No business context for person"}
            response = self.supabase.table(table).insert(row).execute()
            created = response.data[0] if response.data else row
            logging.info("🆕 %s:%s created", table, created.get("id"))
            if table == "people":
                self._emit_scenario_trigger("record_created", {
                    "record_id": created.get("id"),
                    "person_id": created.get("id"),
                    "user_id": created.get("user_id") or context.get("user_id"),
                    "business_id": created.get("business_id") or context.get("business_id"),
                    "person": created,
                    "record": created,
                }, source_scenario_id=context.get("_scenarioId"), scenario_chain=context.get("scenario_chain"))
            return {"success": True, "data": {"action": "create_new_record", "table": table, **created}}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    def _emit_scenario_trigger(
        self,
        trigger_key: str,
        payload: dict,
        *,
        source_scenario_id: Optional[str] = None,
        scenario_chain: Optional[list] = None,
    ):
        callback = self.callbacks.get("emit_scenario_trigger")
        if not callable(callback):
            return
        try:
            event_payload = dict(payload or {})
            chain = [str(item) for item in (scenario_chain or []) if item not in (None, "")]
            if source_scenario_id not in (None, "") and str(source_scenario_id) not in chain:
                chain.append(str(source_scenario_id))
            if chain:
                event_payload["scenario_chain"] = chain
            callback(trigger_key, event_payload)
        except Exception as exc:
            # The mutation already succeeded. Do not turn a trigger delivery
            # problem into a false action failure, but keep it observable.
            logging.error("[ActionExecutor] Failed to emit %s trigger: %s", trigger_key, exc, exc_info=True)

    def _emit_appointment_change_triggers(
        self,
        previous_appointment: Optional[dict],
        current_appointment: Optional[dict],
        *,
        business_id=None,
        include_updated: bool = True,
        source_scenario_id: Optional[str] = None,
        scenario_chain: Optional[list] = None,
    ):
        callback = self.callbacks.get("emit_appointment_change_triggers")
        if not callable(callback):
            return
        try:
            callback(
                previous_appointment,
                current_appointment,
                business_id=business_id,
                include_updated=include_updated,
                source_scenario_id=source_scenario_id,
                scenario_chain=scenario_chain,
            )
        except Exception as exc:
            logging.error("[ActionExecutor] Failed to emit appointment triggers: %s", exc, exc_info=True)

    async def _safe_appointment_person(self, raw_value: Any, business_id: Any = None):
        try:
            parsed = int(raw_value)
        except Exception:
            return None, None
        try:
            query = self.supabase.table("people").select("*").eq("id", parsed)
            if business_id is not None:
                query = query.eq("business_id", business_id)
            response = query.limit(1).execute()
            if not response.data:
                return None, None
            person = response.data[0]
            return parsed, person
        except Exception:
            return None, None

    async def _safe_appointment_service_id(self, raw_value: Any, business_id: Any = None):
        parsed = uuid_or_none(raw_value)
        if not parsed:
            return None
        try:
            query = self.supabase.table("services").select("id").eq("id", parsed)
            if business_id is not None:
                query = query.eq("business_id", business_id)
            response = query.limit(1).execute()
            return parsed if response.data else None
        except Exception:
            return None

    async def _safe_appointment_staff_id(self, raw_value: Any, business_id: Any = None):
        parsed = uuid_or_none(raw_value)
        if not parsed:
            return None, None
        try:
            query = self.supabase.table("staff").select("*").eq("id", parsed)
            if business_id is not None:
                query = query.eq("business_id", business_id)
            response = query.limit(1).execute()
            if not response.data:
                return None, None
            staff = response.data[0]
            return parsed, staff
        except Exception:
            return None, None

    async def _create_appointment(self, node: dict, context: dict):
        try:
            self._hydrate_agent_appointment_context(context)
            config = node.get("appointmentConfig") or node.get("actionConfig") or {}
            business = context.get("business") or {}
            business_id = business.get("id") or context.get("business_id")
            if business_id is None:
                return {"success": False, "error": "No business context for appointment"}
            resolved_date = self._resolve_variables(config.get("date") or config.get("field_date") or "", context)
            resolved_time = self._resolve_variables(config.get("time") or config.get("field_time") or "", context)
            if self._has_unresolved_template(resolved_date):
                resolved_date = self._deep_get_any(context, [
                    "agent.rec.appointment.date",
                    "agent.rec.appointment_date",
                    "appointment.date",
                    "rec.appointment.date",
                ]) or resolved_date
            if self._has_unresolved_template(resolved_time):
                resolved_time = self._deep_get_any(context, [
                    "agent.rec.appointment.time",
                    "agent.rec.appointment_time",
                    "appointment.time",
                    "rec.appointment.time",
                ]) or resolved_time
            if self._has_unresolved_template(resolved_date):
                return {"success": False, "error": f"Unresolved appointment date template: {resolved_date}"}
            if self._has_unresolved_template(resolved_time):
                return {"success": False, "error": f"Unresolved appointment time template: {resolved_time}"}
            raw_person_ref = self._resolve_variables(
                config.get("person_id") or config.get("field_person_id") or "", context
            )
            if self._has_unresolved_template(raw_person_ref):
                raw_person_ref = self._deep_get_any(context, [
                    "agent.rec.person.id",
                    "agent.rec.appointment.person_id",
                    "appointment.person_id",
                    "person.id",
                    "person_id",
                ]) or raw_person_ref
            if self._has_unresolved_template(raw_person_ref):
                return {"success": False, "error": f"Unresolved appointment person_id template: {raw_person_ref}"}
            resolved_person_id, _resolved_person = await self._safe_appointment_person(
                raw_person_ref or context.get("person", {}).get("id") or context.get("person_id"),
                business_id=business_id,
            )
            raw_service_id = self._resolve_variables(
                config.get("service_id") or config.get("field_service_id") or "",
                context,
            )
            if self._has_unresolved_template(raw_service_id):
                service_candidates = [
                    self._get_agent_value_any(context, [
                        "agent.rec.appointment.service_id",
                        "rec.appointment.service_id",
                        "agent.rec.appointment.service",
                        "rec.appointment.service",
                        "agent.rec.service.id",
                        "rec.service.id",
                        "agent.rec.Service.Record ID",
                        "rec.Service.Record ID",
                        "appointment.service_id",
                        "service.id",
                        "service_id",
                        # Some ElevenLabs missions return only `id`.
                        "agent.id",
                        "id",
                    ]),
                    context.get("appointment", {}).get("service_id"),
                    context.get("service_id"),
                    context.get("service", {}).get("id"),
                ]
                raw_service_id = next(
                    (candidate for candidate in service_candidates if candidate not in (None, "") and not self._has_unresolved_template(candidate)),
                    raw_service_id,
                )
            if self._has_unresolved_template(raw_service_id):
                logging.error(
                    "[ActionExecutor] unresolved appointment service_id raw=%s config_service_id=%s context_service=%s context_appointment=%s agent_keys=%s",
                    raw_service_id,
                    config.get("service_id") or config.get("field_service_id"),
                    json.dumps(context.get("service") or {}, default=str),
                    json.dumps(context.get("appointment") or {}, default=str),
                    sorted((context.get("agent") or {}).keys()) if isinstance(context.get("agent"), dict) else [],
                )
                return {"success": False, "error": f"Unresolved appointment service_id template: {raw_service_id}"}
            resolved_service_id = await self._safe_appointment_service_id(raw_service_id, business_id=business_id)
            raw_staff_id = self._resolve_variables(config.get("staff_id") or config.get("field_staff_id") or "", context)
            if self._has_unresolved_template(raw_staff_id):
                raw_staff_id = self._deep_get_any(context, [
                    "agent.rec.staff.id",
                    "agent.rec.appointment.staff_id",
                    "appointment.staff_id",
                    "staff.id",
                    "staff_id",
                ]) or raw_staff_id
            if self._has_unresolved_template(raw_staff_id):
                return {"success": False, "error": f"Unresolved appointment staff_id template: {raw_staff_id}"}
            resolved_staff_id, _resolved_staff = await self._safe_appointment_staff_id(raw_staff_id, business_id)
            if raw_person_ref not in (None, "") and resolved_person_id is None:
                return {"success": False, "error": f"Invalid appointment person_id: {raw_person_ref}"}
            if raw_service_id not in (None, "") and resolved_service_id is None:
                return {"success": False, "error": f"Invalid appointment service_id: {raw_service_id}"}
            if raw_staff_id not in (None, "") and resolved_staff_id is None:
                return {"success": False, "error": f"Invalid appointment staff_id: {raw_staff_id}"}
            row = {
                "person_id": resolved_person_id,
                "service_id": resolved_service_id,
                "staff_id": resolved_staff_id,
                "receptionist_id": (context.get("receptionist") or {}).get("id"),
                "date": normalize_appointment_date_value(resolved_date),
                "time": normalize_appointment_time_value(resolved_time),
                "duration": normalize_appointment_duration(
                    self._resolve_variables(config.get("duration") or config.get("field_duration") or 30, context)
                ),
                "status": normalize_appointment_status(
                    self._resolve_variables(config.get("status") or "pending", context)
                ),
                "notes": self._resolve_variables(config.get("notes") or "", context),
                "business_id": business_id,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            response = self.supabase.table("appointments").insert(row).execute()
            created = response.data[0] if response.data else row
            self._emit_scenario_trigger("appointment_created", {
                "appointment": created,
                "appointment_id": created.get("id"),
                "person_id": created.get("person_id"),
                "service_id": created.get("service_id"),
                "staff_id": created.get("staff_id"),
                "business_id": business_id,
            }, source_scenario_id=context.get("_scenarioId"), scenario_chain=context.get("scenario_chain"))
            self._emit_appointment_change_triggers(
                None,
                created,
                business_id=business_id,
                include_updated=False,
                source_scenario_id=context.get("_scenarioId"),
                scenario_chain=context.get("scenario_chain"),
            )
            logging.info("📅 Appointment created")
            return {"success": True, "data": {"action": "create_appointment", "table": "appointments", **created}}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _update_appointment(self, node: dict, context: dict):
        try:
            config = node.get("appointmentConfig") or node.get("actionConfig") or {}
            appointment_id = self._resolve_variables(config.get("appointment_id") or config.get("record_id") or "", context) or context.get("appointment", {}).get("id")
            if not appointment_id:
                return {"success": False, "error": "No appointment ID specified"}
            appointment_id = uuid_or_none(appointment_id)
            if not appointment_id:
                return {"success": False, "error": "Invalid appointment ID"}
            business_id = (context.get("business") or {}).get("id") or context.get("business_id")
            if business_id is None:
                return {"success": False, "error": "No business context for appointment"}
            existing_response = (
                self.supabase.table("appointments")
                .select("*")
                .eq("id", str(appointment_id))
                .eq("business_id", business_id)
                .limit(1)
                .execute()
            )
            previous = (existing_response.data or [None])[0]
            if not previous:
                return {"success": False, "error": "Appointment not found for this business"}
            updates = {}
            for key in ("date", "time", "duration", "status", "notes", "person_id", "service_id", "staff_id", "receptionist_id"):
                raw = config.get(key) or config.get(f"field_{key}")
                if raw not in (None, ""):
                    resolved = self._resolve_variables(raw, context)
                    if is_empty_value(resolved):
                        continue
                    if key == "date":
                        updates[key] = normalize_appointment_date_value(resolved)
                    elif key == "time":
                        updates[key] = normalize_appointment_time_value(resolved)
                    elif key == "duration":
                        updates[key] = normalize_appointment_duration(resolved)
                    elif key == "status":
                        updates[key] = normalize_appointment_status(resolved)
                    elif key == "person_id":
                        safe_person_id, _safe_person = await self._safe_appointment_person(resolved, business_id=business_id)
                        if safe_person_id is None:
                            return {"success": False, "error": f"Invalid appointment person_id: {resolved}"}
                        updates[key] = safe_person_id
                    elif key == "service_id":
                        safe_service_id = await self._safe_appointment_service_id(resolved, business_id=business_id)
                        if safe_service_id is None:
                            return {"success": False, "error": f"Invalid appointment service_id: {resolved}"}
                        updates[key] = safe_service_id
                    elif key == "staff_id":
                        safe_staff_id, _safe_staff = await self._safe_appointment_staff_id(
                            resolved,
                            (context.get("business") or {}).get("id") or context.get("business_id"),
                        )
                        if safe_staff_id is None:
                            return {"success": False, "error": f"Invalid appointment staff_id: {resolved}"}
                        updates[key] = safe_staff_id
                    elif key == "receptionist_id":
                        updates[key] = resolved
                    else:
                        updates[key] = resolved
            if not updates:
                return {"success": False, "error": "No appointment fields to update"}
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            self.supabase.table("appointments").update(updates).eq("id", str(appointment_id)).eq("business_id", business_id).execute()
            row = {**previous, **updates, "id": str(appointment_id), "business_id": business_id}
            self._emit_appointment_change_triggers(
                previous,
                row,
                business_id=business_id,
                include_updated=True,
                source_scenario_id=context.get("_scenarioId"),
                scenario_chain=context.get("scenario_chain"),
            )
            logging.info("📅 Appointment updated")
            return {"success": True, "data": {"action": "update_appointment", "table": "appointments", **row}}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _cancel_appointment(self, node: dict, context: dict):
        try:
            config = node.get("appointmentConfig") or node.get("actionConfig") or {}
            appointment_id = self._resolve_variables(config.get("appointment_id") or config.get("record_id") or "", context) or context.get("appointment", {}).get("id")
            if not appointment_id:
                return {"success": False, "error": "No appointment ID specified"}
            appointment_id = uuid_or_none(appointment_id)
            if not appointment_id:
                return {"success": False, "error": "Invalid appointment ID"}
            business_id = (context.get("business") or {}).get("id") or context.get("business_id")
            if business_id is None:
                return {"success": False, "error": "No business context for appointment"}
            existing_response = (
                self.supabase.table("appointments")
                .select("*")
                .eq("id", str(appointment_id))
                .eq("business_id", business_id)
                .limit(1)
                .execute()
            )
            previous = (existing_response.data or [None])[0]
            if not previous:
                return {"success": False, "error": "Appointment not found for this business"}
            self.supabase.table("appointments").update({
                "status": "cancelled",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", str(appointment_id)).eq("business_id", business_id).execute()
            row = {**previous, "id": str(appointment_id), "status": "cancelled", "business_id": business_id}
            self._emit_appointment_change_triggers(
                previous,
                row,
                business_id=business_id,
                include_updated=True,
                source_scenario_id=context.get("_scenarioId"),
                scenario_chain=context.get("scenario_chain"),
            )
            logging.info("📅 Appointment cancelled")
            return {"success": True, "data": {"action": "cancel_appointment", "table": "appointments", **row}}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _call_customer(self, node: dict, context: dict):
        try:
            if self.plan_access_checker:
                owner_id = str((context.get("business") or {}).get("user_id") or context.get("user_id") or "")
                self.plan_access_checker(owner_id, context.get("business") or {}, direction="outbound")
            config = node.get("actionConfig") or {}
            to_number = (
                self._resolve_variables(config.get("to_phone") or "", context)
                or context.get("customer", {}).get("phone")
                or context.get("person", {}).get("phone")
            )
            if not to_number:
                resolved_person_id = (
                    self._resolve_variables(config.get("person_id") or "", context)
                    or context.get("person", {}).get("id")
                    or context.get("person_id")
                )
                if resolved_person_id:
                    try:
                        person_response = (
                            self.supabase.table("people")
                            .select("*")
                            .eq("id", str(resolved_person_id))
                            .limit(1)
                            .execute()
                        )
                        person_row = (person_response.data or [None])[0] or {}
                        if person_row:
                            context["person"] = {**(context.get("person") or {}), **person_row}
                            context["customer"] = {**(context.get("customer") or {}), **person_row}
                            to_number = person_row.get("phone") or person_row.get("phone_number") or to_number
                    except Exception as exc:
                        logging.warning("[ActionExecutor] Failed to resolve person phone for call_customer: %s", exc)
            if not to_number:
                return {"success": False, "error": "No phone number for call"}

            customer_record = context.get("customer") or context.get("person") or {}
            if not has_documented_call_consent(customer_record):
                return {
                    "success": False,
                    "error": "Outbound AI calls require a contact with documented consent, a consent source, scope, timestamp, and no do-not-call flag.",
                }

            receptionist = context.get("receptionist") if isinstance(context.get("receptionist"), dict) else {}
            if receptionist and not receptionist_direction_allows("outbound", receptionist.get("direction")):
                return {"success": False, "error": "Outbound calling is disabled for this receptionist"}

            elevenlabs_key = os.environ.get("ELEVENLABS_API_KEY")
            agent_id = os.environ.get("ELEVENLABS_AGENT_ID_OUTBOUND")
            phone_number_id = self._find_elevenlabs_phone_number_id_for_business(context)
            if not elevenlabs_key or not agent_id:
                return {"success": False, "error": "ElevenLabs not configured"}
            if not phone_number_id:
                logging.error(
                    "[ActionExecutor] No assigned business line resolved for outbound call business_id=%s business_twilio_number=%s",
                    (context.get("business") or {}).get("id"),
                    normalize_phone_number((context.get("business") or {}).get("twilio_number")),
                )
                return {"success": False, "error": "No outbound business phone number is configured"}

            required_agent_fields = self._infer_required_agent_fields(context.get("_scenario"), node.get("id"), context)
            downstream_data = self._build_downstream_data(context.get("_scenario"), node.get("id"), context, required_agent_fields)
            mission_text = self._resolve_variables(config.get("main_content") or "", context)
            assistant_name = (context.get("receptionist") or {}).get("first_name") or "Nodemere assistant"
            business_name = (context.get("business") or {}).get("name") or "the business"
            required_opening = build_outbound_ai_disclosure(
                assistant_name=assistant_name,
                business_name=business_name,
                purpose=mission_text,
            )

            scenario_context = {
                "user_id": str((context.get("business") or {}).get("user_id") or context.get("user_id") or ""),
                "company_name": (context.get("business") or {}).get("name") or "",
                "autonomy_index": 1,
                "receptionist_name": assistant_name,
                "receptionist_id": str((context.get("receptionist") or {}).get("id") or ""),
                "elevenlabs_voice_id": (context.get("receptionist") or {}).get("elevenlabs_voice_id") or "",
                "customer_name": (context.get("customer") or {}).get("first_name") or (context.get("person") or {}).get("first_name") or "",
                "direction": "outgoing",
                "flow_execution_id": context.get("_executionId") or "",
                "scenario_id": (context.get("_scenario") or {}).get("id") or "",
                "mission": mission_text,
                "required_opening_disclosure": required_opening,
                "recording_enabled": True,
            }
            customer_phone = normalize_phone_number(
                customer_record.get("phone") or customer_record.get("phone_number") or to_number
            )
            if customer_phone:
                scenario_context["phone"] = customer_phone
                scenario_context["customer_phone"] = customer_phone
            self._add_person_custom_dynamic_variables(scenario_context, context)
            if downstream_data:
                scenario_context["downstream_data"] = json.dumps(downstream_data, default=str)
            # ElevenLabs exposes the values inside dynamic_variables as the
            # agent's variable namespace. Keep the flattened fields for
            # existing prompts and expose only the non-duplicated extras under
            # the explicit scenario_context variable.
            scenario_context_payload = {}
            if downstream_data:
                scenario_context_payload["downstream_data"] = downstream_data
            elevenlabs_dynamic_variables = dict(scenario_context)
            elevenlabs_dynamic_variables["scenario_context"] = json.dumps(
                scenario_context_payload,
                default=str,
                separators=(",", ":"),
            )
            conversation_initiation_client_data = {
                "scenario_context": scenario_context,
                "dynamic_variables": elevenlabs_dynamic_variables,
                "conversation_config_override": {
                    "agent": {"first_message": required_opening},
                },
            }
            if scenario_context.get("elevenlabs_voice_id"):
                conversation_initiation_client_data["conversation_config_override"]["tts"] = {
                    "voice_id": scenario_context["elevenlabs_voice_id"],
                }
            logging.info("[ActionExecutor] outbound call dynamic variables: %s", json.dumps({
                "user_id": scenario_context["user_id"],
                "receptionist_name": scenario_context["receptionist_name"],
                "receptionist_id": scenario_context["receptionist_id"],
                "elevenlabs_voice_id": scenario_context["elevenlabs_voice_id"],
                "direction": scenario_context["direction"],
                "scenario_id": scenario_context["scenario_id"],
                "flow_execution_id": scenario_context["flow_execution_id"],
                "agent_phone_number_id": phone_number_id,
                "to_number": normalize_phone_number(to_number),
                "downstream_data": downstream_data,
            }))

            response = requests.post(
                "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
                headers={
                    "xi-api-key": elevenlabs_key,
                    "Content-Type": "application/json",
                },
                json={
                    "agent_id": agent_id,
                    "agent_phone_number_id": phone_number_id,
                    "to_number": to_number,
                    "conversation_initiation_client_data": conversation_initiation_client_data,
                    "call_recording_enabled": True,
                },
                timeout=30,
            )
            if not response.ok:
                return {"success": False, "error": f"ElevenLabs error: {response.status_code} {response.text}"}
            result = response.json()
            logging.info("📞 Call started")
            return {
                "success": True,
                "pause": True,
                "data": {
                    "call_id": result.get("conversation_id") or result.get("call_id"),
                    "to": to_number,
                    "initiated_at": datetime.now(timezone.utc).isoformat(),
                    "required_agent_fields": required_agent_fields,
                    "agent_collection": self._build_agent_collection_state(context, required_agent_fields, node.get("id")),
                },
            }
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _transfer_call(self, node: dict, context: dict):
        config = node.get("actionConfig") or {}
        to_number = self._resolve_variables(config.get("to_phone") or config.get("transfer_to") or "", context)
        if not to_number:
            return {"success": False, "error": "No transfer phone number"}
        return {"success": True, "data": {"transferred_to": to_number}}

    async def _create_payment(self, node: dict, context: dict):
        callback = self.callbacks.get("create_payment")
        if not callback:
            return {"success": False, "error": "Payment callback not configured"}
        config = node.get("actionConfig") or {}
        person = context.get("person") or {}
        payload = {
            "user_id": context.get("user_id") or context.get("business", {}).get("user_id"),
            "amount": self._parse_money_to_cents(self._resolve_variables(config.get("amount") or "", context)),
            "currency": self._resolve_variables(config.get("currency") or "usd", context),
            "payment_method_type": self._resolve_variables(config.get("payment_method") or "card", context),
            "description": self._resolve_variables(config.get("description") or "", context),
            "person_id": self._string_or_none(self._resolve_variables(config.get("person_id") or "", context) or context.get("person", {}).get("id") or context.get("person_id")),
            "customer_id": self._resolve_variables(config.get("customer_id") or "", context) or person.get("stripe_customer_id") or context.get("customer_id"),
            "customer_name": self._resolve_variables(config.get("customer_name") or format_person_display_name(person) or "", context),
            "customer_email": self._resolve_variables(config.get("customer_email") or person.get("email") or "", context),
            "customer_phone": self._resolve_variables(config.get("customer_phone") or person.get("phone") or "", context),
        }
        result = await callback(payload)
        return {"success": True, "data": {"action": "create_payment", **result}}

    async def _create_customer(self, node: dict, context: dict):
        callback = self.callbacks.get("create_customer")
        if not callback:
            return {"success": False, "error": "Customer callback not configured"}
        config = node.get("actionConfig") or {}
        person = context.get("person") or {}
        payload = {
            "user_id": context.get("user_id") or context.get("business", {}).get("user_id"),
            "person_id": self._string_or_none(self._resolve_variables(config.get("person_id") or "", context) or person.get("id") or context.get("person_id")),
            "customer_name": self._resolve_variables(config.get("customer_name") or format_person_display_name(person) or "", context),
            "customer_email": self._resolve_variables(config.get("customer_email") or person.get("email") or "", context),
            "customer_phone": self._resolve_variables(config.get("customer_phone") or person.get("phone") or "", context),
        }
        result = await callback(payload)
        return {"success": True, "data": {"action": "create_customer", **result}}

    async def _update_customer(self, node: dict, context: dict):
        callback = self.callbacks.get("update_customer")
        if not callback:
            return {"success": False, "error": "Update customer callback not configured"}
        config = node.get("actionConfig") or {}
        person = context.get("person") or {}
        payload = {
            "user_id": context.get("user_id") or context.get("business", {}).get("user_id"),
            "customer_id": self._resolve_variables(config.get("customer_id") or "", context) or person.get("stripe_customer_id") or context.get("customer_id"),
            "person_id": self._string_or_none(self._resolve_variables(config.get("person_id") or "", context) or person.get("id") or context.get("person_id")),
            "customer_name": self._resolve_variables(config.get("customer_name") or format_person_display_name(person) or "", context),
            "customer_email": self._resolve_variables(config.get("customer_email") or person.get("email") or "", context),
            "customer_phone": self._resolve_variables(config.get("customer_phone") or person.get("phone") or "", context),
        }
        result = await callback(payload)
        return {"success": True, "data": {"action": "update_customer", **result}}

    async def _send_payment_link(self, node: dict, context: dict):
        callback = self.callbacks.get("send_payment_link")
        if not callback:
            return {"success": False, "error": "Payment link callback not configured"}
        config = node.get("actionConfig") or {}
        person = context.get("person") or {}
        payload = {
            "user_id": context.get("user_id") or context.get("business", {}).get("user_id"),
            "amount": self._parse_money_to_cents(self._resolve_variables(config.get("amount") or "", context)) if config.get("amount") else None,
            "currency": self._resolve_variables(config.get("currency") or "usd", context),
            "description": self._resolve_variables(config.get("description") or "", context),
            "person_id": self._string_or_none(self._resolve_variables(config.get("person_id") or "", context) or person.get("id") or context.get("person_id")),
            "customer_id": self._resolve_variables(config.get("customer_id") or "", context) or person.get("stripe_customer_id") or context.get("customer_id"),
            "customer_name": self._resolve_variables(config.get("customer_name") or f"{person.get('first_name', '')} {person.get('last_name', '')}".strip(), context),
            "customer_email": self._resolve_variables(config.get("customer_email") or person.get("email") or "", context),
            "customer_phone": self._resolve_variables(config.get("customer_phone") or person.get("phone") or "", context),
        }
        result = await callback(payload)
        return {"success": True, "data": {"action": "send_payment_link", **result}}

    async def _create_invoice(self, node: dict, context: dict):
        callback = self.callbacks.get("create_invoice")
        if not callback:
            return {"success": False, "error": "Invoice callback not configured"}
        config = node.get("actionConfig") or {}
        person = context.get("person") or {}
        payload = {
            "user_id": context.get("user_id") or context.get("business", {}).get("user_id"),
            "amount": self._parse_money_to_cents(self._resolve_variables(config.get("amount") or "", context)),
            "currency": self._resolve_variables(config.get("currency") or "usd", context),
            "description": self._resolve_variables(config.get("description") or "", context),
            "person_id": self._string_or_none(self._resolve_variables(config.get("person_id") or "", context) or person.get("id") or context.get("person_id")),
            "customer_id": self._resolve_variables(config.get("customer_id") or "", context) or person.get("stripe_customer_id") or context.get("customer_id"),
            "appointment_id": self._resolve_variables(config.get("appointment_id") or "", context) or context.get("appointment", {}).get("id"),
            "service_id": self._resolve_variables(config.get("service_id") or "", context) or context.get("service", {}).get("id"),
            "customer_name": self._resolve_variables(config.get("customer_name") or f"{person.get('first_name', '')} {person.get('last_name', '')}".strip(), context),
            "customer_email": self._resolve_variables(config.get("customer_email") or person.get("email") or "", context),
            "customer_phone": self._resolve_variables(config.get("customer_phone") or person.get("phone") or "", context),
            "due_days": int(self._resolve_variables(config.get("due_days") or 7, context)),
        }
        result = await callback(payload)
        return {"success": True, "data": {"action": "create_invoice", **result}}

    async def _send_invoice(self, node: dict, context: dict):
        callback = self.callbacks.get("send_invoice")
        if not callback:
            return {"success": False, "error": "Send invoice callback not configured"}
        config = node.get("actionConfig") or {}
        invoice_id = self._resolve_variables(config.get("invoice_id") or "", context) or context.get("invoice", {}).get("invoice_id") or context.get("invoice", {}).get("id")
        if not invoice_id:
            return {"success": False, "error": "No invoice ID provided for send invoice"}
        result = await callback({
            "user_id": context.get("user_id") or context.get("business", {}).get("user_id"),
            "invoice_id": invoice_id,
        })
        return {"success": True, "data": {"action": "send_invoice", **result}}

    async def _refund_payment(self, node: dict, context: dict):
        callback = self.callbacks.get("refund_payment")
        if not callback:
            return {"success": False, "error": "Refund callback not configured"}
        config = node.get("actionConfig") or {}
        payload = {
            "user_id": context.get("user_id") or context.get("business", {}).get("user_id"),
            "payment_id": self._resolve_variables(config.get("payment_id") or "", context) or context.get("payment", {}).get("id"),
            "amount": self._parse_money_to_cents(self._resolve_variables(config.get("amount") or "", context)) if config.get("amount") else None,
            "refund_reason": self._resolve_variables(config.get("refund_reason") or "", context),
        }
        result = await callback(payload)
        return {"success": True, "data": {"action": "refund_payment", **result}}

    async def _cancel_subscription(self, node: dict, context: dict):
        callback = self.callbacks.get("cancel_subscription")
        if not callback:
            return {"success": False, "error": "Cancel subscription callback not configured"}
        config = node.get("actionConfig") or {}
        person = context.get("person") or {}
        payload = {
            "user_id": context.get("user_id") or context.get("business", {}).get("user_id"),
            "subscription_id": self._resolve_variables(config.get("subscription_id") or "", context) or context.get("subscription_id") or context.get("subscription", {}).get("subscription_id"),
            "customer_id": self._resolve_variables(config.get("customer_id") or "", context) or person.get("stripe_customer_id") or context.get("customer_id"),
            "person_id": self._string_or_none(self._resolve_variables(config.get("person_id") or "", context) or person.get("id") or context.get("person_id")),
        }
        result = await callback(payload)
        return {"success": True, "data": {"action": "cancel_subscription", **result}}

    async def _send_email(self, node: dict, context: dict):
        callback = self.callbacks.get("send_email")
        if not callback:
            return {"success": False, "error": "Send email callback not configured"}
        config = node.get("actionConfig") or {}
        person = context.get("person") or {}
        payload = {
            "user_id": context.get("user_id") or context.get("business", {}).get("user_id"),
            "to": self._resolve_variables(config.get("to") or person.get("email") or "", context),
            "subject": self._resolve_variables(config.get("subject") or "", context),
            "body": self._resolve_variables(config.get("body") or "", context),
        }
        if not payload["to"]:
            return {"success": False, "error": "No email recipient provided"}
        result = await callback(payload)
        return {"success": True, "data": {"action": "send_email", **result}}


class ScenarioFlowExecutor:
    def __init__(self, supabase, action_executor: ScenarioActionExecutor):
        self.supabase = supabase
        self.action_executor = action_executor

    def _get_node_key(self, node: dict) -> str:
        return ((node.get("actionConfig") or {}).get("_key") or node.get("subOptionKey") or "").strip()

    def _clone_context(self, context: dict) -> dict:
        try:
            return json.loads(json.dumps(context, default=str))
        except Exception:
            return dict(context or {})

    def _strip_iterator_context(self, context: dict) -> dict:
        return {key: value for key, value in (context or {}).items() if key not in ITERATOR_STATE_KEYS}

    def _resolve_iterator_collection(self, raw_value: Any, context: dict):
        if isinstance(raw_value, list):
            return raw_value, "", ""
        collection_path = normalize_condition_ref(raw_value) if isinstance(raw_value, str) else ""
        resolved = deep_get(context, collection_path) if collection_path else None
        if resolved is None and isinstance(raw_value, str):
            maybe_path = self.action_executor._resolve_variables(raw_value, context)
            if isinstance(maybe_path, str) and maybe_path != raw_value:
                normalized = normalize_condition_ref(maybe_path)
                resolved = deep_get(context, normalized)
                if resolved is not None:
                    collection_path = normalized

        if resolved is None and collection_path.endswith(".records"):
            parent = deep_get(context, collection_path[: -len(".records")])
            if isinstance(parent, list):
                resolved = parent
        if resolved is None and collection_path.endswith(".results"):
            parent = deep_get(context, collection_path[: -len(".results")])
            if isinstance(parent, list):
                resolved = parent

        source_table = ""
        if isinstance(resolved, dict) and isinstance(resolved.get("records"), list):
            items = resolved.get("records") or []
            source_table = self.action_executor._normalize_table_key(resolved.get("table") or collection_path.split(".")[0] if collection_path else "")
        elif isinstance(resolved, dict) and isinstance(resolved.get("results"), list):
            items = resolved.get("results") or []
            source_table = self.action_executor._normalize_table_key(resolved.get("table") or collection_path.split(".")[0] if collection_path else "")
        elif isinstance(resolved, list):
            items = resolved
            source_table = self.action_executor._normalize_table_key(collection_path.split(".")[0] if collection_path else "")
            if collection_path.endswith(".records"):
                parent = deep_get(context, collection_path[: -len(".records")])
                if isinstance(parent, dict) and parent.get("table"):
                    source_table = self.action_executor._normalize_table_key(parent.get("table"))
            if collection_path.endswith(".results"):
                parent = deep_get(context, collection_path[: -len(".results")])
                if isinstance(parent, dict) and parent.get("table"):
                    source_table = self.action_executor._normalize_table_key(parent.get("table"))
        else:
            items = []
        return items, source_table, collection_path

    def _apply_iterator_item_context(self, base_context: dict, item: Any, index: int, total: int, iterator_state: dict) -> dict:
        context = self._clone_context(base_context)
        source_table = iterator_state.get("source_table") or ""
        context["iterator"] = {
            "current": item,
            "index": index,
            "position": index + 1,
            "total": total,
            "is_first": index == 0,
            "is_last": index == (total - 1),
            "collection_path": iterator_state.get("collection_path") or "",
        }
        if source_table:
            context[source_table] = item
            alias = TABLE_REF_REVERSE_ALIASES.get(source_table)
            if alias:
                context[alias] = item
        context["_iterator_branch_mode"] = True
        context["_iterator_state"] = {
            **iterator_state,
            "next_index": index + 1,
        }
        return context

    async def _continue_iterator_from_state(self, node_map: dict, edge_map: dict, context: dict, execution_id: Optional[str], scenario: dict, iterator_state: dict):
        items = iterator_state.get("items") or []
        branch_start_node_id = iterator_state.get("branch_start_node_id")
        base_context = iterator_state.get("base_context") or self._strip_iterator_context(context)
        results = iterator_state.get("results") or []
        total = len(items)

        if not branch_start_node_id:
            final_context = self._clone_context(base_context)
            final_context.pop("_iterator_state", None)
            final_context.pop("_iterator_branch_mode", None)
            return {
                "success": True,
                "data": {
                    "action": "iterator",
                    "count": 0,
                    "results": [],
                    "collection_path": iterator_state.get("collection_path") or "",
                },
                "context": final_context,
            }

        start_index = max(0, int(iterator_state.get("next_index") or 0))
        for index in range(start_index, total):
            item_context = self._apply_iterator_item_context(base_context, items[index], index, total, {
                **iterator_state,
                "results": results,
            })
            branch_result = await self._execute_from_node(
                branch_start_node_id,
                node_map,
                edge_map,
                item_context,
                execution_id,
                scenario,
                finalize_execution=False,
            )
            if branch_result.get("paused"):
                return branch_result
            if not branch_result.get("success"):
                return branch_result
            branch_context = branch_result.get("context") if isinstance(branch_result.get("context"), dict) else {}
            results.append({
                "index": index,
                "item": items[index],
                "result": self._strip_iterator_context(branch_context),
            })

        final_context = self._clone_context(base_context)
        final_context.pop("_iterator_state", None)
        final_context.pop("_iterator_branch_mode", None)
        return {
            "success": True,
            "data": {
                "action": "iterator",
                "count": total,
                "results": results,
                "collection_path": iterator_state.get("collection_path") or "",
            },
            "context": final_context,
        }

    async def _execute_iterator_node(self, node: dict, node_map: dict, edge_map: dict, context: dict, execution_id: Optional[str], scenario: dict):
        config = node.get("actionConfig") or {}
        items, source_table, collection_path = self._resolve_iterator_collection(
            config.get("collection_path") or config.get("collection") or config.get("array_path") or "",
            context,
        )
        if not isinstance(items, list):
            return {"success": False, "error": "Iterator collection must resolve to a list"}

        iterator_state = {
            "iterator_node_id": node.get("id"),
            "branch_start_node_id": self._get_next_node(node.get("id"), edge_map, context),
            "source_table": source_table,
            "collection_path": collection_path,
            "items": items,
            "next_index": 0,
            "results": [],
            "base_context": self._strip_iterator_context(context),
        }
        return await self._continue_iterator_from_state(node_map, edge_map, context, execution_id, scenario, iterator_state)

    async def start(self, scenario: dict, trigger_event: dict, flow_context: Optional[dict] = None, trigger_node_id: Optional[str] = None, persist_execution: bool = True):
        nodes = scenario.get("nodes_data")
        edges = scenario.get("edges_data")
        if isinstance(nodes, str):
            nodes = json.loads(nodes)
        if isinstance(edges, str):
            edges = json.loads(edges)
        nodes = nodes or []
        edges = edges or []

        if not nodes:
            logging.error("[FlowExecutor] Scenario has no nodes")
            return {"success": False, "error": "No nodes"}

        node_map = {node["id"]: node for node in nodes}
        edge_map = {}
        for edge in edges:
            edge_map.setdefault(edge["from"], []).append(edge)

        trigger_node = node_map.get(trigger_node_id) if trigger_node_id else None
        if not trigger_node:
            trigger_node = next((n for n in nodes if n.get("configured") and n.get("categoryType") == "TRIGGERS"), None) or next((n for n in nodes if n.get("configured")), None)
        if not trigger_node:
            logging.error("[FlowExecutor] No configured trigger node found")
            return {"success": False, "error": "No trigger node"}

        context = {
            **(flow_context or {}),
            "_scenarioId": scenario.get("id"),
            "_scenarioName": scenario.get("name"),
            "_triggerEvent": trigger_event,
            "_scenario": scenario,
            "trigger": {
                "type": trigger_node.get("subOptionKey") or (trigger_node.get("actionConfig") or {}).get("_key") or trigger_node.get("label"),
                "label": trigger_node.get("label"),
                **trigger_event,
            },
        }

        execution_id = None
        if persist_execution:
            execution_id = await self._create_execution_record(scenario, trigger_node["id"], context, trigger_event)
            if not execution_id:
                return {"success": False, "error": "Could not create scenario execution record"}
        else:
            execution_id = f"builder-run-{uuid4()}"
        context["_executionId"] = execution_id
        logging.info("▶ %s (%s)", scenario.get("name"), trigger_node.get("label"))
        return await self._execute_from_node(
            trigger_node["id"],
            node_map,
            edge_map,
            context,
            execution_id if persist_execution else None,
            scenario,
        )

    async def resume(self, execution_id: str, resume_data: Optional[dict] = None):
        try:
            logging.info("↩ Resume requested: exec=%s", execution_id)
            response = self.supabase.table("flow_executions").select("*").eq("id", execution_id).limit(1).execute()
            execution = response.data[0] if response.data else None
            if not execution:
                return {"success": False, "error": f"Execution {execution_id} not found"}
            if execution.get("status") != "paused":
                return {"success": False, "error": f"Execution is {execution.get('status')}, not paused"}

            context = execution.get("flow_context")
            if isinstance(context, str):
                context = json.loads(context)
            pause_data = execution.get("pause_data")
            if isinstance(pause_data, str):
                pause_data = json.loads(pause_data)
            context = context or {}

            resume_data = resume_data or {}
            requirements = (pause_data or {}).get("required_agent_fields") or []
            if isinstance(resume_data.get("agent"), dict):
                flattened_agent = self.action_executor._flatten_agent_payload(resume_data["agent"])
                context["agent"] = deep_merge_dicts(context.get("agent"), flattened_agent)
                self.action_executor._project_agent_requirements_into_context(context, context["agent"], requirements)
                context["agent_collection"] = self.action_executor._build_agent_collection_state(
                    context,
                    requirements,
                    (pause_data or {}).get("paused_node_id"),
                )
            self.action_executor._hydrate_agent_appointment_context(context)
            context.update({k: v for k, v in resume_data.items() if k != "agent"})

            self.supabase.table("flow_executions").update({
                "status": "running",
                "flow_context": context,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", execution_id).execute()

            scenario_response = self.supabase.table("scenarios").select("*").eq("id", execution.get("scenario_id")).limit(1).execute()
            scenario = scenario_response.data[0] if scenario_response.data else None
            if not scenario:
                return {"success": False, "error": "Scenario not found"}

            nodes = scenario.get("nodes_data")
            edges = scenario.get("edges_data")
            if isinstance(nodes, str):
                nodes = json.loads(nodes)
            if isinstance(edges, str):
                edges = json.loads(edges)
            node_map = {node["id"]: node for node in (nodes or [])}
            edge_map = {}
            for edge in (edges or []):
                edge_map.setdefault(edge["from"], []).append(edge)

            next_node_id = (pause_data or {}).get("resume_node_id") or self._get_next_node(execution.get("current_node_id"), edge_map, context)
            logging.info("▶ Resume: %s | exec=%s | next=%s", scenario.get("name"), execution_id, next_node_id or "end")
            if not next_node_id:
                if context.get("_iterator_state"):
                    iterator_result = await self._continue_iterator_from_state(
                        node_map,
                        edge_map,
                        context,
                        execution_id,
                        scenario,
                        context.get("_iterator_state") or {},
                    )
                    if not iterator_result.get("success"):
                        await self._update_execution(execution_id, "failed", execution.get("current_node_id"), context, iterator_result.get("error"))
                        return iterator_result
                    final_context = iterator_result.get("context") or context
                    iterator_node_id = (context.get("_iterator_state") or {}).get("iterator_node_id")
                    if iterator_node_id and iterator_result.get("data"):
                        final_context[iterator_node_id] = iterator_result.get("data")
                    await self._update_execution(execution_id, "completed", None, final_context)
                    return {"success": True, "completed": True, "context": final_context}
                await self._update_execution(execution_id, "completed", None, context)
                logging.info("✅ Complete: %s | exec=%s", scenario.get("name"), execution_id)
                return {"success": True, "completed": True, "context": context}

            await self._update_execution(execution_id, "running", next_node_id, context)
            result = await self._execute_from_node(
                next_node_id,
                node_map,
                edge_map,
                context,
                execution_id,
                scenario,
                finalize_execution=not bool(context.get("_iterator_state")),
            )
            resumed_context = result.get("context") if isinstance(result, dict) else None
            if result.get("success") and result.get("completed") and isinstance(resumed_context, dict) and resumed_context.get("_iterator_state"):
                iterator_result = await self._continue_iterator_from_state(
                    node_map,
                    edge_map,
                    resumed_context,
                    execution_id,
                    scenario,
                    resumed_context.get("_iterator_state") or {},
                )
                if not iterator_result.get("success"):
                    await self._update_execution(execution_id, "failed", next_node_id, resumed_context, iterator_result.get("error"))
                    return iterator_result
                final_context = iterator_result.get("context") or resumed_context
                iterator_node_id = (resumed_context.get("_iterator_state") or {}).get("iterator_node_id")
                if iterator_node_id and iterator_result.get("data"):
                    final_context[iterator_node_id] = iterator_result.get("data")
                await self._update_execution(execution_id, "completed", None, final_context)
                return {"success": True, "completed": True, "context": final_context}
            return result
        except Exception as exc:
            logging.error("❌ Resume failed: %s", exc)
            return {"success": False, "error": str(exc)}

    async def _execute_from_node(self, start_node_id: str, node_map: dict, edge_map: dict, context: dict, execution_id: Optional[str], scenario: dict, finalize_execution: bool = True):
        current_node_id = start_node_id
        steps = 0
        max_steps = 100

        def append_execution_trace(node_id: str, status: str):
            trace = context.setdefault("_execution_trace", [])
            if not isinstance(trace, list):
                trace = []
                context["_execution_trace"] = trace
            trace.append({
                "node_id": node_id,
                "status": status,
                "at": datetime.now(timezone.utc).isoformat(),
            })

        while current_node_id and steps < max_steps:
            steps += 1
            node = node_map.get(current_node_id)
            if not node:
                logging.error("[FlowExecutor] Node %s not found", current_node_id)
                error = f"Scenario references missing node: {current_node_id}"
                await self._update_execution(execution_id, "failed", current_node_id, context, error)
                return {"success": False, "error": error, "failed_at": current_node_id}

            logging.info("• %s. %s", steps, node.get("label") or current_node_id)
            if node.get("categoryType") == "TRIGGERS" and not (node.get("actionConfig") or {}).get("_key"):
                current_node_id = self._get_next_node(current_node_id, edge_map, context)
                continue

            node_key = self._get_node_key(node)
            try:
                if node.get("categoryType") == "UTILITIES" and node_key == "iterator":
                    result = await self._execute_iterator_node(node, node_map, edge_map, context, execution_id, scenario)
                elif node.get("categoryType") == "UTILITIES" and node_key == "router":
                    result = {"success": True, "data": {"action": "router", "routed": True}}
                else:
                    result = await self.action_executor.execute(node, context)
            except Exception as exc:
                error = str(exc) or f"{node.get('label') or node_key} failed"
                append_execution_trace(current_node_id, "failed")
                logging.error("[FlowExecutor] %s failed: %s", node.get("label") or current_node_id, error, exc_info=True)
                await self._update_execution(execution_id, "failed", current_node_id, context, error)
                return {"success": False, "error": error, "failed_at": current_node_id}
            if result.get("paused"):
                append_execution_trace(current_node_id, "paused")
                return result
            if not result.get("success"):
                append_execution_trace(current_node_id, "failed")
                logging.error("❌ %s: %s", node.get("label"), result.get("error"))
                await self._update_execution(execution_id, "failed", current_node_id, context, result.get("error"))
                return {"success": False, "error": result.get("error"), "failed_at": current_node_id}

            data = result.get("data")
            if data:
                context[node["id"]] = data
                action = data.get("action")
                if action in {"create_invoice", "send_invoice"}:
                    context["invoice"] = data
                    context["invoices"] = data
                if action in {"create_payment", "send_payment_link", "refund_payment", "update_payment"}:
                    context["payment"] = data
                    context["payments"] = data
                if action in {"create_customer", "update_customer"}:
                    context["customer"] = data
                if action in {"cancel_subscription"}:
                    context["subscription"] = data
                table = data.get("table")
                if table:
                    context[table] = data
                    alias = next((k for k, v in TABLE_REF_ALIASES.items() if v == table), None)
                    if alias:
                        context[alias] = data
                if table == "appointments":
                    context["appointment"] = data
                    context["appointments"] = data
                    if data.get("staff_id"):
                        try:
                            staff_response = self.supabase.table("staff").select("*").eq("id", data.get("staff_id")).limit(1).execute()
                            if staff_response.data:
                                context["staff"] = staff_response.data[0]
                                context["staff_id"] = staff_response.data[0].get("id")
                        except Exception as exc:
                            logging.warning("[ScenarioEngine] Could not hydrate staff from appointment result: %s", exc)

            if node.get("categoryType") == "UTILITIES" and node_key == "iterator":
                iterator_context = result.get("context")
                if isinstance(iterator_context, dict):
                    context.clear()
                    context.update(iterator_context)
                if data:
                    context[node["id"]] = data
                current_node_id = None
                continue

            if result.get("pause"):
                next_node_id = self._get_next_node(current_node_id, edge_map, context)
                pause_data = {
                    **(data or {}),
                    "paused_node_id": node["id"],
                    "resume_node_id": next_node_id,
                }
                logging.info("⏸ Pause: %s | exec=%s | next=%s", node.get("label"), execution_id or "unknown", next_node_id or "end")
                await self._update_execution(execution_id, "paused", current_node_id, context, None, pause_data)
                return {"success": True, "paused": True, "executionId": execution_id, "at_node": current_node_id, "resume_node_id": next_node_id}

            append_execution_trace(current_node_id, "success")
            current_node_id = self._get_next_node(current_node_id, edge_map, context)

        if steps >= max_steps:
            logging.error("[FlowExecutor] Max steps reached")
            await self._update_execution(execution_id, "failed", current_node_id, context, "Max steps exceeded")
            return {"success": False, "error": "Max steps exceeded"}

        logging.info("✅ %s", scenario.get("name"))
        if finalize_execution:
            await self._update_execution(execution_id, "completed", None, context)
        return {"success": True, "completed": True, "context": context}

    def _get_next_node(self, from_node_id: str, edge_map: dict, context: dict):
        edges = edge_map.get(from_node_id) or []
        if not edges:
            return None
        if len(edges) == 1:
            edge = edges[0]
            rules = ((edge.get("filter") or {}).get("rules")) or []
            if rules and not evaluate_conditions(rules, context):
                return None
            return edge.get("to")
        for edge in edges:
            rules = ((edge.get("filter") or {}).get("rules")) or []
            if rules and evaluate_conditions(rules, context):
                return edge.get("to")
        fallback = next((edge for edge in edges if not (((edge.get("filter") or {}).get("rules")) or [])), None)
        return fallback.get("to") if fallback else None

    async def _create_execution_record(self, scenario: dict, trigger_node_id: str, context: dict, trigger_event: dict):
        try:
            response = self.supabase.table("flow_executions").insert({
                "scenario_id": scenario.get("id"),
                "user_id": scenario.get("user_id") or scenario.get("created_by") or context.get("user_id"),
                "business_id": scenario.get("business_id") or context.get("business_id"),
                "status": "running",
                "current_node_id": trigger_node_id,
                "flow_context": context,
                "trigger_event": trigger_event,
                "started_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            return response.data[0].get("id") if response.data else None
        except Exception as exc:
            logging.error("[FlowExecutor] Failed to create execution record: %s", exc)
            return None

    async def _update_execution(self, execution_id: Optional[str], status_value: str, current_node_id: Optional[str], context: dict, error: Optional[str] = None, pause_data: Optional[dict] = None):
        if not execution_id:
            return
        try:
            update = {
                "status": status_value,
                "current_node_id": current_node_id,
                "flow_context": context,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if error:
                update["error"] = error
            if pause_data:
                update["pause_data"] = pause_data
            if status_value == "completed":
                update["completed_at"] = datetime.now(timezone.utc).isoformat()
            if status_value == "failed":
                update["failed_at"] = datetime.now(timezone.utc).isoformat()
            self.supabase.table("flow_executions").update(update).eq("id", execution_id).execute()
            if status_value in {"completed", "failed"}:
                scenario = context.get("_scenario") if isinstance(context.get("_scenario"), dict) else {}
                business = context.get("business") if isinstance(context.get("business"), dict) else {}
                business_id = business.get("id") or scenario.get("business_id") or context.get("business_id")
                user_id = business.get("user_id") or scenario.get("user_id") or scenario.get("created_by") or context.get("user_id")
                failed = status_value == "failed"
                claim_nest_milestone(
                    self.supabase,
                    business_id=business_id,
                    user_id=user_id,
                    milestone_key="first_scenario_run",
                    title="First scenario run",
                    message=str(context.get("_scenarioName") or scenario.get("name") or ""),
                    source_id=execution_id,
                )
                if not failed:
                    claim_nest_milestone(
                        self.supabase,
                        business_id=business_id,
                        user_id=user_id,
                        milestone_key="first_successful_workflow",
                        title="First successful workflow",
                        message=str(context.get("_scenarioName") or scenario.get("name") or ""),
                        source_id=execution_id,
                    )
                record_nest_event(
                    self.supabase,
                    business_id=business_id,
                    user_id=user_id,
                    category="warnings" if failed else "workflows",
                    event_type="workflow_failed" if failed else "workflow_completed",
                    title="Workflow needs attention" if failed else "Workflow completed",
                    message=str(context.get("_scenarioName") or scenario.get("name") or ""),
                    priority="critical" if failed else "routine",
                    payload={"execution_id": execution_id, "error": error} if failed else {"execution_id": execution_id},
                    source_id=execution_id,
                    idempotency_key=f"workflow:{execution_id}:{status_value}",
                )
        except Exception as exc:
            logging.error("[FlowExecutor] Failed to update execution: %s", exc)


class ScenarioEngine:
    def __init__(self, supabase, callbacks: dict[str, Callable], base_url: str, plan_access_checker: Optional[Callable] = None, scenario_access_checker: Optional[Callable] = None):
        self.supabase = supabase
        self.callbacks = callbacks
        self.base_url = base_url
        self.scenario_access_checker = scenario_access_checker
        self.scenarios: list[dict] = []
        self.action_executor = ScenarioActionExecutor(supabase, callbacks, base_url, plan_access_checker=plan_access_checker)
        self.flow_executor = ScenarioFlowExecutor(supabase, self.action_executor)
        self.scheduler_task: Optional[asyncio.Task] = None
        self.scheduler_worker_id = f"scenario-engine-{os.getpid()}"

    async def start(self):
        logging.info("🚀 Scenarios engine started")
        await self.load_scenarios()
        logging.info("🔌 Listening for scenario events")

    def start_scheduler(self):
        if self.scheduler_task and not self.scheduler_task.done():
            return
        message = f"[ScenarioEngine] Scheduler worker starting as {self.scheduler_worker_id}"
        print(message, flush=True)
        logging.info(message)
        self.scheduler_task = asyncio.create_task(self._scheduler_loop())

    async def stop_scheduler(self):
        if not self.scheduler_task:
            return
        self.scheduler_task.cancel()
        try:
            await self.scheduler_task
        except asyncio.CancelledError:
            pass
        self.scheduler_task = None

    async def load_scenarios(self):
        try:
            response = (
                self.supabase.table("scenarios")
                .select("*")
                .eq("is_active", True)
                .eq("status", "active")
                .order("created_at", desc=True)
                .execute()
            )
            active_scenarios = response.data or []
            self.scenarios = []
            for scenario in active_scenarios:
                definition_errors = validate_scenario_definition(scenario)
                if definition_errors:
                    logging.error(
                        "[ScenarioEngine] Ignoring invalid active scenario %s: %s",
                        scenario.get("id"),
                        "; ".join(definition_errors),
                    )
                    continue
                self.scenarios.append(scenario)
            await self.sync_scheduled_jobs()
        except Exception as exc:
            logging.error("[ScenarioEngine] Failed to load scenarios: %s", exc)
            self.scenarios = []
        return self.scenarios

    async def sync_scheduled_jobs(self):
        try:
            response = (
                self.supabase.table("scenarios")
                .select("*")
                .order("created_at", desc=True)
                .execute()
            )
            scenarios = response.data or []
        except Exception as exc:
            logging.warning("[ScenarioEngine] Could not sync scheduled scenario jobs: %s", exc)
            return

        for scenario in scenarios:
            try:
                await self._sync_scheduled_job_for_scenario(scenario)
                await self._sync_appointment_reminder_job_for_scenario(scenario)
            except Exception as exc:
                logging.warning(
                    "[ScenarioEngine] Could not sync job for scenario %s: %s",
                    scenario.get("id"),
                    exc,
                )

    async def _sync_scheduled_job_for_scenario(self, scenario: dict):
        scenario_id = scenario.get("id")
        if not scenario_id:
            return

        schedule_config = self._coerce_dict(scenario.get("schedule_config"))
        should_schedule = (
            self._scenario_has_no_trigger(scenario)
            and scenario.get("is_active") is not False
            and str(scenario.get("status") or "active").lower() == "active"
            and bool(schedule_config)
            and not validate_scenario_definition(scenario)
        )

        if not should_schedule:
            self.supabase.table("jobs").update({
                "status": "cancelled",
                "locked_at": None,
                "locked_by": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("scenario_id", scenario_id).eq("type", SCHEDULE_JOB_TYPE).neq("status", "completed").execute()
            return

        next_run_at = self._calculate_next_run_at(schedule_config)
        if not next_run_at:
            self.supabase.table("jobs").update({
                "status": "cancelled",
                "locked_at": None,
                "locked_by": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("scenario_id", scenario_id).eq("type", SCHEDULE_JOB_TYPE).execute()
            return

        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "scenario_id": scenario_id,
            "user_id": scenario.get("user_id") or scenario.get("created_by"),
            "business_id": scenario.get("business_id"),
            "schedule_config": schedule_config,
        }
        existing_response = (
            self.supabase.table("jobs")
            .select("*")
            .eq("scenario_id", scenario_id)
            .eq("type", SCHEDULE_JOB_TYPE)
            .limit(1)
            .execute()
        )
        existing = existing_response.data[0] if existing_response.data else None
        job_row = {
            "scenario_id": scenario_id,
            "user_id": scenario.get("user_id") or scenario.get("created_by"),
            "business_id": scenario.get("business_id"),
            "type": SCHEDULE_JOB_TYPE,
            "status": "active",
            "schedule_config": schedule_config,
            "payload": payload,
            "locked_at": None,
            "locked_by": None,
            "updated_at": now_iso,
        }
        if existing:
            update_row = dict(job_row)
            existing_schedule = self._coerce_dict(existing.get("schedule_config"))
            schedule_changed = existing_schedule != schedule_config
            update_row["next_run_at"] = next_run_at.isoformat() if schedule_changed else (existing.get("next_run_at") or next_run_at.isoformat())
            if existing.get("status") in {"cancelled", "completed"}:
                update_row["next_run_at"] = next_run_at.isoformat()
            self.supabase.table("jobs").update(update_row).eq("id", existing["id"]).execute()
        else:
            self.supabase.table("jobs").insert({
                **job_row,
                "next_run_at": next_run_at.isoformat(),
                "created_at": now_iso,
            }).execute()

    def _appointment_soon_node(self, scenario: dict) -> Optional[dict]:
        nodes = _scenario_json_list(scenario.get("nodes_data"))
        return next(
            (
                node for node in nodes
                if isinstance(node, dict)
                and node.get("configured")
                and node.get("categoryType") == "TRIGGERS"
                and str(node.get("subOptionKey") or "").strip().lower() == "appointment_soon"
            ),
            None,
        )

    def _appointment_reminder_minutes(self, trigger_node: dict) -> int:
        trigger_filter = trigger_node.get("triggerFilter") if isinstance(trigger_node.get("triggerFilter"), dict) else {}
        try:
            return max(0, int(trigger_filter.get("hours") or 0) * 60 + int(trigger_filter.get("minutes") or 0))
        except (TypeError, ValueError):
            return 0

    def _load_scenario_business(self, scenario: dict) -> Optional[dict]:
        business_id = scenario.get("business_id")
        user_id = scenario.get("user_id") or scenario.get("created_by")
        try:
            query = self.supabase.table("businesses").select("*")
            if business_id is not None:
                query = query.eq("id", business_id)
            elif user_id:
                query = query.eq("user_id", user_id)
            else:
                return None
            response = query.limit(1).execute()
            return response.data[0] if response.data else None
        except Exception as exc:
            logging.warning("[ScenarioEngine] Could not load business for appointment reminder: %s", exc)
            return None

    def _appointment_start_at(self, appointment: dict, business: Optional[dict]) -> Optional[datetime]:
        try:
            if not _scenario_value_present(appointment.get("date")) or not _scenario_value_present(appointment.get("time")):
                return None
            appointment_date = normalize_appointment_date_value(appointment.get("date"), fallback=None)
            appointment_time = normalize_appointment_time_value(appointment.get("time"), fallback="")
            if not appointment_date or not appointment_time:
                return None
            local_value = datetime.fromisoformat(f"{appointment_date}T{appointment_time}")
            timezone_name = (
                (business or {}).get("timezone")
                or (business or {}).get("business_timezone")
                or (business or {}).get("time_zone")
                or "UTC"
            )
            try:
                schedule_tz = ZoneInfo(str(timezone_name))
            except Exception:
                schedule_tz = timezone.utc
            return local_value.replace(tzinfo=schedule_tz).astimezone(timezone.utc)
        except Exception:
            return None

    def _appointment_reminder_targets(self, scenario: dict, after: Optional[datetime] = None) -> tuple[list[dict], Optional[dict], int]:
        trigger_node = self._appointment_soon_node(scenario)
        if not trigger_node:
            return [], None, 0
        business = self._load_scenario_business(scenario)
        business_id = (business or {}).get("id") or scenario.get("business_id")
        if business_id is None:
            return [], business, self._appointment_reminder_minutes(trigger_node)
        reminder_minutes = self._appointment_reminder_minutes(trigger_node)
        minimum = after or datetime.now(timezone.utc)
        if minimum.tzinfo is None:
            minimum = minimum.replace(tzinfo=timezone.utc)
        try:
            response = (
                self.supabase.table("appointments")
                .select("*")
                .eq("business_id", business_id)
                .in_("status", ["pending", "confirmed"])
                .execute()
            )
            appointments = response.data or []
        except Exception as exc:
            logging.warning("[ScenarioEngine] Could not load appointments for reminder: %s", exc)
            return [], business, reminder_minutes

        targets = []
        for appointment in appointments:
            start_at = self._appointment_start_at(appointment, business)
            if not start_at:
                continue
            target_at = start_at - timedelta(minutes=reminder_minutes)
            if target_at <= minimum:
                continue
            targets.append({
                "appointment_id": appointment.get("id"),
                "appointment": appointment,
                "target_at": target_at.isoformat(),
                "reminder_minutes": reminder_minutes,
            })
        targets.sort(key=lambda item: item.get("target_at") or "")
        return targets, business, reminder_minutes

    async def _sync_appointment_reminder_job_for_scenario(self, scenario: dict):
        scenario_id = scenario.get("id")
        if not scenario_id:
            return
        trigger_node = self._appointment_soon_node(scenario)
        should_schedule = (
            trigger_node is not None
            and scenario.get("is_active") is not False
            and str(scenario.get("status") or "active").lower() == "active"
            and not validate_scenario_definition(scenario)
        )
        existing_response = (
            self.supabase.table("jobs")
            .select("*")
            .eq("scenario_id", scenario_id)
            .eq("type", APPOINTMENT_REMINDER_JOB_TYPE)
            .limit(1)
            .execute()
        )
        existing = existing_response.data[0] if existing_response.data else None
        if not should_schedule:
            if existing:
                self.supabase.table("jobs").update({
                    "status": "cancelled",
                    "locked_at": None,
                    "locked_by": None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", existing["id"]).execute()
            return
        if existing and str(existing.get("status") or "").lower() == "running":
            return

        targets, business, reminder_minutes = self._appointment_reminder_targets(scenario)
        if not targets:
            if existing:
                self.supabase.table("jobs").update({
                    "status": "cancelled",
                    "next_run_at": None,
                    "locked_at": None,
                    "locked_by": None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", existing["id"]).execute()
            return

        now_iso = datetime.now(timezone.utc).isoformat()
        schedule_config = {
            "trigger_key": "appointment_soon",
            "reminder_minutes": reminder_minutes,
            "timezone": (business or {}).get("timezone") or (business or {}).get("business_timezone") or "UTC",
        }
        payload = {
            "scenario_id": scenario_id,
            "user_id": scenario.get("user_id") or scenario.get("created_by"),
            "business_id": (business or {}).get("id") or scenario.get("business_id"),
            "reminders": targets,
        }
        job_row = {
            "scenario_id": scenario_id,
            "user_id": scenario.get("user_id") or scenario.get("created_by"),
            "business_id": (business or {}).get("id") or scenario.get("business_id"),
            "type": APPOINTMENT_REMINDER_JOB_TYPE,
            "status": "active",
            "schedule_config": schedule_config,
            "payload": payload,
            "next_run_at": targets[0]["target_at"],
            "locked_at": None,
            "locked_by": None,
            "updated_at": now_iso,
        }
        if existing:
            self.supabase.table("jobs").update(job_row).eq("id", existing["id"]).execute()
        else:
            self.supabase.table("jobs").insert({**job_row, "created_at": now_iso}).execute()

    async def run_due_appointment_reminder_jobs(self):
        now = datetime.now(timezone.utc)
        try:
            response = (
                self.supabase.table("jobs")
                .select("*")
                .eq("type", APPOINTMENT_REMINDER_JOB_TYPE)
                .in_("status", ["active", "failed"])
                .lte("next_run_at", now.isoformat())
                .order("next_run_at")
                .limit(10)
                .execute()
            )
            candidates = response.data or []
        except Exception as exc:
            logging.warning("[ScenarioEngine] Could not find appointment reminder jobs: %s", exc)
            return {"ok": False, "claimed": 0, "error": str(exc)}

        runs = []
        for candidate in candidates:
            current_status = str(candidate.get("status") or "active")
            claim_response = (
                self.supabase.table("jobs")
                .update({
                    "status": "running",
                    "locked_at": now.isoformat(),
                    "locked_by": self.scheduler_worker_id,
                    "attempt_count": int(candidate.get("attempt_count") or 0) + 1,
                    "updated_at": now.isoformat(),
                })
                .eq("id", candidate.get("id"))
                .eq("status", current_status)
                .select("*")
                .execute()
            )
            claimed = claim_response.data[0] if claim_response.data else None
            if not claimed:
                continue
            result = await self._run_appointment_reminder_job(claimed)
            runs.append({"job_id": claimed.get("id"), "result": result})
        return {"ok": True, "claimed": len(runs), "runs": runs}

    async def _run_appointment_reminder_job(self, job: dict):
        job_id = job.get("id")
        scenario_id = job.get("scenario_id")
        try:
            response = self.supabase.table("scenarios").select("*").eq("id", scenario_id).limit(1).execute()
            scenario = response.data[0] if response.data else None
            if not scenario or scenario.get("is_active") is False or str(scenario.get("status") or "active").lower() != "active":
                self.supabase.table("jobs").update({
                    "status": "cancelled",
                    "locked_at": None,
                    "locked_by": None,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", job_id).execute()
                return {"ok": True, "skipped": "Scenario inactive or missing"}

            job_payload = self._coerce_dict(job.get("payload"))
            reminders = job_payload.get("reminders") if isinstance(job_payload.get("reminders"), list) else []
            business_id = scenario.get("business_id") or job.get("business_id")
            now = datetime.now(timezone.utc)
            for reminder in reminders:
                appointment_id = reminder.get("appointment_id")
                if not appointment_id:
                    continue
                target_at = reminder.get("target_at")
                if target_at:
                    try:
                        target_datetime = datetime.fromisoformat(str(target_at).replace("Z", "+00:00"))
                        if target_datetime.tzinfo is None:
                            target_datetime = target_datetime.replace(tzinfo=timezone.utc)
                        if target_datetime > now:
                            continue
                    except (TypeError, ValueError):
                        continue
                appointment_response = (
                    self.supabase.table("appointments")
                    .select("*")
                    .eq("id", appointment_id)
                    .eq("business_id", business_id)
                    .limit(1)
                    .execute()
                )
                appointment = appointment_response.data[0] if appointment_response.data else None
                if not appointment or str(appointment.get("status") or "").lower() not in {"pending", "confirmed"}:
                    continue
                business = self._load_scenario_business(scenario)
                start_at = self._appointment_start_at(appointment, business)
                expected_target = (start_at - timedelta(minutes=int(reminder.get("reminder_minutes") or 0))).isoformat() if start_at else None
                if expected_target and reminder.get("target_at") and expected_target != reminder.get("target_at"):
                    # The appointment moved; the appointment event will resync
                    # this job for the new reminder time.
                    continue
                event_payload = {
                    "appointment": appointment,
                    "appointment_id": appointment.get("id"),
                    "person_id": appointment.get("person_id"),
                    "service_id": appointment.get("service_id"),
                    "staff_id": appointment.get("staff_id"),
                    "business_id": business_id,
                    "reminder_minutes": int(reminder.get("reminder_minutes") or 0),
                    "reminder_at": reminder.get("target_at"),
                    "scenario_id": scenario_id,
                }
                result = await self.trigger_scenario(str(scenario_id), event_payload, event_type="appointment_reminder")
                flow_result = result.get("result") if isinstance(result, dict) else None
                if not result.get("ok") or not isinstance(flow_result, dict) or not flow_result.get("success"):
                    raise RuntimeError((flow_result or result).get("error") or "Appointment reminder scenario failed")

            next_targets, business, reminder_minutes = self._appointment_reminder_targets(scenario)
            now_iso = datetime.now(timezone.utc).isoformat()
            if next_targets:
                next_payload = {
                    "scenario_id": scenario_id,
                    "user_id": scenario.get("user_id") or scenario.get("created_by"),
                    "business_id": (business or {}).get("id") or scenario.get("business_id"),
                    "reminders": next_targets,
                }
                self.supabase.table("jobs").update({
                    "status": "active",
                    "next_run_at": next_targets[0]["target_at"],
                    "payload": next_payload,
                    "schedule_config": {"trigger_key": "appointment_soon", "reminder_minutes": reminder_minutes},
                    "last_run_at": now_iso,
                    "locked_at": None,
                    "locked_by": None,
                    "attempt_count": 0,
                    "last_error": None,
                    "updated_at": now_iso,
                }).eq("id", job_id).execute()
            else:
                self.supabase.table("jobs").update({
                    "status": "cancelled",
                    "next_run_at": None,
                    "last_run_at": now_iso,
                    "locked_at": None,
                    "locked_by": None,
                    "last_error": None,
                    "updated_at": now_iso,
                }).eq("id", job_id).execute()
            return {"ok": True, "scenario_id": scenario_id, "reminders": len(reminders)}
        except Exception as exc:
            return self._mark_job_failed(job_id, str(exc))

    async def _scheduler_loop(self):
        while True:
            try:
                logging.info("[ScenarioEngine] Scheduler worker tick: %s", self.scheduler_worker_id)
                print(f"[ScenarioEngine] Scheduler worker tick: {self.scheduler_worker_id}", flush=True)
                await self.run_due_scheduled_jobs()
                await self.run_due_appointment_reminder_jobs()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logging.error("[ScenarioEngine] Scheduled job worker failed: %s", exc, exc_info=True)
            await asyncio.sleep(30)

    async def run_due_scheduled_jobs(self):
        try:
            response = self.supabase.rpc("claim_due_scenario_jobs", {
                "worker_id": self.scheduler_worker_id,
                "batch_size": 10,
            }).execute()
            jobs = response.data or []
        except Exception as exc:
            logging.warning("[ScenarioEngine] Could not claim due scenario jobs: %s", exc)
            return {"ok": False, "claimed": 0, "error": str(exc)}

        runs = []
        for job in jobs:
            result = await self._run_scheduled_job(job)
            runs.append({"job_id": job.get("id"), "result": result})
        return {"ok": True, "claimed": len(jobs), "runs": runs}

    async def _run_scheduled_job(self, job: dict):
        job_id = job.get("id")
        scenario_id = job.get("scenario_id")
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            response = self.supabase.table("scenarios").select("*").eq("id", scenario_id).limit(1).execute()
            scenario = response.data[0] if response.data else None
            if not scenario:
                return self._mark_job_failed(job_id, "Scenario not found")

            if scenario.get("is_active") is False or str(scenario.get("status") or "active").lower() != "active":
                self.supabase.table("jobs").update({
                    "status": "cancelled",
                    "locked_at": None,
                    "locked_by": None,
                    "updated_at": now_iso,
                }).eq("id", job_id).execute()
                return {"ok": True, "skipped": "Scenario inactive"}

            if not self._scenario_has_no_trigger(scenario):
                self.supabase.table("jobs").update({
                    "status": "cancelled",
                    "locked_at": None,
                    "locked_by": None,
                    "updated_at": now_iso,
                }).eq("id", job_id).execute()
                return {"ok": True, "skipped": "Scenario is no longer triggerless"}

            payload = self._coerce_dict(job.get("payload"))
            payload.update({
                "scenario_id": scenario_id,
                "user_id": scenario.get("user_id") or scenario.get("created_by") or job.get("user_id"),
                "business_id": scenario.get("business_id") or job.get("business_id"),
                "job_id": job_id,
            })
            result = await self.trigger_scenario(str(scenario_id), payload, event_type=SCHEDULE_TRIGGER_EVENT)
            flow_result = result.get("result") if isinstance(result, dict) else None
            if not result.get("ok") or not isinstance(flow_result, dict) or not flow_result.get("success"):
                raise RuntimeError((flow_result or result).get("error") or "Scheduled scenario failed")

            schedule_config = self._coerce_dict(scenario.get("schedule_config") or job.get("schedule_config"))
            frequency = str(schedule_config.get("frequency") or "once").lower()
            if frequency == "once":
                update = {
                    "status": "completed",
                    "last_run_at": now_iso,
                    "locked_at": None,
                    "locked_by": None,
                    "updated_at": now_iso,
                }
            else:
                next_run_at = self._calculate_next_run_at(schedule_config, after=datetime.now(timezone.utc))
                update = {
                    "status": "active" if next_run_at else "completed",
                    "next_run_at": next_run_at.isoformat() if next_run_at else None,
                    "last_run_at": now_iso,
                    "locked_at": None,
                    "locked_by": None,
                    "attempt_count": 0,
                    "last_error": None,
                    "updated_at": now_iso,
                }
            self.supabase.table("jobs").update(update).eq("id", job_id).execute()
            return {"ok": True, "scenario_id": scenario_id, "result": result}
        except Exception as exc:
            return self._mark_job_failed(job_id, str(exc))

    def _mark_job_failed(self, job_id: Optional[str], error: str):
        if job_id:
            try:
                self.supabase.table("jobs").update({
                    "status": "failed",
                    "locked_at": None,
                    "locked_by": None,
                    "last_error": error,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", job_id).execute()
            except Exception as exc:
                logging.error("[ScenarioEngine] Could not mark job failed: %s", exc)
        return {"ok": False, "error": error}

    async def handle_event(self, event_type: str, payload: Optional[dict] = None):
        payload = payload or {}
        await self.load_scenarios()

        runs = []
        for scenario in self.scenarios:
            match = self._find_matching_trigger_node(scenario, event_type)
            if not match:
                continue
            if not self._event_matches_scenario_tenant(scenario, payload):
                continue
            scenario_chain = payload.get("scenario_chain") if isinstance(payload.get("scenario_chain"), list) else []
            if str(scenario.get("id")) in {str(item) for item in scenario_chain}:
                logging.info(
                    "[ScenarioEngine] Skipping scenario %s because it already exists in the event chain",
                    scenario.get("id"),
                )
                continue
            trigger_node = match
            flow_context = await self._build_flow_context(scenario, event_type, payload)
            if not self._trigger_matches_config(trigger_node, event_type, payload, flow_context):
                continue
            logging.info("⚡ %s → %s", event_type, scenario.get("name"))
            result = await self.flow_executor.start(
                scenario,
                {"event_type": event_type, "payload": payload},
                flow_context=flow_context,
                trigger_node_id=trigger_node.get("id"),
            )
            runs.append({"scenario_id": scenario.get("id"), "scenario_name": scenario.get("name"), "result": result})
        return {"ok": True, "matched": len(runs), "runs": runs}

    def _resolve_trigger_filter_value(self, value: Any, context: dict):
        if not isinstance(value, str):
            return value

        def replace(match):
            reference = match.group(1).strip()
            parts = reference.split(".")
            if not parts:
                return ""
            aliases = {"person": "people", "appointment": "appointments", "business": "business"}
            root = aliases.get(parts[0], parts[0])
            resolved = deep_get(context.get(root), ".".join(parts[1:])) if len(parts) > 1 else context.get(root)
            return "" if resolved is None else str(resolved)

        resolved = re.sub(r"\{\{([^}]+)\}\}", replace, value)
        return resolved.strip() if isinstance(resolved, str) else resolved

    def _trigger_matches_config(self, trigger_node: dict, event_type: str, payload: dict, context: dict) -> bool:
        trigger_key = str(trigger_node.get("subOptionKey") or "").strip().lower()
        if trigger_key == "appointment_soon":
            trigger_filter = trigger_node.get("triggerFilter") if isinstance(trigger_node.get("triggerFilter"), dict) else {}
            try:
                expected_minutes = max(0, int(trigger_filter.get("hours") or 0) * 60 + int(trigger_filter.get("minutes") or 0))
            except (TypeError, ValueError):
                return False
            actual_minutes = payload.get("reminder_minutes")
            if actual_minutes is None:
                actual_minutes = payload.get("reminder_offset_minutes")
            try:
                if actual_minutes is None or int(actual_minutes) != expected_minutes:
                    return False
            except (TypeError, ValueError):
                return False

        config = trigger_node.get("triggerConfig") or {}
        fields = config.get("fields") if isinstance(config, dict) else None
        if not isinstance(fields, dict):
            return True

        source = context
        if event_type == "incoming_call":
            source = {**payload, "phone_number": payload.get("from_number") or payload.get("caller_number") or payload.get("phone_number")}
        elif event_type == "record_updated":
            source = context.get("person") or payload.get("person") or payload.get("record") or payload
        elif event_type.startswith("appointment_") or event_type == "appointment_reminder":
            source = context.get("appointment") or payload.get("appointment") or payload

        for field, expected_raw in fields.items():
            if is_empty_value(expected_raw):
                continue
            expected = self._resolve_trigger_filter_value(expected_raw, context)
            actual = deep_get(source, field)
            if actual is None and field == "phone_number":
                actual = source.get("from_number") or source.get("caller_number") or source.get("phone")
            if actual is None:
                return False
            if normalize_phone_number(expected) and normalize_phone_number(actual):
                matches = normalize_phone_number(expected) == normalize_phone_number(actual)
            else:
                matches = str(actual).strip().lower() == str(expected).strip().lower()
            if not matches:
                return False
        return True

    def _event_matches_scenario_tenant(self, scenario: dict, payload: dict) -> bool:
        event_user_id = payload.get("user_id")
        event_business_id = payload.get("business_id")
        scenario_user_id = scenario.get("user_id") or scenario.get("created_by")
        scenario_business_id = scenario.get("business_id")
        if event_business_id and scenario_business_id:
            return str(event_business_id) == str(scenario_business_id)
        if event_user_id and scenario_user_id:
            return str(event_user_id) == str(scenario_user_id)
        return True

    async def trigger_scenario(self, scenario_id: str, payload: Optional[dict] = None, event_type: str = "manual_trigger"):
        response = self.supabase.table("scenarios").select("*").eq("id", scenario_id).limit(1).execute()
        scenario = response.data[0] if response.data else None
        if not scenario:
            return {"ok": False, "error": "Scenario not found"}
        if self.scenario_access_checker:
            owner_id = str(scenario.get("user_id") or scenario.get("created_by") or (payload or {}).get("user_id") or "")
            self.scenario_access_checker(owner_id, scenario, direction="scenario")
        definition_errors = validate_scenario_definition(scenario)
        if definition_errors:
            return {
                "ok": False,
                "error": "Scenario configuration is invalid: " + "; ".join(definition_errors),
            }
        flow_context = await self._build_flow_context(scenario, event_type, payload or {})
        result = await self.flow_executor.start(
            scenario,
            {"event_type": event_type, "payload": payload or {}},
            flow_context=flow_context,
        )
        return {"ok": True, "result": result}

    async def resume_execution(self, execution_id: str, resume_data: Optional[dict] = None):
        return await self.flow_executor.resume(execution_id, resume_data or {})

    async def list_executions(self, limit: int = 20):
        response = self.supabase.table("flow_executions").select("*").order("started_at", desc=True).limit(limit).execute()
        return response.data or []

    async def get_execution(self, execution_id: str):
        response = self.supabase.table("flow_executions").select("*").eq("id", execution_id).limit(1).execute()
        return response.data[0] if response.data else None

    def _coerce_dict(self, value: Any) -> dict:
        if isinstance(value, dict):
            return value
        if isinstance(value, str) and value.strip():
            try:
                parsed = json.loads(value)
                return parsed if isinstance(parsed, dict) else {}
            except Exception:
                return {}
        return {}

    def _scenario_has_no_trigger(self, scenario: dict) -> bool:
        nodes = scenario.get("nodes_data")
        if isinstance(nodes, str):
            try:
                nodes = json.loads(nodes)
            except Exception:
                nodes = []
        for node in nodes or []:
            if not (node.get("configured") and node.get("categoryType") == "TRIGGERS"):
                continue
            key = str(node.get("subOptionKey") or node.get("categoryKey") or "").lower()
            label = str(node.get("label") or "").strip().lower()
            if key == "no_trigger" or label == "no trigger":
                return True
        return False

    def _parse_schedule_timezone(self, schedule_config: dict):
        timezone_name = (
            schedule_config.get("timezone")
            or schedule_config.get("timeZone")
            or schedule_config.get("tz")
            or "UTC"
        )
        try:
            return ZoneInfo(str(timezone_name))
        except Exception:
            return timezone.utc

    def _parse_schedule_time(self, schedule_config: dict) -> time:
        raw_value = str(schedule_config.get("time") or "09:00").strip()
        try:
            hour, minute = raw_value.split(":")[:2]
            return time(hour=max(0, min(23, int(hour))), minute=max(0, min(59, int(minute))))
        except Exception:
            return time(hour=9, minute=0)

    def _parse_schedule_date(self, schedule_config: dict) -> Optional[date]:
        raw_value = schedule_config.get("date") or schedule_config.get("run_date") or schedule_config.get("runDate")
        if not raw_value:
            return None
        try:
            return date.fromisoformat(str(raw_value)[:10])
        except Exception:
            return None

    def _schedule_interval(self, schedule_config: dict) -> int:
        try:
            return max(1, int(schedule_config.get("interval") or 1))
        except Exception:
            return 1

    def _add_months(self, source: datetime, months: int) -> datetime:
        month_index = source.month - 1 + months
        year = source.year + month_index // 12
        month = month_index % 12 + 1
        day = min(source.day, calendar.monthrange(year, month)[1])
        return source.replace(year=year, month=month, day=day)

    def _calculate_next_run_at(self, schedule_config: dict, after: Optional[datetime] = None) -> Optional[datetime]:
        if not schedule_config:
            return None
        frequency = str(schedule_config.get("frequency") or "once").lower()
        interval = self._schedule_interval(schedule_config)
        schedule_tz = self._parse_schedule_timezone(schedule_config)
        run_time = self._parse_schedule_time(schedule_config)
        after_utc = after or datetime.now(timezone.utc)
        if after_utc.tzinfo is None:
            after_utc = after_utc.replace(tzinfo=timezone.utc)
        local_after = after_utc.astimezone(schedule_tz)
        minimum_local = local_after + timedelta(seconds=30)

        if frequency == "once":
            run_date = self._parse_schedule_date(schedule_config)
            if run_date:
                candidate = datetime.combine(run_date, run_time, tzinfo=schedule_tz)
                return candidate.astimezone(timezone.utc) if candidate > minimum_local else None
            candidate = datetime.combine(local_after.date(), run_time, tzinfo=schedule_tz)
            if candidate <= minimum_local:
                candidate += timedelta(days=1)
            return candidate.astimezone(timezone.utc)

        if frequency == "hourly":
            return (local_after + timedelta(hours=interval)).astimezone(timezone.utc)

        if frequency == "daily":
            candidate = datetime.combine(local_after.date(), run_time, tzinfo=schedule_tz)
            while candidate <= minimum_local:
                candidate += timedelta(days=interval)
            return candidate.astimezone(timezone.utc)

        if frequency == "weekly":
            selected_days = schedule_config.get("daysOfWeek") or schedule_config.get("days_of_week") or []
            selected_indexes = {
                WEEKDAY_INDEX.get(str(day).strip().lower()[:3])
                for day in selected_days
            }
            selected_indexes.discard(None)
            if not selected_indexes:
                selected_indexes = {local_after.weekday()}
            anchor_date = self._parse_schedule_date(schedule_config) or local_after.date()
            for day_offset in range(0, max(28, interval * 14 + 7)):
                candidate_date = local_after.date() + timedelta(days=day_offset)
                if candidate_date.weekday() not in selected_indexes:
                    continue
                weeks_since_anchor = max(0, (candidate_date - anchor_date).days // 7)
                if weeks_since_anchor % interval != 0:
                    continue
                candidate = datetime.combine(candidate_date, run_time, tzinfo=schedule_tz)
                if candidate > minimum_local:
                    return candidate.astimezone(timezone.utc)
            return None

        if frequency == "monthly":
            candidate = datetime.combine(local_after.date(), run_time, tzinfo=schedule_tz)
            while candidate <= minimum_local:
                candidate = self._add_months(candidate, interval)
            return candidate.astimezone(timezone.utc)

        return None

    def _hydrate_business_with_assigned_line(self, business: Optional[dict]) -> Optional[dict]:
        if not business or business.get("id") is None:
            return business
        try:
            response = (
                self.supabase.table("purchased_numbers")
                .select("*")
                .eq("business_id", business.get("id"))
                .eq("kind", "assigned_line")
                .order("created_at", desc=False)
                .execute()
            )
            rows = response.data or []
        except Exception as exc:
            logging.warning("[ScenarioEngine] Could not fetch purchased numbers for business %s: %s", business.get("id"), exc)
            return business

        active_assigned = next(
            (
                row for row in rows
                if row.get("is_active")
                and str(row.get("status") or "").lower() not in {"released", "quality_failed"}
            ),
            None,
        )
        if active_assigned is None:
            candidates = [
                row for row in rows
                if str(row.get("status") or "").lower() in {"active", "quality_checking", "inactive"}
            ]
            active_assigned = candidates[-1] if candidates else None

        hydrated = dict(business)
        hydrated["purchased_numbers"] = rows
        hydrated["active_purchased_number"] = active_assigned
        hydrated["twilio_number"] = (active_assigned or {}).get("phone_number")
        hydrated["twilio_number_status"] = (active_assigned or {}).get("status")
        hydrated["twilio_number_label"] = (active_assigned or {}).get("friendly_name")
        hydrated["elevenlabs_phone_number_id"] = (active_assigned or {}).get("elevenlabs_phone_number_id")
        return hydrated

    async def _build_flow_context(self, scenario: dict, event_type: str, payload: dict):
        context = {
            **payload,
            "event_type": event_type,
        }

        if isinstance(payload.get("appointment"), dict):
            context["appointment"] = payload["appointment"]
            context["appointments"] = payload["appointment"]
            context.setdefault("person_id", payload["appointment"].get("person_id"))
            context.setdefault("staff_id", payload["appointment"].get("staff_id"))

        appointment_id = payload.get("appointment_id")
        if appointment_id:
            try:
                response = self.supabase.table("appointments").select("*").eq("id", appointment_id).limit(1).execute()
                if response.data:
                    context["appointment"] = response.data[0]
                    context["appointments"] = response.data[0]
                    context.setdefault("person_id", response.data[0].get("person_id"))
                    context.setdefault("staff_id", response.data[0].get("staff_id"))
            except Exception as exc:
                logging.warning("[ScenarioEngine] Could not fetch appointment: %s", exc)

        staff_id = payload.get("staff_id")
        if not staff_id and isinstance(context.get("appointment"), dict):
            staff_id = context["appointment"].get("staff_id")
        if staff_id:
            try:
                response = self.supabase.table("staff").select("*").eq("id", staff_id).limit(1).execute()
                if response.data:
                    context["staff"] = response.data[0]
                    context["staff_id"] = response.data[0].get("id")
                    context.setdefault("business_id", response.data[0].get("business_id"))
            except Exception as exc:
                logging.warning("[ScenarioEngine] Could not fetch staff: %s", exc)

        person_id = payload.get("person_id") or payload.get("record_id") or payload.get("id")
        if person_id:
            try:
                response = self.supabase.table("people").select("*").eq("id", person_id).limit(1).execute()
                if response.data:
                    context["person"] = response.data[0]
                    context["customer"] = response.data[0]
                    context["people"] = response.data[0]
                    context["person_id"] = response.data[0].get("id")
                    context.setdefault("user_id", response.data[0].get("user_id"))
                    context.setdefault("business_id", response.data[0].get("business_id"))
            except Exception as exc:
                logging.warning("[ScenarioEngine] Could not fetch person: %s", exc)

        if "person" not in context and payload.get("customer_id"):
            try:
                customer_query = self.supabase.table("people").select("*").eq("stripe_customer_id", payload.get("customer_id"))
                if payload.get("user_id"):
                    customer_query = customer_query.eq("user_id", payload.get("user_id"))
                response = customer_query.limit(1).execute()
                if response.data:
                    context["person"] = response.data[0]
                    context["customer"] = response.data[0]
                    context["people"] = response.data[0]
                    context["person_id"] = response.data[0].get("id")
                    context.setdefault("user_id", response.data[0].get("user_id"))
                    context.setdefault("business_id", response.data[0].get("business_id"))
            except Exception as exc:
                logging.warning("[ScenarioEngine] Could not fetch person by stripe_customer_id: %s", exc)

        payment_payload = payload.get("payment")
        if payment_payload:
            context["payment"] = payment_payload
            context["payments"] = payment_payload
        payment_id = payload.get("payment_id") or payload.get("stripe_payment_intent_id") or payload.get("stripe_session_id")
        if payment_id and not payment_payload:
            try:
                response = self.supabase.table("payments").select("*").eq("id", payment_id).limit(1).execute()
                if response.data:
                    context["payment"] = response.data[0]
                    context["payments"] = response.data[0]
                elif payload.get("stripe_payment_intent_id"):
                    response = self.supabase.table("payments").select("*").eq("stripe_payment_intent_id", payload["stripe_payment_intent_id"]).limit(1).execute()
                    if response.data:
                        context["payment"] = response.data[0]
                        context["payments"] = response.data[0]
                elif payload.get("stripe_session_id"):
                    response = self.supabase.table("payments").select("*").eq("stripe_session_id", payload["stripe_session_id"]).limit(1).execute()
                    if response.data:
                        context["payment"] = response.data[0]
                        context["payments"] = response.data[0]
            except Exception as exc:
                logging.warning("[ScenarioEngine] Could not fetch payment: %s", exc)

        invoice_payload = payload.get("invoice")
        if invoice_payload:
            context["invoice"] = invoice_payload
            context["invoices"] = invoice_payload
        elif payload.get("invoice_id"):
            try:
                response = self.supabase.table("invoices").select("*").eq("id", payload["invoice_id"]).limit(1).execute()
                if response.data:
                    context["invoice"] = response.data[0]
                    context["invoices"] = response.data[0]
            except Exception as exc:
                logging.warning("[ScenarioEngine] Could not fetch invoice: %s", exc)

        customer_payload = payload.get("customer")
        if customer_payload:
            context["customer"] = customer_payload
            context.setdefault("customer_id", customer_payload.get("id") or customer_payload.get("customer_id"))
        elif payload.get("customer_id"):
            context.setdefault("customer_id", payload.get("customer_id"))

        subscription_payload = payload.get("subscription")
        if subscription_payload:
            context["subscription"] = subscription_payload
            context.setdefault("subscription_id", subscription_payload.get("id") or subscription_payload.get("subscription_id"))
        elif payload.get("subscription_id"):
            context.setdefault("subscription_id", payload.get("subscription_id"))

        business_payload = payload.get("business")
        if isinstance(business_payload, dict) and business_payload.get("id") is not None:
            context["business"] = business_payload
            context["business_id"] = business_payload.get("id")
            context.setdefault("user_id", business_payload.get("user_id"))

        business_id = payload.get("business_id") or context.get("business_id")
        user_id = payload.get("user_id") or context.get("user_id") or scenario.get("user_id") or scenario.get("created_by")
        if user_id:
            context.setdefault("user_id", user_id)
        try:
            if context.get("business"):
                response = None
            elif business_id:
                response = self.supabase.table("businesses").select("*").eq("id", business_id).limit(1).execute()
            elif user_id:
                response = self.supabase.table("businesses").select("*").eq("user_id", user_id).limit(1).execute()
            else:
                response = None
            if response and response.data:
                hydrated_business = self._hydrate_business_with_assigned_line(response.data[0]) or response.data[0]
                context["business"] = hydrated_business
                context["business_id"] = hydrated_business.get("id")
                context["user_id"] = hydrated_business.get("user_id")
        except Exception as exc:
            logging.warning("[ScenarioEngine] Could not fetch business: %s", exc)

        try:
            business = context.get("business") or {}
            receptionist_response = None
            if business.get("user_id"):
                receptionist_response = (
                    self.supabase.table("hired_receptionists")
                    .select("*")
                    .eq("user_id", business.get("user_id"))
                    .execute()
                )
            if receptionist_response and receptionist_response.data:
                eligible = [
                    row
                    for row in receptionist_response.data
                    if receptionist_direction_allows("outbound", row.get("direction"))
                    or receptionist_direction_allows("inbound", row.get("direction"))
                ]
                context["receptionist"] = (eligible or receptionist_response.data)[0]
        except Exception as exc:
            logging.warning("[ScenarioEngine] Could not fetch receptionist: %s", exc)

        return context

    def _find_matching_trigger_node(self, scenario: dict, event_type: str):
        nodes = scenario.get("nodes_data")
        if isinstance(nodes, str):
            nodes = json.loads(nodes)
        nodes = nodes or []
        for node in nodes:
            if not (node.get("configured") and node.get("categoryType") == "TRIGGERS"):
                continue
            trigger_key = node.get("subOptionKey") or (node.get("actionConfig") or {}).get("_key") or ""
            expected = TRIGGER_EVENT_MAP.get(trigger_key)
            if expected == event_type or trigger_key == event_type:
                return node
        return None
