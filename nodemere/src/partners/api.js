import { createClient } from '@supabase/supabase-js'

const authUrl = import.meta.env.VITE_PARTNER_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const authKey = import.meta.env.VITE_PARTNER_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
const apiUrl = (import.meta.env.VITE_PARTNER_API_URL || (import.meta.env.DEV ? '' : 'https://nodemere-backend.onrender.com')).replace(/\/$/, '')

export const auth = authUrl && authKey
  ? createClient(authUrl, authKey, { auth: { storageKey: 'nodemere-partner-session' } }).auth
  : null

export async function partnerApi(path, options = {}) {
  const { data } = await auth.getSession()
  if (!data.session) throw new Error('Your session has expired. Log in again.')
  return send(path, options, data.session.access_token)
}

export function partnerSignup({ fullName, email, password }) {
  return send('/signup', {
    method: 'POST',
    body: JSON.stringify({ full_name: fullName, email, password }),
  })
}

async function send(path, options, token) {
  const response = await fetch(`${apiUrl}/api/partners${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(typeof payload.detail === 'string' ? payload.detail : 'The partner portal couldn’t complete that request.')
  }
  if (response.status === 204) return null
  return response.json()
}
