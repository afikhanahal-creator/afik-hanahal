// The pipeline's stages in board order, with their default names and colors (the office can rename them — `stageLabels`).
// Shared by the Lead Center and the chats tab's stage menu.
export const PIPELINE = [
  { id: 'new', he: 'ליד חדש', en: 'New Leads', color: '#0073EA' },
  { id: 'contacted', he: 'ניצור קשר', en: 'Contacted', color: '#FDAB3D' },
  { id: 'discovery', he: 'גילוי', en: 'Discovery', color: '#A25DDC' },
  { id: 'meeting', he: 'נקבעה פגישה', en: 'Meeting set', color: '#4F6BED' },
  { id: 'negotiating', he: 'במו"מ', en: 'In Negotiation', color: '#FF7575' },
  { id: 'won', he: 'סגירה', en: 'Closed Won', color: '#00C875' },
  { id: 'lost', he: 'ללא מענה', en: 'No Answer', color: '#7D7D7D' },
  { id: 'irrelevant', he: 'לא רלוונטי', en: 'Not relevant', color: '#64748B' },
  { id: 'nurture', he: 'לחזור בעוד כמה חודשים', en: 'Nurture (later)', color: '#0E9AA7' },
]
export function stageLabel(st, lang = 'he', stageLabels = {}) {
  const o = stageLabels?.[st.id] || {}
  return (lang === 'en' ? o.en : o.label) || st[lang === 'en' ? 'en' : 'he']
}
/** The note a conversation summary leaves on the lead (crm_data.notes, kind 'wa') */
export function summaryNote(sum = {}, lang = 'he') {
  const en = lang === 'en'
  const lines = [`${en ? 'AI chat summary' : 'סיכום שיחה (AI)'}: ${String(sum.summary || '').trim()}`]
  if (sum.leadWants) lines.push(`${en ? 'Wants' : 'מה רוצים'}: ${sum.leadWants}`)
  if (sum.agreed?.length) lines.push(`${en ? 'Agreed' : 'סוכם'}: ${sum.agreed.join(' · ')}`)
  if (sum.openQuestions?.length) lines.push(`${en ? 'Open' : 'פתוח'}: ${sum.openQuestions.join(' · ')}`)
  if (sum.nextStep) lines.push(`${en ? 'Next step' : 'הצעד הבא'}: ${sum.nextStep}`)
  return lines.join('\n')
}
