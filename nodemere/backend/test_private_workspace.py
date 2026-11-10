"""Focused boundary checks; no live data or secrets used here."""
import hashlib
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
from .authorization import Tenant
from .test_workspace import authorize, validate_custom_values


class PrivateWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.binding = dict(owner_id='owner', business_id=21, email='owner@example.com',
                            secret_hash=hashlib.sha256(b'test-secret').hexdigest())
        self.db = MagicMock()
        self.db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [{'email': 'owner@example.com'}]

    def auth(self, token='Bearer test-secret', peer='127.0.0.1', origin=None, tenant=None):
        with patch('backend.test_workspace.resolve_tenant', return_value=tenant or Tenant('owner', 21, 'owner')):
            return authorize(self.binding, token, peer, origin, self.db)

    def test_correct_owner_can_reuse_credential(self):
        self.assertTrue(self.auth().service)
        self.assertEqual(self.auth().business_id, 21)

    def test_wrong_or_absent_secret_fails(self):
        for token in ('', 'Bearer wrong'):
            with self.assertRaises(HTTPException): self.auth(token=token)

    def test_browser_and_remote_access_fail(self):
        with self.assertRaises(HTTPException): self.auth(origin='http://localhost:5173')
        with self.assertRaises(HTTPException): self.auth(peer='192.168.1.1')

    def test_membership_and_owner_changes_fail(self):
        for tenant in (Tenant('owner', 22, 'owner'), Tenant('owner', 21, 'other'),
                       Tenant('owner', 21, 'owner', role='STAFF')):
            with self.assertRaises(HTTPException): self.auth(tenant=tenant)

    def test_identity_change_fails(self):
        self.binding['email'] = 'other@example.com'
        with self.assertRaises(HTTPException): self.auth()

    def test_unknown_custom_fields_rejected(self):
        with self.assertRaises(HTTPException): validate_custom_values({'custom_fields': {'custom_other_account': 'x'}}, [])

    def test_field_values_validate_types_and_options(self):
        definitions = [{'field_key': 'custom_bool', 'field_type': 'boolean'},
                       {'field_key': 'custom_plan', 'field_type': 'select', 'config': {'options': ['Gold']}}]
        validate_custom_values({'custom_fields': {'custom_bool': False, 'custom_plan': 'Gold'}}, definitions)
        for values in ({'custom_bool': 'false'}, {'custom_plan': 'Unknown'}):
            with self.assertRaises(HTTPException): validate_custom_values({'custom_fields': values}, definitions)


if __name__ == '__main__': unittest.main()
