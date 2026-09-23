// ── WhatsApp automation engine (server side) ────────────────────────────────────
// One engine, four entry points:
//   • api/contacts.js  POST  → onLeadCreated()   (instant welcome message)
//   • api/contacts.js  PATCH → onStageChanged()  (board stage moved)
//   • api/meta.js      auto-*→ run(), sendItems(), skip, config, log, status (admin "אוטומציות" tab)
//   • api/cron/warm.js       → run()             (daily safety net when nobody has the panel open)
//
// Per-lead state lives in contacts.crm_data.auto:
//   { sent: {ruleKey: iso}, skipped: {ruleKey: iso}, tries: {ruleKey: n}, optOut, optOutAt,
//     replied, intent, lastInboundTs, lastInboundText, stageAt: {stage, at, from}, move: {stage, at}, log: [...] }
// Settings live in the Supabase table app_settings (key 'automations'), the send log in automation_log
// (both created by server/automations-migration.sql). Without the tables the engine still runs on the
// built-in defaults and keeps its log inside each lead.

import { mergeConfig, getTemplate, renderTemplate, isSendWindow, classifyReply, intlPhone, leadLang, RULE_LABELS, ruleKind } from './automations-shared.js'

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const GREEN_INSTANCE = process.env.WA_GREENAPI_INSTANCE || ''
const GREEN_TOKEN = process.env.WA_GREENAPI_TOKEN || ''
const TEAM_CHAT = (process.env.BUSINESS_NOTIFY_CHATID || '972559811814').replace(/@.*/, '').replace(/\D/g, '')
const GREEN_BASE = (() => { const r = String(GREEN_INSTANCE).slice(0, 4); return r ? `https://${r}.api.greenapi.com` : 'https://api.green-api.com' })()
const greenUrl = m => `${GREEN_BASE}/waInstance${GREEN_INSTANCE}/${m}/${GREEN_TOKEN}`
export const greenConfigured = () => !!(GREEN_INSTANCE && GREEN_TOKEN)

const CONTACT_COLS = 'id,name,phone,email,message,prop_title,prop_location,source,created_at,crm_data'
const LOG_KEEP = 25
const sleep = ms => new Promise(r => setTimeout(r, ms))
const nowIso = () => new Date().toISOString()
const ts = v => (v ? new Date(v).getTime() || 0 : 0)

// ── Supabase REST ──────────────────────────────────────────────────────────────
async function supa(path, opts = {}) {
  if (!SUPA_URL || !SUPA_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing')
  return fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) },
    signal: opts.signal || AbortSignal.timeout(10000),
  })
}
const tableMissing = (status, body) => status === 404 || /PGRST205|42P01|does not exist|Could not find the table/i.test(body || '')

// ── Settings ───────────────────────────────────────────────────────────────────
let cfgCache = null
export async function loadConfig({ fresh = false } = {}) {
  if (!fresh && cfgCache && Date.now() - cfgCache.at < 30000) return cfgCache.value
  let saved = null, storage = 'ok', updatedAt = null
  try {
    const r = await supa('/app_settings?key=eq.automations&select=value,updated_at', { signal: AbortSignal.timeout(6000) })
    const body = await r.text()
    if (r.ok) { const rows = JSON.parse(body || '[]'); saved = rows[0]?.value || null; updatedAt = rows[0]?.updated_at || null }
    else storage = tableMissing(r.status, body) ? 'missing' : 'error'
  } catch { storage = 'error' }
  const cfg = mergeConfig(saved)
  // Backward compatibility with the old env switches for the welcome message
  if (process.env.WA_AUTOREPLY_ENABLED === 'false' && !saved?.rules?.welcome?.mode) cfg.rules.welcome.mode = 'off'
  if (process.env.WA_AUTOREPLY_TEMPLATE && !saved?.templates?.welcome) cfg.templates = { ...cfg.templates, welcome: { ...(cfg.templates.welcome || {}), he: process.env.WA_AUTOREPLY_TEMPLATE } }
  const value = { cfg, storage, updatedAt, saved: !!saved }
  cfgCache = { at: Date.now(), value }
  return value
}
export async function saveConfig(next) {
  const r = await supa('/app_settings?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: 'automations', value: next, updated_at: nowIso() }),
  })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    if (tableMissing(r.status, body)) throw new Error('טבלת app_settings לא קיימת – הריצו את server/automations-migration.sql ב-Supabase')
    throw new Error(`Supabase ${r.status}: ${body.slice(0, 200)}`)
  }
  cfgCache = null
  return true
}

// ── Green API ──────────────────────────────────────────────────────────────────
export async function sendText(phone, message) {
  if (!greenConfigured()) return { ok: false, error: 'Green API לא מוגדר ב-Vercel (WA_GREENAPI_INSTANCE / WA_GREENAPI_TOKEN)' }
  const p = intlPhone(phone)
  if (!p || p.length < 11) return { ok: false, error: 'מספר טלפון לא תקין' }
  if (!String(message || '').trim()) return { ok: false, error: 'הודעה ריקה' }
  try {
    const r = await fetch(greenUrl('sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: `${p}@c.us`, message: String(message).slice(0, 4000) }),
      signal: AbortSignal.timeout(15000),
    })
    const t = await r.text()
    if (!r.ok) {
      const hint = r.status === 466 ? ' (מגבלת התוכנית ב-Green API)' : r.status === 401 || r.status === 403 ? ' (טוקן או instance שגויים)' : ''
      return { ok: false, error: `Green API ${r.status}${hint}: ${t.slice(0, 160)}` }
    }
    let d = {}; try { d = JSON.parse(t) } catch {}
    return { ok: true, idMessage: d.idMessage || null }
  } catch (e) { return { ok: false, error: e.name === 'TimeoutError' ? 'Green API לא ענה בזמן' : e.message } }
}

export async function greenStatus() {
  if (!greenConfigured()) return { configured: false, state: 'notConfigured', missing: [!GREEN_INSTANCE && 'WA_GREENAPI_INSTANCE', !GREEN_TOKEN && 'WA_GREENAPI_TOKEN'].filter(Boolean) }
  const out = { configured: true, instance: GREEN_INSTANCE }
  try {
    const r = await fetch(greenUrl('getStateInstance'), { signal: AbortSignal.timeout(8000) })
    const d = await r.json().catch(() => ({}))
    out.http = r.status
    out.state = d.stateInstance || (r.ok ? 'unknown' : 'error')
    if (!r.ok) out.error = r.status === 401 || r.status === 403 ? 'הטוקן או מספר ה-instance שגויים' : `HTTP ${r.status}`
  } catch (e) { out.state = 'error'; out.error = e.message }
  if (out.state === 'authorized') {
    try {
      const r = await fetch(greenUrl('getWaSettings'), { signal: AbortSignal.timeout(8000) })
      if (r.ok) { const d = await r.json(); out.phone = d.phone || ''; out.avatar = d.avatar || '' }
    } catch {}
  }
  return out
}

// Incoming messages of the last `minutes`, grouped by phone (1:1 chats only), oldest first
async function fetchInbound(minutes) {
  const r = await fetch(`${greenUrl('lastIncomingMessages')}?minutes=${Math.max(60, Math.min(minutes, 43200))}`, { signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`lastIncomingMessages ${r.status}`)
  const list = await r.json().catch(() => [])
  const map = new Map()
  for (const m of Array.isArray(list) ? list : []) {
    const chatId = m.chatId || ''
    if (!chatId.endsWith('@c.us')) continue
    const phone = chatId.split('@')[0]
    const text = m.textMessage || m.caption || m.extendedTextMessage?.text || (m.typeMessage ? `[${m.typeMessage}]` : '')
    const arr = map.get(phone) || []
    arr.push({ id: m.idMessage, ts: (m.timestamp || 0) * 1000, text })
    map.set(phone, arr)
  }
  for (const arr of map.values()) arr.sort((a, b) => a.ts - b.ts)
  return map
}

// ── Leads ──────────────────────────────────────────────────────────────────────
async function listLeads(limit = 500) {
  let r = await supa(`/contacts?select=${CONTACT_COLS}&order=created_at.desc&limit=${limit}`)
  if (r.status === 400) r = await supa(`/contacts?select=*&order=created_at.desc&limit=${limit}`)
  if (!r.ok) throw new Error(`Supabase contacts ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`)
  return r.json()
}
async function getLead(id) {
  if (!id || String(id).startsWith('bk:')) return null
  const r = await supa(`/contacts?id=eq.${encodeURIComponent(id)}&select=*`, { signal: AbortSignal.timeout(6000) })
  if (!r.ok) return null
  const rows = await r.json().catch(() => [])
  return rows[0] || null
}
async function findLeadByPhone(phone) {
  const p = intlPhone(phone)
  if (!p) return null
  const local = '0' + p.slice(3)
  const r = await supa(`/contacts?or=(phone.eq.${p},phone.eq.${local},phone.eq.%2B${p})&select=*&order=created_at.desc&limit=1`, { signal: AbortSignal.timeout(6000) }).catch(() => null)
  if (!r || !r.ok) return null
  const rows = await r.json().catch(() => [])
  return rows[0] || null
}

// Read-modify-write of crm_data.auto (fresh read so concurrent edits of other crm fields survive)
async function updateAuto(leadId, mutate, extraCrm = null) {
  const lead = await getLead(leadId)
  if (!lead) return null
  const crm = { ...(lead.crm_data || {}) }
  const auto = { sent: {}, skipped: {}, tries: {}, log: [], ...(crm.auto || {}) }
  mutate(auto, crm)
  crm.auto = auto
  if (extraCrm) Object.assign(crm, extraCrm)
  const r = await supa(`/contacts?id=eq.${encodeURIComponent(leadId)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ crm_data: crm }), signal: AbortSignal.timeout(8000) })
  if (!r.ok) console.error('[automations] crm_data patch failed', r.status, (await r.text().catch(() => '')).slice(0, 160))
  return { ...lead, crm_data: crm }
}

async function writeLog(row) {
  try {
    const r = await supa('/automation_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row), signal: AbortSignal.timeout(6000) })
    if (!r.ok && r.status !== 404) console.warn('[automations] log insert', r.status)
  } catch {}
}

async function recordSend(lead, { ruleKey, templateId, text, result, by }) {
  const at = nowIso()
  const entry = { at, ruleKey, templateId: templateId || null, ok: !!result.ok, error: result.ok ? null : String(result.error || '').slice(0, 200), text: String(text || '').slice(0, 160), by }
  if (lead?.id && !String(lead.id).startsWith('bk:')) {
    await updateAuto(lead.id, auto => {
      auto.log = [entry, ...(auto.log || [])].slice(0, LOG_KEEP)
      auto.tries = { ...(auto.tries || {}), [ruleKey]: (auto.tries?.[ruleKey] || 0) + 1 }
      if (result.ok) auto.sent = { ...(auto.sent || {}), [ruleKey]: at }
    })
  }
  await writeLog({ lead_id: lead?.id != null ? String(lead.id) : null, phone: intlPhone(lead?.phone), name: lead?.name || null, rule_key: ruleKey, template_id: templateId || null, message: String(text || '').slice(0, 2000), ok: !!result.ok, error: entry.error, by })
  return entry
}

async function notifyTeam(text) {
  if (!TEAM_CHAT) return { ok: false, error: 'no team chat' }
  return sendText(TEAM_CHAT, text)
}

// ── Entry point 1: a new lead was saved ────────────────────────────────────────
function welcomeFor(lead, cfg) {
  const rule = cfg.rules.welcome
  const hasProp = !!(lead.prop_title || lead.propTitle)
  const tpl = (hasProp && rule.propTemplateId && getTemplate(cfg, rule.propTemplateId)) || getTemplate(cfg, rule.templateId)
  return tpl ? { templateId: tpl.id, text: renderTemplate(tpl, lead, cfg) } : null
}
export async function onLeadCreated(lead) {
  try {
    if (!lead?.phone) return { skipped: 'no phone' }
    const { cfg } = await loadConfig()
    if (!cfg.enabled || cfg.rules.welcome.mode !== 'auto') return { skipped: 'welcome not automatic' }
    const w = welcomeFor(lead, cfg)
    if (!w) return { skipped: 'no template' }
    const result = await sendText(lead.phone, w.text)
    await recordSend(lead, { ruleKey: 'welcome', templateId: w.templateId, text: w.text, result, by: 'auto' })
    return result
  } catch (e) { console.error('[automations] welcome', e.message); return { ok: false, error: e.message } }
}

// Text of the welcome template for Meta Lead Ads (they live in a separate table, only the text is shared)
export async function welcomeTextFor(lead) {
  // '' = the office switched the welcome message off · null = unknown (caller keeps its default text)
  try { const { cfg } = await loadConfig(); if (!cfg.enabled || cfg.rules.welcome.mode === 'off') return ''; return welcomeFor(lead, cfg)?.text || null }
  catch { return null }
}

// ── Entry point 2: the board stage changed (called after the PATCH saved leadStatus) ─
export async function onStageChanged(leadId, stage, from) {
  try {
    const at = nowIso()
    const lead = await updateAuto(leadId, auto => { auto.stageAt = { stage, at, from: from || null } })
    if (!lead) return { skipped: 'lead not found' }
    const { cfg } = await loadConfig()
    const rule = cfg.rules.stage?.[stage]
    if (!cfg.enabled || !rule || rule.mode === 'off') return { skipped: 'no rule' }
    const auto = lead.crm_data?.auto || {}
    const ruleKey = `stage:${stage}`
    const tpl = getTemplate(cfg, rule.templateId)
    if (!tpl || !lead.phone) return { skipped: 'no template/phone' }
    const text = renderTemplate(tpl, lead, cfg)
    if (auto.optOut) return { skipped: 'opted out' }
    if (auto.sent?.[ruleKey]) return { skipped: 'already sent', ruleKey }
    if (rule.mode !== 'auto') return { suggest: true, ruleKey, templateId: tpl.id, text }
    const result = await sendText(lead.phone, text)
    await recordSend(lead, { ruleKey, templateId: tpl.id, text, result, by: 'auto' })
    return { ...result, sent: result.ok, ruleKey, text }
  } catch (e) { console.error('[automations] stage', e.message); return { ok: false, error: e.message } }
}

// ── Run lock ───────────────────────────────────────────────────────────────────
// Several people may have the admin panel open (each one triggers runs) plus the daily cron. Only one run
// at a time may send or write; the others compute the approval queue read-only. The lock is a row in
// app_settings taken with a conditional UPDATE (atomic in Postgres) and expires on its own after 90s.
const LOCK_KEY = 'automations_lock'
async function acquireLock(source) {
  try {
    await supa('/app_settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ key: LOCK_KEY, value: {}, updated_at: '1970-01-01T00:00:00Z' }), signal: AbortSignal.timeout(5000) })
    const stale = new Date(Date.now() - 90000).toISOString()
    const r = await supa(`/app_settings?key=eq.${LOCK_KEY}&updated_at=lt.${encodeURIComponent(stale)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ updated_at: nowIso(), value: { source } }), signal: AbortSignal.timeout(5000) })
    if (!r.ok) return tableMissing(r.status, await r.text().catch(() => '')) ? 'none' : 'error'
    const rows = await r.json().catch(() => [])
    return rows.length ? 'held' : 'busy'
  } catch { return 'error' }
}
async function releaseLock() {
  await supa(`/app_settings?key=eq.${LOCK_KEY}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ updated_at: '1970-01-01T00:00:00Z' }), signal: AbortSignal.timeout(5000) }).catch(() => {})
}

// ── Entry point 3: the periodic run ────────────────────────────────────────────
// Executes every rule in 'auto' mode that is due, and returns every rule in 'suggest' mode that is due
// as an item for the approval queue. Safe to call often: each (lead, rule) pair is sent at most once.
export async function run(opts = {}) {
  const lock = opts.dry ? 'none' : await acquireLock(opts.source || 'panel')
  if (lock === 'busy') { const out = await runInner({ ...opts, dry: true }); out.notes.push('another run is in progress – read-only'); return out }
  try { return await runInner(opts) }
  finally { if (lock === 'held') await releaseLock() }
}
async function runInner({ source = 'panel', maxSends = 12, budgetMs = 20000, dry = false } = {}) {
  const started = Date.now()
  const { cfg, storage } = await loadConfig({ fresh: true })
  const out = { ok: true, source, at: nowIso(), storage, enabled: cfg.enabled, window: isSendWindow(cfg), suggestions: [], sent: [], errors: [], moves: [], notes: [], stats: { leads: 0, optOut: 0, replied: 0, positive: 0, negative: 0 } }
  if (!cfg.enabled) { out.notes.push('disabled'); return out }

  const installed = ts(cfg.installedAt)
  let leads = []
  try { leads = await listLeads() } catch (e) { out.ok = false; out.errors.push({ error: e.message }); return out }
  out.stats.leads = leads.length

  let inbound = null
  if (greenConfigured()) {
    const oldest = Math.min(...leads.map(l => ts(l.created_at)).filter(Boolean), Date.now())
    const minutes = Math.ceil((Date.now() - Math.max(oldest, installed, Date.now() - 30 * 864e5)) / 60000) + 60
    try { inbound = await fetchInbound(minutes) } catch (e) { out.notes.push(`inbound: ${e.message}`) }
  } else out.notes.push('green not configured')

  const now = Date.now()
  const canAutoSend = isSendWindow(cfg)
  let sends = 0
  const timeLeft = () => budgetMs - (Date.now() - started)
  const suggest = (lead, ruleKey, tpl, reason, extra = {}) => out.suggestions.push({
    id: `${lead.id}:${ruleKey}`, leadId: String(lead.id), name: lead.name || '', phone: intlPhone(lead.phone), ruleKey, kind: ruleKind(ruleKey),
    templateId: tpl.id, text: renderTemplate(tpl, lead, cfg), reason, lang: leadLang(lead), stage: lead.crm_data?.leadStatus || 'new', created_at: lead.created_at, ...extra,
  })
  const autoSend = async (lead, ruleKey, tpl, { respectWindow = true } = {}) => {
    if (dry || sends >= maxSends || timeLeft() < 3000) return false
    if (respectWindow && !canAutoSend) return false
    if ((lead.crm_data?.auto?.tries?.[ruleKey] || 0) >= 3) return false     // gave up after 3 failed tries
    sends++
    const text = renderTemplate(tpl, lead, cfg)
    const result = await sendText(lead.phone, text)
    const entry = await recordSend(lead, { ruleKey, templateId: tpl.id, text, result, by: source === 'cron' ? 'cron' : 'auto' })
    ;(result.ok ? out.sent : out.errors).push({ leadId: String(lead.id), name: lead.name, ruleKey, error: entry.error })
    if (result.ok) { lead.crm_data = { ...(lead.crm_data || {}), auto: { ...(lead.crm_data?.auto || {}), sent: { ...(lead.crm_data?.auto?.sent || {}), [ruleKey]: entry.at } } } }
    await sleep(400)
    return result.ok
  }

  for (const lead of leads) {
    if (timeLeft() < 2500) { out.notes.push('time budget reached'); break }
    const phone = intlPhone(lead.phone)
    if (!phone || phone.length < 11) continue
    const crm = lead.crm_data || {}
    let auto = crm.auto || {}
    const created = ts(lead.created_at)
    const stage = crm.leadStatus || 'new'
    const done = k => !!(auto.sent?.[k] || auto.skipped?.[k])
    const doneAt = k => ts(auto.sent?.[k]) || ts(auto.skipped?.[k])

    // A. Replies from the lead → intent, opt-out, team alert, follow-ups stop
    const R = cfg.rules.replies
    if (R.mode !== 'off' && inbound) {
      const msgs = (inbound.get(phone) || []).filter(m => m.ts >= Math.max(created, installed) && m.ts > (auto.lastInboundTs || 0))
      if (msgs.length) {
        const intents = msgs.map(m => classifyReply(m.text, cfg))
        const intent = intents.includes('negative') ? 'negative' : intents.includes('positive') ? 'positive' : 'reply'
        const last = msgs[msgs.length - 1]
        const moveTo = intent === 'negative' ? R.negativeMoveTo : intent === 'positive' ? R.positiveMoveTo : ''
        if (!dry) {
          const updated = await updateAuto(lead.id, a => {
            a.lastInboundTs = last.ts; a.lastInboundText = String(last.text || '').slice(0, 200); a.replied = true
            if (intent !== 'reply') a.intent = intent
            if (intent === 'negative') { a.optOut = true; a.optOutAt = nowIso() }
            if (moveTo && moveTo !== stage) a.move = { stage: moveTo, at: nowIso(), reason: intent }
          }, moveTo && moveTo !== stage ? { leadStatus: moveTo } : null)
          if (updated) { lead.crm_data = updated.crm_data; auto = updated.crm_data.auto }
          if (R.notifyTeam && intent !== 'reply') {
            const name = lead.name || phone
            const msg = intent === 'positive'
              ? `🔥 *${name} רוצה להתקדם!*\n💬 "${String(last.text).slice(0, 200)}"\n📱 https://wa.me/${phone}`
              : `🚫 *${name} ביקש/ה להפסיק לקבל הודעות*\n💬 "${String(last.text).slice(0, 200)}"\nהמערכת הפסיקה את כל ההודעות האוטומטיות אליו/ה.`
            await notifyTeam(msg).catch(() => {})
          }
        }
        if (intent !== 'reply') out.stats[intent]++
      }
    }
    if (auto.replied) out.stats.replied++
    if (auto.lastInboundTs && auto.intent) {
      // reply-intent follow-up (once per intent)
      const intent = auto.intent, ruleKey = `reply:${intent}`
      const mode = intent === 'positive' ? R.positiveMode : R.negativeMode
      const tpl = getTemplate(cfg, intent === 'positive' ? R.positiveTemplateId : R.negativeTemplateId)
      if (R.mode !== 'off' && mode !== 'off' && tpl && !done(ruleKey) && auto.lastInboundTs >= installed) {
        const reason = intent === 'positive' ? { he: `ענה בחיוב: "${auto.lastInboundText || ''}"`, en: `Positive reply: "${auto.lastInboundText || ''}"` } : { he: `ענה: "${auto.lastInboundText || ''}"`, en: `Replied: "${auto.lastInboundText || ''}"` }
        if (mode === 'auto') await autoSend(lead, ruleKey, tpl, { respectWindow: false })
        else suggest(lead, ruleKey, tpl, reason)
      }
    }
    if (auto.move?.at && now - ts(auto.move.at) < 14 * 864e5) out.moves.push({ leadId: String(lead.id), stage: auto.move.stage, at: auto.move.at })
    if (auto.optOut) { out.stats.optOut++; continue }

    // B. Welcome (suggest mode, or a retry after a failed automatic send)
    const W = cfg.rules.welcome
    if (W.mode !== 'off' && created >= installed && !done('welcome')) {
      const w = welcomeFor(lead, cfg), tpl = w && getTemplate(cfg, w.templateId)
      if (tpl) {
        if (W.mode === 'suggest') suggest(lead, 'welcome', tpl, { he: 'ליד חדש – עוד לא קיבל הודעת פתיחה', en: 'New lead – no welcome message yet' })
        else if (now - created < 48 * 3600e3 && (auto.tries?.welcome || 0) > 0) await autoSend(lead, 'welcome', tpl)
      }
    }

    // C. No reply → follow-up sequence (only when Green API told us who replied)
    const N = cfg.rules.noReply
    if (N.mode !== 'off' && inbound && created >= installed && !auto.replied && (N.stages || []).includes(stage)) {
      const steps = N.steps || []
      const i = steps.findIndex((_, k) => !done(`noreply:${k + 1}`))
      if (i >= 0) {
        const prev = i === 0 ? Math.max(created, ts(auto.sent?.welcome)) : doneAt(`noreply:${i}`)
        const hours = Number(steps[i].hours) || 24
        const tpl = getTemplate(cfg, steps[i].templateId)
        if (tpl && prev && now - prev >= hours * 3600e3) {
          const ruleKey = `noreply:${i + 1}`
          const reason = { he: `לא ענה ${Math.round((now - prev) / 3600e3)} שעות · מעקב ${i + 1} מתוך ${steps.length}`, en: `No reply for ${Math.round((now - prev) / 3600e3)}h · follow-up ${i + 1} of ${steps.length}` }
          if (N.mode === 'auto') await autoSend(lead, ruleKey, tpl)
          else suggest(lead, ruleKey, tpl, reason)
        }
      }
    }

    // D. Stage-change messages waiting for approval
    const S = cfg.rules.stage?.[stage]
    if (S && S.mode === 'suggest' && auto.stageAt?.stage === stage && ts(auto.stageAt.at) >= installed && !done(`stage:${stage}`)) {
      const tpl = getTemplate(cfg, S.templateId)
      if (tpl) suggest(lead, `stage:${stage}`, tpl, { he: `עבר לשלב "${stage}"`, en: `Moved to stage "${stage}"` }, { stageKey: stage })
    }

    // E. Re-engagement of leads that went quiet ("lost") a while ago
    const E = cfg.rules.reengage
    if (E.mode !== 'off' && stage === 'lost' && auto.stageAt?.stage === 'lost' && ts(auto.stageAt.at) >= installed && !done('reengage')) {
      const days = Number(E.days) || 45
      const tpl = getTemplate(cfg, E.templateId)
      if (tpl && now - ts(auto.stageAt.at) >= days * 864e5) {
        if (E.mode === 'auto') await autoSend(lead, 'reengage', tpl)
        else suggest(lead, 'reengage', tpl, { he: `ללא מענה כבר ${days} יום`, en: `Quiet for ${days} days` })
      }
    }
  }
  return out
}

// ── Entry point 4: manual / approved sends from the panel ──────────────────────
// items: [{ leadId?, phone?, text, ruleKey?, templateId?, force? }]
export async function sendItems(items, { by = 'manual' } = {}) {
  const results = []
  const started = Date.now()
  for (const it of (items || []).slice(0, 25)) {
    if (Date.now() - started > 24000) { results.push({ ...it, ok: false, error: 'timeout – נסו שוב לשאר' }); continue }
    const lead = it.leadId ? await getLead(it.leadId) : (it.phone ? await findLeadByPhone(it.phone) : null)
    const phone = it.phone || lead?.phone
    const ruleKey = it.ruleKey || 'manual'
    // An opted-out lead gets nothing more, except the one polite closing reply to their "no thanks"
    if (lead?.crm_data?.auto?.optOut && !it.force && ruleKey !== 'reply:negative') { results.push({ leadId: it.leadId, ok: false, skipped: true, error: 'הלקוח ביקש לא לקבל הודעות' }); continue }
    const result = await sendText(phone, it.text)
    await recordSend(lead || { id: null, phone, name: it.name || '' }, { ruleKey, templateId: it.templateId, text: it.text, result, by })
    results.push({ leadId: it.leadId || (lead ? String(lead.id) : null), phone: intlPhone(phone), ok: result.ok, error: result.error || null })
    await sleep(600)
  }
  return results
}

export async function skipItem(leadId, ruleKey) {
  const lead = await updateAuto(leadId, auto => { auto.skipped = { ...(auto.skipped || {}), [ruleKey]: nowIso() } })
  return !!lead
}
export async function setOptOut(leadId, optOut) {
  const lead = await updateAuto(leadId, auto => { auto.optOut = !!optOut; auto.optOutAt = optOut ? nowIso() : null; if (!optOut && auto.intent === 'negative') auto.intent = null })
  return !!lead
}

export async function sendTest(text, phone) {
  const result = await sendText(phone || TEAM_CHAT, text)
  await writeLog({ lead_id: null, phone: intlPhone(phone || TEAM_CHAT), name: 'בדיקה', rule_key: 'test', template_id: null, message: String(text).slice(0, 2000), ok: result.ok, error: result.ok ? null : result.error, by: 'manual' })
  return result
}

// Send log: the automation_log table, or (before the migration) the per-lead logs
export async function listLog(limit = 150) {
  try {
    const r = await supa(`/automation_log?select=*&order=created_at.desc&limit=${Math.min(limit, 500)}`)
    if (r.ok) return { source: 'table', rows: await r.json() }
  } catch {}
  const leads = await listLeads(300).catch(() => [])
  const rows = leads.flatMap(l => (l.crm_data?.auto?.log || []).map(e => ({ created_at: e.at, lead_id: String(l.id), phone: intlPhone(l.phone), name: l.name, rule_key: e.ruleKey, template_id: e.templateId, message: e.text, ok: e.ok, error: e.error, by: e.by })))
  rows.sort((a, b) => ts(b.created_at) - ts(a.created_at))
  return { source: 'leads', rows: rows.slice(0, limit) }
}

// Per-lead automation state for the panel (opt-out, intent, what was sent)
export async function leadStates() {
  const leads = await listLeads(500)
  return leads.filter(l => l.crm_data?.auto).map(l => {
    const a = l.crm_data.auto
    return { leadId: String(l.id), optOut: !!a.optOut, replied: !!a.replied, intent: a.intent || null, lastInboundText: a.lastInboundText || '', lastInboundTs: a.lastInboundTs || 0, sent: a.sent || {}, skipped: a.skipped || {} }
  })
}

export { RULE_LABELS }
