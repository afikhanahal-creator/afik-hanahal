// Second home for submitted questionnaires, independent of Supabase.
// Vercel Blob (Storage → Create → Blob in the Vercel dashboard; the BLOB_READ_WRITE_TOKEN env var is
// injected automatically). The store is PRIVATE: every read here carries the token, nothing is reachable by URL. Used when Supabase refuses a write (quota, paused project, outage) so a
// seller's form is never lost, and readable from the admin panel until it is restored into Supabase.
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN || ''
const API = 'https://blob.vercel-storage.com'
const H = extra => ({ authorization: `Bearer ${TOKEN}`, 'x-api-version': '7', ...extra })

export const backupEnabled = () => !!TOKEN

export async function backupPut(pathname, obj) {
  if (!TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN not configured')
  const r = await fetch(`${API}/${pathname}`, { method: 'PUT', headers: H({ 'x-content-type': 'application/json', 'x-add-random-suffix': '1', 'x-cache-control-max-age': '0', 'x-access': process.env.BLOB_ACCESS || 'private' }), body: JSON.stringify(obj), signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw new Error(`blob PUT ${r.status}: ${await r.text().catch(() => '')}`)
  return r.json()   // { url, downloadUrl, pathname }
}

export async function backupList(prefix = 'intake/', limit = 100) {
  if (!TOKEN) return []
  const r = await fetch(`${API}/?prefix=${encodeURIComponent(prefix)}&limit=${limit}`, { headers: H(), signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw new Error(`blob LIST ${r.status}`)
  const d = await r.json().catch(() => ({}))
  return Array.isArray(d.blobs) ? d.blobs : []
}

export async function backupGet(url) {
  if (!/^https:\/\/[\w.-]+\.blob\.vercel-storage\.com\//.test(String(url))) throw new Error('not a blob url')
  const r = await fetch(url, { headers: H(), signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw new Error(`blob GET ${r.status}`)
  return r.json()
}

export async function backupDelete(urls) {
  if (!TOKEN || !urls.length) return
  await fetch(`${API}/delete`, { method: 'POST', headers: H({ 'content-type': 'application/json' }), body: JSON.stringify({ urls }), signal: AbortSignal.timeout(15000) }).catch(() => {})
}
