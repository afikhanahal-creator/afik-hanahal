// The chat's photo gallery (2026-11-08 — "a gallery button next to attach: every property and its photos, pick one or several and
// send them to interested leads"). Pure and tested (photoGallery.test.mjs); the window is src/PhotoGalleryPicker.jsx.
import { projectKeys, projectsInText } from '../../lib/project-chat.js'

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
export function galleryProperties(list = [], { project = '', query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase()
  return (Array.isArray(list) ? list : [])
    .map(p => {
      const images = [...new Set((p?.images || []).filter(httpUrl))]
      return { id: String(p?.id ?? ''), title: String(p?.title || '').trim() || '—', place: placeOf(p || {}), live: p?.published !== false,
        status: ['נמכר', 'הושכר'].includes(p?.status) ? p.status : '', images, cover: images[0] || '', match: propertyMatches(p, project),
        hay: [p?.title, p?.location, p?.neighborhood, p?.street, p?.type, p?.gush].filter(Boolean).join(' ').toLowerCase(), order: Number(p?.sortOrder ?? 1e9) }
    })
    .filter(p => p.id && p.images.length && (!q || p.hay.includes(q)))
    .sort((a, b) => (b.match - a.match) || (b.live - a.live) || (!!a.status - !!b.status) || (a.order - b.order))
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
