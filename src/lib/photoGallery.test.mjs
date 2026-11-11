import { test } from 'node:test'
import assert from 'node:assert/strict'
import { propertyMatches, galleryProperties, galleryEntries, imageFilesOnly, photoFileName, picksToFiles, picksLinks, togglePick, pushRecent } from './photoGallery.js'

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

test('galleryEntries: the office\'s folders next to the properties; a property\'s extras follow its site photos', () => {
  const G = n => `https://x.supabase.co/storage/v1/object/public/property-media/gallery/2026-11/${n}.jpg`
  const folders = [
    { id: 'g_old', name: 'פרויקט ישן', photos: [{ url: G('o1') }], updatedAt: '2026-11-01T10:00:00Z' },
    { id: 'g_new', name: 'בן גוריון 17', photos: [], updatedAt: '2026-11-10T10:00:00Z' },
    { id: 'g_p2', name: '', propertyId: '2', photos: [{ url: G('x1') }, { url: U('c') }, { url: 'http://insecure/x.jpg' }] },
    { id: 'g_p4', name: '', propertyId: '4', photos: [{ url: G('y1') }] },
    { id: 'g_p99', name: 'נכס שנמחק', propertyId: '99', photos: [{ url: G('z1') }] },
  ]
  const g = galleryEntries(LIST, folders, { project: 'זרובבל 15' })
  // folders: newest first, an empty one shows, a gone property's extras show as a folder
  assert.deepEqual(g.folders.map(f => f.id), ['g_new', 'g_old', 'g_p99'])
  assert.deepEqual(g.folders[0].images, [])
  assert.deepEqual(g.folders[1].own, [G('o1')])
  // property 2: its site photo, then the extra (no repeat of a site photo, no http); the extra is "own"
  const p2 = g.properties.find(p => p.id === '2')
  assert.deepEqual(p2.images, [U('c'), G('x1')])
  assert.deepEqual(p2.own, [G('x1')])
  assert.equal(p2.folderId, 'g_p2')
  // property 4 has no site photos but has extras → it shows; property 1 has no extras → its upload folder id is made from its id
  assert.deepEqual(g.properties.find(p => p.id === '4').images, [G('y1')])
  assert.equal(g.properties.find(p => p.id === '1').folderId, 'g_p1')
  assert.deepEqual(g.properties.find(p => p.id === '1').own, [])
  // the lead's project matches a folder by its name too; the search covers folders
  assert.equal(galleryEntries([], [{ id: 'g_z', name: 'זרובבל 15 הדמיות', photos: [] }], { project: 'זרובבל 15' }).folders[0].match, true)
  assert.deepEqual(galleryEntries(LIST, folders, { query: 'גוריון' }).folders.map(f => f.id), ['g_new'])
  assert.equal(galleryEntries(LIST, folders, { query: 'גוריון' }).properties.length, 0)
  // the old helper still answers the same
  assert.deepEqual(galleryProperties(LIST, { project: 'זרובבל 15' }).map(p => p.id), ['2', '1', '5', '3'])
})

test('imageFilesOnly: photos only (a phone\'s HEIC by its name), a size cap, a reason for the rest', () => {
  const f = (name, type, size = 1000) => ({ name, type, size })
  const r = imageFilesOnly([f('a.jpg', 'image/jpeg'), f('b.HEIC', ''), f('c.pdf', 'application/pdf'), f('d.svg', 'image/svg+xml'), f('e.png', 'image/png', 30 * 1024 * 1024), f('v.mp4', 'video/mp4')])
  assert.deepEqual(r.ok.map(x => x.name), ['a.jpg', 'b.HEIC'])
  assert.deepEqual(r.bad.map(x => x.name), ['c.pdf', 'd.svg', 'e.png', 'v.mp4'])
  assert.ok(r.bad[0].why.includes('רק תמונות') && r.bad[2].why.includes('25'))
  assert.ok(imageFilesOnly([f('c.pdf', 'application/pdf')], { lang: 'en' }).bad[0].why.includes('Only photos'))
  assert.deepEqual(imageFilesOnly(null), { ok: [], bad: [] })
})
