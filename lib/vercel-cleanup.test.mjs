import test from 'node:test'
import assert from 'node:assert/strict'
import { pickDeletions, summarize } from './vercel-cleanup.js'

const DAY = 864e5, now = Date.parse('2026-11-02T12:00:00Z')
const d = (id, days, target, state = 'READY') => ({ uid: id, created: now - days * DAY, target, readyState: state })

test('keeps the newest production ones and the last week', () => {
  const list = [
    d('p0', 0.1, 'production'), d('p1', 1, 'production'), d('p2', 2, 'production'), d('p3', 8, 'production'),
    d('p4', 9, 'production'), d('p5', 10, 'production'), d('p6', 30, 'production'), d('p7', 60, 'production'),
  ]
  const del = pickDeletions(list, now)
  // newest 5 ready kept (p0–p4), the rest older than 7 days go
  assert.deepEqual(del.map(x => x.id), ['p5', 'p6', 'p7'])
  assert.ok(del.every(x => x.why === 'old-production'))
  // keepProd 2: p3 and p4 go too (older than 7 days), p2 stays (young)
  assert.deepEqual(pickDeletions(list, now, { keepProd: 2 }).map(x => x.id), ['p3', 'p4', 'p5', 'p6', 'p7'])
})

test('previews, failed, building', () => {
  const list = [
    d('a', 0.5, null), d('b', 2, null), d('c', 3, 'production', 'ERROR'), d('e', 0.2, 'production', 'ERROR'),
    d('f', 5, null, 'CANCELED'), d('g', 40, 'production', 'BUILDING'), d('h', 40, 'production'),
    { uid: 'x' }, null, { created: now - 50 * DAY },
  ]
  const del = pickDeletions(list, now)
  assert.deepEqual(del.map(x => `${x.id}:${x.why}`), ['b:old-preview', 'c:error', 'f:canceled'])
  // the only ready production one is always kept, however old
  assert.ok(!del.some(x => x.id === 'h'))
  assert.deepEqual(summarize(list, del), { total: 10, delete: 3, keep: 7, by: { 'old-preview': 1, error: 1, canceled: 1 } })
})

test('never deletes the live one even with keepProd 0', () => {
  assert.deepEqual(pickDeletions([d('only', 90, 'production')], now, { keepProd: 0 }), [])
})
