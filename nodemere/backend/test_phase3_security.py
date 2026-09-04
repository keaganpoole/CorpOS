"""Offline role/MFA regressions. No real invitations, emails or MFA changes."""
import unittest
from dataclasses import replace
from unittest.mock import patch
from types import SimpleNamespace
from fastapi import HTTPException
from pydantic import ValidationError
from backend.test_phase1_security import FakeDatabase, OWNER, OTHER
from backend.authorization import Tenant, resolve_tenant
from backend.permissions import PERMISSIONS, STEP_UP, require_permission, route_permission
from backend.workforce import InviteInput, MemberInput, confirmed_email


class WorkforceTests(unittest.TestCase):
    def test_permission_matrix_all_roles_and_assurance_levels(self):
        for role in ['OWNER','MANAGER','STAFF','ADMIN','unknown']:
            for permission, allowed in PERMISSIONS.items():
                for aal in ['aal1','aal2']:
                    with self.subTest(role=role,permission=permission,aal=aal):
                        t=Tenant(OWNER,1,OWNER,role=role,aal=aal)
                        if role in allowed and (permission not in STEP_UP or aal=='aal2'):
                            require_permission(t,permission)
                        else:
                            with self.assertRaises(HTTPException): require_permission(t,permission)

    def test_mandatory_mfa_applies_even_to_operational_reads(self):
        for role in ['OWNER','MANAGER','STAFF']:
            with self.subTest(role=role), self.assertRaises(HTTPException):
                require_permission(Tenant(OWNER,1,OWNER,role=role,mfa_required=True),'operations.read')

    def test_membership_not_job_title_or_user_metadata(self):
        db=FakeDatabase(); db.rows['business_memberships'][0]['role']='STAFF'
        self.assertEqual(resolve_tenant(db,OWNER).role,'STAFF')

    def test_removed_membership_immediately_revokes_api_access(self):
        db=FakeDatabase(); db.rows['business_memberships'][0]['status']='removed'
        with self.assertRaises(HTTPException): resolve_tenant(db,OWNER)

    def test_member_can_use_business_without_owning_legacy_rows(self):
        db=FakeDatabase(); db.rows['users'].append({'id':OTHER,'account_status':'active'})
        db.rows['business_memberships'][1].update(business_id=1,role='MANAGER')
        t=resolve_tenant(db,OTHER)
        self.assertEqual((t.actor_id,t.owner_id,t.business_id),(OTHER,OWNER,1))

    def test_closed_billing_principal_disables_other_members_api_access(self):
        db=FakeDatabase(); db.rows['users'].append({'id':OTHER,'account_status':'active'})
        db.rows['business_memberships'][1].update(business_id=1,role='MANAGER')
        db.rows['users'][0]['account_status']='closed'
        with self.assertRaises(HTTPException): resolve_tenant(db,OTHER)

    def test_invitee_cannot_self_promote_or_supply_identity(self):
        for value in [{'email':'a@example.test','role':'OWNER'}, {'email':'a@example.test','role':'STAFF','user_id':OTHER}]:
            with self.assertRaises(ValidationError): InviteInput(**value)
        with self.assertRaises(ValidationError): MemberInput(role='OWNER')

    def test_email_must_be_confirmed_by_auth(self):
        with self.assertRaises(HTTPException): confirmed_email(SimpleNamespace(email='a@example.test',email_confirmed_at=None))
        self.assertEqual(confirmed_email(SimpleNamespace(email='A@Example.Test',email_confirmed_at='verified')),'a@example.test')

    def test_sensitive_routes_require_owner_and_stepup(self):
        for path,method in [('/users/me/integrations/stripe/authorize','GET'),('/api/sonar/billing/portal','POST'),('/api/workforce/members','GET'),('/api/sonar/people/1','DELETE')]:
            permission=route_permission(path,method)
            for t in [Tenant(OWNER,1,OWNER),Tenant(OWNER,1,OWNER,role='MANAGER',aal='aal2')]:
                with self.subTest(path=path,role=t.role), self.assertRaises(HTTPException): require_permission(t,permission)

    def test_unrecognized_route_defaults_to_owner_stepup(self):
        self.assertEqual(route_permission('/api/new-dangerous-feature','POST'),'administration')


if __name__=='__main__': unittest.main()
