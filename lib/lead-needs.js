// What a lead told us when they left their details — for personal WhatsApp messages ("ראינו שאתם מחפשים 4 חדרים, בתקציב
// של 3–4 מיליון"). Pure; reads both shapes of a lead: a `contacts` row (crm_data nested, `message`) on the server and the
// admin's lead object (crm_data spread into it, `msg`). Sources: the fields set in the lead card (budget / rooms / area /
// timeline / dealType), the Meta form answers (crm_data.formAnswers [{ q, a }], matched by the question's wording), and
// the free text a website visitor typed. Every value is '' when we don't know it, so a template can leave that part out.
import { prettyAnswerValue } from '../src/lib/leadFields.js'

const T = {
  he: {
    timeline: { now: 'בהקדם', soon: 'בחודשים הקרובים', year: 'במהלך השנה הקרובה', later: 'בהמשך' },
    purpose: { buy: 'רכישה למגורים', invest: 'השקעה', rent: 'שכירות', sell: 'מכירת נכס' },
    rooms: n => `${n} חדרים`, budget: n => (n >= 1e6 ? `כ-${+(n / 1e6).toFixed(1)} מיליון ₪` : `כ-${Math.round(n / 1000)} אלף ₪`),
    inBudget: b => `בתקציב של ${b}`, inArea: a => `ב${a}`, join: ', ',
  },
  en: {
    timeline: { now: 'as soon as possible', soon: 'in the coming months', year: 'within the next year', later: 'later on' },
    purpose: { buy: 'a home to live in', invest: 'an investment', rent: 'a rental', sell: 'selling a property' },
    rooms: n => `${n} rooms`, budget: n => (n >= 1e6 ? `about ₪${+(n / 1e6).toFixed(1)}M` : `about ₪${Math.round(n / 1000)}K`),
    inBudget: b => `with a budget of ${b}`, inArea: a => `in ${a}`, join: ', ',
  },
}
// a form question → which need it answers
const Q = [
  ['budget', /תקציב|מחיר|budget|price/i],
  ['rooms', /חדר|rooms?\b/i],
  ['area', /אזור|עיר|ישוב|יישוב|שכונה|מיקום|area|city|location|neighbo/i],
  ['timeline', /מתי|זמן|כניסה|מועד|timeline|when|move/i],
  ['purpose', /מגורים|השקעה|מטרה|purpose|invest|for what/i],
  ['propertyType', /סוג.*נכס|סוג.*דירה|property type|type of/i],
  ['financing', /משכנתא|מימון|הון עצמי|mortgage|financ/i],
]
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim()

export function leadNeeds(lead = {}, lang = 'he') {
  const L = T[lang === 'en' ? 'en' : 'he']
  const crm = lead.crm_data && typeof lead.crm_data === 'object' ? lead.crm_data : {}
  const get = k => lead[k] ?? crm[k]
  const out = { budget: '', rooms: '', area: '', timeline: '', purpose: '', propertyType: '', message: '' }

  // 1. the form answers (Meta lead forms)
  const answers = Array.isArray(get('formAnswers')) ? get('formAnswers') : []
  for (const { q, a } of answers) {
    const hit = Q.find(([, re]) => re.test(String(q || '')))
    const v = clean(prettyAnswerValue(a, lang))
    if (hit && v && !out[hit[0]] && v.length <= 60) out[hit[0]] = v
  }
  // 2. what the office set in the lead card wins
  const budget = Number(String(get('budget') ?? '').replace(/[^\d.]/g, ''))
  if (budget > 10000) out.budget = L.budget(budget)
  const rooms = clean(get('rooms'))
  if (rooms) out.rooms = /^\d+(\.\d)?$/.test(rooms) ? L.rooms(rooms) : rooms
  const area = clean(get('area'))
  if (area) out.area = area
  const tl = get('timeline')
  if (tl && L.timeline[tl]) out.timeline = L.timeline[tl]
  const deal = get('dealType')
  if (deal && L.purpose[deal]) out.purpose = L.purpose[deal]
  const ptype = clean(get('propertyType'))
  if (ptype) out.propertyType = ptype
  if (out.rooms && /^\d+$/.test(out.rooms)) out.rooms = L.rooms(out.rooms)

  // 3. the visitor's own words (website forms): free text only — never the stored form-answers line of a Meta lead
  const isMeta = lead.source === 'meta' || !!crm.metaLeadId
  const msg = clean(get('msg') || lead.message)
  if (!isMeta && msg.length >= 8 && !/^[\w\s]+:\s*\w/.test(msg) && !/\b(rooms|budget)\s*:/i.test(msg)) {
    const first = msg.split(/(?<=[.!?])\s/)[0]
    out.message = (first.length > 140 ? first.slice(0, 137).replace(/\s+\S*$/, '') + '…' : first).replace(/[.!]+$/, '')
  }

  // one phrase: "4 חדרים, בהוד השרון, בתקציב של 3–4 מיליון"
  out.needs = [out.propertyType || '', out.rooms, out.area && L.inArea(out.area), out.budget && L.inBudget(out.budget)]
    .filter(Boolean).join(L.join)
  return out
}

// The most personal template that has something to say for this lead (null = nothing known)
export function bestPersonalTemplateId(lead = {}, lang = 'he') {
  const n = leadNeeds(lead, lang)
  if (n.message) return 'personal_message'
  if (n.purpose && /השקעה|invest/i.test(n.purpose)) return 'personal_investor'
  if (n.needs) return 'personal_needs'
  if (n.timeline) return 'personal_timeline'
  return null
}
