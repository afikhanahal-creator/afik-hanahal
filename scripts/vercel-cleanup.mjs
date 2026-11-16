// Deletes old Vercel deployments of EVERY project the token sees (the Afik Hanahal site, Kurkoos and any later one share the
// team's 10 GB of Deployment Storage), so the free plan never fills up — rules in lib/vercel-cleanup.js.
// Run by .github/workflows/vercel-cleanup.yml twice a day. Needs VERCEL_TOKEN (vercel.com → Account Settings → Tokens; scope:
// the team afik-hanahal-s-projects). Optional: VERCEL_TEAM_ID, VERCEL_PROJECT (comma-separated names / ids = only those),
// DRY_RUN=1 (only count). The repository is public: the log prints project names and counts only.
import { pickDeletions, summarize, pickProjects, CLEANUP_DEFAULTS } from '../lib/vercel-cleanup.js'

const TOKEN = process.env.VERCEL_TOKEN
const DRY = /^(1|true|yes)$/i.test(process.env.DRY_RUN || '')
const API = 'https://api.vercel.com'
// without the key nothing is ever deleted: the run fails, so GitHub tells the owner (it used to pass quietly for two weeks)
if (!TOKEN) { console.log('::error::VERCEL_TOKEN is not set — no deployment is deleted and Deployment Storage keeps growing. Add it under Settings → Secrets and variables → Actions.'); process.exit(1) }

const q = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString()
async function api(path, params = {}, method = 'GET') {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${API}${path}?${q(params)}`, { method, headers: { Authorization: `Bearer ${TOKEN}` } })
    if (r.status === 429) { await new Promise(s => setTimeout(s, 2000 * (i + 1))); continue }
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`${method} ${path.replace(/dpl_\w+/, 'dpl_…')}: HTTP ${r.status} ${body?.error?.code || ''}`)
    return body
  }
  throw new Error(`${method} ${path}: rate limited`)
}

async function teams() {
  if (process.env.VERCEL_TEAM_ID) return [process.env.VERCEL_TEAM_ID]
  const t = ((await api('/v2/teams', { limit: 50 }).catch(() => ({ teams: [] }))).teams || []).map(x => x.id)
  return t.length ? t : [null]       // a token scoped to one team lists it; a personal one has no team
}

let deleted = 0, failed = 0, projects = 0
for (const teamId of await teams()) {
  const { projects: list = [] } = await api('/v9/projects', { teamId, limit: 100 }).catch(() => ({}))
  for (const p of pickProjects(list, process.env.VERCEL_PROJECT)) {
    projects++
    const all = []
    let until
    for (let page = 0; page < 30; page++) {
      const r = await api('/v6/deployments', { projectId: p.id, teamId, limit: 100, until })
      all.push(...(r.deployments || []))
      until = r.pagination?.next
      if (!until) break
    }
    const dels = pickDeletions(all, Date.now(), CLEANUP_DEFAULTS)
    console.log(JSON.stringify({ project: p.name, dryRun: DRY, ...summarize(all, dels) }))
    if (DRY) continue
    for (const d of dels.slice(0, 400)) {
      try { await api(`/v13/deployments/${d.id}`, { teamId }, 'DELETE'); deleted++ } catch (e) { failed++; if (failed <= 3) console.log(String(e.message)) }
      await new Promise(s => setTimeout(s, 250))
    }
  }
}
if (!projects) { console.log('::error::no Vercel project was found with this token (check its scope / VERCEL_TEAM_ID)'); process.exit(1) }
console.log(JSON.stringify({ projects, deleted, failed }))
if (failed && !deleted) process.exit(1)
