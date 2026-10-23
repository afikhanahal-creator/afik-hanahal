// Contact exports from the leads board (src/ExportDialog.jsx): the CRM list as a real Excel file (.xlsx, Hebrew headers,
// phones as text, one row per contact, the columns the office picks) and a Meta customer list (CSV — the format Meta
// Ads Manager accepts for a Custom Audience and, from it, a Lookalike Audience). Pure; tested in contacts-export.test.mjs.
import { leadCampaign, sourceLabel } from '../src/lib/leadFields.js'
import { createXlsx } from './xlsx-writer.js'

const s = v => (v == null ? '' : String(v).trim())
const digits = v => s(v).replace(/\D/g, '')
/** 054-1234567 / +972 54… / 97254… → "0541234567" (local, for people) */
export function localPhone(v) { const d = digits(v); return d.startsWith('972') ? `0${d.slice(3)}` : d }
/** → "972541234567" (country code, no plus / leading zero — what Meta matches on) */
export function intlPhone(v) { const d = digits(v); if (!d) return ''; if (d.startsWith('972')) return d; if (d.startsWith('0')) return `972${d.slice(1)}`; return d.length === 9 ? `972${d}` : d }
const israeliMobileOk = p => /^9725\d{8}$/.test(p) || /^972[2-9]\d{7,8}$/.test(p)
const dt = (v, withTime = true) => {
  if (!v) return ''
  const d = new Date(typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v)
  if (!Number.isFinite(d.getTime())) return ''
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const g = t => p.find(x => x.type === t)?.value || ''
  return `${g('day')}/${g('month')}/${g('year')}${withTime ? ` ${g('hour')}:${g('minute')}` : ''}`
}
const notesOf = l => (Array.isArray(l.notes) ? l.notes : typeof l.notes === 'string' && l.notes.trim() ? [{ text: l.notes, ts: 0 }] : []).filter(n => s(n?.text))
const DEAL = { buy: 'קנייה', sell: 'מכירה', rent: 'השכרה', invest: 'השקעה' }
const TIMELINE = { now: 'מיידי', soon: 'בחודשים הקרובים', year: 'עד שנה', later: 'לא דחוף' }
const FINANCING = { cash: 'מזומן / הון עצמי', approved: 'משכנתא – אישור עקרוני', mortgage: 'משכנתא – צריך ליווי', unknown: 'לא ידוע' }
const PRIORITY = { high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' }
export function splitName(name) {
  const parts = s(name).replace(/[·|].*$/, '').replace(/[^\p{L}\p{M}\s'׳-]/gu, ' ').trim().split(/\s+/).filter(Boolean)
  return { first: parts[0] || '', last: parts.length > 1 ? parts.slice(1).join(' ') : '' }
}

/** Every column the office can export. stageName(id) → the board's stage name */
export const EXPORT_COLUMNS = [
  { key: 'name', he: 'שם מלא', width: 22, get: l => s(l.name), def: true },
  { key: 'first', he: 'שם פרטי', width: 14, get: l => splitName(l.name).first, def: true },
  { key: 'last', he: 'שם משפחה', width: 16, get: l => splitName(l.name).last, def: true },
  { key: 'phone', he: 'טלפון', width: 14, get: l => localPhone(l.phone), def: true },
  { key: 'phoneIntl', he: 'טלפון בינלאומי', width: 16, get: l => (l.phone ? `+${intlPhone(l.phone)}` : ''), def: true },
  { key: 'email', he: 'אימייל', width: 26, get: l => s(l.email).toLowerCase(), def: true },
  { key: 'stage', he: 'שלב בפייפליין', width: 16, get: (l, o) => o.stageName(l.leadStatus || 'new'), def: true },
  { key: 'source', he: 'מקור', width: 16, get: l => sourceLabel(l.source || ''), def: true },
  { key: 'campaign', he: 'קמפיין', width: 18, get: l => leadCampaign(l), def: true },
  { key: 'campaignFull', he: 'שם הקמפיין המלא', width: 26, get: l => s(l.campaignName || l.crm_data?.campaignName || l.origin?.campaign) },
  { key: 'utm', he: 'UTM', width: 24, get: l => Object.entries(l.origin?.utm || {}).map(([k, v]) => `${k}=${v}`).join(' · ') },
  { key: 'property', he: 'נכס / פרויקט', width: 22, get: l => s(l.propTitle), def: true },
  { key: 'propLocation', he: 'מיקום הנכס', width: 16, get: l => s(l.propLocation) },
  { key: 'dealType', he: 'סוג עסקה', width: 11, get: l => DEAL[l.dealType] || s(l.dealType), def: true },
  { key: 'propertyType', he: 'סוג נכס', width: 13, get: l => s(l.propertyType) },
  { key: 'area', he: 'אזור / יישוב', width: 14, get: l => s(l.area), def: true },
  { key: 'budget', he: 'תקציב (₪)', width: 13, type: 'number', get: l => (digits(l.budget) && /^\d[\d,.\s]*$/.test(s(l.budget)) ? digits(l.budget) : s(l.budget)), def: true },
  { key: 'rooms', he: 'חדרים', width: 8, get: l => s(l.rooms) },
  { key: 'timeline', he: 'לוח זמנים', width: 14, get: l => TIMELINE[l.timeline] || s(l.timeline) },
  { key: 'financing', he: 'מימון', width: 18, get: l => FINANCING[l.financing] || s(l.financing) },
  { key: 'priority', he: 'עדיפות', width: 9, get: l => PRIORITY[l.priority] || s(l.priority) },
  { key: 'owner', he: 'אחראי', width: 12, get: l => s(l.owner) },
  { key: 'tags', he: 'תגיות', width: 18, get: l => (Array.isArray(l.tags) ? l.tags.join(', ') : s(l.tags)), def: true },
  { key: 'message', he: 'מה כתבו', width: 40, get: l => s(l.msg || l.message) },
  { key: 'lastNote', he: 'הערה אחרונה', width: 40, get: l => s(notesOf(l).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0]?.text) },
  { key: 'followUp', he: 'פולו אפ הבא', width: 16, get: l => dt(l.followUp) },
  { key: 'lang', he: 'שפה', width: 8, get: l => (l.origin?.lang === 'en' ? 'אנגלית' : 'עברית') },
  { key: 'optOut', he: 'ביקשו לא לקבל הודעות', width: 12, get: l => (l.auto?.optOut ? 'כן' : '') },
  { key: 'created', he: 'נוצר בתאריך', width: 16, get: l => dt(l.ts || l.created_at), def: true },
  { key: 'updated', he: 'עודכן לאחרונה', width: 16, get: l => dt(l.updatedAt || l.updated_at) },
  { key: 'id', he: 'מזהה במערכת', width: 14, get: l => s(l.id) },
]
export const DEFAULT_COLUMNS = EXPORT_COLUMNS.filter(c => c.def).map(c => c.key)

/** The CRM workbook → Uint8Array (.xlsx) */
export function contactsWorkbook(leads, { columns = DEFAULT_COLUMNS, stageName = x => x } = {}) {
  const cols = EXPORT_COLUMNS.filter(c => columns.includes(c.key))
  const rows = (leads || []).map(l => cols.map(c => c.get(l, { stageName })))
  return createXlsx([{ name: 'אנשי קשר', columns: cols.map(c => ({ header: c.he, width: c.width, type: c.type })), rows }])
}

// ── Meta customer list (Custom Audience → Lookalike) ───────────────────────────────────────────────────────────────
// Meta matches on these identifiers (it hashes them on upload): email, phone (country code, digits only), fn, ln, ct,
// country. One row per person: duplicates by phone or email are merged, rows with neither are left out, and so are
// people who asked us not to contact them (unless includeOptOut).
const csvCell = v => { let t = s(v); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }
export function metaAudienceRows(leads, { includeOptOut = false } = {}) {
  const seen = new Set(), out = []
  let skipped = 0, optedOut = 0, dupes = 0
  for (const l of leads || []) {
    if (!includeOptOut && l.auto?.optOut) { optedOut++; continue }
    const p = intlPhone(l.phone), phone = israeliMobileOk(p) || (p.length >= 10 && !p.startsWith('972')) ? p : ''
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(l.email)) ? s(l.email).toLowerCase() : ''
    if (!phone && !email) { skipped++; continue }
    const keys = [phone && `p:${phone}`, email && `e:${email}`].filter(Boolean)
    if (keys.some(k => seen.has(k))) { dupes++; continue }
    keys.forEach(k => seen.add(k))
    const { first, last } = splitName(l.name)
    out.push({ email, phone, fn: first.toLowerCase(), ln: last.toLowerCase(), ct: s(l.area || l.propLocation).toLowerCase(), country: 'il' })
  }
  return { rows: out, skipped, optedOut, dupes }
}
export const META_HEADERS = ['email', 'phone', 'fn', 'ln', 'ct', 'country']
export function metaAudienceCsv(leads, opts) {
  const r = metaAudienceRows(leads, opts)
  return { ...r, csv: [META_HEADERS.join(','), ...r.rows.map(x => META_HEADERS.map(h => csvCell(x[h])).join(','))].join('\n') + '\n' }
}

export const exportFileName = (kind, now = new Date()) => {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(now)
  return kind === 'meta' ? `meta_audience_${d}.csv` : `contacts_export_${d}.xlsx`
}
