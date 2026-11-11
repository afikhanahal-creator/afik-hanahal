// The chat's photo gallery (2026-11-08 — "a gallery button next to attach: every property and its photos, pick one or several and
// send them to interested leads"). Pure and tested (photoGallery.test.mjs); the window is src/PhotoGalleryPicker.jsx.
import { projectKeys, projectsInText } from '../../lib/project-chat.js'
import { propertyFolderId } from '../../lib/gallery-folders.js'

const httpUrl = u => typeof u === 'string' && /^https:\/\//.test(u)
const placeOf = p => [p.location, p.neighborhood, p.street].filter(Boolean).join(' · ')

/** Does this property belong to the lead's project? ("זרובבל 15" ↔ a listing titled "דירת 4 חדרים בזרובבל 15, רעננה") */
export function propertyMatches(p, project) {
  const name = String(project || '').trim()
  if (!name || !p) return false
  const keys = projectKeys([{ id: 'x', name, aliases: [], status: 'active' }])
  if (!keys.length) return false
  return projectsInText([p.title, p.street, p.location, p.neighborhood].filter(Boolean).join(' '), keys).has('x')
}

/** The properties that have photos → { id, title, place, live, status, images, cover, match }, the lead's own first, then the
 *  ones on the site, then the rest; `query` filters by title / town / street / neighbourhood / gush */
export function galleryProperties(list = [], opts = {}) { return galleryEntries(list, [], opts).properties }

/**
 * Everything the gallery shows: the office's own folders (lib/gallery-folders.js) and the properties.
 * → { folders: [entry], properties: [entry] }; entry = { id, kind: 'folder' | 'property', title, place, live, status, images,
 * own (the urls uploaded to the gallery — they can be removed there), folderId (where an upload into this entry goes), cover,
 * match }. A folder with `propertyId` is that property's extra photos: they follow its site photos. An empty folder shows
 * (it waits for photos); a property shows when it has site photos or extras.
 */
export function galleryEntries(list = [], folders = [], { project = '', query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase()
  const fl = Array.isArray(folders) ? folders : []
  const extras = new Map(fl.filter(f => f?.propertyId).map(f => [String(f.propertyId), f]))
  const properties = (Array.isArray(list) ? list : [])
    .map(p => {
      const id = String(p?.id ?? ''), ex = extras.get(id)
      const site = [...new Set((p?.images || []).filter(httpUrl))]
      const own = (ex?.photos || []).map(x => x.url).filter(u => httpUrl(u) && !site.includes(u))
      const images = [...site, ...own]
      return { id, kind: 'property', title: String(p?.title || '').trim() || '—', place: placeOf(p || {}), live: p?.published !== false,
        status: ['נמכר', 'הושכר'].includes(p?.status) ? p.status : '', images, own, folderId: ex?.id || propertyFolderId(id), cover: images[0] || '', match: propertyMatches(p, project),
        hay: [p?.title, p?.location, p?.neighborhood, p?.street, p?.type, p?.gush].filter(Boolean).join(' ').toLowerCase(), order: Number(p?.sortOrder ?? 1e9) }
    })
    .filter(p => p.id && p.images.length && (!q || p.hay.includes(q)))
    .sort((a, b) => (b.match - a.match) || (b.live - a.live) || (!!a.status - !!b.status) || (a.order - b.order))
  const known = new Set((Array.isArray(list) ? list : []).map(p => String(p?.id ?? '')))
  const own = fl
    // a property's extras whose property is gone from the list show as a plain folder, so the photos are never lost from view
    .filter(f => f?.id && (!f.propertyId || !known.has(String(f.propertyId))))
    .map(f => {
      const images = (f.photos || []).map(x => x.url).filter(httpUrl)
      const title = String(f.name || '').trim() || 'תיקייה'
      return { id: f.id, kind: 'folder', title, place: '', live: false, status: '', images, own: images, folderId: f.id, cover: images[0] || '',
        match: propertyMatches({ title }, project), hay: title.toLowerCase(), at: Date.parse(f.updatedAt || f.createdAt || '') || 0 }
    })
    .filter(f => !q || f.hay.includes(q))
    .sort((a, b) => (b.match - a.match) || (b.at - a.at))
  return { folders: own, properties }
}

/** image files only (a phone's HEIC too), each ≤ maxMb → { ok: [File], bad: [{ name, why }] } */
export function imageFilesOnly(list, { maxMb = 25, lang = 'he' } = {}) {
  const ok = [], bad = []
  for (const f of Array.from(list || [])) {
    const isImg = (/^image\//.test(f?.type || '') && !/svg/.test(f.type)) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f?.name || '')
    if (!isImg) bad.push({ name: f?.name || '', why: lang === 'en' ? 'Only photos can be added to the gallery' : 'לגלריה אפשר להעלות רק תמונות' })
    else if (f.size > maxMb * 1024 * 1024) bad.push({ name: f.name, why: lang === 'en' ? `Too large (up to ${maxMb} MB)` : `גדולה מדי (עד ${maxMb}MB)` })
    else ok.push(f)
  }
  return { ok, bad }
}

/** A readable file name for the WhatsApp attachment: "<title>-<n>.<ext>" */
export function photoFileName(url, title = '', n = 1) {
  const ext = (String(url).split(/[?#]/)[0].match(/\.(jpe?g|png|webp|gif|heic)$/i)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg')
  const base = String(title).replace(/[\\/:*?"<>|#%]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50) || 'photo'
  return `${base}-${n}.${ext}`
}

/** The picks ([{ url, propId, title, n }]) → the tray's remote files, at most `room` */
export function picksToFiles(picks = [], room = 30) {
  return picks.slice(0, Math.max(0, room)).map(p => ({ url: p.url, name: photoFileName(p.url, p.title, p.n), type: 'image/jpeg', size: 0 }))
}

/** The property links to add to the message (one line each, the properties the photos came from, in the order picked) */
export function picksLinks(picks = [], { lang = 'he', base = 'https://www.afikhanahal.co.il' } = {}) {
  const seen = new Map()
  for (const p of picks) if (p.propId && !seen.has(p.propId)) seen.set(p.propId, p.title)
  return [...seen].map(([id, title]) => `${title}: ${base}/p/${encodeURIComponent(id)}`).join('\n')
}

/** Toggle one photo in the picks (keeps the order they were picked in) */
export function togglePick(picks, pick, max = 30) {
  if (picks.some(p => p.url === pick.url)) return picks.filter(p => p.url !== pick.url)
  return picks.length >= max ? picks : [...picks, pick]
}

/** Photos picked lately ([{ url, propId, title, n }], localStorage — newest first, no repeats, only https) */
export function pushRecent(list = [], picks = [], max = 24) {
  const urls = new Set(picks.map(p => p.url))
  return [...picks, ...(Array.isArray(list) ? list : []).filter(p => p && !urls.has(p.url))].filter(p => httpUrl(p?.url)).slice(0, max)
}
