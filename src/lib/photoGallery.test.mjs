import { test } from 'node:test'
import assert from 'node:assert/strict'
import { propertyMatches, galleryProperties, photoFileName, picksToFiles, picksLinks, togglePick, pushRecent } from './photoGallery.js'

const U = n => `https://x.supabase.co/storage/v1/object/public/property-images/${n}.jpg`
const LIST = [
  { id: 1, title: 'מגרש בחנקין 41', location: 'רעננה', images: [U('a'), U('b')], sortOrder: 2 },
  { id: 2, title: 'דירת 4 חדרים בזרובבל 15', location: 'רעננה', images: [U('c'), 'data:image/png;base64,xx', U('c')], sortOrder: 5 },
  { id: 3, title: 'נכס מוסתר', images: [U('d')], published: false, sortOrder: 0 },
  { id: 4, title: 'בלי תמונות', images: [] },
  { id: 5, title: 'נמכר', images: [U('e')], status: 'נמכר', sortOrder: 1 },
]

test('propertyMatches: the lead\'s project in the listing\'s title or street', () => {
  assert.equal(propertyMatches(LIST[1], 'זרובבל 15'), true)
  assert.equal(propertyMatches(LIST[1], 'חנקין 41'), false)
  assert.equal(propertyMatches({ title: 'בית', street: 'רמח"ל 6' }, 'רמחל 6-8 רעננה'), true)
  assert.equal(propertyMatches(LIST[0], ''), false)
})

test('galleryProperties: only properties with photos, https only, the lead\'s first, then live, sold last', () => {
  const g = galleryProperties(LIST, { project: 'זרובבל 15' })
  assert.deepEqual(g.map(p => p.id), ['2', '1', '5', '3'])
  assert.deepEqual(g[0].images, [U('c')])                       // no inline photo, no repeat
  assert.equal(g[0].match, true)
  assert.equal(g.find(p => p.id === '3').live, false)
  assert.deepEqual(galleryProperties(LIST, { query: 'רעננה' }).map(p => p.id).sort(), ['1', '2'])
})

test('photoFileName / picksToFiles / picksLinks / togglePick / pushRecent', () => {
  assert.equal(photoFileName(U('a'), 'מגרש בחנקין 41', 2), 'מגרש בחנקין 41-2.jpg')
  assert.equal(photoFileName('https://x/y.PNG?v=1', 'a/b', 1), 'a b-1.png')
  const picks = [{ url: U('a'), propId: '1', title: 'חנקין', n: 1 }, { url: U('c'), propId: '2', title: 'זרובבל', n: 1 }, { url: U('b'), propId: '1', title: 'חנקין', n: 2 }]
  assert.equal(picksToFiles(picks, 2).length, 2)
  assert.deepEqual(picksToFiles(picks)[0], { url: U('a'), name: 'חנקין-1.jpg', type: 'image/jpeg', size: 0 })
  assert.equal(picksLinks(picks), 'חנקין: https://www.afikhanahal.co.il/p/1\nזרובבל: https://www.afikhanahal.co.il/p/2')
  assert.equal(togglePick(picks, picks[0]).length, 2)
  assert.equal(togglePick(picks, { url: U('z') }, 3).length, 3)      // full
  assert.equal(togglePick(picks, { url: U('z') }, 30).length, 4)
  const r = pushRecent([{ url: U('b') }, { url: U('q') }, { url: 'data:x' }], [{ url: U('b') }, { url: U('a') }], 3)
  assert.deepEqual(r.map(x => x.url), [U('b'), U('a'), U('q')])
})
