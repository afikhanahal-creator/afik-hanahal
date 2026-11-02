import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMarked, untemplate, withTemplate, withoutOverride, addFilesToTemplate } from './template-edit.js'
import { renderTemplate, getTemplate, mergeConfig, templateList } from './automations-shared.js'

const cfg = mergeConfig({})
const lead = { name: 'Amir Menahem', source: 'meta', campaignName: 'זרובבל 15 - v2', created_at: '2026-10-18T10:00:00Z', crm_data: { metaLeadId: '1' } }
const now = new Date('2026-10-18T14:00:00Z')
const marked = id => renderTemplate(getTemplate(cfg, id), lead, cfg, 'he', { keys: true, now })
const plainOf = id => renderTemplate(getTemplate(cfg, id), lead, cfg, 'he', { now })

test('a marked render reads the same as the plain one, with each value named', () => {
  const { plain, spans } = parseMarked(marked('welcome'))
  assert.equal(plain, plainOf('welcome'))
  assert.deepEqual(spans.map(s => s.key), ['name', 'property'])
  assert.equal(plain.slice(spans[0].start, spans[0].end), 'אמיר')
})

test('untemplate: values the user kept go back to placeholders, edits stay as typed', () => {
  const m = marked('welcome')
  // unchanged → the placeholders come back
  assert.equal(untemplate(plainOf('welcome'), m), 'היי {name}, ראינו שהשארתם פרטים על {property}, אנחנו מאפיק הנחל.\nאפשר להתקשר היום לכמה דקות?')
  // the user rewrote the question and added a line; the name and the project stay placeholders
  const edited = 'היי אמיר, ראינו שהשארתם פרטים על זרובבל 15, אנחנו מאפיק הנחל.\nיש לכם 5 דקות לשיחה היום?\nמחכים לשמוע'
  assert.equal(untemplate(edited, m), 'היי {name}, ראינו שהשארתם פרטים על {property}, אנחנו מאפיק הנחל.\nיש לכם 5 דקות לשיחה היום?\nמחכים לשמוע')
  // a value the user changed is not a placeholder any more
  assert.match(untemplate(edited.replace('זרובבל 15', 'זרובבל 17'), m), /על זרובבל 17,/)
  // the prefix letter stays outside the placeholder: "ב{property}"
  assert.match(untemplate(plainOf('welcome_brochure'), marked('welcome_brochure')), /שהתעניינתם ב\{property\}\./)
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

test('a template keeps its picture through an edit, and an invalid one is dropped', () => {
  const IMG = 'https://x.supabase.co/storage/v1/object/public/property-media/templates/a.jpg'
  const c1 = withTemplate({}, { id: 'welcome', he: 'a', en: 'b', image: IMG }, { he: 'שונה' })
  assert.equal(c1.templates.welcome.image, IMG)
  assert.equal(withTemplate(c1, c1.templates.welcome, { id: 'welcome', image: '' }).templates.welcome.image, undefined)
  assert.equal(withTemplate({}, { id: 'x', he: 'a' }, { image: 'http://insecure/a.jpg' }).templates.x.image, undefined)
})

test('messageToTemplate: a chat message becomes a template for every lead', async () => {
  const { messageToTemplate, withTemplate } = await import('./template-edit.js')
  const lead = { name: 'רחל קפר', source: 'meta', campaign_name: 'זרובבל 15 - v2', crm_data: {} }
  assert.equal(messageToTemplate('היי רחל, יצא לך לעבור על הפרטים של זרובבל 15? ירון פה', lead), 'היי {name}, יצא לך לעבור על הפרטים של {property}? ירון פה')
  assert.equal(messageToTemplate('בלי שם', {}), 'בלי שם')
  const cfg = withTemplate({}, { cat: 'personal' }, { id: 'c_x', he: 'היי {name}', he_title: 'זרובבל 15 · היי', project: 'זרובבל 15' })
  assert.deepEqual(cfg.templates.c_x, { cat: 'personal', he: 'היי {name}', en: '', he_title: 'זרובבל 15 · היי', en_title: '', project: 'זרובבל 15' })
})

test('a template keeps its files (https only, up to 10, no duplicates)', async () => {
  const { withTemplate } = await import('./template-edit.js')
  const { templateFiles } = await import('./automations-shared.js')
  const f = (i) => ({ url: `https://x.supabase.co/storage/v1/object/public/property-media/templates/a${i}.pdf`, name: `a${i}.pdf`, type: 'application/pdf', size: 1000 })
  const next = withTemplate({}, { id: 'c_1', cat: 'personal', he: 'שלום' }, { files: [f(1), f(1), { url: 'javascript:alert(1)' }, { url: 'http://x/y.pdf' }, f(2)] })
  assert.deepEqual(next.templates.c_1.files.map(x => x.name), ['a1.pdf', 'a2.pdf'])
  assert.equal(templateFiles({ files: Array.from({ length: 34 }, (_, i) => f(i)) }).length, 30)
  assert.equal('files' in withTemplate({}, { id: 'c_2', he: 'x' }).templates.c_2, false)
})

test('template names from the project, the category or the message', async () => {
  const { autoTitle, titleIdeas, knownProjects } = await import('./template-edit.js')
  assert.equal(autoTitle('זרובבל 15', 'היי {name}, מצרפים את המחירון של {property}.'), 'זרובבל 15 · מצרפים את המחירון של זרובבל 15.')
  assert.equal(autoTitle('', 'היי {name}, מצרפים את המחירון'), 'מצרפים את המחירון')
  const ideas = titleIdeas({ project: 'זרובבל 15', cat: 'personal', text: 'היי {name}, מצרפים את המחירון', taken: ['אישי · זרובבל 15'] })
  assert.deepEqual(ideas, ['אישי · זרובבל 15 2', 'זרובבל 15 · מצרפים את המחירון', 'מצרפים את המחירון', 'זרובבל 15'])
  assert.deepEqual(titleIdeas({ text: '' }), [])
  const kp = knownProjects([{ project: 'זרובבל 15' }, { project: 'זרובבל 15 ' }, { project: 'כפר סבא 7' }], [{ source: 'meta', campaign_name: 'זרובבל 15 - v2', crm_data: { metaLeadId: 1 } }, { prop_title: 'דירה ברעננה' }])
  assert.deepEqual(kp.map(x => [x.name, x.templates, x.leads]), [['זרובבל 15', 2, 1], ['כפר סבא 7', 1, 0], ['דירה ברעננה', 0, 1]])
})

test('files from a chat are added to a template: after its own, no link twice, up to the limit', () => {
  const f = i => ({ url: `https://x.supabase.co/t/${i}.jpg`, name: `${i}.jpg`, type: 'image/jpeg', size: 10 })
  const tpl = { id: 'c_abc', cat: 'personal', he: 'היי {name}', en: '', he_title: 'זרובבל 15', en_title: '', files: [f(1)], image: 'https://x.supabase.co/t/cover.jpg' }
  const cfg = { templates: { c_abc: { ...tpl, id: undefined } }, rules: { a: 1 } }
  const r = addFilesToTemplate(cfg, tpl, [f(1), f(2), { url: 'https://x.supabase.co/t/cover.jpg', name: 'cover.jpg' }, f(3), f(3)])
  assert.equal(r.added, 2); assert.equal(r.skipped, 3); assert.equal(r.dropped, 0)
  assert.deepEqual(r.next.templates.c_abc.files.map(x => x.name), ['1.jpg', '2.jpg', '3.jpg'])
  assert.equal(r.next.templates.c_abc.he, 'היי {name}'); assert.deepEqual(r.next.rules, { a: 1 })
  const full = { ...tpl, files: Array.from({ length: 29 }, (_, i) => f(100 + i)) }
  const r2 = addFilesToTemplate({}, full, [f(1), f(2), f(3)])
  assert.equal(r2.added, 1); assert.equal(r2.dropped, 2); assert.equal(r2.next.templates.c_abc.files.length, 30)
})
