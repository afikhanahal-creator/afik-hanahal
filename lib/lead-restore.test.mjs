import test from 'node:test'
import assert from 'node:assert/strict'
import { restoreRow, trashBatches } from './lead-restore.js'

test('a trashed lead becomes the same contacts row again', () => {
  const lead = { id: '412', name: 'דנה כהן', phone: '0501234567', email: '', msg: 'שלום', propTitle: 'זרובבל 15', propLocation: '',
    source: 'meta', ts: Date.parse('2026-10-20T10:00:00Z'), updatedAt: 5, deletedAt: 9, leadStatus: 'contacted',
    notes: [{ id: 'n1', text: 'דיברנו' }], tasks: [{ id: 't1', due: '2026-10-26T07:00:00Z' }], metaLeadId: '77', crm_data: { originalName: 'Dana Cohen' } }
  const r = restoreRow(lead)
  assert.equal(r.id, 412)
  assert.equal(r.name, 'דנה כהן')
  assert.equal(r.email, null)
  assert.equal(r.message, 'שלום')
  assert.equal(r.prop_title, 'זרובבל 15')
  assert.equal(r.created_at, '2026-10-20T10:00:00.000Z')
  assert.equal(r.lead_status, 'contacted')
  assert.deepEqual(r.crm_data.notes, [{ id: 'n1', text: 'דיברנו' }])
  assert.equal(r.crm_data.metaLeadId, '77')
  assert.equal(r.crm_data.originalName, 'Dana Cohen')
  for (const k of ['deletedAt', 'ts', 'updatedAt', 'name', 'phone', 'msg', 'id']) assert.ok(!(k in r.crm_data), k)
})

test('browser-only copies cannot be restored to the database', () => {
  assert.equal(restoreRow({ id: 'meta_55', name: 'x' }), null)
  assert.equal(restoreRow({ id: 'bk:abc' }), null)
  assert.equal(restoreRow(null), null)
})

test('the trash in deletions: a bulk delete is one batch', () => {
  const t = [{ id: 1, deletedAt: 1000e3 }, { id: 2, deletedAt: 1000e3 - 2e3 }, { id: 3, deletedAt: 500e3 }, { id: 4 }]
  const b = trashBatches(t)
  assert.deepEqual(b.map(x => x.leads.map(l => l.id)), [[1, 2], [3], [4]])
  assert.equal(b[0].at, 1000e3)
})
