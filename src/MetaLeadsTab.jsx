// MetaLeadsTab.jsx — Meta Lead Ads Lead Center (admin "מרכז לידים")
// The list of leads (grouped by day, filters), and for the open lead: the WhatsApp conversation in the chats tab's look
// (src/LeadConversation.jsx — the real WhatsApp history, the template library, the welcome picker) next to the lead's
// details, form answers and notes. Phones get one screen at a time (list → lead → conversation / details).
// Props: { C, lang, isDark, onSaveToCRM, onOpenChat, onNew*, crmLeads, autoConfig, onAutoConfigSaved }

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { metaFormAnswers, shortCampaign, formFullName } from './lib/leadFields.js'
import { templateLead } from './lib/leadConversation.js'
import { leadHistory, crmLeadFor } from './lib/leadHistory.js'
import { supabase } from './lib/supabaseClient'
import MetaKanban from './MetaKanban'
import LeadConversation, { prefetchHistory } from './LeadConversation.jsx'
import Splitter, { SPLITTER_CSS } from './Splitter.jsx'
import { leadNotes, addNote } from './lib/leadNotes.js'
import { onSync, debounce } from './lib/syncBus.js'
import { FollowUpButton, FollowUpComposer, FollowUpList } from './FollowUpTask.jsx'

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
    formNameLbl: 'שם בטופס',
    history: 'היסטוריה ופרטים שהשאירו',
    historyEmpty: 'אין עוד פעילות',
    historyAll: n => `הצג הכל (${n})`,
    historyLess: 'הצג פחות',
    historyNow: 'הפנייה הזו',
    waSent: 'WA נשלח',
    loading: 'טוען...',
    error: 'שגיאה',
    statusNew: 'חדש',
    statusContacted: 'נוצר קשר',
    statusScheduled: 'נקבעה שיחה',
    statusClosed: 'סגור',
    leadsCount: 'לידים',
    saveNotes: 'שמור',
    addNote: 'הוספת הערה', notesShared: 'ההערות משותפות לכרטיס הליד, ללוח הלידים ולצ׳אטים.', notesNone: 'עדיין אין הערות.', notesAll: n => `כל ההערות (${n})`, notesLess: 'פחות', fuCard: 'פולו אפ', fuCardSub: 'כשמגיע הזמן נשלחת תזכורת בוואטסאפ למספר המשרד.',
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
    stageLbl: 'שלב בפייפליין', stageTip: 'העברת הליד לשלב אחר בפייפליין של ה-CRM', stageNoCrm: 'ייכנס ל-CRM בבחירת שלב', stageMoving: 'מעביר…', stageFail: 'העברת השלב נכשלה',
    renameTip: 'לחצו לעריכת השם', renameLbl: 'שם הליד', addProject: p => `+ הוספת הפרויקט: ${p}`, removeProject: 'הסרת שם הפרויקט', nameSave: 'שמירה', nameCancel: 'ביטול', nameFail: 'שמירת השם נכשלה', nameHint: 'השם מתעדכן כאן, ב-CRM ובצ׳אטים',
    sendBtn: 'שלח', sendFailed: 'השליחה נכשלה', testLead: 'ליד בדיקה', showTest: 'הצג לידי בדיקה', hideTestL: 'הסתר לידי בדיקה',
    overview: 'סקירה', needAttention: 'ממתינים לטיפול', needAttentionDesc: 'לידים מ-14 הימים האחרונים שעדיין לא טופלו', allHandled: 'כל הלידים האחרונים טופלו 🎉',
    byCampaign: 'לידים לפי קמפיין · 30 יום', noRecent: 'אין לידים ב-30 הימים האחרונים', health: 'מצב החיבור',
    hToken: 'חיבור לפייסבוק (טוקן)', hPage: 'העמוד רשום לקבלת לידים', hWebhook: 'עדכון מיידי מפייסבוק (Webhook)', hWa: 'WhatsApp של המשרד', hWelcome: 'הודעת פתיחה אוטומטית',
    never: 'עוד לא התקבל', welcomeTpl: 'הנוסח נערך בטאב אוטומציות ← תבניות',
    tabChat: 'שיחה', tabInfo: 'פרטים והערות', pickWelcome: 'לבחירת הודעת פתיחה', archiveLead: 'העבר לארכיון',
    welcomeHint: 'בחרו נוסח בשיחה ושלחו מהוואטסאפ של המשרד', noteSaveFailed: 'השמירה נכשלה', kWelcomeShort: 'קיבלו הודעה',
    pillMeta: 'פייסבוק', pillWa: 'וואטסאפ', pillWelcome: 'פתיחה אוטומטית', showWaiting: 'הצגת הלידים שממתינים לקשר ראשון',
    resizeHead: 'גררו למעלה כדי לקפל את הכותרת ולהגדיל את השיחה, למטה כדי להחזיר (לחיצה כפולה מחזירה)', resizeList: 'גררו לשינוי רוחב הרשימה (לחיצה כפולה מחזירה)', resizeAside: 'גררו לשינוי רוחב הפרטים (לחיצה כפולה מחזירה)',
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
    formNameLbl: 'Name on form',
    history: 'History & details they left',
    historyEmpty: 'No other activity yet',
    historyAll: n => `Show all (${n})`,
    historyLess: 'Show less',
    historyNow: 'This inquiry',
    waSent: 'WA sent',
    loading: 'Loading...',
    error: 'Error',
    statusNew: 'New',
    statusContacted: 'Contacted',
    statusScheduled: 'Scheduled',
    statusClosed: 'Closed',
    leadsCount: 'leads',
    saveNotes: 'Save',
    addNote: 'Add note', notesShared: 'Notes are shared with the lead card, the leads board and the chats.', notesNone: 'No notes yet.', notesAll: n => `All notes (${n})`, notesLess: 'Less', fuCard: 'Follow-up', fuCardSub: 'When it is due, the office number gets a WhatsApp reminder.',
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
    stageLbl: 'Pipeline stage', stageTip: 'Move the lead to another stage of the CRM pipeline', stageNoCrm: 'Added to the CRM when you pick a stage', stageMoving: 'Moving…', stageFail: 'Could not move the stage',
    renameTip: 'Click to edit the name', renameLbl: 'Lead name', addProject: p => `+ Add the project: ${p}`, removeProject: 'Remove the project name', nameSave: 'Save', nameCancel: 'Cancel', nameFail: 'Could not save the name', nameHint: 'Updates here, in the CRM and in the chats',
    sendBtn: 'Send', sendFailed: 'Sending failed', testLead: 'Test lead', showTest: 'Show test leads', hideTestL: 'Hide test leads',
    overview: 'Overview', needAttention: 'Needs attention', needAttentionDesc: 'Leads from the last 14 days not handled yet', allHandled: 'All recent leads are handled 🎉',
    byCampaign: 'Leads by campaign · 30 days', noRecent: 'No leads in the last 30 days', health: 'Connection status',
    hToken: 'Facebook connection (token)', hPage: 'Page subscribed to leads', hWebhook: 'Instant updates from Facebook (webhook)', hWa: 'Office WhatsApp', hWelcome: 'Automatic welcome message',
    never: 'Not received yet', welcomeTpl: 'Edit the text in Automations → Templates',
    tabChat: 'Conversation', tabInfo: 'Details & notes', pickWelcome: 'Pick a welcome message', archiveLead: 'Archive',
    welcomeHint: 'Pick a wording in the conversation and send it from the office WhatsApp', noteSaveFailed: 'Saving failed', kWelcomeShort: 'Got a message',
    pillMeta: 'Facebook', pillWa: 'WhatsApp', pillWelcome: 'Auto welcome', showWaiting: 'Show the leads awaiting first contact',
    resizeHead: 'Drag up to fold the header and enlarge the conversation, down to bring it back (double-click resets)', resizeList: 'Drag to resize the list (double-click resets)', resizeAside: 'Drag to resize the details (double-click resets)',
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
// The lead list is kept for the session too: the screen draws it at once and the read only refreshes it (a 304 when unchanged)
const LEADS_URL = '/api/meta/leads', LEADS_SS = 'afik_lc_leads_v1'
try { const v = JSON.parse(sessionStorage.getItem(LEADS_SS) || 'null'); if (v?.etag && Array.isArray(v.data?.leads)) _etags.set(LEADS_URL, v) } catch {}
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
  if (url === LEADS_URL && etag) { try { sessionStorage.setItem(LEADS_SS, JSON.stringify({ etag, data })) } catch {} }
  return data
}
async function fetchLeads() {
  const data = await condGet(LEADS_URL)
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
const LAYOUT_DEFAULT = { list: 360, aside: 320, head: null }   // head: the header's dragged height (null = all of it, 0 = folded)
const LIMITS = { list: [260, 640], aside: [260, 560] }
function loadLayout() {
  try { return { ...LAYOUT_DEFAULT, ...JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}') } } catch { return { ...LAYOUT_DEFAULT } }
}

// The CRM pipeline stages (= GROUPS in LeadsBoard.jsx / STAGES in lib/automations-shared.js); the office's renamed
// stage names arrive as the stageLabels prop
const HISTORY_ICON = { inquiry: '📝', booking: '📅', stage: '➜', note: '🗒', auto: '💬' }

const PIPELINE = [
  { id: 'new', he: 'ליד חדש', en: 'New Leads', color: '#0073EA' },
  { id: 'contacted', he: 'ניצור קשר', en: 'Contacted', color: '#FDAB3D' },
  { id: 'discovery', he: 'גילוי', en: 'Discovery', color: '#A25DDC' },
  { id: 'meeting', he: 'נקבעה פגישה', en: 'Meeting set', color: '#4F6BED' },
  { id: 'negotiating', he: 'במו"מ', en: 'In Negotiation', color: '#FF7575' },
  { id: 'won', he: 'סגירה', en: 'Closed Won', color: '#00C875' },
  { id: 'lost', he: 'ללא מענה', en: 'No Answer', color: '#7D7D7D' },
  { id: 'irrelevant', he: 'לא רלוונטי', en: 'Not relevant', color: '#64748B' },
  { id: 'nurture', he: 'לחזור בעוד כמה חודשים', en: 'Nurture (later)', color: '#0E9AA7' },
]

const PATCH = (body) => fetch('/api/meta/leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` }, body: JSON.stringify(body) })

// ── Main component ────────────────────────────────────────────────────────────
export default function MetaLeadsTab({ C, lang, isDark, onSaveToCRM, onLeadRenamed, onCrmStage, onCrmPatch, stageLabels = null, onOpenChat, onNewLead, onNewMetaMessage, onSentMetaMessage, crmLeads = [], autoConfig = null, onAutoConfigSaved }) {
  const t = TR[lang] || TR.he
  const dir = lang === 'en' ? 'ltr' : 'rtl'

  const [leads, setLeads]               = useState(() => _etags.get(LEADS_URL)?.data?.leads || [])
  const [messages, setMessages]         = useState([])        // the Lead Center's own log (meta_messages) of the open lead
  const [selectedId, setSelectedId]     = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [campaignFilter, setCampaignFilter] = useState(null)
  const [search, setSearch]             = useState('')
  const [noteInput, setNoteInput]       = useState('')
  const [callTimeInput, setCallTimeInput] = useState('')
  const [loadingLeads, setLoadingLeads] = useState(() => !_etags.get(LEADS_URL))
  const [syncing, setSyncing]           = useState(false)
  const [syncResult, setSyncResult]     = useState(null)
  const [noteState, setNoteState]       = useState('')        // '' | 'saving' | 'saved' | 'failed'
  const [notesOpen, setNotesOpen]       = useState(false)
  const [callState, setCallState]       = useState('')
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
  const rootRef = useRef(null), bodyRef = useRef(null), detailBoxRef = useRef(null), headRef = useRef(null)
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
  // the name editor (click the name in the list or the header): saved to meta_leads, the CRM copy and the chats' names
  const [nameEdit, setNameEdit] = useState(null)    // { id, value, busy, err }
  const startNameEdit = useCallback(lead => setNameEdit({ id: lead.id, value: lead.name || '', busy: false, err: false }), [])
  // the pipeline stage menu (the lead's CRM copy; a lead not in the CRM yet is added first)
  const [stageMenu, setStageMenu] = useState(false)
  const [stageBusy, setStageBusy] = useState(null)   // { stage } while moving, { err } after a failure
  const stageRef = useRef(null)
  useEffect(() => {
    if (!stageMenu) return
    const off = e => { if (!stageRef.current?.contains(e.target)) setStageMenu(false) }
    const esc = e => { if (e.key === 'Escape') setStageMenu(false) }
    document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc) }
  }, [stageMenu])
  const saveName = async lead => {
    const v = String(nameEdit?.value || '').replace(/\s+/g, ' ').trim()
    if (!v || v === lead.name) { setNameEdit(null); return }
    setNameEdit(e => ({ ...e, busy: true, err: false }))
    try {
      const r = await PATCH({ id: lead.id, name: v })
      if (!r.ok) throw new Error(String(r.status))
      patchLead(lead.id, { name: v })
      onLeadRenamed?.(lead, v)
      setNameEdit(null)
    } catch { setNameEdit(e => (e ? { ...e, busy: false, err: true } : e)) }
  }

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
  // hovering a row for a moment starts reading its WhatsApp history, so a click opens the conversation at once
  const warmRef = useRef(null)
  const warmLead = useCallback(lead => { clearTimeout(warmRef.current); if (lead?.phone) warmRef.current = setTimeout(() => prefetchHistory(lead.phone), 220) }, [])
  const coolLead = useCallback(() => clearTimeout(warmRef.current), [])
  const loadLeads = useCallback(async (silent = false) => {
    if (!silent && !_etags.get(LEADS_URL)) setLoadingLeads(true)   // a list from earlier in the session stays on screen
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

  // a rename in the leads tab (the CRM copy) — same name here at once; the server renamed meta_leads too
  useEffect(() => {
    const on = e => {
      const { metaLeadId, name } = e.detail || {}
      if (metaLeadId && name) setLeads(prev => prev.map(l => (String(l.id) === String(metaLeadId) ? { ...l, name } : l)))
    }
    window.addEventListener('afik:lead-renamed', on)
    return () => window.removeEventListener('afik:lead-renamed', on)
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
    // postgres_changes needs the table in the Realtime publication (it isn't); the database's own announcements
    // (src/lib/syncBus.js: table + id only) say a Meta lead changed, and the list is re-read conditionally (ETag)
    let missed = false
    const soon = debounce(() => { if (document.hidden) missed = true; else loadLeads(true) }, 900)
    const off = onSync(m => { if (m.t === 'meta_leads' || m.t === '*') soon() })
    const back = () => { if (missed && !document.hidden) { missed = false; loadLeads(true) } }
    document.addEventListener('visibilitychange', back)
    return () => { off(); document.removeEventListener('visibilitychange', back); supabase.removeChannel(channel) }
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
    setNoteInput('')
    setCallTimeInput(selectedLead.call_time || '')
    setNotesOpen(false)
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
  // the convenient call time stays on the Meta lead; notes go to the CRM copy (one list everywhere — src/lib/leadNotes.js)
  const handleSaveNotes = async () => {
    if (!selectedLead) return
    const id = selectedLead.id
    setCallState('saving')
    patchLead(id, { call_time: callTimeInput })
    try {
      const r = await PATCH({ id, call_time: callTimeInput })
      setCallState(r.ok ? 'saved' : 'failed')
    } catch { setCallState('failed') }
    setTimeout(() => setCallState(s => (s === 'saved' ? '' : s)), 2000)
  }
  const crmPatch = async patch => {
    if (!onCrmPatch || !selectedLead) return false
    try { return (await onCrmPatch(selectedLead, crmLead, patch)) !== false } catch { return false }
  }
  const handleAddNote = async () => {
    const r = addNote(crmLead, selectedLead, noteInput, { by: 'lead-center' })
    if (!r) return
    setNoteState('saving')
    const ok = await crmPatch(r.patch)
    setNoteState(ok ? 'saved' : 'failed')
    if (ok) setNoteInput('')
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
  const showHead = (!narrow || !selectedLead) && !(focusChat && selectedLead)

  const answers = useMemo(() => (selectedLead ? metaFormAnswers(selectedLead.raw_fields, lang) : []), [selectedLead, lang])
  const answersHe = useMemo(() => (selectedLead ? metaFormAnswers(selectedLead.raw_fields, 'he') : []), [selectedLead])
  // the CRM copy of this lead (lib/meta-crm.js) — what the office typed there personalises the templates
  const crmLead = useMemo(() => crmLeadFor(selectedLead, crmLeads), [crmLeads, selectedLead])
  const tplLead = useMemo(() => templateLead(selectedLead, crmLead, answersHe), [selectedLead, crmLead, answersHe])
  const stageName = st => { const o = stageLabels?.[st.id] || {}; return (lang === 'en' ? o.en : o.label) || st[lang === 'en' ? 'en' : 'he'] }
  const history = useMemo(() => leadHistory({
    lead: selectedLead, metaLeads: leads, crmLead, lang,
    stageName: id => { const st = PIPELINE.find(p => p.id === id); return st ? stageName(st) : id },
  }), [selectedLead, leads, crmLead, lang, stageLabels]) // eslint-disable-line react-hooks/exhaustive-deps
  const [historyOpen, setHistoryOpen] = useState(false)
  useEffect(() => { setHistoryOpen(false) }, [selectedId])
  const moveStage = async stage => {
    setStageMenu(false)
    if (!onCrmStage || !selectedLead || (crmLead && (crmLead.leadStatus || 'new') === stage)) return
    setStageBusy({ stage })
    try { await onCrmStage(selectedLead, crmLead, stage); setStageBusy(null) } catch { setStageBusy({ err: true }) }
  }
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
        .lc-name{cursor:text;border-radius:5px}
        .lc-stage{position:relative}
        .lc-stage-btn{gap:7px;border-color:color-mix(in srgb,var(--st) 45%,transparent);background:color-mix(in srgb,var(--st) 10%,transparent)}
        .lc-stage-k{font-weight:500;color:${MUTED}}
        .lc-stage-dot{width:9px;height:9px;border-radius:50%;background:var(--st);flex-shrink:0}
        .lc-stage-menu{position:absolute;top:calc(100% + 6px);inset-inline-start:0;z-index:40;min-width:230px;padding:6px;border-radius:12px;border:1px solid ${BORDER};background:var(--au-card-solid);box-shadow:0 14px 40px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:2px}
        .lc-stage-opt{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:9px;min-height:36px;padding:0 10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:${CREAM}}
        .lc-stage-opt:hover,.lc-stage-opt:focus-visible{background:rgba(var(--brand-rgb),.08)}
        .lc-stage-opt.on{background:color-mix(in srgb,var(--st) 12%,transparent)}
        .lc-stage-note{font-size:11.5px;color:${MUTED};padding:4px 10px 6px}
        .lc-stage-err{position:absolute;top:calc(100% + 4px);inset-inline-start:0;font-size:11.5px;color:#DC2626;white-space:nowrap}
        .lc-name:hover{text-decoration:underline dotted rgba(var(--brand-rgb),.6);text-underline-offset:3px}
        .lc-name-btn{all:unset;cursor:text;border-radius:6px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
        .lc-name-btn:hover,.lc-name-btn:focus-visible{background:rgba(var(--brand-rgb),.08);box-shadow:0 0 0 4px rgba(var(--brand-rgb),.08)}
        .lc-name-btn:focus-visible{outline:2px solid var(--au-brand);outline-offset:2px}
        .lc-name-pen{font-size:13px;font-weight:400;color:${FAINT};opacity:0;transition:opacity .12s}
        .lc-name-btn:hover .lc-name-pen,.lc-name-btn:focus-visible .lc-name-pen{opacity:1}
        .lc-name-form{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
        .lc-name-in{flex:1 1 200px;min-width:0;min-height:34px;padding:0 11px;border-radius:9px;border:1px solid rgba(var(--brand-rgb),.5);background:var(--au-card-solid);color:${CREAM};font:inherit;font-size:14.5px;font-weight:700;outline:none;box-shadow:0 0 0 3px rgba(var(--brand-rgb),.15)}
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
        .lc-head-in{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;padding:10px 16px}
        .lc-pill{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;border:1px solid ${BORDER};font-size:11.5px;font-weight:700;color:${MUTED};white-space:nowrap}
        .lc-kpis{display:flex;gap:6px;flex:1 1 380px;min-width:0;overflow-x:auto;scrollbar-width:none}
        .lc-kpis::-webkit-scrollbar{display:none}
        .lc-kpi{display:inline-flex;align-items:baseline;gap:6px;flex:0 0 auto;padding:6px 12px;border-radius:10px;border:1px solid ${BORDER};background:var(--au-card-solid);font:inherit;color:inherit;text-align:start}
        button.lc-kpi{cursor:pointer}button.lc-kpi:hover{border-color:rgba(var(--brand-rgb),.4)}
        .lc-kpi b{font-size:17px;font-weight:800;line-height:1;font-feature-settings:'tnum'}
        .lc-kpi span{font-size:12px;color:${MUTED};font-weight:600;white-space:nowrap}
        .lc-kpi em{font-style:normal;font-size:11px;color:${FAINT};font-weight:700}
      ` + SPLITTER_CSS}</style>

      {/* ── Header: title, connection, KPIs, actions in one row — drag its bottom edge up to fold it away ── */}
      {showHead && (
        <div ref={headRef} style={{ flexShrink: 0, overflow: 'hidden', height: !narrow && layout.head != null ? layout.head : undefined, borderBottom: `1px solid ${BORDER}` }}>
          <div className="lc-head-in" style={narrow ? { padding: '10px 12px' } : undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: CREAM, whiteSpace: 'nowrap' }}>{lang === 'en' ? 'Lead Center' : 'מרכז לידים'}</h2>
              <span className="lc-pill" title={!conn ? t.connChecking : connState === 'ok' ? t.connOk : !tokenOk ? t.connToken : t.connPage}><Dot s={connState}/>{t.pillMeta}</span>
              {conn && !conn.error && <span className="lc-pill" title={waOk ? t.waOk(waPhone) : t.waBad}><Dot s={waOk ? 'ok' : 'bad'}/>{t.pillWa}</span>}
              {welcomeOn !== null && <span className="lc-pill" title={welcomeOn ? t.welcomeAuto : t.welcomeOff}><Dot s={welcomeOn ? 'ok' : 'warn'}/>{t.pillWelcome}</span>}
            </div>
            <div className="lc-kpis" role="list">
              {kpis.map((k, i) => {
                const Tag = k.onClick ? 'button' : 'div'
                return (
                  <Tag key={i} role="listitem" className="lc-kpi" onClick={k.onClick} type={k.onClick ? 'button' : undefined} title={k.onClick ? t.showWaiting : undefined}>
                    <b style={{ color: k.color }}>{k.value}</b><span>{k.label}</span>{k.sub && <em>{k.sub}</em>}
                  </Tag>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {syncResult && <span role="status" className={`lc-chip ${syncResult.ok ? 'ok' : 'warn'}`}>{syncResult.text}</span>}
              <button className="lc-btn" onClick={handleSync} disabled={syncing}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? 'gm_spin .7s linear infinite' : 'none' }} aria-hidden><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                {syncing ? t.syncing : t.sync}
              </button>
              <button className="lc-btn" onClick={handleViewToggle} style={{ position: 'relative' }}>
                {inChat ? 'Pipeline' : (lang === 'en' ? 'Lead Center' : 'מרכז לידים')}
                {unreadCount > 0 && <span style={{ position: 'absolute', top: -7, insetInlineEnd: -7, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: '#E5484D', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
            </div>
          </div>
        </div>
      )}
      {showHead && !narrow && (
        <Splitter axis="y" gap grows={1} min={0} label={t.resizeHead}
          max={() => headRef.current?.scrollHeight || 200}
          get={() => headRef.current?.getBoundingClientRect().height || 0}
          apply={v => { if (headRef.current) headRef.current.style.height = `${v}px` }}
          commit={v => { const full = headRef.current?.scrollHeight || 0; saveLayout({ head: v < 24 ? 0 : v >= full - 2 ? null : v }) }}
          reset={() => { if (headRef.current) headRef.current.style.height = ''; saveLayout({ head: null }) }}/>
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
                  onPointerEnter={() => warmLead(lead)} onPointerLeave={coolLead} onFocus={() => warmLead(lead)}
                  onClick={() => selectLead(lead.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectLead(lead.id) } }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar lead={lead}/>
                    {isNewRecent(lead) && <span style={{ position: 'absolute', bottom: -2, insetInlineEnd: -2, width: 11, height: 11, borderRadius: '50%', background: '#22C55E', border: '2px solid var(--au-card-solid)' }}/>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span className="lc-name" title={t.renameTip} onClick={e => { e.stopPropagation(); selectLead(lead.id); startNameEdit(lead) }} style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isTestLead(lead) ? t.testLead : (lead.name || '—')}</span>
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
          <Splitter axis="x" min={LIMITS.list[0]} grows={dir === 'rtl' ? -1 : 1} label={t.resizeList}
            max={() => Math.min(LIMITS.list[1], (bodyRef.current?.getBoundingClientRect().width || 1200) - 460)}
            get={() => layout.list} apply={v => rootRef.current?.style.setProperty('--lc-list', `${v}px`)}
            commit={v => saveLayout({ list: v })} reset={() => { rootRef.current?.style.setProperty('--lc-list', `${LAYOUT_DEFAULT.list}px`); saveLayout({ list: LAYOUT_DEFAULT.list }) }}/>
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
              {/* Lead bar: who, from which campaign, status, actions — one row on a wide screen */}
              {(() => {
                const telHref = `tel:+${String(selectedLead.phone || '').replace(/\D/g, '').replace(/^0/, '972')}`
                const curStage = PIPELINE.find(p => p.id === (stageBusy?.stage || crmLead?.leadStatus || 'new')) || PIPELINE[0]
                const stageCtl = onCrmStage && (
                  <div className="lc-stage" ref={stageRef}>
                    <button type="button" className="lc-btn lc-stage-btn" aria-haspopup="listbox" aria-expanded={stageMenu} title={t.stageTip}
                      onClick={() => setStageMenu(v => !v)} style={{ '--st': curStage.color }}>
                      <span className="lc-stage-dot" aria-hidden="true"/>
                      <span className="lc-stage-k">{t.stageLbl}:</span>
                      <span>{stageBusy?.stage ? t.stageMoving : (crmLead ? stageName(curStage) : '—')}</span>
                      <span aria-hidden="true" style={{ opacity: .6, fontSize: 10 }}>▾</span>
                    </button>
                    {stageBusy?.err && <span role="alert" className="lc-stage-err">{t.stageFail}</span>}
                    {stageMenu && (
                      <div className="lc-stage-menu" role="listbox" aria-label={t.stageLbl}>
                        {!crmLead && <div className="lc-stage-note">{t.stageNoCrm}</div>}
                        {PIPELINE.map(st => {
                          const on = !!crmLead && (crmLead.leadStatus || 'new') === st.id
                          return (
                            <button key={st.id} type="button" role="option" aria-selected={on} className={`lc-stage-opt${on ? ' on' : ''}`} onClick={() => moveStage(st.id)} style={{ '--st': st.color }}>
                              <span className="lc-stage-dot" aria-hidden="true"/>{stageName(st)}{on && <span aria-hidden="true" style={{ marginInlineStart: 'auto' }}>✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
                const statusCtl = narrow ? (
                  <select value={STATUS_CONFIG[selectedLead.status] && selectedLead.status !== 'saved_to_crm' ? selectedLead.status : 'new'} onChange={e => handleStatusChange(e.target.value)} aria-label={t.status} className="lc-input" style={{ width: 'auto', minHeight: 34, padding: '0 10px', fontWeight: 700, color: (STATUS_CONFIG[selectedLead.status] || STATUS_CONFIG.new).color }}>
                    {['new', 'contacted', 'scheduled', 'closed'].map(k => <option key={k} value={k}>{STATUS_CONFIG[k].label[lang] || STATUS_CONFIG[k].label.he}</option>)}
                  </select>
                ) : (
                  <div className="lc-seg" role="radiogroup" aria-label={t.status}>
                    {['new', 'contacted', 'scheduled', 'closed'].map(k => {
                      const s = STATUS_CONFIG[k]
                      const on = (selectedLead.status || 'new') === k
                      return <button key={k} role="radio" aria-checked={on} onClick={() => handleStatusChange(k)} style={on ? { background: s.bg, color: s.color } : undefined}>{s.label[lang] || s.label.he}</button>
                    })}
                  </div>
                )
                const tabs = onePane && (
                  <div className="lc-seg" role="tablist">
                    <button role="tab" aria-selected={pane === 'chat'} onClick={() => setPane('chat')} style={pane === 'chat' ? { background: 'rgba(var(--brand-rgb),.14)', color: BRAND } : undefined}>💬 {t.tabChat}</button>
                    <button role="tab" aria-selected={pane === 'info'} onClick={() => setPane('info')} style={pane === 'info' ? { background: 'rgba(var(--brand-rgb),.14)', color: BRAND } : undefined}>{t.tabInfo}</button>
                  </div>
                )
                return (
                  <div style={{ flexShrink: 0, padding: narrow ? '10px 12px' : '10px 16px', borderBottom: `1px solid ${BORDER}`, background: 'var(--au-card-solid)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {narrow && <button className="lc-btn icon" onClick={() => setSelectedId(null)} aria-label={t.back} title={t.back}>{dir === 'rtl' ? '→' : '←'}</button>}
                      <Avatar lead={selectedLead} size={narrow ? 38 : 42}/>
                      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                        {nameEdit?.id === selectedLead.id ? (() => {
                          const proj = shortLabel(selectedLead), suffix = proj ? ` · ${proj}` : ''
                          const has = !!suffix && nameEdit.value.trim().endsWith(suffix.trim())
                          const toggle = () => setNameEdit(e => ({ ...e, value: has ? e.value.trim().slice(0, -suffix.length).trim() : `${e.value.trim()}${suffix}` }))
                          return (
                            <form className="lc-name-form" onSubmit={e => { e.preventDefault(); saveName(selectedLead) }}>
                              <input autoFocus className="lc-name-in" aria-label={t.renameLbl} maxLength={80} value={nameEdit.value}
                                onChange={e => setNameEdit(x => ({ ...x, value: e.target.value, err: false }))} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setNameEdit(null) } }}/>
                              {proj && <button type="button" className="lc-btn" onClick={toggle}>{has ? t.removeProject : t.addProject(proj)}</button>}
                              <button type="submit" className="lc-btn primary" disabled={nameEdit.busy || !nameEdit.value.trim()}>{nameEdit.busy ? '…' : t.nameSave}</button>
                              <button type="button" className="lc-btn" onClick={() => setNameEdit(null)}>{t.nameCancel}</button>
                              <span style={{ flexBasis: '100%', fontSize: 11.5, color: nameEdit.err ? '#DC2626' : FAINT }} role={nameEdit.err ? 'alert' : undefined}>{nameEdit.err ? t.nameFail : t.nameHint}</span>
                            </form>
                          )
                        })() : (
                          <h2 style={{ margin: 0, fontSize: narrow ? 16 : 17, fontWeight: 800, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <button type="button" className="lc-name-btn" title={t.renameTip} onClick={() => startNameEdit(selectedLead)}>{isTestLead(selectedLead) ? t.testLead : (selectedLead.name || '—')}<span aria-hidden="true" className="lc-name-pen">✎</span></button>
                          </h2>
                        )}
                        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={getCampaignLabel(selectedLead) || ''}>
                          {shortLabel(selectedLead) || '—'} · {fmtWhen(selectedLead.created_at, lang)}{selectedLead.phone && !narrow ? <> · <bdi>{fmtPhone(selectedLead.phone)}</bdi></> : null}
                        </div>
                      </div>
                      {!narrow && statusCtl}
                      {!narrow && stageCtl}
                      {!narrow && onCrmPatch && <FollowUpButton lead={crmLead || { name: selectedLead.name, tasks: [] }} lang={lang} onSave={crmPatch}/>}
                      {!narrow && tabs}
                      {narrow
                        ? selectedLead.phone && <a className="lc-btn icon" href={telHref} aria-label={t.call} title={t.call}>📞</a>
                        : <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {selectedLead.phone && <a className="lc-btn" href={telHref}>📞 {t.call}</a>}
                            {selectedLead.phone && onOpenChat && <button className="lc-btn wa" onClick={() => onOpenChat(selectedLead)}>💬 {t.whatsapp}</button>}
                            {crmButton}
                          </div>}
                    </div>
                    {narrow && !focusChat && <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>{statusCtl}{stageCtl}{tabs}</div>}
                  </div>
                )
              })()}

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
                  <Splitter axis="x" gap min={LIMITS.aside[0]} grows={dir === 'rtl' ? 1 : -1} label={t.resizeAside}
                    max={() => Math.min(LIMITS.aside[1], (detailBoxRef.current?.getBoundingClientRect().width || 900) - 28 - 14 - 380)}
                    get={() => layout.aside} apply={v => rootRef.current?.style.setProperty('--lc-aside', `${v}px`)}
                    commit={v => saveLayout({ aside: v })} reset={() => { rootRef.current?.style.setProperty('--lc-aside', `${LAYOUT_DEFAULT.aside}px`); saveLayout({ aside: LAYOUT_DEFAULT.aside }) }}/>
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
                        ...(formFullName(selectedLead.raw_fields) ? [['formName', t.formNameLbl, formFullName(selectedLead.raw_fields), formFullName(selectedLead.raw_fields)]] : []),
                        ['phone', t.phone, selectedLead.phone ? fmtPhone(selectedLead.phone) : '—', selectedLead.phone ? fmtPhone(selectedLead.phone) : ''],
                        ['email', t.email, selectedLead.email || '—', selectedLead.email || ''],
                        ['campaign', t.campaign, selectedLead.campaign_name || '—'],
                        ['form', t.form, selectedLead.form_name || '—'],
                        ['received', t.received, fmtFull(selectedLead.created_at, lang)],
                      ].map(([key, k, v, copyVal]) => (
                        <div key={key} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderTop: `1px solid rgba(var(--ov),.06)` }}>
                          <span style={{ width: 64, flexShrink: 0, fontSize: 12, color: FAINT, fontWeight: 600 }}>{k}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: CREAM, overflowWrap: 'anywhere', textAlign: 'start', fontWeight: key === 'formName' ? 700 : undefined }}>{key === 'phone' || key === 'formName' ? <bdi>{v}</bdi> : v}</span>
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

                    {/* History: every inquiry from this phone, bookings, stage changes, notes, automatic sends */}
                    <div className="lc-card" style={{ padding: 14 }}>
                      <h3 style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 800, color: CREAM }}>{t.history}</h3>
                      {history.length <= 1 && !history.some(h => h.lines?.length) && <div style={{ fontSize: 12.5, color: MUTED }}>{t.historyEmpty}</div>}
                      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {(historyOpen ? history : history.slice(0, 8)).map((h, i) => (
                          <li key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i ? `1px solid rgba(var(--ov),.06)` : 'none', opacity: h.cancelled ? 0.6 : 1 }}>
                            <span aria-hidden style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 12, background: 'rgba(var(--ov),.06)' }}>{HISTORY_ICON[h.kind] || '•'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11.5, color: FAINT, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                {fmtFull(new Date(h.at).toISOString(), lang)}
                                {h.current && <span className="lc-chip" style={{ fontSize: 10.5, padding: '0 6px' }}>{t.historyNow}</span>}
                              </div>
                              <div style={{ fontSize: 13, color: CREAM, lineHeight: 1.5, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{h.title}</div>
                              {!h.current && h.lines?.map((x, j) => <div key={j} style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{x}</div>)}
                            </div>
                          </li>
                        ))}
                      </ol>
                      {history.length > 8 && <button className="lc-btn" style={{ minHeight: 28, fontSize: 12, marginTop: 6 }} onClick={() => setHistoryOpen(o => !o)}>{historyOpen ? t.historyLess : t.historyAll(history.length)}</button>}
                    </div>

                    {/* Follow-up with a WhatsApp reminder (lib/follow-up.js) — on the lead's CRM copy, like the board */}
                    {onCrmPatch && (
                      <div className="lc-card" style={{ padding: 14, display: 'grid', gap: 10 }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: CREAM }}>{t.fuCard}</h3>
                          <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{t.fuCardSub}</div>
                        </div>
                        <FollowUpComposer lead={crmLead || { name: selectedLead.name, tasks: [] }} lang={lang} onSave={crmPatch}/>
                        <FollowUpList lead={crmLead || { tasks: [] }} lang={lang} onSave={crmPatch}/>
                      </div>
                    )}

                    {/* Notes — the CRM lead's notes: the same list as the lead card, the board and the chats */}
                    {(() => {
                      const notes = leadNotes(crmLead, selectedLead)
                      return (
                        <div className="lc-card" style={{ padding: 14, display: 'grid', gap: 8 }}>
                          <label className="lc-label" htmlFor="lc-notes">{t.notes}</label>
                          <textarea id="lc-notes" value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder={t.notesPlaceholder} rows={3} className="lc-input" style={{ resize: 'vertical', direction: dir }}
                            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAddNote() } }}/>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <button className="lc-btn primary" onClick={handleAddNote} disabled={noteState === 'saving' || !noteInput.trim() || !onCrmPatch}>{noteState === 'saving' ? '…' : t.addNote}</button>
                            {noteState === 'saved' && <span role="status" className="lc-chip ok">✓ {t.noteSaved}</span>}
                            {noteState === 'failed' && <span role="alert" className="lc-chip warn">{t.noteSaveFailed}</span>}
                            <span style={{ fontSize: 11.5, color: FAINT }}>{t.notesShared}</span>
                          </div>
                          {!notes.length && <div style={{ fontSize: 12.5, color: MUTED }}>{t.notesNone}</div>}
                          {(notesOpen ? notes : notes.slice(0, 4)).map(n => (
                            <div key={n.id} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(var(--ov),.04)' }}>
                              <div style={{ fontSize: 11, color: FAINT }}>{n.ts ? fmtFull(new Date(n.ts).toISOString(), lang) : ''}</div>
                              <div style={{ fontSize: 13, color: CREAM, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.text}</div>
                            </div>
                          ))}
                          {notes.length > 4 && <button className="lc-btn" style={{ minHeight: 28, fontSize: 12, justifySelf: 'start' }} onClick={() => setNotesOpen(o => !o)}>{notesOpen ? t.notesLess : t.notesAll(notes.length)}</button>}
                          <label className="lc-label" htmlFor="lc-calltime" style={{ marginTop: 6 }}>{t.callTime}</label>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input id="lc-calltime" type="text" value={callTimeInput} onChange={e => setCallTimeInput(e.target.value)} placeholder={t.callTimePlaceholder} className="lc-input" style={{ direction: dir, flex: 1 }}/>
                            <button className="lc-btn" onClick={handleSaveNotes} disabled={callState === 'saving' || callTimeInput === (selectedLead.call_time || '')}>{t.saveNotes}</button>
                            {callState === 'saved' && <span role="status" className="lc-chip ok">✓</span>}
                            {callState === 'failed' && <span role="alert" className="lc-chip warn">{t.noteSaveFailed}</span>}
                          </div>
                        </div>
                      )
                    })()}

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
