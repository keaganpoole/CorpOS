/**
 * SONAR API Client — Connects to local backend controller
 * Handles REST fetches and WebSocket subscriptions
 */

const API_BASE = window.sonar?.apiUrl || 'http://127.0.0.1:7878';
const WS_URL = window.sonar?.wsUrl || 'ws://127.0.0.1:7878';

// ─── REST Helpers ───────────────────────────────────────────
async function fetchJSON(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
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
  updateAgentCallTypes: (agentId, callTypes) => postJSON(`/api/agents/${agentId}/call-types`, { call_types: callTypes }),
  patchAgent: (agentId, data) => patchJSON(`/api/agents/${agentId}`, data),
  getPendingRestarts: () => fetchJSON('/api/pending-restarts'),
  clearPendingRestart: (id) => del(`/api/pending-restarts/${id}`),

  // Control commands via REST (fallback when IPC unavailable)
  setRuntime: (mode) => postJSON('/api/control/runtime', { mode }),
  setStage: (stage) => postJSON('/api/control/stage', { stage }),
  setZone: (zone) => postJSON('/api/control/zone', { zone }),
  pingMax: () => postJSON('/api/control/ping-max', {}),
};

async function postJSON(endpoint, body) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
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
