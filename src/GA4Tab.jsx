// Google Analytics 4 — the site-traffic dashboard (admin → אנליטיקס → Google Analytics), built like the Korkos site's:
// live panel, KPIs vs the previous period, contacts (CRM leads + form / phone / WhatsApp / email clicks), the main chart
// (metric, day / week / month, previous period, anomalies), insights, channels, UTM campaigns, source / medium, landing
// pages, pages with a drill-down, devices, geography, a weekday × hour heat map and site actions.
// Data: POST /api/meta/ga4-dash (lib/ga4.js dash) — real GA4 data only, never demo numbers.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

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
    selfEx: 'אל תספור את הביקורים שלי', selfExTip: 'מסמן את הדפדפן הזה כ״אל תספור״: הביקורים שלך באתר לא ייכנסו ל-Google Analytics ולפיקסל, כך שהמספרים משקפים גולשים אמיתיים. נשמר בדפדפן הזה בלבד.',
    k: { users: 'משתמשים', sessions: 'ביקורים', views: 'צפיות עמוד', eng: 'שיעור מעורבות', leads: 'לידים במערכת', newUsers: 'משתמשים חדשים', engaged: 'ביקורים מעורבים', vps: 'צפיות לביקור', dur: 'משך ביקור ממוצע', bounce: 'שיעור נטישה', events: 'אירועים', cr: 'שיעור פנייה' },
    tips: {
      users: 'כמה אנשים שונים ביקרו באתר בתקופה. כל אדם נספר פעם אחת גם אם חזר כמה פעמים.',
      sessions: 'כמה כניסות היו לאתר בסך הכול. אדם שנכנס פעמיים נספר כשני ביקורים.',
      views: 'כמה עמודים נצפו בסך הכול. מספר גבוה ביחס לביקורים אומר שגולשים ממשיכים לדפדף.',
      eng: 'אחוז הביקורים שבהם הגולש באמת התעניין: שהה באתר, צפה בכמה עמודים או ביצע פעולה.',
      leads: 'כמה לידים נכנסו ללוח הלידים בתקופה (אתר + פייסבוק/אינסטגרם). נספר מהמערכת שלנו ולא מגוגל, ולכן זה המספר הקובע.',
      newUsers: 'כמה מהמבקרים הגיעו לאתר בפעם הראשונה.', engaged: 'ביקורים שבהם הגולש התעניין ולא יצא מיד.', vps: 'כמה עמודים רואה גולש ממוצע בכל ביקור.',
      dur: 'כמה זמן שוהה גולש ממוצע באתר בביקור אחד.', bounce: 'אחוז הביקורים שהסתיימו בלי שום התעניינות. נמוך = טוב.', events: 'סך כל הפעולות שנמדדו: לחיצות, גלילות, צפיות ופניות.',
      cr: 'מתוך כל הביקורים, כמה אחוז כללו טופס או לחיצה על טלפון, וואטסאפ או מייל. ביקור עם שתי פעולות נספר פעם אחת.',
    },
    conv: 'פניות', convSub: 'מה שהתנועה באמת מייצרת', convBig: 'לידים שנכנסו למערכת בתקופה', convBigSub: (s, m) => `${s} מהאתר · ${m} מפייסבוק / אינסטגרם · לידים שהוזנו ידנית לא נספרים. זה המספר הקובע.`,
    convExplain: 'מתחת: טפסים ולחיצות על טלפון, וואטסאפ ומייל, כפי שגוגל מדד אותם באתר. לחיצה היא לא שיחה: גוגל לא יודע אם השיחה יצאה. אדם שלחץ פעמיים נספר פעמיים ב"פעולות" ופעם אחת ב"אנשים".',
    convNote: 'לידים מטופס של פייסבוק/אינסטגרם לא עוברים באתר, ולכן הם נספרים במספר הגדול ולא בטפסים של גוגל. חוסמי פרסומות לא נספרים בגוגל, אבל הטופס שלהם נשמר.',
    convTypes: { contact_form: ['טפסים שנשלחו', 'שליחת טופס פנייה באתר (חלון הפנייה ועמודי התוכן)'], phone_click: ['לחיצות טלפון', 'לחיצה על מספר הטלפון'], whatsapp_click: ['לחיצות וואטסאפ', 'כולל הכפתור הצף'], email_click: ['לחיצות מייל', 'לחיצה על כתובת המייל'] },
    people: n => `${n} ${n === 1 ? 'אדם' : 'אנשים'}`,
    metrics: { users: 'משתמשים', sessions: 'ביקורים', views: 'צפיות', conv: 'אנשים שפנו' }, prevPeriod: 'תקופה קודמת', gran: { day: 'יומי', week: 'שבועי', month: 'חודשי' },
    anomalies: (n, list) => `זוהו ${n} ימים חריגים: ${list}`, spike: 'קפיצה', drop: 'ירידה',
    insights: 'תובנות', channels: 'מקורות תנועה', channelsTip: 'מאיפה הגולשים מגיעים: חיפוש בגוגל, כניסה ישירה, רשתות חברתיות, פרסום ממומן או קישורים מאתרים אחרים.',
    campaigns: 'קמפיינים (UTM)', campaignsTip: 'הקמפיינים לפי utm_campaign: מודעות פייסבוק/אינסטגרם, קישורי שיתוף לנכסים (prop-…) וכל קישור מתויג.',
    sources: 'מקור / מדיום', sourcesTip: 'פירוט מדויק של מקורות התנועה, למשל google / organic או facebook / paid.',
    landing: 'דפי נחיתה', landingTip: 'העמוד הראשון שבו נכנסו לאתר. כאן רואים איזה עמוד "פותח" את הביקור ומה הוא מייצר.',
    pages: 'עמודים', pagesTip: 'העמודים הנצפים ביותר. לחיצה על עמוד פותחת פירוט: מגמה, מקורות ומכשירים.', pageHint: 'לחיצה על עמוד פותחת פירוט: מגמה, מקורות ומכשירים של אותו עמוד',
    devices: 'מכשירים', newRet: 'חדשים מול חוזרים', newU: 'חדשים', retU: 'חוזרים', geo: 'מדינות וערים', heat: 'מתי מבקרים באתר', heatSub: 'ביקורים לפי יום ושעה (שעון ישראל)',
    actions: 'פעולות באתר', actionsTip: 'רק פעולות שיש להן משמעות לעסק, כפי שהאתר עצמו מדווח.',
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
    why: { permission: sa => `חשבון השירות${sa ? ` ${sa}` : ''} עדיין לא קיבל גישה לנכס. ב-Analytics ← Admin ← Property access management הוסיפו אותו כ-Viewer.`, api: 'ה-Analytics Data API לא מופעל בפרויקט של חשבון השירות.', auth: 'המפתח של חשבון השירות לא תקין או בוטל.', property: 'מזהה הנכס שגוי (מספר, לא G-XXXX).', other: 'נסו שוב בעוד רגע.' },
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
    selfEx: 'Don’t count my visits', selfExTip: 'Marks this browser as “don’t count”: your own visits stay out of Google Analytics and the Pixel, so the numbers reflect real visitors. Saved in this browser only.',
    k: { users: 'Users', sessions: 'Sessions', views: 'Page views', eng: 'Engagement rate', leads: 'Leads in the CRM', newUsers: 'New users', engaged: 'Engaged sessions', vps: 'Views per session', dur: 'Avg. session duration', bounce: 'Bounce rate', events: 'Events', cr: 'Contact rate' },
    tips: {
      users: 'How many different people visited in the period. Each person counts once.', sessions: 'How many visits in total. Someone who came twice counts as two sessions.',
      views: 'How many pages were viewed in total.', eng: 'The share of sessions where the visitor was really interested: stayed, viewed several pages or took an action.',
      leads: 'How many leads entered the leads board in the period (website + Facebook/Instagram). Counted by our system, not by Google — this is the number that matters.',
      newUsers: 'Visitors who came for the first time.', engaged: 'Sessions where the visitor didn’t leave right away.', vps: 'Pages an average visitor sees per session.',
      dur: 'How long an average session lasts.', bounce: 'Sessions that ended without any engagement. Lower is better.', events: 'Every measured action: clicks, scrolls, views and contacts.',
      cr: 'The share of sessions with a form or a phone / WhatsApp / email click. A session with two actions counts once.',
    },
    conv: 'Contacts', convSub: 'What the traffic actually produces', convBig: 'Leads that entered the CRM in the period', convBigSub: (s, m) => `${s} from the website · ${m} from Facebook / Instagram · manual leads are not counted. This is the number that matters.`,
    convExplain: 'Below: forms and phone, WhatsApp and email clicks as Google measured them on the site. A click is not a call: Google can’t know whether the call happened. Someone who clicked twice counts twice as actions and once as people.',
    convNote: 'Facebook / Instagram form leads never pass through the site, so they are in the big number and not in Google’s forms. Ad blockers aren’t counted by Google, but their forms are saved.',
    convTypes: { contact_form: ['Forms sent', 'A contact form sent on the site (the contact window and the content pages)'], phone_click: ['Phone clicks', 'A click on the phone number'], whatsapp_click: ['WhatsApp clicks', 'Including the floating button'], email_click: ['Email clicks', 'A click on the email address'] },
    people: n => `${n} ${n === 1 ? 'person' : 'people'}`,
    metrics: { users: 'Users', sessions: 'Sessions', views: 'Views', conv: 'People who contacted' }, prevPeriod: 'Previous period', gran: { day: 'Daily', week: 'Weekly', month: 'Monthly' },
    anomalies: (n, list) => `${n} unusual days: ${list}`, spike: 'spike', drop: 'drop',
    insights: 'Insights', channels: 'Traffic channels', channelsTip: 'Where visitors come from: Google search, direct, social networks, paid ads or other sites.',
    campaigns: 'Campaigns (UTM)', campaignsTip: 'By utm_campaign: Facebook / Instagram ads, property share links (prop-…) and any tagged link.',
    sources: 'Source / medium', sourcesTip: 'The exact traffic sources, e.g. google / organic or facebook / paid.',
    landing: 'Landing pages', landingTip: 'The first page of the visit: which page opens sessions and what it produces.',
    pages: 'Pages', pagesTip: 'The most viewed pages. Click a page for its trend, sources and devices.', pageHint: 'Click a page for its trend, sources and devices',
    devices: 'Devices', newRet: 'New vs returning', newU: 'New', retU: 'Returning', geo: 'Countries and cities', heat: 'When people visit', heatSub: 'Sessions by weekday and hour (Israel time)',
    actions: 'Site actions', actionsTip: 'Only actions that matter to the business, as reported by the site itself.',
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
    why: { permission: sa => `The service account${sa ? ` ${sa}` : ''} has no access to the property yet. In Analytics → Admin → Property access management, add it as a Viewer.`, api: 'The Analytics Data API is not enabled in the service account’s project.', auth: 'The service account key is invalid or was revoked.', property: 'The property id is wrong (a number, not G-XXXX).', other: 'Try again in a moment.' },
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
const Th = ({ label, k, sort, onSort }) => <th className="is-num" onClick={() => onSort(k)} role="button" aria-sort={sort.key === k ? (sort.desc ? 'descending' : 'ascending') : 'none'}>{label}{sort.key === k ? (sort.desc ? ' ↓' : ' ↑') : ''}</th>

// ── the main chart ──────────────────────────────────────────────────────────────
function HeroChart({ t, series, prevSeries }) {
  const [metric, setMetric] = useState(0)
  const [gran, setGran] = useState('day')
  const [compare, setCompare] = useState(true)
  const [hover, setHover] = useState(null)
  const wrapRef = useRef(null)
  const cur = useMemo(() => bucket(series, gran), [series, gran])
  const prev = useMemo(() => bucket(prevSeries, gran), [prevSeries, gran])
  const anomalies = useMemo(() => (gran === 'day' ? findAnomalies(cur, metric) : []), [cur, metric, gran])
  if (!cur.length) return <p className="an-empty">{t.noData}</p>
  const W = 960, H = 300, PL = 46, PB = 26, PT = 14, PR = 10, n = cur.length
  const max = Math.max(1, ...cur.map(r => r.m[metric]), ...(compare ? prev.map(r => r.m[metric]) : [0]))
  const x = (i, len = n) => PL + (len < 2 ? (W - PL - PR) / 2 : (i / (len - 1)) * (W - PL - PR))
  const y = v => PT + (1 - v / max) * (H - PT - PB)
  const line = list => list.map((r, i) => `${i ? 'L' : 'M'}${x(i, list.length).toFixed(1)},${y(r.m[metric]).toFixed(1)}`).join('')
  const area = `${line(cur)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`
  const ticks = cur.length > 12 ? cur.filter((_, i) => i % Math.ceil(cur.length / 9) === 0) : cur
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
        <div className="an-seg" role="radiogroup">{MET.map(([id, i]) => <button key={id} type="button" role="radio" aria-checked={metric === i} className={metric === i ? 'is-on' : ''} onClick={() => setMetric(i)}>{t.metrics[id]}</button>)}</div>
        <div className="an-hero__bar-side">
          <label className="an-check"><input type="checkbox" checked={compare} onChange={() => setCompare(!compare)}/> {t.prevPeriod}</label>
          <div className="an-seg an-seg--sm" role="radiogroup">{['day', 'week', 'month'].map(g => <button key={g} type="button" role="radio" aria-checked={gran === g} className={gran === g ? 'is-on' : ''} onClick={() => { setGran(g); setHover(null) }}>{t.gran[g]}</button>)}</div>
        </div>
      </div>
      <div className="an-hero__plot" ref={wrapRef} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" dir="ltr" role="img" aria-label={t.metrics[MET[metric][0]]}>
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
      {anomalies.length > 0 && <p className="an-anom-note">{t.anomalies(anomalies.length, anomalies.map(a => `${dLabel(a.r.d[0])} (${a.z > 0 ? t.spike : t.drop} — ${fmtNum(a.r.m[metric])})`).join(' · '))}</p>}
    </div>
  )
}

// ── live panel ──────────────────────────────────────────────────────────────────
function SelfExclude({ t }) {
  const [off, setOff] = useState(() => { try { return localStorage.getItem(NO_TRACK_KEY) === '1' } catch { return false } })
  return (
    <label className="an-selfex" data-tip={t.selfExTip}>
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
        <div><h3>{t.live}</h3><span className="an-sub">{t.liveSub}</span></div>
        <SelfExclude t={t}/>
      </div>
      <div className="an-live-panel__grid">
        <div className="an-live-now">
          <span className="an-live-now__num">{users == null ? '· · ·' : users}</span>
          <span className="an-live-now__lbl">{t.liveUsers}</span>
          <div className="an-live-spark" aria-hidden>{buckets.map((v, i) => <i key={i} style={{ height: `${Math.max(3, (v / peak) * 100)}%` }} className={v ? '' : 'is-empty'}/>)}</div>
          <span className="an-live-now__foot">{t.liveViews(halfHour)}</span>
          {devs.length > 0 && <span className="an-live-now__foot">{t.liveDevices}: {devs.map(d => `${devName(d.d[0])} ${d.m[0]}`).join(' · ')}</span>}
        </div>
        <div className="an-live-list">
          <h4>{t.livePages}</h4>
          {pages.length ? <ul>{pages.map(r => <li key={r.d[0]}><span className="an-live-list__name" title={r.d[0]}>{r.d[0] || '—'}</span><b>{r.m[0]}</b></li>)}</ul> : <p className="an-empty an-empty--sm">{t.liveNone}</p>}
          <p className="an-live-note">{t.liveTitlesNote}</p>
        </div>
        <div className="an-live-list">
          <h4>{t.liveFrom} <span className="an-live-badge">{t.today}</span></h4>
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
    if (!r.ok) { const e = new Error(d.error || `HTTP ${r.status}`); e.kind = d.kind; e.sa = d.serviceAccount; throw e }
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
      .catch(e => setState({ phase: 'error', message: e.message, kind: e.kind, sa: e.sa }))
  }, [call, range.start, range.end])
  useEffect(() => { load() }, [load])
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

  const shell = children => <div className="an" dir={en ? 'ltr' : 'rtl'}><style>{AN_CSS}</style>{children}</div>
  if (state.phase === 'loading') return shell(<div className="an-skeleton">{t.loading}</div>)
  if (state.phase === 'setup' || state.phase === 'error') {
    return shell(<>
      <section className="an-setup">
        <h3>{state.phase === 'error' ? t.errT : t.setupT}</h3>
        {state.phase === 'error' ? <>
          <p className="an-muted">{(t.why[state.kind] ? (typeof t.why[state.kind] === 'function' ? t.why[state.kind](state.sa) : t.why[state.kind]) : t.why.other)}</p>
          <p className="an-error" dir="ltr">{state.message}</p>
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
  const RAMP = ['#e8f0fb', '#b9d1f3', '#8db4e8', '#6198dd', '#3d7fd3', '#2667b8', '#1a4d8f']
  const shade = v => (v ? RAMP[Math.min(RAMP.length - 1, 1 + Math.floor((v / heatMax) * (RAMP.length - 1)))] : 'var(--an-empty)')
  const pctTxt = (a, b) => (b ? Math.round((a / b) * 100) : 0)

  return shell(<>
    <header className="an-top">
      <div>
        <h3 className="an-title">{t.title}</h3>
        <span className="an-sub" dir="ltr">{range.start} → {range.end}</span>
        <span className="an-sub"> · {t.vsPrev} · {t.src}</span>
      </div>
      <div className="an-top__side">
        <span className="an-live">{rtUsers == null ? '· · ·' : rtUsers} {t.last30}<i/></span>
        <div className="an-seg" role="radiogroup">{Object.keys(t.presets).map(id => <button key={id} type="button" role="radio" aria-checked={preset === id} className={preset === id ? 'is-on' : ''} onClick={() => setPreset(id)}>{t.presets[id]}</button>)}</div>
        <button type="button" className="an-csv" onClick={() => load(true)} disabled={state.refreshing}>{state.refreshing ? '…' : `↻ ${t.refresh}`}</button>
        <a className="an-csv" href={GA_URL(state.data.property)} target="_blank" rel="noopener noreferrer">{t.openGa} ↗</a>
      </div>
    </header>

    <LivePanel t={t} rt={rt} users={rtUsers} chName={chName} devName={devName}/>

    {!hasData && <section className="an-await"><span className="an-await__badge">{t.await}</span><h4>{t.awaitT}</h4><p>{t.awaitB}</p></section>}

    {hasData && <>
      <section className="an-metrics">
        {primary.map(m => (
          <div key={m.id} className="an-metric" data-tip={t.tips[m.id]} tabIndex={0}>
            <span className="an-metric__label">{t.k[m.id]}</span>
            <span className="an-metric__value">{(m.fmt || fmtNum)(m.v)}</span>
            <span className="an-metric__foot"><Delta cur={m.v} prev={m.p}/>{m.sp && <Spark values={m.sp}/>}</span>
          </div>
        ))}
      </section>
      <section className="an-secondary">{secondary.map(([id, v, d]) => <span key={id} className="an-secondary__item" data-tip={t.tips[id]} tabIndex={0}><i>{t.k[id]}</i><b>{v}</b>{d}</span>)}</section>

      <section className="an-section an-conv">
        <div className="an-sect-head"><h4 className="an-h5">{t.conv}</h4><span className="an-sub">{t.convSub}</span></div>
        <div className="an-conv__head">
          <div className="an-conv__big">
            <span className="an-conv__big-label">{t.convBig}</span>
            <span className="an-conv__big-value">{fmtNum(leadCounts.cur.n)} <Delta cur={leadCounts.cur.n} prev={leadCounts.prev.n}/></span>
            <span className="an-conv__big-sub">{t.convBigSub(leadCounts.cur.site, leadCounts.cur.meta)}</span>
          </div>
          <p className="an-conv__explain">{t.convExplain}</p>
        </div>
        <div className="an-conv__tiles">
          {Object.entries(t.convTypes).map(([ev, [label, hint]]) => {
            const c = cv.by[ev] || { count: 0, users: 0 }, pc = cvPrev.by[ev] || { count: 0 }
            return (
              <div key={ev} className="an-conv__tile" data-tip={hint} tabIndex={0}>
                <span className="an-conv__tile-label"><i/>{label}</span>
                <span className="an-conv__tile-value">{fmtNum(c.count)} <Delta cur={c.count} prev={pc.count} dim/></span>
                <span className="an-conv__tile-sub">{t.people(c.users)}</span>
              </div>
            )
          })}
        </div>
        <p className="an-conv__note">{t.convNote}</p>
      </section>

      <section className="an-section"><HeroChart t={t} series={series} prevSeries={prevSeries}/></section>

      {insights.length > 0 && <section className="an-section"><h4 className="an-h5">{t.insights}</h4><ul className="an-insights">{insights.map((x, i) => <li key={i} className={`is-${x.tone}`}>{x.text}</li>)}</ul></section>}

      {channels.length > 0 && <section className="an-section">
        <div className="an-sect-head">
          <h4 className="an-h5" data-tip={t.channelsTip} tabIndex={0}>{t.channels}</h4>
          <button type="button" className="an-csv" onClick={() => exportCsv('channels', [t.col.channel, t.col.users, t.col.sessions, t.col.share, t.col.eng, t.col.conv, t.col.cr], channels.map(c => [chName(c.d[0]), c.m[0], c.m[2], fmtPct(chTotal ? c.m[2] / chTotal : 0), fmtPct(c.m[3]), c.m[4], fmtPct(c.m[2] ? c.m[4] / c.m[2] : 0, 2)]))}>{t.csv}</button>
        </div>
        <div className="an-scroll"><table className="an-table">
          <thead><tr><th>{t.col.channel}</th><th className="is-num">{t.col.users}</th><th className="is-num">{t.col.sessions}</th><th className="is-num">{t.col.share}</th><th className="is-num">{t.col.eng}</th><th className="is-num">{t.col.conv}</th><th className="is-num">{t.col.cr}</th></tr></thead>
          <tbody>{channels.map(c => { const cr = c.m[2] ? c.m[4] / c.m[2] : 0, q = cr > overallCR * 1.4 && c.m[4] > 1; return (
            <tr key={c.d[0]}>
              <td className="an-td-main">{chName(c.d[0])}<span className="an-share"><i style={{ width: `${chTotal ? (c.m[2] / chTotal) * 100 : 0}%` }}/></span></td>
              <td className="is-num">{fmtNum(c.m[0])}</td><td className="is-num">{fmtNum(c.m[2])}</td><td className="is-num an-dim">{fmtPct(chTotal ? c.m[2] / chTotal : 0, 0)}</td>
              <td className="is-num">{fmtPct(c.m[3], 0)}</td><td className="is-num">{c.m[4] || 0}</td><td className={`is-num ${q ? 'an-quality' : ''}`}>{fmtPct(cr, 2)}{q ? ' ★' : ''}</td>
            </tr>) })}</tbody>
        </table></div>
        <p className="an-footnote">{t.quality(fmtPct(overallCR, 2))}</p>
      </section>}

      {campaigns.length > 0 && <section className="an-section">
        <div className="an-sect-head">
          <h4 className="an-h5" data-tip={t.campaignsTip} tabIndex={0}>{t.campaigns}</h4>
          <button type="button" className="an-csv" onClick={() => exportCsv('campaigns', [t.col.campaign, t.col.users, t.col.sessions, t.col.eng, t.col.conv, t.col.cr], campaigns.map(c => [c.d[0], c.m[0], c.m[1], fmtPct(c.m[2]), c.m[3], fmtPct(c.m[1] ? c.m[3] / c.m[1] : 0, 2)]))}>{t.csv}</button>
        </div>
        <div className="an-scroll"><table className="an-table">
          <thead><tr><th>{t.col.campaign}</th><th className="is-num">{t.col.users}</th><th className="is-num">{t.col.sessions}</th><th className="is-num">{t.col.eng}</th><th className="is-num">{t.col.conv}</th><th className="is-num">{t.col.cr}</th></tr></thead>
          <tbody>{campaigns.map(c => { const mx = campaigns[0].m[1] || 1; return (
            <tr key={c.d[0]}><td className="an-td-main" dir="auto">{c.d[0]}<span className="an-share"><i style={{ width: `${(c.m[1] / mx) * 100}%` }}/></span></td>
              <td className="is-num">{fmtNum(c.m[0])}</td><td className="is-num">{fmtNum(c.m[1])}</td><td className="is-num">{fmtPct(c.m[2], 0)}</td><td className="is-num">{c.m[3] || 0}</td><td className="is-num">{fmtPct(c.m[1] ? c.m[3] / c.m[1] : 0, 2)}</td></tr>) })}</tbody>
        </table></div>
      </section>}

      {sources.length > 0 && <section className="an-section">
        <div className="an-sect-head">
          <h4 className="an-h5" data-tip={t.sourcesTip} tabIndex={0}>{t.sources}</h4>
          <div className="an-sect-tools">
            <input className="an-search" placeholder={t.search} value={srcQ} onChange={e => setSrcQ(e.target.value)} aria-label={t.sources}/>
            <button type="button" className="an-csv" onClick={() => exportCsv('sources', ['source', 'medium', t.col.users, t.col.sessions, t.col.eng, t.col.conv], sources.map(s => [s.d[0], s.d[1], s.m[0], s.m[1], fmtPct(s.m[2]), s.m[3]]))}>{t.csv}</button>
          </div>
        </div>
        <div className="an-scroll"><table className="an-table">
          <thead><tr><th>{t.col.src}</th><Th label={t.col.users} k={0} sort={sSort} onSort={sToggle}/><Th label={t.col.sessions} k={1} sort={sSort} onSort={sToggle}/><Th label={t.col.eng} k={2} sort={sSort} onSort={sToggle}/><Th label={t.col.conv} k={3} sort={sSort} onSort={sToggle}/><Th label={t.col.cr} k="cr" sort={sSort} onSort={sToggle}/></tr></thead>
          <tbody>{sourcesView.map((s, i) => { const cr = s.m[1] ? s.m[3] / s.m[1] : 0; return (
            <tr key={i}><td className="an-td-main" dir="ltr" style={{ textAlign: en ? 'left' : 'right' }}>{s.d[0]} <span className="an-dim">/ {s.d[1]}</span></td>
              <td className="is-num">{fmtNum(s.m[0])}</td><td className="is-num">{fmtNum(s.m[1])}</td><td className="is-num">{fmtPct(s.m[2], 0)}</td><td className="is-num">{s.m[3] || 0}</td><td className={`is-num ${cr > overallCR * 1.4 && s.m[3] > 1 ? 'an-quality' : ''}`}>{fmtPct(cr, 2)}</td></tr>) })}</tbody>
        </table></div>
      </section>}

      {landing.length > 0 && <section className="an-section">
        <div className="an-sect-head">
          <h4 className="an-h5" data-tip={t.landingTip} tabIndex={0}>{t.landing}</h4>
          <button type="button" className="an-csv" onClick={() => exportCsv('landing', [t.col.landing, t.col.sessions, t.col.users, t.col.eng, t.col.time, t.col.conv], landing.map(l => [l.d[0], l.m[0], l.m[1], fmtPct(l.m[2]), fmtDur(l.m[3]), l.m[4]]))}>{t.csv}</button>
        </div>
        <div className="an-scroll"><table className="an-table">
          <thead><tr><th>{t.col.landing}</th><th className="is-num">{t.col.sessions}</th><th className="is-num">{t.col.users}</th><th className="is-num">{t.col.eng}</th><th className="is-num">{t.col.time}</th><th className="is-num">{t.col.conv}</th><th className="is-num">{t.col.cr}</th></tr></thead>
          <tbody>{landing.map(l => { const mx = landing[0].m[0] || 1; return (
            <tr key={l.d[0]}><td className="an-td-main"><span className="an-page-t">{titleOf(l.d[0]) || l.d[0]}</span><span className="an-page-p"><bdi dir="ltr">{l.d[0]}</bdi></span><span className="an-share"><i style={{ width: `${(l.m[0] / mx) * 100}%` }}/></span></td>
              <td className="is-num">{fmtNum(l.m[0])}</td><td className="is-num">{fmtNum(l.m[1])}</td><td className="is-num">{fmtPct(l.m[2], 0)}</td><td className="is-num">{fmtDur(l.m[3])}</td><td className="is-num">{l.m[4] || 0}</td><td className="is-num">{fmtPct(l.m[0] ? (l.m[4] || 0) / l.m[0] : 0, 2)}</td></tr>) })}</tbody>
        </table></div>
      </section>}

      {pages.length > 0 && <section className="an-section">
        <div className="an-sect-head">
          <h4 className="an-h5" data-tip={t.pagesTip} tabIndex={0}>{t.pages}</h4>
          <div className="an-sect-tools">
            <input className="an-search" placeholder={t.search} value={pageQ} onChange={e => setPageQ(e.target.value)} aria-label={t.pages}/>
            <button type="button" className="an-csv" onClick={() => exportCsv('pages', [t.col.page, 'path', t.col.views, t.col.users, t.col.time, t.col.conv], pages.map(p => [p.d[1], p.d[0], p.m[0], p.m[1], fmtDur(p.m[1] ? p.m[2] / p.m[1] : 0), p.m[3]]))}>{t.csv}</button>
          </div>
        </div>
        <div className="an-scroll"><table className="an-table an-table--click">
          <thead><tr><th>{t.col.page}</th><Th label={t.col.views} k={0} sort={pSort} onSort={pToggle}/><Th label={t.col.users} k={1} sort={pSort} onSort={pToggle}/><Th label={t.col.time} k="time" sort={pSort} onSort={pToggle}/><Th label={t.col.conv} k={3} sort={pSort} onSort={pToggle}/></tr></thead>
          <tbody>{pagesView.map(p => { const open = openPage === p.d[0]; return [
            <tr key={p.d[0]} className={open ? 'is-open' : ''} onClick={() => setOpenPage(open ? null : p.d[0])} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setOpenPage(open ? null : p.d[0]) }} aria-expanded={open}>
              <td className="an-td-main"><span className="an-page-t">{p.d[1] || p.d[0]}</span><span className="an-page-p"><bdi dir="ltr">{p.d[0]}</bdi></span><span className="an-share"><i style={{ width: `${pages[0]?.m[0] ? (p.m[0] / pages[0].m[0]) * 100 : 0}%` }}/></span></td>
              <td className="is-num">{fmtNum(p.m[0])}</td><td className="is-num">{fmtNum(p.m[1])}</td><td className="is-num">{fmtDur(p.m[1] ? p.m[2] / p.m[1] : 0)}</td><td className="is-num">{p.m[3] || 0}</td>
            </tr>,
            open && <tr key={p.d[0] + ':d'} className="an-drill-row"><td colSpan={5}><PageDrill t={t} path={p.d[0]} range={range} call={call} devName={devName}/></td></tr>,
          ] })}</tbody>
        </table></div>
        <p className="an-footnote">{t.pageHint}</p>
      </section>}

      <div className="an-cols">
        <section className="an-section">
          <h4 className="an-h5">{t.devices}</h4>
          <div className="an-scroll"><table className="an-table">
            <thead><tr><th>{t.col.device}</th><th className="is-num">{t.col.share}</th><th className="is-num">{t.col.users}</th><th className="is-num">{t.col.cr}</th></tr></thead>
            <tbody>{devices.map(d => <tr key={d.d[0]}><td className="an-td-main">{devName(d.d[0])}<span className="an-share"><i style={{ width: `${devTotal ? (d.m[0] / devTotal) * 100 : 0}%` }}/></span></td><td className="is-num">{pctTxt(d.m[0], devTotal)}%</td><td className="is-num">{fmtNum(d.m[0])}</td><td className="is-num">{fmtPct(d.m[1] ? d.m[3] / d.m[1] : 0, 2)}</td></tr>)}</tbody>
          </table></div>
          {nvr.length > 0 && <>
            <span className="an-h6" style={{ marginTop: 10 }}>{t.newRet}</span>
            {(() => { const nw = nvr.find(r => r.d[0] === 'new')?.m[0] || 0, rt2 = nvr.find(r => r.d[0] === 'returning')?.m[0] || 0, all = nw + rt2 || 1; return (
              <div className="an-split" role="img" aria-label={`${t.newU} ${nw} · ${t.retU} ${rt2}`}>
                <i style={{ width: `${(nw / all) * 100}%` }} className="a"/><i style={{ width: `${(rt2 / all) * 100}%` }} className="b"/>
                <div className="an-split__legend"><span><b className="a"/>{t.newU} {fmtNum(nw)} ({pctTxt(nw, all)}%)</span><span><b className="b"/>{t.retU} {fmtNum(rt2)} ({pctTxt(rt2, all)}%)</span></div>
              </div>) })()}
          </>}
        </section>
        <section className="an-section">
          <h4 className="an-h5">{t.geo}</h4>
          <div className="an-geo">
            <div>{countries.slice(0, 8).map(c => <div key={c.d[0]} className="an-row"><span>{c.d[0]}</span><span className="an-dim">{c.m[2] ? `${c.m[2]} ${t.col.conv} · ` : ''}</span><b>{fmtNum(c.m[0])}</b></div>)}</div>
            <div>{cities.slice(0, 8).map(c => <div key={c.d[0]} className="an-row"><span>{c.d[0]}</span><b>{fmtNum(c.m[0])}</b></div>)}</div>
          </div>
        </section>
      </div>

      {heat.length > 0 && <section className="an-section">
        <div className="an-sect-head"><h4 className="an-h5">{t.heat}</h4><span className="an-sub">{t.heatSub}</span></div>
        <div className="an-scroll"><div className="an-heat" dir="ltr">
          <span/>{Array.from({ length: 24 }, (_, h) => <span key={h} className="an-heat__h">{h % 3 === 0 ? h : ''}</span>)}
          {[0, 1, 2, 3, 4, 5, 6].map(d => [
            <span key={'l' + d} className="an-heat__d" dir="auto">{t.dow[d]}</span>,
            ...Array.from({ length: 24 }, (_, h) => { const v = heatAt(d, h); return <i key={d + ':' + h} title={`${t.dow[d]} ${h}:00 · ${v}`} style={{ background: shade(v) }}/> }),
          ])}
        </div></div>
        <div className="an-heat__legend"><span>{t.less}</span>{RAMP.map(c => <i key={c} style={{ background: c }}/>)}<span>{t.more}</span></div>
      </section>}

      <section className="an-section">
        <div className="an-sect-head">
          <h4 className="an-h5" data-tip={t.actionsTip} tabIndex={0}>{t.actions}</h4>
          <button type="button" className="an-csv" onClick={() => exportCsv('actions', [t.col.action, t.col.count, t.col.people], Object.entries(t.ev).map(([ev, [label]]) => { const e = eventsBy.get(ev); return [label, e ? e.m[0] : 0, e ? e.m[1] : 0] }))}>{t.csv}</button>
        </div>
        <div className="an-scroll"><table className="an-table">
          <thead><tr><th>{t.col.action}</th><th className="is-num">{t.col.count}</th><th className="is-num">{t.col.people}</th></tr></thead>
          <tbody>{Object.entries(t.ev).map(([ev, [label, hint]]) => { const e = eventsBy.get(ev); return <tr key={ev}><td className="an-td-main">{label}{hint && <span className="an-dim an-ev-hint">{hint}</span>}</td><td className="is-num">{fmtNum(e ? e.m[0] : 0)}</td><td className="is-num">{fmtNum(e ? e.m[1] : 0)}</td></tr> })}</tbody>
        </table></div>
      </section>
    </>}

    {settingsBox}
  </>)
}

// Admin theme tokens (var(--au-*)) so light / dark follow the admin switch; data colours from the dataviz palette.
const AN_CSS = `
.an{--an-accent:#2a78d6;--an-good:#15803d;--an-bad:#b42318;--an-warn:#a16207;--an-line:var(--au-line2,#e3e7ef);--an-muted:var(--au-text3,#6b7480);--an-ink:var(--au-text,#16202e);--an-surface:var(--au-s2,#fff);--an-surface-2:rgba(var(--ov,0,0,0),.035);--an-empty:rgba(var(--ov,0,0,0),.06);
  display:flex;flex-direction:column;gap:1rem;max-width:1240px;font-variant-numeric:tabular-nums;color:var(--an-ink)}
html[data-admin-theme="dark"] .an{--an-accent:#3987e5;--an-good:#4ADE80;--an-bad:#F08A8A;--an-warn:#F5C26B}
.an *{box-sizing:border-box}
.an-skeleton{padding:4rem 1rem;text-align:center;color:var(--an-muted);border:1.5px dashed var(--an-line);border-radius:13px;background:var(--an-surface)}
.an-empty{color:var(--an-muted);text-align:center;padding:2rem 0;margin:0}
.an-muted,.an-dim{color:var(--an-muted)}
.an-error{color:var(--an-bad);font-size:.85rem}
.an-status{font-size:.88rem;font-weight:600}
.an-top{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;background:var(--an-surface);border:1px solid var(--an-line);border-radius:13px;padding:.85rem 1.15rem}
.an-title{margin:0 0 .15rem;font-size:1.35rem;font-weight:800}
.an-sub{font-size:.82rem;color:var(--an-muted)}
.an-top__side{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap}
.an-live{font-size:.85rem;font-weight:700;display:flex;align-items:center;gap:.45rem;color:var(--an-good);border:1px solid color-mix(in srgb,var(--an-good) 30%,transparent);background:color-mix(in srgb,var(--an-good) 8%,transparent);border-radius:999px;padding:.3rem .85rem;white-space:nowrap}
.an-live i{width:8px;height:8px;border-radius:50%;background:var(--an-good);animation:an-pulse 1.8s infinite}
@keyframes an-pulse{0%,100%{opacity:1}50%{opacity:.3}}
.an-seg{display:inline-flex;border:1px solid var(--an-line);border-radius:10px;background:var(--an-surface-2);padding:3px;gap:2px;max-width:100%;overflow-x:auto}
.an-seg button{border:none;background:transparent;color:var(--an-muted);border-radius:7px;padding:.4rem .8rem;font-size:.84rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
.an-seg button:hover{color:var(--an-ink)}
.an-seg button.is-on{background:var(--an-accent);color:#fff}
.an-seg--sm button{padding:.26rem .6rem;font-size:.76rem}
.an-check{font-size:.8rem;font-weight:600;color:var(--an-muted);display:flex;align-items:center;gap:.4rem;cursor:pointer;white-space:nowrap}
.an-check input,.an-selfex input{accent-color:var(--an-accent);width:15px;height:15px}
.an-metrics{display:grid;grid-template-columns:repeat(5,1fr);background:var(--an-surface);border:1px solid var(--an-line);border-radius:13px 13px 0 0;border-bottom:0;overflow:hidden}
.an-metric{padding:.95rem 1.15rem .8rem;border-inline-start:1px solid var(--an-line);display:flex;flex-direction:column;gap:.2rem}
.an-metric:first-child{border-inline-start:none}
.an-metric__label{font-size:.82rem;font-weight:700;color:var(--an-muted)}
.an-metric__value{font-size:2.05rem;font-weight:800;line-height:1.05;letter-spacing:-.02em}
.an-metric__foot{display:flex;align-items:center;gap:.6rem;min-height:26px}
.an-spark polyline{stroke:var(--an-accent);stroke-width:1.6}
.an-delta{font-size:.82rem;font-weight:700;color:var(--an-muted);direction:ltr;unicode-bidi:isolate}
.an-delta.is-good{color:var(--an-good)}.an-delta.is-bad{color:var(--an-bad)}.an-delta--na{font-weight:500}
.an-secondary{display:flex;flex-wrap:wrap;gap:.45rem 1.7rem;padding:.7rem 1.15rem;background:var(--an-surface-2);border:1px solid var(--an-line);border-radius:0 0 13px 13px;margin-top:-1rem}
.an-secondary__item{display:flex;align-items:baseline;gap:.45rem;font-size:.9rem}
.an-secondary__item i{font-style:normal;color:var(--an-muted);font-size:.82rem;font-weight:600}
.an-secondary__item b{font-weight:800}
.an-section{display:flex;flex-direction:column;gap:.75rem;background:var(--an-surface);border:1px solid var(--an-line);border-radius:13px;padding:1rem 1.15rem 1.1rem;min-width:0}
.an-h5{margin:0;font-size:1rem;font-weight:800;display:inline-flex;align-items:center;gap:.5rem}
.an-h5::before{content:'';width:4px;height:16px;border-radius:3px;background:var(--an-accent);flex-shrink:0}
.an-h6{font-size:.8rem;font-weight:700;color:var(--an-muted);display:block;margin-bottom:.3rem}
.an-sect-head{display:flex;justify-content:space-between;align-items:center;gap:.8rem;flex-wrap:wrap}
.an-sect-tools{display:flex;gap:.5rem;align-items:center}
.an-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1rem;align-items:stretch}
.an-csv,.an-btn{border:1px solid var(--an-line);border-radius:8px;background:var(--an-surface);color:var(--an-muted);font-size:.78rem;font-weight:700;cursor:pointer;padding:.32rem .75rem;text-decoration:none;font-family:inherit;white-space:nowrap}
.an-csv:hover,.an-btn:hover{color:var(--an-accent);border-color:var(--an-accent)}
.an-search{border:1px solid var(--an-line);border-radius:8px;background:var(--an-surface-2);color:inherit;padding:.35rem .7rem;font-size:.82rem;width:180px;font-family:inherit}
.an-search:focus{outline:none;border-color:var(--an-accent)}
.an-hero{display:flex;flex-direction:column;gap:.6rem}
.an-hero__bar{display:flex;justify-content:space-between;align-items:center;gap:.8rem;flex-wrap:wrap}
.an-hero__bar-side{display:flex;align-items:center;gap:.8rem}
.an-hero__plot{position:relative}
.an-hero__plot svg{width:100%;height:auto;display:block}
.an-grid{stroke:var(--an-line);stroke-width:1}
.an-axis{font-size:10px;fill:var(--an-muted)}
.an-line{stroke:var(--an-accent);stroke-width:2.2;stroke-linejoin:round}
.an-line--prev{stroke:var(--an-muted);stroke-width:1.5;stroke-dasharray:5 4;opacity:.65}
.an-area{fill:color-mix(in srgb,var(--an-accent) 9%,transparent)}
.an-cross{stroke:var(--an-muted);stroke-width:1;stroke-dasharray:3 3}
.an-dot--spike{fill:var(--an-good);stroke:var(--an-surface);stroke-width:1.6}
.an-dot--drop{fill:var(--an-bad);stroke:var(--an-surface);stroke-width:1.6}
.an-dot--last{fill:var(--an-accent);stroke:var(--an-surface);stroke-width:1.6}
.an-tip{position:absolute;top:4px;transform:translateX(-50%);background:var(--au-tooltip,#1F2433);color:#fff;border-radius:8px;padding:.4rem .65rem;font-size:.76rem;display:flex;flex-direction:column;gap:.1rem;pointer-events:none;white-space:nowrap;box-shadow:0 8px 22px -10px rgba(0,0,0,.35)}
.an-tip__prev{opacity:.75}
.an-anom-note{margin:0;font-size:.8rem;color:var(--an-warn)}
.an-await{text-align:center;padding:3rem 1.5rem;background:var(--an-surface);border:1.5px dashed var(--an-line);border-radius:13px;display:flex;flex-direction:column;align-items:center;gap:.6rem}
.an-await__badge{font-size:.78rem;font-weight:700;color:var(--an-good);border:1px solid color-mix(in srgb,var(--an-good) 30%,transparent);border-radius:999px;padding:.3rem .9rem}
.an-await h4{margin:.2rem 0 0;font-size:1.15rem}.an-await p{margin:0;max-width:56ch;font-size:.92rem;line-height:1.7;color:var(--an-muted)}
.an-insights{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.4rem}
.an-insights li{padding:.6rem .95rem;font-size:.94rem;line-height:1.6;border-inline-start:3px solid var(--an-accent);border-radius:8px;background:color-mix(in srgb,var(--an-accent) 6%,transparent)}
.an-insights li.is-good{border-color:var(--an-good);background:color-mix(in srgb,var(--an-good) 7%,transparent)}
.an-insights li.is-bad{border-color:var(--an-bad);background:color-mix(in srgb,var(--an-bad) 7%,transparent)}
.an-insights li.is-warn{border-color:var(--an-warn);background:color-mix(in srgb,var(--an-warn) 8%,transparent)}
.an-scroll{overflow-x:auto}
.an-table{width:100%;border-collapse:collapse;font-size:.9rem}
.an-table thead th{background:var(--an-surface-2);text-align:start;font-size:.76rem;font-weight:800;color:var(--an-muted);padding:.5rem .65rem;border-bottom:1.5px solid var(--an-line);white-space:nowrap}
.an-table thead th[role=button]{cursor:pointer;user-select:none}
.an-table thead th[role=button]:hover{color:var(--an-accent)}
.an-table td{text-align:start;padding:.55rem .65rem;border-bottom:1px solid color-mix(in srgb,var(--an-line) 60%,transparent);vertical-align:middle}
.an-table td.is-num{font-weight:700;white-space:nowrap}
.an-table tbody tr:hover td{background:color-mix(in srgb,var(--an-accent) 5%,transparent)}
.an-table tbody tr:last-child td{border-bottom:0}
.an-table--click tbody tr{cursor:pointer}
.an-table tbody tr.is-open td{background:color-mix(in srgb,var(--an-accent) 8%,transparent)}
.an-td-main{font-weight:700;max-width:360px}
.an-quality{color:var(--an-good);font-weight:800}
.an-footnote{margin:0;font-size:.79rem;color:var(--an-muted)}
.an-share{display:block;height:4px;background:color-mix(in srgb,var(--an-line) 70%,transparent);border-radius:99px;margin-top:.32rem;max-width:220px}
.an-share i{display:block;height:100%;background:var(--an-accent);border-radius:inherit;opacity:.75}
.an-page-t{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.an-page-p{display:block;font-size:.72rem;color:var(--an-muted);font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.an-drill-row>td{padding:0}
.an-drill{display:grid;grid-template-columns:auto 1fr 1fr;gap:1.6rem;padding:.95rem 1rem}
.an-drill--loading{display:block;color:var(--an-muted);font-size:.82rem}
.an-row{display:flex;justify-content:space-between;gap:.7rem;font-size:.88rem;padding:.22rem 0}
.an-row b{font-weight:700}
.an-geo{display:grid;grid-template-columns:1fr 1fr;gap:0 2rem}
.an-split{display:flex;flex-wrap:wrap;height:auto;gap:0}
.an-split>i{display:block;height:10px}.an-split>i.a{background:var(--an-accent);border-radius:0 4px 4px 0}.an-split>i.b{background:#eb6834;border-radius:4px 0 0 4px}
html[data-admin-theme="dark"] .an-split>i.b{background:#d95926}
.an .an-split>i.a:dir(rtl){border-radius:4px 0 0 4px}.an .an-split>i.b:dir(rtl){border-radius:0 4px 4px 0}
.an-split__legend{flex-basis:100%;display:flex;gap:1.2rem;font-size:.84rem;margin-top:.45rem;color:var(--an-muted)}
.an-split__legend b{display:inline-block;width:9px;height:9px;border-radius:2px;margin-inline-end:5px}.an-split__legend b.a{background:var(--an-accent)}.an-split__legend b.b{background:#eb6834}
.an-heat{display:grid;grid-template-columns:34px repeat(24,minmax(16px,1fr));gap:3px;min-width:560px}
.an-heat i{display:block;height:22px;border-radius:4px}
.an-heat__h{font-size:10px;color:var(--an-muted);text-align:center}
.an-heat__d{font-size:11px;color:var(--an-muted);align-self:center}
.an-heat__legend{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--an-muted)}
.an-heat__legend i{width:16px;height:10px;border-radius:2px;display:inline-block}
.an-setup{max-width:780px;display:flex;flex-direction:column;gap:.7rem;background:var(--an-surface);border:1px solid var(--an-line);border-radius:13px;padding:1.3rem 1.4rem}
.an-setup h3{margin:0}.an-setup h4{margin:.4rem 0 0;font-size:.95rem}
.an-steps{margin:0;padding-inline-start:1.2rem;display:flex;flex-direction:column;gap:.45rem;font-size:.9rem;line-height:1.6}
.an-steps a{color:var(--an-accent);font-weight:700}
.an-inline{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap}
.an-inline input{border:1px solid var(--an-line);border-radius:8px;padding:.5rem .7rem;font-size:.9rem;background:var(--an-surface-2);color:inherit;min-width:220px;font-family:inherit}
.an-inline button{background:var(--au-brand,#3F49A6);color:#fff;border:none;border-radius:8px;padding:.55rem 1.2rem;font-weight:700;cursor:pointer;font-family:inherit}
.an-settings{background:var(--an-surface);border:1px solid var(--an-line);border-radius:13px;padding:.85rem 1.15rem}
.an-settings summary{font-size:.82rem;font-weight:700;color:var(--an-muted);cursor:pointer}
.an-settings[open] summary{margin-bottom:.7rem}
.an-live-panel{background:var(--an-surface);border:1px solid var(--an-line);border-radius:13px;padding:1.05rem 1.15rem 1.15rem}
.an-live-panel__head{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:.9rem}
.an-live-panel__head h3{margin:0 0 .15rem;font-size:1.05rem;font-weight:800}
.an-live-panel__grid{display:grid;grid-template-columns:minmax(190px,.8fr) 1.1fr 1.1fr;gap:1rem;align-items:stretch}
.an-live-now{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3rem;text-align:center;padding:.9rem .8rem;background:color-mix(in srgb,var(--an-good) 7%,transparent);border:1px solid color-mix(in srgb,var(--an-good) 25%,transparent);border-radius:11px}
.an-live-now__num{font-size:2.6rem;font-weight:800;line-height:1;color:var(--an-good)}
.an-live-now__lbl{font-size:.85rem;font-weight:600;color:var(--an-muted)}
.an-live-now__foot{font-size:.76rem;color:var(--an-muted)}
.an-live-spark{display:flex;align-items:flex-end;gap:2px;height:34px;width:100%;margin-top:.55rem;direction:ltr}
.an-live-spark i{flex:1;background:var(--an-good);border-radius:2px 2px 0 0;min-height:3px}
.an-live-spark i.is-empty{background:color-mix(in srgb,var(--an-muted) 22%,transparent)}
.an-live-list{border:1px solid var(--an-line);border-radius:11px;padding:.8rem .9rem;display:flex;flex-direction:column;min-width:0}
.an-live-list h4{margin:0 0 .55rem;font-size:.92rem;font-weight:700;display:flex;align-items:center;gap:.4rem}
.an-live-list ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.3rem}
.an-live-list li{display:flex;justify-content:space-between;align-items:baseline;gap:.7rem;font-size:.87rem;padding:.18rem 0;border-bottom:1px dashed color-mix(in srgb,var(--an-line) 70%,transparent)}
.an-live-list li:last-child{border-bottom:none}
.an-live-list__name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.an-live-list li b{font-weight:800;color:var(--an-accent);flex:none}
.an-live-badge{font-size:.68rem;font-weight:700;color:var(--an-muted);background:color-mix(in srgb,var(--an-muted) 14%,transparent);border-radius:999px;padding:.1rem .45rem}
.an-live-note{margin:.5rem 0 0;font-size:.73rem;line-height:1.5;color:var(--an-muted)}
.an-empty--sm{padding:.9rem 0;font-size:.85rem}
.an-selfex{display:flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:600;color:var(--an-muted);cursor:pointer;white-space:nowrap}
.an-conv{gap:.9rem}
.an-conv__head{display:grid;grid-template-columns:auto 1fr;align-items:end;gap:1.2rem 2rem}
.an-conv__big{display:flex;flex-direction:column;gap:.15rem}
.an-conv__big-label{font-size:.82rem;font-weight:700;color:var(--an-muted)}
.an-conv__big-value{font-size:2.6rem;font-weight:900;line-height:1;letter-spacing:-.02em;display:flex;align-items:baseline;gap:.6rem}
.an-conv__big-value .an-delta{font-size:.9rem}
.an-conv__big-sub{font-size:.86rem;color:var(--an-muted)}
.an-conv__explain{margin:0;font-size:.87rem;line-height:1.6;color:var(--an-muted);max-width:64ch}
.an-conv__tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.6rem}
.an-conv__tile{display:flex;flex-direction:column;gap:.15rem;padding:.8rem .95rem;border:1px solid var(--an-line);border-radius:11px;background:var(--an-surface-2)}
.an-conv__tile-label{font-size:.8rem;font-weight:700;color:var(--an-muted);display:flex;align-items:center;gap:.4rem}
.an-conv__tile-label i{width:8px;height:8px;border-radius:50%;background:var(--an-accent);flex:none}
.an-conv__tile-value{font-size:1.6rem;font-weight:800;line-height:1.1;display:flex;align-items:baseline;gap:.5rem}
.an-conv__tile-value .an-delta{font-size:.78rem}
.an-conv__tile-sub{font-size:.78rem;color:var(--an-muted)}
.an-conv__note{margin:0;font-size:.8rem;color:var(--an-muted);line-height:1.55}
.an-ev-hint{display:block;font-size:.76rem;font-weight:500;margin-top:.1rem}
.an [data-tip]{position:relative;cursor:help}
.an [data-tip]::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 9px);inset-inline-start:0;width:max-content;max-width:280px;background:var(--au-tooltip,#141627);color:#fff;font-size:.78rem;font-weight:500;line-height:1.55;text-align:start;padding:.55rem .75rem;border-radius:9px;box-shadow:0 8px 26px rgba(0,0,0,.3);display:none;pointer-events:none;z-index:60;white-space:normal}
.an [data-tip]:hover::after,.an [data-tip]:focus-visible::after{display:block}
.an [data-tip]:focus-visible{outline:2px solid var(--an-accent);outline-offset:3px;border-radius:8px}
.an-metric[data-tip] .an-metric__label,.an-secondary__item[data-tip] i,.an-h5[data-tip]{text-decoration:underline dotted color-mix(in srgb,currentColor 45%,transparent);text-underline-offset:3px}
@media (max-width:1000px){.an-cols{grid-template-columns:minmax(0,1fr)}.an-metrics{grid-template-columns:repeat(3,1fr)}.an-metric:nth-child(3n+1){border-inline-start:none}.an-metric:nth-child(n+4){border-top:1px solid var(--an-line)}.an-cols{grid-template-columns:1fr}.an-drill{grid-template-columns:1fr 1fr}.an-live-panel__grid{grid-template-columns:1fr}.an-conv__head{grid-template-columns:1fr}.an-conv__tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:680px){.an{gap:.8rem}.an-metrics{grid-template-columns:repeat(2,1fr)}.an-metric{padding:.75rem .9rem .6rem}.an-metric:nth-child(3n+1){border-inline-start:1px solid var(--an-line)}.an-metric:nth-child(2n+1){border-inline-start:none}.an-metric:nth-child(n+3){border-top:1px solid var(--an-line)}.an-metric__value{font-size:1.55rem}.an-hero__plot svg{height:230px}.an-section{padding:.85rem .9rem .95rem}.an-table{min-width:470px;font-size:.8rem}.an-geo{grid-template-columns:1fr}.an-drill{grid-template-columns:1fr;gap:.9rem}.an-search{width:130px}.an-top__side{width:100%}}
`
