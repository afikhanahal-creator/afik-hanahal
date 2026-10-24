// Lead card — opens in the middle of the screen from the leads board / table.
// Edit everything about a lead (details, needs, management), keep notes and tasks, and read the smart analysis.
// Every change saves on its own (onUpdate → PATCH /api/contacts → crm_data).
import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { FaTimes, FaPhone, FaWhatsapp, FaEnvelope, FaMagic, FaUser, FaStickyNote, FaTasks, FaChartPie, FaCheck, FaTrash, FaCopy, FaPlus, FaClock, FaBullseye, FaExclamationTriangle, FaLightbulb, FaQuestionCircle, FaComments, FaShieldAlt, FaSyncAlt, FaMapMarkerAlt, FaBuilding, FaCalendarAlt, FaTag, FaFlag, FaArrowUp, FaArrowDown, FaInfoCircle, FaUserCheck, FaExternalLinkAlt, FaSearch, FaHandshake, FaEdit } from 'react-icons/fa'
import { T } from './automationsUI.jsx'
import { sourceLabel, sourceColor, originLines, leadCampaign, leadCampaignTag, leadCampaignFull, leadProject, toggleProjectInName } from './lib/leadFields.js'
import LeadChatTab from './LeadChatTab.jsx'
import LeadConversation from './LeadConversation.jsx'
import { useAdminTheme } from './adminTheme.js'
import { autoApi } from './AutomationsApi.jsx'
import DateTimePicker from './DateTimePicker.jsx'
import { FollowUpComposer, FollowUpList, FollowUpButton } from './FollowUpTask.jsx'
import { followUpPresets, setNextFollowUp, dueIso, describeDue } from '../lib/follow-up.js'

const TR = {
  he: {
    addProject: p => `+ הוספת הפרויקט: ${p}`, removeProject: 'הסרת שם הפרויקט', projectTip: 'השם מתעדכן גם במרכז הלידים ובצ׳אטים', convShow: 'הצג שיחה', convHide: 'הסתר שיחה', convTip: 'כל ההתכתבות בוואטסאפ עם הליד, לצד הפרטים',
    tabs: { details: 'פרטים ועריכה', notes: 'הערות ופעילות', chat: 'שיחת וואטסאפ', tasks: 'משימות', analysis: 'ניתוח חכם' },
    call: 'התקשר', wa: 'וואטסאפ', email: 'מייל', analyze: 'נתח ליד', reanalyze: 'נתח מחדש', analyzing: 'מנתח…', close: 'סגירה', saved: 'נשמר', saving: 'שומר…', saveFailed: 'השמירה נכשלה — בדקו חיבור ונסו שוב',
    sec: { contact: 'פרטי קשר', need: 'מה הלקוח מחפש', prop: 'הנכס שהתעניין בו', msg: 'ההודעה של הלקוח', manage: 'ניהול הליד', source: 'מקור הליד' },
    f: { name: 'שם מלא', phone: 'טלפון', email: 'אימייל', contactTime: 'זמן נוח ליצירת קשר', dealType: 'סוג עסקה', propertyType: 'סוג נכס', area: 'אזור / יישוב', rooms: 'חדרים', budget: 'תקציב (₪)', timeline: 'לוח זמנים', financing: 'מימון', propTitle: 'נכס', propLocation: 'מיקום הנכס', msg: 'הודעה', priority: 'עדיפות', owner: 'אחראי', followUp: 'מעקב הבא', tags: 'תגיות', tagPh: 'הוסף תגית ו-Enter' },
    opt: {
      dealType: { '': '—', buy: 'קנייה', sell: 'מכירה', rent: 'השכרה', invest: 'השקעה' },
      timeline: { '': '—', now: 'מיידי', soon: 'בחודשים הקרובים', year: 'עד שנה', later: 'לא דחוף' },
      financing: { '': '—', cash: 'מזומן / הון עצמי', approved: 'משכנתא – יש אישור עקרוני', mortgage: 'משכנתא – צריך ליווי', unknown: 'לא ידוע' },
      priority: { '': '—', low: 'נמוכה', normal: 'רגילה', high: 'גבוהה', urgent: 'דחופה' },
    },
    campaign: 'קמפיין', form: 'טופס', answers: 'תשובות מהטופס', created: 'נכנס', none: '—',
    evCreated: 'הליד נכנס למערכת', evAnalyzed: s => `ניתוח: ציון ${s}`,
    history: 'היסטוריה', newEntry: 'תיעוד חדש', kinds: { note: 'הערה', call: 'שיחה', meeting: 'פגישה', wa: 'וואטסאפ' },
    kindPh: { note: 'מה חשוב לזכור על הליד? (Ctrl+Enter לשמירה)', call: 'מה עלה בשיחה — מה מחפש, תקציב, אזור, מה הצעד הבא… (Ctrl+Enter לשמירה)', meeting: 'סיכום הפגישה — מה הוצג, איך הגיב, מה סוכם… (Ctrl+Enter לשמירה)', wa: 'מה נכתב בוואטסאפ / מה סוכם… (Ctrl+Enter לשמירה)' },
    outcome: 'איך הסתיימה השיחה?', outcomes: { answered: 'דיברנו', no_answer: 'לא ענה', callback: 'ביקש שנחזור', not_relevant: 'לא רלוונטי' },
    save: 'שמור', cancel: 'ביטול', edit: 'עריכה', del: 'מחיקה', delQ: 'למחוק את הרשומה?', yes: 'כן, למחוק', no: 'לא', edited: 'נערך',
    draftKept: 'הטיוטה נשמרת אוטומטית', filters: { all: 'הכול', notes: 'הערות ושיחות', system: 'מערכת' },
    upcoming: 'מעקב מתוכנן', overdueFu: 'מעקב באיחור', dayToday: 'היום', dayYesterday: 'אתמול', emptyHistory: 'עוד אין היסטוריה. כל הערה, שיחה ושינוי שלב יופיעו כאן.',
    evStage: (a, b) => `שלב: ${a} ← ${b}`, evTaskDone: 'משימה הושלמה', evAuto: { welcome: 'הודעת פתיחה נשלחה בוואטסאפ', noreply: n => `הודעת מעקב ${n} נשלחה בוואטסאפ`, stage: 'הודעת שלב נשלחה בוואטסאפ', reengage: 'הודעת חזרה נשלחה בוואטסאפ', reply: 'מענה אוטומטי נשלח בוואטסאפ', other: 'הודעה אוטומטית נשלחה' },
    via: 'דרך', moveTo: s => `הליד יעבור לשלב "${s}"`,
    fuTitle: 'פולו אפ – לחזור אליהם', fuSub: 'בחרו מתי לחזור לליד. כשמגיע הזמן נשלחת תזכורת בוואטסאפ למספר המשרד, עם השם, הטלפון וקישור לכרטיס.', taskPh: 'משימה חדשה (למשל: לשלוח תשריט)', taskRemind: 'תזכורת בוואטסאפ', taskRemindTip: 'כשמגיע הזמן נשלחת למשרד הודעה עם שם הליד, הטלפון, המשימה וקישור לכרטיס', taskRemindOn: 'תישלח תזכורת בוואטסאפ', taskReminded: 'התזכורת נשלחה', due: 'עד', addTask: 'הוסף', noTasks: 'אין משימות פתוחות', overdue: 'באיחור', today: 'היום', done: 'הושלמו',
    gradeName: { hot: 'חם', warm: 'פושר', cool: 'קריר', cold: 'קר' }, rules: 'ציון כללים', aiAdj: 'תיקון AI', conf: { high: 'ביטחון גבוה', medium: 'ביטחון בינוני', low: 'ביטחון נמוך' },
    noAnalysis: 'עוד לא נותח', noAnalysisSub: 'הניתוח אוסף את כל מה שידוע על הליד – ההודעה, תשובות הטופס, השיחה בוואטסאפ, אוטומציות, פניות חוזרות והנכס שהתעניין בו – ומחשב ציון שקוף עם תדריך לשיחה.',
    brief: 'תדריך לשיחה', next: 'הצעד הבא', msgSuggest: 'הודעה מוצעת', copy: 'העתק', copied: 'הועתק', openChat: 'פתח שיחה',
    why: 'למה הציון הזה', groups: { contact: 'זמינות', intent: 'כוונה ובהירות', engage: 'מעורבות', source: 'מקור והיסטוריה', stage: 'שלב וטריות', fit: 'התאמה לנכס' },
    ask: 'שאלות לשיחה', points: 'נקודות לשיחה', objections: 'התנגדויות צפויות', risks: 'סיכונים', needs: 'צרכים', persona: 'מי הלקוח', motivation: 'מוטיבציה', bestTime: 'זמן מומלץ ליצירת קשר',
    signals: { budget: 'תקציב', dealType: 'עסקה', timeline: 'זמנים', financing: 'מימון', inbound: 'הודעות ממנו', repeats: 'פניות חוזרות', listing: 'מחיר הנכס' },
    tl: { now: 'מיידי', soon: 'חודשים', later: 'לא דחוף' }, fin: { cash: 'מזומן', mortgage: 'משכנתא' }, dt: { buy: 'קנייה', sell: 'מכירה', rent: 'השכרה', invest: 'השקעה' },
    aiOff: 'מוצג ניתוח מבוסס כללים. תדריך ה-AI לא זמין כרגע:', researching: 'מחפש מידע על הליד…', briefing: 'כותב תדריך…',
    who: 'מי הליד — אימות ומחקר', verdict: { confirmed: 'זהות מאומתת', likely: 'זהות סבירה', unverified: 'זהות לא אומתה', mismatch: 'אי-התאמה בפרטים' }, dataQ: { rich: 'נמצא מידע רב', some: 'נמצא מידע חלקי', thin: 'נמצא מעט', none: 'לא נמצא מידע ציבורי' },
    searches: n => `${n} חיפושים`, phoneTypes: { mobile: 'נייד', landline: 'קווי', voip: 'קו 07 (VoIP)', foreign: 'מספר זר', invalid: 'מספר לא תקין', service: 'מספר שירות', missing: 'אין מספר' }, nameQ: { full: 'שם מלא', 'first-only': 'שם פרטי בלבד', suspicious: 'שם חשוד', missing: 'אין שם' },
    identityCheck: 'מה אומת', matchedBy: 'התאמה לפי', toConfirm: 'מה יאשר את הזהות', profiles: 'פרופילים ומקורות ציבוריים', professional: 'עיסוק', rePro: 'איש נדל״ן', publicOwner: 'המספר מופיע ציבורית אצל', hooks: 'נקודות לחימום השיחה', verify: 'שאלות לאימות עדין', flags: 'דגלים אדומים', sources: 'מקורות', opener: 'משפט פתיחה', warmup: 'תוכנית חימום', researchOff: 'המחקר לא רץ:', noResearch: 'טרם נערך מחקר על הליד — לחצו "נתח מחדש".', aiFix: { workspace: 'מפתח ה-API לא משויך ל-Workspace. צרו מפתח חדש בתוך Workspace (console.anthropic.com → Workspaces → Default → API keys), החליפו את ANTHROPIC_API_KEY ב-Vercel ופרסו מחדש.', admin_key: 'הוכנס מפתח Admin (sk-ant-admin…), שלא יכול לנתח. צרו מפתח API רגיל בתוך Workspace, החליפו ב-Vercel ופרסו מחדש.', auth: 'מפתח ה-API לא תקין. העתיקו אותו מחדש ל-Vercel ופרסו מחדש.', no_key: 'לא הוגדר מפתח ANTHROPIC_API_KEY ב-Vercel.' }, analyzedAt: t => `נותח ${t}`, legacy: 'ניתוח קודם (גרסה ישנה) – לחצו "נתח מחדש" לניתוח המדויק החדש',
  },
  en: {
    addProject: p => `+ Add the project: ${p}`, removeProject: 'Remove the project name', projectTip: 'The name updates in the Lead Center and the chats too', convShow: 'Show chat', convHide: 'Hide chat', convTip: 'The whole WhatsApp conversation with the lead, next to the details',
    tabs: { details: 'Details', notes: 'Notes & activity', chat: 'WhatsApp chat', tasks: 'Tasks', analysis: 'Smart analysis' },
    call: 'Call', wa: 'WhatsApp', email: 'Email', analyze: 'Analyze lead', reanalyze: 'Re-analyze', analyzing: 'Analyzing…', close: 'Close', saved: 'Saved', saving: 'Saving…', saveFailed: 'Not saved — check the connection and try again',
    sec: { contact: 'Contact details', need: 'What they are looking for', prop: 'Property of interest', msg: 'Their message', manage: 'Lead management', source: 'Lead source' },
    f: { name: 'Full name', phone: 'Phone', email: 'Email', contactTime: 'Best time to reach', dealType: 'Deal type', propertyType: 'Property type', area: 'Area / town', rooms: 'Rooms', budget: 'Budget (₪)', timeline: 'Timeline', financing: 'Financing', propTitle: 'Property', propLocation: 'Property location', msg: 'Message', priority: 'Priority', owner: 'Owner', followUp: 'Next follow-up', tags: 'Tags', tagPh: 'Add a tag and press Enter' },
    opt: {
      dealType: { '': '—', buy: 'Buy', sell: 'Sell', rent: 'Rent', invest: 'Invest' },
      timeline: { '': '—', now: 'Immediately', soon: 'In the coming months', year: 'Within a year', later: 'No rush' },
      financing: { '': '—', cash: 'Cash / equity', approved: 'Mortgage – pre-approved', mortgage: 'Mortgage – needs guidance', unknown: 'Unknown' },
      priority: { '': '—', low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' },
    },
    campaign: 'Campaign', form: 'Form', answers: 'Form answers', created: 'Created', none: '—',
    evCreated: 'Lead came in', evAnalyzed: s => `Analysis: score ${s}`,
    history: 'History', newEntry: 'New entry', kinds: { note: 'Note', call: 'Call', meeting: 'Meeting', wa: 'WhatsApp' },
    kindPh: { note: 'What should we remember about this lead? (Ctrl+Enter saves)', call: 'What came up in the call — what they want, budget, area, next step… (Ctrl+Enter saves)', meeting: 'Meeting summary — what was shown, how they reacted, what was agreed… (Ctrl+Enter saves)', wa: 'What was said on WhatsApp / agreed… (Ctrl+Enter saves)' },
    outcome: 'How did the call end?', outcomes: { answered: 'We talked', no_answer: 'No answer', callback: 'Call back', not_relevant: 'Not relevant' },
    save: 'Save', cancel: 'Cancel', edit: 'Edit', del: 'Delete', delQ: 'Delete this entry?', yes: 'Yes, delete', no: 'No', edited: 'edited',
    draftKept: 'Your draft is kept automatically', filters: { all: 'All', notes: 'Notes & calls', system: 'System' },
    upcoming: 'Follow-up scheduled', overdueFu: 'Follow-up overdue', dayToday: 'Today', dayYesterday: 'Yesterday', emptyHistory: 'No history yet. Every note, call and stage change shows up here.',
    evStage: (a, b) => `Stage: ${a} → ${b}`, evTaskDone: 'Task completed', evAuto: { welcome: 'Welcome message sent on WhatsApp', noreply: n => `Follow-up ${n} sent on WhatsApp`, stage: 'Stage message sent on WhatsApp', reengage: 'Re-engagement message sent on WhatsApp', reply: 'Automatic reply sent on WhatsApp', other: 'Automatic message sent' },
    via: 'via', moveTo: s => `The lead moves to “${s}”`,
    fuTitle: 'Follow-up – get back to them', fuSub: 'Pick when to get back to the lead. When it is due, the office number gets a WhatsApp reminder with the name, phone and a link to the card.', taskPh: 'New task (e.g. send the site plan)', taskRemind: 'WhatsApp reminder', taskRemindTip: 'When it is due, the office gets a message with the lead name, phone, the task and a link to the card', taskRemindOn: 'A WhatsApp reminder will be sent', taskReminded: 'Reminder sent', due: 'Due', addTask: 'Add', noTasks: 'No open tasks', overdue: 'Overdue', today: 'Today', done: 'Done',
    gradeName: { hot: 'Hot', warm: 'Warm', cool: 'Cool', cold: 'Cold' }, rules: 'Rule score', aiAdj: 'AI adjustment', conf: { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' },
    noAnalysis: 'Not analyzed yet', noAnalysisSub: 'The analysis gathers everything we know – the message, form answers, the WhatsApp conversation, automations, repeat inquiries and the listing – and computes a transparent score with a call briefing.',
    brief: 'Call briefing', next: 'Next step', msgSuggest: 'Suggested message', copy: 'Copy', copied: 'Copied', openChat: 'Open chat',
    why: 'Why this score', groups: { contact: 'Reachability', intent: 'Intent & clarity', engage: 'Engagement', source: 'Source & history', stage: 'Stage & freshness', fit: 'Property fit' },
    ask: 'Questions to ask', points: 'Talking points', objections: 'Likely objections', risks: 'Risks', needs: 'Needs', persona: 'Who they are', motivation: 'Motivation', bestTime: 'Best time to reach',
    signals: { budget: 'Budget', dealType: 'Deal', timeline: 'Timeline', financing: 'Financing', inbound: 'Their messages', repeats: 'Repeat inquiries', listing: 'Listing price' },
    tl: { now: 'Now', soon: 'Months', later: 'No rush' }, fin: { cash: 'Cash', mortgage: 'Mortgage' }, dt: { buy: 'Buy', sell: 'Sell', rent: 'Rent', invest: 'Invest' },
    aiOff: 'Showing the rule-based analysis. The AI briefing is unavailable:', researching: 'Researching the lead…', briefing: 'Writing the briefing…',
    who: 'Who the lead is — verification & research', verdict: { confirmed: 'Identity confirmed', likely: 'Identity likely', unverified: 'Identity not verified', mismatch: 'Details do not match' }, dataQ: { rich: 'Rich public data', some: 'Some public data', thin: 'Little found', none: 'No public data found' },
    searches: n => `${n} searches`, phoneTypes: { mobile: 'Mobile', landline: 'Landline', voip: '07x line (VoIP)', foreign: 'Foreign number', invalid: 'Invalid number', service: 'Service number', missing: 'No number' }, nameQ: { full: 'Full name', 'first-only': 'First name only', suspicious: 'Suspicious name', missing: 'No name' },
    identityCheck: 'What was verified', matchedBy: 'Matched by', toConfirm: 'What would confirm it', profiles: 'Public profiles & sources', professional: 'Occupation', rePro: 'Real-estate professional', publicOwner: 'Number publicly listed under', hooks: 'Rapport hooks', verify: 'Gentle verification questions', flags: 'Red flags', sources: 'Sources', opener: 'Opening line', warmup: 'Warm-up plan', researchOff: 'Research did not run:', noResearch: 'No research yet — click "Re-analyze".', aiFix: { workspace: 'The API key is not tied to a workspace. Create a new key inside a workspace (console.anthropic.com → Workspaces → Default → API keys), replace ANTHROPIC_API_KEY in Vercel and redeploy.', admin_key: 'An Admin key (sk-ant-admin…) was entered; it cannot run the analysis. Create a regular API key inside a workspace, replace it in Vercel and redeploy.', auth: 'The API key is invalid. Copy it into Vercel again and redeploy.', no_key: 'ANTHROPIC_API_KEY is not set in Vercel.' }, analyzedAt: t => `Analyzed ${t}`, legacy: 'Older analysis – press "Re-analyze" for the new, more accurate one',
  },
}
const GRADE_COLOR = { hot: '#EF4444', warm: '#F59E0B', cool: '#60A5FA', cold: '#94A3B8' }
const CSS = `
  .lc *{box-sizing:border-box}
  .lc button{min-height:0;min-width:0}
  .lc-body{display:grid;grid-template-columns:minmax(0,1fr) 320px;flex:1;min-height:0}
  .lc-body.conv{grid-template-columns:minmax(0,1fr) 290px minmax(400px,40%)}
  .lcd-proj{margin-top:6px;border:1px dashed rgba(var(--brand-rgb),.45);background:rgba(var(--brand-rgb),.06);color:var(--au-brand-text);border-radius:999px;padding:3px 11px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
  .lcd-proj:hover{background:rgba(var(--brand-rgb),.12)}
  .lc-conv{min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden;border-inline-start:1px solid var(--au-line)}
  .lc-conv-tab{height:min(640px,72vh);border-radius:14px;overflow:hidden;border:1px solid var(--au-line);margin-top:14px}
  .lc-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .lc-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .lc-in{width:100%;height:38px;padding:0 11px;border-radius:9px;border:1px solid var(--au-s3-line);background:var(--au-input);color:var(--au-text);font-family:inherit;font-size:13.5px;outline:none;transition:border-color .15s,box-shadow .15s}
  .lc-in:focus{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.2)}
  textarea.lc-in{height:auto;padding:9px 11px;line-height:1.55;resize:vertical}
  select.lc-in{appearance:auto}
  .lc-tab{height:40px;padding:0 14px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;display:inline-flex;align-items:center;gap:7px;border-bottom:2px solid transparent;white-space:nowrap}
  .lcd-row:hover{background:rgba(var(--ov),.04)}
  .lc-hist-act{opacity:.55;transition:opacity .15s}.lc-hist:hover .lc-hist-act,.lc-hist-act:focus-within{opacity:1}
  .lc-hist-act button:hover{background:rgba(var(--ov),.08)!important;color:var(--au-text)!important}
  @media (hover:none){.lc-hist-act{opacity:1}}
  .lc-act{height:34px;padding:0 12px;border-radius:9px;display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;white-space:nowrap;transition:filter .15s}
  .lc-act:hover{filter:brightness(1.1)}
  @keyframes lc-in{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
  @keyframes lc-spin{to{transform:rotate(360deg)}}
  @media (max-width:980px){.lc-body{grid-template-columns:1fr;overflow-y:auto}.lc-side{border-inline-start:none!important;border-top:1px solid var(--au-line)}.lc-main{overflow:visible!important}}
  @media (max-width:640px){.lc-grid2,.lc-grid3{grid-template-columns:1fr}.lc-hide-m{display:none!important}}
  @media (max-width:640px){.lcd{padding:0!important}.lc-dialog{border-radius:0!important;height:100%!important;border:none!important}}
  @media (prefers-reduced-motion:reduce){.lc-dialog{animation:none!important}}
`
const initials = n => [...String(n || '?').trim()][0] || '?'
const AVATARS = ['#E2445C', '#7C88D2', '#00C875', '#FDAB3D', '#A25DDC', '#0073EA', '#FF7575', '#03C9D7']
const avatarBg = n => AVATARS[(String(n || '').charCodeAt(0) || 0) % AVATARS.length]
const fmtWhen = (ts, lang) => { try { return new Date(ts).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const uid = () => Math.random().toString(36).slice(2, 10)
const asNotes = n => (Array.isArray(n) ? n : typeof n === 'string' && n.trim() ? [{ id: 'legacy', text: n, ts: 0 }] : [])
const shekel = n => (Number(n) ? `₪${Number(n).toLocaleString('he-IL')}` : '')

// ── small pieces ───────────────────────────────────────────────────────────────
function Section({ title, icon: Ic, children, right }) {
  return (
    <section style={{ background: T.card, boxShadow: T.cardShadow, border: `1px solid ${T.s1Line}`, borderRadius: 14, padding: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {Ic && <Ic size={12} style={{ color: T.brandText }}/>}
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.text, flex: 1 }}>{title}</h3>
        {right}
      </header>
      {children}
    </section>
  )
}
function Field({ label, children }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}><span style={{ fontSize: 11.5, fontWeight: 700, color: T.text3 }}>{label}</span>{children}</label>
}
// Text / number / date input that saves on blur (and Enter for single-line)
function EditInput({ value, onSave, type = 'text', multiline, rows = 3, placeholder, dir }) {
  const [v, setV] = useState(value ?? '')
  const focused = useRef(false)
  // a refresh of the lead from the server never overwrites what is being typed right now
  useEffect(() => { if (!focused.current) setV(value ?? '') }, [value])
  const commit = () => { focused.current = false; const nv = type === 'number' ? (v === '' ? '' : Number(String(v).replace(/[^\d.]/g, ''))) : v; if (String(nv ?? '') !== String(value ?? '')) onSave(nv) }
  const common = { className: 'lc-in', value: v, placeholder, dir, onChange: e => setV(e.target.value), onFocus: () => { focused.current = true }, onBlur: commit }
  return multiline
    ? <textarea {...common} rows={rows}/>
    : <input {...common} type={type === 'number' ? 'text' : type} inputMode={type === 'number' ? 'numeric' : undefined} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}/>
}
function EditSelect({ value, options, onSave }) {
  return <select className="lc-in" value={value || ''} onChange={e => onSave(e.target.value)}>{Object.entries(options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
}
function Chip({ children, color = '#6F7AC7', onRemove }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 20, background: `${color}1c`, color: T.text, fontSize: 12, fontWeight: 700, border: `1px solid ${color}40` }}>{children}{onRemove && <button type="button" onClick={onRemove} aria-label="×" style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', padding: 0, display: 'inline-flex' }}><FaTimes size={9}/></button>}</span>
}
function ListBlock({ title, icon: Ic, items, color = T.brandText }) {
  if (!items?.length) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800, color: T.text2, marginBottom: 8 }}><Ic size={11} style={{ color }}/>{title}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((x, i) => <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.55, color: T.text }}><span style={{ color, flexShrink: 0 }}>•</span><span>{x}</span></li>)}
      </ul>
    </div>
  )
}
function ScoreRing({ score, grade, size = 96 }) {
  const c = GRADE_COLOR[grade] || GRADE_COLOR.cold, r = (size - 10) / 2, len = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(var(--ov),.08)" strokeWidth="8"/>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * len} ${len}`} style={{ transition: 'stroke-dasharray .6s' }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <b style={{ fontSize: size / 3.4, color: T.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{score}</b>
        <span style={{ fontSize: 10.5, color: T.text3 }}>/100</span>
      </div>
    </div>
  )
}

// ── main ───────────────────────────────────────────────────────────────────────
const WIDE_Q = '(min-width: 1100px)'
const CONV_KEY = 'afik_lead_card_conv'
// the automations config (the template library for the composer), read once per session
let CFG = null, cfgP = null
const loadCfg = () => (cfgP ||= autoApi.get('auto-config').then(d => (CFG = d?.config || null)).catch(() => { cfgP = null; return null }))
// a message from the card's conversation goes out like the chats tab's (Green API through /api/meta/chat-send)
const sendWa = async (phone, text, opts = {}) => {
  try {
    const r = await fetch('/api/meta/chat-send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer AFIKhanahal2026' }, body: JSON.stringify({ phone, message: text, ...(opts.image ? { image: opts.image } : {}), ...(opts.file ? { file: opts.file, fileName: opts.fileName || '' } : {}) }) })
    const d = await r.json().catch(() => ({}))
    return r.ok && d.ok ? { ok: true } : { ok: false, error: d.error || `HTTP ${r.status}`, quota: !!d.quota }
  } catch (e) { return { ok: false, error: e.message } }
}

export default function LeadCard({ lead, onClose, onUpdate, onUpdateStatus, onEnrich, onOpenChat, lang = 'he', stages = [], initialTab = 'details' }) {
  const t = TR[lang] || TR.he
  const dir = lang === 'en' ? 'ltr' : 'rtl'
  const [tab, setTab] = useState(initialTab)
  const { isDark } = useAdminTheme()
  // the whole WhatsApp conversation sits next to the details on a wide screen (hidden by choice, remembered)
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE_Q).matches)
  useEffect(() => { const m = window.matchMedia?.(WIDE_Q); if (!m) return; const f = () => setWide(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  const [convOn, setConvOn] = useState(() => { try { return localStorage.getItem(CONV_KEY) !== '0' } catch { return true } })
  const toggleConv = () => setConvOn(v => { try { localStorage.setItem(CONV_KEY, v ? '0' : '1') } catch {} return !v })
  const showConv = wide && convOn && !!lead.phone
  const [cfg, setCfg] = useState(CFG)
  useEffect(() => { if (lead.phone && !CFG) loadCfg().then(c => c && setCfg(c)) }, [lead.phone])
  const [saveState, setSaveState] = useState('')
  const [copied, setCopied] = useState(false)
  const dialogRef = useRef(null)
  const saveTimer = useRef(null)

  // Runs once per open. It used to depend on onClose — a new inline function on every parent render (polls, saves,
  // syncs) — so it re-ran while typing and pulled the focus out of the note box mid-word.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // Esc inside a text field leaves the field first; a second Esc closes the card
      const a = document.activeElement
      if (a && dialogRef.current?.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { a.blur(); dialogRef.current?.focus(); return }
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.activeElement
    dialogRef.current?.focus()
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [])

  // → Promise<boolean>: false when the server did not take it (updateLead answers null on a network error)
  const save = patch => {
    setSaveState('saving')
    return Promise.resolve(onUpdate(lead.id, patch)).then(r => r !== null && r?.ok !== false, () => false).then(ok => {
      setSaveState(ok ? 'saved' : 'error'); clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => setSaveState(''), ok ? 1600 : 6000)
      return ok
    })
  }
  const set = key => v => save({ [key]: v })

  const en = lead.enrichment || {}
  const isV2 = en.version === 2
  const enriching = en.status === 'enriching'
  const stage = stages.find(s => s.id === (lead.leadStatus || 'new')) || stages[0] || { id: 'new', label: 'ליד חדש', en: 'New', color: '#0073EA' }
  const notes = asNotes(lead.notes)
  const tasks = Array.isArray(lead.tasks) ? lead.tasks : []
  const openTasks = tasks.filter(x => !x.done).length
  const src = lead.source || (String(lead.id).startsWith('meta_') ? 'meta' : 'website')
  const campaign = leadCampaignTag(lead, lang)
  const campaignFull = leadCampaignFull(lead, lang)
  const stageName = id => { const g = stages.find(x => x.id === id); return g ? (lang === 'en' ? g.en : g.label) : (id || '') }

  // "+ הוספת הפרויקט": the project after the name ("סוזנה · זרובבל 15"), the same rename as everywhere (CRM, Lead Center, chats)
  const project = leadProject(lead)
  const projToggle = toggleProjectInName(lead.name, project)
  const projectBtn = project && lead.name ? (
    <button type="button" className="lcd-proj" onClick={() => save({ name: projToggle.next })} title={t.projectTip}>
      {projToggle.has ? t.removeProject : t.addProject(project)}
    </button>
  ) : null

  const copyMsg = async text => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }

  const header = (
    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <span style={{ width: 48, height: 48, borderRadius: '50%', background: avatarBg(lead.name), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800, flexShrink: 0, boxShadow: `0 4px 14px ${avatarBg(lead.name)}55` }}>{initials(lead.name)}</span>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 id="lc-title" style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {lead.name || t.none}
            {campaign && <span title={`${t.campaign}: ${campaignFull}`} style={{ fontSize: 14, fontWeight: 600, color: T.text3, marginInlineStart: 8 }}>(<bdi>{campaign}</bdi>)</span>}
          </h2>
          {isV2 && <span title={t.why} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px', borderRadius: 20, background: `${GRADE_COLOR[en.grade]}1f`, color: GRADE_COLOR[en.grade], fontSize: 12, fontWeight: 800 }}>{en.score100} · {t.gradeName[en.grade]}</span>}
          {saveState && <span role="status" style={{ fontSize: 11.5, color: saveState === 'saved' ? T.green : saveState === 'error' ? '#EF4444' : T.text3, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{saveState === 'saved' && <FaCheck size={9}/>}{saveState === 'saved' ? t.saved : saveState === 'error' ? t.saveFailed : t.saving}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label={t.f.dealType}>
          {stages.map(s => {
            const on = s.id === stage.id
            return <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => !on && (onUpdateStatus ? onUpdateStatus(lead, s.id) : save({ leadStatus: s.id }))}
              style={{ height: 26, padding: '0 10px', borderRadius: 20, border: `1px solid ${on ? s.color : T.s1Line}`, background: on ? s.color : 'transparent', color: on ? '#fff' : T.text2, fontSize: 11.5, fontWeight: 700, cursor: on ? 'default' : 'pointer', fontFamily: 'inherit' }}>{lang === 'en' ? s.en : s.label}</button>
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {lead.phone && <a className="lc-act" href={`tel:${lead.phone}`} style={{ background: 'rgba(0,115,234,.12)', color: '#3B8FF0', border: '1px solid rgba(0,115,234,.3)' }}><FaPhone size={11}/>{t.call}</a>}
        {lead.phone && onOpenChat && <button type="button" className="lc-act" onClick={() => { onOpenChat(lead); onClose() }} style={{ background: 'rgba(37,211,102,.12)', color: '#1FAF55', border: '1px solid rgba(37,211,102,.35)' }}><FaWhatsapp size={13}/>{t.wa}</button>}
        <FollowUpButton lead={lead} lang={lang} onSave={save}/>
        {lead.email && <a className="lc-act lc-hide-m" href={`mailto:${lead.email}`} style={{ background: 'rgba(226,68,92,.1)', color: '#E2445C', border: '1px solid rgba(226,68,92,.3)' }}><FaEnvelope size={11}/>{t.email}</a>}
        {onEnrich && <button type="button" className="lc-act" disabled={enriching} onClick={() => { onEnrich(lead); setTab('analysis') }} style={{ background: 'linear-gradient(135deg,var(--au-brand),var(--au-brand-deep))', color: '#fff', border: 'none', opacity: enriching ? .7 : 1 }}>
          {enriching ? <FaSyncAlt size={11} style={{ animation: 'lc-spin 1s linear infinite' }}/> : <FaMagic size={11}/>}{enriching ? t.analyzing : isV2 ? t.reanalyze : t.analyze}</button>}
        {wide && lead.phone && <button type="button" className="lc-act" aria-pressed={convOn} title={t.convTip} onClick={toggleConv} style={{ background: convOn ? 'rgba(37,211,102,.12)' : 'transparent', color: convOn ? '#1FAF55' : T.text2, border: `1px solid ${convOn ? 'rgba(37,211,102,.35)' : T.s1Line}` }}><FaComments size={12}/>{convOn ? t.convHide : t.convShow}</button>}
        <button type="button" onClick={onClose} aria-label={t.close} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${T.s1Line}`, background: 'transparent', color: T.text2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes size={13}/></button>
      </div>
    </div>
  )

  const tabs = [['details', FaUser, t.tabs.details], ['notes', FaStickyNote, t.tabs.notes, notes.length || null], ['chat', FaWhatsapp, t.tabs.chat, lead.chatSummary?.lastWord === 'lead' ? '!' : null], ['tasks', FaTasks, t.tabs.tasks, openTasks || null], ['analysis', FaChartPie, t.tabs.analysis]]
  const tabBar = (
    <div role="tablist" style={{ display: 'flex', gap: 2, padding: '0 14px', borderBottom: `1px solid ${T.line}`, overflowX: 'auto', flexShrink: 0 }}>
      {tabs.map(([id, Ic, label, badge]) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} className="lc-tab" onClick={() => setTab(id)} style={{ color: tab === id ? T.text : T.text3, borderBottomColor: tab === id ? 'var(--au-brand)' : 'transparent' }}>
          <Ic size={11}/>{label}{badge ? <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: T.brandSoft, color: T.brandText, fontSize: 10.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span> : null}
        </button>
      ))}
    </div>
  )

  // ── Details tab ───────────────────────────────────────────────────────────
  const [tagDraft, setTagDraft] = useState('')
  const tags = Array.isArray(lead.tags) ? lead.tags : []
  const details = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Section title={t.sec.contact} icon={FaUser}>
        <div className="lc-grid2">
          <Field label={t.f.name}><EditInput value={lead.name} onSave={set('name')}/>{projectBtn}{lead.originalName && lead.originalName !== lead.name && <div style={{ fontSize: 12, color: 'var(--au-text3)', marginTop: 4 }}>{lang === 'en' ? 'Name on the form' : 'השם בטופס'}: <b style={{ color: 'var(--au-text2)' }}><bdi>{lead.originalName}</bdi></b></div>}</Field>
          <Field label={t.f.phone}><EditInput value={lead.phone} onSave={set('phone')} dir="ltr"/></Field>
          <Field label={t.f.email}><EditInput value={lead.email} onSave={set('email')} type="email" dir="ltr"/></Field>
          <Field label={t.f.contactTime}><EditInput value={lead.contactTime} onSave={set('contactTime')} placeholder={lang === 'en' ? 'e.g. mornings, after 17:00' : 'למשל: בבקרים, אחרי 17:00'}/></Field>
        </div>
      </Section>
      <Section title={t.sec.need} icon={FaBullseye}>
        <div className="lc-grid3">
          <Field label={t.f.dealType}><EditSelect value={lead.dealType} options={t.opt.dealType} onSave={set('dealType')}/></Field>
          <Field label={t.f.propertyType}><EditInput value={lead.propertyType} onSave={set('propertyType')} placeholder={lang === 'en' ? 'Plot, apartment, house…' : 'מגרש, דירה, בית…'}/></Field>
          <Field label={t.f.area}><EditInput value={lead.area} onSave={set('area')} placeholder={lang === 'en' ? 'Hod Hasharon, Tel Mond…' : 'הוד השרון, תל מונד…'}/></Field>
          <Field label={t.f.budget}><EditInput value={lead.budget} onSave={set('budget')} type="number" dir="ltr" placeholder="2,500,000"/></Field>
          <Field label={t.f.timeline}><EditSelect value={lead.timeline} options={t.opt.timeline} onSave={set('timeline')}/></Field>
          <Field label={t.f.financing}><EditSelect value={lead.financing} options={t.opt.financing} onSave={set('financing')}/></Field>
          <Field label={t.f.rooms}><EditInput value={lead.rooms} onSave={set('rooms')} dir="ltr"/></Field>
        </div>
      </Section>
      <Section title={t.sec.prop} icon={FaBuilding}>
        <div className="lc-grid2">
          <Field label={t.f.propTitle}><EditInput value={lead.propTitle} onSave={set('propTitle')}/></Field>
          <Field label={t.f.propLocation}><EditInput value={lead.propLocation} onSave={set('propLocation')}/></Field>
        </div>
      </Section>
      <Section title={t.sec.msg} icon={FaComments}>
        <EditInput value={lead.msg} onSave={set('msg')} multiline rows={4}/>
      </Section>
      <Section title={t.sec.manage} icon={FaFlag}>
        <div className="lc-grid3">
          <Field label={t.f.priority}><EditSelect value={lead.priority} options={t.opt.priority} onSave={set('priority')}/></Field>
          <Field label={t.f.owner}><EditInput value={lead.owner} onSave={set('owner')}/></Field>
          <Field label={t.f.followUp}><DateTimePicker value={lead.followUp || ''} onChange={v => save(setNextFollowUp(lead, v))} format="local" lang={lang} presets={followUpPresets(Date.now(), lang)} label={t.f.followUp} style={{ width: '100%' }}/></Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label={t.f.tags}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {tags.map(g => <Chip key={g} onRemove={() => save({ tags: tags.filter(x => x !== g) })}>{g}</Chip>)}
              <input className="lc-in" style={{ width: 200, height: 30 }} value={tagDraft} placeholder={t.f.tagPh} onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && tagDraft.trim()) { e.preventDefault(); if (!tags.includes(tagDraft.trim())) save({ tags: [...tags, tagDraft.trim()] }); setTagDraft('') } }}/>
            </div>
          </Field>
        </div>
      </Section>
    </div>
  )

  // ── Notes & history tab ───────────────────────────────────────────────────
  // One composer (note / call / meeting / WhatsApp, a call also gets its outcome) and one timeline of everything that
  // happened to the lead: notes, calls, stage changes, automatic WhatsApp messages, analysis, finished tasks.
  const draftKey = `afik_lead_note_draft:${lead.id}`
  const [noteDraft, setNoteDraftRaw] = useState(() => { try { return localStorage.getItem(draftKey) || '' } catch { return '' } })
  const setNoteDraft = v => { setNoteDraftRaw(v); try { v ? localStorage.setItem(draftKey, v) : localStorage.removeItem(draftKey) } catch {} }
  const [noteKind, setNoteKind] = useState('note')
  const [outcome, setOutcome] = useState('')
  const [histFilter, setHistFilter] = useState('all')
  const [editId, setEditId] = useState(null), [editText, setEditText] = useState('')
  const [delId, setDelId] = useState(null)
  const noteRef = useRef(null)
  const grow = el => { if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 320)}px` } }
  useEffect(() => { grow(noteRef.current) }, [noteDraft, tab])
  const OUTCOME = { answered: { icon: '✅', color: '#22C55E' }, no_answer: { icon: '📵', color: '#F59E0B' }, callback: { icon: '🔁', color: '#3B8FF0' }, not_relevant: { icon: '🚫', color: '#94A3B8' } }
  const KIND = { note: { Ic: FaStickyNote, color: '#A25DDC' }, call: { Ic: FaPhone, color: '#3B8FF0' }, meeting: { Ic: FaHandshake, color: '#22C55E' }, wa: { Ic: FaWhatsapp, color: '#25D366' } }
  const canAdd = !!(noteDraft.trim() || (noteKind === 'call' && outcome))
  const addNote = () => {
    if (!canAdd) return
    const oc = noteKind === 'call' && outcome ? OUTCOME[outcome] : null
    // the outcome goes into the text too, so the board card's "last note" reads the same
    const text = [oc ? `${oc.icon} ${t.outcomes[outcome]}` : '', noteDraft.trim()].filter(Boolean).join(' · ')
    const note = { id: uid(), text, ts: Date.now(), kind: noteKind, ...(oc ? { outcome } : {}) }
    const patch = { notes: [...notes.filter(n => n.id !== 'legacy' || n.text), note] }
    if (noteKind === 'call') patch.lastCallAt = note.ts
    if (outcome === 'no_answer') patch.noAnswerCount = (Number(lead.noAnswerCount) || 0) + 1
    const cur = lead.leadStatus || 'new'
    const move = noteKind !== 'call' ? '' : outcome === 'not_relevant' && cur !== 'irrelevant' && stages.some(x => x.id === 'irrelevant') ? 'irrelevant'
      : outcome === 'answered' && cur === 'new' && stages.some(x => x.id === 'contacted') ? 'contacted' : ''
    // one PATCH after the other: the server merges each into crm_data, two at once could drop the note
    save(patch).then(ok => { if (ok && move) onUpdateStatus ? onUpdateStatus(lead, move) : ok && move && save({ leadStatus: move }) })
    setNoteDraft(''); setOutcome('')
    setTimeout(() => noteRef.current?.focus(), 0)
  }
  const saveEdit = n => { const text = editText.trim(); if (text && text !== n.text) save({ notes: notes.map(x => (x === n ? { ...x, id: x.id && x.id !== 'legacy' ? x.id : uid(), ts: x.ts || Date.now(), text, editedAt: Date.now() } : x)) }); setEditId(null) }

  const events = useMemo(() => {
    const ev = []
    notes.forEach((n, i) => {
      if (!n.text) return
      const kind = KIND[n.kind] ? n.kind : 'note'
      const oc = OUTCOME[n.outcome]
      // an old note without a date (a plain-text note from before) is shown at the lead's arrival, without a time
      ev.push({ key: `n${n.id || i}`, nk: n.id || `i${i}`, ts: n.ts || lead.ts || 1, undated: !n.ts, group: 'notes', note: n, kind, Ic: KIND[kind].Ic, color: oc ? oc.color : KIND[kind].color, title: t.kinds[kind] })
    })
    ;(Array.isArray(lead.stageLog) ? lead.stageLog : []).forEach((x, i) => x?.at && ev.push({ key: `s${i}`, ts: Number(x.at) || Date.parse(x.at), group: 'system', Ic: FaFlag, color: (stages.find(g => g.id === x.to) || {}).color || T.brandText, title: t.evStage(stageName(x.from || 'new'), stageName(x.to)) }))
    const sent = (lead.auto && lead.auto.sent) || {}
    Object.entries(sent).forEach(([k, at]) => {
      const ts = Date.parse(at) || Number(at); if (!ts) return
      const base = k.split(':')[0], n = k.split(':')[1]
      const title = base === 'noreply' ? t.evAuto.noreply(n) : (typeof t.evAuto[base] === 'string' ? t.evAuto[base] : t.evAuto.other)
      ev.push({ key: `a${k}`, ts, group: 'system', Ic: FaWhatsapp, color: '#25D366', title })
    })
    tasks.forEach(x => x.done && x.doneAt && ev.push({ key: `t${x.id}`, ts: x.doneAt, group: 'system', Ic: FaCheck, color: '#22C55E', title: t.evTaskDone, body: x.text }))
    if (isV2 && en.enrichedAt) ev.push({ key: 'an', ts: Date.parse(en.enrichedAt) || en.enrichedAt, group: 'system', Ic: FaChartPie, color: GRADE_COLOR[en.grade] || T.brandText, title: t.evAnalyzed(en.score100) })
    if (lead.ts) ev.push({ key: 'c', ts: lead.ts, group: 'system', Ic: FaUserCheck, color: sourceColor(src), title: t.evCreated, body: [sourceLabel(src, lang), campaignFull !== sourceLabel(src, lang) && !/^(אתר|Website)$/.test(campaignFull) ? campaignFull : ''].filter(Boolean).join(' · ') })
    return ev.filter(e => e.ts).sort((a, b) => b.ts - a.ts)
  }, [lead, notes, tasks, en.enrichedAt, en.score100, isV2, t, lang, campaignFull]) // eslint-disable-line
  const shown = events.filter(e => histFilter === 'all' || e.group === histFilter)
  const dayLabel = ts => {
    const d = new Date(ts), s = new Date(); s.setHours(0, 0, 0, 0)
    const diff = Math.round((s - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5)
    return diff === 0 ? t.dayToday : diff === 1 ? t.dayYesterday : d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
  }
  const timeOf = ts => new Date(ts).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'he-IL', { hour: '2-digit', minute: '2-digit' })
  const fuTs = lead.followUp ? Date.parse(lead.followUp) : 0
  const pill = (on, color) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 20, border: `1px solid ${on ? color : T.s1Line}`, background: on ? `${color}1f` : 'transparent', color: on ? color : T.text2, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })

  let lastDay = ''
  const notesTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Section title={t.newEntry} icon={FaPlus} right={noteDraft ? <span style={{ fontSize: 11, color: T.text3 }}>{t.draftKept}</span> : null}>
        <div role="radiogroup" aria-label={t.newEntry} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {Object.entries(KIND).map(([k, { Ic, color }]) => (
            <button key={k} type="button" role="radio" aria-checked={noteKind === k} onClick={() => { setNoteKind(k); if (k !== 'call') setOutcome(''); noteRef.current?.focus() }} style={pill(noteKind === k, color)}><Ic size={11}/>{t.kinds[k]}</button>
          ))}
        </div>
        {noteKind === 'call' && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text3, marginBottom: 6 }}>{t.outcome}</div>
            <div role="radiogroup" aria-label={t.outcome} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(OUTCOME).map(([k, o]) => <button key={k} type="button" role="radio" aria-checked={outcome === k} onClick={() => setOutcome(v => (v === k ? '' : k))} style={pill(outcome === k, o.color)}><span aria-hidden>{o.icon}</span>{t.outcomes[k]}</button>)}
            </div>
          </div>
        )}
        <textarea ref={noteRef} className="lc-in" rows={3} value={noteDraft} placeholder={t.kindPh[noteKind]} aria-label={t.kindPh[noteKind]}
          onChange={e => { setNoteDraft(e.target.value); grow(e.target) }} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote() } }}
          style={{ minHeight: 84, fontSize: 14 }}/>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: T.text3 }}>
            {noteKind === 'call' && outcome === 'not_relevant' && (lead.leadStatus || 'new') !== 'irrelevant' ? t.moveTo(stageName('irrelevant')) : noteKind === 'call' && outcome === 'answered' && (lead.leadStatus || 'new') === 'new' ? t.moveTo(stageName('contacted')) : ''}
          </span>
          <button type="button" className="lc-act" disabled={!canAdd} onClick={addNote} style={{ background: canAdd ? 'var(--au-brand)' : 'rgba(var(--ov),.06)', color: canAdd ? '#fff' : T.text3, border: 'none', cursor: canAdd ? 'pointer' : 'default' }}><FaPlus size={10}/>{t.save}</button>
        </div>
      </Section>

      <Section title={t.history} icon={FaClock} right={
        <div role="tablist" style={{ display: 'flex', gap: 4 }}>
          {Object.entries(t.filters).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={histFilter === k} onClick={() => setHistFilter(k)} style={{ height: 26, padding: '0 10px', borderRadius: 20, border: 'none', background: histFilter === k ? T.brandSoft : 'transparent', color: histFilter === k ? T.brandText : T.text3, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
        </div>}>
        {fuTs > 0 && (() => { const late = fuTs < Date.now(), c = late ? '#EF4444' : '#D97706'; return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: late ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.1)', border: `1px solid ${late ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.3)'}`, marginBottom: 12 }}>
            <FaCalendarAlt size={12} style={{ color: c }}/>
            <span style={{ fontSize: 13, fontWeight: 700, color: late ? c : T.text }}>{late ? t.overdueFu : t.upcoming}: {fmtWhen(fuTs, lang)}</span>
          </div>) })()}
        {!shown.length && <div style={{ fontSize: 13, color: T.text3, textAlign: 'center', padding: '18px 0' }}>{t.emptyHistory}</div>}
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
          {shown.map(e => {
            const day = dayLabel(e.ts), head = day !== lastDay
            lastDay = day
            const n = e.note
            return (
              <li key={e.key}>
                {head && <div style={{ fontSize: 11.5, fontWeight: 800, color: T.text3, margin: '10px 0 8px', paddingInlineStart: 40 }}>{day}</div>}
                <div className="lc-hist" style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: 12 }}>
                  <span aria-hidden style={{ position: 'absolute', insetInlineStart: 14, top: 30, bottom: 0, width: 2, background: T.divider }}/>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', background: `${e.color}1f`, color: e.color, border: `1px solid ${e.color}55`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}><e.Ic size={11}/></span>
                  <div style={{ flex: 1, minWidth: 0, ...(n ? { background: T.card, border: `1px solid ${T.s1Line}`, borderRadius: 12, padding: '10px 12px' } : { paddingTop: 5 }) }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: n ? 12 : 13, fontWeight: n ? 800 : 600, color: n ? e.color : T.text }}>{e.title}</span>
                      {!e.undated && <span style={{ fontSize: 11.5, color: T.text3 }}>{timeOf(e.ts)}{n?.editedAt ? ` · ${t.edited}` : ''}</span>}
                      {n && editId !== e.nk && delId !== e.nk && (
                        <span className="lc-hist-act" style={{ marginInlineStart: 'auto', display: 'inline-flex', gap: 2 }}>
                          <button type="button" aria-label={t.edit} title={t.edit} onClick={() => { setEditId(e.nk); setEditText(n.text) }} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', padding: 5, borderRadius: 6 }}><FaEdit size={11}/></button>
                          <button type="button" aria-label={t.del} title={t.del} onClick={() => setDelId(e.nk)} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', padding: 5, borderRadius: 6 }}><FaTrash size={11}/></button>
                        </span>
                      )}
                    </div>
                    {n && editId === e.nk ? (
                      <div style={{ marginTop: 8 }}>
                        <textarea autoFocus className="lc-in" value={editText} onChange={ev => { setEditText(ev.target.value); grow(ev.target) }} ref={grow}
                          onKeyDown={ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); saveEdit(n) } if (ev.key === 'Escape') { ev.preventDefault(); setEditId(null) } }} style={{ fontSize: 13.5 }}/>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                          <button type="button" className="lc-act" onClick={() => setEditId(null)} style={{ background: 'transparent', color: T.text2, border: `1px solid ${T.s1Line}` }}>{t.cancel}</button>
                          <button type="button" className="lc-act" onClick={() => saveEdit(n)} style={{ background: 'var(--au-brand)', color: '#fff', border: 'none' }}><FaCheck size={10}/>{t.save}</button>
                        </div>
                      </div>
                    ) : n ? (
                      <div style={{ fontSize: 13.5, color: T.text, whiteSpace: 'pre-wrap', lineHeight: 1.6, wordBreak: 'break-word', marginTop: 4 }}>{n.text}</div>
                    ) : e.body ? <div style={{ fontSize: 12.5, color: T.text2, marginTop: 2, wordBreak: 'break-word' }}>{e.body}</div> : null}
                    {n && delId === e.nk && (
                      <div role="alertdialog" aria-label={t.delQ} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#EF4444' }}>{t.delQ}</span>
                        <button type="button" className="lc-act" onClick={() => { save({ notes: notes.filter(x => x !== n) }); setDelId(null) }} style={{ height: 28, background: '#EF4444', color: '#fff', border: 'none' }}>{t.yes}</button>
                        <button type="button" className="lc-act" onClick={() => setDelId(null)} style={{ height: 28, background: 'transparent', color: T.text2, border: `1px solid ${T.s1Line}` }}>{t.no}</button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </Section>
    </div>
  )

  // ── Tasks tab ─────────────────────────────────────────────────────────────
  const [taskDraft, setTaskDraft] = useState(''), [taskDue, setTaskDue] = useState(''), [taskRemind, setTaskRemind] = useState(true)
  // a task with a time sends the office a WhatsApp reminder when it is due (lib/follow-up.js reminderText, like a follow-up)
  const addTask = () => {
    const text = taskDraft.trim(); if (!text) return
    const due = dueIso(taskDue)
    save({ tasks: [...tasks, { id: uid(), text, due, done: false, createdAt: Date.now(), kind: 'task', remind: !!due && taskRemind }] }); setTaskDraft(''); setTaskDue('')
  }
  const plainTasks = tasks.filter(x => x.kind !== 'followup' || x.done)   // open follow-ups have their own list above
  const dueTone = d => { if (!d) return null; const x = Date.parse(d), s = new Date(); s.setHours(0, 0, 0, 0); if (x < s.getTime()) return ['#EF4444', t.overdue]; if (x < s.getTime() + 864e5) return ['#F59E0B', t.today]; return [T.text3, new Date(x).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'short' })] }
  const taskRow = x => {
    const tone = dueTone(x.due)
    return (
      <div key={x.id} className="lcd-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10 }}>
        <button type="button" role="checkbox" aria-checked={!!x.done} onClick={() => save({ tasks: tasks.map(y => (y.id === x.id ? { ...y, done: !y.done, doneAt: !y.done ? Date.now() : null } : y)) })}
          style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${x.done ? '#22C55E' : T.s3Line}`, background: x.done ? '#22C55E' : 'transparent', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{x.done && <FaCheck size={9}/>}</button>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: x.done ? T.text3 : T.text, textDecoration: x.done ? 'line-through' : 'none' }}>{x.text}</span>
        {tone && !x.done && <span title={x.due ? describeDue(x.due, { lang }) : undefined} style={{ fontSize: 11.5, fontWeight: 700, color: tone[0], whiteSpace: 'nowrap' }}>{tone[1]}{/T\d/.test(String(x.due)) ? ` · ${new Date(x.due).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}` : ''}</span>}
        {!x.done && x.remind && <span title={x.remindedAt ? t.taskReminded : t.taskRemindOn} style={{ display: 'inline-flex', color: x.remindedAt ? T.green : '#1FAF55' }}><FaWhatsapp size={12}/></span>}
        <button type="button" aria-label="delete" onClick={() => save({ tasks: tasks.filter(y => y.id !== x.id) })} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', padding: 4 }}><FaTrash size={11}/></button>
      </div>
    )
  }
  const tasksTab = (
    <>
    <Section title={t.fuTitle} icon={FaClock}>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: T.text2, lineHeight: 1.6 }}>{t.fuSub}</p>
      <FollowUpComposer lead={lead} lang={lang} onSave={save}/>
      <div style={{ marginTop: 12 }}><FollowUpList lead={lead} lang={lang} onSave={save}/></div>
    </Section>
    <Section title={t.tabs.tasks} icon={FaTasks}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="lc-in" style={{ flex: '1 1 240px' }} value={taskDraft} placeholder={t.taskPh} onChange={e => setTaskDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTask() }}/>
        <DateTimePicker value={taskDue} onChange={setTaskDue} format="iso" lang={lang} label={t.due} placeholder={t.due} presets={followUpPresets(Date.now(), lang)}/>
        <label className="fu-bell" title={t.taskRemindTip} style={{ opacity: taskDue ? 1 : .55 }}>
          <input type="checkbox" checked={taskRemind} onChange={e => setTaskRemind(e.target.checked)}/>
          <span className="fu-sw" aria-hidden="true"/>
          <FaWhatsapp size={12} style={{ color: '#1FAF55' }}/>{t.taskRemind}
        </label>
        <button type="button" className="lc-act" onClick={addTask} disabled={!taskDraft.trim()} style={{ background: taskDraft.trim() ? 'var(--au-brand)' : 'rgba(var(--ov),.06)', color: taskDraft.trim() ? '#fff' : T.text3, border: 'none', height: 38 }}><FaPlus size={10}/>{t.addTask}</button>
      </div>
      <div style={{ marginTop: 12 }}>
        {!plainTasks.filter(x => !x.done).length && <div style={{ fontSize: 13, color: T.text3, textAlign: 'center', padding: '14px 0' }}>{t.noTasks}</div>}
        {plainTasks.filter(x => !x.done).sort((a, b) => (Date.parse(a.due) || 9e15) - (Date.parse(b.due) || 9e15)).map(taskRow)}
        {plainTasks.some(x => x.done) && <>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.text3, margin: '12px 10px 4px' }}>{t.done}</div>
          {plainTasks.filter(x => x.done).map(taskRow)}
        </>}
      </div>
    </Section>
    </>
  )

  // ── Analysis tab ──────────────────────────────────────────────────────────
  const b = en.brief || {}
  const rs = en.research || null   // prospect research (lib/lead-research.js): identity, phone, profiles, flags, hooks
  const sig = en.signals || {}
  const factorGroups = useMemo(() => {
    const g = {}
    for (const f of en.factors || []) (g[f.group] = g[f.group] || []).push(f)
    return Object.entries(g)
  }, [en.factors])
  const nextText = b.nextBestAction || (en.next ? (lang === 'en' ? en.next.en : en.next.he) : '')
  const askList = [...(b.questionsToAsk || []), ...((en.missing || []).map(m => (lang === 'en' ? m.en : m.he)))].filter((x, i, a) => a.indexOf(x) === i).slice(0, 6)
  const analysis = !isV2 ? (
    <Section title={t.tabs.analysis} icon={FaChartPie}>
      <div style={{ textAlign: 'center', padding: '22px 10px' }}>
        <span style={{ width: 56, height: 56, borderRadius: '50%', background: T.brandSoft, color: T.brandText, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaMagic size={20}/></span>
        <h3 style={{ margin: '12px 0 6px', fontSize: 16, color: T.text }}>{en.status === 'done' ? t.legacy : t.noAnalysis}</h3>
        <p style={{ margin: '0 auto 16px', maxWidth: 520, fontSize: 13, lineHeight: 1.6, color: T.text2 }}>{t.noAnalysisSub}</p>
        {en.notes && <p style={{ margin: '0 auto 16px', maxWidth: 560, fontSize: 13, lineHeight: 1.6, color: T.text, background: 'rgba(var(--ov),.03)', borderRadius: 10, padding: 12, textAlign: 'start' }}>{en.notes}</p>}
        {onEnrich && <button type="button" className="lc-act" disabled={enriching} onClick={() => onEnrich(lead)} style={{ background: 'linear-gradient(135deg,var(--au-brand),var(--au-brand-deep))', color: '#fff', border: 'none', height: 40, padding: '0 18px', fontSize: 13.5 }}>
          {enriching ? <FaSyncAlt size={12} style={{ animation: 'lc-spin 1s linear infinite' }}/> : <FaMagic size={12}/>}{enriching ? (en.stage === 'research' ? t.researching : en.stage === 'brief' ? t.briefing : t.analyzing) : t.analyze}</button>}
      </div>
    </Section>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: enriching ? .6 : 1, transition: 'opacity .2s' }}>
      <Section title={t.tabs.analysis} icon={FaChartPie} right={<span style={{ fontSize: 11.5, color: T.text3 }}>{t.analyzedAt(fmtWhen(en.enrichedAt, lang))}</span>}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <ScoreRing score={en.score100} grade={en.grade}/>
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: GRADE_COLOR[en.grade] }}>{t.gradeName[en.grade]}</span>
              <span style={{ fontSize: 12, color: T.text3 }}>{t.rules} {en.ruleScore}{en.adjustment ? ` · ${t.aiAdj} ${en.adjustment > 0 ? '+' : ''}${en.adjustment}` : ''}</span>
              {b.confidence && <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text2, background: 'rgba(var(--ov),.05)', borderRadius: 20, padding: '2px 9px' }}>{t.conf[b.confidence]}</span>}
            </div>
            {(b.summary || en.scoreReason) && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: T.text }}>{b.summary || en.scoreReason}</p>}
            {b.scoreAdjustmentReason && en.adjustment !== 0 && <div style={{ fontSize: 12, color: T.text3 }}>{t.aiAdj}: {b.scoreAdjustmentReason}</div>}
          </div>
        </div>
        {en.aiError && (
          <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '9px 12px', borderRadius: 10, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', fontSize: 12.5, color: T.amberText }}>
            <FaInfoCircle size={12} style={{ flexShrink: 0, marginTop: 2 }}/><span>{t.aiOff} {(en.aiCode && t.aiFix?.[en.aiCode]) || en.aiError}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {[
            [t.signals.budget, sig.budget ? shekel(sig.budget) : (b.budgetRange && b.budgetRange)],
            [t.signals.dealType, t.dt[sig.dealType] || (b.dealType && t.dt[b.dealType])],
            [t.signals.timeline, t.tl[sig.timeline]],
            [t.signals.financing, t.fin[sig.financing]],
            [t.signals.inbound, sig.inbound || null],
            [t.signals.repeats, sig.repeats || null],
            [t.signals.listing, sig.listingPrice ? shekel(sig.listingPrice) : null],
          ].filter(x => x[1]).map(([k, v]) => (
            <span key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline', padding: '6px 10px', borderRadius: 10, background: 'rgba(var(--ov),.04)', border: `1px solid ${T.divider}`, fontSize: 12 }}><span style={{ color: T.text3 }}>{k}</span><b style={{ color: T.text }}>{v}</b></span>
          ))}
        </div>
      </Section>

      {nextText && (
        <Section title={t.next} icon={FaBullseye}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1.55 }}>{nextText}</p>
          {(b.openingLine || rs?.opener) && <div style={{ marginTop: 8, fontSize: 13, color: T.text, lineHeight: 1.55 }}><span style={{ fontSize: 12, fontWeight: 800, color: T.text3 }}>{t.opener}: </span><span dir="auto">“{b.openingLine || rs.opener}”</span></div>}
          {b.warmUpPlan?.length > 0 && (
            <ol style={{ margin: '10px 0 0', paddingInlineStart: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {b.warmUpPlan.map((x, i) => <li key={i} style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{x}</li>)}
            </ol>
          )}
          {(b.bestTimeToContact || en.bestHour != null) && <div style={{ fontSize: 12.5, color: T.text3, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}><FaClock size={10}/>{t.bestTime}: {b.bestTimeToContact || `${String(en.bestHour).padStart(2, '0')}:00`}</div>}
          {b.suggestedMessage && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.text2, marginBottom: 6 }}>{t.msgSuggest}</div>
              <div dir="auto" style={{ background: '#DCF8C6', color: '#111B21', borderRadius: '12px 12px 4px 12px', padding: '10px 12px', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', maxWidth: 520 }}>{b.suggestedMessage}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="lc-act" onClick={() => copyMsg(b.suggestedMessage)} style={{ background: 'rgba(var(--ov),.05)', color: T.text2, border: `1px solid ${T.s1Line}` }}><FaCopy size={10}/>{copied ? t.copied : t.copy}</button>
                {onOpenChat && lead.phone && <button type="button" className="lc-act" onClick={() => { copyMsg(b.suggestedMessage); onOpenChat(lead); onClose() }} style={{ background: 'rgba(37,211,102,.12)', color: '#1FAF55', border: '1px solid rgba(37,211,102,.35)' }}><FaWhatsapp size={12}/>{t.openChat}</button>}
              </div>
            </div>
          )}
        </Section>
      )}

      {(rs || en.version === 2) && (
        <Section title={t.who} icon={FaUserCheck} right={rs && !rs.error ? <span style={{ fontSize: 11.5, color: T.text3 }}>{t.dataQ[rs.dataQuality] || ''}{rs.searches ? ` · ${t.searches(rs.searches)}` : ''}</span> : null}>
          {!rs ? <p style={{ margin: 0, fontSize: 13, color: T.text3 }}>{t.noResearch}</p> : rs.error ? (
            <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 12px', borderRadius: 10, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', fontSize: 12.5, color: T.amberText }}><FaInfoCircle size={12} style={{ flexShrink: 0, marginTop: 2 }}/><span>{t.researchOff} {(rs.code && t.aiFix?.[rs.code]) || rs.error}</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {(() => { const v = rs.identity?.verdict || 'unverified'; const col = v === 'confirmed' ? '#22C55E' : v === 'likely' ? '#60A5FA' : v === 'mismatch' ? '#EF4444' : '#F59E0B'; return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 20, fontSize: 12.5, fontWeight: 800, color: col, background: `${col}1f`, border: `1px solid ${col}55` }}><FaUserCheck size={11}/>{t.verdict[v]}{rs.identity?.confidence ? ` · ${t.conf[rs.identity.confidence]}` : ''}</span> })()}
                {rs.phoneCheck && <span title={(rs.phoneCheck.notes || []).join(' · ')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, fontSize: 12, color: rs.phoneCheck.valid && rs.phoneCheck.type === 'mobile' && !(rs.phoneCheck.notes || []).length ? T.text2 : '#F59E0B', background: 'rgba(var(--ov),.05)', border: `1px solid ${T.divider}` }}><FaPhone size={10}/>{t.phoneTypes[rs.phoneCheck.type] || rs.phoneCheck.type}{rs.phoneCheck.carrier ? ` · ${rs.phoneCheck.carrier}` : rs.phoneCheck.area ? ` · ${rs.phoneCheck.area}` : ''}{(rs.phoneCheck.notes || []).some(n => /made up/.test(n)) ? ' · ⚠' : ''}</span>}
                {rs.nameCheck && rs.nameCheck.quality !== 'full' && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, fontSize: 12, color: '#F59E0B', background: 'rgba(var(--ov),.05)', border: `1px solid ${T.divider}` }}><FaUser size={10}/>{t.nameQ[rs.nameCheck.quality] || rs.nameCheck.quality}</span>}
                {rs.realEstate?.isProfessional && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.35)' }}><FaBuilding size={10}/>{t.rePro}{rs.realEstate.kind ? ` · ${rs.realEstate.kind}` : ''}</span>}
              </div>
              {(rs.identity?.who || b.identityCheck) && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: T.text }}>{b.identityCheck || rs.identity.who}</p>}
              {b.identityCheck && rs.identity?.who && rs.identity.who !== b.identityCheck && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: T.text2 }}>{rs.identity.who}</p>}
              {(rs.professional?.occupation || rs.professional?.company) && <div style={{ fontSize: 13, color: T.text }}><span style={{ fontSize: 12, fontWeight: 800, color: T.text3 }}>{t.professional}: </span>{[rs.professional.occupation, rs.professional.role, rs.professional.company, rs.professional.location].filter(Boolean).join(' · ')}{rs.professional.sourceUrl && <a href={rs.professional.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ marginInlineStart: 6, color: T.brandText }}><FaExternalLinkAlt size={10}/></a>}</div>}
              {rs.phone?.publicOwner && <div style={{ fontSize: 13, color: T.text }}><span style={{ fontSize: 12, fontWeight: 800, color: T.text3 }}>{t.publicOwner}: </span>{rs.phone.publicOwner}</div>}
              {(rs.identity?.matchedBy?.length > 0 || rs.identity?.toConfirm?.length > 0) && (
                <div className="lc-grid2">
                  {rs.identity.matchedBy?.length > 0 && <div><div style={{ fontSize: 12, fontWeight: 800, color: T.text3, marginBottom: 4 }}>{t.matchedBy}</div><div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{rs.identity.matchedBy.join(' · ')}</div></div>}
                  {rs.identity.toConfirm?.length > 0 && <div><div style={{ fontSize: 12, fontWeight: 800, color: T.text3, marginBottom: 4 }}>{t.toConfirm}</div><div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{rs.identity.toConfirm.join(' · ')}</div></div>}
                </div>
              )}
              {rs.profiles?.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800, color: T.text2, marginBottom: 8 }}><FaSearch size={11} style={{ color: T.brandText }}/>{t.profiles}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {rs.profiles.map((pr, i) => (
                      <a key={i} href={pr.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13, color: T.text, textDecoration: 'none', padding: '6px 10px', borderRadius: 8, background: 'rgba(var(--ov),.04)', border: `1px solid ${T.divider}` }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: T.brandText, textTransform: 'uppercase', flexShrink: 0 }}>{pr.network}</span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.title || pr.url}{pr.note ? <span style={{ color: T.text3 }}> — {pr.note}</span> : null}</span>
                        <span style={{ fontSize: 11, color: T.text3, flexShrink: 0 }}>{t.conf[pr.confidence]}</span>
                        <FaExternalLinkAlt size={10} style={{ color: T.text3, flexShrink: 0 }}/>
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <ListBlock title={t.flags} icon={FaExclamationTriangle} items={rs.redFlags} color="#EF4444"/>
              <ListBlock title={t.hooks} icon={FaHandshake} items={b.rapportHooks?.length ? b.rapportHooks : rs.hooks} color="#22C55E"/>
              <ListBlock title={t.verify} icon={FaQuestionCircle} items={rs.verifyQuestions} color="#60A5FA"/>
              {rs.sources?.length > 0 && <div style={{ fontSize: 11.5, color: T.text3, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}><span style={{ fontWeight: 800 }}>{t.sources}:</span>{rs.sources.slice(0, 6).map((sc, i) => <a key={i} href={sc.url} target="_blank" rel="noopener noreferrer" style={{ color: T.brandText, textDecoration: 'none' }}>{sc.title || new URL(sc.url).hostname}</a>)}</div>}
            </div>
          )}
        </Section>
      )}

      <Section title={t.why} icon={FaChartPie}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {factorGroups.map(([g, list]) => {
            const sum = list.reduce((n, f) => n + f.points, 0)
            return (
              <div key={g}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: T.text2, flex: 1 }}>{t.groups[g] || g}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: sum >= 0 ? '#22C55E' : '#EF4444', fontVariantNumeric: 'tabular-nums' }}>{sum > 0 ? '+' : ''}{sum}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {list.map(f => (
                    <span key={f.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 8, fontSize: 12, background: f.points > 0 ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: T.text, border: `1px solid ${f.points > 0 ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}` }}>
                      {f.points > 0 ? <FaArrowUp size={8} style={{ color: '#22C55E' }}/> : <FaArrowDown size={8} style={{ color: '#EF4444' }}/>}{lang === 'en' ? f.en : f.he}<b style={{ fontVariantNumeric: 'tabular-nums', color: f.points > 0 ? '#16A34A' : '#DC2626' }}>{f.points > 0 ? '+' : ''}{f.points}</b>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {(b.persona || b.motivation || askList.length || b.talkingPoints?.length || b.objections?.length || b.risks?.length || b.keyNeeds?.length) && (
        <Section title={t.brief} icon={FaLightbulb}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(b.persona || b.motivation) && (
              <div className="lc-grid2">
                {b.persona && <div><div style={{ fontSize: 12, fontWeight: 800, color: T.text3, marginBottom: 4 }}>{t.persona}</div><div style={{ fontSize: 13, color: T.text, lineHeight: 1.55 }}>{b.persona}</div></div>}
                {b.motivation && <div><div style={{ fontSize: 12, fontWeight: 800, color: T.text3, marginBottom: 4 }}>{t.motivation}</div><div style={{ fontSize: 13, color: T.text, lineHeight: 1.55 }}>{b.motivation}</div></div>}
              </div>
            )}
            <ListBlock title={t.ask} icon={FaQuestionCircle} items={askList} color="#60A5FA"/>
            <ListBlock title={t.points} icon={FaComments} items={b.talkingPoints} color="var(--au-brand-text)"/>
            <ListBlock title={t.needs} icon={FaBullseye} items={b.keyNeeds} color="#22C55E"/>
            <ListBlock title={t.objections} icon={FaShieldAlt} items={b.objections} color="#F59E0B"/>
            <ListBlock title={t.risks} icon={FaExclamationTriangle} items={b.risks} color="#EF4444"/>
          </div>
        </Section>
      )}
    </div>
  )

  // ── Side column: at-a-glance ──────────────────────────────────────────────
  const side = (
    <aside className="lc-side" style={{ borderInlineStart: `1px solid ${T.line}`, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, background: 'rgba(var(--ov),.015)' }}>
      {isV2 && (
        <button type="button" onClick={() => setTab('analysis')} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 12, border: `1px solid ${T.s1Line}`, background: T.card, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start', color: T.text }}>
          <ScoreRing score={en.score100} grade={en.grade} size={58}/>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: GRADE_COLOR[en.grade] }}>{t.gradeName[en.grade]}</span>
            <span style={{ display: 'block', fontSize: 12, color: T.text2, lineHeight: 1.45 }}>{nextText.slice(0, 90)}</span>
          </span>
        </button>
      )}
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.text3, marginBottom: 8 }}>{t.sec.source}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip color={sourceColor(src)}>{sourceLabel(src, lang)}</Chip>
        </div>
        {lead.campaignName && <div style={{ fontSize: 12.5, color: T.text2, marginTop: 8 }}>{t.campaign}: <b style={{ color: T.text }}>{lead.campaignName}</b></div>}
        {lead.formName && <div style={{ fontSize: 12.5, color: T.text2, marginTop: 4 }}>{t.form}: <b style={{ color: T.text }}>{lead.formName}</b></div>}
        {Array.isArray(lead.formAnswers) && lead.formAnswers.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text3 }}>{t.answers}</div>
            {lead.formAnswers.map((x, i) => <div key={i} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.5 }}><span style={{ color: T.text3 }}>{x.q}:</span> {x.a}</div>)}
          </div>
        )}
        {originLines(lead.origin, lang).length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {originLines(lead.origin, lang).map((x, i) => <div key={i} dir="ltr" style={{ fontSize: 11.5, color: T.text3, wordBreak: 'break-all', textAlign: dir === 'rtl' ? 'right' : 'left' }}><span style={{ color: T.text2 }}>{x.q}:</span> {x.a}</div>)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: T.text2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FaCalendarAlt size={10}/>{t.created}: {fmtWhen(lead.ts, lang)}</span>
        {lead.followUp && <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: Date.parse(lead.followUp) < Date.now() ? '#EF4444' : T.text2 }}><FaClock size={10}/>{t.f.followUp}: {fmtWhen(Date.parse(lead.followUp), lang)}</span>}
        {(lead.area || lead.propLocation) && <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FaMapMarkerAlt size={10}/>{lead.area || lead.propLocation}</span>}
        {lead.budget ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FaBullseye size={10}/>{shekel(lead.budget)}</span> : null}
        {!!openTasks && <button type="button" onClick={() => setTab('tasks')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, color: T.brandText, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700 }}><FaTasks size={10}/>{openTasks} {t.tabs.tasks}</button>}
        {tags.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><FaTag size={10}/>{tags.map(g => <Chip key={g}>{g}</Chip>)}</span>}
      </div>
    </aside>
  )

  const conversation = lead.phone ? (
    <LeadConversation key={lead.id} lead={lead} tplLead={lead} lang={lang} isDark={isDark} autoConfig={cfg}
      onAutoConfigSaved={c => { CFG = c; setCfg(c) }} onSend={(text, opts) => sendWa(lead.phone, text, opts)}
      onOpenChats={onOpenChat ? () => { onOpenChat(lead); onClose() } : undefined}/>
  ) : null

  return createPortal(
    <div className="lc lcd" dir={dir} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 2400, background: 'var(--au-overlay)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'min(3vh,24px) 12px' }}>
      <style>{CSS}</style>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="lc-title" className="lc-dialog"
        style={{ width: showConv ? 'min(1640px,100%)' : 'min(1180px,100%)', height: showConv ? 'min(960px,100%)' : 'min(880px,100%)', background: T.s2, border: `1px solid ${T.s2Line}`, borderRadius: 18, boxShadow: T.shadow2, color: T.text, display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none', animation: 'lc-in .22s cubic-bezier(.2,.8,.2,1) both' }}>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${stage.color}, ${stage.color}88)`, flexShrink: 0 }}/>
        {header}
        {tabBar}
        <div className={`lc-body${showConv ? ' conv' : ''}`}>
          <div className="lc-main" style={{ overflowY: 'auto', padding: 16, background: T.bg }}>
            {tab === 'details' ? details : tab === 'notes' ? notesTab : tab === 'chat' ? <><LeadChatTab lead={lead} lang={lang} stages={stages} save={save} onUpdateStatus={onUpdateStatus} onOpenChat={onOpenChat} onClose={onClose} hideConversation={!!lead.phone}/>{!showConv && lead.phone && <div className="lc-conv-tab">{conversation}</div>}</> : tab === 'tasks' ? tasksTab : analysis}
          </div>
          {side}
          {showConv && <section className="lc-conv" aria-label={t.tabs.chat}>{conversation}</section>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
