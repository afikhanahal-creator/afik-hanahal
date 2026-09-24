import test from 'node:test'
import assert from 'node:assert/strict'
import { isPreviewBot, formatPrice, absoluteImage, propertyMeta, targetUrl, renderSharePage, esc } from './share-page.js'

const O = 'https://afikhanahal.co.il'
const prop = { id: 'p123', title: 'מגרש לבנייה בתל מונד', location: 'תל מונד', neighborhood: 'השכונה הירוקה', category: 'land', type: 'מגרש לבנייה', size: '500', price: '2,500,000', description: 'מגרש <יפה> "מוכן" לבנייה', images: ['https://abc.supabase.co/storage/v1/object/public/property-media/p123/1.jpg?x=1'], status: 'בשיווק' }

test('crawler detection', () => {
  for (const ua of ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'WhatsApp/2.23.20.0', 'LinkedInBot/1.0', 'Twitterbot/1.0', 'TelegramBot (like TwitterBot)', 'Mozilla/5.0 (compatible; meta-externalagent/1.1)'])
    assert.ok(isPreviewBot(ua), ua)
  assert.equal(isPreviewBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'), false)
})

test('price and images', () => {
  assert.equal(formatPrice('2,500,000'), '₪2,500,000')
  assert.equal(formatPrice('1800000 ₪'), '₪1,800,000')
  assert.equal(formatPrice('לפי דרישה'), 'לפי דרישה')
  assert.equal(absoluteImage(prop.images[0], O), `${O}/media/property-media/p123/1.jpg`)
  assert.equal(absoluteImage('/img/x.webp', O), `${O}/img/x.webp`)
  assert.equal(absoluteImage('data:image/png;base64,xx', O), '')
  assert.ok(absoluteImage('https://res.cloudinary.com/x/image/upload/v1/a.jpg', O).includes('w_1200,h_630'))
})

test('meta: title, place, price, specs, image, url', () => {
  const m = propertyMeta(prop, { origin: O })
  assert.equal(m.title, 'מגרש לבנייה בתל מונד | תל מונד, השכונה הירוקה')
  assert.ok(m.description.startsWith('₪2,500,000 — מגרש לבנייה · 500 מ״ר'))
  assert.equal(m.image, `${O}/media/property-media/p123/1.jpg`)
  assert.equal(m.url, `${O}/p/p123`)
  assert.equal(propertyMeta({ id: 1, title: 'x', images: [] }, { origin: O }).image, `${O}/img/og-default.png`)
})

test('target keeps campaign params only', () => {
  assert.equal(targetUrl('p123', { share: 'p123', utm_source: 'facebook', utm_medium: 'paid', fbclid: 'abc', evil: '<x>', lang: 'en' }), '/?p=p123&utm_source=facebook&utm_medium=paid&fbclid=abc&lang=en#properties')
})

test('page is escaped and has OG tags, no meta refresh', () => {
  const html = renderSharePage(prop, { origin: O, target: targetUrl('p123', {}) })
  assert.ok(html.includes('<meta property="og:image" content="https://afikhanahal.co.il/media/property-media/p123/1.jpg">'))
  assert.ok(html.includes('og:title" content="מגרש לבנייה בתל מונד | תל מונד, השכונה הירוקה"'))
  assert.ok(!html.includes('<יפה>')); assert.ok(html.includes('&lt;יפה&gt;'))
  assert.ok(!/http-equiv="refresh"/.test(html))
  assert.ok(html.includes('"@type":"RealEstateListing"')); assert.ok(html.includes('"price":2500000'))
  assert.equal(esc('"</script>'), '&quot;&lt;/script&gt;')
})

test('handler: person → 302 with UTM, crawler → OG page, unpublished → generic', async () => {
  const list = [prop, { id: 'hidden', title: 'סודי', published: false }]
  globalThis.fetch = async u => new Response(JSON.stringify(String(u).includes('/api/properties') ? list : []), { status: 200 })
  const { default: handler } = await import('../api/properties.js')
  const call = (query, ua) => new Promise(done => {
    const res = { h: {}, code: 200, setHeader(k, v) { this.h[k.toLowerCase()] = v }, status(c) { this.code = c; return this }, send(b) { done({ code: this.code, h: this.h, body: b }) }, json(b) { done({ code: this.code, body: b }) }, end() { done({ code: this.code }) }, redirect(c, u) { done({ code: c, location: u, h: this.h }) } }
    handler({ method: 'GET', query, headers: { host: 'afikhanahal.co.il', 'user-agent': ua } }, res)
  })
  const human = await call({ share: 'p123', utm_source: 'facebook', utm_campaign: 'tel-mond' }, 'Mozilla/5.0 (iPhone) Safari')
  assert.equal(human.code, 302); assert.equal(human.location, '/?p=p123&utm_source=facebook&utm_campaign=tel-mond#properties'); assert.equal(human.h['cache-control'], 'no-store')
  const bot = await call({ share: 'p123' }, 'facebookexternalhit/1.1')
  assert.equal(bot.code, 200); assert.ok(bot.body.includes('og:title" content="מגרש לבנייה בתל מונד'))
  const hidden = await call({ share: 'hidden' }, 'WhatsApp/2')
  assert.ok(!hidden.body.includes('סודי')); assert.ok(hidden.body.includes('og-default.png'))
})
