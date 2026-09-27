// Production speed probe: what a visitor really gets from the live site, measured from the outside.
//   node scripts/probe-site.mjs                 (SITE=https://www.afikhanahal.co.il, PROP=<id> optional)
// 1) Plain HTTP timings + the headers that matter (edge cache, function vs static, redirects) and the
//    HTML markers of the instant landing page / static first screen.
// 2) A real phone-profile browser visit (Playwright, if installed) on the real network and on a
//    throttled "Fast 3G + slow CPU" profile: when the text shows, when the photo shows, when the full
//    site has taken over, what downloaded and how long each request took. Screenshots go to OUT_DIR.
// Runs in CI (.github/workflows/site-probe.yml) because the dev sandbox cannot reach the site.
import { mkdirSync, writeFileSync } from 'node:fs'

const SITE = (process.env.SITE || 'https://www.afikhanahal.co.il').replace(/\/$/, '')
const OUT = process.env.OUT_DIR || 'probe-out'
mkdirSync(OUT, { recursive: true })
const UA_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
const HEADERS = ['x-feed-source', 'x-render-routing', 'rndr-id', 'x-vercel-cache', 'x-vercel-id', 'cache-control', 'content-type', 'content-length', 'content-encoding', 'age', 'location', 'x-matched-path', 'server']
const pad = (s, n) => String(s).padStart(n)
const ms = t => `${Math.round(t)} ms`

async function timedFetch(path, { ua = UA_PHONE, redirect = 'manual', accept } = {}) {
  const url = path.startsWith('http') ? path : SITE + path
  const t0 = performance.now()
  const out = { url, path }
  try {
    const r = await fetch(url, { redirect, headers: { 'user-agent': ua, ...(accept ? { accept } : {}) }, signal: AbortSignal.timeout(30000) })
    out.ttfb = performance.now() - t0
    out.status = r.status
    out.headers = Object.fromEntries(HEADERS.map(h => [h, r.headers.get(h)]).filter(([, v]) => v))
    const body = await r.text()
    out.total = performance.now() - t0
    out.bytes = Buffer.byteLength(body)
    out.body = body
  } catch (e) { out.error = e.message; out.total = performance.now() - t0 }
  return out
}
function markers(html = '') {
  const og = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1]
  const preload = (html.match(/<link rel="preload"[^>]*as="image"[^>]*>/) || [])[0]
  const layer = html.slice(html.indexOf('<div id="afik-pre"'))
  const img = layer.startsWith('<div') ? (layer.match(/<img[^>]*>/) || [])[0] : null
  return {
    landing: html.includes('id="afik-pre"'), homeLayer: html.includes('id="afik-pre-home"'),
    photoFirst: html.includes('afik/module'), shared: html.includes('__afikShared'), lqip: html.includes('__lqip') || /data:image\/jpeg;base64,/.test(html),
    ogTitle: og, imgPreload: preload ? preload.replace(/\s+/g, ' ').slice(0, 260) : null, img: img ? img.replace(/\s+/g, ' ').slice(0, 260) : null,
    bundle: (html.match(/\/assets\/index-[\w-]+\.js/) || [])[0], modulepreloads: (html.match(/rel="(?:afik-)?modulepreload"/g) || []).length,
  }
}
function report(r, extra = '') {
  const h = r.headers || {}
  console.log(`${pad(r.status ?? 'ERR', 4)}  ttfb ${pad(ms(r.ttfb || 0), 8)}  total ${pad(ms(r.total), 8)}  ${pad(Math.round((r.bytes || 0) / 1024) + ' KB', 8)}  ${r.path}${extra}`)
  console.log(`      ${Object.entries(h).map(([k, v]) => `${k}=${String(v).slice(0, 90)}`).join(' · ') || r.error || ''}`)
}

// ── 1. What the server sends ─────────────────────────────────────────────────────────────────────
console.log(`== ${SITE} · ${new Date().toISOString()}`)
const list = await timedFetch('/properties.json', { accept: 'application/json' })
report(list)
let props = []
try { props = JSON.parse(list.body || '[]') } catch {}
const ids = (Array.isArray(props) ? props : []).filter(p => p && p.id != null).map(p => String(p.id))
const PROP = process.env.PROP || ids[ids.length - 1] || '1790232349039'
const prop = (Array.isArray(props) ? props : []).find(p => String(p.id) === PROP)
console.log(`   properties.json: ${ids.length} properties · probing property ${PROP} ${prop ? '(' + String(prop.title).slice(0, 40) + ')' : '(not in properties.json → the function renders it)'}`)

for (const pass of [1, 2]) {
  const r = await timedFetch(`/p/${PROP}?utm_source=whatsapp`)
  report(r, pass === 2 ? '   (second request)' : '   (first request)')
  if (pass === 1) {
    const m = markers(r.body)
    console.log(`      markers: landing=${m.landing} photoFirst=${m.photoFirst} shared=${m.shared} lqip=${m.lqip} modulepreloads=${m.modulepreloads} bundle=${m.bundle}`)
    console.log(`      og:title=${m.ogTitle}`)
    if (m.imgPreload) console.log(`      preload: ${m.imgPreload}`)
    if (m.img) console.log(`      img: ${m.img}`)
    writeFileSync(`${OUT}/landing.html`, r.body || '')
    // the photo, at every size the page offers
    const srcset = ((r.body || '').match(/imagesrcset="([^"]*)"/) || [])[1] || ((r.body || '').match(/srcset="([^"]*)"/) || [])[1] || ''
    const urls = srcset.split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean)
    const single = (m.img && m.img.match(/ src="([^"]+)"/) || [])[1]
    if (single && !urls.includes(single)) urls.push(single)
    for (const u of urls.slice(0, 4)) {
      const p = await timedFetch(u.replace(/&amp;/g, '&'), { accept: 'image/avif,image/webp,image/*' })
      report(p, '   (photo)')
    }
  }
}
const crawler = await timedFetch(`/p/${PROP}`, { ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' })
report(crawler, '   (Facebook crawler)')
console.log(`      og:title=${markers(crawler.body).ogTitle} · landing=${markers(crawler.body).landing}`)
const home = await timedFetch('/')
report(home, '   (homepage)')
const hm = markers(home.body)
console.log(`      markers: homeLayer=${hm.homeLayer} bundle=${hm.bundle} modulepreloads=${hm.modulepreloads}`)
const one = await timedFetch(`/api/properties?one=${PROP}`, { accept: 'application/json' })
report(one, '   (single property API)')
try { const j = JSON.parse(one.body); console.log(`      source=${j.source} title=${String(j.property?.title || j.title || '').slice(0, 40)}`) } catch {}
const all = await timedFetch('/api/properties', { accept: 'application/json' })
report(all, '   (public list API)')
if (hm.bundle) report(await timedFetch(hm.bundle, { accept: '*/*' }), '   (main bundle)')

// ── 1b. The backends behind the site ─────────────────────────────────────────────────────────────
const RENDER = (process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com').replace(/\/$/, '')
console.log(`\n== backends`)
for (const [path, label] of [[`${RENDER}/api/properties`, 'Render: property list (direct, up to 70 s)'], [`${RENDER}/api/settings`, 'Render: settings'], [`${RENDER}/`, 'Render: root']]) {
  const t0 = performance.now()
  try {
    const r = await fetch(path, { headers: { 'user-agent': UA_PHONE, accept: 'application/json' }, signal: AbortSignal.timeout(70000) })
    const body = await r.text()
    console.log(`${pad(r.status, 4)}  ttfb ${pad(ms(performance.now() - t0), 8)}  ${pad(Math.round(body.length / 1024) + ' KB', 8)}  ${label}`)
    console.log(`      ${[...r.headers.entries()].filter(([k]) => /^(x-render-routing|rndr-id|cf-cache-status|content-type|access-control-allow-origin|server|retry-after)$/.test(k)).map(([k, v]) => `${k}=${v.slice(0, 60)}`).join(' · ')}`)
    console.log(`      body: ${body.replace(/\s+/g, ' ').slice(0, 160)}`)
  } catch (e) { console.log(`ERR   after ${ms(performance.now() - t0)}  ${label}: ${e.message}`) }
}
// Does Render answer an unchanged list with 304 (what keeps its metered bandwidth near zero)?
try {
  const a = await fetch(`${RENDER}/api/properties`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(70000) })
  const etag = a.headers.get('etag'); const kb = Math.round((await a.text()).length / 1024)
  if (a.ok && etag) {
    const b = await fetch(`${RENDER}/api/properties`, { headers: { accept: 'application/json', 'if-none-match': etag }, signal: AbortSignal.timeout(20000) })
    console.log(`      Render list: ${kb} KB, etag ${etag.slice(0, 20)}… → If-None-Match answers ${b.status} (${b.status === 304 ? 'good: no body' : 'FULL BODY AGAIN'})`)
  } else console.log(`      Render list: status ${a.status}, ${kb} KB, etag ${etag || 'none'}`)
} catch (e) { console.log(`      Render list etag check: ${e.message}`) }
for (const [path, label] of [['/api/properties?health=1', 'Vercel: feed health'], ['/api/properties', 'Vercel: public list'], [`/api/properties?one=${PROP}`, 'Vercel: single property']]) {
  const r = await timedFetch(path, { accept: 'application/json' })
  report(r, `   (${label})`)
  console.log(`      body: ${String(r.body || '').replace(/\s+/g, ' ').slice(0, 160)}`)
}

// ── 2. A real phone visit ────────────────────────────────────────────────────────────────────────
let chromium = null
try { ({ chromium } = await import('playwright')) } catch { try { ({ chromium } = await import('playwright-core')) } catch { console.log('\n(playwright not installed — browser visit skipped)'); process.exit(0) } }
const PROFILES = {
  real: null,
  '3g': { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8, cpu: 4 },
  '4g': { latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8, cpu: 4 },
}
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
async function visit(url, label, profile, { title, expectLayer = 'afik-pre' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: UA_PHONE })
  const pg = await ctx.newPage()
  const cdp = await ctx.newCDPSession(pg)
  await cdp.send('Network.enable')
  const p = PROFILES[profile]
  if (p) { await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: p.latency, downloadThroughput: p.downloadThroughput, uploadThroughput: p.uploadThroughput }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu }) }
  const errors = []; pg.on('pageerror', e => errors.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)) })
  const reqs = new Map()
  pg.on('request', r => reqs.set(r, { url: r.url(), type: r.resourceType(), start: Date.now() }))
  pg.on('requestfinished', async r => { const e = reqs.get(r); if (!e) return; e.end = Date.now(); try { const rs = await r.response(); e.status = rs?.status(); const h = rs?.headers() || {}; e.cache = h['x-vercel-cache'] || h['x-cache'] || ''; e.bytes = (await rs?.body().catch(() => null))?.length || 0 } catch {} })
  pg.on('requestfailed', r => { const e = reqs.get(r); if (e) { e.end = Date.now(); e.status = 'FAIL ' + (r.failure()?.errorText || '') } })
  const t0 = Date.now()
  const shots = [1000, 3000, 6000, 10000].map(at => setTimeout(() => pg.screenshot({ path: `${OUT}/${label.replace(/\W+/g, '_')}-${at / 1000}s.png` }).catch(() => {}), at))
  await pg.goto(url, { waitUntil: 'commit' }).catch(e => errors.push('goto: ' + e.message))
  const htmlAt = Date.now() - t0
  const visibleSrc = `(t)=>[...document.querySelectorAll('h1,h2,h3')].some(h=>(!t||h.textContent.includes(t))&&h.getBoundingClientRect().height>0)`
  const T = JSON.stringify(title || ''), L = JSON.stringify(expectLayer)
  const text = await pg.waitForFunction(`(${visibleSrc})(${T})`, null, { timeout: 25000, polling: 50 }).then(() => Date.now() - t0, () => null)
  const layerSeen = await pg.evaluate(id => !!document.getElementById(id), expectLayer)
  const photo = pg.waitForFunction(`(()=>{const i=document.querySelector('#'+${L}+' img')||document.querySelector('#root img');return !!(i&&i.complete&&i.naturalWidth>0)})()`, null, { timeout: 25000, polling: 50 }).then(() => Date.now() - t0, () => null)
  const takeoverMs = await pg.waitForFunction(`!document.getElementById(${L}) && (${visibleSrc})(${T})`, null, { timeout: 25000, polling: 100 }).then(() => Date.now() - t0, () => null)
  const photoMs = await photo
  await pg.waitForTimeout(Math.max(0, 10500 - (Date.now() - t0)))
  shots.forEach(clearTimeout)
  const state = await pg.evaluate(`(()=>({ url: location.pathname + location.search, layer: !!document.getElementById('afik-pre') || !!document.getElementById('afik-pre-home'), propOpen: (${visibleSrc})(${T}), h: [...document.querySelectorAll('h1,h2')].map(h => h.textContent.trim().slice(0, 40)).slice(0, 4), lcp: (performance.getEntriesByType('largest-contentful-paint').pop() || {}).startTime }))()`)
  console.log(`\n[${profile}] ${label}\n   html ${ms(htmlAt)} · text visible ${text == null ? '—' : ms(text)} (layer ${layerSeen ? 'yes' : 'NO'}) · photo ${photoMs == null ? 'not within 25 s' : ms(photoMs)} · full site took over ${takeoverMs == null ? 'not within 25 s' : ms(takeoverMs)} · LCP ${state.lcp ? ms(state.lcp) : '—'}`)
  console.log(`   after 10 s: url=${state.url} layer=${state.layer} propertyOpen=${state.propOpen} headings=${JSON.stringify(state.h)}${errors.length ? '\n   errors: ' + errors.slice(0, 6).join(' | ') : ''}`)
  const rows = [...reqs.values()].filter(r => r.end).sort((a, b) => a.start - b.start)
  console.log(`   ${rows.length} requests, ${Math.round(rows.reduce((a, r) => a + (r.bytes || 0), 0) / 1024)} KB · slowest:`)
  for (const r of [...rows].sort((a, b) => (b.end - b.start) - (a.end - a.start)).slice(0, 12)) console.log(`     ${pad(r.start - t0, 6)} → ${pad(r.end - t0, 6)} ms  ${pad(Math.round((r.bytes || 0) / 1024) + ' KB', 7)}  ${pad(r.status ?? '', 4)} ${pad(r.cache || '', 5)} ${r.type.padEnd(8)} ${r.url.replace(SITE, '').slice(0, 110)}`)
  writeFileSync(`${OUT}/${label.replace(/\W+/g, '_')}-${profile}.json`, JSON.stringify({ label, profile, htmlAt, text, photoMs, takeoverMs, state, errors, rows: rows.map(r => ({ ...r, start: r.start - t0, end: r.end - t0 })) }, null, 1))
  await ctx.close()
}
const title = prop ? String(prop.title) : (markers((await timedFetch(`/p/${PROP}`)).body).ogTitle || '').split('|')[0].trim()
for (const profile of (process.env.PROFILES || 'real,4g,3g').split(',')) {
  await visit(`${SITE}/p/${PROP}?utm_source=whatsapp`, 'shared link', profile, { title })
  if (profile === 'real' || profile === '3g') await visit(`${SITE}/`, 'homepage', profile, { title: '', expectLayer: 'afik-pre-home' })
}
await browser.close()
process.exit(0)
