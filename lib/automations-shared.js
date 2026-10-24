// ── WhatsApp automations: shared, pure logic (only the pure src/lib/leadFields.js) ─────────────────────────
// Imported by the server engine (lib/automations.js) AND by the admin panel (src/AutomationsTab.jsx,
// src/GreenAPIChat.jsx), so templates, placeholders, quiet hours and reply detection behave the same
// in the browser preview and in the message that is actually sent.
//
// Every template has a Hebrew text and an English text: a lead who came from the English site
// (crm_data.origin.lang === 'en') gets the English version.

import { shortCampaign } from '../src/lib/leadFields.js'
import { hebrewFirstName, isLatinName } from './hebrew-names.js'
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
    he: 'היי {name}, ראינו שהשארתם לנו פרטים[[ {when}]][[ {where}]][[ על {property}]], אנחנו מאפיק הנחל.[[\nהבנו שאתם מחפשים {needs}.]]\nאפשר להתקשר היום לכמה דקות?',
    en: 'Hi {name}, thanks for leaving your details[[ {when}]][[ {where}]][[ about {property}]]. This is Afik Hanahal.[[\nWe understand you\'re looking for {needs}.]]\nWould you have a few minutes for a call today?' },
  { id: 'welcome_prop', cat: 'welcome', he_title: 'פתיחה – התעניין בנכס', en_title: 'Welcome – asked about a property',
    he: 'היי {name}, ראינו שהשארתם פרטים[[ {when}]][[ {where}]][[ על {property}]].[[\nהבנו שאתם מחפשים {needs}.]]\nלשלוח לכם תוכניות ומחירים, או שנדבר רגע בטלפון?',
    en: 'Hi {name}, thanks for leaving your details[[ {when}]][[ {where}]][[ about {property}]].[[\nWe understand you\'re looking for {needs}.]]\nWould you like us to send the plans and prices, or would a quick call suit you better?' },
  { id: 'welcome_short', cat: 'welcome', he_title: 'פתיחה – קצר ולעניין', en_title: 'Welcome – short and to the point',
    he: 'היי {name}, קיבלנו את הפרטים[[ על {property}]]. נוח שנתקשר היום?',
    en: 'Hi {name}, we\'ve received your details[[ about {property}]]. Would today be a good time for a call?' },
  { id: 'welcome_slots', cat: 'welcome', he_title: 'פתיחה – בחירת זמן לשיחה', en_title: 'Welcome – pick a time for a call',
    he: 'היי {name}, קיבלנו את הפנייה[[ על {property}]].\nנתקשר היום אחר הצהריים או מחר בבוקר?',
    en: 'Hi {name}, thanks for your inquiry[[ about {property}]].\nWould this afternoon or tomorrow morning suit you for a call?' },
  { id: 'welcome_book', cat: 'welcome', he_title: 'פתיחה – עם קישור לקביעת שיחה', en_title: 'Welcome – with a link to book a call',
    he: 'היי {name}, ראינו שהשארתם פרטים[[ על {property}]]. אפשר לבחור כאן שעה לשיחה קצרה:\n{bookingLink}',
    en: 'Hi {name}, thanks for leaving your details[[ about {property}]]. You can choose a convenient time for a short call here:\n{bookingLink}' },
  { id: 'welcome_personal', cat: 'welcome', he_title: 'פתיחה – אישי מהנציג', en_title: 'Welcome – a personal note from the agent',
    he: '{greeting} {name}, עברנו על הפרטים שהשארתם[[ על {property}]].\nיש כמה דברים שקל יותר להסביר בטלפון. נדבר היום?',
    en: '{greeting}[[ {name}]], we\'ve gone through the details you left[[ about {property}]].\nA few points are easier to explain over the phone. Could we talk today?' },
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
    he: 'היי {name}, סליחה על העיכוב, אנחנו מאפיק הנחל. השארתם פרטים[[ על {property}]], זה עדיין רלוונטי?',
    en: 'Hi {name}, apologies for the delay, this is Afik Hanahal. You left your details[[ about {property}]], is it still relevant for you?' },
  { id: 'welcome_late_check', cat: 'welcome', he_title: 'פתיחה באיחור – עדיין רלוונטי?', en_title: 'Late welcome – still relevant?',
    he: 'היי {name}, חוזרים אליכם לגבי הפרטים שהשארתם[[ על {property}]]. עדיין רלוונטי?',
    en: 'Hi {name}, following up on the details you left[[ about {property}]]. Is it still relevant for you?' },
  { id: 'welcome_investor', cat: 'welcome', he_title: 'פתיחה – משקיעים וקרקעות', en_title: 'Welcome – investors and land',
    he: 'היי {name}, ראינו שהתעניינתם ב{property}.\nבהשקעה כזאת כדאי לעבור יחד על התכנון והטאבו[[ ועל תקציב של {budget}]]. יש לכם 10 דקות השבוע?',
    en: 'Hi {name}, thanks for your interest in {property}.\nWith an investment like this, it\'s worth reviewing the zoning and Tabu registration together[[, along with a budget of {budget}]]. Do you have 10 minutes this week?' },
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
    he: 'היי {name}, לא נציף אתכם בהודעות.\nאם זה יחזור להיות רלוונטי, המספר אצלכם ואנחנו כאן.[[\n{agent}]]',
    en: 'Hi {name}, we don\'t want to fill up your inbox.\nIf things change, you have our number and we\'ll be happy to help.[[\n{agent}]]' },
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
    he: 'היי {name}, נראה שתפסנו אתכם בתקופה עמוסה. 5 דקות טלפון מחר[[ על {property}]], בבוקר או אחר הצהריים?',
    en: 'Hi {name}, it seems like a busy time for you. Could we have 5 minutes on the phone tomorrow[[ about {property}]], morning or afternoon?' },
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
    he: 'היי {name}, כדי להתקדם נצטרך צילום ת"ז, נסח טאבו ואישור עקרוני למשכנתא אם יש. אפשר לצלם ולשלוח לכאן.',
    en: 'Hi {name}, to move forward we\'ll need a copy of your ID, a Tabu extract and, if you have one, a mortgage approval in principle. You can simply photograph them and send them here.' },
  { id: 'negotiation', cat: 'progress', he_title: 'במו"מ – עדכון', en_title: 'Negotiation – update',
    he: 'היי {name}, עדכון: דיברנו היום עם הצד השני[[ לגבי {property}]] ויש התקדמות. נעדכן ברגע שיהיה סגור.',
    en: 'Hi {name}, an update: we spoke with the other side today[[ about {property}]] and there\'s progress. We\'ll let you know as soon as it\'s finalised.' },
  { id: 'visit_slots', cat: 'progress', he_title: 'תיאום סיור – בחירת זמן', en_title: 'Book a visit – pick a time',
    he: 'מעולה {name}, בואו נקבע סיור[[ ב{property}]]. מחר בבוקר, מחר אחר הצהריים או שישי בבוקר?',
    en: 'Great[[, {name}]]! Let\'s arrange a visit[[ to {property}]]. Would tomorrow morning, tomorrow afternoon or Friday morning suit you?' },
  { id: 'meeting_reminder', cat: 'progress', he_title: 'תזכורת לפגישה', en_title: 'Meeting reminder',
    he: 'היי {name}, תזכורת שנפגשים היום[[ בעניין {property}]]. נתראה!',
    en: 'Hi {name}, a quick reminder about our meeting today[[ regarding {property}]]. See you soon!' },
  { id: 'after_call', cat: 'progress', he_title: 'אחרי שיחה – סיכום', en_title: 'After the call – summary',
    he: 'היי {name}, היה נעים לדבר. כמו שסיכמנו, מצרפים את הפרטים[[ על {property}]].',
    en: 'Hi {name}, it was good speaking with you. As agreed, here are the details[[ on {property}]].' },
  { id: 'closing_polite', cat: 'closing', he_title: 'לא מעוניין – סגירה מכבדת', en_title: 'Not interested – a courteous close',
    he: '[[{name}, ]]תודה שעדכנתם, באמת. לא נטריד יותר.\nאם תחפשו משהו בשרון, אנחנו כאן.',
    en: 'Thank you for letting us know[[, {name}]], we appreciate it. We won\'t contact you further.\nIf you\'re ever looking in the Sharon region, we\'re here.' },
  { id: 'reengage', cat: 'closing', he_title: 'חזרה ללקוח אחרי תקופה', en_title: 'Re-engage after a while',
    he: 'היי {name}, מה נשמע? זה מאפיק הנחל[[, דיברנו על {property}]].\nעדיין מחפשים[[ {needs}]]? נכנסו כמה דברים שיכולים לעניין אתכם.',
    en: 'Hi {name}, how are you? It\'s Afik Hanahal[[, we spoke about {property}]].\nAre you still looking[[ for {needs}]]? A few new properties have come in that may interest you.' },
  { id: 'nurture_checkin', cat: 'closing', he_title: 'לחזור בהמשך – בדיקת מצב', en_title: 'Later – checking in',
    he: '{greeting} {name}, מה שלומכם?\nרצינו לשמוע אם משהו השתנה בתוכניות[[ לגבי {property}]]. נדבר השבוע?',
    en: '{greeting}[[ {name}]], we hope all is well.\nWe wanted to check whether anything has changed in your plans[[ regarding {property}]]. Could we talk this week?' },
  { id: 'reengage_new', cat: 'closing', he_title: 'חזרה – נכסים חדשים', en_title: 'Re-engage – new listings',
    he: 'היי {name}, נכנסו נכסים שעוד לא פורסמו[[, בכיוון של {needs}]]. לשלוח לכם?',
    en: 'Hi {name}, a few new properties have just come in that haven\'t been advertised yet[[, in line with {needs}]]. Would you like us to send them?' },
  { id: 'won_thanks', cat: 'deal', he_title: 'אחרי סגירה – תודה', en_title: 'After closing – thank you',
    he: 'מזל טוב {name}!! היה תענוג ללוות אתכם.\nאם בא לכם לשתף איך היה, זה עוזר לנו מאוד.',
    en: 'Congratulations[[, {name}]]! It was a pleasure working with you.\nIf you\'d like to share your experience, it would mean a lot to us.' },
  { id: 'personal_needs', cat: 'personal', he_title: 'אישי – לפי מה שהוא מחפש', en_title: 'Personal – what they are looking for',
    he: 'היי {name}, תודה שפניתם לגבי {property}.[[\nראינו שאתם מחפשים {needs}, ויש לנו כמה דברים שמתאימים.]]\nנדבר כמה דקות?',
    en: 'Hi {name}, thanks for getting in touch about {property}.[[\nWe see you\'re looking for {needs}, and we have a few options that fit.]]\nCould we have a quick chat?' },
  { id: 'personal_budget', cat: 'personal', he_title: 'אישי – לפי התקציב', en_title: 'Personal – by budget',
    he: 'היי {name}, תודה על ההתעניינות ב{property}.[[ ראינו תקציב של {budget}.]]\nנשמח להראות מה הכי מתאים, מתי נוח לדבר?',
    en: 'Hi {name}, thanks for your interest in {property}.[[ We noted a budget of {budget}.]]\nWe\'d be happy to show you what fits best. When would be a good time to talk?' },
  { id: 'personal_message', cat: 'personal', he_title: 'אישי – מתייחס למה שכתב', en_title: 'Personal – answers what they wrote',
    he: 'היי {name}, קראנו מה שכתבתם[[: "{message}"]].\nיש לכם כמה דקות היום לדבר על זה?',
    en: 'Hi {name}, we read your message[[: "{message}"]].\nDo you have a few minutes today to talk it through?' },
  { id: 'personal_investor', cat: 'personal', he_title: 'אישי – משקיע', en_title: 'Personal – investor',
    he: 'היי {name}, ראינו שהתעניינתם ב{property}[[ ל{purpose}]].\nנשלח סקירה קצרה: מחיר, תכנון, טאבו ותשואה[[, מול תקציב של {budget}]]. נעבור עליה יחד בטלפון?',
    en: 'Hi {name}, thanks for your interest in {property}[[ as {purpose}]].\nWe\'ll send you a short overview covering price, zoning, Tabu registration and expected returns[[, based on a budget of {budget}]]. Shall we go over it together by phone?' },
  { id: 'personal_timeline', cat: 'personal', he_title: 'אישי – לפי לוח הזמנים', en_title: 'Personal – by timeline',
    he: 'היי {name}, תודה שפניתם לגבי {property}.[[ ראינו שאתם מתכננים לעבור {timeline}, זה בדיוק הזמן להתחיל.]]\nנבנה יחד תוכנית?',
    en: 'Hi {name}, thanks for getting in touch about {property}.[[ You\'re planning to move {timeline}, which is exactly the right time to start.]]\nShall we put a plan together?' },
  { id: 'personal_followup', cat: 'personal', he_title: 'אישי – מעקב לפי מה שביקש', en_title: 'Personal – follow-up on their request',
    he: 'היי {name}, חזרנו לפנייה שלכם[[ על {property}]][[ ({needs})]] ומצאנו כמה דברים ששווה לראות. נדבר השבוע?',
    en: 'Hi {name}, we went back over your inquiry[[ about {property}]][[ ({needs})]] and found a few options worth seeing. Could we talk this week?' },
  { id: 'seller_invite', cat: 'general', he_title: 'בעל נכס – טופס קליטה', en_title: 'Owner – intake form',
    he: 'היי {name}, כדי לשווק את הנכס כמו שצריך, אפשר למלא כאן פרטים ותמונות (כ-5 דקות):\n{sellLink}',
    en: 'Hi {name}, so we can market your property properly, you can add the details and photos here (about 5 minutes):\n{sellLink}' },
  { id: 'holiday', cat: 'general', he_title: 'ברכת חג', en_title: 'Holiday greeting',
    he: 'חג שמח {name}! שנה טובה ושקטה, עם הרבה בריאות.[[\n{agent}]]',
    en: 'Happy holidays[[, {name}]]! Wishing you a calm and healthy year ahead.[[\n{agent}]]' },
  // ── chat-ready replies (the WhatsApp page's template picker) ──
  { id: 'send_details', cat: 'progress', he_title: 'שליחת פרטי הנכס', en_title: 'Sending the property details',
    he: 'היי {name}, הנה הפרטים[[ על {property}]]: תמונות, מפרט ומחיר.\nמה דעתכם? אם בא לכם לראות במקום, נקבע ביקור.',
    en: 'Hi {name}, here are the details[[ on {property}]]: photos, specifications and price.\nWhat do you think? If you\'d like to see it in person, we\'ll arrange a visit.' },
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
    he: 'היי {name}, כדאי לסגור את המימון מוקדם. לחבר אתכם ליועץ משכנתאות שאנחנו עובדים איתו? בלי התחייבות.',
    en: 'Hi {name}, it\'s worth arranging the financing early. Would you like us to put you in touch with a mortgage adviser we work with? No obligation.' },
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
    he: 'היי {name}, מכאן: בודקים נסח טאבו ומסמכים, מעבירים לעורכי הדין, וקובעים חתימה. אנחנו איתכם בכל שלב.',
    en: 'Hi {name}, the next steps: we review the Tabu extract and documents, pass them to the lawyers, and set a signing date. We\'re with you every step of the way.' },
  { id: 'deal_docs', cat: 'deal', he_title: 'מסמכים לחוזה', en_title: 'Documents for the contract',
    he: 'היי {name}, לחוזה נצטרך צילום ת"ז, פרטי עורך הדין שלכם ואישור עקרוני למשכנתא אם יש. אפשר לשלוח לכאן.',
    en: 'Hi {name}, for the contract we\'ll need a copy of your ID, your lawyer\'s details and, if you have one, a mortgage approval in principle. You can send them here.' },
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
      discovery:   { mode: 'off',     templateId: 'docs' },
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
  let first = fullName.split(/\s+/)[0] || ''
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
