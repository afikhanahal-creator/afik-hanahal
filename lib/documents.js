// Documents & digital signatures (admin "מסמכים וחתימות"): the pure rules — the brokerage-order template (8 clauses with
// placeholders), fee arithmetic (percent / fixed / months of rent, VAT), document numbers, statuses, what the public signing
// page may see, the audit-trail hash chain, and every message (WhatsApp / email, client and office). Tested in
// lib/documents.test.mjs. The database, storage, sending and signing calls live in lib/documents-server.js; the PDF in
// lib/doc-pdf.js, the Word file in lib/doc-docx.js.

export const COMPANY = {
  name: 'אפיק הנחל יזום, שיווק, תיווך נדל"ן בע"מ',
  short: 'אפיק הנחל',
  idLabel: 'ח.פ.',
  id: '517082038',
  phone: '055-981-1814',
  email: 'afik.hanahal@gmail.com',
  site: 'https://www.afikhanahal.co.il',
}
export const SITE = 'https://www.afikhanahal.co.il'
export const DEFAULT_VAT = 18                      // % — editable in the module's settings (changes every few years)
export const DOC_TYPES = { brokerage: { id: 'brokerage', name: 'טופס הזמנת שירותי תיווך', en: 'Brokerage services order form' } }
export const DEAL_TYPES = { sale: 'מכר', rent: 'שכירות' }
export const CLIENT_ROLES = { buyer: 'קונה', renter: 'שוכר', seller: 'מוכר', landlord: 'משכיר' }
export const FEE_MODES = { percent: 'אחוז ממחיר העסקה', fixed: 'סכום קבוע', months: 'חודשי שכירות' }
export const STATUSES = ['draft', 'sent', 'opened', 'signed', 'expired', 'cancelled', 'failed']
export const STATUS_HE = { draft: 'טיוטה', sent: 'ממתין לחתימה', opened: 'נפתח', signed: 'נחתם', expired: 'פג תוקף', cancelled: 'בוטל', failed: 'השליחה נכשלה' }
export const EVENT_HE = {
  created: 'המסמך נוצר', updated: 'המסמך עודכן', sent_whatsapp: 'נשלח בוואטסאפ', sent_email: 'נשלח באימייל', send_failed: 'השליחה נכשלה',
  opened: 'הלקוח פתח את המסמך', otp_sent: 'קוד אימות נשלח', otp_failed: 'קוד אימות שגוי', verified: 'הזהות אומתה', signed: 'הלקוח חתם',
  copy_sent: 'עותק חתום נשלח ללקוח', office_notified: 'המשרד עודכן', cancelled: 'המסמך בוטל', expired: 'הקישור פג', resent: 'נשלח שוב',
  link_renewed: 'קישור חדש הופק', downloaded: 'הורדה',
}
export const DEFAULT_EXPIRY_DAYS = 14
export const OTP_MINUTES = 10
export const OTP_MAX_TRIES = 5
export const TEMPLATE_VERSION = 1

// The eight clauses of the office's brokerage order — the base wording. The office pastes / edits the exact text of its master
// Word file in the admin's "תבניות" area (saved in app_settings.doc_templates); nothing here changes legal terms by itself.
// Placeholders in {curly braces} are filled from the document; a missing value prints as a blank line.
export const DEFAULT_CLAUSES = [
  { n: 1, title: 'הצדדים', text: 'אני/אנו הח"מ, {clientName}, ת.ז. {clientId}, מרחוב {clientAddress}, טלפון {clientPhone} (להלן: "הלקוח"), מזמין/ה בזאת מאת {company}, {companyIdLabel} {companyId} (להלן: "המתווך"), שירותי תיווך במקרקעין כמפורט בטופס זה.' },
  { n: 2, title: 'הנכס', text: 'הנכס נשוא ההזמנה: {propertyDesc}, בכתובת {propertyAddress}, {propertyCity} (להלן: "הנכס"). סוג העסקה המבוקשת: {dealType}. הלקוח פועל בעסקה כ{clientRole}.' },
  { n: 3, title: 'הצהרת הלקוח', text: 'הלקוח מצהיר כי המתווך הוא שהציג בפניו את הנכס ו/או את הצד השני לעסקה, וכי לא ידע על הנכס קודם לכן מגורם אחר, אלא אם צוין אחרת בכתב בטופס זה.' },
  { n: 4, title: 'בלעדיות', text: 'ככל שסוכם על בלעדיות, היא תחול לתקופה ובתנאים שייקבעו בנספח נפרד בהתאם לחוק המתווכים במקרקעין, התשנ"ו-1996 ותקנותיו. בהיעדר נספח כאמור, ההזמנה אינה בלעדית.' },
  { n: 5, title: 'הגורם היעיל', text: 'הלקוח מתחייב לשלם למתווך דמי תיווך אם המתווך היה הגורם היעיל שהביא להתקשרות הצדדים בהסכם מחייב ביחס לנכס, לרבות אם ההסכם נחתם לאחר תום תקופת ההזמנה, ובלבד שהמתווך הציג את הנכס ללקוח במהלכה.' },
  { n: 6, title: 'דמי התיווך', text: 'בגין שירותי התיווך ישלם הלקוח למתווך דמי תיווך בשיעור של {commissionPct} ממחיר העסקה ({feeBasis}), ובסך {commission} בתוספת מע"מ כדין בשיעור {vatRate} ({vat}), ובסך הכל {total}. מחיר העסקה לצורך חישוב: {price} לפני מע"מ. {terms}' },
  { n: 7, title: 'מועד התשלום', text: 'דמי התיווך ישולמו במועד חתימת הסכם מחייב בין הצדדים לעסקה (הסכם מכר, הסכם שכירות או זיכרון דברים), כנגד חשבונית מס כדין. איחור בתשלום יישא הפרשי הצמדה וריבית כדין.' },
  { n: 8, title: 'כללי', text: 'הלקוח מאשר כי קרא טופס זה, הבין את תוכנו וחתם עליו מרצונו החופשי. טופס זה נחתם בחתימה אלקטרונית באמצעות המערכת של המתווך, ותיעוד החתימה (מועד, אמצעי אימות ומזהה המסמך) נשמר כחלק בלתי נפרד ממנו. המתווך: {agentName}, מתווך/ת מורשה/ית, רישיון מס\' {agentLicense}, טלפון {agentPhone}.' },
]

export const PLACEHOLDERS = ['company', 'companyIdLabel', 'companyId', 'clientName', 'clientId', 'clientPhone', 'clientEmail', 'clientAddress', 'clientRole', 'propertyAddress', 'propertyCity', 'propertyDesc', 'propertyType', 'dealType', 'price', 'commissionPct', 'feeBasis', 'commission', 'vatRate', 'vat', 'total', 'agentName', 'agentLicense', 'agentPhone', 'date', 'terms']

const r2 = n => Math.round((Number(n) || 0) * 100) / 100
export const fmtMoney = (n, { sign = true } = {}) => {
  const v = r2(n)
  const s = v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return sign ? `₪${s}` : s
}
export const fmtPct = p => `${String(r2(p)).replace(/\.0+$/, '')}%`
export const todayHe = (d = new Date()) => new Date(d).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' })
// date + time as one left-to-right island (U+202A … U+202C), so "04.11.2026, 10:13" keeps its order inside Hebrew text
export const whenHe = d => `\u202A${new Date(d).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}\u202C`

/** Fee arithmetic. fees = { mode: percent | fixed | months, pct, fixed, months, price (ex VAT), vatRate } → every amount, rounded. */
export function computeFees(f = {}) {
  const mode = FEE_MODES[f.mode] ? f.mode : 'percent'
  const price = Math.max(0, r2(f.price))
  const vatRate = f.vatRate == null || f.vatRate === '' ? DEFAULT_VAT : Math.max(0, r2(f.vatRate))
  const pct = Math.max(0, r2(f.pct == null || f.pct === '' ? 2 : f.pct))
  const months = Math.max(0, r2(f.months == null || f.months === '' ? 1 : f.months))
  const fixed = Math.max(0, r2(f.fixed))
  const commission = r2(mode === 'percent' ? price * pct / 100 : mode === 'months' ? price * months : fixed)
  const vat = r2(commission * vatRate / 100)
  const total = r2(commission + vat)
  const basis = mode === 'percent' ? `${fmtPct(pct)} ממחיר העסקה` : mode === 'months' ? `${String(months).replace(/\.0+$/, '')} ${months === 1 ? 'חודש שכירות' : 'חודשי שכירות'}` : 'סכום קבוע'
  return { mode, price, pct, months, fixed, vatRate, commission, vat, total, basis }
}

/** The number of a new document: AH-<year>-<4 digits> (seq = how many the year already has) */
export function docNumber(seq, now = new Date()) {
  const y = new Date(now).toLocaleDateString('en-GB', { timeZone: 'Asia/Jerusalem', year: 'numeric' })
  return `AH-${y}-${String((Number(seq) || 0) + 1).padStart(4, '0')}`
}

/** Israeli ID number checksum (9 digits, Luhn-like); an empty value passes (the office may not ask for it) */
export function validIsraeliId(id) {
  const d = String(id || '').replace(/\D/g, '')
  if (!d) return true
  if (d.length < 5 || d.length > 9) return false
  const s = d.padStart(9, '0').split('').reduce((sum, ch, i) => { let v = Number(ch) * ((i % 2) + 1); if (v > 9) v -= 9; return sum + v }, 0)
  return s % 10 === 0
}
export const cleanPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('972') ? '0' + d.slice(3) : d }
export const validPhone = p => /^05\d{8}$/.test(cleanPhone(p))
export const validEmail = e => !e || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e).trim())
const str = (v, n = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

/** The document's editable content, cleaned: { client, property, fees, agent, terms, logo, expiryDays } → { data, errors } */
export function cleanDocInput(b = {}, { requireProperty = true, requireFees = true, requireAgent = true } = {}) {
  const errors = []
  const c = b.client || {}
  const client = { firstName: str(c.firstName, 60), lastName: str(c.lastName, 60), name: str(c.name, 120) || [str(c.firstName, 60), str(c.lastName, 60)].filter(Boolean).join(' '), idNumber: String(c.idNumber || '').replace(/\D/g, '').slice(0, 9), phone: cleanPhone(c.phone), email: str(c.email, 120).toLowerCase(), address: str(c.address, 200), role: CLIENT_ROLES[c.role] ? c.role : 'buyer' }
  const p = b.property || {}
  const property = { address: str(p.address, 200), city: str(p.city, 80), desc: str(p.desc, 400), type: str(p.type, 60), id: str(p.id, 40), link: str(p.link, 300), notes: str(p.notes, 400), dealType: DEAL_TYPES[p.dealType] ? p.dealType : 'sale' }
  const fees = computeFees({ ...(b.fees || {}), price: b.fees?.price })
  const a = b.agent || {}
  const agent = { name: str(a.name, 80), license: str(a.license, 40), phone: cleanPhone(a.phone), email: str(a.email, 120).toLowerCase() }
  const l = b.logo || {}
  const logo = { show: l.show !== false, url: /^https:\/\//.test(String(l.url || '')) ? String(l.url).slice(0, 400) : '', size: ['s', 'm', 'l'].includes(l.size) ? l.size : 'm', align: ['right', 'center', 'left'].includes(l.align) ? l.align : 'right' }
  const terms = str(b.terms, 600)
  const expiryDays = Math.min(90, Math.max(1, Number(b.expiryDays) || DEFAULT_EXPIRY_DAYS))
  const title = str(b.title, 120)
  // the template's own fields (key → the typed value) and the project the document belongs to
  const fields = {}
  for (const [k, v] of Object.entries(b.fields && typeof b.fields === 'object' && !Array.isArray(b.fields) ? b.fields : {})) if (/^[A-Z][A-Z0-9_]{1,40}$/.test(k)) fields[k] = typeof v === 'boolean' ? v : str(v, 300)
  const projectName = str(b.projectName, 80)
  if (!client.name) errors.push('שם הלקוח חסר')
  if (!client.phone && !client.email) errors.push('צריך טלפון או אימייל של הלקוח')
  if (client.phone && !validPhone(client.phone)) errors.push('מספר הטלפון של הלקוח לא תקין')
  if (!validEmail(client.email)) errors.push('כתובת האימייל של הלקוח לא תקינה')
  if (client.idNumber && !validIsraeliId(client.idNumber)) errors.push('מספר תעודת הזהות לא תקין')
  if (requireProperty && !property.address) errors.push('כתובת הנכס חסרה')
  if (requireFees) {
    if (!(fees.price > 0)) errors.push('מחיר העסקה (לפני מע"מ) חסר')
    if (fees.mode === 'percent' && (fees.pct <= 0 || fees.pct > 15)) errors.push('אחוז דמי התיווך צריך להיות בין 0.1 ל-15')
    if (fees.mode === 'fixed' && !(fees.fixed > 0)) errors.push('סכום דמי התיווך חסר')
    if (fees.mode === 'months' && !(fees.months > 0)) errors.push('מספר חודשי השכירות חסר')
  }
  if (requireAgent && !agent.name) errors.push('שם הסוכן חסר')
  return { data: { client, property, fees, agent, logo, terms, expiryDays, title, fields, projectName }, errors }
}

/** The values the placeholders stand for, from a document's data (missing → a blank line) */
export function placeholderValues(data = {}, { date = new Date() } = {}) {
  const f = computeFees(data.fees || {})
  const c = data.client || {}, p = data.property || {}, a = data.agent || {}
  const v = {
    company: COMPANY.name, companyIdLabel: COMPANY.idLabel, companyId: COMPANY.id,
    clientName: c.name, clientId: c.idNumber, clientPhone: c.phone, clientEmail: c.email, clientAddress: c.address, clientRole: CLIENT_ROLES[c.role] || '',
    propertyAddress: p.address, propertyCity: p.city, propertyDesc: p.desc || p.type || 'הנכס', propertyType: p.type, dealType: DEAL_TYPES[p.dealType] || '',
    price: fmtMoney(f.price), commissionPct: f.mode === 'percent' ? fmtPct(f.pct) : f.basis, feeBasis: f.basis, commission: fmtMoney(f.commission), vatRate: fmtPct(f.vatRate), vat: fmtMoney(f.vat), total: fmtMoney(f.total),
    agentName: a.name, agentLicense: a.license, agentPhone: a.phone, date: todayHe(date), terms: data.terms || '',
  }
  return v
}
const BLANK = '________'
export function fillText(text, values) {
  return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (k in values ? (String(values[k] ?? '').trim() || (k === 'terms' ? '' : BLANK)) : m)).replace(/\s+\./g, '.').replace(/[ \t]{2,}/g, ' ').trim()
}
/** The clauses as they read for a document: [{ n, title, text }] */
export function renderClauses(data = {}, clauses = DEFAULT_CLAUSES, opts = {}) {
  const v = placeholderValues(data, opts)
  return (Array.isArray(clauses) && clauses.length ? clauses : DEFAULT_CLAUSES).map((c, i) => ({ n: c.n || i + 1, title: str(c.title, 80), text: fillText(c.text, v) }))
}
/** A template's clauses, cleaned (the admin's "תבניות" editor saves them) */
export function cleanClauses(list) {
  const out = (Array.isArray(list) ? list : []).map((c, i) => ({ n: i + 1, title: str(c?.title, 80), text: String(c?.text || '').replace(/\r/g, '').trim().slice(0, 3000) })).filter(c => c.text)
  return out.length ? out.slice(0, 20) : DEFAULT_CLAUSES.map(c => ({ ...c }))
}

export const isExpired = (doc, now = Date.now()) => !!doc?.expires_at && Date.parse(doc.expires_at) < now
export const canEdit = doc => ['draft', 'failed'].includes(doc?.status)
export const canSend = doc => ['draft', 'sent', 'opened', 'failed', 'expired'].includes(doc?.status)
export const canCancel = doc => ['draft', 'sent', 'opened', 'failed', 'expired'].includes(doc?.status)
export function canSign(doc, now = Date.now()) {
  if (!doc) return { ok: false, why: 'המסמך לא נמצא' }
  if (doc.status === 'signed') return { ok: false, why: 'המסמך כבר נחתם', signed: true }
  if (doc.status === 'cancelled') return { ok: false, why: 'המסמך בוטל על ידי המשרד' }
  if (!['sent', 'opened'].includes(doc.status)) return { ok: false, why: 'המסמך עדיין לא נשלח לחתימה' }
  if (isExpired(doc, now)) return { ok: false, why: 'תוקף הקישור פג. אפשר לבקש מהמשרד קישור חדש.', expired: true }
  return { ok: true }
}

export const signUrl = token => `${SITE}/sign/${token}`
// the hashes (node's crypto) live in lib/documents-hash.js, so this file also runs in the browser (the wizard's preview)

/** What the public signing page may see: the client's own details in full (it is their document), the OTP destinations masked,
 *  no hashes, no OTP, no internal ids. `template` (lib/doc-templates.js) gives the blocks and the sections; without one the
 *  document is the brokerage order with `clauses`. */
export function publicView(doc, clauses, template = null) {
  const d = doc.data || {}
  const tp = template || null
  return {
    blocks: tp ? renderTemplateBlocks(tp, doc) : renderClauses(d, clauses, { date: doc.created_at ? new Date(doc.created_at) : new Date() }).map(c => ({ t: 'clause', n: c.n, title: c.title, text: c.text })),
    sections: tp ? tp.sections : { parties: true, property: true, fees: true, signatures: true },
    project: doc.project_name || d.projectName || '',
    number: doc.number, status: doc.status, title: d.title || DOC_TYPES.brokerage.name, created_at: doc.created_at, sent_at: doc.sent_at, signed_at: doc.signed_at, expires_at: doc.expires_at,
    client: { name: d.client?.name || '', phone: d.client?.phone || '', email: d.client?.email || '', phoneMasked: maskPhone(d.client?.phone), emailMasked: maskEmail(d.client?.email), idNumber: d.client?.idNumber || '', role: d.client?.role, address: d.client?.address || '' },
    property: d.property || {}, fees: computeFees(d.fees || {}), agent: { name: d.agent?.name || '', license: d.agent?.license || '', phone: d.agent?.phone || '' }, logo: d.logo || {}, terms: d.terms || '',
    clauses: renderClauses(d, clauses, { date: doc.created_at ? new Date(doc.created_at) : new Date() }),
    channels: { whatsapp: !!d.client?.phone, email: !!d.client?.email },
    signature: doc.signature ? { name: doc.signature.name, at: doc.signature.at } : null,
  }
}
// the template renderer lives in lib/doc-templates.js (imported lazily below to keep this module's imports one-way)
let _tpl = null
export function setTemplateRenderer(fn) { _tpl = fn }
function renderTemplateBlocks(tp, doc) { return _tpl ? _tpl(tp, doc) : [] }
export const maskPhone = p => { const d = cleanPhone(p); return d ? `${d.slice(0, 3)}-***-*${d.slice(-3)}` : '' }
export const maskEmail = e => { const s = String(e || ''); const i = s.indexOf('@'); return i > 0 ? `${s.slice(0, Math.min(2, i))}***${s.slice(i)}` : '' }

/** The compact entry kept on the lead (crm_data.documents[]) */
export function leadDocEntry(doc) {
  const d = doc.data || {}, f = computeFees(d.fees || {})
  return { id: doc.id, number: doc.number, type: doc.type || 'brokerage', title: d.title || DOC_TYPES.brokerage.name, status: doc.status, project: doc.project_name || d.projectName || '', property: [d.property?.address, d.property?.city].filter(Boolean).join(', '), pct: f.mode === 'percent' ? f.pct : null, basis: f.basis, total: f.total, created_at: doc.created_at, sent_at: doc.sent_at || null, signed_at: doc.signed_at || null, expires_at: doc.expires_at || null, signed: !!doc.signed_path }
}
export function mergeLeadDocs(list, entry) {
  const arr = Array.isArray(list) ? list.filter(x => x && x.id !== entry.id) : []
  return [entry, ...arr].slice(0, 100)
}

// ── Messages ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const firstName = n => String(n || '').trim().split(/\s+/)[0] || ''
const propLine = d => [d.property?.address, d.property?.city].filter(Boolean).join(', ')
export function clientWaText(doc, link, { personal = '' } = {}) {
  const d = doc.data || {}
  return [`היי ${firstName(d.client?.name)},`, personal.trim() || `בהמשך לשיחתנו, מצורף טופס הזמנת שירותי תיווך של אפיק הנחל${propLine(d) ? ` עבור הנכס ב${propLine(d)}` : ''}.`,
    'אפשר לעיין במסמך ולחתום עליו דיגיטלית בקישור האישי הזה:', link, 'אחרי החתימה נשלח אליכם עותק חתום.', `תוקף הקישור: עד ${todayHe(doc.expires_at)}.`, 'תודה, צוות אפיק הנחל'].join('\n')
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const BRAND = '#3F4EB0', INK = '#17172B', MUTE = '#5E5B6E', LINE = '#E6E1D6', BG = '#F5F1E9'
const FONT = 'font-family:Rubik,Heebo,Arial,sans-serif'
function shell(title, body, foot = COMPANY.name) {
  return `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:${BG};padding:24px 12px;${FONT}"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;border:1px solid ${LINE};border-radius:12px;overflow:hidden"><tr><td style="padding:22px 28px;border-bottom:1px solid ${LINE}"><div style="font-size:13px;color:${MUTE};${FONT}">${esc(COMPANY.short)}</div><div style="font-size:20px;font-weight:700;color:${INK};${FONT}">${esc(title)}</div></td></tr>
<tr><td style="padding:22px 28px;color:${INK};font-size:15px;line-height:1.75;${FONT}">${body}</td></tr><tr><td style="padding:14px 28px;border-top:1px solid ${LINE};color:${MUTE};font-size:12px;${FONT}">${esc(foot)} · ${COMPANY.idLabel} ${COMPANY.id} · ${esc(COMPANY.phone)} · ${esc(COMPANY.email)}</td></tr></table></td></tr></table></body></html>`
}
const btn = (href, label) => `<p style="margin:18px 0"><a href="${esc(href)}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:700;padding:12px 26px;border-radius:999px;text-decoration:none;${FONT}">${esc(label)}</a></p>`
const rows = pairs => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0;border-collapse:collapse">${pairs.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:4px 0 4px 16px;color:${MUTE};font-size:13.5px;white-space:nowrap;${FONT}">${esc(k)}</td><td style="padding:4px 0;font-weight:600;${FONT}">${esc(v)}</td></tr>`).join('')}</table>`

export function clientEmail(doc, link, { personal = '' } = {}) {
  const d = doc.data || {}
  const subject = `טופס הזמנת שירותי תיווך – אפיק הנחל${propLine(d) ? ` · ${propLine(d)}` : ''}`
  const text = [`שלום ${d.client?.name || ''},`, '', personal.trim() || `בהמשך לשיחתנו, מצורף מסמך הזמנת שירותי תיווך${propLine(d) ? ` עבור הנכס בכתובת ${propLine(d)}` : ''}.`, '', 'לצפייה במסמך ולחתימה דיגיטלית:', link, '', `הקישור בתוקף עד ${todayHe(doc.expires_at)}. אחרי החתימה יישלח אליכם עותק מלא של המסמך.`, '', 'בברכה,', COMPANY.name].join('\n')
  const html = shell('טופס הזמנת שירותי תיווך', `<p style="margin:0 0 10px">שלום ${esc(d.client?.name || '')},</p><p style="margin:0 0 10px">${esc(personal.trim() || `בהמשך לשיחתנו, מצורף מסמך הזמנת שירותי תיווך${propLine(d) ? ` עבור הנכס בכתובת ${propLine(d)}` : ''}.`)}</p>${rows([['מספר מסמך', doc.number], ['נכס', propLine(d)], ['בתוקף עד', todayHe(doc.expires_at)]])}${btn(link, 'לצפייה ולחתימה דיגיטלית')}<p style="margin:0;color:${MUTE};font-size:13px">הקישור אישי ומיועד לכם בלבד. אחרי החתימה יישלח אליכם עותק מלא של המסמך.</p>`)
  return { subject, html, text }
}
export function otpText(code) { return `קוד האימות לחתימה על המסמך של אפיק הנחל: ${code}\nהקוד תקף ל-${OTP_MINUTES} דקות. אם לא ביקשתם אותו, אפשר להתעלם מההודעה.` }
export function otpEmail(code) { return { subject: `קוד אימות לחתימה – אפיק הנחל`, text: otpText(code), html: shell('קוד אימות לחתימה', `<p style="margin:0 0 8px">הקוד לחתימה על המסמך:</p><div dir="ltr" style="font-size:30px;font-weight:700;letter-spacing:8px;color:${BRAND};text-align:center;padding:12px;border:1px dashed ${LINE};border-radius:10px">${esc(code)}</div><p style="margin:12px 0 0;color:${MUTE};font-size:13px">תקף ל-${OTP_MINUTES} דקות. אם לא ביקשתם אותו, אפשר להתעלם מההודעה.</p>`) } }

export function officeSignedText(doc, { cardLink = '' } = {}) {
  const d = doc.data || {}, f = computeFees(d.fees || {})
  return ['נחתם מסמך חדש!', '', `לקוח: ${d.client?.name || ''}`, d.client?.phone ? `טלפון: ${d.client.phone}` : '', `נכס: ${propLine(d) || '—'}`, `סוג מסמך: ${d.title || DOC_TYPES.brokerage.name}`, `דמי תיווך: ${f.mode === 'percent' ? fmtPct(f.pct) : f.basis} · ${fmtMoney(f.total)} כולל מע"מ`, `תאריך חתימה: ${whenHe(doc.signed_at || Date.now())}`, `מספר מסמך: ${doc.number}`, '', 'המסמך החתום מצורף לכרטיס הליד במערכת.', cardLink].filter(x => x !== '').join('\n')
}
export function officeSignedEmail(doc, { cardLink = '' } = {}) {
  const d = doc.data || {}, f = computeFees(d.fees || {})
  const subject = `מסמך תיווך נחתם – ${d.client?.name || doc.number}`
  const text = ['שלום,', '', 'התקבלה חתימה דיגיטלית על מסמך הזמנת שירותי תיווך.', '', 'פרטי הלקוח:', d.client?.name || '', d.client?.phone || '', d.client?.email || '', '', 'פרטי הנכס:', propLine(d) || '—', '', `דמי תיווך: ${f.basis} · ${fmtMoney(f.total)} כולל מע"מ`, `מועד חתימה: ${whenHe(doc.signed_at || Date.now())}`, `מספר מסמך: ${doc.number}`, '', 'המסמך החתום מצורף להודעה. ניתן לצפות בו גם בכרטיס הליד במערכת.', cardLink, '', 'בברכה,', 'מערכת אפיק הנחל'].join('\n')
  const html = shell('מסמך תיווך נחתם', `<p style="margin:0 0 10px">התקבלה חתימה דיגיטלית על <b>${esc(d.title || DOC_TYPES.brokerage.name)}</b>.</p>${rows([['לקוח', d.client?.name], ['טלפון', d.client?.phone], ['אימייל', d.client?.email], ['נכס', propLine(d)], ['דמי תיווך', `${f.basis} · ${fmtMoney(f.total)} כולל מע"מ`], ['מועד חתימה', whenHe(doc.signed_at || Date.now())], ['מספר מסמך', doc.number]])}${cardLink ? btn(cardLink, 'לכרטיס הליד במערכת') : ''}<p style="margin:0;color:${MUTE};font-size:13px">המסמך החתום מצורף להודעה.</p>`, 'מערכת אפיק הנחל')
  return { subject, html, text }
}
export function clientSignedEmail(doc) {
  const d = doc.data || {}
  const subject = `העותק החתום שלכם – ${d.title || DOC_TYPES.brokerage.name} · אפיק הנחל`
  const text = [`שלום ${d.client?.name || ''},`, '', 'תודה! המסמך נחתם בהצלחה והעותק החתום מצורף להודעה זו.', `מספר מסמך: ${doc.number}`, `מועד חתימה: ${whenHe(doc.signed_at || Date.now())}`, '', 'לכל שאלה אנחנו כאן.', '', 'בברכה,', COMPANY.name].join('\n')
  const html = shell('המסמך נחתם בהצלחה', `<p style="margin:0 0 10px">שלום ${esc(d.client?.name || '')},</p><p style="margin:0 0 10px">תודה! המסמך נחתם בהצלחה והעותק החתום מצורף להודעה זו.</p>${rows([['מספר מסמך', doc.number], ['נכס', propLine(d)], ['מועד חתימה', whenHe(doc.signed_at || Date.now())]])}<p style="margin:0;color:${MUTE};font-size:13px">לכל שאלה אנחנו כאן: ${esc(COMPANY.phone)}.</p>`)
  return { subject, html, text }
}
export function clientSignedWaText(doc) {
  const d = doc.data || {}
  return [`היי ${firstName(d.client?.name)}, תודה! המסמך נחתם בהצלחה.`, d.client?.email ? `העותק החתום נשלח לאימייל ${d.client.email}.` : 'העותק החתום שמור אצלנו ונשלח לכם לפי בקשה.', `מספר מסמך: ${doc.number}`, 'צוות אפיק הנחל'].join('\n')
}

/** The lead's timeline note for an event */
export function docNoteText(type, doc) {
  const d = doc.data || {}
  const what = `${d.title || DOC_TYPES.brokerage.name} ${doc.number}`
  const m = { created: `📄 נוצר ${what}${propLine(d) ? ` · ${propLine(d)}` : ''}`, sent_whatsapp: `📄 ${what} נשלח לחתימה בוואטסאפ`, sent_email: `📄 ${what} נשלח לחתימה באימייל`, opened: `📄 הלקוח פתח את ${what}`, signed: `✅ הלקוח חתם על ${what}`, cancelled: `📄 ${what} בוטל`, copy_sent: `📄 עותק חתום של ${what} נשלח ללקוח` }
  return m[type] || ''
}

/** Dashboard counts for the tab's tiles */
export function docStats(list = [], now = Date.now()) {
  const s = { total: 0, waiting: 0, signed: 0, problem: 0 }
  for (const d of list) {
    s.total++
    const st = d.status === 'sent' || d.status === 'opened' ? (isExpired(d, now) ? 'expired' : 'waiting') : d.status
    if (st === 'waiting') s.waiting++
    else if (st === 'signed') s.signed++
    else if (['expired', 'failed'].includes(st)) s.problem++
  }
  return s
}
/** The status a row shows (a sent document past its expiry reads "expired" even before the hourly sweep) */
export function effectiveStatus(doc, now = Date.now()) {
  return ['sent', 'opened'].includes(doc?.status) && isExpired(doc, now) ? 'expired' : doc?.status
}
