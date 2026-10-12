"""Regressions for routing pending forwarding tests to the activation agent."""

import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from fastapi import HTTPException

from backend import main


class ActivationForwardingRoutingTests(unittest.IsolatedAsyncioTestCase):
    async def test_activation_agent_call_skips_billing_after_verification(self):
        business = {
            "id": 77,
            "user_id": "owner",
            "twilio_number": "+12075550124",
            "forwarding_config": {
                "active_number_id": "entry-1",
                "numbers": [{
                    "id": "entry-1",
                    "status": "verified",
                    "target_number": "+12075550124",
                }],
            },
        }
        request = SimpleNamespace(url=SimpleNamespace(path="/api/call/route"))
        payload = {
            "agent_id": "activation-agent",
            "called_number": "+12075550124",
            "caller_id": "+12075550125",
            "conversation_id": "conversation-1",
        }

        with (
            patch.object(main, "parse_request_payload", new=AsyncMock(return_value=payload)),
            patch.object(main, "resolve_business_context", return_value={"business": business, "user_id": "owner"}),
            patch.object(main, "elevenlabs_agent_id_activation", "activation-agent"),
            patch.object(main, "enforce_call_minutes", side_effect=HTTPException(402)) as enforce_billing,
            patch.object(main, "find_inbound_receptionist_for_business", return_value=None),
            patch.object(main, "upsert_active_call_log"),
            patch.object(main, "emit_scenario_trigger") as emit_scenario,
            patch.object(main, "push_live_event"),
            patch.object(main, "caller_authentication_allowed", return_value=False),
            patch.object(main, "add_people_intake_dynamic_variables"),
            patch.object(main, "add_escalation_dynamic_variables"),
            patch.object(main, "lookup_person_record", return_value=None),
        ):
            result = await main.route_call_compat(request)

        self.assertTrue(result["ok"])
        enforce_billing.assert_not_called()
        emit_scenario.assert_not_called()

    def test_non_activation_agent_is_not_exempt(self):
        with patch.object(main, "elevenlabs_agent_id_activation", "activation-agent"):
            self.assertFalse(main.is_activation_agent_call({"agent_id": "inbound-agent"}))
            self.assertFalse(main.is_activation_agent_call({}))

    async def test_activation_post_call_does_not_use_billable_minutes(self):
        payload = {
            "type": "post_call_transcription",
            "data": {"conversation_id": "activation-conversation", "agent_id": "activation-agent"},
        }
        call_log = {
            "conversation_id": "activation-conversation",
            "elevenlabs_agent_id": "activation-agent",
            "duration_seconds": 60,
            "business_id": 77,
        }
        supabase = Mock()
        supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = []
        supabase.table.return_value.insert.return_value.execute.return_value.data = [{"id": 1, **call_log}]

        with (
            patch.object(main, "elevenlabs_agent_id_activation", "activation-agent"),
            patch.object(main, "extract_call_log_from_elevenlabs_payload", return_value=call_log),
            patch.object(main, "extract_dynamic_variables", return_value={}),
            patch.object(main, "current_tenant") as tenant,
            patch.object(main, "load_business_by_id", return_value={"id": 77}),
            patch.object(main, "validate_references"),
            patch.object(main, "enrich_call_log_with_person"),
            patch.object(main, "claim_call_milestones"),
            patch.object(main, "record_call_nest_event"),
            patch.object(main, "increment_business_usage_summary") as increment_usage,
            patch.object(main, "supabase", supabase),
        ):
            tenant.get.return_value = SimpleNamespace(business_id=77, owner_id="owner")
            result = await main.persist_elevenlabs_event(payload)

        self.assertTrue(result["ok"])
        increment_usage.assert_not_called()

    def test_only_completed_inbound_call_after_test_started_verifies(self):
        started_at = datetime.now(timezone.utc)
        call = {
            "to": "+12075550124",
            "direction": "inbound",
            "date_created": (started_at + timedelta(seconds=1)).isoformat(),
            "status": "ringing",
            "duration": "0",
        }

        def matches():
            return main.twilio_call_matches_inbound_verification(call, "+12075550124", started_at)

        self.assertFalse(matches())
        call["status"] = "completed"
        self.assertFalse(matches())
        call["duration"] = "12"
        self.assertTrue(matches())
        call["date_created"] = (started_at - timedelta(seconds=1)).isoformat()
        self.assertFalse(matches())
        call["date_created"] = (started_at + timedelta(seconds=1)).isoformat()
        call["direction"] = "outbound-api"
        self.assertFalse(matches())
        call["direction"] = "inbound"
        call.pop("date_created")
        self.assertFalse(matches())

    def test_retry_accepts_just_placed_call_but_excludes_previous_verified_call(self):
        confirmed_at = datetime.fromisoformat("2026-10-11T15:46:02+00:00")
        previous_verified_at = "2026-10-11T15:41:02+00:00"
        cutoff = main.forwarding_test_window_start({"verified_at": previous_verified_at}, confirmed_at)
        self.assertEqual(cutoff, confirmed_at - timedelta(seconds=90))

        call = {
            "to": "+12075550124", "direction": "inbound", "status": "completed", "duration": "5",
            "date_created": "2026-10-11T15:45:42+00:00",
        }
        self.assertTrue(main.twilio_call_matches_inbound_verification(call, "+12075550124", cutoff))
        call["date_created"] = "2026-10-11T15:40:50+00:00"
        self.assertFalse(main.twilio_call_matches_inbound_verification(call, "+12075550124", cutoff))

        very_recent_verification = {"verified_at": "2026-10-11T15:45:55+00:00"}
        self.assertEqual(main.forwarding_test_window_start(very_recent_verification, confirmed_at),
                         datetime.fromisoformat(very_recent_verification["verified_at"]))

    async def test_forwarding_status_read_schedules_verification_without_blocking_on_twilio(self):
        business = {
            "id": 77,
            "user_id": "owner",
            "phone": "+12075550123",
            "twilio_number": "+12075550124",
            "twilio_number_status": "active",
            "forwarding_config": {
                "active_number_id": "entry-1",
                "numbers": [{
                    "id": "entry-1",
                    "source_number": "+12075550123",
                    "target_number": "+12075550124",
                    "status": "pending_test",
                    "updated_at": "2026-10-10T00:00:00+00:00",
                    "confirmed_enabled_at": "2026-10-09T23:00:00+00:00",
                }],
            },
        }

        with (
            patch.object(main, "business_owner_id", return_value="owner"),
            patch.object(main, "get_business_record_for_user", return_value=business),
            patch.object(main, "schedule_twilio_inbound_forwarding_verification_watch") as schedule,
            patch.object(main, "maybe_auto_verify_business_forwarding_from_recent_twilio_call") as sync_inline,
            patch.object(main, "maybe_sync_business_caller_id_verification_from_twilio") as caller_id_sync,
            patch.object(main, "get_system_number_purchase_limit", return_value=3),
            patch.object(main, "get_business_number_purchase_count", return_value=1),
            patch.object(main, "get_system_verify_caller_id_enabled", return_value=False),
        ):
            result = await main.get_business_forwarding(current_user=SimpleNamespace(id="owner"))

        self.assertEqual(result["current_entry"]["status"], "pending_test")
        schedule.assert_called_once_with(77, "entry-1", "+12075550124", "2026-10-09T23:00:00+00:00")
        sync_inline.assert_not_called()
        caller_id_sync.assert_not_called()

    async def test_pending_forwarding_assigns_activation_agent_before_saving(self):
        business = {
            "id": 77,
            "user_id": "owner",
            "phone": "+12075550123",
            "twilio_number": "+12075550124",
            "forwarding_config": {"numbers": []},
        }
        supabase = Mock()
        supabase.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [business]
        payload = main.BusinessForwardingUpdateRequest(
            source_number=business["phone"],
            provider="att",
            status="pending_test",
            confirmed_enabled=True,
        )

        with (
            patch.object(main, "business_owner_id", return_value="owner"),
            patch.object(main, "get_business_record_for_user", return_value=business),
            patch.object(main, "supabase", supabase),
            patch.object(main, "assign_business_phone_number_to_agent", return_value=True) as assign,
            patch.object(main, "schedule_twilio_inbound_forwarding_verification_watch") as schedule,
            patch.object(main, "clear_inbound_call_boot_cache"),
            patch.object(main, "push_live_event"),
            patch.object(main, "elevenlabs_agent_id_activation", "activation-agent"),
        ):
            result = await main.update_business_forwarding(payload, current_user=SimpleNamespace(id="owner"))

        assign.assert_called_once_with(business, "activation-agent")
        self.assertEqual(result["entry"]["status"], "pending_test")
        schedule.assert_called_once()

    async def test_retry_saves_grace_cutoff_without_reusing_old_verification(self):
        previous_verified = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        business = {
            "id": 77, "user_id": "owner", "phone": "+12075550123", "twilio_number": "+12075550124",
            "forwarding_config": {"active_number_id": "entry-1", "numbers": [{
                "id": "entry-1", "source_number": "+12075550123", "provider": "att",
                "status": "pending_test", "confirmed_enabled_at": previous_verified,
                "verified_at": previous_verified,
            }]},
        }
        supabase = Mock()
        supabase.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [business]
        payload = main.BusinessForwardingUpdateRequest(
            entry_id="entry-1", source_number=business["phone"], provider="att",
            status="pending_test", confirmed_enabled=True,
        )
        before = datetime.now(timezone.utc) - timedelta(seconds=90)

        with (
            patch.object(main, "get_business_record_for_user", return_value=business),
            patch.object(main, "supabase", supabase),
            patch.object(main, "assign_business_phone_number_to_agent", return_value=True),
            patch.object(main, "schedule_twilio_inbound_forwarding_verification_watch") as schedule,
            patch.object(main, "clear_inbound_call_boot_cache"),
            patch.object(main, "push_live_event"),
            patch.object(main, "elevenlabs_agent_id_activation", "activation-agent"),
        ):
            result = await main.update_business_forwarding(payload, current_user=SimpleNamespace(id="owner"))

        cutoff = datetime.fromisoformat(result["entry"]["confirmed_enabled_at"])
        self.assertGreaterEqual(cutoff, before)
        self.assertLessEqual(cutoff, datetime.now(timezone.utc) - timedelta(seconds=90))
        self.assertIsNone(result["entry"]["verified_at"])
        self.assertEqual(schedule.call_args.args[3], result["entry"]["confirmed_enabled_at"])

    async def test_pending_forwarding_fails_closed_without_activation_agent(self):
        business = {
            "id": 77,
            "user_id": "owner",
            "phone": "+12075550123",
            "twilio_number": "+12075550124",
            "forwarding_config": {"numbers": []},
        }
        supabase = Mock()
        payload = main.BusinessForwardingUpdateRequest(
            source_number=business["phone"],
            provider="att",
            status="pending_test",
            confirmed_enabled=True,
        )

        with (
            patch.object(main, "business_owner_id", return_value="owner"),
            patch.object(main, "get_business_record_for_user", return_value=business),
            patch.object(main, "supabase", supabase),
            patch.object(main, "assign_business_phone_number_to_agent") as assign,
            patch.object(main, "elevenlabs_agent_id_activation", None),
        ):
            with self.assertRaises(HTTPException) as caught:
                await main.update_business_forwarding(payload, current_user=SimpleNamespace(id="owner"))

        self.assertEqual(caught.exception.status_code, 503)
        assign.assert_not_called()
        supabase.table.assert_not_called()

    def test_successful_test_restores_normal_inbound_agent(self):
        business = {
            "id": 77,
            "twilio_number": "+12075550124",
            "forwarding_config": {
                "active_number_id": "entry-1",
                "numbers": [{
                    "id": "entry-1",
                    "status": "pending_test",
                    "source_number": "+12075550123",
                    "target_number": "+12075550124",
                }],
            },
        }
        supabase = Mock()
        supabase.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [business]

        with (
            patch.object(main, "assign_business_phone_number_to_agent", return_value=True) as assign,
            patch.object(main, "supabase", supabase),
            patch.object(main, "push_live_event"),
            patch.object(main, "elevenlabs_agent_id_inbound", "inbound-agent"),
        ):
            result = main.maybe_auto_verify_business_forwarding(
                business,
                called_number=business["twilio_number"],
            )

        assign.assert_called_once_with(business, "inbound-agent")
        self.assertEqual(result["status"], "verified")


if __name__ == "__main__":
    unittest.main()
