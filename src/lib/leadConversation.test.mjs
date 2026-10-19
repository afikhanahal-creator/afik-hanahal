import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeConversation, welcomeChoices, templateLead, sendErrorText } from './leadConversation.js'

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

test('welcome choices: the automation\'s template first, then welcome, then personal; rendered for the lead', () => {
  const lead = templateLead({ id: 5, name: 'Ronen Levi', phone: '0521234567', campaign_name: 'זרובבל 15 - v2 (כוונה גבוהה)', created_at: new Date().toISOString(), status: 'new' }, null)
  const c = welcomeChoices(null, lead, 'he')
  assert.equal(c[0].id, 'welcome'); assert.equal(c[0].isDefault, true)
  assert.ok(c.some(x => x.cat === 'personal'))
  assert.ok(c.findIndex(x => x.cat === 'personal') > c.findLastIndex(x => x.cat === 'welcome'))
  assert.match(c[0].text, /^היי רונן, כאן אפיק הנחל\./)
  assert.match(c[0].text, /זרובבל 15/)
  assert.doesNotMatch(c[0].text, /v2|כוונה/)
  const custom = welcomeChoices({ rules: { welcome: { templateId: 'welcome_prop' } } }, lead, 'en')
  assert.equal(custom[0].id, 'welcome_prop'); assert.match(custom[0].text, /^Hi Ronen/)
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
