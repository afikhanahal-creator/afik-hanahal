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
    unsupported: 'בדפדפן הזה אין הקלטה. עובד ב-Chrome, Edge ו-Safari. בטלפון אפשר גם ללחוץ על המיקרופון שבמקלדת.',
    busy: 'המיקרופון תפוס בתוכנה או בלשונית אחרת. סוגרים אותה ומנסים שוב.',
    offline: 'אין חיבור לאינטרנט. ההקלטה נשמרה כאן, ואפשר לנסות שוב כשהחיבור חוזר.',
    transcribe: 'התמלול נכשל. ההקלטה נשמרה כאן, אפשר לנסות שוב.',
    'too-long': 'הגעתם למשך ההקלטה המרבי (15 דקות), ההקלטה נעצרה ומתומללת.',
    format: 'הדפדפן הקליט בפורמט ששירות התמלול לא מכיר. עדיף Chrome או Safari מעודכנים.',
    'no-speech': 'לא זוהה דיבור בהקלטה. מדברים קרוב יותר למיקרופון ומנסים שוב.',
    process: 'העיבוד לעברית תקינה לא הצליח, הטקסט נשאר כפי שתומלל.',
  }
  const en = {
    'not-allowed': 'The browser blocked the microphone. Click the lock next to the address → Microphone → Allow, then try again.',
    'service-not-allowed': 'The browser blocked speech recognition. On iPhone: Settings → Siri → turn it on, and allow the microphone for Safari.',
    'audio-capture': 'No microphone was found. Check it is connected and not in use by another app.',
    network: 'The speech service can\'t be reached. Check the internet and try again.',
    'language-not-supported': 'This browser can\'t recognize this language. Chrome or Safari work best.',
    unsupported: 'This browser can\'t record. It works in Chrome, Edge and Safari; on a phone the keyboard\'s mic works too.',
    busy: 'The microphone is in use by another app or tab. Close it and try again.',
    offline: 'No internet connection. The recording is kept here; try again when you\'re back online.',
    transcribe: 'Transcription failed. The recording is kept here; you can try again.',
    'too-long': 'The maximum length (15 minutes) was reached; the recording stopped and is being transcribed.',
    format: 'The browser recorded in a format the transcription service doesn\'t know. Use an up-to-date Chrome or Safari.',
    'no-speech': 'No speech was found in the recording. Speak closer to the microphone and try again.',
    process: 'Cleaning up the text didn\'t work; it stays as transcribed.',
  }
  const m = lang === 'en' ? en : he
  return m[code] || (lang === 'en' ? 'Dictation stopped. Try again.' : 'ההקלטה נעצרה. מנסים שוב.')
}

/** The best recording format this browser has (Chrome / Edge / Firefox: webm-opus, Safari: mp4-aac) */
export function pickMime(isSupported = t => (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t))) {
  for (const t of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2']) {
    try { if (isSupported(t)) return t } catch { /* a browser that throws on the question */ }
  }
  return ''
}

/** getUserMedia's error → our code */
export function micErrorCode(e) {
  const n = String(e?.name || '')
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'not-allowed'
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'OverconstrainedError') return 'audio-capture'
  if (n === 'NotReadableError' || n === 'TrackStartError' || n === 'AbortError') return 'busy'
  return 'unsupported'
}

/** The transcript of every recorded piece, in order (a failed piece leaves a gap — retried before this is used) */
export const joinSegments = segs => (Array.isArray(segs) ? segs : []).map(s => String(s?.text || '').trim()).filter(Boolean).join(' ')

/** Which processing modes a box offers, and its default (call summaries open as a structured summary) */
export function modesFor(contextType) {
  if (contextType === 'task') return { modes: ['task'], def: 'task' }
  if (contextType === 'call' || contextType === 'meeting') return { modes: ['exact', 'smart', 'call'], def: 'call' }
  if (contextType === 'property') return { modes: ['exact', 'smart'], def: 'exact' }
  return { modes: ['exact', 'smart', 'call'], def: 'exact' }
}

/** A voice task (lib/voice-process.js) → the lead's task item (lib/follow-up.js shape): a time makes it a follow-up with a
 *  WhatsApp reminder, a day alone gets 10:00 Israel time, no time = a plain task without a due */
export function voiceTaskItem(t, { now = Date.now(), toIso, id = `t_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}` } = {}) {
  const title = String(t?.title || '').trim()
  if (!title) return null
  const due = String(t?.due || '')
  const [d, hm] = due.split('T')
  const iso = d && toIso ? toIso(d, hm || '10:00') : ''
  const text = [title, String(t?.description || '').trim()].filter(Boolean).join(' · ')
  const item = { id, text, done: false, createdAt: now, by: 'voice', kind: iso ? 'followup' : 'task', remind: !!iso }
  if (iso) item.due = iso
  if (t?.owner) item.owner = String(t.owner).trim()
  return item
}
