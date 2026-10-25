// "פולו אפים" — the leads board's task screen (src/LeadsBoard.jsx, the button next to the view switch; a tab on phones): every
// dated task of every lead (crm_data.tasks: follow-ups and plain tasks) as one CRM list, grouped late · today · tomorrow · this
// week · later · done (lib/follow-up.js agendaBucket()). A row: done / not done, when, the full name (opens the lead card), the
// stage, phone + WhatsApp, the task, the project, the lead's last note + a note box (added to crm_data.notes — the lead card's
// notes) and actions: move (the date / time picker with the quick picks; the WhatsApp reminder goes out again at the new time) and
// delete. What already passed is grey; done is struck through. "משימה חדשה" adds a follow-up or a task to any lead.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Phone, Check, StickyNote, Plus, Search, Trash2, X, MessageCircle } from 'lucide-react'
import DateTimePicker from './DateTimePicker.jsx'
import WaFace from './WaFace.jsx'
import { taskAgenda, agendaBucket, updateTasks, addFollowUp, followUpPresets, defaultFollowUpText, israelParts, dueIso } from '../lib/follow-up.js'
import { addNote, asNotes } from './lib/leadNotes.js'
import { leadCampaign } from './lib/leadFields.js'

const pad = n => String(n).padStart(2, '0')
const local = p => { const d = String(p || '').replace(/\D/g, ''); const l = d.startsWith('972') ? '0' + d.slice(3) : d; return l.length === 10 ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l }
const digits = s => String(s || '').replace(/\D/g, '')
const dayKey = at => { const p = israelParts(at); return `${p.y}-${pad(p.m)}-${pad(p.d)}` }
const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const uid = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const TXT = {
  he: {
    title: 'פולו אפים ומשימות', sub: 'כל המשימות של כל הלידים, לפי שעה. לחיצה על שם פותחת את כרטיס הליד.',
    btn: 'פולו אפים', add: 'משימה חדשה', search: 'חיפוש שם, טלפון, משימה…',
    groups: { late: 'באיחור', today: 'היום', tomorrow: 'מחר', week: 'השבוע', later: 'בהמשך', done: 'בוצעו' },
    ranges: { open: 'פתוחות', late: 'באיחור', today: 'היום', week: 'השבוע', done: 'בוצעו', all: 'הכל' },
    kinds: { all: 'הכל', followup: 'פולו אפים', task: 'משימות' },
    cols: { done: 'בוצע', when: 'מועד', name: 'שם מלא', phone: 'טלפון', task: 'משימה', project: 'פרויקט', notes: 'הערות', actions: 'פעולות' },
    fu: 'פולו אפ', task: 'משימה', notDone: 'לא בוצע', markDone: 'סימון כבוצע', markOpen: 'סימון כלא בוצע',
    notePh: 'מה היה? Enter לשמירה', addNote: 'הערה', saved: 'נשמר בהערות הליד', move: 'הזזה', del: 'מחיקה',
    delAsk: 'למחוק את המשימה?', open: 'פתיחת כרטיס הליד', wa: 'וואטסאפ', call: 'התקשרות',
    empty: 'אין משימות כאן', emptySub: 'פולו אפ שנקבע בכרטיס הליד, בסיכום שיחה, במרכז הלידים או כאן יופיע ברשימה.',
    more: n => `הצגת עוד ${n}`, today: 'היום', tomorrow: 'מחר', yesterday: 'אתמול', day: d => `יום ${d}`,
    newTitle: 'משימה חדשה', lead: 'ליד', leadPh: 'חיפוש ליד לפי שם או טלפון', what: 'מה צריך לעשות', whatPh: 'למשל: לחזור עם הצעת מחיר',
    when: 'מתי', kind: 'סוג', remind: 'תזכורת בוואטסאפ ועל המסך', save: 'שמירה', cancel: 'ביטול', pickLead: 'בחרו ליד', change: 'החלפה',
    noLead: 'לא נמצא ליד', notes: n => (n === 1 ? 'הערה אחת' : `${n} הערות`),
  },
  en: {
    title: 'Follow-ups & tasks', sub: 'Every task of every lead, by time. A click on a name opens the lead card.',
    btn: 'Follow-ups', add: 'New task', search: 'Search name, phone, task…',
    groups: { late: 'Late', today: 'Today', tomorrow: 'Tomorrow', week: 'This week', later: 'Later', done: 'Done' },
    ranges: { open: 'Open', late: 'Late', today: 'Today', week: 'This week', done: 'Done', all: 'All' },
    kinds: { all: 'All', followup: 'Follow-ups', task: 'Tasks' },
    cols: { done: 'Done', when: 'When', name: 'Full name', phone: 'Phone', task: 'Task', project: 'Project', notes: 'Notes', actions: 'Actions' },
    fu: 'Follow-up', task: 'Task', notDone: 'Not done', markDone: 'Mark as done', markOpen: 'Mark as not done',
    notePh: 'What happened? Enter to save', addNote: 'Note', saved: 'Saved to the lead\'s notes', move: 'Move', del: 'Delete',
    delAsk: 'Delete this task?', open: 'Open the lead card', wa: 'WhatsApp', call: 'Call',
    empty: 'No tasks here', emptySub: 'A follow-up set in the lead card, a call summary, the Lead Center or here shows in this list.',
    more: n => `Show ${n} more`, today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', day: d => d,
    newTitle: 'New task', lead: 'Lead', leadPh: 'Find a lead by name or phone', what: 'What to do', whatPh: 'e.g. call back with a price offer',
    when: 'When', kind: 'Type', remind: 'WhatsApp and on-screen reminder', save: 'Save', cancel: 'Cancel', pickLead: 'Pick a lead', change: 'Change',
    noLead: 'No lead found', notes: n => (n === 1 ? '1 note' : `${n} notes`),
  },
}
const GROUP_ORDER = ['late', 'today', 'tomorrow', 'week', 'later', 'done']
const RANGE_GROUPS = { open: ['late', 'today', 'tomorrow', 'week', 'later'], late: ['late'], today: ['late', 'today'], week: ['late', 'today', 'tomorrow', 'week'], done: ['done'], all: GROUP_ORDER }

function whenText(at, now, t, en) {
  const p = israelParts(at), k = dayKey(at)
  const rel = k === dayKey(now) ? t.today : k === dayKey(now + 864e5) ? t.tomorrow : k === dayKey(now - 864e5) ? t.yesterday : t.day(en ? EN_DAYS[p.wd] : HE_DAYS[p.wd])
  return { time: `${pad(p.h)}:${pad(p.min)}`, date: `${rel} · ${p.d}.${p.m}${p.y !== israelParts(now).y ? `.${String(p.y).slice(2)}` : ''}` }
}

function NoteCell({ lead, t, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(false)
  const ref = useRef(null)
  useEffect(() => { if (open) ref.current?.focus() }, [open])
  const notes = asNotes(lead.notes)
  const last = notes.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))[0]
  const save = () => {
    const r = addNote(lead, null, draft, { kind: 'note' })
    if (!r) return
    onUpdate(lead.id, r.patch)
    setDraft(''); setOpen(false); setSaved(true); setTimeout(() => setSaved(false), 2400)
  }
  if (open) return (
    <div className="fv-note">
      <textarea ref={ref} rows={2} value={draft} dir="auto" placeholder={t.notePh} aria-label={t.notePh}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }}/>
      <div className="fv-note-bar">
        <button type="button" className="fv-save" disabled={!draft.trim()} onClick={save}>{t.save}</button>
        <button type="button" className="fv-ghost" onClick={() => { setOpen(false); setDraft('') }} aria-label={t.cancel}><X size={13}/></button>
      </div>
    </div>
  )
  return (
    <div className="fv-notecell">
      {last && <div className="fv-last" dir="auto" title={last.text}><StickyNote size={12}/><span>{last.text}</span></div>}
      <button type="button" className="fv-addnote" onClick={() => setOpen(true)}>
        {saved ? <><Check size={12}/>{t.saved}</> : <><Plus size={12}/>{t.addNote}{notes.length > 0 && <span>· {t.notes(notes.length)}</span>}</>}
      </button>
    </div>
  )
}

function Row({ it, now, t, en, lang, stages, onUpdate, onOpen, onOpenChat }) {
  const { lead, task } = it
  const name = String(lead.name || '').trim() || local(lead.phone)
  const w = whenText(it.due, now, t, en)
  const stage = (stages || []).find(g => g.id === (lead.leadStatus || 'new'))
  const camp = leadCampaign(lead, lang)
  const extra = task.text && task.text !== defaultFollowUpText(lead) ? task.text : (task.text || '')
  const late = it.bucket === 'late'
  const setTasks = next => onUpdate(lead.id, updateTasks(lead, next))
  const toggle = () => setTasks((lead.tasks || []).map(x => (x.id === task.id ? { ...x, done: !x.done, doneAt: !x.done ? Date.now() : null } : x)))
  const move = v => { const iso = dueIso(v); if (iso) setTasks((lead.tasks || []).map(x => (x.id === task.id ? { ...x, due: iso, remindedAt: null, remindGaveUp: false } : x))) }
  const del = () => { if (window.confirm(t.delAsk)) setTasks((lead.tasks || []).filter(x => x.id !== task.id)) }
  return (
    <div role="row" className={`fv-row${it.past ? ' is-past' : ''}${it.done ? ' is-done' : ''}${late ? ' is-late' : ''}`}>
      <div role="cell" className="fv-c fv-c-done">
        <button type="button" role="checkbox" aria-checked={it.done} className="fv-check" onClick={toggle}
          aria-label={`${it.done ? t.markOpen : t.markDone}: ${name}`} title={it.done ? t.markOpen : t.markDone}>
          {it.done && <Check size={14} strokeWidth={3}/>}
        </button>
      </div>
      <div role="cell" className="fv-c fv-c-when">
        <b dir="ltr">{w.time}</b><span>{w.date}</span>
        {late && <em>{t.notDone}</em>}
      </div>
      <div role="cell" className="fv-c fv-c-name">
        <WaFace phone={lead.phone} name={name} size={34} lang={lang} style={{ background: (stage?.color || '#6366F1') + '22' }}>
          <span className="fv-ini" style={{ color: stage?.color || 'var(--au-brand-text)' }}>{name.charAt(0)}</span>
        </WaFace>
        <div className="fv-namebox">
          <button type="button" className="fv-name" onClick={() => onOpen(lead)} title={t.open}><bdi>{name}</bdi></button>
          {stage && <span className="fv-stage" style={{ color: stage.color, background: stage.color + '1A' }}>{en ? stage.en : stage.label}</span>}
        </div>
      </div>
      <div role="cell" className="fv-c fv-c-phone">
        {lead.phone && <>
          <a href={`tel:${digits(local(lead.phone))}`} dir="ltr" className="fv-tel" title={t.call}><Phone size={12}/>{local(lead.phone)}</a>
          {onOpenChat && <button type="button" className="fv-wa" onClick={() => onOpenChat(lead)} aria-label={`${t.wa}: ${name}`} title={t.wa}><MessageCircle size={14}/></button>}
        </>}
      </div>
      <div role="cell" className="fv-c fv-c-task">
        <span className={`fv-kind${task.kind === 'followup' ? ' is-fu' : ''}`}>{task.kind === 'followup' ? t.fu : t.task}</span>
        <span className="fv-text" dir="auto">{extra}</span>
      </div>
      <div role="cell" className="fv-c fv-c-proj">{camp && <span className="fv-camp">{camp}</span>}</div>
      <div role="cell" className="fv-c fv-c-notes"><NoteCell lead={lead} t={t} onUpdate={onUpdate}/></div>
      <div role="cell" className="fv-c fv-c-act">
        <DateTimePicker value={dueIso(task.due)} onChange={move} format="iso" lang={lang} presets={followUpPresets(Date.now(), lang)}
          clearable={false} label={t.move} text={t.move} size="sm"/>
        <button type="button" className="fv-del" onClick={del} aria-label={`${t.del}: ${extra || name}`} title={t.del}><Trash2 size={14}/></button>
      </div>
    </div>
  )
}

function NewTaskDialog({ leads, t, en, lang, onClose, onUpdate }) {
  const [q, setQ] = useState('')
  const [lead, setLead] = useState(null)
  const [text, setText] = useState('')
  const [kind, setKind] = useState('followup')
  const [due, setDue] = useState(() => followUpPresets(Date.now(), lang).find(p => p.id === 'tom9')?.at || '')
  const [remind, setRemind] = useState(true)
  const qRef = useRef(null)
  useEffect(() => { qRef.current?.focus() }, [])
  useEffect(() => {
    const k = e => { if (e.key === 'Escape' && !e.defaultPrevented) onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const found = useMemo(() => {
    const s = q.trim().toLowerCase(), d = digits(q).replace(/^972/, '0')
    if (!s) return []
    return (leads || []).filter(l => String(l.name || '').toLowerCase().includes(s) || (d.length >= 3 && digits(l.phone).replace(/^972/, '0').includes(d))).slice(0, 8)
  }, [q, leads])
  const save = () => {
    if (!lead || !dueIso(due)) return
    if (kind === 'followup') { const r = addFollowUp(lead, { text, due, remind }); if (r) onUpdate(lead.id, r.patch) }
    else onUpdate(lead.id, updateTasks(lead, [...(lead.tasks || []), { id: uid(), text: text.trim() || t.task, due: dueIso(due), done: false, createdAt: Date.now(), kind: 'task', remind }]))
    onClose()
  }
  return (
    <div className="fv-modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="fv-modal" role="dialog" aria-modal="true" aria-label={t.newTitle} dir={en ? 'ltr' : 'rtl'}>
        <div className="fv-modal-head"><h3>{t.newTitle}</h3><button type="button" className="fv-ghost" onClick={onClose} aria-label={t.cancel}><X size={16}/></button></div>
        <label className="fv-lbl">{t.lead}</label>
        {lead ? (
          <div className="fv-picked">
            <WaFace phone={lead.phone} name={lead.name} size={30} lang={lang}><span className="fv-ini">{String(lead.name || '?').charAt(0)}</span></WaFace>
            <b><bdi>{lead.name || local(lead.phone)}</bdi></b><span dir="ltr">{local(lead.phone)}</span>
            <button type="button" className="fv-ghost" onClick={() => { setLead(null); setTimeout(() => qRef.current?.focus(), 0) }}>{t.change}</button>
          </div>
        ) : (
          <div className="fv-leadpick">
            <div className="fv-search"><Search size={14}/><input ref={qRef} value={q} onChange={e => setQ(e.target.value)} placeholder={t.leadPh} aria-label={t.leadPh}/></div>
            {q.trim() && (
              <ul className="fv-found">
                {found.length ? found.map(l => (
                  <li key={l.id}><button type="button" onClick={() => setLead(l)}>
                    <WaFace phone={l.phone} name={l.name} size={26} lang={lang} zoom={false}><span className="fv-ini">{String(l.name || '?').charAt(0)}</span></WaFace>
                    <b><bdi>{l.name || local(l.phone)}</bdi></b><span dir="ltr">{local(l.phone)}</span>
                  </button></li>
                )) : <li className="fv-none">{t.noLead}</li>}
              </ul>
            )}
          </div>
        )}
        <label className="fv-lbl">{t.kind}</label>
        <div className="fv-seg">
          {[['followup', t.fu], ['task', t.task]].map(([id, l]) => <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)}>{l}</button>)}
        </div>
        <label className="fv-lbl" htmlFor="fv-what">{t.what}</label>
        <input id="fv-what" className="fv-input" value={text} onChange={e => setText(e.target.value)} placeholder={kind === 'followup' && lead ? defaultFollowUpText(lead, lang) : t.whatPh} dir="auto"/>
        <label className="fv-lbl">{t.when}</label>
        <DateTimePicker value={due} onChange={setDue} format="iso" lang={lang} presets={followUpPresets(Date.now(), lang)} label={t.when} style={{ width: '100%' }}/>
        <button type="button" role="checkbox" aria-checked={remind} className="fv-remind" onClick={() => setRemind(r => !r)}>
          <span className="fv-check" aria-hidden="true">{remind && <Check size={14} strokeWidth={3}/>}</span>{t.remind}
        </button>
        <div className="fv-modal-foot">
          <button type="button" className="fv-primary" disabled={!lead || !dueIso(due)} onClick={save}>{t.save}</button>
          <button type="button" className="fv-secondary" onClick={onClose}>{t.cancel}</button>
        </div>
      </div>
    </div>
  )
}

export default function FollowUpsView({ leads, lang = 'he', stages, onUpdate, onOpen, onOpenChat }) {
  const en = lang === 'en', t = TXT[en ? 'en' : 'he']
  const ss = (k, d) => { try { return sessionStorage.getItem(k) || d } catch { return d } }
  const [range, setRange] = useState(() => ss('afik_fv_range', 'open'))
  const [kind, setKind] = useState(() => ss('afik_fv_kind', 'all'))
  const [q, setQ] = useState('')
  const [doneShown, setDoneShown] = useState(40)
  const [adding, setAdding] = useState(false)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id) }, [])
  useEffect(() => { try { sessionStorage.setItem('afik_fv_range', range); sessionStorage.setItem('afik_fv_kind', kind) } catch {} }, [range, kind])

  const items = useMemo(() => {
    const ag = taskAgenda(leads, { now })
    return [...ag.upcoming, ...ag.past].map(x => ({ ...x, bucket: agendaBucket(x.due, x.done, now) }))
  }, [leads, now])
  const counts = useMemo(() => {
    const c = { late: 0, today: 0, tomorrow: 0, week: 0, later: 0, done: 0 }
    for (const x of items) c[x.bucket]++
    return c
  }, [items])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase(), d = digits(q).replace(/^972/, '0')
    return items.filter(x => {
      if (kind !== 'all' && (kind === 'followup') !== (x.task.kind === 'followup')) return false
      if (!s) return true
      return String(x.lead.name || '').toLowerCase().includes(s) || String(x.task.text || '').toLowerCase().includes(s)
        || (d.length >= 3 && digits(x.lead.phone).replace(/^972/, '0').includes(d))
    })
  }, [items, kind, q])
  const groups = RANGE_GROUPS[range] || RANGE_GROUPS.open
  const byGroup = GROUP_ORDER.filter(g => groups.includes(g)).map(g => {
    let list = filtered.filter(x => x.bucket === g)
    list = g === 'done' || g === 'late' ? list.sort((a, b) => b.due - a.due) : list.sort((a, b) => a.due - b.due)
    return [g, list]
  }).filter(([, l]) => l.length)

  const kpis = [['late', counts.late, 'late'], ['today', counts.today, 'today'], ['tomorrow', counts.tomorrow, ''], ['week', counts.week, ''], ['later', counts.later, ''], ['done', counts.done, 'done']]
  const rangeOf = g => (g === 'tomorrow' || g === 'week' ? 'week' : g === 'later' ? 'open' : g)

  return (
    <div className="fv" dir={en ? 'ltr' : 'rtl'}>
      <div className="fv-top">
        <div className="fv-titles">
          <h2><span className="fv-title-ic"><Bell size={15}/></span>{t.title}</h2>
          <p>{t.sub}</p>
        </div>
        <button type="button" className="fv-primary" onClick={() => setAdding(true)}><Plus size={15}/>{t.add}</button>
      </div>
      <div className="fv-kpis">
        {kpis.map(([g, n, tone]) => (
          <button key={g} type="button" className={`fv-kpi${tone ? ` is-${tone}` : ''}${groups.length === 1 && groups[0] === g ? ' is-on' : ''}`} onClick={() => setRange(rangeOf(g))}>
            <b>{n}</b><span>{t.groups[g]}</span>
          </button>
        ))}
      </div>
      <div className="fv-bar">
        <div className="fv-seg" role="tablist" aria-label={t.title}>
          {Object.entries(t.ranges).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={range === id} onClick={() => setRange(id)}>{l}</button>)}
        </div>
        <div className="fv-seg" role="tablist" aria-label={t.kind}>
          {Object.entries(t.kinds).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={kind === id} onClick={() => setKind(id)}>{l}</button>)}
        </div>
        <div className="fv-search fv-search--bar"><Search size={14}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}/>{q && <button type="button" className="fv-ghost" onClick={() => setQ('')} aria-label={t.cancel}><X size={13}/></button>}</div>
      </div>
      <div className="fv-table" role="table" aria-label={t.title}>
        <div role="row" className="fv-row fv-head">
          {['done', 'when', 'name', 'phone', 'task', 'project', 'notes', 'actions'].map(c => <div key={c} role="columnheader" className={`fv-c fv-c-${c === 'project' ? 'proj' : c === 'actions' ? 'act' : c}`}>{t.cols[c]}</div>)}
        </div>
        {!byGroup.length && <div className="fv-empty"><Bell size={24}/><b>{t.empty}</b><span>{t.emptySub}</span></div>}
        {byGroup.map(([g, list]) => {
          const shown = g === 'done' ? list.slice(0, doneShown) : list
          return (
            <div key={g} role="rowgroup" className={`fv-group fv-group--${g}`}>
              <div className="fv-gh"><span>{t.groups[g]}</span><em>{list.length}</em></div>
              {shown.map(it => <Row key={it.key} it={it} now={now} t={t} en={en} lang={lang} stages={stages} onUpdate={onUpdate} onOpen={onOpen} onOpenChat={onOpenChat}/>)}
              {g === 'done' && list.length > doneShown && <button type="button" className="fv-more" onClick={() => setDoneShown(n => n + 60)}>{t.more(list.length - doneShown)}</button>}
            </div>
          )
        })}
      </div>
      {adding && <NewTaskDialog leads={leads} t={t} en={en} lang={lang} onClose={() => setAdding(false)} onUpdate={onUpdate}/>}
      <style>{FV_CSS}</style>
    </div>
  )
}

/** the button next to the board's view switch (today's + late count, red when something is late) */
export function FollowUpsButton({ leads, lang = 'he', active, onClick }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const now = Date.now()
  const { late, n } = useMemo(() => {
    const ag = taskAgenda(leads, { now })
    const today = dayKey(now)
    return { late: ag.overdue.length, n: ag.overdue.length + ag.upcoming.filter(x => dayKey(x.due) === today).length }
  }, [leads]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button type="button" className={`fv-btn${active ? ' is-open' : ''}`} onClick={onClick} aria-pressed={!!active}
      title={late ? `${t.btn} · ${late} ${t.groups.late}` : t.btn}>
      <Bell size={15} strokeWidth={2}/>{t.btn}
      {n > 0 && <span className={`fv-btn-n${late ? ' is-late' : ''}`}>{n}</span>}
      <style>{FV_BTN_CSS}</style>
    </button>
  )
}

const FV_BTN_CSS = `
.fv-btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border:1px solid var(--au-line);border-radius:10px;background:var(--au-pop);color:var(--au-text2);font:500 13px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0;transition:background .12s,color .12s,border-color .12s}
.fv-btn:hover{color:var(--au-text);background:rgba(var(--ov),.05)}
.fv-btn.is-open{color:var(--au-brand-text);border-color:rgba(var(--brand-rgb),.45);background:rgba(var(--brand-rgb),.08);font-weight:600}
.fv-btn-n{min-width:20px;height:20px;border-radius:999px;background:var(--au-brand);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 6px}
.fv-btn-n.is-late{background:#DC2626}
`

const FV_CSS = `
.fv{flex:1;min-height:0;overflow-y:auto;container-type:inline-size;padding:18px 20px 40px;font-family:Rubik,sans-serif;color:var(--au-text)}
.fv-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
.fv-titles{flex:1;min-width:0}
.fv-titles h2{margin:0;display:flex;align-items:center;gap:9px;font-size:19px;font-weight:700}
.fv-title-ic{width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;background:rgba(217,119,6,.14);color:#B45309}
.fv-titles p{margin:5px 0 0;font-size:13px;color:var(--au-text2)}
.fv-primary{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 16px;border:none;border-radius:10px;background:var(--au-brand);color:#fff;font:600 13px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0}
.fv-primary:disabled{opacity:.45;cursor:default}
.fv-secondary{height:36px;padding:0 16px;border:1px solid var(--au-line);border-radius:10px;background:none;color:var(--au-text);font:500 13px Rubik,sans-serif;cursor:pointer;min-height:0}
.fv-ghost{display:inline-flex;align-items:center;gap:4px;border:none;background:none;color:var(--au-text3);cursor:pointer;padding:4px 6px;border-radius:7px;font:500 12px Rubik,sans-serif;min-height:0}
.fv-ghost:hover{background:rgba(var(--ov),.07);color:var(--au-text)}
.fv-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-bottom:14px}
.fv-kpi{display:flex;flex-direction:column;align-items:flex-start;gap:2px;border:1px solid var(--au-line);border-radius:12px;padding:10px 14px;background:var(--au-pop);cursor:pointer;font-family:inherit;text-align:start;min-height:0}
.fv-kpi:hover{border-color:rgba(var(--brand-rgb),.4)}
.fv-kpi b{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--au-text);line-height:1.15}
.fv-kpi span{font-size:12.5px;color:var(--au-text2)}
.fv-kpi.is-late b{color:#DC2626}
.fv-kpi.is-late{border-color:rgba(220,38,38,.3)}
.fv-kpi.is-today b{color:var(--au-brand-text)}
.fv-kpi.is-done b{color:#15803D}
.fv-kpi.is-on{box-shadow:0 0 0 2px rgba(var(--brand-rgb),.35)}
.fv-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:12px}
.fv-seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:rgba(var(--ov),.06)}
.fv-seg button{height:30px;padding:0 12px;border:none;border-radius:8px;background:transparent;color:var(--au-text2);font:500 12.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0}
.fv-seg button[aria-selected=true],.fv-seg button[aria-pressed=true]{background:var(--au-pop);color:var(--au-text);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08),0 1px 6px rgba(0,0,0,.05)}
.fv-search{display:flex;align-items:center;gap:8px;height:36px;border:1px solid var(--au-line);border-radius:10px;padding:0 10px;background:var(--au-input,var(--au-pop));color:var(--au-text3)}
.fv-search input{flex:1;min-width:0;border:none;outline:none;background:none;font:13px Rubik,sans-serif;color:var(--au-text);min-height:0}
.fv-search--bar{margin-inline-start:auto;min-width:240px}
.fv-table{border:1px solid var(--au-line);border-radius:14px;background:var(--au-pop);overflow:hidden}
.fv-row{display:grid;grid-template-columns:48px 104px minmax(170px,1.3fr) 178px minmax(150px,1.3fr) 112px minmax(150px,1.2fr) 168px;align-items:center;border-top:1px solid var(--au-line)}
.fv-head{border-top:none;background:rgba(var(--ov),.04);position:sticky;top:0;z-index:2}
.fv-head .fv-c{font-size:11.5px;font-weight:700;color:var(--au-text2);padding-top:10px;padding-bottom:10px}
.fv-c{padding:10px 10px;min-width:0}
.fv-gh{display:flex;align-items:center;gap:8px;padding:9px 14px;border-top:1px solid var(--au-line);background:rgba(var(--ov),.025);font-size:12.5px;font-weight:700;color:var(--au-text2)}
.fv-gh em{font-style:normal;font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px;background:rgba(var(--ov),.08)}
.fv-group--late .fv-gh{color:#DC2626}
.fv-group--late .fv-gh em{background:rgba(220,38,38,.12)}
.fv-group--today .fv-gh{color:var(--au-brand-text)}
.fv-group--done .fv-gh{color:#15803D}
.fv-row:not(.fv-head):hover{background:rgba(var(--ov),.025)}
.fv-row.is-late{box-shadow:inset -3px 0 0 #DC2626}
[dir=ltr] .fv-row.is-late{box-shadow:inset 3px 0 0 #DC2626}
.fv-row.is-past{background:rgba(var(--ov),.035);color:var(--au-text3)}
.fv-row.is-past .fv-name,.fv-row.is-past .fv-c-when b,.fv-row.is-past .fv-text{color:var(--au-text2)}
.fv-row.is-done .fv-text,.fv-row.is-done .fv-name bdi{text-decoration:line-through;text-decoration-color:rgba(var(--ink),.35)}
.fv-c-done{display:flex;justify-content:center}
.fv-check{width:22px!important;min-width:0!important;height:22px;box-sizing:border-box;border-radius:7px;border:2px solid rgba(var(--ink),.3);background:var(--au-pop);color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;min-height:0}
.fv-check:hover{border-color:#16A34A}
.fv-check[aria-checked=true]{background:#16A34A;border-color:#16A34A}
.fv-c-when{display:flex;flex-direction:column;line-height:1.25}
.fv-c-when b{font-size:15px;font-weight:700;font-variant-numeric:tabular-nums}
.fv-c-when span{font-size:11.5px;color:var(--au-text3);white-space:nowrap}
.fv-c-when em{font-style:normal;margin-top:3px;align-self:flex-start;font-size:10.5px;font-weight:700;border-radius:5px;padding:0 5px;color:#DC2626;background:rgba(220,38,38,.1)}
.fv-c-name{display:flex;align-items:center;gap:10px}
.fv-ini{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
.fv-namebox{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px}
.fv-name{max-width:100%;border:none;background:none;padding:0;font:700 14px Rubik,sans-serif;color:var(--au-text);cursor:pointer;text-align:start;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:0}
.fv-name:hover{color:var(--au-brand-text);text-decoration:underline}
.fv-stage{font-size:11px;font-weight:600;border-radius:6px;padding:1px 7px;white-space:nowrap}
.fv-c-phone{display:flex;align-items:center;gap:6px}
.fv-tel{white-space:nowrap;display:inline-flex;align-items:center;gap:5px;color:var(--au-brand-text);text-decoration:none;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;min-height:0}
.fv-tel:hover{text-decoration:underline}
.fv-wa{width:28px;height:28px;border-radius:8px;border:1px solid rgba(29,168,81,.35);background:none;color:#1DA851;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;min-height:0}
.fv-wa:hover{background:rgba(29,168,81,.08)}
.fv-c-task{display:flex;align-items:flex-start;gap:7px}
.fv-kind{flex-shrink:0;font-size:10.5px;font-weight:700;border-radius:5px;padding:1px 6px;background:rgba(var(--ov),.08);color:var(--au-text2);margin-top:2px}
.fv-kind.is-fu{background:rgba(217,119,6,.12);color:#B45309}
.fv-text{font-size:13px;line-height:1.45;word-break:break-word}
.fv-camp{font-size:11.5px;font-weight:600;color:var(--au-brand-text);background:rgba(var(--brand-rgb),.1);border-radius:6px;padding:2px 7px;white-space:nowrap}
.fv-row.is-past .fv-camp{color:var(--au-text3);background:rgba(var(--ov),.07)}
.fv-notecell{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0}
.fv-last{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--au-text2);max-width:100%}
.fv-last span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fv-last svg{flex-shrink:0;color:var(--au-text3)}
.fv-addnote{display:inline-flex;align-items:center;gap:4px;border:none;background:none;padding:2px 0;font:600 12px Rubik,sans-serif;color:var(--au-brand-text);cursor:pointer;min-height:0}
.fv-addnote span{font-weight:500;color:var(--au-text3)}
.fv-note textarea{width:100%;box-sizing:border-box;resize:vertical;min-height:52px;border:1px solid var(--au-line);border-radius:9px;padding:7px 9px;font:13px/1.45 Rubik,sans-serif;background:var(--au-input,var(--au-pop));color:var(--au-text);outline:none}
.fv-note textarea:focus{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.15)}
.fv-note-bar{display:flex;gap:6px;margin-top:5px;align-items:center}
.fv-save{border:none;background:var(--au-brand);color:#fff;border-radius:8px;padding:5px 12px;font:700 12px Rubik,sans-serif;cursor:pointer;min-height:0}
.fv-save:disabled{opacity:.45;cursor:default}
.fv-c-act{display:flex;align-items:center;gap:6px}
.fv-c-act{justify-content:flex-start}
.fv-del{width:30px;height:30px;flex-shrink:0;border-radius:8px;border:1px solid var(--au-line);background:none;color:var(--au-text3);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;min-height:0}
.fv-del:hover{color:#DC2626;border-color:rgba(220,38,38,.4)}
.fv-more{display:block;margin:10px auto;border:1px solid var(--au-line);background:none;color:var(--au-text2);border-radius:999px;padding:5px 16px;font:600 12px Rubik,sans-serif;cursor:pointer;min-height:0}
.fv-empty{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:48px 24px;color:var(--au-text3);font-size:13px}
.fv-empty b{font-size:14px;color:var(--au-text2)}
.fv-modal-bg{position:fixed;inset:0;z-index:2500;background:rgba(0,0,0,.42);display:flex;align-items:flex-start;justify-content:center;padding:8vh 16px 16px}
.fv-modal{width:min(480px,100%);max-height:84vh;overflow:auto;background:var(--au-pop);color:var(--au-text);border:1px solid var(--au-line);border-radius:16px;box-shadow:var(--au-shadow3);padding:16px 18px 18px;font-family:Rubik,sans-serif}
.fv-modal-head{display:flex;align-items:center;margin-bottom:6px}
.fv-modal-head h3{flex:1;margin:0;font-size:16px;font-weight:700}
.fv-lbl{display:block;margin:12px 0 6px;font-size:12.5px;font-weight:600;color:var(--au-text2)}
.fv-input{width:100%;box-sizing:border-box;height:38px;border:1px solid var(--au-line);border-radius:10px;padding:0 11px;font:13.5px Rubik,sans-serif;background:var(--au-input,var(--au-pop));color:var(--au-text);outline:none}
.fv-input:focus{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.15)}
.fv-found{list-style:none;margin:6px 0 0;padding:4px;border:1px solid var(--au-line);border-radius:10px;max-height:230px;overflow:auto}
.fv-found button{width:100%;display:flex;align-items:center;gap:9px;border:none;background:none;border-radius:8px;padding:6px 8px;cursor:pointer;font:13px Rubik,sans-serif;color:var(--au-text);text-align:start;min-height:0}
.fv-found button:hover{background:rgba(var(--ov),.06)}
.fv-found span,.fv-picked span{color:var(--au-text3);font-size:12px;font-variant-numeric:tabular-nums}
.fv-none{padding:8px;font-size:12.5px;color:var(--au-text3)}
.fv-picked{display:flex;align-items:center;gap:9px;border:1px solid var(--au-line);border-radius:10px;padding:6px 8px}
.fv-picked b{font-size:13.5px}
.fv-picked .fv-ghost{margin-inline-start:auto}
.fv-remind{display:flex;align-items:center;gap:9px;margin-top:14px;border:none;background:none;padding:0;font:13px Rubik,sans-serif;color:var(--au-text);cursor:pointer;min-height:0}
.fv-remind[aria-checked=true] .fv-check{background:#16A34A;border-color:#16A34A}
.fv-modal-foot{display:flex;gap:8px;margin-top:18px}
@container (max-width:900px){.fv-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container (max-width:1060px){
  .fv-head{display:none}
  .fv-row{grid-template-columns:44px 1fr;grid-template-areas:"done name" "done when" "done phone" "done task" "done proj" "done notes" "done act";align-items:start;padding:6px 4px}
  .fv-c{padding:4px 8px}
  .fv-c-done{grid-area:done;padding-top:10px}.fv-c-name{grid-area:name}.fv-c-when{grid-area:when;flex-direction:row;align-items:baseline;gap:8px}
  .fv-c-phone{grid-area:phone}.fv-c-task{grid-area:task}.fv-c-proj{grid-area:proj}.fv-c-notes{grid-area:notes}.fv-c-act{grid-area:act}
  .fv-c-proj:empty{display:none}
  .fv-search--bar{margin-inline-start:0;flex:1}
}
@container (max-width:640px){.fv-top,.fv-kpis,.fv-bar,.fv-table{margin-inline:-2px}}
@media (max-width:640px){.fv{padding:12px 10px 90px}.fv-top{flex-wrap:wrap}.fv-kpis{gap:6px}.fv-kpi{padding:8px 10px}.fv-kpi b{font-size:18px}.fv-bar{gap:8px}.fv-seg{overflow-x:auto;max-width:100%}}
`
