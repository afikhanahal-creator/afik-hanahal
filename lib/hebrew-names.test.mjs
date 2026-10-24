import test from 'node:test'
import assert from 'node:assert/strict'
import { hebrewFullName, hebrewWord } from './hebrew-names.js'
import { renderTemplate } from './automations-shared.js'

test('a Latin full name is written in Hebrew', () => {
  const cases = {
    'Daniel cohen': 'דניאל כהן',
    'Rachel Collins': 'רחל קולינס',
    'Limor Shahrabani-Gargir': 'לימור שהרבני-גרגיר',
    'Dr. Michael Elyashiv': 'ד"ר מיכאל אלישיב',
    'roy sasi': 'רועי ששי',
    'Noambar': 'נועם-בר',
    'Haya Barazi17@alla.com': 'חיה ברזי',
    'Yuval12': 'יובל',
  }
  for (const [en, he] of Object.entries(cases)) assert.equal(hebrewFullName(en), he, en)
})

test('Hebrew names, emails, junk and test leads stay as they were', () => {
  for (const s of ['רונן כהן', 'swiener60@gmail.com', 'v and something liked', 'hz', '<test lead: dummy data for full_name>', ''])
    assert.equal(hebrewFullName(s), s)
  assert.equal(hebrewFullName('Ronen Cohen · זרובבל 15'), 'רונן כהן · זרובבל 15')
})

test('an unknown word is transliterated with final letters', () => {
  const he = hebrewWord('Goldstein')
  assert.equal(he, 'גולדשטיין')
  assert.match(hebrewWord('Kaplan'), /ן$/)
})

test('an English message keeps the name as typed', () => {
  const tpl = { he: 'היי {name}', en: 'Hi {name}' }
  const lead = { name: 'רונן כהן', crm_data: { originalName: 'Ronen Cohen' } }
  assert.equal(renderTemplate(tpl, lead, undefined, 'en'), 'Hi Ronen')
  assert.equal(renderTemplate(tpl, lead, undefined, 'he'), 'היי רונן')
})
