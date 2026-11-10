// "פולו אפים" — the leads board's task screen (src/LeadsBoard.jsx, the button next to the view switch; a tab on phones): every
// dated task of every lead (crm_data.tasks: follow-ups and plain tasks) as ONE ordered list in three sections — open and coming up
// (soonest first, always on top, with day dividers) · missed (the time passed and it isn't done) · "חזרנו אליהם" (done, newest
// first, each row saying when we got back to them). A row: ✓ done / not done, when, who (face, name → the lead card, phone, project,
// stage), what to do (the task, what they look for, the last note + a note box) and actions (call, WhatsApp, done, move, delete).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Phone, Check, StickyNote, Plus, Search, Trash2, X, MessageCircle, CalendarClock, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react'
import DateTimePicker from './DateTimePicker.jsx'
import WaFace from './WaFace.jsx'
import { taskAgenda, updateTasks, addFollowUp, followUpPresets, defaultFollowUpText, israelParts, dueIso, taskStatus } from '../lib/follow-up.js'
import { addNote, asNotes } from './lib/leadNotes.js'
import { leadCampaign } from './lib/leadFields.js'
import { leadNeeds } from '../lib/lead-needs.js'
import TaskPresetInput, { rememberTaskText } from './TaskPresetInput.jsx'
import SmartVoiceInput from './SmartVoiceInput.jsx'

const pad = n => String(n).padStart(2, '0')
const local = p => { const d = String(p || '').replace(/\D/g, ''); const l = d.startsWith('972') ? '0' + d.slice(3) : d; return l.length === 10 ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l }
const digits = s => String(s || '').replace(/\D/g, '')
const dayKey = at => { const p = israelParts(at); return `${p.y}-${pad(p.m)}-${pad(p.d)}` }
const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const uid = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const TXT = {
  he: {
    title: 'פולו אפים ומשימות', sub: 'למי להתקשר עכשיו, מה עבר הזמן ולא בוצע, ומה מחכה בהמשך. לחיצה על שם פותחת את כרטיס הליד.',
    queue: 'להתקשר עכשיו', queueSub: 'מה שעבר הזמן ולא בוצע (עד יומיים אחורה), ומה שמגיע בשעתיים הקרובות', queueEmpty: 'אין כרגע שיחות שמחכות',
    nextUp: (n, w) => `הבא בתור: ${n} · ${w}`, lateNote: 'הזמן שנקבע עבר והמשימה לא סומנה כבוצעה. להתקשר, לסמן "בוצע" או להזיז למועד אחר.',
    st: { late: x => `לא בוצע · עבר לפני ${x}`, now: 'הזמן עכשיו', soon: x => `בעוד ${x}`, later: x => `בעוד ${x}`, done: 'בוצע' },
    kp: { late: 'לא בוצעו בזמן', today: 'עוד היום', tomorrow: 'מחר', week: 'השבוע', later: 'בהמשך', done: 'בוצעו היום' },
    planned: 'נקבע ל', more2: n => `ועוד ${n}`,
    btn: 'פולו אפים', add: 'משימה חדשה', search: 'חיפוש שם, טלפון, משימה…',
    groups: { late: 'עבר הזמן ולא בוצע', today: 'עוד היום', tomorrow: 'מחר', week: 'השבוע', later: 'בהמשך', done: 'בוצעו' },
    ranges: { open: 'פתוחות', late: 'לא בוצעו בזמן', today: 'היום', week: 'השבוע', done: 'בוצעו', all: 'הכל' },
    kinds: { all: 'הכל', followup: 'פולו אפים', task: 'משימות' },
    cols: { done: 'בוצע', when: 'מתי ומה המצב', name: 'למי לחזור', task: 'מה לעשות', actions: '' },
    fu: 'פולו אפ', task: 'משימה', fromWa: 'נוצר מהוואטסאפ', fromWaTip: q => `הליד כתב: "${q}"`, notDone: 'לא בוצע', markDone: 'סימון כבוצע', markOpen: 'סימון כלא בוצע',
    notePh: 'מה היה? Enter לשמירה', addNote: 'הערה', saved: 'נשמר בהערות הליד', move: 'הזזה', del: 'מחיקה',
    delAsk: 'למחוק את המשימה?', open: 'פתיחת כרטיס הליד', wa: 'וואטסאפ', call: 'התקשרות',
    empty: 'אין משימות כאן', emptySub: 'פולו אפ שנקבע בכרטיס הליד, בסיכום שיחה, במרכז הלידים או כאן יופיע ברשימה.',
    more: n => `הצגת עוד ${n}`, today: 'היום', tomorrow: 'מחר', yesterday: 'אתמול', day: d => `יום ${d}`,
    newTitle: 'משימה חדשה', lead: 'ליד', leadPh: 'חיפוש ליד לפי שם או טלפון', what: 'מה צריך לעשות', whatPh: 'למשל: לחזור עם הצעת מחיר',
    when: 'מתי', kind: 'סוג', remind: 'תזכורת בוואטסאפ ועל המסך', save: 'שמירה', cancel: 'ביטול', pickLead: 'בחרו ליד', change: 'החלפה',
    noLead: 'לא נמצא ליד', notes: n => (n === 1 ? 'הערה אחת' : `${n} הערות`),
    next: 'הבא בתור לחזור אליו', nextLate: 'הכי דחוף עכשיו', done: 'בוצע', callNow: 'התקשרות', wants: 'מחפשים:',
    lateBy: x => `באיחור ${x}`, inT: x => `בעוד ${x}`, now: 'עכשיו', min: n => `${n} דק׳`, hr: n => (n === 1 ? 'שעה' : n === 2 ? 'שעתיים' : `${n} שע׳`), days: n => (n === 1 ? 'יום' : n === 2 ? 'יומיים' : `${n} ימים`),
    sec: { open: 'פתוחות · הבאות בתור', late: 'עבר הזמן ולא בוצע', done: 'חזרנו אליהם' },
    secSub: { open: 'מהקרוב לרחוק. כשחזרנו אליהם, לסמן ✓ ולכתוב בהערה מה היה.', late: 'הזמן שנקבע עבר והמשימה עוד פתוחה: להתקשר, לסמן ✓ או להזיז למועד אחר.', done: 'מי שכבר חזרנו אליהם ומתי, החדש למעלה. ✓ שוב מחזיר לפתוחות.' },
    views: { all: 'הכל', open: 'פתוחות', late: 'לא בוצעו בזמן', done: 'חזרנו אליהם' },
    stat: { open: 'פתוחות', today: 'מהן היום', late: 'לא בוצעו בזמן', done: 'חזרנו אליהם היום', week: 'חזרנו השבוע' },
    returned: w => `חזרנו · ${w}`, returnedNo: 'בוצע', setFor: w => `נקבע ל${w}`, openNow: 'הבא בתור', openEmpty: 'אין משימות פתוחות. כל הכבוד.',
    noLate: 'אין משימות באיחור', noDone: 'עוד לא סומנו משימות כבוצעו', laterDay: 'בהמשך',
  },
  en: {
    title: 'Follow-ups & tasks', sub: 'Who to call now, what was missed, and what is coming up. A click on a name opens the lead card.',
    queue: 'Call now', queueSub: 'Missed and not done yet (up to two days back), and what is due in the next two hours', queueEmpty: 'No calls waiting right now',
    nextUp: (n, w) => `Next: ${n} · ${w}`, lateNote: 'The time passed and the task wasn\'t marked done. Call, mark it done or move it.',
    st: { late: x => `Not done · ${x} ago`, now: 'Due now', soon: x => `in ${x}`, later: x => `in ${x}`, done: 'Done' },
    kp: { late: 'Missed', today: 'Later today', tomorrow: 'Tomorrow', week: 'This week', later: 'Later', done: 'Done today' },
    planned: 'Set for ', more2: n => `+${n} more`,
    btn: 'Follow-ups', add: 'New task', search: 'Search name, phone, task…',
    groups: { late: 'Missed — not done yet', today: 'Later today', tomorrow: 'Tomorrow', week: 'This week', later: 'Later', done: 'Done' },
    ranges: { open: 'Open', late: 'Missed', today: 'Today', week: 'This week', done: 'Done', all: 'All' },
    kinds: { all: 'All', followup: 'Follow-ups', task: 'Tasks' },
    cols: { done: 'Done', when: 'When & status', name: 'Who', task: 'What to do', actions: '' },
    fu: 'Follow-up', task: 'Task', fromWa: 'From WhatsApp', fromWaTip: q => `The lead wrote: "${q}"`, notDone: 'Not done', markDone: 'Mark as done', markOpen: 'Mark as not done',
    notePh: 'What happened? Enter to save', addNote: 'Note', saved: 'Saved to the lead\'s notes', move: 'Move', del: 'Delete',
    delAsk: 'Delete this task?', open: 'Open the lead card', wa: 'WhatsApp', call: 'Call',
    empty: 'No tasks here', emptySub: 'A follow-up set in the lead card, a call summary, the Lead Center or here shows in this list.',
    more: n => `Show ${n} more`, today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday', day: d => d,
    newTitle: 'New task', lead: 'Lead', leadPh: 'Find a lead by name or phone', what: 'What to do', whatPh: 'e.g. call back with a price offer',
    when: 'When', kind: 'Type', remind: 'WhatsApp and on-screen reminder', save: 'Save', cancel: 'Cancel', pickLead: 'Pick a lead', change: 'Change',
    noLead: 'No lead found', notes: n => (n === 1 ? '1 note' : `${n} notes`),
    next: 'Next to get back to', nextLate: 'Most urgent now', done: 'Done', callNow: 'Call', wants: 'Looking for:',
    lateBy: x => `${x} late`, inT: x => `in ${x}`, now: 'now', min: n => `${n} min`, hr: n => `${n} h`, days: n => (n === 1 ? '1 day' : `${n} days`),
    sec: { open: 'Open · coming up', late: 'Missed — not done yet', done: 'Got back to them' },
    secSub: { open: 'Soonest first. Once we got back to them, tick ✓ and note what happened.', late: 'The time passed and the task is still open: call, tick ✓ or move it.', done: 'Who we already got back to and when, newest first. Untick to reopen.' },
    views: { all: 'All', open: 'Open', late: 'Missed', done: 'Done' },
    stat: { open: 'Open', today: 'Due today', late: 'Missed', done: 'Done today', week: 'Done this week' },
    returned: w => `Done · ${w}`, returnedNo: 'Done', setFor: w => `Set for ${w}`, openNow: 'Next up', openEmpty: 'No open tasks. Well done.',
    noLate: 'Nothing missed', noDone: 'Nothing marked done yet', laterDay: 'Later',
  },
}
const SOON_MS = 10 * 60e3   // a task due within 10 minutes (or just now) still counts as open, not missed

function whenText(at, now, t, en) {
  const p = israelParts(at), k = dayKey(at)
  const rel = k === dayKey(now) ? t.today : k === dayKey(now + 864e5) ? t.tomorrow : k === dayKey(now - 864e5) ? t.yesterday : t.day(en ? EN_DAYS[p.wd] : HE_DAYS[p.wd])
  return { time: `${pad(p.h)}:${pad(p.min)}`, date: `${rel} · ${p.d}.${p.m}${p.y !== israelParts(now).y ? `.${String(p.y).slice(2)}` : ''}` }
}

// how far the task is from now in words, and its status: "לא בוצע · עבר לפני 40 דק׳" / "הזמן עכשיו" / "בעוד שעתיים" / "בוצע"
function spanText(ms, t) {
  const m = Math.round(Math.abs(ms) / 60e3)
  return m < 60 ? t.min(Math.max(1, m)) : m < 24 * 60 ? t.hr(Math.round(m / 60)) : t.days(Math.round(m / 1440))
}
function statusOf(it, now, t) {
  const tone = taskStatus(it, now)
  const text = tone === 'done' ? t.st.done : tone === 'now' ? t.st.now : t.st[tone](spanText(it.due - now, t))
  return { tone, text }
}

function NoteCell({ lead, t, lang = 'he', onUpdate }) {
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
        <SmartVoiceInput value={draft} onChange={setDraft} contextType="note" recordId={lead.id} lang={lang} inputRef={ref} size="sm" hint={[lead?.name, lead?.campaignName].filter(Boolean).join(', ')}
          onCreateTasks={items => { onUpdate(lead.id, updateTasks(lead, [...(Array.isArray(lead.tasks) ? lead.tasks : []), ...items])); return true }}/>
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
  const st = statusOf(it, now, t)
  const stage = (stages || []).find(g => g.id === (lead.leadStatus || 'new'))
  const camp = leadCampaign(lead, lang)
  const needs = (() => { try { return leadNeeds(lead, lang).needs || '' } catch { return '' } })()
  const text = String(task.text || '').trim() || defaultFollowUpText(lead, lang)
  const doneAt = Number(task.doneAt) || 0
  const dw = doneAt ? whenText(doneAt, now, t, en) : null
  const setTasks = next => onUpdate(lead.id, updateTasks(lead, next))
  const toggle = () => setTasks((lead.tasks || []).map(x => (x.id === task.id ? { ...x, done: !x.done, doneAt: !x.done ? Date.now() : null } : x)))
  const move = v => { const iso = dueIso(v); if (iso) setTasks((lead.tasks || []).map(x => (x.id === task.id ? { ...x, due: iso, done: false, doneAt: null, remindedAt: null, remindGaveUp: false } : x))) }
  const del = () => { if (window.confirm(t.delAsk)) setTasks((lead.tasks || []).filter(x => x.id !== task.id)) }
  const tel = lead.phone ? digits(local(lead.phone)) : ''
  return (
    <div role="row" className={`fv-row is-${it.section}${it.section === 'open' && (st.tone === 'now' || st.tone === 'soon') ? ' is-soon' : ''}`}>
      <div role="cell" className="fv-c fv-c-done">
        <button type="button" role="checkbox" aria-checked={it.done} className="fv-check" onClick={toggle}
          aria-label={`${it.done ? t.markOpen : t.markDone}: ${name}`} title={it.done ? t.markOpen : t.markDone}>
          {it.done && <Check size={14} strokeWidth={3}/>}
        </button>
      </div>
      <div role="cell" className="fv-c fv-c-when">
        {it.done ? <>
          <b dir="ltr">{dw ? dw.time : w.time}</b>
          <span>{dw ? dw.date : w.date}</span>
          <em className="fv-st is-done"><Check size={11} strokeWidth={3}/>{dw ? t.returned(dw.date.split(' · ')[0]) : t.returnedNo}</em>
          {dw && <small className="fv-setfor">{t.setFor(`${w.date.split(' · ')[0]} ${w.time}`)}</small>}
        </> : <>
          <b dir="ltr">{w.time}</b><span>{w.date}</span>
          <em className={`fv-st is-${st.tone}`}>{st.text}</em>
        </>}
      </div>
      <div role="cell" className="fv-c fv-c-name">
        <WaFace phone={lead.phone} lead={lead} name={name} size={40} lang={lang} style={{ background: (stage?.color || '#6366F1') + '22' }}>
          <span className="fv-ini" style={{ color: stage?.color || 'var(--au-brand-text)' }}>{name.charAt(0)}</span>
        </WaFace>
        <div className="fv-namebox">
          <button type="button" className="fv-name" onClick={() => onOpen(lead)} title={t.open}><bdi>{name}</bdi></button>
          <div className="fv-meta">
            {lead.phone && <a href={`tel:${tel}`} dir="ltr" className="fv-tel" title={t.call}>{local(lead.phone)}</a>}
            {camp && <span className="fv-camp">{camp}</span>}
            {stage && <span className="fv-stage"><i style={{ background: stage.color }}/>{en ? stage.en : stage.label}</span>}
          </div>
        </div>
      </div>
      <div role="cell" className="fv-c fv-c-task">
        <div className="fv-taskline">
          {task.kind !== 'followup' && <span className="fv-kind">{t.task}</span>}
          {task.auto === 'wa' && <span className="fv-kind is-wa" title={task.quote ? t.fromWaTip(task.quote) : undefined}>{t.fromWa}</span>}
          <span className="fv-text" dir="auto">{text}</span>
        </div>
        {needs && !it.done && <div className="fv-needs" dir="auto"><b>{t.wants}</b> {needs}</div>}
        <NoteCell lead={lead} t={t} lang={lang} onUpdate={onUpdate}/>
      </div>
      <div role="cell" className="fv-c fv-c-act">
        {!it.done && tel && <a href={`tel:${tel}`} className="fv-call" title={`${t.callNow}: ${name}`}><Phone size={14}/>{t.callNow}</a>}
        {onOpenChat && lead.phone && <button type="button" className="fv-wa" onClick={() => onOpenChat(lead)} aria-label={`${t.wa}: ${name}`} title={t.wa}><MessageCircle size={15}/></button>}
        {!it.done && <button type="button" className="fv-donebtn" onClick={toggle} title={t.markDone}><Check size={14} strokeWidth={2.6}/>{t.done}</button>}
        <DateTimePicker value={dueIso(task.due)} onChange={move} format="iso" lang={lang} presets={followUpPresets(Date.now(), lang)}
          clearable={false} label={t.move} text={t.move} size="sm"/>
        <button type="button" className="fv-del" onClick={del} aria-label={`${t.del}: ${text}`} title={t.del}><Trash2 size={14}/></button>
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
    rememberTaskText(text)
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
            <WaFace phone={lead.phone} lead={lead} name={lead.name} size={30} lang={lang}><span className="fv-ini">{String(lead.name || '?').charAt(0)}</span></WaFace>
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
                    <WaFace phone={l.phone} lead={l} name={l.name} size={26} lang={lang} zoom={false}><span className="fv-ini">{String(l.name || '?').charAt(0)}</span></WaFace>
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
        <TaskPresetInput id="fv-what" value={text} onChange={setText} lang={lang} kind={kind} placeholder={kind === 'followup' && lead ? defaultFollowUpText(lead, lang) : t.whatPh}
          onPick={(p, d) => { if (!due && d) setDue(d) }} inputStyle={{ height: 42 }}/>
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

/** the day divider inside the open section: היום / מחר / יום שלישי · 10.11 / בהמשך (more than a week ahead) */
function dayLabel(at, now, t, en) {
  const k = dayKey(at)
  if (k === dayKey(now)) return t.today
  if (k === dayKey(now + 864e5)) return t.tomorrow
  if (at - now > 7 * 864e5) return t.laterDay
  const p = israelParts(at)
  return `${t.day(en ? EN_DAYS[p.wd] : HE_DAYS[p.wd])} · ${p.d}.${p.m}`
}

function Section({ t, id, icon, list, children, empty, more }) {
  return (
    <section className={`fv-sec fv-sec--${id}`} aria-label={t.sec[id]}>
      <header className="fv-sec-h">
        <span className="fv-sec-ic">{icon}</span>
        <div><h3>{t.sec[id]}<em>{list.length}</em></h3><p>{t.secSub[id]}</p></div>
      </header>
      {list.length ? <div className="fv-list" role="table" aria-label={t.sec[id]}>{children}</div> : <div className="fv-sec-empty">{empty}</div>}
      {more}
    </section>
  )
}

export default function FollowUpsView({ leads, lang = 'he', stages, onUpdate, onOpen, onOpenChat }) {
  const en = lang === 'en', t = TXT[en ? 'en' : 'he']
  const ss = (k, d) => { try { return sessionStorage.getItem(k) || d } catch { return d } }
  const [view, setView] = useState(() => { const v = ss('afik_fv_view', 'all'); return ['all', 'open', 'late', 'done'].includes(v) ? v : 'all' })
  const [kind, setKind] = useState(() => ss('afik_fv_kind', 'all'))
  const [q, setQ] = useState('')
  const [doneShown, setDoneShown] = useState(15)
  const [lateShown, setLateShown] = useState(20)
  const [adding, setAdding] = useState(false)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id) }, [])
  useEffect(() => { try { sessionStorage.setItem('afik_fv_view', view); sessionStorage.setItem('afik_fv_kind', kind) } catch {} }, [view, kind])

  // every dated task → one of three sections: open (due now or later), late (passed, not done), done
  const items = useMemo(() => {
    const ag = taskAgenda(leads, { now })
    return [...ag.upcoming, ...ag.past].map(x => ({ ...x, section: x.done ? 'done' : x.due > now - SOON_MS ? 'open' : 'late' }))
  }, [leads, now])
  const stats = useMemo(() => {
    const today = dayKey(now), weekAgo = now - 7 * 864e5
    const c = { open: 0, today: 0, late: 0, done: 0, week: 0 }
    for (const x of items) {
      if (x.section === 'open') { c.open++; if (dayKey(x.due) === today) c.today++ }
      else if (x.section === 'late') c.late++
      else { const at = Number(x.task.doneAt) || 0; if (at && dayKey(at) === today) c.done++; if (at >= weekAgo) c.week++ }
    }
    return c
  }, [items, now])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase(), d = digits(q).replace(/^972/, '0')
    return items.filter(x => {
      if (kind !== 'all' && (kind === 'followup') !== (x.task.kind === 'followup')) return false
      if (!s) return true
      return String(x.lead.name || '').toLowerCase().includes(s) || String(x.task.text || '').toLowerCase().includes(s)
        || (d.length >= 3 && digits(x.lead.phone).replace(/^972/, '0').includes(d))
    })
  }, [items, kind, q])
  const open = filtered.filter(x => x.section === 'open').sort((a, b) => a.due - b.due)
  const late = filtered.filter(x => x.section === 'late').sort((a, b) => b.due - a.due)
  const done = filtered.filter(x => x.section === 'done').sort((a, b) => (Number(b.task.doneAt) || b.due) - (Number(a.task.doneAt) || a.due))
  const show = sec => view === 'all' || view === sec
  const next = open[0] || null
  const rowProps = { now, t, en, lang, stages, onUpdate, onOpen, onOpenChat }
  // the open list with a divider before every new day
  const openRows = []
  let lastDay = ''
  for (const it of open) {
    const lbl = dayLabel(it.due, now, t, en)
    if (lbl !== lastDay) { openRows.push(<div key={`d-${lbl}`} className="fv-day" role="presentation"><span>{lbl}</span></div>); lastDay = lbl }
    openRows.push(<Row key={it.key} it={it} {...rowProps}/>)
  }

  return (
    <div className="fv" dir={en ? 'ltr' : 'rtl'}>
      <div className="fv-top">
        <div className="fv-titles">
          <h2><span className="fv-title-ic"><Bell size={15}/></span>{t.title}</h2>
          <p>{t.sub}</p>
        </div>
        <button type="button" className="fv-primary" onClick={() => setAdding(true)}><Plus size={15}/>{t.add}</button>
      </div>
      <div className="fv-stats">
        {[['open', stats.open, 'open', 'brand'], ['today', stats.today, 'open', ''], ['late', stats.late, 'late', stats.late ? 'red' : ''], ['done', stats.done, 'done', 'green'], ['week', stats.week, 'done', '']].map(([k, n, v, tone]) => (
          <button key={k} type="button" className={`fv-stat fv-stat--${k}${tone ? ` is-${tone}` : ''}${view === v && (k === 'open' || k === 'late' || k === 'done') ? ' is-on' : ''}`} onClick={() => setView(view === v ? 'all' : v)}>
            <b>{n}</b><span>{t.stat[k]}</span>
          </button>
        ))}
      </div>
      {next && view !== 'done' && (
        <div className={`fv-next${taskStatus(next, now) === 'now' ? ' is-now' : ''}`}>
          <span className="fv-next-l"><CalendarClock size={15}/>{t.openNow}</span>
          <button type="button" className="fv-next-name" onClick={() => onOpen(next.lead)}><bdi>{String(next.lead.name || '').trim() || local(next.lead.phone)}</bdi></button>
          <span className="fv-next-when" dir="auto">{(() => { const w = whenText(next.due, now, t, en); return `${w.date.split(' · ')[0]} ${w.time}` })()} · {statusOf(next, now, t).text}</span>
          <span className="fv-next-task" dir="auto">{String(next.task.text || '').trim() || defaultFollowUpText(next.lead, lang)}</span>
          {next.lead.phone && <a className="fv-call" href={`tel:${digits(local(next.lead.phone))}`}><Phone size={14}/>{t.callNow}</a>}
        </div>
      )}
      <div className="fv-bar">
        <div className="fv-seg" role="tablist" aria-label={t.title}>
          {Object.entries(t.views).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}>{l}{id !== 'all' && <span className="fv-seg-n">{id === 'open' ? stats.open : id === 'late' ? stats.late : done.length}</span>}</button>)}
        </div>
        <div className="fv-seg" role="tablist" aria-label={t.kind}>
          {Object.entries(t.kinds).map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={kind === id} onClick={() => setKind(id)}>{l}</button>)}
        </div>
        <div className="fv-search fv-search--bar"><Search size={14}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}/>{q && <button type="button" className="fv-ghost" onClick={() => setQ('')} aria-label={t.cancel}><X size={13}/></button>}</div>
      </div>
      {show('open') && <Section t={t} id="open" icon={<CalendarClock size={16}/>} list={open} empty={t.openEmpty}>{openRows}</Section>}
      {show('late') && <Section t={t} id="late" icon={<AlertCircle size={16}/>} list={late} empty={t.noLate}
        more={late.length > lateShown && <button type="button" className="fv-more" onClick={() => setLateShown(n => n + 40)}><ChevronDown size={13}/>{t.more(late.length - lateShown)}</button>}>
        {late.slice(0, lateShown).map(it => <Row key={it.key} it={it} {...rowProps}/>)}
      </Section>}
      {show('done') && <Section t={t} id="done" icon={<CheckCircle2 size={16}/>} list={done} empty={t.noDone}
        more={done.length > doneShown && <button type="button" className="fv-more" onClick={() => setDoneShown(n => n + 40)}><ChevronDown size={13}/>{t.more(done.length - doneShown)}</button>}>
        {done.slice(0, doneShown).map(it => <Row key={it.key} it={it} {...rowProps}/>)}
      </Section>}
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
.fv{flex:1;min-height:0;overflow-y:auto;container-type:inline-size;padding:20px 22px 48px;font-family:Rubik,sans-serif;color:var(--au-text);background:var(--au-bg)}
.fv-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}
.fv-titles{flex:1;min-width:0}
.fv-titles h2{margin:0;display:flex;align-items:center;gap:10px;font-size:20px;font-weight:600;letter-spacing:-.01em}
.fv-title-ic{width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:rgba(var(--brand-rgb),.1);color:var(--au-brand-text)}
.fv-titles p{margin:5px 0 0;font-size:13px;color:var(--au-text3)}
.fv-primary{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 16px;border:none;border-radius:10px;background:var(--au-brand);color:#fff;font:600 13px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.fv-primary:disabled{opacity:.45;cursor:default}
.fv-secondary{height:36px;padding:0 16px;border:1px solid var(--au-line);border-radius:10px;background:none;color:var(--au-text);font:500 13px Rubik,sans-serif;cursor:pointer;min-height:0}
.fv-ghost{display:inline-flex;align-items:center;gap:4px;border:none;background:none;color:var(--au-text3);cursor:pointer;padding:4px 6px;border-radius:7px;font:500 12px Rubik,sans-serif;min-height:0}
.fv-ghost:hover{background:rgba(var(--ov),.07);color:var(--au-text)}
/* the summary */
.fv-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;margin-bottom:14px;border:1px solid var(--au-line);border-radius:14px;overflow:hidden;background:var(--au-line)}
.fv-stat{display:flex;flex-direction:column;align-items:flex-start;gap:2px;border:none;padding:12px 16px;background:var(--au-pop);cursor:pointer;font-family:inherit;text-align:start;min-height:0;transition:background .12s}
.fv-stat:hover{background:rgba(var(--ov),.03)}
.fv-stat b{font-size:24px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--au-text);line-height:1.15;letter-spacing:-.02em}
.fv-stat span{font-size:12.5px;color:var(--au-text3)}
.fv-stat.is-brand b{color:var(--au-brand-text)}
.fv-stat.is-red b{color:#DC2626}
.fv-stat.is-green b{color:#15803D}
.fv-stat.is-on{background:rgba(var(--brand-rgb),.07);box-shadow:inset 0 -2px 0 var(--au-brand)}
/* next up */
.fv-next{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;margin-bottom:14px;padding:10px 14px;border-radius:14px;background:var(--au-pop);border:1px solid rgba(var(--brand-rgb),.28);box-shadow:0 1px 3px rgba(0,0,0,.04)}
.fv-next.is-now{border-color:rgba(217,119,6,.5);background:rgba(217,119,6,.05)}
.fv-next-l{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--au-brand-text);background:rgba(var(--brand-rgb),.1);border-radius:999px;padding:3px 10px}
.fv-next.is-now .fv-next-l{color:#B45309;background:rgba(217,119,6,.12)}
.fv-next-name{border:none;background:none;padding:0;font:600 15px Rubik,sans-serif;color:var(--au-text);cursor:pointer;min-height:0}
.fv-next-name:hover{color:var(--au-brand-text);text-decoration:underline}
.fv-next-when{font-size:13px;color:var(--au-text2);font-variant-numeric:tabular-nums}
.fv-next-task{flex:1;min-width:160px;font-size:13px;color:var(--au-text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* the toolbar */
.fv-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:16px}
.fv-seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:rgba(var(--ov),.06)}
.fv-seg button{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:none;border-radius:8px;background:transparent;color:var(--au-text2);font:500 12.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0}
.fv-seg button[aria-selected=true],.fv-seg button[aria-pressed=true]{background:var(--au-pop);color:var(--au-text);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08),0 1px 6px rgba(0,0,0,.05)}
.fv-seg-n{font-size:11px;font-weight:600;color:var(--au-text3);font-variant-numeric:tabular-nums}
.fv-search{display:flex;align-items:center;gap:8px;height:36px;border:1px solid var(--au-line);border-radius:10px;padding:0 10px;background:var(--au-input,var(--au-pop));color:var(--au-text3)}
.fv-search input{flex:1;min-width:0;border:none;outline:none;background:none;font:13px Rubik,sans-serif;color:var(--au-text);min-height:0}
.fv-search--bar{margin-inline-start:auto;min-width:240px}
/* the three sections */
.fv-sec{margin-bottom:18px;border:1px solid var(--au-line);border-radius:16px;background:var(--au-pop);overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.03)}
.fv-sec-h{display:flex;align-items:flex-start;gap:12px;padding:14px 16px 12px;border-bottom:1px solid var(--au-line)}
.fv-sec-ic{width:32px;height:32px;flex-shrink:0;border-radius:10px;display:inline-flex;align-items:center;justify-content:center}
.fv-sec-h h3{margin:0;display:flex;align-items:center;gap:8px;font-size:15.5px;font-weight:600}
.fv-sec-h h3 em{font-style:normal;font-size:12px;font-weight:600;border-radius:999px;padding:1px 9px;font-variant-numeric:tabular-nums}
.fv-sec-h p{margin:3px 0 0;font-size:12.5px;color:var(--au-text3);line-height:1.5}
.fv-sec--open .fv-sec-ic{background:rgba(var(--brand-rgb),.1);color:var(--au-brand-text)}
.fv-sec--open h3 em{background:rgba(var(--brand-rgb),.1);color:var(--au-brand-text)}
.fv-sec--late{border-color:rgba(220,38,38,.28)}
.fv-sec--late .fv-sec-h{background:rgba(220,38,38,.04)}
.fv-sec--late .fv-sec-ic{background:rgba(220,38,38,.1);color:#DC2626}
.fv-sec--late h3{color:#B91C1C}
.fv-sec--late h3 em{background:#DC2626;color:#fff}
.fv-sec--done .fv-sec-ic{background:rgba(22,163,74,.1);color:#15803D}
.fv-sec--done h3 em{background:rgba(22,163,74,.12);color:#15803D}
.fv-sec-empty{padding:22px 18px;font-size:13px;color:var(--au-text3)}
.fv-day{position:sticky;top:0;z-index:1;padding:7px 16px;background:rgba(var(--ov),.035);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-bottom:1px solid var(--au-line);font-size:12px;font-weight:600;color:var(--au-text2);letter-spacing:.01em}
.fv-list > .fv-day:not(:first-child){border-top:1px solid var(--au-line)}
/* a row */
.fv-row{display:grid;grid-template-columns:52px 150px minmax(220px,1.1fr) minmax(240px,1.6fr) auto;align-items:center;transition:background .12s}
.fv-list > .fv-row + .fv-row{border-top:1px solid var(--au-line)}
.fv-row:hover{background:rgba(var(--ov),.02)}
.fv-row.is-soon{box-shadow:inset -3px 0 0 #D97706}
[dir=ltr] .fv-row.is-soon{box-shadow:inset 3px 0 0 #D97706}
.fv-row.is-late{box-shadow:inset -3px 0 0 #DC2626}
[dir=ltr] .fv-row.is-late{box-shadow:inset 3px 0 0 #DC2626}
.fv-row.is-late .fv-c-when b{color:#DC2626}
.fv-row.is-done{background:rgba(var(--ov),.012)}
.fv-row.is-done .fv-text{color:var(--au-text2)}
.fv-row.is-done .fv-c-when b{color:#15803D}
.fv-c{padding:12px 10px;min-width:0}
.fv-c-done{display:flex;justify-content:center}
.fv-check{width:24px!important;min-width:0!important;height:24px;box-sizing:border-box;border-radius:50%;border:2px solid rgba(var(--ink),.25);background:var(--au-pop);color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;min-height:0;transition:border-color .12s,background .12s}
.fv-check:hover{border-color:#16A34A;background:rgba(22,163,74,.08)}
.fv-check[aria-checked=true]{background:#16A34A;border-color:#16A34A}
.fv-c-when{display:flex;flex-direction:column;line-height:1.25}
.fv-c-when b{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.fv-c-when span{font-size:11.5px;color:var(--au-text3);white-space:nowrap}
.fv-setfor{margin-top:3px;font-size:11px;color:var(--au-text3)}
.fv-st{font-style:normal;display:inline-flex;align-items:center;gap:3px;margin-top:6px;align-self:flex-start;font-size:11.5px;font-weight:600;border-radius:999px;padding:2px 9px;white-space:normal;line-height:1.5}
.fv-st.is-late{color:#B91C1C;background:rgba(220,38,38,.1)}
.fv-st.is-now{color:#fff;background:#D97706}
.fv-st.is-soon{color:#92400E;background:#FEF3C7}
.fv-st.is-later{color:var(--au-text2);background:rgba(var(--ov),.07)}
.fv-st.is-done{color:#15803D;background:rgba(22,163,74,.12)}
.fv-c-name{display:flex;align-items:center;gap:11px}
.fv-ini{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}
.fv-namebox{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:4px}
.fv-name{max-width:100%;border:none;background:none;padding:0;font:600 15px Rubik,sans-serif;color:var(--au-text);cursor:pointer;text-align:start;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:0}
.fv-name:hover{color:var(--au-brand-text);text-decoration:underline}
.fv-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.fv-tel{white-space:nowrap;display:inline-flex;align-items:center;gap:5px;color:var(--au-text2);text-decoration:none;font-size:12.5px;font-weight:500;font-variant-numeric:tabular-nums;min-height:0}
.fv-tel:hover{color:var(--au-brand-text);text-decoration:underline}
.fv-camp{font-size:11.5px;font-weight:500;color:var(--au-text2);background:rgba(var(--ov),.06);border-radius:6px;padding:2px 7px;white-space:nowrap}
.fv-stage{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--au-text3);white-space:nowrap}
.fv-stage i{width:7px;height:7px;border-radius:50%;display:inline-block}
.fv-c-task{display:flex;flex-direction:column;align-items:stretch;gap:4px}
.fv-taskline{display:flex;align-items:flex-start;gap:7px}
.fv-text{font-size:14px;font-weight:600;line-height:1.45;word-break:break-word}
.fv-kind{flex-shrink:0;font-size:10.5px;font-weight:600;border-radius:5px;padding:1px 6px;background:rgba(var(--ov),.08);color:var(--au-text2);margin-top:2px}
.fv-kind.is-wa{background:rgba(29,168,81,.12);color:#15803D}
.fv-needs{font-size:12px;color:var(--au-text2);line-height:1.45}
.fv-needs b{font-weight:600;color:var(--au-text3)}
.fv-notecell{display:flex;flex-direction:column;align-items:flex-start;gap:3px;min-width:0}
.fv-last{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--au-text2);max-width:100%}
.fv-last span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fv-last svg{flex-shrink:0;color:var(--au-text3)}
.fv-addnote{display:inline-flex;align-items:center;gap:4px;border:none;background:none;padding:2px 0;font:500 12px Rubik,sans-serif;color:var(--au-brand-text);cursor:pointer;min-height:0}
.fv-addnote span{font-weight:400;color:var(--au-text3)}
.fv-note textarea{width:100%;box-sizing:border-box;resize:vertical;min-height:52px;border:1px solid var(--au-line);border-radius:9px;padding:7px 9px;font:13px/1.45 Rubik,sans-serif;background:var(--au-input,var(--au-pop));color:var(--au-text);outline:none}
.fv-note textarea:focus{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.15)}
.fv-note-bar{display:flex;gap:6px;margin-top:5px;align-items:center}
.fv-save{border:none;background:var(--au-brand);color:#fff;border-radius:8px;padding:5px 12px;font:600 12px Rubik,sans-serif;cursor:pointer;min-height:0}
.fv-save:disabled{opacity:.45;cursor:default}
.fv-c-act{display:flex;align-items:center;gap:6px;justify-content:flex-start;padding-inline-end:14px}
.fv-call{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 14px;border-radius:9px;background:#16A34A;color:#fff;text-decoration:none;font:600 13px Rubik,sans-serif;white-space:nowrap;min-height:0}
.fv-call:hover{background:#15803D}
.fv-donebtn{display:inline-flex;align-items:center;gap:5px;height:34px;padding:0 12px;border-radius:9px;border:1px solid rgba(22,163,74,.4);background:none;color:#15803D;font:600 12.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0}
.fv-donebtn:hover{background:rgba(22,163,74,.08)}
.fv-wa{width:34px;height:34px;border-radius:9px;border:1px solid rgba(29,168,81,.35);background:none;color:#1DA851;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;min-height:0}
.fv-wa:hover{background:rgba(29,168,81,.08)}
.fv-del{width:32px;height:32px;flex-shrink:0;border-radius:8px;border:1px solid transparent;background:none;color:var(--au-text3);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;min-height:0}
.fv-del:hover{color:#DC2626;border-color:rgba(220,38,38,.35)}
.fv-more{display:flex;align-items:center;gap:5px;margin:0 auto;border:none;border-top:1px solid var(--au-line);width:100%;justify-content:center;background:none;color:var(--au-text2);padding:10px 16px;font:600 12.5px Rubik,sans-serif;cursor:pointer;min-height:0}
.fv-more:hover{background:rgba(var(--ov),.03);color:var(--au-text)}
/* the new-task dialog */
.fv-modal-bg{position:fixed;inset:0;z-index:2500;background:rgba(0,0,0,.42);display:flex;align-items:flex-start;justify-content:center;padding:8vh 16px 16px}
.fv-modal{width:min(480px,100%);max-height:84vh;overflow:auto;background:var(--au-pop);color:var(--au-text);border:1px solid var(--au-line);border-radius:16px;box-shadow:var(--au-shadow3);padding:16px 18px 18px;font-family:Rubik,sans-serif}
.fv-modal-head{display:flex;align-items:center;margin-bottom:6px}
.fv-modal-head h3{flex:1;margin:0;font-size:16px;font-weight:600}
.fv-lbl{display:block;margin:12px 0 6px;font-size:12.5px;font-weight:600;color:var(--au-text2)}
.fv-found{list-style:none;margin:6px 0 0;padding:4px;border:1px solid var(--au-line);border-radius:10px;max-height:230px;overflow:auto}
.fv-found button{width:100%;display:flex;align-items:center;gap:9px;border:none;background:none;border-radius:8px;padding:6px 8px;cursor:pointer;font:13px Rubik,sans-serif;color:var(--au-text);text-align:start;min-height:0}
.fv-found button:hover{background:rgba(var(--ov),.06)}
.fv-found span,.fv-picked span{color:var(--au-text3);font-size:12px;font-variant-numeric:tabular-nums}
.fv-none{padding:8px;font-size:12.5px;color:var(--au-text3)}
.fv-picked{display:flex;align-items:center;gap:9px;border:1px solid var(--au-line);border-radius:10px;padding:6px 8px}
.fv-picked b{font-size:13.5px}
.fv-picked .fv-ghost{margin-inline-start:auto}
.fv-remind{display:flex;align-items:center;gap:9px;margin-top:14px;border:none;background:none;padding:0;font:13px Rubik,sans-serif;color:var(--au-text);cursor:pointer;min-height:0}
.fv-remind .fv-check{border-radius:7px}
.fv-remind[aria-checked=true] .fv-check{background:#16A34A;border-color:#16A34A}
.fv-modal-foot{display:flex;gap:8px;margin:18px -18px -18px;padding:12px 18px 14px;position:sticky;bottom:-18px;z-index:3;background:var(--au-pop);border-top:1px solid var(--au-line)}.fv-modal-foot>button{min-height:44px}
@container (max-width:900px){.fv-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.fv-stat--today,.fv-stat--week{display:none}}
@container (max-width:1060px){
  .fv-row{grid-template-columns:44px minmax(0,1fr);grid-template-areas:"done name" "done when" "done task" "done act";align-items:start;padding:6px 4px}
  .fv-c{padding:4px 8px}
  .fv-c-done{grid-area:done;padding-top:12px}.fv-c-name{grid-area:name}.fv-c-when{grid-area:when;flex-direction:row;align-items:baseline;gap:8px;flex-wrap:wrap}
  .fv-c-when .fv-st,.fv-setfor{margin-top:0}
  .fv-c-task{grid-area:task}.fv-c-act{grid-area:act;flex-wrap:wrap;padding-bottom:10px}
  .fv-search--bar{margin-inline-start:0;flex:1}
}
@media (max-width:640px){.fv{padding:12px 10px 90px}.fv-top{flex-wrap:wrap}.fv-stat{padding:9px 11px}.fv-stat b{font-size:19px}.fv-bar{gap:8px}.fv-seg{overflow-x:auto;max-width:100%}.fv-next-task{flex-basis:100%}.fv-sec{border-radius:14px}}
`
