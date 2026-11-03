// A lead the office adds by hand (the board's "ליד חדש" → POST /api/contacts?manual=1). Pure and tested (manual-lead.test.mjs).
// → { row } (a contacts row) | { error } — a phone or an email is needed, so the lead can be reached.
const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
export const MANUAL_SOURCES = ['phone', 'referral', 'walk-in', 'website', 'meta', 'yad2', 'other']
const STAGES = ['new', 'contacted', 'discovery', 'meeting', 'negotiating', 'won', 'lost', 'nurture', 'irrelevant']

export function localPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (d.startsWith('972')) d = '0' + d.slice(3)
  if (d.length === 9 && /^5/.test(d)) d = '0' + d
  return d
}

export function manualLeadRow(b = {}, heName = '', now = Date.now()) {
  const typed = str(b.name, 80)
  const phone = localPhone(b.phone)
  const email = str(b.email, 120).toLowerCase()
  if (phone && !/^0\d{8,9}$/.test(phone)) return { error: 'מספר הטלפון לא תקין' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'כתובת האימייל לא תקינה' }
  if (!phone && !email) return { error: 'צריך טלפון או אימייל' }
  const name = str(heName, 80) || typed || null
  const source = MANUAL_SOURCES.includes(b.source) ? b.source : 'other'
  const stage = STAGES.includes(b.leadStatus) ? b.leadStatus : 'new'
  const note = str(b.note, 1500)
  const crm = {
    leadStatus: stage,
    origin: { channel: 'manual', by: 'office', ...(b.sourceDetail ? { detail: str(b.sourceDetail, 80) } : {}) },
    ...(typed && name !== typed ? { originalName: typed } : {}),
    ...(/^p_[a-z0-9]{3,20}$/.test(String(b.projectId || '')) ? { projectId: b.projectId, projectName: str(b.projectName, 60) } : {}),
    ...(note ? { notes: [{ id: `n${now.toString(36)}`, text: note, ts: now, kind: 'note' }] } : {}),
    stageLog: [{ from: null, to: stage, at: now }],
  }
  return { row: { name, phone: phone || null, email: email || null, message: note || null, prop_title: str(b.projectName, 60) || null, prop_location: null, source: source === 'website' ? 'website' : `manual_${source}`, crm_data: crm } }
}
