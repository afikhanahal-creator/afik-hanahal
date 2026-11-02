// A message bubble's menu, like WhatsApp Web: a ▾ that shows on hover at the bubble's top corner → a row of quick reactions
// (sendReaction; the same emoji again takes it back), "השב" (a quote above the box — sendMessage quotedMessageId), "העברה"
// (forwardMessages to one or more chats), "בחירת הודעות" (pick several, then forward them together), "העתקה" (the text to the
// clipboard) and "שמירה כתבנית" (a new template from the message — TemplateQuickEdit create mode, the lead's name and project
// turned back into {name} / {property}). Every action is optional: the menu shows what its parent passes.
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'

const TXT = {
  he: { menu: 'אפשרויות להודעה', copy: 'העתקה', copied: 'הועתק', save: 'שמירה כתבנית', reply: 'השב', forward: 'העברה', select: 'בחירת הודעות', react: 'תגובה', unreact: 'הסרת התגובה' },
  en: { menu: 'Message options', copy: 'Copy', copied: 'Copied', save: 'Save as a template', reply: 'Reply', forward: 'Forward', select: 'Select messages', react: 'React', unreact: 'Remove reaction' },
}
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const I = {
  reply: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11Z',
  forward: 'M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11Z',
  select: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm-9 14-5-5 1.4-1.4 3.6 3.6 7.6-7.6L19 8l-9 9Z',
}
const Svg = ({ d }) => <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d={d}/></svg>

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { /* older browsers / no permission */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok
  } catch { return false }
}

export default function ChatMsgMenu({ text, isOut, WA, lang = 'he', bg, onSaveTemplate, onReply, onForward, onSelect, onReact, myReaction = '' }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pos, setPos] = useState(null)
  const btn = useRef(null), pop = useRef(null)
  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect(), w = onReact ? 236 : 190
    const h = 16 + (onReact ? 46 : 0) + 38 * [onReply, onForward, onSelect, text, text && onSaveTemplate].filter(Boolean).length
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left))   // opens from the bubble's left corner, like the button
    const top = r.bottom + h + 8 > window.innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4
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
  if (!text && !onReply && !onForward && !onReact) return null
  const act = fn => () => { setOpen(false); fn() }
  const item = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', border: 'none', background: 'transparent', color: WA.bodyText, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', textAlign: 'start', minHeight: 0 }
  return (<>
    <button ref={btn} type="button" className="wa-bub-btn" aria-label={t.menu} aria-haspopup="menu" aria-expanded={open}
      onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
      style={{ position: 'absolute', top: 1, left: 1, width: 34, height: 22, border: 'none', borderRadius: 6, cursor: 'pointer', minHeight: 0, minWidth: 0, padding: '0 8px 0 0',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: WA.subText, background: bg ? `linear-gradient(to right, ${bg} 62%, transparent)` : 'inherit', zIndex: 1 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
    </button>
    {open && pos && createPortal(
      <div ref={pop} role="menu" aria-label={t.menu} dir={lang === 'en' ? 'ltr' : 'rtl'}
        style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.w, zIndex: 3000, background: WA.modalBg || WA.panelBg, border: `1px solid ${WA.border}`, borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,.28)', padding: '6px 0' }}>
        {onReact && <div role="group" aria-label={t.react} style={{ display: 'flex', justifyContent: 'space-between', gap: 2, padding: '2px 8px 6px', borderBottom: `1px solid ${WA.border}`, marginBottom: 4 }}>
          {QUICK_REACTIONS.map(e => { const on = myReaction === e; return (
            <button key={e} type="button" role="menuitem" className="wa-bub-emo" aria-label={on ? `${t.unreact} ${e}` : `${t.react} ${e}`} aria-pressed={on} title={on ? t.unreact : t.react}
              onClick={act(() => onReact(on ? '' : e))}
              style={{ width: 34, height: 34, minHeight: 0, minWidth: 0, padding: 0, border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: 20, lineHeight: 1, background: on ? 'rgba(0,168,132,.18)' : 'transparent', fontFamily: 'inherit' }}>{e}</button>
          ) })}
        </div>}
        {onReply && <button type="button" role="menuitem" className="wa-bub-item" style={item} onClick={act(onReply)}><Svg d={I.reply}/>{t.reply}</button>}
        {onForward && <button type="button" role="menuitem" className="wa-bub-item" style={item} onClick={act(onForward)}><Svg d={I.forward}/>{t.forward}</button>}
        {onSelect && <button type="button" role="menuitem" className="wa-bub-item" style={item} onClick={act(onSelect)}><Svg d={I.select}/>{t.select}</button>}
        {text && <button type="button" role="menuitem" className="wa-bub-item" style={item} onClick={async () => { const ok = await copyText(text); setCopied(ok); setTimeout(() => { setCopied(false); setOpen(false) }, 700) }}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>
          {copied ? `${t.copied} ✓` : t.copy}
        </button>}
        {text && onSaveTemplate && <button type="button" role="menuitem" className="wa-bub-item" style={item} onClick={() => { setOpen(false); onSaveTemplate(text) }}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm3-10H5V5h10v4Z"/></svg>
          {t.save}
        </button>}
      </div>, document.body)}
  </>)
}
