// MetaKanban.jsx — Pipeline / Table view for Meta Lead Center
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  pointerWithin, rectIntersection, closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove,
  horizontalListSortingStrategy, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const ADMIN_TOKEN = 'AFIKhanahal2026'
const STAGES_LS   = 'meta_kanban_stages_v3'

// ── Dark theme tokens ─────────────────────────────────────────────────────────
const T = {
  bg:      '#0D1117',
  card:    '#1A2235',
  cardHov: '#212D42',
  surf:    '#131B2A',
  surfHov: '#1E2840',
  border:  '#2A3347',
  borderL: '#1E2A3A',
  text:    '#E2E8F8',
  sub:     '#8B98BC',
  dim:     '#4A5568',
  popup:   '#0F1825',
  divider: '#1E2A3A',
  accent:  '#1877F2',
}

const DEFAULT_STAGES = [
  { id: 'new',          label: 'Intake',                   color: '#1877F2' },
  { id: 'contacted',    label: 'רציניים',                  color: '#F59E0B' },
  { id: 'scheduled',    label: 'פחות רציניים (דיברנו)',    color: '#8B5CF6' },
  { id: 'follow_up',    label: 'לא ענו/לדבר בהמשך',       color: '#6B7280' },
  { id: 'qualified',    label: 'Qualified',                color: '#22C55E' },
  { id: 'saved_to_crm', label: 'Converted',                color: '#06B6D4' },
]

const STAGE_DESC = {
  new:          'New incoming leads appear here automatically.',
  contacted:    'Move serious leads who showed strong interest here.',
  scheduled:    'Leads you spoke with — less serious or follow-up needed.',
  follow_up:    "No answer — mark here to call back later.",
  qualified:    'Move leads here if they have strong interest and are a good fit for your business.',
  saved_to_crm: 'Move leads here if they made an agreement or transaction.',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return '?'
  const p = name.trim().split(/\s+/)
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase()
}
const AV = ['#1877F2','#E05252','#22C55E','#F59E0B','#8B5CF6','#EC4899','#06B6D4','#F97316']
const avatarBg = n => AV[(n?.charCodeAt(0) || 65) % AV.length]

function fmtPhone(p) {
  if (!p) return ''
  const d = String(p).replace(/\D/g, '')
  if (d.startsWith('972') && d.length >= 12) return '0' + d.slice(3, 5) + '-' + d.slice(5, 8) + '-' + d.slice(8)
  return p
}

function timeAgo(str) {
  const d = (Date.now() - new Date(str)) / 1000
  if (d < 3600) return `לפני ${Math.floor(d / 60)} דק׳`
  if (d < 86400) return `לפני ${Math.floor(d / 3600)} ש׳`
  if (d < 604800) return `לפני ${Math.floor(d / 86400)} ימים`
  return new Date(str).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
}

// ── MenuItem ───────────────────────────────────────────────────────────────────
function MenuItem({ icon, label, onClick, danger, sub }) {
  return (
    <button onClick={onClick}
      style={{ width: '100%', padding: sub ? '6px 12px 6px 24px' : '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'right', fontSize: sub ? 12 : 13, color: danger ? '#E05252' : T.text, display: 'flex', alignItems: 'center', gap: 8, direction: 'rtl' }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? 'rgba(224,82,82,.12)' : T.surfHov }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
    >
      {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  )
}

// ── SortableCard ───────────────────────────────────────────────────────────────
function SortableCard({ lead, stages, onClick, onDelete, onMoveStage, bulkMode, isSelected, onToggleSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${lead.id}`,
    data: { type: 'card', stageId: lead.status },
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        background: T.card,
        borderRadius: 8,
        border: isSelected ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
        padding: '10px 12px',
        marginBottom: 8,
        cursor: isDragging ? 'grabbing' : 'grab',
        boxShadow: isDragging ? '0 10px 28px rgba(0,0,0,.22)' : '0 1px 3px rgba(0,0,0,.08)',
        position: 'relative',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onClick={() => { if (bulkMode) { onToggleSelect(lead.id) } else { onClick(lead) } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {bulkMode && (
          <input type="checkbox" checked={isSelected}
            onChange={e => { e.stopPropagation(); onToggleSelect(lead.id) }}
            onClick={e => e.stopPropagation()}
            style={{ marginTop: 3, width: 15, height: 15, accentColor: '#1877F2', cursor: 'pointer', flexShrink: 0 }}
          />
        )}
        <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: avatarBg(lead.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>
          {initials(lead.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl' }}>
            {lead.name || '—'}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
            {(lead.campaign_name || lead.form_name) && (
              <span style={{ fontSize: 10, color: T.sub, background: T.surf, borderRadius: 4, padding: '2px 5px', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.campaign_name || lead.form_name}
              </span>
            )}
            <span style={{ fontSize: 10, color: T.accent, background: 'rgba(24,119,242,.15)', borderRadius: 4, padding: '2px 5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
              ✓ Complete form
            </span>
          </div>
          {lead.created_at && (
            <div style={{ fontSize: 10, color: T.dim, marginTop: 4 }}>{timeAgo(lead.created_at)}</div>
          )}
        </div>

        {/* Three-dot menu */}
        <div ref={menuRef} style={{ flexShrink: 0, position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px', color: T.sub, fontSize: 18, borderRadius: 4, lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.background = T.surfHov }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >⋮</button>

          {menuOpen && (
            <div style={{ position: 'absolute', top: 22, right: 0, zIndex: 999, background: T.popup, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,.6)', minWidth: 170 }}>
              <MenuItem icon="👤" label="Open lead" onClick={() => { onClick(lead); setMenuOpen(false) }} />
              <div style={{ borderTop: `1px solid ${T.divider}`, margin: '3px 0' }} />
              <div style={{ padding: '4px 12px 2px', fontSize: 10, color: T.sub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', direction: 'rtl' }}>Move to</div>
              {stages.filter(s => s.id !== lead.status).map(s => (
                <button key={s.id} onClick={() => { onMoveStage(lead.id, s.id); setMenuOpen(false) }}
                  style={{ width: '100%', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: s.color, display: 'flex', alignItems: 'center', gap: 8, direction: 'rtl' }}
                  onMouseEnter={e => { e.currentTarget.style.background = T.surfHov }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span>{s.label}</span>
                </button>
              ))}
              <div style={{ borderTop: `1px solid ${T.divider}`, margin: '3px 0' }} />
              <MenuItem icon="🗑" label="Delete lead" danger onClick={() => { onDelete(lead); setMenuOpen(false) }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── KanbanColumn ───────────────────────────────────────────────────────────────
function KanbanColumn({ stage, leads, stages, onCardClick, onCardDelete, onCardMoveStage, bulkMode, selectedCards, onToggleCardSelect, onRenameStage, onDeleteStage }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: stage.id,
    data: { type: 'column', stageId: stage.id },
  })
  const [colMenu, setColMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(stage.label)
  const colMenuRef = useRef(null)

  useEffect(() => {
    if (!colMenu) return
    const h = e => { if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setColMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [colMenu])

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: [transition, 'border-color .15s, background .15s'].filter(Boolean).join(', '),
        opacity: isDragging ? 0.45 : 1,
        width: 255,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: isOver ? 'rgba(24,119,242,.12)' : T.surf,
        borderRadius: 10,
        maxHeight: '100%',
        border: isOver ? `2px dashed ${T.accent}` : `2px solid ${T.borderL}`,
      }}
    >
      {/* Column header — drag handle */}
      <div
        {...listeners} {...attributes}
        style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'grab', borderRadius: '8px 8px 0 0', background: T.bg, userSelect: 'none', borderBottom: `1px solid ${T.border}` }}
      >
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
        {editing ? (
          <input
            autoFocus value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onBlur={() => { onRenameStage(stage.id, nameVal); setEditing(false) }}
            onKeyDown={e => {
              if (e.key === 'Enter') { onRenameStage(stage.id, nameVal); setEditing(false) }
              if (e.key === 'Escape') setEditing(false)
            }}
            onClick={e => e.stopPropagation()}
            style={{ flex: 1, border: '1px solid #1877F2', borderRadius: 4, padding: '2px 6px', fontSize: 13, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }}
          />
        ) : (
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl' }}>
            {stage.label}
          </span>
        )}
        <span style={{ fontSize: 11, fontWeight: 700, color: T.sub, background: T.border, borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>
          {leads.length}
        </span>

        <div ref={colMenuRef} style={{ flexShrink: 0, position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button onClick={e => { e.stopPropagation(); setColMenu(v => !v) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 5px', color: T.sub, fontSize: 15, borderRadius: 4, lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.background = T.border }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >···</button>
          {colMenu && (
            <div style={{ position: 'absolute', top: 24, right: 0, zIndex: 999, background: T.popup, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,.6)', minWidth: 150 }}>
              <MenuItem icon="✏️" label="Rename" onClick={() => { setEditing(true); setNameVal(stage.label); setColMenu(false) }} />
              <MenuItem icon="🗑" label="Delete stage" danger onClick={() => { onDeleteStage(stage.id); setColMenu(false) }} />
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 0', minHeight: 80 }}>
        <SortableContext items={leads.map(l => `card-${l.id}`)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <SortableCard
              key={lead.id} lead={lead} stages={stages}
              onClick={onCardClick} onDelete={onCardDelete} onMoveStage={onCardMoveStage}
              bulkMode={bulkMode} isSelected={selectedCards.has(lead.id)} onToggleSelect={onToggleCardSelect}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div style={{ padding: '18px 10px 22px', textAlign: 'center' }}>
            <div style={{ marginBottom: 8 }}>
              <svg width="44" height="36" viewBox="0 0 220 180" fill="none" style={{ display: 'block', margin: '0 auto', opacity: .28 }}>
                <rect x="20" y="20" width="80" height="14" rx="7" fill="#BCC0C4" />
                <rect x="20" y="44" width="56" height="14" rx="7" fill="#BCC0C4" />
                <rect x="20" y="68" width="66" height="14" rx="7" fill="#BCC0C4" />
                <rect x="116" y="48" width="82" height="68" rx="12" fill="#E7F0FF" />
                <rect x="126" y="62" width="62" height="10" rx="5" fill="#1877F2" opacity=".45" />
                <rect x="126" y="80" width="44" height="10" rx="5" fill="#BCC0C4" />
                <circle cx="162" cy="100" r="11" fill="#1877F2" opacity=".2" />
                <path d="M157 100l4 4 8-8" stroke="#1877F2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
              </svg>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#65676B', marginBottom: 4 }}>No {stage.label} leads</div>
            <div style={{ fontSize: 11, color: '#BCC0C4', lineHeight: 1.5 }}>{STAGE_DESC[stage.id] || 'Move leads to this stage'}</div>
          </div>
        )}
      </div>
      <div style={{ height: 8 }} />
    </div>
  )
}

// ── RowMenu ────────────────────────────────────────────────────────────────────
function RowMenu({ lead, stages, onMoveStage, onDelete, onOpenLead }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 7px', color: '#65676B', fontSize: 16, borderRadius: 4 }}
        onMouseEnter={e => { e.currentTarget.style.background = '#F0F2F5' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
      >⋮</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 24, zIndex: 200, background: T.popup, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: '0 8px 28px rgba(0,0,0,.6)', minWidth: 165 }}>
          <MenuItem icon="👤" label="Open lead" onClick={() => { onOpenLead(lead); setOpen(false) }} />
          <div style={{ borderTop: `1px solid ${T.divider}`, margin: '3px 0' }} />
          <div style={{ padding: '4px 12px 2px', fontSize: 10, color: '#65676B', fontWeight: 700, textTransform: 'uppercase', direction: 'rtl' }}>Move to</div>
          {stages.filter(s => s.id !== lead.status).map(s => (
            <button key={s.id} onClick={() => { onMoveStage(lead.id, s.id); setOpen(false) }}
              style={{ width: '100%', padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#1C1E21', display: 'flex', alignItems: 'center', gap: 8, direction: 'rtl' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F0F2F5' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span>{s.label}</span>
            </button>
          ))}
          <div style={{ borderTop: `1px solid ${T.divider}`, margin: '3px 0' }} />
          <MenuItem icon="🗑" label="Delete lead" danger onClick={() => { onDelete(lead); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}

// ── TableView ──────────────────────────────────────────────────────────────────
function TableView({ leads, stages, onMoveStage, onDelete, onOpenLead }) {
  const [sortCol, setSortCol] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [selected, setSelected] = useState(new Set())

  const sorted = useMemo(() => [...leads].sort((a, b) => {
    if (sortCol === 'date') {
      const d = new Date(b.created_at) - new Date(a.created_at)
      return sortDir === 'desc' ? d : -d
    }
    if (sortCol === 'name') {
      const d = (a.name || '').localeCompare(b.name || '')
      return sortDir === 'asc' ? d : -d
    }
    if (sortCol === 'stage') {
      const ai = stages.findIndex(s => s.id === a.status)
      const bi = stages.findIndex(s => s.id === b.status)
      return sortDir === 'asc' ? ai - bi : bi - ai
    }
    return 0
  }), [leads, sortCol, sortDir, stages])

  const toggle = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const TH = ({ col, label, w }) => (
    <th onClick={() => toggle(col)}
      style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: T.sub, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none', fontSize: 12, width: w, borderBottom: `2px solid ${T.border}`, background: T.bg }}>
      {label} <span style={{ opacity: sortCol === col ? 1 : 0.3, color: sortCol === col ? '#1877F2' : undefined }}>{sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 680 }}>
        <thead style={{ position: 'sticky', top: 0, background: T.bg, zIndex: 10 }}>
          <tr>
            <th style={{ padding: '10px 12px', width: 36, borderBottom: `2px solid ${T.border}`, background: T.bg }}>
              <input type="checkbox" style={{ cursor: 'pointer', accentColor: '#1877F2' }}
                checked={selected.size === leads.length && leads.length > 0}
                onChange={e => setSelected(e.target.checked ? new Set(leads.map(l => l.id)) : new Set())}
              />
            </th>
            <TH col="name" label="Name" w={160} />
            <TH col="stage" label="Stage" w={140} />
            <TH col="phone" label="Phone" w={130} />
            <TH col="campaign" label="Campaign / Form" w={160} />
            <TH col="date" label="Date" w={110} />
            <th style={{ padding: '10px 12px', width: 48, borderBottom: `2px solid ${T.border}`, background: T.bg }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead, i) => {
            const stg = stages.find(s => s.id === lead.status)
            const isSel = selected.has(lead.id)
            return (
              <tr key={lead.id}
                style={{ background: isSel ? 'rgba(24,119,242,.12)' : i % 2 === 0 ? T.card : T.surf, cursor: 'pointer', borderBottom: `1px solid ${T.borderL}` }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = T.cardHov }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = i % 2 === 0 ? T.card : T.surf }}
                onClick={() => onOpenLead(lead)}
              >
                <td style={{ padding: '9px 12px' }}>
                  <input type="checkbox" checked={isSel} style={{ cursor: 'pointer', accentColor: '#1877F2' }}
                    onClick={e => e.stopPropagation()}
                    onChange={e => { const n = new Set(selected); e.target.checked ? n.add(lead.id) : n.delete(lead.id); setSelected(n) }}
                  />
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarBg(lead.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {initials(lead.name)}
                    </div>
                    <span style={{ fontWeight: 600, color: T.text, direction: 'rtl', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{lead.name || '—'}</span>
                  </div>
                </td>
                <td style={{ padding: '9px 12px' }}>
                  {stg ? (
                    <span style={{ padding: '3px 8px', borderRadius: 12, background: stg.color + '22', color: stg.color, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{stg.label}</span>
                  ) : <span style={{ color: T.dim, fontSize: 11 }}>—</span>}
                </td>
                <td style={{ padding: '9px 12px', color: T.sub }}>{fmtPhone(lead.phone) || '—'}</td>
                <td style={{ padding: '9px 12px', color: T.sub, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lead.campaign_name || lead.form_name || '—'}
                </td>
                <td style={{ padding: '9px 12px', color: T.dim, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {lead.created_at ? timeAgo(lead.created_at) : '—'}
                </td>
                <td style={{ padding: '9px 12px' }} onClick={e => e.stopPropagation()}>
                  <RowMenu lead={lead} stages={stages} onMoveStage={onMoveStage} onDelete={onDelete} onOpenLead={onOpenLead} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: T.dim, fontSize: 14 }}>No leads found</div>
      )}
    </div>
  )
}

// ── LeadDrawer ─────────────────────────────────────────────────────────────────
function LeadDrawer({ lead, stages, onClose, onMoveStage, onDelete }) {
  const stg = stages.find(s => s.id === lead.status)
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 400 }} onClick={onClose} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: T.popup, boxShadow: '-8px 0 48px rgba(0,0,0,.7)', zIndex: 500, display: 'flex', flexDirection: 'column', fontFamily: 'Rubik,Helvetica Neue,Arial,sans-serif' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatarBg(lead.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {initials(lead.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, direction: 'rtl' }}>{lead.name}</div>
            {stg && <span style={{ marginTop: 4, display: 'inline-block', padding: '2px 8px', borderRadius: 10, background: stg.color + '22', color: stg.color, fontSize: 11, fontWeight: 700 }}>{stg.label}</span>}
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: T.sub, padding: '4px', borderRadius: 6, lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.background = T.surfHov }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {[
            { label: 'Phone', value: fmtPhone(lead.phone) || '—', icon: '📞' },
            { label: 'Email', value: lead.email || '—', icon: '✉️' },
            { label: 'Campaign', value: lead.campaign_name || '—', icon: '📣' },
            { label: 'Form', value: lead.form_name || '—', icon: '📋' },
            { label: 'Notes', value: lead.notes || '—', icon: '📝' },
            { label: 'Received', value: lead.created_at ? new Date(lead.created_at).toLocaleString('he-IL') : '—', icon: '🕐' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #F0F2F5' }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 2 }}>{row.icon}</span>
              <div>
                <div style={{ fontSize: 10, color: '#BCC0C4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>{row.label}</div>
                <div style={{ fontSize: 13, color: '#1C1E21', direction: 'rtl' }}>{row.value}</div>
              </div>
            </div>
          ))}

          {/* Move to stage */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: '#65676B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Move to stage</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {stages.map(s => (
                <button key={s.id} onClick={() => onMoveStage(lead.id, s.id)}
                  style={{ padding: '5px 10px', border: `1.5px solid ${lead.status === s.id ? s.color : '#E4E6EB'}`, borderRadius: 20, background: lead.status === s.id ? s.color + '22' : '#fff', color: lead.status === s.id ? s.color : '#65676B', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.color = s.color }}
                  onMouseLeave={e => { if (lead.status !== s.id) { e.currentTarget.style.borderColor = '#E4E6EB'; e.currentTarget.style.color = '#65676B' } }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E4E6EB', display: 'flex', gap: 8 }}>
          {lead.phone && (
            <a href={`https://wa.me/${lead.phone}`} target="_blank" rel="noopener noreferrer"
              style={{ flex: 1, padding: '8px 12px', background: '#25D366', border: 'none', borderRadius: 7, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center', display: 'block' }}>
              💬 WhatsApp
            </a>
          )}
          <button onClick={() => onDelete(lead)}
            style={{ padding: '8px 14px', border: '1px solid #E4E6EB', borderRadius: 7, background: '#fff', color: '#E05252', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#E05252'; e.currentTarget.style.background = '#FFF0F0' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E4E6EB'; e.currentTarget.style.background = '#fff' }}
          >🗑 Delete</button>
        </div>
      </div>
    </>
  )
}

// ── MetaKanban (main export) ───────────────────────────────────────────────────
export default function MetaKanban({ leads: propLeads = [], onUpdateLead, onDeleteLead, initialView = 'pipeline' }) {
  // Stages
  const [stages, setStages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STAGES_LS)) || DEFAULT_STAGES } catch { return DEFAULT_STAGES }
  })
  useEffect(() => { localStorage.setItem(STAGES_LS, JSON.stringify(stages)) }, [stages])

  // Leads grouped by stage (local copy)
  const [leadsByStage, setLeadsByStage] = useState({})
  useEffect(() => {
    setLeadsByStage(prev => {
      const grouped = {}
      for (const s of stages) grouped[s.id] = []
      for (const lead of propLeads) {
        const sid = lead.status || 'new'
        if (!grouped[sid]) grouped[sid] = []
        // Don't overwrite if already present (preserves DnD reorder)
        if (!grouped[sid].some(l => l.id === lead.id)) grouped[sid].push(lead)
      }
      // Merge: keep DnD order for existing, add new
      const merged = {}
      for (const s of stages) {
        const existing = (prev[s.id] || []).filter(l => (grouped[s.id] || []).some(gl => gl.id === l.id))
        const incoming = (grouped[s.id] || []).filter(l => !existing.some(el => el.id === l.id))
        merged[s.id] = [...existing, ...incoming]
      }
      return merged
    })
  }, [propLeads, stages.length]) // eslint-disable-line

  const allLeads = useMemo(() => Object.values(leadsByStage).flat(), [leadsByStage])

  // UI state
  const [viewMode, setViewMode]         = useState(initialView === 'table' ? 'table' : 'pipeline')
  const [selectedLead, setSelectedLead] = useState(null)
  const [bulkMode, setBulkMode]         = useState(false)
  const [selectedCards, setSelectedCards] = useState(new Set())
  const [search, setSearch]             = useState('')
  const [campaignFilter, setCampaignFilter] = useState(null)
  const [showFilters, setShowFilters]   = useState(true)
  const [addingStage, setAddingStage]   = useState(false)
  const [newStageName, setNewStageName] = useState('')
  const [delConfirm, setDelConfirm]     = useState(null)
  const [activeId, setActiveId]         = useState(null)
  const [activeType, setActiveType]     = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // ── DnD helpers ──────────────────────────────────────────────────────────────
  const findCardStage = useCallback(cardId => {
    for (const [sid, leads] of Object.entries(leadsByStage)) {
      if (leads.some(l => `card-${l.id}` === cardId)) return sid
    }
    return null
  }, [leadsByStage])

  function handleDragStart({ active }) {
    setActiveId(active.id)
    setActiveType(active.data.current?.type)
  }

  function handleDragOver({ active, over }) {
    if (!over || active.data.current?.type !== 'card') return
    const fromSid = findCardStage(active.id)
    const toSid = over.data.current?.type === 'card' ? findCardStage(over.id) : (over.data.current?.stageId || over.id)
    if (!fromSid || !toSid || fromSid === toSid) return

    setLeadsByStage(prev => {
      const from = [...(prev[fromSid] || [])]
      const to   = [...(prev[toSid]   || [])]
      const idx  = from.findIndex(l => `card-${l.id}` === active.id)
      if (idx === -1) return prev
      const [moved] = from.splice(idx, 1)
      const overIdx = to.findIndex(l => `card-${l.id}` === over.id)
      if (overIdx >= 0) to.splice(overIdx, 0, { ...moved, status: toSid })
      else to.push({ ...moved, status: toSid })
      return { ...prev, [fromSid]: from, [toSid]: to }
    })
  }

  function handleDragEnd({ active, over }) {
    const type = activeType
    setActiveId(null); setActiveType(null)
    if (!over) return

    if (type === 'column') {
      const oi = stages.findIndex(s => s.id === active.id)
      const ni = stages.findIndex(s => s.id === over.id)
      if (oi >= 0 && ni >= 0 && oi !== ni) setStages(prev => arrayMove(prev, oi, ni))
      return
    }

    if (type === 'card') {
      const sid = findCardStage(active.id)
      if (!sid) return
      // Reorder within same column
      if (over.data.current?.type === 'card') {
        const oSid = findCardStage(over.id)
        if (oSid === sid) {
          setLeadsByStage(prev => {
            const arr = [...(prev[sid] || [])]
            const ai  = arr.findIndex(l => `card-${l.id}` === active.id)
            const oi  = arr.findIndex(l => `card-${l.id}` === over.id)
            if (ai >= 0 && oi >= 0) return { ...prev, [sid]: arrayMove(arr, ai, oi) }
            return prev
          })
        }
      }
      // Persist to server
      const leadId = active.id.replace('card-', '')
      const lead = allLeads.find(l => String(l.id) === leadId)
      if (lead) {
        fetch('/api/meta/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
          body: JSON.stringify({ id: lead.id, status: lead.status }),
        }).catch(() => {})
        onUpdateLead?.(lead.id, { status: lead.status })
      }
    }
  }

  // ── Stage/Lead actions ───────────────────────────────────────────────────────
  const moveLeadToStage = useCallback((leadId, newSid) => {
    setLeadsByStage(prev => {
      const updated = {}
      let moved = null
      for (const [sid, leads] of Object.entries(prev)) {
        updated[sid] = leads.filter(l => { if (String(l.id) === String(leadId)) { moved = l; return false } return true })
      }
      if (moved) updated[newSid] = [{ ...moved, status: newSid }, ...(updated[newSid] || [])]
      return updated
    })
    setSelectedLead(prev => prev && String(prev.id) === String(leadId) ? { ...prev, status: newSid } : prev)
    fetch('/api/meta/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ id: leadId, status: newSid }),
    }).catch(() => {})
    onUpdateLead?.(leadId, { status: newSid })
  }, [onUpdateLead])

  const handleDeleteLead = useCallback(lead => {
    setLeadsByStage(prev => {
      const u = {}
      for (const [sid, leads] of Object.entries(prev)) u[sid] = leads.filter(l => l.id !== lead.id)
      return u
    })
    if (selectedLead?.id === lead.id) setSelectedLead(null)
    onDeleteLead?.(lead, { stopPropagation: () => {} })
    setDelConfirm(null)
  }, [selectedLead, onDeleteLead])

  const renameStage = (sid, label) => setStages(prev => prev.map(s => s.id === sid ? { ...s, label } : s))

  const confirmDeleteStage = sid => {
    setLeadsByStage(prev => {
      const moved = (prev[sid] || []).map(l => ({ ...l, status: 'new' }))
      return { ...prev, [sid]: [], new: [...(prev.new || []), ...moved] }
    })
    setStages(prev => prev.filter(s => s.id !== sid))
    setDelConfirm(null)
  }

  const addStage = () => {
    if (!newStageName.trim()) return
    const id = 'custom_' + Date.now()
    const COLORS = ['#8B5CF6','#EC4899','#F97316','#14B8A6','#84CC16','#EF4444']
    setStages(prev => [...prev, { id, label: newStageName.trim(), color: COLORS[prev.length % COLORS.length] }])
    setLeadsByStage(prev => ({ ...prev, [id]: [] }))
    setNewStageName('')
    setAddingStage(false)
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = allLeads.length
    const converted = (leadsByStage['saved_to_crm'] || []).length
    const intake = allLeads.filter(l => (Date.now() - new Date(l.created_at)) < 7 * 86400000).length
    return { total, converted, rate: total > 0 ? Math.round(converted / total * 100) : 0, intake }
  }, [allLeads, leadsByStage])

  const campaigns = useMemo(() => [...new Set(allLeads.map(l => l.campaign_name || l.form_name).filter(Boolean))], [allLeads])

  const filteredByStage = useMemo(() => {
    const q = search.toLowerCase()
    const r = {}
    for (const [sid, leads] of Object.entries(leadsByStage)) {
      r[sid] = leads.filter(l => {
        const ms = !q || [l.name, l.phone, l.campaign_name, l.form_name].filter(Boolean).some(s => s.toLowerCase().includes(q))
        const mc = !campaignFilter || (l.campaign_name || l.form_name) === campaignFilter
        return ms && mc
      })
    }
    return r
  }, [leadsByStage, search, campaignFilter])

  const activeLead = activeId?.startsWith('card-') ? allLeads.find(l => `card-${l.id}` === activeId) : null

  const collisionDetection = useCallback(args => {
    if (activeType === 'column') return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter(c => c.data.current?.type === 'column') })
    const pw = pointerWithin(args)
    return pw.length > 0 ? pw : rectIntersection(args)
  }, [activeType])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: 'Rubik,Helvetica Neue,Arial,sans-serif', overflow: 'hidden' }}>

      {/* TOP BAR */}
      <div style={{ padding: '8px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: T.surf }}>
        <div style={{ display: 'flex', background: T.bg, borderRadius: 8, padding: 3, gap: 2 }}>
          {[{ id: 'pipeline', icon: '⠿', label: 'Pipeline view' }, { id: 'table', icon: '≡', label: 'Table view' }].map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)}
              style={{ padding: '5px 11px', border: 'none', borderRadius: 6, background: viewMode === v.id ? T.card : 'transparent', color: viewMode === v.id ? T.accent : T.sub, fontSize: 12, fontWeight: viewMode === v.id ? 700 : 500, cursor: 'pointer', boxShadow: viewMode === v.id ? '0 1px 6px rgba(0,0,0,.35)' : 'none', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13 }}>{v.icon}</span><span>{v.label}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowFilters(v => !v)}
          style={{ padding: '5px 11px', border: `1px solid ${T.border}`, borderRadius: 7, background: T.card, color: T.sub, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>⇅</span><span>{showFilters ? 'Hide filters' : 'Show filters'}</span>
        </button>
      </div>

      {/* TOOLBAR */}
      <div style={{ padding: '7px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, flexWrap: 'wrap', background: T.surf }}>
        <button onClick={() => setAddingStage(true)}
          style={{ padding: '5px 11px', border: `1px solid ${T.border}`, borderRadius: 7, background: T.card, color: T.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = T.cardHov }}
          onMouseLeave={e => { e.currentTarget.style.background = T.card }}>
          + Add custom stage
        </button>
        <button onClick={() => { setBulkMode(v => !v); setSelectedCards(new Set()) }}
          style={{ padding: '5px 11px', border: `1px solid ${bulkMode ? T.accent : T.border}`, borderRadius: 7, background: bulkMode ? 'rgba(24,119,242,.15)' : T.card, color: bulkMode ? T.accent : T.text, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {bulkMode ? `✓ ${selectedCards.size} selected` : 'Bulk edit'}
        </button>
        {bulkMode && selectedCards.size > 0 && (
          <button onClick={() => { selectedCards.forEach(id => { const l = allLeads.find(x => x.id === id); if (l) handleDeleteLead(l) }); setSelectedCards(new Set()); setBulkMode(false) }}
            style={{ padding: '5px 11px', border: '1px solid #E05252', borderRadius: 7, background: 'rgba(224,82,82,.12)', color: '#E05252', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🗑 Delete selected ({selectedCards.size})
          </button>
        )}
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="+ חיפוש לידים..."
          style={{ flex: 1, minWidth: 120, padding: '5px 11px', border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 12, outline: 'none', fontFamily: 'inherit', background: T.card, color: T.text }}
        />
      </div>

      {/* FILTERS */}
      {showFilters && (
        <div style={{ padding: '6px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 5, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center', background: T.surf }}>
          {campaigns.length === 0 && <span style={{ fontSize: 11, color: T.dim }}>אין קמפיינים לסינון</span>}
          {campaigns.map(c => (
            <button key={c} onClick={() => setCampaignFilter(campaignFilter === c ? null : c)}
              style={{ padding: '3px 9px', border: `1px solid ${campaignFilter === c ? T.accent : T.border}`, borderRadius: 20, background: campaignFilter === c ? 'rgba(24,119,242,.15)' : T.card, color: campaignFilter === c ? T.accent : T.sub, fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {c} {campaignFilter === c && '×'}
            </button>
          ))}
        </div>
      )}

      {/* STATS BAR */}
      <div style={{ padding: '6px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 20, flexShrink: 0, background: T.bg, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { label: 'Intake leads', val: stats.intake, sub: 'this week', color: '#22C55E' },
          { label: 'Converted leads', val: stats.converted, sub: 'total', color: T.accent },
          { label: 'Conversion rate', val: `${stats.rate}%`, sub: 'overall', color: stats.rate >= 10 ? '#22C55E' : '#F97316' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, color: T.sub }}>{s.label}:</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.val}</span>
            <span style={{ fontSize: 11, color: T.dim }}>{s.sub}</span>
          </div>
        ))}
        <div style={{ flex: 1, textAlign: 'right', fontSize: 12, color: T.accent, fontWeight: 600 }}>
          {allLeads.length} leads total
        </div>
      </div>

      {/* ADD STAGE FORM */}
      {addingStage && (
        <div style={{ padding: '7px 16px', background: 'rgba(24,119,242,.08)', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 7, flexShrink: 0 }}>
          <input autoFocus value={newStageName} onChange={e => setNewStageName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addStage(); if (e.key === 'Escape') { setAddingStage(false); setNewStageName('') } }}
            placeholder="Stage name..."
            style={{ flex: 1, padding: '6px 10px', border: `1px solid ${T.accent}`, borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: T.card, color: T.text }}
          />
          <button onClick={addStage} style={{ padding: '6px 14px', background: T.accent, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
          <button onClick={() => { setAddingStage(false); setNewStageName('') }} style={{ padding: '6px 10px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: T.sub }}>Cancel</button>
        </div>
      )}

      {/* CONTENT */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {viewMode === 'pipeline' ? (
          <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <SortableContext items={stages.map(s => s.id)} strategy={horizontalListSortingStrategy}>
              <div style={{ display: 'flex', gap: 10, padding: '12px 16px', height: '100%', overflowX: 'auto', overflowY: 'hidden', boxSizing: 'border-box', alignItems: 'flex-start', background: T.bg, direction: 'rtl' }}>
                {stages.map(stage => (
                  <KanbanColumn
                    key={stage.id} stage={stage}
                    leads={filteredByStage[stage.id] || []}
                    stages={stages}
                    onCardClick={setSelectedLead}
                    onCardDelete={l => setDelConfirm({ type: 'lead', lead: l })}
                    onCardMoveStage={moveLeadToStage}
                    bulkMode={bulkMode}
                    selectedCards={selectedCards}
                    onToggleCardSelect={id => setSelectedCards(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })}
                    onRenameStage={renameStage}
                    onDeleteStage={sid => setDelConfirm({ type: 'stage', id: sid })}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeLead && (
                <div style={{ background: '#fff', borderRadius: 8, border: '2px solid #1877F2', padding: '10px 12px', width: 240, boxShadow: '0 12px 36px rgba(0,0,0,.25)', opacity: .95 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarBg(activeLead.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>
                      {initials(activeLead.name)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1E21', direction: 'rtl' }}>{activeLead.name}</div>
                      <div style={{ fontSize: 11, color: '#65676B', marginTop: 2 }}>{activeLead.campaign_name || activeLead.form_name || 'Lead'}</div>
                    </div>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          <TableView
            leads={allLeads.filter(l => {
              const q = search.toLowerCase()
              const ms = !q || [l.name, l.phone, l.campaign_name, l.form_name].filter(Boolean).some(s => s.toLowerCase().includes(q))
              const mc = !campaignFilter || (l.campaign_name || l.form_name) === campaignFilter
              return ms && mc
            })}
            stages={stages}
            onMoveStage={moveLeadToStage}
            onDelete={l => setDelConfirm({ type: 'lead', lead: l })}
            onOpenLead={setSelectedLead}
          />
        )}
      </div>

      {/* LEAD DRAWER */}
      {selectedLead && (
        <LeadDrawer
          lead={selectedLead} stages={stages}
          onClose={() => setSelectedLead(null)}
          onMoveStage={moveLeadToStage}
          onDelete={l => { setDelConfirm({ type: 'lead', lead: l }); setSelectedLead(null) }}
        />
      )}

      {/* DELETE CONFIRM */}
      {delConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 340, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,.35)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1C1E21' }}>
              {delConfirm.type === 'stage' ? 'Delete stage?' : 'Delete lead?'}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#65676B', lineHeight: 1.5 }}>
              {delConfirm.type === 'stage'
                ? 'All leads in this stage will move to Intake. This cannot be undone.'
                : `Delete "${delConfirm.lead?.name}"? This cannot be undone.`}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDelConfirm(null)}
                style={{ padding: '8px 16px', border: '1px solid #E4E6EB', borderRadius: 7, background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => delConfirm.type === 'stage' ? confirmDeleteStage(delConfirm.id) : handleDeleteLead(delConfirm.lead)}
                style={{ padding: '8px 16px', border: 'none', borderRadius: 7, background: '#E02020', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
