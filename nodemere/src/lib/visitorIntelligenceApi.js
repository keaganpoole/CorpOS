import { supabase } from '../supabaseClient';

const API_BASE = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : window.sonar?.apiUrl || '')).replace(/\/$/, '');

function queryString(values) {
  const params = new URLSearchParams();
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  const suffix = params.toString();
  return suffix ? `?${suffix}` : '';
}

async function request(path, values) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw Object.assign(new Error('Sign in to open Visitor Intelligence.'), { status: 401 });
  const response = await fetch(`${API_BASE}${path}${queryString(values)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    let detail;
    try { detail = (await response.json())?.detail; } catch { detail = null; }
    const code = detail?.code;
    const message = response.status === 403
      ? 'This account is not authorized for the internal Visitor Intelligence command center.'
      : code === 'visitor_intelligence_unavailable'
        ? 'Visitor Intelligence is not ready. Apply the Phase 2 and Phase 3 database migrations, then retry.'
        : `Visitor Intelligence request failed (HTTP ${response.status}).`;
    throw Object.assign(new Error(message), { status: response.status, code });
  }
  return response.json();
}

export const visitorIntelligenceApi = {
  access: () => request('/api/visitor-intelligence/access'),
  commandCenter: (filters) => request('/api/visitor-intelligence/command-center', filters),
  visitors: (filters) => request('/api/visitor-intelligence/visitors', filters),
  profile: (visitorId) => request(`/api/visitor-intelligence/visitors/${encodeURIComponent(visitorId)}`),
  activity: (since, limit = 30) => request('/api/visitor-intelligence/activity', { since, limit }),
};
