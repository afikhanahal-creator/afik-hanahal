// WhatsApp page → edit a template right where it is used (the "תבניות" dropdown, the ⚡ panel, or "save in place of the
// template" after changing an inserted message). The text keeps its placeholders ({name}, {property}…) so it stays right
// for every lead; the preview shows it for the lead of the open chat. Saving replaces the template everywhere it is used
// (chat, automations, bulk sends) — the same config the templates tab writes (app_settings.automations → templates).
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { renderTemplate, VARIABLES, unknownPlaceholders } from '../lib/automations-shared.js'
import { withTemplate, withoutOverride, newTemplateId } from '../lib/template-edit.js'
import { autoApi } from './AutomationsApi.jsx'
import TemplateImageField from './TemplateImageField.jsx'
import { imageThumb } from './lib/templateImage.js'

const TR = {
  he: {
    title: 'עריכת תבנית', fromChat: 'הנוסח מהתיבה הוכנס לתבנית. השם, הפרויקט ושאר הפרטים של הליד חזרו להיות משתנים, כדי שהתבנית תתאים לכל ליד.',
    name: 'שם התבנית', text: 'נוסח ההודעה', vars: 'הוספת משתנה:', preview: 'כך זה ייראה אצל', previewLead: 'הליד הזה', cond: 'חלק בתוך [[ ]] יופיע רק כשיש ללייד את הנתון.',
    save: 'שמור במקום התבנית', saveNew: 'שמור כתבנית חדשה', restore: 'שחזר לנוסח המקורי', cancel: 'ביטול', saving: 'שומר…', saved: 'נשמר ✓',
    everywhere: 'השינוי יחול בכל מקום שהתבנית משמשת: בצ׳אט, באוטומציות ובשליחות קבוצתיות.', unknown: x => `{${x}} אינו משתנה מוכר ויישלח כמו שהוא`, empty: 'הנוסח ריק', err: 'השמירה נכשלה',
  },
  en: {
    title: 'Edit template', fromChat: 'The wording from the message box went into the template. The lead\'s name, project and other details became variables again, so the template fits every lead.',
    name: 'Template name', text: 'Message text', vars: 'Insert a variable:', preview: 'How it looks for', previewLead: 'this lead', cond: 'A part inside [[ ]] shows only when the lead has that detail.',
    save: 'Save in place of the template', saveNew: 'Save as a new template', restore: 'Restore the original wording', cancel: 'Cancel', saving: 'Saving…', saved: 'Saved ✓',
    everywhere: 'The change applies everywhere the template is used: chat, automations and bulk sends.', unknown: x => `{${x}} is not a known variable and will be sent as typed`, empty: 'The text is empty', err: 'Saving failed',
  },
}
const QUICK_VARS = ['name', 'property', 'when', 'where', 'greeting', 'needs', 'budget', 'phone', 'agent']

export default function TemplateQuickEdit({ WA, lang = 'he', lead, tpl, initial = null, fromChat = false, initialLang, autoConfig, onSaved, onClose }) {
  const t = TR[lang] || TR.he
  const [tab, setTab] = useState(initialLang || (lang === 'en' ? 'en' : 'he'))
  const [text, setText] = useState({ he: initial?.he ?? tpl.he ?? '', en: initial?.en ?? tpl.en ?? '' })
  const [title, setTitle] = useState({ he: tpl.he_title || '', en: tpl.en_title || '' })
  const [image, setImage] = useState(tpl.image || '')
  const [state, setState] = useState({ phase: 'idle' })
  const areaRef = useRef(null)
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose?.() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  useEffect(() => { areaRef.current?.focus() }, [tab])

  const cfg = autoConfig || undefined
  const draft = { ...tpl, he: text.he, en: text.en }
  const preview = renderTemplate(draft, lead || {}, cfg, tab)
  const unknown = unknownPlaceholders(text[tab])
  const overridden = !!(tpl.builtIn && cfg?.templates?.[tpl.id])
  const insertVar = key => {
    const el = areaRef.current, cur = text[tab]
    const at = el ? el.selectionStart : cur.length, end = el ? el.selectionEnd : cur.length
    const next = `${cur.slice(0, at)}{${key}}${cur.slice(end)}`
    setText(s => ({ ...s, [tab]: next }))
    setTimeout(() => { if (el) { el.focus(); el.setSelectionRange(at + key.length + 2, at + key.length + 2) } }, 0)
  }

  const persist = async (mode) => {
    if (mode !== 'restore' && !text.he.trim() && !text.en.trim() && !image) { setState({ phase: 'error', msg: t.empty }); return }
    setState({ phase: 'saving', mode })
    try {
      // the freshest saved config, so a change made meanwhile in the automations tab is not overwritten
      const fresh = await autoApi.get('auto-config').then(d => d.config).catch(() => cfg) || cfg || {}
      let next, id = tpl.id
      if (mode === 'restore') next = withoutOverride(fresh, tpl.id)
      else if (mode === 'new') { id = newTemplateId(); next = withTemplate(fresh, tpl, { id, he: text.he, en: text.en, he_title: `${title.he || tpl.he_title || ''} (עותק)`, en_title: `${title.en || tpl.en_title || ''} (copy)`, image }) }
      else next = withTemplate(fresh, tpl, { he: text.he, en: text.en, he_title: title.he || tpl.he_title, en_title: title.en || tpl.en_title, image })
      await autoApi.post('auto-config', { config: next })
      setState({ phase: 'saved' })
      onSaved?.(next, id)
      setTimeout(() => onClose?.(), 700)
    } catch (e) { setState({ phase: 'error', msg: `${t.err}: ${e.message}` }) }
  }

  const tabBtn = on => ({ border: 'none', borderBottom: `2px solid ${on ? WA.green : 'transparent'}`, background: 'transparent', color: on ? WA.bodyText : WA.subText, padding: '6px 10px', fontSize: 13, fontWeight: on ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0 })
  const btn = (primary, extra = {}) => ({ border: primary ? 'none' : `1px solid ${WA.border}`, background: primary ? WA.green : 'transparent', color: primary ? '#fff' : WA.bodyText, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0, ...extra })
  const input = { width: '100%', boxSizing: 'border-box', background: WA.inputFieldBg, color: WA.bodyText, border: `1px solid ${WA.border}`, borderRadius: 8, padding: '8px 11px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }
  const busy = state.phase === 'saving'

  return createPortal(
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={t.title} dir={lang === 'en' ? 'ltr' : 'rtl'}
        style={{ width: 'min(860px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', background: WA.panelBg, color: WA.bodyText, borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${WA.border}` }}>
          <b style={{ fontSize: 15 }}>✏️ {t.title}</b>
          <span style={{ fontSize: 13, color: WA.subText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{lang === 'en' ? (tpl.en_title || tpl.he_title) : tpl.he_title}</span>
          <button type="button" onClick={onClose} aria-label={t.cancel} style={{ marginInlineStart: 'auto', background: 'none', border: 'none', color: WA.subText, fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4, minHeight: 0 }}>×</button>
        </div>
        {fromChat && <div style={{ margin: '12px 18px 0', fontSize: 12.5, lineHeight: 1.6, color: WA.bodyText, background: WA.green + '14', border: `1px solid ${WA.green}40`, borderRadius: 8, padding: '8px 12px' }}>{t.fromChat}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, padding: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${WA.border}` }}>
              {['he', 'en'].map(l => <button key={l} type="button" style={tabBtn(tab === l)} onClick={() => setTab(l)}>{l === 'he' ? 'עברית' : 'English'}</button>)}
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: WA.subText }}>{t.name}
              <input value={title[tab]} onChange={e => setTitle(s => ({ ...s, [tab]: e.target.value }))} dir={tab === 'en' ? 'ltr' : 'rtl'} style={input}/>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600, color: WA.subText }}>{t.text}
              <textarea ref={areaRef} value={text[tab]} onChange={e => setText(s => ({ ...s, [tab]: e.target.value }))} dir={tab === 'en' ? 'ltr' : 'rtl'}
                rows={Math.min(14, Math.max(6, text[tab].split('\n').length + 2))} style={{ ...input, resize: 'vertical', lineHeight: 1.6, fontSize: 14 }}/>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12, color: WA.subText }}>
              <span>{t.vars}</span>
              {QUICK_VARS.map(k => { const v = VARIABLES.find(x => x.key === k); return v && <button key={k} type="button" onClick={() => insertVar(k)} title={`{${k}}`} style={{ border: `1px solid ${WA.border}`, background: WA.inputBg, color: WA.bodyText, borderRadius: 999, padding: '3px 9px', fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0 }}>{lang === 'en' ? v.en : v.he}</button> })}
            </div>
            <TemplateImageField value={image} onChange={setImage} lang={lang} compact pal={{ text: WA.bodyText, sub: WA.subText, line: WA.border, bg: WA.inputBg, accent: WA.green }}/>
            {/\[\[/.test(text[tab]) && <div style={{ fontSize: 11.5, color: WA.subText }}>{t.cond}</div>}
            {unknown.map(x => <div key={x} style={{ fontSize: 12, color: '#B45309' }}>⚠ {t.unknown(x)}</div>)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: WA.subText }}>{t.preview} {lead?.name || t.previewLead}</div>
            <div style={{ background: WA.chatBg || WA.inputBg, borderRadius: 12, padding: 14, flex: 1, minHeight: 160 }}>
              <div dir="auto" style={{ background: WA.bubbleOut || '#D9FDD3', color: WA.bodyText, borderRadius: 10, padding: image ? '3px 3px 9px' : '9px 12px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxWidth: image ? '80%' : '92%', marginInlineStart: 'auto', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
                {image && <img src={imageThumb(image, 520).replace('&h=520&fit=cover', '')} alt="" style={{ display: 'block', width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8, marginBottom: preview ? 6 : 0 }}/>}
                {preview ? <span style={image ? { display: 'block', padding: '0 9px' } : undefined}>{preview}</span> : !image && '—'}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '12px 18px 16px', borderTop: `1px solid ${WA.border}` }}>
          <button type="button" style={btn(true)} disabled={busy} onClick={() => persist('replace')}>{busy && state.mode === 'replace' ? t.saving : t.save}</button>
          <button type="button" style={btn(false)} disabled={busy} onClick={() => persist('new')}>{busy && state.mode === 'new' ? t.saving : t.saveNew}</button>
          {overridden && <button type="button" style={btn(false, { border: 'none', color: WA.subText })} disabled={busy} onClick={() => persist('restore')}>{t.restore}</button>}
          <button type="button" style={btn(false, { border: 'none', color: WA.subText })} onClick={onClose}>{t.cancel}</button>
          <span style={{ marginInlineStart: 'auto', fontSize: 12, color: state.phase === 'error' ? '#DC2626' : state.phase === 'saved' ? WA.green : WA.subText }}>
            {state.phase === 'error' ? state.msg : state.phase === 'saved' ? t.saved : t.everywhere}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
