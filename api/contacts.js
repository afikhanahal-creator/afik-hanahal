// Vercel serverless — proxies contacts POST to Render backend
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const authHeader = req.headers.authorization || ''

  try {
    const r = await fetch(`${RENDER}/api/contacts`, {
      method: req.method,
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(15000),
    })
    const data = await r.json().catch(() => ({}))
    return res.status(r.status).json(data)
  } catch (e) {
    console.error('[contacts vercel] error:', e.message)
    return res.status(502).json({ error: e.message })
  }
}
