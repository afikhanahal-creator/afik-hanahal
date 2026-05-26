// Vercel serverless — fast news archive, reads Supabase directly (no Render dependency)
// Supabase is always up; no free-tier sleep → instant response vs. 15-30s Render wake-up
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'

// Accept SUPABASE_URL / SUPABASE_SERVICE_KEY (set in Vercel env vars)
// Also try VITE_ prefixed names in case those are what Vercel has set
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // ── Primary: Supabase REST API (instant — always available) ──────────────────
  if (SUPA_URL && SUPA_KEY) {
    try {
      const url = `${SUPA_URL}/rest/v1/news_articles` +
        `?select=id,title,url,image,source,published_at` +
        `&lang=eq.he` +
        `&published_at=gte.${encodeURIComponent(cutoff)}` +
        `&image=not.is.null` +
        `&image=neq.` +
        `&order=published_at.desc` +
        `&limit=300`

      const r = await fetch(url, {
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok) {
        const data = await r.json()
        const articles = (Array.isArray(data) ? data : []).filter(a => a.image)
        console.log(`[archive] Supabase: ${articles.length} articles`)
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
        return res.status(200).json(articles)
      }
      console.warn('[archive] Supabase HTTP', r.status)
    } catch (e) {
      console.error('[archive] Supabase error:', e.message)
    }
  } else {
    console.warn('[archive] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — falling back to Render')
  }

  // ── Fallback: Render server (might be sleeping) ───────────────────────────────
  try {
    const r = await fetch(`${RENDER}/api/news/archive`, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'application/json' },
    })
    if (r.ok) {
      const data = await r.json()
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
      return res.status(200).json(Array.isArray(data) ? data.filter(a => a.image) : [])
    }
  } catch (e) {
    console.error('[archive] Render fallback error:', e.message)
  }

  return res.status(200).json([])
}
