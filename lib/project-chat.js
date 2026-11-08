// Which project a WhatsApp conversation is about (2026-11-08 — the office asked: "if there was a conversation with a lead, put
// them in the right project"). Pure and tested (project-chat.test.mjs); used by the server (lib/automations.js
// assignProjectsFromChats: CRM leads, every auto-tick) and the chats tab (a suggestion for a chat that isn't a lead yet).
//
// A project is recognised by its street (the words before its first number: "זרובבל 15" → "זרובבל", "רמחל 6-8 רעננה" →
// "רמחל") with its number(s) right after it, or by the street alone when no other project shares that street and no other
// number follows it ("הנרייטה סאלד" alone is ambiguous: three projects; "זרובבל 7" is another building). Each message counts a
// project once; the lead's own words weigh most, a message typed on the office phone next, an automatic one least. A project
// wins only when it is clearly ahead (≥ 2 points and twice the runner-up).
import { NONE, projectOfLead } from './projects.js'

const STOP = new Set(['פיקוח', 'בניה', 'בנייה', 'פרויקט', 'פרוייקט', 'דירה', 'דירות', 'בית', 'רחוב', 'שכונת', 'מגרש', 'project', 'copy'])
const PREFIX = '(?:^|[^\\p{L}\\p{N}])(?:[ובלמהשכ]{0,3})'
/** letters and digits only — quotes, geresh, niqqud and punctuation out ("רמח"ל" → "רמחל", "22-24" → "22 24") */
export const normText = s => String(s || '').normalize('NFKC').replace(/[֑-ׇ]/g, '').replace(/["'״׳`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase()
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** { id, street, nums: [..], re } per project name / alias; streets shared by several projects need their number */
export function projectKeys(projects = []) {
  const keys = []
  for (const p of projects) {
    if (!p || p.status === 'archived') continue
    for (const label of [p.name, ...(p.aliases || [])]) {
      const words = normText(label).split(' ').filter(Boolean)
      const i = words.findIndex(w => /^\d/.test(w))
      const street = (i < 0 ? words : words.slice(0, i)).filter(w => !/^\d/.test(w))
      const nums = i < 0 ? [] : words.slice(i).filter(w => /^\d+$/.test(w)).slice(0, 3)
      if (!street.length || street.join('').length < 3) continue
      if (street.every(w => STOP.has(w))) continue          // "פיקוח בניה 1" is a campaign name, not a place
      keys.push({ id: p.id, street: street.join(' '), nums })
    }
  }
  const owners = new Map()
  for (const k of keys) owners.set(k.street, new Set([...(owners.get(k.street) || []), k.id]))
  const seen = new Set()
  return keys.filter(k => { const s = `${k.id}|${k.street}|${k.nums}`; if (seen.has(s)) return false; seen.add(s); return true })
    .map(k => ({ ...k, shared: owners.get(k.street).size > 1, re: new RegExp(`${PREFIX}${esc(k.street)}(?![\\p{L}])((?:\\s+\\d+){0,2})`, 'gu') }))
}

/** The projects one text names → Set of ids */
export function projectsInText(text, keys) {
  const t = ' ' + normText(text) + ' ', out = new Set()
  for (const k of keys) {
    k.re.lastIndex = 0
    let m
    while ((m = k.re.exec(t))) {
      const after = (m[1] || '').trim().split(/\s+/).filter(Boolean)
      if (after.length && k.nums.length) { if (after.some(n => k.nums.includes(n))) out.add(k.id); continue }   // a number: it must be ours
      if (after.length && !k.nums.length) { out.add(k.id); continue }
      if (!k.shared) out.add(k.id)                                   // the street alone, and only one project lives on it
    }
  }
  return out
}

const WEIGHT = { in: 3, phone: 2, api: 1 }
/** messages: [{ direction: 'in' | 'out', by_api, body | text | message }] → { id, score, second, quote } | null */
export function projectFromChat(messages = [], projects = []) {
  const keys = projectKeys(projects)
  if (!keys.length) return null
  const score = new Map(), quote = new Map()
  for (const m of messages) {
    const text = m?.body ?? m?.text ?? m?.message ?? ''
    if (!text) continue
    const ids = projectsInText(text, keys)
    if (!ids.size) continue
    const w = m.direction === 'in' ? WEIGHT.in : m.by_api === false ? WEIGHT.phone : WEIGHT.api
    for (const id of ids) {
      score.set(id, (score.get(id) || 0) + w)
      if (!quote.has(id) || (m.direction === 'in' && !quote.get(id).in)) quote.set(id, { text: String(text).replace(/\s+/g, ' ').trim().slice(0, 120), in: m.direction === 'in' })
    }
  }
  const ranked = [...score].sort((a, b) => b[1] - a[1])
  if (!ranked.length) return null
  const [[id, best], next] = [ranked[0], ranked[1]]
  const second = next ? next[1] : 0
  if (best < 2 || best < second * 2) return null
  return { id, score: best, second, quote: quote.get(id)?.text || '' }
}

const crmOf = l => (l?.crm_data && typeof l.crm_data === 'object' ? l.crm_data : {})
/** Put by hand (or taken out by hand): the conversation never overrides it. A project set by an earlier conversation is ours. */
export function manualProject(lead) {
  const crm = crmOf(lead), id = lead?.projectId ?? crm.projectId
  if (!id) return false
  if (id === NONE) return true
  return !(crm.projectChat && crm.projectChat.id === id)
}

/** What the conversation says about this lead → { project, quote, from: current project name | '' } | null (nothing to change) */
export function chatProjectDecision(lead, messages, projects) {
  if (!lead || manualProject(lead)) return null
  const hit = projectFromChat(messages, projects)
  if (!hit) return null
  const project = (projects || []).find(p => p.id === hit.id)
  if (!project) return null
  const cur = projectOfLead(lead, projects)
  if (cur && cur.id === project.id) return null
  // the current project (its campaign) is still part of the conversation: a second project mentioned along the way doesn't move it
  if (cur) {
    const own = projectFromChat(messages, [cur])
    if (own && own.score * 2 > hit.score) return null
  }
  return { project, quote: hit.quote, from: cur ? cur.name : '' }
}

/** The crm_data patch + the lead's note for a decision */
export function chatProjectPatch(lead, d, now = new Date()) {
  const crm = crmOf(lead)
  const at = now.toISOString()
  const text = d.from
    ? `🔗 עבר לפרויקט ${d.project.name} (במקום ${d.from}) לפי השיחה בוואטסאפ${d.quote ? `: "${d.quote}"` : ''}`
    : `🔗 שויך לפרויקט ${d.project.name} לפי השיחה בוואטסאפ${d.quote ? `: "${d.quote}"` : ''}`
  const notes = Array.isArray(crm.notes) ? crm.notes : []
  return {
    projectId: d.project.id,
    projectName: d.project.name,
    projectChat: { id: d.project.id, at, quote: d.quote || '', from: d.from || '' },
    notes: [{ id: `n${now.getTime().toString(36)}pc`, text, ts: now.getTime(), kind: 'auto' }, ...notes],
  }
}
