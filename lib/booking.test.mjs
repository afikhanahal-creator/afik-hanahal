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
