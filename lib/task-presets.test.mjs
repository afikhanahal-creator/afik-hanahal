import test from 'node:test'
import assert from 'node:assert/strict'
import { TASK_PRESETS, TASK_GROUPS, filterPresets, presetDue, pushRecent } from './task-presets.js'

test('every preset is bilingual, unique and without Hebrew in English', () => {
  assert.ok(TASK_PRESETS.length >= 40)
  assert.equal(new Set(TASK_PRESETS.map(p => p.id)).size, TASK_PRESETS.length)
  for (const p of TASK_PRESETS) { assert.ok(p.he && p.en, p.id); assert.doesNotMatch(p.en, /[֐-׿]/, p.id) }
  for (const g of TASK_GROUPS) assert.ok(g.he && g.en && g.items.length)
})

test('search in either language; follow-ups start with calls', () => {
  assert.deepEqual(filterPresets('טאבו').flatMap(g => g.items.map(p => p.id)), ['deal_tabu'])
  assert.deepEqual(filterPresets('review').flatMap(g => g.items.map(p => p.id)), ['after_review'])
  assert.equal(filterPresets('', { kind: 'followup' })[0].id, 'call')
  assert.equal(filterPresets('zzzz').length, 0)
})

test('suggested due: Israel time, never in the past, Saturday → Sunday', () => {
  const now = Date.parse('2026-11-01T08:00:00Z')               // Sunday 10:00 in Israel
  assert.equal(presetDue({ days: 1, hour: 10 }, now), '2026-11-02T08:00:00.000Z')
  assert.equal(presetDue({ days: 0, hour: 9 }, now), '2026-11-01T09:00:00.000Z')   // 9:00 passed → the next half hour ≥ 1 h ahead
  assert.equal(presetDue({ days: 6, hour: 11 }, now), '2026-11-08T09:00:00.000Z')  // Saturday → Sunday
  assert.equal(presetDue({ days: null }), '')
})

test('recent texts', () => {
  assert.deepEqual(pushRecent(['א', 'ב'], 'ב'), ['ב', 'א'])
  assert.deepEqual(pushRecent(['א'], 'לשלוח תוכניות ומחירון'), ['א'])
  assert.deepEqual(pushRecent([], '  '), [])
})
