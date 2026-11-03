// Projects (deals) on the leads board: the bar of projects above the board (a filter, counts, "+ פרויקט חדש", "ניהול"), the
// projects manager (create / edit / colors / campaign names that join by themselves / archive / delete, a stage breakdown per
// project, "create from a campaign"), the project chip on every lead with its picker (move a lead between projects in one click),
// and the "ליד חדש" dialog that saves a lead to the server with its project. Rules: lib/projects.js; the list: src/lib/projectsStore.js.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FolderKanban, Plus, Settings2, X, Check, Search, Archive, ArchiveRestore, Trash2, Pencil, UserPlus, ChevronDown, GitMerge } from 'lucide-react'
import { projectOfLead, projectHow, projectCounts, projectSuggestions, newProject, assignPatch, autoProjects, mergeProjects, duplicateGroups, PROJECT_COLORS, NONE } from '../lib/projects.js'
import { saveProjects, projectsLoaded, getAutoDone } from './lib/projectsStore.js'
import { MANUAL_SOURCES } from '../lib/manual-lead.js'

const TXT = {
  he: {
    allLeads: 'כל הלידים', ddTitle: 'בחירת פרויקט', ddSearch: 'חיפוש פרויקט…', ddEmpty: 'לא נמצא פרויקט', openN: n => `${n} פתוחים`, autoMade: n => `נוספו ${n} פרויקטים מהקמפיינים`,
    all: 'כל הפרויקטים', one: 'פרויקט', none: 'בלי פרויקט', add: 'פרויקט חדש', manage: 'ניהול פרויקטים', projects: 'פרויקטים',
    open: n => `${n} פתוחים`, leads: n => (n === 1 ? 'ליד אחד' : `${n} לידים`), pick: 'שיוך לפרויקט', search: 'חיפוש או שם של פרויקט / נכס חדש…', selPh: 'בחירת פרויקט או נכס — או יצירת חדש', emptyHint: 'עוד אין פרויקטים. הקלידו שם (למשל "זרובבל 15") ולחצו Enter כדי ליצור.', newHint: 'הקלידו שם חדש כדי ליצור פרויקט',
    noProject: 'בלי פרויקט', create: n => `יצירת פרויקט "${n}"`, auto: 'שויך לפי הקמפיין', manual: 'שויך ידנית',
    title: 'פרויקטים', sub: 'כל נכס או פרויקט שמנהלים במקביל. ליד שייך לפרויקט אחד; לידים מקמפיין שמופיע בשמות הנוספים נכנסים אליו לבד.',
    name: 'שם הפרויקט', namePh: 'למשל: זרובבל 15', town: 'עיר', townPh: 'למשל: רמת השרון', color: 'צבע',
    aliases: 'שמות קמפיין / נכס שנכנסים לפרויקט לבד', aliasesPh: 'למשל: זרובבל 15 - v2, פנטהאוז זרובבל', save: 'שמירה', cancel: 'ביטול',
    edit: 'עריכה', archive: 'העברה לארכיון', unarchive: 'החזרה מהארכיון', del: 'מחיקה', archived: 'בארכיון',
    delAsk: n => `למחוק את הפרויקט "${n}"? הלידים נשארים, רק בלי השיוך.`, suggest: 'קמפיינים בלי פרויקט', fromCamp: 'יצירת פרויקט',
    mergeBtn: 'מיזוג', mergeSel: n => `מיזוג ${n} פרויקטים`, selectToMerge: 'בחירה למיזוג', dupTitle: 'נראה כמו אותו פרויקט — כדאי למזג?',
    mergeTitle: 'מיזוג פרויקטים', mergeKeep: 'איזה שם נשאר?', mergeOwn: 'שם אחר:', mergeWhat: (n, name) => `${n} לידים יהיו תחת "${name}". שמות הקמפיינים של כל הפרויקטים נשמרים, כך שלידים חדשים מהם ייכנסו אליו לבד.`,
    mergeGo: 'מיזוג', mergeDone: (n, name, m) => `מוזגו ${n} פרויקטים לתוך "${name}"${m ? ` · ${m} לידים הועברו` : ''}`, cancelSel: 'ביטול הבחירה',
    showLeads: 'הצגת הלידים', empty: 'עוד אין פרויקטים. צרו את הראשון, או בחרו קמפיין מהרשימה.', saving: 'שומר…',
    stages: { new: 'חדש', contacted: 'נוצר קשר', discovery: 'מתעניין', meeting: 'פגישה', negotiating: 'מו״מ', won: 'נסגר', lost: 'ללא מענה', nurture: 'בהמשך', irrelevant: 'לא רלוונטי' },
    // new lead
    nlTitle: 'ליד חדש', nlName: 'שם', nlPhone: 'טלפון', nlEmail: 'אימייל', nlProject: 'פרויקט', nlStage: 'שלב', nlSource: 'מאיפה הגיע',
    nlDetail: 'פרטים (מי הפנה, איזו מודעה…)', nlNote: 'הערה ראשונה', nlNotePh: 'מה מחפשים, תקציב, מה סוכם…', nlWelcome: 'לשלוח הודעת פתיחה בוואטסאפ',
    nlSave: 'הוספת הליד', nlNeed: 'צריך טלפון או אימייל', nlErr: 'השמירה נכשלה', nlSaved: 'הליד נוסף',
    sources: { phone: 'שיחת טלפון', referral: 'הפניה', 'walk-in': 'הגיע למשרד', website: 'אתר', meta: 'פייסבוק / אינסטגרם', yad2: 'יד2', other: 'אחר' },
  },
  en: {
    allLeads: 'All leads', ddTitle: 'Pick a project', ddSearch: 'Find a project…', ddEmpty: 'No project found', openN: n => `${n} open`, autoMade: n => `${n} projects added from the campaigns`,
    all: 'All projects', one: 'Project', none: 'No project', add: 'New project', manage: 'Manage projects', projects: 'Projects',
    open: n => `${n} open`, leads: n => (n === 1 ? '1 lead' : `${n} leads`), pick: 'Assign to a project', search: 'Find, or type a new project / property…', selPh: 'Pick a project or property — or create one', emptyHint: 'No projects yet. Type a name (e.g. "15 Zerubavel") and press Enter to create it.', newHint: 'Type a new name to create a project',
    noProject: 'No project', create: n => `Create project "${n}"`, auto: 'Matched by its campaign', manual: 'Assigned by hand',
    title: 'Projects', sub: 'Every property or project you run in parallel. A lead belongs to one project; leads from a campaign listed in its other names join it by themselves.',
    name: 'Project name', namePh: 'e.g. 15 Zerubavel', town: 'Town', townPh: 'e.g. Ramat HaSharon', color: 'Color',
    aliases: 'Campaign / listing names that join this project by themselves', aliasesPh: 'e.g. Zerubavel 15 - v2, Zerubavel penthouse', save: 'Save', cancel: 'Cancel',
    edit: 'Edit', archive: 'Archive', unarchive: 'Restore from archive', del: 'Delete', archived: 'Archived',
    delAsk: n => `Delete the project "${n}"? Its leads stay, without the project.`, suggest: 'Campaigns without a project', fromCamp: 'Create project',
    mergeBtn: 'Merge', mergeSel: n => `Merge ${n} projects`, selectToMerge: 'Select to merge', dupTitle: 'These look like the same project — merge?',
    mergeTitle: 'Merge projects', mergeKeep: 'Which name stays?', mergeOwn: 'Another name:', mergeWhat: (n, name) => `${n} leads will be under "${name}". Every project's campaign names are kept, so new leads from them join it by themselves.`,
    mergeGo: 'Merge', mergeDone: (n, name, m) => `${n} projects merged into "${name}"${m ? ` · ${m} leads moved` : ''}`, cancelSel: 'Clear selection',
    showLeads: 'Show its leads', empty: 'No projects yet. Create the first one, or pick a campaign from the list.', saving: 'Saving…',
    stages: { new: 'New', contacted: 'Contacted', discovery: 'Interested', meeting: 'Meeting', negotiating: 'Negotiating', won: 'Won', lost: 'No answer', nurture: 'Later', irrelevant: 'Not relevant' },
    nlTitle: 'New lead', nlName: 'Name', nlPhone: 'Phone', nlEmail: 'Email', nlProject: 'Project', nlStage: 'Stage', nlSource: 'Where from',
    nlDetail: 'Details (who referred, which ad…)', nlNote: 'First note', nlNotePh: 'What they look for, budget, what was agreed…', nlWelcome: 'Send the WhatsApp welcome',
    nlSave: 'Add the lead', nlNeed: 'A phone or an email is needed', nlErr: 'Saving failed', nlSaved: 'Lead added',
    sources: { phone: 'Phone call', referral: 'Referral', 'walk-in': 'Walk-in', website: 'Website', meta: 'Facebook / Instagram', yad2: 'Yad2', other: 'Other' },
  },
}
const STAGE_ORDER = ['new', 'contacted', 'discovery', 'meeting', 'negotiating', 'won', 'lost', 'nurture', 'irrelevant']
const STAGE_COLOR = { new: '#579BFC', contacted: '#FDAB3D', discovery: '#A25DDC', meeting: '#0EA5E9', negotiating: '#E2445C', won: '#00C875', lost: '#808080', nurture: '#66CCFF', irrelevant: '#9AA0B5' }
const tOf = lang => TXT[lang === 'en' ? 'en' : 'he']
// a project's color as CSS variables: the color, a soft fill and a line (hex + alpha, so Safari 15.4 shows them too)
const pv = c => (c ? { '--pc': c, '--pcb': `${c}1F`, '--pcs': `${c}12`, '--pcl': `${c}66` } : undefined)

/** The colored chip of a lead's project; a click opens the picker (dashed "+ פרויקט" when it has none) */
export function ProjectChip({ lead, projects, lang = 'he', onAssign, size = 'sm' }) {
  const t = tOf(lang)
  const [open, setOpen] = useState(null)
  const p = projectOfLead(lead, projects)
  const how = p ? projectHow(lead, projects) : ''
  const btn = e => { e.stopPropagation(); e.preventDefault(); if (onAssign) setOpen(e.currentTarget.getBoundingClientRect()) }
  return (
    <>
      <button type="button" className={`lp-chip lp-chip--${size}${p ? '' : ' is-empty'}`} onClick={btn} onPointerDown={e => e.stopPropagation()}
        style={p ? pv(p.color) : undefined} title={p ? `${p.name} · ${how === 'auto' ? t.auto : t.manual}` : t.pick} aria-label={p ? `${t.pick}: ${p.name}` : t.pick}>
        {p ? <><span className="lp-dot"/><bdi>{p.name}</bdi></> : <><Plus size={11}/>{t.one}</>}
      </button>
      {open && <ProjectPicker rect={open} projects={projects} current={p} lang={lang} onClose={() => setOpen(null)} onPick={x => { setOpen(null); onAssign?.(assignPatch(x), x) }}/>}
    </>
  )
}

/** A list of projects next to a point on the screen: search, "בלי פרויקט", create one by typing its name */
export function ProjectPicker({ rect, projects, current, lang = 'he', onPick, onClose }) {
  const t = tOf(lang)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef(null)
  const inRef = useRef(null)
  const closeRef = useRef(onClose); closeRef.current = onClose
  useEffect(() => {
    inRef.current?.focus()
    const down = e => { if (ref.current && !ref.current.contains(e.target)) closeRef.current?.() }
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current?.() } }
    setTimeout(() => document.addEventListener('pointerdown', down, true), 0)
    window.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true) }
  }, [])
  const s = q.trim().toLowerCase()
  const list = (projects || []).filter(p => p.status !== 'archived' && (!s || p.name.toLowerCase().includes(s) || p.town.toLowerCase().includes(s)))
  const exact = s && (projects || []).some(p => p.name.toLowerCase() === s)
  const create = async () => {
    setBusy(true); setErr('')
    try {
      const p = newProject({ name: q }, projects)
      await saveProjects([...(projects || []), p])
      onPick(p)
    } catch (e) { setErr(e.message); setBusy(false) }
  }
  const W = 260
  const left = Math.max(8, Math.min(window.innerWidth - W - 8, (lang === 'en' ? rect.left : rect.right - W)))
  const below = rect.bottom + 330 < window.innerHeight
  return createPortal(
    <div ref={ref} className="lp-pop" dir={lang === 'en' ? 'ltr' : 'rtl'} role="dialog" aria-label={t.pick} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
      style={{ left, width: W, ...(below ? { top: rect.bottom + 6 } : { bottom: window.innerHeight - rect.top + 6 }) }}>
      <div className="lp-pop-search"><Search size={13}/><input ref={inRef} value={q} onChange={e => setQ(e.target.value)} placeholder={t.search}
        onKeyDown={e => { if (e.key === 'Enter') { if (list.length) onPick(list[0]); else if (s && !exact) create() } }}/></div>
      <div className="lp-pop-list">
        {list.map(p => (
          <button key={p.id} type="button" className={`lp-opt${current?.id === p.id ? ' is-on' : ''}`} onClick={() => onPick(p)}>
            <span className="lp-dot" style={{ background: p.color }}/><bdi>{p.name}</bdi>{p.town && <small>{p.town}</small>}{current?.id === p.id && <Check size={14}/>}
          </button>
        ))}
        {s && !exact && <button type="button" className="lp-opt lp-opt--new" disabled={busy} onClick={create}><Plus size={14}/>{busy ? t.saving : t.create(q.trim())}</button>}
        {!s && <div className="lp-pop-hint">{list.length ? t.newHint : t.emptyHint}</div>}
        {current && <button type="button" className="lp-opt lp-opt--none" onClick={() => onPick(null)}><X size={13}/>{t.noProject}</button>}
      </div>
      {err && <div className="lp-err">{err}</div>}
      <style>{LP_CSS}</style>
    </div>,
    document.body,
  )
}

/** A form field: the chosen project (or a placeholder) → the picker — search the existing ones, or type a new name and
 *  create it (saved for everyone at once). value = project id ('' = none); onChange(id, project) */
export function ProjectSelect({ projects, value, lang = 'he', onChange }) {
  const t = tOf(lang)
  const [open, setOpen] = useState(null)
  const [picked, setPicked] = useState(null)        // a project made a moment ago, before the list arrives with it
  const p = (projects || []).find(x => x.id === value) || (picked?.id === value ? picked : null)
  return (
    <>
      <button type="button" className={`lp-sel${p ? '' : ' is-empty'}`} style={p ? pv(p.color) : undefined} aria-haspopup="dialog"
        onClick={e => setOpen(e.currentTarget.getBoundingClientRect())}>
        {p ? <span className="lp-dot"/> : <FolderKanban size={15}/>}
        <bdi>{p ? p.name : t.selPh}</bdi>
        {p && <span role="button" tabIndex={0} className="lp-sel-x" aria-label={t.noProject} title={t.noProject}
          onClick={e => { e.stopPropagation(); onChange('', null) }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onChange('', null) } }}><X size={14}/></span>}
        {!p && <Plus size={15}/>}
      </button>
      {open && <ProjectPicker rect={open} projects={projects} current={p} lang={lang} onClose={() => setOpen(null)}
        onPick={x => { setOpen(null); setPicked(x); onChange(x?.id || '', x) }}/>}
      <style>{LP_CSS}</style>
    </>
  )
}

/** The bar above the board: a "projects ▾" dropdown with every project (name, town, leads, open, its stage bar, search),
 *  the busiest projects as quick tabs, without a project, + new, manage. Campaigns with leads that no project covers become
 *  projects by themselves, once (autoProjects; the server remembers them, so a deleted one never comes back). */
export function ProjectsBar({ leads, projects, value, onChange, onManage, onNewProject, lang = 'he' }) {
  const t = tOf(lang)
  const counts = useMemo(() => projectCounts(leads, projects), [leads, projects])
  const active = useMemo(() => (projects || []).filter(p => p.status !== 'archived')
    .sort((a, b) => (counts[b.id]?.total || 0) - (counts[a.id]?.total || 0) || a.name.localeCompare(b.name, 'he')), [projects, counts])
  const sel = value && value !== NONE ? (projects || []).find(p => p.id === value) : null
  const cur = sel ? counts[sel.id] : null
  const [dd, setDd] = useState(null)
  const [note, setNote] = useState('')
  // the campaigns become projects by themselves (once per campaign, for everyone)
  const tried = useRef(false)
  useEffect(() => {
    if (tried.current || !projectsLoaded() || (leads || []).length < 5) return
    tried.current = true
    const made = autoProjects(leads, projects, getAutoDone())
    if (!made.length) return
    saveProjects([...(projects || []), ...made], [], { auto: made.map(p => p.name) })
      .then(() => { setNote(t.autoMade(made.length)); setTimeout(() => setNote(''), 6000) }).catch(() => { tried.current = false })
  }, [leads, projects]) // eslint-disable-line react-hooks/exhaustive-deps
  const quick = active.slice(0, 5)
  const label = sel ? sel.name : value === NONE ? t.none : t.all
  return (
    <div className="lp-bar" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <div className="lp-bar-row" role="tablist" aria-label={t.projects}>
        <button type="button" className={`lp-dd-btn${sel ? ' is-sel' : ''}`} style={sel ? pv(sel.color) : undefined} aria-haspopup="listbox" aria-expanded={!!dd}
          onClick={e => setDd(dd ? null : e.currentTarget.getBoundingClientRect())}>
          {sel ? <span className="lp-dot"/> : <FolderKanban size={15}/>}
          <span className="lp-dd-lbl"><small>{t.projects}</small><bdi>{label}</bdi></span>
          <em>{sel ? counts[sel.id]?.total || 0 : value === NONE ? counts[NONE]?.total || 0 : (leads || []).length}</em>
          <ChevronDown size={15}/>
        </button>
        <span className="lp-bar-sep" aria-hidden="true"/>
        {quick.map(p => (
          <button key={p.id} type="button" role="tab" aria-selected={value === p.id} className="lp-tab" style={pv(p.color)} onClick={() => onChange(value === p.id ? '' : p.id)}
            title={`${p.name}${p.town ? ` · ${p.town}` : ''} · ${t.leads(counts[p.id]?.total || 0)} · ${t.open(counts[p.id]?.open || 0)}`}>
            <span className="lp-dot"/><bdi>{p.name}</bdi><em>{counts[p.id]?.total || 0}</em>
          </button>
        ))}
        {active.length > quick.length && <button type="button" className="lp-bar-btn" onClick={e => setDd(e.currentTarget.getBoundingClientRect())}>+{active.length - quick.length}</button>}
        <button type="button" className="lp-bar-btn lp-bar-new" onClick={onNewProject}><Plus size={13}/>{t.add}</button>
        <button type="button" className="lp-bar-btn lp-bar-manage" onClick={onManage}><Settings2 size={13}/>{t.manage}</button>
        {note && <span className="lp-bar-note"><Check size={13}/>{note}</span>}
      </div>
      {dd && <ProjectsDropdown rect={dd} t={t} lang={lang} active={active} counts={counts} total={(leads || []).length} value={value}
        onPick={id => { setDd(null); onChange(id) }} onClose={() => setDd(null)} onNew={() => { setDd(null); onNewProject() }} onManage={() => { setDd(null); onManage() }}/>}
      {sel && cur && (
        <div className="lp-sum" style={pv(sel.color)}>
          <b><span className="lp-dot"/>{sel.name}</b>{sel.town && <span className="lp-town">{sel.town}</span>}
          <span className="lp-sum-n">{t.leads(cur.total)} · {t.open(cur.open)}</span>
          <StageBar byStage={cur.byStage} total={cur.total} t={t}/>
        </div>
      )}
      <style>{LP_CSS}</style>
    </div>
  )
}

function StageBar({ byStage, total, t }) {
  if (!total) return null
  return (
    <span className="lp-stagebar" role="img" aria-label={STAGE_ORDER.filter(s => byStage[s]).map(s => `${t.stages[s]} ${byStage[s]}`).join(', ')}>
      {STAGE_ORDER.filter(s => byStage[s]).map(s => (
        <span key={s} className="lp-seg" style={{ flexGrow: byStage[s], background: STAGE_COLOR[s] }} title={`${t.stages[s]}: ${byStage[s]}`}><i>{t.stages[s]} {byStage[s]}</i></span>
      ))}
    </span>
  )
}


const STAGE_COLORS = { new: '#3B82F6', contacted: '#0891B2', discovery: '#9333EA', meeting: '#D97706', negotiating: '#DB2777', won: '#16A34A', lost: '#94A3B8', nurture: '#65A30D', irrelevant: '#CBD5E1' }
/** Every project in one list (right to left, the busiest first): search, all leads, each project with its town, leads, open
 *  and stage bar, without a project; ↑ ↓ Enter Esc */
function ProjectsDropdown({ rect, t, lang, active, counts, total, value, onPick, onClose, onNew, onManage }) {
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const ref = useRef(null), inRef = useRef(null)
  const closeRef = useRef(onClose); closeRef.current = onClose
  useEffect(() => {
    inRef.current?.focus()
    const down = e => { if (ref.current && !ref.current.contains(e.target)) closeRef.current?.() }
    setTimeout(() => document.addEventListener('pointerdown', down, true), 0)
    return () => document.removeEventListener('pointerdown', down, true)
  }, [])
  const s = q.trim().toLowerCase()
  const rows = [
    ...(!s ? [{ id: '', name: t.allLeads, n: total, all: true }] : []),
    ...active.filter(p => !s || p.name.toLowerCase().includes(s) || (p.town || '').toLowerCase().includes(s) || (p.aliases || []).some(a => a.toLowerCase().includes(s)))
      .map(p => ({ id: p.id, p, name: p.name, n: counts[p.id]?.total || 0 })),
    ...(!s && counts[NONE]?.total ? [{ id: NONE, name: t.none, n: counts[NONE].total, none: true }] : []),
  ]
  const key = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(rows.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter' && rows[hi]) { e.preventDefault(); onPick(rows[hi].id) }
  }
  useEffect(() => { ref.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' }) }, [hi])
  const W = Math.min(420, window.innerWidth - 16)
  const left = Math.max(8, Math.min(window.innerWidth - W - 8, lang === 'en' ? rect.left : rect.right - W))
  const maxH = Math.max(260, window.innerHeight - rect.bottom - 24)
  return createPortal(
    <div ref={ref} className="lp-dd" dir={lang === 'en' ? 'ltr' : 'rtl'} role="dialog" aria-label={t.ddTitle} onKeyDown={key}
      style={{ left, width: W, top: rect.bottom + 6, maxHeight: Math.min(560, maxH) }}>
      <div className="lp-pop-search"><Search size={14}/><input ref={inRef} value={q} onChange={e => { setQ(e.target.value); setHi(0) }} placeholder={t.ddSearch} aria-label={t.ddSearch}/></div>
      <div className="lp-dd-list" role="listbox">
        {rows.map((r, i) => {
          const c = r.p ? counts[r.p.id] : null
          return (
            <button key={r.id || 'all'} type="button" role="option" data-i={i} aria-selected={value === r.id} className={`lp-dd-row${hi === i ? ' is-hi' : ''}${r.all || r.none ? ' is-meta' : ''}`}
              style={r.p ? pv(r.p.color) : undefined} onMouseEnter={() => setHi(i)} onClick={() => onPick(r.id)}>
              {r.p ? <span className="lp-dot"/> : r.all ? <FolderKanban size={15}/> : <X size={14}/>}
              <span className="lp-dd-main">
                <span className="lp-dd-name"><bdi>{r.name}</bdi>{r.p?.town && <small>{r.p.town}</small>}</span>
                {c && c.total > 0 && (
                  <span className="lp-dd-bar" aria-hidden="true">
                    {Object.entries(c.byStage).sort((a, b) => Object.keys(STAGE_COLORS).indexOf(a[0]) - Object.keys(STAGE_COLORS).indexOf(b[0]))
                      .map(([st, n]) => <i key={st} style={{ flexGrow: n, background: STAGE_COLORS[st] || '#94A3B8' }}/>)}
                  </span>
                )}
              </span>
              <span className="lp-dd-n"><b>{r.n}</b>{c ? <small>{t.openN(c.open)}</small> : null}</span>
              {value === r.id && <Check size={15} className="lp-dd-check"/>}
            </button>
          )
        })}
        {!rows.length && <div className="lp-pop-hint">{t.ddEmpty}</div>}
      </div>
      <div className="lp-dd-foot">
        <button type="button" className="lp-bar-btn" onClick={onNew}><Plus size={13}/>{t.add}</button>
        <button type="button" className="lp-bar-btn" onClick={onManage}><Settings2 size={13}/>{t.manage}</button>
      </div>
      <style>{LP_CSS}</style>
    </div>,
    document.body,
  )
}

/** Create / edit / archive / delete projects, with each one's stage breakdown */
export function ProjectsManager({ leads, projects, lang = 'he', startNew = false, onClose, onShow }) {
  const t = tOf(lang)
  const counts = useMemo(() => projectCounts(leads, projects), [leads, projects])
  const sugg = useMemo(() => projectSuggestions(leads, projects), [leads, projects])
  const [edit, setEdit] = useState(startNew ? { id: '', name: '', town: '', color: '', aliases: '' } : null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const closeRef = useRef(onClose); closeRef.current = onClose
  useEffect(() => { const k = e => { if (e.key === 'Escape' && !e.defaultPrevented) closeRef.current?.() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [])
  const run = async fn => { setBusy(true); setErr(''); try { await fn(); return true } catch (e) { setErr(e.message); return false } finally { setBusy(false) } }
  const save = () => run(async () => {
    const aliases = String(edit.aliases || '').split(/[,\n]+/).map(s => s.trim()).filter(Boolean)
    if (!edit.id) await saveProjects([...projects, newProject({ name: edit.name, town: edit.town, color: edit.color || undefined, aliases }, projects)])
    else {
      const others = projects.filter(p => p.id !== edit.id)
      if (!edit.name.trim()) throw new Error(lang === 'en' ? 'A name is needed' : 'צריך שם לפרויקט')
      if (others.some(p => p.name.trim() === edit.name.trim())) throw new Error(lang === 'en' ? 'That name is taken' : 'כבר יש פרויקט בשם הזה')
      await saveProjects(projects.map(p => (p.id === edit.id ? { ...p, name: edit.name, town: edit.town, color: edit.color || p.color, aliases } : p)))
    }
    setEdit(null)
  })
  const fromCamp = name => run(async () => { await saveProjects([...projects, newProject({ name, aliases: [name] }, projects)]) })
  const toggleArchive = p => run(() => saveProjects(projects.map(x => (x.id === p.id ? { ...x, status: x.status === 'archived' ? 'active' : 'archived' } : x))))
  const del = p => { if (window.confirm(t.delAsk(p.name))) run(() => saveProjects(projects.filter(x => x.id !== p.id), [p.id])) }
  // merging: tick projects (or take a suggested group) → pick the name that stays (or type one) → one project
  const [pick, setPick] = useState([])
  const [mg, setMg] = useState(null)            // { ids, into, name }
  const [done, setDone] = useState('')
  const dups = useMemo(() => duplicateGroups(projects), [projects])
  const togglePick = id => setPick(x => (x.includes(id) ? x.filter(y => y !== id) : [...x, id]))
  const openMerge = ids => {
    const best = [...ids].sort((a, b) => (counts[b]?.total || 0) - (counts[a]?.total || 0))[0]
    setMg({ ids, into: best, name: '' }); setErr(''); setEdit(null)
  }
  const doMerge = () => run(async () => {
    const r = mergeProjects(projects, mg.ids, mg.into, { name: mg.name })
    const n = r.removed.length + 1
    await saveProjects(r.list, r.removed, { merge: { from: r.removed, into: r.into.id } })
    setDone(t.mergeDone(n, r.into.name, 0)); setTimeout(() => setDone(''), 6000)
    setMg(null); setPick([])
  })
  const mgTotal = mg ? mg.ids.reduce((a, id) => a + (counts[id]?.total || 0), 0) : 0

  return createPortal(
    <div className="lp-modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="lp-modal" role="dialog" aria-modal="true" aria-label={t.title} dir={lang === 'en' ? 'ltr' : 'rtl'}>
        <div className="lp-modal-head">
          <h3><FolderKanban size={17}/>{t.title}</h3>
          {!edit && <button type="button" className="lp-primary" onClick={() => setEdit({ id: '', name: '', town: '', color: '', aliases: '' })}><Plus size={14}/>{t.add}</button>}
          <button type="button" className="lp-x" onClick={onClose} aria-label={t.cancel}><X size={17}/></button>
        </div>
        <p className="lp-sub">{t.sub}</p>
        {edit && (
          <div className="lp-form">
            <label>{t.name}<input autoFocus value={edit.name} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} placeholder={t.namePh} onKeyDown={e => { if (e.key === 'Enter') save() }}/></label>
            <label>{t.town}<input value={edit.town} onChange={e => setEdit(x => ({ ...x, town: e.target.value }))} placeholder={t.townPh}/></label>
            <div className="lp-colors" role="radiogroup" aria-label={t.color}>
              <span>{t.color}</span>
              {PROJECT_COLORS.map(c => <button key={c} type="button" role="radio" aria-checked={edit.color === c} aria-label={c} className="lp-color" style={{ background: c }} onClick={() => setEdit(x => ({ ...x, color: c }))}>{edit.color === c && <Check size={13}/>}</button>)}
            </div>
            <label className="lp-wide">{t.aliases}<input value={edit.aliases} onChange={e => setEdit(x => ({ ...x, aliases: e.target.value }))} placeholder={t.aliasesPh}/></label>
            <div className="lp-form-foot">
              <button type="button" className="lp-primary" disabled={busy || !edit.name.trim()} onClick={save}>{busy ? t.saving : t.save}</button>
              <button type="button" className="lp-secondary" onClick={() => { setEdit(null); setErr('') }}>{t.cancel}</button>
            </div>
          </div>
        )}
        {mg && (
          <div className="lp-merge" role="group" aria-label={t.mergeTitle}>
            <b className="lp-merge-h"><GitMerge size={15}/>{t.mergeTitle}</b>
            <span className="lp-merge-q">{t.mergeKeep}</span>
            <div className="lp-merge-opts" role="radiogroup">
              {mg.ids.map(id => projects.find(p => p.id === id)).filter(Boolean).map(p => (
                <label key={p.id} className={`lp-merge-opt${mg.into === p.id && !mg.name ? ' is-on' : ''}`} style={pv(p.color)}>
                  <input type="radio" name="lp-into" checked={mg.into === p.id && !mg.name} onChange={() => setMg(x => ({ ...x, into: p.id, name: '' }))}/>
                  <span className="lp-dot"/><bdi>{p.name}</bdi><em>{counts[p.id]?.total || 0}</em>
                </label>
              ))}
            </div>
            <label className="lp-merge-own">{t.mergeOwn}<input value={mg.name} onChange={e => setMg(x => ({ ...x, name: e.target.value }))} placeholder={projects.find(p => p.id === mg.into)?.name}/></label>
            <p className="lp-merge-what">{t.mergeWhat(mgTotal, mg.name.trim() || projects.find(p => p.id === mg.into)?.name || '')}</p>
            <div className="lp-form-foot">
              <button type="button" className="lp-primary" disabled={busy} onClick={doMerge}><GitMerge size={14}/>{busy ? t.saving : t.mergeGo}</button>
              <button type="button" className="lp-secondary" onClick={() => setMg(null)}>{t.cancel}</button>
            </div>
          </div>
        )}
        {err && <div className="lp-err">{err}</div>}
        {done && <div className="lp-done"><Check size={14}/>{done}</div>}
        {!mg && dups.length > 0 && (
          <div className="lp-dups">
            <b><GitMerge size={14}/>{t.dupTitle}</b>
            {dups.map(g => (
              <div key={g.map(p => p.id).join()} className="lp-dup">
                {g.map(p => <span key={p.id} className="lp-dup-p" style={pv(p.color)}><span className="lp-dot"/><bdi>{p.name}</bdi><em>{counts[p.id]?.total || 0}</em></span>)}
                <button type="button" className="lp-primary lp-sm" onClick={() => openMerge(g.map(p => p.id))}><GitMerge size={13}/>{t.mergeBtn}</button>
              </div>
            ))}
          </div>
        )}
        {pick.length > 0 && !mg && (
          <div className="lp-pickbar">
            <span>{t.mergeSel(pick.length)}</span>
            <button type="button" className="lp-primary lp-sm" disabled={pick.length < 2} onClick={() => openMerge(pick)}><GitMerge size={13}/>{t.mergeBtn}</button>
            <button type="button" className="lp-secondary lp-sm" onClick={() => setPick([])}>{t.cancelSel}</button>
          </div>
        )}
        <div className="lp-cards">
          {!projects.length && !edit && <div className="lp-empty">{t.empty}</div>}
          {projects.map(p => {
            const c = counts[p.id] || { total: 0, open: 0, byStage: {} }
            return (
              <div key={p.id} className={`lp-card${p.status === 'archived' ? ' is-archived' : ''}${pick.includes(p.id) ? ' is-picked' : ''}`} style={pv(p.color)}>
                <div className="lp-card-top">
                  <label className="lp-pick" title={t.selectToMerge}><input type="checkbox" checked={pick.includes(p.id)} onChange={() => togglePick(p.id)} aria-label={`${t.selectToMerge}: ${p.name}`}/></label>
                  <span className="lp-dot"/><b><bdi>{p.name}</bdi></b>{p.town && <span className="lp-town">{p.town}</span>}
                  {p.status === 'archived' && <span className="lp-badge">{t.archived}</span>}
                  <span className="lp-card-n">{t.leads(c.total)} · {t.open(c.open)}</span>
                </div>
                <StageBar byStage={c.byStage} total={c.total} t={t}/>
                {p.aliases.length > 0 && <div className="lp-aliases">{p.aliases.map(a => <span key={a}>{a}</span>)}</div>}
                <div className="lp-card-act">
                  {onShow && <button type="button" className="lp-secondary" onClick={() => onShow(p.id)}>{t.showLeads}</button>}
                  <button type="button" className="lp-secondary lp-docs" onClick={() => { onClose?.(); window.dispatchEvent(new CustomEvent('afik:project-docs', { detail: { projectId: p.id } })) }} title="כל המסמכים של הפרויקט — טפסים שנשלחו, נחתמו, ממתינים">{lang === 'en' ? 'Documents' : 'מסמכים וחתימות'}</button>
                  <button type="button" className="lp-icon" title={t.mergeBtn} aria-label={`${t.mergeBtn}: ${p.name}`} disabled={projects.length < 2} onClick={() => { if (!pick.includes(p.id)) togglePick(p.id) }}><GitMerge size={14}/></button>
                  <button type="button" className="lp-icon" title={t.edit} aria-label={`${t.edit}: ${p.name}`} onClick={() => setEdit({ id: p.id, name: p.name, town: p.town, color: p.color, aliases: p.aliases.join(', ') })}><Pencil size={14}/></button>
                  <button type="button" className="lp-icon" title={p.status === 'archived' ? t.unarchive : t.archive} aria-label={p.status === 'archived' ? t.unarchive : t.archive} disabled={busy} onClick={() => toggleArchive(p)}>{p.status === 'archived' ? <ArchiveRestore size={14}/> : <Archive size={14}/>}</button>
                  <button type="button" className="lp-icon lp-del" title={t.del} aria-label={`${t.del}: ${p.name}`} disabled={busy} onClick={() => del(p)}><Trash2 size={14}/></button>
                </div>
              </div>
            )
          })}
        </div>
        {sugg.length > 0 && (
          <div className="lp-sugg">
            <b>{t.suggest}</b>
            {sugg.map(x => <button key={x.name} type="button" disabled={busy} onClick={() => fromCamp(x.name)}><Plus size={12}/><bdi>{x.name}</bdi><em>{x.count}</em></button>)}
          </div>
        )}
        <style>{LP_CSS}</style>
      </div>
    </div>,
    document.body,
  )
}

/** "ליד חדש": name, phone, email, project, stage, where from, a first note, the welcome — saved on the server */
export function NewLeadDialog({ projects, defaultProjectId = '', defaultStage = 'new', lang = 'he', onClose, onCreated }) {
  const t = tOf(lang)
  const [f, setF] = useState({ name: '', phone: '', email: '', projectId: defaultProjectId && defaultProjectId !== NONE ? defaultProjectId : '', leadStatus: STAGE_ORDER.includes(defaultStage) ? defaultStage : 'new', source: 'phone', sourceDetail: '', note: '', welcome: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = k => e => setF(x => ({ ...x, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))
  const closeRef = useRef(onClose); closeRef.current = onClose
  useEffect(() => { const k = e => { if (e.key === 'Escape' && !e.defaultPrevented) closeRef.current?.() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [])
  const active = (projects || []).filter(p => p.status !== 'archived')
  const [pickedProj, setPickedProj] = useState(null)
  const proj = active.find(p => p.id === f.projectId) || (pickedProj?.id === f.projectId ? pickedProj : null)
  const ok = /\d{9,}/.test(f.phone.replace(/\D/g, '')) || /\S+@\S+\.\S+/.test(f.email)
  const save = async () => {
    if (!ok) { setErr(t.nlNeed); return }
    setBusy(true); setErr('')
    const r = await fetch('/api/contacts?manual=1', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer AFIKhanahal2026' },
      body: JSON.stringify({ ...f, projectName: proj?.name || '' }), signal: AbortSignal.timeout(25000) }).catch(e => ({ ok: false, json: async () => ({ error: e.message }) }))
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d.id) { setBusy(false); setErr(d.error || t.nlErr); return }
    onCreated?.(d)
    onClose()
  }
  return createPortal(
    <div className="lp-modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="lp-modal lp-modal--sm" role="dialog" aria-modal="true" aria-label={t.nlTitle} dir={lang === 'en' ? 'ltr' : 'rtl'}>
        <div className="lp-modal-head"><h3><UserPlus size={17}/>{t.nlTitle}</h3><button type="button" className="lp-x" onClick={onClose} aria-label={t.cancel}><X size={17}/></button></div>
        <div className="lp-form lp-form--lead">
          <label className="lp-wide">{t.nlName}<input autoFocus value={f.name} onChange={set('name')}/></label>
          <label>{t.nlPhone}<input value={f.phone} onChange={set('phone')} dir="ltr" inputMode="tel" placeholder="05X-XXX-XXXX"/></label>
          <label>{t.nlEmail}<input value={f.email} onChange={set('email')} dir="ltr" inputMode="email"/></label>
          <div className="lp-wide lp-field">
            <span>{t.nlProject}</span>
            <ProjectSelect projects={projects} value={f.projectId} lang={lang} onChange={(id, x) => { setF(v => ({ ...v, projectId: id })); setPickedProj(x) }}/>
            {active.length > 0 && (
              <div className="lp-pchoices">
                {active.slice(0, 6).map(p => <button key={p.id} type="button" aria-pressed={f.projectId === p.id} className="lp-pchoice" style={pv(p.color)} onClick={() => { setF(x => ({ ...x, projectId: x.projectId === p.id ? '' : p.id })); setPickedProj(p) }}><span className="lp-dot"/><bdi>{p.name}</bdi></button>)}
              </div>
            )}
          </div>
          <label>{t.nlStage}<select value={f.leadStatus} onChange={set('leadStatus')}>{STAGE_ORDER.map(s => <option key={s} value={s}>{t.stages[s]}</option>)}</select></label>
          <label>{t.nlSource}<select value={f.source} onChange={set('source')}>{MANUAL_SOURCES.map(s => <option key={s} value={s}>{t.sources[s]}</option>)}</select></label>
          <label className="lp-wide">{t.nlDetail}<input value={f.sourceDetail} onChange={set('sourceDetail')}/></label>
          <label className="lp-wide">{t.nlNote}<textarea rows={3} value={f.note} onChange={set('note')} placeholder={t.nlNotePh}/></label>
          <label className="lp-wide lp-check"><input type="checkbox" checked={f.welcome} onChange={set('welcome')} disabled={!f.phone}/>{t.nlWelcome}</label>
        </div>
        {err && <div className="lp-err">{err}</div>}
        <div className="lp-form-foot">
          <button type="button" className="lp-primary" disabled={busy || !ok} onClick={save}>{busy ? t.saving : t.nlSave}</button>
          <button type="button" className="lp-secondary" onClick={onClose}>{t.cancel}</button>
        </div>
        <style>{LP_CSS}</style>
      </div>
    </div>,
    document.body,
  )
}

export const LP_CSS = `
.lp-dot{width:8px;height:8px;border-radius:50%;background:var(--pc,#3B82F6);box-shadow:0 0 0 2px var(--pcb,rgba(59,130,246,.18));flex-shrink:0;display:inline-block}
.lp-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;height:24px;min-height:0;min-width:0;border:1px solid var(--au-line,rgba(20,30,80,.14));background:var(--au-pop,#fff);color:var(--au-text,#1f2937);border-radius:999px;padding:0 9px 0 8px;font:600 11.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:0;line-height:1.6}
.lp-chip bdi{overflow:hidden;text-overflow:ellipsis}
.lp-chip:hover{border-color:var(--pc,#3B82F6);box-shadow:0 0 0 3px var(--pcs,rgba(59,130,246,.08))}
.lp-chip:not(.is-empty)::after{content:'';width:5px;height:5px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:translateY(-1.5px) rotate(45deg);opacity:.5;flex:none;margin-inline-start:1px}
.lp-chip.is-empty{border:1px dashed rgba(var(--ink,20,30,80),.25);background:transparent;color:var(--au-text3,#8a90a6);font-weight:500}
.lp-chip.is-empty:hover{color:var(--au-brand-text,#3F4EB0);border-color:var(--au-brand,#3F4EB0)}
.lp-chip--md{height:32px;font-size:13px;padding:0 12px 0 10px;gap:7px;box-shadow:0 1px 2px rgba(20,30,80,.05)}.lp-chip--md .lp-dot{width:9px;height:9px}
.lp-pop{position:fixed;z-index:5200;background:var(--au-pop,#fff);color:var(--au-text,#111);border:1px solid var(--au-line,#e5e7eb);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.18);font-family:Rubik,sans-serif;overflow:hidden}
.lp-pop-search{display:flex;align-items:center;gap:7px;padding:9px 11px;border-bottom:1px solid var(--au-line,#e5e7eb);color:var(--au-text3,#888)}
.lp-pop-search input{flex:1;min-width:0;border:none;outline:none;background:none;font:13px Rubik,sans-serif;color:var(--au-text,#111);min-height:0}
.lp-pop-list{max-height:260px;overflow:auto;padding:4px}
.lp-opt{width:100%;display:flex;align-items:center;gap:8px;border:none;background:none;border-radius:8px;padding:7px 9px;font:500 13px Rubik,sans-serif;color:var(--au-text,#111);cursor:pointer;text-align:start;min-height:0}
.lp-opt:hover,.lp-opt.is-on{background:rgba(var(--ov,20,30,80),.06)}
.lp-opt small{color:var(--au-text3,#888);font-size:11.5px}
.lp-opt svg:last-child{margin-inline-start:auto}
.lp-opt--new{color:var(--au-brand-text,#3F4EB0);font-weight:600}
.lp-pop-hint{padding:8px 10px;font-size:12px;color:var(--au-text3,#888);line-height:1.5}
.lp-sel{display:flex;align-items:center;gap:8px;width:100%;height:40px;padding:0 12px;border:1px solid var(--au-line,#e5e7eb);border-radius:10px;background:var(--au-input,var(--au-pop,#fff));color:var(--au-text,#111);font:500 14px Rubik,sans-serif;cursor:pointer;text-align:start;min-height:0}
.lp-sel:hover{border-color:var(--au-brand,#3F4EB0)}
.lp-sel.is-empty{color:var(--au-text3,#888)}
.lp-sel bdi{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp-sel-x{display:inline-flex;border:none;background:none;color:var(--au-text3,#888);padding:3px;border-radius:6px;cursor:pointer;min-height:0}
.lp-opt--none{color:var(--au-text2,#666)}
.lp-err{margin:8px 12px;font-size:12.5px;color:#DC2626}
.lp-bar{padding:8px 0 10px}
.lp-bar-row{display:flex;align-items:center;gap:6px;overflow-x:auto;scrollbar-width:thin;padding-bottom:2px}
.lp-bar-lbl{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--au-text2,#555);white-space:nowrap;margin-inline-end:4px}
.lp-tab{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--au-text2,#555);font:500 12.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0;flex-shrink:0;transition:background .12s,color .12s}
.lp-tab em{font-style:normal;font-size:11px;font-weight:700;border-radius:999px;padding:0 6px;background:rgba(var(--ov,20,30,80),.07);color:var(--au-text2,#555)}
.lp-tab:hover{color:var(--au-text,#111);background:rgba(var(--ov,20,30,80),.05)}
.lp-tab[aria-selected=true]{background:var(--pcb,rgba(var(--brand-rgb,63,78,176),.12));color:var(--au-text,#111);font-weight:600}
.lp-tab--none{border-style:dashed}
.lp-dd-btn{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 12px;border:1px solid rgba(var(--ov,20,30,80),.1);border-radius:11px;background:var(--au-card,var(--au-pop,#fff));color:var(--au-text,#111);font:600 13.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0;flex-shrink:0;box-shadow:0 1px 2px rgba(20,30,80,.04);transition:border-color .12s,box-shadow .12s}
.lp-dd-btn:hover,.lp-dd-btn[aria-expanded=true]{border-color:rgba(var(--ov,20,30,80),.22);box-shadow:0 2px 8px rgba(20,30,80,.07)}
.lp-dd-btn.is-sel{border-color:var(--pc);background:var(--pcb)}
.lp-dd-lbl{display:flex;flex-direction:column;align-items:flex-start;line-height:1.15;max-width:220px}
.lp-dd-lbl small{font-size:10.5px;font-weight:500;color:var(--au-text3,#888)}
.lp-dd-lbl bdi{overflow:hidden;text-overflow:ellipsis;max-width:100%}
.lp-dd-btn em{font-style:normal;font-size:11.5px;font-weight:700;border-radius:999px;padding:1px 7px;background:rgba(var(--ov,20,30,80),.08);color:var(--au-text2,#555)}
.lp-bar-sep{width:1px;height:22px;background:var(--au-line,#e5e7eb);flex-shrink:0;margin:0 2px}
.lp-bar-note{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:#15803D;white-space:nowrap}
.lp-dd{position:fixed;z-index:5200;display:flex;flex-direction:column;background:var(--au-pop,#fff);color:var(--au-text,#111);border:1px solid var(--au-line,#e5e7eb);border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.2);font-family:Rubik,sans-serif;overflow:hidden}
.lp-dd .lp-pop-search{padding:11px 13px}
.lp-dd .lp-pop-search input{font-size:14px}
.lp-dd-list{flex:1;min-height:0;overflow:auto;padding:5px}
.lp-dd-row{width:100%;display:flex;align-items:center;gap:10px;border:none;background:none;border-radius:10px;padding:9px 10px;cursor:pointer;text-align:start;color:var(--au-text,#111);font-family:inherit;min-height:0}
.lp-dd-row.is-hi{background:rgba(var(--ov,20,30,80),.06)}
.lp-dd-row[aria-selected=true]{background:var(--pcb,rgba(var(--brand-rgb,63,78,176),.1))}
.lp-dd-row.is-meta{color:var(--au-text2,#555)}
.lp-dd-row .lp-dot{width:10px;height:10px}
.lp-dd-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.lp-dd-name{display:flex;align-items:baseline;gap:7px;font-size:14px;font-weight:600;min-width:0}
.lp-dd-name bdi{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lp-dd-name small{font-size:11.5px;font-weight:400;color:var(--au-text3,#888);white-space:nowrap}
.lp-dd-bar{display:flex;gap:2px;height:5px;border-radius:3px;overflow:hidden;max-width:220px}
.lp-dd-bar i{display:block;min-width:3px;border-radius:2px}
.lp-dd-n{display:flex;flex-direction:column;align-items:flex-end;line-height:1.2;flex-shrink:0}
.lp-dd-n b{font-size:14px}
.lp-dd-n small{font-size:10.5px;color:var(--au-text3,#888)}
.lp-dd-check{color:var(--au-brand-text,#3F4EB0);flex-shrink:0}
.lp-dd-foot{display:flex;justify-content:space-between;gap:6px;padding:6px 8px;border-top:1px solid var(--au-line,#e5e7eb)}
.lp-bar-btn{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:none;background:none;color:var(--au-brand-text,#3F4EB0);font:600 12.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0;flex-shrink:0;border-radius:8px}
.lp-bar-btn:hover{background:rgba(var(--brand-rgb,63,78,176),.08)}
.lp-sum{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;margin-top:8px;padding:8px 12px;border-radius:12px;border:1px solid rgba(var(--ov,20,30,80),.08);background:var(--au-card,var(--au-pop,#fff));font-size:12.5px}
.lp-sum{color:var(--au-text,#111)}
.lp-sum b{display:inline-flex;align-items:center;gap:7px;font-size:14px;color:var(--au-text,#111)}
.lp-town{color:var(--au-text3,#888);font-size:12px}
.lp-sum-n{color:var(--au-text2,#555)}
.lp-stagebar{display:flex;flex:1;min-width:200px;height:18px;border-radius:6px;overflow:hidden;gap:2px}
.lp-seg{display:flex;align-items:center;justify-content:center;min-width:6px;color:#fff;font-size:10.5px;font-weight:600;overflow:hidden;white-space:nowrap;opacity:.88;border-radius:4px}
.lp-seg i{font-style:normal;padding:0 5px;overflow:hidden;text-overflow:ellipsis}
.lp-modal-bg{position:fixed;inset:0;z-index:4000;background:rgba(0,0,0,.42);display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px 16px}
.lp-modal{width:min(860px,100%);max-height:88vh;overflow:auto;background:var(--au-pop,#fff);color:var(--au-text,#111);border:1px solid var(--au-line,#e5e7eb);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.3);padding:16px 18px 18px;font-family:Rubik,sans-serif}
.lp-modal--sm{width:min(560px,100%)}
.lp-modal-head{display:flex;align-items:center;gap:10px}
.lp-modal-head h3{flex:1;margin:0;display:inline-flex;align-items:center;gap:8px;font-size:17px;font-weight:700}
.lp-x{border:none;background:none;color:var(--au-text3,#888);cursor:pointer;padding:4px;border-radius:8px;display:inline-flex;min-height:0}
.lp-x:hover{background:rgba(var(--ov,20,30,80),.07)}
.lp-sub{margin:6px 0 12px;font-size:12.5px;color:var(--au-text2,#555);line-height:1.6}
.lp-primary{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px;border:none;border-radius:9px;background:var(--au-brand,#3F4EB0);color:#fff;font:600 13px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0}
.lp-primary:disabled{opacity:.45;cursor:default}
.lp-secondary{height:34px;padding:0 13px;border:1px solid var(--au-line,#e5e7eb);border-radius:9px;background:none;color:var(--au-text,#111);font:500 12.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0}
.lp-icon{width:32px;height:32px;border:1px solid var(--au-line,#e5e7eb);border-radius:8px;background:none;color:var(--au-text2,#555);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;min-height:0}
.lp-icon:hover{color:var(--au-text,#111)}
.lp-del:hover{color:#DC2626;border-color:rgba(220,38,38,.4)}
.lp-form{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px;padding:12px;border:1px solid var(--au-line,#e5e7eb);border-radius:12px;margin-bottom:12px;background:rgba(var(--ov,20,30,80),.02)}
.lp-form--lead{border:none;padding:4px 0;background:none;margin:8px 0 0}
.lp-form label,.lp-field{display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:600;color:var(--au-text2,#555)}
.lp-form input,.lp-form select,.lp-form textarea{height:38px;box-sizing:border-box;border:1px solid var(--au-line,#e5e7eb);border-radius:9px;padding:0 11px;font:13.5px Rubik,sans-serif;background:var(--au-input,var(--au-pop,#fff));color:var(--au-text,#111);outline:none;min-height:0}
.lp-form select{appearance:auto;-webkit-appearance:menulist}
.lp-form textarea{height:auto;padding:8px 11px;resize:vertical;line-height:1.5}
.lp-form input:focus,.lp-form select:focus,.lp-form textarea:focus{border-color:var(--au-brand,#3F4EB0);box-shadow:0 0 0 3px rgba(var(--brand-rgb,63,78,176),.15)}
.lp-wide{grid-column:1/-1}
.lp-check{flex-direction:row!important;align-items:center;gap:8px!important;font-weight:500!important;color:var(--au-text,#111)!important;cursor:pointer}
.lp-check input{width:17px;height:17px;appearance:auto}
.lp-colors{grid-column:1/-1;display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:12.5px;font-weight:600;color:var(--au-text2,#555)}
.lp-colors span{margin-inline-end:4px}
.lp-color{width:24px;height:24px;border-radius:50%;border:2px solid transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;min-height:0}
.lp-color[aria-checked=true]{box-shadow:0 0 0 2px var(--au-pop,#fff),0 0 0 4px currentColor}
.lp-form-foot{grid-column:1/-1;display:flex;gap:8px;margin-top:4px}
.lp-pchoices{display:flex;flex-wrap:wrap;gap:6px}
.lp-sel + .lp-pchoices{margin-top:7px}
.lp-pchoice{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border:1px solid var(--au-line,#e5e7eb);border-radius:999px;background:none;color:var(--au-text2,#555);font:500 12.5px Rubik,sans-serif;cursor:pointer;min-height:0}
.lp-pchoice[aria-pressed=true]{border-color:var(--pc,var(--au-brand,#3F4EB0));background:var(--pcb,rgba(var(--brand-rgb,63,78,176),.12));color:var(--au-text,#111);font-weight:700}
.lp-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.lp-card{display:flex;flex-direction:column;gap:9px;padding:12px;border:1px solid var(--au-line,#e5e7eb);border-top:4px solid var(--pc);border-radius:12px;background:var(--au-pop,#fff)}
.lp-card.is-archived{opacity:.6}
.lp-card-top{display:flex;align-items:center;flex-wrap:wrap;gap:6px 8px}
.lp-card-top b{font-size:14.5px}
.lp-card-n{flex-basis:100%;font-size:12px;color:var(--au-text2,#555)}
.lp-badge{font-size:10.5px;font-weight:700;border-radius:5px;padding:1px 6px;background:rgba(var(--ov,20,30,80),.08);color:var(--au-text2,#555)}
.lp-aliases{display:flex;flex-wrap:wrap;gap:4px}
.lp-aliases span{font-size:11px;border-radius:5px;padding:1px 6px;background:rgba(var(--ov,20,30,80),.06);color:var(--au-text2,#555)}
.lp-card.is-picked{box-shadow:0 0 0 2px var(--au-brand,#3F4EB0)}
.lp-pick{display:inline-flex;align-items:center;cursor:pointer}
.lp-pick input{width:17px;height:17px;accent-color:var(--au-brand,#3F4EB0);cursor:pointer;margin:0;appearance:auto}
.lp-sm{height:30px!important;padding:0 11px!important;font-size:12.5px!important}
.lp-done{display:flex;align-items:center;gap:7px;margin:8px 0;padding:9px 12px;border-radius:10px;background:rgba(22,163,74,.1);color:#15803D;font-size:13px;font-weight:600}
.lp-dups{display:flex;flex-direction:column;gap:7px;margin:10px 0 4px;padding:11px 12px;border-radius:12px;border:1px solid rgba(217,119,6,.35);background:rgba(217,119,6,.07)}
.lp-dups>b{display:inline-flex;align-items:center;gap:7px;font-size:13px}
.lp-dup{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.lp-dup-p{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:999px;border:1px solid var(--pcl);background:var(--pcb);font-size:12.5px;font-weight:600}
.lp-dup-p em,.lp-merge-opt em{font-style:normal;font-size:11px;color:var(--au-text3,#888);font-weight:700}
.lp-pickbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;margin:8px 0;padding:8px 12px;border-radius:10px;background:rgba(var(--brand-rgb,63,78,176),.1);font-size:13px;font-weight:600}
.lp-pickbar span{flex:1}
.lp-merge{display:flex;flex-direction:column;gap:8px;margin:10px 0;padding:14px;border-radius:12px;border:1px solid rgba(var(--brand-rgb,63,78,176),.4);background:rgba(var(--brand-rgb,63,78,176),.05)}
.lp-merge-h{display:inline-flex;align-items:center;gap:7px;font-size:14.5px}
.lp-merge-q{font-size:12.5px;font-weight:600;color:var(--au-text2,#555)}
.lp-merge-opts{display:flex;flex-wrap:wrap;gap:7px}
.lp-merge-opt{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--au-line,#e5e7eb);background:var(--au-pop,#fff);cursor:pointer;font-size:13.5px;font-weight:600}
.lp-merge-opt input{margin:0;accent-color:var(--pc);appearance:auto}
.lp-merge-opt.is-on{border-color:var(--pc);background:var(--pcb)}
.lp-merge-own{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--au-text2,#555)}
.lp-merge-own input{flex:1;max-width:320px;height:36px;border:1px solid var(--au-line,#e5e7eb);border-radius:9px;padding:0 10px;font:14px Rubik,sans-serif;background:var(--au-input,var(--au-pop,#fff));color:var(--au-text,#111)}
.lp-merge-what{margin:0;font-size:12.5px;color:var(--au-text2,#555);line-height:1.6}
.lp-card-act{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:auto}
.lp-card-act .lp-secondary{flex:1 1 100%;justify-content:center}
.lp-card-act .lp-docs{flex:1 1 100%}
.lp-empty{grid-column:1/-1;padding:24px;text-align:center;color:var(--au-text3,#888);font-size:13px}
.lp-sugg{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:14px;padding-top:12px;border-top:1px solid var(--au-line,#e5e7eb);font-size:12.5px}
.lp-sugg b{margin-inline-end:4px;color:var(--au-text2,#555)}
.lp-sugg button{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:1px dashed var(--au-line,#ccc);border-radius:999px;background:none;color:var(--au-text,#111);font:500 12px Rubik,sans-serif;cursor:pointer;min-height:0}
.lp-sugg button:hover{border-color:var(--au-brand,#3F4EB0);color:var(--au-brand-text,#3F4EB0)}
.lp-sugg em{font-style:normal;font-size:11px;color:var(--au-text3,#888)}
@media (max-width:640px){.lp-bar-new,.lp-bar-manage{display:none}.lp-form{grid-template-columns:1fr}.lp-modal{padding:14px}.lp-stagebar{min-width:100%}}
`
