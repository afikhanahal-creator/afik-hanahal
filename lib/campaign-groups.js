// Campaigns in the Lead Center, the office's way (2026-11-18 — "let me pick campaigns and merge them, or change them in the Lead
// Center"). Meta names a campaign once per launch ("זרובבל 15 - 2#", a form "זרובבל 15 - v2 (כוונה גבוהה)"), so one project shows
// up as several campaigns. The office maps raw names to one display name: merge, rename, back to Meta's name, archive (an old
// campaign folds away in the lists; its leads stay everywhere). Pure and shared by the server (api/meta.js `campaign-names`,
// app_settings.lead_campaign_names) and the Lead Center (src/CampaignManager.jsx). Tested in campaign-groups.test.mjs.
//
// cfg = { names: { [raw campaign / form name]: display name }, archived: [display name] }

const MAX_NAMES = 600, MAX_ARCHIVED = 300
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f‎‏‪-‮]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
export const rawKey = s => clean(s, 200)
export const cleanLabel = s => clean(s, 60)

export function cleanCampaignCfg(v) {
  const src = v && typeof v === 'object' ? v : {}
  const names = {}
  let n = 0
  for (const [k, val] of Object.entries(src.names && typeof src.names === 'object' ? src.names : {})) {
    const key = rawKey(k), name = cleanLabel(val)
    if (!key || !name || n >= MAX_NAMES) continue
    names[key] = name; n++
  }
  const archived = [...new Set((Array.isArray(src.archived) ? src.archived : []).map(cleanLabel).filter(Boolean))].slice(0, MAX_ARCHIVED)
  return { names, archived }
}

/** The raw campaign of a Meta lead: its campaign, else its form */
export const rawCampaign = l => rawKey(l?.campaign_name || l?.form_name || '') || null

/** raw → what the Lead Center shows: the office's name, else Meta's short name (`short`), else the raw name */
export function campaignLabel(raw, cfg, short = s => s) {
  const k = rawKey(raw)
  if (!k) return null
  return cfg?.names?.[k] || cleanLabel(short(k)) || k
}

/**
 * The campaigns as the office sees them: one row per display name, the raw names inside it, counts and the newest lead.
 * Archived ones last; otherwise the newest lead first.
 */
export function campaignGroups(leads, cfg, { short = s => s, now = Date.now(), isTest = () => false } = {}) {
  const by = new Map()
  const archived = new Set(cfg?.archived || [])
  for (const l of leads || []) {
    if (isTest(l)) continue
    const raw = rawCampaign(l)
    if (!raw) continue
    const label = campaignLabel(raw, cfg, short)
    let g = by.get(label)
    if (!g) by.set(label, g = { label, raws: new Map(), count: 0, recent: 0, last: 0, renamed: false, archived: archived.has(label) })
    g.count++
    const ts = Date.parse(l.created_at) || 0
    if (now - ts < 30 * 864e5) g.recent++
    if (ts > g.last) g.last = ts
    const r = g.raws.get(raw) || { raw, count: 0, last: 0 }
    r.count++; if (ts > r.last) r.last = ts
    g.raws.set(raw, r)
    if (cfg?.names?.[raw]) g.renamed = true
  }
  return [...by.values()]
    .map(g => ({ ...g, raws: [...g.raws.values()].sort((a, b) => b.last - a.last) }))
    .sort((a, b) => (a.archived - b.archived) || (b.last - a.last) || (b.count - a.count))
}

/**
 * Changes, each safe to repeat:
 *  { op: 'map', raws: [...], name }   — every raw shows as `name` ('' = back to Meta's name)
 *  { op: 'archive', label, on }       — fold a campaign away / bring it back
 * A merge or a rename keeps the archive state with the name: the new name is archived only when every name it replaced was.
 */
export function applyCampaignOps(cfg0, ops) {
  const cfg = cleanCampaignCfg(cfg0)
  const names = { ...cfg.names }
  let archived = [...cfg.archived]
  for (const o of Array.isArray(ops) ? ops.slice(0, 50) : []) {
    if (!o || typeof o !== 'object') continue
    if (o.op === 'map') {
      const raws = (Array.isArray(o.raws) ? o.raws : []).map(rawKey).filter(Boolean).slice(0, 200)
      const name = cleanLabel(o.name)
      const before = [...new Set(raws.map(r => names[r] || null).filter(Boolean))]
      for (const r of raws) { if (name) names[r] = name; else delete names[r] }
      if (name && Array.isArray(o.from) && o.from.length) {
        const from = o.from.map(cleanLabel).filter(Boolean)
        const allArch = from.every(f => archived.includes(f))
        archived = archived.filter(a => !from.includes(a) || (allArch && a === name))
        if (allArch && !archived.includes(name)) archived.push(name)
        else if (!allArch) archived = archived.filter(a => a !== name)
      } else if (!name && before.length) {
        // names no raw uses any more leave the archive
        archived = archived.filter(a => !before.includes(a) || Object.values(names).includes(a))
      }
    } else if (o.op === 'archive') {
      const label = cleanLabel(o.label)
      if (!label) continue
      archived = archived.filter(a => a !== label)
      if (o.on) archived.push(label)
    }
  }
  return cleanCampaignCfg({ names, archived })
}

/** The ops that undo `ops` on `cfg` (for "בטל" right after a merge / rename / archive) */
export function invertCampaignOps(cfg0, ops) {
  const cfg = cleanCampaignCfg(cfg0)
  const out = []
  const touched = new Map()
  for (const o of Array.isArray(ops) ? ops : []) {
    if (o?.op === 'map') for (const r of (o.raws || []).map(rawKey).filter(Boolean)) if (!touched.has(r)) touched.set(r, cfg.names[r] || '')
  }
  const byName = new Map()
  for (const [r, n] of touched) { const a = byName.get(n) || []; a.push(r); byName.set(n, a) }
  for (const [name, raws] of byName) out.push({ op: 'map', raws, name })
  // the archive exactly as it was
  const labels = new Set([...(cfg.archived || [])])
  const after = applyCampaignOps(cfg, ops)
  for (const a of after.archived) if (!labels.has(a)) out.push({ op: 'archive', label: a, on: false })
  for (const a of labels) if (!after.archived.includes(a)) out.push({ op: 'archive', label: a, on: true })
  return out
}

/** A merge's suggested name: the selected campaign with the most leads */
export function mergeSuggestion(groups) {
  const g = [...(groups || [])].sort((a, b) => b.count - a.count || b.last - a.last)[0]
  return g ? g.label : ''
}
