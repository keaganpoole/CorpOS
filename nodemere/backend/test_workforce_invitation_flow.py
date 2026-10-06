import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from supabase_auth.errors import AuthApiError

from backend import workforce
from backend import main
from backend.models import AuthSignUpRequest


class Query:
    def __init__(self, rows):
        self.rows = rows
        self.updates = None

    def select(self, *_args): return self
    def eq(self, key, value):
        self.rows = [row for row in self.rows if str(row.get(key)) == str(value)]
        return self
    def is_(self, key, value):
        self.rows = [row for row in self.rows if (row.get(key) is None) == (value == 'null')]
        return self
    def gt(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) > value]
        return self
    def update(self, values):
        self.updates = values
        return self
    def limit(self, *_args): return self
    def execute(self):
        if self.updates is not None:
            for row in self.rows: row.update(self.updates)
        return SimpleNamespace(data=self.rows)


class Database:
    def __init__(self, invitation, business_name='Example Team'):
        self.invitation = invitation
        self.business_name = business_name

    def table(self, name):
        if name == 'business_invitations': return Query([self.invitation])
        if name == 'businesses': return Query([{'id': self.invitation['business_id'], 'name': self.business_name}])
        raise AssertionError(name)


class InvitationFlowTests(unittest.TestCase):
    def setUp(self):
        self.invitation_id = uuid4()
        self.invitation = {
            'id': str(self.invitation_id), 'business_id': str(uuid4()),
            'email': 'invitee@example.com', 'role': 'STAFF',
            'expires_at': (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            'accepted_at': None, 'revoked_at': None,
        }

    def test_preview_shows_invited_team_and_address(self):
        with patch.object(workforce, 'database', return_value=Database(self.invitation)):
            result = asyncio.run(workforce.invitation_preview(self.invitation_id))
        self.assertEqual(result, {'email': 'invitee@example.com', 'role': 'STAFF', 'business_name': 'Example Team'})

    def test_expired_invitation_does_not_show_signup_context(self):
        self.invitation['expires_at'] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        with patch.object(workforce, 'database', return_value=Database(self.invitation)):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(workforce.invitation_preview(self.invitation_id))
        self.assertEqual(raised.exception.status_code, 404)

    def test_missing_business_name_does_not_invalidate_invitation(self):
        with patch.object(workforce, 'database', return_value=Database(self.invitation, business_name='')):
            result = asyncio.run(workforce.invitation_preview(self.invitation_id))
        self.assertEqual(result['business_name'], '')
        self.assertEqual(result['email'], self.invitation['email'])

    def test_missing_business_name_does_not_hide_pending_invitation(self):
        with patch.object(workforce, 'database', return_value=Database(self.invitation, business_name='')), patch.object(workforce, 'confirmed_email', return_value=self.invitation['email']):
            result = asyncio.run(workforce.pending(SimpleNamespace()))
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['business_name'], '')

    def test_removing_member_revokes_unused_invitations(self):
        member_id = uuid4()
        member = {'business_id': self.invitation['business_id'], 'user_id': str(member_id), 'role': 'STAFF', 'status': 'active'}
        profile = {'id': str(member_id), 'email': self.invitation['email']}
        class MembershipDatabase:
            def table(self, name):
                return Query({'business_memberships': [member], 'users': [profile],
                              'business_invitations': [self_invitation]}[name])
        self_invitation = self.invitation
        with patch.object(workforce, 'database', return_value=MembershipDatabase()), patch.object(workforce, 'owner', return_value=SimpleNamespace(business_id=self.invitation['business_id'])):
            result = asyncio.run(workforce.remove_member(member_id, SimpleNamespace()))
        self.assertEqual(result, {'ok': True})
        self.assertEqual(member['status'], 'removed')
        self.assertIsNotNone(self.invitation['revoked_at'])

    def test_invited_signup_confirms_only_matching_valid_invitation(self):
        class ProfileQuery:
            def upsert(self, *_args, **_kwargs): return self
            def select(self): return self
            def execute(self): return SimpleNamespace(data=[])

        class Admin:
            def table(self, name):
                if name == 'business_invitations': return Query([self.invitation])
                if name == 'users': return ProfileQuery()
                raise AssertionError(name)

        admin = Admin()
        admin.invitation = self.invitation
        create_calls = []
        admin.auth = SimpleNamespace(admin=SimpleNamespace(create_user=lambda payload: create_calls.append(payload) or SimpleNamespace(user=SimpleNamespace(id=uuid4(), user_metadata={}))))
        request = SimpleNamespace()
        payload = AuthSignUpRequest(email=self.invitation['email'], password='example-password', terms_accepted=True,
                                    legal_version=main.NODEMERE_LEGAL_ACCEPTANCE_VERSION,
                                    certified_permitted_use=True, invitation_id=self.invitation_id)
        with patch.object(main, 'supabase_admin', admin), patch.object(main, 'new_auth_client', side_effect=AssertionError('ordinary signup must not run')), patch.object(main, 'get_client_ip', return_value='127.0.0.1'):
            asyncio.run(main.create_user(payload, request))
        self.assertEqual(len(create_calls), 1)
        self.assertEqual(create_calls[0]['email'], self.invitation['email'])
        self.assertTrue(create_calls[0]['email_confirm'])

    def test_revoked_invitation_cannot_create_confirmed_account(self):
        self.invitation['revoked_at'] = datetime.now(timezone.utc).isoformat()
        create_calls = []
        admin = SimpleNamespace(table=lambda name: Query([self.invitation]), auth=SimpleNamespace(admin=SimpleNamespace(create_user=lambda payload: create_calls.append(payload))))
        payload = AuthSignUpRequest(email=self.invitation['email'], password='example-password', terms_accepted=True,
                                    legal_version=main.NODEMERE_LEGAL_ACCEPTANCE_VERSION,
                                    certified_permitted_use=True, invitation_id=self.invitation_id)
        with patch.object(main, 'supabase_admin', admin):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(main.create_user(payload, SimpleNamespace()))
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(create_calls, [])

    def test_expired_invitation_cannot_create_confirmed_account(self):
        self.invitation['expires_at'] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        create_calls = []
        admin = SimpleNamespace(table=lambda name: Query([self.invitation]), auth=SimpleNamespace(admin=SimpleNamespace(create_user=lambda values: create_calls.append(values))))
        payload = AuthSignUpRequest(email=self.invitation['email'], password='example-password', terms_accepted=True,
                                    legal_version=main.NODEMERE_LEGAL_ACCEPTANCE_VERSION,
                                    certified_permitted_use=True, invitation_id=self.invitation_id)
        with patch.object(main, 'supabase_admin', admin):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(main.create_user(payload, SimpleNamespace()))
        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(create_calls, [])

    def test_existing_invitee_is_sent_to_sign_in(self):
        def existing_user(_payload):
            raise AuthApiError('already registered', 422, 'email_exists')
        admin = SimpleNamespace(table=lambda name: Query([self.invitation] if name == 'business_invitations' else []), auth=SimpleNamespace(admin=SimpleNamespace(create_user=existing_user)))
        payload = AuthSignUpRequest(email=self.invitation['email'], password='example-password', terms_accepted=True,
                                    legal_version=main.NODEMERE_LEGAL_ACCEPTANCE_VERSION,
                                    certified_permitted_use=True, invitation_id=self.invitation_id)
        with patch.object(main, 'supabase_admin', admin):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(main.create_user(payload, SimpleNamespace()))
        self.assertEqual(raised.exception.status_code, 409)

    def test_valid_invitation_recovers_prior_unconfirmed_signup(self):
        prior_id = uuid4()
        existing = SimpleNamespace(id=prior_id, email=self.invitation['email'], email_confirmed_at=None, user_metadata={})
        def existing_user(_payload):
            raise AuthApiError('already registered', 422, 'email_exists')
        updated = []
        auth_admin = SimpleNamespace(
            create_user=existing_user,
            get_user_by_id=lambda _id: SimpleNamespace(user=existing),
            update_user_by_id=lambda _id, values: updated.append(values) or SimpleNamespace(user=existing),
        )
        class ProfileQuery(Query):
            def upsert(self, *_args, **_kwargs): return self
        def table(name):
            if name == 'business_invitations': return Query([self.invitation])
            if name == 'users': return ProfileQuery([{'id': str(prior_id), 'email': self.invitation['email']}])
            raise AssertionError(name)
        admin = SimpleNamespace(table=table, auth=SimpleNamespace(admin=auth_admin))
        payload = AuthSignUpRequest(email=self.invitation['email'], password='new-password', terms_accepted=True,
                                    legal_version=main.NODEMERE_LEGAL_ACCEPTANCE_VERSION,
                                    certified_permitted_use=True, invitation_id=self.invitation_id)
        with patch.object(main, 'supabase_admin', admin), patch.object(main, 'get_client_ip', return_value='127.0.0.1'):
            asyncio.run(main.create_user(payload, SimpleNamespace()))
        self.assertEqual(updated, [{'email_confirm': True, 'password': 'new-password'}])

    def test_confirmed_existing_account_password_is_not_overwritten(self):
        prior_id = uuid4()
        existing = SimpleNamespace(id=prior_id, email=self.invitation['email'], email_confirmed_at='verified')
        def existing_user(_payload):
            raise AuthApiError('already registered', 422, 'email_exists')
        updates = []
        auth_admin = SimpleNamespace(create_user=existing_user, get_user_by_id=lambda _id: SimpleNamespace(user=existing),
                                     update_user_by_id=lambda _id, values: updates.append(values))
        def table(name):
            return Query([self.invitation] if name == 'business_invitations' else [{'id': str(prior_id), 'email': self.invitation['email']}])
        admin = SimpleNamespace(table=table, auth=SimpleNamespace(admin=auth_admin))
        payload = AuthSignUpRequest(email=self.invitation['email'], password='new-password', terms_accepted=True,
                                    legal_version=main.NODEMERE_LEGAL_ACCEPTANCE_VERSION,
                                    certified_permitted_use=True, invitation_id=self.invitation_id)
        with patch.object(main, 'supabase_admin', admin):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(main.create_user(payload, SimpleNamespace()))
        self.assertEqual(raised.exception.status_code, 409)
        self.assertEqual(updates, [])

    def test_normal_signup_still_requires_email_confirmation(self):
        class ProfileQuery:
            def upsert(self, *_args, **_kwargs): return self
            def select(self): return self
            def execute(self): return SimpleNamespace(data=[])
        admin = SimpleNamespace(table=lambda name: ProfileQuery())
        sign_up_calls = []
        auth_client = SimpleNamespace(auth=SimpleNamespace(sign_up=lambda values: sign_up_calls.append(values) or SimpleNamespace(user=SimpleNamespace(id=uuid4(), user_metadata={}))))
        payload = AuthSignUpRequest(email='new@example.com', password='example-password', terms_accepted=True,
                                    legal_version=main.NODEMERE_LEGAL_ACCEPTANCE_VERSION,
                                    certified_permitted_use=True)
        with patch.object(main, 'supabase_admin', admin), patch.object(main, 'new_auth_client', return_value=auth_client), patch.object(main, 'get_client_ip', return_value='127.0.0.1'):
            asyncio.run(main.create_user(payload, SimpleNamespace()))
        self.assertEqual(len(sign_up_calls), 1)
        self.assertEqual(sign_up_calls[0]['email'], 'new@example.com')
        self.assertIn('email_redirect_to', sign_up_calls[0]['options'])

    def test_signup_rejects_other_email_for_invitation(self):
        admin = SimpleNamespace(table=lambda name: Query([self.invitation]))
        payload = AuthSignUpRequest(email='other@example.com', password='example-password', terms_accepted=True,
                                    legal_version=main.NODEMERE_LEGAL_ACCEPTANCE_VERSION,
                                    certified_permitted_use=True, invitation_id=self.invitation_id)
        with patch.object(main, 'supabase_admin', admin):
            with self.assertRaises(HTTPException) as raised:
                asyncio.run(main.create_user(payload, SimpleNamespace()))
        self.assertEqual(raised.exception.status_code, 400)

    def test_only_preview_get_bypasses_membership_middleware(self):
        path = f'/api/workforce/invitations/{self.invitation_id}/preview'
        request = lambda method: SimpleNamespace(method=method, url=SimpleNamespace(path=path))
        self.assertTrue(main.is_public_api_route(request('GET')))
        self.assertFalse(main.is_public_api_route(request('POST')))


if __name__ == '__main__':
    unittest.main()
