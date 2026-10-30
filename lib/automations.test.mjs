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
  assert.match(he, /^היי גיל, ראינו את הפנייה על מגרש בתל מונד\./)
  assert.doesNotMatch(he, /אפיק הנחל/)   // the project says who we are; no office formula
  const en = renderTemplate(getTemplate(cfg, 'welcome'), { name: 'John Smith', crm_data: { origin: { lang: 'en' } } }, cfg, undefined, { now: new Date('2026-10-18T05:30:00Z') })
  assert.match(en, /^Hi John, thanks for your details\. This is Afik Hanahal\.\nCould we call you today for a few minutes\?/)
  const noName = renderTemplate(getTemplate(cfg, 'nr1'), { name: '' }, cfg)
  assert.match(noName, /^היי, רק מוודאים/)
  // no signature name → the signature line is left out, never an empty line
  const noAgent = mergeConfig({ vars: { agent: '' } })
  assert.match(renderTemplate(getTemplate(noAgent, 'nr3'), { name: 'גיל' }, noAgent), /תכתבו לנו כאן\.$/)
  assert.match(renderTemplate(getTemplate(cfg, 'holiday'), { name: 'גיל' }, cfg), /\nישראל$/)   // a holiday greeting signs; a no-reply nudge doesn't
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
  assert.match(renderTemplate(tpl, { name: 'Ronen Mishal', prop_title: 'חנקין 41' }, cfg), /^היי רונן, מה אתם אומרים על חנקין 41\?/)
  assert.match(renderTemplate(tpl, { name: 'hila pal sorany' }, cfg), /^היי הילה,/)
  assert.match(renderTemplate(tpl, { name: 'Xqzt Brown' }, cfg), /^היי, מה אתם אומרים\?/)
  assert.match(renderTemplate(tpl, { name: 'Ronen', crm_data: { origin: { lang: 'en' } } }, cfg), /^Hi Ronen,/)
  assert.equal(renderTemplate(getTemplate(cfg, 'closing_polite'), { name: 'Xqzt' }, cfg).split('\n')[0], 'תודה שעדכנתם, באמת. לא נטריד יותר.')
  // no childish emoji left in the built-in Hebrew library
  for (const t of DEFAULT_TEMPLATES) assert.doesNotMatch(t.he, /[\u{1F44B}\u{1F642}\u{1F64C}\u{1F389}\u{1F64F}\u{1F525}]/u, t.id)
})

test('personal templates read what the lead told us, and drop the parts we don\'t know', async () => {
  const { leadNeeds, bestPersonalTemplateId } = await import('./lead-needs.js')
  const cfg = mergeConfig({})
  const meta = { name: 'Ronen Mishal', source: 'meta', prop_title: 'זרובבל 15 - v2', crm_data: { metaLeadId: '1', formAnswers: [{ q: 'כמה חדרים?', a: '4r' }, { q: 'מה התקציב?', a: 'b34' }] } }
  assert.equal(leadNeeds(meta).needs, '4 חדרים, בתקציב של 3–4 מיליון')
  assert.equal(bestPersonalTemplateId(meta), 'personal_needs')
  assert.match(renderTemplate(getTemplate(cfg, 'personal_needs'), meta, cfg), /ראינו שאתם מחפשים 4 חדרים, בתקציב של 3–4 מיליון, ויש לנו/)
  const bare = renderTemplate(getTemplate(cfg, 'personal_needs'), { name: 'דנה' }, cfg)
  assert.doesNotMatch(bare, /ראינו|לזה|\[\[|\{/)
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

test('{greeting} follows the hour in Israel', async () => {
  const { timeGreeting } = await import('./automations-shared.js')
  assert.equal(timeGreeting('he', new Date('2026-10-18T06:00:00Z')), 'בוקר טוב')        // 09:00
  assert.equal(timeGreeting('he', new Date('2026-10-18T11:00:00Z')), 'צהריים טובים')    // 14:00
  assert.equal(timeGreeting('he', new Date('2026-10-18T17:00:00Z')), 'ערב טוב')          // 20:00
  assert.equal(timeGreeting('en', new Date('2026-10-18T22:00:00Z')), 'Hi')               // 01:00
})

test('the library sounds like a person, not a system', () => {
  const BOT_HE = ['–', '•', 'נשמח לעמוד לרשות', 'לכל שאלה נוספת', 'בצורה המיטבית', 'מידע מותאם', 'פנייתך', 'הננו', 'לא נרצה להטריד', 'צוות אפיק הנחל', '/י', '/ה ']
  const BOT_EN = ['–', '•', 'We would be glad', 'do not hesitate', 'earliest convenience', 'Dear ', 'valued customer', 'The Afik Hanahal team']
  for (const t of DEFAULT_TEMPLATES) {
    for (const w of BOT_HE) assert.ok(!t.he.includes(w), `${t.id}: "${w}"`)
    for (const w of BOT_EN) assert.ok(!t.en.includes(w), `${t.id}: "${w}"`)
    assert.ok(!/\n\n\{agent\}$/.test(t.he), `${t.id}: a team-style signature block`)
    assert.ok(t.he.length <= 110, `${t.id}: ${t.he.length} chars – keep WhatsApp messages short (two short lines)`)
    if (t.cat === 'welcome') assert.ok(t.he.replace(/\{bookingLink\}/, '').length <= 100, `${t.id}: a first message is the shortest`)
    assert.ok(t.he.split('\n').filter(l => !/^\{\w+\}\]*$|^\[\[$/.test(l.trim())).length <= 2, `${t.id}: at most 2 lines`)
  }
})

test('{when} / {where}: the welcome says when and where the lead left their details', async () => {
  const { leadWhen, leadWhere } = await import('./automations-shared.js')
  const now = new Date('2026-10-18T17:30:00Z')                                   // Sunday 20:30 Israel
  assert.equal(leadWhen({ created_at: '2026-10-18T06:00:00Z' }, 'he', now), 'היום')
  assert.equal(leadWhen({ created_at: '2026-10-17T19:10:00Z' }, 'he', now), 'אתמול')
  assert.equal(leadWhen({ ts: Date.parse('2026-10-14T09:00:00Z') }, 'he', now), 'ביום רביעי')
  assert.equal(leadWhen({ ts: Date.parse('2026-10-14T09:00:00Z') }, 'en', now), 'on Wednesday')
  assert.equal(leadWhen({ created_at: '2026-10-01T09:00:00Z' }, 'he', now), '')
  assert.equal(leadWhere({ source: 'meta' }), 'במודעה'); assert.equal(leadWhere({ source: 'contact_form' }), 'באתר'); assert.equal(leadWhere({ source: 'manual' }), '')
  const cfg = mergeConfig({})
  const meta = { name: 'Ronen Mishal', source: 'meta', campaignName: 'זרובבל 15 - v2', created_at: '2026-10-17T19:10:00Z', crm_data: { metaLeadId: '1' } }
  assert.equal(renderTemplate(getTemplate(cfg, 'welcome'), meta, cfg, undefined, { now }).split('\n')[0], 'היי רונן, ראינו שהשארתם פרטים על זרובבל 15, אנחנו מאפיק הנחל.')
  assert.equal(renderTemplate(getTemplate(cfg, 'welcome'), { name: '' }, cfg, undefined, { now }), 'היי, ראינו שהשארתם פרטים, אנחנו מאפיק הנחל.\nאפשר להתקשר היום לכמה דקות?')
})

test('the office writes as "we", and speaks to the lead in plural', () => {
  // first person singular (one agent) and singular "you" — both read as one person, not the Afik Hanahal page
  const SINGULAR = ['ראיתי', 'קיבלתי', 'רציתי', 'ניסיתי', 'אשמח', 'אשלח', 'אתקשר', 'אעדכן', 'אני', 'לך', 'שלך', 'אליך', 'איתך', 'אותך', 'ממך', 'בשבילך', 'השארת', 'התעניינת', 'שכתבת', 'חיפשת']
  for (const t of DEFAULT_TEMPLATES) {
    for (const w of SINGULAR) assert.doesNotMatch(t.he, new RegExp(`(^|[\\s,.!?:"(])${w}([\\s,.!?:")]|$)`), `${t.id}: "${w}"`)
    assert.doesNotMatch(t.en, /(^|\s)I('m|'ll|'d|'ve)?\s/, `${t.id}: "I"`)
  }
})

test('every message is about the lead, not about the office', () => {
  const cfg = mergeConfig({})
  // the office's name: in a handful of templates only (a first message without a project, a late or a months-later
  // message, a review request), once, and never as the opening words
  const named = DEFAULT_TEMPLATES.filter(t => /אפיק הנחל/.test(t.he))
  assert.ok(named.length <= 4, `the office is named in ${named.map(t => t.id)}`)
  for (const t of DEFAULT_TEMPLATES) {
    assert.ok((t.he.match(/אפיק הנחל/g) || []).length <= 1, `${t.id}: the office named twice`)
    assert.ok((t.en.match(/Afik Hanahal/g) || []).length <= 1, `${t.id}: the office named twice (en)`)
    assert.doesNotMatch(t.he, /^(\{greeting\}|היי)?[^\n]{0,14}(כאן |מ)?אפיק הנחל/, `${t.id}: opens with the office`)
    assert.equal(/אפיק הנחל/.test(t.he), /Afik Hanahal/.test(t.en), `${t.id}: he / en differ`)
  }
  // a first message or a follow-up says why we write: what they asked about or what they look for
  const ABOUT = /\{(property|needs|message|budget|timeline|purpose)\}|פרטים|פנייה/
  for (const t of DEFAULT_TEMPLATES.filter(t => ['welcome', 'personal'].includes(t.cat))) assert.match(t.he, ABOUT, t.id)
  // and with what the lead told us, the automatic welcome uses it
  const meta = { name: 'Ronen Mishal', source: 'meta', campaignName: 'זרובבל 15 - v2', created_at: '2026-10-17T19:10:00Z', crm_data: { metaLeadId: '1', formAnswers: [{ q: 'כמה חדרים?', a: '4r' }, { q: 'מה התקציב?', a: 'b34' }] } }
  const now = new Date('2026-10-18T17:30:00Z')
  // the first message is short: the project, one question (what they look for waits for the personal templates)
  assert.equal(renderTemplate(getTemplate(cfg, 'welcome_prop'), meta, cfg, undefined, { now }),
    'היי רונן, ראינו את הפנייה על זרובבל 15.\nלשלוח תוכניות ומחירים, או שנדבר בטלפון?')
  assert.match(renderTemplate(getTemplate(cfg, 'personal_needs'), meta, cfg, undefined, { now }), /4 חדרים, בתקציב של 3–4 מיליון/)
  const bare = renderTemplate(getTemplate(cfg, 'welcome_prop'), { name: 'דנה' }, cfg, undefined, { now })
  assert.equal(bare.split('\n')[0], 'היי דנה, ראינו את הפנייה.')
})

test('the template windows open on the category of the lead\'s stage, in pipeline order', async () => {
  const { stageCategory, CATEGORIES } = await import('./automations-shared.js')
  assert.deepEqual(CATEGORIES.slice(0, 5).map(c => c.short), ['פתיחה', 'נוצר קשר', 'מתעניין', 'רוצה להתקדם', 'לא ענה'])
  assert.equal(stageCategory({ leadStatus: 'discovery' }, { hasOut: false }), 'welcome')        // nothing sent yet
  assert.equal(stageCategory({ leadStatus: 'new' }, { hasOut: true, hasIn: false }), 'followup')  // got our message, never answered
  assert.equal(stageCategory({ leadStatus: 'new' }, { hasOut: true, hasIn: true }), 'contacted')
  assert.equal(stageCategory({ crm_data: { leadStatus: 'discovery' } }), 'interested')
  assert.equal(stageCategory({ leadStatus: 'lost' }), 'followup')                                 // "ללא מענה"
  assert.equal(stageCategory({ leadStatus: 'meeting' }), 'progress')
  for (const c of CATEGORIES) assert.ok(c.he && c.en && c.short && c.en_short, c.id)
})

test('a project can have its own welcome (its own picture goes only to its leads)', async () => {
  const { welcomeTemplateId } = await import('./automations-shared.js')
  const cfg = mergeConfig({
    rules: { welcome: { mode: 'auto', templateId: 'welcome', propTemplateId: 'welcome_prop', byProject: { 'זרובבל 15': 'c_z15', 'חנקין 41': 'missing_tpl' } } },
    templates: { c_z15: { cat: 'welcome', he_title: 'פתיחה – זרובבל 15', en_title: 'Welcome – 15 Zerubavel', he: 'היי {name}, קיבלנו את הפרטים על {property}. נוח שנתקשר היום?', en: 'Hi {name}, we got your details. Is today a good time for a call?', image: 'https://x.supabase.co/storage/v1/object/public/property-media/templates/z15.jpg' } },
  })
  const z15 = { name: 'דנה', source: 'meta', campaignName: 'זרובבל 15 - v2 (כוונה גבוהה)', crm_data: { metaLeadId: '1' } }
  assert.equal(welcomeTemplateId(cfg, z15), 'c_z15')
  assert.equal(welcomeTemplateId(cfg, { ...z15, campaignName: 'הנרייטה סאלד 22' }), 'welcome_prop')   // another project: no Zerubavel picture
  assert.equal(welcomeTemplateId(cfg, { ...z15, campaignName: 'חנקין 41' }), 'welcome_prop')             // its template is gone: the general project one
  assert.equal(welcomeTemplateId(cfg, { name: 'דנה' }), 'welcome')
})
