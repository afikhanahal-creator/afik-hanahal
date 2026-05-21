// Vercel serverless — proxies property GET to Render backend
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const authHeader = req.headers.authorization || ''

  try {
    const r = await fetch(`${RENDER}/api/properties`, {
      headers: { Authorization: authHeader },
      signal:  AbortSignal.timeout(12000),
    })
    if (r.ok) {
      const data = await r.json()
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      return res.status(200).json(data)
    }
    console.warn('[properties vercel] Render returned', r.status)
    return res.status(r.status).json({ error: 'Backend error' })
  } catch (e) {
    console.error('[properties vercel] GET error:', e.message)
    return res.status(502).json({ error: e.message })
  }
}
