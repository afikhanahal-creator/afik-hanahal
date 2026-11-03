// Profile pictures (pure, tested in wa-avatar.test.mjs): when a cached picture link expires, when to ask again, and which
// channel a face comes from. WhatsApp's CDN links carry their expiry as `oe=<hex unix seconds>`, Messenger's lookaside links
// as `ext=<unix seconds>`, Instagram's CDN links as `oe=<hex>` too.

/** expiry of a profile-picture link (ms), else 24 h from now */
export function avatarExpiry(url, now = Date.now()) {
  try {
    const q = new URL(url).searchParams
    const oe = q.get('oe')
    const s = oe && /^[0-9a-f]+$/i.test(oe) ? parseInt(oe, 16) : 0
    if (s > 1e9) return s * 1000
    const ext = q.get('ext')
    const e = ext && /^\d+$/.test(ext) ? Number(ext) : 0
    if (e > 1e9) return e * 1000
  } catch {}
  return now + 864e5
}

/** a cached row is good: a picture until an hour before its link expires (and at most 3 days old); "no picture" for a day */
export function avatarFresh(row, now = Date.now()) {
  if (!row || !row.checked_at) return false
  const age = now - Date.parse(row.checked_at)
  if (row.url) return Date.parse(row.expires_at || 0) - now > 3600e3 && age < 3 * 864e5
  return age < 864e5
}

/** a Messenger / Instagram picture link is still good (an hour before it expires; a link without an expiry is trusted) */
export function socialAvatarFresh(url, now = Date.now()) {
  return /^https:\/\//.test(String(url || '')) && avatarExpiry(url, now) - now > 3600e3
}

/** "0501234567" / "+972-50-123-4567" / "972501234567@c.us" → "972501234567" ('' when it isn't a phone) */
export function avatarPhone(raw) {
  let d = String(raw || '').split('@')[0].replace(/\D/g, '')
  if (d.startsWith('0')) d = '972' + d.slice(1)
  return /^\d{10,15}$/.test(d) ? d : ''
}

/** a Messenger / Instagram thread id ('<platform>:<account>:<user>') as a face key, '' otherwise */
export function socialKey(raw) {
  const s = String(raw || '').trim()
  return /^(messenger|instagram):\d{3,25}:\d{3,25}$/.test(s) ? s : ''
}

/** the key a face is asked by: a WhatsApp number or a social thread id */
export function avatarKey(raw) { return socialKey(raw) || avatarPhone(raw) }

/** the thread id a CRM lead was made from (crm_data.social), '' when it wasn't */
export function leadSocialKey(lead) { return socialKey(lead?.crm_data?.social?.threadId || lead?.social?.threadId) }

/** which face to show: the number's picture first (WhatsApp's, or the social one the server found for the number), then
 *  the thread's. → { url, src, link } */
export function pickFace(wa, social) {
  if (wa?.url) return { url: wa.url, src: wa.src || 'whatsapp', link: wa.link || '' }
  if (social?.url) return { url: social.url, src: social.src || 'messenger', link: social.link || '' }
  return { url: '', src: '', link: '' }
}

/** the public profile a picture came from (Instagram only — Meta gives no Messenger profile address) */
export function profileLinkOf(platform, { username } = {}) {
  if (platform === 'instagram' && username) return `https://www.instagram.com/${String(username).replace(/^@/, '')}/`
  return ''
}
