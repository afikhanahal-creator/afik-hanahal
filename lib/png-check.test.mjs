import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pngInfo, pngIntact, crc32 } from './png-check.js'
// the smallest valid PNG (1 × 1, transparent)
const ok = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
test('crc32 matches the PNG spec', () => { assert.equal(crc32(Buffer.from('IEND')), 0xAE426082) })
test('a whole PNG passes, with its size', () => { const i = pngInfo(ok); assert.deepEqual(i, { ok: true, width: 1, height: 1 }); assert.ok(pngIntact(ok)) })
test('a cut-off, a garbled and a non-PNG file fail', () => {
  assert.equal(pngIntact(ok.subarray(0, ok.length - 10)), false)
  const bad = Buffer.from(ok); bad[40] ^= 0xFF; assert.equal(pngIntact(bad), false)
  assert.equal(pngIntact(Buffer.from('hello world, not a png at all!!')), false)
  assert.equal(pngIntact(Buffer.alloc(0)), false)
})
