import test from 'node:test'
import assert from 'node:assert/strict'
import { propertiesChanged } from './site-rebuild.js'

const res = (body, ok = true, status = ok ? 200 : 500) => ({ ok, status, text: async () => JSON.stringify(body), json: async () => body })
function world({ lastAt = 0, hookOk = true } = {}) {
  const calls = { hook: 0, stamp: null, snapshotWrites: 0 }
  const fetchImpl = async (url, opts = {}) => {
    if (url.startsWith('https://render.test')) return res([{ id: 1, title: 'x' }])
    if (url.startsWith('https://hook.test')) { calls.hook++; return res({ job: 1 }, hookOk, hookOk ? 201 : 404) }
    if (url.includes('key=eq.site_rebuild')) return res(lastAt ? [{ value: { at: lastAt } }] : [])
    if (url.includes('select=hash:')) return res([])
    if (opts.method === 'POST') { const b = JSON.parse(opts.body); if (b.key === 'site_rebuild') calls.stamp = b.value.at; else calls.snapshotWrites++; return res('', true, 201) }
    return res([])
  }
  const base = { renderUrl: 'https://render.test', supaUrl: 'https://supa.test', supaKey: 'k', hookUrl: 'https://hook.test/x', fetchImpl, now: () => 1_000_000 }
  return { calls, run: extra => propertiesChanged({ ...base, ...extra }) }
}

test('refreshes the snapshot and triggers the rebuild', async () => {
  const w = world()
  const r = await w.run()
  assert.equal(r.snapshot.source, 'render'); assert.equal(w.calls.snapshotWrites, 1)
  assert.equal(r.rebuild, 'triggered'); assert.equal(w.calls.hook, 1); assert.equal(w.calls.stamp, 1_000_000)
})

test('at most one rebuild a minute', async () => {
  const w = world({ lastAt: 1_000_000 - 20_000 })
  const r = await w.run()
  assert.equal(r.rebuild, 'throttled'); assert.equal(r.retryInMs, 40_000); assert.equal(w.calls.hook, 0)
})

test('without a hook it only refreshes the snapshot', async () => {
  const w = world()
  const r = await w.run({ hookUrl: '' })
  assert.equal(r.rebuild, 'not-configured'); assert.equal(w.calls.hook, 0); assert.equal(r.snapshot.count, 1)
})

test('a failing hook is reported, not stamped', async () => {
  const w = world({ hookOk: false })
  const r = await w.run()
  assert.equal(r.rebuild, 'hook HTTP 404'); assert.equal(w.calls.stamp, null)
})
