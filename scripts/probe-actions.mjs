// Opt-in live actions for the "Site speed probe" workflow (input `actions`, comma-separated):
//   slim — POST /api/properties?slim=1 until no inline photos remain (what the admin home does by itself)
//   ai      — one lead analysis for a synthetic test lead (reads only; costs one small Claude call)
//   rebuild — POST /api/properties?changed=1: refresh the snapshot and trigger the Vercel deploy hook
//   restore — RESTORE_FROM (an older deployment's origin): its /properties.json is offered as the admin's copy
//             (POST ?snapshot=1) — properties the table lacks are added, nothing is overwritten
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
if (ACTIONS.includes('restore')) {
  const from = String(process.env.RESTORE_FROM || '').replace(/\/$/, '')
  if (!from) console.log('restore: RESTORE_FROM is empty')
  else {
    const r0 = await fetch(`${from}/properties.json`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) }).catch(e => ({ ok: false, status: 0, text: async () => e.message }))
    const list = r0.ok ? await r0.json().catch(() => null) : null
    if (!Array.isArray(list)) show(`restore: ${from}/properties.json (HTTP ${r0.status})`, { body: (await r0.text().catch(() => '')).slice(0, 300) })
    else {
      show('restore: source list', list.map(p => `${p.id}:${String(p.title || '').slice(0, 40)}`))
      const r = await fetch(`${SITE}/api/properties?snapshot=1`, { method: 'POST', headers: H, body: JSON.stringify({ list }), signal: AbortSignal.timeout(40000) })
      show(`restore (HTTP ${r.status})`, await r.json().catch(() => ({})))
      const h = await fetch(`${SITE}/api/properties?health=1`).then(r => r.json()).catch(e => ({ error: e.message }))
      show('health after restore', { serving: h.serving, table: h.table, snapshot: h.snapshot })
    }
  }
}
if (ACTIONS.includes('ai')) {
  // AI_LEAD: a JSON lead to analyse (workflow input `lead`); default is a synthetic test lead
  let lead = { name: 'בדיקת מערכת', phone: '', msg: 'מתעניין בדירת 4 חדרים בהוד השרון, תקציב 3 מיליון', source: 'contact_form' }
  try { if (process.env.AI_LEAD) lead = { ...lead, ...JSON.parse(process.env.AI_LEAD) } } catch (e) { console.log('AI_LEAD is not valid JSON:', e.message) }
  const rr = await fetch(`${SITE}/api/meta/lead-research`, { method: 'POST', headers: H, body: JSON.stringify({ lead }), signal: AbortSignal.timeout(65000) })
  const research = await rr.json().catch(() => ({}))
  show(`lead research (HTTP ${rr.status})`, { error: research.error, code: research.code, verdict: research.identity?.verdict, confidence: research.identity?.confidence, who: research.identity?.who, phone: research.phoneCheck?.type, name: research.nameCheck?.quality, profiles: (research.profiles || []).length, redFlags: research.redFlags, hooks: research.hooks, dataQuality: research.dataQuality, searches: research.searches, ms: research.ms, truncated: research.truncated })
  const r = await fetch(`${SITE}/api/meta/lead-analyze`, { method: 'POST', headers: H, body: JSON.stringify({ lead, research }), signal: AbortSignal.timeout(65000) })
  const d = await r.json().catch(() => ({}))
  show(`lead analysis (HTTP ${r.status})`, { aiError: d.aiError, aiCode: d.aiCode, model: d.model, score: d.score100, hasBrief: !!d.brief, summary: d.brief?.summary, identityCheck: d.brief?.identityCheck, openingLine: d.brief?.openingLine, warmUpPlan: d.brief?.warmUpPlan, questions: d.brief?.questionsToAsk, message: d.brief?.suggestedMessage })
}
