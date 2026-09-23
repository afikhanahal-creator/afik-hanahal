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

import { mergeConfig, getTemplate, renderTemplate, isSendWindow, nextSendWindow, classifyReply, intlPhone, leadLang, RULE_LABELS, ruleKind } from './automations-shared.js'

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

// Small JSON values in app_settings next to the config (scheduled jobs, last run)
async function getSetting(key) {
  try {
    const r = await supa(`/app_settings?key=eq.${key}&select=value,updated_at`, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return { value: null, missing: tableMissing(r.status, await r.text().catch(() => '')) }
    const rows = await r.json().catch(() => [])
    return { value: rows[0]?.value ?? null, updatedAt: rows[0]?.updated_at || null }
  } catch { return { value: null, error: true } }
}
async function putSetting(key, value) {
  const r = await supa('/app_settings?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key, value, updated_at: nowIso() }), signal: AbortSignal.timeout(8000) })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(tableMissing(r.status, body) ? 'טבלת app_settings לא קיימת – הריצו את server/automations-migration.sql ב-Supabase' : `Supabase ${r.status}: ${body.slice(0, 160)}`)
  }
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
  try {
    const out = await runInner(opts)
    if (!opts.dry && lock !== 'error') await putSetting('automations_lastrun', { at: out.at, source: out.source, sent: out.sent.length, errors: out.errors.length, queued: out.suggestions.length, jobsSent: out.jobs?.sent || 0 }).catch(() => {})
    return out
  }
  finally { if (lock === 'held') await releaseLock() }
}
async function runInner({ source = 'panel', maxSends = 12, budgetMs = 20000, dry = false } = {}) {
  const started = Date.now()
  const { cfg, storage } = await loadConfig({ fresh: true })
  const nextWin = nextSendWindow(cfg)
  const out = { ok: true, source, at: nowIso(), storage, enabled: cfg.enabled, window: isSendWindow(cfg), nextWindowAt: nextWin ? nextWin.toISOString() : null, suggestions: [], upcoming: [], sent: [], errors: [], moves: [], notes: [], jobs: { sent: 0, failed: 0 }, stats: { leads: 0, optOut: 0, replied: 0, positive: 0, negative: 0 } }
  if (!cfg.enabled) { out.notes.push('disabled'); return out }

  const installed = ts(cfg.installedAt)
  let leads = []
  try { leads = await listLeads() } catch (e) { out.ok = false; out.errors.push({ error: e.message }); return out }
  out.stats.leads = leads.length

  // Scheduled bulk sends that are due (they run even when the rules are in "approve" mode — a person scheduled them)
  if (!dry) { try { await processJobs(cfg, leads, out, () => budgetMs - (Date.now() - started)) } catch (e) { out.notes.push(`jobs: ${e.message}`) } }

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
  // What the system will send / propose later (the schedule view). `sendAt` accounts for sending hours.
  const HORIZON = now + 14 * 864e5
  const plan = (lead, ruleKey, tpl, dueAt, mode, reason) => {
    if (!tpl || dueAt > HORIZON) return
    const sendAt = mode === 'auto' ? (nextSendWindow(cfg, new Date(Math.max(dueAt, now))) || new Date(dueAt)) : new Date(dueAt)
    const heldByQuiet = mode === 'auto' && sendAt.getTime() - Math.max(dueAt, now) > 60000
    out.upcoming.push({ id: `${lead.id}:${ruleKey}`, leadId: String(lead.id), name: lead.name || '', phone: intlPhone(lead.phone), stage: lead.crm_data?.leadStatus || 'new', ruleKey, kind: ruleKind(ruleKey), templateId: tpl.id, mode, dueAt: new Date(dueAt).toISOString(), sendAt: sendAt.toISOString(), heldByQuiet, reason, lang: leadLang(lead), text: renderTemplate(tpl, lead, cfg) })
  }
  const autoSend = async (lead, ruleKey, tpl, { respectWindow = true } = {}) => {
    if (dry || sends >= maxSends || timeLeft() < 3000) return false
    if (respectWindow && !canAutoSend) return false
    if ((lead.crm_data?.auto?.tries?.[ruleKey] || 0) >= 3) return false     // gave up after 3 failed tries
    sends++
    const text = renderTemplate(tpl, lead, cfg)
    const result = await sendText(lead.phone, text)
    const entry = await recordSend(lead, { ruleKey, templateId: tpl.id, text, result, by: source === 'cron' ? 'cron' : source === 'external' ? 'external' : 'auto' })
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
          if (N.mode === 'auto') { const ok = await autoSend(lead, ruleKey, tpl); if (!ok && !dry) plan(lead, ruleKey, tpl, prev + hours * 3600e3, 'auto', reason) }
          else suggest(lead, ruleKey, tpl, reason)
        } else if (tpl && prev) {
          const ruleKey = `noreply:${i + 1}`
          plan(lead, ruleKey, tpl, prev + hours * 3600e3, N.mode, { he: `אם לא יענה · מעקב ${i + 1} מתוך ${steps.length}`, en: `If no reply · follow-up ${i + 1} of ${steps.length}` })
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
        if (E.mode === 'auto') { const ok = await autoSend(lead, 'reengage', tpl); if (!ok && !dry) plan(lead, 'reengage', tpl, ts(auto.stageAt.at) + days * 864e5, 'auto', { he: `ללא מענה כבר ${days} יום`, en: `Quiet for ${days} days` }) }
        else suggest(lead, 'reengage', tpl, { he: `ללא מענה כבר ${days} יום`, en: `Quiet for ${days} days` })
      } else if (tpl) plan(lead, 'reengage', tpl, ts(auto.stageAt.at) + days * 864e5, E.mode, { he: `אחרי ${days} יום ב"ללא מענה"`, en: `After ${days} days with no answer` })
    }
  }
  out.upcoming.sort((a, b) => ts(a.sendAt) - ts(b.sendAt))
  return out
}

// ── Scheduled bulk sends ("jobs") ──────────────────────────────────────────────
// Stored in app_settings under 'automations_jobs' as { jobs: [...] }. A job:
//   { id, name, templateId, at, status: scheduled|sending|done|cancelled|failed, createdAt, updatedAt,
//     recipients: [{ leadId, phone, name, status?: sent|failed|skipped, error? }], sentCount, failCount }
// The text is rendered at send time, so editing the template before the job runs changes what goes out.
const JOBS_KEY = 'automations_jobs'
export async function listJobs() {
  const { value, missing } = await getSetting(JOBS_KEY)
  return { jobs: Array.isArray(value?.jobs) ? value.jobs : [], storage: missing ? 'missing' : 'ok' }
}
async function writeJobs(mutate) {
  const { jobs } = await listJobs()
  const next = mutate(jobs.map(j => ({ ...j }))) || jobs
  // keep the list small: finished jobs older than 60 days drop off
  const cutoff = Date.now() - 60 * 864e5
  const kept = next.filter(j => ['scheduled', 'sending'].includes(j.status) || ts(j.updatedAt || j.at) > cutoff).slice(0, 100)
  await putSetting(JOBS_KEY, { jobs: kept })
  return kept
}
export async function saveJob(job) {
  if (!job || !job.templateId) throw new Error('template required')
  const at = ts(job.at)
  if (!at) throw new Error('invalid date')
  const recipients = (job.recipients || []).filter(r => r && (r.phone || r.leadId)).slice(0, 500).map(r => ({ leadId: r.leadId != null ? String(r.leadId) : null, phone: intlPhone(r.phone), name: String(r.name || '').slice(0, 80) }))
  if (!recipients.length) throw new Error('no recipients')
  let saved = null
  await writeJobs(jobs => {
    const i = jobs.findIndex(j => j.id === job.id)
    if (i >= 0) {
      if (!['scheduled'].includes(jobs[i].status)) throw new Error('job already started')
      jobs[i] = saved = { ...jobs[i], ...jobOpts(job), name: String(job.name || '').slice(0, 80), templateId: job.templateId, at: new Date(at).toISOString(), recipients, updatedAt: nowIso() }
    } else {
      saved = { id: `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...jobOpts(job), name: String(job.name || '').slice(0, 80), templateId: job.templateId, at: new Date(at).toISOString(), status: 'scheduled', createdAt: nowIso(), updatedAt: nowIso(), recipients, sentCount: 0, failCount: 0 }
      jobs.unshift(saved)
    }
    return jobs
  })
  return saved
}
// respectQuiet: wait for sending hours · customText: { he, en } used instead of the template for this send only
function jobOpts(job) {
  const ct = job.customText && typeof job.customText === 'object' ? { he: String(job.customText.he || '').slice(0, 4000), en: String(job.customText.en || '').slice(0, 4000) } : null
  return { respectQuiet: job.respectQuiet !== false, customText: ct && (ct.he || ct.en) ? ct : null }
}
// Failed recipients of a finished job get another try
export async function retryJob(id) {
  let ok = false
  await writeJobs(jobs => jobs.map(j => {
    if (j.id !== id || !['done', 'failed'].includes(j.status)) return j
    const recipients = j.recipients.map(r => (r.status === 'failed' ? { leadId: r.leadId, phone: r.phone, name: r.name } : r))
    if (!recipients.some(r => !r.status)) return j
    ok = true
    return { ...j, recipients, status: 'sending', at: nowIso(), failCount: 0, updatedAt: nowIso() }
  }))
  return ok
}
// Send the due jobs now (no rules) — the panel calls this while a bulk send is in progress
export async function jobsTick() {
  const lock = await acquireLock('jobs')
  if (lock === 'busy') return { busy: true }
  try {
    const { cfg } = await loadConfig({ fresh: true })
    const leads = await listLeads().catch(() => [])
    const started = Date.now()
    const out = { jobs: { sent: 0, failed: 0 }, notes: [] }
    await processJobs(cfg, leads, out, () => 24000 - (Date.now() - started))
    return out
  } finally { if (lock === 'held') await releaseLock() }
}
export async function cancelJob(id) {
  let ok = false
  await writeJobs(jobs => jobs.map(j => (j.id === id && ['scheduled', 'sending'].includes(j.status) ? (ok = true, { ...j, status: 'cancelled', updatedAt: nowIso() }) : j)))
  return ok
}
export async function deleteJob(id) {
  await writeJobs(jobs => jobs.filter(j => j.id !== id || ['scheduled', 'sending'].includes(j.status)))
  return true
}
async function processJobs(cfg, leads, out, timeLeft) {
  const { jobs, storage } = await listJobs()
  if (storage !== 'ok') return
  const open = isSendWindow(cfg)
  const due = jobs.filter(j => ['scheduled', 'sending'].includes(j.status) && ts(j.at) <= Date.now() && (open || j.respectQuiet === false))
  if (!due.length) return
  const byId = new Map(leads.map(l => [String(l.id), l]))
  for (const job of due) {
    const base = getTemplate(cfg, job.templateId)
    const tpl = job.customText ? { ...(base || { id: job.templateId }), he: job.customText.he || base?.he || '', en: job.customText.en || job.customText.he || base?.en || '' } : base
    const recips = job.recipients.map(r => ({ ...r }))
    let sentNow = 0
    if (!tpl) { recips.forEach(r => { if (!r.status) { r.status = 'failed'; r.error = 'התבנית נמחקה' } }) }
    for (const r of recips) {
      if (r.status || !tpl) continue
      if (timeLeft() < 4000 || sentNow >= 20) break
      const lead = (r.leadId && byId.get(r.leadId)) || { id: r.leadId, name: r.name, phone: r.phone, crm_data: {} }
      if (lead.crm_data?.auto?.optOut) { r.status = 'skipped'; r.error = 'ביקש לא לקבל הודעות'; continue }
      const text = renderTemplate(tpl, lead, cfg)
      const result = await sendText(r.phone || lead.phone, text)
      sentNow++
      r.status = result.ok ? 'sent' : 'failed'
      if (!result.ok) r.error = String(result.error || '').slice(0, 160)
      await recordSend(byId.get(r.leadId) || { id: null, phone: r.phone, name: r.name }, { ruleKey: `tpl:${tpl.id}`, templateId: tpl.id, text, result, by: 'scheduled' })
      await sleep(500)
    }
    const sentCount = recips.filter(r => r.status === 'sent').length
    const failCount = recips.filter(r => r.status === 'failed').length
    const finished = recips.every(r => r.status)
    out.jobs.sent += recips.filter((r, i) => r.status === 'sent' && !job.recipients[i].status).length
    out.jobs.failed += recips.filter((r, i) => r.status === 'failed' && !job.recipients[i].status).length
    await writeJobs(list => list.map(j => (j.id === job.id && ['scheduled', 'sending'].includes(j.status)
      ? { ...j, recipients: recips, sentCount, failCount, status: finished ? (tpl ? 'done' : 'failed') : 'sending', updatedAt: nowIso() } : j)))
    if (timeLeft() < 4000) break
  }
}

// ── Health: everything the office needs to know that the system is working ─────
export async function health() {
  const [green, cfgv, last, jobs] = await Promise.all([greenStatus(), loadConfig({ fresh: true }), getSetting('automations_lastrun'), listJobs().catch(() => ({ jobs: [] }))])
  const cfg = cfgv.cfg
  const nw = nextSendWindow(cfg)
  return {
    green, storage: cfgv.storage, enabled: cfg.enabled, window: isSendWindow(cfg), nextWindowAt: nw ? nw.toISOString() : null,
    lastRun: last.value || null,
    jobs: { scheduled: jobs.jobs.filter(j => j.status === 'scheduled').length, sending: jobs.jobs.filter(j => j.status === 'sending').length },
    tickKeyConfigured: !!process.env.AUTOMATION_KEY,
  }
}
export function tickKeyValid(key) {
  const k = String(key || '')
  return !!k && (k === process.env.AUTOMATION_KEY || k === (process.env.ADMIN_TOKEN || 'AFIKhanahal2026'))
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
