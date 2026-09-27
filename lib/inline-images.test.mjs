import test from 'node:test'
import assert from 'node:assert/strict'
import { findInlineImages, decodeDataImage, inlinePath, replaceInline, isDataImage } from './inline-images.js'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const prop = { id: 1779870694263, title: 'x', images: ['https://a.supabase.co/storage/v1/object/public/property-images/1.jpg', PNG, 'data:image/jpeg;base64,/9j/4AAQ'], logo: PNG }

test('finds inline photos in images and logo, nothing else', () => {
  const found = findInlineImages(prop)
  assert.deepEqual(found.map(f => [f.field, f.index]), [['images', 1], ['images', 2], ['logo', undefined]])
  assert.deepEqual(findInlineImages({ images: ['https://x/1.jpg'], logo: '' }), [])
  assert.deepEqual(findInlineImages(null), [])
  assert.equal(isDataImage('data:text/plain;base64,aGk='), false)
})

test('decodes a data URI into a file with a content hash and a storage path', () => {
  const d = decodeDataImage(PNG)
  assert.equal(d.mime, 'image/png'); assert.equal(d.ext, 'png'); assert.ok(d.buf.length > 60); assert.match(d.hash, /^[0-9a-f]{40}$/)
  assert.equal(inlinePath(prop.id, d), `inline/1779870694263/${d.hash}.png`)
  assert.equal(decodeDataImage('data:image/svg+xml;base64,PHN2Zz4='), null, 'only raster photos')
  assert.equal(decodeDataImage('https://x/1.jpg'), null)
})

test('rewrites the property to URLs and leaves the rest untouched', () => {
  const urls = new Map([[PNG, 'https://a.supabase.co/storage/v1/object/public/property-images/inline/1/h.png']])
  const next = replaceInline(prop, urls)
  assert.equal(next.images[0], prop.images[0])
  assert.equal(next.images[1], urls.get(PNG))
  assert.equal(next.images[2], prop.images[2], 'a photo that did not upload stays as it was')
  assert.equal(next.logo, urls.get(PNG))
  assert.equal(next.title, 'x')
  assert.equal(prop.images[1], PNG, 'input not mutated')
})

import { slimList } from './slim-photos.js'
test('slimList: uploads each inline photo once, reuses what Storage already has, rewrites the list', async () => {
  const calls = { head: 0, post: 0 }, stored = new Set()
  const fetchImpl = async (url, opts = {}) => {
    if (opts.method === 'HEAD') { calls.head++; return { ok: stored.has(url) } }
    if (opts.method === 'POST') { calls.post++; stored.add(url.replace('/storage/v1/object/', '/storage/v1/object/public/')); return { ok: true, text: async () => '' } }
    throw new Error('unexpected ' + url)
  }
  const list = [{ id: 7, images: [PNG, 'https://x/1.jpg', PNG] }, { id: 8, images: ['https://x/2.jpg'] }]
  const a = await slimList(list, { supaUrl: 'https://s.test', supaKey: 'k', fetchImpl })
  assert.equal(a.uploaded, 1); assert.equal(a.remaining, 0)
  assert.match(a.list[0].images[0], /^https:\/\/s\.test\/storage\/v1\/object\/public\/property-images\/inline\/7\/[0-9a-f]{40}\.png$/)
  assert.equal(a.list[0].images[0], a.list[0].images[2]); assert.equal(a.list[1], list[1], 'untouched property kept as is')
  const b = await slimList(list, { supaUrl: 'https://s.test', supaKey: 'k', fetchImpl })
  assert.equal(b.uploaded, 0, 'known to this instance → nothing uploaded again'); assert.equal(calls.post, 1)
  assert.deepEqual((await slimList(list, {})).list, list, 'without a store the list is returned unchanged')
})
