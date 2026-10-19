import test from 'node:test'
import assert from 'node:assert/strict'
import { inventory, fitSize, mimeFor, REPLACEABLE, placeOf } from './site-images.js'

test('the image list: where each file is used, what may be replaced', () => {
  const list = inventory(
    [{ path: '/img/ceo.webp', bytes: 36964 }, { path: '/img/unused.png', bytes: 10 }, { path: '/robots.txt', bytes: 5 }, { path: '/logo.svg', bytes: 900 }],
    [{ file: 'content/home.json', text: '"photo": "/img/ceo.webp"' }, { file: 'lib/booking.js', text: "photo: '/img/ceo.webp'" }, { file: 'src/App.jsx', text: '<img src="/logo.svg">' }],
  )
  assert.deepEqual(list.map(x => x.name), ['ceo.webp', 'logo.svg', 'unused.png'])
  assert.deepEqual(list[0].usedIn.map(p => p.he), ['עמוד הבית (תוכן)', 'עמוד קביעת שיחה'])
  assert.equal(list[0].replaceable, true)
  assert.equal(list[2].uses, 0)
  assert.ok(REPLACEABLE.test('/favicon.svg'))
  assert.ok(!REPLACEABLE.test('/img/../api/meta.js'))
  assert.ok(!REPLACEABLE.test('/index.html'))
  assert.equal(placeOf('src/AdminPanel.jsx').he, 'פאנל הניהול')
})

test('resizing keeps the ratio and never upscales by default', () => {
  assert.deepEqual(fitSize(1600, 1200, { width: 800 }), { width: 800, height: 600 })
  assert.deepEqual(fitSize(1600, 1200, { height: 300 }), { width: 400, height: 300 })
  assert.deepEqual(fitSize(1600, 1200, { width: 800, height: 300 }), { width: 400, height: 300 })
  assert.deepEqual(fitSize(400, 300, { width: 1200 }), { width: 400, height: 300 })
  assert.deepEqual(fitSize(400, 300, { width: 1200, upscale: true }), { width: 1200, height: 900 })
  assert.deepEqual(fitSize(400, 300, {}), { width: 400, height: 300 })
  assert.equal(mimeFor('JPG'), 'image/jpeg')
  assert.equal(mimeFor('exe'), '')
})
