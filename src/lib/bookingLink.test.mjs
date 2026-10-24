import test from 'node:test'
import assert from 'node:assert/strict'
import { bookingLink, insertBooking, textLang } from './bookingLink.js'

test('the booking link carries ref=wa and the language', () => {
  assert.equal(bookingLink('he'), 'https://www.afikhanahal.co.il/book?ref=wa')
  assert.equal(bookingLink('en'), 'https://www.afikhanahal.co.il/book?ref=wa&lang=en')
  assert.equal(bookingLink('he', 'https://x.co/book?lang=en'), 'https://x.co/book?ref=wa')
})

test('an empty box gets the whole line; a sentence gets the link on its own line', () => {
  const a = insertBooking('')
  assert.match(a.text, /^אפשר לבחור כאן שעה נוחה לשיחה קצרה: https:\/\/www\.afikhanahal\.co\.il\/book\?ref=wa$/)
  assert.equal(a.cursor, a.text.length)
  const b = insertBooking('היי רונן, ראינו שהשארתם פרטים. ')
  assert.equal(b.text.split('\n').length, 2)
  assert.ok(b.text.startsWith('היי רונן, ראינו שהשארתם פרטים.\n'))
  const c = insertBooking('Hi Ronen, thanks!', 17, 17, 'he')
  assert.match(c.text, /\nPick a time .*lang=en$/)
})

test('the link goes where the cursor is and is not added twice', () => {
  const r = insertBooking('שורה ראשונה\nשורה שנייה', 11, 11)
  assert.deepEqual(r.text.split('\n').map(x => x.slice(0, 4)), ['שורה', 'אפשר', 'שורה'])
  const twice = insertBooking(r.text)
  assert.equal(twice.text, r.text)
  assert.equal(textLang('123'), 'he')
})
