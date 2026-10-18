// MetaLeadsTab.jsx — Meta Lead Ads Lead Center
// RTL, dark-theme UI matching the Afik Hanahal admin panel
// Props: { C, lang, isDark, onSaveToCRM }

import { useState, useEffect, useRef, useCallback } from 'react'
import { metaFormAnswers, shortCampaign } from './lib/leadFields.js'
import { hebrewFirstName, isLatinName } from '../lib/hebrew-names.js'
import { supabase } from './lib/supabaseClient'
import MetaKanban from './MetaKanban'

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
    quickReply1: 'היי! מתי נוח לך?',
    quickReply2: 'שלחתי לך פרטים 📋',
    quickReply3: 'תיאום פגישה 📅',
    quickReply4: 'ספר לי על הנכס 🏠',
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
    quickReply1: 'Hi! When are you available?',
    quickReply2: 'I sent you details 📋',
    quickReply3: 'Schedule a meeting 📅',
    quickReply4: 'Tell me about the property 🏠',
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

const QUICK_REPLIES = {
  he: [
    { label: 'תיאום שיחה',    message: 'היי {{firstName}}, ראיתי את הפנייה שלך על {{project}}. מתי נוח שאתקשר לכמה דקות?' },
    { label: 'חזרה אחרי שיחה שלא נענתה', message: 'היי {{firstName}}, ניסיתי להתקשר אליך לגבי {{project}} ולא תפסתי אותך. עכשיו נוח, או שעדיף מאוחר יותר?' },
    { label: 'תיאום פגישה',   message: 'היי {{firstName}}, לגבי {{project}} – הכי טוב לשבת ולעבור על הפרטים והתוכניות יחד. איזה יום מתאים לך השבוע?' },
    { label: 'שליחת פרטים',   message: 'היי {{firstName}}, יש לי את כל הפרטים והתוכניות של {{project}}. לשלוח לך כאן, או שנעבור עליהם בשיחה קצרה?' },
    { label: 'זמינים עכשיו',  message: 'היי {{firstName}}, ראיתי עכשיו את הפנייה על {{project}}. יש לי כמה דקות פנויות ממש עכשיו – נוח שאתקשר?' },
  ],
  en: [
    { label: 'Schedule a call',     message: 'Hi {{firstName}}, I saw your inquiry about {{project}}. When\'s a good time for a quick call?' },
    { label: 'After a missed call', message: 'Hi {{firstName}}, I tried calling you about {{project}} but couldn\'t reach you. Is now good, or would later suit you better?' },
    { label: 'Book a meeting',      message: 'Hi {{firstName}}, about {{project}} – it\'s best to sit down and go over the details and plans together. Which day works for you this week?' },
    { label: 'Send the details',    message: 'Hi {{firstName}}, I have all the details and plans for {{project}}. Shall I send them here, or go over them on a short call?' },
    { label: 'Available now',       message: 'Hi {{firstName}}, I\'ve just seen your inquiry about {{project}}. I have a few minutes free right now – OK if I call?' },
  ],
}

// The campaign's short name ("זרובבל 15") and, in Hebrew, the first name in Hebrew (an unknown Latin name is left out)
function applyTemplate(tpl, lead, lang = 'he') {
  let firstName = lead?.name?.trim().split(/\s+/)[0] || ''
  if (lang !== 'en' && isLatinName(firstName)) firstName = hebrewFirstName(firstName)
  const project = shortCampaign(lead?.campaign_name || lead?.form_name || '') || (lang === 'en' ? 'our project' : 'הפרויקט שלנו')
  return tpl.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{project\}\}/g, project).replace(/[ \t]+([,.!?])/g, '$1')
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr, lang) {
  const diff = (Date.now() - new Date(dateStr)) / 1000
  if (diff < 60)   return lang === 'en' ? 'just now' : 'עכשיו'
  if (diff < 3600) return lang === 'en' ? `${Math.floor(diff/60)}m ago` : `לפני ${Math.floor(diff/60)} דק׳`
  if (diff < 86400) return lang === 'en' ? `${Math.floor(diff/3600)}h ago` : `לפני ${Math.floor(diff/3600)} שע׳`
  if (diff < 604800) return lang === 'en' ? `${Math.floor(diff/86400)}d ago` : `לפני ${Math.floor(diff/86400)} ימים`
  return new Date(dateStr).toLocaleDateString('he-IL', { day:'numeric', month:'numeric' })
}

function fmtTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
}

// Compact "DD/MM · HH:MM" used in the lead card so Afik sees both the date AND
// the exact time the lead came in, not only "לפני 8 שעי".
function fmtDateTimeShort(dateStr) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

function fmtDate(dateStr, lang) {
  const d = new Date(dateStr)
  const today = new Date(); today.setHours(0,0,0,0)
  const msgDay = new Date(d); msgDay.setHours(0,0,0,0)
  if (msgDay.getTime() === today.getTime()) return lang === 'en' ? 'Today' : 'היום'
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1)
  if (msgDay.getTime() === yesterday.getTime()) return lang === 'en' ? 'Yesterday' : 'אתמול'
  return d.toLocaleDateString('he-IL', { day:'numeric', month:'numeric', year:'2-digit' })
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

async function sendMessage(leadId, message) {
  const res = await fetch(`/api/meta/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify({ lead_id: leadId, message }),
  })
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`) }
  const data = await res.json()
  return data.message
}

async function syncLeads(pageId) {
  const url = pageId ? `/api/meta/sync?page_id=${encodeURIComponent(pageId)}` : `/api/meta/sync`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MetaLeadsTab({ C, lang, isDark, onSaveToCRM, onOpenChat, onNewLead, onNewMetaMessage, onSentMetaMessage }) {
  const t = TR[lang] || TR.he
  const dir = lang === 'en' ? 'ltr' : 'rtl'

  // State
  const [leads, setLeads]               = useState([])
  const [messages, setMessages]         = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState(null)
  const [search, setSearch]             = useState('')
  const [msgInput, setMsgInput]         = useState('')
  const [noteInput, setNoteInput]       = useState('')
  const [callTimeInput, setCallTimeInput] = useState('')
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending]           = useState(false)
  const [syncing, setSyncing]           = useState(false)
  const [syncResult, setSyncResult]     = useState(null)
  const [noteSaved, setNoteSaved]       = useState(false)
  const [leadsError, setLeadsError]     = useState(null)
  const [messagesError, setMessagesError] = useState(null)
  const [savedToCRM, setSavedToCRM]     = useState(false)
  const [sendError, setSendError]       = useState('')
  const [hideTest, setHideTest]         = useState(true)   // Meta's "lead ads testing" leads (dummy data)
  // Hover state lives in CSS (`.lead-row:hover`) — keeping it in React caused
  // a re-render of all 100+ leads on every mouse move, which froze the scroll.
  const [deletedLeads, setDeletedLeads] = useState([])
  const [showRestore, setShowRestore]   = useState(false)
  const [campaignDropOpen, setCampaignDropOpen] = useState(false)
  const [sortOrder, setSortOrder]               = useState('desc') // 'desc' = newest first
  const [metaView, setMetaView]                 = useState('chat') // 'chat' | 'pipeline' | 'table' — default to lead list
  // "Last time the user opened the Lead Center" — used to badge new leads on the toggle button.
  const [lastVisitTs, setLastVisitTs] = useState(() => {
    try { return Number(localStorage.getItem('meta_chat_last_visit_v1')) || Date.now() }
    catch { return Date.now() }
  })

  const messagesEndRef        = useRef(null)
  const leadsIntervalRef      = useRef(null)
  const messagesIntervalRef   = useRef(null)
  const autoSyncRef           = useRef(null)
  const campaignDropRef       = useRef(null)
  const knownLeadIdsRef       = useRef(null)
  const knownMsgIdsRef        = useRef(new Map()) // leadId → Set<msgId>
  const onNewLeadRef          = useRef(onNewLead)
  const onNewMetaMsgRef       = useRef(onNewMetaMessage)
  const onSentMetaMsgRef      = useRef(onSentMetaMessage)
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
      } else if (onNewLeadRef.current) {
        const newLeads = visible.filter(l => !knownLeadIdsRef.current.has(l.id))
        if (newLeads.length > 0) {
          newLeads.forEach(l => knownLeadIdsRef.current.add(l.id))
          const latest = newLeads[0]
          onNewLeadRef.current({ name: latest.name, campaign: latest.campaign_name || latest.form_name })
        }
      } else {
        visible.forEach(l => knownLeadIdsRef.current.add(l.id))
      }
    } catch (e) {
      setLeadsError(e.message)
    } finally {
      setLoadingLeads(false)
    }
  }, [])

  // ── Load messages for selected lead ─────────────────────────────────────────
  const loadMessages = useCallback(async (leadId, silent = false) => {
    if (!leadId) return
    if (!silent) setLoadingMessages(true)
    setMessagesError(null)
    try {
      const data = await fetchMessages(leadId)
      setMessages(data)

      // Detect new incoming messages and fire notification
      if (!knownMsgIdsRef.current.has(leadId)) {
        knownMsgIdsRef.current.set(leadId, new Set(data.map(m => m.id)))
      } else {
        const known = knownMsgIdsRef.current.get(leadId)
        const newIn = data.filter(m => m.direction === 'in' && m.id && !known.has(m.id))
        data.forEach(m => { if (m.id) known.add(m.id) })
        if (newIn.length > 0 && onNewMetaMsgRef.current) {
          const latest = newIn[newIn.length - 1]
          const lead = leads.find(l => l.id === leadId)
          onNewMetaMsgRef.current({ leadName: lead?.name || '—', message: latest.message })
        }
      }
    } catch (e) {
      setMessagesError(e.message)
    } finally {
      setLoadingMessages(false)
    }
  }, [leads])

  // ── Load archived (soft-deleted) leads from server ──────────────────────────
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
    // One-time: clear old localStorage-based deleted leads (no longer used)
    localStorage.removeItem('meta_deleted_leads')
    loadLeads()
    loadDeletedLeads()

    if (!supabase) {
      // Fallback: poll every 30s when Realtime not configured
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
            onNewLeadRef.current?.({ name: next.name, campaign: next.campaign_name || next.form_name })
            knownLeadIdsRef.current?.add(next.id)
            return [next, ...prev]
          })
        } else if (eventType === 'UPDATE') {
          if (deletedIdsRef.current.has(next.id)) return
          setLeads(prev => prev.map(l => l.id === next.id ? { ...l, ...next } : l))
          setSelectedLead(prev => prev?.id === next.id ? { ...prev, ...next } : prev)
        } else if (eventType === 'DELETE') {
          setLeads(prev => prev.filter(l => l.id !== old.id))
          setSelectedLead(prev => prev?.id === old.id ? null : prev)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadLeads]) // eslint-disable-line

  // ── Messages: Realtime for selected lead + one-time load ────────────────────
  useEffect(() => {
    clearInterval(messagesIntervalRef.current)
    if (!selectedLead) { setMessages([]); return }
    loadMessages(selectedLead.id)

    if (!supabase) {
      messagesIntervalRef.current = setInterval(() => { if (!document.hidden) loadMessages(selectedLead.id, true) }, 15000)
      return () => clearInterval(messagesIntervalRef.current)
    }

    const channel = supabase
      .channel(`meta_messages_${selectedLead.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'meta_messages',
        filter: `lead_id=eq.${selectedLead.id}`,
      }, (payload) => {
        const msg = payload.new
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          if (msg.direction === 'in') {
            const known = knownMsgIdsRef.current.get(selectedLead.id)
            if (known && !known.has(msg.id)) {
              known.add(msg.id)
              onNewMetaMsgRef.current?.({ leadName: selectedLead.name || '—', message: msg.message })
            }
          }
          return [...prev, msg]
        })
      })
      .subscribe()

    return () => {
      clearInterval(messagesIntervalRef.current)
      supabase.removeChannel(channel)
    }
  }, [selectedLead?.id, loadMessages])

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
    autoSyncRef.current = setInterval(() => { if (!document.hidden) loadConn() }, 10 * 60 * 1000)
    return () => clearInterval(autoSyncRef.current)
  }, [loadConn])

  // ── Scroll to bottom when messages change ───────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Sync notes/callTime from selected lead ───────────────────────────────────
  useEffect(() => {
    if (selectedLead) {
      setNoteInput(selectedLead.notes || '')
      setCallTimeInput(selectedLead.call_time || '')
      setSavedToCRM(false)
    }
  }, [selectedLead?.id])

  // ── Close campaign dropdown on outside click ─────────────────────────────────
  useEffect(() => {
    if (!campaignDropOpen) return
    const handler = (e) => { if (campaignDropRef.current && !campaignDropRef.current.contains(e.target)) setCampaignDropOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [campaignDropOpen])

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = async (text) => {
    const msg = (typeof text === 'string' ? text : '').trim()
    if (!msg || !selectedLead) return
    setSending(true)
    setSendError('')
    try {
      const newMsg = await sendMessage(selectedLead.id, msg)
      setMsgInput('')
      if (!selectedLead.wa_sent) { setSelectedLead(p => ({ ...p, wa_sent: true })); setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, wa_sent: true } : l)) }
      if (newMsg) {
        setMessages(prev => [...prev, newMsg])
        // Mark as known so it doesn't re-trigger an incoming notification
        const known = knownMsgIdsRef.current.get(selectedLead.id)
        if (known && newMsg.id) known.add(newMsg.id)
      } else {
        await loadMessages(selectedLead.id, true)
      }
      onSentMetaMsgRef.current?.({ leadName: selectedLead.name || '—', message: msg })
    } catch (e) {
      console.error('[MetaLeadsTab] send error:', e)
      setSendError(e.message || 'error')
    } finally {
      setSending(false)
    }
  }

  // ── Welcome now (one lead) — the template from the automations tab, from the office WhatsApp ──
  const [welcomeBusy, setWelcomeBusy] = useState(false)
  const handleWelcomeNow = async () => {
    if (!selectedLead?.phone || welcomeBusy) return
    setWelcomeBusy(true); setSendError('')
    try {
      const r = await fetch('/api/meta/lead-welcome', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` }, body: JSON.stringify({ id: selectedLead.id }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || d.skipped || `HTTP ${r.status}`)
      setSelectedLead(p => ({ ...p, wa_sent: true }))
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, wa_sent: true } : l))
      loadMessages(selectedLead.id, true)
      onSentMetaMsgRef.current?.({ leadName: selectedLead.name || '—', message: d.text || '' })
    } catch (e) { setSendError(e.message) }
    finally { setWelcomeBusy(false) }
  }

  // ── Quick reply → open WhatsApp with pre-filled message ──────────────────────
  const handleQuickReply = (qr) => {
    if (!selectedLead?.phone) return
    setMsgInput(applyTemplate(qr.message, selectedLead, lang))
  }

  // ── Sync ─────────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      // The server syncs the office's own pages (META_PAGE_IDS) and welcomes only fresh leads
      const r = await syncLeads()
      const fresh = r.new || 0
      setSyncResult(fresh ? `${fresh} ${lang === 'en' ? 'new leads' : 'לידים חדשים'}` : (lang === 'en' ? 'Up to date' : 'הכל מעודכן'))
      await loadLeads(true)
      loadConn()
    } catch (e) {
      setSyncResult(lang === 'en' ? 'Sync failed: ' + e.message : 'שגיאת סנכרון: ' + e.message)
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncResult(null), 5000)
    }
  }

  // ── Update status ─────────────────────────────────────────────────────────────
  const handleStatusChange = async (status) => {
    if (!selectedLead) return
    setSelectedLead(prev => ({ ...prev, status }))
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, status } : l))
    await fetch('/api/meta/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ id: selectedLead.id, status }),
    }).catch(() => {})
  }

  // ── Save notes ────────────────────────────────────────────────────────────────
  const handleSaveNotes = async () => {
    if (!selectedLead) return
    setSelectedLead(prev => ({ ...prev, notes: noteInput, call_time: callTimeInput }))
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, notes: noteInput, call_time: callTimeInput } : l))
    await fetch('/api/meta/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ id: selectedLead.id, notes: noteInput, call_time: callTimeInput }),
    }).catch(() => {})
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  // ── Save to CRM (toggle) ──────────────────────────────────────────────────────
  const handleSaveToCRM = async () => {
    if (!selectedLead) return

    // Toggle: undo if already saved
    if (selectedLead.status === 'saved_to_crm') {
      const revert = 'contacted'
      setSelectedLead(prev => ({ ...prev, status: revert }))
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, status: revert } : l))
      fetch('/api/meta/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
        body: JSON.stringify({ id: selectedLead.id, status: revert }),
      }).catch(() => {})
      return
    }

    // Optimistic update immediately
    const leadSnapshot = selectedLead
    setSelectedLead(prev => ({ ...prev, status: 'saved_to_crm' }))
    setLeads(prev => prev.map(l => l.id === leadSnapshot.id ? { ...l, status: 'saved_to_crm' } : l))
    setSavedToCRM(true)

    // API call in background
    fetch('/api/meta/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ id: leadSnapshot.id, status: 'saved_to_crm' }),
    }).catch(() => {})

    // Transfer to LeadsBoard after 500ms
    setTimeout(() => {
      setSavedToCRM(false)
      if (onSaveToCRM) onSaveToCRM(leadSnapshot)
    }, 500)
  }

  // ── Delete lead (soft-delete → server) ───────────────────────────────────────
  const handleDeleteLead = (lead, e) => {
    e.stopPropagation()
    const now = new Date().toISOString()
    // Optimistic UI
    setLeads(prev => prev.filter(l => l.id !== lead.id))
    setDeletedLeads(prev => [{ ...lead, deleted_at: now }, ...prev])
    if (selectedLead?.id === lead.id) setSelectedLead(null)
    // Persist to server
    fetch('/api/meta/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ id: lead.id, deleted_at: now }),
    }).catch(() => {})
  }

  // ── Restore lead (clear deleted_at → server) ──────────────────────────────
  const handleRestoreLead = (lead) => {
    // Optimistic UI
    const { deleted_at, ...restored } = lead
    setLeads(prev => [restored, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
    setDeletedLeads(prev => prev.filter(l => l.id !== lead.id))
    // Persist to server
    fetch('/api/meta/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ id: lead.id, deleted_at: null }),
    }).catch(() => {})
  }

  // ── Restore ALL archived leads at once ───────────────────────────────────────
  const handleRestoreAll = async () => {
    const toRestore = [...deletedLeads]
    if (!toRestore.length) return
    // Optimistic: move all back to active list
    setLeads(prev => {
      const existing = new Set(prev.map(l => l.id))
      const incoming = toRestore
        .filter(l => !existing.has(l.id))
        .map(({ deleted_at, ...l }) => l)
      return [...incoming, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    })
    setDeletedLeads([])
    setShowRestore(false)
    // Persist all to server (fire-and-forget, parallel)
    await Promise.all(toRestore.map(lead =>
      fetch('/api/meta/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
        body: JSON.stringify({ id: lead.id, deleted_at: null }),
      }).catch(() => {})
    ))
  }

  // ── Campaign list — use campaign_name, fall back to form_name ────────────────
  const getCampaignLabel = (l) => l.campaign_name || l.form_name || null
  const campaigns = [...new Set(leads.map(getCampaignLabel).filter(Boolean))]

  // ── Filtered leads ────────────────────────────────────────────────────────────
  const filteredLeads = leads
    .filter(l => {
      const matchStatus = statusFilter === 'all' || l.status === statusFilter
      const q = search.toLowerCase()
      const matchSearch = !search || [l.name, l.phone, l.email, l.campaign_name, l.form_name]
        .filter(Boolean).some(s => s.toLowerCase().includes(q))
      const matchCampaign = !campaignFilter || getCampaignLabel(l) === campaignFilter
      const matchTest = !hideTest || !isTestLead(l)
      return matchStatus && matchSearch && matchCampaign && matchTest
    })
    .sort((a, b) => sortOrder === 'desc'
      ? new Date(b.created_at) - new Date(a.created_at)
      : new Date(a.created_at) - new Date(b.created_at)
    )

  // ── Group messages by date ────────────────────────────────────────────────────
  const groupedMessages = []
  let lastDate = null
  for (const msg of messages) {
    const dateLabel = fmtDate(msg.created_at, lang)
    if (dateLabel !== lastDate) {
      groupedMessages.push({ type: 'date', label: dateLabel, key: `d-${msg.id}` })
      lastDate = dateLabel
    }
    groupedMessages.push({ type: 'msg', msg, key: msg.id })
  }

  // ── Styles ────────────────────────────────────────────────────────────────────
  const BORDER  = 'rgba(var(--brand-rgb),.14)'
  const MUTED   = 'rgba(var(--ink),.55)'
  const FAINT   = 'rgba(var(--ink),.38)'
  const CREAM   = 'var(--au-text)'
  const BRAND   = 'var(--au-brand-text)'
  const WA      = '#25D366'

  const statusTabs = [
    { id: 'all',       label: t.filterAll },
    { id: 'new',       label: t.filterNew },
    { id: 'contacted', label: t.filterContacted },
    { id: 'scheduled', label: t.filterScheduled },
    { id: 'closed',    label: t.filterClosed },
    { id: 'saved_to_crm', label: STATUS_CONFIG.saved_to_crm.label[lang] || STATUS_CONFIG.saved_to_crm.label.he },
  ]

  // Single toggle: Pipeline (Kanban) ↔ Lead Center (Chat). The Pipeline/Table sub-toggle lives inside MetaKanban.
  const inChat = metaView === 'chat'

  // Red badge: leads that landed after the last visit to the Lead Center (cleared when entering the chat view)
  const unreadCount = inChat ? 0 : leads.reduce((n, l) => {
    const ts = new Date(l.created_at).getTime()
    return Number.isFinite(ts) && ts > lastVisitTs ? n + 1 : n
  }, 0)

  function handleViewToggle() {
    if (!inChat) {
      const now = Date.now()
      setLastVisitTs(now)
      try { localStorage.setItem('meta_chat_last_visit_v1', String(now)) } catch {}
    }
    setMetaView(inChat ? 'pipeline' : 'chat')
  }

  // ── Derived stats (test leads excluded) ──────────────────────────────────────
  const realLeads   = leads.filter(l => !isTestLead(l))
  const dayStart    = new Date(); dayStart.setHours(0, 0, 0, 0)
  const ageMs       = l => Date.now() - new Date(l.created_at).getTime()
  const totalLeads  = realLeads.length
  const todayLeads  = realLeads.filter(l => new Date(l.created_at) >= dayStart).length
  const weekLeads   = realLeads.filter(l => ageMs(l) < 7 * 86400000).length
  const waitingList = realLeads.filter(l => (l.status || 'new') === 'new')
  const welcomed    = realLeads.filter(l => l.wa_sent).length
  const withPhone   = realLeads.filter(l => l.phone).length
  const testCount   = leads.length - realLeads.length
  const attention   = realLeads.filter(l => (l.status || 'new') === 'new' && ageMs(l) < 14 * 86400000).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8)
  const recentByCampaign = Object.entries(realLeads.filter(l => ageMs(l) < 30 * 86400000).reduce((m, l) => { const k = getCampaignLabel(l) || '—'; m[k] = (m[k] || 0) + 1; return m }, {})).sort((a, b) => b[1] - a[1])
  const maxCamp = Math.max(1, ...recentByCampaign.map(x => x[1]))

  // ── Connection health ────────────────────────────────────────────────────────
  const tokenOk = !!conn?.meta?.token?.ok
  const pageOk = tokenOk && (conn?.meta?.pageChecks || []).length > 0 && conn.meta.pageChecks.every(p => p.leadgenSubscribed)
  const waOk = conn?.green?.state === 'authorized'
  const welcomeOn = conn?.welcome ? (conn.welcome.enabled && conn.welcome.mode === 'auto') : null
  const connState = !conn ? 'idle' : conn.error ? 'warn' : tokenOk && pageOk ? 'ok' : 'bad'
  const waPhone = conn?.green?.phone ? fmtPhone(conn.green.phone) : ''
  const lastLeadAt = realLeads.reduce((m, l) => (new Date(l.created_at) > new Date(m || 0) ? l.created_at : m), null)

  // ── Mobile: the list and the lead are separate screens ───────────────────────
  const narrow = useNarrow(900)
  const showList = !narrow || !selectedLead
  const showDetail = !narrow || !!selectedLead

  const sc0 = STATUS_CONFIG[selectedLead?.status || 'new'] || STATUS_CONFIG.new
  const answers = selectedLead ? metaFormAnswers(selectedLead.raw_fields, lang) : []
  const firstOut = messages.find(m => m.direction === 'out')
  const [copied, setCopied] = [noteSaved === 'copied', v => setNoteSaved(v ? 'copied' : false)]

  // Grouped list (today / yesterday / this week / month)
  const listItems = []
  let lastGroup = null
  for (const lead of filteredLeads) {
    const g = sortOrder === 'desc' ? dayGroup(lead.created_at, lang) : null
    if (g && g !== lastGroup) { listItems.push({ type: 'g', key: `g-${g}-${lead.id}`, label: g }); lastGroup = g }
    listItems.push({ type: 'l', key: lead.id, lead })
  }

  const dotColor = s => (s === 'ok' ? '#22C55E' : s === 'bad' ? '#E5484D' : s === 'warn' ? '#F59E0B' : 'rgba(var(--ink),.3)')
  const Dot = ({ s }) => <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor(s), flexShrink: 0, boxShadow: s === 'ok' ? '0 0 0 3px rgba(34,197,94,.18)' : 'none' }}/>

  return (
    <div className="lc" style={{ display: 'flex', height: '100%', overflow: 'hidden', direction: dir, fontFamily: 'Rubik, sans-serif', background: 'var(--au-bg)', flexDirection: 'column' }}>
      <style>{`
        .lc button{font-family:inherit}
        .lc-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:9px;border:1px solid ${BORDER};background:rgba(var(--ov),.04);color:${CREAM};font-size:12px;font-weight:700;cursor:pointer;transition:background .12s,border-color .12s;white-space:nowrap;text-decoration:none}
        .lc-btn:hover:not(:disabled){background:rgba(var(--brand-rgb),.12);border-color:rgba(var(--brand-rgb),.35)}
        .lc-btn:disabled{opacity:.5;cursor:not-allowed}
        .lc-btn.primary{background:var(--au-brand);border-color:transparent;color:#fff}
        .lc-btn.primary:hover:not(:disabled){filter:brightness(1.08);background:var(--au-brand)}
        .lc-btn.wa{background:rgba(37,211,102,.12);border-color:rgba(37,211,102,.35);color:#1FAD55}
        html[data-admin-theme="dark"] .lc-btn.wa,html:not([data-admin-theme="light"]) .lc-btn.wa{color:#5BE38E}
        .lc-btn.danger{color:#E5484D;border-color:rgba(229,72,77,.3);background:rgba(229,72,77,.06)}
        .lc-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}
        .lc-row{display:flex;gap:11px;align-items:flex-start;padding:11px 14px;border-bottom:1px solid rgba(var(--ov),.05);cursor:pointer;position:relative;transition:background .1s;contain:layout style}
        .lc-row:hover{background:rgba(var(--brand-rgb),.06)}
        .lc-row.sel{background:rgba(var(--brand-rgb),.13)}
        .lc-row.sel::before{content:'';position:absolute;inset-inline-start:0;top:0;bottom:0;width:3px;background:var(--au-brand)}
        .lc-row .lc-arch{opacity:0;transition:opacity .12s}
        .lc-row:hover .lc-arch{opacity:1}
        @media (hover:none){.lc-row .lc-arch{opacity:.6}}
        .lc-tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
        .lc-tabs::-webkit-scrollbar{display:none}
        .lc-tab{flex-shrink:0;padding:5px 11px;border-radius:999px;border:1px solid transparent;background:transparent;color:${MUTED};font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;gap:5px;align-items:center}
        .lc-tab.on{background:rgba(var(--brand-rgb),.14);border-color:rgba(var(--brand-rgb),.35);color:${BRAND}}
        .lc-card{background:var(--au-card-solid);border:1px solid ${BORDER};border-radius:14px}
        .lc-seg{display:inline-flex;border:1px solid ${BORDER};border-radius:10px;overflow:hidden;flex-wrap:wrap}
        .lc-seg button{padding:7px 12px;border:none;background:transparent;color:${MUTED};font-size:12px;font-weight:700;cursor:pointer;border-inline-start:1px solid ${BORDER}}
        .lc-seg button:first-child{border-inline-start:none}
        .lc-input{width:100%;box-sizing:border-box;padding:9px 12px;background:rgba(var(--ov),.04);border:1px solid ${BORDER};border-radius:10px;color:${CREAM};font-size:13px;font-family:inherit;outline:none}
        .lc-input:focus{border-color:rgba(var(--brand-rgb),.55);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.15)}
        .lc-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
        .lc-label{font-size:11px;font-weight:700;color:${FAINT};letter-spacing:.02em}
      `}</style>

      {/* ── Header: title, connection, actions, KPIs ── */}
      <div style={{ flexShrink: 0, borderBottom: `1px solid ${BORDER}`, background: 'linear-gradient(180deg, rgba(var(--brand-rgb),.08), transparent)', padding: '14px 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--au-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: CREAM, lineHeight: 1.2 }}>{lang === 'en' ? 'Lead Center' : 'מרכז לידים'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap', fontSize: 12, color: MUTED }}>
              <Dot s={connState}/>
              <span style={{ fontWeight: 600 }}>{!conn ? t.connChecking : connState === 'ok' ? t.connOk : conn.error ? t.connChecking : !tokenOk ? t.connToken : t.connPage}</span>
              {conn && !conn.error && <><span style={{ color: FAINT }}>·</span><Dot s={waOk ? 'ok' : 'bad'}/><span>{waOk ? t.waOk(waPhone) : t.waBad}</span></>}
              {welcomeOn !== null && <><span style={{ color: FAINT }}>·</span><span style={{ color: welcomeOn ? '#22C55E' : '#F59E0B', fontWeight: 700 }}>{welcomeOn ? t.welcomeAuto : t.welcomeOff}</span></>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {syncResult && <span className="lc-chip" style={{ color: '#22C55E', background: 'rgba(34,197,94,.12)' }}>{syncResult}</span>}
            <button className="lc-btn" onClick={handleSync} disabled={syncing}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? 'gm_spin .7s linear infinite' : 'none' }}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              {syncing ? t.syncing : t.sync}
            </button>
            <button className="lc-btn" onClick={handleViewToggle} style={{ position: 'relative' }}>
              {inChat ? 'Pipeline' : (lang === 'en' ? 'Lead Center' : 'מרכז לידים')}
              {unreadCount > 0 && <span style={{ position: 'absolute', top: -7, insetInlineEnd: -7, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#E5484D', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 12 }}>
          {[
            { label: t.kTotal, value: totalLeads, color: BRAND },
            { label: t.kToday, value: todayLeads, color: '#3A8FC7' },
            { label: t.kWeek, value: weekLeads, color: '#8B5CF6' },
            { label: t.kWaiting, value: waitingList.length, color: '#E5484D', onClick: () => { setStatusFilter('new'); setSelectedLead(null) } },
            { label: t.kWelcome, value: `${welcomed}`, sub: withPhone ? `${Math.round(welcomed / withPhone * 100)}%` : '', color: '#22C55E' },
          ].map((k, i) => (
            <div key={i} className="lc-card" onClick={k.onClick} style={{ padding: '10px 12px', cursor: k.onClick ? 'pointer' : 'default' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{k.value}</span>
                {k.sub && <span style={{ fontSize: 12, fontWeight: 700, color: FAINT }}>{k.sub}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Kanban / Table view ── */}
      {(metaView === 'pipeline' || metaView === 'table') && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <MetaKanban
            leads={leads}
            initialView={metaView}
            onUpdateLead={(id, changes) => setLeads(prev => prev.map(l => String(l.id) === String(id) ? { ...l, ...changes } : l))}
            onDeleteLead={(lead) => {
              const now = new Date().toISOString()
              setLeads(prev => prev.filter(l => l.id !== lead.id))
              setDeletedLeads(prev => [{ ...lead, deleted_at: now }, ...prev])
              fetch('/api/meta/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` }, body: JSON.stringify({ id: lead.id, deleted_at: now }) }).catch(() => {})
            }}
          />
        </div>
      )}

      {/* ── Lead Center: list + lead ── */}
      {metaView === 'chat' && <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── List ── */}
        {showList && <div style={{ width: narrow ? '100%' : 370, flexShrink: 0, borderInlineEnd: narrow ? 'none' : `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', background: 'var(--au-card-solid)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} className="lc-input" style={{ direction: dir }}/>
              <button className="lc-btn" title={sortOrder === 'desc' ? (lang === 'en' ? 'Newest first' : 'החדשים קודם') : (lang === 'en' ? 'Oldest first' : 'הישנים קודם')} onClick={() => setSortOrder(v => v === 'desc' ? 'asc' : 'desc')} style={{ padding: '7px 10px' }}>{sortOrder === 'desc' ? '↓' : '↑'}</button>
              {deletedLeads.length > 0 && <button className="lc-btn danger" title={t.archive} onClick={() => setShowRestore(v => !v)} style={{ padding: '7px 10px' }}>↩ {deletedLeads.length}</button>}
            </div>
            <div className="lc-tabs">
              {statusTabs.map(tab => {
                const n = tab.id === 'all' ? null : leads.filter(l => (l.status || 'new') === tab.id && (!hideTest || !isTestLead(l))).length
                if (tab.id === 'saved_to_crm' && !n) return null
                return (
                  <button key={tab.id} className={`lc-tab${statusFilter === tab.id ? ' on' : ''}`} onClick={() => setStatusFilter(tab.id)}>
                    {tab.label}{n ? <span style={{ opacity: .75, fontFeatureSettings: '"tnum"' }}>{n}</span> : null}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div ref={campaignDropRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                <button className="lc-btn" onClick={() => setCampaignDropOpen(v => !v)} style={{ width: '100%', justifyContent: 'space-between', color: campaignFilter ? BRAND : CREAM }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{campaignFilter || (lang === 'en' ? 'All campaigns' : 'כל הקמפיינים')}</span>
                  <span style={{ fontSize: 9, opacity: .7 }}>{campaignDropOpen ? '▲' : '▼'}</span>
                </button>
                {campaignDropOpen && (
                  <div className="lc-card lc-scroll" style={{ position: 'absolute', top: 'calc(100% + 4px)', insetInline: 0, zIndex: 200, boxShadow: '0 12px 32px rgba(0,0,0,.35)', maxHeight: 300 }}>
                    {[[null, lang === 'en' ? 'All campaigns' : 'כל הקמפיינים', leads.length], ...campaigns.map(c => [c, c, leads.filter(l => getCampaignLabel(l) === c).length])].map(([val, label, n], i) => (
                      <button key={label} onClick={() => { setCampaignFilter(val); setCampaignDropOpen(false) }}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', border: 'none', borderBottom: `1px solid rgba(var(--ov),.05)`, background: campaignFilter === val ? 'rgba(var(--brand-rgb),.12)' : 'transparent', color: campaignFilter === val ? BRAND : CREAM, fontSize: 12.5, fontWeight: campaignFilter === val ? 700 : 500, cursor: 'pointer', textAlign: 'start', direction: dir }}>
                        {val && <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAMPAIGN_COLORS[(i - 1) % CAMPAIGN_COLORS.length], flexShrink: 0 }}/>}
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                        <span style={{ fontSize: 11, color: FAINT, fontWeight: 700 }}>{n}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {testCount > 0 && <button className="lc-btn" onClick={() => setHideTest(v => !v)} style={{ fontSize: 11, padding: '7px 10px' }}>{hideTest ? `${t.showTest} (${testCount})` : t.hideTestL}</button>}
            </div>
            <div style={{ fontSize: 11.5, color: FAINT, fontWeight: 600 }}>{filteredLeads.length} {t.leadsCount}</div>
          </div>

          {/* Archive */}
          {showRestore && deletedLeads.length > 0 && (
            <div className="lc-scroll" style={{ flexShrink: 0, borderBottom: `1px solid ${BORDER}`, background: 'rgba(229,72,77,.04)', maxHeight: 220 }}>
              <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="lc-label">{lang === 'en' ? 'Archived' : 'ארכיון'} ({deletedLeads.length})</span>
                <button className="lc-btn" onClick={handleRestoreAll} style={{ padding: '4px 10px', fontSize: 11 }}>↩ {lang === 'en' ? 'Restore all' : 'שחזר הכל'}</button>
              </div>
              {deletedLeads.map(lead => (
                <div key={lead.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderTop: '1px solid rgba(var(--ov),.04)' }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name || '—'} <span style={{ color: FAINT }}>· {getCampaignLabel(lead) || fmtPhone(lead.phone)}</span></span>
                  <button className="lc-btn" onClick={() => handleRestoreLead(lead)} style={{ padding: '4px 10px', fontSize: 11 }}>↩ {lang === 'en' ? 'Restore' : 'שחזר'}</button>
                </div>
              ))}
            </div>
          )}

          {/* Rows */}
          <div className="lc-scroll" style={{ flex: 1, minHeight: 0, paddingBottom: 12 }}>
            {loadingLeads && <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>{t.loading}</div>}
            {leadsError && <div style={{ padding: 16, color: '#E5484D', fontSize: 12 }}>{t.error}: {leadsError}</div>}
            {!loadingLeads && filteredLeads.length === 0 && (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ color: CREAM, fontSize: 14, fontWeight: 700 }}>{t.noLeads}</div>
                <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>{t.noLeadsDesc}</div>
              </div>
            )}
            {listItems.map(item => {
              if (item.type === 'g') return <div key={item.key} style={{ position: 'sticky', top: 0, zIndex: 1, padding: '6px 14px', fontSize: 11, fontWeight: 800, color: FAINT, background: 'var(--au-card-solid)', borderBottom: `1px solid rgba(var(--ov),.05)` }}>{item.label}</div>
              const lead = item.lead
              const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new
              const color = avatarColors(lead.name)
              const test = isTestLead(lead)
              return (
                <div key={item.key} className={`lc-row${selectedLead?.id === lead.id ? ' sel' : ''}`} onClick={() => { setSelectedLead(lead); setSendError('') }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}22`, border: `1.5px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color }}>{test ? '🧪' : initials(lead.name)}</div>
                    {isNewRecent(lead) && <span style={{ position: 'absolute', bottom: -2, insetInlineEnd: -2, width: 11, height: 11, borderRadius: '50%', background: '#22C55E', border: '2px solid var(--au-card-solid)' }}/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{test ? t.testLead : (lead.name || '—')}</span>
                      <span style={{ fontSize: 11, color: FAINT, flexShrink: 0, fontFeatureSettings: '"tnum"' }}>{fmtWhen(lead.created_at, lang)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getCampaignLabel(lead) || '—'}{lead.phone ? <span style={{ color: FAINT, fontFeatureSettings: '"tnum"' }}> · {fmtPhone(lead.phone)}</span> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span className="lc-chip" style={{ color: sc.color, background: sc.bg }}>{sc.label[lang] || sc.label.he}</span>
                      {lead.phone && (lead.wa_sent
                        ? <span className="lc-chip" style={{ color: '#1FA855', background: 'rgba(37,211,102,.12)' }}>✓ {lang === 'en' ? 'Welcomed' : 'קיבל הודעה'}</span>
                        : <span className="lc-chip" style={{ color: '#D97706', background: 'rgba(245,158,11,.12)' }}>{lang === 'en' ? 'No message yet' : 'טרם נשלחה הודעה'}</span>)}
                      {lead.message_count > 0 && <span className="lc-chip" style={{ color: BRAND, background: 'rgba(var(--brand-rgb),.1)' }}>💬 {lead.message_count}</span>}
                    </div>
                  </div>
                  <button className="lc-arch lc-btn danger" onClick={e => handleDeleteLead(lead, e)} aria-label={lang === 'en' ? 'Archive lead' : 'העבר לארכיון'} title={t.archive} style={{ padding: '5px 7px', alignSelf: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>}

        {/* ── Lead / overview ── */}
        {showDetail && <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--au-bg)' }}>
          {!selectedLead ? (
            // Overview: what needs attention, where leads come from, whether everything is connected
            <div className="lc-scroll" style={{ flex: 1, padding: 18, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignContent: 'start' }}>
              <div className="lc-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: CREAM }}>{t.needAttention}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2, marginBottom: 10 }}>{t.needAttentionDesc}</div>
                {attention.length === 0 && <div style={{ fontSize: 13, color: '#22C55E', fontWeight: 700, padding: '8px 0' }}>{t.allHandled}</div>}
                {attention.map(l => (
                  <div key={l.id} className="lc-row" onClick={() => setSelectedLead(l)} style={{ padding: '9px 6px', borderRadius: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: CREAM }}>{l.name || '—'}</div>
                      <div style={{ fontSize: 11.5, color: MUTED }}>{getCampaignLabel(l) || '—'} · {fmtWhen(l.created_at, lang)}</div>
                    </div>
                    {!l.wa_sent && l.phone && <span className="lc-chip" style={{ color: '#D97706', background: 'rgba(245,158,11,.12)', alignSelf: 'center' }}>{lang === 'en' ? 'No message' : 'ללא הודעה'}</span>}
                  </div>
                ))}
              </div>
              <div className="lc-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: CREAM, marginBottom: 12 }}>{t.byCampaign}</div>
                {recentByCampaign.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>{t.noRecent}</div>}
                {recentByCampaign.slice(0, 8).map(([name, n], i) => (
                  <button key={name} onClick={() => setCampaignFilter(name === '—' ? null : name)} style={{ display: 'block', width: '100%', background: 'none', border: 'none', padding: '5px 0', cursor: 'pointer', textAlign: 'start' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: CREAM, marginBottom: 4 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span><b style={{ fontFeatureSettings: '"tnum"' }}>{n}</b></div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(var(--ov),.06)', overflow: 'hidden' }}><div style={{ width: `${n / maxCamp * 100}%`, height: '100%', background: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length], borderRadius: 3 }}/></div>
                  </button>
                ))}
              </div>
              <div className="lc-card" style={{ padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: CREAM, marginBottom: 10 }}>{t.health}</div>
                {[
                  [t.hToken, !conn ? 'idle' : tokenOk ? 'ok' : 'bad', tokenOk ? (conn.meta.token.name || '') : (conn?.meta?.token?.reason === 'invalid_token' ? t.connToken : '')],
                  [t.hPage, !conn ? 'idle' : pageOk ? 'ok' : 'bad', ''],
                  [t.hWebhook, !conn ? 'idle' : conn.webhook?.last ? 'ok' : 'warn', conn?.webhook?.last ? fmtFull(conn.webhook.last, lang) : t.never],
                  [t.hWa, !conn ? 'idle' : waOk ? 'ok' : 'bad', waPhone],
                  [t.hWelcome, welcomeOn === null ? 'idle' : welcomeOn ? 'ok' : 'warn', t.welcomeTpl],
                  [t.lastLead, lastLeadAt ? 'ok' : 'idle', lastLeadAt ? fmtFull(lastLeadAt, lang) : '—'],
                ].map(([label, s, sub], i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderTop: i ? `1px solid rgba(var(--ov),.05)` : 'none' }}>
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
            <div className="lc-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Lead header */}
              <div style={{ padding: '16px 18px 14px', borderBottom: `1px solid ${BORDER}`, background: 'var(--au-card-solid)' }}>
                {narrow && <button className="lc-btn" onClick={() => setSelectedLead(null)} style={{ marginBottom: 12 }}>{dir === 'rtl' ? '→' : '←'} {t.back}</button>}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ width: 54, height: 54, borderRadius: 15, background: `${avatarColors(selectedLead.name)}22`, border: `2px solid ${avatarColors(selectedLead.name)}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: avatarColors(selectedLead.name), flexShrink: 0 }}>{isTestLead(selectedLead) ? '🧪' : initials(selectedLead.name)}</div>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: 19, fontWeight: 800, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis' }}>{isTestLead(selectedLead) ? t.testLead : (selectedLead.name || '—')}</div>
                    <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{getCampaignLabel(selectedLead) || '—'} · {t.received} {fmtFull(selectedLead.created_at, lang)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {selectedLead.phone && <a className="lc-btn" href={`tel:+${String(selectedLead.phone).replace(/\D/g, '')}`}>📞 {t.call}</a>}
                    {selectedLead.phone && onOpenChat && <button className="lc-btn wa" onClick={() => onOpenChat(selectedLead)}>💬 {t.whatsapp}</button>}
                    <button className="lc-btn" onClick={handleSaveToCRM} style={{ color: selectedLead.status === 'saved_to_crm' ? '#0EA5B7' : CREAM }}>{selectedLead.status === 'saved_to_crm' ? (lang === 'en' ? '✓ In CRM · Undo' : '✓ ב-CRM · בטל') : savedToCRM ? t.savedToCRM : t.saveToCRM}</button>
                  </div>
                </div>
                {/* Status */}
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="lc-label">{t.status}</span>
                  <div className="lc-seg">
                    {['new', 'contacted', 'scheduled', 'closed'].map(k => {
                      const s = STATUS_CONFIG[k]
                      const on = (selectedLead.status || 'new') === k
                      return <button key={k} onClick={() => handleStatusChange(k)} style={on ? { background: s.bg, color: s.color } : undefined}>{s.label[lang] || s.label.he}</button>
                    })}
                  </div>
                </div>
              </div>

              <div style={{ padding: 18, display: 'grid', gap: 14, gridTemplateColumns: narrow ? '1fr' : 'minmax(0,1fr) minmax(0,1.25fr)', alignItems: 'start' }}>
                {/* Left column: details, welcome, notes */}
                <div style={{ display: 'grid', gap: 14 }}>
                  {/* Welcome */}
                  <div className="lc-card" style={{ padding: 14, borderColor: selectedLead.wa_sent ? 'rgba(37,211,102,.35)' : selectedLead.phone ? 'rgba(245,158,11,.4)' : BORDER }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{selectedLead.wa_sent ? '✅' : selectedLead.phone ? '⏳' : '🚫'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: CREAM }}>{selectedLead.wa_sent ? t.welcomeSent : selectedLead.phone ? t.welcomeNot : t.welcomeNoPhone}</div>
                        {selectedLead.wa_sent && firstOut && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{fmtFull(firstOut.created_at, lang)}</div>}
                        {!selectedLead.wa_sent && selectedLead.phone && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>{t.welcomeTpl}</div>}
                      </div>
                    </div>
                    {!selectedLead.wa_sent && selectedLead.phone && (
                      <button className="lc-btn primary" onClick={handleWelcomeNow} disabled={welcomeBusy} style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>{welcomeBusy ? t.sending : t.welcomeNow}</button>
                    )}
                  </div>

                  {/* Details */}
                  <div className="lc-card" style={{ padding: 14 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: CREAM, marginBottom: 8 }}>{t.details}</div>
                    {[
                      [t.phone, selectedLead.phone ? fmtPhone(selectedLead.phone) : '—', selectedLead.phone],
                      [t.email, selectedLead.email || '—', selectedLead.email],
                      [t.campaign, selectedLead.campaign_name || '—'],
                      [t.form, selectedLead.form_name || '—'],
                      [t.received, fmtFull(selectedLead.created_at, lang)],
                    ].map(([k, v, copyVal]) => (
                      <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderTop: `1px solid rgba(var(--ov),.05)` }}>
                        <span style={{ width: 70, flexShrink: 0, fontSize: 12, color: FAINT, fontWeight: 600 }}>{k}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', direction: copyVal && k === t.phone ? 'ltr' : undefined, textAlign: 'start' }}>{v}</span>
                        {copyVal && <button className="lc-btn" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { navigator.clipboard?.writeText(String(k === t.phone ? fmtPhone(copyVal) : copyVal)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {}) }}>{copied ? t.copied : t.copy}</button>}
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
                    <label className="lc-label">{t.notes}</label>
                    <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder={t.notesPlaceholder} rows={3} className="lc-input" style={{ resize: 'vertical', direction: dir }}/>
                    <label className="lc-label">{t.callTime}</label>
                    <input type="text" value={callTimeInput} onChange={e => setCallTimeInput(e.target.value)} placeholder={t.callTimePlaceholder} className="lc-input" style={{ direction: dir }}/>
                    <button className="lc-btn" onClick={handleSaveNotes} style={{ justifySelf: 'start', color: noteSaved === true ? '#22C55E' : CREAM }}>{noteSaved === true ? `✓ ${t.noteSaved}` : t.saveNotes}</button>
                  </div>
                </div>

                {/* Right column: conversation */}
                <div className="lc-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 420, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 13.5, fontWeight: 800, color: CREAM }}>{t.conversation}</div>
                  <div className="lc-scroll" style={{ flex: 1, minHeight: 240, maxHeight: narrow ? 'none' : 460, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {loadingMessages && <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: 24 }}>{t.loading}</div>}
                    {messagesError && <div style={{ color: '#E5484D', fontSize: 12, padding: 8 }}>{t.error}: {messagesError}</div>}
                    {!loadingMessages && messages.length === 0 && <div style={{ margin: 'auto', textAlign: 'center' }}><div style={{ color: MUTED, fontSize: 13, fontWeight: 700 }}>{t.noMessages}</div><div style={{ color: FAINT, fontSize: 12, marginTop: 4 }}>{t.noMessagesDesc}</div></div>}
                    {groupedMessages.map(item => {
                      if (item.type === 'date') return <div key={item.key} style={{ textAlign: 'center', margin: '8px 0' }}><span className="lc-chip" style={{ color: MUTED, background: 'rgba(var(--ov),.06)' }}>{item.label}</span></div>
                      const msg = item.msg
                      const isOut = msg.direction === 'out'
                      return (
                        <div key={item.key} style={{ display: 'flex', justifyContent: isOut ? 'flex-start' : 'flex-end' }}>
                          <div style={{ maxWidth: '80%', padding: '9px 12px', borderRadius: 14, background: isOut ? 'rgba(37,211,102,.14)' : 'rgba(var(--ov),.07)', border: `1px solid ${isOut ? 'rgba(37,211,102,.3)' : BORDER}` }}>
                            <div style={{ fontSize: 13, color: CREAM, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.message}</div>
                            <div style={{ fontSize: 10.5, color: FAINT, marginTop: 4, textAlign: 'end' }}>{fmtTime(msg.created_at)}</div>
                          </div>
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef}/>
                  </div>
                  {/* Composer */}
                  <div style={{ padding: 12, borderTop: `1px solid ${BORDER}`, display: 'grid', gap: 8 }}>
                    <div className="lc-tabs">
                      {(QUICK_REPLIES[lang] || QUICK_REPLIES.he).map((qr, i) => (
                        <button key={i} className="lc-tab" disabled={!selectedLead.phone} onClick={() => handleQuickReply(qr)} title={applyTemplate(qr.message, selectedLead, lang)} style={{ border: `1px solid ${BORDER}` }}>{qr.label}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <textarea value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder={t.composer} rows={2} className="lc-input" disabled={!selectedLead.phone} style={{ resize: 'none', direction: dir }}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(msgInput) } }}/>
                      <button className="lc-btn primary" onClick={() => handleSend(msgInput)} disabled={sending || !msgInput.trim() || !selectedLead.phone} style={{ padding: '10px 16px' }}>{sending ? t.sending : t.sendBtn}</button>
                    </div>
                    {sendError && <div style={{ fontSize: 12, color: '#E5484D', fontWeight: 600 }}>{t.sendFailed}: {sendError}</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>}
      </div>}
    </div>
  )
}
