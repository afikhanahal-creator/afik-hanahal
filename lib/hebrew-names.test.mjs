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

test('the safety net writes a recent Latin name in Hebrew and keeps the typed one', async () => {
  const { hebrewNamePatch } = await import('./hebrew-lead-names.js')
  assert.deepEqual(hebrewNamePatch({ name: 'Suzanne' }, 'meta_leads'), { name: 'סוזנה' })
  const p = hebrewNamePatch({ name: 'Suzanne', crm_data: { metaLeadId: '1', name: 'Suzanne' } })
  assert.equal(p.name, 'סוזנה'); assert.equal(p.crm_data.originalName, 'Suzanne'); assert.equal(p.crm_data.name, 'סוזנה'); assert.equal(p.crm_data.metaLeadId, '1')
  assert.equal(hebrewNamePatch({ name: 'סוזנה' }), null)
  assert.equal(hebrewNamePatch({ name: 'swiener60@gmail.com' }), null)
  assert.equal(hebrewNamePatch({ name: '<test lead: dummy data for full_name>' }), null)
})
