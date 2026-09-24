// Public property list, fast and always available.
// The list lives on the Render backend, which sleeps on the free tier: a cold start takes 30–60 s,
// longer than a visitor (or Facebook's / WhatsApp's link-preview crawler) will wait. So every good
// answer from Render is also kept as a snapshot in Supabase (app_settings, key 'public_properties'),
// and when Render doesn't answer within a short budget the snapshot is served instead — the request
// still reaches Render and wakes it, so the next visitor gets fresh data.
import { createHash } from 'crypto'

export const SNAPSHOT_KEY = 'public_properties'

export const findPublished = (list, id) =>
  (Array.isArray(list) ? list : []).find(p => p && String(p.id) === String(id) && p.published !== false) || null

const hashOf = body => createHash('sha1').update(body).digest('hex').slice(0, 24)
const later = ms => new Promise(r => setTimeout(r, ms))

export function createFeed({
  renderUrl, supaUrl, supaKey, fetchImpl = fetch,
  renderBudgetMs = 2500,        // how long a visitor waits for Render before getting the snapshot
  renderTimeoutMs = 12000,      // how long we wait for Render when there is no snapshot at all
  snapshotTtlMs = 60000,        // in-memory reuse of the snapshot on a warm instance
} = {}) {
  const supaOk = !!(supaUrl && supaKey)
  const supaHeaders = extra => ({ apikey: supaKey, Authorization: `Bearer ${supaKey}`, Accept: 'application/json', ...extra })
  let memo = null               // { at, list, fetchedAt }
  let savedHash = null

  async function getSnapshot() {
    if (!supaOk) return null
    if (memo && Date.now() - memo.fetchedAt < snapshotTtlMs) return memo
    const r = await fetchImpl(`${supaUrl}/rest/v1/app_settings?key=eq.${SNAPSHOT_KEY}&select=value`, { headers: supaHeaders(), signal: AbortSignal.timeout(4000) })
    if (!r.ok) return null
    const rows = await r.json()
    const v = rows && rows[0] && rows[0].value
    if (!v || !Array.isArray(v.list) || !v.list.length) return null
    memo = { at: v.at, list: v.list, hash: v.hash, fetchedAt: Date.now() }
    if (v.hash) savedHash = savedHash || v.hash
    return memo
  }

  // Store Render's list — only when it changed (a hash check first, so an unchanged list costs one tiny read)
  async function saveSnapshot(list, body) {
    if (!supaOk || !Array.isArray(list) || !list.length) return false
    const hash = hashOf(body)
    if (hash === savedHash) return false
    try {
      const r = await fetchImpl(`${supaUrl}/rest/v1/app_settings?key=eq.${SNAPSHOT_KEY}&select=hash:value->>hash`, { headers: supaHeaders(), signal: AbortSignal.timeout(2500) })
      const rows = r.ok ? await r.json() : []
      if (rows && rows[0] && rows[0].hash === hash) { savedHash = hash; return false }
      const at = new Date().toISOString()
      const w = await fetchImpl(`${supaUrl}/rest/v1/app_settings?on_conflict=key`, {
        method: 'POST',
        headers: supaHeaders({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ key: SNAPSHOT_KEY, value: { hash, at, list }, updated_at: at }),
        signal: AbortSignal.timeout(4000),
      })
      if (w.ok) { savedHash = hash; memo = { at, list, hash, fetchedAt: Date.now() }; return true }
    } catch {}
    return false
  }

  function fetchRender() {
    return fetchImpl(`${renderUrl}/api/properties`, { signal: AbortSignal.timeout(renderTimeoutMs) }).then(async r => {
      if (!r.ok) throw new Error(`Render ${r.status}`)
      const body = await r.text()
      const list = JSON.parse(body)
      if (!Array.isArray(list)) throw new Error('Render: not a list')
      return { list, body }
    })
  }

  // → { source: 'render' | 'snapshot', list, at?, ms }
  async function getList() {
    const t0 = Date.now()
    const render = fetchRender()
    const settled = render.then(v => ({ ok: true, ...v }), e => ({ ok: false, error: e }))
    const first = await Promise.race([settled, later(renderBudgetMs).then(() => null)])
    if (first && first.ok) {
      await saveSnapshot(first.list, first.body)
      return { source: 'render', list: first.list, ms: Date.now() - t0 }
    }
    // Render is slow (asleep) or failing: the snapshot answers now
    const snap = await getSnapshot().catch(() => null)
    if (snap) return { source: 'snapshot', list: snap.list, at: snap.at, ms: Date.now() - t0 }
    // No snapshot yet (first run): nothing to do but wait for Render
    const last = await settled
    if (!last.ok) throw last.error
    await saveSnapshot(last.list, last.body)
    return { source: 'render', list: last.list, ms: Date.now() - t0 }
  }

  // One published property: the snapshot first (≈ instant), the live list only if it isn't there
  // (e.g. published a minute ago)
  async function getOne(id) {
    const snap = await getSnapshot().catch(() => null)
    const hit = snap && findPublished(snap.list, id)
    if (hit) return { source: 'snapshot', property: hit }
    const { source, list } = await getList()
    return { source, property: findPublished(list, id) }
  }

  return { getList, getOne, getSnapshot, saveSnapshot }
}
