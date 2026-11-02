// A task's text box with a list of ready-made CRM tasks (lib/task-presets.js): click the box or ▾ to open it, type to filter
// (Hebrew or English), ↑ / ↓ / Enter / Esc. Picking fills the text and, when the "when" is still empty, its suggested time
// (onPick(preset, due)). The office's own recent texts come first ("בשימוש לאחרונה", localStorage.afik_task_recent_v1).
// Admin theme tokens only; the list is a portal with a fixed position (the lead card's sections clip overflow).
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { filterPresets, presetText, presetDue, pushRecent } from '../lib/task-presets.js'
import VoiceDictate from './VoiceDictate.jsx'

const KEY = 'afik_task_recent_v1'
const readRecent = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
/** Remember a text the office typed (call it when the task is saved) */
export function rememberTaskText(text) { try { localStorage.setItem(KEY, JSON.stringify(pushRecent(readRecent(), text))) } catch { /* private mode */ } }

const TR = {
  he: { open: 'רשימת משימות מוכנות', recent: 'בשימוש לאחרונה', none: 'אין משימה מוכנה כזו. Enter שומר את מה שכתבתם', hint: '↑ ↓ בחירה · Enter הוספה · Esc סגירה', due: d => `מוצע: ${d}` },
  en: { open: 'Ready-made tasks', recent: 'Recently used', none: 'No ready-made task like that. Enter saves what you typed', hint: '↑ ↓ choose · Enter add · Esc close', due: d => `Suggested: ${d}` },
}
const CSS = `
.tpi{position:relative;display:flex;align-items:center;gap:6px;min-width:0}
.tpi-box{position:relative;flex:1;min-width:0;display:flex;align-items:stretch}
.tpi input{flex:1;min-width:0;padding-inline-end:40px!important}
.tpi-tgl{position:absolute;inset-inline-end:4px;top:50%;transform:translateY(-50%);width:32px;height:30px;min-height:0;min-width:0;padding:0;border:none;border-radius:8px;background:transparent;color:var(--au-text3);cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.tpi-tgl:hover,.tpi-tgl[aria-expanded=true]{background:rgba(var(--ov),.07);color:var(--au-text)}
.tpi-pop{position:fixed;z-index:4500;background:var(--au-pop,var(--au-s1));color:var(--au-text);border:1px solid rgba(var(--ink),.12);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.24);display:flex;flex-direction:column;overflow:hidden}
.tpi-list{overflow-y:auto;padding:4px 0;overscroll-behavior:contain}
.tpi-sec{position:sticky;top:0;z-index:1;padding:8px 12px 4px;font-size:11px;font-weight:800;color:var(--au-text3);background:var(--au-pop,var(--au-s1));letter-spacing:.02em}
.tpi-opt span:first-child{min-width:0}
.tpi-opt{display:flex;align-items:center;gap:10px;width:100%;padding:8px 12px;border:none;background:transparent;color:inherit;font:inherit;font-size:13.5px;text-align:start;cursor:pointer;min-height:0}
.tpi-opt[aria-selected=true]{background:rgba(var(--brand-rgb),.12)}
.tpi-opt .w{flex:none;margin-inline-start:auto;font-size:11px;color:var(--au-text3);white-space:nowrap}
.tpi-foot{padding:6px 12px;font-size:11px;color:var(--au-text3);border-top:1px solid rgba(var(--ink),.08)}
.tpi-none{padding:14px 12px;font-size:12.5px;color:var(--au-text3)}
`
let cssDone = false
const useCss = () => { if (cssDone || typeof document === 'undefined') return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s) }

const whenLabel = (p, lang) => {
  if (p.days == null) return ''
  if (p.days === 0) return lang === 'en' ? 'today' : 'היום'
  if (p.days === 1) return lang === 'en' ? 'tomorrow' : 'מחר'
  if (p.days === 2) return lang === 'en' ? 'in 2 days' : 'בעוד יומיים'
  if (p.days === 7) return lang === 'en' ? 'in a week' : 'בעוד שבוע'
  if (p.days >= 28 && p.days < 60) return lang === 'en' ? 'in a month' : 'בעוד חודש'
  if (p.days >= 85) return lang === 'en' ? 'in 3 months' : 'בעוד 3 חודשים'
  return lang === 'en' ? `in ${p.days} days` : `בעוד ${p.days} ימים`
}

export default function TaskPresetInput({ value, onChange, onPick, onEnter, lang = 'he', kind = 'task', placeholder, className, style, inputStyle, id, autoFocus, ariaLabel, dictate = true }) {
  useCss()
  const t = TR[lang === 'en' ? 'en' : 'he']
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState(null)
  const [recent, setRecent] = useState(readRecent)
  const wrap = useRef(null), pop = useRef(null), input = useRef(null), listRef = useRef(null)
  const groups = useMemo(() => filterPresets(value, { kind }), [value, kind])
  const recentShown = useMemo(() => { const s = String(value || '').trim().toLowerCase(); return recent.filter(r => !s || r.toLowerCase().includes(s)).slice(0, 4) }, [recent, value])
  const flat = useMemo(() => [...recentShown.map(r => ({ text: r, recent: true })), ...groups.flatMap(g => g.items.map(p => ({ p, text: presetText(p, lang) })))], [recentShown, groups, lang])

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = wrap.current?.getBoundingClientRect(); if (!r) return
      const w = Math.max(r.width, Math.min(360, window.innerWidth - 16))
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, lang === 'en' ? r.left : r.right - w))
      const below = window.innerHeight - r.bottom - 12, above = r.top - 12
      const up = below < 260 && above > below
      setPos({ left, w, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }), maxH: Math.max(180, Math.min(380, up ? above : below)) })
    }
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, lang])
  useEffect(() => {
    if (!open) return
    const down = e => { if (!wrap.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', down, true)
    return () => document.removeEventListener('pointerdown', down, true)
  }, [open])
  useEffect(() => { setActive(-1) }, [value])
  useEffect(() => { if (active >= 0) listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }) }, [active])

  const pick = x => {
    onChange(x.text)
    if (x.p) onPick?.(x.p, presetDue(x.p))
    setOpen(false); setRecent(readRecent())
    setTimeout(() => input.current?.focus(), 0)
  }
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) setOpen(true); setActive(a => Math.min(flat.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false) }
    else if (e.key === 'Enter') {
      if (open && active >= 0 && flat[active]) { e.preventDefault(); pick(flat[active]) }
      else { setOpen(false); onEnter?.() }
    }
  }
  let i = -1
  const opt = (x, key) => { i++; const k = i; return (
    <button key={key} type="button" role="option" data-i={k} aria-selected={active === k} className="tpi-opt" onMouseEnter={() => setActive(k)} onClick={() => pick(x)}>
      <span dir="auto">{x.text}</span>{x.p && <span className="w">{whenLabel(x.p, lang)}</span>}
    </button>
  ) }
  const listId = `${id || 'tpi'}-list`
  return (
    <div className={`tpi ${className || ''}`} style={style}>
     <div ref={wrap} className="tpi-box">
      <input ref={input} id={id} className="lc-in" value={value} autoFocus={autoFocus} dir={value ? 'auto' : (lang === 'en' ? 'ltr' : 'rtl')} placeholder={placeholder} aria-label={ariaLabel || placeholder}
        role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        onChange={e => { onChange(e.target.value); setOpen(true) }} onClick={() => setOpen(true)} onKeyDown={onKey}
        style={{ width: '100%', ...inputStyle }}/>
      <button type="button" className="tpi-tgl" aria-label={t.open} title={t.open} aria-expanded={open} tabIndex={-1} onClick={() => { setOpen(o => !o); input.current?.focus() }}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6"/></svg>
      </button>
     </div>
      {dictate && <VoiceDictate value={value} onChange={v => { onChange(v); setOpen(false) }} kind="task" lang={lang} inputRef={input}/>}
      {open && pos && createPortal(
        <div ref={pop} className="tpi-pop" dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ left: pos.left, width: pos.w, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxH }}>
          <div ref={listRef} id={listId} role="listbox" aria-label={t.open} className="tpi-list">
            {recentShown.length > 0 && <><div className="tpi-sec">{t.recent}</div>{recentShown.map((r, k) => opt({ text: r, recent: true }, `r${k}`))}</>}
            {groups.map(g => (
              <div key={g.id} role="group" aria-label={lang === 'en' ? g.en : g.he}>
                <div className="tpi-sec">{lang === 'en' ? g.en : g.he}</div>
                {g.items.map(p => opt({ p, text: presetText(p, lang) }, p.id))}
              </div>
            ))}
            {!flat.length && <div className="tpi-none">{t.none}</div>}
          </div>
          <div className="tpi-foot">{t.hint}</div>
        </div>, document.body)}
    </div>
  )
}
