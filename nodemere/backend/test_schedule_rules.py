import unittest
from datetime import datetime, timezone

from backend.main import (
    get_business_schedule_for_date,
    is_business_available_during_hours,
    is_business_call_window_open,
)


def structured_business(**overrides):
    days = {}
    for day in ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"):
        days[day] = {
            "enabled": True,
            "layers": {
                "business": {"enabled": True, "start": 9, "end": 17},
                "inbound": {"enabled": True, "start": 8, "end": 12},
                "outbound": {"enabled": True, "start": 9, "end": 17},
            },
        }
    days.update(overrides.pop("days", {}))
    return {
        "business_timezone": "America/New_York",
        "business_hours": {
            "schema_version": 1,
            "timeline": {"start": 0, "end": 24},
            "days": days,
        },
        **overrides,
    }


class ScheduleRuleTests(unittest.TestCase):
    def test_business_layer_controls_appointment_window(self):
        business = structured_business()

        available, reason = is_business_available_during_hours(
            business, "2026-09-07", "16:30", 30, layer="business"
        )
        self.assertTrue(available)
        self.assertIsNone(reason)

        available, reason = is_business_available_during_hours(
            business, "2026-09-07", "16:45", 30, layer="business"
        )
        self.assertFalse(available)
        self.assertIn("outside business business hours", reason)

    def test_business_and_inbound_layers_are_independent(self):
        business = structured_business(
            days={
                "Sunday": {
                    "enabled": True,
                    "layers": {
                        "business": {"enabled": False, "start": 9, "end": 17},
                        "inbound": {"enabled": True, "start": 10, "end": 12},
                        "outbound": {"enabled": False, "start": 9, "end": 17},
                    },
                }
            }
        )

        appointment_available, _ = is_business_available_during_hours(
            business, "2026-09-13", "11:00", 30, layer="business"
        )
        self.assertFalse(appointment_available)

        inbound_open, _ = is_business_call_window_open(
            business,
            layer="inbound",
            at=datetime(2026, 9, 13, 15, 0, tzinfo=timezone.utc),
        )
        self.assertTrue(inbound_open)

    def test_inbound_window_uses_business_timezone_and_excludes_close(self):
        business = structured_business()
        window = get_business_schedule_for_date(business, "2026-09-07", layer="inbound")
        self.assertEqual(window["start_minutes"], 480)
        self.assertEqual(window["end_minutes"], 720)

        open_at_start, _ = is_business_call_window_open(
            business,
            layer="inbound",
            at=datetime(2026, 9, 7, 12, 0, tzinfo=timezone.utc),
        )
        closed_at_end, _ = is_business_call_window_open(
            business,
            layer="inbound",
            at=datetime(2026, 9, 7, 16, 0, tzinfo=timezone.utc),
        )
        self.assertTrue(open_at_start)
        self.assertFalse(closed_at_end)


if __name__ == "__main__":
    unittest.main()
