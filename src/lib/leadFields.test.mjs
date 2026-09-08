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
