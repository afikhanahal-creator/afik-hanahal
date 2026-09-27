import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderHome, cardImage, cardPrice, siteOrder } from './home-page.js'

const tpl = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const props = [
  { id: 'a1', title: 'מגרש בתל מונד', location: 'תל מונד', category: 'land', type: 'מגרש', dunams: '1.2', price: '2,500,000', images: ['https://abc.supabase.co/storage/v1/object/public/property-media/a1/1.jpg?x=1'], published: true, sortOrder: 2 },
  { id: 'a2', title: 'דירה בהוד השרון', location: 'הוד השרון', neighborhood: 'רמת הדר', category: 'apartments', rooms: '4', size: '110', floor: '3', price: '3,150,000', published: true, sortOrder: 1 },
  { id: 'a3', title: 'חדש בלי מיון', category: 'rentals', txType: 'rent', price: '6,500', createdAt: '2026-09-20T00:00:00Z', published: true },
  { id: 'h1', title: 'מוסתר', published: false },
]

test('card helpers match the app', () => {
  assert.equal(cardImage(props[0].images[0]), '/media/property-media/a1/1.jpg')
  assert.equal(cardImage('https://res.cloudinary.com/x/image/upload/v1/a.jpg'), 'https://res.cloudinary.com/x/image/upload/w_600,q_auto:good,f_auto/v1/a.jpg')
  assert.equal(cardImage('data:image/png;base64,x'), '')
  const t = { price: 'מחיר בפנייה', month: '/ לחודש', mil: 'מיל׳ ₪', k: 'אלף ₪' }
  assert.equal(cardPrice(props[0], t), '2.5 מיל׳ ₪')
  assert.equal(cardPrice(props[2], t), '7 אלף ₪ / לחודש')
  assert.equal(cardPrice({ price: '' }, t), 'מחיר בפנייה')
  assert.deepEqual(siteOrder(props).map(p => p.id), ['a3', 'h1', 'a2', 'a1'])
})

test('static first screen: hero + grid in both languages, cards link to the instant pages', () => {
  const html = renderHome(tpl, props, { maxCards: 2 })
  assert.ok(html.includes('<div id="afik-pre-home"'))
  assert.ok(html.indexOf('<div id="afik-pre-home"') < html.indexOf('<div id="root">'), 'the layer sits before the app root')
  assert.ok(html.includes('הבית הבא שלכם') && html.includes('Your Next Home'), 'both languages present')
  assert.ok(html.includes('3 נכסים זמינים כעת') && html.includes('3 properties available now'), 'hidden property not counted')
  assert.equal((html.match(/class="ph-card"/g) || []).length, 4, '2 cards × 2 languages')
  assert.ok(html.includes('href="/p/a3"') && html.includes('href="/p/a2"') && !html.includes('href="/p/a1"'), 'site order, capped')
  assert.ok(html.includes('src="/media/property-media/a1/1.jpg"') === false, 'a1 is beyond the cap')
  assert.ok(html.includes('4 חד׳') && html.includes('110 מ&quot;ר') && html.includes('קומה 3'), 'specs (HTML-escaped)')
  assert.ok(html.includes('(3)</a>'), 'the "all properties" link shows the total')
  assert.ok(html.includes("location.pathname!=='/'||/[?&]p=/.test(location.search)"), 'homepage only')
  assert.ok(html.includes('html[data-pre-home]{opacity:1!important}'))
  // the SPA is intact
  assert.ok(html.includes('<div id="root">') && /<script type="module"[^>]*src="\/src\/main\.jsx"/.test(html))
  assert.ok(html.indexOf('<meta name="viewport"') < html.indexOf('#afik-pre-home{display:none}'))
})

test('static first screen: no properties → no grid, still a hero', () => {
  const html = renderHome(tpl, [])
  assert.ok(html.includes('<div id="afik-pre-home"') && !html.includes('class="ph-card"') && !html.includes('class="ph-count"'))
})
