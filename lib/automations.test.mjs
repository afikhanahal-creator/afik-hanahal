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
  assert.match(he, /^שלום גיל,/)
  assert.match(he, /ההתעניינות במגרש בתל מונד/)
  assert.match(he, /\nישראל$/)
  const en = renderTemplate(getTemplate(cfg, 'welcome'), { name: 'John Smith', crm_data: { origin: { lang: 'en' } } }, cfg)
  assert.match(en, /^Hello John,/)
  const noName = renderTemplate(getTemplate(cfg, 'nr1'), { name: '' }, cfg)
  assert.match(noName, /^שלום,\nרצינו לוודא/)
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

test('Hebrew messages write English first names in Hebrew, and drop unknown Latin names', async () => {
  const { hebrewFirstName } = await import('./hebrew-names.js')
  assert.equal(hebrewFirstName('Ronen'), 'רונן'); assert.equal(hebrewFirstName('hila'), 'הילה'); assert.equal(hebrewFirstName('SHAY'), 'שי')
  assert.equal(hebrewFirstName('Xqzt'), ''); assert.equal(hebrewFirstName('רונן'), '')
  const cfg = mergeConfig({})
  const tpl = getTemplate(cfg, 'nr_short')
  assert.match(renderTemplate(tpl, { name: 'Ronen Mishal', prop_title: 'חנקין 41' }, cfg), /^שלום רונן, האם/)
  assert.match(renderTemplate(tpl, { name: 'hila pal sorany' }, cfg), /^שלום הילה,/)
  assert.match(renderTemplate(tpl, { name: 'Xqzt Brown' }, cfg), /^שלום, האם/)
  assert.match(renderTemplate(tpl, { name: 'Ronen', crm_data: { origin: { lang: 'en' } } }, cfg), /^Hello Ronen,/)
  assert.equal(renderTemplate(getTemplate(cfg, 'closing_polite'), { name: 'Xqzt' }, cfg).split('\n')[0], 'תודה על העדכון.')
  // no childish emoji left in the built-in Hebrew library
  for (const t of DEFAULT_TEMPLATES) assert.doesNotMatch(t.he, /[\u{1F44B}\u{1F642}\u{1F64C}\u{1F389}\u{1F64F}\u{1F525}]/u, t.id)
})

test('personal templates read what the lead told us, and drop the parts we don\'t know', async () => {
  const { leadNeeds, bestPersonalTemplateId } = await import('./lead-needs.js')
  const cfg = mergeConfig({})
  const meta = { name: 'Ronen Mishal', source: 'meta', prop_title: 'זרובבל 15 - v2', crm_data: { metaLeadId: '1', formAnswers: [{ q: 'כמה חדרים?', a: '4r' }, { q: 'מה התקציב?', a: 'b34' }] } }
  assert.equal(leadNeeds(meta).needs, '4 חדרים, בתקציב של 3–4 מיליון')
  assert.equal(bestPersonalTemplateId(meta), 'personal_needs')
  assert.match(renderTemplate(getTemplate(cfg, 'personal_needs'), meta, cfg), /ראינו שאתם מחפשים 4 חדרים, בתקציב של 3–4 מיליון\./)
  const bare = renderTemplate(getTemplate(cfg, 'personal_needs'), { name: 'דנה' }, cfg)
  assert.doesNotMatch(bare, /ראינו|\[\[|\{/)
  assert.match(bare, /לגבי הנכס\./)
  assert.match(renderTemplate(getTemplate(cfg, 'personal_budget'), { name: 'דנה' }, cfg), /ההתעניינות בנכס\./)   // not "בהנכס"
  const web = { name: 'גיל', source: 'website', message: 'מחפש מגרש לבנייה עצמית בהוד השרון. תודה' }
  assert.equal(leadNeeds(web).message, 'מחפש מגרש לבנייה עצמית בהוד השרון')
  assert.equal(bestPersonalTemplateId(web), 'personal_message')
  const card = { name: 'אבי', dealType: 'invest', budget: 2500000, timeline: 'soon', rooms: '5', area: 'כפר סבא' }
  assert.deepEqual([leadNeeds(card).purpose, leadNeeds(card).timeline, leadNeeds(card).needs], ['השקעה', 'בחודשים הקרובים', '5 חדרים, בכפר סבא, בתקציב של כ-2.5 מיליון ₪'])
  assert.equal(bestPersonalTemplateId(card), 'personal_investor')
  assert.equal(bestPersonalTemplateId({ name: 'x' }), null)
  // a Meta lead's stored answers line is never quoted as "what they wrote"
  assert.equal(leadNeeds({ source: 'meta', message: 'rooms: 3r · budget: b34' }).message, '')
})
