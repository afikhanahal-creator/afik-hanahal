import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanFolders, applyFolderOps, newFolderId, propertyFolderId, galleryStoragePaths, FOLDER_ID, MAX_FOLDER_PHOTOS } from './gallery-folders.js'

const NOW = '2026-11-11T08:00:00.000Z'
const U = n => `https://x.supabase.co/storage/v1/object/public/property-media/gallery/2026-11/${n}.jpg`

test('ids: a new folder id and a property\'s folder id are valid', () => {
  assert.match(newFolderId(1762848000000, 0.5), FOLDER_ID)
  assert.notEqual(newFolderId(1, 0.1), newFolderId(1, 0.9))
  assert.equal(propertyFolderId(1730000000000), 'g_p1730000000000')
  assert.match(propertyFolderId(7), FOLDER_ID)
  assert.equal(propertyFolderId(''), '')
})

test('cleanFolders: valid ids once, https photos once, names cleaned', () => {
  const out = cleanFolders([
    { id: 'g_abcd', name: '  פרויקט‮  חדש ', photos: [U(1), { url: U(1) }, { url: 'http://x/y.jpg' }, { url: 'javascript:alert(1)' }, { url: U(2), name: 'חזית' }] },
    { id: 'g_abcd', name: 'כפול' }, { id: 'bad id', name: 'x' }, { id: 'g_p77', propertyId: '77', photos: [] }, null,
  ], NOW)
  assert.equal(out.length, 2)
  assert.equal(out[0].name, 'פרויקט חדש')
  assert.deepEqual(out[0].photos.map(p => p.url), [U(1), U(2)])
  assert.equal(out[0].photos[1].name, 'חזית')
  assert.equal(out[1].propertyId, '77')
  assert.deepEqual(cleanFolders('nope'), [])
})

test('applyFolderOps: create, add, rename, cover, remove, delete — each safe to repeat', () => {
  let r = applyFolderOps([], [{ op: 'create', id: 'g_new1', name: 'בן גוריון 17' }, { op: 'create', id: 'g_new1', name: 'שוב' }, { op: 'add', id: 'g_new1', photos: [{ url: U(1), name: 'a' }, { url: U(2) }, { url: U(1) }] }], NOW)
  assert.equal(r.folders.length, 1)
  assert.equal(r.folders[0].name, 'בן גוריון 17')
  assert.deepEqual(r.folders[0].photos.map(p => p.url), [U(1), U(2)])
  assert.deepEqual(r.errors, [])
  r = applyFolderOps(r.folders, [{ op: 'add', id: 'g_new1', photos: [{ url: U(2) }, { url: U(3) }] }, { op: 'rename', id: 'g_new1', name: 'בן גוריון 17, רעננה' }, { op: 'cover', id: 'g_new1', url: U(3) }], NOW)
  assert.deepEqual(r.folders[0].photos.map(p => p.url), [U(3), U(1), U(2)])
  assert.equal(r.folders[0].name, 'בן גוריון 17, רעננה')
  r = applyFolderOps(r.folders, [{ op: 'remove', id: 'g_new1', urls: [U(1)] }], NOW)
  assert.deepEqual(r.folders[0].photos.map(p => p.url), [U(3), U(2)])
  assert.deepEqual(r.removed, [U(1)])
  // a photo another folder still holds is not "removed"
  r = applyFolderOps([...r.folders, { id: 'g_other', name: 'אחר', photos: [U(2)] }], [{ op: 'delete', id: 'g_new1' }], NOW)
  assert.deepEqual(r.folders.map(f => f.id), ['g_other'])
  assert.deepEqual(r.removed, [U(3)])
})

test('applyFolderOps: a property\'s extras folder is one per property; errors read as words', () => {
  let r = applyFolderOps([], [{ op: 'create', id: 'g_p77', name: 'דירה', propertyId: '77' }, { op: 'create', id: 'g_p77b', name: 'שוב', propertyId: '77' }], NOW)
  assert.equal(r.folders.length, 1)
  r = applyFolderOps(r.folders, [{ op: 'rename', id: 'g_none', name: 'x' }, { op: 'create', id: 'g_noname', name: '  ' }, { op: 'create', id: 'bad', name: 'x' }, { op: 'explode', id: 'g_p77' }, { op: 'rename', id: 'g_p77', name: '' }], NOW)
  assert.deepEqual(r.errors, ['התיקייה לא נמצאה', 'חסר שם לתיקייה', 'מזהה תיקייה לא תקין', 'פעולה לא מוכרת'])
  assert.equal(r.folders.length, 1)
  // the photo cap
  const many = Array.from({ length: MAX_FOLDER_PHOTOS + 5 }, (_, i) => ({ url: U(`p${i}`) }))
  r = applyFolderOps(r.folders, [{ op: 'add', id: 'g_p77', photos: many.slice(0, 200) }, { op: 'add', id: 'g_p77', photos: many.slice(200) }], NOW)
  assert.equal(r.folders[0].photos.length, MAX_FOLDER_PHOTOS)
  assert.ok(r.errors[0].includes(String(MAX_FOLDER_PHOTOS)))
})

test('galleryStoragePaths: only files under gallery/ of our bucket', () => {
  assert.deepEqual(galleryStoragePaths([U(1), U(1), 'https://x.supabase.co/storage/v1/object/public/property-media/wizard/2026-11/a.jpg',
    'https://x.supabase.co/storage/v1/object/public/property-images/gallery/a.jpg', 'https://evil.com/gallery/a.jpg', 'https://x.supabase.co/storage/v1/object/public/property-media/gallery/../wizard/a.jpg']),
  ['gallery/2026-11/1.jpg'])
  assert.deepEqual(galleryStoragePaths(null), [])
})
