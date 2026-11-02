// The mic button of every note / task box in the admin (WhatsApp-style dictation): tap, speak, tap again. The words appear in
// the box live while you speak (the browser's own speech recognition — Chrome / Edge on a computer and Android, Safari on Mac
// and iPhone), and when you stop, Claude rewrites them in correct Hebrew (POST /api/meta/dictation-polish, lib/dictation-
// polish.js): punctuation, numbers as digits, misheard words fixed, nothing dropped or invented, and a one-line summary on top
// of a long note. "לטקסט כפי שנאמר" puts back exactly what was heard. Merging and errors are the tested helpers in
// src/lib/dictation.js. Only one box records at a time; leaving the screen stops it; it stops by itself after 10 minutes.
import { useEffect, useRef, useState, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { dictationMode, collectResults, joinText, liveText, polishedNote, fmtClock, dictationError } from './lib/dictation.js'

const AUTH = { Authorization: 'Bearer AFIKhanahal2026' }
const MAX_SEC = 600
let ACTIVE = null   // the box that is recording now: { stop }

const TR = {
  he: {
    start: 'הכתבה קולית', tip: 'הכתבה קולית: לוחצים, מדברים, לוחצים שוב. הטקסט נכתב תוך כדי ומנוסח בעברית תקינה',
    stop: 'עצירת ההקלטה', listening: 'מקשיב…', polishing: 'מנסח בעברית תקינה…',
    done: 'נוסח בעברית תקינה', undo: 'לטקסט כפי שנאמר', redo: 'לניסוח', raw: 'נשמר כפי שנאמר. הניסוח האוטומטי לא זמין כרגע',
    changed: 'הטקסט השתנה בזמן הניסוח, אז הוא נשאר כמו שכתבתם', nothing: 'לא נשמע דיבור. מדברים קרוב יותר למיקרופון ומנסים שוב',
    first: 'מדברים עכשיו. לוחצים שוב לסיום',
  },
  en: {
    start: 'Dictate', tip: 'Dictation: tap, speak, tap again. The text appears as you speak and is cleaned up',
    stop: 'Stop recording', listening: 'Listening…', polishing: 'Cleaning up…',
    done: 'Cleaned up', undo: 'As spoken', redo: 'Cleaned up', raw: 'Kept as spoken. Automatic clean-up isn\'t available right now',
    changed: 'The text changed while cleaning up, so it was left as you wrote it', nothing: 'No speech was heard. Speak closer to the mic and try again',
    first: 'Speak now. Tap again to finish',
  },
}

const CSS = `
.vd-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:none;min-width:0;min-height:0;height:34px;width:34px;padding:0;border-radius:999px;border:1px solid rgba(var(--ink),.14);background:transparent;color:var(--au-text2,#555);cursor:pointer;font:inherit;font-size:12.5px;font-weight:700;transition:background .15s,color .15s,border-color .15s}
.vd-btn:hover{background:rgba(var(--ov),.07);color:var(--au-text,#111)}
.vd-btn:focus-visible{outline:2px solid var(--au-brand,#3F4EB0);outline-offset:2px}
.vd-btn.sm{height:28px;width:28px}
.vd-btn.rec{width:auto;padding:0 12px 0 10px;background:#E5484D;border-color:#E5484D;color:#fff}
.vd-btn.rec::after{content:"";position:absolute;inset:-4px;border-radius:999px;border:2px solid #E5484D;opacity:0;animation:vd-ring 1.4s ease-out infinite;pointer-events:none}
.vd-btn.busy{width:auto;padding:0 12px;background:rgba(var(--brand-rgb,63,78,176),.12);border-color:transparent;color:var(--au-brand-text,#3F4EB0);cursor:default}
.vd-dot{width:8px;height:8px;border-radius:2px;background:#fff}
.vd-spin{width:13px;height:13px;border-radius:50%;border:2px solid currentColor;border-inline-end-color:transparent;animation:vd-spin .8s linear infinite}
.vd-time{font-variant-numeric:tabular-nums;direction:ltr}
@keyframes vd-ring{0%{transform:scale(.9);opacity:.7}100%{transform:scale(1.25);opacity:0}}
@keyframes vd-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.vd-btn.rec::after,.vd-spin{animation:none}}
.vd-tip{position:fixed;z-index:6000;max-width:min(320px,calc(100vw - 16px));padding:8px 12px;border-radius:10px;background:var(--au-pop,#fff);color:var(--au-text,#111);border:1px solid rgba(var(--ink,0,0,0),.12);box-shadow:0 10px 30px rgba(0,0,0,.2);font-size:12.5px;line-height:1.5;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.vd-tip.err{border-color:rgba(229,72,77,.45)}
.vd-tip button{border:none;background:transparent;color:var(--au-brand-text,#3F4EB0);font:inherit;font-weight:700;cursor:pointer;padding:2px 4px;min-height:0;text-decoration:underline}
@media (max-width:640px){.vd-btn{height:38px;width:38px}.vd-btn.sm{height:34px;width:34px}}
`
let cssIn = false
const useCss = () => { if (!cssIn && typeof document !== 'undefined') { cssIn = true; const el = document.createElement('style'); el.id = 'vd-css'; el.textContent = CSS; document.head.appendChild(el) } }

const MicIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/>
  </svg>
)

async function polishRemote(text, kind, lang) {
  try {
    const r = await fetch('/api/meta/dictation-polish', { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json' }, body: JSON.stringify({ text, kind, lang }), signal: AbortSignal.timeout(30000) })
    const d = await r.json().catch(() => ({}))
    return r.ok && d.text ? d : null
  } catch { return null }
}

/**
 * <VoiceDictate value={text} onChange={setText} kind="note" | "task" lang inputRef? size="sm"? polish? />
 * Put it next to (or inside) any text box; it writes into the same value the box shows.
 */
export default function VoiceDictate({ value, onChange, kind = 'note', lang = 'he', inputRef, size, polish = true, className = '', style }) {
  useCss()
  const t = TR[lang === 'en' ? 'en' : 'he']
  const [phase, setPhase] = useState('idle')   // idle | rec | busy
  const [sec, setSec] = useState(0)
  const [tip, setTip] = useState(null)         // { text, err, undo? }
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const valueRef = useRef(value); valueRef.current = value
  const changeRef = useRef(onChange); changeRef.current = onChange
  const ctl = useRef(null)
  const tipTimer = useRef(0)

  const say = useCallback((x, ms = 5000) => {
    clearTimeout(tipTimer.current)
    setTip(x)
    if (x && ms) tipTimer.current = setTimeout(() => setTip(null), ms)
  }, [])

  useLayoutEffect(() => {
    if (!tip || !btn.current) { setPos(null); return }
    const place = () => {
      const r = btn.current?.getBoundingClientRect(); if (!r) return
      const w = Math.min(320, window.innerWidth - 16)
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, lang === 'en' ? r.left : r.right - w))
      const up = r.bottom + 70 > window.innerHeight
      setPos(up ? { left, bottom: window.innerHeight - r.top + 8 } : { left, top: r.bottom + 8 })
    }
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [tip, lang])

  const focusEnd = () => setTimeout(() => {
    const el = inputRef?.current; if (!el) return
    try { el.focus(); const n = el.value?.length || 0; el.setSelectionRange?.(n, n) } catch { /* not a text field */ }
  }, 30)

  const start = () => {
    const mode = dictationMode()
    if (!mode.supported) { say({ text: dictationError('unsupported', lang), err: true }, 9000); return }
    ACTIVE?.stop()
    const base = String(valueRef.current || '')
    let committed = '', session = { final: '', interim: '' }, stopped = false, aborted = false, rec = null, err = '', fails = 0, began = Date.now()
    const push = () => changeRef.current?.(liveText(base, committed, session))
    const finish = async () => {
      if (ctl.current !== me) return
      ctl.current = null; if (ACTIVE === me) ACTIVE = null
      clearInterval(me.tick)
      const raw = joinText(committed, '')
      const shown = liveText(base, committed, null)
      changeRef.current?.(shown)
      if (aborted) { setPhase('idle'); return }
      if (err) { setPhase('idle'); say({ text: dictationError(err, lang), err: true }, 9000); return }
      if (!raw.trim()) { setPhase('idle'); say({ text: t.nothing, err: true }); return }
      if (!polish) { setPhase('idle'); focusEnd(); return }
      setPhase('busy')
      const r = await polishRemote(raw, kind, lang)
      setPhase('idle')
      if (!r) { say({ text: t.raw }); focusEnd(); return }
      if (String(valueRef.current || '') !== shown) { say({ text: t.changed }); return }
      const nice = joinText(base, kind === 'task' ? r.text : polishedNote(r, lang))
      changeRef.current?.(nice)
      focusEnd()
      let showing = 'nice'
      const toggle = () => {
        showing = showing === 'nice' ? 'raw' : 'nice'
        changeRef.current?.(showing === 'nice' ? nice : shown)
        say({ text: showing === 'nice' ? t.done : t.undo, undo: { label: showing === 'nice' ? t.undo : t.redo, run: toggle } }, 9000)
      }
      say({ text: `✓ ${t.done}`, undo: { label: t.undo, run: toggle } }, 9000)
    }
    const begin = () => {
      rec = new mode.Rec()
      rec.lang = lang === 'en' ? 'en-US' : 'he-IL'
      rec.continuous = mode.continuous
      rec.interimResults = true
      rec.maxAlternatives = 1
      rec.onresult = e => { session = collectResults(e.results); fails = 0; push() }
      rec.onerror = e => {
        const c = e?.error || ''
        if (c === 'no-speech' || c === 'aborted') return
        if (c === 'network' && fails < 2) { fails++; return }   // one hiccup: the restart below tries again
        // iPhone may refuse a restart without a tap after a pause: keep what was said, no scary message
        if ((c === 'not-allowed' || c === 'service-not-allowed') && (committed || session.final || session.interim)) { stopped = true; return }
        err = c || 'error'; stopped = true
      }
      rec.onend = () => {
        committed = joinText(committed, joinText(session.final, session.interim))   // a phrase cut short still counts
        session = { final: '', interim: '' }
        push()
        if (stopped || ctl.current !== me) { finish(); return }
        // the browser ends a session after a pause (always on Android): start the next one at once
        if (Date.now() - began < 400 && ++fails > 4) { err = err || 'network'; finish(); return }
        began = Date.now()
        try { begin() } catch { finish() }
      }
      rec.start()
    }
    const me = {
      stop: () => { stopped = true; try { rec?.stop() } catch { finish() }; setTimeout(() => { if (ctl.current === me) finish() }, 1800) },
      abort: () => { stopped = true; aborted = true; try { rec?.abort() } catch { finish() } },
      tick: 0,
    }
    ctl.current = me; ACTIVE = me
    try { begin() } catch { ctl.current = null; ACTIVE = null; say({ text: dictationError('unsupported', lang), err: true }, 9000); return }
    setSec(0); setPhase('rec'); say({ text: t.first }, 3500)
    const t0 = Date.now()
    me.tick = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000)
      setSec(s)
      if (s >= MAX_SEC) me.stop()
    }, 500)
  }

  // leaving the screen stops the recording (no polish)
  useEffect(() => () => { const c = ctl.current; if (c) c.abort(); clearTimeout(tipTimer.current) }, [])

  const click = () => {
    if (phase === 'rec') { ctl.current?.stop(); return }
    if (phase === 'busy') return
    start()
  }

  return (
    <>
      <button ref={btn} type="button" onClick={click} className={`vd-btn${size === 'sm' ? ' sm' : ''}${phase === 'rec' ? ' rec' : ''}${phase === 'busy' ? ' busy' : ''} ${className}`} style={style}
        aria-label={phase === 'rec' ? t.stop : phase === 'busy' ? t.polishing : t.start} aria-pressed={phase === 'rec'} title={phase === 'idle' ? t.tip : undefined}>
        {phase === 'rec' ? <><span className="vd-dot" aria-hidden="true"/><span className="vd-time" aria-live="off">{fmtClock(sec)}</span></>
          : phase === 'busy' ? <><span className="vd-spin" aria-hidden="true"/><span>{t.polishing}</span></>
          : <MicIcon size={size === 'sm' ? 15 : 17}/>}
      </button>
      {tip && pos && createPortal(
        <div className={`vd-tip${tip.err ? ' err' : ''}`} role={tip.err ? 'alert' : 'status'} dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
          onMouseDown={e => e.stopPropagation()}>
          <span>{tip.text}</span>
          {tip.undo && <button type="button" onClick={tip.undo.run}>{tip.undo.label}</button>}
        </div>, document.body)}
    </>
  )
}
