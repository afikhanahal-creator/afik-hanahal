import test from 'node:test'
import assert from 'node:assert/strict'
import { hostDecision, noteHosted, isOurStorage, HOST_TTL } from './green-host.js'

test('big files go to Green at once, mid-size ones from their second send, small ones never', () => {
  assert.equal(hostDecision(null, 41e6), 'upload')
  assert.equal(hostDecision(null, 270e3), 'direct')
  assert.equal(hostDecision({ n: 1, size: 270e3 }, 270e3), 'upload')
  assert.equal(hostDecision({ n: 5 }, 50e3), 'direct')
  assert.equal(hostDecision(null, 0), 'direct')
})
test('a Green copy is used for 13 days, then uploaded again', () => {
  const now = Date.parse('2026-11-05T10:00:00Z')
  assert.equal(hostDecision({ green: 'https://g/x', at: now - 864e5, size: 41e6 }, 0, now), 'green')
  assert.equal(hostDecision({ green: 'https://g/x', at: now - HOST_TTL - 1, size: 41e6 }, 41e6, now), 'upload')
})
test('the map counts sends and keeps the newest entries', () => {
  let m = noteHosted({}, 'a', { size: 1 }, 1)
  m = noteHosted(m, 'a', { green: 'g' }, 2)
  assert.deepEqual(m.a, { size: 1, n: 2, seen: 2, green: 'g' })
  const big = {}; for (let i = 0; i < 5; i++) big[`u${i}`] = { seen: i }
  assert.deepEqual(Object.keys(noteHosted(big, 'new', {}, 10, 3)).sort(), ['new', 'u3', 'u4'])
})
test('only our own public storage files', () => {
  const S = 'https://x.supabase.co'
  assert.equal(isOurStorage('https://x.supabase.co/storage/v1/object/public/property-media/a.jpg', S), true)
  assert.equal(isOurStorage('https://wsrv.nl/?url=x', S), false)
  assert.equal(isOurStorage('https://x.supabase.co/storage/v1/object/public/a.jpg', ''), false)
})
