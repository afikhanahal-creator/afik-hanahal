// Opt-in live actions for the "Site speed probe" workflow (input `actions`, comma-separated):
//   slim — POST /api/properties?slim=1 until no inline photos remain (what the admin home does by itself)
//   ai      — one lead analysis for a synthetic test lead (reads only; costs one small Claude call)
//   rebuild — POST /api/properties?changed=1: refresh the snapshot and trigger the Vercel deploy hook
// The admin token is the one the site's own admin bundle carries (src/App.jsx) unless ADMIN_TOKEN is set.
import { readFileSync } from 'node:fs'

const SITE = (process.env.SITE || 'https://www.afikhanahal.co.il').replace(/\/$/, '')
const ACTIONS = String(process.env.ACTIONS || '').split(',').map(s => s.trim()).filter(Boolean)
const TOKEN = process.env.ADMIN_TOKEN || (readFileSync('src/App.jsx', 'utf8').match(/const ADMIN_TOKEN\s*=\s*'([^']+)'/) || [])[1]
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }
const show = (label, v) => console.log(`${label}: ${JSON.stringify(v, null, 1).slice(0, 1800)}`)

if (!ACTIONS.length) { console.log('no actions requested'); process.exit(0) }
if (ACTIONS.includes('slim')) {
  for (let i = 1; i <= 8; i++) {
    const r = await fetch(`${SITE}/api/properties?slim=1`, { method: 'POST', headers: H, signal: AbortSignal.timeout(40000) })
    const d = await r.json().catch(async () => ({ raw: (await r.text().catch(() => '')).slice(0, 300) }))
    show(`slim run ${i} (HTTP ${r.status})`, { uploaded: d.uploaded, remaining: d.remaining, errors: d.errors, error: d.error, properties: d.properties, done: d.done, ms: d.ms, raw: d.raw })
    if (!r.ok || !d.uploaded || !d.remaining) break
  }
  const h = await fetch(`${SITE}/api/properties?health=1`).then(r => r.json()).catch(e => ({ error: e.message }))
  show('health after slim', { list: h.list, snapshot: h.snapshot, serving: h.serving })
}
if (ACTIONS.includes('rebuild')) {
  const r = await fetch(`${SITE}/api/properties?changed=1`, { method: 'POST', headers: H, signal: AbortSignal.timeout(40000) })
  show(`rebuild (HTTP ${r.status})`, await r.json().catch(() => ({})))
}
if (ACTIONS.includes('ai')) {
  const r = await fetch(`${SITE}/api/meta/lead-analyze`, { method: 'POST', headers: H, body: JSON.stringify({ lead: { name: 'בדיקת מערכת', msg: 'מתעניין בדירת 4 חדרים בהוד השרון, תקציב 3 מיליון', source: 'contact_form' } }), signal: AbortSignal.timeout(60000) })
  const d = await r.json().catch(() => ({}))
  show(`lead analysis (HTTP ${r.status})`, { aiError: d.aiError, aiCode: d.aiCode, model: d.model, score: d.score100, hasBrief: !!d.brief, summary: d.brief && String(d.brief.summary || '').slice(0, 200) })
}
