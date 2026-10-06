"""Offline regressions for manager operations and owner-only boundaries."""
import unittest

from fastapi import HTTPException

from backend.authorization import Tenant
from backend.permissions import require_permission, route_permission


class ManagerPermissionTests(unittest.TestCase):
    def setUp(self):
        self.manager = Tenant('manager', 1, 'owner', role='MANAGER', aal='aal2')

    def test_manager_can_update_knowledge_and_operational_settings(self):
        for path, method in (
            ('/api/sonar/business/profile', 'PUT'),
            ('/businesses/me/forwarding', 'PUT'),
            ('/api/workforce/invitations', 'POST'),
            ('/api/sonar/people/record', 'DELETE'),
            ('/api/sonar/analytics', 'GET'),
            ('/api/sonar/people/export', 'GET'),
        ):
            with self.subTest(path=path):
                require_permission(self.manager, route_permission(path, method))

    def test_manager_cannot_use_billing_or_delete_business(self):
        for path, method in (
            ('/api/sonar/billing/portal', 'POST'),
            ('/api/sonar/billing/usage', 'GET'),
            ('/api/sonar/payments', 'GET'),
            ('/api/sonar/invoices', 'GET'),
            ('/api/sonar/payments/test-mode', 'POST'),
            ('/create-checkout-session', 'POST'),
            ('/api/sonar/send-payment-link', 'POST'),
            ('/api/sonar/create-invoice', 'POST'),
            ('/businesses/me/forwarding/claim-number', 'POST'),
            ('/users/me/account/delete', 'POST'),
            ('/businesses/me', 'DELETE'),
            ('/api/workforce/members/member/transfer-ownership', 'POST'),
        ):
            with self.subTest(path=path):
                with self.assertRaises(HTTPException):
                    require_permission(self.manager, route_permission(path, method))


if __name__ == '__main__':
    unittest.main()
