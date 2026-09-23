// Sending hours (spec §3.5): status card · what follows the hours · presets · week editor · next windows.
// One window per day, [start, end) in hours (0.5 steps) or null = closed, Israel time.
import { useState, useEffect, useRef, useMemo } from 'react'
import { FaEllipsisV, FaMoon, FaClock } from 'react-icons/fa'
import { T, Card, Toggle, Button, Popover, MenuItem, MenuButton, FilterChip } from './automationsUI.jsx'
import { israelNow, nextWindows, fmtHour } from '../lib/automations-shared.js'

const TR = {
  he: {
    tz: 'לפי שעון ישראל', limit: 'הגבל שליחה לשעות האלה',
    noLimit: 'ללא הגבלה – תזכורות יכולות לצאת בכל שעה, גם בלילה ובשבת.',
    openNowCloses: t => `פתוח עכשיו · נסגר ב-${t}`, closedOpens: (d, t) => `סגור עכשיו · נפתח ${d} ב-${t}`, allClosedNow: 'סגור – אין חלון שליחה בשבוע הקרוב',
    follow: 'כפופות לשעות:', followList: ['תזכורות ״לא ענה״', 'חזרה ללקוח', 'שליחות מתוזמנות'],
    immediate: 'יוצאות מיד:', immediateList: ['הודעת פתיחה', 'תשובה ללקוח', 'הודעות שינוי שלב'],
    presets: 'הגדרות מוכנות', custom: 'מותאם אישית', applied: n => `הוחלו שעות ״${n}״`, undo: 'בטל',
    closed: 'סגור', open: 'פתוח', copyAll: 'העתק לכל הימים', copyWeek: 'העתק לימים א׳–ה׳', closeDay: 'סגור את היום', rowMenu: 'אפשרויות',
    applyAlso: 'החל גם על:', done: 'אישור', endAfter: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',
    now: t => `עכשיו ${t}`, weekTotal: n => `${n} שעות שליחה בשבוע`, nextWindows: 'החלונות הבאים:', openNow: 'פתוח עכשיו',
    today: 'היום', tomorrow: 'מחר', allClosed: 'כל הימים סגורים – שום תזכורת לא תצא',
    tzMismatch: l => `השעון במכשיר שלך שונה משעון ישראל (אצלך ${l})`,
    start: d => `שעת התחלה, יום ${d}`, end: d => `שעת סיום, יום ${d}`, timeBtn: d => `שעות יום ${d}`,
    days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'], short: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
  },
  en: {
    tz: 'Israel time', limit: 'Only send during these hours',
    noLimit: 'No limit – reminders can go out at any hour, including nights and Shabbat.',
    openNowCloses: t => `Open now · closes at ${t}`, closedOpens: (d, t) => `Closed now · opens ${d} at ${t}`, allClosedNow: 'Closed – no sending window in the coming week',
    follow: 'Follow these hours:', followList: ['No-reply reminders', 'Re-engagement', 'Scheduled bulk sends'],
    immediate: 'Always go out right away:', immediateList: ['Welcome message', 'Replies to the lead', 'Stage-change messages'],
    presets: 'Quick presets', custom: 'Custom', applied: n => `Applied “${n}”`, undo: 'Undo',
    closed: 'Closed', open: 'Open', copyAll: 'Copy to all days', copyWeek: 'Copy to Sun–Thu', closeDay: 'Close this day', rowMenu: 'Options',
    applyAlso: 'Also apply to:', done: 'Done', endAfter: 'End time must be after start time',
    now: t => `Now ${t}`, weekTotal: n => `${n} sending hours a week`, nextWindows: 'Next windows:', openNow: 'open now',
    today: 'Today', tomorrow: 'Tomorrow', allClosed: 'Every day is closed – no reminders will go out',
    tzMismatch: l => `Your device isn't on Israel time (your time: ${l})`,
    start: d => `Start time, ${d}`, end: d => `End time, ${d}`, timeBtn: d => `${d} hours`,
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
}
export const PRESETS = [
  { id: 'std', he: 'שבוע עבודה רגיל', en: 'Standard week', heSub: 'א׳–ה׳ 9–20 · ו׳ 9–13', enSub: 'Sun–Thu 9–20 · Fri 9–13', days: { 0: [9, 20], 1: [9, 20], 2: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 13], 6: null } },
  { id: 'office', he: 'שעות משרד', en: 'Office hours', heSub: 'א׳–ה׳ 9–18', enSub: 'Sun–Thu 9–18', days: { 0: [9, 18], 1: [9, 18], 2: [9, 18], 3: [9, 18], 4: [9, 18], 5: null, 6: null } },
  { id: 'ext', he: 'מורחב', en: 'Extended', heSub: 'א׳–ה׳ 8–21 · ו׳ 8–14', enSub: 'Sun–Thu 8–21 · Fri 8–14', days: { 0: [8, 21], 1: [8, 21], 2: [8, 21], 3: [8, 21], 4: [8, 21], 5: [8, 14], 6: null } },
  { id: 'sat', he: 'כולל מוצאי שבת', en: 'Incl. Saturday night', heSub: 'רגיל + מוצ״ש 20–22', enSub: 'Standard + Sat 20–22', days: { 0: [9, 20], 1: [9, 20], 2: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 13], 6: [20, 22] } },
]
const same = (a, b) => [0, 1, 2, 3, 4, 5, 6].every(i => JSON.stringify(a?.[i] || null) === JSON.stringify(b?.[i] || null))
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const HALF = [...Array(49).keys()].map(i => i / 2)
const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 640

export default function HoursTab({ lang = 'he', cfg, setCfg, toast }) {
  const t = TR[lang] || TR.he
  const isEn = lang === 'en'
  const rtl = !isEn
  const quiet = cfg.quiet || { enabled: true, days: {} }
  const days = quiet.days || {}
  const [now, setNow] = useState(() => israelNow())
  useEffect(() => { const iv = setInterval(() => setNow(israelNow()), 60000); return () => clearInterval(iv) }, [])
  const lastRange = useRef({})
  const setDays = next => setCfg(c => { c.quiet = { ...(c.quiet || {}), days: next } })
  const setDay = (d, w) => { if (Array.isArray(days[d])) lastRange.current[d] = days[d]; setDays({ ...days, [d]: w }) }
  const nw = useMemo(() => nextWindows(cfg, new Date(), 3), [cfg, now]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = [0, 1, 2, 3, 4, 5, 6].reduce((n, i) => n + (Array.isArray(days[i]) ? days[i][1] - days[i][0] : 0), 0)
  const allClosed = [0, 1, 2, 3, 4, 5, 6].every(i => !Array.isArray(days[i]))
  const preset = PRESETS.find(p => same(p.days, days))
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const dayName = off => (off === 0 ? t.today : off === 1 ? t.tomorrow : null)
  const w0 = nw.windows.find(w => !w.current)
  const status = !quiet.enabled ? null : nw.open ? t.openNowCloses(fmtHour(nw.closesAt)) : w0 ? t.closedOpens(dayName(w0.offset) || t.days[w0.day], fmtHour(w0.start)) : t.allClosedNow
  const applyPreset = p => {
    const prev = JSON.parse(JSON.stringify(days))
    setDays(JSON.parse(JSON.stringify(p.days)))
    toast?.(t.applied(isEn ? p.en : p.he), { action: { label: t.undo, onClick: () => setDays(prev) } })
  }
  const copyFrom = (d, targets) => { const w = days[d]; const next = { ...days }; targets.forEach(i => { next[i] = w ? [...w] : null }); setDays(next) }
  const nowPct = (now.hour / 24) * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 920 }}>
      <Card style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background: quiet.enabled && nw.open ? T.green : T.amber, boxShadow: quiet.enabled && nw.open ? `0 0 0 5px ${T.green}33` : 'none' }}/>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: quiet.enabled ? T.text : T.amberText }}>{quiet.enabled ? status : t.noLimit}</div>
          <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>{t.tz}</div>
          {localTz !== 'Asia/Jerusalem' && <div style={{ fontSize: 12, color: T.amberText, marginTop: 4 }}>{t.tzMismatch(new Date().toLocaleTimeString(isEn ? 'en-GB' : 'he-IL', { hour: '2-digit', minute: '2-digit' }))}</div>}
        </div>
        <Toggle checked={!!quiet.enabled} onChange={v => setCfg(c => { c.quiet = { ...(c.quiet || {}), enabled: v } })}>{t.limit}</Toggle>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
        {[[t.follow, t.followList, 'amber'], [t.immediate, t.immediateList, 'green']].map(([lbl, list, c]) => (
          <div key={lbl} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: T.text2, fontWeight: 700, minWidth: 110 }}>{lbl}</span>
            {list.map(x => <span key={x} style={{ padding: '2px 9px', borderRadius: 20, border: `1px solid ${c === 'amber' ? 'rgba(245,166,35,.4)' : T.greenLine}`, color: c === 'amber' ? T.amberText : T.green, fontSize: 11.5, fontWeight: 700 }}>{x}</span>)}
          </div>
        ))}
      </div>

      <div style={{ opacity: quiet.enabled ? 1 : .45, pointerEvents: quiet.enabled ? 'auto' : 'none', display: 'flex', flexDirection: 'column', gap: 12 }} aria-disabled={!quiet.enabled}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text2, marginBottom: 8 }}>{t.presets}</div>
          <div className="au-scroll-x" style={{ display: 'flex', gap: 8 }}>
            {PRESETS.map(p => {
              const on = preset?.id === p.id
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => applyPreset(p)} className="au-card-hov"
                  style={{ minHeight: 56, minWidth: 150, padding: '8px 12px', borderRadius: 12, textAlign: 'start', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, background: on ? T.brandSoft : T.s1, border: `1px solid ${on ? T.brand : T.s1Line}`, color: T.text }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{isEn ? p.en : p.he}</div>
                  <div style={{ fontSize: 11.5, color: T.text3, marginTop: 2 }}>{isEn ? p.enSub : p.heSub}</div>
                </button>
              )
            })}
            <div aria-hidden style={{ minHeight: 56, minWidth: 110, padding: '8px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', flexShrink: 0, background: !preset ? T.brandSoft : 'transparent', border: `1px dashed ${!preset ? T.brand : T.s1Line}`, color: !preset ? T.brandText : T.text3, fontSize: 13, fontWeight: 700 }}>{t.custom}</div>
          </div>
        </div>

        <Card pad="12px 16px">
          <div className="au-day-row au-hide-m" aria-hidden style={{ minHeight: 34 }}>
            <span/><span/>
            <div style={{ position: 'relative', height: 30 }}>
              {[0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => <span key={h} style={{ position: 'absolute', insetInlineStart: `${(h / 24) * 100}%`, transform: `translateX(${rtl ? '50%' : '-50%'})`, bottom: 0, fontSize: 10.5, fontWeight: 600, color: T.text3, fontVariantNumeric: 'tabular-nums' }}>{String(h).padStart(2, '0')}</span>)}
              <span style={{ position: 'absolute', top: 0, insetInlineStart: `${nowPct}%`, transform: `translateX(${rtl ? '50%' : '-50%'})`, fontSize: 10.5, fontWeight: 800, background: T.brand, color: T.bg, borderRadius: 20, padding: '1px 7px', whiteSpace: 'nowrap', zIndex: 1 }}>{t.now(fmtHour(Math.floor(now.hour * 2) / 2 === now.hour ? now.hour : Math.floor(now.hour * 60) / 60))}</span>
            </div>
            <span/><span/>
          </div>
          {[0, 1, 2, 3, 4, 5, 6].map(d => (
            <DayRow key={d} d={d} t={t} rtl={rtl} value={Array.isArray(days[d]) ? days[d] : null} isToday={now.day === d} nowPct={nowPct}
              onChange={w => setDay(d, w)} onToggle={on => setDay(d, on ? (lastRange.current[d] || [9, 18]) : null)}
              onCopyAll={() => copyFrom(d, [0, 1, 2, 3, 4, 5, 6])} onCopyWeek={() => copyFrom(d, [0, 1, 2, 3, 4])}
              onApplyTo={(w, targets) => { const next = { ...days, [d]: w }; targets.forEach(i => { next[i] = [...w] }); setDays(next) }}/>
          ))}
        </Card>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
          <span style={{ color: T.text2, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><FaClock size={11}/>{t.weekTotal(total)}</span>
          <div style={{ flex: 1 }}/>
          {!!nw.windows.length && <span style={{ color: T.text3 }}>{t.nextWindows}</span>}
          {nw.windows.map(w => (
            <span key={w.offset} style={{ padding: '3px 10px', borderRadius: 20, background: w.current ? T.greenSoft : T.s3, border: `1px solid ${w.current ? T.greenLine : T.s3Line}`, color: w.current ? T.green : T.text2, fontWeight: 700, fontSize: 12 }}>
              {dayName(w.offset) || t.days[w.day]} <bdi dir="ltr">{fmtHour(w.start)}–{fmtHour(w.end)}</bdi>{w.current ? ` · ${t.openNow}` : ''}
            </span>
          ))}
        </div>
        {allClosed && <div role="alert" style={{ fontSize: 12.5, color: T.amberText, display: 'flex', gap: 6, alignItems: 'center' }}><FaMoon/> {t.allClosed}</div>}
      </div>
    </div>
  )
}

function DayRow({ d, t, rtl, value, isToday, nowPct, onChange, onToggle, onCopyAll, onCopyWeek, onApplyTo }) {
  const [open, setOpen] = useState(false)
  const btn = useRef(null)
  const btnM = useRef(null)
  const label = value ? `${fmtHour(value[0])} – ${fmtHour(value[1])}` : t.closed
  const timeBtn = (r, h) => (
    <button ref={r} type="button" onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={`${t.timeBtn(t.days[d])}: ${label}`} className="au-hov"
      style={{ height: h, padding: '0 10px', borderRadius: 9, border: '1px solid rgba(var(--ink),.18)', background: 'transparent', color: value ? T.text : T.text3, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', minHeight: 0, minWidth: 0, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      <bdi dir="ltr">{label}</bdi>
    </button>
  )
  return (
    <>
      <div className="au-day-row au-hide-m" aria-current={isToday ? 'date' : undefined} style={{ background: isToday ? 'rgba(var(--brand-rgb),.07)' : 'transparent', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: value ? T.text : T.text3 }}>{t.days[d]}</span>
        <Toggle checked={!!value} onChange={onToggle} label={`${t.days[d]} · ${value ? t.open : t.closed}`}/>
        <WeekBar value={value} onChange={onChange} onOpen={() => onToggle(true)} rtl={rtl} nowPct={nowPct} dayName={t.days[d]} t={t} closedLabel={t.closed}/>
        {timeBtn(btn, 32)}
        <MenuButton icon={<FaEllipsisV size={12}/>} label={`${t.rowMenu} · ${t.days[d]}`} dir={rtl ? 'rtl' : 'ltr'}>
          <MenuItem onClick={onCopyAll}>{t.copyAll}</MenuItem>
          <MenuItem onClick={onCopyWeek}>{t.copyWeek}</MenuItem>
          <MenuItem onClick={() => onToggle(false)} icon={<FaMoon size={11}/>}>{t.closeDay}</MenuItem>
        </MenuButton>
      </div>
      <div className="au-only-m" aria-current={isToday ? 'date' : undefined} style={{ flexDirection: 'column', gap: 8, padding: '10px 12px', borderRadius: 12, background: isToday ? 'rgba(var(--brand-rgb),.07)' : T.s1, border: `1px solid ${T.s1Line}`, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: value ? T.text : T.text3 }}>{t.days[d]}</span>
          {timeBtn(btnM, 36)}
          <Toggle checked={!!value} onChange={onToggle} label={`${t.days[d]} · ${value ? t.open : t.closed}`}/>
        </div>
        <WeekBar value={value} readOnly rtl={rtl} nowPct={isToday ? nowPct : null} height={16} closedLabel="" onOpen={() => setOpen(true)}/>
      </div>
      <Popover anchor={isMobile() ? btnM : btn} open={open} onClose={() => setOpen(false)} width={300} dir={rtl ? 'rtl' : 'ltr'} label={t.timeBtn(t.days[d])}>
        {close => <RangePicker t={t} d={d} value={value || [9, 18]} onDone={(w, targets) => { onApplyTo(w, targets); close() }}/>}
      </Popover>
    </>
  )
}

function RangePicker({ t, d, value, onDone }) {
  const [s, setS] = useState(value[0])
  const [e, setE] = useState(value[1])
  const [also, setAlso] = useState(new Set())
  const bad = e <= s
  const sel = { height: 44, width: 104, padding: '0 8px', borderRadius: 9, border: `1px solid ${bad ? T.red : T.s3Line}`, background: 'var(--au-s2)', color: T.text, fontFamily: 'inherit', fontSize: 14, fontVariantNumeric: 'tabular-nums', minHeight: 0 }
  return (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 800 }}>{t.days[d]}</div>
      <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
        <select aria-label={t.start(t.days[d])} value={s} onChange={x => setS(Number(x.target.value))} style={sel} data-autofocus>{HALF.slice(0, 48).map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}</select>
        <span style={{ color: T.text3 }}>–</span>
        <select aria-label={t.end(t.days[d])} value={e} onChange={x => setE(Number(x.target.value))} style={sel}>{HALF.slice(1).map(h => <option key={h} value={h}>{fmtHour(h)}</option>)}</select>
      </div>
      {bad && <div style={{ fontSize: 12, color: T.redText, textAlign: 'center' }}>{t.endAfter}</div>}
      <div>
        <div style={{ fontSize: 12, color: T.text2, fontWeight: 700, marginBottom: 6 }}>{t.applyAlso}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {t.short.map((n, i) => i === d ? null : <FilterChip key={i} selected={also.has(i)} onClick={() => setAlso(a => { const x = new Set(a); x.has(i) ? x.delete(i) : x.add(i); return x })}>{n}</FilterChip>)}
        </div>
      </div>
      <Button variant="solid" full size="lg" disabled={bad} onClick={() => onDone([s, e], [...also])}>{t.done}</Button>
    </div>
  )
}

// Track with draggable start/end handles (0.5h snap, min 1h). Time runs in the reading direction.
function WeekBar({ value, onChange, onOpen, rtl, nowPct, readOnly, height = 28, dayName, t, closedLabel }) {
  const ref = useRef(null)
  const [drag, setDrag] = useState(null)
  const frac = x => { const r = ref.current.getBoundingClientRect(); return clamp(rtl ? (r.right - x) / r.width : (x - r.left) / r.width, 0, 1) }
  const snap = f => Math.round(f * 48) / 2
  const [s, e] = value || [0, 0]
  const set = (ns, ne) => onChange?.([clamp(ns, 0, 23), clamp(ne, 1, 24)])
  const onMove = ev => {
    if (!drag || !value) return
    const h = snap(frac(ev.clientX))
    if (drag.kind === 'start') set(Math.min(h, e - 1), e)
    else if (drag.kind === 'end') set(s, Math.max(h, s + 1))
    else { const len = e - s; const ns = clamp(h - drag.off, 0, 24 - len); set(ns, ns + len) }
  }
  const begin = (kind, ev) => {
    ev.preventDefault(); ev.stopPropagation()
    try { ref.current.setPointerCapture(ev.pointerId) } catch {}
    setDrag({ kind, off: kind === 'move' ? snap(frac(ev.clientX)) - s : 0 })
  }
  const onTrackDown = ev => {
    if (readOnly || !value) { onOpen?.(); return }
    const h = snap(frac(ev.clientX))
    const kind = Math.abs(h - s) <= Math.abs(h - e) ? 'start' : 'end'
    kind === 'start' ? set(Math.min(h, e - 1), e) : set(s, Math.max(h, s + 1))
    begin(kind, ev)
  }
  const key = which => ev => {
    let dlt = 0
    if (ev.key === 'ArrowUp') dlt = 0.5
    if (ev.key === 'ArrowDown') dlt = -0.5
    if (ev.key === 'PageUp') dlt = 1
    if (ev.key === 'PageDown') dlt = -1
    if (ev.key === 'ArrowRight') dlt = rtl ? -0.5 : 0.5
    if (ev.key === 'ArrowLeft') dlt = rtl ? 0.5 : -0.5
    if (ev.key === 'Home') { ev.preventDefault(); which === 'start' ? set(0, e) : set(s, s + 1); return }
    if (ev.key === 'End') { ev.preventDefault(); which === 'start' ? set(e - 1, e) : set(s, 24); return }
    if (!dlt) return
    ev.preventDefault()
    which === 'start' ? set(clamp(s + dlt, 0, e - 1), e) : set(s, clamp(e + dlt, s + 1, 24))
  }
  const pct = h => `${(h / 24) * 100}%`
  const handle = (which, h) => (
    <span key={which} role="slider" tabIndex={0} aria-label={which === 'start' ? t.start(dayName) : t.end(dayName)} aria-valuemin={0} aria-valuemax={24} aria-valuenow={h}
      aria-valuetext={`${which === 'start' ? t.start(dayName) : t.end(dayName)}: ${fmtHour(h)}`}
      onKeyDown={key(which)} onPointerDown={ev => begin(which, ev)}
      style={{ position: 'absolute', top: '50%', insetInlineStart: pct(h), transform: `translate(${rtl ? '50%' : '-50%'}, -50%)`, width: 24, height: height + 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'ew-resize', zIndex: 2, touchAction: 'none', borderRadius: 6 }}>
      <span style={{ width: 8, height: 20, borderRadius: 4, background: T.green, boxShadow: '0 1px 4px rgba(0,0,0,.4)', transform: drag?.kind === which ? 'scale(1.15)' : 'none', transition: 'transform .1s' }}/>
      {drag && (drag.kind === which || drag.kind === 'move') && <span style={{ position: 'absolute', bottom: '100%', marginBottom: 4, background: T.s2, border: `1px solid ${T.s2Line}`, color: T.text, fontSize: 11, fontWeight: 800, padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>{fmtHour(h)}</span>}
    </span>
  )
  return (
    <div ref={ref} onPointerDown={onTrackDown} onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}
      style={{ position: 'relative', height, borderRadius: 8, background: value ? 'rgba(var(--ov),.04)' : 'repeating-linear-gradient(45deg, rgba(var(--ov),.04) 0 6px, transparent 6px 12px)', border: `1px solid ${T.s1Line}`, cursor: 'pointer', touchAction: 'none', userSelect: 'none' }}>
      {[3, 6, 9, 12, 15, 18, 21].map(h => <span key={h} aria-hidden style={{ position: 'absolute', top: 3, bottom: 3, insetInlineStart: pct(h), width: 1, background: 'rgba(var(--brand-rgb),.1)' }}/>)}
      {value ? (
        <span onPointerDown={readOnly ? undefined : ev => begin('move', ev)} style={{ position: 'absolute', top: 2, bottom: 2, insetInlineStart: pct(s), width: pct(e - s), background: 'rgba(37,211,102,.22)', border: '1px solid rgba(37,211,102,.6)', borderRadius: 6, cursor: readOnly ? 'pointer' : drag?.kind === 'move' ? 'grabbing' : 'grab' }}/>
      ) : closedLabel ? <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, color: T.text3, pointerEvents: 'none' }}>{closedLabel}</span> : null}
      {value && !readOnly && [handle('start', s), handle('end', e)]}
      {nowPct != null && <span aria-hidden style={{ position: 'absolute', top: -3, bottom: -3, insetInlineStart: `${nowPct}%`, width: 2, background: T.brand, borderRadius: 2, pointerEvents: 'none', zIndex: 3 }}/>}
    </div>
  )
}
