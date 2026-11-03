// Projects (deals): the properties / projects the office works on in parallel ("זרובבל 15", "נווה עוז"). Every lead can belong to
// one. Pure and tested (projects.test.mjs); used by the leads board (src/LeadProjects.jsx, src/LeadsBoard.jsx), the lead card and
// the server (api/meta.js projects, stored in app_settings 'lead_projects').
//
// A project: { id: 'p_…', name, color, town, status: 'active' | 'archived', aliases: [campaign / listing names that join it by
// themselves], createdAt }. A lead's project is, in order: the one it was put in by hand (crm_data.projectId — the lead also keeps
// projectName, so templates and the server can say it without the list); else the project whose name or alias matches the lead's
// campaign short name / listing (sameProject); else none.
import { sameProject } from './automations-shared.js'
import { leadProject } from '../src/lib/leadFields.js'

export const PROJECT_COLORS = ['#3B82F6', '#16A34A', '#D97706', '#9333EA', '#DC2626', '#0891B2', '#DB2777', '#65A30D', '#4F46E5', '#B45309']
export const PROJECTS_MAX = 60
export const NONE = '__none'
const str = (v, n) => String(v ?? '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, n)

/** One clean project (null for junk) */
export function cleanProject(p) {
  if (!p || typeof p !== 'object') return null
  const id = /^p_[a-z0-9]{3,20}$/.test(String(p.id || '')) ? String(p.id) : ''
  const name = str(p.name, 60)
  if (!id || !name) return null
  const color = /^#[0-9a-f]{6}$/i.test(String(p.color || '')) ? String(p.color) : PROJECT_COLORS[0]
  const aliases = [...new Set((Array.isArray(p.aliases) ? p.aliases : []).map(a => str(a, 80)).filter(Boolean))].slice(0, 12)
  return { id, name, color, town: str(p.town, 40), status: p.status === 'archived' ? 'archived' : 'active', aliases, createdAt: Number(p.createdAt) || 0, ...(p.note ? { note: str(p.note, 300) } : {}) }
}
/** The stored list → clean, unique ids and names, at most PROJECTS_MAX */
export function cleanProjects(list) {
  const out = [], ids = new Set(), names = []
  for (const p of Array.isArray(list) ? list : []) {
    const c = cleanProject(p)
    if (!c || ids.has(c.id) || names.some(n => sameProject(n, c.name))) continue
    ids.add(c.id); names.push(c.name); out.push(c)
    if (out.length >= PROJECTS_MAX) break
  }
  return out
}

/** A new project (the next unused color) — throws a readable error for an empty or taken name */
export function newProject({ name, color, town = '', aliases = [] } = {}, existing = [], now = Date.now()) {
  const n = str(name, 60)
  if (!n) throw new Error('צריך שם לפרויקט')
  if ((existing || []).some(p => sameProject(p.name, n))) throw new Error(`כבר יש פרויקט בשם "${n}"`)
  const used = new Set((existing || []).map(p => p.color))
  const c = /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : (PROJECT_COLORS.find(x => !used.has(x)) || PROJECT_COLORS[(existing || []).length % PROJECT_COLORS.length])
  return cleanProject({ id: `p_${now.toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: n, color: c, town, aliases, status: 'active', createdAt: now })
}

const crmOf = l => (l?.crm_data && typeof l.crm_data === 'object' ? l.crm_data : {})
/** The lead's project: put there by hand, else matched by its campaign / listing; null = none */
export function projectOfLead(lead, projects) {
  const list = Array.isArray(projects) ? projects : []
  const id = lead?.projectId ?? crmOf(lead).projectId
  if (id === NONE) return null                                   // taken out of every project by hand
  if (id) { const p = list.find(x => x.id === id); if (p) return p }
  const auto = leadProject(lead)
  if (!auto) return null
  return list.find(p => p.status !== 'archived' && (sameProject(p.name, auto) || p.aliases.some(a => sameProject(a, auto)))) || null
}
/** How the lead got its project: 'manual' | 'auto' | '' */
export function projectHow(lead, projects) {
  const id = lead?.projectId ?? crmOf(lead).projectId
  const p = projectOfLead(lead, projects)
  if (!p) return ''
  return id === p.id ? 'manual' : 'auto'
}
/** The patch that puts a lead in a project (null = out of every project, even an automatic one) */
export const assignPatch = project => (project ? { projectId: project.id, projectName: project.name } : { projectId: NONE, projectName: '' })

/** Leads per project: { [id]: { total, open, byStage: { stage: n } }, none: { … } } — open = not won / lost / irrelevant */
const CLOSED = new Set(['won', 'lost', 'irrelevant'])
export function projectCounts(leads, projects) {
  const out = { [NONE]: { total: 0, open: 0, byStage: {} } }
  for (const p of projects || []) out[p.id] = { total: 0, open: 0, byStage: {} }
  for (const l of leads || []) {
    const p = projectOfLead(l, projects)
    const c = out[p ? p.id : NONE]
    const st = l.leadStatus || crmOf(l).leadStatus || 'new'
    c.total++; if (!CLOSED.has(st)) c.open++
    c.byStage[st] = (c.byStage[st] || 0) + 1
  }
  return out
}
/** Filter by a project id ('' = all, NONE = without a project) */
export function filterByProject(leads, projects, id) {
  if (!id) return leads
  return (leads || []).filter(l => { const p = projectOfLead(l, projects); return id === NONE ? !p : p?.id === id })
}
/** Campaigns / listings the leads came from that no project covers yet, the busiest first — "create a project from it" */
export function projectSuggestions(leads, projects, max = 6) {
  const n = new Map()
  for (const l of leads || []) {
    if (projectOfLead(l, projects)) continue
    const id = l?.projectId ?? crmOf(l).projectId
    if (id === NONE) continue
    const name = leadProject(l)
    if (!name) continue
    const key = [...n.keys()].find(k => sameProject(k, name)) || name
    n.set(key, (n.get(key) || 0) + 1)
  }
  return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([name, count]) => ({ name, count }))
}

/** Campaigns / listings with at least `min` leads that no project covers and were never made into one (autoDone) → the new
 *  projects to create by themselves (the board makes them once, so "זרובבל 15" is there without anyone typing it) */
export function autoProjects(leads, projects, autoDone = [], { min = 3, now = Date.now() } = {}) {
  const out = []
  for (const s of projectSuggestions(leads, projects, 40)) {
    if (s.count < min || (autoDone || []).some(n => sameProject(n, s.name))) continue
    if (/^(אתר|website|meta|פייסבוק|facebook|instagram|אינסטגרם|ידני|manual)$/i.test(s.name.trim())) continue
    try { out.push(newProject({ name: s.name, aliases: [s.name] }, [...(projects || []), ...out], now + out.length)) } catch { /* a taken name */ }
  }
  return out
}
