// Vercel serverless — the 4 homepage articles.
//   Fast path : the featured board curated by /api/cron/rotate in Supabase (~50 ms).
//   Slow path : live RSS from lib/news/sources.js when the board is missing/short (~3-8 s).
//   Fallback  : the legacy Render server.
// Every path is filtered through lib/news/classify.js — nothing off-topic leaves this endpoint.

import { fetchAllSources, outletKey, outletCap, titleKey, cleanTitle, deduplicateImages, isArticleImage, RSS_HEADERS } from '../lib/news/sources.js'
import { scoreRealEstate } from '../lib/news/classify.js'

const RENDER   = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const BOARD_SIZE = 4

const shape = a => ({
  id: a.id || a.url, title: a.title, url: a.url, link: a.link || a.url, image: a.image || '',
  source: a.source, publishedAt: a.publishedAt || a.published_at || null,
})

async function fetchOGImage(url) {
  try {
    const r = await fetch(url, { headers: { ...RSS_HEADERS, Accept: 'text/html,application/xhtml+xml,*/*' }, signal: AbortSignal.timeout(5000), redirect: 'follow' })
    if (!r.ok) return ''
    try { if (new URL(r.url).hostname.includes('google.com')) return '' } catch {}
    const html = await r.text()
    const img = (
      html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i)
    )?.[1]?.replace(/&amp;/g, '&').trim() || ''
    return isArticleImage(img) ? img : ''
  } catch { return '' }
}

// Interleave outlets (A, B, C, A, B, C…) so the first N are as diverse as possible
function interleave(articles) {
  const q = {}
  articles.forEach(a => (q[outletKey(a.url, a.source)] ||= []).push(a))
  const queues = Object.values(q), out = []
  for (let any = true; any;) { any = false; for (const l of queues) if (l.length) { out.push(l.shift()); any = true } }
  return out
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── Fast path: curated board ───────────────────────────────────────────────
  if (SUPA_URL && SUPA_KEY) {
    try {
      const u = `${SUPA_URL}/rest/v1/news_articles?select=id,title,url,image,source,published_at` +
        `&lang=eq.he&featured=eq.true&image=not.is.null&image=neq.&order=published_at.desc&limit=8`
      const r = await fetch(u, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Accept: 'application/json' }, signal: AbortSignal.timeout(5000) })
      if (r.ok) {
        const board = (await r.json()).filter(a => a.image && scoreRealEstate(a.title).ok)
        if (board.length >= BOARD_SIZE) {
          res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
          return res.status(200).json(board.map(shape))
        }
        console.warn(`[news] board has ${board.length}/${BOARD_SIZE} valid featured — falling back to live RSS`)
      }
    } catch (e) { console.warn('[news] Supabase board read skipped:', e.message) }
  }

  // ── Slow path: live RSS ────────────────────────────────────────────────────
  try {
    const all = await fetchAllSources({ timeoutMs: 8000, concurrency: 12, log: m => console.log('[news]', m) })
    const seen = new Set(), counts = {}
    let articles = [...all.filter(a => !a.gn), ...all.filter(a => a.gn)]
      .map(a => ({ ...a, title: cleanTitle(a.title, a.gn) }))
      .filter(a => {
        if (!scoreRealEstate(a.title, a.desc, { trusted: a.trusted }).ok) return false
        const k = titleKey(a.title); if (seen.has(k)) return false; seen.add(k); return true
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .filter(a => { const k = outletKey(a.url, a.source); counts[k] = (counts[k] || 0) + 1; return counts[k] <= outletCap(k) })
    articles = deduplicateImages(interleave(articles)).slice(0, 40)
    console.log(`[news] live: ${articles.length} articles from ${new Set(articles.map(a => outletKey(a.url, a.source))).size} outlets`)

    if (articles.length) {
      const needImg = articles.filter(a => !a.image).slice(0, 20)
      if (needImg.length) {
        const og = await Promise.allSettled(needImg.map(a => fetchOGImage(a.url)))
        const m = new Map(needImg.map((a, i) => [a.id, og[i].status === 'fulfilled' ? og[i].value : '']))
        articles = articles.map(a => (!a.image && m.has(a.id)) ? { ...a, image: m.get(a.id) || '' } : a)
      }
      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
      return res.status(200).json(articles.map(shape))
    }
    console.warn('[news] 0 articles from RSS, falling back to Render')
  } catch (e) { console.error('[news] RSS error:', e.message) }

  // ── Fallback: legacy Render backend (filtered) ─────────────────────────────
  try {
    const r = await fetch(`${RENDER}/api/news/feed`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
    if (r.ok) {
      const json = await r.json()
      const ok = (Array.isArray(json) ? json : []).filter(a => a?.title && scoreRealEstate(a.title, a.desc).ok)
      if (ok.length) { res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800'); return res.status(200).json(ok.map(shape)) }
    }
  } catch (e) { console.error('[news] Render fallback:', e.message) }

  return res.status(502).json({ error: 'Could not load news' })
}
