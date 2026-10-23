// Follow-up tasks: "get back to <name> on <day> at <time>", with a WhatsApp reminder to the office when it is due
// (lib/follow-up.js; the server's remindTasks() sends it). The same pieces everywhere a lead is open: the lead card's
// tasks tab, the Lead Center, the chats tab and the call summary. Every save goes through the admin's updateLead, so the
// board, the card, the Lead Center and the chats show it at once (and other devices with the next sync).
import { useRef, useState } from 'react'
import DateTimePicker from './DateTimePicker.jsx'
import { Popover } from './automationsUI.jsx'
import { addFollowUp, followUpPresets, defaultFollowUpText, describeDue, dueIso, updateTasks, openFollowUps } from '../lib/follow-up.js'
import { leadNotes, addNote } from './lib/leadNotes.js'

const L = (lang, he, en) => (lang === 'en' ? en : he)

export const FU_CSS = `
.fu{display:flex;flex-direction:column;gap:10px}
.fu-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.fu-in{width:100%;box-sizing:border-box;min-width:0;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--au-s3-line);background:var(--au-s3);color:var(--au-text);font:inherit;font-size:13.5px;outline:none}
.fu-in:focus{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.18)}
.fu-bell{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;color:var(--au-text2);cursor:pointer;user-select:none}
.fu-sw{position:relative;width:34px;height:20px;border-radius:999px;background:rgba(var(--ov),.18);transition:background .15s;flex-shrink:0}
.fu-sw::after{content:"";position:absolute;top:2px;inset-inline-start:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:inset-inline-start .15s}
.fu-bell input{position:absolute;opacity:0;width:1px;height:1px}
.fu-bell input:checked+.fu-sw{background:#25D366}
.fu-bell input:checked+.fu-sw::after{inset-inline-start:16px}
.fu-bell input:focus-visible+.fu-sw{outline:2px solid var(--au-brand);outline-offset:2px}
.fu-save{height:38px;padding:0 16px;border-radius:10px;border:none;background:var(--au-brand);color:#fff;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.fu-save:disabled{opacity:.45;cursor:default}
.fu-list{display:flex;flex-direction:column;gap:6px}
.fu-item{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:12px;background:rgba(var(--ov),.035);border:1px solid var(--au-s3-line)}
.fu-item.over{border-color:rgba(224,82,82,.45);background:rgba(224,82,82,.06)}
.fu-chk{width:20px;height:20px;border-radius:6px;border:2px solid var(--au-s3-line);background:transparent;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;padding:0}
.fu-chk[aria-checked="true"]{background:#22C55E;border-color:#22C55E}
.fu-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.fu-t b{font-size:13.5px;font-weight:600;color:var(--au-text);overflow-wrap:anywhere}
.fu-meta{font-size:11.5px;color:var(--au-text3);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.fu-when{font-weight:700;color:var(--au-brand-text)}
.fu-item.over .fu-when{color:var(--au-red-text)}
.fu-tag{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600;background:rgba(37,211,102,.12);color:var(--au-green-text)}
.fu-tag.off{background:rgba(var(--ov),.07);color:var(--au-text3)}
.fu-del{background:none;border:none;color:var(--au-text3);cursor:pointer;padding:4px 6px;border-radius:7px;font-size:13px}
.fu-del:hover{background:rgba(var(--ov),.08);color:var(--au-text)}
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

/** Write a follow-up: what, when (quick picks + calendar + time), WhatsApp reminder on / off → onSave(patch, task) */
export function FollowUpComposer({ lead, lang = 'he', onSave, onDone, autoFocus = false, saveLabel }) {
  useCss()
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [remind, setRemind] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const presets = followUpPresets(Date.now(), lang)
  const save = async () => {
    if (!due || busy) return
    const r = addFollowUp(lead, { text, due, remind })
    if (!r) return
    setBusy(true); setErr('')
    try {
      const res = await onSave(r.patch, r.task)
      if (res === false) throw new Error('save')
      setText(''); setDue('')
      onDone?.(r.task)
    } catch { setErr(L(lang, 'השמירה נכשלה, נסו שוב', 'Could not save, try again')) }
    setBusy(false)
  }
  return (
    <div className="fu" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <input className="fu-in" value={text} autoFocus={autoFocus} onChange={e => setText(e.target.value)} placeholder={defaultFollowUpText(lead, lang)}
        aria-label={L(lang, 'מה לעשות', 'What to do')} onKeyDown={e => { if (e.key === 'Enter') save() }}/>
      <div className="fu-row">
        <DateTimePicker value={due} onChange={setDue} format="iso" lang={lang} presets={presets} min={new Date().toISOString().slice(0, 10)}
          placeholder={L(lang, 'מתי לחזור אליהם?', 'When to get back?')} label={L(lang, 'מתי', 'When')} clearable={false} style={{ flex: '1 1 210px' }}/>
        <label className="fu-bell" title={L(lang, 'הודעת וואטסאפ למספר המשרד כשמגיע הזמן', 'A WhatsApp to the office number when it is due')}>
          <input type="checkbox" checked={remind} onChange={e => setRemind(e.target.checked)}/>
          <span className="fu-sw" aria-hidden="true"/>
          <BellIcon/>{L(lang, 'תזכורת בוואטסאפ', 'WhatsApp reminder')}
        </label>
        <button type="button" className="fu-save" disabled={!due || busy} onClick={save}>{busy ? L(lang, 'שומר…', 'Saving…') : (saveLabel || L(lang, 'קביעת פולו אפ', 'Set follow-up'))}</button>
      </div>
      {err && <div role="alert" style={{ fontSize: 12, color: 'var(--au-red-text)' }}>{err}</div>}
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
    <div className="fu-list">
      {list.map(t => {
        const at = Date.parse(dueIso(t.due)), over = !t.done && at < now
        return (
          <div key={t.id} className={`fu-item${over ? ' over' : ''}`}>
            <button type="button" className="fu-chk" role="checkbox" aria-checked={!!t.done} aria-label={L(lang, 'בוצע', 'Done')}
              onClick={() => set(tasks.map(x => (x.id === t.id ? { ...x, done: !x.done, doneAt: !x.done ? Date.now() : null } : x)))}>{t.done ? '✓' : ''}</button>
            <span className="fu-t">
              <b style={t.done ? { textDecoration: 'line-through', color: 'var(--au-text3)' } : undefined}>{t.text}</b>
              <span className="fu-meta">
                <span className="fu-when">{over ? L(lang, 'באיחור · ', 'Overdue · ') : ''}{describeDue(t.due, { lang })}</span>
                {t.remind
                  ? <span className="fu-tag"><BellIcon/>{t.remindedAt ? L(lang, 'התזכורת נשלחה', 'Reminder sent') : L(lang, 'תזכורת בוואטסאפ', 'WhatsApp reminder')}</span>
                  : <span className="fu-tag off">{L(lang, 'בלי תזכורת', 'No reminder')}</span>}
              </span>
            </span>
            <button type="button" className="fu-del" aria-label={L(lang, 'מחיקה', 'Delete')} title={L(lang, 'מחיקה', 'Delete')} onClick={() => set(tasks.filter(x => x.id !== t.id))}>✕</button>
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
          <textarea className="fu-in" style={{ height: 'auto', minHeight: 72, padding: '8px 12px', resize: 'vertical', lineHeight: 1.5 }} rows={3} value={text} autoFocus
            onChange={e => { setText(e.target.value); setState('') }} placeholder={L(lang, 'מה עלה בשיחה, מה הצעד הבא… (Ctrl+Enter לשמירה)', 'What came up, the next step… (Ctrl+Enter saves)')}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add() } }} aria-label={L(lang, 'הערה חדשה', 'New note')}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
