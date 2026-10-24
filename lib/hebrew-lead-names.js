// The safety net behind "every new lead's name is in Hebrew": the webhook, the Meta sync, the website form and the booking
// already save a Latin name in Hebrew (lib/hebrew-names.js hebrewFullName); auto-tick / auto-run also convert whatever recent
// lead still has one — a lead saved by an older deploy, a path that missed it, a name typed in Latin by hand in the admin.
import { hebrewFullName, isLatinName } from './hebrew-names.js'

/** row { name, crm_data? } → the patch that writes the name in Hebrew (null = nothing to do). Pure. */
export function hebrewNamePatch(row, table = 'contacts') {
  const name = String(row?.name || '').trim()
  if (!name || !isLatinName(name.split(' · ')[0])) return null
  const he = hebrewFullName(name)
  if (!he || he === name) return null
  if (table !== 'contacts') return { name: he }
  const crm = row.crm_data && typeof row.crm_data === 'object' ? row.crm_data : {}
  const next = { ...crm }
  if (!String(crm.originalName || '').trim()) next.originalName = name
  if (crm.name && isLatinName(String(crm.name).split(' · ')[0])) next.name = hebrewFullName(crm.name)
  return { name: he, crm_data: next }
}

/** Convert the Latin names of the leads that arrived in the last `hours` (both tables). → { fixed } */
export async function hebrewizeRecentNames(client, { hours = 72, now = Date.now() } = {}) {
  if (!client) return { skipped: 'no client' }
  const since = new Date(now - hours * 3600e3).toISOString()
  let fixed = 0
  for (const table of ['meta_leads', 'contacts']) {
    const { data, error } = await client.from(table).select(table === 'contacts' ? 'id,name,crm_data' : 'id,name')
      .gte('created_at', since).filter('name', 'match', '[A-Za-z]').not('name', 'match', '[א-ת]').limit(200)
    if (error) continue
    for (const row of data || []) {
      const patch = hebrewNamePatch(row, table)
      if (!patch) continue
      const { error: e } = await client.from(table).update(patch).eq('id', row.id)
      if (!e) fixed++
    }
  }
  return { fixed }
}
