import test from 'node:test'
import assert from 'node:assert/strict'
import { phoneCheck, nameQuality, parseResearchJson, normalizeResearch, researchText, researchPrompt, researchLead } from './lead-research.js'

test('phoneCheck: Israeli numbering plan', () => {
  assert.deepEqual([phoneCheck('052-123-4567').type, phoneCheck('052-123-4567').e164, phoneCheck('052-123-4567').carrier], ['mobile', '+972521234567', 'Cellcom'])
  assert.equal(phoneCheck('+972 54 765 4321').type, 'mobile'); assert.equal(phoneCheck('+972 54 765 4321').local, '0547654321')
  assert.equal(phoneCheck('547654321').e164, '+972547654321', 'typed without the leading 0')
  assert.equal(phoneCheck('09-7654321').type, 'landline'); assert.equal(phoneCheck('09-7654321').area, 'Sharon')
  assert.ok(phoneCheck('03-5551234').notes.some(n => /landline/.test(n)))
  assert.equal(phoneCheck('072-2223344').type, 'voip')
  assert.equal(phoneCheck('0500000000').valid, true); assert.ok(phoneCheck('0500000000').notes.some(n => /made up/.test(n)))
  assert.equal(phoneCheck('05212').valid, false); assert.equal(phoneCheck('05212').type, 'invalid')
  assert.equal(phoneCheck('+1 212 555 0100').type, 'foreign')
  assert.equal(phoneCheck('').type, 'missing')
})

test('nameQuality: full / first-only / suspicious', () => {
  assert.equal(nameQuality('ישראל בן יהודה').quality, 'full'); assert.equal(nameQuality('ישראל בן יהודה').last, 'בן יהודה')
  assert.equal(nameQuality('גיל').quality, 'first-only')
  assert.equal(nameQuality('בדיקת מערכת').quality, 'suspicious')
  assert.equal(nameQuality('test user').quality, 'suspicious')
  assert.equal(nameQuality('aaaa bbbb').quality, 'suspicious')
  assert.equal(nameQuality('Dan Cohen2').quality, 'suspicious')
  assert.equal(nameQuality('').quality, 'missing')
})

test('parseResearchJson: fenced block, trailing prose, plain object', () => {
  assert.deepEqual(parseResearchJson('חיפשתי…\n```json\n{"a":1}\n```\nסיכום'), { a: 1 })
  assert.deepEqual(parseResearchJson('text {"x":{"y":[1,2]}} tail'), { x: { y: [1, 2] } })
  assert.deepEqual(parseResearchJson('```json\n{"first":1}\n```\n```json\n{"last":2}\n```'), { last: 2 })
  assert.equal(parseResearchJson('nothing here'), null)
})

test('normalizeResearch drops claims without a URL and caps everything', () => {
  const r = normalizeResearch({
    identity: { verdict: 'confirmed', confidence: 'high', who: 'עו״ד מהוד השרון', matchedBy: ['שם + עיר', 'שם + טלפון'] },
    profiles: [{ network: 'linkedin', url: 'https://linkedin.com/in/x', title: 'X', confidence: 'high' }, { network: 'facebook', url: 'not a url', title: 'fake' }],
    professional: { occupation: 'עורך דין', company: 'X & Co', sourceUrl: 'javascript:alert(1)' },
    realEstate: { isProfessional: 'yes', signals: ['פרסם דירה ביד2'], listings: [{ url: 'https://yad2.co.il/1', what: 'דירה' }] },
    redFlags: [], hooks: ['משרד בהוד השרון'], opener: 'שלום', dataQuality: 'some', sources: [{ url: 'https://a', title: 'A' }],
  }, { phone: '052-1234567', name: 'דן כהן' })
  assert.equal(r.identity.verdict, 'confirmed'); assert.equal(r.profiles.length, 1)
  assert.equal(r.professional.sourceUrl, ''); assert.equal(r.realEstate.isProfessional, true)
  assert.equal(r.phoneCheck.type, 'mobile'); assert.equal(r.nameCheck.quality, 'full')
  const txt = researchText(r)
  assert.match(txt, /identity: confirmed \(high\)/); assert.match(txt, /linkedin https:\/\/linkedin.com\/in\/x/); assert.match(txt, /PROFESSIONAL/)
  assert.match(researchText({ error: 'no key' }), /not available/)
  const bad = normalizeResearch(null, { phone: '', name: '' })
  assert.equal(bad.identity.verdict, 'unverified'); assert.equal(bad.dataQuality, 'none')
})

test('researchPrompt carries the validated phone and name', () => {
  const p = researchPrompt({ name: 'גיל', phone: '0523456789', msg: 'מתעניין', propLocation: 'הוד השרון' }, { repeats: 2, chatSample: ['היי'] })
  assert.match(p, /\(first-only/); assert.match(p, /\+972523456789 \(mobile, Cellcom\)/); assert.match(p, /repeat inquiries with this number in our system: 2/); assert.match(p, /- היי/)
})

test('researchLead: resumes pause_turn, counts searches, parses the final JSON', async () => {
  const calls = []
  const createClient = () => ({ messages: { create: async params => {
    calls.push(params)
    if (calls.length === 1) return { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'x' } }, { type: 'web_search_tool_result', tool_use_id: 's1', content: [] }] }
    return { stop_reason: 'end_turn', model: 'claude-opus-5', content: [{ type: 'server_tool_use', id: 's2', name: 'web_search', input: { query: 'y' } }, { type: 'text', text: 'ממצאים…\n```json\n{"identity":{"verdict":"likely","confidence":"medium","who":"בעל עסק"},"profiles":[{"network":"website","url":"https://biz.co.il","title":"Biz","confidence":"medium"}],"hooks":["עסק בשרון"],"dataQuality":"some","sources":[{"url":"https://biz.co.il","title":"Biz"}]}\n```' }] }
  } } })
  const r = await researchLead({ name: 'דן כהן', phone: '0521234567' }, { createClient })
  assert.equal(calls.length, 2, 'one pause_turn resume')
  assert.equal(calls[1].messages.length, 2, 'the paused assistant turn was pushed back'); assert.equal(calls[1].messages[1].role, 'assistant')
  assert.equal(calls[0].tools[0].type, 'web_search_20260209'); assert.equal(calls[0].tools[0].max_uses, 8)
  assert.equal(r.searches, 2); assert.equal(r.identity.verdict, 'likely'); assert.equal(r.profiles[0].url, 'https://biz.co.il'); assert.equal(r.truncated, false)
  const bad = await researchLead({ name: 'x' }, { createClient: () => ({ messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'no json' }] }) } }) })
  assert.equal(bad.code, 'parse')
})
