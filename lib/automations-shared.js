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
  { key: 'greeting', he: 'ברכה לפי השעה (בוקר טוב / ערב טוב)', en: 'Greeting by time of day' },
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
    he: '{greeting} {name}[[, כאן {agent} מאפיק הנחל]].\nקיבלתי את הפרטים שהשארת[[ לגבי {property}]]. אשמח לדבר כמה דקות, להבין מה מחפשים ולשלוח לך רק את מה שבאמת רלוונטי.\nמתי נוח שאתקשר?',
    en: '{greeting}[[ {name}]][[, it\'s {agent} from Afik Hanahal]].\nI got the details you left[[ about {property}]]. I\'d love a quick chat to understand what you\'re after, so I only send you what\'s actually relevant.\nWhen\'s a good time to call?' },
  { id: 'welcome_prop', cat: 'welcome', he_title: 'פתיחה – התעניין בנכס', en_title: 'Welcome – asked about a property',
    he: 'היי {name}[[, כאן {agent} מאפיק הנחל]].\nראיתי שהתעניינת ב{property}. יש לי את כל הפרטים – תוכניות, מחיר ולוחות זמנים.\nלשלוח לך כאן, או שעדיף שיחה קצרה ואסביר?',
    en: 'Hi {name}[[, it\'s {agent} from Afik Hanahal]].\nI saw you were interested in {property}. I have all the details – plans, price and timelines.\nShall I send them here, or would a quick call be easier?' },
  { id: 'welcome_short', cat: 'welcome', he_title: 'פתיחה – קצר ולעניין', en_title: 'Welcome – short and to the point',
    he: 'היי {name}[[, {agent} מאפיק הנחל]]. ראיתי את הפנייה על {property}.\nמתי נוח שאתקשר לכמה דקות?',
    en: 'Hi {name}[[, {agent} from Afik Hanahal here]]. Saw your inquiry about {property}.\nWhen\'s a good time for a quick call?' },
  { id: 'welcome_slots', cat: 'welcome', he_title: 'פתיחה – בחירת זמן לשיחה', en_title: 'Welcome – pick a time for a call',
    he: 'היי {name}[[, כאן {agent} מאפיק הנחל]].\nקיבלתי את הפנייה על {property}. כדי לא לתפוס אותך בזמן לא נוח – מה מתאים לשיחה קצרה?\n1. היום אחה"צ\n2. מחר בבוקר\n3. מחר אחה"צ\nמספיק לענות במספר.',
    en: 'Hi {name}[[, it\'s {agent} from Afik Hanahal]].\nGot your inquiry about {property}. So I don\'t catch you at a bad moment – what works for a short call?\n1. This afternoon\n2. Tomorrow morning\n3. Tomorrow afternoon\nJust reply with the number.' },
  { id: 'welcome_personal', cat: 'welcome', he_title: 'פתיחה – אישי מהנציג', en_title: 'Welcome – a personal note from the agent',
    he: '{greeting} {name}[[, כאן {agent} מאפיק הנחל]].\nעברתי על הפנייה שלך על {property} ורציתי לדבר איתך אישית – יש כמה דברים על המחיר והמצב התכנוני שקל יותר להסביר בשיחה מאשר בהודעה.\nמתי נוח לך?',
    en: '{greeting}[[ {name}]][[, it\'s {agent} from Afik Hanahal]].\nI went through your inquiry about {property} and wanted to speak with you personally – a few things about the price and the planning status are easier to explain on a call than in a message.\nWhen suits you?' },
  { id: 'welcome_questions', cat: 'welcome', he_title: 'פתיחה – שאלות היכרות', en_title: 'Welcome – a few qualifying questions',
    he: 'היי {name}[[, כאן {agent} מאפיק הנחל]].\nתודה שפנית לגבי {property}. כדי שלא אשלח לך סתם ערימת חומר, שלוש שאלות קצרות:\n• בערך באיזה תקציב מדובר?\n• זה למגורים או להשקעה?\n• מתי נוח לדבר?',
    en: 'Hi {name}[[, it\'s {agent} from Afik Hanahal]].\nThanks for asking about {property}. So I don\'t just send you a pile of material, three quick questions:\n• Roughly what budget are we talking about?\n• Is it a home or an investment?\n• When\'s a good time to talk?' },
  { id: 'welcome_callnow', cat: 'welcome', he_title: 'פתיחה – שיחה עכשיו?', en_title: 'Welcome – a call right now?',
    he: 'היי {name}[[, כאן {agent} מאפיק הנחל]].\nראיתי עכשיו את הפרטים שהשארת על {property}. יש לי כמה דקות פנויות ממש עכשיו – נוח שאתקשר?\nאם כן, מספיק לכתוב "כן".',
    en: 'Hi {name}[[, it\'s {agent} from Afik Hanahal]].\nI\'ve just seen the details you left about {property}. I have a few minutes free right now – OK if I call?\nIf so, just reply "yes".' },
  { id: 'welcome_brochure', cat: 'welcome', he_title: 'פתיחה – שליחת חוברת פרטים', en_title: 'Welcome – send the details pack',
    he: 'היי {name}[[, כאן {agent} מאפיק הנחל]].\nלגבי {property} – יש לי חוברת מסודרת עם התוכניות והמחירים. לשלוח לך אותה כאן?\nואם אחרי זה עולות שאלות, נדבר.',
    en: 'Hi {name}[[, it\'s {agent} from Afik Hanahal]].\nAbout {property} – I have a proper brochure with the plans and prices. Shall I send it here?\nIf any questions come up afterwards, we\'ll talk.' },
  { id: 'welcome_late', cat: 'welcome', he_title: 'פתיחה באיחור – התנצלות על העיכוב', en_title: 'Late welcome – apologising for the delay',
    he: 'היי {name}, סליחה שלקח לי זמן לחזור אליך.\nראיתי את הפנייה על {property} ואשמח לעזור. מתי נוח לדבר כמה דקות?[[\n{agent}, אפיק הנחל]]',
    en: 'Hi {name}, sorry it took me a while to get back to you.\nI saw your inquiry about {property} and I\'d be glad to help. When\'s a good time for a short chat?[[\n{agent}, Afik Hanahal]]' },
  { id: 'welcome_late_check', cat: 'welcome', he_title: 'פתיחה באיחור – עדיין רלוונטי?', en_title: 'Late welcome – still relevant?',
    he: 'היי {name}, רציתי לחזור אליך לגבי {property} – ותודה על הסבלנות.\nזה עדיין רלוונטי? אם כן, נמצא זמן שנוח לך לשיחה.[[\n{agent}, אפיק הנחל]]',
    en: 'Hi {name}, I wanted to get back to you about {property} – and thanks for your patience.\nIs it still relevant? If so, let\'s find a time that suits you for a call.[[\n{agent}, Afik Hanahal]]' },
  { id: 'welcome_investor', cat: 'welcome', he_title: 'פתיחה – משקיעים וקרקעות', en_title: 'Welcome – investors and land',
    he: 'היי {name}[[, כאן {agent} מאפיק הנחל]].\nראיתי שהתעניינת ב{property}. בהשקעה כזאת יש ארבעה דברים שחשוב לבדוק: מצב תכנוני, רישום בטאבו, לוחות זמנים והתשואה הצפויה.\nאשמח לעבור עליהם איתך בשיחה של 10 דקות. מתי מתאים?',
    en: 'Hi {name}[[, it\'s {agent} from Afik Hanahal]].\nI saw you were interested in {property}. With an investment like this there are four things worth checking: planning status, Tabu registration, timelines and the expected return.\nHappy to go through them with you in a 10-minute call. When works?' },
  { id: 'after_hours', cat: 'welcome', he_title: 'מחוץ לשעות הפעילות', en_title: 'Outside office hours',
    he: 'היי {name}, קיבלתי את ההודעה, תודה.\nכבר אחרי שעות העבודה, אז אחזור אליך מחר בבוקר. אם זה דחוף – {phone}.[[\n{agent}, אפיק הנחל]]',
    en: 'Hi {name}, got your message, thanks.\nIt\'s after hours here, so I\'ll get back to you tomorrow morning. If it\'s urgent – {phone}.[[\n{agent}, Afik Hanahal]]' },
  { id: 'nr1', cat: 'followup', he_title: 'לא ענה – תזכורת ראשונה', en_title: 'No reply – first reminder',
    he: 'היי {name}, רק רציתי לוודא שההודעה הקודמת שלי הגיעה אליך.\nאם יש שאלה על {property} – אני כאן. מתי נוח לדבר?',
    en: 'Hi {name}, just wanted to make sure my last message reached you.\nIf you have any question about {property}, I\'m here. When\'s a good time to talk?' },
  { id: 'nr2', cat: 'followup', he_title: 'לא ענה – ערך נוסף', en_title: 'No reply – added value',
    he: 'היי {name}, נכנסו אליי השבוע כמה נכסים בשרון שעוד לא פורסמו.\nאם זה עדיין רלוונטי, אשלח לך סקירה קצרה – מספיק לכתוב "כן".',
    en: 'Hi {name}, a few properties in the Sharon region came in this week that aren\'t published yet.\nIf it\'s still relevant, I\'ll send you a short overview – just reply "yes".' },
  { id: 'nr3', cat: 'followup', he_title: 'לא ענה – פנייה אחרונה', en_title: 'No reply – last message',
    he: 'היי {name}, אני לא אמשיך להציף אותך בהודעות.\nהפרטים שלך נשמרים אצלי, וכשיתאים לך לחזור לזה – אפשר פשוט לכתוב לי כאן או להתקשר ל-{phone}.\nבהצלחה בכל מקרה[[,\n{agent}]]',
    en: 'Hi {name}, I won\'t keep filling up your messages.\nI\'ve kept your details, and whenever it suits you to pick this up again, just write here or call {phone}.\nGood luck either way[[,\n{agent}]]' },
  { id: 'missed_call', cat: 'followup', he_title: 'ניסינו להתקשר', en_title: 'We tried to call',
    he: 'היי {name}, ניסיתי להתקשר אליך עכשיו ולא תפסתי אותך.\nמה נוח לך יותר – בבוקר או אחה"צ?',
    en: 'Hi {name}, I just tried calling but couldn\'t reach you.\nWhat\'s better for you – mornings or afternoons?' },
  { id: 'nr_short', cat: 'followup', he_title: 'לא ענה – תזכורת קצרה', en_title: 'No reply – short reminder',
    he: 'היי {name}, יצא לך לחשוב על {property}?',
    en: 'Hi {name}, had a chance to think about {property}?' },
  { id: 'nr_channel', cat: 'followup', he_title: 'לא ענה – טלפון או וואטסאפ?', en_title: 'No reply – phone or WhatsApp?',
    he: 'היי {name}, מה יותר נוח לך – שיחה קצרה בטלפון, או שאשלח את כל הפרטים על {property} כאן בוואטסאפ?',
    en: 'Hi {name}, what\'s easier for you – a quick phone call, or shall I send all the details on {property} here on WhatsApp?' },
  { id: 'nr_relevant', cat: 'followup', he_title: 'לא ענה – עדיין רלוונטי?', en_title: 'No reply – still relevant?',
    he: 'היי {name}, שאלה קצרה – {property} עדיין רלוונטי בשבילך?\nגם "לא" זו תשובה טובה, ככה אדע לא להטריד.',
    en: 'Hi {name}, quick question – is {property} still relevant for you?\n"No" is a perfectly good answer too – that way I\'ll know not to bother you.' },
  { id: 'nr_scarcity', cat: 'followup', he_title: 'לא ענה – עדכון זמינות', en_title: 'No reply – availability update',
    he: 'היי {name}, עדכון קטן לגבי {property}: היה השבוע הרבה עניין, ונשארו פחות אפשרויות פנויות.\nרוצה שאשלח לך מה עוד פתוח?',
    en: 'Hi {name}, a small update on {property}: there\'s been a lot of interest this week and fewer options are left.\nWant me to send you what\'s still open?' },
  { id: 'nr_times', cat: 'followup', he_title: 'לא ענה – הצעת זמנים', en_title: 'No reply – suggested times',
    he: 'היי {name}, ברור לי שהזמן לחוץ.\nמה דעתך על 5 דקות טלפון מחר – בבוקר או אחה"צ? מה שנוח לך.',
    en: 'Hi {name}, I know time is tight.\nHow about 5 minutes on the phone tomorrow – morning or afternoon? Whatever suits you.' },
  { id: 'positive', cat: 'progress', he_title: 'רוצה להתקדם – תיאום שיחה', en_title: 'Moving forward – book a call',
    he: 'מעולה {name}, תודה!\nאז בואו נקבע – שיחה או סיור בשטח, מה שנוח לך. איזה יום ושעה מתאימים השבוע?',
    en: 'Great[[, {name}]] – thanks!\nLet\'s set something up – a call or a site visit, whatever suits you. Which day and time work this week?' },
  { id: 'meeting_confirm', cat: 'progress', he_title: 'אישור פגישה', en_title: 'Meeting confirmation',
    he: 'היי {name}, סגרנו – נתראה בפגישה.\nאם משהו משתנה, אפשר לכתוב לי כאן בכל שלב.',
    en: 'Hi {name}, that\'s settled – see you at the meeting.\nIf anything changes, just message me here.' },
  { id: 'docs', cat: 'progress', he_title: 'מסמכים להמשך', en_title: 'Documents for the next step',
    he: 'היי {name}, כדי שנתקדם אצטרך ממך כמה מסמכים:\n• צילום ת"ז\n• נסח טאבו, אם יש\n• אישור עקרוני למשכנתא, אם רלוונטי\nאפשר פשוט לצלם ולשלוח כאן.',
    en: 'Hi {name}, to move ahead I\'ll need a few documents from you:\n• A copy of your ID\n• A Tabu registration extract, if you have one\n• A mortgage approval in principle, if relevant\nYou can just take a photo and send them here.' },
  { id: 'negotiation', cat: 'progress', he_title: 'במו"מ – עדכון', en_title: 'Negotiation – update',
    he: 'היי {name}, עדכון קצר: דיברתי עם הצד השני לגבי {property} ואנחנו מתקדמים.\nברגע שתהיה תשובה – אעדכן אותך.',
    en: 'Hi {name}, quick update: I spoke with the other side about {property} and we\'re making progress.\nAs soon as I have an answer, I\'ll let you know.' },
  { id: 'visit_slots', cat: 'progress', he_title: 'תיאום סיור – בחירת זמן', en_title: 'Book a visit – pick a time',
    he: 'מעולה {name}, בואו נקבע סיור ב{property}.\nמה נוח?\n1. מחר בבוקר\n2. מחר אחה"צ\n3. שישי בבוקר\nמספיק לענות במספר.',
    en: 'Great[[, {name}]] – let\'s book a visit to {property}.\nWhat suits you?\n1. Tomorrow morning\n2. Tomorrow afternoon\n3. Friday morning\nJust reply with the number.' },
  { id: 'meeting_reminder', cat: 'progress', he_title: 'תזכורת לפגישה', en_title: 'Meeting reminder',
    he: 'היי {name}, תזכורת קטנה – אנחנו נפגשים היום לגבי {property}.\nאם משהו השתנה, אפשר לכתוב לי כאן.',
    en: 'Hi {name}, a quick reminder – we\'re meeting today about {property}.\nIf anything\'s changed, just drop me a line here.' },
  { id: 'after_call', cat: 'progress', he_title: 'אחרי שיחה – סיכום', en_title: 'After the call – summary',
    he: 'היי {name}, תודה על השיחה, היה נעים לדבר.\nכמו שסיכמנו, הנה הפרטים על {property}.\nאם עולה עוד משהו – אני כאן.',
    en: 'Hi {name}, thanks for the call – it was good to talk.\nAs we agreed, here are the details on {property}.\nIf anything else comes up, I\'m here.' },
  { id: 'closing_polite', cat: 'closing', he_title: 'לא מעוניין – סגירה מכבדת', en_title: 'Not interested – a courteous close',
    he: '[[{name}, ]]תודה על העדכון ועל הכנות.\nלא אשלח יותר הודעות. אם בעתיד תחפשו נכס או קרקע בשרון – אני כאן.',
    en: 'Thanks for letting me know[[, {name}]] – I appreciate the honesty.\nI won\'t send any more messages. If you ever look for a property or land in the Sharon region, I\'m here.' },
  { id: 'reengage', cat: 'closing', he_title: 'חזרה ללקוח אחרי תקופה', en_title: 'Re-engage after a while',
    he: 'היי {name}, עבר קצת זמן מאז שדיברנו.\nעדיין מחפשים? נכנסו אליי כמה נכסים חדשים שנראה לי שיכולים להתאים לך.',
    en: 'Hi {name}, it\'s been a while since we spoke.\nStill looking? A few new properties have come in that I think could suit you.' },
  { id: 'nurture_checkin', cat: 'closing', he_title: 'לחזור בהמשך – בדיקת מצב', en_title: 'Later – checking in',
    he: '{greeting} {name}, מה שלומך?\nעבר זמן מאז שדיברנו ורציתי לשמוע אם משהו השתנה אצלך בתוכניות. יש גם כמה דברים חדשים בשרון ששווה לדעת עליהם.\nנדבר השבוע?',
    en: '{greeting}[[ {name}]], how are you?\nIt\'s been a while since we spoke and I wanted to hear whether your plans have changed. There are also a few new things in the Sharon region worth knowing about.\nShall we talk this week?' },
  { id: 'reengage_new', cat: 'closing', he_title: 'חזרה – נכסים חדשים', en_title: 'Re-engage – new listings',
    he: 'היי {name}, נכנסו אליי כמה נכסים בשרון שעוד לא פורסמו, וחלק מהם ממש בכיוון של מה שחיפשת.\nלשלוח לך את הרלוונטיים?',
    en: 'Hi {name}, a few properties in the Sharon region came in that aren\'t published yet, and some are right in line with what you were after.\nShall I send you the relevant ones?' },
  { id: 'won_thanks', cat: 'deal', he_title: 'אחרי סגירה – תודה', en_title: 'After closing – thank you',
    he: 'מזל טוב {name}!\nהיה לי באמת כיף ללוות אותך בדרך. אם בא לך לשתף איך היה, זה עוזר לי מאוד.',
    en: 'Congratulations[[, {name}]]!\nIt was a real pleasure to be with you along the way. If you feel like sharing how it went, it helps me a lot.' },
  { id: 'personal_needs', cat: 'personal', he_title: 'אישי – לפי מה שהוא מחפש', en_title: 'Personal – what they are looking for',
    he: 'היי {name}, תודה על הפנייה לגבי {property}.[[\nראיתי שאתם מחפשים {needs} – יש לי כמה אפשרויות שמתאימות בדיוק לזה.]]\nאשמח לעבור איתך על מה שיש בשיחה קצרה. מתי נוח?',
    en: 'Hi {name}, thanks for getting in touch about {property}.[[\nI saw you\'re looking for {needs} – I have a few options that fit exactly that.]]\nHappy to go through what\'s available with you on a short call. When suits you?' },
  { id: 'personal_budget', cat: 'personal', he_title: 'אישי – לפי התקציב', en_title: 'Personal – by budget',
    he: 'היי {name}, תודה על ההתעניינות ב{property}.\n[[ראיתי שציינת תקציב של {budget}. ]]אשמח להראות לך מה הכי מתאים – תוכניות, מחירים ותנאי תשלום.\nמתי נוח לדבר?',
    en: 'Hi {name}, thanks for your interest in {property}.\n[[I saw you mentioned a budget of {budget}. ]]I\'d be glad to show you what fits best – plans, prices and payment terms.\nWhen\'s good to talk?' },
  { id: 'personal_message', cat: 'personal', he_title: 'אישי – מתייחס למה שכתב', en_title: 'Personal – answers what they wrote',
    he: 'היי {name}, קראתי את מה שכתבת[[ – "{message}"]].\nכדי לתת לך תשובה מדויקת ולא כללית, אשמח לדבר כמה דקות. מתי נוח?',
    en: 'Hi {name}, I read what you wrote[[ – "{message}"]].\nTo give you a precise answer rather than a general one, I\'d like a few minutes on the phone. When suits you?' },
  { id: 'personal_investor', cat: 'personal', he_title: 'אישי – משקיע', en_title: 'Personal – investor',
    he: 'היי {name}, תודה על ההתעניינות ב{property}.[[ הבנתי שהמטרה היא {purpose}.]]\nאשלח לך סקירה קצרה עם מה שחשוב באמת: מחיר, מצב תכנוני, טאבו ופוטנציאל התשואה[[, ביחס לתקציב של {budget}]].\nויש מצב לשיחה של 10 דקות? מתי נוח?',
    en: 'Hi {name}, thanks for your interest in {property}.[[ I understand the goal is {purpose}.]]\nI\'ll send you a short overview of what really matters: price, planning status, Tabu registration and return potential[[, against a budget of {budget}]].\nAny chance of a 10-minute call? When suits you?' },
  { id: 'personal_timeline', cat: 'personal', he_title: 'אישי – לפי לוח הזמנים', en_title: 'Personal – by timeline',
    he: 'היי {name}, תודה על הפנייה לגבי {property}.\n[[ראיתי שאתם מתכננים לעבור {timeline}, ויש לי כמה אפשרויות שמתאימות בדיוק ללוח הזמנים הזה. ]]אשמח לשבת על זה איתך ולתכנן את הצעדים הבאים.\nמתי נוח לדבר?',
    en: 'Hi {name}, thanks for getting in touch about {property}.\n[[I saw you\'re planning to move {timeline}, and I have a few options that fit that timeline. ]]I\'d be glad to sit down with you and plan the next steps.\nWhen\'s good to talk?' },
  { id: 'personal_followup', cat: 'personal', he_title: 'אישי – מעקב לפי מה שביקש', en_title: 'Personal – follow-up on their request',
    he: 'היי {name}, חזרתי לפנייה שלך על {property}[[ – {needs}]].\nבינתיים עברתי על מה שיש, ומצאתי כמה דברים ששווה לך לראות. נדבר השבוע?',
    en: 'Hi {name}, I went back to your inquiry about {property}[[ – {needs}]].\nIn the meantime I went through what\'s out there and found a few things worth your while. Shall we talk this week?' },
  { id: 'seller_invite', cat: 'general', he_title: 'בעל נכס – טופס קליטה', en_title: 'Owner – intake form',
    he: 'היי {name}, כדי שאוכל לשווק את הנכס שלך כמו שצריך, הכי פשוט למלא את הפרטים והתמונות כאן (לוקח בערך 5 דקות):\n{sellLink}',
    en: 'Hi {name}, so I can market your property properly, the easiest way is to fill in the details and photos here (it takes about 5 minutes):\n{sellLink}' },
  { id: 'holiday', cat: 'general', he_title: 'ברכת חג', en_title: 'Holiday greeting',
    he: 'חג שמח {name}!\nמאחלים לך ולמשפחה שנה טובה, בריאה ושקטה.[[\n{agent}, אפיק הנחל]]',
    en: 'Happy holidays[[, {name}]]!\nWishing you and your family a good, healthy and peaceful year.[[\n{agent}, Afik Hanahal]]' },
  // ── chat-ready replies (the WhatsApp page's template picker) ──
  { id: 'send_details', cat: 'progress', he_title: 'שליחת פרטי הנכס', en_title: 'Sending the property details',
    he: 'היי {name}, הנה כל הפרטים על {property} – תמונות, מפרט, מחיר ותנאים.\nכשיהיה לך רגע לעבור על זה, אשמח לשמוע מה דעתך. ואם בא לך לראות את הנכס במציאות – נקבע ביקור.',
    en: 'Hi {name}, here are all the details on {property} – photos, specs, price and terms.\nWhen you have a moment to look through, I\'d love to hear what you think. And if you\'d like to see it in person, we\'ll set up a visit.' },
  { id: 'visit_offer', cat: 'progress', he_title: 'הצעה לביקור בנכס', en_title: 'Offering a viewing',
    he: 'היי {name}, את {property} הכי טוב לראות במקום – תמונות לא מעבירות הכול.\nיש לי זמן השבוע גם בבקרים וגם אחה"צ. מה מתאים לך?',
    en: 'Hi {name}, {property} is best seen in person – photos don\'t tell the whole story.\nI have time this week, mornings and afternoons. What suits you?' },
  { id: 'visit_directions', cat: 'progress', he_title: 'הגעה לביקור – פרטים', en_title: 'Viewing – how to get there',
    he: 'היי {name}, לקראת הביקור ב{property} – אשלח לך כאן את הכתובת המדויקת ואיפה נפגשים.\nאם משהו משתנה או שיש עיכוב, אפשר לכתוב לי כאן או להתקשר: {phone}.\nנתראה!',
    en: 'Hi {name}, ahead of the visit to {property} – I\'ll send you the exact address and where we meet, right here.\nIf anything changes or you\'re running late, message me here or call {phone}.\nSee you there!' },
  { id: 'after_visit', cat: 'progress', he_title: 'אחרי ביקור – מה התרשמת?', en_title: 'After the viewing – your impression',
    he: 'היי {name}, תודה שבאת לראות את {property}.\nמה התרשמת? ואם נשארו שאלות – על המחיר, התנאים או לוחות הזמנים – אשמח לענות.',
    en: 'Hi {name}, thanks for coming to see {property}.\nWhat did you think? And if any questions are left – on price, terms or timing – I\'m happy to answer.' },
  { id: 'financing', cat: 'progress', he_title: 'מימון ומשכנתא', en_title: 'Financing and mortgage',
    he: 'היי {name}, משהו שכדאי לסגור מוקדם: המימון.\nיש יועץ משכנתאות שאנחנו עובדים איתו הרבה, והוא יכול לעשות לך בדיקה ראשונית בלי התחייבות. לחבר ביניכם?',
    en: 'Hi {name}, one thing worth sorting out early: financing.\nWe work a lot with a mortgage adviser who can run a first check for you, no strings attached. Shall I put you in touch?' },
  { id: 'similar_props', cat: 'progress', he_title: 'נכסים דומים שעשויים להתאים', en_title: 'Similar properties that may fit',
    he: 'היי {name}, בהמשך למה שחיפשת[[ ({needs})]], יש לי עוד כמה נכסים באותו כיוון.\nלשלוח לך?',
    en: 'Hi {name}, following what you were looking for[[ ({needs})]], I have a few more properties along the same lines.\nShall I send them over?' },
  { id: 'price_update', cat: 'progress', he_title: 'עדכון מחיר / תנאים', en_title: 'Price or terms update',
    he: 'היי {name}, יש עדכון ב{property} – המחיר והתנאים השתנו.\nאם זה עדיין מעניין אותך, זה זמן טוב לדבר. מתי נוח?',
    en: 'Hi {name}, there\'s news on {property} – the price and terms have changed.\nIf it still interests you, now\'s a good time to talk. When suits you?' },
  { id: 'call_back_later', cat: 'general', he_title: 'לא זמין כרגע – נחזור אליך', en_title: 'Busy right now – will call back',
    he: 'היי {name}, ראיתי את ההודעה, תודה. אני בפגישה כרגע ואחזור אליך עוד היום.',
    en: 'Hi {name}, saw your message, thanks. I\'m in a meeting right now and will get back to you later today.' },
  { id: 'office_hours', cat: 'general', he_title: 'שעות פעילות ודרכי קשר', en_title: 'Office hours and contact',
    he: 'היי {name}, אפשר לתפוס אותנו בימים א׳–ה׳ בין 9:00 ל-19:00, ובשישי עד 13:00.\nכאן בוואטסאפ אפשר לכתוב בכל שעה, ובטלפון: {phone}. ויש גם את האתר: {site}',
    en: 'Hi {name}, you can reach us Sunday to Thursday, 9:00–19:00, and on Fridays until 13:00.\nHere on WhatsApp you can write any time, or call {phone}. There\'s also our website: {site}' },
  { id: 'new_listing', cat: 'general', he_title: 'נכס חדש שעשוי להתאים', en_title: 'A new listing that may fit',
    he: 'היי {name}, נכנס אליי היום נכס שישר חשבתי עליך כשראיתי אותו[[ – {needs}]].\nעוד לא פרסמנו אותו. לשלוח לך פרטים?',
    en: 'Hi {name}, a property came in today and you were the first person I thought of[[ – {needs}]].\nWe haven\'t advertised it yet. Shall I send you the details?' },
  { id: 'seller_valuation', cat: 'general', he_title: 'בעל נכס – הערכת שווי', en_title: 'Owner – property valuation',
    he: 'היי {name}, אשמח לתת לך הערכת שווי אמיתית לנכס, לפי עסקאות שנסגרו לאחרונה באזור – בלי עלות ובלי התחייבות.\nאפשר להתחיל במילוי קצר של פרטי הנכס: {sellLink}',
    en: 'Hi {name}, I\'d be glad to give you a realistic valuation of your property, based on deals closed recently in the area – free and no strings attached.\nYou can start with a short form about the property: {sellLink}' },
  { id: 'nr_weekend', cat: 'followup', he_title: 'לא ענה – אחרי סוף השבוע', en_title: 'No reply – after the weekend',
    he: 'היי {name}, מקווה שהיה סופ"ש טוב.\nרציתי לחזור לפנייה שלך[[ על {property}]] – יש מצב לשיחה קצרה השבוע?',
    en: 'Hi {name}, hope you had a good weekend.\nI wanted to come back to your inquiry[[ about {property}]] – any chance of a quick call this week?' },
  { id: 'deal_next_steps', cat: 'deal', he_title: 'לקראת חתימה – הצעדים הבאים', en_title: 'Before signing – next steps',
    he: 'היי {name}, לקראת החתימה – ככה זה ייראה מכאן:\n1. בדיקת נסח טאבו ומסמכי הנכס\n2. העברת הפרטים לעורכי הדין של שני הצדדים\n3. קביעת מועד לחתימה\nאני איתך בכל שלב, וכל שאלה – פשוט לכתוב לי.',
    en: 'Hi {name}, ahead of the signing – here\'s how it goes from here:\n1. Checking the Tabu registration extract and the property documents\n2. Passing the details to both sides\' lawyers\n3. Setting a date for the signing\nI\'m with you at every step, and for any question just message me.' },
  { id: 'deal_docs', cat: 'deal', he_title: 'מסמכים לחוזה', en_title: 'Documents for the contract',
    he: 'היי {name}, כדי להכין את החוזה אצטרך:\n• צילום ת"ז\n• הפרטים של עורך הדין שלך\n• אישור עקרוני למשכנתא, אם יש\nאפשר לשלוח הכול כאן.',
    en: 'Hi {name}, to prepare the contract I\'ll need:\n• A copy of your ID\n• Your lawyer\'s details\n• A mortgage approval in principle, if you have one\nYou can send it all here.' },
  { id: 'deal_keys', cat: 'deal', he_title: 'מסירת מפתח', en_title: 'Handing over the keys',
    he: 'מזל טוב {name}! היום זה קורה – המפתח ל{property} אצלך.\nתודה על האמון לאורך כל הדרך. גם אחרי המסירה, אם צריך משהו – אני כאן.',
    en: 'Congratulations[[, {name}]]! Today\'s the day – the keys to {property} are yours.\nThank you for trusting me all the way. Even after the handover, if you need anything, I\'m here.' },
  { id: 'review_request', cat: 'deal', he_title: 'בקשת חוות דעת', en_title: 'Asking for a review',
    he: 'היי {name}, היה כיף ללוות אותך.\nאם היית מרוצה, כמה מילים בגוגל יעזרו לי מאוד – ככה עוד אנשים מוצאים אותנו.\nתודה מראש!',
    en: 'Hi {name}, it was great working with you.\nIf you were happy, a few words on Google would really help me – it\'s how more people find us.\nThanks in advance!' },
  { id: 'referral', cat: 'deal', he_title: 'בקשת המלצה / הפניה', en_title: 'Asking for a referral',
    he: 'היי {name}, בקשה קטנה – אם יש מישהו בסביבה שלך שמחפש לקנות, למכור או להשכיר בשרון, אשמח לעזור גם לו.\nתודה על האמון!',
    en: 'Hi {name}, a small favour – if anyone around you is looking to buy, sell or rent in the Sharon region, I\'d be glad to help them too.\nThanks for your trust!' },
  { id: 'thanks_short', cat: 'general', he_title: 'תודה – קצר', en_title: 'Thank you – short',
    he: 'תודה {name}, קיבלתי. אחזור אליך עם עדכון בהקדם.',
    en: 'Thanks[[, {name}]] – got it. I\'ll get back to you with an update soon.' },
]

export const DEFAULT_CONFIG = {
  version: 1,
  enabled: true,
  // Automations only act on leads / replies / stage changes that happen after this moment,
  // so switching the system on never messages the whole historical list.
  installedAt: '2026-09-23T00:00:00.000Z',
  vars: { agent: 'ישראל', en_agent: 'Israel', phone: '055-981-1814', site: 'https://www.afikhanahal.co.il', sellLink: 'https://www.afikhanahal.co.il/newproperty' },
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

// "בוקר טוב" / "צהריים טובים" / "ערב טוב" by the hour in Israel (rendered at send time, so a scheduled message still fits)
export function timeGreeting(lang = 'he', now = new Date()) {
  const h = israelNow(now).hour
  const he = lang !== 'en'
  if (h >= 5 && h < 12) return he ? 'בוקר טוב' : 'Good morning'
  if (h >= 12 && h < 17) return he ? 'צהריים טובים' : 'Good afternoon'
  if (h >= 17 && h < 23) return he ? 'ערב טוב' : 'Good evening'
  return he ? 'היי' : 'Hi'
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
    greeting: timeGreeting(lang, opts.now),
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
