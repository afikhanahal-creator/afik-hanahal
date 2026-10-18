import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { ga4Credentials, signJwt, ranges, tidy, report } from './ga4.js'

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
const json = JSON.stringify({ client_email: 'sa@x.iam.gserviceaccount.com', private_key: pem })

test('credentials: raw JSON, base64 JSON, split vars, missing', () => {
  assert.equal(ga4Credentials({ GA4_SERVICE_ACCOUNT_JSON: json }).configured, true)
  assert.equal(ga4Credentials({ GA4_SERVICE_ACCOUNT_JSON: Buffer.from(json).toString('base64') }).email, 'sa@x.iam.gserviceaccount.com')
  const split = ga4Credentials({ GA4_CLIENT_EMAIL: 'a@b', GA4_PRIVATE_KEY: pem.replace(/\n/g, '\\n'), GA4_PROPERTY_ID: 'properties/42' })
  assert.equal(split.configured, true); assert.equal(split.property, '42'); assert.ok(split.key.includes('\n'))
  assert.deepEqual(ga4Credentials({}).missing, ['GA4_SERVICE_ACCOUNT_JSON'])
  assert.equal(ga4Credentials({ GA4_SERVICE_ACCOUNT_JSON: '{bad' }).configured, false)
})

test('JWT is RS256 and verifies with the public key', () => {
  const jwt = signJwt('sa@x', pem, 1000)
  const [h, b, s] = jwt.split('.')
  assert.equal(JSON.parse(Buffer.from(h, 'base64url')).alg, 'RS256')
  assert.equal(JSON.parse(Buffer.from(b, 'base64url')).exp, 4600)
  assert.ok(crypto.createVerify('RSA-SHA256').update(`${h}.${b}`).verify(publicKey, Buffer.from(s, 'base64url')))
})

test('ranges: equal-length current and previous periods', () => {
  const r = ranges(7, new Date('2026-09-23T10:00:00Z'))
  assert.equal(r.cur.startDate, '2026-09-17'); assert.equal(r.prev.endDate, '2026-09-16'); assert.equal(r.prev.startDate, '2026-09-10')
})

test('tidy maps dateRange and renames conversions → keyEvents', () => {
  const rows = tidy({ dimensionHeaders: [{ name: 'date' }, { name: 'dateRange' }], metricHeaders: [{ name: 'sessions' }, { name: 'conversions' }],
    rows: [{ dimensionValues: [{ value: '20260920' }, { value: 'cur' }], metricValues: [{ value: '5' }, { value: '2' }] }] })
  assert.deepEqual(rows, [{ date: '20260920', range: 'cur', sessions: 5, keyEvents: 2 }])
})

test('report: auth + 3 batches, falls back to conversions', async () => {
  const calls = []
  const fetchImpl = async (url, opts) => {
    calls.push(url)
    if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 })
    const body = JSON.parse(opts.body)
    if (JSON.stringify(body).includes('"keyEvents"')) return new Response(JSON.stringify({ error: { message: 'Field keyEvents is not a valid metric' } }), { status: 400 })
    const reports = body.requests.map(() => ({ dimensionHeaders: [{ name: 'dateRange' }], metricHeaders: [{ name: 'sessions' }], rows: [{ dimensionValues: [{ value: 'cur' }], metricValues: [{ value: '9' }] }, { dimensionValues: [{ value: 'prev' }], metricValues: [{ value: '3' }] }] }))
    return new Response(JSON.stringify({ reports }), { status: 200 })
  }
  const d = await report({ days: 7, fresh: true, fetchImpl, env: { GA4_SERVICE_ACCOUNT_JSON: json } })
  assert.equal(d.configured, true)
  assert.equal(d.totals.cur.sessions, 9); assert.equal(d.totals.prev.sessions, 3)
  assert.equal(calls.filter(u => u.includes('batchRunReports')).length, 6)   // 3 failed + 3 retried
  const nc = await report({ env: {} })
  assert.equal(nc.configured, false)
})

test('dashboard: previous range, specs, Korkos env names and a key pasted on one line', async () => {
  const { previousRange, dashSpecs, ga4Credentials, normalizePrivateKey, CONVERSION_EVENTS } = await import('./ga4.js')
  assert.deepEqual(previousRange('2026-10-01', '2026-10-30'), { start: '2026-09-01', end: '2026-09-30' })
  assert.deepEqual(previousRange('2026-10-18', '2026-10-18'), { start: '2026-10-17', end: '2026-10-17' })
  const s = dashSpecs({ start: '2026-10-01', end: '2026-10-30' }, { start: '2026-09-01', end: '2026-09-30' })
  assert.ok(Object.keys(s).length >= 25)
  assert.deepEqual(s.conv.dimensionFilter.filter.inListFilter.values, CONVERSION_EVENTS)
  assert.equal(s.totalsPrev.dateRanges[0].startDate, '2026-09-01')
  assert.equal(s.pageTitles.dateRanges[0].startDate, '2026-10-28')
  const body = 'A'.repeat(130)
  const k = normalizePrivateKey(`"-----BEGIN PRIVATE KEY-----${body}-----END PRIVATE KEY-----"`)
  assert.match(k, /^-----BEGIN PRIVATE KEY-----\n/)
  assert.equal(k.split('\n')[1].length, 64)
  assert.equal(normalizePrivateKey('-----BEGIN PRIVATE KEY-----\\nAB\\n-----END PRIVATE KEY-----\\n'), '-----BEGIN PRIVATE KEY-----\nAB\n-----END PRIVATE KEY-----')
  const c = ga4Credentials({ GA_SA_CLIENT_EMAIL: 'x@y.iam.gserviceaccount.com', GA_SA_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nAB\\n-----END PRIVATE KEY-----' }, '123')
  assert.equal(c.configured, true); assert.equal(c.property, '123')
  assert.equal(ga4Credentials({ GA4_PROPERTY_ID: 'properties/999' }).property, '999')
})

test('a 429 (too many concurrent requests) is retried, never more than GA_LIMIT.max at once, then reported as quota', async () => {
  const { dash, GA_LIMIT } = await import('./ga4.js')
  const saved = { ...GA_LIMIT }
  GA_LIMIT.delays = [1, 1, 1]
  let live = 0, peak = 0, busyLeft = 3
  const ok = body => ({ reports: body.requests.map(() => ({ rows: [] })) })
  const fetchImpl = async (url, opts) => {
    if (url.includes('oauth2')) return new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 })
    live++; peak = Math.max(peak, live)
    await new Promise(r => setTimeout(r, 5))
    live--
    if (busyLeft > 0) { busyLeft--; return new Response(JSON.stringify({ error: { message: 'Exhausted concurrent requests quota.' } }), { status: 429 }) }
    return new Response(JSON.stringify(ok(JSON.parse(opts.body))), { status: 200 })
  }
  const env = { GA4_SERVICE_ACCOUNT_JSON: json }
  const d = await dash({ type: 'dashboard', start: '2026-09-01', end: '2026-09-30' }, { fetchImpl, env, fresh: true })
  assert.equal(d.configured, true)
  assert.ok(peak <= GA_LIMIT.max, `peak ${peak}`)
  // Google stays busy: the last good dashboard is served, marked stale
  const busy = async url => (url.includes('oauth2') ? new Response(JSON.stringify({ access_token: 't', expires_in: 3600 }), { status: 200 }) : new Response('{}', { status: 429 }))
  const s = await dash({ type: 'dashboard', start: '2026-09-01', end: '2026-09-30' }, { fetchImpl: busy, env, fresh: true })
  assert.equal(s.stale, true)
  await assert.rejects(dash({ type: 'dashboard', start: '2026-08-01', end: '2026-08-30' }, { fetchImpl: busy, env, fresh: true }), e => e.kind === 'quota')
  Object.assign(GA_LIMIT, saved)
})
