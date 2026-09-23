// Google Analytics 4 — direct Data API access (no third-party connector).
//
// Auth: a Google Cloud service account with the "Viewer" role on the GA4 property.
// Credentials come only from Vercel env vars — never from code:
//   GA4_SERVICE_ACCOUNT_JSON  the downloaded key file (raw JSON or base64 of it), or
//   GA4_CLIENT_EMAIL + GA4_PRIVATE_KEY
//   GA4_PROPERTY_ID           numeric property id (defaults to the site's property)
import crypto from 'node:crypto'

const DEFAULT_PROPERTY = '536943897'          // "הנגר 24 הוד השרון" (G-X1S3XX7TRV)
const API = 'https://analyticsdata.googleapis.com/v1beta'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

export function ga4Credentials(env = process.env) {
  let email = env.GA4_CLIENT_EMAIL || '', key = env.GA4_PRIVATE_KEY || ''
  const raw = (env.GA4_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim()
  let jsonError = ''
  if (raw) {
    try {
      const txt = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
      const j = JSON.parse(txt)
      email = j.client_email || email
      key = j.private_key || key
    } catch { jsonError = 'GA4_SERVICE_ACCOUNT_JSON is not valid JSON' }
  }
  key = key.replace(/\\n/g, '\n')
  const property = String(env.GA4_PROPERTY_ID || DEFAULT_PROPERTY).replace(/^properties\//, '').trim()
  const missing = []
  if (!email) missing.push('GA4_SERVICE_ACCOUNT_JSON')
  else if (!key) missing.push('GA4_PRIVATE_KEY')
  return { email, key, property, missing, jsonError, configured: !!(email && key && !jsonError) }
}

// ── OAuth (JWT bearer grant, RS256) ────────────────────────────────────────────
const b64url = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
let tokenCache = { token: '', exp: 0, email: '' }

export function signJwt(email, key, now = Math.floor(Date.now() / 1000)) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify({ iss: email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }))
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(key)
  return `${head}.${body}.${b64url(sig)}`
}

async function accessToken(cred, fetchImpl) {
  if (tokenCache.token && tokenCache.email === cred.email && Date.now() < tokenCache.exp - 60000) return tokenCache.token
  const r = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signJwt(cred.email, cred.key) }),
    signal: AbortSignal.timeout(10000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.access_token) throw gaError(`Google auth ${r.status}: ${d.error_description || d.error || 'no token'}`, 'auth')
  tokenCache = { token: d.access_token, exp: Date.now() + (Number(d.expires_in) || 3600) * 1000, email: cred.email }
  return d.access_token
}

function gaError(message, kind) { const e = new Error(message); e.kind = kind; return e }

async function gaPost(cred, method, body, fetchImpl) {
  const token = await accessToken(cred, fetchImpl)
  const r = await fetchImpl(`${API}/properties/${cred.property}:${method}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = d?.error?.message || `HTTP ${r.status}`
    const kind = r.status === 403 ? 'permission' : r.status === 404 ? 'property' : r.status === 400 ? 'request' : 'api'
    throw gaError(`GA4 ${method} ${r.status}: ${msg}`, kind)
  }
  return d
}

// ── Report definitions ─────────────────────────────────────────────────────────
const ymd = d => d.toISOString().slice(0, 10)
export function ranges(days, now = new Date()) {
  const end = new Date(now)                                                      // includes today (GA4 standard)
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - (days - 1))
  const pEnd = new Date(start); pEnd.setUTCDate(pEnd.getUTCDate() - 1)
  const pStart = new Date(pEnd); pStart.setUTCDate(pStart.getUTCDate() - (days - 1))
  return { cur: { startDate: ymd(start), endDate: 'today', name: 'cur' }, prev: { startDate: ymd(pStart), endDate: ymd(pEnd), name: 'prev' } }
}

const M = (...names) => names.map(name => ({ name }))
const D = (...names) => names.map(name => ({ name }))
const byMetric = (name, limit) => ({ orderBys: [{ metric: { metricName: name }, desc: true }], limit })

function buildRequests(days, keyMetric) {
  const { cur, prev } = ranges(days)
  const one = [cur], two = [cur, prev]
  return [
    [
      { dateRanges: two, metrics: M('totalUsers', 'newUsers', 'sessions', 'screenPageViews', 'engagementRate', 'averageSessionDuration', 'userEngagementDuration', keyMetric, 'eventCount', 'bounceRate', 'engagedSessions') },
      { dateRanges: two, dimensions: D('date'), metrics: M('totalUsers', 'sessions', 'screenPageViews', keyMetric), orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 },
      { dateRanges: one, dimensions: D('sessionDefaultChannelGroup'), metrics: M('sessions', 'totalUsers', 'engagementRate', keyMetric), ...byMetric('sessions', 12) },
      { dateRanges: one, dimensions: D('sessionSourceMedium'), metrics: M('sessions', 'totalUsers', 'engagementRate', keyMetric), ...byMetric('sessions', 15) },
      { dateRanges: one, dimensions: D('pagePath', 'pageTitle'), metrics: M('screenPageViews', 'totalUsers', 'userEngagementDuration', keyMetric), ...byMetric('screenPageViews', 25) },
    ],
    [
      { dateRanges: one, dimensions: D('landingPage'), metrics: M('sessions', 'totalUsers', 'engagementRate', keyMetric), ...byMetric('sessions', 15) },
      { dateRanges: one, dimensions: D('deviceCategory'), metrics: M('sessions', 'totalUsers', 'engagementRate', 'screenPageViews', 'averageSessionDuration', 'bounceRate', 'newUsers'), ...byMetric('sessions', 5) },
      { dateRanges: one, dimensions: D('city'), metrics: M('totalUsers', 'sessions'), ...byMetric('totalUsers', 15) },
      { dateRanges: one, dimensions: D('eventName'), metrics: M('eventCount', 'totalUsers', keyMetric), ...byMetric('eventCount', 30) },
      { dateRanges: one, dimensions: D('dayOfWeek', 'hour'), metrics: M('sessions'), limit: 200 },
    ],
    [
      { dateRanges: one, dimensions: D('newVsReturning'), metrics: M('totalUsers', 'sessions', 'engagementRate') },
      { dateRanges: one, dimensions: D('sessionCampaignName'), metrics: M('sessions', 'totalUsers', keyMetric), ...byMetric('sessions', 12) },
      { dateRanges: one, dimensions: D('country'), metrics: M('totalUsers', 'sessions'), ...byMetric('totalUsers', 10) },
    ],
  ]
}

// Turn a GA4 report into plain objects: { <dim>: 'x', <metric>: 12, range?: 'cur'|'prev' }
export function tidy(report) {
  if (!report) return []
  const dims = (report.dimensionHeaders || []).map(h => h.name)
  const mets = (report.metricHeaders || []).map(h => h.name)
  return (report.rows || []).map(row => {
    const o = {}
    dims.forEach((d, i) => { const v = row.dimensionValues?.[i]?.value ?? ''; if (d === 'dateRange') o.range = v; else o[d] = v })
    mets.forEach((m, i) => { o[m === 'conversions' ? 'keyEvents' : m] = Number(row.metricValues?.[i]?.value) || 0 })
    return o
  })
}

// ── Public API ─────────────────────────────────────────────────────────────────
const cache = new Map()   // `${property}:${days}` → { at, data }
const TTL = 5 * 60 * 1000

export async function report({ days = 28, fresh = false, fetchImpl = fetch, env = process.env } = {}) {
  const cred = ga4Credentials(env)
  if (!cred.configured) return { configured: false, missing: cred.missing, error: cred.jsonError || '', property: cred.property }
  days = [7, 14, 28, 30, 90, 180, 365].includes(Number(days)) ? Number(days) : 28
  const ck = `${cred.property}:${days}`
  const hit = cache.get(ck)
  if (!fresh && hit && Date.now() - hit.at < TTL) return { ...hit.data, cached: true }

  // "keyEvents" is the current name; older properties / API versions only know "conversions"
  let keyMetric = 'keyEvents', batches
  try {
    batches = await Promise.all(buildRequests(days, keyMetric).map(requests => gaPost(cred, 'batchRunReports', { requests }, fetchImpl)))
  } catch (e) {
    if (e.kind !== 'request' || !/keyEvents/i.test(e.message)) throw e
    keyMetric = 'conversions'
    batches = await Promise.all(buildRequests(days, keyMetric).map(requests => gaPost(cred, 'batchRunReports', { requests }, fetchImpl)))
  }
  const [a, b, c] = batches.map(x => x.reports || [])
  const totals = tidy(a[0])
  const data = {
    configured: true, property: cred.property, days, range: ranges(days).cur, generatedAt: new Date().toISOString(),
    totals: { cur: totals.find(r => r.range === 'date_range_0' || r.range === 'cur') || totals[0] || {}, prev: totals.find(r => r.range === 'date_range_1' || r.range === 'prev') || {} },
    trend: tidy(a[1]), channels: tidy(a[2]), sources: tidy(a[3]), pages: tidy(a[4]),
    landing: tidy(b[0]), devices: tidy(b[1]), cities: tidy(b[2]), events: tidy(b[3]), heat: tidy(b[4]),
    audience: tidy(c[0]), campaigns: tidy(c[1]), countries: tidy(c[2]),
  }
  cache.set(ck, { at: Date.now(), data })
  return data
}

const rtCache = { at: 0, data: null }
export async function realtime({ fetchImpl = fetch, env = process.env } = {}) {
  const cred = ga4Credentials(env)
  if (!cred.configured) return { configured: false, missing: cred.missing }
  if (rtCache.data && Date.now() - rtCache.at < 45000) return rtCache.data
  const q = dims => ({ dimensions: D(...dims), metrics: M('activeUsers'), metricAggregations: ['TOTAL'], ...byMetric('activeUsers', 8) })
  const [pages, devices, cities] = await Promise.all([
    gaPost(cred, 'runRealtimeReport', q(['unifiedScreenName']), fetchImpl),
    gaPost(cred, 'runRealtimeReport', q(['deviceCategory']), fetchImpl),
    gaPost(cred, 'runRealtimeReport', q(['city']), fetchImpl),
  ])
  const total = Number(pages.totals?.[0]?.metricValues?.[0]?.value ?? devices.totals?.[0]?.metricValues?.[0]?.value) || 0
  const data = { configured: true, activeUsers: total, pages: tidy(pages), devices: tidy(devices), cities: tidy(cities), at: new Date().toISOString() }
  Object.assign(rtCache, { at: Date.now(), data })
  return data
}
