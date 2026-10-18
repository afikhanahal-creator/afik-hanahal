// WhatsApp page → ⚡ "תבניות מוכנות": the whole template library (lib/automations-shared.js), rendered for the open chat's
// lead (name in Hebrew, the campaign's short name, what the lead told us — lib/lead-needs.js), with a "recommended now"
// row (the most personal template + the lead's stage), categories, search, a Hebrew / English switch, a full preview that
// can be edited, and two actions per template: send now (the panel stays open, so several can go out one after another)
// or put it in the message box. Templates already sent in this chat are marked.
import { useState, useMemo, useEffect } from 'react'
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
