// After a property is published, edited or removed:
//   1. refresh the public snapshot right away (lib/property-feed.js) — Render has just been woken by the save
//   2. if a Vercel Deploy Hook is configured (VERCEL_DEPLOY_HOOK_URL), rebuild the site, so the property gets
//      (or refreshes) its instant static landing page dist/p/<id>/ — at most once a minute
// Without the hook everything still works: newer properties are rendered by api/properties.js and edge-cached.
import { createFeed } from './property-feed.js'

const KEY = 'site_rebuild'

export async function propertiesChanged({
  renderUrl, supaUrl, supaKey, hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL || '',
  fetchImpl = fetch, minGapMs = 60000, now = Date.now,
} = {}) {
  const out = {}
  const feed = createFeed({ renderUrl, supaUrl, supaKey, fetchImpl, renderBudgetMs: 9000, renderTimeoutMs: 9000 })
  try { const r = await feed.getList(); out.snapshot = { source: r.source, count: r.list.length } }
  catch (e) { out.snapshot = { error: e.message } }

  if (!hookUrl) { out.rebuild = 'not-configured'; return out }
  const supaOk = !!(supaUrl && supaKey)
  const headers = extra => ({ apikey: supaKey, Authorization: `Bearer ${supaKey}`, Accept: 'application/json', ...extra })
  if (supaOk) {
    try {
      const r = await fetchImpl(`${supaUrl}/rest/v1/app_settings?key=eq.${KEY}&select=value`, { headers: headers(), signal: AbortSignal.timeout(4000) })
      const last = r.ok ? Number((await r.json())?.[0]?.value?.at || 0) : 0
      const wait = last + minGapMs - now()
      if (wait > 0) { out.rebuild = 'throttled'; out.retryInMs = wait; return out }
    } catch {}
  }
  try {
    const r = await fetchImpl(hookUrl, { method: 'POST', signal: AbortSignal.timeout(8000) })
    out.rebuild = r.ok ? 'triggered' : `hook HTTP ${r.status}`
  } catch (e) { out.rebuild = `hook error: ${e.message}` }
  if (supaOk && out.rebuild === 'triggered') {
    await fetchImpl(`${supaUrl}/rest/v1/app_settings?on_conflict=key`, {
      method: 'POST', headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ key: KEY, value: { at: now() }, updated_at: new Date(now()).toISOString() }), signal: AbortSignal.timeout(4000),
    }).catch(() => {})
  }
  return out
}
