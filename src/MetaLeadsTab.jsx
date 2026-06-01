// MetaLeadsTab.jsx — Meta Lead Ads Lead Center
// RTL, dark-theme UI matching the Afik Hanahal admin panel
// Props: { C, lang, isDark }

import { useState, useEffect, useRef, useCallback } from 'react'

const ADMIN_TOKEN = 'AFIKhanahal2026'
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

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
    quickReply1: 'מתי נוח לך?',
    quickReply2: 'תיאום שיחה',
    quickReply3: 'מידע נוסף',
    statusNew: 'חדש',
    statusContacted: 'נוצר קשר',
    statusScheduled: 'נקבעה שיחה',
    statusClosed: 'סגור',
    leadsCount: 'לידים',
    saveNotes: 'שמור הערות',
    noteSaved: 'נשמר',
    callTime: 'זמן שיחה',
    callTimePlaceholder: 'ניתן להגדיר לאחר השיחה...',
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
    quickReply1: 'When are you available?',
    quickReply2: 'Schedule a call',
    quickReply3: 'More info',
    statusNew: 'New',
    statusContacted: 'Contacted',
    statusScheduled: 'Scheduled',
    statusClosed: 'Closed',
    leadsCount: 'leads',
    saveNotes: 'Save notes',
    noteSaved: 'Saved',
    callTime: 'Call time',
    callTimePlaceholder: 'Set after the call...',
  },
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  new:        { color: '#8490D8', bg: 'rgba(132,144,216,.18)', label: { he: 'חדש',        en: 'New' } },
  contacted:  { color: '#F97316', bg: 'rgba(249,115, 22,.18)', label: { he: 'נוצר קשר',   en: 'Contacted' } },
  scheduled:  { color: '#22C55E', bg: 'rgba( 34,197, 94,.18)', label: { he: 'נקבעה שיחה', en: 'Scheduled' } },
  closed:     { color: '#6B7280', bg: 'rgba(107,114,128,.18)', label: { he: 'סגור',        en: 'Closed' } },
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

// ── API calls ─────────────────────────────────────────────────────────────────
async function fetchLeads() {
  const res = await fetch(`/api/meta/leads`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
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

async function updateLeadStatus(leadId, status) {
  // We do this via Supabase directly from the API — for now, update local state only
  // Full implementation would call a PATCH endpoint; keeping it simple for now
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MetaLeadsTab({ C, lang, isDark }) {
  const t = TR[lang] || TR.he
  const dir = lang === 'en' ? 'ltr' : 'rtl'

  // State
  const [leads, setLeads]               = useState([])
  const [messages, setMessages]         = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
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

  const messagesEndRef  = useRef(null)
  const leadsIntervalRef   = useRef(null)
  const messagesIntervalRef = useRef(null)

  // ── Load leads ──────────────────────────────────────────────────────────────
  const loadLeads = useCallback(async (silent = false) => {
    if (!silent) setLoadingLeads(true)
    setLeadsError(null)
    try {
      const data = await fetchLeads()
      setLeads(data)
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
    } catch (e) {
      setMessagesError(e.message)
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  // ── Initial load + 30s polling for leads ────────────────────────────────────
  useEffect(() => {
    loadLeads()
    leadsIntervalRef.current = setInterval(() => loadLeads(true), 30000)
    return () => clearInterval(leadsIntervalRef.current)
  }, [loadLeads])

  // ── 15s polling for messages when a lead is selected ────────────────────────
  useEffect(() => {
    clearInterval(messagesIntervalRef.current)
    if (!selectedLead) { setMessages([]); return }
    loadMessages(selectedLead.id)
    messagesIntervalRef.current = setInterval(() => loadMessages(selectedLead.id, true), 15000)
    return () => clearInterval(messagesIntervalRef.current)
  }, [selectedLead?.id, loadMessages])

  // ── Scroll to bottom when messages change ───────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Sync notes/callTime from selected lead ───────────────────────────────────
  useEffect(() => {
    if (selectedLead) {
      setNoteInput(selectedLead.notes || '')
      setCallTimeInput(selectedLead.call_time || '')
    }
  }, [selectedLead?.id])

  // ── Send message ─────────────────────────────────────────────────────────────
  const handleSend = async (text) => {
    const msg = (text || msgInput).trim()
    if (!msg || !selectedLead) return
    setSending(true)
    try {
      const newMsg = await sendMessage(selectedLead.id, msg)
      if (newMsg) {
        setMessages(prev => [...prev, newMsg])
      } else {
        await loadMessages(selectedLead.id, true)
      }
      setMsgInput('')
    } catch (e) {
      console.error('[MetaLeadsTab] send error:', e)
    } finally {
      setSending(false)
    }
  }

  // ── Sync ─────────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const pageId = prompt(lang === 'en' ? 'Enter Page ID (or leave empty for default):' : 'הזן Page ID (או השאר ריק לברירת מחדל):') || ''
      const result = await syncLeads(pageId)
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
  const handleStatusChange = (status) => {
    if (!selectedLead) return
    setSelectedLead(prev => ({ ...prev, status }))
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, status } : l))
    // Fire-and-forget update via API
    fetch(`/api/meta/leads`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ id: selectedLead.id, status }),
    }).catch(() => {})
  }

  // ── Save notes ────────────────────────────────────────────────────────────────
  const handleSaveNotes = () => {
    if (!selectedLead) return
    setSelectedLead(prev => ({ ...prev, notes: noteInput, call_time: callTimeInput }))
    setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, notes: noteInput, call_time: callTimeInput } : l))
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  // ── Filtered leads ────────────────────────────────────────────────────────────
  const filteredLeads = leads.filter(l => {
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !search || [l.name, l.phone, l.email, l.campaign_name, l.form_name]
      .filter(Boolean).some(s => s.toLowerCase().includes(q))
    return matchStatus && matchSearch
  })

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

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
      direction: dir,
      fontFamily: 'Rubik, sans-serif',
      background: BG,
    }}>

      {/* ─────────────────── LEFT PANEL: Lead List ─────────────────────── */}
      <div style={{
        width: 320,
        flexShrink: 0,
        borderLeft: `1px solid ${BORDER}`,
        display: 'flex',
        flexDirection: 'column',
        background: CARD,
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: CREAM }}>{t.title}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                {filteredLeads.length} {t.leadsCount}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {syncResult && (
                <span style={{ fontSize: 10, color: GREEN, fontWeight: 700, background: 'rgba(130,246,127,.12)', padding: '3px 8px', borderRadius: 10, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {syncResult}
                </span>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                title={t.sync}
                style={{
                  padding: '6px 11px',
                  background: syncing ? 'rgba(132,144,216,.08)' : `rgba(132,144,216,.14)`,
                  border: `1px solid ${PURPLE}44`,
                  borderRadius: 8,
                  color: PURPLE,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { if (!syncing) e.currentTarget.style.background = `rgba(132,144,216,.25)` }}
                onMouseLeave={e => { if (!syncing) e.currentTarget.style.background = `rgba(132,144,216,.14)` }}
              >
                {syncing ? t.syncing : t.sync}
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
        </div>

        {/* Lead list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingLeads && (
            <div style={{ padding: 24, textAlign: 'center', color: MUTED, fontSize: 13 }}>{t.loading}</div>
          )}
          {leadsError && (
            <div style={{ padding: 16, color: '#E05252', fontSize: 12 }}>{t.error}: {leadsError}</div>
          )}
          {!loadingLeads && filteredLeads.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>
                {/* Facebook-like icon */}
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
            return (
              <div
                key={lead.id}
                onClick={() => setSelectedLead(lead)}
                style={{
                  padding: '12px 14px',
                  borderBottom: `1px solid rgba(255,255,255,.04)`,
                  cursor: 'pointer',
                  background: isSelected ? `rgba(132,144,216,.1)` : 'transparent',
                  borderRight: isSelected ? `2px solid ${PURPLE}` : '2px solid transparent',
                  transition: 'all .12s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: `${color}25`, border: `1.5px solid ${color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color, flexShrink: 0,
                  }}>
                    {initials(lead.name)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: CREAM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {lead.name || '—'}
                      </span>
                      <span style={{ fontSize: 10, color: MUTED, flexShrink: 0 }}>
                        {timeAgo(lead.created_at, lang)}
                      </span>
                    </div>

                    {/* Campaign / form */}
                    <div style={{ fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 5 }}>
                      {lead.campaign_name || lead.form_name || '—'}
                    </div>

                    {/* Bottom row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {lead.phone && (
                        <span style={{ fontSize: 11, color: 'rgba(232,228,216,.5)' }}>
                          {fmtPhone(lead.phone)}
                        </span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: sc.color, background: sc.bg,
                        padding: '1px 7px', borderRadius: 10,
                      }}>
                        {sc.label[lang] || sc.label.he}
                      </span>
                      {lead.wa_sent && (
                        <span title={t.waSent} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#25D366">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </span>
                      )}
                      {lead.message_count > 0 && (
                        <span style={{ fontSize: 10, color: PURPLE }}>
                          {lead.message_count} {lang === 'en' ? 'msgs' : 'הודעות'}
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
          // Empty state
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" style={{ opacity: .3 }}>
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke={PURPLE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ color: CREAM, fontSize: 16, fontWeight: 700, opacity: .5 }}>{t.selectLead}</div>
            <div style={{ color: MUTED, fontSize: 13 }}>{t.selectLeadDesc}</div>
          </div>
        ) : (
          <>
            {/* ── Lead details bar ─────────────────────────────────── */}
            <div style={{
              padding: '14px 20px',
              borderBottom: `1px solid ${BORDER}`,
              flexShrink: 0,
              background: CARD,
            }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Avatar + Name */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: `${avatarColors(selectedLead.name)}25`,
                    border: `2px solid ${avatarColors(selectedLead.name)}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 900, color: avatarColors(selectedLead.name), flexShrink: 0,
                  }}>
                    {initials(selectedLead.name)}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: CREAM }}>{selectedLead.name || '—'}</div>
                    {selectedLead.phone && (
                      <div style={{ fontSize: 12, color: MUTED }}>{fmtPhone(selectedLead.phone)}</div>
                    )}
                  </div>
                </div>

                {/* Meta info chips */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                  {selectedLead.email && (
                    <span style={{ fontSize: 11, color: MUTED, background: 'rgba(255,255,255,.04)', padding: '3px 9px', borderRadius: 20, border: `1px solid ${BORDER}` }}>
                      {selectedLead.email}
                    </span>
                  )}
                  {(selectedLead.campaign_name || selectedLead.form_name) && (
                    <span style={{ fontSize: 11, color: PURPLE, background: `${PURPLE}12`, padding: '3px 9px', borderRadius: 20, border: `1px solid ${PURPLE}33` }}>
                      {selectedLead.campaign_name || selectedLead.form_name}
                    </span>
                  )}
                  {selectedLead.wa_sent && (
                    <span style={{ fontSize: 11, color: '#25D366', background: 'rgba(37,211,102,.12)', padding: '3px 9px', borderRadius: 20, border: '1px solid rgba(37,211,102,.3)' }}>
                      {t.waSent}
                    </span>
                  )}
                </div>

                {/* Status selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{t.status}:</span>
                  <select
                    value={selectedLead.status || 'new'}
                    onChange={e => handleStatusChange(e.target.value)}
                    style={{
                      padding: '5px 10px',
                      background: STATUS_CONFIG[selectedLead.status || 'new']?.bg || STATUS_CONFIG.new.bg,
                      border: `1px solid ${STATUS_CONFIG[selectedLead.status || 'new']?.color || STATUS_CONFIG.new.color}44`,
                      borderRadius: 8,
                      color: STATUS_CONFIG[selectedLead.status || 'new']?.color || STATUS_CONFIG.new.color,
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      outline: 'none',
                      direction: dir,
                    }}
                  >
                    {Object.entries(STATUS_CONFIG).map(([key, sc]) => (
                      <option key={key} value={key} style={{ background: '#0E0E1C', color: sc.color }}>
                        {sc.label[lang] || sc.label.he}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes + call time row */}
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: 200 }}>
                  <label style={{ fontSize: 10, color: MUTED, fontWeight: 700, display: 'block', marginBottom: 4 }}>{t.notes}</label>
                  <textarea
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder={t.notesPlaceholder}
                    rows={2}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '7px 10px',
                      background: 'rgba(255,255,255,.04)',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8, resize: 'none',
                      color: CREAM, fontSize: 12, fontFamily: 'inherit',
                      outline: 'none', direction: dir,
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: 10, color: MUTED, fontWeight: 700, display: 'block', marginBottom: 4 }}>{t.callTime}</label>
                  <input
                    type="text"
                    value={callTimeInput}
                    onChange={e => setCallTimeInput(e.target.value)}
                    placeholder={t.callTimePlaceholder}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '7px 10px',
                      background: 'rgba(255,255,255,.04)',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      color: CREAM, fontSize: 12, fontFamily: 'inherit',
                      outline: 'none', direction: dir,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    onClick={handleSaveNotes}
                    style={{
                      padding: '7px 14px',
                      background: noteSaved ? 'rgba(130,246,127,.14)' : `rgba(132,144,216,.14)`,
                      border: `1px solid ${noteSaved ? 'rgba(130,246,127,.4)' : PURPLE + '44'}`,
                      borderRadius: 8, color: noteSaved ? GREEN : PURPLE,
                      fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                      cursor: 'pointer', transition: 'all .15s',
                    }}
                  >
                    {noteSaved ? t.noteSaved : t.saveNotes}
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
              {/* Quick replies */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {[t.quickReply1, t.quickReply2, t.quickReply3].map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(qr)}
                    disabled={sending}
                    style={{
                      padding: '5px 12px',
                      background: 'rgba(255,255,255,.04)',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 20,
                      color: MUTED,
                      fontSize: 11,
                      cursor: sending ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 600,
                      transition: 'all .12s',
                    }}
                    onMouseEnter={e => { if (!sending) { e.currentTarget.style.background = `rgba(132,144,216,.12)`; e.currentTarget.style.color = PURPLE; e.currentTarget.style.borderColor = `${PURPLE}44` }}}
                    onMouseLeave={e => { if (!sending) { e.currentTarget.style.background = 'rgba(255,255,255,.04)'; e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER }}}
                  >
                    {qr}
                  </button>
                ))}
              </div>

              {/* Textarea + send button */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <textarea
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={t.messagePlaceholder}
                  rows={3}
                  style={{
                    flex: 1,
                    padding: '10px 13px',
                    background: 'rgba(255,255,255,.05)',
                    border: `1px solid ${BORDER}`,
                    borderRadius: 10, resize: 'none',
                    color: CREAM, fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', direction: dir,
                    lineHeight: 1.5,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = `${PURPLE}66` }}
                  onBlur={e => { e.currentTarget.style.borderColor = BORDER }}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={sending || !msgInput.trim()}
                  style={{
                    padding: '10px 18px',
                    background: (sending || !msgInput.trim()) ? 'rgba(37,211,102,.08)' : 'rgba(37,211,102,.2)',
                    border: `1px solid ${(sending || !msgInput.trim()) ? 'rgba(37,211,102,.2)' : 'rgba(37,211,102,.5)'}`,
                    borderRadius: 10,
                    color: (sending || !msgInput.trim()) ? 'rgba(37,211,102,.4)' : '#25D366',
                    fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
                    cursor: (sending || !msgInput.trim()) ? 'not-allowed' : 'pointer',
                    transition: 'all .15s',
                    display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
                    height: 'fit-content',
                  }}
                  onMouseEnter={e => { if (!sending && msgInput.trim()) e.currentTarget.style.background = 'rgba(37,211,102,.3)' }}
                  onMouseLeave={e => { if (!sending && msgInput.trim()) e.currentTarget.style.background = 'rgba(37,211,102,.2)' }}
                >
                  {/* WhatsApp icon */}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  {sending ? t.sending : t.send}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
