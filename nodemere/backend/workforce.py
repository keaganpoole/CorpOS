"""Workforce membership only. No patient accounts or custom MFA implementation."""
from datetime import datetime, timezone
from uuid import UUID
from typing import Literal
from dataclasses import asdict, replace
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, ConfigDict, Field
from .config import (supabase_admin, frontend_base_url, system_gmail_sender_email,
    system_gmail_refresh_token, google_client_id, google_client_secret)
from .dependencies import get_current_user
from .authorization import resolve_tenant
from .permissions import require_permission
from .email_delivery_service import send_secure_link_email, SystemGmailConfiguration, EmailDeliveryError

router = APIRouter(prefix="/api/workforce", tags=["Workforce"])


class RetentionPolicy(BaseModel):
    model_config = ConfigDict(extra='forbid')
    enabled: bool = False
    legal_hold: bool = False
    workflow_days: int | None = Field(default=None, ge=1, le=3650)
    transient_call_days: int | None = Field(default=None, ge=1, le=3650)


@router.get('/retention')
async def retention_status(user=Depends(get_current_user)):
    tenant = owner(user)
    rows = database().table('business_retention_policy').select('enabled,legal_hold,workflow_days,transient_call_days,updated_at').eq('business_id',tenant.business_id).limit(1).execute().data
    return rows[0] if rows else RetentionPolicy().model_dump()


@router.put('/retention')
async def retention_policy(payload: RetentionPolicy, user=Depends(get_current_user)):
    tenant = owner(user)
    database().table('business_retention_policy').upsert({**payload.model_dump(), 'business_id':tenant.business_id,
        'updated_at':datetime.now(timezone.utc).isoformat()},on_conflict='business_id').execute()
    return {'ok':True}


@router.post('/retention/preview')
async def retention_preview(user=Depends(get_current_user)):
    tenant = owner(user)
    return database().rpc('nodemere_retention_batch', {'target_business':tenant.business_id,'apply_changes':False}).execute().data


@router.get('/data-protection')
async def data_protection(user=Depends(get_current_user)):
    tenant = owner(user)
    from .envelope import writes_enabled
    # Never expose wrapper bytes, key IDs, active KEK secrets, or a decrypt API.
    return {'encrypt_new':writes_enabled(), 'tenant_id':tenant.business_id,
            'coverage':['call transcripts/reports','workflow payloads','integration credentials','new private documents/recordings'],
            'historical_backfill_requires_operator':True}


@router.get('/audit-events')
async def audit_events(before: int | None = None, user=Depends(get_current_user)):
    tenant=owner(user)
    from .audit import enforced
    if not enforced(): return {'enabled':False,'events':[]}
    query=database().table('security_audit_events').select('id,occurred_at,actor_id,actor_type,action,resource,record_ids,outcome,request_id,status_code,changed_columns').eq('business_id',tenant.business_id).order('id',desc=True).limit(100)
    if before is not None: query=query.lt('id',before)
    return {'enabled':True,'events':query.execute().data or []}


def database():
    return getattr(supabase_admin, "raw", supabase_admin)


def context(user, allow_missing=False):
    try:
        tenant=resolve_tenant(database(), str(user.id), aal=getattr(user,"nodemere_aal","aal1"), allow_missing=allow_missing)
        if tenant and getattr(user,"nodemere_mfa_enrolled",False):
            tenant=replace(tenant,mfa_required=True)
        return tenant
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "Workforce security migration is required or membership service is unavailable")


def owner(user):
    tenant = context(user)
    require_permission(tenant, "security")
    return tenant


def confirmed_email(user):
    if not getattr(user,"email_confirmed_at",None) or not getattr(user,"email",None):
        raise HTTPException(403,"Verify your account email before accepting an invitation")
    return str(user.email).strip().lower()


class InviteInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    role: Literal["MANAGER","STAFF"]


class MemberInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["MANAGER","STAFF"]


class MfaPolicyInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    required: bool


@router.get('/session')
async def session(user=Depends(get_current_user)):
    tenant=context(user, allow_missing=True)
    policy=False
    if tenant:
        rows=database().table('businesses').select('workforce_mfa_required').eq('id',tenant.business_id).limit(1).execute().data or []
        policy=bool(rows and rows[0].get('workforce_mfa_required'))
    return {"tenant":asdict(tenant) if tenant else None,"policy_requires_mfa":policy}


@router.get('/invitations/pending')
async def pending(user=Depends(get_current_user)):
    email=confirmed_email(user)
    rows=database().table('business_invitations').select('id,role,expires_at,business_id').eq('email',email).is_('accepted_at','null').is_('revoked_at','null').gt('expires_at',datetime.now(timezone.utc).isoformat()).execute().data or []
    return rows


@router.post('/invitations/{invitation_id}/accept')
async def accept(invitation_id: UUID,user=Depends(get_current_user)):
    email=confirmed_email(user)
    try:
        result=database().rpc('nodemere_accept_invitation',{'invitation':str(invitation_id),'actor':str(user.id),'verified_email':email}).execute()
    except Exception:
        raise HTTPException(403,'Invitation is unavailable, expired, already used, or for another account')
    return {"ok":True,"business_id":result.data}


@router.get('/members')
async def members(user=Depends(get_current_user)):
    tenant=owner(user)
    rows=database().table('business_memberships').select('user_id,role,status,created_at').eq('business_id',tenant.business_id).execute().data or []
    # Names/emails here are workforce data, not patient data; no whole profiles.
    for row in rows:
        profile=database().table('users').select('full_name,email').eq('id',row['user_id']).limit(1).execute().data or []
        row.update(profile[0] if profile else {})
    return rows


@router.post('/invitations')
async def invite(payload:InviteInput,user=Depends(get_current_user)):
    tenant=owner(user)
    email=str(payload.email).lower().strip()
    if email==str(getattr(user,'email','')).lower(): raise HTTPException(400,'You are already a member')
    row=database().table('business_invitations').insert({'business_id':tenant.business_id,'email':email,'role':payload.role,'invited_by':tenant.actor_id}).execute().data[0]
    delivered=True
    try:
        send_secure_link_email(kind='workforce_invitation',recipient_email=email,business_name='Nodemere',
            secure_link=(frontend_base_url or 'http://localhost:5173').rstrip('/')+'/dashboard',
            configuration=SystemGmailConfiguration(sender_email=system_gmail_sender_email,refresh_token=system_gmail_refresh_token,google_client_id=google_client_id,google_client_secret=google_client_secret))
    except EmailDeliveryError:
        delivered=False
    return {'id':row['id'],'role':row['role'],'expires_at':row['expires_at'],'email_delivered':delivered}


@router.delete('/invitations/{invitation_id}')
async def revoke(invitation_id:UUID,user=Depends(get_current_user)):
    tenant=owner(user)
    database().table('business_invitations').update({'revoked_at':datetime.now(timezone.utc).isoformat()}).eq('id',str(invitation_id)).eq('business_id',tenant.business_id).execute()
    return {'ok':True}


@router.patch('/members/{member_id}')
async def change_role(member_id:UUID,payload:MemberInput,user=Depends(get_current_user)):
    tenant=owner(user)
    try:
        rows=database().table('business_memberships').update({'role':payload.role}).eq('business_id',tenant.business_id).eq('user_id',str(member_id)).eq('status','active').execute().data
    except Exception:
        raise HTTPException(409,'The last active Owner cannot be demoted')
    if not rows: raise HTTPException(404,'Member not found')
    return {'ok':True}


@router.delete('/members/{member_id}')
async def remove_member(member_id:UUID,user=Depends(get_current_user)):
    tenant=owner(user)
    try:
        rows=database().table('business_memberships').update({'status':'removed'}).eq('business_id',tenant.business_id).eq('user_id',str(member_id)).execute().data
    except Exception:
        raise HTTPException(409,'The last active Owner cannot be removed')
    if not rows: raise HTTPException(404,'Member not found')
    return {'ok':True}


@router.post('/members/{member_id}/transfer-ownership')
async def transfer(member_id:UUID,user=Depends(get_current_user)):
    tenant=owner(user)
    try:
        database().rpc('nodemere_transfer_ownership',{'business':tenant.business_id,'actor':tenant.actor_id,'target':str(member_id)}).execute()
    except Exception:
        raise HTTPException(409,'Ownership can only be transferred to another active member')
    return {'ok':True}


@router.put('/mfa-policy')
async def mfa_policy(payload:MfaPolicyInput,user=Depends(get_current_user)):
    tenant=owner(user)
    database().table('businesses').update({'workforce_mfa_required':payload.required}).eq('id',tenant.business_id).execute()
    return {'required':payload.required}
