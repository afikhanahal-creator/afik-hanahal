// Which Vercel deployments to delete so Deployment Storage (Hobby: 10 GB, every kept deployment counts) never fills up.
// Pure — scripts/vercel-cleanup.mjs lists the project's deployments through the Vercel API and deletes what this returns,
// daily from .github/workflows/vercel-cleanup.yml (needs the VERCEL_TOKEN secret). Rules:
// - production: keep the newest `keepProd` ready ones (the live one and a few to roll back to) and everything younger than
//   `prodDays`; delete the rest;
// - preview: delete when older than `previewDays`;
// - errored / canceled: delete when older than `failedDays`;
// - never touch one that is still building / queued, or one without an id or a time.

const DAY = 864e5
export const CLEANUP_DEFAULTS = { keepProd: 5, prodDays: 7, previewDays: 1, failedDays: 1 }

const stateOf = d => String(d.readyState || d.state || '').toUpperCase()
const timeOf = d => Number(d.created || d.createdAt || 0)
const isProd = d => String(d.target || '').toLowerCase() === 'production'

export function pickDeletions(deployments = [], now = Date.now(), opts = {}) {
  const o = { ...CLEANUP_DEFAULTS, ...opts }
  const list = (Array.isArray(deployments) ? deployments : []).filter(d => d && (d.uid || d.id) && timeOf(d) > 0)
  const keep = new Set(
    list.filter(d => isProd(d) && stateOf(d) === 'READY').sort((a, b) => timeOf(b) - timeOf(a)).slice(0, Math.max(1, o.keepProd)).map(d => d.uid || d.id)
  )
  const out = []
  for (const d of list) {
    const id = d.uid || d.id
    const st = stateOf(d)
    const age = now - timeOf(d)
    if (keep.has(id)) continue
    if (['BUILDING', 'QUEUED', 'INITIALIZING'].includes(st)) continue
    let why = ''
    if (st === 'ERROR' || st === 'CANCELED') { if (age > o.failedDays * DAY) why = st.toLowerCase() }
    else if (isProd(d)) { if (st === 'READY' && age > o.prodDays * DAY) why = 'old-production' }
    else if (age > o.previewDays * DAY) why = 'old-preview'
    if (why) out.push({ id, why, created: timeOf(d) })
  }
  return out
}

/** Counts for the log (the repository is public: no URLs, no ids) */
export function summarize(deployments = [], deletions = []) {
  const by = {}
  for (const d of deletions) by[d.why] = (by[d.why] || 0) + 1
  return { total: (deployments || []).length, delete: deletions.length, keep: (deployments || []).length - deletions.length, by }
}
