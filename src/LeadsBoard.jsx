import { useState, useRef, useCallback, useEffect, useMemo, createContext, useContext } from 'react'
import DateTimePicker from './DateTimePicker.jsx'
import { ensureFuCss } from './FollowUpTask.jsx'
import { followUpPresets, setNextFollowUp } from '../lib/follow-up.js'
import { sourceLabel, sourceColor, originLines, leadCampaign, leadCampaignTag, leadCampaignFull, prettyLeadText, leadProject, toggleProjectInName, welcomeState } from './lib/leadFields.js'
import { mergeLeads, mergeConflicts } from './lib/leadMerge.js'
import { trashBatches } from '../lib/lead-restore.js'
import LeadsDashboard from './LeadsDashboard.jsx'
import LeadCard from './LeadCard.jsx'
import ExportDialog from './ExportDialog.jsx'
import {
  DndContext, closestCenter, closestCorners, useSensor, useSensors,
  PointerSensor, DragOverlay, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import WaFace from './WaFace.jsx'
import FollowUpsView, { FollowUpsButton } from './FollowUpsView.jsx'
import {
  Plus, Search, Filter, SortAsc, Eye, EyeOff, ChevronDown, ChevronRight,
  MoreHorizontal, User, Calendar, Phone, Mail, FileText, Link2, Zap,
  Settings, X, Check, GripVertical, Trash2, Copy, Download, Upload, Bell, Pencil,
  Star, RefreshCw, Columns, Paintbrush, Layers, ArrowUpDown, ExternalLink,
  MessageSquare, Hash, Tag, ChevronLeft, ChevronUp, BarChart3, Columns3, Table2, Minus, Clock, StickyNote, CheckCheck, AlertCircle,
} from 'lucide-react'

// ─── constants ────────────────────────────────────────────────────────────────

const GROUPS = [
  { id: 'new',         label: 'ליד חדש',   en: 'New Leads',      color: '#0073EA' },
  { id: 'contacted',   label: 'ניצור קשר', en: 'Contacted',      color: '#FDAB3D' },
  { id: 'discovery',   label: 'גילוי',     en: 'Discovery',      color: '#A25DDC' },
  { id: 'meeting',     label: 'נקבעה פגישה', en: 'Meeting set',  color: '#4F6BED' },
  { id: 'negotiating', label: 'במו"מ',     en: 'In Negotiation', color: '#FF7575' },
  { id: 'won',         label: 'סגירה',     en: 'Closed Won',     color: '#00C875' },
  { id: 'lost',        label: 'ללא מענה',  en: 'No Answer',      color: '#7D7D7D' },
  // Leads that turned out not to fit: the column starts collapsed, they're left out of bulk sends by default
  { id: 'irrelevant',  label: 'לא רלוונטי', en: 'Not relevant',  color: '#64748B', collapsedByDefault: true },
  // Not now, maybe later: a follow-up date a few months ahead is set when a lead moves here (AdminPanel updateLeadStatus)
  { id: 'nurture',     label: 'לחזור בעוד כמה חודשים', en: 'Nurture (later)', color: '#0E9AA7' },
]
// Stage names are editable by the office (double-click a column title). Overrides live in the admin's
// settings ({ [stageId]: { label, en } }) and are applied onto GROUPS, so every place that shows a stage
// name — board, table, status menu, drawer, mobile tabs — uses the office's wording.
const DEFAULT_STAGE_NAMES = Object.fromEntries(GROUPS.map(g => [g.id, { label: g.label, en: g.en }]))
function applyStageLabels(map) {
  for (const g of GROUPS) {
    const o = (map && map[g.id]) || {}
    g.label = (typeof o.label === 'string' && o.label.trim()) || DEFAULT_STAGE_NAMES[g.id].label
    g.en = (typeof o.en === 'string' && o.en.trim()) || DEFAULT_STAGE_NAMES[g.id].en
  }
}

// Inline-editable stage title: double-click (or the pencil) → type → Enter / click away saves,
// Esc cancels, an empty name restores the default.
function StageTitle({ group, lang, color, onRename, size = 13 }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [hover, setHover] = useState(false)
  const label = lang === 'en' ? group.en : group.label
  const start = e => { e?.stopPropagation?.(); if (!onRename) return; setDraft(label); setEditing(true) }
  const commit = () => { setEditing(false); const v = draft.trim().slice(0, 40); if (v !== label) onRename(group.id, v) }
  if (editing) return (
    <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} maxLength={40}
      onPointerDown={e => e.stopPropagation()} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      onBlur={commit} aria-label={lang === 'en' ? 'Stage name' : 'שם השלב'}
      placeholder={lang === 'en' ? DEFAULT_STAGE_NAMES[group.id]?.en : DEFAULT_STAGE_NAMES[group.id]?.label}
      style={{ flex: 1, minWidth: 0, fontSize: size, fontWeight: 800, color, background: 'rgba(255,255,255,.06)', border: `1.5px solid ${color}`, borderRadius: 7, padding: '3px 8px', fontFamily: 'inherit', outline: 'none', minHeight: 0 }}/>
  )
  return (
    <span onDoubleClick={start} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      title={onRename ? (lang === 'en' ? 'Double-click to rename' : 'לחיצה כפולה לשינוי השם') : undefined}
      style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: onRename ? 'text' : 'default' }}>
      <span style={{ fontSize: size, fontWeight: 800, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {onRename && (
        <button onClick={start} onPointerDown={e => e.stopPropagation()} aria-label={lang === 'en' ? 'Rename stage' : 'שינוי שם השלב'}
          style={{ opacity: hover ? .9 : .35, transition: 'opacity .15s', background: 'none', border: 'none', padding: 2, cursor: 'pointer', color, display: 'inline-flex', minWidth: 0, minHeight: 0 }}>
          <Pencil size={11}/>
        </button>
      )}
    </span>
  )
}

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
  { id: 'location',   label: 'מיקום',        en: 'Location',     type: 'text',   width: 150 },
  { id: 'source',     label: 'מקור',         en: 'Source',       type: 'source', width: 130 },
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

// SVG brand logos for integrations
const IntegrationIcon = ({ id, size = 36 }) => {
  const s = size
  if (id === 'slack') return (
    <svg width={s} height={s} viewBox="0 0 54 54" fill="none">
      <path d="M19.7 0a5.4 5.4 0 0 0 0 10.8h5.4V5.4A5.4 5.4 0 0 0 19.7 0m0 14.4H5.4a5.4 5.4 0 0 0 0 10.7h14.3a5.4 5.4 0 0 0 0-10.7" fill="#36C5F0"/>
      <path d="M54 19.7a5.4 5.4 0 0 0-10.8 0v5.4h5.4A5.4 5.4 0 0 0 54 19.7m-14.4 0V5.4a5.4 5.4 0 0 0-10.7 0v14.3a5.4 5.4 0 0 0 10.7 0" fill="#2EB67D"/>
      <path d="M34.3 54a5.4 5.4 0 0 0 0-10.8h-5.4v5.4A5.4 5.4 0 0 0 34.3 54m0-14.4h14.3a5.4 5.4 0 0 0 0-10.7H34.3a5.4 5.4 0 0 0 0 10.7" fill="#ECB22E"/>
      <path d="M0 34.3a5.4 5.4 0 0 0 10.8 0v-5.4H5.4A5.4 5.4 0 0 0 0 34.3m14.4 0v14.3a5.4 5.4 0 0 0 10.7 0V34.3a5.4 5.4 0 0 0-10.7 0" fill="#E01E5A"/>
    </svg>
  )
  if (id === 'whatsapp') return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="#25D366"/>
      <path d="M22.5 9.4A9.1 9.1 0 0 0 7 20.3L5.5 26l5.8-1.5a9 9 0 0 0 4.4 1.1A9.1 9.1 0 0 0 22.5 9.4zm-6.8 14a7.5 7.5 0 0 1-3.8-1l-.3-.2-2.9.8.8-2.8-.2-.3A7.5 7.5 0 1 1 22 19.8a7.5 7.5 0 0 1-6.3 3.6zm4.1-5.6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.1-.3.2-.5.1a6 6 0 0 1-1.8-1.1 6.8 6.8 0 0 1-1.2-1.6c-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3a2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1 2.6 11.5 11.5 0 0 0 4.4 3.9c.6.3 1.1.4 1.5.5a3.5 3.5 0 0 0 1.6.1 2.7 2.7 0 0 0 1.7-1.2c.2-.4.2-.7.1-.9l-.5-.3z" fill="#fff"/>
    </svg>
  )
  if (id === 'gmail') return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      <path d="M4.5 39h6V22.5L2 17v19.5C2 37.9 3.1 39 4.5 39z" fill="#4285F4"/>
      <path d="M37.5 39h6c1.4 0 2.5-1.1 2.5-2.5V17l-8.5 5.5V39z" fill="#34A853"/>
      <path d="M37.5 11.5V22.5L46 17v-4c0-3.1-3.6-4.9-6.1-3L37.5 11.5z" fill="#FBBC04"/>
      <path d="M10.5 22.5V11.5L24 21l13.5-9.5v11L24 32 10.5 22.5z" fill="#EA4335"/>
      <path d="M2 13v4l8.5 5.5V11.5L8.1 10C5.6 8.1 2 9.9 2 13z" fill="#C5221F"/>
    </svg>
  )
  if (id === 'hubspot') return (
    <svg width={s} height={s} viewBox="0 0 50 50" fill="none">
      <circle cx="35" cy="13" r="6" fill="#FF7A59"/>
      <circle cx="35" cy="13" r="3" fill="#fff"/>
      <path d="M28.5 16A13 13 0 1 0 35 27.5M35 27.5V20" stroke="#FF7A59" strokeWidth="3.5" strokeLinecap="round"/>
    </svg>
  )
  if (id === 'linkedin') return (
    <svg width={s} height={s} viewBox="0 0 34 34" fill="none">
      <rect width="34" height="34" rx="4" fill="#0077B5"/>
      <path d="M8 13h4v13H8V13zm2-6.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM15 13h3.8v1.8h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V26h-4v-6.4c0-1.5 0-3.5-2.1-3.5s-2.4 1.6-2.4 3.4V26H15V13z" fill="#fff"/>
    </svg>
  )
  if (id === 'calendar') return (
    <svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      <rect x="4" y="8" width="40" height="36" rx="4" fill="#fff" stroke="#4285F4" strokeWidth="2"/>
      <rect x="4" y="8" width="40" height="12" rx="4" fill="#4285F4"/>
      <rect x="4" y="14" width="40" height="6" fill="#4285F4"/>
      <path d="M16 6v6M32 6v6" stroke="#4285F4" strokeWidth="2.5" strokeLinecap="round"/>
      <text x="24" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill="#4285F4" fontFamily="Arial">G</text>
    </svg>
  )
  if (id === 'zapier') return (
    <svg width={s} height={s} viewBox="0 0 50 50" fill="none">
      <circle cx="25" cy="25" r="25" fill="#FF4A00"/>
      <path d="M25 10v9M25 31v9M10 25h9M31 25h9M14.6 14.6l6.4 6.4M28.9 28.9l6.4 6.4M35.4 14.6l-6.4 6.4M21.1 28.9l-6.4 6.4" stroke="#fff" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="25" cy="25" r="5" fill="#fff"/>
    </svg>
  )
  if (id === 'mailchimp') return (
    <svg width={s} height={s} viewBox="0 0 50 50" fill="none">
      <ellipse cx="25" cy="28" rx="17" ry="14" fill="#FFE01B"/>
      <ellipse cx="25" cy="25" rx="13" ry="10" fill="#241C15"/>
      <circle cx="19" cy="24" r="2.5" fill="#fff"/>
      <circle cx="31" cy="24" r="2.5" fill="#fff"/>
      <circle cx="19.8" cy="24" r="1.2" fill="#241C15"/>
      <circle cx="31.8" cy="24" r="1.2" fill="#241C15"/>
      <path d="M20 29c1 2 9 2 10 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
      <ellipse cx="25" cy="13" rx="5" ry="6" fill="#FFE01B"/>
      <circle cx="25" cy="10" r="3" fill="#241C15"/>
    </svg>
  )
  // fallback
  return <div style={{ width: s, height: s, borderRadius: 8, background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: s * 0.5, color: '#fff', fontWeight: 700 }}>{id[0].toUpperCase()}</div>
}

const INTEGRATIONS = [
  { id: 'gmail',      name: 'Gmail',              color: '#EA4335', desc: 'Import leads from email' },
  { id: 'whatsapp',   name: 'WhatsApp Business',  color: '#25D366', desc: 'Send automated messages' },
  { id: 'slack',      name: 'Slack',              color: '#4A154B', desc: 'Status change notifications' },
  { id: 'calendar',   name: 'Google Calendar',    color: '#4285F4', desc: 'Sync follow-up meetings' },
  { id: 'linkedin',   name: 'LinkedIn Sales Nav', color: '#0077B5', desc: 'Lead enrichment' },
  { id: 'hubspot',    name: 'HubSpot',            color: '#FF7A59', desc: 'Two-way CRM sync' },
  { id: 'zapier',     name: 'Zapier',             color: '#FF4A00', desc: 'Custom automations' },
  { id: 'mailchimp',  name: 'Mailchimp',          color: '#FFE01B', desc: 'Email campaigns' },
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
  bg:          '#111827',
  bgRow:       '#1E2433',
  bgRowHover:  '#252E42',
  bgHeader:    '#0D1117',
  bgGroup:     '#161C2B',
  bgCard:      '#1E2433',
  bgCardHover: '#252E42',
  bgInput:     '#252E42',
  border:      '#2A3347',
  borderLight: '#222C3D',
  text:        '#E2E8F8',
  textSub:     '#8B98BC',
  textDim:     '#3D4B63',
  accent:      '#0073EA',
  accentHover: '#0060CC',
  green:       '#00C875',
  orange:      '#FDAB3D',
  purple:      '#7456C2',
  red:         '#E2445C',
  pink:        '#FF5AC4',
  teal:        '#03C9D7',
  shadow:      '0 8px 32px rgba(0,0,0,.65)',
  shadowSm:    '0 2px 12px rgba(0,0,0,.45)',
  shadowCard:  '0 2px 8px rgba(0,0,0,.4)',
} : {
  bg:          '#F5F6FA',
  bgRow:       '#FFFFFF',
  bgRowHover:  '#EDF2FF',
  bgHeader:    '#FFFFFF',
  bgGroup:     '#F0F2FA',
  bgCard:      '#FFFFFF',
  bgCardHover: '#EDF2FF',
  bgInput:     '#FFFFFF',
  border:      '#D5DAF0',
  borderLight: '#E8EBF8',
  text:        '#1C1F3A',
  textSub:     '#5C6280',
  textDim:     '#A8AECA',
  accent:      '#0073EA',
  accentHover: '#0060CC',
  green:       '#00C875',
  orange:      '#FDAB3D',
  purple:      '#7456C2',
  red:         '#E2445C',
  pink:        '#FF5AC4',
  teal:        '#03C9D7',
  shadow:      '0 8px 32px rgba(20,30,80,.13)',
  shadowSm:    '0 2px 8px rgba(20,30,80,.09)',
  shadowCard:  '0 2px 8px rgba(20,30,80,.09)',
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
    <a href={`mailto:${value}`} style={{ minHeight: 0, lineHeight: '20px', color: '#0073EA', fontSize: 12, textDecoration: 'none', fontFamily: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }}
      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>
      {value}
    </a>
  )
}

function EditableCell({ value, onSave, T, multiline = false, type = 'text', startEditing = false, onDone }) {
  const [editing, setEditingRaw] = useState(startEditing)
  const setEditing = v => { setEditingRaw(v); if (!v) onDone?.() }
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
        ? <a href={`tel:${value}`} onClick={e => e.stopPropagation()} style={{ color: '#0073EA', fontSize: 12, textDecoration: 'none', fontWeight: 600, direction: 'ltr', minHeight: 0, lineHeight: '20px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
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
        ? <a href={`mailto:${value}`} onClick={e => e.stopPropagation()} style={{ color: '#0073EA', fontSize: 12, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', minHeight: 0, lineHeight: '20px' }}
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
  const openNote = useContext(NoteCtx)
  const campaign = leadCampaignTag(lead, lang)
  const last = lastNote(lead)
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
    <div onClick={e => { if (!e.target.closest('button,a,input,textarea,select')) onOpenDetail(lead) }} style={{
      cursor: 'pointer',
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
        <WaFace phone={lead.phone} name={lead.name} size={40} lang={lang}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: `linear-gradient(135deg, ${avatarColor(lead.name)}, ${avatarColor(lead.name)}AA)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, fontWeight: 800, color: '#fff', flexShrink: 0,
          boxShadow: `0 2px 8px ${avatarColor(lead.name)}44`,
        }}>
          {(lead.name || '?')[0].toUpperCase()}
        </div>
        </WaFace>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.name || '—'}{campaign && <span style={{ fontSize: 12, fontWeight: 500, color: T.textSub, marginInlineStart: 6 }}>(<bdi>{campaign}</bdi>)</span>}
          </div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <StatusBadge value={lead.leadStatus || 'new'} lang={lang} T={T} onClick={e => { e.stopPropagation(); onStatusClick(e, lead) }} />
            <WelcomeMark lead={lead} lang={lang}/>
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
            {prettyLeadText(lead.msg, lang)}
          </div>
        </div>
      )}

      {last && (
        <div onClick={() => openNote?.(lead)} style={{ marginTop: 8, padding: '8px 10px', background: T.bg, borderRadius: 8, border: `1px solid ${T.borderLight}`, fontSize: 12.5, color: T.text, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
          📝 {last.text}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>   {/* 2 × 2 on a phone: four buttons in one row overflowed */}
        {lead.phone && (
          <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
            style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: T.accent + '14', border: `1px solid ${T.accent}30`, borderRadius: 10, color: T.accent, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <Phone size={14} /> {lang === 'en' ? 'Call' : 'התקשר'}
          </a>
        )}
        {lead.phone && onOpenChat && (
          <button onClick={e => { e.stopPropagation(); onOpenChat(lead) }}
            style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: '#25D36614', border: '1px solid #25D36630', borderRadius: 10, color: '#25D366', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <MessageSquare size={14} /> WhatsApp
          </button>
        )}
        {openNote && (
          <button onClick={e => { e.stopPropagation(); openNote(lead) }}
            style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: '#A25DDC14', border: '1px solid #A25DDC33', borderRadius: 10, color: '#A25DDC', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Pencil size={14} /> {lang === 'en' ? 'Note' : 'סיכום'}
          </button>
        )}
        <button onClick={() => onOpenDetail(lead)}
          style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', background: 'none', border: `1px solid ${T.border}`, borderRadius: 10, color: T.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <ExternalLink size={14} /> {lang === 'en' ? 'Details' : 'פרטים'}
        </button>
      </div>
    </div>
  )
}

// ─── mobile group section ─────────────────────────────────────────────────────

function MobileGroupSection({ group, leads, lang, T, onUpdate, onDelete, onOpenDetail, onStatusClick, onOpenChat, onAddRow }) {
  const [collapsed, setCollapsed] = useState(!!group.collapsedByDefault)
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

// A selected row reads at a glance in both themes
const SEL_BG = T => (T.bg === '#111827' ? '#16233C' : '#EAF2FE')

// ─── desktop sortable row ─────────────────────────────────────────────────────

function SortableRow({ lead, cols, onUpdate, onDelete, onSelect, isSelected, lang, T, onOpenDetail, onStatusClick, onOpenChat, onEnrich }) {
  const [renaming, setRenaming] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const [hovered, setHovered] = useState(false)

  const statusColor = getGroupColor(lead.leadStatus || 'new')
  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    display: 'flex', alignItems: 'stretch',
    borderBottom: `1px solid ${T.borderLight}`,
    background: isSelected ? SEL_BG(T) : hovered ? T.bgRowHover : T.bgRow,
    transition: `background .1s${transition ? ', ' + transition : ''}`,
    cursor: isDragging ? 'grabbing' : 'default',
    minHeight: 44,
    position: 'relative',
  }

  const getCellValue = (col) => {
    switch (col.id) {
      case 'name':       return lead.name || ''
      case 'msg':        return prettyLeadText(lead.msg || '', lang)
      case 'phone':      return lead.phone || ''
      case 'email':      return lead.email || ''
      case 'leadStatus': return lead.leadStatus || 'new'
      case 'property':   return lead.propTitle || ''
      case 'location':   return lead.propLocation || ''
      case 'source':     return lead.source || (String(lead.id).startsWith('meta_') ? 'meta' : 'website')
      case 'intent':     return lead.enrichment?.intent || ''
      case 'date':       return fmtDate(lead.ts)
      default:           return lead[col.id] || lead.customData?.[col.id] || ''
    }
  }

  const handleUpdate = (col, val) => {
    if (col.id === 'name') onUpdate(lead.id, { name: val })
    else if (col.id === 'property') onUpdate(lead.id, { propTitle: val })
    else if (col.id === 'location') onUpdate(lead.id, { propLocation: val })
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
      ...(col.pinned ? { position: 'sticky', insetInlineStart: 60, zIndex: 2, background: isSelected ? SEL_BG(T) : hovered ? T.bgRowHover : T.bgRow } : {}),
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
      case 'source':
        return (
          <div key={col.id} style={cellStyle}>
            <span title={val} style={{ fontSize: 11, fontWeight: 700, color: sourceColor(val), background: sourceColor(val) + '18', border: `1px solid ${sourceColor(val)}44`, borderRadius: 20, padding: '2px 9px', whiteSpace: 'nowrap' }}>
              {sourceLabel(val, lang)}
            </span>
          </div>
        )
      case 'notes':
        return (
          <div key={col.id} style={{ ...cellStyle }}>
            <EditableCell value={val} T={T} multiline onSave={v => handleUpdate(col, v)} />
          </div>
        )
      case 'text':
      default:
        if (col.id === 'name') {
          const camp = leadCampaignTag(lead, lang)
          // a click on the name opens the lead card (details, notes, tasks, the chat, every action); ✎ renames in place
          return (
            <div key={col.id} style={{ ...cellStyle, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <WaFace phone={lead.phone} name={lead.name} size={28} lang={lang}>
                <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor(lead.name) + '26', color: avatarColor(lead.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{[...(lead.name || '?').trim()][0] || '?'}</span>
              </WaFace>
              <div style={{ flex: '0 1 auto', minWidth: 0 }}>
                {renaming
                  ? <EditableCell value={val} T={T} startEditing onDone={() => setRenaming(false)} onSave={v => handleUpdate(col, v)} />
                  : <button type="button" className="lb-name-link" onClick={() => onOpenDetail(lead)} title={lang === 'en' ? 'Open the lead card' : 'פתיחת כרטיס הליד'}>{val || '—'}</button>}
              </div>
              {!renaming && hovered && <button type="button" className="lb-name-pen" onClick={() => setRenaming(true)} aria-label={lang === 'en' ? 'Rename' : 'שינוי שם'} title={lang === 'en' ? 'Rename' : 'שינוי שם'}><Pencil size={12}/></button>}
              {!renaming && <WelcomeMark lead={lead} lang={lang} compact/>}
              {camp && <span title={leadCampaignFull(lead, lang)} style={{ flex: '1 1 0', minWidth: 0, fontSize: 11.5, fontWeight: 500, color: T.textSub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>(<bdi>{camp}</bdi>)</span>}
            </div>
          )
        }
        return (
          <div key={col.id} style={{ ...cellStyle }}>
            <EditableCell value={val} T={T} onSave={v => handleUpdate(col, v)} />
          </div>
        )
    }
  }

  return (
    <div ref={setNodeRef} style={style}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {/* Checkbox (always there, so a row can be picked) + drag handle on hover */}
      <div className="lb-selcol" style={{ background: isSelected ? SEL_BG(T) : hovered ? T.bgRowHover : T.bgRow, borderInlineEnd: `1px solid ${T.borderLight}`, boxShadow: isSelected ? 'inset -3px 0 0 #0073EA' : 'none' }}>
        <div {...listeners} {...attributes} className="lb-grip" aria-label={lang === 'en' ? 'Drag' : 'גרור'} style={{ color: T.textDim, visibility: hovered ? 'visible' : 'hidden' }}>
          <GripVertical size={13} />
        </div>
        <CheckBox checked={!!isSelected} onChange={(on, shift) => onSelect(lead.id, on, shift)} size={18}
          label={(lang === 'en' ? 'Select ' : 'בחר את ') + (lead.name || '')} />
      </div>

      {cols.map(col => renderCell(col))}

      {/* Row actions: a zero-width anchor stuck to the visible far end of the row, so they never cover the checkbox or the name */}
      {hovered && (
        <div style={{ position: 'sticky', insetInlineEnd: 0, width: 0, flexShrink: 0, zIndex: 10 }}>
        <div style={{ position: 'absolute', insetInlineEnd: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4, background: T.bgRow, borderRadius: 8, padding: '2px 4px', boxShadow: T.shadowSm, border: `1px solid ${T.borderLight}`, whiteSpace: 'nowrap' }}>
          {onEnrich && (
            lead.enrichment?.status === 'enriching'
              ? <button style={{ background: 'none', border: 'none', color: '#7456C2', cursor: 'default', padding: '5px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }} title="AI מעבד...">
                  <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                </button>
              : <button onClick={() => onEnrich(lead)} title="AI Enrichment"
                  style={{ background: 'none', border: 'none', color: '#7456C2', cursor: 'pointer', padding: '5px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#7456C218'}
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
        </div>
      )}
    </div>
  )
}

// ─── desktop board group ──────────────────────────────────────────────────────

function BoardGroup({ group, leads, cols, onUpdate, onUpdateStatus, onDelete, onSelect, selectedIds, onSelectMany, lang, T, onOpenDetail, onAddRow, onStatusClick, onOpenChat, onEnrich, onRenameStage }) {
  const selCount = selectedIds ? leads.filter(l => selectedIds.has(l.id)).length : 0
  const allSel = leads.length > 0 && selCount === leads.length
  const [collapsed, setCollapsed] = useState(!!group.collapsedByDefault)
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
      <div style={{ display: 'flex', alignItems: 'center', minHeight: 44, paddingInlineEnd: 10, borderBottom: `2px solid ${color}22`, userSelect: 'none', background: `linear-gradient(90deg, ${color}12 0%, ${T.bgGroup} 60%)`, position: 'sticky', top: 36, zIndex: 4 }}>
        {/* the same 60 px column as the rows' checkboxes, so every checkbox sits on one line */}
        <div className="lb-selcol lb-selcol-group">
          <span aria-hidden="true" style={{ position: 'absolute', insetInlineStart: 0, top: 6, bottom: 6, width: 4, borderRadius: 4, background: color }}/>
          {onSelectMany && leads.length > 0 && <CheckBox checked={allSel} indeterminate={selCount > 0} size={18} color={color}
            onChange={on => onSelectMany(leads.map(l => l.id), on)}
            label={(lang === 'en' ? 'Select all in ' : 'בחר את כל ') + label} />}
        </div>
        <button onClick={() => setCollapsed(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color, display: 'flex', alignItems: 'center', padding: '0 4px 0 0' }}>
          <ChevronDown size={14} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }} />
        </button>
        <span style={{ marginRight: 7, display: 'inline-flex', maxWidth: 260 }}><StageTitle group={group} lang={lang} color={color} onRename={onRenameStage} size={12}/></span>
        <span style={{ fontSize: 11, background: color, color: '#fff', borderRadius: 20, padding: '1px 8px', fontWeight: 800, marginRight: 8, minWidth: 20, textAlign: 'center' }}>{leads.length}</span>
        <div style={{ flex: 1 }} />
      </div>

      {!collapsed && (
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <SortableRow key={lead.id} lead={lead} cols={cols} T={T} lang={lang}
              onUpdate={onUpdate} onDelete={onDelete} onSelect={onSelect} isSelected={selectedIds?.has(lead.id)}
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
          <div style={{ width: 48, flexShrink: 0 }} />
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
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 800, backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
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
          <WaFace phone={lead.phone} name={lead.name} size={44} lang={lang}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: `linear-gradient(135deg, ${avatarColor(lead.name)}, ${avatarColor(lead.name)}BB)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: `0 3px 12px ${avatarColor(lead.name)}44` }}>
            {(lead.name || '?')[0].toUpperCase()}
          </div>
          </WaFace>
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
            { label: 'מיקום הנכס', en: 'Property location', key: 'propLocation', type: 'text' },
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

          {/* Where the lead came from — source, form answers (Meta), page / referrer / UTM (website) */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              {lang === 'en' ? 'Source' : 'מקור הליד'}
            </div>
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(() => { const src = lead.source || (String(lead.id).startsWith('meta_') ? 'meta' : 'website'); return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sourceColor(src), background: sourceColor(src) + '18', border: `1px solid ${sourceColor(src)}44`, borderRadius: 20, padding: '2px 9px' }}>{sourceLabel(src, lang)}</span>
                  {lead.campaignName && <span style={{ fontSize: 12, color: T.textSub }}>{lang === 'en' ? 'Campaign' : 'קמפיין'}: {lead.campaignName}</span>}
                  {lead.formName && <span style={{ fontSize: 12, color: T.textSub }}>{lang === 'en' ? 'Form' : 'טופס'}: {lead.formName}</span>}
                </div>
              ) })()}
              {Array.isArray(lead.formAnswers) && lead.formAnswers.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.textSub, marginBottom: 4 }}>{lang === 'en' ? 'Form answers' : 'תשובות מהטופס'}</div>
                  {lead.formAnswers.map((x, i) => (
                    <div key={i} style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}><span style={{ color: T.textSub }}>{x.q}:</span> {x.a}</div>
                  ))}
                </div>
              )}
              {originLines(lead.origin, lang).length > 0 && (
                <div>
                  {originLines(lead.origin, lang).map((x, i) => (
                    <div key={i} style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5, direction: 'ltr', textAlign: lang === 'en' ? 'left' : 'right', wordBreak: 'break-all' }}><span style={{ color: T.textDim }}>{x.q}:</span> {x.a}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI Enrichment section */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#7456C2' }}>✦</span> AI Enrichment
              {onEnrich && (
                lead.enrichment?.status === 'enriching'
                  ? <span style={{ marginLeft: 'auto', fontSize: 11, color: '#7456C2', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> מעבד...
                    </span>
                  : <button onClick={() => onEnrich(lead)} style={{ marginLeft: 'auto', background: '#7456C214', border: '1px solid #7456C244', borderRadius: 6, color: '#7456C2', fontSize: 11, fontWeight: 700, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✦ {lead.enrichment ? (lang === 'en' ? 'Re-enrich' : 'רענן AI') : (lang === 'en' ? 'Enrich' : 'נתח AI')}
                    </button>
              )}
            </div>
            {lead.enrichment && lead.enrichment.status !== 'enriching' ? (
              <div style={{ background: T.bg, border: `1px solid #7456C233`, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lead.enrichment.notes && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7456C2', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{lang === 'en' ? 'Pre-Call Brief' : 'תדריך לשיחה'}</div>
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
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7456C2', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{lang === 'en' ? 'Talking Points' : 'נקודות שיחה'}</div>
                    {lead.enrichment.talkingPoints.map((pt, i) => (
                      <div key={i} style={{ fontSize: 12, color: T.text, padding: '3px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span style={{ color: '#7456C2', flexShrink: 0 }}>•</span>{pt}
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
                      <span key={tag} style={{ fontSize: 11, background: '#7456C214', color: '#7456C2', borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>{tag}</span>
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

// ─── kanban card ──────────────────────────────────────────────────────────────

// ─── call summary / quick note ────────────────────────────────────────────────
// One tap from any card: what came up in the call, how it ended, when to call back. Saved into the lead's
// notes (crm_data.notes — the same list the lead card shows) and, when it says so, moves the lead's stage.

const NoteCtx = createContext(null)
// Selection shared by the table and the Pipeline cards ({ has(id), toggle(id, on, shift) })
const SelCtx = createContext(null)

// A checkbox that is always visible (a native one is hidden by the admin's input reset): a real input for keyboard / screen
// readers, drawn as a rounded box; indeterminate = some selected
export function CheckBox({ checked, indeterminate = false, onChange, label, size = 18, color = '#0073EA', className = '' }) {
  return (
    <label className={`lb-check ${className}`} style={{ '--ck': color, '--cks': `${size}px` }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
      <input type="checkbox" checked={!!checked} aria-label={label} ref={el => { if (el) el.indeterminate = !!indeterminate && !checked }}
        onChange={e => onChange?.(e.target.checked, !!e.nativeEvent?.shiftKey)}/>
      <span aria-hidden="true">{checked ? <Check size={size - 6} strokeWidth={3.2}/> : indeterminate ? <Minus size={size - 6} strokeWidth={3.2}/> : null}</span>
    </label>
  )
}
export const LB_CSS = `
  .lb-selcol{width:60px;flex-shrink:0;align-self:stretch;display:flex;align-items:center;justify-content:center;position:sticky;inset-inline-start:0;z-index:3;transition:background .1s}
  .lb-selcol-group{background:transparent;z-index:1}
  .lb-grip{position:absolute;inset-inline-end:3px;top:50%;transform:translateY(-50%);cursor:grab;display:flex;align-items:center}
  .lb-name-link{border:none;background:none;padding:2px 0;margin:0;font:inherit;font-size:13.5px;font-weight:700;color:var(--au-text,#1b1f3b);cursor:pointer;text-align:start;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;border-radius:4px;min-height:0}
  .lb-name-link:hover{color:var(--au-brand-text,#3F4EB0);text-decoration:underline;text-underline-offset:3px}
  .lb-name-link:focus-visible{outline:2px solid var(--au-brand,#3F4EB0);outline-offset:2px}
  .lb-name-pen{flex:none;border:none;background:rgba(var(--ov,0,0,0),.06);color:var(--au-text3,#667);width:24px;height:24px;min-height:0;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
  .lb-name-pen:hover{color:var(--au-brand-text,#3F4EB0);background:rgba(var(--brand-rgb,63,78,176),.12)}
  .lb-check{position:relative;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;width:calc(var(--cks) + 10px);height:calc(var(--cks) + 10px);border-radius:8px}
  .lb-check:hover{background:rgba(var(--ink,40,50,90),.06)}
  .lb-check input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer;width:100%;height:100%}
  .lb-check span{width:var(--cks);height:var(--cks);border-radius:6px;border:2px solid rgba(var(--ink,40,50,90),.42);box-shadow:0 1px 2px rgba(0,0,0,.06);background:var(--au-card,#fff);display:flex;align-items:center;justify-content:center;color:#fff;transition:background .12s,border-color .12s;pointer-events:none}
  .lb-check:hover span{border-color:var(--ck)}
  .lb-check input:checked+span,.lb-check input:indeterminate+span{background:var(--ck);border-color:var(--ck)}
  .lb-check input:focus-visible+span{outline:2px solid var(--ck);outline-offset:2px}
  .lb-seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:rgba(var(--ov,28,36,90),.06)}
  .lb-seg button{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 14px;border:none;border-radius:8px;background:transparent;color:var(--au-text2,#5E6378);font:inherit;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .12s,color .12s;min-height:0}
  .lb-seg button:hover{color:var(--au-text,#1F2433)}
  .lb-seg button[aria-selected=true]{background:var(--au-card,#fff);color:var(--au-text,#1F2433);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08),0 1px 6px rgba(0,0,0,.05)}
  .lb-tb{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--au-line,#E2E5EF);background:var(--au-card,#fff);color:var(--au-text2,#5E6378);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .12s,color .12s,border-color .12s;min-height:0}
  .lb-tb:hover:not(:disabled){color:var(--au-text,#1F2433);border-color:rgba(var(--brand-rgb,63,73,166),.45)}
  .lb-tb:disabled{opacity:.55;cursor:default}
  .lb-tb .n{min-width:18px;height:18px;padding:0 5px;border-radius:9px;font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;background:rgba(var(--ink,40,50,90),.1);color:var(--au-text,#1F2433)}
  .lb-tb.danger .n{background:#E2445C;color:#fff}
  .lb-card{transition:box-shadow .15s,border-color .15s,background .15s}
  .lb-card:hover{border-color:rgba(var(--brand-rgb,63,73,166),.35)!important;box-shadow:0 4px 14px rgba(20,30,80,.08)!important}
  .lb-card .lb-check{opacity:.55;transition:opacity .12s}
  .lb-card:hover .lb-check,.lb-card.sel .lb-check,.lb-card .lb-check:focus-within{opacity:1}
  .lb-acts{display:flex;align-items:center;gap:2px}
  .lb-wl{display:inline-flex;align-items:center;gap:4px;flex-shrink:0;height:24px;padding:0 9px 0 7px;border-radius:999px;font-size:11.5px;font-weight:700;line-height:1;white-space:nowrap;cursor:default}
  .lb-wl.ok{color:#12804A;background:rgba(37,211,102,.14);box-shadow:inset 0 0 0 1px rgba(37,211,102,.38)}
  .lb-wl.bad{color:#B45309;background:rgba(245,158,11,.13);box-shadow:inset 0 0 0 1px rgba(245,158,11,.4)}
  .lb-wl.compact{width:24px;height:24px;padding:0;justify-content:center}
  html[data-admin-theme=dark] .lb-wl.ok{color:#4ADE80}
  html[data-admin-theme=dark] .lb-wl.bad{color:#FBBF24}
  .lb-act{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:30px;min-width:30px;padding:0 8px;border:none;border-radius:8px;background:transparent;color:var(--au-text2,#5E6378);font:inherit;font-size:12px;font-weight:500;cursor:pointer;text-decoration:none;transition:background .12s,color .12s;min-height:0}
  .lb-act:hover{background:rgba(var(--ov,28,36,90),.07);color:var(--au-text,#1F2433)}
  .lb-act.call:hover{color:#0073EA;background:rgba(0,115,234,.09)}
  .lb-act.wa:hover{color:#1FA855;background:rgba(37,211,102,.1)}
  .lb-act.note:hover{color:#8B5CF6;background:rgba(139,92,246,.1)}
  .lb-act.del{color:var(--au-text3,#8A90A6);opacity:0;transition:opacity .12s}
  .lb-card:hover .lb-act.del,.lb-act.del:focus-visible{opacity:1}
  .lb-act.del:hover{color:#E2445C;background:rgba(226,68,92,.09)}
`
const asNoteList = n => (Array.isArray(n) ? n : typeof n === 'string' && n.trim() ? [{ id: 'legacy', text: n, ts: 0 }] : [])
const lastNote = lead => asNoteList(lead.notes).filter(n => n.text).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || null
const CALL_OUTCOMES = [
  { id: 'answered',     he: 'דיברנו',        en: 'We talked',          color: '#00C875', icon: '✅' },
  { id: 'no_answer',    he: 'לא ענה',        en: 'No answer',          color: '#FDAB3D', icon: '📵' },
  { id: 'callback',     he: 'ביקש שנחזור',   en: 'Call back',          color: '#0073EA', icon: '🔁' },
  { id: 'not_relevant', he: 'לא רלוונטי',    en: 'Not relevant',       color: '#64748B', icon: '🚫' },
]
const localDT = d => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16) }
const at10 = days => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(10, 0, 0, 0); return localDT(d) }
const fmtNoteTs = (ts, lang) => ts ? new Date(ts).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

// The WhatsApp welcome mark on every lead (pipeline card, table, phone card): a green double check once the opening message
// went out (the automation, the Lead Center's first send, the missed-welcome queue — welcomeState()), an amber one when it
// failed — so a glance says whether to call or to write before anyone does either.
function WelcomeMark({ lead, lang, compact = false }) {
  const w = welcomeState(lead)
  if (!w) return null
  const en = lang === 'en', ok = w.state === 'sent'
  const when = w.at ? fmtNoteTs(w.at, lang) : ''
  const tip = ok ? (en ? `WhatsApp welcome sent${when ? ` · ${when}` : ''}` : `נשלחה הודעת פתיחה בוואטסאפ${when ? ` · ${when}` : ''}`)
    : (en ? 'The WhatsApp welcome did not go out' : 'הודעת הפתיחה בוואטסאפ לא נשלחה')
  return (
    <span className={`lb-wl ${ok ? 'ok' : 'bad'}${compact ? ' compact' : ''}`} title={tip} aria-label={tip} role="img">
      {ok ? <CheckCheck size={14} strokeWidth={2.6}/> : <AlertCircle size={13} strokeWidth={2.4}/>}
      {!compact && <span>{ok ? (en ? 'Sent' : 'נשלחה') : (en ? 'Not sent' : 'לא נשלחה')}</span>}
    </span>
  )
}

function CallNoteDialog({ lead, T, isDark, lang, onClose, updateLead, updateLeadStatus }) {
  ensureFuCss()
  const en = lang === 'en'
  const campaign = leadCampaignTag(lead, lang)
  const [outcome, setOutcome] = useState('')
  const [text, setText] = useState('')
  const [followUp, setFollowUp] = useState(lead.followUp || '')
  const [remind, setRemind] = useState(true)   // a WhatsApp reminder to the office when the follow-up is due (lib/follow-up.js)
  const [saving, setSaving] = useState(false)
  const notes = asNoteList(lead.notes)
  const recent = [...notes].filter(n => n.text).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 4)
  const oc = CALL_OUTCOMES.find(o => o.id === outcome)
  const canSave = !!(text.trim() || outcome)
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k)
  }, [onClose])

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const body = [oc ? `${oc.icon} ${en ? oc.en : oc.he}` : '', text.trim()].filter(Boolean).join(' · ')
    const note = { id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text: body, ts: Date.now(), kind: 'call', ...(outcome ? { outcome } : {}) }
    const patch = { notes: [...notes.filter(n => n.id !== 'legacy' || n.text), note], lastCallAt: Date.now() }
    if (followUp !== (lead.followUp || '')) Object.assign(patch, remind || !followUp ? setNextFollowUp(lead, followUp) : { followUp })
    if (outcome === 'no_answer') patch.noAnswerCount = (Number(lead.noAnswerCount) || 0) + 1
    await updateLead(lead.id, patch)
    const stage = lead.leadStatus || 'new'
    if (outcome === 'not_relevant' && stage !== 'irrelevant') updateLeadStatus(lead, 'irrelevant')
    else if (outcome === 'answered' && stage === 'new') updateLeadStatus(lead, 'contacted')
    setSaving(false)
    onClose(true)
  }

  const chip = (on, color) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${on ? color : (isDark ? '#2A3347' : '#D8DCF0')}`, background: on ? `${color}22` : 'transparent', color: on ? color : T.textSub })
  return (
    <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={en ? 'Call summary' : 'סיכום שיחה'} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', background: isDark ? '#161E2E' : '#FFFFFF', border: `1px solid ${isDark ? '#2A3347' : '#D8DCF0'}`, borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,.45)', direction: en ? 'ltr' : 'rtl', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <WaFace phone={lead.phone} name={lead.name} size={38} lang={lang}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg, ${avatarColor(lead.name)}, ${avatarColor(lead.name)}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, flexShrink: 0 }}>{(lead.name || '?')[0].toUpperCase()}</div>
          </WaFace>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{en ? 'Call summary' : 'סיכום שיחה'} · {lead.name || '—'}{campaign && <span style={{ fontSize: 12.5, fontWeight: 500, color: T.textSub, marginInlineStart: 6 }}>(<bdi>{campaign}</bdi>)</span>}</div>
            <div style={{ fontSize: 12, color: T.textSub, direction: 'ltr', textAlign: en ? 'left' : 'right' }}>{lead.phone || ''}{lead.propTitle ? ` · ${lead.propTitle}` : ''}</div>
          </div>
          {lead.phone && <a href={`tel:${lead.phone}`} style={{ ...chip(false, T.accent), color: T.accent, textDecoration: 'none' }}><Phone size={12}/> {en ? 'Call' : 'חייג'}</a>}
          <button onClick={() => onClose()} aria-label={en ? 'Close' : 'סגור'} style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', padding: 4 }}><X size={18}/></button>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub, marginBottom: 7 }}>{en ? 'How did it go?' : 'איך הסתיימה השיחה?'}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
          {CALL_OUTCOMES.map(o => (
            <button key={o.id} type="button" onClick={() => { setOutcome(v => v === o.id ? '' : o.id); if (o.id === 'callback' && !followUp) setFollowUp(at10(1)) }} style={chip(outcome === o.id, o.color)} aria-pressed={outcome === o.id}>
              <span>{o.icon}</span>{en ? o.en : o.he}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub, marginBottom: 7 }}>{en ? 'What came up' : 'מה עלה בשיחה'}</div>
        <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={5}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save() } }}
          placeholder={en ? 'What they are looking for, budget, area, timing, objections, next step… (Ctrl+Enter saves)' : 'מה מחפש, תקציב, אזור, לוח זמנים, התנגדויות, מה הצעד הבא… (Ctrl+Enter לשמירה)'}
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: isDark ? '#0F1623' : '#F6F7FC', border: `1px solid ${isDark ? '#2A3347' : '#D8DCF0'}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, lineHeight: 1.6, color: T.text, fontFamily: 'inherit', outline: 'none', direction: en ? 'ltr' : 'rtl' }}/>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', margin: '12px 0 4px' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.textSub }}>{en ? 'Next follow-up' : 'לחזור אליו'}</span>
          {[[1, en ? 'Tomorrow' : 'מחר'], [2, en ? 'In 2 days' : 'עוד יומיים'], [7, en ? 'In a week' : 'עוד שבוע']].map(([d, l]) => (
            <button key={d} type="button" onClick={() => setFollowUp(at10(d))} style={{ ...chip(followUp === at10(d), '#0073EA'), padding: '5px 10px', fontSize: 12 }}>{l}</button>
          ))}
          <DateTimePicker value={followUp} onChange={setFollowUp} format="local" lang={lang} presets={followUpPresets(Date.now(), lang)} size="sm" label={en ? 'Next follow-up' : 'לחזור אליו'} placeholder={en ? 'Other date…' : 'תאריך אחר…'}/>
        </div>
        {followUp && (
          <label className="fu-bell" style={{ marginTop: 6 }}>
            <input type="checkbox" checked={remind} onChange={e => setRemind(e.target.checked)}/>
            <span className="fu-sw" aria-hidden="true"/>
            {en ? 'Remind me on WhatsApp when it is due' : 'תזכורת בוואטסאפ כשמגיע הזמן'}
          </label>
        )}
        {outcome === 'not_relevant' && <div style={{ fontSize: 12, color: T.textSub, marginTop: 6 }}>{en ? 'The lead moves to “Not relevant”.' : 'הליד יעבור לעמודה "לא רלוונטי".'}</div>}
        {outcome === 'answered' && (lead.leadStatus || 'new') === 'new' && <div style={{ fontSize: 12, color: T.textSub, marginTop: 6 }}>{en ? 'The lead moves to “Contacted”.' : 'הליד יעבור לשלב הבא (נוצר קשר).'}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={save} disabled={!canSave || saving}
            style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: canSave ? 'linear-gradient(135deg, #0073EA, #0060CC)' : (isDark ? '#252E42' : '#E4E7F4'), color: canSave ? '#fff' : T.textSub, fontSize: 14, fontWeight: 800, cursor: canSave ? 'pointer' : 'default', fontFamily: 'inherit' }}>
            {saving ? (en ? 'Saving…' : 'שומר…') : (en ? 'Save summary' : 'שמור סיכום')}
          </button>
          <button type="button" onClick={() => onClose()} style={{ padding: '11px 18px', borderRadius: 10, border: `1px solid ${isDark ? '#2A3347' : '#D8DCF0'}`, background: 'none', color: T.textSub, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{en ? 'Cancel' : 'ביטול'}</button>
        </div>

        {recent.length > 0 && (
          <div style={{ marginTop: 18, borderTop: `1px solid ${isDark ? '#2A3347' : '#E4E7F4'}`, paddingTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textSub, marginBottom: 8 }}>{en ? 'Earlier notes' : 'הערות קודמות'} ({notes.filter(n => n.text).length})</div>
            {recent.map(n => (
              <div key={n.id} style={{ fontSize: 13, color: T.text, lineHeight: 1.55, padding: '7px 10px', marginBottom: 6, borderRadius: 8, background: isDark ? '#0F1623' : '#F6F7FC', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {n.ts ? <span style={{ fontSize: 11, color: T.textSub, marginInlineEnd: 8 }}>{fmtNoteTs(n.ts, lang)}</span> : null}{n.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanCard({ lead, T, isDark, lang, onOpen, onDelete, onOpenChat, onEnrich, mergeHint }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: 'card', groupId: lead.leadStatus || 'new' },
  })
  const color = getGroupColor(lead.leadStatus || 'new')
  const score = getScoreOpt(lead.enrichment?.intent)
  const openNote = useContext(NoteCtx)
  const sel = useContext(SelCtx)
  const selected = !!sel?.has(lead.id)
  const last = lastNote(lead)
  const campaign = leadCampaignTag(lead, lang)
  const fu = lead.followUp && Date.parse(lead.followUp)
  const en = lang === 'en'
  const src = lead.source || (String(lead.id).startsWith('meta_') ? 'meta' : 'website')
  const av = avatarColor(lead.name)
  const initials = String(lead.name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?'
  const phone = (() => { const d = String(lead.phone || '').replace(/\D/g, ''); const l = d.startsWith('972') ? '0' + d.slice(3) : d; return l.length === 10 ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : lead.phone })()
  // A plain click opens the lead card; a drag (≥ 8px, the sensor's activation distance) only moves it
  const downAt = useRef(null)
  const line = isDark ? 'rgba(255,255,255,.08)' : 'rgba(20,30,80,.09)'

  return (
    <div ref={setNodeRef} className={`lb-card${selected ? ' sel' : ''}`}
      onPointerDownCapture={e => { downAt.current = { x: e.clientX, y: e.clientY } }}
      onClick={e => {
        const d = downAt.current
        if (e.target.closest('button,a,input,textarea,select,label')) return
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
        onOpen(lead)
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition || undefined,
        opacity: isDragging ? 0.15 : 1,
        background: selected ? (isDark ? '#16233C' : '#F2F7FF') : (isDark ? '#1A2233' : '#FFFFFF'),
        border: `1px solid ${selected ? '#0073EA' : line}`,
        borderRadius: 12,
        padding: '12px 12px 8px',
        marginBottom: 8,
        cursor: isDragging ? 'grabbing' : 'pointer',
        boxShadow: isDragging ? 'none' : isDark ? '0 1px 2px rgba(0,0,0,.35)' : '0 1px 2px rgba(20,30,80,.06)',
        direction: en ? 'ltr' : 'rtl',
        position: 'relative',
        ...(mergeHint ? { outline: '2px dashed #0073EA', outlineOffset: 3, background: isDark ? '#16233C' : '#EAF2FE' } : {}),
        userSelect: 'none',
        touchAction: 'none',
        willChange: 'transform',
      }}
      {...attributes} {...listeners}>

      {mergeHint && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 9, padding: '6px 8px', borderRadius: 8, background: '#0073EA', color: '#fff', fontSize: 12, fontWeight: 700 }}>
          <Link2 size={12}/> {en ? 'Release to merge' : 'שחרר כדי למזג'}
        </div>
      )}

      {/* name row: avatar · name + phone · score · select */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <WaFace phone={lead.phone} name={lead.name} size={34} lang={lang}>
        <div aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: av + (isDark ? '33' : '1F'), color: av, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, letterSpacing: '.02em' }}>{initials}</div>
        </WaFace>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }} title={lead.name || ''}>{lead.name || '—'}</div>
          {lead.phone && <div style={{ fontSize: 12, color: T.textSub, direction: 'ltr', textAlign: en ? 'left' : 'right', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{phone}</div>}
        </div>
        {lead.enrichment?.version === 2 && (() => {
          const g = lead.enrichment.grade, c = { hot: '#E5484D', warm: '#E5930A', cool: '#3B82F6', cold: '#8A90A6' }[g] || '#8A90A6'
          return <span title={en ? 'Lead score' : 'ציון ליד'} style={{ flexShrink: 0, height: 22, padding: '0 7px', borderRadius: 6, background: `${c}18`, color: c, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{lead.enrichment.score100}</span>
        })()}
        {sel && <CheckBox checked={selected} onChange={(on, shift) => sel.toggle(lead.id, on, shift)} label={(en ? 'Select ' : 'בחירת ') + (lead.name || '')} size={18} className="lb-card-check"/>}
      </div>

      {/* tags: campaign · source · intent */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 9 }}>
        {campaign && <span title={leadCampaignFull(lead, lang)} style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 500, color: T.text, background: isDark ? 'rgba(255,255,255,.06)' : '#F1F3F9', borderRadius: 6, padding: '2px 8px' }}><bdi>{campaign}</bdi></span>}
        {campaign !== sourceLabel(src, lang) && <span title={sourceLabel(src, lang)} style={{ fontSize: 11.5, fontWeight: 500, color: sourceColor(src), display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: sourceColor(src) }}/>{sourceLabel(src, lang)}</span>}
        {score && <span style={{ fontSize: 11.5, fontWeight: 600, color: score.color, background: score.bg, borderRadius: 6, padding: '2px 8px' }}>{en ? score.en : score.l}</span>}
      </div>

      {/* property (when it isn't the campaign) or the message */}
      {lead.propTitle && lead.propTitle !== campaign && lead.propTitle !== leadCampaignFull(lead, lang) ? (
        <div style={{ fontSize: 12.5, color: T.textSub, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.propTitle}</div>
      ) : lead.msg ? (
        <div style={{ fontSize: 12.5, color: T.textSub, marginTop: 8, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{prettyLeadText(lead.msg, lang)}</div>
      ) : null}

      {/* last note + next follow-up */}
      {(last || fu) && (
        <div onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); openNote?.(lead) }} title={last?.text || ''}
          style={{ marginTop: 9, padding: '7px 9px', borderRadius: 8, background: isDark ? 'rgba(255,255,255,.04)' : '#F7F8FC', borderInlineStart: `2px solid ${isDark ? 'rgba(255,255,255,.14)' : '#D9DDEA'}`, cursor: 'text' }}>
          {last && <div style={{ fontSize: 12.5, color: T.text, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{last.text}</div>}
          {fu && <div style={{ marginTop: last ? 5 : 0, fontSize: 11.5, fontWeight: 600, color: fu < Date.now() ? '#E2445C' : T.textSub, display: 'flex', alignItems: 'center', gap: 5 }}><Clock size={12}/>{en ? 'Follow up' : 'לחזור'} · {fmtNoteTs(fu, lang)}</div>}
        </div>
      )}

      {/* footer: date · quiet icon actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10, paddingTop: 6, borderTop: `1px solid ${line}` }} onPointerDown={e => e.stopPropagation()}>
        <span style={{ fontSize: 11.5, color: T.textDim, fontVariantNumeric: 'tabular-nums', flex: 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} aria-hidden="true"/>{fmtDate(lead.ts)}
          <WelcomeMark lead={lead} lang={lang} compact/>
        </span>
        <div className="lb-acts">
          {lead.phone && <a className="lb-act call" href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} title={en ? 'Call' : 'התקשרות'} aria-label={en ? 'Call' : 'התקשרות'}><Phone size={15}/></a>}
          {lead.phone && onOpenChat && <button type="button" className="lb-act wa" onClick={e => { e.stopPropagation(); onOpenChat(lead) }} title="WhatsApp" aria-label="WhatsApp"><MessageSquare size={15}/></button>}
          {openNote && <button type="button" className="lb-act note" onClick={e => { e.stopPropagation(); openNote(lead) }} title={en ? 'Call summary / note' : 'סיכום שיחה / הערה'} aria-label={en ? 'Call summary' : 'סיכום שיחה'}><Pencil size={15}/>{en ? 'Note' : 'סיכום'}</button>}
          <button type="button" className="lb-act del" onClick={e => { e.stopPropagation(); onDelete(lead.id) }} title={en ? 'Delete' : 'מחיקה'} aria-label={en ? 'Delete' : 'מחיקה'}><Trash2 size={15}/></button>
        </div>
      </div>
    </div>
  )
}

// ─── kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({ group, leads, T, isDark, lang, onOpen, onDelete, onOpenChat, onEnrich, onAddRow, onRenameStage, collapsed, onToggle, mergeTargetId }) {
  const { setNodeRef, isOver } = useDroppable({
    id: group.id,
    data: { type: 'column', groupId: group.id },
  })
  const color = group.color
  const label = lang === 'en' ? group.en : group.label

  // Collapsed: a narrow strip (still a drop target — drag a card onto it to move the lead there)
  if (collapsed) return (
    <div ref={setNodeRef} role="button" tabIndex={0} onClick={onToggle} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
      title={lang === 'en' ? `Show “${label}”` : `הצג "${label}"`} aria-expanded="false"
      style={{ width: 54, flexShrink: 0, alignSelf: 'stretch', maxHeight: '100%', minHeight: 220, cursor: 'pointer', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '12px 0',
        background: isOver ? `${color}22` : (isDark ? '#131B2A' : '#ECEEF8'), border: `1.5px ${isOver ? 'solid' : 'dashed'} ${isOver ? color : `${color}66`}`, transition: 'background .2s, border-color .2s' }}>
      <ChevronLeft size={15} style={{ color, transform: lang === 'en' ? 'none' : 'rotate(180deg)' }}/>
      <span style={{ background: leads.length ? color : (isDark ? '#2A3347' : '#DDE3F5'), color: leads.length ? '#fff' : T.textDim, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 900, minWidth: 22, textAlign: 'center' }}>{leads.length}</span>
      <span style={{ writingMode: 'vertical-rl', fontSize: 13, fontWeight: 800, color, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  )

  return (
    <div style={{
      width: 288,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: isOver ? `${color}10` : (isDark ? '#111722' : '#F3F4F8'),
      border: `1px solid ${isOver ? color : (isDark ? 'rgba(255,255,255,.06)' : 'rgba(20,30,80,.06)')}`,
      borderRadius: 14,
      overflow: 'hidden',
      transition: 'background .2s, border-color .2s',
      maxHeight: '100%',
    }}>

      {/* Column header */}
      <div style={{
        padding: '12px 12px 8px 14px',
        flexShrink: 0,
        direction: lang === 'en' ? 'ltr' : 'rtl',
        borderTop: `3px solid ${color}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StageTitle group={group} lang={lang} color={T.text} onRename={onRenameStage}/>
          <span style={{
            background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(20,30,80,.07)',
            color: T.textSub,
            borderRadius: 6, padding: '1px 8px', fontSize: 12, fontWeight: 600,
            minWidth: 22, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
          }}>{leads.length}</span>
          <span style={{ flex: 1 }}/>
          {onToggle && (
            <button type="button" onClick={onToggle} title={lang === 'en' ? 'Collapse' : 'כווץ עמודה'} aria-label={lang === 'en' ? `Collapse ${label}` : `כווץ את ${label}`} aria-expanded="true"
              style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', padding: 3, display: 'flex', borderRadius: 6 }}>
              <ChevronRight size={15} style={{ transform: lang === 'en' ? 'rotate(180deg)' : 'none' }}/>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable cards area */}
      <div ref={setNodeRef} className="kanban-col-scroll" style={{ flex: 1, padding: '4px 8px 6px', minHeight: 80, direction: 'rtl' }}>
        {/* No shuffling while dragging: the order inside a column isn't saved, and a still target lets a card be held on another to merge */}
        <SortableContext items={leads.map(l => l.id)} strategy={NO_SHIFT}>
          {leads.map(lead => (
            <KanbanCard key={lead.id} lead={lead} T={T} isDark={isDark} lang={lang}
              onOpen={onOpen} onDelete={onDelete} onOpenChat={onOpenChat} onEnrich={onEnrich} mergeHint={mergeTargetId === lead.id} />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div style={{
            padding: '28px 12px', textAlign: 'center', color: T.textDim, fontSize: 12,
            border: `2px dashed ${isDark ? '#2A3347' : '#D5DAF0'}`,
            borderRadius: 10, margin: '4px 0', lineHeight: 1.6,
          }}>
            {lang === 'en' ? 'Drop leads here' : 'גרור לידים לכאן'}
          </div>
        )}
      </div>

      {/* Add lead footer */}
      <div style={{ padding: '8px 10px', borderTop: `1px solid ${isDark ? '#222E42' : '#DDE3F5'}`, flexShrink: 0, direction: 'rtl' }}>
        <button onClick={() => onAddRow(group.id, '')}
          style={{
            width: '100%', padding: '7px 0',
            background: 'none', border: `1px dashed ${color}55`, borderRadius: 8,
            cursor: 'pointer', color, fontSize: 12, fontWeight: 700,
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'background .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${color}14` }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
          <Plus size={12} /> {lang === 'en' ? 'Add lead' : 'הוסף ליד'}
        </button>
      </div>
    </div>
  )
}

// ─── kanban board ─────────────────────────────────────────────────────────────

const COLLAPSE_KEY = 'afik_kanban_collapsed'
function useCollapsedStages() {
  const [map, setMap] = useState(() => { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}') || {} } catch { return {} } })
  const isCollapsed = g => (g.id in map ? !!map[g.id] : !!g.collapsedByDefault)
  const toggle = g => setMap(m => { const next = { ...m, [g.id]: !isCollapsed(g) }; try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)) } catch {} return next })
  return [isCollapsed, toggle]
}

const NO_SHIFT = () => null
const MERGE_DWELL_MS = 650

function KanbanBoard({ leads, T, isDark, lang, updateLead, updateLeadStatus, onAddRow, onOpen, onDelete, onOpenChat, onEnrich, showToast, onRenameStage, onMergeRequest }) {
  const [activeId, setActiveId] = useState(null)
  // Holding a dragged card on another card for a moment arms a merge; moving away disarms it
  const [mergeTargetId, setMergeTargetId] = useState(null)
  const dwell = useRef({ id: null, timer: null })
  const clearDwell = () => { clearTimeout(dwell.current.timer); dwell.current = { id: null, timer: null }; setMergeTargetId(null) }
  const handleDragOver = ({ active, over }) => {
    const overCard = over && over.data?.current?.type === 'card' && over.id !== active.id ? over.id : null
    if (overCard === dwell.current.id) return
    clearDwell()
    if (overCard && onMergeRequest) dwell.current = { id: overCard, timer: setTimeout(() => setMergeTargetId(overCard), MERGE_DWELL_MS) }
  }
  useEffect(() => () => clearTimeout(dwell.current.timer), [])
  const [isCollapsed, toggleCollapsed] = useCollapsedStages()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const grouped = useMemo(() => {
    const m = {}
    GROUPS.forEach(g => { m[g.id] = [] })
    leads.forEach(l => {
      const s = l.leadStatus || 'new'
      if (m[s] !== undefined) m[s].push(l)
      else m['new'].push(l)
    })
    return m
  }, [leads])

  const findGroupForLead = useCallback(id => {
    for (const g of GROUPS) {
      if ((grouped[g.id] || []).find(l => l.id === id)) return g.id
    }
    return null
  }, [grouped])

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    const armed = mergeTargetId
    clearDwell()
    if (armed && over && over.id === armed) {
      const a = leads.find(l => l.id === active.id), b = leads.find(l => l.id === armed)
      if (a && b) onMergeRequest(a, b)
      return
    }
    if (!over || active.id === over.id) return

    const fromGroup = findGroupForLead(active.id)
    const toGroup = over.data?.current?.type === 'column'
      ? over.id
      : (over.data?.current?.type === 'card' ? findGroupForLead(over.id) : findGroupForLead(over.id))

    if (!fromGroup || !toGroup || fromGroup === toGroup) return
    const lead = leads.find(l => l.id === active.id)
    if (lead) {
      updateLeadStatus(lead, toGroup)
      if (showToast) showToast(lang === 'en' ? `Moved to ${getGroupLabel(toGroup, lang)}` : `הועבר ל${getGroupLabel(toGroup, lang)}`)
    }
  }

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragOver={handleDragOver}
      onDragCancel={() => { setActiveId(null); clearDwell() }}
      onDragEnd={handleDragEnd}>

      {/* RTL horizontal scroll — first column (ליד חדש) is on the RIGHT */}
      <div className="kanban-board-scroll" style={{
        display: 'flex',
        gap: 16,
        padding: '16px 20px 24px',
        height: '100%',
        alignItems: 'flex-start',
        direction: 'rtl',
        background: isDark ? '#0D1117' : '#EEF0FA',
      }}>
        {GROUPS.map(group => (
          <KanbanColumn
            key={group.id}
            group={group}
            leads={grouped[group.id] || []}
            T={T} isDark={isDark} lang={lang}
            onOpen={onOpen}
            onDelete={onDelete}
            onOpenChat={onOpenChat}
            onEnrich={onEnrich}
            onAddRow={onAddRow}
            onRenameStage={onRenameStage}
            collapsed={isCollapsed(group)}
            onToggle={() => toggleCollapsed(group)}
            mergeTargetId={mergeTargetId}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(.18,.67,.6,1.22)' }}>
        {activeLead && (
          <div style={{ width: 272, opacity: 0.95, transform: 'rotate(2deg)', filter: 'drop-shadow(0 12px 32px rgba(0,0,0,.45))' }}>
            <KanbanCard
              lead={activeLead} T={T} isDark={isDark} lang={lang}
              onOpen={() => {}} onDelete={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
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
                <IntegrationIcon id={intg.id} size={36} />
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

function BulkActionBar({ count, total, onClearSelection, onSelectAll, onDelete, onMove, onMerge, onAddProject, onlySelected, onToggleOnly, lang, T }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  useEffect(() => { setConfirmDel(false) }, [count])
  if (count === 0) return null
  const en = lang === 'en'
  const btn = { background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 9, color: '#fff', cursor: 'pointer', padding: '7px 12px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }
  return (
    <div role="toolbar" className="lb-fab" aria-label={en ? 'Bulk actions' : 'פעולות על הנבחרים'} style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1E2A44', border: '1px solid #2F3D5E', borderRadius: 16, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 16px 48px rgba(0,0,0,.45)', zIndex: 700, direction: en ? 'ltr' : 'rtl', maxWidth: 'calc(100vw - 24px)', flexWrap: 'wrap', justifyContent: 'center' }}>
      <span style={{ background: '#0073EA', color: '#fff', borderRadius: 20, padding: '4px 11px', fontSize: 13, fontWeight: 800 }}>{count}</span>
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginInlineEnd: 4 }}>{en ? 'selected' : 'נבחרו'}</span>
      {onToggleOnly && <button type="button" onClick={onToggleOnly} aria-pressed={!!onlySelected} style={{ ...btn, ...(onlySelected ? { background: '#0073EA', borderColor: '#0073EA' } : {}) }}><Eye size={13}/> {onlySelected ? (en ? 'Show all' : 'הצג הכול') : (en ? 'Show selected' : 'הצג רק נבחרים')}</button>}
      {count < total && !onlySelected && <button type="button" onClick={onSelectAll} style={{ ...btn, background: 'none', border: 'none', textDecoration: 'underline', padding: '7px 6px' }}>{en ? `Select all ${total}` : `בחר את כל ה-${total}`}</button>}
      <div style={{ position: 'relative' }}>
        <button type="button" onClick={() => setMoveOpen(v => !v)} aria-expanded={moveOpen} style={btn}><Layers size={13}/> {en ? 'Move to stage' : 'העבר לשלב'}</button>
        {moveOpen && (
          <div role="menu" style={{ position: 'absolute', bottom: 'calc(100% + 8px)', insetInlineStart: 0, background: T.bgHeader, border: `1px solid ${T.border}`, borderRadius: 12, padding: 6, boxShadow: T.shadow, minWidth: 170 }}>
            {GROUPS.map(g => (
              <button key={g.id} role="menuitem" type="button" onClick={() => { setMoveOpen(false); onMove(g.id) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', color: T.text, fontSize: 13, fontFamily: 'inherit', textAlign: 'start' }}
                onMouseEnter={e => { e.currentTarget.style.background = T.bgRowHover }} onMouseLeave={e => { e.currentTarget.style.background = 'none' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: g.color }}/>{en ? g.en : g.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {count === 2 && onMerge && <button type="button" onClick={onMerge} style={btn}><Link2 size={13}/> {en ? 'Merge' : 'מזג'}</button>}
      {onAddProject && <button type="button" onClick={onAddProject} style={btn} title={en ? 'Adds " · <project>" after each selected lead\'s name (Meta campaign or listing)' : 'מוסיף " · <פרויקט>" אחרי השם של כל ליד נבחר (הקמפיין או הנכס)'}>{en ? '+ Project in the name' : '+ הפרויקט בשם'}</button>}
      {confirmDel
        ? <button type="button" onClick={() => { setConfirmDel(false); onDelete() }} style={{ ...btn, background: '#E2445C', borderColor: '#E2445C' }}><Trash2 size={13}/> {en ? `Delete ${count}?` : `למחוק ${count}?`}</button>
        : <button type="button" onClick={() => setConfirmDel(true)} style={{ ...btn, color: '#FFB3BD' }}><Trash2 size={13}/> {en ? 'Delete' : 'מחק'}</button>}
      <button type="button" onClick={onClearSelection} aria-label={en ? 'Clear selection' : 'נקה בחירה'} style={{ ...btn, background: 'none', border: 'none', padding: 7 }}><X size={15}/></button>
    </div>
  )
}

// ─── merge two leads ──────────────────────────────────────────────────────────

function MergeDialog({ leads: pair, onClose, onMerge, lang, T, isDark }) {
  const en = lang === 'en'
  const [keepIdx, setKeepIdx] = useState(0)
  const keep = pair[keepIdx], other = pair[1 - keepIdx]
  const conflicts = mergeConflicts(keep, other)
  const [choose, setChoose] = useState({})
  useEffect(() => { setChoose({}) }, [keepIdx])
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [onClose])
  const F = { name: en ? 'Name' : 'שם', phone: en ? 'Phone' : 'טלפון', email: en ? 'Email' : 'אימייל' }
  const notesCount = l => (Array.isArray(l.notes) ? l.notes.length : l.notes ? 1 : 0)
  const card = (l, i) => {
    const on = i === keepIdx, camp = leadCampaign(l, lang)
    return (
      <button key={l.id} type="button" onClick={() => setKeepIdx(i)} aria-pressed={on}
        style={{ flex: 1, minWidth: 0, textAlign: 'start', padding: 14, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', background: on ? '#0073EA14' : (isDark ? '#141C2C' : '#F6F7FC'), border: `2px solid ${on ? '#0073EA' : (isDark ? '#2A3347' : '#E1E5F5')}`, color: T.text }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: on ? '#0073EA' : T.textSub, marginBottom: 6 }}>{on ? (en ? '✓ Stays' : '✓ נשאר') : (en ? 'Merged into it' : 'מתמזג לתוכו')}</div>
        <div style={{ fontSize: 15, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || '—'}{camp && <span style={{ fontSize: 12, fontWeight: 500, color: T.textSub, marginInlineStart: 6 }}>(<bdi>{camp}</bdi>)</span>}</div>
        <div style={{ fontSize: 12.5, color: T.textSub, marginTop: 4, direction: 'ltr', textAlign: en ? 'left' : 'right' }}>{l.phone || '—'}{l.email ? ` · ${l.email}` : ''}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: getGroupColor(l.leadStatus || 'new'), background: getGroupColor(l.leadStatus || 'new') + '1f', borderRadius: 20, padding: '2px 8px' }}>{getGroupLabel(l.leadStatus || 'new', lang)}</span>
          <span style={{ fontSize: 11, color: T.textSub }}>{fmtDate(l.ts)}</span>
          {notesCount(l) > 0 && <span style={{ fontSize: 11, color: T.textSub }}>📝 {notesCount(l)}</span>}
        </div>
      </button>
    )
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 950, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={en ? 'Merge leads' : 'מיזוג לידים'} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', background: isDark ? '#161E2E' : '#FFFFFF', border: `1px solid ${isDark ? '#2A3347' : '#D8DCF0'}`, borderRadius: 18, boxShadow: '0 24px 64px rgba(0,0,0,.45)', direction: en ? 'ltr' : 'rtl', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: '#0073EA1f', color: '#0073EA', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Link2 size={16}/></span>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.text }}>{en ? 'Merge two leads' : 'מיזוג שני לידים'}</div>
          <button type="button" onClick={onClose} aria-label={en ? 'Close' : 'סגור'} style={{ background: 'none', border: 'none', color: T.textSub, cursor: 'pointer', padding: 4 }}><X size={18}/></button>
        </div>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: T.textSub, lineHeight: 1.6 }}>
          {en ? 'Pick the lead that stays. Everything from the other one — notes, tasks, tags, form answers, stage history and its message — is added to it, and the other card moves to the trash.'
              : 'בחרו איזה כרטיס נשאר. כל מה שיש בכרטיס השני — הערות, משימות, תגיות, תשובות לטופס, היסטוריית שלבים וההודעה — יתווסף אליו, והכרטיס השני יעבור לסל המחזור.'}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{pair.map(card)}</div>
        {conflicts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text, marginBottom: 8 }}>{en ? 'Different details — which to keep?' : 'פרטים שונים — מה לשמור?'}</div>
            {conflicts.map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ width: 56, fontSize: 12, fontWeight: 700, color: T.textSub }}>{F[k]}</span>
                {[['keep', keep[k]], ['other', other[k]]].map(([w, v]) => {
                  const on = (choose[k] || 'keep') === w
                  return <button key={w} type="button" aria-pressed={on} onClick={() => setChoose(c => ({ ...c, [k]: w }))}
                    style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${on ? '#0073EA' : (isDark ? '#2A3347' : '#D8DCF0')}`, background: on ? '#0073EA1a' : 'transparent', color: on ? '#0073EA' : T.text, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', direction: k === 'name' ? undefined : 'ltr' }}>{String(v)}</button>
                })}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button type="button" onClick={() => onMerge(keep, other, choose)} style={{ flex: 1, padding: '12px 0', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#0073EA,#0060CC)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            {en ? `Merge into “${keep.name || '—'}”` : `מזג לתוך "${keep.name || '—'}"`}
          </button>
          <button type="button" onClick={onClose} style={{ padding: '12px 18px', borderRadius: 11, border: `1px solid ${isDark ? '#2A3347' : '#D8DCF0'}`, background: 'none', color: T.textSub, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{en ? 'Cancel' : 'ביטול'}</button>
        </div>
      </div>
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

// The board + the call-summary dialog any card can open (NoteCtx), on desktop and mobile alike
// The lead card opened from another screen (the Lead Center's "כרטיס ליד"), with the office's stage names
export function LeadCardWithStages({ stageLabels, ...props }) {
  applyStageLabels(stageLabels)
  return <LeadCard {...props} stages={GROUPS}/>
}

export default function LeadsBoard(props) {
  const [noteLeadId, setNoteLeadId] = useState(null)
  const T = useTheme(props.isDark)
  const openNote = useCallback(lead => { if (lead?.id != null) setNoteLeadId(lead.id) }, [])
  const noteLead = noteLeadId != null ? (props.leads || []).find(l => l.id === noteLeadId) : null
  return (
    <NoteCtx.Provider value={openNote}>
      <LeadsBoardMain {...props}/>
      {noteLead && <CallNoteDialog lead={noteLead} T={T} isDark={props.isDark} lang={props.lang}
        updateLead={props.updateLead} updateLeadStatus={props.updateLeadStatus} onClose={() => setNoteLeadId(null)}/>}
    </NoteCtx.Provider>
  )
}

function LeadsBoardMain({
  leads, updateLead, updateLeadStatus, deleteLead, addLead,
  colOrder, setColOrder, customCols, setCustomCols, colWidths, setColWidths,
  exportCSV, syncLeads, enrichAll, enrichLead, clearLeads,
  trashedLeads = [], restoreLead, restoreLeads, permanentDeleteLead,
  leadsSyncing,
  isDark, lang, onOpenChat,
  stageLabels, onRenameStage,
  onOpenAutomations, autoPending = 0,
}) {
  applyStageLabels(stageLabels)   // before any child renders a stage name
  const T = useTheme(isDark)
  const isMobile = useIsMobile()

  const [search, setSearch]           = useState('')
  const [hiddenCols, setHiddenCols]   = useState({})
  const [extraCols, setExtraCols]     = useState(customCols || [])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [onlySelected, setOnlySelected] = useState(false)   // the table shows only the selected rows
  useEffect(() => { if (!selectedIds.size) setOnlySelected(false) }, [selectedIds.size])
  const [detailLead, setDetailLead]   = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  const [modal, setModal]             = useState(null)
  const [activeTab, setActiveTab]     = useState('pipeline')
  // /admin-panel/leads?lead=<id> (the link in a follow-up reminder) opens that lead's card once the list has it
  useEffect(() => {
    let id = ''
    try { id = new URLSearchParams(window.location.search).get('lead') || '' } catch {}
    if (!id) return
    const l = leads.find(x => String(x.id) === id)
    if (!l) return
    setDetailLead(l)
    try { const u = new URL(window.location.href); u.searchParams.delete('lead'); window.history.replaceState(window.history.state, '', u) } catch {}
  }, [leads])
  const [toast, setToast]             = useState(null)
  const [activeDragId, setActiveDragId] = useState(null)
  const [mobileSearch, setMobileSearch] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // Column resize
  const resizingRef  = useRef(null)
  const resizeStartX = useRef(0)
  const resizeStartW = useRef(0)

  const startColResize = useCallback((e, colId, defaultW) => {
    e.preventDefault(); e.stopPropagation()
    resizingRef.current  = colId
    resizeStartX.current = e.clientX
    resizeStartW.current = (colWidths || {})[colId] || defaultW
    const onMove = mv => {
      if (!resizingRef.current) return
      const w = Math.max(60, resizeStartW.current + mv.clientX - resizeStartX.current)
      setColWidths(prev => ({ ...(prev || {}), [resizingRef.current]: w }))
    }
    const onUp = () => {
      setColWidths(prev => {
        const next = { ...(prev || {}) }
        localStorage.setItem('leadsColWidths', JSON.stringify(next))
        return next
      })
      resizingRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [colWidths, setColWidths])

  const allCols = useMemo(() => {
    const builtIn = BUILT_IN_COLS.filter(c => !hiddenCols[c.id])
    const extra = extraCols.filter(c => !hiddenCols[c.id])
    return [...builtIn, ...extra]
  }, [hiddenCols, extraCols])

  // Override col.width with saved colWidths
  const allColsResized = useMemo(
    () => allCols.map(c => ({ ...c, width: (colWidths || {})[c.id] || c.width })),
    [allCols, colWidths]
  )

  // Total table width: checkbox(32) + all column widths + add-col btn(120)
  const tableMinWidth = useMemo(
    () => allColsResized.reduce((s, c) => s + (c.width || 140), 0) + 60 + 120,
    [allColsResized]
  )

  const filtered = useMemo(() => {
    if (!search) return leads
    const q = search.toLowerCase()
    return leads.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.propTitle || '').toLowerCase().includes(q) ||
      leadCampaignFull(l, lang).toLowerCase().includes(q)
    )
  }, [leads, search, lang])

  const grouped = useMemo(() => {
    const map = {}
    GROUPS.forEach(g => { map[g.id] = [] })
    ;(onlySelected ? filtered.filter(l => selectedIds.has(l.id)) : filtered).forEach(l => {
      const s = l.leadStatus || 'new'
      if (!map[s]) map[s] = []
      map[s].push(l)
    })
    return map
  }, [filtered, onlySelected, selectedIds])

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

  // The bar asks for the confirmation itself; deleted leads go to the trash ("אשפה") and can be restored
  const handleBulkDelete = () => {
    const n = selectedIds.size
    selectedIds.forEach(id => deleteLead(id))
    setSelectedIds(new Set())
    showToast(lang === 'en' ? `${n} leads moved to the trash` : `${n} לידים הועברו לאשפה`)
  }
  const handleBulkMove = stage => {
    let n = 0
    selectedIds.forEach(id => { const l = leads.find(x => x.id === id); if (l && (l.leadStatus || 'new') !== stage) { updateLeadStatus(l, stage); n++ } })
    setSelectedIds(new Set())
    showToast(lang === 'en' ? `${n} leads moved to ${getGroupLabel(stage, lang)}` : `${n} לידים הועברו ל${getGroupLabel(stage, lang)}`)
  }
  // Merge: from two selected rows, or by holding a dragged card on another card in the pipeline
  const [mergePair, setMergePair] = useState(null)
  const openMerge = (a, b) => { if (a && b && a.id !== b.id) setMergePair([b, a]) }   // the card dropped onto stays by default
  const doMerge = (keep, other, choose) => {
    const { patch, removeId } = mergeLeads(keep, other, { choose, lang })
    Promise.resolve(updateLead(keep.id, patch)).then(r => {
      if (r === null) { showToast(lang === 'en' ? 'Merge failed (no connection) — nothing was deleted' : 'המיזוג נכשל (אין חיבור) — לא נמחק דבר'); return }
      deleteLead(removeId)
      setSelectedIds(prev => { const x = new Set(prev); x.delete(removeId); x.delete(keep.id); return x })
      showToast(lang === 'en' ? `Merged into ${keep.name || ''}` : `מוזג לתוך ${keep.name || ''}`)
    })
    setMergePair(null)
  }

  // Shift + click selects every row between the last clicked one and this one (in the order the table shows them)
  const lastSelRef = useRef(null)
  const handleSelect = (id, checked, shift) => {
    const order = GROUPS.flatMap(g => (grouped[g.id] || []).map(l => l.id))
    const a = shift && lastSelRef.current != null ? order.indexOf(lastSelRef.current) : -1, b = order.indexOf(id)
    lastSelRef.current = id
    setSelectedIds(prev => {
      const s = new Set(prev)
      const ids = a >= 0 && b >= 0 ? order.slice(Math.min(a, b), Math.max(a, b) + 1) : [id]
      ids.forEach(x => (checked ? s.add(x) : s.delete(x)))
      return s
    })
  }

  const selCtx = useMemo(() => ({ has: id => selectedIds.has(id), toggle: (id, on, shift) => handleSelect(id, on, shift) }), [selectedIds, grouped]) // eslint-disable-line react-hooks/exhaustive-deps
  const handleSelectMany = (ids, checked) => setSelectedIds(prev => { const s = new Set(prev); ids.forEach(id => (checked ? s.add(id) : s.delete(id))); return s })
  const handleAddCol = col => { const next = [...extraCols, col]; setExtraCols(next); if (setCustomCols) setCustomCols(next); showToast(lang === 'en' ? 'Column added' : 'עמודה נוספה') }
  const toggleColVisibility = id => setHiddenCols(prev => ({ ...prev, [id]: !prev[id] }))
  const hiddenCount = Object.values(hiddenCols).filter(Boolean).length

  // ────────────────────────────────────────────────────────────────────────────
  // MOBILE LAYOUT
  // ────────────────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, fontFamily: "Rubik,'Inter','Segoe UI',system-ui,sans-serif", direction: lang === 'en' ? 'ltr' : 'rtl', overflow: 'hidden' }}>

        {/* ── Mobile Header ── */}
        <div style={{ padding: '14px 16px 10px', background: T.bgHeader, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#7456C2,#0073EA)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px #0073EA44' }}>
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
            <button onClick={() => setActiveTab(activeTab === 'dashboard' ? 'all' : 'dashboard')} aria-pressed={activeTab === 'dashboard'}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1px solid ${activeTab === 'dashboard' ? T.accent : T.border}`, background: activeTab === 'dashboard' ? T.accent + '1A' : 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: activeTab === 'dashboard' ? T.accent : T.textSub, whiteSpace: 'nowrap' }}>
              📊 {lang === 'en' ? 'Overview' : 'תמונת מצב'}
            </button>
            <button onClick={() => setActiveTab(activeTab === 'followups' ? 'all' : 'followups')} aria-pressed={activeTab === 'followups'}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, border: `1px solid ${activeTab === 'followups' ? T.accent : T.border}`, background: activeTab === 'followups' ? T.accent + '1A' : 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: activeTab === 'followups' ? T.accent : T.textSub, whiteSpace: 'nowrap' }}>
              <Bell size={12}/> {lang === 'en' ? 'Follow-ups' : 'פולו אפים'}
            </button>
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
        <div style={{ background: T.bgHeader, borderBottom: `1px solid ${T.border}`, paddingTop: 10, display: activeTab === 'followups' ? 'none' : undefined }}>
          <MobileStatsBar leads={leads} T={T} lang={lang} />
        </div>

        {activeTab === 'dashboard' && (
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <LeadsDashboard leads={leads} search={search} onClearSearch={() => setSearch('')} stages={GROUPS} T={T} isDark={isDark} lang={lang} onOpen={setDetailLead} onOpenChat={onOpenChat} />
          </div>
        )}

        {activeTab === 'followups' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <FollowUpsView leads={leads} lang={lang} stages={GROUPS} onUpdate={updateLead} onOpen={setDetailLead} onOpenChat={onOpenChat}/>
          </div>
        )}

        {/* ── Lead cards ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', WebkitOverflowScrolling: 'touch', display: activeTab === 'dashboard' || activeTab === 'followups' ? 'none' : undefined }}>
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
        <div className="lb-fab" style={{ position: 'fixed', bottom: 24, left: lang === 'en' ? 24 : 'auto', right: lang === 'en' ? 'auto' : 24, zIndex: 400 }}>
          <button onClick={() => handleAddRow(activeTab !== 'all' ? activeTab : 'new', '')}
            style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg, #0073EA, #0060CC)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 6px 24px #0073EA55, 0 2px 8px rgba(0,0,0,.3)`, fontSize: 28, fontFamily: 'inherit' }}>
            <Plus size={26} strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Overlays ── */}
        {statusTarget && <StatusPopup lead={statusTarget} onClose={() => setStatusTarget(null)} onUpdate={updateLeadStatus} lang={lang} T={T} />}
        {detailLead && <LeadCard key={detailLead.id} lead={leads.find(l => l.id === detailLead.id) || detailLead} onClose={() => setDetailLead(null)} onUpdate={updateLead} onUpdateStatus={updateLeadStatus} onEnrich={enrichLead} onOpenChat={onOpenChat} lang={lang} stages={GROUPS} />}
        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}` + LB_CSS}</style>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // DESKTOP LAYOUT
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: T.bg, fontFamily: "Rubik,'Inter','Segoe UI',system-ui,sans-serif", direction: lang === 'en' ? 'ltr' : 'rtl', overflow: 'hidden' }}>

      {/* ── Board title bar ── */}
      <div style={{ padding: '10px 20px 0', background: isDark ? '#0D1117' : T.bgHeader, borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 20, fontWeight: 600, color: T.text, letterSpacing: '-.01em' }}>
            {lang === 'en' ? 'Leads' : 'ניהול לידים'}
          </span>
          <span style={{ fontSize: 13, color: T.textSub, fontVariantNumeric: 'tabular-nums' }}>
            {leads.length} {lang === 'en' ? 'leads' : 'לידים'}
          </span>
          <div style={{ flex: 1 }} />
          <button type="button" className="lb-tb" onClick={() => setModal('integrate')}>
            <Zap size={14} /> {lang === 'en' ? 'Integrations' : 'אינטגרציות'}
          </button>
          <button type="button" className="lb-tb" onClick={() => (onOpenAutomations ? onOpenAutomations() : setModal('automate'))}>
            <Settings size={14} /> {lang === 'en' ? 'Automations' : 'אוטומציות'}
            {autoPending > 0 && <span className="n">{autoPending}</span>}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '2px 0 10px' }}>
          <div className="lb-seg" role="tablist" aria-label={lang === 'en' ? 'View' : 'תצוגה'}>
            {[
              { id: 'dashboard', Icon: BarChart3, label: lang === 'en' ? 'Overview' : 'תמונת מצב' },
              { id: 'pipeline', Icon: Columns3, label: lang === 'en' ? 'Pipeline' : 'פייפליין' },
              { id: 'table', Icon: Table2, label: lang === 'en' ? 'Table' : 'טבלה' },
            ].map(({ id, Icon, label }) => (
              <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)}>
                <Icon size={15} strokeWidth={2}/>{label}
              </button>
            ))}
          </div>
          <div style={{ marginInlineStart: 10 }}>
            <FollowUpsButton leads={leads} lang={lang} active={activeTab === 'followups'} onClick={() => setActiveTab('followups')}/>
          </div>
        </div>
      </div>

      {/* ── Toolbar: new lead · search · (table) columns ┊ sync · trash · CSV · (table) add column · enrich ── */}
      <div style={{ display: activeTab === 'followups' ? 'none' : 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: isDark ? '#0D1117' : T.bgHeader, borderBottom: `1px solid ${T.border}`, flexShrink: 0, overflowX: 'auto' }}>
        <button type="button" onClick={() => handleAddRow(GROUPS[0].id, '')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 16px', background: T.accent, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', minHeight: 0 }}>
          <Plus size={15} strokeWidth={2.4} /> {lang === 'en' ? 'New lead' : 'ליד חדש'}
        </button>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, background: T.bgInput, border: `1px solid ${T.border}`, borderRadius: 9, padding: '0 12px', minWidth: 240, cursor: 'text' }}>
          <Search size={15} style={{ color: T.textSub, flexShrink: 0 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} aria-label={lang === 'en' ? 'Search leads' : 'חיפוש לידים'}
            placeholder={lang === 'en' ? 'Search name, phone, campaign…' : 'חיפוש שם, טלפון, קמפיין…'}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: T.text, fontFamily: 'inherit', flex: 1, minWidth: 0, minHeight: 0 }} />
          {search && <button type="button" onClick={() => setSearch('')} aria-label={lang === 'en' ? 'Clear search' : 'ניקוי חיפוש'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textSub, padding: 0, display: 'flex', alignItems: 'center', minHeight: 0 }}><X size={14} /></button>}
        </label>

        {activeTab === 'table' && (
          <button type="button" className="lb-tb" onClick={() => setModal('hidecols')} aria-pressed={hiddenCount > 0}>
            {hiddenCount > 0 ? <EyeOff size={14} /> : <Eye size={14} />}
            {lang === 'en' ? 'Columns' : 'עמודות'}
            {hiddenCount > 0 && <span className="n">{hiddenCount}</span>}
          </button>
        )}

        <div style={{ flex: 1 }} />

        <button type="button" className="lb-tb" onClick={syncLeads} disabled={leadsSyncing} title={lang === 'en' ? 'Sync with the server' : 'סנכרון מול השרת'}>
          <RefreshCw size={14} style={{ animation: leadsSyncing ? 'spin 1s linear infinite' : 'none' }} />
          {lang === 'en' ? 'Sync' : 'סנכרון'}
        </button>
        {restoreLead && (
          <button type="button" className={`lb-tb${trashedLeads.length ? ' danger' : ''}`} onClick={() => setModal('trash')}>
            <Trash2 size={14} /> {lang === 'en' ? 'Trash' : 'אשפה'}
            {trashedLeads.length > 0 && <span className="n">{trashedLeads.length}</span>}
          </button>
        )}
        <button type="button" className="lb-tb" onClick={() => setModal('export')}><Download size={14} /> {lang === 'en' ? 'Export to Excel' : 'ייצוא לאקסל'}</button>
        {activeTab === 'table' && <button type="button" className="lb-tb" onClick={() => setModal('addcol')}><Columns size={14} /> {lang === 'en' ? 'Add column' : 'עמודה חדשה'}</button>}
        {enrichAll && <button type="button" className="lb-tb" onClick={enrichAll}>✦ {lang === 'en' ? 'Enrich all' : 'העשרה'}</button>}
      </div>

      {/* ── Overview: funnel + stage drill-down ── */}
      {activeTab === 'dashboard' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <LeadsDashboard leads={leads} search={search} onClearSearch={() => setSearch('')} stages={GROUPS} T={T} isDark={isDark} lang={lang} onOpen={setDetailLead} onOpenChat={onOpenChat} />
        </div>
      )}

      {/* ── Follow-ups & tasks: a screen of its own (src/FollowUpsView.jsx) ── */}
      {activeTab === 'followups' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <FollowUpsView leads={leads} lang={lang} stages={GROUPS} onUpdate={updateLead} onOpen={setDetailLead} onOpenChat={onOpenChat}/>
        </div>
      )}

      {/* ── Pipeline / table ── */}
      {(activeTab === 'pipeline' || activeTab === 'table') && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {/* ── Pipeline (Kanban) view ── */}
            {activeTab === 'pipeline' && (
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <SelCtx.Provider value={selCtx}>
                <KanbanBoard
                  leads={filtered}
                  T={T} isDark={isDark} lang={lang}
                  updateLead={updateLead}
                  updateLeadStatus={updateLeadStatus}
                  onAddRow={handleAddRow}
                  onOpen={setDetailLead}
                  onDelete={handleDelete}
                  onOpenChat={onOpenChat}
                  onEnrich={enrichLead}
                  showToast={showToast}
                  onRenameStage={onRenameStage}
                  onMergeRequest={openMerge}
                />
                </SelCtx.Provider>
              </div>
            )}

            {/* ── Table view ── */}
            {activeTab === 'table' && (
              <div className="leads-table-scroll" style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                  <div style={{ minWidth: tableMinWidth, width: '100%' }}>
                    {/* Column headers */}
                    <div style={{ display: 'flex', alignItems: 'center', background: T.bgHeader, borderBottom: `2px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 10, height: 36, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                      <div className="lb-selcol" style={{ borderInlineEnd: `1px solid ${T.border}`, height: '100%', background: T.bgHeader, zIndex: 5 }}>
                        <CheckBox size={18} label={lang === 'en' ? 'Select all' : 'בחר הכול'}
                          checked={filtered.length > 0 && selectedIds.size >= filtered.length && filtered.every(l => selectedIds.has(l.id))}
                          indeterminate={selectedIds.size > 0}
                          onChange={on => setSelectedIds(on ? new Set(filtered.map(l => l.id)) : new Set())} />
                      </div>
                      {allColsResized.map(col => (
                        <div key={col.id} style={{ width: col.width, flexShrink: 0, padding: '0 10px', fontSize: 11, fontWeight: 700, color: T.textSub, textTransform: 'uppercase', letterSpacing: '.05em', borderRight: `1px solid ${T.borderLight}`, height: '100%', display: 'flex', alignItems: 'center', userSelect: 'none', cursor: 'pointer', transition: 'color .15s, background .15s', whiteSpace: 'nowrap', overflow: 'hidden', position: 'relative', ...(col.pinned ? { position: 'sticky', insetInlineStart: 60, zIndex: 4, background: T.bgHeader } : {}) }}
                          onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.background = T.bgRowHover }}
                          onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.background = col.pinned ? T.bgHeader : 'transparent' }}>
                          {lang === 'en' ? (col.en || col.label) : col.label}
                          <span
                            onMouseDown={e => startColResize(e, col.id, col.width)}
                            onClick={e => e.stopPropagation()}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,115,234,.55)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', background: 'transparent', zIndex: 5, flexShrink: 0 }}
                          />
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
                        <BoardGroup key={group.id} group={group} leads={groupLeads} cols={allColsResized}
                          T={T} lang={lang}
                          onUpdate={updateLead} onUpdateStatus={updateLeadStatus}
                          onDelete={handleDelete} onSelect={handleSelect} selectedIds={selectedIds} onSelectMany={handleSelectMany}
                          onOpenDetail={setDetailLead} onAddRow={handleAddRow}
                          onOpenChat={onOpenChat} onEnrich={enrichLead}
                          onStatusClick={(e, lead) => setStatusTarget(lead)} onRenameStage={onRenameStage} />
                      )
                    })}
                    <div style={{ height: 60 }} />
                  </div>
                </DndContext>
              </div>
            )}
          </div>
        </div>
      )}

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
      {detailLead && <LeadCard key={detailLead.id} lead={leads.find(l => l.id === detailLead.id) || detailLead} onClose={() => setDetailLead(null)} onUpdate={updateLead} onUpdateStatus={updateLeadStatus} onEnrich={enrichLead} onOpenChat={onOpenChat} lang={lang} stages={GROUPS} />}
      {selectedIds.size > 0 && <BulkActionBar count={selectedIds.size} total={filtered.length} lang={lang} T={T} onClearSelection={() => setSelectedIds(new Set())} onSelectAll={() => setSelectedIds(new Set(filtered.map(l => l.id)))}
        onlySelected={onlySelected} onToggleOnly={() => { setOnlySelected(v => !v); setActiveTab(t => (t === 'table' ? t : 'table')) }} onDelete={handleBulkDelete} onMove={handleBulkMove}
        onMerge={() => { const [a, b] = [...selectedIds].map(id => leads.find(l => l.id === id)); if (a && b) setMergePair([a, b]) }}
        onAddProject={() => {
          // " · <project>" after the name of every selected lead that has a project and doesn't show it yet (the same rename as the card)
          let n = 0
          for (const id of selectedIds) {
            const l = leads.find(x => x.id === id), p = leadProject(l)
            if (!l?.name || !p) continue
            const { has, next } = toggleProjectInName(l.name, p)
            if (!has) { updateLead(l.id, { name: next }); n++ }
          }
          setToast(lang === 'en' ? `Project added to ${n} names` : `הפרויקט נוסף ל-${n} שמות`)
        }} />}
      {mergePair && <MergeDialog leads={mergePair} lang={lang} T={T} isDark={isDark} onClose={() => setMergePair(null)} onMerge={doMerge} />}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* ── Trash Modal ── */}
      <ExportDialog open={modal === 'export'} onClose={() => setModal(null)} leads={leads} filtered={filtered} selectedIds={selectedIds}
        stages={GROUPS} stageName={id => { const g = GROUPS.find(x => x.id === id); return g ? (lang === 'en' ? g.en : g.label) : id }} searching={!!search} lang={lang}/>
      {modal === 'trash' && (
        <>
          <div onClick={() => setModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,.45)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: T.bgHeader, border: `1px solid ${T.border}`, borderRadius: 16, padding: 0, boxShadow: T.shadow, zIndex: 901, width: 580, maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', direction: 'rtl' }}>
            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Trash2 size={18} style={{ color: T.red, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>
                  {lang === 'en' ? 'Trash' : 'אשפה — לידים שנמחקו'}
                </div>
                <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>
                  {lang === 'en' ? `${trashedLeads.length} deleted leads` : `${trashedLeads.length} לידים במחיקה — ניתן לשחזר בכל עת`}
                </div>
              </div>
              {trashedLeads.length > 0 && permanentDeleteLead && (
                <button
                  onClick={() => { if (window.confirm(lang === 'en' ? 'Empty trash permanently?' : 'לרוקן את האשפה לצמיתות?')) { [...trashedLeads].forEach(l => permanentDeleteLead(l.id)); setModal(null) } }}
                  style={{ padding: '6px 12px', background: T.red + '15', border: `1px solid ${T.red}44`, borderRadius: 8, color: T.red, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                  {lang === 'en' ? 'Empty Trash' : '🗑️ ריקון אשפה'}
                </button>
              )}
              <button onClick={() => setModal(null)} style={{ width: 30, height: 30, borderRadius: '50%', border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', color: T.textSub, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {trashedLeads.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textSub }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 6 }}>{lang === 'en' ? 'Trash is empty' : 'האשפה ריקה'}</div>
                  <div style={{ fontSize: 12 }}>{lang === 'en' ? 'Deleted leads will appear here' : 'לידים שנמחקו יופיעו כאן לשחזור'}</div>
                </div>
              ) : trashBatches(trashedLeads).map(batch => (
                <div key={`b${batch.at}-${batch.leads[0]?.id}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px 6px', position: 'sticky', top: -8, background: T.bgHeader, zIndex: 1, borderBottom: `1px solid ${T.borderLight}` }}>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: T.textSub }}>
                      {batch.at
                        ? (lang === 'en' ? 'Deleted ' : 'נמחקו ') + new Date(batch.at).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })
                        : (lang === 'en' ? 'Deleted earlier' : 'נמחקו בעבר')}
                      {' · '}{lang === 'en' ? `${batch.leads.length} lead${batch.leads.length === 1 ? '' : 's'}` : (batch.leads.length === 1 ? 'ליד אחד' : `${batch.leads.length} לידים`)}
                    </span>
                    {batch.leads.length > 1 && (
                      <button type="button" onClick={() => (restoreLeads ? restoreLeads(batch.leads.map(l => l.id)) : batch.leads.forEach(l => restoreLead(l.id)))}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: T.green, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', minHeight: 0 }}>
                        ↩ {lang === 'en' ? `Restore all ${batch.leads.length}` : `שחזר את כל ה-${batch.leads.length}`}
                      </button>
                    )}
                  </div>
                  {batch.leads.map(lead => {
                const deletedAgo = lead.deletedAt
                  ? (() => {
                      const diff = Date.now() - lead.deletedAt
                      if (diff < 60000) return 'עכשיו'
                      if (diff < 3600000) return `לפני ${Math.floor(diff/60000)} דק'`
                      if (diff < 86400000) return `לפני ${Math.floor(diff/3600000)} שע'`
                      return `לפני ${Math.floor(diff/86400000)} ימים`
                    })()
                  : ''
                const color = getGroupColor(lead.leadStatus || 'new')
                return (
                  <div key={lead.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${T.borderLight}`, transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = T.bgRowHover}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {/* Avatar */}
                    <WaFace phone={lead.phone} name={lead.name} size={38} lang={lang}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(lead.name) + '22', border: `1.5px solid ${avatarColor(lead.name)}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: avatarColor(lead.name), flexShrink: 0 }}>
                      {(lead.name || lead.phone || '?')[0]?.toUpperCase()}
                    </div>
                    </WaFace>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lead.name || lead.phone || '—'}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '1A', padding: '2px 7px', borderRadius: 10, border: `1px solid ${color}44`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {GROUPS.find(g => g.id === lead.leadStatus)?.label || lead.leadStatus || 'ליד חדש'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 12, color: T.textSub }}>
                        {lead.phone && <span style={{ direction: 'ltr', display: 'inline-block' }}>{lead.phone}</span>}
                        {lead.email && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{lead.email}</span>}
                        {deletedAgo && <span style={{ marginRight: 'auto', flexShrink: 0, opacity: .7 }}>{deletedAgo}</span>}
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => restoreLead(lead.id)}
                        title={lang === 'en' ? 'Restore' : 'שחזר ליד'}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: T.green + '15', border: `1px solid ${T.green}44`, borderRadius: 8, color: T.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = T.green + '28' }}
                        onMouseLeave={e => { e.currentTarget.style.background = T.green + '15' }}>
                        ↩ {lang === 'en' ? 'Restore' : 'שחזר'}
                      </button>
                      {permanentDeleteLead && (
                        <button
                          onClick={() => permanentDeleteLead(lead.id)}
                          title={lang === 'en' ? 'Delete permanently' : 'מחק לצמיתות'}
                          style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: 'transparent', cursor: 'pointer', color: T.textSub, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = T.red + '88'; e.currentTarget.style.color = T.red; e.currentTarget.style.background = T.red + '12' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub; e.currentTarget.style.background = 'transparent' }}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}` + LB_CSS}</style>
    </div>
  )
}
