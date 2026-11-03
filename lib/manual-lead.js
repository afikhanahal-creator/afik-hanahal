// A lead the office adds by hand (the board's "ליד חדש" → POST /api/contacts?manual=1). Pure and tested (manual-lead.test.mjs).
// → { row } (a contacts row) | { error } — a phone or an email is needed, so the lead can be reached.
const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
export const MANUAL_SOURCES = ['phone', 'referral', 'walk-in', 'website', 'meta', 'yad2', 'other']
// a conversation in the social inbox (lib/social-hook.js) — saved with its own source, and allowed without a phone / email
const SOCIAL = ['messenger', 'instagram']
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
  const social = b.social && SOCIAL.includes(b.social.platform) && /^(messenger|instagram):\d+:\d+$/.test(String(b.social.threadId || '')) ? b.social : null
  if (!phone && !email && !social) return { error: 'צריך טלפון או אימייל' }
  const wa = b.channel === 'whatsapp' && !social      // a WhatsApp chat of the office line (the inbox's "הוסף כליד")
  const name = str(heName, 80) || typed || null
  const source = social ? social.platform : wa ? 'whatsapp' : MANUAL_SOURCES.includes(b.source) ? b.source : 'other'
  const stage = STAGES.includes(b.leadStatus) ? b.leadStatus : 'new'
  const note = str(b.note, 1500)
  const crm = {
    leadStatus: stage,
    origin: { channel: social ? social.platform : wa ? 'whatsapp' : 'manual', by: 'office', ...(b.sourceDetail ? { detail: str(b.sourceDetail, 80) } : {}) },
    ...(social ? { social: { platform: social.platform, threadId: String(social.threadId), accountId: str(social.accountId, 30), userId: str(social.userId, 30), username: str(social.username, 60) } } : {}),
    ...(typed && name !== typed ? { originalName: typed } : {}),
    ...(/^p_[a-z0-9]{3,20}$/.test(String(b.projectId || '')) ? { projectId: b.projectId, projectName: str(b.projectName, 60) } : {}),
    ...(note ? { notes: [{ id: `n${now.toString(36)}`, text: note, ts: now, kind: 'note' }] } : {}),
    stageLog: [{ from: null, to: stage, at: now }],
  }
  return { row: { name, phone: phone || null, email: email || null, message: note || null, prop_title: str(b.projectName, 60) || null, prop_location: null, source: source === 'website' || social || wa ? source : `manual_${source}`, crm_data: crm } }
}
