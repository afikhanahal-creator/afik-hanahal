// Supabase free plan (the org was moved back to Free on 2026-11-05; its quota ran out once, on 2026-10-18 at 6.26 GB).
// The quotas the database can measure itself — the database size and the files in Storage — plus the one thing that turned
// file downloads into repeat egress: public files without a long cache header. Pure: the cron (api/cron/warm.js
// supabaseWatch) reads `public.afik_usage()` (server/usage-watch-migration.sql) and sends the office one WhatsApp a day while
// something is over its line. Egress itself is only on Supabase's dashboard (Usage); its rules live in CLAUDE.md.
export const FREE_LIMITS = { db: 500 * 1048576, storage: 1024 * 1048576 }
export const WARN_AT = 0.7

const mb = b => `${Math.round((Number(b) || 0) / 1048576)} MB`

/** usage (afik_usage()) → [problem text] in Hebrew for the office; empty = all fine */
export function usageProblems(u, { limits = FREE_LIMITS, warnAt = WARN_AT } = {}) {
  if (!u || typeof u !== 'object') return []
  const out = []
  if (u.db_bytes > limits.db * warnAt) out.push(`מסד הנתונים תופס ${mb(u.db_bytes)} מתוך ${mb(limits.db)} בתוכנית החינמית`)
  if (u.storage_bytes > limits.storage * warnAt) {
    const top = Object.entries(u.buckets || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${mb(v)}`).join(', ')
    out.push(`הקבצים ב-Storage תופסים ${mb(u.storage_bytes)} מתוך ${mb(limits.storage)}${top ? ` (${top})` : ''}`)
  }
  return out
}

/** One line for the admin / probe: "DB 28 MB / 500 · קבצים 286 MB / 1024 · 119 קבצים בלי מטמון" */
export function usageSummary(u, { limits = FREE_LIMITS } = {}) {
  if (!u) return ''
  return [`DB ${mb(u.db_bytes)} / ${mb(limits.db)}`, `Storage ${mb(u.storage_bytes)} / ${mb(limits.storage)}`, u.short_cache_files ? `${u.short_cache_files} files without a long cache (${mb(u.short_cache_bytes)})` : 'every public file cached'].join(' · ')
}
