import test from 'node:test'
import assert from 'node:assert/strict'
import { englishProject, englishValue, englishFirstName } from './english-values.js'
import { DEFAULT_TEMPLATES, renderTemplate, getTemplate, mergeConfig } from './automations-shared.js'

test('Hebrew values come out in English', () => {
  assert.equal(englishProject('זרובבל 15 - v2 (כוונה גבוהה)'), '15 Zerubavel Street')
  assert.equal(englishProject('הנרייטה סאלד 3#'), '3 Henrietta Szold Street')
  assert.equal(englishProject('פרויקט לא מוכר'), '')
  assert.equal(englishValue('5 מיליון ומעלה'), '₪5 million+')
  assert.equal(englishValue('3-4_מיליון'), '₪3–4 million')
  assert.equal(englishValue('3 חדרים'), '3 rooms')
  assert.equal(englishValue('פנטהאוז'), 'penthouse')
  assert.equal(englishValue('הוד השרון'), 'Hod Hasharon')
  assert.equal(englishValue('משהו אחר'), '')
  assert.equal(englishFirstName('סוזנה', 'Suzanne'), 'Suzanne')
  assert.equal(englishFirstName('רונן משעל'), 'Ronen')
})

test('an English message never carries a Hebrew word', () => {
  const cfg = mergeConfig({})
  const now = new Date('2026-10-24T19:30:00Z')
  const lead = { name: 'סוזנה', source: 'meta', campaignName: 'זרובבל 15 - v2 (כוונה גבוהה)', created_at: '2026-10-24T19:02:00Z', prop_location: 'הוד השרון',
    crm_data: { metaLeadId: '9', originalName: 'Suzanne', formAnswers: [{ q: 'כמה חדרים?', a: 'פנטהאוז' }, { q: 'מה התקציב?', a: '5 מיליון ומעלה' }], propertyType: 'משהו שכתבו בעצמם על הבית שהם רוצים' } }
  const welcome = renderTemplate(getTemplate(cfg, 'welcome_prop'), lead, cfg, 'en', { now })
  assert.equal(welcome.split('\n')[0], 'Hi Suzanne, thanks for leaving your details today on our ad about 15 Zerubavel Street.')
  assert.match(welcome, /looking for a penthouse, with a budget of ₪5 million\+/)
  for (const t of DEFAULT_TEMPLATES) {
    const out = renderTemplate(t, lead, cfg, 'en', { now })
    assert.doesNotMatch(out, /[֐-׿]/, `${t.id}: ${out}`)
    assert.doesNotMatch(out, /\bI\b/, `${t.id}: "I"`)
  }
})
