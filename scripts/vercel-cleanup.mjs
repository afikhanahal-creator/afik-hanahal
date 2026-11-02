// Deletes old Vercel deployments so Deployment Storage (Hobby: 10 GB) never fills up — rules in lib/vercel-cleanup.js.
// Run by .github/workflows/vercel-cleanup.yml every day. Needs VERCEL_TOKEN (vercel.com → Account Settings → Tokens; scope:
// the team that owns the project). Optional: VERCEL_TEAM_ID, VERCEL_PROJECT (else the project linked to this repository is
// found by itself), DRY_RUN=1 (only count). The repository is public: the log prints counts only.
import { pickDeletions, summarize, CLEANUP_DEFAULTS } from '../lib/vercel-cleanup.js'

const TOKEN = process.env.VERCEL_TOKEN
const REPO = (process.env.GITHUB_REPOSITORY || 'afikhanahal-creator/afik-hanahal').split('/')[1]
const DRY = /^(1|true|yes)$/i.test(process.env.DRY_RUN || '')
const API = 'https://api.vercel.com'
if (!TOKEN) { console.log('VERCEL_TOKEN is not set — nothing to do (add it under Settings → Secrets → Actions).'); process.exit(0) }

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

async function findProject() {
  const teams = process.env.VERCEL_TEAM_ID ? [process.env.VERCEL_TEAM_ID]
    : [null, ...((await api('/v2/teams', { limit: 50 }).catch(() => ({ teams: [] }))).teams || []).map(t => t.id)]
  for (const teamId of teams) {
    if (process.env.VERCEL_PROJECT) {
      const p = await api(`/v9/projects/${encodeURIComponent(process.env.VERCEL_PROJECT)}`, { teamId }).catch(() => null)
      if (p?.id) return { teamId, projectId: p.id }
      continue
    }
    const { projects = [] } = await api('/v9/projects', { teamId, limit: 100 }).catch(() => ({}))
    const p = projects.find(x => x?.link?.repo === REPO) || projects.find(x => x?.name === REPO)
    if (p) return { teamId, projectId: p.id }
  }
  throw new Error('the Vercel project of this repository was not found with this token (check its scope / VERCEL_TEAM_ID)')
}

const { teamId, projectId } = await findProject()
const all = []
let until
for (let page = 0; page < 30; page++) {
  const r = await api('/v6/deployments', { projectId, teamId, limit: 100, until })
  all.push(...(r.deployments || []))
  until = r.pagination?.next
  if (!until) break
}
const dels = pickDeletions(all, Date.now(), CLEANUP_DEFAULTS)
console.log(JSON.stringify({ dryRun: DRY, ...summarize(all, dels) }))
if (DRY) process.exit(0)
let ok = 0, failed = 0
for (const d of dels.slice(0, 400)) {
  try { await api(`/v13/deployments/${d.id}`, { teamId }, 'DELETE'); ok++ } catch (e) { failed++; if (failed <= 3) console.log(String(e.message)) }
  await new Promise(s => setTimeout(s, 250))
}
console.log(JSON.stringify({ deleted: ok, failed }))
if (failed && !ok) process.exit(1)
