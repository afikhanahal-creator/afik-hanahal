import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMarked, untemplate, withTemplate, withoutOverride } from './template-edit.js'
import { renderTemplate, getTemplate, mergeConfig, templateList } from './automations-shared.js'

const cfg = mergeConfig({})
const lead = { name: 'Amir Menahem', source: 'meta', campaignName: 'זרובבל 15 - v2', created_at: '2026-10-18T10:00:00Z', crm_data: { metaLeadId: '1' } }
const now = new Date('2026-10-18T14:00:00Z')
const marked = id => renderTemplate(getTemplate(cfg, id), lead, cfg, 'he', { keys: true, now })
const plainOf = id => renderTemplate(getTemplate(cfg, id), lead, cfg, 'he', { now })

test('a marked render reads the same as the plain one, with each value named', () => {
  const { plain, spans } = parseMarked(marked('welcome'))
  assert.equal(plain, plainOf('welcome'))
  assert.deepEqual(spans.map(s => s.key), ['name', 'when', 'where', 'property'])
  assert.equal(plain.slice(spans[0].start, spans[0].end), 'אמיר')
})

test('untemplate: values the user kept go back to placeholders, edits stay as typed', () => {
  const m = marked('welcome')
  // unchanged → the placeholders come back
  assert.equal(untemplate(plainOf('welcome'), m), 'היי {name}, מה נשמע?\nראינו שהשארתם לנו פרטים {when} {where} על {property}, אנחנו מאפיק הנחל. יש לכם כמה דקות לשיחה קצרה?')
  // the user rewrote the question and added a line; the name and the project stay placeholders
  const edited = 'היי אמיר, מה נשמע?\nראינו שהשארתם לנו פרטים היום במודעה על זרובבל 15, אנחנו מאפיק הנחל. יש לכם 5 דקות לשיחה היום?\nמחכים לשמוע'
  // (the new "היום" the user typed is just a word: only the value that came from {when} goes back)
  assert.equal(untemplate(edited, m), 'היי {name}, מה נשמע?\nראינו שהשארתם לנו פרטים {when} {where} על {property}, אנחנו מאפיק הנחל. יש לכם 5 דקות לשיחה היום?\nמחכים לשמוע')
  // a value the user changed is not a placeholder any more
  assert.match(untemplate(edited.replace('זרובבל 15', 'זרובבל 17'), m), /על זרובבל 17,/)
  // the prefix letter stays outside the placeholder: "ב{property}"
  assert.match(untemplate(plainOf('welcome_prop'), marked('welcome_prop')), /שהתעניינתם ב\{property\}\./)
})

test('untemplate: a text that was never rendered from a template is returned as is', () => {
  assert.equal(untemplate('סתם הודעה', 'סתם הודעה'), 'סתם הודעה')
})

test('withTemplate saves over the template; withoutOverride restores the built-in wording', () => {
  const tpl = templateList(cfg).find(t => t.id === 'welcome')
  const next = withTemplate(cfg, tpl, { he: 'היי {name}, נוסח חדש' })
  assert.equal(templateList(next).find(t => t.id === 'welcome').he, 'היי {name}, נוסח חדש')
  assert.equal(templateList(next).find(t => t.id === 'welcome').en, tpl.en)
  assert.equal(cfg.templates?.welcome, undefined)   // the input config is untouched
  assert.equal(templateList(withoutOverride(next, 'welcome')).find(t => t.id === 'welcome').he, tpl.he)
  const copy = withTemplate(cfg, tpl, { id: 'c_x', he_title: 'פתיחה – שלי' })
  assert.ok(templateList(copy).find(t => t.id === 'c_x' && !t.builtIn && t.he_title === 'פתיחה – שלי'))
  const undeleted = withTemplate({ ...cfg, deletedTemplates: ['welcome'] }, tpl, {})
  assert.ok(templateList(undeleted).find(t => t.id === 'welcome'))
})
