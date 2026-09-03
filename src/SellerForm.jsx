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
} from './sellerFormSchema.js'

const API = import.meta.env.PROD ? '' : (import.meta.env.VITE_SELLER_API_BASE || '')
const DRAFT_KEY = 'afik_seller_form_v1'
const OFFICE_WA = '972559811814'
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap'

// ── UI strings (Hebrew + English) ────────────────────────────────────────────
const T = {
  he: {
    brand: 'אפיק הנחל', tagline: 'ייזום · שיווק · תיווך',
    welcomeKicker: 'טופס שיווק נכס',
    welcomeTitle: 'בואו נשווק את הנכס שלכם',
    welcomeSub: 'כמה שאלות קצרות, שאלה אחת בכל מסך, ואנחנו מתחילים לעבוד.',
    bul1: 'כ־10 דקות', bul2: 'נשמר אוטומטית', bul3: 'פרטי ומאובטח',
    start: 'בואו נתחיל', resume: 'להמשיך מאיפה שעצרתי', restart: 'להתחיל מחדש',
    savedDraft: 'מצאנו טופס שהתחלתם למלא',
    ok: 'אישור', cont: 'המשך', back: 'חזרה', press: 'או לחצו', requiredMark: 'שדה חובה',
    of: 'מתוך', part: 'חלק', optional: 'לא חובה',
    selectMany: 'אפשר לבחור כמה תשובות', selectOne: 'בחרו תשובה אחת',
    yes: 'כן', no: 'לא',
    dropTitle: 'גררו קבצים לכאן או לחצו לבחירה', dropSub: 'עד {n} קבצים · עד {mb}MB לקובץ',
    uploading: 'מעלה…', uploadDone: 'הועלה', uploadErr: 'ההעלאה נכשלה', retry: 'נסו שוב', remove: 'הסרה',
    docTypePick: 'איזה מסמך אתם מעלים עכשיו?', laterWhatsapp: 'אפשר לדלג ולשלוח לנו מאוחר יותר בוואטסאפ',
    fileTooBig: '{name}: הקובץ גדול מדי (מקסימום {mb}MB)', tooMany: 'אפשר להעלות עד {n} קבצים בשלב הזה', wrongType: '{name}: סוג הקובץ לא נתמך כאן',
    uploadedCount: '{n} קבצים הועלו',
    reviewTitle: 'הנה מה שסיפרתם לנו', reviewSub: 'עברו על הפרטים. אפשר לערוך כל תשובה בלחיצה.',
    edit: 'עריכה', missingTitle: 'נשארו שאלות חובה שלא נענו', jump: 'מעבר לשאלה',
    consent: 'אני מאשר/ת שהפרטים שמסרתי נכונים למיטב ידיעתי, ומסכים/ה שאפיק הנחל תיצור איתי קשר בנוגע לשיווק הנכס.',
    submit: 'שליחת הטופס', submitting: 'שולחים…',
    submitErr: 'משהו השתבש בשליחה. הטופס שלכם שמור, נסו שוב בעוד רגע או שלחו לנו הודעה בוואטסאפ.',
    consentErr: 'צריך לאשר את ההצהרה כדי לשלוח',
    doneTitle: 'תודה, {name}!', doneSub: 'תיק הנכס הגיע אלינו. נעבור על הפרטים וניצור איתכם קשר תוך יום עסקים כדי לתאם את הצעד הבא.',
    refLabel: 'מספר תיק', doneWa: 'לשלוח לנו הודעה בוואטסאפ', doneHome: 'חזרה לאתר אפיק הנחל', copyRef: 'העתקת מספר התיק', copied: 'הועתק',
    autosaved: 'נשמר אוטומטית', privacyNote: 'הפרטים נשמרים באופן מאובטח ומשמשים את אפיק הנחל בלבד.',
    files: '{n} קבצים', minus: 'פחות', plus: 'יותר', langToggle: 'English',
    waMsg: 'היי, מילאתי את טופס שיווק הנכס (תיק {ref}) ואשמח להמשיך משם',
    progress: 'התקדמות', question: 'שאלה',
  },
  en: {
    brand: 'Afik Hanahal', tagline: 'Development · Marketing · Brokerage',
    welcomeKicker: 'Property marketing form',
    welcomeTitle: "Let's market your property",
    welcomeSub: 'A few short questions, one per screen, and we get to work.',
    bul1: 'About 10 minutes', bul2: 'Auto-saved', bul3: 'Private and secure',
    start: "Let's start", resume: 'Continue where I stopped', restart: 'Start over',
    savedDraft: 'We found a form you started',
    ok: 'OK', cont: 'Continue', back: 'Back', press: 'or press', requiredMark: 'Required',
    of: 'of', part: 'Part', optional: 'Optional',
    selectMany: 'Select as many as apply', selectOne: 'Select one answer',
    yes: 'Yes', no: 'No',
    dropTitle: 'Drag files here or click to choose', dropSub: 'Up to {n} files · {mb}MB per file',
    uploading: 'Uploading…', uploadDone: 'Uploaded', uploadErr: 'Upload failed', retry: 'Retry', remove: 'Remove',
    docTypePick: 'Which document are you uploading now?', laterWhatsapp: 'You can skip and send it later via WhatsApp',
    fileTooBig: '{name}: file is too large (max {mb}MB)', tooMany: 'Up to {n} files can be uploaded here', wrongType: '{name}: this file type is not supported here',
    uploadedCount: '{n} files uploaded',
    reviewTitle: "Here's what you told us", reviewSub: 'Review the details. Click any answer to edit it.',
    edit: 'Edit', missingTitle: 'Some required questions are still unanswered', jump: 'Go to question',
    consent: 'I confirm the details I provided are accurate to the best of my knowledge, and I agree that Afik Hanahal may contact me regarding marketing this property.',
    submit: 'Submit form', submitting: 'Sending…',
    submitErr: 'Something went wrong. Your form is saved. Try again in a moment or message us on WhatsApp.',
    consentErr: 'Please confirm the statement to submit',
    doneTitle: 'Thank you, {name}!', doneSub: 'Your property file has reached us. We will review the details and contact you within one business day to plan the next step.',
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
.sf-lang { display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:700; padding:8px 13px; border-radius:6px; border:1px solid var(--line2); background:var(--paper); color:var(--ink); cursor:pointer; transition:all .2s; }
.sf-lang:hover { border-color:var(--deep); color:var(--deep); background:var(--tint); }

/* ── stage ─────────────────────────────────────────────────────────────── */
.sf-stage { min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:100px clamp(18px,5vw,48px) 130px; }
.sf-card { width:100%; max-width:720px; }
.sf-qhead { display:flex; align-items:flex-start; gap:12px; }
.sf-badge { flex:none; margin-top:7px; min-width:20px; height:20px; padding:0 5px; border-radius:4px; background:var(--ink); color:#fff; font-size:11px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; letter-spacing:.02em; }
.sf-q { font-size:clamp(20px, 2.6vw, 25px); font-weight:400; line-height:1.4; margin:0; color:var(--ink); }
.sf-q b { font-weight:700; }
.sf-q .req { color:var(--ink2); margin-inline-start:2px; }
.sf-sec { font-size:12px; color:var(--muted); margin-bottom:10px; letter-spacing:.02em; }
.sf-help { margin:8px 0 0 32px; font-size:16px; line-height:1.55; color:var(--muted); }
[dir="rtl"] .sf-help { margin:8px 32px 0 0; }
.sf-body { margin:26px 0 0 32px; }
[dir="rtl"] .sf-body { margin:26px 32px 0 0; }
.sf-hint { margin-top:10px; font-size:12.5px; color:var(--muted); }

/* ── inputs ────────────────────────────────────────────────────────────── */
.sf-input { width:100%; font-size:clamp(20px, 2.4vw, 26px); font-weight:400; padding:8px 0; border:0; border-bottom:1px solid var(--line2); background:transparent; color:var(--ink); border-radius:0; transition:border-color .2s, box-shadow .2s; }
.sf-input::placeholder { color:#A8A7AE; }
.sf-input:focus { outline:none; border-bottom-color:var(--ink); box-shadow:0 1px 0 0 var(--ink); }
.sf-input.is-err { border-bottom-color:var(--err); box-shadow:0 1px 0 0 var(--err); }
textarea.sf-input { resize:none; line-height:1.5; font-size:clamp(17px,2vw,20px); min-height:96px; }
.sf-input-wrap { position:relative; display:flex; align-items:center; gap:12px; }
.sf-unit { font-size:16px; color:var(--muted); white-space:nowrap; padding-bottom:4px; }

.sf-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px 22px; }
.sf-grid .full { grid-column:1 / -1; }
.sf-field label { display:block; font-size:12.5px; font-weight:600; letter-spacing:.02em; color:var(--ink2); margin-bottom:0; }
.sf-field label i { color:var(--deep); font-style:normal; margin-inline-start:3px; }
.sf-field .sf-input { font-size:18px; padding:7px 0; }
.sf-field .sf-unit { font-size:13px; }

/* ── choice / multi (Typeform-style grey boxes with key badges) ────────── */
.sf-opts { display:flex; flex-direction:column; gap:8px; align-items:flex-start; }
.sf-opts.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); align-items:stretch; }
.sf-opt { display:flex; align-items:center; gap:12px; min-width:250px; max-width:100%; padding:9px 12px; border:1px solid var(--line2); border-radius:4px; background:var(--box); color:var(--ink); font-size:16.5px; font-weight:400; text-align:start; cursor:pointer; transition:background .12s, border-color .12s, box-shadow .12s; min-height:44px; }
.sf-opts.grid .sf-opt { min-width:0; width:100%; }
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
.sf-counter { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 0; border-bottom:1px solid var(--line); }
.sf-counter:last-child { border-bottom:0; }
.sf-counter .lbl { font-size:17px; }
.sf-counter .ctl { display:flex; align-items:center; gap:12px; }
.sf-counter .ctl b { min-width:40px; text-align:center; font-size:24px; font-weight:600; font-variant-numeric:tabular-nums; }
.sf-round { width:40px; height:40px; border-radius:4px; border:1px solid var(--line2); background:var(--box); color:var(--ink); font-size:20px; line-height:1; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all .12s; }
.sf-round:hover { background:var(--boxHover); }
.sf-round:disabled { opacity:.35; cursor:default; }
.sf-mrow { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:11px 0; border-bottom:1px solid var(--line); flex-wrap:wrap; }
.sf-mrow:last-child { border-bottom:0; }
.sf-mrow .lbl { font-size:16px; flex:1 1 220px; }
.sf-mrow.is-err .lbl { color:var(--err); }
.sf-scale { display:flex; gap:6px; flex-wrap:wrap; }
.sf-pill { padding:7px 13px; border-radius:4px; border:1px solid var(--line2); background:var(--box); color:var(--ink2); font-size:13.5px; font-weight:500; cursor:pointer; transition:all .12s; white-space:nowrap; }
.sf-pill:hover { background:var(--boxHover); color:var(--ink); }
.sf-pill.on { background:var(--ink); border-color:var(--ink); color:#fff; }
.sf-pill.on.purple { background:var(--deep); border-color:var(--deep); }
.sf-seg { display:inline-flex; border:1px solid var(--line2); border-radius:4px; overflow:hidden; }
.sf-seg button { padding:7px 16px; border:0; background:var(--box); color:var(--ink2); font-size:13.5px; font-weight:600; cursor:pointer; transition:all .12s; }
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
.sf-file .nm { padding:7px 10px 3px; font-size:12px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sf-file .st { padding:0 10px 8px; font-size:11.5px; color:var(--muted); display:flex; align-items:center; justify-content:space-between; gap:6px; }
.sf-file .st.ok { color:var(--ok); } .sf-file .st.err { color:var(--err); }
.sf-file .bar { height:3px; background:var(--line); } .sf-file .bar i { display:block; height:100%; background:var(--deep); transition:width .2s; }
.sf-file .x { position:absolute; top:6px; inset-inline-end:6px; width:24px; height:24px; border-radius:4px; border:0; background:rgba(38,36,43,.75); color:#fff; cursor:pointer; font-size:12px; display:inline-flex; align-items:center; justify-content:center; }
.sf-file .x:hover { background:var(--err); }
.sf-file select { font-size:11.5px; border:1px solid var(--line); border-radius:4px; padding:2px 4px; color:var(--ink2); background:#fff; max-width:100%; }
.sf-tags { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }

/* ── actions ───────────────────────────────────────────────────────────── */
.sf-actions { display:flex; align-items:center; gap:14px; margin:26px 0 0 32px; flex-wrap:wrap; }
[dir="rtl"] .sf-actions { margin:26px 32px 0 0; }
.sf-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 20px; border-radius:4px; border:1px solid var(--ink); background:var(--ink); color:#fff; font-size:16px; font-weight:700; cursor:pointer; transition:all .15s; text-decoration:none; }
.sf-btn:hover { background:var(--deep); border-color:var(--deep); }
.sf-btn:disabled { opacity:.5; cursor:default; }
.sf-btn.ghost { background:var(--paper); color:var(--ink); border-color:var(--line2); }
.sf-btn.ghost:hover { background:var(--tint); border-color:var(--deep); color:var(--deep); }
.sf-btn.big { padding:13px 28px; font-size:17px; }
.sf-btn.wa { background:#25D366; border-color:#25D366; }
.sf-btn.wa:hover { background:#1EBE5A; border-color:#1EBE5A; }
.sf-enter { font-size:12.5px; color:var(--muted); }
.sf-enter b { color:var(--ink2); font-weight:700; }
.sf-err { display:flex; align-items:center; gap:8px; margin:14px 0 0 32px; color:var(--err); font-size:14px; font-weight:500; background:#FDECEC; border:1px solid #F3C4C4; border-radius:4px; padding:9px 12px; }
[dir="rtl"] .sf-err { margin:14px 32px 0 0; }

/* ── footer nav (dark pill, bottom corner like Typeform) ───────────────── */
.sf-foot { position:fixed; bottom:0; inset-inline:0; padding:14px clamp(14px,3vw,32px) 16px; display:flex; align-items:center; justify-content:flex-end; gap:12px; z-index:50; pointer-events:none; }
.sf-foot > * { pointer-events:auto; }
.sf-nav { display:inline-flex; align-items:center; background:var(--ink); border-radius:6px; overflow:hidden; box-shadow:0 6px 18px rgba(0,0,0,.18); }
.sf-nav .cnt { font-size:12px; color:rgba(255,255,255,.75); padding:0 12px; font-variant-numeric:tabular-nums; }
.sf-nav button { width:40px; height:40px; border:0; background:transparent; color:#fff; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:background .12s; }
.sf-nav button + button { border-inline-start:1px solid rgba(255,255,255,.18); }
.sf-nav button:hover { background:var(--deep); }
.sf-nav button:disabled { opacity:.3; cursor:default; background:transparent; }
.sf-privacy { font-size:11.5px; color:var(--muted); display:none; }

/* ── welcome / intro / review / done ───────────────────────────────────── */
.sf-welcome { text-align:center; max-width:620px; margin:0 auto; }
.sf-welcome .logo { height:130px; width:auto; margin:0 auto 18px; display:block; }
.sf-kicker { display:inline-block; font-size:11.5px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:var(--deep); background:var(--tint2); border-radius:4px; padding:5px 12px; margin-bottom:16px; }
.sf-welcome h1 { font-size:clamp(28px, 4.6vw, 40px); font-weight:700; margin:0 0 12px; letter-spacing:-.01em; line-height:1.2; }
.sf-welcome p { font-size:17px; color:var(--ink2); line-height:1.6; margin:0 auto; max-width:520px; }
.sf-bullets { display:flex; justify-content:center; gap:20px; flex-wrap:wrap; margin:22px 0 28px; }
.sf-bullets span { display:inline-flex; align-items:center; gap:8px; font-size:13.5px; color:var(--ink2); }
.sf-bullets span i { width:7px; height:7px; border-radius:50%; background:var(--deep); display:inline-block; }
.sf-welcome-actions { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:24px; }
.sf-draftbox { margin:0 auto 20px; max-width:420px; padding:12px 16px; border-radius:6px; background:var(--tint2); font-size:14px; color:var(--ink); display:flex; align-items:center; gap:10px; justify-content:center; }
.sf-intro .n { font-size:12px; font-weight:700; color:var(--deep); letter-spacing:.14em; margin-bottom:10px; }
.sf-intro h2 { font-size:clamp(26px, 4vw, 36px); font-weight:700; margin:0 0 10px; letter-spacing:-.01em; line-height:1.2; }
.sf-intro p { font-size:17px; color:var(--ink2); line-height:1.55; margin:0; max-width:540px; }
.sf-intro .line { width:48px; height:3px; background:var(--deep); border-radius:2px; margin:18px 0 22px; }
.sf-intro .sf-actions, .sf-review .sf-actions { margin-inline-start:0; }
.sf-review h2 { font-size:clamp(24px, 3.2vw, 32px); font-weight:700; margin:0 0 6px; }
.sf-review > p { margin:0 0 22px; color:var(--muted); font-size:15px; }
.sf-rsec { border:1px solid var(--line); border-radius:6px; padding:4px 18px; margin-bottom:12px; background:var(--paper); }
.sf-rsec h3 { font-size:12px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--deep); margin:14px 0 4px; }
.sf-ritem { display:flex; align-items:flex-start; gap:12px; padding:10px 0; border-top:1px solid var(--line); }
.sf-ritem .k { flex:0 0 38%; font-size:13px; color:var(--muted); line-height:1.4; }
.sf-ritem .v { flex:1; font-size:15px; line-height:1.45; white-space:pre-wrap; word-break:break-word; }
.sf-ritem button { flex:none; border:0; background:none; color:var(--deep); font-size:13px; font-weight:600; cursor:pointer; padding:2px 6px; border-radius:4px; }
.sf-ritem button:hover { background:var(--tint); }
.sf-missing { border:1px solid #F3C4C4; background:#FDECEC; border-radius:6px; padding:12px 16px; margin-bottom:14px; }
.sf-missing h4 { margin:0 0 6px; font-size:14.5px; color:var(--err); }
.sf-missing button { display:block; border:0; background:none; color:var(--deep); font-size:14px; padding:3px 0; cursor:pointer; text-align:start; }
.sf-consent { display:flex; gap:12px; align-items:flex-start; padding:14px 16px; border:1px solid var(--line2); border-radius:4px; cursor:pointer; margin-top:20px; font-size:14.5px; line-height:1.5; color:var(--ink2); background:var(--box); transition:all .12s; }
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
  .sf-top-right { position:absolute; inset-inline-start:12px; top:50%; transform:translateY(-50%); }
  .sf-stepper { display:none; }
  .sf-logo { height:32px; }
  .sf-brandtxt { display:none; }
  .sf-saved { display:none; }
  .sf-lang { padding:7px 11px; font-size:12.5px; }
  .sf-stage { align-items:center; padding:84px 18px 96px; }
  .sf-opt { min-height:50px; font-size:17px; }
  .sf-pill { padding:9px 14px; font-size:14px; }
  .sf-round { width:44px; height:44px; }
  .sf-file select, .sf-field .sf-input { font-size:16px; }
  .sf-btn { min-height:50px; font-size:17px; }
  .sf-nav button { width:46px; height:46px; }
  .sf-card { text-align:center; }
  .sf-sec { text-align:center; }
  .sf-qhead { flex-direction:column; align-items:center; gap:10px; }
  .sf-badge { margin-top:0; }
  .sf-q { font-size:21px; text-align:center; text-wrap:balance; }
  .sf-help { text-align:center; text-wrap:balance; }
  .sf-help, .sf-body, .sf-actions, .sf-err { margin-inline-start:0 !important; margin-inline-end:0 !important; }
  .sf-input { text-align:center !important; }
  .sf-field label { text-align:center; }
  .sf-hint { text-align:center; }
  .sf-actions { justify-content:center; flex-direction:column; gap:8px; }
  .sf-actions .sf-btn { width:100%; justify-content:center; }
  .sf-err { justify-content:center; text-align:center; }
  .sf-mrow { flex-direction:column; align-items:center; text-align:center; gap:8px; }
  .sf-mrow .lbl { flex-basis:auto; }
  .sf-scale { justify-content:center; }
  .sf-counter { flex-direction:column; gap:8px; }
  .sf-tags { justify-content:center; }
  .sf-intro { text-align:center; }
  .sf-intro .line { margin:18px auto 22px; }
  .sf-intro p { margin:0 auto; }
  .sf-review { text-align:start; }
  .sf-review h2, .sf-review > p { text-align:center; }
  .sf-welcome .logo { height:120px; }
  .sf-welcome-actions .sf-btn { width:100%; justify-content:center; }
  .sf-welcome h1 { font-size:27px; }
  .sf-welcome p { font-size:16px; }
  .sf-bullets { gap:8px 14px; margin:18px 0 4px; }
  .sf-bullets span { font-size:12.5px; }
  .sf-grid { grid-template-columns:1fr; }
  .sf-opts { align-items:stretch; }
  .sf-opt { min-width:0; width:100%; }
  .sf-opts.grid { grid-template-columns:1fr; }
  .sf-counter .lbl { font-size:15.5px; }
  .sf-ritem { flex-direction:column; gap:3px; }
  .sf-ritem .k { flex-basis:auto; }
  .sf-ritem button { align-self:flex-end; margin-top:-26px; }
  .sf-enter { display:none; }
  .sf-welcome .logo { height:110px; }
  .sf-foot { padding:10px 14px max(12px, env(safe-area-inset-bottom)); }
  .sf-btn { padding:11px 18px; }
}
@media (prefers-reduced-motion: reduce) { .sf-root * { animation:none !important; transition:none !important; } }
`

// ── icons (inline SVG keeps the page self-contained) ─────────────────────────
const IcoCheck = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
const IcoUp    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
const IcoDown  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
const IcoUpload = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>
const IcoFile  = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/></svg>
const IcoVideo = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
const IcoWarn  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
const IcoWa    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3C4.1 15 3.7 13.5 3.7 12c0-4.6 3.7-8.3 8.3-8.3s8.3 3.7 8.3 8.3-3.7 8.2-8.3 8.2z"/></svg>

const IcoGlobe = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>

// Bold the key phrase of a question, Typeform style ("what's **the main thing**…")
function Emph({ text, phrase }) {
  if (!phrase) return text
  const i = text.indexOf(phrase)
  if (i < 0) return text
  return <>{text.slice(0, i)}<b>{phrase}</b>{text.slice(i + phrase.length)}</>
}

// Top stepper: every section with its number, done sections ticked, current highlighted.
function Stepper({ curIdx, lang }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.querySelector('.sf-step.cur')?.scrollIntoView({ inline: 'center', block: 'nearest' }) }, [curIdx])
  return (
    <nav className="sf-stepper" ref={ref} aria-label="sections">
      {SECTIONS.map((s, i) => (
        <span key={s.id} className={`sf-step${i < curIdx ? ' done' : i === curIdx ? ' cur' : ''}${Math.abs(i - curIdx) === 1 ? ' near' : ''}`} aria-current={i === curIdx ? 'step' : undefined}>
          <i>{i < curIdx ? <IcoCheck size={10}/> : s.n}</i>
          <b>{lang === 'en' ? s.en : s.title}</b>
          {i < SECTIONS.length - 1 && <em/>}
        </span>
      ))}
    </nav>
  )
}

const LOGO_SRC = '/logo-black.svg'
const stepVariants = {
  enter: d => ({ y: d > 0 ? 56 : -56, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: d => ({ y: d > 0 ? -56 : 56, opacity: 0 }),
}
const stepTransition = { duration: .34, ease: [.16, 1, .3, 1] }

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
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [result, setResult] = useState(null)
  const sidRef = useRef(null)
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
    const d = loadDraft()
    if (d) { setDraft(d); sidRef.current = d.sid || null }
    return () => { document.body.style.background = prevBg }
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
      saveDraft({ answers: stripFilesForDraft(answers), cur, sid: sidRef.current, lang, savedAt: Date.now(), v: SCHEMA_VERSION })
      setSavedTick(x => x + 1)
    }, 500)
    return () => clearTimeout(h)
  }, [answers, cur, phase, lang])

  const setAnswer = useCallback((id, v) => {
    setErr(null)
    setAnswers(prev => ({ ...prev, [id]: typeof v === 'function' ? v(prev[id]) : v }))
  }, [])

  // ── navigation ───────────────────────────────────────────────────────────
  const goTo = useCallback((id, d = 1) => { setDir(d); setErr(null); setCur(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [])
  const goNext = useCallback(() => {
    if (!step) return
    const e = validateStep(step, answers)
    if (e) { setErr(e); return }
    if (idx < total - 1) goTo(visible[idx + 1].id, 1)
  }, [step, answers, idx, total, visible, goTo])
  const goPrev = useCallback(() => { if (idx > 0) goTo(visible[idx - 1].id, -1) }, [idx, visible, goTo])

  const begin = (resume) => {
    if (resume && draft) {
      setAnswers(draft.answers || {})
      setCur(draft.cur && STEPS.some(s => s.id === draft.cur) ? draft.cur : STEPS[0].id)
      if (draft.lang) setLang(draft.lang)
    } else {
      clearDraft(); setAnswers({}); setCur(STEPS[0].id); sidRef.current = null
    }
    if (!sidRef.current) sidRef.current = uid()
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
        if (el?.tagName === 'BUTTON' || el?.tagName === 'A' || el?.tagName === 'SELECT') return
        if (step.type === 'review') return
        e.preventDefault(); goNext(); return
      }
      if (e.key === 'ArrowDown' && !inTextarea && el?.type !== 'number') { e.preventDefault(); goNext(); return }
      if (e.key === 'ArrowUp' && !inTextarea && el?.type !== 'number') { e.preventDefault(); goPrev(); return }
      if (!inText && (step.type === 'choice' || step.type === 'multi') && /^[a-zA-Z]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const i = LETTERS.indexOf(e.key.toUpperCase())
        const opt = step.opts?.[i]
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
    }, 360)
    return () => clearTimeout(h)
  }, [cur, phase])

  // Like Typeform's onboarding: picking an option highlights it, "Continue" (or Enter) moves on.
  const pickChoice = v => setAnswer(step.id, v)
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
          sid: sidRef.current, lang, schemaVersion: SCHEMA_VERSION, answers: clean, files,
          meta: { url: location.href, ua: navigator.userAgent, startedAt: startedAt.current, durationSec: Math.round((Date.now() - startedAt.current) / 1000) },
        }),
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok || !data.ok) throw new Error(data.error || `HTTP ${r.status}`)
      setResult({ ref: data.ref, name: answers.c_name })
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
      <header className="sf-top">
        <a href="/" aria-label={t.brand} className="sf-brand">
          <img className="sf-logo" src="/logo-mark-black.svg" alt={t.brand}/>
          <span className="sf-brandtxt">{t.brand}<small>{t.tagline}</small></span>
        </a>
        {phase === 'form' ? <Stepper curIdx={sectionIdx} lang={lang}/> : <div style={{ flex: 1 }}/>}
        <div className="sf-top-right">
          {phase === 'form' && <span className="sf-saved" key={savedTick} style={{ opacity: savedTick ? 1 : 0 }}><i/>{t.autosaved}</span>}
          <button className="sf-lang" onClick={() => setLang(l => l === 'he' ? 'en' : 'he')} aria-label="Switch language" lang={lang === 'he' ? 'en' : 'he'}><IcoGlobe/>{t.langToggle}</button>
        </div>
      </header>

      <main className="sf-stage" ref={stageRef}>
        {phase === 'welcome' && (
          <Welcome t={t} lang={lang} draft={draft} onStart={() => begin(false)} onResume={() => begin(true)}/>
        )}

        {phase === 'form' && step && (
          <div className="sf-card">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div key={step.id} custom={dir} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={stepTransition}>
                {step.type === 'intro' && (
                  <Intro section={section} t={t} lang={lang} onNext={goNext}/>
                )}
                {step.type === 'review' && (
                  <Review answers={answers} lang={lang} t={t} visible={visible} onEdit={id => goTo(id, -1)}
                    consent={!!answers.__consent} setConsent={v => { setSubmitErr(''); setAnswer('__consent', v) }}
                    onSubmit={submit} submitting={submitting} submitErr={submitErr}/>
                )}
                {!['intro', 'review'].includes(step.type) && (
                  <>
                    <div className="sf-sec">{t.part} {section?.n} · {lang === 'en' ? section?.en : section?.title}</div>
                    <div className="sf-qhead">
                      <span className="sf-badge" aria-hidden="true">{qNumber}</span>
                      <h2 className="sf-q">
                        <Emph text={lang === 'en' ? (step.en_q || step.q) : step.q} phrase={EMPHASIS[step.id]?.[lang === 'en' ? 1 : 0]}/>
                        {isReq ? <span className="req" title={t.requiredMark}>*</span> : <span className="sf-opt-tag"> ({t.optional})</span>}
                      </h2>
                    </div>
                    {(step.help || step.en_help) && <p className="sf-help">{lang === 'en' ? (step.en_help || step.help) : step.help}</p>}
                    <div className="sf-body">
                      <Field step={step} answers={answers} value={answers[step.id]} setValue={v => setAnswer(step.id, v)} lang={lang} t={t} err={err}
                        onEnter={goNext} pickChoice={pickChoice} toggleMulti={toggleMulti} sid={sidRef.current}/>
                    </div>
                    {err && <div className="sf-err" role="alert"><IcoWarn/>{VALIDATION_MSG[lang][err]}</div>}
                    <div className="sf-actions">
                      <button className="sf-btn" onClick={goNext}>{t.cont}</button>
                      <span className="sf-enter">{t.press} <b>{step.type === 'long' ? 'Ctrl + Enter ↵' : 'Enter ↵'}</b></span>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {phase === 'done' && <Done t={t} result={result}/>}
      </main>

      {phase === 'form' && (
        <footer className="sf-foot">
          <div className="sf-nav">
            <span className="cnt">{idx + 1} {t.of} {total}</span>
            <button onClick={goPrev} disabled={idx === 0} aria-label={t.back}><IcoUp/></button>
            <button onClick={goNext} disabled={idx >= total - 1} aria-label={t.cont}><IcoDown/></button>
          </div>
        </footer>
      )}
    </div>
  )
}

// ═══ WELCOME ══════════════════════════════════════════════════════════════════
function Welcome({ t, lang, draft, onStart, onResume }) {
  const hasDraft = draft && Object.keys(draft.answers || {}).length > 0
  return (
    <div className="sf-welcome">
      <img className="logo" src={LOGO_SRC} alt={t.brand}/>
      <span className="sf-kicker">{t.welcomeKicker}</span>
      <h1>{t.welcomeTitle}</h1>
      <p>{t.welcomeSub}</p>
      <div className="sf-bullets">
        <span><i/>{t.bul1}</span><span><i/>{t.bul2}</span><span><i/>{t.bul3}</span>
      </div>
      {hasDraft && <div className="sf-draftbox"><IcoWarn/>{t.savedDraft}</div>}
      <div className="sf-welcome-actions">
        {hasDraft
          ? <><button className="sf-btn big" onClick={onResume} data-autofocus>{t.resume}</button><button className="sf-btn big ghost" onClick={onStart}>{t.restart}</button></>
          : <button className="sf-btn big" onClick={onStart} data-autofocus>{t.start}</button>}
      </div>
    </div>
  )
}

// ═══ SECTION INTRO ════════════════════════════════════════════════════════════
function Intro({ section, t, lang, onNext }) {
  if (!section) return null
  return (
    <div className="sf-intro">
      <div className="n">{t.part} {section.n} / {SECTIONS.length}</div>
      <h2>{lang === 'en' ? section.en : section.title}</h2>
      <div className="line"/>
      <p>{lang === 'en' ? section.en_desc : section.desc}</p>
      <div className="sf-actions">
        <button className="sf-btn" onClick={onNext} data-autofocus>{t.cont}</button>
        <span className="sf-enter">{t.press} <b>Enter ↵</b></span>
      </div>
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

function TextInput({ step, value, setValue, lang, err }) {
  const type = step.type === 'phone' ? 'tel' : step.type === 'email' ? 'email' : step.type === 'date' ? 'date' : 'text'
  return (
    <input className={`sf-input${err ? ' is-err' : ''}`} type={type} inputMode={step.type === 'phone' ? 'tel' : undefined}
      value={value || ''} onChange={e => setValue(e.target.value)} placeholder={lang === 'en' ? (step.en_ph || step.ph) : step.ph}
      autoComplete={step.autocomplete || (step.type === 'phone' ? 'tel' : step.type === 'email' ? 'email' : 'off')}
      dir={step.type === 'phone' || step.type === 'email' ? 'ltr' : undefined}
      style={step.type === 'phone' || step.type === 'email' ? { textAlign: lang === 'he' ? 'right' : 'left' } : undefined}
      enterKeyHint="next" data-autofocus aria-invalid={!!err}/>
  )
}

function LongInput({ step, value, setValue, lang, err }) {
  const ref = useRef(null)
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(360, el.scrollHeight) + 'px' } }, [value])
  return (
    <textarea ref={ref} className={`sf-input${err ? ' is-err' : ''}`} rows={3} value={value || ''} onChange={e => setValue(e.target.value)}
      placeholder={lang === 'en' ? (step.en_ph || step.ph) : step.ph} data-autofocus aria-invalid={!!err}/>
  )
}

function NumberInput({ step, value, setValue, lang, err }) {
  const unit = lang === 'en' ? (step.en_unit || step.unit) : step.unit
  const shown = step.thousands && value !== undefined && value !== '' ? fmtNum(value, 'en') : (value ?? '')
  const onChange = e => {
    const raw = e.target.value.replace(/[^\d.]/g, '')
    setValue(raw === '' ? '' : raw)
  }
  return (
    <div className="sf-input-wrap">
      <input className={`sf-input${err ? ' is-err' : ''}`} type="text" inputMode="decimal" value={shown} onChange={onChange}
        placeholder={lang === 'en' ? (step.en_ph || step.ph) : step.ph} dir="ltr" style={{ textAlign: lang === 'he' ? 'right' : 'left' }}
        enterKeyHint="next" data-autofocus aria-invalid={!!err}/>
      {unit && <span className="sf-unit">{unit}</span>}
    </div>
  )
}

function Choice({ step, value, lang, t, pickChoice }) {
  const [flash, setFlash] = useState(null)
  return (
    <>
      <div className={`sf-opts${step.grid ? ' grid' : ''}`} role="radiogroup">
        {step.opts.map((o, i) => (
          <button key={o.v} type="button" role="radio" aria-checked={value === o.v}
            className={`sf-opt${value === o.v ? ' on' : ''}${flash === o.v ? ' flash' : ''}`}
            onClick={() => { setFlash(o.v); pickChoice(o.v) }}>
            <span className="sf-key">{LETTERS[i]}</span>
            <span>{L(o, lang)}</span>
            <span className="sf-check"><IcoCheck size={18}/></span>
          </button>
        ))}
      </div>
      <div className="sf-hint">{t.selectOne}</div>
    </>
  )
}

function Multi({ step, value, lang, t, toggleMulti }) {
  const arr = Array.isArray(value) ? value : []
  return (
    <>
      <div className={`sf-opts${step.opts.length > 6 ? ' grid' : ''}`} role="group">
        {step.opts.map((o, i) => (
          <button key={o.v} type="button" aria-pressed={arr.includes(o.v)} className={`sf-opt${arr.includes(o.v) ? ' on' : ''}`} onClick={() => toggleMulti(o.v)}>
            <span className="sf-key">{LETTERS[i]}</span>
            <span>{L(o, lang)}</span>
            <span className="sf-box"><IcoCheck size={13}/></span>
          </button>
        ))}
      </div>
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
    <div>
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

function Group({ step, value, setValue, answers, lang, err }) {
  const fields = visibleFields(step, answers)
  const v = value || {}
  const bad = err ? groupInvalidFields(step, answers) : []
  return (
    <div className="sf-grid">
      {fields.map((f, i) => {
        const req = typeof f.required === 'function' ? f.required(answers) : f.required
        const unit = lang === 'en' ? (f.en_unit || f.unit) : f.unit
        const isNum = f.type === 'number'
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
              <div className="th">{f.preview ? <img src={f.preview} alt=""/> : f.type?.startsWith('video/') ? <IcoVideo/> : <IcoFile/>}</div>
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

// ═══ REVIEW ═══════════════════════════════════════════════════════════════════
function Review({ answers, lang, t, visible, onEdit, consent, setConsent, onSubmit, submitting, submitErr }) {
  const summary = useMemo(() => buildSummary(answers, lang), [answers, lang])
  const missing = visible.filter(s => validateStep(s, answers))
  return (
    <div className="sf-review">
      <h2>{t.reviewTitle}</h2>
      <p>{t.reviewSub}</p>
      {missing.length > 0 && (
        <div className="sf-missing">
          <h4>{t.missingTitle}</h4>
          {missing.map(s => <button key={s.id} type="button" onClick={() => onEdit(s.id)}>→ {lang === 'en' ? (s.en_q || s.q) : s.q}</button>)}
        </div>
      )}
      {summary.map(sec => (
        <div className="sf-rsec" key={sec.section}>
          <h3>{sec.title}</h3>
          {sec.items.map(it => (
            <div className="sf-ritem" key={it.id}>
              <span className="k">{it.label}</span>
              <span className="v">{it.type === 'upload' ? <FilesLine files={answers[it.id]} lang={lang} t={t}/> : it.value}</span>
              <button type="button" onClick={() => onEdit(it.id)}>{t.edit}</button>
            </div>
          ))}
        </div>
      ))}
      <label className={`sf-consent${consent ? ' on' : ''}`}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}/>
        <span className="sf-box" style={consent ? { background: 'var(--deep)', borderColor: 'var(--deep)' } : undefined}><IcoCheck size={13}/></span>
        <span>{t.consent}</span>
      </label>
      {submitErr && <div className="sf-err" role="alert"><IcoWarn/>{submitErr}</div>}
      <div className="sf-actions">
        <button className="sf-btn big" onClick={onSubmit} disabled={submitting || missing.length > 0}>{submitting ? t.submitting : t.submit} {!submitting && <IcoCheck size={16}/>}</button>
        {submitErr && <a className="sf-btn ghost" href={`https://wa.me/${OFFICE_WA}`} target="_blank" rel="noreferrer"><IcoWa/> WhatsApp</a>}
      </div>
      <p style={{ marginTop: 18, fontSize: 12.5, color: 'var(--muted)' }}>{t.privacyNote}</p>
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

// ═══ DONE ═════════════════════════════════════════════════════════════════════
function Done({ t, result }) {
  const [copied, setCopied] = useState(false)
  const ref = result?.ref || ''
  const first = String(result?.name || '').trim().split(/\s+/)[0] || ''
  return (
    <div className="sf-done">
      <div className="ck"><IcoCheck size={38}/></div>
      <h1>{fill(t.doneTitle, { name: first }).replace(', !', '!')}</h1>
      <p>{t.doneSub}</p>
      {ref && (
        <div className="sf-ref">
          <small>{t.refLabel}</small>
          <b dir="ltr">{ref}</b>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(ref).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }) }}>{copied ? t.copied : t.copyRef}</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: ref ? 0 : 26 }}>
        <a className="sf-btn wa" href={`https://wa.me/${OFFICE_WA}?text=${encodeURIComponent(fill(t.waMsg, { ref }))}`} target="_blank" rel="noreferrer"><IcoWa/> {t.doneWa}</a>
        <a className="sf-btn ghost" href="/">{t.doneHome}</a>
      </div>
    </div>
  )
}
