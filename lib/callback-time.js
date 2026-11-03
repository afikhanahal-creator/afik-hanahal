// "When should we call them back?" — read from a lead's WhatsApp reply ("בשעות הצהריים", "מחר בבוקר 9:00", "מחר ב4", "אחרי
// שלוש", "בעוד שעה", "ביום שלישי בערב"). Pure and tested (callback-time.test.mjs); used by lib/callback-task.js, which turns a
// hit into a follow-up task with a WhatsApp + on-screen reminder. Israel time throughout (DST-safe through lib/follow-up.js).
//
// A reply is taken only when it is clear: an explicit time (16:30), a day with a time / part of the day ("מחר ב4", "מחר
// בבוקר"), or a time with a call word ("תתקשרו ב5"). A weaker hint — only a part of the day, only "ב4", only "מחר", "בעוד
// שעה", "עכשיו" — counts when it answers our question about timing (our last message asked "מתי נוח…?") or the lead wrote a call
// word. Refusals ("לא מעוניין", "לא זמין מחר") never make a task.
import { israelParts, fromIsraelLocal } from './follow-up.js'

const pad = n => String(n).padStart(2, '0')
const dayKey = p => `${p.y}-${pad(p.m)}-${pad(p.d)}`
const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}` }
const weekday = key => { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() }

/** One way of writing: no niqqud, plain quotes, "ב-4" → "ב4", one space */
export function normalizeHe(s) {
  return String(s || '')
    .replace(/[֑-ׇ]/g, '')
    .replace(/[״“”]/g, '"').replace(/[׳‘’`]/g, "'")
    .replace(/([בל])[-־]\s*(?=\d|[א-ת])/g, '$1')
    .replace(/[\s‏‎]+/g, ' ')
    .trim()
}

const NUM_WORDS = [
  ['אחת עשרה', 11], ['אחד עשרה', 11], ['שתים עשרה', 12], ['שתיים עשרה', 12], ['שתים-עשרה', 12],
  ['אחת', 1], ['שתיים', 2], ['שתים', 2], ['שלוש', 3], ['ארבע', 4], ['חמש', 5], ['שש', 6], ['שבע', 7], ['שמונה', 8], ['תשע', 9], ['עשר', 10],
]
const NUM_RE = NUM_WORDS.map(([w]) => w).join('|')
const DAYS = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5 }
const DAY_RE = Object.keys(DAYS).join('|')
// a Hebrew "word boundary": not preceded / followed by a Hebrew letter
const B = '(?<![א-ת])', E = '(?![א-ת])'

const PERIODS = [
  // [pattern, part, default hour, minute]
  [`(?:ב?שעות\\s+)?(?:אחה"צ|אחה'צ|אחהצ|אחר\\s+ה?צהריים|אחרי\\s+ה?צהריים|אחר\\s+הצהרים|אחרי\\s+הצהרים)`, 'afternoon', 16, 0],
  [`(?:ב?שעות\\s+)?ה?בוקר|בבוקר`, 'morning', 10, 0],
  [`(?:ב?שעות\\s+)?ה?צהריים|בצהריים|צהרים|בצהרים`, 'noon', 13, 0],
  [`(?:ב?שעות\\s+)?ה?ערב|בערב|לפנות\\s+ערב`, 'evening', 19, 0],
  [`בלילה|הלילה`, 'night', 20, 30],
]
const NEGATIVE = /לא\s+(?:מעוניי?ן|מעוניינת|מעוניינים|רלוונטי|רלבנטי|תודה)|תסירו|תורידו|הסר(?:ו)?\s+אותי|אל\s+תשלחו|תפסיקו|כבר\s+(?:קניתי|קנינו|מצאתי|מצאנו|סגרתי|סגרנו)/
const UNAVAILABLE = /לא\s+(?:יכול|יכולה|יכולים|זמין|זמינה|זמינים|פנוי|פנויה|נוח|מתאים|מתאימה|אוכל)/
const CALL_WORDS = /תתקשר|תתקשרי|תתקשרו|תחזור|תחזרי|תחזרו|תצלצל|תצלצלו|להתקשר|לדבר|נדבר|דברו|שיחה|טלפון|זמין|זמינה|זמינים|פנוי|פנויה|פנויים|נוח לי|נוח לנו|אפשר לדבר|call me|call back|talk/i
const QUESTION_WORDS = /מתי|נוח|לדבר|נדבר|להתקשר|נתקשר|שנתקשר|שיחה|טלפון|שעה|זמן|when|call|talk/i

/** Our message asked the lead when to talk */
export function askedForTime(text) {
  const s = normalizeHe(text)
  return /\?/.test(s) && QUESTION_WORDS.test(s)
}

function hourFrom(raw) {
  const s = String(raw || '').trim()
  if (/^\d{1,2}$/.test(s)) return +s
  const hit = NUM_WORDS.find(([w]) => w === s)
  return hit ? hit[1] : null
}

/**
 * The time a reply asks for → null, or { due (ISO), date ("YYYY-MM-DD"), time ("HH:mm"), strong, parts, match }
 * strong = clear enough on its own (see the top of the file); weak hits need the context check in detectCallback.
 */
export function parseCallbackTime(text, { now = Date.now() } = {}) {
  // greetings aren't parts of the day ("בוקר טוב, מחר ב4")
  const s = normalizeHe(text).replace(new RegExp(`${B}(?:בוקר|ערב|לילה|שבוע|יום|צהריים|צהרים)\\s+(?:טוב|טובים|נעים|מבורך)${E}`, 'g'), ' ').replace(/\s+/g, ' ').trim()
  if (!s || s.length > 400) return null
  if (NEGATIVE.test(s)) return null
  const n = israelParts(now)
  const today = dayKey(n)
  const nowMin = n.h * 60 + n.min
  const found = []

  // ── the day ──
  let day = null, dayWord = ''
  let m
  if ((m = new RegExp(`${B}(?:ל|ב)?מחרתיים${E}`).exec(s))) { day = addDays(today, 2); dayWord = m[0] }
  else if ((m = new RegExp(`${B}(?:ל|עד\\s+)?מחר${E}`).exec(s))) { day = addDays(today, 1); dayWord = m[0] }
  else if ((m = new RegExp(`${B}(?:עוד\\s+)?היום${E}`).exec(s))) { day = today; dayWord = m[0] }
  else {
    // "ביום שלישי", "בשלישי"; a bare "שלישי" only next to "שבוע הבא" or with a call word ("נדבר שלישי"), never "שני חדרים" /
    // a bare "שני" (= two); "שבוע הבא" moves a weekday to next week (Sunday first): "ביום שני בשבוע הבא" written on a Sunday
    const nextWeek = new RegExp(`${B}(?:ב?שבוע\\s+(?:הבא|הקרוב))${E}`).exec(s)
    const noun = '(?!\\s+(?:חדרים|חדר|ילדים|קומות|כיווני|דברים|אנשים|מיליון))'
    m = new RegExp(`${B}(?:ב?יום\\s+|ב)(${DAY_RE})${E}${noun}`).exec(s)
    if (!m) { const bare = new RegExp(`${B}(${DAY_RE})${E}${noun}`).exec(s); if (bare && (nextWeek || (CALL_WORDS.test(s) && bare[1] !== 'שני'))) m = bare }
    if (m) {
      let d = DAYS[m[1]] - weekday(today)
      if (nextWeek) d = 7 - weekday(today) + DAYS[m[1]]
      else if (d <= 0) d += 7
      day = addDays(today, d); dayWord = nextWeek ? `${m[0]} ${nextWeek[0]}` : m[0]
    } else if (nextWeek) { day = addDays(today, 7 - weekday(today)); dayWord = nextWeek[0] }
  }
  if (dayWord) found.push(dayWord)

  // ── a part of the day ──
  let part = null
  for (const [re, name, h, mi] of PERIODS) {
    const pm = new RegExp(`${B}(?:${re})${E}`).exec(s)
    if (pm) { part = { name, h, m: mi }; found.push(pm[0]); break }
  }

  // ── the hour ──
  let hh = null, mm = 0, explicit = false, hourPrefix = false
  const clock = /(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/.exec(s)
  if (clock) {
    hh = +clock[1]; mm = +clock[2]; explicit = true; found.push(clock[0])
  } else {
    // "ב4", "בשעה 4", "אחרי שלוש", "בסביבות 5", "לקראת 6", "ב-ארבע וחצי" — never "3-4 מיליון", "2 חדרים"
    const re = new RegExp(`${B}(ב|בשעה\\s+|אחרי\\s+|אחר\\s+|בסביבות\\s+|בסביבת\\s+|סביב\\s+|לקראת\\s+|בערך\\s+ב?|מ)?(\\d{1,2}|${NUM_RE})(?:\\s*(וחצי|ורבע|פחות\\s+רבע))?(?!\\d|\\s*(?:-|–)\\s*\\d|\\s*(?:חדר|חדרים|מיליון|מליון|מ"ר|מטר|אלף|%|₪|דק|שעות|שעה|ימים|יום|ילדים|קומה|קומות|שנים|שנה))${E}`, 'g')
    let hm
    while ((hm = re.exec(s))) {
      const prefix = (hm[1] || '').trim()
      const val = hourFrom(hm[2])
      const word = !/^\d/.test(hm[2])
      // a bare number word / digit with no prefix counts only next to a part of the day ("4 אחה"צ", "שמונה בערב")
      const nearPart = part && new RegExp(`${hm[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:${PERIODS.map(p => p[0]).join('|')})`).test(s)
      if (val == null || val < 1 || val > 23) continue
      if (!prefix && !nearPart) continue
      if (prefix === 'מ' && !nearPart) continue          // "מ4" only as "מ4 אחה"צ"
      if (word && !prefix && !nearPart) continue
      hh = val; hourPrefix = !!prefix
      mm = hm[3] === 'וחצי' ? 30 : hm[3] === 'ורבע' ? 15 : 0
      if (hm[3] && /פחות/.test(hm[3])) { hh = hh - 1; mm = 45 }
      found.push(hm[0])
      break
    }
  }

  // ── "בעוד שעה", "עוד חצי שעה", "בעוד 20 דקות", "עכשיו" ──
  let rel = null
  const rm = new RegExp(`${B}(?:בעוד|עוד)\\s+(?:(חצי\\s+שעה|רבע\\s+שעה|שעה|שעתיים|כמה\\s+דקות|כמה\\s+שעות)|(\\d{1,3})\\s*(דקות|דק'|דק|שעות))${E}`).exec(s)
  if (rm) {
    const w = rm[1] || ''
    rel = /חצי/.test(w) ? 30 : /רבע/.test(w) ? 15 : w === 'שעה' ? 60 : w === 'שעתיים' ? 120 : /כמה\s+דקות/.test(w) ? 15 : /כמה\s+שעות/.test(w) ? 180
      : (+rm[2]) * (/שעות/.test(rm[3]) ? 60 : 1)
    if (rel > 0 && rel <= 12 * 60) found.push(rm[0]); else rel = null
  } else if (new RegExp(`${B}(?:עכשיו|כעת|אפשר\\s+עכשיו)${E}`).test(s) && !/לא\s+עכשיו|עכשיו\s+לא|עכשיו\s+אני\s+לא/.test(s)) {
    rel = 2; found.push('עכשיו')
  } else if (/(?:יותר|קצת)\s+מאוחר|מאוחר\s+יותר|בהמשך\s+היום/.test(s)) {
    rel = 180; found.push('מאוחר יותר')
  }

  if (UNAVAILABLE.test(s) && !(hh != null || part)) return null   // "לא זמין מחר" with nothing offered instead
  if (day == null && hh == null && !part && rel == null) return null

  // ── put it together ──
  let date = day, time
  if (rel != null && hh == null && !part && day == null) {
    const at = new Date(now + rel * 60e3)
    const p = israelParts(at)
    const r5 = Math.ceil(p.min / 5) * 5
    date = dayKey(p); time = r5 === 60 ? `${pad((p.h + 1) % 24)}:00` : `${pad(p.h)}:${pad(r5)}`
    if (r5 === 60 && p.h === 23) date = addDays(date, 1)
  } else {
    let h = hh, mi = mm
    if (h == null) {
      if (part) { h = part.h; mi = part.m }
      else if (day === today) { const t = nowMin + 60; h = Math.min(20, Math.max(10, Math.ceil(t / 60))); mi = 0 }
      else { h = 10; mi = 0 }
    } else if (!explicit || h <= 12) {
      // 4 → 16:00, 8 → 08:00, 12 → 12:00; a part of the day decides when given
      if (part?.name === 'morning') { /* as written */ }
      else if (part && ['afternoon', 'evening', 'night'].includes(part.name)) { if (h < 12) h += 12 }
      else if (part?.name === 'noon') { if (h <= 6) h += 12 }
      else if (h >= 1 && h <= (explicit ? 6 : 7)) h += 12
    }
    if (!explicit && (h < 7 || h > 22)) return null
    date = date || today
    // no day given and the time already passed today: the evening of the same number if it still fits, else tomorrow
    if (!day && (h * 60 + mi) <= nowMin + 5) {
      if (!explicit && !part && h < 12 && (h + 12) * 60 + mi > nowMin + 5 && h + 12 <= 21) h += 12
      else date = addDays(today, 1)
    }
    time = `${pad(h)}:${pad(mi)}`
  }
  // Saturday → Sunday, same hour (the office is closed)
  if (weekday(date) === 6) date = addDays(date, 1)
  let due = fromIsraelLocal(date, time)
  if (!due) return null
  // a time in the past today (e.g. "היום ב10" written at 11) → in a few minutes, so it still pops up
  if (Date.parse(due) < now) { due = new Date(now + 5 * 60e3).toISOString(); const p = israelParts(due); date = dayKey(p); time = `${pad(p.h)}:${pad(p.min)}` }

  const strong = explicit || (day != null && (hh != null || !!part)) || ((hh != null || day != null) && CALL_WORDS.test(s))
  return { due, date, time, strong, parts: { day: dayWord || null, part: part?.name || null, hour: hh, relative: rel, hourPrefix }, match: found.join(' · ') }
}

/**
 * A lead's message → the callback it asks for, or null. prevOut = our last message to them before it (its text and when),
 * used for the weaker hints: a reply to "מתי נוח לדבר?" may be just "בשעות הצהריים".
 * → { due, date, time, why: 'clear' | 'answer' | 'call-word', match }
 */
export function detectCallback({ text, prevOut = null, now = Date.now() } = {}) {
  const hit = parseCallbackTime(text, { now })
  if (!hit) return null
  if (hit.strong) return { ...hit, why: 'clear' }
  const s = normalizeHe(text)
  const recentAsk = prevOut && askedForTime(prevOut.text) && (!prevOut.at || now - Date.parse(prevOut.at) < 72 * 3600e3)
  if (recentAsk && s.length <= 120) return { ...hit, why: 'answer' }
  if (CALL_WORDS.test(s)) return { ...hit, why: 'call-word' }
  return null
}

const localPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('972') ? '0' + d.slice(3) : d }
const prettyPhone = p => { const l = localPhone(p); return /^05\d{8}$/.test(l) ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l }
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }

/** The task's text: who, and what they wrote */
export function callbackTaskText(lead, quote) {
  const first = String(lead?.name || '').trim().split(/\s+/)[0] || 'ליד'
  return `לחזור ל${first} — ביקשו בוואטסאפ: "${clip(quote, 60)}"`
}

/** "היום 13:00" / "מחר 16:00" / "יום שלישי 19:00" / "5.11 10:00" */
export function whenText(due, now = Date.now()) {
  const p = israelParts(due), n = israelParts(now)
  const k = dayKey(p), t = `${pad(p.h)}:${pad(p.min)}`
  if (k === dayKey(n)) return `היום ${t}`
  if (k === addDays(dayKey(n), 1)) return `מחר ${t}`
  const diff = (Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(n.y, n.m - 1, n.d)) / 864e5
  if (diff > 1 && diff < 7) return `יום ${['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][p.wd]} ${t}`
  return `${p.d}.${p.m} ${t}`
}

/** The office's WhatsApp the moment the task is made (one tap to call / write / open the card) */
export function callbackNotice(lead, { due, quote, project = '', now = Date.now(), site = 'https://www.afikhanahal.co.il', moved = false } = {}) {
  const name = String(lead?.name || '').trim() || 'ליד בלי שם'
  const phone = lead?.phone ? prettyPhone(lead.phone) : ''
  const intl = (() => { const l = localPhone(lead?.phone); return l.startsWith('0') ? '972' + l.slice(1) : l })()
  return [
    `*${moved ? 'המשימה עודכנה' : 'משימה חדשה'}: לחזור ל${name} ${whenText(due, now)}*`,
    `כתבו בוואטסאפ: "${clip(quote, 120)}"`,
    project ? `על: ${project}` : '',
    phone ? `טלפון: ${phone}` : '',
    intl ? `וואטסאפ: https://wa.me/${intl}` : '',
    `כרטיס הליד: ${site}/admin-panel/leads?lead=${encodeURIComponent(lead?.id || '')}`,
    'תזכורת תגיע כאן ובמסך בזמן הזה.',
  ].filter(Boolean).join('\n')
}

/** Phone numbers typed by the office ("054-304-9491, 0559811814") → unique international numbers */
export function notifyNumbers(list) {
  const out = []
  for (const raw of (Array.isArray(list) ? list : String(list || '').split(/[,;\n]+/))) {
    let d = String(raw || '').replace(/\D/g, '')
    if (d.startsWith('0')) d = '972' + d.slice(1)
    if (/^972\d{8,9}$/.test(d) && !out.includes(d)) out.push(d)
  }
  return out
}

/** Claude's reading of an unusual reply ({ callback, date, time, confidence }) → a safe due, or null: a real future Israel
 *  time within two weeks, in office-ish hours, and only when Claude was sure */
export function aiDue(a, now = Date.now()) {
  if (!a || a.callback !== true || !['high', 'medium'].includes(a.confidence)) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.date || '')) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(a.time || ''))) return null
  const h = +a.time.slice(0, 2)
  if (h < 7 || h > 22) return null
  let date = a.date
  if (weekday(date) === 6) date = addDays(date, 1)
  const due = fromIsraelLocal(date, a.time)
  const t = Date.parse(due)
  if (!due || t < now - 5 * 60e3 || t > now + 14 * 864e5) return null
  return t < now ? new Date(now + 5 * 60e3).toISOString() : due
}
