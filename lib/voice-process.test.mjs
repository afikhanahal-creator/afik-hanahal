import test from 'node:test'
import assert from 'node:assert/strict'
import { processVoice, shapeResult, composeSections, cleanDue, israelNow } from './voice-process.js'

const NOW = Date.parse('2026-11-02T13:40:00Z')   // Monday 15:40 in Israel

test('israel now and due dates', () => {
  assert.deepEqual(israelNow(NOW), { text: 'Monday 2026-11-02 15:40', date: '2026-11-02' })
  assert.equal(cleanDue('2026-11-03T09:00', '2026-11-02'), '2026-11-03T09:00')
  assert.equal(cleanDue('2026-11-08', '2026-11-02'), '2026-11-08')
  assert.equal(cleanDue('2026-10-01', '2026-11-02'), '')          // in the past
  assert.equal(cleanDue('מחר', '2026-11-02'), '')
  assert.equal(cleanDue('2026-13-01', ''), '')
})

test('call sections in a fixed order, only those with content', () => {
  const t = composeSections([{ title: 'פעולות המשך', items: ['לשלוח תוכניות'] }, { title: 'נושא השיחה', items: ['דירה בזרובבל 15'] }, { title: 'החלטות', items: [] }])
  assert.equal(t, 'נושא השיחה:\n• דירה בזרובבל 15\n\nפעולות המשך:\n• לשלוח תוכניות')
})

test('shaping: tasks cleaned, invented text refused, task mode is one line', () => {
  const raw = 'דיברנו עם רונן הוא רוצה ארבעה חדרים תתקשר אליו מחר בבוקר'
  const r = shapeResult(raw, { text: 'דיברנו עם רונן. הוא רוצה 4 חדרים.\n\n\nלהתקשר אליו מחר בבוקר.', summary: 'x', sections: [], review: ['רונן'],
    tasks: [{ title: 'להתקשר לרונן.', description: '', due: '2026-11-03T09:00', dueSaid: 'מחר בבוקר', owner: '', uncertain: false }, { title: '', due: '' }, { title: 'לבדוק', due: 'אתמול' }] }, 'exact', { today: '2026-11-02' })
  assert.equal(r.text, 'דיברנו עם רונן. הוא רוצה 4 חדרים.\n\nלהתקשר אליו מחר בבוקר.')
  assert.equal(r.summary, '')                     // short: no summary
  assert.deepEqual(r.tasks.map(t => [t.title, t.due]), [['להתקשר לרונן', '2026-11-03T09:00'], ['לבדוק', '']])
  assert.deepEqual(r.review, ['רונן'])
  assert.equal(shapeResult('קצר', { text: Array(40).fill('מילה').join(' '), tasks: [] }, 'smart', {}), null)
  const tk = shapeResult('להתקשר לרונן מחר', { text: 'להתקשר לרונן מחר.\n', tasks: [{ title: 'x' }] }, 'task', {})
  assert.deepEqual([tk.text, tk.tasks], ['להתקשר לרונן מחר', []])
  assert.equal(shapeResult('a', null, 'exact', {}), null)
})

test('processVoice sends mode, context, now and transcript', async () => {
  let got
  const ask = async a => { got = a; return { data: { text: '', summary: '', review: [], tasks: [], sections: [{ title: 'נושא השיחה', items: ['זרובבל 15'] }] } } }
  const r = await processVoice({ transcript: ' דיברנו על זרובבל חמש עשרה ', mode: 'call', contextType: 'call', hint: 'רונן כהן', now: NOW }, { ask })
  assert.equal(r.text, 'נושא השיחה:\n• זרובבל 15')
  assert.match(got.user, /mode: call/); assert.match(got.user, /now \(Israel\): Monday 2026-11-02 15:40/); assert.match(got.user, /רונן כהן/); assert.match(got.user, /זרובבל חמש עשרה/)
  assert.equal((await processVoice({ transcript: ' ' }, { ask })).code, 'empty')
  assert.equal((await processVoice({ transcript: 'שלום' }, { ask: async () => ({ error: 'no key', code: 'no_key' }) })).code, 'no_key')
  const bad = await processVoice({ transcript: 'שלום', mode: 'weird' }, { ask: async a => { got = a; return { data: { text: 'שלום.', summary: '', sections: [], tasks: [], review: [] } } } })
  assert.equal(bad.mode, 'exact')
})
