// Public property list, fast and always available.
// The list lives on the Render backend, which sleeps on the free tier: a cold start takes 30–60 s,
// longer than a visitor (or Facebook's / WhatsApp's link-preview crawler) will wait. So every good
// answer from Render is also kept as a snapshot in Supabase (app_settings, key 'public_properties'),
// and when Render doesn't answer within a short budget the snapshot is served instead — the request
// still reaches Render and wakes it, so the next visitor gets fresh data.
// If Render is down for longer (suspended, crashed), the snapshot is all the site has — so the admin
// panel can also push its own copy of the list (pushSnapshot), and health() says which source is live.
// Bandwidth: Render's free tier includes 5 GB/month, and this feed used to download the whole list on
// every edge miss. Now the snapshot keeps Render's ETag and every request is conditional — an unchanged
// list costs a 304 and ~0 bytes. The snapshot lives in app_settings, or site_config when that table
// doesn't exist (site_config is created by the Render server itself).
import { createHash } from 'crypto'

export const SNAPSHOT_KEY = 'public_properties'

export const findPublished = (list, id) =>
  (Array.isArray(list) ? list : []).find(p => p && String(p.id) === String(id) && p.published !== false) || null

const hashOf = body => createHash('sha1').update(body).digest('hex').slice(0, 24)

export function createFeed({
  renderUrl, supaUrl, supaKey, fetchImpl = fetch,
  renderBudgetMs = 2500,        // how long a visitor waits for Render before getting the snapshot
  renderTimeoutMs = 12000,      // how long we wait for Render when there is no snapshot at all
  snapshotTtlMs = 60000,        // in-memory reuse of the snapshot on a warm instance
} = {}) {
  const supaOk = !!(supaUrl && supaKey)
  const supaHeaders = extra => ({ apikey: supaKey, Authorization: `Bearer ${supaKey}`, Accept: 'application/json', ...extra })
  let memo = null               // { at, list, hash, etag, fetchedAt }
  let savedHash = null
  const TABLES = ['app_settings', 'site_config']
  let storeTable = null         // the table that answered last (both have key / value / updated_at)
  let storeError = null

  async function readRow(table, select) {
    const r = await fetchImpl(`${supaUrl}/rest/v1/${table}?key=eq.${SNAPSHOT_KEY}&select=${select}`, { headers: supaHeaders(), signal: AbortSignal.timeout(4000) })
    if (!r.ok) { const e = new Error(`${table}: HTTP ${r.status}`); e.status = r.status; throw e }
    return r.json()
  }
  // Read from the known table, else try each in turn (a missing table answers 404 / PGRST205)
  async function readSnapshotRows(select) {
    const order = storeTable ? [storeTable, ...TABLES.filter(t => t !== storeTable)] : TABLES
    let lastErr = null
    for (const table of order) {
      try { const rows = await readRow(table, select); storeTable = table; storeError = null; return rows }
      catch (e) { lastErr = e; if (e.status !== 404 && e.status !== 400) break }
    }
    storeError = lastErr ? lastErr.message : null
    return null
  }

  async function getSnapshot() {
    if (!supaOk) return null
    if (memo && Date.now() - memo.fetchedAt < snapshotTtlMs) return memo
    const rows = await readSnapshotRows('value')
    const v = rows && rows[0] && rows[0].value
    if (!v || !Array.isArray(v.list) || !v.list.length) return null
    memo = { at: v.at, list: v.list, hash: v.hash, etag: v.etag || null, fetchedAt: Date.now() }
    if (v.hash) savedHash = savedHash || v.hash
    return memo
  }

  // Store Render's list — only when it changed (a hash check first, so an unchanged list costs one tiny read)
  async function saveSnapshot(list, body, etag = null) {
    if (!supaOk || !Array.isArray(list) || !list.length) return false
    const hash = hashOf(body || JSON.stringify(list))
    if (hash === savedHash && (!etag || (memo && memo.etag === etag))) return false
    try {
      const rows = await readSnapshotRows('hash:value->>hash,etag:value->>etag')
      if (rows && rows[0] && rows[0].hash === hash && (!etag || rows[0].etag === etag)) { savedHash = hash; if (memo) memo.etag = etag || memo.etag; return false }
      const at = new Date().toISOString()
      const order = storeTable ? [storeTable, ...TABLES.filter(t => t !== storeTable)] : TABLES
      for (const table of order) {
        const w = await fetchImpl(`${supaUrl}/rest/v1/${table}?on_conflict=key`, {
          method: 'POST',
          headers: supaHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify({ key: SNAPSHOT_KEY, value: { hash, at, etag, list }, updated_at: at }),
          signal: AbortSignal.timeout(4000),
        }).catch(() => null)
        if (w && w.ok) { storeTable = table; storeError = null; savedHash = hash; memo = { at, list, hash, etag, fetchedAt: Date.now() }; return true }
        if (w && w.status !== 404 && w.status !== 400) { storeError = `${table}: HTTP ${w.status}`; break }
        storeError = w ? `${table}: HTTP ${w.status}` : `${table}: unreachable`
      }
    } catch (e) { storeError = e.message }
    return false
  }

  // etag: the snapshot's copy of Render's ETag → conditional request; an unchanged list answers 304 (no body)
  function fetchRender(timeoutMs = renderTimeoutMs, etag = null) {
    return fetchImpl(`${renderUrl}/api/properties`, { headers: etag ? { 'If-None-Match': etag } : {}, signal: AbortSignal.timeout(timeoutMs) }).then(async r => {
      if (r.status === 304 && etag) return { notModified: true, etag }
      if (!r.ok) {
        const routing = (r.headers && typeof r.headers.get === 'function' && r.headers.get('x-render-routing')) || ''
        const e = new Error(`Render ${r.status}${routing ? ` (${routing})` : ''}`)
        e.status = r.status; e.routing = routing
        throw e
      }
      const body = await r.text()
      const list = JSON.parse(body)
      if (!Array.isArray(list)) throw new Error('Render: not a list')
      return { list, body, etag: (r.headers && typeof r.headers.get === 'function' && r.headers.get('etag')) || null }
    })
  }

  // The list published with the last deploy (dist/properties.json, see scripts/build-properties.mjs)
  async function getStatic(staticUrl) {
    if (!staticUrl) return null
    const r = await fetchImpl(staticUrl, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) })
    if (!r.ok) return null
    const list = await r.json()
    return Array.isArray(list) && list.length ? list : null
  }

  // → { source: 'render' | 'snapshot' | 'static', list, at?, ms }
  // staticUrl: optional last-resort source (the deploy-time list) when Render is slow and there is no snapshot
  async function getList({ staticUrl } = {}) {
    const t0 = Date.now()
    // The snapshot's ETag makes the Render request conditional. A warm instance has it in memory; a cold
    // one waits briefly for the store (a slow store never delays the visitor — the request just goes out plain).
    let snap = memo && Date.now() - memo.fetchedAt < snapshotTtlMs ? memo : null
    const snapP = snap ? Promise.resolve(snap) : getSnapshot().catch(() => null)
    if (!snap) { let t; snap = await Promise.race([snapP, new Promise(r => { t = setTimeout(() => r(null), 400) })]); clearTimeout(t) }
    const etag = snap && snap.etag ? snap.etag : null
    const render = fetchRender(renderTimeoutMs, etag)
    const settled = render.then(v => ({ ok: true, ...v }), e => ({ ok: false, error: e }))
    let budgetTimer
    const budget = new Promise(r => { budgetTimer = setTimeout(() => r(null), renderBudgetMs) })
    const first = await Promise.race([settled, budget])
    clearTimeout(budgetTimer)
    if (first && first.ok) {
      if (first.notModified) return { source: 'render', list: snap.list, at: snap.at, ms: Date.now() - t0, notModified: true }
      await saveSnapshot(first.list, first.body, first.etag)
      return { source: 'render', list: first.list, ms: Date.now() - t0 }
    }
    // Render is slow (asleep) or failing: the snapshot answers now
    snap = snap || await snapP
    if (snap) return { source: 'snapshot', list: snap.list, at: snap.at, ms: Date.now() - t0 }
    const stat = await getStatic(staticUrl).catch(() => null)
    if (stat) return { source: 'static', list: stat, ms: Date.now() - t0 }
    // No snapshot yet (first run): nothing to do but wait for Render
    const last = await settled
    if (!last.ok) throw last.error
    if (last.notModified) return { source: 'render', list: snap.list, at: snap.at, ms: Date.now() - t0, notModified: true }
    await saveSnapshot(last.list, last.body, last.etag)
    return { source: 'render', list: last.list, ms: Date.now() - t0 }
  }

  // One published property: the snapshot first (≈ instant), the live list only if it isn't there
  // (e.g. published a minute ago)
  // fast: also try the deploy-time list before waiting on Render (a page that must paint now — the
  // live data is re-checked by the page itself); otherwise freshness first
  async function getOne(id, { staticUrl, fast = false } = {}) {
    const snap = await getSnapshot().catch(() => null)
    const hit = snap && findPublished(snap.list, id)
    if (hit) return { source: 'snapshot', property: hit }
    if (fast) {
      const stat = await getStatic(staticUrl).catch(() => null)
      const sHit = stat && findPublished(stat, id)
      if (sHit) return { source: 'static', property: sHit }
    }
    try {
      const { source, list } = await getList({ staticUrl })
      const found = findPublished(list, id)
      if (found || source !== 'static') return { source, property: found }
    } catch {}
    const stat = await getStatic(staticUrl).catch(() => null)
    return { source: 'static', property: stat ? findPublished(stat, id) : null }
  }

  // The admin panel's own copy of the list (it keeps one even when Render is down). Stored only when
  // Render can't answer for itself within a few seconds — while Render is up, Render's list is the truth.
  // → { saved, source: 'render' | 'admin' | 'none', count, reason? }
  async function pushSnapshot(list, { budgetMs = 4000 } = {}) {
    const clean = Array.isArray(list) ? list.filter(p => p && typeof p === 'object' && p.id != null && p.published !== false) : []
    if (!clean.length) return { saved: false, source: 'none', count: 0, reason: 'empty' }
    if (!supaOk) return { saved: false, source: 'none', count: clean.length, reason: 'no snapshot store (SUPABASE_URL / SUPABASE_SERVICE_KEY)' }
    try {
      const live = await fetchRender(budgetMs)
      const saved = await saveSnapshot(live.list, live.body, live.etag)
      return { saved, source: 'render', count: live.list.length, reason: saved ? undefined : 'unchanged' }
    } catch (e) {
      const body = JSON.stringify(clean)
      const saved = await saveSnapshot(clean, body)
      return { saved, source: 'admin', count: clean.length, reason: saved ? undefined : 'unchanged or store unavailable', render: e.message }
    }
  }

  // Where the public list comes from right now — for the admin panel and the outside probe (no secrets)
  async function health({ staticUrl, budgetMs = 6000 } = {}) {
    const t0 = Date.now()
    const out = { supabase: supaOk, render: null, snapshot: null, static: null, store: null, serving: 'none' }
    let timer
    const render = Promise.race([
      fetchRender(budgetMs).then(v => ({ ok: true, count: v.list.length, ms: Date.now() - t0 }), e => ({ ok: false, error: e.message, status: e.status || null, routing: e.routing || (/abort|timeout/i.test(e.message) ? 'timeout' : ''), ms: Date.now() - t0 })),
      new Promise(r => { timer = setTimeout(() => r({ ok: false, error: 'no answer', status: null, routing: 'timeout', ms: budgetMs }), budgetMs + 100) }),
    ]).finally(() => clearTimeout(timer))
    const snap = getSnapshot().then(s => (s ? { at: s.at, count: s.list.length, etag: !!s.etag } : null), e => ({ error: e.message }))
    const stat = getStatic(staticUrl).then(l => (l ? { count: l.length } : null), () => null)
    ;[out.render, out.snapshot, out.static] = await Promise.all([render, snap, stat])
    out.store = supaOk ? { table: storeTable, error: storeError } : null
    out.serving = out.render.ok ? 'render' : out.snapshot && out.snapshot.count ? 'snapshot' : out.static ? 'static' : 'none'
    return out
  }

  return { getList, getOne, getSnapshot, saveSnapshot, getStatic, pushSnapshot, health }
}
