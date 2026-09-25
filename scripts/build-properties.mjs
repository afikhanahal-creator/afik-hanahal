// Build step (Vercel only): publish the property list as a static file next to the SPA.
//   dist/properties.json — the published properties at deploy time, served by Vercel's CDN
// A first-time visitor paints the property grid from it immediately (App.jsx), and the server falls
// back to it when Render is asleep and there is no Supabase snapshot yet (lib/property-feed.js).
// Also seeds that Supabase snapshot. Never fails the build: without data it just writes nothing.
//
// Runs when VERCEL is set (or PROPS_SNAPSHOT=1); local builds skip it so they stay fast offline.
import { writeFileSync, mkdirSync } from 'fs'
import { createFeed } from '../lib/property-feed.js'
import { renderLanding, landingImageUrls, lqipUrl, propertyMeta } from '../lib/share-page.js'
import { readFileSync } from 'fs'

if (!process.env.VERCEL && process.env.PROPS_SNAPSHOT !== '1') {
  console.log('[build-properties] skipped (not a Vercel build — set PROPS_SNAPSHOT=1 to run)')
  process.exit(0)
}

const RENDER = (process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com').replace(/\/$/, '')
const SUPA_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

// Render's free tier can take up to a minute to wake: long budget, one retry
const feed = createFeed({ renderUrl: RENDER, supaUrl: SUPA_URL, supaKey: SUPA_KEY, renderBudgetMs: 70000, renderTimeoutMs: 70000 })
let result = null
const t0 = Date.now()
for (let attempt = 1; attempt <= 2 && !result; attempt++) {
  try { result = await feed.getList() }
  catch (e) {
    console.warn(`[build-properties] attempt ${attempt} failed after ${Math.round((Date.now() - t0) / 1000)}s: ${e.message}`)
    if (Date.now() - t0 > 20000) break          // a slow failure won't get better — don't hold up the deploy
    await new Promise(r => setTimeout(r, 3000))  // a fast failure (502 while Render spins up) is worth one retry
  }
}

if (!result || !Array.isArray(result.list) || !result.list.length) {
  console.warn('[build-properties] no property data — dist/properties.json not written (the site falls back to the live API)')
  process.exit(0)
}

const published = result.list.filter(p => p && p.published !== false).map(p => ({ ...p }))
const body = JSON.stringify(published)
mkdirSync('dist', { recursive: true })
writeFileSync('dist/properties.json', body)
const kb = Math.round(Buffer.byteLength(body) / 1024)
const inlineImages = published.reduce((n, p) => n + (p.images || []).filter(i => String(i).startsWith('data:')).length, 0)
console.log(`[build-properties] dist/properties.json: ${published.length} published properties, ${kb} KB (source: ${result.source}${result.at ? ', snapshot of ' + result.at : ''})`)
// One instant landing page per property: /p/<id> is served straight from the CDN (see renderLanding)
const ORIGIN = (process.env.SITE_ORIGIN || 'https://www.afikhanahal.co.il').replace(/\/$/, '')

// Photos: warm every size the landing pages use on the image CDN (the first request for a size makes
// wsrv fetch and resize the original — 1-3 s the first visitor would otherwise wait), and fetch a 24px
// version of each to inline as a blurred placeholder. Best-effort: a few at a time, capped, never fatal.
async function prepareImages(list) {
  if (process.env.SKIP_IMAGE_WARM === '1') return { warmed: 0, lqip: 0 }
  const jobs = []
  for (const p of list) {
    const img = propertyMeta(p, { origin: ORIGIN }).image
    if (!img || img.endsWith('/img/og-default.png')) continue
    jobs.push(async () => {
      for (const u of landingImageUrls(p, ORIGIN)) {
        try {
          const r = await fetch(u, { signal: AbortSignal.timeout(12000) })
          if (r.ok && u === lqipUrl(img)) {
            const buf = Buffer.from(await r.arrayBuffer())
            if (buf.length > 0 && buf.length < 4000) p.__lqip = `data:image/jpeg;base64,${buf.toString('base64')}`
          } else await r.arrayBuffer().catch(() => {})
        } catch {}
      }
    })
  }
  let i = 0, done = 0
  const t0 = Date.now()
  const worker = async () => { while (i < jobs.length && Date.now() - t0 < 90000) { const j = jobs[i++]; await j(); done++ } }
  await Promise.all([1, 2, 3, 4].map(worker))
  return { warmed: done, lqip: list.filter(p => p.__lqip).length, ms: Date.now() - t0 }
}
const imgStats = await prepareImages(published)
console.log(`[build-properties] image CDN warmed for ${imgStats.warmed} properties, ${imgStats.lqip} placeholders${imgStats.ms ? ` (${Math.round(imgStats.ms / 1000)}s)` : ''}`)

let pages = 0
try {
  const template = readFileSync('dist/index.html', 'utf8')
  for (const p of published) {
    const id = String(p.id)
    if (!/^[\w-]{1,80}$/.test(id)) continue
    mkdirSync(`dist/p/${id}`, { recursive: true })
    writeFileSync(`dist/p/${id}/index.html`, renderLanding(template, p, { origin: ORIGIN }))
    pages++
  }
} catch (e) { console.warn(`[build-properties] landing pages skipped: ${e.message}`) }
console.log(`[build-properties] ${pages} instant landing pages in dist/p/`)
if (inlineImages) console.warn(`[build-properties] ${inlineImages} photos are stored inline (base64) — re-uploading them makes the list much lighter`)
process.exit(0)   // don't wait on Render requests that are still open
