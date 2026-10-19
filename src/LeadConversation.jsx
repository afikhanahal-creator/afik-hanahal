// The Lead Center's conversation with one lead, in the chats tab's WhatsApp look (src/waShared.jsx): the real WhatsApp
// history of the lead's number (POST /api/meta/chat-history, conditional, re-read every 8 s while visible) merged with the
// Lead Center's own log (meta_messages), and a composer with the template library as one dropdown (rendered for this
// lead; welcome wordings first while nothing was sent — the box then starts with the automation's welcome and the first
// send counts as the welcome). The composer's height is dragged like an editor's panel (src/Splitter.jsx). Sends go
// through the parent (POST /api/meta/messages or /api/meta/lead-welcome), so the Lead Center keeps marking who got a message.
import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react'
import { WAText } from './waFormat.jsx'
import { DARK, LIGHT, DOODLE_DARK, DOODLE_LIGHT, normalizeGreenMsg, TickMark } from './waShared.jsx'
import TemplateQuickEdit from './TemplateQuickEdit.jsx'
import Splitter, { SPLITTER_CSS } from './Splitter.jsx'
import { CATEGORIES, getTemplate, mergeConfig, leadLang } from '../lib/automations-shared.js'
import { mergeConversation, templateOptions, sendErrorText } from './lib/leadConversation.js'

const ADMIN_TOKEN = 'AFIKhanahal2026'
const AUTH = { Authorization: `Bearer ${ADMIN_TOKEN}` }
const intl = raw => { const d = String(raw || '').replace(/\D/g, ''); return !d ? '' : d.startsWith('972') ? d : d.startsWith('0') ? '972' + d.slice(1) : d }
const DOCK_KEY = 'afik_lcv_dock_v1'

const TR = {
  he: {
    title: 'שיחת וואטסאפ', from: n => `מהוואטסאפ של המשרד${n ? ` · ${n}` : ''}`, refresh: 'רענון השיחה', openChats: 'בצ׳אטים',
    loading: 'טוען את השיחה…', empty: 'עוד אין הודעות בשיחה הזו', emptyFirst: 'הודעת הפתיחה מוכנה למטה. אפשר לבחור נוסח אחר מהרשימה ולערוך לפני השליחה',
    histErr: 'לא הצלחנו לקרוא את ההיסטוריה מוואטסאפ, מוצגות ההודעות שנשלחו מכאן', retry: 'נסו שוב',
    quota: 'השליחה חסומה: המכסה החודשית של Green API נגמרה. אפשר לקרוא שיחות, אבל הודעות לא יוצאות עד שמשדרגים את התוכנית.', upgrade: 'לשדרוג',
    placeholder: 'כתבו הודעה…', send: 'שלח', sendWelcome: 'שלח הודעת פתיחה', sending: 'שולח…', noPhone: 'לליד הזה אין מספר טלפון, אי אפשר לשלוח הודעה',
    pick: '⚡ בחירת תבנית…', editTpl: 'עריכת התבנית עצמה (לכל הלידים)', sent: 'נשלח', auto: 'באוטומציה', firstNote: 'הודעה ראשונה · תיחשב כהודעת הפתיחה',
    maximize: 'הגדלת השיחה למסך מלא', restore: 'חזרה לתצוגה הרגילה (Esc)', resizeDock: 'גררו למעלה או למטה לשינוי גודל תיבת הכתיבה (לחיצה כפולה מחזירה)',
    enterHint: 'Enter לשליחה · Shift+Enter לשורה חדשה', clear: 'ניקוי',
  },
  en: {
    title: 'WhatsApp conversation', from: n => `From the office WhatsApp${n ? ` · ${n}` : ''}`, refresh: 'Refresh the conversation', openChats: 'In chats',
    loading: 'Loading the conversation…', empty: 'No messages in this conversation yet', emptyFirst: 'The welcome message is ready below. Pick another wording from the list and edit it before sending',
    histErr: 'Couldn\'t read the WhatsApp history, showing the messages sent from here', retry: 'Try again',
    quota: 'Sending is blocked: the Green API monthly quota is used up. Conversations can be read, but nothing goes out until the plan is upgraded.', upgrade: 'Upgrade',
    placeholder: 'Write a message…', send: 'Send', sendWelcome: 'Send the welcome', sending: 'Sending…', noPhone: 'This lead has no phone number, nothing can be sent',
    pick: '⚡ Pick a template…', editTpl: 'Edit the template itself (for every lead)', sent: 'sent', auto: 'automation', firstNote: 'First message · counts as the welcome',
    maximize: 'Expand the conversation', restore: 'Back to the normal view (Esc)', resizeDock: 'Drag up or down to resize the message box (double-click resets)',
    enterHint: 'Enter to send · Shift+Enter for a new line', clear: 'Clear',
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
const readDock = () => { try { const v = Number(localStorage.getItem(DOCK_KEY)); return v > 0 ? v : null } catch { return null } }

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
  const [tplId, setTplId] = useState('')                 // the template the box started from
  const [tplLang, setTplLang] = useState(() => leadLang(tplLead))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cfgLocal, setCfgLocal] = useState(null)
  const [editTpl, setEditTpl] = useState(null)
  const [dock, setDock] = useState(readDock)              // the composer's dragged height (null = fits its text)
  const cfg = cfgLocal || autoConfig
  useEffect(() => { setCfgLocal(null) }, [autoConfig])
  const rootRef = useRef(null), scrollRef = useRef(null), inputRef = useRef(null), dockRef = useRef(null)
  const etagRef = useRef({}), nearBottom = useRef(true), inserted = useRef(''), prefilled = useRef(false)

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
    setGreen([]); setPending([]); setError(''); setInput(''); setTplId(''); setHistState('loading')
    nearBottom.current = true; inserted.current = ''; prefilled.current = false
    load()
    const iv = setInterval(() => { if (!document.hidden) load(true) }, 8000)
    return () => clearInterval(iv)
  }, [load])

  const msgs = useMemo(() => mergeConversation(green, localMsgs, pending), [green, localMsgs, pending])
  const hasOut = msgs.some(m => m.direction === 'out' && !String(m.id).startsWith('opt-'))
  const first = !!phone && needsWelcome && !hasOut && histState !== 'loading'
  const firstOutAt = msgs.find(m => m.direction === 'out' && !String(m.id).startsWith('opt-'))?.created_at || null
  const onActivityRef = useRef(onActivity)
  useEffect(() => { onActivityRef.current = onActivity }, [onActivity])
  useEffect(() => { if (histState === 'ok') onActivityRef.current?.({ hasOut, firstOutAt }) }, [histState, hasOut, firstOutAt])

  // ── the template dropdown (rendered for this lead) ──
  const outTexts = useMemo(() => msgs.filter(m => m.direction === 'out').map(m => m.message), [msgs])
  const groups = useMemo(() => templateOptions(cfg, tplLead, tplLang, { outTexts, first, categories: CATEGORIES }), [cfg, tplLead, tplLang, outTexts, first])
  const byId = useMemo(() => Object.fromEntries(groups.flatMap(g => g.items).map(x => [x.id, x])), [groups])
  const putText = useCallback((text, id) => {
    setInput(text); setTplId(id || ''); inserted.current = text
    setTimeout(() => { const el = inputRef.current; if (el) { el.focus(); el.setSelectionRange(text.length, text.length) } }, 30)
  }, [])
  // nothing sent yet: the box starts with the automation's welcome (once per lead; an emptied box stays empty)
  useEffect(() => {
    if (!first || prefilled.current || input) return
    const def = groups[0]?.items.find(x => x.isDefault) || groups[0]?.items[0]
    if (def) { prefilled.current = true; setInput(def.text); setTplId(def.id); inserted.current = def.text }
  }, [first, groups, input])
  // switching the language re-renders a wording that wasn't edited
  useEffect(() => {
    if (tplId && byId[tplId] && input === inserted.current && input !== byId[tplId].text) { setInput(byId[tplId].text); inserted.current = byId[tplId].text }
  }, [tplLang]) // eslint-disable-line react-hooks/exhaustive-deps

  // keep the newest message in view (unless the reader scrolled up)
  useLayoutEffect(() => { const el = scrollRef.current; if (el && nearBottom.current) el.scrollTop = el.scrollHeight }, [msgs.length, histState, dock])
  const onScroll = () => { const el = scrollRef.current; if (el) nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }

  // ── sending ──
  const send = async (text) => {
    const msg = String(text || '').trim()
    if (!msg || busy || !phone) return false
    const id = `opt-${Date.now()}`
    const asWelcome = first
    setBusy(true); setError(''); nearBottom.current = true
    setPending(p => [...p, { id, direction: 'out', message: msg, created_at: new Date().toISOString(), status: 'sending' }])
    const r = asWelcome ? await onSendWelcome?.(msg, tplId || 'manual') : await onSend?.(msg)
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
  const submit = async () => { if (await send(input)) { setInput(''); setTplId(''); inserted.current = '' } }

  // the box grows with its text while the composer has no dragged height
  useLayoutEffect(() => {
    const el = inputRef.current; if (!el) return
    if (dock) { el.style.height = ''; return }
    el.style.height = 'auto'; el.style.height = Math.min(160, el.scrollHeight + 2) + 'px'
  }, [input, dock])

  // ── messages ──
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
    const sending = String(m.id).startsWith('opt-') && m.status === 'sending'
    items.push(
      <div key={m.id || i} style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', marginBottom: last ? 6 : 2 }}>
        <div style={{ maxWidth: 'min(78%, 560px)', minWidth: 84, padding: '6px 9px 20px', borderRadius: out ? (last ? '8px 8px 0 8px' : '8px') : (last ? '8px 8px 8px 0' : '8px'), background: out ? WA.bubbleOut : WA.bubbleIn, color: WA.bodyText, fontSize: 14, lineHeight: 1.5, boxShadow: '0 1px .5px rgba(0,0,0,.18)', position: 'relative', opacity: sending ? .7 : 1, wordBreak: 'break-word' }}>
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

  const dockMax = () => Math.max(140, (rootRef.current?.getBoundingClientRect().height || 600) - 180)
  const curTpl = tplId ? getTemplate(mergeConfig(cfg || {}), tplId) : null
  const canSend = !busy && !!input.trim()

  return (
    <div ref={rootRef} className="lcv" dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: WA.chatBg, borderRadius: 'inherit', overflow: 'hidden' }}>
      <style>{SPLITTER_CSS + `
        .lcv button,.lcv select{font-family:inherit}
        .lcv-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;min-width:32px;padding:0 10px;border-radius:8px;border:1px solid ${WA.border};background:transparent;color:${WA.bodyText};font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;flex-shrink:0}
        .lcv-btn:hover:not(:disabled){background:${WA.hoverRow}}
        .lcv-btn:disabled{opacity:.45;cursor:not-allowed}
        .lcv-btn[aria-pressed=true]{border-color:${WA.green};background:${WA.green}22}
        .lcv :focus-visible{outline:2px solid ${WA.green};outline-offset:1px}
        .lcv-sel{height:34px;min-width:0;flex:1 1 220px;max-width:420px;border-radius:8px;border:1px solid ${WA.border};background:${WA.inputFieldBg};color:${WA.bodyText};font-size:13px;padding:0 10px;cursor:pointer}
        .lcv-seg{display:inline-flex;border:1px solid ${WA.border};border-radius:8px;overflow:hidden;flex-shrink:0}
        .lcv-seg button{height:32px;padding:0 10px;border:none;background:transparent;color:${WA.subText};font-size:12px;font-weight:700;cursor:pointer}
        .lcv-seg button[aria-pressed=true]{background:${WA.green}26;color:${WA.bodyText}}
      `}</style>

      {/* header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: compact ? '7px 10px' : '8px 12px', background: WA.panelBg, borderBottom: `1px solid ${WA.border}` }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill={WA.green} aria-hidden style={{ flexShrink: 0 }}><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: WA.bodyText }}>{t.title}</div>
          {!compact && <div style={{ fontSize: 11.5, color: WA.subText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.from(officePhone)}</div>}
        </div>
        <button type="button" className="lcv-btn" onClick={() => load()} aria-label={t.refresh} title={t.refresh}>↻</button>
        {onToggleMaximize && <button type="button" className="lcv-btn" onClick={onToggleMaximize} aria-pressed={maximized} aria-label={maximized ? t.restore : t.maximize} title={maximized ? t.restore : t.maximize}>{maximized ? '⤡' : '⤢'}</button>}
        {onOpenChats && phone && !compact && <button type="button" className="lcv-btn" onClick={onOpenChats}>{t.openChats} ↗</button>}
      </div>

      {quota && (
        <div role="alert" style={{ flexShrink: 0, display: 'flex', gap: 10, alignItems: 'center', padding: '7px 12px', background: isDark ? '#3B2A12' : '#FFF4E0', color: isDark ? '#F5C77A' : '#8A5300', fontSize: 12.5, lineHeight: 1.45, borderBottom: `1px solid ${WA.border}` }}>
          <span aria-hidden>⚠️</span><span style={{ flex: 1 }}>{t.quota}</span>
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer" className="lcv-btn" style={{ textDecoration: 'none', color: 'inherit', borderColor: 'currentColor' }}>{t.upgrade}</a>
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, minHeight: 80, overflowY: 'auto', overscrollBehavior: 'contain', padding: '8px 14px 10px', backgroundImage: isDark ? DOODLE_DARK : DOODLE_LIGHT }}>
        {histState === 'error' && <div style={{ textAlign: 'center', margin: '8px 0' }}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 12, color: WA.subText, background: WA.dateSepBg, borderRadius: 8, padding: '5px 12px' }}>{t.histErr}<button type="button" onClick={() => load()} style={{ border: 'none', background: 'none', color: WA.green, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>{t.retry}</button></span></div>}
        {histState === 'loading' && !msgs.length && <div style={{ textAlign: 'center', color: WA.subText, fontSize: 13, padding: 30 }}>{t.loading}</div>}
        {histState !== 'loading' && !msgs.length && (
          <div style={{ textAlign: 'center', padding: '28px 16px 12px' }}>
            <div style={{ display: 'inline-block', maxWidth: 420, background: WA.dateSepBg, borderRadius: 10, padding: '10px 16px', boxShadow: '0 1px .5px rgba(0,0,0,.18)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: WA.bodyText }}>{phone ? t.empty : t.noPhone}</div>
              {first && <div style={{ fontSize: 12, color: WA.subText, marginTop: 4, lineHeight: 1.5 }}>{t.emptyFirst}</div>}
            </div>
          </div>
        )}
        {items}
      </div>

      {/* composer: drag its top edge to make it taller or shorter */}
      {phone && (
        <Splitter axis="y" grows={-1} min={96} max={dockMax} label={t.resizeDock}
          get={() => dockRef.current?.getBoundingClientRect().height || 120}
          apply={v => { if (dockRef.current) dockRef.current.style.height = `${v}px` }}
          commit={v => { setDock(v); try { localStorage.setItem(DOCK_KEY, String(v)) } catch {} }}
          reset={() => { if (dockRef.current) dockRef.current.style.height = ''; setDock(null); try { localStorage.removeItem(DOCK_KEY) } catch {} }}/>
      )}
      <div ref={dockRef} style={{ flexShrink: 0, height: dock || undefined, display: 'flex', flexDirection: 'column', gap: 6, background: WA.inputBg, borderTop: `1px solid ${WA.border}`, padding: '8px 10px' }}>
        {error && <div role="alert" style={{ fontSize: 12.5, color: '#E05252', fontWeight: 600, margin: '0 2px', lineHeight: 1.45 }}>{error}</div>}
        {phone ? <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <select className="lcv-sel" value={tplId && byId[tplId] ? tplId : ''} aria-label={t.pick}
              onChange={e => { const x = byId[e.target.value]; if (x) putText(x.text, x.id) }}>
              <option value="">{t.pick}</option>
              {groups.map(g => (
                <optgroup key={g.id} label={g.label}>
                  {g.items.map(x => <option key={x.id} value={x.id}>{x.title}{x.isDefault && first ? ` ★ ${t.auto}` : ''}{x.sent ? ` · ${t.sent} ✓` : ''}</option>)}
                </optgroup>
              ))}
            </select>
            <button type="button" className="lcv-btn" disabled={!curTpl} onClick={() => curTpl && setEditTpl({ tpl: curTpl, initial: null, lang: tplLang, fromChat: false })} aria-label={t.editTpl} title={t.editTpl}>✏️</button>
            <div className="lcv-seg" role="group" aria-label="language">
              {['he', 'en'].map(l => <button key={l} type="button" aria-pressed={tplLang === l} onClick={() => setTplLang(l)}>{l === 'he' ? 'עב' : 'EN'}</button>)}
            </div>
            {input && <button type="button" className="lcv-btn" onClick={() => { setInput(''); setTplId(''); inserted.current = ''; inputRef.current?.focus() }}>{t.clear}</button>}
            {first && <span style={{ fontSize: 11.5, color: WA.green, fontWeight: 700, marginInlineStart: 'auto' }}>{t.firstNote}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flex: dock ? 1 : undefined, minHeight: 0 }}>
            <textarea ref={inputRef} value={input} rows={1} placeholder={t.placeholder} aria-label={t.placeholder} title={t.enterHint}
              onChange={e => { setInput(e.target.value); if (!e.target.value.trim()) setTplId('') }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !matchMedia('(hover: none)').matches) { e.preventDefault(); submit() } }}
              dir={tplLang === 'en' && tplId ? 'ltr' : undefined}
              style={{ flex: 1, alignSelf: 'stretch', resize: 'none', boxSizing: 'border-box', minHeight: 42, maxHeight: dock ? 'none' : 160, height: dock ? '100%' : undefined, padding: '10px 14px', borderRadius: 18, border: `1px solid ${first ? WA.green + '66' : 'transparent'}`, background: first ? WA.bubbleOut : WA.inputFieldBg, color: WA.bodyText, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, outline: 'none', unicodeBidi: 'plaintext' }}/>
            {first
              ? <button type="button" onClick={submit} disabled={!canSend} style={{ height: 42, padding: '0 16px', borderRadius: 21, border: 'none', background: WA.green, color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: canSend ? 'pointer' : 'not-allowed', opacity: canSend ? 1 : .55, flexShrink: 0, whiteSpace: 'nowrap' }}>{busy ? t.sending : t.sendWelcome}</button>
              : <button type="button" onClick={submit} disabled={!canSend} aria-label={t.send} title={t.send}
                  style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: WA.green, color: '#fff', cursor: canSend ? 'pointer' : 'not-allowed', opacity: canSend ? 1 : .55, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {busy ? <span style={{ fontSize: 12 }}>…</span> : <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" style={{ transform: lang === 'en' ? 'none' : 'scaleX(-1)' }}><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>}
                </button>}
          </div>
        </> : <div style={{ fontSize: 12.5, color: WA.subText, textAlign: 'center', padding: 6 }}>{t.noPhone}</div>}
      </div>

      {editTpl && (
        <TemplateQuickEdit WA={WA} lang={lang} lead={tplLead} tpl={editTpl.tpl} initial={editTpl.initial} initialLang={editTpl.lang} fromChat={editTpl.fromChat}
          autoConfig={cfg} onClose={() => setEditTpl(null)} onSaved={next => { setCfgLocal(next); onAutoConfigSaved?.(next) }}/>
      )}
    </div>
  )
}
