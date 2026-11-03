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
import { cleanDocInput, cleanClauses, DEFAULT_CLAUSES, DEFAULT_VAT, DEFAULT_EXPIRY_DAYS, OTP_MINUTES, OTP_MAX_TRIES, docNumber, canEdit, canSend, canCancel, canSign, isExpired, signUrl, publicView, leadDocEntry, mergeLeadDocs, clientWaText, clientEmail, otpText, otpEmail, officeSignedText, officeSignedEmail, clientSignedEmail, clientSignedWaText, docNoteText, cleanPhone, validEmail, SITE, DOC_TYPES } from './documents.js'
import { eventHash, sha256, tokenHash } from './documents-hash.js'
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
    agent: { name: v.agent?.name || '', license: v.agent?.license || '', phone: v.agent?.phone || '', email: v.agent?.email || '' },
    notify: Array.isArray(v.notify) ? v.notify.map(intlPhone).filter(Boolean).slice(0, 5) : [],
    notifyEmail: validEmail(v.notifyEmail) ? String(v.notifyEmail || '') : '',
    logo: { show: v.logo?.show !== false, url: /^https:\/\//.test(String(v.logo?.url || '')) ? v.logo.url : '', size: ['s', 'm', 'l'].includes(v.logo?.size) ? v.logo.size : 'm', align: ['right', 'center', 'left'].includes(v.logo?.align) ? v.logo.align : 'right' },
    clauses: cleanClauses(t.brokerage?.clauses), clausesCustom: !!t.brokerage?.clauses?.length, clausesUpdatedAt: t.brokerage?.updatedAt || null,
  }
}
export async function saveSettings(patch = {}) {
  const cur = (await Auto.getSetting('doc_settings').catch(() => ({ value: null }))).value || {}
  const next = { ...cur }
  if ('vatRate' in patch) next.vatRate = Math.max(0, Math.min(50, Number(patch.vatRate) || 0))
  if ('expiryDays' in patch) next.expiryDays = Math.max(1, Math.min(90, Number(patch.expiryDays) || DEFAULT_EXPIRY_DAYS))
  if (patch.agent) next.agent = { name: String(patch.agent.name || '').slice(0, 80), license: String(patch.agent.license || '').slice(0, 40), phone: cleanPhone(patch.agent.phone), email: String(patch.agent.email || '').slice(0, 120) }
  if (Array.isArray(patch.notify)) next.notify = patch.notify.map(intlPhone).filter(Boolean).slice(0, 5)
  if ('notifyEmail' in patch) next.notifyEmail = validEmail(patch.notifyEmail) ? String(patch.notifyEmail || '').trim() : ''
  if (patch.logo) next.logo = { show: patch.logo.show !== false, url: /^https:\/\//.test(String(patch.logo.url || '')) ? String(patch.logo.url).slice(0, 400) : '', size: patch.logo.size, align: patch.logo.align }
  await Auto.putSetting('doc_settings', next)
  if (Array.isArray(patch.clauses)) await saveClauses(patch.clauses)
  return getSettings()
}
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
  const t = String(token || '').trim()
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(t)) return null
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
/** sent / opened documents whose link passed its expiry → expired (called from the list read and auto-tick) */
export async function sweepExpired() {
  const { data } = await sb().from('documents').select('id').in('status', ['sent', 'opened']).lt('expires_at', new Date().toISOString()).limit(50)
  for (const r of data || []) { await sb().from('documents').update({ status: 'expired' }).eq('id', r.id); await addEvent(r.id, 'expired') }
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
    const sig = doc.signature_path ? await getFile(doc.signature_path).catch(() => null) : null
    return { bytes: await renderDocx(doc, { clauses: await clausesFor(doc), template: await templateForDoc(doc), signaturePng: sig, logoBytes: await logoBytesOf(doc.data) }), type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: `${name}.docx` }
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
const newToken = () => crypto.randomBytes(24).toString('base64url')

/** send (or re-send) the private signing link: via = ['whatsapp', 'email'] (what the client has), personal = a line of the office's own.
 *  A fresh token on the first send, after an expiry, or with renew: true; the clauses are frozen on the document at the first send. */
export async function sendDoc(id, { via = [], personal = '', renew = false, req = null, by = 'admin' } = {}) {
  const doc = await getDoc(id, { full: true })
  if (!doc) return { error: 'המסמך לא נמצא' }
  if (!canSend(doc)) return { error: doc.status === 'signed' ? 'המסמך כבר נחתם' : 'המסמך בוטל' }
  const d = doc.data || {}
  const channels = (Array.isArray(via) && via.length ? via : [d.client?.phone ? 'whatsapp' : '', d.client?.email ? 'email' : '']).filter(v => (v === 'whatsapp' && d.client?.phone) || (v === 'email' && d.client?.email))
  if (!channels.length) return { error: 'ללקוח אין טלפון או אימייל לשליחה' }
  const settings = await getSettings()
  const client = sb()
  const fresh = renew || !doc.token_hash || isExpired(doc) || doc.status === 'expired' || doc.status === 'draft'
  const token = fresh ? newToken() : null
  const clauses = Array.isArray(doc.clauses) && doc.clauses.length ? doc.clauses : settings.clauses
  const expires_at = fresh ? new Date(Date.now() + (d.expiryDays || settings.expiryDays) * 864e5).toISOString() : doc.expires_at
  // the PDF the client signs — rendered once and kept, its hash on the record
  let original_path = doc.original_path, original_hash = doc.original_hash
  if (!original_path || fresh) {
    const bytes = await renderCurrent({ ...doc, clauses, expires_at })
    original_hash = sha256(bytes)
    original_path = `${doc.id}/${doc.number}-original.pdf`
    await putFile(original_path, bytes, 'application/pdf')
  }
  if (fresh) {
    const frozen = doc.template && Array.isArray(doc.template.blocks) ? doc.template : (doc.template_id ? await getTemplate(doc.template_id).catch(() => null) : null)
    await client.from('documents').update(v1Row({ token_hash: tokenHash(token), expires_at, clauses, ...(frozen ? { template: frozen } : {}), original_path, original_hash, otp_hash: null, otp_expires: null, otp_tries: 0, status: 'sent', sent_at: doc.sent_at || new Date().toISOString() })).eq('id', doc.id)
    if (doc.token_hash) await addEvent(doc.id, 'link_renewed', { ...reqMeta(req), meta: { by } })
  }
  if (!token) return { error: 'הקישור הישן לא זמין לשליחה חוזרת — הפיקו קישור חדש' }
  const link = signUrl(token)
  const log = [...(doc.send_log || [])]
  const results = []
  for (const ch of channels) {
    let r
    if (ch === 'whatsapp') r = await Auto.sendText(d.client.phone, clientWaText({ ...doc, expires_at }, link, { personal }))
    else {
      const em = clientEmail({ ...doc, expires_at }, link, { personal })
      const pdf = await getFile(original_path).catch(() => null)
      r = await sendMail({ to: d.client.email, ...em, attachments: pdf ? [{ filename: `${doc.number}.pdf`, content: pdf, contentType: 'application/pdf' }] : [] })
    }
    const to = ch === 'whatsapp' ? d.client.phone : d.client.email
    log.push({ at: new Date().toISOString(), via: ch, to, ok: !!r.ok, ...(r.ok ? {} : { error: r.error || 'failed' }) })
    results.push({ via: ch, ok: !!r.ok, error: r.ok ? '' : r.error || 'failed', quota: !!r.quota })
    await addEvent(doc.id, r.ok ? (ch === 'whatsapp' ? 'sent_whatsapp' : 'sent_email') : 'send_failed', { ...reqMeta(req), meta: { via: ch, to, by, ...(r.ok ? {} : { error: (r.error || '').slice(0, 200) }) } })
  }
  const anyOk = results.some(x => x.ok)
  const status = anyOk ? (doc.status === 'opened' && !fresh ? 'opened' : 'sent') : (doc.status === 'draft' || doc.status === 'failed' ? 'failed' : doc.status)
  const { data: row } = await client.from('documents').update({ status, send_log: log.slice(-30), sent_at: anyOk ? new Date().toISOString() : doc.sent_at }).eq('id', doc.id).select(SAFE).single()
  const lead = doc.lead_id ? await leadById(doc.lead_id) : null
  if (lead) { for (const r of results) if (r.ok) await touchLead(lead, row, r.via === 'whatsapp' ? 'sent_whatsapp' : 'sent_email') }
  return { doc: row, results, link: anyOk ? link : '', renewed: fresh }
}
/** the office's own copy of the link (shown once, to paste anywhere) — only a fresh one, so the hash is never reversed */
export async function newLink(id, { req = null, by = 'admin' } = {}) {
  const doc = await getDoc(id, { full: true })
  if (!doc) return { error: 'המסמך לא נמצא' }
  if (!canSend(doc)) return { error: 'המסמך כבר נחתם או בוטל' }
  const settings = await getSettings()
  const token = newToken(), d = doc.data || {}
  const clauses = Array.isArray(doc.clauses) && doc.clauses.length ? doc.clauses : settings.clauses
  const expires_at = new Date(Date.now() + (d.expiryDays || settings.expiryDays) * 864e5).toISOString()
  const bytes = await renderCurrent({ ...doc, clauses, expires_at })
  const original_path = `${doc.id}/${doc.number}-original.pdf`
  await putFile(original_path, bytes, 'application/pdf')
  const { data: row } = await sb().from('documents').update({ token_hash: tokenHash(token), expires_at, clauses, original_path, original_hash: sha256(bytes), otp_hash: null, otp_expires: null, otp_tries: 0, status: 'sent', sent_at: doc.sent_at || new Date().toISOString() }).eq('id', doc.id).select(SAFE).single()
  await addEvent(doc.id, 'link_renewed', { ...reqMeta(req), meta: { by, manual: true } })
  return { doc: row, link: signUrl(token), expires_at }
}

// ── the client's side ─────────────────────────────────────────────────────────────────────────────────────────────────────
export async function openByToken(token, req) {
  const doc = await byToken(token)
  if (!doc) return { error: 'הקישור לא תקין או שהמסמך הוסר', code: 404 }
  const can = canSign(doc)
  const view = publicView(doc, await clausesFor(doc), await templateForDoc(doc))
  if (!can.ok) return { view, blocked: can.why, signed: !!can.signed, expired: !!can.expired }
  if (doc.status === 'sent') {
    await sb().from('documents').update({ status: 'opened', opened_at: doc.opened_at || new Date().toISOString() }).eq('id', doc.id)
    await addEvent(doc.id, 'opened', reqMeta(req))
    const lead = doc.lead_id ? await leadById(doc.lead_id) : null
    if (lead) await touchLead(lead, { ...doc, status: 'opened' }, 'opened')
    view.status = 'opened'
  }
  return { view }
}
export async function sendOtp(token, via, req) {
  const doc = await byToken(token)
  if (!doc) return { error: 'הקישור לא תקין', code: 404 }
  const can = canSign(doc)
  if (!can.ok) return { error: can.why, code: 409 }
  const d = doc.data || {}
  const channel = via === 'email' && d.client?.email ? 'email' : d.client?.phone ? 'whatsapp' : d.client?.email ? 'email' : ''
  if (!channel) return { error: 'אין דרך לשלוח קוד אימות', code: 400 }
  if (doc.otp_expires && Date.parse(doc.otp_expires) - Date.now() > (OTP_MINUTES - 1) * 60e3) return { error: 'קוד כבר נשלח לפני רגע. בדקו את ההודעות, ואם לא הגיע אפשר לבקש שוב בעוד דקה.', code: 429 }
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0')
  const r = channel === 'whatsapp' ? await Auto.sendText(d.client.phone, otpText(code)) : await sendMail({ to: d.client.email, ...otpEmail(code) })
  if (!r.ok) { await addEvent(doc.id, 'send_failed', { ...reqMeta(req), meta: { via: channel, otp: true, error: (r.error || '').slice(0, 200) } }); return { error: channel === 'whatsapp' ? (r.quota ? 'שליחת הוואטסאפ חסומה כרגע. נסו קוד לאימייל, או פנו למשרד.' : 'הקוד לא נשלח בוואטסאפ. נסו שוב או בחרו אימייל.') : 'הקוד לא נשלח באימייל. נסו שוב או בחרו וואטסאפ.', code: 502 } }
  await sb().from('documents').update({ otp_hash: tokenHash(`${doc.id}:${code}`), otp_expires: new Date(Date.now() + OTP_MINUTES * 60e3).toISOString(), otp_tries: 0, otp_via: channel }).eq('id', doc.id)
  await addEvent(doc.id, 'otp_sent', { ...reqMeta(req), meta: { via: channel } })
  return { ok: true, via: channel, to: channel === 'whatsapp' ? publicView(doc).client.phoneMasked : publicView(doc).client.emailMasked, minutes: OTP_MINUTES }
}
const dataUrlPng = s => { const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(s || '')); if (!m) return null; const b = Buffer.from(m[1], 'base64'); return b.length > 200 && b.length < 600000 && b[0] === 0x89 ? b : null }

export async function submitSignature(token, b = {}, req) {
  const doc = await byToken(token)
  if (!doc) return { error: 'הקישור לא תקין', code: 404 }
  if (doc.status === 'signed') return { ok: true, already: true, view: publicView(doc, await clausesFor(doc), await templateForDoc(doc)) }
  const can = canSign(doc)
  if (!can.ok) return { error: can.why, code: 409 }
  const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const idNumber = String(b.idNumber || '').replace(/\D/g, '').slice(0, 9)
  const code = String(b.code || '').replace(/\D/g, '')
  const png = dataUrlPng(b.signature)
  if (!b.agree) return { error: 'צריך לאשר שקראתם את המסמך ומסכימים לחתום עליו', code: 400 }
  if (name.length < 2) return { error: 'כתבו את שמכם המלא', code: 400 }
  if (!png) return { error: 'חסרה חתימה — ציירו אותה בתיבה', code: 400 }
  if (!doc.otp_hash || !doc.otp_expires) return { error: 'קודם מקבלים קוד אימות', code: 400 }
  if (Date.parse(doc.otp_expires) < Date.now()) return { error: 'הקוד פג. בקשו קוד חדש.', code: 410 }
  if (doc.otp_tries >= OTP_MAX_TRIES) return { error: 'יותר מדי ניסיונות. בקשו קוד חדש.', code: 429 }
  if (tokenHash(`${doc.id}:${code}`) !== doc.otp_hash) {
    await sb().from('documents').update({ otp_tries: (doc.otp_tries || 0) + 1 }).eq('id', doc.id)
    await addEvent(doc.id, 'otp_failed', reqMeta(req))
    return { error: `הקוד שגוי (ניסיון ${(doc.otp_tries || 0) + 1} מתוך ${OTP_MAX_TRIES})`, code: 400 }
  }
  const m = reqMeta(req), at = new Date().toISOString()
  await addEvent(doc.id, 'verified', { ...m, meta: { via: doc.otp_via } })
  // the signature file, the record, the signed PDF with the certificate page
  const signature_path = `${doc.id}/${doc.number}-signature.png`
  await putFile(signature_path, png, 'image/png')
  const d = doc.data || {}
  const signature = { name, idNumber, at, via: doc.otp_via || 'whatsapp', to: doc.otp_via === 'email' ? publicView(doc).client.emailMasked : publicView(doc).client.phoneMasked, ip: m.ip, ua: m.ua }
  const signedEv = await addEvent(doc.id, 'signed', { ...m, meta: { name, idNumber: idNumber ? '***' + idNumber.slice(-3) : '' } })
  const signedDoc = { ...doc, status: 'signed', signed_at: at, signature }
  const events = await listEvents(doc.id)
  const bytes = Buffer.from(await renderPdf(signedDoc, { clauses: await clausesFor(doc), template: await templateForDoc(doc), logoBytes: await logoBytesOf(d), signaturePng: png, events, originalHash: doc.original_hash || '', signedHash: '' }))
  const signed_hash = sha256(bytes)
  const signed_path = `${doc.id}/${doc.number}-signed.pdf`
  await putFile(signed_path, bytes, 'application/pdf')
  const { data: row } = await sb().from('documents').update({ status: 'signed', signed_at: at, signature, signature_path, signed_path, signed_hash, otp_hash: null, otp_expires: null }).eq('id', doc.id).select(SAFE).single()
  void signedEv
  const after = await afterSigned({ ...row, data: d }, bytes).catch(e => ({ error: e.message }))
  return { ok: true, view: publicView(row, await clausesFor(doc), await templateForDoc(doc)), after }
}
/** copies to the client, the office's WhatsApp + email, the lead's card — once (notified_at) */
export async function afterSigned(doc, bytes = null) {
  if (doc.notified_at) return { skipped: 'already notified' }
  const client = sb()
  const { data: lock } = await client.from('documents').update({ notified_at: new Date().toISOString() }).eq('id', doc.id).is('notified_at', null).select('id')
  if (!lock?.length) return { skipped: 'already notified' }
  const pdf = bytes || await getFile(doc.signed_path)
  const d = doc.data || {}
  const out = { client: {}, office: {} }
  if (d.client?.email) { out.client.email = await sendMail({ to: d.client.email, ...clientSignedEmail(doc), attachments: [{ filename: `${doc.number}-signed.pdf`, content: pdf, contentType: 'application/pdf' }] }); if (out.client.email.ok) await addEvent(doc.id, 'copy_sent', { meta: { via: 'email' } }) }
  if (d.client?.phone) { out.client.whatsapp = await Auto.sendText(d.client.phone, clientSignedWaText(doc)); if (out.client.whatsapp.ok) await addEvent(doc.id, 'copy_sent', { meta: { via: 'whatsapp' } }) }
  const lead = doc.lead_id ? await leadById(doc.lead_id) : await resolveLead({ phone: d.client?.phone, email: d.client?.email })
  const cardLink = lead ? `${SITE}/admin-panel/leads?lead=${lead.id}` : `${SITE}/admin-panel/documents`
  const settings = await getSettings()
  const text = officeSignedText(doc, { cardLink })
  out.office.team = await Auto.notifyTeam(text)
  out.office.extra = []
  for (const n of settings.notify) out.office.extra.push({ to: n, ...(await Auto.sendText(n, text)) })
  const em = officeSignedEmail(doc, { cardLink })
  out.office.email = await sendMail({ to: settings.notifyEmail || process.env.ADMIN_NOTIFY_EMAIL || process.env.GMAIL_USER || '', ...em, attachments: [{ filename: `${doc.number}-signed.pdf`, content: pdf, contentType: 'application/pdf' }] })
  await addEvent(doc.id, 'office_notified', { meta: { whatsapp: !!out.office.team?.ok, email: !!out.office.email?.ok, extra: out.office.extra.filter(x => x.ok).length } })
  if (lead) { if (!doc.lead_id) await client.from('documents').update({ lead_id: String(lead.id) }).eq('id', doc.id); await touchLead(lead, doc, 'signed') }
  return out
}
export async function signedFileByToken(token, kind = 'signed') {
  const doc = await byToken(token)
  if (!doc) return null
  if (kind === 'signed') { if (!doc.signed_path) return null; return { bytes: await getFile(doc.signed_path), type: 'application/pdf', name: `${doc.number}-signed.pdf` } }
  if (!['sent', 'opened', 'signed'].includes(doc.status)) return null
  return { bytes: doc.original_path ? await getFile(doc.original_path) : await renderCurrent(doc), type: 'application/pdf', name: `${doc.number}.pdf` }
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
async function touchLead(lead, doc, type) {
  try {
    const fresh = await leadById(lead.id)
    if (!fresh) return
    const crm = { ...(fresh.crm_data || {}) }
    crm.documents = mergeLeadDocs(crm.documents, leadDocEntry(doc))
    const text = docNoteText(type, doc)
    if (text) crm.notes = [{ id: `d${Date.now().toString(36)}${type.slice(0, 2)}`, text, ts: Date.now(), kind: 'note', by: 'system', doc: doc.id }, ...(Array.isArray(crm.notes) ? crm.notes : [])].slice(0, 400)
    await sb().from('contacts').update({ crm_data: crm }).eq('id', fresh.id)
  } catch (e) { console.error('[documents] lead', e.message) }
}
/** what the API tells the admin about the module's wiring (never a secret) */
export function status() {
  return { db: ready(), v2, whatsapp: Auto.greenConfigured(), email: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD), provider: 'builtin', providerLabel: 'חתימה אלקטרונית מובנית (קוד חד-פעמי + חתימה מצוירת + שרשרת תיעוד)' }
}
export { DEFAULT_CLAUSES, DOC_TYPES, brokerageTemplate }
