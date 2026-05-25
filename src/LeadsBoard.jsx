import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  DndContext, closestCenter, useSensor, useSensors, PointerSensor,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Search, Filter, SortAsc, Eye, EyeOff, ChevronDown, ChevronRight,
  MoreHorizontal, User, Calendar, Phone, Mail, FileText, Link2, Zap,
  Settings, X, Check, GripVertical, Trash2, Copy, Download, Upload, Bell,
  Star, RefreshCw, Columns, Paintbrush, Layers, ArrowUpDown, ExternalLink,
  MessageSquare, Hash, Tag, ChevronLeft, ChevronUp,
} from 'lucide-react'

// ─── constants ────────────────────────────────────────────────────────────────

const GROUPS = [
  { id: 'new',         label: 'ליד חדש',   en: 'New Leads',      color: '#0073EA', icon: '🆕' },
  { id: 'contacted',   label: 'ניצור קשר', en: 'Contacted',      color: '#FDAB3D', icon: '📞' },
  { id: 'discovery',   label: 'גילוי',     en: 'Discovery',      color: '#A25DDC', icon: '🔍' },
  { id: 'negotiating', label: 'במו"מ',     en: 'In Negotiation', color: '#FF7575', icon: '🤝' },
  { id: 'won',         label: '✓ סגירה',   en: 'Closed Won',     color: '#00C875', icon: '🏆' },
  { id: 'lost',        label: 'ללא מענה',  en: 'Lost',           color: '#7D7D7D', icon: '😶' },
]

const SCORE_OPTS = [
  { v: 'hot',  l: '🔥 חם',   en: '🔥 Hot',  color: '#E2445C', bg: '#FEE8EC' },
  { v: 'warm', l: '☀️ ממוצע', en: '☀️ Warm', color: '#FDAB3D', bg: '#FFF5E6' },
  { v: 'cold', l: '❄️ קר',   en: '❄️ Cold', color: '#0073EA', bg: '#EAF4FF' },
]

const BUILT_IN_COLS = [
  { id: 'name',       label: 'שם ליד',       en: 'Lead Name',    type: 'text',   width: 220, pinned: true },
  { id: 'phone',      label: 'טלפון',        en: 'Phone',        type: 'phone',  width: 148 },
  { id: 'email',      label: 'אימייל',       en: 'Email',        type: 'email',  width: 200 },
  { id: 'leadStatus', label: 'סטטוס',        en: 'Status',       type: 'status', width: 140 },
  { id: 'property',   label: 'נכס',          en: 'Property',     type: 'text',   width: 170 },
  { id: 'intent',     label: 'ציון',         en: 'Score',        type: 'score',  width: 110 },
  { id: 'date',       label: 'תאריך',        en: 'Date',         type: 'date',   width: 110 },
  { id: 'msg',        label: 'הודעה',        en: 'Message',      type: 'notes',  width: 200 },
]

const COLUMN_TYPES = [
  { type: 'text',     icon: FileText,      label: 'Text',       desc: 'Free text entry' },
  { type: 'number',   icon: Hash,          label: 'Numbers',    desc: 'Numeric values' },
  { type: 'status',   icon: Tag,           label: 'Status',     desc: 'Color-coded status' },
  { type: 'date',     icon: Calendar,      label: 'Date',       desc: 'Date picker' },
  { type: 'phone',    icon: Phone,         label: 'Phone',      desc: 'Click to call' },
  { type: 'email',    icon: Mail,          label: 'Email',      desc: 'Click to mail' },
  { type: 'link',     icon: Link2,         label: 'Link',       desc: 'Clickable URL' },
  { type: 'score',    icon: Star,          label: 'Rating',     desc: 'Hot / warm / cold' },
  { type: 'notes',    icon: MessageSquare, label: 'Notes',      desc: 'Long text' },
]

const INTEGRATIONS = [
  { id: 'gmail',      name: 'Gmail',              logo: '📧', color: '#EA4335', desc: 'Import leads from email' },
  { id: 'whatsapp',   name: 'WhatsApp Business',  logo: '💬', color: '#25D366', desc: 'Send automated messages' },
  { id: 'slack',      name: 'Slack',              logo: '⚡', color: '#4A154B', desc: 'Status change notifications' },
  { id: 'calendar',   name: 'Google Calendar',    logo: '📅', color: '#4285F4', desc: 'Sync follow-up meetings' },
  { id: 'linkedin',   name: 'LinkedIn Sales Nav', logo: '🔗', color: '#0077B5', desc: 'Lead enrichment' },
  { id: 'hubspot',    name: 'HubSpot',            logo: '🧲', color: '#FF7A59', desc: 'Two-way CRM sync' },
  { id: 'zapier',     name: 'Zapier',             logo: '⚙️', color: '#FF4A00', desc: 'Custom automations' },
  { id: 'mailchimp',  name: 'Mailchimp',          logo: '🐒', color: '#FFE01B', desc: 'Email campaigns' },
]

const AUTOMATION_RECIPES = [
  { trigger: 'New lead added', action: 'Assign to me', icon: '👤' },
  { trigger: 'Status → Won', action: 'Notify team on Slack', icon: '🎉' },
  { trigger: 'Score = Hot', action: 'Move to Negotiation', icon: '🔥' },
  { trigger: 'Lead idle 3 days', action: 'Send follow-up message', icon: '⏰' },
  { trigger: 'Email received', action: 'Create lead from email', icon: '📧' },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

const getGroupColor = id => GROUPS.find(g => g.id === id)?.color || '#7D7D7D'
const getGroupLabel = (id, lang) => {
  const g = GROUPS.find(x => x.id === id)
  return g ? (lang === 'en' ? g.en : g.label) : id
}
const getScoreOpt = v => SCORE_OPTS.find(o => o.v === v)

const fmtDate = ts => {
  if (!ts) return ''
  const d = new Date(typeof ts === 'number' ? ts : ts)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const avatarColor = name => {
  const colors = ['#0073EA','#00C875','#FDAB3D','#E2445C','#A25DDC','#FF7575','#FF642E']
  return colors[(name?.charCodeAt(0) || 65) % colors.length]
}

// ─── responsive hook ──────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return isMobile
}

// ─── theme ────────────────────────────────────────────────────────────────────

const useTheme = isDark => useMemo(() => isDark ? {
  bg:          '#12142B',
  bgRow:       '#1A1D3A',
  bgRowHover:  '#222546',
  bgHeader:    '#0F1126',
  bgGroup:     '#161932',
  bgCard:      '#1E2140',
  bgCardHover: '#252850',
  bgInput:     '#222546',
  border:      '#2E3158',
  borderLight: '#262848',
  text:        '#E0E3F5',
  textSub:     '#9699C0',
  textDim:     '#4A4D6E',
  accent:      '#0073EA',
  accentHover: '#0060CC',
  green:       '#00C875',
  orange:      '#FDAB3D',
  purple:      '#A25DDC',
  red:         '#E2445C',
  shadow:      '0 8px 32px rgba(0,0,0,.6)',
  shadowSm:    '0 2px 12px rgba(0,0,0,.4)',
  shadowCard:  '0 2px 8px rgba(0,0,0,.35)',
} : {
  bg:          '#F0F2F8',
  bgRow:       '#FFFFFF',
  bgRowHover:  '#EEF2FF',
  bgHeader:    '#FFFFFF',
  bgGroup:     '#F5F7FD',
  bgCard:      '#FFFFFF',
  bgCardHover: '#F0F4FF',
  bgInput:     '#FFFFFF',
  border:      '#D0D6EE',
  borderLight: '#E4E8F5',
  text:        '#1C1F3B',
  textSub:     '#5C6080',
  textDim:     '#B0B4CC',
  accent:      '#0073EA',
  accentHover: '#0060CC',
  green:       '#00C875',
  orange:      '#FDAB3D',
  purple:      '#A25DDC',
  red:         '#E2445C',
  shadow:      '0 8px 32px rgba(30,32,80,.12)',
  shadowSm:    '0 2px 8px rgba(30,32,80,.08)',
  shadowCard:  '0 2px 8px rgba(30,32,80,.08)',
}, [isDark])

// ─── cell components ──────────────────────────────────────────────────────────

function StatusBadge({ value, lang, onClick, T }) {
  const g = GROUPS.find(x => x.id === value)
  const color = g?.color || '#7D7D7D'
  const label = g ? (lang === 'en' ? g.en : g.label) : (value || '—')
  return (
    <div onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
      background: color + '1A', borderRadius: 20, padding: '4px 10px',
      border: `1px solid ${color}44`, transition: 'all .15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = color + '30' }}
    onMouseLeave={e => { e.currentTarget.style.background = color + '1A' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 0 2px ${color}30` }}/>
      <span style={{ fontSize: 12, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )
}

function ScoreBadge({ value, lang }) {
  const opt = getScoreOpt(value)
  if (!opt) return <span style={{ color: '#9699A6', fontSize: 12 }}>—</span>
  const label = lang === 'en' ? opt.en : opt.l
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: opt.bg, borderRadius: 20, padding: '4px 10px',
      fontSize: 12, fontWeight: 700, color: opt.color,
      border: `1px solid ${opt.color}30`,
    }}>{label}</span>
  )
}

function PhoneCell({ value }) {
  if (!value) return <span style={{ color: '#9699A6', fontSize: 12 }}>—</span>
  return (
    <a href={`tel:${value}`} style={{ color: '#0073EA', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit', direction: 'ltr', display: 'inline-block', fontWeight: 600 }}
      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
      {value}
    </a>
  )
}

function EmailCell({ value }) {
  if (!value) return <span style={{ color: '#9699A6', fontSize: 12 }}>—</span>
  return (
    <a href={`mailto:${value}`} style={{ color: '#0073EA', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }}
      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
      {value}
    </a>
  )
}

function EditableCell({ value, onSave, T, multiline = false, type = 'text' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')
  const inputRef = useRef(null)

  useEffect(() => { if (editing) { setVal(value || ''); setTimeout(() => inputRef.current?.focus(), 20) } }, [editing, value])

  const save = () => { setEditing(false); if (val !== value) onSave(val) }
  const cancel = () => { setEditing(false); setVal(value || '') }

  if (!editing) {
    return (
      <div onClick={() => setEditing(true)} style={{ cursor: 'text', minHeight: 20, fontSize: 13, color: value ? T.text : T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '1px 0' }}>
        {value || <span style={{ opacity: .45, fontStyle: 'italic', fontSize: 12 }}>—</span>}
      </div>
    )
  }

  const style = {
    width: '100%', background: T.bgInput, border: `1.5px solid #0073EA`, borderRadius: 6,
    padding: '4px 8px', fontSize: 13, color: T.text, fontFamily: 'inherit', outline: 'none',
    resize: 'none', direction: 'rtl', boxShadow: '0 0 0 3px #0073EA18',
  }

  if (multiline) return (
    <textarea ref={inputRef} value={val} rows={3} style={{ ...style, height: 72 }}
      onChange={e => setVal(e.target.value)}
      onBlur={save} onKeyDown={e => { if (e.key === 'Escape') cancel() }} />
  )

  return (
    <input ref={inputRef} value={val} type={type} style={style}
      onChange={e => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }} />
  )
}

function EditablePhoneCell({ value, T, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')
  const inputRef = useRef(null)

  useEffect(() => { if (editing) { setVal(value || ''); setTimeout(() => inputRef.current?.focus(), 20) } }, [editing, value])

  const save = () => { setEditing(false); if (val !== value) onSave(val) }
  const cancel = () => { setEditing(false); setVal(value || '') }

  if (editing) return (
    <input ref={inputRef} value={val} type="tel"
      style={{ width: '100%', background: T.bgInput, border: '1.5px solid #0073EA', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: T.text, fontFamily: 'inherit', outline: 'none', direction: 'ltr', boxShadow: '0 0 0 3px #0073EA18' }}
      onChange={e => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }} />
  )

  return (
    <div onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 20, cursor: 'text', overflow: 'hidden' }}>
      {value
        ? <a href={`tel:${value}`} onClick={e => e.stopPropagation()} style={{ color: '#0073EA', fontSize: 12, textDecoration: 'none', fontWeight: 600, direction: 'ltr', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>{value}</a>
        : <span style={{ opacity: .45, fontStyle: 'italic', fontSize: 12, color: T.textDim }}>—</span>
      }
    </div>
  )
}

function EditableEmailCell({ value, T, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value || '')
  const inputRef = useRef(null)

  useEffect(() => { if (editing) { setVal(value || ''); setTimeout(() => inputRef.current?.focus(), 20) } }, [editing, value])

  const save = () => { setEditing(false); if (val !== value) onSave(val) }
  const cancel = () => { setEditing(false); setVal(value || '') }

  if (editing) return (
    <input ref={inputRef} value={val} type="email"
      style={{ width: '100%', background: T.bgInput, border: '1.5px solid #0073EA', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: T.text, fontFamily: 'inherit', outline: 'none', direction: 'ltr', boxShadow: '0 0 0 3px #0073EA18' }}
      onChange={e => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }} />
  )

  return (
    <div onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 20, cursor: 'text', overflow: 'hidden' }}>
      {value
        ? <a href={`mailto:${value}`} onClick={e => e.stopPropagation()} style={{ color: '#0073EA', fontSize: 12, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>{value}</a>
        : <span style={{ opacity: .45, fontStyle: 'italic', fontSize: 12, color: T.textDim }}>—</span>
      }
    </div>
  )
}

function ClickableScoreCell({ value, lang, T, onSave }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: 'pointer', display: 'inline-block' }}>
        {value ? <ScoreBadge value={value} lang={lang} /> : <span style={{ color: T.textDim, fontSize: 12, opacity: .45, fontStyle: 'italic' }}>—</span>}
      </div>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9000 }} />
          <div style={{ position: 'absolute', top: '110%', left: 0, background: T.bgHeader, border: `1px solid ${T.border}`, borderRadius: 10, padding: 6, boxShadow: T.shadow, zIndex: 9001, minWidth: 140 }}>
            {SCORE_OPTS.map(opt => (
              <button key={opt.v} onClick={() => { onSave(opt.v); setOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', borderRadius: 7, border: 'none', background: value === opt.v ? opt.bg : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = opt.bg }}
                onMouseLeave={e => { e.currentTarget.style.background = value === opt.v ? opt.bg : 'transparent' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: opt.color }}>{lang === 'en' ? opt.en : opt.l}</span>
                {value === opt.v && <Check size={12} style={{ color: opt.color, marginLeft: 'auto' }} />}
              </button>
            ))}
            <button onClick={() => { onSave(''); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bgRowHover }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
              <span style={{ fontSize: 12, color: T.textSub }}>{lang === 'en' ? '— None' : '— ללא'}</span>
              {!value && <Check size={12} style={{ color: T.textSub, marginLeft: 'auto' }} />}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── mobile lead card ─────────────────────────────────────────────────────────

function MobileLeadCard({ lead, lang, T, onUpdate, onDelete, onOpenDetail, onStatusClick, onOpenChat }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const color = getGroupColor(lead.leadStatus || 'new')
  const scoreOpt = getScoreOpt(lead.enrichment?.intent)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const fn = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    setTimeout(() => document.addEventListener('click', fn), 0)
    return () => document.removeEventListener('click', fn)
  }, [menuOpen])

  return (
    <div style={{
      background: T.bgCard,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 10,
      boxShadow: T.shadowCard,
      position: 'relative',
      transition: 'box-shadow .2s',
      borderRight: `4px solid ${color}`,
    }}>
      {/* Top row: avatar + name + menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: `linear-gradient(135deg, ${avatarColor(lead.name)}, ${avatarColor(lead.name)}AA)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, fontWeight: 800, color: '#fff', flexShrink: 0,
          boxShadow: `0 2px 8px ${avatarColor(lead.name)}44`,
        }}>
          {(lead.name || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.name || '—'}
          </div>
          <div style={{ marginTop: 4 }}>
            <StatusBadge value={lead.leadStatus || 'new'} lang={lang} T={T} onClick={e => { e.stopPropagation(); onStatusClick(e, lead) }} />
          </div>
        </div>
        {/* ⋯ menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            style={{ background: menuOpen ? T.border : 'none', border: 'none', cursor: 'pointer', color: T.textSub, padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center' }}>
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: lang === 'en' ? 0 : 'auto', right: lang === 'en' ? 'auto' : 0,
              background: T.bgHeader, border: `1px solid ${T.border}`, borderRadius: 10,
              boxShadow: T.shadow, zIndex: 100, minWidth: 160, overflow: 'hidden',
            }}>
              <button onClick={() => { onOpenDetail(lead); setMenuOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', color: T.text, fontSize: 13, fontFamily: 'inherit' }}>
                <ExternalLink size={14} style={{ color: T.textSub }} />
                {lang === 'en' ? 'Open detail' : 'פרטים מלאים'}
              </button>
              {lead.phone && onOpenChat && (
                <button onClick={() => { onOpenChat(lead); setMenuOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', color: '#25D366', fontSize: 13, fontFamily: 'inherit' }}>
                  <MessageSquare size={14} />
                  {lang === 'en' ? 'WhatsApp chat' : 'צ׳אט WhatsApp'}
                </button>
              )}
              <button onClick={() => { onDelete(lead.id); setMenuOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', color: '#E2445C', fontSize: 13, fontFamily: 'inherit' }}>
                <Trash2 size={14} />
                {lang === 'en' ? 'Delete' : 'מחק'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
        {lead.phone && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
              {lang === 'en' ? 'Phone' : 'טלפון'}
            </div>
            <a href={`tel:${lead.phone}`} style={{ fontSize: 14, color: T.accent, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, direction: 'ltr' }}
              onClick={e => e.stopPropagation()}>
              <Phone size={13} style={{ flexShrink: 0, color: T.accent }} />
              {lead.phone}
            </a>
          </div>
        )}
        {lead.propTitle && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
              {lang === 'en' ? 'Property' : 'נכס'}
            </div>
            <div style={{ fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lead.propTitle}
            </div>
          </div>
        )}
        {lead.enrichment?.intent && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
              {lang === 'en' ? 'Score' : 'ציון'}
            </div>
            <ScoreBadge value={lead.enrichment.intent} lang={lang} />
          </div>
        )}
        {lead.ts && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>
              {lang === 'en' ? 'Date' : 'תאריך'}
            </div>
            <div style={{ fontSize: 13, color: T.textSub }}>{fmtDate(lead.ts)}</div>
          </div>
        )}
      </div>

      {/* Message preview */}
      {lead.msg && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: T.bg, borderRadius: 8, border: `1px solid ${T.borderLight}` }}>
          <div style={{ fontSize: 12, color: T.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.5 }}>
            {lead.msg}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {lead.phone && (
          <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: T.accent + '14', border: `1px solid ${T.accent}30`, borderRadius: 10, color: T.accent, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <Phone size={14} /> {lang === 'en' ? 'Call' : 'התקשר'}
          </a>
        )}
        {lead.phone && onOpenChat && (
          <button onClick={e => { e.stopPropagation(); onOpenChat(lead) }}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: '#25D36614', border: '1px solid #25D36630', borderRadius: 10, color: '#25D366', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none' }}>
            <MessageSquare size={14} /> WhatsApp
          </button>
        )}
        <button onClick={() => onOpenDetail(lead)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: 'none', border: `1px solid ${T.border}`, borderRadius: 10, color: T.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <ExternalLink size={14} /> {lang === 'en' ? 'Details' : 'פרטים'}
        </button>
      </div>
    </div>
  )
}

// ─── mobile group section ─────────────────────────────────────────────────────

function MobileGroupSection({ group, leads, lang, T, onUpdate, onDelete, onOpenDetail, onStatusClick, onOpenChat, onAddRow }) {
  const [collapsed, setCollapsed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef(null)
  const color = group.color
  const label = lang === 'en' ? group.en : group.label

  const addRow = () => {
    if (!newName.trim()) { setAdding(false); return }
    onAddRow(group.id, newName.trim())
    setNewName(''); setAdding(false)
  }

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Group header */}
      <button onClick={() => setCollapsed(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: color + '12',
          border: `1px solid ${color}30`, borderRadius: collapsed ? 14 : '14px 14px 0 0',
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
        }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{group.icon}</span>
        <span style={{ fontSize: 14, fontWeight: 800, color, flex: 1, textAlign: 'right' }}>{label}</span>
        <span style={{ fontSize: 12, background: color + '25', color, borderRadius: 20, padding: '3px 10px', fontWeight: 800, minWidth: 26, textAlign: 'center' }}>
          {leads.length}
        </span>
        {collapsed ? <ChevronDown size={16} style={{ color, flexShrink: 0 }} /> : <ChevronUp size={16} style={{ color, flexShrink: 0 }} />}
      </button>

      {!collapsed && (
        <div style={{ border: `1px solid ${color}30`, borderTop: 'none', borderRadius: '0 0 14px 14px', padding: '10px 10px 4px', background: T.bgGroup }}>
          {leads.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: T.textSub, fontSize: 13 }}>
              {lang === 'en' ? 'No leads in this group' : 'אין לידים בקבוצה זו'}
            </div>
          )}
          {leads.map(lead => (
            <MobileLeadCard key={lead.id} lead={lead} lang={lang} T={T}
              onUpdate={onUpdate} onDelete={onDelete}
              onOpenDetail={onOpenDetail} onStatusClick={onStatusClick} onOpenChat={onOpenChat} />
          ))}

          {/* Add row */}
          {adding ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input autoFocus ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addRow(); if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
                onBlur={addRow}
                placeholder={lang === 'en' ? 'Lead name...' : 'שם הליד...'}
                style={{ flex: 1, background: T.bgInput, border: `1.5px solid ${color}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: T.text, fontFamily: 'inherit', outline: 'none', direction: 'rtl', boxShadow: `0 0 0 3px ${color}18` }} />
              <button onClick={addRow}
                style={{ padding: '10px 16px', background: color, border: 'none', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                {lang === 'en' ? 'Add' : 'הוסף'}
              </button>
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 30) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 14px', background: 'none', border: `1px dashed ${color}44`, borderRadius: 10, cursor: 'pointer', color: T.textSub, fontSize: 13, fontFamily: 'inherit', marginBottom: 8, justifyContent: 'center' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = color}
              onMouseLeave={e => e.currentTarget.style.borderColor = color + '44'}>
              <Plus size={14} style={{ color }} />
              <span>{lang === 'en' ? `Add to ${label}` : `הוסף ל${label}`}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── desktop sortable row ─────────────────────────────────────────────────────

function SortableRow({ lead, cols, onUpdate, onDelete, onSelect, isSelected, lang, T, onOpenDetail, onStatusClick, onOpenChat, onEnrich }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const [hovered, setHovered] = useState(false)
  const [checked, setChecked] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    display: 'flex', alignItems: 'stretch',
    borderBottom: `1px solid ${T.borderLight}`,
    background: isSelected ? '#0073EA0D' : hovered ? T.bgRowHover : T.bgRow,
    transition: `background .1s${transition ? ', ' + transition : ''}`,
    cursor: isDragging ? 'grabbing' : 'default',
    minHeight: 46,
    position: 'relative',
  }

  const getCellValue = (col) => {
    switch (col.id) {
      case 'name':       return lead.name || ''
      case 'phone':      return lead.phone || ''
      case 'email':      return lead.email || ''
      case 'leadStatus': return lead.leadStatus || 'new'
      case 'property':   return lead.propTitle || ''
      case 'intent':     return lead.enrichment?.intent || ''
      case 'date':       return fmtDate(lead.ts)
      case 'msg':        return lead.msg || ''
      default:           return lead[col.id] || lead.customData?.[col.id] || ''
    }
  }

  const handleUpdate = (col, val) => {
    if (col.id === 'name') onUpdate(lead.id, { name: val })
    else if (col.id === 'property') onUpdate(lead.id, { propTitle: val })
    else if (col.id === 'msg') onUpdate(lead.id, { msg: val })
    else onUpdate(lead.id, { [col.id]: val })
  }

  const renderCell = (col) => {
    const val = getCellValue(col)
    const cellStyle = {
      width: col.width, flexShrink: 0, flexGrow: 0,
      padding: '6px 10px', borderRight: `1px solid ${T.borderLight}`,
      display: 'flex', alignItems: 'center', overflow: 'hidden',
      fontSize: 13, color: T.text,
      ...(col.pinned ? { position: 'sticky', left: 32, zIndex: 2, background: hovered ? T.bgRowHover : T.bgRow } : {}),
    }

    switch (col.type) {
      case 'status':
        return (
          <div key={col.id} style={cellStyle}>
            <StatusBadge value={val} lang={lang} T={T} onClick={e => onStatusClick(e, lead)} />
          </div>
        )
      case 'score':
        return <div key={col.id} style={cellStyle}><ClickableScoreCell value={val} lang={lang} T={T} onSave={v => onUpdate(lead.id, { enrichment: { ...(lead.enrichment || {}), intent: v } })} /></div>
      case 'phone':
        return <div key={col.id} style={cellStyle}><EditablePhoneCell value={val} T={T} onSave={v => handleUpdate(col, v)} /></div>
      case 'email':
        return <div key={col.id} style={cellStyle}><EditableEmailCell value={val} T={T} onSave={v => handleUpdate(col, v)} /></div>
      case 'date':
        return <div key={col.id} style={cellStyle}><span style={{ fontSize: 12, color: T.textSub }}>{val || '—'}</span></div>
      case 'notes':
        return (
          <div key={col.id} style={{ ...cellStyle }}>
            <EditableCell value={val} T={T} multiline onSave={v => handleUpdate(col, v)} />
          </div>
        )
      case 'text':
      default:
        return (
          <div key={col.id} style={{ ...cellStyle, ...(col.id === 'name' ? { fontWeight: 600 } : {}) }}>
            <EditableCell value={val} T={T} onSave={v => handleUpdate(col, v)} />
          </div>
        )
    }
  }

  return (
    <div ref={setNodeRef} style={style}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Drag handle + checkbox */}
      <div style={{ width: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, borderRight: `1px solid ${T.borderLight}`, position: 'sticky', left: 0, zIndex: 3, background: hovered ? T.bgRowHover : T.bgRow, transition: 'background .1s' }}>
        {hovered ? (
          <div {...listeners} {...attributes} style={{ cursor: 'grab', color: T.textDim, display: 'flex', alignItems: 'center' }}>
            <GripVertical size={14} />
          </div>
        ) : (
          <input type="checkbox" checked={checked} onChange={e => { setChecked(e.target.checked); onSelect(lead.id, e.target.checked) }}
            style={{ cursor: 'pointer', accentColor: '#0073EA', width: 14, height: 14 }} />
        )}
      </div>

      {cols.map(col => renderCell(col))}

      {hovered && (
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4, background: T.bgRow, borderRadius: 8, padding: '2px 4px', boxShadow: T.shadowSm, zIndex: 10, border: `1px solid ${T.borderLight}` }}>
          {onEnrich && (
            lead.enrichment?.status === 'enriching'
              ? <button style={{ background: 'none', border: 'none', color: '#A25DDC', cursor: 'default', padding: '5px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }} title="AI מעבד...">
                  <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                </button>
              : <button onClick={() => onEnrich(lead)} title="AI Enrichment"
                  style={{ background: 'none', border: 'none', color: '#A25DDC', cursor: 'pointer', padding: '5px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#A25DDC18'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  ✦
                </button>
          )}
          {lead.phone && onOpenChat && (
            <button onClick={() => onOpenChat(lead)} title="WhatsApp"
              style={{ background: 'none', border: 'none', color: '#25D366', cursor: 'pointer', padding: '5px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = '#25D36618'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <MessageSquare size={13} />
            </button>
          )}
          <button onClick={() => onOpenDetail(lead)}
            style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', padding: '5px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = T.bgRowHover}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <ExternalLink size={13} />
          </button>
          <button onClick={() => onDelete(lead.id)}
            style={{ background: 'none', border: 'none', color: '#E2445C', cursor: 'pointer', padding: '5px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = '#E2445C18'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── desktop board group ──────────────────────────────────────────────────────

function BoardGroup({ group, leads, cols, onUpdate, onUpdateStatus, onDelete, onSelect, lang, T, onOpenDetail, onAddRow, onStatusClick, onOpenChat, onEnrich }) {
  const [collapsed, setCollapsed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const inputRef = useRef(null)
  const color = group.color
  const label = lang === 'en' ? group.en : group.label

  const addRow = () => {
    if (!newName.trim()) { setAdding(false); return }
    onAddRow(group.id, newName.trim())
    setNewName(''); setAdding(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px 6px 0', borderBottom: `1px solid ${T.borderLight}`, userSelect: 'none', background: T.bgGroup, position: 'sticky', top: 36, zIndex: 4 }}>
        <div style={{ width: 4, alignSelf: 'stretch', background: color, borderRadius: '0 3px 3px 0', marginRight: 8, flexShrink: 0 }} />
        <button onClick={() => setCollapsed(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color, display: 'flex', alignItems: 'center', padding: '0 6px 0 0' }}>
          <ChevronDown size={15} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 800, color, marginRight: 6 }}>{label}</span>
        <span style={{ fontSize: 11, background: color + '20', color, borderRadius: 20, padding: '2px 8px', fontWeight: 700, marginRight: 8 }}>{leads.length}</span>
        <div style={{ flex: 1 }} />
      </div>

      {!collapsed && (
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <SortableRow key={lead.id} lead={lead} cols={cols} T={T} lang={lang}
              onUpdate={onUpdate} onDelete={onDelete} onSelect={onSelect}
              onOpenDetail={onOpenDetail} onStatusClick={onStatusClick} onOpenChat={onOpenChat} onEnrich={onEnrich} />
          ))}
        </SortableContext>
      )}

      {!collapsed && (
        <div style={{ borderBottom: `1px solid ${T.borderLight}`, background: T.bgRow }}>
          {adding ? (
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px 6px 42px', gap: 8 }}>
              <input autoFocus ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addRow(); if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
                onBlur={addRow}
                placeholder={lang === 'en' ? 'New lead name...' : 'שם הליד החדש...'}
                style={{ flex: 1, maxWidth: 280, background: T.bgInput, border: `1.5px solid #0073EA`, borderRadius: 6, padding: '5px 8px', fontSize: 13, color: T.text, fontFamily: 'inherit', outline: 'none', direction: 'rtl', boxShadow: '0 0 0 3px #0073EA18' }} />
              <button onClick={addRow} style={{ background: '#0073EA', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {lang === 'en' ? 'Add' : 'הוסף'}
              </button>
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 30) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px 7px 42px', background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, fontSize: 12, fontFamily: 'inherit', width: '100%', textAlign: 'right' }}
              onMouseEnter={e => e.currentTarget.style.background = T.bgRowHover}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <Plus size={13} style={{ color }} />
              <span>{lang === 'en' ? `Add ${label}` : `הוסף ${label}`}</span>
            </button>
          )}
        </div>
      )}

      {!collapsed && leads.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px 4px 0', borderBottom: `2px solid ${T.border}`, background: T.bgGroup }}>
          <div style={{ width: 36, flexShrink: 0 }} />
          {cols.map(col => (
            <div key={col.id} style={{ width: col.width, flexShrink: 0, padding: '4px 10px', fontSize: 11, color: T.textSub, borderRight: `1px solid ${T.borderLight}` }}>
              {col.id === 'name' ? <span style={{ fontWeight: 700, color: T.textSub }}>{leads.length} {lang === 'en' ? 'items' : 'פריטים'}</span> : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── item detail drawer ───────────────────────────────────────────────────────

function ItemDetailDrawer({ lead, onClose, onUpdate, onUpdateStatus, lang, T, isDark, isMobile, onEnrich }) {
  if (!lead) return null
  const color = getGroupColor(lead.leadStatus || 'new')

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 800, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed',
        top: isMobile ? 0 : 0,
        right: 0, bottom: 0,
        width: isMobile ? '100%' : 480,
        background: T.bgHeader,
        boxShadow: '-4px 0 40px rgba(0,0,0,.3)',
        zIndex: 801, display: 'flex', flexDirection: 'column', direction: 'rtl',
        borderRadius: isMobile ? 0 : '0',
      }}>
        {/* Color accent top bar */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${color}, ${color}AA)` }} />

        {/* Header */}
        <div style={{ padding: isMobile ? '16px 20px 14px' : '18px 22px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg, ${avatarColor(lead.name)}, ${avatarColor(lead.name)}BB)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: `0 3px 12px ${avatarColor(lead.name)}44` }}>
            {(lead.name || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name || '—'}</div>
            <div style={{ marginTop: 5 }}>
              <StatusBadge value={lead.leadStatus || 'new'} lang={lang} T={T} onClick={() => {}} />
            </div>
          </div>
          <button onClick={onClose} style={{ background: T.bgRowHover, border: 'none', cursor: 'pointer', color: T.textSub, padding: 8, display: 'flex', alignItems: 'center', borderRadius: 8 }}>
            <X size={18} />
          </button>
        </div>

        {/* Quick actions */}
        {lead.phone && (
          <div style={{ display: 'flex', gap: 8, padding: '12px 22px', borderBottom: `1px solid ${T.border}` }}>
            <a href={`tel:${lead.phone}`}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', background: T.accent + '14', border: `1px solid ${T.accent}30`, borderRadius: 10, color: T.accent, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
              <Phone size={15} /> {lang === 'en' ? 'Call' : 'התקשר'}
            </a>
            {lead.email && (
              <a href={`mailto:${lead.email}`}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', background: '#E2445C14', border: '1px solid #E2445C30', borderRadius: 10, color: '#E2445C', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                <Mail size={15} /> {lang === 'en' ? 'Email' : 'מייל'}
              </a>
            )}
          </div>
        )}

        {/* Fields */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'טלפון', en: 'Phone', key: 'phone', type: 'phone' },
            { label: 'אימייל', en: 'Email', key: 'email', type: 'email' },
            { label: 'נכס', en: 'Property', key: 'propTitle', type: 'text' },
            { label: 'הודעה', en: 'Message', key: 'msg', type: 'notes' },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                {f.type === 'phone' && <Phone size={10} style={{ color: T.textSub }} />}
                {f.type === 'email' && <Mail size={10} style={{ color: T.textSub }} />}
                {f.type === 'text' && <FileText size={10} style={{ color: T.textSub }} />}
                {f.type === 'notes' && <MessageSquare size={10} style={{ color: T.textSub }} />}
                {lang === 'en' ? f.en : f.label}
              </div>
              <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '9px 12px' }}>
                {f.type === 'phone' ? (
                  <EditablePhoneCell value={lead[f.key]} T={T} onSave={v => onUpdate(lead.id, { [f.key]: v })} />
                ) : f.type === 'email' ? (
                  <EditableEmailCell value={lead[f.key]} T={T} onSave={v => onUpdate(lead.id, { [f.key]: v })} />
                ) : f.type === 'notes' ? (
                  <EditableCell value={lead[f.key]} T={T} multiline onSave={v => onUpdate(lead.id, { [f.key]: v })} />
                ) : (
                  <EditableCell value={lead[f.key]} T={T} onSave={v => onUpdate(lead.id, { [f.key]: v })} />
                )}
              </div>
            </div>
          ))}

          {/* AI Enrichment section */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#A25DDC' }}>✦</span> AI Enrichment
              {onEnrich && (
                lead.enrichment?.status === 'enriching'
                  ? <span style={{ marginLeft: 'auto', fontSize: 11, color: '#A25DDC', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> מעבד...
                    </span>
                  : <button onClick={() => onEnrich(lead)} style={{ marginLeft: 'auto', background: '#A25DDC14', border: '1px solid #A25DDC44', borderRadius: 6, color: '#A25DDC', fontSize: 11, fontWeight: 700, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✦ {lead.enrichment ? (lang === 'en' ? 'Re-enrich' : 'רענן AI') : (lang === 'en' ? 'Enrich' : 'נתח AI')}
                    </button>
              )}
            </div>
            {lead.enrichment && lead.enrichment.status !== 'enriching' ? (
              <div style={{ background: T.bg, border: `1px solid #A25DDC33`, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lead.enrichment.notes && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#A25DDC', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{lang === 'en' ? 'Pre-Call Brief' : 'תדריך לשיחה'}</div>
                    <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6 }}>{lead.enrichment.notes}</div>
                  </div>
                )}
                {[
                  { label: lang === 'en' ? 'Score' : 'ציון', value: lead.enrichment.score ? `${lead.enrichment.score}/5${lead.enrichment.scoreReason ? ' — ' + lead.enrichment.scoreReason : ''}` : null },
                  { label: lang === 'en' ? 'Intent' : 'כוונה', value: lead.enrichment.intent },
                  { label: lang === 'en' ? 'Est. Age' : 'גיל משוער', value: lead.enrichment.estimatedAge },
                  { label: lang === 'en' ? 'City' : 'עיר', value: lead.enrichment.estimatedCity },
                  { label: lang === 'en' ? 'Budget' : 'תקציב', value: lead.enrichment.estimatedBudget },
                  { label: lang === 'en' ? 'Profession' : 'מקצוע', value: lead.enrichment.profession },
                  { label: lang === 'en' ? 'Company' : 'חברה', value: lead.enrichment.company },
                  { label: lang === 'en' ? 'Role' : 'תפקיד', value: lead.enrichment.role },
                  { label: lang === 'en' ? 'Education' : 'השכלה', value: lead.enrichment.education },
                ].filter(x => x.value).map(x => (
                  <div key={x.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, color: T.textSub, width: 76, flexShrink: 0, paddingTop: 1 }}>{x.label}</span>
                    <span style={{ fontSize: 13, color: T.text, fontWeight: 600, flex: 1 }}>{x.value}</span>
                  </div>
                ))}
                {lead.enrichment.talkingPoints?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#A25DDC', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{lang === 'en' ? 'Talking Points' : 'נקודות שיחה'}</div>
                    {lead.enrichment.talkingPoints.map((pt, i) => (
                      <div key={i} style={{ fontSize: 12, color: T.text, padding: '3px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span style={{ color: '#A25DDC', flexShrink: 0 }}>•</span>{pt}
                      </div>
                    ))}
                  </div>
                )}
                {(lead.enrichment.linkedin || lead.enrichment.facebook || lead.enrichment.google) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                    {lead.enrichment.linkedin && <a href={lead.enrichment.linkedin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#0077B5', textDecoration: 'none', background: '#0077B514', padding: '3px 8px', borderRadius: 6 }}>LinkedIn</a>}
                    {lead.enrichment.facebook && <a href={lead.enrichment.facebook} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#1877F2', textDecoration: 'none', background: '#1877F214', padding: '3px 8px', borderRadius: 6 }}>Facebook</a>}
                    {lead.enrichment.google && <a href={lead.enrichment.google} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: T.textSub, textDecoration: 'none', background: T.bgRowHover, padding: '3px 8px', borderRadius: 6 }}>Google</a>}
                  </div>
                )}
                {lead.enrichment.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {lead.enrichment.tags.map(tag => (
                      <span key={tag} style={{ fontSize: 11, background: '#A25DDC14', color: '#A25DDC', borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : !lead.enrichment && (
              <div style={{ background: T.bg, border: `1px dashed ${T.border}`, borderRadius: 10, padding: '16px 14px', textAlign: 'center', color: T.textSub, fontSize: 13 }}>
                {lang === 'en' ? 'Click "Enrich" to analyze this lead with AI' : 'לחץ "נתח AI" לניתוח הליד'}
              </div>
            )}
          </div>

          <div style={{ fontSize: 12, color: T.textDim, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Calendar size={11} />
            {lang === 'en' ? 'Created' : 'נוצר'}: {fmtDate(lead.ts)}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── status popup ─────────────────────────────────────────────────────────────

function StatusPopup({ lead, onClose, onUpdate, lang, T }) {
  if (!lead) return null
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        background: T.bgHeader, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: 8, boxShadow: T.shadow, zIndex: 9001, minWidth: 200, direction: 'rtl',
        overflow: 'hidden',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.06em', padding: '6px 10px 10px' }}>
          {lang === 'en' ? 'Change Status' : 'שנה סטטוס'}
        </div>
        {GROUPS.map(g => {
          const isActive = (lead.leadStatus || 'new') === g.id
          return (
            <button key={g.id} onClick={() => { onUpdate(lead, g.id); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none', background: isActive ? g.color + '1A' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = g.color + '12' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0, boxShadow: isActive ? `0 0 0 3px ${g.color}35` : 'none' }} />
              <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? g.color : T.text, flex: 1 }}>
                {lang === 'en' ? g.en : g.label}
              </span>
              {isActive && <Check size={13} style={{ color: g.color }} />}
            </button>
          )
        })}
      </div>
    </>
  )
}

// ─── integrations modal ───────────────────────────────────────────────────────

function IntegrationsModal({ onClose, T, lang }) {
  const [search, setSearch] = useState('')
  const [connected, setConnected] = useState({})
  const filtered = INTEGRATIONS.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 900 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(680px,94vw)', maxHeight: '85vh', background: T.bgHeader, borderRadius: 16, boxShadow: T.shadow, zIndex: 901, display: 'flex', flexDirection: 'column', direction: lang === 'en' ? 'ltr' : 'rtl', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={18} style={{ color: '#0073EA' }} />
              {lang === 'en' ? 'Integrations' : 'אינטגרציות'}
            </div>
            <div style={{ fontSize: 13, color: T.textSub, marginTop: 4 }}>
              {lang === 'en' ? 'Connect your tools to automate your workflow' : 'חבר כלים לאוטומטיזציה של זרימת העבודה'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: T.bgRowHover, border: 'none', cursor: 'pointer', color: T.textSub, padding: 8, display: 'flex', alignItems: 'center', borderRadius: 8 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 10, padding: '9px 14px' }}>
            <Search size={14} style={{ color: T.textSub, flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'en' ? 'Search integrations...' : 'חפש אינטגרציות...'}
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: T.text, fontFamily: 'inherit', flex: 1 }} />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
          {filtered.map(intg => {
            const isConn = connected[intg.id]
            return (
              <div key={intg.id} style={{ background: T.bg, border: `1px solid ${isConn ? intg.color + '44' : T.border}`, borderRadius: 12, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'all .2s', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = T.shadowSm; e.currentTarget.style.borderColor = intg.color + '66' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = isConn ? intg.color + '44' : T.border }}>
                <div style={{ fontSize: 28 }}>{intg.logo}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{intg.name}</div>
                <div style={{ fontSize: 11, color: T.textSub, flex: 1, lineHeight: 1.6 }}>{intg.desc}</div>
                <button onClick={() => setConnected(prev => ({ ...prev, [intg.id]: !prev[intg.id] }))}
                  style={{ padding: '7px 12px', borderRadius: 8, border: isConn ? `1.5px solid ${T.green}` : `1.5px solid ${T.accent}`, background: isConn ? T.green + '14' : T.accent, color: isConn ? T.green : '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {isConn ? (lang === 'en' ? '✓ Connected' : '✓ מחובר') : (lang === 'en' ? 'Connect' : 'חבר')}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── automations modal ────────────────────────────────────────────────────────

function AutomationsModal({ onClose, T, lang }) {
  const [active, setActive] = useState({})
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 900 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(580px,94vw)', background: T.bgHeader, borderRadius: 16, boxShadow: T.shadow, zIndex: 901, direction: lang === 'en' ? 'ltr' : 'rtl', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={18} style={{ color: '#FDAB3D' }} />
              {lang === 'en' ? 'Automations' : 'אוטומציות'}
            </div>
            <div style={{ fontSize: 13, color: T.textSub, marginTop: 4 }}>{lang === 'en' ? 'When something happens → do this' : 'כש... → אז...'}</div>
          </div>
          <button onClick={onClose} style={{ background: T.bgRowHover, border: 'none', cursor: 'pointer', color: T.textSub, padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
          {AUTOMATION_RECIPES.map((r, i) => {
            const isOn = active[i]
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: T.bg, borderRadius: 12, border: `1px solid ${isOn ? T.green + '40' : T.border}`, transition: 'border-color .2s' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: T.textSub, marginBottom: 2 }}>{lang === 'en' ? 'When' : 'כש-'}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{r.trigger}</div>
                  <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>{lang === 'en' ? '→ Then' : '→ אז'}: <span style={{ color: T.accent, fontWeight: 700 }}>{r.action}</span></div>
                </div>
                <button onClick={() => setActive(prev => ({ ...prev, [i]: !prev[i] }))}
                  style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: isOn ? T.green : T.border, cursor: 'pointer', transition: 'background .2s', position: 'relative', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: isOn ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.25)' }} />
                </button>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.border}` }}>
          <button style={{ width: '100%', padding: '11px 0', background: T.accent, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Plus size={15} /> {lang === 'en' ? 'Create Custom Automation' : 'צור אוטומציה מותאמת'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── add column modal ─────────────────────────────────────────────────────────

function AddColumnModal({ onClose, onAdd, T, lang }) {
  const [selected, setSelected] = useState(null)
  const [name, setName] = useState('')

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 900 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(520px,94vw)', background: T.bgHeader, borderRadius: 16, boxShadow: T.shadow, zIndex: 901, direction: lang === 'en' ? 'ltr' : 'rtl', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 800, color: T.text }}>{lang === 'en' ? 'Add Column' : 'הוסף עמודה'}</div>
          <button onClick={onClose} style={{ background: T.bgRowHover, border: 'none', cursor: 'pointer', color: T.textSub, display: 'flex', alignItems: 'center', padding: 8, borderRadius: 8 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {COLUMN_TYPES.map(ct => {
            const Icon = ct.icon
            const isSel = selected?.type === ct.type
            return (
              <button key={ct.type} onClick={() => setSelected(ct)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '14px', borderRadius: 10, border: `1.5px solid ${isSel ? '#0073EA' : T.border}`, background: isSel ? '#0073EA0A' : T.bg, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor = '#0073EA66' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = T.border }}>
                <Icon size={18} style={{ color: isSel ? '#0073EA' : T.textSub }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{ct.label}</div>
                <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.4 }}>{ct.desc}</div>
              </button>
            )
          })}
        </div>
        {selected && (
          <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'en' ? 'Column name...' : 'שם העמודה...'}
              style={{ flex: 1, background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, color: T.text, fontFamily: 'inherit', outline: 'none', direction: lang === 'en' ? 'ltr' : 'rtl' }} autoFocus />
            <button onClick={() => { onAdd({ id: 'custom_' + Date.now(), label: name || selected.label, type: selected.type, width: 150 }); onClose() }}
              style={{ padding: '10px 18px', background: '#0073EA', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {lang === 'en' ? 'Add' : 'הוסף'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── bulk action bar ──────────────────────────────────────────────────────────

function BulkActionBar({ count, onClearSelection, onDelete, lang, T }) {
  if (count === 0) return null
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#0073EA', borderRadius: 14, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 32px rgba(0,115,234,.5)', zIndex: 500, direction: lang === 'en' ? 'ltr' : 'rtl', whiteSpace: 'nowrap' }}>
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{count} {lang === 'en' ? 'selected' : 'נבחרו'}</span>
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.3)' }} />
      <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
        <Trash2 size={14} /> {lang === 'en' ? 'Delete' : 'מחק'}
      </button>
      <button onClick={onClearSelection} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', padding: '5px 12px', fontSize: 12, fontFamily: 'inherit' }}>
        {lang === 'en' ? 'Clear' : 'בטל'}
      </button>
    </div>
  )
}

// ─── toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3200); return () => clearTimeout(t) }, [onDismiss])
  return (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1C1F3B', color: '#fff', padding: '11px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 6px 24px rgba(0,0,0,.4)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap' }}>
      <Check size={14} style={{ color: '#00C875' }} />
      {message}
    </div>
  )
}

// ─── stats bar (mobile) ───────────────────────────────────────────────────────

function MobileStatsBar({ leads, T, lang }) {
  const hot  = leads.filter(l => l.enrichment?.intent === 'hot').length
  const won  = leads.filter(l => l.leadStatus === 'won').length
  const newL = leads.filter(l => l.leadStatus === 'new').length
  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto' }}>
      {[
        { label: lang === 'en' ? 'Total' : 'סה"כ', value: leads.length, color: T.accent, bg: T.accent + '14' },
        { label: lang === 'en' ? 'New' : 'חדשים', value: newL, color: '#0073EA', bg: '#0073EA14' },
        { label: lang === 'en' ? 'Hot' : 'חמים', value: hot, color: '#E2445C', bg: '#E2445C14' },
        { label: lang === 'en' ? 'Won' : 'סגורים', value: won, color: '#00C875', bg: '#00C87514' },
      ].map(s => (
        <div key={s.label} style={{ flexShrink: 0, background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 12, padding: '10px 16px', textAlign: 'center', minWidth: 72 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── main board ───────────────────────────────────────────────────────────────

export default function LeadsBoard({
  leads, updateLead, updateLeadStatus, deleteLead, addLead,
  colOrder, setColOrder, customCols, setCustomCols, colWidths, setColWidths,
  exportCSV, syncLeads, enrichAll, enrichLead, clearLeads, leadsSyncing,
  isDark, lang, onOpenChat,
}) {
  const T = useTheme(isDark)
  const isMobile = useIsMobile()

  const [search, setSearch]           = useState('')
  const [hiddenCols, setHiddenCols]   = useState({})
  const [extraCols, setExtraCols]     = useState(customCols || [])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [detailLead, setDetailLead]   = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  const [modal, setModal]             = useState(null)
  const [activeTab, setActiveTab]     = useState('leads')
  const [toast, setToast]             = useState(null)
  const [activeDragId, setActiveDragId] = useState(null)
  const [mobileSearch, setMobileSearch] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const allCols = useMemo(() => {
    const builtIn = BUILT_IN_COLS.filter(c => !hiddenCols[c.id])
    const extra = extraCols.filter(c => !hiddenCols[c.id])
    return [...builtIn, ...extra]
  }, [hiddenCols, extraCols])

  // Total table width: checkbox(32) + all column widths + add-col btn(120)
  const tableMinWidth = useMemo(
    () => allCols.reduce((s, c) => s + (c.width || 140), 0) + 32 + 120,
    [allCols]
  )

  const filtered = useMemo(() => {
    if (!search) return leads
    const q = search.toLowerCase()
    return leads.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.propTitle || '').toLowerCase().includes(q)
    )
  }, [leads, search])

  const grouped = useMemo(() => {
    const map = {}
    GROUPS.forEach(g => { map[g.id] = [] })
    filtered.forEach(l => {
      const s = l.leadStatus || 'new'
      if (!map[s]) map[s] = []
      map[s].push(l)
    })
    return map
  }, [filtered])

  const findGroupForLead = useCallback(id => {
    for (const g of GROUPS) {
      if ((grouped[g.id] || []).find(l => l.id === id)) return g.id
    }
    return null
  }, [grouped])

  const handleDragStart = ({ active }) => setActiveDragId(active.id)
  const handleDragEnd = ({ active, over }) => {
    setActiveDragId(null)
    if (!over) return
    const fromGroup = findGroupForLead(active.id)
    const toGroup = GROUPS.find(g => g.id === over.id)?.id || findGroupForLead(over.id)
    if (!fromGroup || !toGroup) return
    if (fromGroup !== toGroup) {
      const lead = leads.find(l => l.id === active.id)
      if (lead) {
        updateLeadStatus(lead, toGroup)
        showToast(lang === 'en' ? `Moved to ${getGroupLabel(toGroup, lang)}` : `הועבר ל${getGroupLabel(toGroup, lang)}`)
      }
    }
  }

  const showToast = msg => setToast(msg)

  const handleAddRow = (groupId, name) => {
    const lead = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, phone: '', email: '', msg: '', propTitle: '', ts: Date.now(), leadStatus: groupId }
    addLead(lead)
    showToast(lang === 'en' ? 'Lead added' : 'ליד נוסף')
  }

  const handleDelete = id => {
    deleteLead(id)
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
    showToast(lang === 'en' ? 'Lead deleted' : 'ליד נמחק')
  }

  const handleBulkDelete = () => {
    if (!window.confirm(`${lang === 'en' ? 'Delete' : 'מחוק'} ${selectedIds.size} ${lang === 'en' ? 'leads?' : 'לידים?'}`)) return
    selectedIds.forEach(id => deleteLead(id))
    setSelectedIds(new Set())
    showToast(lang === 'en' ? 'Leads deleted' : 'לידים נמחקו')
  }

  const handleSelect = (id, checked) => setSelectedIds(prev => { const s = new Set(prev); checked ? s.add(id) : s.delete(id); return s })
  const handleAddCol = col => { const next = [...extraCols, col]; setExtraCols(next); if (setCustomCols) setCustomCols(next); showToast(lang === 'en' ? 'Column added' : 'עמודה נוספה') }
  const toggleColVisibility = id => setHiddenCols(prev => ({ ...prev, [id]: !prev[id] }))
  const hiddenCount = Object.values(hiddenCols).filter(Boolean).length

  // ────────────────────────────────────────────────────────────────────────────
  // MOBILE LAYOUT
  // ────────────────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: "Rubik,'Inter','Segoe UI',system-ui,sans-serif", direction: lang === 'en' ? 'ltr' : 'rtl', overflow: 'hidden' }}>

        {/* ── Mobile Header ── */}
        <div style={{ padding: '14px 16px 10px', background: T.bgHeader, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#A25DDC,#0073EA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #0073EA44' }}>
              <User size={16} style={{ color: '#fff' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, lineHeight: 1 }}>
                {lang === 'en' ? 'Leads CRM' : 'ניהול לידים'}
              </div>
              <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>
                {leads.length} {lang === 'en' ? 'leads total' : 'לידים סה"כ'}
              </div>
            </div>
            <button onClick={() => setMobileSearch(v => !v)}
              style={{ background: mobileSearch ? T.accent : T.bgRowHover, border: 'none', cursor: 'pointer', color: mobileSearch ? '#fff' : T.textSub, padding: '9px', borderRadius: 10, display: 'flex', alignItems: 'center' }}>
              <Search size={18} />
            </button>
            <button onClick={syncLeads} disabled={leadsSyncing}
              style={{ background: T.bgRowHover, border: 'none', cursor: 'pointer', color: leadsSyncing ? T.textDim : T.textSub, padding: '9px', borderRadius: 10, display: 'flex', alignItems: 'center' }}>
              <RefreshCw size={18} style={{ animation: leadsSyncing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>

          {/* Mobile search */}
          {mobileSearch && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgInput, border: `1.5px solid ${T.accent}`, borderRadius: 12, padding: '10px 14px', marginBottom: 2, boxShadow: `0 0 0 3px ${T.accent}18` }}>
              <Search size={14} style={{ color: T.accent, flexShrink: 0 }} />
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'en' ? 'Search leads...' : 'חפש לידים...'}
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 14, color: T.text, fontFamily: 'inherit', flex: 1, direction: 'rtl' }} />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, padding: 0, display: 'flex', alignItems: 'center' }}><X size={14} /></button>}
            </div>
          )}

          {/* Mobile tab strip */}
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
            {GROUPS.map(g => {
              const cnt = (grouped[g.id] || []).length
              const isActive = activeTab === g.id
              return (
                <button key={g.id} onClick={() => setActiveTab(g.id === activeTab ? 'all' : g.id)}
                  style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1px solid ${isActive ? g.color : T.border}`, background: isActive ? g.color + '1A' : 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? g.color : T.textSub, whiteSpace: 'nowrap' }}>{lang === 'en' ? g.en : g.label}</span>
                  {cnt > 0 && <span style={{ fontSize: 10, background: isActive ? g.color : T.border, color: isActive ? '#fff' : T.textSub, borderRadius: 10, padding: '1px 6px', fontWeight: 800 }}>{cnt}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Stats bar ── */}
        <div style={{ background: T.bgHeader, borderBottom: `1px solid ${T.border}`, paddingTop: 10 }}>
          <MobileStatsBar leads={leads} T={T} lang={lang} />
        </div>

        {/* ── Lead cards ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', WebkitOverflowScrolling: 'touch' }}>
          {leads.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: T.textSub }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                {lang === 'en' ? 'No leads yet!' : 'עוד אין לידים!'}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                {lang === 'en' ? 'Tap + to add your first lead.' : 'לחץ + כדי להוסיף את הליד הראשון.'}
              </div>
              <button onClick={() => handleAddRow('new', '')}
                style={{ padding: '13px 28px', background: T.accent, border: 'none', borderRadius: 14, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 4px 20px ${T.accent}50` }}>
                <Plus size={16} style={{ display: 'inline', marginLeft: 6 }} />
                {lang === 'en' ? 'Add First Lead' : 'הוסף ליד ראשון'}
              </button>
            </div>
          )}

          {/* Show filtered groups or all groups */}
          {leads.length > 0 && (
            activeTab !== 'all' && GROUPS.find(g => g.id === activeTab)
              ? (
                // Single group filtered
                <div>
                  {(grouped[activeTab] || []).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: T.textSub, fontSize: 14 }}>
                      {lang === 'en' ? 'No leads in this status' : 'אין לידים בסטטוס זה'}
                    </div>
                  ) : (grouped[activeTab] || []).map(lead => (
                    <MobileLeadCard key={lead.id} lead={lead} lang={lang} T={T}
                      onUpdate={updateLead} onDelete={handleDelete}
                      onOpenDetail={setDetailLead} onStatusClick={(e, lead) => setStatusTarget(lead)} onOpenChat={onOpenChat} />
                  ))}
                  <button onClick={() => handleAddRow(activeTab, '')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '13px 0', background: 'none', border: `2px dashed ${GROUPS.find(g=>g.id===activeTab)?.color || T.border}55`, borderRadius: 14, cursor: 'pointer', color: T.textSub, fontSize: 13, fontFamily: 'inherit', marginTop: 4 }}>
                    <Plus size={15} style={{ color: GROUPS.find(g=>g.id===activeTab)?.color }} />
                    {lang === 'en' ? 'Add lead' : 'הוסף ליד'}
                  </button>
                </div>
              )
              : (
                // All groups
                GROUPS.map(group => {
                  const groupLeads = grouped[group.id] || []
                  return (
                    <MobileGroupSection key={group.id} group={group} leads={groupLeads} lang={lang} T={T}
                      onUpdate={updateLead} onDelete={handleDelete}
                      onOpenDetail={setDetailLead} onStatusClick={(e, lead) => setStatusTarget(lead)}
                      onOpenChat={onOpenChat} onAddRow={handleAddRow} />
                  )
                })
              )
          )}

          {/* Bottom padding for FAB */}
          <div style={{ height: 90 }} />
        </div>

        {/* ── Floating Action Button ── */}
        <div style={{ position: 'fixed', bottom: 24, left: lang === 'en' ? 24 : 'auto', right: lang === 'en' ? 'auto' : 24, zIndex: 400 }}>
          <button onClick={() => handleAddRow(activeTab !== 'all' ? activeTab : 'new', '')}
            style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg, #0073EA, #0060CC)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 24px #0073EA55, 0 2px 8px rgba(0,0,0,.3)`, fontSize: 28, fontFamily: 'inherit' }}>
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Overlays ── */}
        {statusTarget && <StatusPopup lead={statusTarget} onClose={() => setStatusTarget(null)} onUpdate={updateLeadStatus} lang={lang} T={T} />}
        {detailLead && <ItemDetailDrawer lead={leads.find(l => l.id === detailLead.id) || detailLead} onClose={() => setDetailLead(null)} onUpdate={updateLead} onUpdateStatus={updateLeadStatus} lang={lang} T={T} isDark={isDark} isMobile onEnrich={enrichLead} />}
        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DESKTOP LAYOUT
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: "Rubik,'Inter','Segoe UI',system-ui,sans-serif", direction: lang === 'en' ? 'ltr' : 'rtl', overflow: 'hidden' }}>

      {/* ── Board title bar ── */}
      <div style={{ padding: '10px 20px 0', background: T.bgHeader, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#A25DDC,#0073EA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px #0073EA44' }}>
            <User size={15} style={{ color: '#fff' }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: '-.01em' }}>
            {lang === 'en' ? 'Leads CRM' : 'ניהול לידים'}
          </span>
          <span style={{ fontSize: 12, color: T.textSub, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>
            {leads.length} {lang === 'en' ? 'items' : 'פריטים'}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setModal('integrate')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, color: T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0073EA88'; e.currentTarget.style.color = T.text }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub }}>
            <Zap size={12} /> {lang === 'en' ? 'Integrations' : 'אינטגרציות'}
          </button>
          <button onClick={() => setModal('automate')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: '#A25DDC14', border: '1px solid #A25DDC44', borderRadius: 8, color: '#A25DDC', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Settings size={12} /> {lang === 'en' ? 'Automate' : 'אוטומציות'}
            <span style={{ background: '#A25DDC', color: '#fff', borderRadius: 10, fontSize: 9, padding: '0 5px', fontWeight: 800 }}>2</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto' }}>
          {[
            { id: 'leads', label: lang === 'en' ? 'Leads Board' : 'בורד לידים' },
            { id: 'table', label: lang === 'en' ? 'Main Table' : 'טבלה ראשית' },
            { id: 'chart', label: lang === 'en' ? 'Chart View' : 'תרשים' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: '8px 16px', background: 'none', border: 'none', borderBottom: activeTab === tab.id ? `2px solid ${T.accent}` : '2px solid transparent', marginBottom: -1, color: activeTab === tab.id ? T.accent : T.textSub, fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'color .15s' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', background: T.bgHeader, borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 8, overflow: 'hidden', boxShadow: `0 2px 8px ${T.accent}30` }}>
          <button onClick={() => handleAddRow(GROUPS[0].id, '')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', background: T.accent, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', borderRight: '1px solid rgba(255,255,255,.25)' }}>
            <Plus size={14} /> {lang === 'en' ? 'New Item' : 'פריט חדש'}
          </button>
          <button style={{ padding: '7px 10px', background: T.accent, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ChevronDown size={13} />
          </button>
        </div>

        <div style={{ width: 1, height: 22, background: T.border, margin: '0 2px' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, padding: '6px 12px', transition: 'border-color .15s', minWidth: 200 }}
          onFocusCapture={e => e.currentTarget.style.borderColor = T.accent}
          onBlurCapture={e => e.currentTarget.style.borderColor = T.border}>
          <Search size={13} style={{ color: T.textSub, flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'en' ? 'Search leads...' : 'חפש לידים...'}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: T.text, fontFamily: 'inherit', width: 130 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, padding: 0, display: 'flex', alignItems: 'center' }}><X size={12} /></button>}
        </div>

        {[
          { label: lang === 'en' ? 'Filter' : 'סינון', icon: Filter, onClick: () => {} },
          { label: lang === 'en' ? 'Sort' : 'מיון', icon: ArrowUpDown, onClick: () => {} },
        ].map(btn => {
          const Icon = btn.icon
          return (
            <button key={btn.label} onClick={btn.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, color: T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent + '88'; e.currentTarget.style.color = T.text }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub }}>
              <Icon size={12} /> {btn.label}
            </button>
          )
        })}

        <button onClick={() => setModal('hidecols')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: hiddenCount > 0 ? T.accent + '0A' : 'none', border: `1px solid ${hiddenCount > 0 ? T.accent + '44' : T.border}`, borderRadius: 8, color: hiddenCount > 0 ? T.accent : T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent + '88'; e.currentTarget.style.color = T.accent }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = hiddenCount > 0 ? T.accent + '44' : T.border; e.currentTarget.style.color = hiddenCount > 0 ? T.accent : T.textSub }}>
          {hiddenCount > 0 ? <EyeOff size={12} /> : <Eye size={12} />}
          {lang === 'en' ? 'Hide' : 'הסתר'}
          {hiddenCount > 0 && <span style={{ background: T.accent, color: '#fff', borderRadius: 10, fontSize: 10, padding: '0 5px', fontWeight: 700 }}>{hiddenCount}</span>}
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={syncLeads} disabled={leadsSyncing}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, color: leadsSyncing ? T.textDim : T.textSub, fontSize: 12, fontWeight: 600, cursor: leadsSyncing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
          <RefreshCw size={12} style={{ animation: leadsSyncing ? 'spin 1s linear infinite' : 'none' }} />
          {lang === 'en' ? 'Sync' : 'סנכרן'}
        </button>

        <button onClick={exportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'none', border: `1px solid ${T.border}`, borderRadius: 8, color: T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.green + '88'; e.currentTarget.style.color = T.green }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub }}>
          <Download size={12} /> CSV
        </button>

        <button onClick={() => setModal('addcol')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', background: T.accent + '12', border: `1px solid ${T.accent}55`, borderRadius: 8, color: T.accent, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap' }}
          onMouseEnter={e => { e.currentTarget.style.background = T.accent + '22'; e.currentTarget.style.borderColor = T.accent }}
          onMouseLeave={e => { e.currentTarget.style.background = T.accent + '12'; e.currentTarget.style.borderColor = T.accent + '55' }}>
          <Columns size={12} /> {lang === 'en' ? '+ Add Column' : '+ יצירת עמודה חדשה'}
        </button>

        {enrichAll && (
          <button onClick={enrichAll}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: '#A25DDC14', border: '1px solid #A25DDC44', borderRadius: 8, color: '#A25DDC', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✦ {lang === 'en' ? 'Enrich All' : 'העשר'}
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', position: 'relative' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ minWidth: tableMinWidth, width: '100%' }}>
            {/* Column headers */}
            <div style={{ display: 'flex', alignItems: 'center', background: T.bgHeader, borderBottom: `2px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 10, height: 38 }}>
              <div style={{ width: 32, flexShrink: 0, borderRight: `1px solid ${T.border}`, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'sticky', left: 0, background: T.bgHeader, zIndex: 5 }}>
                <input type="checkbox" style={{ accentColor: T.accent, width: 14, height: 14 }}
                  onChange={e => {
                    if (e.target.checked) setSelectedIds(new Set(filtered.map(l => l.id)))
                    else setSelectedIds(new Set())
                  }} />
              </div>
              {allCols.map(col => (
                <div key={col.id} style={{ width: col.width, flexShrink: 0, padding: '0 10px', fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.05em', borderRight: `1px solid ${T.borderLight}`, height: '100%', display: 'flex', alignItems: 'center', userSelect: 'none', cursor: 'pointer', transition: 'color .15s, background .15s', whiteSpace: 'nowrap', overflow: 'hidden', ...(col.pinned ? { position: 'sticky', left: 32, zIndex: 4, background: T.bgHeader } : {}) }}
                  onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.background = T.bgRowHover }}
                  onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.background = col.pinned ? T.bgHeader : 'transparent' }}>
                  {lang === 'en' ? (col.en || col.label) : col.label}
                </div>
              ))}
              <button onClick={() => setModal('addcol')}
                style={{ width: 120, flexShrink: 0, height: '100%', background: 'none', border: 'none', borderRight: `1px solid ${T.borderLight}`, color: T.textDim, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all .15s', fontFamily: 'inherit', whiteSpace: 'nowrap', padding: '0 12px' }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bgRowHover; e.currentTarget.style.color = T.accent }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.textDim }}>
                <Plus size={13} /> {lang === 'en' ? 'Add Column' : 'עמודה חדשה'}
              </button>
            </div>

            {leads.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 24px', color: T.textSub }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                  {lang === 'en' ? 'No leads yet!' : 'עוד אין לידים!'}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
                  {lang === 'en' ? 'Click + New Item to add your first lead.' : 'לחץ על פריט חדש+ להוספת הליד הראשון.'}
                </div>
                <button onClick={() => handleAddRow('new', 'New Lead')}
                  style={{ padding: '11px 26px', background: T.accent, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: `0 4px 16px ${T.accent}44` }}>
                  <Plus size={14} style={{ display: 'inline', marginRight: 6 }} />
                  {lang === 'en' ? 'Add First Lead' : 'הוסף ליד ראשון'}
                </button>
              </div>
            )}

            {GROUPS.map(group => {
              const groupLeads = grouped[group.id] || []
              return (
                <BoardGroup key={group.id} group={group} leads={groupLeads} cols={allCols}
                  T={T} lang={lang}
                  onUpdate={updateLead} onUpdateStatus={updateLeadStatus}
                  onDelete={handleDelete} onSelect={handleSelect}
                  onOpenDetail={setDetailLead} onAddRow={handleAddRow}
                  onOpenChat={onOpenChat} onEnrich={enrichLead}
                  onStatusClick={(e, lead) => setStatusTarget(lead)} />
              )
            })}

            <div style={{ height: 60 }} />
          </div>
        </DndContext>
      </div>

      {/* ── Modals ── */}
      {modal === 'integrate'  && <IntegrationsModal onClose={() => setModal(null)} T={T} lang={lang} />}
      {modal === 'automate'   && <AutomationsModal  onClose={() => setModal(null)} T={T} lang={lang} />}
      {modal === 'addcol'     && <AddColumnModal    onClose={() => setModal(null)} onAdd={handleAddCol} T={T} lang={lang} />}

      {modal === 'hidecols' && (
        <>
          <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
          <div style={{ position: 'fixed', top: '45%', left: '50%', transform: 'translate(-50%,-50%)', background: T.bgHeader, border: `1px solid ${T.border}`, borderRadius: 14, padding: '16px 20px', boxShadow: T.shadow, zIndex: 901, minWidth: 230, direction: lang === 'en' ? 'ltr' : 'rtl' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>{lang === 'en' ? 'Show / Hide Columns' : 'הצג / הסתר עמודות'}</div>
            {BUILT_IN_COLS.map(col => (
              <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={!hiddenCols[col.id]} onChange={() => toggleColVisibility(col.id)} style={{ accentColor: T.accent, cursor: 'pointer', width: 15, height: 15 }} />
                <span style={{ fontSize: 13, color: T.text }}>{lang === 'en' ? (col.en || col.label) : col.label}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {statusTarget && <StatusPopup lead={statusTarget} onClose={() => setStatusTarget(null)} onUpdate={updateLeadStatus} lang={lang} T={T} />}
      {detailLead && <ItemDetailDrawer lead={leads.find(l => l.id === detailLead.id) || detailLead} onClose={() => setDetailLead(null)} onUpdate={updateLead} onUpdateStatus={updateLeadStatus} lang={lang} T={T} isDark={isDark} isMobile={false} onEnrich={enrichLead} />}
      {selectedIds.size > 0 && <BulkActionBar count={selectedIds.size} lang={lang} T={T} onClearSelection={() => setSelectedIds(new Set())} onDelete={handleBulkDelete} onMove={() => {}} />}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
