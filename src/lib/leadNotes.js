// One list of notes per lead, wherever it is written: the lead card, the call summary, the Lead Center, the chats tab.
// They live in the CRM lead's crm_data.notes ([{ id, text, ts, kind }]); a Meta lead's old free-text note (meta_leads.notes,
// the Lead Center's former textarea) joins the list once, as its own entry. Pure; tested in leadNotes.test.mjs.

/** crm_data.notes in any old shape → [{ id, text, ts, kind }] */
export function asNotes(v) {
  if (Array.isArray(v)) return v.filter(n => n && String(n.text || '').trim())
  return typeof v === 'string' && v.trim() ? [{ id: 'legacy', text: v.trim(), ts: 0, kind: 'note' }] : []
}

const metaNoteId = metaLead => `meta_note_${metaLead?.id}`

/** The notes to show for a lead, newest first (the CRM copy's + the Meta lead's old note, once) */
export function leadNotes(crmLead, metaLead = null) {
  const list = asNotes(crmLead?.notes)
  const old = String(metaLead?.notes || '').trim()
  if (old && !list.some(n => n.id === metaNoteId(metaLead) || n.text.trim() === old)) {
    list.push({ id: metaNoteId(metaLead), text: old, ts: Date.parse(metaLead.updated_at || metaLead.created_at) || 0, kind: 'note' })
  }
  return list.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))
}

/** The patch that adds a note (the Meta lead's old note moves in with it, so it isn't lost) */
export function addNote(crmLead, metaLead, text, { kind = 'note', by = '', now = Date.now() } = {}) {
  const t = String(text || '').trim()
  if (!t) return null
  const list = asNotes(crmLead?.notes)
  const old = String(metaLead?.notes || '').trim()
  if (old && !list.some(n => n.id === metaNoteId(metaLead) || n.text.trim() === old)) {
    list.push({ id: metaNoteId(metaLead), text: old, ts: Date.parse(metaLead.updated_at || metaLead.created_at) || now - 1, kind: 'note' })
  }
  const note = { id: `n${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: t, ts: now, kind, ...(by ? { by } : {}) }
  return { note, patch: { notes: [...list, note] } }
}
