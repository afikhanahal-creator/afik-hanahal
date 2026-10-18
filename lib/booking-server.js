// Booking page, server side (api/meta.js → booking-*): settings, free slots, a booking (calendar event + CRM lead + office
// alert + WhatsApp confirmation to the client), the admin list and cancellation.
// Every booking is also kept in app_settings 'booking_log', so the page never double-books even before the calendar is
// connected (then the office confirms by hand).

import crypto from 'crypto'
import { mergeBooking, freeSlots, validateBooking, slotIsFree, bookingEvent, israelDate, addDays, whenText, CHANNELS, TZ } from './booking.js'
import * as GCal from './google-calendar.js'
import { getSetting, putSetting, findLeadByPhone, notifyTeam, sendText } from './automations.js'
import { hebrewFirstName, isLatinName } from './hebrew-names.js'

const CFG_KEY = 'booking_config'
const LOG_KEY = 'booking_log'
const LOG_KEEP = 500
const nowIso = () => new Date().toISOString()

export async function loadConfig() {
  return mergeBooking((await getSetting(CFG_KEY)).value || {})
}
const clean = (v, n) => String(v ?? '').trim().slice(0, n)
/** Admin save: only the fields the settings card edits */
export async function saveConfig(patch = {}) {
  const cur = (await getSetting(CFG_KEY)).value || {}
  const next = { ...cur }
  if (patch.zoomUrl !== undefined) {
    const z = clean(patch.zoomUrl, 300)
    if (z && !/^https:\/\/[\w.-]*zoom\.(us|com)\//i.test(z)) throw new Error('קישור זום לא תקין (צריך להתחיל ב-https://…zoom.us/)')
    next.zoomUrl = z
  }
  if (patch.calendarId !== undefined) next.calendarId = clean(patch.calendarId, 120) || 'primary'
  for (const k of ['stepMin', 'bufferMin', 'minNoticeMin', 'horizonDays', 'maxPerDay']) {
    if (patch[k] !== undefined && Number.isFinite(+patch[k])) next[k] = Math.max(0, Math.min(k === 'minNoticeMin' ? 10080 : k === 'horizonDays' ? 90 : 240, Math.round(+patch[k])))
  }
  if (next.stepMin !== undefined) next.stepMin = Math.max(10, next.stepMin)
  if (patch.hours && typeof patch.hours === 'object') {
    next.hours = {}
    for (let d = 0; d < 7; d++) {
      const h = patch.hours[d]
      next.hours[d] = Array.isArray(h) && +h[1] > +h[0] && +h[0] >= 0 && +h[1] <= 24 ? [+h[0], +h[1]] : null
    }
  }
  if (Array.isArray(patch.types) && patch.types.length) {
    next.types = patch.types.slice(0, 8).map((t, i) => ({
      id: clean(t.id, 30).replace(/[^\w-]/g, '') || `t${i}`,
      minutes: Math.max(10, Math.min(240, Math.round(+t.minutes || 30))),
      channels: (Array.isArray(t.channels) ? t.channels : []).filter(c => CHANNELS[c]),
      he: clean(t.he, 60), en: clean(t.en, 60), he_desc: clean(t.he_desc, 400), en_desc: clean(t.en_desc, 400),
      ...(t.hidden ? { hidden: true } : {}),
    })).filter(t => t.he && t.channels.length)
  }
  await putSetting(CFG_KEY, next)
  return mergeBooking(next)
}

async function readLog() {
  const v = (await getSetting(LOG_KEY)).value
  return Array.isArray(v) ? v : []
}
const active = b => b.status !== 'cancelled'

/** What the public page needs (no secrets) */
export function publicConfig(cfg, connected) {
  return {
    title: cfg.title, tz: TZ, horizonDays: cfg.horizonDays, connected,
    types: cfg.types.filter(t => !t.hidden).map(t => ({ id: t.id, minutes: t.minutes, he: t.he, en: t.en, he_desc: t.he_desc, en_desc: t.en_desc, channels: t.channels.filter(c => c !== 'zoom' || cfg.zoomUrl) })),
  }
}

// Busy time = the Google Calendar (when connected) + the bookings this page made
async function busyAndCounts(cfg, fromDate, days, log) {
  const t0 = new Date(`${fromDate}T00:00:00Z`).getTime() - 864e5
  const t1 = new Date(`${addDays(fromDate, days)}T00:00:00Z`).getTime() + 864e5
  let calendar = 'none', busy = []
  try {
    const b = await GCal.busy(cfg.calendarId || 'primary', t0, t1)
    if (b) { busy = b; calendar = 'connected' }
  } catch (e) { calendar = 'error'; console.error('[booking] freeBusy', e.message) }
  const mine = log.filter(active).filter(b => Date.parse(b.end) > t0 && Date.parse(b.start) < t1)
  const bookedPerDay = {}
  for (const b of mine) { const d = israelDate(new Date(b.start)); bookedPerDay[d] = (bookedPerDay[d] || 0) + 1 }
  return { busy: [...busy, ...mine.map(b => ({ start: b.start, end: b.end }))], bookedPerDay, calendar }
}

/** GET booking-slots → { slots: { date: [iso…] }, calendar } */
export async function slots({ typeId, from, days = 7 }) {
  const cfg = await loadConfig()
  const type = cfg.types.find(t => t.id === typeId) || cfg.types[0]
  const today = israelDate(new Date())
  const start = /^\d{4}-\d{2}-\d{2}$/.test(from || '') && from >= today ? from : today
  const n = Math.max(1, Math.min(31, +days || 7))
  const log = await readLog()
  const { busy, bookedPerDay, calendar } = await busyAndCounts(cfg, start, n, log)
  return { slots: freeSlots({ cfg, type, from: start, days: n, busy, bookedPerDay }), calendar, type: type.id }
}

// ── a booking ──────────────────────────────────────────────────────────────────
const hits = new Map()
function rateLimited(ip) {
  const now = Date.now()
  const list = (hits.get(ip) || []).filter(t => now - t < 10 * 60e3)
  list.push(now)
  hits.set(ip, list)
  return list.length > 6
}
const firstName = (name, lang) => {
  const f = String(name || '').trim().split(/\s+/)[0] || ''
  return lang !== 'en' && isLatinName(f) ? hebrewFirstName(f) : f
}

export function clientMessage(b, cfg) {
  const en = b.lang === 'en'
  const name = firstName(b.name, b.lang)
  const type = en ? b.type.en : b.type.he
  const when = whenText(b.start, b.lang)
  const how = b.channel === 'meet'
    ? (b.meetLink ? (en ? `Here's the Google Meet link: ${b.meetLink}` : `הקישור לפגישה בגוגל מיט: ${b.meetLink}`) : (en ? 'The Google Meet link is in the invitation we emailed you.' : 'הקישור לפגישה נמצא בהזמנה ששלחנו לכם במייל.'))
    : b.channel === 'zoom' ? (en ? `Here's the Zoom link: ${cfg.zoomUrl}` : `הקישור לזום: ${cfg.zoomUrl}`)
    : (en ? 'We\'ll call you on this number.' : 'נתקשר אליכם למספר הזה.')
  return en
    ? `Hi${name ? ` ${name}` : ''}, it's Afik Hanahal here.\nYour ${type.toLowerCase()} with us is booked for ${when}.\n${how}\nIf anything changes, just message us here.`
    : `היי${name ? ` ${name}` : ''}, כאן אפיק הנחל.\nקבענו ${type} ל${when}.\n${how}\nאם משהו משתנה, אפשר לכתוב לנו כאן.`
}

function officeMessage(b, { calendar, leadNew }) {
  const ch = CHANNELS[b.channel]?.he || b.channel
  return [
    `📅 נקבעה ${b.type.he} דרך האתר`,
    `👤 ${b.name} · ${b.phone}${b.email ? ` · ${b.email}` : ''}`,
    `🕒 ${whenText(b.start, 'he')} (${b.type.minutes} דק׳)`,
    `📞 ${ch}${b.meetLink ? ` · ${b.meetLink}` : ''}`,
    b.notes ? `📝 ${b.notes.slice(0, 300)}` : '',
    calendar === 'connected' ? '✅ נכנס ליומן' : '⚠️ היומן לא מחובר: צריך להכניס ליומן ידנית ולאשר ללקוח',
    leadNew ? '🆕 ליד חדש נוסף ל-CRM' : '🔁 ליד קיים, עודכן ב-CRM',
  ].filter(Boolean).join('\n')
}

async function sendOfficeEmail(b, text) {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return
  try {
    const { default: nodemailer } = await import('nodemailer')
    const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: pass.replace(/\s+/g, '') } })
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    await t.sendMail({
      from: `"אפיק הנחל – תיאום פגישות" <${user}>`, to: process.env.ADMIN_NOTIFY_EMAIL || user,
      subject: `📅 ${b.type.he}: ${b.name} · ${whenText(b.start, 'he')}`,
      html: `<div dir="rtl" style="font-family:Heebo,Arial,sans-serif;font-size:15px;line-height:1.7;color:#1a1a2e">${esc(text).replace(/\n/g, '<br>')}<br><br><a href="https://www.afikhanahal.co.il/admin-panel" style="color:#3F4EB0">לפאנל הניהול</a></div>`,
    })
  } catch (e) { console.error('[booking] email', e.message) }
}

// The lead in the CRM: an existing one (same phone) gets the booking, a new one is created as "discovery"
async function upsertLead(client, b, entry) {
  const note = { id: `bk_${entry.id}`, ts: nowIso(), kind: 'meeting', text: `📅 ${b.type.he} נקבעה דרך עמוד התיאום ל${whenText(b.start, 'he')} (${CHANNELS[b.channel]?.he || b.channel})${b.notes ? `\nכתבו: ${b.notes}` : ''}` }
  const booking = { id: entry.id, type: b.type.id, channel: b.channel, start: b.start, end: b.end, meetLink: entry.meetLink || '', eventId: entry.eventId || '', at: entry.at }
  const existing = await findLeadByPhone(b.phone)
  if (existing) {
    const crm = { ...(existing.crm_data || {}) }
    const from = crm.leadStatus || 'new'
    const to = ['new', 'contacted'].includes(from) ? 'discovery' : from
    const next = {
      ...crm, booking, bookings: [booking, ...(crm.bookings || [])].slice(0, 20),
      notes: [note, ...(crm.notes || [])], followUp: b.start, leadStatus: to,
      ...(to !== from ? { stageLog: [...(crm.stageLog || []), { from, to, at: nowIso(), by: 'booking' }] } : {}),
    }
    const patch = { crm_data: next, ...(b.email && !existing.email ? { email: b.email } : {}) }
    const { error } = await client.from('contacts').update(patch).eq('id', existing.id)
    if (error) console.error('[booking] lead update', error.message)
    return { id: existing.id, created: false }
  }
  const now = nowIso()
  const row = {
    name: b.name, phone: b.phone, email: b.email || null, message: b.notes || null,
    prop_title: b.type.he, prop_location: null, source: 'booking', created_at: now, lead_status: 'discovery',
    crm_data: {
      leadStatus: 'discovery', booking, bookings: [booking], notes: [note], followUp: b.start,
      origin: { channel: 'booking', lang: b.lang, page: '/book', ...(b.ref ? { ref: b.ref } : {}) },
      // the confirmation is the first message: no automatic welcome on top of it
      auto: { skipped: { welcome: now } },
    },
  }
  let { data, error } = await client.from('contacts').insert(row).select('id').single()
  if (error && /lead_status/.test(error.message)) {
    const { lead_status, ...rest } = row
    ;({ data, error } = await client.from('contacts').insert(rest).select('id').single())
  }
  if (error) { console.error('[booking] lead insert', error.message); return { id: null, created: false, error: error.message } }
  return { id: data.id, created: true }
}

/** POST booking-create → { ok, booking } | { ok: false, error, errors? } */
export async function create(client, body, { ip = '' } = {}) {
  if (rateLimited(ip || 'x')) return { ok: false, status: 429, error: 'rate' }
  const cfg = await loadConfig()
  const v = validateBooking(body, cfg)
  if (!v.ok) return { ok: false, status: v.errors.spam ? 200 : 400, error: 'invalid', errors: v.errors }
  const b = v.value
  const log = await readLog()
  // one person, at most 2 upcoming bookings
  if (log.filter(active).filter(x => x.phone === b.phone && Date.parse(x.start) > Date.now()).length >= 2) return { ok: false, status: 409, error: 'too_many' }
  // the slot must still be free (fresh calendar read, not the page's cached list)
  const day = israelDate(new Date(b.start))
  const { busy, bookedPerDay, calendar } = await busyAndCounts(cfg, day, 1, log)
  if (!slotIsFree(b.start, freeSlots({ cfg, type: b.type, from: day, days: 1, busy, bookedPerDay }))) return { ok: false, status: 409, error: 'taken' }

  const entry = { id: crypto.randomBytes(6).toString('hex'), at: nowIso(), start: b.start, end: b.end, type: b.type.id, typeName: b.type.he, channel: b.channel, name: b.name, phone: b.phone, email: b.email, notes: b.notes, lang: b.lang, status: 'booked', eventId: '', meetLink: '', calendar }
  if (calendar === 'connected') {
    try {
      const ev = await GCal.createEvent(cfg.calendarId || 'primary', bookingEvent(b, cfg))
      if (ev) Object.assign(entry, { eventId: ev.id, meetLink: ev.meetLink, htmlLink: ev.htmlLink })
    } catch (e) { entry.calendar = 'error'; entry.calendarError = e.message.slice(0, 160); console.error('[booking] event', e.message) }
  }
  // save first (the slot is now taken), then everything else
  const fresh = await readLog()
  await putSetting(LOG_KEY, [entry, ...fresh].sort((x, y) => Date.parse(y.start) - Date.parse(x.start)).slice(0, LOG_KEEP))

  const full = { ...b, meetLink: entry.meetLink }
  const lead = await upsertLead(client, full, entry).catch(e => ({ id: null, error: e.message }))
  if (lead.id) { entry.leadId = lead.id; putSetting(LOG_KEY, [entry, ...fresh].sort((x, y) => Date.parse(y.start) - Date.parse(x.start)).slice(0, LOG_KEEP)).catch(() => {}) }
  const office = officeMessage(full, { calendar: entry.calendar, leadNew: lead.created })
  const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r({ ok: false, error: 'timeout' }), ms))])
  const [, wa] = await Promise.allSettled([
    within(notifyTeam(office), 8000),
    within(sendText(b.phone, clientMessage(full, cfg)), 8000),
    within(sendOfficeEmail(full, office), 8000),
  ])
  return {
    ok: true,
    booking: {
      id: entry.id, start: b.start, end: b.end, type: b.type.id, channel: b.channel, meetLink: entry.meetLink,
      zoomUrl: b.channel === 'zoom' ? cfg.zoomUrl : '', invite: !!(b.email && entry.eventId), inCalendar: !!entry.eventId,
      whatsapp: wa.status === 'fulfilled' && !!wa.value?.ok,
    },
  }
}

// ── admin ──────────────────────────────────────────────────────────────────────
export async function adminState() {
  const [cfg, st, log] = await Promise.all([loadConfig(), GCal.status(), readLog()])
  const since = Date.now() - 30 * 864e5
  return { config: cfg, calendar: st, bookings: log.filter(b => Date.parse(b.end) > since).slice(0, 200) }
}
export async function cancel(id) {
  const cfg = await loadConfig()
  const log = await readLog()
  const b = log.find(x => x.id === id)
  if (!b) return { ok: false, error: 'not found' }
  if (b.eventId) await GCal.cancelEvent(cfg.calendarId || 'primary', b.eventId).catch(e => console.error('[booking] cancel event', e.message))
  b.status = 'cancelled'
  b.cancelledAt = nowIso()
  await putSetting(LOG_KEY, log)
  return { ok: true }
}
