// The `properties` table in Supabase — the durable home of every property, whatever Render does.
// Render (the property generator) keeps the list in memory and is supposed to write each save to this table.
// That write has been failing silently: a property saved while it fails lives in Render's RAM only and is gone
// after the next restart (and Render restarts on every deploy, sleep and suspension). So the site side treats
// the table as the source of truth: the public feed reads it first (lib/property-feed.js), every admin save and
// the intake publish are written into it through Vercel, and reconcile() copies anything Render or the snapshot
// still has that the table lacks. Render re-reads the table every 5 minutes, so it follows on its own.
// Rows: id BIGINT (the property's numeric id), data JSONB (the property), published BOOLEAN, created_at, updated_at.
export const TABLE = 'properties'

// The table's key is a BIGINT: only a plain positive integer id can be stored
export const numericId = id => {
  const s = String(id ?? '').trim()
  if (!/^\d{1,15}$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export const rowToProperty = row => ({ ...(row && row.data && typeof row.data === 'object' ? row.data : {}), id: row.id, published: row.published !== false })

// Property ids are Date.now() stamps: a believable one doubles as the creation time (keeps the site's order)
const createdAtOf = id => (id > 1.4e12 && id < 4e12 ? new Date(id) : new Date()).toISOString()

export function createStore({ supaUrl, supaKey, fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  const ok = !!(supaUrl && supaKey)
  const base = `${String(supaUrl || '').replace(/\/$/, '')}/rest/v1/${TABLE}`
  const H = extra => ({ apikey: supaKey, Authorization: `Bearer ${supaKey}`, Accept: 'application/json', ...extra })
  const fail = async (r, what) => { const e = new Error(`${TABLE} ${what}: HTTP ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`.trim()); e.status = r.status; throw e }

  // Every property (newest first); publishedOnly → what the site shows
  async function list({ publishedOnly = false, timeout = timeoutMs } = {}) {
    if (!ok) return null
    const r = await fetchImpl(`${base}?select=id,data,published,created_at${publishedOnly ? '&published=eq.true' : ''}&order=created_at.desc`, { headers: H(), signal: AbortSignal.timeout(timeout) })
    if (!r.ok) await fail(r, 'read')
    const rows = await r.json()
    if (!Array.isArray(rows)) throw new Error(`${TABLE}: not a list`)
    return rows.map(rowToProperty)
  }

  async function one(id, { timeout = timeoutMs } = {}) {
    const n = numericId(id)
    if (!ok || !n) return null
    const r = await fetchImpl(`${base}?id=eq.${n}&select=id,data,published`, { headers: H(), signal: AbortSignal.timeout(timeout) })
    if (!r.ok) await fail(r, 'read')
    const rows = await r.json()
    return Array.isArray(rows) && rows[0] ? rowToProperty(rows[0]) : null
  }

  async function ids({ timeout = timeoutMs } = {}) {
    const r = await fetchImpl(`${base}?select=id`, { headers: H(), signal: AbortSignal.timeout(timeout) })
    if (!r.ok) await fail(r, 'read')
    return new Set(((await r.json()) || []).map(x => Number(x.id)))
  }

  // Insert or replace one property (the whole object, as Render stores it) → { id, published }
  async function upsert(prop, { timeout = 8000 } = {}) {
    if (!ok) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not configured')
    const id = numericId(prop && prop.id)
    if (!id) throw new Error('property id must be a positive integer')
    const published = prop.published !== false
    const row = { id, data: { ...prop, id, published }, published, updated_at: new Date().toISOString() }
    const r = await fetchImpl(`${base}?on_conflict=id`, { method: 'POST', headers: H({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify(row), signal: AbortSignal.timeout(timeout) })
    if (!r.ok) await fail(r, 'write')
    return { id, published }
  }
  async function upsertMany(list, opts) {
    const out = { saved: [], errors: [] }
    for (const p of Array.isArray(list) ? list : []) {
      try { out.saved.push((await upsert(p, opts)).id) } catch (e) { out.errors.push(`${p && p.id}: ${e.message}`) }
    }
    return out
  }

  async function remove(id, { timeout = 8000 } = {}) {
    if (!ok) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not configured')
    const n = numericId(id)
    if (!n) throw new Error('property id must be a positive integer')
    const r = await fetchImpl(`${base}?id=eq.${n}`, { method: 'DELETE', headers: H({ Prefer: 'return=minimal' }), signal: AbortSignal.timeout(timeout) })
    if (!r.ok) await fail(r, 'delete')
    return { id: n }
  }

  // Add every property of `candidates` the table doesn't have yet — never touches a row that exists
  // (ignore-duplicates, so a save racing with this never loses). → { added: [ids], skipped }
  async function addMissing(candidates, { timeout = 8000 } = {}) {
    if (!ok) return { added: [], skipped: 0 }
    const have = await ids({ timeout })
    const seen = new Set()
    const add = []
    for (const p of Array.isArray(candidates) ? candidates : []) {
      const id = numericId(p && p.id)
      if (!id || have.has(id) || seen.has(id)) continue
      seen.add(id)
      const published = p.published !== false
      add.push({ id, data: { ...p, id, published }, published, created_at: p.createdAt && !isNaN(Date.parse(p.createdAt)) ? new Date(p.createdAt).toISOString() : createdAtOf(id), updated_at: new Date().toISOString() })
    }
    if (!add.length) return { added: [], skipped: (candidates || []).length }
    const r = await fetchImpl(`${base}?on_conflict=id`, { method: 'POST', headers: H({ 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }), body: JSON.stringify(add), signal: AbortSignal.timeout(timeout) })
    if (!r.ok) await fail(r, 'insert')
    return { added: add.map(x => x.id), skipped: (candidates || []).length - add.length }
  }

  return { ok, list, one, ids, upsert, upsertMany, remove, addMissing }
}
