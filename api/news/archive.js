// Vercel serverless — the archive modal: every stored real-estate article from the last 30 days.
// Reads Supabase directly (always up); falls back to the legacy Render server.
// Filtered through lib/news/classify.js so the archive is real-estate-only even before the
// nightly sweep in /api/cron/warm has deleted older off-topic rows.

import { titleKey } from '../../lib/news/sources.js'
import { scoreRealEstate } from '../../lib/news/classify.js'

const RENDER   = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const WINDOW_DAYS = 30

function clean(list) {
  const seen = new Set()
  return (Array.isArray(list) ? list : [])
    .filter(a => a?.title && a.image && scoreRealEstate(a.title).ok)
    .filter(a => { const k = titleKey(a.title); if (seen.has(k)) return false; seen.add(k); return true })
    .map(a => ({ id: a.id || a.url, title: a.title, url: a.url, link: a.link || a.url, image: a.image, source: a.source,
                 publishedAt: a.publishedAt || a.published_at || null }))
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 864e5).toISOString()

  if (SUPA_URL && SUPA_KEY) {
    try {
      const u = `${SUPA_URL}/rest/v1/news_articles?select=id,title,url,image,source,published_at` +
        `&lang=eq.he&published_at=gte.${encodeURIComponent(cutoff)}&image=not.is.null&image=neq.&order=published_at.desc&limit=400`
      const r = await fetch(u, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
      if (r.ok) {
        const articles = clean(await r.json())
        console.log(`[archive] Supabase: ${articles.length} articles`)
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
        return res.status(200).json(articles)
      }
      console.warn('[archive] Supabase HTTP', r.status)
    } catch (e) { console.error('[archive] Supabase error:', e.message) }
  } else {
    console.warn('[archive] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — falling back to Render')
  }

  try {
    const r = await fetch(`${RENDER}/api/news/archive`, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } })
    if (r.ok) {
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
      return res.status(200).json(clean(await r.json()))
    }
  } catch (e) { console.error('[archive] Render fallback error:', e.message) }

  return res.status(200).json([])
}
