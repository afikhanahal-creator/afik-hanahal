// Vercel serverless — proxies property GET to Render backend
import { sendJson } from '../lib/http.js'
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'

// ── /media/<bucket>/<path> → image from Supabase public storage, cached on Vercel's CDN ──────
// Supabase's free tier meters every image byte a browser pulls (5 GB/month), and a listing site
// burns through that in days. Vercel's edge caches this response for a year per region, so each
// photo leaves Supabase once and every later visitor is served from the CDN.
const SUPA_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const IMG_PATH_RE = /^[\w\-./%()~!,+ \u0590-\u05FF]{3,400}$/
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

export default async function handler(req, res) {
  if (req.query && req.query.img !== undefined) return serveImage(req, res, req.query.img)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const authHeader = req.headers.authorization || ''
  const isAdmin    = !!authHeader   // admins send a Bearer token

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
