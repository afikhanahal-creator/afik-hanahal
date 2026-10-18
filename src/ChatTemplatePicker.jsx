// WhatsApp page → ⚡ "תבניות מוכנות": the whole template library (lib/automations-shared.js), rendered for the open chat's
// lead (name in Hebrew, the campaign's short name, what the lead told us — lib/lead-needs.js), with a "recommended now"
// row (the most personal template + the lead's stage), categories, search, a Hebrew / English switch, a full preview that
// can be edited, and two actions per template: send now (the panel stays open, so several can go out one after another)
// or put it in the message box. Templates already sent in this chat are marked.
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import { templateList, renderTemplate, CATEGORIES, leadLang } from '../lib/automations-shared.js'
import { bestPersonalTemplateId } from '../lib/lead-needs.js'

const TR = {
  he: { title: 'תבניות מוכנות', search: 'חיפוש תבנית…', all: 'הכול', rec: 'מומלץ עכשיו', send: 'שלח עכשיו', sending: 'שולח…', insert: 'לעריכה בתיבה', sent: 'נשלח', sentNow: 'נשלח ✓', reset: 'שחזר נוסח', none: 'לא נמצאו תבניות', close: 'סגירה', he: 'עברית', en: 'English', hint: 'אפשר לערוך את הנוסח לפני השליחה', count: n => `${n} תבניות` },
  en: { title: 'Ready templates', search: 'Search templates…', all: 'All', rec: 'Recommended now', send: 'Send now', sending: 'Sending…', insert: 'Edit in the box', sent: 'Sent', sentNow: 'Sent ✓', reset: 'Restore wording', none: 'No templates found', close: 'Close', he: 'עברית', en: 'English', hint: 'You can edit the wording before sending', count: n => `${n} templates` },
}
// the lead's stage → the category that fits it now
const STAGE_CAT = { new: 'welcome', contacted: 'followup', discovery: 'progress', negotiating: 'progress', won: 'deal', lost: 'closing', irrelevant: 'closing', nurture: 'closing' }
const norm = s => String(s || '').replace(/\s+/g, ' ').trim()
// a line that identifies a sent template: the longest line that isn't the greeting or the signature
const signature = text => norm(text.split('\n').filter(l => !/^(שלום|hello|hi)\b/i.test(l.trim())).sort((a, b) => b.length - a.length)[0] || '').slice(0, 36)

// The library rendered for one lead + what was already sent + what fits now (shared by the panel and the header menu)
function useTemplateData({ lead, msgs, autoConfig, tplLang }) {
  const cfg = autoConfig || undefined
  const all = useMemo(() => templateList(cfg).map(x => ({ ...x, text: renderTemplate(x, lead, cfg, tplLang) })), [cfg, lead, tplLang])
  const outText = useMemo(() => msgs.filter(m => m.direction === 'out').map(m => norm(m.message)).join('\n'), [msgs])
  const sentIds = useMemo(() => new Set(all.filter(x => { const sig = signature(x.text); return sig.length > 12 && outText.includes(sig) }).map(x => x.id)), [all, outText])
  const recommended = useMemo(() => {
    const ids = []
    const best = bestPersonalTemplateId(lead, tplLang); if (best) ids.push(best)
    const hasOut = msgs.some(m => m.direction === 'out')
    const stageCat = !hasOut ? 'welcome' : STAGE_CAT[lead?.leadStatus || lead?.status] || 'followup'
    all.filter(x => x.cat === stageCat && !sentIds.has(x.id)).slice(0, 3).forEach(x => ids.push(x.id))
    return [...new Set(ids)].map(id => all.find(x => x.id === id)).filter(Boolean).slice(0, 4)
  }, [all, lead, msgs, sentIds, tplLang])
  return { all, sentIds, recommended }
}

export default function ChatTemplatePicker({ WA, lead, msgs = [], autoConfig, lang = 'he', onSend, onInsert, onClose }) {
  const t = TR[lang] || TR.he
  const [tplLang, setTplLang] = useState(() => leadLang(lead))
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [edits, setEdits] = useState({})          // id → edited text (per language)
  const [busy, setBusy] = useState(null)
  const [justSent, setJustSent] = useState({})
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose?.() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  const { all, sentIds, recommended } = useTemplateData({ lead, msgs, autoConfig, tplLang })

  const ql = q.trim().toLowerCase()
  const list = all.filter(x => (cat === 'all' || x.cat === cat) && (!ql || `${x.he_title} ${x.en_title} ${x.text}`.toLowerCase().includes(ql)))
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map(c => [c.id, all.filter(x => x.cat === c.id).length])), [all])
  const key = id => `${id}:${tplLang}`
  const textOf = x => edits[key(x.id)] ?? x.text

  const send = async x => {
    if (busy) return
    setBusy(x.id)
    const ok = await onSend?.(textOf(x))
    setBusy(null)
    if (ok) setJustSent(s => ({ ...s, [x.id]: true }))
  }

  const chip = (on) => ({ border: `1px solid ${on ? WA.green : WA.border}`, background: on ? WA.green + '1f' : 'transparent', color: on ? WA.bodyText : WA.subText, borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: on ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', minHeight: 0 })
  const btn = (primary) => ({ border: primary ? 'none' : `1px solid ${WA.border}`, background: primary ? WA.green : 'transparent', color: primary ? '#fff' : WA.bodyText, borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0 })

  const card = (x, inRec) => {
    const open = openId === (inRec ? 'r:' : '') + x.id
    const c = CATEGORIES.find(k => k.id === x.cat)
    const title = tplLang === 'en' ? (x.en_title || x.he_title) : x.he_title
    const wasSent = justSent[x.id] || sentIds.has(x.id)
    return (
      <div key={(inRec ? 'r:' : '') + x.id} style={{ borderBottom: `1px solid ${WA.border}`, background: open ? WA.hoverRow : 'transparent' }}>
        <button type="button" onClick={() => setOpenId(open ? null : (inRec ? 'r:' : '') + x.id)} aria-expanded={open}
          style={{ display: 'block', width: '100%', textAlign: 'start', background: 'transparent', border: 'none', padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', color: WA.bodyText, minHeight: 0 }}
          onMouseEnter={e => { if (!open) e.currentTarget.style.background = WA.hoverRow }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: c?.color || WA.subText, flex: 'none' }}/>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            {wasSent && <span style={{ fontSize: 11, fontWeight: 600, color: WA.green, border: `1px solid ${WA.green}55`, borderRadius: 999, padding: '0 7px' }}>{justSent[x.id] ? t.sentNow : t.sent}</span>}
          </div>
          {!open && <div style={{ fontSize: 12, color: WA.subText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2, paddingInlineStart: 15 }}>{x.text.replace(/\n+/g, ' · ')}</div>}
        </button>
        {open && (
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <textarea value={textOf(x)} onChange={e => setEdits(s => ({ ...s, [key(x.id)]: e.target.value }))} dir={tplLang === 'en' ? 'ltr' : 'rtl'}
              rows={Math.min(10, textOf(x).split('\n').length + 1)}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: WA.inputFieldBg, color: WA.bodyText, border: `1px solid ${WA.border}`, borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.55, outline: 'none' }}/>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" style={btn(true)} disabled={!!busy || !textOf(x).trim()} onClick={() => send(x)}>{busy === x.id ? t.sending : t.send}</button>
              <button type="button" style={btn(false)} onClick={() => onInsert?.(textOf(x))}>{t.insert}</button>
              {edits[key(x.id)] != null && edits[key(x.id)] !== x.text && <button type="button" style={{ ...btn(false), border: 'none', color: WA.subText }} onClick={() => setEdits(s => { const n = { ...s }; delete n[key(x.id)]; return n })}>{t.reset}</button>}
              <span style={{ fontSize: 11.5, color: WA.subText, marginInlineStart: 'auto' }}>{t.hint}</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ flexShrink: 0, height: 'min(460px, 58vh)', display: 'flex', flexDirection: 'column', background: WA.panelBg, borderTop: `1px solid ${WA.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 6px' }}>
        <b style={{ fontSize: 14, color: WA.bodyText }}>⚡ {t.title}</b>
        <span style={{ fontSize: 12, color: WA.subText }}>{t.count(all.length)}</span>
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 4 }}>
          {['he', 'en'].map(l => <button key={l} type="button" style={chip(tplLang === l)} onClick={() => setTplLang(l)}>{t[l]}</button>)}
        </div>
        <button type="button" onClick={onClose} aria-label={t.close} style={{ background: 'none', border: 'none', color: WA.subText, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4, minHeight: 0 }}>×</button>
      </div>
      <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} autoFocus
          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 11px', background: WA.inputFieldBg, border: `1px solid ${WA.border}`, borderRadius: 8, color: WA.bodyText, fontFamily: 'inherit', fontSize: 13, outline: 'none', minHeight: 0 }}/>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <button type="button" style={chip(cat === 'all')} onClick={() => setCat('all')}>{t.all} · {all.length}</button>
          {CATEGORIES.filter(c => counts[c.id]).map(c => <button key={c.id} type="button" style={chip(cat === c.id)} onClick={() => setCat(c.id)}>{lang === 'en' ? c.en : c.he} · {counts[c.id]}</button>)}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: `1px solid ${WA.border}` }}>
        {cat === 'all' && !ql && recommended.length > 0 && <>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: WA.subText, padding: '8px 12px 2px' }}>{t.rec}</div>
          {recommended.map(x => card(x, true))}
          <div style={{ height: 6, background: WA.inputBg }}/>
        </>}
        {list.length ? list.map(x => card(x, false)) : <p style={{ textAlign: 'center', color: WA.subText, fontSize: 13, padding: 20, margin: 0 }}>{t.none}</p>}
      </div>
    </div>
  )
}

// ── Chat header → "תבניות ▾": every template in one dropdown (recommended, personal, then each category). A click puts
// the message in the box to review and send; "שלח" sends it as is. Arrow keys + Enter work, Esc closes.
const MT = {
  he: { button: 'תבניות', search: 'חיפוש תבנית…', rec: 'מומלץ לליד הזה', send: 'שלח', sending: '…', sent: 'נשלח', all: 'כל התבניות עם תצוגה מלאה', none: 'לא נמצאו תבניות', hint: 'לחיצה מכניסה לתיבת ההודעה', sendTip: 'שליחה מיידית בלי עריכה', count: n => `${n} תבניות` },
  en: { button: 'Templates', search: 'Search templates…', rec: 'Recommended for this lead', send: 'Send', sending: '…', sent: 'Sent', all: 'All templates with full preview', none: 'No templates found', hint: 'A click puts it in the message box', sendTip: 'Send right away, as is', count: n => `${n} templates` },
}
export function ChatTemplateMenu({ WA, lead, msgs = [], autoConfig, lang = 'he', onSend, onInsert, onOpenPanel }) {
  const t = MT[lang] || MT.he
  const [open, setOpen] = useState(false)
  const [tplLang, setTplLang] = useState(() => leadLang(lead))
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [busy, setBusy] = useState(null)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null), menuRef = useRef(null), listRef = useRef(null)
  const { all, sentIds, recommended } = useTemplateData({ lead, msgs, autoConfig, tplLang })
  useEffect(() => { setTplLang(leadLang(lead)) }, [lead?.phone]) // eslint-disable-line react-hooks/exhaustive-deps

  // sections: recommended, then personal, then every other category (search = one flat list)
  const ql = q.trim().toLowerCase()
  const sections = useMemo(() => {
    if (ql) return [{ id: 'q', items: all.filter(x => `${x.he_title} ${x.en_title} ${x.text}`.toLowerCase().includes(ql)) }]
    const order = ['personal', ...CATEGORIES.map(c => c.id).filter(id => id !== 'personal')]
    return [{ id: 'rec', label: t.rec, items: recommended }, ...order.map(id => { const c = CATEGORIES.find(k => k.id === id); return { id, label: c ? (lang === 'en' ? c.en : c.he) : id, color: c?.color, items: all.filter(x => x.cat === id) } })].filter(sc => sc.items.length)
  }, [all, recommended, ql, lang, t.rec])
  const flat = sections.flatMap(sc => sc.items.map(x => ({ x, key: `${sc.id}:${x.id}` })))

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect(); if (!r) return
    const w = Math.min(420, window.innerWidth - 16)
    const left = Math.min(Math.max(8, lang === 'en' ? r.left : r.right - w), window.innerWidth - w - 8)
    setPos({ left, top: r.bottom + 6, width: w, maxHeight: Math.max(260, window.innerHeight - r.bottom - 24) })
  }
  useLayoutEffect(() => { if (open) place() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    const down = e => { if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false) }
    const re = () => place()
    window.addEventListener('mousedown', down); window.addEventListener('resize', re)
    return () => { window.removeEventListener('mousedown', down); window.removeEventListener('resize', re) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setActive(0) }, [q, tplLang])
  useEffect(() => { listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }) }, [active])

  const pick = x => { onInsert?.(x.text); setOpen(false); setQ('') }
  const send = async x => {
    if (busy) return
    setBusy(x.id)
    await onSend?.(x.text)
    setBusy(null)
  }
  const onKey = e => {
    if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(flat.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); pick(flat[active].x) }
  }
  const chip = on => ({ border: `1px solid ${on ? WA.green : WA.border}`, background: on ? WA.green + '1f' : 'transparent', color: on ? WA.bodyText : WA.subText, borderRadius: 999, padding: '2px 9px', fontSize: 11.5, fontWeight: on ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0 })

  let i = -1
  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen(v => !v)} aria-haspopup="listbox" aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: open ? WA.green : 'transparent', border: `1px solid ${WA.green}`, borderRadius: 8, color: open ? '#fff' : WA.green, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap', minHeight: 0 }}>
        ⚡ {t.button} <span style={{ fontSize: 10, opacity: .8 }}>▾</span>
      </button>
      {open && pos && (
        <div ref={menuRef} role="dialog" dir={lang === 'en' ? 'ltr' : 'rtl'} onKeyDown={onKey}
          style={{ position: 'fixed', zIndex: 3000, left: pos.left, top: pos.top, width: pos.width, maxHeight: Math.min(pos.maxHeight, 560), display: 'flex', flexDirection: 'column', background: WA.panelBg, border: `1px solid ${WA.border}`, borderRadius: 12, boxShadow: '0 12px 36px rgba(0,0,0,.18)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 10px 8px', display: 'flex', flexDirection: 'column', gap: 7, borderBottom: `1px solid ${WA.border}` }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} autoFocus aria-label={t.search}
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 11px', background: WA.inputFieldBg, border: `1px solid ${WA.border}`, borderRadius: 8, color: WA.bodyText, fontFamily: 'inherit', fontSize: 13, outline: 'none', minHeight: 0 }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: WA.subText }}>
              <span>{t.count(all.length)} · {t.hint}</span>
              <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 4 }}>
                {['he', 'en'].map(l => <button key={l} type="button" style={chip(tplLang === l)} onClick={() => setTplLang(l)}>{l === 'he' ? 'עברית' : 'English'}</button>)}
              </span>
            </div>
          </div>
          <div ref={listRef} role="listbox" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {!flat.length && <p style={{ textAlign: 'center', color: WA.subText, fontSize: 13, padding: 18, margin: 0 }}>{t.none}</p>}
            {sections.map(sc => (
              <div key={sc.id}>
                {sc.label && <div style={{ position: 'sticky', top: 0, background: WA.inputBg, padding: '5px 12px', fontSize: 11.5, fontWeight: 600, color: WA.subText, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {sc.color && <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.color }}/>}{sc.label}<span style={{ fontWeight: 400 }}>· {sc.items.length}</span>
                </div>}
                {sc.items.map(x => {
                  i += 1
                  const idx = i, on = idx === active
                  const title = tplLang === 'en' ? (x.en_title || x.he_title) : x.he_title
                  return (
                    <div key={sc.id + x.id} data-i={idx} role="option" aria-selected={on} onMouseEnter={() => setActive(idx)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: on ? WA.hoverRow : 'transparent', borderBottom: `1px solid ${WA.border}`, cursor: 'pointer' }}>
                      <div onClick={() => pick(x)} title={x.text} style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: WA.bodyText }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                          {sentIds.has(x.id) && <span style={{ fontSize: 10.5, fontWeight: 600, color: WA.green, border: `1px solid ${WA.green}55`, borderRadius: 999, padding: '0 6px', flex: 'none' }}>{t.sent}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: WA.subText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{x.text.replace(/\n+/g, ' · ')}</div>
                      </div>
                      <button type="button" title={t.sendTip} onClick={() => send(x)} disabled={!!busy}
                        style={{ flex: 'none', visibility: on ? 'visible' : 'hidden', border: 'none', background: WA.green, color: '#fff', borderRadius: 7, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0 }}>{busy === x.id ? t.sending : t.send}</button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {onOpenPanel && <button type="button" onClick={() => { setOpen(false); onOpenPanel() }}
            style={{ border: 'none', borderTop: `1px solid ${WA.border}`, background: WA.inputBg, color: WA.green, fontSize: 12.5, fontWeight: 600, padding: '9px 12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', minHeight: 0 }}>{t.all} ⚡</button>}
        </div>
      )}
    </>
  )
}
