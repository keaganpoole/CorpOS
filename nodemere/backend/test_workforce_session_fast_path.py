import unittest
from types import SimpleNamespace
from unittest.mock import patch
from fastapi import HTTPException

from backend import dependencies
from backend.authorization import resolve_session_tenant


class Result:
    def __init__(self, data): self.data = data


class Rpc:
    def __init__(self, data): self.data = data
    def execute(self): return Result(self.data)


class Database:
    def __init__(self, row): self.row = row; self.calls = []
    def rpc(self, name, params):
        self.calls.append((name, params))
        return Rpc([self.row])


def row(**updates):
    value = dict(actor_exists=True, actor_status='active', active_membership_count=1,
        business_id=7, owner_id='11111111-1111-4111-8111-111111111111',
        membership_role='OWNER', owner_exists=True, owner_status='active',
        workforce_mfa_required=True, mfa_enrolled=False)
    value.update(updates)
    return value


class WorkforceSessionFastPathTests(unittest.TestCase):
    def test_resolves_with_one_database_call(self):
        db = Database(row())
        tenant = resolve_session_tenant(db, '22222222-2222-4222-8222-222222222222', aal='aal2')
        self.assertEqual((tenant.business_id, tenant.role, tenant.aal, tenant.mfa_required), (7, 'OWNER', 'aal2', True))
        self.assertEqual(len(db.calls), 1)

    def test_removed_member_can_be_missing_during_bootstrap(self):
        db = Database(row(active_membership_count=0, business_id=None, owner_id=None,
                          membership_role=None, owner_exists=False))
        self.assertIsNone(resolve_session_tenant(db, '22222222-2222-4222-8222-222222222222', allow_missing=True))

    def test_closed_actor_and_inactive_owner_fail_closed(self):
        for update in ({'actor_status':'disabled'}, {'owner_status':'pending_deletion'}):
            with self.subTest(update=update), self.assertRaises(HTTPException):
                resolve_session_tenant(Database(row(**update)), '22222222-2222-4222-8222-222222222222', allow_missing=True)

    def test_ambiguous_membership_and_invalid_role_fail_closed(self):
        for update in ({'active_membership_count':2}, {'membership_role':'ADMIN'}):
            with self.subTest(update=update), self.assertRaises(HTTPException):
                resolve_session_tenant(Database(row(**update)), '22222222-2222-4222-8222-222222222222', allow_missing=True)

    def test_existing_factor_keeps_mfa_required(self):
        tenant = resolve_session_tenant(Database(row(workforce_mfa_required=False, mfa_enrolled=True)),
                                        '22222222-2222-4222-8222-222222222222')
        self.assertTrue(tenant.mfa_required)


class WorkforceClaimsResponseTests(unittest.IsolatedAsyncioTestCase):
    async def test_accepts_real_supabase_typed_dict_response(self):
        token = SimpleNamespace(credentials='verified-access-token')
        verified = {
            'claims': {
                'sub': 'user-1',
                'email': 'owner@example.test',
                'aal': 'aal2',
                'user_metadata': {},
                'app_metadata': {},
            },
            'headers': {'alg': 'ES256', 'kid': 'test'},
            'signature': b'signature',
        }

        with patch.object(dependencies.supabase_auth.auth, 'get_claims', return_value=verified):
            user = await dependencies.get_current_user_for_workforce_session(token)

        self.assertEqual(user.id, 'user-1')
        self.assertEqual(user.nodemere_aal, 'aal2')


if __name__ == '__main__':
    unittest.main()
