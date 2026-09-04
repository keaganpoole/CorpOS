"""Small, default-deny workforce permission vocabulary shared by API routes."""
from fastapi import HTTPException

PERMISSIONS = {
    "operations.read": {"OWNER", "MANAGER", "STAFF"},
    "operations.write": {"OWNER", "MANAGER", "STAFF"},
    "operations.manage": {"OWNER", "MANAGER"},
    "sensitive.read": {"OWNER", "MANAGER"},
    "billing.read": {"OWNER"},
    "administration": {"OWNER"},
    "security": {"OWNER"},
    "integrations": {"OWNER"},
    "billing.change": {"OWNER"},
    "export": {"OWNER"},
    "delete": {"OWNER"},
}
STEP_UP = {"administration", "security", "integrations", "billing.change", "export", "delete"}


def contains_privileged_scenario_action(value):
    """Conservative across nested/serialized definitions, including padded keys."""
    import json
    serialized = json.dumps(value)
    return any(key in serialized for key in ('refund_payment', 'cancel_subscription'))


def require_permission(tenant, permission):
    if not tenant or tenant.role not in PERMISSIONS.get(permission, set()):
        raise HTTPException(403, "Your business role does not permit this action")
    if not tenant.service and (tenant.mfa_required or permission in STEP_UP) and tenant.aal != "aal2":
        raise HTTPException(403, {"code": "mfa_required", "message": "Verify your authenticator to continue"})


def route_permission(path, method):
    read = method in {"GET", "HEAD"}
    if path in {'/api/sonar/people/read','/api/sonar/appointments/read'} and method == 'POST':
        return 'operations.read'
    if path.startswith('/api/workforce/'):
        return "security"
    if '/integrations' in path or '/forwarding' in path:
        return "integrations"
    if any(s in path for s in ('/billing','checkout','refund-payment','cancel-subscription','payment-profile')):
        return "billing.read" if read else "billing.change"
    if method == 'DELETE' or path.endswith('/delete'):
        return "delete"
    if 'export' in path or '/privacy-requests' in path:
        return "export"
    if '/documents' in path or '/call-logs' in path or '/scenarios/executions' in path:
        return "sensitive.read" if read else "operations.manage"
    if any(s in path for s in ('/analytics','/intelligence','/project-report')):
        return "sensitive.read" if read else "operations.manage"
    if any(s in path for s in ('/scenarios','/staff','/services','/receptionists','/api/agents')):
        return "operations.read" if read else "operations.manage"
    if any(s in path for s in ('/people','/appointments','/nest/','/session','/system/summary','/events/live-pulse','/pipeline','/control-state','/api/logs','/bugs')):
        return "operations.read" if read else "operations.write"
    if any(s in path for s in ('/business/','/businesses/')):
        return "operations.read" if read else "administration"
    if any(s in path for s in ('create-payment','send-payment-link','create-invoice','send-invoice','create-customer','update-customer','update-payment','send-email','call-customer')):
        return "operations.manage"
    return "administration"
