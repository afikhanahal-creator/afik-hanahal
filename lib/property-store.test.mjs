import test from 'node:test'
import assert from 'node:assert/strict'
import { createStore, numericId, rowToProperty } from './property-store.js'

const res = (body, ok = true, status = ok ? 200 : 500) => ({ ok, status, text: async () => JSON.stringify(body), json: async () => body })

// A fake properties table: rows keyed by id, every request recorded
function world(rows = []) {
  const table = new Map(rows.map(r => [r.id, r]))
  const calls = []
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', headers: opts.headers, body: opts.body ? JSON.parse(opts.body) : null })
    if (opts.method === 'POST') {
      const b = JSON.parse(opts.body)
      const ignore = /ignore-duplicates/.test(opts.headers.Prefer)
      for (const r of Array.isArray(b) ? b : [b]) { if (ignore && table.has(r.id)) continue; table.set(r.id, { ...(table.get(r.id) || {}), ...r }) }
      return res('', true, 201)
    }
    if (opts.method === 'DELETE') { table.delete(Number((url.match(/id=eq\.(\d+)/) || [])[1])); return res('', true, 204) }
    if (/select=id$/.test(url)) return res([...table.keys()].map(id => ({ id })))
    const one = url.match(/id=eq\.(\d+)/)
    let list = one ? [table.get(Number(one[1]))].filter(Boolean) : [...table.values()]
    if (url.includes('published=eq.true')) list = list.filter(r => r.published !== false)
    return res(list)
  }
  return { store: createStore({ supaUrl: 'https://supa.test/', supaKey: 'k', fetchImpl }), table, calls }
}

test('numericId accepts only a positive integer (the table key is a BIGINT)', () => {
  assert.equal(numericId(1780342703393), 1780342703393)
  assert.equal(numericId('1780342703393'), 1780342703393)
  assert.equal(numericId('intake-abc'), null)
  assert.equal(numericId('12.5'), null)
  assert.equal(numericId(0), null)
  assert.equal(numericId(-3), null)
  assert.equal(numericId(''), null)
  assert.equal(numericId(null), null)
})

test('rowToProperty: the row columns win over the stored copy', () => {
  assert.deepEqual(rowToProperty({ id: 5, data: { id: '5', title: 't', published: true }, published: false }), { id: 5, title: 't', published: false })
  assert.deepEqual(rowToProperty({ id: 6, data: null, published: true }), { id: 6, published: true })
})

test('list maps rows; publishedOnly filters on the server', async () => {
  const w = world([{ id: 1, data: { title: 'a' }, published: true }, { id: 2, data: { title: 'b' }, published: false }])
  const all = await w.store.list()
  assert.deepEqual(all.map(p => p.id), [1, 2]); assert.equal(all[1].published, false)
  const pub = await w.store.list({ publishedOnly: true })
  assert.deepEqual(pub.map(p => p.id), [1])
  assert.match(w.calls[1].url, /published=eq\.true/)
  assert.match(w.calls[0].url, /^https:\/\/supa\.test\/rest\/v1\/properties\?select=id,data,published,created_at&order=created_at\.desc$/)
})

test('one: by id, null when missing or not numeric', async () => {
  const w = world([{ id: 7, data: { title: 'seven' }, published: true }])
  assert.equal((await w.store.one('7')).title, 'seven')
  assert.equal(await w.store.one(8), null)
  assert.equal(await w.store.one('intake-x'), null)
})

test('upsert writes the whole property as the row, keyed by its numeric id', async () => {
  const w = world()
  const r = await w.store.upsert({ id: '1790232349039', title: 'new', images: ['u'] })
  assert.deepEqual(r, { id: 1790232349039, published: true })
  const call = w.calls[0]
  assert.equal(call.method, 'POST'); assert.match(call.url, /properties\?on_conflict=id$/)
  assert.match(call.headers.Prefer, /merge-duplicates/)
  assert.equal(call.body.id, 1790232349039); assert.equal(call.body.published, true)
  assert.deepEqual(call.body.data, { id: 1790232349039, title: 'new', images: ['u'], published: true })
  assert.ok(call.body.updated_at)
  await w.store.upsert({ id: 1790232349039, title: 'hidden now', published: false })
  assert.equal(w.table.get(1790232349039).published, false)
})

test('upsert refuses an id the table cannot hold', async () => {
  const w = world()
  await assert.rejects(() => w.store.upsert({ id: 'intake-abc' }), /positive integer/)
  await assert.rejects(() => w.store.upsert({ title: 'no id' }), /positive integer/)
  assert.equal(w.calls.length, 0)
})

test('upsertMany reports what was saved and what failed', async () => {
  const w = world()
  const r = await w.store.upsertMany([{ id: 1 }, { id: 'x' }, { id: 2 }])
  assert.deepEqual(r.saved, [1, 2]); assert.equal(r.errors.length, 1); assert.match(r.errors[0], /^x:/)
})

test('remove deletes by id', async () => {
  const w = world([{ id: 3, data: {}, published: true }])
  assert.deepEqual(await w.store.remove('3'), { id: 3 })
  assert.equal(w.table.size, 0)
  assert.equal(w.calls[0].method, 'DELETE'); assert.match(w.calls[0].url, /id=eq\.3$/)
  await assert.rejects(() => w.store.remove('abc'), /positive integer/)
})

test('addMissing inserts only what the table lacks, never overwrites, dates the row from its id', async () => {
  const w = world([{ id: 1780342703393, data: { title: 'kept' }, published: true }])
  const r = await w.store.addMissing([
    { id: 1780342703393, title: 'newer copy' },          // exists → untouched
    { id: 1789628639726, title: 'memory-only', published: true },
    { id: 1789628639726, title: 'duplicate in the list' },
    { id: 'intake-x', title: 'not storable' },
    { id: 1790232349039, title: 'hidden', published: false, createdAt: '2026-09-20T10:00:00.000Z' },
  ])
  assert.deepEqual(r.added, [1789628639726, 1790232349039]); assert.equal(r.skipped, 3)
  assert.equal(w.table.get(1780342703393).data.title, 'kept')
  const ins = w.calls.find(c => c.method === 'POST')
  assert.match(ins.headers.Prefer, /ignore-duplicates/)
  assert.equal(ins.body.length, 2)
  assert.equal(ins.body[0].created_at, new Date(1789628639726).toISOString())
  assert.equal(ins.body[1].created_at, '2026-09-20T10:00:00.000Z'); assert.equal(ins.body[1].published, false)
  assert.deepEqual(await w.store.addMissing([{ id: 1789628639726 }]), { added: [], skipped: 1 })
})

test('without Supabase the store is inert', async () => {
  const s = createStore({})
  assert.equal(s.ok, false)
  assert.equal(await s.list(), null)
  assert.deepEqual(await s.addMissing([{ id: 1 }]), { added: [], skipped: 0 })
  await assert.rejects(() => s.upsert({ id: 1 }), /not configured/)
})
