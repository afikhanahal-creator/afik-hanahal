import test from 'node:test'
import assert from 'node:assert/strict'
import { waLastInfo, applyWaLast, agoText, waLastAt } from './waLastFormat.js'

// 2026-11-16 12:00 Israel time (UTC+2)
const now = Date.parse('2026-11-16T10:00:00Z')
const H = 3600e3, D = 864e5

test('no message → nothing', () => {
  assert.equal(waLastInfo(null, now), null)
  assert.equal(waLastInfo({ in: 0, out: 0 }, now), null)
})

test('today / yesterday / this year / an earlier year, in Israel time', () => {
  assert.equal(waLastInfo({ out: now - 2 * H }, now).when, 'היום 10:00')
  assert.equal(waLastInfo({ in: Date.parse('2026-11-15T19:30:00Z') }, now).when, 'אתמול 21:30')
  assert.equal(waLastInfo({ in: Date.parse('2026-11-08T07:05:00Z') }, now).when, '08.11 · 09:05')
  assert.equal(waLastInfo({ out: Date.parse('2025-12-30T10:00:00Z') }, now).when, '30.12.25')
  // just after midnight in Israel is already "today" though UTC is still the day before
  const late = Date.parse('2026-11-15T22:30:00Z')
  assert.equal(waLastInfo({ out: late }, Date.parse('2026-11-15T23:00:00Z')).when, 'היום 00:30')
})

test('who wrote last and the colour by age', () => {
  const a = waLastInfo({ in: now - 3 * H, out: now - 5 * H }, now)
  assert.equal(a.dir, 'in'); assert.equal(a.who, 'הם כתבו'); assert.equal(a.tone, 'fresh'); assert.equal(a.ago, 'לפני 3 שע׳')
  const b = waLastInfo({ in: now - 9 * D, out: now - 4 * D }, now)
  assert.equal(b.dir, 'out'); assert.equal(b.who, 'אנחנו כתבנו'); assert.equal(b.tone, 'mid'); assert.equal(b.ago, 'לפני 4 ימים')
  assert.equal(waLastInfo({ out: now - 20 * D }, now).tone, 'old')
  assert.equal(waLastInfo({ out: now - 2 * H }, now, 'en').who, 'we wrote')
})

test('how long ago, in words', () => {
  assert.equal(agoText(20e3), 'עכשיו')
  assert.equal(agoText(12 * 60e3), 'לפני 12 דק׳')
  assert.equal(agoText(H), 'לפני שעה')
  assert.equal(agoText(2 * H), 'לפני שעתיים')
  assert.equal(agoText(D), 'לפני יום')
  assert.equal(agoText(2 * D), 'לפני יומיים')
  assert.equal(agoText(75 * D), 'לפני 3 חודשים')
  assert.equal(agoText(5 * H, true), '5 h ago')
})

test('the live feed moves a phone forward, never back; reactions and unknown sides are ignored', () => {
  const m0 = new Map([['528017218', { in: 1000, out: 5000 }]])
  const sec = ms => ms / 1000
  const m1 = applyWaLast(m0, [
    { phone: '972528017218', type: 'incoming', typeMessage: 'textMessage', timestamp: sec(9000) },
    { phone: '972528017218', type: 'outgoing', typeMessage: 'textMessage', timestamp: sec(4000) },   // older than what we have
    { phone: '972501112223', type: 'outgoing', typeMessage: 'imageMessage', timestamp: sec(7000) },
    { phone: '972501112223', type: 'incoming', typeMessage: 'reactionMessage', timestamp: sec(8000) },
    { phone: '12', type: 'incoming', timestamp: 9 },
  ])
  assert.notEqual(m1, m0)
  assert.deepEqual(m1.get('528017218'), { in: 9000, out: 5000 })
  assert.deepEqual(m1.get('501112223'), { in: 0, out: 7000 })
  assert.deepEqual(m0.get('528017218'), { in: 1000, out: 5000 }, 'the old map is not touched')
  assert.equal(applyWaLast(m1, [{ phone: '972528017218', type: 'incoming', timestamp: sec(9000) }]), m1, 'nothing new → the same map')
  assert.equal(waLastAt({ in: 3, out: 8 }), 8)
  assert.equal(waLastAt(null), 0)
})
