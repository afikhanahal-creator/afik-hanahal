// ─── SELLER INTAKE FORM — question schema ────────────────────────────────────
// Framework-free (no React) so the same schema powers the public form, the
// admin "seller forms" tab AND the serverless notification e-mail/WhatsApp.
//
// Every step is one screen (Typeform style). Bilingual by design: each label
// has an `en` twin. `showIf(answers)` drives the conditional logic so sellers
// only ever see questions that are relevant to their property.
//
// Order follows the office intake questionnaire:
//   1 היכרות · 2 פרטי הנכס · 3 מאפייני הנכס · 4 מצב הנכס · 5 הבניין
//   6 מידע משפטי ותכנוני · 7 המכירה והציפיות · 8 מידע שיווקי · 9 חומרים · 10 סיכום
//
// Step types
//   intro    – section cover screen
//   text     – single-line text          long    – multi-line text
//   number   – numeric (unit / thousands) phone   – Israeli phone number
//   email    – e-mail                    date    – date picker
//   choice   – pick ONE (letter keys, auto-advance)
//   multi    – pick MANY (checkbox pills)
//   counter  – one or more numeric steppers (rows)
//   group    – several short fields on one screen (address, fees…)
//   matrix   – rows × scale (condition ratings, legal yes/no/unknown)
//   toggles  – rows of yes/no switches
//   upload   – file drop-zone (photos / videos / documents)
//   review   – summary + consent + submit

const o = (v, l, en) => ({ v, l, en })

const YES_NO = [o('yes', 'כן', 'Yes'), o('no', 'לא', 'No')]
const YES_NO_UNKNOWN = [o('yes', 'כן', 'Yes'), o('no', 'לא', 'No'), o('unknown', 'לא יודע/ת', "Don't know")]

// ── purpose (sale | rental) ──────────────────────────────────────────────────
// One dynamic questionnaire: a step (or a matrix row / section) may declare
// `appliesTo: ['sale']` / `['rental']`, and any text or option list may be an
// object keyed by purpose ({ sale: …, rental: … }). Everything else is shared.
export const PURPOSES = ['sale', 'rental']
export const purposeOf = a => (a && a.x_purpose === 'rental' ? 'rental' : 'sale')
export const PURPOSE_LABEL = { sale: { he: 'מכירה', en: 'Sale' }, rental: { he: 'השכרה', en: 'Rental' } }
export const byPurpose = (v, a) => (v && typeof v === 'object' && !Array.isArray(v) && ('sale' in v || 'rental' in v)) ? (v[purposeOf(a)] ?? v.sale ?? v.rental) : v
export const stepOpts = (step, a) => byPurpose(step.opts, a) || []
const appliesTo = (x, a) => !x.appliesTo || x.appliesTo.includes(purposeOf(a))

// ── answer helpers ────────────────────────────────────────────────────────────
export const isLand   = a => a.p_type === 'land'
export const isHouse  = a => ['cottage', 'house', 'land'].includes(a.p_type)
export const hasPlot  = a => isHouse(a) || a.p_type === 'garden'
export const hasParking = a => Number(a.f_parking?.parking || 0) > 0
export const hasStorage = a => a.f_storage === 'yes'
const isRented = a => a.k_occupancy === 'rented'

export const SECTIONS = [
  { id: 'contact',   n: 1,  title: 'היכרות',               en: 'About you',               desc: 'כמה פרטים כדי שנדע עם מי אנחנו מדברים',                                 en_desc: 'A few details so we know who we are talking to' },
  { id: 'property',  n: 2,  title: 'פרטי הנכס',            en: 'Property details',        desc: 'כתובת, סוג הנכס, חדרים, שטחים וכיוונים',                                en_desc: 'Address, type, rooms, areas and orientation' },
  { id: 'features',  n: 3,  title: 'מאפייני הנכס',         en: 'Features',                desc: 'ממ״ד, מעלית, חניה, מחסן, מיזוג ומה שיש בנכס',                           en_desc: 'Safe room, elevator, parking, storage, climate and what the property offers' },
  { id: 'condition', n: 4,  title: 'מצב הנכס',             en: 'Condition',               desc: 'שיפוצים, מצב תחזוקתי, מה נשאר בנכס ומי גר בו כיום',                     en_desc: 'Renovations, maintenance, what stays and who lives there today' },
  { id: 'building',  n: 5,  title: 'הבניין',               en: 'The building',            desc: 'מה שחשוב לדעת על הבניין והוועד',                                        en_desc: 'What buyers should know about the building' },
  { id: 'legal',     n: 6,  title: 'מידע משפטי ותכנוני',   en: 'Legal & planning',        desc: 'בעלות, רישום, משכנתא, שעבודים, חריגות וזכויות. המידע משמש לקליטת הנכס בלבד ואינו מהווה תחליף לבדיקה משפטית',   en_desc: 'Ownership, registration, mortgage, liens, violations and rights. This information is used for property intake only and is not a substitute for legal due diligence' },
  { id: 'price',     n: 7,  title: { sale: 'המכירה והציפיות שלכם', rental: 'ההשכרה והציפיות שלכם' }, en: { sale: 'The sale & expectations', rental: 'The rental & expectations' }, desc: { sale: 'מחיר, לוחות זמנים והיסטוריית השיווק — כדי שנבנה אסטרטגיה שמתאימה לכם', rental: 'דמי שכירות, זמינות ותנאי ההשכרה — כדי שנמצא את השוכרים הנכונים' },   en_desc: { sale: 'Price, timing and marketing history, so we build a strategy that fits you', rental: 'Rent, availability and lease terms, so we find the right tenants' } },
  { id: 'marketing', n: 8,  title: 'מידע שיווקי',          en: 'Marketing',               desc: 'מה מיוחד בנכס — זה מה שיבנה את המודעה',                                 en_desc: 'What makes the property special. This shapes the listing' },
  { id: 'media',     n: 9,  title: 'תמונות ומסמכים',       en: 'Photos & documents',      desc: 'העלאת תמונות, סרטונים ומסמכים לתיק הנכס',                               en_desc: 'Upload photos, videos and documents for the property file' },
  { id: 'review',    n: 10, title: 'סיכום ושליחה',         en: 'Review & submit',         desc: 'בדיקה אחרונה לפני שהטופס עובר אלינו',                                    en_desc: 'One last look before the form reaches us' },
]

export const STEPS = [
  // ═══════════════════ 0. PURPOSE (sale / rental) ═══════════════════════════
  { id: 'x_purpose', section: 'contact', type: 'choice', required: true, grid: true, big: true,
    q: 'במה אתם מעוניינים?', en_q: 'What would you like to do?',
    help: 'השאלון מתאים את עצמו לבחירה. אפשר לשנות בכל שלב', en_help: 'The questionnaire adapts to your choice. You can change it at any time',
    opts: [ o('sale', 'מכירת נכס', 'Sell a property'), o('rental', 'השכרת נכס', 'Rent out a property') ] },
  // ═══════════════════ 1. CONTACT ═══════════════════════════════════════════
  { id: 'c_intro', section: 'contact', type: 'intro' },
  { id: 'c_name', section: 'contact', type: 'text', required: true,
    q: 'נעים מאוד! מה שמך המלא?', en_q: 'Nice to meet you! What is your full name?',
    ph: 'שם פרטי ושם משפחה', en_ph: 'First and last name', autocomplete: 'name' },
  { id: 'c_phone', section: 'contact', type: 'phone', required: true,
    q: 'מה מספר הטלפון שלך?', en_q: 'What is your phone number?',
    help: 'נשתמש בו רק כדי ליצור איתך קשר לגבי הנכס', en_help: 'Used only to contact you about this property',
    ph: '050-000-0000', en_ph: '050-000-0000' },
  { id: 'c_email', section: 'contact', type: 'email',
    q: 'ומה כתובת האימייל שלך?', en_q: 'And your e-mail address?',
    help: 'נשלח לשם עותק של הטופס ועדכונים על תהליך השיווק', en_help: 'We will send a copy of this form and marketing updates there',
    ph: 'name@example.com', en_ph: 'name@example.com' },
  { id: 'c_role', section: 'contact', type: 'choice', required: true,
    q: 'מה הקשר שלך לנכס?', en_q: 'What is your relationship to the property?',
    opts: [
      o('owner',   'אני הבעלים',                 'I am the owner'),
      o('partial', 'אחד/ת מהבעלים',              'One of the owners'),
      o('poa',     'מיופה/ת כוח',                'Power of attorney'),
      o('family',  'בן/בת משפחה של הבעלים',      'Family member of the owner'),
      o('other',   'אחר',                        'Other'),
    ] },
  { id: 'c_extra', section: 'contact', type: 'group',
    q: 'יש איש קשר נוסף שכדאי שנכיר?', en_q: 'Is there another contact person we should know?',
    help: 'לא חובה — למשל בן/בת זוג, שותף/ה או עו״ד', en_help: 'Optional. A spouse, partner or lawyer, for example',
    fields: [
      { k: 'name',     l: 'שם',           en: 'Name',         type: 'text', half: true },
      { k: 'phone',    l: 'טלפון',        en: 'Phone',        type: 'tel',  half: true },
      { k: 'relation', l: 'הקשר לנכס',   en: 'Relationship', type: 'text' },
    ] },
  { id: 'c_privacy', section: 'contact', type: 'toggles', required: true,
    q: 'כמה הגדרות פרטיות לפרסום', en_q: 'A couple of privacy settings for the listing',
    help: 'אפשר לשנות בכל שלב', en_help: 'You can change these at any time',
    rows: [
      { k: 'publishPhone', l: 'לפרסם את מספר הטלפון שלך במודעה',  en: 'Show your phone number in the listing' },
      { k: 'showAddress',  l: 'להציג את הכתובת המדויקת בפרסום',  en: 'Show the exact address in the listing' },
    ] },

  // ═══════════════════ 2. PROPERTY ══════════════════════════════════════════
  { id: 'p_intro', section: 'property', type: 'intro' },
  { id: 'p_type', section: 'property', type: 'choice', required: true, grid: true,
    q: { sale: 'איזה סוג נכס אתם מוכרים?', rental: 'איזה סוג נכס אתם משכירים?' }, en_q: { sale: 'What type of property are you selling?', rental: 'What type of property are you renting out?' },
    other_ph: 'איזה נכס? תארו במילים', en_other_ph: 'Describe the property',
    opts: [
      o('apartment',  'דירה',                 'Apartment'),
      o('garden',     'דירת גן',              'Garden apartment'),
      o('penthouse',  'פנטהאוז',              'Penthouse'),
      o('duplex',     'דופלקס',               'Duplex'),
      o('cottage',    'קוטג׳ / דו-משפחתי',    'Cottage / semi-detached'),
      o('house',      'בית פרטי / וילה',      'Private house / villa'),
      o('land',       'מגרש',                 'Plot of land'),
      o('commercial', 'נכס מסחרי',            'Commercial property'),
      o('other',      'אחר',                  'Other'),
    ] },
  { id: 'p_address', section: 'property', type: 'group', required: true,
    q: 'מה הכתובת המלאה של הנכס?', en_q: 'What is the full address of the property?',
    help: 'הכתובת המלאה נשארת אצלנו — היא תפורסם רק אם אישרתם', en_help: 'The full address stays with us and is published only with your approval',
    fields: [
      { k: 'city',         l: 'עיר / יישוב',   en: 'City / town',    type: 'city', required: true, half: true, ph: 'התחילו להקליד ובחרו מהרשימה', en_ph: 'Start typing and pick from the list' },
      { k: 'neighborhood', l: 'שכונה',         en: 'Neighborhood',   type: 'text', half: true },
      { k: 'street',       l: 'רחוב',          en: 'Street',         type: 'street', required: true, half: true, ph: 'התחילו להקליד', en_ph: 'Start typing' },
      { k: 'number',       l: 'מספר בית',      en: 'House number',   type: 'text', required: true, half: true },
      { k: 'entrance',     l: 'כניסה',         en: 'Entrance',       type: 'text', half: true, showIf: a => !isHouse(a) },
      { k: 'apt',          l: 'מספר דירה',     en: 'Apartment no.',  type: 'text', half: true, showIf: a => !isHouse(a) },
    ] },
  { id: 'p_rooms', section: 'property', type: 'choice', required: true, select: true, showIf: a => !isLand(a),
    q: 'כמה חדרים בנכס?', en_q: 'How many rooms does the property have?',
    help: 'לפי הספירה הישראלית: סלון נחשב חדר', en_help: 'Israeli count: the living room counts as a room',
    opts: ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10+']
      .map(v => o(v, v === '1' ? 'חדר אחד' : v === '10+' ? '10 חדרים ומעלה' : `${v} חדרים`, v === '1' ? '1 room' : v === '10+' ? '10+ rooms' : `${v} rooms`)) },
  { id: 'p_floor', section: 'property', type: 'group', required: true, showIf: a => !isHouse(a),
    q: 'באיזו קומה הנכס?', en_q: 'Which floor is the property on?',
    fields: [
      { k: 'floor',       l: 'קומה',                en: 'Floor',            type: 'number', required: true, half: true, ph: '0 = קרקע', en_ph: '0 = ground' },
      { k: 'totalFloors', l: 'מתוך כמה קומות',      en: 'Out of how many',  type: 'number', half: true },
    ] },
  { id: 'p_area', section: 'property', type: 'group', required: true,
    q: 'מה השטחים של הנכס?', en_q: 'What are the property areas?',
    help: 'במ״ר. אם אין נתון מדויק — הערכה טובה מספיקה, נאמת מול המסמכים', en_help: 'In square meters. An estimate is fine. We verify against the documents',
    fields: [
      { k: 'built',   l: 'שטח בנוי',         en: 'Built area',        type: 'number', unit: 'מ״ר', en_unit: 'm²', half: true, required: a => !isLand(a), showIf: a => !isLand(a) },
      { k: 'plot',    l: 'שטח מגרש',         en: 'Plot area',         type: 'number', unit: 'מ״ר', en_unit: 'm²', half: true, required: a => isLand(a), showIf: a => hasPlot(a) },
      { k: 'balcony', l: 'מרפסת',            en: 'Balcony',           type: 'number', unit: 'מ״ר', en_unit: 'm²', half: true, showIf: a => !isLand(a) },
      { k: 'roof',    l: 'גג',               en: 'Roof',              type: 'number', unit: 'מ״ר', en_unit: 'm²', half: true, showIf: a => !isLand(a) },
      { k: 'garden',  l: 'גינה',             en: 'Garden',            type: 'number', unit: 'מ״ר', en_unit: 'm²', half: true, showIf: a => !isLand(a) },
    ] },
  { id: 'p_baths', section: 'property', type: 'counter', required: true, showIf: a => !isLand(a),
    q: 'חדרי רחצה ושירותים', en_q: 'Bathrooms and toilets',
    rows: [
      { k: 'bathrooms', l: 'חדרי רחצה',       en: 'Bathrooms', min: 0, max: 10, step: 1, def: 1 },
      { k: 'toilets',   l: 'שירותים (סה״כ)',  en: 'Toilets (total)', min: 0, max: 10, step: 1, def: 1 },
    ] },
  { id: 'p_year', section: 'property', type: 'number', showIf: a => !isLand(a),
    q: 'באיזו שנה נבנה הנכס?', en_q: 'What year was the property built?',
    help: 'בערך זה בסדר — אפשר לדלג אם לא יודעים', en_help: 'An estimate is fine. Skip if you do not know',
    ph: 'לדוגמה: 2005', en_ph: 'e.g. 2005', min: 1880, max: 2030 },
  { id: 'p_directions', section: 'property', type: 'multi', showIf: a => !isLand(a),
    q: 'לאילו כיווני אוויר פונה הנכס?', en_q: 'Which directions does the property face?',
    help: 'סמנו את הכיוונים, ולמטה יופיע תיאור מלא שאפשר לערוך', en_help: 'Pick the directions. A full description appears below and can be edited',
    note: true,
    opts: [ o('north', 'צפון', 'North'), o('south', 'דרום', 'South'), o('east', 'מזרח', 'East'), o('west', 'מערב', 'West') ] },
  { id: 'p_view', section: 'property', type: 'multi',
    q: 'מה הנוף מהנכס? יש כיוון מיוחד?', en_q: 'What is the view? Anything special about the orientation?',
    opts: [
      o('open',   'נוף פתוח',          'Open view'),
      o('urban',  'נוף עירוני',        'Urban view'),
      o('sea',    'ים',                'Sea'),
      o('park',   'פארק / ירוק',       'Park / greenery'),
      o('garden', 'גינה',              'Garden'),
      o('hills',  'הרים / שטחים פתוחים', 'Hills / open fields'),
      o('sunset', 'שקיעה / כיוון שמש מיוחד', 'Sunset / special sun exposure'),
      o('none',   'ללא נוף מיוחד',     'No particular view'),
    ] },

  // ═══════════════════ 3. FEATURES ══════════════════════════════════════════
  { id: 'f_intro', section: 'features', type: 'intro', showIf: a => !isLand(a) },
  { id: 'f_mamad', section: 'features', type: 'choice', required: true, showIf: a => !isLand(a),
    q: 'האם יש ממ״ד בנכס?', en_q: 'Does the property have a safe room (Mamad)?',
    opts: [ o('yes', 'כן', 'Yes'), o('no', 'לא', 'No'), o('shared', 'ממ״ק / מקלט משותף בבניין', 'Shared shelter in the building') ] },
  { id: 'f_elevator', section: 'features', type: 'choice', required: true, showIf: a => !isHouse(a),
    q: 'האם יש מעלית בבניין?', en_q: 'Is there an elevator in the building?',
    opts: [ o('yes', 'כן', 'Yes'), o('shabbat', 'כן, כולל מעלית שבת', 'Yes, including a Shabbat elevator'), o('no', 'אין מעלית', 'No elevator') ] },
  { id: 'f_parking', section: 'features', type: 'counter', required: true, showIf: a => !isLand(a),
    q: 'כמה חניות שייכות לנכס?', en_q: 'How many parking spaces come with the property?',
    rows: [ { k: 'parking', l: 'חניות', en: 'Parking spaces', min: 0, max: 10, step: 1, def: 1 } ] },
  { id: 'f_parking_type', section: 'features', type: 'multi', showIf: a => !isLand(a) && hasParking(a),
    q: 'איזה סוג חניה? האם היא מקורה?', en_q: 'What kind of parking? Is it covered?',
    linkedCounter: { id: 'f_parking', k: 'parking', l: 'מספר חניות', en: 'Parking spaces', min: 1, max: 10 },
    opts: [
      o('regular',     'חניה פתוחה (לא מקורה)',  'Open (not covered)'),
      o('covered',     'חניה מקורה',            'Covered'),
      o('underground', 'תת-קרקעית',             'Underground'),
      o('double',      'חניה כפולה / טורית',    'Double / tandem'),
      o('ev',          'הכנה לרכב חשמלי',       'EV charging ready'),
    ] },
  { id: 'f_storage', section: 'features', type: 'choice', required: true, showIf: a => !isLand(a),
    q: 'האם יש מחסן?', en_q: 'Is there a storage room?', opts: YES_NO },
  { id: 'f_storage_size', section: 'features', type: 'number', showIf: a => !isLand(a) && hasStorage(a),
    q: 'מה גודל המחסן?', en_q: 'How big is the storage room?', unit: 'מ״ר', en_unit: 'm²', ph: 'לדוגמה: 6', en_ph: 'e.g. 6', min: 0, max: 500 },
  { id: 'f_climate', section: 'features', type: 'choice', required: true, showIf: a => !isLand(a),
    q: 'איזה סוג מיזוג יש בנכס?', en_q: 'What type of air conditioning does the property have?',
    opts: [
      o('central', 'מיזוג מרכזי',          'Central air conditioning'),
      o('mini',    'מיני-מרכזי',           'Mini-central'),
      o('units',   'מזגנים בכל החדרים',    'Split units in every room'),
      o('partial', 'מזגן בחלק מהחדרים',    'Units in some rooms'),
      o('none',    'אין מיזוג',            'No air conditioning'),
      o('other',   'אחר',                  'Other'),
    ] },
  { id: 'f_kitchen', section: 'features', type: 'choice', showIf: a => !isLand(a),
    q: 'איך המטבח בנוי?', en_q: 'How is the kitchen laid out?',
    opts: [
      o('open',   'מטבח פתוח לסלון',   'Open to the living room'),
      o('semi',   'חצי פתוח',          'Semi-open'),
      o('closed', 'מטבח סגור',         'Closed kitchen'),
    ] },
  { id: 'f_island', section: 'features', type: 'choice', showIf: a => !isLand(a),
    q: 'האם יש אי במטבח?', en_q: 'Is there a kitchen island?', opts: YES_NO },
  { id: 'f_rooms', section: 'features', type: 'multi', showIf: a => !isLand(a),
    q: 'אילו חללים נוספים יש בנכס?', en_q: 'Which additional spaces does the property include?',
    help: 'סמנו את כל מה שרלוונטי', en_help: 'Select everything that applies',
    opts: [
      o('closet',  'חדר ארונות',      'Walk-in closet'),
      o('laundry', 'חדר כביסה',       'Laundry room'),
      o('family',  'חדר משפחה',       'Family room'),
      o('office',  'חדר עבודה',       'Home office'),
      o('balcony', 'מרפסת',           'Balcony'),
      o('sukkah',  'מרפסת סוכה',      'Sukkah balcony'),
      o('garden',  'גינה',            'Garden'),
      o('roof',    'גג',              'Roof'),
      o('pool',    'בריכה',           'Pool'),
      o('basement','מרתף',            'Basement'),
      o('unit',    'יחידת דיור נפרדת', 'Separate housing unit'),
    ] },
  { id: 'f_water', section: 'features', type: 'multi', showIf: a => !isLand(a),
    q: 'איך מחממים מים?', en_q: 'How is water heated?',
    opts: [
      o('solar',    'דוד שמש',        'Solar water heater'),
      o('electric', 'דוד חשמלי',      'Electric boiler'),
      o('gas',      'גז',             'Gas'),
      o('central',  'חימום מרכזי',    'Central heating'),
      o('other',    'אחר',            'Other'),
    ] },
  { id: 'f_systems', section: 'features', type: 'multi', showIf: a => !isLand(a),
    q: 'מערכות ותוספות בנכס', en_q: 'Systems and extras',
    opts: [
      o('smart',    'מערכת בית חכם',                 'Smart-home system'),
      o('shutters', 'תריסים חשמליים',                 'Electric shutters'),
      o('bars',     'סורגים',                         'Window bars'),
      o('windows',  'חלונות מיוחדים (טרמיים/אקוסטיים)', 'Special windows (thermal / acoustic)'),
      o('alarm',    'אזעקה',                          'Alarm'),
      o('cameras',  'מצלמות',                         'Cameras'),
      o('heating',  'חימום תת-רצפתי',                 'Underfloor heating'),
      o('accessible','נגישות לנכים',                  'Wheelchair accessible'),
      o('none',     'אין תוספות מיוחדות',             'No special extras'),
    ] },

  // ═══════════════════ 4. CONDITION ═════════════════════════════════════════
  { id: 'k_intro', section: 'condition', type: 'intro', showIf: a => !isLand(a) },
  { id: 'p_state', section: 'condition', type: 'choice', required: true, showIf: a => !isLand(a),
    q: 'איך היית מגדיר/ה את מצב הנכס?', en_q: 'How would you describe the property?',
    opts: [
      o('new',       'חדש מקבלן',              'Brand new from developer'),
      o('secondhand','יד שנייה במצב טוב',      'Second-hand, good condition'),
      o('renovated', 'לאחר שיפוץ',             'Recently renovated'),
      o('needs',     'דורש שיפוץ',             'Needs renovation'),
    ] },
  { id: 'k_renovated', section: 'condition', type: 'choice', required: true, showIf: a => !isLand(a),
    q: 'האם הנכס שופץ?', en_q: 'Has the property been renovated?',
    opts: [ o('yes', 'כן', 'Yes'), o('no', 'לא', 'No'), o('partial', 'שיפוץ חלקי', 'Partially') ] },
  { id: 'k_reno_year', section: 'condition', type: 'text', showIf: a => !isLand(a) && ['yes', 'partial'].includes(a.k_renovated),
    q: 'מתי בוצע השיפוץ?', en_q: 'When was the renovation done?', ph: 'לדוגמה: 2021', en_ph: 'e.g. 2021' },
  { id: 'k_reno_what', section: 'condition', type: 'multi', showIf: a => !isLand(a) && ['yes', 'partial'].includes(a.k_renovated),
    q: 'מה שופץ?', en_q: 'What was renovated?',
    opts: [
      o('kitchen',  'מטבח',          'Kitchen'),
      o('baths',    'חדרי רחצה',     'Bathrooms'),
      o('floor',    'ריצוף',         'Flooring'),
      o('electric', 'חשמל',          'Electrical'),
      o('plumbing', 'אינסטלציה',     'Plumbing'),
      o('windows',  'חלונות',        'Windows'),
      o('paint',    'צבע',           'Paint'),
      o('ac',       'מיזוג',         'Air conditioning'),
      o('doors',    'דלתות',         'Doors'),
      o('closets',  'ארונות',        'Closets'),
      o('aluminum', 'אלומיניום / תריסים', 'Aluminium / shutters'),
      o('sealing',  'איטום',         'Sealing / waterproofing'),
      o('lighting', 'תאורה',         'Lighting'),
      o('roof',     'גג',            'Roof'),
      o('garden',   'גינה / חצר',    'Garden / yard'),
      o('facade',   'חזית / חוץ',    'Facade / exterior'),
      o('full',     'שיפוץ כללי',    'Full renovation'),
      o('other',    'אחר',           'Other'),
    ] },
  { id: 'k_matrix', section: 'condition', type: 'matrix', required: true, showIf: a => !isLand(a),
    q: 'איך היית מדרג/ת את המצב של…', en_q: 'How would you rate the condition of…',
    scale: [ o('excellent', 'מצוין', 'Excellent'), o('good', 'טוב', 'Good'), o('fair', 'סביר', 'Fair'), o('poor', 'דורש טיפול', 'Needs work') ],
    rows: [
      { k: 'kitchen', l: 'המטבח',        en: 'Kitchen' },
      { k: 'baths',   l: 'חדרי הרחצה',   en: 'Bathrooms' },
      { k: 'floor',   l: 'הריצוף',       en: 'Flooring' },
      { k: 'windows', l: 'החלונות',      en: 'Windows' },
      { k: 'ac',      l: 'המזגנים',      en: 'Air conditioning' },
    ] },
  { id: 'k_defects', section: 'condition', type: 'choice', required: true, showIf: a => !isLand(a),
    q: 'האם ידועים לך ליקויים או בעיות בנכס?', en_q: 'Are you aware of any defects or problems?',
    help: { sale: 'שקיפות עוזרת למכור מהר יותר ומונעת הפתעות בבדיקה', rental: 'שקיפות עוזרת להשכיר מהר יותר ומונעת הפתעות בכניסה' }, en_help: { sale: 'Transparency sells faster and avoids surprises at inspection', rental: 'Transparency rents faster and avoids surprises at move-in' },
    opts: YES_NO },
  { id: 'k_defects_detail', section: 'condition', type: 'long', required: true, showIf: a => !isLand(a) && a.k_defects === 'yes',
    q: 'ספרו לנו על הליקויים', en_q: 'Tell us about the defects', ph: 'מה, איפה ומתי התגלה', en_ph: 'What, where and when it was found' },
  { id: 'k_moisture', section: 'condition', type: 'choice', required: true, showIf: a => !isLand(a),
    q: 'רטיבויות או נזילות?', en_q: 'Any moisture or leaks?',
    opts: [
      o('none',    'לא',                       'No'),
      o('fixed',   'היה בעבר וטופל',           'There was, and it was fixed'),
      o('current', 'יש כיום',                  'Yes, currently'),
    ] },
  { id: 'k_investment', section: 'condition', type: 'choice', required: true, showIf: a => !isLand(a),
    q: 'האם הנכס דורש השקעה לפני כניסה?', en_q: 'Does the property need investment before moving in?',
    opts: [
      o('none',  'לא — מוכן לכניסה מיידית',      'No. Ready to move in'),
      o('light', 'השקעה קלה (צבע, תיקונים קטנים)', 'Light work (paint, small repairs)'),
      o('major', 'השקעה משמעותית',               'Significant investment'),
    ] },
  { id: 'f_furniture', section: 'condition', type: 'choice', required: true, showIf: a => !isLand(a),
    q: 'אילו פריטים נשארים בנכס?', en_q: 'Which items stay with the property?',
    opts: [
      o('none',    'כלום — הנכס נמסר ריק',            'Nothing. The property is handed over empty'),
      o('fixed',   'רק הקבוע: מטבח, ארונות קיר, מזגנים', 'Only fixtures: kitchen, built-in closets, AC units'),
      o('partial', 'חלק מהריהוט והמכשירים',           'Some furniture and appliances'),
      o('full',    'מרוהט במלואו',                    'Fully furnished'),
      o('flexible','גמיש, לפי הקונה או השוכר',         'Flexible, depending on the buyer or tenant'),
    ] },
  { id: 'f_furniture_detail', section: 'condition', type: 'long', showIf: a => !isLand(a) && ['partial', 'full', 'flexible'].includes(a.f_furniture),
    q: 'פרטו מה נשאר בנכס', en_q: 'List what stays in the property',
    ph: 'למשל: מטבח, ארונות קיר, מזגנים, מכשירי חשמל, ריהוט סלון…', en_ph: 'e.g. kitchen, built-in closets, AC units, appliances, living-room furniture…' },
  { id: 'k_occupancy', section: 'condition', type: 'choice', required: true,
    q: 'האם הנכס פנוי, או שגרים בו דיירים / שוכרים כיום?', en_q: 'Is the property vacant, or do tenants live there today?',
    opts: [
      o('vacant', 'הנכס פנוי',           'It is vacant'),
      o('owners', 'הבעלים גרים בנכס',    'The owners live there'),
      o('rented', 'יש שוכרים בנכס',      'There are tenants'),
      o('family', 'גרים בו בני משפחה (ללא שכירות)', 'Family members live there (no lease)'),
    ] },
  { id: 'k_lease', section: 'condition', type: 'group', required: true, showIf: isRented,
    q: 'עד מתי השוכרים בנכס?', en_q: 'Until when are the tenants staying?',
    fields: [
      { k: 'leaseEnd', l: 'מועד סיום החוזה',       en: 'Lease end date',   type: 'date',   half: true, required: true },
      { k: 'rent',     l: 'שכר דירה חודשי',        en: 'Monthly rent',     type: 'number', unit: '₪', en_unit: '₪', half: true },
      { k: 'notes',    l: 'הערות (אופציה להארכה, שיתוף פעולה בביקורים)', en: 'Notes (extension option, cooperation with viewings)', type: 'text' },
    ] },

  // ═══════════════════ 5. BUILDING ══════════════════════════════════════════
  { id: 'b_intro', section: 'building', type: 'intro', showIf: a => !isHouse(a) },
  { id: 'b_numbers', section: 'building', type: 'group', showIf: a => !isHouse(a),
    q: 'כמה מספרים על הבניין', en_q: 'A few numbers about the building',
    fields: [
      { k: 'year',       l: 'שנת בנייה',        en: 'Year built',       type: 'number', half: true },
      { k: 'apartments', l: 'דירות בבניין',     en: 'Apartments',       type: 'number', half: true },
      { k: 'floors',     l: 'קומות',            en: 'Floors',           type: 'number', half: true },
      { k: 'elevators',  l: 'מעליות',           en: 'Elevators',        type: 'number', half: true, showIf: a => a.f_elevator !== 'no' },
    ] },
  { id: 'b_amenities', section: 'building', type: 'multi', showIf: a => !isHouse(a),
    q: 'מה יש בבניין?', en_q: 'What does the building offer?',
    opts: [
      o('lobby',        'לובי',              'Lobby'),
      o('guard',        'שומר / אבטחה',      'Doorman / security'),
      o('intercom',     'אינטרקום',          'Intercom'),
      o('cameras',      'מצלמות',            'Cameras'),
      o('accessible',   'נגישות לנכים',      'Wheelchair accessible'),
      o('bikes',        'חדר אופניים',       'Bike room'),
      o('strollers',    'חדר עגלות',         'Stroller room'),
      o('residents',    'חדר דיירים',        'Residents lounge'),
      o('garden',       'גינה משותפת',       'Shared garden'),
      o('pool',         'בריכה',             'Pool'),
      o('gym',          'חדר כושר',          'Gym'),
      o('guestParking', 'חניית אורחים',      'Guest parking'),
      o('other',        'אחר',               'Other'),
    ] },
  { id: 'b_fees', section: 'building', type: 'group', showIf: a => !isHouse(a),
    q: 'תשלומים חודשיים לבניין', en_q: 'Monthly building payments',
    fields: [
      { k: 'vaad',       l: 'ועד בית',    en: 'Building committee', type: 'number', unit: '₪ / חודש', en_unit: '₪ / month', half: true },
      { k: 'management', l: 'דמי ניהול',  en: 'Management fee',     type: 'number', unit: '₪ / חודש', en_unit: '₪ / month', half: true },
    ] },
  { id: 'b_renovation', section: 'building', type: 'choice', showIf: a => !isHouse(a),
    q: 'האם צפוי שיפוץ בבניין?', en_q: 'Is a building renovation expected?',
    opts: [
      o('no',         'לא',                'No'),
      o('planned',    'מתוכנן',            'Planned'),
      o('inProgress', 'בביצוע כרגע',       'In progress'),
      o('unknown',    'לא יודע/ת',         "Don't know"),
    ] },
  { id: 'b_tama', section: 'building', type: 'choice', showIf: a => !isHouse(a),
    q: 'האם הבניין בתהליך התחדשות עירונית?', en_q: 'Is the building in an urban-renewal process?',
    opts: [
      o('none',     'לא',                              'No'),
      o('tama1',    'תמ״א 38/1 — חיזוק ותוספת',        'TAMA 38/1 (reinforcement and addition)'),
      o('tama2',    'תמ״א 38/2 — הריסה ובנייה',        'TAMA 38/2 (demolish and rebuild)'),
      o('pinui',    'פינוי-בינוי',                     'Pinui-Binui (evacuation and reconstruction)'),
      o('checking', 'בבדיקה ראשונית / חתימות',         'Early stage / collecting signatures'),
      o('unknown',  'לא יודע/ת',                       "Don't know"),
    ] },
  { id: 'b_tama_detail', section: 'building', type: 'long', showIf: a => !isHouse(a) && ['tama1', 'tama2', 'pinui', 'checking'].includes(a.b_tama),
    q: 'באיזה שלב נמצא התהליך?', en_q: 'What stage is the process at?',
    ph: 'למשל: נחתם הסכם עם יזם, ממתינים להיתר…', en_ph: 'e.g. agreement signed with developer, waiting for permit…' },

  // ═══════════════════ 6. LEGAL ═════════════════════════════════════════════
  { id: 'l_intro', section: 'legal', type: 'intro' },
  { id: 'l_owners', section: 'legal', type: 'text', required: true,
    q: 'מי הבעלים של הנכס? על שם מי רשומות הזכויות?', en_q: 'Who owns the property? In whose name are the rights registered?',
    ph: 'שמות בעלי הזכויות', en_ph: 'Names of the rights holders' },
  { id: 'l_more_owners', section: 'legal', type: 'choice', required: true,
    q: 'האם יש בעלים נוספים מלבד מי שציינתם?', en_q: 'Are there other owners besides those you listed?',
    opts: [ o('no', 'לא', 'No'), o('yes', 'כן', 'Yes'), o('unknown', 'לא בטוח/ה', 'Not sure') ] },
  { id: 'l_more_owners_detail', section: 'legal', type: 'text', showIf: a => a.l_more_owners === 'yes',
    q: 'מי הבעלים הנוספים?', en_q: 'Who are the other owners?', ph: 'שמות והקשר', en_ph: 'Names and relationship' },
  { id: 'l_agree', section: 'legal', type: 'choice', required: true,
    q: { sale: 'האם כל הבעלים מסכימים למכירה?', rental: 'האם כל הבעלים מסכימים להשכרה?' }, en_q: { sale: 'Do all the owners agree to sell?', rental: 'Do all the owners agree to rent out?' },
    help: 'חשוב לנו לדעת מראש כדי שהעסקה לא תיתקע בשלב החתימה', en_help: 'Knowing in advance keeps the deal from stalling at signing',
    opts: [
      o('yes',     'כן, כולם מסכימים',              'Yes, everyone agrees'),
      o('mostly',  'רובם — עדיין מתאמים עם חלק',     'Most of them. Still coordinating with some'),
      o('no',      'לא, יש התנגדות',                 'No, there is opposition'),
      o('single',  'אני הבעלים היחיד/ה',             'I am the sole owner'),
    ] },
  { id: 'l_inherit', section: 'legal', type: 'choice', required: true, appliesTo: ['sale'],
    q: 'האם הנכס התקבל בירושה?', en_q: 'Was the property inherited?',
    opts: [ o('no', 'לא', 'No'), o('yes', 'כן, הירושה הוסדרה (צו ירושה / קיום צוואה)', 'Yes, and the estate is settled (inheritance / probate order)'), o('pending', 'כן, ההליך עדיין בתהליך', 'Yes, the process is still ongoing') ] },
  { id: 'l_rights', section: 'legal', type: 'choice', required: true,
    q: 'איך הנכס רשום?', en_q: 'How is the property registered?',
    opts: [
      o('tabu',    'טאבו (לשכת רישום מקרקעין)',   'Tabu (Land Registry)'),
      o('rmi',     'רמ״י — מינהל מקרקעי ישראל',   'Israel Land Authority (RMI)'),
      o('company', 'חברה משכנת',                  'Housing company'),
      o('other',   'אחר',                         'Other'),
      o('unknown', 'לא יודע/ת',                   "Don't know"),
    ] },
  { id: 'l_matrix', section: 'legal', type: 'matrix', required: true,
    q: 'סמנו לכל סעיף: כן, לא או לא יודע', en_q: 'For each item mark yes, no or unknown',
    help: '״לא יודע״ זו תשובה לגיטימית. המידע משמש לקליטת הנכס ואינו תחליף לבדיקה משפטית, נאמת הכל בנסח', en_help: '"Unknown" is a perfectly fine answer. This is intake information, not a substitute for legal due diligence. We verify everything in the Tabu extract',
    scale: YES_NO_UNKNOWN,
    rows: [
      { k: 'mortgage',    l: 'קיימת משכנתא על הנכס',                    en: 'There is a mortgage on the property', appliesTo: ['sale'] },
      { k: 'liens',       l: 'קיימים שעבודים או עיקולים',                en: 'There are liens or attachments', appliesTo: ['sale'] },
      { k: 'legalProc',   l: 'קיים הליך משפטי הקשור לנכס',               en: 'There is a legal proceeding related to the property', appliesTo: ['sale'] },
      { k: 'violation',   l: 'ידועה חריגת בנייה בנכס',                   en: 'There is a known building violation' },
      { k: 'permit',      l: 'קיים היתר בנייה לנכס',                     en: 'There is a building permit' },
      { k: 'extraRights', l: 'קיימות זכויות בנייה נוספות שלא נוצלו',     en: 'There are unused additional building rights', appliesTo: ['sale'] },
      { k: 'condo',       l: 'הבניין רשום כבית משותף (צו בית משותף)',    en: 'The building is registered as a condominium', showIf: a => !isHouse(a) },
      { k: 'parkingTabu', l: 'החניה רשומה בנסח כהצמדה לנכס',             en: 'The parking space is registered in the Tabu as attached to the property', showIf: a => hasParking(a) },
      { k: 'storageTabu', l: 'המחסן רשום בנסח כהצמדה לנכס',              en: 'The storage room is registered in the Tabu as attached to the property', showIf: a => hasStorage(a) },
    ] },
  { id: 'l_mortgage', section: 'legal', type: 'number', appliesTo: ['sale'], showIf: a => a.l_matrix?.mortgage === 'yes',
    q: 'מה יתרת המשכנתא המשוערת?', en_q: 'What is the approximate remaining mortgage?',
    help: 'עוזר לנו לתכנן את העסקה — לא מתפרסם', en_help: 'Helps us structure the deal. Never published',
    unit: '₪', en_unit: '₪', thousands: true, ph: '0', en_ph: '0' },
  { id: 'l_issues_detail', section: 'legal', type: 'long', required: true,
    showIf: a => ['liens', 'legalProc', 'violation'].some(k => a.l_matrix?.[k] === 'yes'),
    q: 'ספרו לנו קצת יותר על השעבודים, ההליכים או החריגות', en_q: 'Tell us a little more about the liens, proceedings or violations',
    ph: 'מה קיים, מול מי, ובאיזה שלב', en_ph: 'What exists, with whom, and at what stage' },
  { id: 'l_area_plans', section: 'legal', type: 'choice', required: true,
    q: 'האם ידועות לכם תוכניות בנייה או התחדשות עירונית בסביבת הנכס?', en_q: 'Are you aware of construction or urban-renewal plans around the property?',
    help: 'למשל: בניין חדש ממול, כביש מתוכנן, פינוי-בינוי בשכונה', en_help: 'e.g. a new building across the street, a planned road, renewal in the neighborhood',
    opts: [ o('no', 'לא ידוע לי על תוכניות', 'Not that I know of'), o('yes', 'כן', 'Yes'), o('unknown', 'לא בדקתי', "I haven't checked") ] },
  { id: 'l_area_plans_detail', section: 'legal', type: 'long', showIf: a => a.l_area_plans === 'yes',
    q: 'אילו תוכניות ידועות לכם?', en_q: 'Which plans are you aware of?', ph: 'מה, איפה ומה השלב', en_ph: 'What, where and at what stage' },
  { id: 'l_notes', section: 'legal', type: 'long',
    q: 'הערות משפטיות או תכנוניות נוספות שכדאי שנדע?', en_q: 'Any other legal or planning notes we should know?',
    help: 'למשל: ירושה בתהליך, הסכם שיתוף, הערות בנסח', en_help: 'e.g. inheritance in progress, co-ownership agreement, Tabu remarks',
    ph: 'לא חובה', en_ph: 'Optional' },

  // ═══════════════════ 7. SALE & EXPECTATIONS ═══════════════════════════════
  { id: 'd_intro', section: 'price', type: 'intro' },
  { id: 'd_ask', section: 'price', type: 'number', required: true, thousands: true,
    q: { sale: 'מה מחיר המכירה המבוקש עבור הנכס?', rental: 'מה דמי השכירות החודשיים המבוקשים?' }, en_q: { sale: 'What is the asking sale price?', rental: 'What is the requested monthly rent?' },
    unit: { sale: '₪', rental: '₪ לחודש' }, en_unit: { sale: '₪', rental: '₪ / month' }, ph: { sale: '3,500,000', rental: '7,500' }, en_ph: { sale: '3,500,000', rental: '7,500' }, min: 1 },
  { id: 'd_expected', section: 'price', type: 'number', thousands: true, appliesTo: ['sale'],
    q: 'ובאיזה מחיר אתם מצפים למכור בפועל?', en_q: 'And at what price do you realistically expect to sell?',
    help: 'התשובה הכנה עוזרת לנו לתמחר נכון מההתחלה — לא מתפרסמת', en_help: 'An honest answer helps us price correctly from day one. Never published',
    unit: '₪', en_unit: '₪', ph: 'לא חובה', en_ph: 'Optional' },
  { id: 'd_flex', section: 'price', type: 'choice', required: true,
    q: { sale: 'האם יש גמישות במחיר?', rental: 'האם יש גמישות בדמי השכירות?' }, en_q: { sale: 'Is there flexibility in the price?', rental: 'Is there flexibility in the rent?' },
    opts: [
      o('firm',     'לא — המחיר סופי',                 'No. The price is final'),
      o('little',   'גמישות קטנה',                    'Slight flexibility'),
      o('flexible', 'כן — פתוחים למשא ומתן',          'Yes. Open to negotiation'),
    ] },
  { id: 'd_min', section: 'price', type: 'number', thousands: true,
    q: { sale: 'האם יש מחיר מינימום שאתם מוכנים לשקול?', rental: 'האם יש דמי שכירות מינימליים שאתם מוכנים לשקול?' }, en_q: { sale: 'Is there a minimum price you would consider?', rental: 'Is there a minimum rent you would consider?' },
    help: { sale: 'לעיניים שלנו בלבד — לא מתפרסם ולא נחשף לקונים', rental: 'לעיניים שלנו בלבד — לא מתפרסם ולא נחשף לשוכרים' }, en_help: { sale: 'For our eyes only. Never published or shown to buyers', rental: 'For our eyes only. Never published or shown to tenants' },
    unit: { sale: '₪', rental: '₪ לחודש' }, en_unit: { sale: '₪', rental: '₪ / month' }, ph: 'לא חובה', en_ph: 'Optional' },
  { id: 'd_offers_received', section: 'price', type: 'choice', required: true, appliesTo: ['sale'],
    q: 'האם התקבלו הצעות על הנכס בעבר?', en_q: 'Have you received offers on the property before?',
    opts: YES_NO },
  { id: 'd_best_offer', section: 'price', type: 'group', appliesTo: ['sale'], showIf: a => a.d_offers_received === 'yes',
    q: 'מה המחיר הגבוה ביותר שהוצע לכם עד היום?', en_q: 'What is the highest offer you have received so far?',
    help: 'לעינינו בלבד, לא מתפרסם', en_help: 'For our eyes only. Never published',
    fields: [
      { k: 'amount', l: 'סכום ההצעה',                en: 'Offer amount',   type: 'number', unit: '₪', en_unit: '₪', half: true },
      { k: 'when',   l: 'מתי',                       en: 'When',           type: 'text', half: true, ph: 'לדוגמה: לפני חודשיים', en_ph: 'e.g. two months ago' },
      { k: 'notes',  l: 'ממי ולמה לא נסגר',          en: 'From whom, and why it did not close', type: 'text' },
    ] },
  { id: 'd_timeline', section: 'price', type: 'choice', required: true,
    q: { sale: 'מתי תרצו למכור?', rental: 'מתי הנכס זמין להשכרה?' }, en_q: { sale: 'When would you like to sell?', rental: 'When is the property available to rent?' },
    opts: {
      sale: [
        o('asap',   'כמה שיותר מהר',                  'As soon as possible'),
        o('m3',     'בחודשים הקרובים (עד 3 חודשים)',   'In the coming months (up to 3)'),
        o('m6',     'תוך חצי שנה',                    'Within six months'),
        o('y1',     'תוך שנה',                        'Within a year'),
        o('norush', 'אין לחץ — רק במחיר הנכון',        'No rush. Only at the right price'),
      ],
      rental: [
        o('now',    'זמין מיידית',                    'Available now'),
        o('m1',     'תוך חודש',                       'Within a month'),
        o('m3',     'תוך 1–3 חודשים',                 'Within 1–3 months'),
        o('lease',  'בסיום חוזה השוכרים הנוכחיים',     'When the current lease ends'),
        o('flex',   'גמיש',                           'Flexible'),
      ],
    } },
  { id: 'r_term', section: 'price', type: 'choice', required: true, appliesTo: ['rental'],
    q: 'לאיזו תקופת שכירות אתם מכוונים?', en_q: 'What lease term are you aiming for?',
    opts: [
      o('y1',     'שנה',                             'One year'),
      o('y1opt',  'שנה עם אופציה להארכה',            'One year with an option to extend'),
      o('y2',     'שנתיים ומעלה',                    'Two years or more'),
      o('short',  'טווח קצר (פחות משנה)',            'Short term (under a year)'),
      o('flex',   'גמיש',                            'Flexible'),
    ] },
  { id: 'r_guarantees', section: 'price', type: 'multi', appliesTo: ['rental'],
    q: 'אילו ערבויות תבקשו מהשוכרים?', en_q: 'Which guarantees will you ask tenants for?',
    opts: [
      o('bank',     'ערבות בנקאית',          'Bank guarantee'),
      o('deposit',  'פיקדון',               'Security deposit'),
      o('check',    'צ׳ק ביטחון',           'Security cheque'),
      o('note',     'שטר חוב',              'Promissory note'),
      o('guarantor','ערבים',                'Guarantors'),
      o('flex',     'נחליט יחד',            'We will decide together'),
    ] },
  { id: 'r_included', section: 'price', type: 'multi', appliesTo: ['rental'],
    q: 'מה כלול בדמי השכירות?', en_q: 'What is included in the rent?',
    opts: [
      o('vaad',      'ועד בית',              'Building committee fee'),
      o('arnona',    'ארנונה',               'Municipal tax (Arnona)'),
      o('parking',   'חניה',                 'Parking'),
      o('internet',  'אינטרנט',              'Internet'),
      o('furniture', 'ריהוט',                'Furniture'),
      o('none',      'לא כלול דבר',          'Nothing is included'),
    ] },
  { id: 'r_pets', section: 'price', type: 'choice', required: true, appliesTo: ['rental'],
    q: 'האם מותר להחזיק בעלי חיים בנכס?', en_q: 'Are pets allowed?',
    opts: [ o('yes', 'כן', 'Yes'), o('no', 'לא', 'No'), o('negotiable', 'תלוי, לפי המקרה', 'Depends, case by case') ] },
  { id: 'd_deadline', section: 'price', type: 'group', appliesTo: ['sale'],
    q: 'יש מועד שבו חשוב לכם במיוחד להשלים את המכירה?', en_q: 'Is there a date by which completing the sale is especially important?',
    help: 'דד-ליין אמיתי משנה את האסטרטגיה — אם אין, אפשר לדלג', en_help: 'A real deadline changes the strategy. Skip if there is none',
    fields: [
      { k: 'date',   l: 'תאריך יעד',                 en: 'Target date',    type: 'date', half: true },
      { k: 'reason', l: 'למה התאריך הזה חשוב',        en: 'Why this date matters', type: 'text', half: true, ph: 'לדוגמה: מעבר לחו״ל, רכישת נכס אחר', en_ph: 'e.g. relocating, buying another property' },
    ] },
  { id: 'd_vacate', section: 'price', type: 'choice', required: true, appliesTo: ['sale'],
    q: 'מהו מועד הפינוי הרצוי?', en_q: 'What is the preferred move-out date?',
    opts: [
      o('immediate', 'מיידי',              'Immediately'),
      o('m3',        'עד 3 חודשים',        'Within 3 months'),
      o('m6',        '3–6 חודשים',         '3–6 months'),
      o('y1',        '6–12 חודשים',        '6–12 months'),
      o('later',     'יותר משנה',          'More than a year'),
      o('flexible',  'גמיש',               'Flexible'),
    ] },
  { id: 'd_vacate_flex', section: 'price', type: 'multi', appliesTo: ['sale'],
    q: 'האם ניתן להזיז את מועד הפינוי?', en_q: 'Can the move-out date move?',
    opts: [
      o('earlier', 'ניתן להקדים',        'Can be earlier'),
      o('later',   'ניתן לדחות',         'Can be later'),
      o('no',      'לא ניתן לשנות',      'Cannot change'),
    ] },
  { id: 'd_alt', section: 'price', type: 'choice', required: true, appliesTo: ['sale'],
    q: 'האם אתם צריכים לרכוש נכס אחר לפני המכירה?', en_q: 'Do you need to buy another property before selling?',
    opts: [
      o('no',      'לא',                                  'No'),
      o('looking', 'כן — עדיין מחפשים',                   'Yes. Still searching'),
      o('found',   'כן — כבר נמצא נכס',                   'Yes. A property was already found'),
      o('after',   'נרכוש רק אחרי המכירה',                'We will buy only after the sale'),
    ] },
  { id: 'd_why', section: 'price', type: 'choice', required: true, appliesTo: ['sale'],
    q: 'מה הסיבה למכירה?', en_q: 'What is the reason for selling?',
    help: 'עוזר לנו להתאים את האסטרטגיה — לא מתפרסם', en_help: 'Helps us tailor the strategy. Never published',
    opts: [
      o('upgrade',     'שדרוג לנכס גדול יותר',     'Upgrading to a larger property'),
      o('downsize',    'הקטנה',                    'Downsizing'),
      o('relocate',    'מעבר לעיר אחרת / חו״ל',    'Relocating to another city / abroad'),
      o('investment',  'מימוש השקעה',              'Cashing in an investment'),
      o('inheritance', 'ירושה',                    'Inheritance'),
      o('financial',   'צורך כלכלי',               'Financial need'),
      o('other',       'אחר',                      'Other'),
      o('private',     'מעדיף/ה לא לשתף',          'Prefer not to say'),
    ] },
  { id: 'd_published', section: 'price', type: 'choice', required: true,
    q: { sale: 'האם הנכס פורסם בעבר למכירה?', rental: 'האם הנכס פורסם בעבר להשכרה?' }, en_q: { sale: 'Has the property been listed for sale before?', rental: 'Has the property been listed for rent before?' },
    opts: [
      o('no',      'לא, זו הפעם הראשונה',              'No, this is the first time'),
      o('past',    'כן, בעבר — והורד מהשוק',           'Yes, in the past. It was taken off the market'),
      o('current', 'כן, והוא מפורסם גם כיום',          'Yes, and it is still listed today'),
    ] },
  { id: 'd_brokers', section: 'price', type: 'choice', required: true,
    q: 'האם הנכס נמצא כיום אצל מתווך נוסף, או בבלעדיות?', en_q: 'Is the property currently with another agent, or under exclusivity?',
    opts: [
      o('none',       'לא, אין מתווכים נוספים',                     'No, no other agents'),
      o('others',     'כן, אצל מתווכים נוספים (ללא בלעדיות)',       'Yes, with other agents (non-exclusive)'),
      o('exclusive',  'כן, בבלעדיות אצל משרד אחר',                  'Yes, under exclusivity with another agency'),
      o('expired',    'הייתה בלעדיות שהסתיימה',                     'There was an exclusivity that ended'),
      o('self',       'מפרסמים בעצמנו (יד 2 / פייסבוק)',            'We list it ourselves (Yad2 / Facebook)'),
    ] },
  { id: 'd_published_detail', section: 'price', type: 'long', showIf: a => a.d_published !== 'no' || (a.d_brokers && a.d_brokers !== 'none'),
    q: 'ספרו לנו על השיווק עד היום', en_q: 'Tell us about the marketing so far',
    help: 'איפה פורסם, מאיזה מחיר התחלתם, כמה זמן, ומה הייתה התגובה', en_help: 'Where it was listed, the starting price, for how long, and the response',
    ph: 'לא חובה', en_ph: 'Optional' },
  { id: 'd_offers', section: 'price', type: 'choice', required: true, appliesTo: ['sale'],
    q: 'כמה אתם פתוחים להצעות?', en_q: 'How open are you to offers?',
    opts: [
      o('open',  'פתוחים לכל הצעה רצינית',      'Open to any serious offer'),
      o('close', 'רק הצעות קרובות למחיר',       'Only offers close to the asking price'),
      o('firm',  'המחיר סופי',                  'The price is final'),
    ] },
  { id: 'd_buyer', section: 'price', type: 'long',
    q: { sale: 'יש העדפה לסוג קונה או לתנאי עסקה?', rental: 'יש העדפה לסוג שוכר או לתנאי השכירות?' }, en_q: { sale: 'Any preference regarding the buyer or deal terms?', rental: 'Any preference regarding the tenant or lease terms?' },
    help: { sale: 'למשל: מימון מהיר, ללא תלות במכירת נכס, אפשרות לשכירות חוזרת', rental: 'למשל: משפחה, ללא עישון, תשלום מראש, חוזה ארוך' }, en_help: { sale: 'e.g. fast financing, no chain, leaseback option', rental: 'e.g. a family, non-smokers, payment in advance, a long lease' },
    ph: 'לא חובה', en_ph: 'Optional' },
  { id: 'd_notes', section: 'price', type: 'long',
    q: 'יש משהו חשוב נוסף שעלינו לדעת לפני שמתחילים לשווק?', en_q: 'Is there anything else important we should know before we start marketing?',
    help: 'כל פרט שלא נשאל עליו ויכול להשפיע על העסקה — מקום טוב לכתוב אותו כאן', en_help: 'Anything we did not ask that could affect the deal belongs here',
    ph: 'לא חובה', en_ph: 'Optional' },

  // ═══════════════════ 8. MARKETING ═════════════════════════════════════════
  { id: 'm_intro', section: 'marketing', type: 'intro' },
  { id: 'm_pros', section: 'marketing', type: 'long', required: true,
    q: 'מה לדעתך היתרונות הגדולים ביותר של הנכס?', en_q: 'What are the biggest advantages of the property?',
    help: 'תחשבו מה גרם לכם להתאהב בו', en_help: 'Think about what made you fall in love with it',
    ph: 'למשל: אור טבעי כל היום, שקט מוחלט, מרפסת ענקית…', en_ph: 'e.g. daylight all day, complete quiet, huge balcony…' },
  { id: 'm_unique', section: 'marketing', type: 'long',
    q: 'מה מייחד את הנכס לעומת נכסים אחרים באזור?', en_q: 'What sets it apart from other properties in the area?',
    ph: 'לא חובה', en_ph: 'Optional' },
  { id: 'm_love', section: 'marketing', type: 'long',
    q: 'מה אתם הכי אוהבים בנכס?', en_q: 'What do you love most about the property?',
    help: { sale: 'הרגע, הפינה, השעה ביום. זה מה שקונים מתחברים אליו', rental: 'הרגע, הפינה, השעה ביום. זה מה ששוכרים מתחברים אליו' }, en_help: { sale: 'The moment, the corner, the time of day. That is what buyers connect with', rental: 'The moment, the corner, the time of day. That is what tenants connect with' },
    ph: 'לא חובה', en_ph: 'Optional' },
  { id: 'm_nearby', section: 'marketing', type: 'multi',
    q: 'מה יש במרחק הליכה?', en_q: 'What is within walking distance?',
    opts: [
      o('schools',  'בתי ספר וגני ילדים',    'Schools and kindergartens'),
      o('transit',  'תחבורה ציבורית',        'Public transport'),
      o('train',    'תחנת רכבת',             'Train station'),
      o('shops',    'מרכזי קניות',           'Shopping centers'),
      o('parks',    'פארקים',                'Parks'),
      o('cafes',    'בתי קפה ומסעדות',       'Cafés and restaurants'),
      o('synagogue','בתי כנסת',              'Synagogues'),
      o('highways', 'כבישים ראשיים',         'Main roads'),
      o('beach',    'ים',                    'Beach'),
      o('clinics',  'מרפאות / קופת חולים',   'Clinics / HMO'),
      o('super',    'סופרמרקט',              'Supermarket'),
      o('pharmacy', 'בית מרקחת',             'Pharmacy'),
      o('mall',     'קניון',                 'Mall'),
      o('community','מתנ״ס / מרכז קהילתי',   'Community center'),
      o('gym',      'חדר כושר / בריכה',      'Gym / pool'),
      o('college',  'אוניברסיטה / מכללה',    'University / college'),
      o('hospital', 'בית חולים',             'Hospital'),
      o('other',    'אחר',                   'Other'),
    ] },
  { id: 'm_fit', section: 'marketing', type: 'multi',
    q: 'למי הנכס מתאים במיוחד?', en_q: 'Who is the property ideal for?',
    opts: {
      sale: [
        o('family',    'משפחות',            'Families'),
        o('couple',    'זוגות צעירים',      'Young couples'),
        o('investors', 'משקיעים',           'Investors'),
        o('retirees',  'גיל השלישי',        'Retirees'),
        o('upgraders', 'משפרי דיור',        'Upgraders'),
        o('singles',   'רווקים/ות',         'Singles'),
        o('other',     'אחר',               'Other'),
      ],
      rental: [
        o('family',    'משפחות',            'Families'),
        o('couple',    'זוגות',             'Couples'),
        o('students',  'סטודנטים',          'Students'),
        o('roommates', 'שותפים',            'Roommates'),
        o('relocation','רילוקיישן / עובדי הייטק', 'Relocation / tech employees'),
        o('retirees',  'גיל השלישי',        'Retirees'),
        o('other',     'אחר',               'Other'),
      ],
    } },
  { id: 'm_story', section: 'marketing', type: 'long',
    q: 'מה חשוב לכם שנדגיש בפרסום?', en_q: 'What is important for us to emphasise in the listing?',
    help: 'סיפור, פרט מיוחד או מסר שחייב להופיע', en_help: 'A story, a special detail or a message that must appear',
    ph: 'לא חובה', en_ph: 'Optional' },
  { id: 'm_hide', section: 'marketing', type: 'long',
    q: 'יש משהו שאינכם רוצים שיופיע בפרסום?', en_q: 'Is there anything you do not want to appear in the listing?',
    help: { sale: 'למשל: הכתובת המדויקת, תמונות של חדר מסוים, סיבת המכירה', rental: 'למשל: הכתובת המדויקת, תמונות של חדר מסוים, פרטי הדיירים הנוכחיים' }, en_help: { sale: 'e.g. the exact address, photos of a certain room, the reason for selling', rental: 'e.g. the exact address, photos of a certain room, details about the current tenants' },
    ph: 'לא חובה', en_ph: 'Optional' },
  { id: 'm_extra', section: 'marketing', type: 'long',
    q: 'מידע נוסף שחשוב לנו לדעת?', en_q: 'Anything else we should know?',
    ph: 'לא חובה', en_ph: 'Optional' },

  // ═══════════════════ 9. MEDIA ═════════════════════════════════════════════
  { id: 'u_intro', section: 'media', type: 'intro' },
  { id: 'u_photos', section: 'media', type: 'upload', kind: 'photos', accept: 'image/*', maxMB: 25,
    q: 'תמונות עדכניות של הנכס', en_q: 'Recent photos of the property',
    help: 'תמונות של כל חדר, באור יום, ישר מהטלפון. אפשר להעלות עד 40 תמונות', en_help: 'Photos of every room in daylight, straight from your phone. Up to 40 photos',
    max: 40 },
  { id: 'u_videos', section: 'media', type: 'upload', kind: 'videos', accept: 'video/*', maxMB: 200,
    q: 'סרטון של הנכס, אם קיים', en_q: 'A video of the property, if you have one',
    help: 'סרטון קצר של הנכס, המרפסת, הגג או הגינה. אפשר גם לשלוח אחר כך בוואטסאפ', en_help: 'A short video of the property, balcony, roof or garden. You can also send it later via WhatsApp',
    max: 5 },
  { id: 'u_plan', section: 'media', type: 'upload', kind: 'plan', accept: 'image/*,application/pdf', maxMB: 25,
    q: 'תוכנית הדירה / הבית', en_q: 'Floor plan',
    help: 'צילום או קובץ PDF של התוכנית, אם קיים', en_help: 'A photo or PDF of the plan, if available',
    max: 5 },
  { id: 'u_docs', section: 'media', type: 'upload', kind: 'docs', accept: 'image/*,application/pdf', maxMB: 25,
    q: 'נסח טאבו / אישור זכויות ומסמכים נוספים', en_q: 'Tabu extract / rights confirmation and other documents',
    help: 'בחרו סוג מסמך ואז העלו. כל מסמך שמראה שטחים או זכויות עוזר לנו לשווק מדויק', en_help: 'Pick a document type, then upload. Anything that shows areas or rights helps us market accurately',
    max: 20,
    tags: [
      o('tabu',    'נסח טאבו / אישור זכויות', 'Tabu extract / rights confirmation'),
      o('arnona',  'ארנונה',                  'Arnona (municipal tax)'),
      o('vaad',    'חשבון ועד בית',            'Building committee bill'),
      o('spec',    'מפרט טכני',                'Technical specification'),
      o('permit',  'היתר בנייה',               'Building permit'),
      o('parking', 'מסמכי חניה / מחסן',        'Parking / storage documents'),
      o('lease',   'חוזה שכירות',              'Lease agreement'),
      o('id',      'תעודת זהות / ייפוי כוח',   'ID / power of attorney'),
      o('other',   'אחר',                      'Other'),
    ] },

  // ═══════════════════ 10. REVIEW ═══════════════════════════════════════════
  { id: 'r_review', section: 'review', type: 'review' },
  { id: 'r_story',  section: 'review', type: 'story' },
]

// ── visibility / validation ──────────────────────────────────────────────────
export const visibleSteps = a => STEPS.filter(s => appliesTo(s, a) && (!s.showIf || s.showIf(a)))
export const visibleFields = (step, a) => (step.fields || []).filter(f => appliesTo(f, a) && (!f.showIf || f.showIf(a)))
export const visibleRows = (step, a) => (step.rows || []).filter(r => appliesTo(r, a) && (!r.showIf || r.showIf(a)))
// Answers that belong only to the OTHER purpose (cleared when the seller switches sale ↔ rental)
export const purposeSpecificKeys = purpose => STEPS.filter(s => s.appliesTo && !s.appliesTo.includes(purpose)).flatMap(s => [s.id, `${s.id}_other`, `${s.id}_note`])

const PHONE_RE = /^(\+?972[-\s]?|0)(5\d|7\d|[2-4]|8|9)[-\s]?\d{3}[-\s]?\d{4}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const isValidPhone = v => PHONE_RE.test(String(v || '').trim())
export const isValidEmail = v => EMAIL_RE.test(String(v || '').trim())

export const VALIDATION_MSG = {
  he: { required: 'זה שדה חובה — נצטרך את התשובה כדי להמשיך', phone: 'נראה שמספר הטלפון לא תקין', email: 'כתובת האימייל לא נראית תקינה', matrix: 'סמנו תשובה לכל השורות', choose: 'בחרו אפשרות אחת כדי להמשיך', group: 'השלימו את השדות המסומנים', number: 'הזינו מספר תקין' },
  en: { required: 'This field is required to continue', phone: 'That phone number does not look right', email: 'That e-mail address does not look valid', matrix: 'Please answer every row', choose: 'Pick one option to continue', group: 'Please complete the highlighted fields', number: 'Enter a valid number' },
}

const isBlank = v => v === undefined || v === null || String(v).trim() === ''

// Returns null when the step is valid, otherwise a message key from VALIDATION_MSG
export function validateStep(step, a) {
  const v = a[step.id]
  switch (step.type) {
    case 'text': case 'long': case 'date':
      return step.required && isBlank(v) ? 'required' : null
    case 'number':
      if (step.required && isBlank(v)) return 'required'
      if (!isBlank(v) && Number.isNaN(Number(v))) return 'number'
      return null
    case 'phone':
      if (isBlank(v)) return step.required ? 'required' : null
      return isValidPhone(v) ? null : 'phone'
    case 'email':
      if (isBlank(v)) return step.required ? 'required' : null
      return isValidEmail(v) ? null : 'email'
    case 'choice':
      return step.required && isBlank(v) ? 'choose' : null
    case 'multi':
      return step.required && !(Array.isArray(v) && v.length) ? 'choose' : null
    case 'counter':
      return null
    case 'toggles':
      return null
    case 'group': {
      const bad = visibleFields(step, a).some(f => {
        const req = typeof f.required === 'function' ? f.required(a) : f.required
        return req && isBlank(v?.[f.k])
      })
      return bad ? 'group' : null
    }
    case 'matrix': {
      if (!step.required) return null
      const missing = visibleRows(step, a).some(r => isBlank(v?.[r.k]))
      return missing ? 'matrix' : null
    }
    default:
      return null
  }
}

export function groupInvalidFields(step, a) {
  const v = a[step.id] || {}
  return visibleFields(step, a).filter(f => {
    const req = typeof f.required === 'function' ? f.required(a) : f.required
    return req && isBlank(v?.[f.k])
  }).map(f => f.k)
}

// ── human-readable summary (review screen, e-mail, WhatsApp, admin) ──────────
const L = (item, lang) => (lang === 'en' ? (item.en ?? item.l) : item.l)
const optLabel = (step, val, lang, a) => {
  const opt = ([...stepOpts(step, a), ...(step.scale || [])]).find(x => x.v === val)
  const base = opt ? L(opt, lang) : String(val ?? '')
  const other = a && val === 'other' && a[`${step.id}_other`] ? String(a[`${step.id}_other`]).trim() : ''
  return other ? `${base}: ${other}` : base
}
export const otherKey = id => `${id}_other`
export const noteKey = id => `${id}_note`

// Human description of the selected compass directions (used live under the question and in summaries)
export function directionsText(vals, lang = 'he') {
  const v = Array.isArray(vals) ? vals : []
  if (!v.length) return ''
  const he = { north: 'צפון', south: 'דרום', east: 'מזרח', west: 'מערב' }
  const en = { north: 'north', south: 'south', east: 'east', west: 'west' }
  const order = ['north', 'east', 'south', 'west'].filter(k => v.includes(k))
  const names = order.map(k => (lang === 'en' ? en[k] : he[k]))
  const has = k => v.includes(k)
  const corner = (has('north') && has('east')) ? (lang === 'en' ? 'north-east' : 'צפון-מזרח')
    : (has('north') && has('west')) ? (lang === 'en' ? 'north-west' : 'צפון-מערב')
    : (has('south') && has('east')) ? (lang === 'en' ? 'south-east' : 'דרום-מזרח')
    : (has('south') && has('west')) ? (lang === 'en' ? 'south-west' : 'דרום-מערב') : ''
  const join = arr => lang === 'en' ? arr.join(', ').replace(/, ([^,]*)$/, ' and $1') : arr.join(', ').replace(/, ([^,]*)$/, ' ו$1')
  if (lang === 'en') {
    if (v.length === 4) return 'Faces all four directions, light all day.'
    if (v.length === 3) return `Faces three directions: ${join(names)}.`
    if (v.length === 2) return corner ? `Corner property facing ${corner}.` : `Faces ${join(names)}, front and back.`
    return `Faces ${names[0]}.`
  }
  if (v.length === 4) return 'ארבעה כיווני אוויר, אור לאורך כל היום.'
  if (v.length === 3) return `שלושה כיווני אוויר: ${join(names)}.`
  if (v.length === 2) return corner ? `נכס פינתי, פונה ל${corner}.` : `פונה ל${join(names)}, חזית ועורף.`
  return `פונה ל${names[0]}.`
}
export const fmtNum = (n, lang) => {
  if (isBlank(n) || Number.isNaN(Number(n))) return String(n ?? '')
  return Number(n).toLocaleString(lang === 'en' ? 'en-US' : 'he-IL')
}
const yesNo = (b, lang) => (lang === 'en' ? (b ? 'Yes' : 'No') : (b ? 'כן' : 'לא'))

// Short labels for the review screen, e-mail and admin sheet (questions are
// conversational; summaries want nouns). Falls back to the question text.
const SHORT = {
  c_name: ['שם מלא', 'Full name'], c_phone: ['טלפון', 'Phone'], c_email: ['אימייל', 'E-mail'], c_role: ['הקשר לנכס', 'Relationship to property'],
  c_extra: ['איש קשר נוסף', 'Additional contact'], c_privacy: ['פרטיות בפרסום', 'Listing privacy'],
  p_type: ['סוג הנכס', 'Property type'], p_address: ['כתובת', 'Address'], p_rooms: ['חדרים', 'Rooms'], p_floor: ['קומה', 'Floor'],
  p_area: ['שטחים', 'Areas'], p_baths: ['חדרי רחצה ושירותים', 'Bathrooms and toilets'], p_year: ['שנת בנייה', 'Year built'],
  p_directions: ['כיווני אוויר', 'Facing directions'], p_view: ['נוף', 'View'],
  f_mamad: ['ממ״ד', 'Safe room'], f_elevator: ['מעלית', 'Elevator'], f_parking: ['חניות', 'Parking spaces'], f_parking_type: ['סוג חניה', 'Parking type'],
  f_storage: ['מחסן', 'Storage room'], f_storage_size: ['גודל מחסן', 'Storage size'], f_climate: ['מיזוג', 'Air conditioning'],
  f_kitchen: ['מטבח', 'Kitchen'], f_island: ['אי במטבח', 'Kitchen island'], f_rooms: ['חללים נוספים', 'Additional spaces'],
  f_water: ['חימום מים', 'Water heating'], f_systems: ['מערכות ותוספות', 'Systems and extras'],
  p_state: ['מצב כללי', 'Overall state'], k_renovated: ['שופץ', 'Renovated'], k_reno_year: ['שנת שיפוץ', 'Renovation year'], k_reno_what: ['מה שופץ', 'What was renovated'],
  k_matrix: ['דירוג מצב', 'Condition ratings'], k_defects: ['ליקויים ידועים', 'Known defects'], k_defects_detail: ['פירוט ליקויים', 'Defect details'],
  k_moisture: ['רטיבות / נזילות', 'Moisture / leaks'], k_investment: ['השקעה לפני כניסה', 'Investment before move-in'],
  f_furniture: ['מה נשאר בנכס', 'What stays'], f_furniture_detail: ['פירוט פריטים שנשארים', 'Items staying'],
  k_occupancy: ['מי בנכס כיום', 'Current occupancy'], k_lease: ['שוכרים — עד מתי', 'Tenants until'],
  b_numbers: ['נתוני הבניין', 'Building figures'], b_amenities: ['מה יש בבניין', 'Building amenities'], b_fees: ['תשלומים חודשיים', 'Monthly fees'],
  b_renovation: ['שיפוץ בבניין', 'Building renovation'], b_tama: ['התחדשות עירונית בבניין', 'Urban renewal (building)'], b_tama_detail: ['שלב התהליך', 'Process stage'],
  l_owners: ['הבעלים', 'Owners'], l_more_owners: ['בעלים נוספים', 'Other owners'], l_more_owners_detail: ['פירוט בעלים נוספים', 'Other owners details'],
  l_agree: ['הסכמת כל הבעלים', 'All owners agree'], l_inherit: ['ירושה', 'Inheritance'], l_rights: ['סוג הרישום', 'Registration type'], l_matrix: ['מצב משפטי', 'Legal status'],
  l_mortgage: ['יתרת משכנתא', 'Remaining mortgage'], l_issues_detail: ['פירוט שעבודים / הליכים / חריגות', 'Liens / proceedings / violations details'],
  l_area_plans: ['תוכניות בסביבה', 'Plans in the area'], l_area_plans_detail: ['פירוט תוכניות בסביבה', 'Area plans details'], l_notes: ['הערות משפטיות', 'Legal notes'],
  x_purpose: ['סוג העסקה', 'Purpose'],
  d_ask: { sale: ['מחיר מבוקש', 'Asking price'], rental: ['דמי שכירות מבוקשים', 'Requested rent'] }, d_expected: ['מחיר צפוי בפועל', 'Expected sale price'], d_flex: { sale: ['גמישות במחיר', 'Price flexibility'], rental: ['גמישות בשכירות', 'Rent flexibility'] },
  d_min: { sale: ['מחיר מינימום (פנימי)', 'Minimum price (internal)'], rental: ['שכירות מינימלית (פנימי)', 'Minimum rent (internal)'] }, d_offers_received: ['התקבלו הצעות בעבר', 'Offers received before'], d_best_offer: ['ההצעה הגבוהה עד היום', 'Highest offer so far'],
  d_timeline: { sale: ['מתי למכור', 'When to sell'], rental: ['זמינות להשכרה', 'Availability'] }, d_deadline: ['דד-ליין', 'Deadline'], d_vacate: ['מועד פינוי', 'Move-out'], d_vacate_flex: ['גמישות בפינוי', 'Move-out flexibility'],
  r_term: ['תקופת שכירות', 'Lease term'], r_guarantees: ['ערבויות', 'Guarantees'], r_included: ['כלול בשכירות', 'Included in rent'], r_pets: ['בעלי חיים', 'Pets'],
  d_alt: ['רכישת נכס אחר', 'Buying another property'], d_why: ['סיבת המכירה', 'Reason for selling'],
  d_published: ['פורסם בעבר', 'Listed before'], d_brokers: ['מתווכים / בלעדיות', 'Agents / exclusivity'], d_published_detail: ['השיווק עד היום', 'Marketing so far'],
  d_offers: ['פתיחות להצעות', 'Openness to offers'], d_buyer: { sale: ['העדפות קונה / תנאים', 'Buyer / terms preferences'], rental: ['העדפות שוכר / תנאים', 'Tenant / terms preferences'] }, d_notes: ['חשוב לדעת לפני השיווק', 'Important before marketing'],
  m_pros: ['יתרונות', 'Advantages'], m_unique: ['מה מייחד', 'What sets it apart'], m_nearby: ['במרחק הליכה', 'Within walking distance'], m_fit: ['מתאים ל', 'Ideal for'],
  m_love: ['מה אתם הכי אוהבים', 'What you love most'], m_story: ['מה להדגיש בפרסום', 'Emphasise in the listing'], m_hide: ['לא לפרסם', 'Keep out of the listing'], m_extra: ['מידע נוסף', 'Additional information'],
  u_photos: ['תמונות', 'Photos'], u_videos: ['סרטונים', 'Videos'], u_plan: ['תוכנית', 'Floor plan'], u_docs: ['מסמכים', 'Documents'],
}
export function stepLabel(step, lang, a) {
  const s = byPurpose(SHORT[step.id], a)
  const q = byPurpose(step.q, a), en_q = byPurpose(step.en_q, a)
  if (lang === 'en') return s?.[1] || en_q || q || ''
  return s?.[0] || q || ''
}
export const stepQuestion = (step, lang, a) => (lang === 'en' ? (byPurpose(step.en_q, a) || byPurpose(step.q, a)) : byPurpose(step.q, a)) || ''
export const stepHelp = (step, lang, a) => (lang === 'en' ? (byPurpose(step.en_help, a) || byPurpose(step.help, a)) : byPurpose(step.help, a)) || ''
export const stepPh = (step, lang, a) => (lang === 'en' ? (byPurpose(step.en_ph, a) || byPurpose(step.ph, a)) : byPurpose(step.ph, a)) || ''
export const stepUnit = (step, lang, a) => (lang === 'en' ? (byPurpose(step.en_unit, a) || byPurpose(step.unit, a)) : byPurpose(step.unit, a)) || ''
export const sectionText = (sec, key, lang, a) => byPurpose(lang === 'en' ? (key === 'title' ? sec.en : sec.en_desc) : (key === 'title' ? sec.title : sec.desc), a) || ''
export const emphasisFor = (id, lang, a) => { const e = byPurpose(EMPHASIS[id], a); return e ? e[lang === 'en' ? 1 : 0] : undefined }

export function stepValueText(step, a, lang) {
  const v = a[step.id]
  if (v === undefined || v === null || v === '') return ''
  switch (step.type) {
    case 'text': case 'long': case 'phone': case 'email': case 'date':
      return String(v)
    case 'number': {
      const unit = stepUnit(step, lang, a)
      return `${fmtNum(v, lang)}${unit ? ' ' + unit : ''}`
    }
    case 'choice':
      return optLabel(step, v, lang, a)
    case 'multi': {
      if (!(Array.isArray(v) && v.length)) return ''
      const base = v.map(x => optLabel(step, x, lang, a)).join(', ')
      if (step.note) { const n = a[noteKey(step.id)] || directionsText(v, lang); return n ? `${base}. ${n}` : base }
      return base
    }
    case 'counter':
      return visibleRows(step, a).filter(r => !isBlank(v?.[r.k])).map(r => `${L(r, lang)}: ${fmtNum(v[r.k], lang)}`).join(' · ')
    case 'toggles':
      return visibleRows(step, a).map(r => `${L(r, lang)}: ${yesNo(!!v?.[r.k], lang)}`).join(' · ')
    case 'group':
      return visibleFields(step, a).filter(f => !isBlank(v?.[f.k])).map(f => {
        const unit = lang === 'en' ? (f.en_unit || f.unit || '') : (f.unit || '')
        const val = f.type === 'number' ? fmtNum(v[f.k], lang) : v[f.k]
        return `${L(f, lang)}: ${val}${unit ? ' ' + unit : ''}`
      }).join(' · ')
    case 'matrix':
      return visibleRows(step, a).filter(r => !isBlank(v?.[r.k])).map(r => `${L(r, lang)}: ${optLabel(step, v[r.k], lang)}`).join(' · ')
    case 'upload':
      return Array.isArray(v) && v.length
        ? (lang === 'en' ? `${v.length} file${v.length > 1 ? 's' : ''}` : `${v.length} קבצים`)
        : ''
    default:
      return ''
  }
}

// [{ section, title, items: [{ id, label, value }] }] — only answered, visible steps
export function buildSummary(a, lang = 'he') {
  const steps = visibleSteps(a)
  return SECTIONS.filter(s => s.id !== 'review').map(sec => {
    const items = steps
      .filter(st => st.section === sec.id && !['intro', 'review'].includes(st.type))
      .map(st => ({ id: st.id, label: stepLabel(st, lang, a), value: stepValueText(st, a, lang), type: st.type,
        chips: st.type === 'multi' && Array.isArray(a[st.id]) ? a[st.id].map(x => optLabel(st, x, lang, a)) : null,
        note: st.type === 'multi' && st.note ? (a[noteKey(st.id)] || directionsText(a[st.id], lang)) : null }))
      .filter(it => it.value)
    return { section: sec.id, title: sectionText(sec, 'title', lang, a), items }
  }).filter(sec => sec.items.length)
}

// One-line headline used in notifications and the admin list
function headlineLegacy(a, lang = 'he') {
  const type = STEPS.find(s => s.id === 'p_type')
  const t = a.p_type ? optLabel(type, a.p_type, lang) : ''
  const addr = a.p_address || {}
  const where = [addr.street, addr.number].filter(Boolean).join(' ')
  const city = addr.city || ''
  const rooms = a.p_rooms ? (lang === 'en' ? `${a.p_rooms} rooms` : `${a.p_rooms} חדרים`) : ''
  const purp = a.x_purpose ? (lang === 'en' ? (a.x_purpose === 'rental' ? 'for rent' : 'for sale') : (a.x_purpose === 'rental' ? 'להשכרה' : 'למכירה')) : ''
  return [t, rooms, [where, city].filter(Boolean).join(', '), purp].filter(Boolean).join(' · ')
}

export const PROPERTY_TYPE_LABEL = (v, lang = 'he') => optLabel(STEPS.find(s => s.id === 'p_type'), v, lang)
export const PROPERTY_STATE_LABEL = (v, lang = 'he') => ({ he: { new: 'חדש מקבלן', secondhand: 'יד שנייה', renovated: 'לאחר שיפוץ', needs: 'דרוש שיפוץ' }, en: { new: 'New from developer', secondhand: 'Second hand', renovated: 'Renovated', needs: 'Needs renovation' } })[lang === 'en' ? 'en' : 'he'][v] || ''

export const DOC_TAG_LABEL = (v, lang = 'he') => {
  const step = STEPS.find(s => s.id === 'u_docs')
  const t = (step.tags || []).find(x => x.v === v)
  return t ? L(t, lang) : (v || '')
}

export const SCHEMA_VERSION = 5

// Key phrase of each question, shown in bold (Typeform style). Must be an exact substring of q / en_q.
export const EMPHASIS = {
  c_name: ["שמך המלא", "full name"],
  c_phone: ["מספר הטלפון", "phone number"],
  c_email: ["כתובת האימייל", "e-mail address"],
  c_role: ["הקשר שלך לנכס", "relationship to the property"],
  c_extra: ["איש קשר נוסף", "another contact person"],
  c_hours: ["מתי נוח לך", "When is it convenient"],
  c_privacy: ["הגדרות פרטיות", "privacy settings"],
  p_type: ["איזה סוג נכס", "type of property"],
  p_address: ["הכתובת המלאה", "full address"],
  p_rooms: ["כמה חדרים", "How many rooms"],
  p_floor: ["באיזו קומה", "Which floor"],
  p_area: ["השטחים", "property areas"],
  p_baths: ["חדרי רחצה ושירותים", "Bathrooms and toilets"],
  p_year: ["באיזו שנה נבנה", "What year"],
  p_directions: ["כיווני אוויר", "Which directions"],
  p_view: ["הנוף", "the view"],
  f_mamad: ["ממ״ד", "safe room (Mamad)"],
  f_elevator: ["מעלית", "elevator"],
  f_parking: ["כמה חניות", "How many parking spaces"],
  f_parking_type: ["סוג חניה", "kind of parking"],
  f_storage: ["מחסן", "storage room"],
  f_storage_size: ["גודל המחסן", "How big"],
  f_climate: ["סוג מיזוג", "type of air conditioning"],
  f_kitchen: ["המטבח", "kitchen"],
  f_island: ["אי במטבח", "kitchen island"],
  f_rooms: ["חללים נוספים", "additional spaces"],
  f_water: ["מחממים מים", "water heated"],
  f_systems: ["מערכות ותוספות", "Systems and extras"],
  p_state: ["מצב הנכס", "describe the property"],
  k_renovated: ["שופץ", "renovated"],
  k_reno_year: ["מתי", "When"],
  k_reno_what: ["מה שופץ", "What was renovated"],
  k_matrix: ["מדרג/ת את המצב", "rate the condition"],
  k_defects: ["ליקויים או בעיות", "defects or problems"],
  k_defects_detail: ["הליקויים", "the defects"],
  k_moisture: ["רטיבויות או נזילות", "moisture or leaks"],
  k_investment: ["השקעה לפני כניסה", "investment before moving in"],
  f_furniture: ["אילו פריטים נשארים", "Which items stay"],
  f_furniture_detail: ["מה נשאר", "what stays"],
  k_occupancy: ["פנוי", "vacant"],
  k_lease: ["עד מתי", "Until when"],
  b_numbers: ["הבניין", "the building"],
  b_amenities: ["מה יש בבניין", "What does the building offer"],
  b_fees: ["תשלומים חודשיים", "Monthly building payments"],
  b_renovation: ["שיפוץ בבניין", "building renovation"],
  b_tama: ["התחדשות עירונית", "urban-renewal"],
  b_tama_detail: ["באיזה שלב", "What stage"],
  l_owners: ["מי הבעלים", "Who owns"],
  l_more_owners: ["בעלים נוספים", "other owners"],
  l_more_owners_detail: ["הבעלים הנוספים", "other owners"],
  l_agree: ["כל הבעלים מסכימים", "all the owners agree"],
  l_rights: ["איך הנכס רשום", "How is the property registered"],
  l_matrix: ["כן, לא או לא יודע", "yes, no or unknown"],
  l_mortgage: ["יתרת המשכנתא", "remaining mortgage"],
  l_issues_detail: ["קצת יותר", "a little more"],
  l_area_plans: ["תוכניות בנייה או התחדשות עירונית", "construction or urban-renewal plans"],
  l_area_plans_detail: ["אילו תוכניות", "Which plans"],
  l_notes: ["הערות משפטיות או תכנוניות", "legal or planning notes"],
  x_purpose: ["במה אתם מעוניינים", "What would you like"], r_term: ["תקופת שכירות", "lease term"], r_guarantees: ["ערבויות", "guarantees"], r_included: ["כלול בדמי השכירות", "included in the rent"], r_pets: ["בעלי חיים", "pets"],
  d_ask: { sale: ["מחיר המכירה המבוקש", "asking sale price"], rental: ["דמי השכירות החודשיים", "monthly rent"] },
  d_expected: ["מצפים למכור בפועל", "realistically expect"],
  d_flex: { sale: ["גמישות במחיר", "flexibility in the price"], rental: ["גמישות בדמי השכירות", "flexibility in the rent"] },
  d_min: { sale: ["מחיר מינימום", "minimum price"], rental: ["דמי שכירות מינימליים", "minimum rent"] },
  d_best_offer: ["המחיר הגבוה ביותר", "highest offer"],
  d_timeline: { sale: ["מתי תרצו למכור", "When would you like to sell"], rental: ["זמין להשכרה", "available to rent"] },
  d_deadline: ["מועד", "date"],
  d_vacate: ["מועד הפינוי", "move-out date"],
  d_vacate_flex: ["להזיז את מועד הפינוי", "move-out date move"],
  d_alt: ["לרכוש נכס אחר", "buy another property"],
  d_why: ["הסיבה למכירה", "reason for selling"],
  d_published: { sale: ["פורסם בעבר", "listed for sale before"], rental: ["פורסם בעבר", "listed for rent before"] },
  d_brokers: ["מתווך נוסף, או בבלעדיות", "another agent, or under exclusivity"],
  d_published_detail: ["השיווק עד היום", "marketing so far"],
  d_offers: ["פתוחים להצעות", "open are you to offers"],
  d_buyer: { sale: ["סוג קונה", "the buyer"], rental: ["סוג שוכר", "the tenant"] },
  d_notes: ["משהו חשוב נוסף", "anything else important"],
  l_inherit: ["בירושה", "inherited"], d_offers_received: ["הצעות על הנכס", "received offers"], m_love: ["הכי אוהבים", "love most"], m_hide: ["אינכם רוצים שיופיע", "do not want to appear"], m_extra: ["מידע נוסף", "Anything else"],
  m_pros: ["היתרונות הגדולים ביותר", "biggest advantages"],
  m_unique: ["מה מייחד", "sets it apart"],
  m_nearby: ["במרחק הליכה", "walking distance"],
  m_fit: ["למי הנכס מתאים", "ideal for"],
  m_story: ["חשוב לכם שנדגיש", "important for us to emphasise"],
  u_photos: ["תמונות עדכניות", "Recent photos"],
  u_videos: ["סרטון", "video"],
  u_plan: ["תוכנית", "Floor plan"],
  u_docs: ["נסח טאבו / אישור זכויות", "Tabu extract / rights confirmation"],
}

// ── "Property story": a narrative summary the seller and the marketer both read ──
// Returns [{ title, text }] paragraphs. Every sentence is skipped when its data is missing.
function buildStoryLegacy(a, lang = 'he') {
  const en = lang === 'en'
  const S = id => STEPS.find(s => s.id === id)
  const lab = (id, v) => (v === undefined || v === null || v === '') ? '' : optLabel(S(id), v, lang, a)
  const multi = id => Array.isArray(a[id]) ? a[id].map(x => optLabel(S(id), x, lang, a)) : []
  const list = arr => {
    if (!arr.length) return ''
    if (en) return arr.join(', ').replace(/, ([^,]*)$/, ' and $1')
    const last = arr[arr.length - 1]
    const glue = /^[\d₪]/.test(String(last)) ? ' ו-' : ' ו'
    return arr.length === 1 ? String(last) : arr.slice(0, -1).join(', ') + glue + last
  }
  const num = n => (n === undefined || n === null || n === '' || Number.isNaN(Number(n))) ? '' : Number(n).toLocaleString(en ? 'en-US' : 'he-IL')
  const ils = n => num(n) ? (en ? `₪${num(n)}` : `${num(n)} ₪`) : ''
  const sent = parts => parts.filter(Boolean).join(' ')
  const paras = []
  const addr = a.p_address || {}
  const area = a.p_area || {}
  const floor = a.p_floor || {}
  const type = lab('p_type', a.p_type)
  const where = [addr.street, addr.number].filter(Boolean).join(' ')
  const place = [where, addr.neighborhood, addr.city].filter(Boolean).join(', ')
  const rooms = a.p_rooms
  const land = isLand(a), house = isHouse(a)

  // 1. Opening
  {
    const t = []
    if (en) {
      t.push(sent([type ? `${/^[aeiou]/i.test(type) ? 'An' : 'A'} ${type.toLowerCase()}` : 'A property', rooms ? `with ${rooms} rooms` : '', place ? `at ${place}` : '', '.']).replace(' .', '.'))
      if (!house && floor.floor !== undefined && floor.floor !== '') t.push(`It sits on floor ${floor.floor}${floor.totalFloors ? ` of ${floor.totalFloors}` : ''}.`)
      const sz = [area.built ? `${num(area.built)} m² built` : '', area.plot ? `a ${num(area.plot)} m² plot` : '', area.balcony ? `a ${num(area.balcony)} m² balcony` : '', area.roof ? `a ${num(area.roof)} m² roof` : '', area.garden ? `a ${num(area.garden)} m² garden` : ''].filter(Boolean)
      if (sz.length) t.push(`Size: ${list(sz)}.`)
      const b = a.p_baths || {}
      if (b.bathrooms !== undefined) t.push(`${b.bathrooms} bathroom${b.bathrooms == 1 ? '' : 's'}${b.toilets !== undefined ? ` and ${b.toilets} toilets` : ''}.`)
      if (a.p_year) t.push(`Built in ${a.p_year}.`)
    } else {
      t.push(sent([type || 'נכס', rooms ? `${rooms} חדרים` : '', place ? `ב${place}` : '', '.']).replace(' .', '.'))
      if (!house && floor.floor !== undefined && floor.floor !== '') t.push(`הנכס בקומה ${floor.floor}${floor.totalFloors ? ` מתוך ${floor.totalFloors}` : ''}.`)
      const sz = [area.built ? `${num(area.built)} מ״ר בנוי` : '', area.plot ? `מגרש של ${num(area.plot)} מ״ר` : '', area.balcony ? `מרפסת של ${num(area.balcony)} מ״ר` : '', area.roof ? `גג של ${num(area.roof)} מ״ר` : '', area.garden ? `גינה של ${num(area.garden)} מ״ר` : ''].filter(Boolean)
      if (sz.length) t.push(`שטחים: ${list(sz)}.`)
      const b = a.p_baths || {}
      if (b.bathrooms !== undefined) t.push(`${b.bathrooms} חדרי רחצה${b.toilets !== undefined ? ` ו-${b.toilets} שירותים` : ''}.`)
      if (a.p_year) t.push(`שנת בנייה: ${a.p_year}.`)
    }
    paras.push({ title: en ? 'The property' : 'הנכס', text: t.join(' ') })
  }
  // 2. Light & view
  {
    const t = []
    const d = a[noteKey('p_directions')] || directionsText(a.p_directions, lang)
    if (d) t.push(d)
    const v = multi('p_view').filter(x => x)
    if (v.length) t.push(en ? `The view: ${list(v)}.` : `הנוף: ${list(v)}.`)
    if (t.length) paras.push({ title: en ? 'Light and view' : 'אור ונוף', text: t.join(' ') })
  }
  // 3. Features
  if (!land) {
    const t = []
    const yes = v => v === 'yes'
    if (en) {
      const f = []
      if (a.f_mamad) f.push(a.f_mamad === 'yes' ? 'a safe room (Mamad)' : a.f_mamad === 'shared' ? 'a shared shelter in the building' : 'no safe room')
      if (a.f_elevator) f.push(a.f_elevator === 'no' ? 'no elevator' : a.f_elevator === 'shabbat' ? 'an elevator including a Shabbat elevator' : 'an elevator')
      const pk = Number(a.f_parking?.parking || 0)
      if (a.f_parking) f.push(pk ? `${pk} parking space${pk > 1 ? 's' : ''}${multi('f_parking_type').length ? ` (${list(multi('f_parking_type'))})` : ''}` : 'no private parking')
      if (a.f_storage) f.push(yes(a.f_storage) ? `a storage room${a.f_storage_size ? ` of ${num(a.f_storage_size)} m²` : ''}` : 'no storage room')
      if (f.length) t.push(`The property has ${list(f)}.`)
      if (a.f_climate) t.push(`Air conditioning: ${lab('f_climate', a.f_climate).toLowerCase()}.`)
      if (a.f_kitchen) t.push(`Kitchen: ${lab('f_kitchen', a.f_kitchen).toLowerCase()}${a.f_island === 'yes' ? ', with an island' : ''}.`)
      if (multi('f_rooms').length) t.push(`Additional spaces: ${list(multi('f_rooms'))}.`)
      if (multi('f_water').length) t.push(`Water heating: ${list(multi('f_water'))}.`)
      const sys = multi('f_systems').filter(x => !/no special/i.test(x))
      if (sys.length) t.push(`Extras: ${list(sys)}.`)
    } else {
      const f = []
      if (a.f_mamad) f.push(a.f_mamad === 'yes' ? 'ממ״ד' : a.f_mamad === 'shared' ? 'מקלט משותף בבניין' : 'ללא ממ״ד')
      if (a.f_elevator) f.push(a.f_elevator === 'no' ? 'ללא מעלית' : a.f_elevator === 'shabbat' ? 'מעלית כולל מעלית שבת' : 'מעלית')
      const pk = Number(a.f_parking?.parking || 0)
      if (a.f_parking) f.push(pk ? `${pk === 1 ? 'חניה אחת' : `${pk} חניות`}${multi('f_parking_type').length ? ` (${list(multi('f_parking_type'))})` : ''}` : 'ללא חניה פרטית')
      if (a.f_storage) f.push(yes(a.f_storage) ? `מחסן${a.f_storage_size ? ` של ${num(a.f_storage_size)} מ״ר` : ''}` : 'ללא מחסן')
      if (f.length) t.push(`בנכס ${list(f)}.`)
      if (a.f_climate) t.push(`מיזוג: ${lab('f_climate', a.f_climate)}.`)
      if (a.f_kitchen) t.push(`${lab('f_kitchen', a.f_kitchen)}${a.f_island === 'yes' ? ' עם אי' : ''}.`)
      if (multi('f_rooms').length) t.push(`חללים נוספים: ${list(multi('f_rooms'))}.`)
      if (multi('f_water').length) t.push(`חימום מים: ${list(multi('f_water'))}.`)
      const sys = multi('f_systems').filter(x => !/אין תוספות/.test(x))
      if (sys.length) t.push(`תוספות: ${list(sys)}.`)
    }
    if (t.length) paras.push({ title: en ? 'Features' : 'מאפיינים', text: t.join(' ') })
  }
  // 4. Condition & occupancy
  {
    const t = []
    const m = a.k_matrix || {}
    const mrows = visibleRows(S('k_matrix') || { rows: [] }, a).filter(r => m[r.k]).map(r => `${L(r, lang)}: ${optLabel(S('k_matrix'), m[r.k], lang)}`)
    if (en) {
      if (a.p_state) t.push(`Overall: ${lab('p_state', a.p_state).toLowerCase()}.`)
      if (a.k_renovated === 'yes' || a.k_renovated === 'partial') t.push(`${a.k_renovated === 'partial' ? 'Partially renovated' : 'Renovated'}${a.k_reno_year ? ` in ${a.k_reno_year}` : ''}${multi('k_reno_what').length ? ` (${list(multi('k_reno_what')).toLowerCase()})` : ''}.`)
      else if (a.k_renovated === 'no') t.push('Not renovated.')
      if (mrows.length) t.push(`Condition ratings: ${mrows.join('; ')}.`)
      if (a.k_defects === 'yes') t.push(`Known defects: ${a.k_defects_detail || 'yes'}.`)
      else if (a.k_defects === 'no') t.push('No known defects.')
      if (a.k_moisture && a.k_moisture !== 'none') t.push(`Moisture: ${lab('k_moisture', a.k_moisture).toLowerCase()}.`)
      if (a.k_investment) t.push(`Investment before move-in: ${lab('k_investment', a.k_investment).toLowerCase()}.`)
      if (a.f_furniture) t.push(`What stays: ${lab('f_furniture', a.f_furniture).toLowerCase()}${a.f_furniture_detail ? ` (${a.f_furniture_detail})` : ''}.`)
      if (a.k_occupancy) t.push(`Occupancy: ${lab('k_occupancy', a.k_occupancy).toLowerCase()}${a.k_occupancy === 'rented' && a.k_lease?.leaseEnd ? `, lease ends ${a.k_lease.leaseEnd}` : ''}${a.k_lease?.rent ? `, rent ${ils(a.k_lease.rent)}/month` : ''}${a.k_lease?.notes ? ` (${a.k_lease.notes})` : ''}.`)
    } else {
      if (a.p_state) t.push(`מצב כללי: ${lab('p_state', a.p_state)}.`)
      if (a.k_renovated === 'yes' || a.k_renovated === 'partial') t.push(`${a.k_renovated === 'partial' ? 'שופץ חלקית' : 'שופץ'}${a.k_reno_year ? ` ב-${a.k_reno_year}` : ''}${multi('k_reno_what').length ? ` (${list(multi('k_reno_what'))})` : ''}.`)
      else if (a.k_renovated === 'no') t.push('הנכס לא שופץ.')
      if (mrows.length) t.push(`דירוג מצב: ${mrows.join('; ')}.`)
      if (a.k_defects === 'yes') t.push(`ליקויים ידועים: ${a.k_defects_detail || 'כן'}.`)
      else if (a.k_defects === 'no') t.push('אין ליקויים ידועים.')
      if (a.k_moisture && a.k_moisture !== 'none') t.push(`רטיבות: ${lab('k_moisture', a.k_moisture)}.`)
      if (a.k_investment) t.push(`השקעה לפני כניסה: ${lab('k_investment', a.k_investment)}.`)
      if (a.f_furniture) t.push(`מה נשאר בנכס: ${lab('f_furniture', a.f_furniture)}${a.f_furniture_detail ? ` (${a.f_furniture_detail})` : ''}.`)
      if (a.k_occupancy) t.push(`${lab('k_occupancy', a.k_occupancy)}${a.k_occupancy === 'rented' && a.k_lease?.leaseEnd ? `, החוזה מסתיים ב-${a.k_lease.leaseEnd}` : ''}${a.k_lease?.rent ? `, שכר דירה ${ils(a.k_lease.rent)} לחודש` : ''}${a.k_lease?.notes ? ` (${a.k_lease.notes})` : ''}.`)
    }
    if (t.length) paras.push({ title: en ? 'Condition and occupancy' : 'מצב הנכס ומי גר בו', text: t.join(' ') })
  }
  // 5. Building
  if (!house) {
    const t = []
    const b = a.b_numbers || {}
    const fees = a.b_fees || {}
    if (en) {
      const nums = [b.year ? `built in ${b.year}` : '', b.apartments ? `${b.apartments} apartments` : '', b.floors ? `${b.floors} floors` : '', b.elevators ? `${b.elevators} elevator${b.elevators == 1 ? '' : 's'}` : ''].filter(Boolean)
      if (nums.length) t.push(`The building: ${list(nums)}.`)
      if (multi('b_amenities').length) t.push(`In the building: ${list(multi('b_amenities')).toLowerCase()}.`)
      const f = [fees.vaad ? `committee fee ${ils(fees.vaad)}/month` : '', fees.management ? `management ${ils(fees.management)}/month` : ''].filter(Boolean)
      if (f.length) t.push(`${list(f)}.`)
      if (a.b_renovation && a.b_renovation !== 'no') t.push(`Building renovation: ${lab('b_renovation', a.b_renovation).toLowerCase()}.`)
      if (a.b_tama && a.b_tama !== 'none') t.push(`Urban renewal: ${lab('b_tama', a.b_tama)}${a.b_tama_detail ? ` (${a.b_tama_detail})` : ''}.`)
    } else {
      const nums = [b.year ? `נבנה ב-${b.year}` : '', b.apartments ? `${b.apartments} דירות` : '', b.floors ? `${b.floors} קומות` : '', b.elevators ? `${b.elevators} מעליות` : ''].filter(Boolean)
      if (nums.length) t.push(`הבניין: ${list(nums)}.`)
      if (multi('b_amenities').length) t.push(`בבניין: ${list(multi('b_amenities'))}.`)
      const f = [fees.vaad ? `ועד בית ${ils(fees.vaad)} לחודש` : '', fees.management ? `דמי ניהול ${ils(fees.management)} לחודש` : ''].filter(Boolean)
      if (f.length) t.push(`${list(f)}.`)
      if (a.b_renovation && a.b_renovation !== 'no') t.push(`שיפוץ בבניין: ${lab('b_renovation', a.b_renovation)}.`)
      if (a.b_tama && a.b_tama !== 'none') t.push(`התחדשות עירונית: ${lab('b_tama', a.b_tama)}${a.b_tama_detail ? ` (${a.b_tama_detail})` : ''}.`)
    }
    if (t.length) paras.push({ title: en ? 'The building' : 'הבניין', text: t.join(' ') })
  }
  // 6. Legal
  {
    const t = []
    const m = a.l_matrix || {}
    const yesRows = visibleRows(S('l_matrix') || { rows: [] }, a).filter(r => m[r.k] === 'yes').map(r => L(r, lang))
    const unkRows = visibleRows(S('l_matrix') || { rows: [] }, a).filter(r => m[r.k] === 'unknown').map(r => L(r, lang))
    if (en) {
      if (a.l_owners) t.push(`Rights are registered in the name of ${a.l_owners}${a.l_rights ? ` (${lab('l_rights', a.l_rights)})` : ''}.`)
      if (a.l_more_owners === 'yes') t.push(`Additional owners: ${a.l_more_owners_detail || 'yes'}.`)
      if (a.l_agree) t.push(`Consent to sell: ${lab('l_agree', a.l_agree).toLowerCase()}.`)
      if (a.l_inherit && a.l_inherit !== 'no') t.push(`Inherited property: ${lab('l_inherit', a.l_inherit).toLowerCase()}.`)
      if (yesRows.length) t.push(`Confirmed: ${list(yesRows).toLowerCase()}.`)
      if (a.l_mortgage) t.push(`Remaining mortgage about ${ils(a.l_mortgage)}.`)
      if (unkRows.length) t.push(`To verify against documents: ${list(unkRows).toLowerCase()}.`)
      if (a.l_issues_detail) t.push(`Details: ${a.l_issues_detail}.`)
      if (a.l_area_plans === 'yes') t.push(`Plans in the area: ${a.l_area_plans_detail || 'yes'}.`)
      if (a.l_notes) t.push(`Notes: ${a.l_notes}.`)
    } else {
      if (a.l_owners) t.push(`הזכויות רשומות על שם ${a.l_owners}${a.l_rights ? ` (${lab('l_rights', a.l_rights)})` : ''}.`)
      if (a.l_more_owners === 'yes') t.push(`בעלים נוספים: ${a.l_more_owners_detail || 'כן'}.`)
      if (a.l_agree) t.push(`הסכמה למכירה: ${lab('l_agree', a.l_agree)}.`)
      if (a.l_inherit && a.l_inherit !== 'no') t.push(`הנכס התקבל בירושה: ${lab('l_inherit', a.l_inherit)}.`)
      if (yesRows.length) t.push(`דווח כי: ${list(yesRows)}.`)
      if (a.l_mortgage) t.push(`יתרת המשכנתא כ-${ils(a.l_mortgage)}.`)
      if (unkRows.length) t.push(`לבדיקה מול מסמכים: ${list(unkRows)}.`)
      if (a.l_issues_detail) t.push(`פירוט: ${a.l_issues_detail}.`)
      if (a.l_area_plans === 'yes') t.push(`תוכניות בסביבה: ${a.l_area_plans_detail || 'כן'}.`)
      if (a.l_notes) t.push(`הערות: ${a.l_notes}.`)
    }
    if (t.length) paras.push({ title: en ? 'Legal and planning' : 'משפטי ותכנוני', text: t.join(' ') })
  }
  // 7. Sale / rental & expectations
  {
    const t = []
    const bo = a.d_best_offer || {}
    const dl = a.d_deadline || {}
    const rental = purposeOf(a) === 'rental'
    if (en) {
      if (rental && a.d_ask) t.push(`Requested rent ${ils(a.d_ask)} per month${a.d_flex ? ` (${lab('d_flex', a.d_flex).toLowerCase()})` : ''}.`)
      else if (a.d_ask) t.push(`Asking price ${ils(a.d_ask)}${a.d_flex ? ` (${lab('d_flex', a.d_flex).toLowerCase()})` : ''}.`)
      if (rental) {
        if (a.d_timeline) t.push(`Availability: ${lab('d_timeline', a.d_timeline).toLowerCase()}.`)
        if (a.r_term) t.push(`Lease term: ${lab('r_term', a.r_term).toLowerCase()}.`)
        if (multi('r_guarantees').length) t.push(`Guarantees: ${list(multi('r_guarantees')).toLowerCase()}.`)
        if (multi('r_included').length) t.push(`Included in the rent: ${list(multi('r_included')).toLowerCase()}.`)
        if (a.r_pets) t.push(`Pets: ${lab('r_pets', a.r_pets).toLowerCase()}.`)
      }
      if (a.d_expected) t.push(`Realistic expectation: ${ils(a.d_expected)}.`)
      if (a.d_min) t.push(`Internal minimum: ${ils(a.d_min)}.`)
      if (bo.amount) t.push(`Highest offer so far: ${ils(bo.amount)}${bo.when ? ` (${bo.when})` : ''}${bo.notes ? `, ${bo.notes}` : ''}.`)
      if (!rental && a.d_timeline) t.push(`Timing: ${lab('d_timeline', a.d_timeline).toLowerCase()}${dl.date ? `, deadline ${dl.date}` : ''}${dl.reason ? ` (${dl.reason})` : ''}.`)
      if (a.d_vacate) t.push(`Handover: ${lab('d_vacate', a.d_vacate).toLowerCase()}${multi('d_vacate_flex').length ? ` (${list(multi('d_vacate_flex')).toLowerCase()})` : ''}.`)
      if (a.d_alt && a.d_alt !== 'no') t.push(`Buying another property: ${lab('d_alt', a.d_alt).toLowerCase()}.`)
      if (a.d_why && a.d_why !== 'private') t.push(`Reason for selling: ${lab('d_why', a.d_why).toLowerCase()}.`)
      if (a.d_published) t.push(`Listed before: ${lab('d_published', a.d_published).toLowerCase()}.`)
      if (a.d_brokers) t.push(`Other agents: ${lab('d_brokers', a.d_brokers).toLowerCase()}.`)
      if (a.d_published_detail) t.push(`Marketing so far: ${a.d_published_detail}.`)
      if (a.d_offers) t.push(`Offers: ${lab('d_offers', a.d_offers).toLowerCase()}.`)
      if (a.d_buyer) t.push(`Buyer / terms preferences: ${a.d_buyer}.`)
      if (a.d_notes) t.push(`Also important: ${a.d_notes}.`)
    } else {
      if (rental && a.d_ask) t.push(`דמי השכירות המבוקשים ${ils(a.d_ask)} לחודש${a.d_flex ? ` (${lab('d_flex', a.d_flex)})` : ''}.`)
      else if (a.d_ask) t.push(`המחיר המבוקש ${ils(a.d_ask)}${a.d_flex ? ` (${lab('d_flex', a.d_flex)})` : ''}.`)
      if (rental) {
        if (a.d_timeline) t.push(`זמינות: ${lab('d_timeline', a.d_timeline)}.`)
        if (a.r_term) t.push(`תקופת שכירות: ${lab('r_term', a.r_term)}.`)
        if (multi('r_guarantees').length) t.push(`ערבויות: ${list(multi('r_guarantees'))}.`)
        if (multi('r_included').length) t.push(`כלול בשכירות: ${list(multi('r_included'))}.`)
        if (a.r_pets) t.push(`בעלי חיים: ${lab('r_pets', a.r_pets)}.`)
      }
      if (a.d_expected) t.push(`ציפייה ריאלית: ${ils(a.d_expected)}.`)
      if (a.d_min) t.push(`מינימום פנימי: ${ils(a.d_min)}.`)
      if (bo.amount) t.push(`ההצעה הגבוהה עד היום: ${ils(bo.amount)}${bo.when ? ` (${bo.when})` : ''}${bo.notes ? `, ${bo.notes}` : ''}.`)
      if (!rental && a.d_timeline) t.push(`לוח זמנים: ${lab('d_timeline', a.d_timeline)}${dl.date ? `, דד-ליין ${dl.date}` : ''}${dl.reason ? ` (${dl.reason})` : ''}.`)
      if (a.d_vacate) t.push(`מסירה: ${lab('d_vacate', a.d_vacate)}${multi('d_vacate_flex').length ? ` (${list(multi('d_vacate_flex'))})` : ''}.`)
      if (a.d_alt && a.d_alt !== 'no') t.push(`רכישת נכס אחר: ${lab('d_alt', a.d_alt)}.`)
      if (a.d_why && a.d_why !== 'private') t.push(`סיבת המכירה: ${lab('d_why', a.d_why)}.`)
      if (a.d_published) t.push(`פורסם בעבר: ${lab('d_published', a.d_published)}.`)
      if (a.d_brokers) t.push(`מתווכים: ${lab('d_brokers', a.d_brokers)}.`)
      if (a.d_published_detail) t.push(`השיווק עד היום: ${a.d_published_detail}.`)
      if (a.d_offers) t.push(`הצעות: ${lab('d_offers', a.d_offers)}.`)
      if (a.d_buyer) t.push(`העדפות קונה / תנאים: ${a.d_buyer}.`)
      if (a.d_notes) t.push(`חשוב לדעת: ${a.d_notes}.`)
    }
    if (t.length) paras.push({ title: en ? (rental ? 'Rent, availability and expectations' : 'Price, timing and expectations') : (rental ? 'שכירות, זמינות וציפיות' : 'מחיר, זמנים וציפיות'), text: t.join(' ') })
  }
  // 8. Marketing angle
  {
    const t = []
    if (en) {
      if (a.m_pros) t.push(`Biggest advantages: ${a.m_pros}.`)
      if (a.m_unique) t.push(`What sets it apart: ${a.m_unique}.`)
      if (multi('m_nearby').length) t.push(`Within walking distance: ${list(multi('m_nearby')).toLowerCase()}.`)
      if (multi('m_fit').length) t.push(`Ideal for ${list(multi('m_fit')).toLowerCase()}.`)
      if (a.m_love) t.push(`What the owners love most: ${a.m_love}.`)
      if (a.m_story) t.push(`Worth highlighting: ${a.m_story}.`)
      if (a.m_hide) t.push(`Keep out of the listing: ${a.m_hide}.`)
      if (a.m_extra) t.push(`Also: ${a.m_extra}.`)
    } else {
      if (a.m_pros) t.push(`היתרונות הגדולים: ${a.m_pros}.`)
      if (a.m_unique) t.push(`מה מייחד: ${a.m_unique}.`)
      if (multi('m_nearby').length) t.push(`במרחק הליכה: ${list(multi('m_nearby'))}.`)
      if (multi('m_fit').length) t.push(`מתאים במיוחד ל${list(multi('m_fit'))}.`)
      if (a.m_love) t.push(`מה הבעלים הכי אוהבים: ${a.m_love}.`)
      if (a.m_story) t.push(`כדאי להדגיש: ${a.m_story}.`)
      if (a.m_hide) t.push(`לא לפרסם: ${a.m_hide}.`)
      if (a.m_extra) t.push(`עוד: ${a.m_extra}.`)
    }
    if (t.length) paras.push({ title: en ? 'The marketing angle' : 'הזווית השיווקית', text: t.join(' ') })
  }
  // 9. Materials & contact
  {
    const t = []
    const cnt = id => (Array.isArray(a[id]) ? a[id].filter(f => !f.status || f.status === 'done').length : 0)
    const files = [[cnt('u_photos'), en ? 'photos' : 'תמונות'], [cnt('u_videos'), en ? 'videos' : 'סרטונים'], [cnt('u_plan'), en ? 'floor plan files' : 'קבצי תוכנית'], [cnt('u_docs'), en ? 'documents' : 'מסמכים']].filter(x => x[0]).map(x => `${x[0]} ${x[1]}`)
    const priv = a.c_privacy || {}
    if (en) {
      if (files.length) t.push(`Materials received: ${list(files)}.`)
      if (a.c_name) t.push(`Contact: ${a.c_name}${a.c_role ? ` (${lab('c_role', a.c_role).toLowerCase()})` : ''}${a.c_phone ? `, ${a.c_phone}` : ''}${a.c_email ? `, ${a.c_email}` : ''}.`)
      if (a.c_extra?.name) t.push(`Additional contact: ${a.c_extra.name}${a.c_extra.phone ? `, ${a.c_extra.phone}` : ''}${a.c_extra.relation ? ` (${a.c_extra.relation})` : ''}.`)
      t.push(`${priv.publishPhone ? 'Phone number may be published' : 'Phone number stays private'}; ${priv.showAddress ? 'exact address may be shown' : 'exact address stays private'}.`)
    } else {
      if (files.length) t.push(`חומרים שהתקבלו: ${list(files)}.`)
      if (a.c_name) t.push(`איש קשר: ${a.c_name}${a.c_role ? ` (${lab('c_role', a.c_role)})` : ''}${a.c_phone ? `, ${a.c_phone}` : ''}${a.c_email ? `, ${a.c_email}` : ''}.`)
      if (a.c_extra?.name) t.push(`איש קשר נוסף: ${a.c_extra.name}${a.c_extra.phone ? `, ${a.c_extra.phone}` : ''}${a.c_extra.relation ? ` (${a.c_extra.relation})` : ''}.`)
      t.push(`${priv.publishPhone ? 'מותר לפרסם את מספר הטלפון' : 'מספר הטלפון נשאר חסוי'}; ${priv.showAddress ? 'מותר להציג את הכתובת המדויקת' : 'הכתובת המדויקת נשארת חסויה'}.`)
    }
    if (t.length) paras.push({ title: en ? 'Materials and contact' : 'חומרים ואיש קשר', text: t.join(' ') })
  }
  return paras
}
export const storyText = (a, lang = 'he') => buildStory(a, lang).map(p => `${p.title}\n${p.text}`).join('\n\n')

// ── Public / shareable subset ────────────────────────────────────────────────
// Internal-only answers never leave the office: they are stripped before the
// summary page (share link) and before the public story are built.
export const INTERNAL_ONLY = ['d_min', 'd_expected', 'd_best_offer', 'd_offers_received', 'l_mortgage', 'd_notes', 'm_hide']
export function publicAnswers(a) {
  const out = {}
  Object.entries(a || {}).forEach(([k, v]) => {
    if (INTERNAL_ONLY.includes(k)) return
    if (INTERNAL_ONLY.some(id => k === `${id}_other` || k === `${id}_note`)) return
    if (k.startsWith('__')) return
    out[k] = v
  })
  return out
}

// ── Intake status pipeline (shared by API + admin) ───────────────────────────
export const INTAKE_STATUSES = [
  { v: 'draft',     l: 'טיוטה',              en: 'Draft',      color: '#9A9AA8' },
  { v: 'new',       l: 'חדש / ממתין לבדיקה', en: 'New',        color: '#E05252' },
  { v: 'review',    l: 'בבדיקה',             en: 'In review',  color: '#F5A623' },
  { v: 'approved',  l: 'מאושר',              en: 'Approved',   color: '#60D4F7' },
  { v: 'published', l: 'פורסם באתר',         en: 'Published',  color: '#22C55E' },
  { v: 'inactive',  l: 'לא פעיל',            en: 'Inactive',   color: '#6B6B7A' },
  { v: 'sold',      l: 'נמכר',               en: 'Sold',       color: '#82F67F' },
]

// ═══ Natural-language headline + property story ══════════════════════════════
// Hebrew grammar helpers: property nouns carry gender (דירה is feminine, בית is
// masculine), and the story conjugates accordingly. Every sentence is skipped
// when its data is missing, so the text never shows empty placeholders.
const HE_TYPE = {
  apartment:  { noun: 'דירה',       the: 'הדירה',      constr: 'דירת',      g: 'f' },
  garden:     { noun: 'דירת גן',    the: 'דירת הגן',   constr: 'דירת גן',   g: 'f', suffix: 'בת' },
  penthouse:  { noun: 'פנטהאוז',    the: 'הפנטהאוז',   g: 'm' },
  duplex:     { noun: 'דופלקס',     the: 'הדופלקס',    g: 'm' },
  cottage:    { noun: 'קוטג׳',      the: 'הקוטג׳',     g: 'm' },
  house:      { noun: 'בית פרטי',   the: 'הבית',       g: 'm' },
  land:       { noun: 'מגרש',       the: 'המגרש',      g: 'm' },
  commercial: { noun: 'נכס מסחרי',  the: 'הנכס',       g: 'm' },
  other:      { noun: 'נכס',        the: 'הנכס',       g: 'm' },
}
const EN_TYPE = { apartment: 'apartment', garden: 'garden apartment', penthouse: 'penthouse', duplex: 'duplex', cottage: 'cottage', house: 'private house', land: 'plot of land', commercial: 'commercial property', other: 'property' }
const HE_ORD_F = ['הקרקע', 'הראשונה', 'השנייה', 'השלישית', 'הרביעית', 'החמישית', 'השישית', 'השביעית', 'השמינית', 'התשיעית', 'העשירית']
const heRooms = r => { const s = String(r || ''); if (!s) return ''; return s.endsWith('+') ? `${s.slice(0, -1)} חדרים ומעלה` : s === '1' ? 'חדר אחד' : `${s} חדרים` }
const heCount = (n, one, two, many, fem) => { const k = Number(n); if (!k) return ''; if (k === 1) return one; if (k === 2) return two; return `${fem ? ['', '', '', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע', 'עשר'][k] || k : ['', '', '', 'שלושה', 'ארבעה', 'חמישה', 'שישה', 'שבעה', 'שמונה', 'תשעה', 'עשרה'][k] || k} ${many}` }
const heFloor = f => { const n = Number(f); if (Number.isNaN(n) || f === '' || f === null || f === undefined) return ''; if (n < 0) return 'בקומת מרתף'; return n <= 10 ? `בקומה ${HE_ORD_F[n]}` : `בקומה ${n}` }
const typeInfo = a => HE_TYPE[a.p_type] || HE_TYPE.other
const heTypePhrase = a => {
  const ti = typeInfo(a)
  const rooms = heRooms(a.p_rooms)
  if (a.p_type === 'other') return a.p_type_other ? String(a.p_type_other).trim() : (rooms ? `נכס עם ${rooms}` : 'נכס')
  if (a.p_type === 'land') return a.p_area?.plot ? `מגרש של ${fmtNum(a.p_area.plot)} מ״ר` : 'מגרש'
  if (!rooms) return ti.noun
  if (ti.constr && !ti.suffix) return `${ti.constr} ${rooms}`
  return `${ti.noun} ${ti.suffix || (ti.g === 'f' ? 'בת' : 'בן')} ${rooms}`
}
const enTypePhrase = a => {
  const base = a.p_type === 'other' && a.p_type_other ? String(a.p_type_other).trim() : (EN_TYPE[a.p_type] || 'property')
  if (a.p_type === 'land') return a.p_area?.plot ? `${fmtNum(a.p_area.plot, 'en')} m² plot` : 'plot of land'
  return a.p_rooms ? `${a.p_rooms}-room ${base}` : base
}

export function headline(a, lang = 'he') {
  const addr = a.p_address || {}
  const where = [addr.street, addr.number].filter(Boolean).join(' ')
  const purpose = a.x_purpose ? (lang === 'en' ? (a.x_purpose === 'rental' ? 'for rent' : 'for sale') : (a.x_purpose === 'rental' ? 'להשכרה' : 'למכירה')) : ''
  if (lang === 'en') {
    const head = [enTypePhrase(a), purpose].filter(Boolean).join(' ')
    const place = [where, addr.city].filter(Boolean).join(', ')
    if (!head && !place) return ''
    return place ? `${head ? head + ', ' : ''}${place}` : head
  }
  const head = [heTypePhrase(a), purpose].filter(Boolean).join(' ')
  if (where && addr.city) return `${head}, ${where}, ${addr.city}`
  if (addr.city) return `${head} ב${addr.city}`
  return head
}

export function buildStory(a, lang = 'he') {
  if (lang === 'en') return buildStoryEn(a)
  const S = id => STEPS.find(s => s.id === id)
  const known = (id, x) => { const st = S(id); const opts = st ? (stepOpts(st, a) || []) : []; return opts.some(o => o.v === x) }
  const lab = (id, v) => (v === undefined || v === null || v === '') ? '' : optLabel(S(id), v, 'he', a)
  // only values that exist in the (purpose-specific) option list — a stale answer never leaks as a raw key
  const labs = id => Array.isArray(a[id]) ? a[id].filter(x => known(id, x)).map(x => optLabel(S(id), x, 'he', a)) : []
  const list = arr => { if (!arr.length) return ''; if (arr.length === 1) return arr[0]; const last = arr[arr.length - 1]; return arr.slice(0, -1).join(', ') + (/^[\d₪]/.test(last) ? ' ו-' : ' ו') + last }
  const num = n => fmtNum(n, 'he')
  const ils = n => (n === undefined || n === null || n === '' || Number.isNaN(Number(n))) ? '' : `${num(n)} ₪`
  const ti = typeInfo(a), fem = ti.g === 'f', the = ti.the, inThe = `ב${the.replace(/^ה/, '')}`
  const v = (f, m) => (fem ? f : m)   // verb / adjective by gender
  const addr = a.p_address || {}, area = a.p_area || {}, fl = a.p_floor || {}
  const rental = purposeOf(a) === 'rental'
  const land = isLand(a), house = isHouse(a)
  const wordF = n => ({ 1: 'אחת', 2: 'שתיים', 3: 'שלוש', 4: 'ארבע', 5: 'חמש', 6: 'שש', 7: 'שבע', 8: 'שמונה', 9: 'תשע', 10: 'עשר' })[Number(n)] || String(n)
  const clean = t => String(t || '').trim().replace(/[.\s]+$/, '')
  const paras = []
  const add = (title, sentences) => { const t = sentences.filter(Boolean).join(' ').trim(); if (t) paras.push({ title, text: t }) }

  // 1. הנכס
  {
    const where = [addr.street, addr.number].filter(Boolean).join(' ')
    const place = where ? `ברחוב ${where}${addr.neighborhood ? `, בשכונת ${addr.neighborhood},` : ''}${addr.city ? ` ב${addr.city}` : ''}` : (addr.city ? `ב${addr.city}` : '')
    const floorTxt = !house ? heFloor(fl.floor) : ''
    const floorFull = floorTxt ? `${floorTxt}${fl.totalFloors ? ` מתוך ${Number(fl.totalFloors) <= 10 ? wordF(fl.totalFloors) : fl.totalFloors}` : ''}` : ''
    const extras = [
      area.balcony ? `מרפסת של ${num(area.balcony)} מ״ר` : '',
      area.roof ? `גג של ${num(area.roof)} מ״ר` : '',
      area.garden ? `גינה של ${num(area.garden)} מ״ר` : '',
    ].filter(Boolean)
    const sizeTxt = [
      area.built ? ` בשטח בנוי של ${num(area.built)} מ״ר` : '',
      extras.length ? `${area.built ? ',' : ''} עם ${list(extras)}` : '',
      area.plot && !land ? `, על מגרש של ${num(area.plot)} מ״ר` : '',
    ].join('')
    const opening = `${place ? place + ', ' : ''}${floorFull ? floorFull + ', ' : ''}${v('נמצאת', 'נמצא')} ${heTypePhrase(a)}${sizeTxt}.`
    const b = a.p_baths || {}
    const baths = b.bathrooms ? heCount(b.bathrooms, 'חדר רחצה אחד', 'שני חדרי רחצה', 'חדרי רחצה') : ''
    const toilets = b.toilets && Number(b.toilets) !== Number(b.bathrooms) ? heCount(b.toilets, 'יחידת שירותים אחת', 'שתי יחידות שירותים', 'יחידות שירותים', true) : ''
    add('הנכס', [
      opening,
      baths ? `${inThe} ${baths}${toilets ? ` ו${toilets}` : ''}.` : '',
      a.p_year ? `${the} ${v('נבנתה', 'נבנה')} בשנת ${a.p_year}.` : '',
    ])
  }
  // 2. אור, כיוונים ונוף
  {
    const dirs = Array.isArray(a.p_directions) ? a.p_directions : []
    const dirTxt = a[noteKey('p_directions')] || directionsText(dirs, 'he')
    const VIEW = { open: 'נוף פתוח', urban: 'נוף עירוני', sea: 'הים', park: 'הפארק', garden: 'הגינה', hills: 'ההרים', sunset: 'השקיעה' }
    const views = (Array.isArray(a.p_view) ? a.p_view : []).map(x => VIEW[x]).filter(Boolean)
    const dirSentence = dirTxt ? clean(dirTxt)
      .replace(/^נכס פינתי, פונה/, `${the} ${v('פינתית ופונה', 'פינתי ופונה')}`)
      .replace(/^פונה/, `${the} ${v('פונה', 'פונה')}`)
      .replace(/^ארבעה כיווני אוויר/, `${the} ${v('נהנית', 'נהנה')} מארבעה כיווני אוויר`)
      .replace(/^שלושה כיווני אוויר/, `${the} ${v('נהנית', 'נהנה')} משלושה כיווני אוויר`) : ''
    add('אור, כיוונים ונוף', [
      dirSentence ? `${/^ה/.test(dirSentence) ? dirSentence : `${the}: ${dirSentence}`}.` : '',
      views.length ? `מהחלונות ${views.length > 1 ? 'נשקפים' : 'נשקף'} ${list(views)}.` : '',
    ])
  }
  // 3. מה יש בנכס
  if (!land) {
    const pk = Number(a.f_parking?.parking || 0)
    const pkTypes = labs('f_parking_type').map(x => x.replace(/ \(.*\)$/, ''))
    const parkingTxt = a.f_parking ? (pk ? `${pk === 1 ? 'חניה אחת' : pk === 2 ? 'שתי חניות' : `${pk} חניות`}${pkTypes.length ? ` (${list(pkTypes)})` : ''}` : '') : ''
    const has = [
      a.f_mamad === 'yes' ? 'ממ״ד' : a.f_mamad === 'shared' ? 'מקלט משותף בבניין' : '',
      a.f_elevator === 'shabbat' ? 'מעלית (כולל מעלית שבת)' : a.f_elevator === 'yes' ? 'מעלית' : '',
      parkingTxt,
      a.f_storage === 'yes' ? `מחסן${a.f_storage_size ? ` של ${num(a.f_storage_size)} מ״ר` : ''}` : '',
    ].filter(Boolean)
    const lacks = [a.f_mamad === 'no' ? 'ממ״ד' : '', a.f_elevator === 'no' ? 'מעלית' : '', a.f_parking && !pk ? 'חניה פרטית' : '', a.f_storage === 'no' ? 'מחסן' : ''].filter(Boolean)
    const kitchen = a.f_kitchen ? ({ open: 'המטבח פתוח לסלון', semi: 'המטבח חצי פתוח לסלון', closed: 'המטבח סגור' })[a.f_kitchen] + `${a.f_island === 'yes' ? ' וכולל אי' : ''}.` : (a.f_island === 'yes' ? 'במטבח יש אי.' : '')
    const climate = a.f_climate ? ({
      central: `${inThe} מיזוג מרכזי.`, mini: `${inThe} מיזוג מיני-מרכזי.`, units: 'יש מזגנים בכל החדרים.', partial: 'יש מזגן בחלק מהחדרים.', none: `${inThe} אין מיזוג.`,
      other: `המיזוג: ${clean(a.f_climate_other) || 'אחר'}.`,
    })[a.f_climate] || '' : ''
    const rooms = labs('f_rooms')
    const water = labs('f_water').map(x => x === 'אחר' ? clean(a.f_water_other) : x).filter(Boolean)
    const sys = labs('f_systems').filter(x => !/אין תוספות/.test(x))
    add('מה יש בנכס', [
      has.length ? `${inThe} ${list(has)}.` : '',
      lacks.length ? `אין ${list(lacks)}.` : '',
      kitchen, climate,
      rooms.length ? `בנוסף יש ${inThe} ${list(rooms)}.` : '',
      water.length ? `המים מחוממים באמצעות ${list(water)}.` : '',
      sys.length ? `${the} ${v('מצוידת', 'מצויד')} גם ${list(sys.map(x => `ב${x}`))}.` : '',
    ])
  }
  // 4. מצב הנכס ומי מתגורר בו
  if (!land) {
    const state = a.p_state ? ({ new: `${the} ${v('חדשה', 'חדש')} מקבלן.`, secondhand: `${the} מיד שנייה, ${v('שמורה', 'שמור')} ובמצב טוב.`, renovated: `${the} לאחר שיפוץ.`, needs: `${the} ${v('דורשת', 'דורש')} שיפוץ.` })[a.p_state] : ''
    const RENO = { kitchen: 'המטבח', baths: 'חדרי הרחצה', floor: 'הריצוף', electric: 'מערכת החשמל', plumbing: 'האינסטלציה', windows: 'החלונות', paint: 'הצבע', ac: 'המיזוג', doors: 'הדלתות', closets: 'הארונות', aluminum: 'האלומיניום והתריסים', sealing: 'האיטום', lighting: 'התאורה', roof: 'הגג', garden: 'הגינה והחצר', facade: 'החזית', full: 'הנכס כולו' }
    const renoWhat = (Array.isArray(a.k_reno_what) ? a.k_reno_what : []).map(x => x === 'other' ? clean(a.k_reno_what_other) : RENO[x]).filter(Boolean)
    const reno = a.k_renovated === 'yes' || a.k_renovated === 'partial'
      ? `${the} ${a.k_renovated === 'partial' ? v('עברה שיפוץ חלקי', 'עבר שיפוץ חלקי') : v('שופצה', 'שופץ')}${a.k_reno_year ? ` בשנת ${a.k_reno_year}` : ''}${renoWhat.length ? `, ובמסגרת השיפוץ חודשו ${list(renoWhat)}` : ''}.`
      : a.k_renovated === 'no' ? `${the} לא ${v('שופצה', 'שופץ')}.` : ''
    const m = a.k_matrix || {}
    const rate = (k, plural) => ({ excellent: 'במצב מצוין', good: 'במצב טוב', fair: 'במצב סביר', poor: plural ? 'דורשים טיפול' : 'דורש טיפול' })[m[k]] || ''
    const cond = [m.kitchen ? `המטבח ${rate('kitchen')}` : '', m.baths ? `חדרי הרחצה ${rate('baths', true)}` : '', m.floor ? `הריצוף ${rate('floor')}` : '', m.windows ? `החלונות ${rate('windows', true)}` : '', m.ac ? `המזגנים ${rate('ac', true)}` : ''].filter(Boolean)
    const defects = a.k_defects === 'yes' ? `הבעלים מדווחים על ליקויים: ${clean(a.k_defects_detail) || 'הפרטים יימסרו בהמשך'}.` : a.k_defects === 'no' ? 'לא ידועים ליקויים בנכס.' : ''
    const moist = a.k_moisture === 'current' ? 'קיימת כיום רטיבות בנכס.' : a.k_moisture === 'fixed' ? 'בעבר הייתה רטיבות, והיא טופלה.' : a.k_moisture === 'none' ? 'אין בעיות רטיבות.' : ''
    const invest = a.k_investment ? ({ none: `${the} ${v('מוכנה', 'מוכן')} לכניסה מיידית.`, light: 'לפני הכניסה נדרשת השקעה קלה בלבד (צבע ותיקונים קטנים).', major: 'לפני הכניסה נדרשת השקעה משמעותית.' })[a.k_investment] : ''
    const fd = clean(a.f_furniture_detail)
    const furn = a.f_furniture ? ({ none: `${the} ${v('נמסרת ריקה', 'נמסר ריק')}, ללא ריהוט.`, fixed: 'בנכס נשארים המטבח, ארונות הקיר והמזגנים.', partial: `חלק מהריהוט והמכשירים נשארים בנכס${fd ? `: ${fd}` : ''}.`, full: `${the} ${v('נמסרת מרוהטת', 'נמסר מרוהט')} במלואה${fd ? ` (${fd})` : ''}.`, flexible: `הריהוט גמיש, בהתאם ל${rental ? 'שוכר' : 'קונה'}${fd ? ` (${fd})` : ''}.` })[a.f_furniture] : ''
    const lease = a.k_lease || {}
    const occ = a.k_occupancy ? ({ vacant: `${the} ${v('פנויה', 'פנוי')} כיום.`, owners: 'כיום מתגוררים בנכס הבעלים.', family: 'כיום מתגוררים בנכס בני משפחה, ללא חוזה שכירות.', rented: `${the} ${v('מושכרת', 'מושכר')} כיום${lease.leaseEnd ? `, והחוזה מסתיים ב-${lease.leaseEnd}` : ''}${lease.rent ? ` (דמי השכירות: ${ils(lease.rent)} לחודש)` : ''}.${lease.notes ? ` ${clean(lease.notes)}.` : ''}` })[a.k_occupancy] : ''
    add('מצב הנכס ומי מתגורר בו', [state, reno, cond.length ? `${list(cond)}.` : '', defects, moist, invest, furn, occ])
  }
  // 5. הבניין
  if (!house) {
    const b = a.b_numbers || {}, fees = a.b_fees || {}
    const facts = [b.apartments ? `${b.apartments} דירות` : '', b.floors ? `${Number(b.floors) <= 10 ? wordF(b.floors) : b.floors} קומות` : '', b.elevators ? heCount(b.elevators, 'מעלית אחת', 'שתי מעליות', 'מעליות', true) : ''].filter(Boolean)
    const amen = labs('b_amenities').map(x => x === 'אחר' ? clean(a.b_amenities_other) : x).filter(Boolean)
    const feeTxt = [fees.vaad ? `דמי ועד הבית ${ils(fees.vaad)} לחודש` : '', fees.management ? `דמי הניהול ${ils(fees.management)} לחודש` : ''].filter(Boolean)
    const renov = a.b_renovation ? ({ no: 'לא צפוי שיפוץ בבניין.', planned: 'מתוכנן שיפוץ בבניין.', inProgress: 'הבניין נמצא כעת בשיפוץ.', unknown: '' })[a.b_renovation] : ''
    const tama = a.b_tama && a.b_tama !== 'none' && a.b_tama !== 'unknown' ? `הבניין בתהליך התחדשות עירונית (${lab('b_tama', a.b_tama)})${a.b_tama_detail ? `: ${clean(a.b_tama_detail)}` : ''}.` : a.b_tama === 'none' ? 'הבניין אינו בתהליך התחדשות עירונית.' : ''
    add('הבניין', [
      (b.year || facts.length) ? `הבניין${b.year ? ` נבנה בשנת ${b.year}` : ''}${facts.length ? `${b.year ? ', ובו' : ' כולל'} ${list(facts)}` : ''}.` : '',
      amen.length ? `בבניין ${list(amen)}.` : '',
      feeTxt.length ? `${list(feeTxt)}.` : '',
      renov, tama,
    ])
  }
  // 6. מצב משפטי ותכנוני
  {
    const m = a.l_matrix || {}
    const yes = k => m[k] === 'yes', no = k => m[k] === 'no', unk = k => m[k] === 'unknown'
    const reg = a.l_rights ? ({ tabu: 'בטאבו', rmi: 'ברשות מקרקעי ישראל', company: 'בחברה משכנת', other: clean(a.l_rights_other) ? `(${clean(a.l_rights_other)})` : '', unknown: '' })[a.l_rights] : ''
    const ownersTxt = a.l_owners ? `הזכויות בנכס רשומות${reg ? ` ${reg}` : ''} על שם ${clean(a.l_owners)}.` : (reg ? `הנכס רשום ${reg}.` : '')
    const agree = a.l_agree ? ({ single: 'הנכס בבעלות יחידה, ואין צורך בהסכמת גורם נוסף.', yes: `כל הבעלים מסכימים ל${rental ? 'השכרה' : 'מכירה'}.`, mostly: `רוב הבעלים מסכימים ל${rental ? 'השכרה' : 'מכירה'}, והסכמת היתר עדיין מתואמת.`, no: `חלק מהבעלים מתנגדים ל${rental ? 'השכרה' : 'מכירה'}, ויש להסדיר זאת לפני תחילת השיווק.` })[a.l_agree] : ''
    const more = a.l_more_owners === 'yes' ? `בעלים נוספים: ${clean(a.l_more_owners_detail) || 'הפרטים יימסרו בהמשך'}.` : ''
    const inherit = a.l_inherit === 'yes' ? 'הנכס התקבל בירושה, וההליך הוסדר.' : a.l_inherit === 'pending' ? 'הנכס התקבל בירושה, והליך הירושה עדיין מתנהל.' : ''
    const mort = yes('mortgage') ? `על הנכס רובצת משכנתא${a.l_mortgage ? `, ביתרה משוערת של כ-${ils(a.l_mortgage)}` : ''}.` : no('mortgage') ? 'הנכס נקי ממשכנתא.' : ''
    const issues = clean(a.l_issues_detail)
    const liens = yes('liens') || yes('legalProc') ? `${yes('liens') && yes('legalProc') ? 'קיימים שעבודים וכן הליך משפטי הקשור לנכס' : yes('liens') ? 'קיימים שעבודים או עיקולים' : 'קיים הליך משפטי הקשור לנכס'}${issues ? `: ${issues}` : ''}.` : (no('liens') && no('legalProc')) ? 'אין שעבודים, עיקולים או הליכים משפטיים.' : ''
    const viol = yes('violation') ? `ידועה חריגת בנייה${!yes('liens') && !yes('legalProc') && issues ? `: ${issues}` : ''}.` : no('violation') ? 'לא ידועות חריגות בנייה.' : ''
    const permit = yes('permit') ? 'קיים היתר בנייה.' : ''
    const rights = yes('extraRights') ? 'קיימות זכויות בנייה נוספות שטרם נוצלו.' : ''
    const attach = [yes('parkingTabu') ? 'החניה' : '', yes('storageTabu') ? 'המחסן' : ''].filter(Boolean)
    const attachTxt = attach.length ? `${list(attach)} ${attach.length > 1 ? 'רשומים' : (attach[0] === 'החניה' ? 'רשומה' : 'רשום')} בנסח כהצמדה לנכס.` : ''
    const toCheck = visibleRows(S('l_matrix') || { rows: [] }, a).filter(r => unk(r.k)).map(r => L(r, 'he').replace(/^(קיים|קיימת|קיימים|קיימות|ידועה) /, ''))
    const plans = a.l_area_plans === 'yes' ? `בסביבת הנכס ידועות תוכניות בנייה או התחדשות עירונית${a.l_area_plans_detail ? `: ${clean(a.l_area_plans_detail)}` : ''}.` : a.l_area_plans === 'no' ? 'לא ידוע על תוכניות בנייה בסביבה.' : ''
    add('מצב משפטי ותכנוני', [ownersTxt, more, agree, inherit, mort, liens, viol, permit, rights, attachTxt, toCheck.length ? `נותר לאמת מול נסח הטאבו: ${list(toCheck)}.` : '', plans, clean(a.l_notes) ? `הערת הבעלים: ${clean(a.l_notes)}.` : ''])
  }
  // 7. המכירה / ההשכרה
  {
    const bo = a.d_best_offer || {}, dl = a.d_deadline || {}
    const flex = a.d_flex ? ({ firm: rental ? ', והסכום סופי' : ', והמחיר סופי', little: ', עם גמישות מסוימת', flexible: ', והבעלים פתוחים למשא ומתן' })[a.d_flex] : ''
    const pub = a.d_published ? ({ no: `הנכס לא פורסם בעבר ל${rental ? 'השכרה' : 'מכירה'}.`, past: `הנכס פורסם בעבר ל${rental ? 'השכרה' : 'מכירה'} והורד מהשוק.`, current: `הנכס מפורסם ל${rental ? 'השכרה' : 'מכירה'} גם כיום.` })[a.d_published] : ''
    const brokers = a.d_brokers ? ({ none: 'הנכס אינו נמצא אצל מתווכים נוספים.', others: 'הנכס נמצא גם אצל מתווכים נוספים, ללא בלעדיות.', exclusive: 'הנכס בבלעדיות אצל משרד אחר.', expired: 'הייתה בלעדיות אצל משרד אחר, והיא הסתיימה.', self: 'הבעלים מפרסמים את הנכס בעצמם.' })[a.d_brokers] : ''
    if (rental) {
      const avail = a.d_timeline ? ({ now: `${the} ${v('זמינה', 'זמין')} להשכרה מיידית.`, m1: `${the} ${v('תהיה זמינה', 'יהיה זמין')} תוך חודש.`, m3: `${the} ${v('תהיה זמינה', 'יהיה זמין')} תוך שלושה חודשים לכל היותר.`, lease: `${the} ${v('תתפנה', 'יתפנה')} בסיום חוזה השוכרים הנוכחיים.`, flex: 'מועד הכניסה גמיש.' })[a.d_timeline] : ''
      const term = a.r_term ? ({ y1: 'חוזה לשנה', y1opt: 'חוזה לשנה עם אופציה להארכה', y2: 'חוזה לשנתיים ומעלה', short: 'חוזה לטווח קצר (פחות משנה)', flex: 'תקופת שכירות גמישה' })[a.r_term] : ''
      const guar = (Array.isArray(a.r_guarantees) ? a.r_guarantees : []).filter(x => x !== 'flex').map(x => lab('r_guarantees', x)).filter(Boolean)
      const inc = labs('r_included').filter(x => !/לא כלול/.test(x))
      add('ההשכרה והתנאים', [
        a.d_ask ? `דמי השכירות המבוקשים הם ${ils(a.d_ask)} לחודש${flex}.` : '',
        a.d_min ? `דמי השכירות המינימליים שהבעלים ישקלו הם ${ils(a.d_min)} לחודש (נתון פנימי, לא לפרסום).` : '',
        avail,
        term ? `הבעלים מכוונים ל${term}.` : '',
        guar.length ? `הערבויות שיתבקשו: ${list(guar)}.` : (a.r_guarantees?.includes('flex') ? 'סוג הערבויות ייקבע בתיאום עם השוכרים.' : ''),
        inc.length ? `דמי השכירות כוללים ${list(inc)}.` : a.r_included?.includes('none') ? 'דמי השכירות אינם כוללים תשלומים נוספים.' : '',
        a.r_pets ? ({ yes: 'מותר להחזיק בעלי חיים.', no: 'לא ניתן להחזיק בעלי חיים.', negotiable: 'החזקת בעלי חיים תיבחן לגופו של מקרה.' })[a.r_pets] : '',
        pub, brokers,
        clean(a.d_published_detail) ? `על השיווק עד היום: ${clean(a.d_published_detail)}.` : '',
        clean(a.d_buyer) ? `העדפות לגבי השוכרים: ${clean(a.d_buyer)}.` : '',
        clean(a.d_notes) ? `חשוב לדעת: ${clean(a.d_notes)}.` : '',
      ])
    } else {
      const when = a.d_timeline ? ({ asap: 'בהקדם האפשרי', m3: 'בחודשים הקרובים', m6: 'תוך חצי שנה', y1: 'תוך שנה', norush: 'ללא לחץ של זמן, ורק במחיר הנכון' })[a.d_timeline] : ''
      const vacate = a.d_vacate ? ({ immediate: 'באופן מיידי', m3: 'תוך שלושה חודשים', m6: 'תוך שלושה עד שישה חודשים', y1: 'תוך חצי שנה עד שנה', later: 'בעוד יותר משנה', flexible: 'במועד גמיש' })[a.d_vacate] : ''
      const vflex = (Array.isArray(a.d_vacate_flex) ? a.d_vacate_flex : []).map(x => ({ earlier: 'ניתן להקדים', later: 'ניתן לדחות' })[x]).filter(Boolean)
      add('המכירה והציפיות', [
        a.d_ask ? `המחיר המבוקש הוא ${ils(a.d_ask)}${flex}.` : '',
        a.d_expected ? `הציפייה הריאלית של הבעלים היא כ-${ils(a.d_expected)}.` : '',
        a.d_min ? `המחיר המינימלי שהבעלים ישקלו הוא ${ils(a.d_min)} (נתון פנימי, לא לפרסום).` : '',
        a.d_offers_received === 'yes' && bo.amount ? `ההצעה הגבוהה ביותר שהתקבלה עד היום עמדה על ${ils(bo.amount)}${bo.when ? ` (${clean(bo.when)})` : ''}${clean(bo.notes) ? `. ${clean(bo.notes)}` : ''}.` : a.d_offers_received === 'no' ? 'טרם התקבלו הצעות על הנכס.' : '',
        when ? `הבעלים מעוניינים למכור ${when}${vacate ? `, ולמסור את הנכס ${vacate}` : ''}.` : (vacate ? `מסירת הנכס ${vacate}.` : ''),
        dl.date ? `יש מועד חשוב להשלמת המכירה: ${dl.date}${clean(dl.reason) ? ` (${clean(dl.reason)})` : ''}.` : '',
        vflex.length ? `את מועד המסירה ${list(vflex)}.` : '',
        a.d_alt ? ({ no: '', looking: 'המכירה תלויה ברכישת נכס חלופי, והבעלים עדיין מחפשים.', found: 'המכירה תלויה ברכישת נכס חלופי שכבר נמצא.', after: 'הבעלים ירכשו נכס אחר רק לאחר המכירה.' })[a.d_alt] : '',
        a.d_why && a.d_why !== 'private' ? `סיבת המכירה: ${a.d_why === 'other' ? (clean(a.d_why_other) || 'אחר') : lab('d_why', a.d_why)}.` : '',
        pub, brokers,
        clean(a.d_published_detail) ? `על השיווק עד היום: ${clean(a.d_published_detail)}.` : '',
        a.d_offers ? ({ open: 'הבעלים פתוחים לכל הצעה רצינית.', close: 'הבעלים ישקלו רק הצעות הקרובות למחיר המבוקש.', firm: 'המחיר סופי.' })[a.d_offers] : '',
        clean(a.d_buyer) ? `העדפות לגבי הקונה או תנאי העסקה: ${clean(a.d_buyer)}.` : '',
        clean(a.d_notes) ? `חשוב לדעת: ${clean(a.d_notes)}.` : '',
      ])
    }
  }
  // 8. מה מייחד את הנכס
  {
    const near = labs('m_nearby').map(x => x === 'אחר' ? clean(a.m_nearby_other) : x).filter(Boolean)
    const fit = labs('m_fit').map(x => x === 'אחר' ? clean(a.m_fit_other) : x).filter(Boolean)
    add('מה מייחד את הנכס', [
      clean(a.m_pros) ? `לדברי הבעלים, היתרון הגדול של הנכס הוא ${clean(a.m_pros)}.` : '',
      clean(a.m_unique) ? `מה שמייחד ${v('אותה', 'אותו')} לעומת נכסים אחרים באזור: ${clean(a.m_unique)}.` : '',
      clean(a.m_love) ? `מה שהבעלים הכי אוהבים בנכס: ${clean(a.m_love)}.` : '',
      near.length ? `במרחק הליכה: ${list(near)}.` : '',
      fit.length ? `${the} ${v('מתאימה', 'מתאים')} במיוחד ${list(fit.map(x => `ל${x}`))}.` : '',
      clean(a.m_story) ? `בפרסום חשוב להדגיש: ${clean(a.m_story)}.` : '',
      clean(a.m_hide) ? `לא לפרסם: ${clean(a.m_hide)}.` : '',
      clean(a.m_extra) ? `עוד כדאי לדעת: ${clean(a.m_extra)}.` : '',
    ])
  }
  // 9. תמונות, מסמכים ואיש קשר
  {
    const cnt = id => (Array.isArray(a[id]) ? a[id].filter(f => !f.status || f.status === 'done').length : 0)
    const files = [
      [cnt('u_photos'), 'תמונה אחת', 'תמונות'], [cnt('u_videos'), 'סרטון אחד', 'סרטונים'], [cnt('u_plan'), 'קובץ תוכנית אחד', 'קבצי תוכנית'], [cnt('u_docs'), 'מסמך אחד', 'מסמכים'],
    ].filter(x => x[0]).map(x => x[0] === 1 ? x[1] : `${x[0]} ${x[2]}`)
    const priv = a.c_privacy || {}
    const role = a.c_role ? ({ owner: 'הבעלים', partial: 'אחד הבעלים', poa: 'מיופה כוח', family: 'בן משפחה של הבעלים', other: clean(a.c_role_other) || 'איש קשר' })[a.c_role] : ''
    add('תמונות, מסמכים ואיש קשר', [
      files.length ? `לתיק הנכס צורפו ${list(files)}.` : 'לתיק הנכס טרם צורפו תמונות או מסמכים.',
      a.c_name ? `איש הקשר לנכס: ${clean(a.c_name)}${role ? ` (${role})` : ''}${a.c_phone ? `, טלפון ${a.c_phone}` : ''}${a.c_email ? `, דוא״ל ${a.c_email}` : ''}.` : '',
      a.c_extra?.name ? `איש קשר נוסף: ${clean(a.c_extra.name)}${a.c_extra.phone ? `, ${a.c_extra.phone}` : ''}${clean(a.c_extra.relation) ? ` (${clean(a.c_extra.relation)})` : ''}.` : '',
      `${priv.publishPhone ? 'מותר לפרסם את מספר הטלפון' : 'מספר הטלפון לא יפורסם'}, ו${priv.showAddress ? 'הכתובת המדויקת יכולה להופיע בפרסום' : 'הכתובת המדויקת לא תופיע בפרסום'}.`,
    ])
  }
  return paras
}

function buildStoryEn(a) {
  const S = id => STEPS.find(s => s.id === id)
  const lab = (id, v) => (v === undefined || v === null || v === '') ? '' : optLabel(S(id), v, 'en', a)
  const labs = id => Array.isArray(a[id]) ? a[id].map(x => optLabel(S(id), x, 'en', a)) : []
  const list = arr => arr.length ? (arr.length === 1 ? arr[0] : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]) : ''
  const num = n => fmtNum(n, 'en')
  const ils = n => (n === undefined || n === null || n === '' || Number.isNaN(Number(n))) ? '' : `₪${num(n)}`
  const addr = a.p_address || {}, area = a.p_area || {}, fl = a.p_floor || {}
  const rental = purposeOf(a) === 'rental', land = isLand(a), house = isHouse(a)
  const paras = []
  const add = (title, s) => { const t = s.filter(Boolean).join(' ').trim(); if (t) paras.push({ title, text: t }) }
  const lc = s => String(s || '').toLowerCase()
  {
    const where = [addr.street, addr.number].filter(Boolean).join(' ')
    const place = [where, addr.neighborhood, addr.city].filter(Boolean).join(', ')
    const sizes = [area.built ? `${num(area.built)} m² built` : '', area.balcony ? `a ${num(area.balcony)} m² balcony` : '', area.roof ? `a ${num(area.roof)} m² roof` : '', area.garden ? `a ${num(area.garden)} m² garden` : '', area.plot && !land ? `a ${num(area.plot)} m² plot` : ''].filter(Boolean)
    const tp = enTypePhrase(a)
    const b = a.p_baths || {}
    add('The property', [
      `${/^[aeiou]/i.test(tp) ? 'An' : 'A'} ${tp}${place ? ` at ${place}` : ''}${!house && fl.floor !== undefined && fl.floor !== '' ? `, on floor ${fl.floor}${fl.totalFloors ? ` of ${fl.totalFloors}` : ''}` : ''}${sizes.length ? `, with ${list(sizes)}` : ''}.`,
      b.bathrooms ? `It has ${b.bathrooms} bathroom${Number(b.bathrooms) === 1 ? '' : 's'}${b.toilets && Number(b.toilets) !== Number(b.bathrooms) ? ` and ${b.toilets} toilets` : ''}.` : '',
      a.p_year ? `It was built in ${a.p_year}.` : '',
    ])
  }
  {
    const d = a[noteKey('p_directions')] || directionsText(a.p_directions, 'en')
    const views = labs('p_view').filter(x => x && !/no particular/i.test(x))
    add('Light and view', [d ? `The property ${lc(d).replace(/^corner property /, 'is a corner unit ')}` : '', views.length ? `The view: ${lc(list(views))}.` : ''])
  }
  if (!land) {
    const pk = Number(a.f_parking?.parking || 0)
    const has = [a.f_mamad === 'yes' ? 'a safe room (Mamad)' : a.f_mamad === 'shared' ? 'a shared shelter in the building' : '', a.f_elevator === 'shabbat' ? 'an elevator including a Shabbat elevator' : a.f_elevator === 'yes' ? 'an elevator' : '', pk ? `${pk} parking space${pk > 1 ? 's' : ''}${labs('f_parking_type').length ? ` (${lc(list(labs('f_parking_type')))})` : ''}` : '', a.f_storage === 'yes' ? `a storage room${a.f_storage_size ? ` of ${num(a.f_storage_size)} m²` : ''}` : ''].filter(Boolean)
    const lacks = [a.f_mamad === 'no' ? 'a safe room' : '', a.f_elevator === 'no' ? 'an elevator' : '', a.f_parking && !pk ? 'private parking' : '', a.f_storage === 'no' ? 'a storage room' : ''].filter(Boolean)
    add('Features', [
      has.length ? `The property has ${list(has)}.` : '', lacks.length ? `There is no ${list(lacks)}.` : '',
      a.f_kitchen ? `The kitchen is ${lc(lab('f_kitchen', a.f_kitchen))}${a.f_island === 'yes' ? ' and has an island' : ''}.` : '',
      a.f_climate ? (a.f_climate === 'none' ? 'There is no air conditioning.' : `Air conditioning: ${lc(lab('f_climate', a.f_climate))}${a.f_climate === 'other' && a.f_climate_other ? ` (${a.f_climate_other})` : ''}.`) : '',
      labs('f_rooms').length ? `Additional spaces: ${lc(list(labs('f_rooms')))}.` : '',
      labs('f_water').length ? `Water is heated by ${lc(list(labs('f_water')))}.` : '',
      labs('f_systems').filter(x => !/no special/i.test(x)).length ? `Extras: ${lc(list(labs('f_systems').filter(x => !/no special/i.test(x))))}.` : '',
    ])
  }
  if (!land) {
    const m = a.k_matrix || {}
    const cond = visibleRows(S('k_matrix') || { rows: [] }, a).filter(r => m[r.k]).map(r => `${lc(L(r, 'en'))} ${lc(optLabel(S('k_matrix'), m[r.k], 'en'))}`)
    const lease = a.k_lease || {}
    add('Condition and occupancy', [
      a.p_state ? `Overall the property is ${lc(lab('p_state', a.p_state))}.` : '',
      a.k_renovated === 'yes' || a.k_renovated === 'partial' ? `It was ${a.k_renovated === 'partial' ? 'partially ' : ''}renovated${a.k_reno_year ? ` in ${a.k_reno_year}` : ''}${labs('k_reno_what').length ? ` (${lc(list(labs('k_reno_what')))})` : ''}.` : a.k_renovated === 'no' ? 'It has not been renovated.' : '',
      cond.length ? `Condition: ${list(cond)}.` : '',
      a.k_defects === 'yes' ? `Known defects: ${a.k_defects_detail || 'details to follow'}.` : a.k_defects === 'no' ? 'No known defects.' : '',
      a.k_moisture === 'current' ? 'There is currently some moisture.' : a.k_moisture === 'fixed' ? 'A past moisture issue was fixed.' : a.k_moisture === 'none' ? 'No moisture issues.' : '',
      a.k_investment ? ({ none: 'It is ready to move in.', light: 'Only light work (paint, small repairs) is needed before moving in.', major: 'Significant investment is needed before moving in.' })[a.k_investment] : '',
      a.f_furniture ? `What stays: ${lc(lab('f_furniture', a.f_furniture))}${a.f_furniture_detail ? ` (${a.f_furniture_detail})` : ''}.` : '',
      a.k_occupancy ? `Occupancy: ${lc(lab('k_occupancy', a.k_occupancy))}${a.k_occupancy === 'rented' && lease.leaseEnd ? `, lease ends ${lease.leaseEnd}` : ''}${lease.rent ? ` (rent ${ils(lease.rent)}/month)` : ''}.` : '',
    ])
  }
  if (!house) {
    const b = a.b_numbers || {}, fees = a.b_fees || {}
    const facts = [b.apartments ? `${b.apartments} apartments` : '', b.floors ? `${b.floors} floors` : '', b.elevators ? `${b.elevators} elevator${Number(b.elevators) === 1 ? '' : 's'}` : ''].filter(Boolean)
    add('The building', [
      (b.year || facts.length) ? `The building${b.year ? ` was built in ${b.year}` : ''}${facts.length ? `${b.year ? ' and has' : ' has'} ${list(facts)}` : ''}.` : '',
      labs('b_amenities').length ? `In the building: ${lc(list(labs('b_amenities')))}.` : '',
      fees.vaad ? `Building committee fee ${ils(fees.vaad)}/month.` : '', fees.management ? `Management fee ${ils(fees.management)}/month.` : '',
      a.b_renovation && a.b_renovation !== 'no' && a.b_renovation !== 'unknown' ? `Building renovation: ${lc(lab('b_renovation', a.b_renovation))}.` : '',
      a.b_tama && a.b_tama !== 'none' && a.b_tama !== 'unknown' ? `Urban renewal: ${lab('b_tama', a.b_tama)}${a.b_tama_detail ? ` (${a.b_tama_detail})` : ''}.` : '',
    ])
  }
  {
    const m = a.l_matrix || {}
    const yes = k => m[k] === 'yes'
    const unk = visibleRows(S('l_matrix') || { rows: [] }, a).filter(r => m[r.k] === 'unknown').map(r => lc(L(r, 'en')))
    add('Legal and planning', [
      a.l_owners ? `Rights are registered in the name of ${a.l_owners}${a.l_rights ? ` (${lab('l_rights', a.l_rights)})` : ''}.` : '',
      a.l_more_owners === 'yes' ? `Additional owners: ${a.l_more_owners_detail || 'to be provided'}.` : '',
      a.l_agree ? `Consent to ${rental ? 'rent out' : 'sell'}: ${lc(lab('l_agree', a.l_agree))}.` : '',
      a.l_inherit && a.l_inherit !== 'no' ? `Inherited property: ${lc(lab('l_inherit', a.l_inherit))}.` : '',
      yes('mortgage') ? `There is a mortgage${a.l_mortgage ? ` with about ${ils(a.l_mortgage)} remaining` : ''}.` : '',
      yes('liens') || yes('legalProc') ? `${yes('liens') ? 'There are liens or attachments' : 'There is a legal proceeding'}${a.l_issues_detail ? `: ${a.l_issues_detail}` : ''}.` : '',
      yes('violation') ? 'There is a known building violation.' : '', yes('permit') ? 'There is a building permit.' : '', yes('extraRights') ? 'There are unused building rights.' : '',
      unk.length ? `To verify against the Tabu extract: ${list(unk)}.` : '',
      a.l_area_plans === 'yes' ? `Plans in the area: ${a.l_area_plans_detail || 'yes'}.` : '',
      a.l_notes ? `Notes: ${a.l_notes}.` : '',
    ])
  }
  {
    const bo = a.d_best_offer || {}, dl = a.d_deadline || {}
    if (rental) add('The rental and expectations', [
      a.d_ask ? `The requested rent is ${ils(a.d_ask)} per month${a.d_flex ? ` (${lc(lab('d_flex', a.d_flex))})` : ''}.` : '',
      a.d_min ? `Minimum rent the owners would consider: ${ils(a.d_min)} (internal).` : '',
      a.d_timeline ? `Availability: ${lc(lab('d_timeline', a.d_timeline))}.` : '', a.r_term ? `Lease term: ${lc(lab('r_term', a.r_term))}.` : '',
      labs('r_guarantees').length ? `Guarantees: ${lc(list(labs('r_guarantees')))}.` : '', labs('r_included').length ? `Included in the rent: ${lc(list(labs('r_included')))}.` : '',
      a.r_pets ? `Pets: ${lc(lab('r_pets', a.r_pets))}.` : '',
      a.d_published ? `Listed before: ${lc(lab('d_published', a.d_published))}.` : '', a.d_brokers ? `Other agents: ${lc(lab('d_brokers', a.d_brokers))}.` : '',
      a.d_buyer ? `Tenant preferences: ${a.d_buyer}.` : '', a.d_notes ? `Also important: ${a.d_notes}.` : '',
    ])
    else add('The sale and expectations', [
      a.d_ask ? `The asking price is ${ils(a.d_ask)}${a.d_flex ? ` (${lc(lab('d_flex', a.d_flex))})` : ''}.` : '',
      a.d_expected ? `The owners realistically expect about ${ils(a.d_expected)}.` : '', a.d_min ? `Minimum they would consider: ${ils(a.d_min)} (internal).` : '',
      a.d_offers_received === 'yes' && bo.amount ? `The highest offer so far was ${ils(bo.amount)}${bo.when ? ` (${bo.when})` : ''}${bo.notes ? `, ${bo.notes}` : ''}.` : a.d_offers_received === 'no' ? 'No offers have been received yet.' : '',
      a.d_timeline ? `Timing: ${lc(lab('d_timeline', a.d_timeline))}${dl.date ? `, deadline ${dl.date}` : ''}${dl.reason ? ` (${dl.reason})` : ''}.` : '',
      a.d_vacate ? `Handover: ${lc(lab('d_vacate', a.d_vacate))}${labs('d_vacate_flex').length ? ` (${lc(list(labs('d_vacate_flex')))})` : ''}.` : '',
      a.d_alt && a.d_alt !== 'no' ? `Buying another property: ${lc(lab('d_alt', a.d_alt))}.` : '', a.d_why && a.d_why !== 'private' ? `Reason for selling: ${lc(lab('d_why', a.d_why))}.` : '',
      a.d_published ? `Listed before: ${lc(lab('d_published', a.d_published))}.` : '', a.d_brokers ? `Other agents: ${lc(lab('d_brokers', a.d_brokers))}.` : '',
      a.d_published_detail ? `Marketing so far: ${a.d_published_detail}.` : '', a.d_offers ? `Offers: ${lc(lab('d_offers', a.d_offers))}.` : '',
      a.d_buyer ? `Buyer / terms preferences: ${a.d_buyer}.` : '', a.d_notes ? `Also important: ${a.d_notes}.` : '',
    ])
  }
  add('The marketing angle', [
    a.m_pros ? `According to the owners, the biggest advantage is ${String(a.m_pros).trim().replace(/\.$/, '')}.` : '',
    a.m_unique ? `What sets it apart: ${String(a.m_unique).trim().replace(/\.$/, '')}.` : '',
    a.m_love ? `The owners love most: ${String(a.m_love).trim().replace(/\.$/, '')}.` : '',
    labs('m_nearby').length ? `Within walking distance: ${lc(list(labs('m_nearby')))}.` : '', labs('m_fit').length ? `Ideal for ${lc(list(labs('m_fit')))}.` : '',
    a.m_story ? `Worth emphasising: ${String(a.m_story).trim().replace(/\.$/, '')}.` : '', a.m_hide ? `Keep out of the listing: ${String(a.m_hide).trim().replace(/\.$/, '')}.` : '', a.m_extra ? `Also: ${String(a.m_extra).trim().replace(/\.$/, '')}.` : '',
  ])
  {
    const cnt = id => (Array.isArray(a[id]) ? a[id].filter(f => !f.status || f.status === 'done').length : 0)
    const files = [[cnt('u_photos'), 'photos'], [cnt('u_videos'), 'videos'], [cnt('u_plan'), 'floor plan files'], [cnt('u_docs'), 'documents']].filter(x => x[0]).map(x => `${x[0]} ${x[1]}`)
    const priv = a.c_privacy || {}
    add('Materials and contact', [
      files.length ? `Materials received: ${list(files)}.` : 'No photos or documents were attached yet.',
      a.c_name ? `Contact: ${a.c_name}${a.c_role ? ` (${lc(lab('c_role', a.c_role))})` : ''}${a.c_phone ? `, ${a.c_phone}` : ''}${a.c_email ? `, ${a.c_email}` : ''}.` : '',
      a.c_extra?.name ? `Additional contact: ${a.c_extra.name}${a.c_extra.phone ? `, ${a.c_extra.phone}` : ''}${a.c_extra.relation ? ` (${a.c_extra.relation})` : ''}.` : '',
      `${priv.publishPhone ? 'The phone number may be published' : 'The phone number stays private'}, and ${priv.showAddress ? 'the exact address may be shown' : 'the exact address stays private'}.`,
    ])
  }
  return paras
}
