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

test('instant landing: property in plain HTML + its own OG tags, SPA kept', async () => {
  const { readFileSync } = await import('node:fs')
  const { renderLanding } = await import('./share-page.js')
  const tpl = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const p = { ...prop, description: 'שורה 1\nשורה 2 </script><script>alert(1)</script>' }
  const html = renderLanding(tpl, p, { origin: O })
  // exactly one title / og:title, and they are the property's
  assert.equal((html.match(/<title>/g) || []).length, 1)
  assert.equal((html.match(/property="og:title"/g) || []).length, 1)
  assert.ok(html.includes('<meta property="og:title" content="מגרש לבנייה בתל מונד | תל מונד, השכונה הירוקה"'))
  assert.ok(html.includes(`<meta property="og:image" content="${O}/media/property-media/p123/1.jpg"`))
  assert.ok(!/<meta[^>]+og-default\.png/.test(html), 'the generic OG image meta is gone')
  assert.ok(!/rel="canonical" href="https:\/\/afikhanahal\.co\.il\/"/.test(html))
  // the property is painted without JavaScript
  assert.ok(html.includes('<div id="afik-pre"'))
  assert.ok(html.includes('data-f="title">מגרש לבנייה בתל מונד</h1>'))
  assert.ok(html.includes('₪2,500,000'))
  assert.ok(html.includes('href="tel:+972559811814"') && html.includes('https://wa.me/972559811814?text='))
  // embedded data can't break out of its <script>
  assert.ok(!html.includes('</script><script>alert(1)'))
  // the SPA is still all there, and the embedded data comes before the early-fetch script
  assert.ok(html.includes('<div id="root">') && html.includes('src="/src/main.jsx"'))
  assert.ok(html.indexOf('window.__afikShared={id:') < html.indexOf("window.__afikShared={id:id,promise:fetch"))
  assert.ok(html.indexOf('<div id="afik-pre"') < html.indexOf('<div id="root">'))
})

test('instant landing: responsive photo, blurred placeholder, lean head, deferred analytics flag', async () => {
  const { readFileSync } = await import('node:fs')
  const { renderLanding, landingImageUrls, slimProperty } = await import('./share-page.js')
  const tpl = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const lqip = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
  const html = renderLanding(tpl, { ...prop, __lqip: lqip }, { origin: O })
  assert.ok(/<img class="ap-img"[^>]+srcset="[^"]*w=480[^"]*480w, [^"]*w=900[^"]*900w, [^"]*w=1400[^"]*1400w"/.test(html), 'srcset with 3 widths')
  assert.ok(/<link rel="preload" as="image" imagesrcset="/.test(html), 'preload uses the srcset')
  assert.ok(html.includes(`<div class="ap-ph" style="background-image:url(${lqip})">`), 'placeholder behind the photo')
  assert.ok(html.includes('window.__afikLanding=1'))
  assert.ok(!/"@type":"RealEstateAgent"|"@type":"Organization"/.test(html), 'org JSON-LD graph dropped')
  assert.ok(/"@type":"RealEstateListing"/.test(html), 'the property JSON-LD kept')
  assert.ok(/<div id="root"><\/div>\s*<script type="afik\/module"/.test(html), "#root fallback text dropped")
  assert.ok(!/preconnect" href="https:\/\/www\.govmap\.gov\.il/.test(html) && !/onrender\.com"/.test(html.split('<body')[0].replace(/<script>[\s\S]*?<\/script>/g, '')), 'unneeded preconnects dropped')
  assert.ok(html.includes('preconnect" href="https://wsrv.nl"'), 'image CDN preconnect kept')
  assert.ok(!html.includes('__lqip'), 'placeholder never embedded for the app')
  assert.equal(slimProperty({ __lqip: lqip, a: 1 }).__lqip, undefined)
  const urls = landingImageUrls(prop, O)
  assert.equal(urls.length, 4); assert.ok(urls[3].includes('w=24&h=15'))
  assert.deepEqual(landingImageUrls({ id: 'x', title: 't' }, O), [], 'no photo → nothing to warm')
  const noPhoto = renderLanding(tpl, { id: 'x', title: 'בלי תמונה' }, { origin: O })
  assert.ok(!noPhoto.includes('class="ap-ph"') && !noPhoto.includes('rel="preload" as="image"'))
})

test('instant landing: the app boots after the photo (or 1.2 s), never alongside it', async () => {
  const { readFileSync } = await import('node:fs')
  const { renderLanding } = await import('./share-page.js')
  const tpl = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const html = renderLanding(tpl, prop, { origin: O, cdn: 'http://cdn.test/?url=' })
  assert.ok(!html.includes('rel="modulepreload"'), 'no live module preloads')
  assert.ok(/<link rel="afik-modulepreload" data-href="\/assets\/vendor-react-[^"]+\.js">/.test(html) || !html.includes('vendor-react'), 'chunks kept as inert preloads for afikBoot')
  assert.ok(html.indexOf('<meta name="viewport"') < html.indexOf('imagesrcset='), 'photo preload sits after the viewport meta')
  assert.ok(!/<script type="module"[^>]*src=/.test(html), 'the module script is not started by the parser')
  assert.ok(/<script type="afik\/module" data-src="\/(assets\/index-[^"]+\.js|src\/main\.jsx)"><\/script>/.test(html), 'held as a placeholder')
  assert.ok(html.includes('onload="window.afikBoot&&afikBoot()"'))
  assert.ok(html.includes('setTimeout(window.afikBoot,1200)'))
  assert.ok(html.includes('src="http://cdn.test/?url='), 'cdn base option honoured')
  const noPhoto = renderLanding(tpl, { id: 'x', title: 'בלי תמונה' }, { origin: O })
  assert.ok(noPhoto.includes('<script>window.afikBoot&&afikBoot()</script>'), 'no photo → boot at once')
})
