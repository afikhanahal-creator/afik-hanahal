// Vercel serverless — the homepage articles. Must answer FAST on every path:
//   1. Supabase board  : the 4 featured articles curated by /api/cron/rotate           (~50 ms)
//   2. Supabase pool   : if the board is short, the newest verified stored articles      (~100 ms)
//   3. Live RSS        : only when Supabase has < 4 valid articles — hard 12 s deadline  (≤ ~15 s)
//   4. Render (legacy) : last resort, filtered
// Every path is filtered through lib/news/classify.js. Add ?debug=1 for timings and per-source results.

import { fetchAllSources, outletKey, outletCap, titleKey, cleanTitle, deduplicateImages, fetchOGImage } from '../lib/news/sources.js'
import { scoreRealEstate } from '../lib/news/classify.js'
import archiveHandler from '../lib/news/archive.js'

const RENDER   = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const BOARD_SIZE = 4
const RESPONSE_MAX = 12

const shape = a => ({
  id: a.id || a.url, title: a.title, url: a.url, link: a.link || a.url, image: a.image || '',
  source: a.source, publishedAt: a.publishedAt || a.published_at || null,
})

async function supa(query, ms = 4000) {
  const r = await fetch(`${SUPA_URL}/rest/v1/news_articles?${query}`, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Accept: 'application/json' }, signal: AbortSignal.timeout(ms),
  })
  if (!r.ok) throw new Error(`Supabase ${r.status}`)
  return r.json()
}

// Interleave outlets (A, B, C, A, B, C…) so the first N are as diverse as possible
function interleave(articles) {
  const q = {}
  articles.forEach(a => (q[outletKey(a.url, a.source)] ||= []).push(a))
  const queues = Object.values(q), out = []
  for (let any = true; any;) { any = false; for (const l of queues) if (l.length) { out.push(l.shift()); any = true } }
  return out
}
function dedupe(list) {
  const seen = new Set()
  return list.filter(a => { const k = titleKey(a.title); if (seen.has(k)) return false; seen.add(k); return true })
}
const valid = a => a?.title && a.image && scoreRealEstate(a.title).ok

export default async function handler(req, res) {
  // /api/news/archive is rewritten here (vercel.json) — keeps the function count within the Hobby limit
  if (String(req.query?.archive || '') === '1' || /^\/api\/news\/archive(\?|$)/.test(req.url || '')) return archiveHandler(req, res)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const t0 = Date.now()
  const debug = /[?&]debug=1/.test(req.url || '')
  const diag = { path: null, timings: {}, counts: {}, log: [] }
  const send = (articles, cache) => {
    diag.timings.total = Date.now() - t0
    if (debug) { res.setHeader('Cache-Control', 'no-store'); return res.status(200).json({ ...diag, articles: articles.slice(0, RESPONSE_MAX).map(shape) }) }
    res.setHeader('Cache-Control', cache)
    return res.status(200).json(articles.slice(0, RESPONSE_MAX).map(shape))
  }

  // ── 1 + 2. Supabase: featured board, topped up from the verified pool ─────
  if (SUPA_URL && SUPA_KEY) {
    try {
      const sel = 'select=id,title,url,image,source,published_at&lang=eq.he&image=not.is.null&image=neq.'
      const since = new Date(Date.now() - 30 * 864e5).toISOString()
      const [boardRaw, poolRaw] = await Promise.all([
        supa(`${sel}&featured=eq.true&order=published_at.desc&limit=8`),
        supa(`${sel}&featured=eq.false&published_at=gte.${encodeURIComponent(since)}&order=published_at.desc&limit=150`),
      ])
      const board = boardRaw.filter(valid), pool = poolRaw.filter(valid)
      diag.counts.featured = board.length; diag.counts.pool = pool.length
      const articles = board.length >= BOARD_SIZE ? board : dedupe([...board, ...interleave(pool)])
      const outlets = new Set(articles.slice(0, RESPONSE_MAX).map(a => outletKey(a.url, a.source)))
      diag.counts.outlets = outlets.size
      diag.timings.supabase = Date.now() - t0
      if (articles.length >= BOARD_SIZE) {
        diag.path = board.length >= BOARD_SIZE ? 'board' : 'board+pool'
        // Tell the browser when the stored pool is thin, so it can nudge /api/cron/warm in the background
        res.setHeader('X-News-Outlets', String(outlets.size))
        res.setHeader('Access-Control-Expose-Headers', 'X-News-Outlets')
        return send(articles, 's-maxage=300, stale-while-revalidate=900')
      }
      diag.log.push(`supabase has only ${articles.length} valid articles — going live`)
    } catch (e) { diag.log.push(`supabase: ${e.message}`) }
  } else diag.log.push('supabase env not set')

  // ── 3. Live RSS with a hard deadline ───────────────────────────────────────
  try {
    const t1 = Date.now()
    const all = await fetchAllSources({ timeoutMs: 6000, concurrency: 16, deadlineMs: 8000, log: m => diag.log.push(m) })
    diag.counts.fetched = all.length; diag.counts.sources = all.stats
    const counts = {}
    let articles = dedupe([...all.filter(a => !a.gn), ...all.filter(a => a.gn)]
      .map(a => ({ ...a, title: cleanTitle(a.title, a.gn) }))
      .filter(a => scoreRealEstate(a.title, a.desc, { trusted: a.trusted }).ok))
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .filter(a => { const k = outletKey(a.url, a.source); counts[k] = (counts[k] || 0) + 1; return counts[k] <= outletCap(k) })
    articles = deduplicateImages(interleave(articles)).slice(0, 40)
    diag.counts.live = articles.length; diag.timings.rss = Date.now() - t1

    if (articles.length) {
      const needImg = articles.filter(a => !a.image).slice(0, 6)
      if (needImg.length) {
        const og = await Promise.allSettled(needImg.map(a => fetchOGImage(a.url, 2500)))
        const m = new Map(needImg.map((a, i) => [a.id, og[i].status === 'fulfilled' ? og[i].value : '']))
        articles = articles.map(a => (!a.image && m.has(a.id)) ? { ...a, image: m.get(a.id) || '' } : a)
      }
      diag.path = 'live-rss'
      // Self-heal: store what we just fetched so the next request is served from Supabase in ~100 ms
      // instead of hitting RSS again (the daily cron does the full ingest + sweep; this is a stopgap).
      if (SUPA_URL && SUPA_KEY) {
        try {
          const rows = articles.filter(a => a.image).slice(0, 30).map(a => ({
            id: a.url, title: a.title.slice(0, 500), url: a.url, image: a.image, source: a.source, published_at: a.publishedAt, lang: 'he', archived: false,
          }))
          if (rows.length) {
            const ir = await fetch(`${SUPA_URL}/rest/v1/news_articles?on_conflict=id`, {
              method: 'POST', body: JSON.stringify(rows), signal: AbortSignal.timeout(3000),
              headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
            })
            diag.log.push(`self-heal insert: ${ir.status}`)
          }
        } catch (e) { diag.log.push(`self-heal insert: ${e.message}`) }
      }
      return send([...articles.filter(a => a.image), ...articles.filter(a => !a.image)], 's-maxage=600, stale-while-revalidate=1800')
    }
    diag.log.push('0 live articles')
  } catch (e) { diag.log.push(`rss: ${e.message}`) }

  // ── 4. Legacy Render backend (filtered) ────────────────────────────────────
  try {
    const r = await fetch(`${RENDER}/api/news/feed`, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } })
    if (r.ok) {
      const ok = (await r.json()).filter?.(a => a?.title && scoreRealEstate(a.title, a.desc).ok) || []
      if (ok.length) { diag.path = 'render'; return send(ok, 's-maxage=600, stale-while-revalidate=1800') }
    }
  } catch (e) { diag.log.push(`render: ${e.message}`) }

  diag.path = 'none'
  if (debug) return res.status(200).json(diag)
  return res.status(502).json({ error: 'Could not load news' })
}
