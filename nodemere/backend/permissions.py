"""Small, default-deny workforce permission vocabulary shared by API routes."""
from fastapi import HTTPException

PERMISSIONS = {
    "operations.read": {"OWNER", "MANAGER", "STAFF"},
    "operations.write": {"OWNER", "MANAGER", "STAFF"},
    "operations.manage": {"OWNER", "MANAGER"},
    "sensitive.read": {"OWNER", "MANAGER"},
    "billing.read": {"OWNER"},
    "billing.portal": {"OWNER"},
    "administration": {"OWNER", "MANAGER"},
    "security": {"OWNER", "MANAGER"},
    "integrations": {"OWNER", "MANAGER"},
    "billing.change": {"OWNER"},
    "export": {"OWNER", "MANAGER"},
    "delete": {"OWNER", "MANAGER"},
    "account.delete": {"OWNER"},
    "business.delete": {"OWNER"},
    "ownership.transfer": {"OWNER"},
}
STEP_UP = {"billing.portal"}


def contains_privileged_scenario_action(value):
    """Conservative across nested/serialized definitions, including padded keys."""
    import json
    serialized = json.dumps(value)
    return any(key in serialized for key in ('refund_payment', 'cancel_subscription'))


def require_permission(tenant, permission):
    if not tenant or tenant.role not in PERMISSIONS.get(permission, set()):
        raise HTTPException(403, "Your business role does not permit this action")
    if not tenant.service and tenant.mfa_required and tenant.aal != "aal2":
        raise HTTPException(403, {"code": "mfa_required", "message": "Verify your authenticator to continue"})
    if not tenant.service and permission in STEP_UP and tenant.aal != "aal2":
        raise HTTPException(403, {"code": "mfa_required", "message": "Verify your authenticator to continue"})


def route_permission(path, method):
    read = method in {"GET", "HEAD"}
    if path == '/users/me/account/delete':
        return 'account.delete'
    if path.startswith('/api/workforce/members/') and path.endswith('/transfer-ownership'):
        return 'ownership.transfer'
    if path.startswith('/api/sonar/studio/'):
        return 'operations.read' if read else 'operations.manage'
    if path.startswith('/api/voice-catalog'):
        return 'operations.read' if read else 'operations.manage'
    if path.startswith('/api/sonar/nest/intercom'):
        return 'operations.read' if read else 'operations.write'
    if path.startswith('/api/sonar/dashboard/'):
        return 'operations.read' if read else 'operations.manage'
    if path.startswith('/api/sonar/drop-ins'):
        return 'operations.read' if read else 'operations.manage'
    if path in {'/api/sonar/people/read','/api/sonar/appointments/read'} and method == 'POST':
        return 'operations.read'
    if path.startswith('/api/workforce/'):
        return "security"
    if path.endswith('/forwarding/claim-number'):
        return 'billing.change'
    if '/forwarding' in path and read:
        return 'operations.read'
    if '/integrations' in path or '/forwarding' in path:
        return "integrations"
    if path == '/api/sonar/billing/portal':
        return 'billing.portal'
    if any(s in path for s in ('/billing','/payments','/invoices','/stripe','/overage',
                               'checkout','refund-payment','cancel-subscription','payment-profile',
                               'create-payment','send-payment-link','create-invoice','send-invoice',
                               'create-customer','update-customer','update-payment')):
        return "billing.read" if read else "billing.change"
    if method == 'DELETE' or path.endswith('/delete'):
        return 'business.delete' if path.startswith(('/businesses/', '/api/sonar/business/')) else 'delete'
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
    if any(s in path for s in ('send-email','call-customer')):
        return "operations.manage"
    return "administration"
