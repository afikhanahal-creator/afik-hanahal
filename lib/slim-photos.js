// Moves photos stored inline (base64) out of the properties table into Supabase Storage — see lib/inline-images.js.
// Runs automatically: after every property save (api/properties.js ?changed=1), daily in api/cron/warm.js, and when
// the admin panel sees inline photos in the health check; POST /api/properties?slim=1 runs it on demand.
// Straight against the `properties` table, so it works while Render is down (Render re-reads the table within 5 min).
// A few photos per run (functions have a time limit); `remaining` says how many are left for the next run.
import { findInlineImages, decodeDataImage, inlinePath, replaceInline, jsonBytes } from './inline-images.js'

export const PHOTO_BUCKET = 'property-images'

// onDone(list): called with the full rewritten list when no inline photos remain and at least one was moved
export async function slimInlinePhotos({ supaUrl, supaKey, budgetMs = 20000, maxPhotos = 12, fetchImpl = fetch, onDone } = {}) {
  const SUPA_URL = supaUrl, SUPA_KEY = supaKey, fetch = fetchImpl
  if (!SUPA_URL || !SUPA_KEY) return { error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not configured', uploaded: 0, remaining: 0 }
  const t0 = Date.now()
  const H = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
  const r = await fetch(`${SUPA_URL}/rest/v1/properties?select=id,data&order=created_at.desc`, { headers: { ...H, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) }).catch(() => null)
  if (!r || !r.ok) return { error: `properties table: ${r ? 'HTTP ' + r.status : 'unreachable'}`, uploaded: 0, remaining: 0 }
  const rows = await r.json()
  const report = { properties: [], uploaded: 0, remaining: 0, bytesBefore: 0, bytesAfter: 0, errors: [] }
  let budgetLeft = maxPhotos
  for (const row of Array.isArray(rows) ? rows : []) {
    const data = row && row.data && typeof row.data === 'object' ? row.data : null
    if (!data) continue
    const found = findInlineImages(data)
    if (!found.length) continue
    if (budgetLeft <= 0 || Date.now() - t0 > budgetMs) { report.remaining += found.length; continue }
    const urls = new Map()
    for (const f of found) {
      if (urls.has(f.uri)) continue                       // the same photo used twice (e.g. as the logo too)
      if (budgetLeft <= 0 || Date.now() - t0 > budgetMs) break
      const img = decodeDataImage(f.uri)
      if (!img) { report.errors.push(`${row.id}: ${f.field}${f.index ?? ''} is not a raster image`); continue }
      const path = inlinePath(row.id, img)
      const up = await fetch(`${SUPA_URL}/storage/v1/object/${PHOTO_BUCKET}/${path}`, { method: 'POST', headers: { ...H, 'Content-Type': img.mime, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }, body: img.buf, signal: AbortSignal.timeout(15000) }).catch(e => ({ ok: false, status: 0, text: async () => e.message }))
      if (!up.ok) { report.errors.push(`${row.id}: upload ${up.status} ${(await up.text().catch(() => '')).slice(0, 120)}`); continue }
      urls.set(f.uri, `${SUPA_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`)
      budgetLeft--; report.uploaded++
    }
    const left = found.filter(f => !urls.has(f.uri)).length
    report.remaining += left
    if (!urls.size) continue
    const next = replaceInline(data, urls)
    const w = await fetch(`${SUPA_URL}/rest/v1/properties?id=eq.${encodeURIComponent(row.id)}`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ data: next }), signal: AbortSignal.timeout(10000) }).catch(() => null)
    if (!w || !w.ok) { report.errors.push(`${row.id}: write ${w ? 'HTTP ' + w.status : 'failed'}`); report.remaining += urls.size; continue }
    report.properties.push({ id: row.id, title: String(data.title || '').slice(0, 60), photos: urls.size, left, kbBefore: Math.round(jsonBytes(data) / 1024), kbAfter: Math.round(jsonBytes(next) / 1024) })
    report.bytesBefore += jsonBytes(data); report.bytesAfter += jsonBytes(next)
  }
  // Nothing left and something moved: the public snapshot + the static pages follow
  if (report.remaining === 0 && report.uploaded > 0 && onDone) {
    const all = await fetch(`${SUPA_URL}/rest/v1/properties?select=id,data,published&order=created_at.desc`, { headers: { ...H, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) }).then(x => (x.ok ? x.json() : [])).catch(() => [])
    const list = (Array.isArray(all) ? all : []).map(x => ({ ...x.data, id: x.id, published: x.published !== false }))
    try { report.done = await onDone(list) } catch (e) { report.done = { error: e.message } }
  }
  report.ms = Date.now() - t0
  return report
}
