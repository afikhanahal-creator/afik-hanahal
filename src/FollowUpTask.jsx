// Follow-up tasks: "get back to <name> on <day> at <time>", with a WhatsApp reminder to the office when it is due
// (lib/follow-up.js; the server's remindTasks() sends it). The same pieces everywhere a lead is open: the lead card's
// tasks tab, the Lead Center, the chats tab and the call summary. Every save goes through the admin's updateLead, so the
// board, the card, the Lead Center and the chats show it at once (and other devices with the next sync).
import { useRef, useState } from 'react'
import DateTimePicker from './DateTimePicker.jsx'
import { Popover } from './automationsUI.jsx'
import { addFollowUp, followUpPresets, defaultFollowUpText, describeDue, dueIso, updateTasks, openFollowUps, dueFromNow, dueParts } from '../lib/follow-up.js'
import { leadNotes, addNote } from './lib/leadNotes.js'
import TaskPresetInput, { rememberTaskText } from './TaskPresetInput.jsx'
import SmartVoiceInput from './SmartVoiceInput.jsx'

const L = (lang, he, en) => (lang === 'en' ? en : he)

export const FU_CSS = `
.fu{display:flex;flex-direction:column;gap:14px}
.fu-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.fu-in{width:100%;box-sizing:border-box;min-width:0;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--au-s3-line);background:var(--au-s3);color:var(--au-text);font:inherit;font-size:13.5px;outline:none}
.fu-in:focus{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.18)}
.fu-field{display:flex;flex-direction:column;gap:7px;min-width:0}
.fu-lbl{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--au-text2);letter-spacing:.01em}
.fu-lbl svg{color:var(--au-text3)}
.fu-chips{display:flex;flex-wrap:wrap;gap:6px}
.fu-chip{min-height:0;height:32px;padding:0 12px;border-radius:999px;border:1px solid var(--au-s3-line);background:var(--au-s3);color:var(--au-text);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .12s,border-color .12s,color .12s;-webkit-tap-highlight-color:transparent}
.fu-chip:hover{border-color:rgba(var(--brand-rgb),.45)}
.fu-chip[aria-pressed="true"]{background:var(--au-brand);border-color:var(--au-brand);color:#fff;font-weight:600}
.fu-chip:focus-visible{outline:2px solid var(--au-brand);outline-offset:2px}
.fu-when-box{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:12px;background:rgba(var(--ov),.03);border:1px solid var(--au-s3-line)}
.fu-sum{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:12.5px;color:var(--au-text2);line-height:1.4;padding:0 2px}
.fu-sum b{color:var(--au-text);font-weight:600}
.fu-sum .rel{margin-inline-start:auto;flex:none;font-size:11.5px;font-weight:600;color:var(--au-brand-text);background:rgba(var(--brand-rgb),.1);border-radius:999px;padding:2px 8px;white-space:nowrap}
.fu-rem{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:1px solid var(--au-s3-line);background:var(--au-s3);cursor:pointer;user-select:none;transition:border-color .12s,background .12s}
.fu-rem.on{border-color:rgba(37,211,102,.45);background:rgba(37,211,102,.06)}
.fu-rem-ico{width:32px;height:32px;border-radius:9px;flex:none;display:inline-flex;align-items:center;justify-content:center;background:rgba(var(--ov),.07);color:var(--au-text3)}
.fu-rem.on .fu-rem-ico{background:rgba(37,211,102,.16);color:var(--au-green-text)}
.fu-rem-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.fu-rem-t b{font-size:13px;font-weight:600;color:var(--au-text)}
.fu-rem-t small{font-size:11.5px;color:var(--au-text3);line-height:1.35}
.fu-bell{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:var(--au-text2);cursor:pointer;user-select:none}
.fu-sw{position:relative;width:38px;height:22px;border-radius:999px;background:rgba(var(--ov),.18);transition:background .15s;flex-shrink:0}
.fu-sw::after{content:"";position:absolute;top:2px;inset-inline-start:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:inset-inline-start .15s}
.fu-rem input,.fu-bell input{position:absolute;opacity:0;width:1px;height:1px}
.fu-rem input:checked+.fu-sw,.fu-bell input:checked+.fu-sw{background:#25D366}
.fu-rem input:checked+.fu-sw::after,.fu-bell input:checked+.fu-sw::after{inset-inline-start:18px}
.fu-rem input:focus-visible+.fu-sw,.fu-bell input:focus-visible+.fu-sw{outline:2px solid var(--au-brand);outline-offset:2px}
.fu-save{min-height:0;height:44px;width:100%;padding:0 16px;border-radius:12px;border:none;background:var(--au-brand);color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 1px 2px rgba(0,0,0,.08),0 4px 12px rgba(var(--brand-rgb),.25);transition:filter .12s,transform .06s}
.fu-save:hover:not(:disabled){filter:brightness(1.07)}
.fu-save:active:not(:disabled){transform:translateY(1px)}
.fu-save:disabled{opacity:.45;cursor:default;box-shadow:none}
.fu-save .at{font-weight:500;opacity:.85}
.fu-list{display:flex;flex-direction:column;gap:8px}
.fu-list-h{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--au-text2)}
.fu-list-h .n{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:rgba(var(--brand-rgb),.12);color:var(--au-brand-text);font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}
.fu-list-h::after{content:"";flex:1;height:1px;background:var(--au-s3-line)}
.fu-item{position:relative;display:flex;align-items:center;gap:11px;padding:10px 10px 10px 12px;border-radius:14px;background:var(--au-s3);border:1px solid var(--au-s3-line);transition:border-color .12s,box-shadow .12s}
[dir=rtl] .fu-item{padding:10px 12px 10px 10px}
.fu-item:hover{border-color:rgba(var(--brand-rgb),.35);box-shadow:0 2px 10px rgba(0,0,0,.05)}
.fu-item.over{border-color:rgba(224,82,82,.4);background:rgba(224,82,82,.05)}
.fu-item.done{opacity:.7}
.fu-date{flex:none;width:44px;border-radius:10px;overflow:hidden;text-align:center;background:var(--au-card-solid,var(--au-pop));border:1px solid var(--au-s3-line);line-height:1}
.fu-date i{display:block;font-style:normal;font-size:10px;font-weight:700;padding:3px 0;background:rgba(var(--brand-rgb),.14);color:var(--au-brand-text)}
.fu-date b{display:block;font-size:17px;font-weight:700;color:var(--au-text);padding:4px 0 1px;font-feature-settings:'tnum'}
.fu-date small{display:block;font-size:9.5px;color:var(--au-text3);padding-bottom:4px}
.fu-item.over .fu-date i{background:rgba(224,82,82,.16);color:var(--au-red-text)}
.fu-item.done .fu-date i{background:rgba(34,197,94,.16);color:var(--au-green-text)}
.fu-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.fu-t b{font-size:13.5px;font-weight:600;color:var(--au-text);overflow-wrap:anywhere;line-height:1.35}
.fu-meta{font-size:11.5px;color:var(--au-text3);display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.fu-when{font-weight:700;color:var(--au-text2);font-feature-settings:'tnum'}
.fu-rel{font-weight:600;color:var(--au-brand-text)}
.fu-item.over .fu-rel{color:var(--au-red-text)}
.fu-item.done .fu-rel{color:var(--au-green-text)}
.fu-dot{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.5}
.fu-tag{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;background:rgba(37,211,102,.12);color:var(--au-green-text)}
.fu-tag svg{width:11px;height:11px}
.fu-tag.off{background:rgba(var(--ov),.07);color:var(--au-text3)}
.fu-acts{display:flex;flex-direction:column;align-items:center;gap:2px;flex:none;align-self:stretch;justify-content:center}
.fu-ib{min-height:0;min-width:0;width:34px;height:34px;padding:0;border-radius:50%;border:none;background:transparent;color:var(--au-text3);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background .12s,color .12s}
.fu-ib:hover{background:rgba(var(--ov),.08);color:var(--au-text)}
.fu-ib:focus-visible{outline:2px solid var(--au-brand);outline-offset:1px}
.fu-ib.ok{border:1.5px solid var(--au-s3-line);color:var(--au-text3)}
.fu-ib.ok:hover{border-color:#22C55E;color:#16A34A;background:rgba(34,197,94,.1)}
.fu-ib.ok[aria-checked="true"]{background:#22C55E;border-color:#22C55E;color:#fff}
.fu-ib.del{opacity:0;width:30px;height:28px}
.fu-item:hover .fu-ib.del,.fu-ib.del:focus-visible{opacity:1}
.fu-ib.del:hover{color:var(--au-red-text);background:rgba(224,82,82,.1)}
@media (hover:none){.fu-ib.del{opacity:.75}}
.fu-err{font-size:12px;color:var(--au-red-text)}
.fu-open{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(var(--brand-rgb),.45);background:rgba(var(--brand-rgb),.08);color:var(--au-brand-text);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.fu-open:hover{background:rgba(var(--brand-rgb),.16)}
.fu-open .n{min-width:18px;height:18px;border-radius:9px;background:var(--au-brand);color:#fff;font-size:10.5px;display:inline-flex;align-items:center;justify-content:center;padding:0 5px}
.fu-open.over{border-color:rgba(224,82,82,.5);background:rgba(224,82,82,.1);color:var(--au-red-text)}
.fu-open.over .n{background:#E05252}
@media (max-width:640px){.fu-open.sm .lbl{display:none}.fu-open.sm{padding:0 9px}}
`
let cssIn = false
export const ensureFuCss = () => useCss()
const useCss = () => { if (!cssIn && typeof document !== 'undefined') { cssIn = true; const el = document.createElement('style'); el.id = 'fu-css'; el.textContent = FU_CSS; document.head.appendChild(el) } }

const BellIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>

const ClockIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
const TaskIcon = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>
const CheckIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>
// the quick "when" picks shown as chips (the calendar under them has every one, plus any date and time)
const CHIP_IDS = ['1h', 'today17', 'tom9', 'tom14', '2d', '1w']

/** Write a follow-up: what, when (quick picks + calendar + time), WhatsApp reminder on / off → onSave(patch, task) */
export function FollowUpComposer({ lead, lang = 'he', onSave, onDone, autoFocus = false, saveLabel }) {
  useCss()
  const [text, setText] = useState('')
  const presets = followUpPresets(Date.now(), lang)
  // "when" starts on tomorrow 9:00, so a typed task can be saved at once (the button used to stay grey until a time was
  // picked, with no hint why); a ready-made task brings its own time until the office picks one by hand
  const defDue = () => presets.find(p => p.id === 'tom9')?.at || ''
  const [due, setDueRaw] = useState(defDue)
  const [dueSet, setDueSet] = useState(false)
  const setDue = v => { setDueRaw(v); setDueSet(true) }
  const [remind, setRemind] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    if (!due || busy) return
    const r = addFollowUp(lead, { text, due, remind })
    if (!r) return
    setBusy(true); setErr('')
    try {
      const res = await onSave(r.patch, r.task)
      if (res === false) throw new Error('save')
      rememberTaskText(text)
      setText(''); setDueRaw(defDue()); setDueSet(false)
      onDone?.(r.task)
    } catch { setErr(L(lang, 'השמירה נכשלה, נסו שוב', 'Could not save, try again')) }
    setBusy(false)
  }
  const parts = dueParts(due, lang)
  const chips = presets.filter(p => CHIP_IDS.includes(p.id))
  const sameMinute = (x, y) => Math.abs(Date.parse(x) - Date.parse(y)) < 60e3
  return (
    <div className="fu" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <div className="fu-field">
        <span className="fu-lbl"><TaskIcon/>{L(lang, 'מה לעשות', 'What to do')}</span>
        <TaskPresetInput value={text} onChange={setText} autoFocus={autoFocus} lang={lang} kind="followup" placeholder={defaultFollowUpText(lead, lang)}
          ariaLabel={L(lang, 'מה לעשות', 'What to do')} onEnter={save} onPick={(p, d) => { if (!dueSet && d) setDueRaw(d) }} inputStyle={{ height: 42 }}/>
      </div>
      <div className="fu-field">
        <span className="fu-lbl"><ClockIcon/>{L(lang, 'מתי לחזור אליהם', 'When to get back')}</span>
        <div className="fu-when-box">
          <div className="fu-chips" role="group" aria-label={L(lang, 'בחירה מהירה', 'Quick picks')}>
            {chips.map(p => <button key={p.id} type="button" className="fu-chip" aria-pressed={!!due && sameMinute(due, p.at)} onClick={() => setDue(p.at)}>{p.label}</button>)}
          </div>
          <DateTimePicker value={due} onChange={setDue} format="iso" lang={lang} presets={presets} min={new Date().toISOString().slice(0, 10)}
            placeholder={L(lang, 'תאריך ושעה אחרים', 'Another date and time')} label={L(lang, 'מתי', 'When')} clearable={false} style={{ width: '100%' }}/>
          {parts && <div className="fu-sum" aria-live="polite"><span><b>{parts.full}</b>, <span style={{ whiteSpace: 'nowrap', fontFeatureSettings: '"tnum"' }}>{parts.time}</span></span><span className="rel">{dueFromNow(due, Date.now(), lang)}</span></div>}
        </div>
      </div>
      <label className={`fu-rem${remind ? ' on' : ''}`}>
        <span className="fu-rem-ico"><BellIcon/></span>
        <span className="fu-rem-t">
          <b>{L(lang, 'תזכורת בוואטסאפ', 'WhatsApp reminder')}</b>
          <small>{remind ? L(lang, 'הודעה למספר המשרד כשמגיע הזמן', 'A message to the office number when it is due') : L(lang, 'בלי הודעה, רק ברשימת הפולו אפים', 'No message, only in the follow-ups list')}</small>
        </span>
        <input type="checkbox" checked={remind} onChange={e => setRemind(e.target.checked)}/>
        <span className="fu-sw" aria-hidden="true"/>
      </label>
      <button type="button" className="fu-save" disabled={!due || busy} onClick={save}>
        {busy ? L(lang, 'שומר…', 'Saving…') : <>{saveLabel || L(lang, 'קביעת פולו אפ', 'Set follow-up')}{due && <span className="at">· {describeDue(due, { lang })}</span>}</>}
      </button>
      {err && <div role="alert" className="fu-err">{err}</div>}
    </div>
  )
}

/** The open follow-ups of a lead: done / delete, when, reminder state */
export function FollowUpList({ lead, lang = 'he', onSave, showDone = false }) {
  useCss()
  const tasks = Array.isArray(lead?.tasks) ? lead.tasks : []
  const list = (showDone ? tasks.filter(t => t.kind === 'followup' && dueIso(t.due)) : openFollowUps(tasks))
    .slice().sort((a, b) => Date.parse(dueIso(a.due)) - Date.parse(dueIso(b.due)))
  if (!list.length) return null
  const now = Date.now()
  const set = next => onSave(updateTasks(lead, next))
  return (
    <div className="fu-list" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <div className="fu-list-h">{L(lang, 'פולו אפים פתוחים', 'Open follow-ups')}<span className="n">{list.filter(t => !t.done).length}</span></div>
      {list.map(t => {
        const at = Date.parse(dueIso(t.due)), over = !t.done && at < now - 10 * 60e3, p = dueParts(t.due, lang)
        return (
          <div key={t.id} className={`fu-item${over ? ' over' : ''}${t.done ? ' done' : ''}`}>
            {p && <span className="fu-date" aria-hidden="true"><i>{p.wd}</i><b>{p.day}</b><small>{p.mon}</small></span>}
            <span className="fu-t">
              <b style={t.done ? { textDecoration: 'line-through', color: 'var(--au-text3)' } : undefined}>{t.text}</b>
              <span className="fu-meta">
                <span className="fu-when">{describeDue(t.due, { lang })}</span>
                <span className="fu-dot" aria-hidden="true"/>
                <span className="fu-rel">{t.done ? L(lang, 'בוצע', 'Done') : dueFromNow(t.due, now, lang)}</span>
                {t.remind
                  ? <span className="fu-tag"><BellIcon/>{t.remindedAt ? L(lang, 'התזכורת נשלחה', 'Reminder sent') : L(lang, 'תזכורת בוואטסאפ', 'WhatsApp reminder')}</span>
                  : <span className="fu-tag off">{L(lang, 'בלי תזכורת', 'No reminder')}</span>}
              </span>
            </span>
            <span className="fu-acts">
              <button type="button" className="fu-ib ok" role="checkbox" aria-checked={!!t.done} aria-label={t.done ? L(lang, 'לסמן כלא בוצע', 'Mark as not done') : L(lang, 'סימון כבוצע', 'Mark as done')} title={t.done ? L(lang, 'לסמן כלא בוצע', 'Mark as not done') : L(lang, 'סימון כבוצע', 'Mark as done')}
                onClick={() => set(tasks.map(x => (x.id === t.id ? { ...x, done: !x.done, doneAt: !x.done ? Date.now() : null } : x)))}><CheckIcon/></button>
              <button type="button" className="fu-ib del" aria-label={L(lang, 'מחיקה', 'Delete')} title={L(lang, 'מחיקה', 'Delete')} onClick={() => set(tasks.filter(x => x.id !== t.id))}><TrashIcon/></button>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** A compact button ("⏰ פולו אפ" + the count of open ones) that opens the composer and the list in a popover */
export function FollowUpButton({ lead, lang = 'he', onSave, size }) {
  useCss()
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const open1 = openFollowUps(lead?.tasks)
  const over = open1.some(t => Date.parse(dueIso(t.due)) < Date.now())
  const next = open1.map(t => dueIso(t.due)).sort()[0]
  return (
    <>
      <button type="button" ref={ref} className={`fu-open${over ? ' over' : ''}${size === 'sm' ? ' sm' : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={next ? `${L(lang, "פולו אפ", "Follow-up")}: ${describeDue(next, { lang })}` : L(lang, "פולו אפ", "Follow-up")}
        title={next ? `${L(lang, 'הפולו אפ הבא', 'Next follow-up')}: ${describeDue(next, { lang })}` : L(lang, 'קביעת פולו אפ עם תזכורת', 'Set a follow-up with a reminder')}
        style={size === 'sm' ? { height: 28, fontSize: 12 } : undefined}>
        <BellIcon/><span className="lbl">{next ? describeDue(next, { lang }) : L(lang, 'פולו אפ', 'Follow-up')}</span>
        {open1.length > 1 && <span className="n">{open1.length}</span>}
      </button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} width={420} maxHeight={520} dir={lang === 'en' ? 'ltr' : 'rtl'} label={L(lang, 'פולו אפ', 'Follow-up')}>
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{L(lang, `פולו אפ ל${lead?.name || 'ליד'}`, `Follow-up with ${lead?.name || 'the lead'}`)}</div>
          <FollowUpComposer lead={lead} lang={lang} onSave={onSave} autoFocus/>
          <FollowUpList lead={lead} lang={lang} onSave={onSave}/>
        </div>
      </Popover>
    </>
  )
}

/** "📝 הערות (n)": the lead's notes (the same list as the lead card) + adding one, in a popover — for the chats tab */
export function NotesButton({ lead, lang = 'he', onSave, size }) {
  useCss()
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [state, setState] = useState('')
  const taRef = useRef(null)
  const notes = leadNotes(lead)
  const add = async () => {
    const r = addNote(lead, null, text, { by: 'chat' })
    if (!r) return
    setState('saving')
    const ok = await Promise.resolve(onSave(r.patch)).then(x => x !== false && x !== null && x?.ok !== false, () => false)
    setState(ok ? 'saved' : 'failed')
    if (ok) setText('')
  }
  return (
    <>
      <button type="button" ref={ref} className={`fu-open${size === 'sm' ? ' sm' : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={L(lang, 'הערות', 'Notes')} style={size === 'sm' ? { height: 28, fontSize: 12 } : undefined}
        title={notes[0] ? notes[0].text.slice(0, 120) : L(lang, 'הערות על הליד', 'Notes on the lead')}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v12H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>
        <span className="lbl">{L(lang, 'הערות', 'Notes')}</span>{notes.length > 0 && <span className="n">{notes.length}</span>}
      </button>
      <Popover anchor={ref} open={open} onClose={() => { setOpen(false); setState('') }} width={400} maxHeight={520} dir={lang === 'en' ? 'ltr' : 'rtl'} label={L(lang, 'הערות', 'Notes')}>
        <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{L(lang, `הערות על ${lead?.name || 'הליד'}`, `Notes on ${lead?.name || 'the lead'}`)}</div>
          <textarea ref={taRef} className="fu-in" style={{ height: 'auto', minHeight: 72, padding: '8px 12px', resize: 'vertical', lineHeight: 1.5 }} rows={3} value={text} autoFocus
            onChange={e => { setText(e.target.value); setState('') }} placeholder={L(lang, 'מה עלה בשיחה, מה הצעד הבא… (Ctrl+Enter לשמירה)', 'What came up, the next step… (Ctrl+Enter saves)')}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add() } }} aria-label={L(lang, 'הערה חדשה', 'New note')}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SmartVoiceInput value={text} onChange={v => { setText(v); setState('') }} contextType="note" recordId={lead?.id} lang={lang} inputRef={taRef} hint={[lead?.name, lead?.campaignName].filter(Boolean).join(', ')}
              onCreateTasks={items => Promise.resolve(onSave(updateTasks(lead, [...(Array.isArray(lead?.tasks) ? lead.tasks : []), ...items]))).then(x => x !== false)}/>
            <button type="button" className="fu-save" style={{ height: 34 }} disabled={!text.trim() || state === 'saving'} onClick={add}>{state === 'saving' ? '…' : L(lang, 'הוספת הערה', 'Add note')}</button>
            {state === 'saved' && <span role="status" style={{ fontSize: 12, color: 'var(--au-green-text)' }}>✓ {L(lang, 'נשמר בכל המסכים', 'Saved everywhere')}</span>}
            {state === 'failed' && <span role="alert" style={{ fontSize: 12, color: 'var(--au-red-text)' }}>{L(lang, 'השמירה נכשלה', 'Could not save')}</span>}
          </div>
          {!notes.length && <div style={{ fontSize: 12.5, color: 'var(--au-text3)' }}>{L(lang, 'עדיין אין הערות.', 'No notes yet.')}</div>}
          {notes.slice(0, 12).map(n => (
            <div key={n.id} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(var(--ov),.05)' }}>
              <div style={{ fontSize: 11, color: 'var(--au-text3)' }}>{n.ts ? new Date(n.ts).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</div>
              <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.text}</div>
            </div>
          ))}
        </div>
      </Popover>
    </>
  )
}
