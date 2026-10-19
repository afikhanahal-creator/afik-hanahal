// Shrinks oversized property photos in Supabase Storage, in place.
// Why: Supabase's free plan allows ~5 GB of egress a month and the site used it up in October 2026. Every photo
// reaches visitors through the image CDN (wsrv.nl, lib/img-url.js), which fetches the ORIGINAL from Supabase once per
// size and edge location — and older photos were uploaded as full-size originals (a 5.5 MB PNG, many 1–12 MB JPEGs).
// Each one is re-encoded once (≤1600 px JPEG, through the same CDN) and written back to the same path with a one-year
// cache header, so every link that points at it keeps working. Runs daily (api/cron/warm.js) and on demand
// (POST /api/properties?shrink=1). Photos that don't get meaningfully smaller are remembered (app_settings
// 'photo_shrink'), so they are never fetched again.

export const SHRINK_BUCKETS = ['property-images', 'property-media']
export const SHRINK_MIN_BYTES = 450e3
const IMG_RX = /\.(jpe?g|png|webp)$/i
const SETTING = 'photo_shrink'

/** Is this storage object a photo worth shrinking? (pure) */
export function shouldShrink(obj, done = new Set(), minBytes = SHRINK_MIN_BYTES) {
  if (!obj || !obj.path || !IMG_RX.test(obj.path)) return false
  if (done.has(obj.path)) return false
  return Number(obj.size) > minBytes
}

/** The CDN URL that returns a ≤1600 px JPEG of a public storage photo (pure) */
export function shrinkSourceUrl(publicUrl, { width = 1600, quality = 80 } = {}) {
  return `https://wsrv.nl/?url=${encodeURIComponent(publicUrl)}&w=${width}&h=${width}&fit=inside&we&output=jpg&q=${quality}`
}

/** Worth writing back? Only when it saves at least a quarter of the bytes (pure) */
export const worthReplacing = (before, after) => after > 1000 && after < before * 0.75

// Every object in a bucket, folders included (the list API returns one level at a time; folders have no id)
async function listAll(supaUrl, H, bucket, fetch, prefix = '', depth = 0, out = []) {
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${supaUrl}/storage/v1/object/list/${bucket}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }), signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`list ${bucket}/${prefix}: HTTP ${r.status}`)
    const items = await r.json()
    for (const it of items) {
      const path = prefix ? `${prefix}/${it.name}` : it.name
      if (it.id) out.push({ bucket, path, size: Number(it.metadata?.size) || 0, cacheControl: it.metadata?.cacheControl || '' })
      else if (depth < 4) await listAll(supaUrl, H, bucket, fetch, path, depth + 1, out)
    }
    if (items.length < 1000) break
  }
  return out
}

export async function shrinkStoragePhotos({ supaUrl, supaKey, buckets = SHRINK_BUCKETS, minBytes = SHRINK_MIN_BYTES, budgetMs = 20000, maxPhotos = 8, fetchImpl = fetch } = {}) {
  const fetch = fetchImpl
  if (!supaUrl || !supaKey) return { error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not configured' }
  const t0 = Date.now()
  const H = { apikey: supaKey, Authorization: `Bearer ${supaKey}` }
  const report = { checked: 0, shrunk: 0, skipped: 0, remaining: 0, bytesBefore: 0, bytesAfter: 0, errors: [] }
  // what was already tried and didn't get smaller
  const sr = await fetch(`${supaUrl}/rest/v1/app_settings?key=eq.${SETTING}&select=value`, { headers: H, signal: AbortSignal.timeout(6000) }).catch(() => null)
  if (sr && sr.status === 402) return { ...report, error: 'Supabase quota exceeded (402): will run again when the quota resets' }
  const doneList = sr && sr.ok ? ((await sr.json())?.[0]?.value?.done || []) : []
  const done = new Set(doneList)
  let objects = []
  for (const b of buckets) {
    try { objects = objects.concat(await listAll(supaUrl, H, b, fetch)) } catch (e) { report.errors.push(e.message); if (/HTTP 402/.test(e.message)) return { ...report, error: 'Supabase quota exceeded (402): will run again when the quota resets' } }
  }
  const todo = objects.filter(o => shouldShrink({ ...o, path: `${o.bucket}/${o.path}` }, done, minBytes)).sort((a, b) => b.size - a.size)
  report.checked = objects.length
  let budget = maxPhotos
  for (const o of todo) {
    if (budget <= 0 || Date.now() - t0 > budgetMs) { report.remaining++; continue }
    budget--
    const key = `${o.bucket}/${o.path}`
    const publicUrl = `${supaUrl}/storage/v1/object/public/${o.bucket}/${o.path.split('/').map(encodeURIComponent).join('/')}`
    try {
      const r = await fetch(shrinkSourceUrl(publicUrl), { signal: AbortSignal.timeout(20000) })
      if (!r.ok) throw new Error(`CDN ${r.status}`)
      const buf = Buffer.from(await r.arrayBuffer())
      if (!worthReplacing(o.size, buf.length)) { done.add(key); report.skipped++; continue }
      const up = await fetch(`${supaUrl}/storage/v1/object/${o.bucket}/${o.path.split('/').map(encodeURIComponent).join('/')}`, { method: 'PUT', headers: { ...H, 'Content-Type': 'image/jpeg', 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }, body: buf, signal: AbortSignal.timeout(20000) })
      if (!up.ok) throw new Error(`upload ${up.status} ${(await up.text().catch(() => '')).slice(0, 100)}`)
      done.add(key)
      report.shrunk++; report.bytesBefore += o.size; report.bytesAfter += buf.length
    } catch (e) { report.errors.push(`${key}: ${e.message}`) }
  }
  if (done.size !== doneList.length) {
    await fetch(`${supaUrl}/rest/v1/app_settings?on_conflict=key`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: SETTING, value: { done: [...done].slice(-2000), at: new Date().toISOString() }, updated_at: new Date().toISOString() }), signal: AbortSignal.timeout(6000) }).catch(() => {})
  }
  return report
}
