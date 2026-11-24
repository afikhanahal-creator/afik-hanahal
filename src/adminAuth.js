// The admin session, from POST /api/meta/admin-login (lib/admin-auth.js). The password is checked on the server and never
// lives in the site's code: the browser keeps only the signed session it got back (30 days), in localStorage.
const KEY = 'afik_admin_token'

export function adminToken() {
  try { return localStorage.getItem(KEY) || '' } catch { return '' }
}

// { Authorization } with the session read at the moment of the request (works with spread and as a headers object)
export const AUTH_HEADER = { get Authorization() { return `Bearer ${adminToken()}` } }

export async function adminLogin(password) {
  try {
    const r = await fetch('/api/meta/admin-login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: String(password || '') }),
    })
    if (r.status === 429) return { ok: false, error: 'too_many' }
    const j = await r.json().catch(() => ({}))
    if (!r.ok || !j.ok || !j.token) return { ok: false, error: 'wrong' }
    try { localStorage.setItem(KEY, j.token) } catch {}
    return { ok: true, setup: !!j.setup }
  } catch { return { ok: false, error: 'network' } }
}

export function adminLogout() {
  try { localStorage.removeItem(KEY) } catch {}
}
