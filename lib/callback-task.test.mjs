import test from 'node:test'
import assert from 'node:assert/strict'

// A lead's WhatsApp reply that names a time → a follow-up task on the lead (with a reminder), a note, and a notice to the
// office line + the rule's extra numbers. One automatic task per lead (a newer time moves it), never twice for one message.
process.env.WA_GREENAPI_INSTANCE = '7105000001'
process.env.WA_GREENAPI_TOKEN = 'test-token'
process.env.SUPABASE_URL = 'https://supa.test'
process.env.SUPABASE_SERVICE_KEY = 'k'
delete process.env.ANTHROPIC_API_KEY
const calls = []
const settings = { automations: { rules: { callback: { notify: ['054-304-9491'] } } } }
let lead = { id: 501, name: 'זוהר כהן', phone: '0521234567', prop_title: null, crm_data: { leadStatus: 'contacted', campaignName: 'זרובבל 15 - v2', tasks: [], notes: [] } }
let lastOut = { body: 'היי זוהר, קיבלנו את הפרטים על זרובבל 15.\nמתי זה זמן נוח לדבר?', ts: '2026-11-03T06:06:00.000Z' }
globalThis.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url))
  const body = opts.body ? JSON.parse(opts.body) : null
  calls.push({ url: u, method: opts.method || 'GET', body })
  const res = (b, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(b), json: async () => b })
  const key = /\/app_settings\?key=eq\.([a-z_]+)/.exec(u)?.[1]
  if (key) return res(settings[key] !== undefined ? [{ value: settings[key], updated_at: 'x' }] : [])
  if (u.includes('/app_settings?on_conflict')) { settings[body.key] = body.value; return res('', 201) }
  if (u.includes('/wa_messages?phone=')) return res(lastOut ? [lastOut] : [])
  if (u.includes('/contacts?or=(phone')) return res(u.includes('972521234567') ? [lead] : [])
  if (u.includes('/contacts?id=eq.') && (opts.method || 'GET') === 'GET') return res([lead])
  if (u.includes('/contacts?id=eq.') && opts.method === 'PATCH') { lead = { ...lead, crm_data: body.crm_data }; return res('', 204) }
  if (u.includes('/sendMessage/')) return res({ idMessage: 'N' + calls.length })
  return res([])
}
const Auto = await import('./automations.js')
const NOW = Date.parse('2026-11-03T08:07:30+02:00')
const row = (id, body, ts = '2026-11-03T06:07:00.000Z') => ({ id, phone: '972521234567', direction: 'in', type: 'textMessage', body, ts })

test('"בשעות הצהריים" after "מתי זה זמן נוח לדבר?" → a follow-up today 13:00 with a reminder, a note and a notice', async () => {
  const r = await Auto.onIncomingMessage(row('M1', 'בשעות הצהריים'), { now: NOW })
  assert.ok(r.task, JSON.stringify(r))
  const t = lead.crm_data.tasks[0]
  assert.equal(t.kind, 'followup'); assert.equal(t.remind, true); assert.equal(t.auto, 'wa'); assert.equal(t.fromMsg, 'M1')
  assert.equal(t.due, '2026-11-03T11:00:00.000Z')                    // 13:00 Israel
  assert.equal(lead.crm_data.followUp, '2026-11-03T13:00')
  assert.match(t.text, /^לחזור לזוהר — ביקשו בוואטסאפ: "בשעות הצהריים"$/)
  assert.match(lead.crm_data.notes[0].text, /^🔗 משימה חדשה: לחזור לזוהר כהן היום 13:00/)
  const sends = calls.filter(c => c.url.includes('/sendMessage/'))
  assert.deepEqual(sends.map(s => s.body.chatId).sort(), ['972543049491@c.us', '972559811814@c.us'])
  assert.match(sends[0].body.message, /על: זרובבל 15/)
  assert.ok(settings.callback_seen.includes('M1'))
})

test('the same message again does nothing; a newer time moves the same task', async () => {
  calls.length = 0
  assert.equal((await Auto.onIncomingMessage(row('M1', 'בשעות הצהריים'), { now: NOW })).skipped, 'seen')
  const r = await Auto.onIncomingMessage(row('M2', 'בעצם מחר ב4', '2026-11-03T06:30:00.000Z'), { now: NOW + 25 * 60e3 })
  assert.equal(r.task.moved, true)
  assert.equal(lead.crm_data.tasks.length, 1)
  assert.equal(lead.crm_data.tasks[0].due, '2026-11-04T14:00:00.000Z')
  assert.equal(lead.crm_data.followUp, '2026-11-04T16:00')
  assert.match(calls.find(c => c.url.includes('/sendMessage/')).body.message, /^\*המשימה עודכנה: לחזור לזוהר כהן מחר 16:00\*/)
})

test('no task: no time, a stranger, a lead marked "לא רלוונטי", the rule off', async () => {
  calls.length = 0
  assert.equal((await Auto.onIncomingMessage(row('M3', 'אחלה תודה'), { now: NOW })).skipped, 'no time')
  assert.equal((await Auto.onIncomingMessage({ ...row('M4', 'מחר ב4'), phone: '972509999999' }, { now: NOW })).skipped, 'not a lead')
  lead = { ...lead, crm_data: { ...lead.crm_data, leadStatus: 'irrelevant' } }
  assert.equal((await Auto.onIncomingMessage(row('M5', 'מחר ב4'), { now: NOW })).skipped, 'stage irrelevant')
  lead = { ...lead, crm_data: { ...lead.crm_data, leadStatus: 'contacted' } }
  settings.automations = { rules: { callback: { mode: 'off' } } }
  await Auto.loadConfig({ fresh: true })
  assert.equal((await Auto.onIncomingMessage(row('M6', 'מחר ב4'), { now: NOW })).skipped, 'off')
  assert.equal(calls.filter(c => c.url.includes('/sendMessage/')).length, 0)
  settings.automations = { rules: { callback: { notify: ['054-304-9491'] } } }
  await Auto.loadConfig({ fresh: true })
})

test('our own messages and old messages are ignored', async () => {
  assert.equal((await Auto.onIncomingMessage({ ...row('M7', 'מחר ב4'), direction: 'out' }, { now: NOW })).skipped, 'not a text from a lead')
  assert.equal((await Auto.onIncomingMessage(row('M8', 'מחר ב4', '2026-11-02T20:00:00.000Z'), { now: NOW })).skipped, 'old')
})
