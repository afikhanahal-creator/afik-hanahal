// Restoring deleted leads (the leads board's trash and "בטל" after a delete). A delete removes the row from `contacts`; the
// admin keeps the whole lead in this browser's trash (LEADS_TRASH, the board's flattened shape: columns + crm_data spread on
// top). restoreRow() turns it back into the very same database row — same id, created_at, stage, notes, tasks, form answers —
// so a restore is not a new lead: no new-lead email, no WhatsApp welcome, no automations (POST /api/contacts?restore=1).
// Pure; tested in lead-restore.test.mjs.

// the board's top-level fields that are columns (or derived), never part of crm_data
const NOT_CRM = new Set(['id', 'name', 'phone', 'email', 'msg', 'message', 'propTitle', 'propLocation', 'prop_title', 'prop_location',
  'source', 'ts', 'updatedAt', 'updated_at', 'created_at', 'lead_status', 'deletedAt', 'crm_data'])

/** a trashed board lead → a `contacts` row; null when it can't be one (no numeric id: a browser-only copy) */
export function restoreRow(lead) {
  if (!lead || typeof lead !== 'object') return null
  const id = String(lead.id ?? '').trim()
  if (!/^\d{1,18}$/.test(id)) return null
  const crm = { ...(lead.crm_data && typeof lead.crm_data === 'object' ? lead.crm_data : {}) }
  for (const [k, v] of Object.entries(lead)) if (!NOT_CRM.has(k) && v !== undefined) crm[k] = v
  const ts = Number(lead.ts) || Date.parse(lead.created_at || '') || 0
  const str = v => (v == null || v === '' ? null : String(v))
  return {
    id: Number(id),
    name: str(lead.name),
    phone: str(lead.phone),
    email: str(lead.email),
    message: str(lead.msg ?? lead.message),
    prop_title: str(lead.propTitle ?? lead.prop_title),
    prop_location: str(lead.propLocation ?? lead.prop_location),
    source: str(lead.source) || 'website',
    created_at: new Date(ts || Date.now()).toISOString(),   // every row has the same keys (a bulk upsert needs that)
    lead_status: str(crm.leadStatus) || 'new',
    crm_data: crm,
  }
}

/** the trash grouped into deletions: leads deleted within `gap` of each other are one batch (a bulk delete), newest first */
export function trashBatches(trash, gap = 90e3) {
  const list = (Array.isArray(trash) ? trash : []).filter(Boolean).slice().sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
  const out = []
  for (const l of list) {
    const last = out[out.length - 1]
    const at = l.deletedAt || 0
    if (last && at && last.oldest - at <= gap) { last.leads.push(l); last.oldest = at }
    else out.push({ at, oldest: at, leads: [l] })
  }
  return out.map(({ at, leads }) => ({ at, leads }))
}
