// Vercel serverless — proxies property bulk-save POST to Render backend
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization || ''

  try {
    const r = await fetch(`${RENDER}/api/properties/bulk`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body:    JSON.stringify(req.body),
      signal:  AbortSignal.timeout(20000),
    })
    const data = await r.json().catch(() => ({}))
    return res.status(r.status).json(data)
  } catch (e) {
    console.error('[properties/bulk vercel] error:', e.message)
    return res.status(502).json({ error: e.message })
  }
}
