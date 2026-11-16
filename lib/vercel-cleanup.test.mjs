import test from 'node:test'
import assert from 'node:assert/strict'
import { pickDeletions, summarize, pickProjects } from './vercel-cleanup.js'

const DAY = 864e5, now = Date.parse('2026-11-02T12:00:00Z')
const d = (id, days, target, state = 'READY') => ({ uid: id, created: now - days * DAY, target, readyState: state })

test('keeps the 3 newest production ones and the last day', () => {
  const list = [
    d('p0', 0.1, 'production'), d('p1', 0.5, 'production'), d('p2', 0.9, 'production'), d('p3', 0.95, 'production'),
    d('p4', 2, 'production'), d('p5', 8, 'production'), d('p6', 30, 'production'),
  ]
  const del = pickDeletions(list, now)
  // newest 3 kept, p3 is younger than a day, p4–p6 go
  assert.deepEqual(del.map(x => x.id), ['p4', 'p5', 'p6'])
  assert.ok(del.every(x => x.why === 'old-production'))
  // the older, looser rule is still possible
  assert.deepEqual(pickDeletions(list, now, { keepProd: 5, prodDays: 7 }).map(x => x.id), ['p5', 'p6'])
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

test('every project unless some are named', () => {
  const ps = [{ id: 'prj_a', name: 'afik-hanahal' }, { id: 'prj_k', name: 'kurkoos-group' }, { name: 'no-id' }, null]
  assert.deepEqual(pickProjects(ps).map(p => p.name), ['afik-hanahal', 'kurkoos-group'])
  assert.deepEqual(pickProjects(ps, 'kurkoos-group').map(p => p.id), ['prj_k'])
  assert.deepEqual(pickProjects(ps, ' prj_a , kurkoos-group ').length, 2)
})
