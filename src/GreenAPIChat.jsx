/**
 * GreenAPIChat — WhatsApp-Web / Green API Console replica
 * Dark/Light theme · RTL Hebrew · Isolated scroll · Sticky input
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from './lib/supabaseClient'

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE      = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const ADMIN_TOKEN   = 'AFIKhanahal2026'
const ACCOUNT_EMAIL = 'afik.hanahal@gmail.com'

// All Green API traffic is proxied through the server (/api/meta/chat-*), which
// holds the apiToken in WA_GREENAPI_TOKEN. The token is never shipped to the browser.
const CHAT_API     = '/api/meta'
const AUTH_HEADER  = { Authorization: `Bearer ${ADMIN_TOKEN}` }
const MAX_FILE_MB  = 3   // Vercel request-body cap (base64 inflates ~33%)

// ─── Theme palettes ───────────────────────────────────────────────────────────
const DARK = {
  bubbleOut:     '#005C4B',
  bubbleIn:      '#202C33',
  chatBg:        '#0B141A',
  panelBg:       '#111B21',
  selectedRow:   '#2A3942',
  authBadgeBg:   '#1B3B2E',
  authBadgeTxt:  '#22C55E',
  green:         '#00A884',
  unread:        '#075E54',   // WhatsApp authentic dark green (unread badge)
  inputBg:       '#202C33',
  inputFieldBg:  '#2A3942',
  bodyText:      '#E9EDEF',
  subText:       '#8696A0',
  border:        '#222D34',
  topBorder:     '#222D34',
  tick:          '#53BDEB',
  tickGray:      '#8696A0',
  dateSepBg:     '#182229',
  dateSepText:   '#8696A0',
  modalBg:       '#202C33',
  modalOverlay:  'rgba(0,0,0,.65)',
  hoverRow:      '#1E2D36',
  delBtn:        'rgba(224,82,82,.18)',
}

const LIGHT = {
  bubbleOut:     '#D9FDD3',
  bubbleIn:      '#FFFFFF',
  chatBg:        '#EFEAE2',
  panelBg:       '#FFFFFF',
  selectedRow:   '#E8F5E9',
  authBadgeBg:   '#D4F4DD',
  authBadgeTxt:  '#2E7D32',
  green:         '#00A884',
  unread:        '#075E54',   // WhatsApp authentic dark green (unread badge)
  inputBg:       '#F0F2F5',
  inputFieldBg:  '#FFFFFF',
  bodyText:      '#111B21',
  subText:       '#667781',
  border:        '#E9EDEF',
  topBorder:     '#E5E5E5',
  tick:          '#53BDEB',
  tickGray:      '#8696A0',
  dateSepBg:     '#FFFFFF',
  dateSepText:   '#54656F',
  modalBg:       '#FFFFFF',
  modalOverlay:  'rgba(0,0,0,.45)',
  hoverRow:      '#F5F6F6',
  delBtn:        'rgba(224,82,82,.12)',
}

// ─── Doodle backgrounds ───────────────────────────────────────────────────────
const DOODLE_LIGHT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='76' height='76'%3E%3Cdefs%3E%3Cpattern id='wa' x='0' y='0' width='76' height='76' patternUnits='userSpaceOnUse'%3E%3Cg fill='none' stroke='%23A09880' stroke-opacity='0.12' stroke-width='1'%3E%3Ccircle cx='38' cy='38' r='13'/%3E%3Ccircle cx='38' cy='38' r='5'/%3E%3Cline x1='38' y1='5' x2='38' y2='18'/%3E%3Cline x1='38' y1='58' x2='38' y2='71'/%3E%3Cline x1='5' y1='38' x2='18' y2='38'/%3E%3Cline x1='58' y1='38' x2='71' y2='38'/%3E%3Cline x1='13' y1='13' x2='22' y2='22'/%3E%3Cline x1='54' y1='54' x2='63' y2='63'/%3E%3Cline x1='63' y1='13' x2='54' y2='22'/%3E%3Cline x1='22' y1='54' x2='13' y2='63'/%3E%3C/g%3E%3C/pattern%3E%3C/defs%3E%3Crect width='76' height='76' fill='url(%23wa)'/%3E%3C/svg%3E")`
const DOODLE_DARK  = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='76' height='76'%3E%3Cdefs%3E%3Cpattern id='wad' x='0' y='0' width='76' height='76' patternUnits='userSpaceOnUse'%3E%3Cg fill='none' stroke='%23FFFFFF' stroke-opacity='0.03' stroke-width='1'%3E%3Ccircle cx='38' cy='38' r='13'/%3E%3Ccircle cx='38' cy='38' r='5'/%3E%3Cline x1='38' y1='5' x2='38' y2='18'/%3E%3Cline x1='38' y1='58' x2='38' y2='71'/%3E%3Cline x1='5' y1='38' x2='18' y2='38'/%3E%3Cline x1='58' y1='38' x2='71' y2='38'/%3E%3Cline x1='13' y1='13' x2='22' y2='22'/%3E%3Cline x1='54' y1='54' x2='63' y2='63'/%3E%3Cline x1='63' y1='13' x2='54' y2='22'/%3E%3Cline x1='22' y1='54' x2='13' y2='63'/%3E%3C/g%3E%3C/pattern%3E%3C/defs%3E%3Crect width='76' height='76' fill='url(%23wad)'/%3E%3C/svg%3E")`

// ─── Helpers ──────────────────────────────────────────────────────────────────
function intlPhone(raw) {
  if (!raw) return ''
  const d = raw.replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('972')) return d
  if (d.startsWith('0'))   return '972' + d.slice(1)
  return d
}

function avatarBg(name) {
  const C = ['#D9626E','#AA7DE0','#3A8FC7','#E08C3A','#3BAF7E','#C2497E','#5C8AE0']
  return C[(name?.charCodeAt(0) || 65) % C.length]
}

function fmtTime(ds) {
  try { return new Date(ds).toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' }) }
  catch { return '' }
}

function fmtDate(ds) {
  const d   = new Date(ds)
  const tod = new Date(); tod.setHours(0,0,0,0)
  const yes = new Date(tod); yes.setDate(tod.getDate()-1)
  const dm  = new Date(d);  dm.setHours(0,0,0,0)
  if (dm.getTime() === tod.getTime()) return 'היום'
  if (dm.getTime() === yes.getTime()) return 'אתמול'
  return d.toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' })
}

function fmtRowTime(ds) {
  const d   = new Date(ds)
  const tod = new Date(); tod.setHours(0,0,0,0)
  const dm  = new Date(d); dm.setHours(0,0,0,0)
  return dm.getTime() === tod.getTime()
    ? fmtTime(ds)
    : d.toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'2-digit' })
}

// ─── Green API message normalizer ────────────────────────────────────────────
function normalizeGreenMsg(m) {
  const text = m.textMessage
    || m.caption
    || (m.typeMessage === 'imageMessage'    ? '📷 תמונה'
      : m.typeMessage === 'documentMessage' ? '📎 מסמך'
      : m.typeMessage === 'videoMessage'    ? '🎥 סרטון'
      : m.typeMessage === 'audioMessage'    ? '🎵 הקלטה'
      : m.typeMessage === 'stickerMessage'  ? '🎭 מדבקה'
      : m.typeMessage === 'contactMessage'  ? '👤 איש קשר'
      : m.typeMessage === 'locationMessage' ? '📍 מיקום'
      : m.typeMessage || '')
  return {
    id:         m.idMessage,
    direction:  m.type === 'outgoing' ? 'out' : 'in',
    message:    text,
    created_at: new Date((m.timestamp || 0) * 1000).toISOString(),
    // Preserve the real delivery state for outgoing messages so the ticks can
    // show sent (✓) → delivered (✓✓ gray) → read (✓✓ blue). Incoming needs none.
    status:     m.type === 'outgoing' ? (m.statusMessage || 'sent') : 'read',
  }
}

// ─── SVG icon helpers ─────────────────────────────────────────────────────────
const Icon = ({ path, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d={path}/>
  </svg>
)

const ICONS = {
  chat:      'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
  status:    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z',
  phone:     'M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02L6.6 10.8z',
  contacts:  'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  settings:  'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  send:      'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
  mic:       'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  paperclip: 'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
  bell:      'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  search:    'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  lock:      'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  sun:       'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0zM7.05 18.36l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0z',
  moon:      'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z',
  trash:     'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
}

// ─── Delivery-status ticks ────────────────────────────────────────────────────
// sending → clock · sent → ✓ · delivered → ✓✓ gray · read → ✓✓ blue · failed → !
function TickMark({ status, WA, size = 14 }) {
  if (status === 'sending' || status === 'pending') {
    return (
      <svg width={size - 1} height={size - 1} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="6.4" fill="none" stroke={WA.tickGray} strokeWidth="1.3" />
        <path d="M8 4.4V8l2.4 1.5" fill="none" stroke={WA.tickGray} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }
  if (status === 'failed' || status === 'noAccount') {
    return <span style={{ fontSize: size - 1, color: '#E05252', fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>!</span>
  }
  const read = status === 'read'
  const single = status === 'sent'
  return (
    <span style={{ fontSize: size, lineHeight: 1, color: read ? WA.tick : WA.tickGray, flexShrink: 0, letterSpacing: '-1px' }}>
      {single ? '✓' : '✓✓'}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function GreenAPIChat({ leads = [], lang = 'he', initialContact = null, onOpenLead, onDeleteLead, onNewMessage, onSentMessage, onReadChange }) {

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => localStorage.getItem('whatsapp_theme') !== 'light')
  const WA     = isDark ? DARK  : LIGHT
  const DOODLE = isDark ? DOODLE_DARK : DOODLE_LIGHT

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    localStorage.setItem('whatsapp_theme', next ? 'dark' : 'light')
  }

  // ── State ─────────────────────────────────────────────────────────────────
  const [chats,         setChats]        = useState({})
  const [contact,       setContact]      = useState(initialContact)
  const [search,        setSearch]       = useState('')
  const [input,         setInput]        = useState('')
  const [sending,       setSending]      = useState(false)
  const [loading,       setLoading]      = useState(false)
  const [fetchError,    setFetchError]   = useState(null)
  const [status,        setStatus]       = useState(null)
  const [loadingPhones, setLoadingPhones] = useState(() => new Set())
  const [newChatOpen,   setNewChat]      = useState(false)
  const [newPhone,      setNewPhone]     = useState('')
  const [activeNav,     setActiveNav]    = useState('chats')
  const [emoji,         setEmoji]        = useState(false)
  const [attached,      setAttached]     = useState(null)

  // Per-conversation read tracking (persisted) → drives unread badges
  const [lastRead, setLastRead] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wa_last_read') || '{}') } catch { return {} }
  })

  // Local object-URL preview for an attached image (revoked on change/unmount)
  const attachedPreview = useMemo(
    () => (attached && attached.type?.startsWith('image/') ? URL.createObjectURL(attached) : null),
    [attached]
  )
  useEffect(() => () => { if (attachedPreview) URL.revokeObjectURL(attachedPreview) }, [attachedPreview])

  // delete flow
  const [deleteConfirm, setDeleteConfirm] = useState(null)  // lead object to confirm
  const [deletingId,    setDeletingId]    = useState(null)  // id hidden during undo window
  const [pendingDelete, setPendingDelete] = useState(null)  // { lead, timer }

  const scrollRef         = useRef(null)
  const pollRef           = useRef(null)
  const inputRef          = useRef(null)
  const isNearBottom      = useRef(true)
  const prevMsgCount      = useRef(0)
  const fileRef           = useRef(null)
  const notifiedMsgIdsRef = useRef(new Set())
  const pageLoadTimeRef   = useRef(Date.now())
  const onNewMessageRef   = useRef(onNewMessage)
  const onSentMessageRef  = useRef(onSentMessage)
  const onReadChangeRef   = useRef(onReadChange)
  const leadsRef          = useRef(leads)
  useEffect(() => { onNewMessageRef.current  = onNewMessage  }, [onNewMessage])
  useEffect(() => { onSentMessageRef.current = onSentMessage }, [onSentMessage])
  useEffect(() => { onReadChangeRef.current  = onReadChange  }, [onReadChange])
  useEffect(() => { leadsRef.current = leads }, [leads])

  // ── Delete handlers ───────────────────────────────────────────────────────
  const handleDeleteClick = (e, lead) => {
    e.stopPropagation()
    setDeleteConfirm(lead)
  }

  const confirmDeleteLead = () => {
    const lead = deleteConfirm
    setDeleteConfirm(null)
    if (contact?.id === lead.id) setContact(null)
    setDeletingId(lead.id)

    // Actually delete after 5s (undo window)
    const timer = setTimeout(() => {
      onDeleteLead?.(lead.id)
      setDeletingId(null)
      setPendingDelete(null)
    }, 5000)

    setPendingDelete({ lead, timer })
  }

  const undoDelete = () => {
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer)
      setDeletingId(null)
      setPendingDelete(null)
    }
  }

  // cleanup undo timer on unmount
  useEffect(() => () => { if (pendingDelete) clearTimeout(pendingDelete.timer) }, []) // eslint-disable-line

  // ── API calls ────────────────────────────────────────────────────────────
  const fetchGreenHistory = useCallback(async (phone) => {
    const p = intlPhone(phone)
    if (!p) return []
    try {
      const r = await fetch(`${CHAT_API}/chat-history`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body:    JSON.stringify({ phone: p, count: 100 }),
        signal:  AbortSignal.timeout(20000),
      })
      if (!r.ok) return []
      const data = await r.json()
      if (!Array.isArray(data)) return []
      return data
        .map(normalizeGreenMsg)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    } catch { return [] }
  }, [])

  const fetchMsgs = useCallback(async (phone, opts = {}) => {
    const p = intlPhone(phone)
    if (!p) return
    if (opts.showLoader) { setLoading(true); setFetchError(null) }
    setLoadingPhones(prev => { const s = new Set(prev); s.add(p); return s })

    try {
      const [backendResult, greenResult] = await Promise.allSettled([
        API_BASE
          ? fetch(`${API_BASE}/api/chats/${p}`, {
              headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
              signal:  AbortSignal.timeout(10000),
            }).then(r => r.ok ? r.json() : []).catch(() => [])
          : Promise.resolve([]),
        fetchGreenHistory(phone),
      ])

      const fromBackend = backendResult.status === 'fulfilled' && Array.isArray(backendResult.value) ? backendResult.value : []
      const fromGreen   = greenResult.status   === 'fulfilled' && Array.isArray(greenResult.value)   ? greenResult.value   : []
      const greenErr    = greenResult.status   === 'rejected'  ? greenResult.reason?.message : null

      const byId = new Map()
      fromBackend.forEach(m => m.id && byId.set(m.id, m))
      fromGreen.forEach(m   => m.id && byId.set(m.id, m))

      const merged = [...byId.values()]
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

      setFetchError(merged.length === 0 && greenErr ? greenErr : null)
      setChats(prev => {
        const existing = prev[p] || []
        const optimistics = existing.filter(m => m.id && String(m.id).startsWith('opt-'))
        if (optimistics.length > 0) {
          const confirmedOut = new Set(merged.filter(m => m.direction === 'out').map(m => m.message))
          const unconfirmed = optimistics.filter(m => !confirmedOut.has(m.message))
          if (unconfirmed.length > 0) {
            const all = [...merged, ...unconfirmed]
              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            return { ...prev, [p]: all }
          }
        }
        return { ...prev, [p]: merged }
      })

      // Detect new incoming messages and notify; mark all IDs as seen
      const threshold = pageLoadTimeRef.current
      const newIncoming = merged.filter(m =>
        m.direction === 'in' &&
        m.id &&
        !notifiedMsgIdsRef.current.has(m.id) &&
        new Date(m.created_at).getTime() > threshold
      )
      merged.forEach(m => { if (m.id) notifiedMsgIdsRef.current.add(m.id) })
      if (newIncoming.length > 0 && onNewMessageRef.current) {
        const contactLead = leadsRef.current.find(l => intlPhone(l.phone) === p)
        const contactName = contactLead?.name || p
        const latest = newIncoming[newIncoming.length - 1]
        onNewMessageRef.current({ contactName, message: latest.message, phone: p })
      }
    } finally {
      if (opts.showLoader) setLoading(false)
      setLoadingPhones(prev => { const s = new Set(prev); s.delete(p); return s })
    }
  }, [fetchGreenHistory])

  const sendViaGreenAPI = useCallback(async (p, msg) => {
    const r = await fetch(`${CHAT_API}/chat-send`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body:    JSON.stringify({ phone: p, message: msg }),
      signal:  AbortSignal.timeout(25000),
    })
    return r.ok
  }, [])

  // Send an image / PDF as a real WhatsApp attachment. The file is base64-encoded
  // and the server rebuilds the multipart upload to Green API (token stays server-side).
  const sendFileViaGreenAPI = useCallback(async (p, file, caption) => {
    const fileBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(String(reader.result).split(',')[1] || '')
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const r = await fetch(`${CHAT_API}/chat-send-file`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body:    JSON.stringify({ phone: p, fileName: file.name, fileType: file.type, fileBase64, caption }),
      signal:  AbortSignal.timeout(90000),
    })
    return r.ok
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${CHAT_API}/chat-status`, { headers: AUTH_HEADER, signal: AbortSignal.timeout(8000) })
      if (r.ok) { const d = await r.json(); setStatus(d.state || null); return }
    } catch {}
    // Fallback to the Render backend if the Vercel proxy is unreachable (e.g. local dev)
    if (!API_BASE) { setStatus('notConfigured'); return }
    try {
      const r = await fetch(`${API_BASE}/api/chats/status`, { headers: AUTH_HEADER, signal: AbortSignal.timeout(8000) })
      if (r.ok) { const d = await r.json(); setStatus(d.state || null) }
      else setStatus('error')
    } catch { setStatus('error') }
  }, [])

  // Mark a conversation as read up to "now" (clears its unread badge)
  const markRead = useCallback((phone) => {
    const p = intlPhone(phone)
    if (!p) return
    setLastRead(prev => {
      const next = { ...prev, [p]: new Date().toISOString() }
      try { localStorage.setItem('wa_last_read', JSON.stringify(next)) } catch {}
      return next
    })
    onReadChangeRef.current?.()
  }, [])

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => { fetchStatus() }, [fetchStatus])
  useEffect(() => { leads.filter(l => l.phone).slice(0, 20).forEach(l => fetchMsgs(l.phone)) }, [leads.length, fetchMsgs]) // eslint-disable-line

  useEffect(() => {
    if (initialContact) {
      setContact(initialContact)
      fetchMsgs(initialContact.phone, { showLoader: true })
    }
  }, [initialContact?.id]) // eslint-disable-line

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (!contact?.phone) return
    prevMsgCount.current = 0
    isNearBottom.current = true
    fetchMsgs(contact.phone, { showLoader: true })

    const p = intlPhone(contact.phone)

    if (supabase) {
      // Realtime: listen for new rows in chats table for this phone number
      const channel = supabase
        .channel(`chats_rt_${p}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'chats',
          filter: `phone=eq.${p}`,
        }, (payload) => {
          const msg = payload.new
          if (!msg?.id) return
          setChats(prev => {
            const existing = prev[p] || []
            if (existing.some(m => String(m.id) === String(msg.id))) return prev
            // Notify incoming messages
            if (msg.direction === 'in' && !notifiedMsgIdsRef.current.has(String(msg.id))) {
              const threshold = pageLoadTimeRef.current
              if (new Date(msg.created_at).getTime() > threshold) {
                notifiedMsgIdsRef.current.add(String(msg.id))
                const lead = leadsRef.current.find(l => intlPhone(l.phone) === p)
                onNewMessageRef.current?.({ contactName: lead?.name || p, message: msg.message, phone: p })
              }
            }
            notifiedMsgIdsRef.current.add(String(msg.id))
            return { ...prev, [p]: [...existing, msg].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) }
          })
        })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    } else {
      // Fallback: poll every 4s when Realtime not configured
      pollRef.current = setInterval(() => { if (!document.hidden) fetchMsgs(contact.phone) }, 4000)
      return () => clearInterval(pollRef.current)
    }
  }, [contact?.id, fetchMsgs])

  // Global Realtime: keep ALL conversations fresh (not just the open one) so the
  // unread badges update in real time. Dedup + notifiedMsgIdsRef make it safe to
  // run alongside the per-contact subscription above.
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('chats_rt_global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, (payload) => {
        const msg = payload.new
        if (!msg?.id || !msg.phone) return
        const p = intlPhone(msg.phone)
        setChats(prev => {
          const existing = prev[p] || []
          if (existing.some(m => String(m.id) === String(msg.id))) return prev
          return { ...prev, [p]: [...existing, msg].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) }
        })
        if (msg.direction === 'in' && !notifiedMsgIdsRef.current.has(String(msg.id))) {
          if (new Date(msg.created_at).getTime() > pageLoadTimeRef.current) {
            notifiedMsgIdsRef.current.add(String(msg.id))
            const lead = leadsRef.current.find(l => intlPhone(l.phone) === p)
            onNewMessageRef.current?.({ contactName: lead?.name || p, message: msg.message, phone: p })
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Keep the currently-open chat marked read as new messages stream in
  useEffect(() => {
    if (contact?.phone) markRead(contact.phone)
  }, [contact?.phone, chats, markRead])

  // Auto-scroll: only when switching contact (always go bottom) or new messages arrive
  // while user is already near the bottom — never force-jump while reading old messages.
  useEffect(() => {
    if (!scrollRef.current || !contact?.phone) return
    const p    = intlPhone(contact.phone)
    const msgs = chats[p] || []
    const count = msgs.length
    if (count === 0) return
    if (count > prevMsgCount.current) {
      if (isNearBottom.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
      prevMsgCount.current = count
    }
  }, [chats, contact?.phone])

  // ── Actions ──────────────────────────────────────────────────────────────
  const selectContact = (lead) => {
    setContact(lead)
    fetchMsgs(lead.phone)
    setEmoji(false)
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  const sendMsg = async () => {
    const msg  = input.trim()
    const file = attached
    if ((!msg && !file) || !contact || sending) return
    const p = intlPhone(contact.phone)
    if (!p) { alert('מספר טלפון לא תקין'); return }
    if (file && file.size > MAX_FILE_MB * 1024 * 1024) {
      alert(lang === 'en' ? `File too large (max ${MAX_FILE_MB}MB)` : `הקובץ גדול מדי (מקסימום ${MAX_FILE_MB}MB)`)
      return
    }

    const optId = 'opt-' + Date.now()
    setSending(true)
    setInput('')
    setEmoji(false)

    setChats(prev => ({
      ...prev,
      [p]: [...(prev[p]||[]), {
        id: optId, direction: 'out',
        message: msg || (file?.name || ''),
        file: file ? { name: file.name, type: file.type, preview: attachedPreview } : null,
        created_at: new Date().toISOString(), status: 'sending',
      }]
    }))

    let ok = false
    try {
      if (file) {
        // Attachment: upload straight to Green API (caption = the typed text)
        ok = await sendFileViaGreenAPI(p, file, msg)
      } else {
        if (API_BASE) {
          const r = await fetch(`${API_BASE}/api/chats/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
            body: JSON.stringify({ phone: p, message: msg }),
            signal: AbortSignal.timeout(15000),
          })
          if (r.ok) ok = true
        }
        if (!ok) ok = await sendViaGreenAPI(p, msg)
      }

      if (ok) {
        setAttached(null)
        setTimeout(() => fetchMsgs(contact.phone), file ? 3500 : 2000)
        const contactName = contact.name || intlPhone(contact.phone)
        onSentMessageRef.current?.({ contactName, message: msg || file?.name })
      } else {
        throw new Error('שליחה נכשלה')
      }
    } catch (e) {
      alert('שגיאה בשליחה: ' + e.message)
      setChats(prev => ({ ...prev, [p]: (prev[p]||[]).filter(m => m.id !== optId) }))
      setInput(msg)
    } finally {
      setSending(false)
    }
  }

  const startNewChat = () => {
    const p = intlPhone(newPhone.trim())
    if (!p || p.length < 11) { alert('מספר לא תקין'); return }
    setNewChat(false); setNewPhone('')
    selectContact({ id: 'new-' + p, name: p, phone: p })
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const sl = search.toLowerCase()
  const contactList = useMemo(() => leads
    .filter(l => l.phone && l.id !== deletingId)
    .filter(l => !search || (l.name||'').toLowerCase().includes(sl) || (l.phone||'').includes(search))
    .sort((a, b) => {
      const pa = intlPhone(a.phone), pb = intlPhone(b.phone)
      const la = chats[pa]?.[chats[pa].length-1]?.created_at || 0
      const lb = chats[pb]?.[chats[pb].length-1]?.created_at || 0
      return new Date(lb) - new Date(la)
    }),
    [leads, search, chats, sl, deletingId]) // eslint-disable-line

  const chatPhone  = contact ? intlPhone(contact.phone) : null
  const msgs       = chatPhone ? (chats[chatPhone]||[]) : []
  const contactIdx = contactList.findIndex(l => l.id === contact?.id)

  // Unread = incoming messages newer than the last time this chat was opened.
  // Chats never opened are baselined to page-load so old history isn't flagged.
  const unreadFor = useCallback((p) => {
    const base = lastRead[p] ? new Date(lastRead[p]).getTime() : pageLoadTimeRef.current
    return (chats[p] || []).reduce((n, m) =>
      (m.direction === 'in' && new Date(m.created_at).getTime() > base ? n + 1 : n), 0)
  }, [chats, lastRead])

  const totalUnread = useMemo(() => contactList.reduce((sum, lead) =>
    contact?.id === lead.id ? sum : sum + unreadFor(intlPhone(lead.phone)),
    0), [contactList, contact?.id, unreadFor])

  const statusColor = status==='authorized' ? '#22C55E' : status==='notAuthorized' ? '#F97316' : status==='error' ? '#E05252' : '#8696A0'
  const statusLabel = status==='authorized' ? 'מחובר' : status==='notAuthorized' ? 'לא מחובר' : status==='error' ? 'שגיאה' : status==='notConfigured' ? 'לא מוגדר' : 'טוען...'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display:'flex', flexDirection:'column',
      flex:1, minHeight:0,
      overflow:'hidden',
      fontFamily:'Rubik,"Segoe UI","Helvetica Neue","Noto Sans Hebrew",Arial,sans-serif',
      background: WA.panelBg,
      colorScheme: isDark ? 'dark' : 'light',
      transition: 'background .25s ease',
    }}>

      {/* ── CSS keyframes ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes wa-spin { to { transform: rotate(360deg); } }
        @keyframes wa-toast-in { from { opacity:0; transform: translateX(-50%) translateY(16px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
        @keyframes wa-fade-in { from { opacity:0; } to { opacity:1; } }
        .wa-row-spinner { width:14px; height:14px; border-radius:50%; border:2px solid transparent; border-top-color:${WA.green}; animation:wa-spin 0.7s linear infinite; flex-shrink:0; }
        /* Smooth, comfortable scrolling for the contacts/names list */
        .wa-contacts-scroll {
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
          scrollbar-width: thin;
          scrollbar-color: ${WA.subText}66 transparent;
          scrollbar-gutter: stable;
        }
        .wa-contacts-scroll::-webkit-scrollbar { width: 7px; }
        .wa-contacts-scroll::-webkit-scrollbar-track { background: transparent; }
        .wa-contacts-scroll::-webkit-scrollbar-thumb {
          background: ${WA.subText}55; border-radius: 8px;
          border: 2px solid transparent; background-clip: padding-box;
          transition: background-color .15s;
        }
        .wa-contacts-scroll:hover::-webkit-scrollbar-thumb { background: ${WA.green}; background-clip: padding-box; }
      `}</style>

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {deleteConfirm && (
        <div
          onClick={e => e.target===e.currentTarget && setDeleteConfirm(null)}
          style={{ position:'fixed', inset:0, zIndex:9999, background: WA.modalOverlay, display:'flex', alignItems:'center', justifyContent:'center', animation:'wa-fade-in .15s ease' }}>
          <div style={{ background: WA.modalBg, borderRadius:14, padding:28, width:360, direction:'rtl', boxShadow:'0 24px 64px rgba(0,0,0,.35)', border:`1px solid ${WA.border}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(224,82,82,.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon path={ICONS.trash} size={20}/>
              </div>
              <div style={{ fontSize:17, fontWeight:700, color: WA.bodyText }}>מחק איש קשר?</div>
            </div>
            <div style={{ fontSize:14, color: WA.subText, lineHeight:1.7, marginBottom:22 }}>
              האם אתה בטוח שברצונך למחוק את <strong style={{ color: WA.bodyText }}>"{deleteConfirm.name||deleteConfirm.phone}"</strong>?<br/>
              פעולה זו תסיר את כל ההיסטוריה ולא ניתן לבטל אותה מיד.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button
                onClick={confirmDeleteLead}
                style={{ flex:1, padding:'12px 0', background:'#E05252', border:'none', borderRadius:9, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'filter .15s' }}
                onMouseEnter={e => e.currentTarget.style.filter='brightness(1.1)'}
                onMouseLeave={e => e.currentTarget.style.filter='brightness(1)'}>
                מחק
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ flex:1, padding:'12px 0', background: WA.inputBg, border:`1px solid ${WA.border}`, borderRadius:9, color: WA.subText, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Chat Modal ────────────────────────────────────────────────── */}
      {newChatOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background: WA.modalOverlay, display:'flex', alignItems:'center', justifyContent:'center', animation:'wa-fade-in .15s ease' }}
          onClick={e => e.target===e.currentTarget && setNewChat(false)}>
          <div style={{ background: WA.modalBg, borderRadius:14, padding:28, width:380, direction:'rtl', boxShadow:'0 20px 60px rgba(0,0,0,.3)', border:`1px solid ${WA.border}` }}>
            <div style={{ fontSize:17, fontWeight:700, color: WA.bodyText, marginBottom:6 }}>שיחה חדשה</div>
            <div style={{ fontSize:12.5, color: WA.subText, marginBottom:16 }}>הכנס מספר טלפון</div>
            <input autoFocus value={newPhone} onChange={e=>setNewPhone(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&startNewChat()}
              placeholder="972XXXXXXXXX  או  05XXXXXXXX"
              style={{ width:'100%', padding:'12px 14px', border:`1.5px solid ${WA.border}`, borderRadius:8, color: WA.bodyText, background: WA.inputFieldBg, fontSize:14, fontFamily:'inherit', outline:'none', direction:'ltr', marginBottom:18, boxSizing:'border-box', transition:'border-color .15s' }}
              onFocus={e=>e.target.style.borderColor=WA.green}
              onBlur={e=>e.target.style.borderColor=WA.border}/>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={startNewChat}
                style={{ flex:1, padding:'12px 0', background: WA.green, border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                התחל שיחה
              </button>
              <button onClick={()=>{setNewChat(false);setNewPhone('')}}
                style={{ flex:1, padding:'12px 0', background: WA.inputBg, border:`1px solid ${WA.border}`, borderRadius:8, color: WA.subText, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Undo Toast ────────────────────────────────────────────────────── */}
      {pendingDelete && (
        <div style={{
          position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
          zIndex:9998, background: isDark ? '#1A2B33' : '#2A2A2A',
          color:'#fff', borderRadius:10, padding:'13px 20px',
          display:'flex', gap:14, alignItems:'center',
          boxShadow:'0 6px 24px rgba(0,0,0,.35)',
          border:`1px solid ${isDark ? '#2D3E47' : '#444'}`,
          animation:'wa-toast-in .2s ease',
          whiteSpace:'nowrap',
        }}>
          <span style={{ fontSize:14 }}>"{pendingDelete.lead.name||pendingDelete.lead.phone}" נמחק</span>
          <button onClick={undoDelete}
            style={{ background: WA.green, border:'none', borderRadius:7, color:'#fff', fontSize:13, fontWeight:700, padding:'6px 14px', cursor:'pointer', fontFamily:'inherit' }}>
            בטל
          </button>
        </div>
      )}

      {/* ── Top Status Bar ───────────────────────────────────────────────── */}
      <div style={{ height:48, background: WA.inputBg, borderBottom:`1px solid ${WA.topBorder}`, display:'flex', alignItems:'center', padding:'0 18px', gap:10, flexShrink:0, direction:'rtl', transition:'background .25s' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink:0 }}>
          <circle cx="12" cy="12" r="4.5" fill={statusColor}/>
          {[0,45,90,135,180,225,270,315].map(a => {
            const rad = (a * Math.PI) / 180
            return <line key={a} x1={12+Math.cos(rad)*6.5} y1={12+Math.sin(rad)*6.5} x2={12+Math.cos(rad)*9.5} y2={12+Math.sin(rad)*9.5} stroke={statusColor} strokeWidth="2" strokeLinecap="round"/>
          })}
        </svg>
        <span style={{ fontSize:13.5, fontWeight:600, color: WA.bodyText }}>{ACCOUNT_EMAIL}</span>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:12, color: WA.subText }}>Green API · </span>
        <span style={{ fontSize:12, fontWeight:600, color: statusColor }}>{statusLabel}</span>
        <button onClick={fetchStatus}
          style={{ width:28, height:28, borderRadius:'50%', background:'transparent', border:`1px solid ${WA.border}`, color: WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, marginRight:4 }}
          title="רענן סטטוס"
          onMouseEnter={e=>e.currentTarget.style.borderColor=WA.green}
          onMouseLeave={e=>e.currentTarget.style.borderColor=WA.border}>↻</button>
      </div>

      {/* ── Main Layout ──────────────────────────────────────────────────── */}
      {/* flex:1, minHeight:0 — critical for contained scroll in flex child */}
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'row', overflow:'hidden', direction:'rtl', background: WA.panelBg }}>

        {/* ═══════════════ CHAT WINDOW (left, fills remaining space) ════════ */}
        {/* overflow:hidden isolates internal scroll from page scroll. order:3
            places it on the LEFT (names list sits on the right, RTL-correct).  */}
        <div style={{ order:3, flex:'1 1 0', minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden', background: WA.chatBg, backgroundImage: DOODLE, backgroundRepeat:'repeat', transition:'background .25s' }}>
          {contact ? (
            <>
              {/* ── Chat Header (flex: 0 0 auto) ── */}
              <div style={{ flexShrink:0, height:62, background: WA.inputBg, borderBottom:`1px solid ${WA.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:12, direction:'rtl', transition:'background .25s' }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:avatarBg(contact.name), display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16, color:'#fff', flexShrink:0, userSelect:'none' }}>
                  {(contact.name||contact.phone||'?')[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:15, color: WA.bodyText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {contact.name||contact.phone}
                  </div>
                  <div style={{ fontSize:12, color: WA.subText, direction:'ltr' }}>{contact.phone}</div>
                </div>
                {onOpenLead && leads.find(l=>l.id===contact.id) && (
                  <button onClick={()=>onOpenLead(contact)}
                    style={{ padding:'5px 12px', background: WA.inputBg, border:`1px solid ${WA.border}`, borderRadius:8, color: WA.subText, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap', transition:'all .15s' }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor=WA.green; e.currentTarget.style.color=WA.green }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor=WA.border; e.currentTarget.style.color=WA.subText }}>
                    צפה בליד ↗
                  </button>
                )}
                {[
                  { delta:-1, disabled:contactIdx<=0,                      label:'‹', title:'ליד קודם' },
                  { delta:+1, disabled:contactIdx>=contactList.length-1,    label:'›', title:'ליד הבא'  },
                ].map(({ delta, disabled, label, title }) => (
                  <button key={delta} title={title}
                    onClick={()=>!disabled&&selectContact(contactList[contactIdx+delta])}
                    style={{ width:32, height:32, borderRadius:'50%', background:'transparent', border:'none', color:disabled?WA.border:WA.subText, cursor:disabled?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, lineHeight:1 }}>
                    {label}
                  </button>
                ))}
                <button onClick={()=>fetchMsgs(contact.phone)} title="רענן"
                  style={{ width:32, height:32, borderRadius:'50%', background:'transparent', border:'none', color: WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}
                  onMouseEnter={e=>e.currentTarget.style.background=WA.border}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>↻</button>
                <button onClick={()=>setContact(null)} title="סגור"
                  style={{ width:32, height:32, borderRadius:'50%', background:'transparent', border:'none', color: WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}
                  onMouseEnter={e=>e.currentTarget.style.background=WA.border}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>✕</button>
              </div>

              {/* ── Messages Area (flex: 1 1 auto, ISOLATED SCROLL) ── */}
              <div ref={scrollRef}
                onScroll={() => {
                  if (!scrollRef.current) return
                  const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
                  isNearBottom.current = scrollHeight - scrollTop - clientHeight < 80
                }}
                style={{
                  flex:'1 1 auto',
                  minHeight:0,           /* lets this shrink below content height */
                  overflowY:'auto',
                  overscrollBehavior:'contain',  /* prevents page scroll chain */
                  padding:'16px 7%',
                  display:'flex',
                  flexDirection:'column',
                  gap:0,
                  scrollBehavior:'smooth',
                }}>
                {loading ? (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color: WA.subText, minHeight:200 }}>
                    <div style={{ width:44, height:44, borderRadius:'50%', border:`4px solid ${WA.border}`, borderTopColor: WA.green, animation:'wa-spin 0.75s linear infinite' }}/>
                    <div style={{ fontSize:13.5, direction:'rtl' }}>טוען היסטוריית שיחה...</div>
                  </div>
                ) : msgs.length === 0 ? (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, color: WA.subText, minHeight:200, padding:'0 24px' }}>
                    {fetchError ? (
                      <>
                        <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(224,82,82,.08)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ fontSize:28 }}>⚠️</span>
                        </div>
                        <div style={{ fontSize:14, fontWeight:600, color:'#E05252', direction:'rtl', textAlign:'center' }}>לא ניתן לטעון את ההיסטוריה</div>
                        <div style={{ fontSize:12, color: WA.subText, direction:'rtl', textAlign:'center', lineHeight:1.6, maxWidth:280 }}>
                          {fetchError.includes('CORS')||fetchError.includes('fetch')||fetchError.includes('network')
                            ? 'שגיאת CORS — הדפדפן חוסם גישה ישירה ל-Green API. הפעל את הטוקן בשרת הביניים.'
                            : fetchError}
                        </div>
                        <button onClick={() => fetchMsgs(contact.phone, { showLoader: true })}
                          style={{ padding:'9px 20px', background: WA.green, border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                          נסה שוב
                        </button>
                        <div style={{ fontSize:11, color: WA.subText, direction:'rtl', textAlign:'center', opacity:.7 }}>chatId: {intlPhone(contact.phone)}@c.us</div>
                      </>
                    ) : (
                      <>
                        <div style={{ width:72, height:72, borderRadius:'50%', background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.8)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,.08)' }}>
                          <Icon path={ICONS.chat} size={32}/>
                        </div>
                        <div style={{ fontSize:14, textAlign:'center', direction:'rtl', lineHeight:1.7, color: WA.subText }}>
                          אין הודעות עדיין<br/>
                          <span style={{ fontSize:12, opacity:.6 }}>שלח הודעה ראשונה</span>
                        </div>
                        <button onClick={() => fetchMsgs(contact.phone, { showLoader: true })}
                          style={{ padding:'7px 18px', background:'transparent', border:`1.5px solid ${WA.border}`, borderRadius:8, color: WA.subText, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                          ↻ טען היסטוריה
                        </button>
                      </>
                    )}
                  </div>
                ) : (() => {
                  const items = []
                  let lastDate = null
                  msgs.forEach((msg, i) => {
                    const isOut      = msg.direction === 'out'
                    const msgDateStr = new Date(msg.created_at).toDateString()
                    if (msgDateStr !== lastDate) {
                      lastDate = msgDateStr
                      items.push(
                        <div key={`date-${i}`} style={{ display:'flex', justifyContent:'center', margin:'14px 0 10px', flexShrink:0 }}>
                          <span style={{ fontSize:12.5, fontWeight:500, color: WA.dateSepText, background: WA.dateSepBg, borderRadius:8, padding:'5px 18px', boxShadow:'0 1px 0.5px rgba(0,0,0,.18)', userSelect:'none' }}>
                            {fmtDate(msg.created_at)}
                          </span>
                        </div>
                      )
                    }
                    const isLastInGroup = i === msgs.length-1
                      || msgs[i+1]?.direction !== msg.direction
                      || Math.abs(new Date(msgs[i+1]?.created_at) - new Date(msg.created_at)) > 60000
                    const isOptimistic  = msg.id?.startsWith?.('opt-')
                    const bubbleRadius  = isOut
                      ? (isLastInGroup ? '7.5px 7.5px 0 7.5px' : '7.5px')
                      : (isLastInGroup ? '7.5px 7.5px 7.5px 0' : '7.5px')
                    const bubbleColor   = isOut ? WA.bubbleOut : WA.bubbleIn

                    items.push(
                      <div key={msg.id||i}
                        style={{ display:'flex', justifyContent:isOut?'flex-end':'flex-start', marginBottom:isLastInGroup?6:2, flexShrink:0, direction:'rtl', paddingRight:isOut?0:2, paddingLeft:isOut?2:0 }}>
                        <div style={{
                          maxWidth:'65%', minWidth:90,
                          padding:'6px 9px 22px 9px',
                          borderRadius: bubbleRadius,
                          background: bubbleColor,
                          color: WA.bodyText,
                          fontSize:14.2, lineHeight:1.55,
                          wordBreak:'break-word',
                          boxShadow:'0 1px 0.5px rgba(0,0,0,.18)',
                          position:'relative',
                          opacity: isOptimistic ? 0.75 : 1,
                          transition:'opacity .3s',
                        }}>
                          {isLastInGroup && isOut && (
                            <svg style={{ position:'absolute', bottom:0, right:-8, width:9, height:13 }} viewBox="0 0 9 13">
                              <path d="M9 0 Q0 10 0 13 L9 13 Z" fill={bubbleColor}/>
                            </svg>
                          )}
                          {isLastInGroup && !isOut && (
                            <svg style={{ position:'absolute', bottom:0, left:-8, width:9, height:13 }} viewBox="0 0 9 13">
                              <path d="M0 0 Q9 10 9 13 L0 13 Z" fill={bubbleColor}/>
                            </svg>
                          )}
                          {msg.file && (
                            <div style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 9px', marginBottom: (msg.message && msg.message !== msg.file.name) ? 5 : 0, background: isDark ? 'rgba(0,0,0,.20)' : 'rgba(0,0,0,.05)', borderRadius:7, direction:'rtl' }}>
                            {msg.file.preview
                                ? <img src={msg.file.preview} alt="" style={{ width:40, height:40, borderRadius:5, objectFit:'cover', flexShrink:0 }}/>
                                : <span style={{ fontSize:24, flexShrink:0 }}>{msg.file.type?.startsWith('image/') ? '🖼️' : '📎'}</span>}
                              <span style={{ fontSize:12.5, color: WA.bodyText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>{msg.file.name}</span>
                            </div>
                          )}
                          {(!msg.file || (msg.message && msg.message !== msg.file.name)) && (
                            <div style={{ direction:'rtl', wordBreak:'break-word' }}>{msg.message}</div>
                          )}
                          <div style={{ position:'absolute', bottom:5, left:8, display:'flex', alignItems:'center', gap:3, direction:'ltr', userSelect:'none' }}>
                            <span style={{ fontSize:11, color: WA.subText }}>{fmtTime(msg.created_at)}</span>
                            {isOut && <TickMark status={isOptimistic ? 'sending' : (msg.status || 'sent')} WA={WA}/>}
                          </div>
                        </div>
                      </div>
                    )
                  })
                  return items
                })()}
              </div>

              {/* ── Attachment preview (flex: 0 0 auto) ── */}
              {attached && (
                <div style={{ flexShrink:0, padding:'8px 16px', background: WA.inputBg, borderTop:`1px solid ${WA.border}`, display:'flex', alignItems:'center', gap:10, direction:'rtl' }}>
                  {attachedPreview
                    ? <img src={attachedPreview} alt="" style={{ width:38, height:38, borderRadius:6, objectFit:'cover', flexShrink:0 }}/>
                    : <span style={{ fontSize:22 }}>📎</span>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color: WA.bodyText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{attached.name}</div>
                    <div style={{ fontSize:11, color: WA.subText }}>{(attached.size/1024).toFixed(0)} KB · {attached.type?.startsWith('image/') ? 'תמונה' : 'מסמך'}</div>
                  </div>
                  <button onClick={()=>setAttached(null)} style={{ background:'none', border:'none', cursor:'pointer', color: WA.subText, fontSize:18, padding:'0 4px' }}>✕</button>
                </div>
              )}

              {/* ── Input Bar (flex: 0 0 auto — always visible, never scrolled away) ── */}
              <div style={{ flexShrink:0, padding:'10px 12px', background: WA.inputBg, display:'flex', alignItems:'center', gap:9, direction:'rtl', borderTop:`1px solid ${WA.border}`, transition:'background .25s' }}>
                <button onClick={()=>setEmoji(v=>!v)}
                  style={{ width:40, height:40, borderRadius:'50%', background:emoji?WA.green+'22':'transparent', border:'none', color:emoji?WA.green:WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:24 }}>
                  ☺
                </button>
                <button onClick={()=>fileRef.current?.click()}
                  style={{ width:40, height:40, borderRadius:'50%', background:'transparent', border:'none', color: WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon path={ICONS.paperclip} size={20}/>
                </button>
                <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:'none' }}
                  onChange={e=>{ if(e.target.files[0]) setAttached(e.target.files[0]); e.target.value='' }}/>
                <input ref={inputRef}
                  value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()} }}
                  placeholder="הקלד הודעה"
                  disabled={sending}
                  autoComplete="off"
                  style={{ flex:1, padding:'12px 18px', background: WA.inputFieldBg, border:'none', borderRadius:8, color: WA.bodyText, fontSize:14, fontFamily:'inherit', outline:'none', direction:'rtl', minWidth:0, boxShadow:`0 1px 2px rgba(0,0,0,.${isDark?'2':'06'})` }}/>
                <button onClick={sendMsg}
                  disabled={sending || (!input.trim() && !attached)}
                  style={{ width:44, height:44, borderRadius:'50%', background:(input.trim()||attached)?WA.green:WA.inputBg, border:'none', color:(input.trim()||attached)?'#fff':WA.subText, cursor:(input.trim()||attached)?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .2s', boxShadow:(input.trim()||attached)?'0 2px 8px '+WA.green+'66':'none' }}>
                  {sending
                    ? <span style={{ fontSize:11, fontWeight:700 }}>···</span>
                    : (input.trim()||attached)
                      ? <Icon path={ICONS.send} size={19}/>
                      : <Icon path={ICONS.mic}  size={21}/>
                  }
                </button>
              </div>

              {/* ── Emoji picker (flex: 0 0 auto) ── */}
              {emoji && (
                <div style={{ flexShrink:0, background: WA.inputBg, borderTop:`1px solid ${WA.border}`, padding:'10px 14px' }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, direction:'rtl' }}>
                    {['😊','😂','❤️','👍','🙏','🔥','✅','💪','😍','🎉','😢','😡','👏','🤔','💯','🙌','😁','🥰','👋','🎁','📞','📅','📍','💰','🏠'].map(em => (
                      <button key={em} onClick={()=>{ setInput(v=>v+em); setEmoji(false); inputRef.current?.focus() }}
                        style={{ background:'none', border:'none', cursor:'pointer', fontSize:24, padding:'4px 6px', borderRadius:6, lineHeight:1 }}
                        onMouseEnter={e=>e.currentTarget.style.background=WA.border}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ── Empty state ── */
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:22, color: WA.subText }}>
              <div style={{ width:100, height:100, borderRadius:'50%', background: isDark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.75)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 16px rgba(0,0,0,.08)' }}>
                <svg width="54" height="54" viewBox="0 0 24 24" fill={WA.subText+'66'}><path d={ICONS.chat}/></svg>
              </div>
              <div style={{ textAlign:'center', direction:'rtl' }}>
                <div style={{ fontSize:22, fontWeight:300, color: WA.bodyText, letterSpacing:.3, marginBottom:10 }}>WhatsApp Web</div>
                <div style={{ fontSize:14, color: WA.subText, lineHeight:1.8, maxWidth:340 }}>
                  בחר שיחה מהרשימה כדי לצפות בהיסטוריה ולשלוח הודעות
                </div>
              </div>
              <div style={{ width:300, height:1, background: WA.border }}/>
              <div style={{ fontSize:12.5, color: WA.subText, display:'flex', alignItems:'center', gap:6, direction:'rtl' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink:0 }}><path d={ICONS.lock}/></svg>
                הודעות נשלחות ומתקבלות דרך Green API
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════ CHAT LIST — names, on the RIGHT (340px) ═════════ */}
        {/* order:2 → sits just left of the icon rail, i.e. on the right side. */}
        <div style={{ order:2, width:340, flexShrink:0, display:'flex', flexDirection:'column', overflow:'hidden', background: WA.panelBg, borderLeft:`1px solid ${WA.border}`, transition:'background .25s' }}>

          {/* Panel header */}
          <div style={{ height:62, background: WA.inputBg, borderBottom:`1px solid ${WA.border}`, display:'flex', alignItems:'center', padding:'0 10px 0 10px', gap:8, flexShrink:0, direction:'rtl', transition:'background .25s' }}>
            <span style={{ fontWeight:700, fontSize:18, color: WA.bodyText, whiteSpace:'nowrap', flex:1 }}>צ'אט ירוק</span>
            <span style={{ background: status==='authorized' ? WA.authBadgeBg : status==='notAuthorized' ? (isDark?'#3B1A1F':'#FEE8EC') : WA.inputBg, color: status==='authorized' ? WA.authBadgeTxt : status==='notAuthorized' ? '#E2445C' : WA.subText, fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:10, whiteSpace:'nowrap' }}>
              {statusLabel}
            </span>
            {/* Theme toggle */}
            <button onClick={toggleTheme} title={isDark ? 'מצב בהיר' : 'מצב כהה'}
              style={{ width:32, height:32, borderRadius:7, background:'transparent', border:`1.5px solid ${WA.border}`, color: WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s', flexShrink:0 }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=WA.green; e.currentTarget.style.color=WA.green }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor=WA.border; e.currentTarget.style.color=WA.subText }}>
              <Icon path={isDark ? ICONS.sun : ICONS.moon} size={16}/>
            </button>
            {/* New chat */}
            <button onClick={()=>{setNewChat(true);setNewPhone('')}} title="שיחה חדשה"
              style={{ width:32, height:32, borderRadius:7, background:'transparent', border:`1.5px solid ${WA.border}`, color: WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:300, transition:'all .15s', flexShrink:0 }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=WA.green; e.currentTarget.style.color=WA.green }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor=WA.border; e.currentTarget.style.color=WA.subText }}>+</button>
          </div>

          {/* Search */}
          <div style={{ padding:'8px 10px', background: WA.panelBg, borderBottom:`1px solid ${WA.border}`, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background: WA.inputBg, borderRadius:9, padding:'8px 14px', direction:'rtl' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={WA.subText} style={{ flexShrink:0 }}><path d={ICONS.search}/></svg>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="חיפוש"
                style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color: WA.bodyText, fontFamily:'inherit', direction:'rtl' }}/>
              {search && (
                <button onClick={()=>setSearch('')}
                  style={{ background:'none', border:'none', cursor:'pointer', color: WA.subText, padding:0, display:'flex', alignItems:'center', fontSize:16, lineHeight:1 }}>✕</button>
              )}
            </div>
          </div>

          {/* Contact list — isolated, smooth scroll */}
          <div className="wa-contacts-scroll" style={{ flex:1, minHeight:0, overflowY:'auto' }}>
            {contactList.length === 0 ? (
              <div style={{ padding:28, textAlign:'center', color: WA.subText, fontSize:13, direction:'rtl', lineHeight:1.7 }}>
                {leads.filter(l=>l.phone).length === 0
                  ? <>אין לידים עם מספר טלפון<br/><span style={{ fontSize:11, opacity:.6 }}>הוסף ליד עם טלפון בלוח הלידים</span></>
                  : 'אין תוצאות לחיפוש'}
              </div>
            ) : contactList.map(lead => {
              const p        = intlPhone(lead.phone)
              const leadMsgs = chats[p] || []
              const lastMsg  = leadMsgs[leadMsgs.length-1]
              const isActive = contact?.id === lead.id
              const isRowLoading = loadingPhones.has(p) && !lastMsg
              const unread   = isActive ? 0 : unreadFor(p)
              return (
                <div key={lead.id}
                  onClick={() => selectContact(lead)}
                  style={{ padding:'12px 14px', display:'flex', gap:12, cursor:'pointer', background: isActive ? WA.selectedRow : WA.panelBg, borderBottom:`1px solid ${WA.border}`, transition:'background .1s', alignItems:'center', direction:'rtl', position:'relative' }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = WA.hoverRow
                    const btn = e.currentTarget.querySelector('.wa-del-btn')
                    if (btn) btn.style.opacity = '1'
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = WA.panelBg
                    const btn = e.currentTarget.querySelector('.wa-del-btn')
                    if (btn) btn.style.opacity = '0'
                  }}>
                  {isActive && <div style={{ position:'absolute', right:0, top:0, bottom:0, width:3, background: WA.green, borderRadius:'0 2px 2px 0' }}/>}
                  <div style={{ width:49, height:49, borderRadius:'50%', background:avatarBg(lead.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff', flexShrink:0, userSelect:'none' }}>
                    {(lead.name||lead.phone||'?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:3, gap:8 }}>
                      <span style={{ fontWeight: unread?700:600, fontSize:15, color: WA.bodyText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                        {lead.name||lead.phone}
                      </span>
                      {lastMsg && (
                        <span style={{ fontSize:11, color: unread ? WA.green : WA.subText, fontWeight: unread?700:400, flexShrink:0, whiteSpace:'nowrap' }}>
                          {fmtRowTime(lastMsg.created_at)}
                        </span>
                      )}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      {isRowLoading && <div className="wa-row-spinner"/>}
                      {!isRowLoading && lastMsg?.direction==='out' && <TickMark status={lastMsg.status || 'sent'} WA={WA}/>}
                      <span style={{ fontSize:13, color: unread ? WA.bodyText : WA.subText, fontWeight: unread?600:400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>
                        {isRowLoading ? <span style={{ opacity:.5 }}>טוען...</span> : lastMsg ? lastMsg.message : lead.phone}
                      </span>
                      {unread > 0 && (
                        <span style={{ background: WA.unread, color:'#fff', fontSize:11, fontWeight:700, minWidth:18, height:18, borderRadius:9, padding:'0 5px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, lineHeight:1 }}>
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Delete button — hover-reveal */}
                  {onDeleteLead && (
                    <button className="wa-del-btn"
                      onClick={e => handleDeleteClick(e, lead)}
                      style={{ opacity:0, transition:'opacity .15s', width:28, height:28, borderRadius:'50%', border:'none', background: WA.delBtn, color:'#E05252', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}
                      title="מחק איש קשר">✕</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══════════════ ICON SIDEBAR — far RIGHT in RTL (52px) ═════════ */}
        {/* order:1 → the rightmost panel, with the names list directly beside it. */}
        <div style={{ order:1, width:52, flexShrink:0, display:'flex', flexDirection:'column', background: WA.inputBg, borderLeft:`1px solid ${WA.border}`, alignItems:'center', padding:'8px 0', transition:'background .25s' }}>
          {[
            { id:'bell',     path:ICONS.bell,     title:'התראות'     },
            { id:'chats',    path:ICONS.chat,     title:'שיחות'      },
            { id:'contacts', path:ICONS.contacts, title:'אנשי קשר'   },
            { id:'phone',    path:ICONS.phone,    title:'שיחות קול'  },
          ].map(({ id, path, title }) => {
            const active = activeNav === id
            return (
              <button key={id} title={title} onClick={()=>setActiveNav(id)}
                style={{ position:'relative', width:44, height:44, borderRadius:10, border:'none', background:active?WA.green+'18':'transparent', color:active?WA.green:WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s', marginBottom:4 }}
                onMouseEnter={e=>{ if(!active){ e.currentTarget.style.background=WA.border; e.currentTarget.style.color=WA.bodyText } }}
                onMouseLeave={e=>{ e.currentTarget.style.background=active?WA.green+'18':'transparent'; e.currentTarget.style.color=active?WA.green:WA.subText }}>
                <Icon path={path} size={22}/>
                {id==='chats' && totalUnread>0 && (
                  <span style={{ position:'absolute', top:3, left:3, minWidth:16, height:16, padding:'0 4px', borderRadius:8, background:'#E05252', color:'#fff', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, border:`2px solid ${WA.inputBg}` }}>
                    {totalUnread>99?'99+':totalUnread}
                  </span>
                )}
              </button>
            )
          })}
          <div style={{ flex:1 }}/>
          <button title="הגדרות" onClick={()=>setActiveNav('settings')}
            style={{ width:44, height:44, borderRadius:10, border:'none', background:'transparent', color: WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s', marginBottom:4 }}
            onMouseEnter={e=>{ e.currentTarget.style.background=WA.border; e.currentTarget.style.color=WA.bodyText }}
            onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color=WA.subText }}>
            <Icon path={ICONS.settings} size={22}/>
          </button>
          <div title="אפיק הנחל"
            style={{ width:36, height:36, borderRadius:'50%', background: WA.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'#fff', cursor:'pointer', marginBottom:4, userSelect:'none' }}>
            א
          </div>
        </div>

      </div>{/* end main layout */}
    </div>
  )
}
