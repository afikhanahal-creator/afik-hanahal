// Voice dictation helpers (pure, tested in dictation.test.mjs) for src/VoiceDictate.jsx.
// The browser's own speech recognition (Chrome / Edge on a computer and on Android, Safari on Mac and iPhone) hears Hebrew
// as you speak; these helpers merge its results into the field without repeating words, decide how to run it per device,
// and build the final text.

/** Which recognition the browser has, and how to run it. Android Chrome repeats earlier words in continuous mode, so there
 *  every phrase is its own short session that restarts by itself. */
export function dictationMode(win = typeof window !== 'undefined' ? window : {}, ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const Rec = win.SpeechRecognition || win.webkitSpeechRecognition || null
  if (!Rec) return { supported: false }
  const android = /Android/i.test(ua)
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && (win.navigator?.maxTouchPoints || 0) > 1)
  return { supported: true, Rec, continuous: !android, android, ios }
}

/** The text of one recognition session so far: its final phrases and the phrase still being heard */
export function collectResults(results) {
  let final = '', interim = ''
  const list = results ? Array.from({ length: results.length }, (_, i) => results[i]) : []
  for (const r of list) {
    const t = String(r?.[0]?.transcript || '')
    if (r?.isFinal) final += t; else interim += t
  }
  return { final: tidy(final), interim: tidy(interim) }
}

export const tidy = s => String(s || '').replace(/\s+/g, ' ').trim()

/** a + b with one space between (or a new line when `a` ends a paragraph) */
export function joinText(a, b) {
  const x = String(a || ''), y = String(b || '').trim()
  if (!y) return x
  if (!x.trim()) return y
  if (/\n\s*$/.test(x)) return x.replace(/[ \t]+$/, '') + y
  return x.replace(/\s+$/, '') + ' ' + y
}

/** What the field shows: what was there before + every finished session + the session now being heard */
export function liveText(base, committed, session) {
  return joinText(base, joinText(committed, joinText(session?.final, session?.interim)))
}

/** The note after polishing: a one-line summary on top of a long note, then the whole text */
export function polishedNote(polish, lang = 'he') {
  const text = String(polish?.text || '').trim()
  const sum = String(polish?.summary || '').trim()
  if (!sum) return text
  return `${lang === 'en' ? 'Summary' : 'סיכום'}: ${sum}\n\n${text}`
}

export const fmtClock = sec => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

/** The browser's error, in words the office understands */
export function dictationError(code, lang = 'he') {
  const he = {
    'not-allowed': 'הדפדפן חסם את המיקרופון. לוחצים על סמל המנעול ליד כתובת האתר ← מיקרופון ← לאפשר, ומנסים שוב.',
    'service-not-allowed': 'הדפדפן חסם את זיהוי הדיבור. ב-iPhone: הגדרות ← Siri ← להפעיל, ובהגדרות Safari לאפשר מיקרופון.',
    'audio-capture': 'לא נמצא מיקרופון. בודקים שהוא מחובר ולא תפוס בתוכנה אחרת.',
    network: 'אין חיבור לשירות זיהוי הדיבור. בודקים את האינטרנט ומנסים שוב.',
    'language-not-supported': 'הדפדפן הזה לא מזהה עברית. עדיף Chrome או Safari.',
    unsupported: 'בדפדפן הזה אין הכתבה. עובד ב-Chrome, Edge ו-Safari. בטלפון אפשר גם ללחוץ על המיקרופון שבמקלדת.',
  }
  const en = {
    'not-allowed': 'The browser blocked the microphone. Click the lock next to the address → Microphone → Allow, then try again.',
    'service-not-allowed': 'The browser blocked speech recognition. On iPhone: Settings → Siri → turn it on, and allow the microphone for Safari.',
    'audio-capture': 'No microphone was found. Check it is connected and not in use by another app.',
    network: 'The speech service can\'t be reached. Check the internet and try again.',
    'language-not-supported': 'This browser can\'t recognize this language. Chrome or Safari work best.',
    unsupported: 'This browser has no dictation. It works in Chrome, Edge and Safari; on a phone the keyboard\'s mic works too.',
  }
  const m = lang === 'en' ? en : he
  return m[code] || (lang === 'en' ? 'Dictation stopped. Try again.' : 'ההקלטה נעצרה. מנסים שוב.')
}
