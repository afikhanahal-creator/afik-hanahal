// What the chat's message menu can do besides copy, like WhatsApp: reply (quote a message — Green's sendMessage /
// sendFileByUrl take quotedMessageId), forward one or several messages to one or several chats (forwardMessages) and react
// with an emoji (sendReaction; an empty reaction takes it back). Pure checks of what the browser sends, shared by api/meta.js
// and the tests.

export const FORWARD_MAX_TO = 10      // chats per forward (one Green call each, a short gap between them)
export const FORWARD_MAX_MSGS = 10    // messages per forward
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

/** A quoted message's id for a reply → the extra body fields of sendMessage / sendFileByUrl ({} = no quote) */
export const quoteFields = id => { const q = cleanMsgId(id); return q ? { quotedMessageId: q } : {} }
