// ─── SELLER INTAKE FORM — public page (/sell) ─────────────────────────────────
// Typeform-style, one question per screen. White canvas, black type, purple
// accents (brand #8490D8 / #3F4EB0). Single professional typeface: Heebo.
//
// • Keyboard first: Enter = continue, letters pick options, ↑/↓ move between
//   questions, Ctrl/⌘+Enter inside long answers.
// • Auto-saves a draft to localStorage so the seller can stop and resume.
// • Uploads (photos / videos / plans / documents) go straight to Supabase
//   Storage via signed URLs minted by /api/seller-form — no size limits from
//   the serverless layer, live progress per file.
// • Submission is stored in the `seller_submissions` table, filed under a
//   reference number, and the office is notified by e-mail + WhatsApp.
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  STEPS, SECTIONS, visibleSteps, visibleFields, visibleRows, validateStep, groupInvalidFields,
  buildSummary, VALIDATION_MSG, fmtNum, SCHEMA_VERSION, DOC_TAG_LABEL, EMPHASIS,
  otherKey, noteKey, directionsText, buildStory, storyText, headline, storyTitle, storyLine, addressLine, PROPERTY_TYPE_LABEL,
  stepOpts, stepQuestion, stepHelp, stepPh, stepUnit, sectionText, emphasisFor, purposeOf, purposeSpecificKeys, PROPERTY_STATE_LABEL } from './sellerFormSchema.js'
import CITIES from './data/israelCities.json'
import { visibleSteps as visibleStepsOf, roomsOf } from './sellerFormSchema.js'
import { SummaryView, ShareMenu, buildLocalSummary } from './PropertySummary.jsx'

const API = import.meta.env.PROD ? '' : (import.meta.env.VITE_SELLER_API_BASE || '')
const DRAFT_KEY = 'afik_seller_form_v1'
const OFFICE_WA = '972559811814'
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap'

// ── UI strings (Hebrew + English) ────────────────────────────────────────────
const T = {
  he: {
    brand: 'אפיק הנחל', tagline: 'ייזום · שיווק · תיווך',
    welcomeTitle: 'בואו נכיר את הנכס שלכם',
    welcomeSub: 'שאלון קצר של כ־10 דקות שעוזר לנו להכיר את הנכס ולשווק אותו נכון.',
    start: 'בואו נתחיל', resume: 'להמשיך מאיפה שעצרתי', restart: 'להתחיל מחדש',
    savedDraft: 'מצאנו טופס שהתחלתם למלא', draftStep: 'נעצרתם בשאלה {n} מתוך {total}', draftWhen: { now: 'לפני רגע', min: 'לפני {n} דקות', hour: 'לפני {n} שעות', day: 'לפני {n} ימים' },
    otherDevice: 'התחלתם למלא במכשיר אחר?', otherDeviceHint: 'הזינו את מספר הטלפון שמסרתם בטופס, ונשלח לכם קישור להמשך בוואטסאפ', otherDeviceSend: 'שלחו לי קישור', otherDeviceSent: 'אם קיים טופס שמור למספר הזה, קישור להמשך נשלח אליכם בוואטסאפ', otherDeviceErr: 'לא הצלחנו לשלוח כרגע. נסו שוב בעוד רגע',
    later: 'להמשיך אחר כך', laterTitle: 'הטופס שלכם נשמר', laterSub: 'אפשר לסגור ולחזור מאותו מכשיר בכל זמן. כדי להמשיך ממכשיר אחר, שמרו את הקישור:', laterWaSelf: 'שליחה לעצמי בוואטסאפ', laterWaServer: 'שלחו לי את הקישור בוואטסאפ', laterSentOk: 'הקישור נשלח לוואטסאפ שלכם ({phone})', laterSentNo: 'לא הצלחנו לשלוח — העתיקו את הקישור', laterClose: 'חזרה לטופס', copyLink: 'העתקת הקישור', resumedLocal: 'המשכנו מהמקום שבו עצרתם. כל התשובות נשמרו',
    ok: 'אישור', cont: 'המשך', back: 'חזרה', press: 'או לחצו', requiredMark: 'שדה חובה',
    of: 'מתוך', part: 'חלק', optional: 'לא חובה',
    selectMany: 'אפשר לבחור כמה תשובות', selectOne: 'בחרו תשובה אחת', pickOne: 'בחרו מהרשימה…',
    yes: 'כן', no: 'לא',
    dropTitle: 'גררו קבצים לכאן או לחצו לבחירה', dropSub: 'עד {n} קבצים · עד {mb}MB לקובץ',
    uploading: 'מעלה…', uploadDone: 'הועלה', uploadErr: 'ההעלאה נכשלה', retry: 'נסו שוב', remove: 'הסרה',
    docTypePick: 'איזה מסמך אתם מעלים עכשיו?', laterWhatsapp: 'אפשר לדלג ולשלוח לנו מאוחר יותר בוואטסאפ',
    fileTooBig: '{name}: הקובץ גדול מדי (מקסימום {mb}MB)', tooMany: 'אפשר להעלות עד {n} קבצים בשלב הזה', wrongType: '{name}: סוג הקובץ לא נתמך כאן',
    uploadedCount: '{n} קבצים הועלו',
    reviewTitle: 'תיק הנכס', reviewKicker: 'סיכום כל הפרטים', reviewSub: 'כל מה שסיפרתם לנו, מסודר לפי נושאים. אפשר לערוך כל תשובה בלחיצה.',
    toStory: 'לסיפור הנכס', storyKicker: 'סיפור הנכס', storySub: 'כך נציג את הנכס לקונים. קראו בנחת, ואם משהו אינו מדויק, חזרו ותקנו.', storySubRent: 'כך נציג את הנכס לשוכרים. קראו בנחת, ואם משהו אינו מדויק, חזרו ותקנו.', preparedFor: 'הוכן עבור', copyStory: 'העתקת הסיפור', storyDoc: 'תיק נכס', storyBy: 'הוכן על ידי אפיק הנחל על סמך הפרטים שמסרתם', storyFoot: 'אפיק הנחל · ייזום, שיווק ותיווך נדל״ן',
    factPrice: 'מחיר מבוקש', factRooms: 'חדרים', factArea: 'מ״ר בנוי', factFloor: 'קומה', factParking: 'חניות', factState: 'מצב', factType: 'סוג הנכס',
    otherPh: 'פרטו במילים…', clear: 'ניקוי', noMatches: 'לא נמצאה התאמה — אפשר להשאיר כפי שהקלדתם', noStreetMatch: 'הרחוב לא ברשימה? אפשר להשאיר כפי שהקלדתם', popularCities: 'ערים נפוצות', allCities: 'כל היישובים', notePh: 'תיאור כיווני האוויר. אפשר לערוך חופשי', noteReset: 'חזרה לתיאור האוטומטי', loadingStreets: 'טוען רחובות…', noStreets: 'הקלידו את שם הרחוב',
    edit: 'עריכה', missingTitle: 'נשארו שאלות חובה שלא נענו', jump: 'מעבר לשאלה',
    editing: 'עריכת תשובה מהסיכום. לחיצה על "המשך" תחזיר אתכם לסיכום', backToReview: 'חזרה לסיכום', toReview: 'לסיכום', showAll: 'הצגת כל הפרטים', hideAll: 'כיווץ הכל', itemsCount: '{n} פרטים', reviewHint: 'לחצו על כותרת כדי לפתוח או לסגור. אפשר לערוך כל תשובה בלחיצה על "עריכה".',
    consent: 'אני מאשר/ת שהפרטים שמסרתי נכונים למיטב ידיעתי, ומסכים/ה שאפיק הנחל תיצור איתי קשר בנוגע לשיווק הנכס.',
    submit: 'סיום ושליחת הנכס', submitting: 'שולחים…', shareForm: 'שתף טופס', shareFormText: 'היי, אפיק הנחל מבקשים שנמלא את פרטי הנכס. אפשר להמשיך את הטופס כאן:', shareFormHint: 'שלחו את הקישור לבן/בת זוג או לשותף כדי שיעזרו למלא. הטופס המשותף נשמר אוטומטית.', resumedFromLink: 'המשכנו מהמקום שבו הטופס נעצר', savedCloud: 'נשמר', dateDay: 'יום', dateMonth: 'חודש', dateYear: 'שנה', dirPresets: 'בחירה מהירה', pickFromList: 'או בחרו מהרשימה',
    submitErr: 'משהו השתבש בשליחה. הטופס שלכם שמור, נסו שוב בעוד רגע או שלחו לנו הודעה בוואטסאפ.',
    consentErr: 'צריך לאשר את ההצהרה כדי לשלוח',
    doneTitle: 'תודה, {name}!', doneTitleShort: 'תודה!', doneSub: 'הנכס נקלט אצלנו. צוות השיווק של אפיק הנחל יעבור על הפרטים וייצור איתכם קשר תוך יום עסקים כדי לתאם את הצעד הבא.', factRent: 'שכירות חודשית',
    refLabel: 'מספר תיק', doneWa: 'לשלוח לנו הודעה בוואטסאפ', doneHome: 'חזרה לאתר אפיק הנחל', copyRef: 'העתקת מספר התיק', copied: 'הועתק',
    autosaved: 'נשמר אוטומטית', privacyNote: 'הפרטים נשמרים באופן מאובטח ומשמשים את אפיק הנחל בלבד.',
    files: '{n} קבצים', minus: 'פחות', plus: 'יותר', langToggle: 'English',
    waMsg: 'היי, מילאתי את טופס שיווק הנכס (תיק {ref}) ואשמח להמשיך משם',
    progress: 'התקדמות', question: 'שאלה',
  },
  en: {
    brand: 'Afik Hanahal', tagline: 'Development · Marketing · Brokerage',
    welcomeTitle: "Let's get to know your property",
    welcomeSub: 'A short questionnaire, about 10 minutes, that helps us get to know the property and market it right.',
    start: "Let's start", resume: 'Continue where I stopped', restart: 'Start over',
    savedDraft: 'We found a form you started', draftStep: 'You stopped at question {n} of {total}', draftWhen: { now: 'a moment ago', min: '{n} minutes ago', hour: '{n} hours ago', day: '{n} days ago' },
    otherDevice: 'Started on another device?', otherDeviceHint: 'Enter the phone number you gave in the form and we will send you a link to continue on WhatsApp', otherDeviceSend: 'Send me a link', otherDeviceSent: 'If a saved form exists for this number, a link to continue was sent to your WhatsApp', otherDeviceErr: 'We could not send right now. Please try again in a moment',
    later: 'Continue later', laterTitle: 'Your form is saved', laterSub: 'You can close and come back on this device any time. To continue on another device, keep the link:', laterWaSelf: 'Send to myself on WhatsApp', laterWaServer: 'Send me the link on WhatsApp', laterSentOk: 'The link was sent to your WhatsApp ({phone})', laterSentNo: 'We could not send it — copy the link instead', laterClose: 'Back to the form', copyLink: 'Copy link', resumedLocal: 'Continuing from where you stopped. All your answers were saved',
    ok: 'OK', cont: 'Continue', back: 'Back', press: 'or press', requiredMark: 'Required',
    of: 'of', part: 'Part', optional: 'Optional',
    selectMany: 'Select as many as apply', selectOne: 'Select one answer', pickOne: 'Choose from the list…',
    yes: 'Yes', no: 'No',
    dropTitle: 'Drag files here or click to choose', dropSub: 'Up to {n} files · {mb}MB per file',
    uploading: 'Uploading…', uploadDone: 'Uploaded', uploadErr: 'Upload failed', retry: 'Retry', remove: 'Remove',
    docTypePick: 'Which document are you uploading now?', laterWhatsapp: 'You can skip and send it later via WhatsApp',
    fileTooBig: '{name}: file is too large (max {mb}MB)', tooMany: 'Up to {n} files can be uploaded here', wrongType: '{name}: this file type is not supported here',
    uploadedCount: '{n} files uploaded',
    reviewTitle: 'Property file', reviewKicker: 'Everything in one place', reviewSub: 'Everything you told us, organised by topic. Click any answer to edit it.',
    toStory: 'To the property story', storyKicker: 'The property story', storySub: 'This is how we will present the property to buyers. Read it at your leisure, and go back to fix anything inaccurate.', storySubRent: 'This is how we will present the property to tenants. Read it at your leisure, and go back to fix anything inaccurate.', preparedFor: 'Prepared for', copyStory: 'Copy story', storyDoc: 'Property file', storyBy: 'Prepared by Afik Hanahal from the details you provided', storyFoot: 'Afik Hanahal · Real estate development, marketing and brokerage',
    factPrice: 'Asking price', factRooms: 'Rooms', factArea: 'm² built', factFloor: 'Floor', factParking: 'Parking', factState: 'Condition', factType: 'Type',
    otherPh: 'Please specify…', clear: 'Clear', noMatches: 'No match — you can keep what you typed', noStreetMatch: 'Street not listed? Keep what you typed', popularCities: 'Popular cities', allCities: 'All localities', notePh: 'Direction description. Edit freely', noteReset: 'Back to the automatic description', loadingStreets: 'Loading streets…', noStreets: 'Type the street name',
    edit: 'Edit', missingTitle: 'Some required questions are still unanswered', jump: 'Go to question',
    editing: 'Editing an answer from the summary. "Continue" takes you back to the summary', backToReview: 'Back to summary', toReview: 'To summary', showAll: 'Show all details', hideAll: 'Collapse all', itemsCount: '{n} details', reviewHint: 'Tap a heading to open or close it. Click "Edit" to change any answer.',
    consent: 'I confirm the details I provided are accurate to the best of my knowledge, and I agree that Afik Hanahal may contact me regarding marketing this property.',
    submit: 'Finish and submit the property', submitting: 'Sending…', shareForm: 'Share form', shareFormText: 'Hi, Afik Hanahal asked us to fill in our property details. You can continue the form here:', shareFormHint: 'Send the link to a spouse or partner so they can help fill it in. The shared form saves automatically.', resumedFromLink: 'Continuing from where the form stopped', savedCloud: 'Saved', dateDay: 'Day', dateMonth: 'Month', dateYear: 'Year', dirPresets: 'Quick pick', pickFromList: 'or pick from the list',
    submitErr: 'Something went wrong. Your form is saved. Try again in a moment or message us on WhatsApp.',
    consentErr: 'Please confirm the statement to submit',
    doneTitle: 'Thank you, {name}!', doneTitleShort: 'Thank you!', doneSub: 'Your property file has reached us. The Afik Hanahal marketing team will review the details and contact you within one business day to plan the next step.', factRent: 'Monthly rent',
    refLabel: 'File number', doneWa: 'Message us on WhatsApp', doneHome: 'Back to the Afik Hanahal website', copyRef: 'Copy file number', copied: 'Copied',
    autosaved: 'Auto-saved', privacyNote: 'Your details are stored securely and used by Afik Hanahal only.',
    files: '{n} files', minus: 'Less', plus: 'More', langToggle: 'עברית',
    waMsg: 'Hi, I filled in the property marketing form (file {ref}) and would love to continue from there',
    progress: 'Progress', question: 'Question',
  },
}
const fill = (s, vars = {}) => Object.entries(vars).reduce((acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)), s)

// ── tiny helpers ─────────────────────────────────────────────────────────────
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const isEditable = el => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
const stripFilesForDraft = answers => {
  const out = { ...answers }
  STEPS.filter(s => s.type === 'upload').forEach(s => {
    if (Array.isArray(out[s.id])) out[s.id] = out[s.id].filter(f => f.status === 'done').map(({ preview, _file, ...rest }) => rest)
  })
  return out
}
const loadDraft = () => { try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return d && d.answers && d.v === SCHEMA_VERSION ? d : null } catch { return null } }
const saveDraft = d => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch {} }
const clearDraft = () => { try { localStorage.removeItem(DRAFT_KEY) } catch {} }

// Downscale photos before upload (phone photos are 4–8MB; we never need more than ~1800px)
const compressImage = (file, max = 1800, quality = 0.82) => new Promise(resolve => {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return resolve(file)
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    let { width: w, height: h } = img
    if (Math.max(w, h) <= max && file.size < 900 * 1024) { URL.revokeObjectURL(url); return resolve(file) }
    if (w > h && w > max) { h = Math.round(h * max / w); w = max } else if (h >= w && h > max) { w = Math.round(w * max / h); h = max }
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    cv.getContext('2d').drawImage(img, 0, 0, w, h)
    cv.toBlob(b => {
      URL.revokeObjectURL(url)
      if (!b) return resolve(file)
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
      resolve(new File([b], name, { type: 'image/jpeg' }))
    }, 'image/jpeg', quality)
  }
  img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
  img.src = url
})

const putWithProgress = (url, blob, onProgress) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest()
  xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)) })
  xhr.addEventListener('load', () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`HTTP ${xhr.status}`)))
  xhr.addEventListener('error', () => reject(new Error('network')))
  xhr.open('PUT', url)
  xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream')
  xhr.setRequestHeader('x-upsert', 'true')
  xhr.send(blob)
})

// ── styles ───────────────────────────────────────────────────────────────────
const CSS = `
.sf-root { --ink:#26242B; --ink2:#4A4852; --muted:#75727C; --canvas:#EFEFF1; --paper:#FFFFFF; --line:#DCDCE0; --line2:#C6C6CC; --box:#E3E3E7; --boxHover:#D8D8DD; --purple:#8490D8; --deep:#3F4EB0; --tint:#EEF0FA; --tint2:#DFE3F6; --ok:#1F9D55; --err:#D93B3B;
  font-family:'Heebo', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color:var(--ink); background:var(--canvas); min-height:100dvh; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
.sf-root *, .sf-root *::before, .sf-root *::after { box-sizing:border-box; }
.sf-root button, .sf-root input, .sf-root textarea, .sf-root select { font-family:inherit; }
.sf-root ::selection { background:var(--tint2); }
.sf-root :focus-visible { outline:2px solid var(--deep); outline-offset:2px; border-radius:4px; }

/* ── progress + top bar (white, like Typeform's stepper header) ─────────── */
.sf-progress { position:fixed; top:0; inset-inline:0; height:3px; background:transparent; z-index:70; }
.sf-progress > i { display:block; height:100%; background:var(--deep); transition:width .45s cubic-bezier(.16,1,.3,1); }
.sf-top { position:fixed; top:0; inset-inline:0; z-index:60; background:var(--paper); border-bottom:1px solid var(--line); display:flex; align-items:center; gap:16px; padding:0 clamp(14px,3vw,32px); min-height:60px; }
.sf-brand { display:flex; align-items:center; gap:10px; text-decoration:none; color:inherit; flex:none; }
.sf-logo { height:34px; width:auto; display:block; }
.sf-brandtxt { display:flex; flex-direction:column; line-height:1.15; font-size:14px; font-weight:700; letter-spacing:.02em; color:var(--ink); }
.sf-brandtxt small { font-size:10px; font-weight:500; color:var(--muted); letter-spacing:.08em; }
.sf-stepper { flex:1; display:flex; align-items:center; justify-content:flex-start; gap:0; overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none; padding:10px 4px; min-width:0; }
.sf-stepper > :first-child { margin-inline-start:auto; }
.sf-stepper > :last-child { margin-inline-end:auto; }
.sf-stepper::-webkit-scrollbar { display:none; }
.sf-step { display:inline-flex; align-items:center; gap:8px; flex:none; font-size:12.5px; color:var(--muted); white-space:nowrap; }
.sf-step i { width:22px; height:22px; border-radius:50%; background:#D9D9DE; color:var(--ink2); font-size:11px; font-weight:700; font-style:normal; display:inline-flex; align-items:center; justify-content:center; flex:none; transition:all .25s; }
.sf-step.done i { background:var(--ink); color:#fff; }
.sf-step.cur i { background:var(--deep); color:#fff; box-shadow:0 0 0 4px var(--tint2); }
.sf-step.cur b { color:var(--ink); font-weight:700; }
.sf-step.done b { color:var(--ink2); }
.sf-step b { font-weight:500; }
.sf-step:not(.cur):not(.near) b { display:none; }
@media (min-width: 1500px) { .sf-step b { display:inline !important; } }
.sf-step em { display:inline-block; width:34px; height:1px; margin:0 10px; background:var(--line2); }
.sf-step.done em { background:var(--ink); }
.sf-step:not(.done):not(.cur) em { background-image:linear-gradient(90deg, var(--line2) 50%, transparent 50%); background-size:5px 1px; background-color:transparent; }
.sf-top-right { display:flex; align-items:center; gap:8px; flex:none; }
.sf-saved { font-size:11.5px; color:var(--muted); display:inline-flex; align-items:center; gap:6px; }
.sf-saved i { width:6px; height:6px; border-radius:50%; background:var(--ok); display:inline-block; }
.sf-lang { display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600; padding:8px 10px; min-height:40px; border-radius:6px; border:1px solid transparent; background:transparent; color:var(--muted); cursor:pointer; transition:all .2s; }
.sf-lang:hover { color:var(--deep); background:var(--tint); }

/* ── stage ─────────────────────────────────────────────────────────────── */
.sf-stage { min-height:100dvh; display:flex; align-items:flex-start; justify-content:center; padding:96px clamp(18px,5vw,48px) 90px; }
.sf-stage > .sf-card, .sf-stage > .sf-welcome, .sf-stage > .sf-done-wrap { margin:auto; }
.sf-card { width:100%; max-width:820px; text-align:center; }
.sf-qhead { display:flex; flex-direction:column; align-items:center; gap:12px; }
.sf-badge { flex:none; min-width:24px; height:24px; padding:0 7px; border-radius:5px; background:var(--ink); color:#fff; font-size:12.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; letter-spacing:.02em; }
.sf-q { font-size:clamp(23px, 2.9vw, 33px); font-weight:400; line-height:1.35; margin:0; color:var(--ink); text-wrap:balance; }
.sf-q b { font-weight:700; }
.sf-q .req { color:var(--ink2); margin-inline-start:2px; }
.sf-q .sf-opt-tag { font-size:.55em; font-weight:400; color:var(--muted); white-space:nowrap; }
.sf-sec { font-size:14px; color:var(--muted); margin-bottom:12px; letter-spacing:.02em; }
.sf-help { margin:12px auto 0; font-size:18px; line-height:1.55; color:var(--muted); max-width:640px; text-wrap:balance; }
.sf-body { margin:30px auto 0; max-width:640px; }
.sf-hint { margin-top:12px; font-size:14.5px; color:var(--muted); }
.sf-other { margin:12px auto 0; max-width:560px; }
.sf-other .sf-input { font-size:19px; }
.sf-note { margin:16px auto 0; max-width:560px; background:var(--paper); border:1px solid var(--line); border-radius:6px; padding:10px 14px; text-align:start; }
.sf-note textarea.sf-input { font-size:16px; min-height:70px; border-bottom:0; box-shadow:none; padding:4px 0; }
.sf-link { border:0; background:none; color:var(--deep); font-size:14px; font-weight:600; cursor:pointer; padding:8px 0; min-height:40px; display:inline-flex; align-items:center; gap:6px; }
.sf-link:hover { text-decoration:underline; }
.sf-combo { position:relative; }
.sf-combo .sf-input { padding-inline-end:36px; }
.sf-combo-x, .sf-combo-arrow { position:absolute; inset-inline-end:2px; top:50%; transform:translateY(-50%); width:34px; height:34px; border:0; background:none; color:var(--muted); font-size:22px; line-height:1; cursor:pointer; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; }
.sf-combo-x:hover, .sf-combo-arrow:hover { background:var(--tint2); color:var(--deep); }
.sf-combo-list mark { background:var(--tint2); color:var(--deep); border-radius:3px; padding:0 1px; }
.sf-combo-list li.pop { font-weight:600; }
.sf-combo-list li.first-after-pop { border-top:1px solid var(--line); margin-top:4px; padding-top:12px; }
.sf-combo-sec { display:block; font-size:11px; letter-spacing:.08em; color:var(--muted); font-weight:600; margin:-4px 0 4px; }
.sf-combo-empty { padding:11px 12px; font-size:14px; color:var(--muted); cursor:default; }
.sf-combo-list { position:absolute; top:100%; inset-inline:0; z-index:20; margin:4px 0 0; padding:4px; list-style:none; background:var(--paper); border:1px solid var(--line2); border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,.12); text-align:start; max-height:min(320px, 45vh); overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
.sf-combo-list li { padding:11px 12px; border-radius:4px; font-size:16px; cursor:pointer; min-height:42px; }
.sf-combo-list li.on { background:var(--tint2); color:var(--ink); }
.sf-stage-done { padding:0; }
.sf-done-wrap { width:100%; }
.sf-resumed { margin:0 auto 14px; max-width:560px; font-size:13px; color:var(--deep); background:var(--tint2); border-radius:6px; padding:8px 12px; }
.sf-bigselect-wrap { position:relative; max-width:420px; margin:0 auto; }
.sf-bigselect { width:100%; appearance:none; -webkit-appearance:none; font-family:inherit; font-size:22px; font-weight:600; color:var(--ink); background:var(--paper); border:2px solid var(--line2); border-radius:10px; padding:16px 52px 16px 20px; min-height:64px; cursor:pointer; text-align:center; text-align-last:center; transition:border-color .15s, box-shadow .15s; }
[dir="rtl"] .sf-bigselect { padding:16px 20px 16px 52px; }
.sf-bigselect:focus { outline:none; border-color:var(--deep); box-shadow:0 0 0 3px var(--tint2); }
.sf-bigselect:invalid, .sf-bigselect option[value=""] { color:var(--muted); }
.sf-bigselect-arrow { position:absolute; top:50%; inset-inline-end:18px; transform:translateY(-50%); pointer-events:none; color:var(--deep); display:inline-flex; }
.sf-select-wrap { margin:14px auto 0; display:flex; align-items:center; justify-content:center; gap:10px; font-size:13.5px; color:var(--muted); }
.sf-select { font-size:16px; padding:10px 12px; min-height:44px; border:1px solid var(--line2); border-radius:6px; background:#fff; color:var(--ink); min-width:120px; }
.sf-presets { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:6px; margin:14px auto 0; font-size:13px; color:var(--muted); }
.sf-linked { display:flex; align-items:center; justify-content:center; gap:16px; margin:0 auto 16px; padding:10px 16px; background:var(--paper); border:1px solid var(--line); border-radius:8px; width:fit-content; }
.sf-linked .lbl { font-size:15px; font-weight:600; }
.sf-linked .ctl { display:flex; align-items:center; gap:10px; }
.sf-linked .ctl b { min-width:30px; text-align:center; font-size:20px; font-variant-numeric:tabular-nums; }
.sf-date { display:flex; gap:8px; }
.sf-date label { flex:1; display:flex; flex-direction:column; gap:2px; text-align:start; }
.sf-date small { font-size:11px; color:var(--muted); letter-spacing:.04em; }
.sf-date select { font-size:16px; padding:10px 8px; min-height:44px; border:1px solid var(--line2); border-radius:6px; background:#fff; color:var(--ink); width:100%; }
.sf-date.is-err select { border-color:var(--err); }
.sf-foot { position:fixed; bottom:12px; inset-inline:0; display:flex; justify-content:center; align-items:center; gap:8px; pointer-events:none; z-index:50; }
.sf-count { font-size:13px; color:var(--ink2); font-variant-numeric:tabular-nums; background:rgba(255,255,255,.85); backdrop-filter:blur(6px); border:1px solid var(--line); border-radius:20px; padding:6px 12px; }

/* ── inputs ────────────────────────────────────────────────────────────── */
.sf-input { width:100%; font-size:clamp(20px, 2.6vw, 30px); font-weight:400; padding:8px 0; border:0; border-bottom:1px solid var(--line2); background:transparent; color:var(--ink); border-radius:0; transition:border-color .2s, box-shadow .2s; text-align:center; }
.sf-input::placeholder { color:#A8A7AE; }
.sf-input:focus { outline:none; border-bottom-color:var(--ink); box-shadow:0 1px 0 0 var(--ink); }
.sf-input.is-err { border-bottom-color:var(--err); box-shadow:0 1px 0 0 var(--err); }
textarea.sf-input { resize:none; line-height:1.5; font-size:clamp(17px,2vw,22px); min-height:96px; text-align:start; }
.sf-input-wrap { position:relative; display:flex; align-items:center; gap:12px; }
.sf-unit { font-size:16px; color:var(--muted); white-space:nowrap; padding-bottom:4px; }

.sf-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px 22px; }
.sf-grid .full { grid-column:1 / -1; }
.sf-field { text-align:start; }
.sf-field label { display:block; font-size:14px; font-weight:600; letter-spacing:.02em; color:var(--ink2); margin-bottom:0; }
.sf-field label i { color:var(--deep); font-style:normal; margin-inline-start:3px; }
.sf-field .sf-input { font-size:20px; padding:8px 0; text-align:start; }
.sf-field .sf-unit { font-size:13px; }

/* ── choice / multi (Typeform-style grey boxes with key badges) ────────── */
.sf-opts { display:flex; flex-direction:column; gap:9px; align-items:stretch; width:min(100%, 540px); margin:0 auto; }
.sf-opts.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(190px, 1fr)); width:100%; }
.sf-opts.compact { display:grid; grid-template-columns:repeat(auto-fill, minmax(84px, 1fr)); width:100%; }
.sf-opts.compact .sf-opt { justify-content:center; font-weight:600; font-size:19px; }
.sf-opts.big { grid-template-columns:repeat(2, minmax(0, 1fr)); max-width:560px; margin:0 auto; }
.sf-opts.big .sf-opt { min-height:96px; font-size:21px; font-weight:600; justify-content:center; background:var(--paper); border-width:2px; }
.sf-opts.big .sf-opt.on { background:var(--tint2); }
.sf-opt { display:flex; align-items:center; gap:12px; width:100%; padding:11px 14px; border:1px solid var(--line2); border-radius:5px; background:var(--box); color:var(--ink); font-size:18px; font-weight:400; text-align:start; cursor:pointer; transition:background .12s, border-color .12s, box-shadow .12s; min-height:52px; }
.sf-opt .lbl { flex:1; }
.sf-opt:hover { background:var(--boxHover); }
.sf-opt.on { background:var(--tint2); border-color:var(--deep); box-shadow:0 0 0 1px var(--deep) inset; }
.sf-opt.on.flash { animation:sfFlash .32s ease; }
@keyframes sfFlash { 0%{background:var(--tint2)} 50%{background:#CCD2F1} 100%{background:var(--tint2)} }
.sf-key { flex:none; width:22px; height:22px; border-radius:3px; border:1px solid #B9B9C0; background:#fff; color:var(--ink2); font-size:11px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; transition:all .12s; }
.sf-opt.on .sf-key { background:var(--deep); border-color:var(--deep); color:#fff; }
.sf-opt .sf-check { margin-inline-start:auto; padding-inline-start:10px; width:auto; height:16px; color:var(--deep); opacity:0; transition:opacity .15s; flex:none; display:inline-flex; }
.sf-opt.on .sf-check { opacity:1; }
.sf-box { width:18px; height:18px; border-radius:3px; border:1px solid #B9B9C0; flex:none; display:inline-flex; align-items:center; justify-content:center; background:#fff; transition:all .12s; margin-inline-start:auto; }
.sf-opt .sf-box { margin-inline-start:auto; }
.sf-opt.on .sf-box { background:var(--deep); border-color:var(--deep); }
.sf-box svg { opacity:0; color:#fff; }
.sf-opt.on .sf-box svg { opacity:1; }

/* ── counters / matrix / toggles ───────────────────────────────────────── */
.sf-counters { display:flex; flex-wrap:wrap; justify-content:center; gap:12px; }
.sf-counter { display:flex; flex-direction:column; align-items:center; gap:10px; padding:16px 22px; background:var(--paper); border:1px solid var(--line); border-radius:10px; min-width:200px; }
.sf-counter .lbl { font-size:16px; font-weight:600; color:var(--ink2); }
.sf-counter .ctl { display:flex; align-items:center; gap:14px; }
.sf-counter .ctl b { min-width:44px; text-align:center; font-size:30px; font-weight:700; font-variant-numeric:tabular-nums; }
.sf-round { width:40px; height:40px; border-radius:4px; border:1px solid var(--line2); background:var(--box); color:var(--ink); font-size:20px; line-height:1; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all .12s; }
.sf-round:hover { background:var(--boxHover); }
.sf-round:disabled { opacity:.35; cursor:default; }
.sf-mrow { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:11px 0; border-bottom:1px solid var(--line); flex-wrap:wrap; }
.sf-mrow:last-child { border-bottom:0; }
.sf-mrow .lbl { font-size:18px; flex:1 1 220px; text-align:start; }
.sf-mrow.is-err .lbl { color:var(--err); }
.sf-scale { display:flex; gap:6px; flex-wrap:wrap; }
.sf-pill { padding:8px 14px; min-height:40px; border-radius:4px; border:1px solid var(--line2); background:var(--box); color:var(--ink2); font-size:15px; font-weight:500; cursor:pointer; transition:all .12s; white-space:nowrap; }
.sf-pill:hover { background:var(--boxHover); color:var(--ink); }
.sf-pill.on { background:var(--ink); border-color:var(--ink); color:#fff; }
.sf-pill.on.purple { background:var(--deep); border-color:var(--deep); }
.sf-seg { display:inline-flex; border:1px solid var(--line2); border-radius:4px; overflow:hidden; }
.sf-seg button { padding:8px 16px; min-height:40px; border:0; background:var(--box); color:var(--ink2); font-size:13.5px; font-weight:600; cursor:pointer; transition:all .12s; }
.sf-seg button.on { background:var(--ink); color:#fff; }
.sf-seg button.on.yes { background:var(--deep); }

/* ── upload ────────────────────────────────────────────────────────────── */
.sf-drop { border:1px dashed var(--line2); border-radius:6px; padding:30px 20px; text-align:center; cursor:pointer; transition:all .2s; background:var(--paper); }
.sf-drop:hover, .sf-drop.over { border-color:var(--deep); background:var(--tint); }
.sf-drop .ic { width:42px; height:42px; border-radius:6px; background:var(--tint2); color:var(--deep); display:inline-flex; align-items:center; justify-content:center; margin-bottom:10px; }
.sf-drop h4 { margin:0; font-size:16px; font-weight:600; }
.sf-drop p { margin:6px 0 0; font-size:13px; color:var(--muted); }
.sf-files { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px; margin-top:16px; }
.sf-file { border:1px solid var(--line); border-radius:6px; overflow:hidden; background:var(--paper); position:relative; }
.sf-file .th { height:96px; background:var(--tint); display:flex; align-items:center; justify-content:center; color:var(--deep); overflow:hidden; }
.sf-file .th img { width:100%; height:100%; object-fit:cover; display:block; }
.sf-file .th.vid { position:relative; background:#111; }
.sf-file .th .play { position:absolute; inset:0; margin:auto; width:34px; height:34px; border-radius:50%; background:rgba(0,0,0,.55); color:#fff; font-size:13px; display:flex; align-items:center; justify-content:center; padding-inline-start:3px; pointer-events:none; }
.sf-file .nm { padding:7px 10px 3px; font-size:12px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sf-file .st { padding:0 10px 8px; font-size:12.5px; color:var(--muted); display:flex; align-items:center; justify-content:space-between; gap:6px; }
.sf-file .st.ok { color:var(--ok); } .sf-file .st.err { color:var(--err); }
.sf-file .bar { height:3px; background:var(--line); } .sf-file .bar i { display:block; height:100%; background:var(--deep); transition:width .2s; }
.sf-file .x { position:absolute; top:6px; inset-inline-end:6px; width:30px; height:30px; border-radius:4px; border:0; background:rgba(38,36,43,.75); color:#fff; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; justify-content:center; }
.sf-file .x:hover { background:var(--err); }
.sf-file select { font-size:12.5px; border:1px solid var(--line); border-radius:4px; padding:5px 4px; min-height:32px; color:var(--ink2); background:#fff; max-width:100%; }
.sf-tags { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }

/* ── actions ───────────────────────────────────────────────────────────── */
.sf-actions { display:flex; align-items:center; justify-content:center; gap:12px; margin:30px auto 0; flex-wrap:wrap; }
.sf-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-width:150px; min-height:48px; padding:12px 26px; border-radius:6px; border:1px solid var(--ink); background:var(--ink); color:#fff; font-size:17px; font-weight:700; cursor:pointer; transition:all .15s; text-decoration:none; }
[dir="rtl"] .sf-ico-back, [dir="rtl"] .sf-ico-fwd { transform:scaleX(-1); }
.sf-btn:hover { background:var(--deep); border-color:var(--deep); }
.sf-btn:disabled { opacity:.5; cursor:default; }
.sf-btn.ghost { background:var(--paper); color:var(--ink); border-color:var(--line2); }
.sf-btn.ghost:hover { background:var(--tint); border-color:var(--deep); color:var(--deep); }
.sf-btn.big { padding:13px 28px; font-size:17px; }
.sf-btn.wa { background:#25D366; border-color:#25D366; }
.sf-btn.wa:hover { background:#1EBE5A; border-color:#1EBE5A; }
.sf-enter { font-size:13px; color:var(--muted); margin-top:12px; }
.sf-enter b { color:var(--ink2); font-weight:700; }
.sf-err { display:flex; align-items:center; justify-content:center; gap:8px; margin:14px auto 0; max-width:640px; color:var(--err); font-size:14.5px; font-weight:500; background:#FDECEC; border:1px solid #F3C4C4; border-radius:4px; padding:9px 12px; }


/* ── welcome / intro / review / done ───────────────────────────────────── */
.sf-welcome { text-align:center; max-width:620px; margin:0 auto; }
.sf-welcome .logo { height:130px; width:auto; margin:0 auto 18px; display:block; }
.sf-welcome h1 { font-size:clamp(30px, 4.8vw, 42px); font-weight:700; margin:0 0 12px; letter-spacing:-.01em; line-height:1.2; }
.sf-welcome p { font-size:18px; color:var(--ink2); line-height:1.6; margin:0 auto; max-width:460px; }
.sf-welcome-actions { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:28px; }
.sf-later-btn { border:1px solid transparent; background:transparent; color:var(--muted); font-family:inherit; font-size:13px; font-weight:600; padding:6px 10px; min-height:40px; border-radius:8px; cursor:pointer; }
.sf-later-btn:hover { color:var(--deep); background:var(--tint2); }
.sf-later-inline { display:none; margin:14px auto 0; border:0; background:none; color:var(--muted); font-family:inherit; font-size:13.5px; font-weight:600; padding:8px 12px; min-height:40px; cursor:pointer; text-decoration:underline; text-underline-offset:3px; }
.sf-later { position:fixed; inset:0; z-index:200; background:rgba(38,36,43,.45); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; padding:18px; }
.sf-later-card { width:min(100%, 480px); background:var(--paper); border-radius:16px; padding:26px 22px 18px; text-align:center; box-shadow:0 30px 80px rgba(0,0,0,.25); }
.sf-later-ok { width:48px; height:48px; border-radius:50%; background:var(--tint2); color:var(--deep); display:inline-flex; align-items:center; justify-content:center; margin-bottom:10px; }
.sf-later-card h3 { margin:0 0 6px; font-size:22px; }
.sf-later-card p { margin:0 0 14px; color:var(--muted); font-size:14.5px; line-height:1.55; }
.sf-later-link { font-size:12.5px; color:var(--ink2); background:var(--canvas); border:1px solid var(--line); border-radius:8px; padding:10px 12px; word-break:break-all; margin-bottom:12px; }
.sf-later-actions { display:flex; flex-direction:column; gap:8px; margin-bottom:10px; }
.sf-later-actions .sf-btn { width:100%; justify-content:center; }
.sf-later-actions .sf-btn.wa { background:#25D366; border-color:#25D366; color:#fff; text-decoration:none; }
.sf-later-actions .sf-btn.wa:hover { background:#1EBE5A; border-color:#1EBE5A; }
.sf-later-card .sf-link { margin-top:6px; }
.sf-other-device { margin:26px auto 0; max-width:460px; text-align:center; }
.sf-other-device summary { cursor:pointer; color:var(--deep); font-weight:600; font-size:14px; list-style:none; padding:8px; min-height:40px; display:inline-flex; align-items:center; }
.sf-other-device summary::-webkit-details-marker { display:none; }
.sf-other-device p { font-size:13.5px; color:var(--muted); margin:4px 0 10px; }
.sf-other-form { display:flex; gap:8px; }
.sf-other-form input { flex:1; min-width:0; font-family:inherit; font-size:16px; padding:10px 12px; min-height:48px; border:1px solid var(--line2); border-radius:10px; background:var(--paper); text-align:center; }
.sf-other-form .sf-btn { min-height:48px; padding-inline:16px; }
.sf-other-ok { display:inline-flex; align-items:center; gap:8px; color:var(--deep); background:var(--tint2); border-radius:8px; padding:10px 14px; font-size:14px; margin-top:8px; text-align:start; }
.sf-welcome .sf-draftbox { display:flex; flex-direction:column; align-items:center; text-align:center; gap:0; }
.sf-draftbox-h { display:flex; align-items:center; justify-content:center; gap:8px; font-weight:700; }
.sf-draftbox b { display:block; margin-top:6px; font-size:16px; color:var(--ink); }
.sf-draftbox small { display:block; margin-top:2px; font-size:13px; color:var(--muted); }
.sf-draftbox { margin:0 auto 20px; max-width:420px; padding:12px 16px; border-radius:6px; background:var(--tint2); font-size:14px; color:var(--ink); display:flex; align-items:center; gap:10px; justify-content:center; }
.sf-intro .n { font-size:12px; font-weight:700; color:var(--deep); letter-spacing:.14em; margin-bottom:10px; }
.sf-intro h2 { font-size:clamp(26px, 4vw, 36px); font-weight:700; margin:0 0 10px; letter-spacing:-.01em; line-height:1.2; }
.sf-intro p { font-size:17px; color:var(--ink2); line-height:1.55; margin:0; max-width:540px; }
.sf-intro .line { width:48px; height:3px; background:var(--deep); border-radius:2px; margin:18px 0 22px; }
.sf-intro { text-align:center; }
.sf-intro .line { margin:18px auto 22px; }
.sf-intro p { margin:0 auto; }
/* ── review: property file ── */
.sf-review { text-align:start; max-width:720px; margin:0 auto; }
.sf-rhero { background:linear-gradient(135deg, #26242B 0%, #33324A 100%); color:#fff; border-radius:16px; padding:28px 28px 24px; text-align:center; position:relative; overflow:hidden; box-shadow:0 18px 50px rgba(38,36,43,.18); }
.sf-rhero::after { content:''; position:absolute; inset:auto -40px -60px auto; width:220px; height:220px; border-radius:50%; background:radial-gradient(circle, rgba(132,144,216,.35), transparent 70%); pointer-events:none; }
.sf-rk { font-size:11.5px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:var(--purple); margin-bottom:8px; }
.sf-rhero h2 { font-size:clamp(24px, 3.2vw, 34px); font-weight:700; margin:0; color:#fff; letter-spacing:-.01em; }
.sf-facts { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:18px; }
.sf-fact { min-width:104px; padding:10px 14px; border-radius:8px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); display:flex; flex-direction:column; gap:2px; align-items:center; }
.sf-fact small { font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.6); }
.sf-fact b { font-size:18px; font-weight:700; font-variant-numeric:tabular-nums; }
.sf-fact.hi { background:var(--deep); border-color:var(--deep); }
.sf-rsub { text-align:center; margin:12px 0 14px; color:var(--muted); font-size:14px; }
.sf-rline { text-align:center; margin:8px 0 0; color:var(--deep); font-size:15.5px; font-weight:600; letter-spacing:.01em; }
.sf-rgrid { display:flex; flex-direction:column; gap:10px; }
.sf-rsec { border:1px solid var(--line); border-radius:14px; padding:0 20px 6px; background:var(--paper); box-shadow:0 4px 18px rgba(38,36,43,.04); }
.sf-rsec h3 { margin:0; }
.sf-rsec h3 button { width:100%; display:flex; align-items:center; gap:10px; font-size:15px; font-weight:700; color:var(--ink); font-family:inherit; background:none; border:0; cursor:pointer; padding:15px 0 13px; text-align:start; }
.sf-rsec h3 button span { flex:1; }
.sf-rsec h3 button small { font-size:12px; font-weight:500; color:var(--muted); }
.sf-rsec h3 button svg { flex:none; color:var(--muted); transition:transform .2s; }
.sf-rsec.open h3 button { border-bottom:1px solid var(--line); }
.sf-rsec.open h3 button svg { transform:rotate(180deg); }
.sf-ractions { display:flex; justify-content:center; gap:10px; flex-wrap:wrap; margin:18px 0 0; }
.sf-editbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin:0 auto 18px; max-width:640px; padding:10px 14px; border-radius:10px; background:var(--tint2); color:var(--deep); font-size:14px; text-align:start; }
.sf-editbar button { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--deep); background:var(--paper); color:var(--deep); font-family:inherit; font-weight:700; font-size:13.5px; padding:8px 12px; min-height:40px; border-radius:8px; cursor:pointer; }
.sf-jump { pointer-events:auto; display:inline-flex; align-items:center; gap:6px; border:1px solid var(--deep); background:var(--deep); color:#fff; font-family:inherit; font-weight:700; font-size:13px; padding:6px 12px; border-radius:20px; cursor:pointer; box-shadow:0 6px 18px rgba(63,78,176,.25); }
.sf-rsec h3 button i { width:24px; height:24px; border-radius:50%; background:var(--ink); color:#fff; font-size:11.5px; font-weight:700; font-style:normal; display:inline-flex; align-items:center; justify-content:center; }
.sf-ritem { display:grid; grid-template-columns:180px 1fr auto; align-items:baseline; gap:14px; padding:10px 0; border-top:1px solid var(--line); }
.sf-ritem:first-of-type { border-top:0; }
.sf-ritem .k { font-size:13.5px; color:var(--muted); line-height:1.45; letter-spacing:.01em; }
.sf-ritem .v { font-size:15.5px; line-height:1.5; white-space:pre-wrap; word-break:break-word; color:var(--ink); }
.sf-ritem button { border:1px solid transparent; background:none; color:var(--deep); font-size:12.5px; font-weight:600; cursor:pointer; padding:3px 8px; min-height:28px; border-radius:6px; opacity:0; transition:opacity .15s; }
.sf-ritem:hover button, .sf-ritem button:focus-visible { opacity:1; }
.sf-ritem button:hover { background:var(--tint); }
@media (hover:none) { .sf-ritem button { opacity:1; border-color:var(--line2); } }
.sf-chips { display:flex; flex-wrap:wrap; gap:5px; }
.sf-chips em { font-style:normal; font-size:13px; padding:3px 9px; border-radius:20px; background:var(--tint2); color:var(--ink); }
.sf-vnote { display:block; margin-top:6px; font-size:13px; color:var(--ink2); line-height:1.45; }
/* ── story: a designed document ── */
.sf-story { text-align:center; max-width:780px; margin:0 auto; }
.sf-story h2 { font-size:clamp(26px, 3.4vw, 38px); font-weight:700; margin:0; letter-spacing:-.015em; line-height:1.2; text-wrap:balance; }
.sf-paper { text-align:start; background:var(--paper); border:1px solid var(--line); border-radius:18px; padding:0; overflow:hidden; box-shadow:0 22px 60px rgba(38,36,43,.10); margin-top:22px; }
.sf-paper-h { display:flex; align-items:center; gap:14px; padding:20px clamp(20px, 4vw, 40px); background:linear-gradient(135deg, #F8F8FB 0%, #EEF0FA 100%); border-bottom:1px solid var(--line); }
.sf-paper-logo { height:36px; width:auto; }
.sf-paper-t { min-width:0; }
.sf-paper-h b { display:block; font-size:16.5px; letter-spacing:-.005em; }
.sf-paper-h small { display:block; font-size:13px; color:var(--muted); margin-top:2px; }
.sf-paper-h .sf-link { margin-inline-start:auto; flex:none; }
.sf-facts.light { margin:0; padding:16px clamp(20px, 4vw, 40px) 4px; justify-content:flex-start; }
.sf-facts.light .sf-fact { background:var(--canvas); border-color:var(--line); color:var(--ink); }
.sf-facts.light .sf-fact small { color:var(--muted); }
.sf-facts.light .sf-fact.hi { background:var(--deep); border-color:var(--deep); color:#fff; }
.sf-facts.light .sf-fact.hi small { color:rgba(255,255,255,.7); }
.sf-paper-body { padding:8px clamp(20px, 4vw, 40px) 26px; }
.sf-para { padding:22px 0; border-bottom:1px solid var(--line); }
.sf-para:last-child { border-bottom:0; }
.sf-para h3 { display:flex; align-items:center; gap:10px; margin:0 0 10px; font-size:12.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--deep); font-weight:700; }
.sf-para h3 span { flex:none; width:26px; height:26px; border-radius:50%; background:var(--tint2); color:var(--deep); font-size:11px; letter-spacing:0; display:inline-flex; align-items:center; justify-content:center; font-variant-numeric:tabular-nums; }
.sf-para p { margin:0; font-size:17.5px; line-height:1.85; color:var(--ink); }
.sf-para:first-of-type { padding-top:18px; }
.sf-para:first-of-type p { font-size:20px; line-height:1.7; font-weight:500; padding-inline-start:18px; border-inline-start:3px solid var(--deep); }
.sf-paper-f { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:14px clamp(20px, 4vw, 40px) 18px; border-top:1px solid var(--line); background:#FAFAFB; font-size:12.5px; color:var(--muted); }
.sf-privacy-line { margin-top:16px; font-size:13.5px; color:var(--muted); }
.sf-missing { border:1px solid #F3C4C4; background:#FDECEC; border-radius:6px; padding:12px 16px; margin-bottom:14px; }
.sf-missing h4 { margin:0 0 6px; font-size:14.5px; color:var(--err); }
.sf-missing button { display:block; border:0; background:none; color:var(--deep); font-size:15px; padding:8px 0; min-height:40px; cursor:pointer; text-align:start; }
.sf-consent { display:flex; gap:12px; align-items:flex-start; text-align:start; padding:14px 16px; border:1px solid var(--line2); border-radius:6px; cursor:pointer; margin-top:20px; font-size:14.5px; line-height:1.5; color:var(--ink2); background:var(--box); transition:all .12s; }
.sf-consent:hover { background:var(--boxHover); }
.sf-consent.on { border-color:var(--deep); background:var(--tint2); color:var(--ink); }
.sf-consent .sf-box { margin:3px 0 0; }
.sf-done { text-align:center; max-width:540px; margin:0 auto; }
.sf-done .ck { width:76px; height:76px; border-radius:50%; background:var(--tint2); color:var(--deep); display:inline-flex; align-items:center; justify-content:center; margin-bottom:20px; animation:sfPop .5s cubic-bezier(.16,1,.3,1); }
@keyframes sfPop { from{transform:scale(.5); opacity:0} to{transform:scale(1); opacity:1} }
.sf-done h1 { font-size:clamp(28px, 4.4vw, 40px); font-weight:700; margin:0 0 10px; }
.sf-done p { font-size:17px; color:var(--ink2); line-height:1.6; margin:0; }
.sf-ref { display:inline-flex; flex-direction:column; align-items:center; gap:4px; margin:24px 0; padding:12px 26px; border:1px dashed var(--deep); border-radius:6px; background:var(--paper); }
.sf-ref small { font-size:11.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--deep); font-weight:700; }
.sf-ref b { font-size:24px; font-weight:700; letter-spacing:.06em; font-variant-numeric:tabular-nums; }
.sf-ref button { border:0; background:none; color:var(--deep); font-size:12.5px; cursor:pointer; font-weight:600; }

/* ── mobile ────────────────────────────────────────────────────────────── */
@media (max-width: 720px) {
  .sf-top { justify-content:center; padding:0 14px; min-height:56px; }
  .sf-brand { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); }
  .sf-top-right { position:static; }
  .sf-top .ps-share { position:absolute; inset-inline-start:12px; top:8px; transform:none; }   /* no transform: the fixed menu below must position against the viewport */
  .sf-top .sf-lang { position:absolute; inset-inline-end:8px; top:50%; transform:translateY(-50%); }
  .sf-stepper { display:none; }
  .sf-logo { height:32px; }
  .sf-brandtxt { display:none; }
  .sf-saved { display:none; }
  .sf-lang { padding:8px 8px; min-height:44px; font-size:13px; }
  .sf-top .ps-btn.sm { min-height:40px; padding:6px 11px; font-size:13px; font-weight:600; gap:6px; border-color:var(--line2); background:var(--paper); color:var(--ink2); box-shadow:none; }
  .sf-top .ps-btn.sm svg { width:14px; height:14px; }
  .sf-root .sf-top .ps-share-menu, [dir="rtl"] .sf-root .sf-top .ps-share-menu { position:fixed; top:64px; inset-inline:12px; transform:none; min-width:0; border-radius:12px; box-shadow:0 16px 40px rgba(0,0,0,.18); }
  .sf-stage { padding:76px 18px 72px; }
  .sf-opt { min-height:50px; font-size:17px; }
  .sf-opts { gap:10px; }
  .sf-pill { padding:10px 14px; min-height:44px; font-size:15px; white-space:normal; text-align:center; }
  .sf-scale { gap:8px; }
  .sf-seg button { min-height:44px; }
  .sf-file .x { width:34px; height:34px; }
  .sf-round { width:44px; height:44px; }
  .sf-file select { font-size:16px; }
  .sf-field .sf-input { font-size:16px; min-height:44px; padding:10px 0; }
  .sf-btn { min-height:50px; font-size:17px; }
  .sf-foot { bottom:8px; }
  .sf-top .sf-later-btn { display:none; }
  .sf-later-inline { display:inline-block; }
  .sf-q { font-size:22px; }
  .sf-help { font-size:16px; }
  .sf-actions { gap:8px; }
  .sf-actions .sf-btn { flex:1 1 40%; min-width:0; }
  .sf-actions .sf-btn.big { flex-basis:100%; }
  .sf-ritem { grid-template-columns:1fr auto; grid-template-areas:'k b' 'v v'; gap:2px 10px; align-items:center; padding:9px 0; }
  .sf-ritem .k { grid-area:k; }
  .sf-ritem .v { grid-area:v; }
  .sf-ritem button { grid-area:b; margin:0; justify-self:end; }
  .sf-rsec { padding:0 14px 4px; }
  .sf-rhero { padding:20px 16px; }
  .sf-fact { min-width:84px; padding:8px 10px; }
  .sf-paper { border-radius:14px; }
  .sf-paper-h, .sf-paper-body, .sf-paper-f, .sf-facts.light { padding-inline:16px; }
  .sf-para p { font-size:16.5px; line-height:1.8; }
  .sf-para:first-of-type p { font-size:18px; padding-inline-start:14px; }
  .sf-mrow { flex-direction:column; align-items:center; text-align:center; gap:8px; }
  .sf-mrow .lbl { flex-basis:auto; }
  .sf-scale { justify-content:center; }
  .sf-tags { justify-content:center; }
  .sf-welcome-actions .sf-btn { width:100%; justify-content:center; }
  .sf-welcome h1 { font-size:27px; }
  .sf-welcome p { font-size:16px; }
  .sf-grid { grid-template-columns:1fr; }
  .sf-opts { align-items:stretch; }
  .sf-opt { min-width:0; width:100%; }
  .sf-opts.grid { grid-template-columns:1fr; }
  .sf-counter .lbl { font-size:15.5px; }
  .sf-enter { display:none; }
  .sf-welcome .logo { height:110px; }
  .sf-btn { padding:11px 18px; }
}
@media (prefers-reduced-motion: reduce) { .sf-root * { animation:none !important; transition:none !important; } }
`

// ── icons (inline SVG keeps the page self-contained) ─────────────────────────
const IcoChevron = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
const IcoCheck = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
const IcoUp    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
const IcoDown  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
const IcoUpload = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>
const IcoFile  = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/></svg>
const IcoVideo = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
const IcoWarn  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
const IcoWa    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3C4.1 15 3.7 13.5 3.7 12c0-4.6 3.7-8.3 8.3-8.3s8.3 3.7 8.3 8.3-3.7 8.2-8.3 8.2z"/></svg>

const IcoGlobe = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>

const IcoBack = () => <svg className="sf-ico-back" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
const IcoFwd = () => <svg className="sf-ico-fwd" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
const IcoCopy = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>

// Bold the key phrase of a question, Typeform style ("what's **the main thing**…")
function Emph({ text, phrase }) {
  if (!phrase) return text
  const i = text.indexOf(phrase)
  if (i < 0) return text
  return <>{text.slice(0, i)}<b>{phrase}</b>{text.slice(i + phrase.length)}</>
}

// Top stepper: every section with its number, done sections ticked, current highlighted.
function Stepper({ curIdx, lang, answers }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.querySelector('.sf-step.cur')?.scrollIntoView({ inline: 'center', block: 'nearest' }) }, [curIdx])
  return (
    <nav className="sf-stepper" ref={ref} aria-label="sections">
      {SECTIONS.map((s, i) => (
        <span key={s.id} className={`sf-step${i < curIdx ? ' done' : i === curIdx ? ' cur' : ''}${Math.abs(i - curIdx) === 1 ? ' near' : ''}`} aria-current={i === curIdx ? 'step' : undefined}>
          <i>{i < curIdx ? <IcoCheck size={10}/> : s.n}</i>
          <b>{sectionText(s, 'title', lang, answers || {})}</b>
          {i < SECTIONS.length - 1 && <em/>}
        </span>
      ))}
    </nav>
  )
}

const LOGO_SRC = '/logo-black.svg'
const stepVariants = {
  enter: d => ({ y: d > 0 ? 26 : -26, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: d => ({ y: d > 0 ? -18 : 18, opacity: 0 }),
}
// snappy: the exit is very short, the enter settles in ~180ms
const stepTransition = { duration: .18, ease: [.2, .8, .2, 1] }

// ═════════════════════════════════════════════════════════════════════════════
export default function SellerForm() {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('afik_lang') === 'en' ? 'en' : 'he' } catch { return 'he' } })
  const t = T[lang]
  const rtl = lang === 'he'

  const [phase, setPhase] = useState('welcome')        // welcome | form | done
  const [answers, setAnswers] = useState({})
  const [cur, setCur] = useState(STEPS[0].id)
  const [dir, setDir] = useState(1)
  const [err, setErr] = useState(null)
  const [draft, setDraft] = useState(null)
  const [savedTick, setSavedTick] = useState(0)
  const [editReturn, setEditReturn] = useState(false)
  const [resumedLocal, setResumedLocal] = useState(false)   // came back on the same device → one reassuring line
  const [laterOpen, setLaterOpen] = useState(false)     // came from the review to fix one answer → "Continue" goes back there
  const [reachedReview, setReachedReview] = useState(false) // once the summary was seen, a shortcut to it stays available
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [result, setResult] = useState(null)
  const sidRef = useRef(null)
  const pendingSid = useRef(uid())   // id used by "share form" before the form was started; begin() adopts it
  const [linkState, setLinkState] = useState(null)   // null | loading | resumed | fresh | submitted
  const [cloudSaved, setCloudSaved] = useState(false)
  const startedAt = useRef(Date.now())
  const stageRef = useRef(null)

  // ── page setup: fonts, title, body background, direction ─────────────────
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_HREF; document.head.appendChild(l)
    }
    const prevBg = document.body.style.background
    document.body.style.background = '#fff'
    document.documentElement.style.opacity = '1'
    const linkSid = new URLSearchParams(window.location.search).get('d')
    if (linkSid && /^[\w-]{8,64}$/.test(linkSid)) {
      // Shared / resume link: the draft lives on the server under this id
      sidRef.current = linkSid
      setLinkState('loading')
      fetch(`${API}/api/seller-form?action=draft&sid=${encodeURIComponent(linkSid)}`)
        .then(r => r.json().then(d => ({ status: r.status, d })))
        .then(({ status, d }) => {
          if (status === 200 && d.ok && d.submitted) { setLinkState('submitted'); setResult({ ref: d.ref, token: d.token, url: `${window.location.origin}/newproperty/${d.token}` }); setPhase('done'); return }
          if (status === 200 && d.ok && d.draft) {
            const { __reached, ...restored } = d.draft.answers || {}
            setAnswers(restored); setReachedReview(!!__reached)
            if (d.draft.lang) setLang(d.draft.lang)
            setCur(d.draft.cur && STEPS.some(s => s.id === d.draft.cur) ? d.draft.cur : STEPS[0].id)
            setLinkState('resumed'); setPhase('form'); startedAt.current = Date.now()
            return
          }
          setLinkState('fresh')  // link to a brand-new form: keep the shared id so both people write to the same draft
        })
        .catch(() => setLinkState('fresh'))
    } else {
      const d = loadDraft()
      if (d) { setDraft(d); sidRef.current = d.sid || null }
    }
    return () => { document.body.style.background = prevBg }
  }, [])
  // Mobile keyboard: let the layout shrink with the keyboard (Chrome) and allow pinch-zoom; scroll the question into view on focus
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]')
    const prev = meta?.getAttribute('content')
    if (meta) meta.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content')
    const onFocus = e => {
      if (window.innerWidth > 720 || !stageRef.current?.contains(e.target)) return
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return
      setTimeout(() => {
        const q = stageRef.current?.querySelector('.sf-sec') || stageRef.current?.querySelector('.sf-qhead')
        if (!q) return
        const top = q.getBoundingClientRect().top + window.scrollY - 64
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      }, 320)
    }
    document.addEventListener('focusin', onFocus)
    return () => { document.removeEventListener('focusin', onFocus); if (meta && prev) meta.setAttribute('content', prev) }
  }, [])
  useEffect(() => {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
    document.title = lang === 'en' ? 'Property marketing form · Afik Hanahal' : 'טופס שיווק נכס · אפיק הנחל'
    try { localStorage.setItem('afik_lang', lang) } catch {}
  }, [lang, rtl])

  // ── derived ──────────────────────────────────────────────────────────────
  const visible = useMemo(() => visibleSteps(answers), [answers])
  const idx = Math.max(0, visible.findIndex(s => s.id === cur))
  const step = visible[idx] || visible[0]
  const total = visible.length
  const questionSteps = useMemo(() => visible.filter(s => !['intro', 'review'].includes(s.type)), [visible])
  const qNumber = questionSteps.findIndex(s => s.id === step?.id) + 1
  const section = SECTIONS.find(s => s.id === step?.section)
  const progress = phase === 'done' ? 100 : phase === 'welcome' ? 0 : Math.round((idx / Math.max(1, total - 1)) * 100)

  // keep `cur` on a visible step when conditional logic hides it
  useEffect(() => {
    if (phase !== 'form') return
    if (!visible.some(s => s.id === cur)) {
      const all = STEPS.findIndex(s => s.id === cur)
      const next = visible.find(s => STEPS.findIndex(x => x.id === s.id) > all) || visible[visible.length - 1]
      setCur(next.id)
    }
  }, [visible, cur, phase])

  // ── autosave ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'form') return
    const h = setTimeout(() => {
      saveDraft({ answers: stripFilesForDraft(answers), cur, sid: sidRef.current, lang, savedAt: Date.now(), v: SCHEMA_VERSION, reached: reachedReview })
      setSavedTick(x => x + 1)
    }, 500)
    return () => clearTimeout(h)
  }, [answers, cur, phase, lang, reachedReview])
  // Leaving the page (tab closed, app switched): push the latest answers right away
  const latestRef = useRef({})
  useEffect(() => { latestRef.current = { answers, cur, lang, reached: reachedReview } }, [answers, cur, lang, reachedReview])
  useEffect(() => {
    if (phase !== 'form') return
    const flush = () => {
      const { answers: a, cur: c, lang: l, reached } = latestRef.current
      if (!sidRef.current || !Object.keys(a || {}).length) return
      const clean = stripFilesForDraft(a); delete clean.__consent
      try { fetch(`${API}/api/seller-form?action=draft`, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: sidRef.current, answers: { ...clean, __reached: reached }, cur: c, lang: l, schemaVersion: SCHEMA_VERSION }) }).catch(() => {}) } catch {}
    }
    const onVis = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush); document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onVis) }
  }, [phase])
  // Server draft: survives a closed tab, a new device, and is what a shared partner continues from
  useEffect(() => {
    if (phase !== 'form' || !sidRef.current) return
    if (!Object.keys(answers).length) return
    const h = setTimeout(() => {
      const clean = stripFilesForDraft(answers); delete clean.__consent
      fetch(`${API}/api/seller-form?action=draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: sidRef.current, answers: { ...clean, __reached: reachedReview }, cur, lang, schemaVersion: SCHEMA_VERSION, ua: navigator.userAgent }) })
        .then(r => setCloudSaved(r.ok)).catch(() => setCloudSaved(false))
    }, 2500)
    return () => clearTimeout(h)
  }, [answers, cur, phase, lang])

  const setAnswer = useCallback((id, v) => {
    setErr(null)
    setAnswers(prev => ({ ...prev, [id]: typeof v === 'function' ? v(prev[id]) : v }))
  }, [])

  // ── navigation ───────────────────────────────────────────────────────────
  const goTo = useCallback((id, d = 1) => { setDir(d); setErr(null); setCur(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [])
  const reviewId = useMemo(() => (visible.find(s => s.type === 'review') || {}).id, [visible])
  const goNext = useCallback(() => {
    if (!step) return
    const e = validateStep(step, answers)
    if (e) { setErr(e); return }
    if (editReturn && reviewId && !['review', 'story'].includes(step.type)) { setEditReturn(false); goTo(reviewId, 1); return }
    if (idx < total - 1) goTo(visible[idx + 1].id, 1)
  }, [step, answers, idx, total, visible, goTo, editReturn, reviewId])
  const goReview = useCallback(() => { if (reviewId) { setEditReturn(false); goTo(reviewId, 1) } }, [reviewId, goTo])
  const editFromReview = useCallback(id => { setEditReturn(true); goTo(id, -1) }, [goTo])
  useEffect(() => { if (phase === 'form' && (step?.type === 'review' || step?.type === 'story')) { setReachedReview(true); setEditReturn(false) } }, [phase, step])
  const goPrev = useCallback(() => { if (idx > 0) goTo(visible[idx - 1].id, -1) }, [idx, visible, goTo])

  const begin = (resume) => {
    if (resume && draft) {
      setAnswers(draft.answers || {})
      setCur(draft.cur && STEPS.some(s => s.id === draft.cur) ? draft.cur : STEPS[0].id)
      if (draft.lang) setLang(draft.lang)
      setReachedReview(!!draft.reached)
      setResumedLocal(true)
    } else {
      clearDraft(); setAnswers({}); setCur(STEPS[0].id); if (linkState !== 'fresh') sidRef.current = null
    }
    if (!sidRef.current) sidRef.current = pendingSid.current
    startedAt.current = Date.now()
    setDir(1); setPhase('form')
    window.scrollTo({ top: 0 })
  }

  // ── keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'form') return
    const onKey = e => {
      const el = document.activeElement
      const inText = isEditable(el)
      const inTextarea = el?.tagName === 'TEXTAREA'
      if (e.key === 'Enter') {
        if (inTextarea && !(e.ctrlKey || e.metaKey)) return
        if (el?.tagName === 'A' || el?.tagName === 'SELECT') return
        if (el?.tagName === 'BUTTON') {
          // Navigation / action buttons keep their native Enter = click.
          if (el.closest('.sf-foot, .sf-top, .sf-editbar, .sf-ractions, .sf-review, .sf-story, .sf-intro, .sf-later, .sf-combo') || el.classList.contains('x') || el.classList.contains('sf-btn') || el.classList.contains('sf-link')) return
          // After a mouse click focus stays on the option button; Enter would re-toggle it instead of continuing.
          // An option that is not selected yet: let the click select it. Anything else: continue.
          const isOption = el.classList.contains('sf-opt') || el.classList.contains('sf-pill')
          if (isOption && !el.classList.contains('on') && el.getAttribute('aria-pressed') !== 'true' && el.getAttribute('aria-checked') !== 'true') return
          e.preventDefault(); el.blur(); goNext(); return
        }
        if (step.type === 'review' || step.type === 'story') return
        e.preventDefault(); goNext(); return
      }
      if (e.key === 'ArrowDown' && !inTextarea && el?.type !== 'number') { e.preventDefault(); goNext(); return }
      if (e.key === 'ArrowUp' && !inTextarea && el?.type !== 'number') { e.preventDefault(); goPrev(); return }
      if (!inText && (step.type === 'choice' || step.type === 'multi') && /^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const i = LETTERS.indexOf(e.key.toUpperCase())
        const opt = stepOpts(step, answers)[i]
        if (!opt) return
        e.preventDefault()
        if (step.type === 'choice') pickChoice(opt.v)
        else toggleMulti(opt.v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // focus the first input after each transition
  useEffect(() => {
    if (phase !== 'form') return
    const h = setTimeout(() => {
      const el = stageRef.current?.querySelector('[data-autofocus]')
      if (el && window.innerWidth > 640) el.focus()
    }, 190)
    return () => clearTimeout(h)
  }, [cur, phase])

  // Like Typeform's onboarding: picking an option highlights it, "Continue" (or Enter) moves on.
  const pickChoice = v => {
    if (step.id === 'x_purpose' && v !== answers.x_purpose) {
      const drop = purposeSpecificKeys(v)
      setErr(null)
      setAnswers(prev => { const next = { ...prev, x_purpose: v }; drop.forEach(k => { delete next[k] }); return next })
      return
    }
    setAnswer(step.id, v)
  }
  const toggleMulti = v => setAnswer(step.id, prev => {
    const arr = Array.isArray(prev) ? prev : []
    return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]
  })

  // ── submit ───────────────────────────────────────────────────────────────
  const submit = async () => {
    const missing = visible.filter(s => validateStep(s, answers))
    if (missing.length) { goTo(missing[0].id, -1); setErr(validateStep(missing[0], answers)); return }
    if (!answers.__consent) { setSubmitErr(t.consentErr); return }
    setSubmitting(true); setSubmitErr('')
    const files = []
    STEPS.filter(s => s.type === 'upload').forEach(s => (answers[s.id] || []).forEach(f => {
      if (f.status === 'done' && f.path) files.push({ name: f.name, size: f.size, type: f.type, kind: f.kind, tag: f.tag || null, path: f.path })
    }))
    const clean = stripFilesForDraft(answers)
    delete clean.__consent
    try {
      const r = await fetch(`${API}/api/seller-form`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sid: sidRef.current, lang, schemaVersion: SCHEMA_VERSION, answers: clean, files, story: storyText(answers, 'he'),
          meta: { url: location.href, ua: navigator.userAgent, startedAt: startedAt.current, durationSec: Math.round((Date.now() - startedAt.current) / 1000) },
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`)
      setResult({ ref: data.ref, token: data.token, url: `${window.location.origin}/newproperty/${data.token}`, name: answers.c_name, answers })
      clearDraft()
      setPhase('done'); window.scrollTo({ top: 0 })
    } catch (e) {
      console.error('[seller-form] submit failed:', e)
      setSubmitErr(t.submitErr)
    } finally { setSubmitting(false) }
  }

  // ── render ───────────────────────────────────────────────────────────────
  const sectionIdx = SECTIONS.findIndex(s => s.id === step?.section)
  const isReq = !!step && (step.required || (step.type === 'group' && visibleFields(step, answers).some(f => (typeof f.required === 'function' ? f.required(answers) : f.required))))

  return (
    <div className="sf-root" dir={rtl ? 'rtl' : 'ltr'} lang={lang}>
      <style>{CSS}</style>

      <div className="sf-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t.progress}><i style={{ width: `${progress}%` }}/></div>
      {phase !== 'done' && <header className="sf-top">
        <a href="/" aria-label={t.brand} className="sf-brand">
          <img className="sf-logo" src="/logo-mark-black.svg" alt={t.brand}/>
          <span className="sf-brandtxt">{t.brand}<small>{t.tagline}</small></span>
        </a>
        {phase === 'form' ? <Stepper curIdx={sectionIdx} lang={lang} answers={answers}/> : <div style={{ flex: 1 }}/>}
        <div className="sf-top-right">
          {phase === 'form' && <span className="sf-saved" key={savedTick} style={{ opacity: savedTick ? 1 : 0 }}><i/>{cloudSaved ? t.savedCloud : t.autosaved}</span>}
          {phase !== 'done' && <ShareMenu url={`${window.location.origin}/newproperty?d=${sidRef.current || pendingSid.current}`} title={t.brand} text={t.shareFormText} lang={lang} label={t.shareForm} compact/>}
          {phase === 'form' && <button type="button" className="sf-later-btn" onClick={() => setLaterOpen(true)}>{t.later}</button>}
          <button className="sf-lang" onClick={() => setLang(l => l === 'he' ? 'en' : 'he')} aria-label="Switch language" lang={lang === 'he' ? 'en' : 'he'}><IcoGlobe/>{t.langToggle}</button>
        </div>
      </header>}

      <main className={phase === 'done' ? 'sf-stage-done' : 'sf-stage'} ref={stageRef}>
        {phase === 'welcome' && (
          <Welcome t={t} lang={lang} draft={draft} onStart={() => begin(false)} onResume={() => begin(true)} loading={linkState === 'loading'}/>
        )}

        {phase === 'form' && step && (
          <div className="sf-card">
            {linkState === 'resumed' && idx > 0 && <div className="sf-resumed">{t.resumedFromLink}</div>}
            {resumedLocal && linkState !== 'resumed' && idx > 0 && <div className="sf-resumed">{t.resumedLocal}</div>}
            <AnimatePresence mode="popLayout" custom={dir} initial={false}>
              <motion.div key={step.id} custom={dir} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={stepTransition}>
                {step.type === 'intro' && (
                  <Intro section={section} t={t} lang={lang} onNext={goNext} answers={answers}/>
                )}
                {step.type === 'review' && (
                  <Review answers={answers} lang={lang} t={t} visible={visible} onEdit={editFromReview} onBack={goPrev} onNext={goNext}/>
                )}
                {step.type === 'story' && (
                  <Story answers={answers} lang={lang} t={t} onBack={goPrev}
                    consent={!!answers.__consent} setConsent={v => { setSubmitErr(''); setAnswer('__consent', v) }}
                    onSubmit={submit} submitting={submitting} submitErr={submitErr}/>
                )}
                {!['intro', 'review', 'story'].includes(step.type) && (
                  <>
                    {editReturn && (
                      <div className="sf-editbar" role="status">
                        <span>{t.editing}</span>
                        <button type="button" onClick={goReview}><IcoBack/>{t.backToReview}</button>
                      </div>
                    )}
                    <div className="sf-sec">{t.part} {section?.n} · {section ? sectionText(section, 'title', lang, answers) : ''}</div>
                    <div className="sf-qhead">
                      <span className="sf-badge" aria-hidden="true">{qNumber}</span>
                      <h2 className="sf-q">
                        <Emph text={stepQuestion(step, lang, answers)} phrase={emphasisFor(step.id, lang, answers)}/>
                        {isReq ? <span className="req" title={t.requiredMark}>*</span> : <span className="sf-opt-tag"> ({t.optional})</span>}
                      </h2>
                    </div>
                    {stepHelp(step, lang, answers) && <p className="sf-help">{stepHelp(step, lang, answers)}</p>}
                    <div className="sf-body">
                      <Field step={step} answers={answers} value={answers[step.id]} setValue={v => setAnswer(step.id, v)} setAnswer={setAnswer} lang={lang} t={t} err={err}
                        onEnter={goNext} pickChoice={pickChoice} toggleMulti={toggleMulti} sid={sidRef.current}/>
                    </div>
                    {err && <div className="sf-err" role="alert"><IcoWarn/>{VALIDATION_MSG[lang][err]}</div>}
                    <div className="sf-actions">
                      <button className="sf-btn ghost" onClick={goPrev} disabled={idx === 0}><IcoBack/>{t.back}</button>
                      <button className="sf-btn" onClick={goNext}>{t.cont}<IcoFwd/></button>
                    </div>
                    <button type="button" className="sf-later-inline" onClick={() => setLaterOpen(true)}>{t.later}</button>
                    <div className="sf-enter">{t.press} <b>{step.type === 'long' ? 'Ctrl + Enter ↵' : 'Enter ↵'}</b></div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="sf-done-wrap">
            {linkState === 'submitted' && result.token
              ? <div className="sf-done"><div className="ck"><IcoCheck size={38}/></div><h1>{t.doneTitleShort}</h1><p>{t.doneSub}</p><div className="sf-actions"><a className="sf-btn" href={result.url}>{t.reviewTitle}<IcoFwd/></a></div></div>
              : <SummaryView data={{ ...buildLocalSummary(result.answers || {}, { ref: result.ref, token: result.token }), local: !API && !import.meta.env.PROD ? true : false }} lang={lang} setLang={setLang} shareUrl={result.url} mode="done"/>}
          </div>
        )}
      </main>

      {laterOpen && phase === 'form' && <LaterModal t={t} lang={lang} sid={sidRef.current} phone={answers.c_phone || ''} url={`${window.location.origin}/newproperty?d=${sidRef.current}`} onClose={() => setLaterOpen(false)}/>}
      {phase === 'form' && (
        <footer className="sf-foot">
          <span className="sf-count">{idx + 1} {t.of} {total}</span>
          {reachedReview && !editReturn && !['review', 'story'].includes(step?.type) && (
            <button type="button" className="sf-jump" onClick={goReview}>{t.toReview}<IcoFwd/></button>
          )}
        </footer>
      )}
    </div>
  )
}

// ═══ WELCOME ══════════════════════════════════════════════════════════════════
const relTime = (ts, t) => {
  if (!ts) return ''
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000))
  if (m < 2) return t.draftWhen.now
  if (m < 60) return fill(t.draftWhen.min, { n: m })
  if (m < 48 * 60) return fill(t.draftWhen.hour, { n: Math.round(m / 60) })
  return fill(t.draftWhen.day, { n: Math.round(m / 1440) })
}
function Welcome({ t, lang, draft, onStart, onResume, loading }) {
  const hasDraft = draft && Object.keys(draft.answers || {}).length > 0
  const [phone, setPhone] = useState('')
  const [lookup, setLookup] = useState('')   // '' | sending | sent | err
  const meta = useMemo(() => {
    if (!hasDraft) return null
    const a = draft.answers || {}
    const vis = visibleStepsOf(a)
    const i = Math.max(0, vis.findIndex(s => s.id === draft.cur))
    const what = headline(a, lang) || (a.c_name ? String(a.c_name).trim() : '')
    return { what, step: fill(t.draftStep, { n: i + 1, total: vis.length }), when: relTime(draft.savedAt, t) }
  }, [draft, hasDraft, lang, t])
  const send = async e => {
    e.preventDefault()
    if (!phone.trim()) return
    setLookup('sending')
    try { const r = await fetch(`${API}/api/seller-form?action=find-draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone.trim() }) }); setLookup(r.ok ? 'sent' : 'err') } catch { setLookup('err') }
  }
  if (loading) return <div className="sf-welcome"><img className="logo" src={LOGO_SRC} alt={t.brand}/><p>…</p></div>
  return (
    <div className="sf-welcome">
      <img className="logo" src={LOGO_SRC} alt={t.brand}/>
      <h1>{t.welcomeTitle}</h1>
      <p>{t.welcomeSub}</p>
      {hasDraft && (
        <div className="sf-draftbox">
          <div className="sf-draftbox-h"><IcoCheck size={14}/>{t.savedDraft}</div>
          {meta?.what && <b>{meta.what}</b>}
          <small>{[meta?.step, meta?.when].filter(Boolean).join(' · ')}</small>
        </div>
      )}
      <div className="sf-welcome-actions">
        {hasDraft
          ? <><button className="sf-btn big" onClick={onResume} data-autofocus>{t.resume}<IcoFwd/></button><button className="sf-btn big ghost" onClick={onStart}>{t.restart}</button></>
          : <button className="sf-btn big" onClick={onStart} data-autofocus>{t.start}<IcoFwd/></button>}
      </div>
      {!hasDraft && (
        <details className="sf-other-device">
          <summary>{t.otherDevice}</summary>
          <p>{t.otherDeviceHint}</p>
          {lookup === 'sent' ? <div className="sf-other-ok"><IcoCheck size={14}/>{t.otherDeviceSent}</div> : (
            <form onSubmit={send} className="sf-other-form">
              <input type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} placeholder="050-000-0000" aria-label={t.otherDevice}/>
              <button type="submit" className="sf-btn" disabled={lookup === 'sending' || !phone.trim()}>{lookup === 'sending' ? '…' : t.otherDeviceSend}</button>
            </form>
          )}
          {lookup === 'err' && <div className="sf-err"><IcoWarn/>{t.otherDeviceErr}</div>}
        </details>
      )}
    </div>
  )
}

// "Continue later": the draft is already saved — show the link, offer WhatsApp-to-self and a server-sent WhatsApp
function LaterModal({ t, lang, url, sid, phone, onClose }) {
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState('')   // '' | sending | ok:<phone> | no
  const copy = async () => { try { await navigator.clipboard.writeText(url) } catch {} setCopied(true); setTimeout(() => setCopied(false), 1800) }
  const sendServer = async () => {
    setSent('sending')
    try { const r = await fetch(`${API}/api/seller-form?action=resume-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid, phone }) }); const d = await r.json().catch(() => ({})); setSent(r.ok && d.sent ? `ok:${d.phoneMasked || ''}` : 'no') } catch { setSent('no') }
  }
  const waSelf = `https://wa.me/?text=${encodeURIComponent(`${lang === 'en' ? 'My property form at Afik Hanahal — continue here:' : 'טופס הנכס שלי באפיק הנחל — להמשך:'}\n${url}`)}`
  return (
    <div className="sf-later" role="dialog" aria-modal="true" aria-label={t.laterTitle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sf-later-card">
        <div className="sf-later-ok"><IcoCheck size={22}/></div>
        <h3>{t.laterTitle}</h3>
        <p>{t.laterSub}</p>
        <div className="sf-later-link" dir="ltr">{url}</div>
        <div className="sf-later-actions">
          <button type="button" className="sf-btn ghost" onClick={copy}><IcoCopy/> {copied ? t.copied : t.copyLink}</button>
          <a className="sf-btn ghost wa" href={waSelf} target="_blank" rel="noreferrer"><IcoWa/> {t.laterWaSelf}</a>
          {phone && !sent.startsWith('ok') && <button type="button" className="sf-btn" onClick={sendServer} disabled={sent === 'sending'}><IcoWa/> {sent === 'sending' ? '…' : t.laterWaServer}</button>}
        </div>
        {sent.startsWith('ok') && <div className="sf-other-ok"><IcoCheck size={14}/>{fill(t.laterSentOk, { phone: sent.slice(3) })}</div>}
        {sent === 'no' && <div className="sf-err"><IcoWarn/>{t.laterSentNo}</div>}
        <button type="button" className="sf-link" onClick={onClose}>{t.laterClose}</button>
      </div>
    </div>
  )
}

// ═══ SECTION INTRO ════════════════════════════════════════════════════════════
function Intro({ section, t, lang, onNext, answers }) {
  if (!section) return null
  return (
    <div className="sf-intro">
      <div className="n">{t.part} {section.n} / {SECTIONS.length}</div>
      <h2>{sectionText(section, 'title', lang, answers || {})}</h2>
      <div className="line"/>
      <p>{sectionText(section, 'desc', lang, answers || {})}</p>
      <div className="sf-actions">
        <button className="sf-btn" onClick={onNext} data-autofocus>{t.cont}<IcoFwd/></button>
      </div>
      <div className="sf-enter">{t.press} <b>Enter ↵</b></div>
    </div>
  )
}

// ═══ FIELD SWITCH ═════════════════════════════════════════════════════════════
function Field(props) {
  const { step } = props
  switch (step.type) {
    case 'text': case 'phone': case 'email': case 'date': return <TextInput {...props}/>
    case 'long':     return <LongInput {...props}/>
    case 'number':   return <NumberInput {...props}/>
    case 'choice':   return <Choice {...props}/>
    case 'multi':    return <Multi {...props}/>
    case 'counter':  return <Counter {...props}/>
    case 'group':    return <Group {...props}/>
    case 'matrix':   return <Matrix {...props}/>
    case 'toggles':  return <Toggles {...props}/>
    case 'upload':   return <Upload {...props}/>
    default: return null
  }
}

const L = (item, lang) => (lang === 'en' ? (item.en ?? item.l) : item.l)

function TextInput({ step, value, setValue, lang, err, answers }) {
  const type = step.type === 'phone' ? 'tel' : step.type === 'email' ? 'email' : step.type === 'date' ? 'date' : 'text'
  return (
    <input className={`sf-input${err ? ' is-err' : ''}`} type={type} inputMode={step.type === 'phone' ? 'tel' : step.type === 'email' ? 'email' : undefined}
      value={value || ''} onChange={e => setValue(e.target.value)} placeholder={stepPh(step, lang, answers)}
      autoComplete={step.autocomplete || (step.type === 'phone' ? 'tel' : step.type === 'email' ? 'email' : 'off')}
      dir={step.type === 'phone' || step.type === 'email' ? 'ltr' : undefined}
      style={step.type === 'phone' || step.type === 'email' ? { textAlign: lang === 'he' ? 'right' : 'left' } : undefined}
      enterKeyHint="next" data-autofocus aria-invalid={!!err}/>
  )
}

function LongInput({ step, value, setValue, lang, err, answers }) {
  const ref = useRef(null)
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(360, el.scrollHeight) + 'px' } }, [value])
  return (
    <textarea ref={ref} className={`sf-input${err ? ' is-err' : ''}`} rows={3} value={value || ''} onChange={e => setValue(e.target.value)}
      placeholder={stepPh(step, lang, answers)} data-autofocus aria-invalid={!!err}/>
  )
}

function NumberInput({ step, value, setValue, lang, err, answers }) {
  const unit = stepUnit(step, lang, answers)
  const shown = step.thousands && value !== undefined && value !== '' ? fmtNum(value, 'en') : (value ?? '')
  const onChange = e => {
    const raw = e.target.value.replace(/[^\d.]/g, '')
    setValue(raw === '' ? '' : raw)
  }
  return (
    <div className="sf-input-wrap">
      <input className={`sf-input${err ? ' is-err' : ''}`} type="text" inputMode="decimal" value={shown} onChange={onChange}
        placeholder={stepPh(step, lang, answers)} dir="ltr" style={{ textAlign: lang === 'he' ? 'right' : 'left' }}
        enterKeyHint="next" data-autofocus aria-invalid={!!err}/>
      {unit && <span className="sf-unit">{unit}</span>}
    </div>
  )
}

function OtherInput({ step, answers, setAnswer, lang, t }) {
  const key = otherKey(step.id)
  return (
    <div className="sf-other">
      <input className="sf-input" type="text" value={answers[key] || ''} onChange={e => setAnswer(key, e.target.value)}
        placeholder={lang === 'en' ? (step.en_other_ph || step.other_ph || t.otherPh) : (step.other_ph || t.otherPh)} autoFocus={typeof window !== 'undefined' && window.innerWidth > 640} enterKeyHint="next"/>
    </div>
  )
}

function DirectionsNote({ step, value, answers, setAnswer, lang, t }) {
  const key = noteKey(step.id)
  const auto = directionsText(value, lang)
  const manual = answers[key]
  const shown = manual !== undefined && manual !== '' ? manual : auto
  if (!auto && !manual) return null
  return (
    <div className="sf-note">
      <textarea className="sf-input" rows={3} value={shown} onChange={e => setAnswer(key, e.target.value)} placeholder={t.notePh}/>
      {manual !== undefined && manual !== '' && manual !== auto && (
        <button type="button" className="sf-link" onClick={() => setAnswer(key, '')}>{t.noteReset}</button>
      )}
    </div>
  )
}

function Choice({ step, value, lang, t, pickChoice, answers, setAnswer, onEnter }) {
  const [flash, setFlash] = useState(null)
  const opts = stepOpts(step, answers)
  // big select: picking a value moves on by itself (Typeform-like), once the new value has rendered
  const wantNext = useRef(false)
  useEffect(() => { if (wantNext.current && value) { wantNext.current = false; if (value === 'other') return; const h = setTimeout(() => onEnter?.(), 220); return () => clearTimeout(h) } }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  if (step.select) return (
    <div className="sf-bigselect-wrap">
      <select className="sf-bigselect" value={value || ''} onChange={e => { const same = e.target.value === value; pickChoice(e.target.value); e.target.blur(); if (same) setTimeout(() => onEnter?.(), 200); else wantNext.current = true }} aria-label={stepQuestion(step, lang, answers)} data-autofocus>
        <option value="" disabled>{t.pickOne}</option>
        {opts.map(o => <option key={o.v} value={o.v}>{L(o, lang)}</option>)}
      </select>
      <span className="sf-bigselect-arrow" aria-hidden="true"><IcoChevron/></span>
      {value === 'other' && opts.some(o => o.v === 'other') && <OtherInput step={step} answers={answers} setAnswer={setAnswer} lang={lang} t={t}/>}
    </div>
  )
  return (
    <>
      <div className={`sf-opts${step.grid ? ' grid' : ''}${step.compact ? ' compact' : ''}${step.big ? ' big' : ''}`} role="radiogroup">
        {opts.map((o, i) => (
          <button key={o.v} type="button" role="radio" aria-checked={value === o.v}
            className={`sf-opt${value === o.v ? ' on' : ''}${flash === o.v ? ' flash' : ''}`}
            onClick={() => { setFlash(o.v); pickChoice(o.v) }}>
            {!step.compact && <span className="sf-key">{LETTERS[i]}</span>}
            <span className="lbl">{L(o, lang)}</span>
            {!step.compact && <span className="sf-check"><IcoCheck size={18}/></span>}
          </button>
        ))}
      </div>
      {value === 'other' && opts.some(o => o.v === 'other') && <OtherInput step={step} answers={answers} setAnswer={setAnswer} lang={lang} t={t}/>}
      {step.compact && (
        <div className="sf-select-wrap">
          <span>{t.pickFromList}</span>
          <select className="sf-select" value={value || ''} onChange={e => pickChoice(e.target.value)} aria-label={t.pickFromList}>
            <option value="">—</option>
            {opts.map(o => <option key={o.v} value={o.v}>{L(o, lang)}</option>)}
          </select>
        </div>
      )}
      <div className="sf-hint">{t.selectOne}</div>
    </>
  )
}

function Multi({ step, value, lang, t, toggleMulti, answers, setAnswer }) {
  const arr = Array.isArray(value) ? value : []
  const opts = stepOpts(step, answers)
  const lc = step.linkedCounter
  const lcVal = lc ? Number(answers[lc.id]?.[lc.k] ?? lc.min ?? 0) : 0
  const lcSet = n => setAnswer(lc.id, { ...(answers[lc.id] || {}), [lc.k]: Math.min(lc.max ?? 99, Math.max(lc.min ?? 0, n)) })
  return (
    <>
      {lc && (
        <div className="sf-linked">
          <span className="lbl">{lang === 'en' ? lc.en : lc.l}</span>
          <span className="ctl">
            <button type="button" className="sf-round" onClick={() => lcSet(lcVal - 1)} disabled={lcVal <= (lc.min ?? 0)} aria-label={t.minus}>−</button>
            <b>{lcVal}</b>
            <button type="button" className="sf-round" onClick={() => lcSet(lcVal + 1)} disabled={lcVal >= (lc.max ?? 99)} aria-label={t.plus}>+</button>
          </span>
        </div>
      )}
      <div className={`sf-opts${opts.length > 6 ? ' grid' : ''}`} role="group">
        {opts.map((o, i) => (
          <button key={o.v} type="button" aria-pressed={arr.includes(o.v)} className={`sf-opt${arr.includes(o.v) ? ' on' : ''}`} onClick={() => toggleMulti(o.v)}>
            <span className="sf-key">{LETTERS[i]}</span>
            <span className="lbl">{L(o, lang)}</span>
            <span className="sf-box"><IcoCheck size={13}/></span>
          </button>
        ))}
      </div>
      {arr.includes('other') && <OtherInput step={step} answers={answers} setAnswer={setAnswer} lang={lang} t={t}/>}
      {step.note && (
        <div className="sf-presets">
          <span>{t.dirPresets}:</span>
          {[['north', 'east'], ['north', 'west'], ['south', 'east'], ['south', 'west'], ['north', 'east', 'south', 'west']].map(p => {
            const on = p.length === arr.length && p.every(x => arr.includes(x))
            return <button key={p.join('-')} type="button" className={`sf-pill${on ? ' on purple' : ''}`} onClick={() => setAnswer(step.id, p)}>{directionsText(p, lang).replace(/^(נכס פינתי, |Corner property |Faces |פונה ל)/, '').replace(/\.$/, '')}</button>
          })}
        </div>
      )}
      {step.note && <DirectionsNote step={step} value={arr} answers={answers} setAnswer={setAnswer} lang={lang} t={t}/>}
      <div className="sf-hint">{t.selectMany}</div>
    </>
  )
}

function Counter({ step, value, setValue, answers, lang, t }) {
  const rows = visibleRows(step, answers)
  const v = value || {}
  const get = r => (v[r.k] === undefined || v[r.k] === '' ? r.def ?? r.min ?? 0 : Number(v[r.k]))
  // materialise defaults once so the answer is recorded even without interaction
  useEffect(() => {
    const missing = rows.some(r => v[r.k] === undefined)
    if (missing) setValue({ ...v, ...Object.fromEntries(rows.filter(r => v[r.k] === undefined).map(r => [r.k, r.def ?? r.min ?? 0])) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const bump = (r, d) => {
    const n = Math.min(r.max ?? 99, Math.max(r.min ?? 0, +(get(r) + d * (r.step || 1)).toFixed(1)))
    setValue({ ...v, [r.k]: n })
  }
  return (
    <div className="sf-counters">
      {rows.map(r => (
        <div className="sf-counter" key={r.k}>
          <span className="lbl">{L(r, lang)}</span>
          <span className="ctl">
            <button type="button" className="sf-round" onClick={() => bump(r, -1)} disabled={get(r) <= (r.min ?? 0)} aria-label={t.minus}>−</button>
            <b>{fmtNum(get(r), lang)}</b>
            <button type="button" className="sf-round" onClick={() => bump(r, +1)} disabled={get(r) >= (r.max ?? 99)} aria-label={t.plus}>+</button>
          </span>
        </div>
      ))}
    </div>
  )
}

function Group({ step, value, setValue, answers, lang, err, t }) {
  const fields = visibleFields(step, answers)
  const v = value || {}
  const bad = err ? groupInvalidFields(step, answers) : []
  return (
    <div className="sf-grid">
      {fields.map((f, i) => {
        const req = typeof f.required === 'function' ? f.required(answers) : f.required
        const unit = lang === 'en' ? (f.en_unit || f.unit) : f.unit
        const isNum = f.type === 'number'
        if (f.type === 'date') {
          return (
            <div className={`sf-field${f.half ? '' : ' full'}`} key={f.k}>
              <label>{L(f, lang)}{req && <i>*</i>}</label>
              <DateField id={`${step.id}-${f.k}`} value={v[f.k] || ''} onChange={val => setValue({ ...v, [f.k]: val })} lang={lang} t={t} invalid={bad.includes(f.k)}/>
            </div>
          )
        }
        if (f.type === 'city' || f.type === 'street') {
          return (
            <div className={`sf-field${f.half ? '' : ' full'}`} key={f.k}>
              <label htmlFor={`${step.id}-${f.k}`}>{L(f, lang)}{req && <i>*</i>}</label>
              <Combo id={`${step.id}-${f.k}`} value={v[f.k] ?? ''} onChange={val => setValue(f.type === 'city' && val !== v.city ? { ...v, [f.k]: val, street: '' } : { ...v, [f.k]: val })}
                options={f.type === 'city' ? CITIES : undefined} loadKey={f.type === 'street' ? (v.city || '') : undefined} loader={f.type === 'street' ? loadStreets : undefined}
                popular={f.type === 'city' ? POPULAR_CITIES : undefined} emptyHint={f.type === 'street' ? t.noStreetMatch : t.noMatches}
                onPick={() => { const nxtKey = f.type === 'city' ? (fields.some(x => x.k === 'street') ? 'street' : fields[i + 1]?.k) : f.type === 'street' ? (fields.some(x => x.k === 'number') ? 'number' : fields[i + 1]?.k) : fields[i + 1]?.k; if (nxtKey) document.getElementById(`${step.id}-${nxtKey}`)?.focus() }}
                placeholder={lang === 'en' ? (f.en_ph || f.ph || '') : (f.ph || '')} invalid={bad.includes(f.k)} autoFocus={i === 0} t={t}/>
            </div>
          )
        }
        return (
          <div className={`sf-field${f.half ? '' : ' full'}`} key={f.k}>
            <label htmlFor={`${step.id}-${f.k}`}>{L(f, lang)}{req && <i>*</i>}</label>
            <div className="sf-input-wrap">
              <input id={`${step.id}-${f.k}`} className={`sf-input${bad.includes(f.k) ? ' is-err' : ''}`}
                type={f.type === 'date' ? 'date' : f.type === 'tel' ? 'tel' : 'text'} inputMode={isNum ? 'decimal' : f.type === 'tel' ? 'tel' : undefined}
                value={v[f.k] ?? ''} onChange={e => setValue({ ...v, [f.k]: isNum ? e.target.value.replace(/[^\d.\-]/g, '') : e.target.value })}
                placeholder={lang === 'en' ? (f.en_ph || f.ph || '') : (f.ph || '')} autoComplete={f.autocomplete || 'off'}
                dir={isNum || f.type === 'tel' ? 'ltr' : undefined} style={isNum || f.type === 'tel' ? { textAlign: lang === 'he' ? 'right' : 'left' } : undefined}
                enterKeyHint={i === fields.length - 1 ? 'next' : 'next'} data-autofocus={i === 0 ? true : undefined} aria-invalid={bad.includes(f.k)}/>
              {unit && <span className="sf-unit">{unit}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Autocomplete combo (cities: bundled CBS list; streets: fetched per city) ──
const streetCache = {}
async function loadStreets(city) {
  const c = String(city || '').trim()
  if (!c) return []
  if (streetCache[c]) return streetCache[c]
  const get = async url => { const r = await fetch(url); if (!r.ok) throw new Error(String(r.status)); return r.json() }
  let names = []
  try {
    const d = await get(`${API}/api/seller-form?action=streets&city=${encodeURIComponent(c)}`)
    names = Array.isArray(d.streets) ? d.streets : []
  } catch {
    try {
      const d = await get(`https://data.gov.il/api/3/action/datastore_search?resource_id=9ad3862c-8391-4b2f-84a4-2d4c68625f4b&limit=32000&q=${encodeURIComponent(c)}`)
      names = (d.result?.records || []).filter(r => String(r['שם_ישוב'] || '').trim() === c).map(r => String(r['שם_רחוב'] || '').trim()).filter(Boolean)
    } catch { names = [] }
  }
  names = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'he'))
  streetCache[c] = names
  return names
}

const POPULAR_CITIES = ['רעננה', 'כפר סבא', 'הוד השרון', 'הרצליה', 'רמת השרון', 'נתניה', 'תל אביב - יפו', 'פתח תקווה', 'ראש העין', 'אבן יהודה', 'כוכב יאיר', 'קדימה-צורן']
const Hi = ({ text, q }) => { if (!q) return text; const i = text.indexOf(q); if (i < 0) return text; return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</> }
function Combo({ id, value, onChange, options, loadKey, loader, placeholder, invalid, autoFocus, t, popular, onPick, emptyHint }) {
  const [list, setList] = useState(options || [])
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (options) setList(options) }, [options])
  useEffect(() => {
    if (!loader) return
    let alive = true
    if (!loadKey) { setList([]); return }
    setLoading(true)
    loader(loadKey).then(l => { if (alive) { setList(l || []); setLoading(false) } }).catch(() => { if (alive) { setList([]); setLoading(false) } })
    return () => { alive = false }
  }, [loadKey, loader])
  const q = String(value || '').trim()
  const matches = useMemo(() => {
    if (!list.length) return []
    if (!q) {
      const pop = (popular || []).filter(x => list.includes(x))
      return pop.length ? [...pop.map(x => ({ v: x, pop: true })), ...list.filter(x => !pop.includes(x)).map(x => ({ v: x }))].slice(0, 2000) : list.slice(0, 2000).map(x => ({ v: x }))
    }
    const starts = list.filter(x => x.startsWith(q))
    const inc = list.filter(x => !x.startsWith(q) && x.includes(q))
    return [...starts, ...inc].slice(0, 2000).map(x => ({ v: x }))
  }, [q, list, popular])
  const exact = matches.length === 1 && matches[0].v === q
  const show = open && (matches.length > 0 ? !exact : (!!q && !!list.length))
  const pick = val => { onChange(val); setOpen(false); setTimeout(() => onPick?.(val), 30) }
  const listRef = useRef(null)
  useEffect(() => { listRef.current?.children[hi]?.scrollIntoView?.({ block: 'nearest' }) }, [hi])
  const onKey = e => {
    if (!show) return
    if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); setHi(h => Math.min(matches.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setHi(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); pick(matches[hi]?.v ?? q) }
    else if (e.key === 'Escape') { setOpen(false) }
  }
  return (
    <div className="sf-combo">
      <input id={id} className={`sf-input${invalid ? ' is-err' : ''}`} type="text" value={value} autoComplete="off" role="combobox" aria-expanded={show} aria-autocomplete="list"
        onChange={e => { onChange(e.target.value); setOpen(true); setHi(0) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey} placeholder={loader && loadKey && loading ? t.loadingStreets : (loader && loadKey && !list.length && !loading ? t.noStreets : placeholder)}
        data-autofocus={autoFocus ? true : undefined} aria-invalid={invalid}/>
      {q && <button type="button" className="sf-combo-x" aria-label={t.clear} onMouseDown={e => { e.preventDefault(); onChange(''); setOpen(true); setHi(0) }}>×</button>}
      {!q && list.length > 0 && <button type="button" className="sf-combo-arrow" aria-label={t.pickFromList} onMouseDown={e => { e.preventDefault(); setOpen(o => !o); document.getElementById(id)?.focus() }}><IcoChevron/></button>}
      {show && (
        <ul className="sf-combo-list" role="listbox" ref={listRef}>
          {matches.length === 0 && <li className="sf-combo-empty">{emptyHint || t.noMatches}</li>}
          {matches.map((m, i) => (
            <li key={m.v} role="option" aria-selected={i === hi} className={`${i === hi ? 'on' : ''}${m.pop ? ' pop' : ''}${!q && !m.pop && i > 0 && matches[i - 1].pop ? ' first-after-pop' : ''}`} onMouseDown={e => { e.preventDefault(); pick(m.v) }} onMouseEnter={() => setHi(i)}>
              {!q && m.pop && i === 0 && <small className="sf-combo-sec">{t.popularCities}</small>}
              {!q && !m.pop && i > 0 && matches[i - 1].pop && <small className="sf-combo-sec">{t.allCities}</small>}
              <Hi text={m.v} q={q}/>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
function DateField({ id, value, onChange, lang, t, invalid }) {
  const [y, m, d] = String(value || '').split('-').map(x => parseInt(x, 10))
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => thisYear - 1 + i)
  const set = (ny, nm, nd) => {
    if (!ny || !nm || !nd) { onChange(''); return }
    const dim = new Date(ny, nm, 0).getDate()
    onChange(`${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(nd, dim)).padStart(2, '0')}`)
  }
  const [py, pm, pd] = [y || 0, m || 0, d || 0]
  const dim = py && pm ? new Date(py, pm, 0).getDate() : 31
  const months = lang === 'en' ? MONTHS_EN : MONTHS_HE
  return (
    <div className={`sf-date${invalid ? ' is-err' : ''}`} id={id}>
      <label><small>{t.dateDay}</small><select value={pd || ''} onChange={e => set(py || thisYear, pm || 1, +e.target.value)}><option value="">—</option>{Array.from({ length: dim }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
      <label><small>{t.dateMonth}</small><select value={pm || ''} onChange={e => set(py || thisYear, +e.target.value, pd || 1)}><option value="">—</option>{months.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}</select></label>
      <label><small>{t.dateYear}</small><select value={py || ''} onChange={e => set(+e.target.value, pm || 1, pd || 1)}><option value="">—</option>{years.map(yy => <option key={yy} value={yy}>{yy}</option>)}</select></label>
    </div>
  )
}

function Matrix({ step, value, setValue, answers, lang, err }) {
  const rows = visibleRows(step, answers)
  const v = value || {}
  return (
    <div>
      {rows.map(r => (
        <div className={`sf-mrow${err && (v[r.k] === undefined || v[r.k] === '') ? ' is-err' : ''}`} key={r.k} role="radiogroup" aria-label={L(r, lang)}>
          <span className="lbl">{L(r, lang)}</span>
          <span className="sf-scale">
            {step.scale.map(s => (
              <button key={s.v} type="button" role="radio" aria-checked={v[r.k] === s.v} className={`sf-pill${v[r.k] === s.v ? ' on purple' : ''}`} onClick={() => setValue({ ...v, [r.k]: s.v })}>{L(s, lang)}</button>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

function Toggles({ step, value, setValue, answers, lang, t }) {
  const rows = visibleRows(step, answers)
  const v = value || {}
  useEffect(() => {
    if (rows.some(r => v[r.k] === undefined)) setValue({ ...v, ...Object.fromEntries(rows.filter(r => v[r.k] === undefined).map(r => [r.k, false])) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      {rows.map(r => (
        <div className="sf-mrow" key={r.k}>
          <span className="lbl">{L(r, lang)}</span>
          <span className="sf-seg" role="radiogroup" aria-label={L(r, lang)}>
            <button type="button" role="radio" aria-checked={v[r.k] === true} className={v[r.k] === true ? 'on yes' : ''} onClick={() => setValue({ ...v, [r.k]: true })}>{t.yes}</button>
            <button type="button" role="radio" aria-checked={v[r.k] === false} className={v[r.k] === false ? 'on' : ''} onClick={() => setValue({ ...v, [r.k]: false })}>{t.no}</button>
          </span>
        </div>
      ))}
    </div>
  )
}

// ═══ UPLOAD ═══════════════════════════════════════════════════════════════════
function Upload({ step, value, setValue, lang, t, sid }) {
  const files = Array.isArray(value) ? value : []
  const [tag, setTag] = useState(step.tags?.[0]?.v)
  const [over, setOver] = useState(false)
  const [msg, setMsg] = useState('')
  const inputRef = useRef(null)
  const queue = useRef([])
  const active = useRef(0)

  const patch = (id, p) => setValue(prev => (Array.isArray(prev) ? prev : []).map(f => f.id === id ? { ...f, ...p } : f))

  const accepts = f => {
    const acc = step.accept || '*'
    if (acc === '*') return true
    return acc.split(',').some(a => a.trim().endsWith('/*') ? f.type.startsWith(a.trim().slice(0, -1)) : f.type === a.trim())
  }

  const pump = () => {
    while (active.current < 2 && queue.current.length) {
      const job = queue.current.shift(); active.current++
      job().finally(() => { active.current--; pump() })
    }
  }

  const uploadOne = (file, entry) => async () => {
    try {
      const blob = entry.kind === 'photos' ? await compressImage(file) : file
      const r = await fetch(`${API}/api/seller-form?action=upload-url`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid, name: blob.name || file.name, type: blob.type || file.type, size: blob.size, kind: entry.kind }),
      })
      const meta = await r.json().catch(() => ({}))
      if (!r.ok || !meta.signedUrl) throw new Error(meta.error || `HTTP ${r.status}`)
      await putWithProgress(meta.signedUrl, blob, pct => patch(entry.id, { progress: pct }))
      patch(entry.id, { status: 'done', progress: 100, path: meta.path, size: blob.size, type: blob.type || file.type, name: blob.name || file.name })
    } catch (e) {
      console.error('[seller-form] upload failed:', e)
      patch(entry.id, { status: 'error', error: e.message })
    }
  }

  // Poster frame for a video (first second), as a blob: URL like image previews. Best effort.
  const videoPoster = file => new Promise(resolve => {
    try {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      let settled = false
      const finish = out => { if (settled) return; settled = true; clearTimeout(h); URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); resolve(out) }
      const h = setTimeout(() => finish(null), 6000)
      v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.crossOrigin = 'anonymous'
      v.onerror = () => finish(null)
      v.onloadedmetadata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 2) } catch { finish(null) } }
      v.onseeked = () => {
        try {
          const w = v.videoWidth || 320, hgt = v.videoHeight || 180, scale = Math.min(1, 480 / w)
          const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(hgt * scale)
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
          c.toBlob(b => finish(b ? URL.createObjectURL(b) : null), 'image/jpeg', .8)
        } catch { finish(null) }
      }
      v.src = url
    } catch { resolve(null) }
  })

  const addFiles = list => {
    setMsg('')
    const incoming = Array.from(list || [])
    if (!incoming.length) return
    const room = (step.max || 40) - files.length
    if (room <= 0) { setMsg(fill(t.tooMany, { n: step.max })); return }
    const errs = []
    const ok = []
    incoming.slice(0, room).forEach(f => {
      if (!accepts(f)) { errs.push(fill(t.wrongType, { name: f.name })); return }
      if (f.size > (step.maxMB || 25) * 1024 * 1024) { errs.push(fill(t.fileTooBig, { name: f.name, mb: step.maxMB || 25 })); return }
      ok.push(f)
    })
    if (incoming.length > room) errs.push(fill(t.tooMany, { n: step.max }))
    if (errs.length) setMsg(errs.join(' · '))
    const entries = ok.map(f => ({
      id: uid(), name: f.name, size: f.size, type: f.type, kind: step.kind, tag: step.tags ? tag : undefined,
      status: 'uploading', progress: 0, preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }))
    if (!entries.length) return
    setValue(prev => [...(Array.isArray(prev) ? prev : []), ...entries])
    ok.forEach((f, i) => { entries[i]._file = f; queue.current.push(uploadOne(f, entries[i])) })
    pump()
    ok.forEach((f, i) => { if (f.type.startsWith('video/')) videoPoster(f).then(url => { if (url) patch(entries[i].id, { preview: url }) }) })
  }

  const retry = f => { if (f._file) { patch(f.id, { status: 'uploading', progress: 0, error: null }); queue.current.push(uploadOne(f._file, f)); pump() } else { remove(f) } }
  const remove = f => setValue(prev => (Array.isArray(prev) ? prev : []).filter(x => x.id !== f.id))
  const done = files.filter(f => f.status === 'done').length

  return (
    <div>
      {step.tags && (
        <>
          <div className="sf-hint" style={{ marginTop: 0, marginBottom: 8, fontWeight: 600, color: 'var(--ink2)' }}>{t.docTypePick}</div>
          <div className="sf-tags">
            {step.tags.map(x => <button key={x.v} type="button" className={`sf-pill${tag === x.v ? ' on purple' : ''}`} onClick={() => setTag(x.v)}>{L(x, lang)}</button>)}
          </div>
        </>
      )}
      <div className={`sf-drop${over ? ' over' : ''}`} role="button" tabIndex={0} data-autofocus
        onClick={() => inputRef.current?.click()} onKeyDown={e => { if (e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
        onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files) }}>
        <div className="ic"><IcoUpload/></div>
        <h4>{t.dropTitle}</h4>
        <p>{fill(t.dropSub, { n: step.max || 40, mb: step.maxMB || 25 })}</p>
        <input ref={inputRef} type="file" multiple accept={step.accept} style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = '' }}/>
      </div>
      {msg && <div className="sf-err"><IcoWarn/>{msg}</div>}
      {files.length > 0 && (
        <div className="sf-files">
          {files.map(f => (
            <div className="sf-file" key={f.id}>
              <div className={`th${f.type?.startsWith('video/') ? ' vid' : ''}`}>{f.preview ? <img src={f.preview} alt=""/> : f.type?.startsWith('video/') ? <IcoVideo/> : <IcoFile/>}{f.preview && f.type?.startsWith('video/') && <span className="play">▶</span>}</div>
              <div className="nm" title={f.name}>{f.name}</div>
              <div className={`st ${f.status === 'done' ? 'ok' : f.status === 'error' ? 'err' : ''}`}>
                {f.status === 'uploading' && <span>{t.uploading} {f.progress || 0}%</span>}
                {f.status === 'done' && <span>✓ {t.uploadDone}</span>}
                {f.status === 'error' && <button type="button" onClick={() => retry(f)} style={{ border: 0, background: 'none', color: 'var(--err)', cursor: 'pointer', padding: 0, fontSize: 11.5, fontWeight: 600 }}>{t.uploadErr} · {t.retry}</button>}
                {step.tags && f.status !== 'error' && (
                  <select value={f.tag || 'other'} onChange={e => patch(f.id, { tag: e.target.value })} aria-label={t.docTypePick}>
                    {step.tags.map(x => <option key={x.v} value={x.v}>{L(x, lang)}</option>)}
                  </select>
                )}
              </div>
              {f.status === 'uploading' && <div className="bar"><i style={{ width: `${f.progress || 0}%` }}/></div>}
              <button type="button" className="x" onClick={() => remove(f)} aria-label={t.remove}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="sf-hint" style={{ marginTop: 14 }}>{done > 0 ? fill(t.uploadedCount, { n: done }) + ' · ' : ''}{t.laterWhatsapp}</div>
    </div>
  )
}

// ═══ REVIEW (property file) ═══════════════════════════════════════════════════
function Review({ answers, lang, t, visible, onEdit, onBack, onNext }) {
  const summary = useMemo(() => buildSummary(answers, lang), [answers, lang])
  const missing = visible.filter(s => validateStep(s, answers))
  // Phones: sections start collapsed so the story is one tap away; desktop: everything open
  const [openSecs, setOpenSecs] = useState(() => (typeof window !== 'undefined' && window.innerWidth <= 720 ? new Set() : null))
  const isOpen = id => openSecs === null || openSecs.has(id)
  const toggle = id => setOpenSecs(prev => { const next = new Set(prev === null ? summary.map(s => s.section) : prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const allOpen = openSecs === null || summary.every(s => openSecs.has(s.section))
  const toggleAll = () => setOpenSecs(allOpen ? new Set() : null)
  const stateStep = STEPS.find(s => s.id === 'p_state')
  const stateLabel = answers.p_state ? (stateStep.opts.find(o => o.v === answers.p_state) || {})[lang === 'en' ? 'en' : 'l'] : ''
  const facts = [
    answers.d_ask ? { k: purposeOf(answers) === 'rental' ? t.factRent : t.factPrice, v: `${lang === 'en' ? '₪' : ''}${fmtNum(answers.d_ask, lang)}${lang === 'en' ? '' : ' ₪'}`, hi: true } : null,
    roomsOf(answers) ? { k: t.factRooms, v: roomsOf(answers) } : null,
    answers.p_area?.built ? { k: t.factArea, v: fmtNum(answers.p_area.built, lang) } : null,
    answers.p_floor?.floor !== undefined && answers.p_floor?.floor !== '' ? { k: t.factFloor, v: `${answers.p_floor.floor}${answers.p_floor.totalFloors ? ` / ${answers.p_floor.totalFloors}` : ''}` } : null,
    answers.f_parking?.parking !== undefined ? { k: t.factParking, v: answers.f_parking.parking } : null,
    stateLabel ? { k: t.factState, v: stateLabel } : null,
  ].filter(Boolean)
  return (
    <div className="sf-review">
      <div className="sf-rhero">
        <div className="sf-rk">{t.reviewKicker}</div>
        <h2>{headline(answers, lang) || t.reviewTitle}</h2>
        {facts.length > 0 && (
          <div className="sf-facts">
            {facts.map(f => <div className={`sf-fact${f.hi ? ' hi' : ''}`} key={f.k}><small>{f.k}</small><b>{f.v}</b></div>)}
          </div>
        )}
      </div>
      <div className="sf-ractions">
        <button className="sf-btn" onClick={onNext} disabled={missing.length > 0}>{t.toStory}<IcoFwd/></button>
        <button className="sf-btn ghost" type="button" onClick={toggleAll}>{allOpen ? t.hideAll : t.showAll}</button>
      </div>
      <p className="sf-rsub">{t.reviewHint}</p>
      {missing.length > 0 && (
        <div className="sf-missing">
          <h4>{t.missingTitle}</h4>
          {missing.map(s => <button key={s.id} type="button" onClick={() => onEdit(s.id)}>→ {lang === 'en' ? (s.en_q || s.q) : s.q}</button>)}
        </div>
      )}
      <div className="sf-rgrid">
        {summary.map(sec => {
          const secDef = SECTIONS.find(x => x.id === sec.section)
          return (
            <section className={`sf-rsec${isOpen(sec.section) ? ' open' : ''}`} key={sec.section}>
              <h3><button type="button" onClick={() => toggle(sec.section)} aria-expanded={isOpen(sec.section)}><i>{secDef?.n}</i><span>{sec.title}</span><small>{fill(t.itemsCount, { n: sec.items.length })}</small><IcoChevron/></button></h3>
              {isOpen(sec.section) && sec.items.map(it => (
                <div className="sf-ritem" key={it.id}>
                  <span className="k">{it.label}</span>
                  <span className="v">
                    {it.type === 'upload' ? <FilesLine files={answers[it.id]} lang={lang} t={t}/>
                      : it.chips ? <><span className="sf-chips">{it.chips.map(c => <em key={c}>{c}</em>)}</span>{it.note && <span className="sf-vnote">{it.note}</span>}</>
                      : it.value}
                  </span>
                  <button type="button" onClick={() => onEdit(it.id)} aria-label={t.edit}>{t.edit}</button>
                </div>
              ))}
            </section>
          )
        })}
      </div>
      <div className="sf-actions">
        <button className="sf-btn ghost" onClick={onBack}><IcoBack/>{t.back}</button>
        <button className="sf-btn" onClick={onNext} disabled={missing.length > 0}>{t.toStory}<IcoFwd/></button>
      </div>
    </div>
  )
}

// ═══ STORY (final slide: narrative presentation + submit) ═════════════════════
function Story({ answers, lang, t, onBack, consent, setConsent, onSubmit, submitting, submitErr }) {
  const paras = useMemo(() => buildStory(answers, lang), [answers, lang])
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard?.writeText(storyText(answers, lang)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }) }
  const first = String(answers.c_name || '').trim().split(/\s+/)[0]
  const rental = answers.x_purpose === 'rental'
  const storyFacts = [
    answers.d_ask ? { k: rental ? t.factRent : t.factPrice, v: `${fmtNum(answers.d_ask, lang)} ₪${rental ? (lang === 'en' ? ' / mo' : ' לחודש') : ''}`, hi: true } : null,
    roomsOf(answers) ? { k: t.factRooms, v: roomsOf(answers) } : null,
    answers.p_area?.built ? { k: t.factArea, v: fmtNum(answers.p_area.built, lang) } : null,
    answers.p_floor?.floor !== undefined && answers.p_floor?.floor !== '' && answers.p_floor?.floor !== null ? { k: t.factFloor, v: `${answers.p_floor.floor}${answers.p_floor.totalFloors ? ` / ${answers.p_floor.totalFloors}` : ''}` } : null,
    answers.p_state ? { k: t.factState, v: PROPERTY_STATE_LABEL(answers.p_state, lang) } : null,
  ].filter(Boolean)
  return (
    <div className="sf-story">
      <div className="sf-rk">{t.storyKicker}</div>
      <h2>{storyTitle(answers, lang) || t.storyKicker}</h2>
      {storyLine(answers, lang) && <p className="sf-rline">{storyLine(answers, lang)}</p>}
      <p className="sf-rsub">{rental ? t.storySubRent : t.storySub}</p>
      <article className="sf-paper">
        <header className="sf-paper-h">
          <img src="/logo-mark-black.svg" alt="" className="sf-paper-logo"/>
          <div className="sf-paper-t"><b>{t.storyDoc} · {PROPERTY_TYPE_LABEL(answers.p_type, lang) || t.brand}</b><small>{[addressLine(answers, lang), answers.c_name ? `${t.preparedFor} ${String(answers.c_name).trim()}` : ''].filter(Boolean).join(' · ')}</small></div>
          <button type="button" className="sf-link" onClick={copy}><IcoCopy/> {copied ? t.copied : t.copyStory}</button>
        </header>
        {storyFacts.length > 0 && <div className="sf-facts light">{storyFacts.map(x => <div key={x.k} className={`sf-fact${x.hi ? ' hi' : ''}`}><small>{x.k}</small><b>{x.v}</b></div>)}</div>}
        <div className="sf-paper-body">
          {paras.map((p, i) => (
            <section key={i} className="sf-para">
              <h3><span>{String(i + 1).padStart(2, '0')}</span>{p.title}</h3>
              <p>{p.text}</p>
            </section>
          ))}
        </div>
        <footer className="sf-paper-f"><span>{t.storyFoot}</span><span>{t.storyBy}</span></footer>
      </article>
      <label className={`sf-consent${consent ? ' on' : ''}`}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}/>
        <span className="sf-box" style={consent ? { background: 'var(--deep)', borderColor: 'var(--deep)' } : undefined}><IcoCheck size={13}/></span>
        <span>{t.consent}</span>
      </label>
      {submitErr && <div className="sf-err" role="alert"><IcoWarn/>{submitErr}</div>}
      <div className="sf-actions">
        <button className="sf-btn ghost" onClick={onBack}><IcoBack/>{t.back}</button>
        <button className="sf-btn big" onClick={onSubmit} disabled={submitting}>{submitting ? t.submitting : t.submit} {!submitting && <IcoCheck size={16}/>}</button>
        {submitErr && <a className="sf-btn ghost" href={`https://wa.me/${OFFICE_WA}`} target="_blank" rel="noreferrer"><IcoWa/> WhatsApp</a>}
      </div>
      <p className="sf-privacy-line">{t.privacyNote}</p>
    </div>
  )
}

function FilesLine({ files, lang, t }) {
  const done = (files || []).filter(f => f.status === 'done')
  if (!done.length) return null
  const byTag = done.reduce((m, f) => { const k = f.tag || ''; m[k] = (m[k] || 0) + 1; return m }, {})
  const parts = Object.entries(byTag).map(([k, n]) => k ? `${DOC_TAG_LABEL(k, lang)} (${n})` : fill(t.files, { n }))
  return <span>{parts.join(' · ')}</span>
}

