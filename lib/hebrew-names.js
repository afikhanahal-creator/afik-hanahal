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
