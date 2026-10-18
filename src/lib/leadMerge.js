// Merge two leads that are the same person (dragged one card onto another, or picked two rows and pressed "מזג").
// Pure: returns the patch for the lead that stays and a summary; the caller saves the patch and moves the other lead to
// the trash. Nothing is lost: contact fields the kept lead lacks come from the other one, notes / tasks / tags / form
// answers / stage history are joined, the other lead's message and campaign are kept, and a note records the merge.
const asList = v => (Array.isArray(v) ? v : [])
const asNotes = n => (Array.isArray(n) ? n : typeof n === 'string' && n.trim() ? [{ id: 'legacy', text: n, ts: 0 }] : [])
const blank = v => v == null || String(v).trim() === ''
// stage order: the merged lead keeps the one that is further along (won / lost / irrelevant are end states, kept as is)
const ORDER = ['new', 'contacted', 'discovery', 'negotiating', 'won']

export const CONTACT_FIELDS = ['name', 'phone', 'email', 'contactTime', 'dealType', 'propertyType', 'area', 'rooms', 'budget', 'timeline', 'financing', 'propTitle', 'propLocation', 'owner', 'priority', 'followUp', 'campaignName', 'formName']

// Fields where both leads have a different, non-empty value — the dialog lets the user choose
export function mergeConflicts(keep, other) {
  return ['name', 'phone', 'email'].filter(k => !blank(keep?.[k]) && !blank(other?.[k]) && String(keep[k]).trim() !== String(other[k]).trim())
}

/**
 * @param keep   the lead that stays
 * @param other  the lead merged into it (goes to the trash afterwards)
 * @param opts.choose  { name: 'keep'|'other', phone: …, email: … } for conflicting fields (default: keep)
 * @param opts.now, opts.lang
 * @returns { patch, removeId }
 */
export function mergeLeads(keep, other, { choose = {}, now = Date.now(), lang = 'he' } = {}) {
  if (!keep || !other || keep.id === other.id) throw new Error('two different leads are needed')
  const patch = {}
  for (const k of CONTACT_FIELDS) {
    if (choose[k] === 'other' && !blank(other[k])) patch[k] = other[k]
    else if (blank(keep[k]) && !blank(other[k])) patch[k] = other[k]
  }
  // notes: both lists in time order, plus a note that records the merge
  const label = [other.name, other.phone].filter(Boolean).join(' · ') || String(other.id)
  const mergeNote = { id: `m${now.toString(36)}`, ts: now, kind: 'note', text: lang === 'en' ? `🔗 Merged with ${label}` : `🔗 מוזג עם ${label}` }
  const extra = []
  if (!blank(other.msg) && String(other.msg).trim() !== String(keep.msg || '').trim()) extra.push({ id: `mm${now.toString(36)}`, ts: other.ts || now, kind: 'note', text: `${lang === 'en' ? 'Message' : 'הודעה'}: ${other.msg}` })
  patch.notes = [...asNotes(keep.notes), ...asNotes(other.notes), ...extra, mergeNote]
    .filter(n => n && n.text).sort((a, b) => (a.ts || 0) - (b.ts || 0))
  const tasks = [...asList(keep.tasks), ...asList(other.tasks)]
  if (tasks.length) patch.tasks = tasks
  const tags = [...new Set([...asList(keep.tags), ...asList(other.tags)])]
  if (tags.length) patch.tags = tags
  const answers = [...asList(keep.formAnswers)]
  for (const a of asList(other.formAnswers)) if (!answers.some(x => x.q === a.q && x.a === a.a)) answers.push(a)
  if (answers.length) patch.formAnswers = answers
  const log = [...asList(keep.stageLog), ...asList(other.stageLog)].sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0))
  if (log.length) patch.stageLog = log.slice(-50)
  // the earlier arrival time and the further stage
  if (other.ts && (!keep.ts || other.ts < keep.ts)) patch.ts = other.ts
  const ks = keep.leadStatus || 'new', os = other.leadStatus || 'new'
  if (ORDER.includes(ks) && ORDER.includes(os) && ORDER.indexOf(os) > ORDER.indexOf(ks)) patch.leadStatus = os
  patch.mergedFrom = [...asList(keep.mergedFrom), { id: other.id, name: other.name || '', phone: other.phone || '', source: other.source || '', campaign: other.campaignName || other.formName || other.propTitle || '', at: now }]
  return { patch, removeId: other.id }
}
