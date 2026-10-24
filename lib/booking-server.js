// Booking page, server side (api/meta.js → booking-*): settings, free slots, a booking (calendar event + CRM lead + office
// alert + WhatsApp / email confirmation to the client), the client's own page (details, reschedule, cancel — by a private
// link "<id>.<token>"), the admin list, cancellation and resending a confirmation Green API refused.
// Every booking is also kept in app_settings 'booking_log', so the page never double-books even before the calendar is
// connected (then the office confirms by hand).

import crypto from 'crypto'
import { readFileSync } from 'fs'
import { mergeBooking, freeSlots, validateBooking, slotIsFree, bookingEvent, israelDate, addDays, whenText, CHANNELS, TZ, parseManageKey, manageKey, manageUrl, canChange, subtractInterval, bookingView, notesToNeeds, calendarChange, guestList, eventAttendees } from './booking.js'
import { clientEmail, officeEmail, officeText, clientText } from './booking-messages.js'
import * as GCal from './google-calendar.js'
import { getSetting, putSetting, findLeadByPhone, notifyTeam, sendText } from './automations.js'
import { hebrewFirstName, isLatinName, hebrewFullName } from './hebrew-names.js'

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
  if (patch.photo !== undefined) {
    const ph = clean(patch.photo, 400)
    if (ph && !/^(https:\/\/|\/)[^\s"'<>]+$/i.test(ph)) throw new Error('קישור תמונה לא תקין (צריך להתחיל ב-https:// או ב-/)')
    next.photo = ph
  }
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
    title: cfg.title, tz: TZ, horizonDays: cfg.horizonDays, connected, photo: cfg.photo || '',
    types: cfg.types.filter(t => !t.hidden).map(t => ({ id: t.id, minutes: t.minutes, he: t.he, en: t.en, he_desc: t.he_desc, en_desc: t.en_desc, channels: t.channels.filter(c => c !== 'zoom' || cfg.zoomUrl) })),
  }
}

// Busy time = the Google Calendar (when connected) + the bookings this page made
async function busyAndCounts(cfg, fromDate, days, log, exclude = null) {
  const t0 = new Date(`${fromDate}T00:00:00Z`).getTime() - 864e5
  const t1 = new Date(`${addDays(fromDate, days)}T00:00:00Z`).getTime() + 864e5
  let calendar = 'none', busy = []
  try {
    const b = await GCal.busy(cfg.calendarId || 'primary', t0, t1)
    if (b) { busy = b; calendar = 'connected' }
  } catch (e) { calendar = 'error'; console.error('[booking] freeBusy', e.message) }
  if (exclude) busy = subtractInterval(busy, exclude.start, exclude.end)
  const mine = log.filter(active).filter(b => b.id !== exclude?.id && Date.parse(b.end) > t0 && Date.parse(b.start) < t1)
  const bookedPerDay = {}
  for (const b of mine) { const d = israelDate(new Date(b.start)); bookedPerDay[d] = (bookedPerDay[d] || 0) + 1 }
  return { busy: [...busy, ...mine.map(b => ({ start: b.start, end: b.end }))], bookedPerDay, calendar }
}

/** GET booking-slots → { slots: { date: [iso…] }, calendar } */
export async function slots({ typeId, from, days = 7, m = '' }) {
  const cfg = await loadConfig()
  const log = await readLog()
  const own = m ? findByKey(log, m) : null   // moving a booking: its own time is not "busy"
  const type = cfg.types.find(t => t.id === (own?.type || typeId)) || cfg.types[0]
  const today = israelDate(new Date())
  const start = /^\d{4}-\d{2}-\d{2}$/.test(from || '') && from >= today ? from : today
  const n = Math.max(1, Math.min(31, +days || 7))
  const { busy, bookedPerDay, calendar } = await busyAndCounts(cfg, start, n, log, own)
  return { slots: freeSlots({ cfg, type, from: start, days: n, busy, bookedPerDay }), calendar, type: type.id }
}

// ── a booking ──────────────────────────────────────────────────────────────────
const hits = new Map()
function rateLimited(ip, limit = 6) {
  const now = Date.now()
  const list = (hits.get(ip) || []).filter(t => now - t < 10 * 60e3)
  list.push(now)
  hits.set(ip, list)
  return list.length > limit
}
const firstName = (name, lang) => {
  const f = String(name || '').trim().split(/\s+/)[0] || ''
  return lang !== 'en' && isLatinName(f) ? hebrewFirstName(f) : f
}

/** The client's WhatsApp confirmation (kept for callers / tests: a new booking) */
export function clientMessage(b, cfg) {
  return clientText('created', b, { firstName: firstName(b.name, b.lang), zoomUrl: cfg?.zoomUrl || '' })
}

async function mailer() {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  const { default: nodemailer } = await import('nodemailer')
  return { user, t: nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: pass.replace(/\s+/g, '') } }) }
}
async function sendOfficeEmail(kind, b, state, extra) {
  try {
    const m = await mailer()
    if (!m) return { ok: false, error: 'no mailer' }
    const { subject, html, text } = officeEmail(kind, b, state, extra)
    await m.t.sendMail({ from: `"אפיק הנחל – תיאום פגישות" <${m.user}>`, to: process.env.ADMIN_NOTIFY_EMAIL || m.user, subject, html, text })
    return { ok: true }
  } catch (e) { console.error('[booking] office email', e.message); return { ok: false, error: e.message } }
}
async function sendClientEmail(kind, b, extra) {
  if (!b.email) return null
  try {
    const m = await mailer()
    if (!m) return { ok: false, error: 'no mailer' }
    const { subject, html, text } = clientEmail(kind, b, extra)
    const from = b.lang === 'en' ? 'Afik Hanahal' : 'אפיק הנחל'
    await m.t.sendMail({ from: `"${from}" <${m.user}>`, replyTo: m.user, to: b.email, subject, html, text })
    return { ok: true, at: nowIso() }
  } catch (e) { console.error('[booking] client email', e.message); return { ok: false, error: e.message.slice(0, 160) } }
}
const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r({ ok: false, error: 'timeout' }), ms))])
const waResult = r => ({ ok: !!r?.ok, ...(r?.ok ? {} : { error: String(r?.error || 'failed').slice(0, 200), ...(r?.quota ? { quota: true } : {}) }), at: nowIso() })
// a log entry + its meeting type (as an object) = what the message builders read
const asBooking = (entry, cfg) => ({ ...entry, type: cfg.types.find(t => t.id === entry.type) || { id: entry.type, he: entry.typeName || 'פגישה', en: 'Meeting', minutes: Math.round((Date.parse(entry.end) - Date.parse(entry.start)) / 60e3) } })
const sortLog = list => list.sort((x, y) => Date.parse(y.start) - Date.parse(x.start)).slice(0, LOG_KEEP)
async function saveEntry(entry) {
  const log = await readLog()
  const i = log.findIndex(x => x.id === entry.id)
  if (i >= 0) log[i] = { ...log[i], ...entry }; else log.push(entry)
  await putSetting(LOG_KEY, sortLog(log))
}

// Israeli towns (the seller form's list): what the client wrote → the lead card's area
let CITIES = []
try { CITIES = JSON.parse(readFileSync(new URL('../src/data/israelCities.json', import.meta.url), 'utf8')) } catch {}
const NEED_KEYS = ['dealType', 'propertyType', 'area', 'budget', 'rooms']
const STALE_STAGES = ['lost', 'irrelevant', 'nurture']

// The booking as answers on the lead card ("מקור הליד" shows them like a form's answers)
function bookingAnswers(b) {
  return [
    { q: 'סוג הפגישה', a: b.type.he, booking: 1 },
    { q: 'מועד השיחה', a: whenText(b.start, 'he'), booking: 1 },
    { q: 'אופן השיחה', a: CHANNELS[b.channel]?.he || b.channel, booking: 1 },
    b.notes ? { q: 'מה כתבו בטופס', a: b.notes, booking: 1 } : null,
    { q: 'שפת העמוד', a: b.lang === 'en' ? 'אנגלית' : 'עברית', booking: 1 },
    b.ref ? { q: 'מקור / קמפיין', a: b.ref, booking: 1 } : null,
  ].filter(Boolean)
}
const withAnswers = (crm, b) => [...bookingAnswers(b), ...(Array.isArray(crm.formAnswers) ? crm.formAnswers.filter(x => !x.booking) : [])]
const fillNeeds = (crm, needs) => Object.fromEntries(NEED_KEYS.filter(k => needs[k] !== undefined && (crm[k] === undefined || crm[k] === '' || crm[k] === null)).map(k => [k, needs[k]]))

// The lead in the CRM: a new one is created as "new" (ליד חדש) with everything the client told us; an existing one (same
// phone) gets the booking, the answers and any need it didn't have, and comes back to "new" from lost / irrelevant / nurture
async function upsertLead(client, b, entry) {
  const note = { id: `bk_${entry.id}`, ts: nowIso(), kind: 'meeting', text: `📅 ${b.type.he} נקבעה דרך עמוד התיאום ל${whenText(b.start, 'he')} (${CHANNELS[b.channel]?.he || b.channel})${b.notes ? `\nכתבו: ${b.notes}` : ''}` }
  const booking = { id: entry.id, type: b.type.id, channel: b.channel, start: b.start, end: b.end, meetLink: entry.meetLink || '', eventId: entry.eventId || '', at: entry.at, manageUrl: manageUrl(entry) }
  const needs = notesToNeeds(b.notes, CITIES)
  const existing = await findLeadByPhone(b.phone)
  if (existing) {
    const crm = { ...(existing.crm_data || {}) }
    const from = crm.leadStatus || 'new'
    const to = STALE_STAGES.includes(from) ? 'new' : from
    const next = {
      ...crm, ...fillNeeds(crm, needs), booking, bookings: [booking, ...(crm.bookings || [])].slice(0, 20), formAnswers: withAnswers(crm, b),
      notes: [note, ...(crm.notes || [])], followUp: b.start, leadStatus: to,
      ...(to !== from ? { stageLog: [...(crm.stageLog || []), { from, to, at: nowIso(), by: 'booking' }] } : {}),
    }
    const patch = { crm_data: next, ...(b.email && !existing.email ? { email: b.email } : {}), ...(b.notes && !existing.message ? { message: b.notes } : {}) }
    const { error } = await client.from('contacts').update(patch).eq('id', existing.id)
    if (error) console.error('[booking] lead update', error.message)
    return { id: existing.id, created: false }
  }
  const now = nowIso()
  const row = {
    name: hebrewFullName(b.name) || b.name, phone: b.phone, email: b.email || null, message: b.notes || null,
    prop_title: null, prop_location: needs.area || null, source: 'booking', created_at: now, lead_status: 'new',
    crm_data: {
      leadStatus: 'new', ...needs, booking, bookings: [booking], notes: [note], followUp: b.start, formAnswers: bookingAnswers(b),
      origin: { channel: 'booking', lang: b.lang, page: '/book', ...(b.ref ? { ref: b.ref } : {}) },
      ...(hebrewFullName(b.name) !== b.name ? { originalName: b.name } : {}),
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

// Leads made by the first version of the page (stage "discovery", no answers): bring them in line once
async function backfillLeads(client, log, cfg) {
  const todo = log.filter(e => e.leadId && !e.leadV2).slice(0, 10)
  if (!client || !todo.length) return false
  for (const e of todo) {
    try {
      const { data: lead } = await client.from('contacts').select('id, source, message, crm_data').eq('id', e.leadId).maybeSingle()
      if (lead) {
        const crm = { ...(lead.crm_data || {}) }
        const b = asBooking(e, cfg)
        const fresh = lead.source === 'booking' && crm.leadStatus === 'discovery' && !(crm.stageLog || []).length
        const next = { ...crm, ...fillNeeds(crm, notesToNeeds(e.notes, CITIES)), formAnswers: withAnswers(crm, b), ...(fresh ? { leadStatus: 'new' } : {}), booking: { ...(crm.booking || {}), manageUrl: manageUrl(e) } }
        const patch = { crm_data: next, ...(fresh ? { lead_status: 'new' } : {}), ...(e.notes && !lead.message ? { message: e.notes } : {}) }
        let { error } = await client.from('contacts').update(patch).eq('id', lead.id)
        if (error && /lead_status/.test(error.message)) ({ error } = await client.from('contacts').update({ crm_data: next }).eq('id', lead.id))
        if (error) { console.error('[booking] backfill', error.message); continue }
      }
      e.leadV2 = 1
    } catch (err) { console.error('[booking] backfill', err.message) }
  }
  return true
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

  const entry = { id: crypto.randomBytes(6).toString('hex'), token: crypto.randomBytes(16).toString('base64url'), at: nowIso(), start: b.start, end: b.end, type: b.type.id, typeName: b.type.he, channel: b.channel, name: b.name, phone: b.phone, email: b.email, notes: b.notes, lang: b.lang, status: 'booked', eventId: '', meetLink: '', calendar }
  if (calendar === 'connected') {
    try {
      const ev = await GCal.createEvent(cfg.calendarId || 'primary', bookingEvent(b, cfg))
      if (ev) Object.assign(entry, { eventId: ev.id, meetLink: ev.meetLink, htmlLink: ev.htmlLink })
    } catch (e) { entry.calendar = 'error'; entry.calendarError = e.message.slice(0, 160); console.error('[booking] event', e.message) }
  }
  // save first (the slot is now taken), then everything else
  const fresh = await readLog()
  await putSetting(LOG_KEY, [entry, ...fresh].sort((x, y) => Date.parse(y.start) - Date.parse(x.start)).slice(0, LOG_KEEP))

  const full = { ...b, id: entry.id, token: entry.token, meetLink: entry.meetLink, eventId: entry.eventId }
  // the client's confirmations first (WhatsApp + email, side by side), then the office hears how they went
  const [lead, wa, mail] = await Promise.all([
    upsertLead(client, full, entry).catch(e => ({ id: null, error: e.message })),
    within(sendText(b.phone, clientMessage(full, cfg)), 9000).then(waResult),
    within(sendClientEmail('created', full), 9000),
  ])
  Object.assign(entry, { wa, ...(mail ? { mail } : {}), ...(lead.id ? { leadId: lead.id, leadV2: 1 } : {}) })
  const state = { calendar: entry.calendar, leadNew: lead.created, wa, mail, needs: notesToNeeds(b.notes, CITIES) }
  await Promise.allSettled([
    saveEntry(entry),
    within(notifyTeam(officeText('created', full, state)), 8000),
    within(sendOfficeEmail('created', full, state), 8000),
  ])
  return { ok: true, manage: manageKey(entry), booking: bookingView(entry, cfg) }
}

// ── the client's own page: /book?m=<id>.<token> ─────────────────────────────────────────────────────────────────────
function findByKey(log, m) {
  const k = parseManageKey(m)
  if (!k) return null
  const e = log.find(x => x.id === k.id)
  if (!e?.token || e.token.length !== k.token.length) return null
  return crypto.timingSafeEqual(Buffer.from(e.token), Buffer.from(k.token)) ? e : null
}

/** GET booking-manage?m= → { ok, booking } */
export async function manage(m, { ip = '', client = null } = {}) {
  if (rateLimited(`m:${ip || 'x'}`, 40)) return { ok: false, status: 429, error: 'rate' }
  const [cfg, log] = await Promise.all([loadConfig(), readLog()])
  const found = findByKey(log, m)
  if (!found) return { ok: false, status: 404, error: 'not_found' }
  const e = (await syncEntry(client, cfg, found).catch(() => null)) || found   // deleted / moved in the calendar? show that
  return { ok: true, booking: bookingView(e, cfg) }
}

// ── the office's own changes in Google Calendar ─────────────────────────────────
// A booking whose event the office deleted (or cancelled) in the calendar is cancelled here too, quietly: no WhatsApp,
// no email, no more retries of its confirmation; an event dragged to another time moves the booking. Checked when the
// admin list loads, when the client opens the private page, and from auto-tick / auto-run (every 5 minutes).
/** Take a cancelled booking's event out of the office calendar and read it back: Google emails its own reminder an hour
 *  before every event that is still there, so "cancelled" must also mean "gone from the calendar".
 *  → { ok: true } | { ok: false, error } (the booking keeps calendarPending and the next sync tries again) */
async function removeEvent(cfg, eventId, { notify = false } = {}) {
  if (!eventId) return { ok: true }
  const cal = cfg.calendarId || 'primary'
  try {
    const r = await GCal.cancelEvent(cal, eventId, { notify })
    if (r === null) return { ok: false, error: 'היומן לא מחובר' }
    const ev = await GCal.getEvent(cal, eventId)
    if (ev && (ev.deleted || ev.status === 'cancelled')) return { ok: true }
    return { ok: false, error: ev ? 'האירוע עדיין ביומן' : 'היומן לא מחובר' }
  } catch (e) { return { ok: false, error: e.message } }
}
// what a cancelled booking saves about its event: removed, or still to remove (with the notify choice for the retry)
const removal = (r, notify = false) => (r.ok
  ? { calendar: 'removed', calendarPending: null, calendarError: null }
  : { calendar: 'error', calendarPending: { notify, tries: 1, at: nowIso() }, calendarError: r.error })

async function syncEntry(client, cfg, e) {
  if (!e || e.status === 'cancelled' || !e.eventId) return null
  const ev = await GCal.getEvent(cfg.calendarId || 'primary', e.eventId)
  const ch = calendarChange(e, ev)
  if (!ch) return null
  let next
  if (ch.cancel && ch.by === 'guest') {
    // the client declined / removed the invitation: out of our calendar too (no reminder), the office is told, the
    // client isn't (they did it themselves)
    const r = await removeEvent(cfg, e.eventId)
    next = { ...e, status: 'cancelled', cancelledAt: nowIso(), cancelledBy: 'guest', ...removal(r) }
    await saveEntry({ id: e.id, status: next.status, cancelledAt: next.cancelledAt, cancelledBy: next.cancelledBy, calendar: next.calendar, calendarPending: next.calendarPending, calendarError: next.calendarError })
    const full = asBooking(next, cfg)
    await Promise.allSettled([
      touchLead(client, next, 'cancelledGuest', { start: e.start }),
      within(notifyTeam(officeText('declined', full, {})), 8000),
      within(sendOfficeEmail('declined', full, { needs: notesToNeeds(e.notes, CITIES) }), 8000),
    ])
  } else if (ch.cancel) {
    next = { ...e, status: 'cancelled', cancelledAt: nowIso(), cancelledBy: 'calendar' }
    await saveEntry({ id: e.id, status: next.status, cancelledAt: next.cancelledAt, cancelledBy: next.cancelledBy })
    await touchLead(client, next, 'cancelledCal', { start: e.start })
  } else {
    next = { ...e, ...ch.move, history: [...(e.history || []), { kind: 'moved', from: e.start, to: ch.move.start, at: nowIso(), by: 'calendar' }] }
    await saveEntry({ id: e.id, start: next.start, end: next.end, history: next.history })
    await touchLead(client, next, 'movedCal', { start: e.start, end: e.end })
  }
  return next
}
let lastSync = 0
export async function syncCalendar(client, { force = false } = {}) {
  if (!force && Date.now() - lastSync < 3 * 60e3) return { skipped: 'recent' }
  lastSync = Date.now()
  const log = await readLog()
  const now = Date.now()
  const due = log.filter(e => e.status !== 'cancelled' && e.eventId && Date.parse(e.end) > now).slice(0, 25)
  // cancelled here, but the event couldn't be taken out of the calendar then: try again until the call's time passes
  const stuck = log.filter(e => e.status === 'cancelled' && e.eventId && e.calendarPending && Date.parse(e.end) > now).slice(0, 10)
  if (!due.length && !stuck.length) return { checked: 0 }
  const cfg = await loadConfig()
  let cancelled = 0, moved = 0, removed = 0
  for (const e of stuck) {
    const r = await removeEvent(cfg, e.eventId, { notify: !!e.calendarPending.notify })
    if (r.ok) removed++
    await saveEntry({ id: e.id, ...(r.ok ? removal(r) : { calendarError: r.error, calendarPending: { ...e.calendarPending, tries: (e.calendarPending.tries || 1) + 1, at: nowIso() } }) })
    if (!r.ok && /invalid_grant|401|לא מחובר/.test(r.error)) break
  }
  for (const e of due) {
    try {
      const next = await syncEntry(client, cfg, e)
      if (next?.status === 'cancelled') cancelled++
      else if (next) moved++
    } catch (err) { console.error('[booking] calendar sync', err.message); if (/invalid_grant|401/.test(err.message)) break }
  }
  return { checked: due.length, cancelled, moved, removed }
}

// a note on the lead when the office changes who is invited
async function guestsNote(client, entry, { added = [], removed = [] } = {}) {
  try {
    const lead = entry.leadId ? (await client.from('contacts').select('id, crm_data').eq('id', entry.leadId).maybeSingle()).data : await findLeadByPhone(entry.phone)
    if (!lead) return
    const crm = { ...(lead.crm_data || {}) }
    const text = [`📅 עודכנו המשתתפים בזימון לפגישה של ${whenText(entry.start, 'he')}`, added.length ? `נוספו: ${added.join(', ')}` : '', removed.length ? `הוסרו: ${removed.join(', ')}` : ''].filter(Boolean).join(' · ')
    await client.from('contacts').update({ crm_data: { ...crm, notes: [{ id: `bk_${entry.id}_${Date.now()}`, ts: nowIso(), kind: 'meeting', text }, ...(crm.notes || [])] } }).eq('id', lead.id)
  } catch (e) { console.error('[booking] guests note', e.message) }
}

// the CRM lead follows the booking (a note + the new time / the cancellation)
async function touchLead(client, entry, kind, previous) {
  if (!client) return
  if (kind === 'guests') return guestsNote(client, entry, previous)
  try {
    const lead = entry.leadId ? (await client.from('contacts').select('id, crm_data').eq('id', entry.leadId).maybeSingle()).data : await findLeadByPhone(entry.phone)
    if (!lead) return
    const crm = { ...(lead.crm_data || {}) }
    const when = whenText(entry.start, 'he')
    const isMove = kind.startsWith('moved')
    const isCancel = kind.startsWith('cancelled')
    const text = {
      moved: `📅 הלקוח שינה דרך הקישור האישי את מועד הפגישה (${entry.typeName || 'פגישה'}): מ${whenText(previous.start, 'he')} ל${when}`,
      cancelled: `📅 הלקוח ביטל דרך הקישור האישי את הפגישה שנקבעה ל${when}`,
      movedCal: `📅 מועד הפגישה הוזז ביומן Google: מ${whenText(previous.start, 'he')} ל${when}`,
      cancelledCal: `📅 הפגישה שנקבעה ל${when} נמחקה מיומן Google, ולכן סומנה כמבוטלת (לא נשלחה הודעה ללקוח)`,
      cancelledGuest: `📅 הלקוח דחה את הזימון ביומן שלו לפגישה שנקבעה ל${when}. הפגישה בוטלה ונמחקה מיומן המשרד`,
      movedOffice: `📅 המשרד הזיז את הפגישה (${entry.typeName || 'פגישה'}): מ${whenText(previous.start, 'he')} ל${when}`,
      cancelledOffice: `📅 המשרד ביטל את הפגישה שנקבעה ל${when} (הלקוח עודכן)`,
      cancelledOfficeQuiet: `📅 המשרד מחק את הפגישה שנקבעה ל${when} (בלי הודעה ללקוח)`,
    }[kind]
    const booking = { ...(crm.booking || {}), id: entry.id, start: entry.start, end: entry.end, ...(isCancel ? { cancelled: true } : {}) }
    const formAnswers = Array.isArray(crm.formAnswers) ? crm.formAnswers.map(x => (x.booking && x.q === 'מועד השיחה' ? { ...x, a: isCancel ? `${whenText(entry.start, 'he')} (בוטלה)` : whenText(entry.start, 'he') } : x)) : crm.formAnswers
    const next = {
      ...crm, formAnswers, notes: [{ id: `bk_${entry.id}_${Date.now()}`, ts: nowIso(), kind: 'meeting', text }, ...(crm.notes || [])],
      booking, bookings: (crm.bookings || []).map(x => (x.id === entry.id ? { ...x, ...booking } : x)),
      ...(isMove ? { followUp: entry.start } : crm.followUp === previous?.start ? { followUp: null } : {}),
    }
    const { error } = await client.from('contacts').update({ crm_data: next }).eq('id', lead.id)
    if (error) console.error('[booking] lead touch', error.message)
  } catch (e) { console.error('[booking] lead touch', e.message) }
}

/** POST booking-reschedule { m, start } → { ok, booking } */
export async function reschedule(client, m, start, { ip = '', by = 'client' } = {}) {
  if (rateLimited(`r:${ip || 'x'}`, 10)) return { ok: false, status: 429, error: 'rate' }
  const cfg = await loadConfig()
  const log = await readLog()
  const e = findByKey(log, m)
  if (!e) return { ok: false, status: 404, error: 'not_found' }
  const can = canChange(e)
  if (!can.ok) return { ok: false, status: 409, error: can.reason }
  return moveEntry(client, cfg, log, e, start, { by, notify: true, alertOffice: true })
}

// Moves one booking: re-checks the new time against a fresh calendar read, moves the Google event (the guest gets
// Google's update only when `notify`), the lead follows; the client's WhatsApp + email go out when `notify`, the
// office's alert when `alertOffice` (a client's move — the office moving it itself doesn't need telling).
async function moveEntry(client, cfg, log, e, start, { by = 'client', notify = true, alertOffice = true } = {}) {
  const at = new Date(start || '')
  if (Number.isNaN(at.getTime())) return { ok: false, status: 400, error: 'invalid' }
  const iso = at.toISOString()
  if (iso === e.start) return { ok: true, booking: bookingView(e, cfg) }
  const type = cfg.types.find(t => t.id === e.type) || { minutes: Math.round((Date.parse(e.end) - Date.parse(e.start)) / 60e3) }
  const day = israelDate(at)
  const { busy, bookedPerDay, calendar } = await busyAndCounts(cfg, day, 1, log, e)
  if (!slotIsFree(iso, freeSlots({ cfg, type, from: day, days: 1, busy, bookedPerDay }))) return { ok: false, status: 409, error: 'taken' }

  const previous = { start: e.start, end: e.end }
  const next = { ...e, start: iso, end: new Date(at.getTime() + type.minutes * 60e3).toISOString(), history: [...(e.history || []), { kind: 'moved', from: e.start, to: iso, at: nowIso(), by }] }
  if (e.eventId) {
    try {
      await GCal.patchEvent(cfg.calendarId || 'primary', e.eventId, { start: { dateTime: next.start, timeZone: TZ }, end: { dateTime: next.end, timeZone: TZ } }, { notify })
      // read it back: the booking says "in the calendar" only when Google really shows the new time
      const ev = await GCal.getEvent(cfg.calendarId || 'primary', e.eventId)
      if (ev && !ev.deleted && Date.parse(ev.start?.dateTime) === Date.parse(next.start)) Object.assign(next, { calendar: 'connected', calendarError: null, calendarAt: nowIso() })
      else throw new Error(ev?.deleted ? 'האירוע לא נמצא ביומן' : 'היומן לא הציג את השעה החדשה')
    } catch (err) { next.calendar = 'error'; next.calendarError = err.message.slice(0, 160); console.error('[booking] move event', err.message) }
  } else if (calendar === 'connected') {
    try {
      const ev = await GCal.createEvent(cfg.calendarId || 'primary', bookingEvent(asBooking(next, cfg), cfg))
      if (ev) Object.assign(next, { eventId: ev.id, meetLink: ev.meetLink || next.meetLink, htmlLink: ev.htmlLink, calendar: 'connected' })
    } catch (err) { console.error('[booking] event', err.message) }
  }
  await saveEntry(next)
  const full = asBooking(next, cfg)
  const [wa, mail] = await Promise.all([
    notify ? within(sendText(e.phone, clientText('moved', full, { firstName: firstName(e.name, e.lang), zoomUrl: cfg.zoomUrl })), 9000).then(waResult) : null,
    notify ? within(sendClientEmail('moved', full, { previous }), 9000) : null,
    touchLead(client, next, by === 'office' ? 'movedOffice' : 'moved', previous),
  ])
  if (wa) next.wa = wa
  if (mail) next.mail = mail
  const state = { calendar: next.eventId ? 'connected' : calendar, wa, mail, needs: notesToNeeds(e.notes, CITIES) }
  await Promise.allSettled([
    wa || mail ? saveEntry({ id: next.id, ...(wa ? { wa } : {}), ...(mail ? { mail } : {}) }) : null,
    alertOffice ? within(notifyTeam(officeText('moved', full, state, { previous })), 8000) : null,
    alertOffice ? within(sendOfficeEmail('moved', full, state, { previous }), 8000) : null,
  ])
  return { ok: true, booking: bookingView(next, cfg), calendar: next.eventId ? (next.calendar === 'error' ? { ok: false, error: next.calendarError } : { ok: true }) : { ok: false, error: 'no_event' } }
}

/** Admin: the office moves a booking to another free time; `notify` = tell the client (WhatsApp + email + Google's update) */
export async function moveByOffice(client, id, start, { notify = true } = {}) {
  const cfg = await loadConfig()
  const log = await readLog()
  const e = log.find(x => x.id === id)
  if (!e) return { ok: false, error: 'not_found' }
  if (e.status === 'cancelled') return { ok: false, error: 'cancelled' }
  const r = await moveEntry(client, cfg, log, e, start, { by: 'office', notify, alertOffice: false })
  return r.ok ? { ok: true, booking: r.booking, calendar: r.calendar } : { ok: false, error: r.error }
}

/**
 * Admin: the meeting's extra guests (emails). The Google event's attendees become the client + these, Google sends
 * the invitation to the new ones (and a cancellation to removed ones), then the event is read back to confirm.
 */
export async function setGuests(client, id, guests) {
  const cfg = await loadConfig()
  const log = await readLog()
  const e = log.find(x => x.id === id)
  if (!e) return { ok: false, error: 'not_found' }
  if (e.status === 'cancelled') return { ok: false, error: 'cancelled' }
  const { list, bad } = guestList(guests, { exclude: [e.email] })
  if (bad.length) return { ok: false, error: 'invalid', bad }
  if (!e.eventId) return { ok: false, error: 'no_event' }
  const calId = cfg.calendarId || 'primary'
  const ev = await GCal.getEvent(calId, e.eventId)
  if (!ev) return { ok: false, error: 'no_calendar' }
  if (ev.deleted || ev.status === 'cancelled') return { ok: false, error: 'event_gone' }
  const had = new Map((ev.attendees || []).map(a => [String(a.email || '').toLowerCase(), a]))
  const attendees = eventAttendees({ ...e, guests: list }).map(a => ({ ...(had.get(a.email.toLowerCase()) || {}), ...a }))
  await GCal.patchEvent(calId, e.eventId, { attendees }, { notify: true })
  const check = await GCal.getEvent(calId, e.eventId)
  const got = new Set((check?.attendees || []).map(a => String(a.email || '').toLowerCase()))
  const missing = attendees.map(a => a.email.toLowerCase()).filter(x => !got.has(x))
  const before = e.guests || []
  const added = list.filter(x => !before.includes(x)), removed = before.filter(x => !list.includes(x))
  await saveEntry({ id, guests: list })
  if (added.length || removed.length) await touchLead(client, { ...e, guests: list }, 'guests', { added, removed })
  return missing.length ? { ok: false, error: 'not_saved', missing, guests: list } : { ok: true, guests: list, attendees: [...got] }
}

/** POST booking-cancel-self { m } → { ok, booking } */
export async function cancelByClient(client, m, { ip = '' } = {}) {
  if (rateLimited(`c:${ip || 'x'}`, 10)) return { ok: false, status: 429, error: 'rate' }
  const cfg = await loadConfig()
  const log = await readLog()
  const e = findByKey(log, m)
  if (!e) return { ok: false, status: 404, error: 'not_found' }
  if (e.status === 'cancelled') return { ok: true, booking: bookingView(e, cfg) }
  const can = canChange(e)
  if (!can.ok && can.reason === 'past') return { ok: false, status: 409, error: 'past' }
  const r = await removeEvent(cfg, e.eventId, { notify: true })
  if (!r.ok) console.error('[booking] cancel event', r.error)
  const next = { ...e, status: 'cancelled', cancelledAt: nowIso(), cancelledBy: 'client', ...(e.eventId ? removal(r, true) : {}) }
  await saveEntry(next)
  const full = asBooking(next, cfg)
  const [wa, mail] = await Promise.all([
    within(sendText(e.phone, clientText('cancelled', full, { firstName: firstName(e.name, e.lang) })), 9000).then(waResult),
    within(sendClientEmail('cancelled', full), 9000),
    touchLead(client, next, 'cancelled', { start: e.start }),
  ])
  await Promise.allSettled([
    within(notifyTeam(officeText('cancelled', full, {})), 8000),
    within(sendOfficeEmail('cancelled', full, { wa, mail, needs: notesToNeeds(e.notes, CITIES) }), 8000),
  ])
  return { ok: true, booking: bookingView(next, cfg) }
}

// ── admin ──────────────────────────────────────────────────────────────────────
export async function adminState(client) {
  await syncCalendar(client, { force: true }).catch(e => console.error('[booking] calendar sync', e.message))
  const [cfg, st, log] = await Promise.all([loadConfig(), GCal.status(), readLog()])
  const since = Date.now() - 30 * 864e5
  // bookings made before the private links existed get a token now, so the office can send them the link too
  let added = false
  for (const b of log) if (!b.token && Date.parse(b.end) > Date.now()) { b.token = crypto.randomBytes(16).toString('base64url'); added = true }
  if (await backfillLeads(client, log, cfg).catch(() => false)) added = true
  if (added) await putSetting(LOG_KEY, log).catch(() => {})
  const bookings = log.filter(b => Date.parse(b.end) > since).slice(0, 200).map(({ token, ...b }) => ({ ...b, manageUrl: manageUrl({ ...b, token }) }))
  return { config: cfg, calendar: st, bookings }
}

/** Admin: send the client's WhatsApp (and email) confirmation again — e.g. after Green API's quota refused it */
export async function resend(id) {
  const cfg = await loadConfig()
  const log = await readLog()
  const e = log.find(x => x.id === id)
  if (!e) return { ok: false, error: 'not found' }
  if (e.cancelledBy === 'calendar' || e.cancelledBy === 'guest') return { ok: false, error: 'cancelled in the calendar' }   // deleted / declined there: tell no one
  if (!e.token) e.token = crypto.randomBytes(16).toString('base64url')
  const kind = e.status === 'cancelled' ? 'cancelled' : (e.history || []).some(h => h.kind === 'moved') ? 'moved' : 'created'
  const full = asBooking(e, cfg)
  const wa = await within(sendText(e.phone, clientText(kind, full, { firstName: firstName(e.name, e.lang), zoomUrl: cfg.zoomUrl })), 9000).then(waResult)
  await saveEntry({ ...e, wa })
  return { ok: wa.ok, wa, error: wa.ok ? undefined : wa.error }
}

/** Admin: both emails (the client's and the office's) for a sample booking, sent to the office address */
export async function testEmail() {
  const m = await mailer()
  if (!m) return { ok: false, error: 'GMAIL_USER / GMAIL_APP_PASSWORD חסרים ב-Vercel' }
  const cfg = await loadConfig()
  const start = new Date(Date.now() + 864e5); start.setUTCMinutes(0, 0, 0)
  const type = cfg.types[0]
  const b = { id: 'sample000000', token: 'sample-token-0000', type, channel: type.channels[0] || 'phone', lang: 'he', name: 'ישראל ישראלי (דוגמה)', phone: '0501234567', email: m.user, notes: 'מחפשים 4 חדרים בכפר סבא, תקציב עד 3 מיליון', start: start.toISOString(), end: new Date(start.getTime() + type.minutes * 60e3).toISOString() }
  const to = process.env.ADMIN_NOTIFY_EMAIL || m.user
  const c = clientEmail('created', b), o = officeEmail('created', b, { calendar: (await GCal.status()).connected ? 'connected' : 'none', leadNew: true, wa: { ok: true }, mail: { ok: true }, needs: notesToNeeds(b.notes, CITIES) })
  await m.t.sendMail({ from: `"אפיק הנחל" <${m.user}>`, to, subject: `[דוגמה] ${c.subject}`, html: c.html, text: c.text })
  await m.t.sendMail({ from: `"אפיק הנחל – תיאום פגישות" <${m.user}>`, to, subject: `[דוגמה] ${o.subject}`, html: o.html, text: o.text })
  return { ok: true, to: to.replace(/^(.).*(@.*)$/, '$1…$2') }
}

/** Run by the automation tick: confirmations Green API refused go out again once it sends (3 tries, upcoming only) */
export async function retryConfirmations({ max = 3, client = null } = {}) {
  await syncCalendar(client).catch(e => console.error('[booking] calendar sync', e.message))
  const log = await readLog()
  const due = log.filter(e => e.status !== 'cancelled' && e.wa && !e.wa.ok && (e.waTries || 1) < 3 && Date.parse(e.start) > Date.now() + 15 * 60e3 && Date.now() - Date.parse(e.wa.at || 0) > 30 * 60e3).slice(0, max)
  if (!due.length) return { retried: 0 }
  const cfg = await loadConfig()
  let sent = 0
  for (const e of due) {
    const full = asBooking(e, cfg)
    const kind = (e.history || []).some(h => h.kind === 'moved') ? 'moved' : 'created'
    const wa = await within(sendText(e.phone, clientText(kind, full, { firstName: firstName(e.name, e.lang), zoomUrl: cfg.zoomUrl })), 9000).then(waResult)
    await saveEntry({ id: e.id, wa, waTries: (e.waTries || 1) + 1 })
    if (wa.ok) sent++
    else if (wa.quota) break   // the plan is still blocked: don't spend the other bookings' tries
  }
  return { retried: due.length, sent }
}
export async function cancel(id, { notify = true, client = null } = {}) {
  const cfg = await loadConfig()
  const log = await readLog()
  const b = log.find(x => x.id === id)
  if (!b) return { ok: false, error: 'not found' }
  if (b.status === 'cancelled') return { ok: true }
  // the event leaves the calendar; Google emails the guest only when the client is to be told
  const r = await removeEvent(cfg, b.eventId, { notify })
  if (!r.ok) console.error('[booking] cancel event', r.error)
  const next = { ...b, status: 'cancelled', cancelledAt: nowIso(), cancelledBy: 'office', ...(b.eventId ? removal(r, notify) : {}) }
  await saveEntry({ id, status: next.status, cancelledAt: next.cancelledAt, cancelledBy: next.cancelledBy, ...(b.eventId ? removal(r, notify) : {}) })
  const full = asBooking(next, cfg)
  await Promise.allSettled([
    notify ? within(sendText(b.phone, clientText('cancelled', full, { firstName: firstName(b.name, b.lang) })), 9000) : null,
    notify ? within(sendClientEmail('cancelled', full), 9000) : null,
    touchLead(client, next, notify ? 'cancelledOffice' : 'cancelledOfficeQuiet', { start: b.start }),
  ])
  return b.eventId ? { ok: true, calendar: next.calendar, calendarError: next.calendarError || undefined } : { ok: true }
}
