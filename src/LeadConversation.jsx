// The Lead Center's conversation with one lead, in the chats tab's WhatsApp look (src/waShared.jsx): the real WhatsApp
// history of the lead's number (POST /api/meta/chat-history, conditional, re-read every 8 s while visible) merged with the
// Lead Center's own log (meta_messages), and a composer with the template library as one dropdown (rendered for this
// lead; welcome wordings first while nothing was sent — the box then starts with the automation's welcome and the first
// send counts as the welcome). The composer's height is dragged like an editor's panel (src/Splitter.jsx). Sends go
// through the parent (POST /api/meta/messages or /api/meta/lead-welcome), so the Lead Center keeps marking who got a message.
import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react'
import { WAText } from './waFormat.jsx'
import { DARK, LIGHT, DOODLE_DARK, DOODLE_LIGHT, normalizeGreenMsg, TickMark, LeadFormCard } from './waShared.jsx'
import { leadFormCard } from './lib/leadHistory.js'
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
    quick: 'תשובות מוכנות', quickTip: 'תשובות מוכנות (או / בתחילת ההודעה)', search: 'חיפוש תבנית…', none: 'לא נמצאו תבניות',
    fromTpl: 'מתבנית', edited: 'נערך', editShort: 'עריכת התבנית', clearTip: 'ניקוי ההודעה', langHe: 'עברית', langEn: 'English',
    quickHint: '↑ ↓ לבחירה · Enter להכנסה · Esc לסגירה', count: n => `${n} תבניות`, lineOf: n => `קו המשרד ${n}`,
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
    quick: 'Quick replies', quickTip: 'Quick replies (or / at the start of a message)', search: 'Search templates…', none: 'No templates found',
    fromTpl: 'From template', edited: 'edited', editShort: 'Edit the template', clearTip: 'Clear the message', langHe: 'עברית', langEn: 'English',
    quickHint: '↑ ↓ to choose · Enter to insert · Esc to close', count: n => `${n} templates`, lineOf: n => `Office line ${n}`,
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
const localPhone = p => { const d = String(p || '').replace(/\D/g, ''); const l = d.startsWith('972') ? '0' + d.slice(3) : d; return l.length === 10 ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l }
const initials = name => String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?'
// WhatsApp Web's own icon shapes (24px, currentColor)
const I = {
  refresh: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>,
  expand: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>,
  shrink: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>,
  open: <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>,
  bolt: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/></svg>,
  pencil: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>,
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>,
  send: <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
}

export default function LeadConversation({ lead, tplLead, lang = 'he', isDark = true, localMsgs = [], needsWelcome = false, autoConfig = null, onAutoConfigSaved, onSend, onSendWelcome, onOpenChats, officePhone = '', compact = false, onActivity, maximized = false, onToggleMaximize }) {
  const t = TR[lang] || TR.he
  const WA = isDark ? DARK : LIGHT
  const formCard = useMemo(() => leadFormCard(lead, lang), [lead, lang])
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
  const [quick, setQuick] = useState(false)               // the quick-replies window (⚡ or "/" at the start of the box)
  const [qq, setQq] = useState('')
  const [qActive, setQActive] = useState(0)
  const cfg = cfgLocal || autoConfig
  useEffect(() => { setCfgLocal(null) }, [autoConfig])
  const rootRef = useRef(null), scrollRef = useRef(null), inputRef = useRef(null), dockRef = useRef(null), qListRef = useRef(null), qBtnRef = useRef(null)
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

  // ── quick replies (WhatsApp Business style): search, sections, keyboard ──
  const qText = qq.trim().toLowerCase()
  const qSections = useMemo(() => {
    if (!qText) return groups
    const hits = groups.flatMap(g => g.items).filter(x => `${x.title} ${x.text}`.toLowerCase().includes(qText))
    return hits.length ? [{ id: 'q', label: '', items: hits }] : []
  }, [groups, qText])
  const qFlat = useMemo(() => qSections.flatMap(g => g.items), [qSections])
  useEffect(() => { setQActive(0) }, [qText, tplLang, quick])
  useEffect(() => { qListRef.current?.querySelector(`[data-qi="${qActive}"]`)?.scrollIntoView({ block: 'nearest' }) }, [qActive])
  const openQuick = (q = '') => { setQq(q); setQuick(true) }
  const closeQuick = (focusBox = true) => { setQuick(false); setQq(''); if (focusBox) setTimeout(() => inputRef.current?.focus(), 0) }
  const pickQuick = x => { if (!x) return; setQuick(false); setQq(''); putText(x.text, x.id) }
  const qKey = e => {
    if (e.key === 'Escape') { e.preventDefault(); closeQuick() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setQActive(i => Math.min(qFlat.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setQActive(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); pickQuick(qFlat[qActive]) }
  }
  useEffect(() => {
    if (!quick) return
    const down = e => { if (!e.target.closest?.('.lcv-quick') && !qBtnRef.current?.contains(e.target)) setQuick(false) }
    window.addEventListener('mousedown', down)
    return () => window.removeEventListener('mousedown', down)
  }, [quick])

  // ── messages (WhatsApp Web: a tail on the first bubble of a run, the time tucked into the last line) ──
  const items = []
  let lastDay = ''
  msgs.forEach((m, i) => {
    const day = new Date(m.created_at).toDateString()
    if (day !== lastDay) {
      lastDay = day
      items.push(<div key={`d-${day}`} className="lcv-day"><span>{fmtDay(m.created_at, lang)}</span></div>)
    }
    const out = m.direction === 'out'
    const prev = msgs[i - 1], next = msgs[i + 1]
    const firstOfRun = !prev || prev.direction !== m.direction || new Date(prev.created_at).toDateString() !== day || Math.abs(new Date(m.created_at) - new Date(prev.created_at)) > 60000
    const lastOfRun = !next || next.direction !== m.direction || Math.abs(new Date(next.created_at) - new Date(m.created_at)) > 60000
    const sending = String(m.id).startsWith('opt-') && m.status === 'sending'
    items.push(
      <div key={m.id || i} className={`lcv-row ${out ? 'out' : 'in'}`} style={{ marginTop: firstOfRun ? 8 : 2, marginBottom: lastOfRun ? 2 : 0 }}>
        <div className={`lcv-b ${out ? 'out' : 'in'}${firstOfRun ? ' tail' : ''}`} style={{ opacity: sending ? .7 : 1 }}>
          {m.quoted && <div className="lcv-quote" style={{ borderInlineStartColor: m.quoted.out ? WA.green : '#53BDEB' }}>{m.quoted.text}</div>}
          {m.media && (m.kind === 'imageMessage' || m.kind === 'stickerMessage') && (m.media.url || m.media.thumb) && (
            <a href={m.media.url || undefined} target="_blank" rel="noreferrer" style={{ display: 'block', margin: '-3px -4px 4px' }}>
              <img src={m.media.url || m.media.thumb} alt="" loading="lazy" style={{ display: 'block', maxWidth: 280, width: '100%', borderRadius: 6 }}/>
            </a>
          )}
          {m.media?.url && m.kind === 'audioMessage' && <audio src={m.media.url} controls preload="none" style={{ display: 'block', width: 240, maxWidth: '100%', height: 34, margin: '2px 0 4px' }}/>}
          {m.media?.url && (m.kind === 'documentMessage' || m.kind === 'videoMessage') && <a href={m.media.url} target="_blank" rel="noreferrer" className="lcv-file">{m.kind === 'videoMessage' ? '🎥' : '📄'} {m.media.name || (lang === 'en' ? 'Open' : 'פתיחה')}</a>}
          {m.location?.latitude && <a href={`https://maps.google.com/?q=${m.location.latitude},${m.location.longitude}`} target="_blank" rel="noreferrer" className="lcv-file">📍 {m.location.nameLocation || m.location.address || (lang === 'en' ? 'Location' : 'מיקום')}</a>}
          <div className="lcv-txt">{m.message ? <WAText text={m.message}/> : null}<span className={`lcv-sp${out ? ' o' : ''}`} aria-hidden="true"/></div>
          <span className="lcv-meta">
            <span>{fmtTime(m.created_at)}</span>
            {out && <TickMark status={sending ? 'sending' : (m.status || 'sent')} WA={WA} size={14}/>}
          </span>
        </div>
      </div>
    )
  })

  const dockMax = () => Math.max(140, (rootRef.current?.getBoundingClientRect().height || 600) - 180)
  const curTpl = tplId ? getTemplate(mergeConfig(cfg || {}), tplId) : null
  const tplTitle = tplId && byId[tplId] ? byId[tplId].title : ''
  const canSend = !busy && !!input.trim()
  const name = lead?.name || localPhone(lead?.phone) || ''
  const panel = isDark ? '#202C33' : '#F0F2F5'
  const icon = isDark ? '#AEBAC1' : '#54656F'
  const teal = isDark ? '#00A884' : '#008069'

  let qi = -1
  return (
    <div ref={rootRef} className="lcv" dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: isDark ? '#0B141A' : '#EFEAE2', borderRadius: 'inherit', overflow: 'hidden' }}>
      <style>{SPLITTER_CSS + `
        .lcv{font-family:"Segoe UI",Helvetica,Rubik,Heebo,Arial,sans-serif;-webkit-font-smoothing:antialiased}
        .lcv button,.lcv input,.lcv textarea{font-family:inherit;min-height:0}
        .lcv :focus-visible{outline:2px solid ${WA.green};outline-offset:2px}
        .lcv-ib{width:40px;height:40px;border-radius:50%;border:none;background:transparent;color:${icon};display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .15s}
        .lcv-ib:hover:not(:disabled){background:${isDark ? 'rgba(255,255,255,.08)' : 'rgba(11,20,26,.06)'}}
        .lcv-ib[aria-pressed=true],.lcv-ib[aria-expanded=true]{background:${isDark ? 'rgba(255,255,255,.1)' : 'rgba(11,20,26,.08)'};color:${teal}}
        .lcv-ib:disabled{opacity:.4;cursor:default}
        .lcv-day{display:flex;justify-content:center;margin:12px 0 6px;position:sticky;top:6px;z-index:2}
        .lcv-day span{font-size:12.5px;color:${isDark ? '#8696A0' : '#54656F'};background:${isDark ? '#182229' : '#FFFFFF'};border-radius:7.5px;padding:5px 12px 6px;box-shadow:0 1px .5px rgba(11,20,26,.13);text-transform:none}
        .lcv-row{display:flex;padding:0 6%;direction:ltr}
        .lcv-row.out{justify-content:flex-end}
        .lcv-b{position:relative;direction:rtl;max-width:min(65%,560px);padding:6px 7px 8px 9px;border-radius:7.5px;font-size:14.2px;line-height:19px;color:${WA.bodyText};box-shadow:0 1px .5px rgba(11,20,26,.13);word-wrap:break-word;overflow-wrap:anywhere}
        .lcv-b.out{background:${isDark ? '#005C4B' : '#D9FDD3'}}
        .lcv-b.in{background:${isDark ? '#202C33' : '#FFFFFF'}}
        .lcv-b.tail.out{border-top-right-radius:0}
        .lcv-b.tail.in{border-top-left-radius:0}
        .lcv-b.tail::before{content:'';position:absolute;top:0;width:0;height:0;border-top:10px solid}
        .lcv-b.tail.out::before{right:-8px;border-top-color:${isDark ? '#005C4B' : '#D9FDD3'};border-right:8px solid transparent}
        .lcv-b.tail.in::before{left:-8px;border-top-color:${isDark ? '#202C33' : '#FFFFFF'};border-left:8px solid transparent}
        .lcv-txt{unicode-bidi:plaintext;text-align:right;white-space:pre-wrap}
        .lcv-sp{display:inline-block;width:46px;height:1px;vertical-align:middle}
        .lcv-sp.o{width:66px}
        .lcv-meta{position:absolute;bottom:4px;left:7px;display:flex;align-items:center;gap:3px;direction:ltr;font-size:11px;color:${isDark ? 'rgba(233,237,239,.6)' : '#667781'};line-height:15px}
        .lcv-quote{border-inline-start:4px solid;background:${isDark ? 'rgba(0,0,0,.2)' : 'rgba(11,20,26,.05)'};border-radius:7.5px;padding:5px 9px;margin:-2px -4px 6px;font-size:13px;color:${WA.subText}}
        .lcv-file{display:block;font-size:13.5px;color:${teal};font-weight:600;margin-bottom:4px}
        .lcv-in{flex:1;align-self:stretch;resize:none;box-sizing:border-box;min-height:42px;padding:10px 12px;border-radius:8px;border:none;background:${isDark ? '#2A3942' : '#FFFFFF'};color:${WA.bodyText};font-size:15px;line-height:20px;outline:none;unicode-bidi:plaintext}
        .lcv-in::placeholder{color:${isDark ? '#8696A0' : '#667781'}}
        .lcv-send{width:42px;height:42px;border-radius:50%;border:none;background:${WA.green};color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:transform .15s,opacity .15s}
        .lcv-send:disabled{opacity:.45;cursor:default}
        .lcv-send:hover:not(:disabled){transform:scale(1.04)}
        .lcv-send.wide{width:auto;padding:0 18px;border-radius:21px;font-size:14px;font-weight:600;gap:8px;white-space:nowrap}
        .lcv-tpl{display:flex;align-items:center;gap:8px;margin:0 52px 6px 52px;padding:6px 6px 6px 12px;border-radius:8px;background:${isDark ? '#1D282F' : '#FFFFFF'};border-inline-start:4px solid ${teal};font-size:13px;color:${WA.subText};min-width:0}
        [dir=rtl] .lcv-tpl{padding:6px 12px 6px 6px}
        .lcv-tpl b{color:${teal};font-weight:600}
        .lcv-seg{display:inline-flex;background:${isDark ? 'rgba(255,255,255,.06)' : 'rgba(11,20,26,.05)'};border-radius:999px;padding:2px;flex-shrink:0}
        .lcv-seg button{border:none;background:transparent;color:${WA.subText};font-size:12px;font-weight:600;border-radius:999px;padding:3px 10px;cursor:pointer}
        .lcv-seg button[aria-pressed=true]{background:${isDark ? '#2A3942' : '#FFFFFF'};color:${WA.bodyText};box-shadow:0 1px 2px rgba(11,20,26,.15)}
        .lcv-quick{position:absolute;z-index:30;inset-inline:10px;bottom:calc(100% + 6px);max-width:560px;max-height:min(440px,70vh);display:flex;flex-direction:column;background:${isDark ? '#233138' : '#FFFFFF'};border-radius:10px;box-shadow:0 2px 5px rgba(11,20,26,.26),0 2px 10px rgba(11,20,26,.16);overflow:hidden;animation:lcvIn .14s ease-out}
        @keyframes lcvIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.lcv-quick{animation:none}}
        .lcv-qhead{display:flex;align-items:center;gap:8px;padding:10px 12px 8px;border-bottom:1px solid ${isDark ? 'rgba(134,150,160,.15)' : '#E9EDEF'}}
        .lcv-qsearch{flex:1;display:flex;align-items:center;gap:8px;background:${isDark ? '#202C33' : '#F0F2F5'};border-radius:8px;padding:0 12px;height:36px;color:${icon}}
        .lcv-qsearch input{flex:1;border:none;background:transparent;color:${WA.bodyText};font-size:14px;outline:none;min-width:0}
        .lcv-qlist{overflow-y:auto;flex:1;min-height:0;padding-bottom:6px}
        .lcv-qsec{position:sticky;top:0;z-index:1;background:${isDark ? '#233138' : '#FFFFFF'};padding:12px 16px 6px;font-size:13px;font-weight:500;color:${teal}}
        .lcv-qi{display:flex;align-items:center;gap:10px;padding:9px 16px;cursor:pointer}
        .lcv-qi[aria-selected=true]{background:${isDark ? '#2A3942' : '#F5F6F6'}}
        .lcv-qi .t{display:flex;align-items:center;gap:6px;font-size:14.5px;color:${WA.bodyText};min-width:0}
        .lcv-qi .t span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .lcv-qi .p{font-size:13px;color:${WA.subText};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}
        .lcv-badge{flex:none;font-size:11px;font-weight:600;border-radius:999px;padding:1px 8px;line-height:16px}
        .lcv-qfoot{display:flex;align-items:center;gap:8px;padding:8px 14px;border-top:1px solid ${isDark ? 'rgba(134,150,160,.15)' : '#E9EDEF'};font-size:12px;color:${WA.subText}}
      `}</style>

      {/* header: avatar, name, the office line; round icon buttons */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, height: compact ? 54 : 59, padding: '0 10px 0 16px', background: panel, borderInlineStart: 'none', boxShadow: `0 1px 0 ${isDark ? 'rgba(134,150,160,.15)' : '#E9EDEF'}`, zIndex: 3 }}>
        <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: isDark ? '#6A7175' : '#DFE5E7', color: isDark ? '#E9EDEF' : '#54656F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600 }}>{initials(lead?.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, color: WA.bodyText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><bdi>{name || t.title}</bdi></div>
          <div style={{ fontSize: 13, color: WA.subText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lead?.phone && <span dir="ltr">{localPhone(lead.phone)}</span>}{!compact && <>{lead?.phone ? ' · ' : ''}{t.from(officePhone)}</>}
          </div>
        </div>
        <button type="button" className="lcv-ib" onClick={() => load()} aria-label={t.refresh} title={t.refresh}>{I.refresh}</button>
        {onToggleMaximize && <button type="button" className="lcv-ib" onClick={onToggleMaximize} aria-pressed={maximized} aria-label={maximized ? t.restore : t.maximize} title={maximized ? t.restore : t.maximize}>{maximized ? I.shrink : I.expand}</button>}
        {onOpenChats && phone && !compact && <button type="button" className="lcv-ib" onClick={onOpenChats} aria-label={t.openChats} title={t.openChats}>{I.open}</button>}
      </div>

      {quota && (
        <div role="alert" style={{ flexShrink: 0, display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px', background: isDark ? '#2B2717' : '#FFF8E1', color: isDark ? '#F5D27A' : '#7A5300', fontSize: 13, lineHeight: 1.45 }}>
          <span style={{ flex: 1 }}>{t.quota}</span>
          <a href="https://console.green-api.com" target="_blank" rel="noreferrer" style={{ flexShrink: 0, textDecoration: 'none', color: '#fff', background: teal, borderRadius: 999, padding: '6px 14px', fontWeight: 600, fontSize: 12.5 }}>{t.upgrade}</a>
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, minHeight: 80, overflowY: 'auto', overscrollBehavior: 'contain', padding: '6px 0 12px', backgroundImage: isDark ? DOODLE_DARK : DOODLE_LIGHT }}>
        <LeadFormCard card={formCard} WA={WA} isDark={isDark} lang={lang}/>
        {histState === 'error' && <div className="lcv-day" style={{ position: 'static' }}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{t.histErr}<button type="button" onClick={() => load()} style={{ border: 'none', background: 'none', color: teal, fontWeight: 600, cursor: 'pointer', fontSize: 12.5 }}>{t.retry}</button></span></div>}
        {histState === 'loading' && !msgs.length && <div className="lcv-day" style={{ position: 'static', marginTop: 30 }}><span>{t.loading}</span></div>}
        {histState !== 'loading' && !msgs.length && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 16px 12px' }}>
            <div style={{ maxWidth: 440, textAlign: 'center', background: isDark ? '#182229' : '#FFEECD', color: isDark ? '#FFD279' : '#54656F', borderRadius: 7.5, padding: '8px 14px', fontSize: 12.5, lineHeight: 1.5, boxShadow: '0 1px .5px rgba(11,20,26,.13)' }}>
              <div style={{ fontWeight: 600 }}>{phone ? t.empty : t.noPhone}</div>
              {first && <div style={{ marginTop: 3 }}>{t.emptyFirst}</div>}
            </div>
          </div>
        )}
        {items}
      </div>

      {/* composer: drag its top edge to make it taller or shorter */}
      {phone && (
        <Splitter axis="y" grows={-1} min={64} max={dockMax} label={t.resizeDock}
          get={() => dockRef.current?.getBoundingClientRect().height || 120}
          apply={v => { if (dockRef.current) dockRef.current.style.height = `${v}px` }}
          commit={v => { setDock(v); try { localStorage.setItem(DOCK_KEY, String(v)) } catch {} }}
          reset={() => { if (dockRef.current) dockRef.current.style.height = ''; setDock(null); try { localStorage.removeItem(DOCK_KEY) } catch {} }}/>
      )}
      <div ref={dockRef} style={{ position: 'relative', flexShrink: 0, height: dock || undefined, display: 'flex', flexDirection: 'column', background: panel, padding: '8px 10px 10px' }}>
        {quick && phone && (
          <div className="lcv-quick" role="dialog" aria-label={t.quick} onKeyDown={qKey}>
            <div className="lcv-qhead">
              <label className="lcv-qsearch">{I.search}<input autoFocus value={qq} onChange={e => setQq(e.target.value)} placeholder={t.search} aria-label={t.search} aria-controls="lcv-qlist" aria-activedescendant={qFlat[qActive] ? `lcv-q-${qFlat[qActive].id}` : undefined}/></label>
              <div className="lcv-seg" role="group" aria-label="language">
                {['he', 'en'].map(l => <button key={l} type="button" aria-pressed={tplLang === l} onClick={() => setTplLang(l)}>{l === 'he' ? 'עב' : 'EN'}</button>)}
              </div>
              <button type="button" className="lcv-ib" style={{ width: 34, height: 34 }} onClick={() => closeQuick()} aria-label={lang === 'en' ? 'Close' : 'סגירה'}>{I.close}</button>
            </div>
            <div className="lcv-qlist" id="lcv-qlist" role="listbox" ref={qListRef} aria-label={t.quick}>
              {!qFlat.length && <div style={{ padding: 22, textAlign: 'center', color: WA.subText, fontSize: 13.5 }}>{t.none}</div>}
              {qSections.map(g => (
                <div key={g.id} role="group" aria-label={g.label || undefined}>
                  {g.label && <div className="lcv-qsec">{g.label}</div>}
                  {g.items.map(x => {
                    qi += 1
                    const idx = qi
                    return (
                      <div key={g.id + x.id} id={`lcv-q-${x.id}`} data-qi={idx} role="option" aria-selected={idx === qActive} className="lcv-qi"
                        onMouseEnter={() => setQActive(idx)} onMouseDown={e => e.preventDefault()} onClick={() => pickQuick(x)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="t"><span>{x.title}</span>
                            {x.isDefault && first && <span className="lcv-badge" style={{ color: teal, background: teal + '1F' }}>★ {t.auto}</span>}
                            {x.sent && <span className="lcv-badge" style={{ color: WA.subText, background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(11,20,26,.06)' }}>{t.sent} ✓</span>}
                          </div>
                          <div className="p">{x.text.replace(/\n+/g, ' · ')}</div>
                        </div>
                        <button type="button" className="lcv-ib" style={{ width: 32, height: 32, visibility: idx === qActive ? 'visible' : 'hidden' }} aria-label={`${t.editTpl}: ${x.title}`} title={t.editTpl}
                          onClick={e => { e.stopPropagation(); const tpl = getTemplate(mergeConfig(cfg || {}), x.id); if (tpl) { setQuick(false); setEditTpl({ tpl, initial: null, lang: tplLang, fromChat: false }) } }}>{I.pencil}</button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="lcv-qfoot"><span>{t.count(qFlat.length)}</span><span style={{ marginInlineStart: 'auto' }}>{t.quickHint}</span></div>
          </div>
        )}

        {error && <div role="alert" style={{ fontSize: 13, color: isDark ? '#F15C6D' : '#C2283E', fontWeight: 500, margin: '0 52px 6px', lineHeight: 1.45 }}>{error}</div>}
        {phone && (tplTitle || first) && (
          <div className="lcv-tpl">
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tplTitle ? <><b>{t.fromTpl}</b> · {tplTitle}{input !== inserted.current ? ` · ${t.edited}` : ''}</> : null}
              {first && <>{tplTitle ? ' · ' : ''}<b>{t.firstNote}</b></>}
            </span>
            <div className="lcv-seg" role="group" aria-label="language">
              {['he', 'en'].map(l => <button key={l} type="button" aria-pressed={tplLang === l} onClick={() => setTplLang(l)}>{l === 'he' ? 'עב' : 'EN'}</button>)}
            </div>
            {curTpl && <button type="button" className="lcv-ib" style={{ width: 30, height: 30 }} onClick={() => setEditTpl({ tpl: curTpl, initial: null, lang: tplLang, fromChat: false })} aria-label={t.editTpl} title={t.editTpl}>{I.pencil}</button>}
            {input && <button type="button" className="lcv-ib" style={{ width: 30, height: 30 }} onClick={() => { setInput(''); setTplId(''); inserted.current = ''; inputRef.current?.focus() }} aria-label={t.clearTip} title={t.clearTip}>{I.close}</button>}
          </div>
        )}
        {phone ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flex: dock ? 1 : undefined, minHeight: 0 }}>
            <button ref={qBtnRef} type="button" className="lcv-ib" style={{ height: 42, width: 42 }} aria-expanded={quick} aria-haspopup="dialog" aria-label={t.quickTip} title={t.quickTip}
              onClick={() => (quick ? closeQuick() : openQuick())}>{I.bolt}</button>
            <textarea ref={inputRef} className="lcv-in" value={input} rows={1} placeholder={t.placeholder} aria-label={t.placeholder} title={t.enterHint}
              onChange={e => {
                const v = e.target.value
                setInput(v); if (!v.trim()) setTplId('')
                // "/" at the start opens the quick replies, the rest filters them
                if (/^\/\S*$/.test(v)) openQuick(v.slice(1)); else if (quick && v.startsWith('/') === false && qq) closeQuick(false)
              }}
              onKeyDown={e => {
                if (quick && /^\//.test(input) && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
                  if (e.key === 'Enter') { e.preventDefault(); const x = qFlat[qActive]; if (x) pickQuick(x); return }
                  if (e.key === 'Escape') { e.preventDefault(); closeQuick(); return }
                  e.preventDefault(); setQActive(i => e.key === 'ArrowDown' ? Math.min(qFlat.length - 1, i + 1) : Math.max(0, i - 1)); return
                }
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !matchMedia('(hover: none)').matches) { e.preventDefault(); submit() }
              }}
              dir={tplLang === 'en' && tplId ? 'ltr' : undefined}
              style={{ maxHeight: dock ? 'none' : 160, height: dock ? '100%' : undefined }}/>
            {first
              ? <button type="button" className="lcv-send wide" onClick={submit} disabled={!canSend}>{busy ? t.sending : t.sendWelcome}<span style={{ display: 'inline-flex', transform: lang === 'en' ? 'none' : 'scaleX(-1)' }}>{I.send}</span></button>
              : <button type="button" className="lcv-send" onClick={submit} disabled={!canSend} aria-label={t.send} title={t.send}>
                  {busy ? <span style={{ fontSize: 13 }}>…</span> : <span style={{ display: 'inline-flex', transform: lang === 'en' ? 'none' : 'scaleX(-1)' }}>{I.send}</span>}
                </button>}
          </div>
        ) : <div style={{ fontSize: 13, color: WA.subText, textAlign: 'center', padding: 8 }}>{t.noPhone}</div>}
      </div>

      {editTpl && (
        <TemplateQuickEdit WA={WA} lang={lang} lead={tplLead} tpl={editTpl.tpl} initial={editTpl.initial} initialLang={editTpl.lang} fromChat={editTpl.fromChat}
          autoConfig={cfg} onClose={() => setEditTpl(null)} onSaved={next => { setCfgLocal(next); onAutoConfigSaved?.(next) }}/>
      )}
    </div>
  )
}
