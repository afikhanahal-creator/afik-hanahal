// Vercel cron — keeps the Render server alive and triggers a fresh RSS rebuild every 2 hours.
// Render free tier sleeps after ~15 min inactivity.  Calling /api/news/rebuild wakes it up
// and saves fresh articles to Supabase so the archive endpoint always has current data.
const RENDER       = process.env.RENDER_URL  || 'https://afik-hanahal-server.onrender.com'
const ADMIN_TOKEN  = process.env.ADMIN_TOKEN || 'AFIKhanahal2026'

export default async function handler(req, res) {
  // Allow Vercel cron scheduler (GET with no auth) and manual admin triggers (POST)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  console.log('[cron/warm] pinging Render rebuild...')

  try {
    const r = await fetch(`${RENDER}/api/news/rebuild`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
      signal: AbortSignal.timeout(10000),
    })
    const text = await r.text().catch(() => '')
    console.log(`[cron/warm] Render responded ${r.status}: ${text.slice(0, 100)}`)
    return res.status(200).json({ ok: true, renderStatus: r.status, ts: new Date().toISOString() })
  } catch (e) {
    // Render may be sleeping — the fetch itself wakes it up even if it times out
    console.warn('[cron/warm] Render ping timed out or failed (server was sleeping):', e.message)
    return res.status(200).json({ ok: true, note: 'ping sent, server waking', ts: new Date().toISOString() })
  }
}
