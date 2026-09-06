import unittest

from backend.business_intelligence import _format_timestamp


class BusinessIntelligenceFormattingTests(unittest.TestCase):
    def test_timestamp_format_is_cross_platform(self):
        formatted = _format_timestamp("2026-09-06T15:04:00+00:00")

        self.assertRegex(
            formatted or "",
            r"^[A-Z][a-z]{2} \d{1,2}, 2026 · \d{1,2}:04 [AP]M$",
        )

    def test_invalid_timestamp_is_omitted(self):
        self.assertIsNone(_format_timestamp("not-a-timestamp"))


if __name__ == "__main__":
    unittest.main()
