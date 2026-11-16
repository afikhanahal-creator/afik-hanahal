// "קשר אחרון בוואטסאפ" — the leads table's column (2026-11-16, the office: "a column that shows when we were last in touch on
// WhatsApp"). Pure and tested (waLastFormat.test.mjs): the newest message each way per phone (afik_wa_last) → what the cell says.

const IL = 'Asia/Jerusalem'
const dayKey = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: IL })
const hm = (ms) => new Date(ms).toLocaleTimeString('en-GB', { timeZone: IL, hour: '2-digit', minute: '2-digit', hour12: false })

/** The live feed's messages → the map, newest each way per phone (tail 9 digits). Returns the same map when nothing changed. */
export function applyWaLast(map, msgs = []) {
  let next = map
  for (const m of msgs || []) {
    if (!m || m.typeMessage === 'reactionMessage') continue
    const k = String(m.phone || m.chatId || '').replace(/\D/g, '').slice(-9)
    if (k.length !== 9) continue
    const ts = (Number(m.timestamp) || 0) * 1000
    const side = m.type === 'incoming' ? 'in' : m.type === 'outgoing' ? 'out' : ''
    if (!side || !ts) continue
    const cur = next.get(k) || { in: 0, out: 0 }
    if (ts <= (cur[side] || 0)) continue
    if (next === map) next = new Map(map)
    next.set(k, { ...cur, [side]: ts })
  }
  return next
}

/**
 * { in, out } (ms, either may be 0) → what the cell shows, or null when there is no message at all:
 * { at, dir: 'in' | 'out', when: "היום 14:32" | "אתמול 09:05" | "08.11 · 14:32" | "08.11.25", ago: "לפני 3 שע׳", tone, full }
 * tone: 'fresh' under 3 days · 'mid' under 7 · 'old' after — the same scale as the lead card's "קשר אחרון".
 */
export function waLastInfo(entry, now = Date.now(), lang = 'he') {
  const inn = Number(entry?.in) || 0, out = Number(entry?.out) || 0
  const at = Math.max(inn, out)
  if (!at) return null
  const en = lang === 'en'
  const dir = inn > out ? 'in' : 'out'
  const today = dayKey(now), d = dayKey(at)
  const yesterday = dayKey(now - 864e5)
  const sameYear = d.slice(0, 4) === today.slice(0, 4)
  const [y, mo, da] = d.split('-')
  const when = d === today ? `${en ? 'Today' : 'היום'} ${hm(at)}`
    : d === yesterday ? `${en ? 'Yesterday' : 'אתמול'} ${hm(at)}`
      : sameYear ? `${da}.${mo} · ${hm(at)}` : `${da}.${mo}.${y.slice(2)}`
  const ago = agoText(now - at, en)
  const days = (now - at) / 864e5
  const tone = days < 3 ? 'fresh' : days < 7 ? 'mid' : 'old'
  const who = dir === 'in' ? (en ? 'they wrote' : 'הם כתבו') : (en ? 'we wrote' : 'אנחנו כתבנו')
  const full = new Date(at).toLocaleString(en ? 'en-GB' : 'he-IL', { timeZone: IL, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return { at, dir, when, ago, tone, who, full }
}

/** 90 s → "לפני 2 דק׳", 5 h → "לפני 5 שע׳", 3 d → "לפני 3 ימים" */
export function agoText(ms, en = false) {
  const m = Math.max(0, Math.round(ms / 60000))
  if (m < 1) return en ? 'just now' : 'עכשיו'
  if (m < 60) return en ? `${m} min ago` : `לפני ${m} דק׳`
  const h = Math.round(m / 60)
  if (h < 24) return en ? `${h} h ago` : h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : `לפני ${h} שע׳`
  const d = Math.round(h / 24)
  if (d < 60) return en ? `${d} days ago` : d === 1 ? 'לפני יום' : d === 2 ? 'לפני יומיים' : `לפני ${d} ימים`
  const mo = Math.round(d / 30)
  return en ? `${mo} months ago` : `לפני ${mo} חודשים`
}

/** For sorting: the newest message time (0 = never) */
export const waLastAt = (entry) => Math.max(Number(entry?.in) || 0, Number(entry?.out) || 0)

