import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateHome, homeLegacy, hoursLine, hoursText } from './home-content.js'
import { SITE } from '../content/site.mjs'

const HOME = JSON.parse(readFileSync(new URL('../content/home.json', import.meta.url), 'utf8'))
const copy = () => JSON.parse(JSON.stringify(HOME))

test('the shipped content is valid', () => {
  assert.deepEqual(validateHome(HOME), [])
})

test('an empty English text blocks publishing', () => {
  const h = copy(); h.hero.line1.en = '  '
  assert.deepEqual(validateHome(h).map(e => [e.path, e.code]), [['hero.line1.en', 'empty']])
})

test('a list item missing its English answer is caught by path', () => {
  const h = copy(); h.faq.items[2].a.en = ''
  assert.deepEqual(validateHome(h).map(e => e.path), ['faq.items.2.a.en'])
})

test('too long, too few, unknown icon, bad links', () => {
  const h = copy()
  h.hero.line2.he = 'א'.repeat(41)
  h.story.features = h.story.features.slice(0, 1)
  h.process.steps[0].icon = 'FaNope'
  h.office.email = 'not-an-email'
  h.office.whatsapp = '0559811814'
  h.playlist.url = 'https://example.com/x'
  const codes = Object.fromEntries(validateHome(h).map(e => [e.path, e.code]))
  assert.equal(codes['hero.line2.he'], 'long')
  assert.equal(codes['story.features'], 'few')
  assert.equal(codes['process.steps.0.icon'], 'icon')
  assert.equal(codes['office.email'], 'email')
  assert.equal(codes['office.whatsapp'], 'phone')
  assert.equal(codes['playlist.url'], 'url')
})

test('optional fields may be empty in both languages, not in one', () => {
  const h = copy(); h.testimonials.items[0].designation = { he: '', en: '' }
  assert.deepEqual(validateHome(h), [])
  h.testimonials.items[0].designation = { he: 'שמאי', en: '' }
  assert.deepEqual(validateHome(h).map(e => e.path), ['testimonials.items.0.designation.en'])
})

test('a hidden playlist needs no link', () => {
  const h = copy(); h.playlist.visible = false; h.playlist.url = ''
  assert.deepEqual(validateHome(h), [])
})

test('legacy shapes: TR keys, numbered steps, he / en_ fields', () => {
  const L = homeLegacy(HOME)
  assert.equal(L.tr.he.heroH1line1, HOME.hero.line1.he)
  assert.equal(L.tr.en.propertiesH2, HOME.properties.title.en)
  assert.deepEqual(Object.keys(L.tr.he).sort(), Object.keys(L.tr.en).sort())
  assert.equal(L.process.length, HOME.process.steps.length)
  assert.deepEqual(L.process.map(s => s.num).slice(0, 3), ['01', '02', '03'])
  assert.equal(L.process[0].en_title, HOME.process.steps[0].title.en)
  assert.equal(L.faqs[0].en_a, HOME.faq.items[0].a.en)
  assert.equal(L.testimonials[0].src, HOME.testimonials.items[0].photo)
  assert.deepEqual(L.typewriter.en, HOME.hero.typewriter.map(t => t.en))
  for (const lang of ['he', 'en']) for (const [k, v] of Object.entries(L.tr[lang])) assert.ok(Array.isArray(v) ? v.every(Boolean) : v, `${lang}.${k}`)
})

test('office hours: footer lines and the content pages share one source', () => {
  assert.equal(hoursLine(HOME.office.hours[0], 'en'), `${HOME.office.hours[0].days.en}: ${HOME.office.hours[0].time}`)
  assert.equal(SITE.hours.he, hoursText(HOME, 'he'))
  assert.equal(SITE.hours.en, hoursText(HOME, 'en'))
  assert.equal(SITE.phone, HOME.office.phone)
  assert.equal(SITE.whatsapp, 'https://wa.me/' + HOME.office.whatsapp)
  assert.equal(SITE.social.facebook, HOME.office.facebook)
})

test('field limits by path, for single texts and list items', async () => {
  const { fieldLimit, listBounds } = await import('./home-content.js')
  assert.equal(fieldLimit('hero.line1'), 40)
  assert.equal(fieldLimit('faq.items.3.q'), 200)
  assert.equal(fieldLimit('about.points.2'), 120)
  assert.equal(fieldLimit('testimonials.items.0.designation'), 120)
  assert.equal(fieldLimit('process.steps.0.icon'), 0)
  assert.equal(fieldLimit('nope.x'), 0)
  assert.deepEqual(listBounds('story.features'), { min: 2, max: 8 })
  assert.equal(listBounds('hero.badge'), null)
})

test('diff: changed texts, a reordered list, an added item', async () => {
  const { diffHome, changedAreas } = await import('./home-content.js')
  assert.deepEqual(diffHome(HOME, copy()), [])
  const h = copy()
  h.hero.line1.en = 'Changed'
  ;[h.faq.items[0], h.faq.items[1]] = [h.faq.items[1], h.faq.items[0]]
  h.services.items.push(h.services.items[0])
  const d = diffHome(HOME, h)
  assert.ok(d.includes('hero.line1.en'))
  assert.ok(d.includes('services.items'))
  assert.ok(d.some(p => p.startsWith('faq.items.0.')))
  assert.deepEqual(new Set(changedAreas(d)), new Set(['hero', 'faq', 'services']))
})

test('the admin form covers every field of the content file', async () => {
  const { CONTENT_AREAS, newItem } = await import('../src/contentEditorSchema.js')
  assert.deepEqual(CONTENT_AREAS.map(a => a.id).sort(), Object.keys(HOME).filter(k => k !== 'version').sort())
  for (const a of CONTENT_AREAS) {
    assert.deepEqual(a.fields.map(f => f.key).sort(), Object.keys(HOME[a.id]).sort(), a.id)
    for (const f of a.fields.filter(x => x.type === 'list')) {
      const keys = new Set(HOME[a.id][f.key].flatMap(Object.keys))
      for (const k of keys) assert.ok(f.fields.some(x => x.key === k) || k in (f.extra || {}), `${a.id}.${f.key}.${k}`)
    }
  }
  // a new item, once its texts are filled, passes the rules
  const h = copy()
  const faq = CONTENT_AREAS.find(a => a.id === 'faq').fields.find(f => f.key === 'items')
  const item = newItem(faq); item.q = { he: 'שאלה?', en: 'Question?' }; item.a = { he: 'תשובה.', en: 'Answer.' }
  h.faq.items.push(item)
  assert.deepEqual(validateHome(h), [])
  const svc = newItem(CONTENT_AREAS.find(a => a.id === 'services').fields.find(f => f.key === 'items'))
  assert.equal(svc.icon, 'FaSearch'); assert.equal(svc.accent, 'purple')
  h.services.items.push(svc)
  assert.deepEqual(validateHome(h).map(e => e.path).sort(), ['services.items.6.desc.en', 'services.items.6.desc.he', 'services.items.6.title.en', 'services.items.6.title.he'])
})
