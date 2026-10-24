// English messages never carry Hebrew words. The values a template fills in — the project (a Meta campaign named after its
// street, "זרובבל 15"), what the lead looks for (form answers typed in Hebrew: "3 חדרים", "5 מיליון ומעלה", "פנטהאוז"), the
// town, the lead's name — are written in English here; whatever can't be (an unknown Hebrew word) comes back '' so the
// template leaves that part out instead of mixing languages. Pure, tested (lib/english-values.test.mjs).
import { latinFirstName } from './hebrew-names.js'

const HE = /[֐-׿]/
export const hasHebrew = s => HE.test(String(s || ''))

// streets of the office's projects and the Sharon's main streets (add a project's street here when a new campaign starts)
const STREETS = {
  'זרובבל': 'Zerubavel', 'הנרייטה סאלד': 'Henrietta Szold', 'סאלד': 'Szold', 'חנקין': 'Hankin', 'הרצל': 'Herzl', 'ויצמן': 'Weizmann',
  'סוקולוב': 'Sokolov', 'ז\'בוטינסקי': 'Jabotinsky', 'בן גוריון': 'Ben Gurion', 'רוטשילד': 'Rothschild', 'אחוזה': 'Ahuza',
  'הבנים': 'HaBanim', 'הגפן': 'HaGefen', 'הדר': 'Hadar', 'דרך רמתיים': 'Derech Ramatayim', 'רמתיים': 'Ramatayim', 'גולדה מאיר': 'Golda Meir',
  'ירושלים': 'Yerushalayim', 'העצמאות': 'HaAtzmaut', 'הנשיאים': 'HaNesi\'im', 'ביאליק': 'Bialik', 'אוסישקין': 'Ussishkin',
  'קפלן': 'Kaplan', 'ארלוזורוב': 'Arlozorov', 'טשרניחובסקי': 'Tchernichovsky', 'אחד העם': 'Ahad Ha\'am', 'בורוכוב': 'Borochov',
  'מצדה': 'Masada', 'השרון': 'HaSharon', 'הנביאים': 'HaNevi\'im', 'התקומה': 'HaTkuma', 'יהודה הלוי': 'Yehuda Halevi',
}
// towns (the Sharon first)
const TOWNS = {
  'הוד השרון': 'Hod Hasharon', 'כפר סבא': 'Kfar Saba', 'רעננה': 'Ra\'anana', 'הרצליה': 'Herzliya', 'נתניה': 'Netanya',
  'רמת השרון': 'Ramat Hasharon', 'אבן יהודה': 'Even Yehuda', 'קדימה צורן': 'Kadima-Zoran', 'קדימה-צורן': 'Kadima-Zoran', 'תל מונד': 'Tel Mond',
  'צור יצחק': 'Tzur Yitzhak', 'כוכב יאיר': 'Kochav Yair', 'צור יגאל': 'Tzur Yigal', 'ראש העין': 'Rosh HaAyin', 'פתח תקווה': 'Petah Tikva',
  'תל אביב': 'Tel Aviv', 'תל אביב יפו': 'Tel Aviv-Yafo', 'רמת גן': 'Ramat Gan', 'גבעתיים': 'Givatayim', 'כפר יונה': 'Kfar Yona',
  'פרדסיה': 'Pardesiya', 'ירושלים': 'Jerusalem', 'חיפה': 'Haifa', 'חולון': 'Holon', 'בת ים': 'Bat Yam', 'ראשון לציון': 'Rishon LeZion',
  'רחובות': 'Rehovot', 'מודיעין': 'Modi\'in', 'אשדוד': 'Ashdod', 'נס ציונה': 'Ness Ziona', 'בני ברק': 'Bnei Brak', 'שרון': 'the Sharon',
  'השרון': 'the Sharon', 'נווה ירק': 'Neve Yarak', 'מגשימים': 'Magshimim', 'ירקונה': 'Yarkona', 'גני עם': 'Ganei Am', 'רשפון': 'Rishpon',
}
const TYPES = [
  [/פנטהאוז|פנטהאוס/, 'a penthouse'], [/דירת גן/, 'a garden apartment'], [/דופלקס/, 'a duplex'], [/מיני ?פנטהאוז/, 'a mini penthouse'],
  [/וילה/, 'a villa'], [/בית פרטי|בית צמוד/, 'a private house'], [/קוטג'?/, 'a cottage'], [/דו ?משפחתי/, 'a semi-detached house'],
  [/מגרש|קרקע/, 'a plot'], [/דירה/, 'an apartment'], [/משרד/, 'an office'], [/חנות/, 'a shop'], [/מסחרי/, 'a commercial property'],
]
const YESNO = { 'כן': 'yes', 'לא': 'no' }

/** "זרובבל 15 - v2 (כוונה גבוהה)" / "זרובבל 15" → "15 Zerubavel Street"; a Latin name stays; an unknown Hebrew one → '' */
export function englishProject(name) {
  const s = String(name || '').replace(/[‎‏]/g, '').replace(/\s*[-–]\s*(v\d+|copy|\d+#|#\d+).*$/i, '').replace(/\s*\(.*\)\s*$/, '').replace(/#/g, '').trim()
  if (!s) return ''
  if (!hasHebrew(s)) return s
  const m = s.match(/^(.+?)\s+(\d+[א-ת]?(?:-\d+)?)$/) || s.match(/^(\d+)\s+(.+)$/)?.slice(0).reverse()
  const street = m ? m[1].trim() : s, num = m ? m[2] : ''
  const en = STREETS[street] || STREETS[street.replace(/^רחוב\s+/, '')] || TOWNS[street]
  if (!en) return ''
  return num ? `${num.replace(/[א-ת]/g, '')} ${en} Street` : en
}

/** A town in English ('' when unknown) */
export const englishTown = s => TOWNS[String(s || '').replace(/^ב/, '').trim()] || (hasHebrew(s) ? '' : String(s || '').trim())

/** One answer / field value in English: rooms, budgets, property types, towns, yes / no — else '' if it is Hebrew */
export function englishValue(v) {
  let s = String(v ?? '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s || !hasHebrew(s)) return s
  let m
  if ((m = s.match(/^(\d+(?:\.\d)?)\s*(?:-|–)\s*(\d+(?:\.\d)?)\s*חדרים$/))) return `${m[1]}–${m[2]} rooms`
  if ((m = s.match(/^(\d+(?:\.\d)?)\s*חדרים?$/))) return `${m[1]} rooms`
  if ((m = s.match(/^(\d+(?:\.\d)?)\s*(?:-|–)\s*(\d+(?:\.\d)?)\s*מיליון/))) return `₪${m[1]}–${m[2]} million`
  if ((m = s.match(/^(\d+(?:\.\d)?)\s*מיליון\s*(ומעלה|וצפונה|\+)/)) || (m = s.match(/^מעל\s*(\d+(?:\.\d)?)\s*מיליון/))) return `₪${m[1]} million+`
  if ((m = s.match(/^עד\s*(\d+(?:\.\d)?)\s*מיליון/))) return `up to ₪${m[1]} million`
  if ((m = s.match(/^כ?-?(\d+(?:\.\d)?)\s*מיליון\s*₪?$/))) return `₪${m[1]} million`
  if (YESNO[s]) return YESNO[s]
  const town = englishTown(s)
  if (town) return town
  for (const [re, en] of TYPES) if (re.test(s) && s.length <= 20) return en.replace(/^an? /, '')
  return ''
}

const NOUNS = /^(mini penthouse|penthouse|garden apartment|duplex|villa|private house|cottage|semi-detached house|plot|apartment|office|shop|commercial property)$/i
/** "penthouse" / "Penthouse" → "a penthouse" (a property type said in a sentence); anything else as is */
export const withArticle = v => (NOUNS.test(String(v || '').trim()) ? `${/^[aeiou]/i.test(v.trim()) ? 'an' : 'a'} ${v.trim().toLowerCase()}` : v)

/** The lead's first name for an English message: the name they typed (Latin), else the Hebrew one written in English, else '' */
export function englishFirstName(name, typed = '') {
  const t = String(typed || '').trim().split(/\s+/)[0]
  if (t && !hasHebrew(t) && /[a-z]/i.test(t)) return t
  const first = String(name || '').split(' · ')[0].trim().split(/\s+/)[0] || ''
  if (!first) return ''
  if (!hasHebrew(first)) return first
  return latinFirstName(first)
}
