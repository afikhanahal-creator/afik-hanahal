// Extra email recipients per campaign (2026-11-22 — the office: "every lead that comes in now from the Henrietta Szold campaign
// goes to this email too"). A route = { id, match, to: [emails] }: a new Meta lead whose campaign / form name — or the name the office
// gave that campaign in the Lead Center (lib/campaign-groups.js) — contains `match` (quotes, dashes, # and case ignored) is emailed
// to those addresses too, as Bcc on the office's own new-lead email (sendMetaLeadEmail in api/meta.js), so no recipient sees another.
// The addresses live only in app_settings.lead_email_routes (never in the repository). Pure; tested in lead-email-routes.test.mjs.

const MAX_ROUTES = 50, MAX_TO = 10
const EMAIL = /^[^\s@<>()",;]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/

/** "הנרייטה סאלד 4 - v2 (כוונה גבוהה)" → "הנרייטה סאלד 4 v2 כוונה גבוהה" — the text a route is matched on */
export const normCampaign = s => String(s ?? '')
  .replace(/[‎‏‪-‮]/g, '')
  .replace(/["'״׳`]/g, '')
  .replace(/[-–—_|·•#()[\]{}.,:;!?/\\]+/g, ' ')
  .replace(/\s+/g, ' ').trim().toLowerCase()

export const cleanEmail = s => { const e = String(s ?? '').trim().toLowerCase(); return EMAIL.test(e) ? e : '' }

/** A list of addresses typed any way ("a@x.com, b@y.com" / one per line) → unique valid addresses */
export function parseEmails(v) {
  const parts = Array.isArray(v) ? v : String(v ?? '').split(/[\s,;]+/)
  return [...new Set(parts.map(cleanEmail).filter(Boolean))].slice(0, MAX_TO)
}

export function cleanEmailRoutes(v) {
  const out = []
  for (const r of Array.isArray(v) ? v : []) {
    if (!r || typeof r !== 'object') continue
    const match = String(r.match ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
    const to = parseEmails(r.to)
    if (!normCampaign(match) || !to.length) continue
    const id = /^[a-z0-9_-]{1,24}$/i.test(String(r.id || '')) ? String(r.id) : 'r_' + normCampaign(match).replace(/[^a-z0-9֐-׿]+/g, '').slice(0, 12)
    if (out.some(x => x.id === id)) continue
    out.push({ id, match, to, on: r.on !== false })
    if (out.length >= MAX_ROUTES) break
  }
  return out
}

/**
 * The extra addresses for a lead: every route that is on and whose match is inside the campaign, the form or the office's name for the
 * campaign. `exclude` = the addresses already on the email (the office's own), never repeated.
 */
export function routeRecipients(routes, { campaign = '', form = '', label = '' } = {}, exclude = []) {
  const hay = [campaign, form, label].map(normCampaign).filter(Boolean)
  if (!hay.length) return []
  const skip = new Set((exclude || []).map(cleanEmail).filter(Boolean))
  const out = []
  for (const r of cleanEmailRoutes(routes)) {
    if (!r.on) continue
    const m = normCampaign(r.match)
    if (!hay.some(h => h.includes(m))) continue
    for (const e of r.to) if (!skip.has(e) && !out.includes(e)) out.push(e)
  }
  return out
}

/** For a screen / a log: "sk…@gmail.com" */
export const maskEmail = e => { const [u, d] = String(e || '').split('@'); return d ? `${u.slice(0, 2)}…@${d}` : '' }
