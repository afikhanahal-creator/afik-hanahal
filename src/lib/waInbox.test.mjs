import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lastOfChat, waitingState, fmtWait, alertText, mergeAlert, applyWaiting } from './waInbox.js'

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

test('applyWaiting: incoming marks the chat, our reply clears it, older messages and reactions change nothing', () => {
  const m0 = new Map()
  const inMsg = { type: 'incoming', typeMessage: 'textMessage', textMessage: 'מתי יש מפתח?', timestamp: 1000, phone: '972521234567' }
  const m1 = applyWaiting(m0, [inMsg])
  assert.notEqual(m1, m0); assert.equal(m1.get('521234567').text, 'מתי יש מפתח?')
  assert.equal(applyWaiting(m1, [{ type: 'outgoing', typeMessage: 'textMessage', timestamp: 900, phone: '972521234567' }]), m1)   // an old status update
  assert.equal(applyWaiting(m1, [{ type: 'outgoing', typeMessage: 'reactionMessage', timestamp: 2000, phone: '972521234567' }]), m1)
  const m2 = applyWaiting(m1, [{ type: 'outgoing', typeMessage: 'textMessage', timestamp: 1100, phone: '0521234567' }])
  assert.equal(m2.has('521234567'), false)
  const m3 = applyWaiting(m2, [{ ...inMsg, timestamp: 1200 }, { type: 'outgoing', typeMessage: 'textMessage', timestamp: 1150, phone: '972521234567' }])
  assert.equal(m3.get('521234567').ts, 1200000)       // sorted by time: our 1150 reply came before their 1200 message
})
