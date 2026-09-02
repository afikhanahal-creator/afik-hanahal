// Vercel cron — daily rotation of the 4 featured articles (runs AFTER /api/cron/warm — see vercel.json).
//   1. Reads the currently featured articles (oldest first).
//   2. Verifies each is still real-estate (lib/news/classify.js) — anything off-topic is dropped.
//   3. Un-features the 2 oldest → they move to the archive.
//   4. Features 2 fresh articles, each from an outlet NOT already on the board, newest first.
//   Result: 4 cards, 4 different outlets, 2 of them new every morning.
//
// Requires: SUPABASE_URL + SUPABASE_SERVICE_KEY. One-time migration (already applied):
//   ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

import { outletKey } from '../../lib/news/sources.js'
import { scoreRealEstate } from '../../lib/news/classify.js'

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const BOARD_SIZE   = 4    // cards on the homepage
const ROTATE_DAILY = 2    // how many of them change each morning
const MAX_AGE_DAYS = 14   // never feature anything older than this

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' }
const headers = extra => ({ apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Accept: 'application/json', ...extra })

async function supaGet(params) {
  const u = new URL(`${SUPA_URL}/rest/v1/news_articles`)
  params.forEach(([k, v]) => u.searchParams.append(k, v))
  const r = await fetch(u, { headers: headers(), signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`Supabase GET ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  return r.json()
}
async function setFeatured(ids, featured) {
  await Promise.all(ids.map(async id => {
    const u = new URL(`${SUPA_URL}/rest/v1/news_articles`)
    u.searchParams.set('id', `eq.${id}`)
    const r = await fetch(u, { method: 'PATCH', headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify({ featured }), signal: AbortSignal.timeout(8000) })
    if (!r.ok) console.warn(`[rotate] PATCH ${id.slice(0, 60)} → ${r.status}`)
  }))
}
const brief = a => ({ title: a.title?.slice(0, 60), source: a.source, outlet: outletKey(a.url, a.source), published_at: a.published_at })

// Pick `n` candidates, newest first, each from an outlet not in `usedOutlets` (falls back to any outlet).
function pickDiverse(pool, n, usedOutlets) {
  const used = new Set(usedOutlets), picked = []
  const sorted = [...pool].sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
  for (const a of sorted) {
    if (picked.length >= n) break
    const k = outletKey(a.url, a.source)
    if (!used.has(k)) { picked.push(a); used.add(k) }
  }
  for (const a of sorted) {
    if (picked.length >= n) break
    if (!picked.includes(a)) picked.push(a)
  }
  return picked
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
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!authorized(req)) return res.status(401).json({ error: 'unauthorized' })
  if (!SUPA_URL || !SUPA_KEY) return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not set in Vercel env vars' })

  try {
    const sel = ['select', 'id,title,url,source,published_at,featured']

    // ── 1+2. current board, verified ──────────────────────────────────────────
    let featured
    try {
      featured = await supaGet([sel, ['lang', 'eq.he'], ['featured', 'eq.true'], ['order', 'published_at.asc'], ['limit', '10']])
    } catch (e) {
      if (e.message.includes('42703') || e.message.toLowerCase().includes('featured'))
        return res.status(500).json({ error: 'featured column missing — run: ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;' })
      throw e
    }
    const offTopic = featured.filter(a => !scoreRealEstate(a.title).ok)
    if (offTopic.length) await setFeatured(offTopic.map(a => a.id), false)
    featured = featured.filter(a => !offTopic.includes(a))

    // ── 3. retire the oldest (only when the board is full) ────────────────────
    const retire = featured.length >= BOARD_SIZE ? featured.slice(0, ROTATE_DAILY) : []
    if (retire.length) await setFeatured(retire.map(a => a.id), false)
    const keep = featured.filter(a => !retire.includes(a))

    // ── 4. fill the empty slots with fresh, diverse, verified articles ────────
    const need = BOARD_SIZE - keep.length
    const minDate = new Date(Date.now() - MAX_AGE_DAYS * 864e5).toISOString()
    const pool = (await supaGet([sel, ['lang', 'eq.he'], ['archived', 'eq.false'], ['featured', 'eq.false'],
      ['image', 'not.is.null'], ['image', 'neq.'], ['published_at', `gte.${minDate}`], ['order', 'published_at.desc'], ['limit', '150']]))
      .filter(a => !keep.some(k => k.id === a.id))
      .filter(a => scoreRealEstate(a.title).ok)
      .filter(a => !retire.some(r => r.id === a.id))   // don't immediately re-feature what we just retired

    const fresh = pickDiverse(pool, need, keep.map(a => outletKey(a.url, a.source)))
    if (fresh.length) await setFeatured(fresh.map(a => a.id), true)

    // if the pool couldn't fill the board, put retired ones back rather than show fewer than 4
    const short = need - fresh.length
    const restored = short > 0 ? retire.slice(-short) : []
    if (restored.length) await setFeatured(restored.map(a => a.id), true)

    const board = [...keep, ...fresh, ...restored]
    console.log('[rotate] board:', board.map(a => `${outletKey(a.url, a.source)}: ${a.title?.slice(0, 40)}`))
    return res.status(200).json({
      ok: true, ts: new Date().toISOString(),
      action: retire.length ? 'rotated' : 'filled',
      poolSize: pool.length,
      droppedOffTopic: offTopic.map(brief),
      retired: retire.filter(a => !restored.includes(a)).map(brief),
      featured: fresh.map(brief),
      board: board.map(brief),
      note: short > 0 && restored.length ? `pool too small — restored ${restored.length} retired article(s); run /api/cron/warm` : undefined,
    })
  } catch (e) {
    console.error('[rotate] error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
