"""Offline checks for team MFA policy versus an individual's enrollment."""
import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from backend.authorization import resolve_session_tenant
from backend.permissions import require_permission


class SessionDatabase:
    def __init__(self, *, policy=False, enrolled=False):
        self.row = {
            "actor_exists": True, "actor_status": "active",
            "active_membership_count": 1, "business_id": 1,
            "owner_id": "owner", "membership_role": "STAFF",
            "owner_exists": True, "owner_status": "active",
            "workforce_mfa_required": policy, "mfa_enrolled": enrolled,
        }

    def rpc(self, name, payload):
        assert name == "nodemere_workforce_session"
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=[self.row]))


class WorkforceMfaPolicyTests(unittest.TestCase):
    def test_personal_enrollment_does_not_turn_on_team_policy(self):
        tenant = resolve_session_tenant(SessionDatabase(enrolled=True), "actor")
        self.assertFalse(tenant.policy_requires_mfa)
        self.assertTrue(tenant.mfa_required)

    def test_team_policy_requires_mfa_for_all_members(self):
        for role in ("OWNER", "MANAGER", "STAFF"):
            with self.subTest(role=role):
                tenant = resolve_session_tenant(SessionDatabase(policy=True), "actor")
                tenant = SimpleNamespace(**{**tenant.__dict__, "role": role})
                self.assertTrue(tenant.policy_requires_mfa)
                with self.assertRaises(HTTPException) as blocked:
                    require_permission(tenant, "operations.read")
                self.assertEqual(blocked.exception.detail["code"], "mfa_required")

    def test_verified_member_can_continue(self):
        tenant = resolve_session_tenant(SessionDatabase(policy=True), "actor", aal="aal2")
        require_permission(tenant, "operations.read")

    def test_policy_off_does_not_block_unenrolled_member(self):
        tenant = resolve_session_tenant(SessionDatabase(), "actor")
        self.assertFalse(tenant.policy_requires_mfa)
        require_permission(tenant, "operations.read")


if __name__ == "__main__":
    unittest.main()
