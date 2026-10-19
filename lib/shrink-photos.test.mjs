import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldShrink, shrinkSourceUrl, worthReplacing, shrinkStoragePhotos } from './shrink-photos.js'

test('only large photos that were not tried before', () => {
  assert.equal(shouldShrink({ path: 'property-images/a.png', size: 5.5e6 }), true)
  assert.equal(shouldShrink({ path: 'property-images/a.jpg', size: 200e3 }), false)
  assert.equal(shouldShrink({ path: 'property-videos/a.mp4', size: 40e6 }), false)
  assert.equal(shouldShrink({ path: 'property-images/a.jpg', size: 2e6 }, new Set(['property-images/a.jpg'])), false)
  assert.equal(worthReplacing(1e6, 300e3), true)
  assert.equal(worthReplacing(500e3, 450e3), false)
  assert.match(shrinkSourceUrl('https://x.supabase.co/storage/v1/object/public/b/a.png'), /^https:\/\/wsrv\.nl\/\?url=https%3A%2F%2Fx\.supabase\.co.*&w=1600&.*output=jpg/)
})

function fakeSupabase({ status = 200 } = {}) {
  const calls = []
  const files = { 'property-images': [{ name: 'big.png', id: '1', metadata: { size: 5_500_000 } }, { name: 'small.jpg', id: '2', metadata: { size: 100_000 } }, { name: 'inline', id: null }],
    'property-images/inline': [{ name: 'x.jpg', id: '3', metadata: { size: 900_000 } }], 'property-media': [] }
  const fetchImpl = async (url, opts = {}) => {
    calls.push([opts.method || 'GET', url])
    if (status !== 200) return new Response('{}', { status })
    if (url.includes('/rest/v1/app_settings') && (opts.method || 'GET') === 'GET') return Response.json([{ value: { done: [] } }])
    if (url.includes('/rest/v1/app_settings')) return new Response('', { status: 201 })
    const m = /object\/list\/([\w-]+)/.exec(url)
    if (m) { const { prefix } = JSON.parse(opts.body); return Response.json(files[prefix ? `${m[1]}/${prefix}` : m[1]] || []) }
    if (url.startsWith('https://wsrv.nl/')) return new Response(new Uint8Array(url.includes('x.jpg') ? 800_000 : 300_000))
    if (opts.method === 'PUT') return new Response('{}', { status: 200 })
    return new Response('?', { status: 404 })
  }
  return { calls, fetchImpl }
}

test('shrinks the big ones in place, remembers the ones that did not get smaller', async () => {
  const f = fakeSupabase()
  const r = await shrinkStoragePhotos({ supaUrl: 'https://x.supabase.co', supaKey: 'k', fetchImpl: f.fetchImpl })
  assert.equal(r.checked, 3)
  assert.equal(r.shrunk, 1)          // big.png 5.5 MB → 300 KB
  assert.equal(r.skipped, 1)         // inline/x.jpg 900 KB → 800 KB: not worth it, remembered
  const put = f.calls.find(c => c[0] === 'PUT')
  assert.equal(put[1], 'https://x.supabase.co/storage/v1/object/property-images/big.png')
  assert.ok(f.calls.some(c => c[0] === 'POST' && c[1].includes('app_settings?on_conflict=key')))
})

test('a blocked project (402) stops at once', async () => {
  const f = fakeSupabase({ status: 402 })
  const r = await shrinkStoragePhotos({ supaUrl: 'https://x.supabase.co', supaKey: 'k', fetchImpl: f.fetchImpl })
  assert.match(r.error, /402/)
  assert.equal(f.calls.length, 1)
})
