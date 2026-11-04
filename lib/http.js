// Shared response helper for the Vercel functions.
// Vercel meters every byte a function returns to the edge ("Fast Origin Transfer"), so JSON goes out
// gzipped (5-50x smaller) and with an ETag: a client that polls with If-None-Match gets an empty 304
// when nothing changed. Works for public (CDN-cached) and admin (no-store) responses alike.
import { gzipSync } from 'zlib'
import { createHash } from 'crypto'
import { AsyncLocalStorage } from 'node:async_hooks'

// ── Server-Timing: how long the function itself took, and how much of it went to each outside service ──────────────────
// Every answer of a handler that called compressJson() carries `Server-Timing: app;dur=…, db;dur=…, green;dur=…` (numbers
// only), so the latency of every leg is measurable from outside (the probe's chat-perf action, the browser's devtools). The
// outgoing fetches are timed per host while a request is in flight (AsyncLocalStorage — no handler needs to know); calls that
// run side by side are summed. `cold` marks the first request an instance serves (a cold start).
const als = new AsyncLocalStorage()
const HOSTS = [[/supabase\.co/, 'db'], [/greenapi\.com|green-api\.com/, 'green'], [/anthropic\.com/, 'ai'], [/facebook\.com/, 'meta'], [/onrender\.com/, 'render'], [/googleapis\.com/, 'google']]
export function hostKind(url) {
  const u = String(url?.url || url || '')
  for (const [re, k] of HOSTS) if (re.test(u)) return k
  return 'ext'
}
let served = 0
if (typeof globalThis.fetch === 'function' && !globalThis.fetch.__timed) {
  const f0 = globalThis.fetch
  const timedFetch = function (input, init) {
    const store = als.getStore()
    if (!store) return f0(input, init)
    const k = hostKind(input), t = performance.now()
    const done = () => { store[k] = (store[k] || 0) + (performance.now() - t); store[`${k}#`] = (store[`${k}#`] || 0) + 1 }
    return f0(input, init).then(r => { done(); return r }, e => { done(); throw e })
  }
  timedFetch.__timed = true
  globalThis.fetch = timedFetch
}
/** Server-Timing value for a request's store: app (the whole handler) + one entry per outside service, with call counts */
export function serverTiming(store, now = performance.now()) {
  if (!store) return ''
  const parts = [`app;dur=${Math.round(now - store.t0)}`]
  for (const [k, v] of Object.entries(store)) if (!k.includes('#') && k !== 't0' && k !== 'cold') parts.push(`${k};dur=${Math.round(v)};desc="${store[`${k}#`] || 0}"`)
  if (store.cold) parts.push('cold')
  return parts.join(', ')
}

// Make every res.json() of a handler go through sendJson (gzip + ETag + 304). Call once at the top of a handler:
// res.status(x).json(d) keeps working — the status set by res.status() is passed on.
export function compressJson(req, res) {
  if (res.__compressJson) return
  res.__compressJson = true
  const store = { t0: performance.now(), cold: served++ === 0 }
  als.enterWith(store)
  res.__timing = store
  res.json = data => sendJson(req, res, data, res.statusCode || 200)
}

export function sendJson(req, res, data, status = 200) {
  const body = JSON.stringify(data)
  const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 20)}"`
  res.setHeader('ETag', etag)
  if (res.__timing && !res.headersSent) res.setHeader('Server-Timing', serverTiming(res.__timing))
  const vary = res.getHeader('Vary')
  res.setHeader('Vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding, Authorization')
  if (status === 200 && (req.headers['if-none-match'] || '') === etag) return res.status(304).end()
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && body.length > 1024) {
    res.setHeader('Content-Encoding', 'gzip')
    return res.status(status).send(gzipSync(Buffer.from(body, 'utf8')))
  }
  return res.status(status).send(body)
}
