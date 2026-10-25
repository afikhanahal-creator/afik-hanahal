// The follow-ups column on the leads board (src/LeadsBoard.jsx — on the left of the pipeline / table, a tab on phones): every
// dated task of every lead (crm_data.tasks — follow-ups and plain tasks, lib/follow-up.js taskAgenda()), by full name, phone,
// date and time. What is still ahead first (late and not done on top), what already passed turns grey; a checkbox marks a task
// done / not done (updateTasks — the lead's followUp follows), and a note written here is added to the lead's notes
// (crm_data.notes, lib/leadNotes.js addNote() — the same list as the lead card's "הערות ופעילות").
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, ChevronsLeft, ChevronsRight, Phone, MessageSquare, Check, StickyNote } from 'lucide-react'
import { taskAgenda, updateTasks, defaultFollowUpText, israelParts } from '../lib/follow-up.js'
import { addNote, asNotes } from './lib/leadNotes.js'
import { leadCampaign } from './lib/leadFields.js'

const pad = n => String(n).padStart(2, '0')
const local = p => { const d = String(p || '').replace(/\D/g, ''); const l = d.startsWith('972') ? '0' + d.slice(3) : d; return l.length === 10 ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l }
const HE_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayKey = at => { const p = israelParts(at); return `${p.y}-${pad(p.m)}-${pad(p.d)}` }

const TXT = {
  he: { title: 'פולו אפים ומשימות', late: 'באיחור', today: 'היום', soon: 'בהמשך', past: 'היה', all: 'הכל', fu: 'פולו אפים', tasks: 'משימות',
    showDone: 'כולל מה שבוצע', none: 'אין פולו אפים פתוחים', noneSub: 'פולו אפ שנקבע בכרטיס הליד, בסיכום שיחה או במרכז הלידים יופיע כאן.',
    notDone: 'לא בוצע', done: 'בוצע', markDone: 'סימון כבוצע', markOpen: 'סימון כלא בוצע', note: 'הערה', notePh: 'מה היה? (נשמר בהערות הליד)',
    save: 'שמירה', saved: 'נשמר בהערות', collapse: 'הסתרת העמודה', expand: 'פולו אפים', more: n => `עוד ${n}`, todayW: 'היום', tomorrow: 'מחר', yesterday: 'אתמול',
    open: 'פתיחת כרטיס הליד', call: 'התקשרות', notes: n => (n === 1 ? 'הערה אחת' : `${n} הערות`), taskTag: 'משימה' },
  en: { title: 'Follow-ups & tasks', late: 'Late', today: 'Today', soon: 'Later', past: 'Done & past', all: 'All', fu: 'Follow-ups', tasks: 'Tasks',
    showDone: 'Include done', none: 'No open follow-ups', noneSub: 'A follow-up set in the lead card, a call summary or the Lead Center shows here.',
    notDone: 'Not done', done: 'Done', markDone: 'Mark as done', markOpen: 'Mark as not done', note: 'Note', notePh: 'What happened? (saved to the lead\'s notes)',
    save: 'Save', saved: 'Saved to notes', collapse: 'Hide the column', expand: 'Follow-ups', more: n => `${n} more`, todayW: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday',
    open: 'Open the lead card', call: 'Call', notes: n => (n === 1 ? '1 note' : `${n} notes`), taskTag: 'Task' },
}

function whenParts(at, now, lang) {
  const p = israelParts(at), en = lang === 'en', t = TXT[en ? 'en' : 'he']
  const k = dayKey(at), today = dayKey(now)
  const tom = dayKey(now + 864e5), yes = dayKey(now - 864e5)
  const rel = k === today ? t.todayW : k === tom ? t.tomorrow : k === yes ? t.yesterday : (en ? EN_DAYS[p.wd] : `יום ${HE_DAYS[p.wd]}`)
  return { time: `${pad(p.h)}:${pad(p.min)}`, date: `${rel} · ${p.d}.${p.m}${p.y !== israelParts(now).y ? `.${String(p.y).slice(2)}` : ''}` }
}

function Row({ it, now, lang, t, onUpdate, onOpen }) {
  const { lead, task } = it
  const [noteOpen, setNoteOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(false)
  const inRef = useRef(null)
  useEffect(() => { if (noteOpen) inRef.current?.focus() }, [noteOpen])
  const name = String(lead.name || '').trim() || local(lead.phone)
  const extra = task.text && task.text !== defaultFollowUpText(lead) ? task.text : ''
  const camp = leadCampaign(lead, lang)
  const w = whenParts(it.due, now, lang)
  const grey = it.past
  const lateOpen = it.past && !it.done
  const notes = asNotes(lead.notes)
  const lastNote = notes.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))[0]
  const toggle = () => {
    const next = (lead.tasks || []).map(x => (x.id === task.id ? { ...x, done: !x.done, doneAt: !x.done ? Date.now() : null } : x))
    onUpdate(lead.id, updateTasks(lead, next))
  }
  const save = () => {
    const r = addNote(lead, null, draft, { kind: 'note' })
    if (!r) return
    onUpdate(lead.id, r.patch)
    setDraft(''); setNoteOpen(false); setSaved(true); setTimeout(() => setSaved(false), 2200)
  }
  return (
    <li className={`fu-row${grey ? ' is-past' : ''}${it.done ? ' is-done' : ''}${lateOpen ? ' is-late' : ''}`}>
      <button type="button" role="checkbox" aria-checked={it.done} className="fu-check" onClick={toggle}
        aria-label={`${it.done ? t.markOpen : t.markDone}: ${name}`} title={it.done ? t.markOpen : t.markDone}>
        {it.done && <Check size={13} strokeWidth={3}/>}
      </button>
      <div className="fu-body">
        <div className="fu-line1">
          <button type="button" className="fu-name" onClick={() => onOpen(lead)} title={t.open}><bdi>{name}</bdi></button>
          <span className="fu-when"><b dir="ltr">{w.time}</b><span>{w.date}</span></span>
        </div>
        <div className="fu-line2">
          {lead.phone && <a className="fu-phone" href={`tel:${local(lead.phone).replace(/-/g, '')}`} dir="ltr" title={t.call}><Phone size={11}/>{local(lead.phone)}</a>}
          {camp && <span className="fu-camp">{camp}</span>}
          {task.kind !== 'followup' && <span className="fu-kind">{t.taskTag}</span>}
          {lateOpen && <span className="fu-late">{t.notDone}</span>}
          {it.done && <span className="fu-doneTag">{t.done}</span>}
        </div>
        {extra && <div className="fu-text" dir="auto">{extra}</div>}
        {lastNote && !noteOpen && <div className="fu-last" dir="auto" title={lastNote.text}><StickyNote size={11}/>{lastNote.text}</div>}
        {noteOpen ? (
          <div className="fu-note">
            <textarea ref={inRef} rows={2} value={draft} placeholder={t.notePh} dir="auto" aria-label={t.notePh}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } if (e.key === 'Escape') { e.stopPropagation(); setNoteOpen(false) } }}/>
            <div className="fu-note-bar">
              <button type="button" className="fu-save" disabled={!draft.trim()} onClick={save}>{t.save}</button>
              <button type="button" className="fu-cancel" onClick={() => { setNoteOpen(false); setDraft('') }}>✕</button>
            </div>
          </div>
        ) : (
          <button type="button" className="fu-addnote" onClick={() => setNoteOpen(true)}>
            <MessageSquare size={11}/>{saved ? `✓ ${t.saved}` : t.note}{notes.length > 0 && !saved && <span className="fu-ncount">{t.notes(notes.length)}</span>}
          </button>
        )}
      </div>
    </li>
  )
}

export default function FollowUpsPanel({ leads, lang = 'he', onUpdate, onOpen, onCollapse, mobile = false }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const [kind, setKind] = useState(() => { try { return sessionStorage.getItem('afik_fu_kind') || 'all' } catch { return 'all' } })
  const [showDone, setShowDone] = useState(() => { try { return localStorage.getItem('afik_fu_done') !== '0' } catch { return true } })
  const [pastShown, setPastShown] = useState(15)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id) }, [])
  useEffect(() => { try { sessionStorage.setItem('afik_fu_kind', kind) } catch {} }, [kind])
  useEffect(() => { try { localStorage.setItem('afik_fu_done', showDone ? '1' : '0') } catch {} }, [showDone])

  const ag = useMemo(() => taskAgenda(leads, { now, kind: kind === 'fu' ? 'followup' : 'all' }), [leads, now, kind])
  const onlyTasks = kind === 'tasks'
  const pick = l => (onlyTasks ? l.filter(x => x.task.kind !== 'followup') : l)
  const today = dayKey(now)
  const upcoming = pick(ag.upcoming)
  const late = pick(ag.overdue)
  const todayList = upcoming.filter(x => dayKey(x.due) === today)
  const later = upcoming.filter(x => dayKey(x.due) !== today)
  const past = showDone ? pick(ag.past).filter(x => x.done) : []
  const sections = [
    ['late', t.late, late, 'late'],
    ['today', t.today, todayList, 'today'],
    ['soon', t.soon, later, ''],
    ['past', t.past, past.slice(0, pastShown), 'past'],
  ]
  const empty = !late.length && !upcoming.length && !past.length

  return (
    <aside className={`fu-panel${mobile ? ' fu-panel--mobile' : ''}`} aria-label={t.title} dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <div className="fu-head">
        <span className="fu-head-ic"><Bell size={14}/></span>
        <h3>{t.title}</h3>
        {onCollapse && (
          <button type="button" className="fu-icon" onClick={onCollapse} aria-label={t.collapse} title={t.collapse}>
            {lang === 'en' ? <ChevronsRight size={16}/> : <ChevronsLeft size={16}/>}
          </button>
        )}
      </div>
      <div className="fu-kpis">
        <span className={`fu-kpi${late.length ? ' is-late' : ''}`}><b>{late.length}</b>{t.late}</span>
        <span className="fu-kpi is-today"><b>{todayList.length}</b>{t.today}</span>
        <span className="fu-kpi"><b>{later.length}</b>{t.soon}</span>
      </div>
      <div className="fu-filters">
        <div className="fu-seg" role="tablist" aria-label={t.title}>
          {[['all', t.all], ['fu', t.fu], ['tasks', t.tasks]].map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={kind === id} onClick={() => setKind(id)}>{label}</button>
          ))}
        </div>
        <label className="fu-toggle"><input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)}/>{t.showDone}</label>
      </div>
      <div className="fu-scroll">
        {empty && (
          <div className="fu-empty"><Bell size={22}/><b>{t.none}</b><span>{t.noneSub}</span></div>
        )}
        {sections.map(([id, label, list, tone]) => list.length > 0 && (
          <section key={id} className={`fu-sec${tone ? ` fu-sec--${tone}` : ''}`}>
            <h4>{label}<span>{id === 'past' ? pick(ag.past).filter(x => x.done).length : list.length}</span></h4>
            <ul>{list.map(it => <Row key={it.key} it={it} now={now} lang={lang} t={t} onUpdate={onUpdate} onOpen={onOpen}/>)}</ul>
            {id === 'past' && past.length > pastShown && (
              <button type="button" className="fu-more" onClick={() => setPastShown(n => n + 30)}>{t.more(past.length - pastShown)}</button>
            )}
          </section>
        ))}
      </div>
      <style>{FU_CSS}</style>
    </aside>
  )
}

/** the button next to the board's view switch that opens / closes the column (with today's + late count) */
export function FollowUpsButton({ leads, lang = 'he', open, onToggle }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const now = Date.now()
  const ag = useMemo(() => taskAgenda(leads, { now }), [leads]) // eslint-disable-line react-hooks/exhaustive-deps
  const today = dayKey(now)
  const late = ag.overdue.length
  const n = late + ag.upcoming.filter(x => dayKey(x.due) === today).length
  return (
    <button type="button" className={`fu-btn${open ? ' is-open' : ''}`} onClick={onToggle} aria-pressed={!!open}
      title={late ? `${t.expand} · ${late} ${t.late}` : t.expand}>
      <Bell size={15} strokeWidth={2}/>{t.expand}
      {n > 0 && <span className={`fu-btn-n${late ? ' is-late' : ''}`}>{n}</span>}
      <style>{FU_CSS}</style>
    </button>
  )
}

const FU_CSS = `
.fu-panel{width:340px;flex-shrink:0;display:flex;flex-direction:column;min-height:0;background:var(--au-surface,var(--au-pop));border-inline-start:1px solid var(--au-line);font-family:Rubik,sans-serif;color:var(--au-text)}
.fu-panel--mobile{width:100%;border:none;flex:1}
.fu-head{display:flex;align-items:center;gap:8px;padding:14px 14px 8px}
.fu-head h3{margin:0;font-size:15px;font-weight:700;flex:1}
.fu-head-ic{width:26px;height:26px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:rgba(217,119,6,.14);color:#B45309}
.fu-icon{border:none;background:none;color:var(--au-text3);cursor:pointer;padding:5px;border-radius:7px;min-height:0;display:inline-flex}
.fu-icon:hover{background:rgba(var(--ov),.07);color:var(--au-text)}
.fu-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:0 14px 10px}
.fu-kpi{display:flex;flex-direction:column;align-items:center;gap:1px;border:1px solid var(--au-line);border-radius:10px;padding:6px 4px;font-size:11.5px;color:var(--au-text2)}
.fu-kpi b{font-size:17px;font-weight:700;color:var(--au-text);font-variant-numeric:tabular-nums}
.fu-kpi.is-late{border-color:rgba(220,38,38,.35);background:rgba(220,38,38,.06)}
.fu-kpi.is-late b{color:#DC2626}
.fu-kpi.is-today b{color:var(--au-brand-text)}
.fu-filters{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 14px 10px;border-bottom:1px solid var(--au-line);flex-wrap:wrap}
.fu-seg{display:inline-flex;background:rgba(var(--ov),.06);border-radius:9px;padding:2px}
.fu-seg button{border:none;background:none;border-radius:7px;padding:5px 10px;font:600 12px Rubik,sans-serif;color:var(--au-text2);cursor:pointer;min-height:0}
.fu-seg button[aria-selected=true]{background:var(--au-pop);color:var(--au-text);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.fu-toggle{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--au-text2);cursor:pointer}
.fu-toggle input{accent-color:var(--au-brand);width:14px;height:14px;margin:0}
.fu-scroll{flex:1;min-height:0;overflow-y:auto;padding:4px 0 16px}
.fu-sec h4{position:sticky;top:0;z-index:1;margin:0;display:flex;align-items:center;gap:6px;padding:10px 14px 6px;font-size:11.5px;font-weight:700;letter-spacing:.02em;color:var(--au-text2);background:var(--au-surface,var(--au-pop))}
.fu-sec h4 span{font-size:11px;background:rgba(var(--ov),.08);border-radius:999px;padding:0 7px;color:var(--au-text2)}
.fu-sec--late h4{color:#DC2626}
.fu-sec--today h4{color:var(--au-brand-text)}
.fu-sec ul{list-style:none;margin:0;padding:0 8px;display:flex;flex-direction:column;gap:6px}
.fu-row{display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid var(--au-line);border-radius:12px;background:var(--au-pop)}
.fu-sec--today .fu-row{border-inline-start:3px solid var(--au-brand)}
.fu-row.is-past{background:rgba(var(--ov),.035);color:var(--au-text3)}
.fu-row.is-past .fu-name,.fu-row.is-past .fu-when b{color:var(--au-text2)}
.fu-row.is-late{border-inline-start:3px solid rgba(220,38,38,.55)}
.fu-row.is-done .fu-text,.fu-row.is-done .fu-name bdi{text-decoration:line-through;text-decoration-color:rgba(var(--ink),.35)}
.fu-check{flex:0 0 20px;box-sizing:border-box;width:20px!important;min-width:0!important;max-width:20px;height:20px;margin-top:1px;border-radius:6px;border:2px solid rgba(var(--ink),.3);background:var(--au-pop);color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;min-height:0}
.fu-check:hover{border-color:#16A34A}
.fu-check[aria-checked=true]{background:#16A34A;border-color:#16A34A}
.fu-body{flex:1;min-width:0}
.fu-line1{display:flex;align-items:flex-start;gap:8px}
.fu-name{flex:1;min-width:0;text-align:start;border:none;background:none;padding:0;font:700 14px Rubik,sans-serif;color:var(--au-text);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:0}
.fu-name:hover{color:var(--au-brand-text);text-decoration:underline}
.fu-when{flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;line-height:1.2}
.fu-when b{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--au-text)}
.fu-when span{font-size:11px;color:var(--au-text3);white-space:nowrap}
.fu-line2{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:3px;font-size:12px;color:var(--au-text2)}
.fu-phone{display:inline-flex;align-items:center;gap:4px;color:inherit;text-decoration:none;font-variant-numeric:tabular-nums;min-height:0}
.fu-phone:hover{color:var(--au-brand-text)}
.fu-camp{font-size:11px;font-weight:600;color:var(--au-brand-text);background:rgba(var(--brand-rgb),.1);border-radius:6px;padding:1px 6px}
.fu-row.is-past .fu-camp{color:var(--au-text3);background:rgba(var(--ov),.07)}
.fu-kind{font-size:11px;font-weight:600;border-radius:6px;padding:1px 6px;background:rgba(var(--ov),.07)}
.fu-late{font-size:11px;font-weight:700;border-radius:6px;padding:1px 6px;color:#DC2626;background:rgba(220,38,38,.1)}
.fu-doneTag{font-size:11px;font-weight:700;border-radius:6px;padding:1px 6px;color:#15803D;background:rgba(22,163,74,.1)}
.fu-text{margin-top:5px;font-size:12.5px;line-height:1.45;color:inherit}
.fu-last{margin-top:5px;display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--au-text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fu-last svg{flex-shrink:0}
.fu-addnote{margin-top:6px;display:inline-flex;align-items:center;gap:5px;border:none;background:none;padding:2px 0;font:600 12px Rubik,sans-serif;color:var(--au-brand-text);cursor:pointer;min-height:0}
.fu-ncount{font-weight:500;color:var(--au-text3)}
.fu-note{margin-top:6px}
.fu-note textarea{width:100%;box-sizing:border-box;resize:vertical;min-height:52px;border:1px solid var(--au-line);border-radius:9px;padding:7px 9px;font:13px/1.45 Rubik,sans-serif;background:var(--au-input,var(--au-pop));color:var(--au-text);outline:none}
.fu-note textarea:focus{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.15)}
.fu-note-bar{display:flex;gap:6px;margin-top:5px}
.fu-save{border:none;background:var(--au-brand);color:#fff;border-radius:8px;padding:5px 12px;font:700 12px Rubik,sans-serif;cursor:pointer;min-height:0}
.fu-save:disabled{opacity:.45;cursor:default}
.fu-cancel{border:1px solid var(--au-line);background:none;color:var(--au-text2);border-radius:8px;padding:4px 9px;font-size:12px;cursor:pointer;min-height:0}
.fu-more{display:block;margin:8px auto 0;border:1px solid var(--au-line);background:none;color:var(--au-text2);border-radius:999px;padding:4px 14px;font:600 12px Rubik,sans-serif;cursor:pointer;min-height:0}
.fu-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:40px 24px;color:var(--au-text3);font-size:12.5px;line-height:1.5}
.fu-empty b{color:var(--au-text2);font-size:13.5px}
.fu-btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border:1px solid var(--au-line);border-radius:10px;background:var(--au-pop);color:var(--au-text2);font:500 13px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0;transition:background .12s,color .12s,border-color .12s}
.fu-btn:hover{color:var(--au-text);background:rgba(var(--ov),.05)}
.fu-btn.is-open{color:var(--au-brand-text);border-color:rgba(var(--brand-rgb),.45);background:rgba(var(--brand-rgb),.08);font-weight:600}
.fu-btn-n{min-width:20px;height:20px;border-radius:999px;background:var(--au-brand);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 6px}
.fu-btn-n.is-late{background:#DC2626}
`
