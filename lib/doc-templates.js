// Document templates (admin "מסמכים וחתימות" → "תבניות"): any document the office uploads (Word, PDF, a scan) becomes a template —
// blocks of text (headings, paragraphs, numbered clauses) with {FIELD} placeholders — plus the fields it needs: the standard
// ones the CRM fills by itself (the lead, the property, the project, the fees, the agent, the company, the date) and the
// office's own fields (typed per document). Pure and tested (lib/doc-templates.test.mjs); runs in the browser (the editor,
// the wizard's preview) and on the server (rendering). The built-in brokerage order is one template among them.
import { COMPANY, DEAL_TYPES, CLIENT_ROLES, computeFees, fmtMoney, fmtPct, todayHe, DEFAULT_CLAUSES, DOC_TYPES, setTemplateRenderer } from './documents.js'

/** the standard fields — key → { label, group, type }; their values come from the document's data (templateValues) */
export const STANDARD_FIELDS = {
  CLIENT_NAME: { label: 'שם הלקוח (מלא)', group: 'client', type: 'text' },
  CLIENT_FIRST_NAME: { label: 'שם פרטי', group: 'client', type: 'text' },
  CLIENT_LAST_NAME: { label: 'שם משפחה', group: 'client', type: 'text' },
  CLIENT_ID: { label: 'ת.ז. הלקוח', group: 'client', type: 'text' },
  CLIENT_PHONE: { label: 'טלפון הלקוח', group: 'client', type: 'text' },
  CLIENT_EMAIL: { label: 'אימייל הלקוח', group: 'client', type: 'text' },
  CLIENT_ADDRESS: { label: 'כתובת הלקוח', group: 'client', type: 'text' },
  CLIENT_ROLE: { label: 'הלקוח בעסקה (קונה / שוכר…)', group: 'client', type: 'text' },
  PROPERTY_ADDRESS: { label: 'כתובת הנכס', group: 'property', type: 'text' },
  PROPERTY_CITY: { label: 'עיר', group: 'property', type: 'text' },
  PROPERTY_TYPE: { label: 'סוג הנכס', group: 'property', type: 'text' },
  PROPERTY_DESC: { label: 'תיאור הנכס', group: 'property', type: 'text' },
  PROPERTY_NOTES: { label: 'הערות על הנכס', group: 'property', type: 'text' },
  DEAL_TYPE: { label: 'סוג העסקה (מכר / שכירות)', group: 'property', type: 'text' },
  PRICE: { label: 'מחיר העסקה לפני מע"מ', group: 'fees', type: 'money' },
  PROJECT_NAME: { label: 'שם הפרויקט', group: 'project', type: 'text' },
  PROJECT_TOWN: { label: 'עיר הפרויקט', group: 'project', type: 'text' },
  COMMISSION_PCT: { label: 'אחוז דמי התיווך', group: 'fees', type: 'percent' },
  COMMISSION_BASIS: { label: 'בסיס דמי התיווך (אחוז / חודשים / קבוע)', group: 'fees', type: 'text' },
  COMMISSION: { label: 'דמי תיווך לפני מע"מ', group: 'fees', type: 'money' },
  VAT_RATE: { label: 'שיעור המע"מ', group: 'fees', type: 'percent' },
  VAT: { label: 'סכום המע"מ', group: 'fees', type: 'money' },
  TOTAL: { label: 'סה"כ כולל מע"מ', group: 'fees', type: 'money' },
  TERMS: { label: 'תנאים מסחריים נוספים', group: 'fees', type: 'text' },
  AGENT_NAME: { label: 'שם הסוכן', group: 'agent', type: 'text' },
  AGENT_LICENSE: { label: 'מספר רישיון הסוכן', group: 'agent', type: 'text' },
  AGENT_PHONE: { label: 'טלפון הסוכן', group: 'agent', type: 'text' },
  AGENT_EMAIL: { label: 'אימייל הסוכן', group: 'agent', type: 'text' },
  COMPANY_NAME: { label: 'שם החברה', group: 'company', type: 'text' },
  COMPANY_ID: { label: 'ח.פ.', group: 'company', type: 'text' },
  COMPANY_PHONE: { label: 'טלפון החברה', group: 'company', type: 'text' },
  COMPANY_EMAIL: { label: 'אימייל החברה', group: 'company', type: 'text' },
  DOCUMENT_DATE: { label: 'תאריך המסמך', group: 'document', type: 'date' },
  DOCUMENT_NUMBER: { label: 'מספר המסמך', group: 'document', type: 'text' },
}
export const FIELD_GROUPS = { client: 'פרטי הלקוח', property: 'פרטי הנכס', project: 'פרטי הפרויקט', fees: 'פרטי ההתקשרות', agent: 'הסוכן', company: 'החברה', document: 'המסמך', custom: 'שדות של המסמך' }
export const FIELD_TYPES = { text: 'טקסט', number: 'מספר', date: 'תאריך', money: 'סכום', percent: 'אחוז', checkbox: 'תיבת סימון', select: 'בחירה מרשימה' }
// the old camelCase placeholders of the brokerage clauses keep working
export const LEGACY_KEYS = { company: 'COMPANY_NAME', companyIdLabel: 'COMPANY_ID_LABEL', companyId: 'COMPANY_ID', clientName: 'CLIENT_NAME', clientId: 'CLIENT_ID', clientPhone: 'CLIENT_PHONE', clientEmail: 'CLIENT_EMAIL', clientAddress: 'CLIENT_ADDRESS', clientRole: 'CLIENT_ROLE', propertyAddress: 'PROPERTY_ADDRESS', propertyCity: 'PROPERTY_CITY', propertyDesc: 'PROPERTY_DESC', propertyType: 'PROPERTY_TYPE', dealType: 'DEAL_TYPE', price: 'PRICE', commissionPct: 'COMMISSION_PCT', feeBasis: 'COMMISSION_BASIS', commission: 'COMMISSION', vatRate: 'VAT_RATE', vat: 'VAT', total: 'TOTAL', agentName: 'AGENT_NAME', agentLicense: 'AGENT_LICENSE', agentPhone: 'AGENT_PHONE', date: 'DOCUMENT_DATE', terms: 'TERMS' }
const BLANK = '________'
const str = (v, n = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const KEY_RE = /^[A-Z][A-Z0-9_]{1,40}$/

/** a field key from a label: "שם היזם" → "SHM_HYZM"? no — Hebrew has no safe ASCII; the office picks a key or gets F_<n> */
export function keyFromLabel(label, taken = []) {
  const ascii = String(label || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30)
  const base = KEY_RE.test(ascii) ? ascii : 'FIELD'
  let k = base, i = 2
  while (taken.includes(k) || STANDARD_FIELDS[k]) k = `${base}_${i++}`
  return k
}
export function cleanField(f, taken = []) {
  const key = KEY_RE.test(String(f?.key || '')) ? String(f.key) : keyFromLabel(f?.label, taken)
  return { key, label: str(f?.label, 80) || key, type: FIELD_TYPES[f?.type] ? f.type : 'text', required: !!f?.required, default: str(f?.default, 300), ...(f?.type === 'select' ? { options: (Array.isArray(f.options) ? f.options : String(f.options || '').split(/[,\n]/)).map(o => str(o, 60)).filter(Boolean).slice(0, 30) } : {}), ...(f?.hint ? { hint: str(f.hint, 200) } : {}) }
}
export function cleanBlock(b) {
  const t = ['h', 'p', 'clause'].includes(b?.t) ? b.t : 'p'
  const text = String(b?.text || '').replace(/\r/g, '').trim().slice(0, 6000)
  return { t, ...(t === 'clause' ? { title: str(b?.title, 120) } : {}), text }
}
/** a template, cleaned: { id, name, kind, title, blocks, fields, sections, logo, source } */
export function cleanTemplate(tp = {}) {
  const fields = []
  for (const f of Array.isArray(tp.fields) ? tp.fields : []) { const c = cleanField(f, fields.map(x => x.key)); if (!fields.some(x => x.key === c.key)) fields.push(c) }
  const blocks = (Array.isArray(tp.blocks) ? tp.blocks : []).map(cleanBlock).filter(b => b.text || b.t === 'h').slice(0, 300)
  const s = tp.sections || {}
  const kind = tp.kind === 'brokerage' ? 'brokerage' : 'custom'
  return {
    id: tp.id || '', name: str(tp.name, 80) || (kind === 'brokerage' ? DOC_TYPES.brokerage.name : 'תבנית חדשה'), kind,
    title: str(tp.title, 120) || str(tp.name, 120) || DOC_TYPES.brokerage.name,
    blocks, fields: fields.slice(0, 60),
    sections: { parties: s.parties !== false, property: s.property !== false, fees: kind === 'brokerage' ? s.fees !== false : !!s.fees, signatures: s.signatures !== false },
    logo: { show: tp.logo?.show !== false, size: ['s', 'm', 'l'].includes(tp.logo?.size) ? tp.logo.size : 'm', align: ['right', 'center', 'left'].includes(tp.logo?.align) ? tp.logo.align : 'right', url: /^https:\/\//.test(String(tp.logo?.url || '')) ? tp.logo.url : '' },
    source: tp.source ? { name: str(tp.source.name, 120), path: str(tp.source.path, 300), type: str(tp.source.type, 80), method: str(tp.source.method, 20), pages: Number(tp.source.pages) || 0 } : null,
    status: tp.status === 'archived' ? 'archived' : 'active',
  }
}
/** the built-in brokerage order as a template (its clauses = the editor's clauses) */
export function brokerageTemplate(clauses = DEFAULT_CLAUSES) {
  return cleanTemplate({ id: 'brokerage', name: DOC_TYPES.brokerage.name, kind: 'brokerage', title: DOC_TYPES.brokerage.name, blocks: (clauses || DEFAULT_CLAUSES).map((c, i) => ({ t: 'clause', title: c.title, text: c.text, n: c.n || i + 1 })), fields: [], sections: { parties: true, property: true, fees: true, signatures: true } })
}
/** every placeholder a template uses (new and legacy keys, normalized) */
export function templateKeys(tp) {
  const out = new Set()
  for (const b of tp?.blocks || []) for (const m of String(b.text || '').matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)) out.add(LEGACY_KEYS[m[1]] || m[1])
  return [...out]
}
/** the values of the standard fields for a document's data (lib/documents.js shapes) */
export function templateValues(data = {}, { number = '', date = new Date(), project = null } = {}) {
  const f = computeFees(data.fees || {}), c = data.client || {}, p = data.property || {}, a = data.agent || {}
  const words = String(c.name || '').trim().split(/\s+/)
  const v = {
    CLIENT_NAME: c.name || '', CLIENT_FIRST_NAME: c.firstName || words[0] || '', CLIENT_LAST_NAME: c.lastName || words.slice(1).join(' '), CLIENT_ID: c.idNumber || '', CLIENT_PHONE: c.phone || '', CLIENT_EMAIL: c.email || '', CLIENT_ADDRESS: c.address || '', CLIENT_ROLE: CLIENT_ROLES[c.role] || '',
    PROPERTY_ADDRESS: p.address || '', PROPERTY_CITY: p.city || '', PROPERTY_TYPE: p.type || '', PROPERTY_DESC: p.desc || p.type || '', PROPERTY_NOTES: p.notes || '', DEAL_TYPE: DEAL_TYPES[p.dealType] || '',
    PRICE: f.price ? fmtMoney(f.price) : '', PROJECT_NAME: project?.name || data.projectName || '', PROJECT_TOWN: project?.town || '',
    COMMISSION_PCT: f.mode === 'percent' ? fmtPct(f.pct) : f.basis, COMMISSION_BASIS: f.basis, COMMISSION: fmtMoney(f.commission), VAT_RATE: fmtPct(f.vatRate), VAT: fmtMoney(f.vat), TOTAL: fmtMoney(f.total), TERMS: data.terms || '',
    AGENT_NAME: a.name || '', AGENT_LICENSE: a.license || '', AGENT_PHONE: a.phone || '', AGENT_EMAIL: a.email || '',
    COMPANY_NAME: COMPANY.name, COMPANY_ID: COMPANY.id, COMPANY_ID_LABEL: COMPANY.idLabel, COMPANY_PHONE: COMPANY.phone, COMPANY_EMAIL: COMPANY.email,
    DOCUMENT_DATE: todayHe(date), DOCUMENT_NUMBER: number || '',
  }
  for (const [k, val] of Object.entries(data.fields || {})) if (KEY_RE.test(k)) v[k] = val === true ? '✓' : val === false ? '' : String(val ?? '')
  return v
}
/** fill one text: {KEY} (or a legacy {camelKey}) → its value; a missing value → a blank line (TERMS → nothing) */
export function fillBlockText(text, values) {
  return String(text || '').replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (m, k) => { const key = LEGACY_KEYS[k] || k; if (!(key in values)) return m; const val = String(values[key] ?? '').trim(); return val || (key === 'TERMS' ? '' : BLANK) }).replace(/\s+\./g, '.').replace(/[ \t]{2,}/g, ' ').trim()
}
/** the template's blocks as they read for a document → [{ t, n?, title?, text }] */
export function renderBlocks(tp, values) {
  let n = 0
  const v = { ...Object.fromEntries((tp?.fields || []).map(f => [f.key, ''])), ...values }   // the template's own fields left empty print a blank line
  return (tp?.blocks || []).map(b => ({ t: b.t, ...(b.t === 'clause' ? { n: ++n, title: fillBlockText(b.title, v) } : {}), text: fillBlockText(b.text, v) }))
}
/** which of the template's own fields still lack a value (required ones first) */
export function missingFields(tp, values = {}) {
  return (tp?.fields || []).filter(f => !String(values[f.key] ?? '').trim()).sort((a, b) => Number(b.required) - Number(a.required))
}
/** the standard keys the template uses that the document's data left empty (the office sees them before sending) */
export function emptyStandardKeys(tp, values) {
  return templateKeys(tp).filter(k => STANDARD_FIELDS[k] && !String(values[k] ?? '').trim() && k !== 'TERMS')
}

// ── from a file's text to blocks, and field suggestions ───────────────────────────────────────────────────────────────────
/** plain text (the extraction's output) → blocks: a short line without a period = a heading, "1. כותרת" = a clause, else a paragraph */
export function textToBlocks(text) {
  const lines = String(text || '').replace(/\r/g, '').replace(/ /g, ' ').split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim())
  const out = []
  let para = []
  const flush = () => { if (para.length) { out.push({ t: 'p', text: para.join(' ') }); para = [] } }
  for (const l of lines) {
    if (!l) { flush(); continue }
    const clause = /^(\d{1,2})[.)]\s+(.{2,80})$/.exec(l)
    if (clause && !/[.:;]$/.test(l) && l.length <= 80) { flush(); out.push({ t: 'clause', title: clause[2], text: '' }); continue }
    const clauseInline = /^(\d{1,2})[.)]\s+([^.:]{2,60})[.:]\s+(.{10,})$/.exec(l)
    if (clauseInline) { flush(); out.push({ t: 'clause', title: clauseInline[2], text: clauseInline[3] }); continue }
    if (l.length <= 60 && !/[.,;:]$/.test(l) && !/^\d/.test(l) && (out.length === 0 || para.length === 0)) { flush(); out.push({ t: 'h', text: l }); continue }
    const last = out[out.length - 1]
    if (last && last.t === 'clause' && !last.text && !para.length) { last.text = l; continue }
    para.push(l)
  }
  flush()
  // a lone heading right before a clause/paragraph that repeats the title isn't useful; a heading-only document is a paragraph
  return out.filter(b => b.text || b.t === 'clause').slice(0, 300)
}
/** blanks and known patterns in the blocks → suggested fields: [{ block, start, end, found, key, label }] */
export function detectFields(blocks) {
  const PAT = [
    { re: /(ת\.?ז\.?|תעודת זהות)\s*[:\-]?\s*(_{3,}|\d{5,9})/g, key: 'CLIENT_ID' },
    { re: /(טלפון|נייד|טל')\s*[:\-]?\s*(_{3,}|0\d[\d\- ]{7,10})/g, key: 'CLIENT_PHONE' },
    { re: /(אימייל|דוא"ל|מייל|e-?mail)\s*[:\-]?\s*(_{3,}|[^\s@]+@[^\s@]+\.[^\s@]+)/gi, key: 'CLIENT_EMAIL' },
    { re: /(שם הלקוח|שם מלא|הח"מ)\s*[:\-]?\s*(_{3,})/g, key: 'CLIENT_NAME' },
    { re: /(כתובת הנכס|הנכס ברחוב|בכתובת)\s*[:\-]?\s*(_{3,})/g, key: 'PROPERTY_ADDRESS' },
    { re: /(דמי תיווך בשיעור של|בשיעור של)\s*(_{3,}|\d+(?:\.\d+)?\s*%)/g, key: 'COMMISSION_PCT' },
    { re: /(מחיר העסקה|תמורה בסך|בסך של)\s*[:\-]?\s*(_{3,}|₪?\s?[\d,]{4,}\s?₪?)/g, key: 'PRICE' },
    { re: /(תאריך|ביום)\s*[:\-]?\s*(_{3,}|\d{1,2}[./]\d{1,2}[./]\d{2,4})/g, key: 'DOCUMENT_DATE' },
    { re: /(שם הסוכן|המתווך)\s*[:\-]?\s*(_{3,})/g, key: 'AGENT_NAME' },
    { re: /(שם הפרויקט|בפרויקט)\s*[:\-]?\s*(_{3,})/g, key: 'PROJECT_NAME' },
  ]
  const out = []
  blocks.forEach((b, bi) => {
    const text = String(b.text || '')
    for (const p of PAT) for (const m of text.matchAll(p.re)) { const start = m.index + m[0].length - m[2].length; out.push({ block: bi, start, end: start + m[2].length, found: m[2], key: p.key, label: STANDARD_FIELDS[p.key]?.label || p.key }) }
    for (const m of text.matchAll(/_{3,}/g)) if (!out.some(o => o.block === bi && o.start <= m.index && o.end >= m.index + m[0].length)) out.push({ block: bi, start: m.index, end: m.index + m[0].length, found: m[0], key: '', label: 'שדה למילוי' })
  })
  return out.sort((a, b) => a.block - b.block || a.start - b.start)
}
/** put {KEY} in place of a span of a block's text → the new text */
export function applyField(text, start, end, key) {
  const s = String(text || '')
  return s.slice(0, Math.max(0, start)) + `{${key}}` + s.slice(Math.max(start, end))
}
/** a document's blocks from its template: the values come from its data, number, date and project */
export function docBlocks(tp, doc) {
  const v = templateValues(doc?.data || {}, { number: doc?.number || '', date: doc?.created_at ? new Date(doc.created_at) : new Date(), project: doc?.project_name ? { name: doc.project_name } : null })
  return renderBlocks(tp, v)
}
setTemplateRenderer(docBlocks)
/** the template a document renders with: the frozen copy on the row, else the given template, else the brokerage order */
export function templateOf(doc, template = null, clauses = null) {
  if (doc?.template && typeof doc.template === 'object' && Array.isArray(doc.template.blocks)) return cleanTemplate(doc.template)
  if (template) return cleanTemplate(template)
  return brokerageTemplate(clauses || undefined)
}
/** sample values so the editor's preview reads like a real document */
export function sampleValues() {
  return templateValues({ client: { name: 'רונן כהן', firstName: 'רונן', lastName: 'כהן', idNumber: '123456782', phone: '0501234567', email: 'ronen@example.com', address: 'הרצל 5, רעננה', role: 'buyer' }, property: { address: 'זרובבל 15', city: 'רעננה', desc: 'דירת 4 חדרים', type: 'דירה', dealType: 'sale' }, fees: { mode: 'percent', pct: 2, price: 3000000 }, agent: { name: 'ישראל בן-יהודה', license: '12345', phone: '0559811814' }, projectName: 'זרובבל 15' }, { number: 'AH-2026-0001' })
}
