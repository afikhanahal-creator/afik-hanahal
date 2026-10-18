// Google Calendar for the booking page, through the office's own Google account (OAuth), so the invitations go out from
// the office calendar and Meet links are created natively. The refresh token is kept server-side only, in app_settings
// (key 'google_calendar' — service-role only), never in code or in the browser.
//
// Env (Vercel): GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, optional GOOGLE_OAUTH_REDIRECT_URI.

import crypto from 'crypto'
import { getSetting, putSetting } from './automations.js'

const CLIENT_ID = () => process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const CLIENT_SECRET = () => process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
export const REDIRECT_URI = () => process.env.GOOGLE_OAUTH_REDIRECT_URI || 'https://www.afikhanahal.co.il/api/meta/booking-oauth-callback'
export const oauthReady = () => !!(CLIENT_ID() && CLIENT_SECRET())
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.freebusy', 'openid', 'email']
const KEY = 'google_calendar'
const API = 'https://www.googleapis.com/calendar/v3'

// ── OAuth ──────────────────────────────────────────────────────────────────────
const sign = s => crypto.createHmac('sha256', CLIENT_SECRET() || 'afik').update(s).digest('base64url').slice(0, 32)
export const makeState = (now = Date.now()) => `${now}.${sign(String(now))}`
export function stateValid(state, now = Date.now()) {
  const [t, sig] = String(state || '').split('.')
  if (!t || !sig || sig !== sign(t)) return false
  return now - Number(t) < 20 * 60e3
}
export function authUrl() {
  const q = new URLSearchParams({
    client_id: CLIENT_ID(), redirect_uri: REDIRECT_URI(), response_type: 'code', scope: SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: makeState(), login_hint: 'afik.hanahal@gmail.com',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}

async function tokenCall(params) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID(), client_secret: CLIENT_SECRET(), ...params }), signal: AbortSignal.timeout(10000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) { const e = new Error(d.error_description || d.error || `Google ${r.status}`); e.code = d.error; throw e }
  return d
}
const emailOf = idToken => { try { return JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString()).email || '' } catch { return '' } }

/** The code Google sent back → the refresh token stored, → { email } */
export async function connect(code) {
  const d = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: REDIRECT_URI() })
  const prev = (await getSetting(KEY)).value || {}
  const refresh = d.refresh_token || prev.refresh_token
  if (!refresh) throw new Error('Google לא החזיר הרשאה קבועה. נסו שוב (הסירו את הגישה בחשבון גוגל ואז חברו מחדש).')
  const email = emailOf(d.id_token) || prev.email || ''
  await putSetting(KEY, { refresh_token: refresh, email, scope: d.scope || '', connectedAt: new Date().toISOString(), error: null })
  cache = { token: d.access_token, exp: Date.now() + (d.expires_in || 3000) * 1000 - 60e3 }
  return { email }
}
export async function disconnect() {
  const s = (await getSetting(KEY)).value
  if (s?.refresh_token) fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(s.refresh_token)}`, { method: 'POST', signal: AbortSignal.timeout(5000) }).catch(() => {})
  await putSetting(KEY, null)
  cache = null
}
/** → { connected, email, connectedAt, error } — never the token */
export async function status() {
  const s = (await getSetting(KEY)).value
  return { connected: !!s?.refresh_token, email: s?.email || '', connectedAt: s?.connectedAt || null, error: s?.error || null, oauthReady: oauthReady(), redirectUri: REDIRECT_URI() }
}

let cache = null
async function accessToken() {
  if (cache && cache.exp > Date.now()) return cache.token
  const s = (await getSetting(KEY)).value
  if (!s?.refresh_token) return null
  try {
    const d = await tokenCall({ refresh_token: s.refresh_token, grant_type: 'refresh_token' })
    cache = { token: d.access_token, exp: Date.now() + (d.expires_in || 3000) * 1000 - 60e3 }
    if (s.error) putSetting(KEY, { ...s, error: null }).catch(() => {})
    return cache.token
  } catch (e) {
    // invalid_grant = the access was removed in the Google account (or the app is still in "Testing": 7-day tokens)
    if (e.code === 'invalid_grant') await putSetting(KEY, { ...s, error: 'החיבור ליומן פג. צריך לחבר מחדש.' }).catch(() => {})
    throw e
  }
}

async function gcal(path, opts = {}) {
  const token = await accessToken()
  if (!token) return null
  const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }, signal: AbortSignal.timeout(opts.timeout || 9000) })
  if (r.status === 204) return {}
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Google Calendar ${r.status}: ${d.error?.message || ''}`.trim())
  return d
}

// ── Calendar ───────────────────────────────────────────────────────────────────
/** Busy blocks in [from, to) → [{ start, end }] | null when no calendar is connected */
export async function busy(calendarId, from, to) {
  const d = await gcal('/freeBusy', { method: 'POST', body: JSON.stringify({ timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), timeZone: 'Asia/Jerusalem', items: [{ id: calendarId }] }) })
  if (!d) return null
  const cal = d.calendars?.[calendarId] || Object.values(d.calendars || {})[0] || {}
  if (cal.errors?.length) throw new Error(`freeBusy: ${cal.errors[0].reason}`)
  return cal.busy || []
}
/** Creates the event (Meet link + invitation email to the guest) → { id, htmlLink, meetLink } | null */
export async function createEvent(calendarId, event) {
  const d = await gcal(`/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`, { method: 'POST', body: JSON.stringify(event), timeout: 12000 })
  if (!d) return null
  const meet = d.hangoutLink || d.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri || ''
  return { id: d.id, htmlLink: d.htmlLink || '', meetLink: meet }
}
export async function cancelEvent(calendarId, eventId) {
  return gcal(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: 'DELETE' })
}
/** Events made by the booking page in [from, to) */
export async function bookingEvents(calendarId, from, to) {
  const q = new URLSearchParams({ timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250', privateExtendedProperty: 'afikBooking=1' })
  const d = await gcal(`/calendars/${encodeURIComponent(calendarId)}/events?${q}`)
  return d ? d.items || [] : null
}
