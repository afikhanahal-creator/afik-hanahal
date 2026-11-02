// What the chat's message menu can do besides copy, like WhatsApp: reply (quote a message — Green's sendMessage /
// sendFileByUrl take quotedMessageId), forward one or several messages to one or several chats (forwardMessages) and react
// with an emoji (sendReaction; an empty reaction takes it back). Pure checks of what the browser sends, shared by api/meta.js
// and the tests.

export const FORWARD_MAX_TO = 10      // chats per forward (one Green call each, a short gap between them)
export const FORWARD_MAX_MSGS = 30    // messages per forward (photos, files, texts — WhatsApp forwards up to 30)
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

/** A Green message id ("BAE5F4886AD46F2C", "3EB0…", "false_9725…@c.us_ABC") → the id, or '' */
export function cleanMsgId(id) {
  const s = String(id ?? '').trim()
  return /^[A-Za-z0-9_.:@-]{4,120}$/.test(s) && !/^opt-/.test(s) ? s : ''
}

/** A reaction: one emoji (with its modifiers), or '' = take the reaction back. Anything with letters or digits → null */
export function cleanReaction(r) {
  const s = String(r ?? '').trim()
  if (!s) return ''
  if (s.length > 16 || /[\p{L}\p{N}<>"'`]/u.test(s)) return null
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s) ? s : null
}

/**
 * The forward request → { from, to, ids } or { error }. `norm` turns a typed phone into Green's digits (972…); the source
 * chat is never a recipient, duplicates are dropped.
 */
export function forwardRequest(body = {}, norm = x => String(x || '').replace(/\D/g, '')) {
  const from = norm(body.from)
  if (!from) return { error: 'from (the chat the messages are in) is required' }
  const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(cleanMsgId).filter(Boolean))]
  if (!ids.length) return { error: 'no messages to forward' }
  if (ids.length > FORWARD_MAX_MSGS) return { error: `up to ${FORWARD_MAX_MSGS} messages at once` }
  const to = [...new Set((Array.isArray(body.to) ? body.to : []).map(norm).filter(p => p && p.length >= 11 && p !== from))]
  if (!to.length) return { error: 'no recipients' }
  if (to.length > FORWARD_MAX_TO) return { error: `up to ${FORWARD_MAX_TO} chats at once` }
  return { from, to, ids }
}

// ── Files as one group (POST /api/meta/chat-send-files): the browser uploads everything first, then the server sends the files
// one after another, so WhatsApp shows the photos / videos as one album. Up to 30 (WhatsApp's own limit for one send), https
// links only; the text is the first file's caption.
export const GROUP_MAX_FILES = 30
export function fileGroupRequest(body = {}, norm = x => String(x || '').replace(/\D/g, '')) {
  const phone = norm(body.phone)
  if (!phone) return { error: 'phone required' }
  const raw = Array.isArray(body.items) ? body.items : []
  if (!raw.length) return { error: 'no files' }
  if (raw.length > GROUP_MAX_FILES) return { error: `up to ${GROUP_MAX_FILES} files at once` }
  const items = []
  for (const it of raw) {
    const file = String(it?.file || '').trim()
    if (!/^https:\/\/[^\s]+$/i.test(file) || file.length > 2000) return { error: 'every file needs an https link' }
    const name = String(it?.fileName || '').replace(/[\\/\u0000-\u001f]/g, '').trim().slice(0, 120)
    items.push({ file, fileName: name || decodeURIComponent(file.split(/[?#]/)[0].split('/').pop() || 'file').slice(-120) })
  }
  return { phone, caption: String(body.caption || '').slice(0, 4000), items, ...quoteFields(body.quotedMessageId) }
}

/** A quoted message's id for a reply → the extra body fields of sendMessage / sendFileByUrl ({} = no quote) */
export const quoteFields = id => { const q = cleanMsgId(id); return q ? { quotedMessageId: q } : {} }

// ── "Handled" — a chat taken off "ממתינים לתשובה" by hand (answered by phone, nothing to answer, a "thanks"…). Kept once for
// everyone (app_settings.wa_waiting_done = { <last 9 digits>: <the lead's last message time, ms> }); the chat waits again as
// soon as the lead writes something newer. Entries older than 60 days are dropped.
const t9 = p => String(p || '').replace(/\D/g, '').slice(-9)
const asMs = v => (typeof v === 'number' ? v : Date.parse(v) || 0)
/** Was this waiting message (the lead's last one, at `ts`) marked handled? */
export function isHandled(done, phone, ts) {
  const d = done && done[t9(phone)]
  return !!d && asMs(ts) <= Number(d) + 999
}
/** done + [{ phone, ts }] → the new map (the newest time wins, old entries pruned) */
export function withHandled(done = {}, items = [], now = Date.now()) {
  const next = {}
  for (const [k, v] of Object.entries(done || {})) if (Number(v) > now - 60 * 864e5) next[k] = Number(v)
  for (const it of Array.isArray(items) ? items.slice(0, 300) : []) {
    const k = t9(it?.phone), ts = asMs(it?.ts)
    if (k.length === 9 && ts > 0) next[k] = Math.max(next[k] || 0, ts)
  }
  return next
}
/** done − phones (undo) */
export function withoutHandled(done = {}, phones = []) {
  const next = { ...(done || {}) }
  for (const p of phones) delete next[t9(p)]
  return next
}
