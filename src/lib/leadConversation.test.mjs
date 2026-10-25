import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeConversation, templateLead, sendErrorText } from './leadConversation.js'

const at = m => new Date(Date.UTC(2026, 9, 19, 8, m)).toISOString()

test('merge: WhatsApp history wins, the log fills what WhatsApp lacks, pending disappears once delivered', () => {
  const green = [
    { id: 'G1', direction: 'out', message: 'היי, כאן אפיק הנחל.', created_at: at(1) },
    { id: 'G2', direction: 'in', message: 'היי, מתי אפשר לדבר?', created_at: at(5) },
  ]
  const local = [
    { id: 1, direction: 'out', message: 'היי,  כאן אפיק הנחל.', created_at: at(1), wa_message_id: null },   // same text → dropped
    { id: 2, direction: 'out', message: 'שלחנו פרטים', created_at: at(3), wa_message_id: 'G9' },            // not in WhatsApp → kept
    { id: 3, direction: 'out', message: 'x', created_at: at(2), wa_message_id: 'G1' },                      // same id → dropped
  ]
  const pending = [{ id: 'opt-1', direction: 'out', message: 'היי, מתי אפשר לדבר?', created_at: at(6) }, { id: 'opt-2', direction: 'out', message: 'נתקשר בעוד שעה', created_at: at(7) }]
  const m = mergeConversation(green, local, pending)
  assert.deepEqual(m.map(x => x.id), ['G1', 'log-2', 'G2', 'opt-1', 'opt-2'])
  // a pending message whose text WhatsApp already has (outgoing) disappears
  const m2 = mergeConversation([...green, { id: 'G3', direction: 'out', message: 'נתקשר בעוד שעה', created_at: at(7) }], [], pending)
  assert.deepEqual(m2.map(x => x.id), ['G1', 'G2', 'opt-1', 'G3'])
})

test('merge: with no WhatsApp history the log is the conversation', () => {
  const m = mergeConversation([], [{ id: 7, direction: 'in', message: 'שלום', created_at: at(2) }, { id: 8, direction: 'out', message: 'היי', created_at: at(1) }])
  assert.deepEqual(m.map(x => [x.id, x.direction]), [['log-8', 'out'], ['log-7', 'in']])
})

test('template lead: a Meta lead reads as one for the templates; the CRM copy adds what the office typed', () => {
  const meta = { id: 9, name: 'דנה', phone: '0501112222', campaign_name: 'C', form_name: 'F', status: 'scheduled' }
  const a = templateLead(meta, null, [{ q: 'חדרים', a: '4' }])
  assert.equal(a.source, 'meta'); assert.equal(a.leadStatus, 'discovery'); assert.equal(a.crm_data.metaLeadId, 9)
  const b = templateLead(meta, { name: 'דנה כהן', phone: '', leadStatus: 'negotiating', crm_data: { budget: '3-4M' } })
  assert.equal(b.name, 'דנה כהן'); assert.equal(b.phone, '0501112222'); assert.equal(b.leadStatus, 'negotiating')
  assert.equal(b.crm_data.budget, '3-4M'); assert.equal(b.crm_data.metaLeadId, 9)
  assert.equal(templateLead(null), null)
})

test('send errors read as words, never as raw JSON', () => {
  const q = sendErrorText({ quota: true, error: 'Green API 466 (…): {"invokeStatus":{"method":"sendmessage"}}' })
  assert.match(q, /המכסה החודשית/); assert.doesNotMatch(q, /invokeStatus/)
  assert.match(sendErrorText({ error: 'Green API 466: {"x":1}' }), /המכסה/)
  const o = sendErrorText({ error: 'Green API 401 (טוקן או instance שגויים): {"message":"bad"}' })
  assert.equal(o, 'השליחה נכשלה: Green API 401 (טוקן או instance שגויים)')
  assert.match(sendErrorText('timeout', 'en'), /^Sending failed: timeout$/)
})

test('template dropdown: welcome first before anything was sent, sent ones marked', async () => {
  const { templateOptions } = await import('./leadConversation.js')
  const { CATEGORIES } = await import('../../lib/automations-shared.js')
  const lead = templateLead({ id: 5, name: 'דנה', phone: '0521234567', campaign_name: 'זרובבל 15 - v2', status: 'new' }, null)
  const g1 = templateOptions(null, lead, 'he', { first: true, categories: CATEGORIES })
  assert.equal(g1[0].id, 'welcome'); assert.equal(g1[0].items[0].id, 'welcome_prop'); assert.equal(g1[0].items[0].isDefault, true)   // a lead from a project's ad gets the project's welcome
  assert.equal(g1[1].id, 'personal')
  assert.match(g1[0].items[0].text, /^היי דנה, ראינו את הפנייה/); assert.doesNotMatch(g1[0].items[0].text, /אפיק הנחל/)
  assert.match(g1[0].items[0].text, /זרובבל 15/); assert.doesNotMatch(g1[0].items[0].text, /v2/)
  const en = templateOptions({ rules: { welcome: { templateId: 'welcome_prop' } } }, templateLead({ id: 6, name: 'Ronen Levi', phone: '0521234567', status: 'new' }), 'en', { first: true, categories: CATEGORIES })
  assert.equal(en[0].items[0].id, 'welcome_prop'); assert.match(en[0].items[0].text, /^Hi Ronen/)
  assert.ok(g1.reduce((n, g) => n + g.items.length, 0) >= 50)
  const sentText = g1[0].items[0].text
  const g2 = templateOptions(null, lead, 'he', { outTexts: [sentText], categories: CATEGORIES })
  assert.equal(g2[0].id, CATEGORIES[0].id)
  assert.equal(g2.flatMap(g => g.items).find(x => x.id === 'welcome_prop').sent, true)
  assert.equal(g2.flatMap(g => g.items).filter(x => x.sent).length < 5, true)
})

test('a picture or a file we sent shows once, not as our "📷 …" bubble and WhatsApp\'s copy', async () => {
  const { mergeConversation } = await import('./leadConversation.js')
  const at = '2026-10-25T08:32:00.000Z', later = '2026-10-25T08:32:20.000Z'
  const green = [{ id: 'G1', direction: 'out', message: 'היי מיכל, קיבלנו את הפרטים על זרובבל 15. נוח שנתקשר היום?', kind: 'imageMessage', media: { url: 'x' }, created_at: later },
    { id: 'G2', direction: 'out', message: '📎 מסמך', kind: 'documentMessage', media: { url: 'y', name: 'plan.pdf' }, created_at: later }]
  const pending = [{ id: 'opt-1', direction: 'out', message: '📷 היי מיכל, קיבלנו את הפרטים על זרובבל 15. נוח שנתקשר היום?', created_at: at, status: 'sent' },
    { id: 'opt-2', direction: 'out', message: '📎 plan.pdf', created_at: at, status: 'sent' }]
  const local = [{ id: 9, direction: 'out', message: '📷 היי מיכל, קיבלנו את הפרטים על זרובבל 15. נוח שנתקשר היום?', created_at: at }]
  const out = mergeConversation(green, local, pending)
  assert.deepEqual(out.map(m => m.id), ['G1', 'G2'])
  // a picture WhatsApp doesn't have (yet) still shows
  assert.equal(mergeConversation([], [], pending.slice(0, 1)).length, 1)
})
