import test from 'node:test'
import assert from 'node:assert/strict'
import { regroupSlots, zoneOptions, zoneLabel, gmtOffset, timeIn, validTz, OFFICE_TZ } from './bookingTz.js'

// Sunday 18:30 and Monday 09:00 Israel time (UTC+3 in October)
const slots = { '2026-10-18': ['2026-10-18T15:30:00.000Z'], '2026-10-19': ['2026-10-19T06:00:00.000Z', '2026-10-19T06:30:00.000Z'] }

test('slots keep the server grouping in Israel and move to the right day elsewhere', () => {
  assert.equal(regroupSlots(slots, OFFICE_TZ), slots)
  const tokyo = regroupSlots(slots, 'Asia/Tokyo')          // 18:30 Israel = 00:30 next day in Tokyo
  assert.deepEqual(Object.keys(tokyo).sort(), ['2026-10-19'])
  assert.equal(tokyo['2026-10-19'].length, 3)
  const la = regroupSlots(slots, 'America/Los_Angeles')   // 09:00 Israel = 23:00 the day before in LA
  assert.deepEqual(Object.keys(la).sort(), ['2026-10-18'])
  assert.equal(regroupSlots(null, 'UTC'), null)
})

test('times in 24 h or am/pm, offsets and labels', () => {
  assert.equal(timeIn('2026-10-19T06:00:00.000Z', OFFICE_TZ), '09:00')
  assert.equal(timeIn('2026-10-19T06:00:00.000Z', 'America/New_York', true), '2:00 AM')
  assert.equal(gmtOffset(OFFICE_TZ, new Date('2026-10-19T06:00:00Z')), 'GMT+3')
  assert.equal(zoneLabel('Europe/London', 'he'), 'לונדון')
  assert.equal(zoneLabel('America/Phoenix', 'en'), 'Phoenix')
  assert.ok(validTz('Europe/Paris')); assert.ok(!validTz('Mars/Olympus'))
})

test('the picker list: own zone first when missing, groups, search in both languages', () => {
  const all = zoneOptions({ lang: 'he', mine: 'America/Phoenix' })
  assert.equal(all[0].group.id, 'mine'); assert.equal(all[0].zones[0].label, 'Phoenix')
  assert.equal(all[1].group.id, 'il')
  assert.equal(zoneOptions({ lang: 'he', mine: OFFICE_TZ })[0].group.id, 'il')
  const q = zoneOptions({ lang: 'he', q: 'london', mine: OFFICE_TZ })
  assert.deepEqual(q.flatMap(g => g.zones.map(z => z.id)), ['Europe/London'])
  assert.deepEqual(zoneOptions({ lang: 'en', q: 'טוקיו', mine: OFFICE_TZ }).flatMap(g => g.zones.map(z => z.id)), ['Asia/Tokyo'])
})
