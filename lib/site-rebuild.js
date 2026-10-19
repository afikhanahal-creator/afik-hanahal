// After a property is published, edited or removed:
//   0. copy into the properties table whatever Render / the snapshot has that it lacks (feed.reconcile)
//   1. refresh the public snapshot right away (lib/property-feed.js) — Render has just been woken by the save
//   2. if a Vercel Deploy Hook is configured (VERCEL_DEPLOY_HOOK_URL), rebuild the site, so the property gets
//      (or refreshes) its instant static landing page dist/p/<id>/ — only when the published list really changed
//      (its hash differs from the last rebuild's) and at most once every 2 hours: every deployment is kept by Vercel and
//      counts toward the Hobby plan's 10 GB of Deployment Storage. A change that waits is picked up by the next save or
//      by the daily cron (api/cron/warm.js); meanwhile the app shows the live data over the static layer anyway.
//      `force` (the probe's "rebuild" action) skips both checks.
// Without the hook everything still works: newer properties are rendered by api/properties.js and edge-cached.
import { createHash } from 'node:crypto'
import { createFeed } from './property-feed.js'
import { slimList } from './slim-photos.js'

const KEY = 'site_rebuild'

export async function propertiesChanged({
  renderUrl, supaUrl, supaKey, hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL || '',
  fetchImpl = fetch, minGapMs = 2 * 3600e3, now = Date.now, force = false,
  transformList = fetchImpl === fetch && supaUrl && supaKey ? list => slimList(list, { supaUrl, supaKey }).then(r => r.list) : null,
} = {}) {
  const out = {}
  const feed = createFeed({ renderUrl, supaUrl, supaKey, fetchImpl, renderBudgetMs: 9000, renderTimeoutMs: 9000, transformList })
  // Anything Render (or the last snapshot) has that the properties table lacks is copied in first — Render's own
  // write to the table fails silently, and a restart would lose those properties (lib/property-store.js)
  try { out.reconcile = await feed.reconcile({ renderTimeout: 9000 }) } catch (e) { out.reconcile = { error: e.message } }
  let hash = ''
  try {
    const r = await feed.getList(); out.snapshot = { source: r.source, count: r.list.length }
    hash = createHash('sha1').update(JSON.stringify(r.list)).digest('hex')
  } catch (e) { out.snapshot = { error: e.message } }

  if (!hookUrl) { out.rebuild = 'not-configured'; return out }
  const supaOk = !!(supaUrl && supaKey)
  const headers = extra => ({ apikey: supaKey, Authorization: `Bearer ${supaKey}`, Accept: 'application/json', ...extra })
  if (supaOk) {
    try {
      const r = await fetchImpl(`${supaUrl}/rest/v1/app_settings?key=eq.${KEY}&select=value`, { headers: headers(), signal: AbortSignal.timeout(4000) })
      const v = r.ok ? (await r.json())?.[0]?.value || {} : {}
      if (!force && hash && v.hash === hash) { out.rebuild = 'unchanged'; return out }
      const wait = Number(v.at || 0) + minGapMs - now()
      if (!force && wait > 0) { out.rebuild = 'throttled'; out.retryInMs = wait; return out }
    } catch {}
  }
  try {
    const r = await fetchImpl(hookUrl, { method: 'POST', signal: AbortSignal.timeout(8000) })
    out.rebuild = r.ok ? 'triggered' : `hook HTTP ${r.status}`
  } catch (e) { out.rebuild = `hook error: ${e.message}` }
  if (supaOk && out.rebuild === 'triggered') {
    await fetchImpl(`${supaUrl}/rest/v1/app_settings?on_conflict=key`, {
      method: 'POST', headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ key: KEY, value: { at: now(), hash }, updated_at: new Date(now()).toISOString() }), signal: AbortSignal.timeout(4000),
    }).catch(() => {})
  }
  return out
}
