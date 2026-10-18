// Google Analytics 4 — the site-traffic dashboard (admin → אנליטיקס → Google Analytics), built like the Korkos site's:
// live panel, KPIs vs the previous period, contacts (CRM leads + form / phone / WhatsApp / email clicks), the main chart
// (metric, day / week / month, previous period, anomalies), insights, channels, UTM campaigns, source / medium, landing
// pages, pages with a drill-down, devices, geography, a weekday × hour heat map and site actions.
// Data: POST /api/meta/ga4-dash (lib/ga4.js dash) — real GA4 data only, never demo numbers.
import { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react'
import { AN_CSS, TipLayer, Lbl } from './analyticsUI.jsx'

const API = '/api/meta'
const NO_TRACK_KEY = 'afik_no_track'        // index.html skips GA / GTM / Pixel in a browser that has it
const GA_URL = p => `https://analytics.google.com/analytics/web/#/p${p}/reports/intelligenthome`

const TR = {
  he: {
    title: 'תנועת האתר', src: 'Google Analytics', vsPrev: 'השוואה לתקופה מקבילה קודמת', refresh: 'רענון', openGa: 'פתח ב-Google Analytics', csv: 'CSV',
    presets: { '7d': '7 ימים', '30d': '30 יום', '90d': '90 יום', tm: 'החודש', lm: 'חודש שעבר' },
    loading: 'טוען נתונים מ-Google Analytics…', last30: 'ב-30 הדקות האחרונות', noData: 'אין נתונים בטווח שנבחר',
    live: 'פעילות ב-30 הדקות האחרונות', liveSub: 'מתעדכן כל דקה · Google Analytics מחזיק חלון של 30 דקות אחורה', liveUsers: 'גולשים ב-30 הדקות האחרונות',
    liveViews: n => (n ? `${n} צפיות בחצי השעה האחרונה` : 'אין פעילות בחצי השעה האחרונה'), livePages: 'עמודים שנצפים כרגע', liveNone: 'אף אחד לא ביקר באתר ב-30 הדקות האחרונות',
    liveTitlesNote: 'Google מדווח בזמן אמת לפי כותרת העמוד ולא לפי הכתובת.', liveFrom: 'מאיפה הגיעו', today: 'היום', liveNoToday: 'אין עדיין ביקורים היום',
    liveFromNote: 'המקור הוא נתון של היום ולא של הרגע: ל-API של זמן אמת אין מימד מקור תנועה.', exactSrc: 'מקורות מדויקים', liveDevices: 'מכשירים עכשיו',
    todayLine: (u, s, v) => `היום עד עכשיו: ${u} גולשים · ${s} ביקורים · ${v} צפיות`,
    selfEx: 'אל תספור את הביקורים שלי', selfExTip: 'הביקורים שלך מהדפדפן הזה לא ייספרו',
    k: { users: 'משתמשים', sessions: 'ביקורים', views: 'צפיות עמוד', eng: 'שיעור מעורבות', leads: 'לידים במערכת', newUsers: 'משתמשים חדשים', engaged: 'ביקורים מעורבים', vps: 'צפיות לביקור', dur: 'משך ביקור ממוצע', bounce: 'שיעור נטישה', events: 'אירועים', cr: 'שיעור פנייה' },
    tips: {
      users: 'אנשים שונים שביקרו באתר', sessions: 'סך הכניסות לאתר', views: 'סך העמודים שנצפו', eng: 'ביקורים עם התעניינות אמיתית',
      leads: 'לידים שנכנסו למערכת · אתר + פייסבוק', newUsers: 'מבקרים בפעם הראשונה', engaged: 'ביקורים שלא הסתיימו מיד',
      vps: 'עמודים בממוצע בכל ביקור', dur: 'משך ממוצע של ביקור', bounce: 'ביקורים בלי התעניינות · נמוך = טוב', events: 'כל הפעולות שנמדדו באתר',
      cr: 'אחוז הביקורים שהסתיימו בפנייה',
    },
    colTip: { channel: 'סוג התנועה שהביאה את הגולש', campaign: 'שם הקמפיין בקישור (utm_campaign)', src: 'האתר המפנה / סוג התנועה', page: 'העמוד באתר · לחיצה לפירוט', landing: 'העמוד הראשון בביקור', device: 'סוג המכשיר', users: 'אנשים שונים', sessions: 'כניסות לאתר', share: 'חלק מכלל הביקורים', eng: 'ביקורים עם התעניינות', conv: 'ביקורים עם טופס או לחיצה', cr: 'פניות מתוך הביקורים', views: 'צפיות בעמוד', time: 'זמן מעורבות ממוצע לגולש', action: 'הפעולה שבוצעה באתר', count: 'כמה פעמים קרתה', people: 'כמה אנשים שונים' },
    sectTip: { live: 'גולשים פעילים בחצי השעה האחרונה', liveNow: 'גולשים באתר ב-30 הדקות האחרונות', livePages: 'העמודים שפתוחים עכשיו', liveFrom: 'מקורות התנועה של היום', conv: 'מה שהתנועה מייצרת בפועל', convBig: 'לידים במערכת שלנו · המספר הקובע', chart: 'מגמה לאורך התקופה מול התקופה הקודמת', insights: 'מסקנות אוטומטיות מהנתונים', devices: 'מחשב, נייד או טאבלט', newRet: 'מבקרים חדשים מול חוזרים', geo: 'לפי מיקום הגולש (הערכה של גוגל)', heat: 'כהה יותר = יותר ביקורים' },
    conv: 'פניות', convSub: 'מה שהתנועה באמת מייצרת', convBig: 'לידים שנכנסו למערכת בתקופה', convBigSub: (s, m) => `${s} מהאתר · ${m} מפייסבוק / אינסטגרם · לידים שהוזנו ידנית לא נספרים. זה המספר הקובע.`,
    convExplain: 'מתחת: טפסים ולחיצות על טלפון, וואטסאפ ומייל, כפי שגוגל מדד אותם באתר. לחיצה היא לא שיחה: גוגל לא יודע אם השיחה יצאה. אדם שלחץ פעמיים נספר פעמיים ב"פעולות" ופעם אחת ב"אנשים".',
    convNote: 'לידים מטופס של פייסבוק/אינסטגרם לא עוברים באתר, ולכן הם נספרים במספר הגדול ולא בטפסים של גוגל. חוסמי פרסומות לא נספרים בגוגל, אבל הטופס שלהם נשמר.',
    convTypes: { contact_form: ['טפסים שנשלחו', 'טופס פנייה שנשלח באתר'], phone_click: ['לחיצות טלפון', 'לחיצה על מספר הטלפון'], whatsapp_click: ['לחיצות וואטסאפ', 'כולל הכפתור הצף'], email_click: ['לחיצות מייל', 'לחיצה על כתובת המייל'] },
    people: n => `${n} ${n === 1 ? 'אדם' : 'אנשים'}`,
    metrics: { users: 'משתמשים', sessions: 'ביקורים', views: 'צפיות', conv: 'אנשים שפנו' }, prevPeriod: 'תקופה קודמת', thisPeriod: 'התקופה הנבחרת', chartTitle: 'מגמה', gran: { day: 'יומי', week: 'שבועי', month: 'חודשי' },
    anomalies: (n, list) => `זוהו ${n} ימים חריגים: ${list}`, spike: 'קפיצה', drop: 'ירידה',
    insights: 'תובנות', channels: 'מקורות תנועה', channelsTip: 'חיפוש, ישיר, רשתות חברתיות, ממומן או הפניות',
    campaigns: 'קמפיינים (UTM)', campaignsTip: 'מודעות וקישורים מתויגים (UTM)',
    sources: 'מקור / מדיום', sourcesTip: 'פירוט מדויק, למשל google / organic',
    landing: 'דפי נחיתה', landingTip: 'העמוד שבו התחיל הביקור ומה הוא הניב',
    pages: 'עמודים', pagesTip: 'העמודים הנצפים ביותר · לחיצה לפירוט', pageHint: 'לחיצה על עמוד פותחת פירוט: מגמה, מקורות ומכשירים של אותו עמוד',
    devices: 'מכשירים', newRet: 'חדשים מול חוזרים', newU: 'חדשים', retU: 'חוזרים', geo: 'מדינות וערים', heat: 'מתי מבקרים באתר', heatSub: 'ביקורים לפי יום ושעה (שעון ישראל)',
    actions: 'פעולות באתר', actionsTip: 'פעולות עסקיות שהאתר מדווח',
    col: { channel: 'ערוץ', campaign: 'קמפיין', src: 'מקור / מדיום', page: 'עמוד', landing: 'דף נחיתה', device: 'מכשיר', users: 'משתמשים', sessions: 'ביקורים', share: 'נתח', eng: 'מעורבות', conv: 'פניות', cr: 'שיעור פנייה', views: 'צפיות', time: 'זמן ממוצע', action: 'פעולה', count: 'כמות', people: 'אנשים' },
    quality: avg => `★ = שיעור פנייה גבוה משמעותית מהממוצע (${avg}), תנועה איכותית. פניות = ביקורים שבהם הייתה פנייה.`,
    search: 'חיפוש…', drillLoading: 'טוען נתוני עמוד…', drillViews: 'צפיות לאורך התקופה', drillSources: 'מקורות לעמוד זה', drillDevices: 'מכשירים', few: 'מעט נתונים',
    ev: { contact_form: ['טופס נשלח', 'שליחת טופס פנייה'], generate_lead: ['ליד (עמודי תוכן)', 'טופס בעמודי השירותים, האזורים והמדריכים'], lead_form_step: ['התקדמות בטופס', 'מעבר שלב בטופס בן 3 השלבים'], form_start: ['התחילו למלא טופס', 'נמדד אוטומטית על ידי גוגל'], phone_click: ['לחיצה על טלפון', ''], whatsapp_click: ['לחיצה על וואטסאפ', 'כולל הכפתור הצף'], email_click: ['לחיצה על מייל', ''], cta_click: ['לחיצה על כפתור פעולה', 'כפתורי "דברו איתנו" בעמודי התוכן'], property_view: ['צפייה בנכס', 'פתיחת חלון נכס'], share_property: ['שיתוף נכס', ''], favorite_add: ['שמירת נכס במועדפים', ''], tool_use: ['שימוש במחשבון', 'מחשבון מס רכישה / נטו למוכר'] },
    ch: { 'Organic Search': 'חיפוש אורגני', Direct: 'ישיר', 'Paid Search': 'חיפוש ממומן', 'Organic Social': 'רשתות חברתיות', 'Paid Social': 'סושיאל ממומן', Referral: 'אתרים מפנים', Email: 'אימייל', Display: 'דיספליי', Unassigned: 'לא משויך', 'Cross-network': 'רב-ערוצי', 'Organic Maps': 'מפות', 'Organic Video': 'וידאו', 'Paid Video': 'וידאו ממומן', 'Paid Other': 'ממומן – אחר', SMS: 'SMS', 'Organic Shopping': 'שופינג' },
    dev: { desktop: 'מחשב', mobile: 'נייד', tablet: 'טאבלט', 'smart tv': 'טלוויזיה' },
    dow: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'], less: 'פחות', more: 'יותר',
    ins: {
      traffic: (up, pct, a, b) => `התנועה ${up ? 'עלתה' : 'ירדה'} ב-${pct}% מול התקופה הקודמת (${a} ← ${b} משתמשים).`,
      top: (ch, pct) => `${ch} הוא מקור התנועה הגדול ביותר: ${pct}% מהביקורים.`,
      quality: (ch, x) => `${ch} מביא פחות תנועה אבל ממיר פי ${x} מהממוצע: תנועה איכותית.`,
      mobile: (share, less) => `הנייד הוא ${share}% מהתנועה אבל ממיר ${less}% פחות מהמחשב. שווה לבדוק את חוויית הנייד.`,
      lowPage: (p, t) => `"${p}" מקבל הרבה תנועה אבל זמן מעורבות נמוך במיוחד (${t}).`,
      camp: (c, n) => `הקמפיין "${c}" הביא הכי הרבה ביקורים (${n}).`,
      leadsGap: (crm, ga) => `נכנסו ${crm} לידים למערכת מול ${ga} טפסים שגוגל מדד. רוב ההפרש הוא לידים מטופסי פייסבוק, שלא עוברים באתר.`,
      anomaly: (d, up, n) => `ב-${d} נרשמה ${up ? 'קפיצה' : 'ירידה'} חריגה בתנועה (${n} משתמשים).`,
    },
    await: 'החיבור פעיל ✓', awaitT: 'Google מעבד את הנתונים', awaitB: 'אין עדיין נתונים בטווח הזה. אם הנכס חדש, Google מעבד דוחות תוך 24–48 שעות. נתוני זמן האמת למעלה מגיעים מיד.',
    setupT: 'חיבור Google Analytics לדשבורד', setupB: 'תג המדידה כבר פועל באתר (G-X1S3XX7TRV). כדי שהדשבורד יקרא את הנתונים צריך חשבון שירות של Google עם הרשאת צפייה. אפשר להשתמש באותו חשבון שירות של אתר קורקוס.',
    setupKorkos: 'הדרך המהירה (אותו מפתח של קורקוס)', setupNew: 'או חשבון שירות חדש',
    stepsKorkos: [
      ['ב-Vercel, בפרויקט של קורקוס: Settings ← Environment Variables. העתיקו את הערכים של GA_SA_CLIENT_EMAIL ו-GA_SA_PRIVATE_KEY.', 'https://vercel.com/dashboard'],
      ['ב-Vercel, בפרויקט של אפיק הנחל: הוסיפו את שני המשתנים באותם שמות ובאותם ערכים, ואז Redeploy.', 'https://vercel.com/dashboard'],
      ['ב-Google Analytics, בנכס "הנגר 24 הוד השרון": Admin ← Property access management ← ➕ ← הדביקו את כתובת ה-GA_SA_CLIENT_EMAIL ← Viewer.', 'https://analytics.google.com/analytics/web/#/a/p536943897/admin'],
    ],
    stepsNew: [
      ['הפעלת Google Analytics Data API בענן של Google', 'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com'],
      ['Service Accounts ← Create ← Keys ← Add key ← JSON (יירד קובץ)', 'https://console.cloud.google.com/iam-admin/serviceaccounts'],
      ['ב-Vercel: משתנה GA4_SERVICE_ACCOUNT_JSON עם כל תוכן הקובץ ← Redeploy', 'https://vercel.com/dashboard'],
      ['ב-Analytics: הוסיפו את ה-client_email מהקובץ כ-Viewer לנכס', 'https://analytics.google.com/analytics/web/#/a/p536943897/admin'],
    ],
    open: 'פתח', settings: 'הגדרות חיבור', propId: 'מזהה הנכס (Property ID)', saveTest: 'שמירה ובדיקת חיבור', testing: 'בודק…', ok: sa => `החיבור תקין ✓${sa ? ` · ${sa}` : ''}`, failed: 'שגיאת חיבור',
    errT: 'Google Analytics החזיר שגיאה', retry: 'נסה שוב',
    keyIdNote: (k, sa) => `מזהה המפתח שמוגדר ב-Vercel מתחיל ב-${k}${sa ? ` (${sa})` : ''}. ב-Google Cloud ← Service Accounts ← Keys בדקו שמפתח עם המזהה הזה קיים ופעיל. אם הוא נמחק, צרו מפתח חדש והדביקו את הקובץ החדש ב-Vercel.`,
    why: { permission: sa => `חשבון השירות${sa ? ` ${sa}` : ''} עדיין לא קיבל גישה לנכס. ב-Analytics ← Admin ← Property access management הוסיפו אותו כ-Viewer.`, api: 'ה-Analytics Data API לא מופעל בפרויקט של חשבון השירות.', auth: 'Google דחה את המפתח (Invalid JWT Signature): המפתח שהודבק ב-Vercel נמחק או בוטל ב-Google Cloud, או שהודבק קובץ ישן.', property: 'מזהה הנכס שגוי (מספר, לא G-XXXX).', quota: 'Google Analytics קיבל יותר מדי בקשות בבת אחת. זה זמני: הדשבורד מנסה שוב לבד בעוד כמה שניות.', other: 'נסו שוב בעוד רגע.' },
    retrying: s => `מנסה שוב בעוד ${s} שניות…`, stale: at => `Google Analytics עמוס כרגע. מוצגים הנתונים האחרונים שנטענו (${at}).`,
  },
  en: {
    title: 'Site traffic', src: 'Google Analytics', vsPrev: 'compared with the previous period of the same length', refresh: 'Refresh', openGa: 'Open Google Analytics', csv: 'CSV',
    presets: { '7d': '7 days', '30d': '30 days', '90d': '90 days', tm: 'This month', lm: 'Last month' },
    loading: 'Loading Google Analytics data…', last30: 'in the last 30 minutes', noData: 'No data in this range',
    live: 'Activity in the last 30 minutes', liveSub: 'Updates every minute · Google Analytics keeps a 30-minute realtime window', liveUsers: 'visitors in the last 30 minutes',
    liveViews: n => (n ? `${n} page views in the last half hour` : 'No activity in the last half hour'), livePages: 'Pages being viewed now', liveNone: 'Nobody visited in the last 30 minutes',
    liveTitlesNote: 'Google reports realtime pages by title, not by URL.', liveFrom: 'Where they came from', today: 'today', liveNoToday: 'No visits yet today',
    liveFromNote: 'The source is today’s figure, not this minute’s: the realtime API has no traffic-source dimension.', exactSrc: 'Exact sources', liveDevices: 'Devices now',
    todayLine: (u, s, v) => `Today so far: ${u} visitors · ${s} sessions · ${v} views`,
    selfEx: 'Don’t count my visits', selfExTip: 'Your visits from this browser won’t be counted',
    k: { users: 'Users', sessions: 'Sessions', views: 'Page views', eng: 'Engagement rate', leads: 'Leads in the CRM', newUsers: 'New users', engaged: 'Engaged sessions', vps: 'Views per session', dur: 'Avg. session duration', bounce: 'Bounce rate', events: 'Events', cr: 'Contact rate' },
    tips: {
      users: 'Different people who visited', sessions: 'Total visits to the site', views: 'Total pages viewed', eng: 'Visits with real interest',
      leads: 'Leads that entered the CRM · site + Facebook', newUsers: 'First-time visitors', engaged: 'Visits that didn’t end at once',
      vps: 'Average pages per visit', dur: 'Average visit length', bounce: 'Visits without engagement · lower is better', events: 'Every action measured on the site',
      cr: 'Share of visits that ended in a contact',
    },
    colTip: { channel: 'The kind of traffic that brought the visitor', campaign: 'The campaign name in the link (utm_campaign)', src: 'Referring site / kind of traffic', page: 'The page · click for details', landing: 'The first page of the visit', device: 'Device type', users: 'Different people', sessions: 'Visits to the site', share: 'Share of all visits', eng: 'Visits with engagement', conv: 'Visits with a form or a click', cr: 'Contacts out of visits', views: 'Page views', time: 'Average engagement time per user', action: 'The action on the site', count: 'How many times it happened', people: 'How many different people' },
    sectTip: { live: 'Active visitors in the last half hour', liveNow: 'Visitors in the last 30 minutes', livePages: 'Pages open right now', liveFrom: 'Today’s traffic sources', conv: 'What the traffic actually produces', convBig: 'Leads in our CRM · the number that matters', chart: 'The trend over the period vs the previous one', insights: 'Automatic conclusions from the data', devices: 'Desktop, mobile or tablet', newRet: 'New vs returning visitors', geo: 'By visitor location (Google’s estimate)', heat: 'Darker = more visits' },
    conv: 'Contacts', convSub: 'What the traffic actually produces', convBig: 'Leads that entered the CRM in the period', convBigSub: (s, m) => `${s} from the website · ${m} from Facebook / Instagram · manual leads are not counted. This is the number that matters.`,
    convExplain: 'Below: forms and phone, WhatsApp and email clicks as Google measured them on the site. A click is not a call: Google can’t know whether the call happened. Someone who clicked twice counts twice as actions and once as people.',
    convNote: 'Facebook / Instagram form leads never pass through the site, so they are in the big number and not in Google’s forms. Ad blockers aren’t counted by Google, but their forms are saved.',
    convTypes: { contact_form: ['Forms sent', 'A contact form sent on the site'], phone_click: ['Phone clicks', 'A click on the phone number'], whatsapp_click: ['WhatsApp clicks', 'Including the floating button'], email_click: ['Email clicks', 'A click on the email address'] },
    people: n => `${n} ${n === 1 ? 'person' : 'people'}`,
    metrics: { users: 'Users', sessions: 'Sessions', views: 'Views', conv: 'People who contacted' }, prevPeriod: 'Previous period', thisPeriod: 'Selected period', chartTitle: 'Trend', gran: { day: 'Daily', week: 'Weekly', month: 'Monthly' },
    anomalies: (n, list) => `${n} unusual days: ${list}`, spike: 'spike', drop: 'drop',
    insights: 'Insights', channels: 'Traffic channels', channelsTip: 'Search, direct, social, paid or referrals',
    campaigns: 'Campaigns (UTM)', campaignsTip: 'Ads and tagged links (UTM)',
    sources: 'Source / medium', sourcesTip: 'The exact source, e.g. google / organic',
    landing: 'Landing pages', landingTip: 'Where the visit started and what it produced',
    pages: 'Pages', pagesTip: 'The most viewed pages · click for details', pageHint: 'Click a page for its trend, sources and devices',
    devices: 'Devices', newRet: 'New vs returning', newU: 'New', retU: 'Returning', geo: 'Countries and cities', heat: 'When people visit', heatSub: 'Sessions by weekday and hour (Israel time)',
    actions: 'Site actions', actionsTip: 'Business actions the site reports',
    col: { channel: 'Channel', campaign: 'Campaign', src: 'Source / medium', page: 'Page', landing: 'Landing page', device: 'Device', users: 'Users', sessions: 'Sessions', share: 'Share', eng: 'Engaged', conv: 'Contacts', cr: 'Contact rate', views: 'Views', time: 'Avg. time', action: 'Action', count: 'Count', people: 'People' },
    quality: avg => `★ = a contact rate well above the average (${avg}): quality traffic. Contacts = sessions with a contact.`,
    search: 'Search…', drillLoading: 'Loading page data…', drillViews: 'Views over the period', drillSources: 'Sources for this page', drillDevices: 'Devices', few: 'Little data',
    ev: { contact_form: ['Form sent', 'A contact form sent'], generate_lead: ['Lead (content pages)', 'A form on the service, area and guide pages'], lead_form_step: ['Form step', 'A step in the 3-step form'], form_start: ['Started a form', 'Measured automatically by Google'], phone_click: ['Phone click', ''], whatsapp_click: ['WhatsApp click', 'Including the floating button'], email_click: ['Email click', ''], cta_click: ['Call-to-action click', '“Talk to us” buttons on the content pages'], property_view: ['Property viewed', 'A property window opened'], share_property: ['Property shared', ''], favorite_add: ['Saved to favorites', ''], tool_use: ['Calculator used', 'Purchase tax / seller net calculators'] },
    ch: {}, dev: { desktop: 'Desktop', mobile: 'Mobile', tablet: 'Tablet', 'smart tv': 'Smart TV' },
    dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], less: 'Less', more: 'More',
    ins: {
      traffic: (up, pct, a, b) => `Traffic ${up ? 'rose' : 'fell'} ${pct}% vs the previous period (${a} → ${b} users).`,
      top: (ch, pct) => `${ch} is the biggest traffic source: ${pct}% of sessions.`,
      quality: (ch, x) => `${ch} brings less traffic but converts ${x}× the average: quality traffic.`,
      mobile: (share, less) => `Mobile is ${share}% of traffic but converts ${less}% less than desktop. Worth checking the mobile experience.`,
      lowPage: (p, t) => `"${p}" gets a lot of traffic but very low engagement time (${t}).`,
      camp: (c, n) => `The campaign "${c}" brought the most sessions (${n}).`,
      leadsGap: (crm, ga) => `${crm} leads entered the CRM vs ${ga} forms Google measured. Most of the gap is Facebook form leads, which never pass through the site.`,
      anomaly: (d, up, n) => `${d} had an unusual ${up ? 'spike' : 'drop'} in traffic (${n} users).`,
    },
    await: 'Connected ✓', awaitT: 'Google is processing the data', awaitB: 'No data in this range yet. For a new property Google processes reports within 24–48 hours. The realtime numbers above arrive at once.',
    setupT: 'Connect Google Analytics to the dashboard', setupB: 'The tag already runs on the site (G-X1S3XX7TRV). To read the data the dashboard needs a Google service account with Viewer access. The Korkos site’s service account works too.',
    setupKorkos: 'The quick way (the Korkos key)', setupNew: 'Or a new service account',
    stepsKorkos: [
      ['In Vercel, the Korkos project: Settings → Environment Variables. Copy the values of GA_SA_CLIENT_EMAIL and GA_SA_PRIVATE_KEY.', 'https://vercel.com/dashboard'],
      ['In Vercel, the Afik Hanahal project: add both variables with the same names and values, then Redeploy.', 'https://vercel.com/dashboard'],
      ['In Google Analytics, the "Hanegar 24 Hod Hasharon" property: Admin → Property access management → ➕ → the GA_SA_CLIENT_EMAIL address → Viewer.', 'https://analytics.google.com/analytics/web/#/a/p536943897/admin'],
    ],
    stepsNew: [
      ['Enable the Google Analytics Data API in Google Cloud', 'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com'],
      ['Service Accounts → Create → Keys → Add key → JSON (a file downloads)', 'https://console.cloud.google.com/iam-admin/serviceaccounts'],
      ['In Vercel: a GA4_SERVICE_ACCOUNT_JSON variable with the whole file → Redeploy', 'https://vercel.com/dashboard'],
      ['In Analytics: add the client_email from the file as a Viewer on the property', 'https://analytics.google.com/analytics/web/#/a/p536943897/admin'],
    ],
    open: 'Open', settings: 'Connection settings', propId: 'Property ID', saveTest: 'Save and test', testing: 'Testing…', ok: sa => `Connected ✓${sa ? ` · ${sa}` : ''}`, failed: 'Connection error',
    errT: 'Google Analytics returned an error', retry: 'Try again',
    keyIdNote: (k, sa) => `The key configured in Vercel has an id starting with ${k}${sa ? ` (${sa})` : ''}. In Google Cloud → Service Accounts → Keys, check that a key with this id exists and is active. If it was deleted, create a new key and paste the new file into Vercel.`,
    why: { permission: sa => `The service account${sa ? ` ${sa}` : ''} has no access to the property yet. In Analytics → Admin → Property access management, add it as a Viewer.`, api: 'The Analytics Data API is not enabled in the service account’s project.', auth: 'Google rejected the key (Invalid JWT Signature): the key pasted into Vercel was deleted or disabled in Google Cloud, or an old file was pasted.', property: 'The property id is wrong (a number, not G-XXXX).', quota: 'Google Analytics got too many requests at once. It is temporary: the dashboard retries by itself in a few seconds.', other: 'Try again in a moment.' },
    retrying: s => `Retrying in ${s} seconds…`, stale: at => `Google Analytics is busy right now. Showing the last data that loaded (${at}).`,
  },
}

// ── helpers ───────────────────────────────────────────────────────────────────
const iso = d => d.toISOString().slice(0, 10)
function presetRange(id) {
  const now = new Date(), today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  if (id === 'tm') return { start: iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))), end: iso(today) }
  if (id === 'lm') return { start: iso(new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1))), end: iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0))) }
  const days = { '7d': 7, '30d': 30, '90d': 90 }[id] || 30
  const s = new Date(today); s.setUTCDate(s.getUTCDate() - (days - 1))
  return { start: iso(s), end: iso(today) }
}
function prevRangeOf(start, end) {
  const s = new Date(start + 'T00:00:00Z'), e = new Date(end + 'T00:00:00Z'), days = Math.round((e - s) / 864e5) + 1
  const ps = new Date(s); ps.setUTCDate(ps.getUTCDate() - days)
  const pe = new Date(s); pe.setUTCDate(pe.getUTCDate() - 1)
  return { start: iso(ps), end: iso(pe) }
}
// the property's days are Israel days: lead counts use the same bounds (DST-safe, per date)
function jlmOffset(isoDate, time) {
  const probe = new Date(`${isoDate}T${time}Z`)
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(probe).reduce((o, x) => (o[x.type] = x.value, o), {})
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - probe.getTime()) / 60000)
}
const jlmBounds = (start, end) => [Date.parse(`${start}T00:00:00Z`) - jlmOffset(start, '00:00:00') * 60000, Date.parse(`${end}T23:59:59.999Z`) - jlmOffset(end, '23:59:59') * 60000]
const rows = rep => (rep?.rows || []).map(r => ({ d: (r.dimensionValues || []).map(v => v.value), m: (r.metricValues || []).map(v => Number(v.value) || 0) }))
const totalsOf = rep => rows(rep)[0]?.m || []
const fmtNum = n => (n == null || Number.isNaN(n) ? '—' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : Math.round(n).toLocaleString('he-IL'))
const fmtPct = (n, d = 1) => (n == null || Number.isNaN(n) ? '—' : (n * 100).toFixed(d) + '%')
const fmtDur = sec => { if (!sec) return '0:00'; const m = Math.floor(sec / 60); return `${m}:${String(Math.round(sec % 60)).padStart(2, '0')}` }
const dLabel = d => `${d.slice(6, 8)}.${d.slice(4, 6)}`
const leadSrc = l => (l.source === 'meta' || String(l.id || '').startsWith('meta_') ? 'meta' : 'site')

function Delta({ cur, prev, invert = false, dim = false }) {
  if (prev == null || !prev || cur == null) return <span className="an-delta an-delta--na">—</span>
  const d = (cur - prev) / prev
  if (Math.abs(d) < 0.002) return <span className="an-delta an-delta--na">0%</span>
  const up = d > 0, good = invert ? !up : up
  return <span className={`an-delta ${dim ? '' : good ? 'is-good' : 'is-bad'}`}>{up ? '↑' : '↓'}{Math.abs(d * 100).toFixed(1)}%</span>
}
function Spark({ values, w = 96, h = 26 }) {
  if (!values || values.length < 2) return null
  const max = Math.max(...values, 1), min = Math.min(...values), span = Math.max(1, max - min)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`).join(' ')
  return <svg className="an-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} dir="ltr" aria-hidden><polyline points={pts} fill="none"/></svg>
}
function bucket(series, gran) {
  if (gran === 'day' || !series.length) return series
  const keyOf = d => {
    if (gran === 'month') return d.slice(0, 6)
    const dt = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00Z`)
    dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay())      // weeks start on Sunday
    return iso(dt).replace(/-/g, '')
  }
  const map = new Map()
  for (const r of series) { const k = keyOf(r.d[0]); const e = map.get(k) || { d: [k], m: r.m.map(() => 0) }; r.m.forEach((v, i) => { e.m[i] += v }); map.set(k, e) }
  return [...map.values()]
}
function findAnomalies(series, mi = 0) {
  if (series.length < 8) return []
  const vals = series.map(r => r.m[mi]), mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1
  return series.map((r, i) => ({ r, i, z: (r.m[mi] - mean) / std })).filter(x => Math.abs(x.z) > 2.2 && Math.abs(x.r.m[mi] - mean) > mean * 0.25)
}
function exportCsv(name, head, lines) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = '﻿' + [head.map(esc).join(','), ...lines.map(l => l.map(esc).join(','))].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${name}-${iso(new Date())}.csv`; a.click(); URL.revokeObjectURL(a.href)
}
function useSort(def) {
  const [sort, setSort] = useState(def)
  return [sort, key => setSort(s => ({ key, desc: s.key === key ? !s.desc : true }))]
}
// a column header: a short explanation on hover; sortable when onSort is given
const Th = ({ label, tip, k, sort, onSort, num = true }) => (
  <th className={num ? 'is-num' : ''} {...(onSort ? { onClick: () => onSort(k), role: 'button', 'aria-sort': sort.key === k ? (sort.desc ? 'descending' : 'ascending') : 'none' } : {})}>
    <Lbl tip={tip}>{label}{onSort && sort.key === k ? (sort.desc ? ' ↓' : ' ↑') : ''}</Lbl>
  </th>
)

// ── the main chart ──────────────────────────────────────────────────────────────
function HeroChart({ t, series, prevSeries }) {
  const [metric, setMetric] = useState(0)
  const [gran, setGran] = useState('day')
  const [compare, setCompare] = useState(true)
  const [hover, setHover] = useState(null)
  const wrapRef = useRef(null)
  const [W, setW] = useState(960)
  const has = series.length > 0
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [has])
  const cur = useMemo(() => bucket(series, gran), [series, gran])
  const prev = useMemo(() => bucket(prevSeries, gran), [prevSeries, gran])
  const anomalies = useMemo(() => (gran === 'day' ? findAnomalies(cur, metric) : []), [cur, metric, gran])
  if (!cur.length) return <p className="an-empty">{t.noData}</p>
  const H = W < 560 ? 210 : 250, PL = 40, PB = 24, PT = 12, PR = 8, n = cur.length
  const max = Math.max(1, ...cur.map(r => r.m[metric]), ...(compare ? prev.map(r => r.m[metric]) : [0]))
  const x = (i, len = n) => PL + (len < 2 ? (W - PL - PR) / 2 : (i / (len - 1)) * (W - PL - PR))
  const y = v => PT + (1 - v / max) * (H - PT - PB)
  const line = list => list.map((r, i) => `${i ? 'L' : 'M'}${x(i, list.length).toFixed(1)},${y(r.m[metric]).toFixed(1)}`).join('')
  const area = `${line(cur)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`
  const maxTicks = Math.max(4, Math.floor(W / 84))
  const ticks = cur.length > maxTicks ? cur.filter((_, i) => i % Math.ceil(cur.length / maxTicks) === 0) : cur
  const lbl = d => (gran === 'month' ? `${d.slice(4, 6)}/${d.slice(2, 4)}` : dLabel(d))
  const onMove = e => {
    const rect = wrapRef.current?.getBoundingClientRect(); if (!rect) return
    const rel = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((rel - PL) / (W - PL - PR)) * (n - 1))
    setHover(i >= 0 && i < n ? { i, px: (x(i) / W) * rect.width } : null)
  }
  const hv = hover ? cur[hover.i] : null, hvPrev = hover && prev[hover.i] ? prev[hover.i] : null
  const MET = [['users', 0], ['sessions', 1], ['views', 2], ['conv', 3]]
  return (
    <div className="an-hero">
      <div className="an-hero__bar">
        <div className="an-sect-head" style={{ gap: 10 }}>
          <Lbl tip={t.sectTip.chart} className="an-h5" as="h4">{t.chartTitle}</Lbl>
          <div className="an-seg" role="radiogroup">{MET.map(([id, i]) => <button key={id} type="button" role="radio" aria-checked={metric === i} className={metric === i ? 'is-on' : ''} onClick={() => setMetric(i)}>{t.metrics[id]}</button>)}</div>
        </div>
        <div className="an-hero__bar-side">
          <label className="an-check"><input type="checkbox" checked={compare} onChange={() => setCompare(!compare)}/> {t.prevPeriod}</label>
          <div className="an-seg an-seg--sm" role="radiogroup">{['day', 'week', 'month'].map(g => <button key={g} type="button" role="radio" aria-checked={gran === g} className={gran === g ? 'is-on' : ''} onClick={() => { setGran(g); setHover(null) }}>{t.gran[g]}</button>)}</div>
        </div>
      </div>
      <div className="an-hero__plot" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} height={H} dir="ltr" role="img" aria-label={t.metrics[MET[metric][0]]}>
          {[0.25, 0.5, 0.75, 1].map(f => <g key={f}><line x1={PL} x2={W - PR} y1={y(max * f)} y2={y(max * f)} className="an-grid"/><text x={PL - 7} y={y(max * f) + 4} className="an-axis" textAnchor="end">{fmtNum(max * f)}</text></g>)}
          {ticks.map(r => <text key={r.d[0]} x={x(cur.indexOf(r))} y={H - 7} className="an-axis" textAnchor="middle">{lbl(r.d[0])}</text>)}
          <path d={area} className="an-area"/>
          {compare && prev.length > 1 && <path d={line(prev)} className="an-line--prev" fill="none"/>}
          <path d={line(cur)} className="an-line" fill="none"/>
          {anomalies.map(a => <circle key={a.r.d[0]} cx={x(a.i)} cy={y(a.r.m[metric])} r="4.5" className={a.z > 0 ? 'an-dot--spike' : 'an-dot--drop'}/>)}
          <circle cx={x(n - 1)} cy={y(cur[n - 1].m[metric])} r="3.5" className="an-dot--last"/>
          {hover && <line x1={x(hover.i)} x2={x(hover.i)} y1={PT} y2={H - PB} className="an-cross"/>}
        </svg>
        {hv && (
          <div className="an-tip" style={{ left: `min(max(${hover.px}px, 80px), calc(100% - 80px))` }}>
            <b>{lbl(hv.d[0])}</b>
            <span>{t.metrics[MET[metric][0]]}: <b>{fmtNum(hv.m[metric])}</b></span>
            {compare && hvPrev && <span className="an-tip__prev">{t.prevPeriod}: {fmtNum(hvPrev.m[metric])}</span>}
          </div>
        )}
      </div>
      <div className="an-legend"><span><i/>{t.thisPeriod}</span>{compare && <span><i className="is-prev"/>{t.prevPeriod}</span>}</div>
      {anomalies.length > 0 && <p className="an-anom-note">{t.anomalies(anomalies.length, anomalies.map(a => `${dLabel(a.r.d[0])} (${a.z > 0 ? t.spike : t.drop} — ${fmtNum(a.r.m[metric])})`).join(' · '))}</p>}
    </div>
  )
}

// ── live panel ──────────────────────────────────────────────────────────────────
function SelfExclude({ t }) {
  const [off, setOff] = useState(() => { try { return localStorage.getItem(NO_TRACK_KEY) === '1' } catch { return false } })
  return (
    <label className="an-selfex an-lbl" data-tip={t.selfExTip}>
      <input type="checkbox" checked={off} onChange={e => { try { e.target.checked ? localStorage.setItem(NO_TRACK_KEY, '1') : localStorage.removeItem(NO_TRACK_KEY) } catch {} setOff(e.target.checked) }}/>
      {t.selfEx}
    </label>
  )
}
function LivePanel({ t, rt, users, chName, devName }) {
  const pages = rows(rt?.now).filter(r => r.m[0] > 0), minutes = rows(rt?.byMinute), channels = rows(rt?.todayChannels), sources = rows(rt?.todaySources), devs = rows(rt?.devices)
  const today = totalsOf(rt?.todayTotals)
  const buckets = Array.from({ length: 30 }, (_, i) => { const hit = minutes.find(r => Number(r.d[0]) === 29 - i); return hit ? hit.m[0] : 0 })
  const peak = Math.max(1, ...buckets), halfHour = buckets.reduce((a, b) => a + b, 0)
  return (
    <section className="an-live-panel">
      <div className="an-live-panel__head">
        <div><h3><span className="an-dot"/><Lbl tip={t.sectTip.live}>{t.live}</Lbl></h3><span className="an-sub">{t.liveSub}</span></div>
        <SelfExclude t={t}/>
      </div>
      <div className="an-live-panel__grid">
        <div className="an-live-now">
          <Lbl tip={t.sectTip.liveNow} className="an-live-now__lbl">{t.liveUsers}</Lbl>
          <span className="an-live-now__num">{users == null ? '· · ·' : users}</span>
          <div className="an-live-spark" aria-hidden>{buckets.map((v, i) => <i key={i} style={{ height: `${Math.max(3, (v / peak) * 100)}%` }} className={v ? '' : 'is-empty'}/>)}</div>
          <span className="an-live-now__foot">{t.liveViews(halfHour)}</span>
          {devs.length > 0 && <span className="an-live-now__foot">{t.liveDevices}: {devs.map(d => `${devName(d.d[0])} ${d.m[0]}`).join(' · ')}</span>}
        </div>
        <div className="an-live-list">
          <h4><Lbl tip={t.sectTip.livePages}>{t.livePages}</Lbl></h4>
          {pages.length ? <ul>{pages.map(r => <li key={r.d[0]}><span className="an-live-list__name" title={r.d[0]}>{r.d[0] || '—'}</span><b>{r.m[0]}</b></li>)}</ul> : <p className="an-empty an-empty--sm">{t.liveNone}</p>}
          <p className="an-live-note">{t.liveTitlesNote}</p>
        </div>
        <div className="an-live-list">
          <h4><Lbl tip={t.sectTip.liveFrom}>{t.liveFrom}</Lbl> <span className="an-live-badge">{t.today}</span></h4>
          {channels.length ? <ul>{channels.map(r => <li key={r.d[0]}><span className="an-live-list__name">{chName(r.d[0])}</span><b>{r.m[1]}</b></li>)}</ul> : <p className="an-empty an-empty--sm">{t.liveNoToday}</p>}
          {sources.length > 0 && <p className="an-live-note" dir="auto">{t.exactSrc}: {sources.slice(0, 4).map(r => `${r.d[0]}${r.d[1] && r.d[1] !== '(none)' ? ` / ${r.d[1]}` : ''} (${r.m[1]})`).join(' · ')}</p>}
          {today.length > 0 && <p className="an-live-note">{t.todayLine(fmtNum(today[0]), fmtNum(today[1]), fmtNum(today[2]))}</p>}
          <p className="an-live-note">{t.liveFromNote}</p>
        </div>
      </div>
    </section>
  )
}

function PageDrill({ t, path, range, call, devName }) {
  const [st, setSt] = useState({ phase: 'loading' })
  useEffect(() => {
    let on = true
    setSt({ phase: 'loading' })
    call({ type: 'page', path, start: range.start, end: range.end }).then(d => on && setSt({ phase: 'ready', d })).catch(e => on && setSt({ phase: 'error', message: e.message }))
    return () => { on = false }
  }, [path, range.start, range.end]) // eslint-disable-line react-hooks/exhaustive-deps
  if (st.phase !== 'ready') return <div className="an-drill an-drill--loading">{st.phase === 'loading' ? t.drillLoading : st.message}</div>
  const ts = rows(st.d.reports.timeseries), srcs = rows(st.d.reports.sources), devs = rows(st.d.reports.devices), devTotal = devs.reduce((a, d) => a + d.m[0], 0)
  return (
    <div className="an-drill">
      <div><span className="an-h6">{t.drillViews}</span>{ts.length > 1 ? <Spark values={ts.map(r => r.m[0])} w={260} h={54}/> : <span className="an-dim">{t.few}</span>}</div>
      <div><span className="an-h6">{t.drillSources}</span>{srcs.length ? srcs.slice(0, 5).map(s => <div key={s.d[0]} className="an-row"><span dir="ltr">{s.d[0]}</span><b>{fmtNum(s.m[0])}</b></div>) : <span className="an-dim">—</span>}</div>
      <div><span className="an-h6">{t.drillDevices}</span>{devs.map(d => <div key={d.d[0]} className="an-row"><span>{devName(d.d[0])}</span><b>{devTotal ? Math.round((d.m[0] / devTotal) * 100) : 0}%</b></div>)}</div>
    </div>
  )
}

// ── the tab ─────────────────────────────────────────────────────────────────────
export default function GA4Tab({ token, lang = 'he', leads = [] }) {
  const t = TR[lang] || TR.he
  const en = lang === 'en'
  const H = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token])
  const call = useCallback(async (body, path = 'ga4-dash') => {
    const r = await fetch(`${API}/${path}`, { method: 'POST', headers: H, body: JSON.stringify(body), signal: AbortSignal.timeout(45000) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { const e = new Error(d.error || `HTTP ${r.status}`); e.kind = d.kind; e.sa = d.serviceAccount; e.keyId = d.keyId; throw e }
    return d
  }, [H])
  const chName = c => (en ? c : t.ch[c] || c)
  const devName = d => t.dev[d] || d

  const [preset, setPreset] = useState('30d')
  const [state, setState] = useState({ phase: 'loading' })
  const [rt, setRt] = useState(null)
  const [openPage, setOpenPage] = useState(null)
  const [pageQ, setPageQ] = useState(''), [srcQ, setSrcQ] = useState('')
  const [pSort, pToggle] = useSort({ key: 0, desc: true }), [sSort, sToggle] = useSort({ key: 1, desc: true })
  const [propId, setPropId] = useState(''), [saveMsg, setSaveMsg] = useState('')
  const range = useMemo(() => presetRange(preset), [preset])

  const load = useCallback((fresh = false) => {
    setState(s => (s.phase === 'ready' ? { ...s, refreshing: true } : { phase: 'loading' }))
    call({ type: 'dashboard', start: range.start, end: range.end, fresh })
      .then(d => setState(d.configured ? { phase: 'ready', data: d } : { phase: 'setup', missing: d.missing, sa: d.serviceAccount }))
      .catch(e => setState({ phase: 'error', message: e.message, kind: e.kind, sa: e.sa, keyId: e.keyId }))
  }, [call, range.start, range.end])
  useEffect(() => { load() }, [load])
  // "too many requests at once" is transient: retry by itself (10 s, 20 s, 30 s), with a visible countdown
  const [retryIn, setRetryIn] = useState(0)
  const quotaTries = useRef(0)
  useEffect(() => {
    if (state.phase === 'ready') quotaTries.current = 0
    if (state.phase !== 'error' || state.kind !== 'quota' || quotaTries.current >= 3) { setRetryIn(0); return }
    let left = 10 * ++quotaTries.current
    setRetryIn(left)
    const iv = setInterval(() => { left -= 1; setRetryIn(left); if (left <= 0) { clearInterval(iv); load() } }, 1000)
    return () => clearInterval(iv)
  }, [state.phase, state.kind, load])
  useEffect(() => { fetch(`${API}/ga4-property`, { headers: H }).then(r => r.json()).then(d => setPropId(String(d.property || ''))).catch(() => {}) }, [H])
  useEffect(() => {
    if (state.phase !== 'ready') return
    let on = true
    const pull = () => { if (document.hidden) return; call({ type: 'realtime' }).then(d => on && setRt(d.rt)).catch(() => {}) }
    pull()
    const iv = setInterval(pull, 60000)
    return () => { on = false; clearInterval(iv) }
  }, [state.phase, call])

  // CRM leads in the same Israel days (and the period before): the number that matters
  const leadCounts = useMemo(() => {
    const count = ({ start, end }) => {
      const [a, b] = jlmBounds(start, end)
      const xs = leads.filter(l => l.source !== 'manual' && (l.ts || 0) >= a && (l.ts || 0) <= b)
      return { n: xs.length, site: xs.filter(l => leadSrc(l) === 'site').length, meta: xs.filter(l => leadSrc(l) === 'meta').length }
    }
    return { cur: count(range), prev: count(prevRangeOf(range.start, range.end)) }
  }, [leads, range])

  const saveProp = async () => {
    setSaveMsg(t.testing)
    try { const d = await call({ property: propId }, 'ga4-property'); setSaveMsg(d.ok ? t.ok(d.serviceAccount) : d.configured === false ? t.setupT : t.failed); load(true) }
    catch (e) { setSaveMsg(`${t.failed}: ${e.message}`) }
  }
  const settingsBox = (
    <details className="an-settings">
      <summary>{t.settings}</summary>
      <div className="an-inline">
        <input dir="ltr" value={propId} onChange={e => setPropId(e.target.value)} placeholder="536943897" aria-label={t.propId}/>
        <button type="button" onClick={saveProp}>{t.saveTest}</button>
        {saveMsg && <span className="an-status">{saveMsg}</span>}
      </div>
    </details>
  )

  const rootRef = useRef(null)
  const shell = children => <div className="an" ref={rootRef} dir={en ? 'ltr' : 'rtl'}><style>{AN_CSS}</style><TipLayer rootRef={rootRef}/>{children}</div>
  if (state.phase === 'loading') return shell(<div className="an-skeleton">{t.loading}</div>)
  if (state.phase === 'setup' || state.phase === 'error') {
    return shell(<>
      <section className="an-setup">
        <h3>{state.phase === 'error' ? t.errT : t.setupT}</h3>
        {state.phase === 'error' ? <>
          <p className="an-muted">{(t.why[state.kind] ? (typeof t.why[state.kind] === 'function' ? t.why[state.kind](state.sa) : t.why[state.kind]) : t.why.other)}</p>
          <p className="an-error" dir="ltr">{state.message}</p>
          {state.keyId && state.kind === 'auth' && <p className="an-muted">{t.keyIdNote(state.keyId, state.sa)}</p>}
          {state.kind === 'quota' && retryIn > 0 && <p className="an-status">{t.retrying(retryIn)}</p>}
          <div><button type="button" className="an-btn" onClick={() => load(true)}>{t.retry}</button></div>
        </> : <>
          <p className="an-muted">{t.setupB}</p>
          <h4>{t.setupKorkos}</h4>
          <ol className="an-steps">{t.stepsKorkos.map(([s, u], i) => <li key={i}>{s} <a href={u} target="_blank" rel="noopener noreferrer">{t.open} ↗</a></li>)}</ol>
          <h4>{t.setupNew}</h4>
          <ol className="an-steps">{t.stepsNew.map(([s, u], i) => <li key={i}>{s} <a href={u} target="_blank" rel="noopener noreferrer">{t.open} ↗</a></li>)}</ol>
        </>}
      </section>
      {settingsBox}
    </>)
  }

  // ── data ──
  const R = state.data.reports, tot = totalsOf(R.totals), prevTot = totalsOf(R.totalsPrev)
  const convMap = (rep, keyOf, mi) => { const m = new Map(); rows(rep).forEach(r => m.set(keyOf(r), r.m[mi] || 0)); return m }
  const withConv = (list, rep, idx, mi, keyOf = r => r.d.join('|')) => { const m = convMap(rep, keyOf, mi); return list.map(r => { const mm = [...r.m]; mm[idx] = m.get(keyOf(r)) || 0; return { ...r, m: mm } }) }
  const byType = rep => Object.fromEntries(rows(rep).map(r => [r.d[0], { count: r.m[0], users: r.m[1], sessions: r.m[2] }]))
  const ct = totalsOf(R.convTotals), ctp = totalsOf(R.convTotalsPrev)
  const cv = { actions: ct[0] || 0, users: ct[1] || 0, sessions: ct[2] || 0, by: byType(R.conv) }, cvPrev = { sessions: ctp[2] || 0, by: byType(R.convPrev) }
  // [users, sessions, views, people who contacted]
  const series = withConv(rows(R.timeseries), R.convTimeseries, 3, 1), prevSeries = withConv(rows(R.timeseriesPrev), R.convTimeseriesPrev, 3, 1)
  const channels = withConv(rows(R.channels), R.convChannels, 4, 2)
  const sources = withConv(rows(R.sources), R.convSources, 3, 2)
  const campaigns = withConv(rows(R.campaigns), R.convCampaigns, 3, 2).filter(c => !['(not set)', '(direct)', '(organic)', '(referral)'].includes(c.d[0]))
  const landing = withConv(rows(R.landing), R.convLanding, 4, 2, r => r.d[0]).map(r => ({ ...r, m: [r.m[0], r.m[1], r.m[2], r.m[3], r.m[4] || 0] }))
  const titleOf = (() => { const pick = rep => { const m = new Map(); rows(rep).forEach(r => { if (!m.has(r.d[0]) && r.d[1] && r.d[1] !== '(not set)') m.set(r.d[0], r.d[1]) }); return m }; const a = pick(R.pageTitles), b = pick(R.pageTitlesAll); return p => a.get(p) || b.get(p) || '' })()
  const pages = withConv(rows(R.pages), R.convPages, 3, 0, r => r.d[0]).map(r => ({ ...r, d: [r.d[0], titleOf(r.d[0])] }))
  const devices = withConv(rows(R.devices), R.convDevices, 3, 2), devTotal = devices.reduce((a, d) => a + d.m[0], 0)
  const countries = withConv(rows(R.countries), R.convCountries, 2, 2), cities = rows(R.cities).filter(c => c.d[0] !== '(not set)')
  const nvr = rows(R.newVsReturning), heat = rows(R.heat)
  const eventsBy = new Map(rows(R.events).map(e => [e.d[0], e]))
  const anomalies = findAnomalies(series, 0)
  const overallCR = tot[2] ? cv.sessions / tot[2] : 0, prevCR = prevTot[2] ? cvPrev.sessions / prevTot[2] : null
  const chTotal = channels.reduce((a, c) => a + c.m[2], 0)
  const rtUsers = rt?.now ? Number(rt.now.totals?.[0]?.metricValues?.[0]?.value) || (rt.now.rows || []).reduce((a, r) => a + (Number(r.metricValues?.[0]?.value) || 0), 0) : null
  const hasData = series.length > 0 || (tot[0] || 0) > 0 || channels.length > 0
  const sortRows = (list, sort, get) => [...list].sort((a, b) => (get(sort.key, b) - get(sort.key, a)) * (sort.desc ? 1 : -1))
  const pagesView = sortRows(pages.filter(p => !pageQ || `${p.d[0]} ${p.d[1]}`.toLowerCase().includes(pageQ.toLowerCase())), pSort, (k, r) => (k === 'time' ? (r.m[1] ? r.m[2] / r.m[1] : 0) : r.m[k]))
  const sourcesView = sortRows(sources.filter(s => !srcQ || `${s.d[0]} ${s.d[1]}`.toLowerCase().includes(srcQ.toLowerCase())), sSort, (k, r) => (k === 'cr' ? (r.m[1] ? r.m[3] / r.m[1] : 0) : r.m[k]))

  // insights — from the data only
  const insights = []
  const du = prevTot[0] ? ((tot[0] - prevTot[0]) / prevTot[0]) * 100 : null
  if (du != null && Math.abs(du) >= 5) insights.push({ tone: du > 0 ? 'good' : 'bad', text: t.ins.traffic(du > 0, Math.abs(du).toFixed(0), fmtNum(prevTot[0]), fmtNum(tot[0])) })
  if (channels.length) {
    insights.push({ tone: 'info', text: t.ins.top(chName(channels[0].d[0]), ((channels[0].m[2] / Math.max(1, tot[2])) * 100).toFixed(0)) })
    const q = channels.find(c => c.m[2] >= 10 && c.m[4] > 1 && c.m[4] / c.m[2] > overallCR * 1.5)
    if (q) insights.push({ tone: 'good', text: t.ins.quality(chName(q.d[0]), (q.m[4] / q.m[2] / Math.max(overallCR, 1e-4)).toFixed(1)) })
  }
  if (campaigns.length) insights.push({ tone: 'info', text: t.ins.camp(campaigns[0].d[0], fmtNum(campaigns[0].m[1])) })
  const mob = devices.find(d => d.d[0] === 'mobile'), desk = devices.find(d => d.d[0] === 'desktop')
  if (mob && desk && devTotal) { const mCR = mob.m[1] ? mob.m[3] / mob.m[1] : 0, dCR = desk.m[1] ? desk.m[3] / desk.m[1] : 0; if (dCR > 0 && mCR < dCR * 0.6 && mob.m[0] / devTotal > 0.4) insights.push({ tone: 'warn', text: t.ins.mobile(Math.round((mob.m[0] / devTotal) * 100), Math.round((1 - mCR / dCR) * 100)) }) }
  const heavy = pages.filter(p => p.m[0] >= Math.max(20, (tot[4] || 0) * 0.04)).map(p => ({ p, avg: p.m[1] ? p.m[2] / p.m[1] : 0 })).sort((a, b) => a.avg - b.avg)[0]
  if (heavy && heavy.avg < 12) insights.push({ tone: 'warn', text: t.ins.lowPage(heavy.p.d[1] || heavy.p.d[0], fmtDur(heavy.avg)) })
  const gaForms = cv.by.contact_form?.count || 0
  if (leadCounts.cur.n >= 5 && leadCounts.cur.n > gaForms * 1.5) insights.push({ tone: 'info', text: t.ins.leadsGap(leadCounts.cur.n, gaForms) })
  anomalies.slice(0, 1).forEach(a => insights.push({ tone: a.z > 0 ? 'info' : 'warn', text: t.ins.anomaly(dLabel(a.r.d[0]), a.z > 0, fmtNum(a.r.m[0])) }))

  const primary = [
    { id: 'users', v: tot[0], p: prevTot[0], sp: series.map(r => r.m[0]) },
    { id: 'sessions', v: tot[2], p: prevTot[2], sp: series.map(r => r.m[1]) },
    { id: 'views', v: tot[4], p: prevTot[4], sp: series.map(r => r.m[2]) },
    { id: 'eng', v: tot[5], p: prevTot[5], fmt: fmtPct },
    { id: 'leads', v: leadCounts.cur.n, p: leadCounts.prev.n },
  ]
  const secondary = [
    ['newUsers', fmtNum(tot[1]), <Delta key="d" cur={tot[1]} prev={prevTot[1]} dim/>],
    ['engaged', fmtNum(tot[3]), <Delta key="d" cur={tot[3]} prev={prevTot[3]} dim/>],
    ['vps', tot[2] ? (tot[4] / tot[2]).toFixed(2) : '—', null],
    ['dur', fmtDur(tot[9]), <Delta key="d" cur={tot[9]} prev={prevTot[9]} dim/>],
    ['bounce', fmtPct(tot[6]), <Delta key="d" cur={tot[6]} prev={prevTot[6]} invert dim/>],
    ['events', fmtNum(tot[7]), null],
    ['cr', fmtPct(overallCR, 2), <Delta key="d" cur={overallCR} prev={prevCR} dim/>],
  ]
  const heatMax = Math.max(1, ...heat.map(h => h.m[0]))
  const heatAt = (d, h) => heat.find(x => Number(x.d[0]) === d && Number(x.d[1]) === h)?.m[0] || 0
  // one hue, light → dark on a light surface; on the dark surface the steps run the other way (low = recessive)
  const darkUi = typeof document !== 'undefined' && document.documentElement.getAttribute('data-admin-theme') === 'dark'
  const RAMP = darkUi ? ['#16304f', '#1d4170', '#24548f', '#2c68ae', '#3a7fcc', '#5b98de', '#8db4e8'] : ['#e8f0fb', '#b9d1f3', '#8db4e8', '#6198dd', '#3d7fd3', '#2667b8', '#1a4d8f']
  const shade = v => (v ? RAMP[Math.min(RAMP.length - 1, 1 + Math.floor((v / heatMax) * (RAMP.length - 1)))] : 'var(--an-empty)')
  const pctTxt = (a, b) => (b ? Math.round((a / b) * 100) : 0)

  const C = t.colTip
  const channelsBox = channels.length > 0 && <section className="an-section">
    <div className="an-sect-head">
      <Lbl tip={t.channelsTip} className="an-h5" as="h4">{t.channels}</Lbl>
      <button type="button" className="an-csv" onClick={() => exportCsv('channels', [t.col.channel, t.col.users, t.col.sessions, t.col.share, t.col.eng, t.col.conv, t.col.cr], channels.map(c => [chName(c.d[0]), c.m[0], c.m[2], fmtPct(chTotal ? c.m[2] / chTotal : 0), fmtPct(c.m[3]), c.m[4], fmtPct(c.m[2] ? c.m[4] / c.m[2] : 0, 2)]))}>{t.csv}</button>
    </div>
    <div className="an-scroll"><table className="an-table">
      <thead><tr><Th num={false} label={t.col.channel} tip={C.channel}/><Th label={t.col.users} tip={C.users}/><Th label={t.col.sessions} tip={C.sessions}/><Th label={t.col.share} tip={C.share}/><Th label={t.col.eng} tip={C.eng}/><Th label={t.col.conv} tip={C.conv}/><Th label={t.col.cr} tip={C.cr}/></tr></thead>
      <tbody>{channels.map(c => { const cr = c.m[2] ? c.m[4] / c.m[2] : 0, q = cr > overallCR * 1.4 && c.m[4] > 1; return (
        <tr key={c.d[0]}>
          <td className="an-td-main">{chName(c.d[0])}<span className="an-share"><i style={{ width: `${chTotal ? (c.m[2] / chTotal) * 100 : 0}%` }}/></span></td>
          <td className="is-num">{fmtNum(c.m[0])}</td><td className="is-num">{fmtNum(c.m[2])}</td><td className="is-num an-dim">{fmtPct(chTotal ? c.m[2] / chTotal : 0, 0)}</td>
          <td className="is-num">{fmtPct(c.m[3], 0)}</td><td className="is-num">{c.m[4] || 0}</td><td className={`is-num ${q ? 'an-quality' : ''}`}>{fmtPct(cr, 2)}{q ? ' ★' : ''}</td>
        </tr>) })}</tbody>
    </table></div>
    <p className="an-footnote">{t.quality(fmtPct(overallCR, 2))}</p>
  </section>

  const campaignsBox = campaigns.length > 0 && <section className="an-section">
    <div className="an-sect-head">
      <Lbl tip={t.campaignsTip} className="an-h5" as="h4">{t.campaigns}</Lbl>
      <button type="button" className="an-csv" onClick={() => exportCsv('campaigns', [t.col.campaign, t.col.users, t.col.sessions, t.col.eng, t.col.conv, t.col.cr], campaigns.map(c => [c.d[0], c.m[0], c.m[1], fmtPct(c.m[2]), c.m[3], fmtPct(c.m[1] ? c.m[3] / c.m[1] : 0, 2)]))}>{t.csv}</button>
    </div>
    <div className="an-scroll"><table className="an-table">
      <thead><tr><Th num={false} label={t.col.campaign} tip={C.campaign}/><Th label={t.col.users} tip={C.users}/><Th label={t.col.sessions} tip={C.sessions}/><Th label={t.col.eng} tip={C.eng}/><Th label={t.col.conv} tip={C.conv}/><Th label={t.col.cr} tip={C.cr}/></tr></thead>
      <tbody>{campaigns.map(c => { const mx = campaigns[0].m[1] || 1; return (
        <tr key={c.d[0]}><td className="an-td-main" dir="auto">{c.d[0]}<span className="an-share"><i style={{ width: `${(c.m[1] / mx) * 100}%` }}/></span></td>
          <td className="is-num">{fmtNum(c.m[0])}</td><td className="is-num">{fmtNum(c.m[1])}</td><td className="is-num">{fmtPct(c.m[2], 0)}</td><td className="is-num">{c.m[3] || 0}</td><td className="is-num">{fmtPct(c.m[1] ? c.m[3] / c.m[1] : 0, 2)}</td></tr>) })}</tbody>
    </table></div>
  </section>

  const sourcesBox = sources.length > 0 && <section className="an-section">
    <div className="an-sect-head">
      <Lbl tip={t.sourcesTip} className="an-h5" as="h4">{t.sources}</Lbl>
      <div className="an-sect-tools">
        <input className="an-search" placeholder={t.search} value={srcQ} onChange={e => setSrcQ(e.target.value)} aria-label={t.sources}/>
        <button type="button" className="an-csv" onClick={() => exportCsv('sources', ['source', 'medium', t.col.users, t.col.sessions, t.col.eng, t.col.conv], sources.map(s => [s.d[0], s.d[1], s.m[0], s.m[1], fmtPct(s.m[2]), s.m[3]]))}>{t.csv}</button>
      </div>
    </div>
    <div className="an-scroll"><table className="an-table">
      <thead><tr><Th num={false} label={t.col.src} tip={C.src}/><Th label={t.col.users} tip={C.users} k={0} sort={sSort} onSort={sToggle}/><Th label={t.col.sessions} tip={C.sessions} k={1} sort={sSort} onSort={sToggle}/><Th label={t.col.eng} tip={C.eng} k={2} sort={sSort} onSort={sToggle}/><Th label={t.col.conv} tip={C.conv} k={3} sort={sSort} onSort={sToggle}/><Th label={t.col.cr} tip={C.cr} k="cr" sort={sSort} onSort={sToggle}/></tr></thead>
      <tbody>{sourcesView.map((s, i) => { const cr = s.m[1] ? s.m[3] / s.m[1] : 0; return (
        <tr key={i}><td className="an-td-main"><bdi dir="ltr">{s.d[0]} <span className="an-dim">/ {s.d[1]}</span></bdi></td>
          <td className="is-num">{fmtNum(s.m[0])}</td><td className="is-num">{fmtNum(s.m[1])}</td><td className="is-num">{fmtPct(s.m[2], 0)}</td><td className="is-num">{s.m[3] || 0}</td><td className={`is-num ${cr > overallCR * 1.4 && s.m[3] > 1 ? 'an-quality' : ''}`}>{fmtPct(cr, 2)}</td></tr>) })}</tbody>
    </table></div>
  </section>

  const landingBox = landing.length > 0 && <section className="an-section">
    <div className="an-sect-head">
      <Lbl tip={t.landingTip} className="an-h5" as="h4">{t.landing}</Lbl>
      <button type="button" className="an-csv" onClick={() => exportCsv('landing', [t.col.landing, t.col.sessions, t.col.users, t.col.eng, t.col.time, t.col.conv], landing.map(l => [l.d[0], l.m[0], l.m[1], fmtPct(l.m[2]), fmtDur(l.m[3]), l.m[4]]))}>{t.csv}</button>
    </div>
    <div className="an-scroll"><table className="an-table">
      <thead><tr><Th num={false} label={t.col.landing} tip={C.landing}/><Th label={t.col.sessions} tip={C.sessions}/><Th label={t.col.users} tip={C.users}/><Th label={t.col.eng} tip={C.eng}/><Th label={t.col.time} tip={C.time}/><Th label={t.col.conv} tip={C.conv}/><Th label={t.col.cr} tip={C.cr}/></tr></thead>
      <tbody>{landing.map(l => { const mx = landing[0].m[0] || 1; return (
        <tr key={l.d[0]}><td className="an-td-main"><span className="an-page-t">{titleOf(l.d[0]) || l.d[0]}</span><span className="an-page-p"><bdi dir="ltr">{l.d[0]}</bdi></span><span className="an-share"><i style={{ width: `${(l.m[0] / mx) * 100}%` }}/></span></td>
          <td className="is-num">{fmtNum(l.m[0])}</td><td className="is-num">{fmtNum(l.m[1])}</td><td className="is-num">{fmtPct(l.m[2], 0)}</td><td className="is-num">{fmtDur(l.m[3])}</td><td className="is-num">{l.m[4] || 0}</td><td className="is-num">{fmtPct(l.m[0] ? (l.m[4] || 0) / l.m[0] : 0, 2)}</td></tr>) })}</tbody>
    </table></div>
  </section>

  const pagesBox = pages.length > 0 && <section className="an-section">
    <div className="an-sect-head">
      <Lbl tip={t.pagesTip} className="an-h5" as="h4">{t.pages}</Lbl>
      <span className="an-sub">{t.pageHint}</span>
      <div className="an-sect-tools">
        <input className="an-search" placeholder={t.search} value={pageQ} onChange={e => setPageQ(e.target.value)} aria-label={t.pages}/>
        <button type="button" className="an-csv" onClick={() => exportCsv('pages', [t.col.page, 'path', t.col.views, t.col.users, t.col.time, t.col.conv], pages.map(p => [p.d[1], p.d[0], p.m[0], p.m[1], fmtDur(p.m[1] ? p.m[2] / p.m[1] : 0), p.m[3]]))}>{t.csv}</button>
      </div>
    </div>
    <div className="an-scroll"><table className="an-table an-table--click">
      <thead><tr><Th num={false} label={t.col.page} tip={C.page}/><Th label={t.col.views} tip={C.views} k={0} sort={pSort} onSort={pToggle}/><Th label={t.col.users} tip={C.users} k={1} sort={pSort} onSort={pToggle}/><Th label={t.col.time} tip={C.time} k="time" sort={pSort} onSort={pToggle}/><Th label={t.col.conv} tip={C.conv} k={3} sort={pSort} onSort={pToggle}/></tr></thead>
      <tbody>{pagesView.map(p => { const open = openPage === p.d[0]; return [
        <tr key={p.d[0]} className={open ? 'is-open' : ''} onClick={() => setOpenPage(open ? null : p.d[0])} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setOpenPage(open ? null : p.d[0]) }} aria-expanded={open}>
          <td className="an-td-main"><span className="an-page-t">{p.d[1] || p.d[0]}</span><span className="an-page-p"><bdi dir="ltr">{p.d[0]}</bdi></span><span className="an-share"><i style={{ width: `${pages[0]?.m[0] ? (p.m[0] / pages[0].m[0]) * 100 : 0}%` }}/></span></td>
          <td className="is-num">{fmtNum(p.m[0])}</td><td className="is-num">{fmtNum(p.m[1])}</td><td className="is-num">{fmtDur(p.m[1] ? p.m[2] / p.m[1] : 0)}</td><td className="is-num">{p.m[3] || 0}</td>
        </tr>,
        open && <tr key={p.d[0] + ':d'} className="an-drill-row"><td colSpan={5}><PageDrill t={t} path={p.d[0]} range={range} call={call} devName={devName}/></td></tr>,
      ] })}</tbody>
    </table></div>
  </section>

  const nw = nvr.find(r => r.d[0] === 'new')?.m[0] || 0, ret = nvr.find(r => r.d[0] === 'returning')?.m[0] || 0, nvrAll = nw + ret || 1
  const devicesBox = <section className="an-section">
    <Lbl tip={t.sectTip.devices} className="an-h5" as="h4">{t.devices}</Lbl>
    <div className="an-bars">{devices.map(d => (
      <div key={d.d[0]} data-tip={`${fmtNum(d.m[0])} ${t.col.users} · ${t.col.cr}: ${fmtPct(d.m[1] ? d.m[3] / d.m[1] : 0, 2)}`}>
        <div className="an-bar__head"><span>{devName(d.d[0])}</span><span><span className="an-dim">{fmtNum(d.m[0])} · </span><b>{pctTxt(d.m[0], devTotal)}%</b></span></div>
        <div className="an-bar__track"><i style={{ width: `${devTotal ? (d.m[0] / devTotal) * 100 : 0}%` }}/></div>
      </div>))}
    </div>
    {nvr.length > 0 && <div style={{ marginTop: 6 }}>
      <Lbl tip={t.sectTip.newRet} className="an-h6">{t.newRet}</Lbl>
      <div className="an-split" role="img" aria-label={`${t.newU} ${nw} · ${t.retU} ${ret}`}>
        <i style={{ width: `${(nw / nvrAll) * 100}%` }} className="a"/><i style={{ width: `${(ret / nvrAll) * 100}%` }} className="b"/>
      </div>
      <div className="an-split__legend"><span><b className="a"/>{t.newU} {fmtNum(nw)} ({pctTxt(nw, nvrAll)}%)</span><span><b className="b"/>{t.retU} {fmtNum(ret)} ({pctTxt(ret, nvrAll)}%)</span></div>
    </div>}
  </section>

  const geoBox = <section className="an-section">
    <Lbl tip={t.sectTip.geo} className="an-h5" as="h4">{t.geo}</Lbl>
    <div className="an-geo">
      <div>{countries.slice(0, 8).map(c => <div key={c.d[0]} className="an-row"><span>{c.d[0]}</span><span><span className="an-dim">{c.m[2] ? `${c.m[2]} ${t.col.conv} · ` : ''}</span><b>{fmtNum(c.m[0])}</b></span></div>)}</div>
      <div>{cities.slice(0, 8).map(c => <div key={c.d[0]} className="an-row"><span>{c.d[0]}</span><b>{fmtNum(c.m[0])}</b></div>)}</div>
    </div>
  </section>

  const heatBox = heat.length > 0 && <section className="an-section">
    <div className="an-sect-head"><Lbl tip={t.sectTip.heat} className="an-h5" as="h4">{t.heat}</Lbl><span className="an-sub">{t.heatSub}</span></div>
    <div className="an-scroll"><div className="an-heat" dir="ltr">
      <span/>{Array.from({ length: 24 }, (_, h) => <span key={h} className="an-heat__h">{h % 3 === 0 ? h : ''}</span>)}
      {[0, 1, 2, 3, 4, 5, 6].map(d => [
        <span key={'l' + d} className="an-heat__d" dir="auto">{t.dow[d]}</span>,
        ...Array.from({ length: 24 }, (_, h) => { const v = heatAt(d, h); return <i key={d + ':' + h} data-tip={`${t.dow[d]} · ${String(h).padStart(2, '0')}:00 · ${fmtNum(v)} ${t.col.sessions}`} style={{ background: shade(v) }}/> }),
      ])}
    </div></div>
    <div className="an-heat__legend"><span>{t.less}</span>{RAMP.map(c => <i key={c} style={{ background: c }}/>)}<span>{t.more}</span></div>
  </section>

  const actionsBox = <section className="an-section">
    <div className="an-sect-head">
      <Lbl tip={t.actionsTip} className="an-h5" as="h4">{t.actions}</Lbl>
      <button type="button" className="an-csv" onClick={() => exportCsv('actions', [t.col.action, t.col.count, t.col.people], Object.entries(t.ev).map(([ev, [label]]) => { const e = eventsBy.get(ev); return [label, e ? e.m[0] : 0, e ? e.m[1] : 0] }))}>{t.csv}</button>
    </div>
    <div className="an-scroll"><table className="an-table">
      <thead><tr><Th num={false} label={t.col.action} tip={C.action}/><Th label={t.col.count} tip={C.count}/><Th label={t.col.people} tip={C.people}/></tr></thead>
      <tbody>{Object.entries(t.ev).map(([ev, [label, hint]]) => { const e = eventsBy.get(ev); return <tr key={ev}><td className="an-td-main">{label}{hint && <span className="an-dim an-ev-hint">{hint}</span>}</td><td className="is-num">{fmtNum(e ? e.m[0] : 0)}</td><td className="is-num">{fmtNum(e ? e.m[1] : 0)}</td></tr> })}</tbody>
    </table></div>
  </section>

  return shell(<>
    <header className="an-top">
      <div>
        <h3 className="an-title">{t.title}</h3>
        <span className="an-sub"><bdi dir="ltr">{range.start} → {range.end}</bdi> · {t.vsPrev} · {t.src}</span>
      </div>
      <div className="an-top__side">
        <span className="an-live" data-tip={t.sectTip.live}><span className="an-dot"/><b>{rtUsers == null ? '· · ·' : rtUsers}</b> {t.last30}</span>
        <div className="an-seg" role="radiogroup">{Object.keys(t.presets).map(id => <button key={id} type="button" role="radio" aria-checked={preset === id} className={preset === id ? 'is-on' : ''} onClick={() => setPreset(id)}>{t.presets[id]}</button>)}</div>
        <button type="button" className="an-csv" onClick={() => load(true)} disabled={state.refreshing}>{state.refreshing ? '…' : `↻ ${t.refresh}`}</button>
        <a className="an-csv" href={GA_URL(state.data.property)} target="_blank" rel="noopener noreferrer">{t.openGa} ↗</a>
      </div>
    </header>

    {state.data.stale && <p className="an-anom-note">{t.stale(new Date(state.data.generatedAt).toLocaleTimeString(en ? 'en-GB' : 'he-IL', { hour: '2-digit', minute: '2-digit' }))}</p>}
    <LivePanel t={t} rt={rt} users={rtUsers} chName={chName} devName={devName}/>

    {!hasData && <section className="an-await"><span className="an-await__badge">{t.await}</span><h4>{t.awaitT}</h4><p>{t.awaitB}</p></section>}

    {hasData && <>
      <div className="an-kpis">
        <section className="an-metrics">
          {primary.map(m => (
            <div key={m.id} className="an-metric">
              <Lbl tip={t.tips[m.id]} className="an-metric__label">{t.k[m.id]}</Lbl>
              <span className="an-metric__value">{(m.fmt || fmtNum)(m.v)}</span>
              <span className="an-metric__foot"><Delta cur={m.v} prev={m.p}/>{m.sp && <Spark values={m.sp}/>}</span>
            </div>
          ))}
        </section>
        <section className="an-secondary">{secondary.map(([id, v, d]) => <div key={id} className="an-secondary__item"><Lbl tip={t.tips[id]}>{t.k[id]}</Lbl><span className="an-secondary__val">{v}{d}</span></div>)}</section>
      </div>

      <section className="an-section">
        <div className="an-sect-head"><Lbl tip={t.sectTip.conv} className="an-h5" as="h4">{t.conv}</Lbl><span className="an-sub">{t.convSub}</span></div>
        <div className="an-conv__grid">
          <div className="an-conv__cell an-conv__cell--big">
            <Lbl tip={t.sectTip.convBig} className="an-metric__label">{t.convBig}</Lbl>
            <span className="an-conv__value">{fmtNum(leadCounts.cur.n)} <Delta cur={leadCounts.cur.n} prev={leadCounts.prev.n}/></span>
            <span className="an-metric__sub">{t.convBigSub(leadCounts.cur.site, leadCounts.cur.meta)}</span>
          </div>
          {Object.entries(t.convTypes).map(([ev, [label, hint]]) => {
            const c = cv.by[ev] || { count: 0, users: 0 }, pc = cvPrev.by[ev] || { count: 0 }
            return (
              <div key={ev} className="an-conv__cell">
                <Lbl tip={hint} className="an-metric__label">{label}</Lbl>
                <span className="an-conv__value">{fmtNum(c.count)} <Delta cur={c.count} prev={pc.count} dim/></span>
                <span className="an-metric__sub">{t.people(c.users)}</span>
              </div>
            )
          })}
        </div>
        <p className="an-footnote">{t.convExplain} {t.convNote}</p>
      </section>

      <div className={insights.length ? 'an-cols an-cols--chart' : ''}>
        <section className="an-section"><HeroChart t={t} series={series} prevSeries={prevSeries}/></section>
        {insights.length > 0 && <section className="an-section"><Lbl tip={t.sectTip.insights} className="an-h5" as="h4">{t.insights}</Lbl><ul className="an-insights">{insights.map((x, i) => <li key={i} className={`is-${x.tone}`}>{x.text}</li>)}</ul></section>}
      </div>

      {(channelsBox || campaignsBox) && <div className={channelsBox && campaignsBox ? 'an-cols' : ''}>{channelsBox}{campaignsBox}</div>}
      {(sourcesBox || landingBox) && <div className={sourcesBox && landingBox ? 'an-cols' : ''}>{sourcesBox}{landingBox}</div>}
      <div className={pagesBox ? 'an-cols an-cols--chart' : ''}>{pagesBox}{actionsBox}</div>
      <div className={heatBox ? 'an-cols an-cols--dgh' : 'an-cols'}>{devicesBox}{geoBox}{heatBox}</div>
    </>}

    {settingsBox}
  </>)
}
