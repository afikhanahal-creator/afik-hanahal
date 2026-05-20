// Vercel serverless — proxies stats GET/POST to the Render backend (single source of truth)
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const authHeader = req.headers.authorization || ''

  // ── POST: admin saving updated stats ────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const r = await fetch(`${RENDER}/api/stats`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body:    JSON.stringify(req.body),
        signal:  AbortSignal.timeout(12000),
      })
      const data = await r.json()
      return res.status(r.status).json(data)
    } catch (e) {
      console.error('[stats vercel] POST error:', e.message)
      return res.status(502).json({ error: e.message })
    }
  }

  // ── GET: public fetch of latest stats ───────────────────────────────────────
  try {
    const r = await fetch(`${RENDER}/api/stats`, {
      headers: { Authorization: authHeader },
      signal:  AbortSignal.timeout(8000),
    })
    if (r.ok) {
      const data = await r.json()
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      return res.status(200).json(data)
    }
    console.warn('[stats vercel] Render returned', r.status)
  } catch (e) {
    console.error('[stats vercel] GET error:', e.message)
  }

  return res.status(502).json({ error: 'Stats unavailable' })
}
