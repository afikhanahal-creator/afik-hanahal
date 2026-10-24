// First names written in English → Hebrew, for the Hebrew WhatsApp messages ("שלום Ronen" → "שלום רונן").
// Meta forms give whatever the person typed, often a Hebrew name in Latin letters. Only names on this list are
// converted: a guessed transliteration of an unknown name is worse than no name, so the caller drops it instead.
const NAMES = `
aaron|אהרון aharon|אהרון adi|עדי adir|אדיר adva|אדוה ahuva|אהובה alon|אלון alona|אלונה amir|אמיר amit|עמית amnon|אמנון amos|עמוס
anat|ענת avi|אבי avital|אביטל aviv|אביב aviva|אביבה avner|אבנר avraham|אברהם avishay|אבישי ayala|איילה ayelet|איילת
bar|בר barak|ברק batya|בתיה ben|בן benny|בני beni|בני binyamin|בנימין boaz|בועז
chaim|חיים haim|חיים chana|חנה hana|חנה hanna|חנה chen|חן hen|חן dafna|דפנה dalia|דליה dan|דן dana|דנה danny|דני dani|דני daniel|דניאל daniela|דניאלה
david|דוד dvir|דביר dina|דינה dor|דור doron|דורון dorit|דורית dotan|דותן dov|דב dudi|דודי eden|עדן efrat|אפרת ehud|אהוד eitan|איתן etan|איתן
elad|אלעד eli|אלי eliana|אליאנה elior|אליאור eliran|אלירן elisheva|אלישבע einat|עינת enat|עינת erez|ארז ester|אסתר esther|אסתר eti|אתי
eyal|אייל ezra|עזרא gabi|גבי gad|גד gal|גל gali|גלי galit|גלית gil|גיל gila|גילה gilad|גלעד gili|גילי guy|גיא gai|גיא hadar|הדר hadas|הדס
hagit|חגית hila|הילה hilla|הילה ido|עידו idan|עידן ilan|אילן ilana|אילנה inbal|ענבל inbar|ענבר irit|עירית iris|איריס itai|איתי itay|איתי
itamar|איתמר itzik|איציק izhak|יצחק yitzhak|יצחק kobi|קובי koby|קובי kfir|כפיר keren|קרן lea|לאה leah|לאה liat|ליאת lior|ליאור
liron|לירון limor|לימור lital|ליטל lihi|ליהי liora|ליאורה maayan|מעיין maya|מאיה matan|מתן meir|מאיר meital|מיטל michal|מיכל
michael|מיכאל miki|מיקי miri|מירי miriam|מרים moran|מורן mor|מור moshe|משה moti|מוטי nadav|נדב naama|נעמה naomi|נעמי natan|נתן
nathan|נתן nati|נתי neta|נטע netanel|נתנאל nir|ניר nirit|נירית nitzan|ניצן noa|נועה noam|נועם nofar|נופר ofer|עופר ofir|אופיר
ofra|עפרה omer|עומר omri|עמרי ophir|אופיר or|אור ori|אורי orit|אורית orly|אורלי orli|אורלי oren|אורן osnat|אסנת oz|עוז
pnina|פנינה rachel|רחל rahel|רחל rafi|רפי rami|רמי ran|רן rina|רינה rivka|רבקה roi|רועי roee|רועי rotem|רותם ronen|רונן roni|רוני ronit|רונית
rony|רוני ruth|רות rut|רות sagi|שגיא sagit|שגית sapir|ספיר sara|שרה sarah|שרה shachar|שחר shahar|שחר shai|שי shay|שי shaked|שקד
shani|שני sharon|שרון shimon|שמעון shira|שירה shiri|שירי shirley|שירלי shlomi|שלומי shlomo|שלמה shmuel|שמואל shoshana|שושנה
shula|שולה sigal|סיגל sivan|סיון smadar|סמדר tal|טל tali|טלי talia|טליה tamar|תמר tami|תמי tomer|תומר tzvi|צבי zvi|צבי uri|אורי
vered|ורד yael|יעל yaakov|יעקב yakov|יעקב yair|יאיר yaron|ירון yehuda|יהודה yehudit|יהודית yigal|יגאל yoav|יואב yoel|יואל yogev|יוגב
yonatan|יונתן jonathan|יונתן yossi|יוסי yosi|יוסי yosef|יוסף yoni|יוני yuval|יובל zehava|זהבה ziv|זיו zohar|זוהר orna|אורנה ariel|אריאל
arie|אריה arieh|אריה aryeh|אריה asaf|אסף assaf|אסף avihai|אביחי avigail|אביגיל avishag|אבישג benjamin|בנימין boris|בוריס
alex|אלכס alexander|אלכסנדר anna|אנה dima|דימה dmitry|דמיטרי elena|אלנה igor|איגור irina|אירינה katya|קטיה marina|מרינה maxim|מקסים
max|מקס michelle|מישל natalie|נטלי natali|נטלי olga|אולגה sasha|סשה sergey|סרגיי svetlana|סבטלנה tatiana|טטיאנה vadim|ודים victor|ויקטור
vladimir|ולדימיר yulia|יוליה eugene|יבגני evgeny|יבגני kate|קייט mark|מארק marc|מארק eric|אריק erik|אריק ilya|איליה lena|לנה
liza|ליזה masha|מאשה nadia|נדיה nina|נינה oleg|אולג roman|רומן stas|סטס vera|ורה yana|יאנה zhenya|ז'ניה kirill|קיריל artem|ארטיום
sapir|ספיר stav|סתיו shoval|שובל yarden|ירדן yam|ים agam|אגם ella|אלה ela|אלה elia|אליה elya|אליה romi|רומי roy|רועי yuli|יולי
lia|ליה liel|ליאל nofar|נופר hodaya|הודיה hadassa|הדסה reut|רעות rut|רות moriah|מוריה moria|מוריה chaya|חיה haya|חיה
yehonatan|יהונתן elazar|אלעזר eliezer|אליעזר meni|מני menachem|מנחם nachum|נחום nissim|ניסים nisim|ניסים rafael|רפאל refael|רפאל
yehoshua|יהושע shalom|שלום shaul|שאול tzachi|צחי zachi|צחי tzion|ציון zion|ציון yaniv|יניב yonit|יונית osher|אושר oshrat|אושרת
herzl|הרצל hertzel|הרצל tsahi|צחי avraham|אברהם albert|אלברט jacob|ג'ייקוב james|ג'יימס john|ג'ון joseph|ג'וזף josef|יוסף
mike|מייק paul|פול peter|פיטר robert|רוברט sam|סאם sami|סמי samuel|שמואל sharon|שרון shelly|שלי shelley|שלי sheli|שלי
naama|נעמה neomi|נעמי noga|נגה nogah|נגה adam|אדם adar|אדר aviad|אביעד avidan|אבידן elinor|אלינור eliya|אליה gavriel|גבריאל
`.trim().split(/\s+/).reduce((m, pair) => { const [en, he] = pair.split('|'); if (en && he) m.set(en, he); return m }, new Map())

const LATIN = /^[a-z][a-z'’-]*$/i

/** "Ronen" / "RONEN" / "ronen" → "רונן"; '' when the word isn't Latin or isn't a known name */
export function hebrewFirstName(word) {
  const w = String(word || '').trim().toLowerCase().replace(/[’]/g, "'")
  if (!w || !LATIN.test(w)) return ''
  return NAMES.get(w) || NAMES.get(w.replace(/-/g, '')) || ''
}
export const isLatinName = s => /[a-z]/i.test(String(s || '')) && !/[֐-׿]/.test(String(s || ''))

// ── Full names in standard Hebrew (the lead lists, the Lead Center, the CRM) ─────────────────────────────────────────
// A lead who typed "Daniel cohen" is shown as "דניאל כהן"; the name as typed stays in the form answers / originalName and
// English messages keep using it. Known first names (above), known surnames (below) and, for any other word, a careful
// letter-by-letter transliteration. Junk (emails, digits, symbols) is dropped; a name with nothing left keeps its text.
const MORE_FIRST = `
abed|עבד abyah|אביה ada|עדה ahed|עהד ana|אנה andrew|אנדרו arnon|ארנון avshalom|אבשלום ayob|איוב ayoub|איוב batchen|בתחן
bella|בלה bracha|ברכה dedi|דדי dolev|דולב don|דון emri|אמרי eran|ערן frank|פרנק gabby|גבי gaby|גבי ganit|גנית geula|גאולה
hemi|חמי hod|הוד hofit|הופית iftach|יפתח ivgeni|יבגני kety|קטי kholod|חולוד laurent|לורן lihen|ליחן liliya|ליליה lilia|ליליה
mimi|מימי nisan|ניסן noi|נוי oceane|אושן oded|עודד ofek|אופק ovi|אובי ram|רם ravid|רביד ray|ריי riki|ריקי ricky|ריקי rinat|רינת
robi|רובי rudy|רודי sahar|סהר salomon|סלומון shimi|שימי shiran|שירן shlomit|שלומית si|סי tamir|תמיר tom|תום tommy|טומי
yafit|יפית yahia|יחיא yahya|יחיא zac|זאק zack|זאק zehavit|זהבית zipi|ציפי tzipi|ציפי zvika|צביקה tzvika|צביקה ron|רון
chen|חן yehezkel|יחזקאל elimelech|אלימלך raphael|רפאל aviv|אביב liat|ליאת mazal|מזל orly|אורלי sigalit|סיגלית
`
const SURNAMES = `
syam|סיאם abo|אבו abu|אבו takrouri|תכרורי levi|לוי levy|לוי shaked|שקד weissman|ויסמן weisman|ויסמן aharon|אהרון alush|אלוש
peer|פאר lipszic|ליפשיץ lipschitz|ליפשיץ amiel|עמיאל ojalvo|אוחלבו rozensten|רוזנשטיין rosenstein|רוזנשטיין zucker|צוקר
taglicht|טגליכט livnat|לבנת shahab|שהאב dayan|דיין dadon|דדון mter|מטר dagan|דגן kondorla|קונדורלה georges|ז'ורז'
benayoun|בניון vardi|ורדי israeli|ישראלי tobias|טוביאס nir|ניר cohen|כהן kohen|כהן gal|גל morein|מורין bar|בר eldar|אלדר
remax|רימקס katz|כץ rabin|רבין weiner|ויינר licht|ליכט barchat|ברכט elyashiv|אלישיב balak|בלק zimerman|צימרמן
zimmerman|צימרמן akerman|אקרמן ackerman|אקרמן siboni|סיבוני klefner|קלפנר barashi|ברשי hasan|חסן dyment|דימנט monblat|מונבלט
oz|עוז portugali|פורטוגלי tamam|תמם naor|נאור barack|ברק givoly|גבעולי textile|טקסטיל karadi|קרדי barazi|ברזי pecker|פקר
levavi|לבבי balaly|בללי pundak|פונדק enav|ענב hason|חסון kucherov|קוצ'רוב halevy|הלוי halevi|הלוי nofar|נופר tsuri|צורי
awad|עוואד polturak|פולטורק saban|סבן haddad|חדד hadad|חדד berkovich|ברקוביץ' berkovitz|ברקוביץ soniya|סוניה shahrabani|שהרבני
gargir|גרגיר rips|ריפס danon|דנון jo|ג'ו arazi|ארזי nachmany|נחמני nachmani|נחמני elazar|אלעזר haviv|חביב shamsheyan|שמשיאן
stern|שטרן shulman|שולמן shir|שיר hakim|חכים hanochi|חנוכי dahan|דהן har|הר zion|ציון numa|נומה hamo|חמו elfassi|אלפסי
kaplan|קפלן suissa|סויסה swisa|סויסה zveda|זבדה nurieli|נוריאלי sharvit|שרביט collins|קולינס porat|פורת elbaz|אלבז kimhi|קמחי
falach|פלח kirshenbaum|קירשנבאום manoel|מנואל ovadia|עובדיה passal|פסל schupak|שופק metodi|מטודי vaknin|וקנין sasi|ששי
sasson|ששון gabsi|גבסי nof|נוף zaken|זקן daskal|דסקל gilran|גילרן nuriel|נוריאל botbol|בוטבול beyth|בית gera|גרא
shtruzer|שטרוזר gingold|גינגולד ashkenazi|אשכנזי hazut|חזות amihai|עמיחי spiegelman|שפיגלמן kaneti|קנטי zrihen|זריהן
fahima|פחימה pinto|פינטו bavli|בבלי machluf|מכלוף hill|היל pauer|פאואר brand|ברנד gutkin|גוטקין ballas|בלס arad|ערד
tadmor|תדמור rivkind|ריבקינד moqbel|מוקבל drucker|דרוקר shpringer|שפרינגר springer|שפרינגר cake|קייק gabel|גבל eliezer|אליעזר
berenson|ברנסון mizrahi|מזרחי peretz|פרץ biton|ביטון friedman|פרידמן shapira|שפירא malka|מלכה azulay|אזולאי azoulay|אזולאי
ohayon|אוחיון amar|עמר gabay|גבאי ochana|אוחנה golan|גולן sabag|סבג edri|אדרי levin|לוין klein|קליין rosenberg|רוזנברג
goldberg|גולדברג elkayam|אלקיים weiss|וייס kaufman|קאופמן shemesh|שמש segal|סגל abutbul|אבוטבול attias|אטיאס benisty|בניסטי
nahum|נחום shitrit|שטרית hazan|חזן elmaliah|אלמליח asulin|אסולין tzur|צור zur|צור barkan|ברקן halabi|חלבי sharabi|שרעבי
zilberman|זילברמן rubin|רובין horowitz|הורוביץ greenberg|גרינברג schwartz|שוורץ gross|גרוס lavi|לביא navon|נבון carmi|כרמי
carmel|כרמל shalev|שלו raz|רז dror|דרור gilboa|גלבוע eshel|אשל paz|פז sela|סלע toledano|טולדנו revach|רווח elias|אליאס
hayun|חיון turgeman|תורג'מן ifrah|יפרח moyal|מויאל gozlan|גוזלן sabah|סבח haimov|חיימוב aharonov|אהרונוב ivanov|איבנוב
petrov|פטרוב kogan|קוגן kagan|כגן rabinovich|רבינוביץ' abramovich|אברמוביץ' lerner|לרנר fischer|פישר fisher|פישר wolf|וולף
bloch|בלוך stein|שטיין rosen|רוזן rozen|רוזן harel|הראל tzadok|צדוק zadok|צדוק malul|מלול avitan|אביטן yosef|יוסף
dahari|דהרי gabbay|גבאי azran|עזרן alfasi|אלפסי ben|בן bat|בת noambar|נועם-בר goldstein|גולדשטיין
`
const parse = s => s.trim().split(/\s+/).reduce((m, pair) => { const [en, he] = pair.split('|'); if (en && he) m.set(en, he); return m }, new Map())
const EXTRA_FIRST = parse(MORE_FIRST), SUR = parse(SURNAMES)
// the other way: a Hebrew first name → its usual English spelling (the first one listed), for English messages
let HE2EN = null
/** "רונן" → "Ronen"; '' when the name isn't on the lists */
export function latinFirstName(word) {
  if (!HE2EN) { HE2EN = new Map(); for (const m of [NAMES, EXTRA_FIRST]) for (const [en, he] of m) if (!HE2EN.has(he)) HE2EN.set(he, en) }
  const en = HE2EN.get(String(word || '').trim())
  return en ? en.replace(/(^|[-'])([a-z])/g, (_, a, b) => a + b.toUpperCase()) : ''
}
const TITLES = { dr: 'ד"ר', prof: "פרופ'", adv: 'עו"ד' }

// Letter-by-letter, for a word no list knows: consonant clusters first, vowels as a Hebrew reader expects them
// (written inside the word as י / ו, "a" / "e" mostly silent, a final "a" as ה), final letter forms at the end.
const FINALS = { כ: 'ך', מ: 'ם', נ: 'ן', פ: 'ף', צ: 'ץ' }
const CLUSTERS = [['stein', 'שטיין'], ['tch', 'צ\''], ['sch', 'ש'], ['tz', 'צ'], ['ts', 'צ'], ['sh', 'ש'], ['ch', 'ח'], ['kh', 'ח'], ['zh', "ז'"], ['th', 'ת'], ['ph', 'פ'],
  ['ck', 'ק'], ['qu', 'קו'], ['oo', 'ו'], ['ou', 'ו'], ['ee', 'י'], ['ie', 'י'], ['ei', 'יי'], ['ey', 'יי'], ['ay', 'יי'], ['ai', 'יי'], ['oi', 'וי'], ['ui', 'וי'],
  ['ll', 'ל'], ['ss', 'ס'], ['tt', 'ט'], ['nn', 'נ'], ['mm', 'מ'], ['rr', 'ר'], ['ff', 'פ'], ['pp', 'פ'], ['bb', 'ב'], ['dd', 'ד'], ['gg', 'ג'], ['zz', 'ז']]
const ONE = { b: 'ב', c: 'ק', d: 'ד', f: 'פ', g: 'ג', h: 'ה', j: "ג'", k: 'ק', l: 'ל', m: 'מ', n: 'נ', p: 'פ', q: 'ק', r: 'ר', s: 'ס', t: 'ט', v: 'ו', w: 'ו', x: 'קס', z: 'ז', i: 'י', o: 'ו', u: 'ו', y: 'י', a: '', e: '' }
export function transliterate(word) {
  const w = String(word || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
  if (!w) return ''
  let out = '', i = 0
  // a word that starts with a vowel starts with א (or ע, which can't be told from the spelling, so א)
  if (/^[aeiou]/.test(w)) { out = w[0] === 'o' || w[0] === 'u' ? 'או' : w[0] === 'i' ? 'אי' : 'א'; i = w.startsWith('ei') || w.startsWith('ey') || w.startsWith('ai') || w.startsWith('ay') ? 2 : 1; if (i === 2) out = 'איי' }
  while (i < w.length) {
    const cl = CLUSTERS.find(([k]) => w.startsWith(k, i))
    if (cl) { out += cl[1]; i += cl[0].length; continue }
    const ch = w[i]
    // "y" before a vowel is a consonant י; "h" at the end after a vowel is silent ("Sarah" → שרה)
    if (ch === 'h' && i === w.length - 1 && /[aeiou]/.test(w[i - 1] || '')) { i++; continue }
    if ((ch === 'a' || ch === 'e') && i === w.length - 1) { out += 'ה'; i++; continue }
    out += ONE[ch] ?? ''; i++
  }
  out = out.replace(/ייי+/g, 'יי').replace(/ווו+/g, 'וו')
  const last = out.slice(-1)
  if (FINALS[last] && out.length > 1) out = out.slice(0, -1) + FINALS[last]
  return out
}

const known = w => NAMES.get(w) || EXTRA_FIRST.get(w) || SUR.get(w) || ''
/** One word (or a hyphenated pair) → Hebrew: a known name, else a transliteration */
export function hebrewWord(word, { firstOnly = false } = {}) {
  const w = String(word || '').toLowerCase().replace(/[’]/g, "'").normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!w) return ''
  if (w.includes('-')) return w.split('-').filter(Boolean).map(p => hebrewWord(p, { firstOnly })).filter(Boolean).join('-')
  const k = w.replace(/[^a-z]/g, '')
  if (!k) return ''
  if (TITLES[k]) return TITLES[k]
  return (firstOnly ? (NAMES.get(k) || EXTRA_FIRST.get(k)) : known(k)) || transliterate(k)
}

/**
 * "Daniel cohen" → "דניאל כהן", "Dr. Michael Elyashiv" → 'ד"ר מיכאל אלישיב', "A R I E L • B E R E N S O N" → "אריאל ברנסון",
 * "Yuval12" → "יובל". A name that already has Hebrew letters, or nothing Latin to work with, comes back as it was.
 * Anything after " · " (a project the office appended) is kept as is.
 */
export function hebrewFullName(name) {
  const raw = String(name ?? '').trim()
  if (!raw || /[֐-׿]/.test(raw.split(' · ')[0])) return raw
  if (/^\S+@\S+$/.test(raw)) return raw                                   // only an email: nothing to translate
  const [head, ...tail] = raw.split(' · ')
  // "Barazi17@alla.com" → "Barazi17" → "Barazi"; digits, underscores and symbols go
  let s = head.replace(/(\S*?)@\S+/g, ' $1 ').replace(/[0-9_]+/g, ' ').replace(/[^\p{L}\s.'’-]+/gu, ' ')
  // letters typed one by one ("A R I E L • B E R E N S O N")
  if (/^(?:\p{L}\s+){3,}\p{L}/u.test(s.trim())) s = s.replace(/(\p{L})\s(?=\p{L}(\s|$))/gu, '$1')
  // a camel-cased pair typed as one word ("DonWeiner")
  s = s.replace(/([a-z])([A-Z])/g, '$1 $2')
  const words = s.split(/\s+/).map(x => x.replace(/^[.'’-]+|[.'’-]+$/g, '')).filter(x => /[a-z]/i.test(x))
  if (!words.length || !/^[\p{Script=Latin}\s.'’-]+$/u.test(words.join(' '))) return raw
  // not a name at all ("v and something liked", "hz", a test entry): leave it for a person to fix
  if (words.some(w => /^(and|the|of|something|test|dummy|lead|data|null|undefined|asdf|qwerty)$/i.test(w))) return raw
  if (words.every(w => w.replace(/[^a-z]/gi, '').length <= 2 && !known(w.toLowerCase().replace(/[^a-z]/g, '')))) return raw
  const he = words.map(w => hebrewWord(w)).filter(Boolean).join(' ')
  return he ? [he, ...tail].join(' · ') : raw
}
