// Vercel cron — daily ingest (runs BEFORE /api/cron/rotate — see vercel.json):
//   1. Fetches every source in lib/news/sources.js (direct RSS + Google News topics/sites)
//   2. Keeps only Hebrew real-estate articles (lib/news/classify.js) from the last 10 days
//   3. Caps each outlet so big publishers don't crowd out specialist sites, upserts to Supabase
//   4. Sweeps the last 45 days of stored rows through the same classifier and DELETES
//      anything off-topic — so the archive is real-estate-only too
//   5. Pings Render to keep the legacy server alive
//
// Requires: SUPABASE_URL + SUPABASE_SERVICE_KEY (Vercel env vars). Safe to call manually:
//   GET https://afikhanahal.co.il/api/cron/warm   → then   GET /api/cron/rotate

import { fetchAllSources, outletKey, outletCap, titleKey, cleanTitle, isTrustedSource, fetchOGImage, mapWithBudget } from '../../lib/news/sources.js'
import { scoreRealEstate } from '../../lib/news/classify.js'
import { resolveGoogleNewsUrl, isGoogleNewsUrl } from '../../lib/news/gnews.js'

const RENDER      = process.env.RENDER_URL   || 'https://afik-hanahal-server.onrender.com'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN  || 'AFIKhanahal2026'
const SUPA_URL    = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY    = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const INGEST_WINDOW_DAYS = 10   // how far back a freshly-seen article may be dated
const SWEEP_WINDOW_DAYS  = 45   // how far back the off-topic sweep looks
const POOL_PER_OUTLET    = 10   // rolling cap of non-featured articles per outlet (older → archived)

const supaHeaders = extra => ({ apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Accept: 'application/json', ...extra })

async function supaGet(params, limit = 1000) {
  const u = new URL(`${SUPA_URL}/rest/v1/news_articles`)
  params.forEach(([k, v]) => u.searchParams.append(k, v))
  u.searchParams.append('limit', String(limit))
  const r = await fetch(u, { headers: supaHeaders(), signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error(`Supabase GET ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`)
  return r.json()
}
// PostgREST `in.()` — values double-quoted so ids with commas/parens are safe
const inList = ids => `in.(${ids.map(id => `"${String(id).replace(/"/g, '')}"`).join(',')})`

async function supaPatchIds(ids, body) {
  for (let i = 0; i < ids.length; i += 50) {
    const u = new URL(`${SUPA_URL}/rest/v1/news_articles`)
    u.searchParams.set('id', inList(ids.slice(i, i + 50)))
    await fetch(u, { method: 'PATCH', headers: supaHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }).catch(() => {})
  }
}
async function supaDeleteIds(ids) {
  let n = 0
  for (let i = 0; i < ids.length; i += 50) {
    const u = new URL(`${SUPA_URL}/rest/v1/news_articles`)
    u.searchParams.set('id', inList(ids.slice(i, i + 50)))
    const r = await fetch(u, { method: 'DELETE', headers: supaHeaders({ Prefer: 'return=minimal' }), signal: AbortSignal.timeout(8000) }).catch(() => null)
    if (r?.ok) n += Math.min(50, ids.length - i)
  }
  return n
}

// ── 1-3. Ingest ───────────────────────────────────────────────────────────────
async function ingest(log) {
  const since = Date.now() - INGEST_WINDOW_DAYS * 864e5
  // hard 30s budget: the function must still have time to classify, insert and sweep inside maxDuration
  const all = await fetchAllSources({ timeoutMs: 8000, concurrency: 16, deadlineMs: 18000, log: m => log.push(`[fetch] ${m}`) })

  const rejected = {}
  const seen = new Set()
  const kept = []
  // direct feeds first so they win dedupe over Google News duplicates
  const ordered = [...all.filter(a => !a.gn), ...all.filter(a => a.gn)]
    .sort((a, b) => (b.gn ? 0 : 1) - (a.gn ? 0 : 1) || new Date(b.publishedAt) - new Date(a.publishedAt))
  for (const a of ordered) {
    if (new Date(a.publishedAt).getTime() < since) { rejected.old = (rejected.old || 0) + 1; continue }
    const title = cleanTitle(a.title, a.gn)
    const s = scoreRealEstate(title, a.desc, { trusted: a.trusted })
    if (!s.ok) { rejected[s.reason] = (rejected[s.reason] || 0) + 1; continue }
    const k = titleKey(title)
    if (seen.has(k)) { rejected.dup = (rejected.dup || 0) + 1; continue }
    seen.add(k)
    kept.push({ ...a, title, key: outletKey(a.url, a.source) })
  }

  // per-outlet cap for this run, newest first
  const counts = {}
  const balanced = kept
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .filter(a => { counts[a.key] = (counts[a.key] || 0) + 1; return counts[a.key] <= outletCap(a.key) })

  log.push(`[ingest] fetched=${all.length} kept=${kept.length} balanced=${balanced.length} rejected=${JSON.stringify(rejected)}`)
  if (!balanced.length) return { inserted: 0, outlets: [] }

  // Google News links are redirects with no image → resolve to the publisher URL, then og:image.
  // Bounded: 6 in parallel, 22 s in total; whatever doesn't finish keeps its GN link (and no image).
  const t1 = Date.now()
  const gnItems = balanced.filter(a => isGoogleNewsUrl(a.url))
  const resolved = await mapWithBudget(gnItems, a => resolveGoogleNewsUrl(a.url, { timeoutMs: 5000 }), { concurrency: 6, budgetMs: 14000 })
  let nRes = 0
  gnItems.forEach((a, i) => { if (resolved[i]) { a.url = resolved[i]; a.key = outletKey(a.url, a.source); nRes++ } })
  const needImg = balanced.filter(a => !a.image && !isGoogleNewsUrl(a.url))
  const imgs = await mapWithBudget(needImg, a => fetchOGImage(a.url, 3000), { concurrency: 8, budgetMs: Math.max(3000, 22000 - (Date.now() - t1)) })
  let nImg = 0
  needImg.forEach((a, i) => { if (imgs[i]) { a.image = imgs[i]; nImg++ } })
  log.push(`[ingest] google-news resolved ${nRes}/${gnItems.length}, og:image found ${nImg}/${needImg.length} (${Date.now() - t1} ms)`)

  // skip URLs we already have (the upsert below ignores duplicates too — this just keeps the payload small)
  let existing = new Set()
  try {
    const rows = await supaGet([['select', 'url'], ['lang', 'eq.he'], ['published_at', `gte.${new Date(since - 5 * 864e5).toISOString()}`]])
    existing = new Set(rows.map(r => r.url))
  } catch (e) { log.push(`[ingest] existing-url read failed: ${e.message}`) }

  const seenUrl = new Set()
  const rows = balanced.filter(a => !existing.has(a.url) && !seenUrl.has(a.url) && seenUrl.add(a.url)).map(a => ({
    id: a.url,                       // the table's id is the URL (NOT NULL, no default — Render's convention)
    title: a.title.slice(0, 500), url: a.url, image: a.image || null, source: a.source,
    published_at: a.publishedAt, lang: 'he', archived: false,
  }))
  if (!rows.length) return { inserted: 0, outlets: [], note: 'all already stored' }

  const r = await fetch(`${SUPA_URL}/rest/v1/news_articles?on_conflict=id`, {
    method: 'POST', headers: supaHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }),
    body: JSON.stringify(rows), signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) throw new Error(`insert ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`)
  const outlets = [...new Set(rows.map(a => outletKey(a.url, a.source)))]
  log.push(`[ingest] inserted=${rows.length} outlets=${outlets.length}: ${outlets.join(', ')}`)
  return { inserted: rows.length, withImage: rows.filter(a => a.image).length, outlets }
}

// ── 4. Sweep: delete off-topic rows, archive per-outlet overflow ──────────────
async function sweep(log) {
  const since = new Date(Date.now() - SWEEP_WINDOW_DAYS * 864e5).toISOString()
  const rows = await supaGet([['select', 'id,title,url,source,featured,archived,published_at'], ['lang', 'eq.he'],
    ['published_at', `gte.${since}`], ['order', 'published_at.desc']], 1000)

  // 4a. off-topic → delete (title only — stored rows have no description)
  const bad = rows.filter(r => !scoreRealEstate(r.title, '', { trusted: isTrustedSource(r.source) }).ok)
  const badIds = new Set(bad.map(r => r.id))
  const deleted = bad.length ? await supaDeleteIds(bad.map(r => r.id)) : 0
  if (bad.length) log.push(`[sweep] deleted ${deleted}/${bad.length} off-topic: ${bad.slice(0, 6).map(r => `${r.source}: ${r.title.slice(0, 40)}`).join(' | ')}`)

  // 4b. same story stored twice (direct + GN) → keep the first (newest), delete the rest
  const seen = new Set(); const dups = []
  for (const r of rows) {
    if (badIds.has(r.id)) continue
    const k = titleKey(r.title)
    if (seen.has(k) && !r.featured) dups.push(r.id); else seen.add(k)
  }
  const dupDeleted = dups.length ? await supaDeleteIds(dups) : 0
  if (dups.length) log.push(`[sweep] deleted ${dupDeleted} duplicate titles`)

  // 4c. rolling pool cap per outlet — archive the oldest non-featured beyond POOL_PER_OUTLET
  const dupIds = new Set(dups)
  const live = rows.filter(r => !badIds.has(r.id) && !dupIds.has(r.id) && !r.archived && !r.featured)
  const byOutlet = {}
  live.forEach(r => { const k = outletKey(r.url, r.source); (byOutlet[k] ||= []).push(r) })
  const overflow = Object.values(byOutlet).flatMap(list => list.slice(POOL_PER_OUTLET).map(r => r.id))
  if (overflow.length) { await supaPatchIds(overflow, { archived: true }); log.push(`[sweep] archived ${overflow.length} overflow rows`) }

  const featuredBad = bad.filter(r => r.featured).length
  return { scanned: rows.length, deleted, dupDeleted, archived: overflow.length, featuredDeleted: featuredBad }
}


// Optional protection: when CRON_SECRET is set in Vercel, only Vercel Cron (Authorization: Bearer)
// or a manual call with ?key=<secret> may run this. Unset → open, as before.
function authorized(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const bearer = (req.headers?.authorization || '').replace(/^Bearer\s+/i, '')
  let key = ''
  try { key = new URL(req.url, 'http://x').searchParams.get('key') || '' } catch {}
  return bearer === secret || key === secret
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' })

  // keep the legacy Render server warm (non-blocking)
  fetch(`${RENDER}/api/news/rebuild`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
    signal: AbortSignal.timeout(10000) }).catch(() => {})

  if (!SUPA_URL || !SUPA_KEY) return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not set' })

  const log = []
  const out = { ok: true, ts: new Date().toISOString() }
  try { out.ingest = await ingest(log) } catch (e) { out.ingest = { error: e.message }; log.push(`[ingest] ERROR ${e.message}`) }
  try { out.sweep  = await sweep(log)  } catch (e) { out.sweep  = { error: e.message }; log.push(`[sweep] ERROR ${e.message}`) }
  log.forEach(l => console.log('[warm]', l))
  out.log = log.filter(l => !l.startsWith('[fetch]')).concat(log.filter(l => l.startsWith('[fetch]')).slice(0, 80))
  return res.status(200).json(out)
}
