import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_BOOKING, israelAt, israelWeekday, israelDate, freeSlots, validateBooking, bookingEvent, slotIsFree, mergeBooking, googleCalendarLink } from './booking.js'

const type = DEFAULT_BOOKING.types[0]
const hhmm = iso => new Date(iso).toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })

test('Israel wall-clock time is right on both sides of the clock change', () => {
  assert.equal(israelAt('2026-10-20', 9, 0).toISOString(), '2026-10-20T06:00:00.000Z')   // summer, UTC+3
  assert.equal(israelAt('2026-11-03', 9, 0).toISOString(), '2026-11-03T07:00:00.000Z')   // winter, UTC+2
  assert.equal(israelWeekday('2026-10-23'), 5)   // Friday
  assert.equal(israelWeekday('2026-10-24'), 6)   // Saturday
  assert.equal(israelDate(new Date('2026-10-19T22:30:00Z')), '2026-10-20')
})

test('slots follow the office hours: Sunday–Thursday 9–19, Friday 9–14, Saturday closed', () => {
  const now = new Date('2026-10-18T05:00:00Z')
  const s = freeSlots({ type, from: '2026-10-19', days: 6, now })
  assert.equal(s['2026-10-19'].length, 20)                 // 9:00 … 18:30
  assert.equal(hhmm(s['2026-10-19'][0]), '09:00')
  assert.equal(hhmm(s['2026-10-19'].at(-1)), '18:30')
  assert.equal(hhmm(s['2026-10-23'].at(-1)), '13:30')      // Friday
  assert.deepEqual(s['2026-10-24'], [])                    // Saturday
})

test('min notice, busy calendar time with a buffer, and the daily cap', () => {
  const now = new Date('2026-10-19T07:10:00Z')             // 10:10 Israel → nothing before 12:10
  const busy = [{ start: '2026-10-19T11:00:00Z', end: '2026-10-19T12:00:00Z' }]   // 14:00–15:00 Israel
  const day = freeSlots({ type, from: '2026-10-19', days: 1, now, busy })['2026-10-19'].map(hhmm)
  assert.equal(day[0], '12:30')
  assert.ok(!day.includes('13:30'))                        // 13:30–14:00 touches the 10-minute buffer
  assert.ok(!day.includes('14:30') && !day.includes('15:00'))
  assert.ok(day.includes('13:00'))
  assert.ok(day.includes('15:30'))
  const capped = freeSlots({ type, from: '2026-10-19', days: 1, now, bookedPerDay: { '2026-10-19': 10 } })
  assert.deepEqual(capped['2026-10-19'], [])
})

test('nothing past the booking horizon', () => {
  const now = new Date('2026-10-18T05:00:00Z')
  const s = freeSlots({ type, cfg: { horizonDays: 2 }, from: '2026-10-19', days: 5, now })
  assert.ok(s['2026-10-19'].length > 0)
  assert.deepEqual(s['2026-10-21'], [])
})

test('validation: channel, phone, email for video calls, honeypot', () => {
  const base = { type: 'intro', channel: 'phone', name: 'דנה כהן', phone: '+972 52-123-4567', start: '2026-10-20T06:00:00.000Z' }
  const ok = validateBooking(base)
  assert.equal(ok.ok, true)
  assert.equal(ok.value.phone, '0521234567')
  assert.equal(ok.value.end, '2026-10-20T06:30:00.000Z')
  assert.equal(validateBooking({ ...base, channel: 'meet' }).errors.channel, 'unknown')   // the intro call is by phone only
  assert.equal(validateBooking({ ...base, channel: 'meet' }, { types: [{ ...DEFAULT_BOOKING.types[0], channels: ['meet', 'phone'] }] }).errors.email, 'required')
  assert.equal(validateBooking({ ...base, channel: 'zoom', email: 'a@b.co' }).errors.channel, 'unknown')   // no Zoom link set
  assert.equal(validateBooking({ ...base, channel: 'zoom', email: 'a@b.co' }, { zoomUrl: 'https://zoom.us/j/1', types: [{ ...DEFAULT_BOOKING.types[0], channels: ['zoom', 'phone'] }] }).ok, true)
  assert.equal(validateBooking({ ...base, phone: '123' }).errors.phone, 'invalid')
  assert.equal(validateBooking({ ...base, website: 'x' }).errors.spam, 'honeypot')
})

test('the calendar event: Meet link request, the lead as a guest, marked as a booking', () => {
  const withMeet = { types: [{ ...DEFAULT_BOOKING.types[0], channels: ['meet', 'phone'] }] }   // Meet is added in the admin
  const v = validateBooking({ type: 'intro', channel: 'meet', name: 'Dana', phone: '0521234567', email: 'dana@example.com', start: '2026-10-20T06:00:00.000Z' }, withMeet).value
  const ev = bookingEvent(v)
  assert.equal(ev.summary, 'שיחת היכרות · Dana')
  assert.equal(ev.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet')
  assert.deepEqual(ev.attendees, [{ email: 'dana@example.com', displayName: 'Dana' }])
  assert.equal(ev.extendedProperties.private.afikBooking, '1')
  const ph = bookingEvent({ ...v, channel: 'phone', email: '' })
  assert.equal(ph.conferenceData, undefined)
  assert.match(ph.location, /0521234567/)
  assert.ok(slotIsFree('2026-10-20T06:00:00Z', { '2026-10-20': ['2026-10-20T06:00:00.000Z'] }))
  assert.match(googleCalendarLink(v, { title: 'x' }), /dates=20261020T060000Z%2F20261020T063000Z/)
})

test('saved settings merge over the defaults', () => {
  const c = mergeBooking({ zoomUrl: 'z', hours: { 5: null } })
  assert.equal(c.zoomUrl, 'z')
  assert.equal(c.hours[5], null)
  assert.deepEqual(c.hours[0], [9, 19])
  assert.equal(c.types[0].id, 'intro')
})

test('the defaults: the page is "אפיק הנחל - ייזום שיווק ותיווך", the first meeting a 30-minute intro phone call', () => {
  assert.equal(DEFAULT_BOOKING.title.he, 'אפיק הנחל - ייזום שיווק ותיווך')
  assert.equal(DEFAULT_BOOKING.calendarId, 'afik.hanahal@gmail.com')
  const [first] = DEFAULT_BOOKING.types
  assert.equal(first.he, 'שיחת היכרות'); assert.equal(first.minutes, 30); assert.deepEqual(first.channels, ['phone'])
})

test('manage key, change rules, and moving a booking past its own busy block', async () => {
  const { parseManageKey, manageKey, manageUrl, canChange, subtractInterval, bookingView, MAX_RESCHEDULES } = await import('./booking.js')
  const entry = { id: 'a1b2c3d4e5f6', token: 'Zx9_-abcdefghijklmno', start: '2026-10-20T09:30:00.000Z', end: '2026-10-20T10:00:00.000Z', type: 'intro', channel: 'phone', name: 'דנה', phone: '0501234567', lang: 'he', status: 'booked' }
  assert.equal(manageKey(entry), 'a1b2c3d4e5f6.Zx9_-abcdefghijklmno')
  assert.deepEqual(parseManageKey(manageKey(entry)), { id: entry.id, token: entry.token })
  assert.equal(parseManageKey('../etc'), null)
  assert.equal(parseManageKey('a1b2c3d4e5f6.short'), null)
  assert.equal(manageUrl(entry), 'https://www.afikhanahal.co.il/book?m=a1b2c3d4e5f6.Zx9_-abcdefghijklmno')
  assert.match(manageUrl({ ...entry, lang: 'en' }), /&lang=en$/)

  const now = new Date('2026-10-19T08:00:00Z')
  assert.deepEqual(canChange(entry, now), { ok: true })
  assert.equal(canChange({ ...entry, status: 'cancelled' }, now).reason, 'cancelled')
  assert.equal(canChange(entry, new Date('2026-10-20T09:31:00Z')).reason, 'past')
  assert.equal(canChange({ ...entry, history: Array(MAX_RESCHEDULES).fill({ kind: 'moved' }) }, now).reason, 'limit')

  // a merged busy block (the booking + a meeting right after it) keeps only the other meeting
  const busy = [{ start: '2026-10-20T09:30:00.000Z', end: '2026-10-20T11:00:00.000Z' }, { start: '2026-10-20T13:00:00Z', end: '2026-10-20T14:00:00Z' }]
  assert.deepEqual(subtractInterval(busy, entry.start, entry.end), [{ start: '2026-10-20T10:00:00.000Z', end: '2026-10-20T11:00:00.000Z' }, busy[1]])
  assert.deepEqual(subtractInterval([{ start: entry.start, end: entry.end }], entry.start, entry.end), [])

  // the booking's own time comes back as free when it is being moved
  const own = [{ start: entry.start, end: entry.end }]
  const blocked = freeSlots({ type, from: '2026-10-20', days: 1, now, busy: own })['2026-10-20'].map(hhmm)
  const freed = freeSlots({ type, from: '2026-10-20', days: 1, now, busy: subtractInterval(own, entry.start, entry.end) })['2026-10-20'].map(hhmm)
  assert.ok(!blocked.includes('12:30') && freed.includes('12:30'))

  const v = bookingView({ ...entry, wa: { ok: false }, history: [{ kind: 'moved' }] }, DEFAULT_BOOKING, now)
  assert.equal(v.status, 'booked')
  assert.equal(v.type.he, 'שיחת היכרות')
  assert.equal(v.moved, 1)
  assert.equal(v.whatsapp, false)
  assert.equal(v.canChange, true)
  assert.ok(!('token' in v))
  assert.equal(bookingView(entry, DEFAULT_BOOKING, new Date('2026-10-21T00:00:00Z')).status, 'past')
})

test('what the client wrote fills the lead card: deal, property type, town, budget, rooms', async () => {
  const { notesToNeeds } = await import('./booking.js')
  const cities = ['פרדס חנה-כרכור', 'פרדס חנה', 'כפר סבא', 'הוד השרון', 'רעננה', 'חנה']
  assert.deepEqual(notesToNeeds('לקנות פרדסים בפרדס חנה', cities), { dealType: 'buy', propertyType: 'פרדס', area: 'פרדס חנה' })
  assert.deepEqual(notesToNeeds('מחפשים 4 חדרים בכפר סבא, תקציב עד 3 מיליון', cities), { area: 'כפר סבא', budget: 3000000, rooms: '4' })
  assert.deepEqual(notesToNeeds('רוצים למכור דירה ברעננה', cities), { dealType: 'sell', propertyType: 'דירה', area: 'רעננה' })
  assert.equal(notesToNeeds('השקעה במגרש, 2.5 מיליון', cities).budget, 2500000)
  assert.equal(notesToNeeds('השקעה במגרש', cities).dealType, 'invest')
  assert.deepEqual(notesToNeeds('', cities), {})
  assert.equal(notesToNeeds('חנויות בהוד השרון', cities).area, 'הוד השרון')
  assert.equal(notesToNeeds('מגרש בפרדס חנה', ['פרדס חנה-כרכור', 'תל אביב - יפו']).area, 'פרדס חנה-כרכור')
  assert.equal(notesToNeeds('דירה בתל אביב', ['פרדס חנה-כרכור', 'תל אביב - יפו']).area, 'תל אביב - יפו')
})
