// Documents & digital signatures — the server side (api/meta.js → handleDocs): the documents table and its event chain,
// the private "documents" bucket, settings (VAT, default agent, office notify numbers, logo, the clauses), sending the private
// signing link by WhatsApp (Green API) and email (the office Gmail, PDF attached), the public signing flow (open → one-time code
// by WhatsApp / email → signature → the signed PDF with its certificate page → copies to the client, WhatsApp + email to the
// office, the lead's card updated), and the lead link (never a duplicate lead: the CRM lead with the same phone / email).
// Rules and texts: lib/documents.js (tested). PDF: lib/doc-pdf.js. Word: lib/doc-docx.js.
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import * as Auto from './automations.js'
import { intlPhone } from './automations-shared.js'
import { pngInfo } from './png-check.js'
import { cleanAgents, agentsFromSettings, defaultAgent, docAgent, signatureOwner, signatureForDoc, AGENT_ID, cleanSignMessages, signMessageLines, agentSigns, validIsraeliId, cleanDocInput, cleanClauses, DEFAULT_CLAUSES, DEFAULT_VAT, DEFAULT_EXPIRY_DAYS, OTP_MINUTES, OTP_MAX_TRIES, docNumber, canEdit, canSend, canCancel, canSign, isExpired, signUrl, publicView, leadDocEntry, mergeLeadDocs, clientWaText, clientEmail, otpText, otpEmail, officeSignedText, officeSignedEmail, clientSignedEmail, clientSignedWaText, docNoteText, cleanPhone, validEmail, SITE, DOC_TYPES, mergePresets,
  startSigning, currentSigner, advanceSigning, signerProgress, signerMask, reminderDue, cleanReminders, cleanNotifyOn, nextSignerWaText, nextSignerEmail, reminderWaText, reminderEmail, officeEventText, driveFileName, driveFolderPath, DRIVE_TEMPLATES_PATH } from './documents.js'
import { eventHash, sha256, tokenHash, encryptToken, decryptToken, newSignCode } from './documents-hash.js'
import * as Drive from './google-drive.js'
import { renderPdf } from './doc-pdf.js'
import { renderDocx } from './doc-docx.js'
import { cleanTemplate, brokerageTemplate, templateValues, missingFields } from './doc-templates.js'
import { extractDocument } from './doc-extract.js'

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const BUCKET = 'documents'
const sb = () => createClient(SUPA_URL, SUPA_KEY)
export const ready = () => !!(SUPA_URL && SUPA_KEY)
const H = () => ({ apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` })
const SAFE_V1 = 'id,number,type,template_version,status,lead_id,property_id,client_name,client_phone,client_email,data,expires_at,sent_at,opened_at,signed_at,signature,original_hash,signed_hash,send_log,notified_at,created_by,created_at,updated_at,original_path,signed_path,signature_path,otp_via'
const V2_COLS = ['template_id', 'template', 'project_id', 'project_name', 'agent_name']
// until server/documents-v2-migration.sql is applied the v2 columns don't exist: every read / write falls back to v1 once it sees that
let v2 = true
let SAFE = SAFE_V1 + ',template_id,project_id,project_name,agent_name'
const noTable = e => /relation .* does not exist|column .* does not exist|schema cache/i.test(String(e?.message || e || ''))
const downgrade = () => { v2 = false; SAFE = SAFE_V1 }
const v1Row = row => { if (v2) return row; const r = { ...row }; for (const c of V2_COLS) delete r[c]; return r }
export const v2Ready = () => v2
/** update a document row and read it back: v1 columns only while v2 is missing, downgrade + retry on a missing column, never
 *  a null row (the public signing path reads with select('*'), so it never learnt that the v2 columns are missing — the final
 *  `select(SAFE)` then failed and the signature step crashed on a null row, 2026-11-03) */
async function patchRow(id, patch) {
  const client = sb()
  let r = await client.from('documents').update(v1Row(patch)).eq('id', id).select(SAFE).single()
  if (r.error && v2 && noTable(r.error)) { downgrade(); r = await client.from('documents').update(v1Row(patch)).eq('id', id).select(SAFE).single() }
  if (r.error) throw new Error(r.error.message)
  if (!r.data) throw new Error('המסמך לא נמצא')
  return r.data
}
const MIGRATION_HINT = 'הטבלאות של גרסה 2 עוד לא נוצרו — הריצו את server/documents-v2-migration.sql ב-Supabase (SQL editor)'

// ── templates (doc_templates): the uploaded documents turned into templates; the brokerage order is built in ──────────────
const TSAFE = 'id,name,kind,title,blocks,fields,sections,logo,source,status,created_at,updated_at'
export async function listTemplates({ all = false } = {}) {
  let q = sb().from('doc_templates').select(TSAFE).order('created_at', { ascending: false }).limit(200)
  if (!all) q = q.eq('status', 'active')
  const { data, error } = await q
  if (error) { if (noTable(error)) return { templates: [], missingMigration: true }; throw new Error(error.message) }
  return { templates: (data || []).map(cleanTemplateRow) }
}
const cleanTemplateRow = r => ({ ...cleanTemplate(r), id: r.id, created_at: r.created_at, updated_at: r.updated_at })
export async function getTemplate(id) {
  if (!id || id === 'brokerage') return { ...brokerageTemplate((await getSettings()).clauses), builtin: true }
  const { data, error } = await sb().from('doc_templates').select(TSAFE).eq('id', String(id)).maybeSingle()
  if (error) throw new Error(noTable(error) ? MIGRATION_HINT : error.message)
  return data ? cleanTemplateRow(data) : null
}
export async function saveTemplate(input = {}, { by = 'admin' } = {}) {
  const tp = cleanTemplate({ ...input, kind: 'custom' })
  if (!tp.blocks.length) return { error: 'לתבנית אין טקסט' }
  const row = { name: tp.name, kind: 'custom', title: tp.title, blocks: tp.blocks, fields: tp.fields, sections: tp.sections, logo: tp.logo, source: tp.source, status: tp.status }
  const client = sb()
  const r = input.id && input.id !== 'brokerage' ? await client.from('doc_templates').update(row).eq('id', String(input.id)).select(TSAFE).single() : await client.from('doc_templates').insert({ ...row, created_by: by }).select(TSAFE).single()
  if (r.error) return { error: noTable(r.error) ? MIGRATION_HINT : r.error.message }
  return { template: cleanTemplateRow(r.data) }
}
export async function deleteTemplate(id) {
  const { count } = await sb().from('documents').select('id', { count: 'exact', head: true }).eq('template_id', String(id))
  if (count) { await sb().from('doc_templates').update({ status: 'archived' }).eq('id', String(id)); return { ok: true, archived: true, used: count } }
  const { error } = await sb().from('doc_templates').delete().eq('id', String(id))
  if (error) return { error: error.message }
  return { ok: true }
}
/** an uploaded file → its text and blocks (lib/doc-extract.js), the file kept in the bucket under templates/ → { text, method, pages, warnings, source } */
export async function extractUpload(bytes, { name = '', type = '' } = {}) {
  const r = await extractDocument(bytes, { name, type })
  if (r.error) return r
  const safe = String(name || 'file').replace(/[^\w.\u0590-\u05FF-]+/g, '_').slice(0, 80)
  const path = `templates/${Date.now().toString(36)}-${safe}`
  let stored = ''
  try { await putFile(path, bytes, type || 'application/octet-stream'); stored = path } catch (e) { r.warnings = [...(r.warnings || []), `הקובץ המקורי לא נשמר: ${e.message}`] }
  return { ...r, source: { name: String(name || '').slice(0, 120), path: stored, type: String(type || '').slice(0, 80), method: r.method, pages: r.pages || 0 } }
}
/** the template a document renders with (its frozen copy, else its template_id, else the brokerage order) */
async function templateForDoc(doc) {
  if (doc?.template && Array.isArray(doc.template.blocks)) return cleanTemplate(doc.template)
  if (doc?.template_id) { const t = await getTemplate(doc.template_id).catch(() => null); if (t) return t }
  return null
}

// ── settings ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function getSettings() {
  const v = (await Auto.getSetting('doc_settings').catch(() => ({ value: null }))).value || {}
  const t = (await Auto.getSetting('doc_templates').catch(() => ({ value: null }))).value || {}
  return {
    vatRate: v.vatRate == null ? DEFAULT_VAT : Number(v.vatRate), expiryDays: Number(v.expiryDays) || DEFAULT_EXPIRY_DAYS,
    ...(() => { const agents = agentsFromSettings(v); return { agents, agent: docAgent(defaultAgent(agents)) } })(),
    notify: Array.isArray(v.notify) ? v.notify.map(intlPhone).filter(Boolean).slice(0, 5) : [],
    notifyEmail: validEmail(v.notifyEmail) ? String(v.notifyEmail || '') : '',
    logo: { show: v.logo?.show !== false, url: /^https:\/\//.test(String(v.logo?.url || '')) ? v.logo.url : '', size: ['s', 'm', 'l'].includes(v.logo?.size) ? v.logo.size : 'm', align: ['right', 'center', 'left'].includes(v.logo?.align) ? v.logo.align : 'right' },
    clauses: cleanClauses(t.brokerage?.clauses), clausesCustom: !!t.brokerage?.clauses?.length, clausesUpdatedAt: t.brokerage?.updatedAt || null,
    reminders: cleanReminders(v.reminders || {}), notifyOn: cleanNotifyOn(v.notifyOn || {}), drive: { enabled: v.drive?.enabled !== false },
    presets: mergePresets(v.presets || {}, {}),
    signMessages: cleanSignMessages(v.signMessages || {}, {}),
  }
}
export async function saveSettings(patch = {}) {
  const cur = (await Auto.getSetting('doc_settings').catch(() => ({ value: null }))).value || {}
  const next = { ...cur }
  if ('vatRate' in patch) next.vatRate = Math.max(0, Math.min(50, Number(patch.vatRate) || 0))
  if ('expiryDays' in patch) next.expiryDays = Math.max(1, Math.min(90, Number(patch.expiryDays) || DEFAULT_EXPIRY_DAYS))
  if (Array.isArray(patch.agents)) {   // the office's brokers / agents; the default one is also kept as `agent` (older readers)
    next.agents = cleanAgents(patch.agents)
    const d = defaultAgent(next.agents)
    next.agent = d ? { name: d.name, license: d.license, phone: d.phone, email: d.email } : {}
  } else if (patch.agent) {
    const a = { name: String(patch.agent.name || '').slice(0, 80), license: String(patch.agent.license || '').slice(0, 40), phone: cleanPhone(patch.agent.phone), email: String(patch.agent.email || '').slice(0, 120) }
    next.agent = a
    if (Array.isArray(cur.agents) && cur.agents.length) next.agents = cleanAgents(cur.agents.map(x => (x.isDefault ? { ...x, ...a } : x)))
  }
  if (Array.isArray(patch.notify)) next.notify = patch.notify.map(intlPhone).filter(Boolean).slice(0, 5)
  if ('notifyEmail' in patch) next.notifyEmail = validEmail(patch.notifyEmail) ? String(patch.notifyEmail || '').trim() : ''
  if (patch.logo) next.logo = { show: patch.logo.show !== false, url: /^https:\/\//.test(String(patch.logo.url || '')) ? String(patch.logo.url).slice(0, 400) : '', size: patch.logo.size, align: patch.logo.align }
  if (patch.reminders) next.reminders = cleanReminders(patch.reminders)
  if (patch.notifyOn) next.notifyOn = cleanNotifyOn(patch.notifyOn)
  if (patch.drive) next.drive = { enabled: patch.drive.enabled !== false }
  if (patch.presets && typeof patch.presets === 'object') next.presets = mergePresets(cur.presets || {}, patch.presets)   // { [propertyId]: preset | null }
  if (patch.signMessages && typeof patch.signMessages === 'object') next.signMessages = cleanSignMessages(cur.signMessages || {}, patch.signMessages)   // { [id]: wording | null }
  await Auto.putSetting('doc_settings', next)
  if (Array.isArray(patch.agents)) await pruneAgentSignatures(next.agents).catch(() => {})
  if (Array.isArray(patch.clauses)) await saveClauses(patch.clauses)
  return getSettings()
}
// ── the brokers' signatures: app_settings.doc_agent_signatures = { [agentId]: { name, png: base64, updatedAt } } (private,
// service key only). The older single one (app_settings.doc_agent_signature) belongs to the agent with its name — else the
// default agent — and moves into the map on the next save.
let agentSigCache = null
const sigFrom = v => { const png = v?.png ? Buffer.from(String(v.png), 'base64') : null; return png && pngInfo(png).ok ? { name: String(v.name || ''), png, updatedAt: v.updatedAt || null } : null }
async function rawAgentSigs() {
  const map = (await Auto.getSetting('doc_agent_signatures').catch(() => ({ value: null }))).value || {}
  const legacy = (await Auto.getSetting('doc_agent_signature').catch(() => ({ value: null }))).value || null
  return { map: map && typeof map === 'object' ? map : {}, legacy }
}
/** { agents, sigs: { [agentId]: { name, png: Buffer, updatedAt } } } — whole, sound PNGs only (a garbled copy draws nothing) */
export async function getAgentSignatures() {
  if (agentSigCache && Date.now() - agentSigCache.t < 60e3) return agentSigCache.v
  const { agents } = await getSettings()
  const { map, legacy } = await rawAgentSigs()
  const sigs = {}
  for (const [id, v] of Object.entries(map)) { const x = sigFrom(v); if (x && AGENT_ID.test(id)) sigs[id] = x }
  const owner = signatureOwner(agents, legacy)
  if (owner && !sigs[owner]) { const x = sigFrom(legacy); if (x) sigs[owner] = x }
  for (const id of Object.keys(sigs)) { const ag = agents.find(a => a.id === id); if (ag) sigs[id] = { ...sigs[id], name: ag.name } }   // a renamed agent keeps its signature
  const v = { agents, sigs }
  agentSigCache = { t: Date.now(), v }
  return v
}
/** the default agent's signature (older callers) */
export async function getAgentSignature() { const { agents, sigs } = await getAgentSignatures(); return sigs[defaultAgent(agents)?.id] || null }
async function writeAgentSigs(next) {
  const out = {}
  for (const [id, v] of Object.entries(next)) if (v?.png) out[id] = { name: v.name, png: Buffer.isBuffer(v.png) ? v.png.toString('base64') : String(v.png), updatedAt: v.updatedAt || null }
  await Auto.putSetting('doc_agent_signatures', out)
  await Auto.putSetting('doc_agent_signature', null)   // the old single one now lives in the map
  agentSigCache = null
}
async function pruneAgentSignatures(agents) {
  agentSigCache = null
  const { sigs } = await getAgentSignatures()
  const keep = Object.fromEntries(Object.entries(sigs).filter(([id]) => agents.some(a => a.id === id)))
  if (Object.keys(keep).length !== Object.keys(sigs).length || Object.keys(sigs).length) await writeAgentSigs(keep)
}
/** admin: { agentId, png: data URL } saves that agent's signature, { agentId, remove: true } clears it (no agentId = the default) */
export async function saveAgentSignature(b = {}) {
  agentSigCache = null
  const { agents, sigs } = await getAgentSignatures()
  const agent = (AGENT_ID.test(String(b.agentId || '')) && agents.find(a => a.id === b.agentId)) || (!b.agentId ? defaultAgent(agents) : null)
  if (!agent) return { error: 'המתווך לא נמצא — שמרו קודם את רשימת המתווכים', code: 400 }
  if (b.remove) { const next = { ...sigs }; delete next[agent.id]; await writeAgentSigs(next); return { ok: true, agentId: agent.id, signature: null } }
  const png = dataUrlPng(b.png)
  if (!png) return { error: 'צריך תמונת חתימה (PNG)', code: 400 }
  const info = pngInfo(png)
  if (!info.ok) return { error: `קובץ החתימה פגום (${info.why}) — נסו להעלות שוב`, code: 400 }
  if (info.width < 120 || info.height < 40) return { error: 'תמונת החתימה קטנה מדי — צלמו או סרקו אותה גדולה יותר', code: 400 }
  const updatedAt = new Date().toISOString()
  await writeAgentSigs({ ...sigs, [agent.id]: { name: agent.name, png, updatedAt } })
  return { ok: true, agentId: agent.id, signature: { name: agent.name, updatedAt, png: `data:image/png;base64,${png.toString('base64')}` } }
}
export async function agentSignatureInfo() {
  const { agents, sigs } = await getAgentSignatures()
  const out = Object.fromEntries(Object.entries(sigs).map(([id, x]) => [id, { name: x.name, updatedAt: x.updatedAt, png: `data:image/png;base64,${x.png.toString('base64')}` }]))
  return { signatures: out, signature: out[defaultAgent(agents)?.id] || null }
}
/** the broker's signature frozen on a signed document (its own copy in the bucket) */
const agentPngOf = async doc => doc?.status === 'signed' && doc.data?.agentSignature?.path ? getFile(doc.data.agentSignature.path).catch(() => null) : null

export async function saveClauses(list, { reset = false } = {}) {
  const cur = (await Auto.getSetting('doc_templates').catch(() => ({ value: null }))).value || {}
  await Auto.putSetting('doc_templates', { ...cur, brokerage: reset ? null : { clauses: cleanClauses(list), updatedAt: new Date().toISOString(), version: 1 } })
}

// ── storage ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const enc = p => p.split('/').map(encodeURIComponent).join('/')
async function putFile(path, bytes, type) {
  let r = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${enc(path)}`, { method: 'POST', headers: { ...H(), 'Content-Type': type, 'x-upsert': 'true', 'cache-control': 'private, max-age=0' }, body: bytes, signal: AbortSignal.timeout(20000) })
  if (!r.ok && /not found|bucket/i.test(await r.clone().text().catch(() => ''))) {
    await sb().storage.createBucket(BUCKET, { public: false, fileSizeLimit: 26214400 }).catch(() => {})
    r = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${enc(path)}`, { method: 'POST', headers: { ...H(), 'Content-Type': type, 'x-upsert': 'true' }, body: bytes, signal: AbortSignal.timeout(20000) })
  }
  if (!r.ok) throw new Error(`storage ${r.status}: ${(await r.text().catch(() => '')).slice(0, 160)}`)
  return path
}
async function getFile(path) {
  const r = await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${enc(path)}`, { headers: H(), signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`storage read ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}
export async function fileUrl(path, expires = 600) {
  if (!path) return ''
  const { data } = await sb().storage.from(BUCKET).createSignedUrl(path, expires)
  return data?.signedUrl || ''
}

// ── events (hash chain) ───────────────────────────────────────────────────────────────────────────────────────────────────
export async function addEvent(docId, type, { ip = '', ua = '', meta = null } = {}) {
  const client = sb()
  const { data: last } = await client.from('document_events').select('hash').eq('document_id', docId).order('id', { ascending: false }).limit(1)
  const at = new Date().toISOString()
  const ev = { type, at, ip: String(ip || '').slice(0, 64), ua: String(ua || '').slice(0, 300), meta }
  const hash = eventHash(last?.[0]?.hash || '', ev)
  await client.from('document_events').insert({ document_id: docId, type, at, ip: ev.ip || null, ua: ev.ua || null, meta, hash })
  return { ...ev, hash }
}
export async function listEvents(docId) {
  const { data } = await sb().from('document_events').select('type,at,ip,ua,meta,hash').eq('document_id', docId).order('id', { ascending: true }).limit(500)
  return data || []
}
/** every link in the chain checks out → true (a changed row shows as the broken index) */
export function verifyChain(events) {
  let prev = ''
  for (let i = 0; i < events.length; i++) { const e = events[i]; if (eventHash(prev, { type: e.type, at: e.at, ip: e.ip || '', ua: e.ua || '', meta: e.meta || null }) !== e.hash) return { ok: false, at: i }; prev = e.hash }
  return { ok: true }
}

// ── documents ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
export async function listDocs({ status = '', q = '', lead = '', project = '', limit = 300 } = {}) {
  void project
  let qry = sb().from('documents').select(SAFE).order('created_at', { ascending: false }).limit(Math.min(1000, Math.max(1, Number(limit) || 300)))
  if (status) qry = qry.eq('status', status)
  if (lead) qry = qry.eq('lead_id', String(lead))
  if (arguments[0]?.project) qry = qry.eq('project_id', String(arguments[0].project))
  const s = String(q || '').trim()
  if (s) { const d = s.replace(/\D/g, ''); qry = qry.or([`client_name.ilike.%${s.replace(/[%,()]/g, '')}%`, `number.ilike.%${s.replace(/[%,()]/g, '')}%`, `client_email.ilike.%${s.replace(/[%,()]/g, '')}%`, ...(d.length >= 4 ? [`client_phone.ilike.%${d.slice(-7)}%`] : [])].join(',')) }
  const { data, error } = await qry
  if (error) { if (v2 && noTable(error)) { downgrade(); return listDocs(arguments[0]) } throw new Error(error.message) }
  return data || []
}
export async function getDoc(id, { full = false } = {}) {
  const { data, error } = await sb().from('documents').select(full ? '*' : SAFE).eq('id', String(id)).maybeSingle()
  if (error) { if (v2 && noTable(error)) { downgrade(); return getDoc(id, { full }) } throw new Error(error.message) }
  return data || null
}
async function byToken(token) {
  let t = String(token || '').trim()
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(t)) return null
  if (t.length <= 16) t = t.toLowerCase()   // a short code reads the same typed in capitals
  const { data } = await sb().from('documents').select('*').eq('token_hash', tokenHash(t)).maybeSingle()
  return data || null
}
const ipOf = req => String(req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || '').split(',')[0].trim().slice(0, 64)
const uaOf = req => String(req?.headers?.['user-agent'] || '').slice(0, 300)
export const reqMeta = req => ({ ip: ipOf(req), ua: uaOf(req) })

async function nextNumber(client) {
  const y = new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric' })
  const { count } = await client.from('documents').select('id', { count: 'exact', head: true }).like('number', `AH-${y}-%`)
  return docNumber(count || 0)
}
function columnsOf(data, input = {}) {
  return { client_name: data.client?.name || null, client_phone: data.client?.phone || null, client_email: data.client?.email || null, agent_name: data.agent?.name || null,
    ...(input.projectId !== undefined ? { project_id: /^p_[a-z0-9]{3,20}$/.test(String(input.projectId || '')) ? String(input.projectId) : null } : {}), ...(data.projectName !== undefined ? { project_name: data.projectName || null } : {}),
    ...(input.templateId !== undefined ? { template_id: input.templateId && input.templateId !== 'brokerage' && /^[0-9a-f-]{36}$/.test(String(input.templateId)) ? String(input.templateId) : null } : {}) }
}

/** a new document (a draft) → the row; input = { client, property, fees, agent, logo, terms, expiryDays, title, leadId, propertyId } */
export async function createDoc(input = {}, { by = 'admin', req = null } = {}) {
  const settings = await getSettings()
  const tp = input.templateId && input.templateId !== 'brokerage' ? await getTemplate(input.templateId).catch(() => null) : null
  const need = tp ? { requireProperty: !!tp.sections.property, requireFees: !!tp.sections.fees, requireAgent: false } : {}
  const { data, errors } = cleanDocInput({ ...input, fees: { vatRate: settings.vatRate, ...(input.fees || {}) }, agent: input.agent?.name ? input.agent : settings.agent, logo: input.logo || settings.logo, expiryDays: input.expiryDays || settings.expiryDays }, need)
  if (errors.length) return { errors }
  const client = sb()
  const lead = await resolveLead({ leadId: input.leadId, phone: data.client.phone, email: data.client.email })
  const row = { number: await nextNumber(client), type: tp ? 'custom' : 'brokerage', template_version: 1, status: 'draft', lead_id: lead?.id ? String(lead.id) : null, property_id: input.propertyId ? String(input.propertyId).slice(0, 40) : null, data: { ...data, title: data.title || tp?.title || '' }, created_by: by, ...columnsOf(data, { projectId: input.projectId || '', templateId: tp ? tp.id : '' }) }
  let ins = await client.from('documents').insert(v1Row(row)).select(SAFE).single()
  if (ins.error && v2 && noTable(ins.error)) { downgrade(); ins = await client.from('documents').insert(v1Row(row)).select(SAFE).single() }
  if (ins.error && /duplicate|unique/i.test(ins.error.message)) { row.number = await nextNumber(client); ins = await client.from('documents').insert(v1Row(row)).select(SAFE).single() }
  if (ins.error) throw new Error(ins.error.message)
  await addEvent(ins.data.id, 'created', { ...reqMeta(req), meta: { by, number: row.number } })
  if (lead) await touchLead(lead, ins.data, 'created')
  return { doc: ins.data, lead: lead ? { id: lead.id, name: lead.name } : null }
}
export async function updateDoc(id, input = {}, { req = null } = {}) {
  const cur = await getDoc(id)
  if (!cur) return { error: 'המסמך לא נמצא' }
  if (!canEdit(cur)) return { error: 'מסמך שכבר נשלח לחתימה לא ניתן לעריכה. אפשר לבטל אותו וליצור חדש.' }
  const tpId = input.templateId !== undefined ? input.templateId : cur.template_id
  const tp = tpId && tpId !== 'brokerage' ? await getTemplate(tpId).catch(() => null) : null
  const need = tp ? { requireProperty: !!tp.sections.property, requireFees: !!tp.sections.fees, requireAgent: false } : {}
  const { data, errors } = cleanDocInput({ ...cur.data, ...input, client: { ...cur.data.client, ...(input.client || {}) }, property: { ...cur.data.property, ...(input.property || {}) }, fees: { ...cur.data.fees, ...(input.fees || {}) }, agent: { ...cur.data.agent, ...(input.agent || {}) }, logo: { ...cur.data.logo, ...(input.logo || {}) }, fields: input.fields !== undefined ? input.fields : cur.data.fields }, need)
  if (errors.length) return { errors }
  const lead = await resolveLead({ leadId: input.leadId || cur.lead_id, phone: data.client.phone, email: data.client.email })
  const { data: row, error } = await sb().from('documents').update(v1Row({ data, ...columnsOf(data, { ...(input.projectId !== undefined ? { projectId: input.projectId } : {}), ...(input.templateId !== undefined ? { templateId: input.templateId } : {}) }), lead_id: lead?.id ? String(lead.id) : cur.lead_id, ...(input.propertyId !== undefined ? { property_id: input.propertyId ? String(input.propertyId).slice(0, 40) : null } : {}) })).eq('id', cur.id).select(SAFE).single()
  if (error) throw new Error(error.message)
  await addEvent(cur.id, 'updated', reqMeta(req))
  if (lead) await touchLead(lead, row, 'updated')
  return { doc: row }
}
export async function cancelDoc(id, { req = null, by = 'admin' } = {}) {
  const cur = await getDoc(id)
  if (!cur) return { error: 'המסמך לא נמצא' }
  if (!canCancel(cur)) return { error: cur.status === 'signed' ? 'מסמך חתום לא מבטלים — הוא נשאר כראיה' : 'המסמך כבר בוטל' }
  const { data: row, error } = await sb().from('documents').update({ status: 'cancelled', token_hash: null, otp_hash: null }).eq('id', cur.id).select(SAFE).single()
  if (error) throw new Error(error.message)
  await addEvent(cur.id, 'cancelled', { ...reqMeta(req), meta: { by } })
  const lead = cur.lead_id ? await leadById(cur.lead_id) : null
  if (lead) await touchLead(lead, row, 'cancelled')
  return { doc: row }
}
/** Delete a document for good — a signed one too (the office asked for it; the audit copy is gone with it): its files in the
 *  bucket (the sent PDF, the signed PDF, every signature image, the broker's), its events, Drive rows, the row itself, and the
 *  entry on the lead (a note says it was deleted). The Drive copies, if any, stay in Drive. */
export async function deleteDoc(id, { req = null, by = 'admin' } = {}) {
  const cur = await getDoc(id, { full: true })
  if (!cur) return { error: 'המסמך לא נמצא' }
  const d = cur.data || {}
  const paths = [...new Set([cur.original_path, cur.signed_path, cur.signature_path, d.agentSignature?.path, ...((d.signing?.list || []).map(s => s.signature_path))].filter(Boolean))]
  if (paths.length) await sb().storage.from(BUCKET).remove(paths).then(() => {}, () => {})
  await sb().from('document_events').delete().eq('document_id', cur.id)
  if (v2) await sb().from('drive_files').delete().eq('document_id', cur.id).then(() => {}, () => {})
  const { error } = await sb().from('documents').delete().eq('id', cur.id)
  if (error) throw new Error(error.message)
  const lead = cur.lead_id ? await leadById(cur.lead_id) : null
  if (lead) {
    try {
      const crm = { ...(lead.crm_data || {}) }
      crm.documents = (Array.isArray(crm.documents) ? crm.documents : []).filter(x => x && x.id !== cur.id)
      crm.notes = [{ id: `d${Date.now().toString(36)}dl`, text: `🗑 המסמך ${cur.number} (${d.title || DOC_TYPES.brokerage.name}) נמחק מהמערכת לצמיתות${cur.status === 'signed' ? ', כולל העותק החתום' : ''}.`, ts: Date.now(), kind: 'note', by: 'system', doc: cur.id }, ...(Array.isArray(crm.notes) ? crm.notes : [])].slice(0, 400)
      await sb().from('contacts').update({ crm_data: crm }).eq('id', lead.id)
    } catch (e) { console.error('[documents] delete lead note', e.message) }
  }
  console.log('[documents] deleted', cur.number, 'by', by, reqMeta(req).ip)
  return { ok: true, number: cur.number }
}
/** sent / opened documents whose link passed its expiry → expired (called from the list read and auto-tick) */
export async function sweepExpired() {
  const { data } = await sb().from('documents').select(SAFE).in('status', ['sent', 'opened']).lt('expires_at', new Date().toISOString()).limit(50)
  for (const r of data || []) {
    await sb().from('documents').update({ status: 'expired' }).eq('id', r.id); await addEvent(r.id, 'expired')
    const lead = r.lead_id ? await leadById(r.lead_id) : null
    if (lead) await touchLead(lead, { ...r, status: 'expired' }, 'expired')
    await notifyOffice('expired', { ...r, status: 'expired' }, { signer: currentSigner(r) }).catch(() => {})
  }
  return (data || []).length
}

// ── files ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function logoBytesOf(data) {
  const url = data?.logo?.url
  if (!url) return null
  try { const r = await fetch(url, { signal: AbortSignal.timeout(8000) }); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); return b.length < 3e6 ? b : null } catch { return null }
}
async function clausesFor(doc) { return Array.isArray(doc.clauses) && doc.clauses.length ? doc.clauses : (await getSettings()).clauses }
/** the PDF as it reads now (a draft preview, or the document sent for signing) */
export async function renderCurrent(doc) {
  return Buffer.from(await renderPdf(doc, { clauses: await clausesFor(doc), template: await templateForDoc(doc), logoBytes: await logoBytesOf(doc.data) }))
}
/** the template's own fields a document still lacks (the wizard asks for them before sending) */
export async function docMissing(doc) {
  const tp = await templateForDoc(doc)
  if (!tp) return []
  return missingFields(tp, templateValues(doc.data || {}, { number: doc.number })).filter(f => f.required)
}
export async function docFile(id, kind = 'original') {
  const doc = await getDoc(id, { full: true })
  if (!doc) return null
  const name = `${doc.number}${kind === 'signed' ? '-signed' : ''}`
  if (kind === 'docx') {
    return { bytes: await docxOf(doc), type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: `${name}.docx` }
  }
  if (kind === 'signed') { if (!doc.signed_path) return null; return { bytes: await getFile(doc.signed_path), type: 'application/pdf', name: `${name}.pdf` } }
  if (doc.original_path && kind === 'original') { try { return { bytes: await getFile(doc.original_path), type: 'application/pdf', name: `${name}.pdf` } } catch { /* re-render below */ } }
  return { bytes: await renderCurrent(doc), type: 'application/pdf', name: `${name}.pdf` }
}

// ── sending ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function mailer() {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return null
  const { default: nodemailer } = await import('nodemailer')
  return { user, t: nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: pass.replace(/\s+/g, '') } }) }
}
async function sendMail({ to, subject, html, text, attachments = [] }) {
  try {
    const m = await mailer()
    if (!m) return { ok: false, error: 'GMAIL_USER / GMAIL_APP_PASSWORD חסרים ב-Vercel' }
    const info = await m.t.sendMail({ from: `"אפיק הנחל – מסמכים" <${m.user}>`, to, subject, html, text, attachments })
    return { ok: true, id: info.messageId }
  } catch (e) { return { ok: false, error: e.message } }
}
const newToken = () => newSignCode()
/** read-modify-write of data (the signing state, the Drive state) on a fresh copy of the row → the row */
async function patchData(id, fn, extra = {}) {
  const cur = await getDoc(id, { full: true })
  if (!cur) return null
  const data = fn({ ...(cur.data || {}) }, cur) || cur.data
  const { data: row, error } = await sb().from('documents').update({ data, ...extra }).eq('id', id).select(SAFE).single()
  if (error) throw new Error(error.message)
  return row
}
/** the office's short WhatsApp (the office line + the settings' numbers) when the settings ask for that event */
async function notifyOffice(type, doc, { settings = null, signer = null, error = '' } = {}) {
  const st = settings || await getSettings()
  if (!st.notifyOn?.[type]) return { skipped: true }
  const lead = doc.lead_id ? { id: doc.lead_id } : null
  const text = officeEventText(type, doc, { cardLink: lead ? `${SITE}/admin-panel/leads?lead=${lead.id}` : `${SITE}/admin-panel/documents`, signer, error })
  if (!text) return { skipped: true }
  const out = { team: await Auto.notifyTeam(text).catch(e => ({ ok: false, error: e.message })), extra: [] }
  for (const n of st.notify) out.extra.push(await Auto.sendText(n, text).catch(e => ({ ok: false, error: e.message })))
  return out
}
/** the link to one signer by the channels they have: via = ['whatsapp', 'email'] → [{ via, to, ok, error, quota }] */
async function deliverLink(doc, signer, link, via, { personal = '', messageId = '', text = '', prev = null, reminder = 0, settings = null } = {}) {
  const wording = { personal, messageId, text }
  const channels = (Array.isArray(via) && via.length ? via : ['whatsapp', 'email']).filter(v => (v === 'whatsapp' && signer.phone) || (v === 'email' && signer.email))
  const results = []
  for (const ch of channels) {
    let r
    const first = (signer.i || 0) === 0
    if (ch === 'whatsapp') r = await Auto.sendText(signer.phone, reminder ? reminderWaText(doc, link, { signer, step: reminder }) : first ? clientWaText(doc, link, wording, settings) : nextSignerWaText(doc, link, signer, prev))
    else {
      const em = reminder ? reminderEmail(doc, link, { signer, step: reminder }) : first ? clientEmail(doc, link, wording, settings) : nextSignerEmail(doc, link, signer, prev)
      const pdf = doc.original_path ? await getFile(doc.original_path).catch(() => null) : null
      r = await sendMail({ to: signer.email, ...em, attachments: pdf ? [{ filename: `${doc.number}.pdf`, content: pdf, contentType: 'application/pdf' }] : [] })
    }
    results.push({ via: ch, to: ch === 'whatsapp' ? signer.phone : signer.email, ok: !!r.ok, error: r.ok ? '' : r.error || 'failed', quota: !!r.quota })
  }
  return results
}

/** send (or re-send) the private signing link to the signer whose turn it is: via = ['whatsapp', 'email'], personal = a line of
 *  the office's own. The same link goes out again unless it is the first send, the old one expired, or renew: true (then the
 *  old link dies); the clauses / template are frozen on the document at the first send. */
export async function sendDoc(id, { via = [], personal = '', messageId = '', text = '', renew = false, req = null, by = 'admin' } = {}) {
  const doc = await getDoc(id, { full: true })
  if (!doc) return { error: 'המסמך לא נמצא' }
  if (!canSend(doc)) return { error: doc.status === 'signed' ? 'המסמך כבר נחתם' : 'המסמך בוטל' }
  const d = doc.data || {}
  const settings = await getSettings()
  const client = sb()
  let signing = d.signing?.list?.length ? { ...d.signing, list: d.signing.list.map(x => ({ ...x })) } : startSigning(d)
  const who = signing.list[Math.min(signing.current ?? 0, signing.list.length - 1)]
  if (!who.phone && !who.email) return { error: `ל${who.name || 'חותם'} אין טלפון או אימייל לשליחה` }
  const fresh = renew || !doc.token_hash || isExpired(doc) || doc.status === 'expired' || doc.status === 'draft' || !decryptToken(signing.tok)
  const token = fresh ? newToken() : decryptToken(signing.tok)
  const clauses = Array.isArray(doc.clauses) && doc.clauses.length ? doc.clauses : settings.clauses
  const expires_at = fresh ? new Date(Date.now() + (d.expiryDays || settings.expiryDays) * 864e5).toISOString() : doc.expires_at
  // the PDF the signers sign — rendered once and kept, its hash on the record
  let original_path = doc.original_path, original_hash = doc.original_hash
  if (!original_path || doc.status === 'draft') {
    const bytes = await renderCurrent({ ...doc, clauses, expires_at })
    original_hash = sha256(bytes)
    original_path = `${doc.id}/${doc.number}-original.pdf`
    await putFile(original_path, bytes, 'application/pdf')
  }
  const now = new Date().toISOString()
  signing.list[who.i] = { ...who, status: who.status === 'opened' && !fresh ? 'opened' : 'sent', sent_at: who.sent_at && !fresh ? who.sent_at : now }
  signing.tok = encryptToken(token)
  const frozen = doc.template && Array.isArray(doc.template.blocks) ? doc.template : (doc.template_id ? await getTemplate(doc.template_id).catch(() => null) : null)
  await client.from('documents').update(v1Row({ data: { ...d, signing }, ...(fresh ? { token_hash: tokenHash(token), expires_at, otp_hash: null, otp_expires: null, otp_tries: 0 } : {}), clauses, ...(frozen ? { template: frozen } : {}), original_path, original_hash, status: doc.status === 'opened' && !fresh ? 'opened' : 'sent', sent_at: doc.sent_at || now })).eq('id', doc.id)
  if (fresh && doc.token_hash) await addEvent(doc.id, 'link_renewed', { ...reqMeta(req), meta: { by } })
  const link = signUrl(token)
  const log = [...(doc.send_log || [])]
  const wording = who.i ? null : signMessageLines({ ...doc, expires_at }, { personal, messageId, text }, settings)   // the first signer gets the chosen wording; later signers their own text
  const resend = !!doc.sent_at && !fresh
  const results = await deliverLink({ ...doc, expires_at, original_path }, who, link, via, { personal, messageId, text, settings, prev: who.i ? signing.list[who.i - 1] : null })
  for (const r of results) {
    log.push({ at: new Date().toISOString(), via: r.via, to: r.to, ok: r.ok, signer: who.i, ...(wording ? { message: wording.id, title: wording.title } : {}), ...(r.ok ? {} : { error: r.error }) })
    await addEvent(doc.id, r.ok ? (r.via === 'whatsapp' ? 'sent_whatsapp' : 'sent_email') : 'send_failed', { ...reqMeta(req), meta: { via: r.via, to: r.to, by, signer: who.i, ...(r.ok ? {} : { error: (r.error || '').slice(0, 200) }) } })
  }
  const anyOk = results.some(x => x.ok)
  const status = anyOk ? (doc.status === 'opened' && !fresh ? 'opened' : 'sent') : (doc.status === 'draft' || doc.status === 'failed' ? 'failed' : doc.status)
  const { data: row } = await client.from('documents').update({ status, send_log: log.slice(-40), sent_at: anyOk ? (doc.sent_at || now) : doc.sent_at }).eq('id', doc.id).select(SAFE).single()
  const lead = doc.lead_id ? await leadById(doc.lead_id) : null
  if (lead) { for (const r of results) if (r.ok) await touchLead(lead, row, resend ? 'resent' : r.via === 'whatsapp' ? 'sent_whatsapp' : 'sent_email', { message: wording?.title || '', via: r.via === 'whatsapp' ? 'וואטסאפ' : 'אימייל' }) }
  if (!anyOk) await notifyOffice('failed', row, { settings, signer: who, error: results[0]?.error || '' }).catch(() => {})
  if (anyOk) await driveQueue(row, 'original', { settings, sync: true }).catch(() => {})
  return { doc: await getDoc(doc.id), results, link: anyOk ? link : '', renewed: fresh, signer: { i: who.i, name: who.name, of: signing.list.length } }
}
/** the office's own copy of the current signer's link (a fresh one — the old link dies) */
export async function newLink(id, { req = null, by = 'admin' } = {}) {
  const doc = await getDoc(id, { full: true })
  if (!doc) return { error: 'המסמך לא נמצא' }
  if (!canSend(doc)) return { error: 'המסמך כבר נחתם או בוטל' }
  const settings = await getSettings()
  const token = newToken(), d = doc.data || {}
  const signing = d.signing?.list?.length ? { ...d.signing } : startSigning(d)
  const who = signing.list[Math.min(signing.current ?? 0, signing.list.length - 1)]
  signing.list = signing.list.map((x, k) => k === who.i ? { ...x, status: x.status === 'waiting' ? 'sent' : x.status, sent_at: x.sent_at || new Date().toISOString() } : x)
  signing.tok = encryptToken(token)
  const clauses = Array.isArray(doc.clauses) && doc.clauses.length ? doc.clauses : settings.clauses
  const expires_at = new Date(Date.now() + (d.expiryDays || settings.expiryDays) * 864e5).toISOString()
  let original_path = doc.original_path, original_hash = doc.original_hash
  if (!original_path || doc.status === 'draft') { const bytes = await renderCurrent({ ...doc, clauses, expires_at }); original_path = `${doc.id}/${doc.number}-original.pdf`; original_hash = sha256(bytes); await putFile(original_path, bytes, 'application/pdf') }
  const row = await patchRow(doc.id, { data: { ...d, signing }, token_hash: tokenHash(token), expires_at, clauses, original_path, original_hash, otp_hash: null, otp_expires: null, otp_tries: 0, status: doc.status === 'opened' ? 'opened' : 'sent', sent_at: doc.sent_at || new Date().toISOString() })
  await addEvent(doc.id, 'link_renewed', { ...reqMeta(req), meta: { by, manual: true, signer: who.i } })
  return { doc: row, link: signUrl(token), expires_at, signer: { i: who.i, name: who.name, of: signing.list.length } }
}

// ── reminders to a signer who hasn't signed (auto-tick / auto-run, and "שלח תזכורת עכשיו") ─────────────────────────
export async function remindUnsigned({ now = Date.now(), max = 10, only = '', force = false } = {}) {
  const settings = await getSettings()
  if (!force && !settings.reminders.enabled) return { skipped: 'off', sent: 0 }
  let qy = sb().from('documents').select(SAFE + ',token_hash').in('status', ['sent', 'opened']).gt('expires_at', new Date(now).toISOString()).order('sent_at', { ascending: true }).limit(200)
  if (only) qy = qy.eq('id', only)
  const { data: rows } = await qy
  const out = { due: 0, sent: 0, failed: 0 }
  for (const doc of rows || []) {
    const due = force ? { step: 'manual', signer: Math.min(doc.data?.signing?.current ?? 0, Math.max((doc.data?.signing?.list?.length || 1) - 1, 0)) } : reminderDue(doc, settings.reminders, now)
    if (!due) continue
    out.due++
    if (out.sent + out.failed >= max) break
    const d = doc.data || {}
    const signing = d.signing?.list?.length ? { ...d.signing, list: d.signing.list.map(x => ({ ...x })) } : { ...startSigning(d), list: startSigning(d).list.map((x, k) => k === 0 ? { ...x, status: 'sent', sent_at: doc.sent_at } : x) }
    const who = signing.list[due.signer]
    let link = decryptToken(signing.tok) ? signUrl(decryptToken(signing.tok)) : ''
    let renewed = false
    if (!link) { const r = await newLink(doc.id, { by: 'reminder' }).catch(() => null); if (!r?.link) { out.failed++; continue } link = r.link; renewed = true }
    const fresh = renewed ? await getDoc(doc.id, { full: true }) : doc
    const results = await deliverLink(fresh, who, link, ['whatsapp', 'email'], { reminder: due.step === 'manual' ? 1 : due.step })
    const ok = results.some(r => r.ok)
    const at = new Date(now).toISOString()
    await patchData(doc.id, data => { const sg = data.signing?.list?.length ? data.signing : signing; return { ...data, signing: { ...sg, reminders: [...(sg.reminders || []), { signer: due.signer, step: due.step, at, via: results.filter(r => r.ok).map(r => r.via), ok }] } } },
      { send_log: [...(fresh.send_log || []), ...results.map(r => ({ at, via: r.via, to: r.to, ok: r.ok, signer: due.signer, reminder: due.step, ...(r.ok ? {} : { error: r.error }) }))].slice(-40) })
    await addEvent(doc.id, ok ? 'reminder_sent' : 'send_failed', { meta: { reminder: due.step, signer: due.signer, via: results.filter(r => r.ok).map(r => r.via).join('+') || results[0]?.via, ...(ok ? {} : { error: (results[0]?.error || '').slice(0, 200) }) } })
    if (ok) { out.sent++; const lead = doc.lead_id ? await leadById(doc.lead_id) : null; if (lead) await touchLead(lead, fresh, 'reminder'); await notifyOffice('reminder', fresh, { settings, signer: who }).catch(() => {}) } else out.failed++
  }
  return out
}
/** "בלי תזכורות למסמך הזה" on / off */
export async function setNoRemind(id, off) {
  const row = await patchData(id, data => ({ ...data, signing: { ...(data.signing?.list?.length ? data.signing : startSigning(data)), noRemind: !!off } }))
  return row ? { doc: row } : { error: 'המסמך לא נמצא' }
}

// ── the signer's side ─────────────────────────────────────────────────────────────────────────────────────────
export async function openByToken(token, req) {
  const doc = await byToken(token)
  if (!doc) return { error: 'הקישור לא תקין או שהמסמך הוסר', code: 404 }
  const can = canSign(doc)
  const view = publicView(doc, await clausesFor(doc), await templateForDoc(doc))
  if (!can.ok) return { view, blocked: can.why, signed: !!can.signed, expired: !!can.expired }
  const who = currentSigner(doc)
  const firstOpen = doc.status === 'sent' || (doc.data?.signing?.list?.length && who.status !== 'opened')
  if (firstOpen) {
    const now = new Date().toISOString()
    const row = await patchData(doc.id, data => data.signing?.list?.length ? { ...data, signing: { ...data.signing, list: data.signing.list.map((x, k) => k === who.i ? { ...x, status: x.status === 'signed' ? 'signed' : 'opened', opened_at: x.opened_at || now } : x) } } : data,
      { status: 'opened', opened_at: doc.opened_at || now })
    await addEvent(doc.id, 'opened', { ...reqMeta(req), meta: { signer: who.i } })
    const lead = doc.lead_id ? await leadById(doc.lead_id) : null
    if (lead) await touchLead(lead, { ...doc, status: 'opened' }, 'opened')
    await notifyOffice('opened', row || doc, { signer: who }).catch(() => {})
    view.status = 'opened'
  }
  return { view }
}
export async function sendOtp(token, via, req) {
  const doc = await byToken(token)
  if (!doc) return { error: 'הקישור לא תקין', code: 404 }
  const can = canSign(doc)
  if (!can.ok) return { error: can.why, code: 409 }
  const who = currentSigner(doc)
  const channel = via === 'email' && who.email ? 'email' : who.phone ? 'whatsapp' : who.email ? 'email' : ''
  if (!channel) return { error: 'אין דרך לשלוח קוד אימות', code: 400 }
  if (doc.otp_expires && Date.parse(doc.otp_expires) - Date.now() > (OTP_MINUTES - 1) * 60e3) return { error: 'קוד כבר נשלח לפני רגע. בדקו את ההודעות, ואם לא הגיע אפשר לבקש שוב בעוד דקה.', code: 429 }
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0')
  const r = channel === 'whatsapp' ? await Auto.sendText(who.phone, otpText(code)) : await sendMail({ to: who.email, ...otpEmail(code) })
  if (!r.ok) { await addEvent(doc.id, 'send_failed', { ...reqMeta(req), meta: { via: channel, otp: true, error: (r.error || '').slice(0, 200) } }); return { error: channel === 'whatsapp' ? (r.quota ? 'שליחת הוואטסאפ חסומה כרגע. נסו קוד לאימייל, או פנו למשרד.' : 'שליחת הקוד בוואטסאפ נכשלה. נסו שוב או בקשו קוד לאימייל.') : 'שליחת הקוד באימייל נכשלה. נסו שוב.', code: 502 } }
  await sb().from('documents').update({ otp_hash: tokenHash(`${doc.id}:${code}`), otp_expires: new Date(Date.now() + OTP_MINUTES * 60e3).toISOString(), otp_tries: 0, otp_via: channel }).eq('id', doc.id)
  await addEvent(doc.id, 'otp_sent', { ...reqMeta(req), meta: { via: channel, signer: who.i } })
  const m = signerMask(who)
  return { ok: true, via: channel, to: channel === 'whatsapp' ? m.phoneMasked : m.emailMasked, minutes: OTP_MINUTES }
}
const dataUrlPng = s => { const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(s || '')); if (!m) return null; const b = Buffer.from(m[1], 'base64'); return b.length > 200 && b.length < 600000 && pngInfo(b).ok ? b : null }
/** every signature drawn so far, for the PDF: [{ png, name, idNumber, at, via, role }] in signing order */
async function signaturesOf(doc) {
  const list = doc.data?.signing?.list || []
  const out = []
  for (const s of list) if (s.status === 'signed' && s.signature_path) { const png = await getFile(s.signature_path).catch(() => null); if (png) out.push({ png, ...s.signature, signer: s.i ?? 0, role: s.role, name: s.signature?.name || s.name }) }
  return out
}
/** the Word file of a document — the same one for the office and the client: every signer's signature in its own box */
async function docxOf(doc) {
  const signed = doc.status === 'signed'
  const signatures = signed ? await signaturesOf(doc) : []
  const one = signed && !signatures.length && doc.signature_path ? await getFile(doc.signature_path).catch(() => null) : null
  return renderDocx(doc, { clauses: await clausesFor(doc), template: await templateForDoc(doc), signaturePng: one, signatures, logoBytes: await logoBytesOf(doc.data), agentPng: await agentPngOf(doc) })
}

/** the channel this signer's link last went out on (the send log), else the one they have */
function linkChannel(doc, who) {
  const log = (doc.send_log || []).filter(x => x.ok && (x.signer == null ? who.i === 0 : x.signer === who.i))
  const last = log[log.length - 1]
  if (last?.via === 'email' || last?.via === 'whatsapp') return last.via
  return who.phone ? 'whatsapp' : 'email'
}

export async function submitSignature(token, b = {}, req) {
  const doc = await byToken(token)
  if (!doc) return { error: 'הקישור לא תקין', code: 404 }
  if (doc.status === 'signed') return { ok: true, already: true, view: publicView(doc, await clausesFor(doc), await templateForDoc(doc)) }
  const can = canSign(doc)
  if (!can.ok) return { error: can.why, code: 409 }
  const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const idNumber = String(b.idNumber || '').replace(/\D/g, '').slice(0, 9)
  const address = String(b.address || '').replace(/\s+/g, ' ').trim().slice(0, 160)
  const code = String(b.code || '').replace(/\D/g, '')
  const png = dataUrlPng(b.signature)
  if (!b.agree) return { error: 'צריך לאשר שקראתם את המסמך ומסכימים לחתום עליו', code: 400 }
  if (name.length < 2) return { error: 'כתבו את שמכם המלא', code: 400 }
  if (!png) return { error: 'חסרה חתימה — ציירו אותה בתיבה', code: 400 }
  // a brokerage order needs the client's ID number and address (תקנות המתווכים — פרטי הזמנה בכתב): the client signer gives
  // whatever the document still lacks
  const who0 = currentSigner(doc), isClient = (who0?.i ?? 0) === 0
  const dc = doc.data?.client || {}
  if (isClient && !dc.idNumber && !idNumber) return { error: 'כתבו את מספר תעודת הזהות', code: 400 }
  if (idNumber && !validIsraeliId(idNumber)) return { error: 'מספר תעודת הזהות לא תקין — בדקו את הספרות', code: 400 }
  if (isClient && !dc.address && address.length < 4) return { error: 'כתבו את כתובת המגורים', code: 400 }
  // The personal link is the verification (it reaches only the recipient's own WhatsApp / email). A one-time code is checked
  // only when the page sent one (older pages); without a code the signature is recorded as "personal link".
  const useOtp = !!(code && doc.otp_hash)
  if (useOtp) {
    if (Date.parse(doc.otp_expires) < Date.now()) return { error: 'הקוד פג. בקשו קוד חדש.', code: 410 }
    if (doc.otp_tries >= OTP_MAX_TRIES) return { error: 'יותר מדי ניסיונות. בקשו קוד חדש.', code: 429 }
    if (tokenHash(`${doc.id}:${code}`) !== doc.otp_hash) {
      await sb().from('documents').update({ otp_tries: (doc.otp_tries || 0) + 1 }).eq('id', doc.id)
      await addEvent(doc.id, 'otp_failed', reqMeta(req))
      return { error: `הקוד שגוי (ניסיון ${(doc.otp_tries || 0) + 1} מתוך ${OTP_MAX_TRIES})`, code: 400 }
    }
  }
  const m = reqMeta(req), at = new Date().toISOString()
  const who = currentSigner(doc)
  // the client's ID / address written at signing become the document's (clause 1 and "פרטי הלקוח" in the signed copy)
  const d0 = doc.data || {}
  const d = who.i === 0 ? { ...d0, client: { ...(d0.client || {}), ...(idNumber && !d0.client?.idNumber ? { idNumber } : {}), ...(address && !d0.client?.address ? { address } : {}) } } : d0
  const base = d.signing?.list?.length ? d.signing : { ...startSigning(d), list: startSigning(d).list.map((x, k) => k === 0 ? { ...x, status: 'opened', sent_at: doc.sent_at, opened_at: doc.opened_at } : x) }
  const linkVia = linkChannel(doc, who)
  const method = useOtp ? 'otp' : 'link', channel = useOtp ? (doc.otp_via || 'whatsapp') : linkVia
  await addEvent(doc.id, 'verified', { ...m, meta: { via: channel, method, signer: who.i } })
  const signature_path = `${doc.id}/${doc.number}-signature${who.i ? `-${who.i}` : ''}.png`
  await putFile(signature_path, png, 'image/png')
  const mask = signerMask(who)
  const signature = { name, idNumber, address, at, method, via: channel, to: channel === 'email' ? mask.emailMasked : mask.phoneMasked, ip: m.ip, ua: m.ua, role: who.role, signer: who.i }
  const signing = advanceSigning(base, who.i, signature, { path: signature_path })
  await addEvent(doc.id, 'signed', { ...m, meta: { name, idNumber: idNumber ? '***' + idNumber.slice(-3) : '', signer: who.i, of: signing.list.length } })
  if (!signing.finished) {
    // the next signer's turn: a fresh link to them, the document stays "sent"
    const next = signing.list[signing.current]
    const token2 = newToken()
    signing.tok = encryptToken(token2)
    signing.list[next.i] = { ...next, status: 'sent', sent_at: at }
    const row = await patchRow(doc.id, { data: { ...d, signing }, token_hash: tokenHash(token2), otp_hash: null, otp_expires: null, otp_tries: 0, status: 'sent', signature, signature_path })
    await addEvent(doc.id, 'partial_signed', { meta: { signer: who.i, of: signing.list.length } })
    const results = await deliverLink(row, next, signUrl(token2), ['whatsapp', 'email'], { prev: who })
    const log = [...(doc.send_log || []), ...results.map(r => ({ at, via: r.via, to: r.to, ok: r.ok, signer: next.i, ...(r.ok ? {} : { error: r.error }) }))].slice(-40)
    await sb().from('documents').update({ send_log: log }).eq('id', doc.id)
    for (const r of results) await addEvent(doc.id, r.ok ? 'signer_sent' : 'send_failed', { meta: { via: r.via, to: r.to, signer: next.i, ...(r.ok ? {} : { error: (r.error || '').slice(0, 200) }) } })
    const lead = doc.lead_id ? await leadById(doc.lead_id) : null
    if (lead) await touchLead(lead, row, 'partial')
    await notifyOffice('partial', row, { signer: who }).catch(() => {})
    return { ok: true, partial: true, next: { name: next.name, role: next.role, sent: results.some(r => r.ok) }, view: publicView(row, await clausesFor(doc), await templateForDoc(doc)) }
  }
  // the last signature: the broker's own signature goes on with it (when it is theirs), then the signed PDF with every
  // signature and the certificate page
  let agentPng = null, agentSignature = null
  const agentSig = await getAgentSignatures().then(({ agents, sigs }) => signatureForDoc(agents, sigs, doc)).catch(() => null)
  if (agentSigns(doc, agentSig)) {
    const path = `${doc.id}/${doc.number}-agent.png`
    try { await putFile(path, agentSig.png, 'image/png'); agentPng = agentSig.png; agentSignature = { name: d.agent?.name || agentSig.name, at, path } } catch { /* the document is signed without it */ }
    if (agentSignature) await addEvent(doc.id, 'agent_signed', { meta: { name: agentSignature.name } })
  }
  const dd = agentSignature ? { ...d, agentSignature } : d
  const signedDoc = { ...doc, data: { ...dd, signing }, status: 'signed', signed_at: at, signature }
  const events = await listEvents(doc.id)
  const signatures = await signaturesOf(signedDoc)
  const bytes = Buffer.from(await renderPdf(signedDoc, { clauses: await clausesFor(doc), template: await templateForDoc(doc), logoBytes: await logoBytesOf(d), signaturePng: png, signatures, events, originalHash: doc.original_hash || '', signedHash: '', agentPng }))
  const signed_hash = sha256(bytes)
  const signed_path = `${doc.id}/${doc.number}-signed.pdf`
  await putFile(signed_path, bytes, 'application/pdf')
  const row = await patchRow(doc.id, { data: { ...dd, signing }, status: 'signed', signed_at: at, signature, signature_path, signed_path, signed_hash, otp_hash: null, otp_expires: null })
  const after = await afterSigned({ ...row, data: { ...dd, signing } }, bytes).catch(e => ({ error: e.message }))
  return { ok: true, view: publicView(row, await clausesFor(doc), await templateForDoc(doc)), after }
}
/** copies to every signer, the office's WhatsApp + email, the lead's card, Google Drive — once (notified_at) */
export async function afterSigned(doc, bytes = null) {
  if (doc.notified_at) return { skipped: 'already notified' }
  const client = sb()
  const { data: lock } = await client.from('documents').update({ notified_at: new Date().toISOString() }).eq('id', doc.id).is('notified_at', null).select('id')
  if (!lock?.length) return { skipped: 'already notified' }
  const pdf = bytes || await getFile(doc.signed_path)
  const d = doc.data || {}
  const out = { client: {}, office: {}, signers: [] }
  const list = d.signing?.list?.length ? d.signing.list : [{ i: 0, ...(d.client || {}), role: 'client' }]
  for (const s of list) {
    const r = {}
    if (s.email) { r.email = await sendMail({ to: s.email, ...clientSignedEmail({ ...doc, data: { ...d, client: { ...d.client, name: s.name, email: s.email } } }), attachments: [{ filename: `${doc.number}-signed.pdf`, content: pdf, contentType: 'application/pdf' }] }); if (r.email.ok) await addEvent(doc.id, 'copy_sent', { meta: { via: 'email', signer: s.i } }) }
    if (s.phone) { r.whatsapp = await Auto.sendText(s.phone, clientSignedWaText({ ...doc, data: { ...d, client: { ...d.client, name: s.name, email: s.email } } })); if (r.whatsapp.ok) await addEvent(doc.id, 'copy_sent', { meta: { via: 'whatsapp', signer: s.i } }) }
    out.signers.push({ i: s.i, ...r })
  }
  out.client = out.signers[0] || {}
  const lead = doc.lead_id ? await leadById(doc.lead_id) : await resolveLead({ phone: d.client?.phone, email: d.client?.email })
  const cardLink = lead ? `${SITE}/admin-panel/leads?lead=${lead.id}` : `${SITE}/admin-panel/documents`
  const settings = await getSettings()
  if (settings.notifyOn.signed) {
    const text = officeSignedText(doc, { cardLink })
    out.office.team = await Auto.notifyTeam(text)
    out.office.extra = []
    for (const n of settings.notify) out.office.extra.push({ to: n, ...(await Auto.sendText(n, text)) })
    const em = officeSignedEmail(doc, { cardLink })
    out.office.email = await sendMail({ to: settings.notifyEmail || process.env.ADMIN_NOTIFY_EMAIL || process.env.GMAIL_USER || '', ...em, attachments: [{ filename: `${doc.number}-signed.pdf`, content: pdf, contentType: 'application/pdf' }] })
    await addEvent(doc.id, 'office_notified', { meta: { whatsapp: !!out.office.team?.ok, email: !!out.office.email?.ok, extra: out.office.extra.filter(x => x.ok).length } })
  }
  if (lead) { if (!doc.lead_id) await client.from('documents').update({ lead_id: String(lead.id) }).eq('id', doc.id); await touchLead(lead, doc, 'signed') }
  out.drive = await driveQueue(doc, 'signed', { settings, sync: true }).catch(e => ({ error: e.message }))
  return out
}
export async function signedFileByToken(token, kind = 'signed') {
  const doc = await byToken(token)
  if (!doc) return null
  if (kind === 'signed') { if (!doc.signed_path) return null; return { bytes: await getFile(doc.signed_path), type: 'application/pdf', name: `${doc.number}-signed.pdf` } }
  if (kind === 'signature') { const p = currentSigner(doc)?.signature_path || doc.signature_path; if (!p) return null; return { bytes: await getFile(p), type: 'image/png', name: 'signature.png' } }
  if (kind === 'agent') { const b = await agentPngOf(doc); return b ? { bytes: b, type: 'image/png', name: 'agent-signature.png' } : null }
  if (kind === 'docx') {   // the same document as an editable Word file (right-to-left); signed = with the client's drawn signature
    if (!['sent', 'opened', 'signed'].includes(doc.status)) return null
    return { bytes: await docxOf(doc), type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: `${doc.number}${doc.status === 'signed' ? '-signed' : ''}.docx` }
  }
  if (!['sent', 'opened', 'signed'].includes(doc.status)) return null
  return { bytes: doc.original_path ? await getFile(doc.original_path) : await renderCurrent(doc), type: 'application/pdf', name: `${doc.number}.pdf` }
}

// ── Google Drive sync (the queue lives on the document: data.drive = { status: pending | synced | error | failed, want, files, tries, error }) ──
const driveOn = async settings => (settings || await getSettings()).drive.enabled !== false && await Drive.connected()
/** mark a file of the document for Drive (and try at once when sync: true — the queue is the safety net) */
export async function driveQueue(doc, kind, { settings = null, sync = false } = {}) {
  if (!(await driveOn(settings))) return { skipped: 'off' }
  const row = await patchData(doc.id, data => { const dr = data.drive || {}; return { ...data, drive: { ...dr, status: 'pending', want: [...new Set([...(dr.want || []), kind])], queuedAt: new Date().toISOString() } } })
  if (!row) return { error: 'המסמך לא נמצא' }
  if (!sync) return { queued: true }
  return Promise.race([driveSyncDoc(row).catch(e => ({ error: e.message })), new Promise(r => setTimeout(() => r({ queued: true, slow: true }), 9000))])
}
/** upload whatever the document still owes Drive → data.drive */
export async function driveSyncDoc(doc) {
  const full = await getDoc(doc.id, { full: true })
  if (!full) return { error: 'המסמך לא נמצא' }
  const dr = { ...(full.data?.drive || {}) }, files = { ...(dr.files || {}) }
  const want = (dr.want || []).filter(k => !files[k] && (k === 'signed' ? full.signed_path : full.original_path))
  let error = ''
  for (const kind of want) {
    try {
      const path = kind === 'signed' ? full.signed_path : full.original_path
      const bytes = await getFile(path)
      const folder = driveFolderPath(full, kind)
      let parentId = await Drive.ensureFolderPath(folder)
      let up
      try { up = await Drive.upload({ name: driveFileName(full, kind), parentId, bytes }) } catch (e) { if (e.status === 404) { parentId = await Drive.ensureFolderPath(folder, { fresh: true }); up = await Drive.upload({ name: driveFileName(full, kind), parentId, bytes }) } else throw e }
      files[kind] = { id: up.id, name: up.name, link: up.webViewLink || '', folder: folder.join('/'), at: new Date().toISOString(), md5: up.md5Checksum || '' }
      await sb().from('drive_files').insert({ document_id: full.id, kind, drive_id: up.id, name: up.name, folder: folder.join('/'), web_link: up.webViewLink || '', md5: up.md5Checksum || '' }).then(() => {}, () => {})
      await addEvent(full.id, 'drive_synced', { meta: { kind, name: up.name } })
    } catch (e) { error = e.message; break }
  }
  const done = (dr.want || []).every(k => files[k] || (k === 'signed' ? !full.signed_path : !full.original_path))
  const tries = error ? (dr.tries || 0) + 1 : 0
  const next = { ...dr, files, tries, error: error || null, status: error ? (tries >= 5 ? 'failed' : 'error') : done ? 'synced' : 'pending', syncedAt: error ? dr.syncedAt || null : new Date().toISOString() }
  await patchData(full.id, data => ({ ...data, drive: next }))
  if (error) { await addEvent(full.id, 'drive_failed', { meta: { error: error.slice(0, 200), tries } }); if (tries === 1 || tries >= 5) await notifyOffice('drive_failed', full, { error: error.slice(0, 120) }).catch(() => {}) }
  else if (done && want.length) { const lead = full.lead_id ? await leadById(full.lead_id) : null; if (lead) await touchLead(lead, { ...full, data: { ...full.data, drive: next } }, 'drive') }
  return { drive: next }
}
/** the queue: documents still pending / in error (auto-tick, auto-run, "סנכרון עכשיו"), then uploaded templates not in Drive yet */
export async function driveTick({ max = 4 } = {}) {
  if (!(await driveOn())) return { skipped: 'off', synced: 0 }
  const { data: rows } = await sb().from('documents').select('id,data->drive->tries').in('data->drive->>status', ['pending', 'error']).order('updated_at', { ascending: true }).limit(max)
  const out = { synced: 0, failed: 0, templates: 0 }
  for (const r of rows || []) { const s = await driveSyncDoc({ id: r.id }).catch(e => ({ error: e.message })); if (s.drive?.status === 'synced') out.synced++; else if (s.error || s.drive?.error) out.failed++ }
  if (v2) {
    const { data: tps } = await sb().from('doc_templates').select('id,name,source').eq('status', 'active').not('source', 'is', null).limit(20).then(r => r, () => ({ data: [] }))
    for (const tp of (tps || []).filter(t => t.source?.path && !t.source?.drive).slice(0, 2)) {
      try {
        const bytes = await getFile(tp.source.path)
        const parentId = await Drive.ensureFolderPath(DRIVE_TEMPLATES_PATH)
        const ext = (tp.source.name || '').split('.').pop() || 'pdf'
        const up = await Drive.upload({ name: `Template_${tp.name.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60)}.${ext}`, parentId, bytes, mime: tp.source.type || 'application/octet-stream' })
        await sb().from('doc_templates').update({ source: { ...tp.source, drive: { id: up.id, link: up.webViewLink || '', at: new Date().toISOString() } } }).eq('id', tp.id)
        out.templates++
      } catch (e) { out.templateError = e.message; break }
    }
  }
  return out
}
/** the connection and the counts for the settings card (never a token) */
export async function driveStatus() {
  const st = await Drive.status()
  const settings = await getSettings()
  const count = async s => { const { count: c } = await sb().from('documents').select('id', { count: 'exact', head: true }).eq('data->drive->>status', s); return c || 0 }
  const [synced, pending, error, failed] = st.connected ? await Promise.all([count('synced'), count('pending'), count('error'), count('failed')]) : [0, 0, 0, 0]
  return { ...st, enabled: settings.drive.enabled, counts: { synced, pending, error, failed } }
}

// ── the lead ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function leadById(id) {
  const { data } = await sb().from('contacts').select('id,name,phone,email,crm_data').eq('id', id).maybeSingle()
  return data || null
}
/** the CRM lead this document belongs to: the given id, else the newest lead with that phone, else that email — never a new one */
export async function resolveLead({ leadId = '', phone = '', email = '' } = {}) {
  if (leadId) { const l = await leadById(leadId); if (l) return l }
  if (phone) { const l = await Auto.findLeadByPhone(phone); if (l) return l }
  if (email) { const { data } = await sb().from('contacts').select('id,name,phone,email,crm_data').ilike('email', String(email).trim()).order('created_at', { ascending: false }).limit(1); if (data?.[0]) return data[0] }
  return null
}
/** crm_data.documents[] + a timeline note on the lead (read-modify-write) */
async function touchLead(lead, doc, type, extra = {}) {
  try {
    const fresh = await leadById(lead.id)
    if (!fresh) return
    const crm = { ...(fresh.crm_data || {}) }
    crm.documents = mergeLeadDocs(crm.documents, leadDocEntry(doc))
    const text = docNoteText(type, doc, extra)
    if (text) crm.notes = [{ id: `d${Date.now().toString(36)}${type.slice(0, 2)}`, text, ts: Date.now(), kind: 'note', by: 'system', doc: doc.id }, ...(Array.isArray(crm.notes) ? crm.notes : [])].slice(0, 400)
    await sb().from('contacts').update({ crm_data: crm }).eq('id', fresh.id)
  } catch (e) { console.error('[documents] lead', e.message) }
}
/** what the API tells the admin about the module's wiring (never a secret) */
export function status() {
  return { db: ready(), v2, whatsapp: Auto.greenConfigured(), email: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD), drive: true, provider: 'builtin', providerLabel: 'חתימה אלקטרונית מובנית (קוד חד-פעמי + חתימה מצוירת + שרשרת תיעוד)' }
}
export { DEFAULT_CLAUSES, DOC_TYPES, brokerageTemplate }
