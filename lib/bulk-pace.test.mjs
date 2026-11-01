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
