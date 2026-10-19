// MetaLeadsTab.jsx — Meta Lead Ads Lead Center (admin "מרכז לידים")
// The list of leads (grouped by day, filters), and for the open lead: the WhatsApp conversation in the chats tab's look
// (src/LeadConversation.jsx — the real WhatsApp history, the template library, the welcome picker) next to the lead's
// details, form answers and notes. Phones get one screen at a time (list → lead → conversation / details).
// Props: { C, lang, isDark, onSaveToCRM, onOpenChat, onNew*, crmLeads, autoConfig, onAutoConfigSaved }

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { metaFormAnswers, shortCampaign } from './lib/leadFields.js'
import { templateLead } from './lib/leadConversation.js'
import { supabase } from './lib/supabaseClient'
import MetaKanban from './MetaKanban'
import LeadConversation from './LeadConversation.jsx'

const ADMIN_TOKEN = 'AFIKhanahal2026'
// Which Facebook pages are synced is decided on the server (META_PAGE_IDS in Vercel) — see api/meta.js resolvePageIds

// ── Translations ─────────────────────────────────────────────────────────────
const TR = {
  he: {
    title: 'מרכז לידים מטא',
    titleEn: 'Meta Lead Center',
    sync: 'סנכרון',
    syncing: 'מסנכרן...',
    syncDone: 'סונכרן!',
    search: 'חיפוש לידים...',
    filterAll: 'הכל',
    filterNew: 'חדש',
    filterContacted: 'נוצר קשר',
    filterScheduled: 'נקבעה שיחה',
    filterClosed: 'סגור',
    noLeads: 'אין לידים עדיין',
    noLeadsDesc: 'לידים מ-Meta יופיעו כאן',
    noMessages: 'אין הודעות עדיין',
    noMessagesDesc: 'שלח הודעה להתחיל שיחה',
    selectLead: 'בחר ליד',
    selectLeadDesc: 'בחר ליד מהרשימה לצפייה בשיחה',
    send: 'שלח WhatsApp',
    sending: 'שולח...',
    messagePlaceholder: 'כתוב הודעה...',
    status: 'סטטוס',
    notes: 'הערות',
    notesPlaceholder: 'הערות פנימיות...',
    campaign: 'קמפיין',
    form: 'טופס',
    phone: 'טלפון',
    email: 'אימייל',
    formAnswers: 'תשובות מהטופס',
    waSent: 'WA נשלח',
    loading: 'טוען...',
    error: 'שגיאה',
    statusNew: 'חדש',
    statusContacted: 'נוצר קשר',
    statusScheduled: 'נקבעה שיחה',
    statusClosed: 'סגור',
    leadsCount: 'לידים',
    saveNotes: 'שמור הערות',
    noteSaved: 'נשמר',
    callTime: 'זמן שיחה',
    callTimePlaceholder: 'ניתן להגדיר לאחר השיחה...',
    saveToCRM: 'שמור ל-CRM →',
    savedToCRM: '✓ נשמר!',
    // Redesigned Lead Center
    kTotal: 'סה״כ לידים', kToday: 'היום', kWeek: '7 ימים אחרונים', kWaiting: 'ממתינים לקשר ראשון', kWelcome: 'קיבלו הודעת פתיחה',
    connOk: 'מחובר לפייסבוק · לידים נכנסים אוטומטית', connBad: 'החיבור לפייסבוק לא תקין — לידים לא נכנסים', connChecking: 'בודק חיבור…',
    connToken: 'הטוקן של Meta לא תקף', connPage: 'העמוד לא רשום לקבלת לידים', waOk: n => `WhatsApp מחובר · ${n}`, waBad: 'WhatsApp לא מחובר',
    welcomeAuto: 'הודעת פתיחה אוטומטית: פעילה', welcomeOff: 'הודעת פתיחה אוטומטית: כבויה', lastLead: 'ליד אחרון',
    welcomeSent: 'הודעת פתיחה נשלחה', welcomeNot: 'עדיין לא נשלחה הודעה', welcomeNow: 'שלח הודעת פתיחה עכשיו', welcomeNoPhone: 'אין מספר טלפון — אי אפשר לשלוח',
    call: 'התקשר', whatsapp: 'וואטסאפ', copy: 'העתק', copied: 'הועתק', archive: 'ארכיון', back: 'חזרה לרשימה',
    received: 'התקבל', source: 'מקור', details: 'פרטי הליד', conversation: 'שיחה', composer: 'כתוב הודעה ללקוח — נשלחת מהוואטסאפ של המשרד…',
    sendBtn: 'שלח', sendFailed: 'השליחה נכשלה', testLead: 'ליד בדיקה', showTest: 'הצג לידי בדיקה', hideTestL: 'הסתר לידי בדיקה',
    overview: 'סקירה', needAttention: 'ממתינים לטיפול', needAttentionDesc: 'לידים מ-14 הימים האחרונים שעדיין לא טופלו', allHandled: 'כל הלידים האחרונים טופלו 🎉',
    byCampaign: 'לידים לפי קמפיין · 30 יום', noRecent: 'אין לידים ב-30 הימים האחרונים', health: 'מצב החיבור',
    hToken: 'חיבור לפייסבוק (טוקן)', hPage: 'העמוד רשום לקבלת לידים', hWebhook: 'עדכון מיידי מפייסבוק (Webhook)', hWa: 'WhatsApp של המשרד', hWelcome: 'הודעת פתיחה אוטומטית',
    never: 'עוד לא התקבל', welcomeTpl: 'הנוסח נערך בטאב אוטומציות ← תבניות',
    tabChat: 'שיחה', tabInfo: 'פרטים והערות', pickWelcome: 'לבחירת הודעת פתיחה', archiveLead: 'העבר לארכיון',
    welcomeHint: 'בחרו נוסח בשיחה ושלחו מהוואטסאפ של המשרד', noteSaveFailed: 'השמירה נכשלה', kWelcomeShort: 'קיבלו הודעה',
    hideKpis: 'הסתר נתונים ▴', showKpis: 'הצג נתונים ▾', resizeList: 'גררו לשינוי רוחב הרשימה (לחיצה כפולה מחזירה)', resizeAside: 'גררו לשינוי רוחב הפרטים (לחיצה כפולה מחזירה)',
  },
  en: {
    title: 'Meta Lead Center',
    titleEn: 'Meta Lead Center',
    sync: 'Sync',
    syncing: 'Syncing...',
    syncDone: 'Synced!',
    search: 'Search leads...',
    filterAll: 'All',
    filterNew: 'New',
    filterContacted: 'Contacted',
    filterScheduled: 'Scheduled',
    filterClosed: 'Closed',
    noLeads: 'No leads yet',
    noLeadsDesc: 'Meta leads will appear here',
    noMessages: 'No messages yet',
    noMessagesDesc: 'Send a message to start the conversation',
    selectLead: 'Select a lead',
    selectLeadDesc: 'Choose a lead from the list to view the conversation',
    send: 'Send WhatsApp',
    sending: 'Sending...',
    messagePlaceholder: 'Type a message...',
    status: 'Status',
    notes: 'Notes',
    notesPlaceholder: 'Internal notes...',
    campaign: 'Campaign',
    form: 'Form',
    phone: 'Phone',
    email: 'Email',
    formAnswers: 'Form answers',
    waSent: 'WA sent',
    loading: 'Loading...',
    error: 'Error',
    statusNew: 'New',
    statusContacted: 'Contacted',
    statusScheduled: 'Scheduled',
    statusClosed: 'Closed',
    leadsCount: 'leads',
    saveNotes: 'Save notes',
    noteSaved: 'Saved',
    callTime: 'Call time',
    callTimePlaceholder: 'Set after the call...',
    saveToCRM: 'Save to CRM →',
    savedToCRM: '✓ Saved!',
    // Redesigned Lead Center
    kTotal: 'Total leads', kToday: 'Today', kWeek: 'Last 7 days', kWaiting: 'Awaiting first contact', kWelcome: 'Got a welcome message',
    connOk: 'Connected to Facebook · leads flow in automatically', connBad: 'Facebook connection broken — leads are not coming in', connChecking: 'Checking connection…',
    connToken: 'The Meta token is not valid', connPage: 'The page is not subscribed to leads', waOk: n => `WhatsApp connected · ${n}`, waBad: 'WhatsApp not connected',
    welcomeAuto: 'Automatic welcome: on', welcomeOff: 'Automatic welcome: off', lastLead: 'Last lead',
    welcomeSent: 'Welcome message sent', welcomeNot: 'No message sent yet', welcomeNow: 'Send the welcome message now', welcomeNoPhone: 'No phone number — nothing to send to',
    call: 'Call', whatsapp: 'WhatsApp', copy: 'Copy', copied: 'Copied', archive: 'Archive', back: 'Back to the list',
    received: 'Received', source: 'Source', details: 'Lead details', conversation: 'Conversation', composer: 'Write to the lead — sent from the office WhatsApp…',
    sendBtn: 'Send', sendFailed: 'Sending failed', testLead: 'Test lead', showTest: 'Show test leads', hideTestL: 'Hide test leads',
    overview: 'Overview', needAttention: 'Needs attention', needAttentionDesc: 'Leads from the last 14 days not handled yet', allHandled: 'All recent leads are handled 🎉',
    byCampaign: 'Leads by campaign · 30 days', noRecent: 'No leads in the last 30 days', health: 'Connection status',
    hToken: 'Facebook connection (token)', hPage: 'Page subscribed to leads', hWebhook: 'Instant updates from Facebook (webhook)', hWa: 'Office WhatsApp', hWelcome: 'Automatic welcome message',
    never: 'Not received yet', welcomeTpl: 'Edit the text in Automations → Templates',
    tabChat: 'Conversation', tabInfo: 'Details & notes', pickWelcome: 'Pick a welcome message', archiveLead: 'Archive',
    welcomeHint: 'Pick a wording in the conversation and send it from the office WhatsApp', noteSaveFailed: 'Saving failed', kWelcomeShort: 'Got a message',
    hideKpis: 'Hide stats ▴', showKpis: 'Show stats ▾', resizeList: 'Drag to resize the list (double-click resets)', resizeAside: 'Drag to resize the details (double-click resets)',
  },
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  new:          { color: '#8490D8', bg: 'rgba(var(--brand-rgb),.18)', label: { he: 'חדש',        en: 'New' } },
  contacted:    { color: '#F97316', bg: 'rgba(249,115, 22,.18)', label: { he: 'נוצר קשר',   en: 'Contacted' } },
  scheduled:    { color: '#22C55E', bg: 'rgba( 34,197, 94,.18)', label: { he: 'נקבעה שיחה', en: 'Scheduled' } },
  closed:       { color: '#6B7280', bg: 'rgba(107,114,128,.18)', label: { he: 'סגור',        en: 'Closed' } },
  saved_to_crm: { color: '#22D3EE', bg: 'rgba(34,211,238,.18)',  label: { he: 'נשמר ב-CRM', en: 'Saved to CRM' } },
}

const CAMPAIGN_COLORS = ['#8490D8','#E05252','#3BAF7E','#E08C3A','#3A8FC7','#C2497E','#F59E0B']

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr, lang) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)   return lang === 'en' ? 'just now' : 'עכשיו'
  if (diff < 3600) return lang === 'en' ? `${Math.floor(diff/60)}m ago` : `לפני ${Math.floor(diff/60)} דק׳`
  if (diff < 86400) return lang === 'en' ? `${Math.floor(diff/3600)}h ago` : `לפני ${Math.floor(diff/3600)} שע׳`
  if (diff < 604800) return lang === 'en' ? `${Math.floor(diff/86400)}d ago` : `לפני ${Math.floor(diff/86400)} ימים`
  return new Date(dateStr).toLocaleDateString('he-IL', { day:'numeric', month:'numeric' })
}




function avatarColors(name) {
  const palette = ['#8490D8','#D9626E','#3BAF7E','#E08C3A','#3A8FC7','#C2497E','#5C8AE0','#22C55E']
  return palette[(name?.charCodeAt(0) || 65) % palette.length]
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function fmtPhone(phone) {
  if (!phone) return ''
  const d = String(phone).replace(/\D/g, '')
  if (d.startsWith('972') && d.length === 12) return '0' + d.slice(3, 5) + '-' + d.slice(5, 8) + '-' + d.slice(8)
  return phone
}

// Meta's "Lead Ads Testing" tool fills every field with "<test lead: dummy data for …>"
const isTestLead = l => /<test lead|dummy data for/i.test(`${l?.name || ''} ${l?.email || ''}`)

// Group label for the lead list: today / yesterday / this week / month name
function dayGroup(dateStr, lang) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((start - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (diffDays <= 0) return lang === 'en' ? 'Today' : 'היום'
  if (diffDays === 1) return lang === 'en' ? 'Yesterday' : 'אתמול'
  if (diffDays < 7) return lang === 'en' ? 'This week' : 'השבוע'
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { month: 'long', year: 'numeric' })
}
// When a lead came in: relative today, "14.7 · 09:17" this year, "14.7.25" before
function fmtWhen(dateStr, lang) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  if (Date.now() - d < 86400000) return timeAgo(dateStr, lang)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  const date = d.toLocaleDateString('he-IL', sameYear ? { day: 'numeric', month: 'numeric' } : { day: 'numeric', month: 'numeric', year: '2-digit' })
  return sameYear ? `${date} · ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}` : date
}
function fmtFull(dateStr, lang) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Narrow screens (phones): the list and the lead are separate screens
function useNarrow(px = 900) {
  const q = `(max-width: ${px}px)`
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false)
  useEffect(() => {
    if (!window.matchMedia) return
    const m = window.matchMedia(q)
    const on = () => setNarrow(m.matches)
    m.addEventListener ? m.addEventListener('change', on) : m.addListener(on)
    return () => { m.removeEventListener ? m.removeEventListener('change', on) : m.removeListener(on) }
  }, [q])
  return narrow
}

function isNewRecent(lead) {
  if (lead.status !== 'new') return false
  return (Date.now() - new Date(lead.created_at)) < 86400000
}

// ── API calls ─────────────────────────────────────────────────────────────────
// Both are polled (30 s / 15 s) and the leads list is ~90 KB: conditional requests, so an unchanged answer is an
// empty 304 (Vercel meters every byte a function sends — see CLAUDE.md, Fast Origin Transfer)
const _etags = new Map()   // url → { etag, data }
async function condGet(url) {
  const prev = _etags.get(url)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, ...(prev ? { 'If-None-Match': prev.etag } : {}) } })
  if (res.status === 304 && prev) return prev.data
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`HTTP ${res.status}${body.error ? ': ' + body.error : ''}`)
  }
  const data = await res.json()
  const etag = res.headers.get('etag')
  if (etag) _etags.set(url, { etag, data }); else _etags.delete(url)
  return data
}
async function fetchLeads() {
  const data = await condGet('/api/meta/leads')
  return data.leads || []
}

async function fetchMessages(leadId) {
  const data = await condGet(`/api/meta/messages?lead_id=${leadId}`)
  return data.messages || []
}

async function syncLeads(pageId) {
  const url = pageId ? `/api/meta/sync?page_id=${encodeURIComponent(pageId)}` : `/api/meta/sync`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Is an element narrower than a limit? (state changes only when the answer does — a drag doesn't re-render per pixel)
function useNarrowerThan(limit) {
  const [narrow, setNarrow] = useState(false)
  const limitRef = useRef(limit)
  limitRef.current = limit
  const el = useRef(null), ro = useRef(null)
  const check = useCallback(() => { if (el.current) { const w = el.current.getBoundingClientRect().width; setNarrow(w > 0 && w < limitRef.current) } }, [])
  const ref = useCallback(node => {
    ro.current?.disconnect(); el.current = node
    if (!node) return
    ro.current = new ResizeObserver(check)
    ro.current.observe(node)
  }, [check])
  useEffect(() => { check() }, [limit, check])
  useEffect(() => () => ro.current?.disconnect(), [])
  return [ref, narrow]
}

// The Lead Center's pane sizes (dragged by the user), kept in this browser
const LAYOUT_KEY = 'afik_lc_layout_v1'
const LAYOUT_DEFAULT = { list: 360, aside: 320, kpis: true }
const LIMITS = { list: [260, 640], aside: [260, 560] }
function loadLayout() {
  try { return { ...LAYOUT_DEFAULT, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}') } } catch { return { ...LAYOUT_DEFAULT } }
}

// A draggable edge between two panes, like an editor's: drag with the mouse / finger, arrows (Shift = bigger steps),
// Home / End, double-click or Enter to reset. While dragging only a CSS variable changes (no React render per pixel);
// the size is committed when the drag ends.
function Splitter({ value, min, max, grows, varName, hostRef, onCommit, onReset, label, wide = false }) {
  const drag = useRef(null)
  const clamp = v => Math.round(Math.min(max(), Math.max(min, v)))
  const set = v => hostRef.current?.style.setProperty(varName, `${v}px`)
  const end = e => {
    if (!drag.current) return
    const v = drag.current.last
    drag.current = null
    document.body.classList.remove('lc-resizing')
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    onCommit(v)
  }
  const key = e => {
    const step = e.shiftKey ? 64 : 16
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const v = clamp(value + (e.key === 'ArrowRight' ? 1 : -1) * grows * step); set(v); onCommit(v) }
    else if (e.key === 'Home') { e.preventDefault(); set(min); onCommit(min) }
    else if (e.key === 'End') { e.preventDefault(); const v = clamp(Infinity); set(v); onCommit(v) }
    else if (e.key === 'Enter') { e.preventDefault(); onReset() }
  }
  return (
    <div role="separator" aria-orientation="vertical" aria-label={label} title={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={Math.round(max())} tabIndex={0}
      className={`lc-split${wide ? ' wide' : ''}`}
      onPointerDown={e => {
        if (e.button !== 0) return
        e.preventDefault()
        drag.current = { x: e.clientX, v: value, last: value }
        e.currentTarget.setPointerCapture(e.pointerId)
        document.body.classList.add('lc-resizing')
      }}
      onPointerMove={e => { if (!drag.current) return; const v = clamp(drag.current.v + (e.clientX - drag.current.x) * grows); drag.current.last = v; set(v) }}
      onPointerUp={end} onPointerCancel={end} onDoubleClick={onReset} onKeyDown={key}/>
  )
}

const PATCH = (body) => fetch('/api/meta/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` }, body: JSON.stringify(body) })

// ── Main component ────────────────────────────────────────────────────────────
export default function MetaLeadsTab({ C, lang, isDark, onSaveToCRM, onOpenChat, onNewLead, onNewMetaMessage, onSentMetaMessage, crmLeads = [], autoConfig = null, onAutoConfigSaved }) {
  const t = TR[lang] || TR.he
  const dir = lang === 'en' ? 'ltr' : 'rtl'

  const [leads, setLeads]               = useState([])
  const [messages, setMessages]         = useState([])        // the Lead Center's own log (meta_messages) of the open lead
  const [selectedId, setSelectedId]     = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState(null)
  const [search, setSearch]             = useState('')
  const [noteInput, setNoteInput]       = useState('')
  const [callTimeInput, setCallTimeInput] = useState('')
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [syncing, setSyncing]           = useState(false)
  const [syncResult, setSyncResult]     = useState(null)
  const [noteState, setNoteState]       = useState('')        // '' | 'saving' | 'saved' | 'failed'
  const [copiedKey, setCopiedKey]       = useState('')
  const [leadsError, setLeadsError]     = useState(null)
  const [savedToCRM, setSavedToCRM]     = useState(false)
  const [hideTest, setHideTest]         = useState(true)       // Meta's "lead ads testing" leads (dummy data)
  const [deletedLeads, setDeletedLeads] = useState([])
  const [showRestore, setShowRestore]   = useState(false)
  const [campaignDropOpen, setCampaignDropOpen] = useState(false)
  const [sortOrder, setSortOrder]       = useState('desc')     // 'desc' = newest first
  const [metaView, setMetaView]         = useState('chat')     // 'chat' (the Lead Center) | 'pipeline'
  const [pane, setPane]                 = useState('chat')     // one-pane layout: 'chat' | 'info'
  const [layout, setLayout]             = useState(loadLayout)   // dragged pane sizes + the KPI strip on / off
  const [focusChat, setFocusChat]       = useState(false)    // the conversation on the whole screen
  const [chatFirstOut, setChatFirstOut] = useState(null)     // our first message in the WhatsApp chat (any source)
  const saveLayout = useCallback(patch => setLayout(prev => { const next = { ...prev, ...patch }; try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(next)) } catch {} return next }), [])
  const rootRef = useRef(null), bodyRef = useRef(null), detailBoxRef = useRef(null)
  useEffect(() => {
    if (!focusChat) return
    const k = e => { if (e.key === 'Escape') setFocusChat(false) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [focusChat])
  useEffect(() => { setChatFirstOut(null); if (!selectedId) setFocusChat(false) }, [selectedId])
  // "Last time the user opened the Lead Center" — used to badge new leads on the toggle button.
  const [lastVisitTs, setLastVisitTs] = useState(() => {
    try { return Number(localStorage.getItem('meta_chat_last_visit_v1')) || Date.now() } catch { return Date.now() }
  })

  const selectedLead = useMemo(() => leads.find(l => l.id === selectedId) || null, [leads, selectedId])
  const patchLead = useCallback((id, changes) => setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...changes } : l))), [])
  const selectLead = useCallback(id => { setSelectedId(id); setPane('chat') }, [])

  const leadsIntervalRef      = useRef(null)
  const messagesIntervalRef   = useRef(null)
  const connIntervalRef       = useRef(null)
  const campaignDropRef       = useRef(null)
  const knownLeadIdsRef       = useRef(null)
  const knownMsgIdsRef        = useRef(new Map()) // leadId → Set<msgId>
  const leadsRef              = useRef(leads)
  const onNewLeadRef          = useRef(onNewLead)
  const onNewMetaMsgRef       = useRef(onNewMetaMessage)
  const onSentMetaMsgRef      = useRef(onSentMetaMessage)
  useEffect(() => { leadsRef.current = leads }, [leads])
  useEffect(() => { onNewLeadRef.current     = onNewLead         }, [onNewLead])
  useEffect(() => { onNewMetaMsgRef.current  = onNewMetaMessage  }, [onNewMetaMessage])
  useEffect(() => { onSentMetaMsgRef.current = onSentMetaMessage }, [onSentMetaMessage])

  // Track deleted lead IDs so Realtime/polling never brings them back
  const deletedIdsRef = useRef(new Set())
  useEffect(() => { deletedIdsRef.current = new Set(deletedLeads.map(l => l.id)) }, [deletedLeads])

  // ── Load leads ──────────────────────────────────────────────────────────────
  const loadLeads = useCallback(async (silent = false) => {
    if (!silent) setLoadingLeads(true)
    setLeadsError(null)
    try {
      const data = await fetchLeads()
      const visible = data.filter(l => !deletedIdsRef.current.has(l.id))
      setLeads(visible)
      if (knownLeadIdsRef.current === null) {
        knownLeadIdsRef.current = new Set(visible.map(l => l.id))
      } else {
        const newLeads = visible.filter(l => !knownLeadIdsRef.current.has(l.id))
        newLeads.forEach(l => knownLeadIdsRef.current.add(l.id))
        if (newLeads.length && onNewLeadRef.current) onNewLeadRef.current({ name: newLeads[0].name, campaign: newLeads[0].campaign_name || newLeads[0].form_name })
      }
    } catch (e) {
      setLeadsError(e.message)
    } finally {
      setLoadingLeads(false)
    }
  }, [])

  // ── The open lead's log (meta_messages) — merged into the WhatsApp conversation ──
  const loadMessages = useCallback(async (leadId, silent = false) => {
    if (!leadId) return
    try {
      const data = await fetchMessages(leadId)
      setMessages(data)
      const known = knownMsgIdsRef.current.get(leadId)
      if (!known) { knownMsgIdsRef.current.set(leadId, new Set(data.map(m => m.id))); return }
      const newIn = data.filter(m => m.direction === 'in' && m.id && !known.has(m.id))
      data.forEach(m => { if (m.id) known.add(m.id) })
      if (newIn.length && silent && onNewMetaMsgRef.current) {
        const lead = leadsRef.current.find(l => l.id === leadId)
        onNewMetaMsgRef.current({ leadName: lead?.name || '—', message: newIn[newIn.length - 1].message })
      }
    } catch { /* the WhatsApp history is the main source; the log is a fallback */ }
  }, [])

  const loadDeletedLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/meta/leads?deleted=1', { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } })
      if (!res.ok) return
      const data = await res.json()
      setDeletedLeads(data.leads || [])
    } catch {}
  }, [])

  // ── Initial load + Realtime subscription for leads ──────────────────────────
  useEffect(() => {
    localStorage.removeItem('meta_deleted_leads')   // one-time: the old browser-only archive
    loadLeads()
    loadDeletedLeads()
    if (!supabase) {
      leadsIntervalRef.current = setInterval(() => { if (!document.hidden) loadLeads(true) }, 30000)
      return () => clearInterval(leadsIntervalRef.current)
    }
    const channel = supabase
      .channel('meta_leads_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meta_leads' }, (payload) => {
        const { eventType, new: next, old } = payload
        if (eventType === 'INSERT') {
          if (deletedIdsRef.current.has(next.id)) return
          setLeads(prev => {
            if (prev.some(l => l.id === next.id)) return prev
            if (!knownLeadIdsRef.current?.has(next.id)) { knownLeadIdsRef.current?.add(next.id); onNewLeadRef.current?.({ name: next.name, campaign: next.campaign_name || next.form_name }) }
            return [next, ...prev]
          })
        } else if (eventType === 'UPDATE') {
          if (deletedIdsRef.current.has(next.id)) return
          setLeads(prev => prev.map(l => (l.id === next.id ? { ...l, ...next } : l)))
        } else if (eventType === 'DELETE') {
          setLeads(prev => prev.filter(l => l.id !== old.id))
          setSelectedId(id => (id === old.id ? null : id))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadLeads, loadDeletedLeads])

  // ── The open lead's log: Realtime, or a poll when Realtime isn't configured ──
  useEffect(() => {
    clearInterval(messagesIntervalRef.current)
    setMessages([])
    if (!selectedId) return
    loadMessages(selectedId)
    if (!supabase) {
      messagesIntervalRef.current = setInterval(() => { if (!document.hidden) loadMessages(selectedId, true) }, 15000)
      return () => clearInterval(messagesIntervalRef.current)
    }
    const channel = supabase
      .channel(`meta_messages_${selectedId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meta_messages', filter: `lead_id=eq.${selectedId}` }, (payload) => {
        const msg = payload.new
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]))
        const known = knownMsgIdsRef.current.get(selectedId)
        if (msg.direction === 'in' && known && !known.has(msg.id)) {
          known.add(msg.id)
          const lead = leadsRef.current.find(l => l.id === selectedId)
          onNewMetaMsgRef.current?.({ leadName: lead?.name || '—', message: msg.message })
        }
      })
      .subscribe()
    return () => { clearInterval(messagesIntervalRef.current); supabase.removeChannel(channel) }
  }, [selectedId, loadMessages])

  // ── Connection status (Meta token + page subscription + last webhook + WhatsApp + welcome rule) ──
  // The safety-net sync runs on the server (auto-run every 5 min from the panel, the 5-minute GitHub tick, the daily
  // cron), so the tab only reads the status — every 10 minutes and after a manual sync.
  const [conn, setConn] = useState(null)
  const loadConn = useCallback(() => {
    fetch('/api/meta/connect?quick=1&green=1', { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } })
      .then(r => r.json()).then(setConn).catch(() => setConn({ error: true }))
  }, [])
  useEffect(() => {
    loadConn()
    connIntervalRef.current = setInterval(() => { if (!document.hidden) loadConn() }, 10 * 60 * 1000)
    return () => clearInterval(connIntervalRef.current)
  }, [loadConn])

  // ── The open lead's notes ───────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedLead) return
    setNoteInput(selectedLead.notes || '')
    setCallTimeInput(selectedLead.call_time || '')
    setSavedToCRM(false); setNoteState('')
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!campaignDropOpen) return
    const handler = (e) => { if (campaignDropRef.current && !campaignDropRef.current.contains(e.target)) setCampaignDropOpen(false) }
    const esc = e => { if (e.key === 'Escape') setCampaignDropOpen(false) }
    document.addEventListener('mousedown', handler); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', esc) }
  }, [campaignDropOpen])

  // ── Send (from the conversation) → { ok, error?, quota? } ────────────────────
  const handleSend = useCallback(async (text) => {
    const lead = leadsRef.current.find(l => l.id === selectedId)
    if (!lead) return { ok: false }
    try {
      const res = await fetch('/api/meta/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` }, body: JSON.stringify({ lead_id: lead.id, message: text }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, error: d.error || `HTTP ${res.status}`, quota: !!d.quota }
      if (!lead.wa_sent) patchLead(lead.id, { wa_sent: true })
      if (d.message) {
        setMessages(prev => (prev.some(m => m.id === d.message.id) ? prev : [...prev, d.message]))
        knownMsgIdsRef.current.get(lead.id)?.add(d.message.id)
      }
      onSentMetaMsgRef.current?.({ leadName: lead.name || '—', message: text })
      return { ok: true }
    } catch (e) { return { ok: false, error: e.message } }
  }, [selectedId, patchLead])

  // ── The welcome, in the wording picked in the conversation (counts as the welcome: wa_sent + the automation log) ──
  const handleWelcome = useCallback(async (text, templateId) => {
    const lead = leadsRef.current.find(l => l.id === selectedId)
    if (!lead?.phone) return { ok: false }
    try {
      const r = await fetch('/api/meta/lead-welcome', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` }, body: JSON.stringify({ id: lead.id, text, templateId }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) return { ok: false, error: d.error || d.skipped || `HTTP ${r.status}`, quota: !!d.quota }
      patchLead(lead.id, { wa_sent: true })
      loadMessages(lead.id, true)
      onSentMetaMsgRef.current?.({ leadName: lead.name || '—', message: d.text || text })
      return { ok: true }
    } catch (e) { return { ok: false, error: e.message } }
  }, [selectedId, patchLead, loadMessages])

  // ── Sync ─────────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      // The server syncs the office's own pages (META_PAGE_IDS) and welcomes only fresh leads
      const r = await syncLeads()
      const fresh = r.new || 0
      setSyncResult({ ok: true, text: fresh ? `${fresh} ${lang === 'en' ? 'new leads' : 'לידים חדשים'}` : (lang === 'en' ? 'Up to date' : 'הכל מעודכן') })
      await loadLeads(true)
      loadConn()
    } catch (e) {
      setSyncResult({ ok: false, text: lang === 'en' ? 'Sync failed: ' + e.message : 'הסנכרון נכשל: ' + e.message })
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncResult(null), 5000)
    }
  }

  // ── Status, notes, CRM, archive ──────────────────────────────────────────────
  const handleStatusChange = (status) => {
    if (!selectedLead) return
    patchLead(selectedLead.id, { status })
    PATCH({ id: selectedLead.id, status }).catch(() => {})
  }
  const handleSaveNotes = async () => {
    if (!selectedLead) return
    const id = selectedLead.id
    setNoteState('saving')
    patchLead(id, { notes: noteInput, call_time: callTimeInput })
    try {
      const r = await PATCH({ id, notes: noteInput, call_time: callTimeInput })
      setNoteState(r.ok ? 'saved' : 'failed')
    } catch { setNoteState('failed') }
    setTimeout(() => setNoteState(s => (s === 'saved' ? '' : s)), 2000)
  }
  const handleSaveToCRM = () => {
    if (!selectedLead) return
    const lead = selectedLead
    if (lead.status === 'saved_to_crm') {   // toggle: undo
      patchLead(lead.id, { status: 'contacted' })
      PATCH({ id: lead.id, status: 'contacted' }).catch(() => {})
      return
    }
    patchLead(lead.id, { status: 'saved_to_crm' })
    setSavedToCRM(true)
    PATCH({ id: lead.id, status: 'saved_to_crm' }).catch(() => {})
    setTimeout(() => { setSavedToCRM(false); onSaveToCRM?.(lead) }, 500)
  }
  const archiveLead = (lead) => {
    const now = new Date().toISOString()
    setLeads(prev => prev.filter(l => l.id !== lead.id))
    setDeletedLeads(prev => [{ ...lead, deleted_at: now }, ...prev])
    if (selectedId === lead.id) setSelectedId(null)
    PATCH({ id: lead.id, deleted_at: now }).catch(() => {})
  }
  const handleRestoreLead = (lead) => {
    const { deleted_at, ...restored } = lead
    setLeads(prev => [restored, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    setDeletedLeads(prev => prev.filter(l => l.id !== lead.id))
    PATCH({ id: lead.id, deleted_at: null }).catch(() => {})
  }
  const handleRestoreAll = async () => {
    const toRestore = [...deletedLeads]
    if (!toRestore.length) return
    setLeads(prev => {
      const existing = new Set(prev.map(l => l.id))
      return [...toRestore.filter(l => !existing.has(l.id)).map(({ deleted_at, ...l }) => l), ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    })
    setDeletedLeads([])
    setShowRestore(false)
    await Promise.all(toRestore.map(lead => PATCH({ id: lead.id, deleted_at: null }).catch(() => {})))
  }
  const copy = (key, value) => {
    navigator.clipboard?.writeText(String(value)).then(() => { setCopiedKey(key); setTimeout(() => setCopiedKey(''), 1500) }).catch(() => {})
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const getCampaignLabel = (l) => l.campaign_name || l.form_name || null
  const shortLabel = l => { const c = getCampaignLabel(l); return c ? (shortCampaign(c) || c) : null }
  const campaigns = useMemo(() => [...new Set(leads.map(getCampaignLabel).filter(Boolean))], [leads])

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase()
    const qd = q.replace(/\D/g, '')
    return leads
      .filter(l => {
        if (statusFilter !== 'all' && (l.status || 'new') !== statusFilter) return false
        if (campaignFilter && getCampaignLabel(l) !== campaignFilter) return false
        if (hideTest && isTestLead(l)) return false
        if (!q) return true
        if ([l.name, l.email, l.campaign_name, l.form_name].filter(Boolean).some(s => s.toLowerCase().includes(q))) return true
        // a phone typed any way (050-…, 972…) matches by its digits
        return qd.length >= 3 && String(l.phone || '').replace(/\D/g, '').replace(/^972/, '0').includes(qd.replace(/^972/, '0'))
      })
      .sort((a, b) => (sortOrder === 'desc' ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.created_at) - new Date(b.created_at)))
  }, [leads, statusFilter, campaignFilter, hideTest, search, sortOrder])

  const BORDER  = 'rgba(var(--brand-rgb),.14)'
  const MUTED   = 'rgba(var(--ink),.6)'
  const FAINT   = 'rgba(var(--ink),.45)'
  const CREAM   = 'var(--au-text)'
  const BRAND   = 'var(--au-brand-text)'

  const statusTabs = [
    { id: 'all',       label: t.filterAll },
    { id: 'new',       label: t.filterNew },
    { id: 'contacted', label: t.filterContacted },
    { id: 'scheduled', label: t.filterScheduled },
    { id: 'closed',    label: t.filterClosed },
    { id: 'saved_to_crm', label: STATUS_CONFIG.saved_to_crm.label[lang] || STATUS_CONFIG.saved_to_crm.label.he },
  ]
  const inChat = metaView === 'chat'
  const unreadCount = inChat ? 0 : leads.reduce((n, l) => { const ts = new Date(l.created_at).getTime(); return Number.isFinite(ts) && ts > lastVisitTs ? n + 1 : n }, 0)
  function handleViewToggle() {
    if (!inChat) {
      const now = Date.now()
      setLastVisitTs(now)
      try { localStorage.setItem('meta_chat_last_visit_v1', String(now)) } catch {}
    }
    setMetaView(inChat ? 'pipeline' : 'chat')
  }

  // KPIs (test leads excluded)
  const realLeads   = useMemo(() => leads.filter(l => !isTestLead(l)), [leads])
  const dayStart    = new Date(); dayStart.setHours(0, 0, 0, 0)
  const ageMs       = l => Date.now() - new Date(l.created_at).getTime()
  const todayLeads  = realLeads.filter(l => new Date(l.created_at) >= dayStart).length
  const weekLeads   = realLeads.filter(l => ageMs(l) < 7 * 86400000).length
  const waitingN    = realLeads.filter(l => (l.status || 'new') === 'new').length
  const welcomed    = realLeads.filter(l => l.wa_sent).length
  const withPhone   = realLeads.filter(l => l.phone).length
  const testCount   = leads.length - realLeads.length
  const attention   = realLeads.filter(l => (l.status || 'new') === 'new' && ageMs(l) < 14 * 86400000).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8)
  const recentByCampaign = Object.entries(realLeads.filter(l => ageMs(l) < 30 * 86400000).reduce((m, l) => { const k = shortLabel(l) || '—'; m[k] = (m[k] || 0) + 1; return m }, {})).sort((a, b) => b[1] - a[1])
  const maxCamp = Math.max(1, ...recentByCampaign.map(x => x[1]))

  // Connection health
  const tokenOk = !!conn?.meta?.token?.ok
  const pageOk = tokenOk && (conn?.meta?.pageChecks || []).length > 0 && conn.meta.pageChecks.every(p => p.leadgenSubscribed)
  const waOk = conn?.green?.state === 'authorized'
  const welcomeOn = conn?.welcome ? (conn.welcome.enabled && conn.welcome.mode === 'auto') : null
  const connState = !conn ? 'idle' : conn.error ? 'warn' : tokenOk && pageOk ? 'ok' : 'bad'
  const waPhone = conn?.green?.phone ? fmtPhone(conn.green.phone) : ''
  const lastLeadAt = realLeads.reduce((m, l) => (new Date(l.created_at) > new Date(m || 0) ? l.created_at : m), null)

  // Layout: phones get the list or the lead; a narrow detail pane gets one pane at a time
  const narrow = useNarrow(900)
  const showList = !narrow || !selectedLead
  const showDetail = !narrow || !!selectedLead
  // side by side while the conversation keeps at least 380 px next to the details
  const [detailRef, detailNarrow] = useNarrowerThan(layout.aside + 14 + 380 + 28)
  const onePane = narrow || detailNarrow

  const answers = useMemo(() => (selectedLead ? metaFormAnswers(selectedLead.raw_fields, lang) : []), [selectedLead, lang])
  const answersHe = useMemo(() => (selectedLead ? metaFormAnswers(selectedLead.raw_fields, 'he') : []), [selectedLead])
  // the CRM copy of this lead (lib/meta-crm.js) — what the office typed there personalises the templates
  const crmLead = useMemo(() => {
    if (!selectedLead) return null
    const tail = String(selectedLead.phone || '').replace(/\D/g, '').slice(-9)
    return crmLeads.find(l => String(l?.crm_data?.metaLeadId || '') === String(selectedLead.id))
      || (tail.length === 9 ? crmLeads.find(l => String(l?.phone || '').replace(/\D/g, '').slice(-9) === tail) : null) || null
  }, [crmLeads, selectedLead])
  const tplLead = useMemo(() => templateLead(selectedLead, crmLead, answersHe), [selectedLead, crmLead, answersHe])
  const firstOutAt = chatFirstOut || messages.find(m => m.direction === 'out')?.created_at || null
  // What the conversation shows: our messages are there (sent from the chats tab, say) → the lead was contacted
  const onActivity = useCallback(({ hasOut, firstOutAt: at }) => {
    setChatFirstOut(at || null)
    const lead = leadsRef.current.find(l => l.id === selectedId)
    if (hasOut && lead && !lead.wa_sent) { patchLead(lead.id, { wa_sent: true }); PATCH({ id: lead.id, wa_sent: true }).catch(() => {}) }
  }, [selectedId, patchLead])
  const crmButton = selectedLead && (
    <button className="lc-btn" onClick={handleSaveToCRM} style={{ color: selectedLead.status === 'saved_to_crm' ? '#0E9AA7' : CREAM }}>{selectedLead.status === 'saved_to_crm' ? (lang === 'en' ? '✓ In CRM · Undo' : '✓ ב-CRM · בטל') : savedToCRM ? t.savedToCRM : t.saveToCRM}</button>
  )

  const listItems = []
  let lastGroup = null
  for (const lead of filteredLeads) {
    const g = sortOrder === 'desc' ? dayGroup(lead.created_at, lang) : null
    if (g && g !== lastGroup) { listItems.push({ type: 'g', key: `g-${g}-${lead.id}`, label: g }); lastGroup = g }
    listItems.push({ type: 'l', key: lead.id, lead })
  }

  const dotColor = s => (s === 'ok' ? '#22C55E' : s === 'bad' ? '#E5484D' : s === 'warn' ? '#F59E0B' : 'rgba(var(--ink),.3)')
  const Dot = ({ s }) => <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor(s), flexShrink: 0, boxShadow: s === 'ok' ? '0 0 0 3px rgba(34,197,94,.18)' : 'none' }}/>
  const Avatar = ({ lead, size = 40 }) => {
    const color = avatarColors(lead?.name)
    return <div aria-hidden style={{ width: size, height: size, borderRadius: Math.round(size * .3), background: `${color}22`, border: `1.5px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * .33), fontWeight: 800, color, flexShrink: 0 }}>{isTestLead(lead) ? '🧪' : initials(lead?.name)}</div>
  }
  const welcomeChip = lead => !lead.phone ? null : lead.wa_sent
    ? <span className="lc-chip ok">✓ {t.kWelcomeShort}</span>
    : <span className="lc-chip warn">{lang === 'en' ? 'No message yet' : 'טרם נשלחה הודעה'}</span>

  const kpis = [
    { label: t.kTotal, value: realLeads.length, color: BRAND },
    { label: t.kToday, value: todayLeads, color: '#3A8FC7' },
    { label: t.kWeek, value: weekLeads, color: '#8B5CF6' },
    { label: t.kWaiting, value: waitingN, color: '#E5484D', onClick: () => { setStatusFilter('new'); setSelectedId(null); setMetaView('chat') } },
    { label: t.kWelcome, value: welcomed, sub: withPhone ? `${Math.round(welcomed / withPhone * 100)}%` : '', color: '#16A34A' },
  ]

  return (
    <div ref={rootRef} className="lc" style={{ display: 'flex', height: '100%', overflow: 'hidden', direction: dir, fontFamily: 'Rubik, sans-serif', background: 'var(--au-bg)', flexDirection: 'column', '--lc-list': `${layout.list}px`, '--lc-aside': `${layout.aside}px` }}>
      <style>{`
        .lc button{font-family:inherit}
        .lc :focus-visible{outline:2px solid var(--au-brand);outline-offset:2px}
        .lc-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:0 13px;border-radius:9px;border:1px solid ${BORDER};background:rgba(var(--ov),.04);color:${CREAM};font-size:12.5px;font-weight:700;cursor:pointer;transition:background .12s,border-color .12s;white-space:nowrap;text-decoration:none}
        .lc-btn:hover:not(:disabled){background:rgba(var(--brand-rgb),.12);border-color:rgba(var(--brand-rgb),.35)}
        .lc-btn:disabled{opacity:.5;cursor:not-allowed}
        .lc-btn.primary{background:var(--au-brand);border-color:transparent;color:#fff}
        .lc-btn.primary:hover:not(:disabled){filter:brightness(1.08);background:var(--au-brand)}
        .lc-btn.wa{background:rgba(37,211,102,.12);border-color:rgba(37,211,102,.4);color:#15803D}
        html[data-admin-theme="dark"] .lc-btn.wa{color:#5BE38E}
        .lc-btn.danger{color:#DC2626;border-color:rgba(229,72,77,.3);background:rgba(229,72,77,.06)}
        html[data-admin-theme="dark"] .lc-btn.danger{color:#F87171}
        .lc-btn.icon{padding:0;width:34px}
        .lc-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;line-height:1.6}
        .lc-chip.ok{color:#15803D;background:rgba(34,197,94,.13)} html[data-admin-theme="dark"] .lc-chip.ok{color:#4ADE80}
        .lc-chip.warn{color:#B45309;background:rgba(245,158,11,.14)} html[data-admin-theme="dark"] .lc-chip.warn{color:#FBBF24}
        .lc-row{display:flex;gap:11px;align-items:flex-start;padding:11px 14px;border-bottom:1px solid rgba(var(--ov),.06);cursor:pointer;position:relative;transition:background .1s;contain:layout style;width:100%;background:none;border-inline:none;border-top:none;text-align:start;color:inherit}
        .lc-row:hover{background:rgba(var(--brand-rgb),.06)}
        .lc-row.sel{background:rgba(var(--brand-rgb),.13)}
        .lc-row.sel::before{content:'';position:absolute;inset-inline-start:0;top:0;bottom:0;width:3px;background:var(--au-brand)}
        .lc-row .lc-arch{opacity:0;transition:opacity .12s}
        .lc-row:hover .lc-arch,.lc-row:focus-within .lc-arch{opacity:1}
        @media (hover:none){.lc-row .lc-arch{display:none}}
        .lc-tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
        .lc-tabs::-webkit-scrollbar{display:none}
        .lc-tab{flex-shrink:0;min-height:30px;padding:0 11px;border-radius:999px;border:1px solid transparent;background:transparent;color:${MUTED};font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;gap:5px;align-items:center}
        .lc-tab.on{background:rgba(var(--brand-rgb),.14);border-color:rgba(var(--brand-rgb),.35);color:${BRAND}}
        .lc-card{background:var(--au-card-solid);border:1px solid ${BORDER};border-radius:14px}
        .lc-seg{display:inline-flex;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;max-width:100%}
        .lc-seg button{min-height:32px;padding:0 12px;border:none;background:transparent;color:${MUTED};font-size:12px;font-weight:700;cursor:pointer;border-inline-start:1px solid ${BORDER};white-space:nowrap}
        .lc-seg button:first-child{border-inline-start:none}
        .lc-input{width:100%;box-sizing:border-box;padding:9px 12px;background:rgba(var(--ov),.04);border:1px solid ${BORDER};border-radius:10px;color:${CREAM};font-size:13px;font-family:inherit;outline:none}
        .lc-input:focus{border-color:rgba(var(--brand-rgb),.55);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.15)}
        .lc-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
        .lc-label{font-size:11.5px;font-weight:700;color:${FAINT};letter-spacing:.02em}
        .lc-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:12px}
        .lc-kpi{padding:9px 12px;text-align:start;font:inherit;color:inherit}
        @media (max-width:900px){.lc-kpis{display:flex;overflow-x:auto;scrollbar-width:none}.lc-kpis::-webkit-scrollbar{display:none}.lc-kpi{flex:0 0 auto;min-width:118px}}
        .lc-split{flex:0 0 8px;margin-inline:-4px;cursor:col-resize;position:relative;z-index:6;touch-action:none;outline:none}
        .lc-split.wide{flex-basis:14px;margin-inline:0}
        .lc-split::before{content:'';position:absolute;top:0;bottom:0;left:50%;width:2px;transform:translateX(-50%);border-radius:2px;background:transparent;transition:background .15s}
        .lc-split::after{content:'';position:absolute;top:50%;left:50%;width:4px;height:28px;transform:translate(-50%,-50%);border-radius:3px;background:rgba(var(--ink),.18);opacity:0;transition:opacity .15s}
        .lc-split:hover::before,.lc-split:focus-visible::before{background:rgba(var(--brand-rgb),.55)}
        .lc-split:hover::after,.lc-split:focus-visible::after,.lc-split.wide::after{opacity:1}
        body.lc-resizing,body.lc-resizing *{cursor:col-resize!important;user-select:none!important}
        body.lc-resizing iframe{pointer-events:none}
      `}</style>

      {/* ── Header: title, connection, actions, KPIs (on a phone only above the list) ── */}
      {(!narrow || !selectedLead) && !(focusChat && selectedLead) && (
        <div style={{ flexShrink: 0, borderBottom: `1px solid ${BORDER}`, padding: narrow ? '12px 14px 10px' : '14px 18px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 260px' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: CREAM, lineHeight: 1.2 }}>{lang === 'en' ? 'Lead Center' : 'מרכז לידים'}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5, flexWrap: 'wrap', fontSize: 12, color: MUTED }}>
                <Dot s={connState}/>
                <span style={{ fontWeight: 600 }}>{!conn ? t.connChecking : connState === 'ok' ? t.connOk : conn.error ? t.connChecking : !tokenOk ? t.connToken : t.connPage}</span>
                {conn && !conn.error && <><span style={{ color: FAINT }}>·</span><Dot s={waOk ? 'ok' : 'bad'}/><span>{waOk ? t.waOk(waPhone) : t.waBad}</span></>}
                {welcomeOn !== null && <><span style={{ color: FAINT }}>·</span><span style={{ color: welcomeOn ? '#16A34A' : '#D97706', fontWeight: 700 }}>{welcomeOn ? t.welcomeAuto : t.welcomeOff}</span></>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {syncResult && <span role="status" className={`lc-chip ${syncResult.ok ? 'ok' : 'warn'}`}>{syncResult.text}</span>}
              <button className="lc-btn" onClick={handleSync} disabled={syncing}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? 'gm_spin .7s linear infinite' : 'none' }} aria-hidden><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                {syncing ? t.syncing : t.sync}
              </button>
              <button className="lc-btn" onClick={() => saveLayout({ kpis: !layout.kpis })} aria-expanded={layout.kpis}>{layout.kpis ? t.hideKpis : t.showKpis}</button>
              <button className="lc-btn" onClick={handleViewToggle} style={{ position: 'relative' }}>
                {inChat ? 'Pipeline' : (lang === 'en' ? 'Lead Center' : 'מרכז לידים')}
                {unreadCount > 0 && <span style={{ position: 'absolute', top: -7, insetInlineEnd: -7, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#E5484D', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
            </div>
          </div>
          {layout.kpis && <div className="lc-kpis">
            {kpis.map((k, i) => {
              const Tag = k.onClick ? 'button' : 'div'
              return (
                <Tag key={i} className="lc-card lc-kpi" onClick={k.onClick} type={k.onClick ? 'button' : undefined} style={{ cursor: k.onClick ? 'pointer' : 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: k.color, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{k.value}</span>
                    {k.sub && <span style={{ fontSize: 11.5, fontWeight: 700, color: FAINT }}>{k.sub}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginTop: 4, whiteSpace: 'nowrap' }}>{k.label}</div>
                </Tag>
              )
            })}
          </div>}
        </div>
      )}

      {/* ── Pipeline view ── */}
      {!inChat && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <MetaKanban leads={leads} initialView={metaView}
            onUpdateLead={(id, changes) => setLeads(prev => prev.map(l => String(l.id) === String(id) ? { ...l, ...changes } : l))}
            onDeleteLead={archiveLead}/>
        </div>
      )}

      {/* ── Lead Center: list + lead ── */}
      {inChat && <div ref={bodyRef} style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── List ── */}
        {showList && !(focusChat && selectedLead) && <div style={{ width: narrow ? '100%' : 'var(--lc-list)', flexShrink: 0, borderInlineEnd: narrow ? 'none' : `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', background: 'var(--au-card-solid)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} aria-label={t.search} className="lc-input" style={{ direction: dir }}/>
              <button className="lc-btn icon" aria-label={sortOrder === 'desc' ? (lang === 'en' ? 'Newest first' : 'החדשים קודם') : (lang === 'en' ? 'Oldest first' : 'הישנים קודם')} title={sortOrder === 'desc' ? (lang === 'en' ? 'Newest first' : 'החדשים קודם') : (lang === 'en' ? 'Oldest first' : 'הישנים קודם')} onClick={() => setSortOrder(v => v === 'desc' ? 'asc' : 'desc')}>{sortOrder === 'desc' ? '↓' : '↑'}</button>
              {deletedLeads.length > 0 && <button className="lc-btn danger" aria-expanded={showRestore} title={t.archive} onClick={() => setShowRestore(v => !v)} style={{ padding: '0 10px' }}>↩ {deletedLeads.length}</button>}
            </div>
            <div className="lc-tabs" role="tablist">
              {statusTabs.map(tab => {
                const n = tab.id === 'all' ? null : leads.filter(l => (l.status || 'new') === tab.id && (!hideTest || !isTestLead(l))).length
                if (tab.id === 'saved_to_crm' && !n) return null
                return (
                  <button key={tab.id} role="tab" aria-selected={statusFilter === tab.id} className={`lc-tab${statusFilter === tab.id ? ' on' : ''}`} onClick={() => setStatusFilter(tab.id)}>
                    {tab.label}{n ? <span style={{ opacity: .75, fontFeatureSettings: '"tnum"' }}>{n}</span> : null}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div ref={campaignDropRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <button className="lc-btn" aria-haspopup="listbox" aria-expanded={campaignDropOpen} onClick={() => setCampaignDropOpen(v => !v)} style={{ width: '100%', justifyContent: 'space-between', color: campaignFilter ? BRAND : CREAM }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{campaignFilter ? (shortCampaign(campaignFilter) || campaignFilter) : (lang === 'en' ? 'All campaigns' : 'כל הקמפיינים')}</span>
                  <span aria-hidden style={{ fontSize: 9, opacity: .7 }}>{campaignDropOpen ? '▲' : '▼'}</span>
                </button>
                {campaignDropOpen && (
                  <div role="listbox" className="lc-card lc-scroll" style={{ position: 'absolute', top: 'calc(100% + 4px)', insetInline: 0, zIndex: 200, boxShadow: '0 12px 32px rgba(0,0,0,.35)', maxHeight: 300 }}>
                    {[[null, lang === 'en' ? 'All campaigns' : 'כל הקמפיינים', leads.length], ...campaigns.map(c => [c, c, leads.filter(l => getCampaignLabel(l) === c).length])].map(([val, label, n], i) => (
                      <button key={label} role="option" aria-selected={campaignFilter === val} title={label} onClick={() => { setCampaignFilter(val); setCampaignDropOpen(false) }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', border: 'none', borderBottom: `1px solid rgba(var(--ov),.05)`, background: campaignFilter === val ? 'rgba(var(--brand-rgb),.12)' : 'transparent', color: campaignFilter === val ? BRAND : CREAM, fontSize: 12.5, fontWeight: campaignFilter === val ? 700 : 500, cursor: 'pointer', textAlign: 'start', direction: dir }}>
                        {val && <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAMPAIGN_COLORS[(i - 1) % CAMPAIGN_COLORS.length], flexShrink: 0 }}/>}
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val ? (shortCampaign(label) || label) : label}</span>
                        <span style={{ fontSize: 11, color: FAINT, fontWeight: 700 }}>{n}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {testCount > 0 && <button className="lc-btn" onClick={() => setHideTest(v => !v)} style={{ fontSize: 11.5, padding: '0 10px' }}>{hideTest ? `${t.showTest} (${testCount})` : t.hideTestL}</button>}
            </div>
            <div style={{ fontSize: 11.5, color: FAINT, fontWeight: 600 }}>{filteredLeads.length} {t.leadsCount}</div>
          </div>

          {showRestore && deletedLeads.length > 0 && (
            <div className="lc-scroll" style={{ flexShrink: 0, borderBottom: `1px solid ${BORDER}`, background: 'rgba(229,72,77,.04)', maxHeight: 220 }}>
              <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="lc-label">{lang === 'en' ? 'Archived' : 'ארכיון'} ({deletedLeads.length})</span>
                <button className="lc-btn" onClick={handleRestoreAll} style={{ minHeight: 28, padding: '0 10px', fontSize: 11 }}>↩ {lang === 'en' ? 'Restore all' : 'שחזר הכל'}</button>
              </div>
              {deletedLeads.map(lead => (
                <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderTop: '1px solid rgba(var(--ov),.04)' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name || '—'} <span style={{ color: FAINT }}>· {shortLabel(lead) || fmtPhone(lead.phone)}</span></span>
                  <button className="lc-btn" onClick={() => handleRestoreLead(lead)} style={{ minHeight: 28, padding: '0 10px', fontSize: 11 }}>↩ {lang === 'en' ? 'Restore' : 'שחזר'}</button>
                </div>
              ))}
            </div>
          )}

          <div className="lc-scroll" style={{ flex: 1, minHeight: 0, paddingBottom: narrow ? 90 : 12 }}>
            {loadingLeads && !leads.length && <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>{t.loading}</div>}
            {leadsError && <div role="alert" style={{ padding: 14, color: '#DC2626', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center' }}>{t.error}: {leadsError}<button className="lc-btn" onClick={() => loadLeads()} style={{ minHeight: 28 }}>↻</button></div>}
            {!loadingLeads && !leadsError && filteredLeads.length === 0 && (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ color: CREAM, fontSize: 14, fontWeight: 700 }}>{t.noLeads}</div>
                <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>{t.noLeadsDesc}</div>
              </div>
            )}
            {listItems.map(item => {
              if (item.type === 'g') return <div key={item.key} style={{ position: 'sticky', top: 0, zIndex: 1, padding: '6px 14px', fontSize: 11.5, fontWeight: 800, color: FAINT, background: 'var(--au-card-solid)', borderBottom: `1px solid rgba(var(--ov),.06)` }}>{item.label}</div>
              const lead = item.lead
              const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new
              const sel = selectedId === lead.id
              return (
                <div key={item.key} className={`lc-row${sel ? ' sel' : ''}`} role="button" tabIndex={0} aria-current={sel || undefined}
                  onClick={() => selectLead(lead.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectLead(lead.id) } }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar lead={lead}/>
                    {isNewRecent(lead) && <span style={{ position: 'absolute', bottom: -2, insetInlineEnd: -2, width: 11, height: 11, borderRadius: '50%', background: '#22C55E', border: '2px solid var(--au-card-solid)' }}/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isTestLead(lead) ? t.testLead : (lead.name || '—')}</span>
                      <span style={{ fontSize: 11, color: FAINT, flexShrink: 0, fontFeatureSettings: '"tnum"' }}>{fmtWhen(lead.created_at, lang)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={getCampaignLabel(lead) || ''}>
                      {shortLabel(lead) || '—'}{lead.phone ? <span style={{ color: FAINT, fontFeatureSettings: '"tnum"' }}> · <bdi>{fmtPhone(lead.phone)}</bdi></span> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="lc-chip" style={{ color: sc.color, background: sc.bg }}>{sc.label[lang] || sc.label.he}</span>
                      {welcomeChip(lead)}
                      {lead.message_count > 0 && <span className="lc-chip" style={{ color: BRAND, background: 'rgba(var(--brand-rgb),.1)' }}>💬 {lead.message_count}</span>}
                    </div>
                  </div>
                  <button className="lc-arch lc-btn danger icon" onClick={e => { e.stopPropagation(); archiveLead(lead) }} aria-label={t.archiveLead} title={t.archiveLead} style={{ alignSelf: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>}

        {showList && showDetail && !(focusChat && selectedLead) && (
          <Splitter value={layout.list} min={LIMITS.list[0]} grows={dir === 'rtl' ? -1 : 1} varName="--lc-list" hostRef={rootRef} label={t.resizeList}
            max={() => Math.min(LIMITS.list[1], (bodyRef.current?.getBoundingClientRect().width || 1200) - 460)}
            onCommit={v => saveLayout({ list: v })} onReset={() => { rootRef.current?.style.setProperty('--lc-list', `${LAYOUT_DEFAULT.list}px`); saveLayout({ list: LAYOUT_DEFAULT.list }) }}/>
        )}

        {/* ── Lead / overview ── */}
        {showDetail && <div ref={detailRef} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--au-bg)' }}>
          {!selectedLead ? (
            // Overview: what needs attention, where leads come from, whether everything is connected
            <div className="lc-scroll" style={{ flex: 1, padding: 18, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignContent: 'start' }}>
              <div className="lc-card" style={{ padding: 16 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: CREAM }}>{t.needAttention}</h3>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2, marginBottom: 10 }}>{t.needAttentionDesc}</div>
                {attention.length === 0 && <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 700, padding: '8px 0' }}>{t.allHandled}</div>}
                {attention.map(l => (
                  <button key={l.id} type="button" className="lc-row" onClick={() => selectLead(l.id)} style={{ padding: '9px 6px', borderRadius: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: CREAM }}>{l.name || '—'}</div>
                      <div style={{ fontSize: 11.5, color: MUTED }}>{shortLabel(l) || '—'} · {fmtWhen(l.created_at, lang)}</div>
                    </div>
                    {!l.wa_sent && l.phone && <span className="lc-chip warn" style={{ alignSelf: 'center' }}>{lang === 'en' ? 'No message' : 'ללא הודעה'}</span>}
                  </button>
                ))}
              </div>
              <div className="lc-card" style={{ padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: CREAM }}>{t.byCampaign}</h3>
                {recentByCampaign.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>{t.noRecent}</div>}
                {recentByCampaign.slice(0, 8).map(([name, n], i) => (
                  <div key={name} style={{ padding: '5px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: CREAM, marginBottom: 4 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span><b style={{ fontFeatureSettings: '"tnum"' }}>{n}</b></div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(var(--ov),.06)', overflow: 'hidden' }}><div style={{ width: `${n / maxCamp * 100}%`, height: '100%', background: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length], borderRadius: 3 }}/></div>
                  </div>
                ))}
              </div>
              <div className="lc-card" style={{ padding: 16 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 800, color: CREAM }}>{t.health}</h3>
                {[
                  [t.hToken, !conn ? 'idle' : tokenOk ? 'ok' : 'bad', tokenOk ? (conn.meta.token.name || '') : (conn?.meta?.token?.reason === 'invalid_token' ? t.connToken : '')],
                  [t.hPage, !conn ? 'idle' : pageOk ? 'ok' : 'bad', ''],
                  [t.hWebhook, !conn ? 'idle' : conn.webhook?.last ? 'ok' : 'warn', conn?.webhook?.last ? fmtFull(conn.webhook.last, lang) : t.never],
                  [t.hWa, !conn ? 'idle' : waOk ? 'ok' : 'bad', waPhone],
                  [t.hWelcome, welcomeOn === null ? 'idle' : welcomeOn ? 'ok' : 'warn', t.welcomeTpl],
                  [t.lastLead, lastLeadAt ? 'ok' : 'idle', lastLeadAt ? fmtFull(lastLeadAt, lang) : '—'],
                ].map(([label, s, sub], i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderTop: i ? `1px solid rgba(var(--ov),.06)` : 'none' }}>
                    <span style={{ marginTop: 5 }}><Dot s={s}/></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: CREAM }}>{label}</div>
                      {sub && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 1 }}>{sub}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Lead bar: who, from which campaign, actions, status */}
              <div style={{ flexShrink: 0, padding: narrow ? '10px 12px' : '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'var(--au-card-solid)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  {narrow && <button className="lc-btn icon" onClick={() => setSelectedId(null)} aria-label={t.back} title={t.back}>{dir === 'rtl' ? '→' : '←'}</button>}
                  <Avatar lead={selectedLead} size={narrow ? 40 : 46}/>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: narrow ? 16 : 18, fontWeight: 800, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isTestLead(selectedLead) ? t.testLead : (selectedLead.name || '—')}</h2>
                    <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={getCampaignLabel(selectedLead) || ''}>{shortLabel(selectedLead) || '—'} · {fmtWhen(selectedLead.created_at, lang)}</div>
                  </div>
                  {narrow && selectedLead.phone && <a className="lc-btn icon" href={`tel:+${String(selectedLead.phone).replace(/\D/g, '').replace(/^0/, '972')}`} aria-label={t.call} title={t.call}>📞</a>}
                  {!narrow && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedLead.phone && <a className="lc-btn" href={`tel:+${String(selectedLead.phone).replace(/\D/g, '').replace(/^0/, '972')}`}>📞 {t.call}</a>}
                    {selectedLead.phone && onOpenChat && !narrow && <button className="lc-btn wa" onClick={() => onOpenChat(selectedLead)}>💬 {t.whatsapp}</button>}
                    {crmButton}
                  </div>}
                </div>
                {!(focusChat && narrow) && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {narrow ? (
                    <select value={STATUS_CONFIG[selectedLead.status] && selectedLead.status !== 'saved_to_crm' ? selectedLead.status : 'new'} onChange={e => handleStatusChange(e.target.value)} aria-label={t.status} className="lc-input" style={{ width: 'auto', minHeight: 34, padding: '0 10px', fontWeight: 700, color: (STATUS_CONFIG[selectedLead.status] || STATUS_CONFIG.new).color }}>
                      {['new', 'contacted', 'scheduled', 'closed'].map(k => <option key={k} value={k}>{STATUS_CONFIG[k].label[lang] || STATUS_CONFIG[k].label.he}</option>)}
                    </select>
                  ) : <>
                    <span className="lc-label">{t.status}</span>
                    <div className="lc-seg" role="radiogroup" aria-label={t.status}>
                      {['new', 'contacted', 'scheduled', 'closed'].map(k => {
                        const s = STATUS_CONFIG[k]
                        const on = (selectedLead.status || 'new') === k
                        return <button key={k} role="radio" aria-checked={on} onClick={() => handleStatusChange(k)} style={on ? { background: s.bg, color: s.color } : undefined}>{s.label[lang] || s.label.he}</button>
                      })}
                    </div>
                  </>}
                  {onePane && (
                    <div className="lc-seg" role="tablist" style={{ marginInlineStart: 'auto' }}>
                      <button role="tab" aria-selected={pane === 'chat'} onClick={() => setPane('chat')} style={pane === 'chat' ? { background: 'rgba(var(--brand-rgb),.14)', color: BRAND } : undefined}>💬 {t.tabChat}</button>
                      <button role="tab" aria-selected={pane === 'info'} onClick={() => setPane('info')} style={pane === 'info' ? { background: 'rgba(var(--brand-rgb),.14)', color: BRAND } : undefined}>{t.tabInfo}</button>
                    </div>
                  )}
                </div>}
              </div>

              {/* Conversation + details */}
              <div ref={detailBoxRef} style={{ flex: 1, minHeight: 0, display: 'flex', padding: onePane ? 0 : 14, overflow: 'hidden' }}>
                {(!onePane || pane === 'chat' || focusChat) && (
                  <div className={onePane ? '' : 'lc-card'} style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: narrow ? 'calc(64px + env(safe-area-inset-bottom))' : 0 }}>
                    <LeadConversation key={selectedLead.id} lead={selectedLead} tplLead={tplLead} lang={lang} isDark={isDark}
                      localMsgs={messages} needsWelcome={!selectedLead.wa_sent} autoConfig={autoConfig} onAutoConfigSaved={onAutoConfigSaved}
                      onSend={handleSend} onSendWelcome={handleWelcome} officePhone={waPhone}
                      onOpenChats={onOpenChat ? () => onOpenChat(selectedLead) : undefined} compact={narrow}
                      onActivity={onActivity} maximized={focusChat} onToggleMaximize={() => setFocusChat(v => !v)}/>
                  </div>
                )}
                {!onePane && !focusChat && (
                  <Splitter wide value={layout.aside} min={LIMITS.aside[0]} grows={dir === 'rtl' ? 1 : -1} varName="--lc-aside" hostRef={rootRef} label={t.resizeAside}
                    max={() => Math.min(LIMITS.aside[1], (detailBoxRef.current?.getBoundingClientRect().width || 900) - 28 - 14 - 380)}
                    onCommit={v => saveLayout({ aside: v })} onReset={() => { rootRef.current?.style.setProperty('--lc-aside', `${LAYOUT_DEFAULT.aside}px`); saveLayout({ aside: LAYOUT_DEFAULT.aside }) }}/>
                )}
                {(onePane ? pane === 'info' : !focusChat) && (
                  <aside className="lc-scroll" style={{ width: onePane ? '100%' : 'var(--lc-aside)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: onePane ? 12 : 0, paddingBottom: narrow ? 96 : 0 }}>
                    {/* Welcome status */}
                    <div className="lc-card" style={{ padding: 14, borderColor: selectedLead.wa_sent ? 'rgba(34,197,94,.4)' : selectedLead.phone ? 'rgba(245,158,11,.45)' : BORDER }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span aria-hidden style={{ fontSize: 18 }}>{selectedLead.wa_sent ? '✅' : selectedLead.phone ? '⏳' : '🚫'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 800, color: CREAM }}>{selectedLead.wa_sent ? t.welcomeSent : selectedLead.phone ? t.welcomeNot : t.welcomeNoPhone}</div>
                          {selectedLead.wa_sent && firstOutAt && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{fmtFull(firstOutAt, lang)}</div>}
                          {!selectedLead.wa_sent && selectedLead.phone && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{t.welcomeHint}</div>}
                        </div>
                      </div>
                      {!selectedLead.wa_sent && selectedLead.phone && onePane && <button className="lc-btn primary" onClick={() => setPane('chat')} style={{ marginTop: 12, width: '100%' }}>{t.pickWelcome}</button>}
                    </div>

                    {/* Details */}
                    <div className="lc-card" style={{ padding: 14 }}>
                      <h3 style={{ margin: '0 0 6px', fontSize: 13.5, fontWeight: 800, color: CREAM }}>{t.details}</h3>
                      {[
                        ['phone', t.phone, selectedLead.phone ? fmtPhone(selectedLead.phone) : '—', selectedLead.phone ? fmtPhone(selectedLead.phone) : ''],
                        ['email', t.email, selectedLead.email || '—', selectedLead.email || ''],
                        ['campaign', t.campaign, selectedLead.campaign_name || '—'],
                        ['form', t.form, selectedLead.form_name || '—'],
                        ['received', t.received, fmtFull(selectedLead.created_at, lang)],
                      ].map(([key, k, v, copyVal]) => (
                        <div key={key} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderTop: `1px solid rgba(var(--ov),.06)` }}>
                          <span style={{ width: 64, flexShrink: 0, fontSize: 12, color: FAINT, fontWeight: 600 }}>{k}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: CREAM, overflowWrap: 'anywhere', textAlign: 'start' }}>{key === 'phone' ? <bdi>{v}</bdi> : v}</span>
                          {copyVal && <button className="lc-btn" style={{ minHeight: 26, padding: '0 8px', fontSize: 11 }} onClick={() => copy(key, copyVal)}>{copiedKey === key ? t.copied : t.copy}</button>}
                        </div>
                      ))}
                      {answers.length > 0 && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
                          <div className="lc-label" style={{ marginBottom: 6 }}>{t.formAnswers}</div>
                          {answers.map((x, i) => <div key={i} style={{ fontSize: 13, color: CREAM, lineHeight: 1.55, marginBottom: 4 }}><span style={{ color: MUTED }}>{x.q}:</span> <b style={{ fontWeight: 700 }}>{x.a}</b></div>)}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div className="lc-card" style={{ padding: 14, display: 'grid', gap: 8 }}>
                      <label className="lc-label" htmlFor="lc-notes">{t.notes}</label>
                      <textarea id="lc-notes" value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder={t.notesPlaceholder} rows={3} className="lc-input" style={{ resize: 'vertical', direction: dir }}/>
                      <label className="lc-label" htmlFor="lc-calltime">{t.callTime}</label>
                      <input id="lc-calltime" type="text" value={callTimeInput} onChange={e => setCallTimeInput(e.target.value)} placeholder={t.callTimePlaceholder} className="lc-input" style={{ direction: dir }}/>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="lc-btn" onClick={handleSaveNotes} disabled={noteState === 'saving'}>{t.saveNotes}</button>
                        {noteState === 'saved' && <span role="status" className="lc-chip ok">✓ {t.noteSaved}</span>}
                        {noteState === 'failed' && <span role="alert" className="lc-chip warn">{t.noteSaveFailed}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {narrow && crmButton}
                      {narrow && selectedLead.phone && onOpenChat && <button className="lc-btn wa" onClick={() => onOpenChat(selectedLead)}>💬 {t.whatsapp}</button>}
                      <button className="lc-btn danger" onClick={() => archiveLead(selectedLead)}>{t.archiveLead}</button>
                    </div>
                  </aside>
                )}
              </div>
            </>
          )}
        </div>}
      </div>}
    </div>
  )
}
