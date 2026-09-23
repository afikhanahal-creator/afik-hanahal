// ─── ADMIN: WhatsApp automations ("אוטומציות") ─────────────────────────────────
// Redesign (spec by the design pass): header with system-status pill + master switch · sticky sub-nav
//   היום (approvals + what goes out next) · תבניות · כללים · שעות שליחה · שליחה מרובה · יומן
// plus the "מצב המערכת" drawer. rules / quiet / vars share one draft and one sticky save bar.
// Server: lib/automations.js via /api/meta/auto-*. Shared logic: lib/automations-shared.js.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { FaRobot, FaInbox, FaCommentDots, FaProjectDiagram, FaClock, FaBullhorn, FaHistory, FaSyncAlt, FaWhatsapp, FaPaperPlane, FaTimes, FaPen, FaCheckCircle, FaCalendarCheck, FaMoon, FaEllipsisV, FaArrowLeft, FaArrowRight, FaCheck, FaTimesCircle, FaSearch, FaRedo, FaUserSlash, FaDatabase, FaPowerOff, FaHeartbeat, FaSatelliteDish, FaExternalLinkAlt, FaChevronDown, FaExclamationTriangle } from 'react-icons/fa'
import { DEFAULT_CONFIG, STAGES, templateList, renderTemplate, mergeConfig, ruleKind, isSendWindow, nextSendWindow, nextWindows, fmtHour, israelNow, classifyReply, matchedKeyword } from '../lib/automations-shared.js'
import { autoApi } from './AutomationsApi.jsx'
import { T, AUTO_CSS, Button, IconButton, Card, Badge, FilterChip, Toggle, ModeSwitch, ModeBadge, StatTile, EmptyState, Skeleton, InlineError, Drawer, HealthItem, StatusPill, CopyField, SaveBar, useToasts, ConfirmProvider, useConfirm, Popover, MenuButton, MenuItem, MODE_COLOR, inputStyle, Field } from './automationsUI.jsx'
import { WAText } from './waFormat.jsx'
import HoursTab from './WeekSchedule.jsx'
import SequenceBuilder from './SequenceBuilder.jsx'
import TemplatesTab from './TemplateStudio.jsx'
import CampaignsTab, { whenText } from './CampaignsTab.jsx'

const TR = {
  he: {
    title: 'אוטומציות וואטסאפ', subtitle: 'הודעות מוכנות לכל מתעניין – בלחיצה או אוטומטית',
    tabs: { today: 'היום', templates: 'תבניות', rules: 'כללים', hours: 'שעות שליחה', campaigns: 'שליחה מרובה', log: 'יומן' },
    tabsM: { today: 'היום', templates: 'תבניות', rules: 'כללים', hours: 'שעות', campaigns: 'שליחה', log: 'יומן' },
    todayAria: n => `היום, ${n} ממתינות לאישור`,
    masterOn: 'אוטומציות פעילות', masterOff: 'אוטומציות כבויות',
    masterOffBanner: 'האוטומציות כבויות. שום הודעה לא נשלחת לבד ושום דבר לא נכנס לתור.', turnOn: 'הפעל',
    confirmOffTitle: 'לכבות את כל האוטומציות?', confirmOffBody: 'הודעות פתיחה, תזכורות והודעות שלב יפסיקו לצאת עד שתפעילו מחדש.', confirmOffBtn: 'כבה',
    pillOk: 'המערכת תקינה', pillWarn: n => `דורש תשומת לב (${n})`, pillErr: 'לא שולח', pillChecking: 'בודק…',
    storageBanner: 'השינויים לא נשמרים – חסרות טבלאות במסד הנתונים.', howToFix: 'איך מתקנים',
    runNow: 'הרץ עכשיו', runNowTip: 'שולח את מה שהגיע זמנו ומעדכן את התור',
    unsaved: 'יש שינויים שלא נשמרו', discard: 'בטל שינויים', saveChanges: 'שמור שינויים', saving: 'שומר…', saved: 'נשמר ✓', saveError: e => `השמירה נכשלה: ${e}`,
    cancel: 'ביטול', close: 'סגור', undo: 'בטל', retry: 'נסה שוב', error: 'שגיאה',
    inMin: n => `עוד ${n} דק׳`, inHours: n => `עוד ${n} שע׳`, inDays: n => `עוד ${n} ימים`, now: 'עכשיו',
    // today
    filterAll: 'הכל', filterApprove: 'לאישור', filterAuto: 'אוטומטי',
    waiting: 'מחכות לאישור שלך', sendAll: n => `שלח את כולן (${n})`, sendAllConfirm: n => `לשלוח עכשיו ${n} הודעות וואטסאפ?`, send: 'שלח',
    upcoming: 'מתוזמנות', grpHours: 'בשעות הקרובות', grpTomorrow: 'מחר', grpWeek: 'השבוע', heldQuiet: 'ממתין לשעות השליחה',
    sendNow: 'שלח עכשיו', skip: 'דלג', openChat: 'פתח צ׳אט', editMsg: 'ערוך הודעה', revertMsg: 'שחזר נוסח', edited: 'נערך',
    sentTo: n => `נשלח ל${n}`, skipped: n => `דילגת על ${n}`, outsideConfirm: 'עכשיו מחוץ לשעות השליחה. לשלוח בכל זאת?', outsideBtn: 'שלח בכל זאת',
    emptyApproveT: 'אין מה לאשר כרגע', emptyApproveB: 'הודעות שדורשות אישור יופיעו כאן.',
    emptyUpcomingT: 'אין הודעות מתוזמנות לשבוע הקרוב', emptyUpcomingB: 'תזכורות נוצרות כשליד לא עונה. אפשר לשנות את הרצף בלשונית ״כללים״.', goRules: 'לכללים',
    loadErr: 'לא הצלחנו לטעון את התור',
    winOpen: 'פתוח לשליחה', winOpenSub: t => `נסגר היום ב-${t}`, winClosed: 'סגור לשליחה', winClosedSub: (d, t) => `נפתח ${d} ב-${t}`, winNone: 'אין חלון שליחה קרוב', winUnlimited: 'ללא הגבלת שעות', editHours: 'ערוך שעות',
    kpiPending: 'ממתינות לאישור', kpiSent: 'נשלחו השבוע', kpiPos: 'ענו בחיוב', kpiFail: 'נכשלו השבוע',
    nextCampaign: 'השליחה המתוזמנת הבאה', open: 'פתח', bulkRow: n => `שליחה מרובה · ${n} לידים`,
    howItWorks: 'ככה זה עובד', flow1: tp => `ליד חדש ← מקבל מיד את ״${tp}״`, flow2: (n, d) => `לא ענה ← עד ${n} תזכורות לאורך ${d} ימים`, flow3: 'ענה ← התזכורות נעצרות והצוות מקבל התראה',
    days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'], dShort: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'], today: 'היום', tomorrow: 'מחר',
    kind: { welcome: 'פתיחה', noreply: 'לא ענה', reply: 'תשובה', stage: 'שלב', reengage: 'חזרה', manual: 'ידני', tpl: 'שליחה מרובה', test: 'בדיקה' },
    modesBadge: { off: 'כבוי', suggest: 'יחכה לאישור', auto: 'יישלח אוטומטית' },
    // rules
    legendIntro: 'לכל כלל שלושה מצבים:', legend: { off: 'כבוי – לא נשלח כלום', suggest: 'לאישור – ההודעה מחכה לך בלשונית ״היום״', auto: 'אוטומטי – נשלח לבד' },
    modes: { off: 'כבוי', suggest: 'לאישור', auto: 'אוטומטי' },
    helpOff: 'הכלל כבוי – לא יישלח כלום', helpSuggest: 'ההודעות יחכו לאישור שלך בלשונית ״היום״', helpAuto: 'נשלח לבד, בתוך שעות השליחה', helpAutoNow: 'נשלח לבד, מיד',
    wS1a: 'כשנכנס', wS1b: 'ליד חדש', wS1c: '← שלח', wS2: 'אם התעניין בנכס מסוים ← שלח במקום', welcomeHelp: 'הודעת הפתיחה יוצאת מיד, גם מחוץ לשעות השליחה.',
    nrA: 'כשליד בשלבים', nrB: 'לא עונה', nrC: n => `← שלח עד ${n} תזכורות`, stagesPick: 'שלבים',
    rS: ['כשליד', 'עונה', '← התזכורות נעצרות והמערכת מזהה מה הוא רוצה'], notifyTeam: 'שלח התראה לצוות בוואטסאפ',
    negTitle: 'ענה ״לא תודה״', negNote: 'מעכשיו לא יקבל יותר הודעות אוטומטיות.', posTitle: 'רוצה להתקדם', sendLbl: 'שלח', moveTo: 'העבר לשלב', noMove: 'אל תזיז',
    triggerWords: 'מילים שמזהות', addWord: 'הקלידו מילה ולחצו Enter', showMore: n => `הצג עוד ${n}`, removeWord: w => `הסר ${w}`,
    tester: 'בדקו תשובה לדוגמה', testerPh: 'למשל: כן, אשמח לשמוע פרטים', detNeg: 'מזוהה כ״לא תודה״', detPos: 'מזוהה כ״רוצה להתקדם״', detReply: 'תשובה רגילה – רק עוצרת תזכורות', matchedBy: w => `זוהה לפי: ״${w}״`,
    stS: ['כשליד', 'עובר שלב', 'בלוח ← שלח הודעה מתאימה'], stageHelp: 'במצב ״לאישור״ לוח הלידים ישאל אותך ברגע ההעברה.',
    reA: 'כשליד נמצא', reB: 'ימים בשלב', reC: 'ללא מענה', reD: '← שלח', daysLbl: 'ימים',
    ruleStats: (n, m) => `${n} נשלחו ב-30 יום · ${m} ממתינות`, pickTpl: 'בחרו תבנית', tplGone: 'התבנית נמחקה – בחרו אחרת',
    rWelcome: 'הודעת פתיחה', rNoReply: 'לא ענה', rReplies: 'זיהוי תשובות', rStage: 'שינוי שלב', rRe: 'חזרה ללקוח',
    // log
    lAll: 'הכל', lSent: 'נשלחו', lFailed: 'נכשלו', lOpted: n => `ביקשו להפסיק (${n})`, allKinds: 'כל הסוגים', lSearch: 'חיפוש לפי שם, טלפון או טקסט',
    by: { auto: 'אוטומטי', cron: 'אוטומטי (יומי)', external: 'פינג חיצוני', manual: 'ידני', scheduled: 'שליחה מרובה' },
    loadMore: 'טען עוד', lEmpty: 'עוד לא נשלחו הודעות', statusSent: 'נשלח', statusFailed: 'נכשל', resent: 'נשלח שוב',
    unopt: 'החזר לקבלת הודעות', unoptT: n => `להחזיר את ${n} לקבלת הודעות?`, unoptB: 'הלקוח ביקש להפסיק. החזירו רק אם ביקש בעצמו לשמוע מכם שוב.', unoptDone: 'הלקוח יקבל שוב הודעות', noOpted: 'אף אחד לא ביקש להפסיק',
    // system
    sysTitle: 'מצב המערכת', allGood: 'הכל תקין – ההודעות יוצאות כרגיל', nIssues: n => `${n} דברים דורשים טיפול`,
    waTitle: 'חיבור לוואטסאפ (Green API)', waOk: p => `מחובר · ${p}`, waNotAuth: 'הטלפון לא מקושר – סרקו את קוד ה-QR בלוח של Green API', openGreen: 'פתח את Green API',
    waNotConf: v => `חסרים משתני סביבה ב-Vercel: ${v}`, waErr: e => `לא מצליחים להתחבר: ${e}`, checkAgain: 'בדוק שוב',
    dbTitle: 'מסד נתונים', dbOk: 'טבלאות ההגדרות והיומן קיימות', dbMissing: 'חסרות טבלאות – ההגדרות לא נשמרות. הריצו פעם אחת את הקובץ server/automations-migration.sql ב-Supabase ‏(SQL Editor).', copyFile: 'העתק שם קובץ', copied: 'הועתק ✓',
    masterTitle: 'מתג ראשי', masterOnD: 'פעיל', masterOffD: 'כבוי – לא נשלח כלום', hoursTitle: 'שעות שליחה',
    runTitle: 'ריצה אוטומטית אחרונה', runAgo: (a, s) => `${a} · ${s}`, src: { panel: 'מהפאנל', cron: 'ריצה יומית', external: 'פינג חיצוני', test: 'בדיקה' }, runStale: 'לא הייתה ריצה ב-24 השעות האחרונות', runNone: 'עדיין לא רצה',
    pingTitle: 'תזמון מדויק (אופציונלי)', pingExplain: 'בלי זה, המערכת רצה כל 5 דקות רק כשהפאנל פתוח, ופעם ביום בלעדיו. פינג חיצוני כל 5 דקות שומר על התזכורות והשליחות המתוזמנות בזמן.',
    pingUrl: 'כתובת לפינג', show: 'הצג', hide: 'הסתר', copy: 'העתק', pingSteps: ['פתחו חשבון חינמי ב-cron-job.org', 'צרו Cronjob חדש והדביקו את הכתובת', 'בחרו ״כל 5 דקות״ ושמרו'], pingOff: 'לא הוגדר', pingOn: n => `פעיל · פינג אחרון לפני ${n} דק׳`,
    testTitle: 'הודעת בדיקה', testBtn: 'שלח הודעת בדיקה למשרד', testSent: 'הודעת הבדיקה נשלחה ✓', agoMin: n => `לפני ${n} דק׳`, agoH: n => `לפני ${n} שע׳`, agoD: n => `לפני ${n} ימים`, justNow: 'הרגע',
    tone: { ok: 'תקין', warn: 'אזהרה', error: 'שגיאה', info: 'מידע', off: 'כבוי' },
  },
  en: {
    title: 'WhatsApp automations', subtitle: 'Ready-made messages for every inquiry – one click or fully automatic',
    tabs: { today: 'Today', templates: 'Templates', rules: 'Rules', hours: 'Sending hours', campaigns: 'Bulk sends', log: 'Log' },
    tabsM: { today: 'Today', templates: 'Templates', rules: 'Rules', hours: 'Hours', campaigns: 'Bulk', log: 'Log' },
    todayAria: n => `Today, ${n} awaiting approval`,
    masterOn: 'Automations on', masterOff: 'Automations off',
    masterOffBanner: 'Automations are off. Nothing is sent automatically and nothing is queued.', turnOn: 'Turn on',
    confirmOffTitle: 'Turn off all automations?', confirmOffBody: 'Welcome messages, reminders and stage messages will stop until you turn them back on.', confirmOffBtn: 'Turn off',
    pillOk: 'All systems go', pillWarn: n => `Needs attention (${n})`, pillErr: 'Not sending', pillChecking: 'Checking…',
    storageBanner: "Changes aren't being saved – database tables are missing.", howToFix: 'How to fix',
    runNow: 'Run now', runNowTip: 'Sends whatever is due and refreshes the queue',
    unsaved: 'You have unsaved changes', discard: 'Discard', saveChanges: 'Save changes', saving: 'Saving…', saved: 'Saved ✓', saveError: e => `Couldn't save: ${e}`,
    cancel: 'Cancel', close: 'Close', undo: 'Undo', retry: 'Try again', error: 'Error',
    inMin: n => `in ${n} min`, inHours: n => `in ${n}h`, inDays: n => `in ${n} days`, now: 'now',
    filterAll: 'All', filterApprove: 'To approve', filterAuto: 'Automatic',
    waiting: 'Waiting for your approval', sendAll: n => `Send all (${n})`, sendAllConfirm: n => `Send ${n} WhatsApp messages now?`, send: 'Send',
    upcoming: 'Coming up', grpHours: 'Next few hours', grpTomorrow: 'Tomorrow', grpWeek: 'Later this week', heldQuiet: 'Waiting for sending hours',
    sendNow: 'Send now', skip: 'Skip', openChat: 'Open chat', editMsg: 'Edit message', revertMsg: 'Revert text', edited: 'Edited',
    sentTo: n => `Sent to ${n}`, skipped: n => `Skipped ${n}`, outsideConfirm: "It's outside sending hours. Send anyway?", outsideBtn: 'Send anyway',
    emptyApproveT: 'Nothing to approve right now', emptyApproveB: 'Messages that need your OK will show up here.',
    emptyUpcomingT: 'Nothing scheduled for the coming week', emptyUpcomingB: "Reminders are created when a lead doesn't reply. You can change the sequence under Rules.", goRules: 'Go to Rules',
    loadErr: "Couldn't load the queue",
    winOpen: 'Sending hours are open', winOpenSub: t => `Closes today at ${t}`, winClosed: 'Outside sending hours', winClosedSub: (d, t) => `Opens ${d} at ${t}`, winNone: 'No upcoming sending window', winUnlimited: 'No hour limit', editHours: 'Edit hours',
    kpiPending: 'Awaiting approval', kpiSent: 'Sent this week', kpiPos: 'Positive replies', kpiFail: 'Failed this week',
    nextCampaign: 'Next scheduled send', open: 'Open', bulkRow: n => `Bulk send · ${n} leads`,
    howItWorks: 'How it works', flow1: tp => `New lead → instantly gets “${tp}”`, flow2: (n, d) => `No reply → up to ${n} reminders over ${d} days`, flow3: 'Replied → reminders stop and the team is alerted',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], dShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], today: 'today', tomorrow: 'tomorrow',
    kind: { welcome: 'Welcome', noreply: 'No reply', reply: 'Reply', stage: 'Stage', reengage: 'Re-engage', manual: 'Manual', tpl: 'Bulk send', test: 'Test' },
    modesBadge: { off: 'Off', suggest: 'Waits for approval', auto: 'Sent automatically' },
    legendIntro: 'Every rule has three modes:', legend: { off: 'Off – nothing is sent', suggest: 'Approve – the message waits for you in Today', auto: 'Automatic – sent by the system' },
    modes: { off: 'Off', suggest: 'Approve', auto: 'Auto' },
    helpOff: 'This rule is off – nothing will be sent', helpSuggest: 'Messages will wait for your approval in Today', helpAuto: 'Sent automatically, within sending hours', helpAutoNow: 'Sent automatically, right away',
    wS1a: 'When a', wS1b: 'new lead', wS1c: 'comes in → send', wS2: 'If they asked about a specific property → send instead', welcomeHelp: 'The welcome message goes out right away, even outside sending hours.',
    nrA: 'When a lead in', nrB: "doesn't reply", nrC: n => `→ send up to ${n} reminders`, stagesPick: 'Stages',
    rS: ['When a lead', 'replies', '→ reminders stop and the system reads their intent'], notifyTeam: 'Send the team a WhatsApp alert',
    negTitle: 'Replied “no thanks”', negNote: "They won't get any more automated messages.", posTitle: 'Wants to move forward', sendLbl: 'Send', moveTo: 'Move to stage', noMove: "Don't move",
    triggerWords: 'Trigger words', addWord: 'Type a word and press Enter', showMore: n => `Show ${n} more`, removeWord: w => `Remove ${w}`,
    tester: 'Test a sample reply', testerPh: "e.g. Yes, I'd love more details", detNeg: 'Detected as “no thanks”', detPos: 'Detected as “wants to move forward”', detReply: 'Regular reply – just stops reminders', matchedBy: w => `Matched: “${w}”`,
    stS: ['When a lead', 'moves to a new board stage', '→ send a matching message'], stageHelp: 'In Approve mode, the leads board asks you as soon as you move the card.',
    reA: 'When a lead has been in', reB: 'days in', reC: 'No answer', reD: '→ send', daysLbl: 'days',
    ruleStats: (n, m) => `${n} sent in the last 30 days · ${m} waiting`, pickTpl: 'Choose a template', tplGone: 'Template deleted – choose another',
    rWelcome: 'Welcome message', rNoReply: 'No reply', rReplies: 'Reply detection', rStage: 'Stage change', rRe: 'Re-engage',
    lAll: 'All', lSent: 'Sent', lFailed: 'Failed', lOpted: n => `Opted out (${n})`, allKinds: 'All types', lSearch: 'Search by name, phone or text',
    by: { auto: 'Automatic', cron: 'Automatic (daily)', external: 'External ping', manual: 'Manual', scheduled: 'Bulk send' },
    loadMore: 'Load more', lEmpty: 'No messages sent yet', statusSent: 'Sent', statusFailed: 'Failed', resent: 'Sent again',
    unopt: 'Allow messages again', unoptT: n => `Allow messages to ${n} again?`, unoptB: 'They asked to stop. Only do this if they asked to hear from you again.', unoptDone: 'They will receive messages again', noOpted: 'Nobody has opted out',
    sysTitle: 'System status', allGood: 'All good – messages are going out as normal', nIssues: n => `${n} things need attention`,
    waTitle: 'WhatsApp connection (Green API)', waOk: p => `Connected · ${p}`, waNotAuth: 'Phone not linked – scan the QR code in the Green API console', openGreen: 'Open Green API',
    waNotConf: v => `Missing Vercel environment variables: ${v}`, waErr: e => `Can't connect: ${e}`, checkAgain: 'Check again',
    dbTitle: 'Database', dbOk: 'Settings and log tables are in place', dbMissing: "Tables missing – settings aren't being saved. Run server/automations-migration.sql once in Supabase (SQL Editor).", copyFile: 'Copy file name', copied: 'Copied ✓',
    masterTitle: 'Master switch', masterOnD: 'On', masterOffD: 'Off – nothing is sent', hoursTitle: 'Sending hours',
    runTitle: 'Last automatic run', runAgo: (a, s) => `${a} · ${s}`, src: { panel: 'from the panel', cron: 'daily run', external: 'external ping', test: 'test' }, runStale: 'No run in the last 24 hours', runNone: 'Has not run yet',
    pingTitle: 'Precise timing (optional)', pingExplain: 'Without it, the system runs every 5 minutes only while the panel is open, and once a day otherwise. An external ping every 5 minutes keeps reminders and scheduled sends on time.',
    pingUrl: 'Ping URL', show: 'Show', hide: 'Hide', copy: 'Copy', pingSteps: ['Create a free account at cron-job.org', 'Create a new cronjob and paste the URL', 'Choose “every 5 minutes” and save'], pingOff: 'Not set up', pingOn: n => `Active · last ping ${n} min ago`,
    testTitle: 'Test message', testBtn: 'Send a test message to the office', testSent: 'Test message sent ✓', agoMin: n => `${n} min ago`, agoH: n => `${n}h ago`, agoD: n => `${n} days ago`, justNow: 'just now',
    tone: { ok: 'OK', warn: 'Warning', error: 'Error', info: 'Info', off: 'Off' },
  },
}

const STAGE_DEFAULT = { new: { he: 'ליד חדש', en: 'New lead' }, contacted: { he: 'ניצור קשר', en: 'Contacted' }, discovery: { he: 'גילוי', en: 'Discovery' }, negotiating: { he: 'במו"מ', en: 'Negotiating' }, won: { he: 'סגירה', en: 'Closed won' }, lost: { he: 'ללא מענה', en: 'No answer' } }
const STAGE_COLOR = { new: '#0073EA', contacted: '#FDAB3D', discovery: '#A25DDC', negotiating: '#FF7575', won: '#00C875', lost: '#7D7D7D' }
const KIND_COLOR = { welcome: T.green, noreply: T.amber, reply: T.blue, stage: '#A25DDC', reengage: '#60D4F7', manual: T.brand, tpl: T.brand, test: T.grey }
const clone = o => JSON.parse(JSON.stringify(o))
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o?.[k]]))
const minsAgo = iso => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
const hhmm = (d, isEn) => new Date(d).toLocaleTimeString(isEn ? 'en-GB' : 'he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' })
const dayKey = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
const LEGACY = { overview: 'today', queue: 'today', broadcast: 'campaigns', bulk: 'campaigns', schedule: 'hours', flows: 'rules' }

export default function AutomationsTab(props) {
  return <ConfirmProvider dir={props.lang === 'en' ? 'ltr' : 'rtl'}><Automations {...props}/></ConfirmProvider>
}

function Automations({ lang = 'he', leads = [], stageLabels = {}, config, onConfigSaved, runResult, onRun, running, onOpenChat, initialSub }) {
  const t = TR[lang] || TR.he
  const isEn = lang === 'en'
  const dir = isEn ? 'ltr' : 'rtl'
  const confirm = useConfirm()
  const [toast, toastNode] = useToasts()
  const [tab, setTab] = useState(LEGACY[initialSub] || initialSub || 'today')
  const [saved, setSaved] = useState(() => clone(config?.config || DEFAULT_CONFIG))
  const [draft, setDraft] = useState(() => clone(config?.config || DEFAULT_CONFIG))
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')
  const [justSaved, setJustSaved] = useState(false)
  const [health, setHealth] = useState(null)
  const [log, setLog] = useState(null)
  const [logLimit, setLogLimit] = useState(100)
  const [states, setStates] = useState({})
  const [jobs, setJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [sysOpen, setSysOpen] = useState(false)
  const [logFilter, setLogFilter] = useState('all')
  const [editJobId, setEditJobId] = useState(null)
  const tabRefs = useRef({})

  const KEYS = ['rules', 'quiet', 'vars']
  const dirtyKey = k => JSON.stringify(draft[k] ?? null) !== JSON.stringify(saved[k] ?? null)
  const dirty = KEYS.some(dirtyKey)
  useEffect(() => { if (config?.config && !dirty) { setDraft(clone(config.config)); setSaved(clone(config.config)) } }, [config]) // eslint-disable-line react-hooks/exhaustive-deps
  const cfg = useMemo(() => mergeConfig(draft), [draft])
  const tpls = useMemo(() => templateList(cfg), [cfg])
  const tplName = useCallback(id => { const x = tpls.find(y => y.id === id); return x ? (isEn ? x.en_title || x.he_title : x.he_title || x.en_title) : '' }, [tpls, isEn])
  const stageName = s => (isEn ? stageLabels?.[s]?.en : stageLabels?.[s]?.label) || STAGE_DEFAULT[s]?.[isEn ? 'en' : 'he'] || s
  const setCfg = fn => setDraft(d => { const n = clone(d); fn(n); return n })

  const loadHealth = useCallback(() => { setHealth(h => h ? { ...h, checking: true } : null); autoApi.get('auto-health').then(setHealth).catch(e => setHealth({ error: e.message, green: { state: 'error', error: e.message } })) }, [])
  const loadLog = useCallback((limit = logLimit) => autoApi.get(`auto-log?limit=${limit}`).then(setLog).catch(e => setLog(l => ({ rows: l?.rows || [], error: e.message }))), [logLimit])
  const loadStates = useCallback(() => autoApi.get('auto-leads').then(a => setStates(Object.fromEntries((a || []).map(s => [s.leadId, s])))).catch(() => {}), [])
  const loadJobs = useCallback(() => autoApi.get('auto-jobs').then(d => setJobs(d.jobs || [])).catch(() => {}).finally(() => setJobsLoading(false)), [])
  const reloadAll = useCallback(() => { loadLog(); loadStates(); loadJobs() }, [loadLog, loadStates, loadJobs])
  useEffect(() => { loadHealth(); reloadAll() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (runResult?.at) { loadJobs(); setHealth(h => h ? { ...h, lastRun: { ...(h.lastRun || {}), at: runResult.at, source: runResult.source } } : h) } }, [runResult?.at]) // eslint-disable-line react-hooks/exhaustive-deps

  // Save: shared keys go from draft; everything else (templates, enabled…) from what is saved
  const persistFull = async next => { await autoApi.post('auto-config', { config: next }); onConfigSaved?.(next) }
  const save = async () => {
    setSaving(true); setSaveErr('')
    const next = { ...clone(saved), ...pick(clone(draft), KEYS) }
    try { await persistFull(next); setSaved(next); setJustSaved(true); setTimeout(() => setJustSaved(false), 1200) }
    catch (e) { setSaveErr(e.message) } finally { setSaving(false) }
  }
  // instant saves (templates, master switch) keep unsaved rule edits untouched
  const persist = async mutate => {
    const nextSaved = clone(saved); mutate(nextSaved)
    await persistFull(nextSaved)
    setSaved(nextSaved)
    setDraft(d => { const n = clone(d); mutate(n); return n })
  }
  const setMaster = async on => {
    if (!on && !await confirm({ title: t.confirmOffTitle, body: t.confirmOffBody, confirmLabel: t.confirmOffBtn, cancelLabel: t.cancel, tone: 'danger' })) return
    try { await persist(c => { c.enabled = on }); toast(on ? t.masterOn : t.masterOff, { tone: on ? 'success' : 'warn' }); onRun?.() } catch (e) { toast(`${t.error}: ${e.message}`, { tone: 'error' }) }
  }
  useEffect(() => {
    if (!dirty) return
    const h = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
  useEffect(() => { document.documentElement.style.setProperty('--au-toast-lift', dirty ? '136px' : '0px'); return () => document.documentElement.style.removeProperty('--au-toast-lift') }, [dirty])

  // system status aggregation
  const g = health?.green
  const greenOk = g?.state === 'authorized'
  const last = health?.lastRun
  const lastAgo = last?.at ? minsAgo(last.at) : null
  const pingActive = last?.source === 'external' && lastAgo != null && lastAgo < 20
  const issues = []
  if (health && !greenOk) issues.push('green')
  if (!cfg.enabled) issues.push('master')
  const warns = []
  if (health && health.storage !== 'ok') warns.push('db')
  if (health && (lastAgo == null || lastAgo > 26 * 60)) warns.push('run')
  const pill = !health || health.checking ? ['info', t.pillChecking] : issues.length ? ['error', t.pillErr] : warns.length ? ['warn', t.pillWarn(warns.length)] : ['ok', t.pillOk]

  const queue = runResult?.suggestions || []
  const upcoming = runResult?.upcoming || []
  const logRows = log?.rows || []
  const weekAgo = Date.now() - 7 * 864e5
  const failed24 = logRows.some(r => !r.ok && new Date(r.created_at).getTime() > Date.now() - 864e5)
  const kpi = {
    pending: queue.length,
    sent7: logRows.filter(r => r.ok && new Date(r.created_at).getTime() > weekAgo && r.rule_key !== 'test').length,
    failed7: logRows.filter(r => !r.ok && new Date(r.created_at).getTime() > weekAgo).length,
    positive: Object.values(states).filter(s => s.intent === 'positive').length,
  }
  const TABS = [
    { id: 'today', Icon: FaInbox, badge: queue.length || null, badgeColor: T.red },
    { id: 'templates', Icon: FaCommentDots, dot: dirtyKey('vars') },
    { id: 'rules', Icon: FaProjectDiagram, dot: dirtyKey('rules') },
    { id: 'hours', Icon: FaClock, dot: dirtyKey('quiet') },
    { id: 'campaigns', Icon: FaBullhorn, badge: jobs.filter(j => j.status === 'scheduled' || j.status === 'sending').length || null, badgeColor: T.brand },
    { id: 'log', Icon: FaHistory, dot: failed24, dotColor: T.red },
  ]
  const onTabKey = e => {
    const ids = TABS.map(x => x.id), i = ids.indexOf(tab)
    let n = null
    if (e.key === 'ArrowLeft') n = i + (isEn ? -1 : 1)
    if (e.key === 'ArrowRight') n = i + (isEn ? 1 : -1)
    if (e.key === 'Home') n = 0
    if (e.key === 'End') n = ids.length - 1
    if (n == null) return
    e.preventDefault()
    const id = ids[(n + ids.length) % ids.length]
    setTab(id); tabRefs.current[id]?.focus()
  }
  const goRule = rule => { setTab('rules'); setTimeout(() => document.getElementById(`au-rule-${rule}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80) }
  const common = { t, isEn, dir, cfg, tpls, tplName, stageName, leads, toast, confirm, onOpenChat }

  return (
    <div className="au" dir={dir} lang={lang} style={{ display: 'flex', flexDirection: 'column', gap: 14, color: T.text, maxWidth: 1180, margin: '0 auto', width: '100%', paddingBottom: 24 }}>
      <style>{AUTO_CSS}</style>

      {/* header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minHeight: 56 }}>
        <span style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${T.green}, #128C7E)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 18px ${T.green}40`, flexShrink: 0 }}><FaRobot size={18} color="#fff"/></span>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{t.title}</h2>
          <div className="au-hide-m" style={{ fontSize: 12.5, color: T.text3, marginTop: 2 }}>{t.subtitle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <StatusPill tone={pill[0]} text={pill[1]} onClick={() => setSysOpen(true)}/>
          <Toggle checked={cfg.enabled} onChange={setMaster}>{cfg.enabled ? t.masterOn : t.masterOff}</Toggle>
        </div>
      </header>

      {/* sub-nav */}
      <nav style={{ position: 'sticky', top: -22, zIndex: 15, background: 'var(--au-sticky)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderBottom: `1px solid ${T.line}`, paddingTop: 22, marginTop: -16, paddingBottom: 8, marginInline: -2, paddingInline: 2 }}>
        <div role="tablist" aria-label={t.title} className="au-nav" onKeyDown={onTabKey}>
          {TABS.map(({ id, Icon, badge, badgeColor, dot, dotColor }) => {
            const on = tab === id
            return (
              <button key={id} ref={el => { tabRefs.current[id] = el }} role="tab" id={`au-tab-${id}`} aria-selected={on} aria-controls={`au-panel-${id}`} tabIndex={on ? 0 : -1} onClick={() => setTab(id)}
                aria-label={id === 'today' && queue.length ? t.todayAria(queue.length) : undefined} className="au-nav-btn"
                style={{ border: `1px solid ${on ? T.brand : 'rgba(132,144,216,.18)'}`, background: on ? 'rgba(132,144,216,.18)' : 'transparent', color: on ? T.brandText : T.text2, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 0, minWidth: 0, boxShadow: on ? `inset 0 -2px 0 ${T.brand}` : 'none' }}>
                <Icon size={13}/><span className="au-hide-m">{t.tabs[id]}</span><span className="au-only-m" style={{ fontSize: 10.5 }}>{t.tabsM[id]}</span>
                {badge ? <span style={{ fontSize: 10.5, fontWeight: 900, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: badgeColor, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>{badge}</span> : null}
                {dot && <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor || T.amber }}/>}
              </button>
            )
          })}
        </div>
      </nav>

      {/* one global banner at a time */}
      {!cfg.enabled ? (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: T.amberSoft, border: '1px solid rgba(245,166,35,.4)', color: T.amberText, fontSize: 13, fontWeight: 700, flexWrap: 'wrap' }}>
          <FaPowerOff/><span style={{ flex: 1, minWidth: 180 }}>{t.masterOffBanner}</span><Button size="sm" variant="solid" onClick={() => setMaster(true)}>{t.turnOn}</Button>
        </div>
      ) : health && health.storage && health.storage !== 'ok' ? (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: T.amberSoft, border: '1px solid rgba(245,166,35,.4)', color: T.amberText, fontSize: 13, fontWeight: 700, flexWrap: 'wrap' }}>
          <FaDatabase/><span style={{ flex: 1, minWidth: 180 }}>{t.storageBanner}</span><Button size="sm" variant="brand" onClick={() => setSysOpen(true)}>{t.howToFix}</Button>
        </div>
      ) : null}

      <section role="tabpanel" id={`au-panel-${tab}`} aria-labelledby={`au-tab-${tab}`} key={tab} className="au-in">
        {tab === 'today' && <Today {...common} queue={queue} upcoming={upcoming} runResult={runResult} running={running} onRun={() => { onRun?.(); reloadAll() }} reload={reloadAll} kpi={kpi} jobs={jobs}
          onGo={setTab} logEmpty={!!log && !logRows.length} onFailed={() => { setLogFilter('failed'); setTab('log') }} onOpenJob={j => { setEditJobId(j.status === 'scheduled' ? j.id : null); setTab('campaigns') }}/>}
        {tab === 'templates' && <TemplatesTab lang={lang} cfg={cfg} tpls={tpls} leads={leads} states={states} setCfg={setCfg} persist={persist} toast={toast} onGoRule={goRule} stageName={stageName}/>}
        {tab === 'rules' && <Rules {...common} setCfg={setCfg} logRows={logRows} queue={queue} onGoHours={() => setTab('hours')}/>}
        {tab === 'hours' && <HoursTab lang={lang} cfg={cfg} setCfg={setCfg} toast={toast}/>}
        {tab === 'campaigns' && <CampaignsTab lang={lang} cfg={cfg} tpls={tpls} leads={leads} states={states} stageName={stageName} jobs={jobs} loadJobs={loadJobs} jobsLoading={jobsLoading} toast={toast}
          onOpenSystem={() => setSysOpen(true)} pingActive={pingActive} openEditId={editJobId} clearOpenEdit={() => setEditJobId(null)}/>}
        {tab === 'log' && <Log {...common} log={log} loadLog={loadLog} logLimit={logLimit} setLogLimit={n => { setLogLimit(n); loadLog(n) }} states={states} loadStates={loadStates} filter={logFilter} setFilter={setLogFilter}/>}
      </section>

      <SaveBar dirty={dirty} saving={saving} error={saveErr} justSaved={justSaved} onSave={save} onDiscard={() => { setDraft(d => ({ ...d, ...pick(clone(saved), KEYS) })); setSaveErr('') }} t={t}/>

      <SystemDrawer open={sysOpen} onClose={() => setSysOpen(false)} t={t} isEn={isEn} dir={dir} health={health} loadHealth={loadHealth} cfg={cfg} setMaster={setMaster} onRun={onRun} running={running}
        pingActive={pingActive} lastAgo={lastAgo} last={last} issues={issues.length + warns.length} toast={toast} onGoHours={() => { setSysOpen(false); setTab('hours') }}/>
      {toastNode}
    </div>
  )
}

// ── Relative time ──────────────────────────────────────────────────────────────
function useTick(ms = 60000) { const [, s] = useState(0); useEffect(() => { const iv = setInterval(() => s(x => x + 1), ms); return () => clearInterval(iv) }, [ms]) }
function rel(iso, t) {
  const m = Math.round((new Date(iso).getTime() - Date.now()) / 60000)
  if (Math.abs(m) < 1) return t.now
  if (m > 0) return m < 60 ? t.inMin(m) : m < 1440 * 2 ? t.inHours(Math.round(m / 60)) : t.inDays(Math.round(m / 1440))
  const a = -m
  return a < 60 ? t.agoMin(a) : a < 1440 ? t.agoH(Math.round(a / 60)) : t.agoD(Math.round(a / 1440))
}

// ── Today ──────────────────────────────────────────────────────────────────────
function Today({ t, isEn, dir, cfg, tpls, tplName, stageName, leads, toast, confirm, onOpenChat, queue, upcoming, runResult, running, onRun, reload, kpi, jobs, onGo, logEmpty, onFailed, onOpenJob }) {
  useTick()
  const [filter, setFilter] = useState('all')
  const [gone, setGone] = useState({})
  const [texts, setTexts] = useState({})
  const [editing, setEditing] = useState({})
  const [busy, setBusy] = useState({})
  const skipTimers = useRef({})
  useEffect(() => () => Object.values(skipTimers.current).forEach(clearTimeout), [])
  const approvals = queue.filter(q => !gone[q.id])
  const ups = upcoming.filter(u => !gone[u.id]).filter(u => filter === 'all' || (filter === 'auto' ? u.mode === 'auto' : u.mode === 'suggest'))
  const loading = !runResult
  const inWin = isSendWindow(cfg)

  const send = async (item, text) => {
    setBusy(b => ({ ...b, [item.id]: true }))
    try {
      const r = await autoApi.post('auto-send', { items: [{ leadId: item.leadId, phone: item.phone, text: text ?? item.text, ruleKey: item.ruleKey, templateId: item.templateId }] })
      if (!r.results?.[0]?.ok) throw new Error(r.results?.[0]?.error || t.error)
      setGone(g => ({ ...g, [item.id]: 1 })); toast(t.sentTo(item.name || `+${item.phone}`)); return true
    } catch (e) { toast(`${t.error}: ${e.message}`, { tone: 'error' }); return false }
    finally { setBusy(b => { const n = { ...b }; delete n[item.id]; return n }) }
  }
  const skip = item => {
    setGone(g => ({ ...g, [item.id]: 1 }))
    skipTimers.current[item.id] = setTimeout(() => { autoApi.post('auto-skip', { leadId: item.leadId, ruleKey: item.ruleKey }).then(reload).catch(() => {}) }, 5000)
    toast(t.skipped(item.name || `+${item.phone}`), { action: { label: t.undo, onClick: () => { clearTimeout(skipTimers.current[item.id]); setGone(g => { const n = { ...g }; delete n[item.id]; return n }) } } })
  }
  const sendAll = async () => {
    if (!await confirm({ title: t.sendAllConfirm(approvals.length), confirmLabel: t.send, cancelLabel: t.cancel })) return
    for (const q of approvals) await send(q, texts[q.id])
    reload(); onRun()
  }
  const sendUpcoming = async u => {
    if (!inWin && !await confirm({ title: t.outsideConfirm, confirmLabel: t.outsideBtn, cancelLabel: t.cancel })) return
    await send(u)
    reload()
  }
  const chat = item => onOpenChat?.(leads.find(l => String(l.id) === String(item.leadId)) || { id: `wa:${item.phone}`, name: item.name, phone: item.phone })

  // groups for upcoming
  const now = Date.now()
  const tmrKey = dayKey(now + 864e5)
  const groups = [[t.grpHours, []], [t.grpTomorrow, []], [t.grpWeek, []]]
  ups.forEach(u => { const at = new Date(u.sendAt).getTime(); if (at - now <= 12 * 3600e3 && dayKey(at) !== tmrKey) groups[0][1].push(u); else if (dayKey(at) === tmrKey) groups[1][1].push(u); else if (at - now <= 7 * 864e5) groups[2][1].push(u) })
  const soonJobs = jobs.filter(j => j.status === 'scheduled' && new Date(j.at).getTime() - now < 7 * 864e5).sort((a, b) => new Date(a.at) - new Date(b.at))
  const nextJob = soonJobs[0]
  const showFirstRun = !loading && !approvals.length && !ups.length && logEmpty
  const noReplySteps = cfg.rules.noReply?.steps || []
  const nrDays = Math.round(noReplySteps.reduce((n, s) => n + (Number(s.hours) || 0), 0) / 12) / 2

  return (
    <div className="au-today">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <ModeSwitch value={filter} onChange={setFilter} modes={['all', 'suggest', 'auto']} icons={{}} colors={{ all: T.brand, suggest: T.amber, auto: T.green }} label={t.upcoming}
            labels={{ all: `${t.filterAll} · ${approvals.length + upcoming.filter(u => !gone[u.id]).length}`, suggest: `${t.filterApprove} · ${approvals.length + upcoming.filter(u => !gone[u.id] && u.mode === 'suggest').length}`, auto: `${t.filterAuto} · ${upcoming.filter(u => !gone[u.id] && u.mode === 'auto').length}` }}/>
          <div style={{ flex: 1 }}/>
          <span className="au-hide-m"><Button icon={<FaSyncAlt size={11} className={running ? 'au-spin' : undefined}/>} onClick={onRun} disabled={running} title={t.runNowTip}>{t.runNow}</Button></span>
          <span className="au-only-m"><IconButton icon={<FaSyncAlt size={13} className={running ? 'au-spin' : undefined}/>} label={t.runNow} size={36} variant="ghost" onClick={onRun} disabled={running}/></span>
        </div>

        {filter !== 'auto' && (
          <section id="au-approvals" aria-label={t.waiting}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap' }}>{t.waiting} <span style={{ color: T.text3, fontSize: 13 }}>({approvals.length})</span></h3>
              <div style={{ flex: 1 }}/>
              {approvals.length >= 2 && <Button size="sm" variant="soft-green" icon={<FaPaperPlane size={10}/>} onClick={sendAll}>{t.sendAll(approvals.length)}</Button>}
            </div>
            {loading ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2].map(i => <Skeleton key={i} h={120} r={14}/>)}</div>
              : runResult?.ok === false && !approvals.length ? <InlineError message={t.loadErr} onRetry={onRun} retryLabel={t.retry}/>
              : !approvals.length ? <Card pad={0}><EmptyState compact icon={FaCheckCircle} title={t.emptyApproveT} body={t.emptyApproveB}/></Card>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{approvals.map(q => {
                  const c = KIND_COLOR[q.kind] || T.brand
                  const txt = texts[q.id] ?? q.text
                  const reason = q.kind === 'stage' ? `${isEn ? 'Moved to' : 'עבר לשלב'} "${stageName(q.stageKey)}"` : (isEn ? q.reason?.en : q.reason?.he) || ''
                  return (
                    <Card key={q.id} pad={14} accent={c} style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: busy[q.id] ? .6 : 1, pointerEvents: busy[q.id] ? 'none' : 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ width: 32, height: 32, borderRadius: '50%', background: `${c}2a`, color: c, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>{(q.name || '?')[0]}</span>
                        <b style={{ fontSize: 14, fontWeight: 700 }}>{q.name || '—'}</b>
                        <bdi dir="ltr" style={{ fontSize: 11.5, color: T.text3 }}>+{q.phone}</bdi>
                        {q.lang === 'en' && <Badge color={T.brand}>EN</Badge>}
                        <Badge color={c}>{t.kind[q.kind] || q.kind}</Badge>
                        <div style={{ flex: 1 }}/>
                        {q.created_at && <span style={{ fontSize: 11.5, color: T.text3 }}>{rel(q.created_at, t)}</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: T.text2 }} dir="auto">{reason}</div>
                      {editing[q.id] ? (
                        <div style={{ maxWidth: 560 }}>
                          <textarea value={txt} onChange={e => setTexts(x => ({ ...x, [q.id]: e.target.value }))} dir={q.lang === 'en' ? 'ltr' : 'rtl'} rows={Math.min(10, txt.split('\n').length + 1)} aria-label={t.editMsg}
                            style={{ ...inputStyle, height: 'auto', padding: '9px 11px', background: '#0B2A22', border: '1px solid rgba(37,211,102,.35)', color: T.wa.text, lineHeight: 1.6, resize: 'vertical' }} autoFocus/>
                          <button type="button" onClick={() => { setTexts(x => { const n = { ...x }; delete n[q.id]; return n }); setEditing(e => ({ ...e, [q.id]: false })) }} style={{ background: 'none', border: 'none', color: T.brandText, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit', minHeight: 0 }}>{t.revertMsg}</button>
                        </div>
                      ) : (
                        <div style={{ position: 'relative', maxWidth: 560 }}>
                          <div dir={q.lang === 'en' ? 'ltr' : 'rtl'} style={{ background: '#0B2A22', border: '1px solid rgba(37,211,102,.18)', color: T.wa.text, borderRadius: 10, padding: '9px 40px 9px 11px', paddingInlineEnd: 40, fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}><WAText text={txt}/></div>
                          <IconButton icon={<FaPen size={10}/>} label={t.editMsg} size={28} onClick={() => setEditing(e => ({ ...e, [q.id]: true }))} style={{ position: 'absolute', top: 6, insetInlineEnd: 6 }}/>
                          {texts[q.id] != null && texts[q.id] !== q.text && <Badge color={T.amber} textColor={T.amberText}>{t.edited}</Badge>}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <Button variant="soft-green" icon={<FaPaperPlane size={11}/>} loading={busy[q.id]} onClick={async () => { if (await send(q, texts[q.id])) reload() }} style={{ flex: '1 1 120px', maxWidth: 200 }}>{t.send}</Button>
                        <Button icon={<FaTimes size={10}/>} onClick={() => skip(q)}>{t.skip}</Button>
                        {onOpenChat && <><span className="au-hide-m"><Button icon={<FaWhatsapp size={12}/>} onClick={() => chat(q)}>{t.openChat}</Button></span><span className="au-only-m"><IconButton icon={<FaWhatsapp size={14}/>} label={t.openChat} size={36} variant="ghost" onClick={() => chat(q)}/></span></>}
                      </div>
                    </Card>
                  )
                })}</div>}
          </section>
        )}

        <section aria-label={t.upcoming}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800 }}>{t.upcoming}</h3>
          {loading ? <Card pad={0}>{[0, 1, 2, 3, 4].map(i => <div key={i} style={{ padding: '10px 14px' }}><Skeleton h={32}/></div>)}</Card>
            : !ups.length && !soonJobs.length ? <Card pad={0}><EmptyState compact icon={FaCalendarCheck} title={t.emptyUpcomingT} body={t.emptyUpcomingB} action={<Button size="sm" variant="brand" onClick={() => onGo('rules')}>{t.goRules}</Button>}/></Card>
            : (
              <Card pad={0} style={{ overflow: 'hidden' }}>
                {groups.map(([label, list], gi) => (list.length || (gi === 2 && soonJobs.length)) ? (
                  <div key={label}>
                    <div style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, color: T.text3, background: 'rgba(0,0,0,.18)', borderBottom: `1px solid ${T.divider}` }}>{label} · {list.length + (gi === 2 ? soonJobs.length : 0)}</div>
                    {list.map(u => {
                      const lead = leads.find(l => String(l.id) === String(u.leadId))
                      return (
                        <div key={u.id} className="au-sched-row au-row" style={{ borderBottom: `1px solid ${T.divider}` }}>
                          <div>
                            <div style={{ fontSize: 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: u.heldByQuiet ? T.amberText : T.text, display: 'flex', alignItems: 'center', gap: 5 }}>{u.heldByQuiet && <FaMoon size={10}/>}{hhmm(u.sendAt, isEn)}</div>
                            <div style={{ fontSize: 11, color: u.heldByQuiet ? T.amberText : T.text3 }}>{u.heldByQuiet ? t.heldQuiet : rel(u.sendAt, t)}</div>
                          </div>
                          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <b style={{ fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || `+${u.phone}`}</b>
                            <Badge color={STAGE_COLOR[lead?.leadStatus || u.stage] || T.grey} textColor={T.text2}>{stageName(lead?.leadStatus || u.stage || 'new')}</Badge>
                          </div>
                          <div className="au-sr-kind" style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Badge color={KIND_COLOR[u.kind] || T.brand}>{t.kind[u.kind] || u.kind}</Badge>
                            <span style={{ fontSize: 12.5, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tplName(u.templateId)}</span>
                          </div>
                          <div className="au-sr-mode"><ModeBadge mode={u.mode} labels={t.modesBadge}/></div>
                          <div className="au-row-actions" style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                            <IconButton icon={<FaPaperPlane size={12} color={T.green}/>} label={t.sendNow} onClick={() => sendUpcoming(u)} loading={busy[u.id]}/>
                            <IconButton icon={<FaTimes size={12}/>} label={t.skip} onClick={() => skip(u)}/>
                            {onOpenChat && <IconButton icon={<FaWhatsapp size={13}/>} label={t.openChat} onClick={() => chat(u)}/>}
                          </div>
                        </div>
                      )
                    })}
                    {gi === 2 && soonJobs.map(j => (
                      <div key={j.id} className="au-sched-row" style={{ borderBottom: `1px solid ${T.divider}` }}>
                        <div><div style={{ fontSize: 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{hhmm(j.at, isEn)}</div><div style={{ fontSize: 11, color: T.text3 }}>{rel(j.at, t)}</div></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><FaBullhorn size={12} color={T.brand}/><b style={{ fontSize: 13.5 }}>{t.bulkRow(j.recipients?.length || 0)}</b></div>
                        <div className="au-sr-kind" style={{ fontSize: 12.5, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tplName(j.templateId)}</div>
                        <div className="au-sr-mode"><ModeBadge mode="auto" labels={t.modesBadge}/></div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button size="sm" variant="brand" onClick={() => onOpenJob(j)}>{t.open}</Button></div>
                      </div>
                    ))}
                  </div>
                ) : null)}
              </Card>
            )}
        </section>

        {showFirstRun && (
          <Card>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, display: 'flex', gap: 8, alignItems: 'center' }}><FaRobot color={T.brand}/>{t.howItWorks}</h3>
            <ol style={{ margin: 0, paddingInlineStart: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5, lineHeight: 1.6 }}>
              <li>{t.flow1(tplName(cfg.rules.welcome.templateId))}</li>
              <li>{t.flow2(noReplySteps.length, nrDays)}</li>
              <li>{t.flow3}</li>
            </ol>
          </Card>
        )}
      </div>

      <aside className="au-today-aside">
        <WindowCard t={t} isEn={isEn} cfg={cfg} onEdit={() => onGo('hours')}/>
        <div className="au-kpi">
          <StatTile value={kpi.pending} label={t.kpiPending} tone={kpi.pending ? T.amberText : T.text} onClick={() => document.getElementById('au-approvals')?.scrollIntoView({ behavior: 'smooth' })}/>
          <StatTile value={kpi.sent7} label={t.kpiSent} tone={T.green}/>
          <StatTile value={kpi.positive} label={t.kpiPos} tone={T.blue}/>
          <StatTile value={kpi.failed7} label={t.kpiFail} tone={kpi.failed7 ? T.redText : T.grey} onClick={onFailed}/>
        </div>
        {nextJob && (
          <Card pad={14} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text3 }}>{t.nextCampaign}</div>
            <b style={{ fontSize: 14 }}>{tplName(nextJob.templateId) || nextJob.name}</b>
            <div style={{ fontSize: 12.5, color: T.text2 }}>{t.bulkRow(nextJob.recipients?.length || 0)} · {whenText(nextJob.at, { today: t.today, tomorrow: t.tomorrow, at: isEn ? 'at' : 'ב-' }, isEn)}</div>
            <div><Button size="sm" variant="brand" onClick={() => onOpenJob(nextJob)}>{t.open}</Button></div>
          </Card>
        )}
      </aside>
    </div>
  )
}

function WindowCard({ t, isEn, cfg, onEdit }) {
  useTick()
  const nw = nextWindows(cfg, new Date(), 3)
  const { day } = israelNow()
  const days = cfg.quiet?.days || {}
  const unlimited = !cfg.quiet?.enabled
  const w0 = nw.windows.find(w => !w.current)
  const title = unlimited ? t.winUnlimited : nw.open ? t.winOpen : t.winClosed
  const sub = unlimited ? '' : nw.open ? t.winOpenSub(fmtHour(nw.closesAt)) : w0 ? t.winClosedSub(w0.offset === 0 ? t.today : w0.offset === 1 ? t.tomorrow : t.days[w0.day], fmtHour(w0.start)) : t.winNone
  const open = unlimited || nw.open
  return (
    <Card pad={14} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: open ? T.green : T.amber, boxShadow: open ? `0 0 0 4px ${T.green}33` : 'none' }}/>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>{sub && <div style={{ fontSize: 12, color: T.text3 }}>{sub}</div>}</div>
      </div>
      {!unlimited && (
        <div aria-hidden style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          {[0, 1, 2, 3, 4, 5, 6].map(d => {
            const w = days[d], isOn = Array.isArray(w)
            return (
              <div key={d} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 8, height: 32, borderRadius: 3, background: isOn ? 'rgba(37,211,102,.35)' : 'rgba(var(--ov),.06)', outline: d === day ? `2px solid ${T.brand}` : 'none', outlineOffset: 1 }}/>
                <span style={{ fontSize: 9.5, color: d === day ? T.brandText : T.text3, fontWeight: 700 }}>{t.dShort[d]}</span>
              </div>
            )
          })}
        </div>
      )}
      <div><Button size="sm" variant="brand" icon={<FaClock size={10}/>} onClick={onEdit}>{t.editHours}</Button></div>
    </Card>
  )
}

// ── Rules ──────────────────────────────────────────────────────────────────────
function TokenSelect({ value, onChange, options, label, broken, brokenLabel, minWidth = 140 }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', maxWidth: '100%' }}>
      <select value={value || ''} onChange={e => onChange(e.target.value)} aria-label={label}
        style={{ appearance: 'none', WebkitAppearance: 'none', height: 30, padding: '0 8px', paddingInlineEnd: 22, borderRadius: 6, border: 'none', borderBottom: `1px dashed ${broken ? T.redText : 'rgba(163,173,235,.6)'}`,
          background: broken ? T.redSoft : T.brandSoft, color: broken ? T.redText : T.brandText, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', minHeight: 0, minWidth, maxWidth: '100%', textOverflow: 'ellipsis' }}>
        {broken && <option value={value}>{brokenLabel}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <FaChevronDown size={9} style={{ position: 'absolute', insetInlineEnd: 7, pointerEvents: 'none', color: broken ? T.redText : T.brandText }}/>
    </span>
  )
}

function TplToken({ value, onChange, label, tplOpts, tpls, t }) {
  return <TokenSelect value={value} onChange={onChange} options={tplOpts} label={label || t.pickTpl} broken={!!value && !tpls.some(x => x.id === value)} brokenLabel={t.tplGone}/>
}
function RuleCard({ t, stats, id, icon, accent, mode, onMode, modes, sentence, help, kind, children, toggle, broken }) {
  const mc = MODE_COLOR[mode] || T.grey
  return (
    <Card id={`au-rule-${id}`} pad={16} style={{ borderInlineStart: `3px solid ${broken ? T.red : mc}`, scrollMarginTop: 72 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: `${accent}1F`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 6px' }}>{sentence}</div>
          <div style={{ fontSize: 12.5, color: T.text2, marginTop: 2 }}>{help}</div>
        </div>
        <div className="au-hide-m">{toggle || (onMode && <ModeSwitch value={mode} onChange={onMode} labels={t.modes} modes={modes} label={id}/>)}</div>
        <div className="au-only-m" style={{ width: '100%' }}>{toggle || (onMode && <ModeSwitch value={mode} onChange={onMode} labels={t.modes} modes={modes} label={id} full/>)}</div>
      </div>
      {(children || kind) && (
        <div style={{ marginTop: 12, opacity: mode === 'off' ? .55 : 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {children}
          {kind && <div style={{ borderTop: `1px solid ${T.divider}`, paddingTop: 10, fontSize: 12, color: T.text3 }}>{stats(kind)}</div>}
        </div>
      )}
    </Card>
  )
}

function Rules({ t, isEn, dir, cfg, setCfg, tpls, tplName, stageName, logRows, queue, onGoHours }) {
  const R = cfg.rules
  const tplOpts = useMemo(() => tpls.map(x => ({ value: x.id, label: tplName(x.id) })), [tpls, tplName])
  const since = Date.now() - 30 * 864e5
  const stats = kind => t.ruleStats(logRows.filter(r => r.ok && ruleKind(r.rule_key) === kind && new Date(r.created_at).getTime() > since).length, queue.filter(q => q.kind === kind).length)
  const helper = (mode, now) => mode === 'off' ? t.helpOff : mode === 'suggest' ? t.helpSuggest : now ? t.helpAutoNow : t.helpAuto
  const tplBroken = ids => ids.some(id => id && !tpls.some(x => x.id === id))
  const cardProps = { t, stats }
  const stagesBtn = useRef(null)
  const [stagesOpen, setStagesOpen] = useState(false)
  const reBtn = useRef(null)
  const [reOpen, setReOpen] = useState(false)
  const nrStages = R.noReply.stages || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card pad="12px 16px" style={{ display: 'flex', gap: '8px 18px', alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
        <b style={{ color: T.text2 }}>{t.legendIntro}</b>
        {['off', 'suggest', 'auto'].map(m => <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.text2 }}><ModeBadge mode={m} labels={t.modes}/>{t.legend[m]}</span>)}
      </Card>

      <RuleCard {...cardProps} id="welcome" icon="👋" accent={T.green} mode={R.welcome.mode} onMode={v => setCfg(c => { c.rules.welcome.mode = v })} kind="welcome" broken={tplBroken([R.welcome.templateId, R.welcome.propTemplateId])}
        help={R.welcome.mode === 'auto' ? t.welcomeHelp : helper(R.welcome.mode, true)}
        sentence={<><span>{t.wS1a}</span><b>{t.wS1b}</b><span>{t.wS1c}</span><TplToken tplOpts={tplOpts} tpls={tpls} t={t} value={R.welcome.templateId} onChange={v => setCfg(c => { c.rules.welcome.templateId = v })}/></>}>
        <div style={{ fontSize: 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, color: T.text2 }}>{t.wS2}<TplToken tplOpts={tplOpts} tpls={tpls} t={t} value={R.welcome.propTemplateId} onChange={v => setCfg(c => { c.rules.welcome.propTemplateId = v })}/></div>
      </RuleCard>

      <RuleCard {...cardProps} id="noReply" icon="⏰" accent={T.amber} mode={R.noReply.mode} onMode={v => setCfg(c => { c.rules.noReply.mode = v })} kind="noreply" help={helper(R.noReply.mode)} broken={tplBroken((R.noReply.steps || []).map(s => s.templateId))}
        sentence={<><span>{t.nrA}</span>
          <button ref={stagesBtn} type="button" onClick={() => setStagesOpen(true)} aria-haspopup="listbox" aria-expanded={stagesOpen}
            style={{ height: 30, padding: '0 8px', borderRadius: 6, border: 'none', borderBottom: '1px dashed rgba(163,173,235,.6)', background: T.brandSoft, color: T.brandText, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 0, minWidth: 0 }}>
            {nrStages.length ? nrStages.map(stageName).join(', ') : '—'}<FaChevronDown size={9}/>
          </button>
          <b>{t.nrB}</b><span>{t.nrC((R.noReply.steps || []).length)}</span></>}>
        <SequenceBuilder lang={isEn ? 'en' : 'he'} steps={R.noReply.steps || []} templates={tpls} tplName={tplName} onGoHours={onGoHours}
          renderToken={p => <TplToken tplOpts={tplOpts} tpls={tpls} t={t} {...p}/>}
          renderPreview={id => renderTemplate(tpls.find(x => x.id === id), { name: isEn ? 'Dana' : 'דנה', prop_title: isEn ? 'Plot in Tel Mond' : 'מגרש בתל מונד' }, cfg, isEn ? 'en' : 'he')}
          onChange={steps => setCfg(c => { c.rules.noReply.steps = steps })}/>
      </RuleCard>
      <Popover anchor={stagesBtn} open={stagesOpen} onClose={() => setStagesOpen(false)} width={240} dir={dir} label={t.stagesPick}>
        <div role="listbox" aria-multiselectable="true" style={{ display: 'flex', flexDirection: 'column' }}>
          {STAGES.filter(s => s !== 'won').map(s => {
            const on = nrStages.includes(s)
            return (
              <label key={s} className="au-hov" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, padding: '0 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={on} onChange={() => setCfg(c => { const set = new Set(c.rules.noReply.stages || []); on ? set.delete(s) : set.add(s); c.rules.noReply.stages = [...set] })} style={{ appearance: 'auto', width: 18, height: 18, minHeight: 0 }}/>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[s] }}/>{stageName(s)}
              </label>
            )
          })}
        </div>
      </Popover>

      <RuleCard {...cardProps} id="replies" icon="💬" accent={T.blue} mode={R.replies.mode === 'off' ? 'off' : 'auto'} help={R.replies.mode === 'off' ? t.helpOff : t.helpAutoNow} kind="reply"
        toggle={<Toggle checked={R.replies.mode !== 'off'} onChange={v => setCfg(c => { c.rules.replies.mode = v ? 'auto' : 'off' })} label={t.rReplies}/>}
        broken={tplBroken([R.replies.negativeTemplateId, R.replies.positiveTemplateId])}
        sentence={<><span>{t.rS[0]}</span><b>{t.rS[1]}</b><span>{t.rS[2]}</span></>}>
        <Toggle checked={!!R.replies.notifyTeam} onChange={v => setCfg(c => { c.rules.replies.notifyTeam = v })}>{t.notifyTeam}</Toggle>
        <div className="au-branches">
          {[['negative', t.negTitle, T.grey, '🙏', t.negNote], ['positive', t.posTitle, T.blue, '🔥', null]].map(([k, title, col, ic, note]) => (
            <div key={k} style={{ padding: 14, borderRadius: 12, border: `1px solid ${col}44`, borderInlineStart: `3px solid ${col}`, background: `${col}0c`, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 14, flex: 1 }}>{ic} {title}</b>
                <ModeSwitch size="sm" value={R.replies[`${k}Mode`]} onChange={v => setCfg(c => { c.rules.replies[`${k}Mode`] = v })} labels={t.modes} label={title}/>
              </div>
              {note && <div style={{ fontSize: 12, color: T.text3 }}>{note}</div>}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: T.text2 }}>{t.sendLbl}<TplToken tplOpts={tplOpts} tpls={tpls} t={t} value={R.replies[`${k}TemplateId`]} onChange={v => setCfg(c => { c.rules.replies[`${k}TemplateId`] = v })}/></div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: T.text2 }}>{t.moveTo}
                <TokenSelect value={R.replies[`${k}MoveTo`] || ''} onChange={v => setCfg(c => { c.rules.replies[`${k}MoveTo`] = v })} label={t.moveTo} options={[{ value: '', label: t.noMove }, ...STAGES.map(s => ({ value: s, label: stageName(s) }))]} minWidth={110}/>
              </div>
              <Field label={t.triggerWords}><KeywordInput words={R.replies[k] || []} onChange={w => setCfg(c => { c.rules.replies[k] = w })} t={t}/></Field>
            </div>
          ))}
        </div>
        <ReplyTester t={t} cfg={cfg}/>
      </RuleCard>

      <RuleCard {...cardProps} id="stage" icon="🗂️" accent="#A25DDC" mode={Object.values(R.stage || {}).some(r => r?.mode && r.mode !== 'off') ? 'auto' : 'off'} kind="stage" help={t.stageHelp} broken={tplBroken(Object.values(R.stage || {}).map(r => r?.templateId))}
        sentence={<><span>{t.stS[0]}</span><b>{t.stS[1]}</b><span>{t.stS[2]}</span></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['contacted', 'discovery', 'negotiating', 'won', 'lost'].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 48, padding: '6px 10px', borderRadius: 10, background: 'rgba(0,0,0,.14)', border: `1px solid ${T.divider}` }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 150, fontSize: 13.5, fontWeight: 700 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[s] }}/>{stageName(s)}</span>
              <span style={{ color: T.text3 }}>{isEn ? <FaArrowRight size={10}/> : <FaArrowLeft size={10}/>}</span>
              <span style={{ flex: 1, minWidth: 160 }}><TplToken tplOpts={tplOpts} tpls={tpls} t={t} value={R.stage?.[s]?.templateId} onChange={v => setCfg(c => { c.rules.stage[s] = { ...(c.rules.stage[s] || {}), templateId: v } })}/></span>
              <ModeSwitch size="sm" value={R.stage?.[s]?.mode || 'off'} onChange={v => setCfg(c => { c.rules.stage[s] = { ...(c.rules.stage[s] || {}), mode: v } })} labels={t.modes} label={stageName(s)}/>
            </div>
          ))}
        </div>
      </RuleCard>

      <RuleCard {...cardProps} id="reengage" icon="🔁" accent="#60D4F7" mode={R.reengage.mode} onMode={v => setCfg(c => { c.rules.reengage.mode = v })} kind="reengage" help={helper(R.reengage.mode)} broken={tplBroken([R.reengage.templateId])}
        sentence={<><span>{t.reA}</span>
          <button ref={reBtn} type="button" onClick={() => setReOpen(true)} aria-haspopup="dialog"
            style={{ height: 30, padding: '0 8px', borderRadius: 6, border: 'none', borderBottom: '1px dashed rgba(163,173,235,.6)', background: T.brandSoft, color: T.brandText, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 0, minWidth: 0, fontVariantNumeric: 'tabular-nums' }}>{R.reengage.days}<FaChevronDown size={9}/></button>
          <span>{t.reB}</span><b>{t.reC}</b><span>{t.reD}</span><TplToken tplOpts={tplOpts} tpls={tpls} t={t} value={R.reengage.templateId} onChange={v => setCfg(c => { c.rules.reengage.templateId = v })}/></>}/>
      <Popover anchor={reBtn} open={reOpen} onClose={() => setReOpen(false)} width={240} dir={dir} label={t.daysLbl}>
        <div style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          {[-7, -1].map(d => <Button key={d} size="sm" onClick={() => setCfg(c => { c.rules.reengage.days = Math.max(7, (c.rules.reengage.days || 45) + d) })}>{d}</Button>)}
          <input data-autofocus inputMode="numeric" value={R.reengage.days} aria-label={t.daysLbl} onChange={e => setCfg(c => { c.rules.reengage.days = Math.min(365, Math.max(7, Number(e.target.value.replace(/\D/g, '')) || 7)) })}
            style={{ width: 56, height: 32, textAlign: 'center', borderRadius: 8, border: `1px solid ${T.s3Line}`, background: T.s3, color: T.text, fontFamily: 'inherit', fontSize: 14, minHeight: 0 }}/>
          {[1, 7].map(d => <Button key={d} size="sm" onClick={() => setCfg(c => { c.rules.reengage.days = Math.min(365, (c.rules.reengage.days || 45) + d) })}>+{d}</Button>)}
        </div>
      </Popover>
    </div>
  )
}

function KeywordInput({ words, onChange, t }) {
  const [v, setV] = useState('')
  const [all, setAll] = useState(false)
  const input = useRef(null)
  const chips = useRef([])
  const add = raw => { const w = raw.trim(); if (w && !words.some(x => x.toLowerCase() === w.toLowerCase())) onChange([...words, w]); setV('') }
  const shown = all ? words : words.slice(0, 12)
  return (
    <div onClick={() => input.current?.focus()} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 44, padding: 6, borderRadius: 9, border: `1px solid ${T.s3Line}`, background: T.s3, cursor: 'text' }}>
      {shown.map((w, i) => (
        <span key={w} ref={el => { chips.current[i] = el }} tabIndex={0} onKeyDown={e => { if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onChange(words.filter(x => x !== w)); input.current?.focus() } }}
          style={{ height: 26, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 4px 0 9px', paddingInlineStart: 9, paddingInlineEnd: 4, borderRadius: 20, border: '1px solid rgba(132,144,216,.3)', color: T.brandText, fontSize: 11.5, fontWeight: 700 }}>
          {w}
          <button type="button" aria-label={t.removeWord(w)} onClick={e => { e.stopPropagation(); onChange(words.filter(x => x !== w)) }} style={{ width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,.25)', color: T.text2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, minHeight: 0, minWidth: 0 }}><FaTimes size={8}/></button>
        </span>
      ))}
      {!all && words.length > 12 && <button type="button" onClick={e => { e.stopPropagation(); setAll(true) }} style={{ background: 'none', border: 'none', color: T.text3, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0, minWidth: 0 }}>{t.showMore(words.length - 12)}</button>}
      <input ref={input} value={v} onChange={e => setV(e.target.value)} placeholder={t.addWord} aria-label={t.addWord}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(v) } else if (e.key === 'Backspace' && !v && shown.length) { e.preventDefault(); chips.current[shown.length - 1]?.focus() } }} onBlur={() => v && add(v)}
        style={{ flex: 1, minWidth: 120, height: 26, background: 'transparent', border: 'none', outline: 'none', color: T.text, fontFamily: 'inherit', fontSize: 12.5, minHeight: 0 }}/>
    </div>
  )
}

function ReplyTester({ t, cfg }) {
  const [v, setV] = useState('')
  const [d, setD] = useState('')
  useEffect(() => { const id = setTimeout(() => setD(v), 400); return () => clearTimeout(id) }, [v])
  const res = d.trim() ? classifyReply(d, cfg) : null
  const kw = d.trim() ? matchedKeyword(d, cfg) : null
  const [txt, col] = res === 'negative' ? [t.detNeg, T.grey] : res === 'positive' ? [t.detPos, T.blue] : res === 'reply' ? [t.detReply, T.brand] : [null, null]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 12, border: `1px dashed ${T.line2}` }}>
      <Field label={t.tester} htmlFor="au-tester"><input id="au-tester" value={v} onChange={e => setV(e.target.value)} placeholder={t.testerPh} dir="auto" style={inputStyle}/></Field>
      <div aria-live="polite" style={{ minHeight: 22, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {txt && <Badge color={col} textColor={col === T.grey ? T.text : col === T.blue ? T.blue : T.brandText}>{txt}</Badge>}
        {kw && <span style={{ fontSize: 12, color: T.text3 }}>{t.matchedBy(kw)}</span>}
      </div>
    </div>
  )
}

// ── Log ────────────────────────────────────────────────────────────────────────
function Log({ t, isEn, dir, tplName, leads, toast, confirm, log, loadLog, logLimit, setLogLimit, states, loadStates, filter, setFilter }) {
  const [kind, setKind] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState({})
  const [retrying, setRetrying] = useState({})
  const all = log?.rows || []
  const opted = Object.values(states).filter(s => s.optOut)
  const nameOf = id => leads.find(l => String(l.id) === String(id))?.name || ''
  const rows = all.filter(r => filter === 'all' || (filter === 'sent' ? r.ok : filter === 'failed' ? !r.ok : true))
    .filter(r => !kind || ruleKind(r.rule_key) === kind)
    .filter(r => !q || `${r.name || ''} ${r.phone || ''} ${r.message || ''}`.toLowerCase().includes(q.toLowerCase()))
  const retry = async r => {
    setRetrying(x => ({ ...x, [r.id]: true }))
    try {
      const res = await autoApi.post('auto-send', { items: [{ leadId: r.lead_id, phone: r.phone, text: r.message, ruleKey: r.rule_key?.startsWith('reply:negative') ? r.rule_key : 'manual', templateId: r.template_id }] })
      if (!res.results?.[0]?.ok) throw new Error(res.results?.[0]?.error || t.error)
      toast(t.resent); loadLog()
    } catch (e) { toast(`${t.error}: ${e.message}`, { tone: 'error' }) } finally { setRetrying(x => { const n = { ...x }; delete n[r.id]; return n }) }
  }
  const unopt = async s => {
    const n = nameOf(s.leadId) || s.leadId
    if (!await confirm({ title: t.unoptT(n), body: t.unoptB, confirmLabel: t.unopt, cancelLabel: t.cancel })) return
    try { await autoApi.post('auto-optout', { leadId: s.leadId, optOut: false }); toast(t.unoptDone); loadStates() } catch (e) { toast(`${t.error}: ${e.message}`, { tone: 'error' }) }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <ModeSwitch value={filter} onChange={setFilter} modes={['all', 'sent', 'failed', 'opted']} icons={{}} colors={{ all: T.brand, sent: T.green, failed: T.red, opted: T.grey }} label={t.tabs.log}
          labels={{ all: t.lAll, sent: t.lSent, failed: t.lFailed, opted: t.lOpted(opted.length) }}/>
        {filter !== 'opted' && <>
          <select value={kind} onChange={e => setKind(e.target.value)} aria-label={t.allKinds} style={{ ...inputStyle, width: 'auto', height: 36 }}>
            <option value="">{t.allKinds}</option>{Object.entries(t.kind).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 320 }}>
            <FaSearch size={12} style={{ position: 'absolute', top: 12, insetInlineStart: 12, color: T.text3 }}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.lSearch} aria-label={t.lSearch} style={{ ...inputStyle, height: 36, paddingInlineStart: 32 }}/>
          </div>
        </>}
        <div style={{ flex: 1 }}/>
        <IconButton icon={<FaSyncAlt size={12}/>} label={t.runNow} variant="ghost" onClick={() => { loadLog(); loadStates() }}/>
      </div>
      {log?.error && <InlineError message={log.error} onRetry={() => loadLog()} retryLabel={t.retry}/>}

      {filter === 'opted' ? (
        <Card pad={0}>{!opted.length ? <EmptyState compact icon={FaUserSlash} title={t.noOpted}/> : opted.map((s, i) => (
          <div key={s.leadId} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderTop: i ? `1px solid ${T.divider}` : 'none', flexWrap: 'wrap' }}>
            <b style={{ fontSize: 13.5 }}>{nameOf(s.leadId) || s.leadId}</b>
            <span dir="auto" style={{ flex: 1, minWidth: 140, fontSize: 12.5, color: T.text3 }}>״{s.lastInboundText}״</span>
            <Button size="sm" onClick={() => unopt(s)}>{t.unopt}</Button>
          </div>
        ))}</Card>
      ) : (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div role="table" aria-label={t.tabs.log}>
            {!log ? [0, 1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} style={{ padding: '10px 14px' }}><Skeleton h={26}/></div>)
              : !rows.length ? <EmptyState compact icon={FaHistory} title={t.lEmpty}/>
              : rows.map((r, i) => {
                const k = ruleKind(r.rule_key)
                const ex = open[r.id || i]
                return (
                  <div key={r.id || i} role="row" style={{ borderTop: i ? `1px solid ${T.divider}` : 'none' }}>
                    <div className="au-log-row" onClick={() => setOpen(o => ({ ...o, [r.id || i]: !o[r.id || i] }))} style={{ cursor: 'pointer' }} aria-expanded={!!ex}>
                      <span role="cell">{r.ok ? <FaCheckCircle color={T.green} aria-label={t.statusSent}/> : <FaTimesCircle color={T.red} aria-label={t.statusFailed}/>}</span>
                      <span role="cell" className="au-hide-m" style={{ fontSize: 12, color: T.text3, fontVariantNumeric: 'tabular-nums' }}>{new Date(r.created_at).toLocaleString(isEn ? 'en-GB' : 'he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      <b role="cell" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || nameOf(r.lead_id) || (r.phone ? <bdi dir="ltr">+{r.phone}</bdi> : '—')}</b>
                      <span role="cell" className="au-lr-kind"><Badge color={KIND_COLOR[k] || T.brand}>{t.kind[k] || k}</Badge></span>
                      <span role="cell" className="au-lr-msg" style={{ minWidth: 0, fontSize: 12.5, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dir="auto">
                        {r.template_id && <b style={{ color: T.text }}>{tplName(r.template_id)} · </b>}{String(r.message || '').replace(/\n/g, ' ')}
                      </span>
                      <span role="cell" className="au-lr-by" style={{ fontSize: 11.5, color: T.text3 }}>{t.by[r.by] || r.by}</span>
                      <span role="cell" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span className="au-only-m" style={{ fontSize: 11, color: T.text3 }}>{new Date(r.created_at).toLocaleTimeString(isEn ? 'en-GB' : 'he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                        {!r.ok && <span className="au-hide-m"><Button size="sm" icon={<FaRedo size={9}/>} loading={retrying[r.id]} onClick={e => { e.stopPropagation(); retry(r) }}>{t.retry}</Button></span>}
                      </span>
                    </div>
                    {!r.ok && r.error && !ex && <div className="au-only-m" style={{ padding: '0 14px 8px 38px', paddingInlineStart: 38, fontSize: 11.5, color: T.redText }}>{r.error}</div>}
                    {ex && (
                      <div className="au-in" style={{ padding: '4px 14px 14px', paddingInlineStart: 52, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div dir="auto" style={{ maxWidth: 520, background: T.wa.out, color: T.wa.text, borderRadius: 10, padding: '8px 10px', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}><WAText text={r.message}/></div>
                        {r.error && <div style={{ fontSize: 12.5, color: T.redText, display: 'flex', gap: 6, alignItems: 'center' }}><FaExclamationTriangle size={11}/>{r.error}</div>}
                        {!r.ok && <div><Button size="sm" variant="soft-green" icon={<FaRedo size={9}/>} loading={retrying[r.id]} onClick={() => retry(r)}>{t.retry}</Button></div>}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
          {all.length >= logLimit && <div style={{ padding: 12, display: 'flex', justifyContent: 'center', borderTop: `1px solid ${T.divider}` }}><Button onClick={() => setLogLimit(logLimit + 100)}>{t.loadMore}</Button></div>}
        </Card>
      )}
    </div>
  )
}

// ── System status drawer ───────────────────────────────────────────────────────
function SystemDrawer({ open, onClose, t, isEn, dir, health, loadHealth, cfg, setMaster, onRun, running, pingActive, lastAgo, last, issues, toast, onGoHours }) {
  const [testing, setTesting] = useState(false)
  const [copiedFile, setCopiedFile] = useState(false)
  if (!open) return null
  const g = health?.green || {}
  const greenOk = g.state === 'authorized'
  const nw = nextWindows(cfg, new Date(), 1)
  const w0 = nw.windows.find(w => !w.current)
  const hoursText = !cfg.quiet?.enabled ? t.winUnlimited : nw.open ? t.winOpenSub(fmtHour(nw.closesAt)) : w0 ? t.winClosedSub(w0.offset === 0 ? t.today : w0.offset === 1 ? t.tomorrow : t.days[w0.day], fmtHour(w0.start)) : t.winNone
  const ago = m => m < 1 ? t.justNow : m < 60 ? t.agoMin(m) : m < 1440 ? t.agoH(Math.round(m / 60)) : t.agoD(Math.round(m / 1440))
  const pingUrl = `${window.location.origin}/api/meta/auto-tick?key=${health?.tickKeyConfigured ? 'YOUR_AUTOMATION_KEY' : 'AFIKhanahal2026'}`
  const waDetail = !health ? t.pillChecking : greenOk ? t.waOk(g.phone ? `+${g.phone}` : g.instance || '') : g.state === 'notConfigured' ? t.waNotConf((g.missing || []).join(', ')) : g.state === 'notAuthorized' ? t.waNotAuth : t.waErr(g.error || g.state || '—')
  return (
    <Drawer open onClose={onClose} title={t.sysTitle} dir={dir}
      sub={<div style={{ fontSize: 12.5, marginTop: 4, color: issues ? T.amberText : T.green, fontWeight: 700 }}>{issues ? t.nIssues(issues) : t.allGood}</div>}>
      <HealthItem tone={!health ? 'info' : greenOk ? 'ok' : 'error'} title={t.waTitle} detail={waDetail} toneWord={t.tone[greenOk ? 'ok' : 'error']}>
        <Button size="sm" icon={<FaSyncAlt size={10}/>} onClick={loadHealth}>{t.checkAgain}</Button>
        {g.state === 'notAuthorized' && <Button size="sm" variant="brand" icon={<FaExternalLinkAlt size={9}/>} onClick={() => window.open('https://console.green-api.com', '_blank', 'noopener')}>{t.openGreen}</Button>}
      </HealthItem>
      <HealthItem tone={!health ? 'info' : health.storage === 'ok' ? 'ok' : 'warn'} title={t.dbTitle} detail={health?.storage === 'ok' ? t.dbOk : t.dbMissing} toneWord={t.tone[health?.storage === 'ok' ? 'ok' : 'warn']}>
        {health && health.storage !== 'ok' && <Button size="sm" icon={<FaDatabase size={10}/>} onClick={async () => { try { await navigator.clipboard.writeText('server/automations-migration.sql'); setCopiedFile(true); setTimeout(() => setCopiedFile(false), 1500) } catch {} }}>{copiedFile ? t.copied : t.copyFile}</Button>}
      </HealthItem>
      <HealthItem tone={cfg.enabled ? 'ok' : 'off'} title={t.masterTitle} detail={cfg.enabled ? t.masterOnD : t.masterOffD} toneWord={t.tone[cfg.enabled ? 'ok' : 'off']}>
        <Toggle checked={cfg.enabled} onChange={setMaster} label={t.masterTitle}/>
      </HealthItem>
      <HealthItem tone="info" title={t.hoursTitle} detail={hoursText} toneWord={t.tone.info}><Button size="sm" onClick={onGoHours}>{t.editHours}</Button></HealthItem>
      <HealthItem tone={lastAgo == null || lastAgo > 26 * 60 ? 'warn' : 'ok'} title={t.runTitle} toneWord={t.tone[lastAgo == null || lastAgo > 26 * 60 ? 'warn' : 'ok']}
        detail={lastAgo == null ? t.runNone : `${t.runAgo(ago(lastAgo), t.src[last.source] || last.source)}${lastAgo > 26 * 60 ? ` · ${t.runStale}` : ''}`}>
        <Button size="sm" icon={<FaSyncAlt size={10} className={running ? 'au-spin' : undefined}/>} onClick={() => onRun?.()} disabled={running}>{t.runNow}</Button>
      </HealthItem>
      <HealthItem tone={pingActive ? 'ok' : 'off'} title={t.pingTitle} detail={<><div>{t.pingExplain}</div><div style={{ marginTop: 6, fontWeight: 700, color: pingActive ? T.green : T.text3 }}>{pingActive ? t.pingOn(lastAgo) : t.pingOff}</div></>} toneWord={t.tone[pingActive ? 'ok' : 'off']}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CopyField value={pingUrl} masked labels={{ url: t.pingUrl, show: t.show, hide: t.hide, copy: t.copy, copied: t.copied }}/>
          <ol style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, color: T.text2, display: 'flex', flexDirection: 'column', gap: 4 }}>{t.pingSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      </HealthItem>
      <HealthItem tone={greenOk ? 'info' : 'off'} title={t.testTitle} toneWord={t.tone.info}>
        <Button size="sm" variant="soft-green" icon={<FaPaperPlane size={10}/>} disabled={!greenOk} loading={testing}
          onClick={async () => { setTesting(true); try { await autoApi.post('auto-test', {}); toast(t.testSent) } catch (e) { toast(`${t.error}: ${e.message}`, { tone: 'error' }) } finally { setTesting(false) } }}>{t.testBtn}</Button>
      </HealthItem>
    </Drawer>
  )
}
