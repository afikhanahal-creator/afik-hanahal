// Opt-in live actions for the "Site speed probe" workflow (input `actions`, comma-separated):
//   slim — POST /api/properties?slim=1 until no inline photos remain (what the admin home does by itself)
//   ai      — one lead analysis for a synthetic test lead (reads only; costs one small Claude call)
//   rebuild — POST /api/properties?changed=1: refresh the snapshot and trigger the Vercel deploy hook
//   traffic — what each API answer weighs on the wire (gzip?) and whether a repeat poll gets an empty 304 — the
//             numbers behind Vercel's Fast Origin Transfer (10 GB / month on the free tier)
//   connect — GET /api/meta/connect: Meta token / pages / leadgen webhook subscription / lead forms / ad account
//             (ACCOUNT) and campaigns, Green API state, the welcome rule; `connect-fix` also subscribes pages to leadgen
//   meta-sync — GET /api/meta/sync: saves every Meta lead the webhook missed (UNSUB_PAGES for connect: page ids to unsubscribe)
//   project-chat / project-chat-run — the project each CRM lead's WhatsApp conversation is about (dry / write; counts only)
//   crm-sync — POST /api/meta/crm-sync: copies every Meta lead that isn't in the CRM (contacts) yet, quietly (counts only)
//   wa — the WhatsApp chat page's own calls (chat-status / chat-list / chat-history): HTTP, timing, Green's error text;
//        `wa-send` also sends one test text through chat-send to the office's own notification number
//   chat-perf — every leg of the WhatsApp chat timed live (API calls N times, then PERF_ROUNDS test texts to the office
//        number: Green accepting, the webhook storing, a real browser getting it through the change bus, the status back)
//   ga4 — the analytics dashboard's connection: test, a 30-day dashboard (totals / row counts only) and realtime
//   booking — the booking page's calendar connection (OAuth keys set in Vercel? calendar connected? which account's domain)
//             and the last bookings' confirmation status (counts only)
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
// recache: every public Storage file without a one-year cache header written back with one (lib/shrink-photos.js) — counts only
if (ACTIONS.includes('recache')) {
  for (let i = 1; i <= 14; i++) {
    const r = await fetch(`${SITE}/api/properties?recache=1&mb=150`, { method: 'POST', headers: H, signal: AbortSignal.timeout(40000) })
    const d = await r.json().catch(() => ({}))
    show(`recache run ${i} (HTTP ${r.status})`, { checked: d.checked, needed: d.needed, neededMB: Math.round((d.neededBytes || 0) / 1048576), fixed: d.fixed, fixedMB: Math.round((d.fixedBytes || 0) / 1048576), remaining: d.remaining, errors: (d.errors || []).length, firstError: (d.errors || [])[0]?.replace(/^[^:]*: /, ''), error: d.error })
    if (!r.ok || !d.remaining || (!d.fixed && i > 1)) break
  }
}
if (ACTIONS.includes('booking')) {
  const r = await fetch(`${SITE}/api/meta/booking-admin`, { headers: H, signal: AbortSignal.timeout(30000) })
  const d = await r.json().catch(() => ({}))
  const c = d.calendar || {}
  const upcoming = (d.bookings || []).filter(b => b.status !== 'cancelled' && Date.parse(b.end) > Date.now())
  show(`booking (HTTP ${r.status})`, {
    oauthKeysInVercel: c.oauthReady, calendarConnected: c.connected, calendarError: c.error || null,
    calendarAccountDomain: c.email ? String(c.email).replace(/^.*@/, '@') : null,
    upcoming: upcoming.length, inCalendar: upcoming.filter(b => b.eventId).length,
    whatsappSent: upcoming.filter(b => b.wa?.ok).length, whatsappRefused: upcoming.filter(b => b.wa && !b.wa.ok).length,
    emailSent: upcoming.filter(b => b.mail?.ok).length, error: d.error,
  })
  const p = await fetch(`${SITE}/api/meta/booking-config`).then(x => x.json()).catch(e => ({ error: e.message }))
  show('booking-config (public)', { connected: p.connected, types: (p.types || []).map(t => `${t.id}:${t.minutes}m:${t.channels}`), error: p.error })
}
if (ACTIONS.includes('rebuild')) {
  const r = await fetch(`${SITE}/api/properties?changed=1&force=1`, { method: 'POST', headers: H, signal: AbortSignal.timeout(40000) })
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
if (ACTIONS.includes('connect') || ACTIONS.includes('connect-fix')) {
  const acct = String(process.env.ACCOUNT || '').replace(/\D/g, '')
  const unsub = String(process.env.UNSUB_PAGES || '').replace(/[^\d,]/g, '')
  const r = await fetch(`${SITE}/api/meta/connect?${acct ? `account=${acct}&` : ''}${unsub ? `unsub=${unsub}&` : ''}${ACTIONS.includes('connect-fix') ? 'fix=1' : ''}`, { headers: H, signal: AbortSignal.timeout(55000) })
  const d = await r.json().catch(async () => ({ raw: (await r.text().catch(() => '')).slice(0, 400) }))
  console.log(`connect (HTTP ${r.status}):\n${JSON.stringify(d, null, 1).slice(0, 9000)}`)
}
// docs: the documents module on the live site — the list read (counts only), the settings (wiring, no secrets), and a
// rendered PDF of a throw-away draft (docs-preview; nothing is stored) so the Hebrew font and the layout are proven live.
// docs-test: a real brokerage order for the office's own test lead (יוגב קידר, lead 125), sent to his WhatsApp — so the whole
// flow (link, signing page, signed PDF, the mails) can be tried again after a change. The log prints the document number
// and whether the send went out, never the link (the repo and this log are public; the link is the client's).
if (ACTIONS.includes('docs-test')) {
  const body = { leadId: '125', client: { name: 'יוגב קידר', phone: '0543049491', role: 'buyer' }, projectName: 'זרובבל 15',
    property: { address: 'זרובבל 15', city: 'רעננה', desc: 'דירת 4 חדרים (בדיקת מערכת)', type: 'דירה', dealType: 'sale', price: 3000000 },
    fees: { mode: 'percent', pct: 2, vatRate: 18, price: 3000000, terms: 'דמי התיווך ישולמו ב-2 תשלומים שווים.' }, agent: { name: 'ישראל בן-יהודה', phone: '0559811814' } }
  const t = Date.now()
  const r = await fetch(`${SITE}/api/meta/docs-create`, { method: 'POST', headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) })
  const d = await r.json().catch(() => ({}))
  show(`docs-test create (HTTP ${r.status}, ${Date.now() - t} ms)`, { number: d.doc?.number, status: d.doc?.status, lead: d.lead?.id, errors: d.errors, error: d.error })
  if (d.doc?.id) {
    const t2 = Date.now()
    const s2 = await fetch(`${SITE}/api/meta/docs-send`, { method: 'POST', headers: H, body: JSON.stringify({ id: d.doc.id, via: ['whatsapp'] }), signal: AbortSignal.timeout(60000) })
    const sd = await s2.json().catch(() => ({}))
    show(`docs-test send (HTTP ${s2.status}, ${Date.now() - t2} ms)`, { status: sd.doc?.status, results: (sd.results || []).map(x => ({ via: x.via, ok: x.ok, error: x.error })), error: sd.error })
  }
}
// social: the Facebook pages / Instagram accounts the office's System User reaches and which are in the inbox (names only — pages
// are public), the token's missing messaging scopes. admin-nav: open the inbox in a real browser on the live site and say which
// screen it lands on (the address and the screen's title, page errors) — no screenshot, no message text (the repo is public).
if (ACTIONS.includes('social')) {
  const r = await fetch(`${SITE}/api/meta/social-status`, { headers: H, signal: AbortSignal.timeout(60000) }).catch(e => ({ ok: false, status: 0, json: async () => ({ error: e.message }) }))
  const d = await r.json().catch(() => ({}))
  show(`social status (HTTP ${r.status})`, {
    missingScopes: d.missing, tokenError: d.tokenError, availableError: d.availableError, ok: d.ok, tablesMissing: d.tablesMissing,
    inbox: (d.pages || []).map(x => ({ name: x.name, messages: x.messages, leads: x.leads, error: x.error })),
    reachable: (d.available || []).map(x => ({ name: x.name, inbox: x.inbox, instagram: x.ig?.username || null })),
    instagram: (d.instagram || []).map(x => x.username),
  })
}
if (ACTIONS.includes('admin-nav')) {
  let chromium = null
  try { ({ chromium } = await import('playwright')) } catch { try { ({ chromium } = await import('playwright-core')) } catch {} }
  if (!chromium) show('admin-nav', { skipped: 'no browser' })
  else {
    const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
    for (const [label, size] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport: size, locale: 'he-IL', isMobile: label === 'phone', hasTouch: label === 'phone' })
      await ctx.addInitScript(() => { try { sessionStorage.setItem('afik_admin_session', '1'); localStorage.setItem('afik_no_track', '1') } catch {} })
      await ctx.route(/\.(mp4|mov|webm)(\?|$)/i, r => r.abort())
      const page = await ctx.newPage(); const errs = []
      page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 160)))
      const state = () => page.evaluate(() => ({ path: location.pathname, inbox: !!document.querySelector('.si'), chats: !!document.querySelector('.wa-chat, .wa-has-contact, [class*="wa-list"]'), title: (document.querySelector('.admin-nav-item[aria-current="page"]')?.innerText || '').trim().slice(0, 40) }))
      await page.goto(`${SITE}/admin-panel/social`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => errs.push('goto: ' + e.message))
      const seen = []
      for (const at of [2, 5, 9, 14]) { await page.waitForTimeout(at === 2 ? 2000 : (at === 5 ? 3000 : at === 9 ? 4000 : 5000)); seen.push({ at: `${at}s`, ...(await state().catch(e => ({ error: e.message }))) }) }
      show(`admin-nav ${label}: direct /admin-panel/social`, { seen, errors: errs.slice(0, 6) })
      await ctx.close()
    }
    await browser.close()
  }
}

if (ACTIONS.includes('docs')) {
  const call = async (label, path, init = {}) => {
    const t = Date.now()
    const r = await fetch(`${SITE}${path}`, { headers: H, ...init, signal: AbortSignal.timeout(55000) }).catch(e => ({ ok: false, status: 0, headers: new Map(), text: async () => e.message }))
    const type = r.headers?.get?.('content-type') || ''
    if (/pdf/.test(type)) { const b = Buffer.from(await r.arrayBuffer()); show(`docs ${label} (HTTP ${r.status}, ${Date.now() - t} ms)`, { pdf: b.length, header: b.slice(0, 5).toString() }); return null }
    const txt = await r.text().catch(() => '')
    let d = null; try { d = JSON.parse(txt) } catch {}
    show(`docs ${label} (HTTP ${r.status}, ${Date.now() - t} ms)`, d ? { docs: Array.isArray(d.docs) ? d.docs.length : undefined, status: d.status, settings: d.settings ? { vatRate: d.settings.vatRate, expiryDays: d.settings.expiryDays, agent: !!d.settings.agent?.name, notify: (d.settings.notify || []).length, clausesCustom: d.settings.clausesCustom, clauses: d.settings.clauses?.length } : undefined, error: d.error, errors: d.errors } : { raw: txt.slice(0, 200) })
    return d
  }
  const list = await call('list', '/api/meta/docs-list')
  // the files the office downloads (docs-file, admin login) — the newest signed documents and one sent one, every kind:
  // a whole PDF (%PDF … %%EOF) and a whole Word file (a zip with its end record); counts and sizes only
  {
    const docs = Array.isArray(list?.docs) ? list.docs : []
    const pick = [...docs.filter(x => x.status === 'signed').slice(0, 3), ...docs.filter(x => ['sent', 'opened'].includes(x.status)).slice(0, 1)]
    for (const doc of pick) for (const kind of doc.status === 'signed' ? ['original', 'signed', 'docx'] : ['original', 'docx']) {
      const t = Date.now()
      const r = await fetch(`${SITE}/api/meta/docs-file?id=${encodeURIComponent(doc.id)}&kind=${kind}`, { headers: H, signal: AbortSignal.timeout(55000) }).catch(e => ({ ok: false, status: 0, error: e.message }))
      const b = r.arrayBuffer ? Buffer.from(await r.arrayBuffer()) : Buffer.alloc(0)
      const whole = kind === 'docx' ? b.slice(0, 2).toString() === 'PK' && b.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])) : b.slice(0, 5).toString() === '%PDF-' && b.slice(-1024).includes(Buffer.from('%%EOF'))
      show(`docs file ${doc.number} ${kind} (HTTP ${r.status}, ${Date.now() - t} ms)`, { bytes: b.length, whole, type: r.headers?.get?.('content-type') || '', error: r.ok ? undefined : (r.error || b.toString().slice(0, 160)) })
    }
    if (pick[0]) { const r = await fetch(`${SITE}/api/meta/docs-file?id=${encodeURIComponent(pick[0].id)}&kind=original`, { signal: AbortSignal.timeout(30000) }).catch(() => ({ status: 0 })); show('docs file without the admin login', { status: r.status, expected: 401 }) }
  }
  await call('settings', '/api/meta/docs-settings')
  { const d = await call('templates', '/api/meta/docs-templates'); if (d?.missingMigration) show('docs templates', { warning: 'server/documents-v2-migration.sql has not been applied' }) }
  { const d = await call('drive status', '/api/meta/docs-drive-status'); if (d) show('docs drive', { connected: !!d.connected, oauthReady: !!d.oauthReady, enabled: d.enabled, counts: d.counts, error: d.error }) }
  await call('preview PDF', '/api/meta/docs-preview', { method: 'POST', body: JSON.stringify({ client: { name: 'בדיקה בדיקתי', phone: '0500000000' }, property: { address: 'רחוב הבדיקה 1', city: 'רעננה', dealType: 'sale' }, fees: { mode: 'percent', pct: 2, price: 1000000 }, agent: { name: 'בדיקה' } }) })
}

if (ACTIONS.includes('wa') || ACTIONS.includes('wa-send') || ACTIONS.includes('wa-fix')) {
  const call = async (label, path, init = {}) => {
    const t = Date.now()
    const r = await fetch(`${SITE}${path}`, { headers: H, ...init, signal: AbortSignal.timeout(30000) }).catch(e => ({ ok: false, status: 0, text: async () => e.message }))
    const txt = await r.text().catch(() => '')
    let d = null; try { d = JSON.parse(txt) } catch {}
    const brief = Array.isArray(d) ? { items: d.length } : d ? { state: d.state, http: d.http, ok: d.ok, error: d.error, detail: typeof d.detail === 'string' ? d.detail.slice(0, 200) : d.detail } : { raw: txt.slice(0, 200) }
    show(`wa ${label} (HTTP ${r.status}, ${Date.now() - t} ms)`, brief)
    return d
  }
  await call('chat-status', '/api/meta/chat-status')
  if (ACTIONS.includes('wa-fix')) await call('chat-settings FIX (turn the journals on)', '/api/meta/chat-settings', { method: 'POST', body: JSON.stringify({ fix: true }) })
  { const t = Date.now(); const r = await fetch(`${SITE}/api/meta/chat-settings`, { headers: H, signal: AbortSignal.timeout(30000) }).catch(() => null); show(`wa chat-settings (HTTP ${r?.status}, ${Date.now() - t} ms)`, r ? await r.json().catch(() => null) : null) }
  await call('auto-status', '/api/meta/auto-status')
  const list = await call('chat-list', '/api/meta/chat-list?days=30')
  const one = Array.isArray(list) ? (list.find(c => !c.office && !c.self) || list[0]) : null
  if (one) await call('chat-history (one chat)', '/api/meta/chat-history', { method: 'POST', body: JSON.stringify({ phone: one.phone, count: 20 }) })
  if (Array.isArray(list) && list.length) {
    // profile pictures of the 10 newest chats — counts only (the log is public: never a link or a number)
    const t = Date.now()
    const r = await fetch(`${SITE}/api/meta/chat-avatars`, { method: 'POST', headers: H, body: JSON.stringify({ phones: list.slice(0, 10).map(c => c.phone) }), signal: AbortSignal.timeout(40000) }).catch(() => null)
    const d = r ? await r.json().catch(() => null) : null
    const v = Object.values(d?.avatars || {})
    show(`wa chat-avatars (HTTP ${r?.status}, ${Date.now() - t} ms)`, { asked: Math.min(10, list.length), answered: v.length, withPicture: v.filter(Boolean).length, error: d?.error })
  }
  if (ACTIONS.includes('wa-send')) {
    const office = Array.isArray(list) ? list.find(c => c.office) : null
    await call('chat-send (to the office number)', '/api/meta/chat-send', { method: 'POST', body: JSON.stringify({ phone: office?.phone || '972559811814', message: 'בדיקת מערכת: שליחה מעמוד הווצאפ ✓' }) })
  }
}
// chat-perf: every leg of the WhatsApp chat, timed on the live site (numbers only — never a phone, a name or a text):
// the API calls the chat screens make (N runs each: wall time, the function's own time from Server-Timing, the region from
// x-vercel-id, cold starts), then ROUNDS test texts to the office's own notification number — Green accepting it, the webhook
// storing it (chat-updates shows the id), a real browser on /admin-panel/chats getting it through the change bus, and the
// delivery status coming back.
if (ACTIONS.includes('chat-perf')) {
  const N = Number(process.env.PERF_RUNS || 6), ROUNDS = Number(process.env.PERF_ROUNDS || 2)
  const OFFICE = '972559811814'
  const st = h => Object.fromEntries(String(h || '').split(',').map(x => x.trim()).filter(Boolean).map(x => { const [k, ...rest] = x.split(';'); const d = (rest.find(r => r.trim().startsWith('dur=')) || '').split('=')[1]; return [k.trim(), d != null ? Math.round(Number(d)) : 1] }))
  const time = async (path, init = {}) => {
    const t = performance.now()
    const r = await fetch(`${SITE}${path}`, { headers: H, ...init, signal: AbortSignal.timeout(40000) }).catch(e => ({ ok: false, status: 0, headers: new Headers(), text: async () => e.message }))
    const body = await r.text().catch(() => '')
    const ms = Math.round(performance.now() - t)
    const id = r.headers.get('x-vercel-id') || ''
    return { ms, http: r.status, bytes: body.length, region: id.split('::').slice(0, -1).join('>'), timing: st(r.headers.get('server-timing')), raw: String(r.headers.get('server-timing') || '').replace(/;desc="(\d+)"/g, '×$1').replace(/;dur=/g, ' '), body }
  }
  const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null }
  const bench = async (label, path, init) => {
    const runs = []
    for (let i = 0; i < N; i++) runs.push(await time(path, typeof init === 'function' ? init() : init))
    const ms = runs.map(r => r.ms), app = runs.map(r => r.timing.app).filter(x => x != null)
    const keys = [...new Set(runs.flatMap(r => Object.keys(r.timing)))].filter(k => k !== 'app' && k !== 'cold')
    const parts = Object.fromEntries(keys.map(k => [k, pct(runs.map(r => r.timing[k]).filter(x => x != null), 0.5)]))
    show(`perf ${label}`, { http: [...new Set(runs.map(r => r.http))], wall_p50: pct(ms, 0.5), wall_max: Math.max(...ms), fn_p50: pct(app, 0.5), fn_max: app.length ? Math.max(...app) : null, parts, cold: runs.filter(r => r.timing.cold).length, region: [...new Set(runs.map(r => r.region))], kb: Math.round(pct(runs.map(r => r.bytes), 0.5) / 102.4) / 10, raw: runs.map(r => r.raw).slice(0, 3) })
    return runs
  }
  const since = () => new Date(Date.now() - 60e3).toISOString()
  const ONLY = String(process.env.PERF_ONLY || '')
  await bench('chat-updates', `/api/meta/chat-updates?since=${encodeURIComponent(since())}`)
  await bench('chat-history stored (a chat opens)', '/api/meta/chat-history', { method: 'POST', body: JSON.stringify({ phone: OFFICE, count: 100, stored: true }) })
  await bench('chat-history full (Green getChatHistory)', '/api/meta/chat-history', { method: 'POST', body: JSON.stringify({ phone: OFFICE, count: 100 }) })
  await bench('chat-waiting', '/api/meta/chat-waiting')
  await bench('chat-list', '/api/meta/chat-list?days=30')
  await bench('chat-status', '/api/meta/chat-status')
  await bench('social-wa (inbox list)', '/api/meta/social-wa')
  await bench('social-threads (inbox list)', '/api/meta/social-threads')
  await bench('contacts (leads board)', '/api/contacts?limit=1')

  // end to end: a real browser on the chats screen + test texts to the office number
  let chromium = null
  try { ({ chromium } = await import('playwright')) } catch { try { ({ chromium } = await import('playwright-core')) } catch {} }
  let browser = null, page = null
  if (chromium) {
    browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' })
    await ctx.addInitScript(() => {
      try { sessionStorage.setItem('afik_admin_session', '1'); localStorage.setItem('afik_no_track', '1') } catch {}
      window.__cu = []
      const f0 = window.fetch
      window.fetch = async (...a) => {
        const u = String(a[0]?.url || a[0] || '')
        if (!/chat-updates/.test(u)) return f0(...a)
        const start = Date.now()
        const r = await f0(...a)
        r.clone().json().then(d => window.__cu.push({ start, end: Date.now(), ids: (d?.messages || []).map(m => [m.idMessage, m.statusMessage]) })).catch(() => {})
        return r
      }
    })
    await ctx.route(/\.(mp4|mov|webm)(\?|$)/i, r => r.abort())
    page = await ctx.newPage()
    const t = Date.now()
    await page.goto(`${SITE}/admin-panel/chats`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {})
    await page.waitForTimeout(9000)
    show('perf browser', { loaded_ms: Date.now() - t })
  }
  const rounds = []
  for (let k = 0; k < ROUNDS; k++) {
    const t0 = Date.now()
    const s = await time('/api/meta/chat-send', { method: 'POST', body: JSON.stringify({ phone: OFFICE, message: `בדיקת מהירות של מערכת הצ׳אט (אפשר להתעלם) · ${k + 1}` }) })
    let sid = null; try { sid = JSON.parse(s.body).idMessage } catch {}
    const out = { send_http: s.http, accept_ms: s.ms, accept_fn: s.timing.app, accept_green: s.timing.green, cold: !!s.timing.cold }
    if (sid) {
      const cur = new Date(t0 - 10e3).toISOString()
      let stored = null, status = null
      while (Date.now() - t0 < 45000 && (!stored || !status)) {
        const u = await time(`/api/meta/chat-updates?since=${encodeURIComponent(cur)}`)
        let d = null; try { d = JSON.parse(u.body) } catch {}
        const m = (d?.messages || []).find(x => x.idMessage === sid)
        if (m && !stored) stored = Date.now() - t0
        if (m && ['sent', 'delivered', 'read'].includes(m.statusMessage) && !status) status = Date.now() - t0
        await new Promise(ok => setTimeout(ok, 250))
      }
      out.stored_after_send_ms = stored
      out.status_after_send_ms = status
      if (page) {
        const deadline = Date.now() + 15000
        let hit = null
        while (Date.now() < deadline && !hit) {
          hit = await page.evaluate(id => (window.__cu || []).find(c => c.ids.some(([i]) => i === id)) || null, sid)
          if (!hit) await page.waitForTimeout(150)
        }
        out.browser_fetch_started_ms = hit ? hit.start - t0 : null
        out.browser_has_it_ms = hit ? hit.end - t0 : null
        out.browser_fetch_ms = hit ? hit.end - hit.start : null
      }
    }
    rounds.push(out)
    show(`perf send round ${k + 1}`, out)
    await new Promise(ok => setTimeout(ok, 4000))
  }
  if (page) show('perf browser chat-updates calls', { calls: await page.evaluate(() => window.__cu.length) })
  if (browser) await browser.close()
}

if (ACTIONS.includes('ga4')) {
  const post = async (body, path = 'ga4-dash') => {
    const t = Date.now()
    const r = await fetch(`${SITE}/api/meta/${path}`, { method: 'POST', headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(55000) }).catch(e => ({ ok: false, status: 0, json: async () => ({ error: e.message }) }))
    const d = await r.json().catch(() => ({}))
    return { http: r.status, ms: Date.now() - t, d }
  }
  const health = await fetch(`${SITE}/api/properties?health=1`).then(r => r.json()).catch(() => ({}))
  show('ga4 env configured (health)', health?.env?.ga4)
  const test = await post({ type: 'test' })
  show(`ga4 test (HTTP ${test.http}, ${test.ms} ms)`, { configured: test.d.configured, ok: test.d.ok, property: test.d.property, missing: test.d.missing, error: test.d.error, kind: test.d.kind, keyId: test.d.keyId })
  if (test.d.ok) {
    const end = new Date().toISOString().slice(0, 10), s = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)
    const dash = await post({ type: 'dashboard', start: s, end, fresh: true })
    const R = dash.d.reports || {}
    const tot = (R.totals?.rows?.[0]?.metricValues || []).map(v => Number(v.value))
    show(`ga4 dashboard 30d (HTTP ${dash.http}, ${dash.ms} ms)`, { error: dash.d.error, reports: Object.keys(R).length, emptyReports: Object.entries(R).filter(([, v]) => !v?.rows?.length).map(([k]) => k), users: tot[0], sessions: tot[2], views: tot[4], contacts: Number(R.convTotals?.rows?.[0]?.metricValues?.[0]?.value || 0), days: R.timeseries?.rows?.length || 0, channels: R.channels?.rows?.length || 0 })
    const rt = await post({ type: 'realtime' })
    show(`ga4 realtime (HTTP ${rt.http}, ${rt.ms} ms)`, { error: rt.d.error, activeUsers: Number(rt.d.rt?.now?.totals?.[0]?.metricValues?.[0]?.value || 0), minuteRows: rt.d.rt?.byMinute?.rows?.length || 0, todayChannels: rt.d.rt?.todayChannels?.rows?.length || 0 })
  }
}
if (ACTIONS.includes('meta-sync')) {
  // Full Meta Lead Ads sync: every lead the webhook missed is saved (only leads ≤ 24 h old are welcomed / announced)
  const r = await fetch(`${SITE}/api/meta/sync`, { headers: H, signal: AbortSignal.timeout(60000) })
  show(`meta sync (HTTP ${r.status})`, await r.json().catch(() => ({})))
}
if (ACTIONS.includes('crm-sync')) {
  const r = await fetch(`${SITE}/api/meta/crm-sync`, { method: 'POST', headers: H, signal: AbortSignal.timeout(60000) })
  show(`crm sync (HTTP ${r.status})`, await r.json().catch(() => ({})))
}
// project-chat = which CRM leads' WhatsApp conversations point at a project (dry: nothing is written); project-chat-run = do it
// (the first full look; the lead ticks continue from there). Counts and project names only — never a lead.
if (ACTIONS.includes('project-chat') || ACTIONS.includes('project-chat-run')) {
  const dry = !ACTIONS.includes('project-chat-run')
  const r = await fetch(`${SITE}/api/meta/auto-project-chat`, { method: 'POST', headers: H, body: JSON.stringify({ dry, full: true, max: 400 }), signal: AbortSignal.timeout(60000) })
  const d = await r.json().catch(() => ({}))
  const moves = {}
  for (const c of d.changes || []) { const k = `${c.from || '(בלי פרויקט)'} → ${c.project}${c.error ? ' (error)' : ''}`; moves[k] = (moves[k] || 0) + 1 }
  show(`project from chats${dry ? ' (dry)' : ''} (HTTP ${r.status})`, { phones: d.phones, looked: d.looked, assigned: d.assigned, moved: d.moved, pending: d.pending, error: d.error, moves })
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
