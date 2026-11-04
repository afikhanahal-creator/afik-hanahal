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
export const SIGNER_ROLES = { client: 'הלקוח', spouse: 'בן/בת זוג', partner: 'שותף/ה', guarantor: 'ערב/ה', other: 'חותם נוסף' }
export const MAX_SIGNERS = 4
export const DEFAULT_REMINDERS = { enabled: true, days: [2, 5], from: 9, to: 20 }   // reminders to a signer who hasn't signed: N days after the link went out, Israel hours
export const DEFAULT_NOTIFY_ON = { opened: true, partial: true, signed: true, expired: true, failed: true, reminder: false }
export const STATUSES = ['draft', 'sent', 'opened', 'signed', 'expired', 'cancelled', 'failed']
export const STATUS_HE = { draft: 'טיוטה', sent: 'ממתין לחתימה', opened: 'נפתח', signed: 'נחתם', expired: 'פג תוקף', cancelled: 'בוטל', failed: 'השליחה נכשלה' }
export const EVENT_HE = {
  created: 'המסמך נוצר', updated: 'המסמך עודכן', sent_whatsapp: 'נשלח בוואטסאפ', sent_email: 'נשלח באימייל', send_failed: 'השליחה נכשלה',
  opened: 'הלקוח פתח את המסמך', otp_sent: 'קוד אימות נשלח', otp_failed: 'קוד אימות שגוי', verified: 'החותם אומת', agent_signed: 'חתימת המתווך הוטבעה', signed: 'הלקוח חתם',
  copy_sent: 'עותק חתום נשלח ללקוח', office_notified: 'המשרד עודכן', cancelled: 'המסמך בוטל', expired: 'הקישור פג', resent: 'נשלח שוב',
  link_renewed: 'קישור חדש הופק', downloaded: 'הורדה', reminder_sent: 'תזכורת נשלחה', signer_sent: 'הקישור נשלח לחותם הבא', partial_signed: 'חותם חתם (ממתינים לחותמים נוספים)',
  drive_synced: 'נשמר ב-Google Drive', drive_failed: 'השמירה ב-Google Drive נכשלה',
}
export const DEFAULT_EXPIRY_DAYS = 14
export const OTP_MINUTES = 10
export const OTP_MAX_TRIES = 5
export const TEMPLATE_VERSION = 1

// The eight clauses of the office's brokerage order — the base wording. The office pastes / edits the exact text of its master
// Word file in the admin's "תבניות" area (saved in app_settings.doc_templates); nothing here changes legal terms by itself.
// Placeholders in {curly braces} are filled from the document; a missing value prints as a blank line.
export const DEFAULT_CLAUSES = [
  { n: 1, title: 'הצדדים', text: 'אני/אנו הח"מ, {clientName}[[, ת.ז. {clientId}]][[, מרחוב {clientAddress}]], טלפון {clientPhone} (להלן: "הלקוח"), מזמין/ה בזאת מאת {company}, {companyIdLabel} {companyId} (להלן: "המתווך"), שירותי תיווך במקרקעין כמפורט בטופס זה.' },
  { n: 2, title: 'הנכס', text: 'הנכס נשוא ההזמנה: {propertyDesc}, בכתובת {propertyAddress}, {propertyCity} (להלן: "הנכס"). סוג העסקה המבוקשת: {dealType}. הלקוח פועל בעסקה כ{clientRole}.' },
  { n: 3, title: 'הצהרת הלקוח', text: 'הלקוח מצהיר כי המתווך הוא שהציג בפניו את הנכס ו/או את הצד השני לעסקה, וכי לא ידע על הנכס קודם לכן מגורם אחר, אלא אם צוין אחרת בכתב בטופס זה.' },
  { n: 4, title: 'בלעדיות', text: 'ככל שסוכם על בלעדיות, היא תחול לתקופה ובתנאים שייקבעו בנספח נפרד בהתאם לחוק המתווכים במקרקעין, התשנ"ו-1996 ותקנותיו. בהיעדר נספח כאמור, ההזמנה אינה בלעדית.' },
  { n: 5, title: 'הגורם היעיל', text: 'הלקוח מתחייב לשלם למתווך דמי תיווך אם המתווך היה הגורם היעיל שהביא להתקשרות הצדדים בהסכם מחייב ביחס לנכס, לרבות אם ההסכם נחתם לאחר תום תקופת ההזמנה, ובלבד שהמתווך הציג את הנכס ללקוח במהלכה.' },
  { n: 6, title: 'דמי התיווך', text: 'בגין שירותי התיווך ישלם הלקוח למתווך דמי תיווך של {feeBasis}, בסך {commission} לפני מע"מ.\nלסכום זה יתווסף מע"מ כדין בשיעור {vatRate}, בסך {vat}.\nסך הכל לתשלום: {total} כולל מע"מ.\nמחיר העסקה לצורך החישוב: {price} לפני מע"מ. {terms}' },
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
/**
 * The client's details the regulations require before the office sends the form (תקנות המתווכים במקרקעין (פרטי הזמנה בכתב),
 * תשנ"ז-1997): the ID number (with its checksum) and the home address. `fillAtSign` = the office leaves them to the client, who
 * is asked for them on the signing page before signing. A typed ID that fails the checksum is always an error.
 * → { ok, missing: ['id' | 'address'], errors: [text], idValid: true | false | null }
 */
export function clientLegalIssues(client = {}, { fillAtSign = false } = {}) {
  const id = String(client?.idNumber || '').replace(/\D/g, ''), addr = String(client?.address || '').trim()
  const missing = [], errors = []
  if (!id) missing.push('id')
  if (addr.length < 4) missing.push('address')
  const idValid = id ? validIsraeliId(id) && id.length >= 8 : null
  if (id && !idValid) errors.push('מספר תעודת הזהות של הלקוח לא תקין — בדקו את הספרות (9 ספרות, כולל ספרת ביקורת)')
  if (!fillAtSign && missing.length) errors.push(`חסר ${missing.map(m => (m === 'id' ? 'מספר ת.ז.' : 'כתובת מגורים')).join(' ו')} של הלקוח — חובה לפי תקנות המתווכים. מלאו, או סמנו "הלקוח ישלים בזמן החתימה".`)
  return { ok: !errors.length, missing, errors, idValid }
}
/** 0501234567 → 050-123-4567 (any other shape as typed) */
export const fmtPhone = p => { const d = cleanPhone(p); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}` : String(p || '') }
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
  // more signers, in order after the client (a spouse, a partner, a guarantor): each gets the link once the one before signed
  const signers = (Array.isArray(b.signers) ? b.signers : []).slice(0, MAX_SIGNERS - 1)
    .map(x => ({ name: str(x?.name, 120), idNumber: String(x?.idNumber || '').replace(/\D/g, '').slice(0, 9), phone: cleanPhone(x?.phone), email: str(x?.email, 120).toLowerCase(), role: SIGNER_ROLES[x?.role] && x.role !== 'client' ? x.role : 'other' }))
    .filter(x => x.name || x.phone || x.email)
  signers.forEach((x, i) => {
    if (!x.name) errors.push(`שם החותם הנוסף ${i + 1} חסר`)
    if (!x.phone && !x.email) errors.push(`לחותם הנוסף ${x.name || i + 1} צריך טלפון או אימייל`)
    if (x.phone && !validPhone(x.phone)) errors.push(`מספר הטלפון של ${x.name || 'החותם הנוסף'} לא תקין`)
    if (!validEmail(x.email)) errors.push(`כתובת האימייל של ${x.name || 'החותם הנוסף'} לא תקינה`)
    if (x.idNumber && !validIsraeliId(x.idNumber)) errors.push(`מספר תעודת הזהות של ${x.name || 'החותם הנוסף'} לא תקין`)
  })
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
  return { data: { client, property, fees, agent, logo, terms, expiryDays, title, fields, projectName, signers }, errors }
}

/** The values the placeholders stand for, from a document's data (missing → a blank line) */
export function placeholderValues(data = {}, { date = new Date() } = {}) {
  const f = computeFees(data.fees || {})
  const c = data.client || {}, p = data.property || {}, a = data.agent || {}
  const v = {
    company: COMPANY.name, companyIdLabel: COMPANY.idLabel, companyId: COMPANY.id,
    clientName: c.name, clientId: c.idNumber, clientPhone: fmtPhone(c.phone), clientEmail: c.email, clientAddress: c.address, clientRole: CLIENT_ROLES[c.role] || '',
    propertyAddress: p.address, propertyCity: p.city, propertyDesc: p.desc || p.type || 'הנכס', propertyType: p.type, dealType: DEAL_TYPES[p.dealType] || '',
    price: fmtMoney(f.price), commissionPct: f.mode === 'percent' ? fmtPct(f.pct) : f.basis, feeBasis: f.basis, commission: fmtMoney(f.commission), vatRate: fmtPct(f.vatRate), vat: fmtMoney(f.vat), total: fmtMoney(f.total),
    agentName: a.name, agentLicense: a.license, agentPhone: fmtPhone(a.phone), date: todayHe(date), terms: data.terms || '',
  }
  return v
}
const BLANK = '________'
/** {key} → its value (a blank line when unknown); a [[ … ]] part is kept only when every placeholder in it is known, so a
 *  clause reads whole without the value instead of "ת.ז. ________" (the client fills the ID / address when signing) */
export function fillText(text, values) {
  const val = k => (k in values ? String(values[k] ?? '').trim() : null)
  let s = String(text || '').replace(/\[\[([\s\S]*?)\]\]/g, (m, inner) => { const keys = [...inner.matchAll(/\{(\w+)\}/g)].map(x => x[1]); return keys.length && keys.every(k => val(k)) ? inner : '' })
  s = s.replace(/\{(\w+)\}/g, (m, k) => (k in values ? (val(k) || (k === 'terms' ? '' : BLANK)) : m))
  return s.replace(/\s+\./g, '.').replace(/\s+,/g, ',').replace(/[ \t]{2,}/g, ' ').trim()
}
/** a clause the office wrote without the brackets still reads whole: ", ת.ז. {clientId}" / ", מרחוב {clientAddress}" become optional */
export function optionalParts(text) {
  let s = String(text || '')
  if (!/\[\[[^\]]*\{clientId\}/.test(s)) s = s.replace(/,\s*ת\.?ז\.?\s*\{clientId\}/g, '[[, ת.ז. {clientId}]]')
  if (!/\[\[[^\]]*\{clientAddress\}/.test(s)) s = s.replace(/,\s*(?:מרחוב|מכתובת|כתובת)\s+\{clientAddress\}/g, '[[, מרחוב {clientAddress}]]')
  return s
}
/** The clauses as they read for a document: [{ n, title, text }] */
export function renderClauses(data = {}, clauses = DEFAULT_CLAUSES, opts = {}) {
  const v = placeholderValues(data, opts)
  return (Array.isArray(clauses) && clauses.length ? clauses : DEFAULT_CLAUSES).map((c, i) => ({ n: c.n || i + 1, title: str(c.title, 80), text: fillText(optionalParts(c.text), v) }))
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

export const signUrl = token => `${SITE}/s/${token}`
/** the code in a signing address: /s/<code> (short, lowercase) or the older /sign/<token> */
export function signTokenFromPath(path = '') {
  const m = /^\/(?:s|sign)\/([A-Za-z0-9_-]{8,64})\/?$/.exec(String(path))
  if (!m) return ''
  return m[1].length <= 16 ? m[1].toLowerCase() : m[1]
}
// the hashes (node's crypto) live in lib/documents-hash.js, so this file also runs in the browser (the wizard's preview)

/** What the public signing page may see: the client's own details in full (it is their document), the OTP destinations masked,
 *  no hashes, no OTP, no internal ids. `template` (lib/doc-templates.js) gives the blocks and the sections; without one the
 *  document is the brokerage order with `clauses`. */
export function publicView(doc, clauses, template = null) {
  const d = doc.data || {}
  const tp = template || null
  const cur = currentSigner(doc)   // the OTP goes to whoever signs now (the client, or the next signer)
  return {
    blocks: tp ? renderTemplateBlocks(tp, doc) : renderClauses(d, clauses, { date: doc.created_at ? new Date(doc.created_at) : new Date() }).map(c => ({ t: 'clause', n: c.n, title: c.title, text: c.text })),
    sections: tp ? tp.sections : { parties: true, property: true, fees: true, signatures: true },
    project: doc.project_name || d.projectName || '',
    number: doc.number, status: doc.status, title: d.title || DOC_TYPES.brokerage.name, created_at: doc.created_at, sent_at: doc.sent_at, signed_at: doc.signed_at, expires_at: doc.expires_at,
    client: { name: d.client?.name || '', phone: d.client?.phone || '', email: d.client?.email || '', phoneMasked: maskPhone(cur?.phone), emailMasked: maskEmail(cur?.email), idNumber: d.client?.idNumber || '', role: d.client?.role, address: d.client?.address || '' },
    property: d.property || {}, fees: computeFees(d.fees || {}), agent: { name: d.agent?.name || '', license: d.agent?.license || '', phone: d.agent?.phone || '' }, logo: d.logo || {}, terms: d.terms || '',
    clauses: renderClauses(d, clauses, { date: doc.created_at ? new Date(doc.created_at) : new Date() }),
    channels: { whatsapp: !!cur?.phone, email: !!cur?.email },
    signature: doc.signature ? { name: doc.signature.name, at: doc.signature.at } : null,
    agentSigned: d.agentSignature?.at ? { name: d.agentSignature.name, at: d.agentSignature.at } : null,
    signer: signerInfo(doc),
  }
}
/** who signs now and where the document stands: { index, total, name, role, list: [{ name, role, status, signed_at }] } */
export function signerInfo(doc) {
  const sg = doc?.data?.signing
  const list = sg?.list?.length ? sg.list : signerList(doc?.data || {}).map(s => ({ ...s, status: doc?.status === 'signed' ? 'signed' : 'waiting' }))
  const cur = sg?.list?.length ? Math.min(sg.current ?? 0, list.length - 1) : 0
  return { index: cur, total: list.length, name: list[cur]?.name || '', role: list[cur]?.role || 'client', list: list.map(s => ({ name: s.name, role: s.role, status: s.status, signed_at: s.signed_at || s.signature?.at || null })) }
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
  return { id: doc.id, number: doc.number, type: doc.type || 'brokerage', title: d.title || DOC_TYPES.brokerage.name, status: doc.status, signers: signerProgressText(doc) || undefined, drive: doc.data?.drive?.status === 'synced' ? true : undefined, project: doc.project_name || d.projectName || '', property: [d.property?.address, d.property?.city].filter(Boolean).join(', '), pct: f.mode === 'percent' ? f.pct : null, basis: f.basis, total: f.total, created_at: doc.created_at, sent_at: doc.sent_at || null, signed_at: doc.signed_at || null, expires_at: doc.expires_at || null, signed: !!doc.signed_path }
}
/** "1/2" for a document with several signers (empty for one) */
export function signerProgressText(doc) { const p = signerProgress(doc); return p.total > 1 ? `${p.done}/${p.total}` : '' }
export function mergeLeadDocs(list, entry) {
  const arr = Array.isArray(list) ? list.filter(x => x && x.id !== entry.id) : []
  return [entry, ...arr].slice(0, 100)
}

// ── Messages ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const firstName = n => String(n || '').trim().split(/\s+/)[0] || ''
const propLine = d => [d.property?.address, d.property?.city].filter(Boolean).join(', ')
const docTitle = d => d.title || DOC_TYPES.brokerage.name
/** the words of a document's deal for a message: "הנכס ברחוב …" / "הדירה …" */
const propRef = d => (propLine(d) ? `הנכס ב${propLine(d)}` : 'הנכס')

/**
 * The wordings the office sends with the signing link — half friendly, half formal, written by the office in the plural
 * ("אנחנו", "אתכם"), to the client's first name only, never with the document's number. `body` is the message's own lines
 * with placeholders ({first} the first name · {prop} "הנכס ב<address>" · {address} the address alone · {title} the document's
 * name · {expires} the link's last day); the frame (greeting, the link line, validity, the sign-off) is shared by
 * `signMessageLines`. The office edits any of them and adds its own in the templates area (`settings.signMessages`, merged by
 * `signMessageList`); `suggestSignMessage()` picks the fitting one for a document.
 */
export const WORDING_GROUPS = { buy: 'קונים', rent: 'שוכרים ומשכירים', sell: 'מוכרים', general: 'כללי' }
export const WORDING_VARS = { first: 'השם הפרטי', prop: 'הנכס ב<כתובת>', address: 'הכתובת', title: 'שם המסמך', expires: 'תוקף הקישור' }
export const SIGN_MESSAGES = [
  // ── general
  { id: 'after_call', group: 'general', title: 'אחרי שיחת טלפון', hint: 'הנוסח הרגיל: בהמשך לשיחה, הטופס מצורף',
    body: 'תודה על השיחה. כפי שדיברנו, כדי שנוכל להתחיל לעבוד עבורכם על {prop}, מצורף {title} לחתימה.\nהחתימה דיגיטלית ולוקחת כדקה, ומיד אחריה תקבלו עותק חתום.' },
  { id: 'after_meeting', group: 'general', title: 'אחרי פגישה או סיור', hint: 'נעים היה להיפגש, ממשיכים לשלב הבא',
    body: 'היה נעים להיפגש. כדי שנוכל להמשיך לייצג אתכם ב{prop}, מצורף {title} לחתימה דיגיטלית.\nזה לוקח כדקה, ועותק חתום יישלח אליכם מיד לאחר מכן.' },
  { id: 'ready', group: 'general', title: 'הטופס מוכן, כפי שביקשתם', hint: 'הלקוח ביקש לקבל את הטופס',
    body: 'כפי שביקשתם, הכנו את {title} עבור {prop}. אפשר לעיין בו ולחתום דיגיטלית בנחת.\nאחרי החתימה תקבלו עותק חתום, ואנחנו ממשיכים משם.' },
  { id: 'formal', group: 'general', title: 'רשמי וקצר', hint: 'בהתאם לחוק המתווכים',
    body: 'בהתאם לחוק המתווכים במקרקעין, לפני תחילת העבודה המשותפת נדרש {title} חתום. המסמך עבור {prop} מצורף לחתימה דיגיטלית.' },
  { id: 'warm', group: 'general', title: 'חם וקצר', hint: 'משפט אחד, ידידותי',
    body: 'שמחים להתחיל לעבוד איתכם על {prop}. נשאר רק לחתום על {title}, זה לוקח כדקה.' },
  { id: 'resend', group: 'general', title: 'שליחה חוזרת של הקישור', hint: 'הקישור שוב, בלי לחץ',
    body: 'בהמשך להודעה הקודמת, הנה שוב הקישור ל{title} עבור {prop}, למקרה שההודעה התפספסה.\nהחתימה לוקחת כדקה, ואם משהו לא ברור אפשר לענות כאן.' },
  { id: 'renew', group: 'general', title: 'קישור חדש אחרי שפג התוקף', hint: 'הקישור הקודם פג, שום דבר לא השתנה',
    body: 'הקישור הקודם ל{title} עבור {prop} פג תוקפו, אז הנה קישור חדש. התנאים לא השתנו.\nהחתימה לוקחת כדקה, ואחריה תקבלו עותק חתום.' },
  // ── buyers
  { id: 'buyer_pre_viewing', group: 'buy', title: 'קונים: לפני סיור בנכס', hint: 'הנוהל לפי חוק המתווכים לפני שמציגים נכס',
    body: 'לקראת הסיור ב{address}, מצורף {title} לחתימה דיגיטלית. לפי חוק המתווכים הטופס נחתם לפני שמציגים נכס, והוא מסדיר דמי תיווך רק אם תרכשו נכס שהצגנו לכם.\nזה לוקח כדקה, ונתראה בסיור.' },
  { id: 'before_viewing', group: 'buy', title: 'לפני סיור: קצר', hint: 'שתי שורות, לקונים או לשוכרים',
    body: 'לפני שנצא לראות את {prop}, נבקש לחתום על {title}. זה הנוהל המקובל לפי חוק המתווכים, והוא מגן על שני הצדדים.\nהחתימה דיגיטלית ולוקחת כדקה.' },
  { id: 'buyer_liked', group: 'buy', title: 'קונים שהתחברו לנכס', hint: 'הנכס מצא חן, מתקדמים לייצוג',
    body: 'שמחנו לשמוע ש{prop} דיבר אליכם. כדי שנוכל לייצג אתכם מול הצד השני ולהתקדם, מצורף {title} לחתימה.\nהחתימה דיגיטלית, ועותק חתום יישלח אליכם מיד.' },
  { id: 'buyer_pre_offer', group: 'buy', title: 'קונים: לפני הצעת מחיר', hint: 'מעבירים הצעה ומנהלים משא ומתן',
    body: 'שמחים לשמוע שאתם שוקלים להתקדם עם {prop}. כדי שנוכל להעביר הצעת מחיר ולנהל עבורכם את המשא ומתן מול המוכרים, נדרש {title} חתום.\nזה לוקח כדקה, ועותק חתום יישלח אליכם מיד.' },
  { id: 'investor_tour', group: 'buy', title: 'משקיעים: לפני סיור', hint: 'נתוני תשואה אחרי החתימה',
    body: 'לפני שנצא לסיור ב{address}, מצורף {title} לחתימה דיגיטלית. הטופס מתייחס רק לנכסים שנציג לכם ואינו מחייב רכישה.\nאחרי החתימה נעביר לכם את נתוני התשואה והמחירים המלאים.' },
  { id: 'investor', group: 'buy', title: 'משקיעים: ייצוג ברכישה', hint: 'השקעה, מספרים, מקצועי',
    body: 'כדי שנוכל לייצג אתכם ברכישת {prop} ולהתקדם מול הצד השני, מצורף {title} לחתימה דיגיטלית.\nהתנאים המוסכמים מופיעים במסמך. אחרי החתימה תקבלו עותק חתום.' },
  { id: 'developer_project', group: 'buy', title: 'דירה מקבלן / פרויקט חדש', hint: 'ייצוג מול היזם ושריון הדירה',
    body: 'בהמשך להתעניינות שלכם בפרויקט ב{address}, מצורף {title} לחתימה דיגיטלית. הוא מאפשר לנו לייצג אתכם מול היזם ולשריין עבורכם את הדירה שבחרתם.\nזה לוקח כדקה, ועותק חתום יישלח אליכם מיד.' },
  // ── renters and landlords
  { id: 'renter_pre_viewing', group: 'rent', title: 'שוכרים: לפני סיור בדירה', hint: 'הנוהל לפני שמציגים דירה להשכרה',
    body: 'לקראת הסיור בדירה ב{address}, מצורף {title} לחתימה דיגיטלית. זה הנוהל לפי חוק המתווכים לפני שמציגים דירה, ודמי התיווך חלים רק אם תשכרו דירה שהצגנו לכם.\nלוקח כדקה, ונתראה בדירה.' },
  { id: 'renter_pre_lease', group: 'rent', title: 'שוכרים: לפני חתימת חוזה', hint: 'הדירה מתאימה, מתקדמים לחוזה מול הבעלים',
    body: 'שמחים שהדירה ב{address} מתאימה לכם. לפני שנתאם את חתימת חוזה השכירות מול בעלי הדירה, מצורף {title} לחתימה דיגיטלית.\nאחרי החתימה נשלח עותק חתום ונתקדם לחוזה.' },
  { id: 'rent', group: 'rent', title: 'שכירות: כללי', hint: 'שוכרים או משכירים, בהמשך לשיחה',
    body: 'בהמשך לשיחתנו על {prop} לשכירות, מצורף {title} לחתימה דיגיטלית.\nזה לוקח כדקה, ומיד אחרי החתימה תקבלו עותק חתום.' },
  { id: 'landlord', group: 'rent', title: 'משכירים: בעלי דירה', hint: 'מתחילים לפרסם ולהציג את הדירה',
    body: 'תודה שבחרתם בנו להשכרת הדירה ב{address}. כדי שנוכל לפרסם אותה ולהציג אותה לשוכרים מתאימים, מצורף {title} לחתימה דיגיטלית.\nאחרי החתימה נתאם צילום ונתחיל בשיווק.' },
  // ── sellers
  { id: 'seller', group: 'sell', title: 'בעלי נכס למכירה', hint: 'מתחילים לשווק את הנכס שלכם',
    body: 'תודה שבחרתם בנו לשיווק {prop}. כדי שנוכל להתחיל לפעול עבורכם, מצורף {title} לחתימה דיגיטלית.\nאחרי החתימה נתאם את צילום הנכס ופרסומו, ועותק חתום יישלח אליכם מיד.' },
  { id: 'seller_exclusive', group: 'sell', title: 'מוכרים: בלעדיות', hint: 'תנאי הבלעדיות שסוכמו, יוצאים לדרך',
    body: 'תודה על האמון בשיווק {prop} בבלעדיות. מצורף {title} עם תנאי הבלעדיות שסיכמנו, לחתימה דיגיטלית.\nעם החתימה נצא לדרך: צילום מקצועי, פרסום ותיאום סיורים.' },
]
export const SIGN_MESSAGE_IDS = SIGN_MESSAGES.map(m => m.id)
export const LINK_TOKEN = '{link}'
const WORDING_ID = /^[a-z][a-z0-9_]{1,40}$/
/** The office's edits of the library: `settings.signMessages = { [id]: { title, hint, body, group } | null }` — an entry on a
 *  built-in id overrides it, a `w_…` id is the office's own wording, `null` restores a built-in / removes an own one. */
export function cleanSignMessages(cur = {}, patch = {}) {
  const out = { ...(cur && typeof cur === 'object' ? cur : {}) }
  for (const [id, v] of Object.entries(patch || {})) {
    if (!WORDING_ID.test(id)) continue
    if (v == null) { delete out[id]; continue }
    const body = String(v.body || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).join('\n').slice(0, 1200)
    if (!body) continue
    out[id] = { title: String(v.title || '').trim().slice(0, 60) || 'נוסח', hint: String(v.hint || '').trim().slice(0, 120), body, group: WORDING_GROUPS[v.group] ? v.group : 'general', updatedAt: new Date().toISOString() }
  }
  return out
}
/** the library as the office sees it: the built-ins (edited where the office edited them) + its own wordings */
export function signMessageList(settings = null) {
  const ov = settings?.signMessages && typeof settings.signMessages === 'object' ? settings.signMessages : {}
  const list = SIGN_MESSAGES.map(m => ov[m.id] ? { ...m, ...ov[m.id], edited: true } : m)
  for (const [id, v] of Object.entries(ov)) if (!SIGN_MESSAGE_IDS.includes(id) && v) list.push({ id, ...v, custom: true })
  return list
}
export const signMessage = (id, settings = null) => { const list = signMessageList(settings); return list.find(m => m.id === id) || list[0] }
/** the facts a wording needs, from the document (or the wizard's form shaped like one) */
export function signMessageCtx(doc) {
  const d = doc?.data || {}
  const first = firstName(d.client?.name) || firstName(d.client?.firstName)
  return { first, name: d.client?.name || '', prop: propRef(d), address: propLine(d) || 'הנכס', propLine: propLine(d), title: docTitle(d), dealType: d.property?.dealType || 'sale', role: d.client?.role || 'buyer', expires: todayHe(doc?.expires_at || Date.now()) }
}
/** a wording's body for one document: the placeholders filled, one array item per line */
export function renderWording(body, c) {
  const vals = { first: c.first, prop: c.prop, address: c.address, title: c.title, expires: c.expires }
  return String(body || '').split('\n').map(l => l.replace(/\{(first|prop|address|title|expires)\}/g, (_, k) => vals[k] ?? '').replace(/\s{2,}/g, ' ').trim()).filter(Boolean)
}
/**
 * The lines of the message to the client: greeting · the wording's body · the link (the literal `{link}`, filled by the
 * sender) · validity + "answer here" · the sign-off. `text` = the office's edited text (used as is, `{link}` added if it was
 * removed); `personal` = the old free line (replaces the body); `messageId` = a wording from the library (`settings` brings the
 * office's edits).
 */
export function signMessageLines(doc, { messageId = '', text = '', personal = '' } = {}, settings = null) {
  const c = signMessageCtx(doc)
  if (String(text || '').trim()) {
    const lines = String(text).replace(/\r/g, '').split('\n')
    if (!lines.some(l => l.includes(LINK_TOKEN))) lines.push(LINK_TOKEN)
    return { id: 'custom', title: 'נוסח חופשי', lines }
  }
  const m = signMessage(messageId, settings)
  const body = String(personal || '').trim() ? [String(personal).trim()] : renderWording(m.body, c)
  const greeting = c.first ? `היי ${c.first},` : 'שלום,'
  return { id: personal ? 'personal' : m.id, title: personal ? 'משפט אישי' : m.title, lines: [greeting, ...body, 'הקישור האישי לצפייה ולחתימה:', LINK_TOKEN, `הקישור בתוקף עד ${c.expires}. בכל שאלה אפשר לענות כאן ונשמח לעזור.`, 'צוות אפיק הנחל'] }
}
/** the WhatsApp text (the link in place of `{link}`) */
export function clientWaText(doc, link, opts = {}, settings = null) {
  return signMessageLines(doc, opts, settings).lines.map(l => l.split(LINK_TOKEN).join(link)).join('\n')
}
/** the rendered text for the office to edit before sending — `{link}` stays a token */
export function signMessagePreview(doc, opts = {}, settings = null) { return signMessageLines(doc, opts, settings).lines.join('\n') }
/**
 * Which wording fits this document now: a rental → the renter's / landlord's; a seller → "בעלי נכס"; a lead who met us
 * (stage meeting) → "אחרי פגישה"; a negotiating lead → "לפני הצעת מחיר"; a new buyer lead → before the viewing; else "אחרי
 * שיחת טלפון". `resend` for a document that was already sent.
 */
export function suggestSignMessage(doc, { lead = null, resend = false } = {}) {
  if (resend) return 'resend'
  const d = doc?.data || doc || {}
  const role = d.client?.role, deal = d.property?.dealType
  if (role === 'seller') return 'seller'
  if (role === 'landlord') return 'landlord'
  if (deal === 'rent' || role === 'renter') return 'renter_pre_viewing'
  const stage = lead?.crm_data?.leadStatus || lead?.leadStatus || ''
  if (stage === 'meeting') return 'after_meeting'
  if (stage === 'negotiating') return 'buyer_pre_offer'
  if (/משקיע|השקעה|invest/i.test(`${lead?.crm_data?.purpose || ''} ${lead?.crm_data?.dealType || ''} ${lead?.message || ''}`)) return 'investor_tour'
  if (stage === 'new' || stage === 'contacted') return 'buyer_pre_viewing'
  return 'after_call'
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const BRAND = '#3F4EB0', INK = '#17172B', MUTE = '#5E5B6E', LINE = '#E6E1D6', BG = '#F5F1E9'
const FONT = 'font-family:Rubik,Heebo,Arial,sans-serif'
// Every element of the mail is written right-to-left on its own (dir + text-align on each cell — Gmail and Outlook drop <body>
// styles and reset direction per block), LTR values (phones, numbers, emails) sit inside a dir="ltr" span so their order holds,
// the heading is a centred letterhead, and the colours are pinned to the light scheme (Gmail's dark mode inverted them).
const R = `dir="rtl" align="right" style="text-align:right;direction:rtl`   // the style attribute stays open: callers add their own declarations and close it
const ltr = v => `<span dir="ltr" style="unicode-bidi:embed;direction:ltr;white-space:nowrap">${esc(v)}</span>`
const isLtrValue = v => /^[\d+().\s\-–₪$€%A-Za-z@_.,:/]+$/.test(String(v || '').trim()) && /[\dA-Za-z]/.test(String(v || ''))
function shell(title, body, foot = COMPANY.name) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(title)}</title>
<style>:root{color-scheme:light}body{margin:0;background:${BG}}@media only screen and (max-width:620px){.ah-wrap{padding:10px 8px!important}.ah-card{border-radius:14px!important}.ah-pad{padding:18px 16px!important}.ah-ttl{font-size:21px!important}.ah-lbl{width:92px!important}}</style></head>
<body dir="rtl" style="margin:0;padding:0;background:${BG};${FONT}"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" dir="rtl" style="background:${BG}"><tr><td class="ah-wrap" align="center" style="padding:24px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="ah-card" dir="rtl" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden">
<tr><td class="ah-pad" align="center" dir="rtl" style="padding:26px 28px 20px;border-bottom:1px solid ${LINE};text-align:center;direction:rtl"><div style="font-size:12.5px;letter-spacing:.04em;color:${MUTE};${FONT}">${esc(COMPANY.short)}</div><div class="ah-ttl" style="font-size:22px;font-weight:700;color:${INK};line-height:1.3;margin-top:4px;${FONT}">${esc(title)}</div><div style="width:44px;height:3px;background:${BRAND};border-radius:2px;margin:12px auto 0;font-size:0;line-height:0">&nbsp;</div></td></tr>
<tr><td class="ah-pad" ${R};color:${INK};font-size:15px;line-height:1.75;padding:22px 28px;${FONT}">${body}</td></tr>
<tr><td class="ah-pad" ${R};padding:14px 28px;border-top:1px solid ${LINE};color:${MUTE};font-size:12px;line-height:1.7;${FONT}"><div style="font-weight:600;color:${INK}">${esc(foot)}</div><div>${COMPANY.idLabel} ${ltr(COMPANY.id)} · ${ltr(COMPANY.phone)} · ${ltr(COMPANY.email)}</div></td></tr>
</table></td></tr></table></body></html>`
}
const btn = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="margin:18px auto"><tr><td align="center" style="background:${BRAND};border-radius:999px"><a href="${esc(href)}" style="display:inline-block;color:#ffffff;font-weight:700;font-size:15px;padding:13px 28px;border-radius:999px;text-decoration:none;${FONT}">${esc(label)}</a></td></tr></table>`
const rows = pairs => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" dir="rtl" style="margin:12px 0;border-collapse:collapse;direction:rtl">${pairs.filter(([, v]) => v).map(([k, v]) => `<tr><td class="ah-lbl" ${R};width:118px;padding:7px 0 7px 14px;color:${MUTE};font-size:13.5px;vertical-align:top;border-bottom:1px solid ${LINE};${FONT}">${esc(k)}</td><td ${R};padding:7px 0;font-weight:600;color:${INK};font-size:14.5px;vertical-align:top;border-bottom:1px solid ${LINE};${FONT}">${isLtrValue(v) ? ltr(v) : esc(v)}</td></tr>`).join('')}</table>`

export function clientEmail(doc, link, opts = {}, settings = null) {
  const d = doc.data || {}
  const { lines } = signMessageLines(doc, opts, settings)
  const subject = `${docTitle(d)} לחתימה – אפיק הנחל${propLine(d) ? ` · ${propLine(d)}` : ''}`
  const text = lines.map(l => l.split(LINK_TOKEN).join(link)).join('\n')
  const paras = lines.filter(l => l !== LINK_TOKEN && l !== 'הקישור האישי לצפייה ולחתימה:')
  const body = paras.slice(0, -1)   // the sign-off is the mail's footer
  const html = shell(docTitle(d), `${body.map(l => `<p dir="rtl" style="margin:0 0 10px;text-align:right;direction:rtl">${esc(l)}</p>`).join('')}${rows([['נכס', propLine(d)], ['בתוקף עד', todayHe(doc.expires_at)]])}${btn(link, 'לצפייה ולחתימה דיגיטלית')}<p dir="rtl" style="margin:0;text-align:right;direction:rtl;color:${MUTE};font-size:13px">הקישור אישי ומיועד לכם בלבד. אחרי החתימה יישלח אליכם עותק מלא של המסמך.</p>`)
  return { subject, html, text }
}
export function otpText(code) { return `קוד האימות לחתימה על המסמך של אפיק הנחל: ${code}\nהקוד תקף ל-${OTP_MINUTES} דקות. אם לא ביקשתם אותו, אפשר להתעלם מההודעה.` }
export function otpEmail(code) { return { subject: `קוד אימות לחתימה – אפיק הנחל`, text: otpText(code), html: shell('קוד אימות לחתימה', `<p dir="rtl" style="margin:0 0 8px;text-align:right;direction:rtl">הקוד לחתימה על המסמך:</p><div dir="ltr" style="font-size:30px;font-weight:700;letter-spacing:8px;color:${BRAND};text-align:center;padding:12px;border:1px dashed ${LINE};border-radius:10px">${esc(code)}</div><p dir="rtl" style="margin:12px 0 0;text-align:right;direction:rtl;color:${MUTE};font-size:13px">תקף ל-${OTP_MINUTES} דקות. אם לא ביקשתם אותו, אפשר להתעלם מההודעה.</p>`) } }

export function officeSignedText(doc, { cardLink = '' } = {}) {
  const d = doc.data || {}, f = computeFees(d.fees || {})
  return ['נחתם מסמך חדש!', '', `לקוח: ${d.client?.name || ''}`, d.client?.phone ? `טלפון: ${d.client.phone}` : '', `נכס: ${propLine(d) || '—'}`, `סוג מסמך: ${d.title || DOC_TYPES.brokerage.name}`, `דמי תיווך: ${f.mode === 'percent' ? fmtPct(f.pct) : f.basis} · ${fmtMoney(f.total)} כולל מע"מ`, `תאריך חתימה: ${whenHe(doc.signed_at || Date.now())}`, `מספר מסמך: ${doc.number}`, '', 'המסמך החתום מצורף לכרטיס הליד במערכת.', cardLink].filter(x => x !== '').join('\n')
}
export function officeSignedEmail(doc, { cardLink = '' } = {}) {
  const d = doc.data || {}, f = computeFees(d.fees || {})
  const subject = `מסמך תיווך נחתם – ${d.client?.name || doc.number}`
  const text = ['שלום,', '', 'התקבלה חתימה דיגיטלית על מסמך הזמנת שירותי תיווך.', '', 'פרטי הלקוח:', d.client?.name || '', d.client?.phone || '', d.client?.email || '', '', 'פרטי הנכס:', propLine(d) || '—', '', `דמי תיווך: ${f.basis} · ${fmtMoney(f.total)} כולל מע"מ`, `מועד חתימה: ${whenHe(doc.signed_at || Date.now())}`, `מספר מסמך: ${doc.number}`, '', 'המסמך החתום מצורף להודעה. ניתן לצפות בו גם בכרטיס הליד במערכת.', cardLink, '', 'בברכה,', 'מערכת אפיק הנחל'].join('\n')
  const html = shell('מסמך תיווך נחתם', `<p dir="rtl" style="margin:0 0 10px;text-align:right;direction:rtl">התקבלה חתימה דיגיטלית על <b>${esc(d.title || DOC_TYPES.brokerage.name)}</b>.</p>${rows([['לקוח', d.client?.name], ['טלפון', fmtPhone(d.client?.phone)], ['אימייל', d.client?.email], ['נכס', propLine(d)], ['דמי תיווך', `${fmtMoney(f.total)} כולל מע"מ (${f.basis})`], ['מועד חתימה', whenHe(doc.signed_at || Date.now())], ['מספר מסמך', doc.number]])}${cardLink ? btn(cardLink, 'לכרטיס הליד במערכת') : ''}<p dir="rtl" style="margin:0;text-align:right;direction:rtl;color:${MUTE};font-size:13px">המסמך החתום מצורף להודעה.</p>`, 'מערכת אפיק הנחל')
  return { subject, html, text }
}
export function clientSignedEmail(doc) {
  const d = doc.data || {}
  const subject = `העותק החתום שלכם – ${d.title || DOC_TYPES.brokerage.name} · אפיק הנחל`
  const text = [`שלום ${d.client?.name || ''},`, '', 'תודה! המסמך נחתם בהצלחה והעותק החתום מצורף להודעה זו.', `מועד חתימה: ${whenHe(doc.signed_at || Date.now())}`, '', 'לכל שאלה אנחנו כאן.', '', 'בברכה,', COMPANY.name].join('\n')
  const html = shell('המסמך נחתם בהצלחה', `<p dir="rtl" style="margin:0 0 10px;text-align:right;direction:rtl">שלום ${esc(d.client?.name || '')},</p><p dir="rtl" style="margin:0 0 10px;text-align:right;direction:rtl">תודה! המסמך נחתם בהצלחה והעותק החתום מצורף להודעה זו.</p>${rows([['נכס', propLine(d)], ['מועד חתימה', whenHe(doc.signed_at || Date.now())]])}<p dir="rtl" style="margin:0;text-align:right;direction:rtl;color:${MUTE};font-size:13px">לכל שאלה אנחנו כאן: ${ltr(COMPANY.phone)}.</p>`)
  return { subject, html, text }
}
export function clientSignedWaText(doc) {
  const d = doc.data || {}
  return [`היי ${firstName(d.client?.name)}, תודה! המסמך נחתם בהצלחה.`, d.client?.email ? `העותק החתום נשלח לאימייל ${d.client.email}.` : 'העותק החתום שמור אצלנו ונשלח לכם לפי בקשה.', 'צוות אפיק הנחל'].join('\n')
}

/** The lead's timeline note for an event */
export function docNoteText(type, doc, { message = '', via = '' } = {}) {
  const d = doc.data || {}
  const what = `${d.title || DOC_TYPES.brokerage.name} ${doc.number}`
  const wording = message ? ` · נוסח: ${message}` : ''
  const m = { created: `📄 נוצר ${what}${propLine(d) ? ` · ${propLine(d)}` : ''}`, sent_whatsapp: `📄 ${what} נשלח לחתימה בוואטסאפ${wording}`, sent_email: `📄 ${what} נשלח לחתימה באימייל${wording}`, resent: `📄 ${what} נשלח שוב לחתימה${via ? ` ב${via}` : ''}${wording}`, opened: `📄 הלקוח פתח את ${what}`, signed: `✅ הלקוח חתם על ${what}`, cancelled: `📄 ${what} בוטל`, copy_sent: `📄 עותק חתום של ${what} נשלח ללקוח`, partial: `✍️ ${currentSigner(doc)?.name || 'חותם'} חתם על ${what} — ממתינים לחותם הבא`, expired: `⌛ תוקף הקישור לחתימה על ${what} פג`, reminder: `🔔 נשלחה תזכורת לחתימה על ${what}`, drive: `☁️ ${what} נשמר ב-Google Drive` }
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
/**
 * Sent vs. signed by month (Israel time) for the tab's overview: a month's cohort = the documents first sent in it;
 * `signed` = how many of them are signed (any time since), `signedIn` = signatures that landed in the month, `waiting` = still
 * open, `lost` = expired / cancelled / failed, `rate` = signed / sent, `medianHours` = the median time from the send to the
 * signature. `months` = how many months back (0 = since the first document); the totals and the previous equal period follow.
 */
const ilDay = ts => new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })   // YYYY-MM-DD
export const docMonthKey = ts => ilDay(ts).slice(0, 7)
const monthKey = docMonthKey
const monthLabel = key => { const [y, m] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }
const median = arr => { if (!arr.length) return null; const a = [...arr].sort((x, y) => x - y); const i = a.length >> 1; return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2 }
export function docFunnel(list = [], { months = 6, now = Date.now() } = {}) {
  const sentOf = d => d.sent_at ? Date.parse(d.sent_at) : (['sent', 'opened', 'signed', 'expired'].includes(d.status) ? Date.parse(d.created_at) : NaN)
  const sent = list.filter(d => d.status !== 'draft' && d.status !== 'cancelled' || d.sent_at).map(d => ({ d, at: sentOf(d) })).filter(x => Number.isFinite(x.at))
  const sum = rows => {
    const o = { sent: rows.length, signed: 0, signedIn: 0, waiting: 0, lost: 0, opened: 0, rate: 0, medianHours: null }
    const hours = []
    for (const { d, at } of rows) {
      const st = effectiveStatus(d, now)
      if (st === 'signed') { o.signed++; if (d.signed_at) hours.push((Date.parse(d.signed_at) - at) / 36e5) }
      else if (st === 'sent' || st === 'opened') o.waiting++
      else o.lost++
      if (d.opened_at || st === 'opened' || st === 'signed') o.opened++
    }
    o.rate = o.sent ? Math.round(o.signed / o.sent * 100) : 0
    o.medianHours = median(hours.filter(h => h >= 0))
    return o
  }
  const curKey = monthKey(now)
  const keys = []
  if (months > 0) { const [y, m] = curKey.split('-').map(Number); for (let i = months - 1; i >= 0; i--) { const dt = new Date(Date.UTC(y, m - 1 - i, 1)); keys.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`) } }
  else { const all = [...new Set(sent.map(x => monthKey(x.at)))].sort(); if (all.length) { const [y, m] = all[0].split('-').map(Number); const [cy, cm] = curKey.split('-').map(Number); for (let i = 0; i <= (cy - y) * 12 + (cm - m); i++) { const dt = new Date(Date.UTC(y, m - 1 + i, 1)); keys.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`) } } }
  const inPeriod = keys.length ? sent.filter(x => keys.includes(monthKey(x.at))) : []
  const byMonth = keys.map(key => ({ key, label: monthLabel(key), ...sum(inPeriod.filter(x => monthKey(x.at) === key)), signedIn: list.filter(d => d.status === 'signed' && d.signed_at && monthKey(Date.parse(d.signed_at)) === key).length }))
  const totals = sum(inPeriod)
  let prev = null
  if (months > 0 && keys.length) {
    const [y, m] = keys[0].split('-').map(Number)
    const pk = []; for (let i = months; i >= 1; i--) { const dt = new Date(Date.UTC(y, m - 1 - i, 1)); pk.push(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`) }
    const rows = sent.filter(x => pk.includes(monthKey(x.at)))
    prev = rows.length ? sum(rows) : null
  }
  return { months: byMonth, totals, prev, waitingNow: list.filter(d => ['sent', 'opened'].includes(effectiveStatus(d, now))).length }
}
export function fmtHours(h) {
  if (h == null || !Number.isFinite(h)) return '—'
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} דק׳`
  if (h < 48) return `${Math.round(h * 10) / 10 % 1 ? (Math.round(h * 10) / 10) : Math.round(h)} שע׳`
  return `${Math.round(h / 24 * 10) / 10 % 1 ? Math.round(h / 24 * 10) / 10 : Math.round(h / 24)} ימים`
}
/** The status a row shows (a sent document past its expiry reads "expired" even before the hourly sweep) */
export function effectiveStatus(doc, now = Date.now()) {
  return ['sent', 'opened'].includes(doc?.status) && isExpired(doc, now) ? 'expired' : doc?.status
}

// ── Several signers, in order ───────────────────────────────────────────────────────────────────────────────────
// data.signers = the signers after the client (from the wizard). data.signing = the state once the document went out:
// { current, list: [{ i, name, idNumber, phone, email, role, status: waiting | sent | opened | signed, sent_at, opened_at,
// signed_at, signature, signature_path }], reminders: [{ signer, step, at, via }], tok (the current link, encrypted), noRemind }.
// The document's own token / OTP columns always belong to the signer whose turn it is.
/** every signer in signing order: the client first */
/** How a signature was verified, in words: the personal link (default since 2026-11-04) or an older one-time code.
 *  long → for the certificate ("קישור אישי שנשלח לוואטסאפ 054-***-*491"), short → under the signature box. */
/** The broker's own signature (admin "חתימת המתווך", app_settings.doc_agent_signature) goes on a document once the client has
 *  signed, when the document's broker is that person (or names no broker). Names compare without spaces / dashes / quotes. */
export const sameAgent = (a, b) => { const n = x => String(x || '').replace(/[^\p{L}\p{N}]/gu, ''); return !!n(a) && n(a) === n(b) }
export function agentSigns(doc, sig) {
  if (!sig?.name) return false
  const ag = doc?.data?.agent?.name || ''
  return !ag || sameAgent(ag, sig.name)
}
export function verifyLabel(sg = {}, long = false) {
  const where = sg.via === 'email' ? 'לאימייל' : 'לוואטסאפ'
  if (sg.method === 'link') return long ? `קישור אישי שנשלח ${where}${sg.to ? ` ${sg.to}` : ''}` : `באמצעות קישור אישי ${where}`
  return long ? `קוד חד-פעמי ${where}${sg.to ? ` ${sg.to}` : ''}` : `בקוד חד-פעמי ${where}`
}
export function signerList(data = {}) {
  const c = data.client || {}
  return [{ i: 0, name: c.name || '', idNumber: c.idNumber || '', phone: c.phone || '', email: c.email || '', role: 'client' },
    ...(Array.isArray(data.signers) ? data.signers : []).map((s, k) => ({ i: k + 1, name: s.name || '', idNumber: s.idNumber || '', phone: s.phone || '', email: s.email || '', role: s.role || 'other' }))]
}
/** the state at the first send */
export function startSigning(data = {}) {
  return { current: 0, list: signerList(data).map(s => ({ ...s, status: 'waiting' })), reminders: [] }
}
/** the signer whose turn it is (an old document without `signing` = the client) */
export function currentSigner(doc) {
  const sg = doc?.data?.signing
  if (sg?.list?.length) return sg.list[Math.min(sg.current ?? 0, sg.list.length - 1)]
  return signerList(doc?.data || {})[0]
}
export function signerProgress(doc) {
  const sg = doc?.data?.signing
  if (!sg?.list?.length) return { done: doc?.status === 'signed' ? 1 : 0, total: signerList(doc?.data || {}).length, multi: signerList(doc?.data || {}).length > 1 }
  const done = sg.list.filter(s => s.status === 'signed').length
  return { done, total: sg.list.length, multi: sg.list.length > 1, finished: done === sg.list.length }
}
/** signer i signed → the state with the next signer current (finished: true when they were the last) */
export function advanceSigning(signing, i, signature, { path = '' } = {}) {
  const list = (signing?.list || []).map((s, k) => k === i ? { ...s, status: 'signed', signed_at: signature.at, signature, signature_path: path || s.signature_path } : s)
  const next = list.findIndex((s, k) => k > i && s.status !== 'signed')
  return { ...signing, list, current: next === -1 ? i : next, finished: next === -1 }
}
export const signerMask = s => ({ phoneMasked: maskPhone(s?.phone), emailMasked: maskEmail(s?.email) })

// ── Reminders to a signer who hasn't signed ───────────────────────────────────────────────────────────────────────
export function cleanReminders(r = {}) {
  const days = [...new Set((Array.isArray(r.days) ? r.days : String(r.days ?? '').split(/[,\s]+/)).map(Number).filter(n => n >= 1 && n <= 60).map(n => Math.round(n)))].sort((a, b) => a - b).slice(0, 5)
  const from = Math.min(23, Math.max(0, Number(r.from ?? DEFAULT_REMINDERS.from) || 0)), to = Math.min(24, Math.max(from + 1, Number(r.to ?? DEFAULT_REMINDERS.to) || 24))
  return { enabled: r.enabled !== false, days: days.length ? days : [...DEFAULT_REMINDERS.days], from, to }
}
export function cleanNotifyOn(n = {}) { const out = {}; for (const k of Object.keys(DEFAULT_NOTIFY_ON)) out[k] = k in n ? n[k] !== false && n[k] !== 'false' : DEFAULT_NOTIFY_ON[k]; return out }
export const ilHour = (now = Date.now()) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hourCycle: 'h23' }).format(new Date(now)))
/** which reminder is due now for the document's current signer: { step, signer } | null.
 *  One reminder a day at most; a step is sent once per signer; only in the sending hours; never for a document that is
 *  signed / cancelled / expired, or marked "no reminders". The clock starts when THIS signer got the link. */
export function reminderDue(doc, cfg = DEFAULT_REMINDERS, now = Date.now()) {
  const c = cleanReminders(cfg)
  if (!c.enabled || !doc || !['sent', 'opened'].includes(doc.status) || isExpired(doc, now)) return null
  const sg = doc.data?.signing || {}
  if (sg.noRemind) return null
  const h = ilHour(now)
  if (h < c.from || h >= c.to) return null
  const cur = sg.list?.length ? Math.min(sg.current ?? 0, sg.list.length - 1) : 0
  const base = Date.parse(sg.list?.[cur]?.sent_at || doc.sent_at || '')
  if (!base) return null
  const mine = (sg.reminders || []).filter(r => (r.signer ?? 0) === cur)
  if (mine.some(r => now - Date.parse(r.at) < 20 * 3600e3)) return null
  const sentSteps = new Set(mine.map(r => r.step))
  for (let k = c.days.length - 1; k >= 0; k--) {
    if (now >= base + c.days[k] * 864e5) return sentSteps.has(k + 1) ? null : { step: k + 1, signer: cur, days: c.days[k] }
  }
  return null
}

// ── Google Drive (the sync target; the database stays the source of truth) ────────────────────────────────────────
export const DRIVE_ROOT = ['Afik HaNahal', 'Documents']
export const safeDriveName = s => String(s || '').replace(/[\\/:*?"<>|#%{}~&]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
export const driveKindLabel = { original: 'Sent', signed: 'Signed', docx: 'Draft' }
/** [Project]_[Client]_[Type]_[Date]_[Status].pdf */
export function driveFileName(doc, kind = 'original', now = new Date()) {
  const d = doc?.data || {}
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date((kind === 'signed' && doc?.signed_at) || doc?.sent_at || doc?.created_at || now))
  const parts = [safeDriveName(doc?.project_name || d.projectName) || 'General', safeDriveName(d.client?.name) || 'Client', safeDriveName(d.title || DOC_TYPES.brokerage.name), date, driveKindLabel[kind] || kind]
  return `${parts.join('_')}${kind === 'docx' ? '.docx' : '.pdf'}`
}
/** the folder a file goes to: Afik HaNahal/Documents/Projects/<project>/{Sent Documents | Signed Documents}, else …/General/… */
export function driveFolderPath(doc, kind = 'original') {
  const project = safeDriveName(doc?.project_name || doc?.data?.projectName)
  const leaf = kind === 'signed' ? 'Signed Documents' : 'Sent Documents'
  return [...DRIVE_ROOT, ...(project ? ['Projects', project] : ['General']), leaf]
}
export const DRIVE_TEMPLATES_PATH = [...DRIVE_ROOT, 'Templates']
export const DRIVE_ARCHIVE_PATH = [...DRIVE_ROOT, 'Archived']

// ── More messages ────────────────────────────────────────────────────────────────────────────────────────────────
const roleHe = r => SIGNER_ROLES[r] || SIGNER_ROLES.other
/** the link to a signer after the client (the one before them signed) */
export function nextSignerWaText(doc, link, signer, prev) {
  const d = doc.data || {}
  return [`היי ${firstName(signer?.name)},`, `${prev?.name || 'הלקוח'} ${prev?.role === 'client' ? '' : `(${roleHe(prev?.role)}) `}חתמו על ${d.title || DOC_TYPES.brokerage.name} של אפיק הנחל${propLine(d) ? ` עבור הנכס ב${propLine(d)}` : ''}, ועכשיו תורכם.`,
    'אפשר לעיין במסמך ולחתום עליו דיגיטלית בקישור האישי הזה:', link, 'אחרי שכל החותמים יחתמו נשלח לכולם עותק חתום.', `תוקף הקישור: עד ${todayHe(doc.expires_at)}.`, 'תודה, צוות אפיק הנחל'].filter(Boolean).join('\n')
}
export function nextSignerEmail(doc, link, signer, prev) {
  const d = doc.data || {}
  const subject = `${d.title || DOC_TYPES.brokerage.name} – תורכם לחתום · אפיק הנחל`
  const text = [`שלום ${signer?.name || ''},`, '', `${prev?.name || 'הלקוח'} חתמו על המסמך, ועכשיו תורכם.`, '', 'לצפייה במסמך ולחתימה דיגיטלית:', link, '', `תוקף הקישור: עד ${todayHe(doc.expires_at)}.`, '', 'צוות אפיק הנחל'].join('\n')
  const html = shell(d.title || DOC_TYPES.brokerage.name, `<p dir="rtl" style="margin:0 0 10px;text-align:right;direction:rtl">שלום ${esc(signer?.name || '')},</p><p dir="rtl" style="margin:0 0 10px;text-align:right;direction:rtl">${esc(prev?.name || 'הלקוח')} חתמו על המסמך, ועכשיו תורכם.</p>${btn(link, 'לצפייה ולחתימה')}<p dir="rtl" style="margin:0;text-align:right;direction:rtl;color:${MUTE};font-size:13px">תוקף הקישור: עד ${esc(todayHe(doc.expires_at))}. הקישור אישי ומיועד לכם בלבד.</p>`)
  return { subject, html, text }
}
/** a reminder to the signer whose turn it is */
export function reminderWaText(doc, link, { signer, step = 1 } = {}) {
  const d = doc.data || {}
  const s = signer || currentSigner(doc)
  return [`היי ${firstName(s?.name)},`, `${step > 1 ? 'עוד ' : ''}תזכורת קטנה מאפיק הנחל: ${d.title || DOC_TYPES.brokerage.name}${propLine(d) ? ` עבור הנכס ב${propLine(d)}` : ''} עדיין מחכה לחתימה שלכם.`,
    'זה לוקח דקה, בקישור האישי:', link, `תוקף הקישור: עד ${todayHe(doc.expires_at)}.`, 'אם משהו לא ברור, אפשר לענות כאן ונעזור.'].join('\n')
}
export function reminderEmail(doc, link, { signer, step = 1 } = {}) {
  const d = doc.data || {}
  const s = signer || currentSigner(doc)
  const subject = `תזכורת: ${d.title || DOC_TYPES.brokerage.name} מחכה לחתימה · אפיק הנחל`
  const text = [`שלום ${s?.name || ''},`, '', `${step > 1 ? 'עוד ' : ''}תזכורת: המסמך${propLine(d) ? ` עבור הנכס ב${propLine(d)}` : ''} עדיין מחכה לחתימה שלכם.`, '', link, '', `תוקף הקישור: עד ${todayHe(doc.expires_at)}.`, '', 'צוות אפיק הנחל'].join('\n')
  const html = shell('תזכורת לחתימה', `<p dir="rtl" style="margin:0 0 10px;text-align:right;direction:rtl">שלום ${esc(s?.name || '')},</p><p dir="rtl" style="margin:0 0 10px;text-align:right;direction:rtl">${step > 1 ? 'עוד ' : ''}תזכורת: <b>${esc(d.title || DOC_TYPES.brokerage.name)}</b>${propLine(d) ? ` עבור הנכס ב${esc(propLine(d))}` : ''} עדיין מחכה לחתימה שלכם.</p>${btn(link, 'לצפייה ולחתימה')}<p dir="rtl" style="margin:0;text-align:right;direction:rtl;color:${MUTE};font-size:13px">תוקף הקישור: עד ${esc(todayHe(doc.expires_at))}.</p>`)
  return { subject, html, text }
}
/** the office's short WhatsApp on an event other than the final signature */
export function officeEventText(type, doc, { cardLink = '', signer = null, error = '' } = {}) {
  const d = doc.data || {}
  const who = signer?.name || d.client?.name || ''
  const what = `${d.title || DOC_TYPES.brokerage.name} ${doc.number}${propLine(d) ? ` · ${propLine(d)}` : ''}`
  const p = signerProgress(doc)
  const head = {
    opened: `${who} פתחו את המסמך לחתימה`, partial: `${who} חתמו (${p.done} מתוך ${p.total}) — הקישור נשלח לחותם הבא`,
    expired: `תוקף הקישור לחתימה פג בלי חתימה${who ? ` (${who})` : ''}`, failed: `שליחת המסמך לחתימה נכשלה${who ? ` (${who})` : ''}${error ? ` · ${error}` : ''}`,
    reminder: `נשלחה תזכורת לחתימה ל${who}`, drive_failed: `השמירה ב-Google Drive נכשלה${error ? ` · ${error}` : ''}`,
  }[type]
  if (!head) return ''
  return [head, what, d.client?.phone && type !== 'drive_failed' ? `טלפון: ${d.client.phone}` : '', cardLink].filter(Boolean).join('\n')
}

// ── A document from an existing property (admin "מסמך מהיר מנכס") ─────────────────────────────────────────────────────
const digits = v => String(v ?? '').replace(/[^\d]/g, '')
/** a property record of the site (title, street, houseNumber, location, type, rooms, size, floor, dunams, gush, helka, price,
 *  category) → the document's fixed property details: { propertyId, property: { address, city, desc, type, dealType, price, link,
 *  notes }, fees: { mode } } — a rental starts on months of rent */
export function propertyToDoc(p = {}) {
  const rent = p.category === 'rentals' || /השכר|שכירות/.test(String(p.dealType || p.type || ''))
  const address = [p.street, p.houseNumber].filter(Boolean).join(' ').trim() || String(p.address || '').trim() || String(p.title || '').trim()
  const desc = [p.type, p.rooms && `${p.rooms} חדרים`, p.size && `${p.size} מ"ר`, p.floor !== undefined && p.floor !== null && p.floor !== '' && `קומה ${p.floor}`, p.dunams && `${p.dunams} דונם`].filter(Boolean).join(', ')
  const parcel = p.gush ? `גוש ${p.gush}${p.helka ? ` חלקה ${p.helka}` : ''}` : ''
  const price = Number(digits(p.price)) || ''
  return {
    propertyId: p.id != null ? String(p.id) : '',
    property: { address, city: String(p.location || p.city || '').trim(), desc, type: String(p.type || '').trim(), dealType: rent ? 'rent' : 'sale', price, link: p.id != null ? `${SITE}/p/${encodeURIComponent(p.id)}` : '', notes: parcel },
    fees: rent ? { mode: 'months', months: 1 } : { mode: 'percent' },
  }
}
/** what the office keeps per property so the next document asks only for what changes: template, fee, terms, validity, project */
export function cleanPreset(x = {}) {
  const f = x.fees || {}
  const mode = FEE_MODES[f.mode] ? f.mode : 'percent'
  const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 100) / 100 : undefined }
  const out = {
    templateId: /^(brokerage|[0-9a-f-]{36})$/.test(String(x.templateId || '')) ? String(x.templateId) : 'brokerage',
    fees: { mode, ...(num(f.pct, 0.1, 15) != null ? { pct: num(f.pct, 0.1, 15) } : {}), ...(num(f.months, 0.5, 24) != null ? { months: num(f.months, 0.5, 24) } : {}), ...(num(f.fixed, 1, 1e8) != null ? { fixed: num(f.fixed, 1, 1e8) } : {}) },
    terms: str(x.terms, 600),
    role: CLIENT_ROLES[x.role] ? x.role : undefined,
    expiryDays: num(x.expiryDays, 1, 90),
    projectId: /^p_[a-z0-9]{3,20}$/.test(String(x.projectId || '')) ? String(x.projectId) : '',
    projectName: str(x.projectName, 80),
    at: x.at || new Date().toISOString(),
  }
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === '') delete out[k]
  return out
}
/** the presets map kept in the settings: { [propertyId]: preset }, at most 300 (the newest kept); null removes one */
export function mergePresets(cur = {}, patch = {}) {
  const next = { ...(cur && typeof cur === 'object' ? cur : {}) }
  for (const [id, v] of Object.entries(patch || {})) {
    const key = String(id).slice(0, 40)
    if (!key) continue
    if (v === null) delete next[key]
    else next[key] = cleanPreset(v)
  }
  const entries = Object.entries(next).sort((a, b) => String(b[1]?.at || '').localeCompare(String(a[1]?.at || ''))).slice(0, 300)
  return Object.fromEntries(entries)
}
