// Before a property is saved: any photo still held inline (base64 `data:image/...`) is uploaded to Supabase Storage
// through a signed URL (the same route the property wizard uses — it never touches Render) and replaced by its URL.
// An inline photo rides along in every property-list response forever, so it must never reach the database.
// If an upload fails the photo stays inline; the server moves it out after the save (lib/slim-photos.js).
const isData = v => typeof v === 'string' && /^data:image\/[a-z0-9.+-]+[;,]/i.test(v)

async function uploadDataUrl(dataUrl, token) {
  const blob = await (await fetch(dataUrl)).blob()
  const type = blob.type || 'image/jpeg'
  const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '')
  const meta = await fetch('/api/seller-form?action=wizard-upload-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `photo.${ext}`, type, size: blob.size, kind: 'image' }),
  }).then(r => (r.ok ? r.json() : null)).catch(() => null)
  if (!meta?.signedUrl || !meta?.url) return null
  const put = await fetch(meta.signedUrl, { method: 'PUT', headers: { 'Content-Type': type, 'x-upsert': 'true' }, body: blob }).catch(() => null)
  return put && put.ok ? meta.url : null
}

export async function externalizeInlinePhotos(prop, token) {
  if (!prop || typeof prop !== 'object') return prop
  const images = Array.isArray(prop.images) ? prop.images : []
  if (!images.some(isData) && !isData(prop.logo)) return prop
  const cache = new Map()
  const up = async u => {
    if (!isData(u)) return u
    if (!cache.has(u)) cache.set(u, uploadDataUrl(u, token).catch(() => null))
    return (await cache.get(u)) || u
  }
  return { ...prop, images: await Promise.all(images.map(up)), ...(isData(prop.logo) ? { logo: await up(prop.logo) } : {}) }
}
