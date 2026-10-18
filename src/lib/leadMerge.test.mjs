import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeLeads, mergeConflicts } from './leadMerge.js'

const A = { id: 'a', name: 'דנה כהן', phone: '0501234567', email: '', ts: 2000, leadStatus: 'new', notes: [{ id: 'n1', text: 'ענתה', ts: 2100 }], tags: ['VIP'], msg: 'מחפשת 4 חדרים' }
const B = { id: 'b', name: 'Dana Cohen', phone: '0501234567', email: 'dana@x.co', ts: 1000, leadStatus: 'contacted', notes: 'הערה ישנה', tags: ['VIP', 'משקיעה'], msg: 'תקציב 3 מיליון', formName: 'זרובבל 15', formAnswers: [{ q: 'תקציב', a: '3-4 מיליון' }], stageLog: [{ from: 'new', to: 'contacted', at: 1500 }] }

test('mergeConflicts lists only fields both leads fill differently', () => {
  assert.deepEqual(mergeConflicts(A, B), ['name'])
  assert.deepEqual(mergeConflicts(A, { ...B, name: ' דנה כהן ' }), [])
})

test('mergeLeads keeps everything from both and records the merge', () => {
  const { patch, removeId } = mergeLeads(A, B, { now: 5000 })
  assert.equal(removeId, 'b')
  assert.equal(patch.name, undefined)                 // conflict → the kept lead's name by default
  assert.equal(patch.email, 'dana@x.co')              // filled from the other lead
  assert.equal(patch.formName, 'זרובבל 15')
  assert.equal(patch.ts, 1000)                        // earlier arrival
  assert.equal(patch.leadStatus, 'contacted')         // the further stage
  assert.deepEqual(patch.tags, ['VIP', 'משקיעה'])
  assert.deepEqual(patch.formAnswers, [{ q: 'תקציב', a: '3-4 מיליון' }])
  assert.deepEqual(patch.notes.map(n => n.text), ['הערה ישנה', 'הודעה: תקציב 3 מיליון', 'ענתה', '🔗 מוזג עם Dana Cohen · 0501234567'])
  assert.equal(patch.stageLog.length, 1)
  assert.equal(patch.mergedFrom[0].id, 'b'); assert.equal(patch.mergedFrom[0].campaign, 'זרובבל 15')
})

test('mergeLeads: the user picks the other lead\'s value for a conflict; end stages are not overridden', () => {
  const { patch } = mergeLeads(A, B, { choose: { name: 'other' }, now: 5000, lang: 'en' })
  assert.equal(patch.name, 'Dana Cohen')
  assert.match(patch.notes.at(-1).text, /^🔗 Merged with/)
  assert.equal(mergeLeads({ ...A, leadStatus: 'won' }, B).patch.leadStatus, undefined)
  assert.equal(mergeLeads({ ...A, leadStatus: 'irrelevant' }, { ...B, leadStatus: 'negotiating' }).patch.leadStatus, undefined)
  assert.throws(() => mergeLeads(A, A))
})
