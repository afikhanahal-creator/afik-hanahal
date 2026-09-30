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
// Source of truth: the `properties` table itself (lib/property-store.js). Render keeps the list in RAM and its
// own write to that table has been failing silently, so the table is filled from this side — every admin save
// and intake publish goes into it through Vercel, and reconcile() copies whatever Render / the snapshot still
// has that the table lacks. The public list is read from the table first (fast, no Render bandwidth at all);
// Render → snapshot → static remain the fallbacks when the table is unreachable or empty.
import { createHash } from 'crypto'
import { createStore } from './property-store.js'

export const SNAPSHOT_KEY = 'public_properties'

export const findPublished = (list, id) =>
  (Array.isArray(list) ? list : []).find(p => p && String(p.id) === String(id) && p.published !== false) || null

const hashOf = body => createHash('sha1').update(body).digest('hex').slice(0, 24)

export function createFeed({
  renderUrl, supaUrl, supaKey, fetchImpl = fetch,
  renderBudgetMs = 2500,        // how long a visitor waits for Render before getting the snapshot
  renderTimeoutMs = 12000,      // how long we wait for Render when there is no snapshot at all
  snapshotTtlMs = 60000,        // in-memory reuse of the snapshot on a warm instance
  tableTimeoutMs = 3000,        // how long a visitor waits for the properties table before the fallbacks
  transformList = null,         // async list → list, applied before a list is stored (e.g. move inline photos out)
} = {}) {
  const supaOk = !!(supaUrl && supaKey)
  const store = createStore({ supaUrl, supaKey, fetchImpl })
  let tableState = null         // { ok, count, at, ms } | { ok: false, error, at } — the last table read (health)
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

  // Bandwidth meter: every byte Render sends to this feed (bodies + ~300 B of headers per answer), kept per
  // month in the store (key 'render_traffic'). Flushed at most once a minute per instance, and right after a
  // full body — a 304 costs nothing worth a write of its own. Best-effort: never blocks or fails a request.
  const TRAFFIC_KEY = 'render_traffic'
  const pending = { bytes: 0, requests: 0, notModified: 0 }
  let lastFlush = 0, flushing = null
  const monthKey = () => new Date().toISOString().slice(0, 7)
  function meter(bytes, notModified) {
    pending.bytes += bytes + 300; pending.requests += 1; if (notModified) pending.notModified += 1
    const due = Date.now() - lastFlush > 60000 || (!notModified && bytes > 0)
    if (due && supaOk) flushTraffic().catch(() => {})
  }
  async function readTraffic() {
    const table = storeTable || TABLES[0]
    const r = await fetchImpl(`${supaUrl}/rest/v1/${table}?key=eq.${TRAFFIC_KEY}&select=value`, { headers: supaHeaders(), signal: AbortSignal.timeout(4000) })
    const rows = r.ok ? await r.json() : []
    const v = rows && rows[0] && rows[0].value
    return v && typeof v === 'object' ? v : {}
  }
  async function flushTraffic() {
    if (flushing) return flushing
    if (!pending.requests) return null
    flushing = (async () => {
      const add = { ...pending }; pending.bytes = 0; pending.requests = 0; pending.notModified = 0
      lastFlush = Date.now()
      try {
        const all = await readTraffic()
        const m = monthKey(), cur = all[m] || { bytes: 0, requests: 0, notModified: 0 }
        const next = { bytes: cur.bytes + add.bytes, requests: cur.requests + add.requests, notModified: cur.notModified + add.notModified }
        const months = Object.keys(all).filter(k => /^\d{4}-\d{2}$/.test(k)).sort().slice(-5)
        const value = Object.fromEntries(months.map(k => [k, all[k]]))
        value[m] = next
        const table = storeTable || TABLES[0]
        await fetchImpl(`${supaUrl}/rest/v1/${table}?on_conflict=key`, {
          method: 'POST', headers: supaHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
          body: JSON.stringify({ key: TRAFFIC_KEY, value, updated_at: new Date().toISOString() }), signal: AbortSignal.timeout(4000),
        })
      } catch { pending.bytes += add.bytes; pending.requests += add.requests; pending.notModified += add.notModified }
      finally { flushing = null }
    })()
    return flushing
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
      if (transformList) { try { list = (await transformList(list)) || list } catch {} }
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
      if (r.status === 304 && etag) { meter(0, true); return { notModified: true, etag } }
      if (!r.ok) {
        const routing = (r.headers && typeof r.headers.get === 'function' && r.headers.get('x-render-routing')) || ''
        meter(0, false)
        const e = new Error(`Render ${r.status}${routing ? ` (${routing})` : ''}`)
        e.status = r.status; e.routing = routing
        throw e
      }
      const body = await r.text()
      meter(Buffer.byteLength(body), false)
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
    // 1. The properties table — the durable list (see lib/property-store.js). A warm instance reuses it briefly.
    if (memo && memo.source === 'table' && Date.now() - memo.fetchedAt < snapshotTtlMs) return { source: 'table', list: memo.list, at: memo.at, ms: Date.now() - t0 }
    let table = await readTable(tableTimeoutMs)
    if (table) {
      // A snapshot holding published properties the table lacks (Render's memory-only ones, the admin's copy) is
      // never thrown away: they go into the table first, and the table is read again
      const snap0 = memo && memo.list ? memo : await getSnapshot().catch(() => null)
      const have = new Set(table.map(p => String(p.id)))
      const lost = snap0 && Array.isArray(snap0.list) ? snap0.list.filter(p => p && p.id != null && p.published !== false && !have.has(String(p.id))) : []
      if (lost.length) { try { const r = await store.addMissing(lost); if (r.added.length) table = (await readTable(tableTimeoutMs)) || table } catch {} }
      const body = JSON.stringify(table)
      const snapEtag = memo && memo.etag ? memo.etag : null
      await saveSnapshot(table, body, snapEtag)
      const list = await storedFor(table, body)
      memo = { at: (memo && memo.hash === hashOf(body) && memo.at) || new Date().toISOString(), list, hash: hashOf(body), etag: snapEtag, fetchedAt: Date.now(), source: 'table' }
      return { source: 'table', list, at: memo.at, ms: Date.now() - t0 }
    }
    // 2. Render, then the snapshot / the deploy-time list (the table is unreachable or empty)
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
      return { source: 'render', list: await storedFor(first.list, first.body), ms: Date.now() - t0 }
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
    return { source: 'render', list: await storedFor(last.list, last.body), ms: Date.now() - t0 }
  }

  // The published rows of the properties table, or null when the table can't answer / is empty (tableState says why)
  async function readTable(timeout) {
    if (!store.ok) return null
    const t0 = Date.now()
    try {
      const rows = await store.list({ publishedOnly: true, timeout })
      tableState = { ok: !!(rows && rows.length), count: rows ? rows.length : 0, at: new Date().toISOString(), ms: Date.now() - t0, error: rows && rows.length ? undefined : 'empty' }
      return rows && rows.length ? rows : null
    } catch (e) {
      tableState = { ok: false, error: e.message, at: new Date().toISOString(), ms: Date.now() - t0 }
      return null
    }
  }

  // Every property in the table, hidden ones included — the admin panel's list while Render is down
  async function getAll({ timeout = 8000 } = {}) {
    if (!store.ok) return null
    const rows = await store.list({ timeout })
    return rows && rows.length ? rows : null
  }

  // Copy into the table whatever it lacks: Render's list when Render answers (conditional — an unchanged list is
  // the snapshot), else the stored snapshot (the last list the site served). Never overwrites a row. Called after
  // every change (lib/site-rebuild.js), daily (api/cron/warm.js) and at deploy time — never by a visitor.
  // → { table, render | snapshot, added: [ids] }
  async function reconcile({ renderTimeout = renderTimeoutMs } = {}) {
    if (!store.ok) return { skipped: 'no store' }
    const out = { table: null, render: null, snapshot: null, added: [] }
    const snap = await getSnapshot().catch(() => null)
    let live = null
    try {
      const r = await fetchRender(renderTimeout, snap && snap.etag ? snap.etag : null)
      live = r.notModified ? snap.list : r.list
      out.render = live.length
    } catch (e) { out.renderError = e.message }
    const from = live || (snap ? snap.list : null)
    if (!live && snap) out.snapshot = snap.list.length
    if (!from) return out
    try {
      const r = await store.addMissing(from)
      out.added = r.added
      out.table = (await store.ids()).size
    } catch (e) { out.error = e.message }
    if (out.added.length) memo = null
    return out
  }

  // Render's list as stored (i.e. after transformList) when the store holds this exact version, else as it came
  async function storedFor(list, body) {
    if (!transformList) return list
    const h = hashOf(body || JSON.stringify(list))
    if (memo && memo.hash === h) return memo.list
    const s = await getSnapshot().catch(() => null)
    return s && s.hash === h ? s.list : ((await transformList(list).catch(() => null)) || list)
  }

  // Apply transformList to the list already in the store (a snapshot written before the transform existed)
  async function cleanSnapshot() {
    if (!transformList || !supaOk) return { changed: false }
    memo = null
    const s = await getSnapshot().catch(() => null)
    if (!s) return { changed: false, reason: 'no snapshot' }
    const before = JSON.stringify(s.list)
    const next = await transformList(s.list)
    if (!next || JSON.stringify(next) === before) return { changed: false }
    const at = new Date().toISOString()
    const w = await fetchImpl(`${supaUrl}/rest/v1/${storeTable || TABLES[0]}?on_conflict=key`, {
      method: 'POST', headers: supaHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ key: SNAPSHOT_KEY, value: { hash: s.hash, at, etag: s.etag || null, list: next }, updated_at: at }), signal: AbortSignal.timeout(6000),
    }).catch(() => null)
    if (!w || !w.ok) return { changed: false, reason: `write ${w ? w.status : 'failed'}` }
    memo = { at, list: next, hash: s.hash, etag: s.etag || null, fetchedAt: Date.now() }
    return { changed: true, bytesBefore: before.length, bytesAfter: JSON.stringify(next).length }
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
    // Whatever the admin has that the properties table lacks goes into the table first — the durable copy the site reads
    let added = []
    try { added = (await store.addMissing(clean)).added; if (added.length) memo = null } catch {}
    try {
      const live = await fetchRender(budgetMs)
      const saved = await saveSnapshot(live.list, live.body, live.etag)
      return { saved, source: 'render', count: live.list.length, reason: saved ? undefined : 'unchanged', added }
    } catch (e) {
      const body = JSON.stringify(clean)
      const saved = await saveSnapshot(clean, body)
      return { saved, source: 'admin', count: clean.length, reason: saved ? undefined : 'unchanged or store unavailable', render: e.message, added }
    }
  }

  // Where the public list comes from right now — for the admin panel and the outside probe (no secrets)
  async function health({ staticUrl, budgetMs = 6000 } = {}) {
    const t0 = Date.now()
    const out = { supabase: supaOk, render: null, snapshot: null, static: null, store: null, serving: 'none' }
    // The snapshot first: its ETag makes the Render check conditional (a health check must not download the list)
    const snapObj = await getSnapshot().catch(() => null)
    const snap = Promise.resolve(snapObj ? { at: snapObj.at, count: snapObj.list.length, etag: !!snapObj.etag } : null)
    let timer
    const render = Promise.race([
      fetchRender(budgetMs, snapObj && snapObj.etag ? snapObj.etag : null).then(v => ({ ok: true, count: v.notModified ? snapObj.list.length : v.list.length, notModified: !!v.notModified, ms: Date.now() - t0 }), e => ({ ok: false, error: e.message, status: e.status || null, routing: e.routing || (/abort|timeout/i.test(e.message) ? 'timeout' : ''), ms: Date.now() - t0 })),
      new Promise(r => { timer = setTimeout(() => r({ ok: false, error: 'no answer', status: null, routing: 'timeout', ms: budgetMs }), budgetMs + 100) }),
    ]).finally(() => clearTimeout(timer))
    const stat = getStatic(staticUrl).then(l => (l ? { count: l.length } : null), () => null)
    const table = readTable(budgetMs).then(rows => ({ ...(tableState || { ok: false }), ...(rows ? { count: rows.length } : {}) }))
    ;[out.render, out.snapshot, out.static, out.table] = await Promise.all([render, snap, stat, table])
    out.store = supaOk ? { table: storeTable, error: storeError } : null
    out.serving = out.table && out.table.ok ? 'table' : out.render.ok ? 'render' : out.snapshot && out.snapshot.count ? 'snapshot' : out.static ? 'static' : 'none'
    // The weight of the list itself (what every full download costs) and photos stored inline — the one thing
    // that makes it heavy
    const list = memo && memo.list ? memo.list : null
    if (list) {
      const body = JSON.stringify(list)
      out.list = { bytes: Buffer.byteLength(body), inlineImages: list.reduce((n, p) => n + ((p && p.images) || []).filter(i => String(i).startsWith('data:')).length + (p && String(p.logo || '').startsWith('data:') ? 1 : 0), 0) }
    }
    if (supaOk) {
      try { await flushTraffic(); const all = await readTraffic(); const m = monthKey(); out.traffic = { month: m, ...(all[m] || { bytes: 0, requests: 0, notModified: 0 }), months: all } } catch {}
    }
    return out
  }

  // Forget the in-memory list (after a write through the store) so the next read sees the table
  const invalidate = () => { memo = null }

  return { getList, getAll, reconcile, invalidate, getOne, getSnapshot, saveSnapshot, getStatic, pushSnapshot, health, flushTraffic, cleanSnapshot, store }
}
