// Bulk sends (spec §3.6): job list + 3-step wizard (message → recipients → when). Sending runs on the
// server (lib/automations.js jobs); while this tab is open it nudges the server every 5s so a send in
// progress keeps moving even between the panel's regular runs.
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { FaBullhorn, FaPlus, FaCalendarAlt, FaUsers, FaPaperPlane, FaMoon, FaCheck, FaTimes, FaSearch, FaEllipsisV, FaCopy, FaBan, FaPen, FaRedo, FaEye, FaChevronDown, FaChevronUp, FaInfoCircle, FaExclamationTriangle, FaArrowLeft, FaArrowRight } from 'react-icons/fa'
import { T, Button, IconButton, Card, Badge, FilterChip, EmptyState, Skeleton, Modal, MenuButton, MenuItem, ProgressBar, PhonePreview, ModeSwitch, Field, inputStyle, useConfirm } from './automationsUI.jsx'
import { STAGES, renderTemplate, leadLang, intlPhone, isSendWindow, nextSendWindow, CATEGORIES } from '../lib/automations-shared.js'
import { autoApi } from './AutomationsApi.jsx'

const TR = {
  he: {
    segScheduled: 'מתוזמנות', segSending: 'בשליחה', segDone: 'הסתיימו', newSend: 'שליחה חדשה', wizTitle: 'שליחה מרובה חדשה', wizEdit: 'עריכת שליחה מתוזמנת',
    emptyT: 'עוד לא יצאו שליחות מרובות', emptyB: 'שלחו תבנית אחת לקבוצת לידים – עכשיו או בזמן שתבחרו. כל הודעה מותאמת אישית בשם הליד.',
    step1: 'הודעה', step2: 'נמענים', step3: 'מתי לשלוח', stepOf: i => `שלב ${i} מתוך 3`,
    chooseTpl: 'בחרו תבנית', search: 'חיפוש תבנית', editOnce: 'ערוך נוסח לשליחה הזו בלבד', previewFor: n => `תצוגה עבור ${n}`,
    fStage: 'שלב בלוח', fJoined: 'הצטרפו ב־', fLang: 'שפה', fAny: 'הכל', fDays: n => `${n} ימים אחרונים`, fHe: 'עברית', fEn: 'אנגלית', skipGot: 'דלג על מי שכבר קיבל את התבנית', optoutLocked: 'מי שביקש להפסיק לא ייכלל',
    leadSearch: 'חיפוש לפי שם, טלפון או נכס', selectedN: n => `נבחרו ${n} לידים`, excluded: (n, a, b) => `${n} לא ייכללו: ${a} ביקשו להפסיק · ${b} בלי טלפון תקין`, filters: k => `סינון (${k})`, selectAll: 'בחר הכל', clear: 'נקה', optedOut: 'ביקש להפסיק', noPhone: 'אין טלפון', gotIt: 'כבר קיבל',
    whenNow: 'שלח עכשיו', whenNowSub: 'ההודעות יוצאות מיד, בהדרגה', whenSched: 'תזמן לשליחה', whenSchedSub: 'בחרו תאריך ושעה', date: 'תאריך', time: 'שעה',
    qHour: 'בעוד שעה', qTomorrow: 'מחר ב-10:00', qSunday: 'יום א׳ ב-10:00', inHoursOnly: 'רק בתוך שעות השליחה', outsideWarn: w => `השעה שבחרת מחוץ לשעות השליחה. השליחה תתחיל ${w}.`,
    pacing: 'ההודעות יוצאות בהדרגה כדי שוואטסאפ לא יחסום את המספר.', precision: 'בלי פינג חיצוני, שליחה מתוזמנת עלולה לחכות עד שמישהו יפתח את הפאנל.', setupPrecise: 'הגדר תזמון מדויק',
    optoutNote: 'מי שיבקש להפסיק עד מועד השליחה יוסר אוטומטית.', next: 'הבא', nextN: n => `הבא (${n})`, back: 'חזרה',
    ctaNow: n => `שלח עכשיו ל-${n} לידים`, ctaSched: (n, w) => `תזמן ל-${n} לידים · ${w}`, ctaUpdate: 'עדכון השליחה',
    confirmNow: n => `לשלוח עכשיו ${n} הודעות וואטסאפ?`, confirmBtn: 'שלח', cancel: 'ביטול', scheduledToast: w => `השליחה תוזמנה ל${w}`, startedToast: n => `השליחה ל-${n} לידים התחילה`, updated: 'השליחה עודכנה', pastTime: 'בחרו זמן עתידי',
    stScheduled: 'מתוזמנת', stSending: 'בשליחה', stPaused: t => `מושהית עד ${t}`, stDone: 'הסתיימה', stDoneErr: 'הסתיימה עם שגיאות', stCancelled: 'בוטלה', stFailed: 'נכשלה',
    progress: (a, n) => `נשלחו ${a} מתוך ${n}`, failedN: f => `${f} נכשלו`, removedN: n => `${n} הוסרו כי ביקשו להפסיק`, recipients: n => `${n} נמענים`,
    aEdit: 'ערוך', aCancel: 'בטל שליחה', aStop: 'עצור', aDup: 'שכפל', aView: 'צפה בנמענים', aRetry: 'נסה שוב לנכשלות', more: 'אפשרויות',
    cancelT: 'לבטל את השליחה המתוזמנת?', cancelB: n => `${n} לידים לא יקבלו את ההודעה.`, keep: 'השאר', stopT: 'לעצור את השליחה?', stopB: (a, b) => `${a} כבר נשלחו. ${b} הנותרים לא יקבלו את ההודעה.`,
    leaveT: 'לצאת בלי לשמור?', leaveB: 'השליחה לא תישמר.', keepEditing: 'המשך לערוך', leave: 'צא', today: 'היום', tomorrow: 'מחר', at: 'ב-', error: 'שגיאה',
    rSent: 'נשלח', rFailed: 'נכשל', rSkipped: 'דולג', rPending: 'ממתין', summary: (n, tp) => `${n} נמענים · ${tp}`, heTab: 'עברית', enTab: 'English',
  },
  en: {
    segScheduled: 'Scheduled', segSending: 'Sending', segDone: 'Finished', newSend: 'New bulk send', wizTitle: 'New bulk send', wizEdit: 'Edit scheduled send',
    emptyT: 'No bulk sends yet', emptyB: "Send one template to a group of leads – now or at a time you choose. Every message is personalised with the lead's name.",
    step1: 'Message', step2: 'Recipients', step3: 'When', stepOf: i => `Step ${i} of 3`,
    chooseTpl: 'Choose a template', search: 'Search templates', editOnce: 'Edit the text for this send only', previewFor: n => `Preview for ${n}`,
    fStage: 'Board stage', fJoined: 'Joined in', fLang: 'Language', fAny: 'Any', fDays: n => `Last ${n} days`, fHe: 'Hebrew', fEn: 'English', skipGot: 'Skip leads who already got this template', optoutLocked: 'Leads who opted out are always excluded',
    leadSearch: 'Search by name, phone or property', selectedN: n => `${n} leads selected`, excluded: (n, a, b) => `${n} excluded: ${a} opted out · ${b} no valid phone`, filters: k => `Filters (${k})`, selectAll: 'Select all', clear: 'Clear', optedOut: 'Opted out', noPhone: 'No phone', gotIt: 'Already got it',
    whenNow: 'Send now', whenNowSub: 'Messages go out right away, gradually', whenSched: 'Schedule', whenSchedSub: 'Pick a date and time', date: 'Date', time: 'Time',
    qHour: 'In an hour', qTomorrow: 'Tomorrow 10:00', qSunday: 'Sunday 10:00', inHoursOnly: 'Only within sending hours', outsideWarn: w => `That time is outside sending hours. Sending will start ${w}.`,
    pacing: "Messages go out gradually so WhatsApp doesn't block the number.", precision: 'Without an external ping, a scheduled send may wait until someone opens the panel.', setupPrecise: 'Set up precise timing',
    optoutNote: 'Anyone who opts out before then is removed automatically.', next: 'Next', nextN: n => `Next (${n})`, back: 'Back',
    ctaNow: n => `Send to ${n} leads now`, ctaSched: (n, w) => `Schedule for ${n} leads · ${w}`, ctaUpdate: 'Update send',
    confirmNow: n => `Send ${n} WhatsApp messages now?`, confirmBtn: 'Send', cancel: 'Cancel', scheduledToast: w => `Scheduled for ${w}`, startedToast: n => `Sending to ${n} leads has started`, updated: 'Send updated', pastTime: 'Choose a future time',
    stScheduled: 'Scheduled', stSending: 'Sending', stPaused: t => `Paused until ${t}`, stDone: 'Completed', stDoneErr: 'Completed with errors', stCancelled: 'Cancelled', stFailed: 'Failed',
    progress: (a, n) => `${a} of ${n} sent`, failedN: f => `${f} failed`, removedN: n => `${n} removed after opting out`, recipients: n => `${n} recipients`,
    aEdit: 'Edit', aCancel: 'Cancel send', aStop: 'Stop', aDup: 'Duplicate', aView: 'View recipients', aRetry: 'Retry failed', more: 'Options',
    cancelT: 'Cancel this scheduled send?', cancelB: n => `${n} leads won't receive the message.`, keep: 'Keep it', stopT: 'Stop sending?', stopB: (a, b) => `${a} already sent. The remaining ${b} won't get it.`,
    leaveT: 'Leave without saving?', leaveB: "The send won't be saved.", keepEditing: 'Keep editing', leave: 'Leave', today: 'today', tomorrow: 'tomorrow', at: 'at', error: 'Error',
    rSent: 'Sent', rFailed: 'Failed', rSkipped: 'Skipped', rPending: 'Pending', summary: (n, tp) => `${n} recipients · ${tp}`, heTab: 'עברית', enTab: 'English',
  },
}
const pad2 = n => String(n).padStart(2, '0')
const dateStr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const timeStr = d => `${pad2(d.getHours())}:${pad2(Math.floor(d.getMinutes() / 30) * 30)}`
const asLead = l => ({ id: l.id, name: l.name, phone: l.phone, prop_title: l.propTitle || l.prop_title, prop_location: l.propLocation || l.prop_location, crm_data: { origin: l.origin || l.crm_data?.origin || {} } })
export function whenText(d, t, isEn) {
  const x = new Date(d), k = x.toDateString()
  const time = x.toLocaleTimeString(isEn ? 'en-GB' : 'he-IL', { hour: '2-digit', minute: '2-digit' })
  if (k === new Date().toDateString()) return `${t.today} ${t.at}${isEn ? ' ' : ''}${time}`
  if (k === new Date(Date.now() + 864e5).toDateString()) return `${t.tomorrow} ${t.at}${isEn ? ' ' : ''}${time}`
  return `${x.toLocaleDateString(isEn ? 'en-GB' : 'he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })} ${t.at}${isEn ? ' ' : ''}${time}`
}
export function jobState(j, cfg) {
  const total = j.recipients?.length || 0
  const sent = (j.recipients || []).filter(r => r.status === 'sent').length
  const failed = (j.recipients || []).filter(r => r.status === 'failed').length
  const skipped = (j.recipients || []).filter(r => r.status === 'skipped').length
  const due = new Date(j.at).getTime() <= Date.now()
  const paused = ['scheduled', 'sending'].includes(j.status) && due && j.respectQuiet !== false && !isSendWindow(cfg)
  const status = j.status === 'done' ? (failed ? 'doneErr' : 'done') : paused ? 'paused' : j.status
  return { total, sent, failed, skipped, status, done: sent + failed + skipped }
}

export default function CampaignsTab({ lang = 'he', cfg, tpls, leads, states = {}, stageName, jobs, loadJobs, jobsLoading, toast, onOpenSystem, pingActive, openEditId, clearOpenEdit }) {
  const t = TR[lang] || TR.he
  const isEn = lang === 'en'
  const confirm = useConfirm()
  const [seg, setSeg] = useState('scheduled')
  const [wizard, setWizard] = useState(null)      // { job? } or { dup: job }
  const [viewJob, setViewJob] = useState(null)
  const segOf = j => ['scheduled'].includes(j.status) ? 'scheduled' : j.status === 'sending' ? 'sending' : 'done'
  const counts = { scheduled: jobs.filter(j => segOf(j) === 'scheduled').length, sending: jobs.filter(j => segOf(j) === 'sending').length, done: jobs.filter(j => segOf(j) === 'done').length }
  useEffect(() => { if (counts.sending && !counts.scheduled) setSeg('sending') }, [counts.sending]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (openEditId) { const j = jobs.find(x => x.id === openEditId); if (j) setWizard({ job: j }); clearOpenEdit?.() } }, [openEditId, jobs]) // eslint-disable-line react-hooks/exhaustive-deps
  // keep a running send moving while this tab is open
  const active = jobs.some(j => j.status === 'sending' || (j.status === 'scheduled' && new Date(j.at).getTime() <= Date.now() && (j.respectQuiet === false || isSendWindow(cfg))))
  const busy = useRef(false)
  useEffect(() => {
    if (!active) return
    const iv = setInterval(async () => {
      if (busy.current || document.hidden) return
      busy.current = true
      try { await autoApi.post('auto-jobs-tick', {}); await loadJobs() } catch {} finally { busy.current = false }
    }, 5000)
    return () => clearInterval(iv)
  }, [active, loadJobs])
  const list = jobs.filter(j => segOf(j) === seg).sort((a, b) => seg === 'done' ? new Date(b.updatedAt || b.at) - new Date(a.updatedAt || a.at) : new Date(a.at) - new Date(b.at))
  const tplTitle = id => { const x = tpls.find(y => y.id === id); return x ? (isEn ? x.en_title || x.he_title : x.he_title) : id }

  const act = async (j, what) => {
    const st = jobState(j, cfg)
    try {
      if (what === 'cancel') { if (!await confirm({ title: t.cancelT, body: t.cancelB(st.total - st.done), confirmLabel: t.aCancel, cancelLabel: t.keep, tone: 'danger' })) return; await autoApi.post('auto-job-cancel', { id: j.id }) }
      if (what === 'stop') { if (!await confirm({ title: t.stopT, body: t.stopB(st.sent, st.total - st.done), confirmLabel: t.aStop, cancelLabel: t.keep, tone: 'danger' })) return; await autoApi.post('auto-job-cancel', { id: j.id }) }
      if (what === 'retry') { await autoApi.post('auto-job-retry', { id: j.id }); await autoApi.post('auto-jobs-tick', {}).catch(() => {}) }
      await loadJobs()
    } catch (e) { toast(`${t.error}: ${e.message}`, { tone: 'error' }) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 920 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <ModeSwitch value={seg} onChange={setSeg} modes={['scheduled', 'sending', 'done']} icons={{}} colors={{ scheduled: T.brand, sending: T.amber, done: T.green }}
          labels={{ scheduled: `${t.segScheduled} · ${counts.scheduled}`, sending: `${t.segSending} · ${counts.sending}`, done: `${t.segDone} · ${counts.done}` }} label={t.newSend}/>
        <div style={{ flex: 1 }}/>
        <Button variant="solid" icon={<FaPlus size={11}/>} onClick={() => setWizard({})}>{t.newSend}</Button>
      </div>
      {jobsLoading && !jobs.length ? [0, 1, 2].map(i => <Skeleton key={i} h={96} r={14}/>) :
        !list.length ? <Card><EmptyState icon={FaBullhorn} title={t.emptyT} body={t.emptyB} action={<Button variant="solid" icon={<FaPlus size={11}/>} onClick={() => setWizard({})}>{t.newSend}</Button>}/></Card> :
        list.map(j => {
          const st = jobState(j, cfg)
          const nw = st.status === 'paused' ? nextSendWindow(cfg) : null
          const badge = { scheduled: [t.stScheduled, T.brand], sending: [t.stSending, T.amber], paused: [t.stPaused(nw ? whenText(nw, t, isEn) : '—'), T.amber], done: [t.stDone, T.green], doneErr: [t.stDoneErr, T.red], cancelled: [t.stCancelled, T.grey], failed: [t.stFailed, T.red] }[st.status] || [st.status, T.grey]
          const enCount = (j.recipients || []).filter(r => leadLang(leads.find(l => String(l.id) === String(r.leadId)) || {}) === 'en').length
          return (
            <Card key={j.id} pad={14} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, background: T.brandSoft, color: T.brand, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FaBullhorn size={13}/></span>
                <b style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 140 }}>{j.name || tplTitle(j.templateId)}</b>
                <Badge color={badge[1]} textColor={badge[1] === T.amber ? T.amberText : badge[1] === T.red ? T.redText : undefined}>{st.status === 'paused' && <FaMoon size={9}/>}{badge[0]}</Badge>
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: T.text2 }}>
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><FaCalendarAlt size={11}/>{whenText(j.at, t, isEn)}</span>
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><FaUsers size={11}/>{t.recipients(st.total)}</span>
                <span>HE {st.total - enCount} · EN {enCount}</span>
                {j.customText && <span style={{ color: T.amberText }}>✎</span>}
              </div>
              {(st.done > 0 || j.status === 'sending') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <ProgressBar done={st.sent} failed={st.failed} total={st.total} label={t.progress(st.sent, st.total)}/>
                  <div style={{ fontSize: 11.5, color: T.text3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{t.progress(st.sent, st.total)}</span>{!!st.failed && <span style={{ color: T.redText }}>{t.failedN(st.failed)}</span>}{!!st.skipped && <span>{t.removedN(st.skipped)}</span>}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {j.status === 'scheduled' && <Button size="sm" variant="brand" icon={<FaPen size={9}/>} onClick={() => setWizard({ job: j })}>{t.aEdit}</Button>}
                {st.status === 'doneErr' && <Button size="sm" variant="soft-green" icon={<FaRedo size={9}/>} onClick={() => act(j, 'retry')}>{t.aRetry}</Button>}
                {j.status === 'scheduled' && <Button size="sm" variant="danger" icon={<FaBan size={9}/>} onClick={() => act(j, 'cancel')}>{t.aCancel}</Button>}
                {j.status === 'sending' && <Button size="sm" variant="danger" icon={<FaBan size={9}/>} onClick={() => act(j, 'stop')}>{t.aStop}</Button>}
                {j.status !== 'scheduled' && <Button size="sm" icon={<FaEye size={10}/>} onClick={() => setViewJob(j)}>{t.aView}</Button>}
                {j.status !== 'sending' && <Button size="sm" icon={<FaCopy size={10}/>} onClick={() => setWizard({ dup: j })}>{t.aDup}</Button>}
              </div>
            </Card>
          )
        })}

      {wizard && <Wizard t={t} lang={lang} cfg={cfg} tpls={tpls} leads={leads} states={states} stageName={stageName} init={wizard} pingActive={pingActive} onOpenSystem={onOpenSystem} toast={toast}
        onClose={() => setWizard(null)} onDone={async kind => { setWizard(null); setSeg(kind === 'now' ? 'sending' : 'scheduled'); await loadJobs() }}/>}
      {viewJob && (
        <Modal open onClose={() => setViewJob(null)} title={`${t.aView} · ${viewJob.name || tplTitle(viewJob.templateId)}`} width={560} dir={isEn ? 'ltr' : 'rtl'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(viewJob.recipients || []).map((r, i) => {
              const [lbl, c] = r.status === 'sent' ? [t.rSent, T.green] : r.status === 'failed' ? [t.rFailed, T.red] : r.status === 'skipped' ? [t.rSkipped, T.grey] : [t.rPending, T.brand]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, borderBottom: `1px solid ${T.divider}`, fontSize: 13 }}>
                  <b style={{ flex: 1 }}>{r.name || '—'}</b><bdi dir="ltr" style={{ color: T.text3, fontSize: 12 }}>…{String(r.phone || '').slice(-4)}</bdi>
                  <Badge color={c} textColor={c === T.red ? T.redText : undefined} title={r.error || undefined}>{lbl}</Badge>
                </div>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Wizard ─────────────────────────────────────────────────────────────────────
function Wizard({ t, lang, cfg, tpls, leads, states, stageName, init, pingActive, onOpenSystem, toast, onClose, onDone }) {
  const isEn = lang === 'en'
  const dir = isEn ? 'ltr' : 'rtl'
  const confirm = useConfirm()
  const base = init.job || init.dup || null
  const editing = !!init.job
  const [step, setStep] = useState(editing ? 3 : 1)
  const [tplId, setTplId] = useState(base?.templateId || '')
  const [tq, setTq] = useState('')
  const [custom, setCustom] = useState(!!base?.customText)
  const [ct, setCt] = useState(base?.customText || null)
  const [ctTab, setCtTab] = useState('he')
  const [stages, setStages] = useState(new Set())
  const [days, setDays] = useState(0)
  const [lng, setLng] = useState('all')
  const [skipGot, setSkipGot] = useState(!base)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(() => new Set((base?.recipients || []).map(r => String(r.leadId || r.phone))))
  const [touched, setTouched] = useState(!!base)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [when, setWhen] = useState(editing ? 'later' : 'now')
  const d0 = new Date(editing ? base.at : Date.now() + 3600e3)
  const [date, setDate] = useState(dateStr(d0))
  const [time, setTime] = useState(timeStr(d0))
  const [inHours, setInHours] = useState(base ? base.respectQuiet !== false : true)
  const [busy, setBusy] = useState(false)
  const tpl = tpls.find(x => x.id === tplId)
  const effTpl = tpl && custom && ct ? { ...tpl, he: ct.he || tpl.he, en: ct.en || ct.he || tpl.en } : tpl

  const rows = useMemo(() => leads.map(l => {
    const s = states[String(l.id)], phone = intlPhone(l.phone)
    return { l, id: String(l.id), phone, lang: leadLang(l), stage: l.leadStatus || 'new', optOut: !!s?.optOut, noPhone: !phone || phone.length < 11, got: !!s?.sent?.[`tpl:${tplId}`] }
  }), [leads, states, tplId])
  const filtered = rows.filter(r => (!stages.size || stages.has(r.stage)) && (!days || !r.l.ts || Date.now() - r.l.ts <= days * 864e5) && (lng === 'all' || r.lang === lng)
    && (!q || `${r.l.name || ''} ${r.l.phone || ''} ${r.l.propTitle || ''}`.toLowerCase().includes(q.toLowerCase())))
  const eligible = filtered.filter(r => !r.optOut && !r.noPhone && !(skipGot && r.got))
  useEffect(() => { if (!touched) setSel(new Set(eligible.map(r => r.id))) }, [stages, days, lng, skipGot, q, tplId]) // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = eligible.filter(r => sel.has(r.id))
  const exOpt = filtered.filter(r => r.optOut).length, exPhone = filtered.filter(r => r.noPhone && !r.optOut).length
  const stageCount = s => rows.filter(r => r.stage === s).length
  const firstLead = chosen[0]?.l
  const at = new Date(`${date}T${time}`)
  const atOk = when === 'now' || (at.getTime() > Date.now() - 60000)
  const startAt = when === 'later' && inHours ? nextSendWindow(cfg, at) : null
  const outside = when === 'later' && inHours && startAt && Math.abs(startAt - at) > 60000
  const dirty = !!(tplId || sel.size) && !editing

  const tryClose = async () => { if (dirty && !await confirm({ title: t.leaveT, body: t.leaveB, confirmLabel: t.leave, cancelLabel: t.keepEditing, tone: 'danger' })) return; onClose() }
  const quick = k => {
    const d = new Date()
    if (k === 'hour') d.setTime(d.getTime() + 3600e3)
    if (k === 'tmr') { d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0) }
    if (k === 'sun') { d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); d.setHours(10, 0, 0, 0) }
    setDate(dateStr(d)); setTime(timeStr(d)); setWhen('later')
  }
  const submit = async () => {
    if (!tpl || !chosen.length) return
    if (when === 'later' && !atOk) { toast(t.pastTime, { tone: 'warn' }); return }
    const job = {
      id: editing ? base.id : undefined, name: isEn ? tpl.en_title || tpl.he_title : tpl.he_title, templateId: tpl.id,
      at: when === 'now' ? new Date().toISOString() : at.toISOString(), respectQuiet: when === 'now' ? false : inHours,
      customText: custom && ct && (ct.he || ct.en) ? ct : null,
      recipients: chosen.map(r => ({ leadId: r.id, phone: r.phone, name: r.l.name })),
    }
    if (when === 'now' && !await confirm({ title: t.confirmNow(chosen.length), body: t.pacing, confirmLabel: t.confirmBtn, cancelLabel: t.cancel })) return
    setBusy(true)
    try {
      await autoApi.post('auto-job', { job })
      if (when === 'now') { autoApi.post('auto-jobs-tick', {}).catch(() => {}); toast(t.startedToast(chosen.length)) }
      else toast(editing ? t.updated : t.scheduledToast(whenText(at, t, isEn)))
      await onDone(when)
    } catch (e) { toast(`${t.error}: ${e.message}`, { tone: 'error' }) } finally { setBusy(false) }
  }

  const Stepper = (
    <ol aria-label={t.stepOf(step)} style={{ display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none', margin: 0, padding: 0 }} className="au-hide-m">
      {[t.step1, t.step2, t.step3].map((lbl, i) => {
        const n = i + 1, done = n < step, cur = n === step
        return (
          <li key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span aria-hidden style={{ width: 24, height: 1, background: T.line2 }}/>}
            <button type="button" disabled={!done} onClick={() => done && setStep(n)} aria-current={cur ? 'step' : undefined}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, color: cur ? T.text : done ? T.text2 : T.text3, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: done ? 'pointer' : 'default', minHeight: 0, minWidth: 0 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: done ? T.green : cur ? T.brand : 'transparent', color: done || cur ? T.bg : T.text3, border: done || cur ? 'none' : `1px solid ${T.line2}` }}>{done ? <FaCheck size={10}/> : n}</span>{lbl}
            </button>
          </li>
        )
      })}
    </ol>
  )
  const tplsFiltered = tpls.filter(x => !tq || `${x.he_title} ${x.en_title} ${x.he}`.toLowerCase().includes(tq.toLowerCase()))
  const primary = step === 1 ? <Button variant="solid" disabled={!tpl} onClick={() => setStep(2)} icon={isEn ? <FaArrowRight size={10}/> : <FaArrowLeft size={10}/>}>{t.next}</Button>
    : step === 2 ? <Button variant="solid" disabled={!chosen.length} onClick={() => setStep(3)} icon={isEn ? <FaArrowRight size={10}/> : <FaArrowLeft size={10}/>}>{t.nextN(chosen.length)}</Button>
    : <Button variant="solid" loading={busy} disabled={!tpl || !chosen.length || !atOk} onClick={submit} icon={when === 'now' ? <FaPaperPlane size={11}/> : <FaCalendarAlt size={11}/>}>{editing ? t.ctaUpdate : when === 'now' ? t.ctaNow(chosen.length) : t.ctaSched(chosen.length, whenText(startAt || at, t, isEn))}</Button>

  return (
    <Modal open onClose={tryClose} full closeOnBackdrop={false} dir={dir} label={editing ? t.wizEdit : t.wizTitle}>
      <div className="au" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', height: 60, borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
          <IconButton icon={<FaTimes/>} label="✕" size={36} onClick={tryClose}/>
          <b style={{ fontSize: 16, fontWeight: 800 }}>{editing ? t.wizEdit : t.wizTitle}</b>
          <div style={{ flex: 1 }}/>{Stepper}<span className="au-only-m" style={{ fontSize: 12, color: T.text3 }}>{t.stepOf(step)} · {[t.step1, t.step2, t.step3][step - 1]}</span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16, minHeight: 0 }}>
          {step === 1 && (
            <div className="au-wiz">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <div style={{ position: 'relative' }}>
                  <FaSearch size={12} style={{ position: 'absolute', top: 12, insetInlineStart: 12, color: T.text3 }}/>
                  <input value={tq} onChange={e => setTq(e.target.value)} placeholder={t.search} aria-label={t.search} style={{ ...inputStyle, height: 36, paddingInlineStart: 32 }} data-autofocus/>
                </div>
                <div role="listbox" aria-label={t.chooseTpl} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {tplsFiltered.map(x => {
                    const on = x.id === tplId, c = CATEGORIES.find(k => k.id === x.cat) || CATEGORIES[5]
                    return (
                      <button key={x.id} type="button" role="option" aria-selected={on} onClick={() => { setTplId(x.id); setCt(null); setCustom(false) }} className={on ? undefined : 'au-hov'}
                        style={{ minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderRadius: 9, border: 'none', borderInlineStart: `3px solid ${on ? T.brand : 'transparent'}`, background: on ? T.brandSoft : 'transparent', color: T.text, fontFamily: 'inherit', textAlign: 'start', cursor: 'pointer' }}>
                        <span style={{ fontSize: 16 }}>{c.icon}</span><span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{isEn ? x.en_title || x.he_title : x.he_title}</span>
                        <Badge color={c.color}>{isEn ? c.en : c.he}</Badge>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tpl ? <>
                  <div style={{ fontSize: 12, color: T.text3 }}>{t.previewFor(firstLead?.name || (isEn ? 'Dana' : 'דנה'))}</div>
                  <PhonePreview text={renderTemplate(effTpl, asLead(firstLead || { name: isEn ? 'Dana' : 'דנה' }), cfg, custom ? ctTab : undefined)} lang={custom ? ctTab : firstLead ? leadLang(firstLead) : 'he'} fill/>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={custom} onChange={e => { setCustom(e.target.checked); if (e.target.checked && !ct) setCt({ he: tpl.he || '', en: tpl.en || '' }) }} style={{ appearance: 'auto', width: 18, height: 18, minHeight: 0 }}/>{t.editOnce}
                  </label>
                  {custom && ct && (
                    <div className="au-in" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div role="tablist" style={{ display: 'flex', gap: 4 }}>{['he', 'en'].map(l => <FilterChip key={l} selected={ctTab === l} onClick={() => setCtTab(l)}>{l === 'he' ? t.heTab : t.enTab}</FilterChip>)}</div>
                      <textarea value={ct[ctTab] || ''} onChange={e => setCt(c => ({ ...c, [ctTab]: e.target.value }))} dir={ctTab === 'he' ? 'rtl' : 'ltr'} lang={ctTab} rows={6} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', lineHeight: 1.6, resize: 'vertical' }}/>
                    </div>
                  )}
                </> : <EmptyState compact icon={FaBullhorn} title={t.chooseTpl}/>}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="au-wiz2">
              <div>
                <button type="button" className="au-only-m" onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen} style={{ width: '100%', minHeight: 44, alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderRadius: 9, border: `1px solid ${T.line2}`, background: T.s1, color: T.text, fontFamily: 'inherit', fontWeight: 700, marginBottom: 10 }}>
                  {t.filters(stages.size + (days ? 1 : 0) + (lng !== 'all' ? 1 : 0))}{filtersOpen ? <FaChevronUp size={11}/> : <FaChevronDown size={11}/>}
                </button>
                <div className={filtersOpen ? undefined : 'au-hide-m'} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Field label={t.fStage}><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{STAGES.map(s => <FilterChip key={s} selected={stages.has(s)} count={stageCount(s)} onClick={() => { setTouched(false); setStages(x => { const n = new Set(x); n.has(s) ? n.delete(s) : n.add(s); return n }) }}>{stageName(s)}</FilterChip>)}</div></Field>
                  <Field label={t.fJoined}><div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{[7, 30, 90, 0].map(d => <FilterChip key={d} selected={days === d} onClick={() => { setTouched(false); setDays(d) }}>{d ? t.fDays(d) : t.fAny}</FilterChip>)}</div></Field>
                  <Field label={t.fLang}><div style={{ display: 'flex', gap: 5 }}>{[['all', t.fAny], ['he', t.fHe], ['en', t.fEn]].map(([k, l]) => <FilterChip key={k} selected={lng === k} onClick={() => { setTouched(false); setLng(k) }}>{l}</FilterChip>)}</div></Field>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={skipGot} onChange={e => { setTouched(false); setSkipGot(e.target.checked) }} style={{ appearance: 'auto', width: 18, height: 18, minHeight: 0 }}/>{t.skipGot}</label>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: T.text3 }}><input type="checkbox" checked disabled style={{ appearance: 'auto', width: 18, height: 18, minHeight: 0 }}/>{t.optoutLocked}</label>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <div style={{ position: 'relative' }}>
                  <FaSearch size={12} style={{ position: 'absolute', top: 12, insetInlineStart: 12, color: T.text3 }}/>
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.leadSearch} aria-label={t.leadSearch} style={{ ...inputStyle, height: 36, paddingInlineStart: 32 }}/>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b style={{ fontSize: 13, flex: 1 }} aria-live="polite">{t.selectedN(chosen.length)}</b>
                  <Button size="sm" onClick={() => { setTouched(true); setSel(new Set(eligible.map(r => r.id))) }}>{t.selectAll}</Button>
                  <Button size="sm" onClick={() => { setTouched(true); setSel(new Set()) }}>{t.clear}</Button>
                </div>
                {(exOpt + exPhone) > 0 && <div style={{ fontSize: 12, color: T.amberText, display: 'flex', gap: 6, alignItems: 'center' }}><FaExclamationTriangle size={11}/>{t.excluded(exOpt + exPhone, exOpt, exPhone)}</div>}
                <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, overflow: 'auto', maxHeight: 'min(460px, 55dvh)' }}>
                  {filtered.map(r => {
                    const dis = r.optOut || r.noPhone || (skipGot && r.got)
                    const why = r.optOut ? t.optedOut : r.noPhone ? t.noPhone : skipGot && r.got ? t.gotIt : ''
                    return (
                      <label key={r.id} className="au-hov" style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderBottom: `1px solid ${T.divider}`, cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? .45 : 1 }}>
                        <input type="checkbox" disabled={dis} checked={!dis && sel.has(r.id)} onChange={() => { setTouched(true); setSel(s => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n }) }} style={{ appearance: 'auto', width: 18, height: 18, minHeight: 0, flexShrink: 0 }}/>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><b style={{ fontSize: 13.5 }}>{r.l.name || '—'}</b>{r.l.propTitle && <span style={{ color: T.text3, fontSize: 12 }}> · {r.l.propTitle}</span>}</span>
                        <Badge color={T.grey} textColor={T.text2}>{stageName(r.stage)}</Badge>
                        {r.lang === 'en' && <Badge color={T.brand}>EN</Badge>}
                        {why ? <span style={{ fontSize: 11, color: T.redText, whiteSpace: 'nowrap' }}>{why}</span> : <bdi dir="ltr" style={{ fontSize: 11.5, color: T.text3, fontVariantNumeric: 'tabular-nums' }}>…{r.phone.slice(-4)}</bdi>}
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 620 }}>
              <div role="radiogroup" aria-label={t.step3} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                {[['now', FaPaperPlane, t.whenNow, t.whenNowSub], ['later', FaCalendarAlt, t.whenSched, t.whenSchedSub]].map(([k, Ic, l, sub]) => (
                  <button key={k} type="button" role="radio" aria-checked={when === k} disabled={editing && k === 'now'} onClick={() => setWhen(k)}
                    style={{ minHeight: 64, padding: '10px 14px', borderRadius: 12, border: `1px solid ${when === k ? T.brand : T.s1Line}`, background: when === k ? T.brandSoft : T.s1, color: T.text, fontFamily: 'inherit', display: 'flex', gap: 12, alignItems: 'center', textAlign: 'start', cursor: 'pointer', opacity: editing && k === 'now' ? .4 : 1 }}>
                    <Ic size={16} color={when === k ? T.brand : T.text3}/><span><b style={{ fontSize: 14, display: 'block' }}>{l}</b><span style={{ fontSize: 12, color: T.text3 }}>{sub}</span></span>
                  </button>
                ))}
              </div>
              {when === 'later' && (
                <div className="au-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Field label={t.date} htmlFor="au-date"><input id="au-date" type="date" dir="ltr" value={date} min={dateStr(new Date())} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: 180, colorScheme: 'dark' }}/></Field>
                    <Field label={t.time} htmlFor="au-time"><input id="au-time" type="time" step="1800" dir="ltr" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputStyle, width: 130, colorScheme: 'dark' }}/></Field>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <FilterChip onClick={() => quick('hour')}>{t.qHour}</FilterChip><FilterChip onClick={() => quick('tmr')}>{t.qTomorrow}</FilterChip><FilterChip onClick={() => quick('sun')}>{t.qSunday}</FilterChip>
                  </div>
                  {!atOk && <div style={{ fontSize: 12.5, color: T.redText }}>{t.pastTime}</div>}
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={inHours} onChange={e => setInHours(e.target.checked)} style={{ appearance: 'auto', width: 18, height: 18, minHeight: 0 }}/>{t.inHoursOnly}</label>
                  {outside && <div style={{ fontSize: 12.5, color: T.amberText, display: 'flex', gap: 6, alignItems: 'flex-start' }}><FaMoon size={11} style={{ marginTop: 3 }}/>{t.outsideWarn(whenText(startAt, t, isEn))}</div>}
                  {!pingActive && <div style={{ fontSize: 12.5, color: T.brandText, background: T.brandSoft, borderRadius: 9, padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><FaInfoCircle/>{t.precision}<Button size="sm" variant="brand" onClick={onOpenSystem}>{t.setupPrecise}</Button></div>}
                </div>
              )}
              <div style={{ fontSize: 12.5, color: T.text3, display: 'flex', flexDirection: 'column', gap: 4 }}><span>{t.pacing}</span><span>{t.optoutNote}</span></div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', minHeight: 64, borderTop: `1px solid ${T.line}`, background: 'rgba(0,0,0,.18)', flexWrap: 'wrap' }}>
          {tpl && <span className="au-hide-m" style={{ fontSize: 12, fontWeight: 700, color: T.text2, padding: '4px 10px', borderRadius: 20, background: T.s3 }}>{t.summary(chosen.length, isEn ? tpl.en_title || tpl.he_title : tpl.he_title)}</span>}
          <div style={{ flex: 1 }}/>
          {step > 1 && !(editing && step === 3 && false) && <Button onClick={() => setStep(s => s - 1)}>{t.back}</Button>}
          {primary}
        </div>
      </div>
    </Modal>
  )
}
