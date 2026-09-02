// Run: npm test — fetchAllSources must respect its overall deadline with a stubbed slow network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchAllSources, RSS_SOURCES, parseRSS, outletKey, cleanTitle } from './sources.js'

const rss = (n) => `<rss><channel>${Array.from({ length: n }, (_, i) =>
  `<item><title>מחירי הדירות עלו ${i}</title><link>https://example.co.il/a${i}</link><pubDate>${new Date().toUTCString()}</pubDate></item>`).join('')}</channel></rss>`

test('deadline returns partial results instead of hanging', async () => {
  const realFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (url, { signal } = {}) => new Promise((resolve, reject) => {
    calls++
    const fast = calls % 3 === 0                       // one in three sources answers quickly
    const t = setTimeout(() => resolve(new Response(rss(2), { status: 200 })), fast ? 20 : 60_000)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })) })
  })
  try {
    const t0 = Date.now()
    const items = await fetchAllSources({ timeoutMs: 5000, concurrency: 12, deadlineMs: 600 })
    const took = Date.now() - t0
    assert.ok(took < 2000, `took ${took}ms`)
    assert.ok(items.length > 0, 'fast sources delivered')
    assert.ok(items.stats.ok > 0 && (items.stats.failed + items.stats.skipped) > 0, JSON.stringify(items.stats))
  } finally { globalThis.fetch = realFetch }
})

test('all sources parse and are addressable', () => {
  assert.ok(RSS_SOURCES.length > 40)
  for (const s of RSS_SOURCES) { new URL(s.url); assert.ok(s.name) }
  const items = parseRSS(rss(3), 'X')
  assert.equal(items.length, 3)
  assert.equal(outletKey('https://www.ynet.co.il/x', ''), 'ynet')
  assert.equal(outletKey('https://news.google.com/rss/articles/abc', 'Globes'), 'globes')
  assert.equal(cleanTitle('כותרת - ynet', true), 'כותרת')
})
