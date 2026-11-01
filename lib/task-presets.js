// Ready-made CRM tasks — picked from a list instead of typed (the lead card's tasks tab, the follow-up box, the follow-ups
// screen's "משימה חדשה"). Each has Hebrew + English text and, when it has a natural time, a suggested due (days from now + an
// Israel-time hour) that fills an empty "when". The office's own recent texts come first (src/TaskPresetInput.jsx keeps them).

export const TASK_GROUPS = [
  { id: 'call', he: 'שיחות', en: 'Calls', items: [
    ['call_first', 'שיחת היכרות ראשונה', 'First intro call', 0, 11],
    ['call_back', 'לחזור אליהם בטלפון', 'Call them back', 1, 10],
    ['call_retry', 'לנסות שוב, לא ענו', 'Try again, no answer', 0, 17],
    ['call_after_docs', 'שיחת המשך אחרי שליחת החומרים', 'Follow-up call after sending the materials', 2, 11],
    ['call_developer', 'לתאם שיחה עם היזם', 'Set up a call with the developer', 1, 12],
    ['call_confirm', 'לאשר את הפגישה מחר', "Confirm tomorrow's meeting", 0, 17],
  ] },
  { id: 'send', he: 'לשלוח בוואטסאפ', en: 'Send on WhatsApp', items: [
    ['send_plans', 'לשלוח תוכניות ומחירון', 'Send the plans and price list', 0, 12],
    ['send_deck', 'לשלוח את מצגת הפרויקט', 'Send the project presentation', 0, 12],
    ['send_location', 'לשלוח מיקום והוראות הגעה', 'Send the location and directions', 0, 12],
    ['send_offer', 'לשלוח הצעת מחיר', 'Send a price offer', 1, 12],
    ['send_similar', 'לשלוח נכסים דומים', 'Send similar properties', 1, 12],
    ['send_summary', 'לשלוח סיכום של השיחה', 'Send a summary of the call', 0, 18],
    ['send_tax', 'לשלוח חישוב מס רכישה', 'Send a purchase tax calculation', 1, 12],
  ] },
  { id: 'meet', he: 'פגישות וסיורים', en: 'Meetings & viewings', items: [
    ['meet_office', 'לתאם פגישה במשרד', 'Schedule a meeting at the office', 1, 11],
    ['meet_viewing', 'לתאם סיור בנכס', 'Schedule a property viewing', 1, 11],
    ['meet_site', 'לתאם סיור באתר הבנייה', 'Schedule a construction site visit', 2, 11],
    ['meet_developer', 'לתאם פגישה עם היזם', 'Schedule a meeting with the developer', 2, 11],
    ['meet_remind', 'לשלוח תזכורת לפגישה', 'Send a meeting reminder', 0, 18],
    ['meet_feedback', 'לקבל משוב אחרי הסיור', 'Get feedback after the viewing', 1, 12],
  ] },
  { id: 'needs', he: 'בירור צרכים', en: 'Qualifying', items: [
    ['needs_budget', 'לברר תקציב והון עצמי', 'Check the budget and equity', 1, 11],
    ['needs_mortgage', 'לברר אם יש אישור עקרוני למשכנתא', 'Check for a mortgage pre-approval', 1, 11],
    ['needs_timeline', 'לברר מתי מתכננים לקנות', 'Find out when they plan to buy', 1, 11],
    ['needs_area', 'לדייק אזור, חדרים וסוג נכס', 'Pin down the area, rooms and property type', 1, 11],
    ['needs_decider', 'לברר מי עוד שותף להחלטה', 'Find out who else is part of the decision', 2, 11],
    ['needs_sell', 'לברר אם צריכים למכור נכס קודם', 'Check whether they need to sell first', 2, 11],
  ] },
  { id: 'finance', he: 'מימון', en: 'Financing', items: [
    ['fin_advisor', 'לחבר ליועץ משכנתאות', 'Connect them with a mortgage advisor', 1, 11],
    ['fin_approval', 'לבדוק אם התקבל אישור עקרוני', 'Check whether the pre-approval came through', 7, 11],
    ['fin_payments', 'לשלוח את לוח התשלומים', 'Send the payment schedule', 1, 12],
  ] },
  { id: 'deal', he: 'עסקה וחתימה', en: 'Deal & signing', items: [
    ['deal_brokerage', 'לשלוח הסכם תיווך לחתימה', 'Send the brokerage agreement to sign', 0, 12],
    ['deal_draft', 'לשלוח טיוטת הסכם', 'Send the draft agreement', 1, 12],
    ['deal_lawyer', 'לתאם עם עורך הדין', 'Coordinate with the lawyer', 1, 11],
    ['deal_docs', 'לקבל מסמכים: ת"ז ואישורים', 'Collect documents: ID and approvals', 1, 12],
    ['deal_tabu', 'להוציא נסח טאבו', 'Get the Tabu registration extract', 0, 12],
    ['deal_sign', 'לתאם מועד חתימה', 'Schedule the signing', 1, 11],
    ['deal_deposit', 'לוודא העברת מקדמה', 'Make sure the deposit was paid', 2, 12],
    ['deal_fee', 'לגבות עמלת תיווך', 'Collect the brokerage fee', 3, 12],
  ] },
  { id: 'after', he: 'שימור והמלצות', en: 'Retention & referrals', items: [
    ['after_review', 'לבקש ביקורת בגוגל', 'Ask for a Google review', 3, 12],
    ['after_referral', 'לבקש המלצה על חברים', 'Ask for a referral', 14, 12],
    ['after_check', 'לבדוק שהכל בסדר אחרי העסקה', 'Check in after the deal', 30, 11],
    ['after_3m', 'לחזור בעוד 3 חודשים', 'Get back in 3 months', 90, 10],
    ['after_new', 'לעדכן על פרויקט חדש', 'Update them on a new project', 7, 12],
  ] },
  { id: 'admin', he: 'עדכונים במערכת', en: 'Housekeeping', items: [
    ['adm_stage', 'לעדכן את השלב בפייפליין', 'Update the pipeline stage', 0, 18],
    ['adm_card', 'להשלים פרטים בכרטיס הליד', 'Complete the lead card', 0, 18],
    ['adm_handoff', 'להעביר לנציג אחר', 'Hand over to another agent', 0, 12],
  ] },
].map(g => ({ ...g, items: g.items.map(([id, he, en, days, hour]) => ({ id, he, en, days, hour, group: g.id })) }))

export const TASK_PRESETS = TASK_GROUPS.flatMap(g => g.items)

/** The text of a preset in a language */
export const presetText = (p, lang = 'he') => (lang === 'en' ? p.en : p.he)

/** The groups that match what was typed (Hebrew or English, any part), follow-ups put calls first */
export function filterPresets(q = '', { kind = 'task' } = {}) {
  const s = String(q || '').trim().toLowerCase()
  const order = kind === 'followup' ? ['call', 'send', 'meet', 'needs', 'finance', 'deal', 'after', 'admin'] : TASK_GROUPS.map(g => g.id)
  return order.map(id => TASK_GROUPS.find(g => g.id === id)).map(g => ({ ...g, items: s ? g.items.filter(p => `${p.he} ${p.en}`.toLowerCase().includes(s)) : g.items }))
    .filter(g => g.items.length)
}

/** A preset's suggested due as ISO (Israel time): `days` from today at `hour`; a time already past today moves to the next hour
 *  that is still ahead, never before now + 30 min; Saturday moves to Sunday */
export function presetDue(p, now = Date.now()) {
  if (!p || p.days == null) return ''
  const il = d => new Date(new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }))
  const nowIl = il(now)
  const offset = nowIl.getTime() - new Date(now).getTime()          // Israel wall clock − UTC
  const t = new Date(nowIl); t.setDate(t.getDate() + p.days); t.setHours(p.hour ?? 10, 0, 0, 0)
  if (t.getDay() === 6) t.setDate(t.getDate() + 1)
  let ms = t.getTime() - offset
  if (ms < now + 30 * 60e3) ms = Math.ceil((now + 60 * 60e3) / (30 * 60e3)) * 30 * 60e3
  return new Date(ms).toISOString()
}

/** Recent texts the office typed (newest first, unique, not a preset, max 8) */
export function pushRecent(list = [], text = '', max = 8) {
  const v = String(text || '').replace(/\s+/g, ' ').trim()
  if (!v || v.length > 120 || TASK_PRESETS.some(p => p.he === v || p.en === v)) return list
  return [v, ...list.filter(x => x !== v)].slice(0, max)
}
