import test from 'node:test'
import assert from 'node:assert/strict'
import { asNotes, leadNotes, addNote } from './leadNotes.js'

test('one list of notes, the Lead Center old note included once', () => {
  assert.deepEqual(asNotes('טקסט ישן'), [{ id: 'legacy', text: 'טקסט ישן', ts: 0, kind: 'note' }])
  assert.deepEqual(asNotes([{ id: 'a', text: ' ' }, { id: 'b', text: 'x', ts: 1 }]), [{ id: 'b', text: 'x', ts: 1 }])
  const crm = { notes: [{ id: 'a', text: 'שיחה ראשונה', ts: 10 }, { id: 'b', text: 'שיחה שנייה', ts: 30 }] }
  const meta = { id: 9, notes: 'מעוניין בזרובבל', created_at: '1970-01-01T00:00:00.020Z' }
  assert.deepEqual(leadNotes(crm, meta).map(n => n.id), ['b', 'meta_note_9', 'a'])
  const r = addNote(crm, meta, '  חזרתי אליו  ', { now: 100, by: 'lead-center' })
  assert.equal(r.note.text, 'חזרתי אליו'); assert.equal(r.note.by, 'lead-center')
  assert.equal(r.patch.notes.length, 4)
  assert.deepEqual(leadNotes({ notes: r.patch.notes }, meta).map(n => n.id).slice(1), ['b', 'meta_note_9', 'a'])   // not twice
  assert.equal(addNote(crm, meta, '   '), null)
  assert.equal(addNote(null, null, 'x', { now: 5 }).patch.notes.length, 1)
})
