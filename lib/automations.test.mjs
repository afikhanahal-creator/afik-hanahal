import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyReply, renderTemplate, isSendWindow, mergeConfig, templateList, getTemplate, DEFAULT_CONFIG, DEFAULT_TEMPLATES, leadLang } from './automations-shared.js'

test('reply intent: "no thanks" wins over polite words, positive and plain replies', () => {
  assert.equal(classifyReply('לא, תודה. כבר מצאתי'), 'negative')
  assert.equal(classifyReply('תודה רבה!'), 'reply')
  assert.equal(classifyReply('כן אשמח לשמוע פרטים'), 'positive')
  assert.equal(classifyReply('מתי אפשר לתאם סיור?'), 'positive')
  assert.equal(classifyReply('STOP'), 'negative')
  assert.equal(classifyReply('Yes please, call me'), 'positive')
  assert.equal(classifyReply('   '), null)
  assert.equal(classifyReply('כנראה בשבוע הבא'), 'reply')   // "כן" must match as a whole word only
})

test('templates render per lead, in the lead language, with graceful fallbacks', () => {
  const cfg = mergeConfig({ vars: { agent: 'ישראל' } })
  const he = renderTemplate(getTemplate(cfg, 'welcome_prop'), { name: 'גיל כהן', prop_title: 'מגרש בתל מונד' }, cfg)
  assert.match(he, /^היי גיל 👋/)
  assert.match(he, /בהתעניינות|ההתעניינות במגרש בתל מונד/)
  assert.match(he, /ישראל · אפיק הנחל$/)
  const en = renderTemplate(getTemplate(cfg, 'welcome'), { name: 'John Smith', crm_data: { origin: { lang: 'en' } } }, cfg)
  assert.match(en, /^Hi John 👋/)
  const noName = renderTemplate(getTemplate(cfg, 'nr1'), { name: '' }, cfg)
  assert.match(noName, /^היי, רק מוודא/)
  assert.equal(leadLang({ origin: { lang: 'en' } }), 'en')
})

test('every built-in template is bilingual', () => {
  for (const t of DEFAULT_TEMPLATES) {
    assert.ok(t.he && t.en, `${t.id} text`)
    assert.ok(t.he_title && t.en_title, `${t.id} title`)
  }
})

test('config merge keeps defaults, applies overrides, hides deleted templates', () => {
  const cfg = mergeConfig({ rules: { noReply: { mode: 'auto' } }, templates: { nr1: { he: 'חדש' }, c_x: { he_title: 'שלי', he: 'x', en: 'x' } }, deletedTemplates: ['holiday'] })
  assert.equal(cfg.rules.noReply.mode, 'auto')
  assert.equal(cfg.rules.noReply.steps.length, 3)
  assert.equal(cfg.rules.welcome.mode, 'auto')
  const list = templateList(cfg)
  assert.equal(list.find(t => t.id === 'nr1').he, 'חדש')
  assert.ok(list.find(t => t.id === 'c_x' && !t.builtIn))
  assert.ok(!list.find(t => t.id === 'holiday'))
})

test('quiet hours follow Israel time and close on Saturday', () => {
  const cfg = DEFAULT_CONFIG
  assert.equal(isSendWindow(cfg, new Date('2026-09-23T08:00:00Z')), true)    // Wed 11:00 Israel
  assert.equal(isSendWindow(cfg, new Date('2026-09-23T20:30:00Z')), false)   // Wed 23:30 Israel
  assert.equal(isSendWindow(cfg, new Date('2026-09-26T09:00:00Z')), false)   // Saturday
  assert.equal(isSendWindow(cfg, new Date('2026-09-25T11:30:00Z')), false)   // Fri 14:30 Israel
  assert.equal(isSendWindow({ quiet: { enabled: false } }, new Date('2026-09-26T09:00:00Z')), true)
})

test('next sending window skips the night and Shabbat', async () => {
  const { nextSendWindow, templateUsage } = await import('./automations-shared.js')
  const cfg = DEFAULT_CONFIG
  const inside = new Date('2026-09-23T08:00:00Z')                        // Wed 11:00 Israel
  assert.equal(nextSendWindow(cfg, inside).getTime(), inside.getTime())
  assert.equal(nextSendWindow(cfg, new Date('2026-09-23T20:30:00Z')).toISOString(), '2026-09-24T06:00:00.000Z')  // → Thu 09:00
  assert.equal(nextSendWindow(cfg, new Date('2026-09-25T11:30:00Z')).toISOString(), '2026-09-27T06:00:00.000Z')  // Fri 14:30 → Sun 09:00
  assert.equal(nextSendWindow({ quiet: { enabled: true, days: {} } }), null)
  const uses = templateUsage(cfg, 'nr2').map(u => u.key)
  assert.deepEqual(uses, ['noreply:2'])
  assert.ok(templateUsage(cfg, 'won_thanks').some(u => u.key === 'stage:won'))
  assert.deepEqual(templateUsage(cfg, 'holiday'), [])
})

test('{property} = the short campaign name for Meta leads, the listing title for website leads', () => {
  const cfg = mergeConfig({})
  const tpl = { he: 'שאלה על {property}?', en: 'About {property}?' }
  const meta = { name: 'דנה', source: 'meta', prop_title: 'זרובבל 15 - v2 (כוונה גבוהה)', crm_data: { metaLeadId: '7' } }
  assert.equal(renderTemplate(tpl, meta, cfg), 'שאלה על זרובבל 15?')
  assert.equal(renderTemplate(tpl, { name: 'דנה', campaignName: 'הנרייטה סאלד 22-24 - ריטרגטינג' }, cfg), 'שאלה על הנרייטה סאלד 22-24?')
  assert.equal(renderTemplate(tpl, { name: 'דנה', source: 'meta', prop_title: 'Meta', crm_data: { formName: 'חנקין 41 (copy)' } }, cfg), 'שאלה על חנקין 41?')
  assert.equal(renderTemplate(tpl, { name: 'גיל', source: 'website', prop_title: 'מגרש - תל מונד' }, cfg), 'שאלה על מגרש - תל מונד?')
})

test('parseQuota reads Green API 466 bodies; quotaPaused holds for an hour', async () => {
  const { parseQuota, quotaPaused, QUOTA_PAUSE_MS, missedWelcome } = await import('./automations.js')
  const q = parseQuota('{"invokeStatus":{"method":"sendmessage","used":88,"total":0,"status":"QUOTE_ALLOWED","description":"Monthly quota has been exceeded."}}')
  assert.equal(q.used, 88); assert.equal(q.total, 0); assert.match(q.description, /Monthly quota/)
  const now = Date.parse('2026-10-18T10:00:00Z')
  assert.equal(quotaPaused({ blocked: true, at: '2026-10-18T09:30:00Z' }, now), true)
  assert.equal(quotaPaused({ blocked: true, at: new Date(now - QUOTA_PAUSE_MS - 1000).toISOString() }, now), false)
  assert.equal(quotaPaused({ blocked: false }, now), false)
  // missed welcomes: failed here, or the Meta pipeline's welcome failed; never after it went out / was skipped / they replied
  assert.equal(missedWelcome({ crm_data: { auto: { welcomeFailed: 'x' } } }), true)
  assert.equal(missedWelcome({ crm_data: { metaLeadId: '7', auto: { skipped: { welcome: 'x' } } } }, new Set(['7'])), true)
  assert.equal(missedWelcome({ crm_data: { metaLeadId: '8', auto: { skipped: { welcome: 'x' } } } }, new Set(['7'])), false)
  assert.equal(missedWelcome({ crm_data: { auto: { welcomeFailed: 'x', sent: { welcome: 'y' } } } }), false)
  assert.equal(missedWelcome({ crm_data: { auto: { welcomeFailed: 'x', skipped: { 'welcome:missed': 'y' } } } }), false)
  assert.equal(missedWelcome({ crm_data: { auto: { welcomeFailed: 'x', replied: true } } }), false)
})
