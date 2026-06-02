// Vercel cron — daily morning rotation of the 4 featured news articles.
// Runs 06:05 UTC = 09:05 Israel time (IDT, summer).  schedule: "5 6 * * *"
//
// What it does:
//   1. Reads the 4 currently "featured" articles from Supabase (oldest first).
//   2. Un-features the 2 oldest  → they "move to archive" (still in archive modal).
//   3. Features the 2 newest non-featured articles with images.
//
// Requires in Vercel env vars: SUPABASE_URL + SUPABASE_SERVICE_KEY
//
// One-time SQL migration (run ONCE in Supabase SQL editor):
//   ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

// Supabase GET — params is an array of [key, value] pairs (allows duplicate keys)
async function supaGet(table, params = []) {
  const url = new URL(`${SUPA_URL}/rest/v1/${table}`)
  params.forEach(([k, v]) => url.searchParams.append(k, v))
  const r = await fetch(url.toString(), {
    headers: {
      apikey:        SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      Accept:        'application/json',
    },
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`Supabase GET ${r.status}: ${t.slice(0, 200)}`)
  }
  return r.json()
}

// Supabase PATCH by exact article ID (handles arbitrary URL strings safely)
async function patchById(id, body) {
  const url = new URL(`${SUPA_URL}/rest/v1/news_articles`)
  url.searchParams.set('id', `eq.${id}`)
  const r = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      apikey:         SUPA_KEY,
      Authorization:  `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    console.warn(`[rotate] PATCH failed for ${id.slice(0, 60)}: ${r.status} ${t.slice(0, 100)}`)
  }
  return r.ok
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({
      error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not set in Vercel env vars',
    })
  }

  try {
    // ── 1. Get currently featured articles (oldest first → will be un-featured) ──
    let featured = []
    try {
      featured = await supaGet('news_articles', [
        ['select', 'id,title,source,published_at'],
        ['lang',   'eq.he'],
        ['featured', 'eq.true'],
        ['order',  'published_at.asc'],
        ['limit',  '10'],
      ])
    } catch (e) {
      if (e.message.includes('42703') || e.message.toLowerCase().includes('featured')) {
        return res.status(500).json({
          error: 'featured column missing — run this SQL in Supabase: ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;',
        })
      }
      throw e
    }

    // ── 2. Initialize: if fewer than 4 are featured, seed them from the latest ──
    if (!featured || featured.length < 4) {
      const needed   = 4 - (featured?.length || 0)
      const existing = new Set((featured || []).map(a => a.id))

      const candidates = await supaGet('news_articles', [
        ['select',   'id,title,source,published_at'],
        ['lang',     'eq.he'],
        ['archived', 'eq.false'],
        ['featured', 'eq.false'],
        ['image',    'not.is.null'],    // must have image — two filters on same column:
        ['image',    'neq.'],           // URLSearchParams.append keeps both as AND
        ['order',    'published_at.desc'],
        ['limit',    '20'],
      ])

      const toInit = (candidates || [])
        .filter(a => !existing.has(a.id))
        .slice(0, needed)

      await Promise.all(toInit.map(a => patchById(a.id, { featured: true })))

      console.log(`[rotate] initialized ${toInit.length} featured articles`)
      return res.status(200).json({
        ok:       true,
        action:   'initialized',
        count:    toInit.length,
        articles: toInit.map(a => ({ title: a.title?.slice(0, 60), source: a.source })),
      })
    }

    // ── 3. Un-feature the 2 oldest (they "move to archive" in the UI) ───────────
    const toUnfeature = featured.slice(0, 2)
    await Promise.all(toUnfeature.map(a => patchById(a.id, { featured: false })))

    // ── 4. Find 2 articles with max source diversity ─────────────────────────────
    const keepIds     = new Set(featured.slice(2).map(a => a.id))
    const keptSources = new Set(featured.slice(2).map(a => a.source))

    // Fetch a wide pool (100) so we have choices across many outlets
    const pool = await supaGet('news_articles', [
      ['select',   'id,title,source,published_at'],
      ['lang',     'eq.he'],
      ['archived', 'eq.false'],
      ['featured', 'eq.false'],
      ['image',    'not.is.null'],
      ['image',    'neq.'],
      ['order',    'published_at.desc'],
      ['limit',    '100'],
    ])

    const available = (pool || []).filter(a => !keepIds.has(a.id))

    // Sort: articles from sources NOT already shown get priority; then newest
    available.sort((a, b) => {
      const aNew = keptSources.has(a.source) ? 0 : 1
      const bNew = keptSources.has(b.source) ? 0 : 1
      if (aNew !== bNew) return bNew - aNew
      return new Date(b.published_at) - new Date(a.published_at)
    })

    // Pick 2 from different sources for maximum variety
    const fresh = []
    const pickedSrc = new Set()
    for (const a of available) {
      if (fresh.length >= 2) break
      if (!pickedSrc.has(a.source)) { fresh.push(a); pickedSrc.add(a.source) }
    }
    // Fallback: fill remaining slots if diversity wasn't possible
    if (fresh.length < 2) {
      for (const a of available) {
        if (fresh.length >= 2) break
        if (!fresh.some(f => f.id === a.id)) fresh.push(a)
      }
    }

    if (fresh.length === 0) {
      return res.status(200).json({
        ok:        true,
        note:      'no new articles available yet — feed rebuilds every 2h via /api/cron/warm',
        unfeature: toUnfeature.map(a => a.title?.slice(0, 60)),
      })
    }

    // ── 5. Feature the 2 new articles ────────────────────────────────────────────
    await Promise.all(fresh.map(a => patchById(a.id, { featured: true })))

    console.log('[rotate] un-featured:', toUnfeature.map(a => `${a.source}: ${a.title?.slice(0, 40)}`))
    console.log('[rotate] featured:   ', fresh.map(a => `${a.source}: ${a.title?.slice(0, 40)}`))

    return res.status(200).json({
      ok:        true,
      action:    'rotated',
      unfeature: toUnfeature.map(a => ({ title: a.title?.slice(0, 60), source: a.source })),
      featured:  fresh.map(a =>       ({ title: a.title?.slice(0, 60), source: a.source })),
      ts:        new Date().toISOString(),
    })
  } catch (e) {
    console.error('[rotate] error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
