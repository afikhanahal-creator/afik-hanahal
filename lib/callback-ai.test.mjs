import test from 'node:test'
import assert from 'node:assert/strict'

// A time in a lead's message is not a task by itself: Claude reads the conversation first. A proposal ("שלישי ב18:30?") → no
// task, no notice; a meeting both sides agreed on → a task an hour before it and a "נקבעה פגישה" notice (no link preview).
process.env.WA_GREENAPI_INSTANCE = '7105000001'
process.env.WA_GREENAPI_TOKEN = 'test-token'
process.env.SUPABASE_URL = 'https://supa.test'
process.env.SUPABASE_SERVICE_KEY = 'k'
process.env.ANTHROPIC_API_KEY = 'test-key'
const calls = []
const settings = { automations: { rules: { callback: {} } } }
let lead = { id: 382, name: 'תומר אברהם', phone: '0544804231', prop_title: null, crm_data: { leadStatus: 'contacted', campaignName: 'קציר 16 באר יעקב', tasks: [], notes: [] } }
const convo = [
  { direction: 'out', body: 'היי תומר, נשמח לתאם סיור בקציר 16. מתי נוח לכם?', ts: '2026-11-04T08:00:00.000Z' },
]
let answer = null
globalThis.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url))
  const body = opts.body ? JSON.parse(opts.body) : null
  calls.push({ url: u, method: opts.method || 'GET', body })
  const res = (b, status = 200) => new Response(status === 204 ? null : (typeof b === 'string' ? b : JSON.stringify(b)), { status, headers: { 'content-type': 'application/json' } })
  if (u.includes('api.anthropic.com')) return res({ id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } })
  const key = /\/app_settings\?key=eq\.([a-z_]+)/.exec(u)?.[1]
  if (key) return res(settings[key] !== undefined ? [{ value: settings[key], updated_at: 'x' }] : [])
  if (u.includes('/app_settings?on_conflict')) { settings[body.key] = body.value; return res('', 201) }
  if (u.includes('/wa_messages?phone=') && u.includes('direction=eq.out')) return res([{ body: convo[0].body, ts: convo[0].ts }])
  if (u.includes('/wa_messages?phone=')) return res([...convo].reverse())
  if (u.includes('/contacts?or=(phone')) return res(u.includes('972544804231') ? [lead] : [])
  if (u.includes('/contacts?id=eq.') && (opts.method || 'GET') === 'GET') return res([lead])
  if (u.includes('/contacts?id=eq.') && opts.method === 'PATCH') { lead = { ...lead, crm_data: body.crm_data }; return res('', 204) }
  if (u.includes('/sendMessage/')) return res({ idMessage: 'N' + calls.length })
  return res([])
}
const Auto = await import('./automations.js')
const NOW = Date.parse('2026-11-04T11:10:00+02:00')   // Wednesday
const row = (id, body, ts = '2026-11-04T09:09:00.000Z') => ({ id, phone: '972544804231', direction: 'in', type: 'textMessage', body, ts })

test('"שלישי ב18:30?" — Claude reads a proposal: no task, no notice; Claude saw the whole conversation', async () => {
  answer = { kind: 'proposal', agreed: false, date: '2026-11-10', time: '18:30', title: 'לענות לתומר על הסיור', summary: 'תומר מציע מועד לסיור בקציר 16 ומחכה לאישור שלנו', confidence: 'high' }
  convo.push({ direction: 'in', body: 'שלישי ב18:30?', ts: '2026-11-04T09:09:00.000Z' })
  const r = await Auto.onIncomingMessage(row('T1', 'שלישי ב18:30?'), { now: NOW })
  assert.equal(r.skipped, 'analysis: proposal', JSON.stringify(r))
  assert.equal(lead.crm_data.tasks.length, 0)
  assert.equal(calls.filter(c => c.url.includes('/sendMessage/')).length, 0)
  const sent = calls.find(c => c.url.includes('api.anthropic.com'))
  const prompt = JSON.stringify(sent.body.messages)
  assert.ok(prompt.includes('נשמח לתאם סיור') && prompt.includes('שלישי ב18:30'), 'the conversation goes to Claude')
})

test('a meeting both sides agreed on → a task an hour before it, a "נקבעה פגישה" notice without a link preview', async () => {
  calls.length = 0
  convo.push({ direction: 'out', body: 'סגור, שלישי ב18:30 בקציר 16', ts: '2026-11-04T09:20:00.000Z' }, { direction: 'in', body: 'מעולה, נתראה שלישי ב18:30', ts: '2026-11-04T09:25:00.000Z' })
  answer = { kind: 'meeting', agreed: true, date: '2026-11-10', time: '18:30', title: 'סיור בקציר 16 עם תומר', summary: 'נקבע סיור בנכס ביום שלישי ב-18:30', confidence: 'high' }
  const r = await Auto.onIncomingMessage(row('T2', 'מעולה, נתראה שלישי ב18:30', '2026-11-04T09:25:00.000Z'), { now: NOW + 20 * 60e3 })
  assert.ok(r.task, JSON.stringify(r))
  const t = lead.crm_data.tasks[0]
  assert.equal(t.text, 'סיור בקציר 16 עם תומר')
  assert.equal(t.at, '2026-11-10T16:30:00.000Z')               // 18:30 Israel
  assert.equal(t.due, '2026-11-10T15:30:00.000Z')              // reminded an hour before
  assert.equal(t.kindOf, 'meeting')
  const n = calls.find(c => c.url.includes('/sendMessage/')).body
  assert.match(n.message, /^\*נקבעה פגישה: תומר אברהם יום שלישי 18:30\*/)
  assert.match(n.message, /מה הבנו מהשיחה: נקבע סיור/)
  assert.equal(n.linkPreview, false)
})

test('Claude unsure → no task, even with a clear hour', async () => {
  calls.length = 0
  lead = { ...lead, crm_data: { ...lead.crm_data, tasks: [] } }
  answer = { kind: 'callback', agreed: false, date: '2026-11-05', time: '16:00', title: 'לחזור לתומר', summary: '', confidence: 'low' }
  const r = await Auto.onIncomingMessage(row('T3', 'אולי מחר ב4', '2026-11-04T09:40:00.000Z'), { now: NOW + 35 * 60e3 })
  assert.equal(r.skipped, 'analysis: callback')
  assert.equal(lead.crm_data.tasks.length, 0)
})
