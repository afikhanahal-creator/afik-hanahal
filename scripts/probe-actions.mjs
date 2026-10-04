// Opt-in live actions for the "Site speed probe" workflow (input `actions`, comma-separated):
//   slim — POST /api/properties?slim=1 until no inline photos remain (what the admin home does by itself)
//   ai      — one lead analysis for a synthetic test lead (reads only; costs one small Claude call)
//   rebuild — POST /api/properties?changed=1: refresh the snapshot and trigger the Vercel deploy hook
//   traffic — what each API answer weighs on the wire (gzip?) and whether a repeat poll gets an empty 304 — the
//             numbers behind Vercel's Fast Origin Transfer (10 GB / month on the free tier)
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
if (ACTIONS.includes('traffic')) {
  const AE = { 'Accept-Encoding': 'gzip, br' }
  const probe = async (label, path, opts = {}) => {
    const url = `${SITE}${path}`
    const t0 = Date.now()
    try {
      const r = await fetch(url, { ...opts, headers: { ...AE, ...(opts.headers || {}) }, signal: AbortSignal.timeout(30000) })
      const body = Buffer.from(await r.arrayBuffer())
      const wire = Number(r.headers.get('content-length') || 0) || body.length
      const etag = r.headers.get('etag')
      let again = null
      if (etag) { const r2 = await fetch(url, { ...opts, headers: { ...AE, ...(opts.headers || {}), 'If-None-Match': etag }, signal: AbortSignal.timeout(30000) }); again = r2.status; await r2.arrayBuffer().catch(() => {}) }
      console.log(`${String(r.status).padStart(4)}  wire ${String(Math.round(wire / 102.4) / 10).padStart(7)} KB  raw ${String(Math.round(body.length / 102.4) / 10).padStart(7)} KB  ${(r.headers.get('content-encoding') || '-').padEnd(5)} repeat→${again || 'no etag'}  cache=${r.headers.get('x-vercel-cache') || '-'}  ${Date.now() - t0} ms  ${label}`)
      return { body, r }
    } catch (e) { console.log(`  ERR  ${label}: ${e.message}`); return {} }
  }
  console.log('== traffic: public')
  const { body: listBody } = await probe('public list', '/api/properties')
  await probe('stats', '/api/stats'); await probe('news', '/api/news'); await probe('health', '/api/properties?health=1')
  let list = []; try { list = JSON.parse(String(listBody || '[]')) } catch {}
  const photo = (list.find(p => (p.images || []).length) || {}).images?.[0]
  if (photo) {
    const { photoUrl } = await import('../lib/img-url.js')
    console.log(`   photo source: ${photo.slice(0, 90)}`)
    for (const [lbl, u] of [['card photo via CDN (600)', photoUrl(photo, 600)], ['gallery photo via CDN (1200)', photoUrl(photo, 1200)]]) {
      const r = await fetch(u, { signal: AbortSignal.timeout(30000) }).catch(() => null)
      const b = r ? Buffer.from(await r.arrayBuffer()) : Buffer.alloc(0)
      console.log(`${String(r ? r.status : 'ERR').padStart(4)}  ${String(Math.round(b.length / 102.4) / 10).padStart(7)} KB  ${lbl} — no Vercel function`)
    }
  }
  console.log('== traffic: admin polls (gzip + 304)')
  await probe('contacts (full)', '/api/contacts', { headers: H })
  await probe('chat-list (30 s poll)', '/api/meta/chat-list?days=30', { headers: H })
  await probe('chat-status (60 s poll)', '/api/meta/chat-status', { headers: H })
  await probe('intake stats (3 min poll)', '/api/seller-form?action=stats', { headers: H })
  await probe('GA4 realtime (60 s poll)', '/api/meta/ga4?realtime=1', { headers: H })
  await probe('Meta leads (30 s poll)', '/api/meta/leads', { headers: H })
  const { body: chats } = await probe('chat-list again', '/api/meta/chat-list?days=30', { headers: H })
  let first = null; try { first = (JSON.parse(String(chats || '[]')).find(c => c.office) || JSON.parse(String(chats || '[]'))[0]) } catch {}
  if (first) await probe('chat-history of one chat (8 s poll)', '/api/meta/chat-history', { method: 'POST', headers: { ...H }, body: JSON.stringify({ phone: first.phone, count: 100 }) })
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
