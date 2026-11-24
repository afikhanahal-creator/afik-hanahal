// Admin access, checked on the server (2026-11-24).
//
// Until now the admin password was written in the site's own code: in the login screen and in about thirty admin files,
// so it reached every visitor's browser, and every API compared the Bearer header with that same word. Now:
//   • The browser holds no password. The login screen sends what the person typed to POST /api/meta/admin-login, and gets
//     back a signed session (30 days), which every admin request sends as its Bearer.
//   • Every API accepts: a valid session; ADMIN_TOKEN from Vercel (server to server, the Render backend); and the
//     internal token the site's own cron uses (internalToken()).
//   • ADMIN_PASSWORD in Vercel is the password people type. While it is NOT set ("setup mode") the old password still
//     works, so nothing breaks on the day of the deploy. Once it is set, the old password is refused everywhere.
// Signing key: ADMIN_SESSION_SECRET, else the Supabase service key (a server secret that is always set).
// Tested in lib/admin-auth.test.mjs.
import crypto from 'crypto'

// sha256 of the old password. Not the word itself: it stays out of the code. Accepted only in setup mode.
const LEGACY_SHA256 = '2e9fadb158e5666d49fb80f13d7eaf86d3cc82b17c9896dea79ec1fc5b66f983'
const SESSION_DAYS = 30

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex')
const eq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}
const secret = () => String(process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_KEY || '').trim()
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const sign = (payload) => b64u(crypto.createHmac('sha256', secret()).update(payload).digest())

export const setupMode = () => !String(process.env.ADMIN_PASSWORD || '').trim()
export const isLegacy = (s) => !!s && eq(sha256(s), LEGACY_SHA256)

/* the password a person typed → true when it may log in */
export function passwordOk(pw) {
  const p = String(pw || '')
  if (!p) return false
  const want = String(process.env.ADMIN_PASSWORD || '').trim()
  if (want) return eq(p, want)
  return isLegacy(p)
}

/* a signed session: "s1.<sub>.<exp>.<sig>" */
export function makeSession(sub = 'admin', days = SESSION_DAYS) {
  if (!secret()) return ''
  const exp = Math.floor(Date.now() / 1000) + days * 86400
  const body = `s1.${String(sub).replace(/[^\w-]/g, '').slice(0, 32) || 'admin'}.${exp}`
  return `${body}.${sign(body)}`
}
export function sessionOk(tok) {
  const t = String(tok || '')
  const m = /^(s1\.[\w-]{1,32}\.(\d{10}))\.([\w-]{20,})$/.exec(t)
  if (!m || !secret()) return false
  if (+m[2] < Date.now() / 1000) return false
  return eq(sign(m[1]), m[3])
}

/* the token the site's own cron sends to its own APIs (no expiry, never leaves the server) */
export function internalToken() {
  if (!secret()) return ''
  const body = 's1.server.9999999999'
  return `${body}.${sign(body)}`
}

/* any credential an admin API accepts */
export function adminKeyOk(key) {
  const k = String(key || '').trim()
  if (!k) return false
  if (sessionOk(k)) return true
  const envTok = String(process.env.ADMIN_TOKEN || '').trim()
  if (envTok && eq(k, envTok) && (setupMode() || !isLegacy(envTok))) return true
  return setupMode() && isLegacy(k)
}
export const bearerOf = (req) => String(req?.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim()
export const isAdminReq = (req) => adminKeyOk(bearerOf(req))

/* the Bearer this server sends to the old Render backend, which still checks its own copy of the token */
export const renderToken = () => String(process.env.RENDER_ADMIN_TOKEN || process.env.ADMIN_TOKEN || '').trim()
