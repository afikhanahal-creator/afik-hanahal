import test from 'node:test'
import assert from 'node:assert/strict'
import { createFeed, findPublished, SNAPSHOT_KEY } from './property-feed.js'

const later = (ms, v) => new Promise(r => setTimeout(() => r(v), ms))
const res = (body, ok = true, status = ok ? 200 : 500) => ({ ok, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), json: async () => (typeof body === 'string' ? JSON.parse(body) : body) })

const LIVE = [{ id: 1, title: 'live', published: true }, { id: 2, title: 'hidden', published: false }, { id: 3, title: 'new' }]
const SNAP = [{ id: 1, title: 'snap' }]

// A fake Render + Supabase. renderMs = how slow Render is (Infinity = never answers in time).
function world({ renderMs = 0, renderOk = true, snapshot = SNAP } = {}) {
  const calls = { render: 0, snapRead: 0, hashRead: 0, write: 0, written: null }
  const fetchImpl = async (url, opts = {}) => {
    if (url.startsWith('https://site.test/properties.json')) { calls.static = (calls.static || 0) + 1; return res([{ id: 1, title: 'static' }, { id: 9, title: 'static-only' }]) }
    if (url.startsWith('https://render.test')) {
      calls.render++
      if (renderMs === Infinity) return new Promise(() => {})
      return later(renderMs, renderOk ? res(LIVE) : res({ error: 'x' }, false, 502))
    }
    if (url.includes('select=hash:')) { calls.hashRead++; return res(calls.written ? [{ hash: calls.written.value.hash }] : snapshot ? [{ hash: 'old' }] : []) }
    if (url.includes(`key=eq.${SNAPSHOT_KEY}&select=value`)) { calls.snapRead++; return res(snapshot ? [{ value: { at: '2026-09-01T00:00:00Z', list: snapshot, hash: 'old' } }] : []) }
    if (opts.method === 'POST') { calls.write++; calls.written = JSON.parse(opts.body); return res('', true, 201) }
    throw new Error('unexpected ' + url)
  }
  const feed = createFeed({ renderUrl: 'https://render.test', supaUrl: 'https://supa.test', supaKey: 'k', fetchImpl, renderBudgetMs: 150, renderTimeoutMs: 1000 })
  return { feed, calls }
}

test('findPublished skips hidden properties', () => {
  assert.equal(findPublished(LIVE, '1').title, 'live')
  assert.equal(findPublished(LIVE, 2), null)
  assert.equal(findPublished(null, 1), null)
})

test('Render answers in time → live list, snapshot refreshed once', async () => {
  const { feed, calls } = world({ renderMs: 10 })
  const r = await feed.getList()
  assert.equal(r.source, 'render'); assert.equal(r.list.length, 3)
  assert.equal(calls.write, 1); assert.deepEqual(calls.written.value.list, LIVE)
  await feed.getList()
  assert.equal(calls.write, 1, 'an unchanged list is not written again')
})

test('Render asleep → the snapshot answers within the budget', async () => {
  const { feed } = world({ renderMs: Infinity })
  const t0 = Date.now()
  const r = await feed.getList()
  assert.equal(r.source, 'snapshot'); assert.equal(r.list[0].title, 'snap')
  assert.ok(Date.now() - t0 < 600, `took ${Date.now() - t0} ms`)
})

test('Render failing fast → snapshot right away', async () => {
  const { feed } = world({ renderOk: false })
  const t0 = Date.now()
  const r = await feed.getList()
  assert.equal(r.source, 'snapshot')
  assert.ok(Date.now() - t0 < 120)
})

test('no snapshot yet → waits for slow Render, then stores it', async () => {
  const { feed, calls } = world({ renderMs: 300, snapshot: null })
  const r = await feed.getList()
  assert.equal(r.source, 'render'); assert.equal(calls.write, 1)
})

test('no snapshot and Render down → error', async () => {
  const { feed } = world({ renderOk: false, snapshot: null })
  await assert.rejects(feed.getList())
})

test('getOne: snapshot first, live list for a property the snapshot lacks', async () => {
  const w = world({ renderMs: 10 })
  const a = await w.feed.getOne(1)
  assert.equal(a.source, 'snapshot'); assert.equal(a.property.title, 'snap'); assert.equal(w.calls.render, 0)
  const b = await w.feed.getOne(3)
  assert.equal(b.source, 'render'); assert.equal(b.property.title, 'new')
  const c = await w.feed.getOne(2)
  assert.equal(c.property, null, 'unpublished is never returned')
})

test('without Supabase config it still serves Render', async () => {
  const feed = createFeed({ renderUrl: 'https://render.test', fetchImpl: async () => res(LIVE), renderBudgetMs: 50 })
  assert.equal((await feed.getList()).source, 'render')
})

test('Render asleep, no snapshot → the deploy-time static list answers', async () => {
  const { feed } = world({ renderMs: Infinity, snapshot: null })
  const t0 = Date.now()
  const r = await feed.getList({ staticUrl: 'https://site.test/properties.json' })
  assert.equal(r.source, 'static'); assert.equal(r.list[0].title, 'static')
  assert.ok(Date.now() - t0 < 600)
  const one = await feed.getOne(9, { staticUrl: 'https://site.test/properties.json' })
  assert.equal(one.property.title, 'static-only')
})
