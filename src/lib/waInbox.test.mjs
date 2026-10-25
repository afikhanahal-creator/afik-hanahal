import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lastOfChat, waitingState, fmtWait, alertText, mergeAlert } from './waInbox.js'

test('lastOfChat takes the newer of the loaded messages and the list row', () => {
  const msgs = [{ direction: 'out', created_at: '2026-10-25T10:00:00Z', message: 'היי' }]
  assert.equal(lastOfChat(msgs, { type: 'incoming', timestamp: Date.parse('2026-10-25T10:05:00Z') / 1000, text: 'כן' }).dir, 'in')
  assert.equal(lastOfChat(msgs, { type: 'incoming', timestamp: Date.parse('2026-10-25T09:00:00Z') / 1000 }).dir, 'out')
  assert.equal(lastOfChat([], null), null)
})

test('waitingState: the last word is the lead\'s', () => {
  const now = Date.parse('2026-10-25T12:00:00Z')
  assert.deepEqual(waitingState({ dir: 'in', ts: now - 5 * 60e3 }, now), { waiting: true, mins: 5, level: 'fresh' })
  assert.equal(waitingState({ dir: 'in', ts: now - 25 * 60e3 }, now).level, 'warn')
  assert.equal(waitingState({ dir: 'in', ts: now - 3 * 3600e3 }, now).level, 'late')
  assert.equal(waitingState({ dir: 'out', ts: now }, now).waiting, false)
  assert.equal(waitingState({ dir: 'in', ts: now - 9 * 864e5 }, now).waiting, false)
})

test('fmtWait reads short', () => {
  assert.equal(fmtWait(0), 'עכשיו')
  assert.equal(fmtWait(12), 'ממתין 12 דק׳')
  assert.equal(fmtWait(130), 'ממתין 2 שע׳')
  assert.equal(fmtWait(1500), 'ממתין יום')
  assert.equal(fmtWait(3000, 'en'), 'waiting 2 days')
})

test('alertText: text, else what was sent', () => {
  assert.equal(alertText({ textMessage: 'היי  מה\nנשמע' }), 'היי מה נשמע')
  assert.equal(alertText({ typeMessage: 'audioMessage' }), '🎤 הודעה קולית')
  assert.equal(alertText({ typeMessage: 'imageMessage', caption: 'הנה' }), 'הנה')
  assert.ok(alertText({ textMessage: 'א'.repeat(300) }).length <= 140)
})

test('mergeAlert: one alert per chat, the count grows, a repeat is ignored', () => {
  let l = mergeAlert([], { id: 1, phone: '972501', text: 'א', ids: ['m1'] })
  l = mergeAlert(l, { id: 2, phone: '972502', text: 'ב', ids: ['m2'] })
  l = mergeAlert(l, { id: 3, phone: '972501', text: 'ג', ids: ['m3'] })
  assert.equal(l.length, 2)
  assert.equal(l[1].phone, '972501')
  assert.equal(l[1].count, 2)
  assert.equal(l[1].text, 'ג')
  assert.equal(l[1].id, 1)
  assert.equal(mergeAlert(l, { id: 4, phone: '972501', ids: ['m3'] }), l)
})
