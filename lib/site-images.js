// The site's own design images (public/img, the logos) for the admin's image library: which files exist, how big they are
// and where each one is used — written at build time to dist/site-images.json (scripts/build-content.mjs). The admin
// replaces one by committing the new file to the repository (api/meta.js → media-replace, GITHUB_CONTENT_TOKEN), which
// redeploys the site. Pure helpers, tested in lib/site-images.test.mjs.

export const IMAGE_EXT = /\.(webp|png|jpe?g|svg|gif|avif)$/i
// what may be replaced from the admin: a file in /img or one of the root logos
export const REPLACEABLE = /^\/(img\/[\w.-]+\.(webp|png|jpe?g|svg|gif|avif)|(logo|logo-black|logo-mark-black|favicon)\.svg)$/i

// where a reference was found → a label the office understands
const PLACES = [
  [/content\/home\.json$/, { he: 'עמוד הבית (תוכן)', en: 'Homepage (content)' }],
  [/src\/App\.jsx$/, { he: 'האתר', en: 'Website' }],
  [/lib\/booking-messages\.js$/, { he: 'מיילים לקביעת שיחה', en: 'Booking emails' }],
  [/src\/BookingPage\.jsx$|lib\/booking/, { he: 'עמוד קביעת שיחה', en: 'Booking page' }],
  [/lib\/(share-page|home-page)\.js$/, { he: 'עמודי נכס ושיתוף', en: 'Property & share pages' }],
  [/content\/.*\.mjs$|scripts\/build-content/, { he: 'עמודי תוכן', en: 'Content pages' }],
  [/index\.html$/, { he: 'כותרת האתר (index.html)', en: 'Site head (index.html)' }],
  [/src\/[A-Za-z]*Admin/, { he: 'פאנל הניהול', en: 'Admin panel' }],
  [/src\//, { he: 'האתר', en: 'Website' }],
]
export function placeOf(file) {
  const f = String(file).replace(/\\/g, '/')
  return (PLACES.find(([re]) => re.test(f)) || [null, { he: 'אחר', en: 'Other' }])[1]
}

/**
 * files: [{ path: '/img/ceo.webp', bytes }]; sources: [{ file: 'src/App.jsx', text }] →
 * [{ path, name, bytes, ext, replaceable, usedIn: [{ he, en }], uses }] sorted by where it is used, then by name
 */
export function inventory(files = [], sources = []) {
  return files
    .filter(f => IMAGE_EXT.test(f.path))
    .map(f => {
      const name = f.path.split('/').pop()
      const hits = sources.filter(s => s.text.includes(name))
      const places = []
      for (const h of hits) { const p = placeOf(h.file); if (!places.some(x => x.he === p.he)) places.push(p) }
      return { path: f.path, name, bytes: f.bytes, ext: name.split('.').pop().toLowerCase(), replaceable: REPLACEABLE.test(f.path), usedIn: places, uses: hits.length }
    })
    .sort((a, b) => (b.uses > 0) - (a.uses > 0) || a.name.localeCompare(b.name))
}

/** The size that fits `width` (and optionally `height`) keeping the ratio, never larger than the original unless asked */
export function fitSize(w, h, { width, height, upscale = false } = {}) {
  if (!(w > 0 && h > 0)) return { width: 0, height: 0 }
  let tw = Number(width) > 0 ? Number(width) : 0, th = Number(height) > 0 ? Number(height) : 0
  if (!tw && !th) return { width: w, height: h }
  const s = Math.min(tw ? tw / w : Infinity, th ? th / h : Infinity)
  const k = upscale ? s : Math.min(1, s)
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

/** The MIME type a replacement must have to keep the same file name (the site keeps linking to it) */
export const mimeFor = ext => ({ webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', gif: 'image/gif', avif: 'image/avif' }[String(ext).toLowerCase()] || '')
