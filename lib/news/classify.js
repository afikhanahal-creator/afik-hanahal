// Shared real-estate classifier for the news pipeline.
// Used by: api/cron/warm.js (ingest), api/cron/rotate.js (featured picks),
//          api/news.js + api/news/archive.js (serving), vite.config.js (dev),
//          src/App.jsx (client-side last line of defence).
//
// Design: a title is real-estate if it contains an UNAMBIGUOUS real-estate term
// (נדל"ן, משכנתא, פינוי-בינוי, ...). Terms that also appear in crime / sport /
// politics / décor headlines (דירה, קרקע, מגרש, נכס, בניין ...) only count when
// no VETO term is present and there is corroborating context.
// No lookbehind — Safari < 16.4 would throw on parse and take the whole bundle down.

const HE = 'א-ת'
const PFX = '[ובלמשכה]{0,3}'            // Hebrew proclitics: ו ה ב ל מ ש כ (and stacks like "וכש", "ומה")
const B   = `(?:^|[^${HE}])`             // Hebrew "word start"
const E   = `(?![${HE}])`                // Hebrew "word end"

// Compile a list of pattern fragments into one alternation with Hebrew word boundaries.
// `bare: true` fragments match anywhere (multi-word phrases, terms with quotes).
function compile(list) {
  const parts = list.map(p => typeof p === 'string' ? `${B}${PFX}(?:${p})${E}` : `(?:${p.bare})`)
  return new RegExp(parts.join('|'), 'i')
}
const bare = s => ({ bare: s })

// ── Unambiguous: any single hit ⇒ real estate ─────────────────────────────────
const CLEAR = compile([
  bare('נדל"?ן'),                                   // נדל"ן / נדלן / הנדלן / נדלנית
  'משכנת(?:א|אות|ה)?', bare('משכנתא'),
  'מקרקעין',
  'טאבו',
  bare('פינוי[ -]?בינוי'),
  bare('התחדשות ?עירונית'),
  bare('תמ"א'), bare('תמא ?38'),
  bare('מחיר ?למשתכן'), bare('דירה ?בהנחה'), bare('מחיר ?מטרה'), bare('מחיר ?מופחת'),
  bare('שוק ?הדיור'), bare('משבר ?הדיור'), bare('מחירי ?ה?דיר(?:ות|ה)'), bare('מדד ?מחירי'),
  bare('שכר ?ה?דירה'), bare('שכ"ד'), bare('דמי ?שכירות'), bare('חוזה ?שכירות'), bare('שכירות ?ארוכת'),
  bare('מס ?רכישה'), bare('מס ?שבח'), bare('היטל ?השבחה'), bare('מס ?דירה ?שלישית'), bare('ריבוי ?דירות'),
  bare('רמ"י'), bare('רשות ?מקרקעי'), bare('מי?נהל ?מקרקעי'),
  bare('תב"ע'), bare('ת?ו?כנית ?ה?מתאר'), bare('ועד[הת] ?ה?(?:מקומית|מחוזית|תכנון)'), bare('ותמ"ל'), bare('הוועדה ?המחוזית'),
  bare('יח"ד'), bare('יחיד(?:ות|ת) ?דיור'),
  bare('התחלות ?ה?בני(?:י)?ה'), bare('גמר ?ה?בני(?:י)?ה'), bare('היתרי? ?ה?בני(?:י)?ה'), bare('זכויות ?ה?בני(?:י)?ה'), bare('בני(?:י)?ה ?רוויה'),
  'דיור', bare('דיור ?(?:ציבורי|בר ?השגה|מוגן|להשכרה)'), bare('משפרי ?דיור'),
  bare('בינוי ?ו?ה?שיכון'), bare('משרד ?השיכון'),
  bare('צמוד(?:ת|י|ות)? ?קרקע'), 'פנטהאוז', 'פנטהאוס', 'דופלקס', bare('קוטג'), 'וילה', 'וילות',
  bare('רוכשי ?ה?דיר(?:ות|ה)'), bare('קוני ?ה?דירות'), bare('משקיעי ?ה?דירות'),
  bare('פרויקט ?ה?מגורים'), bare('שכונת ?מגורים'), bare('דירות ?מגורים'),
  bare('נכסי?ם? ?מניב'), 'מניב', 'מניבים',
  bare('שוק ?המשרדים'), bare('בנייני ?משרדים'), bare('מגדל ?משרדים'), bare('שטחי ?מסחר'), bare('מרכז ?מסחרי'), bare('פארק ?לוגיסטי'), bare('מחסנים ?לוגיסטיים'),
  bare('כו?נ(?:ס|וס) ?נכסים'),
  bare('בית ?משותף'), bare('ועד ?ה?בית'),
  bare('מ"ר'), bare('מטר ?רבוע'), bare('מטרים ?רבועים'),
  bare('גוש ?ו?חלקה'), bare('חלקה ?\\d'),
  bare('קבוצת ?רכישה'),
  bare('הגרלת ?ה?דירות'), bare('הגרלת ?מחיר'),
  bare('עסק(?:ת|אות) ?ה?(?:נדל|דירות|קרקע|מקרקעין)'),
  bare('דירות? ?(?:יד ?שנייה|חדשות|להשקעה|מקבלן)'),
  bare('בנק ?ישראל[^.]{0,40}(?:משכנת|דיור|דירות)'),
  bare('חברות? ?ה?(?:בנייה|בניה|נדל)'),
  bare('יזמי? ?ה?(?:נדל|בנייה|בניה)'),
  bare('מתחם[^.]{0,30}(?:מגורים|דירות|יח"ד)'),
  bare('שכונה ?חדשה'),
])

// ── Ambiguous: real-estate words that also live in crime/sport/politics/décor ─
const AMBIG = compile([
  'דיר(?:ה|ות|ת)', 'דירתו', 'דירתה', 'דירתם',
  'קרקע', 'קרקעות', 'מגרש', 'מגרשים',
  'נכס', 'נכסים',
  'דייר', 'דיירים', 'דיירי',
  'בניין', 'בנין', 'בניינים', 'בניינ[יה]', 'בנייה', 'בניה',
  'קבלן', 'קבלנים', 'קבלני',
  'שכירות', 'שוכר', 'שוכרים', 'שוכרת', 'משכיר', 'משכירים',
  'מתווך', 'מתווכים', 'תיווך',
  'למכירה', 'להשכרה',
  'חדרים',
  'מגורים', 'למגורים',
  'בית', 'בתים',
])

// ── Weak corroboration ────────────────────────────────────────────────────────
const WEAK = compile([
  'פרויקט', 'פרויקטים', 'שכונה', 'שכונות', 'שכונת', 'עירייה', 'עיריית', 'תכנון', 'תוכנית', 'תכנית', 'היתר', 'היתרים',
  'ריבית', 'מחיר', 'מחירים', 'מחירי', 'השקעה', 'השקעות', 'משקיעים', 'קומה', 'קומות', 'מגדל', 'מגדלים',
  'נמכר', 'נמכרה', 'נמכרו', 'נרכש', 'נרכשה', 'רכש', 'רכשה', 'מכר', 'מכרה', 'עסקה', 'עסקאות', 'מיליון', 'שקל', 'שקלים',
  'תשואה', 'אדריכל', 'אדריכלות', 'עיר', 'ערים', 'מועצה', 'משפרים', 'צעירים', 'רוכשים', 'רוכש',
  bare('₪'), bare('ש"ח'), bare('הלמ"ס'), bare('בנק ?ישראל'), bare('רשות ?המסים'), bare('רשות ?המיסים'),
  'הרצליה', 'רעננה', 'נתניה', 'חדרה', 'כפר סבא', 'הוד השרון', 'רמת השרון', 'תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'פתח תקווה', 'ראשון לציון', 'מודיעין', 'אשדוד', 'אשקלון',
])

// ── Veto: blocks AMBIG-only matches (never overrides CLEAR) ───────────────────
const VETO = compile([
  // security / war / politics
  'חמאס', 'חיזבאללה', 'חזבאללה', 'איראן', 'איראני', 'טיל', 'טילים', 'רקטה', 'רקטות', 'פיגוע', 'מחבל', 'מחבלים', 'מילואים', 'חטופים', 'חטוף',
  bare('צה"ל'), bare('כוחות ?ה?קרקע'), 'לחימה', 'מלחמה', 'מבצע', 'עזה', 'לבנון', 'סוריה', 'תימן', bare("חות'ים"), bare('שב"כ'), 'מוסד', bare('כטב"ם'),
  'בחירות', 'קואליציה', 'אופוזיציה', 'הכנסת', 'הפגנה', 'הפגנות', 'מפגינים',
  // crime / accidents
  'משטרה', 'שוטרים', 'נעצר', 'נעצרו', 'עצור', 'נרצח', 'נרצחה', 'רצח', 'נאשם', 'נאשמת', bare('כתב ?אישום'), 'חשוד', 'חשודים', 'חקירה', 'הונאה',
  'שריפה', 'שרפה', 'תאונה', 'נפגע', 'נפגעו', 'פצוע', 'פצועים', 'הרוג', 'הרוגים', 'נהרג', 'נהרגה', 'גופה', 'גופת', 'נמצא ?מת', 'נמצאה ?מתה', 'התאבד',
  'אלימות', 'תקיפה', 'אונס', 'סמים', 'פשע', 'עבריין', 'עבריינים',
  // sport
  'כדורגל', 'כדורסל', 'ליגה', 'ליגת', 'מכבי', 'הפועל', bare('בית"ר'), 'שחקן', 'שחקנים', 'מאמן', 'משחק', 'משחקים', 'אליפות', 'גביע', 'אולימפי',
  // tech / cars / consumer
  'רכב', 'מכונית', 'מכוניות', 'טסלה', 'אייפון', 'סמארטפון', 'אפליקציה', 'הייטק', 'סטארטאפ', 'אקזיט', 'ביטקוין', 'קריפטו', 'בינה ?מלאכותית',
  // entertainment / lifestyle / décor
  'סדרה', 'נטפליקס', 'סרט', 'פרק', 'מסעדה', 'מסעדות', 'מתכון', 'שף', 'זמר', 'זמרת', 'שחקנית', 'סלב', 'סלבס', bare('האח ?הגדול'), 'ריאליטי',
  'עיצוב', 'מעצב', 'מעצבת', 'ריהוט', 'רהיטים', 'מטבח', 'מטבחים', 'סלון', 'אופנה', 'טרנד', 'טרנדים', 'טיפים', 'טיפ', 'השראה',
  // health
  'רופא', 'רופאים', 'חולים', 'בית ?חולים', 'קורונה', 'מחלה', 'תרופה',
])

// ── Hard block: never show, even with CLEAR terms (advertorials / junk) ────────
const HARD_BLOCK = /תוכן ?שיווקי|ממומן|פרסומת|בשיתוף ?עם|מקודם|תוכן ?מקודם|קופונים?|הנחות ?ל(?:קוראים|חברי)/i

const HE_RE = /[א-ת]/

// Normalise Hebrew quote variants so נדל״ן / נדל"ן / נדל''ן all compare equal.
export function normalizeHebrew(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;|&#34;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/[״“”‟]/g, '"').replace(/[׳’‘‛`]/g, "'")
    .replace(/(\S)'(\S)/g, (m, a, b) => /[א-ת]/.test(a) && /[א-ת]/.test(b) ? `${a}"${b}` : m) // נדל'ן → נדל"ן
    .replace(/\s+/g, ' ').trim()
}

function count(re, text) {
  const g = new RegExp(re.source, 'gi')
  return (text.match(g) || []).length
}

/**
 * Score a headline (+ optional description) for real-estate relevance.
 * Returns { ok, reason, clear, ambig, weak, veto } — `reason` is for logs.
 * @param {string} title
 * @param {string} [desc]   RSS description / subtitle (HTML allowed)
 * @param {object} [opts]
 * @param {boolean} [opts.trusted]  feed is a dedicated real-estate section — relax corroboration
 */
export function scoreRealEstate(title, desc = '', opts = {}) {
  const t = normalizeHebrew(title)
  const d = normalizeHebrew(desc).slice(0, 400)
  if (!t || t.length < 12)   return { ok: false, reason: 'short' }
  if (!HE_RE.test(t))         return { ok: false, reason: 'not-hebrew' }
  if (HARD_BLOCK.test(t))     return { ok: false, reason: 'advertorial' }

  const clearT = count(CLEAR, t), clearD = count(CLEAR, d)
  const ambigT = count(AMBIG, t), ambigD = count(AMBIG, d)
  const weak   = count(WEAK, t) + count(WEAK, d)
  const veto   = count(VETO, t) + count(VETO, d)
  const base   = { clear: clearT + clearD, ambig: ambigT + ambigD, weak, veto }

  if (clearT > 0)             return { ok: true,  reason: 'clear-title', ...base }
  if (veto > 0)               return { ok: false, reason: 'veto', ...base }
  if (clearD > 0)             return { ok: true,  reason: 'clear-desc', ...base }
  if (ambigT > 0) {
    if (opts.trusted)         return { ok: true,  reason: 'ambig-trusted', ...base }
    if (ambigT + ambigD >= 2) return { ok: true,  reason: 'ambig-x2', ...base }
    if (weak >= 1)            return { ok: true,  reason: 'ambig+weak', ...base }
  }
  return { ok: false, reason: 'no-signal', ...base }
}

export function isRealEstate(title, desc = '', opts = {}) {
  return scoreRealEstate(title, desc, opts).ok
}

// Article-object convenience — accepts the shapes produced by the API, Supabase rows, and RSS parsing.
export function isRealEstateArticle(a, opts = {}) {
  if (!a) return false
  return isRealEstate(a.title, a.desc || a.description || '', opts)
}

export function isHebrew(text) { return HE_RE.test(String(text || '')) }
