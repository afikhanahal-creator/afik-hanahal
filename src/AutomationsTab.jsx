// ─── ADMIN: WhatsApp automations ("אוטומציות") ─────────────────────────────────
// Everything the sales team needs to message interested people without typing the same text again:
//   סקירה      – Green API connection check, master switch, numbers, test message
//   לאישור     – the approval queue: messages the rules prepared (no reply, "yes", "no thanks", stage…)
//   תבניות     – the message library (Hebrew + English), editable, with placeholders
//   כללים      – when each message goes out: off / waits for approval / automatic, quiet hours
//   שליחה מרובה – one template to many leads, personalised, skipping people who opted out
//   יומן       – every message the system sent or failed to send
// Server side: lib/automations.js through /api/meta/auto-*. Shared logic: lib/automations-shared.js.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { FaWhatsapp, FaRobot, FaCheck, FaTimes, FaPaperPlane, FaSyncAlt, FaCopy, FaPlus, FaTrash, FaUndo, FaSearch, FaBolt, FaClock, FaListUl, FaHistory, FaSlidersH, FaUsers, FaCommentDots, FaExclamationTriangle } from 'react-icons/fa'
import { DEFAULT_CONFIG, DEFAULT_TEMPLATES, CATEGORIES, VARIABLES, STAGES, RULE_LABELS, templateList, renderTemplate, mergeConfig, leadLang, intlPhone, ruleKind, isSendWindow } from '../lib/automations-shared.js'

import { autoApi } from './AutomationsApi.jsx'

const TR = {
  he: {
    title: 'אוטומציות וואטסאפ', subtitle: 'הודעות מוכנות לכל מתעניין · שליחה בלחיצה או אוטומטית',
    tabs: { overview: 'סקירה', queue: 'לאישור', templates: 'תבניות', rules: 'כללים', broadcast: 'שליחה מרובה', log: 'יומן' },
    connection: 'חיבור Green API', connected: 'מחובר ופועל', notConnected: 'לא מחובר', checking: 'בודק…', notConfigured: 'חסרים משתנים ב-Vercel',
    notAuthorized: 'המכשיר לא מחובר – סרקו QR בלוח של Green API', blocked: 'המספר חסום', yellowCard: 'מוגבל זמנית ע״י וואטסאפ', errorState: 'שגיאה בבדיקה',
    number: 'מספר מחובר', instance: 'Instance', recheck: 'בדוק שוב', sendTest: 'שלח הודעת בדיקה למשרד', testSent: 'הודעת הבדיקה נשלחה ✓',
    master: 'מערכת האוטומציות', on: 'פעילה', off: 'כבויה',
    pending: 'ממתינות לאישור', sent7: 'נשלחו ב-7 ימים', positive: 'ענו בחיוב', negative: 'ביקשו להפסיק', failed: 'נכשלו',
    runNow: 'הרץ עכשיו', lastRun: 'ריצה אחרונה', runsEvery: 'המערכת רצה אוטומטית כל 5 דקות כשהפאנל פתוח, ופעם ביום גם בלעדיו.',
    storageMissing: 'כדי לשמור שינויים ויומן מלא צריך להריץ פעם אחת את הקובץ server/automations-migration.sql ב-Supabase (SQL Editor). עד אז המערכת עובדת עם הגדרות ברירת המחדל.',
    flow: 'איך זה עובד', flowSteps: ['ליד משאיר פרטים', 'הודעת פתיחה מיידית', 'לא ענה? תזכורת אחרי 24 שעות', 'עוד 48 שעות – ערך נוסף', 'עוד 96 שעות – ניסיון אחרון'],
    flowReplies: 'כשהלקוח עונה – המעקב נעצר. "כן / מעוניין" → התראה לצוות + הודעת המשך. "לא תודה" → המערכת מפסיקה לשלוח לו.',
    windowOpen: 'עכשיו בתוך שעות השליחה', windowClosed: 'עכשיו מחוץ לשעות השליחה – הודעות מתוזמנות ימתינו',
    queueEmpty: 'אין הודעות שממתינות לאישור 🎉', send: 'שלח', skip: 'דלג', sendAll: 'שלח הכל', openChat: 'פתח צ׳אט', sending: 'שולח…',
    sentOk: 'נשלח ✓', edited: 'נערך', allKinds: 'הכל',
    templates: 'תבניות', newTemplate: 'תבנית חדשה', edit: 'עריכה', copy: 'העתק', copied: 'הועתק', duplicate: 'שכפל', del: 'מחק', reset: 'שחזר מקור', save: 'שמור', cancel: 'ביטול', saving: 'שומר…', saved: 'נשמר ✓',
    titleHe: 'שם התבנית (עברית)', titleEn: 'שם התבנית (אנגלית)', textHe: 'טקסט בעברית', textEn: 'טקסט באנגלית (ללידים מהאתר באנגלית)', category: 'קטגוריה', vars: 'משתנים – לחצו כדי להוסיף',
    preview: 'תצוגה מקדימה', previewFor: 'עבור', sampleLead: 'ליד לדוגמה', sendTo: 'שלח ל…', searchLead: 'חיפוש ליד לפי שם או טלפון',
    modeOff: 'כבוי', modeSuggest: 'לאישור', modeAuto: 'אוטומטי', modeHint: 'לאישור = ההודעה מחכה בלשונית "לאישור" ונשלחת בלחיצה · אוטומטי = נשלחת לבד',
    welcomeRule: 'הודעת פתיחה לליד חדש', welcomeTpl: 'תבנית רגילה', welcomePropTpl: 'כשהליד התעניין בנכס מסוים',
    noReplyRule: 'לא ענה – רצף תזכורות', step: 'שלב', afterHours: 'שעות אחרי ההודעה הקודמת', addStep: 'הוסף שלב', onlyStages: 'רק ללידים בשלבים',
    repliesRule: 'זיהוי תשובות', notifyTeam: 'התראה לצוות בוואטסאפ', negWords: 'מילים של "לא תודה"', posWords: 'מילים של "רוצה להתקדם"', commaSep: 'מופרד בפסיקים',
    onNegative: 'כשענה "לא תודה"', onPositive: 'כשענה בחיוב', moveTo: 'העבר לשלב', noMove: 'אל תזיז',
    stageRule: 'הודעה בשינוי שלב בלוח', stage: 'שלב', template: 'תבנית', reengageRule: 'חזרה ללקוח "ללא מענה"', afterDays: 'ימים בשלב',
    quiet: 'שעות שליחה (שעון ישראל)', quietHint: 'תזכורות ומעקבים נשלחים רק בשעות האלה. הודעת פתיחה ותשובה ללקוח נשלחות מיד.', closed: 'סגור',
    days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
    varsTitle: 'פרטי המשרד בהודעות', agentHe: 'שם הנציג (עברית)', agentEn: 'שם הנציג (אנגלית)', officePhone: 'טלפון המשרד', sellLink: 'קישור לטופס קליטת נכס',
    saveRules: 'שמור הגדרות', unsaved: 'יש שינויים שלא נשמרו',
    bcTemplate: 'בחרו תבנית', bcStages: 'שלבים', bcPeriod: 'תקופה', bcAll: 'הכל', bcDays: d => `${d} ימים`, bcSkipSent: 'דלג על מי שכבר קיבל את התבנית הזו',
    bcSelected: n => `${n} נבחרו`, bcSend: n => `שלח ל-${n} לידים`, bcConfirm: n => `לשלוח עכשיו ${n} הודעות וואטסאפ?`, bcDone: (ok, bad) => `נשלחו ${ok}${bad ? ` · נכשלו ${bad}` : ''}`,
    selectAll: 'בחר הכל', clear: 'נקה', optedOut: 'ביקש להפסיק', noPhone: 'אין טלפון', progress: 'התקדמות',
    logEmpty: 'עוד לא נשלחו הודעות', logAll: 'הכל', logOk: 'נשלחו', logFailed: 'נכשלו', by: { auto: 'אוטומטי', cron: 'אוטומטי (לילה)', manual: 'ידני' },
    kind: { welcome: 'פתיחה', noreply: 'לא ענה', reply: 'תשובה', stage: 'שלב', reengage: 'חזרה', manual: 'ידני', tpl: 'שליחה מרובה', test: 'בדיקה' },
    unoptout: 'החזר לקבלת הודעות', error: 'שגיאה',
  },
  en: {
    title: 'WhatsApp automations', subtitle: 'Ready-made messages for every inquiry · one click or fully automatic',
    tabs: { overview: 'Overview', queue: 'To approve', templates: 'Templates', rules: 'Rules', broadcast: 'Bulk send', log: 'Log' },
    connection: 'Green API connection', connected: 'Connected and working', notConnected: 'Not connected', checking: 'Checking…', notConfigured: 'Missing Vercel variables',
    notAuthorized: 'Phone not linked – scan the QR code in the Green API console', blocked: 'Number blocked', yellowCard: 'Temporarily limited by WhatsApp', errorState: 'Check failed',
    number: 'Linked number', instance: 'Instance', recheck: 'Check again', sendTest: 'Send a test message to the office', testSent: 'Test message sent ✓',
    master: 'Automation system', on: 'On', off: 'Off',
    pending: 'Waiting for approval', sent7: 'Sent in 7 days', positive: 'Replied positively', negative: 'Asked to stop', failed: 'Failed',
    runNow: 'Run now', lastRun: 'Last run', runsEvery: 'The system runs every 5 minutes while the panel is open, and once a day without it.',
    storageMissing: 'To save changes and keep a full log, run server/automations-migration.sql once in Supabase (SQL Editor). Until then the system works with the default settings.',
    flow: 'How it works', flowSteps: ['Lead leaves details', 'Instant welcome message', 'No reply? Reminder after 24h', '48h later – added value', '96h later – last try'],
    flowReplies: 'When the lead replies, follow-ups stop. "Yes / interested" → team alert + next-step message. "No thanks" → the system stops messaging them.',
    windowOpen: 'Inside sending hours now', windowClosed: 'Outside sending hours – scheduled messages will wait',
    queueEmpty: 'Nothing waiting for approval 🎉', send: 'Send', skip: 'Skip', sendAll: 'Send all', openChat: 'Open chat', sending: 'Sending…',
    sentOk: 'Sent ✓', edited: 'Edited', allKinds: 'All',
    templates: 'Templates', newTemplate: 'New template', edit: 'Edit', copy: 'Copy', copied: 'Copied', duplicate: 'Duplicate', del: 'Delete', reset: 'Restore original', save: 'Save', cancel: 'Cancel', saving: 'Saving…', saved: 'Saved ✓',
    titleHe: 'Template name (Hebrew)', titleEn: 'Template name (English)', textHe: 'Hebrew text', textEn: 'English text (for leads from the English site)', category: 'Category', vars: 'Placeholders – click to insert',
    preview: 'Preview', previewFor: 'for', sampleLead: 'Sample lead', sendTo: 'Send to…', searchLead: 'Search a lead by name or phone',
    modeOff: 'Off', modeSuggest: 'Approve', modeAuto: 'Automatic', modeHint: 'Approve = the message waits in "To approve" and goes out with one click · Automatic = sent by the system',
    welcomeRule: 'Welcome message to a new lead', welcomeTpl: 'Default template', welcomePropTpl: 'When the lead asked about a specific property',
    noReplyRule: 'No reply – reminder sequence', step: 'Step', afterHours: 'hours after the previous message', addStep: 'Add step', onlyStages: 'Only for leads in stages',
    repliesRule: 'Reply detection', notifyTeam: 'WhatsApp alert to the team', negWords: '"No thanks" words', posWords: '"Wants to move forward" words', commaSep: 'comma separated',
    onNegative: 'When they reply "no thanks"', onPositive: 'When they reply positively', moveTo: 'Move to stage', noMove: 'Do not move',
    stageRule: 'Message on board stage change', stage: 'Stage', template: 'Template', reengageRule: 'Re-engage "no answer" leads', afterDays: 'days in stage',
    quiet: 'Sending hours (Israel time)', quietHint: 'Reminders and follow-ups go out only during these hours. Welcome messages and replies are sent right away.', closed: 'Closed',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    varsTitle: 'Office details used in messages', agentHe: 'Agent name (Hebrew)', agentEn: 'Agent name (English)', officePhone: 'Office phone', sellLink: 'Property intake form link',
    saveRules: 'Save settings', unsaved: 'You have unsaved changes',
    bcTemplate: 'Choose a template', bcStages: 'Stages', bcPeriod: 'Period', bcAll: 'All', bcDays: d => `${d} days`, bcSkipSent: 'Skip leads who already got this template',
    bcSelected: n => `${n} selected`, bcSend: n => `Send to ${n} leads`, bcConfirm: n => `Send ${n} WhatsApp messages now?`, bcDone: (ok, bad) => `Sent ${ok}${bad ? ` · failed ${bad}` : ''}`,
    selectAll: 'Select all', clear: 'Clear', optedOut: 'Opted out', noPhone: 'No phone', progress: 'Progress',
    logEmpty: 'No messages sent yet', logAll: 'All', logOk: 'Sent', logFailed: 'Failed', by: { auto: 'Automatic', cron: 'Automatic (nightly)', manual: 'Manual' },
    kind: { welcome: 'Welcome', noreply: 'No reply', reply: 'Reply', stage: 'Stage', reengage: 'Re-engage', manual: 'Manual', tpl: 'Bulk', test: 'Test' },
    unoptout: 'Allow messages again', error: 'Error',
  },
}

const STAGE_DEFAULT = { new: { he: 'ליד חדש', en: 'New lead' }, contacted: { he: 'ניצור קשר', en: 'Contacted' }, discovery: { he: 'גילוי', en: 'Discovery' }, negotiating: { he: 'במו"מ', en: 'Negotiating' }, won: { he: 'סגירה', en: 'Closed won' }, lost: { he: 'ללא מענה', en: 'No answer' } }
const KIND_COLOR = { welcome: '#22C55E', noreply: '#F5A623', reply: '#0073EA', stage: '#A25DDC', reengage: '#60D4F7', manual: '#8490D8', tpl: '#8490D8', test: '#9A9AA8' }
const fmtDT = (iso, lang) => { try { return new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const clone = o => JSON.parse(JSON.stringify(o))

// Admin leads are flat objects (crm_data spread onto the lead). Map to the shape the renderer expects.
const asLead = l => ({ id: l.id, name: l.name, phone: l.phone, prop_title: l.propTitle || l.prop_title, prop_location: l.propLocation || l.prop_location, crm_data: { origin: l.origin || l.crm_data?.origin || {} } })

export default function AutomationsTab({ C, lang = 'he', leads = [], stageLabels = {}, config, onConfigSaved, runResult, onRun, running, onOpenChat, initialSub }) {
  const t = TR[lang] || TR.he
  const purple = C?.purple || '#8490D8'
  const cream = C?.cream || '#E8E4D8'
  const isEn = lang === 'en'
  const card = { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(132,144,216,.14)', borderRadius: 14 }
  const btn = (extra = {}) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, border: '1px solid rgba(132,144,216,.3)', background: 'rgba(132,144,216,.1)', color: purple, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0, minWidth: 0, whiteSpace: 'nowrap', ...extra })
  const input = { width: '100%', padding: '9px 11px', borderRadius: 9, border: '1px solid rgba(132,144,216,.22)', background: 'rgba(255,255,255,.04)', color: cream, fontFamily: 'inherit', fontSize: 13, outline: 'none', boxSizing: 'border-box', minHeight: 0 }
  const green = '#25D366'

  const [sub, setSub] = useState(initialSub || 'overview')
  const [draft, setDraft] = useState(() => clone(config?.config || DEFAULT_CONFIG))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState('')
  const [status, setStatus] = useState(null)
  const [log, setLog] = useState(null)
  const [states, setStates] = useState({})
  const [toast, setToast] = useState('')
  const toastT = useRef(null)
  const flash = msg => { setToast(msg); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), 3200) }

  useEffect(() => { if (config?.config && !dirty) setDraft(clone(config.config)) }, [config]) // eslint-disable-line react-hooks/exhaustive-deps
  const cfg = useMemo(() => mergeConfig(draft), [draft])
  const tpls = useMemo(() => templateList(cfg), [cfg])
  const tplName = id => { const x = tpls.find(y => y.id === id); return x ? (isEn ? x.en_title || x.he_title : x.he_title || x.en_title) : id }
  const stageName = s => (isEn ? stageLabels?.[s]?.en : stageLabels?.[s]?.label) || STAGE_DEFAULT[s]?.[isEn ? 'en' : 'he'] || s
  const setCfg = fn => { setDraft(d => { const n = clone(d); fn(n); return n }); setDirty(true) }

  const loadStatus = useCallback(() => { setStatus(null); autoApi.get('auto-status').then(setStatus).catch(e => setStatus({ state: 'error', error: e.message })) }, [])
  const loadLog = useCallback(() => { autoApi.get('auto-log?limit=200').then(setLog).catch(e => setLog({ rows: [], error: e.message })) }, [])
  const loadStates = useCallback(() => { autoApi.get('auto-leads').then(arr => setStates(Object.fromEntries((arr || []).map(s => [s.leadId, s])))).catch(() => {}) }, [])
  useEffect(() => { loadStatus(); loadLog(); loadStates() }, [loadStatus, loadLog, loadStates])

  const save = async () => {
    setSaving('saving')
    try { await autoApi.post('auto-config', { config: draft }); setDirty(false); setSaving('saved'); flash(t.saved); onConfigSaved?.(draft); setTimeout(() => setSaving(''), 1500) }
    catch (e) { setSaving(''); flash(`${t.error}: ${e.message}`) }
  }
  // Template edits are saved immediately (a template is a self-contained edit)
  const saveTemplates = async (mutate) => {
    const next = clone(draft); mutate(next)
    setDraft(next)
    try { await autoApi.post('auto-config', { config: next }); onConfigSaved?.(next); flash(t.saved) }
    catch (e) { setDirty(true); flash(`${t.error}: ${e.message}`) }
  }

  const queue = runResult?.suggestions || []
  const logRows = log?.rows || []
  const weekAgo = Date.now() - 7 * 864e5
  const stats = {
    pending: queue.length,
    sent7: logRows.filter(r => r.ok && new Date(r.created_at).getTime() > weekAgo && r.rule_key !== 'test').length,
    failed7: logRows.filter(r => !r.ok && new Date(r.created_at).getTime() > weekAgo).length,
    positive: Object.values(states).filter(s => s.intent === 'positive').length,
    negative: Object.values(states).filter(s => s.optOut).length,
  }

  const SUBS = [
    { id: 'overview', Icon: FaRobot }, { id: 'queue', Icon: FaListUl, badge: queue.length }, { id: 'templates', Icon: FaCommentDots },
    { id: 'rules', Icon: FaSlidersH, dot: dirty }, { id: 'broadcast', Icon: FaUsers }, { id: 'log', Icon: FaHistory },
  ]

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} style={{ display: 'flex', flexDirection: 'column', gap: 14, color: cream, maxWidth: 1180, margin: '0 auto', width: '100%' }}>
      <style>{`
        .au-tabs::-webkit-scrollbar{display:none}
        .au-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px}
        .au-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
        @media (max-width:900px){.au-stats{grid-template-columns:repeat(2,1fr)}}
        .au-row:hover{background:rgba(132,144,216,.06)}
        .au-bubble{white-space:pre-wrap;unicode-bidi:plaintext;line-height:1.55}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${green}33, ${purple}33)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${green}55` }}><FaRobot size={20} color={green}/></div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{t.title}</div>
          <div style={{ fontSize: 12.5, color: 'rgba(232,228,216,.55)' }}>{t.subtitle}</div>
        </div>
        <button onClick={() => { onRun?.(); loadLog(); loadStates() }} disabled={running} style={btn({ opacity: running ? .6 : 1 })}><FaSyncAlt size={11} className={running ? 'spin' : ''}/> {t.runNow}</button>
      </div>

      {config?.storage && config.storage !== 'ok' && (
        <div role="alert" style={{ ...card, padding: '11px 14px', borderColor: 'rgba(245,166,35,.45)', background: 'rgba(245,166,35,.08)', color: '#F5C26B', fontSize: 12.5, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <FaExclamationTriangle style={{ flexShrink: 0, marginTop: 2 }}/> <span>{t.storageMissing}</span>
        </div>
      )}

      {/* Sub tabs */}
      <div className="au-tabs" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {SUBS.map(({ id, Icon, badge, dot }) => (
          <button key={id} onClick={() => setSub(id)} style={btn({ padding: '9px 14px', flexShrink: 0, background: sub === id ? `${purple}30` : 'transparent', borderColor: sub === id ? purple : 'rgba(132,144,216,.18)', color: sub === id ? purple : 'rgba(232,228,216,.7)' })}>
            <Icon size={12}/> {t.tabs[id]}
            {!!badge && <span style={{ background: '#E05252', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10.5, fontWeight: 900 }}>{badge}</span>}
            {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F5A623' }}/>}
          </button>
        ))}
      </div>

      {sub === 'overview' && <Overview {...{ t, isEn, card, btn, status, loadStatus, cfg, setCfg, dirty, save, saving, stats, runResult, onGo: setSub, flash, green, purple }}/>}
      {sub === 'queue' && <Queue {...{ t, isEn, card, btn, input, queue, stageName, tplName, onRun, onOpenChat, leads, flash, green, purple, reload: () => { loadLog(); loadStates() } }}/>}
      {sub === 'templates' && <Templates {...{ t, isEn, card, btn, input, cfg, tpls, leads, saveTemplates, flash, green, purple, cream, onSent: () => { loadLog(); loadStates() } }}/>}
      {sub === 'rules' && <Rules {...{ t, isEn, card, btn, input, cfg, setCfg, tpls, tplName, stageName, dirty, save, saving, purple, green }}/>}
      {sub === 'broadcast' && <Broadcast {...{ t, isEn, card, btn, input, cfg, tpls, leads, states, stageName, flash, green, purple, onDone: () => { loadLog(); loadStates() } }}/>}
      {sub === 'log' && <Log {...{ t, isEn, card, btn, log, loadLog, tplName, states, loadStates, leads, purple }}/>}

      {toast && <div style={{ position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 3000, background: '#1B2330', border: `1px solid ${purple}66`, color: cream, padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, boxShadow: '0 12px 32px rgba(0,0,0,.45)' }}>{toast}</div>}
    </div>
  )
}

// ── Mode switch: off / approve / automatic ─────────────────────────────────────
function ModeSwitch({ value, onChange, t, purple, onOff = false }) {
  const opts = onOff ? [['off', t.modeOff, '#9A9AA8'], ['auto', t.on, '#22C55E']] : [['off', t.modeOff, '#9A9AA8'], ['suggest', t.modeSuggest, '#F5A623'], ['auto', t.modeAuto, '#22C55E']]
  return (
    <div role="radiogroup" style={{ display: 'inline-flex', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(132,144,216,.2)', borderRadius: 9, padding: 2, gap: 2 }}>
      {opts.map(([v, l, c]) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          style={{ padding: '5px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, minHeight: 0, minWidth: 0, background: value === v ? `${c}2A` : 'transparent', color: value === v ? c : 'rgba(232,228,216,.5)' }}>{l}</button>
      ))}
    </div>
  )
}

function Section({ title, icon, children, card, right }) {
  return (
    <div style={{ ...card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {icon}<div style={{ fontSize: 14.5, fontWeight: 800, flex: 1 }}>{title}</div>{right}
      </div>
      {children}
    </div>
  )
}

// ── Overview ───────────────────────────────────────────────────────────────────
function Overview({ t, isEn, card, btn, status, loadStatus, cfg, setCfg, dirty, save, saving, stats, runResult, onGo, flash, green, purple }) {
  const [testing, setTesting] = useState(false)
  const st = status?.state
  const ok = st === 'authorized'
  const label = !status ? t.checking : ok ? t.connected : st === 'notConfigured' ? t.notConfigured : st === 'notAuthorized' ? t.notAuthorized : st === 'blocked' ? t.blocked : st === 'yellowCard' ? t.yellowCard : st === 'error' ? t.errorState : `${t.notConnected} (${st})`
  const color = !status ? '#9A9AA8' : ok ? '#22C55E' : st === 'notAuthorized' || st === 'yellowCard' ? '#F5A623' : '#E05252'
  const phone = status?.phone ? `+${status.phone}` : ''
  const test = async () => {
    setTesting(true)
    try { await autoApi.post('auto-test', {}); flash(t.testSent) } catch (e) { flash(`${t.error}: ${e.message}`) } finally { setTesting(false) }
  }
  const inWindow = isSendWindow(cfg)
  const S = ({ n, l, c, go }) => (
    <button onClick={go} style={{ ...card, padding: '14px 12px', textAlign: 'center', cursor: go ? 'pointer' : 'default', fontFamily: 'inherit', color: 'inherit', minHeight: 0 }}>
      <div style={{ fontSize: 26, fontWeight: 900, color: c, lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 11.5, color: 'rgba(232,228,216,.6)', marginTop: 4 }}>{l}</div>
    </button>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Section card={card} title={t.connection} icon={<FaWhatsapp color={green} size={17}/>} right={<button onClick={loadStatus} style={btn({ padding: '5px 10px', fontSize: 11.5 })}><FaSyncAlt size={10}/> {t.recheck}</button>}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: ok ? `0 0 0 5px ${color}26` : 'none', flexShrink: 0 }}/>
            <div style={{ fontSize: 15, fontWeight: 800, color }}>{label}</div>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5, color: 'rgba(232,228,216,.7)' }}>
            {phone && <span>{t.number}: <b dir="ltr" style={{ color: '#E8E4D8' }}>{phone}</b></span>}
            {status?.instance && <span>{t.instance}: <b dir="ltr" style={{ color: '#E8E4D8' }}>{status.instance}</b></span>}
            {status?.missing?.length ? <span dir="ltr" style={{ color: '#E05252' }}>{status.missing.join(', ')}</span> : null}
            {status?.error && <span style={{ color: '#E05252' }}>{status.error}</span>}
          </div>
          <button onClick={test} disabled={!ok || testing} style={btn({ alignSelf: 'flex-start', opacity: ok && !testing ? 1 : .5, background: `${green}1F`, borderColor: `${green}66`, color: green })}><FaPaperPlane size={11}/> {testing ? t.sending : t.sendTest}</button>
        </Section>
        <Section card={card} title={t.master} icon={<FaBolt color="#F5A623" size={15}/>} right={
          <button onClick={() => setCfg(c => { c.enabled = !c.enabled })} role="switch" aria-checked={cfg.enabled} style={{ width: 52, height: 28, borderRadius: 20, border: 'none', cursor: 'pointer', background: cfg.enabled ? '#22C55E' : 'rgba(255,255,255,.15)', position: 'relative', minHeight: 0, minWidth: 0, flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 3, [isEn ? 'left' : 'right']: cfg.enabled ? 27 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'all .2s' }}/>
          </button>}>
          <div style={{ fontSize: 15, fontWeight: 800, color: cfg.enabled ? '#22C55E' : '#9A9AA8' }}>{cfg.enabled ? t.on : t.off}</div>
          <div style={{ fontSize: 12, color: inWindow ? '#22C55E' : '#F5A623', display: 'flex', alignItems: 'center', gap: 6 }}><FaClock size={11}/> {inWindow ? t.windowOpen : t.windowClosed}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(232,228,216,.5)' }}>{t.runsEvery}{runResult?.at ? ` · ${t.lastRun}: ${fmtDT(runResult.at, isEn ? 'en' : 'he')}` : ''}</div>
          {dirty && <button onClick={save} style={btn({ alignSelf: 'flex-start', background: '#F5A6231F', borderColor: '#F5A62366', color: '#F5A623' })}><FaCheck size={11}/> {saving === 'saving' ? t.saving : t.saveRules}</button>}
        </Section>
      </div>

      <div className="au-stats">
        <S n={stats.pending} l={t.pending} c="#F5A623" go={() => onGo('queue')}/>
        <S n={stats.sent7} l={t.sent7} c="#22C55E" go={() => onGo('log')}/>
        <S n={stats.positive} l={t.positive} c="#0073EA"/>
        <S n={stats.negative} l={t.negative} c="#9A9AA8"/>
        <S n={stats.failed7} l={t.failed} c={stats.failed7 ? '#E05252' : '#9A9AA8'} go={() => onGo('log')}/>
      </div>

      <Section card={card} title={t.flow} icon={<FaRobot color={purple} size={15}/>}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
          {t.flowSteps.map((s, i) => (
            <div key={i} style={{ flex: '1 1 150px', padding: '10px 12px', borderRadius: 10, background: i === 0 ? 'rgba(132,144,216,.1)' : i === 1 ? 'rgba(34,197,94,.1)' : 'rgba(245,166,35,.08)', border: `1px solid ${i === 0 ? 'rgba(132,144,216,.3)' : i === 1 ? 'rgba(34,197,94,.3)' : 'rgba(245,166,35,.25)'}`, fontSize: 12.5, fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>{i + 1}</span>{s}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(232,228,216,.7)', lineHeight: 1.6 }}>{t.flowReplies}</div>
      </Section>
    </div>
  )
}

// ── Approval queue ─────────────────────────────────────────────────────────────
function Queue({ t, isEn, card, btn, input, queue, stageName, tplName, onRun, onOpenChat, leads, flash, green, purple, reload }) {
  const [texts, setTexts] = useState({})
  const [busy, setBusy] = useState({})
  const [done, setDone] = useState({})
  const [kind, setKind] = useState('all')
  const items = queue.filter(q => !done[q.id]).filter(q => kind === 'all' || q.kind === kind)
  const kinds = [...new Set(queue.map(q => q.kind))]
  const reason = q => q.kind === 'stage' ? `${isEn ? 'Moved to' : 'עבר לשלב'} "${stageName(q.stageKey)}"` : (isEn ? q.reason?.en : q.reason?.he) || ''
  const act = async (q, what) => {
    setBusy(b => ({ ...b, [q.id]: what }))
    try {
      if (what === 'send') {
        const r = await autoApi.post('auto-send', { items: [{ leadId: q.leadId, phone: q.phone, text: texts[q.id] ?? q.text, ruleKey: q.ruleKey, templateId: q.templateId }] })
        const res = r.results?.[0]
        if (!res?.ok) throw new Error(res?.error || t.error)
        flash(t.sentOk)
      } else await autoApi.post('auto-skip', { leadId: q.leadId, ruleKey: q.ruleKey })
      setDone(d => ({ ...d, [q.id]: what }))
      reload()
    } catch (e) { flash(`${t.error}: ${e.message}`) }
    finally { setBusy(b => { const n = { ...b }; delete n[q.id]; return n }) }
  }
  const sendAll = async () => {
    if (!window.confirm(t.bcConfirm(items.length))) return
    for (const q of items) await act(q, 'send')
    onRun?.()
  }
  if (!queue.length || !items.length && kind === 'all') return <div style={{ ...card, padding: 40, textAlign: 'center', fontSize: 15, color: 'rgba(232,228,216,.6)' }}>{t.queueEmpty}</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all', ...kinds].map(k => (
          <button key={k} onClick={() => setKind(k)} style={btn({ padding: '5px 11px', fontSize: 11.5, borderRadius: 20, background: kind === k ? `${KIND_COLOR[k] || purple}26` : 'transparent', borderColor: kind === k ? (KIND_COLOR[k] || purple) : 'rgba(132,144,216,.2)', color: kind === k ? (KIND_COLOR[k] || purple) : 'rgba(232,228,216,.65)' })}>
            {k === 'all' ? t.allKinds : t.kind[k] || k} · {k === 'all' ? queue.filter(q => !done[q.id]).length : queue.filter(q => q.kind === k && !done[q.id]).length}
          </button>
        ))}
        <div style={{ flex: 1 }}/>
        {items.length > 1 && <button onClick={sendAll} style={btn({ background: `${green}1F`, borderColor: `${green}66`, color: green })}><FaPaperPlane size={11}/> {t.sendAll} ({items.length})</button>}
      </div>
      {items.map(q => {
        const lead = leads.find(l => String(l.id) === String(q.leadId))
        const txt = texts[q.id] ?? q.text
        const c = KIND_COLOR[q.kind] || purple
        return (
          <div key={q.id} style={{ ...card, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', borderInlineStart: `3px solid ${c}` }}>
            <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 14.5 }}>{q.name || q.phone}</b>
                <span dir="ltr" style={{ fontSize: 11.5, color: 'rgba(232,228,216,.5)' }}>+{q.phone}</span>
                <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: `${c}22`, color: c }}>{t.kind[q.kind] || q.kind}</span>
                {q.lang === 'en' && <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,.07)' }}>EN</span>}
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(232,228,216,.7)' }}>{reason(q)} · {tplName(q.templateId)}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <button onClick={() => act(q, 'send')} disabled={!!busy[q.id]} style={btn({ background: `${green}22`, borderColor: `${green}77`, color: green })}><FaPaperPlane size={11}/> {busy[q.id] === 'send' ? t.sending : t.send}</button>
                <button onClick={() => act(q, 'skip')} disabled={!!busy[q.id]} style={btn({ background: 'transparent', color: 'rgba(232,228,216,.65)', borderColor: 'rgba(232,228,216,.2)' })}><FaTimes size={11}/> {t.skip}</button>
                {onOpenChat && <button onClick={() => onOpenChat(lead || { id: `wa:${q.phone}`, name: q.name, phone: q.phone })} style={btn({ background: 'transparent' })}><FaWhatsapp size={12}/> {t.openChat}</button>}
              </div>
            </div>
            <div style={{ flex: '2 1 320px', minWidth: 0 }}>
              <textarea value={txt} onChange={e => setTexts(x => ({ ...x, [q.id]: e.target.value }))} rows={Math.min(8, Math.max(3, txt.split('\n').length + 1))} dir="auto"
                style={{ ...input, background: '#0B2A22', border: '1px solid rgba(37,211,102,.25)', color: '#E9EDEF', resize: 'vertical', lineHeight: 1.55, fontSize: 13.5 }}/>
              {texts[q.id] != null && texts[q.id] !== q.text && <div style={{ fontSize: 10.5, color: '#F5A623', marginTop: 3 }}>{t.edited}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Templates ──────────────────────────────────────────────────────────────────
function Templates({ t, isEn, card, btn, input, cfg, tpls, leads, saveTemplates, flash, green, purple, cream, onSent }) {
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)   // template object being edited (copy)
  const [sendFor, setSendFor] = useState(null)   // template to send
  const list = tpls.filter(x => cat === 'all' || x.cat === cat).filter(x => !q || `${x.he_title} ${x.en_title} ${x.he} ${x.en}`.toLowerCase().includes(q.toLowerCase()))
  const sample = asLead(leads.find(l => l.name && (l.propTitle || l.prop_title)) || leads.find(l => l.name) || { name: isEn ? 'Dana Cohen' : 'דנה כהן', propTitle: isEn ? 'Plot in Tel Mond' : 'מגרש בתל מונד' })
  const copy = async x => { try { await navigator.clipboard.writeText(renderTemplate(x, sample, cfg, isEn ? 'en' : 'he')); flash(t.copied) } catch {} }
  const removeTpl = x => {
    if (!window.confirm(`${t.del}: ${isEn ? x.en_title : x.he_title}?`)) return
    saveTemplates(c => { if (x.builtIn) c.deletedTemplates = [...new Set([...(c.deletedTemplates || []), x.id])]; else { c.templates = { ...(c.templates || {}) }; delete c.templates[x.id] } })
  }
  const resetTpl = x => saveTemplates(c => { c.templates = { ...(c.templates || {}) }; delete c.templates[x.id] })
  const edited = x => x.builtIn && !!cfg.templates?.[x.id]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {[{ id: 'all', he: 'הכל', en: 'All', color: purple, icon: '✨' }, ...CATEGORIES].map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} style={btn({ padding: '6px 12px', borderRadius: 20, fontSize: 12, background: cat === c.id ? `${c.color}26` : 'transparent', borderColor: cat === c.id ? c.color : 'rgba(132,144,216,.2)', color: cat === c.id ? c.color : 'rgba(232,228,216,.65)' })}>{c.icon} {isEn ? c.en : c.he}</button>
        ))}
        <div style={{ flex: 1 }}/>
        <div style={{ position: 'relative', width: 200 }}>
          <FaSearch size={11} style={{ position: 'absolute', top: 11, [isEn ? 'left' : 'right']: 10, opacity: .5 }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="…" style={{ ...input, [isEn ? 'paddingLeft' : 'paddingRight']: 28 }}/>
        </div>
        <button onClick={() => setEditing({ id: `c_${Date.now().toString(36)}`, cat: cat === 'all' ? 'general' : cat, he_title: '', en_title: '', he: '', en: '', builtIn: false, isNew: true })} style={btn({ background: `${green}1F`, borderColor: `${green}66`, color: green })}><FaPlus size={11}/> {t.newTemplate}</button>
      </div>
      <div className="au-grid">
        {list.map(x => {
          const c = CATEGORIES.find(k => k.id === x.cat) || CATEGORIES[5]
          return (
            <div key={x.id} style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{c.icon}</span>
                <b style={{ fontSize: 13.5, flex: 1, minWidth: 0 }}>{isEn ? x.en_title || x.he_title : x.he_title || x.en_title}</b>
                {edited(x) && <span style={{ fontSize: 10, color: '#F5A623', fontWeight: 800 }}>{t.edited}</span>}
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: `${c.color}22`, color: c.color }}>{isEn ? c.en : c.he}</span>
              </div>
              <div className="au-bubble" dir="auto" style={{ background: '#0B2A22', border: '1px solid rgba(37,211,102,.18)', color: '#E9EDEF', borderRadius: '10px 10px 10px 2px', padding: '9px 11px', fontSize: 12.5, maxHeight: 150, overflow: 'auto' }}>
                {renderTemplate(x, sample, cfg, isEn ? 'en' : 'he')}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <button onClick={() => setSendFor(x)} style={btn({ padding: '6px 10px', fontSize: 11.5, background: `${green}1F`, borderColor: `${green}66`, color: green })}><FaPaperPlane size={10}/> {t.sendTo}</button>
                <button onClick={() => setEditing({ ...x })} style={btn({ padding: '6px 10px', fontSize: 11.5 })}>{t.edit}</button>
                <button onClick={() => copy(x)} style={btn({ padding: '6px 10px', fontSize: 11.5, background: 'transparent' })}><FaCopy size={10}/> {t.copy}</button>
                <button onClick={() => setEditing({ ...x, id: `c_${Date.now().toString(36)}`, he_title: `${x.he_title} (2)`, en_title: `${x.en_title || ''} (2)`, builtIn: false, isNew: true })} style={btn({ padding: '6px 10px', fontSize: 11.5, background: 'transparent' })}>{t.duplicate}</button>
                {edited(x) && <button onClick={() => resetTpl(x)} title={t.reset} style={btn({ padding: '6px 9px', fontSize: 11.5, background: 'transparent', color: '#F5A623', borderColor: 'rgba(245,166,35,.35)' })}><FaUndo size={10}/></button>}
                <button onClick={() => removeTpl(x)} title={t.del} style={btn({ padding: '6px 9px', fontSize: 11.5, background: 'transparent', color: '#E05252', borderColor: 'rgba(224,82,82,.35)' })}><FaTrash size={10}/></button>
              </div>
            </div>
          )
        })}
      </div>
      {editing && <TemplateEditor {...{ t, isEn, btn, input, cfg, tpl: editing, sample, onClose: () => setEditing(null), purple, green, cream,
        onSave: x => { const { builtIn, isNew, id, ...rest } = x; saveTemplates(c => { c.templates = { ...(c.templates || {}), [id]: rest }; c.deletedTemplates = (c.deletedTemplates || []).filter(d => d !== id) }); setEditing(null) } }}/>}
      {sendFor && <QuickSend {...{ t, isEn, btn, input, cfg, tpl: sendFor, leads, onClose: () => setSendFor(null), flash, green, onSent }}/>}
    </div>
  )
}

function Modal({ children, onClose, width = 720 }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return (
    <div onMouseDown={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div style={{ width: '100%', maxWidth: width, maxHeight: '92vh', overflow: 'auto', background: '#10121E', border: '1px solid rgba(132,144,216,.25)', borderRadius: 16, padding: 18, boxShadow: '0 24px 70px rgba(0,0,0,.6)' }}>{children}</div>
    </div>
  )
}

function TemplateEditor({ t, isEn, btn, input, cfg, tpl, sample, onClose, onSave, purple, green, cream }) {
  const [x, setX] = useState(tpl)
  const [lang, setLang] = useState(isEn ? 'en' : 'he')
  const refs = { he: useRef(null), en: useRef(null) }
  const insert = (field, key) => {
    const el = refs[field].current
    const val = x[field] || ''
    const pos = el ? el.selectionStart : val.length
    const next = val.slice(0, pos) + `{${key}}` + val.slice(el ? el.selectionEnd : pos)
    setX(o => ({ ...o, [field]: next }))
    setTimeout(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = pos + key.length + 2 } }, 0)
  }
  const valid = (x.he_title || x.en_title) && (x.he || x.en)
  const Field = ({ field, label, dir }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(232,228,216,.7)' }}>{label}</label>
      <textarea ref={refs[field]} value={x[field] || ''} onChange={e => setX(o => ({ ...o, [field]: e.target.value }))} rows={6} dir={dir} onFocus={() => setLang(field)}
        style={{ ...input, resize: 'vertical', lineHeight: 1.55, fontSize: 13.5 }}/>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {VARIABLES.map(v => <button key={v.key} type="button" onClick={() => insert(field, v.key)} style={btn({ padding: '3px 8px', fontSize: 10.5, borderRadius: 20, background: 'transparent' })}>{`{${v.key}}`} · {isEn ? v.en : v.he}</button>)}
      </div>
    </div>
  )
  return (
    <Modal onClose={onClose} width={860}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <b style={{ fontSize: 16, flex: 1, color: cream }}>{tpl.isNew ? t.newTemplate : t.edit}</b>
        <button onClick={onClose} aria-label={t.cancel} style={btn({ padding: 7, background: 'transparent' })}><FaTimes/></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input value={x.he_title || ''} onChange={e => setX(o => ({ ...o, he_title: e.target.value }))} placeholder={t.titleHe} dir="rtl" style={input}/>
            <input value={x.en_title || ''} onChange={e => setX(o => ({ ...o, en_title: e.target.value }))} placeholder={t.titleEn} dir="ltr" style={input}/>
          </div>
          <select value={x.cat} onChange={e => setX(o => ({ ...o, cat: e.target.value }))} aria-label={t.category} style={input}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {isEn ? c.en : c.he}</option>)}
          </select>
          {Field({ field: 'he', label: t.textHe, dir: 'rtl' })}
          {Field({ field: 'en', label: t.textEn, dir: 'ltr' })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <b style={{ fontSize: 12.5, flex: 1, color: 'rgba(232,228,216,.75)' }}>{t.preview} {t.previewFor} {sample.name}</b>
            {['he', 'en'].map(l => <button key={l} onClick={() => setLang(l)} style={btn({ padding: '4px 9px', fontSize: 11, background: lang === l ? `${purple}30` : 'transparent' })}>{l.toUpperCase()}</button>)}
          </div>
          <div style={{ background: '#EFEAE2', borderRadius: 12, padding: 16, minHeight: 220 }}>
            <div className="au-bubble" dir="auto" style={{ background: '#D9FDD3', color: '#111B21', borderRadius: '10px 2px 10px 10px', padding: '9px 12px', fontSize: 13.5, maxWidth: '92%', marginInlineStart: 'auto', boxShadow: '0 1px 1px rgba(0,0,0,.12)' }}>
              {renderTemplate(x, sample, cfg, lang) || '…'}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} style={btn({ background: 'transparent' })}>{t.cancel}</button>
        <button onClick={() => valid && onSave(x)} disabled={!valid} style={btn({ opacity: valid ? 1 : .5, background: `${green}22`, borderColor: `${green}77`, color: green })}><FaCheck size={11}/> {t.save}</button>
      </div>
    </Modal>
  )
}

// Send one template to one lead (from the template card)
function QuickSend({ t, isEn, btn, input, cfg, tpl, leads, onClose, flash, green, onSent }) {
  const [q, setQ] = useState('')
  const [lead, setLead] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const matches = leads.filter(l => l.phone && (!q || (l.name || '').toLowerCase().includes(q.toLowerCase()) || String(l.phone).includes(q))).slice(0, 8)
  const pick = l => { setLead(l); setText(renderTemplate(tpl, asLead(l), cfg)) }
  const send = async () => {
    setBusy(true)
    try {
      const r = await autoApi.post('auto-send', { items: [{ leadId: String(lead.id), phone: intlPhone(lead.phone), name: lead.name, text, ruleKey: `tpl:${tpl.id}`, templateId: tpl.id }] })
      const res = r.results?.[0]; if (!res?.ok) throw new Error(res?.error || t.error)
      flash(t.sentOk); onSent?.(); onClose()
    } catch (e) { flash(`${t.error}: ${e.message}`) } finally { setBusy(false) }
  }
  return (
    <Modal onClose={onClose} width={560}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <b style={{ fontSize: 15, flex: 1 }}>{t.sendTo} · {isEn ? tpl.en_title || tpl.he_title : tpl.he_title}</b>
        <button onClick={onClose} aria-label={t.cancel} style={btn({ padding: 7, background: 'transparent' })}><FaTimes/></button>
      </div>
      {!lead ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t.searchLead} style={input}/>
          {matches.map(l => (
            <button key={l.id} onClick={() => pick(l)} className="au-row" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 10px', borderRadius: 9, border: '1px solid rgba(132,144,216,.12)', background: 'transparent', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start', minHeight: 0 }}>
              <b style={{ flex: 1 }}>{l.name || '—'}</b><span dir="ltr" style={{ fontSize: 12, opacity: .6 }}>{l.phone}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13 }}><b>{lead.name}</b> · <span dir="ltr">{lead.phone}</span> <button onClick={() => setLead(null)} style={btn({ padding: '3px 8px', fontSize: 11, background: 'transparent', marginInlineStart: 6 })}>✎</button></div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={7} dir="auto" style={{ ...input, background: '#0B2A22', border: '1px solid rgba(37,211,102,.25)', color: '#E9EDEF', lineHeight: 1.55, fontSize: 13.5 }}/>
          <button onClick={send} disabled={busy || !text.trim()} style={btn({ alignSelf: 'flex-end', background: `${green}22`, borderColor: `${green}77`, color: green })}><FaPaperPlane size={11}/> {busy ? t.sending : t.send}</button>
        </div>
      )}
    </Modal>
  )
}

// ── Rules ──────────────────────────────────────────────────────────────────────
function Rules({ t, isEn, card, btn, input, cfg, setCfg, tpls, tplName, stageName, dirty, save, saving, purple, green }) {
  const R = cfg.rules
  const TplSelect = ({ value, onChange, style }) => (
    <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...input, width: 'auto', minWidth: 190, ...style }}>
      {tpls.map(x => <option key={x.id} value={x.id}>{tplName(x.id)}</option>)}
    </select>
  )
  const StageSelect = ({ value, onChange }) => (
    <select value={value || ''} onChange={e => onChange(e.target.value)} style={{ ...input, width: 'auto', minWidth: 140 }}>
      <option value="">{t.noMove}</option>
      {STAGES.map(s => <option key={s} value={s}>{stageName(s)}</option>)}
    </select>
  )
  const row = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }
  const lbl = { fontSize: 12.5, color: 'rgba(232,228,216,.75)', minWidth: 150 }
  const hours = [...Array(25).keys()]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 60 }}>
      <div style={{ fontSize: 12, color: 'rgba(232,228,216,.6)' }}>{t.modeHint}</div>

      <Section card={card} title={t.welcomeRule} icon={<span>👋</span>} right={<ModeSwitch t={t} purple={purple} value={R.welcome.mode} onChange={v => setCfg(c => { c.rules.welcome.mode = v })}/>}>
        <div style={row}><span style={lbl}>{t.welcomeTpl}</span><TplSelect value={R.welcome.templateId} onChange={v => setCfg(c => { c.rules.welcome.templateId = v })}/></div>
        <div style={row}><span style={lbl}>{t.welcomePropTpl}</span><TplSelect value={R.welcome.propTemplateId} onChange={v => setCfg(c => { c.rules.welcome.propTemplateId = v })}/></div>
      </Section>

      <Section card={card} title={t.noReplyRule} icon={<span>⏰</span>} right={<ModeSwitch t={t} purple={purple} value={R.noReply.mode} onChange={v => setCfg(c => { c.rules.noReply.mode = v })}/>}>
        {(R.noReply.steps || []).map((s, i) => (
          <div key={i} style={row}>
            <span style={{ ...lbl, minWidth: 60, fontWeight: 800 }}>{t.step} {i + 1}</span>
            <input type="number" min={1} max={720} value={s.hours} onChange={e => setCfg(c => { c.rules.noReply.steps[i].hours = Math.max(1, Number(e.target.value) || 1) })} style={{ ...input, width: 80 }}/>
            <span style={{ fontSize: 12, color: 'rgba(232,228,216,.6)' }}>{t.afterHours}</span>
            <TplSelect value={s.templateId} onChange={v => setCfg(c => { c.rules.noReply.steps[i].templateId = v })}/>
            <button onClick={() => setCfg(c => { c.rules.noReply.steps.splice(i, 1) })} aria-label={t.del} style={btn({ padding: 7, background: 'transparent', color: '#E05252', borderColor: 'rgba(224,82,82,.3)' })}><FaTrash size={10}/></button>
          </div>
        ))}
        {(R.noReply.steps || []).length < 6 && <button onClick={() => setCfg(c => { c.rules.noReply.steps.push({ hours: 72, templateId: 'nr3' }) })} style={btn({ alignSelf: 'flex-start', background: 'transparent' })}><FaPlus size={10}/> {t.addStep}</button>}
        <div style={row}>
          <span style={lbl}>{t.onlyStages}</span>
          {STAGES.filter(s => s !== 'won').map(s => {
            const on = (R.noReply.stages || []).includes(s)
            return <button key={s} onClick={() => setCfg(c => { const set = new Set(c.rules.noReply.stages || []); on ? set.delete(s) : set.add(s); c.rules.noReply.stages = [...set] })} style={btn({ padding: '5px 10px', fontSize: 11.5, borderRadius: 20, background: on ? `${purple}30` : 'transparent', borderColor: on ? purple : 'rgba(132,144,216,.2)', color: on ? purple : 'rgba(232,228,216,.55)' })}>{on ? '✓ ' : ''}{stageName(s)}</button>
          })}
        </div>
      </Section>

      <Section card={card} title={t.repliesRule} icon={<span>💬</span>} right={<ModeSwitch t={t} purple={purple} onOff value={R.replies.mode === 'off' ? 'off' : 'auto'} onChange={v => setCfg(c => { c.rules.replies.mode = v === 'off' ? 'off' : 'auto' })}/>}>
        <label style={{ ...row, cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={!!R.replies.notifyTeam} onChange={e => setCfg(c => { c.rules.replies.notifyTeam = e.target.checked })} style={{ appearance: 'auto', width: 16, height: 16, minHeight: 0 }}/> {t.notifyTeam}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {[['negative', t.negWords, t.onNegative, '#9A9AA8'], ['positive', t.posWords, t.onPositive, '#0073EA']].map(([k, words, on, c]) => (
            <div key={k} style={{ padding: 12, borderRadius: 11, border: `1px solid ${c}44`, background: `${c}0D`, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <b style={{ fontSize: 13, color: c === '#9A9AA8' ? '#C9C9D2' : '#60A5FA' }}>{on}</b>
              <div style={row}><ModeSwitch t={t} purple={purple} value={R.replies[`${k}Mode`]} onChange={v => setCfg(c2 => { c2.rules.replies[`${k}Mode`] = v })}/><TplSelect value={R.replies[`${k}TemplateId`]} onChange={v => setCfg(c2 => { c2.rules.replies[`${k}TemplateId`] = v })} style={{ minWidth: 150, flex: 1 }}/></div>
              <div style={row}><span style={{ fontSize: 12, color: 'rgba(232,228,216,.7)' }}>{t.moveTo}</span><StageSelect value={R.replies[`${k}MoveTo`]} onChange={v => setCfg(c2 => { c2.rules.replies[`${k}MoveTo`] = v })}/></div>
              <label style={{ fontSize: 11.5, color: 'rgba(232,228,216,.6)' }}>{words} ({t.commaSep})</label>
              <textarea rows={3} value={(R.replies[k] || []).join(', ')} onChange={e => setCfg(c2 => { c2.rules.replies[k] = e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={{ ...input, resize: 'vertical', fontSize: 12.5 }}/>
            </div>
          ))}
        </div>
      </Section>

      <Section card={card} title={t.stageRule} icon={<span>🗂️</span>}>
        {['contacted', 'discovery', 'negotiating', 'won', 'lost'].map(s => (
          <div key={s} style={row}>
            <span style={{ ...lbl, fontWeight: 700 }}>{stageName(s)}</span>
            <ModeSwitch t={t} purple={purple} value={R.stage?.[s]?.mode || 'off'} onChange={v => setCfg(c => { c.rules.stage[s] = { ...(c.rules.stage[s] || {}), mode: v } })}/>
            <TplSelect value={R.stage?.[s]?.templateId} onChange={v => setCfg(c => { c.rules.stage[s] = { ...(c.rules.stage[s] || {}), templateId: v } })}/>
          </div>
        ))}
      </Section>

      <Section card={card} title={t.reengageRule} icon={<span>🔁</span>} right={<ModeSwitch t={t} purple={purple} value={R.reengage.mode} onChange={v => setCfg(c => { c.rules.reengage.mode = v })}/>}>
        <div style={row}>
          <input type="number" min={7} max={365} value={R.reengage.days} onChange={e => setCfg(c => { c.rules.reengage.days = Math.max(7, Number(e.target.value) || 45) })} style={{ ...input, width: 80 }}/>
          <span style={{ fontSize: 12, color: 'rgba(232,228,216,.6)' }}>{t.afterDays} "{stageName('lost')}"</span>
          <TplSelect value={R.reengage.templateId} onChange={v => setCfg(c => { c.rules.reengage.templateId = v })}/>
        </div>
      </Section>

      <Section card={card} title={t.quiet} icon={<FaClock color="#F5A623"/>} right={
        <label style={{ ...row, cursor: 'pointer', fontSize: 12.5 }}><input type="checkbox" checked={!!cfg.quiet.enabled} onChange={e => setCfg(c => { c.quiet.enabled = e.target.checked })} style={{ appearance: 'auto', width: 16, height: 16, minHeight: 0 }}/> {t.on}</label>}>
        <div style={{ fontSize: 12, color: 'rgba(232,228,216,.6)' }}>{t.quietHint}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8, opacity: cfg.quiet.enabled ? 1 : .45 }}>
          {t.days.map((d, i) => {
            const w = cfg.quiet.days?.[i]
            return (
              <div key={i} style={{ ...row, padding: '7px 10px', borderRadius: 9, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(132,144,216,.12)' }}>
                <b style={{ fontSize: 12.5, width: 52 }}>{d}</b>
                {w ? (<>
                  <select value={w[0]} onChange={e => setCfg(c => { c.quiet.days[i] = [Number(e.target.value), c.quiet.days[i][1]] })} style={{ ...input, width: 66, padding: '5px 6px' }}>{hours.slice(0, 24).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select>
                  <span>–</span>
                  <select value={w[1]} onChange={e => setCfg(c => { c.quiet.days[i] = [c.quiet.days[i][0], Number(e.target.value)] })} style={{ ...input, width: 66, padding: '5px 6px' }}>{hours.slice(1).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select>
                  <button onClick={() => setCfg(c => { c.quiet.days[i] = null })} aria-label={t.closed} style={btn({ padding: 5, background: 'transparent', color: 'rgba(232,228,216,.5)', borderColor: 'transparent' })}><FaTimes size={10}/></button>
                </>) : <button onClick={() => setCfg(c => { c.quiet.days[i] = [9, 18] })} style={btn({ padding: '4px 9px', fontSize: 11.5, background: 'transparent', color: 'rgba(232,228,216,.5)' })}>{t.closed} · <FaPlus size={9}/></button>}
              </div>
            )
          })}
        </div>
      </Section>

      <Section card={card} title={t.varsTitle} icon={<span>🏢</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {[['agent', t.agentHe, 'rtl'], ['en_agent', t.agentEn, 'ltr'], ['phone', t.officePhone, 'ltr'], ['sellLink', t.sellLink, 'ltr']].map(([k, l, dir]) => (
            <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'rgba(232,228,216,.7)' }}>{l}
              <input value={cfg.vars?.[k] || ''} dir={dir} onChange={e => setCfg(c => { c.vars = { ...(c.vars || {}), [k]: e.target.value } })} style={input}/>
            </label>
          ))}
        </div>
      </Section>

      {dirty && (
        <div style={{ position: 'sticky', bottom: 10, zIndex: 5, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: '#1F1A0E', border: '1px solid rgba(245,166,35,.5)', boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#F5C26B' }}>{t.unsaved}</span>
          <button onClick={save} style={btn({ background: `${green}22`, borderColor: `${green}77`, color: green })}><FaCheck size={11}/> {saving === 'saving' ? t.saving : t.saveRules}</button>
        </div>
      )}
    </div>
  )
}

// ── Bulk send ──────────────────────────────────────────────────────────────────
function Broadcast({ t, isEn, card, btn, input, cfg, tpls, leads, states, stageName, flash, green, purple, onDone }) {
  const [tplId, setTplId] = useState(tpls.find(x => x.id === 'reengage')?.id || tpls[0]?.id)
  const [stages, setStages] = useState(new Set())
  const [days, setDays] = useState(30)
  const [q, setQ] = useState('')
  const [skipSent, setSkipSent] = useState(true)
  const [sel, setSel] = useState(new Set())
  const [prog, setProg] = useState(null)
  const tpl = tpls.find(x => x.id === tplId)
  const rows = useMemo(() => leads.filter(l => {
    if (stages.size && !stages.has(l.leadStatus || 'new')) return false
    if (days && l.ts && Date.now() - l.ts > days * 864e5) return false
    if (q && !`${l.name || ''} ${l.phone || ''} ${l.propTitle || ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }).map(l => {
    const s = states[String(l.id)]
    const phone = intlPhone(l.phone)
    const blocked = !phone || phone.length < 11 ? t.noPhone : s?.optOut ? t.optedOut : ''
    const already = !!s?.sent?.[`tpl:${tplId}`]
    return { l, phone, blocked, already }
  }), [leads, stages, days, q, states, tplId, t])
  const eligible = rows.filter(r => !r.blocked && !(skipSent && r.already))
  useEffect(() => { setSel(new Set(eligible.map(r => String(r.l.id)))) }, [tplId, stages, days, q, skipSent, leads.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const chosen = eligible.filter(r => sel.has(String(r.l.id)))
  const toggle = id => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const send = async () => {
    if (!tpl || !chosen.length || !window.confirm(t.bcConfirm(chosen.length))) return
    let ok = 0, bad = 0
    setProg({ done: 0, total: chosen.length })
    for (let i = 0; i < chosen.length; i += 10) {
      const batch = chosen.slice(i, i + 10).map(r => ({ leadId: String(r.l.id), phone: r.phone, name: r.l.name, text: renderTemplate(tpl, asLead(r.l), cfg), ruleKey: `tpl:${tpl.id}`, templateId: tpl.id }))
      try { const res = await autoApi.post('auto-send', { items: batch }); (res.results || []).forEach(x => (x.ok ? ok++ : bad++)) } catch { bad += batch.length }
      setProg({ done: Math.min(i + 10, chosen.length), total: chosen.length })
    }
    setProg(null); flash(t.bcDone(ok, bad)); onDone?.()
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, alignItems: 'start' }}>
      <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(232,228,216,.7)' }}>{t.bcTemplate}</label>
        <select value={tplId} onChange={e => setTplId(e.target.value)} style={input}>{tpls.map(x => <option key={x.id} value={x.id}>{isEn ? x.en_title || x.he_title : x.he_title}</option>)}</select>
        {tpl && <div className="au-bubble" dir="auto" style={{ background: '#0B2A22', border: '1px solid rgba(37,211,102,.18)', color: '#E9EDEF', borderRadius: 10, padding: '9px 11px', fontSize: 12.5, maxHeight: 170, overflow: 'auto' }}>{renderTemplate(tpl, asLead(chosen[0]?.l || { name: isEn ? 'Dana' : 'דנה' }), cfg)}</div>}
        <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(232,228,216,.7)' }}>{t.bcStages}</label>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {STAGES.map(s => { const on = stages.has(s); return <button key={s} onClick={() => setStages(x => { const n = new Set(x); on ? n.delete(s) : n.add(s); return n })} style={btn({ padding: '5px 10px', fontSize: 11.5, borderRadius: 20, background: on ? `${purple}30` : 'transparent', borderColor: on ? purple : 'rgba(132,144,216,.2)', color: on ? purple : 'rgba(232,228,216,.6)' })}>{stageName(s)}</button> })}
        </div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(232,228,216,.7)' }}>{t.bcPeriod}</label>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[7, 30, 90, 0].map(d => <button key={d} onClick={() => setDays(d)} style={btn({ padding: '5px 10px', fontSize: 11.5, borderRadius: 20, background: days === d ? `${purple}30` : 'transparent', borderColor: days === d ? purple : 'rgba(132,144,216,.2)', color: days === d ? purple : 'rgba(232,228,216,.6)' })}>{d ? t.bcDays(d) : t.bcAll}</button>)}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={skipSent} onChange={e => setSkipSent(e.target.checked)} style={{ appearance: 'auto', width: 16, height: 16, minHeight: 0 }}/> {t.bcSkipSent}</label>
        {prog ? (
          <div>
            <div style={{ fontSize: 12, marginBottom: 5 }}>{t.progress}: {prog.done}/{prog.total}</div>
            <div style={{ height: 8, borderRadius: 5, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${(prog.done / prog.total) * 100}%`, background: green, transition: 'width .3s' }}/></div>
          </div>
        ) : <button onClick={send} disabled={!chosen.length} style={btn({ padding: '11px 14px', fontSize: 13.5, opacity: chosen.length ? 1 : .5, background: `${green}22`, borderColor: `${green}77`, color: green })}><FaPaperPlane size={12}/> {t.bcSend(chosen.length)}</button>}
      </div>
      <div style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 620 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.searchLead} style={{ ...input, flex: 1, minWidth: 160 }}/>
          <span style={{ fontSize: 12, color: 'rgba(232,228,216,.6)' }}>{t.bcSelected(chosen.length)}</span>
          <button onClick={() => setSel(new Set(eligible.map(r => String(r.l.id))))} style={btn({ padding: '5px 9px', fontSize: 11.5, background: 'transparent' })}>{t.selectAll}</button>
          <button onClick={() => setSel(new Set())} style={btn({ padding: '5px 9px', fontSize: 11.5, background: 'transparent' })}>{t.clear}</button>
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {rows.map(({ l, phone, blocked, already }) => {
            const id = String(l.id), dis = !!blocked || (skipSent && already)
            return (
              <label key={id} className="au-row" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 8px', borderRadius: 8, cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? .45 : 1 }}>
                <input type="checkbox" disabled={dis} checked={!dis && sel.has(id)} onChange={() => toggle(id)} style={{ appearance: 'auto', width: 16, height: 16, minHeight: 0, flexShrink: 0 }}/>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}><b>{l.name || '—'}</b>{l.propTitle ? <span style={{ opacity: .55 }}> · {l.propTitle}</span> : null}</span>
                <span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 20, background: 'rgba(255,255,255,.06)' }}>{stageName(l.leadStatus || 'new')}</span>
                {blocked ? <span style={{ fontSize: 10.5, color: '#E05252' }}>{blocked}</span> : already ? <span style={{ fontSize: 10.5, color: '#22C55E' }}>✓</span> : <span dir="ltr" style={{ fontSize: 11, opacity: .5 }}>{phone.slice(-4)}</span>}
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Log ────────────────────────────────────────────────────────────────────────
function Log({ t, isEn, card, btn, log, loadLog, tplName, states, loadStates, leads, purple }) {
  const [f, setF] = useState('all')
  const rows = (log?.rows || []).filter(r => f === 'all' || (f === 'ok' ? r.ok : !r.ok))
  const optedOut = Object.values(states).filter(s => s.optOut)
  const nameOf = id => leads.find(l => String(l.id) === String(id))?.name || ''
  const unopt = async id => { try { await autoApi.post('auto-optout', { leadId: id, optOut: false }); loadStates() } catch {} }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {[['all', t.logAll], ['ok', t.logOk], ['bad', t.logFailed]].map(([k, l]) => <button key={k} onClick={() => setF(k)} style={btn({ padding: '5px 11px', fontSize: 11.5, borderRadius: 20, background: f === k ? `${purple}30` : 'transparent', borderColor: f === k ? purple : 'rgba(132,144,216,.2)' })}>{l}</button>)}
        <div style={{ flex: 1 }}/>
        <button onClick={loadLog} style={btn({ padding: '5px 10px', fontSize: 11.5 })}><FaSyncAlt size={10}/></button>
      </div>
      {log?.error && <div style={{ color: '#E05252', fontSize: 12.5 }}>{log.error}</div>}
      <div style={{ ...card, overflow: 'hidden' }}>
        {!rows.length ? <div style={{ padding: 30, textAlign: 'center', color: 'rgba(232,228,216,.5)' }}>{log ? t.logEmpty : '…'}</div> : rows.map((r, i) => {
          const k = ruleKind(r.rule_key)
          return (
            <div key={r.id || i} className="au-row" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderTop: i ? '1px solid rgba(132,144,216,.08)' : 'none', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, color: r.ok ? '#22C55E' : '#E05252', width: 16 }}>{r.ok ? '✓' : '✗'}</span>
              <span style={{ fontSize: 11.5, color: 'rgba(232,228,216,.5)', width: 84, flexShrink: 0 }}>{fmtDT(r.created_at, isEn ? 'en' : 'he')}</span>
              <b style={{ fontSize: 13, width: 130, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name || nameOf(r.lead_id) || (r.phone ? `+${r.phone}` : '—')}</b>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: `${KIND_COLOR[k] || purple}22`, color: KIND_COLOR[k] || purple, flexShrink: 0 }}>{t.kind[k] || k}</span>
              <span style={{ flex: 1, minWidth: 180, fontSize: 12.5, color: 'rgba(232,228,216,.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dir="auto" title={r.message}>{r.template_id ? `${tplName(r.template_id)} · ` : ''}{String(r.message || '').replace(/\n/g, ' ')}</span>
              <span style={{ fontSize: 11, color: 'rgba(232,228,216,.45)' }}>{t.by[r.by] || r.by}</span>
              {!r.ok && r.error && <div style={{ width: '100%', fontSize: 11.5, color: '#E05252', paddingInlineStart: 26 }}>{r.error}</div>}
            </div>
          )
        })}
      </div>
      {!!optedOut.length && (
        <Section card={card} title={`${t.negative} (${optedOut.length})`} icon={<span>🚫</span>}>
          {optedOut.map(s => (
            <div key={s.leadId} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, flexWrap: 'wrap' }}>
              <b>{nameOf(s.leadId) || s.leadId}</b><span dir="auto" style={{ flex: 1, color: 'rgba(232,228,216,.6)' }}>"{s.lastInboundText}"</span>
              <button onClick={() => unopt(s.leadId)} style={btn({ padding: '4px 9px', fontSize: 11, background: 'transparent' })}>{t.unoptout}</button>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

export { DEFAULT_TEMPLATES }
