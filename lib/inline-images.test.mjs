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
