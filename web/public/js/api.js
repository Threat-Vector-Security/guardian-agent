/**
 * API client for GuardianAgent dashboard.
 *
 * Wraps fetch with Bearer token from sessionStorage.
 */

const TOKEN_KEY = 'guardianagent_token';

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function hasToken() {
  return !!sessionStorage.getItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    throw new Error('AUTH_FAILED');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  status:       () => request('/api/status'),
  agents:       () => request('/api/agents'),
  agentDetail:  (id) => request(`/api/agents/${encodeURIComponent(id)}`),
  audit:        (params = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const q = qs.toString();
    return request(`/api/audit${q ? '?' + q : ''}`);
  },
  auditSummary: (windowMs = 300000) => request(`/api/audit/summary?windowMs=${windowMs}`),
  config:       () => request('/api/config'),
  budget:       () => request('/api/budget'),
  watchdog:     () => request('/api/watchdog'),
  providers:    () => request('/api/providers'),
  providersStatus: () => request('/api/providers/status'),
  updateConfig: (updates) => request('/api/config', {
    method: 'POST',
    body: JSON.stringify(updates),
  }),
  sendMessage:  (content, agentId, userId) => request('/api/message', {
    method: 'POST',
    body: JSON.stringify({ content, agentId, userId }),
  }),
};
