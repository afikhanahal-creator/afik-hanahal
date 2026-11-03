// The projects list for every screen (the leads board, the lead card, the new-lead dialog): read once from
// GET /api/meta/projects, kept in memory + localStorage (drawn at once on the next visit), saved with POST (the server merges
// by id). useProjects() re-renders on every change. Rules: lib/projects.js.
import { useEffect, useState } from 'react'
import { cleanProjects } from '../../lib/projects.js'

const KEY = 'afik_lead_projects_v1'
const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer AFIKhanahal2026' }
let list = (() => { try { return cleanProjects(JSON.parse(localStorage.getItem(KEY) || '[]')) } catch { return [] } })()
let autoDone = []
let loaded = false, loading = null
const subs = new Set()
const emit = () => { try { localStorage.setItem(KEY, JSON.stringify(list)) } catch {} subs.forEach(f => f(list)) }

export function loadProjects(force = false) {
  if ((loaded && !force) || loading) return loading || Promise.resolve(list)
  loading = fetch('/api/meta/projects', { headers: AUTH, signal: AbortSignal.timeout(12000) })
    .then(r => (r.ok ? r.json() : null)).then(d => { if (d?.projects) { list = cleanProjects(d.projects); autoDone = Array.isArray(d.autoDone) ? d.autoDone : []; loaded = true; emit() } return list })
    .catch(() => list).finally(() => { loading = null })
  return loading
}
export const getProjects = () => list
export const projectsLoaded = () => loaded
export const getAutoDone = () => autoDone

/** Save the whole list (removed = ids to delete) → the saved list; throws a readable error */
export async function saveProjects(next, removed = [], { auto = [] } = {}) {
  const before = list
  list = cleanProjects(next); emit()                // at once on screen
  const r = await fetch('/api/meta/projects', { method: 'POST', headers: AUTH, body: JSON.stringify({ projects: list, removed, ...(auto.length ? { autoDone: auto } : {}) }), signal: AbortSignal.timeout(15000) }).catch(() => null)
  const d = r ? await r.json().catch(() => ({})) : {}
  if (!r?.ok || !d.projects) { list = before; emit(); throw new Error(d.error || 'השמירה נכשלה, נסו שוב') }
  list = cleanProjects(d.projects); if (Array.isArray(d.autoDone)) autoDone = d.autoDone; loaded = true; emit()
  return list
}

export function useProjects() {
  const [v, setV] = useState(list)
  useEffect(() => { subs.add(setV); loadProjects(); return () => subs.delete(setV) }, [])
  return v
}
