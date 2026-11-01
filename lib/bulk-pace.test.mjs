import test from 'node:test'
import assert from 'node:assert/strict'
import { jobPace, paceGapMs, israelDay, nextIsraelMidnight, sentTodayCount, repliedSince, paceEstimate, DEFAULT_PACE } from './automations-shared.js'

test('jobPace: defaults and clamps', () => {
  assert.deepEqual(jobPace({}), DEFAULT_PACE)
  assert.deepEqual(jobPace({ gapSec: 5, dailyCap: 1 }), { gapSec: 30, dailyCap: 5 })
  assert.deepEqual(jobPace({ gapSec: 120, dailyCap: 100 }), { gapSec: 120, dailyCap: 100 })
  assert.deepEqual(jobPace({ gapSec: 'x', dailyCap: -3 }), DEFAULT_PACE)
})
test('paceGapMs: ±25 % around the gap, never under 30 s', () => {
  assert.equal(paceGapMs(60, () => 0), 45000)
  assert.equal(paceGapMs(60, () => 1), 75000)
  assert.equal(paceGapMs(10, () => 0.5), 30000)
})
test('israelDay / nextIsraelMidnight', () => {
  assert.equal(israelDay('2026-11-01T21:30:00Z'), '2026-11-01')   // 23:30 in Israel (UTC+2)
  assert.equal(israelDay('2026-11-01T22:30:00Z'), '2026-11-02')
  const m = nextIsraelMidnight(new Date('2026-11-01T12:00:00Z'))
  assert.equal(israelDay(m), '2026-11-02')
  assert.ok(m.getTime() - new Date('2026-11-01T22:00:00Z').getTime() < 900000)
})
test('sentTodayCount counts only today\'s sent messages', () => {
  const job = { recipients: [
    { status: 'sent', at: '2026-11-01T08:00:00Z' }, { status: 'sent', at: '2026-10-31T08:00:00Z' },
    { status: 'failed', at: '2026-11-01T08:00:00Z' }, { status: 'sent' }, {},
  ] }
  assert.equal(sentTodayCount(job, new Date('2026-11-01T12:00:00Z')), 1)
})
test('repliedSince: only a reply after the job was created', () => {
  const lead = { crm_data: { auto: { lastInboundTs: Date.parse('2026-11-01T10:00:00Z') } } }
  assert.equal(repliedSince(lead, '2026-11-01T09:00:00Z'), true)
  assert.equal(repliedSince(lead, '2026-11-01T11:00:00Z'), false)
  assert.equal(repliedSince({}, '2026-11-01T09:00:00Z'), false)
})
test('paceEstimate', () => {
  assert.deepEqual(paceEstimate(30, { gapSec: 60, dailyCap: 60 }), { days: 1, minutes: 30 })
  assert.deepEqual(paceEstimate(150, { gapSec: 60, dailyCap: 60 }), { days: 3, minutes: 60 })
  assert.deepEqual(paceEstimate(0), { days: 0, minutes: 0 })
})

import { abSplit, abResults, jobVariants } from './automations-shared.js'
test('abSplit deals the recipients out evenly and keeps everyone', () => {
  const rs = Array.from({ length: 10 }, (_, i) => ({ leadId: String(i) }))
  const out = abSplit(rs, ['a', 'b', 'c'])
  assert.equal(out.length, 10)
  assert.deepEqual(new Set(out.map(r => r.leadId)), new Set(rs.map(r => r.leadId)))
  const n = v => out.filter(r => r.variant === v).length
  assert.deepEqual([n('a'), n('b'), n('c')], [4, 3, 3])
  assert.equal(abSplit(rs, ['a'])[0].variant, undefined)
})
test('abResults: replies after the send, by version, and the leader', () => {
  const at = '2026-11-01T10:00:00Z', later = Date.parse('2026-11-01T11:00:00Z'), before = Date.parse('2026-11-01T09:00:00Z')
  const rec = (i, v, status = 'sent') => ({ leadId: String(i), variant: v, status, at })
  const job = { templateId: 'a', templateIds: ['a', 'b'], recipients: [rec(1, 'a'), rec(2, 'a'), rec(3, 'b'), rec(4, 'b'), rec(5, 'b', 'failed')] }
  const states = { 1: { lastInboundTs: later, intent: 'positive' }, 2: { lastInboundTs: before }, 3: { lastInboundTs: later, intent: 'negative' }, 4: { lastInboundTs: later } }
  const r = abResults(job, states)
  assert.deepEqual(r.rows.map(x => [x.id, x.sent, x.replied, x.positive, x.optOut]), [['a', 2, 1, 1, 0], ['b', 2, 2, 0, 1]])
  assert.equal(r.leader, 'b'); assert.equal(r.ready, false)
  assert.deepEqual(jobVariants({ templateId: 'x' }), ['x'])
})

test('the no-reply clock counts messages written on the phone and replies the journal missed', async () => {
  const { chatClock } = await import('./automations-shared.js')
  const created = Date.parse('2026-11-01T08:00:00Z'), installed = created - 864e5
  const welcome = created + 60e3, phone = created + 5 * 3600e3
  assert.deepEqual(chatClock({ prev: welcome, lastOut: phone, created, installed, reached: true }), { reached: true, prev: phone, replied: false })
  assert.deepEqual(chatClock({ prev: 0, lastOut: phone, created, installed }), { reached: true, prev: phone, replied: false })
  assert.equal(chatClock({ prev: welcome, lastIn: created + 3600e3, created, installed }).replied, true)
  assert.equal(chatClock({ prev: welcome, lastIn: created - 3600e3, created, installed }).replied, false)
  assert.deepEqual(chatClock({ prev: welcome, created, installed }), { reached: false, prev: welcome, replied: false })
})
