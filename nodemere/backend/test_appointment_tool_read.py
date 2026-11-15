"""Regression checks for the internal appointment read contract."""

import asyncio
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "test-key")

from backend import main


class Query:
    def __init__(self, count=8):
        self.calls = []
        self.count = count

    def __getattr__(self, name):
        def record(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            return self
        return record

    def execute(self):
        return SimpleNamespace(data=[{"id": "appointment-1", "notes": "Client cancelled"}], count=self.count)


class AppointmentReadTests(unittest.TestCase):
    def read(self, payload, count=8):
        query = Query(count)
        database = SimpleNamespace(table=lambda name: query if name == "appointments" else None)

        async def request_payload(_request):
            return payload

        with patch.object(main, "parse_request_payload", request_payload), \
             patch.object(main, "resolve_business_context", return_value={"business": {"id": 21, "business_timezone": "America/New_York"}}), \
             patch.object(main, "gate_intercom_write", return_value=None), \
             patch.object(main, "supabase", database):
            result = asyncio.run(main.legacy_server_tool("get-appointments", object()))
        return query.calls, result

    def test_unbounded_count_is_exact_and_page_is_separate(self):
        calls, result = self.read({"include_cancelled": True, "limit": 1})
        self.assertEqual(result["count"], 8)
        self.assertEqual(result["returned_count"], 1)
        self.assertTrue(result["has_more"])
        self.assertFalse(any(name in {"gte", "lte", "lt"} for name, _, _ in calls))
        self.assertFalse(any(name == "eq" and args[0] == "date" for name, args, _ in calls))

    def test_combined_status_date_and_latest_booking(self):
        calls, result = self.read({
            "status": "pending,confirmed", "date_from": "2026-10-01", "date_to": "2026-10-31",
            "sort_by": "created_at", "sort_order": "desc", "offset": 2,
        })
        self.assertIn(("in_", ("status", ["pending", "confirmed"]), {}), calls)
        self.assertIn(("gte", ("date", "2026-10-01"), {}), calls)
        self.assertIn(("lte", ("date", "2026-10-31"), {}), calls)
        self.assertIn(("order", ("created_at",), {"desc": True}), calls)
        self.assertIn(("range", (2, 26), {}), calls)
        self.assertEqual(result["count"], 8)


if __name__ == "__main__":
    unittest.main()
