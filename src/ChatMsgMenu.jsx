// A message bubble's menu, like WhatsApp Web: a ▾ that shows on hover at the bubble's top corner → "העתקה" (the text to the
// clipboard) and "שמירה כתבנית" (a new template from the message — TemplateQuickEdit create mode, the lead's name and project
// turned back into {name} / {property}).
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

const TXT = {
  he: { menu: 'אפשרויות להודעה', copy: 'העתקה', copied: 'הועתק', save: 'שמירה כתבנית' },
  en: { menu: 'Message options', copy: 'Copy', copied: 'Copied', save: 'Save as a template' },
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { /* older browsers / no permission */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok
  } catch { return false }
}

export default function ChatMsgMenu({ text, isOut, WA, lang = 'he', onSaveTemplate }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pos, setPos] = useState(null)
  const btn = useRef(null), pop = useRef(null)
  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect(), w = 190
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, isOut ? r.right - w : r.left))
    const top = r.bottom + 120 > window.innerHeight ? r.top - 100 : r.bottom + 4
    setPos({ top, left, w })
  }, [open, isOut])
  useEffect(() => {
    if (!open) return
    const down = e => { if (!btn.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(false) }
    const key = e => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('pointerdown', down, true); document.addEventListener('keydown', key); window.addEventListener('scroll', close, true)
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key); window.removeEventListener('scroll', close, true) }
  }, [open])
  if (!text) return null
  const item = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', border: 'none', background: 'transparent', color: WA.bodyText, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', textAlign: 'start', minHeight: 0 }
  return (<>
    <button ref={btn} type="button" className="wa-bub-btn" aria-label={t.menu} aria-haspopup="menu" aria-expanded={open}
      onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
      style={{ position: 'absolute', top: 2, [isOut ? 'right' : 'left']: 2, width: 26, height: 22, border: 'none', borderRadius: 6, cursor: 'pointer', minHeight: 0, minWidth: 0, padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: WA.subText, background: 'transparent', zIndex: 1 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
    </button>
    {open && pos && createPortal(
      <div ref={pop} role="menu" aria-label={t.menu} dir={lang === 'en' ? 'ltr' : 'rtl'}
        style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.w, zIndex: 3000, background: WA.modalBg || WA.panelBg, border: `1px solid ${WA.border}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.28)', padding: '6px 0' }}>
        <button type="button" role="menuitem" className="wa-bub-item" style={item} onClick={async () => { const ok = await copyText(text); setCopied(ok); setTimeout(() => { setCopied(false); setOpen(false) }, 700) }}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>
          {copied ? `${t.copied} ✓` : t.copy}
        </button>
        {onSaveTemplate && <button type="button" role="menuitem" className="wa-bub-item" style={item} onClick={() => { setOpen(false); onSaveTemplate(text) }}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm3-10H5V5h10v4Z"/></svg>
          {t.save}
        </button>}
      </div>, document.body)}
  </>)
}
