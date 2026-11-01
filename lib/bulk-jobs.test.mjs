import test from 'node:test'
import assert from 'node:assert/strict'

// Paced bulk sends end to end against a fake Supabase + Green API: one message per tick, the next one only after the gap,
// a lead who replied since the job was created is skipped, a 466 quota refusal leaves the recipient pending.
process.env.WA_GREENAPI_INSTANCE = '7105000001'
process.env.WA_GREENAPI_TOKEN = 'test-token'
process.env.SUPABASE_URL = 'https://supa.test'
process.env.SUPABASE_SERVICE_KEY = 'k'
const store = new Map()
const leads = new Map()
let sends = [], quota = false
const res = (body, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(body), json: async () => body })
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url), body = opts.body ? JSON.parse(opts.body) : null
  if (u.includes('/sendMessage/') || u.includes('/sendFileByUrl/')) {
    if (quota) return { ok: false, status: 466, text: async () => 'Monthly quota has been exceeded', json: async () => ({}) }
    sends.push(body); return res({ idMessage: 'M' + sends.length })
  }
  if (u.includes('/app_settings')) {
    if ((opts.method || 'GET') === 'GET') { const k = decodeURIComponent(u.match(/key=eq\.([^&]+)/)?.[1] || ''); return res(store.has(k) ? [{ value: store.get(k), updated_at: 'x' }] : []) }
    if (opts.method === 'PATCH') return res([{ key: 'lock' }])          // the lock is always free here
    if (body?.key) store.set(body.key, body.value)
    return res('', 201)
  }
  if (u.includes('/contacts?id=eq.')) { const id = decodeURIComponent(u.match(/id=eq\.([^&]+)/)[1]); return res(leads.has(id) ? [leads.get(id)] : []) }
  return res([])
}
const Auto = await import('./automations.js')
const jobs = () => store.get('automations_jobs').jobs

test('one message per tick, then the gap; a replied lead is skipped; quota keeps the recipient pending', async () => {
  const created = new Date(Date.now() - 3600e3).toISOString()
  for (const [id, name] of [['1', 'אמנון'], ['2', 'דנה'], ['3', 'יוסי']]) leads.set(id, { id, name, phone: `05200000${id}0`, crm_data: {} })
  leads.get('2').crm_data = { auto: { replied: true, lastInboundTs: Date.now() - 60e3 } }     // wrote to us after the job was created
  store.set('automations', { enabled: true, quiet: { enabled: false } })
  store.set('automations_jobs', { jobs: [{ id: 'j1', templateId: 'welcome', status: 'sending', at: created, createdAt: created, gapSec: 60, dailyCap: 60, respectQuiet: false,
    recipients: ['1', '2', '3'].map(id => ({ leadId: id, phone: `9725200000${id}0`, name: leads.get(id).name })) }] })

  await Auto.jobsTick()
  assert.equal(sends.length, 1)
  let j = jobs()[0]
  assert.equal(j.recipients[0].status, 'sent'); assert.ok(j.recipients[0].at)
  assert.ok(new Date(j.nextAt).getTime() - Date.now() >= 40000, 'next message waits for the gap')

  await Auto.jobsTick()                                             // the gap hasn't passed: nothing goes out
  assert.equal(sends.length, 1)

  store.set('automations_jobs', { jobs: [{ ...jobs()[0], nextAt: new Date(Date.now() - 1000).toISOString() }] })
  quota = true
  await Auto.jobsTick()
  j = jobs()[0]
  assert.equal(sends.length, 1)
  assert.equal(j.recipients[1].status, 'skipped')                  // דנה replied in the meantime
  assert.equal(j.recipients[2].status, undefined)                   // יוסי waits: quota, not a failure
  assert.ok(new Date(j.nextAt).getTime() - Date.now() > 50 * 60e3)

  quota = false
  store.set('automations_jobs', { jobs: [{ ...j, nextAt: new Date(Date.now() - 1000).toISOString() }] })
  await Auto.jobsTick()
  j = jobs()[0]
  assert.equal(sends.length, 2)
  assert.equal(j.recipients[2].status, 'sent')
  assert.equal(j.status, 'done'); assert.equal(j.nextAt, null)
})

test('the daily cap moves the job to the next day', async () => {
  const created = new Date(Date.now() - 3600e3).toISOString(), now = new Date().toISOString()
  store.set('automations_jobs', { jobs: [{ id: 'j2', templateId: 'welcome', status: 'sending', at: created, createdAt: created, gapSec: 60, dailyCap: 5, respectQuiet: false,
    recipients: [...Array.from({ length: 5 }, (_, i) => ({ leadId: null, phone: `97252000010${i}`, name: 'x', status: 'sent', at: now })), { leadId: null, phone: '972520000199', name: 'y' }] }] })
  const before = sends.length
  await Auto.jobsTick()
  const j = jobs()[0]
  assert.equal(sends.length, before)
  assert.equal(j.recipients[5].status, undefined)
  assert.ok(new Date(j.nextAt).getTime() > Date.now() + 60e3)
})

test('A/B: each recipient gets the version it was dealt', async () => {
  const created = new Date(Date.now() - 3600e3).toISOString()
  leads.set('7', { id: '7', name: 'רון', phone: '0520000070', crm_data: {} }); leads.set('8', { id: '8', name: 'גל', phone: '0520000080', crm_data: {} })
  const saved = await Auto.saveJob({ templateId: 'welcome', templateIds: ['welcome', 'welcome_book', 'nope', 'welcome'], at: created, respectQuiet: false,
    recipients: [{ leadId: '7', phone: '0520000070', name: 'רון', variant: 'welcome_book' }, { leadId: '8', phone: '0520000080', name: 'גל', variant: 'welcome' }] })
  assert.deepEqual(saved.templateIds, ['welcome', 'welcome_book', 'nope'])
  assert.deepEqual(saved.recipients.map(r => r.variant), ['welcome_book', 'welcome'])
  store.set('automations_jobs', { jobs: [{ ...saved, status: 'sending', createdAt: created }] })
  const before = sends.length
  await Auto.jobsTick()
  store.set('automations_jobs', { jobs: [{ ...jobs()[0], nextAt: new Date(Date.now() - 1000).toISOString() }] })
  await Auto.jobsTick()
  const out = sends.slice(before).map(b => b.message || b.caption || '')
  assert.equal(out.length, 2)
  assert.match(out[0], /book/)                         // welcome_book carries the booking link
  assert.doesNotMatch(out[1], /book/)
  assert.equal(jobs()[0].status, 'done')
})
