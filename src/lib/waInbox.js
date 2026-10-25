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
  if (t) return t.length > 140 ? t.slice(0, 139) + '…' : t
  const en = lang === 'en'
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
