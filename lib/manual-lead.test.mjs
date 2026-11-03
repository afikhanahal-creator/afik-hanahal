import { test } from 'node:test'
import assert from 'node:assert/strict'
import { manualLeadRow, localPhone } from './manual-lead.js'

test('a lead added by hand: phone or email, its project, stage, first note and source', () => {
  const now = 1_800_000_000_000
  const r = manualLeadRow({ name: 'Ronen Cohen', phone: '+972 52-123-4567', projectId: 'p_zr15', projectName: 'זרובבל 15', leadStatus: 'contacted', source: 'referral', sourceDetail: 'דנה מהבניין', note: 'מחפש 4 חדרים' }, 'רונן כהן', now)
  assert.equal(r.row.name, 'רונן כהן'); assert.equal(r.row.phone, '0521234567'); assert.equal(r.row.source, 'manual_referral')
  assert.equal(r.row.prop_title, 'זרובבל 15')
  assert.equal(r.row.crm_data.projectId, 'p_zr15'); assert.equal(r.row.crm_data.leadStatus, 'contacted')
  assert.equal(r.row.crm_data.originalName, 'Ronen Cohen')
  assert.equal(r.row.crm_data.notes[0].text, 'מחפש 4 חדרים')
  assert.deepEqual(r.row.crm_data.origin, { channel: 'manual', by: 'office', detail: 'דנה מהבניין' })
  assert.ok(manualLeadRow({ name: 'x' }).error)
  assert.ok(manualLeadRow({ phone: '123' }).error)
  assert.ok(manualLeadRow({ email: 'nope' }).error)
  assert.equal(manualLeadRow({ email: 'A@B.co' }).row.email, 'a@b.co')
  assert.equal(manualLeadRow({ phone: '0501234567', projectId: 'bad id' }).row.crm_data.projectId, undefined)
  assert.equal(manualLeadRow({ phone: '0501234567', leadStatus: 'weird' }).row.crm_data.leadStatus, 'new')
  assert.equal(localPhone('521234567'), '0521234567')
})
