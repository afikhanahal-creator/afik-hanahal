// The chats tab's header tools for the open chat's CRM lead: the pipeline stage (the same change as dragging on the board —
// AdminPanel's updateLeadStatus: stage log, nurture follow-up, stage automations) and "סיכום AI": Claude reads the chat
// (POST /api/meta/chat-summary → lib/chat-summary.js), the summary is saved on the lead by itself as a note (crm_data.notes,
// kind 'wa') + crm_data.chatSummary, and the suggested stage / follow-up are one click away.
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { PIPELINE, stageLabel, summaryNote } from './lib/pipelineStages.js'
import { addNote } from './lib/leadNotes.js'
import { addFollowUp } from '../lib/follow-up.js'
import { toggleProjectInName } from './lib/leadFields.js'

const H = { 'Content-Type': 'application/json', Authorization: 'Bearer AFIKhanahal2026' }
const TXT = {
  he: { stage: 'שלב', ai: 'סיכום AI', aiTip: 'Claude קורא את השיחה, שומר סיכום כהערה על הליד ומציע שלב ופולו אפ', busy: 'מסכם…', saved: 'הסיכום נשמר כהערה',
    move: s => `להעביר ל"${s}"`, fu: d => d === 0 ? 'פולו אפ היום' : d === 1 ? 'פולו אפ מחר' : `פולו אפ בעוד ${d} ימים`, why: 'למה', close: 'סגירה', done: 'בוצע',
    errs: { empty: 'אין עדיין שיחה לסכם.', no_key: 'לא הוגדר מפתח Claude ב-Vercel.', auth: 'מפתח Claude לא תקין, או שנגמר הקרדיט בחשבון Anthropic.', rate: 'יותר מדי בקשות כרגע, נסו שוב בעוד דקה.', other: 'הסיכום נכשל' } },
  en: { stage: 'Stage', ai: 'AI summary', aiTip: 'Claude reads the chat, saves a summary as a note on the lead and suggests a stage and a follow-up', busy: 'Summarizing…', saved: 'Saved as a note',
    move: s => `Move to "${s}"`, fu: d => d === 0 ? 'Follow up today' : d === 1 ? 'Follow up tomorrow' : `Follow up in ${d} days`, why: 'Why', close: 'Close', done: 'Done',
    errs: { empty: 'There is no conversation to summarize yet.', no_key: 'The Claude key is not set in Vercel.', auth: 'The Claude key is invalid, or the Anthropic account is out of credit.', rate: 'Too many requests right now, try again in a minute.', other: 'The summary failed' } },
}

function usePop(open, anchor, w) {
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    if (!open || !anchor.current) return
    const place = () => { const r = anchor.current.getBoundingClientRect(); const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)); setPos({ top: r.bottom + 6, left }) }
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, anchor, w])
  return pos
}
function useOutside(open, refs, close) {
  useEffect(() => {
    if (!open) return
    const down = e => { if (!refs.some(r => r.current?.contains(e.target))) close() }
    const key = e => { if (e.key === 'Escape') { e.preventDefault(); close() } }
    document.addEventListener('pointerdown', down, true); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
}

const pill = (WA, extra = {}) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${WA.border}`, background: WA.inputBg, color: WA.bodyText, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, minHeight: 0, ...extra })
const panel = WA => ({ position: 'fixed', zIndex: 3000, background: WA.modalBg || WA.panelBg || 'var(--au-pop)', color: WA.bodyText, border: `1px solid ${WA.border}`, borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,.25)', padding: 6 })

export function StageMenu({ lead, lang = 'he', stageLabels = {}, onChange, WA }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const [open, setOpen] = useState(false)
  const btn = useRef(null), pop = useRef(null)
  const pos = usePop(open, btn, 240)
  useOutside(open, [btn, pop], () => setOpen(false))
  const cur = PIPELINE.find(p => p.id === (lead.leadStatus || 'new')) || PIPELINE[0]
  return (<>
    <button ref={btn} type="button" aria-haspopup="listbox" aria-expanded={open} title={t.stage} onClick={() => setOpen(o => !o)} style={pill(WA, { borderColor: `${cur.color}88` })}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: cur.color }}/>{stageLabel(cur, lang, stageLabels)}<span aria-hidden="true" style={{ fontSize: 9, opacity: .6 }}>▼</span>
    </button>
    {open && pos && createPortal(
      <div ref={pop} role="listbox" aria-label={t.stage} dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ ...panel(WA), top: pos.top, left: pos.left, width: 240 }}>
        {PIPELINE.map(st => { const on = st.id === cur.id; return (
          <button key={st.id} type="button" role="option" aria-selected={on} onClick={() => { setOpen(false); if (!on) onChange(st.id) }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', border: 'none', borderRadius: 8, background: on ? `${st.color}1f` : 'transparent', color: 'inherit', fontFamily: 'inherit', fontSize: 13, fontWeight: on ? 800 : 600, cursor: 'pointer', textAlign: 'start', minHeight: 0 }}>
            <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: st.color, flexShrink: 0 }}/>{stageLabel(st, lang, stageLabels)}{on && <span style={{ marginInlineStart: 'auto' }}>✓</span>}
          </button>
        ) })}
      </div>, document.body)}
  </>)
}

export function AiNoteButton({ lead, lang = 'he', stageLabels = {}, onUpdateLead, onStage, WA }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)        // { sum } | { err }
  const btn = useRef(null), pop = useRef(null)
  const pos = usePop(!!res, btn, 360)
  useOutside(!!res, [btn, pop], () => setRes(null))
  useEffect(() => { setRes(null) }, [lead.id])
  const run = async () => {
    setBusy(true); setRes(null)
    try {
      const { enrichment: _e, ...clean } = lead
      const r = await fetch('/api/meta/chat-summary', { method: 'POST', headers: H, body: JSON.stringify({ lead: clean }), signal: AbortSignal.timeout(70000) })
      const d = await r.json().catch(() => ({}))
      if (!d.ok) { setRes({ err: t.errs[d.code] || `${t.errs.other}${d.error ? `: ${d.error}` : ''}` }); return }
      const n = addNote(lead, null, summaryNote(d.summary, lang), { kind: 'wa' })
      await onUpdateLead(lead.id, { ...(n?.patch || {}), chatSummary: d.summary })
      setRes({ sum: d.summary })
    } catch (e) { setRes({ err: `${t.errs.other}: ${e.name === 'TimeoutError' ? 'timeout' : e.message}` }) }
    finally { setBusy(false) }
  }
  const sum = res?.sum
  const sug = sum?.suggestedStage && sum.suggestedStage !== (lead.leadStatus || 'new') ? PIPELINE.find(p => p.id === sum.suggestedStage) : null
  const [did, setDid] = useState({})
  useEffect(() => { setDid({}) }, [res])
  return (<>
    <button ref={btn} type="button" title={t.aiTip} disabled={busy} onClick={run} style={pill(WA, { opacity: busy ? .6 : 1 })}>
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Zm6 11l.9 2.6L21.5 16l-2.6.9L18 19.5l-.9-2.6L14.5 16l2.6-.9L18 13ZM6 14l.7 1.8L8.5 16.5l-1.8.7L6 19l-.7-1.8L3.5 16.5l1.8-.7L6 14Z"/></svg>
      {busy ? t.busy : t.ai}
    </button>
    {res && pos && createPortal(
      <div ref={pop} role="dialog" aria-label={t.ai} dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ ...panel(WA), top: pos.top, left: pos.left, width: 360, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, lineHeight: 1.6 }}>
        {res.err ? <div role="alert" style={{ color: '#E05252', fontWeight: 600 }}>{res.err}</div> : <>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#128C4A' }}>✓ {t.saved}</div>
          <div>{sum.summary}</div>
          {sum.nextStep && <div style={{ fontWeight: 700 }}>→ {sum.nextStep}</div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sug && <button type="button" disabled={did.stage} onClick={() => { onStage(sug.id); setDid(x => ({ ...x, stage: true })) }} title={sum.stageReason ? `${t.why}: ${sum.stageReason}` : undefined}
              style={pill(WA, { borderColor: `${sug.color}aa`, opacity: did.stage ? .55 : 1 })}><span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: sug.color }}/>{did.stage ? `${t.done} ✓` : t.move(stageLabel(sug, lang, stageLabels))}</button>}
            {sum.followUpDays >= 0 && <button type="button" disabled={did.fu} onClick={() => {
              const d = new Date(); d.setDate(d.getDate() + sum.followUpDays); d.setHours(10, 0, 0, 0)
              const p = addFollowUp(lead, { due: d.toISOString(), text: sum.nextStep || '', remind: true })
              if (p) onUpdateLead(lead.id, p.patch)
              setDid(x => ({ ...x, fu: true }))
            }} style={pill(WA, { opacity: did.fu ? .55 : 1 })}>{did.fu ? `${t.done} ✓` : t.fu(sum.followUpDays)}</button>}
          </div>
        </>}
        <button type="button" onClick={() => setRes(null)} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: 'inherit', opacity: .7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, minHeight: 0 }}>{t.close}</button>
      </div>, document.body)}
  </>)
}

// The chat header's name, editable like the Lead Center's: a click opens a box with "+ הוספת הפרויקט: <project>" (or "הסרת
// שם הפרויקט"); Enter saves, Esc cancels. A lead's rename goes through the admin's updateLead (PATCH /api/contacts: the CRM,
// the Lead Center and the office phone's WhatsApp contacts — lib/wa-book.js); a chat that isn't a lead saves the name in the
// phone's contacts only (POST /api/meta/chat-contact-name). A name changed in the phone's WhatsApp comes back by itself
// (auto-tick / auto-run → syncBookNames).
const NT = {
  he: { edit: 'שינוי שם (מתעדכן גם באנשי הקשר של הוואטסאפ בטלפון)', save: 'שמירה', cancel: 'ביטול', add: p => `+ הוספת הפרויקט: ${p}`, remove: 'הסרת שם הפרויקט', saving: 'שומר…', saved: 'נשמר גם בוואטסאפ ✓', savedLead: 'נשמר ✓', err: 'השמירה נכשלה' },
  en: { edit: "Rename (the office phone's WhatsApp contacts follow)", save: 'Save', cancel: 'Cancel', add: p => `+ Add the project: ${p}`, remove: 'Remove the project', saving: 'Saving…', saved: 'Saved in WhatsApp too ✓', savedLead: 'Saved ✓', err: 'Saving failed' },
}
export function ChatNameEdit({ name = '', project = '', lead = null, phone, lang = 'he', WA, onUpdateLead, onRename, onSaved, savedText = '', children }) {
  const t = NT[lang === 'en' ? 'en' : 'he']
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState(name)
  const [st, setSt] = useState(null)          // null | 'saving' | { ok, msg }
  const inp = useRef(null), anchor = useRef(null), pop = useRef(null)
  const pos = usePop(edit, anchor, 360)
  useOutside(edit, [anchor, pop], () => setEdit(false))
  useEffect(() => { setEdit(false); setSt(null) }, [phone])
  useEffect(() => { if (edit) setTimeout(() => { inp.current?.focus(); inp.current?.select() }, 20) }, [edit])
  useEffect(() => { if (st && st !== 'saving' && st.ok) { const x = setTimeout(() => setSt(null), 2600); return () => clearTimeout(x) } }, [st])
  const p = String(project || '').trim()
  const tg = toggleProjectInName(val, p)
  const save = async () => {
    const next = val.replace(/\s+/g, ' ').trim()
    if (!next || next === name) { setEdit(false); return }
    setSt('saving')
    try {
      if (onRename) { await onRename(next); setSt({ ok: true, msg: savedText || t.saved }) }
      else if (lead?.id && onUpdateLead) { await onUpdateLead(lead.id, { name: next }); setSt({ ok: true, msg: t.saved }) }
      else {
        const r = await fetch('/api/meta/chat-contact-name', { method: 'POST', headers: H, body: JSON.stringify({ phone, name: next }), signal: AbortSignal.timeout(20000) })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
        setSt({ ok: true, msg: t.saved })
      }
      onSaved?.(next); setEdit(false)
    } catch (e) { setSt({ ok: false, msg: `${t.err}: ${e.message}` }) }
  }
  return (<>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <button ref={anchor} type="button" onClick={() => { setVal(name); setSt(null); setEdit(e => !e) }} title={t.edit} aria-label={t.edit} aria-expanded={edit} className="wa-name-btn"
        style={{ border: 'none', background: 'transparent', padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'text', minHeight: 0, minWidth: 0, textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {children || name}
      </button>
      {!edit && st && st !== 'saving' && <span role="status" style={{ fontSize: 11.5, fontWeight: 600, color: st.ok ? '#128C4A' : '#E5484D', whiteSpace: 'nowrap' }}>{st.msg}</span>}
    </div>
    {edit && pos && createPortal(
      <div ref={pop} role="dialog" aria-label={t.edit} dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ ...panel(WA), top: pos.top, left: pos.left, width: 360, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: WA.subText }}>{t.edit}</div>
        <input ref={inp} value={val} onChange={e => setVal(e.target.value)} maxLength={80} aria-label={t.edit} dir="auto"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEdit(false) } }}
          style={{ width: '100%', boxSizing: 'border-box', height: 38, borderRadius: 9, border: `1px solid ${WA.green}`, background: WA.inputFieldBg || WA.panelBg, color: WA.bodyText, padding: '0 11px', font: 'inherit', fontSize: 15, fontWeight: 600, outline: 'none' }}/>
        {p && <button type="button" onClick={() => setVal(tg.next)} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: WA.green, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: 0, minHeight: 0 }}>{tg.has ? t.remove : t.add(p)}</button>}
        {st && st !== 'saving' && !st.ok && <span role="alert" style={{ fontSize: 12, color: '#E5484D' }}>{st.msg}</span>}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setEdit(false)} style={pill(WA)}>{t.cancel}</button>
          <button type="button" onClick={save} disabled={st === 'saving'} style={pill(WA, { background: WA.green, color: '#fff', borderColor: WA.green })}>{st === 'saving' ? t.saving : t.save}</button>
        </div>
      </div>, document.body)}
  </>)
}
