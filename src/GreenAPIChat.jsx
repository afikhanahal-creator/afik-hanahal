/**
 * GreenAPIChat — WhatsApp-Web / Green API Console replica
 * Light theme · RTL Hebrew · Full-page chat interface
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE    = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const ADMIN_TOKEN = 'AFIKhanahal2026'
const ACCOUNT_EMAIL = 'afik.hanahal@gmail.com'

// ─── Green API direct credentials ────────────────────────────────────────────
const GREEN_INSTANCE = '7107558519'
const GREEN_TOKEN    = '191b9e9c4fc540f1ad25c8607389c0d689d15794f8094a0589'
const GREEN_URL      = `https://7107.api.greenapi.com/waInstance${GREEN_INSTANCE}`

// ─── WhatsApp Web color palette (exact from spec) ────────────────────────────
const WA = {
  bubbleOut:    '#D9FDD3',
  bubbleIn:     '#FFFFFF',
  chatBg:       '#EFEAE2',
  panelBg:      '#FFFFFF',
  selectedRow:  '#E8F5E9',
  authBadgeBg:  '#D4F4DD',
  authBadgeTxt: '#2E7D32',
  green:        '#00A884',
  inputBg:      '#F0F2F5',
  bodyText:     '#111B21',
  subText:      '#667781',
  border:       '#E9EDEF',
  topBorder:    '#E5E5E5',
  tick:         '#53BDEB',
  tickGray:     '#8696A0',
}

// ─── WhatsApp doodle background (sunflower pattern) ──────────────────────────
const DOODLE_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='76' height='76'%3E%3Cdefs%3E%3Cpattern id='wa' x='0' y='0' width='76' height='76' patternUnits='userSpaceOnUse'%3E%3Cg fill='none' stroke='%23A09880' stroke-opacity='0.12' stroke-width='1'%3E%3Ccircle cx='38' cy='38' r='13'/%3E%3Ccircle cx='38' cy='38' r='5'/%3E%3Cline x1='38' y1='5' x2='38' y2='18'/%3E%3Cline x1='38' y1='58' x2='38' y2='71'/%3E%3Cline x1='5' y1='38' x2='18' y2='38'/%3E%3Cline x1='58' y1='38' x2='71' y2='38'/%3E%3Cline x1='13' y1='13' x2='22' y2='22'/%3E%3Cline x1='54' y1='54' x2='63' y2='63'/%3E%3Cline x1='63' y1='13' x2='54' y2='22'/%3E%3Cline x1='22' y1='54' x2='13' y2='63'/%3E%3Cpath d='M24 38 Q31 30 38 38 Q45 46 52 38' stroke-opacity='0.07'/%3E%3Cpath d='M38 24 Q46 31 38 38 Q30 45 38 52' stroke-opacity='0.07'/%3E%3C/g%3E%3C/pattern%3E%3C/defs%3E%3Crect width='76' height='76' fill='url(%23wa)'/%3E%3C/svg%3E")`

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
  try { return new Date(ds).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function fmtDate(ds) {
  const d  = new Date(ds)
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
    id: m.idMessage,
    direction: m.type === 'outgoing' ? 'out' : 'in',
    message: text,
    created_at: new Date((m.timestamp || 0) * 1000).toISOString(),
    status: m.statusMessage === 'read' ? 'read' : 'delivered',
  }
}

// ─── SVG icon helpers ─────────────────────────────────────────────────────────
const Icon = ({ path, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d={path}/>
  </svg>
)

const ICONS = {
  chat:        'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z',
  status:      'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z',
  phone:       'M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02L6.6 10.8z',
  contacts:    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  settings:    'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  send:        'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
  mic:         'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  paperclip:   'M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z',
  bell:        'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  search:      'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  lock:        'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function GreenAPIChat({ leads = [], lang = 'he', initialContact = null, onOpenLead, onDeleteLead }) {
  const [chats,       setChats]      = useState({})
  const [contact,     setContact]    = useState(initialContact)
  const [search,      setSearch]     = useState('')
  const [input,       setInput]      = useState('')
  const [sending,     setSending]    = useState(false)
  const [loading,     setLoading]    = useState(false)
  const [fetchError,  setFetchError] = useState(null)
  const [status,      setStatus]     = useState(null)
  const [newChatOpen, setNewChat]    = useState(false)
  const [newPhone,    setNewPhone]   = useState('')
  const [activeNav,   setActiveNav]  = useState('chats')
  const [emoji,       setEmoji]      = useState(false)
  const [attached,    setAttached]   = useState(null)   // file attachment

  const scrollRef = useRef(null)
  const pollRef   = useRef(null)
  const inputRef  = useRef(null)
  const fileRef   = useRef(null)

  // ── API calls ────────────────────────────────────────────────────────────────

  // Fetch directly from Green API (always available)
  const fetchGreenHistory = useCallback(async (phone) => {
    const p = intlPhone(phone)
    if (!p) return []
    try {
      const r = await fetch(`${GREEN_URL}/getChatHistory/${GREEN_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${p}@c.us`, count: 100 }),
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) return []
      const data = await r.json()
      if (!Array.isArray(data)) return []
      return data
        .map(normalizeGreenMsg)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    } catch { return [] }
  }, [])

  // Merge backend + Green API, dedup by id, sort by time
  const fetchMsgs = useCallback(async (phone, opts = {}) => {
    const p = intlPhone(phone)
    if (!p) return
    if (opts.showLoader) { setLoading(true); setFetchError(null) }

    try {
      const [backendResult, greenResult] = await Promise.allSettled([
        API_BASE
          ? fetch(`${API_BASE}/api/chats/${p}`, {
              headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
              signal: AbortSignal.timeout(10000),
            }).then(r => r.ok ? r.json() : []).catch(() => [])
          : Promise.resolve([]),
        fetchGreenHistory(phone),
      ])

      const fromBackend = backendResult.status === 'fulfilled' && Array.isArray(backendResult.value) ? backendResult.value : []
      const fromGreen   = greenResult.status   === 'fulfilled' && Array.isArray(greenResult.value)   ? greenResult.value   : []

      const greenErr = greenResult.status === 'rejected' ? greenResult.reason?.message : null

      // Deduplicate: prefer Green API entry when id matches
      const byId = new Map()
      fromBackend.forEach(m => m.id && byId.set(m.id, m))
      fromGreen.forEach(m => m.id && byId.set(m.id, m))

      const merged = [...byId.values()]
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

      if (merged.length === 0 && greenErr) {
        setFetchError(greenErr)
      } else {
        setFetchError(null)
      }

      setChats(prev => ({ ...prev, [p]: merged }))
    } finally {
      if (opts.showLoader) setLoading(false)
    }
  }, [fetchGreenHistory])

  // Send via Green API directly (fallback when backend unavailable)
  const sendViaGreenAPI = useCallback(async (p, msg) => {
    const r = await fetch(`${GREEN_URL}/sendMessage/${GREEN_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: `${p}@c.us`, message: msg }),
      signal: AbortSignal.timeout(20000),
    })
    return r.ok
  }, [])

  const fetchStatus = useCallback(async () => {
    // Try Green API status endpoint directly
    try {
      const r = await fetch(`${GREEN_URL}/getStateInstance/${GREEN_TOKEN}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok) {
        const d = await r.json()
        // Green API returns { stateInstance: 'authorized' | 'notAuthorized' | ... }
        setStatus(d.stateInstance || null)
        return
      }
    } catch {}

    // Fallback to backend
    if (!API_BASE) { setStatus('notConfigured'); return }
    try {
      const r = await fetch(`${API_BASE}/api/chats/status`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok) { const d = await r.json(); setStatus(d.state || null) }
      else setStatus('error')
    } catch { setStatus('error') }
  }, [])

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => { fetchStatus() }, [fetchStatus])

  // Preload last messages for all phone contacts (first 20, via Green API)
  useEffect(() => {
    leads.filter(l => l.phone).slice(0, 20).forEach(l => fetchMsgs(l.phone))
  }, [leads.length, fetchMsgs]) // eslint-disable-line

  // Switch to initialContact when prop changes — show loader on first open
  useEffect(() => {
    if (initialContact) {
      setContact(initialContact)
      fetchMsgs(initialContact.phone, { showLoader: true })
    }
  }, [initialContact?.id]) // eslint-disable-line

  // Poll active contact every 5 seconds
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (!contact?.phone) return
    fetchMsgs(contact.phone, { showLoader: true })   // first load shows spinner
    pollRef.current = setInterval(() => fetchMsgs(contact.phone), 5000)
    return () => clearInterval(pollRef.current)
  }, [contact?.id, fetchMsgs])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chats, contact?.phone])

  // ── Actions ──────────────────────────────────────────────────────────────────
  const selectContact = (lead) => {
    setContact(lead)
    fetchMsgs(lead.phone)
    setEmoji(false)
    setTimeout(() => inputRef.current?.focus(), 80)
  }

  const sendMsg = async () => {
    const msg = input.trim()
    if ((!msg && !attached) || !contact || sending) return
    const p = intlPhone(contact.phone)
    if (!p) { alert('מספר טלפון לא תקין'); return }

    const optId = 'opt-' + Date.now()
    setSending(true)
    setInput('')
    setEmoji(false)

    // Optimistic update
    setChats(prev => ({
      ...prev,
      [p]: [...(prev[p]||[]), {
        id: optId,
        direction: 'out',
        message: msg || (attached?.name || 'קובץ'),
        created_at: new Date().toISOString(),
        status: 'sending',
      }]
    }))

    let ok = false
    try {
      // Try backend first (if configured)
      if (API_BASE) {
        const r = await fetch(`${API_BASE}/api/chats/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
          body: JSON.stringify({ phone: p, message: msg }),
          signal: AbortSignal.timeout(15000),
        })
        if (r.ok) ok = true
      }

      // Fallback: send directly via Green API
      if (!ok) {
        ok = await sendViaGreenAPI(p, msg)
      }

      if (ok) {
        setAttached(null)
        // Refresh after 2s to pick up the sent message from Green API
        setTimeout(() => fetchMsgs(contact.phone), 2000)
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

  // ── Derived state ────────────────────────────────────────────────────────────
  const sl = search.toLowerCase()
  const contactList = useMemo(() => {
    return leads
      .filter(l => l.phone)
      .filter(l => !search || (l.name||'').toLowerCase().includes(sl) || (l.phone||'').includes(search))
      .sort((a, b) => {
        const pa = intlPhone(a.phone), pb = intlPhone(b.phone)
        const la = chats[pa]?.[chats[pa].length-1]?.created_at || 0
        const lb = chats[pb]?.[chats[pb].length-1]?.created_at || 0
        return new Date(lb) - new Date(la)
      })
  }, [leads, search, chats, sl])

  const chatPhone  = contact ? intlPhone(contact.phone) : null
  const msgs       = chatPhone ? (chats[chatPhone]||[]) : []
  const contactIdx = contactList.findIndex(l => l.id === contact?.id)

  const statusColor = status==='authorized' ? '#22C55E'
    : status==='notAuthorized' ? '#F97316'
    : status==='error'         ? '#E05252'
    : '#8696A0'
  const statusLabel = status==='authorized'    ? 'מחובר'
    : status==='notAuthorized' ? 'לא מחובר'
    : status==='error'         ? 'שגיאה'
    : status==='notConfigured' ? 'לא מוגדר'
    : 'טוען...'

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, fontFamily:'Rubik,"Segoe UI","Helvetica Neue","Noto Sans Hebrew",Arial,sans-serif', overflow:'hidden', background:WA.panelBg, colorScheme:'light' }}>

      {/* ── New Chat Modal ───────────────────────────────────────────────────── */}
      {newChatOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e => e.target===e.currentTarget && setNewChat(false)}>
          <div style={{ background:'#fff', borderRadius:14, padding:28, width:380, direction:'rtl', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize:17, fontWeight:700, color:WA.bodyText, marginBottom:6 }}>שיחה חדשה</div>
            <div style={{ fontSize:12.5, color:WA.subText, marginBottom:16 }}>הכנס מספר טלפון</div>
            <input autoFocus value={newPhone} onChange={e=>setNewPhone(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&startNewChat()}
              placeholder="972XXXXXXXXX  או  05XXXXXXXX"
              style={{ width:'100%', padding:'12px 14px', border:`1.5px solid ${WA.border}`, borderRadius:8, color:WA.bodyText, fontSize:14, fontFamily:'inherit', outline:'none', direction:'ltr', marginBottom:18, boxSizing:'border-box', transition:'border-color .15s' }}
              onFocus={e=>e.target.style.borderColor=WA.green}
              onBlur={e=>e.target.style.borderColor=WA.border}/>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={startNewChat}
                style={{ flex:1, padding:'12px 0', background:WA.green, border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                התחל שיחה
              </button>
              <button onClick={()=>{setNewChat(false);setNewPhone('')}}
                style={{ flex:1, padding:'12px 0', background:WA.inputBg, border:'none', borderRadius:8, color:WA.subText, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Status Bar ───────────────────────────────────────────────────── */}
      <div style={{ height:48, background:'#fff', borderBottom:`1px solid ${WA.topBorder}`, display:'flex', alignItems:'center', padding:'0 18px', gap:10, flexShrink:0, direction:'rtl' }}>
        {/* Sun-burst connection indicator */}
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink:0 }}>
          <circle cx="12" cy="12" r="4.5" fill={statusColor}/>
          {[0,45,90,135,180,225,270,315].map(a => {
            const rad = (a * Math.PI) / 180
            return (
              <line key={a}
                x1={12 + Math.cos(rad)*6.5} y1={12 + Math.sin(rad)*6.5}
                x2={12 + Math.cos(rad)*9.5} y2={12 + Math.sin(rad)*9.5}
                stroke={statusColor} strokeWidth="2" strokeLinecap="round"/>
            )
          })}
        </svg>
        <span style={{ fontSize:13.5, fontWeight:600, color:WA.bodyText }}>{ACCOUNT_EMAIL}</span>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:12, color:WA.subText }}>Green API · </span>
        <span style={{ fontSize:12, fontWeight:600, color:statusColor }}>{statusLabel}</span>
        <button onClick={fetchStatus}
          style={{ width:28, height:28, borderRadius:'50%', background:'transparent', border:`1px solid ${WA.border}`, color:WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, marginRight:4 }}
          title="רענן סטטוס"
          onMouseEnter={e=>e.currentTarget.style.borderColor=WA.green}
          onMouseLeave={e=>e.currentTarget.style.borderColor=WA.border}>↻</button>
      </div>

      {/* ── Main Layout: [chatWindow][chatList][iconSidebar] ─────────────────── */}
      {/* direction:ltr so children fill left-to-right visually */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', direction:'ltr', background:WA.panelBg }}>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CHAT WINDOW (left, ~65%) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ flex:'1 1 0', display:'flex', flexDirection:'column', minWidth:0, background:WA.chatBg, backgroundImage:DOODLE_BG, backgroundRepeat:'repeat' }}>
          {contact ? (
            <>
              {/* Contact header */}
              <div style={{ height:62, background:'#fff', borderBottom:`1px solid ${WA.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:12, flexShrink:0, direction:'rtl' }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:avatarBg(contact.name), display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16, color:'#fff', flexShrink:0, userSelect:'none' }}>
                  {(contact.name||contact.phone||'?')[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:15, color:WA.bodyText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {contact.name||contact.phone}
                  </div>
                  <div style={{ fontSize:12, color:WA.subText, direction:'ltr' }}>{contact.phone}</div>
                </div>
                {/* View Lead button (if contact matches a real lead) */}
                {onOpenLead && leads.find(l=>l.id===contact.id) && (
                  <button onClick={()=>onOpenLead(contact)}
                    style={{ padding:'5px 12px', background:WA.inputBg, border:`1px solid ${WA.border}`, borderRadius:8, color:WA.subText, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap', transition:'all .15s' }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor=WA.green; e.currentTarget.style.color=WA.green }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor=WA.border; e.currentTarget.style.color=WA.subText }}>
                    צפה בליד ↗
                  </button>
                )}
                {/* Prev / Next lead navigation */}
                {[
                  { delta:-1, disabled:contactIdx<=0, label:'‹', title:'ליד קודם' },
                  { delta:+1, disabled:contactIdx>=contactList.length-1, label:'›', title:'ליד הבא' },
                ].map(({ delta, disabled, label, title }) => (
                  <button key={delta} title={title}
                    onClick={()=>!disabled&&selectContact(contactList[contactIdx+delta])}
                    style={{ width:32, height:32, borderRadius:'50%', background:'transparent', border:'none', color:disabled?WA.border:WA.subText, cursor:disabled?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0, lineHeight:1, transition:'background .15s, color .15s' }}
                    onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.background=WA.inputBg }}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    {label}
                  </button>
                ))}
                {/* Refresh */}
                <button onClick={()=>fetchMsgs(contact.phone)} title="רענן"
                  style={{ width:32, height:32, borderRadius:'50%', background:'transparent', border:'none', color:WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, transition:'background .15s' }}
                  onMouseEnter={e=>e.currentTarget.style.background=WA.inputBg}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>↻</button>
                {/* Close */}
                <button onClick={()=>setContact(null)} title="סגור"
                  style={{ width:32, height:32, borderRadius:'50%', background:'transparent', border:'none', color:WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0, transition:'background .15s' }}
                  onMouseEnter={e=>e.currentTarget.style.background=WA.inputBg}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>✕</button>
              </div>

              {/* Messages area */}
              <div ref={scrollRef}
                style={{ flex:1, overflowY:'auto', padding:'16px 7%', display:'flex', flexDirection:'column', gap:0, scrollBehavior:'smooth' }}>
                {loading ? (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:WA.subText, minHeight:200 }}>
                    {/* Spinner */}
                    <div style={{ width:44, height:44, borderRadius:'50%', border:`4px solid ${WA.border}`, borderTopColor:WA.green, animation:'wa-spin 0.75s linear infinite' }}/>
                    <style>{`@keyframes wa-spin { to { transform: rotate(360deg); } }`}</style>
                    <div style={{ fontSize:13.5, direction:'rtl' }}>טוען היסטוריית שיחה...</div>
                  </div>
                ) : msgs.length === 0 ? (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:14, color:WA.subText, minHeight:200, padding:'0 24px' }}>
                    {fetchError ? (
                      <>
                        <div style={{ width:64, height:64, borderRadius:'50%', background:'rgba(224,82,82,.08)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ fontSize:28 }}>⚠️</span>
                        </div>
                        <div style={{ fontSize:14, fontWeight:600, color:'#E05252', direction:'rtl', textAlign:'center' }}>לא ניתן לטעון את ההיסטוריה</div>
                        <div style={{ fontSize:12, color:WA.subText, direction:'rtl', textAlign:'center', lineHeight:1.6, maxWidth:280 }}>
                          {fetchError.includes('CORS') || fetchError.includes('fetch') || fetchError.includes('network')
                            ? 'שגיאת CORS — הדפדפן חוסם גישה ישירה ל-Green API. הפעל את הטוקן בשרת הביניים.'
                            : fetchError}
                        </div>
                        <button onClick={() => fetchMsgs(contact.phone, { showLoader: true })}
                          style={{ padding:'9px 20px', background:WA.green, border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                          נסה שוב
                        </button>
                        <div style={{ fontSize:11, color:WA.subText, direction:'rtl', textAlign:'center', opacity:.7 }}>
                          chatId: {intlPhone(contact.phone)}@c.us
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ width:72, height:72, borderRadius:'50%', background:'rgba(255,255,255,.8)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,.08)' }}>
                          <Icon path={ICONS.chat} size={32}/>
                        </div>
                        <div style={{ fontSize:14, textAlign:'center', direction:'rtl', lineHeight:1.7 }}>
                          אין הודעות עדיין<br/>
                          <span style={{ fontSize:12, opacity:.6 }}>שלח הודעה ראשונה</span>
                        </div>
                        <button onClick={() => fetchMsgs(contact.phone, { showLoader: true })}
                          style={{ padding:'7px 18px', background:'transparent', border:`1.5px solid ${WA.border}`, borderRadius:8, color:WA.subText, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
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
                    // Date separator
                    if (msgDateStr !== lastDate) {
                      lastDate = msgDateStr
                      items.push(
                        <div key={`date-${i}`} style={{ display:'flex', justifyContent:'center', margin:'14px 0 10px', flexShrink:0 }}>
                          <span style={{ fontSize:12.5, fontWeight:500, color:'#54656F', background:'#fff', borderRadius:8, padding:'5px 18px', boxShadow:'0 1px 0.5px rgba(0,0,0,.13)', userSelect:'none' }}>
                            {fmtDate(msg.created_at)}
                          </span>
                        </div>
                      )
                    }
                    // Is this the last in a group?
                    const isLastInGroup = i === msgs.length-1
                      || msgs[i+1]?.direction !== msg.direction
                      || Math.abs(new Date(msgs[i+1]?.created_at) - new Date(msg.created_at)) > 60000

                    const isOptimistic = msg.id?.startsWith?.('opt-')
                    const bubbleRadius = isOut
                      ? (isLastInGroup ? '7.5px 7.5px 0 7.5px' : '7.5px')
                      : (isLastInGroup ? '7.5px 7.5px 7.5px 0' : '7.5px')

                    items.push(
                      <div key={msg.id||i}
                        style={{ display:'flex', justifyContent:isOut?'flex-end':'flex-start', marginBottom:isLastInGroup?6:2, flexShrink:0, direction:'rtl', paddingRight:isOut?0:2, paddingLeft:isOut?2:0, position:'relative' }}>
                        {/* Message bubble */}
                        <div style={{
                          maxWidth:'65%', minWidth:90,
                          padding:'6px 9px 22px 9px',
                          borderRadius:bubbleRadius,
                          background:isOut ? WA.bubbleOut : WA.bubbleIn,
                          color:WA.bodyText,
                          fontSize:14.2,
                          lineHeight:1.55,
                          wordBreak:'break-word',
                          boxShadow:'0 1px 0.5px rgba(0,0,0,.13)',
                          position:'relative',
                          opacity: isOptimistic ? 0.75 : 1,
                          transition:'opacity .3s',
                        }}>
                          {/* Tail SVG */}
                          {isLastInGroup && isOut && (
                            <svg style={{ position:'absolute', bottom:0, right:-8, width:9, height:13 }} viewBox="0 0 9 13">
                              <path d="M9 0 Q0 10 0 13 L9 13 Z" fill={WA.bubbleOut}/>
                            </svg>
                          )}
                          {isLastInGroup && !isOut && (
                            <svg style={{ position:'absolute', bottom:0, left:-8, width:9, height:13 }} viewBox="0 0 9 13">
                              <path d="M0 0 Q9 10 9 13 L0 13 Z" fill={WA.bubbleIn}/>
                            </svg>
                          )}
                          {/* Text */}
                          <div style={{ direction:'rtl', wordBreak:'break-word' }}>{msg.message}</div>
                          {/* Time + tick */}
                          <div style={{ position:'absolute', bottom:5, left:8, display:'flex', alignItems:'center', gap:3, direction:'ltr', userSelect:'none' }}>
                            <span style={{ fontSize:11, color:WA.subText }}>{fmtTime(msg.created_at)}</span>
                            {isOut && (
                              <span style={{ fontSize:14, lineHeight:1, color: isOptimistic ? WA.tickGray : msg.status==='read' ? WA.tick : WA.tickGray }}>✓✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                  return items
                })()}
              </div>

              {/* Attachment preview */}
              {attached && (
                <div style={{ padding:'8px 16px', background:'#fff', borderTop:`1px solid ${WA.border}`, display:'flex', alignItems:'center', gap:10, direction:'rtl', flexShrink:0 }}>
                  <span style={{ fontSize:22 }}>📎</span>
                  <span style={{ fontSize:13, color:WA.bodyText, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{attached.name}</span>
                  <button onClick={()=>setAttached(null)} style={{ background:'none', border:'none', cursor:'pointer', color:WA.subText, fontSize:18, padding:'0 4px' }}>✕</button>
                </div>
              )}

              {/* Input bar */}
              <div style={{ padding:'10px 12px', background:WA.inputBg, display:'flex', alignItems:'center', gap:9, flexShrink:0, direction:'rtl' }}>
                {/* Emoji button */}
                <button onClick={()=>setEmoji(v=>!v)}
                  style={{ width:40, height:40, borderRadius:'50%', background:emoji?WA.green+'22':'transparent', border:'none', color:emoji?WA.green:WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:24, transition:'all .15s' }}
                  title="אמוג'י">
                  ☺
                </button>
                {/* Attachment */}
                <button onClick={()=>fileRef.current?.click()}
                  style={{ width:40, height:40, borderRadius:'50%', background:'transparent', border:'none', color:WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'color .15s' }}
                  title="צירוף קובץ"
                  onMouseEnter={e=>e.currentTarget.style.color=WA.bodyText}
                  onMouseLeave={e=>e.currentTarget.style.color=WA.subText}>
                  <Icon path={ICONS.paperclip} size={20}/>
                </button>
                <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:'none' }}
                  onChange={e=>{ if(e.target.files[0]) setAttached(e.target.files[0]); e.target.value='' }}/>
                {/* Text input */}
                <input ref={inputRef}
                  value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()} }}
                  placeholder="הקלד הודעה"
                  disabled={sending}
                  style={{ flex:1, padding:'12px 18px', background:'#fff', border:'none', borderRadius:8, color:WA.bodyText, fontSize:14, fontFamily:'inherit', outline:'none', direction:'rtl', minWidth:0, boxShadow:'0 1px 2px rgba(0,0,0,.06)' }}/>
                {/* Send / mic */}
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

              {/* Simple emoji picker (common emojis) */}
              {emoji && (
                <div style={{ background:'#fff', borderTop:`1px solid ${WA.border}`, padding:'10px 14px', flexShrink:0 }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, direction:'rtl' }}>
                    {['😊','😂','❤️','👍','🙏','🔥','✅','💪','😍','🎉','😢','😡','👏','🤔','💯','🙌','😁','🥰','👋','🎁','📞','📅','📍','💰','🏠'].map(em => (
                      <button key={em} onClick={()=>{ setInput(v=>v+em); setEmoji(false); inputRef.current?.focus() }}
                        style={{ background:'none', border:'none', cursor:'pointer', fontSize:24, padding:'4px 6px', borderRadius:6, transition:'background .1s', lineHeight:1 }}
                        onMouseEnter={e=>e.currentTarget.style.background=WA.inputBg}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* ── Empty state (no contact selected) ── */
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:22, color:WA.subText }}>
              <div style={{ width:100, height:100, borderRadius:'50%', background:'rgba(255,255,255,.75)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 16px rgba(0,0,0,.08)' }}>
                <svg width="54" height="54" viewBox="0 0 24 24" fill={WA.subText+'66'}>
                  <path d={ICONS.chat}/>
                </svg>
              </div>
              <div style={{ textAlign:'center', direction:'rtl' }}>
                <div style={{ fontSize:22, fontWeight:300, color:'#41525D', letterSpacing:.3, marginBottom:10 }}>WhatsApp Web</div>
                <div style={{ fontSize:14, color:WA.subText, lineHeight:1.8, maxWidth:340 }}>
                  בחר שיחה מהרשימה כדי לצפות בהיסטוריה ולשלוח הודעות
                </div>
              </div>
              <div style={{ width:300, height:1, background:WA.border }}/>
              <div style={{ fontSize:12.5, color:WA.subText, display:'flex', alignItems:'center', gap:6, direction:'rtl' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink:0 }}><path d={ICONS.lock}/></svg>
                הודעות נשלחות ומתקבלות דרך Green API
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CHAT LIST (right, ~330px) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ width:340, flexShrink:0, display:'flex', flexDirection:'column', background:WA.panelBg, borderRight:`1px solid ${WA.border}`, borderLeft:`1px solid ${WA.border}` }}>

          {/* Panel header */}
          <div style={{ height:62, background:WA.inputBg, borderBottom:`1px solid ${WA.border}`, display:'flex', alignItems:'center', padding:'0 14px 0 10px', gap:10, flexShrink:0, direction:'rtl' }}>
            <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:19, color:WA.bodyText, whiteSpace:'nowrap' }}>צ'אט ירוק</span>
              <span style={{ background: status==='authorized' ? WA.authBadgeBg : status==='notAuthorized' ? '#FEE8EC' : '#F0F2F5', color: status==='authorized' ? WA.authBadgeTxt : status==='notAuthorized' ? '#E2445C' : WA.subText, fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:10, whiteSpace:'nowrap' }}>
                {statusLabel}
              </span>
            </div>
            <button onClick={()=>{setNewChat(true);setNewPhone('')}} title="שיחה חדשה"
              style={{ width:34, height:34, borderRadius:6, background:'transparent', border:`1.5px solid ${WA.border}`, color:WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:300, transition:'all .15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=WA.green; e.currentTarget.style.color=WA.green }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor=WA.border; e.currentTarget.style.color=WA.subText }}>+</button>
          </div>

          {/* Search */}
          <div style={{ padding:'8px 10px', background:WA.panelBg, borderBottom:`1px solid ${WA.border}`, flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:WA.inputBg, borderRadius:9, padding:'8px 14px', direction:'rtl' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={WA.subText} style={{ flexShrink:0 }}><path d={ICONS.search}/></svg>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="חיפוש"
                style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color:WA.bodyText, fontFamily:'inherit', direction:'rtl' }}/>
              {search && (
                <button onClick={()=>setSearch('')}
                  style={{ background:'none', border:'none', cursor:'pointer', color:WA.subText, padding:0, display:'flex', alignItems:'center', fontSize:16, lineHeight:1 }}>✕</button>
              )}
            </div>
          </div>

          {/* Conversation list */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {contactList.length === 0 ? (
              <div style={{ padding:28, textAlign:'center', color:WA.subText, fontSize:13, direction:'rtl', lineHeight:1.7 }}>
                {leads.filter(l=>l.phone).length === 0
                  ? <>אין לידים עם מספר טלפון<br/><span style={{ fontSize:11, opacity:.6 }}>הוסף ליד עם טלפון בלוח הלידים</span></>
                  : 'אין תוצאות לחיפוש'}
              </div>
            ) : contactList.map(lead => {
              const p        = intlPhone(lead.phone)
              const leadMsgs = chats[p] || []
              const lastMsg  = leadMsgs[leadMsgs.length-1]
              const isActive = contact?.id === lead.id
              return (
                <div key={lead.id}
                  className="wa-contact-row"
                  onClick={() => selectContact(lead)}
                  style={{ padding:'12px 14px', display:'flex', gap:12, cursor:'pointer', background:isActive ? WA.selectedRow : WA.panelBg, borderBottom:`1px solid ${WA.border}`, transition:'background .1s', alignItems:'center', direction:'rtl', position:'relative' }}
                  onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background='#F5F6F6'; e.currentTarget.querySelector('.wa-del-btn')?.style && (e.currentTarget.querySelector('.wa-del-btn').style.opacity='1') }}
                  onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background=WA.panelBg; e.currentTarget.querySelector('.wa-del-btn')?.style && (e.currentTarget.querySelector('.wa-del-btn').style.opacity='0') }}>
                  {/* Active left-border indicator */}
                  {isActive && <div style={{ position:'absolute', right:0, top:0, bottom:0, width:3, background:WA.green, borderRadius:'0 2px 2px 0' }}/>}
                  {/* Avatar */}
                  <div style={{ width:49, height:49, borderRadius:'50%', background:avatarBg(lead.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff', flexShrink:0, userSelect:'none' }}>
                    {(lead.name||lead.phone||'?')[0].toUpperCase()}
                  </div>
                  {/* Content */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:3, gap:8 }}>
                      <span style={{ fontWeight:600, fontSize:15, color:WA.bodyText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                        {lead.name||lead.phone}
                      </span>
                      {lastMsg && (
                        <span style={{ fontSize:11, color:WA.subText, flexShrink:0, whiteSpace:'nowrap' }}>
                          {fmtRowTime(lastMsg.created_at)}
                        </span>
                      )}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      {lastMsg?.direction==='out' && (
                        <span style={{ color:lastMsg.status==='read'?WA.tick:WA.tickGray, fontSize:14, flexShrink:0, lineHeight:1 }}>✓✓</span>
                      )}
                      <span style={{ fontSize:13, color:WA.subText, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', flex:1 }}>
                        {lastMsg ? lastMsg.message : lead.phone}
                      </span>
                    </div>
                  </div>
                  {/* Delete lead button (appears on hover) */}
                  {onDeleteLead && (
                    <button className="wa-del-btn"
                      onClick={e => {
                        e.stopPropagation()
                        if (window.confirm(`למחוק את הליד "${lead.name||lead.phone}" לצמיתות?`)) {
                          if (contact?.id === lead.id) setContact(null)
                          onDeleteLead(lead.id)
                        }
                      }}
                      style={{ opacity:0, transition:'opacity .15s', width:28, height:28, borderRadius:'50%', border:'none', background:'rgba(224,82,82,.12)', color:'#E05252', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}
                      title="מחק ליד">✕</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ICON SIDEBAR (far right, 52px) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ width:52, flexShrink:0, display:'flex', flexDirection:'column', background:WA.inputBg, borderRight:`1px solid ${WA.border}`, alignItems:'center', padding:'8px 0' }}>
          {/* Top nav icons */}
          {[
            { id:'bell',     path:ICONS.bell,     title:'התראות' },
            { id:'chats',    path:ICONS.chat,     title:'שיחות'  },
            { id:'contacts', path:ICONS.contacts, title:'אנשי קשר' },
            { id:'phone',    path:ICONS.phone,    title:'שיחות קול' },
          ].map(({ id, path, title }) => {
            const active = activeNav === id
            return (
              <button key={id} title={title} onClick={()=>setActiveNav(id)}
                style={{ width:44, height:44, borderRadius:10, border:'none', background:active?WA.green+'18':'transparent', color:active?WA.green:WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s', marginBottom:4 }}
                onMouseEnter={e=>{ if(!active){ e.currentTarget.style.background='rgba(0,0,0,.07)'; e.currentTarget.style.color=WA.bodyText } }}
                onMouseLeave={e=>{ e.currentTarget.style.background=active?WA.green+'18':'transparent'; e.currentTarget.style.color=active?WA.green:WA.subText }}>
                <Icon path={path} size={22}/>
              </button>
            )
          })}

          <div style={{ flex:1 }}/>

          {/* Bottom nav icons */}
          {[
            { id:'settings', path:ICONS.settings, title:'הגדרות' },
          ].map(({ id, path, title }) => (
            <button key={id} title={title} onClick={()=>setActiveNav(id)}
              style={{ width:44, height:44, borderRadius:10, border:'none', background:'transparent', color:WA.subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s', marginBottom:4 }}
              onMouseEnter={e=>{ e.currentTarget.style.background='rgba(0,0,0,.07)'; e.currentTarget.style.color=WA.bodyText }}
              onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color=WA.subText }}>
              <Icon path={path} size={22}/>
            </button>
          ))}
          {/* Avatar */}
          <div title="אפיק הנחל"
            style={{ width:36, height:36, borderRadius:'50%', background:WA.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'#fff', cursor:'pointer', marginBottom:4, userSelect:'none' }}>
            א
          </div>
        </div>

      </div>{/* end main layout */}
    </div>
  )
}
