// Supabase free plan (the org was moved back to Free on 2026-11-05; its quota ran out once, on 2026-10-18 at 6.26 GB).
// The quotas the database can measure itself — the database size and the files in Storage — plus the one thing that turned
// file downloads into repeat egress: public files without a long cache header. Pure: the cron (api/cron/warm.js
// supabaseWatch) reads `public.afik_usage()` (server/usage-watch-migration.sql) and sends the office one WhatsApp a day while
// something is over its line. Egress itself is only on Supabase's dashboard (Usage); its rules live in CLAUDE.md.
// The quota is per ORGANIZATION, not per project: on 2026-11-06 the Kurkoos project (930 MB of ad captures) and this one
// (305 MB) shared one org, passed 1.1 GB together, and Supabase answered 402 to both — while this watch, which only saw its
// own 305 MB, stayed quiet. So every project the office runs is watched (`WATCHED` in api/cron/warm.js), a 402 is an alert
// of its own, and an upload is refused before it would push a project past `UPLOAD_STOP_AT`.
export const FREE_LIMITS = { db: 500 * 1048576, storage: 1024 * 1048576 }
export const WARN_AT = 0.7
export const UPLOAD_STOP_AT = 0.9

const mb = b => `${Math.round((Number(b) || 0) / 1048576)} MB`

/** usage (afik_usage()) → [problem text] in Hebrew for the office; empty = all fine */
export function usageProblems(u, { limits = FREE_LIMITS, warnAt = WARN_AT, label = '' } = {}) {
  if (!u || typeof u !== 'object') return []
  const out = []
  const at = label ? `${label}: ` : ''
  if (u.db_bytes > limits.db * warnAt) out.push(`${at}מסד הנתונים תופס ${mb(u.db_bytes)} מתוך ${mb(limits.db)} בתוכנית החינמית`)
  if (u.storage_bytes > limits.storage * warnAt) {
    const top = Object.entries(u.buckets || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${mb(v)}`).join(', ')
    out.push(`${at}הקבצים ב-Storage תופסים ${mb(u.storage_bytes)} מתוך ${mb(limits.storage)}${top ? ` (${top})` : ''}`)
  }
  return out
}

/** One line for the admin / probe: "DB 28 MB / 500 · קבצים 286 MB / 1024 · 119 קבצים בלי מטמון" */
export function usageSummary(u, { limits = FREE_LIMITS } = {}) {
  if (!u) return ''
  return [`DB ${mb(u.db_bytes)} / ${mb(limits.db)}`, `Storage ${mb(u.storage_bytes)} / ${mb(limits.storage)}`, u.short_cache_files ? `${u.short_cache_files} files without a long cache (${mb(u.short_cache_bytes)})` : 'every public file cached'].join(' · ')
}

/** An HTTP status from the usage call → the problem it means, or null. 402 = Supabase restricted the org (a quota ran out):
 *  every request of the site and the admin fails until it is lifted, so the office hears about it the same day. */
export function statusProblem(status, label = '') {
  const at = label ? `${label}: ` : ''
  if (status === 402) return `${at}Supabase חוסם את הפרויקט (חריגה ממכסה) — האתר, הלידים והאוטומציות לא עובדים. לפנות מקום או לשדרג: https://supabase.com/dashboard/org/_/usage`
  return null
}

/** Would a new file of `size` bytes push the project past `stopAt` of the free Storage quota? Unknown usage = allowed
 *  (a failed check never blocks the office). → { ok, error? } in Hebrew. */
export function uploadAllowed(u, size, { limits = FREE_LIMITS, stopAt = UPLOAD_STOP_AT } = {}) {
  const used = Number(u && u.storage_bytes)
  if (!Number.isFinite(used) || used <= 0) return { ok: true }
  const cap = limits.storage * stopAt
  if (used + (Number(size) || 0) <= cap) return { ok: true }
  return { ok: false, error: `אין מקום לקובץ: האחסון תפוס ${mb(used)} מתוך ${mb(limits.storage)} בתוכנית החינמית. סרטון ארוך עדיף להעלות ליוטיוב ולהוסיף קישור, או למחוק קבצים ישנים.` }
}
