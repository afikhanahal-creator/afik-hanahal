// Vercel serverless — proxies property GET to Render backend
import { sendJson } from '../lib/http.js'
import { isPreviewBot, renderSharePage, targetUrl } from '../lib/share-page.js'
import { resolveParcel, govmapParcelUrl } from '../lib/parcel-locate.js'
import { createFeed } from '../lib/property-feed.js'
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

// ── /media/<bucket>/<path> → image from Supabase public storage, cached on Vercel's CDN ──────
// Supabase's free tier meters every image byte a browser pulls (5 GB/month), and a listing site
// burns through that in days. Vercel's edge caches this response for a year per region, so each
// photo leaves Supabase once and every later visitor is served from the CDN.
const SUPA_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const IMG_PATH_RE = /^[\w\-./%()~!,+ \u0590-\u05FF]{3,400}$/
// Public list: Render when it answers within 2.5 s, otherwise the Supabase snapshot (lib/property-feed.js)
const feed = createFeed({ renderUrl: RENDER, supaUrl: SUPA_URL, supaKey: SUPA_KEY })
async function serveImage(req, res, rawPath) {
  const path = String(rawPath || '').replace(/^\/+/, '')
  if (!SUPA_URL || !IMG_PATH_RE.test(path) || path.includes('..')) return res.status(400).send('bad path')
  try {
    const r = await fetch(`${SUPA_URL}/storage/v1/object/public/${path.split('/').map(seg => encodeURIComponent(decodeURIComponent(seg))).join('/')}`, { signal: AbortSignal.timeout(20000) })
    if (!r.ok) { res.setHeader('Cache-Control', 'public, max-age=60'); return res.status(r.status === 404 ? 404 : 502).send('not found') }
    const type = r.headers.get('content-type') || ''
    if (!/^(image|video)\//.test(type)) { res.setHeader('Cache-Control', 'public, max-age=60'); return res.status(415).send('not media') }
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > 4400000) return res.redirect(302, `${SUPA_URL}/storage/v1/object/public/${path}`)  // above the function response cap: let the browser fetch it directly
    res.setHeader('Content-Type', type)
    res.setHeader('Content-Length', String(buf.length))
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).send(buf)
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(502).send('upstream error')
  }
}

// ── /p/<id> → property share link (rich preview for social crawlers, instant redirect for people) ──
async function serveShare(req, res) {
  const id = String(req.query.share || '').trim().slice(0, 80)
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'afikhanahal.co.il').split(',')[0].trim()
  const origin = `https://${host}`
  const lang = req.query.lang === 'en' ? 'en' : 'he'
  res.setHeader('Cache-Control', 'no-store')          // the response depends on who asks (crawler vs person)
  if (!id) return res.redirect(302, '/#properties')
  const target = targetUrl(id, req.query)
  if (!isPreviewBot(req.headers['user-agent'])) return res.redirect(302, target)
  // Crawlers give up after a few seconds: the snapshot answers at once, the live list only if needed
  let prop = null
  try { prop = (await feed.getOne(id)).property } catch {}
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Robots-Tag', 'noindex')
  if (!prop) return res.status(200).send(renderSharePage({ id, title: lang === 'en' ? 'Afik Hanahal properties' : 'הנכסים של אפיק הנחל' }, { origin, lang, target: '/#properties' }))
  return res.status(200).send(renderSharePage(prop, { origin, lang, target }))
}

// ── /api/properties?parcel=<gush>-<helka> → the parcel's map point for the GovMap widget ─────────────
// Resolved server-side from several GovMap sources (see lib/parcel-locate.js). Parcels don't move, so a
// hit is cached on the CDN for a month; a miss only briefly, so a GovMap outage heals by itself.
const parcelCache = new Map()
async function serveParcel(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const [gush, helka] = String(req.query.parcel || '').split(/[-_/,\s]+/)
  const key = `${parseInt(gush, 10)}-${parseInt(helka, 10)}`
  let r = parcelCache.get(key)
  if (!r || Date.now() - r.at > (r.data.ok ? 864e5 : 6e4)) {
    r = { at: Date.now(), data: await resolveParcel(gush, helka) }
    if (r.data.error !== 'bad_input') parcelCache.set(key, r)
    if (parcelCache.size > 500) parcelCache.delete(parcelCache.keys().next().value)
  }
  const data = { ...r.data, govmapUrl: r.data.error === 'bad_input' ? null : govmapParcelUrl(parseInt(gush, 10), parseInt(helka, 10)) }
  if (!data.ok) console.warn('[parcel]', key, JSON.stringify(data.tried))
  res.setHeader('Cache-Control', data.ok ? 'public, s-maxage=2592000, stale-while-revalidate=86400' : 'public, s-maxage=60')
  return sendJson(req, res, data, data.error === 'bad_input' ? 400 : 200)
}

// ── /api/properties?one=<id> → a single published property (the page a share link opens) ─────────
// A few KB instead of the whole list, so a colleague opening a shared link sees the property at once.
async function serveOne(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const id = String(req.query.one || '').trim().slice(0, 80)
  if (!id) return res.status(400).json({ error: 'missing id' })
  try {
    const { source, property } = await feed.getOne(id)
    res.setHeader('X-Feed-Source', source)
    if (!property) { res.setHeader('Cache-Control', 'public, s-maxage=30'); return res.status(404).json({ error: 'not found' }) }
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=86400')
    return sendJson(req, res, property)
  } catch (e) {
    return res.status(502).json({ error: e.message })
  }
}

export default async function handler(req, res) {
  if (req.query && req.query.img !== undefined) return serveImage(req, res, req.query.img)
  if (req.query && req.query.share !== undefined) return serveShare(req, res)
  if (req.query && req.query.parcel !== undefined) return serveParcel(req, res)
  if (req.query && req.query.one !== undefined) return serveOne(req, res)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const authHeader = req.headers.authorization || ''
  const isAdmin    = !!authHeader   // admins send a Bearer token

  // Public read: never left hanging on a sleeping Render (see lib/property-feed.js). CDN-cached;
  // a snapshot answer is cached briefly so the edge picks up the live list once Render is awake.
  if (!isAdmin) {
    try {
      const r = await feed.getList()
      res.setHeader('X-Feed-Source', r.source)
      res.setHeader('Cache-Control', r.source === 'render' ? 'public, s-maxage=300, stale-while-revalidate=86400' : 'public, s-maxage=30, stale-while-revalidate=86400')
      return sendJson(req, res, r.list)
    } catch (e) {
      console.error('[properties vercel] public GET error:', e.message)
      return res.status(502).json({ error: e.message })
    }
  }

  try {
    const r = await fetch(`${RENDER}/api/properties`, {
      headers: { Authorization: authHeader },
      signal:  AbortSignal.timeout(13000),
    })
    if (r.ok) {
      const data = await r.json()
      // Public reads are served from Vercel's CDN: the first request warms the
      // cache, every later visitor gets the property list INSTANTLY from the edge
      // (no Render free-tier cold-start), and it revalidates in the background —
      // stale-while-revalidate means users never wait even when Render is asleep.
      // Admin reads (with a token) always bypass the cache so edits show at once.
      if (isAdmin) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      else         res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
      return sendJson(req, res, data)
    }
    console.warn('[properties vercel] Render returned', r.status)
    return res.status(r.status).json({ error: 'Backend error' })
  } catch (e) {
    console.error('[properties vercel] GET error:', e.message)
    return res.status(502).json({ error: e.message })
  }
}
