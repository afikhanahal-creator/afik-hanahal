// Vercel serverless — proxies property GET to Render backend
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'

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
      else         res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=900')
      return res.status(200).json(data)
    }
    console.warn('[properties vercel] Render returned', r.status)
    return res.status(r.status).json({ error: 'Backend error' })
  } catch (e) {
    console.error('[properties vercel] GET error:', e.message)
    return res.status(502).json({ error: e.message })
  }
}
