import test from 'node:test'
import assert from 'node:assert/strict'

process.env.WA_GREENAPI_INSTANCE = '7107000000'; process.env.WA_GREENAPI_TOKEN = 'tok'
process.env.SUPABASE_URL = 'https://sb.test'; process.env.SUPABASE_SERVICE_KEY = 'k'
const calls = []
let claudeReply = null
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url); calls.push(u)
  const J = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } })
  if (u.includes('getChatHistory')) return J([{ type: 'outgoing', textMessage: 'היי דנה, ראיתי שהתעניינת', timestamp: Date.now() / 1000 - 7200 }, { type: 'incoming', textMessage: 'כן! יש לנו 2.4 מיליון במזומן, מתי אפשר לראות?', timestamp: Date.now() / 1000 - 6000 }])
  if (u.includes('/rest/v1/contacts?id=eq.')) return J([{ id: 5, crm_data: { auto: { intent: 'positive' } } }])
  if (u.includes('/rest/v1/automation_log')) return J([{ created_at: '2026-09-23T08:00:00Z', rule_key: 'welcome', ok: true, message: 'שלום' }])
  if (u.includes('/rest/v1/contacts?phone')) return J([{ id: 9, phone: '050-111-2222', created_at: '2026-08-01', prop_title: 'דירה ברעננה' }, { id: 5, phone: '0501112222' }])
  if (u.includes('/rest/v1/meta_leads')) return J([])
  if (u.includes('/api/properties')) return J([{ title: 'מגרש בתל מונד', price: '2,500,000', category: 'land', location: 'תל מונד' }])
  if (u.includes('api.anthropic.com')) {
    const body = JSON.parse(opts.body)
    assert.equal(body.model, 'claude-opus-5'); assert.equal(body.fallbacks, 'default')
    assert.equal(body.output_config.format.type, 'json_schema'); assert.deepEqual(body.thinking, { type: 'adaptive' })
    assert.ok(body.messages[0].content.includes('2.4 מיליון')); assert.ok(body.messages[0].content.includes('Rule-based score'))
    const hdr = opts.headers instanceof Headers ? opts.headers.get('anthropic-beta') : (opts.headers?.['anthropic-beta'])
    assert.ok(String(hdr).includes('server-side-fallback-2026-07-01'))
    return J({ id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(claudeReply) }], usage: { input_tokens: 1, output_tokens: 1 } })
  }
  return J({})
}
const { analyzeLead } = await import('./lead-analyze.js')
const lead = { id: '5', name: 'דנה כהן', phone: '0501112222', msg: 'מתעניינת במגרש בתל מונד', propTitle: 'מגרש בתל מונד', ts: Date.now() - 3 * 3600e3, leadStatus: 'contacted' }

test('without ANTHROPIC_API_KEY: rules-only result plus proxy payload', async () => {
  delete process.env.ANTHROPIC_API_KEY
  const r = await analyzeLead(lead)
  assert.equal(r.aiCode, 'no_key'); assert.ok(r.proxy?.user.includes('WhatsApp')); assert.ok(r.score100 >= 60)
  assert.equal(r.context.repeats, 1); assert.equal(r.context.property.title, 'מגרש בתל מונד')
  assert.ok(r.factors.some(f => f.key === 'budget_fits')); assert.ok(r.factors.some(f => f.key === 'cash'))
})

test('with a key: Claude briefing merged, adjustment clamped', async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-test'
  claudeReply = { summary: 'דנה קונה רצינית', persona: 'קונה פרטית', motivation: 'בנייה עצמית', urgency: 'high', dealType: 'buy', budgetRange: '2.4 מיליון ₪', keyNeeds: ['מגרש'], objections: [], questionsToAsk: ['היתר?'], talkingPoints: ['זכויות בנייה'], nextBestAction: 'לקבוע סיור', bestTimeToContact: 'בוקר', suggestedMessage: 'היי דנה…', scoreAdjustment: 40, scoreAdjustmentReason: 'תוכנית ברורה', confidence: 'high', tags: ['מזומן'], risks: [] }
  const r = await analyzeLead(lead)
  assert.equal(r.aiError, null); assert.equal(r.brief.summary, 'דנה קונה רצינית')
  assert.equal(r.adjustment, 15); assert.equal(r.score100, Math.min(100, r.ruleScore + 15))
  assert.equal(r.notes, 'דנה קונה רצינית'); assert.equal(r.intent, 'hot'); assert.equal(r.proxy, undefined)
})
