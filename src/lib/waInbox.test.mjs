import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lastOfChat, waitingState, fmtWait, alertText, mergeAlert, applyWaiting, chatRows, rowLast, rowTime } from './waInbox.js'

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

test('chatRows: one row per number — several leads with the same phone are one chat (the newest lead names it)', () => {
  const leads = [
    { id: 'a', name: 'יוגי טסט', phone: '0501234567', created_at: '2026-10-01T10:00:00Z' },
    { id: 'b', name: 'יוגי', phone: '+972-50-123-4567', created_at: '2026-11-01T10:00:00Z' },
    { id: 'c', name: 'רונן', phone: '0529999999', created_at: '2026-10-05T10:00:00Z' },
    { id: 'd', name: 'בלי טלפון', phone: '' },
  ]
  const green = [
    { phone: '972501234567', timestamp: Date.parse('2026-11-07T00:23:00Z') / 1000, type: 'outgoing', text: 'חדש' },
    { phone: '972541111111', name: 'nash', timestamp: Date.parse('2026-11-06T15:25:00Z') / 1000, type: 'incoming', text: 'אוקיי' },
  ]
  const rows = chatRows(leads, green)
  assert.equal(rows.length, 3)
  const yogi = rows.find(r => r.phone.endsWith('4567'))
  assert.equal(yogi.id, 'b')
  assert.equal(yogi.glast.message, 'חדש')
  assert.equal(yogi.glast.direction, 'out')
  assert.equal(rows.find(r => r.id === 'c').glast, undefined)
  const extra = rows.find(r => r.waOnly)
  assert.equal(extra.id, 'wa:972541111111')
  assert.equal(extra.glast.direction, 'in')
})

test('rowLast / rowTime: the server\'s newer message wins over a stale local copy (a screen asleep all night)', () => {
  const local = { id: 'x', message: 'תזכורת', created_at: '2026-11-06T15:24:00Z', direction: 'out' }
  const row = chatRows([{ id: 'b', name: 'יוגי', phone: '0501234567' }], [{ phone: '972501234567', timestamp: Date.parse('2026-11-07T00:23:00Z') / 1000, type: 'outgoing', text: 'חדש' }])[0]
  assert.equal(rowLast(local, row).message, 'חדש')
  assert.equal(rowLast({ ...local, created_at: '2026-11-07T00:23:00.500Z' }, row).message, 'תזכורת')   // the same message: ours keeps its ticks
  assert.equal(rowLast({ ...local, created_at: '2026-11-07T01:00:00Z' }, row).message, 'תזכורת')
  assert.equal(rowLast(local, { id: 'q' }).message, 'תזכורת')
  assert.equal(rowLast(null, row).message, 'חדש')
  assert.equal(rowTime(local, row), Date.parse('2026-11-07T00:23:00Z'))
  assert.equal(rowTime({ created_at: '2026-11-08T00:00:00Z' }, row), Date.parse('2026-11-08T00:00:00Z'))
})
