import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLeadEmailHtml, messageParts, sourceText } from './lead-email.js'

const MSG = 'I own land · City / area: Hof HaSharon · Property type: Plot · Size (sqm / dunam): 1390 sqm · Anything we should know?: I live in Canada. We want to sell it.'

test('a form message becomes one line per answer', () => {
  const p = messageParts(MSG)
  assert.equal(p.length, 5)
  assert.deepEqual(p[0], { a: 'I own land' })
  assert.deepEqual(p[1], { q: 'City / area', a: 'Hof HaSharon' })
  assert.deepEqual(p[4], { q: 'Anything we should know?', a: 'I live in Canada. We want to sell it.' })
  assert.deepEqual(messageParts('שלום, מחפשים דירה'), [{ a: 'שלום, מחפשים דירה' }])
  assert.deepEqual(messageParts(''), [])
})

test('the email escapes what the visitor typed and reads English left-to-right', () => {
  const html = buildLeadEmailHtml({ name: 'Molly <b>', phone: '0501234567', email: 'm@x.com', message: MSG, propTitle: 'Land', source: 'page_service_land', ts: '19.10.2026, 23:33' })
  assert.ok(!html.includes('<b>') && html.includes('Molly &lt;b&gt;'))
  assert.ok(html.includes('dir="auto"'))
  assert.ok(html.includes('https://wa.me/972501234567'))
  assert.ok(html.includes('>Hof HaSharon<'))
  assert.equal(sourceText('page_service_land'), 'עמוד באתר · service · land')
  assert.ok(!buildLeadEmailHtml({ name: 'x' }).includes('ההודעה'))   // no message, no empty block
})
