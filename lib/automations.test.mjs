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
