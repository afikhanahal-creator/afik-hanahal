// Lead card — opens in the middle of the screen from the leads board / table.
// Edit everything about a lead (details, needs, management), keep notes and tasks, and read the smart analysis.
// Every change saves on its own (onUpdate → PATCH /api/contacts → crm_data).
import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { FaTimes, FaPhone, FaWhatsapp, FaEnvelope, FaMagic, FaUser, FaStickyNote, FaTasks, FaChartPie, FaCheck, FaTrash, FaCopy, FaPlus, FaClock, FaBullseye, FaExclamationTriangle, FaLightbulb, FaQuestionCircle, FaComments, FaShieldAlt, FaSyncAlt, FaMapMarkerAlt, FaBuilding, FaCalendarAlt, FaTag, FaFlag, FaArrowUp, FaArrowDown, FaInfoCircle } from 'react-icons/fa'
import { T } from './automationsUI.jsx'
import { sourceLabel, sourceColor, originLines } from './lib/leadFields.js'

const TR = {
  he: {
    tabs: { details: 'פרטים ועריכה', notes: 'הערות ופעילות', tasks: 'משימות', analysis: 'ניתוח חכם' },
    call: 'התקשר', wa: 'וואטסאפ', email: 'מייל', analyze: 'נתח ליד', reanalyze: 'נתח מחדש', analyzing: 'מנתח…', close: 'סגירה', saved: 'נשמר', saving: 'שומר…',
    sec: { contact: 'פרטי קשר', need: 'מה הלקוח מחפש', prop: 'הנכס שהתעניין בו', msg: 'ההודעה של הלקוח', manage: 'ניהול הליד', source: 'מקור הליד' },
    f: { name: 'שם מלא', phone: 'טלפון', email: 'אימייל', contactTime: 'זמן נוח ליצירת קשר', dealType: 'סוג עסקה', propertyType: 'סוג נכס', area: 'אזור / יישוב', rooms: 'חדרים', budget: 'תקציב (₪)', timeline: 'לוח זמנים', financing: 'מימון', propTitle: 'נכס', propLocation: 'מיקום הנכס', msg: 'הודעה', priority: 'עדיפות', owner: 'אחראי', followUp: 'מעקב הבא', tags: 'תגיות', tagPh: 'הוסף תגית ו-Enter' },
    opt: {
      dealType: { '': '—', buy: 'קנייה', sell: 'מכירה', rent: 'השכרה', invest: 'השקעה' },
      timeline: { '': '—', now: 'מיידי', soon: 'בחודשים הקרובים', year: 'עד שנה', later: 'לא דחוף' },
      financing: { '': '—', cash: 'מזומן / הון עצמי', approved: 'משכנתא – יש אישור עקרוני', mortgage: 'משכנתא – צריך ליווי', unknown: 'לא ידוע' },
      priority: { '': '—', low: 'נמוכה', normal: 'רגילה', high: 'גבוהה', urgent: 'דחופה' },
    },
    campaign: 'קמפיין', form: 'טופס', answers: 'תשובות מהטופס', created: 'נכנס', none: '—',
    notePh: 'כתבו הערה, סיכום שיחה או מידע חשוב… (Ctrl+Enter לשמירה)', addNote: 'הוסף הערה', noNotes: 'אין עדיין הערות. כל מה שנכתב כאן נשמר על הליד.',
    activity: 'ציר פעילות', evCreated: 'הליד נכנס למערכת', evAnalyzed: s => `ניתוח: ציון ${s}`, evNote: 'הערה', evFollow: 'מעקב מתוכנן',
    taskPh: 'משימה חדשה (למשל: לשלוח תשריט)', due: 'עד', addTask: 'הוסף', noTasks: 'אין משימות פתוחות', overdue: 'באיחור', today: 'היום', done: 'הושלמו',
    gradeName: { hot: 'חם', warm: 'פושר', cool: 'קריר', cold: 'קר' }, rules: 'ציון כללים', aiAdj: 'תיקון AI', conf: { high: 'ביטחון גבוה', medium: 'ביטחון בינוני', low: 'ביטחון נמוך' },
    noAnalysis: 'עוד לא נותח', noAnalysisSub: 'הניתוח אוסף את כל מה שידוע על הליד – ההודעה, תשובות הטופס, השיחה בוואטסאפ, אוטומציות, פניות חוזרות והנכס שהתעניין בו – ומחשב ציון שקוף עם תדריך לשיחה.',
    brief: 'תדריך לשיחה', next: 'הצעד הבא', msgSuggest: 'הודעה מוצעת', copy: 'העתק', copied: 'הועתק', openChat: 'פתח שיחה',
    why: 'למה הציון הזה', groups: { contact: 'זמינות', intent: 'כוונה ובהירות', engage: 'מעורבות', source: 'מקור והיסטוריה', stage: 'שלב וטריות', fit: 'התאמה לנכס' },
    ask: 'שאלות לשיחה', points: 'נקודות לשיחה', objections: 'התנגדויות צפויות', risks: 'סיכונים', needs: 'צרכים', persona: 'מי הלקוח', motivation: 'מוטיבציה', bestTime: 'זמן מומלץ ליצירת קשר',
    signals: { budget: 'תקציב', dealType: 'עסקה', timeline: 'זמנים', financing: 'מימון', inbound: 'הודעות ממנו', repeats: 'פניות חוזרות', listing: 'מחיר הנכס' },
    tl: { now: 'מיידי', soon: 'חודשים', later: 'לא דחוף' }, fin: { cash: 'מזומן', mortgage: 'משכנתא' }, dt: { buy: 'קנייה', sell: 'מכירה', rent: 'השכרה', invest: 'השקעה' },
    aiOff: 'מוצג ניתוח מבוסס כללים. תדריך ה-AI לא זמין כרגע:', analyzedAt: t => `נותח ${t}`, legacy: 'ניתוח קודם (גרסה ישנה) – לחצו "נתח מחדש" לניתוח המדויק החדש',
  },
  en: {
    tabs: { details: 'Details', notes: 'Notes & activity', tasks: 'Tasks', analysis: 'Smart analysis' },
    call: 'Call', wa: 'WhatsApp', email: 'Email', analyze: 'Analyze lead', reanalyze: 'Re-analyze', analyzing: 'Analyzing…', close: 'Close', saved: 'Saved', saving: 'Saving…',
    sec: { contact: 'Contact details', need: 'What they are looking for', prop: 'Property of interest', msg: 'Their message', manage: 'Lead management', source: 'Lead source' },
    f: { name: 'Full name', phone: 'Phone', email: 'Email', contactTime: 'Best time to reach', dealType: 'Deal type', propertyType: 'Property type', area: 'Area / town', rooms: 'Rooms', budget: 'Budget (₪)', timeline: 'Timeline', financing: 'Financing', propTitle: 'Property', propLocation: 'Property location', msg: 'Message', priority: 'Priority', owner: 'Owner', followUp: 'Next follow-up', tags: 'Tags', tagPh: 'Add a tag and press Enter' },
    opt: {
      dealType: { '': '—', buy: 'Buy', sell: 'Sell', rent: 'Rent', invest: 'Invest' },
      timeline: { '': '—', now: 'Immediately', soon: 'In the coming months', year: 'Within a year', later: 'No rush' },
      financing: { '': '—', cash: 'Cash / equity', approved: 'Mortgage – pre-approved', mortgage: 'Mortgage – needs guidance', unknown: 'Unknown' },
      priority: { '': '—', low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' },
    },
    campaign: 'Campaign', form: 'Form', answers: 'Form answers', created: 'Created', none: '—',
    notePh: 'Write a note, call summary or anything important… (Ctrl+Enter to save)', addNote: 'Add note', noNotes: 'No notes yet. Everything written here is saved on the lead.',
    activity: 'Activity', evCreated: 'Lead came in', evAnalyzed: s => `Analysis: score ${s}`, evNote: 'Note', evFollow: 'Follow-up scheduled',
    taskPh: 'New task (e.g. send the site plan)', due: 'Due', addTask: 'Add', noTasks: 'No open tasks', overdue: 'Overdue', today: 'Today', done: 'Done',
    gradeName: { hot: 'Hot', warm: 'Warm', cool: 'Cool', cold: 'Cold' }, rules: 'Rule score', aiAdj: 'AI adjustment', conf: { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' },
    noAnalysis: 'Not analyzed yet', noAnalysisSub: 'The analysis gathers everything we know – the message, form answers, the WhatsApp conversation, automations, repeat inquiries and the listing – and computes a transparent score with a call briefing.',
    brief: 'Call briefing', next: 'Next step', msgSuggest: 'Suggested message', copy: 'Copy', copied: 'Copied', openChat: 'Open chat',
    why: 'Why this score', groups: { contact: 'Reachability', intent: 'Intent & clarity', engage: 'Engagement', source: 'Source & history', stage: 'Stage & freshness', fit: 'Property fit' },
    ask: 'Questions to ask', points: 'Talking points', objections: 'Likely objections', risks: 'Risks', needs: 'Needs', persona: 'Who they are', motivation: 'Motivation', bestTime: 'Best time to reach',
    signals: { budget: 'Budget', dealType: 'Deal', timeline: 'Timeline', financing: 'Financing', inbound: 'Their messages', repeats: 'Repeat inquiries', listing: 'Listing price' },
    tl: { now: 'Now', soon: 'Months', later: 'No rush' }, fin: { cash: 'Cash', mortgage: 'Mortgage' }, dt: { buy: 'Buy', sell: 'Sell', rent: 'Rent', invest: 'Invest' },
    aiOff: 'Showing the rule-based analysis. The AI briefing is unavailable:', analyzedAt: t => `Analyzed ${t}`, legacy: 'Older analysis – press "Re-analyze" for the new, more accurate one',
  },
}
const GRADE_COLOR = { hot: '#EF4444', warm: '#F59E0B', cool: '#60A5FA', cold: '#94A3B8' }
const CSS = `
  .lc *{box-sizing:border-box}
  .lc button{min-height:0;min-width:0}
  .lc-body{display:grid;grid-template-columns:minmax(0,1fr) 320px;flex:1;min-height:0}
  .lc-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .lc-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .lc-in{width:100%;height:38px;padding:0 11px;border-radius:9px;border:1px solid var(--au-s3-line);background:var(--au-input);color:var(--au-text);font-family:inherit;font-size:13.5px;outline:none;transition:border-color .15s,box-shadow .15s}
  .lc-in:focus{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.2)}
  textarea.lc-in{height:auto;padding:9px 11px;line-height:1.55;resize:vertical}
  select.lc-in{appearance:auto}
  .lc-tab{height:40px;padding:0 14px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;display:inline-flex;align-items:center;gap:7px;border-bottom:2px solid transparent;white-space:nowrap}
  .lc-row:hover{background:rgba(var(--ov),.04)}
  .lc-act{height:34px;padding:0 12px;border-radius:9px;display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;white-space:nowrap;transition:filter .15s}
  .lc-act:hover{filter:brightness(1.1)}
  @keyframes lc-in{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
  @keyframes lc-spin{to{transform:rotate(360deg)}}
  @media (max-width:980px){.lc-body{grid-template-columns:1fr;overflow-y:auto}.lc-side{border-inline-start:none!important;border-top:1px solid var(--au-line)}.lc-main{overflow:visible!important}}
  @media (max-width:640px){.lc-grid2,.lc-grid3{grid-template-columns:1fr}.lc-hide-m{display:none!important}}
  @media (max-width:640px){.lc{padding:0!important}.lc-dialog{border-radius:0!important;height:100%!important;border:none!important}}
  @media (prefers-reduced-motion:reduce){.lc-dialog{animation:none!important}}
`
const initials = n => [...String(n || '?').trim()][0] || '?'
const AVATARS = ['#E2445C', '#7C88D2', '#00C875', '#FDAB3D', '#A25DDC', '#0073EA', '#FF7575', '#03C9D7']
const avatarBg = n => AVATARS[(String(n || '').charCodeAt(0) || 0) % AVATARS.length]
const fmtWhen = (ts, lang) => { try { return new Date(ts).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const uid = () => Math.random().toString(36).slice(2, 10)
const asNotes = n => (Array.isArray(n) ? n : typeof n === 'string' && n.trim() ? [{ id: 'legacy', text: n, ts: 0 }] : [])
const shekel = n => (Number(n) ? `₪${Number(n).toLocaleString('he-IL')}` : '')

// ── small pieces ───────────────────────────────────────────────────────────────
function Section({ title, icon: Ic, children, right }) {
  return (
    <section style={{ background: T.card, boxShadow: T.cardShadow, border: `1px solid ${T.s1Line}`, borderRadius: 14, padding: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        {Ic && <Ic size={12} style={{ color: T.brandText }}/>}
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.text, flex: 1 }}>{title}</h3>
        {right}
      </header>
      {children}
    </section>
  )
}
function Field({ label, children }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}><span style={{ fontSize: 11.5, fontWeight: 700, color: T.text3 }}>{label}</span>{children}</label>
}
// Text / number / date input that saves on blur (and Enter for single-line)
function EditInput({ value, onSave, type = 'text', multiline, rows = 3, placeholder, dir }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => { setV(value ?? '') }, [value])
  const commit = () => { const nv = type === 'number' ? (v === '' ? '' : Number(String(v).replace(/[^\d.]/g, ''))) : v; if (String(nv ?? '') !== String(value ?? '')) onSave(nv) }
  const common = { className: 'lc-in', value: v, placeholder, dir, onChange: e => setV(e.target.value), onBlur: commit }
  return multiline
    ? <textarea {...common} rows={rows}/>
    : <input {...common} type={type === 'number' ? 'text' : type} inputMode={type === 'number' ? 'numeric' : undefined} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}/>
}
function EditSelect({ value, options, onSave }) {
  return <select className="lc-in" value={value || ''} onChange={e => onSave(e.target.value)}>{Object.entries(options).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
}
function Chip({ children, color = '#6F7AC7', onRemove }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 20, background: `${color}1c`, color: T.text, fontSize: 12, fontWeight: 700, border: `1px solid ${color}40` }}>{children}{onRemove && <button type="button" onClick={onRemove} aria-label="×" style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', padding: 0, display: 'inline-flex' }}><FaTimes size={9}/></button>}</span>
}
function ListBlock({ title, icon: Ic, items, color = T.brandText }) {
  if (!items?.length) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800, color: T.text2, marginBottom: 8 }}><Ic size={11} style={{ color }}/>{title}</div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((x, i) => <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.55, color: T.text }}><span style={{ color, flexShrink: 0 }}>•</span><span>{x}</span></li>)}
      </ul>
    </div>
  )
}
function ScoreRing({ score, grade, size = 96 }) {
  const c = GRADE_COLOR[grade] || GRADE_COLOR.cold, r = (size - 10) / 2, len = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(var(--ov),.08)" strokeWidth="8"/>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(score / 100) * len} ${len}`} style={{ transition: 'stroke-dasharray .6s' }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <b style={{ fontSize: size / 3.4, color: T.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{score}</b>
        <span style={{ fontSize: 10.5, color: T.text3 }}>/100</span>
      </div>
    </div>
  )
}

// ── main ───────────────────────────────────────────────────────────────────────
export default function LeadCard({ lead, onClose, onUpdate, onUpdateStatus, onEnrich, onOpenChat, lang = 'he', stages = [], initialTab = 'details' }) {
  const t = TR[lang] || TR.he
  const dir = lang === 'en' ? 'ltr' : 'rtl'
  const [tab, setTab] = useState(initialTab)
  const [saveState, setSaveState] = useState('')
  const [copied, setCopied] = useState(false)
  const dialogRef = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !e.defaultPrevented) onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.activeElement
    dialogRef.current?.focus()
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [onClose])

  const save = patch => {
    setSaveState('saving')
    Promise.resolve(onUpdate(lead.id, patch)).finally(() => {
      setSaveState('saved'); clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => setSaveState(''), 1600)
    })
  }
  const set = key => v => save({ [key]: v })

  const en = lead.enrichment || {}
  const isV2 = en.version === 2
  const enriching = en.status === 'enriching'
  const stage = stages.find(s => s.id === (lead.leadStatus || 'new')) || stages[0] || { id: 'new', label: 'ליד חדש', en: 'New', color: '#0073EA' }
  const notes = asNotes(lead.notes)
  const tasks = Array.isArray(lead.tasks) ? lead.tasks : []
  const openTasks = tasks.filter(x => !x.done).length
  const src = lead.source || (String(lead.id).startsWith('meta_') ? 'meta' : 'website')

  const copyMsg = async text => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }

  const header = (
    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <span style={{ width: 48, height: 48, borderRadius: '50%', background: avatarBg(lead.name), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800, flexShrink: 0, boxShadow: `0 4px 14px ${avatarBg(lead.name)}55` }}>{initials(lead.name)}</span>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 id="lc-title" style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name || t.none}</h2>
          {isV2 && <span title={t.why} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px', borderRadius: 20, background: `${GRADE_COLOR[en.grade]}1f`, color: GRADE_COLOR[en.grade], fontSize: 12, fontWeight: 800 }}>{en.score100} · {t.gradeName[en.grade]}</span>}
          {saveState && <span style={{ fontSize: 11.5, color: saveState === 'saved' ? T.green : T.text3, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{saveState === 'saved' && <FaCheck size={9}/>}{saveState === 'saved' ? t.saved : t.saving}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }} role="radiogroup" aria-label={t.f.dealType}>
          {stages.map(s => {
            const on = s.id === stage.id
            return <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => !on && (onUpdateStatus ? onUpdateStatus(lead, s.id) : save({ leadStatus: s.id }))}
              style={{ height: 26, padding: '0 10px', borderRadius: 20, border: `1px solid ${on ? s.color : T.s1Line}`, background: on ? s.color : 'transparent', color: on ? '#fff' : T.text2, fontSize: 11.5, fontWeight: 700, cursor: on ? 'default' : 'pointer', fontFamily: 'inherit' }}>{lang === 'en' ? s.en : s.label}</button>
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {lead.phone && <a className="lc-act" href={`tel:${lead.phone}`} style={{ background: 'rgba(0,115,234,.12)', color: '#3B8FF0', border: '1px solid rgba(0,115,234,.3)' }}><FaPhone size={11}/>{t.call}</a>}
        {lead.phone && onOpenChat && <button type="button" className="lc-act" onClick={() => { onOpenChat(lead); onClose() }} style={{ background: 'rgba(37,211,102,.12)', color: '#1FAF55', border: '1px solid rgba(37,211,102,.35)' }}><FaWhatsapp size={13}/>{t.wa}</button>}
        {lead.email && <a className="lc-act lc-hide-m" href={`mailto:${lead.email}`} style={{ background: 'rgba(226,68,92,.1)', color: '#E2445C', border: '1px solid rgba(226,68,92,.3)' }}><FaEnvelope size={11}/>{t.email}</a>}
        {onEnrich && <button type="button" className="lc-act" disabled={enriching} onClick={() => { onEnrich(lead); setTab('analysis') }} style={{ background: 'linear-gradient(135deg,var(--au-brand),var(--au-brand-deep))', color: '#fff', border: 'none', opacity: enriching ? .7 : 1 }}>
          {enriching ? <FaSyncAlt size={11} style={{ animation: 'lc-spin 1s linear infinite' }}/> : <FaMagic size={11}/>}{enriching ? t.analyzing : isV2 ? t.reanalyze : t.analyze}</button>}
        <button type="button" onClick={onClose} aria-label={t.close} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${T.s1Line}`, background: 'transparent', color: T.text2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes size={13}/></button>
      </div>
    </div>
  )

  const tabs = [['details', FaUser, t.tabs.details], ['notes', FaStickyNote, t.tabs.notes, notes.length || null], ['tasks', FaTasks, t.tabs.tasks, openTasks || null], ['analysis', FaChartPie, t.tabs.analysis]]
  const tabBar = (
    <div role="tablist" style={{ display: 'flex', gap: 2, padding: '0 14px', borderBottom: `1px solid ${T.line}`, overflowX: 'auto', flexShrink: 0 }}>
      {tabs.map(([id, Ic, label, badge]) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} className="lc-tab" onClick={() => setTab(id)} style={{ color: tab === id ? T.text : T.text3, borderBottomColor: tab === id ? 'var(--au-brand)' : 'transparent' }}>
          <Ic size={11}/>{label}{badge ? <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: T.brandSoft, color: T.brandText, fontSize: 10.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span> : null}
        </button>
      ))}
    </div>
  )

  // ── Details tab ───────────────────────────────────────────────────────────
  const [tagDraft, setTagDraft] = useState('')
  const tags = Array.isArray(lead.tags) ? lead.tags : []
  const details = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Section title={t.sec.contact} icon={FaUser}>
        <div className="lc-grid2">
          <Field label={t.f.name}><EditInput value={lead.name} onSave={set('name')}/></Field>
          <Field label={t.f.phone}><EditInput value={lead.phone} onSave={set('phone')} dir="ltr"/></Field>
          <Field label={t.f.email}><EditInput value={lead.email} onSave={set('email')} type="email" dir="ltr"/></Field>
          <Field label={t.f.contactTime}><EditInput value={lead.contactTime} onSave={set('contactTime')} placeholder={lang === 'en' ? 'e.g. mornings, after 17:00' : 'למשל: בבקרים, אחרי 17:00'}/></Field>
        </div>
      </Section>
      <Section title={t.sec.need} icon={FaBullseye}>
        <div className="lc-grid3">
          <Field label={t.f.dealType}><EditSelect value={lead.dealType} options={t.opt.dealType} onSave={set('dealType')}/></Field>
          <Field label={t.f.propertyType}><EditInput value={lead.propertyType} onSave={set('propertyType')} placeholder={lang === 'en' ? 'Plot, apartment, house…' : 'מגרש, דירה, בית…'}/></Field>
          <Field label={t.f.area}><EditInput value={lead.area} onSave={set('area')} placeholder={lang === 'en' ? 'Hod Hasharon, Tel Mond…' : 'הוד השרון, תל מונד…'}/></Field>
          <Field label={t.f.budget}><EditInput value={lead.budget} onSave={set('budget')} type="number" dir="ltr" placeholder="2,500,000"/></Field>
          <Field label={t.f.timeline}><EditSelect value={lead.timeline} options={t.opt.timeline} onSave={set('timeline')}/></Field>
          <Field label={t.f.financing}><EditSelect value={lead.financing} options={t.opt.financing} onSave={set('financing')}/></Field>
          <Field label={t.f.rooms}><EditInput value={lead.rooms} onSave={set('rooms')} dir="ltr"/></Field>
        </div>
      </Section>
      <Section title={t.sec.prop} icon={FaBuilding}>
        <div className="lc-grid2">
          <Field label={t.f.propTitle}><EditInput value={lead.propTitle} onSave={set('propTitle')}/></Field>
          <Field label={t.f.propLocation}><EditInput value={lead.propLocation} onSave={set('propLocation')}/></Field>
        </div>
      </Section>
      <Section title={t.sec.msg} icon={FaComments}>
        <EditInput value={lead.msg} onSave={set('msg')} multiline rows={4}/>
      </Section>
      <Section title={t.sec.manage} icon={FaFlag}>
        <div className="lc-grid3">
          <Field label={t.f.priority}><EditSelect value={lead.priority} options={t.opt.priority} onSave={set('priority')}/></Field>
          <Field label={t.f.owner}><EditInput value={lead.owner} onSave={set('owner')}/></Field>
          <Field label={t.f.followUp}><EditInput value={lead.followUp} onSave={set('followUp')} type="datetime-local" dir="ltr"/></Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label={t.f.tags}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {tags.map(g => <Chip key={g} onRemove={() => save({ tags: tags.filter(x => x !== g) })}>{g}</Chip>)}
              <input className="lc-in" style={{ width: 200, height: 30 }} value={tagDraft} placeholder={t.f.tagPh} onChange={e => setTagDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && tagDraft.trim()) { e.preventDefault(); if (!tags.includes(tagDraft.trim())) save({ tags: [...tags, tagDraft.trim()] }); setTagDraft('') } }}/>
            </div>
          </Field>
        </div>
      </Section>
    </div>
  )

  // ── Notes tab ─────────────────────────────────────────────────────────────
  const [noteDraft, setNoteDraft] = useState('')
  const addNote = () => { const text = noteDraft.trim(); if (!text) return; save({ notes: [...notes.filter(n => n.id !== 'legacy' || n.text), { id: uid(), text, ts: Date.now() }] }); setNoteDraft('') }
  const events = useMemo(() => {
    const ev = []
    if (lead.ts) ev.push({ ts: lead.ts, icon: FaFlag, text: t.evCreated })
    if (isV2 && en.enrichedAt) ev.push({ ts: en.enrichedAt, icon: FaChartPie, text: t.evAnalyzed(en.score100) })
    notes.forEach(n => n.ts && ev.push({ ts: n.ts, icon: FaStickyNote, text: `${t.evNote}: ${n.text.slice(0, 80)}` }))
    if (lead.followUp) ev.push({ ts: Date.parse(lead.followUp), icon: FaCalendarAlt, text: t.evFollow, future: Date.parse(lead.followUp) > Date.now() })
    return ev.filter(e => e.ts).sort((a, b) => b.ts - a.ts)
  }, [lead.ts, lead.followUp, notes, en.enrichedAt, en.score100, isV2, t]) // eslint-disable-line
  const notesTab = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Section title={t.tabs.notes} icon={FaStickyNote}>
        <textarea className="lc-in" rows={3} value={noteDraft} placeholder={t.notePh} onChange={e => setNoteDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNote() } }}/>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="lc-act" disabled={!noteDraft.trim()} onClick={addNote} style={{ background: noteDraft.trim() ? 'var(--au-brand)' : 'rgba(var(--ov),.06)', color: noteDraft.trim() ? '#fff' : T.text3, border: 'none' }}><FaPlus size={10}/>{t.addNote}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {!notes.length && <div style={{ fontSize: 13, color: T.text3, textAlign: 'center', padding: '14px 0' }}>{t.noNotes}</div>}
          {[...notes].reverse().map(n => (
            <div key={n.id || n.ts} className="lc-row" style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.divider}`, background: 'rgba(var(--ov),.02)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: T.text, whiteSpace: 'pre-wrap', lineHeight: 1.55, wordBreak: 'break-word' }}>{n.text}</div>
                {!!n.ts && <div style={{ fontSize: 11.5, color: T.text3, marginTop: 4 }}>{fmtWhen(n.ts, lang)}</div>}
              </div>
              <button type="button" aria-label="delete" onClick={() => save({ notes: notes.filter(x => x !== n) })} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', padding: 4, alignSelf: 'flex-start' }}><FaTrash size={11}/></button>
            </div>
          ))}
        </div>
      </Section>
      <Section title={t.activity} icon={FaClock}>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative' }}>
          {events.map((e, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: e.future ? 'rgba(245,158,11,.14)' : T.brandSoft, color: e.future ? '#D97706' : T.brandText, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><e.icon size={10}/></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.text }}>{e.text}</div>
                <div style={{ fontSize: 11.5, color: T.text3 }}>{fmtWhen(e.ts, lang)}</div>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  )

  // ── Tasks tab ─────────────────────────────────────────────────────────────
  const [taskDraft, setTaskDraft] = useState(''), [taskDue, setTaskDue] = useState('')
  const addTask = () => { const text = taskDraft.trim(); if (!text) return; save({ tasks: [...tasks, { id: uid(), text, due: taskDue || '', done: false, createdAt: Date.now() }] }); setTaskDraft(''); setTaskDue('') }
  const dueTone = d => { if (!d) return null; const x = Date.parse(d), s = new Date(); s.setHours(0, 0, 0, 0); if (x < s.getTime()) return ['#EF4444', t.overdue]; if (x < s.getTime() + 864e5) return ['#F59E0B', t.today]; return [T.text3, new Date(x).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'short' })] }
  const taskRow = x => {
    const tone = dueTone(x.due)
    return (
      <div key={x.id} className="lc-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10 }}>
        <button type="button" role="checkbox" aria-checked={!!x.done} onClick={() => save({ tasks: tasks.map(y => (y.id === x.id ? { ...y, done: !y.done, doneAt: !y.done ? Date.now() : null } : y)) })}
          style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${x.done ? '#22C55E' : T.s3Line}`, background: x.done ? '#22C55E' : 'transparent', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{x.done && <FaCheck size={9}/>}</button>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: x.done ? T.text3 : T.text, textDecoration: x.done ? 'line-through' : 'none' }}>{x.text}</span>
        {tone && !x.done && <span style={{ fontSize: 11.5, fontWeight: 700, color: tone[0], whiteSpace: 'nowrap' }}>{tone[1]}</span>}
        <button type="button" aria-label="delete" onClick={() => save({ tasks: tasks.filter(y => y.id !== x.id) })} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', padding: 4 }}><FaTrash size={11}/></button>
      </div>
    )
  }
  const tasksTab = (
    <Section title={t.tabs.tasks} icon={FaTasks}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="lc-in" style={{ flex: '1 1 240px' }} value={taskDraft} placeholder={t.taskPh} onChange={e => setTaskDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTask() }}/>
        <input className="lc-in" style={{ width: 160 }} type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} aria-label={t.due} dir="ltr"/>
        <button type="button" className="lc-act" onClick={addTask} disabled={!taskDraft.trim()} style={{ background: taskDraft.trim() ? 'var(--au-brand)' : 'rgba(var(--ov),.06)', color: taskDraft.trim() ? '#fff' : T.text3, border: 'none', height: 38 }}><FaPlus size={10}/>{t.addTask}</button>
      </div>
      <div style={{ marginTop: 12 }}>
        {!tasks.filter(x => !x.done).length && <div style={{ fontSize: 13, color: T.text3, textAlign: 'center', padding: '14px 0' }}>{t.noTasks}</div>}
        {tasks.filter(x => !x.done).sort((a, b) => (Date.parse(a.due) || 9e15) - (Date.parse(b.due) || 9e15)).map(taskRow)}
        {tasks.some(x => x.done) && <>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: T.text3, margin: '12px 10px 4px' }}>{t.done}</div>
          {tasks.filter(x => x.done).map(taskRow)}
        </>}
      </div>
    </Section>
  )

  // ── Analysis tab ──────────────────────────────────────────────────────────
  const b = en.brief || {}
  const sig = en.signals || {}
  const factorGroups = useMemo(() => {
    const g = {}
    for (const f of en.factors || []) (g[f.group] = g[f.group] || []).push(f)
    return Object.entries(g)
  }, [en.factors])
  const nextText = b.nextBestAction || (en.next ? (lang === 'en' ? en.next.en : en.next.he) : '')
  const askList = [...(b.questionsToAsk || []), ...((en.missing || []).map(m => (lang === 'en' ? m.en : m.he)))].filter((x, i, a) => a.indexOf(x) === i).slice(0, 6)
  const analysis = !isV2 ? (
    <Section title={t.tabs.analysis} icon={FaChartPie}>
      <div style={{ textAlign: 'center', padding: '22px 10px' }}>
        <span style={{ width: 56, height: 56, borderRadius: '50%', background: T.brandSoft, color: T.brandText, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaMagic size={20}/></span>
        <h3 style={{ margin: '12px 0 6px', fontSize: 16, color: T.text }}>{en.status === 'done' ? t.legacy : t.noAnalysis}</h3>
        <p style={{ margin: '0 auto 16px', maxWidth: 520, fontSize: 13, lineHeight: 1.6, color: T.text2 }}>{t.noAnalysisSub}</p>
        {en.notes && <p style={{ margin: '0 auto 16px', maxWidth: 560, fontSize: 13, lineHeight: 1.6, color: T.text, background: 'rgba(var(--ov),.03)', borderRadius: 10, padding: 12, textAlign: 'start' }}>{en.notes}</p>}
        {onEnrich && <button type="button" className="lc-act" disabled={enriching} onClick={() => onEnrich(lead)} style={{ background: 'linear-gradient(135deg,var(--au-brand),var(--au-brand-deep))', color: '#fff', border: 'none', height: 40, padding: '0 18px', fontSize: 13.5 }}>
          {enriching ? <FaSyncAlt size={12} style={{ animation: 'lc-spin 1s linear infinite' }}/> : <FaMagic size={12}/>}{enriching ? t.analyzing : t.analyze}</button>}
      </div>
    </Section>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: enriching ? .6 : 1, transition: 'opacity .2s' }}>
      <Section title={t.tabs.analysis} icon={FaChartPie} right={<span style={{ fontSize: 11.5, color: T.text3 }}>{t.analyzedAt(fmtWhen(en.enrichedAt, lang))}</span>}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <ScoreRing score={en.score100} grade={en.grade}/>
          <div style={{ flex: '1 1 260px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: GRADE_COLOR[en.grade] }}>{t.gradeName[en.grade]}</span>
              <span style={{ fontSize: 12, color: T.text3 }}>{t.rules} {en.ruleScore}{en.adjustment ? ` · ${t.aiAdj} ${en.adjustment > 0 ? '+' : ''}${en.adjustment}` : ''}</span>
              {b.confidence && <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text2, background: 'rgba(var(--ov),.05)', borderRadius: 20, padding: '2px 9px' }}>{t.conf[b.confidence]}</span>}
            </div>
            {(b.summary || en.scoreReason) && <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: T.text }}>{b.summary || en.scoreReason}</p>}
            {b.scoreAdjustmentReason && en.adjustment !== 0 && <div style={{ fontSize: 12, color: T.text3 }}>{t.aiAdj}: {b.scoreAdjustmentReason}</div>}
          </div>
        </div>
        {en.aiError && (
          <div role="status" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '9px 12px', borderRadius: 10, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', fontSize: 12.5, color: T.amberText }}>
            <FaInfoCircle size={12} style={{ flexShrink: 0, marginTop: 2 }}/><span>{t.aiOff} {en.aiError}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {[
            [t.signals.budget, sig.budget ? shekel(sig.budget) : (b.budgetRange && b.budgetRange)],
            [t.signals.dealType, t.dt[sig.dealType] || (b.dealType && t.dt[b.dealType])],
            [t.signals.timeline, t.tl[sig.timeline]],
            [t.signals.financing, t.fin[sig.financing]],
            [t.signals.inbound, sig.inbound || null],
            [t.signals.repeats, sig.repeats || null],
            [t.signals.listing, sig.listingPrice ? shekel(sig.listingPrice) : null],
          ].filter(x => x[1]).map(([k, v]) => (
            <span key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline', padding: '6px 10px', borderRadius: 10, background: 'rgba(var(--ov),.04)', border: `1px solid ${T.divider}`, fontSize: 12 }}><span style={{ color: T.text3 }}>{k}</span><b style={{ color: T.text }}>{v}</b></span>
          ))}
        </div>
      </Section>

      {nextText && (
        <Section title={t.next} icon={FaBullseye}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1.55 }}>{nextText}</p>
          {(b.bestTimeToContact || en.bestHour != null) && <div style={{ fontSize: 12.5, color: T.text3, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}><FaClock size={10}/>{t.bestTime}: {b.bestTimeToContact || `${String(en.bestHour).padStart(2, '0')}:00`}</div>}
          {b.suggestedMessage && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.text2, marginBottom: 6 }}>{t.msgSuggest}</div>
              <div dir="auto" style={{ background: '#DCF8C6', color: '#111B21', borderRadius: '12px 12px 4px 12px', padding: '10px 12px', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', maxWidth: 520 }}>{b.suggestedMessage}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="lc-act" onClick={() => copyMsg(b.suggestedMessage)} style={{ background: 'rgba(var(--ov),.05)', color: T.text2, border: `1px solid ${T.s1Line}` }}><FaCopy size={10}/>{copied ? t.copied : t.copy}</button>
                {onOpenChat && lead.phone && <button type="button" className="lc-act" onClick={() => { copyMsg(b.suggestedMessage); onOpenChat(lead); onClose() }} style={{ background: 'rgba(37,211,102,.12)', color: '#1FAF55', border: '1px solid rgba(37,211,102,.35)' }}><FaWhatsapp size={12}/>{t.openChat}</button>}
              </div>
            </div>
          )}
        </Section>
      )}

      <Section title={t.why} icon={FaChartPie}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {factorGroups.map(([g, list]) => {
            const sum = list.reduce((n, f) => n + f.points, 0)
            return (
              <div key={g}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: T.text2, flex: 1 }}>{t.groups[g] || g}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: sum >= 0 ? '#22C55E' : '#EF4444', fontVariantNumeric: 'tabular-nums' }}>{sum > 0 ? '+' : ''}{sum}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {list.map(f => (
                    <span key={f.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 8, fontSize: 12, background: f.points > 0 ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: T.text, border: `1px solid ${f.points > 0 ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}` }}>
                      {f.points > 0 ? <FaArrowUp size={8} style={{ color: '#22C55E' }}/> : <FaArrowDown size={8} style={{ color: '#EF4444' }}/>}{lang === 'en' ? f.en : f.he}<b style={{ fontVariantNumeric: 'tabular-nums', color: f.points > 0 ? '#16A34A' : '#DC2626' }}>{f.points > 0 ? '+' : ''}{f.points}</b>
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {(b.persona || b.motivation || askList.length || b.talkingPoints?.length || b.objections?.length || b.risks?.length || b.keyNeeds?.length) && (
        <Section title={t.brief} icon={FaLightbulb}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(b.persona || b.motivation) && (
              <div className="lc-grid2">
                {b.persona && <div><div style={{ fontSize: 12, fontWeight: 800, color: T.text3, marginBottom: 4 }}>{t.persona}</div><div style={{ fontSize: 13, color: T.text, lineHeight: 1.55 }}>{b.persona}</div></div>}
                {b.motivation && <div><div style={{ fontSize: 12, fontWeight: 800, color: T.text3, marginBottom: 4 }}>{t.motivation}</div><div style={{ fontSize: 13, color: T.text, lineHeight: 1.55 }}>{b.motivation}</div></div>}
              </div>
            )}
            <ListBlock title={t.ask} icon={FaQuestionCircle} items={askList} color="#60A5FA"/>
            <ListBlock title={t.points} icon={FaComments} items={b.talkingPoints} color="var(--au-brand-text)"/>
            <ListBlock title={t.needs} icon={FaBullseye} items={b.keyNeeds} color="#22C55E"/>
            <ListBlock title={t.objections} icon={FaShieldAlt} items={b.objections} color="#F59E0B"/>
            <ListBlock title={t.risks} icon={FaExclamationTriangle} items={b.risks} color="#EF4444"/>
          </div>
        </Section>
      )}
    </div>
  )

  // ── Side column: at-a-glance ──────────────────────────────────────────────
  const side = (
    <aside className="lc-side" style={{ borderInlineStart: `1px solid ${T.line}`, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, background: 'rgba(var(--ov),.015)' }}>
      {isV2 && (
        <button type="button" onClick={() => setTab('analysis')} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 12, borderRadius: 12, border: `1px solid ${T.s1Line}`, background: T.card, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start', color: T.text }}>
          <ScoreRing score={en.score100} grade={en.grade} size={58}/>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: GRADE_COLOR[en.grade] }}>{t.gradeName[en.grade]}</span>
            <span style={{ display: 'block', fontSize: 12, color: T.text2, lineHeight: 1.45 }}>{nextText.slice(0, 90)}</span>
          </span>
        </button>
      )}
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.text3, marginBottom: 8 }}>{t.sec.source}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip color={sourceColor(src)}>{sourceLabel(src, lang)}</Chip>
        </div>
        {lead.campaignName && <div style={{ fontSize: 12.5, color: T.text2, marginTop: 8 }}>{t.campaign}: <b style={{ color: T.text }}>{lead.campaignName}</b></div>}
        {lead.formName && <div style={{ fontSize: 12.5, color: T.text2, marginTop: 4 }}>{t.form}: <b style={{ color: T.text }}>{lead.formName}</b></div>}
        {Array.isArray(lead.formAnswers) && lead.formAnswers.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text3 }}>{t.answers}</div>
            {lead.formAnswers.map((x, i) => <div key={i} style={{ fontSize: 12.5, color: T.text, lineHeight: 1.5 }}><span style={{ color: T.text3 }}>{x.q}:</span> {x.a}</div>)}
          </div>
        )}
        {originLines(lead.origin, lang).length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {originLines(lead.origin, lang).map((x, i) => <div key={i} dir="ltr" style={{ fontSize: 11.5, color: T.text3, wordBreak: 'break-all', textAlign: dir === 'rtl' ? 'right' : 'left' }}><span style={{ color: T.text2 }}>{x.q}:</span> {x.a}</div>)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: T.text2 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FaCalendarAlt size={10}/>{t.created}: {fmtWhen(lead.ts, lang)}</span>
        {lead.followUp && <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: Date.parse(lead.followUp) < Date.now() ? '#EF4444' : T.text2 }}><FaClock size={10}/>{t.f.followUp}: {fmtWhen(Date.parse(lead.followUp), lang)}</span>}
        {(lead.area || lead.propLocation) && <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FaMapMarkerAlt size={10}/>{lead.area || lead.propLocation}</span>}
        {lead.budget ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FaBullseye size={10}/>{shekel(lead.budget)}</span> : null}
        {!!openTasks && <button type="button" onClick={() => setTab('tasks')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, color: T.brandText, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700 }}><FaTasks size={10}/>{openTasks} {t.tabs.tasks}</button>}
        {tags.length > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><FaTag size={10}/>{tags.map(g => <Chip key={g}>{g}</Chip>)}</span>}
      </div>
    </aside>
  )

  return createPortal(
    <div className="lc" dir={dir} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 2400, background: 'var(--au-overlay)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'min(3vh,24px) 12px' }}>
      <style>{CSS}</style>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="lc-title" className="lc-dialog"
        style={{ width: 'min(1180px,100%)', height: 'min(880px,100%)', background: T.s2, border: `1px solid ${T.s2Line}`, borderRadius: 18, boxShadow: T.shadow2, color: T.text, display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none', animation: 'lc-in .22s cubic-bezier(.2,.8,.2,1) both' }}>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${stage.color}, ${stage.color}88)`, flexShrink: 0 }}/>
        {header}
        {tabBar}
        <div className="lc-body">
          <div className="lc-main" style={{ overflowY: 'auto', padding: 16, background: T.bg }}>
            {tab === 'details' ? details : tab === 'notes' ? notesTab : tab === 'tasks' ? tasksTab : analysis}
          </div>
          {side}
        </div>
      </div>
    </div>,
    document.body,
  )
}
