// Booking (our own Calendly): pure rules shared by the API and the tests — the meeting types, the office hours, free slots in
// Israel time (DST-safe) around what is already busy in the Google Calendar, validation of a request, and the calendar event.

export const TZ = 'Asia/Jerusalem'

export const DEFAULT_BOOKING = {
  title: { he: 'אפיק הנחל - ייזום שיווק ותיווך', en: 'Afik Hanahal - Development, Marketing & Brokerage' },
  calendarId: 'afik.hanahal@gmail.com',
  // per weekday (0 = Sunday … 6 = Saturday): [startHour, endHour) in Israel time, null = closed
  hours: { 0: [9, 19], 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 14], 6: null },   // = the office hours on the site (content/site.mjs)
  stepMin: 30,          // a slot starts every N minutes
  bufferMin: 10,        // free minutes kept before and after anything already in the calendar
  minNoticeMin: 120,    // no booking sooner than this
  horizonDays: 21,      // how far ahead people can book
  maxPerDay: 10,        // at most this many bookings a day through the page
  zoomUrl: '',          // the office's personal Zoom link (the Zoom option is shown only when it is set)
  photo: '/img/booking-portrait-2.webp', // the photo in the page's side panel (admin "תיאום פגישות" → "תמונה בעמוד"; '' = none)
  types: [
    {
      // a phone call: no email, no app — the office calls the number the client leaves (Meet / Zoom can be added in the admin)
      id: 'intro', minutes: 30, channels: ['phone'],
      he: 'שיחת היכרות', en: 'Intro call',
      he_desc: 'חצי שעה בטלפון להכיר: מה אתם מחפשים, באיזה אזור ובאיזה תקציב, ואיך אנחנו יכולים לעזור. אנחנו מתקשרים, בלי התחייבות.',
      en_desc: 'A half-hour phone call to get to know each other: what you are looking for, where and on what budget, and how we can help. We call you, no obligation.',
    },
  ],
}
export const CHANNELS = {
  meet: { he: 'Google Meet', en: 'Google Meet' },
  zoom: { he: 'זום', en: 'Zoom' },
  phone: { he: 'שיחת טלפון', en: 'Phone call' },
}

export function mergeBooking(saved = {}) {
  const s = saved && typeof saved === 'object' ? saved : {}
  return { ...DEFAULT_BOOKING, ...s, title: { ...DEFAULT_BOOKING.title, ...(s.title || {}) }, hours: { ...DEFAULT_BOOKING.hours, ...(s.hours || {}) }, types: Array.isArray(s.types) && s.types.length ? s.types : DEFAULT_BOOKING.types }
}

// ── Israel time ────────────────────────────────────────────────────────────────
const fmtParts = d => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(d).map(p => [p.type, p.value]))
/** 'YYYY-MM-DD' of an instant in Israel */
export const israelDate = d => { const p = fmtParts(d); return `${p.year}-${p.month}-${p.day}` }
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
export const israelWeekday = dateStr => WD[fmtParts(israelAt(dateStr, 12, 0)).weekday]
/** The instant of a wall-clock time in Israel (DST-safe: the offset is read for that very moment) */
export function israelAt(dateStr, hh, mm) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let t = guess
  for (let i = 0; i < 2; i++) {
    const p = fmtParts(new Date(t))
    const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
    t += guess - wall
  }
  return new Date(t)
}
export const addDays = (dateStr, n) => { const [y, m, d] = dateStr.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10) }

// ── Slots ──────────────────────────────────────────────────────────────────────
const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1

/**
 * Free start times per Israel date.
 * busy: [{ start, end }] (ISO or ms) from the calendar; bookedPerDay: { 'YYYY-MM-DD': n } from this page.
 * → { 'YYYY-MM-DD': ['2026-10-20T06:00:00.000Z', …] } for every date in [from, from + days)
 */
export function freeSlots({ cfg = DEFAULT_BOOKING, type, from, days, busy = [], bookedPerDay = {}, now = new Date() }) {
  const c = mergeBooking(cfg)
  const t = type || c.types[0]
  const len = (t.minutes || 30) * 60e3, buf = (c.bufferMin || 0) * 60e3, step = (c.stepMin || 30) * 60e3
  const earliest = now.getTime() + (c.minNoticeMin || 0) * 60e3
  const latest = now.getTime() + (c.horizonDays || 21) * 864e5
  const blocks = busy.map(b => [new Date(b.start).getTime() - buf, new Date(b.end).getTime() + buf]).filter(([a, b]) => b > a)
  const out = {}
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i)
    const h = c.hours[israelWeekday(date)]
    out[date] = []
    if (!h || (bookedPerDay[date] || 0) >= c.maxPerDay) continue
    const open = israelAt(date, Math.floor(h[0]), Math.round((h[0] % 1) * 60)).getTime()
    const close = israelAt(date, Math.floor(h[1]), Math.round((h[1] % 1) * 60)).getTime()
    for (let s = open; s + len <= close; s += step) {
      if (s < earliest || s > latest) continue
      if (blocks.some(([a, b]) => overlaps(s, s + len, a, b))) continue
      out[date].push(new Date(s).toISOString())
    }
  }
  return out
}

// ── A booking request ──────────────────────────────────────────────────────────
export const normPhone = raw => { const d = String(raw || '').replace(/\D/g, ''); return d.startsWith('972') ? '0' + d.slice(3) : d }
const PHONE_OK = /^0(5\d{8}|[2-489]\d{7}|7\d{8})$/
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** → { ok: true, value } | { ok: false, errors: { field: code } } */
export function validateBooking(body = {}, cfg = DEFAULT_BOOKING) {
  const c = mergeBooking(cfg)
  const errors = {}
  const type = c.types.find(x => x.id === body.type) || null
  if (!type) errors.type = 'unknown'
  const channels = type ? type.channels.filter(ch => ch !== 'zoom' || c.zoomUrl) : []
  const channel = String(body.channel || '')
  if (!channels.includes(channel)) errors.channel = 'unknown'
  const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  if (name.length < 2) errors.name = 'required'
  const phone = normPhone(body.phone)
  if (!PHONE_OK.test(phone)) errors.phone = 'invalid'
  const email = String(body.email || '').trim().toLowerCase().slice(0, 120)
  if (email && !EMAIL_OK.test(email)) errors.email = 'invalid'
  if ((channel === 'meet' || channel === 'zoom') && !email) errors.email = 'required'   // the invite and the link go by email
  const start = new Date(body.start || '')
  if (Number.isNaN(start.getTime())) errors.start = 'invalid'
  if (String(body.website || '').trim()) errors.spam = 'honeypot'
  if (Object.keys(errors).length) return { ok: false, errors }
  const end = new Date(start.getTime() + type.minutes * 60e3)
  return { ok: true, value: { type, channel, name, phone, email, notes: String(body.notes || '').trim().slice(0, 1000), start: start.toISOString(), end: end.toISOString(), lang: body.lang === 'en' ? 'en' : 'he', ref: String(body.ref || '').slice(0, 64) } }
}

/** Is this start one of today's free slots? (the page shows slots, the server re-checks them before booking) */
export function slotIsFree(start, slots) {
  const iso = new Date(start).toISOString()
  return Object.values(slots).some(list => list.includes(iso))
}

const whenText = (iso, lang) => new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
export { whenText }

/**
 * Extra guests for a meeting's invitation: emails from a list or a pasted string (commas, spaces, new lines), lower-cased,
 * de-duplicated, the client's own email left out → { list, bad } (at most 20)
 */
export function guestList(input, { exclude = [] } = {}) {
  const raw = (Array.isArray(input) ? input : String(input || '').split(/[\s,;]+/)).map(x => String(x || '').trim().toLowerCase()).filter(Boolean)
  const skip = new Set(exclude.filter(Boolean).map(x => String(x).trim().toLowerCase()))
  const list = [], bad = []
  for (const x of raw) {
    if (!EMAIL_OK.test(x)) { if (!bad.includes(x)) bad.push(x); continue }
    if (!skip.has(x) && !list.includes(x)) list.push(x)
  }
  return { list: list.slice(0, 20), bad }
}
/** The event's attendees: the client (when they left an email) and the office's extra guests */
export function eventAttendees(b) {
  const out = b.email ? [{ email: String(b.email).trim(), displayName: b.name }] : []
  for (const g of b.guests || []) if (!out.some(a => a.email.toLowerCase() === g)) out.push({ email: g })
  return out
}

/** The Google Calendar event for a validated booking */
export function bookingEvent(b, cfg = DEFAULT_BOOKING) {
  const c = mergeBooking(cfg)
  const typeName = b.type.he
  const ch = CHANNELS[b.channel]?.he || b.channel
  const lines = [
    `${typeName} עם ${b.name} (${ch})`,
    `טלפון: ${b.phone}`,
    b.email ? `אימייל: ${b.email}` : '',
    b.channel === 'phone' ? `אנחנו מתקשרים ל-${b.phone}` : '',
    b.channel === 'zoom' && c.zoomUrl ? `זום: ${c.zoomUrl}` : '',
    b.notes ? `\nמה כתבו: ${b.notes}` : '',
    '\nנקבע דרך עמוד התיאום באתר אפיק הנחל.',
  ].filter(Boolean)
  return {
    summary: `${typeName} · ${b.name}`,
    description: lines.join('\n'),
    start: { dateTime: b.start, timeZone: TZ },
    end: { dateTime: b.end, timeZone: TZ },
    ...(eventAttendees(b).length ? { attendees: eventAttendees(b) } : {}),
    ...(b.channel === 'zoom' && c.zoomUrl ? { location: c.zoomUrl } : b.channel === 'phone' ? { location: `טלפון: ${b.phone}` } : {}),
    ...(b.channel === 'meet' ? { conferenceData: { createRequest: { requestId: `afik-${Date.parse(b.start)}-${b.phone.slice(-4)}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }, { method: 'email', minutes: 60 }] },
    extendedProperties: { private: { afikBooking: '1', bookingType: b.type.id, channel: b.channel, phone: b.phone } },
  }
}

/**
 * What changed in a booking's event in Google Calendar → { cancel: true } (the office deleted / cancelled it there) |
 * { cancel: true, by: 'guest' } (the client declined or removed the invitation) | { move: { start, end } } (dragged to
 * another time) | null (nothing changed, or no answer to go by)
 */
export function calendarChange(entry, ev) {
  if (!entry || !ev) return null
  if (ev.deleted || ev.status === 'cancelled') return { cancel: true }
  // the client removed the invitation from their own calendar (or pressed "No"): Google keeps the event in ours and
  // would still remind the office, so the call counts as cancelled by the client
  const mail = String(entry.email || '').trim().toLowerCase()
  const guest = mail ? (ev.attendees || []).find(a => String(a.email || '').trim().toLowerCase() === mail) : null
  if (guest?.responseStatus === 'declined') return { cancel: true, by: 'guest' }
  const s = ev.start?.dateTime, e = ev.end?.dateTime
  if (!s || !e || !Number.isFinite(Date.parse(s)) || !Number.isFinite(Date.parse(e))) return null   // an all-day event: leave it
  if (Date.parse(s) === Date.parse(entry.start) && Date.parse(e) === Date.parse(entry.end)) return null
  return { move: { start: new Date(s).toISOString(), end: new Date(e).toISOString() } }
}

/** "Add to Google Calendar" link for the confirmation screen (when no invite goes by email) */
export function googleCalendarLink(b, { title, details = '', location = '' } = {}) {
  const f = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${f(b.start)}/${f(b.end)}`, details, location, ctz: TZ })
  return `https://calendar.google.com/calendar/render?${q}`
}

// ── Managing a booking (the client's own link: details, reschedule, cancel) ────────────────────────────────────
export const SITE = 'https://www.afikhanahal.co.il'
export const MAX_RESCHEDULES = 5

/** The client's private key "<id>.<token>" → { id, token } | null */
export function parseManageKey(m) {
  const x = /^([a-f0-9]{8,32})\.([A-Za-z0-9_-]{16,64})$/.exec(String(m || '').trim())
  return x ? { id: x[1], token: x[2] } : null
}
export const manageKey = entry => (entry?.id && entry?.token ? `${entry.id}.${entry.token}` : '')
export const manageUrl = (entry, lang = entry?.lang) => (manageKey(entry) ? `${SITE}/book?m=${manageKey(entry)}${lang === 'en' ? '&lang=en' : ''}` : '')

/** Can the client still move / cancel it? → { ok } | { ok: false, reason: 'cancelled' | 'past' | 'limit' } */
export function canChange(entry, now = new Date()) {
  if (!entry || entry.status === 'cancelled') return { ok: false, reason: 'cancelled' }
  if (Date.parse(entry.start) <= now.getTime()) return { ok: false, reason: 'past' }
  if ((entry.history || []).filter(h => h.kind === 'moved').length >= MAX_RESCHEDULES) return { ok: false, reason: 'limit' }
  return { ok: true }
}

/** Busy blocks without [start, end) — the booking that is being moved must not block its own new time */
export function subtractInterval(busy = [], start, end) {
  const a = Date.parse(start), b = Date.parse(end)
  const out = []
  for (const x of busy) {
    const s = Date.parse(x.start), e = Date.parse(x.end)
    if (e <= a || s >= b) { out.push(x); continue }
    if (s < a) out.push({ start: x.start, end: new Date(a).toISOString() })
    if (e > b) out.push({ start: new Date(b).toISOString(), end: x.end })
  }
  return out
}

/** What the client's page shows (the token holder sees their own details, nothing of the office's) */
export function bookingView(entry, cfg = DEFAULT_BOOKING, now = new Date()) {
  const c = mergeBooking(cfg)
  const type = c.types.find(t => t.id === entry.type) || { id: entry.type, he: entry.typeName || 'פגישה', en: 'Meeting', minutes: Math.round((Date.parse(entry.end) - Date.parse(entry.start)) / 60e3) }
  const ch = canChange(entry, now)
  return {
    id: entry.id, status: entry.status === 'cancelled' ? 'cancelled' : Date.parse(entry.end) <= now.getTime() ? 'past' : 'booked',
    start: entry.start, end: entry.end, channel: entry.channel, lang: entry.lang === 'en' ? 'en' : 'he',
    type: { id: type.id, he: type.he, en: type.en, minutes: type.minutes, he_desc: type.he_desc || '', en_desc: type.en_desc || '' },
    name: entry.name, phone: entry.phone, email: entry.email || '', notes: entry.notes || '',
    meetLink: entry.meetLink || '', zoomUrl: entry.channel === 'zoom' ? c.zoomUrl : '',
    inCalendar: !!entry.eventId, invite: !!(entry.email && entry.eventId),
    whatsapp: !!entry.wa?.ok, emailed: !!entry.mail?.ok,
    moved: (entry.history || []).filter(h => h.kind === 'moved').length,
    canChange: ch.ok, why: ch.ok ? '' : ch.reason,
  }
}

// ── What the client wrote → the lead card's "what they are looking for" fields ──────────────────────────────────────
const DEAL_WORDS = [[/(^|[\sו])(לקנות|קנייה|קניה|לרכוש|רכישה|buy|buying|purchase)/i, 'buy'], [/(^|[\sו])(למכור|מכירה|מוכרים|sell|selling)/i, 'sell'], [/(^|[\sו])(לשכור|שכירות|להשכיר|השכרה|rent|renting)/i, 'rent'], [/(^|[\sו])(להשקיע|השקעה|משקיע|invest)/i, 'invest']]
const PROP_WORDS = [['פנטהאוז', /פנטהאוז|penthouse/i], ['דופלקס', /דופלקס|duplex/i], ['דירת גן', /דירת גן|garden apartment/i], ['דירה', /דירה|דירות|apartment|flat/i], ['בית פרטי', /בית פרטי|בתים|וילה|house|villa/i], ['מגרש', /מגרש|מגרשים|plot/i], ['קרקע', /קרקע|קרקעות|land/i], ['פרדס', /פרדס(?!\s*חנה)|פרדסים|orchard/i], ['משרד', /משרד|משרדים|office/i], ['חנות', /חנות|מסחרי|commercial|shop/i]]
const PREFIX = '(?:^|[\\s,.(\\-–])(?:[בלמוהש]|מה|וב|ול|ומ)?'
/**
 * The booking's free text ("לקנות פרדסים בפרדס חנה, עד 3 מיליון, 4 חדרים") → { dealType, propertyType, area, budget, rooms }
 * (only what was found). `cities` = the list of Israeli towns (longest names are tried first).
 */
export function notesToNeeds(text = '', cities = []) {
  const s = String(text || '').slice(0, 1000)
  if (!s.trim()) return {}
  const out = {}
  for (const [re, v] of DEAL_WORDS) if (re.test(s)) { out.dealType = v; break }
  for (const [v, re] of PROP_WORDS) if (re.test(s)) { out.propertyType = v; break }
  // "פרדס חנה-כרכור" is also found as "פרדס חנה", "תל אביב - יפו" as "תל אביב"
  const names = []
  for (const c of cities) {
    if (!c || c.length < 3) continue
    names.push([c, c])
    const head = c.split(/\s*[-–]\s*/)[0].trim()
    if (head !== c && head.length > 3) names.push([head, c])
  }
  names.sort((a, b) => b[0].length - a[0].length || (a[0] === a[1] ? -1 : 0) - (b[0] === b[1] ? -1 : 0))
  for (const [name, full] of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`${PREFIX}${esc}(?=$|[\\s,.)\\-–])`).test(s)) { out.area = full; break }
  }
  const m = /(\d+(?:\.\d+)?)\s*(?:-|–|עד)?\s*(?:(\d+(?:\.\d+)?)\s*)?(מיליון|מליון|million|m\b)/i.exec(s)
  if (m) out.budget = Math.round(parseFloat(m[2] || m[1]) * 1e6)
  else { const k = /(\d{3,4})\s*(?:אלף|k\b)/i.exec(s); if (k) out.budget = parseInt(k[1], 10) * 1000 }
  const r = /(\d(?:\.5)?)\s*(?:חדרים|חד׳|חד'|rooms?)/i.exec(s)
  if (r) out.rooms = r[1]
  return out
}
