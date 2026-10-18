// Google Analytics 4 — direct Data API access (no third-party connector).
//
// Auth: a Google Cloud service account with the "Viewer" role on the GA4 property.
// Credentials come only from Vercel env vars — never from code:
//   GA4_SERVICE_ACCOUNT_JSON  the downloaded key file (raw JSON or base64 of it), or
//   GA4_CLIENT_EMAIL + GA4_PRIVATE_KEY, or the Korkos site's names GA_SA_CLIENT_EMAIL + GA_SA_PRIVATE_KEY
//   (the same service account can read both properties once it is a Viewer on each)
//   GA4_PROPERTY_ID           numeric property id (else app_settings 'ga4_property_id', else the site's property)
import crypto from 'node:crypto'

const DEFAULT_PROPERTY = '536943897'          // "הנגר 24 הוד השרון" (G-X1S3XX7TRV)
const API = 'https://analyticsdata.googleapis.com/v1beta'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

// A private key pasted into Vercel in any of the usual broken ways: wrapped in quotes, with literal \n, or on one line
export function normalizePrivateKey(raw) {
  let key = String(raw || '').trim()
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1)
  key = key.replace(/\\n/g, '\n').replace(/\r/g, '').trim()
  if (key && !key.includes('\n')) {
    const m = key.match(/-----BEGIN PRIVATE KEY-----(.+?)-----END PRIVATE KEY-----/)
    if (m) key = `-----BEGIN PRIVATE KEY-----\n${m[1].replace(/\s+/g, '').replace(/(.{64})/g, '$1\n').trim()}\n-----END PRIVATE KEY-----\n`
  }
  return key
}

export function ga4Credentials(env = process.env, propertyOverride = '') {
  let email = (env.GA4_CLIENT_EMAIL || env.GA_SA_CLIENT_EMAIL || '').trim(), key = env.GA4_PRIVATE_KEY || env.GA_SA_PRIVATE_KEY || ''
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
  key = normalizePrivateKey(key)
  const property = String(env.GA4_PROPERTY_ID || propertyOverride || DEFAULT_PROPERTY).replace(/\D/g, '')
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

// ── The analytics dashboard (admin "אנליטיקס"), the same reports as the Korkos site ──────────────────────
// What counts as a contact is decided here, not by GA4's "key event" switches (keyEvents counts only what someone
// marked in the property, so it read 0 next to real form sends). The site sends these itself on a real action:
// contact_form (the SPA modal and every content-page form), phone_click, whatsapp_click, email_click.
export const CONVERSION_EVENTS = ['contact_form', 'phone_click', 'whatsapp_click', 'email_click']
export const USEFUL_EVENTS = [
  ...CONVERSION_EVENTS, 'generate_lead', 'lead_form_step', 'form_start', 'cta_click',
  'property_view', 'share_property', 'favorite_add', 'tool_use',
]
const CONV_FILTER = { filter: { fieldName: 'eventName', inListFilter: { values: CONVERSION_EVENTS } } }
const isoDay = d => d.toISOString().slice(0, 10)

// Pure: the period of the same length right before [start, end] (YYYY-MM-DD)
export function previousRange(start, end) {
  const s = new Date(start + 'T00:00:00Z'), e = new Date(end + 'T00:00:00Z')
  const days = Math.round((e - s) / 864e5) + 1
  const ps = new Date(s); ps.setUTCDate(ps.getUTCDate() - days)
  const pe = new Date(s); pe.setUTCDate(pe.getUTCDate() - 1)
  return { start: isoDay(ps), end: isoDay(pe) }
}
// the last 3 days of the range: the title a page has now, not an old one
function recentStart(range) {
  const e = new Date(range.end + 'T00:00:00Z'); e.setUTCDate(e.getUTCDate() - 2)
  const r = isoDay(e)
  return r < range.start ? range.start : r
}

// Pure: every report of the dashboard, by name (batchRunReports takes 5 at a time)
export function dashSpecs(range, prev) {
  const cur = [{ startDate: range.start, endDate: range.end }], prv = [{ startDate: prev.start, endDate: prev.end }]
  const byDate = { orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 }
  // a contact report: [0] actions, [1] people who contacted, [2] sessions with a contact (the filter applies first)
  const conv = (dims, extra = {}) => ({ dateRanges: cur, ...(dims.length ? { dimensions: D(...dims) } : {}), metrics: M('eventCount', 'totalUsers', 'sessions'), dimensionFilter: CONV_FILTER, ...extra })
  const TOTALS = M('totalUsers', 'newUsers', 'sessions', 'engagedSessions', 'screenPageViews', 'engagementRate', 'bounceRate', 'eventCount', 'keyEvents', 'averageSessionDuration')
  return {
    conv: conv(['eventName'], byMetric('eventCount', 10)),
    convPrev: { ...conv(['eventName'], { limit: 10 }), dateRanges: prv },
    convTotals: conv([]),
    convTotalsPrev: { ...conv([]), dateRanges: prv },
    convTimeseries: conv(['date'], byDate),
    convTimeseriesPrev: { ...conv(['date'], byDate), dateRanges: prv },
    convChannels: conv(['sessionDefaultChannelGroup'], { limit: 12 }),
    convSources: conv(['sessionSource', 'sessionMedium'], { limit: 40 }),
    convCampaigns: conv(['sessionCampaignName'], { limit: 40 }),
    convLanding: conv(['landingPage'], { limit: 60 }),
    convPages: conv(['pagePath'], { limit: 60 }),
    convDevices: conv(['deviceCategory'], { limit: 5 }),
    convCountries: conv(['country'], { limit: 20 }),
    totals: { dateRanges: cur, metrics: TOTALS },
    totalsPrev: { dateRanges: prv, metrics: TOTALS },
    timeseries: { dateRanges: cur, dimensions: D('date'), metrics: M('totalUsers', 'sessions', 'screenPageViews', 'keyEvents'), ...byDate },
    timeseriesPrev: { dateRanges: prv, dimensions: D('date'), metrics: M('totalUsers', 'sessions', 'screenPageViews', 'keyEvents'), ...byDate },
    channels: { dateRanges: cur, dimensions: D('sessionDefaultChannelGroup'), metrics: M('totalUsers', 'newUsers', 'sessions', 'engagementRate', 'keyEvents'), ...byMetric('sessions', 12) },
    channelsPrev: { dateRanges: prv, dimensions: D('sessionDefaultChannelGroup'), metrics: M('totalUsers', 'newUsers', 'sessions', 'engagementRate', 'keyEvents'), ...byMetric('sessions', 12) },
    sources: { dateRanges: cur, dimensions: D('sessionSource', 'sessionMedium'), metrics: M('totalUsers', 'sessions', 'engagementRate', 'keyEvents'), ...byMetric('sessions', 25) },
    campaigns: { dateRanges: cur, dimensions: D('sessionCampaignName'), metrics: M('totalUsers', 'sessions', 'engagementRate', 'keyEvents'), ...byMetric('sessions', 20) },
    landing: { dateRanges: cur, dimensions: D('landingPage'), metrics: M('sessions', 'totalUsers', 'engagementRate', 'averageSessionDuration'), ...byMetric('sessions', 20) },
    // pages grouped by path only (a page whose title changed would otherwise split into several rows)
    pages: { dateRanges: cur, dimensions: D('pagePath'), metrics: M('screenPageViews', 'totalUsers', 'userEngagementDuration', 'keyEvents'), ...byMetric('screenPageViews', 25) },
    pageTitles: { dateRanges: [{ startDate: recentStart(range), endDate: range.end }], dimensions: D('pagePath', 'pageTitle'), metrics: M('screenPageViews'), ...byMetric('screenPageViews', 200) },
    pageTitlesAll: { dateRanges: cur, dimensions: D('pagePath', 'pageTitle'), metrics: M('screenPageViews'), ...byMetric('screenPageViews', 200) },
    devices: { dateRanges: cur, dimensions: D('deviceCategory'), metrics: M('totalUsers', 'sessions', 'engagementRate', 'keyEvents'), ...byMetric('totalUsers', 5) },
    countries: { dateRanges: cur, dimensions: D('country'), metrics: M('totalUsers', 'sessions', 'keyEvents'), ...byMetric('totalUsers', 10) },
    cities: { dateRanges: cur, dimensions: D('city'), metrics: M('totalUsers', 'sessions'), ...byMetric('totalUsers', 12) },
    newVsReturning: { dateRanges: cur, dimensions: D('newVsReturning'), metrics: M('totalUsers', 'sessions', 'engagementRate') },
    heat: { dateRanges: cur, dimensions: D('dayOfWeek', 'hour'), metrics: M('sessions'), limit: 200 },
    events: { dateRanges: cur, dimensions: D('eventName'), metrics: M('eventCount', 'totalUsers'), dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: USEFUL_EVENTS } } }, ...byMetric('eventCount', 20) },
  }
}

const dashCache = new Map()
function cachedP(key, ttl, fn) {
  const hit = dashCache.get(key)
  if (hit && Date.now() - hit.t < ttl) return hit.p
  const p = fn()
  p.catch(() => dashCache.delete(key))
  dashCache.set(key, { t: Date.now(), p })
  if (dashCache.size > 200) dashCache.clear()
  return p
}
async function batch(cred, requests, fetchImpl) {
  const chunks = []
  for (let i = 0; i < requests.length; i += 5) chunks.push(requests.slice(i, i + 5))
  const out = await Promise.all(chunks.map(c => gaPost(cred, 'batchRunReports', { requests: c }, fetchImpl).then(d => d.reports || [])))
  return out.flat()
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** POST /api/meta/ga4-dash body → { configured, ... }. type: dashboard | realtime | page | test */
export async function dash(body = {}, { property = '', fetchImpl = fetch, env = process.env, fresh = false } = {}) {
  const cred = ga4Credentials(env, property)
  if (!cred.configured) return { configured: false, missing: cred.missing, error: cred.jsonError || '', property: cred.property, serviceAccount: cred.email || '' }
  const type = String(body.type || 'dashboard')
  const start = DATE_RE.test(body.start) ? body.start : null, end = DATE_RE.test(body.end) ? body.end : null
  const p = cred.property
  if (type === 'test') {
    await batch(cred, [{ dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }], metrics: M('totalUsers') }], fetchImpl)
    return { configured: true, ok: true, property: p, serviceAccount: cred.email }
  }
  if (type === 'realtime') {
    // 25 s: the panel refreshes every minute, so every refresh gets a fresh number
    const rt = await cachedP(`rt:${p}`, 25000, async () => {
      const today = [{ startDate: 'today', endDate: 'today' }]
      const [now, byMinute, devices, todayRep] = await Promise.all([
        gaPost(cred, 'runRealtimeReport', { metrics: M('activeUsers'), dimensions: D('unifiedScreenName'), metricAggregations: ['TOTAL'], ...byMetric('activeUsers', 10) }, fetchImpl),
        gaPost(cred, 'runRealtimeReport', { metrics: M('screenPageViews'), dimensions: D('minutesAgo'), limit: 31 }, fetchImpl).catch(() => null),
        gaPost(cred, 'runRealtimeReport', { metrics: M('activeUsers'), dimensions: D('deviceCategory'), limit: 4 }, fetchImpl).catch(() => null),
        // the realtime API has no traffic-source dimensions: where they came from is today's ordinary report
        batch(cred, [
          { dateRanges: today, dimensions: D('sessionDefaultChannelGroup'), metrics: M('totalUsers', 'sessions'), ...byMetric('sessions', 8) },
          { dateRanges: today, dimensions: D('sessionSource', 'sessionMedium'), metrics: M('totalUsers', 'sessions'), ...byMetric('sessions', 8) },
          { dateRanges: today, metrics: M('totalUsers', 'sessions', 'screenPageViews') },
        ], fetchImpl).catch(() => []),
      ])
      return { now, byMinute, devices, todayChannels: todayRep[0] || null, todaySources: todayRep[1] || null, todayTotals: todayRep[2] || null }
    })
    return { configured: true, rt, at: new Date().toISOString() }
  }
  if (type === 'page') {
    const path = String(body.path || '').slice(0, 300)
    if (!path.startsWith('/') || !start || !end) { const e = new Error('bad page request'); e.kind = 'request'; throw e }
    const filt = { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'EXACT', value: path } } }
    const cur = [{ startDate: start, endDate: end }]
    const r = await cachedP(`page:${p}:${path}:${start}:${end}`, 5 * 60000, () => batch(cred, [
      { dateRanges: cur, dimensions: D('date'), metrics: M('screenPageViews', 'totalUsers'), dimensionFilter: filt, orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 400 },
      { dateRanges: cur, dimensions: D('sessionSource'), metrics: M('totalUsers', 'sessions'), dimensionFilter: filt, ...byMetric('totalUsers', 8) },
      { dateRanges: cur, dimensions: D('deviceCategory'), metrics: M('totalUsers'), dimensionFilter: filt, ...byMetric('totalUsers', 4) },
    ], fetchImpl))
    return { configured: true, page: path, reports: { timeseries: r[0], sources: r[1], devices: r[2] } }
  }
  if (!start || !end || start > end) { const e = new Error('bad range'); e.kind = 'request'; throw e }
  const prev = previousRange(start, end)
  const specs = dashSpecs({ start, end }, prev)
  const names = Object.keys(specs)
  const key = `dash:${p}:${start}:${end}`
  if (fresh) dashCache.delete(key)
  const reports = await cachedP(key, 5 * 60000, () => batch(cred, names.map(n => specs[n]), fetchImpl))
  return { configured: true, property: p, range: { start, end }, prevRange: prev, reports: Object.fromEntries(names.map((n, i) => [n, reports[i] || null])), generatedAt: new Date().toISOString() }
}
