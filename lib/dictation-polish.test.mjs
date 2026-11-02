import test from 'node:test'
import assert from 'node:assert/strict'
import { polishDictation, acceptPolish } from './dictation-polish.js'

test('passes the kind and text, returns the cleaned answer', async () => {
  let got
  const ask = async a => { got = a; return { data: { text: 'דיברנו עם רונן. מחפש 4 חדרים בכפר סבא.\n\n\n', summary: 'מחפש 4 חדרים' } } }
  const r = await polishDictation({ text: '  דיברנו עם רונן מחפש ארבעה חדרים בכפר סבא ', kind: 'note' }, { ask })
  assert.deepEqual(r, { text: 'דיברנו עם רונן. מחפש 4 חדרים בכפר סבא.', summary: '' })   // short: no summary
  assert.match(got.user, /kind: note/)
  assert.match(got.user, /ארבעה חדרים/)
  assert.equal(got.effort, 'low')
})

test('task kind, empty input, errors and runaway answers', async () => {
  let got
  await polishDictation({ text: 'להתקשר לרונן', kind: 'task' }, { ask: async a => { got = a; return { data: { text: 'להתקשר לרונן', summary: '' } } } })
  assert.match(got.user, /kind: task/)
  assert.equal((await polishDictation({ text: '   ' }, { ask: async () => ({}) })).code, 'empty')
  assert.equal((await polishDictation({ text: 'שלום' }, { ask: async () => ({ error: 'ANTHROPIC_API_KEY is not set', code: 'no_key' }) })).code, 'no_key')
  const long = Array(40).fill('מילה').join(' ')
  assert.equal(acceptPolish('קצר מאוד', { text: long }), null)                  // invented paragraphs
  assert.equal(acceptPolish('משהו', { text: '' }), null)
  const said = Array(50).fill('דיברנו').join(' ')
  assert.deepEqual(acceptPolish(said, { text: said, summary: 'בקצרה\nשורה' }), { text: said, summary: 'בקצרה שורה' })
})
