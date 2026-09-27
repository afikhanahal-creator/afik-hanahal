// Photos stored INSIDE a property as base64 (`data:image/...`): an old admin fallback left them there. One such
// photo weighs 100–500 KB and rides along in every property-list response — the list was 1.9 MB for 10
// properties, which is what burned Render's bandwidth and slowed every visitor. These helpers find them, turn
// them into files for Supabase Storage and rewrite the property to plain URLs. Pure; the upload itself is done
// by the caller (api/properties.js ?slim=1).
import { createHash } from 'crypto'

const DATA_RE = /^data:(image\/[a-z0-9.+-]+)(;[^,]*)?,/i
const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }

export const isDataImage = v => typeof v === 'string' && DATA_RE.test(v)

// Where a property keeps inline photos: the images array and the logo. → [{ field, index?, uri }]
export function findInlineImages(p) {
  const out = []
  if (!p || typeof p !== 'object') return out
  ;(Array.isArray(p.images) ? p.images : []).forEach((uri, index) => { if (isDataImage(uri)) out.push({ field: 'images', index, uri }) })
  if (isDataImage(p.logo)) out.push({ field: 'logo', uri: p.logo })
  return out
}

// → { mime, ext, buf, hash } or null for anything that isn't a base64 image
export function decodeDataImage(uri) {
  const m = typeof uri === 'string' ? uri.match(DATA_RE) : null
  if (!m) return null
  const mime = m[1].toLowerCase()
  const ext = EXT[mime]
  if (!ext) return null
  const payload = uri.slice(m[0].length)
  const buf = /;base64/i.test(m[2] || '') ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'latin1')
  if (!buf.length) return null
  return { mime, ext, buf, hash: createHash('sha1').update(buf).digest('hex') }
}

// Storage path for an inline photo (content-addressed, so the same photo never lands twice)
export const inlinePath = (propertyId, { hash, ext }) => `inline/${String(propertyId).replace(/[^\w-]/g, '')}/${hash}.${ext}`

// The property with every inline photo replaced by its URL (urls: uri → url). Photos without a URL are left as they are.
export function replaceInline(p, urls) {
  const next = { ...p }
  if (Array.isArray(p.images)) next.images = p.images.map(u => (isDataImage(u) && urls.get(u)) || u)
  if (isDataImage(p.logo) && urls.get(p.logo)) next.logo = urls.get(p.logo)
  return next
}

export const jsonBytes = v => Buffer.byteLength(JSON.stringify(v === undefined ? null : v))
