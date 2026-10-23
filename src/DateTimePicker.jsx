// The admin's date / time picker (replaces the browser's native date inputs): a field that opens a popover with quick
// picks, a month calendar and the time — Hebrew / English, RTL, light / dark through the admin theme's CSS variables,
// keyboard (arrows move the day, PageUp / PageDown the month, Enter picks, Esc closes) and a bottom sheet on phones.
//
// value / onChange formats: 'date' = "YYYY-MM-DD" · 'local' = "YYYY-MM-DDTHH:mm" (the browser's wall clock = Israel for the
// office) · 'iso' = an ISO moment, shown and picked in Israel time (lib/follow-up.js).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { israelLocal, fromIsraelLocal, israelParts, describeDue } from '../lib/follow-up.js'

const pad = n => String(n).padStart(2, '0')
const keyOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
const parseKey = k => { const [y, m, d] = String(k).split('-').map(Number); return { y, m, d } }
const addDaysKey = (k, n) => { const { y, m, d } = parseKey(k); const x = new Date(Date.UTC(y, m - 1, d + n)); return keyOf(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()) }
const todayKey = () => { const p = israelParts(Date.now()); return keyOf(p.y, p.m, p.d) }
const MONTHS = {
  he: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
const WEEK = { he: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'], en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] }
const DAY_NAMES = { he: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] }
const TIMES = Array.from({ length: 29 }, (_, i) => `${pad(7 + Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`)   // 07:00 … 21:00

// value → { date, time } and back
function split(value, format) {
  const v = String(value || '')
  if (!v) return { date: '', time: '' }
  if (format === 'iso') { const l = israelLocal(v); return { date: l.slice(0, 10), time: l.slice(11, 16) } }
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(v)
  return m ? { date: m[1], time: m[2] || '' } : { date: '', time: '' }
}
function join(date, time, format) {
  if (!date) return ''
  if (format === 'date') return date
  const t = time || '10:00'
  return format === 'iso' ? fromIsraelLocal(date, t) : `${date}T${t}`
}
/** "יום שלישי, 20 באוקטובר · 10:00" */
export function formatPicked(value, { format = 'local', lang = 'he', relative = true } = {}) {
  const { date, time } = split(value, format)
  if (!date) return ''
  if (relative && time) { const iso = format === 'iso' ? value : fromIsraelLocal(date, time); const r = describeDue(iso, { lang }); if (/^(היום|מחר|אתמול|Today|Tomorrow|Yesterday)/.test(r)) return r }
  const { y, m, d } = parseKey(date)
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const en = lang === 'en'
  const day = en ? `${DAY_NAMES.en[wd].slice(0, 3)}, ${d} ${MONTHS.en[m - 1].slice(0, 3)}` : `יום ${DAY_NAMES.he[wd]}, ${d} ב${MONTHS.he[m - 1]}`
  const year = y !== parseKey(todayKey()).y ? ` ${y}` : ''
  return `${day}${year}${time && format !== 'date' ? ` · ${time}` : ''}`
}

export const DTP_CSS = `
.dtp-field{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--au-s3-line);background:var(--au-s3);color:var(--au-text);font:inherit;font-size:13.5px;cursor:pointer;min-width:0;max-width:100%;transition:border-color .15s,box-shadow .15s;text-align:start}
.dtp-field:hover{border-color:rgba(var(--brand-rgb),.55)}
.dtp-field:focus-visible,.dtp-field[aria-expanded="true"]{outline:none;border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.18)}
.dtp-field .ph{color:var(--au-text3)}
.dtp-field .val{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dtp-field svg{flex-shrink:0;color:var(--au-brand-text)}
.dtp-field.sm{height:32px;font-size:12.5px;padding:0 10px;border-radius:8px}
.dtp-x{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:none;background:rgba(var(--ov),.08);color:var(--au-text2);cursor:pointer;font-size:11px;margin-inline-start:2px;padding:0}
.dtp-x:hover{background:rgba(var(--ov),.16)}
.dtp-pop{position:fixed;z-index:3000;background:var(--au-s2);border:1px solid var(--au-s2-line);border-radius:16px;box-shadow:var(--au-shadow3);color:var(--au-text);padding:14px;animation:dtp-in .14s ease both;font-size:13px}
@keyframes dtp-in{from{opacity:0;transform:translateY(-4px) scale(.98)}to{opacity:1;transform:none}}
.dtp-sheet-bg{position:fixed;inset:0;z-index:3000;background:var(--au-overlay)}
.dtp-sheet{position:absolute;inset-inline:0;bottom:0;max-height:92dvh;overflow:auto;background:var(--au-s2);border-radius:20px 20px 0 0;border:1px solid var(--au-s2-line);padding:8px 16px calc(16px + env(safe-area-inset-bottom));animation:dtp-up .2s ease both;color:var(--au-text);font-size:14px}
@keyframes dtp-up{from{transform:translateY(30px);opacity:.4}to{transform:none;opacity:1}}
.dtp-grab{width:40px;height:4px;border-radius:2px;background:rgba(var(--ov),.2);margin:4px auto 12px}
.dtp-presets{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.dtp-chip{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--au-s3-line);background:transparent;color:var(--au-text);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .12s,border-color .12s,color .12s}
.dtp-chip:hover{border-color:rgba(var(--brand-rgb),.6);background:rgba(var(--brand-rgb),.08)}
.dtp-chip[aria-pressed="true"]{background:var(--au-brand);border-color:var(--au-brand);color:#fff}
.dtp-body{display:flex;gap:16px;align-items:stretch}
.dtp-cal{width:252px;flex-shrink:0}
.dtp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.dtp-month{font-size:14.5px;font-weight:700;letter-spacing:-.01em}
.dtp-nav{display:flex;gap:4px}
.dtp-nav button{width:30px;height:30px;border-radius:9px;border:none;background:transparent;color:var(--au-text2);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:15px}
.dtp-nav button:hover:not(:disabled){background:rgba(var(--ov),.08);color:var(--au-text)}
.dtp-nav button:disabled{opacity:.3;cursor:default}
.dtp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.dtp-wd{font-size:11px;font-weight:600;color:var(--au-text3);text-align:center;padding:4px 0 6px}
.dtp-day{position:relative;aspect-ratio:1;border-radius:50%;border:none;background:transparent;color:var(--au-text);font:inherit;font-size:13px;font-variant-numeric:tabular-nums;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s}
.dtp-day:hover:not(:disabled):not([aria-selected="true"]){background:rgba(var(--brand-rgb),.12)}
.dtp-day.out{color:var(--au-text3);opacity:.45}
.dtp-day.wkd:not([aria-selected="true"]){color:var(--au-text3)}
.dtp-day.today:not([aria-selected="true"]){color:var(--au-brand-text);font-weight:700}
.dtp-day.today::after{content:"";position:absolute;bottom:4px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:currentColor}
.dtp-day[aria-selected="true"]{background:var(--au-brand);color:#fff;font-weight:700;box-shadow:0 4px 12px rgba(var(--brand-rgb),.35)}
.dtp-day:disabled{opacity:.25;cursor:default}
.dtp-day:focus-visible{outline:2px solid var(--au-brand);outline-offset:1px}
.dtp-times{width:118px;display:flex;flex-direction:column;border-inline-start:1px solid var(--au-divider);padding-inline-start:14px}
.dtp-times-h{font-size:11.5px;font-weight:700;color:var(--au-text3);margin:6px 0 8px}
.dtp-tlist{flex:1;overflow-y:auto;max-height:236px;display:flex;flex-direction:column;gap:4px;padding-inline-end:4px;scrollbar-width:thin}
.dtp-t{height:32px;border-radius:9px;border:1px solid var(--au-s3-line);background:transparent;color:var(--au-text);font:inherit;font-size:13px;font-variant-numeric:tabular-nums;cursor:pointer;flex-shrink:0;transition:background .1s,border-color .1s}
.dtp-t:hover{border-color:rgba(var(--brand-rgb),.6)}
.dtp-t[aria-pressed="true"]{background:var(--au-brand);border-color:var(--au-brand);color:#fff;font-weight:700}
.dtp-tin{height:32px;margin-top:8px;border-radius:9px;border:1px solid var(--au-s3-line);background:var(--au-s3);color:var(--au-text);font:inherit;font-size:13px;text-align:center;font-variant-numeric:tabular-nums;width:100%;box-sizing:border-box}
.dtp-foot{display:flex;align-items:center;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--au-divider)}
.dtp-sum{flex:1;min-width:0;font-size:12.5px;color:var(--au-text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dtp-sum b{color:var(--au-text);font-weight:700}
.dtp-btn{height:34px;padding:0 16px;border-radius:10px;border:1px solid var(--au-s3-line);background:transparent;color:var(--au-text);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.dtp-btn.pri{background:var(--au-brand);border-color:var(--au-brand);color:#fff}
.dtp-btn.pri:disabled{opacity:.45;cursor:default}
.dtp-btn:not(.pri):hover{background:rgba(var(--ov),.06)}
@media (max-width:640px){
  .dtp-body{flex-direction:column}
  .dtp-cal{width:100%}
  .dtp-day{font-size:15px}
  .dtp-times{width:auto;border-inline-start:none;padding-inline-start:0;border-top:1px solid var(--au-divider);padding-top:10px}
  .dtp-tlist{flex-direction:row;overflow-x:auto;max-height:none;padding-bottom:4px}
  .dtp-t{min-width:64px;height:38px}
  .dtp-presets{flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px}
  .dtp-chip{height:34px}
  .dtp-btn{height:42px;flex:1}
  .dtp-foot{flex-wrap:wrap}.dtp-sum{flex-basis:100%}
}
`
let cssIn = false
function useCss() {
  useEffect(() => {
    if (cssIn || typeof document === 'undefined') return
    cssIn = true
    const el = document.createElement('style'); el.id = 'dtp-css'; el.textContent = DTP_CSS; document.head.appendChild(el)
  }, [])
}

const CalIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>
  </svg>
)

/** A month calendar. value "YYYY-MM-DD"; min / max "YYYY-MM-DD"; onPick(key) */
export function MonthCalendar({ value, onPick, min = '', max = '', lang = 'he', autoFocus = false }) {
  useCss()
  const en = lang === 'en'
  const today = todayKey()
  const start = value || (min && min > today ? min : today)
  const [view, setView] = useState(() => { const p = parseKey(start); return { y: p.y, m: p.m } })
  const [focus, setFocus] = useState(start)
  const gridRef = useRef(null)
  useEffect(() => { if (value) { const p = parseKey(value); setView({ y: p.y, m: p.m }); setFocus(value) } }, [value])
  useEffect(() => { if (autoFocus) gridRef.current?.querySelector('[data-focus="1"]')?.focus() }, [autoFocus])
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay()
    const startKey = addDaysKey(keyOf(view.y, view.m, 1), -first)
    return Array.from({ length: 42 }, (_, i) => addDaysKey(startKey, i))
  }, [view])
  const rows = cells.slice(35).every(k => parseKey(k).m !== view.m) ? cells.slice(0, 35) : cells
  const ok = k => (!min || k >= min) && (!max || k <= max)
  const moveMonth = n => setView(v => { const d = new Date(Date.UTC(v.y, v.m - 1 + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 } })
  const prevOk = !min || keyOf(view.y, view.m, 1) > min
  const nextOk = !max || addDaysKey(keyOf(view.y, view.m, 1), 32).slice(0, 7) + '-01' <= max
  const go = k => {
    setFocus(k)
    const p = parseKey(k)
    if (p.m !== view.m || p.y !== view.y) setView({ y: p.y, m: p.m })
    requestAnimationFrame(() => gridRef.current?.querySelector(`[data-k="${k}"]`)?.focus())
  }
  const onKey = e => {
    const rtl = !en
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: 7, ArrowUp: -7 }[e.key]
    if (step) { e.preventDefault(); go(addDaysKey(focus, step)); return }
    if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault()
      const p = parseKey(focus), d = new Date(Date.UTC(p.y, p.m - 1 + (e.key === 'PageDown' ? 1 : -1), 1))
      const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
      go(keyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, Math.min(p.d, days)))
    }
    if (e.key === 'Home') { e.preventDefault(); go(today) }
  }
  return (
    <div className="dtp-cal" dir={en ? 'ltr' : 'rtl'}>
      <div className="dtp-head">
        <span className="dtp-month" aria-live="polite">{MONTHS[en ? 'en' : 'he'][view.m - 1]} {view.y}</span>
        <span className="dtp-nav">
          <button type="button" onClick={() => moveMonth(-1)} disabled={!prevOk} aria-label={en ? 'Previous month' : 'החודש הקודם'}>{en ? '‹' : '›'}</button>
          <button type="button" onClick={() => go(today)} aria-label={en ? 'Today' : 'היום'} title={en ? 'Today' : 'היום'} style={{ width: 'auto', padding: '0 8px', fontSize: 12, fontWeight: 600 }}>{en ? 'Today' : 'היום'}</button>
          <button type="button" onClick={() => moveMonth(1)} disabled={!nextOk} aria-label={en ? 'Next month' : 'החודש הבא'}>{en ? '›' : '‹'}</button>
        </span>
      </div>
      <div className="dtp-grid" role="grid" ref={gridRef} onKeyDown={onKey} aria-label={en ? 'Calendar' : 'לוח שנה'}>
        {WEEK[en ? 'en' : 'he'].map((w, i) => <span key={i} className="dtp-wd" role="columnheader">{w}</span>)}
        {rows.map(k => {
          const p = parseKey(k), wd = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
          const cls = ['dtp-day', p.m !== view.m && 'out', k === today && 'today', wd === 6 && 'wkd'].filter(Boolean).join(' ')
          return (
            <button key={k} type="button" role="gridcell" className={cls} data-k={k} data-focus={k === focus ? '1' : undefined}
              tabIndex={k === focus ? 0 : -1} aria-selected={k === value} disabled={!ok(k)} onClick={() => { setFocus(k); onPick(k) }}
              aria-label={formatPicked(k, { format: 'date', lang, relative: false })}>{p.d}</button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The field + popover. props: value, onChange(value), format ('date' | 'local' | 'iso'), lang, presets ([{ id, label, at }]
 * where `at` is ISO), min ("YYYY-MM-DD", default none), placeholder, clearable, size ('sm'), label (aria), commit ('apply' =
 * an "OK" button; 'pick' = a date-only picker closes on the first click), style.
 */
export default function DateTimePicker({ value, onChange, format = 'local', lang = 'he', presets = null, min = '', max = '', placeholder, clearable = true, size, label, style, id, disabled }) {
  useCss()
  const en = lang === 'en'
  const withTime = format !== 'date'
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => split(value, format))
  const [pos, setPos] = useState(null)
  const btn = useRef(null), pop = useRef(null)
  const mobile = typeof window !== 'undefined' && window.innerWidth <= 640
  useEffect(() => { if (!open) setDraft(split(value, format)) }, [value, format, open])
  const width = withTime ? 418 : 282
  useLayoutEffect(() => {
    if (!open || mobile || !btn.current) return
    const place = () => {
      const r = btn.current.getBoundingClientRect()
      const h = pop.current?.offsetHeight || 380
      let left = en ? r.left : r.right - width
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
      const below = window.innerHeight - r.bottom >= h + 12 || r.top < h + 12
      setPos({ left, top: below ? Math.min(r.bottom + 6, window.innerHeight - h - 8) : Math.max(8, r.top - h - 6) })
    }
    place()
    const raf = requestAnimationFrame(place)
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, mobile, en, width])
  useEffect(() => {
    if (!open) return
    const down = e => { if (pop.current && !pop.current.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false) }
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus() } }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key, true) }
  }, [open])
  // the selected time scrolls into view
  useEffect(() => { if (open) requestAnimationFrame(() => pop.current?.querySelector('.dtp-t[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })) }, [open])

  const apply = (d = draft) => { onChange(join(d.date, d.time, format)); setOpen(false); btn.current?.focus() }
  const pickDay = k => { const d = { ...draft, date: k, time: draft.time || (withTime ? '10:00' : '') }; setDraft(d); if (!withTime) apply(d) }
  const pickPreset = p => { const l = israelLocal(p.at); const d = { date: l.slice(0, 10), time: withTime ? l.slice(11, 16) : '' }; setDraft(d); apply(d) }
  const shown = formatPicked(value, { format, lang })
  const draftValue = join(draft.date, draft.time, format)
  const presetOn = p => draftValue && Math.abs(Date.parse(p.at) - Date.parse(format === 'iso' ? draftValue : fromIsraelLocal(draft.date, draft.time || '10:00'))) < 60e3

  const panel = (
    <>
      {presets?.length > 0 && (
        <div className="dtp-presets" role="group" aria-label={en ? 'Quick picks' : 'בחירה מהירה'}>
          {presets.map(p => <button key={p.id} type="button" className="dtp-chip" aria-pressed={!!presetOn(p)} onClick={() => pickPreset(p)}>{p.label}</button>)}
        </div>
      )}
      <div className="dtp-body">
        <MonthCalendar value={draft.date} onPick={pickDay} min={min} max={max} lang={lang} autoFocus={!presets?.length}/>
        {withTime && (
          <div className="dtp-times">
            <div className="dtp-times-h">{en ? 'Time' : 'שעה'}</div>
            <div className="dtp-tlist" role="group" aria-label={en ? 'Time' : 'שעה'}>
              {TIMES.map(t => <button key={t} type="button" className="dtp-t" aria-pressed={draft.time === t} onClick={() => setDraft(d => ({ date: d.date || todayKey(), time: t }))}>{t}</button>)}
            </div>
            <input className="dtp-tin" type="text" inputMode="numeric" dir="ltr" placeholder="HH:MM" aria-label={en ? 'Other time' : 'שעה אחרת'}
              value={draft.time} maxLength={5}
              onChange={e => { const v = e.target.value.replace(/[^\d:]/g, ''); setDraft(d => ({ ...d, time: v })) }}
              onBlur={e => { const m = /^(\d{1,2}):?(\d{2})?$/.exec(e.target.value); if (m && +m[1] < 24) setDraft(d => ({ date: d.date || todayKey(), time: `${pad(+m[1])}:${pad(Math.min(59, +(m[2] || 0)))}` })) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); setTimeout(() => apply(), 0) } }}/>
          </div>
        )}
      </div>
      {withTime && (
        <div className="dtp-foot">
          <span className="dtp-sum">{draft.date ? <b>{formatPicked(draftValue, { format, lang })}</b> : (en ? 'Pick a day' : 'בחרו יום')}</span>
          {clearable && value && <button type="button" className="dtp-btn" onClick={() => { onChange(''); setOpen(false) }}>{en ? 'Clear' : 'נקה'}</button>}
          <button type="button" className="dtp-btn pri" disabled={!draft.date || !/^\d{2}:\d{2}$/.test(draft.time || '10:00')} onClick={() => apply()}>{en ? 'Done' : 'אישור'}</button>
        </div>
      )}
    </>
  )

  return (
    <>
      <button type="button" ref={btn} id={id} className={`dtp-field${size === 'sm' ? ' sm' : ''}`} style={style} disabled={disabled}
        aria-haspopup="dialog" aria-expanded={open} aria-label={label ? `${label}${shown ? `: ${shown}` : ''}` : undefined}
        onClick={() => setOpen(o => !o)}>
        <CalIcon size={size === 'sm' ? 13 : 15}/>
        {shown ? <span className="val">{shown}</span> : <span className="ph">{placeholder || (withTime ? (en ? 'Pick a date and time' : 'בחירת תאריך ושעה') : (en ? 'Pick a date' : 'בחירת תאריך'))}</span>}
        {clearable && value && !withTime && (
          <span role="button" tabIndex={-1} className="dtp-x" aria-label={en ? 'Clear' : 'נקה'} onClick={e => { e.stopPropagation(); onChange('') }}>✕</span>
        )}
      </button>
      {open && createPortal(
        mobile ? (
          <div className="dtp-sheet-bg" onMouseDown={e => e.target === e.currentTarget && setOpen(false)}>
            <div ref={pop} className="dtp-sheet" role="dialog" aria-label={label || (en ? 'Pick a date' : 'בחירת תאריך')} dir={en ? 'ltr' : 'rtl'}>
              <div className="dtp-grab"/>
              {panel}
            </div>
          </div>
        ) : (
          <div ref={pop} className="dtp-pop" role="dialog" aria-label={label || (en ? 'Pick a date' : 'בחירת תאריך')} dir={en ? 'ltr' : 'rtl'}
            style={{ width, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
            {panel}
          </div>
        ), document.body)}
    </>
  )
}
