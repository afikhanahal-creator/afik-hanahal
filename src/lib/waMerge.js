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
