// ─── ADMIN: property intake ("נכסים שנקלטו") ─────────────────────────────────
// Every property that came in through /newproperty. Completely separate from
// the leads board: this reads and writes only seller_submissions via
// /api/seller-form. Pipeline: draft → new → review → approved → published →
// inactive / sold, plus an independent "owner verified" flag.
//
// Property card tabs: כללי · משפטי · מסחרי · מדיה · מסמכים · שיווק · היסטוריה.
// "פרסם באתר" builds a property for the existing property generator (server
// side) and it appears on the live site; "הסר מהאתר" hides it without deleting.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { FaWhatsapp, FaPhone, FaEnvelope, FaTrash, FaSearch, FaCopy, FaDownload, FaFileAlt, FaVideo, FaSyncAlt, FaExternalLinkAlt, FaCheck, FaGlobe, FaEyeSlash, FaLink, FaShieldAlt, FaHistory, FaImage, FaBullhorn, FaBalanceScale, FaMoneyBill, FaInfoCircle, FaSave, FaPlus, FaTimes, FaExclamationTriangle, FaUserPlus, FaMobileAlt, FaDesktop, FaBell, FaRoute } from 'react-icons/fa'
import { buildSummary, headline, PROPERTY_TYPE_LABEL, DOC_TAG_LABEL, fmtNum, INTAKE_STATUSES, marketingTexts, AI_CHANNELS, AI_TONES, AI_SYSTEM, aiBrief, yad2Fields } from './sellerFormSchema.js'

const ADMIN_TOKEN = 'AFIKhanahal2026'
const API = '/api/seller-form'
const H = { Authorization: `Bearer ${ADMIN_TOKEN}` }
export const SELLER_STATUSES = INTAKE_STATUSES
const BACKUP_STATUS = { v: 'backup', l: 'גיבוי · לא בסופאבייס', color: '#F5A623' }
const statusOf = v => v === 'backup' ? BACKUP_STATUS : (INTAKE_STATUSES.find(s => s.v === v) || INTAKE_STATUSES[1])
const KIND_LABEL = { photos: 'תמונות', videos: 'סרטונים', plan: 'תוכנית', docs: 'מסמכים' }
const fmtDate = iso => { if (!iso) return ''; try { return new Date(iso).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const toIntl = raw => { const d = String(raw || '').replace(/\D/g, ''); if (d.startsWith('972')) return d; if (d.startsWith('0')) return '972' + d.slice(1); return d }
const SECTION_GROUPS = {
  general:   ['contact', 'property', 'features', 'condition', 'building'],
  legal:     ['legal'],
  marketing: ['marketing'],
}
const HISTORY_LABEL = { archived: 'נשמר בארכיון GitHub', restored: 'שוחזר מגיבוי', draft_created: 'טיוטה נוצרה', submitted: 'הטופס נשלח', verified: 'אימות בעלים', status: 'שינוי סטטוס', notes: 'הערות עודכנו', edit: 'עריכה', published: 'פורסם באתר', republished: 'עודכן באתר', unpublished: 'הוסר מהאתר', file_added: 'קובץ נוסף', file_deleted: 'קובץ נמחק' }
const ACCEPT = { photos: 'image/*', videos: 'video/*', plan: 'image/*,application/pdf', docs: 'image/*,application/pdf' }
const BY_LABEL = { seller: 'המוכר', owner: 'בעלים', admin: 'צוות', system: 'מערכת' }
const AI_MODEL = 'claude-opus-5'

// ── Journey (funnel) labels: where a person is between "got the link" and "sent the form" ──
const STAGES = [
  { v: 'invited',     l: 'הוזמנו ולא פתחו',   color: '#9A9AA8' },
  { v: 'opened',      l: 'פתחו ולא התחילו',   color: '#F5A623' },
  { v: 'started',     l: 'התחילו',            color: '#60D4F7' },
  { v: 'in_progress', l: 'באמצע',             color: '#8490D8' },
  { v: 'review',      l: 'הגיעו לסיכום',      color: '#C084FC' },
  { v: 'submitted',   l: 'שלחו',              color: '#22C55E' },
]
const stageOf = v => STAGES.find(x => x.v === v) || STAGES[2]
const relTime = iso => {
  if (!iso) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 2) return 'עכשיו'
  if (m < 60) return `לפני ${m} דק׳`
  if (m < 48 * 60) return `לפני ${Math.round(m / 60)} שע׳`
  return `לפני ${Math.round(m / 1440)} ימים`
}
const SOURCE_LABEL = s => ({ invite: 'קישור אישי', direct: 'קישור ישיר', site: 'מהאתר', whatsapp: 'וואטסאפ', facebook: 'פייסבוק', instagram: 'אינסטגרם' }[s] || s || '')

function ProgressBar({ pct, color }) {
  return <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${Math.max(2, Math.min(100, pct || 0))}%`, background: color, borderRadius: 3, transition: 'width .3s' }}/></div>
}

// "Where did they stop?" — one card, used in the list rows and at the top of a draft's detail
function JourneyLine({ j, compact }) {
  if (!j) return null
  const st = stageOf(j.stage)
  return (
    <div style={{ marginTop: compact ? 7 : 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 4 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: st.color, fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color, display: 'inline-block' }}/>{st.l}{j.stalled && j.stage !== 'submitted' ? <span style={{ color: '#E05252', fontWeight: 700 }}> · נעצרו</span> : ''}
        </span>
        <span style={{ color: 'rgba(232,228,216,.5)', whiteSpace: 'nowrap' }}>{j.progress_pct}% {j.total_steps ? `· שלב ${Math.min(j.total_steps, (j.step_index || 0) + 1)} מתוך ${j.total_steps}` : ''}</span>
      </div>
      <ProgressBar pct={j.progress_pct} color={st.color}/>
      {!compact && j.last_step_label && j.stage !== 'submitted' && <div style={{ fontSize: 12, color: 'rgba(232,228,216,.75)', marginTop: 6 }}>עצרו בשאלה: <b>{j.last_step_label}</b></div>}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10.5, color: 'rgba(232,228,216,.45)', marginTop: 5 }}>
        {j.last_seen_at && <span>נראו {relTime(j.last_seen_at)}</span>}
        {j.device && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{j.device === 'mobile' ? <FaMobileAlt size={9}/> : <FaDesktop size={9}/>}{j.device === 'mobile' ? 'נייד' : 'מחשב'}</span>}
        {j.source && <span>{SOURCE_LABEL(j.source)}</span>}
        {j.opens > 1 && <span>{j.opens} פתיחות</span>}
      </div>
    </div>
  )
}

// ── AI copy studio: one click per channel, editable result, saved on the property card ──
function AiStudio({ detail, ov, setOv, onSave, saving, copyText, say, styles }) {
  const { card, btn, purple } = styles
  const saved = ov.ai_copy || {}
  const [channel, setChannel] = useState(AI_CHANNELS[0].v)
  const [tone, setTone] = useState('pro')
  const [text, setText] = useState(saved[AI_CHANNELS[0].v] || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const pick = v => { setChannel(v); setText((ov.ai_copy || {})[v] || ''); setErr('') }
  const generate = async () => {
    const ch = AI_CHANNELS.find(c => c.v === channel); const tn = AI_TONES.find(t => t.v === tone)
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/ai/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...H, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: AI_MODEL, max_tokens: 2000, system: AI_SYSTEM,
          messages: [{ role: 'user', content: `תיק הנכס:\n${aiBrief(detail.answers || {})}\n\nמשימה: ${ch.task}\nטון: ${tn.l} — ${tn.hint}.` }],
        }),
        signal: AbortSignal.timeout(60000),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error?.message || d.error || `HTTP ${r.status}`)
      if (d.stop_reason === 'refusal') throw new Error('המודל סירב לבקשה. נסו טון אחר או ערכו את תיק הנכס.')
      const out = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
      if (!out) throw new Error('לא התקבל טקסט')
      setText(out)
    } catch (e) { setErr(e.name === 'TimeoutError' ? 'הבקשה ארכה יותר מדי. נסו שוב.' : (e.message || 'שגיאה')) }
    finally { setBusy(false) }
  }
  const save = async () => { const next = { ...ov, ai_copy: { ...(ov.ai_copy || {}), [channel]: text } }; setOv(next); await onSave(next) }
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`
  const ch = AI_CHANNELS.find(c => c.v === channel)
  return (
    <div style={{ ...card, padding: '14px 16px', marginBottom: 10, borderColor: 'rgba(132,144,216,.45)', background: 'linear-gradient(135deg, rgba(63,78,176,.12), rgba(255,255,255,.02))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <h3 style={{ fontSize: 12, letterSpacing: '.12em', color: purple, margin: 0, fontWeight: 700 }}>✨ סטודיו AI לשיווק</h3>
        <span style={{ fontSize: 11.5, color: 'rgba(232,228,216,.55)' }}>הטקסט נבנה מהגרסה הציבורית של התיק בלבד — נתונים פנימיים לא נחשפים</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {AI_CHANNELS.map(c => <button key={c.v} onClick={() => pick(c.v)} style={{ ...btn(), background: c.v === channel ? purple : undefined, color: c.v === channel ? '#fff' : undefined, borderColor: c.v === channel ? purple : undefined }}>{c.icon} {c.l}{saved[c.v] ? ' ·' : ''}</button>)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, color: 'rgba(232,228,216,.55)' }}>טון:</span>
        {AI_TONES.map(t => <button key={t.v} onClick={() => setTone(t.v)} title={t.hint} style={{ ...btn(), opacity: t.v === tone ? 1 : .55, borderColor: t.v === tone ? purple : undefined }}>{t.l}</button>)}
        <button onClick={generate} disabled={busy} style={{ ...btn(), marginInlineStart: 'auto', background: '#22C55E', borderColor: '#22C55E', color: '#0B1F12', fontWeight: 800 }}>{busy ? '✨ כותב…' : text ? '✨ ניסוח מחדש' : `✨ צור ${ch.l}`}</button>
      </div>
      {err && <div style={{ color: '#F87171', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
      <textarea value={text} onChange={e => setText(e.target.value)} rows={ch.v === 'website' ? 9 : 7} placeholder={`לחצו "צור ${ch.l}" — ואפשר לערוך את התוצאה כאן לפני השמירה`} dir="rtl"
        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,.25)', color: '#E8E4D8', border: '1px solid rgba(132,144,216,.25)', borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.7, resize: 'vertical' }}/>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        <button onClick={() => text && copyText(text)} disabled={!text} style={btn()}><FaCopy size={11}/> העתקה</button>
        <a href={text ? wa : undefined} target="_blank" rel="noreferrer" onClick={e => { if (!text) e.preventDefault() }} style={{ ...btn(), textDecoration: 'none', color: '#25D366', borderColor: 'rgba(37,211,102,.4)', opacity: text ? 1 : .5 }}><FaWhatsapp size={12}/> שליחה בוואטסאפ</a>
        <button onClick={save} disabled={!text || saving === 'ov'} style={btn()}><FaSave size={11}/> {saving === 'ov' ? 'שומר…' : 'שמירה בכרטיס הנכס'}</button>
        {saved[channel] && saved[channel] !== text && <button onClick={() => setText(saved[channel])} style={{ ...btn(), opacity: .7 }}>חזרה לגרסה השמורה</button>}
      </div>
    </div>
  )
}

function Yad2Card({ detail, ov, copyText, styles }) {
  const { card, btn } = styles
  const rows = yad2Fields(detail.answers || {}, ov)
  const all = rows.map(r => `${r.k}: ${r.v}`).join('\n')
  return (
    <div style={{ ...card, padding: '14px 16px', marginBottom: 10, borderColor: 'rgba(255,140,0,.35)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: 12, letterSpacing: '.12em', color: '#FF8C00', margin: 0, fontWeight: 700 }}>🏷️ פרסום ביד2 — השדות מוכנים להעתקה</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => copyText(all)} style={btn()}><FaCopy size={11}/> העתק הכל</button>
          <a href="https://www.yad2.co.il/realestate/publish" target="_blank" rel="noreferrer" style={{ ...btn(), textDecoration: 'none' }}><FaExternalLinkAlt size={10}/> פתיחת יד2</a>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 6 }}>
        {rows.map(r => (
          <div key={r.k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(132,144,216,.12)', borderRadius: 8, padding: '7px 10px', gridColumn: r.k === 'תיאור' ? '1 / -1' : undefined }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: 'rgba(232,228,216,.5)', letterSpacing: '.04em' }}>{r.k}</div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.v}</div>
            </div>
            <button onClick={() => copyText(r.v)} title="העתקה" style={{ ...btn(), padding: '4px 7px', minHeight: 26 }}><FaCopy size={10}/></button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SellerSubmissionsTab({ C, onChanged, onOpenWizard }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [purpose, setPurpose] = useState('all')
  const [selId, setSelId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [tab, setTab] = useState('general')
  const [notes, setNotes] = useState('')
  const [ov, setOv] = useState({})
  const [saving, setSaving] = useState('')
  const [busy, setBusy] = useState('')
  const [flash, setFlash] = useState('')
  const [fileBusy, setFileBusy] = useState('')      // '' | 'up:<kind>' | 'del:<path>'
  const [stale, setStale] = useState(false)          // published property edited but not re-published yet
  const [backupInfo, setBackupInfo] = useState({ enabled: false, count: 0, archive: {} })
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invite, setInvite] = useState({ name: '', phone: '', purpose: 'sale', send: true })
  const [inviteResult, setInviteResult] = useState(null)
  const fileInputRef = useRef({})

  const rowsRef = useRef([]); useEffect(() => { rowsRef.current = rows }, [rows])
  const say = m => { setFlash(m); setTimeout(() => setFlash(''), 2200) }
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [r, rb] = await Promise.all([fetch(API, { headers: H }), fetch(`${API}?action=backup-list`, { headers: H }).catch(() => null)])
      const data = await r.json().catch(() => [])
      const backups = rb && rb.ok ? await rb.json().catch(() => ({})) : {}
      setBackupInfo({ enabled: !!backups.enabled, count: (backups.rows || []).length, archive: backups.archive || {} })
      // Forms that arrived while Supabase was down live in Vercel Blob until restored; they are listed
      // here with the same card so nothing is ever "lost somewhere".
      if (!r.ok && !(backups.rows || []).length) throw new Error(data?.error || `HTTP ${r.status}`)
      if (!r.ok) setError(/egress|402|restricted/i.test(JSON.stringify(data)) ? 'Supabase חסום כרגע (מכסת תעבורה). מוצגות רשומות הגיבוי בלבד.' : (data?.error || `HTTP ${r.status}`))
      setRows([...(backups.rows || []), ...(Array.isArray(data) ? data : [])])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const open = useCallback(async id => {
    setSelId(id); setDetail(null); setDetailLoading(true); setTab('general')
    if (String(id).startsWith('bk:')) {
      try {
        const url = rowsRef.current.find(x => x.id === id)?.blob_url || ''
        const r = await fetch(`${API}?action=backup-get&url=${encodeURIComponent(url)}`, { headers: H })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`)
        setDetail(d); setNotes(''); setOv({})
      } catch (e) { setError(e.message) }
      finally { setDetailLoading(false) }
      return
    }
    try {
      const r = await fetch(`${API}?id=${encodeURIComponent(id)}`, { headers: H })
      const data = await r.json().catch(() => null)
      if (!r.ok || !data) throw new Error(data?.error || `HTTP ${r.status}`)
      setDetail(data); setNotes(data.notes || ''); setOv(data.overrides || {})
    } catch (e) { setError(e.message) }
    finally { setDetailLoading(false) }
  }, [])
  const refreshDetail = async id => { const r = await fetch(`${API}?id=${encodeURIComponent(id)}`, { headers: H }); const d = await r.json().catch(() => null); if (r.ok && d) { setDetail(d); setNotes(d.notes || ''); setOv(d.overrides || {}) } }

  const patch = async (id, body) => {
    const r = await fetch(`${API}?id=${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || d.ok === false) throw new Error(d.error || `HTTP ${r.status}`)
    return d
  }
  const setStatus = async (id, status) => {
    try { await patch(id, { status }); setRows(rs => rs.map(x => x.id === id ? { ...x, status } : x)); if (detail?.id === id) await refreshDetail(id); say('הסטטוס עודכן'); onChanged?.() }
    catch (e) { setError(e.message) }
  }
  const saveNotes = async () => { if (!detail) return; setSaving('notes'); try { await patch(detail.id, { notes }); await refreshDetail(detail.id); say('ההערות נשמרו') } catch (e) { setError(e.message) } finally { setSaving('') } }
  const sendInvite = async () => {
    if (!invite.phone.trim()) { say('צריך מספר טלפון'); return }
    setBusy('invite'); setInviteResult(null)
    try {
      const r = await fetch(`${API}?action=invite`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...H }, body: JSON.stringify(invite) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setInviteResult(d); say(d.sent ? 'הקישור נשלח בוואטסאפ' : 'הקישור האישי נוצר'); load()
    } catch (e) { say(e.message) }
    finally { setBusy('') }
  }
  const restoreBackup = async () => {
    if (!detail?.blob_url || !window.confirm('לשחזר את הטופס הזה לתוך Supabase? הרשומה תעבור לרשימה הרגילה ותימחק מהגיבוי.')) return
    setBusy('restore')
    try {
      const r = await fetch(`${API}?action=backup-restore`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...H }, body: JSON.stringify({ url: detail.blob_url }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`)
      say(`שוחזר לסופאבייס · תיק ${d.ref}`); setSelId(null); setDetail(null); load()
    } catch (e) { say(`השחזור נכשל: ${e.message}`) }
    finally { setBusy('') }
  }
  const remind = async () => {
    if (!detail?.sid) return
    setBusy('remind')
    try {
      const r = await fetch(`${API}?action=resume-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: detail.sid }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`)
      say(d.sent ? `תזכורת נשלחה בוואטסאפ ל-${d.phoneMasked}` : `לא נשלח: ${d.error || 'Green API לא מוגדר'}`)
    } catch (e) { say(e.message) }
    finally { setBusy('') }
  }
  const saveOverrides = async () => { if (!detail) return; setSaving('ov'); try { await patch(detail.id, { overrides: ov }); await refreshDetail(detail.id); if (detail.status === 'published') { setStale(true); say('נשמר. לחצו "עדכן באתר" כדי שהשינוי יופיע בלייב') } else say('הנתונים נשמרו') } catch (e) { setError(e.message) } finally { setSaving('') } }
  useEffect(() => { setStale(false) }, [selId])
  const act = async (action) => {
    if (!detail) return
    if (action === 'publish' && !window.confirm(detail.status === 'published' ? 'לעדכן את הנכס באתר עם הנתונים הנוכחיים?' : 'לפרסם את הנכס באתר החי? הוא יופיע במחולל הנכסים ובעמוד הנכסים.')) return
    if (action === 'unpublish' && !window.confirm('להסיר את הנכס מהאתר? הרשומה, המדיה וההיסטוריה נשארות במערכת.')) return
    setBusy(action); setError('')
    try {
      const r = await fetch(`${API}?action=${action}&id=${encodeURIComponent(detail.id)}`, { method: 'POST', headers: H })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`)
      await refreshDetail(detail.id); await load(); setStale(false); onChanged?.()
      say(action === 'publish' ? `פורסם באתר (${d.images} תמונות)` : 'הוסר מהאתר')
    } catch (e) { setError(e.message) }
    finally { setBusy('') }
  }
  const remove = async (id, withMedia) => {
    if (!window.confirm(withMedia ? 'למחוק את הנכס לצמיתות כולל כל התמונות, הסרטונים והמסמכים?' : 'למחוק את רשומת הנכס? התמונות והמסמכים יישארו באחסון.')) return
    try {
      const r = await fetch(`${API}?id=${encodeURIComponent(id)}${withMedia ? '&media=1' : ''}`, { method: 'DELETE', headers: H })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setRows(rs => rs.filter(x => x.id !== id)); if (selId === id) { setSelId(null); setDetail(null) }
      onChanged?.()
    } catch (e) { setError(e.message) }
  }
  // ── media library: add / delete single files (same folder layout as the seller's uploads) ──
  const addFiles = async (kind, fileList) => {
    if (!detail || !fileList?.length) return
    setFileBusy(`up:${kind}`); setError('')
    let added = 0
    try {
      for (const file of Array.from(fileList)) {
        const r = await fetch(`${API}?action=admin-upload-url&id=${encodeURIComponent(detail.id)}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, name: file.name, type: file.type, size: file.size }) })
        const d = await r.json().catch(() => ({}))
        if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`)
        const put = await fetch(d.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true' }, body: file })
        if (!put.ok) throw new Error(`העלאה נכשלה (HTTP ${put.status})`)
        const reg = await fetch(`${API}?action=file&id=${encodeURIComponent(detail.id)}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: d.path, name: file.name, type: file.type, size: file.size, kind }) })
        const rd = await reg.json().catch(() => ({}))
        if (!reg.ok || !rd.ok) throw new Error(rd.error || `HTTP ${reg.status}`)
        added += 1
      }
      say(`${added} קבצים נוספו לתיק הנכס`)
      if (detail.status === 'published' && kind !== 'docs') setStale(true)
    } catch (e) { setError(e.message) }
    finally { setFileBusy(''); await refreshDetail(detail.id); await load() }
  }
  const deleteFile = async f => {
    if (!detail || !f?.path) return
    if (!window.confirm(`למחוק את הקובץ "${f.name}" לצמיתות מתיק הנכס?`)) return
    setFileBusy(`del:${f.path}`); setError('')
    try {
      const r = await fetch(`${API}?action=file&id=${encodeURIComponent(detail.id)}&path=${encodeURIComponent(f.path)}`, { method: 'DELETE', headers: H })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`)
      say('הקובץ נמחק')
      if (detail.status === 'published' && f.kind !== 'docs') setStale(true)
    } catch (e) { setError(e.message) }
    finally { setFileBusy(''); await refreshDetail(detail.id); await load() }
  }
  const AddFiles = ({ kind, label }) => (
    <>
      <input ref={el => { fileInputRef.current[kind] = el }} type="file" multiple accept={ACCEPT[kind]} style={{ display: 'none' }} onChange={e => { addFiles(kind, e.target.files); e.target.value = '' }}/>
      <button onClick={() => fileInputRef.current[kind]?.click()} disabled={!!fileBusy} style={btn()}><FaPlus size={10}/> {fileBusy === `up:${kind}` ? 'מעלה…' : label}</button>
    </>
  )

  const summary = useMemo(() => detail ? buildSummary(detail.answers || {}, 'he') : [], [detail])
  const copyText = txt => navigator.clipboard?.writeText(txt).then(() => say('הועתק'))
  const copySummary = () => {
    if (!detail) return
    const lines = [`תיק ${detail.ref} · ${headline(detail.answers || {}, 'he')}`, `${detail.contact_name} · ${detail.phone}${detail.email ? ' · ' + detail.email : ''}`, '']
    summary.forEach(sec => { lines.push(`— ${sec.title} —`); sec.items.forEach(it => lines.push(`${it.label}: ${it.value}`)); lines.push('') })
    copyText(lines.join('\n'))
  }
  const exportJson = () => { if (!detail) return; const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${detail.ref || 'property'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000) }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const j = r => r.journey || {}
    return rows.filter(r => (filter === 'all' ? r.status !== 'draft' : filter === 'backup' ? r.status === 'backup' : filter === 'draft' ? r.status === 'draft' : filter === 'unverified' ? (r.submitted_at && !r.owner_verified_at)
        : filter === 'j_stalled' ? (r.status === 'draft' && j(r).stalled) : filter === 'j_active' ? (r.status === 'draft' && !j(r).stalled && ['started', 'in_progress', 'review'].includes(j(r).stage))
        : filter === 'j_opened' ? (r.status === 'draft' && j(r).stage === 'opened') : filter === 'j_invited' ? (r.status === 'draft' && j(r).stage === 'invited') : r.status === filter)
      && (purpose === 'all' || (r.purpose || 'sale') === purpose)
      && (!s || [r.ref, r.contact_name, r.phone, r.email, r.city, r.address, r.property_type_label].some(x => String(x || '').toLowerCase().includes(s))))
  }, [rows, q, filter, purpose])
  const counts = useMemo(() => rows.reduce((m, r) => {
    m[r.status] = (m[r.status] || 0) + 1; if (r.submitted_at && !r.owner_verified_at) m.unverified = (m.unverified || 0) + 1
    const j = r.journey || {}
    if (r.status === 'draft') { if (j.stage === 'invited') m.j_invited = (m.j_invited || 0) + 1; else if (j.stage === 'opened') m.j_opened = (m.j_opened || 0) + 1; else if (j.stalled) m.j_stalled = (m.j_stalled || 0) + 1; else if (['started', 'in_progress', 'review'].includes(j.stage)) m.j_active = (m.j_active || 0) + 1 }
    return m
  }, {}), [rows])
  // Funnel for the last 30 days: how many got a link, opened, started, reached the summary, sent
  const funnel = useMemo(() => {
    const since = Date.now() - 30 * 86400000
    const recent = rows.filter(r => new Date(r.created_at || 0).getTime() >= since)
    const j = r => r.journey || {}
    const has = f => recent.filter(f).length
    return { total: recent.length, invited: has(r => j(r).invited_at), opened: has(r => j(r).opened_at || j(r).started_at || r.submitted_at), started: has(r => j(r).started_at || (j(r).answered > 0) || r.submitted_at), review: has(r => j(r).review_at || r.submitted_at), submitted: has(r => r.submitted_at) }
  }, [rows])

  const purple = C?.purple || '#8490D8'
  const card = { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(132,144,216,.14)', borderRadius: 12 }
  const btn = (extra = {}) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(132,144,216,.3)', background: 'rgba(132,144,216,.1)', color: purple, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', ...extra })
  const input = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid rgba(132,144,216,.2)', background: 'rgba(255,255,255,.04)', color: '#E8E4D8', fontFamily: 'inherit', fontSize: 13 }
  const label = { fontSize: 11, color: 'rgba(232,228,216,.5)', letterSpacing: '.06em', marginBottom: 4, display: 'block' }
  const canPublish = detail && ['approved', 'published'].includes(detail.status) && detail.submitted_at
  // Repopulate: everything the seller filled (and uploaded) lands in the office's property wizard, ready to review and publish
  const openInWizard = async () => {
    if (!detail || !onOpenWizard) return
    setBusy('prepare')
    try {
      const r = await fetch(`${API}?action=prepare&id=${encodeURIComponent(detail.id)}`, { method: 'POST', headers: H })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`)
      say(`נפתח באשף עם ${d.images} תמונות${d.videos ? ` ו-${d.videos} סרטונים` : ''}`)
      await onOpenWizard(d.property, detail.id)
      refreshDetail(detail.id)
    } catch (e) { setError(e.message) } finally { setBusy('') }
  }
  const TABS = [
    { id: 'general', l: 'כללי', Icon: FaInfoCircle }, { id: 'legal', l: 'משפטי', Icon: FaBalanceScale }, { id: 'commercial', l: 'מסחרי', Icon: FaMoneyBill },
    { id: 'media', l: 'מדיה', Icon: FaImage, badge: detail ? (detail.files || []).filter(f => f.kind !== 'docs').length : 0 }, { id: 'docs', l: 'מסמכים', Icon: FaFileAlt, badge: detail ? (detail.files || []).filter(f => f.kind === 'docs').length : 0 },
    { id: 'marketing', l: 'שיווק', Icon: FaBullhorn }, { id: 'history', l: 'היסטוריה', Icon: FaHistory, badge: detail ? (detail.history || []).length : 0 },
  ]

  const Section = ({ sec }) => (
    <div style={{ ...card, padding: '4px 16px', marginBottom: 10 }}>
      <h3 style={{ fontSize: 12, letterSpacing: '.12em', color: purple, margin: '12px 0 4px', fontWeight: 700 }}>{sec.title}</h3>
      {sec.items.map(it => (
        <div key={it.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: '1px solid rgba(132,144,216,.1)', fontSize: 13 }}>
          <span style={{ flex: '0 0 36%', color: 'rgba(232,228,216,.55)', lineHeight: 1.4 }}>{it.label}</span>
          <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>{it.value}</span>
        </div>
      ))}
    </div>
  )
  const FileGrid = ({ files }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
      {files.map((f, i) => (
        <div key={f.path || i} style={{ ...card, overflow: 'hidden', position: 'relative', opacity: fileBusy === `del:${f.path}` ? .4 : 1 }}>
          <a href={f.url || '#'} target="_blank" rel="noreferrer" title={f.name} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <div style={{ height: 96, background: 'rgba(132,144,216,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: purple, overflow: 'hidden' }}>
              {f.url && String(f.type || '').startsWith('image/') ? <img src={f.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : String(f.type || '').startsWith('video/') ? <FaVideo size={22}/> : <FaFileAlt size={22}/>}
            </div>
            <div style={{ padding: '6px 8px', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.tag ? DOC_TAG_LABEL(f.tag, 'he') : f.name}</div>
            <div style={{ padding: '0 8px 6px', fontSize: 10, color: 'rgba(232,228,216,.45)', display: 'flex', justifyContent: 'space-between' }}><span>{f.size ? `${Math.round(f.size / 1024)}KB` : ''}</span><FaExternalLinkAlt size={9}/></div>
          </a>
          <button onClick={() => deleteFile(f)} disabled={!!fileBusy} title="מחיקת הקובץ" style={{ position: 'absolute', top: 6, left: 6, width: 24, height: 24, borderRadius: 6, border: 0, background: 'rgba(224,82,82,.85)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes size={10}/></button>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 18, height: '100%', minHeight: 0, direction: 'rtl', color: '#E8E4D8' }}>
      {/* ── list ── */}
      <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', minHeight: 0, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>נכסים שנקלטו <span style={{ fontSize: 12, color: purple, fontWeight: 600 }}>{rows.filter(r => r.status !== 'draft').length}</span></div>
            <div style={{ fontSize: 11.5, color: 'rgba(232,228,216,.5)' }}>נכסים מהטופס <a href="/newproperty" target="_blank" rel="noreferrer" style={{ color: purple }}>/newproperty</a> · נפרד מהלידים · <span title={backupInfo.enabled ? 'טפסים שמגיעים כשסופאבייס לא זמין נשמרים ב-Vercel Blob ונשלחים במייל ובוואטסאפ' : 'להפעלת מאגר גיבוי: Vercel → Storage → Create → Blob'} style={{ color: backupInfo.enabled ? '#22C55E' : '#F5A623' }}>{backupInfo.enabled ? 'גיבוי פעיל ✓' : 'ללא מאגר גיבוי'}</span> · <a href={backupInfo.archive?.url || 'https://github.com/afikhanahal-creator/afik-hanahal-records'} target="_blank" rel="noreferrer" title={backupInfo.archive?.enabled ? 'כל טופס נשמר גם כקובץ במאגר GitHub פרטי של המשרד' : 'להפעלת הארכיון: צרו מאגר פרטי afik-hanahal-records והוסיפו GITHUB_ARCHIVE_TOKEN ב-Vercel'} style={{ color: backupInfo.archive?.enabled ? '#22C55E' : '#F5A623' }}>{backupInfo.archive?.enabled ? 'ארכיון GitHub פעיל ✓' : 'ארכיון GitHub לא מוגדר'}</a></div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { setInviteOpen(o => !o); setInviteResult(null) }} title="קישור אישי ללקוח: רואים אם פתח, התחיל ואיפה עצר" style={btn(inviteOpen ? { background: 'rgba(132,144,216,.25)' } : {})}><FaUserPlus size={11}/> הזמנת לקוח</button>
            <button onClick={() => copyText(`${window.location.origin}/newproperty`)} title="העתקת קישור הטופס" style={btn()}><FaLink size={11}/></button>
            <button onClick={load} title="רענון" style={btn()}><FaSyncAlt size={11} style={loading ? { animation: 'spin 1s linear infinite' } : undefined}/></button>
          </div>
        </div>
        {inviteOpen && (
          <div style={{ ...card, padding: '12px 14px', borderColor: 'rgba(132,144,216,.35)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>קישור אישי ללקוח</div>
            <div style={{ fontSize: 11, color: 'rgba(232,228,216,.55)', marginBottom: 8 }}>הטופס נפתח עם השם והטלפון כבר מלאים, ותראו כאן אם הלקוח פתח, התחיל ואיפה עצר.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <input value={invite.name} onChange={e => setInvite(v => ({ ...v, name: e.target.value }))} placeholder="שם הלקוח" style={input}/>
              <input value={invite.phone} onChange={e => setInvite(v => ({ ...v, phone: e.target.value }))} placeholder="טלפון" dir="ltr" style={{ ...input, textAlign: 'right' }}/>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              {[['sale', 'למכירה'], ['rental', 'להשכרה']].map(([v, l]) => <button key={v} onClick={() => setInvite(x => ({ ...x, purpose: v }))} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${invite.purpose === v ? purple : 'rgba(132,144,216,.2)'}`, background: invite.purpose === v ? 'rgba(132,144,216,.18)' : 'transparent', color: invite.purpose === v ? '#fff' : 'rgba(232,228,216,.6)' }}>{l}</button>)}
              <label style={{ fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', marginInlineStart: 'auto' }}><input type="checkbox" checked={invite.send} onChange={e => setInvite(v => ({ ...v, send: e.target.checked }))}/> לשלוח בוואטסאפ</label>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button onClick={sendInvite} disabled={busy === 'invite'} style={btn({ background: 'rgba(37,211,102,.14)', borderColor: 'rgba(37,211,102,.45)', color: '#25D366' })}><FaWhatsapp size={12}/> {invite.send ? 'צור ושלח' : 'צור קישור'}</button>
              <button onClick={() => setInviteOpen(false)} style={btn()}>סגור</button>
            </div>
            {inviteResult && (
              <div style={{ marginTop: 10, fontSize: 11.5 }}>
                <div style={{ color: inviteResult.sent ? '#22C55E' : '#F5A623' }}>{inviteResult.sent ? 'נשלח בוואטסאפ ✓' : invite.send ? `לא נשלח (${inviteResult.error || 'Green API לא מוגדר'}). אפשר להעתיק ולשלוח ידנית:` : 'הקישור מוכן:'}</div>
                <div dir="ltr" style={{ fontFamily: 'monospace', fontSize: 11, background: 'rgba(0,0,0,.25)', borderRadius: 6, padding: '6px 8px', marginTop: 4, wordBreak: 'break-all' }}>{inviteResult.url}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={() => copyText(inviteResult.url)} style={btn()}><FaCopy size={10}/> העתק קישור</button>
                  <button onClick={() => copyText(inviteResult.message)} style={btn()}><FaCopy size={10}/> העתק הודעה</button>
                  <a href={`https://wa.me/${toIntl(invite.phone)}?text=${encodeURIComponent(inviteResult.message || inviteResult.url)}`} target="_blank" rel="noreferrer" style={btn({ color: '#25D366', borderColor: 'rgba(37,211,102,.4)' })}><FaWhatsapp size={10}/> פתח בוואטסאפ</a>
                </div>
              </div>
            )}
          </div>
        )}
        {funnel.total > 0 && (
          <div style={{ ...card, padding: '9px 12px' }} title="30 הימים האחרונים">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'rgba(232,228,216,.5)', letterSpacing: '.06em', marginBottom: 6 }}><FaRoute size={10}/> מסע הלקוח · 30 יום</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, textAlign: 'center' }}>
              {[['הוזמנו', funnel.invited, '#9A9AA8'], ['פתחו', funnel.opened, '#F5A623'], ['התחילו', funnel.started, '#60D4F7'], ['לסיכום', funnel.review, '#C084FC'], ['שלחו', funnel.submitted, '#22C55E']].map(([l, n, c]) => (
                <div key={l} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '5px 2px' }}><div style={{ fontSize: 16, fontWeight: 800, color: c }}>{n}</div><div style={{ fontSize: 10, color: 'rgba(232,228,216,.55)' }}>{l}</div></div>
              ))}
            </div>
            {(counts.j_stalled || counts.j_opened) ? <div style={{ fontSize: 11, color: '#F5A623', marginTop: 7 }}>{[counts.j_stalled ? `${counts.j_stalled} נעצרו באמצע` : '', counts.j_opened ? `${counts.j_opened} פתחו ולא התחילו` : ''].filter(Boolean).join(' · ')} — כדאי לשלוח תזכורת.</div> : null}
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <FaSearch size={12} style={{ position: 'absolute', right: 12, top: 11, color: 'rgba(232,228,216,.4)' }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש לפי שם, טלפון, עיר, מספר תיק…" style={{ ...input, padding: '9px 34px 9px 12px', borderRadius: 10 }}/>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[{ v: 'all', l: 'הכל' }, ...(counts.backup ? [{ v: 'backup', l: 'גיבוי (Supabase לא זמין)', color: '#F5A623' }] : []), ...INTAKE_STATUSES.filter(s => s.v !== 'draft'), { v: 'unverified', l: 'ממתין לאימות בעלים', color: '#F5A623' },
            { v: 'j_active', l: 'בתהליך', color: '#60D4F7' }, { v: 'j_stalled', l: 'נעצרו', color: '#E05252' }, { v: 'j_opened', l: 'פתחו ולא התחילו', color: '#F5A623' }, { v: 'j_invited', l: 'הוזמנו ולא פתחו', color: '#9A9AA8' }, { v: 'draft', l: 'כל הטיוטות', color: '#9A9AA8' }].map(s => (
            <button key={s.v} onClick={() => setFilter(s.v)} style={{ padding: '4px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${filter === s.v ? (s.color || purple) : 'rgba(132,144,216,.2)'}`, background: filter === s.v ? `${s.color || purple}22` : 'transparent', color: filter === s.v ? (s.color || purple) : 'rgba(232,228,216,.6)' }}>
              {s.l}{s.v !== 'all' && counts[s.v] ? ` · ${counts[s.v]}` : ''}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[{ v: 'all', l: 'מכירה והשכרה' }, { v: 'sale', l: 'למכירה' }, { v: 'rental', l: 'להשכרה' }].map(x => (
            <button key={x.v} onClick={() => setPurpose(x.v)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${purpose === x.v ? purple : 'rgba(132,144,216,.2)'}`, background: purpose === x.v ? `${purple}22` : 'transparent', color: purpose === x.v ? purple : 'rgba(232,228,216,.6)' }}>{x.l}</button>
          ))}
        </div>
        {error && <div style={{ fontSize: 12, color: '#E05252', background: 'rgba(224,82,82,.1)', border: '1px solid rgba(224,82,82,.3)', borderRadius: 8, padding: '8px 10px' }}>{error}</div>}
        {flash && <div style={{ fontSize: 12, color: '#22C55E', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', borderRadius: 8, padding: '8px 10px' }}>{flash}</div>}
        <div className="admin-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
          {loading && !rows.length && <div style={{ color: 'rgba(232,228,216,.5)', fontSize: 13, padding: 20, textAlign: 'center' }}>טוען…</div>}
          {!loading && !filtered.length && <div style={{ color: 'rgba(232,228,216,.5)', fontSize: 13, padding: 20, textAlign: 'center' }}>{rows.length ? 'אין נכסים בסינון הזה' : 'עדיין לא נקלטו נכסים. שלחו למוכרים את הקישור /newproperty.'}</div>}
          {filtered.map(r => {
            const st = statusOf(r.status); const on = r.id === selId
            return (
              <button key={r.id} onClick={() => open(r.id)} style={{ ...card, textAlign: 'right', padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', borderColor: on ? purple : 'rgba(132,144,216,.14)', background: on ? 'rgba(132,144,216,.12)' : 'rgba(255,255,255,.03)', transition: 'all .15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{r.contact_name || (r.status === 'draft' ? 'טיוטה ללא שם' : '—')} <span style={{ fontSize: 10, fontWeight: 700, color: r.purpose === 'rental' ? '#60D4F7' : purple, background: r.purpose === 'rental' ? 'rgba(96,212,247,.12)' : 'rgba(132,144,216,.12)', borderRadius: 4, padding: '1px 6px', marginRight: 6 }}>{r.purpose === 'rental' ? 'להשכרה' : 'למכירה'}</span></span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: st.color, background: `${st.color}1F`, border: `1px solid ${st.color}55`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>{st.l}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(232,228,216,.75)', marginTop: 3 }}>{[r.property_type_label, [r.address, r.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'rgba(232,228,216,.45)', gap: 6 }}>
                  <span dir="ltr">{r.ref || ''}</span>
                  <span>{r.asking_price ? `₪${fmtNum(r.asking_price, 'he')}` : ''}{r.photos_count ? ` · ${r.photos_count} תמונות` : ''}</span>
                  <span>{r.submitted_at && !r.owner_verified_at ? <span style={{ color: '#F5A623' }}>ממתין לאימות</span> : r.owner_verified_at ? <span style={{ color: '#22C55E' }}>אומת ✓</span> : ''}</span>
                </div>
                {r.status === 'draft' && r.journey
                  ? <JourneyLine j={r.journey} compact/>
                  : <div style={{ fontSize: 10.5, color: 'rgba(232,228,216,.35)', marginTop: 4 }}>{`התקבל ${fmtDate(r.submitted_at || r.created_at)}`}</div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── property card ── */}
      <div className="admin-scroll" style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', ...card, padding: 0 }}>
        {!selId && <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,228,216,.4)', fontSize: 14, padding: 40, textAlign: 'center' }}>בחרו נכס מהרשימה כדי לפתוח את כרטיס הנכס</div>}
        {selId && detailLoading && <div style={{ padding: 40, textAlign: 'center', color: 'rgba(232,228,216,.5)' }}>טוען כרטיס נכס…</div>}
        {detail && !detailLoading && (
          <div style={{ padding: '20px 22px 30px' }}>
            {/* header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, letterSpacing: '.14em', color: purple, fontWeight: 700 }}>תיק <span dir="ltr">{detail.ref || 'טיוטה'}</span> · {detail.submitted_at ? `התקבל ${fmtDate(detail.submitted_at)}` : `טיוטה, נערכה ${fmtDate(detail.draft_updated_at)}`}{detail.lang === 'en' ? ' · מולא באנגלית' : ''}</div>
                <h2 style={{ margin: '6px 0 4px', fontSize: 21, fontWeight: 800 }}>{ov.title || headline(detail.answers || {}, 'he') || PROPERTY_TYPE_LABEL(detail.property_type, 'he') || 'נכס'}</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 13, color: 'rgba(232,228,216,.8)', alignItems: 'center' }}>
                  <b>{detail.contact_name}</b>
                  {detail.phone && <a href={`https://wa.me/${toIntl(detail.phone)}`} target="_blank" rel="noreferrer" style={btn({ background: 'rgba(37,211,102,.12)', borderColor: 'rgba(37,211,102,.4)', color: '#25D366' })}><FaWhatsapp size={12}/> <span dir="ltr">{detail.phone}</span></a>}
                  {detail.phone && <a href={`tel:${detail.phone}`} style={btn()}><FaPhone size={11}/></a>}
                  {detail.email && <a href={`mailto:${detail.email}`} style={btn()}><FaEnvelope size={11}/> {detail.email}</a>}
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: detail.owner_verified_at ? '#22C55E' : '#F5A623', background: detail.owner_verified_at ? 'rgba(34,197,94,.12)' : 'rgba(245,166,35,.12)', border: `1px solid ${detail.owner_verified_at ? 'rgba(34,197,94,.4)' : 'rgba(245,166,35,.4)'}`, borderRadius: 20, padding: '3px 10px' }}>
                    <FaShieldAlt size={10} style={{ marginLeft: 4 }}/>{detail.owner_verified_at ? `אומת על ידי ${(detail.verifications || []).map(v => v.name).join(', ')}` : 'ממתין לאימות בעלים'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {!detail.backup && <select value={detail.status || 'new'} onChange={e => setStatus(detail.id, e.target.value)} disabled={detail.status === 'published'}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${statusOf(detail.status).color}66`, background: `${statusOf(detail.status).color}1A`, color: statusOf(detail.status).color, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700 }}>
                  {INTAKE_STATUSES.filter(s => s.v !== 'published' || detail.status === 'published').map(s => <option key={s.v} value={s.v} style={{ color: '#111' }}>{s.l}</option>)}
                </select>}
                {onOpenWizard && detail.submitted_at && !detail.backup && <button onClick={openInWizard} disabled={!!busy} title="כל השדות, התמונות והסרטונים נטענים לאשף הנכסים — עוברים, מאשרים ומפרסמים" style={btn({ background: 'rgba(132,144,216,.14)', borderColor: 'rgba(132,144,216,.5)', color: '#C9CEF5', fontWeight: 700 })}><FaSyncAlt size={11}/> {busy === 'prepare' ? 'מכין…' : 'פתח באשף הנכסים (ממולא)'}</button>}
                {detail.status === 'published'
                  ? <><button onClick={() => act('publish')} disabled={!!busy} style={btn({ background: 'rgba(34,197,94,.12)', borderColor: 'rgba(34,197,94,.4)', color: '#22C55E' })}><FaGlobe size={11}/> {busy === 'publish' ? 'מעדכן…' : 'עדכן באתר'}</button>
                     <button onClick={() => act('unpublish')} disabled={!!busy} style={btn({ color: '#F5A623', borderColor: 'rgba(245,166,35,.4)', background: 'rgba(245,166,35,.08)' })}><FaEyeSlash size={11}/> {busy === 'unpublish' ? 'מסיר…' : 'הסר מהאתר'}</button></>
                  : <button onClick={() => act('publish')} disabled={!canPublish || !!busy} title={canPublish ? '' : 'אפשר לפרסם רק נכס במצב "מאושר"'} style={btn({ background: canPublish ? 'rgba(34,197,94,.12)' : 'rgba(255,255,255,.04)', borderColor: canPublish ? 'rgba(34,197,94,.4)' : 'rgba(132,144,216,.15)', color: canPublish ? '#22C55E' : 'rgba(232,228,216,.35)', cursor: canPublish ? 'pointer' : 'not-allowed' })}><FaGlobe size={11}/> {busy === 'publish' ? 'מפרסם…' : 'פרסם באתר'}</button>}
                {detail.public_url && <a href={detail.public_url} target="_blank" rel="noreferrer" style={btn()}><FaLink size={11}/> דף הסיכום</a>}
                <button onClick={copySummary} style={btn()}><FaCopy size={11}/></button>
                <button onClick={exportJson} style={btn()}><FaDownload size={11}/></button>
                {detail.status !== 'published' && !detail.backup && <button onClick={() => remove(detail.id, false)} style={btn({ color: '#E05252', borderColor: 'rgba(224,82,82,.35)', background: 'rgba(224,82,82,.08)' })}><FaTrash size={11}/></button>}
              </div>
            </div>

            {detail.backup && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 12.5, color: '#F5A623', background: 'rgba(245,166,35,.1)', border: '1px solid rgba(245,166,35,.35)', borderRadius: 10, padding: '10px 12px', flexWrap: 'wrap' }}>
                <FaExclamationTriangle size={12}/> הטופס הזה הגיע כש-Supabase לא היה זמין{detail.supabase_error ? ` (${detail.supabase_error.slice(0, 80)})` : ''}. הוא שמור במאגר הגיבוי של Vercel עם כל הפרטים והסיכום. כשסופאבייס חוזר לעבוד, שחזרו אותו כדי לפרסם ולנהל כרגיל.
                <button onClick={restoreBackup} disabled={busy === 'restore'} style={btn({ background: 'rgba(34,197,94,.12)', borderColor: 'rgba(34,197,94,.4)', color: '#22C55E' })}><FaSyncAlt size={11}/> שחזר לסופאבייס</button>
              </div>
            )}
            {stale && detail.status === 'published' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 12.5, color: '#F5A623', background: 'rgba(245,166,35,.1)', border: '1px solid rgba(245,166,35,.35)', borderRadius: 8, padding: '8px 12px' }}>
                <FaExclamationTriangle size={12}/> יש שינויים בכרטיס הנכס שעדיין לא פורסמו באתר.
                <button onClick={() => act('publish')} disabled={!!busy} style={btn({ background: 'rgba(34,197,94,.12)', borderColor: 'rgba(34,197,94,.4)', color: '#22C55E' })}><FaGlobe size={11}/> {busy === 'publish' ? 'מעדכן…' : 'עדכן באתר עכשיו'}</button>
              </div>
            )}

            {detail.journey && !detail.submitted_at && (
              <div style={{ ...card, padding: '12px 14px', marginTop: 14, borderColor: `${stageOf(detail.journey.stage).color}55` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}><FaRoute size={11} style={{ color: purple }}/> מסע הלקוח</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {detail.phone && <button onClick={remind} disabled={busy === 'remind'} style={btn({ background: 'rgba(37,211,102,.12)', borderColor: 'rgba(37,211,102,.4)', color: '#25D366' })}><FaBell size={10}/> תזכורת בוואטסאפ</button>}
                    {detail.form_url && <button onClick={() => copyText(detail.form_url)} style={btn()}><FaCopy size={10}/> העתק קישור אישי</button>}
                    {detail.form_url && <a href={detail.form_url} target="_blank" rel="noreferrer" style={btn()}><FaExternalLinkAlt size={10}/> פתח את הטופס</a>}
                  </div>
                </div>
                <JourneyLine j={detail.journey}/>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 12 }}>
                  {[['הוזמנו', detail.journey.invited_at], ['פתחו', detail.journey.opened_at], ['התחילו', detail.journey.started_at], ['הגיעו לסיכום', detail.journey.review_at], ['נראו לאחרונה', detail.journey.last_seen_at]].map(([k, v]) => (
                    <div key={k} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '7px 10px' }}>
                      <div style={{ fontSize: 10, color: 'rgba(232,228,216,.5)', letterSpacing: '.06em' }}>{k}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2, color: v ? '#E8E4D8' : 'rgba(232,228,216,.3)' }}>{v ? fmtDate(v) : '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* key facts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, margin: '18px 0 14px' }}>
              {[
                [detail.purpose === 'rental' ? 'שכירות חודשית מבוקשת' : 'מחיר מבוקש', detail.asking_price ? `₪${fmtNum(detail.asking_price, 'he')}${detail.purpose === 'rental' ? ' לחודש' : ''}` : '—'],
                ['סוג עסקה', detail.purpose === 'rental' ? 'השכרה' : 'מכירה'],
                ['מחיר מינימום (פנימי)', detail.answers?.d_min ? `₪${fmtNum(detail.answers.d_min, 'he')}` : (ov.minPrice ? `₪${fmtNum(ov.minPrice, 'he')}` : '—')],
                ['סוג נכס', PROPERTY_TYPE_LABEL(detail.property_type, 'he') || '—'],
                ['כתובת', [detail.address, detail.city].filter(Boolean).join(', ') || '—'],
                ['באתר', detail.published_property_id ? `נכס ${detail.published_property_id}` : 'לא פורסם'],
              ].map(([k, v]) => (
                <div key={k} style={{ ...card, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10.5, color: 'rgba(232,228,216,.5)', letterSpacing: '.06em' }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2, wordBreak: 'break-word' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* tabs */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid rgba(132,144,216,.14)', marginBottom: 14 }}>
              {TABS.map(x => (
                <button key={x.id} onClick={() => setTab(x.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 12px', border: 0, borderBottom: `2px solid ${tab === x.id ? purple : 'transparent'}`, background: 'none', color: tab === x.id ? purple : 'rgba(232,228,216,.6)', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  <x.Icon size={11}/>{x.l}{x.badge ? <span style={{ fontSize: 10, background: 'rgba(132,144,216,.18)', borderRadius: 10, padding: '0 6px' }}>{x.badge}</span> : null}
                </button>
              ))}
            </div>

            {tab === 'general' && summary.filter(s => SECTION_GROUPS.general.includes(s.section)).map(sec => <Section key={sec.section} sec={sec}/>)}

            {tab === 'legal' && (
              <>
                <div style={{ fontSize: 12, color: '#F5A623', background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.3)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>המידע המשפטי נמסר על ידי המוכר לצורך קליטת הנכס ואינו תחליף לבדיקה משפטית. יש לאמת מול נסח טאבו ומסמכים.</div>
                {summary.filter(s => SECTION_GROUPS.legal.includes(s.section)).map(sec => <Section key={sec.section} sec={sec}/>)}
              </>
            )}

            {tab === 'commercial' && (
              <>
                {summary.filter(s => s.section === 'price').map(sec => <Section key={sec.section} sec={sec}/>)}
                <div style={{ ...card, padding: 14, marginTop: 4 }}>
                  <h3 style={{ fontSize: 12, letterSpacing: '.12em', color: purple, margin: '0 0 10px', fontWeight: 700 }}>נתוני פרסום (דורסים את התשובות בעת הפרסום באתר)</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <div><span style={label}>כותרת באתר</span><input style={input} value={ov.title || ''} onChange={e => setOv({ ...ov, title: e.target.value })} placeholder={headline(detail.answers || {}, 'he')}/></div>
                    <div><span style={label}>מחיר לפרסום (₪)</span><input style={input} value={ov.price ?? ''} onChange={e => setOv({ ...ov, price: e.target.value.replace(/[^\d]/g, '') })} placeholder={detail.asking_price ? String(detail.asking_price) : ''} inputMode="numeric"/></div>
                    <div><span style={label}>מחיר מינימום פנימי (₪)</span><input style={input} value={ov.minPrice ?? ''} onChange={e => setOv({ ...ov, minPrice: e.target.value.replace(/[^\d]/g, '') })} placeholder={detail.answers?.d_min ? String(detail.answers.d_min) : ''} inputMode="numeric"/></div>
                    <div><span style={label}>חדרים</span><input style={input} value={ov.rooms ?? ''} onChange={e => setOv({ ...ov, rooms: e.target.value })} placeholder={detail.answers?.p_rooms || ''}/></div>
                    <div><span style={label}>שטח (מ״ר)</span><input style={input} value={ov.size ?? ''} onChange={e => setOv({ ...ov, size: e.target.value.replace(/[^\d.]/g, '') })} placeholder={detail.answers?.p_area?.built ? String(detail.answers.p_area.built) : ''} inputMode="decimal"/></div>
                    <div><span style={label}>סוג באתר</span><input style={input} value={ov.type || ''} onChange={e => setOv({ ...ov, type: e.target.value })} placeholder={PROPERTY_TYPE_LABEL(detail.property_type, 'he')}/></div>
                    <div><span style={label}>קטגוריה באתר</span><select style={input} value={ov.category || ''} onChange={e => setOv({ ...ov, category: e.target.value })}><option value="">אוטומטי ({detail.purpose === 'rental' ? 'נכסים להשכרה' : 'לפי סוג הנכס'})</option><option value="apartments">דירות למכירה</option><option value="rentals">נכסים להשכרה</option><option value="projects">פרוייקטים</option><option value="land">מגרשים וקרקעות</option><option value="commercial">נכסים מסחריים</option></select></div>
                    <div><span style={label}>כתובת מדויקת באתר</span><select style={input} value={ov.showAddress === undefined ? '' : ov.showAddress ? '1' : '0'} onChange={e => setOv({ ...ov, showAddress: e.target.value === '' ? undefined : e.target.value === '1' })}><option value="">לפי בחירת המוכר ({detail.answers?.c_privacy?.showAddress ? 'להציג' : 'להסתיר'})</option><option value="1">להציג</option><option value="0">להסתיר</option></select></div>
                    <div><span style={label}>טלפון המוכר באתר</span><select style={input} value={ov.showPhone === undefined ? '' : ov.showPhone ? '1' : '0'} onChange={e => setOv({ ...ov, showPhone: e.target.value === '' ? undefined : e.target.value === '1' })}><option value="">לפי בחירת המוכר ({detail.answers?.c_privacy?.publishPhone ? 'להציג' : 'להסתיר'})</option><option value="1">להציג</option><option value="0">להסתיר</option></select></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 12 }}><button onClick={saveOverrides} disabled={saving === 'ov'} style={btn()}><FaSave size={11}/> {saving === 'ov' ? 'שומר…' : 'שמירת נתוני פרסום'}</button></div>
                </div>
                <div style={{ ...card, padding: 14, marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 12, letterSpacing: '.12em', color: purple, margin: 0, fontWeight: 700 }}>הערות פנימיות</h3>
                    <button onClick={saveNotes} disabled={saving === 'notes'} style={btn()}>{saving === 'notes' ? 'שומר…' : <><FaSave size={11}/> שמירת הערות</>}</button>
                  </div>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} placeholder="סיכום שיחה, הערכת שווי, משימות פתוחות…" style={{ ...input, resize: 'vertical' }}/>
                </div>
              </>
            )}

            {tab === 'media' && (
              <>
                {['photos', 'videos', 'plan'].map(kind => { const list = (detail.files || []).filter(f => f.kind === kind); return (
                  <div key={kind} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: 'rgba(232,228,216,.6)' }}>{KIND_LABEL[kind]} · {list.length}</div>
                      <AddFiles kind={kind} label={`הוספת ${KIND_LABEL[kind]}`}/>
                    </div>
                    {list.length ? <FileGrid files={list}/> : <div style={{ color: 'rgba(232,228,216,.35)', fontSize: 12 }}>אין {KIND_LABEL[kind]} בתיק.</div>}
                  </div>) })}
                <div style={{ fontSize: 10.5, color: 'rgba(232,228,216,.4)', marginTop: 6 }}>ספריית המדיה של הנכס: כל הקבצים נשמרים באחסון המערכת בתיקייה של הנכס ומשמשים לפרסום באתר ולשיווק. הקישורים תקפים לשעה, רענון הכרטיס מנפיק קישורים חדשים. מחיקת קובץ היא לצמיתות.</div>
              </>
            )}

            {tab === 'docs' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><AddFiles kind="docs" label="הוספת מסמך"/></div>
                {(detail.files || []).filter(f => f.kind === 'docs').length ? <FileGrid files={(detail.files || []).filter(f => f.kind === 'docs')}/> : <div style={{ color: 'rgba(232,228,216,.45)', fontSize: 13 }}>לא הועלו מסמכים.</div>}
              </>
            )}

            {tab === 'marketing' && (
              <>
                <AiStudio detail={detail} ov={ov} setOv={setOv} saving={saving} copyText={copyText} say={say} styles={{ card, btn, purple }}
                  onSave={async next => { setSaving('ov'); try { await patch(detail.id, { overrides: next }); await refreshDetail(detail.id); say('הטקסט נשמר בכרטיס הנכס') } catch (e) { setError(e.message) } finally { setSaving('') } }}/>
                <Yad2Card detail={detail} ov={ov} copyText={copyText} styles={{ card, btn }}/>
                {detail.share_token && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    <a href={`/newproperty/${detail.share_token}`} target="_blank" rel="noreferrer" style={{ ...btn(), textDecoration: 'none' }}><FaExternalLinkAlt size={10}/> דף הסיכום הציבורי</a>
                    <a href={`/newproperty/${detail.share_token}?print=1`} target="_blank" rel="noreferrer" style={{ ...btn(), textDecoration: 'none' }}><FaDownload size={10}/> הדפסה / שמירה כ-PDF</a>
                  </div>
                )}
                {(() => { const mk = marketingTexts(detail.answers || {}); return (
                  <div style={{ ...card, padding: '14px 16px', marginBottom: 10, borderColor: 'rgba(34,197,94,.3)' }}>
                    <h3 style={{ fontSize: 12, letterSpacing: '.12em', color: '#22C55E', margin: '0 0 4px', fontWeight: 700 }}>טקסטים מוכנים לשיווק</h3>
                    <div style={{ fontSize: 11.5, color: 'rgba(232,228,216,.5)', marginBottom: 10 }}>נבנים אוטומטית מהתשובות. העתיקו, ערכו אם צריך, ופרסמו.</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                      {[['פוסט לפייסבוק / אינסטגרם', mk.post], ['הודעת וואטסאפ', mk.wa], ['שורת מודעה', mk.short]].map(([title, text]) => (
                        <div key={title} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(132,144,216,.14)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <b style={{ fontSize: 12.5 }}>{title}</b>
                            <button onClick={() => copyText(text)} style={btn()}><FaCopy size={11}/> העתקה</button>
                          </div>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.6, color: 'rgba(232,228,216,.85)' }}>{text}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ) })()}
                {detail.story && (
                  <div style={{ ...card, padding: '14px 16px', marginBottom: 10, borderColor: 'rgba(132,144,216,.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <h3 style={{ fontSize: 12, letterSpacing: '.12em', color: purple, margin: 0, fontWeight: 700 }}>סיפור הנכס</h3>
                      <button onClick={() => copyText(detail.story)} style={btn()}><FaCopy size={11}/> העתקה</button>
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'rgba(232,228,216,.9)' }}>{detail.story}</div>
                  </div>
                )}
                {summary.filter(s => SECTION_GROUPS.marketing.includes(s.section)).map(sec => <Section key={sec.section} sec={sec}/>)}
                <div style={{ ...card, padding: 14 }}>
                  <span style={label}>תיאור לפרסום באתר (ריק = נבנה אוטומטית מהיתרונות ומהסיפור)</span>
                  <textarea value={ov.description || ''} onChange={e => setOv({ ...ov, description: e.target.value })} rows={6} style={{ ...input, resize: 'vertical' }} placeholder={[detail.answers?.m_pros, detail.answers?.m_unique, detail.answers?.m_love, detail.answers?.m_story].filter(Boolean).join('\n\n')}/>
                  <div style={{ marginTop: 10 }}><button onClick={saveOverrides} disabled={saving === 'ov'} style={btn()}><FaSave size={11}/> {saving === 'ov' ? 'שומר…' : 'שמירת התיאור'}</button></div>
                </div>
              </>
            )}

            {tab === 'history' && (
              <div style={{ ...card, padding: '6px 16px' }}>
                {(detail.history || []).length === 0 && <div style={{ padding: 12, color: 'rgba(232,228,216,.45)', fontSize: 13 }}>אין עדיין אירועים.</div>}
                {[...(detail.history || [])].reverse().map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '9px 0', borderTop: i ? '1px solid rgba(132,144,216,.1)' : 0, fontSize: 13 }}>
                    <span style={{ flex: '0 0 130px', color: 'rgba(232,228,216,.5)', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(h.at)}</span>
                    <span style={{ flex: '0 0 70px', color: purple, fontWeight: 600 }}>{BY_LABEL[h.by] || h.by}</span>
                    <span style={{ flex: 1 }}>{HISTORY_LABEL[h.action] || h.action}{h.note ? <span style={{ color: 'rgba(232,228,216,.6)' }}> · {h.note}</span> : null}</span>
                  </div>
                ))}
                <div style={{ padding: '10px 0 8px', fontSize: 11, color: 'rgba(232,228,216,.4)', borderTop: '1px solid rgba(132,144,216,.1)' }}>
                  נוצר {fmtDate(detail.created_at)}{detail.submitted_at ? ` · נשלח ${fmtDate(detail.submitted_at)}` : ''}{detail.published_at ? ` · פורסם לראשונה ${fmtDate(detail.published_at)}` : ''}
                  {detail.form_url && <> · <a href={detail.form_url} target="_blank" rel="noreferrer" style={{ color: purple }}>קישור הטופס של המוכר</a></>}
                </div>
                {detail.status !== 'published' && <div style={{ padding: '6px 0 10px' }}><button onClick={() => remove(detail.id, true)} style={btn({ color: '#E05252', borderColor: 'rgba(224,82,82,.35)', background: 'rgba(224,82,82,.08)' })}><FaTrash size={11}/> מחיקה מלאה כולל מדיה</button></div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
