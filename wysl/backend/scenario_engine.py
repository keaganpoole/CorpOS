import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Callable, Optional

import requests

BASE_TABLE_LABELS = {
    "people": {
        "first_name": "First Name",
        "last_name": "Last Name",
        "email": "Email",
        "phone": "Phone",
        "notes": "Notes",
    },
    "appointments": {
        "client_name": "Client Name",
        "date": "Date",
        "time": "Time",
        "duration": "Duration",
        "status": "Status",
        "assigned_receptionist": "Assigned Receptionist",
        "notes": "Appointment Notes",
    },
}

TABLE_CONTEXT_ALIASES = {
    "people": ("people", "person"),
    "appointments": ("appointments", "appointment"),
}

AGENT_REF_PREFIXES = {"rec", "agent", "receptionist"}


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
    "record_deleted": "record_deleted",
    "appointment_created": "appointment_created",
    "appointment_updated": "appointment_updated",
    "appointment_cancelled": "appointment_cancelled",
    "appointment_completed": "appointment_completed",
    "appointment_missed": "appointment_missed",
    "appointment_reminder": "appointment_reminder",
    "appointment_soon": "appointment_reminder",
    "invoice_created": "invoice_created",
    "invoice_sent": "invoice_sent",
    "invoice_paid": "invoice_paid",
    "payment_failed": "payment_failed",
    "payment_succeeded": "payment_succeeded",
    "manual_trigger": "manual_trigger",
}

TABLE_REF_ALIASES = {
    "person": "people",
    "payment": "payments",
    "invoice": "invoices",
    "appointment": "appointments",
    "service": "services",
    "receptionist": "hired_receptionists",
    "business": "businesses",
}

TABLE_REF_REVERSE_ALIASES = {value: key for key, value in TABLE_REF_ALIASES.items()}


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
    def __init__(self, supabase, callbacks: dict[str, Callable], base_url: str):
        self.supabase = supabase
        self.callbacks = callbacks
        self.base_url = base_url.rstrip("/")

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
        for candidate in [label_key, field_key]:
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

    async def execute(self, node: dict, context: dict):
        if node.get("type") == "end_call":
            return {"success": True, "data": {"action": "end_call"}}

        key = ((node.get("actionConfig") or {}).get("_key") or node.get("subOptionKey") or "").strip()
        if not key:
            return {"success": True, "data": {"action": "noop"}}

        handlers = {
            "search_records": self._search_records,
            "update_record": self._update_record,
            "update_records": self._update_record,
            "create_new_record": self._create_record,
            "create_appointment": self._create_appointment,
            "update_appointment": self._update_appointment,
            "cancel_appointment": self._cancel_appointment,
            "call_customer": self._call_customer,
            "transfer_to_phone_number": self._transfer_call,
            "create_payment": self._create_payment,
            "create_payment_profile": self._create_payment_profile,
            "create_invoice": self._create_invoice,
            "send_invoice": self._send_invoice,
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
            table = str(config.get("target_table") or config.get("table") or "people").lower().replace(" ", "_")
            limit = int(config.get("search_limit") or config.get("limit") or 10)
            user_id = self._resolve_variables(config.get("search_user_id") or config.get("user_id") or "", context) or context.get("business", {}).get("user_id")

            query = self.supabase.table(table).select("*").limit(limit)
            if user_id and table not in {"businesses", "services"}:
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

    async def _update_record(self, node: dict, context: dict):
        try:
            config = node.get("actionConfig") or {}
            table = str(config.get("target_table") or config.get("table") or "people").lower().replace(" ", "_")
            record_id = self._resolve_variables(config.get("record_id") or "", context)
            if not record_id:
                return {"success": False, "error": "No record ID specified"}

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
                    logging.warning(
                        "[ActionExecutor] Skipping unresolved record update value table=%s record_id=%s field=%s value=%s",
                        table,
                        record_id,
                        column_key,
                        resolved_value,
                    )
                    continue
                if table == "people" and column_key.startswith("custom_"):
                    custom_updates[column_key] = self._coerce_custom_field_value(resolved_value, custom_field_types.get(column_key))
                else:
                    updates[column_key] = resolved_value
            if custom_updates:
                existing_custom_fields = {}
                try:
                    existing = self.supabase.table("people").select("custom_fields").eq("id", str(record_id)).execute()
                    if existing.data:
                        existing_custom_fields = existing.data[0].get("custom_fields") or {}
                except Exception as exc:
                    logging.warning("[ActionExecutor] Could not load existing custom_fields for people:%s: %s", record_id, exc)
                updates["custom_fields"] = {**existing_custom_fields, **custom_updates}
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()

            response = self.supabase.table(table).update(updates).eq("id", str(record_id)).execute()
            logging.info("📝 %s:%s updated", table, record_id)
            row = response.data[0] if response.data else {"id": record_id, **updates}
            return {"success": True, "data": {"action": "update_record", **row}}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _create_record(self, node: dict, context: dict):
        try:
            config = node.get("actionConfig") or {}
            table = str(config.get("target_table") or config.get("table") or "people").lower().replace(" ", "_")
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
                if table == "people" and column_key.startswith("custom_"):
                    custom_updates[column_key] = self._coerce_custom_field_value(resolved_value, custom_field_types.get(column_key))
                else:
                    row[column_key] = resolved_value
            if custom_updates:
                row["custom_fields"] = custom_updates
            now = datetime.now(timezone.utc).isoformat()
            row.setdefault("created_at", now)
            row.setdefault("updated_at", now)
            if table == "people":
                business = context.get("business") or {}
                row.setdefault("user_id", business.get("user_id") or context.get("user_id"))
                row.setdefault("business_id", business.get("id") or context.get("business_id"))
            response = self.supabase.table(table).insert(row).execute()
            created = response.data[0] if response.data else row
            logging.info("🆕 %s:%s created", table, created.get("id"))
            return {"success": True, "data": {"action": "create_new_record", **created}}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _create_appointment(self, node: dict, context: dict):
        try:
            config = node.get("actionConfig") or {}
            business = context.get("business") or {}
            row = {
                "person_id": context.get("person", {}).get("id") or context.get("person_id"),
                "client_name": self._resolve_variables(config.get("client_name") or config.get("field_client_name") or "", context),
                "date": self._resolve_variables(config.get("date") or config.get("field_date") or "", context),
                "time": self._resolve_variables(config.get("time") or config.get("field_time") or "", context),
                "duration": int(config.get("duration") or config.get("field_duration") or 30),
                "status": self._resolve_variables(config.get("status") or "pending", context),
                "assigned_receptionist": self._resolve_variables(config.get("assigned_receptionist") or "", context),
                "notes": self._resolve_variables(config.get("notes") or "", context),
                "business_id": business.get("id"),
            }
            response = self.supabase.table("appointments").insert(row).execute()
            created = response.data[0] if response.data else row
            logging.info("📅 Appointment created")
            return {"success": True, "data": created}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _update_appointment(self, node: dict, context: dict):
        try:
            config = node.get("actionConfig") or {}
            appointment_id = self._resolve_variables(config.get("appointment_id") or config.get("record_id") or "", context) or context.get("appointment", {}).get("id")
            if not appointment_id:
                return {"success": False, "error": "No appointment ID specified"}
            updates = {}
            for key in ("client_name", "date", "time", "duration", "status", "assigned_receptionist", "notes", "person_id", "service_id"):
                raw = config.get(key) or config.get(f"field_{key}")
                if raw not in (None, ""):
                    updates[key] = self._resolve_variables(raw, context)
            response = self.supabase.table("appointments").update(updates).eq("id", str(appointment_id)).execute()
            row = response.data[0] if response.data else {"id": appointment_id, **updates}
            logging.info("📅 Appointment updated")
            return {"success": True, "data": row}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _cancel_appointment(self, node: dict, context: dict):
        try:
            config = node.get("actionConfig") or {}
            appointment_id = self._resolve_variables(config.get("appointment_id") or config.get("record_id") or "", context) or context.get("appointment", {}).get("id")
            if not appointment_id:
                return {"success": False, "error": "No appointment ID specified"}
            response = self.supabase.table("appointments").update({"status": "cancelled"}).eq("id", str(appointment_id)).execute()
            row = response.data[0] if response.data else {"id": appointment_id, "status": "cancelled"}
            logging.info("📅 Appointment cancelled")
            return {"success": True, "data": row}
        except Exception as exc:
            return {"success": False, "error": str(exc)}

    async def _call_customer(self, node: dict, context: dict):
        try:
            config = node.get("actionConfig") or {}
            to_number = self._resolve_variables(config.get("to_phone") or "", context) or context.get("customer", {}).get("phone") or context.get("person", {}).get("phone")
            if not to_number:
                return {"success": False, "error": "No phone number for call"}

            try:
                settings_response = self.supabase.table("account_settings").select("call_routing").limit(1).execute()
                settings_row = (settings_response.data or [None])[0] or {}
                call_routing = str(settings_row.get("call_routing") or "all").strip().lower()
            except Exception:
                call_routing = "all"

            if call_routing not in {"outbound", "all"}:
                return {"success": False, "error": "Outbound calling is disabled by account call routing"}

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
            mission_text = self._resolve_variables(config.get("main_content") or "", context)

            dynamic_vars = {
                "user_id": str((context.get("business") or {}).get("user_id") or context.get("user_id") or ""),
                "company_name": (context.get("business") or {}).get("name") or "",
                "receptionist_name": (context.get("receptionist") or {}).get("first_name") or "Receptionist",
                "receptionist_id": str((context.get("receptionist") or {}).get("id") or ""),
                "customer_name": (context.get("customer") or {}).get("first_name") or (context.get("person") or {}).get("first_name") or "",
                "direction": "outgoing",
                "flow_execution_id": context.get("_executionId") or "",
                "scenario_id": (context.get("_scenario") or {}).get("id") or "",
                "mission": mission_text,
            }
            self._add_person_custom_dynamic_variables(dynamic_vars, context)
            if required_agent_fields:
                dynamic_vars["required_fields"] = json.dumps([
                    {
                        "label": field["label"],
                        "description": field.get("description") or "",
                        "return_key": field["preferred_return_key"],
                        "current_value": self._resolve_agent_requirement_value(dynamic_vars, field),
                    }
                    for field in required_agent_fields
                ])
            logging.info("[ActionExecutor] outbound call dynamic variables: %s", json.dumps({
                "user_id": dynamic_vars["user_id"],
                "receptionist_name": dynamic_vars["receptionist_name"],
                "receptionist_id": dynamic_vars["receptionist_id"],
                "direction": dynamic_vars["direction"],
                "scenario_id": dynamic_vars["scenario_id"],
                "flow_execution_id": dynamic_vars["flow_execution_id"],
                "agent_phone_number_id": phone_number_id,
                "to_number": normalize_phone_number(to_number),
                "required_fields": [
                    {
                        "label": field.get("label"),
                        "return_key": field.get("preferred_return_key"),
                    }
                    for field in required_agent_fields
                ],
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
                    "conversation_initiation_client_data": {
                        "dynamic_variables": dynamic_vars,
                    },
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
        payload = {
            "user_id": context.get("user_id") or context.get("business", {}).get("user_id"),
            "amount": self._parse_money_to_cents(self._resolve_variables(config.get("amount") or "", context)),
            "currency": self._resolve_variables(config.get("currency") or "usd", context),
            "payment_method_type": self._resolve_variables(config.get("payment_method") or "card", context),
            "description": self._resolve_variables(config.get("description") or "", context),
            "person_id": self._resolve_variables(config.get("person_id") or "", context) or context.get("person", {}).get("id") or context.get("person_id"),
        }
        result = await callback(payload)
        return {"success": True, "data": {"action": "create_payment", **result}}

    async def _create_payment_profile(self, node: dict, context: dict):
        callback = self.callbacks.get("create_payment_profile")
        if not callback:
            return {"success": False, "error": "Payment profile callback not configured"}
        config = node.get("actionConfig") or {}
        person = context.get("person") or {}
        payload = {
            "user_id": context.get("user_id") or context.get("business", {}).get("user_id"),
            "amount": self._parse_money_to_cents(self._resolve_variables(config.get("amount") or "", context)) if config.get("amount") else None,
            "currency": self._resolve_variables(config.get("currency") or "usd", context),
            "description": self._resolve_variables(config.get("description") or "", context),
            "person_id": self._resolve_variables(config.get("person_id") or "", context) or person.get("id") or context.get("person_id"),
            "customer_name": self._resolve_variables(config.get("customer_name") or f"{person.get('first_name', '')} {person.get('last_name', '')}".strip(), context),
            "customer_email": self._resolve_variables(config.get("customer_email") or person.get("email") or "", context),
            "customer_phone": self._resolve_variables(config.get("customer_phone") or person.get("phone") or "", context),
        }
        result = await callback(payload)
        return {"success": True, "data": {"action": "create_payment_profile", **result}}

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
            "person_id": self._resolve_variables(config.get("person_id") or "", context) or person.get("id") or context.get("person_id"),
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

    async def start(self, scenario: dict, trigger_event: dict, flow_context: Optional[dict] = None, trigger_node_id: Optional[str] = None):
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

        execution_id = await self._create_execution_record(scenario, trigger_node["id"], context, trigger_event)
        context["_executionId"] = execution_id
        logging.info("▶ %s (%s)", scenario.get("name"), trigger_node.get("label"))
        return await self._execute_from_node(trigger_node["id"], node_map, edge_map, context, execution_id, scenario)

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
                await self._update_execution(execution_id, "completed", None, context)
                logging.info("✅ Complete: %s | exec=%s", scenario.get("name"), execution_id)
                return {"success": True, "completed": True, "context": context}

            await self._update_execution(execution_id, "running", next_node_id, context)
            return await self._execute_from_node(next_node_id, node_map, edge_map, context, execution_id, scenario)
        except Exception as exc:
            logging.error("❌ Resume failed: %s", exc)
            return {"success": False, "error": str(exc)}

    async def _execute_from_node(self, start_node_id: str, node_map: dict, edge_map: dict, context: dict, execution_id: Optional[str], scenario: dict):
        current_node_id = start_node_id
        steps = 0
        max_steps = 100

        while current_node_id and steps < max_steps:
            steps += 1
            node = node_map.get(current_node_id)
            if not node:
                logging.error("[FlowExecutor] Node %s not found", current_node_id)
                break

            logging.info("• %s. %s", steps, node.get("label") or current_node_id)
            if node.get("categoryType") == "TRIGGERS" and not (node.get("actionConfig") or {}).get("_key"):
                current_node_id = self._get_next_node(current_node_id, edge_map, context)
                continue

            result = await self.action_executor.execute(node, context)
            if not result.get("success"):
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
                if action in {"create_payment", "create_payment_profile", "update_payment"}:
                    context["payment"] = data
                    context["payments"] = data
                table = data.get("table")
                if table:
                    context[table] = data
                    alias = next((k for k, v in TABLE_REF_ALIASES.items() if v == table), None)
                    if alias:
                        context[alias] = data

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

            current_node_id = self._get_next_node(current_node_id, edge_map, context)

        if steps >= max_steps:
            logging.error("[FlowExecutor] Max steps reached")
            await self._update_execution(execution_id, "failed", current_node_id, context, "Max steps exceeded")
            return {"success": False, "error": "Max steps exceeded"}

        logging.info("✅ %s", scenario.get("name"))
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
        except Exception as exc:
            logging.error("[FlowExecutor] Failed to update execution: %s", exc)


class ScenarioEngine:
    def __init__(self, supabase, callbacks: dict[str, Callable], base_url: str):
        self.supabase = supabase
        self.callbacks = callbacks
        self.base_url = base_url
        self.scenarios: list[dict] = []
        self.action_executor = ScenarioActionExecutor(supabase, callbacks, base_url)
        self.flow_executor = ScenarioFlowExecutor(supabase, self.action_executor)

    async def start(self):
        logging.info("🚀 Scenarios engine started")
        await self.load_scenarios()
        logging.info("🔌 Listening for scenario events")

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
            self.scenarios = response.data or []
        except Exception as exc:
            logging.error("[ScenarioEngine] Failed to load scenarios: %s", exc)
            self.scenarios = []
        return self.scenarios

    async def handle_event(self, event_type: str, payload: Optional[dict] = None):
        payload = payload or {}
        await self.load_scenarios()

        runs = []
        for scenario in self.scenarios:
            match = self._find_matching_trigger_node(scenario, event_type)
            if not match:
                continue
            trigger_node = match
            logging.info("⚡ %s → %s", event_type, scenario.get("name"))
            flow_context = await self._build_flow_context(scenario, event_type, payload)
            result = await self.flow_executor.start(
                scenario,
                {"event_type": event_type, "payload": payload},
                flow_context=flow_context,
                trigger_node_id=trigger_node.get("id"),
            )
            runs.append({"scenario_id": scenario.get("id"), "scenario_name": scenario.get("name"), "result": result})
        return {"ok": True, "matched": len(runs), "runs": runs}

    async def trigger_scenario(self, scenario_id: str, payload: Optional[dict] = None):
        response = self.supabase.table("scenarios").select("*").eq("id", scenario_id).limit(1).execute()
        scenario = response.data[0] if response.data else None
        if not scenario:
            return {"ok": False, "error": "Scenario not found"}
        flow_context = await self._build_flow_context(scenario, "manual_trigger", payload or {})
        result = await self.flow_executor.start(
            scenario,
            {"event_type": "manual_trigger", "payload": payload or {}},
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

        appointment_id = payload.get("appointment_id")
        if appointment_id:
            try:
                response = self.supabase.table("appointments").select("*").eq("id", appointment_id).limit(1).execute()
                if response.data:
                    context["appointment"] = response.data[0]
                    context["appointments"] = response.data[0]
                    context.setdefault("person_id", response.data[0].get("person_id"))
            except Exception as exc:
                logging.warning("[ScenarioEngine] Could not fetch appointment: %s", exc)

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

        payment_id = payload.get("payment_id") or payload.get("stripe_payment_intent_id")
        if payment_id:
            try:
                response = self.supabase.table("payments").select("*").eq("id", payment_id).limit(1).execute()
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

        business_id = payload.get("business_id") or context.get("business_id")
        user_id = payload.get("user_id") or context.get("user_id") or scenario.get("user_id") or scenario.get("created_by")
        if user_id:
            context.setdefault("user_id", user_id)
        try:
            if business_id:
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
                    .eq("is_active", True)
                    .limit(1)
                    .execute()
                )
            if receptionist_response and receptionist_response.data:
                context["receptionist"] = receptionist_response.data[0]
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
