/**
 * SONAR API Client — Connects to local backend controller
 * Handles REST fetches and WebSocket subscriptions
 */

const API_BASE = window.sonar?.apiUrl || import.meta.env.VITE_API_URL || '';
const WS_URL = window.sonar?.wsUrl || import.meta.env.VITE_WS_URL || null;

let authSessionRequest = null;

// All initial dashboard requests start together. Supabase already keeps the
// session in memory, but calling getSession once per request still creates a
// burst of redundant auth work. Share the in-flight lookup across callers.
async function getAuthSession() {
  if (!authSessionRequest) {
    authSessionRequest = import('./supabase')
      .then(({ supabase }) => supabase.auth.getSession())
      .finally(() => { authSessionRequest = null; });
  }
  return authSessionRequest;
}

async function buildAuthHeaders(extraHeaders = {}) {
  const { data } = await getAuthSession();
  const token = data?.session?.access_token;
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function reportApiError(detail, statusCode) {
  const value = detail?.detail || detail;
  if (statusCode === 402 && value && typeof value === 'object') {
    window.dispatchEvent(new CustomEvent('nodemere:plan-limit', { detail: value }));
  }
  const message = typeof value === 'string' ? value : value?.message || `Request failed (HTTP ${statusCode})`;
  const error = new Error(message);
  error.status = statusCode;
  error.detail = value;
  return error;
}

async function parseApiError(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Fall back to the HTTP status when the backend returned no JSON body.
  }
  return reportApiError(body, response.status);
}

// ─── REST Helpers ───────────────────────────────────────────
async function fetchJSON(endpoint) {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE}${endpoint}`, { headers });
    if (!res.ok) throw await parseApiError(res);
    return await res.json();
  } catch (err) {
    console.error(`[SONARAPI] Fetch failed: ${endpoint}`, err.message);
    return null;
  }
}

export const api = {
  getAgents: (options = {}) => fetchJSON(`/api/agents${options.includeArchived ? '?include_archived=true' : ''}`),
  getSystemSummary: () => fetchJSON('/api/system/summary'),
  getLivePulse: (limit = 30) => fetchJSON(`/api/events/live-pulse?limit=${limit}`),
  getLogs: (limit = 50) => fetchJSON(`/api/logs?limit=${limit}`),
  getControlState: () => fetchJSON('/api/control-state'),
  getSession: () => fetchJSON('/api/session'),
  getPipeline: () => fetchJSON('/api/pipeline'),
  getReceptionistCatalog: () => fetchJSON('/api/sonar/receptionists/catalog'),
  getPeople: (limit = 500) => fetchJSON(`/api/sonar/people?limit=${limit}`),
  createAppointment: (appointment) => postJSON('/api/sonar/appointments', appointment),
  updateAppointment: (id, appointment) => putJSON(`/api/sonar/appointments/${encodeURIComponent(id)}`, appointment),
  deleteAppointment: (id) => deleteJSON(`/api/sonar/appointments/${encodeURIComponent(id)}`),
  getPeopleDocuments: () => fetchJSON('/api/sonar/people/documents'),
  getPersonDocumentUrl: (personId, documentId) => fetchJSON(`/api/sonar/people/${encodeURIComponent(personId)}/documents/${encodeURIComponent(documentId)}/url`),
  renamePersonDocument: (personId, documentId, fileName) => putJSON(`/api/sonar/people/${encodeURIComponent(personId)}/documents/${encodeURIComponent(documentId)}`, { file_name: fileName }),
  deletePersonDocument: (personId, documentId) => deleteJSON(`/api/sonar/people/${encodeURIComponent(personId)}/documents/${encodeURIComponent(documentId)}`),
  createPerson: (person) => postJSON('/api/sonar/people', person),
  updatePerson: (id, person) => putJSON(`/api/sonar/people/${encodeURIComponent(id)}`, person),
  deletePerson: (id) => deleteJSON(`/api/sonar/people/${encodeURIComponent(id)}`),
  getScenarios: () => fetchJSON('/api/sonar/scenarios'),
  createScenario: (scenario) => postJSON('/api/sonar/scenarios', scenario),
  updateScenario: (id, scenario) => putJSON(`/api/sonar/scenarios/${encodeURIComponent(id)}`, scenario),
  deleteScenario: (id) => deleteJSON(`/api/sonar/scenarios/${encodeURIComponent(id)}`),
  createBillingPortal: () => postJSON('/api/sonar/billing/portal', {}),
  getBillingUsage: () => fetchJSON('/api/sonar/billing/usage'),
  submitBugReport: (report) => postJSON('/api/sonar/bugs', report),
  createPrivacyRequest: (request) => postJSON('/users/me/privacy-requests', request),
  closeAccount: () => postJSON('/users/me/account/close', {}),
  getCronJobs: () => fetchJSON('/api/cron'),
  createCronJob: (job) => postJSON('/api/cron', job),
  deleteCronJob: (id) => deleteJSON(`/api/cron/${id}`),
  getReactions: () => fetchJSON('/api/reactions'),
  addReaction: (data) => postJSON('/api/reactions', data),
  getOpenRouterModels: () => fetchJSON('/api/openrouter/models'),
  getBusinessIntelligence: () => fetchJSON('/api/sonar/business-intelligence'),
  getNestHistory: (limit = 40) => fetchJSON(`/api/sonar/nest/history?limit=${limit}`),
  claimNestMilestone: (milestoneKey, details = {}) => postJSON('/api/sonar/nest/claim', {
    milestone_key: milestoneKey,
    ...details,
  }),
  getProjectIntelligence: () => fetchJSON('/api/sonar/project-intelligence'),
  getPublicProjectIntelligence: () => fetchJSON('/api/public/project-intelligence'),
  reanalyzeProjectIntelligence: () => postJSON('/api/sonar/project-intelligence/reanalyze', {}),
  refreshMarketResearch: () => postJSON('/api/sonar/project-intelligence/market/refresh', {}),
  updateAgentModel: (agentId, model) => postJSON(`/api/agents/${agentId}/model`, { model }),
  patchAgent: (agentId, data) => patchJSON(`/api/agents/${agentId}`, data),
  deleteAgent: (agentId) => deleteJSON(`/api/agents/${agentId}`),
  restoreAgent: (agentId) => postJSON(`/api/agents/${agentId}/restore`, {}),
  getPendingRestarts: () => fetchJSON('/api/pending-restarts'),
  clearPendingRestart: (id) => deleteJSON(`/api/pending-restarts/${id}`),
  hireReceptionist: (receptionist) => {
    if (receptionist && typeof receptionist === 'object') {
      return postJSON('/api/sonar/receptionists/hire', {
        catalog_id: receptionist.id,
        source: receptionist.source,
        custom_voice_id: receptionist.custom_voice_id,
      });
    }
    return postJSON('/api/sonar/receptionists/hire', { catalog_id: receptionist });
  },

  // Control commands via REST (fallback when IPC unavailable)
  setRuntime: (mode) => postJSON('/api/control/runtime', { mode }),
  setStage: (stage) => postJSON('/api/control/stage', { stage }),
  pingMax: () => postJSON('/api/control/ping-max', {}),
};

async function postJSON(endpoint, body) {
  try {
    const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await parseApiError(res);
    return await res.json();
  } catch (err) {
    console.error(`[SONARAPI] POST failed: ${endpoint}`, err.message);
    throw err;
  }
}

async function putJSON(endpoint, body) {
  try {
    const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await parseApiError(res);
    return await res.json();
  } catch (err) {
    console.error(`[SONARAPI] PUT failed: ${endpoint}`, err.message);
    throw err;
  }
}

async function patchJSON(endpoint, body) {
  try {
    const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' });
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await parseApiError(res);
    return await res.json();
  } catch (err) {
    console.error(`[SONARAPI] PATCH failed: ${endpoint}`, err.message);
    throw err;
  }
}

async function deleteJSON(endpoint) {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw await parseApiError(res);
    return await res.json();
  } catch (err) {
    console.error(`[SONARAPI] DELETE failed: ${endpoint}`, err.message);
    throw err;
  }
}

// ─── WebSocket Client ───────────────────────────────────────
let ws = null;
let reconnectTimer = null;
const listeners = new Set();
const eventListeners = new Map(); // event_type → Set of callbacks

export function connectWebSocket(onStateChange) {
  if (!WS_URL) {
    if (onStateChange) onStateChange('disconnected');
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) return;

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[SONAR] WebSocket connected');
    if (onStateChange) onStateChange('connected');
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      // Notify all listeners
      for (const listener of listeners) {
        listener(data);
      }

      // Notify event-type specific listeners
      if (data.event_type && eventListeners.has(data.event_type)) {
        for (const cb of eventListeners.get(data.event_type)) {
          cb(data);
        }
      }
    } catch (err) {
      console.error('[SONAR] WS parse error:', err.message);
    }
  };

  ws.onclose = () => {
    console.log('[SONAR] WebSocket disconnected');
    if (onStateChange) onStateChange('disconnected');
    // Auto-reconnect after 3s
    reconnectTimer = setTimeout(() => connectWebSocket(onStateChange), 3000);
  };

  ws.onerror = (err) => {
    console.error('[SONAR] WebSocket error:', err.message);
  };
}

export function addMessageListener(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function addEventListener(eventType, callback) {
  if (!eventListeners.has(eventType)) {
    eventListeners.set(eventType, new Set());
  }
  eventListeners.get(eventType).add(callback);
  return () => {
    const set = eventListeners.get(eventType);
    if (set) set.delete(callback);
  };
}

export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}
