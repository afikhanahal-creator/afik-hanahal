// Projects (deals) on the leads board: the bar of projects above the board (a filter, counts, "+ פרויקט חדש", "ניהול"), the
// projects manager (create / edit / colors / campaign names that join by themselves / archive / delete, a stage breakdown per
// project, "create from a campaign"), the project chip on every lead with its picker (move a lead between projects in one click),
// and the "ליד חדש" dialog that saves a lead to the server with its project. Rules: lib/projects.js; the list: src/lib/projectsStore.js.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FolderKanban, Plus, Settings2, X, Check, Search, Archive, ArchiveRestore, Trash2, Pencil, UserPlus } from 'lucide-react'
import { projectOfLead, projectHow, projectCounts, projectSuggestions, newProject, assignPatch, PROJECT_COLORS, NONE } from '../lib/projects.js'
import { saveProjects } from './lib/projectsStore.js'
import { MANUAL_SOURCES } from '../lib/manual-lead.js'

const TXT = {
  he: {
    all: 'כל הפרויקטים', one: 'פרויקט', none: 'בלי פרויקט', add: 'פרויקט חדש', manage: 'ניהול פרויקטים', projects: 'פרויקטים',
    open: n => `${n} פתוחים`, leads: n => (n === 1 ? 'ליד אחד' : `${n} לידים`), pick: 'שיוך לפרויקט', search: 'חיפוש פרויקט…',
    noProject: 'בלי פרויקט', create: n => `יצירת פרויקט "${n}"`, auto: 'שויך לפי הקמפיין', manual: 'שויך ידנית',
    title: 'פרויקטים', sub: 'כל נכס או פרויקט שמנהלים במקביל. ליד שייך לפרויקט אחד; לידים מקמפיין שמופיע בשמות הנוספים נכנסים אליו לבד.',
    name: 'שם הפרויקט', namePh: 'למשל: זרובבל 15', town: 'עיר', townPh: 'למשל: רמת השרון', color: 'צבע',
    aliases: 'שמות קמפיין / נכס שנכנסים לפרויקט לבד', aliasesPh: 'למשל: זרובבל 15 - v2, פנטהאוז זרובבל', save: 'שמירה', cancel: 'ביטול',
    edit: 'עריכה', archive: 'העברה לארכיון', unarchive: 'החזרה מהארכיון', del: 'מחיקה', archived: 'בארכיון',
    delAsk: n => `למחוק את הפרויקט "${n}"? הלידים נשארים, רק בלי השיוך.`, suggest: 'קמפיינים בלי פרויקט', fromCamp: 'יצירת פרויקט',
    showLeads: 'הצגת הלידים', empty: 'עוד אין פרויקטים. צרו את הראשון, או בחרו קמפיין מהרשימה.', saving: 'שומר…',
    stages: { new: 'חדש', contacted: 'נוצר קשר', discovery: 'מתעניין', meeting: 'פגישה', negotiating: 'מו״מ', won: 'נסגר', lost: 'ללא מענה', nurture: 'בהמשך', irrelevant: 'לא רלוונטי' },
    // new lead
    nlTitle: 'ליד חדש', nlName: 'שם', nlPhone: 'טלפון', nlEmail: 'אימייל', nlProject: 'פרויקט', nlStage: 'שלב', nlSource: 'מאיפה הגיע',
    nlDetail: 'פרטים (מי הפנה, איזו מודעה…)', nlNote: 'הערה ראשונה', nlNotePh: 'מה מחפשים, תקציב, מה סוכם…', nlWelcome: 'לשלוח הודעת פתיחה בוואטסאפ',
    nlSave: 'הוספת הליד', nlNeed: 'צריך טלפון או אימייל', nlErr: 'השמירה נכשלה', nlSaved: 'הליד נוסף',
    sources: { phone: 'שיחת טלפון', referral: 'הפניה', 'walk-in': 'הגיע למשרד', website: 'אתר', meta: 'פייסבוק / אינסטגרם', yad2: 'יד2', other: 'אחר' },
  },
  en: {
    all: 'All projects', one: 'Project', none: 'No project', add: 'New project', manage: 'Manage projects', projects: 'Projects',
    open: n => `${n} open`, leads: n => (n === 1 ? '1 lead' : `${n} leads`), pick: 'Assign to a project', search: 'Find a project…',
    noProject: 'No project', create: n => `Create project "${n}"`, auto: 'Matched by its campaign', manual: 'Assigned by hand',
    title: 'Projects', sub: 'Every property or project you run in parallel. A lead belongs to one project; leads from a campaign listed in its other names join it by themselves.',
    name: 'Project name', namePh: 'e.g. 15 Zerubavel', town: 'Town', townPh: 'e.g. Ramat HaSharon', color: 'Color',
    aliases: 'Campaign / listing names that join this project by themselves', aliasesPh: 'e.g. Zerubavel 15 - v2, Zerubavel penthouse', save: 'Save', cancel: 'Cancel',
    edit: 'Edit', archive: 'Archive', unarchive: 'Restore from archive', del: 'Delete', archived: 'Archived',
    delAsk: n => `Delete the project "${n}"? Its leads stay, without the project.`, suggest: 'Campaigns without a project', fromCamp: 'Create project',
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
        {current && <button type="button" className="lp-opt lp-opt--none" onClick={() => onPick(null)}><X size={13}/>{t.noProject}</button>}
      </div>
      {err && <div className="lp-err">{err}</div>}
      <style>{LP_CSS}</style>
    </div>,
    document.body,
  )
}

/** The bar above the board: all · each project (color, name, open leads) · without a project · + new · manage */
export function ProjectsBar({ leads, projects, value, onChange, onManage, onNewProject, lang = 'he' }) {
  const t = tOf(lang)
  const counts = useMemo(() => projectCounts(leads, projects), [leads, projects])
  const active = (projects || []).filter(p => p.status !== 'archived')
  const sel = value && value !== NONE ? (projects || []).find(p => p.id === value) : null
  const cur = sel ? counts[sel.id] : null
  return (
    <div className="lp-bar" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <div className="lp-bar-row" role="tablist" aria-label={t.projects}>
        <span className="lp-bar-lbl"><FolderKanban size={14}/>{t.projects}</span>
        <button type="button" role="tab" aria-selected={!value} className="lp-tab" onClick={() => onChange('')}>{t.all}<em>{(leads || []).length}</em></button>
        {active.map(p => (
          <button key={p.id} type="button" role="tab" aria-selected={value === p.id} className="lp-tab" style={pv(p.color)} onClick={() => onChange(value === p.id ? '' : p.id)}
            title={`${p.name}${p.town ? ` · ${p.town}` : ''} · ${t.leads(counts[p.id]?.total || 0)} · ${t.open(counts[p.id]?.open || 0)}`}>
            <span className="lp-dot"/><bdi>{p.name}</bdi><em>{counts[p.id]?.total || 0}</em>
          </button>
        ))}
        {counts[NONE]?.total > 0 && <button type="button" role="tab" aria-selected={value === NONE} className="lp-tab lp-tab--none" onClick={() => onChange(value === NONE ? '' : NONE)}>{t.none}<em>{counts[NONE].total}</em></button>}
        <button type="button" className="lp-bar-btn" onClick={onNewProject}><Plus size={13}/>{t.add}</button>
        <button type="button" className="lp-bar-btn" onClick={onManage}><Settings2 size={13}/>{t.manage}</button>
      </div>
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
        {err && <div className="lp-err">{err}</div>}
        <div className="lp-cards">
          {!projects.length && !edit && <div className="lp-empty">{t.empty}</div>}
          {projects.map(p => {
            const c = counts[p.id] || { total: 0, open: 0, byStage: {} }
            return (
              <div key={p.id} className={`lp-card${p.status === 'archived' ? ' is-archived' : ''}`} style={pv(p.color)}>
                <div className="lp-card-top">
                  <span className="lp-dot"/><b><bdi>{p.name}</bdi></b>{p.town && <span className="lp-town">{p.town}</span>}
                  {p.status === 'archived' && <span className="lp-badge">{t.archived}</span>}
                  <span className="lp-card-n">{t.leads(c.total)} · {t.open(c.open)}</span>
                </div>
                <StageBar byStage={c.byStage} total={c.total} t={t}/>
                {p.aliases.length > 0 && <div className="lp-aliases">{p.aliases.map(a => <span key={a}>{a}</span>)}</div>}
                <div className="lp-card-act">
                  {onShow && <button type="button" className="lp-secondary" onClick={() => onShow(p.id)}>{t.showLeads}</button>}
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
  const proj = active.find(p => p.id === f.projectId)
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
            <div className="lp-pchoices">
              <button type="button" aria-pressed={!f.projectId} className="lp-pchoice" onClick={() => setF(x => ({ ...x, projectId: '' }))}>{t.noProject}</button>
              {active.map(p => <button key={p.id} type="button" aria-pressed={f.projectId === p.id} className="lp-pchoice" style={pv(p.color)} onClick={() => setF(x => ({ ...x, projectId: p.id }))}><span className="lp-dot"/><bdi>{p.name}</bdi></button>)}
            </div>
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

const LP_CSS = `
.lp-dot{width:8px;height:8px;border-radius:50%;background:var(--pc,#3B82F6);flex-shrink:0;display:inline-block}
.lp-chip{display:inline-flex;align-items:center;gap:5px;max-width:100%;border:1px solid var(--pcl,rgba(59,130,246,.4));background:var(--pcb,rgba(59,130,246,.12));color:var(--au-text,#1f2937);border-radius:999px;padding:1px 9px 1px 8px;font:600 11.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:0;line-height:1.6}
.lp-chip bdi{overflow:hidden;text-overflow:ellipsis}
.lp-chip:hover{border-color:var(--pc,#3B82F6)}
.lp-chip.is-empty{border:1px dashed rgba(var(--ink,20,30,80),.25);background:transparent;color:var(--au-text3,#8a90a6);font-weight:500}
.lp-chip.is-empty:hover{color:var(--au-brand-text,#3F4EB0);border-color:var(--au-brand,#3F4EB0)}
.lp-chip--md{font-size:12.5px;padding:3px 11px}
.lp-pop{position:fixed;z-index:4500;background:var(--au-pop,#fff);color:var(--au-text,#111);border:1px solid var(--au-line,#e5e7eb);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.18);font-family:Rubik,sans-serif;overflow:hidden}
.lp-pop-search{display:flex;align-items:center;gap:7px;padding:9px 11px;border-bottom:1px solid var(--au-line,#e5e7eb);color:var(--au-text3,#888)}
.lp-pop-search input{flex:1;min-width:0;border:none;outline:none;background:none;font:13px Rubik,sans-serif;color:var(--au-text,#111);min-height:0}
.lp-pop-list{max-height:260px;overflow:auto;padding:4px}
.lp-opt{width:100%;display:flex;align-items:center;gap:8px;border:none;background:none;border-radius:8px;padding:7px 9px;font:500 13px Rubik,sans-serif;color:var(--au-text,#111);cursor:pointer;text-align:start;min-height:0}
.lp-opt:hover,.lp-opt.is-on{background:rgba(var(--ov,20,30,80),.06)}
.lp-opt small{color:var(--au-text3,#888);font-size:11.5px}
.lp-opt svg:last-child{margin-inline-start:auto}
.lp-opt--new{color:var(--au-brand-text,#3F4EB0);font-weight:600}
.lp-opt--none{color:var(--au-text2,#666)}
.lp-err{margin:8px 12px;font-size:12.5px;color:#DC2626}
.lp-bar{padding:8px 0 10px}
.lp-bar-row{display:flex;align-items:center;gap:6px;overflow-x:auto;scrollbar-width:thin;padding-bottom:2px}
.lp-bar-lbl{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:var(--au-text2,#555);white-space:nowrap;margin-inline-end:4px}
.lp-tab{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border:1px solid var(--au-line,#e5e7eb);border-radius:999px;background:var(--au-pop,#fff);color:var(--au-text2,#555);font:500 12.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0;flex-shrink:0}
.lp-tab em{font-style:normal;font-size:11px;font-weight:700;border-radius:999px;padding:0 6px;background:rgba(var(--ov,20,30,80),.07);color:var(--au-text2,#555)}
.lp-tab:hover{color:var(--au-text,#111)}
.lp-tab[aria-selected=true]{background:var(--pcb,rgba(var(--brand-rgb,63,78,176),.12));border-color:var(--pc,var(--au-brand,#3F4EB0));color:var(--au-text,#111);font-weight:700}
.lp-tab--none{border-style:dashed}
.lp-bar-btn{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:none;background:none;color:var(--au-brand-text,#3F4EB0);font:600 12.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0;flex-shrink:0;border-radius:8px}
.lp-bar-btn:hover{background:rgba(var(--brand-rgb,63,78,176),.08)}
.lp-sum{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;margin-top:8px;padding:8px 12px;border-radius:10px;border:1px solid var(--pcl);background:var(--pcs);font-size:12.5px}
.lp-sum{color:var(--au-text,#111)}
.lp-sum b{display:inline-flex;align-items:center;gap:7px;font-size:14px;color:var(--au-text,#111)}
.lp-town{color:var(--au-text3,#888);font-size:12px}
.lp-sum-n{color:var(--au-text2,#555)}
.lp-stagebar{display:flex;flex:1;min-width:200px;height:20px;border-radius:6px;overflow:hidden;gap:2px}
.lp-seg{display:flex;align-items:center;justify-content:center;min-width:6px;color:#fff;font-size:10.5px;font-weight:600;overflow:hidden;white-space:nowrap}
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
.lp-card-act{display:flex;align-items:center;gap:6px;margin-top:auto}
.lp-card-act .lp-secondary{flex:1}
.lp-empty{grid-column:1/-1;padding:24px;text-align:center;color:var(--au-text3,#888);font-size:13px}
.lp-sugg{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:14px;padding-top:12px;border-top:1px solid var(--au-line,#e5e7eb);font-size:12.5px}
.lp-sugg b{margin-inline-end:4px;color:var(--au-text2,#555)}
.lp-sugg button{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:1px dashed var(--au-line,#ccc);border-radius:999px;background:none;color:var(--au-text,#111);font:500 12px Rubik,sans-serif;cursor:pointer;min-height:0}
.lp-sugg button:hover{border-color:var(--au-brand,#3F4EB0);color:var(--au-brand-text,#3F4EB0)}
.lp-sugg em{font-style:normal;font-size:11px;color:var(--au-text3,#888)}
@media (max-width:640px){.lp-form{grid-template-columns:1fr}.lp-modal{padding:14px}.lp-stagebar{min-width:100%}}
`
