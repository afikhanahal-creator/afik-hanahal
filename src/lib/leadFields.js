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
  booking:       { he: 'קביעת שיחה באתר', en: 'Website booking', color: '#7C5CC4' },
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
  rooms: { he: 'חדרים', en: 'Rooms' }, budget: { he: 'תקציב', en: 'Budget' },
}
// The office's lead forms answer with short option codes ("3r", "b34", "ph") — shown as words
export function prettyAnswerValue(v, lang = 'he') {
  const s = String(v ?? '').trim(), en = lang === 'en'
  let m
  if ((m = s.match(/^(\d+)\s*r$/i))) return en ? `${m[1]} rooms` : `${m[1]} חדרים`
  if ((m = s.match(/^b(\d)(\d)$/i))) return en ? `₪${m[1]}–${m[2]}M` : `${m[1]}–${m[2]} מיליון`
  if ((m = s.match(/^b(\d+)$/i))) return en ? `₪${m[1]}M+` : `${m[1]} מיליון ומעלה`
  if (/^(ph|penthouse)$/i.test(s)) return en ? 'Penthouse' : 'פנטהאוז'
  if (/^garden$/i.test(s)) return en ? 'Garden apartment' : 'דירת גן'
  return s
}
// A stored one-line answers text ("rooms: 3r · budget: b34") → "חדרים: 3 חדרים · תקציב: 3–4 מיליון"
export function prettyLeadText(text, lang = 'he') {
  return String(text ?? '').replace(/\b(rooms|budget)\s*:\s*([\w+-]+)/gi, (_, k, v) => `${PRETTY[k.toLowerCase()][lang === 'en' ? 'en' : 'he']}: ${prettyAnswerValue(v, lang)}`)
}

/**
 * Meta `raw_fields` ([{ name, values }]) → [{ q, a }] for the custom questions.
 * Question keys are Meta's slug of the question text ("מה_התקציב_שלך?") — underscores become spaces.
 */
/** The name exactly as the lead typed it in a Meta form (full name, else first + last) — kept in raw_fields after a rename */
export function formFullName(rawFields) {
  const f = Array.isArray(rawFields) ? rawFields : []
  const val = re => { const x = f.find(y => re.test(String(y?.name || ''))); const v = x && (Array.isArray(x.values) ? x.values[0] : x.value); return v == null ? '' : String(v).trim() }
  return val(/^(full_?name|name|שם( מלא)?)$/i) || [val(/^first_?name$/i), val(/^last_?name$/i)].filter(Boolean).join(' ')
}

export function metaFormAnswers(rawFields, lang = 'he') {
  if (!Array.isArray(rawFields)) return []
  const out = []
  for (const f of rawFields) {
    const key = String(f?.name || '').trim()
    if (!key || STANDARD_KEYS.test(key)) continue
    const vals = Array.isArray(f.values) ? f.values : (f.value != null ? [f.value] : [])
    const a = vals.map(v => prettyAnswerValue(v, lang)).filter(Boolean).join(', ')
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

// Which campaign a lead belongs to — a short name shown in brackets next to the lead's name everywhere
// ("ריבי שטיינהרט (אתר)", "Ella Furman (זרובבל 15)"). Meta: the campaign (else the lead form) without version / audience
// suffixes; website forms: just "אתר"; other sources: a one-word label. leadCampaignFull() keeps the whole name (tooltips).
const SHORT_SOURCE = {
  website: ['אתר', 'Website'], contact_form: ['אתר', 'Website'], property_form: ['אתר', 'Website'], pdf_download: ['אתר', 'Website'],
  meta: ['פייסבוק', 'Facebook'], whatsapp: ['וואטסאפ', 'WhatsApp'], manual: ['ידני', 'Manual'], booking: ['קבעו שיחה', 'Booked a call'],
}
const metaName = lead => {
  const crm = lead.crm_data && typeof lead.crm_data === 'object' ? lead.crm_data : {}
  return [lead.campaignName, lead.campaign_name, crm.campaignName, lead.formName, lead.form_name, crm.formName]
    .map(x => String(x ?? '').trim()).find(Boolean) || ''
}
const sourceOf = lead => lead.source || (String(lead.id || '').startsWith('meta_') ? 'meta' : '')
// "זרובבל 15 - v2 (כוונה גבוהה)" → "זרובבל 15" · "הנרייטה סאלד 22-24-copy" → "הנרייטה סאלד 22-24" · "חנקין 41 | ריטרגטינג" → "חנקין 41"
export function shortCampaign(name) {
  let n = String(name || '').replace(/\([^)]*\)/g, ' ').replace(/[\s_-]*copy(\s*\d+)?\s*$/i, '').replace(/\s*#\s*\d+\s*$/, '')
  n = n.split(/\s+[-–—|·]\s+|\s*\|\s*/)[0]
  n = n.replace(/\s+v\d+\s*$/i, '').replace(/\s+/g, ' ').trim()
  return n || String(name || '').trim()
}
export function leadCampaign(lead, lang = 'he') {
  if (!lead || typeof lead !== 'object') return ''
  const m = metaName(lead)
  if (m) return shortCampaign(m)
  const src = sourceOf(lead) || ((lead.origin || lead.crm_data?.origin) ? 'website' : '')
  const lbl = SHORT_SOURCE[src]
  return lbl ? lbl[lang === 'en' ? 1 : 0] : (src ? sourceLabel(src, lang) : '')
}
/** The project a lead belongs to, for its name ("סוזנה · זרובבל 15"): the Meta campaign's short name, else the listing
 *  the lead asked about; '' when there is none (a plain website form is not a project) */
export function leadProject(lead) {
  if (!lead || typeof lead !== 'object') return ''
  const m = metaName(lead)
  if (m) return shortCampaign(m)
  const crm = lead.crm_data && typeof lead.crm_data === 'object' ? lead.crm_data : {}
  return String(lead.propTitle || lead.prop_title || crm.propTitle || '').trim().slice(0, 40)
}
/** The name with / without " · <project>" → { has, next } */
export function toggleProjectInName(name, project) {
  const n = String(name || '').trim(), p = String(project || '').trim()
  if (!p) return { has: false, next: n }
  const suffix = ` · ${p}`
  const has = n.endsWith(suffix) || n === p
  return { has, next: has ? n.slice(0, -suffix.length).trim() : `${n.split(' · ')[0].trim()}${suffix}` }
}
/** leadCampaign for the "(…)" after a name — '' when the name already carries it ("סוזנה · זרובבל 15") */
export function leadCampaignTag(lead, lang = 'he') {
  const c = leadCampaign(lead, lang)
  return c && String(lead?.name || '').includes(c) ? '' : c
}
export const leadCampaignFull = (lead, lang = 'he') => (lead && typeof lead === 'object' && metaName(lead)) || leadCampaign(lead, lang)

/**
 * Did the WhatsApp welcome reach this lead? (crm_data.auto — the CRM's own welcome, the missed-welcome queue, and for a Meta lead
 * the Lead Center / webhook welcome copied over by the database: server/meta-welcome-crm-migration.sql)
 * → { state: 'sent', at } · { state: 'failed', at } · null (nothing known yet)
 */
export function welcomeState(lead) {
  const auto = (lead && (lead.auto || lead.crm_data?.auto)) || {}
  const sent = auto.sent?.welcome || auto.sent?.['welcome:missed']
  if (sent) return { state: 'sent', at: Date.parse(sent) || null }
  if (auto.welcomeFailed) return { state: 'failed', at: Date.parse(auto.welcomeFailed) || null }
  return null
}

/**
 * The last time we were in touch with the lead, from everything we know: the WhatsApp chat (`chat` = { at, dir } of its newest
 * message, when a conversation is open), call / meeting / WhatsApp notes, the last call, automatic sends and the lead's reply.
 * → { at (ms), kind: 'in' | 'out' | 'call' | 'meeting' | 'auto', outcome? } or null.
 */
export function lastContact(lead, chat = null, now = Date.now()) {
  const c = lead?.crm_data ? { ...lead.crm_data, ...lead } : (lead || {})
  const ms = v => (typeof v === 'number' ? v : Date.parse(v)) || 0
  const cands = []
  if (chat?.at) cands.push({ at: ms(chat.at), kind: chat.dir === 'in' ? 'in' : 'out' })
  for (const n of Array.isArray(c.notes) ? c.notes : []) {
    if (n && ['call', 'meeting', 'wa'].includes(n.kind)) cands.push({ at: ms(n.ts), kind: n.kind === 'wa' ? 'out' : n.kind, ...(n.outcome ? { outcome: n.outcome } : {}) })
  }
  if (c.lastCallAt) cands.push({ at: ms(c.lastCallAt), kind: 'call' })
  const auto = c.auto || {}
  for (const v of Object.values(auto.sent || {})) cands.push({ at: ms(v), kind: 'auto' })
  if (auto.replied) cands.push({ at: ms(auto.replied), kind: 'in' })
  const best = cands.filter(x => x.at > 0 && x.at <= now + 60e3).sort((a, b) => b.at - a.at)[0]
  return best || null
}

/** "היום 11:52 · שלחנו בוואטסאפ" / "לפני 3 ימים · שיחה" — and how fresh it is: 'ok' (< 3 days), 'warn' (< 7), 'old' */
export function lastContactText(lc, lang = 'he', now = Date.now()) {
  if (!lc) return null
  const he = lang !== 'en'
  const d = new Date(lc.at), tz = 'Asia/Jerusalem'
  const day = x => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(x)
  const hm = new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  const days = Math.round((Date.parse(day(new Date(now))) - Date.parse(day(d))) / 864e5)
  const mins = Math.round((now - lc.at) / 60e3)
  const when = mins < 60 ? (he ? `לפני ${Math.max(1, mins)} דק׳` : `${Math.max(1, mins)} min ago`)
    : days === 0 ? (he ? `היום ${hm}` : `today ${hm}`)
    : days === 1 ? (he ? `אתמול ${hm}` : `yesterday ${hm}`)
    : days < 7 ? (he ? `לפני ${days} ימים` : `${days} days ago`)
    : new Intl.DateTimeFormat(he ? 'he-IL' : 'en-GB', { timeZone: tz, day: 'numeric', month: 'short' }).format(d) + (he ? ` (לפני ${days} ימים)` : ` (${days} days ago)`)
  const how = {
    in: he ? 'הם כתבו לנו' : 'they wrote to us', out: he ? 'שלחנו בוואטסאפ' : 'we sent a WhatsApp',
    call: lc.outcome === 'no_answer' ? (he ? 'ניסינו להתקשר' : 'we tried calling') : (he ? 'שיחה' : 'a call'),
    meeting: he ? 'פגישה' : 'a meeting', auto: he ? 'הודעה אוטומטית' : 'an automatic message',
  }[lc.kind] || ''
  return { when, how, level: days < 3 ? 'ok' : days < 7 ? 'warn' : 'old', full: new Intl.DateTimeFormat(he ? 'he-IL' : 'en-GB', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }).format(d) }
}
