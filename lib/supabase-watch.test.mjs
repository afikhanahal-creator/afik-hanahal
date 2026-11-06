import test from 'node:test'
import assert from 'node:assert/strict'
import { usageProblems, usageSummary, FREE_LIMITS, statusProblem, uploadAllowed } from './supabase-watch.js'

const MB = 1048576
test('nothing to say while both quotas are under 70%', () => {
  assert.deepEqual(usageProblems({ db_bytes: 28 * MB, storage_bytes: 286 * MB, buckets: {} }), [])
  assert.deepEqual(usageProblems(null), [])
})
test('the database or the files over 70% of the free plan', () => {
  const p = usageProblems({ db_bytes: 400 * MB, storage_bytes: 800 * MB, buckets: { 'property-videos': 500 * MB, 'property-media': 200 * MB, a: 1, b: 2 } })
  assert.equal(p.length, 2)
  assert.match(p[0], /400 MB מתוך 500 MB/)
  assert.match(p[1], /800 MB מתוך 1024 MB \(property-videos 500 MB, property-media 200 MB/)
})
test('summary line', () => {
  assert.equal(usageSummary({ db_bytes: 28 * MB, storage_bytes: 286 * MB, short_cache_files: 0 }), 'DB 28 MB / 500 MB · Storage 286 MB / 1024 MB · every public file cached')
  assert.match(usageSummary({ db_bytes: 1, storage_bytes: 1, short_cache_files: 3, short_cache_bytes: 5 * MB }), /3 files without a long cache \(5 MB\)/)
  assert.equal(FREE_LIMITS.db, 500 * MB)
})
test('a label says which project', () => {
  const p = usageProblems({ db_bytes: 1, storage_bytes: 930 * MB, buckets: { 'engine-media': 788 * MB } }, { label: 'קורקוס' })
  assert.equal(p.length, 1)
  assert.match(p[0], /^קורקוס: הקבצים ב-Storage תופסים 930 MB מתוך 1024 MB \(engine-media 788 MB\)/)
})
test('a 402 is a problem of its own, other statuses are not', () => {
  assert.match(statusProblem(402, 'אפיק הנחל'), /^אפיק הנחל: Supabase חוסם את הפרויקט/)
  assert.equal(statusProblem(200), null)
  assert.equal(statusProblem(500), null)
})
test('an upload stops before the project passes 90% of the free quota', () => {
  assert.deepEqual(uploadAllowed({ storage_bytes: 305 * MB }, 100 * MB), { ok: true })
  const r = uploadAllowed({ storage_bytes: 900 * MB }, 50 * MB)
  assert.equal(r.ok, false)
  assert.match(r.error, /900 MB מתוך 1024 MB/)
  assert.deepEqual(uploadAllowed(null, 500 * MB), { ok: true })   // unknown usage never blocks
  assert.deepEqual(uploadAllowed({ storage_bytes: 0 }, 5 * MB), { ok: true })
})
