// ── WhatsApp automations: shared, pure logic (only the pure src/lib/leadFields.js) ─────────────────────────
// Imported by the server engine (lib/automations.js) AND by the admin panel (src/AutomationsTab.jsx,
// src/GreenAPIChat.jsx), so templates, placeholders, quiet hours and reply detection behave the same
// in the browser preview and in the message that is actually sent.
//
// Every template has a Hebrew text and an English text: a lead who came from the English site
// (crm_data.origin.lang === 'en') gets the English version.

import { shortCampaign } from '../src/lib/leadFields.js'
import { hebrewFirstName, isLatinName, givenName } from './hebrew-names.js'
import { englishProject, englishFirstName, englishTown, hasHebrew } from './english-values.js'
import { leadNeeds } from './lead-needs.js'

export const STAGES = ['new', 'contacted', 'discovery', 'meeting', 'negotiating', 'won', 'lost', 'irrelevant', 'nurture']

// Placeholders the office can use in any template
export const VARIABLES = [
  { key: 'name',     he: 'שם פרטי',          en: 'First name' },
  { key: 'greeting', he: 'ברכה לפי השעה (בוקר טוב / ערב טוב)', en: 'Greeting by time of day' },
  { key: 'when',     he: 'מתי השאיר פרטים (היום / אתמול / ביום שלישי)', en: 'When they left their details (today / yesterday / on Tuesday)' },
  { key: 'where',    he: 'איפה השאיר פרטים (במודעה / באתר)', en: 'Where they left their details (on our ad / on our website)' },
  { key: 'fullName', he: 'שם מלא',           en: 'Full name' },
  { key: 'property', he: 'הנכס שהתעניין בו', en: 'Property of interest' },
  { key: 'location', he: 'מיקום הנכס',       en: 'Property location' },
  { key: 'agent',    he: 'שם הנציג',         en: 'Agent name' },
  { key: 'phone',    he: 'טלפון המשרד',      en: 'Office phone' },
  { key: 'site',     he: 'אתר',              en: 'Website' },
  { key: 'sellLink', he: 'קישור לטופס נכס',  en: 'Property form link' },
  { key: 'bookingLink', he: 'קישור לקביעת שיחה ביומן', en: 'Link to book a call' },
  // what the lead told us (lib/lead-needs.js) — empty when unknown; wrap a sentence in [[ … ]] to drop it then
  { key: 'needs',    he: 'מה הוא מחפש (חדרים, אזור, תקציב)', en: 'What they look for (rooms, area, budget)' },
  { key: 'budget',   he: 'תקציב',            en: 'Budget' },
  { key: 'rooms',    he: 'חדרים',            en: 'Rooms' },
  { key: 'area',     he: 'אזור מבוקש',       en: 'Preferred area' },
  { key: 'timeline', he: 'מתי מתכנן לעבור',  en: 'When they plan to move' },
  { key: 'purpose',  he: 'מטרה (מגורים / השקעה)', en: 'Purpose (home / investment)' },
  { key: 'message',  he: 'מה שכתב בפנייה',   en: 'What they wrote' },
]

// In the order of the pipeline: the first message, after the first call, interested, moving forward, no reply — then the
// rest. `short` = the label of the category buttons in the template windows.
export const CATEGORIES = [
  { id: 'welcome',    he: 'פתיחה',          short: 'פתיחה',        en: 'First message',  en_short: 'First message', color: '#22C55E', icon: '👋' },
  { id: 'contacted',  he: 'נוצר קשר – אחרי השיחה הראשונה', short: 'נוצר קשר', en: 'Contacted – after the first call', en_short: 'Contacted', color: '#F59E0B', icon: '📞' },
  { id: 'interested', he: 'מתעניין – אחרי שיחה וחומרים', short: 'מתעניין', en: 'Interested – after the call and materials', en_short: 'Interested', color: '#D9730D', icon: '💡' },
  { id: 'progress',   he: 'רוצה להתקדם',    short: 'רוצה להתקדם',  en: 'Moving forward', en_short: 'Moving forward', color: '#0073EA', icon: '🚀' },
  { id: 'followup',   he: 'לא ענה',         short: 'לא ענה',       en: 'No reply',       en_short: 'No reply', color: '#E2445C', icon: '⏰' },
  { id: 'personal',   he: 'אישי – לפי הפנייה', short: 'אישי',      en: 'Personal – from the inquiry', en_short: 'Personal', color: '#0E9AA7', icon: '✍️' },
  { id: 'deal',       he: 'עסקה וסגירה',    short: 'עסקה',         en: 'Deal & closing', en_short: 'Deal', color: '#A25DDC', icon: '🤝' },
  { id: 'closing',    he: 'לא מעוניין',     short: 'לא מעוניין',   en: 'Not interested', en_short: 'Not interested', color: '#7D7D7D', icon: '🙏' },
  { id: 'general',    he: 'כללי',           short: 'כללי',         en: 'General',        en_short: 'General', color: '#8490D8', icon: '💬' },
]

// The lead's pipeline stage → the templates that fit it now. Nothing sent yet → the first message; a new lead who got our
// message and never answered → "לא ענה"; the stage "ללא מענה" (lost) → "לא ענה" too, to try once more for a call.
const STAGE_CATEGORY = { new: 'welcome', contacted: 'contacted', discovery: 'interested', meeting: 'progress', negotiating: 'progress', won: 'deal', lost: 'followup', irrelevant: 'closing', nurture: 'closing' }
export function stageCategory(lead = {}, { hasOut = true, hasIn = true } = {}) {
  if (!hasOut) return 'welcome'
  const stage = lead?.leadStatus || lead?.crm_data?.leadStatus || lead?.status || 'new'
  if (stage === 'new') return hasIn ? 'contacted' : 'followup'
  return STAGE_CATEGORY[stage] || 'followup'
}

// Built-in library. The office can edit any of them (edits are saved in the settings) or add new ones.
export const DEFAULT_TEMPLATES = [
  { id: 'welcome', cat: 'welcome', he_title: 'פתיחה – ליד חדש', en_title: 'Welcome – new lead',
    he: 'היי {name}, ראינו שהשארתם פרטים[[ על {property}]], אנחנו מאפיק הנחל.\nאפשר להתקשר היום לכמה דקות?',
    en: 'Hi {name}, thanks for your details[[ about {property}]]. This is Afik Hanahal.\nCould we call you today for a few minutes?' },
  { id: 'welcome_prop', cat: 'welcome', he_title: 'פתיחה – התעניין בנכס', en_title: 'Welcome – asked about a property',
    he: 'היי {name}, ראינו את הפנייה[[ על {property}]].\nלשלוח תוכניות ומחירים, או שנדבר בטלפון?',
    en: 'Hi {name}, thanks for your inquiry[[ about {property}]].\nShall we send plans and prices, or talk by phone?' },
  { id: 'welcome_short', cat: 'welcome', he_title: 'פתיחה – קצר ולעניין', en_title: 'Welcome – short and to the point',
    he: 'היי {name}, קיבלנו את הפרטים[[ על {property}]]. נוח שנתקשר היום?',
    en: 'Hi {name}, we\'ve received your details[[ about {property}]]. Would today be a good time for a call?' },
  { id: 'welcome_slots', cat: 'welcome', he_title: 'פתיחה – בחירת זמן לשיחה', en_title: 'Welcome – pick a time for a call',
    he: 'היי {name}, קיבלנו את הפנייה[[ על {property}]].\nנתקשר היום אחר הצהריים או מחר בבוקר?',
    en: 'Hi {name}, thanks for your inquiry[[ about {property}]].\nWould this afternoon or tomorrow morning suit you for a call?' },
  { id: 'welcome_book', cat: 'welcome', he_title: 'פתיחה – עם קישור לקביעת שיחה', en_title: 'Welcome – with a link to book a call',
    he: 'היי {name}, ראינו את הפנייה[[ על {property}]]. אפשר לקבוע כאן שיחה:\n{bookingLink}',
    en: 'Hi {name}, thanks for your inquiry[[ about {property}]]. You can book a call here:\n{bookingLink}' },
  { id: 'welcome_personal', cat: 'welcome', he_title: 'פתיחה – אישי מהנציג', en_title: 'Welcome – a personal note from the agent',
    he: '{greeting} {name}, עברנו על הפרטים שהשארתם[[ על {property}]]. נדבר היום בטלפון?',
    en: '{greeting}[[ {name}]], we went over your details[[ about {property}]]. Could we talk by phone today?' },
  { id: 'welcome_questions', cat: 'welcome', he_title: 'פתיחה – שאלות היכרות', en_title: 'Welcome – a few qualifying questions',
    he: 'היי {name}, תודה שפניתם[[ לגבי {property}]].\nזה למגורים או להשקעה, ובערך באיזה תקציב?',
    en: 'Hi {name}, thanks for getting in touch[[ about {property}]].\nIs this a home for you or an investment, and roughly what budget do you have in mind?' },
  { id: 'welcome_callnow', cat: 'welcome', he_title: 'פתיחה – שיחה עכשיו?', en_title: 'Welcome – a call right now?',
    he: 'היי {name}, ראינו עכשיו את הפרטים שהשארתם[[ על {property}]]. אנחנו פנויים, נתקשר?',
    en: 'Hi {name}, we\'ve just seen the details you left[[ about {property}]]. We\'re available now, may we give you a call?' },
  { id: 'welcome_brochure', cat: 'welcome', he_title: 'פתיחה – שליחת חוברת פרטים', en_title: 'Welcome – send the details pack',
    he: 'היי {name}, ראינו שהתעניינתם ב{property}. הכנו חוברת עם התוכניות והמחירים, לשלוח לכם?',
    en: 'Hi {name}, thanks for your interest in {property}. We have a brochure with the plans and prices, would you like us to send it?' },
  { id: 'welcome_late', cat: 'welcome', he_title: 'פתיחה באיחור – התנצלות על העיכוב', en_title: 'Late welcome – apologising for the delay',
    he: 'היי {name}, סליחה על העיכוב, כאן אפיק הנחל. זה עדיין רלוונטי[[ לגבי {property}]]?',
    en: 'Hi {name}, sorry for the delay, this is Afik Hanahal. Is it still relevant[[ regarding {property}]]?' },
  { id: 'welcome_late_check', cat: 'welcome', he_title: 'פתיחה באיחור – עדיין רלוונטי?', en_title: 'Late welcome – still relevant?',
    he: 'היי {name}, חוזרים אליכם לגבי הפרטים שהשארתם[[ על {property}]]. עדיין רלוונטי?',
    en: 'Hi {name}, following up on the details you left[[ about {property}]]. Is it still relevant for you?' },
  { id: 'welcome_investor', cat: 'welcome', he_title: 'פתיחה – משקיעים וקרקעות', en_title: 'Welcome – investors and land',
    he: 'היי {name}, ראינו שהתעניינתם ב{property}.\nנעבור יחד על התכנון והטאבו, 10 דקות השבוע?',
    en: 'Hi {name}, thanks for your interest in {property}.\nShall we go over the zoning and Tabu registration together, 10 minutes this week?' },
  { id: 'after_hours', cat: 'welcome', he_title: 'מחוץ לשעות הפעילות', en_title: 'Outside office hours',
    he: 'היי {name}, קיבלנו, תודה! נחזור אליכם מחר בבוקר[[ לגבי {property}]].\nדחוף? {phone}',
    en: 'Hi {name}, thank you, we\'ve received your message! We\'ll get back to you tomorrow morning[[ about {property}]].\nIf it\'s urgent: {phone}' },
  { id: 'nr1', cat: 'followup', he_title: 'לא ענה – תזכורת ראשונה', en_title: 'No reply – first reminder',
    he: 'היי {name}, רצינו לבדוק שההודעה שלנו[[ על {property}]] הגיעה.\nנתקשר מחר בבוקר או אחר הצהריים?',
    en: 'Hi {name}, just making sure our message[[ about {property}]] reached you.\nWould tomorrow morning or afternoon work for a call?' },
  { id: 'nr2', cat: 'followup', he_title: 'לא ענה – ערך נוסף', en_title: 'No reply – added value',
    he: 'היי {name}, נכנסו השבוע נכסים שעוד לא באתר[[, בכיוון של {needs}]]. לשלוח לכם?',
    en: 'Hi {name}, a few properties came in this week that aren\'t listed online yet[[, in line with {needs}]]. Would you like us to send them?' },
  { id: 'nr3', cat: 'followup', he_title: 'לא ענה – פנייה אחרונה', en_title: 'No reply – last message',
    he: 'היי {name}, לא נציף אתכם בהודעות. אם זה יחזור להיות רלוונטי, אנחנו כאן.[[\n{agent}]]',
    en: 'Hi {name}, we won\'t fill up your inbox. If it becomes relevant again, we\'re here.[[\n{agent}]]' },
  { id: 'missed_call', cat: 'followup', he_title: 'ניסינו להתקשר', en_title: 'We tried to call',
    he: 'היי {name}, ניסינו להתקשר[[ לגבי {property}]]. מתי נוח, בבוקר או אחר הצהריים?',
    en: 'Hi {name}, we tried to call you[[ about {property}]]. What suits you better, morning or afternoon?' },
  { id: 'nr_short', cat: 'followup', he_title: 'לא ענה – תזכורת קצרה', en_title: 'No reply – short reminder',
    he: 'היי {name}, יצא לכם לחשוב על {property}?',
    en: 'Hi {name}, have you had a chance to think about {property}?' },
  { id: 'nr_channel', cat: 'followup', he_title: 'לא ענה – טלפון או וואטסאפ?', en_title: 'No reply – phone or WhatsApp?',
    he: 'היי {name}, שנתקשר לכמה דקות, או לשלוח את הפרטים[[ על {property}]] כאן?',
    en: 'Hi {name}, would you prefer a quick call, or shall we send the details[[ on {property}]] here?' },
  { id: 'nr_relevant', cat: 'followup', he_title: 'לא ענה – עדיין רלוונטי?', en_title: 'No reply – still relevant?',
    he: 'היי {name}, {property} עדיין רלוונטי בשבילכם? גם "לא" זו תשובה טובה.',
    en: 'Hi {name}, is {property} still of interest to you? A simple "no" is perfectly fine too.' },
  { id: 'nr_scarcity', cat: 'followup', he_title: 'לא ענה – עדכון זמינות', en_title: 'No reply – availability update',
    he: 'היי {name}, עדכון על {property}: יש הרבה ביקוש ונשאר פחות. לשלוח לכם מה עוד פתוח?',
    en: 'Hi {name}, a quick update on {property}: demand is strong and availability is shrinking. Would you like to see what\'s still available?' },
  { id: 'nr_times', cat: 'followup', he_title: 'לא ענה – הצעת זמנים', en_title: 'No reply – suggested times',
    he: 'היי {name}, 5 דקות טלפון מחר[[ על {property}]], בבוקר או אחר הצהריים?',
    en: 'Hi {name}, 5 minutes on the phone tomorrow[[ about {property}]], morning or afternoon?' },
  { id: 'positive', cat: 'progress', he_title: 'רוצה להתקדם – תיאום שיחה', en_title: 'Moving forward – book a call',
    he: 'מעולה {name}! שיחה או סיור במקום, איזה יום מתאים השבוע?',
    en: 'Great[[, {name}]]! Would you prefer a call or a visit, and which day this week suits you?' },
  { id: 'book_link', cat: 'progress', he_title: 'קישור לקביעת שיחה ביומן', en_title: 'Link to book a call',
    he: 'אפשר לבחור כאן שעה נוחה לשיחה קצרה, זה לוקח פחות מדקה:\n{bookingLink}',
    en: 'You can choose a time that suits you for a short call here, it takes less than a minute:\n{bookingLink}' },
  { id: 'meeting_confirm', cat: 'progress', he_title: 'אישור פגישה', en_title: 'Meeting confirmation',
    he: 'סגור {name}, נתראה. אם משהו משתנה אפשר לכתוב לנו כאן.',
    en: 'All set[[, {name}]], see you then. If anything changes, just send us a message here.' },
  { id: 'docs', cat: 'progress', he_title: 'מסמכים להמשך', en_title: 'Documents for the next step',
    he: 'היי {name}, כדי להתקדם נצטרך צילום ת"ז ונסח טאבו. אפשר לצלם ולשלוח לכאן.',
    en: 'Hi {name}, to move forward we\'ll need a copy of your ID and a Tabu extract. You can photograph them and send them here.' },
  { id: 'negotiation', cat: 'progress', he_title: 'במו"מ – עדכון', en_title: 'Negotiation – update',
    he: 'היי {name}, דיברנו היום עם הצד השני[[ לגבי {property}]] ויש התקדמות. נעדכן בהמשך.',
    en: 'Hi {name}, we spoke with the other side today[[ about {property}]] and there\'s progress. We\'ll keep you posted.' },
  { id: 'visit_slots', cat: 'progress', he_title: 'תיאום סיור – בחירת זמן', en_title: 'Book a visit – pick a time',
    he: 'מעולה {name}, בואו נקבע סיור[[ ב{property}]]. מחר בבוקר, מחר אחר הצהריים או שישי בבוקר?',
    en: 'Great[[, {name}]]! Let\'s arrange a visit[[ to {property}]]. Would tomorrow morning, tomorrow afternoon or Friday morning suit you?' },
  { id: 'meeting_reminder', cat: 'progress', he_title: 'תזכורת לפגישה', en_title: 'Meeting reminder',
    he: 'היי {name}, תזכורת שנפגשים היום[[ בעניין {property}]]. נתראה!',
    en: 'Hi {name}, a quick reminder about our meeting today[[ regarding {property}]]. See you soon!' },
  { id: 'after_call', cat: 'contacted', he_title: 'אחרי שיחה – סיכום', en_title: 'After the call – summary',
    he: 'היי {name}, היה נעים לדבר. כמו שסיכמנו, מצרפים את הפרטים[[ על {property}]].',
    en: 'Hi {name}, it was good speaking with you. As agreed, here are the details[[ on {property}]].' },
  { id: 'ct_materials', cat: 'contacted', he_title: 'נוצר קשר – החומרים כמו שדיברנו', en_title: 'Contacted – the materials, as discussed',
    he: 'היי {name}, כמו שדיברנו, אלה התוכניות והמחירים[[ של {property}]].\nתעברו בנחת, ונדבר כשנוח לכם?',
    en: 'Hi {name}, as we discussed, here are the plans and prices[[ for {property}]].\nTake your time, and shall we talk when it suits you?' },
  { id: 'ct_needs', cat: 'contacted', he_title: 'נוצר קשר – לדייק מה מחפשים', en_title: 'Contacted – narrowing down what you need',
    he: 'היי {name}, כדי שנשלח רק מה שרלוונטי: כמה חדרים, ובאיזה תקציב בערך?',
    en: 'Hi {name}, so we only send what\'s relevant: how many rooms, and roughly what budget?' },
  { id: 'ct_continue', cat: 'contacted', he_title: 'נוצר קשר – להמשיך את השיחה', en_title: 'Contacted – picking up the conversation',
    he: 'היי {name}, נעים היה לדבר. מתי נוח להמשיך, מחר בבוקר או אחר הצהריים?',
    en: 'Hi {name}, it was good speaking with you. When would suit you to continue, tomorrow morning or in the afternoon?' },
  { id: 'ct_thanks', cat: 'contacted', he_title: 'נוצר קשר – תודה על השיחה', en_title: 'Contacted – thanks for the call',
    he: 'היי {name}, תודה על השיחה. אם עולה משהו בינתיים, אפשר לכתוב לנו כאן.',
    en: 'Hi {name}, thanks for the call. If anything comes up in the meantime, you can message us here.' },
  { id: 'int_checkin', cat: 'interested', he_title: 'מתעניין – עברתם על החומרים?', en_title: 'Interested – had a look at the materials?',
    he: 'היי {name}, הספקתם לעבור על החומרים[[ של {property}]]?\nמה תפס אתכם, ומה פחות?',
    en: 'Hi {name}, have you had a chance to go through the materials[[ on {property}]]?\nWhat caught your eye, and what didn\'t?' },
  { id: 'int_direction', cat: 'interested', he_title: 'מתעניין – יש כיוון או לא?', en_title: 'Interested – is there a direction?',
    he: 'היי {name}, רק שנדע איך להמשיך: יש כיוון[[ עם {property}]], או שזה פחות מתאים כרגע?\nגם "לא" זו תשובה טובה.',
    en: 'Hi {name}, just so we know how to proceed: is this heading somewhere for you[[ with {property}]], or not quite right at the moment?\nA "no" is a perfectly good answer too.' },
  { id: 'int_developer', cat: 'interested', he_title: 'מתעניין – שיחה עם היזם', en_title: 'Interested – a call with the developer',
    he: 'היי {name}, אחרי השיחה שלנו נראה לנו שכדאי לכם לשמוע את היזם ישירות.\nלתאם שיחה קצרה השבוע?',
    en: 'Hi {name}, after our chat we think it would be worth hearing from the developer directly.\nShall we set up a short call this week?' },
  { id: 'int_office', cat: 'interested', he_title: 'מתעניין – פגישה במשרד', en_title: 'Interested – a meeting at our office',
    he: 'היי {name}, הכי פשוט לעבור על הכל יחד, מול התוכניות.\nבא לכם לקפוץ אלינו למשרד, ראשון או שלישי?',
    en: 'Hi {name}, the easiest way is to go over everything together, with the plans in front of us.\nWould you like to drop by our office, on Sunday or Tuesday?' },
  { id: 'int_choice', cat: 'interested', he_title: 'מתעניין – שיחה עם היזם או פגישה', en_title: 'Interested – developer call or office meeting',
    he: 'היי {name}, מה יותר נוח לכם להמשך: שיחה עם היזם בטלפון, או פגישה אצלנו במשרד?',
    en: 'Hi {name}, what would suit you better as a next step: a phone call with the developer, or a meeting at our office?' },
  { id: 'int_questions', cat: 'interested', he_title: 'מתעניין – מה נשאר פתוח?', en_title: 'Interested – what is still open?',
    he: 'היי {name}, אחרי החומרים בדרך כלל עולות שאלות על מחיר, מימון או לוחות זמנים.\nמה עולה אצלכם?',
    en: 'Hi {name}, after the materials people usually have questions about price, financing or timing.\nWhat\'s on your mind?' },
  { id: 'int_quiet', cat: 'interested', he_title: 'מתעניין – כמה ימים אחרי', en_title: 'Interested – a few days later',
    he: 'היי {name}, עברו כמה ימים מאז ששלחנו את החומרים[[ על {property}]].\nאיפה זה עומד אצלכם?',
    en: 'Hi {name}, it\'s been a few days since we sent the materials[[ on {property}]].\nWhere do things stand on your side?' },
  { id: 'int_partner', cat: 'interested', he_title: 'מתעניין – מי עוד מחליט איתכם', en_title: 'Interested – who else decides with you',
    he: 'היי {name}, אם יש עוד מישהו שמחליט איתכם, הוא מוזמן להצטרף לשיחה או לפגישה.\nככה עונים על הכל בפעם אחת.',
    en: 'Hi {name}, if someone else is part of the decision, they\'re very welcome to join the call or the meeting.\nThat way we can cover everything in one go.' },
  { id: 'int_movement', cat: 'interested', he_title: 'מתעניין – יש תנועה בפרויקט', en_title: 'Interested – things are moving',
    he: 'היי {name}, רק עדכון: יש לא מעט תנועה[[ ב{property}]] לאחרונה.\nאם זה עדיין רלוונטי, שווה לדבר עם היזם בקרוב.',
    en: 'Hi {name}, a quick update: there\'s been quite a bit of interest[[ in {property}]] lately.\nIf it\'s still on your list, it\'s worth speaking with the developer soon.' },
  { id: 'int_book', cat: 'interested', he_title: 'מתעניין – לבחור זמן לשיחת המשך', en_title: 'Interested – pick a time for a follow-up call',
    he: 'היי {name}, שלא נשחק פינג פונג, אפשר לבחור כאן זמן לשיחת המשך:\n{bookingLink}',
    en: 'Hi {name}, to save the back and forth, you can pick a time for a follow-up call here:\n{bookingLink}' },
  { id: 'closing_polite', cat: 'closing', he_title: 'לא מעוניין – סגירה מכבדת', en_title: 'Not interested – a courteous close',
    he: '[[{name}, ]]תודה שעדכנתם, באמת. לא נטריד יותר.\nאם תחפשו משהו בשרון, אנחנו כאן.',
    en: 'Thank you for letting us know[[, {name}]], we appreciate it. We won\'t contact you further.\nIf you\'re ever looking in the Sharon region, we\'re here.' },
  { id: 'reengage', cat: 'closing', he_title: 'חזרה ללקוח אחרי תקופה', en_title: 'Re-engage after a while',
    he: 'היי {name}, מה נשמע? כאן אפיק הנחל.\nעדיין מחפשים[[ {needs}]]? נכנסו כמה דברים חדשים.',
    en: 'Hi {name}, how are you? It\'s Afik Hanahal.\nStill looking[[ for {needs}]]? A few new properties have come in.' },
  { id: 'nurture_checkin', cat: 'closing', he_title: 'לחזור בהמשך – בדיקת מצב', en_title: 'Later – checking in',
    he: '{greeting} {name}, מה שלומכם? משהו השתנה בתוכניות[[ לגבי {property}]]? נדבר השבוע?',
    en: '{greeting}[[ {name}]], how are you? Has anything changed in your plans[[ regarding {property}]]? Shall we talk this week?' },
  { id: 'reengage_new', cat: 'closing', he_title: 'חזרה – נכסים חדשים', en_title: 'Re-engage – new listings',
    he: 'היי {name}, נכנסו נכסים שעוד לא פורסמו[[, בכיוון של {needs}]]. לשלוח לכם?',
    en: 'Hi {name}, a few new properties have just come in that haven\'t been advertised yet[[, in line with {needs}]]. Would you like us to send them?' },
  { id: 'won_thanks', cat: 'deal', he_title: 'אחרי סגירה – תודה', en_title: 'After closing – thank you',
    he: 'מזל טוב {name}!! היה תענוג ללוות אתכם.\nאם בא לכם לשתף איך היה, זה עוזר לנו מאוד.',
    en: 'Congratulations[[, {name}]]! It was a pleasure working with you.\nIf you\'d like to share your experience, it would mean a lot to us.' },
  { id: 'personal_needs', cat: 'personal', he_title: 'אישי – לפי מה שהוא מחפש', en_title: 'Personal – what they are looking for',
    he: 'היי {name}, תודה שפניתם לגבי {property}.[[\nראינו שאתם מחפשים {needs}, ויש לנו כמה התאמות.]] נדבר?',
    en: 'Hi {name}, thanks for getting in touch about {property}.[[\nWe see you\'re looking for {needs}, and we have a few matches.]] Shall we talk?' },
  { id: 'personal_budget', cat: 'personal', he_title: 'אישי – לפי התקציב', en_title: 'Personal – by budget',
    he: 'היי {name}, תודה על ההתעניינות ב{property}.[[ ראינו תקציב של {budget}.]] מתי נוח לדבר?',
    en: 'Hi {name}, thanks for your interest in {property}.[[ We noted a budget of {budget}.]] When suits you to talk?' },
  { id: 'personal_message', cat: 'personal', he_title: 'אישי – מתייחס למה שכתב', en_title: 'Personal – answers what they wrote',
    he: 'היי {name}, קראנו מה שכתבתם[[: "{message}"]].\nיש לכם כמה דקות היום לדבר על זה?',
    en: 'Hi {name}, we read your message[[: "{message}"]].\nDo you have a few minutes today to talk it through?' },
  { id: 'personal_investor', cat: 'personal', he_title: 'אישי – משקיע', en_title: 'Personal – investor',
    he: 'היי {name}, ראינו שהתעניינתם ב{property}[[ ל{purpose}]].\nלשלוח סקירה של מחיר, טאבו ותשואה[[ מול {budget}]]?',
    en: 'Hi {name}, thanks for your interest in {property}[[ as {purpose}]].\nShall we send an overview of price, Tabu registration and returns[[ for a budget of {budget}]]?' },
  { id: 'personal_timeline', cat: 'personal', he_title: 'אישי – לפי לוח הזמנים', en_title: 'Personal – by timeline',
    he: 'היי {name}, תודה שפניתם לגבי {property}.[[ מתכננים לעבור {timeline}? זה בדיוק הזמן.]] נבנה תוכנית?',
    en: 'Hi {name}, thanks for getting in touch about {property}.[[ Moving {timeline}? That\'s the right time to start.]] Shall we plan it together?' },
  { id: 'personal_followup', cat: 'personal', he_title: 'אישי – מעקב לפי מה שביקש', en_title: 'Personal – follow-up on their request',
    he: 'היי {name}, חזרנו לפנייה[[ על {property}]] ומצאנו כמה דברים ששווה לראות. נדבר השבוע?',
    en: 'Hi {name}, we went back to your inquiry[[ about {property}]] and found a few options worth seeing. Could we talk this week?' },
  { id: 'seller_invite', cat: 'general', he_title: 'בעל נכס – טופס קליטה', en_title: 'Owner – intake form',
    he: 'היי {name}, כדי לשווק את הנכס כמו שצריך, אפשר למלא כאן פרטים ותמונות (כ-5 דקות):\n{sellLink}',
    en: 'Hi {name}, so we can market your property properly, you can add the details and photos here (about 5 minutes):\n{sellLink}' },
  { id: 'holiday', cat: 'general', he_title: 'ברכת חג', en_title: 'Holiday greeting',
    he: 'חג שמח {name}! שנה טובה ושקטה, עם הרבה בריאות.[[\n{agent}]]',
    en: 'Happy holidays[[, {name}]]! Wishing you a calm and healthy year ahead.[[\n{agent}]]' },
  // ── chat-ready replies (the WhatsApp page's template picker) ──
  { id: 'send_details', cat: 'contacted', he_title: 'שליחת פרטי הנכס', en_title: 'Sending the property details',
    he: 'היי {name}, הנה הפרטים[[ על {property}]]: תמונות, מפרט ומחיר. בא לכם לראות במקום?',
    en: 'Hi {name}, here are the details[[ on {property}]]: photos, specifications and price. Would you like to see it in person?' },
  { id: 'visit_offer', cat: 'progress', he_title: 'הצעה לביקור בנכס', en_title: 'Offering a viewing',
    he: 'היי {name}, את {property} עדיף לראות במקום. מתאים לכם השבוע, בבוקר או אחר הצהריים?',
    en: 'Hi {name}, {property} is best seen in person. Would a visit this week suit you, morning or afternoon?' },
  { id: 'visit_directions', cat: 'progress', he_title: 'הגעה לביקור – פרטים', en_title: 'Viewing – how to get there',
    he: 'היי {name}, לקראת הביקור[[ ב{property}]]: מצרפים כתובת ומקום מפגש.\nמתעכבים? {phone}',
    en: 'Hi {name}, ahead of the visit[[ to {property}]], here\'s the address and our meeting point.\nRunning late? {phone}' },
  { id: 'after_visit', cat: 'progress', he_title: 'אחרי ביקור – מה התרשמת?', en_title: 'After the viewing – your impression',
    he: 'היי {name}, תודה שבאתם לראות את {property}! מה התרשמתם?',
    en: 'Hi {name}, thank you for coming to see {property}! What were your impressions?' },
  { id: 'financing', cat: 'progress', he_title: 'מימון ומשכנתא', en_title: 'Financing and mortgage',
    he: 'היי {name}, כדאי לסגור מימון מוקדם. לחבר אתכם ליועץ משכנתאות? בלי התחייבות.',
    en: 'Hi {name}, it\'s worth arranging financing early. Shall we connect you with a mortgage adviser? No obligation.' },
  { id: 'similar_props', cat: 'progress', he_title: 'נכסים דומים שעשויים להתאים', en_title: 'Similar properties that may fit',
    he: 'היי {name}, יש לנו עוד כמה נכסים[[ בכיוון של {needs}]]. לשלוח לכם?',
    en: 'Hi {name}, we have a few more properties[[ in line with {needs}]]. Would you like us to send them?' },
  { id: 'price_update', cat: 'progress', he_title: 'עדכון מחיר / תנאים', en_title: 'Price or terms update',
    he: 'היי {name}, המחיר והתנאים[[ ב{property}]] השתנו. עדיין מעניין אתכם?',
    en: 'Hi {name}, the price and terms[[ for {property}]] have been updated. Is it still of interest?' },
  { id: 'call_back_later', cat: 'general', he_title: 'לא זמין כרגע – נחזור אליך', en_title: 'Busy right now – will call back',
    he: 'היי {name}, ראינו, תודה! אנחנו בפגישה כרגע, נחזור אליכם עוד היום.',
    en: 'Hi {name}, thanks for your message! We\'re in a meeting right now and will get back to you later today.' },
  { id: 'office_hours', cat: 'general', he_title: 'שעות פעילות ודרכי קשר', en_title: 'Office hours and contact',
    he: 'היי {name}, אנחנו במשרד א׳-ה׳ 9-19, ובשישי עד 13. בוואטסאפ תמיד, ובטלפון: {phone}',
    en: 'Hi {name}, our office is open Sunday to Thursday, 9:00 to 19:00, and Friday until 13:00. You can WhatsApp us anytime or call {phone}.' },
  { id: 'new_listing', cat: 'general', he_title: 'נכס חדש שעשוי להתאים', en_title: 'A new listing that may fit',
    he: 'היי {name}, נכנס היום נכס שישר חשבנו עליכם[[ ({needs})]]. עוד לא פורסם, לשלוח פרטים?',
    en: 'Hi {name}, a property came in today and we immediately thought of you[[ ({needs})]]. It hasn\'t been advertised yet, would you like the details?' },
  { id: 'seller_valuation', cat: 'general', he_title: 'בעל נכס – הערכת שווי', en_title: 'Owner – property valuation',
    he: 'היי {name}, נשמח לתת לכם הערכת שווי אמיתית לפי עסקאות באזור, בלי עלות:\n{sellLink}',
    en: 'Hi {name}, we\'d be happy to give you a realistic valuation based on recent sales in the area, free of charge:\n{sellLink}' },
  { id: 'nr_weekend', cat: 'followup', he_title: 'לא ענה – אחרי סוף השבוע', en_title: 'No reply – after the weekend',
    he: 'היי {name}, שבוע טוב! יש מצב לשיחה קצרה[[ על {property}]] מחר בבוקר?',
    en: 'Hi {name}, we hope you had a good weekend! Would a short call[[ about {property}]] tomorrow morning work for you?' },
  { id: 'deal_next_steps', cat: 'deal', he_title: 'לקראת חתימה – הצעדים הבאים', en_title: 'Before signing – next steps',
    he: 'היי {name}, מכאן: נסח טאבו ומסמכים, עורכי דין, ואז חתימה. אנחנו איתכם בכל שלב.',
    en: 'Hi {name}, next: the Tabu extract and documents, the lawyers, then signing. We\'re with you all the way.' },
  { id: 'deal_docs', cat: 'deal', he_title: 'מסמכים לחוזה', en_title: 'Documents for the contract',
    he: 'היי {name}, לחוזה נצטרך צילום ת"ז ופרטי עורך הדין שלכם. אפשר לשלוח לכאן.',
    en: 'Hi {name}, for the contract we\'ll need a copy of your ID and your lawyer\'s details. You can send them here.' },
  { id: 'deal_keys', cat: 'deal', he_title: 'מסירת מפתח', en_title: 'Handing over the keys',
    he: 'מזל טוב {name}!! המפתח[[ ל{property}]] אצלכם. תודה על האמון, ואנחנו כאן גם אחרי.',
    en: 'Congratulations[[, {name}]]! The keys[[ to {property}]] are yours. Thank you for your trust, and we\'re always here if you need us.' },
  { id: 'review_request', cat: 'deal', he_title: 'בקשת חוות דעת', en_title: 'Asking for a review',
    he: 'היי {name}, היה כיף ללוות אתכם! כמה מילים על אפיק הנחל בגוגל יעזרו לנו מאוד. תודה!',
    en: 'Hi {name}, it was a pleasure working with you! A short Google review of Afik Hanahal would help us a great deal. Thank you!' },
  { id: 'referral', cat: 'deal', he_title: 'בקשת המלצה / הפניה', en_title: 'Asking for a referral',
    he: 'היי {name}, מכירים מישהו שמחפש לקנות, למכור או להשכיר בשרון? נשמח לעזור.',
    en: 'Hi {name}, do you know anyone looking to buy, sell or rent in the Sharon region? We\'d be happy to help them.' },
  { id: 'thanks_short', cat: 'general', he_title: 'תודה – קצר', en_title: 'Thank you – short',
    he: 'תודה {name}, קיבלנו! נחזור אליכם עם עדכון.',
    en: 'Thank you[[, {name}]], received! We\'ll get back to you with an update.' },
]

export const DEFAULT_CONFIG = {
  version: 1,
  enabled: true,
  // Automations only act on leads / replies / stage changes that happen after this moment,
  // so switching the system on never messages the whole historical list.
  installedAt: '2026-09-23T00:00:00.000Z',
  vars: { agent: 'צוות אפיק הנחל', en_agent: 'The Afik Hanahal team', phone: '055-981-1814', site: 'https://www.afikhanahal.co.il', sellLink: 'https://www.afikhanahal.co.il/newproperty', bookingLink: 'https://www.afikhanahal.co.il/book' },
  // Scheduled messages (follow-ups, re-engagement) only go out inside these hours, Israel time.
  // Day 0 = Sunday. Saturday is closed.
  quiet: { enabled: true, days: { 0: [9, 20], 1: [9, 20], 2: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 13], 6: null } },
  templates: {},           // { [id]: { he, en, he_title, en_title, cat } } overrides + custom templates
  deletedTemplates: [],
  rules: {
    // mode: 'off' | 'suggest' (waits in the approval queue) | 'auto' (sent by the system)
    welcome: { mode: 'auto', templateId: 'welcome', propTemplateId: 'welcome_prop' },
    noReply: { mode: 'suggest', stages: ['new', 'contacted'], steps: [
      { hours: 24, templateId: 'nr1' },
      { hours: 48, templateId: 'nr2' },
      { hours: 96, templateId: 'nr3' },
    ] },
    replies: {
      mode: 'auto',               // detect replies, notify the team, stop follow-ups
      notifyTeam: true,
      negative: ['לא תודה', 'לא מעוניין', 'לא מעוניינת', 'לא רלוונטי', 'כבר לא רלוונטי', 'תסירו', 'הסר', 'הסירו', 'להסיר', 'אל תשלחו', 'תפסיקו', 'כבר קניתי', 'כבר מצאתי', 'סגרתי כבר', 'no thanks', 'not interested', 'stop', 'unsubscribe', 'remove me'],
      positive: ['מעוניין', 'מעוניינת', 'אשמח', 'כן', 'בטח', 'בשמחה', 'רוצה לראות', 'מתי אפשר', 'אפשר לתאם', 'לתאם', 'תתקשרו', 'תתקשר', 'תחזרו אליי', 'להתקדם', 'לקבוע', 'פגישה', 'סיור', 'yes', 'interested', 'call me', 'schedule', 'lets talk', "let's talk"],
      negativeMode: 'suggest', negativeTemplateId: 'closing_polite', negativeMoveTo: '',
      positiveMode: 'suggest', positiveTemplateId: 'positive', positiveMoveTo: '',
    },
    stage: {
      contacted:   { mode: 'off',     templateId: 'missed_call' },
      discovery:   { mode: 'off',     templateId: 'int_checkin' },
      meeting:     { mode: 'off',     templateId: 'meeting_confirm' },
      negotiating: { mode: 'off',     templateId: 'negotiation' },
      won:         { mode: 'suggest', templateId: 'won_thanks' },
      lost:        { mode: 'off',     templateId: 'closing_polite' },
      irrelevant:  { mode: 'off',     templateId: 'closing_polite' },
      nurture:     { mode: 'off',     templateId: 'reengage' },
    },
    reengage: { mode: 'suggest', days: 45, templateId: 'reengage' },
  },
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v)
function deepMerge(base, over) {
  if (!isObj(over)) return base
  const out = { ...base }
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : v
  return out
}
export function mergeConfig(saved) {
  return deepMerge(DEFAULT_CONFIG, isObj(saved) ? saved : {})
}

// Full template list: built-ins with the office's edits applied, plus custom ones
export function templateList(cfg) {
  const over = cfg?.templates || {}
  const gone = new Set(cfg?.deletedTemplates || [])
  const base = DEFAULT_TEMPLATES.filter(t => !gone.has(t.id)).map(t => ({ ...t, ...(over[t.id] || {}), builtIn: true }))
  const custom = Object.entries(over).filter(([id]) => !DEFAULT_TEMPLATES.some(t => t.id === id) && !gone.has(id)).map(([id, t]) => ({ id, cat: 'general', ...t, builtIn: false }))
  return [...base, ...custom]
}
export function getTemplate(cfg, id) {
  return templateList(cfg).find(t => t.id === id) || null
}

export function intlPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('972')) return d
  if (d.startsWith('0')) return '972' + d.slice(1)
  return d
}

// Lead language: the English site stores origin.lang = 'en'
export function leadLang(lead) {
  const l = lead?.crm_data?.origin?.lang || lead?.origin?.lang || lead?.lang || ''
  return String(l).toLowerCase().startsWith('en') ? 'en' : 'he'
}

// What {property} says for a lead. A Meta lead's "property" is its ad campaign (else its lead form), sent by its short
// name: "זרובבל 15 - v2 (כוונה גבוהה)" → "זרובבל 15". A website lead keeps the listing title it asked about.
export function leadProperty(lead = {}) {
  const crm = lead.crm_data && typeof lead.crm_data === 'object' ? lead.crm_data : {}
  const prop = String(lead.prop_title || lead.propTitle || '').trim()
  const camp = [lead.campaignName, lead.campaign_name, crm.campaignName, lead.formName, lead.form_name, crm.formName]
    .map(x => String(x ?? '').trim()).find(Boolean) || ''
  const meta = lead.source === 'meta' || !!crm.metaLeadId || (crm.origin || lead.origin)?.channel === 'meta'
  if (meta || (!prop && camp)) return shortCampaign(prop && prop !== 'Meta' ? prop : camp)
  return prop
}

// A template's picture (an https URL in the template's `image`, uploaded from the template editor), sent as a WhatsApp
// image with the text as its caption. '' = text only
export const isImageUrl = u => typeof u === 'string' && u.length <= 1000 && /^https:\/\/[^\s"'<>]+$/i.test(u.trim())
export const templateImage = tpl => (tpl && isImageUrl(tpl.image) ? tpl.image.trim() : '')

// Which welcome a lead gets: the project / listing one when we know what they asked about (a Meta lead's campaign counts),
// else the general one
export function welcomeTemplateId(cfg, lead = {}) {
  const r = cfg?.rules?.welcome || {}
  const pick = leadProperty(lead) && r.propTemplateId && getTemplate(cfg, r.propTemplateId) ? r.propTemplateId : r.templateId
  return pick || 'welcome'
}

// "בוקר טוב" / "צהריים טובים" / "ערב טוב" by the hour in Israel (rendered at send time, so a scheduled message still fits)
export function timeGreeting(lang = 'he', now = new Date()) {
  const h = israelNow(now).hour
  const he = lang !== 'en'
  if (h >= 5 && h < 12) return he ? 'בוקר טוב' : 'Good morning'
  if (h >= 12 && h < 17) return he ? 'צהריים טובים' : 'Good afternoon'
  if (h >= 17 && h < 23) return he ? 'ערב טוב' : 'Good evening'
  return he ? 'היי' : 'Hi'
}

// When the lead left their details, in words a person would use: "היום" / "אתמול" / "ביום שלישי" ('' after a week)
const DAYS = { he: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] }
export function leadWhen(lead = {}, lang = 'he', now = new Date()) {
  const raw = lead.created_at || lead.createdAt || lead.ts || lead.crm_data?.createdAt
  const at = typeof raw === 'number' ? raw : Date.parse(raw || '')
  if (!Number.isFinite(at) || at > now.getTime() + 60000) return ''
  const day = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(d)
  const days = Math.round((Date.parse(day(now)) - Date.parse(day(new Date(at)))) / 864e5)
  const he = lang !== 'en'
  if (days === 0) return he ? 'היום' : 'today'
  if (days === 1) return he ? 'אתמול' : 'yesterday'
  if (days < 7) { const wd = DAYS[he ? 'he' : 'en'][israelNow(new Date(at)).day]; return he ? `ביום ${wd}` : `on ${wd}` }
  return ''
}
// Where they left them: a Meta lead form ("במודעה") or the website ("באתר"); '' when we don't know
export function leadWhere(lead = {}, lang = 'he') {
  const crm = lead.crm_data && typeof lead.crm_data === 'object' ? lead.crm_data : {}
  const origin = crm.origin || lead.origin || {}
  const src = String(lead.source || '')
  const he = lang !== 'en'
  if (src === 'meta' || crm.metaLeadId || origin.channel === 'meta') return he ? 'במודעה' : 'on our ad'
  if (/^(website|contact_form|page_)/.test(src) || origin.page) return he ? 'באתר' : 'on our website'
  return ''
}

// Fill a template for one lead. Missing values collapse gracefully ("ב{property}" → "בנכס").
// opts.highlight wraps every filled-in value in \uE000…\uE001 (the editor preview underlines them); opts.keys → \uE000key\uE002value\uE001
export function renderTemplate(tpl, lead = {}, cfg = DEFAULT_CONFIG, forceLang, opts = {}) {
  if (!tpl) return ''
  const lang = forceLang || leadLang(lead)
  const text = (lang === 'en' ? (tpl.en || tpl.he) : (tpl.he || tpl.en)) || ''
  let fullName = String(lead.name || '').split(' · ')[0].trim()
  // the name is saved in Hebrew ("רונן כהן"); an English message uses it the way the lead typed it ("Ronen Cohen"), else
  // the Hebrew first name written in English ("Ronen"), else no name at all (lib/english-values.js)
  const typed = String(lead.crm_data?.originalName || lead.originalName || '').trim()
  if (lang === 'en' && hasHebrew(fullName)) fullName = isLatinName(typed) ? typed : englishFirstName(fullName, typed)
  // the first name, also when the surname was typed first ("ליבוביץ סופי" → "סופי", lib/hebrew-names.js givenName)
  let first = givenName(fullName) || ''
  // A Hebrew message never greets "שלום Ronen": a known name is written in Hebrew, an unknown Latin one is left out
  if (lang !== 'en' && isLatinName(first)) {
    const he = hebrewFirstName(first)
    first = he
    fullName = he
  }
  const v = cfg?.vars || {}
  const prop = lang === 'en' ? englishProject(leadProperty(lead)) : leadProperty(lead)   // "זרובבל 15" → "15 Zerubavel Street"
  const need = leadNeeds(lead, lang)
  const values = {
    name: first || (lang === 'en' ? 'there' : ''),
    fullName: fullName || first,
    property: prop || (lang === 'en' ? 'the property' : 'הנכס'),
    location: (lang === 'en' ? englishTown(lead.prop_location || lead.propLocation) : (lead.prop_location || lead.propLocation)) || (lang === 'en' ? 'the Sharon region' : 'השרון'),
    agent: lang === 'en' ? (v.en_agent || v.agent || '') : (v.agent || ''),
    greeting: timeGreeting(lang, opts.now),
    when: leadWhen(lead, lang, opts.now || new Date()),
    where: leadWhere(lead, lang),
    phone: v.phone || '',
    site: v.site || '',
    sellLink: v.sellLink || '',
    bookingLink: (v.bookingLink || 'https://www.afikhanahal.co.il/book') + (lang === 'en' ? '?lang=en' : ''),
    needs: need.needs, budget: need.budget, rooms: need.rooms, area: need.area, timeline: need.timeline, purpose: need.purpose, message: need.message,
  }
  // [[ … ]] = a part that is kept only when every placeholder in it has a real value (not a fallback like "הנכס")
  const real = { ...values, name: first, fullName, property: prop }
  return text
    .replace(/\[\[([\s\S]*?)\]\]/g, (m, inner) => ([...inner.matchAll(/\{(\w+)\}/g)].every(x => !(x[1] in real) || String(real[x[1]] || '').trim()) ? inner : ''))
    // a fallback after a Hebrew prefix letter drops its ה: "ב{property}" → "בנכס", not "בהנכס"
    .replace(/([בלכ]?)\{(\w+)\}/g, (m, pre, k) => {
      if (!(k in values)) return m
      let val = values[k]
      if (pre && val && val !== real[k] && val.startsWith('ה')) val = val.slice(1)
      // opts.keys also names the placeholder (\uE000key\uE002value\uE001), so an edited text can be turned back into a template
      return pre + (opts.keys && val ? `\uE000${k}\uE002${val}\uE001` : opts.highlight && val ? `\uE000${val}\uE001` : val)
    })
    // an empty placeholder leaves "שלום ," / "העדכון, ." behind: close the gap
    .replace(/[ \t]+([,.!?])/g, '$1').replace(/,([.!?])/g, '$1').replace(/ {2,}/g, ' ').trim()
}

// Placeholders in a text that the renderer does not know (they would be sent as typed)
export function unknownPlaceholders(text) {
  const known = new Set(VARIABLES.map(v => v.key))
  return [...new Set([...String(text || '').matchAll(/\{(\w+)\}/g)].map(m => m[1]).filter(k => !known.has(k)))]
}

// ── Quiet hours (Israel time) ──────────────────────────────────────────────────
export function israelNow(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(d).map(p => [p.type, p.value]))
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  return { day, hour: Number(parts.hour) + Number(parts.minute) / 60 }
}
export function isSendWindow(cfg, d = new Date()) {
  if (!cfg?.quiet?.enabled) return true
  const { day, hour } = israelNow(d)
  const w = cfg.quiet.days?.[day]
  return Array.isArray(w) && hour >= w[0] && hour < w[1]
}

// First moment at or after `from` that is inside the sending hours (null when every day is closed).
// Scans in 15-minute steps for up to 8 days — cheap, and correct across DST changes.
export function nextSendWindow(cfg, from = new Date()) {
  if (!cfg?.quiet?.enabled) return new Date(from)
  const days = cfg.quiet.days || {}
  if (![0, 1, 2, 3, 4, 5, 6].some(d => Array.isArray(days[d]) && days[d][1] > days[d][0])) return null
  let t = new Date(from).getTime()
  if (isSendWindow(cfg, new Date(t))) return new Date(t)
  t = Math.ceil(t / 900000) * 900000
  for (let i = 0; i < 8 * 96; i++, t += 900000) if (isSendWindow(cfg, new Date(t))) return new Date(t)
  return null
}

// 9.5 → "09:30"
export const fmtHour = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` }

// Today's status and the next `count` sending windows, Israel time
export function nextWindows(cfg, now = new Date(), count = 3) {
  if (!cfg?.quiet?.enabled) return { open: true, unlimited: true, windows: [] }
  const days = cfg.quiet.days || {}
  const { day, hour } = israelNow(now)
  const windows = []
  let open = false, closesAt = null
  for (let i = 0; i < 8 && windows.length < count; i++) {
    const d = (day + i) % 7, w = days[d]
    if (!Array.isArray(w) || !(w[1] > w[0])) continue
    if (i === 0 && hour >= w[1]) continue
    if (i === 0 && hour >= w[0]) { open = true; closesAt = w[1] }
    windows.push({ offset: i, day: d, start: w[0], end: w[1], current: i === 0 && hour >= w[0] })
  }
  return { open, closesAt, windows }
}

// Point every rule that uses template `fromId` at `toId` (used before deleting a template)
export function replaceTemplateRefs(cfg, fromId, toId) {
  const R = cfg.rules || {}
  if (R.welcome?.templateId === fromId) R.welcome.templateId = toId
  if (R.welcome?.propTemplateId === fromId) R.welcome.propTemplateId = toId
  ;(R.noReply?.steps || []).forEach(st => { if (st.templateId === fromId) st.templateId = toId })
  if (R.replies?.positiveTemplateId === fromId) R.replies.positiveTemplateId = toId
  if (R.replies?.negativeTemplateId === fromId) R.replies.negativeTemplateId = toId
  Object.values(R.stage || {}).forEach(r => { if (r?.templateId === fromId) r.templateId = toId })
  if (R.reengage?.templateId === fromId) R.reengage.templateId = toId
  return cfg
}

// Which keyword decided the intent (for the reply tester)
export function matchedKeyword(text, cfg = DEFAULT_CONFIG) {
  const t = norm(text), r = cfg?.rules?.replies || DEFAULT_CONFIG.rules.replies
  for (const list of [r.negative, r.positive]) for (const k of list || []) { const n = norm(k); if (n.trim() && t.includes(n)) return k }
  return null
}

// Where a template is used (so the office sees the impact of editing or deleting it)
export function templateUsage(cfg, id) {
  const R = cfg?.rules || {}
  const out = []
  if (R.welcome?.templateId === id) out.push({ key: 'welcome', rule: 'welcome', mode: R.welcome.mode, he: 'הודעת פתיחה', en: 'Welcome message' })
  if (R.welcome?.propTemplateId === id) out.push({ key: 'welcome_prop', rule: 'welcome', mode: R.welcome.mode, he: 'הודעת פתיחה – התעניין בנכס', en: 'Welcome – asked about a property' })
  ;(R.noReply?.steps || []).forEach((st, i) => { if (st.templateId === id) out.push({ key: `noreply:${i + 1}`, rule: 'noReply', mode: R.noReply.mode, he: `לא ענה – תזכורת ${i + 1}`, en: `No reply – reminder ${i + 1}` }) })
  if (R.replies?.positiveTemplateId === id) out.push({ key: 'reply:positive', rule: 'replies', mode: R.replies.mode === 'off' ? 'off' : R.replies.positiveMode, he: 'רוצה להתקדם', en: 'Wants to move forward' })
  if (R.replies?.negativeTemplateId === id) out.push({ key: 'reply:negative', rule: 'replies', mode: R.replies.mode === 'off' ? 'off' : R.replies.negativeMode, he: 'ענה "לא תודה"', en: 'Replied "no thanks"' })
  Object.entries(R.stage || {}).forEach(([st, r]) => { if (r?.templateId === id) out.push({ key: `stage:${st}`, rule: 'stage', mode: r.mode, he: `שינוי שלב – ${st}`, en: `Stage change – ${st}`, stage: st }) })
  if (R.reengage?.templateId === id) out.push({ key: 'reengage', rule: 'reengage', mode: R.reengage.mode, he: 'חזרה ללקוח', en: 'Re-engagement' })
  return out
}

// ── Reply intent ───────────────────────────────────────────────────────────────
const norm = s => ' ' + String(s || '').toLowerCase().replace(/[^\p{L}\p{N}']+/gu, ' ').replace(/\s+/g, ' ').trim() + ' '
export function classifyReply(text, cfg = DEFAULT_CONFIG) {
  const t = norm(text)
  if (t.trim() === '') return null
  const r = cfg?.rules?.replies || DEFAULT_CONFIG.rules.replies
  const has = list => (list || []).some(k => { const n = norm(k); return n.trim() && t.includes(n) })
  if (has(r.negative)) return 'negative'     // "לא, תודה" wins over "תודה"
  if (has(r.positive)) return 'positive'
  return 'reply'
}

export const RULE_LABELS = {
  welcome:  { he: 'הודעת פתיחה לליד חדש', en: 'Welcome message to a new lead' },
  noreply:  { he: 'מעקב – לא ענה', en: 'Follow-up – no reply' },
  positive: { he: 'ענה בחיוב – רוצה להתקדם', en: 'Positive reply – wants to move forward' },
  negative: { he: 'ענה "לא תודה"', en: 'Replied "no thanks"' },
  stage:    { he: 'שינוי שלב בלוח', en: 'Board stage change' },
  reengage: { he: 'חזרה ללקוח אחרי תקופה', en: 'Re-engagement after a while' },
  manual:   { he: 'שליחה ידנית', en: 'Manual send' },
  test:     { he: 'הודעת בדיקה', en: 'Test message' },
}
export function ruleKind(ruleKey) {
  return String(ruleKey || '').split(':')[0]
}
