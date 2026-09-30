import test from 'node:test'
import assert from 'node:assert/strict'
import { createFeed, findPublished, SNAPSHOT_KEY } from './property-feed.js'

const later = (ms, v) => new Promise(r => setTimeout(() => r(v), ms))
const res = (body, ok = true, status = ok ? 200 : 500) => ({ ok, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), json: async () => (typeof body === 'string' ? JSON.parse(body) : body) })

const LIVE = [{ id: 1, title: 'live', published: true }, { id: 2, title: 'hidden', published: false }, { id: 3, title: 'new' }]
const SNAP = [{ id: 1, title: 'snap' }]

// A fake Render + Supabase. renderMs = how slow Render is (Infinity = never answers in time).
// table: the properties table's rows (null = the table is unreachable, as before the table became a source)
function world({ renderMs = 0, renderOk = true, snapshot = SNAP, suspended = false, renderEtag = null, snapshotEtag = null, tables = ['app_settings', 'site_config'], table: rows = null } = {}) {
  const calls = { render: 0, snapRead: 0, hashRead: 0, write: 0, written: null, conditional: 0, notModified: 0, tablesUsed: new Set(), tableReads: 0, tableInserts: 0 }
  const fetchImpl = async (url, opts = {}) => {
    if (url.includes('/rest/v1/properties?')) {
      if (rows === null) return res({ code: 'PGRST205', message: "Could not find the table 'public.properties'" }, false, 404)
      if (opts.method === 'POST') { calls.tableInserts++; const b = JSON.parse(opts.body); for (const r of Array.isArray(b) ? b : [b]) { if (!rows.some(p => p.id === r.id)) rows.push({ ...r.data, id: r.id, published: r.published }) } return res('', true, 201) }
      calls.tableReads++
      if (/select=id$/.test(url)) return res(rows.map(p => ({ id: p.id })))
      return res(rows.filter(p => !url.includes('published=eq.true') || p.published !== false).map(p => ({ id: p.id, data: p, published: p.published !== false, created_at: '2026-01-01T00:00:00Z' })))
    }
    if (url.startsWith('https://site.test/properties.json')) { calls.static = (calls.static || 0) + 1; return res([{ id: 1, title: 'static' }, { id: 9, title: 'static-only' }]) }
    if (url.startsWith('https://render.test')) {
      calls.render++
      if (renderMs === Infinity) return new Promise(() => {})
      if (suspended) return { ...res('<html>Service Suspended</html>', false, 503), headers: new Headers({ 'x-render-routing': 'suspend-by-user' }) }
      const inm = opts.headers && opts.headers['If-None-Match']
      if (inm) calls.conditional++
      if (renderEtag && inm === renderEtag) { calls.notModified++; return later(renderMs, { ok: false, status: 304, headers: new Headers({ etag: renderEtag }), text: async () => '' }) }
      const r = renderOk ? res(LIVE) : res({ error: 'x' }, false, 502)
      return later(renderMs, renderEtag ? { ...r, headers: new Headers({ etag: renderEtag }) } : r)
    }
    const table = (url.match(/rest\/v1\/(\w+)\?/) || [])[1]
    if (table && !tables.includes(table)) return res({ code: 'PGRST205', message: `Could not find the table 'public.${table}'` }, false, 404)
    if (table) calls.tablesUsed.add(table)
    const stored = calls.written ? calls.written.value : snapshot ? { at: '2026-09-01T00:00:00Z', list: snapshot, hash: 'old', etag: snapshotEtag } : null
    if (url.includes('key=eq.render_traffic')) return res(calls.traffic ? [{ value: calls.traffic }] : [])
    if (opts.method === 'POST' && opts.body.includes('"key":"render_traffic"')) { calls.traffic = JSON.parse(opts.body).value; return res('', true, 201) }
    if (url.includes('select=hash:')) { calls.hashRead++; return res(stored ? [{ hash: stored.hash, etag: stored.etag || null }] : []) }
    if (url.includes(`key=eq.${SNAPSHOT_KEY}&select=value`)) { calls.snapRead++; return res(stored ? [{ value: stored }] : []) }
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

test('getOne fast: the deploy-time list answers before a sleeping Render', async () => {
  const { feed } = world({ renderMs: Infinity, snapshot: null })
  const t0 = Date.now()
  const r = await feed.getOne(9, { staticUrl: 'https://site.test/properties.json', fast: true })
  assert.equal(r.source, 'static'); assert.equal(r.property.title, 'static-only')
  assert.ok(Date.now() - t0 < 100, `took ${Date.now() - t0} ms`)
})

test('pushSnapshot: the admin copy is stored only while Render cannot answer for itself', async () => {
  const down = world({ suspended: true, snapshot: null })
  const r = await down.feed.pushSnapshot([{ id: 7, title: 'from admin' }, { id: 8, title: 'draft', published: false }, null])
  assert.equal(r.source, 'admin'); assert.equal(r.saved, true); assert.equal(r.count, 1, 'drafts and junk are dropped')
  assert.deepEqual(down.calls.written.value.list, [{ id: 7, title: 'from admin' }])
  assert.match(r.render, /suspend-by-user/)
  assert.equal((await down.feed.getList()).list[0].title, 'from admin', 'the site now serves it')

  const up = world({ renderMs: 10 })
  const u = await up.feed.pushSnapshot([{ id: 7, title: 'stale admin copy' }])
  assert.equal(u.source, 'render'); assert.deepEqual(up.calls.written.value.list, LIVE, "Render's own list wins while it is up")

  assert.equal((await world().feed.pushSnapshot([])).reason, 'empty')
  const noStore = createFeed({ renderUrl: 'https://render.test', fetchImpl: async () => res({}, false, 503) })
  assert.match((await noStore.pushSnapshot([{ id: 1 }])).reason, /SUPABASE/)
})

test('health: says what the site is serving and why', async () => {
  const ok = await world({ renderMs: 10 }).feed.health()
  assert.equal(ok.serving, 'render'); assert.equal(ok.render.ok, true); assert.equal(ok.render.count, 3); assert.equal(ok.snapshot.count, 1)

  const suspended = await world({ suspended: true }).feed.health()
  assert.equal(suspended.serving, 'snapshot'); assert.equal(suspended.render.status, 503); assert.equal(suspended.render.routing, 'suspend-by-user')

  const nothing = await world({ suspended: true, snapshot: null }).feed.health()
  assert.equal(nothing.serving, 'none'); assert.equal(nothing.snapshot, null)

  const asleep = await createFeed({ renderUrl: 'https://render.test', fetchImpl: () => new Promise(() => {}) }).health({ budgetMs: 50 })
  assert.equal(asleep.render.routing, 'timeout'); assert.equal(asleep.supabase, false)
})

test('bandwidth: an unchanged list is a conditional request answered 304 — no body from Render', async () => {
  const { feed, calls } = world({ renderMs: 10, renderEtag: '"e1"' })
  const a = await feed.getList()
  assert.equal(a.source, 'render'); assert.equal(calls.conditional, 0, 'the old snapshot has no etag yet → plain request')
  assert.equal(calls.written.value.etag, '"e1"', "Render's ETag is kept with the snapshot")
  const b = await feed.getList()
  assert.equal(calls.conditional, 1); assert.equal(calls.notModified, 1)
  assert.equal(b.source, 'render'); assert.equal(b.notModified, true); assert.equal(b.list.length, 3, 'the snapshot list is served as live')
  assert.equal(calls.write, 1, 'nothing rewritten')
  // a cold instance reads the etag from the store first
  const cold = world({ renderMs: 10, renderEtag: '"e1"', snapshotEtag: '"e1"' })
  const c = await cold.feed.getList()
  assert.equal(cold.calls.conditional, 1); assert.equal(c.notModified, true); assert.equal(c.list[0].title, 'snap')
})

test('snapshot store: falls back to site_config when app_settings does not exist', async () => {
  const w = world({ renderMs: 10, snapshot: null, tables: ['site_config'] })
  const r = await w.feed.getList()
  assert.equal(r.source, 'render'); assert.equal(w.calls.write, 1); assert.ok(w.calls.tablesUsed.has('site_config'))
  const h = await w.feed.health()
  assert.equal(h.store.table, 'site_config'); assert.equal(h.store.error, null); assert.equal(h.snapshot.count, 3)
  const none = world({ suspended: true, snapshot: null, tables: [] })
  const hn = await none.feed.health()
  assert.equal(hn.snapshot, null); assert.match(hn.store.error, /404/)
})

test('bandwidth meter: counts what Render sent this month, and health reports the list weight', async () => {
  const { feed, calls } = world({ renderMs: 10, renderEtag: '"e1"' })
  await feed.getList()            // full body
  await feed.getList()            // 304
  await feed.getList()            // 304
  const h = await feed.health()
  const m = new Date().toISOString().slice(0, 7)
  assert.equal(h.traffic.month, m)
  assert.equal(h.traffic.requests, 4, '3 list requests + the health check itself')
  assert.equal(h.traffic.notModified, 3)
  assert.ok(h.traffic.bytes > JSON.stringify(LIVE).length && h.traffic.bytes < JSON.stringify(LIVE).length + 4 * 400, `bytes ${h.traffic.bytes}`)
  assert.equal(h.list.inlineImages, 0); assert.ok(h.list.bytes > 50)
  const inl = world({ suspended: true, snapshot: [{ id: 1, images: ['data:image/jpeg;base64,xxxx', 'https://x/1.jpg'], logo: 'data:image/png;base64,y' }] })
  assert.equal((await inl.feed.health()).list.inlineImages, 2)
})

test('transformList: lists are stored cleaned, visitors get the cleaned list, an old snapshot can be cleaned', async () => {
  const clean = async list => list.map(p => ({ ...p, title: `${p.title}*` }))
  const calls = { written: null }
  const fetchImpl = async (url, opts = {}) => {
    if (url.startsWith('https://render.test')) return res(LIVE)
    if (url.includes('key=eq.render_traffic')) return res([])
    if (opts.method === 'POST') { const b = JSON.parse(opts.body); if (b.key === SNAPSHOT_KEY) calls.written = b; return res('', true, 201) }
    if (url.includes('select=hash:')) return res(calls.written ? [{ hash: calls.written.value.hash }] : [{ hash: 'old' }])
    if (url.includes(`key=eq.${SNAPSHOT_KEY}&select=value`)) return res([{ value: calls.written ? calls.written.value : { at: 'x', list: SNAP, hash: 'old' } }])
    throw new Error('unexpected ' + url)
  }
  const f = createFeed({ renderUrl: 'https://render.test', supaUrl: 'https://supa.test', supaKey: 'k', fetchImpl, renderBudgetMs: 200, transformList: clean })
  const r = await f.getList()
  assert.equal(r.source, 'render'); assert.equal(r.list[0].title, 'live*', 'the visitor gets the cleaned list')
  assert.equal(calls.written.value.list[0].title, 'live*', 'the store holds the cleaned list')
  // an old snapshot written before the transform existed
  calls.written = null
  const g = createFeed({ renderUrl: 'https://render.test', supaUrl: 'https://supa.test', supaKey: 'k', fetchImpl, transformList: clean })
  const c = await g.cleanSnapshot()
  assert.equal(c.changed, true); assert.equal(calls.written.value.list[0].title, 'snap*'); assert.equal(calls.written.value.hash, 'old', 'hash kept, so Render is not re-downloaded')
})

// ── the properties table as the source of truth ─────────────────────────────────────────────────────
test('the properties table answers → the site list comes from it, hidden rows out, Render never asked', async () => {
  const { feed, calls } = world({ table: [{ id: 1, title: 'db' }, { id: 2, title: 'hidden', published: false }], renderMs: 10 })
  const r = await feed.getList()
  assert.equal(r.source, 'table'); assert.deepEqual(r.list.map(p => p.title), ['db'])
  assert.equal(calls.render, 0, 'no Render bandwidth for a visitor')
  assert.equal(calls.write, 1, 'the snapshot follows the table'); assert.deepEqual(calls.written.value.list.map(p => p.id), [1])
  const again = await feed.getList()
  assert.equal(again.source, 'table'); assert.equal(calls.tableReads, 1, 'a warm instance reuses the list briefly')
  assert.equal(calls.write, 1)
})

test('an empty or unreachable table → Render / snapshot as before', async () => {
  const a = world({ table: [], renderMs: 10 })
  assert.equal((await a.feed.getList()).source, 'render')
  const b = world({ table: null, renderMs: Infinity })
  assert.equal((await b.feed.getList()).source, 'snapshot')
})

test('getAll: every row of the table, hidden ones included (the admin list while Render is down)', async () => {
  const { feed } = world({ table: [{ id: 1, title: 'db' }, { id: 2, title: 'hidden', published: false }] })
  assert.deepEqual((await feed.getAll()).map(p => p.id), [1, 2])
  assert.equal(await world({ table: [] }).feed.getAll(), null)
})

test('reconcile copies what Render has and the table lacks — never overwrites', async () => {
  const table = [{ id: 1, title: 'db-version' }]
  const { feed, calls } = world({ table, renderMs: 10 })
  const r = await feed.reconcile()
  assert.equal(r.render, 3); assert.deepEqual(r.added, [2, 3]); assert.equal(r.table, 3)
  assert.equal(calls.tableInserts, 1)
  assert.equal(table.find(p => p.id === 1).title, 'db-version')
  assert.equal(table.find(p => p.id === 2).published, false, 'hidden properties are kept hidden')
  assert.deepEqual((await feed.reconcile()).added, [], 'idempotent')
})

test('reconcile with Render down: the stored snapshot fills the table (memory-only properties survive a restart)', async () => {
  const table = []
  const { feed } = world({ table, suspended: true, snapshot: [{ id: 1789628639726, title: 'memory-only' }, { id: 1, title: 'x' }] })
  const r = await feed.reconcile()
  assert.match(r.renderError, /503/); assert.equal(r.snapshot, 2); assert.deepEqual(r.added, [1789628639726, 1])
  assert.equal((await feed.getList()).source, 'table')
})

test('reconcile: an unchanged Render list (304) is the snapshot', async () => {
  const table = []
  const { feed, calls } = world({ table, renderEtag: '"e1"', snapshotEtag: '"e1"', snapshot: [{ id: 4, title: 'snap' }] })
  const r = await feed.reconcile()
  assert.equal(calls.notModified, 1); assert.equal(r.render, 1); assert.deepEqual(r.added, [4])
})

test('health: the table is what is served, Render reported beside it', async () => {
  const { feed } = world({ table: [{ id: 1, title: 'db' }], suspended: true })
  const h = await feed.health({ budgetMs: 300 })
  assert.equal(h.serving, 'table'); assert.equal(h.table.ok, true); assert.equal(h.table.count, 1)
  assert.equal(h.render.ok, false); assert.equal(h.render.routing, 'suspend-by-user')
  const e = await world({ table: [], suspended: true }).feed.health({ budgetMs: 300 })
  assert.equal(e.serving, 'snapshot'); assert.equal(e.table.ok, false); assert.equal(e.table.error, 'empty')
})

test('a snapshot with properties the table lacks feeds the table before it is replaced', async () => {
  const table = [{ id: 1, title: 'db' }]
  const { feed, calls } = world({ table, suspended: true, snapshot: [{ id: 1, title: 'snap' }, { id: 1789628639726, title: 'memory-only' }, { id: 9, title: 'hidden', published: false }] })
  const r = await feed.getList()
  assert.equal(r.source, 'table'); assert.deepEqual(r.list.map(p => p.id), [1, 1789628639726])
  assert.equal(calls.tableInserts, 1); assert.equal(table.length, 2, 'the hidden one is not a published property to keep')
  assert.deepEqual(calls.written.value.list.map(p => p.id), [1, 1789628639726])
})

test('pushSnapshot: the admin copy fills the table first', async () => {
  const table = [{ id: 1, title: 'db' }]
  const { feed } = world({ table, suspended: true })
  const r = await feed.pushSnapshot([{ id: 1, title: 'admin' }, { id: 5, title: 'admin-only' }, { id: 6, title: 'hidden', published: false }])
  assert.deepEqual(r.added, [5]); assert.equal(r.source, 'admin')
  assert.equal(table.find(p => p.id === 1).title, 'db', 'never overwrites')
  assert.deepEqual((await feed.getList()).list.map(p => p.id), [1, 5])
})
