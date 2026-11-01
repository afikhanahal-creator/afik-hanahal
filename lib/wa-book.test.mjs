import test from 'node:test'
import assert from 'node:assert/strict'
import { nameParts, bookNames, bookChanges, tail9 } from './wa-book.js'

test('a name → WhatsApp contact parts', () => {
  assert.deepEqual(nameParts('רונן כהן · זרובבל 15'), { firstName: 'רונן', lastName: 'כהן · זרובבל 15' })
  assert.deepEqual(nameParts('  אדי  '), { firstName: 'אדי' })
  assert.equal(nameParts(''), null)
})

test('the phone book: saved names of people only', () => {
  const m = bookNames([
    { id: '972528017218@c.us', name: 'Anila', contactName: 'אנילה ניסימוב', type: 'user' },
    { id: '972501112222@c.us', name: 'Push name only', contactName: '' },
    { id: '120363000@g.us', contactName: 'קבוצה' },
    { id: '972503334444@c.us', contactName: '+972 50-333-4444' },
  ])
  assert.deepEqual([...m.keys()], [tail9('972528017218')])
  assert.equal(m.get(tail9('972528017218')).name, 'אנילה ניסימוב')
})

test('only a name that changed on the phone renames the lead; the first look just records', () => {
  const book = bookNames([{ id: '972528017218@c.us', contactName: 'אנילה ניסימוב · זרובבל 15' }, { id: '972501234567@c.us', contactName: 'רון' }])
  const first = bookChanges(book, {})
  assert.equal(first.changes.length, 0)
  assert.equal(first.next['528017218'], 'אנילה ניסימוב · זרובבל 15')
  const again = bookChanges(book, { 528017218: 'אנילה ניסימוב', 501234567: 'רון' })
  assert.deepEqual(again.changes.map(c => [c.tail, c.was, c.name]), [['528017218', 'אנילה ניסימוב', 'אנילה ניסימוב · זרובבל 15']])
  assert.equal(again.next['528017218'], 'אנילה ניסימוב · זרובבל 15')
  assert.equal(bookChanges(book, first.next).changes.length, 0)
})

test('the phone keeping only the first name of ours is not a rename', () => {
  const book = bookNames([{ id: '972587629744@c.us', contactName: 'רחל' }])
  const r = bookChanges(book, { 587629744: 'רחל קפר · זרובבל 15' })
  assert.equal(r.changes.length, 0)
  assert.equal(r.next['587629744'], 'רחל קפר · זרובבל 15')
})
