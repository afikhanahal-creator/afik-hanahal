// Files sent on WhatsApp are downloaded by Green API from the URL we give it — once per message. A template's picture in a
// 200-recipient bulk send was 200 downloads from Supabase Storage, and a 41 MB property video would have been 8 GB (the free
// plan's egress is 5 GB a month). Green can keep a file itself (uploadFile → its own URL, kept 15 days), so a file that goes
// out more than once is uploaded to Green once and every later message points at Green's copy. Pure rules here; the I/O is
// greenHosted() in lib/automations.js, the map lives in app_settings 'green_hosted'.
export const HOST_BIG = 2e6            // this size or more: hosted at Green from the first send
export const HOST_MIN = 200e3          // this size or more: hosted from the second send
export const HOST_TTL = 13 * 864e5     // Green keeps an uploaded file 15 days; renew it before that
export const HOST_MAX_ENTRIES = 300

/** What to do with one of our files before sending it: 'green' (use entry.green) · 'upload' · 'direct' (pure) */
export function hostDecision(entry, size, now = Date.now()) {
  if (entry?.green && now - (entry.at || 0) < HOST_TTL) return 'green'
  const s = Number(size) || Number(entry?.size) || 0
  if (!s) return 'direct'                                    // size unknown: never hold a send up
  if (s >= HOST_BIG) return 'upload'
  if (s >= HOST_MIN && (entry?.n || 0) >= 1) return 'upload'
  return 'direct'
}

/** The map after a send: counts, the Green copy, oldest entries dropped (pure) */
export function noteHosted(map, url, patch, now = Date.now(), max = HOST_MAX_ENTRIES) {
  const prev = (map && map[url]) || {}
  const next = { ...(map || {}), [url]: { ...prev, ...patch, n: (prev.n || 0) + 1, seen: now } }
  const keys = Object.keys(next)
  if (keys.length <= max) return next
  return Object.fromEntries(keys.sort((a, b) => (next[b].seen || 0) - (next[a].seen || 0)).slice(0, max).map(k => [k, next[k]]))
}

/** Is this URL a public file in our own Supabase Storage? (pure) */
export const isOurStorage = (url, supaUrl) => !!supaUrl && typeof url === 'string' && url.startsWith(`${String(supaUrl).replace(/\/$/, '')}/storage/v1/object/public/`)
