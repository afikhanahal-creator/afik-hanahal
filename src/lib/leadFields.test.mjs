import { test } from 'node:test'
import assert from 'node:assert/strict'
import { metaFormAnswers, answersToText, originLines, sourceLabel } from './leadFields.js'

test('Meta raw_fields → custom answers only (standard name/phone/email excluded)', () => {
  const raw = [
    { name: 'full_name', values: ['ישראל ישראלי'] },
    { name: 'phone_number', values: ['+972501234567'] },
    { name: 'email', values: ['a@b.co.il'] },
    { name: 'מה_התקציב_שלך?', values: ['2-3 מיליון'] },
    { name: 'איזה_סוג_נכס_מעניין_אותך?', values: ['צמוד קרקע', 'מגרש'] },
    { name: 'city', values: ['כפר סבא'] },
    { name: 'empty_question', values: [''] },
  ]
  const a = metaFormAnswers(raw)
  assert.deepEqual(a, [
    { q: 'מה התקציב שלך?', a: '2-3 מיליון' },
    { q: 'איזה סוג נכס מעניין אותך?', a: 'צמוד קרקע, מגרש' },
    { q: 'עיר', a: 'כפר סבא' },
  ])
  assert.equal(metaFormAnswers(raw, 'en')[2].q, 'City')
  assert.equal(answersToText(a), 'מה התקציב שלך?: 2-3 מיליון · איזה סוג נכס מעניין אותך?: צמוד קרקע, מגרש · עיר: כפר סבא')
  assert.deepEqual(metaFormAnswers(null), [])
})

test('website origin → readable lines, both languages', () => {
  const o = { page: '/#properties', referrer: 'https://www.google.com/', lang: 'he', device: 'mobile', utm: { utm_source: 'facebook', utm_campaign: 'sharon-sept' } }
  const he = originLines(o, 'he'), en = originLines(o, 'en')
  assert.equal(he.length, 6)
  assert.equal(he[0].q, 'עמוד'); assert.equal(en[0].q, 'Page')
  assert.ok(he.some(x => x.q === 'UTM campaign' && x.a === 'sharon-sept'))
  assert.deepEqual(originLines(undefined), [])
})

test('source labels are bilingual and tolerate unknown values', () => {
  assert.equal(sourceLabel('property_form'), 'טופס נכס')
  assert.equal(sourceLabel('property_form', 'en'), 'Property form')
  assert.equal(sourceLabel('meta', 'en'), 'Meta (Facebook)')
  assert.equal(sourceLabel('zapier'), 'zapier')
  assert.equal(sourceLabel('', 'en'), 'Unknown')
})

test('leadCampaign: a short campaign name, or just "אתר" for website leads', async () => {
  const { leadCampaign, leadCampaignFull, shortCampaign } = await import('./leadFields.js')
  assert.equal(leadCampaign({ campaignName: '', formName: 'זרובבל 15 - v2 (כוונה גבוהה)' }), 'זרובבל 15')
  assert.equal(leadCampaign({ campaignName: 'זרובבל 15 #2', formName: 'x' }), 'זרובבל 15')
  assert.equal(leadCampaign({ crm_data: { formName: 'הנרייטה סאלד 22-24-copy' } }), 'הנרייטה סאלד 22-24')
  assert.equal(leadCampaign({ formName: 'פיקוח הבניה של שכינתא' }), 'פיקוח הבניה של שכינתא')
  assert.equal(shortCampaign('חנקין 41 | ריטרגטינג'), 'חנקין 41')
  assert.equal(shortCampaign('זרובבל 15 v2'), 'זרובבל 15')
  assert.equal(shortCampaign('(כוונה גבוהה)'), '(כוונה גבוהה)')
  assert.equal(leadCampaign({ source: 'contact_form', origin: { utm: { utm_source: 'chatgpt.com', utm_campaign: 'prop-1' } } }), 'אתר')
  assert.equal(leadCampaign({ source: 'website' }, 'en'), 'Website')
  assert.equal(leadCampaign({ origin: { page: '/' } }), 'אתר')
  assert.equal(leadCampaign({ source: 'manual' }), 'ידני')
  assert.equal(leadCampaign({ id: 'meta_12' }), 'פייסבוק')
  assert.equal(leadCampaign({}), '')
  assert.equal(leadCampaign(null), '')
  assert.equal(leadCampaignFull({ formName: 'זרובבל 15 - v2 (כוונה גבוהה)' }), 'זרובבל 15 - v2 (כוונה גבוהה)')
  assert.equal(leadCampaignFull({ source: 'contact_form' }), 'אתר')
})

test('form option codes read as words', async () => {
  const { prettyAnswerValue, prettyLeadText, metaFormAnswers } = await import('./leadFields.js')
  assert.equal(prettyAnswerValue('3r'), '3 חדרים')
  assert.equal(prettyAnswerValue('b34'), '3–4 מיליון')
  assert.equal(prettyAnswerValue('b5'), '5 מיליון ומעלה')
  assert.equal(prettyAnswerValue('ph'), 'פנטהאוז')
  assert.equal(prettyAnswerValue('garden', 'en'), 'Garden apartment')
  assert.equal(prettyAnswerValue('2-3 מיליון'), '2-3 מיליון')
  assert.equal(prettyLeadText('rooms: 3r • budget: b34'), 'חדרים: 3 חדרים • תקציב: 3–4 מיליון')
  assert.deepEqual(metaFormAnswers([{ name: 'rooms', values: ['2r'] }, { name: 'budget', values: ['b45'] }]), [{ q: 'חדרים', a: '2 חדרים' }, { q: 'תקציב', a: '4–5 מיליון' }])
})
