import test from 'node:test'
import assert from 'node:assert/strict'
import { leadHistory, crmLeadFor } from './leadHistory.js'

const meta = { id: 7, name: 'גדי ציון', phone: '0503531102', created_at: '2026-10-19T07:49:00Z', campaign_name: 'זרובבל 15 - v2 (כוונה גבוהה)', raw_fields: [{ name: 'rooms', values: ['3r'] }] }
const older = { id: 3, name: 'גדי', phone: '+972 50-353-1102', created_at: '2026-09-02T10:00:00Z', campaign_name: 'הוד השרון' }
const other = { id: 9, phone: '0521111111', created_at: '2026-10-18T10:00:00Z' }
const crm = { id: 'c1', phone: '050-353-1102', source: 'booking', ts: Date.parse('2026-10-19T09:00:00Z'), msg: 'על ארבעה חדרים בחדרה',
  metaLeadId: '7', stageLog: [{ from: 'new', to: 'meeting', at: Date.parse('2026-10-19T10:00:00Z') }],
  notes: [{ id: 'n', text: 'דיברנו, מחפשים 4 חדרים', ts: '2026-10-19T11:00:00Z' }],
  bookings: [{ id: 'b', start: '2026-10-20T07:00:00Z', at: '2026-10-19T09:00:00Z' }], auto: { sent: { welcome: '2026-10-19T07:50:00Z' } } }

test('one timeline: every inquiry from the number, its answers, bookings, stages, notes, automatic sends', () => {
  const h = leadHistory({ lead: meta, metaLeads: [meta, older, other], crmLead: crm, stageName: s => ({ meeting: 'נקבעה פגישה' }[s] || s) })
  assert.deepEqual(h.map(x => x.kind), ['note', 'stage', 'inquiry', 'booking', 'auto', 'inquiry', 'inquiry'])
  assert.equal(h.find(x => x.current).title, 'השאירו פרטים במודעה · זרובבל 15')
  assert.ok(h.find(x => x.current).lines.length > 0)
  assert.equal(h[1].title, 'עבר לשלב: נקבעה פגישה')
  assert.match(h[2].title, /^פנייה · /); assert.deepEqual(h[2].lines, ['על ארבעה חדרים בחדרה'])
  assert.match(h[3].title, /^נקבעה שיחה ל/)
  assert.equal(h[6].title, 'השאירו פרטים במודעה · הוד השרון')   // the older inquiry from the same phone
  assert.ok(!h.some(x => x.title.includes('0521111111')))
})

test('the CRM copy is found by its metaLeadId (flattened or in crm_data), else by phone', () => {
  assert.equal(crmLeadFor(meta, [{ id: 'x', phone: '0503531102' }, crm]).id, 'c1')
  assert.equal(crmLeadFor(meta, [{ id: 'y', crm_data: { metaLeadId: '7' } }]).id, 'y')
  assert.equal(crmLeadFor(meta, [{ id: 'z', phone: '972503531102' }]).id, 'z')
  assert.equal(crmLeadFor(meta, [{ id: 'w', phone: '0520000000' }]), null)
})

test('leadFormCard: Meta answers, CRM copy, website message, nothing left', async () => {
  const { leadFormCard } = await import('./leadHistory.js')
  const meta = leadFormCard({ id: 1, campaign_name: 'זרובבל 15 - v2 (כוונה גבוהה)', form_name: 'טופס', created_at: '2026-10-19T08:00:00Z', raw_fields: [{ name: 'full_name', values: ['גדי'] }, { name: 'מה התקציב?', values: ['b34'] }] })
  assert.equal(meta.campaign, 'זרובבל 15'); assert.equal(meta.where, 'ad')
  assert.deepEqual(meta.rows.map(r => r.q), ['מה התקציב?'])
  const crm = leadFormCard({ id: 7, source: 'meta', crm_data: { campaignName: 'הרצל 8', formAnswers: [{ q: 'חדרים', a: '4' }] }, message: 'חדרים: 4' })
  assert.deepEqual(crm.rows, [{ q: 'חדרים', a: '4' }]); assert.equal(crm.campaign, 'הרצל 8')
  const site = leadFormCard({ id: 8, source: 'contact_form', msg: 'מחפשים מגרש בכפר סבא' })
  assert.equal(site.where, 'site'); assert.equal(site.rows[0].a, 'מחפשים מגרש בכפר סבא')
  assert.equal(leadFormCard({ id: 9, name: 'x', phone: '050' }), null)
})
