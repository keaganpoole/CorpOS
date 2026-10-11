import unittest
from unittest.mock import patch

from backend import main


class PlatformApplicationFeeTests(unittest.TestCase):
    def test_only_free_plan_has_payments_disabled(self):
        self.assertFalse(main.DEFAULT_PLAN_ENTITLEMENTS["free"]["payment_processing"])
        for plan in ("essentials", "pro", "ultra"):
            self.assertTrue(main.DEFAULT_PLAN_ENTITLEMENTS[plan]["payment_processing"])

    def test_three_percent_fee_rounds_to_nearest_cent(self):
        with patch.object(main, "stripe_application_fee_percent", "3"):
            self.assertEqual(main.calculate_platform_application_fee(1099), 33)
            self.assertEqual(main.calculate_platform_application_fee(10000), 300)
            self.assertEqual(main.calculate_platform_application_fee(17), 1)
            self.assertEqual(main.calculate_platform_application_fee(16), 0)
            self.assertEqual(main.calculate_platform_application_fee(0), 0)


if __name__ == "__main__":
    unittest.main()
