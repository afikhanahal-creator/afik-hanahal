import test from 'node:test'
import assert from 'node:assert/strict'
import { externalizeInlinePhotos } from '../src/inlinePhotos.js'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
function fakeUploads({ failPut = false } = {}) {
  const real = globalThis.fetch, calls = { sign: 0, put: 0 }
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url).startsWith('data:')) return real(url)
    if (String(url).includes('wizard-upload-url')) { calls.sign++; return { ok: true, json: async () => ({ signedUrl: `https://s/put/${calls.sign}`, url: `https://s/public/${calls.sign}.png` }) } }
    if (String(url).startsWith('https://s/put/')) { calls.put++; return { ok: !failPut } }
    throw new Error('unexpected ' + url)
  }
  return { calls, restore: () => { globalThis.fetch = real } }
}

test('inline photos are uploaded and replaced before a save; the same photo once', async () => {
  const f = fakeUploads()
  try {
    const out = await externalizeInlinePhotos({ id: 1, images: ['https://x/1.jpg', PNG, PNG], logo: PNG, title: 't' }, 'tok')
    assert.deepEqual(out.images, ['https://x/1.jpg', 'https://s/public/1.png', 'https://s/public/1.png'])
    assert.equal(out.logo, 'https://s/public/1.png'); assert.equal(out.title, 't')
    assert.equal(f.calls.sign, 1, 'one upload for a photo used three times')
  } finally { f.restore() }
})

test('a property without inline photos is returned as is; a failed upload keeps the photo', async () => {
  const p = { id: 2, images: ['https://x/2.jpg'] }
  assert.equal(await externalizeInlinePhotos(p, 'tok'), p)
  const f = fakeUploads({ failPut: true })
  try { assert.equal((await externalizeInlinePhotos({ id: 3, images: [PNG] }, 'tok')).images[0], PNG, 'the server moves it later') } finally { f.restore() }
})
