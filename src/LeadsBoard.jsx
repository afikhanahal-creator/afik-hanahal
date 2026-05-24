import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  DndContext, closestCenter, DragOverlay, useSensor, useSensors, PointerSensor,
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
  MessageSquare, Hash, Tag, ChevronLeft,
} from 'lucide-react'

// ─── constants ───────────────────────────────────────────────────────────────

const GROUPS = [
  { id: 'new',         label: 'ליד חדש',   en: 'New Leads',      color: '#0073EA' },
  { id: 'contacted',   label: 'ניצור קשר', en: 'Contacted',      color: '#FDAB3D' },
  { id: 'discovery',   label: 'גילוי',     en: 'Discovery',      color: '#A25DDC' },
  { id: 'negotiating', label: 'במו"מ',     en: 'In Negotiation', color: '#FF7575' },
  { id: 'won',         label: '✓ סגירה',   en: 'Closed Won',     color: '#00C875' },
  { id: 'lost',        label: 'ללא מענה',  en: 'Lost',           color: '#7D7D7D' },
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
  { id: 'twilio',     name: 'Twilio SMS',         logo: '📱', color: '#F22F46', desc: 'Automated SMS' },
  { id: 'make',       name: 'Make (Integromat)',  logo: '🔄', color: '#6D00CC', desc: 'Visual automations' },
]

const AUTOMATION_RECIPES = [
  { trigger: 'New lead added', action: 'Assign to me', icon: '👤' },
  { trigger: 'Status → Won', action: 'Notify team on Slack', icon: '🎉' },
  { trigger: 'Score = Hot', action: 'Move to Negotiation', icon: '🔥' },
  { trigger: 'Lead idle 3 days', action: 'Send follow-up message', icon: '⏰' },
  { trigger: 'Email received', action: 'Create lead from email', icon: '📧' },
]

// ─── helpers ─────────────────────────────────────────────────────────────────

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

// ─── theme ───────────────────────────────────────────────────────────────────

const useTheme = isDark => useMemo(() => isDark ? {
  bg:          '#1C1F3B',
  bgRow:       '#1C1F3B',
  bgRowHover:  '#252844',
  bgHeader:    '#181B34',
  bgGroup:     '#1A1D37',
  bgInput:     '#252844',
  border:      '#323547',
  borderLight: '#2A2D4A',
  text:        '#D7DAED',
  textSub:     '#9699A6',
  textDim:     '#5C5F78',
  accent:      '#0073EA',
  shadow:      '0 4px 24px rgba(0,0,0,.5)',
  shadowSm:    '0 2px 8px rgba(0,0,0,.4)',
} : {
  bg:          '#F6F7FB',
  bgRow:       '#FFFFFF',
  bgRowHover:  '#F4F5F8',
  bgHeader:    '#FFFFFF',
  bgGroup:     '#F6F7FB',
  bgInput:     '#FFFFFF',
  border:      '#E6E9EF',
  borderLight: '#EEF0F4',
  text:        '#323338',
  textSub:     '#676879',
  textDim:     '#C4C4C4',
  accent:      '#0073EA',
  shadow:      '0 4px 24px rgba(0,0,0,.12)',
  shadowSm:    '0 2px 8px rgba(0,0,0,.08)',
}, [isDark])

// ─── cell components ─────────────────────────────────────────────────────────

function StatusBadge({ value, lang, onClick, T }) {
  const g = GROUPS.find(x => x.id === value)
  const color = g?.color || '#7D7D7D'
  const label = g ? (lang === 'en' ? g.en : g.label) : (value || '—')
  return (
    <div onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer',
      background: color + '22', borderRadius: 6, padding: '3px 10px',
      border: `1px solid ${color}44`, transition: 'all .15s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = color + '33' }}
    onMouseLeave={e => { e.currentTarget.style.background = color + '22' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}/>
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
      background: opt.bg, borderRadius: 6, padding: '3px 8px',
      fontSize: 12, fontWeight: 700, color: opt.color,
    }}>{label}</span>
  )
}

function PhoneCell({ value }) {
  if (!value) return <span style={{ color: '#9699A6', fontSize: 12 }}>—</span>
  return (
    <a href={`tel:${value}`} style={{ color: '#0073EA', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit', direction: 'ltr', display: 'inline-block' }}
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
    width: '100%', background: T.bgInput, border: `1.5px solid #0073EA`, borderRadius: 4,
    padding: '4px 6px', fontSize: 13, color: T.text, fontFamily: 'inherit', outline: 'none',
    resize: 'none', direction: 'rtl',
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

// ─── sortable row ─────────────────────────────────────────────────────────────

function SortableRow({ lead, cols, onUpdate, onDelete, onSelect, isSelected, lang, T, onOpenDetail, onStatusClick, onOpenChat }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const [hovered, setHovered] = useState(false)
  const [checked, setChecked] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    display: 'flex', alignItems: 'stretch',
    borderBottom: `1px solid ${T.borderLight}`,
    background: isSelected ? '#0073EA12' : hovered ? T.bgRowHover : T.bgRow,
    transition: `background .1s${transition ? ', ' + transition : ''}`,
    cursor: isDragging ? 'grabbing' : 'default',
    minHeight: 44,
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
        return <div key={col.id} style={cellStyle}><ScoreBadge value={val} lang={lang} /></div>
      case 'phone':
        return <div key={col.id} style={cellStyle}><PhoneCell value={val} /></div>
      case 'email':
        return <div key={col.id} style={cellStyle}><EmailCell value={val} /></div>
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

      {/* All cells */}
      {cols.map(col => renderCell(col))}

      {/* Row actions (on hover) */}
      {hovered && (
        <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4, background: T.bgRow, borderRadius: 6, padding: '2px 4px', boxShadow: T.shadowSm, zIndex: 10 }}>
          {lead.phone && onOpenChat && (
            <button onClick={() => onOpenChat(lead)} title="פתח צ'אט"
              style={{ background: 'none', border: 'none', color: '#25D366', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = '#25D36618'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <MessageSquare size={13} />
            </button>
          )}
          <button onClick={() => onOpenDetail(lead)} title="Open detail"
            style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = T.border}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <ExternalLink size={13} />
          </button>
          <button onClick={() => onDelete(lead.id)} title="Delete"
            style={{ background: 'none', border: 'none', color: '#E2445C', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = '#E2445C18'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <Trash2 size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── board group ─────────────────────────────────────────────────────────────

function BoardGroup({ group, leads, cols, onUpdate, onUpdateStatus, onDelete, onSelect, lang, T, onOpenDetail, onAddRow, onStatusClick, onOpenChat }) {
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
      {/* Group header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px 6px 0', borderBottom: `1px solid ${T.borderLight}`, userSelect: 'none', background: T.bgGroup, position: 'sticky', top: 36, zIndex: 4 }}>
        {/* Left color bar */}
        <div style={{ width: 4, alignSelf: 'stretch', background: color, borderRadius: '0 3px 3px 0', marginRight: 8, flexShrink: 0 }} />
        {/* Collapse chevron */}
        <button onClick={() => setCollapsed(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color, display: 'flex', alignItems: 'center', padding: '0 6px 0 0', transition: 'transform .2s' }}>
          <ChevronDown size={15} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 800, color, marginRight: 6 }}>{label}</span>
        <span style={{ fontSize: 11, background: color + '20', color, borderRadius: 20, padding: '1px 8px', fontWeight: 700, marginRight: 8 }}>{leads.length}</span>
        <div style={{ flex: 1 }} />
      </div>

      {/* Rows */}
      {!collapsed && (
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <SortableRow key={lead.id} lead={lead} cols={cols} T={T} lang={lang}
              onUpdate={onUpdate} onDelete={onDelete} onSelect={onSelect}
              onOpenDetail={onOpenDetail} onStatusClick={onStatusClick} onOpenChat={onOpenChat} />
          ))}
        </SortableContext>
      )}

      {/* Add row */}
      {!collapsed && (
        <div style={{ borderBottom: `1px solid ${T.borderLight}`, background: T.bgRow }}>
          {adding ? (
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px 6px 42px', gap: 8 }}>
              <input autoFocus ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addRow(); if (e.key === 'Escape') { setAdding(false); setNewName('') } }}
                onBlur={addRow}
                placeholder={lang === 'en' ? 'New lead name...' : 'שם הליד החדש...'}
                style={{ flex: 1, maxWidth: 280, background: T.bgInput, border: `1.5px solid #0073EA`, borderRadius: 4, padding: '5px 8px', fontSize: 13, color: T.text, fontFamily: 'inherit', outline: 'none', direction: 'rtl' }} />
              <button onClick={addRow} style={{ background: '#0073EA', border: 'none', color: '#fff', borderRadius: 4, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
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

      {/* Summary row */}
      {!collapsed && leads.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px 4px 0', borderBottom: `2px solid ${T.border}`, background: T.bgGroup }}>
          <div style={{ width: 36, flexShrink: 0 }} />
          {cols.map(col => (
            <div key={col.id} style={{ width: col.width, flexShrink: 0, padding: '4px 10px', fontSize: 11, color: T.textSub, borderRight: `1px solid ${T.borderLight}` }}>
              {col.type === 'date' || col.type === 'status' || col.type === 'email' || col.type === 'phone' ? '' :
               col.id === 'name' ? <span style={{ fontWeight: 700, color: T.textSub }}>{leads.length} {lang === 'en' ? 'items' : 'פריטים'}</span> : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── item detail drawer ───────────────────────────────────────────────────────

function ItemDetailDrawer({ lead, onClose, onUpdate, onUpdateStatus, lang, T, isDark }) {
  if (!lead) return null
  const color = getGroupColor(lead.leadStatus || 'new')

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 800 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, background: T.bgHeader, boxShadow: '-4px 0 32px rgba(0,0,0,.3)', zIndex: 801, display: 'flex', flexDirection: 'column', direction: 'rtl' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(lead.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {(lead.name || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{lead.name || '—'}</div>
            <StatusBadge value={lead.leadStatus || 'new'} lang={lang} T={T} onClick={() => {}} />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, padding: 4, display: 'flex', alignItems: 'center', borderRadius: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'טלפון', en: 'Phone', key: 'phone', type: 'phone' },
            { label: 'אימייל', en: 'Email', key: 'email', type: 'email' },
            { label: 'נכס', en: 'Property', key: 'propTitle', type: 'text' },
            { label: 'הודעה', en: 'Message', key: 'msg', type: 'notes' },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
                {lang === 'en' ? f.en : f.label}
              </div>
              {f.type === 'phone' ? (
                <a href={`tel:${lead[f.key]}`} style={{ color: '#0073EA', fontSize: 14 }}>{lead[f.key] || '—'}</a>
              ) : f.type === 'email' ? (
                <a href={`mailto:${lead[f.key]}`} style={{ color: '#0073EA', fontSize: 14 }}>{lead[f.key] || '—'}</a>
              ) : f.type === 'notes' ? (
                <EditableCell value={lead[f.key]} T={T} multiline onSave={v => onUpdate(lead.id, { [f.key]: v })} />
              ) : (
                <EditableCell value={lead[f.key]} T={T} onSave={v => onUpdate(lead.id, { [f.key]: v })} />
              )}
            </div>
          ))}

          {/* AI Enrichment */}
          {lead.enrichment && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>AI Enrichment</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Company', value: lead.enrichment?.company },
                  { label: 'City', value: lead.enrichment?.city },
                  { label: 'Budget', value: lead.enrichment?.budget },
                  { label: 'Education', value: lead.enrichment?.education },
                  { label: 'Occupation', value: lead.enrichment?.occupation },
                ].filter(x => x.value).map(x => (
                  <div key={x.label} style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 12, color: T.textSub, width: 80, flexShrink: 0 }}>{x.label}</span>
                    <span style={{ fontSize: 12, color: T.text }}>{x.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: T.textDim }}>
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
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: T.bgHeader, border: `1px solid ${T.border}`, borderRadius: 10, padding: 8, boxShadow: T.shadow, zIndex: 9001, minWidth: 180, direction: 'rtl' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.05em', padding: '4px 8px 8px' }}>
          {lang === 'en' ? 'Change Status' : 'שנה סטטוס'}
        </div>
        {GROUPS.map(g => {
          const isActive = (lead.leadStatus || 'new') === g.id
          return (
            <button key={g.id} onClick={() => { onUpdate(lead, g.id); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 10px', borderRadius: 6, border: 'none', background: isActive ? g.color + '22' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = g.color + '12' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0, boxShadow: isActive ? `0 0 0 2px ${g.color}40` : 'none' }} />
              <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? g.color : T.text }}>
                {lang === 'en' ? g.en : g.label}
              </span>
              {isActive && <Check size={12} style={{ color: g.color, marginRight: 'auto' }} />}
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
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(680px,92vw)', maxHeight: '80vh', background: T.bgHeader, borderRadius: 12, boxShadow: T.shadow, zIndex: 901, display: 'flex', flexDirection: 'column', direction: lang === 'en' ? 'ltr' : 'rtl', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={20} style={{ color: '#0073EA' }} />
              {lang === 'en' ? 'Integrations' : 'אינטגרציות'}
            </div>
            <div style={{ fontSize: 13, color: T.textSub, marginTop: 4 }}>
              {lang === 'en' ? 'Connect your tools to automate your workflow' : 'חבר כלים לאוטומטיזציה של זרימת העבודה'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, padding: 4, display: 'flex', alignItems: 'center', borderRadius: 4 }}><X size={18} /></button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px' }}>
            <Search size={14} style={{ color: T.textSub, flexShrink: 0 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'en' ? 'Search integrations...' : 'חפש אינטגרציות...'}
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: T.text, fontFamily: 'inherit', flex: 1 }} />
          </div>
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
          {filtered.map(intg => {
            const isConn = connected[intg.id]
            return (
              <div key={intg.id} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'box-shadow .15s', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = T.shadowSm}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                <div style={{ fontSize: 28 }}>{intg.logo}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{intg.name}</div>
                <div style={{ fontSize: 11, color: T.textSub, flex: 1, lineHeight: 1.5 }}>{intg.desc}</div>
                <button onClick={() => setConnected(prev => ({ ...prev, [intg.id]: !prev[intg.id] }))}
                  style={{ padding: '6px 12px', borderRadius: 6, border: isConn ? `1.5px solid #00C875` : `1.5px solid #0073EA`, background: isConn ? '#00C87514' : '#0073EA', color: isConn ? '#00C875' : '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
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
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(580px,92vw)', background: T.bgHeader, borderRadius: 12, boxShadow: T.shadow, zIndex: 901, direction: lang === 'en' ? 'ltr' : 'rtl', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={20} style={{ color: '#FDAB3D' }} />
              {lang === 'en' ? 'Automations' : 'אוטומציות'}
            </div>
            <div style={{ fontSize: 13, color: T.textSub, marginTop: 4 }}>
              {lang === 'en' ? 'When something happens → do this' : 'כש... → אז...'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
          {AUTOMATION_RECIPES.map((r, i) => {
            const isOn = active[i]
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: T.bg, borderRadius: 10, border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: T.textSub }}>{lang === 'en' ? 'When' : 'כש-'}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{r.trigger}</div>
                  <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>{lang === 'en' ? '→ Then' : '→ אז'}: <span style={{ color: '#0073EA', fontWeight: 600 }}>{r.action}</span></div>
                </div>
                <button onClick={() => setActive(prev => ({ ...prev, [i]: !prev[i] }))}
                  style={{ width: 42, height: 22, borderRadius: 11, border: 'none', background: isOn ? '#00C875' : T.border, cursor: 'pointer', transition: 'background .2s', position: 'relative', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 2, left: isOn ? 22 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.25)' }} />
                </button>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${T.border}` }}>
          <button style={{ width: '100%', padding: '10px 0', background: '#0073EA', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
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
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(520px,92vw)', background: T.bgHeader, borderRadius: 12, boxShadow: T.shadow, zIndex: 901, direction: lang === 'en' ? 'ltr' : 'rtl', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 800, color: T.text }}>{lang === 'en' ? 'Add Column' : 'הוסף עמודה'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, display: 'flex', alignItems: 'center', padding: 4, borderRadius: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {COLUMN_TYPES.map(ct => {
            const Icon = ct.icon
            const isSel = selected?.type === ct.type
            return (
              <button key={ct.type} onClick={() => setSelected(ct)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${isSel ? '#0073EA' : T.border}`, background: isSel ? '#0073EA0A' : T.bg, cursor: 'pointer', fontFamily: 'inherit', textAlign: lang === 'en' ? 'left' : 'right', transition: 'all .15s' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.borderColor = '#0073EA88' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.borderColor = T.border }}>
                <Icon size={18} style={{ color: isSel ? '#0073EA' : T.textSub }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{ct.label}</div>
                <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.4 }}>{ct.desc}</div>
              </button>
            )
          })}
        </div>
        {selected && (
          <div style={{ padding: '0 24px 16px', display: 'flex', gap: 10 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={lang === 'en' ? 'Column name...' : 'שם העמודה...'}
              style={{ flex: 1, background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 13, color: T.text, fontFamily: 'inherit', outline: 'none', direction: lang === 'en' ? 'ltr' : 'rtl' }} autoFocus />
            <button onClick={() => { onAdd({ id: 'custom_' + Date.now(), label: name || selected.label, type: selected.type, width: 150 }); onClose() }}
              style={{ padding: '8px 18px', background: '#0073EA', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {lang === 'en' ? 'Add' : 'הוסף'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── bulk action bar ──────────────────────────────────────────────────────────

function BulkActionBar({ count, onClearSelection, onDelete, onMove, lang, T }) {
  if (count === 0) return null
  return (
    <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#0073EA', borderRadius: 12, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 32px rgba(0,115,234,.45)', zIndex: 500, direction: lang === 'en' ? 'ltr' : 'rtl', whiteSpace: 'nowrap' }}>
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{count} {lang === 'en' ? 'selected' : 'נבחרו'}</span>
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.3)' }} />
      <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, opacity: .9 }}
        onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = '.9'}>
        <Trash2 size={13} /> {lang === 'en' ? 'Delete' : 'מחק'}
      </button>
      <button onClick={() => { }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, opacity: .9 }}
        onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = '.9'}>
        <Download size={13} /> {lang === 'en' ? 'Export' : 'ייצא'}
      </button>
      <button onClick={onClearSelection} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', padding: '4px 10px', fontSize: 12, fontFamily: 'inherit' }}>
        {lang === 'en' ? 'Clear' : 'בטל'}
      </button>
    </div>
  )
}

// ─── toast notification ───────────────────────────────────────────────────────

function Toast({ message, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3200); return () => clearTimeout(t) }, [onDismiss])
  return (
    <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#323338', color: '#fff', padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.4)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10 }}>
      <Check size={14} style={{ color: '#00C875' }} />
      {message}
    </div>
  )
}

// ─── main board ───────────────────────────────────────────────────────────────

export default function LeadsBoard({
  leads, updateLead, updateLeadStatus, deleteLead, addLead,
  colOrder, setColOrder, customCols, setCustomCols, colWidths, setColWidths,
  exportCSV, syncLeads, enrichAll, clearLeads, leadsSyncing,
  isDark, lang, onOpenChat,
}) {
  const T = useTheme(isDark)

  // ── state ──
  const [search, setSearch] = useState('')
  const [hiddenCols, setHiddenCols] = useState({})
  const [extraCols, setExtraCols] = useState(customCols || [])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [detailLead, setDetailLead] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  const [modal, setModal] = useState(null)   // 'integrate' | 'automate' | 'addcol'
  const [activeTab, setActiveTab] = useState('leads')
  const [activeFilter, setActiveFilter] = useState(null)
  const [toast, setToast] = useState(null)
  const [activeDragId, setActiveDragId] = useState(null)
  const [leadOrder, setLeadOrder] = useState({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  // ── computed ──
  const allCols = useMemo(() => {
    const builtIn = BUILT_IN_COLS.filter(c => !hiddenCols[c.id])
    const extra = extraCols.filter(c => !hiddenCols[c.id])
    return [...builtIn, ...extra]
  }, [hiddenCols, extraCols])

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

  // ── drag and drop ──
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
    // Check if dropped over a group header
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

  // ── actions ──
  const showToast = msg => { setToast(msg); }

  const handleAddRow = (groupId, name) => {
    const lead = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, phone: '', email: '', msg: '', propTitle: '',
      ts: Date.now(), leadStatus: groupId,
    }
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
    showToast(lang === 'en' ? `${selectedIds.size} leads deleted` : `${selectedIds.size} לידים נמחקו`)
  }

  const handleSelect = (id, checked) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      checked ? s.add(id) : s.delete(id)
      return s
    })
  }

  const handleAddCol = col => {
    const next = [...extraCols, col]
    setExtraCols(next)
    if (setCustomCols) setCustomCols(next)
    showToast(lang === 'en' ? 'Column added' : 'עמודה נוספה')
  }

  const toggleColVisibility = id => {
    setHiddenCols(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const visibleBuiltIn = BUILT_IN_COLS.filter(c => !hiddenCols[c.id])
  const hiddenCount = Object.values(hiddenCols).filter(Boolean).length

  // ── render ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", direction: lang === 'en' ? 'ltr' : 'rtl', overflow: 'hidden' }}>

      {/* ── View Tabs ── */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: `2px solid ${T.border}`, background: T.bgHeader, paddingRight: lang === 'en' ? 0 : 4, paddingLeft: lang === 'en' ? 4 : 0, overflowX: 'auto' }}>
        {[
          { id: 'leads', label: lang === 'en' ? 'Leads Board' : 'בורד לידים' },
          { id: 'table', label: lang === 'en' ? 'Main Table' : 'טבלה ראשית' },
          { id: 'chart', label: lang === 'en' ? 'Chart View' : 'תרשים' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: activeTab === tab.id ? '2px solid #0073EA' : '2px solid transparent', marginBottom: -2, color: activeTab === tab.id ? '#0073EA' : T.textSub, fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'color .15s' }}>
            {tab.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setModal('integrate')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'none', border: 'none', color: T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          onMouseEnter={e => e.currentTarget.style.color = T.text} onMouseLeave={e => e.currentTarget.style.color = T.textSub}>
          <Zap size={13} /> {lang === 'en' ? 'Integrate' : 'אינטגרציות'}
        </button>
        <button onClick={() => setModal('automate')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'none', border: 'none', color: T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          onMouseEnter={e => e.currentTarget.style.color = T.text} onMouseLeave={e => e.currentTarget.style.color = T.textSub}>
          <Settings size={13} /> {lang === 'en' ? 'Automate' : 'אוטומציה'} {leads.filter((_, i) => i < 3).length ? <span style={{ background: '#0073EA', color: '#fff', borderRadius: 10, fontSize: 10, padding: '0 5px', marginRight: 3, fontWeight: 700 }}>2</span> : null}
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: T.bgHeader, borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
        {/* New Item */}
        <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 6, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,115,234,.3)' }}>
          <button onClick={() => handleAddRow(GROUPS[0].id, '')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#0073EA', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', borderRight: '1px solid rgba(255,255,255,.25)' }}>
            <Plus size={14} /> {lang === 'en' ? 'New Item' : 'פריט חדש'}
          </button>
          <button style={{ padding: '7px 10px', background: '#0073EA', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 11 }}>
            <ChevronDown size={13} />
          </button>
        </div>

        <div style={{ width: 1, height: 22, background: T.border, margin: '0 4px' }} />

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 6, padding: '6px 10px', transition: 'border-color .15s', minWidth: 180 }}
          onFocusCapture={e => e.currentTarget.style.borderColor = '#0073EA'}
          onBlurCapture={e => e.currentTarget.style.borderColor = T.border}>
          <Search size={13} style={{ color: T.textSub, flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'en' ? 'Search leads...' : 'חפש לידים...'}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: T.text, fontFamily: 'inherit', width: 120 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, padding: 0, display: 'flex', alignItems: 'center' }}><X size={12} /></button>}
        </div>

        {/* Filter */}
        <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, color: T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#0073EA88'; e.currentTarget.style.color = T.text }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub }}>
          <Filter size={12} /> {lang === 'en' ? 'Filter' : 'סינון'}
        </button>

        {/* Sort */}
        <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, color: T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#0073EA88'; e.currentTarget.style.color = T.text }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub }}>
          <ArrowUpDown size={12} /> {lang === 'en' ? 'Sort' : 'מיון'}
        </button>

        {/* Hide columns */}
        <button onClick={() => setModal('hidecols')}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: hiddenCount > 0 ? '#0073EA0A' : 'none', border: `1px solid ${hiddenCount > 0 ? '#0073EA44' : T.border}`, borderRadius: 6, color: hiddenCount > 0 ? '#0073EA' : T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#0073EA88'; e.currentTarget.style.color = '#0073EA' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = hiddenCount > 0 ? '#0073EA44' : T.border; e.currentTarget.style.color = hiddenCount > 0 ? '#0073EA' : T.textSub }}>
          {hiddenCount > 0 ? <EyeOff size={12} /> : <Eye size={12} />}
          {lang === 'en' ? `Hide` : 'הסתר'}
          {hiddenCount > 0 && <span style={{ background: '#0073EA', color: '#fff', borderRadius: 10, fontSize: 10, padding: '0 5px', fontWeight: 700 }}>{hiddenCount}</span>}
        </button>

        <div style={{ flex: 1 }} />

        {/* Sync */}
        <button onClick={syncLeads} disabled={leadsSyncing}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, color: leadsSyncing ? T.textDim : T.textSub, fontSize: 12, fontWeight: 600, cursor: leadsSyncing ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
          <RefreshCw size={12} style={{ animation: leadsSyncing ? 'spin 1s linear infinite' : 'none' }} />
          {lang === 'en' ? 'Sync' : 'סנכרן'}
        </button>

        {/* Export */}
        <button onClick={exportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: 'none', border: `1px solid ${T.border}`, borderRadius: 6, color: T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#00C87588'; e.currentTarget.style.color = '#00C875' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub }}>
          <Download size={12} /> CSV
        </button>

        {/* Enrich */}
        {enrichAll && (
          <button onClick={enrichAll}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', background: '#A25DDC14', border: '1px solid #A25DDC44', borderRadius: 6, color: '#A25DDC', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✦ {lang === 'en' ? 'Enrich All' : 'העשר'}
          </button>
        )}
      </div>

      {/* ── Board Table ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', position: 'relative' }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div style={{ minWidth: 860 }}>

            {/* Column headers (sticky) */}
            <div style={{ display: 'flex', alignItems: 'center', background: T.bgHeader, borderBottom: `2px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 10, height: 36 }}>
              {/* Drag col */}
              <div style={{ width: 32, flexShrink: 0, borderRight: `1px solid ${T.border}`, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'sticky', left: 0, background: T.bgHeader, zIndex: 5 }}>
                <input type="checkbox" style={{ accentColor: '#0073EA', width: 14, height: 14 }}
                  onChange={e => {
                    if (e.target.checked) setSelectedIds(new Set(filtered.map(l => l.id)))
                    else setSelectedIds(new Set())
                  }} />
              </div>

              {allCols.map(col => (
                <div key={col.id} style={{ width: col.width, flexShrink: 0, padding: '0 10px', fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.04em', borderRight: `1px solid ${T.borderLight}`, height: '100%', display: 'flex', alignItems: 'center', userSelect: 'none', cursor: 'pointer', transition: 'color .15s, background .15s', whiteSpace: 'nowrap', overflow: 'hidden', ...(col.pinned ? { position: 'sticky', left: 32, zIndex: 4, background: T.bgHeader } : {}) }}
                  onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.background = T.bgRowHover }}
                  onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.background = col.pinned ? T.bgHeader : 'transparent' }}>
                  {lang === 'en' ? (col.en || col.label) : col.label}
                </div>
              ))}

              {/* Add column */}
              <button onClick={() => setModal('addcol')}
                style={{ width: 36, flexShrink: 0, height: '100%', background: 'none', border: 'none', borderRight: `1px solid ${T.borderLight}`, color: T.textDim, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bgRowHover; e.currentTarget.style.color = '#0073EA' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.textDim }}
                title={lang === 'en' ? 'Add column' : 'הוסף עמודה'}>
                +
              </button>
            </div>

            {/* Empty state */}
            {leads.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 24px', color: T.textSub }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                  {lang === 'en' ? 'No leads yet!' : 'עוד אין לידים!'}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
                  {lang === 'en' ? 'Click + New Item to add your first lead.' : 'לחץ על פריט חדש+ להוספת הליד הראשון.'}
                </div>
                <button onClick={() => handleAddRow('new', 'New Lead')}
                  style={{ padding: '10px 24px', background: '#0073EA', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Plus size={14} style={{ display: 'inline', marginRight: 6 }} />
                  {lang === 'en' ? 'Add First Lead' : 'הוסף ליד ראשון'}
                </button>
              </div>
            )}

            {/* Groups */}
            {GROUPS.map(group => {
              const groupLeads = grouped[group.id] || []
              return (
                <BoardGroup key={group.id} group={group} leads={groupLeads} cols={allCols}
                  T={T} lang={lang}
                  onUpdate={updateLead}
                  onUpdateStatus={updateLeadStatus}
                  onDelete={handleDelete}
                  onSelect={handleSelect}
                  onOpenDetail={setDetailLead}
                  onAddRow={handleAddRow}
                  onOpenChat={onOpenChat}
                  onStatusClick={(e, lead) => setStatusTarget(lead)} />
              )
            })}

            {/* Footer padding */}
            <div style={{ height: 60 }} />
          </div>
        </DndContext>
      </div>

      {/* ── Modals & Overlays ── */}
      {modal === 'integrate' && <IntegrationsModal onClose={() => setModal(null)} T={T} lang={lang} />}
      {modal === 'automate' && <AutomationsModal onClose={() => setModal(null)} T={T} lang={lang} />}
      {modal === 'addcol' && <AddColumnModal onClose={() => setModal(null)} onAdd={handleAddCol} T={T} lang={lang} />}

      {modal === 'hidecols' && (
        <>
          <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
          <div style={{ position: 'fixed', top: '45%', left: '50%', transform: 'translate(-50%,-50%)', background: T.bgHeader, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, boxShadow: T.shadow, zIndex: 901, minWidth: 220, direction: lang === 'en' ? 'ltr' : 'rtl' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10 }}>{lang === 'en' ? 'Show / Hide Columns' : 'הצג / הסתר עמודות'}</div>
            {BUILT_IN_COLS.map(col => (
              <label key={col.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer' }}>
                <input type="checkbox" checked={!hiddenCols[col.id]} onChange={() => toggleColVisibility(col.id)} style={{ accentColor: '#0073EA', cursor: 'pointer' }} />
                <span style={{ fontSize: 13, color: T.text }}>{lang === 'en' ? (col.en || col.label) : col.label}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {statusTarget && (
        <StatusPopup lead={statusTarget} onClose={() => setStatusTarget(null)} onUpdate={updateLeadStatus} lang={lang} T={T} />
      )}

      {detailLead && (
        <ItemDetailDrawer lead={leads.find(l => l.id === detailLead.id) || detailLead}
          onClose={() => setDetailLead(null)} onUpdate={updateLead} onUpdateStatus={updateLeadStatus}
          lang={lang} T={T} isDark={isDark} />
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar count={selectedIds.size} lang={lang} T={T}
          onClearSelection={() => setSelectedIds(new Set())}
          onDelete={handleBulkDelete}
          onMove={() => {}} />
      )}

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* CSS for spin animation */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}