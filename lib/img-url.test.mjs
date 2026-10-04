import test from 'node:test'
import assert from 'node:assert/strict'
import { photoUrl, supabaseSource, cdnImg } from './img-url.js'

const SUPA = 'https://abc.supabase.co/storage/v1/object/public/property-images/1/a.jpg'

test('Supabase photos go through the image CDN, straight from Supabase', () => {
  const u = photoUrl(`${SUPA}?t=1`, 600)
  assert.equal(u, `https://wsrv.nl/?url=${encodeURIComponent(SUPA)}&w=600&q=72&output=webp&we`)
  assert.ok(!u.includes('/media/'))
  assert.equal(photoUrl(SUPA, 1200, ''), SUPA, 'no CDN configured → the original')
})

test('other sources keep their own handling', () => {
  assert.equal(photoUrl('https://abc.supabase.co/storage/v1/object/sign/x/a.jpg?token=1'), 'https://abc.supabase.co/storage/v1/object/sign/x/a.jpg?token=1', 'signed URLs untouched')
  assert.equal(photoUrl('https://res.cloudinary.com/x/image/upload/v1/a.jpg', 600), 'https://res.cloudinary.com/x/image/upload/w_600,q_auto:good,f_auto/v1/a.jpg')
  assert.equal(photoUrl('data:image/png;base64,xx'), 'data:image/png;base64,xx')
  assert.equal(photoUrl('/img/x.webp'), '/img/x.webp')
  assert.equal(photoUrl(''), '')
})

test('supabaseSource undoes an old /media link when the origin is known', () => {
  assert.equal(supabaseSource(`${SUPA}?x=1`), SUPA)
  assert.equal(supabaseSource('/media/property-images/1/a.jpg', 'https://abc.supabase.co/'), SUPA)
  assert.equal(supabaseSource('https://www.afikhanahal.co.il/media/property-images/1/a.jpg', 'https://abc.supabase.co'), SUPA)
  assert.equal(supabaseSource('/media/property-images/1/a.jpg'), '')
  assert.equal(supabaseSource('https://example.com/a.jpg'), '')
})

test('cdnImg leaves non-absolute URLs alone', () => {
  assert.equal(cdnImg('/img/a.png', 600), '/img/a.png')
  assert.equal(cdnImg('', 600), '')
})
