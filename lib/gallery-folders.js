// The gallery's own folders (2026-11-11 — "let me make new folders of new properties in the gallery and drag / upload photos
// into them"). The chat's photo gallery (src/PhotoGalleryPicker.jsx) shows every property's photos; these folders are the
// office's own albums next to them: a folder of its own ("פרויקט חדש ברעננה") or extra photos for an existing property
// (`propertyId`, shown after that property's site photos — the site's property is never changed).
// Stored in app_settings.gallery_folders; the photos are public files under property-media/gallery/…
// Pure and tested (gallery-folders.test.mjs): shared by the server (api/meta.js `gallery-folders`) and the browser.

export const FOLDER_ID = /^g_[a-z0-9]{2,26}$/
export const MAX_FOLDERS = 300
export const MAX_FOLDER_PHOTOS = 300
const httpsUrl = u => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) && u.length <= 600
const cleanName = (s, max = 80) => String(s ?? '').replace(/[\u0000-\u001f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
const isoOr = (v, d) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : d)

/** a new folder id (the browser makes it, so a create is idempotent) */
export const newFolderId = (now = Date.now(), rnd = Math.random()) => `g_${now.toString(36)}${Math.floor(rnd * 1296).toString(36).padStart(2, '0')}`
/** the one folder that holds a property's extra photos */
export const propertyFolderId = propertyId => { const k = String(propertyId ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24); return k ? `g_p${k}` : '' }

function cleanPhotos(list, now) {
  const seen = new Set(), out = []
  for (const p of Array.isArray(list) ? list : []) {
    const url = typeof p === 'string' ? p : p?.url
    if (!httpsUrl(url) || seen.has(url)) continue
    seen.add(url)
    out.push({ url, name: cleanName(p?.name, 120), at: isoOr(p?.at, now) })
    if (out.length >= MAX_FOLDER_PHOTOS) break
  }
  return out
}

/** the stored list, made safe: valid ids once, a name, https photos once each */
export function cleanFolders(list, now = new Date().toISOString()) {
  const seen = new Set(), out = []
  for (const f of Array.isArray(list) ? list : []) {
    const id = String(f?.id || '')
    if (!FOLDER_ID.test(id) || seen.has(id)) continue
    seen.add(id)
    const propertyId = cleanName(f?.propertyId, 40)
    out.push({ id, name: cleanName(f?.name) || (propertyId ? '' : 'תיקייה'), propertyId, photos: cleanPhotos(f?.photos, now), createdAt: isoOr(f?.createdAt, now), updatedAt: isoOr(f?.updatedAt, now) })
    if (out.length >= MAX_FOLDERS) break
  }
  return out
}

/**
 * Apply the browser's operations to the stored list → { folders, removed: [urls no folder holds any more], errors }.
 * Ops (each is safe to repeat): { op: 'create', id, name, propertyId? } · { op: 'rename', id, name } · { op: 'delete', id } ·
 * { op: 'add', id, photos: [{ url, name }] } · { op: 'remove', id, urls: [] } · { op: 'cover', id, url } (that photo first).
 */
export function applyFolderOps(list, ops, now = new Date().toISOString()) {
  let folders = cleanFolders(list, now)
  const before = new Set(folders.flatMap(f => f.photos.map(p => p.url)))
  const errors = []
  for (const o of (Array.isArray(ops) ? ops : []).slice(0, 60)) {
    const id = String(o?.id || '')
    if (!FOLDER_ID.test(id)) { errors.push('מזהה תיקייה לא תקין'); continue }
    const at = folders.findIndex(f => f.id === id)
    const touch = fn => { folders = folders.map((f, i) => (i === at ? { ...fn(f), updatedAt: now } : f)) }
    if (o.op === 'create') {
      if (at >= 0) continue
      const propertyId = cleanName(o.propertyId, 40), name = cleanName(o.name)
      if (!name && !propertyId) { errors.push('חסר שם לתיקייה'); continue }
      if (folders.length >= MAX_FOLDERS) { errors.push(`אפשר עד ${MAX_FOLDERS} תיקיות`); continue }
      if (propertyId && folders.some(f => f.propertyId === propertyId)) continue
      folders = [{ id, name, propertyId, photos: [], createdAt: now, updatedAt: now }, ...folders]
    } else if (at < 0) { errors.push('התיקייה לא נמצאה'); continue }
    else if (o.op === 'rename') { const name = cleanName(o.name); if (!name) { errors.push('חסר שם לתיקייה'); continue } touch(f => ({ ...f, name })) }
    else if (o.op === 'delete') folders = folders.filter((_, i) => i !== at)
    else if (o.op === 'add') {
      const have = new Set(folders[at].photos.map(p => p.url))
      const fresh = cleanPhotos(o.photos, now).filter(p => !have.has(p.url))
      const room = MAX_FOLDER_PHOTOS - folders[at].photos.length
      if (fresh.length > room) errors.push(`אפשר עד ${MAX_FOLDER_PHOTOS} תמונות בתיקייה`)
      if (fresh.length && room > 0) touch(f => ({ ...f, photos: [...f.photos, ...fresh.slice(0, room)] }))
    } else if (o.op === 'remove') {
      const gone = new Set((Array.isArray(o.urls) ? o.urls : []).map(String))
      touch(f => ({ ...f, photos: f.photos.filter(p => !gone.has(p.url)) }))
    } else if (o.op === 'cover') {
      const p = folders[at].photos.find(x => x.url === o.url)
      if (p) touch(f => ({ ...f, photos: [p, ...f.photos.filter(x => x.url !== p.url)] }))
    } else errors.push('פעולה לא מוכרת')
  }
  const after = new Set(folders.flatMap(f => f.photos.map(p => p.url)))
  return { folders, removed: [...before].filter(u => !after.has(u)), errors: [...new Set(errors)] }
}

/** the Storage paths (inside the public bucket) of gallery uploads among these URLs — only files under gallery/ are ever
 *  deleted, never a property's own photo or a template's */
export function galleryStoragePaths(urls, bucket = 'property-media') {
  const out = []
  for (const u of Array.isArray(urls) ? urls : []) {
    const m = String(u).match(new RegExp(`/storage/v1/object/public/${bucket}/(gallery/[\\w./-]+)$`))
    if (m && !m[1].includes('..')) out.push(decodeURIComponent(m[1]))
  }
  return [...new Set(out)]
}
