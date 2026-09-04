"""Request-local authorization. No client claims are an ownership source.

The service client is scoped at its data boundary, in addition to PostgreSQL RLS.
Background jobs bind authority from a stored scenario; provider entrypoints must
verify their signature/secret before resolving and binding their business.
"""
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from fastapi import HTTPException


@dataclass(frozen=True)
class Tenant:
    actor_id: str
    business_id: object
    owner_id: str
    role: str = "OWNER"
    aal: str = "aal1"
    mfa_required: bool = False
    service: bool = False


current_tenant = ContextVar("nodemere_tenant", default=None)
current_identity = ContextVar("nodemere_identity", default=None)

BUSINESS_TABLES = frozenset({
    "people", "appointments", "staff", "services", "call_logs", "hired_receptionists",
    "scenarios", "flow_executions", "people_docs", "people_schema", "appointments_schema",
    "requests", "contracts", "custom_voices", "jobs", "purchased_numbers", "account_settings",
    "nest", "bugs", "reviews", "billing_overage_events",
})
OWNER_TABLES = frozenset({"payments", "invoices", "integrations", "checkpoints"})
PERSONAL_TABLES = frozenset({"users", "account_data_requests"})
CATALOG_TABLES = frozenset({"sonar_plans", "receptionist_catalog", "system_config"})
REFERENCES = {
    "person_id": "people", "appointment_id": "appointments", "staff_id": "staff",
    "service_id": "services", "receptionist_id": "hired_receptionists",
    "hired_receptionist_id": "hired_receptionists", "scenario_id": "scenarios",
    "payment_id": "payments", "invoice_id": "invoices", "integration_id": "integrations",
    "document_id": "people_docs", "request_id": "requests", "contract_id": "contracts",
    "execution_id": "flow_executions", "flow_execution_id": "flow_executions",
    "call_log_id": "call_logs", "assigned_staff": "staff",
}
OWNERSHIP = frozenset({"user_id", "business_id", "created_by", "owner_id"})


def forbidden(message="Access denied"):
    raise HTTPException(403, message)


def account_active(db, actor_id):
    rows = db.table("users").select("id,account_status").eq("id", str(actor_id)).limit(1).execute().data
    return bool(rows) and rows[0].get("account_status") not in {"closed", "pending_deletion", "disabled"}


def resolve_tenant(db, actor_id, *, aal="aal1", allow_missing=False):
    if not account_active(db, actor_id):
        forbidden("Account unavailable")
    memberships = db.table("business_memberships").select("business_id,role,status").eq("user_id", str(actor_id)).eq("status", "active").limit(2).execute().data or []
    if not memberships and allow_missing:
        return None
    if len(memberships) != 1:
        forbidden("An unambiguous business membership is required")
    member = memberships[0]
    rows = db.table("businesses").select("*").eq("id", member["business_id"]).limit(1).execute().data or []
    if not rows or member["role"] not in {"OWNER", "MANAGER", "STAFF"} or not account_active(db, rows[0]['user_id']):
        forbidden("Business unavailable")
    return Tenant(str(actor_id), rows[0]["id"], str(rows[0]["user_id"]),
                  role=member["role"], aal=aal, mfa_required=bool(rows[0].get("workforce_mfa_required")))


@contextmanager
def tenant_scope(tenant):
    existing = current_tenant.get()
    if existing and (str(existing.business_id), existing.owner_id) != (str(tenant.business_id), tenant.owner_id):
        forbidden("Conflicting business context")
    token = current_tenant.set(existing or tenant)
    try:
        yield tenant
    finally:
        current_tenant.reset(token)


def owner_id(user):
    tenant = current_tenant.get()
    return tenant.owner_id if tenant else str(user.id)


def scenario_tenant(db, scenario):
    owner = scenario.get("user_id") or scenario.get("created_by")
    if not owner or not account_active(db, owner):
        forbidden("Scenario owner unavailable")
    q = db.table("businesses").select("id,user_id").eq("user_id", str(owner))
    if scenario.get("business_id") is not None:
        q = q.eq("id", scenario["business_id"])
    rows = q.limit(1).execute().data or []
    if not rows:
        forbidden("Scenario business unavailable")
    return Tenant(str(owner), rows[0]["id"], str(owner), service=True)


def scoped_query(db, table, tenant, columns="*"):
    query = db.table(table).select(columns)
    if table == "businesses":
        return query.eq("id", tenant.business_id)
    if table in BUSINESS_TABLES:
        return query.eq("business_id", tenant.business_id)
    if table in OWNER_TABLES:
        return query.eq("user_id", tenant.owner_id)
    forbidden("Resource is not tenant-addressable")


def authorize_account_closure(db, actor_id, aal):
    """Closing a legacy billing principal must not strand other members."""
    if aal != 'aal2':
        forbidden('Verify your authenticator before closing your account')
    owned = db.table('businesses').select('id').eq('user_id',str(actor_id)).execute().data or []
    memberships = db.table('business_memberships').select('business_id,role,status').eq('user_id',str(actor_id)).eq('status','active').execute().data or []
    for business in owned:
        others = db.table('business_memberships').select('user_id').eq('business_id',business['id']).eq('status','active').execute().data or []
        if any(str(m['user_id']) != str(actor_id) for m in others):
            raise HTTPException(409,'This account is the business billing/data principal. Contact support before closing it while other members have access.')
    for member in memberships:
        if member['role'] != 'OWNER': continue
        owners = db.table('business_memberships').select('user_id').eq('business_id',member['business_id']).eq('role','OWNER').eq('status','active').execute().data or []
        if not any(str(m['user_id']) != str(actor_id) for m in owners) and not any(str(b['id'])==str(member['business_id']) for b in owned):
            raise HTTPException(409,'Transfer ownership before closing the last Owner account')


def require_record(db, tenant, table, record_id):
    if record_id is None or isinstance(record_id, (dict, list, bool)):
        forbidden("Invalid record reference")
    rows = scoped_query(db, table, tenant).eq("id", str(record_id)).limit(1).execute().data or []
    if not rows:
        raise HTTPException(404, "Record not found")
    row = rows[0]
    if row.get("business_id") is not None and str(row["business_id"]) != str(tenant.business_id):
        forbidden("Conflicting record ownership")
    if table != "staff" and row.get("user_id") and str(row["user_id"]) != tenant.owner_id:
        forbidden("Conflicting record ownership")
    return row


def trusted_call_tenant(db, *, claims=None, conversation_id=None, provider_call_sid=None):
    """Verified provider events use a signed capability or stored call binding."""
    bindings=[]
    for key,value in [('conversation_id',conversation_id),('provider_call_sid',provider_call_sid)]:
        if value:
            bindings.extend(db.table('call_logs').select('business_id,user_id').eq(key,str(value)).limit(10).execute().data or [])
    owners={(str(r.get('business_id')),str(r.get('user_id'))) for r in bindings if r.get('business_id') is not None and r.get('user_id')}
    if claims:
        expected=(str(claims['business_id']),str(claims['sub']))
        if owners and owners != {expected}: forbidden('Conflicting call binding')
    elif len(owners)==1:
        expected=next(iter(owners))
    else:
        raise HTTPException(503,'Call metadata binding is not available yet')
    return scenario_tenant(db,{'business_id':expected[0],'user_id':expected[1]})


def validate_references(db, tenant, value, *, recursive=True, depth=0):
    if depth > 25:
        forbidden("Context nesting limit exceeded")
    if isinstance(value, list):
        for item in value:
            validate_references(db, tenant, item, recursive=recursive, depth=depth + 1)
    elif isinstance(value, dict):
        for key, item in value.items():
            if item is None or item == "":
                continue
            if key in {"business_id", "businessId"} and str(item) != str(tenant.business_id):
                forbidden("Conflicting business context")
            if key in {"user_id", "userId", "owner_id", "created_by"} and str(item) not in {tenant.actor_id, tenant.owner_id}:
                forbidden("Conflicting owner context")
            if key in REFERENCES:
                # Unresolved scenario templates are validated after resolution.
                if isinstance(item, str) and "{{" in item:
                    continue
                # Invoice actions also accept Stripe's provider ID. That
                # namespace is resolved only through server-owned connected-
                # account request options, not as a local UUID row ID.
                if key == 'invoice_id' and isinstance(item,str) and item.startswith('in_'):
                    continue
                require_record(db, tenant, REFERENCES[key], item)
            if recursive and isinstance(item, (list, dict)):
                validate_references(db, tenant, item, depth=depth + 1)


class ScopedClient:
    """Supabase facade: immutable context, never changing a shared auth session."""
    def __init__(self, raw):
        self.raw = raw

    def __getattr__(self, name):
        return getattr(self.raw, name)

    def table(self, name):
        tenant = current_tenant.get()
        if tenant is None:
            return self.raw.table(name)
        return ScopedTable(self.raw, name, tenant)

    from_ = table

    def rpc(self, name, params=None):
        if current_tenant.get() and not current_tenant.get().service:
            forbidden("Privileged RPC requires a dedicated authorization path")
        return self.raw.rpc(name, params or {})


class ScopedTable:
    def __init__(self, db, name, tenant):
        if name not in BUSINESS_TABLES | OWNER_TABLES | PERSONAL_TABLES | CATALOG_TABLES | {"businesses", "scenario_events"}:
            forbidden("Unregistered resource")
        self.db, self.name, self.tenant = db, name, tenant

    def _scope(self, query):
        t, name = self.tenant, self.name
        if name == "businesses":
            return query.eq("id", t.business_id)
        if name in BUSINESS_TABLES:
            return query.eq("business_id", t.business_id)
        if name in OWNER_TABLES:
            return query.eq("user_id", t.owner_id)
        if name in PERSONAL_TABLES:
            if name == "users":
                return query.in_("id", list({t.actor_id, t.owner_id}))
            return query.eq("user_id", t.actor_id)
        if name == "scenario_events":
            return query.eq("payload->>business_id", str(t.business_id))
        if name in CATALOG_TABLES:
            return query
        forbidden("Unregistered resource")

    def select(self, *args, **kwargs):
        from .audit import ReadQuery, enforced
        projection = args[0] if args else '*'
        extra_id = enforced() and projection != '*' and 'id' not in {c.strip() for c in projection.split(',')}
        if extra_id: args = (projection + ',id', *args[1:])
        return ReadQuery(self._scope(self.db.table(self.name).select(*args, **kwargs)), self.db, self.tenant, self.name, extra_id)

    def _write(self, operation, values=None, **kwargs):
        if self.name in CATALOG_TABLES:
            forbidden("Catalog is server-managed")
        rows = values if isinstance(values, list) else [values] if values is not None else []
        for row in rows:
            validate_references(self.db, self.tenant, row, recursive=False)
            if self.name == 'call_logs':
                for key in ('conversation_id','provider_call_sid'):
                    if row.get(key):
                        existing=self.db.table('call_logs').select('business_id').eq(key,str(row[key])).limit(10).execute().data or []
                        if any(r.get('business_id') is not None and str(r['business_id']) != str(self.tenant.business_id) for r in existing):
                            forbidden('Conflicting call binding')
            if operation in {"update", "upsert"} and "id" in row and self.name in BUSINESS_TABLES | OWNER_TABLES:
                if operation == 'update' or self.db.table(self.name).select('id').eq('id',str(row['id'])).limit(1).execute().data:
                    require_record(self.db, self.tenant, self.name, row["id"])
            if self.name in BUSINESS_TABLES | OWNER_TABLES and "user_id" in row and str(row["user_id"]) != self.tenant.owner_id:
                forbidden("Ownership is server-managed")
            if self.name == "businesses" and "user_id" in row and str(row["user_id"]) != self.tenant.owner_id:
                forbidden("Ownership is server-managed")
        query = getattr(self.db.table(self.name), operation)(values, **kwargs) if values is not None else self.db.table(self.name).delete()
        # Inserts have no filters in PostgREST: enforce ownership on each row.
        if operation in {"insert", "upsert"}:
            for row in rows:
                expected = self.tenant.business_id if self.name in BUSINESS_TABLES else self.tenant.owner_id
                field = "business_id" if self.name in BUSINESS_TABLES else "user_id"
                if self.name in BUSINESS_TABLES | OWNER_TABLES and str(row.get(field)) != str(expected):
                    forbidden("Record ownership is required")
            return query
        return self._scope(query)

    def insert(self, values, **kwargs): return self._write("insert", values, **kwargs)
    def upsert(self, values, **kwargs): return self._write("upsert", values, **kwargs)
    def update(self, values, **kwargs): return self._write("update", values, **kwargs)
    def delete(self, **kwargs): return self._write("delete", **kwargs)
