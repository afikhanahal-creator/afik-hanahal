// Shared helpers for showing EVERYTHING a lead brought with it — used by the leads board,
// both Meta screens and the admin bridge between them.

// Where a lead came from → short bilingual label (+ colour)
export const SOURCE_LABELS = {
  website:       { he: 'אתר',            en: 'Website',        color: '#8490D8' },
  contact_form:  { he: 'טופס צור קשר',   en: 'Contact form',   color: '#8490D8' },
  property_form: { he: 'טופס נכס',       en: 'Property form',  color: '#3BAF7E' },
  pdf_download:  { he: 'הורדת PDF',      en: 'PDF download',   color: '#E08C3A' },
  meta:          { he: 'Meta (פייסבוק)', en: 'Meta (Facebook)', color: '#1877F2' },
  whatsapp:      { he: 'וואטסאפ',        en: 'WhatsApp',       color: '#25D366' },
  manual:        { he: 'הוזן ידנית',     en: 'Added manually', color: '#9AA0B5' },
}
export function sourceLabel(source, lang = 'he') {
  const s = SOURCE_LABELS[source]
  if (s) return lang === 'en' ? s.en : s.he
  return source || (lang === 'en' ? 'Unknown' : 'לא ידוע')
}
export const sourceColor = source => SOURCE_LABELS[source]?.color || '#9AA0B5'

// Meta standard fields we already show as name / phone / email — everything else is a
// custom question the advertiser added to the form (budget, area, property type…).
const STANDARD_KEYS = /^(full_?name|first_?name|last_?name|name|email|phone(_?number)?|mobile|work_?phone|work_?email)$/i
const PRETTY = {
  city: { he: 'עיר', en: 'City' }, street_address: { he: 'כתובת', en: 'Address' }, zip_code: { he: 'מיקוד', en: 'Zip' },
  state: { he: 'מחוז', en: 'State' }, country: { he: 'מדינה', en: 'Country' }, company_name: { he: 'חברה', en: 'Company' },
  job_title: { he: 'תפקיד', en: 'Job title' }, date_of_birth: { he: 'תאריך לידה', en: 'Date of birth' }, gender: { he: 'מגדר', en: 'Gender' },
}

/**
 * Meta `raw_fields` ([{ name, values }]) → [{ q, a }] for the custom questions.
 * Question keys are Meta's slug of the question text ("מה_התקציב_שלך?") — underscores become spaces.
 */
export function metaFormAnswers(rawFields, lang = 'he') {
  if (!Array.isArray(rawFields)) return []
  const out = []
  for (const f of rawFields) {
    const key = String(f?.name || '').trim()
    if (!key || STANDARD_KEYS.test(key)) continue
    const vals = Array.isArray(f.values) ? f.values : (f.value != null ? [f.value] : [])
    const a = vals.map(v => String(v ?? '').trim()).filter(Boolean).join(', ')
    if (!a) continue
    const pretty = PRETTY[key.toLowerCase()]
    const q = pretty ? (lang === 'en' ? pretty.en : pretty.he) : key.replace(/_/g, ' ')
    out.push({ q, a })
  }
  return out
}

// One-line text version — for the message column, notifications and AI prompts
export function answersToText(answers) {
  return (answers || []).map(x => `${x.q}: ${x.a}`).join(' · ')
}

// Website leads: the page / referrer / UTM captured at submit time (stored in crm_data.origin)
export function originLines(origin, lang = 'he') {
  if (!origin || typeof origin !== 'object') return []
  const L = (he, en) => (lang === 'en' ? en : he)
  const rows = []
  if (origin.page)     rows.push({ q: L('עמוד', 'Page'), a: origin.page })
  if (origin.referrer) rows.push({ q: L('הגיע מ', 'Referrer'), a: origin.referrer })
  if (origin.lang)     rows.push({ q: L('שפת האתר', 'Site language'), a: origin.lang === 'en' ? 'English' : 'עברית' })
  const utm = origin.utm || {}
  for (const [k, v] of Object.entries(utm)) if (v) rows.push({ q: k.replace(/^utm_/, 'UTM '), a: String(v) })
  if (origin.device)   rows.push({ q: L('מכשיר', 'Device'), a: origin.device })
  return rows
}
