// Command palette (Ctrl/⌘ + K): jump to any section, lead or property, or run a quick action.
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FaSearch, FaUser, FaBuilding, FaBolt, FaLevelDownAlt } from 'react-icons/fa'
import { T } from './automationsUI.jsx'

const TR = {
  he: { ph: 'חיפוש לידים, נכסים, מסכים ופעולות…', nav: 'מסכים', act: 'פעולות', leads: 'לידים', props: 'נכסים', empty: 'לא נמצאו תוצאות', hint: 'ניווט', open: 'פתיחה', close: 'סגירה', chat: 'פתח שיחה', label: 'חיפוש מהיר' },
  en: { ph: 'Search leads, properties, screens and actions…', nav: 'Screens', act: 'Actions', leads: 'Leads', props: 'Properties', empty: 'No results', hint: 'Navigate', open: 'Open', close: 'Close', chat: 'Open chat', label: 'Quick search' },
}
const norm = s => String(s || '').toLowerCase().replace(/[\u0591-\u05C7]/g, '').trim()
const digits = s => String(s || '').replace(/\D/g, '')

export function useCommandHotkey(setOpen) {
  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) { e.preventDefault(); setOpen(o => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])
}

export default function CommandPalette({ open, onClose, lang = 'he', tabs = [], actions = [], leads = [], properties = [], onTab, onLead, onProperty }) {
  const t = TR[lang] || TR.he
  const dir = lang === 'en' ? 'ltr' : 'rtl'
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 20) } }, [open])

  const groups = useMemo(() => {
    const nq = norm(q), dq = digits(q)
    const hit = s => !nq || norm(s).includes(nq)
    const g = []
    const nav = tabs.filter(x => hit(x.label)).map(x => ({ key: `tab:${x.id}`, icon: x.Icon, label: x.label, run: () => onTab(x.id) }))
    const act = actions.filter(x => hit(x.label)).map(x => ({ key: `act:${x.id}`, icon: x.Icon || FaBolt, label: x.label, run: x.run }))
    let ld = [], pr = []
    if (nq || dq.length >= 3) {
      ld = leads.filter(l => (nq && norm(l.name).includes(nq)) || (dq.length >= 3 && digits(l.phone).includes(dq.replace(/^0/, '')))).slice(0, 6)
        .map(l => ({ key: `lead:${l.id}`, icon: FaUser, label: l.name || l.phone, sub: l.phone, run: () => onLead(l), tag: t.chat }))
      pr = properties.filter(p => hit(`${p.title} ${p.location}`)).slice(0, 5)
        .map(p => ({ key: `prop:${p.id}`, icon: FaBuilding, label: p.title || '—', sub: p.location, run: () => onProperty(p) }))
    }
    if (nav.length) g.push({ title: t.nav, items: nav })
    if (act.length) g.push({ title: t.act, items: act })
    if (ld.length) g.push({ title: t.leads, items: ld })
    if (pr.length) g.push({ title: t.props, items: pr })
    return g
  }, [q, tabs, actions, leads, properties, onTab, onLead, onProperty, t])
  const flat = groups.flatMap(g => g.items)
  useEffect(() => { setIdx(0) }, [q])
  useEffect(() => { listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [idx])

  if (!open) return null
  const run = item => { if (!item) return; onClose(); setTimeout(item.run, 0) }
  const onKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(flat[idx]) }
  }
  let n = -1
  return createPortal(
    <div dir={dir} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--au-overlay)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '12vh 14px 14px' }}>
      <div role="dialog" aria-modal="true" aria-label={t.label} onKeyDown={onKey}
        style={{ width: 'min(620px,100%)', background: T.s2, border: `1px solid ${T.s2Line}`, borderRadius: 16, boxShadow: T.shadow2, overflow: 'hidden', color: T.text, fontFamily: 'inherit', animation: 'au-in .16s ease both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 56, borderBottom: `1px solid ${T.line}` }}>
          <FaSearch size={14} style={{ color: T.text3, flexShrink: 0 }}/>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder={t.ph} aria-label={t.label} role="combobox" aria-expanded="true" aria-controls="cmdk-list"
            aria-activedescendant={flat[idx] ? `cmdk-${idx}` : undefined}
            style={{ flex: 1, minWidth: 0, height: 54, border: 'none', outline: 'none', background: 'transparent', color: T.text, fontSize: 15.5, fontFamily: 'inherit' }}/>
          <kbd style={{ fontSize: 11, color: T.text3, border: `1px solid ${T.line2}`, borderRadius: 6, padding: '2px 6px', fontFamily: 'inherit' }}>Esc</kbd>
        </div>
        <div ref={listRef} id="cmdk-list" role="listbox" style={{ maxHeight: 'min(420px,60vh)', overflowY: 'auto', padding: 8 }}>
          {!flat.length && <div style={{ padding: '28px 12px', textAlign: 'center', fontSize: 13.5, color: T.text3 }}>{t.empty}</div>}
          {groups.map(g => (
            <div key={g.title} role="group" aria-label={g.title} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.text3, padding: '8px 10px 4px', letterSpacing: '.03em' }}>{g.title}</div>
              {g.items.map(item => {
                n++
                const i = n, on = i === idx, Ic = item.icon
                return (
                  <div key={item.key} id={`cmdk-${i}`} role="option" aria-selected={on} data-active={on} onMouseMove={() => setIdx(i)} onClick={() => run(item)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 10px', height: 42, borderRadius: 10, cursor: 'pointer', background: on ? T.brandSoft : 'transparent' }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: on ? 'rgba(var(--brand-rgb),.22)' : 'rgba(var(--ov),.05)', color: on ? T.brandText : T.text2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{Ic && <Ic size={12}/>}</span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><bdi>{item.label}</bdi></span>
                      {item.sub && <span dir="ltr" style={{ fontSize: 12, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', unicodeBidi: 'isolate' }}>{item.sub}</span>}
                    </span>
                    {on && <span style={{ fontSize: 11.5, color: T.text3, display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>{item.tag || t.open}<FaLevelDownAlt size={10} style={{ transform: dir === 'rtl' ? 'scaleX(-1) rotate(90deg)' : 'rotate(90deg)' }}/></span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, padding: '8px 16px', borderTop: `1px solid ${T.line}`, fontSize: 11.5, color: T.text3 }}>
          <span><kbd style={{ fontFamily: 'inherit' }}>↑↓</kbd> {t.hint}</span><span><kbd style={{ fontFamily: 'inherit' }}>↵</kbd> {t.open}</span><span><kbd style={{ fontFamily: 'inherit' }}>Esc</kbd> {t.close}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
