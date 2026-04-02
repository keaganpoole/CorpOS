/**
 * Skybox API Client — Connects to local backend controller
 * Handles REST fetches and WebSocket subscriptions
 */

const API_BASE = window.skybox?.apiUrl || 'http://127.0.0.1:7878';
const WS_URL = window.skybox?.wsUrl || 'ws://127.0.0.1:7878';

// ─── REST Helpers ───────────────────────────────────────────
async function fetchJSON(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[SkyboxAPI] Fetch failed: ${endpoint}`, err.message);
    return null;
  }
}

export const api = {
  getTasks: () => fetchJSON('/api/tasks'),
  getTask: (id) => fetchJSON(`/api/tasks/${id}`),
  getAgents: () => fetchJSON('/api/agents'),
  getSystemSummary: () => fetchJSON('/api/system/summary'),
  getLivePulse: (limit = 30) => fetchJSON(`/api/events/live-pulse?limit=${limit}`),
  getLogs: (limit = 50) => fetchJSON(`/api/logs?limit=${limit}`),
  getControlState: () => fetchJSON('/api/control-state'),
  getSession: () => fetchJSON('/api/session'),
  getPipeline: () => fetchJSON('/api/pipeline'),

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
    console.error(`[SkyboxAPI] POST failed: ${endpoint}`, err.message);
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
    console.log('[Skybox] WebSocket connected');
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
      console.error('[Skybox] WS parse error:', err.message);
    }
  };

  ws.onclose = () => {
    console.log('[Skybox] WebSocket disconnected');
    if (onStateChange) onStateChange('disconnected');
    // Auto-reconnect after 3s
    reconnectTimer = setTimeout(() => connectWebSocket(onStateChange), 3000);
  };

  ws.onerror = (err) => {
    console.error('[Skybox] WebSocket error:', err.message);
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
