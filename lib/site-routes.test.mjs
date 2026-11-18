import test from 'node:test'
import assert from 'node:assert/strict'
import { SECTION_ROUTES, sectionPath, routeForPath, switchLangPath, canonicalOf, sitemapEntries, applyRouteHead, routeMeta, ORIGIN } from './site-routes.js'
import { readFileSync } from 'node:fs'

test('the primary host is www (the bare domain redirects to it)', () => {
  assert.equal(ORIGIN, 'https://www.afikhanahal.co.il')
})

test('every section has both languages, unique addresses, a title ≤ 70 and a description ≤ 170', () => {
  const seen = new Set()
  for (const r of SECTION_ROUTES) {
    for (const l of ['he', 'en']) {
      assert.ok(r.path[l].startsWith('/') && r.path[l].endsWith('/'), r.id)
      assert.ok(!seen.has(r.path[l]), 'duplicate ' + r.path[l]); seen.add(r.path[l])
      assert.ok(r.title[l] && r.title[l].length <= 70, `${r.id} ${l} title ${r.title[l]?.length}`)
      assert.ok(r.desc[l] && r.desc[l].length >= 50 && r.desc[l].length <= 170, `${r.id} ${l} desc ${r.desc[l]?.length}`)
      if (l === 'en') { assert.ok(r.path.en.startsWith('/en/')); assert.ok(!/[֐-׿]/.test(r.title.en + r.desc.en), r.id + ' English has Hebrew') }
    }
  }
})

test('the section ids are the ones the homepage has', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  for (const r of SECTION_ROUTES) assert.ok(app.includes(`id="${r.id}"`) || app.includes(`id:'${r.id}'`), r.id)
})

test('no section address takes a static hub\'s address', () => {
  for (const r of SECTION_ROUTES) for (const l of ['he', 'en']) assert.ok(!/^\/(en\/)?(services|areas|guides|glossary|tools|faq|company|p|api|assets|book|s|sign)\//.test(r.path[l]), r.path[l])
})

test('the address bar → the section and language, with or without the last slash, ignoring the query', () => {
  assert.deepEqual(routeForPath('/process'), { id: 'process', lang: 'he' })
  assert.deepEqual(routeForPath('/process/'), { id: 'process', lang: 'he' })
  assert.deepEqual(routeForPath('/en/contact?utm_source=fb'), { id: 'contact', lang: 'en' })
  assert.deepEqual(routeForPath('/'), { id: 'home', lang: 'he' })
  assert.deepEqual(routeForPath('/en'), { id: 'home', lang: 'en' })
  assert.equal(routeForPath('/services/land-brokerage/'), null)
  assert.equal(routeForPath('/admin-panel'), null)
  assert.equal(sectionPath('properties', 'en'), '/en/properties/')
  assert.equal(sectionPath('nope', 'he'), '/')
  assert.equal(switchLangPath('/process/', 'en'), '/en/process/')
  assert.equal(switchLangPath('/en/about', 'he'), '/about/')
  assert.equal(switchLangPath('/privacy', 'en'), '/en/')
})

test('services / faq point at their hub; the sitemap lists only pages that are their own canonical', () => {
  const svc = SECTION_ROUTES.find(r => r.id === 'services')
  assert.equal(canonicalOf(svc, 'he'), ORIGIN + '/services/')
  assert.equal(canonicalOf(svc, 'en'), ORIGIN + '/en/services/')
  const sm = sitemapEntries('2026-11-18')
  assert.ok(sm.every(e => e.he.startsWith(ORIGIN + '/') && e.en.startsWith(ORIGIN + '/en/')))
  assert.ok(!sm.some(e => /our-services|questions/.test(e.he)))
  assert.ok(sm.some(e => e.he === ORIGIN + '/properties/'))
})

const TPL = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>old</title><meta name="description" content="old" /><meta property="og:title" content="old" /><meta property="og:url" content="https://www.afikhanahal.co.il/" /><link rel="canonical" href="https://www.afikhanahal.co.il/" />
<link rel="alternate" hreflang="he" href="https://www.afikhanahal.co.il/" /><link rel="alternate" hreflang="x-default" href="https://www.afikhanahal.co.il/" /></head><body><div id="root"></div></body></html>`

test('a section page\'s head: its own title, description, canonical, hreflang pair, breadcrumb and the route for the app', () => {
  const r = SECTION_ROUTES.find(x => x.id === 'process')
  const h = applyRouteHead(TPL, r, 'he')
  assert.match(h, /<title>תהליך הליווי/)
  assert.match(h, /<link rel="canonical" href="https:\/\/www\.afikhanahal\.co\.il\/process\/" \/>/)
  assert.match(h, /hreflang="en" href="https:\/\/www\.afikhanahal\.co\.il\/en\/process\/"/)
  assert.equal((h.match(/hreflang=/g) || []).length, 3, 'old hreflang links replaced, not added to')
  assert.match(h, /"BreadcrumbList"/)
  assert.match(h, /window\.__afikRoute=\{"id":"process","lang":"he"\}/)
  assert.match(h, /<html lang="he" dir="rtl">/)
  const en = applyRouteHead(TPL, r, 'en')
  assert.match(en, /<html lang="en" dir="ltr">/)
  assert.match(en, /<meta property="og:url" content="https:\/\/www\.afikhanahal\.co\.il\/en\/process\/" \/>/)
  const faq = applyRouteHead(TPL, SECTION_ROUTES.find(x => x.id === 'faq'), 'he')
  assert.match(faq, /rel="canonical" href="https:\/\/www\.afikhanahal\.co\.il\/faq\/"/)
  assert.ok(!/<\/script>\s*<\/script>/.test(h))
})

test('routeMeta is what the app writes into the tab when the section changes', () => {
  const m = routeMeta('contact', 'en')
  assert.equal(m.path, '/en/contact/')
  assert.match(m.title, /Contact/)
  assert.equal(routeMeta('zzz', 'he').path, '/')
})
