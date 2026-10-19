// The Lead Center's conversation with one lead, in the chats tab's WhatsApp look (src/waShared.jsx): the real WhatsApp
// history of the lead's number (POST /api/meta/chat-history, conditional, re-read every 8 s while visible) merged with the
// Lead Center's own log (meta_messages), the template library as "⚡ תבניות ▾" (src/ChatTemplatePicker.jsx — put in the box
// or send as is, edit a template in place with src/TemplateQuickEdit.jsx), a welcome picker while nothing was sent yet (the
// welcome templates rendered for this lead, editable before sending) and a composer. Sends go through the parent
// (POST /api/meta/messages or /api/meta/lead-welcome), so the Lead Center keeps marking who got a message.
import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react'
import { WAText } from './waFormat.jsx'
import { DARK, LIGHT, DOODLE_DARK, DOODLE_LIGHT, normalizeGreenMsg, TickMark } from './waShared.jsx'
import { ChatTemplateMenu } from './ChatTemplatePicker.jsx'
import TemplateQuickEdit from './TemplateQuickEdit.jsx'
import { mergeConversation, welcomeChoices, sendErrorText } from './lib/leadConversation.js'

const ADMIN_TOKEN = 'AFIKhanahal2026'
const AUTH = { Authorization: `Bearer ${ADMIN_TOKEN}` }
const intl = raw => { const d = String(raw || '').replace(/\D/g, ''); return !d ? '' : d.startsWith('972') ? d : d.startsWith('0') ? '972' + d.slice(1) : d }

const TR = {
  he: {
    title: 'שיחת וואטסאפ', from: n => `מהוואטסאפ של המשרד${n ? ` · ${n}` : ''}`, refresh: 'רענן', openChats: 'פתח בצ׳אטים',
    loading: 'טוען את השיחה…', empty: 'עוד אין הודעות בשיחה הזו', emptySub: 'בחרו הודעת פתיחה למטה, או כתבו הודעה משלכם',
    histErr: 'לא הצלחנו לקרוא את ההיסטוריה מוואטסאפ, מוצגות ההודעות שנשלחו מכאן', retry: 'נסו שוב',
    quota: 'השליחה מהוואטסאפ של המשרד חסומה: המכסה החודשית של Green API נגמרה. אפשר לקרוא שיחות, אבל הודעות לא יוצאות עד שמשדרגים את התוכנית.', upgrade: 'לשדרוג',
    placeholder: 'כתבו הודעה…', send: 'שלח', sending: 'שולח…', noPhone: 'לליד הזה אין מספר טלפון, אי אפשר לשלוח הודעה',
    welcomeTitle: 'הודעת פתיחה', welcomeSub: 'בחרו נוסח מהתבניות, אפשר לערוך לפני השליחה', welcomeSend: 'שלח הודעת פתיחה', auto: 'בשימוש באוטומציה',
    maximize: 'הגדל את השיחה למסך מלא', restore: 'חזרה לתצוגה הרגילה (Esc)', edited: 'נערך', reset: 'חזרה לנוסח', you: 'אתם', failed: 'לא נשלח', enterHint: 'Enter לשליחה · Shift+Enter לשורה חדשה',
  },
  en: {
    title: 'WhatsApp conversation', from: n => `From the office WhatsApp${n ? ` · ${n}` : ''}`, refresh: 'Refresh', openChats: 'Open in chats',
    loading: 'Loading the conversation…', empty: 'No messages in this conversation yet', emptySub: 'Pick a welcome message below, or write your own',
    histErr: 'Couldn\'t read the WhatsApp history, showing the messages sent from here', retry: 'Try again',
    quota: 'Sending from the office WhatsApp is blocked: the Green API monthly quota is used up. Conversations can be read, but nothing goes out until the plan is upgraded.', upgrade: 'Upgrade',
    placeholder: 'Write a message…', send: 'Send', sending: 'Sending…', noPhone: 'This lead has no phone number, nothing can be sent',
    welcomeTitle: 'Welcome message', welcomeSub: 'Pick a wording from the templates, edit it before sending if you like', welcomeSend: 'Send the welcome', auto: 'Used by the automation',
    maximize: 'Expand the conversation', restore: 'Back to the normal view (Esc)', edited: 'Edited', reset: 'Back to the wording', you: 'You', failed: 'Not sent', enterHint: 'Enter to send · Shift+Enter for a new line',
  },
}

// One read of the line's state per minute, shared by every lead opened in that time
let statusCache = { at: 0, data: null, p: null }
function useLineStatus() {
  const [st, setSt] = useState(statusCache.data)
  useEffect(() => {
    if (statusCache.data && Date.now() - statusCache.at < 60000) { setSt(statusCache.data); return }
    statusCache.p = statusCache.p || fetch('/api/meta/chat-status', { headers: AUTH, signal: AbortSignal.timeout(12000) })
      .then(r => r.json()).catch(() => ({ state: 'error' }))
      .then(d => { statusCache = { at: Date.now(), data: d, p: null }; return d })
    let live = true
    statusCache.p.then(d => { if (live) setSt(d) })
    return () => { live = false }
  }, [])
  return [st, d => { statusCache = { at: Date.now(), data: d, p: null }; setSt(d) }]
}

const fmtTime = ds => { try { return new Date(ds).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
function fmtDay(ds, lang) {
  const d = new Date(ds), tod = new Date(); tod.setHours(0, 0, 0, 0)
  const dm = new Date(d); dm.setHours(0, 0, 0, 0)
  const diff = Math.round((tod - dm) / 864e5)
  if (diff === 0) return lang === 'en' ? 'Today' : 'היום'
  if (diff === 1) return lang === 'en' ? 'Yesterday' : 'אתמול'
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function LeadConversation({ lead, tplLead, lang = 'he', isDark = true, localMsgs = [], needsWelcome = false, autoConfig = null, onAutoConfigSaved, onSend, onSendWelcome, onOpenChats, officePhone = '', compact = false, onActivity, maximized = false, onToggleMaximize }) {
  const t = TR[lang] || TR.he
  const WA = isDark ? DARK : LIGHT
  const phone = intl(lead?.phone)
  const [line, setLine] = useLineStatus()
  const quota = line?.quota?.blocked
  const [green, setGreen] = useState([])
  const [histState, setHistState] = useState('loading')   // loading | ok | error
  const [pending, setPending] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cfgLocal, setCfgLocal] = useState(null)
  const [editTpl, setEditTpl] = useState(null)
  const cfg = cfgLocal || autoConfig
  useEffect(() => { setCfgLocal(null) }, [autoConfig])
  const scrollRef = useRef(null), inputRef = useRef(null), etagRef = useRef({}), nearBottom = useRef(true)

  // ── the WhatsApp history (conditional: an unchanged chat answers an empty 304) ──
  const load = useCallback(async (quiet = false) => {
    if (!phone) { setHistState('ok'); return }
    if (!quiet) setHistState(s => (s === 'ok' ? s : 'loading'))
    try {
      const prev = etagRef.current[phone]
      const r = await fetch('/api/meta/chat-history', { method: 'POST', headers: { 'Content-Type': 'application/json', ...AUTH, ...(prev ? { 'If-None-Match': prev.etag } : {}) }, body: JSON.stringify({ phone, count: 100 }), signal: AbortSignal.timeout(20000) })
      if (r.status === 304 && prev) { setGreen(prev.list); setHistState('ok'); return }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      const list = (Array.isArray(data) ? data : []).map(normalizeGreenMsg).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      const etag = r.headers.get('etag')
      if (etag) etagRef.current[phone] = { etag, list }
      setGreen(list); setHistState('ok')
    } catch { setHistState(s => (s === 'ok' && quiet ? s : 'error')) }
  }, [phone])
  useEffect(() => {
    setGreen([]); setPending([]); setError(''); setInput(''); setHistState('loading'); nearBottom.current = true
    load()
    const iv = setInterval(() => { if (!document.hidden) load(true) }, 8000)
    return () => clearInterval(iv)
  }, [load])

  const msgs = useMemo(() => mergeConversation(green, localMsgs, pending), [green, localMsgs, pending])
  const hasOut = msgs.some(m => m.direction === 'out' && !String(m.id).startsWith('opt-'))
  const showWelcome = !!phone && needsWelcome && !hasOut
  // tell the Lead Center what the chat shows (our first message, wherever it was sent from)
  const firstOutAt = msgs.find(m => m.direction === 'out' && !String(m.id).startsWith('opt-'))?.created_at || null
  const onActivityRef = useRef(onActivity)
  useEffect(() => { onActivityRef.current = onActivity }, [onActivity])
  useEffect(() => { if (histState === 'ok') onActivityRef.current?.({ hasOut, firstOutAt }) }, [histState, hasOut, firstOutAt])

  // keep the newest message in view (unless the reader scrolled up)
  useLayoutEffect(() => { const el = scrollRef.current; if (el && nearBottom.current) el.scrollTop = el.scrollHeight }, [msgs.length, showWelcome, histState])
  const onScroll = () => { const el = scrollRef.current; if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }

  // ── sending ──
  const send = async (text, { welcome = null } = {}) => {
    const msg = String(text || '').trim()
    if (!msg || busy || !phone) return false
    const id = `opt-${Date.now()}`
    setBusy(true); setError(''); nearBottom.current = true
    setPending(p => [...p, { id, direction: 'out', message: msg, created_at: new Date().toISOString(), status: 'sending' }])
    const r = welcome ? await onSendWelcome?.(msg, welcome) : await onSend?.(msg)
    setBusy(false)
    if (r?.ok) {
      setPending(p => p.map(m => (m.id === id ? { ...m, status: 'sent' } : m)))
      if (line?.quota) setLine({ ...line, quota: null })   // a message went out: the plan isn't blocking any more
      setTimeout(() => load(true), 1500)
      return true
    }
    setPending(p => p.filter(m => m.id !== id))
    if (r?.quota) setLine({ ...(line || {}), quota: { blocked: true, at: new Date().toISOString() } })
    setError(sendErrorText(r || {}, lang))
    return false
  }
  const submit = async () => { const v = input; if (await send(v)) setInput('') }
  const putInBox = text => {
    setInput(text)
    setTimeout(() => { const el = inputRef.current; if (el) { el.focus(); el.setSelectionRange(text.length, text.length) } }, 30)
  }
  // the box grows with its text (up to ~6 lines)
  useLayoutEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(140, el.scrollHeight) + 'px' }, [input])

  // ── render ──
  const items = []
  let lastDay = ''
  msgs.forEach((m, i) => {
    const day = new Date(m.created_at).toDateString()
    if (day !== lastDay) {
      lastDay = day
      items.push(<div key={`d-${day}`} style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 8px' }}><span style={{ fontSize: 12, color: WA.dateSepText, background: WA.dateSepBg, borderRadius: 8, padding: '4px 14px', boxShadow: '0 1px .5px rgba(0,0,0,.18)' }}>{fmtDay(m.created_at, lang)}</span></div>)
    }
    const out = m.direction === 'out'
    const next = msgs[i + 1]
    const last = !next || next.direction !== m.direction || Math.abs(new Date(next.created_at) - new Date(m.created_at)) > 60000
    const bg = out ? WA.bubbleOut : WA.bubbleIn
    const sending = String(m.id).startsWith('opt-') && m.status === 'sending'
    items.push(
      <div key={m.id || i} style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', marginBottom: last ? 6 : 2 }}>
        <div style={{ maxWidth: 'min(78%, 520px)', minWidth: 84, padding: '6px 9px 20px', borderRadius: out ? (last ? '8px 8px 0 8px' : '8px') : (last ? '8px 8px 8px 0' : '8px'), background: bg, color: WA.bodyText, fontSize: 14, lineHeight: 1.5, boxShadow: '0 1px .5px rgba(0,0,0,.18)', position: 'relative', opacity: sending ? .7 : 1, wordBreak: 'break-word' }}>
          {m.quoted && <div style={{ borderInlineStart: `3px solid ${m.quoted.out ? WA.green : '#53BDEB'}`, background: isDark ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.05)', borderRadius: 6, padding: '4px 8px', marginBottom: 5, fontSize: 12.5, color: WA.subText }}>{m.quoted.text}</div>}
          {m.media && (m.kind === 'imageMessage' || m.kind === 'stickerMessage') && (m.media.url || m.media.thumb) && (
            <a href={m.media.url || undefined} target="_blank" rel="noreferrer" style={{ display: 'block', margin: '-2px -5px 4px' }}>
              <img src={m.media.url || m.media.thumb} alt="" loading="lazy" style={{ display: 'block', maxWidth: 260, width: '100%', borderRadius: 6 }}/>
            </a>
          )}
          {m.media?.url && m.kind === 'audioMessage' && <audio src={m.media.url} controls preload="none" style={{ display: 'block', width: 230, maxWidth: '100%', height: 34, margin: '2px 0 4px' }}/>}
          {m.media?.url && (m.kind === 'documentMessage' || m.kind === 'videoMessage') && <a href={m.media.url} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 13, color: WA.green, fontWeight: 700, marginBottom: 4 }}>{m.kind === 'videoMessage' ? '🎥' : '📄'} {m.media.name || (lang === 'en' ? 'Open' : 'פתיחה')}</a>}
          {m.location?.latitude && <a href={`https://maps.google.com/?q=${m.location.latitude},${m.location.longitude}`} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 13, color: WA.green, marginBottom: 4 }}>📍 {m.location.nameLocation || m.location.address || (lang === 'en' ? 'Location' : 'מיקום')}</a>}
          {m.message && <div style={{ unicodeBidi: 'plaintext', textAlign: 'start', whiteSpace: 'pre-wrap' }}><WAText text={m.message}/></div>}
          <div style={{ position: 'absolute', bottom: 4, insetInlineEnd: 8, display: 'flex', alignItems: 'center', gap: 3, direction: 'ltr' }}>
            <span style={{ fontSize: 10.5, color: WA.subText }}>{fmtTime(m.created_at)}</span>
            {out && <TickMark status={sending ? 'sending' : (m.status || 'sent')} WA={WA} size={13}/>}
          </div>
        </div>
      </div>
    )
  })

  return (
    <div className="lcv" dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: WA.chatBg, borderRadius: 'inherit', overflow: 'hidden' }}>
      <style>{`
        .lcv button{font-family:inherit}
        .lcv-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:8px;border:1px solid ${WA.border};background:transparent;color:${WA.bodyText};font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap}
        .lcv-btn:hover:not(:disabled){background:${WA.hoverRow}}
        .lcv-btn:disabled{opacity:.5;cursor:not-allowed}
        .lcv-btn:focus-visible,.lcv-chip:focus-visible,.lcv textarea:focus-visible{outline:2px solid ${WA.green};outline-offset:1px}
        .lcv-chip{border:1px solid ${WA.border};background:${WA.inputFieldBg};color:${WA.bodyText};border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
        .lcv-chip[aria-pressed=true]{border-color:${WA.green};background:${WA.green}22}
        .lcv-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
        .lcv-chips::-webkit-scrollbar{display:none}
      `}</style>

      {/* header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: compact ? '7px 10px' : '9px 12px', background: WA.panelBg, borderBottom: `1px solid ${WA.border}`, flexWrap: compact ? 'nowrap' : 'wrap' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill={WA.green} aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: WA.bodyText }}>{t.title}</div>
          {!compact && <div style={{ fontSize: 11.5, color: WA.subText }}>{t.from(officePhone)}</div>}
        </div>
        {phone && <ChatTemplateMenu WA={WA} lang={lang} lead={tplLead} msgs={msgs} autoConfig={cfg}
          onInsert={text => putInBox(text)} onSend={text => send(text)} onEdit={(tpl, initial, tplLang, fromChat) => setEditTpl({ tpl, initial, lang: tplLang, fromChat })}/>}
        <button type="button" className="lcv-btn" onClick={() => load()} aria-label={t.refresh} title={t.refresh}>↻</button>
        {onToggleMaximize && <button type="button" className="lcv-btn" onClick={onToggleMaximize} aria-pressed={maximized} aria-label={maximized ? t.restore : t.maximize} title={maximized ? t.restore : t.maximize}>{maximized ? '⤡' : '⤢'}</button>}
        {onOpenChats && phone && !compact && <button type="button" className="lcv-btn" onClick={onOpenChats}>{t.openChats}</button>}
      </div>

      {quota && (
        <div role="alert" style={{ flexShrink: 0, display: 'flex', gap: 10, alignItems: 'center', padding: '9px 12px', background: isDark ? '#3B2A12' : '#FFF4E0', color: isDark ? '#F5C77A' : '#8A5300', fontSize: 12.5, lineHeight: 1.5, borderBottom: `1px solid ${WA.border}` }}>
          <span aria-hidden>⚠️</span><span style={{ flex: 1 }}>{t.quota}</span>
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer" className="lcv-btn" style={{ textDecoration: 'none', color: 'inherit', borderColor: 'currentColor' }}>{t.upgrade}</a>
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '8px 14px 10px', backgroundImage: isDark ? DOODLE_DARK : DOODLE_LIGHT }}>
        {histState === 'error' && <div style={{ textAlign: 'center', margin: '8px 0' }}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 12, color: WA.subText, background: WA.dateSepBg, borderRadius: 8, padding: '5px 12px' }}>{t.histErr}<button type="button" onClick={() => load()} style={{ border: 'none', background: 'none', color: WA.green, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>{t.retry}</button></span></div>}
        {histState === 'loading' && !msgs.length && <div style={{ textAlign: 'center', color: WA.subText, fontSize: 13, padding: 30 }}>{t.loading}</div>}
        {histState !== 'loading' && !msgs.length && (
          <div style={{ textAlign: 'center', padding: '28px 16px 12px' }}>
            <div style={{ display: 'inline-block', background: WA.dateSepBg, borderRadius: 10, padding: '10px 16px', boxShadow: '0 1px .5px rgba(0,0,0,.18)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: WA.bodyText }}>{phone ? t.empty : t.noPhone}</div>
              {phone && needsWelcome && <div style={{ fontSize: 12, color: WA.subText, marginTop: 3 }}>{t.emptySub}</div>}
            </div>
          </div>
        )}
        {items}
        {showWelcome && <WelcomePicker key={lead?.id} WA={WA} t={t} lang={lang} lead={tplLead} cfg={cfg} busy={busy} onSend={(text, id) => send(text, { welcome: id })}/>}
      </div>

      {/* composer */}
      <div style={{ flexShrink: 0, background: WA.inputBg, borderTop: `1px solid ${WA.border}`, padding: '8px 10px' }}>
        {error && <div role="alert" style={{ fontSize: 12.5, color: '#E05252', fontWeight: 600, margin: '0 4px 6px', lineHeight: 1.5 }}>{error}</div>}
        {phone ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea ref={inputRef} value={input} rows={1} onChange={e => setInput(e.target.value)} placeholder={t.placeholder} aria-label={t.placeholder} title={t.enterHint}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !matchMedia('(hover: none)').matches) { e.preventDefault(); submit() } }}
              style={{ flex: 1, resize: 'none', boxSizing: 'border-box', minHeight: 42, maxHeight: 140, padding: '10px 14px', borderRadius: 21, border: 'none', background: WA.inputFieldBg, color: WA.bodyText, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.45, outline: 'none', unicodeBidi: 'plaintext' }}/>
            <button type="button" onClick={submit} disabled={busy || !input.trim()} aria-label={t.send} title={t.send}
              style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: WA.green, color: '#fff', cursor: busy || !input.trim() ? 'not-allowed' : 'pointer', opacity: busy || !input.trim() ? .55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {busy ? <span style={{ fontSize: 12 }}>…</span> : <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" style={{ transform: lang === 'en' ? 'none' : 'scaleX(-1)' }}><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>}
            </button>
          </div>
        ) : <div style={{ fontSize: 12.5, color: WA.subText, textAlign: 'center', padding: 6 }}>{t.noPhone}</div>}
      </div>

      {editTpl && (
        <TemplateQuickEdit WA={WA} lang={lang} lead={tplLead} tpl={editTpl.tpl} initial={editTpl.initial} initialLang={editTpl.lang} fromChat={editTpl.fromChat}
          autoConfig={cfg} onClose={() => setEditTpl(null)} onSaved={next => { setCfgLocal(next); onAutoConfigSaved?.(next) }}/>
      )}
    </div>
  )
}

// While nothing was sent yet: the welcome wordings (the automation's first), rendered for this lead, editable
function WelcomePicker({ WA, t, lang, lead, cfg, busy, onSend }) {
  const [tplLang, setTplLang] = useState(() => (String(lead?.crm_data?.origin?.lang || '').startsWith('en') ? 'en' : 'he'))
  const choices = useMemo(() => welcomeChoices(cfg, lead, tplLang), [cfg, lead, tplLang])
  const [sel, setSel] = useState(() => choices[0]?.id || '')
  const [edits, setEdits] = useState({})
  const cur = choices.find(c => c.id === sel) || choices[0]
  const key = cur ? `${cur.id}:${tplLang}` : ''
  const text = cur ? (edits[key] ?? cur.text) : ''
  const areaRef = useRef(null)
  useLayoutEffect(() => { const el = areaRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(220, el.scrollHeight + 2) + 'px' }, [text])
  if (!cur) return null
  return (
    <div style={{ margin: '14px auto 4px', maxWidth: 560, background: WA.panelBg, border: `1px solid ${WA.green}55`, borderRadius: 12, padding: 12, boxShadow: '0 2px 10px rgba(0,0,0,.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: WA.bodyText }}>{t.welcomeTitle}</div>
          <div style={{ fontSize: 12, color: WA.subText }}>{t.welcomeSub}</div>
        </div>
        <div className="lcv-chips" role="group" aria-label="language">
          {['he', 'en'].map(l => <button key={l} type="button" className="lcv-chip" aria-pressed={tplLang === l} onClick={() => setTplLang(l)} style={{ padding: '4px 10px' }}>{l === 'he' ? 'עברית' : 'English'}</button>)}
        </div>
      </div>
      <div className="lcv-chips" role="radiogroup" aria-label={t.welcomeTitle} style={{ marginBottom: 8 }}>
        {choices.map(c => (
          <button key={c.id} type="button" role="radio" aria-checked={c.id === cur.id} aria-pressed={c.id === cur.id} className="lcv-chip" onClick={() => setSel(c.id)} title={c.text}>
            {c.title}{c.isDefault && <span style={{ fontSize: 10.5, color: WA.green, fontWeight: 700 }}>· {t.auto}</span>}
            {edits[`${c.id}:${tplLang}`] != null && <span style={{ fontSize: 10.5, color: WA.subText }}>· {t.edited}</span>}
          </button>
        ))}
      </div>
      <textarea ref={areaRef} value={text} onChange={e => setEdits(x => ({ ...x, [key]: e.target.value }))} dir={tplLang === 'en' ? 'ltr' : 'rtl'} aria-label={t.welcomeTitle}
        style={{ width: '100%', boxSizing: 'border-box', resize: 'none', minHeight: 80, padding: '10px 12px', borderRadius: 10, border: `1px solid ${WA.border}`, background: WA.bubbleOut, color: WA.bodyText, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.55, outline: 'none' }}/>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onSend(text, cur.id)} disabled={busy || !text.trim()}
          style={{ flex: '1 1 200px', height: 40, borderRadius: 10, border: 'none', background: WA.green, color: '#fff', fontSize: 14, fontWeight: 700, cursor: busy || !text.trim() ? 'not-allowed' : 'pointer', opacity: busy || !text.trim() ? .6 : 1 }}>
          {busy ? t.sending : t.welcomeSend}
        </button>
        {edits[key] != null && <button type="button" className="lcv-btn" onClick={() => setEdits(x => { const n = { ...x }; delete n[key]; return n })}>{t.reset}</button>}
      </div>
    </div>
  )
}
