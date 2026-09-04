"""Audited reads for the existing People and Appointments screens.

Not a generic SQL gateway: two resources, allowlisted columns and operators,
bounded pages, existing workforce identity/tenant/role enforcement.
"""
from typing import Literal, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from .config import supabase_admin
from .dependencies import get_current_user
from .authorization import current_tenant, tenant_scope
from .workforce import context
from .permissions import require_permission

router=APIRouter()
COLUMNS={
 'people':set('id created_at first_name last_name phone email street_address city state zip_code preferred_contact_method preferred_language best_time_to_contact consent_sms consent_call do_not_call do_not_text status source lead_source_detail tags updated_at last_inbound_call_at last_outbound_call_at last_call_status last_intent last_outcome missed_call_count last_inbound_sms_at last_outbound_sms_at last_sms_status last_inbound_email_at last_outbound_email_at last_email_status callback_needed callback_due_at handoff_required assigned_staff call_route payment_status balance_due invoice_id notes special_instructions user_id business_id stripe_customer_id stripe_payment_method_id custom_fields'.split()),
 'appointments':set('id date time duration status notes scenario_id created_at user_id person_id service_id business_id custom_fields source updated_at receptionist_id staff_id'.split()),
}

class ReadFilter(BaseModel):
    model_config=ConfigDict(extra='forbid')
    op: Literal['eq','gte','lte','gt','lt','in','is']
    field: str = Field(max_length=64)
    value: Any

class ReadOrder(BaseModel):
    model_config=ConfigDict(extra='forbid')
    field: str = Field(max_length=64)
    ascending: bool = True
    nullsFirst: bool = False

class ReadInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    columns: str = Field(default='*',max_length=2000)
    filters: list[ReadFilter] = Field(default_factory=list,max_length=20)
    order: list[ReadOrder] = Field(default_factory=list,max_length=5)
    limit: int = Field(default=1000,ge=1,le=1000)
    offset: int = Field(default=0,ge=0,le=1000000)
    single: Literal['single','maybeSingle'] | None = None

@router.post('/api/sonar/{resource}/read')
async def read_records(resource:Literal['people','appointments'],payload:ReadInput,user=Depends(get_current_user)):
    tenant=current_tenant.get() or context(user)
    require_permission(tenant,'operations.read')
    columns=[column.strip() for column in payload.columns.split(',')]
    if columns==['*']: columns=sorted(COLUMNS[resource])
    if not columns or any(c not in COLUMNS[resource] for c in columns): raise HTTPException(400,'Unsupported projection')
    with tenant_scope(tenant):
        query=supabase_admin.table(resource).select(','.join(columns))
        for item in payload.filters:
            if item.field not in COLUMNS[resource]: raise HTTPException(400,'Unsupported filter')
            if item.field in {'business_id','user_id'}:
                expected=tenant.business_id if item.field=='business_id' else tenant.owner_id
                if item.op!='eq' or str(item.value)!=str(expected): raise HTTPException(403,'Conflicting tenant context')
            if item.op=='in':
                if not isinstance(item.value,list) or len(item.value)>200 or any(isinstance(v,(dict,list)) for v in item.value): raise HTTPException(400,'Invalid filter')
            elif isinstance(item.value,(dict,list)) or len(str(item.value))>500: raise HTTPException(400,'Invalid filter')
            query=getattr(query,{'in':'in_','is':'is_'}.get(item.op,item.op))(item.field,item.value)
        for item in payload.order:
            if item.field not in COLUMNS[resource]: raise HTTPException(400,'Unsupported ordering')
            query=query.order(item.field,desc=not item.ascending,nullsfirst=item.nullsFirst)
        # Stable tie breaker for pagination; bounded like the prior Supabase read.
        if not any(item.field=='id' for item in payload.order): query=query.order('id')
        rows=query.range(payload.offset,payload.offset+(2 if payload.single else payload.limit)-1).execute().data or []
    if payload.single:
        if len(rows)>1 or (not rows and payload.single=='single'): raise HTTPException(406,'Expected one record')
        return rows[0] if rows else None
    return rows
