// WhatsApp page → the template library (lib/automations-shared.js), rendered for the open chat's lead (name in Hebrew, the
// campaign's short name, what the lead told us — lib/lead-needs.js). Three ways in, all built for one-click sending:
//  · ChatQuickChips — a strip over the message box with the 3–4 messages that fit this lead now: a click puts one in the
//    box, ➤ sends it as is;
//  · ChatTemplateMenu — the header's "⚡ תבניות ▾" dropdown: search, recommended, every category; "שלח" on every row;
//  · ChatTemplatePicker — the ⚡ panel: categories, search, Hebrew / English, every row with "שלח" and "לתיבה" always
//    visible, a click on the row opens an editable preview (and the template's picture, which can be left out).
// A template's picture (`image`) is sent with the text as its caption: onSend(text, { image }) / onInsert(text, tpl, lang).
// Templates already sent in this chat are marked.
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import { templateList, renderTemplate, templateImage, CATEGORIES, leadLang } from '../lib/automations-shared.js'
import { bestPersonalTemplateId } from '../lib/lead-needs.js'
import { untemplate } from '../lib/template-edit.js'
import { imageThumb } from './lib/templateImage.js'

const TR = {
  he: { title: 'תבניות מוכנות', search: 'חיפוש תבנית…', all: 'הכול', rec: 'מתאים עכשיו לליד הזה', send: 'שלח', sending: 'שולח…', insert: 'לתיבה', insertTip: 'להכניס לתיבת ההודעה ולערוך לפני השליחה', edit: 'ערוך את התבנית', editTip: 'שינוי הנוסח של התבנית עצמה, לכל הלידים', sent: 'נשלח', sentNow: 'נשלח ✓', reset: 'שחזר נוסח', none: 'לא נמצאו תבניות', close: 'סגירה', he: 'עברית', en: 'English', keys: 'Enter לתיבה · Ctrl+Enter שליחה', count: n => `${n} תבניות`, withImg: 'עם תמונה', noImg: 'בלי התמונה', addImg: 'עם התמונה' },
  en: { title: 'Ready templates', search: 'Search templates…', all: 'All', rec: 'Fits this lead now', send: 'Send', sending: 'Sending…', insert: 'To the box', insertTip: 'Put it in the message box to edit before sending', edit: 'Edit the template', editTip: 'Change the template itself, for every lead', sent: 'Sent', sentNow: 'Sent ✓', reset: 'Restore wording', none: 'No templates found', close: 'Close', he: 'עברית', en: 'English', keys: 'Enter to the box · Ctrl+Enter send', count: n => `${n} templates`, withImg: 'With picture', noImg: 'Without the picture', addImg: 'With the picture' },
}
// the lead's stage → the category that fits it now
const STAGE_CAT = { new: 'welcome', contacted: 'followup', discovery: 'progress', meeting: 'progress', negotiating: 'progress', won: 'deal', lost: 'closing', irrelevant: 'closing', nurture: 'closing' }
const norm = s => String(s || '').replace(/\s+/g, ' ').trim()
// a line that identifies a sent template: the longest line that isn't the greeting or the signature
const signature = text => norm(text.split('\n').filter(l => !/^(שלום|hello|hi)\b/i.test(l.trim())).sort((a, b) => b.length - a.length)[0] || '').slice(0, 36)
const titleOf = (x, l) => (l === 'en' ? (x.en_title || x.he_title) : (x.he_title || x.en_title)) || ''

// The library rendered for one lead + what was already sent + what fits now (shared by the panel, the menu and the chips)
function useTemplateData({ lead, msgs, autoConfig, tplLang }) {
  const cfg = autoConfig || undefined
  const all = useMemo(() => templateList(cfg).map(x => ({ ...x, image: templateImage(x), text: renderTemplate(x, lead, cfg, tplLang) })), [cfg, lead, tplLang])
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

// The picture of a row: a rounded thumbnail (through the image CDN), or the category's color dot
function Thumb({ x, size = 40, WA }) {
  const c = CATEGORIES.find(k => k.id === x.cat)
  if (x.image) return <img src={imageThumb(x.image, size * 2)} alt="" width={size} height={size} loading="lazy" style={{ flex: 'none', width: size, height: size, borderRadius: 8, objectFit: 'cover', background: WA.border }}/>
  return <span aria-hidden style={{ flex: 'none', width: size, height: size, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: (c?.color || '#8490D8') + '1F', fontSize: size > 34 ? 17 : 14 }}>{c?.icon || '💬'}</span>
}

const sendBtn = (WA, extra = {}) => ({ flex: 'none', border: 'none', background: WA.green, color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0, display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', ...extra })
const ghostBtn = (WA, extra = {}) => ({ flex: 'none', border: `1px solid ${WA.border}`, background: 'transparent', color: WA.bodyText, borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0, whiteSpace: 'nowrap', ...extra })

export default function ChatTemplatePicker({ WA, lead, msgs = [], autoConfig, lang = 'he', onSend, onInsert, onEdit, onClose }) {
  const t = TR[lang] || TR.he
  const [tplLang, setTplLang] = useState(() => leadLang(lead))
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [edits, setEdits] = useState({})          // id → edited text (per language)
  const [noImg, setNoImg] = useState({})          // id → leave the picture out of this send
  const [busy, setBusy] = useState(null)
  const [justSent, setJustSent] = useState({})
  const [active, setActive] = useState(0)
  const listRef = useRef(null)
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose?.() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  const { all, sentIds, recommended } = useTemplateData({ lead, msgs, autoConfig, tplLang })

  const ql = q.trim().toLowerCase()
  const list = all.filter(x => (cat === 'all' || x.cat === cat) && (!ql || `${x.he_title} ${x.en_title} ${x.text}`.toLowerCase().includes(ql)))
  const rows = useMemo(() => [...(cat === 'all' && !ql ? recommended.map(x => ({ x, rk: `r:${x.id}`, rec: true })) : []), ...list.map(x => ({ x, rk: x.id }))], [cat, ql, recommended, list])
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map(c => [c.id, all.filter(x => x.cat === c.id).length])), [all])
  useEffect(() => { setActive(0) }, [q, cat, tplLang])
  useEffect(() => { listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }) }, [active])
  const key = id => `${id}:${tplLang}`
  const textOf = x => edits[key(x.id)] ?? x.text
  const imgOf = x => (noImg[x.id] ? '' : x.image)

  const send = async x => {
    if (busy) return
    setBusy(x.id)
    const ok = await onSend?.(textOf(x), { image: imgOf(x) })
    setBusy(null)
    if (ok) setJustSent(s => ({ ...s, [x.id]: true }))
  }
  const insert = x => onInsert?.(textOf(x), { ...x, image: imgOf(x) }, tplLang)
  const onKey = e => {
    const r = rows[active]
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(rows.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' && r && !['TEXTAREA', 'BUTTON'].includes(e.target.tagName)) { e.preventDefault(); if (e.ctrlKey || e.metaKey) send(r.x); else insert(r.x) }
  }

  const chip = on => ({ flex: 'none', border: `1px solid ${on ? WA.green : WA.border}`, background: on ? WA.green + '1f' : 'transparent', color: on ? WA.bodyText : WA.subText, borderRadius: 999, padding: '4px 11px', fontSize: 12, fontWeight: on ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', minHeight: 0 })

  const row = ({ x, rk }, idx) => {
    const open = openId === rk
    const wasSent = justSent[x.id] || sentIds.has(x.id)
    const on = idx === active
    return (
      <div key={rk} data-i={idx} onMouseEnter={() => setActive(idx)} style={{ borderBottom: `1px solid ${WA.border}`, background: open || on ? WA.hoverRow : 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
          <button type="button" onClick={() => setOpenId(open ? null : rk)} aria-expanded={open}
            style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'start', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: WA.bodyText, minHeight: 0 }}>
            <Thumb x={x} WA={WA}/>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(x, tplLang)}</span>
                {wasSent && <span style={{ flex: 'none', fontSize: 10.5, fontWeight: 600, color: WA.green, border: `1px solid ${WA.green}55`, borderRadius: 999, padding: '0 7px' }}>{justSent[x.id] ? t.sentNow : t.sent}</span>}
              </span>
              {!open && <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12, lineHeight: 1.45, color: WA.subText, marginTop: 1 }}>{x.text.replace(/\n+/g, ' · ')}</span>}
            </span>
          </button>
          <button type="button" style={ghostBtn(WA)} title={t.insertTip} onClick={() => insert(x)}>{t.insert}</button>
          <button type="button" style={sendBtn(WA)} disabled={!!busy || (!textOf(x).trim() && !imgOf(x))} onClick={() => send(x)}>{busy === x.id ? t.sending : <>{t.send} <span aria-hidden style={{ display: 'inline-block', transform: lang === 'en' ? 'none' : 'scaleX(-1)' }}>➤</span></>}</button>
        </div>
        {open && (
          <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {x.image && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={imageThumb(x.image, 240)} alt="" style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, opacity: noImg[x.id] ? .35 : 1 }}/>
                <button type="button" style={ghostBtn(WA)} onClick={() => setNoImg(s => ({ ...s, [x.id]: !s[x.id] }))}>{noImg[x.id] ? `＋ ${t.addImg}` : `✕ ${t.noImg}`}</button>
              </div>
            )}
            <textarea value={textOf(x)} onChange={e => setEdits(s => ({ ...s, [key(x.id)]: e.target.value }))} dir={tplLang === 'en' ? 'ltr' : 'rtl'}
              rows={Math.min(8, textOf(x).split('\n').length + 1)}
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: WA.inputFieldBg, color: WA.bodyText, border: `1px solid ${WA.border}`, borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.55, outline: 'none' }}/>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {onEdit && <button type="button" style={ghostBtn(WA)} title={t.editTip} onClick={() => {
                // an edit made here in the preview goes into the template with the lead's details back as variables
                const changed = edits[key(x.id)] != null && edits[key(x.id)] !== x.text
                onEdit(x, changed ? { [tplLang]: untemplate(textOf(x), renderTemplate(x, lead, autoConfig || undefined, tplLang, { keys: true })) } : null, tplLang, changed)
              }}>✏️ {t.edit}</button>}
              {edits[key(x.id)] != null && edits[key(x.id)] !== x.text && <button type="button" style={ghostBtn(WA, { border: 'none', color: WA.subText })} onClick={() => setEdits(s => { const n = { ...s }; delete n[key(x.id)]; return n })}>{t.reset}</button>}
            </div>
          </div>
        )}
      </div>
    )
  }

  let i = -1
  return (
    <div dir={lang === 'en' ? 'ltr' : 'rtl'} onKeyDown={onKey} style={{ flexShrink: 0, height: 'min(480px, 60vh)', display: 'flex', flexDirection: 'column', background: WA.panelBg, borderTop: `1px solid ${WA.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 6px' }}>
        <b style={{ fontSize: 14, color: WA.bodyText }}>⚡ {t.title}</b>
        <span style={{ fontSize: 12, color: WA.subText }}>{t.count(all.length)}</span>
        {typeof window !== 'undefined' && window.innerWidth > 700 && <span style={{ fontSize: 11.5, color: WA.subText }}>· {t.keys}</span>}
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 4 }}>
          {['he', 'en'].map(l => <button key={l} type="button" style={chip(tplLang === l)} onClick={() => setTplLang(l)}>{t[l]}</button>)}
        </div>
        <button type="button" onClick={onClose} aria-label={t.close} style={{ background: 'none', border: 'none', color: WA.subText, fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4, minHeight: 0 }}>×</button>
      </div>
      <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} autoFocus
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: WA.inputFieldBg, border: `1px solid ${WA.border}`, borderRadius: 8, color: WA.bodyText, fontFamily: 'inherit', fontSize: 13, outline: 'none', minHeight: 0 }}/>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          <button type="button" style={chip(cat === 'all')} onClick={() => setCat('all')}>{t.all} · {all.length}</button>
          {CATEGORIES.filter(c => counts[c.id]).map(c => <button key={c.id} type="button" style={chip(cat === c.id)} onClick={() => setCat(c.id)}>{lang === 'en' ? c.en : c.he} · {counts[c.id]}</button>)}
        </div>
      </div>
      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', borderTop: `1px solid ${WA.border}` }}>
        {cat === 'all' && !ql && recommended.length > 0 && <div style={{ fontSize: 11.5, fontWeight: 700, color: WA.green, padding: '8px 12px 2px' }}>★ {t.rec}</div>}
        {rows.map(r => { i += 1; const el = row(r, i); return r.rec && i === recommended.length - 1 ? [el, <div key="sep" style={{ height: 6, background: WA.inputBg }}/>] : el })}
        {!list.length && <p style={{ textAlign: 'center', color: WA.subText, fontSize: 13, padding: 20, margin: 0 }}>{t.none}</p>}
      </div>
    </div>
  )
}

// ── Over the message box: the messages that fit this lead now — a click puts one in the box, ➤ sends it as is ──
const QT = {
  he: { label: 'מתאים עכשיו:', more: 'כל התבניות', sendTip: 'שליחה מיידית', putTip: 'להכניס לתיבה' },
  en: { label: 'Fits now:', more: 'All templates', sendTip: 'Send now', putTip: 'Put in the box' },
}
export function ChatQuickChips({ WA, lead, msgs = [], autoConfig, lang = 'he', onSend, onInsert, onMore }) {
  const t = QT[lang] || QT.he
  const tplLang = leadLang(lead)
  const { recommended } = useTemplateData({ lead, msgs, autoConfig, tplLang })
  const [busy, setBusy] = useState(null)
  if (!recommended.length) return null
  return (
    <div dir={lang === 'en' ? 'ltr' : 'rtl'} className="wa-chips" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', overflowX: 'auto', background: WA.panelBg, borderTop: `1px solid ${WA.border}` }}>
      <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 600, color: WA.subText }}>⚡ {t.label}</span>
      {recommended.map(x => (
        <span key={x.id} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', border: `1px solid ${WA.border}`, borderRadius: 999, background: WA.inputBg, overflow: 'hidden', maxWidth: 260 }}>
          <button type="button" title={`${t.putTip}\n\n${x.text}`} onClick={() => onInsert?.(x.text, x, tplLang)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: WA.bodyText, padding: '4px 4px 4px 10px', paddingInlineStart: x.image ? 4 : 11, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0, minWidth: 0 }}>
            {x.image && <img src={imageThumb(x.image, 48)} alt="" width={22} height={22} style={{ borderRadius: '50%', objectFit: 'cover' }}/>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(x, lang)}</span>
          </button>
          <button type="button" aria-label={`${t.sendTip}: ${titleOf(x, lang)}`} title={t.sendTip} disabled={!!busy}
            onClick={async () => { setBusy(x.id); await onSend?.(x.text, { image: x.image }); setBusy(null) }}
            style={{ flex: 'none', width: 28, height: 26, margin: 2, border: 'none', borderRadius: 999, background: WA.green, color: '#fff', fontSize: 11, cursor: 'pointer', minHeight: 0, minWidth: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {busy === x.id ? '…' : <span aria-hidden style={{ display: 'inline-block', transform: lang === 'en' ? 'none' : 'scaleX(-1)' }}>➤</span>}
          </button>
        </span>
      ))}
      {onMore && <button type="button" onClick={onMore} style={{ flex: 'none', border: 'none', background: 'transparent', color: WA.green, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: '4px 6px', minHeight: 0 }}>{t.more} ›</button>}
    </div>
  )
}

// ── Chat header → "תבניות ▾": every template in one dropdown (recommended, personal, then each category). A click puts
// the message in the box to review and send; "שלח" sends it as is. Arrow keys + Enter work (Ctrl+Enter sends), Esc closes.
const MT = {
  he: { button: 'תבניות', search: 'חיפוש תבנית…', rec: 'מומלץ לליד הזה', send: 'שלח', edit: 'ערוך', editTip: 'עריכת נוסח התבנית ושמירה במקום הקיים', sending: '…', sent: 'נשלח', all: 'כל התבניות עם תצוגה מלאה', none: 'לא נמצאו תבניות', hint: 'לחיצה מכניסה לתיבה · Ctrl+Enter שולח', sendTip: 'שליחה מיידית בלי עריכה', count: n => `${n} תבניות` },
  en: { button: 'Templates', search: 'Search templates…', rec: 'Recommended for this lead', send: 'Send', edit: 'Edit', editTip: 'Edit the template wording and save it in place', sending: '…', sent: 'Sent', all: 'All templates with full preview', none: 'No templates found', hint: 'A click puts it in the box · Ctrl+Enter sends', sendTip: 'Send right away, as is', count: n => `${n} templates` },
}
export function ChatTemplateMenu({ WA, lead, msgs = [], autoConfig, lang = 'he', onSend, onInsert, onEdit, onOpenPanel }) {
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
    const w = Math.min(460, window.innerWidth - 16)
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

  const pick = x => { onInsert?.(x.text, x, tplLang); setOpen(false); setQ('') }
  const send = async x => {
    if (busy) return
    setBusy(x.id)
    const ok = await onSend?.(x.text, { image: x.image })
    setBusy(null)
    if (ok) { setOpen(false); setQ('') }
  }
  const onKey = e => {
    if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(flat.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' && flat[active] && e.target.tagName !== 'BUTTON') { e.preventDefault(); if (e.ctrlKey || e.metaKey) send(flat[active].x); else pick(flat[active].x) }
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
          style={{ position: 'fixed', zIndex: 3000, left: pos.left, top: pos.top, width: pos.width, maxHeight: Math.min(pos.maxHeight, 580), display: 'flex', flexDirection: 'column', background: WA.panelBg, border: `1px solid ${WA.border}`, borderRadius: 12, boxShadow: '0 12px 36px rgba(0,0,0,.18)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 10px 8px', display: 'flex', flexDirection: 'column', gap: 7, borderBottom: `1px solid ${WA.border}` }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} autoFocus aria-label={t.search}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', background: WA.inputFieldBg, border: `1px solid ${WA.border}`, borderRadius: 8, color: WA.bodyText, fontFamily: 'inherit', fontSize: 13, outline: 'none', minHeight: 0 }}/>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: WA.subText }}>
              <span>{t.count(all.length)}{typeof window !== 'undefined' && window.innerWidth > 700 ? ` · ${t.hint}` : ''}</span>
              <span style={{ marginInlineStart: 'auto', display: 'flex', gap: 4 }}>
                {['he', 'en'].map(l => <button key={l} type="button" style={chip(tplLang === l)} onClick={() => setTplLang(l)}>{l === 'he' ? 'עברית' : 'English'}</button>)}
              </span>
            </div>
          </div>
          <div ref={listRef} role="listbox" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {!flat.length && <p style={{ textAlign: 'center', color: WA.subText, fontSize: 13, padding: 18, margin: 0 }}>{t.none}</p>}
            {sections.map(sc => (
              <div key={sc.id}>
                {sc.label && <div style={{ position: 'sticky', top: 0, zIndex: 1, background: WA.inputBg, padding: '5px 12px', fontSize: 11.5, fontWeight: 600, color: sc.id === 'rec' ? WA.green : WA.subText, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {sc.id === 'rec' ? '★' : sc.color && <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.color }}/>}{sc.label}<span style={{ fontWeight: 400 }}>· {sc.items.length}</span>
                </div>}
                {sc.items.map(x => {
                  i += 1
                  const idx = i, on = idx === active
                  return (
                    <div key={sc.id + x.id} data-i={idx} role="option" aria-selected={on} onMouseEnter={() => setActive(idx)}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', background: on ? WA.hoverRow : 'transparent', borderBottom: `1px solid ${WA.border}`, cursor: 'pointer' }}>
                      <div onClick={() => pick(x)} title={x.text} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Thumb x={x} size={34} WA={WA}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: WA.bodyText }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(x, tplLang)}</span>
                            {sentIds.has(x.id) && <span style={{ fontSize: 10.5, fontWeight: 600, color: WA.green, border: `1px solid ${WA.green}55`, borderRadius: 999, padding: '0 6px', flex: 'none' }}>{t.sent}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: WA.subText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{x.text.replace(/\n+/g, ' · ')}</div>
                        </div>
                      </div>
                      {onEdit && <button type="button" title={t.editTip} aria-label={`${t.edit}: ${titleOf(x, tplLang)}`} onClick={() => { setOpen(false); onEdit(x, null, tplLang, false) }}
                        style={{ flex: 'none', visibility: on ? 'visible' : 'hidden', border: `1px solid ${WA.border}`, background: 'transparent', color: WA.bodyText, borderRadius: 7, padding: '4px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0 }}>✏️</button>}
                      <button type="button" title={t.sendTip} onClick={() => send(x)} disabled={!!busy} style={sendBtn(WA, { padding: '5px 10px', fontSize: 12, opacity: on ? 1 : .8 })}>{busy === x.id ? t.sending : t.send}</button>
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
