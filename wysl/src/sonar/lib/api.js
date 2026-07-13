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

// ─── REST Helpers ───────────────────────────────────────────
async function fetchJSON(endpoint) {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE}${endpoint}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[SONARAPI] Fetch failed: ${endpoint}`, err.message);
    return null;
  }
}

export const api = {
  getAgents: () => fetchJSON('/api/agents'),
  getSystemSummary: () => fetchJSON('/api/system/summary'),
  getLivePulse: (limit = 30) => fetchJSON(`/api/events/live-pulse?limit=${limit}`),
  getLogs: (limit = 50) => fetchJSON(`/api/logs?limit=${limit}`),
  getControlState: () => fetchJSON('/api/control-state'),
  getSession: () => fetchJSON('/api/session'),
  getPipeline: () => fetchJSON('/api/pipeline'),
  getCronJobs: () => fetchJSON('/api/cron'),
  createCronJob: (job) => postJSON('/api/cron', job),
  deleteCronJob: (id) => deleteJSON(`/api/cron/${id}`),
  getReactions: () => fetchJSON('/api/reactions'),
  addReaction: (data) => postJSON('/api/reactions', data),
  getOpenRouterModels: () => fetchJSON('/api/openrouter/models'),
  updateAgentModel: (agentId, model) => postJSON(`/api/agents/${agentId}/model`, { model }),
  patchAgent: (agentId, data) => patchJSON(`/api/agents/${agentId}`, data),
  deleteAgent: (agentId) => deleteJSON(`/api/agents/${agentId}`),
  getPendingRestarts: () => fetchJSON('/api/pending-restarts'),
  clearPendingRestart: (id) => deleteJSON(`/api/pending-restarts/${id}`),
  hireReceptionist: (catalogId) => postJSON('/api/sonar/receptionists/hire', { catalog_id: catalogId }),

  // Control commands via REST (fallback when IPC unavailable)
  setRuntime: (mode) => postJSON('/api/control/runtime', { mode }),
  setStage: (stage) => postJSON('/api/control/stage', { stage }),
  setZone: (zone) => postJSON('/api/control/zone', { zone }),
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[SONARAPI] POST failed: ${endpoint}`, err.message);
    return null;
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[SONARAPI] PATCH failed: ${endpoint}`, err.message);
    return null;
  }
}

async function deleteJSON(endpoint) {
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[SONARAPI] DELETE failed: ${endpoint}`, err.message);
    return null;
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
