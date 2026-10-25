// WhatsApp profile pictures (pure, tested in wa-avatar.test.mjs): when a cached picture link expires and when to ask again.
// WhatsApp's CDN links carry their own expiry as `oe=<hex unix seconds>`.

/** expiry of a pps.whatsapp.net link (ms), else 24 h from now */
export function avatarExpiry(url, now = Date.now()) {
  try {
    const oe = new URL(url).searchParams.get('oe')
    const s = oe && /^[0-9a-f]+$/i.test(oe) ? parseInt(oe, 16) : 0
    if (s > 1e9) return s * 1000
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

/** "0501234567" / "+972-50-123-4567" / "972501234567@c.us" → "972501234567" ('' when it isn't a phone) */
export function avatarPhone(raw) {
  let d = String(raw || '').split('@')[0].replace(/\D/g, '')
  if (d.startsWith('0')) d = '972' + d.slice(1)
  return /^\d{10,15}$/.test(d) ? d : ''
}
