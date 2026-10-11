import test from 'node:test'
import assert from 'node:assert/strict'

// A Meta lead (meta_leads, not contacts) gets the same welcome as a website lead: the office's WhatsApp through
// Green API, the welcome template, logged in automation_log as "meta:<id>"
process.env.WA_GREENAPI_INSTANCE = '7105000001'
process.env.WA_GREENAPI_TOKEN = 'test-token'
process.env.SUPABASE_URL = 'https://supa.test'
process.env.SUPABASE_SERVICE_KEY = 'k'
const calls = []
let savedConfig = null
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null })
  const res = (body, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(body), json: async () => body })
  if (String(url).includes('/app_settings?key=eq.automations')) return res(savedConfig ? [{ value: savedConfig, updated_at: 'x' }] : [])
  if (String(url).includes('/sendMessage/')) return res({ idMessage: 'MSG1' })
  if (String(url).includes('/automation_log')) return res('', 201)
  return res([])
}
const Auto = await import('./automations.js')

test('Meta lead: welcome through Green API with the welcome template, logged as meta:<id>', async () => {
  const r = await Auto.welcomeExternalLead({ id: 42, name: 'Mor Haviv', phone: '0547374111' })
  assert.equal(r.ok, true); assert.equal(r.idMessage, 'MSG1')
  const send = calls.find(c => c.url.includes('/sendMessage/'))
  assert.equal(send.body.chatId, '972547374111@c.us')
  assert.match(send.body.message, /^היי Mor/)
  const log = calls.find(c => c.url.includes('/automation_log') && c.method === 'POST')
  assert.equal(log.body.lead_id, 'meta:42'); assert.equal(log.body.rule_key, 'welcome'); assert.equal(log.body.ok, true)
})

test('Meta lead: no phone → nothing sent', async () => {
  calls.length = 0
  const r = await Auto.welcomeExternalLead({ id: 43, name: 'x', phone: '' })
  assert.equal(r.skipped, 'no phone'); assert.equal(calls.length, 0)
})
