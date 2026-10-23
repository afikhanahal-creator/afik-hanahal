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
    he: 'היי {name}, ראינו שהשארתם לנו פרטים[[ {when}]][[ {where}]][[ על {property}]], אנחנו מאפיק הנחל.[[\nהבנו שאתם מחפשים {needs}, אז נוכל לכוון אתכם ישר למה שמתאים.]]\nאפשר להתקשר אליכם היום לכמה דקות, או שמחר עדיף?',
    en: 'Hi {name}, we saw you left us your details[[ {when}]][[ {where}]][[ about {property}]], we\'re Afik Hanahal.[[\nYou mentioned you\'re looking for {needs}, so we can point you straight to what fits.]]\nCan we call you for a few minutes today, or is tomorrow better?' },
  { id: 'welcome_prop', cat: 'welcome', he_title: 'פתיחה – התעניין בנכס', en_title: 'Welcome – asked about a property',
    he: 'היי {name}, ראינו שהשארתם פרטים[[ {when}]][[ {where}]][[ על {property}]].[[\nהבנו שאתם מחפשים {needs}, אז נשלח רק את מה שרלוונטי לכם.]]\nיש לנו את התוכניות והמחירים. לשלוח לכם לכאן, או שנדבר רגע בטלפון?',
    en: 'Hi {name}, we saw you left your details[[ {when}]][[ {where}]][[ about {property}]].[[\nYou mentioned you\'re looking for {needs}, so we\'ll only send what\'s relevant to you.]]\nWe\'ve got the plans and prices. Shall we send them here, or have a quick chat on the phone?' },
  { id: 'welcome_short', cat: 'welcome', he_title: 'פתיחה – קצר ולעניין', en_title: 'Welcome – short and to the point',
    he: 'היי {name}, קיבלנו את הפרטים שהשארתם[[ על {property}]]. אפשר להתקשר אליכם היום לכמה דקות?',
    en: 'Hi {name}, we got the details you left[[ about {property}]]. Can we call you for a few minutes today?' },
  { id: 'welcome_slots', cat: 'welcome', he_title: 'פתיחה – בחירת זמן לשיחה', en_title: 'Welcome – pick a time for a call',
    he: 'היי {name}, קיבלנו את הפנייה שלכם[[ על {property}]] ואנחנו כבר על זה.\nמה נוח לכם יותר שנתקשר, היום אחר הצהריים או מחר בבוקר?',
    en: 'Hi {name}, we got your inquiry[[ about {property}]] and we\'re on it.\nWhat suits you better for a call, this afternoon or tomorrow morning?' },
  { id: 'welcome_book', cat: 'welcome', he_title: 'פתיחה – עם קישור לקביעת שיחה', en_title: 'Welcome – with a link to book a call',
    he: 'היי {name}, ראינו שהשארתם פרטים[[ {when}]][[ {where}]][[ על {property}]].\nכדי שלא נתפוס אתכם בזמן לא נוח, אפשר לבחור כאן שעה לשיחה קצרה:\n{bookingLink}',
    en: 'Hi {name}, we saw you left your details[[ {when}]][[ {where}]][[ about {property}]].\nSo we don\'t catch you at a bad moment, you can pick a time for a short call here:\n{bookingLink}' },
  { id: 'welcome_personal', cat: 'welcome', he_title: 'פתיחה – אישי מהנציג', en_title: 'Welcome – a personal note from the agent',
    he: '{greeting} {name}, עברנו על הפרטים שהשארתם[[ על {property}]][[ ({needs})]].\nיש כמה דברים על המחיר ועל המצב התכנוני שהרבה יותר קל להסביר בטלפון מאשר בהודעה. נוח לכם לדבר היום, או מחר?',
    en: '{greeting}[[ {name}]], we went through the details you left[[ about {property}]][[ ({needs})]].\nThere are a couple of things about the price and the planning status that are much easier to explain on the phone than in a message. Does today work for a call, or tomorrow?' },
  { id: 'welcome_questions', cat: 'welcome', he_title: 'פתיחה – שאלות היכרות', en_title: 'Welcome – a few qualifying questions',
    he: 'היי {name}, תודה שפניתם[[ לגבי {property}]].\nלפני שנשלח לכם חומר, שתי שאלות קטנות כדי לשלוח רק את מה שמתאים: זה בשביל לגור או להשקעה? ובערך באיזה תקציב מדובר?',
    en: 'Hi {name}, thanks for getting in touch[[ about {property}]].\nBefore we send you material, two quick questions so we only send what fits: is it to live in or an investment? And roughly what budget are we talking about?' },
  { id: 'welcome_callnow', cat: 'welcome', he_title: 'פתיחה – שיחה עכשיו?', en_title: 'Welcome – a call right now?',
    he: 'היי {name}, ראינו עכשיו את הפרטים שהשארתם[[ על {property}]].\nאנחנו פנויים בדקות הקרובות, נתקשר?',
    en: 'Hi {name}, we just saw the details you left[[ about {property}]].\nWe\'re free for the next few minutes, shall we call?' },
  { id: 'welcome_brochure', cat: 'welcome', he_title: 'פתיחה – שליחת חוברת פרטים', en_title: 'Welcome – send the details pack',
    he: 'היי {name}, ראינו שהתעניינתם ב{property}.\nהכנו חוברת מסודרת עם התוכניות והמחירים. לשלוח לכם לכאן?',
    en: 'Hi {name}, we saw you were interested in {property}.\nWe put together a proper brochure with the plans and prices. Shall we send it here?' },
  { id: 'welcome_late', cat: 'welcome', he_title: 'פתיחה באיחור – התנצלות על העיכוב', en_title: 'Late welcome – apologising for the delay',
    he: 'היי {name}, סליחה שלקח לנו כמה ימים לחזור אליכם. השארתם לנו פרטים[[ על {property}]], אנחנו מאפיק הנחל.\nזה עדיין רלוונטי? אם כן, נתקשר היום.',
    en: 'Hi {name}, sorry it took us a few days to get back to you. You left us your details[[ about {property}]], we\'re Afik Hanahal.\nIs it still relevant? If so, we\'ll call you today.' },
  { id: 'welcome_late_check', cat: 'welcome', he_title: 'פתיחה באיחור – עדיין רלוונטי?', en_title: 'Late welcome – still relevant?',
    he: 'היי {name}, רצינו לחזור אליכם על הפרטים שהשארתם[[ לגבי {property}]]. עדיין מעוניינים לשמוע עוד?',
    en: 'Hi {name}, we wanted to get back to you on the details you left[[ about {property}]]. Still keen to hear more?' },
  { id: 'welcome_investor', cat: 'welcome', he_title: 'פתיחה – משקיעים וקרקעות', en_title: 'Welcome – investors and land',
    he: 'היי {name}, ראינו שהתעניינתם ב{property}.\nבהשקעה כזאת הכי חשוב להבין קודם את המצב התכנוני והטאבו, ואת זה הרבה יותר קל להסביר בשיחה.[[ נבדוק איתכם גם מה נכנס בתקציב של {budget}.]]\nיש לכם 10 דקות השבוע?',
    en: 'Hi {name}, we saw you were interested in {property}.\nWith an investment like this, the planning status and the Tabu registration come first, and that\'s much easier to explain on a call.[[ We\'ll also look at what fits a budget of {budget}.]]\nDo you have 10 minutes this week?' },
  { id: 'after_hours', cat: 'welcome', he_title: 'מחוץ לשעות הפעילות', en_title: 'Outside office hours',
    he: 'היי {name}, קיבלנו את הפרטים[[ על {property}]], תודה. נחזור אליכם מחר בבוקר.\nאם זה דחוף אפשר להתקשר: {phone}',
    en: 'Hi {name}, we got your details[[ about {property}]], thanks. We\'ll get back to you tomorrow morning.\nIf it\'s urgent you can call: {phone}' },
  { id: 'nr1', cat: 'followup', he_title: 'לא ענה – תזכורת ראשונה', en_title: 'No reply – first reminder',
    he: 'היי {name}, רצינו לבדוק שההודעה הקודמת שלנו הגיעה.[[\nיש כמה דברים על {property} ששווה לכם לשמוע לפני שמחליטים.]]\nנוח לכם שנתקשר מחר בבוקר, או אחר הצהריים?',
    en: 'Hi {name}, just checking our last message reached you.[[\nThere are a few things on {property} worth hearing before you decide.]]\nCan we call you tomorrow morning, or is the afternoon better?' },
  { id: 'nr2', cat: 'followup', he_title: 'לא ענה – ערך נוסף', en_title: 'No reply – added value',
    he: 'היי {name}, נכנסו אלינו השבוע כמה נכסים שעוד לא עלו לאתר, וחלק מהם בכיוון של מה שחיפשתם[[ ({needs})]].\nלשלוח לכם?',
    en: 'Hi {name}, a few properties came in this week that aren\'t on the website yet, and some are in line with what you were after[[ ({needs})]].\nShall we send them?' },
  { id: 'nr3', cat: 'followup', he_title: 'לא ענה – פנייה אחרונה', en_title: 'No reply – last message',
    he: 'היי {name}, לא נציף אתכם בעוד הודעות[[ על {property}]].\nאם בעתיד זה יחזור להיות רלוונטי, המספר שלנו אצלכם ואנחנו כאן.[[\n{agent}]]',
    en: 'Hi {name}, we won\'t keep bugging you[[ about {property}]].\nIf it becomes relevant again down the line, you\'ve got our number and we\'re here.[[\n{agent}]]' },
  { id: 'missed_call', cat: 'followup', he_title: 'ניסינו להתקשר', en_title: 'We tried to call',
    he: 'היי {name}, ניסינו להתקשר[[ לגבי {property}]] ולא תפסנו אתכם. מתי יותר נוח, בבוקר או אחרי הצהריים?',
    en: 'Hi {name}, we tried calling[[ about {property}]] but missed you. What\'s better for you, mornings or afternoons?' },
  { id: 'nr_short', cat: 'followup', he_title: 'לא ענה – תזכורת קצרה', en_title: 'No reply – short reminder',
    he: 'היי {name}, יצא לכם לחשוב על {property}?',
    en: 'Hi {name}, had a chance to think about {property}?' },
  { id: 'nr_channel', cat: 'followup', he_title: 'לא ענה – טלפון או וואטסאפ?', en_title: 'No reply – phone or WhatsApp?',
    he: 'היי {name}, מה יותר נוח לכם, שנתקשר לכמה דקות או שנשלח את הפרטים על {property} כאן בוואטסאפ?',
    en: 'Hi {name}, what\'s easier for you, a quick call or shall we just send the details on {property} here on WhatsApp?' },
  { id: 'nr_relevant', cat: 'followup', he_title: 'לא ענה – עדיין רלוונטי?', en_title: 'No reply – still relevant?',
    he: 'היי {name}, שאלה קצרה: {property} עדיין רלוונטי בשבילכם?\nגם "לא" זו תשובה בסדר גמור, פשוט שלא נטריד סתם.',
    en: 'Hi {name}, quick question: is {property} still relevant for you?\n"No" is totally fine too, just so we don\'t bother you for nothing.' },
  { id: 'nr_scarcity', cat: 'followup', he_title: 'לא ענה – עדכון זמינות', en_title: 'No reply – availability update',
    he: 'היי {name}, עדכון קטן על {property}: היה השבוע הרבה ביקוש ונשארו פחות אפשרויות פנויות.\nרוצים שנשלח לכם מה עוד פתוח?',
    en: 'Hi {name}, small update on {property}: lots of demand this week, and there\'s less left than there was.\nWant us to send you what\'s still open?' },
  { id: 'nr_times', cat: 'followup', he_title: 'לא ענה – הצעת זמנים', en_title: 'No reply – suggested times',
    he: 'היי {name}, נראה לנו שתפסנו אתכם בתקופה עמוסה.\nמה דעתכם על 5 דקות טלפון מחר[[ על {property}]], בבוקר או אחר הצהריים?',
    en: 'Hi {name}, seems we caught you at a busy time.\nHow about 5 minutes on the phone tomorrow[[ about {property}]], morning or afternoon?' },
  { id: 'positive', cat: 'progress', he_title: 'רוצה להתקדם – תיאום שיחה', en_title: 'Moving forward – book a call',
    he: 'מעולה {name}!\nאז בואו נקבע, שיחה או סיור במקום, מה שנוח לכם. איזה יום מתאים השבוע?',
    en: 'Great[[, {name}]]!\nLet\'s set it up then, a call or a visit on site, whatever suits you. Which day works this week?' },
  { id: 'book_link', cat: 'progress', he_title: 'קישור לקביעת שיחה ביומן', en_title: 'Link to book a call',
    he: 'כדי שלא נפספס אחד את השני, אפשר לבחור כאן זמן שנוח לכם לשיחה קצרה איתנו:\n{bookingLink}\nזה לוקח פחות מדקה.',
    en: 'So we don\'t keep missing each other, you can pick a time that suits you for a short call with us here:\n{bookingLink}\nIt takes less than a minute.' },
  { id: 'meeting_confirm', cat: 'progress', he_title: 'אישור פגישה', en_title: 'Meeting confirmation',
    he: 'סגור {name}, נתראה.\nאם משהו משתנה אפשר לכתוב לנו כאן.',
    en: 'Done[[, {name}]], see you then.\nIf anything changes just message us here.' },
  { id: 'docs', cat: 'progress', he_title: 'מסמכים להמשך', en_title: 'Documents for the next step',
    he: 'היי {name}, כדי להתקדם יש כמה מסמכים שנצטרך מכם: צילום ת"ז, נסח טאבו אם יש לכם, ואישור עקרוני למשכנתא אם כבר יש.\nאפשר פשוט לצלם ולשלוח לכאן.',
    en: 'Hi {name}, to move forward we\'ll need a few documents from you: a copy of your ID, a Tabu extract if you have one, and a mortgage approval in principle if you\'ve already got it.\nYou can just snap a photo and send them here.' },
  { id: 'negotiation', cat: 'progress', he_title: 'במו"מ – עדכון', en_title: 'Negotiation – update',
    he: 'היי {name}, עדכון: דיברנו היום עם הצד השני לגבי {property}, ויש התקדמות.\nברגע שיהיה משהו סגור נעדכן אתכם.',
    en: 'Hi {name}, update: we spoke with the other side today about {property} and there\'s progress.\nAs soon as something\'s settled we\'ll let you know.' },
  { id: 'visit_slots', cat: 'progress', he_title: 'תיאום סיור – בחירת זמן', en_title: 'Book a visit – pick a time',
    he: 'מעולה {name}, בואו נקבע סיור ב{property}.\nמחר בבוקר, מחר אחר הצהריים או שישי בבוקר, מה הכי נוח לכם?',
    en: 'Great[[, {name}]], let\'s book a visit to {property}.\nTomorrow morning, tomorrow afternoon or Friday morning, what suits you best?' },
  { id: 'meeting_reminder', cat: 'progress', he_title: 'תזכורת לפגישה', en_title: 'Meeting reminder',
    he: 'היי {name}, רק תזכורת שאנחנו נפגשים היום בעניין {property}. נתראה!\nאם משהו השתנה אפשר לכתוב לנו.',
    en: 'Hi {name}, just a reminder we\'re meeting today about {property}. See you there!\nIf anything\'s changed, let us know.' },
  { id: 'after_call', cat: 'progress', he_title: 'אחרי שיחה – סיכום', en_title: 'After the call – summary',
    he: 'היי {name}, היה נעים לדבר. כמו שסיכמנו, הנה הפרטים על {property}.\nאם עולה עוד משהו, אנחנו כאן.',
    en: 'Hi {name}, good talking to you. As we said, here are the details on {property}.\nIf anything else comes up, we\'re here.' },
  { id: 'closing_polite', cat: 'closing', he_title: 'לא מעוניין – סגירה מכבדת', en_title: 'Not interested – a courteous close',
    he: '[[{name}, ]]תודה שעדכנתם, באמת. לא נטריד יותר.\nאם בעתיד תחפשו משהו בשרון, נשמח לעזור.',
    en: 'Thanks for letting us know[[, {name}]], really. We won\'t bother you again.\nIf you\'re ever looking for something in the Sharon region, we\'d be happy to help.' },
  { id: 'reengage', cat: 'closing', he_title: 'חזרה ללקוח אחרי תקופה', en_title: 'Re-engage after a while',
    he: 'היי {name}, מה נשמע? זה מאפיק הנחל, עבר זמן מאז שדיברנו[[ על {property}]].\nעדיין מחפשים[[ {needs}]]? נכנסו אלינו כמה דברים שנראה לנו שיכולים לעניין אתכם.',
    en: 'Hi {name}, how are things? It\'s Afik Hanahal, it\'s been a while since we spoke[[ about {property}]].\nStill looking[[ for {needs}]]? A few things came in that we think could interest you.' },
  { id: 'nurture_checkin', cat: 'closing', he_title: 'לחזור בהמשך – בדיקת מצב', en_title: 'Later – checking in',
    he: '{greeting} {name}, מה שלומכם?\nעבר קצת זמן מאז שדיברנו[[ על {property}]], ורצינו לשמוע אם משהו השתנה אצלכם בתוכניות. יש גם כמה חדשות בשרון ששווה לדעת.\nנדבר השבוע?',
    en: '{greeting}[[ {name}]], how are you?\nIt\'s been a little while since we spoke[[ about {property}]], and we wanted to hear whether anything\'s changed in your plans. There\'s also some news in the Sharon worth knowing.\nShall we talk this week?' },
  { id: 'reengage_new', cat: 'closing', he_title: 'חזרה – נכסים חדשים', en_title: 'Re-engage – new listings',
    he: 'היי {name}, נכנסו אלינו כמה נכסים שעוד לא פורסמו, וחלק מהם ממש בכיוון של מה שחיפשתם[[ ({needs})]]. לשלוח לכם?',
    en: 'Hi {name}, a few properties came in that haven\'t been published yet, and some are right in line with what you were after[[ ({needs})]]. Shall we send them?' },
  { id: 'won_thanks', cat: 'deal', he_title: 'אחרי סגירה – תודה', en_title: 'After closing – thank you',
    he: 'מזל טוב {name}!! איזה כיף.\nהיה לנו באמת תענוג ללוות אתכם. אם בא לכם לשתף איך היה, זה עוזר לנו מאוד.',
    en: 'Congratulations[[, {name}]]!! So happy for you.\nIt was a real pleasure to be with you along the way. If you feel like sharing how it went, it really helps us.' },
  { id: 'personal_needs', cat: 'personal', he_title: 'אישי – לפי מה שהוא מחפש', en_title: 'Personal – what they are looking for',
    he: 'היי {name}, תודה שפניתם לגבי {property}.[[\nראינו שאתם מחפשים {needs}, ויש לנו כמה דברים שמתאימים בדיוק.]]\nבא לכם שנדבר כמה דקות?',
    en: 'Hi {name}, thanks for reaching out about {property}.[[\nWe saw you\'re looking for {needs}, and we\'ve got a few things that fit exactly.]]\nUp for a quick chat?' },
  { id: 'personal_budget', cat: 'personal', he_title: 'אישי – לפי התקציב', en_title: 'Personal – by budget',
    he: 'היי {name}, תודה על ההתעניינות ב{property}.[[ ראינו שציינתם תקציב של {budget}.]]\nנשמח להראות לכם מה הכי מתאים, מתי נוח לדבר?',
    en: 'Hi {name}, thanks for your interest in {property}.[[ We saw you mentioned a budget of {budget}.]]\nHappy to show you what fits best. When\'s good to talk?' },
  { id: 'personal_message', cat: 'personal', he_title: 'אישי – מתייחס למה שכתב', en_title: 'Personal – answers what they wrote',
    he: 'היי {name}, קראנו מה שכתבתם[[: "{message}"]].\nזה בדיוק סוג הדברים שעדיף לדבר עליהם, יש לכם כמה דקות היום?',
    en: 'Hi {name}, we read what you wrote[[: "{message}"]].\nThat\'s exactly the kind of thing that\'s better talked through. Got a few minutes today?' },
  { id: 'personal_investor', cat: 'personal', he_title: 'אישי – משקיע', en_title: 'Personal – investor',
    he: 'היי {name}, ראינו שהתעניינתם ב{property}[[ ושהמטרה היא {purpose}]].\nנשלח לכם סקירה קצרה עם המספרים: מחיר, מצב תכנוני, טאבו ותשואה צפויה[[, ביחס לתקציב של {budget}]].\nואם יש לכם 10 דקות השבוע, נשמח לעבור על זה איתכם.',
    en: 'Hi {name}, we saw you were interested in {property}[[ and that the goal is {purpose}]].\nWe\'ll send you a short overview with the numbers: price, planning status, Tabu and expected return[[, against a budget of {budget}]].\nAnd if you have 10 minutes this week, we\'d be glad to go through it with you.' },
  { id: 'personal_timeline', cat: 'personal', he_title: 'אישי – לפי לוח הזמנים', en_title: 'Personal – by timeline',
    he: 'היי {name}, תודה שפניתם לגבי {property}.[[ ראינו שאתם מתכננים לעבור {timeline}, וזה בדיוק הזמן להתחיל לבדוק.]]\nבא לכם שנשב על זה ונבנה תוכנית?',
    en: 'Hi {name}, thanks for reaching out about {property}.[[ We saw you\'re planning to move {timeline}, which is exactly the time to start looking.]]\nShall we sit down and make a plan?' },
  { id: 'personal_followup', cat: 'personal', he_title: 'אישי – מעקב לפי מה שביקש', en_title: 'Personal – follow-up on their request',
    he: 'היי {name}, חזרנו לפנייה שלכם על {property}[[ ({needs})]].\nבינתיים עברנו על מה שיש ומצאנו כמה דברים ששווה לכם לראות. נדבר השבוע?',
    en: 'Hi {name}, we went back to your inquiry about {property}[[ ({needs})]].\nIn the meantime we went through what\'s out there and found a few things worth a look. Talk this week?' },
  { id: 'seller_invite', cat: 'general', he_title: 'בעל נכס – טופס קליטה', en_title: 'Owner – intake form',
    he: 'היי {name}, כדי שנוכל לשווק את הנכס שלכם כמו שצריך, הכי פשוט למלא פה את הפרטים ולהעלות תמונות (לוקח בערך 5 דקות):\n{sellLink}',
    en: 'Hi {name}, so we can market your property properly, the easiest way is to fill in the details and upload photos here (takes about 5 minutes):\n{sellLink}' },
  { id: 'holiday', cat: 'general', he_title: 'ברכת חג', en_title: 'Holiday greeting',
    he: 'חג שמח {name}!\nשתהיה לכם שנה טובה ושקטה, עם הרבה בריאות.[[\n{agent}]]',
    en: 'Happy holidays[[, {name}]]!\nWishing you a good, calm year with lots of health.[[\n{agent}]]' },
  // ── chat-ready replies (the WhatsApp page's template picker) ──
  { id: 'send_details', cat: 'progress', he_title: 'שליחת פרטי הנכס', en_title: 'Sending the property details',
    he: 'היי {name}, הנה הפרטים על {property}: תמונות, מפרט ומחיר.\nכשיהיה לכם רגע לעבור על זה, נשמח לשמוע מה דעתכם. ואם בא לכם לראות במציאות, נקבע ביקור.',
    en: 'Hi {name}, here are the details on {property}: photos, specs and price.\nWhen you get a moment to look, we\'d love to hear what you think. And if you want to see it in person, we\'ll set up a visit.' },
  { id: 'visit_offer', cat: 'progress', he_title: 'הצעה לביקור בנכס', en_title: 'Offering a viewing',
    he: 'היי {name}, את {property} באמת עדיף לראות במקום, התמונות לא עושות לזה צדק.\nיש לנו זמן השבוע בבקרים ואחר הצהריים, מה מתאים לכם?',
    en: 'Hi {name}, {property} really is better seen in person, the photos don\'t do it justice.\nWe\'ve got time this week, mornings and afternoons. What suits you?' },
  { id: 'visit_directions', cat: 'progress', he_title: 'הגעה לביקור – פרטים', en_title: 'Viewing – how to get there',
    he: 'היי {name}, לקראת הביקור ב{property}: נשלח לכם פה את הכתובת המדויקת ואיפה נפגשים.\nאם מתעכבים או שמשהו משתנה, אפשר להתקשר: {phone}\nנתראה!',
    en: 'Hi {name}, ahead of the visit to {property}: we\'ll send you the exact address and where we meet, right here.\nIf you\'re running late or anything changes, you can call: {phone}\nSee you there!' },
  { id: 'after_visit', cat: 'progress', he_title: 'אחרי ביקור – מה התרשמת?', en_title: 'After the viewing – your impression',
    he: 'היי {name}, תודה שבאתם לראות את {property}! מה התרשמתם?\nאם נשארו שאלות על המחיר או התנאים, נשמח לענות.',
    en: 'Hi {name}, thanks for coming to see {property}! What did you think?\nIf any questions are left on the price or terms, happy to answer.' },
  { id: 'financing', cat: 'progress', he_title: 'מימון ומשכנתא', en_title: 'Financing and mortgage',
    he: 'היי {name}, משהו שכדאי לסגור מוקדם זה המימון.\nיש יועץ משכנתאות שאנחנו עובדים איתו הרבה, והוא יכול לעשות לכם בדיקה ראשונית בלי התחייבות. לחבר ביניכם?',
    en: 'Hi {name}, one thing worth sorting out early is the financing.\nWe work a lot with a mortgage adviser who can run a first check for you, no strings attached. Shall we connect you?' },
  { id: 'similar_props', cat: 'progress', he_title: 'נכסים דומים שעשויים להתאים', en_title: 'Similar properties that may fit',
    he: 'היי {name}, בהמשך למה שחיפשתם[[ ({needs})]], יש לנו עוד כמה נכסים באותו כיוון. לשלוח לכם?',
    en: 'Hi {name}, following what you were looking for[[ ({needs})]], we\'ve got a few more properties along the same lines. Shall we send them?' },
  { id: 'price_update', cat: 'progress', he_title: 'עדכון מחיר / תנאים', en_title: 'Price or terms update',
    he: 'היי {name}, יש חדש ב{property}, המחיר והתנאים השתנו.\nאם זה עדיין מעניין אתכם, עכשיו זה זמן טוב לדבר.',
    en: 'Hi {name}, there\'s news on {property}, the price and terms have changed.\nIf it still interests you, now\'s a good time to talk.' },
  { id: 'call_back_later', cat: 'general', he_title: 'לא זמין כרגע – נחזור אליך', en_title: 'Busy right now – will call back',
    he: 'היי {name}, ראינו, תודה! אנחנו בפגישה כרגע, נחזור אליכם עוד היום.',
    en: 'Hi {name}, saw this, thanks! We\'re in a meeting right now, we\'ll get back to you later today.' },
  { id: 'office_hours', cat: 'general', he_title: 'שעות פעילות ודרכי קשר', en_title: 'Office hours and contact',
    he: 'היי {name}, אנחנו במשרד א׳-ה׳ בין 9 ל-19, ובשישי עד 13.\nבוואטסאפ אפשר לכתוב לנו תמיד, ובטלפון: {phone}',
    en: 'Hi {name}, we\'re in the office Sunday to Thursday from 9 to 7, and Fridays until 1.\nYou can always write to us here on WhatsApp, or call: {phone}' },
  { id: 'new_listing', cat: 'general', he_title: 'נכס חדש שעשוי להתאים', en_title: 'A new listing that may fit',
    he: 'היי {name}, נכנס אלינו היום נכס וישר חשבנו עליכם[[ ({needs})]].\nעוד לא פרסמנו אותו, לשלוח לכם פרטים?',
    en: 'Hi {name}, a property came in today and we thought of you straight away[[ ({needs})]].\nWe haven\'t advertised it yet. Want the details?' },
  { id: 'seller_valuation', cat: 'general', he_title: 'בעל נכס – הערכת שווי', en_title: 'Owner – property valuation',
    he: 'היי {name}, נשמח לתת לכם הערכה אמיתית כמה הנכס שווה היום, לפי עסקאות שנסגרו באזור לאחרונה. בלי עלות ובלי התחייבות.\nאפשר להתחיל פה: {sellLink}',
    en: 'Hi {name}, we\'d be glad to give you a realistic idea of what your property is worth today, based on deals closed in the area recently. Free, no strings attached.\nYou can start here: {sellLink}' },
  { id: 'nr_weekend', cat: 'followup', he_title: 'לא ענה – אחרי סוף השבוע', en_title: 'No reply – after the weekend',
    he: 'היי {name}, שבוע טוב!\nרצינו לחזור לפרטים שהשארתם[[ על {property}]]. יש מצב לשיחה קצרה מחר בבוקר?',
    en: 'Hi {name}, hope you had a good weekend!\nWe wanted to come back to the details you left[[ about {property}]]. Any chance of a quick call tomorrow morning?' },
  { id: 'deal_next_steps', cat: 'deal', he_title: 'לקראת חתימה – הצעדים הבאים', en_title: 'Before signing – next steps',
    he: 'היי {name}, לקראת החתימה, ככה זה ייראה מכאן: קודם בודקים את נסח הטאבו ומסמכי הנכס, אחר כך מעבירים הכול לעורכי הדין של שני הצדדים, ואז קובעים מועד לחתימה.\nאנחנו איתכם בכל שלב, כל שאלה פשוט לכתוב לנו.',
    en: 'Hi {name}, ahead of the signing, here\'s how it goes from here: first we check the Tabu extract and the property documents, then everything goes to both sides\' lawyers, and then we set a date to sign.\nWe\'re with you every step of the way, for any question just message us.' },
  { id: 'deal_docs', cat: 'deal', he_title: 'מסמכים לחוזה', en_title: 'Documents for the contract',
    he: 'היי {name}, בשביל החוזה נצטרך מכם צילום ת"ז, את הפרטים של עורך הדין שלכם, ואישור עקרוני למשכנתא אם יש.\nאפשר לשלוח הכול לכאן.',
    en: 'Hi {name}, for the contract we\'ll need a copy of your ID, your lawyer\'s details, and a mortgage approval in principle if you have one.\nYou can send it all here.' },
  { id: 'deal_keys', cat: 'deal', he_title: 'מסירת מפתח', en_title: 'Handing over the keys',
    he: 'מזל טוב {name}!! היום זה קורה, המפתח ל{property} אצלכם.\nתודה על האמון לאורך כל הדרך. וגם אחרי, אם צריך משהו, אנחנו כאן.',
    en: 'Congratulations[[, {name}]]!! Today\'s the day, the keys to {property} are yours.\nThanks for trusting us all the way. And afterwards too, if you need anything, we\'re here.' },
  { id: 'review_request', cat: 'deal', he_title: 'בקשת חוות דעת', en_title: 'Asking for a review',
    he: 'היי {name}, היה כיף ללוות אתכם!\nאם הייתם מרוצים, כמה מילים על אפיק הנחל בגוגל יעזרו לנו מאוד, ככה עוד אנשים מוצאים אותנו. תודה מראש!',
    en: 'Hi {name}, it was great working with you!\nIf you were happy, a few words about Afik Hanahal on Google would really help us, it\'s how more people find us. Thanks in advance!' },
  { id: 'referral', cat: 'deal', he_title: 'בקשת המלצה / הפניה', en_title: 'Asking for a referral',
    he: 'היי {name}, בקשה קטנה: אם יש מישהו בסביבה שלכם שמחפש לקנות, למכור או להשכיר בשרון, נשמח לעזור גם לו. תודה!',
    en: 'Hi {name}, a small favour: if anyone around you is looking to buy, sell or rent in the Sharon, we\'d be glad to help them too. Thanks!' },
  { id: 'thanks_short', cat: 'general', he_title: 'תודה – קצר', en_title: 'Thank you – short',
    he: 'תודה {name}, קיבלנו! נחזור אליכם עם עדכון.',
    en: 'Thanks[[, {name}]], got it! We\'ll get back to you with an update.' },
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
