import test from 'node:test'
import assert from 'node:assert/strict'
import { contactFromMetaLead, mirrorMetaLead, backfillMetaLeads, localPhone, isTestMetaLead } from './meta-crm.js'

const lead = (o = {}) => ({
  id: 12130, leadgen_id: '1030721296689123', name: 'דנה כהן', phone: '972501234567', email: null,
  campaign_name: '', form_name: 'זרובבל 15 - v2', status: 'new', notes: '', created_at: '2026-10-11T09:51:41+00:00',
  raw_fields: [{ name: 'full_name', values: ['דנה כהן'] }, { name: 'phone_number', values: ['+972501234567'] }, { name: 'מה_התקציב?', values: ['3-4 מיליון'] }],
  ...o,
})

// A fake Supabase client: contacts + meta_leads in memory, the query chain the module uses
function fakeClient({ contacts = [], metaLeads = [] } = {}) {
  const tables = { contacts: [...contacts], meta_leads: [...metaLeads] }
  let nextId = 900
  const from = name => {
    const q = { filters: [], isNull: [], lim: null }
    const rows = () => tables[name].filter(r => q.filters.every(([k, v]) => k === 'crm_data->>metaLeadId' ? String(r.crm_data?.metaLeadId) === v : r[k] === v) && q.isNull.every(k => r[k] == null))
    const api = {
      select(cols) { q.cols = cols; return api },
      eq(k, v) { q.filters.push([k, v]); return api },
      is(k) { q.isNull.push(k); return api },
      order() { return api },
      limit(n) { q.lim = n; return api },
      insert(row) { const r = { id: nextId++, ...row }; tables[name].push(r); return { select: () => ({ single: async () => ({ data: { id: r.id }, error: null }) }) } },
      then(res) {
        let data = rows().slice(0, q.lim ?? undefined)
        if (q.cols === 'crm_data->>metaLeadId') data = data.map(r => ({ metaLeadId: r.crm_data?.metaLeadId }))
        return Promise.resolve({ data, error: null }).then(res)
      },
    }
    return api
  }
  return { from, tables }
}

test('localPhone: international → local, the way website leads store it', () => {
  assert.equal(localPhone('972501234567'), '0501234567')
  assert.equal(localPhone('+972-50-123-4567'), '0501234567')
  assert.equal(localPhone('0501234567'), '0501234567')
  assert.equal(localPhone(''), '')
})

test('isTestMetaLead spots Meta testing-tool leads', () => {
  assert.equal(isTestMetaLead({ name: '<test lead: dummy data for full_name>' }), true)
  assert.equal(isTestMetaLead({ name: 'דנה כהן' }), false)
})

test('contactFromMetaLead: a CRM lead with the form answers, linked back, welcome owned by the Meta pipeline', () => {
  const now = '2026-10-11T10:00:00.000Z'
  const c = contactFromMetaLead(lead(), { now })
  assert.equal(c.source, 'meta')
  assert.equal(c.phone, '0501234567')
  assert.equal(c.prop_title, 'זרובבל 15 - v2')
  assert.equal(c.created_at, '2026-10-11T09:51:41+00:00')
  assert.match(c.message, /מה התקציב\?: 3-4 מיליון/)
  assert.equal(c.crm_data.metaLeadId, '12130')
  assert.equal(c.crm_data.leadStatus, 'new')
  assert.equal(c.crm_data.origin.channel, 'meta')
  assert.deepEqual(c.crm_data.formAnswers, [{ q: 'מה התקציב?', a: '3-4 מיליון' }])
  // no second welcome from the CRM rule, follow-ups still possible for a live lead
  assert.deepEqual(c.crm_data.auto, { skipped: { welcome: now } })
})

test('contactFromMetaLead: welcome sent / quiet backfill / status mapping', () => {
  const now = '2026-10-11T10:00:00.000Z'
  const sent = contactFromMetaLead(lead(), { welcome: 'sent', welcomeAt: '2026-10-11T09:52:00Z', now })
  assert.deepEqual(sent.crm_data.auto, { sent: { welcome: '2026-10-11T09:52:00Z' } })
  const quiet = contactFromMetaLead(lead(), { quiet: true, now })
  assert.equal(quiet.crm_data.auto.skipped.welcome, now)
  assert.equal(quiet.crm_data.auto.skipped['noreply:1'], now)
  assert.equal(quiet.crm_data.auto.skipped['noreply:10'], now)
  assert.equal(contactFromMetaLead(lead({ status: 'scheduled' })).crm_data.leadStatus, 'discovery')
  assert.equal(contactFromMetaLead(lead({ status: 'closed' })).crm_data.leadStatus, 'won')
  assert.equal(contactFromMetaLead(lead({ status: 'saved_to_crm' })).crm_data.leadStatus, 'new')
})

test('mirrorMetaLead copies once; skips test, archived and unreachable leads', async () => {
  const c = fakeClient()
  const a = await mirrorMetaLead(c, lead())
  assert.equal(a.created, true)
  const b = await mirrorMetaLead(c, lead())
  assert.deepEqual(b, { id: a.id, created: false })
  assert.equal(c.tables.contacts.length, 1)
  assert.deepEqual(await mirrorMetaLead(c, lead({ id: 2, name: '<test lead: dummy data for full_name>' })), { skipped: 'test lead' })
  assert.deepEqual(await mirrorMetaLead(c, lead({ id: 3, deleted_at: '2026-10-01' })), { skipped: 'archived' })
  assert.deepEqual(await mirrorMetaLead(c, lead({ id: 4, phone: null, email: null })), { skipped: 'no contact details' })
  assert.equal(c.tables.contacts.length, 1)
})

test('backfillMetaLeads copies the missing ones quietly and is idempotent', async () => {
  const c = fakeClient({
    metaLeads: [lead({ id: 1, wa_sent: true }), lead({ id: 2 }), lead({ id: 3, name: '<test lead: dummy data for full_name>' }), lead({ id: 4, deleted_at: '2026-10-01' })],
    contacts: [{ id: 5, source: 'meta', crm_data: { metaLeadId: '2' } }],
  })
  const r = await backfillMetaLeads(c)
  assert.deepEqual(r, { created: 1, existing: 1, skipped: 1, errors: [] })
  const row = c.tables.contacts.find(x => x.crm_data.metaLeadId === '1')
  assert.ok(row.crm_data.auto.sent.welcome)
  assert.ok(row.crm_data.auto.skipped['noreply:1'])
  assert.deepEqual(await backfillMetaLeads(c), { created: 0, existing: 2, skipped: 1, errors: [] })
})
