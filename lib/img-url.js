// Property photo URLs — one rule for the app, the static homepage layer (lib/home-page.js) and the landing /
// share pages (lib/share-page.js), so a photo painted by the static HTML is reused by the app, never downloaded twice.
//
// Photos live in Supabase Storage (public buckets). They are served through the free image CDN wsrv.nl, which
// fetches the original straight from Supabase, resizes it and caches the result on Cloudflare. They must NOT go
// through a Vercel function (the old /media/<bucket>/<path> proxy): Vercel's free tier includes 10 GB a month of
// "Fast Origin Transfer" (bytes a function sends), and full-size originals (100 KB–5 MB each) burned through 75 %
// of it in days. Supabase is hit once per size per CDN location; visitors get a 20–80 KB WebP.
export const CDN_BASE = 'https://wsrv.nl/?url='
const SUPA_PUBLIC = '.supabase.co/storage/v1/object/public/'

// The original public Supabase URL of a photo (also undoes an old /media/<bucket>/<path> link when the
// Supabase origin is known) — '' for anything that isn't a public Supabase file
export function supabaseSource(url, supaOrigin = '') {
  const u = String(url || '').trim()
  const pub = u.indexOf(SUPA_PUBLIC)
  if (pub > 0) return u.split('?')[0]
  const m = /^(?:https?:\/\/[^/]+)?\/media\/(.+)$/.exec(u)
  if (m && supaOrigin) return `${String(supaOrigin).replace(/\/$/, '')}/storage/v1/object/public/${m[1].split('?')[0]}`
  return ''
}

// A resized WebP of a remote photo through the CDN (never upscaled)
export const cdnImg = (url, w, base = CDN_BASE) => (url && /^https?:\/\//.test(url) ? `${base}${encodeURIComponent(url)}&w=${w}&q=72&output=webp&we` : url)

// The card cover / gallery URL for a stored photo: Supabase → CDN at `width`; Cloudinary → its own resize;
// anything else as it is. Same string everywhere for the same photo and width.
export function photoUrl(url, width = 1200, base = CDN_BASE) {
  const u = String(url || '')
  if (!u || u.startsWith('data:') || u.startsWith('blob:')) return u
  const src = supabaseSource(u)
  if (src) return base ? cdnImg(src, width, base) : src
  if (u.includes('.supabase.co/storage/')) return u   // signed / private URLs stay as they are
  if (u.includes('cloudinary.com') && u.includes('/image/upload/') && !/\/(?:q_auto|q_\d|f_auto|fl_progressive)/.test(u)) return u.replace('/image/upload/', `/image/upload/w_${width},q_auto:good,f_auto/`)
  return u
}
