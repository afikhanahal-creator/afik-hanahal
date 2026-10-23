// WhatsApp page → the template library (lib/automations-shared.js), rendered for the open chat's lead (name in Hebrew, the
// campaign's short name, what the lead told us — lib/lead-needs.js). Three ways in, all built for one-click sending:
//  · ChatQuickChips — "הצעות" over the empty message box: the 3–4 messages that fit this lead now; a click puts one in the
//    box, the round send button sends it as is;
//  · ChatTemplateMenu — the header's "תבניות ▾" dropdown: search, recommended, every category; "שלח" on the active row;
//  · ChatTemplatePicker — the templates window over the composer: categories · the list · a WhatsApp preview of the selected
//    message (editable, its picture can be left out) with "שלח עכשיו" and "הכנס לתיבה". It opens on the best message for the
//    lead, ↑ / ↓ move, Enter = to the box, Ctrl+Enter = send. Narrow screens show the list, then the preview.
// A template's picture (`image`) is sent with the text as its caption: onSend(text, { image }) / onInsert(text, tpl, lang).
// Templates already sent in this chat are marked. Icons are line icons (src/uiIcons.jsx), never emoji.
import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import { templateList, renderTemplate, templateImage, CATEGORIES, leadLang } from '../lib/automations-shared.js'
import { bestPersonalTemplateId } from '../lib/lead-needs.js'
import { untemplate } from '../lib/template-edit.js'
import { imageThumb } from './lib/templateImage.js'
import { Icon, CatTile } from './uiIcons.jsx'

const TR = {
  he: {
    title: 'תבניות', search: 'חיפוש לפי שם או מילה בהודעה', all: 'הכול', rec: 'מומלצות ללייד', send: 'שלח עכשיו', sending: 'שולח…', insert: 'הכנס לתיבה',
    edit: 'עריכת התבנית', editTip: 'שינוי הנוסח של התבנית עצמה, לכל הלידים', sent: 'נשלח', sentNow: 'נשלח', reset: 'שחזור הנוסח', none: 'לא נמצאו תבניות',
    close: 'סגירה', back: 'חזרה לרשימה', preview: 'תצוגה מקדימה', for: n => (n ? `כך ${n} יקבלו את ההודעה` : 'כך הליד יקבל את ההודעה'),
    keys: 'Enter הכנסה לתיבה · Ctrl+Enter שליחה', count: n => `${n} תבניות`, noImg: 'בלי התמונה', withImg: 'עם התמונה', editable: 'אפשר לערוך את הטקסט כאן לפני השליחה',
    he: 'עב', en: 'EN', langLabel: 'שפת ההודעה',
  },
  en: {
    title: 'Templates', search: 'Search by name or a word in the message', all: 'All', rec: 'Recommended', send: 'Send now', sending: 'Sending…', insert: 'Put in the box',
    edit: 'Edit the template', editTip: 'Change the template itself, for every lead', sent: 'Sent', sentNow: 'Sent', reset: 'Restore wording', none: 'No templates found',
    close: 'Close', back: 'Back to the list', preview: 'Preview', for: n => (n ? `What ${n} will receive` : 'What the lead will receive'),
    keys: 'Enter to the box · Ctrl+Enter send', count: n => `${n} templates`, noImg: 'Without the picture', withImg: 'With the picture', editable: 'You can edit the text here before sending',
    he: 'עב', en: 'EN', langLabel: 'Message language',
  },
}
// the lead's stage → the category that fits it now
const STAGE_CAT = { new: 'welcome', contacted: 'followup', discovery: 'progress', meeting: 'progress', negotiating: 'progress', won: 'deal', lost: 'closing', irrelevant: 'closing', nurture: 'closing' }
const norm = s => String(s || '').replace(/\s+/g, ' ').trim()
// a line that identifies a sent template: the longest line that isn't the greeting or the signature
const signature = text => norm(text.split('\n').filter(l => !/^(שלום|hello|hi)\b/i.test(l.trim())).sort((a, b) => b.length - a.length)[0] || '').slice(0, 36)
const titleOf = (x, l) => (l === 'en' ? (x.en_title || x.he_title) : (x.he_title || x.en_title)) || ''
const catOf = id => CATEGORIES.find(c => c.id === id)
const firstName = lead => String(lead?.name || '').trim().split(/\s+/)[0] || ''

// The library rendered for one lead + what was already sent + what fits now (shared by the window, the menu and the chips)
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

// ── shared look: CSS variables from the WhatsApp palette, classes for hover / focus / selected states ──
const vars = WA => ({ '--ctp-green': WA.green, '--ctp-line': WA.border, '--ctp-sub': WA.subText, '--ctp-text': WA.bodyText, '--ctp-hover': WA.hoverRow, '--ctp-field': WA.inputFieldBg, '--ctp-panel': WA.panelBg, '--ctp-soft': WA.inputBg, '--ctp-chat': WA.chatBg, '--ctp-bubble': WA.bubbleOut })
const CSS = `
.ctp{color:var(--ctp-text);font-size:13px}
.ctp *{box-sizing:border-box}
.ctp-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;min-height:0;min-width:0;transition:background .15s ease,border-color .15s ease,color .15s ease,box-shadow .15s ease}
.ctp-btn:focus-visible,.ctp-ib:focus-visible,.ctp-chip button:focus-visible,.ctp-nav button:focus-visible,.ctp-seg button:focus-visible{outline:2px solid var(--ctp-green);outline-offset:2px}
.ctp-btn.pri{background:var(--ctp-green);color:#fff;border:1px solid transparent;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.ctp-btn.pri:hover:not(:disabled){background:#019574}
.ctp-btn.sec{background:var(--ctp-panel);color:var(--ctp-text);border:1px solid var(--ctp-line)}
.ctp-btn.sec:hover:not(:disabled){border-color:var(--ctp-green);color:var(--ctp-green)}
.ctp-btn.ghost{background:transparent;color:var(--ctp-sub);border:1px solid transparent;padding:0 10px}
.ctp-btn.ghost:hover:not(:disabled){color:var(--ctp-text);background:var(--ctp-hover)}
.ctp-btn.sm{height:30px;padding:0 11px;font-size:12.5px;border-radius:8px}
.ctp-btn:disabled{opacity:.5;cursor:default}
.ctp-ib{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9px;border:none;background:transparent;color:var(--ctp-sub);cursor:pointer;min-height:0;min-width:0;padding:0;flex:none}
.ctp-ib:hover{background:var(--ctp-hover);color:var(--ctp-text)}
.ctp-search{display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border-radius:10px;background:var(--ctp-field);border:1px solid var(--ctp-line);color:var(--ctp-sub);flex:1;min-width:0;transition:border-color .15s ease,box-shadow .15s ease}
.ctp-search:focus-within{border-color:var(--ctp-green);box-shadow:0 0 0 3px rgba(0,168,132,.14)}
.ctp-search input:focus,.ctp-search input:focus-visible,.ctp-bubble textarea:focus,.ctp-bubble textarea:focus-visible{outline:none!important;box-shadow:none!important}
.ctp-search input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--ctp-text);font:inherit;font-size:13.5px;height:100%;padding:0;min-height:0}
.ctp-seg{display:inline-flex;padding:2px;border-radius:9px;background:var(--ctp-soft);border:1px solid var(--ctp-line);flex:none}
.ctp-seg button{height:28px;min-width:38px;padding:0 9px;border:none;border-radius:7px;background:transparent;color:var(--ctp-sub);font:inherit;font-size:12px;font-weight:600;cursor:pointer;min-height:0}
.ctp-seg button[aria-pressed=true]{background:var(--ctp-panel);color:var(--ctp-text);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.ctp-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:0 14px 10px}
.ctp-chips::-webkit-scrollbar{display:none}
.ctp-chips button{flex:none;height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--ctp-line);background:transparent;color:var(--ctp-sub);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;min-height:0;display:inline-flex;align-items:center;gap:6px}
.ctp-chips button[aria-pressed=true]{border-color:var(--ctp-green);background:rgba(0,168,132,.10);color:var(--ctp-text);font-weight:600}
.ctp-nav{display:flex;flex-direction:column;gap:2px;padding:10px 8px;overflow-y:auto;border-inline-end:1px solid var(--ctp-line)}
.ctp-nav button{display:flex;align-items:center;gap:9px;height:36px;padding:0 9px;border:none;border-radius:9px;background:transparent;color:var(--ctp-text);font:inherit;font-size:13px;cursor:pointer;text-align:start;min-height:0}
.ctp-nav button:hover{background:var(--ctp-hover)}
.ctp-nav button[aria-pressed=true]{background:rgba(0,168,132,.11);font-weight:600}
.ctp-nav .n{margin-inline-start:auto;font-size:11.5px;color:var(--ctp-sub);font-variant-numeric:tabular-nums}
.ctp-list{overflow-y:auto;min-height:0}
.ctp-sec{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:6px;padding:8px 14px 6px;font-size:11.5px;font-weight:700;color:var(--ctp-sub);background:var(--ctp-panel);letter-spacing:.01em}
.ctp-row{position:relative;display:flex;align-items:center;gap:11px;padding:9px 14px;cursor:pointer;border-radius:0}
.ctp-row:hover{background:var(--ctp-hover)}
.ctp-row[aria-selected=true]{background:rgba(0,168,132,.10)}
.ctp-row[aria-selected=true]::before{content:'';position:absolute;inset-block:8px;inset-inline-start:0;width:3px;border-radius:0 3px 3px 0;background:var(--ctp-green)}
.ctp-row .t{display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600;min-width:0}
.ctp-row .t span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ctp-row .p{font-size:12.5px;color:var(--ctp-sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
.ctp-badge{flex:none;display:inline-flex;align-items:center;gap:3px;height:18px;padding:0 7px;border-radius:999px;font-size:10.5px;font-weight:700;color:var(--ctp-green);background:rgba(0,168,132,.12)}
.ctp-thumb{flex:none;border-radius:9px;object-fit:cover;background:var(--ctp-soft)}
.ctp-pv{display:flex;flex-direction:column;min-height:0;border-inline-start:1px solid var(--ctp-line);background:var(--ctp-soft)}
.ctp-chat{flex:1;min-height:0;overflow-y:auto;padding:18px 18px 14px;background:var(--ctp-chat);display:flex;flex-direction:column}
.ctp-bubble:focus-within{box-shadow:0 0 0 2px rgba(0,168,132,.45)}
.ctp-bubble{align-self:flex-end;max-width:min(420px,92%);background:var(--ctp-bubble);border-radius:12px 12px 12px 3px;box-shadow:0 1px .5px rgba(11,20,26,.13);padding:4px}
[dir=ltr] .ctp-bubble{border-radius:12px 12px 3px 12px}
.ctp-bubble img{display:block;width:100%;max-height:150px;object-fit:cover;border-radius:9px}
.ctp-bubble textarea{display:block;width:100%;border:none;outline:none;resize:none;background:transparent;color:var(--ctp-text);font:inherit;font-size:14.2px;line-height:1.5;padding:6px 8px 4px;min-height:0;overflow:hidden}
.ctp-imgbar{display:flex;align-items:center;gap:6px;padding:6px 8px 2px;font-size:11.5px;color:var(--ctp-sub)}
.ctp-acts{display:flex;flex-direction:column;gap:8px;padding:12px 14px 14px;border-top:1px solid var(--ctp-line);background:var(--ctp-panel)}
.ctp-chipsrow{display:flex;align-items:center;gap:8px;padding:8px 12px;overflow-x:auto;scrollbar-width:none}
.ctp-chipsrow::-webkit-scrollbar{display:none}
.ctp-chip{flex:none;display:inline-flex;align-items:center;gap:2px;height:34px;padding:0 3px;padding-inline-start:4px;border-radius:999px;border:1px solid var(--ctp-line);background:var(--ctp-field);max-width:280px;transition:border-color .15s ease,box-shadow .15s ease}
.ctp-chip:hover{border-color:rgba(0,168,132,.55);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.ctp-chip .pick{display:inline-flex;align-items:center;gap:7px;height:100%;padding:0 8px 0 4px;border:none;background:transparent;color:var(--ctp-text);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;min-width:0;min-height:0}
.ctp-chip .pick span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ctp-chip .go{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;border:none;background:var(--ctp-green);color:#fff;cursor:pointer;flex:none;min-height:0;min-width:0;padding:0}
.ctp-chip .go:hover{background:#019574}
.ctp-mrow{display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer}
.ctp-mrow[aria-selected=true]{background:var(--ctp-hover)}
.ctp-mrow .acts{display:flex;gap:4px;align-items:center;opacity:0;transition:opacity .12s ease}
.ctp-mrow[aria-selected=true] .acts,.ctp-mrow:hover .acts{opacity:1}
@media (hover:none){.ctp-mrow .acts{opacity:1}}
.ctp-hbtn{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:10px;border:1px solid var(--ctp-line);background:var(--ctp-panel);color:var(--ctp-text);font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;flex:none;min-height:0;transition:border-color .15s ease,color .15s ease}
.ctp-hbtn:hover,.ctp-hbtn[aria-expanded=true]{border-color:var(--ctp-green);color:var(--ctp-green)}
@media (max-width:640px){.ctp-hbtn{display:none}}
@keyframes ctpIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.ctp-in{animation:ctpIn .16s ease-out}
@media (prefers-reduced-motion:reduce){.ctp-in{animation:none}}
`
let cssDone = false
function useCtpCss() {
  useLayoutEffect(() => {
    if (cssDone || typeof document === 'undefined') return
    const el = document.createElement('style'); el.id = 'ctp-css'; el.textContent = CSS; document.head.appendChild(el); cssDone = true
  }, [])
}
function useWidth(ref) {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    setW(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width)); ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

// The picture of a row: a rounded thumbnail (through the image CDN), or the category's icon on its color
function Thumb({ x, size = 36 }) {
  if (x.image) return <img className="ctp-thumb" src={imageThumb(x.image, size * 2)} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size }}/>
  const c = catOf(x.cat)
  return <CatTile cat={x.cat} color={c?.color} size={size}/>
}

// ── The templates window (over the composer) ──────────────────────────────────────────────────────────────────────
export default function ChatTemplatePicker({ WA, lead, msgs = [], autoConfig, lang = 'he', onSend, onInsert, onEdit, onClose }) {
  useCtpCss()
  const t = TR[lang] || TR.he
  const rtl = lang !== 'en'
  const rootRef = useRef(null), listRef = useRef(null), areaRef = useRef(null)
  const width = useWidth(rootRef)
  const wide = width >= 860, split = width >= 600
  const [tplLang, setTplLang] = useState(() => leadLang(lead))
  const [view, setView] = useState('all')
  const [q, setQ] = useState('')
  const [selKey, setSelKey] = useState('')
  const [showPv, setShowPv] = useState(false)         // narrow screens: the preview instead of the list
  const [edits, setEdits] = useState({})               // id:lang → edited text
  const [noImg, setNoImg] = useState({})               // id → leave the picture out of this send
  const [busy, setBusy] = useState(null)
  const [justSent, setJustSent] = useState({})

  const { all, sentIds, recommended } = useTemplateData({ lead, msgs, autoConfig, tplLang })
  const ql = q.trim().toLowerCase()
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map(c => [c.id, all.filter(x => x.cat === c.id).length])), [all])
  const sections = useMemo(() => {
    if (ql) return [{ id: 'q', items: all.filter(x => `${x.he_title} ${x.en_title} ${x.text}`.toLowerCase().includes(ql)) }]
    if (view === 'rec') return [{ id: 'rec', items: recommended }]
    if (view !== 'all') return [{ id: view, items: all.filter(x => x.cat === view) }]
    return [
      { id: 'rec', label: t.rec, star: true, items: recommended },
      ...CATEGORIES.map(c => ({ id: c.id, label: lang === 'en' ? c.en : c.he, color: c.color, items: all.filter(x => x.cat === c.id) })),
    ].filter(s => s.items.length)
  }, [all, recommended, ql, view, lang, t.rec])
  const flat = useMemo(() => sections.flatMap(s => s.items.map(x => ({ x, key: `${s.id}:${x.id}` }))), [sections])
  const cur = flat.find(r => r.key === selKey) || flat[0] || null
  const sel = cur?.x || null
  useEffect(() => { if (cur && cur.key !== selKey) setSelKey(cur.key) }, [cur, selKey])
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) }, [selKey])

  const ek = x => `${x.id}:${tplLang}`
  const textOf = x => edits[ek(x)] ?? x.text
  const imgOf = x => (noImg[x.id] ? '' : x.image)
  const changed = sel && edits[ek(sel)] != null && edits[ek(sel)] !== sel.text
  useLayoutEffect(() => { const el = areaRef.current; if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` } }, [sel, edits, tplLang, width, showPv])

  const send = async x => {
    if (!x || busy || (!textOf(x).trim() && !imgOf(x))) return
    setBusy(x.id)
    const ok = await onSend?.(textOf(x), { image: imgOf(x) })
    setBusy(null)
    if (ok) setJustSent(s => ({ ...s, [x.id]: true }))
  }
  const insert = x => { if (x) onInsert?.(textOf(x), { ...x, image: imgOf(x) }, tplLang) }
  const move = d => {
    const i = Math.max(0, flat.findIndex(r => r.key === cur?.key))
    const n = flat[Math.min(flat.length - 1, Math.max(0, i + d))]; if (n) setSelKey(n.key)
  }
  const onKey = e => {
    const tag = e.target.tagName
    if (e.key === 'Escape') { e.preventDefault(); if (showPv && !split) setShowPv(false); else onClose?.(); return }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(sel); return }
    if (tag === 'TEXTAREA' || tag === 'BUTTON') return
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter') { e.preventDefault(); if (!split && !showPv) setShowPv(true); else insert(sel) }
  }
  const pickView = v => { setView(v); setQ('') }

  const views = [{ id: 'rec', label: t.rec, n: recommended.length, icon: 'star' }, { id: 'all', label: t.all, n: all.length, icon: 'file' }, ...CATEGORIES.filter(c => counts[c.id]).map(c => ({ id: c.id, label: lang === 'en' ? c.en : c.he, n: counts[c.id], cat: c }))].filter(v => v.n)

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 10px' }}>
      {split && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
        <span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', background: 'rgba(0,168,132,.12)', color: 'var(--ctp-green)' }}><Icon name="file" size={16}/></span>
        <div style={{ lineHeight: 1.2 }}><b style={{ fontSize: 14.5 }}>{t.title}</b><div style={{ fontSize: 11.5, color: 'var(--ctp-sub)' }}>{t.count(all.length)}</div></div>
      </div>}
      <label className="ctp-search"><Icon name="search" size={16}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} autoFocus/></label>
      <div className="ctp-seg" role="group" aria-label={t.langLabel}>
        {['he', 'en'].map(l => <button key={l} type="button" aria-pressed={tplLang === l} onClick={() => setTplLang(l)}>{t[l]}</button>)}
      </div>
      <button type="button" className="ctp-ib" onClick={onClose} aria-label={t.close} title={t.close}><Icon name="x" size={18}/></button>
    </div>
  )

  const list = (
    <div ref={listRef} className="ctp-list" role="listbox" aria-label={t.title}>
      {!flat.length && <div style={{ padding: 28, textAlign: 'center', color: 'var(--ctp-sub)' }}>{t.none}</div>}
      {sections.map(s => (
        <div key={s.id} role="group" aria-label={s.label || undefined}>
          {s.label && <div className="ctp-sec">{s.star ? <span style={{ color: 'var(--ctp-green)' }}><Icon name="star" size={13} sw={2}/></span> : <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }}/>}{s.label}<span style={{ fontWeight: 500 }}>· {s.items.length}</span></div>}
          {s.items.map(x => {
            const key = `${s.id}:${x.id}`, on = cur?.key === key
            const wasSent = justSent[x.id] || sentIds.has(x.id)
            return (
              <div key={key} role="option" aria-selected={on} className="ctp-row"
                onClick={() => { setSelKey(key); if (!split) setShowPv(true) }} onDoubleClick={() => insert(x)}>
                <Thumb x={x}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t"><span>{titleOf(x, tplLang)}</span>{wasSent && <span className="ctp-badge"><Icon name="check" size={11} sw={2.4}/>{t.sent}</span>}</div>
                  <div className="p">{(edits[ek(x)] ?? x.text).replace(/\n+/g, ' · ') || '—'}</div>
                </div>
                {!split && <span style={{ color: 'var(--ctp-sub)' }}><Icon name={rtl ? 'chevronLeft' : 'chevronRight'} size={16}/></span>}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )

  const preview = sel && (
    <div className="ctp-pv">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--ctp-panel)', borderBottom: '1px solid var(--ctp-line)' }}>
        {!split && <button type="button" className="ctp-ib" onClick={() => setShowPv(false)} aria-label={t.back} title={t.back}><Icon name="arrowBack" size={18} flip={!rtl}/></button>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(sel, tplLang)}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ctp-sub)' }}>{t.for(firstName(lead))}</div>
        </div>
        {(justSent[sel.id] || sentIds.has(sel.id)) && <span className="ctp-badge"><Icon name="check" size={11} sw={2.4}/>{justSent[sel.id] ? t.sentNow : t.sent}</span>}
      </div>
      <div className="ctp-chat" dir={tplLang === 'en' ? 'ltr' : 'rtl'}>
        <div className="ctp-bubble ctp-in" key={sel.id + tplLang}>
          {imgOf(sel) && <img src={imageThumb(sel.image, 640).replace('&h=640&fit=cover', '')} alt=""/>}
          <textarea ref={areaRef} value={textOf(sel)} rows={1} dir={tplLang === 'en' ? 'ltr' : 'rtl'} aria-label={t.editable} title={t.editable}
            onChange={e => setEdits(s => ({ ...s, [ek(sel)]: e.target.value }))}/>
        </div>
        {sel.image && (
          <div className="ctp-imgbar" style={{ alignSelf: 'flex-end' }}>
            <button type="button" className="ctp-btn ghost sm" onClick={() => setNoImg(s => ({ ...s, [sel.id]: !s[sel.id] }))}>
              <Icon name={noImg[sel.id] ? 'image' : 'x'} size={14}/>{noImg[sel.id] ? t.withImg : t.noImg}
            </button>
          </div>
        )}
      </div>
      <div className="ctp-acts">
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="ctp-btn pri" style={{ flex: 1.3 }} disabled={!!busy || (!textOf(sel).trim() && !imgOf(sel))} onClick={() => send(sel)}>
            {busy === sel.id ? t.sending : <><Icon name="send" size={16} flip={rtl}/>{t.send}</>}
          </button>
          <button type="button" className="ctp-btn sec" style={{ flex: 1 }} onClick={() => insert(sel)}><Icon name="insert" size={16} flip={rtl}/>{t.insert}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {onEdit && <button type="button" className="ctp-btn ghost sm" title={t.editTip} onClick={() => onEdit(sel, changed ? { [tplLang]: untemplate(textOf(sel), renderTemplate(sel, lead, autoConfig || undefined, tplLang, { keys: true })) } : null, tplLang, !!changed)}><Icon name="pencil" size={14}/>{t.edit}</button>}
          {changed && <button type="button" className="ctp-btn ghost sm" onClick={() => setEdits(s => { const n = { ...s }; delete n[ek(sel)]; return n })}><Icon name="undo" size={14}/>{t.reset}</button>}
          {split && <span style={{ marginInlineStart: 'auto', fontSize: 11.5, color: 'var(--ctp-sub)' }}>{t.keys}</span>}
        </div>
      </div>
    </div>
  )

  return (
    <div ref={rootRef} className="ctp ctp-in" dir={rtl ? 'rtl' : 'ltr'} onKeyDown={onKey}
      style={{ ...vars(WA), flexShrink: 0, height: 'min(540px, 66vh)', display: 'flex', flexDirection: 'column', background: 'var(--ctp-panel)', borderTop: '1px solid var(--ctp-line)', boxShadow: '0 -8px 24px rgba(11,20,26,.08)' }}>
      {header}
      {!wide && (
        <div className="ctp-chips" role="group" aria-label={t.title}>
          {views.map(v => <button key={v.id} type="button" aria-pressed={!ql && view === v.id} onClick={() => pickView(v.id)}>{v.icon === 'star' && <span style={{ color: 'var(--ctp-green)' }}><Icon name="star" size={13} sw={2}/></span>}{v.label} <span style={{ opacity: .7 }}>{v.n}</span></button>)}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: wide ? '196px minmax(0,1fr) minmax(320px,1.08fr)' : split ? 'minmax(0,1fr) minmax(280px,1fr)' : 'minmax(0,1fr)', borderTop: '1px solid var(--ctp-line)' }}>
        {wide && (
          <nav className="ctp-nav" aria-label={t.title}>
            {views.map(v => (
              <button key={v.id} type="button" aria-pressed={!ql && view === v.id} onClick={() => pickView(v.id)}>
                {v.cat ? <CatTile cat={v.cat.id} color={v.cat.color} size={24} radius={7}/> : <span style={{ display: 'inline-flex', width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: 'rgba(0,168,132,.12)', color: 'var(--ctp-green)' }}><Icon name={v.icon} size={13} sw={2}/></span>}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</span><span className="n">{v.n}</span>
              </button>
            ))}
          </nav>
        )}
        {split ? <>{list}{preview || <div className="ctp-pv"/>}</> : (showPv && preview ? preview : list)}
      </div>
    </div>
  )
}

// ── Over the empty message box: the messages that fit this lead now — a click puts one in the box, the arrow sends ──
const QT = {
  he: { label: 'הצעות', more: 'כל התבניות', sendTip: 'שליחה מיידית', putTip: 'להכניס לתיבה' },
  en: { label: 'Suggested', more: 'All templates', sendTip: 'Send now', putTip: 'Put in the box' },
}
export function ChatQuickChips({ WA, lead, msgs = [], autoConfig, lang = 'he', onSend, onInsert, onMore }) {
  useCtpCss()
  const t = QT[lang] || QT.he
  const rtl = lang !== 'en'
  const tplLang = leadLang(lead)
  const { recommended } = useTemplateData({ lead, msgs, autoConfig, tplLang })
  const [busy, setBusy] = useState(null)
  if (!recommended.length) return null
  return (
    <div className="ctp ctp-chipsrow" dir={rtl ? 'rtl' : 'ltr'} style={{ ...vars(WA), flexShrink: 0, background: 'var(--ctp-soft)', borderTop: '1px solid var(--ctp-line)' }}>
      <span style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--ctp-sub)' }}><Icon name="bolt" size={14}/>{t.label}</span>
      {recommended.map(x => (
        <span key={x.id} className="ctp-chip">
          <button type="button" className="pick" title={`${t.putTip}\n\n${x.text}`} onClick={() => onInsert?.(x.text, x, tplLang)}>
            {x.image ? <img className="ctp-thumb" src={imageThumb(x.image, 56)} alt="" width={26} height={26} style={{ borderRadius: '50%' }}/> : <CatTile cat={x.cat} color={catOf(x.cat)?.color} size={26} radius={13}/>}
            <span>{titleOf(x, lang)}</span>
          </button>
          <button type="button" className="go" aria-label={`${t.sendTip}: ${titleOf(x, lang)}`} title={t.sendTip} disabled={!!busy}
            onClick={async () => { setBusy(x.id); await onSend?.(x.text, { image: x.image }); setBusy(null) }}>
            {busy === x.id ? <span style={{ fontSize: 12 }}>…</span> : <Icon name="send" size={14} flip={rtl}/>}
          </button>
        </span>
      ))}
      {onMore && <button type="button" className="ctp-btn ghost sm" style={{ flex: 'none', color: 'var(--ctp-green)' }} onClick={onMore}>{t.more}<Icon name={rtl ? 'chevronLeft' : 'chevronRight'} size={14}/></button>}
    </div>
  )
}

// ── Chat header → "תבניות ▾": every template in one dropdown (recommended, personal, then each category). A click puts
// the message in the box to review and send; "שלח" sends it as is. Arrow keys + Enter work (Ctrl+Enter sends), Esc closes.
const MT = {
  he: { button: 'תבניות', search: 'חיפוש תבנית', rec: 'מומלצות ללייד', send: 'שלח', edit: 'עריכת התבנית', sending: '…', sent: 'נשלח', all: 'פתיחת חלון התבניות', none: 'לא נמצאו תבניות', hint: 'לחיצה מכניסה לתיבה · Ctrl+Enter שולח', sendTip: 'שליחה מיידית בלי עריכה', count: n => `${n} תבניות` },
  en: { button: 'Templates', search: 'Search templates', rec: 'Recommended', send: 'Send', edit: 'Edit the template', sending: '…', sent: 'Sent', all: 'Open the templates window', none: 'No templates found', hint: 'A click puts it in the box · Ctrl+Enter sends', sendTip: 'Send right away, as is', count: n => `${n} templates` },
}
export function ChatTemplateMenu({ WA, lead, msgs = [], autoConfig, lang = 'he', onSend, onInsert, onEdit, onOpenPanel }) {
  useCtpCss()
  const t = MT[lang] || MT.he
  const rtl = lang !== 'en'
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
    return [{ id: 'rec', label: t.rec, star: true, items: recommended }, ...order.map(id => { const c = catOf(id); return { id, label: c ? (lang === 'en' ? c.en : c.he) : id, color: c?.color, items: all.filter(x => x.cat === id) } })].filter(sc => sc.items.length)
  }, [all, recommended, ql, lang, t.rec])
  const flat = sections.flatMap(sc => sc.items.map(x => ({ x, key: `${sc.id}:${x.id}` })))

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect(); if (!r) return
    const w = Math.min(470, window.innerWidth - 16)
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

  let i = -1
  return (
    <>
      <button ref={btnRef} type="button" className="ctp-hbtn" style={vars(WA)} onClick={() => setOpen(v => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <Icon name="file" size={16}/>{t.button}<Icon name="chevronDown" size={14}/>
      </button>
      {open && pos && (
        <div ref={menuRef} role="dialog" aria-label={t.button} dir={rtl ? 'rtl' : 'ltr'} onKeyDown={onKey} className="ctp ctp-in"
          style={{ ...vars(WA), position: 'fixed', zIndex: 3000, left: pos.left, top: pos.top, width: pos.width, maxHeight: Math.min(pos.maxHeight, 600), display: 'flex', flexDirection: 'column', background: 'var(--ctp-panel)', border: '1px solid var(--ctp-line)', borderRadius: 14, boxShadow: '0 16px 48px rgba(11,20,26,.22)', overflow: 'hidden' }}>
          <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--ctp-line)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <label className="ctp-search" style={{ height: 36 }}><Icon name="search" size={15}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} autoFocus aria-label={t.search}/></label>
              <div className="ctp-seg" role="group" aria-label="language">
                {['he', 'en'].map(l => <button key={l} type="button" aria-pressed={tplLang === l} onClick={() => setTplLang(l)}>{l === 'he' ? 'עב' : 'EN'}</button>)}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ctp-sub)' }}>{t.count(all.length)}{typeof window !== 'undefined' && window.innerWidth > 700 ? ` · ${t.hint}` : ''}</div>
          </div>
          <div ref={listRef} role="listbox" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {!flat.length && <p style={{ textAlign: 'center', color: 'var(--ctp-sub)', fontSize: 13, padding: 22, margin: 0 }}>{t.none}</p>}
            {sections.map(sc => (
              <div key={sc.id}>
                {sc.label && <div className="ctp-sec">{sc.star ? <span style={{ color: 'var(--ctp-green)' }}><Icon name="star" size={13} sw={2}/></span> : <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.color }}/>}{sc.label}<span style={{ fontWeight: 500 }}>· {sc.items.length}</span></div>}
                {sc.items.map(x => {
                  i += 1
                  const idx = i, on = idx === active
                  return (
                    <div key={sc.id + x.id} data-i={idx} role="option" aria-selected={on} className="ctp-mrow" onMouseEnter={() => setActive(idx)}>
                      <div onClick={() => pick(x)} title={x.text} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Thumb x={x} size={32}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(x, tplLang)}</span>
                            {sentIds.has(x.id) && <span className="ctp-badge"><Icon name="check" size={10} sw={2.4}/>{t.sent}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ctp-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{x.text.replace(/\n+/g, ' · ')}</div>
                        </div>
                      </div>
                      <div className="acts">
                        {onEdit && <button type="button" className="ctp-ib" style={{ width: 30, height: 30 }} title={t.edit} aria-label={`${t.edit}: ${titleOf(x, tplLang)}`} onClick={() => { setOpen(false); onEdit(x, null, tplLang, false) }}><Icon name="pencil" size={14}/></button>}
                        <button type="button" className="ctp-btn pri sm" title={t.sendTip} onClick={() => send(x)} disabled={!!busy}>{busy === x.id ? t.sending : <><Icon name="send" size={13} flip={rtl}/>{t.send}</>}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {onOpenPanel && <button type="button" className="ctp-btn ghost" onClick={() => { setOpen(false); onOpenPanel() }}
            style={{ borderRadius: 0, borderTop: '1px solid var(--ctp-line)', height: 40, color: 'var(--ctp-green)', background: 'var(--ctp-soft)' }}>{t.all}<Icon name={rtl ? 'chevronLeft' : 'chevronRight'} size={14}/></button>}
        </div>
      )}
    </>
  )
}
