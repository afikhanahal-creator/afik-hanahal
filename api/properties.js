// Vercel serverless — proxies property GET to Render backend
import { gzipSync } from 'zlib'
import { createHash } from 'crypto'
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'

// The property list is the largest payload this site serves. Vercel meters every byte that leaves a
// function ("Fast Origin Transfer"), so the body is gzipped here (JSON shrinks 5-10x) and carries an
// ETag so a repeat poll costs a few hundred bytes instead of the whole list.
function sendJson(req, res, data) {
  const body = JSON.stringify(data)
  const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 20)}"`
  res.setHeader('ETag', etag)
  res.setHeader('Vary', 'Accept-Encoding, Authorization')
  if ((req.headers['if-none-match'] || '') === etag) return res.status(304).end()
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && body.length > 1024) {
    res.setHeader('Content-Encoding', 'gzip')
    return res.status(200).send(gzipSync(Buffer.from(body, 'utf8')))
  }
  return res.status(200).send(body)
}

export default async function handler(req, res) {
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
