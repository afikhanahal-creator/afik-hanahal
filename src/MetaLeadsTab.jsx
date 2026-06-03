// MetaLeadsTab.jsx — Meta Lead Ads Lead Center
// RTL, dark-theme UI matching the Afik Hanahal admin panel
// Props: { C, lang, isDark, onSaveToCRM }

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'
import MetaKanban from './MetaKanban'

const ADMIN_TOKEN = 'AFIKhanahal2026'
const META_PAGE_ID = '591701444021114'

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
  },
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  new:          { color: '#8490D8', bg: 'rgba(132,144,216,.18)', label: { he: 'חדש',        en: 'New' } },
  contacted:    { color: '#F97316', bg: 'rgba(249,115, 22,.18)', label: { he: 'נוצר קשר',   en: 'Contacted' } },
  scheduled:    { color: '#22C55E', bg: 'rgba( 34,197, 94,.18)', label: { he: 'נקבעה שיחה', en: 'Scheduled' } },
  closed:       { color: '#6B7280', bg: 'rgba(107,114,128,.18)', label: { he: 'סגור',        en: 'Closed' } },
  saved_to_crm: { color: '#22D3EE', bg: 'rgba(34,211,238,.18)',  label: { he: 'נשמר ב-CRM', en: 'Saved to CRM' } },
}

const CAMPAIGN_COLORS = ['#8490D8','#E05252','#3BAF7E','#E08C3A','#3A8FC7','#C2497E','#F59E0B']

const QUICK_REPLIES = {
  he: [
    { label: 'תיאום שיחה 📞',    message: 'היי {{firstName}}, ראינו שהשארתם פרטים באתר של {{project}}. מתי זמן נוח לדבר?' },
    { label: 'חזרה מהירה ⚡',    message: 'היי {{firstName}}, מדבר/ת מ{{project}}. ניסיתי להשיג אתכם בנוגע לפנייה שלכם — אפשר לחזור אליכם כעת או שעדיף מאוחר יותר?' },
    { label: 'תיאום פגישה 📅',   message: 'שלום {{firstName}}, תודה על העניין ב{{project}}. אשמח לתאם פגישה קצרה ולהציג את הפרטים והתוכניות. איזה יום מתאים לכם השבוע?' },
    { label: 'שליחת פרטים 📋',   message: 'היי {{firstName}}, כאן {{project}}. אשמח לשלוח לכם את כל הפרטים והתוכניות. מעדיפים שנעבור על זה יחד בשיחה קצרה?' },
    { label: 'בדיקת זמינות ✅',  message: 'שלום {{firstName}}, ראינו את הפנייה שלכם ל{{project}}. יש לי כמה דקות עכשיו — נוח לכם שנדבר?' },
  ],
  en: [
    { label: 'Schedule Call 📞',      message: "Hi {{firstName}}, we saw you left your details on {{project}}'s site. When's a good time to talk?" },
    { label: 'Quick Reply ⚡',        message: "Hi {{firstName}}, calling from {{project}}. I tried to reach you about your inquiry — can I call you now or would later be better?" },
    { label: 'Book Meeting 📅',       message: "Hello {{firstName}}, thank you for your interest in {{project}}. I'd love to schedule a quick meeting to present the details. Which day works for you this week?" },
    { label: 'Send Details 📋',       message: "Hi {{firstName}}, this is {{project}}. I'd be happy to send you all the details. Would you prefer to go over them together in a quick call?" },
    { label: 'Check Availability ✅', message: "Hello {{firstName}}, we saw your inquiry about {{project}}. I have a few minutes now — is it convenient for you to talk?" },
  ],
}

function applyTemplate(tpl, lead) {
  const firstName = lead?.name?.split(' ')[0] || ''
  const project   = lead?.campaign_name || lead?.form_name || 'הפרויקט שלנו'
  return tpl.replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{project\}\}/g, project)
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

function isNewRecent(lead) {
  if (lead.status !== 'new') return false
  return (Date.now() - new Date(lead.created_at)) < 86400000
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function fetchLeads() {
  const res = await fetch(`/api/meta/leads`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`HTTP ${res.status}${body.error ? ': ' + body.error : ''}`)
  }
  const data = await res.json()
  return data.leads || []
}

async function fetchMessages(leadId) {
  const res = await fetch(`/api/meta/messages?lead_id=${leadId}`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.messages || []
}

async function sendMessage(leadId, message) {
  const res = await fetch(`/api/meta/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify({ lead_id: leadId, message }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
  // Hover state lives in CSS (`.lead-row:hover`) — keeping it in React caused
  // a re-render of all 100+ leads on every mouse move, which froze the scroll.
  const [deletedLeads, setDeletedLeads] = useState([])
  const [showRestore, setShowRestore]   = useState(false)
  const [campaignDropOpen, setCampaignDropOpen] = useState(false)
  const [sortOrder, setSortOrder]               = useState('desc') // 'desc' = newest first
  const [metaView, setMetaView]                 = useState('pipeline') // 'chat' | 'pipeline' | 'table' — default to Kanban
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
      leadsIntervalRef.current = setInterval(() => loadLeads(true), 30000)
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
      messagesIntervalRef.current = setInterval(() => loadMessages(selectedLead.id, true), 15000)
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

  // ── Auto-sync from Meta every 5 min (covers missing webhook) ────────────────
  useEffect(() => {
    const run = async () => {
      try { await syncLeads(META_PAGE_ID) } catch {} // silent failures are fine
      try { await fetchLeads().then(data => {
        const visible = data.filter(l => !deletedIdsRef.current.has(l.id))
        setLeads(visible)
      }) } catch {}
    }
    const t = setTimeout(run, 20000) // first run 20s after mount
    autoSyncRef.current = setInterval(run, 5 * 60 * 1000)
    return () => { clearTimeout(t); clearInterval(autoSyncRef.current) }
  }, []) // eslint-disable-line

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
    try {
      const newMsg = await sendMessage(selectedLead.id, msg)
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
    } finally {
      setSending(false)
    }
  }

  // ── Quick reply → open WhatsApp with pre-filled message ──────────────────────
  const handleQuickReply = (qr) => {
    if (!selectedLead?.phone) return
    const message = applyTemplate(qr.message, selectedLead)
    const url = `https://wa.me/${selectedLead.phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // ── Sync ─────────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncLeads(META_PAGE_ID)
      setSyncResult(`${result.synced || 0} ${lang === 'en' ? 'leads synced' : 'לידים סונכרנו'}`)
      await loadLeads(true)
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
      return matchStatus && matchSearch && matchCampaign
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
  const BG      = '#09090F'
  const CARD    = '#0E0E1C'
  const BORDER  = 'rgba(132,144,216,.12)'
  const MUTED   = 'rgba(232,228,216,.35)'
  const CREAM   = '#E8E4D8'
  const PURPLE  = '#8490D8'
  const GREEN   = '#82F67F'

  const statusTabs = [
    { id: 'all',       label: t.filterAll },
    { id: 'new',       label: t.filterNew },
    { id: 'contacted', label: t.filterContacted },
    { id: 'scheduled', label: t.filterScheduled },
    { id: 'closed',    label: t.filterClosed },
  ]

  // Single toggle: Pipeline (Kanban) ↔ Lead Center (Chat). The Pipeline/Table
  // sub-toggle lives inside MetaKanban — no need to duplicate it here.
  const inChat = metaView === 'chat'

  // Red badge: count leads that landed AFTER the user's last visit to the Lead
  // Center. Cleared the moment Afik clicks the button to enter the chat view.
  const unreadCount = inChat ? 0 : leads.reduce((n, l) => {
    const t = new Date(l.created_at).getTime()
    return Number.isFinite(t) && t > lastVisitTs ? n + 1 : n
  }, 0)

  function handleViewToggle() {
    if (!inChat) {
      const now = Date.now()
      setLastVisitTs(now)
      try { localStorage.setItem('meta_chat_last_visit_v1', String(now)) } catch {}
    }
    setMetaView(inChat ? 'pipeline' : 'chat')
  }

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalLeads    = leads.length
  const newLeads      = leads.filter(l => l.status === 'new').length
  const contacted     = leads.filter(l => l.status === 'contacted' || l.status === 'scheduled').length
  const waSentCount   = leads.filter(l => l.wa_sent).length

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      overflow: 'hidden',
      direction: dir,
      fontFamily: 'Rubik, sans-serif',
      background: BG,
      flexDirection: 'column',
    }}>

      {/* ── Premium Header: title + stats + view toggle ── */}
      <div style={{
        flexShrink: 0,
        background: 'linear-gradient(180deg, rgba(132,144,216,.10) 0%, rgba(14,14,28,.98) 100%)',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        {/* Top bar: branding + toggle */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px 8px', direction:'rtl' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:`linear-gradient(135deg,${PURPLE},#6070C8)`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 4px 12px ${PURPLE}44` }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:CREAM, letterSpacing:'-.01em' }}>
                {lang === 'en' ? 'Lead Center' : 'מרכז לידים'}
              </div>
              <div style={{ fontSize:10, color:`${PURPLE}99`, fontWeight:600, marginTop:1 }}>
                Meta · Facebook · Instagram
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {syncResult && (
              <span style={{ fontSize:10, color:GREEN, fontWeight:700, background:'rgba(130,246,127,.12)', padding:'3px 10px', borderRadius:20, border:'1px solid rgba(130,246,127,.25)' }}>
                {syncResult}
              </span>
            )}
            <button onClick={handleSync} disabled={syncing}
              style={{ padding:'6px 13px', background:syncing?`${PURPLE}12`:`${PURPLE}20`, border:`1px solid ${PURPLE}55`, borderRadius:8, color:PURPLE, fontSize:11, fontWeight:700, cursor:syncing?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:5, transition:'all .15s' }}
              onMouseEnter={e=>{ if(!syncing){e.currentTarget.style.background=`${PURPLE}38`} }}
              onMouseLeave={e=>{ if(!syncing){e.currentTarget.style.background=`${PURPLE}20`} }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? 'gm_spin .7s linear infinite' : 'none' }}>
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {syncing ? t.syncing : t.sync}
            </button>
            <button type="button" onClick={handleViewToggle}
              style={{ position:'relative', display:'flex', alignItems:'center', gap:7, padding:'7px 16px', borderRadius:8, border:`1px solid ${PURPLE}70`, background: inChat ? `linear-gradient(135deg,${PURPLE}30,${PURPLE}18)` : `linear-gradient(135deg,rgba(34,197,94,.22),rgba(34,197,94,.12))`, color: inChat ? PURPLE : '#22C55E', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', userSelect:'none' }}
              onMouseEnter={e=>{ e.currentTarget.style.opacity='.85' }}
              onMouseLeave={e=>{ e.currentTarget.style.opacity='1' }}
            >
              {inChat ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="3" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="10" rx="1"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              )}
              {inChat ? 'Pipeline' : 'LEAD CENTER'}
              {unreadCount > 0 && (
                <span style={{ position:'absolute', top:-7, left:-7, minWidth:20, height:20, padding:'0 5px', borderRadius:999, background:'linear-gradient(135deg,#E05252,#C8392E)', color:'#fff', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(224,82,82,.5)', animation:'meta-lead-badge-pulse 1.6s ease-out infinite', pointerEvents:'none' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display:'flex', gap:0, padding:'0 16px 12px', direction:'rtl' }}>
          {[
            { label: lang==='en'?'Total':'סה"כ לידים',  value: totalLeads,  color: PURPLE,    icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
            { label: lang==='en'?'New':'חדשים',          value: newLeads,    color: '#E05252', icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
            { label: lang==='en'?'In Progress':'בטיפול', value: contacted,   color: '#F97316', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
            { label: lang==='en'?'WA Sent':'WA נשלח',   value: waSentCount, color: '#25D366', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
          ].map((s, i) => (
            <div key={i} style={{ flex:1, display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:`rgba(255,255,255,.02)`, border:`1px solid ${BORDER}`, borderRadius: i===0?'10px 0 0 10px' : i===3?'0 10px 10px 0' : '0', borderLeft: i>0 ? 'none' : `1px solid ${BORDER}` }}>
              <div style={{ width:28, height:28, borderRadius:7, background:`${s.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={s.icon}/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:10, color:`${CREAM}55`, fontWeight:600, marginTop:2 }}>{s.label}</div>
              </div>
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
              fetch('/api/meta/leads', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
                body: JSON.stringify({ id: lead.id, deleted_at: now }),
              }).catch(() => {})
            }}
          />
        </div>
      )}

      {/* ── Chat view ── */}
      {metaView === 'chat' && <div style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}>

      {/* ─────────────────── LEFT PANEL: Lead List ─────────────────────── */}
      <div style={{
        width: 330,
        flexShrink: 0,
        borderLeft: `1px solid ${BORDER}`,
        display: 'flex',
        flexDirection: 'column',
        background: CARD,
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 14px 10px',
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:13, fontWeight:800, color:CREAM }}>{filteredLeads.length}</span>
              <span style={{ fontSize:12, color:MUTED, fontWeight:600 }}>{t.leadsCount}</span>
            </div>
            <div style={{ display:'flex', gap:5 }}>
              {deletedLeads.length > 0 && (
                <button onClick={() => setShowRestore(!showRestore)}
                  style={{ padding:'5px 9px', background:showRestore?'rgba(224,82,82,.2)':'rgba(224,82,82,.08)', border:`1px solid rgba(224,82,82,.${showRestore?'5':'2'})`, borderRadius:7, color:'#E05252', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:3, transition:'all .15s' }}>
                  <span>↩</span>
                  <span style={{ background:'rgba(224,82,82,.2)', borderRadius:10, padding:'0 5px', fontSize:10 }}>{deletedLeads.length}</span>
                </button>
              )}
              <button onClick={() => setSortOrder(v => v==='desc'?'asc':'desc')}
                style={{ padding:'5px 9px', background:'rgba(255,255,255,.04)', border:`1px solid ${BORDER}`, borderRadius:7, color:MUTED, cursor:'pointer', fontSize:11, fontFamily:'inherit', transition:'all .15s', display:'flex', alignItems:'center', gap:2 }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(255,255,255,.09)'; e.currentTarget.style.color=CREAM }}
                onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,.04)'; e.currentTarget.style.color=MUTED }}>
                {sortOrder==='desc'?'↓':'↑'}
              </button>
            </div>
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.search}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 12px',
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              color: CREAM,
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              direction: dir,
              marginBottom: 10,
            }}
          />

          {/* Status filter tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {statusTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '4px 10px',
                  border: 'none',
                  borderRadius: 20,
                  background: statusFilter === tab.id ? `${PURPLE}22` : 'transparent',
                  color: statusFilter === tab.id ? PURPLE : MUTED,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all .12s',
                  outline: statusFilter === tab.id ? `1px solid ${PURPLE}44` : 'none',
                }}
              >
                {tab.label}
                {tab.id !== 'all' && (
                  <span style={{ marginRight: dir === 'rtl' ? 4 : 0, marginLeft: dir === 'ltr' ? 4 : 0, color: statusFilter === tab.id ? PURPLE : 'rgba(232,228,216,.25)' }}>
                    {leads.filter(l => l.status === tab.id).length || ''}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Campaign filter dropdown */}
          <div ref={campaignDropRef} style={{ position: 'relative', marginTop: 10 }}>
            <button
              onClick={() => setCampaignDropOpen(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '9px 13px',
                background: campaignFilter
                  ? `linear-gradient(135deg, rgba(132,144,216,.22) 0%, rgba(132,144,216,.12) 100%)`
                  : `linear-gradient(135deg, rgba(132,144,216,.13) 0%, rgba(132,144,216,.06) 100%)`,
                border: `1px solid ${campaignFilter ? PURPLE + '80' : 'rgba(132,144,216,.38)'}`,
                borderRadius: 10,
                color: campaignFilter ? PURPLE : 'rgba(232,228,216,.75)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .15s',
                boxShadow: campaignFilter ? `0 0 0 2px ${PURPLE}22` : '0 1px 6px rgba(0,0,0,.3)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(132,144,216,.28) 0%, rgba(132,144,216,.16) 100%)'
                e.currentTarget.style.borderColor = PURPLE + 'aa'
                e.currentTarget.style.color = PURPLE
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = campaignFilter
                  ? 'linear-gradient(135deg, rgba(132,144,216,.22) 0%, rgba(132,144,216,.12) 100%)'
                  : 'linear-gradient(135deg, rgba(132,144,216,.13) 0%, rgba(132,144,216,.06) 100%)'
                e.currentTarget.style.borderColor = campaignFilter ? PURPLE + '80' : 'rgba(132,144,216,.38)'
                e.currentTarget.style.color = campaignFilter ? PURPLE : 'rgba(232,228,216,.75)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.8 }}>
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                {campaignFilter && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAMPAIGN_COLORS[campaigns.indexOf(campaignFilter) % CAMPAIGN_COLORS.length], flexShrink: 0 }}/>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {campaignFilter || (lang === 'en' ? 'All Campaigns' : 'כל הקמפיינים')}
                </span>
                {campaignFilter && (
                  <span style={{ background: PURPLE + '30', color: PURPLE, borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                    {filteredLeads.length}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 9, flexShrink: 0, color: PURPLE, opacity: 0.7 }}>
                {campaignDropOpen ? '▲' : '▼'}
              </span>
            </button>

            {campaignDropOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0, left: 0, zIndex: 200,
                background: '#0E0E1C', border: `1px solid ${BORDER}`, borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,.55)', overflow: 'hidden',
                maxHeight: 260, overflowY: 'auto',
              }}>
                {/* All campaigns option */}
                <button
                  onClick={() => { setCampaignFilter(null); setCampaignDropOpen(false) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', border: 'none', borderBottom: `1px solid ${BORDER}`,
                    background: !campaignFilter ? 'rgba(132,144,216,.1)' : 'transparent',
                    color: !campaignFilter ? PURPLE : MUTED,
                    fontSize: 12, fontWeight: !campaignFilter ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right', direction: dir,
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (campaignFilter) e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
                  onMouseLeave={e => { if (campaignFilter) e.currentTarget.style.background = 'transparent' }}
                >
                  <span>{lang === 'en' ? 'All Campaigns' : 'כל הקמפיינים'}</span>
                  <span style={{ background: 'rgba(132,144,216,.15)', color: PURPLE, borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                    {leads.length}
                  </span>
                </button>

                {campaigns.length === 0 && (
                  <div style={{ padding: '12px 14px', fontSize: 12, color: MUTED, textAlign: 'center' }}>
                    {lang === 'en' ? 'No campaigns yet' : 'אין קמפיינים עדיין'}
                  </div>
                )}

                {campaigns.map((camp, i) => {
                  const color = CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]
                  const isActive = campaignFilter === camp
                  const count = leads.filter(l => getCampaignLabel(l) === camp).length
                  return (
                    <button key={camp}
                      onClick={() => { setCampaignFilter(isActive ? null : camp); setCampaignDropOpen(false) }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', border: 'none', borderBottom: `1px solid ${BORDER}`,
                        background: isActive ? `${color}14` : 'transparent',
                        color: isActive ? color : MUTED,
                        fontSize: 12, fontWeight: isActive ? 700 : 400,
                        cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right', direction: dir,
                        transition: 'background .1s',
                      }}
                      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = `${color}0D`; e.currentTarget.style.color = color } }}
                      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = MUTED } }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }}/>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{camp}</span>
                      <span style={{ background: `${color}22`, color, borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                        {count}
                      </span>
                      {isActive && <span style={{ fontSize: 12, flexShrink: 0 }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Restore panel */}
        {showRestore && deletedLeads.length > 0 && (
          <div style={{ flexShrink: 0, borderBottom: `1px solid rgba(224,82,82,.15)`, background: 'rgba(224,82,82,.04)', maxHeight: 220, overflowY: 'auto' }}>
            <div style={{ padding: '8px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'rgba(224,82,82,.6)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                {lang === 'en' ? 'Archived' : 'ארכיון'} ({deletedLeads.length})
              </span>
              <button onClick={handleRestoreAll}
                style={{ padding: '4px 10px', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 7, color: '#22C55E', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, transition: 'all .12s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,.2)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,.5)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,197,94,.1)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,.25)' }}>
                ↩ {lang === 'en' ? 'Restore all' : 'שחזר הכל'}
              </button>
            </div>
            {deletedLeads.map(lead => (
              <div key={lead.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderTop: '1px solid rgba(255,255,255,.03)', direction: dir }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(224,82,82,.12)', border: '1px solid rgba(224,82,82,.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: 'rgba(224,82,82,.6)',
                }}>
                  {initials(lead.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(232,228,216,.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.name || '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(232,228,216,.28)', marginTop: 1 }}>
                    {getCampaignLabel(lead) || lead.phone || ''}
                  </div>
                </div>
                <button onClick={() => handleRestoreLead(lead)}
                  style={{
                    flexShrink: 0, padding: '4px 10px',
                    background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.25)',
                    borderRadius: 8, color: '#22C55E', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'all .12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,.2)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,.5)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,197,94,.1)'; e.currentTarget.style.borderColor = 'rgba(34,197,94,.25)' }}
                >
                  ↩ {lang === 'en' ? 'Restore' : 'שחזר'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Lead list — smooth scroll (desktop wheel + mobile touch inertia).
            CSS `contain` + GPU layer hint keep the long list paint-isolated so
            scrolling stays at 60fps even with 100+ rows.                    */}
        <div className="meta-leads-scroll meta-leads-list" style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          scrollbarGutter: 'stable',
          touchAction: 'pan-y',
          willChange: 'scroll-position',
          transform: 'translateZ(0)',
          paddingBottom: 16,
        }}>
          {loadingLeads && (
            <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>{t.loading}</div>
          )}
          {leadsError && (
            <div style={{ padding: 16, color: '#E05252', fontSize: 12 }}>{t.error}: {leadsError}</div>
          )}
          {!loadingLeads && filteredLeads.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto', display: 'block' }}>
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke={PURPLE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ color: CREAM, fontSize: 14, fontWeight: 700 }}>{t.noLeads}</div>
              <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>{t.noLeadsDesc}</div>
            </div>
          )}
          {filteredLeads.map(lead => {
            const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new
            const isSelected = selectedLead?.id === lead.id
            const color = avatarColors(lead.name)
            const showNewDot = isNewRecent(lead)
            return (
              <div
                key={lead.id}
                className={`lead-row${isSelected ? ' is-selected' : ''}`}
                onClick={() => setSelectedLead(lead)}
                style={{
                  padding: '11px 14px 11px 16px',
                  borderBottom: `1px solid rgba(255,255,255,.04)`,
                  cursor: 'pointer',
                  background: isSelected ? `linear-gradient(135deg,rgba(132,144,216,.14),rgba(132,144,216,.06))` : 'transparent',
                  borderRight: isSelected ? `3px solid ${PURPLE}` : '3px solid transparent',
                  borderLeft: `3px solid ${sc.color}${isSelected ? 'cc' : '44'}`,
                  transition: 'all .12s',
                  position: 'relative',
                  contain: 'layout style',
                }}
              >
                <button
                  className="lead-row-archive"
                  onClick={(e) => handleDeleteLead(lead, e)}
                  aria-label={lang === 'en' ? 'Archive lead' : 'העבר לארכיון'}
                  style={{ position:'absolute', top:'50%', left:dir==='rtl'?8:undefined, right:dir==='ltr'?8:undefined, width:26, height:26, background:'rgba(224,82,82,.1)', border:'1px solid rgba(224,82,82,.25)', borderRadius:'50%', color:'rgba(224,82,82,.8)', cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', zIndex:2, backdropFilter:'blur(6px)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                </button>

                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  {/* Avatar */}
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:`linear-gradient(135deg,${color}30,${color}15)`, border:`1.5px solid ${color}50`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color }}>
                      {initials(lead.name)}
                    </div>
                    {showNewDot && (
                      <div style={{ position:'absolute', bottom:-1, right:-1, width:10, height:10, borderRadius:'50%', background:'#22C55E', border:'2px solid #0E0E1C', boxShadow:'0 0 6px #22C55E' }} />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:isSelected?CREAM:`${CREAM}cc`, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                        {lead.name || '—'}
                      </span>
                      <span style={{ fontSize:9.5, color:`${CREAM}40`, flexShrink:0, marginRight:4, fontFeatureSettings:'"tnum"' }}>
                        {timeAgo(lead.created_at, lang)}
                      </span>
                    </div>

                    <div style={{ fontSize:11, color:`${PURPLE}99`, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:5, fontWeight:500 }}>
                      {lead.campaign_name || lead.form_name || '—'}
                    </div>

                    <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                      <span style={{ fontSize:10, fontWeight:700, color:sc.color, background:sc.bg, padding:'2px 8px', borderRadius:20, border:`1px solid ${sc.color}30` }}>
                        {sc.label[lang] || sc.label.he}
                      </span>
                      {lead.phone && (
                        <span style={{ fontSize:10, color:`${CREAM}45`, fontFeatureSettings:'"tnum"' }}>{fmtPhone(lead.phone)}</span>
                      )}
                      {lead.wa_sent && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#25D366" title={t.waSent}>
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      )}
                      {lead.message_count > 0 && (
                        <span style={{ fontSize:10, color:PURPLE, background:`${PURPLE}18`, padding:'1px 6px', borderRadius:10 }}>
                          {lead.message_count}💬
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─────────────────── RIGHT PANEL: Conversation ─────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: BG,
      }}>
        {!selectedLead ? (
          // Premium empty state
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:40 }}>
            <div style={{ position:'relative' }}>
              <div style={{ width:80, height:80, borderRadius:20, background:`linear-gradient(135deg,${PURPLE}25,${PURPLE}10)`, border:`1px solid ${PURPLE}30`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 0 40px ${PURPLE}20` }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div style={{ position:'absolute', bottom:-4, right:-4, width:24, height:24, borderRadius:'50%', background:'linear-gradient(135deg,#E05252,#C8392E)', display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #09090F' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.36 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.83a16 16 0 0 0 8.26 8.26l.98-1.34a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ color:CREAM, fontSize:18, fontWeight:800, marginBottom:8 }}>{t.selectLead}</div>
              <div style={{ color:`${CREAM}44`, fontSize:13, lineHeight:1.6, maxWidth:260 }}>{t.selectLeadDesc}</div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              {[STATUS_CONFIG.new, STATUS_CONFIG.contacted, STATUS_CONFIG.scheduled].map((sc,i) => (
                <div key={i} style={{ padding:'4px 12px', borderRadius:20, background:sc.bg, border:`1px solid ${sc.color}30`, fontSize:10, fontWeight:700, color:sc.color }}>
                  {sc.label[lang] || sc.label.he}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── Lead Hero Header ─────────────────────────────────── */}
            <div style={{ flexShrink:0, borderBottom:`1px solid ${BORDER}`, background:`linear-gradient(180deg,rgba(132,144,216,.08) 0%,${CARD} 100%)` }}>
              {/* Profile row */}
              <div style={{ padding:'16px 20px 12px', display:'flex', gap:14, alignItems:'center', flexWrap:'wrap' }}>
                {/* Avatar */}
                <div style={{ position:'relative', flexShrink:0 }}>
                  <div style={{ width:52, height:52, borderRadius:14, background:`linear-gradient(135deg,${avatarColors(selectedLead.name)}35,${avatarColors(selectedLead.name)}18)`, border:`2px solid ${avatarColors(selectedLead.name)}50`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:900, color:avatarColors(selectedLead.name), boxShadow:`0 4px 16px ${avatarColors(selectedLead.name)}30` }}>
                    {initials(selectedLead.name)}
                  </div>
                  {selectedLead.wa_sent && (
                    <div style={{ position:'absolute', bottom:-3, right:-3, width:18, height:18, borderRadius:'50%', background:'#25D366', border:`2px solid ${CARD}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                  )}
                </div>

                {/* Name + phone + campaign */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:17, fontWeight:800, color:CREAM }}>{selectedLead.name || '—'}</span>
                    <span style={{ fontSize:10, fontWeight:700, color:(STATUS_CONFIG[selectedLead.status||'new']?.color||PURPLE), background:(STATUS_CONFIG[selectedLead.status||'new']?.bg||STATUS_CONFIG.new.bg), padding:'2px 9px', borderRadius:20, border:`1px solid ${STATUS_CONFIG[selectedLead.status||'new']?.color||PURPLE}30` }}>
                      {STATUS_CONFIG[selectedLead.status||'new']?.label[lang] || STATUS_CONFIG.new.label.he}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    {selectedLead.phone && (
                      <a href={`https://wa.me/${selectedLead.phone}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:'#25D366', textDecoration:'none', display:'flex', alignItems:'center', gap:4, background:'rgba(37,211,102,.1)', border:'1px solid rgba(37,211,102,.25)', padding:'3px 9px', borderRadius:20 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        {fmtPhone(selectedLead.phone)}
                      </a>
                    )}
                    {selectedLead.email && (
                      <span style={{ fontSize:11, color:MUTED, background:'rgba(255,255,255,.05)', padding:'3px 9px', borderRadius:20, border:`1px solid ${BORDER}` }}>
                        {selectedLead.email}
                      </span>
                    )}
                    {(selectedLead.campaign_name || selectedLead.form_name) && (
                      <span style={{ fontSize:11, color:PURPLE, background:`${PURPLE}12`, padding:'3px 9px', borderRadius:20, border:`1px solid ${PURPLE}30` }}>
                        {selectedLead.campaign_name || selectedLead.form_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                  <select value={selectedLead.status||'new'} onChange={e=>handleStatusChange(e.target.value)}
                    style={{ padding:'6px 11px', background:STATUS_CONFIG[selectedLead.status||'new']?.bg||STATUS_CONFIG.new.bg, border:`1px solid ${STATUS_CONFIG[selectedLead.status||'new']?.color||PURPLE}44`, borderRadius:8, color:STATUS_CONFIG[selectedLead.status||'new']?.color||PURPLE, fontSize:11, fontWeight:700, fontFamily:'inherit', cursor:'pointer', outline:'none', direction:dir }}>
                    {Object.entries(STATUS_CONFIG).map(([key,sc]) => (
                      <option key={key} value={key} style={{ background:'#0E0E1C', color:sc.color }}>{sc.label[lang]||sc.label.he}</option>
                    ))}
                  </select>
                  <button onClick={handleSaveToCRM}
                    style={{ padding:'6px 13px', background:selectedLead.status==='saved_to_crm'?'rgba(34,211,238,.22)':savedToCRM?'rgba(34,211,238,.2)':'rgba(34,211,238,.1)', border:`1px solid rgba(34,211,238,.${selectedLead.status==='saved_to_crm'?'55':savedToCRM?'5':'3'})`, borderRadius:8, color:'#22D3EE', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .15s', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}>
                    {selectedLead.status==='saved_to_crm' ? (
                      <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>{lang==='en'?'In CRM · Undo':'בCRM · בטל'}</>
                    ) : savedToCRM ? t.savedToCRM : t.saveToCRM}
                  </button>
                </div>
              </div>

              {/* Notes + call time */}
              <div style={{ padding:'0 20px 14px', display:'flex', gap:8, flexWrap:'wrap' }}>
                <div style={{ flex:2, minWidth:180 }}>
                  <label style={{ fontSize:10, color:MUTED, fontWeight:700, display:'block', marginBottom:4, letterSpacing:'.05em' }}>{t.notes}</label>
                  <textarea value={noteInput} onChange={e=>setNoteInput(e.target.value)} placeholder={t.notesPlaceholder} rows={2}
                    style={{ width:'100%', boxSizing:'border-box', padding:'7px 10px', background:'rgba(255,255,255,.04)', border:`1px solid ${BORDER}`, borderRadius:8, resize:'none', color:CREAM, fontSize:12, fontFamily:'inherit', outline:'none', direction:dir }} />
                </div>
                <div style={{ flex:1, minWidth:130 }}>
                  <label style={{ fontSize:10, color:MUTED, fontWeight:700, display:'block', marginBottom:4, letterSpacing:'.05em' }}>{t.callTime}</label>
                  <input type="text" value={callTimeInput} onChange={e=>setCallTimeInput(e.target.value)} placeholder={t.callTimePlaceholder}
                    style={{ width:'100%', boxSizing:'border-box', padding:'7px 10px', background:'rgba(255,255,255,.04)', border:`1px solid ${BORDER}`, borderRadius:8, color:CREAM, fontSize:12, fontFamily:'inherit', outline:'none', direction:dir }} />
                </div>
                <div style={{ display:'flex', alignItems:'flex-end' }}>
                  <button onClick={handleSaveNotes}
                    style={{ padding:'7px 14px', background:noteSaved?'rgba(130,246,127,.14)':`${PURPLE}18`, border:`1px solid ${noteSaved?'rgba(130,246,127,.4)':PURPLE+'44'}`, borderRadius:8, color:noteSaved?GREEN:PURPLE, fontSize:12, fontWeight:700, fontFamily:'inherit', cursor:'pointer', transition:'all .15s', display:'flex', alignItems:'center', gap:5 }}>
                    {noteSaved ? (
                      <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>{t.noteSaved}</>
                    ) : t.saveNotes}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Conversation thread ────────────────────────────── */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '16px 20px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {loadingMessages && (
                <div style={{ textAlign: 'center', color: MUTED, fontSize: 13, padding: 24 }}>{t.loading}</div>
              )}
              {messagesError && (
                <div style={{ color: '#E05252', fontSize: 12, padding: 8 }}>{t.error}: {messagesError}</div>
              )}
              {!loadingMessages && messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ color: CREAM, fontSize: 14, fontWeight: 700, opacity: .4 }}>{t.noMessages}</div>
                  <div style={{ color: MUTED, fontSize: 12, opacity: .7 }}>{t.noMessagesDesc}</div>
                </div>
              )}

              {groupedMessages.map(item => {
                if (item.type === 'date') {
                  return (
                    <div key={item.key} style={{ textAlign: 'center', margin: '8px 0' }}>
                      <span style={{ fontSize: 11, color: MUTED, background: 'rgba(255,255,255,.05)', padding: '3px 12px', borderRadius: 20 }}>
                        {item.label}
                      </span>
                    </div>
                  )
                }
                const msg = item.msg
                const isOut = msg.direction === 'out'
                return (
                  <div key={item.key} style={{
                    display: 'flex',
                    justifyContent: isOut ? (dir === 'rtl' ? 'flex-start' : 'flex-end') : (dir === 'rtl' ? 'flex-end' : 'flex-start'),
                    marginBottom: 4,
                  }}>
                    <div style={{
                      maxWidth: '72%',
                      padding: '9px 13px',
                      borderRadius: isOut
                        ? (dir === 'rtl' ? '14px 4px 14px 14px' : '4px 14px 14px 14px')
                        : (dir === 'rtl' ? '4px 14px 14px 14px' : '14px 4px 14px 14px'),
                      background: isOut ? 'rgba(37,211,102,.18)' : 'rgba(255,255,255,.07)',
                      border: `1px solid ${isOut ? 'rgba(37,211,102,.3)' : BORDER}`,
                    }}>
                      <div style={{ fontSize: 13, color: CREAM, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.message}
                      </div>
                      <div style={{ fontSize: 10, color: isOut ? 'rgba(37,211,102,.5)' : MUTED, marginTop: 4, textAlign: 'end' }}>
                        {fmtTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })}

              <div ref={messagesEndRef}/>
            </div>

            {/* ── Message input ──────────────────────────────────── */}
            <div style={{
              padding: '12px 16px',
              borderTop: `1px solid ${BORDER}`,
              flexShrink: 0,
              background: CARD,
            }}>
              {/* Quick replies + Chat button */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(QUICK_REPLIES[lang] || QUICK_REPLIES.he).map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickReply(qr)}
                    disabled={!selectedLead?.phone}
                    title={selectedLead ? applyTemplate(qr.message, selectedLead) : ''}
                    style={{
                      padding: '6px 14px',
                      background: 'rgba(255,255,255,.04)',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 20,
                      color: MUTED,
                      fontSize: 11, fontWeight: 600,
                      cursor: !selectedLead?.phone ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all .12s',
                      whiteSpace: 'nowrap',
                      opacity: !selectedLead?.phone ? 0.5 : 1,
                    }}
                    onMouseEnter={e => { if (selectedLead?.phone) { e.currentTarget.style.background = 'rgba(37,211,102,.1)'; e.currentTarget.style.color = '#25D366'; e.currentTarget.style.borderColor = 'rgba(37,211,102,.3)' }}}
                    onMouseLeave={e => { if (selectedLead?.phone) { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER }}}
                  >
                    {qr.label}
                  </button>
                ))}
                {onOpenChat && (
                  <button
                    onClick={() => onOpenChat(selectedLead)}
                    title={lang === 'en' ? 'Open in Chat' : 'פתח בצ\'אט'}
                    style={{
                      padding: '6px 14px',
                      background: 'rgba(130,246,127,.08)',
                      border: '1px solid rgba(130,246,127,.25)',
                      borderRadius: 20,
                      color: '#82F67F',
                      fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5,
                      transition: 'all .12s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(130,246,127,.18)'; e.currentTarget.style.borderColor = 'rgba(130,246,127,.5)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(130,246,127,.08)'; e.currentTarget.style.borderColor = 'rgba(130,246,127,.25)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    {lang === 'en' ? 'Chat' : 'צ\'אט'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      </div>}

    </div>
  )
}
