import test from 'node:test'
import assert from 'node:assert/strict'
import { splitLink } from './waLinks.js'

test('a plain link stays whole and opens as is', () => {
  const r = splitLink('https://www.afikhanahal.co.il/p/1790765888070')
  assert.equal(r.url, 'https://www.afikhanahal.co.il/p/1790765888070'); assert.equal(r.rest, ''); assert.equal(r.href, r.url)
})
test('sentence punctuation after the link is not part of it', () => {
  assert.deepEqual(splitLink('https://x.co/p/12.'), { url: 'https://x.co/p/12', rest: '.', href: 'https://x.co/p/12' })
  assert.equal(splitLink('https://x.co/a?b=1!?').url, 'https://x.co/a?b=1')
  assert.equal(splitLink('https://x.co/a,').rest, ',')
  assert.equal(splitLink('https://x.co/a"').url, 'https://x.co/a')
})
test('a closing bracket is kept only when the link opened one', () => {
  assert.equal(splitLink('https://he.wikipedia.org/wiki/A_(B)').url, 'https://he.wikipedia.org/wiki/A_(B)')
  assert.equal(splitLink('https://x.co/a)').url, 'https://x.co/a')
  assert.equal(splitLink('https://x.co/a).').rest, ').')
})
test('www links get https', () => {
  assert.equal(splitLink('www.afikhanahal.co.il/book').href, 'https://www.afikhanahal.co.il/book')
})
test('query strings and fragments survive', () => {
  const u = 'https://www.afikhanahal.co.il/book?ref=wa&lang=en#top'
  assert.equal(splitLink(u).url, u)
})
