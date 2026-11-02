// SmartVoiceInput — the one mic of the whole admin (every note, call summary, task, property description…). Tap the mic, speak
// Hebrew freely, finish: the recording is transcribed (src/lib/voiceService.js → the server's speech-to-text, or the browser's
// own recognition when no key is set) and turned into clean text in the box the mic belongs to — still editable, saved only by
// the box's own save button. After it: switch between "מדויק" (what was said, cleaned), "סיכום חכם" and "סיכום שיחה"
// (titled sections), go back to the words as said, record again, and approve the tasks that were said (when the box belongs to
// a lead: onCreateTasks). While recording: a timer, a live waveform, pause / resume, cancel, finish. The panel floats (no
// layout shift, never blocks the screen); on a phone it sits at the bottom, above the keyboard. If the box closes mid-way the
// session goes on and VoiceHost (mounted once in AdminPanel) offers the text to copy.
// Props: value / onChange (the target field), contextType ('note' | 'call' | 'meeting' | 'task' | 'property'), recordId,
// lang, hint (names that may be said — the lead, the project), transcriptionMode (the first mode), inputRef (focus after),
// onCreateTasks(items) → Promise (a lead's task items, lib/follow-up.js shape), size ('sm').
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { VoiceSession, subscribeHost, detachedSessions } from './lib/voiceService.js'
import { joinText, fmtClock, dictationError, voiceTaskItem } from './lib/dictation.js'
import { fromIsraelLocal, describeDue } from '../lib/follow-up.js'

const TR = {
  he: {
    mic: 'הקלטה קולית', tip: 'הקלטה קולית: לוחצים, מדברים בחופשיות, ומקבלים טקסט מסודר בעברית תקינה',
    rec: 'מקליט', paused: 'מושהה', pause: 'השהיה', resume: 'המשך', cancel: 'ביטול ההקלטה', finish: 'סיום ותמלול',
    serverHint: 'הטקסט יופיע בתיבה כשתסיימו', liveHint: 'המילים נכתבות בתיבה תוך כדי',
    transcribing: 'מתמלל את ההקלטה…', processing: 'מסדר את הטקסט…', pieces: (d, n) => `${d} מתוך ${n} קטעים`,
    modes: { exact: 'תמלול מדויק', smart: 'סיכום חכם', call: 'סיכום שיחה', task: 'משימה' },
    modesTip: { exact: 'מה שנאמר, עם פיסוק ותיקון מילים שנשמעו לא נכון', smart: 'סיכום מקצועי ומסודר שלא משמיט אף פרט', call: 'סיכום מובנה: נושא, צרכים, מחירים, החלטות, שאלות פתוחות, פעולות המשך', task: 'שורה קצרה של מה לעשות' },
    inBox: 'הטקסט בתיבה, אפשר לערוך לפני השמירה', asSaid: 'כפי שנאמר', again: 'הקלטה חדשה', close: 'סגירה',
    edited: 'ערכתם את הטקסט. להחליף אותו בגרסה הזו?', replace: 'להחליף', keep: 'להשאיר',
    review: 'לבדיקה', tasksFound: n => (n === 1 ? 'זוהתה משימה אחת שנאמרה' : `זוהו ${n} משימות שנאמרו`), create: n => (n === 1 ? 'יצירת המשימה' : `יצירת ${n} משימות`),
    created: n => (n === 1 ? 'המשימה נוצרה ✓' : `${n} משימות נוצרו ✓`), createFail: 'יצירת המשימות נכשלה, נסו שוב', noDue: 'בלי מועד', uncertain: 'לא ברור, כדאי לבדוק',
    retry: 'נסו שוב', record: 'הקלטה מחדש', rawNote: { process: 'העיבוד לעברית תקינה לא זמין כרגע, הטקסט כפי שתומלל', offline: 'אין חיבור, הטקסט כפי שתומלל', 'too-long': 'הגעתם ל-15 דקות, ההקלטה נעצרה ותומללה' },
    hostTitle: 'הטקסט מההקלטה מוכן', copy: 'העתקה', copied: 'הועתק ✓', hostRec: 'הקלטה ממשיכה ברקע',
  },
  en: {
    mic: 'Voice input', tip: 'Voice input: tap, speak freely, get clean text',
    rec: 'Recording', paused: 'Paused', pause: 'Pause', resume: 'Resume', cancel: 'Cancel recording', finish: 'Finish and transcribe',
    serverHint: 'The text appears in the box when you finish', liveHint: 'The words appear in the box as you speak',
    transcribing: 'Transcribing…', processing: 'Tidying up the text…', pieces: (d, n) => `${d} of ${n} parts`,
    modes: { exact: 'Exact', smart: 'Smart summary', call: 'Call summary', task: 'Task' },
    modesTip: { exact: 'What was said, punctuated and corrected', smart: 'A clear summary that keeps every detail', call: 'Structured: topic, needs, prices, decisions, open questions, next steps', task: 'One short line of what to do' },
    inBox: 'The text is in the box; edit it before saving', asSaid: 'As spoken', again: 'Record again', close: 'Close',
    edited: 'You edited the text. Replace it with this version?', replace: 'Replace', keep: 'Keep',
    review: 'Check', tasksFound: n => (n === 1 ? '1 task was said' : `${n} tasks were said`), create: n => (n === 1 ? 'Create the task' : `Create ${n} tasks`),
    created: n => (n === 1 ? 'Task created ✓' : `${n} tasks created ✓`), createFail: 'Creating the tasks failed, try again', noDue: 'No date', uncertain: 'Unclear, check it',
    retry: 'Try again', record: 'Record again', rawNote: { process: 'Clean-up isn\'t available right now; the text is as transcribed', offline: 'Offline; the text is as transcribed', 'too-long': '15 minutes reached; the recording stopped and was transcribed' },
    hostTitle: 'The text from the recording is ready', copy: 'Copy', copied: 'Copied ✓', hostRec: 'Still recording in the background',
  },
}

const CSS = `
.svi-mic{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:0;min-height:0;width:34px;height:34px;padding:0;border-radius:999px;border:1px solid rgba(var(--ink),.14);background:transparent;color:var(--au-text2,#555);cursor:pointer;transition:background .15s,color .15s,border-color .15s;-webkit-tap-highlight-color:transparent}
.svi-mic:hover{background:rgba(var(--ov),.07);color:var(--au-text,#111)}
.svi-mic:focus-visible{outline:2px solid var(--au-brand,#3F4EB0);outline-offset:2px}
.svi-mic.sm{width:28px;height:28px}
.svi-mic.on{background:#E5484D;border-color:#E5484D;color:#fff}
.svi-mic.on::after{content:"";position:absolute;inset:-4px;border-radius:999px;border:2px solid #E5484D;opacity:0;animation:svi-ring 1.4s ease-out infinite;pointer-events:none}
.svi-mic.wait{color:var(--au-brand-text,#3F4EB0);border-color:rgba(var(--brand-rgb,63,78,176),.4)}
@keyframes svi-ring{0%{transform:scale(.9);opacity:.7}100%{transform:scale(1.3);opacity:0}}
.svi-panel{position:fixed;z-index:6000;width:min(400px,calc(100vw - 16px));background:var(--au-pop,#fff);color:var(--au-text,#111);border:1px solid rgba(var(--ink,0,0,0),.12);border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.26);font-size:13px;line-height:1.5;display:flex;flex-direction:column;gap:10px;padding:12px;box-sizing:border-box;max-height:min(70vh,560px);overflow:auto;overscroll-behavior:contain}
.svi-panel *{box-sizing:border-box}
.svi-panel button{font:inherit;min-height:0;min-width:0}
.svi-row{display:flex;align-items:center;gap:8px}
.svi-ib{flex:none;width:40px;height:40px;border-radius:999px;border:1px solid rgba(var(--ink,0,0,0),.14);background:transparent;color:inherit;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.svi-ib:hover{background:rgba(var(--ov,0,0,0),.07)}
.svi-ib.go{background:#00A884;border-color:#00A884;color:#fff}
.svi-ib.go:hover{background:#019574}
.svi-ib.del{color:#E5484D}
.svi-live{flex:1;min-width:0;display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-radius:999px;background:rgba(var(--ov,0,0,0),.05)}
.svi-dot{width:9px;height:9px;border-radius:50%;background:#E5484D;flex:none;animation:svi-blink 1.2s ease-in-out infinite}
.svi-dot.p{animation:none;background:var(--au-text3,#999)}
@keyframes svi-blink{50%{opacity:.25}}
.svi-time{font-variant-numeric:tabular-nums;direction:ltr;font-weight:700;flex:none}
.svi-wave{flex:1;min-width:40px;height:28px;display:block}
.svi-bars{flex:1;display:flex;align-items:center;justify-content:center;gap:3px;height:28px}
.svi-bars i{width:3px;height:30%;border-radius:2px;background:#E5484D;animation:svi-bar 1s ease-in-out infinite}
.svi-bars i:nth-child(2){animation-delay:.15s}.svi-bars i:nth-child(3){animation-delay:.3s}.svi-bars i:nth-child(4){animation-delay:.45s}.svi-bars i:nth-child(5){animation-delay:.6s}
.svi-bars.p i{animation:none}
@keyframes svi-bar{50%{height:90%}}
.svi-sub{font-size:11.5px;color:var(--au-text3,#888)}
.svi-busy{display:flex;align-items:center;gap:10px;padding:6px 2px;font-weight:600}
.svi-spin{width:16px;height:16px;border-radius:50%;border:2px solid currentColor;border-inline-end-color:transparent;animation:svi-spin .8s linear infinite;flex:none;color:var(--au-brand-text,#3F4EB0)}
@keyframes svi-spin{to{transform:rotate(360deg)}}
.svi-seg{display:flex;gap:2px;padding:3px;border-radius:10px;background:rgba(var(--ov,0,0,0),.06)}
.svi-seg button{flex:1;height:32px;padding:0 8px;border:none;border-radius:8px;background:transparent;color:var(--au-text2,#555);font-weight:600;cursor:pointer;white-space:nowrap;font-size:12.5px}
.svi-seg button[aria-pressed=true]{background:var(--au-card,#fff);color:var(--au-text,#111);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.svi-links{display:flex;gap:4px;flex-wrap:wrap;align-items:center}
.svi-link{border:none;background:transparent;color:var(--au-brand-text,#3F4EB0);font-weight:600;cursor:pointer;padding:4px 6px;border-radius:7px;font-size:12.5px}
.svi-link:hover{background:rgba(var(--brand-rgb,63,78,176),.08)}
.svi-note{font-size:12px;padding:8px 10px;border-radius:10px;background:rgba(245,166,35,.12)}
.svi-err{font-size:12.5px;padding:10px;border-radius:10px;background:rgba(229,72,77,.1);color:var(--au-red-text,#C2283E);line-height:1.6}
.svi-tasks{display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:12px;border:1px solid rgba(var(--ink,0,0,0),.1);background:rgba(var(--ov,0,0,0),.025)}
.svi-task{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;align-items:start}
.svi-task input[type=checkbox]{appearance:auto;-webkit-appearance:auto;width:17px;height:17px;margin:6px 0 0;accent-color:var(--au-brand,#3F4EB0)}
.svi-task .t{width:100%;height:32px;border-radius:8px;border:1px solid rgba(var(--ink,0,0,0),.14);background:var(--au-card,#fff);color:inherit;padding:0 8px;font:inherit;font-size:13px}
.svi-task .w{display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap;font-size:11.5px;color:var(--au-text3,#888)}
.svi-task .w input{height:28px;border-radius:7px;border:1px solid rgba(var(--ink,0,0,0),.14);background:var(--au-card,#fff);color:inherit;padding:0 6px;font:inherit;font-size:12px;direction:ltr}
.svi-task .u{color:#B26B00;font-weight:600}
.svi-pri{height:36px;padding:0 14px;border-radius:10px;border:none;background:var(--au-brand,#3F4EB0);color:#fff;font-weight:700;cursor:pointer}
.svi-pri:disabled{opacity:.5;cursor:default}
.svi-x{margin-inline-start:auto;width:30px;height:30px;border-radius:8px;border:none;background:transparent;color:var(--au-text3,#888);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.svi-x:hover{background:rgba(var(--ov,0,0,0),.07)}
.svi-pre{white-space:pre-wrap;max-height:160px;overflow:auto;font-size:12.5px;padding:8px 10px;border-radius:10px;background:rgba(var(--ov,0,0,0),.04)}
@media (max-width:640px){.svi-mic{width:44px;height:44px}.svi-mic.sm{width:40px;height:40px}.svi-panel{border-radius:16px 16px 0 0;width:100vw;max-height:60vh;padding:12px 12px calc(12px + env(safe-area-inset-bottom))}.svi-ib{width:46px;height:46px}.svi-live{height:46px}}
@media (prefers-reduced-motion:reduce){.svi-mic.on::after,.svi-dot,.svi-bars i,.svi-spin{animation:none}}
`
let cssIn = false
const useCss = () => { if (!cssIn && typeof document !== 'undefined') { cssIn = true; const el = document.createElement('style'); el.id = 'svi-css'; el.textContent = CSS; document.head.appendChild(el) } }

const I = {
  mic: s => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/></svg>,
  pause: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>,
  play: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>,
  check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>,
}

const mobile = () => typeof window !== 'undefined' && window.innerWidth <= 640

/** Where the panel goes: next to the mic on a computer, at the bottom (above the keyboard) on a phone */
function usePanelPos(open, anchor, lang, top = false) {
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    if (!open) { setPos(null); return }
    const place = () => {
      if (mobile()) {
        const vv = window.visualViewport
        // the result goes to the top, so the box and its save button (often at the bottom of a sheet) stay in view
        if (top) { setPos({ left: 0, top: vv ? vv.offsetTop : 0, atTop: true }); return }
        const bottom = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0
        setPos({ left: 0, bottom })
        return
      }
      const r = anchor.current?.getBoundingClientRect(); if (!r) return
      const w = Math.min(400, window.innerWidth - 16)
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, lang === 'en' ? r.left : r.right - w))
      const below = window.innerHeight - r.bottom
      setPos(below < 300 && r.top > below ? { left, bottom: window.innerHeight - r.top + 8 } : { left, top: r.bottom + 8 })
    }
    place()
    const vv = window.visualViewport
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true); vv?.addEventListener('resize', place); vv?.addEventListener('scroll', place)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); vv?.removeEventListener('resize', place); vv?.removeEventListener('scroll', place) }
  }, [open, anchor, lang, top])
  return pos
}

/** The waveform: the last ~2.5 s of the mic level as bars */
function Wave({ session }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current; if (!cv || !session) return
    const hist = new Array(48).fill(0)
    let last = 0, raf = 0, want = true
    const off = session.onLevel(v => { last = v })
    const draw = () => {
      if (!want) return
      hist.push(session.phase === 'rec' ? last : 0); hist.shift()
      const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight
      if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h)
      const n = hist.length, bw = w / n
      g.fillStyle = session.phase === 'rec' ? '#E5484D' : 'rgba(128,128,128,.5)'
      for (let i = 0; i < n; i++) {
        const bh = Math.max(2, Math.min(h, hist[i] * h * 1.1))
        const x = i * bw + bw * 0.2, y = (h - bh) / 2
        g.beginPath(); g.roundRect ? g.roundRect(x, y, bw * 0.6, bh, 1.5) : g.rect(x, y, bw * 0.6, bh); g.fill()
      }
      setTimeout(() => { raf = requestAnimationFrame(draw) }, 50)
    }
    raf = requestAnimationFrame(draw)
    return () => { want = false; cancelAnimationFrame(raf); off() }
  }, [session])
  return <canvas ref={ref} className="svi-wave" aria-hidden="true"/>
}

function RecordingRow({ s, t }) {
  const paused = s.phase === 'paused'
  return (
    <>
      <div className="svi-row">
        <button type="button" className="svi-ib del" onClick={() => s.cancel()} aria-label={t.cancel} title={t.cancel}>{I.trash}</button>
        <div className="svi-live" role="status" aria-label={`${paused ? t.paused : t.rec} ${fmtClock(s.sec)}`}>
          <span className={`svi-dot${paused ? ' p' : ''}`} aria-hidden="true"/>
          <span className="svi-time">{fmtClock(s.sec)}</span>
          {s.engine === 'server' ? <Wave session={s}/> : <span className={`svi-bars${paused ? ' p' : ''}`} aria-hidden="true"><i/><i/><i/><i/><i/></span>}
        </div>
        <button type="button" className="svi-ib" onClick={() => (paused ? s.resume() : s.pause())} aria-label={paused ? t.resume : t.pause} title={paused ? t.resume : t.pause}>{paused ? I.play : I.pause}</button>
        <button type="button" className="svi-ib go" onClick={() => s.finish()} aria-label={t.finish} title={t.finish}>{I.check}</button>
      </div>
      <div className="svi-sub">{paused ? t.paused : s.engine === 'server' ? t.serverHint : t.liveHint}</div>
    </>
  )
}

function TaskList({ s, t, lang, onCreateTasks }) {
  const r = s.result
  const [sel, setSel] = useState(() => r.tasks.map(x => !x.uncertain))
  const [edit, setEdit] = useState(() => r.tasks.map(x => ({ title: x.title, due: x.due ? (x.due.includes('T') ? x.due : `${x.due}T10:00`) : '' })))
  const [state, setState] = useState('')
  useEffect(() => { setSel(r.tasks.map(x => !x.uncertain)); setEdit(r.tasks.map(x => ({ title: x.title, due: x.due ? (x.due.includes('T') ? x.due : `${x.due}T10:00`) : '' }))); setState('') }, [r])
  if (!r.tasks.length || !onCreateTasks) return null
  const n = sel.filter(Boolean).length
  const create = async () => {
    const items = r.tasks.map((x, i) => (sel[i] ? voiceTaskItem({ ...x, title: edit[i].title, due: edit[i].due }, { toIso: fromIsraelLocal }) : null)).filter(Boolean)
    if (!items.length) return
    setState('busy')
    try { const ok = await onCreateTasks(items); setState(ok === false ? 'fail' : `done:${items.length}`) } catch { setState('fail') }
  }
  if (state.startsWith('done:')) return <div className="svi-note" role="status" style={{ background: 'rgba(0,168,132,.1)' }}>{t.created(+state.slice(5))}</div>
  return (
    <div className="svi-tasks" role="group" aria-label={t.tasksFound(r.tasks.length)}>
      <b style={{ fontSize: 12.5 }}>{t.tasksFound(r.tasks.length)}</b>
      {r.tasks.map((x, i) => (
        <div key={i} className="svi-task">
          <input type="checkbox" checked={!!sel[i]} onChange={e => setSel(a => a.map((v, k) => (k === i ? e.target.checked : v)))} aria-label={x.title}/>
          <div style={{ minWidth: 0 }}>
            <input className="t" dir="auto" value={edit[i]?.title || ''} onChange={e => setEdit(a => a.map((v, k) => (k === i ? { ...v, title: e.target.value } : v)))}/>
            <div className="w">
              <input type="datetime-local" value={edit[i]?.due || ''} onChange={e => setEdit(a => a.map((v, k) => (k === i ? { ...v, due: e.target.value } : v)))} aria-label={lang === 'en' ? 'When' : 'מתי'}/>
              <span>{edit[i]?.due ? describeDue(fromIsraelLocal(...edit[i].due.split('T')), { lang }) : t.noDue}{x.dueSaid ? ` · "${x.dueSaid}"` : ''}{x.owner ? ` · ${x.owner}` : ''}</span>
              {x.uncertain && <span className="u">{t.uncertain}</span>}
            </div>
          </div>
        </div>
      ))}
      <div className="svi-row">
        <button type="button" className="svi-pri" disabled={!n || state === 'busy'} onClick={create}>{state === 'busy' ? '…' : t.create(n)}</button>
        {state === 'fail' && <span role="alert" style={{ fontSize: 12, color: 'var(--au-red-text)' }}>{t.createFail}</span>}
      </div>
    </div>
  )
}

function useSession(s) {
  const [, force] = useState(0)
  useEffect(() => (s ? s.on(() => force(x => x + 1)) : undefined), [s])
}

export default function SmartVoiceInput({ value, onChange, contextType = 'note', recordId, lang = 'he', hint = '', transcriptionMode, inputRef, onCreateTasks, size, className = '', style }) {
  useCss()
  const t = TR[lang === 'en' ? 'en' : 'he']
  const btn = useRef(null)
  const [s, setS] = useState(null)
  useSession(s)
  const [confirm, setConfirm] = useState(null)   // a mode whose text waits for "replace?"
  const valueRef = useRef(value); valueRef.current = value
  const changeRef = useRef(onChange); changeRef.current = onChange
  const sRef = useRef(null); sRef.current = s
  // the box goes away (a popover closed): the session goes on in VoiceHost
  useEffect(() => () => { const x = sRef.current; if (x) x.detach() }, [])
  const baseRef = useRef('')
  const appliedRef = useRef(null)                // the field value we last wrote
  const open = !!s && s.phase !== 'closed' && s.phase !== 'idle'
  const pos = usePanelPos(open, btn, lang, !!s && (s.phase === 'result' || s.phase === 'error'))

  const write = text => { appliedRef.current = text; changeRef.current?.(text) }
  const focusEnd = () => setTimeout(() => { const el = inputRef?.current; if (!el || mobile()) return; /* a phone would pop its keyboard over the result */ try { el.focus({ preventScroll: true }); const n = el.value?.length || 0; el.setSelectionRange?.(n, n) } catch { /* not a text field */ } }, 30)

  // a result arrived (or the mode changed): put it in the box — unless the office edited what we wrote
  const shown = s?.phase === 'result' ? s.result : null
  useEffect(() => {
    if (!shown || !s) return
    // a structured summary (several lines) starts on its own line under what was already in the box
    const base = baseRef.current
    const next = joinText(/\n/.test(shown.text) && base.trim() && !/\n\s*$/.test(base) ? `${base.replace(/\s+$/, '')}\n\n` : base, shown.text)
    if (appliedRef.current != null && valueRef.current !== appliedRef.current && valueRef.current !== baseRef.current) { setConfirm({ text: next }); return }
    write(next); s.applied = true; focusEnd()
  }, [shown]) // eslint-disable-line react-hooks/exhaustive-deps

  // the box was saved and cleared → the job is done
  useEffect(() => { if (s?.phase === 'result' && appliedRef.current && !String(value || '').trim()) { s.close(); setS(null) } }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    baseRef.current = String(valueRef.current || '')
    appliedRef.current = null
    setConfirm(null)
    const x = new VoiceSession({ contextType, lang, hint, mode: transcriptionMode, onLive: text => write(joinText(baseRef.current, text)) })
    x.recordId = recordId
    setS(x)
    x.start()
  }
  const close = () => { s?.close(); setS(null); setConfirm(null) }
  const again = () => { const x = s; if (appliedRef.current != null && valueRef.current === appliedRef.current) write(baseRef.current); x?.close(); setS(null); setTimeout(start, 0) }
  const asSaid = () => { write(joinText(baseRef.current, s.transcript)); setConfirm(null) }
  const click = () => {
    if (!s || s.phase === 'closed' || s.phase === 'error' || s.phase === 'result') { if (s) s.close(); setConfirm(null); start(); return }
    if (s.phase === 'rec' || s.phase === 'paused') { s.finish(); return }
  }

  const phase = s?.phase
  const recording = phase === 'rec' || phase === 'paused'
  const waiting = phase === 'transcribing' || phase === 'processing'
  const done = s ? s.segments.filter(x => x?.status === 'done').length : 0

  return (
    <>
      <button ref={btn} type="button" onClick={click} className={`svi-mic${size === 'sm' ? ' sm' : ''}${recording ? ' on' : ''}${waiting ? ' wait' : ''} ${className}`} style={style}
        aria-label={recording ? t.finish : t.mic} aria-pressed={recording} title={!s ? t.tip : undefined} data-voice-context={contextType}>
        {waiting ? <span className="svi-spin" aria-hidden="true" style={{ width: 14, height: 14 }}/> : I.mic(size === 'sm' ? 15 : 17)}
      </button>
      {open && pos && createPortal(
        <div className="svi-panel" dir={lang === 'en' ? 'ltr' : 'rtl'} role="dialog" aria-label={t.mic} style={{ left: pos.left, top: pos.top, bottom: pos.bottom, ...(pos.atTop ? { borderRadius: '0 0 16px 16px' } : null) }}
          onMouseDown={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); if (recording) s.cancel(); else close() } }}>
          {recording && <RecordingRow s={s} t={t}/>}
          {waiting && (
            <div className="svi-busy" role="status" aria-live="polite">
              <span className="svi-spin" aria-hidden="true"/>
              <span>{phase === 'transcribing' ? t.transcribing : t.processing}</span>
              {phase === 'transcribing' && s.segments.length > 1 && <span className="svi-sub">{t.pieces(done, s.segments.length)}</span>}
            </div>
          )}
          {phase === 'error' && (
            <>
              <div className="svi-err" role="alert">{dictationError(s.error?.code, lang)}</div>
              {s.micDetail && <div className="svi-sub" dir="ltr" style={{ textAlign: 'start' }}>{s.micDetail}</div>}
              <div className="svi-row">
                {s.error?.canRetry && <button type="button" className="svi-pri" onClick={() => s.retry()}>{t.retry}</button>}
                <button type="button" className="svi-link" onClick={again}>{t.record}</button>
                <button type="button" className="svi-x" onClick={close} aria-label={t.close}>{I.x}</button>
              </div>
            </>
          )}
          {phase === 'result' && shown && (
            <>
              <div className="svi-row">
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>✓ {t.inBox}</span>
                <button type="button" className="svi-x" onClick={close} aria-label={t.close} title={t.close}>{I.x}</button>
              </div>
              {s.modes.length > 1 && (
                <div className="svi-seg" role="group" aria-label="mode">
                  {s.modes.map(m => <button key={m} type="button" aria-pressed={s.mode === m} title={t.modesTip[m]} onClick={() => { setConfirm(null); s.process(m) }}>{t.modes[m]}</button>)}
                </div>
              )}
              {confirm && (
                <div className="svi-note" role="alert">{t.edited}{' '}
                  <button type="button" className="svi-link" onClick={() => { write(confirm.text); setConfirm(null) }}>{t.replace}</button>
                  <button type="button" className="svi-link" onClick={() => setConfirm(null)}>{t.keep}</button>
                </div>
              )}
              {(shown.raw || s.notice) && <div className="svi-note">{t.rawNote[s.notice] || t.rawNote.process}</div>}
              {shown.review?.length > 0 && <div className="svi-note"><b>{t.review}:</b> {shown.review.join(' · ')}</div>}
              <TaskList s={s} t={t} lang={lang} onCreateTasks={onCreateTasks}/>
              <div className="svi-links">
                <button type="button" className="svi-link" onClick={asSaid}>{t.asSaid}</button>
                <button type="button" className="svi-link" onClick={again}>{t.again}</button>
              </div>
            </>
          )}
        </div>, document.body)}
    </>
  )
}

/** Sessions whose box closed: finish them here and offer the text (mounted once, in AdminPanel) */
export function VoiceHost({ lang = 'he' }) {
  useCss()
  const t = TR[lang === 'en' ? 'en' : 'he']
  const list = useSyncExternalStore(subscribeHost, () => detachedSessions().map(s => `${s.id}:${s.phase}:${s.sec}:${s.mode}`).join('|'), () => '')
  const sessions = list ? detachedSessions() : []
  const [copied, setCopied] = useState(0)
  if (!sessions.length) return null
  return createPortal(
    <div dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ position: 'fixed', zIndex: 6001, insetInlineStart: 12, bottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sessions.map(s => (
        <div key={s.id} className="svi-panel" style={{ position: 'relative', width: 'min(380px, calc(100vw - 24px))' }} role="dialog" aria-label={t.hostTitle} onMouseDown={e => e.stopPropagation()}>
          {(s.phase === 'rec' || s.phase === 'paused') && <><b style={{ fontSize: 12.5 }}>{t.hostRec}</b><RecordingRow s={s} t={t}/></>}
          {(s.phase === 'transcribing' || s.phase === 'processing') && <div className="svi-busy"><span className="svi-spin"/>{s.phase === 'transcribing' ? t.transcribing : t.processing}</div>}
          {s.phase === 'error' && <><div className="svi-err" role="alert">{dictationError(s.error?.code, lang)}</div>
            <div className="svi-row">{s.error?.canRetry && <button type="button" className="svi-pri" onClick={() => s.retry()}>{t.retry}</button>}<button type="button" className="svi-x" onClick={() => s.close()} aria-label={t.close}>{I.x}</button></div></>}
          {s.phase === 'result' && s.result && <>
            <div className="svi-row"><b style={{ fontSize: 12.5 }}>{t.hostTitle}</b><button type="button" className="svi-x" onClick={() => s.close()} aria-label={t.close}>{I.x}</button></div>
            <div className="svi-pre" dir="auto">{s.result.text}</div>
            <div className="svi-row"><button type="button" className="svi-pri" onClick={async () => { try { await navigator.clipboard.writeText(s.result.text); setCopied(s.id) } catch { /* the text is on screen */ } }}>{copied === s.id ? t.copied : t.copy}</button></div>
          </>}
        </div>
      ))}
    </div>, document.body)
}
