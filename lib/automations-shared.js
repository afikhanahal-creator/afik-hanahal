// ── WhatsApp automations: shared, pure logic (only the pure src/lib/leadFields.js) ─────────────────────────
// Imported by the server engine (lib/automations.js) AND by the admin panel (src/AutomationsTab.jsx,
// src/GreenAPIChat.jsx), so templates, placeholders, quiet hours and reply detection behave the same
// in the browser preview and in the message that is actually sent.
//
// Every template has a Hebrew text and an English text: a lead who came from the English site
// (crm_data.origin.lang === 'en') gets the English version.

import { shortCampaign } from '../src/lib/leadFields.js'
import { hebrewFirstName, isLatinName } from './hebrew-names.js'
import { leadNeeds } from './lead-needs.js'

export const STAGES = ['new', 'contacted', 'discovery', 'negotiating', 'won', 'lost', 'irrelevant', 'nurture']

// Placeholders the office can use in any template
export const VARIABLES = [
  { key: 'name',     he: 'שם פרטי',          en: 'First name' },
  { key: 'fullName', he: 'שם מלא',           en: 'Full name' },
  { key: 'property', he: 'הנכס שהתעניין בו', en: 'Property of interest' },
  { key: 'location', he: 'מיקום הנכס',       en: 'Property location' },
  { key: 'agent',    he: 'שם הנציג',         en: 'Agent name' },
  { key: 'phone',    he: 'טלפון המשרד',      en: 'Office phone' },
  { key: 'site',     he: 'אתר',              en: 'Website' },
  { key: 'sellLink', he: 'קישור לטופס נכס',  en: 'Property form link' },
  // what the lead told us (lib/lead-needs.js) — empty when unknown; wrap a sentence in [[ … ]] to drop it then
  { key: 'needs',    he: 'מה הוא מחפש (חדרים, אזור, תקציב)', en: 'What they look for (rooms, area, budget)' },
  { key: 'budget',   he: 'תקציב',            en: 'Budget' },
  { key: 'rooms',    he: 'חדרים',            en: 'Rooms' },
  { key: 'area',     he: 'אזור מבוקש',       en: 'Preferred area' },
  { key: 'timeline', he: 'מתי מתכנן לעבור',  en: 'When they plan to move' },
  { key: 'purpose',  he: 'מטרה (מגורים / השקעה)', en: 'Purpose (home / investment)' },
  { key: 'message',  he: 'מה שכתב בפנייה',   en: 'What they wrote' },
]

export const CATEGORIES = [
  { id: 'welcome',  he: 'פנייה חדשה',     en: 'New inquiry',    color: '#22C55E', icon: '👋' },
  { id: 'followup', he: 'לא ענה',         en: 'No reply',       color: '#F5A623', icon: '⏰' },
  { id: 'progress', he: 'רוצה להתקדם',    en: 'Moving forward', color: '#0073EA', icon: '🚀' },
  { id: 'closing',  he: 'לא מעוניין',     en: 'Not interested', color: '#7D7D7D', icon: '🙏' },
  { id: 'deal',     he: 'עסקה וסגירה',    en: 'Deal & closing', color: '#A25DDC', icon: '🤝' },
  { id: 'personal', he: 'אישי – לפי הפנייה', en: 'Personal – from the inquiry', color: '#0E9AA7', icon: '✍️' },
  { id: 'general',  he: 'כללי',           en: 'General',        color: '#8490D8', icon: '💬' },
]

// Built-in library. The office can edit any of them (edits are saved in the settings) or add new ones.
export const DEFAULT_TEMPLATES = [
  { id: 'welcome', cat: 'welcome', he_title: 'פתיחה – ליד חדש', en_title: 'Welcome – new lead',
    he: 'שלום {name},\nתודה שפנית לאפיק הנחל, קיבלנו את הפרטים שלך.\nנשמח לתאם שיחה קצרה כדי להבין מה חשוב לך ולשלוח מידע מותאם.\nמתי נוח לך שנדבר?\n\n{agent}',
    en: 'Hello {name},\nThank you for contacting Afik Hanahal. We have received your details.\nWe would be glad to set up a short call to understand what matters to you and send you tailored information.\nWhen would be a good time to talk?\n\n{agent}' },
  { id: 'welcome_prop', cat: 'welcome', he_title: 'פתיחה – התעניין בנכס', en_title: 'Welcome – asked about a property',
    he: 'שלום {name},\nתודה על ההתעניינות ב{property}.\nנשמח לשלוח לך את כל הפרטים – תוכניות, מחירים ולוחות זמנים – ולענות על כל שאלה.\nמתי נוח לך לשיחה קצרה?\n\n{agent}',
    en: 'Hello {name},\nThank you for your interest in {property}.\nWe would be glad to send you the full details – plans, prices and timelines – and answer any question.\nWhen would suit you for a short call?\n\n{agent}' },
  { id: 'welcome_short', cat: 'welcome', he_title: 'פתיחה – קצר ולעניין', en_title: 'Welcome – short and to the point',
    he: 'שלום {name}, קיבלנו את פנייתך לגבי {property}.\nמתי נוח לך שנחזור אליך לשיחה קצרה?\n\n{agent}',
    en: 'Hello {name}, we received your inquiry about {property}.\nWhen would suit you for a short call back?\n\n{agent}' },
  { id: 'welcome_slots', cat: 'welcome', he_title: 'פתיחה – בחירת זמן לשיחה', en_title: 'Welcome – pick a time for a call',
    he: 'שלום {name},\nתודה על פנייתך לגבי {property}.\nכדי לתאם שיחה קצרה, מה מתאים לך?\n1. היום אחר הצהריים\n2. מחר בבוקר\n3. מחר אחר הצהריים\nאפשר להשיב במספר בלבד.\n\n{agent}',
    en: 'Hello {name},\nThank you for your inquiry about {property}.\nTo arrange a short call, what suits you best?\n1. This afternoon\n2. Tomorrow morning\n3. Tomorrow afternoon\nJust reply with the number.\n\n{agent}' },
  { id: 'welcome_personal', cat: 'welcome', he_title: 'פתיחה – אישי מהנציג', en_title: 'Welcome – a personal note from the agent',
    he: 'שלום {name},\nכאן {agent}. ראיתי את ההתעניינות שלך ב{property}, ואשמח לעבור איתך על הפרטים מקרוב: המחיר, המצב התכנוני והצעדים הבאים.\nמתי נוח לך שנדבר?',
    en: 'Hello {name},\nThis is {agent}. I saw your interest in {property} and would be glad to go over the details with you: the price, the planning status and the next steps.\nWhen would be a good time to talk?' },
  { id: 'welcome_questions', cat: 'welcome', he_title: 'פתיחה – שאלות היכרות', en_title: 'Welcome – a few qualifying questions',
    he: 'שלום {name}, תודה על ההתעניינות ב{property}.\nכדי שנכין עבורך מידע מדויק, נשמח לדעת:\n• מהו טווח התקציב?\n• מדובר במגורים או בהשקעה?\n• מתי נוח לך לשיחה קצרה?\n\n{agent}',
    en: 'Hello {name}, thank you for your interest in {property}.\nSo we can prepare accurate information for you, it would help to know:\n• What is your budget range?\n• Is it to live in or an investment?\n• When would suit you for a short call?\n\n{agent}' },
  { id: 'welcome_callnow', cat: 'welcome', he_title: 'פתיחה – שיחה עכשיו?', en_title: 'Welcome – a call right now?',
    he: 'שלום {name}, תודה שהשארת פרטים לגבי {property}.\nאנחנו זמינים לשיחה כבר עכשיו. נוח לך שנתקשר?\nאפשר להשיב "כן" ונחזור אליך בדקות הקרובות.\n\n{agent}',
    en: 'Hello {name}, thank you for leaving your details about {property}.\nWe are available to talk right now. Shall we call you?\nJust reply "yes" and we will call you within a few minutes.\n\n{agent}' },
  { id: 'welcome_brochure', cat: 'welcome', he_title: 'פתיחה – שליחת חוברת פרטים', en_title: 'Welcome – send the details pack',
    he: 'שלום {name},\nתודה על פנייתך לגבי {property}.\nנשמח לשלוח לך כאן את חוברת הפרטים המלאה, כולל תוכניות ומחירים, ולאחר מכן לתאם שיחה קצרה לשאלות.\nלשלוח?\n\n{agent}',
    en: 'Hello {name},\nThank you for your inquiry about {property}.\nWe would be glad to send you the full details pack here, including plans and prices, and then arrange a short call for any questions.\nShall we send it?\n\n{agent}' },
  { id: 'welcome_late', cat: 'welcome', he_title: 'פתיחה באיחור – התנצלות על העיכוב', en_title: 'Late welcome – apologising for the delay',
    he: 'שלום {name},\nמתנצלים על העיכוב בתשובה. ראינו את פנייתך לגבי {property} ונשמח לחזור אליך.\nמתי נוח לך לשיחה קצרה?\n\n{agent}',
    en: 'Hello {name},\nOur apologies for the delayed reply. We saw your inquiry about {property} and would be glad to get back to you.\nWhen would suit you for a short call?\n\n{agent}' },
  { id: 'welcome_late_check', cat: 'welcome', he_title: 'פתיחה באיחור – עדיין רלוונטי?', en_title: 'Late welcome – still relevant?',
    he: 'שלום {name},\nחוזרים אליך בעניין פנייתך לגבי {property}, ותודה על הסבלנות.\nהנושא עדיין רלוונטי עבורך? נשמח לתאם שיחה בזמן שנוח לך.\n\n{agent}',
    en: 'Hello {name},\nWe are getting back to you about your inquiry on {property} – thank you for your patience.\nIs it still relevant for you? We would be glad to arrange a call whenever suits you.\n\n{agent}' },
  { id: 'welcome_investor', cat: 'welcome', he_title: 'פתיחה – משקיעים וקרקעות', en_title: 'Welcome – investors and land',
    he: 'שלום {name}, תודה על ההתעניינות ב{property}.\nנשמח לעבור איתך על הנתונים החשובים למשקיע: מצב תכנוני, רישום בטאבו, לוחות זמנים צפויים ופוטנציאל התשואה.\nמתי נוח לך לשיחה של כ-10 דקות?\n\n{agent}',
    en: 'Hello {name}, thank you for your interest in {property}.\nWe would be glad to go over the figures that matter to an investor: planning status, Tabu registration, expected timelines and return potential.\nWhen would suit you for a 10-minute call?\n\n{agent}' },
  { id: 'after_hours', cat: 'welcome', he_title: 'מחוץ לשעות הפעילות', en_title: 'Outside office hours',
    he: 'שלום {name}, תודה שפנית לאפיק הנחל.\nקיבלנו את הודעתך ונחזור אליך מחר בשעות הבוקר.\nלעניין דחוף: {phone}\n\n{agent}',
    en: 'Hello {name}, thank you for contacting Afik Hanahal.\nWe have received your message and will get back to you tomorrow morning.\nFor anything urgent: {phone}\n\n{agent}' },
  { id: 'nr1', cat: 'followup', he_title: 'לא ענה – תזכורת ראשונה', en_title: 'No reply – first reminder',
    he: 'שלום {name},\nרצינו לוודא שההודעה שלנו הגיעה אליך.\nנשמח לעזור בכל שאלה לגבי {property}. מתי נוח לך לדבר?',
    en: 'Hello {name},\nWe wanted to make sure our message reached you.\nWe are happy to help with any question about {property}. When would be a good time to talk?' },
  { id: 'nr2', cat: 'followup', he_title: 'לא ענה – ערך נוסף', en_title: 'No reply – added value',
    he: 'שלום {name},\nנכנסו אלינו לאחרונה כמה הזדמנויות בשרון שטרם פורסמו.\nאם זה רלוונטי עבורך, נשמח לשלוח סקירה קצרה. אפשר פשוט להשיב "כן".',
    en: 'Hello {name},\nA few opportunities in the Sharon region have come in recently and are not published yet.\nIf it is relevant for you, we would be glad to send a short overview. Just reply "yes".' },
  { id: 'nr3', cat: 'followup', he_title: 'לא ענה – פנייה אחרונה', en_title: 'No reply – last message',
    he: 'שלום {name},\nלא נרצה להטריד. נשמור את הפרטים שלך, וכשתרצו לחזור לנושא – אנחנו כאן: {phone}\nבהצלחה,\n{agent}',
    en: 'Hello {name},\nWe do not want to trouble you. We will keep your details, and whenever you wish to pick this up again we are here: {phone}\nAll the best,\n{agent}' },
  { id: 'missed_call', cat: 'followup', he_title: 'ניסינו להתקשר', en_title: 'We tried to call',
    he: 'שלום {name}, ניסינו להשיג אותך בטלפון ולא הצלחנו.\nמתי יהיה נוח לך שנדבר?',
    en: 'Hello {name}, we tried to reach you by phone.\nWhen would be a convenient time to talk?' },
  { id: 'nr_short', cat: 'followup', he_title: 'לא ענה – תזכורת קצרה', en_title: 'No reply – short reminder',
    he: 'שלום {name}, האם מצאת זמן לשיחה קצרה לגבי {property}?',
    en: 'Hello {name}, have you found a moment for a short call about {property}?' },
  { id: 'nr_channel', cat: 'followup', he_title: 'לא ענה – טלפון או וואטסאפ?', en_title: 'No reply – phone or WhatsApp?',
    he: 'שלום {name},\nמה נוח לך יותר: שיחת טלפון קצרה, או שנשלח את כל הפרטים לגבי {property} כאן בוואטסאפ?',
    en: 'Hello {name},\nWhat suits you better: a short phone call, or shall we send all the details about {property} here on WhatsApp?' },
  { id: 'nr_relevant', cat: 'followup', he_title: 'לא ענה – עדיין רלוונטי?', en_title: 'No reply – still relevant?',
    he: 'שלום {name}, שאלה קצרה: {property} עדיין רלוונטי עבורך?\nאפשר להשיב "כן" או "לא", ונכבד כל תשובה.',
    en: 'Hello {name}, a quick question: is {property} still relevant for you?\nJust reply "yes" or "no" – we will respect either answer.' },
  { id: 'nr_scarcity', cat: 'followup', he_title: 'לא ענה – עדכון זמינות', en_title: 'No reply – availability update',
    he: 'שלום {name},\nעדכון קצר: יש התעניינות ערה ב{property}, ומספר האפשרויות הפנויות מצטמצם.\nנשמח לשלוח לך מה עדיין זמין כרגע.',
    en: 'Hello {name},\nA quick update: there is strong interest in {property}, and fewer options remain available.\nWe would be glad to send you what is still available.' },
  { id: 'nr_times', cat: 'followup', he_title: 'לא ענה – הצעת זמנים', en_title: 'No reply – suggested times',
    he: 'שלום {name},\nאנחנו יודעים שהזמן יקר. מה דעתך על שיחה של 5 דקות מחר בבוקר או מחר אחר הצהריים? נשמח לדעת מה מתאים.',
    en: 'Hello {name},\nWe know your time is valuable. How about a 5-minute call tomorrow morning or tomorrow afternoon? Just let us know what works.' },
  { id: 'positive', cat: 'progress', he_title: 'רוצה להתקדם – תיאום שיחה', en_title: 'Moving forward – book a call',
    he: 'מצוין {name}, תודה.\nנשמח לקבוע שיחה או סיור בשטח. איזה יום ושעה נוחים לך השבוע?',
    en: 'Excellent, {name}, thank you.\nWe would be glad to arrange a call or a site visit. Which day and time suit you this week?' },
  { id: 'meeting_confirm', cat: 'progress', he_title: 'אישור פגישה', en_title: 'Meeting confirmation',
    he: 'שלום {name}, מאשרים את הפגישה שלנו.\nאם משהו משתנה, אפשר לכתוב כאן בכל עת.\nנתראה,\n{agent}',
    en: 'Hello {name}, confirming our meeting.\nIf anything changes, feel free to write here at any time.\nSee you then,\n{agent}' },
  { id: 'docs', cat: 'progress', he_title: 'מסמכים להמשך', en_title: 'Documents for the next step',
    he: 'שלום {name}, כדי להתקדם נצטרך את המסמכים הבאים:\n• צילום תעודת זהות\n• נסח טאבו (אם יש)\n• אישור עקרוני למשכנתא (אם רלוונטי)\nאפשר לשלוח אותם כאן בוואטסאפ.',
    en: 'Hello {name}, to move forward we will need the following documents:\n• A copy of your ID\n• A Tabu registration extract (if available)\n• Mortgage pre-approval (if relevant)\nYou can send them right here on WhatsApp.' },
  { id: 'negotiation', cat: 'progress', he_title: 'במו"מ – עדכון', en_title: 'Negotiation – update',
    he: 'שלום {name}, עדכון קצר: אנחנו מתקדמים מול הצד השני לגבי {property}.\nנעדכן אותך ברגע שתהיה תשובה.',
    en: 'Hello {name}, a quick update: we are moving forward with the other side regarding {property}.\nWe will let you know as soon as there is an answer.' },
  { id: 'visit_slots', cat: 'progress', he_title: 'תיאום סיור – בחירת זמן', en_title: 'Book a visit – pick a time',
    he: 'מצוין {name}, נשמח לתאם סיור ב{property}.\nמה נוח לך?\n1. מחר בבוקר\n2. מחר אחר הצהריים\n3. יום שישי בבוקר\nאפשר להשיב במספר.',
    en: 'Excellent, {name}, we would be glad to arrange a visit to {property}.\nWhat suits you?\n1. Tomorrow morning\n2. Tomorrow afternoon\n3. Friday morning\nJust reply with the number.' },
  { id: 'meeting_reminder', cat: 'progress', he_title: 'תזכורת לפגישה', en_title: 'Meeting reminder',
    he: 'שלום {name}, תזכורת לפגישה שלנו היום בעניין {property}.\nאם משהו השתנה, אפשר לכתוב כאן.',
    en: 'Hello {name}, a reminder of our meeting today about {property}.\nIf anything has changed, just write here.' },
  { id: 'after_call', cat: 'progress', he_title: 'אחרי שיחה – סיכום', en_title: 'After the call – summary',
    he: 'שלום {name}, תודה על השיחה.\nכפי שסיכמנו, מצורפים הפרטים לגבי {property}.\nלכל שאלה נוספת – אנחנו כאן.\n\n{agent}',
    en: 'Hello {name}, thank you for the call.\nAs agreed, here are the details about {property}.\nFor any further question, we are here.\n\n{agent}' },
  { id: 'closing_polite', cat: 'closing', he_title: 'לא מעוניין – סגירה מכבדת', en_title: 'Not interested – a courteous close',
    he: 'תודה על העדכון, {name}.\nלא נשלח הודעות נוספות.\nאם בעתיד תחפשו נכס או קרקע בשרון, נשמח לעמוד לרשותכם.',
    en: 'Thank you for letting us know, {name}.\nWe will not send further messages.\nIf you ever look for a property or land in the Sharon region, we would be glad to help.' },
  { id: 'reengage', cat: 'closing', he_title: 'חזרה ללקוח אחרי תקופה', en_title: 'Re-engage after a while',
    he: 'שלום {name}, עבר זמן מאז שדיברנו.\nעדיין מחפשים נכס? נכנסו אלינו כמה נכסים חדשים שעשויים להתאים לך.',
    en: 'Hello {name}, it has been a while since we spoke.\nStill looking for a property? A few new listings have come in that could suit you.' },
  { id: 'nurture_checkin', cat: 'closing', he_title: 'לחזור בהמשך – בדיקת מצב', en_title: 'Later – checking in',
    he: 'שלום {name}, עבר זמן מה מאז שדיברנו.\nרצינו לבדוק אם חל שינוי בתוכניות שלך, ולעדכן אותך במה שחדש בשרון.\nמתי נוח לך לשיחה קצרה?',
    en: 'Hello {name}, it has been a little while since we spoke.\nWe wanted to check whether your plans have changed, and update you on what is new in the Sharon region.\nWhen would suit you for a short call?' },
  { id: 'reengage_new', cat: 'closing', he_title: 'חזרה – נכסים חדשים', en_title: 'Re-engage – new listings',
    he: 'שלום {name},\nנכנסו אלינו כמה נכסים חדשים בשרון שטרם פורסמו.\nנשמח לשלוח לך את אלה שמתאימים למה שחיפשת.',
    en: 'Hello {name},\nA few new properties in the Sharon region have come in and are not published yet.\nWe would be glad to send you the ones that match what you were looking for.' },
  { id: 'won_thanks', cat: 'deal', he_title: 'אחרי סגירה – תודה', en_title: 'After closing – thank you',
    he: 'מזל טוב {name}!\nתודה שבחרת באפיק הנחל, היה לנו כבוד ללוות אותך.\nאם תרצו לשתף את החוויה, זה יעזור לנו מאוד.',
    en: 'Congratulations, {name}!\nThank you for choosing Afik Hanahal – it was an honour to be with you all the way.\nIf you would like to share your experience, it would help us a great deal.' },
  { id: 'personal_needs', cat: 'personal', he_title: 'אישי – לפי מה שהוא מחפש', en_title: 'Personal – what they are looking for',
    he: 'שלום {name},\nתודה על פנייתך לגבי {property}.[[\nראינו שאתם מחפשים {needs}.]]\nיש לנו כמה אפשרויות שמתאימות בדיוק לזה, ונשמח לעבור עליהן איתך בשיחה קצרה.\nמתי נוח לך?\n\n{agent}',
    en: 'Hello {name},\nThank you for your inquiry about {property}.[[\nWe saw you are looking for {needs}.]]\nWe have a few options that match exactly that, and would be glad to go over them with you in a short call.\nWhen would suit you?\n\n{agent}' },
  { id: 'personal_budget', cat: 'personal', he_title: 'אישי – לפי התקציב', en_title: 'Personal – by budget',
    he: 'שלום {name},\nתודה על ההתעניינות ב{property}.\n[[ראינו שציינת תקציב של {budget}. ]]נשמח להציג לך את האפשרויות שמתאימות לך ביותר, כולל תוכניות, מחירים ותנאי תשלום.\nמתי נוח לך לשיחה קצרה?\n\n{agent}',
    en: 'Hello {name},\nThank you for your interest in {property}.\n[[We saw your budget is {budget}. ]]We would be glad to present the options that suit you best, including plans, prices and payment terms.\nWhen would suit you for a short call?\n\n{agent}' },
  { id: 'personal_message', cat: 'personal', he_title: 'אישי – מתייחס למה שכתב', en_title: 'Personal – answers what they wrote',
    he: 'שלום {name},\nקיבלנו את פנייתך[[: "{message}"]].\nנשמח לחזור אליך עם תשובה מסודרת, ולתאם שיחה קצרה כדי לוודא שהבנו בדיוק מה חשוב לך.\nמתי נוח לך?\n\n{agent}',
    en: 'Hello {name},\nWe received your message[[: "{message}"]].\nWe would be glad to come back to you with a full answer, and to arrange a short call to make sure we understood exactly what matters to you.\nWhen would suit you?\n\n{agent}' },
  { id: 'personal_investor', cat: 'personal', he_title: 'אישי – משקיע', en_title: 'Personal – investor',
    he: 'שלום {name},\nתודה על ההתעניינות ב{property}.[[ ראינו שהמטרה היא {purpose}.]]\nנשמח לשלוח לך סקירה קצרה עם הנתונים החשובים: מחיר, מצב תכנוני, רישום בטאבו ופוטנציאל התשואה[[, בהתאם לתקציב של {budget}]].\nמתי נוח לך לשיחה של כ-10 דקות?\n\n{agent}',
    en: 'Hello {name},\nThank you for your interest in {property}.[[ We saw the goal is {purpose}.]]\nWe would be glad to send you a short overview of the figures that matter: price, planning status, Tabu registration and return potential[[, in line with a budget of {budget}]].\nWhen would suit you for a 10-minute call?\n\n{agent}' },
  { id: 'personal_timeline', cat: 'personal', he_title: 'אישי – לפי לוח הזמנים', en_title: 'Personal – by timeline',
    he: 'שלום {name},\nתודה על פנייתך לגבי {property}.\n[[ראינו שאתם מתכננים מעבר {timeline}, ויש לנו כמה אפשרויות שמתאימות ללוח הזמנים הזה. ]]נשמח לעבור עליהן איתך ולבנות יחד את הצעדים הבאים.\nמתי נוח לך לשיחה קצרה?\n\n{agent}',
    en: 'Hello {name},\nThank you for your inquiry about {property}.\n[[We saw you plan to move {timeline}, and we have a few options that fit that timeline. ]]We would be glad to go over them with you and plan the next steps together.\nWhen would suit you for a short call?\n\n{agent}' },
  { id: 'personal_followup', cat: 'personal', he_title: 'אישי – מעקב לפי מה שביקש', en_title: 'Personal – follow-up on their request',
    he: 'שלום {name},\nחוזרים אליך בעניין {property}[[ – {needs}]].\nבינתיים עברנו על האפשרויות, ויש לנו כמה הצעות שכדאי שתכיר. נוח לך שנדבר השבוע?\n\n{agent}',
    en: 'Hello {name},\nWe are getting back to you about {property}[[ – {needs}]].\nIn the meantime we went through the options, and have a few you should see. Would a call this week suit you?\n\n{agent}' },
  { id: 'seller_invite', cat: 'general', he_title: 'בעל נכס – טופס קליטה', en_title: 'Owner – intake form',
    he: 'שלום {name}, כדי שנוכל לשווק את הנכס שלך בצורה המיטבית, אפשר למלא כאן את כל הפרטים והתמונות (כ-5 דקות):\n{sellLink}',
    en: 'Hello {name}, so we can market your property in the best way, you can fill in all the details and photos here (about 5 minutes):\n{sellLink}' },
  { id: 'holiday', cat: 'general', he_title: 'ברכת חג', en_title: 'Holiday greeting',
    he: 'חג שמח {name},\nמאחלים לך ולמשפחתך שנה של בית, צמיחה ושקט.\n\n{agent}',
    en: 'Happy holidays, {name},\nWishing you and your family a year of home, growth and peace.\n\n{agent}' },
  // ── chat-ready replies (the WhatsApp page's template picker) ──
  { id: 'send_details', cat: 'progress', he_title: 'שליחת פרטי הנכס', en_title: 'Sending the property details',
    he: 'שלום {name},\nכפי שביקשת, מצורפים הפרטים המלאים על {property}: תמונות, מפרט, מחיר ותנאים.\nאשמח לענות על כל שאלה ולתאם ביקור כשנוח לך.\n\n{agent}',
    en: 'Hello {name},\nAs requested, here are the full details of {property}: photos, specifications, price and terms.\nI will be glad to answer any question and arrange a viewing whenever suits you.\n\n{agent}' },
  { id: 'visit_offer', cat: 'progress', he_title: 'הצעה לביקור בנכס', en_title: 'Offering a viewing',
    he: 'שלום {name},\nהכי טוב להתרשם מ{property} במקום.\nיש לנו זמינות השבוע בבוקר ואחר הצהריים. איזה יום ושעה נוחים לך?\n\n{agent}',
    en: 'Hello {name},\nThe best way to get a feel for {property} is on site.\nWe have availability this week, mornings and afternoons. Which day and time suit you?\n\n{agent}' },
  { id: 'visit_directions', cat: 'progress', he_title: 'הגעה לביקור – פרטים', en_title: 'Viewing – how to get there',
    he: 'שלום {name},\nלקראת הביקור ב{property}: אשלח כאן את הכתובת המדויקת ונקודת המפגש. אם משהו משתנה או שיש עיכוב, אפשר לעדכן אותי כאן או בטלפון {phone}.\nנתראה,\n{agent}',
    en: 'Hello {name},\nAhead of the viewing of {property}: I will send the exact address and meeting point here. If anything changes or you are running late, let me know here or at {phone}.\nSee you soon,\n{agent}' },
  { id: 'after_visit', cat: 'progress', he_title: 'אחרי ביקור – מה התרשמת?', en_title: 'After the viewing – your impression',
    he: 'שלום {name},\nתודה שהגעת לראות את {property}.\nאשמח לשמוע מה התרשמת ואם יש שאלות פתוחות – על המחיר, התנאים או לוחות הזמנים.\n\n{agent}',
    en: 'Hello {name},\nThank you for coming to see {property}.\nI would be glad to hear your impression and whether any questions remain – on price, terms or timing.\n\n{agent}' },
  { id: 'financing', cat: 'progress', he_title: 'מימון ומשכנתא', en_title: 'Financing and mortgage',
    he: 'שלום {name},\nכדי להתקדם בביטחון, כדאי לבדוק מראש את המימון.\nנשמח לחבר אותך ליועץ משכנתאות שאנחנו עובדים איתו, ללא התחייבות. האם זה רלוונטי עבורך?\n\n{agent}',
    en: 'Hello {name},\nTo move forward with confidence, it is worth checking the financing in advance.\nWe would be glad to connect you with a mortgage adviser we work with, with no obligation. Would that be relevant for you?\n\n{agent}' },
  { id: 'similar_props', cat: 'progress', he_title: 'נכסים דומים שעשויים להתאים', en_title: 'Similar properties that may fit',
    he: 'שלום {name},\nבהמשך לפנייה שלך, יש לנו כמה נכסים נוספים באותו סגנון[[ – {needs}]].\nלשלוח לך פרטים?\n\n{agent}',
    en: 'Hello {name},\nFollowing your inquiry, we have a few more properties in the same spirit[[ – {needs}]].\nShall I send you the details?\n\n{agent}' },
  { id: 'price_update', cat: 'progress', he_title: 'עדכון מחיר / תנאים', en_title: 'Price or terms update',
    he: 'שלום {name},\nרצינו לעדכן שחל שינוי במחיר ובתנאים של {property}.\nאם הנכס עדיין מעניין אותך, זה זמן טוב לדבר. מתי נוח לך?\n\n{agent}',
    en: 'Hello {name},\nWe wanted to let you know that the price and terms of {property} have changed.\nIf the property is still of interest, this is a good time to talk. When suits you?\n\n{agent}' },
  { id: 'call_back_later', cat: 'general', he_title: 'לא זמין כרגע – נחזור אליך', en_title: 'Busy right now – will call back',
    he: 'שלום {name},\nקיבלתי את ההודעה, תודה. אני בפגישה כרגע ואחזור אליך בהקדם, עוד היום.\n\n{agent}',
    en: 'Hello {name},\nI received your message, thank you. I am in a meeting right now and will get back to you shortly, today.\n\n{agent}' },
  { id: 'office_hours', cat: 'general', he_title: 'שעות פעילות ודרכי קשר', en_title: 'Office hours and contact',
    he: 'שלום {name},\nאנחנו זמינים בימים א׳–ה׳ בין 9:00 ל-19:00 ובימי ו׳ עד 13:00.\nאפשר לכתוב כאן בכל שעה או להתקשר ל-{phone}. פרטים נוספים באתר: {site}\n\n{agent}',
    en: 'Hello {name},\nWe are available Sunday to Thursday, 9:00–19:00, and on Fridays until 13:00.\nYou can write here at any time or call {phone}. More details on our website: {site}\n\n{agent}' },
  { id: 'new_listing', cat: 'general', he_title: 'נכס חדש שעשוי להתאים', en_title: 'A new listing that may fit',
    he: 'שלום {name},\nנכנס אלינו נכס חדש שחשבנו עליך כשראינו אותו[[ – {needs}]].\nהוא עוד לא פורסם בכל מקום. לשלוח פרטים?\n\n{agent}',
    en: 'Hello {name},\nA new property has just come in, and we thought of you when we saw it[[ – {needs}]].\nIt is not yet advertised everywhere. Shall I send the details?\n\n{agent}' },
  { id: 'seller_valuation', cat: 'general', he_title: 'בעל נכס – הערכת שווי', en_title: 'Owner – property valuation',
    he: 'שלום {name},\nנשמח לתת לך הערכת שווי מקצועית לנכס, ללא עלות וללא התחייבות, על סמך עסקאות אחרונות באזור.\nאפשר להתחיל במילוי קצר של פרטי הנכס: {sellLink}\n\n{agent}',
    en: 'Hello {name},\nWe would be glad to give you a professional valuation of your property, free and with no obligation, based on recent deals in the area.\nYou can start with a short form about the property: {sellLink}\n\n{agent}' },
  { id: 'nr_weekend', cat: 'followup', he_title: 'לא ענה – אחרי סוף השבוע', en_title: 'No reply – after the weekend',
    he: 'שלום {name},\nמקווים שהיה סוף שבוע טוב.\nרצינו לחזור לפנייה שלך[[ לגבי {property}]] – האם נוח לך לשיחה קצרה השבוע?\n\n{agent}',
    en: 'Hello {name},\nWe hope you had a good weekend.\nWe wanted to come back to your inquiry[[ about {property}]] – would a short call this week suit you?\n\n{agent}' },
  { id: 'deal_next_steps', cat: 'deal', he_title: 'לקראת חתימה – הצעדים הבאים', en_title: 'Before signing – next steps',
    he: 'שלום {name},\nלקראת החתימה, אלה הצעדים הבאים:\n1. בדיקת נסח טאבו ומסמכי הנכס\n2. העברת פרטים לעורכי הדין של שני הצדדים\n3. תיאום מועד לחתימה\nאני מלווה אותך בכל שלב. לכל שאלה – אני כאן.\n\n{agent}',
    en: 'Hello {name},\nAhead of the signing, here are the next steps:\n1. Checking the Tabu registration extract and the property documents\n2. Passing the details to both sides\' lawyers\n3. Setting a date for the signing\nI will be with you at every stage. For any question – I am here.\n\n{agent}' },
  { id: 'deal_docs', cat: 'deal', he_title: 'מסמכים לחוזה', en_title: 'Documents for the contract',
    he: 'שלום {name},\nכדי להכין את החוזה נצטרך: צילום תעודת זהות, פרטי עורך הדין שלך ואישור עקרוני למשכנתא אם יש.\nאפשר לשלוח כאן, הכול נשמר בצורה מאובטחת.\n\n{agent}',
    en: 'Hello {name},\nTo prepare the contract we will need: a copy of your ID, your lawyer\'s details and a mortgage approval in principle, if any.\nYou can send them here; everything is kept securely.\n\n{agent}' },
  { id: 'deal_keys', cat: 'deal', he_title: 'מסירת מפתח', en_title: 'Handing over the keys',
    he: 'שלום {name},\nמזל טוב! הגיע היום – מסירת המפתח ל{property}.\nתודה על האמון לאורך כל הדרך. אנחנו כאן גם אחרי המסירה, לכל דבר שיידרש.\n\n{agent}',
    en: 'Hello {name},\nCongratulations! The day has come – the keys to {property} are yours.\nThank you for your trust all along the way. We are here after the handover too, for anything you may need.\n\n{agent}' },
  { id: 'review_request', cat: 'deal', he_title: 'בקשת חוות דעת', en_title: 'Asking for a review',
    he: 'שלום {name},\nשמחנו ללוות אותך. אם היית מרוצה מהשירות, נודה לך על כמה מילים בגוגל – זה עוזר למשפחות נוספות למצוא אותנו.\nתודה רבה,\n{agent}',
    en: 'Hello {name},\nIt was a pleasure to accompany you. If you were happy with our service, a few words on Google would mean a lot – it helps other families find us.\nThank you very much,\n{agent}' },
  { id: 'referral', cat: 'deal', he_title: 'בקשת המלצה / הפניה', en_title: 'Asking for a referral',
    he: 'שלום {name},\nאם מישהו מהסביבה שלך מחפש לקנות, למכור או להשכיר נכס בשרון – נשמח לעזור גם לו, באותה מסירות.\nתודה על האמון,\n{agent}',
    en: 'Hello {name},\nIf anyone you know is looking to buy, sell or rent a property in the Sharon region, we would be glad to help them too, with the same care.\nThank you for your trust,\n{agent}' },
  { id: 'thanks_short', cat: 'general', he_title: 'תודה – קצר', en_title: 'Thank you – short',
    he: 'תודה רבה {name}, קיבלתי. אחזור אליך עם עדכון בהקדם.\n{agent}',
    en: 'Thank you very much, {name}, received. I will get back to you with an update shortly.\n{agent}' },
]

export const DEFAULT_CONFIG = {
  version: 1,
  enabled: true,
  // Automations only act on leads / replies / stage changes that happen after this moment,
  // so switching the system on never messages the whole historical list.
  installedAt: '2026-09-23T00:00:00.000Z',
  vars: { agent: 'צוות אפיק הנחל', en_agent: 'The Afik Hanahal team', phone: '055-981-1814', site: 'https://www.afikhanahal.co.il', sellLink: 'https://www.afikhanahal.co.il/newproperty' },
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
      discovery:   { mode: 'off',     templateId: 'docs' },
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

// Fill a template for one lead. Missing values collapse gracefully ("ב{property}" → "בנכס").
// opts.highlight wraps every filled-in value in \uE000…\uE001 (the editor preview underlines them)
export function renderTemplate(tpl, lead = {}, cfg = DEFAULT_CONFIG, forceLang, opts = {}) {
  if (!tpl) return ''
  const lang = forceLang || leadLang(lead)
  const text = (lang === 'en' ? (tpl.en || tpl.he) : (tpl.he || tpl.en)) || ''
  let fullName = String(lead.name || '').trim()
  let first = fullName.split(/\s+/)[0] || ''
  // A Hebrew message never greets "שלום Ronen": a known name is written in Hebrew, an unknown Latin one is left out
  if (lang !== 'en' && isLatinName(first)) {
    const he = hebrewFirstName(first)
    first = he
    fullName = he
  }
  const v = cfg?.vars || {}
  const prop = leadProperty(lead)
  const need = leadNeeds(lead, lang)
  const values = {
    name: first || (lang === 'en' ? 'there' : ''),
    fullName: fullName || first,
    property: prop || (lang === 'en' ? 'the property' : 'הנכס'),
    location: lead.prop_location || lead.propLocation || (lang === 'en' ? 'the Sharon region' : 'השרון'),
    agent: lang === 'en' ? (v.en_agent || v.agent || '') : (v.agent || ''),
    phone: v.phone || '',
    site: v.site || '',
    sellLink: v.sellLink || '',
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
      return pre + (opts.highlight && val ? `\uE000${val}\uE001` : val)
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
