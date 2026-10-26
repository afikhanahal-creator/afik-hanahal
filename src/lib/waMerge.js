// Pure helpers of the live WhatsApp chats (src/lib/waLive.js), tested in waLive.test.mjs
export const tail9 = p => String(p || '').replace(/\D/g, '').slice(-9)

/** Merge live items into a chat's normalized list (by id: a new message is added, a status moves forward) */
const RANK = { failed: -1, pending: 0, sent: 1, delivered: 2, read: 3, played: 4 }
export function mergeLive(list = [], items = [], normalize) {
  const byId = new Map(list.map(m => [m.id, m]))
  let changed = false
  for (const raw of items) {
    const m = normalize(raw)
    const have = byId.get(m.id)
    if (!have) { byId.set(m.id, m); changed = true }
    else if (m.direction === 'out' && (RANK[m.status] ?? 0) > (RANK[have.status] ?? 0)) { byId.set(m.id, { ...have, status: m.status }); changed = true }
  }
  return changed ? [...byId.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) : list
}

/**
 * WhatsApp reactions, the way WhatsApp shows them: not as a message of their own but as an emoji on the message they react to.
 * msgs = normalized messages (normalizeGreenMsg: kind, message, reactedTo, direction, created_at). Each side keeps one reaction per
 * message (the newest wins, an empty one takes it back). → the list without reaction items, the target carrying
 * reactions: [{ emoji, dir, at }]. A reaction whose message isn't in the list stays as a small item (kind 'reactionMessage',
 * orphan: true); an empty orphan is dropped.
 */
export function foldReactions(msgs = []) {
  const list = Array.isArray(msgs) ? msgs : []
  if (!list.some(m => m?.kind === 'reactionMessage')) return list
  const ids = new Set(list.filter(m => m?.kind !== 'reactionMessage').map(m => m.id))
  const per = new Map()          // target id → Map(dir → { emoji, dir, at })
  const orphans = []
  const ordered = list.filter(m => m?.kind === 'reactionMessage').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  for (const r of ordered) {
    const emoji = String(r.message || '').trim()
    if (!r.reactedTo || !ids.has(r.reactedTo)) { if (emoji) orphans.push({ ...r, message: emoji, orphan: true }); continue }
    const m = per.get(r.reactedTo) || new Map()
    if (emoji) m.set(r.direction, { emoji, dir: r.direction, at: r.created_at })
    else m.delete(r.direction)
    per.set(r.reactedTo, m)
  }
  const out = []
  for (const m of list) {
    if (m?.kind === 'reactionMessage') continue
    const rs = per.get(m.id)
    out.push(rs && rs.size ? { ...m, reactions: [...rs.values()] } : m)
  }
  return orphans.length ? [...out, ...orphans].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) : out
}
