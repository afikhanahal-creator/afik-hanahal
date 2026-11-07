// Pure helpers of the WhatsApp inbox (tested in waInbox.test.mjs): who is waiting for our answer and for how long, and the
// words of a message alert. Used by the chats tab (filters, "waiting 12 min" chips) and the admin's notifications.

/** The last message of a chat, from the loaded messages and / or the chat list's row (whichever is newer) →
 *  { dir: 'in' | 'out', ts (ms), text } | null */
export function lastOfChat(msgs = [], row = null) {
  const m = msgs.length ? msgs[msgs.length - 1] : null
  const a = m ? { dir: m.direction === 'out' ? 'out' : 'in', ts: Date.parse(m.created_at) || 0, text: m.message || '' } : null
  const b = row && row.timestamp ? { dir: row.type === 'outgoing' ? 'out' : 'in', ts: row.timestamp * 1000, text: row.text || '' } : null
  if (!a) return b
  if (!b) return a
  return b.ts > a.ts ? b : a
}

/** Is the lead waiting for us? The last word is theirs, within the last `maxDays`. level: fresh < 10 min ≤ warn < 60 min ≤ late */
export function waitingState(last, now = Date.now(), { maxDays = 7 } = {}) {
  if (!last || last.dir !== 'in' || !last.ts) return { waiting: false, mins: 0, level: '' }
  const mins = Math.max(0, Math.floor((now - last.ts) / 60e3))
  if (mins > maxDays * 1440) return { waiting: false, mins, level: '' }
  return { waiting: true, mins, level: mins >= 60 ? 'late' : mins >= 10 ? 'warn' : 'fresh' }
}

/** "עכשיו" / "ממתין 12 דק׳" / "ממתין 3 שע׳" / "ממתין 2 ימים" — short, for a chip */
export function fmtWait(mins, lang = 'he') {
  const en = lang === 'en'
  if (mins < 1) return en ? 'just now' : 'עכשיו'
  if (mins < 60) return en ? `waiting ${mins} min` : `ממתין ${mins} דק׳`
  const h = Math.floor(mins / 60)
  if (h < 24) return en ? `waiting ${h} h` : `ממתין ${h} שע׳`
  const d = Math.floor(h / 24)
  return en ? `waiting ${d} day${d > 1 ? 's' : ''}` : d === 1 ? 'ממתין יום' : `ממתין ${d} ימים`
}

/** A message as one line for an alert: text, or what was sent ("📷 תמונה") */
export function alertText(it = {}, lang = 'he') {
  const t = String(it.textMessage || it.caption || it.message || '').replace(/\s+/g, ' ').trim()
  const en = lang === 'en'
  if ((it.typeMessage || it.kind) === 'reactionMessage') return t ? (en ? `Reacted ${t}` : `תגובה: ${t}`) : (en ? 'Reaction removed' : 'הסירו תגובה')
  if (t) return t.length > 140 ? t.slice(0, 139) + '…' : t
  const kind = it.typeMessage || ''
  if (kind === 'imageMessage') return en ? '📷 Photo' : '📷 תמונה'
  if (kind === 'videoMessage') return en ? '🎥 Video' : '🎥 סרטון'
  if (kind === 'audioMessage') return en ? '🎤 Voice message' : '🎤 הודעה קולית'
  if (kind === 'documentMessage') return en ? '📎 Document' : '📎 מסמך'
  if (kind === 'locationMessage') return en ? '📍 Location' : '📍 מיקום'
  if (kind === 'contactMessage') return en ? '👤 Contact' : '👤 איש קשר'
  if (kind === 'stickerMessage') return en ? 'Sticker' : 'מדבקה'
  return en ? 'New message' : 'הודעה חדשה'
}

/** Merge one more incoming message into the alerts list (one alert per chat: the count grows, the text is the newest) */
export function mergeAlert(list = [], a) {
  const i = list.findIndex(x => x.phone === a.phone)
  if (i < 0) return [...list, { ...a, count: a.count || 1 }]
  const cur = list[i]
  if (cur.ids?.includes(a.ids?.[0])) return list
  const next = { ...cur, ...a, count: (cur.count || 1) + 1, ids: [...(cur.ids || []), ...(a.ids || [])].slice(-20), id: cur.id }
  return [...list.slice(0, i), ...list.slice(i + 1), next]
}

/** Fold live messages (Green's shape + phone) into the "waiting for us" map (tail9 → { phone, ts, text, type }): a message that
 *  comes in marks its chat, one we send clears it; an older message never overrides a newer one, reactions don't count. Returns
 *  the same map when nothing changed. */
export function applyWaiting(map, msgs = []) {
  let next = map
  const t9 = p => String(p || '').replace(/\D/g, '').slice(-9)
  for (const m of [...msgs].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))) {
    if (!m || m.typeMessage === 'reactionMessage') continue
    const k = t9(m.phone || m.chatId)
    if (k.length !== 9) continue
    const ts = (Number(m.timestamp) || 0) * 1000
    const cur = next.get(k)
    if (m.type === 'incoming') {
      if (!cur || ts > cur.ts) { if (next === map) next = new Map(map); next.set(k, { phone: m.phone, ts, text: String(m.textMessage || m.caption || '').slice(0, 140), type: m.typeMessage || '' }) }
    } else if (m.type === 'outgoing') {
      if (cur && ts >= cur.ts) { if (next === map) next = new Map(map); next.delete(k) }
    }
  }
  return next
}

const tail = p => String(p || '').replace(/\D/g, '').slice(-9)
const ms = v => (typeof v === 'number' ? v : Date.parse(v || '') || 0)

/** The chat list's rows: one per phone number (the last 9 digits). Several CRM leads with the same number — duplicates,
 *  test leads — used to be one row each, all showing the same chat (2026-11-07); the newest lead names the row. Each row
 *  carries the server's latest message of that chat (`glast`, from chat-list) so a stale local copy never hides it.
 *  leads: CRM rows; greenChats: chat-list rows { phone, name, waName, office, self, timestamp (s), type, text } */
export function chatRows(leads = [], greenChats = []) {
  const byTail = new Map()
  for (const c of greenChats) { const k = tail(c?.phone); if (k && !byTail.has(k)) byTail.set(k, c) }
  const glast = g => (g?.timestamp ? { id: `g:${g.phone}:${g.timestamp}`, message: g.text || '', created_at: new Date(g.timestamp * 1000).toISOString(), direction: g.type === 'outgoing' ? 'out' : 'in', status: g.type === 'outgoing' ? 'sent' : undefined } : null)
  const one = new Map()
  for (const l of leads) {
    const k = tail(l?.phone)
    if (!k) continue
    const prev = one.get(k)
    if (!prev || ms(l.created_at) > ms(prev.created_at)) one.set(k, l)
  }
  const rows = []
  for (const [k, l] of one) {
    const g = byTail.get(k)
    rows.push(g ? { ...l, name: (l.name || '').trim() || g.name || '', waName: g.waName, office: g.office, self: g.self, lastTs: g.timestamp * 1000, lastText: g.text, glast: glast(g) } : l)
  }
  for (const [k, c] of byTail) {
    if (one.has(k)) continue
    rows.push({ id: `wa:${c.phone}`, name: c.name || '', waName: c.waName, office: c.office, self: c.self, phone: c.phone, waOnly: true, lastTs: c.timestamp * 1000, lastText: c.text, glast: glast(c) })
  }
  return rows
}

/** The row's last message: the one this screen holds, unless the server's list knows a newer one (a screen asleep all night) */
export function rowLast(local, row) {
  const g = row?.glast
  if (!g) return local || null
  if (!local) return g
  return ms(g.created_at) > ms(local.created_at) + 1000 ? g : local
}
/** When the chat last moved (for the list's order): the newer of this screen's copy and the server's list */
export const rowTime = (local, row) => Math.max(ms(local?.created_at), row?.lastTs || 0)
