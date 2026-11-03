// Admin "תיבת הודעות" (/admin-panel/social): every conversation in one list — the office's WhatsApp line, and Messenger +
// Instagram of every page in the inbox (the leads' pages, Daniel's, Korkos… — switched on in "חשבונות מחוברים") — with a
// reply box and "הוסף כליד" (name, phone / email, project, stage, a note) → the CRM, with what was said as the first note.
// "חשבונות מחוברים" lists every page the Meta token reaches (in / out of the inbox), their Instagram accounts, the WhatsApp
// line, and imports the whole history in steps (Meta: every conversation × its last 100 messages; WhatsApp: every chat × 100).
// Server: api/meta.js handleSocial; rules: lib/social-hook.js; WhatsApp threads: server/social-inbox-migration.sql.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaFacebookMessenger, FaInstagram, FaWhatsapp } from 'react-icons/fa'
import { Search, Send, UserPlus, X, Check, RefreshCw, Link2, Plug, ExternalLink, AlertTriangle, MessageCircle, ZoomIn, ZoomOut, LayoutTemplate } from 'lucide-react'
import { onSync, debounce } from './lib/syncBus.js'
import WaFace, { FaceViewer } from './WaFace.jsx'
import Splitter, { SPLITTER_CSS } from './Splitter.jsx'
import ChatTemplatePicker, { ChatQuickChips, ChatTemplateMenu } from './ChatTemplatePicker.jsx'
import { DARK, LIGHT } from './waShared.jsx'
import { useSharedAutoConfig } from './lib/autoConfigStore.js'
import { useSharedLeads } from './lib/leadsStore.js'
import { useProjects } from './lib/projectsStore.js'
import { ProjectSelect } from './LeadProjects.jsx'

const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer AFIKhanahal2026' }
const api = (path, opts = {}) => fetch(`/api/meta/${path}`, { headers: AUTH, signal: AbortSignal.timeout(opts.timeout || 30000), ...opts })
  .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); return d })

const TXT = {
  he: {
    title: 'תיבת הודעות', sub: 'וואטסאפ, מסנג׳ר ואינסטגרם של כל העמודים במקום אחד. כל שיחה אפשר להפוך לליד ולשייך לפרויקט.',
    search: 'חיפוש שם, @, טלפון…', f: { all: 'הכל', unread: 'מחכים לנו', nolead: 'עוד לא ליד', whatsapp: 'וואטסאפ', messenger: 'מסנג׳ר', instagram: 'אינסטגרם' },
    allPages: 'כל העמודים', waLine: 'קו המשרד',
    empty: 'אין שיחות כאן', emptySub: 'הודעות חדשות יגיעו לכאן מעצמן. אפשר גם לייבא את כל ההיסטוריה מ"חשבונות מחוברים".',
    pick: 'בחרו שיחה מהרשימה', isLead: 'ליד', addLead: 'הוסף כליד', openLead: 'כרטיס הליד', reply: 'כתבו תשובה…', send: 'שליחה',
    sending: 'שולח…', foundPhone: 'כתבו טלפון', openMeta: 'פתיחה ב-Meta', openChats: 'פתיחה במסך הצ׳אטים', accounts: 'חשבונות מחוברים',
    leadTitle: 'הוספה כליד', name: 'שם', phone: 'טלפון', email: 'אימייל', project: 'פרויקט / נכס', none: 'בלי פרויקט', stage: 'שלב', note: 'הערה',
    notePh: 'מה מחפשים, מה סוכם… (מה שנכתב בשיחה נשמר לבד)', save: 'הוספה ללידים', cancel: 'ביטול', added: 'נוסף ללידים', existing: 'המספר הזה כבר ליד — פתחנו אותו',
    stages: { new: 'ליד חדש', contacted: 'נוצר קשר', discovery: 'מתעניין', meeting: 'נקבעה פגישה' },
    tablesMissing: 'צריך להפעיל פעם אחת את טבלאות הסושיאל במסד הנתונים (server/social-migration.sql).',
    media: { imageMessage: '📷 תמונה', videoMessage: '🎥 סרטון', audioMessage: '🎤 הקלטה', documentMessage: '📎 קובץ', locationMessage: '📍 מיקום', contactMessage: '👤 איש קשר', stickerMessage: 'מדבקה' },
    // accounts panel
    accTitle: 'חשבונות מחוברים', accSub: 'כל עמוד ומספר שמחוברים למערכת. עמוד שמסומן "בתיבה" — ההודעות שלו נכנסות לכאן.',
    fbPages: 'עמודי פייסבוק ואינסטגרם', inInbox: 'בתיבה', leadsPage: 'עמוד הלידים', receiving: 'מקבל הודעות', notReceiving: 'לא מחובר להודעות',
    connect: 'חיבור להודעות', connecting: 'מחבר…', addPageTitle: 'איך מוסיפים עמוד (של דניאל, קורקוס…)',
    addPageHow: ['business.facebook.com ← הגדרות ← Accounts ← Pages ← Add: "Add a Page" (עמוד שאתם מנהלים) או "Request access" (עמוד שבעסק אחר — מאשרים את הבקשה מהעסק השני).',
      'Users ← System users ← afik-api ← Assign assets ← Pages ← העמוד ← Full control ← שמירה. אם יש לו אינסטגרם — גם Instagram accounts.',
      'לחזור לכאן ולרענן: העמוד יופיע ברשימה ← להדליק "בתיבה" ← "ייבוא כל השיחות".'],
    notInList: 'לא מופיע? המפתח של Meta עוד לא קיבל גישה לעמוד (שלב 2).',
    missingScopes: 'להרשאות של המפתח של Meta חסר:', scopesHow: 'ב-business.facebook.com ← משתמשי מערכת ← יצירת מפתח חדש עם ההרשאות האלה, ואז להחליף את META_SYSTEM_USER_TOKEN ב-Vercel.',
    igHook: 'אינסטגרם: באפליקציה של Meta ← Webhooks ← Instagram ← להירשם לשדה messages עם אותה כתובת של הלידים.',
    waLines: 'וואטסאפ', waMain: 'קו המשרד (אפיק הנחל)', waState: { authorized: 'מחובר', notAuthorized: 'לא מחובר', error: 'לא ידוע' },
    importTitle: 'ייבוא היסטוריה', importMeta: 'ייבוא כל השיחות ממסנג׳ר ואינסטגרם', importWa: 'ייבוא כל ההיסטוריה מוואטסאפ', stop: 'עצירה',
    metaProg: (p) => `${p.job ? `${p.job.pageName} · ${p.job.platform === 'instagram' ? 'אינסטגרם' : 'מסנג׳ר'} · ` : ''}${p.threads} שיחות · ${p.messages} הודעות חדשות`,
    waProg: (p) => `${p.chats} מתוך ${p.total} צ׳אטים · ${p.messages} הודעות חדשות`,
    doneTxt: 'הסתיים ✓', close: 'סגירה', refresh: 'רענון',
    profile: 'פרופיל', templates: 'תבניות', profileOf: { whatsapp: 'פתיחה בוואטסאפ', messenger: 'השיחה ב-Meta Business Suite', instagram: 'הפרופיל באינסטגרם' }, zoomIn: 'הגדלה', zoomOut: 'הקטנה', zoomReset: 'גודל רגיל', resize: 'גרירה לשינוי רוחב הרשימה', socialTpl: 'במסנג׳ר ובאינסטגרם נשלח הטקסט בלבד',
  },
  en: {
    title: 'Inbox', sub: 'WhatsApp, Messenger and Instagram of every page in one place. Any conversation becomes a lead, linked to a project.',
    search: 'Search name, @, phone…', f: { all: 'All', unread: 'Waiting for us', nolead: 'Not a lead yet', whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram' },
    allPages: 'All pages', waLine: 'Office line',
    empty: 'No conversations here', emptySub: 'New messages arrive here by themselves. You can also import the whole history from "Connected accounts".',
    pick: 'Pick a conversation', isLead: 'Lead', addLead: 'Add as a lead', openLead: 'Lead card', reply: 'Write a reply…', send: 'Send',
    sending: 'Sending…', foundPhone: 'Wrote a phone', openMeta: 'Open in Meta', openChats: 'Open in the chats screen', accounts: 'Connected accounts',
    leadTitle: 'Add as a lead', name: 'Name', phone: 'Phone', email: 'Email', project: 'Project / property', none: 'No project', stage: 'Stage', note: 'Note',
    notePh: 'What they look for, what was agreed… (the conversation is saved by itself)', save: 'Add to leads', cancel: 'Cancel', added: 'Added to the leads', existing: 'This number is already a lead — opened it',
    stages: { new: 'New lead', contacted: 'Contacted', discovery: 'Interested', meeting: 'Meeting set' },
    tablesMissing: 'The social tables need to be created once in the database (server/social-migration.sql).',
    media: { imageMessage: '📷 Photo', videoMessage: '🎥 Video', audioMessage: '🎤 Voice note', documentMessage: '📎 File', locationMessage: '📍 Location', contactMessage: '👤 Contact', stickerMessage: 'Sticker' },
    accTitle: 'Connected accounts', accSub: 'Every page and number connected to the system. A page marked "In the inbox" brings its messages here.',
    fbPages: 'Facebook pages and Instagram', inInbox: 'In the inbox', leadsPage: 'Leads page', receiving: 'Receiving messages', notReceiving: 'Not connected to messages',
    connect: 'Connect messages', connecting: 'Connecting…', addPageTitle: 'How to add a page (Daniel’s, Korkos…)',
    addPageHow: ['business.facebook.com → Settings → Accounts → Pages → Add: "Add a Page" (a page you manage) or "Request access" (a page in another business — approve it there).',
      'Users → System users → afik-api → Assign assets → Pages → the page → Full control → Save. If it has Instagram — Instagram accounts too.',
      'Come back and refresh: the page shows in the list → switch on "In the inbox" → "Import every conversation".'],
    notInList: 'Not listed? The Meta token wasn’t given the page yet (step 2).',
    missingScopes: 'The Meta token is missing:', scopesHow: 'business.facebook.com → System users → generate a new token with these permissions, then replace META_SYSTEM_USER_TOKEN in Vercel.',
    igHook: 'Instagram: Meta app → Webhooks → Instagram → subscribe to the messages field with the same URL as the leads.',
    waLines: 'WhatsApp', waMain: 'Office line (Afik Hanahal)', waState: { authorized: 'Connected', notAuthorized: 'Not connected', error: 'Unknown' },
    importTitle: 'Import history', importMeta: 'Import every Messenger and Instagram conversation', importWa: 'Import the whole WhatsApp history', stop: 'Stop',
    metaProg: (p) => `${p.job ? `${p.job.pageName} · ${p.job.platform === 'instagram' ? 'Instagram' : 'Messenger'} · ` : ''}${p.threads} conversations · ${p.messages} new messages`,
    waProg: (p) => `${p.chats} of ${p.total} chats · ${p.messages} new messages`,
    doneTxt: 'Done ✓', close: 'Close', refresh: 'Refresh',
    profile: 'Profile', templates: 'Templates', profileOf: { whatsapp: 'Open in WhatsApp', messenger: 'The chat in Meta Business Suite', instagram: 'Instagram profile' }, zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Normal size', resize: 'Drag to resize the list', socialTpl: 'Messenger and Instagram get the text only',
  },
}
const fmtTime = (ts, lang) => {
  const d = new Date(ts); if (!Number.isFinite(d.getTime())) return ''
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'he-IL', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'numeric' })
}
const PlatIcon = ({ p, size = 14 }) => (p === 'instagram' ? <FaInstagram size={size} color="#E1306C"/> : p === 'whatsapp' ? <FaWhatsapp size={size} color="#25D366"/> : <FaFacebookMessenger size={size} color="#0084FF"/>)
const localPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('972') ? `0${d.slice(3)}` : d }
const nameOf = th => th?.name_he || th?.name || (th?.username ? `@${th.username}` : th?.platform === 'whatsapp' ? localPhone(th.phone) : '—')

// where the person's own profile is: WhatsApp → wa.me, Instagram → the @handle, Messenger → the chat in Meta Business Suite
// (Meta gives a page-scoped id, never the person's profile address)
const profileLink = (th, accounts) => th.platform === 'whatsapp' ? `https://wa.me/${th.phone}`
  : th.platform === 'instagram' ? (th.username ? `https://www.instagram.com/${th.username}/` : 'https://business.facebook.com/latest/inbox/instagram_direct')
  : `https://business.facebook.com/latest/inbox/messenger?asset_id=${accounts?.[th.account_id]?.pageId || th.account_id}&selected_item_id=${th.user_id}`

// one shape for the list: a WhatsApp chat or a Messenger / Instagram thread
const fromWa = (c, t) => ({ key: `wa:${c.phone}`, kind: 'wa', platform: 'whatsapp', phone: c.phone, name: c.name, waName: c.waName, lead_id: c.lead_id, last_text: c.last_text && t.media[c.last_type] && !c.last_text.trim() ? t.media[c.last_type] : (t.media[c.last_text] || c.last_text), last_dir: c.last_dir, last_at: c.last_at, unread: c.last_dir === 'in' ? c.waiting : 0, account_id: 'wa' })
const fromSocial = th => ({ ...th, key: th.id, kind: 'social' })
// Green's history shape (chat-history) → a bubble
function waBubble(m, t) {
  if (!m || m.typeMessage === 'reactionMessage') return null
  const media = t.media[m.typeMessage]
  const att = m.downloadUrl ? [{ type: m.typeMessage === 'imageMessage' ? 'image' : 'file', url: m.downloadUrl, name: m.fileName || '' }] : []
  return { id: m.idMessage, direction: m.type === 'outgoing' ? 'out' : 'in', body: m.textMessage || m.caption || (att.length ? '' : media || ''), attachments: att, ts: new Date((Number(m.timestamp) || 0) * 1000).toISOString(), media: !m.textMessage && !m.caption ? media : '' }
}

// the person's picture with the channel's icon on its corner; a click on a picture opens it big (with "the profile")
function Face({ th, size = 40, zoom = false, t, link, lang }) {
  const [bad, setBad] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const ic = <i><PlatIcon p={th?.platform} size={size > 36 ? 13 : 11}/></i>
  if (th?.platform === 'whatsapp') {
    return <span className="si-face" style={{ width: size, height: size }}><WaFace phone={th.phone} name={nameOf(th)} size={size} zoom={zoom} lang={lang}><b className="si-ini">{initial(th)}</b></WaFace>{ic}</span>
  }
  const pic = th?.avatar && !bad
  const can = zoom && pic
  return (
    <span ref={ref} className={`si-face${can ? ' can-zoom' : ''}`} style={{ width: size, height: size }} role={can ? 'button' : undefined} tabIndex={can ? 0 : undefined}
      title={can ? t?.profile : undefined} onClick={can ? e => { e.stopPropagation(); setOpen(true) } : undefined}
      onKeyDown={can ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) } } : undefined}>
      {pic ? <img src={th.avatar} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)}/> : <b className="si-ini">{initial(th)}</b>}
      {ic}
      {open && <FaceViewer url={th.avatar} name={nameOf(th)} phone="" sub={th.username ? `@${th.username}` : (th.platform === 'instagram' ? 'Instagram' : 'Messenger')} en={lang === 'en'} back={ref}
        link={link ? { href: link, label: t.profileOf[th.platform] } : null} onClose={() => setOpen(false)}/>}
    </span>
  )
}
const initial = th => nameOf(th).replace(/^[@0]+/, '').charAt(0) || '?'

function LeadForm({ th, t, lang, onDone, onCancel }) {
  const projects = useProjects()
  const active = projects.filter(p => p.status !== 'archived')
  const isWa = th.kind === 'wa'
  const [f, setF] = useState({ name: th.name || th.waName || th.username || '', phone: isWa ? localPhone(th.phone) : th.phone || '', email: th.email || '', projectId: '', leadStatus: 'contacted', note: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [picked, setPicked] = useState(null)
  const save = async () => {
    setBusy(true); setErr('')
    try {
      const p = active.find(x => x.id === f.projectId) || (picked?.id === f.projectId ? picked : null)
      const d = isWa
        ? await api('social-wa-lead', { method: 'POST', body: JSON.stringify({ ...f, phone: th.phone, projectName: p?.name || '' }) })
        : await api('social-to-lead', { method: 'POST', body: JSON.stringify({ id: th.id, ...f, projectName: p?.name || '' }) })
      onDone(d.lead, d.existing)
    } catch (e) { setErr(e.message); setBusy(false) }
  }
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }))
  return (
    <div className="si-leadform" role="form" aria-label={t.leadTitle}>
      <div className="si-lf-head"><b><UserPlus size={15}/>{t.leadTitle}</b><button type="button" className="si-x" onClick={onCancel} aria-label={t.cancel}><X size={15}/></button></div>
      <div className="si-lf-grid">
        <label>{t.name}<input value={f.name} onChange={set('name')} autoFocus/></label>
        <label>{t.phone}<input value={f.phone} onChange={set('phone')} dir="ltr" inputMode="tel" placeholder="05X-XXX-XXXX" readOnly={isWa}/></label>
        <label>{t.email}<input value={f.email} onChange={set('email')} dir="ltr"/></label>
        <label>{t.stage}<select value={f.leadStatus} onChange={set('leadStatus')}>{Object.entries(t.stages).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <div className="si-lf-wide"><span>{t.project}</span>
          <ProjectSelect projects={projects} value={f.projectId} lang={lang} onChange={(id, x) => { setF(v => ({ ...v, projectId: id })); setPicked(x) }}/>
        </div>
        <label className="si-lf-wide">{t.note}<textarea rows={2} value={f.note} onChange={set('note')} placeholder={t.notePh}/></label>
      </div>
      {err && <div className="si-err">{err}</div>}
      <div className="si-lf-foot"><button type="button" className="si-primary" disabled={busy} onClick={save}>{busy ? '…' : t.save}</button><button type="button" className="si-secondary" onClick={onCancel}>{t.cancel}</button></div>
    </div>
  )
}

// an import that runs in steps (each call ~40 s, the next one carries the cursor) until done or stopped
function useStepImport(action) {
  const [st, setSt] = useState(null)       // { running, done, error, ...totals }
  const stop = useRef(false)
  const run = async onStep => {
    stop.current = false
    let cursor = {}, tot = { threads: 0, messages: 0, chats: 0, total: 0, errors: [] }
    setSt({ running: true, ...tot })
    for (let k = 0; k < 200 && !stop.current; k++) {
      let d
      try { d = await api(action, { method: 'POST', body: JSON.stringify({ cursor }), timeout: 70000 }) }
      catch (e) { setSt(s => ({ ...s, running: false, error: e.message })); return }
      tot = { threads: tot.threads + (d.threads || 0), messages: tot.messages + (d.messages || 0), chats: tot.chats + (d.chats || 0), total: d.total ?? tot.total, job: d.job, errors: [...tot.errors, ...(d.errors && Array.isArray(d.errors) ? d.errors : [])].slice(-5) }
      setSt({ running: !d.done, done: !!d.done, ...tot })
      onStep?.()
      if (d.done) return
      cursor = d.cursor
    }
    setSt(s => ({ ...s, running: false }))
  }
  return { st, run, stop: () => { stop.current = true } }
}

function Accounts({ t, lang, onClose, onImported }) {
  const [st, setSt] = useState(null)
  const [wa, setWa] = useState(null)
  const [busy, setBusy] = useState('')
  const metaImp = useStepImport('social-sync')
  const waImp = useStepImport('social-wa-import')
  const load = useCallback(fix => api(`social-status${fix ? '?fix=1' : ''}`, { timeout: 55000 }).then(setSt).catch(e => setSt({ error: e.message })), [])
  useEffect(() => { load(); api('chat-status', { timeout: 15000 }).then(setWa).catch(() => setWa({ state: 'error' })) }, [load])
  const toggle = async (p, on) => {
    setBusy(p.id)
    try { await api('social-page', { method: 'POST', body: JSON.stringify({ id: p.id, name: p.name, on }) }); await load() } catch (e) { setSt(s => ({ ...s, toggleError: e.message })) }
    setBusy('')
  }
  const pageOf = id => (st?.pages || []).find(p => p.id === id)
  const avail = st?.available?.length ? st.available : (st?.pages || []).map(p => ({ id: p.id, name: p.name, inbox: true, leads: p.leads }))
  const pill = v => <span className={`si-pill${v ? ' is-ok' : ''}`}>{v ? <Check size={12}/> : <AlertTriangle size={12}/>}{v ? t.receiving : t.notReceiving}</span>
  const prog = (imp, fmt, label, onClick) => (
    <div className="si-imp">
      <div className="si-imp-row">
        <button type="button" className="si-primary" disabled={imp.st?.running} onClick={onClick}><RefreshCw size={14} className={imp.st?.running ? 'si-spin' : ''}/>{label}</button>
        {imp.st?.running && <button type="button" className="si-secondary" onClick={imp.stop}>{t.stop}</button>}
      </div>
      {imp.st && <div className="si-muted">{fmt(imp.st)}{imp.st.done ? ` · ${t.doneTxt}` : ''}</div>}
      {imp.st?.error && <div className="si-err">{imp.st.error}</div>}
      {imp.st?.errors?.length > 0 && <div className="si-err si-small">{imp.st.errors.join(' · ')}</div>}
    </div>
  )
  return (
    <div className="si-acc-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="si-acc" role="dialog" aria-modal="true" aria-label={t.accTitle} dir={lang === 'en' ? 'ltr' : 'rtl'}>
        <div className="si-lf-head"><b><Plug size={16}/>{t.accTitle}</b><button type="button" className="si-x" onClick={onClose} aria-label={t.close}><X size={16}/></button></div>
        <p className="si-muted">{t.accSub}</p>
        {!st ? <div className="si-muted">…</div> : st.error ? <div className="si-err">{st.error}</div> : <>
          {st.tablesMissing && <div className="si-warn">{t.tablesMissing}</div>}
          {st.missing?.length > 0 && <div className="si-warn"><b>{t.missingScopes}</b> <code>{st.missing.join(', ')}</code><div>{t.scopesHow}</div></div>}
          {st.toggleError && <div className="si-err">{st.toggleError}</div>}
          <h4><FaFacebookMessenger color="#0084FF"/>{t.fbPages}</h4>
          {avail.map(a => {
            const pc = pageOf(a.id)
            const ig = a.ig || (st.instagram || []).find(x => x.pageId === a.id)
            return (
              <div key={a.id} className={`si-acc-row${a.inbox ? '' : ' is-off'}`}>
                {a.picture ? <img className="si-pg-pic" src={a.picture} alt="" referrerPolicy="no-referrer"/> : <span className="si-pg-pic"/>}
                <span className="si-pg-main"><b>{a.name || a.id}</b>
                  <small>{ig ? <><FaInstagram color="#E1306C" size={11}/> @{ig.username}</> : null}{a.leads ? <em className="si-tag">{t.leadsPage}</em> : null}</small></span>
                {a.inbox && pc && pill(pc.messages)}
                {a.inbox && pc && !pc.messages && <button type="button" className="si-secondary" disabled={!!busy} onClick={async () => { setBusy('fix'); await load(true); setBusy('') }}>{busy === 'fix' ? t.connecting : t.connect}</button>}
                <label className="si-switch" title={t.inInbox}>
                  <input type="checkbox" checked={!!a.inbox} disabled={a.leads || busy === a.id} onChange={e => toggle(a, e.target.checked)}/>
                  <span aria-hidden="true"/>{t.inInbox}
                </label>
                {pc?.fix && pc.fix !== 'subscribed' && <div className="si-err si-full">{pc.fix}</div>}
                {pc?.error && <div className="si-err si-full">{pc.error}</div>}
              </div>
            )
          })}
          {st.availableError && <div className="si-err si-small">{st.availableError}</div>}
          <details className="si-more" open={avail.length < 2}><summary>{t.addPageTitle}</summary>
            <ol className="si-steps">{t.addPageHow.map((x, i) => <li key={i}>{x}</li>)}</ol>
            <div className="si-muted si-small">{t.notInList}</div>
          </details>
          <div className="si-muted si-small">{t.igHook}</div>
        </>}
        <h4><FaWhatsapp color="#25D366"/>{t.waLines}</h4>
        <div className="si-acc-row"><b>{t.waMain}{wa?.phone ? ` · ${wa.phone}` : ''}</b><span className={`si-pill${wa?.state === 'authorized' ? ' is-ok' : ''}`}>{t.waState[wa?.state] || t.waState.error}</span></div>
        <h4><RefreshCw size={14}/>{t.importTitle}</h4>
        {prog(metaImp, t.metaProg, t.importMeta, () => metaImp.run(onImported))}
        {prog(waImp, t.waProg, t.importWa, () => waImp.run(onImported))}
        <div className="si-lf-foot"><button type="button" className="si-secondary" onClick={() => load()}>{t.refresh}</button></div>
      </div>
    </div>
  )
}

export default function SocialInboxTab({ lang = 'he', onOpenLead, onOpenChat }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const [threads, setThreads] = useState(null)
  const [accounts, setAccounts] = useState({})
  const [waChats, setWaChats] = useState(null)
  const [missing, setMissing] = useState(false)
  const [sel, setSel] = useState('')
  const [conv, setConv] = useState({ key: '', thread: null, messages: [] })
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState(() => { try { return sessionStorage.getItem('afik_inbox_filter') || 'all' } catch { return 'all' } })
  const [page, setPage] = useState('all')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [leadForm, setLeadForm] = useState(false)
  const [accOpen, setAccOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [tplOpen, setTplOpen] = useState(false)
  const [zoom, setZoom] = useState(() => { try { const v = Number(localStorage.getItem('afik_inbox_zoom')); return v >= 0.8 && v <= 1.6 ? v : 1 } catch { return 1 } })
  const setZ = v => { const z = Math.round(Math.min(1.6, Math.max(0.8, v)) * 100) / 100; setZoom(z); try { localStorage.setItem('afik_inbox_zoom', String(z)) } catch {} }
  const LIST_W = [280, 640], LIST_DEF = 380
  const [listW, setListW] = useState(() => { try { const v = Number(localStorage.getItem('afik_inbox_list_w')); return v >= LIST_W[0] && v <= LIST_W[1] ? v : LIST_DEF } catch { return LIST_DEF } })
  const saveListW = v => { setListW(v); try { localStorage.setItem('afik_inbox_list_w', String(v)) } catch {} }
  const listRef = useRef(null), msgsRef = useRef(null)
  const autoConfig = useSharedAutoConfig()
  const leads = useSharedLeads()
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-admin-theme') === 'dark'
  const WA = isDark ? DARK : LIGHT
  const endRef = useRef(null)
  const selRef = useRef(sel); selRef.current = sel
  useEffect(() => { try { sessionStorage.setItem('afik_inbox_filter', filter) } catch {} }, [filter])

  const loadThreads = useCallback(() => api('social-threads').then(d => { setThreads(d.threads || []); setAccounts(d.accounts || {}); setMissing(!!d.tablesMissing) }).catch(e => { setThreads([]); setErr(e.message) }), [])
  const loadWa = useCallback(() => api('social-wa').then(d => setWaChats(d.chats || [])).catch(() => setWaChats([])), [])
  const loadAll = useCallback(() => { loadThreads(); loadWa() }, [loadThreads, loadWa])
  const loadConv = useCallback(async (key, full = false) => {
    if (key.startsWith('wa:')) {
      const phone = key.slice(3)
      const d = await fetch('/api/meta/chat-history', { method: 'POST', headers: AUTH, body: JSON.stringify({ phone, count: 200, ...(full ? {} : { stored: true }) }), signal: AbortSignal.timeout(25000) }).then(r => (r.ok ? r.json() : null)).catch(() => null)
      if (selRef.current === key && Array.isArray(d)) setConv(c => ({ key, thread: null, messages: d.map(m => waBubble(m, t)).filter(Boolean) }))
      return
    }
    const d = await api(`social-thread?id=${encodeURIComponent(key)}`).catch(() => null)
    if (d && selRef.current === key) setConv({ key, thread: d.thread, messages: d.messages || [] })
  }, [t])
  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    if (!sel) return
    setConv({ key: sel, thread: null, messages: [] }); setLeadForm(false); setErr(''); setText('')
    // WhatsApp: our table first (instant), then Green's full history behind it (fills what the table missed)
    loadConv(sel).then(() => { if (sel.startsWith('wa:')) loadConv(sel, true) })
  }, [sel, loadConv])
  // the database announces every change (a message in, our reply, a lead made): re-read what changed
  useEffect(() => {
    const reS = debounce(() => { loadThreads(); if (selRef.current && !selRef.current.startsWith('wa:')) loadConv(selRef.current) }, 700)
    const reW = debounce(() => { loadWa(); if (selRef.current.startsWith('wa:')) loadConv(selRef.current) }, 900)
    return onSync(m => { if (m.t === 'social_threads') reS(); else if (m.t === 'wa_messages') reW(); else if (m.t === '*') { reS(); reW() } })
  }, [loadThreads, loadWa, loadConv])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [conv.messages.length, sel])
  // Ctrl / ⌘ + wheel over the conversation = bigger / smaller text (like a browser, only for the chat)
  useEffect(() => {
    const el = msgsRef.current
    if (!el) return
    const onWheel = e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZ(zoom + (e.deltaY < 0 ? 0.1 : -0.1)) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, sel]) // eslint-disable-line react-hooks/exhaustive-deps

  const all = useMemo(() => [...(waChats || []).map(c => fromWa(c, t)), ...(threads || []).map(fromSocial)]
    .sort((a, b) => Date.parse(b.last_at || 0) - Date.parse(a.last_at || 0)), [waChats, threads, t])
  // the pages that have conversations, for the page chips
  const pageChips = useMemo(() => {
    const m = new Map()
    for (const x of all) {
      if (x.kind !== 'social') continue
      const lab = accounts[x.account_id]
      const pid = lab?.pageId || x.account_id
      if (!m.has(pid)) m.set(pid, { id: pid, name: (lab?.platform === 'messenger' ? lab.name : accounts[pid]?.name) || lab?.name || pid, n: 0 })
      m.get(pid).n++
    }
    return [...m.values()]
  }, [all, accounts])
  const pageOfItem = x => (x.kind === 'wa' ? 'wa' : accounts[x.account_id]?.pageId || x.account_id)
  const inPage = x => page === 'all' || pageOfItem(x) === page
  const match = useCallback((x, f) => {
    if (f === 'nolead') return !x.lead_id
    if (f === 'unread') return x.unread > 0
    if (f === 'whatsapp' || f === 'messenger' || f === 'instagram') return x.platform === f
    return true
  }, [])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase(), d = q.replace(/\D/g, '')
    return all.filter(x => inPage(x) && match(x, filter) && (!s
      || [x.name, x.waName, x.username, x.last_text].some(v => String(v || '').toLowerCase().includes(s))
      || (d.length >= 3 && (String(x.phone || '').includes(d) || localPhone(x.phone).includes(d)))))
  }, [all, q, filter, page, accounts, match]) // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => Object.fromEntries(Object.keys(t.f).map(k => [k, all.filter(x => inPage(x) && match(x, k)).length])), [all, t, page, accounts, match]) // eslint-disable-line react-hooks/exhaustive-deps
  const item = all.find(x => x.key === sel) || null
  const th = item ? (item.kind === 'social' && conv.thread ? { ...fromSocial(conv.thread) } : item) : null
  const where = x => (x.kind === 'wa' ? t.waLine : accounts[x.account_id]?.name || '')

  const send = async (override, o = {}) => {
    const body = String(typeof override === 'string' ? override : text).trim()
    if (!body || !sel || sending) return
    setSending(true); setErr('')
    const tmp = { id: `tmp-${Date.now()}`, direction: 'out', body, ts: new Date().toISOString(), pending: true }
    setConv(c => ({ ...c, messages: [...c.messages, tmp] })); if (typeof override !== 'string') setText('')
    try {
      if (sel.startsWith('wa:')) await api('chat-send', { method: 'POST', body: JSON.stringify({ phone: sel.slice(3), message: body, ...(o?.image ? { image: o.image } : {}) }) })
      else await api('social-send', { method: 'POST', body: JSON.stringify({ id: sel, text: body }) })
      setTimeout(() => loadConv(sel), 600)
    } catch (e) { setErr(e.message); if (typeof override !== 'string') setText(body); setConv(c => ({ ...c, messages: c.messages.filter(m => m.id !== tmp.id) })) }
    setSending(false)
  }
  // the lead the templates are written for: the CRM lead when there is one, else what we know from the conversation
  const tplLead = useMemo(() => {
    if (!th) return null
    const crm = th.lead_id ? (leads || []).find(l => String(l.id) === String(th.lead_id)) : th.kind === 'wa' ? (leads || []).find(l => String(l.phone || '').replace(/\D/g, '').slice(-9) === String(th.phone).slice(-9)) : null
    return crm || { id: th.key, name: nameOf(th).replace(/^@/, ''), phone: th.kind === 'wa' ? localPhone(th.phone) : th.phone || '', source: th.platform, crm_data: { leadStatus: 'new' } }
  }, [th?.key, th?.lead_id, leads]) // eslint-disable-line react-hooks/exhaustive-deps
  const tplMsgs = useMemo(() => conv.messages.map(m => ({ direction: m.direction, message: m.body || '' })), [conv.messages])
  const putInBox = v => { setText(String(v || '')); setTplOpen(false) }
  const openLead = id => (onOpenLead ? onOpenLead(id) : window.open(`/admin-panel/leads?lead=${encodeURIComponent(id)}`, '_blank'))

  return (
    <div className="si" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <aside ref={listRef} className={`si-list${sel ? ' has-sel' : ''}`} style={{ width: listW }}>
        <div className="si-top">
          <div className="si-title"><h2>{t.title}</h2><button type="button" className="si-accbtn" onClick={() => setAccOpen(true)}><Plug size={14}/>{t.accounts}</button></div>
          <p className="si-muted">{t.sub}</p>
          <div className="si-search"><Search size={14}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}/></div>
          <div className="si-filters" role="tablist">
            {Object.keys(t.f).map(k => <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{k !== 'all' && k !== 'unread' && k !== 'nolead' ? <PlatIcon p={k} size={12}/> : null}{t.f[k]}{counts[k] > 0 && <em>{counts[k]}</em>}</button>)}
          </div>
          {pageChips.length > 0 && (
            <div className="si-pages" aria-label={t.allPages}>
              <button type="button" aria-pressed={page === 'all'} onClick={() => setPage('all')}>{t.allPages}</button>
              {(waChats || []).length > 0 && <button type="button" aria-pressed={page === 'wa'} onClick={() => setPage('wa')}><FaWhatsapp size={11} color="#25D366"/>{t.waLine}</button>}
              {pageChips.map(p => <button key={p.id} type="button" aria-pressed={page === p.id} onClick={() => setPage(p.id)}><FaFacebookMessenger size={11} color="#0084FF"/>{p.name}<em>{p.n}</em></button>)}
            </div>
          )}
        </div>
        {missing && <div className="si-warn si-m">{t.tablesMissing}</div>}
        <div className="si-rows" role="list">
          {threads === null && waChats === null ? <div className="si-muted si-m">…</div> : !list.length ? (
            <div className="si-empty"><b>{t.empty}</b><span>{t.emptySub}</span><button type="button" className="si-secondary" onClick={() => setAccOpen(true)}><Plug size={14}/>{t.accounts}</button></div>
          ) : list.slice(0, 400).map(x => (
            <button key={x.key} type="button" role="listitem" className={`si-row${sel === x.key ? ' is-on' : ''}${x.unread ? ' is-unread' : ''}`} onClick={() => setSel(x.key)}>
              <Face th={x}/>
              <span className="si-row-main">
                <span className="si-row-top"><b><bdi>{nameOf(x)}</bdi></b><small>{fmtTime(x.last_at, lang)}</small></span>
                <span className="si-row-bot"><span className="si-last" dir="auto">{x.last_dir === 'out' ? '✓ ' : ''}{x.last_text || ''}</span>
                  {x.lead_id ? <span className="si-badge is-lead">{t.isLead}</span> : x.kind === 'social' && x.phone ? <span className="si-badge">{t.foundPhone}</span> : null}
                  {x.unread > 0 && <span className="si-unread">{x.unread}</span>}</span>
                {where(x) && <span className="si-where"><PlatIcon p={x.platform} size={10}/>{where(x)}</span>}
              </span>
            </button>
          ))}
        </div>
      </aside>
      <Splitter axis="x" className="si-spl" min={LIST_W[0]} grows={lang === 'en' ? 1 : -1} label={t.resize}
        max={() => Math.min(LIST_W[1], (listRef.current?.parentElement?.getBoundingClientRect().width || 1200) - 420)}
        get={() => listRef.current?.getBoundingClientRect().width || listW}
        apply={v => { if (listRef.current) listRef.current.style.width = `${v}px` }}
        commit={saveListW} reset={() => { if (listRef.current) listRef.current.style.width = `${LIST_DEF}px`; saveListW(LIST_DEF) }}/>

      <section className="si-conv" style={{ '--si-z': zoom }}>
        {!th ? <div className="si-pick"><MessageCircle size={28}/>{t.pick}</div> : <>
          <header className="si-conv-head">
            <button type="button" className="si-back" onClick={() => setSel('')} aria-label={t.close}>›</button>
            <Face th={th} size={46} zoom t={t} lang={lang} link={profileLink(th, accounts)}/>
            <div className="si-who"><a className="si-who-name" href={profileLink(th, accounts)} target="_blank" rel="noreferrer" title={t.profileOf[th.platform]}><bdi>{nameOf(th)}</bdi><ExternalLink size={12}/></a>
              <small>{th.kind === 'wa' ? `WhatsApp · ${localPhone(th.phone)}` : `${th.platform === 'instagram' ? 'Instagram' : 'Messenger'}${where(th) ? ` · ${where(th)}` : ''}${th.username && th.name ? ` · @${th.username}` : ''}${th.phone ? ` · ${th.phone}` : ''}`}</small></div>
            <div className="si-zoom" role="group" aria-label={t.zoomReset}>
              <button type="button" onClick={() => setZ(zoom - 0.1)} disabled={zoom <= 0.8} title={t.zoomOut} aria-label={t.zoomOut}><ZoomOut size={15}/></button>
              <button type="button" className="si-zoom-v" onClick={() => setZ(1)} title={t.zoomReset}>{Math.round(zoom * 100)}%</button>
              <button type="button" onClick={() => setZ(zoom + 0.1)} disabled={zoom >= 1.6} title={t.zoomIn} aria-label={t.zoomIn}><ZoomIn size={15}/></button>
            </div>
            <ChatTemplateMenu WA={WA} lang={lang} lead={tplLead} msgs={tplMsgs} autoConfig={autoConfig}
              onSend={(txt, o) => send(txt, o)} onInsert={putInBox} onOpenPanel={() => setTplOpen(true)}/>
            {th.lead_id
              ? <button type="button" className="si-secondary" onClick={() => openLead(th.lead_id)}><Link2 size={14}/>{t.openLead}</button>
              : <button type="button" className="si-primary" onClick={() => setLeadForm(v => !v)}><UserPlus size={14}/>{t.addLead}</button>}
            {th.kind === 'wa'
              ? <button type="button" className="si-icon" onClick={() => onOpenChat?.({ phone: th.phone, name: nameOf(th), leadId: th.lead_id })} title={t.openChats} aria-label={t.openChats}><FaWhatsapp size={15}/></button>
              : <a className="si-icon" href="https://business.facebook.com/latest/inbox/all" target="_blank" rel="noreferrer" title={t.openMeta} aria-label={t.openMeta}><ExternalLink size={15}/></a>}
          </header>
          {leadForm && !th.lead_id && <LeadForm th={th} t={t} lang={lang} onCancel={() => setLeadForm(false)} onDone={(lead, existing) => {
            setLeadForm(false); setToast(existing ? t.existing : t.added); setTimeout(() => setToast(''), 3500)
            if (th.kind === 'wa') setWaChats(cs => (cs || []).map(c => (c.phone === th.phone ? { ...c, lead_id: String(lead.id), name: c.name || lead.name } : c)))
            else setConv(c => ({ ...c, thread: { ...c.thread, lead_id: String(lead.id) } }))
            if (existing) openLead(lead.id)
            loadAll()
          }}/>}
          <div ref={msgsRef} className={`si-msgs${th.kind === 'wa' ? ' is-wa' : ''}`}>
            {conv.messages.map(m => (
              <div key={m.id} className={`si-bub is-${m.direction}${m.pending ? ' is-pending' : ''}`}>
                {(m.attachments || []).map((a, i) => a.type === 'image' && a.url ? <img key={i} src={a.url} alt="" referrerPolicy="no-referrer" loading="lazy"/> : a.url ? <a key={i} href={a.url} target="_blank" rel="noreferrer">📎 {a.name || m.media || a.type}</a> : null)}
                {m.body && <span dir="auto">{m.body}</span>}
                <small>{fmtTime(m.ts, lang)}</small>
              </div>
            ))}
            <div ref={endRef}/>
          </div>
          {err && <div className="si-err si-m">{err}</div>}
          {tplOpen && (
            <div className="si-tplwin">
              <ChatTemplatePicker WA={WA} lang={lang} lead={tplLead} msgs={tplMsgs} autoConfig={autoConfig}
                onSend={(txt, o) => { send(txt, o); setTplOpen(false) }} onInsert={putInBox} onClose={() => setTplOpen(false)}/>
            </div>
          )}
          {!text.trim() && !tplOpen && (
            <div className="si-chips">
              <ChatQuickChips WA={WA} lang={lang} lead={tplLead} msgs={tplMsgs} autoConfig={autoConfig}
                onSend={(txt, o) => send(txt, o)} onInsert={putInBox} onMore={() => setTplOpen(true)}/>
              {th.kind !== 'wa' && <small className="si-muted">{t.socialTpl}</small>}
            </div>
          )}
          <div className="si-composer">
            <button type="button" className="si-tplbtn" onClick={() => setTplOpen(v => !v)} aria-pressed={tplOpen} title={t.templates}><LayoutTemplate size={16}/><span>{t.templates}</span></button>
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder={t.reply} rows={1} dir="auto"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}/>
            <button type="button" className={`si-send${th.kind === 'wa' ? ' is-wa' : ''}`} disabled={!text.trim() || sending} onClick={() => send()}><Send size={15}/>{sending ? t.sending : t.send}</button>
          </div>
        </>}
      </section>
      {accOpen && <Accounts t={t} lang={lang} onClose={() => setAccOpen(false)} onImported={loadAll}/>}
      {toast && <div className="si-toast" role="status"><Check size={14}/>{toast}</div>}
      <style>{SI_CSS + SPLITTER_CSS}</style>
    </div>
  )
}

const SI_CSS = `
.si{display:flex;height:100%;min-height:0;font-family:Rubik,sans-serif;color:var(--au-text);background:var(--au-bg,transparent)}
.si-list{width:380px;flex:none;display:flex;flex-direction:column;min-height:0;border-inline-end:1px solid var(--au-line);background:var(--au-pop)}
.si-top{padding:14px 14px 8px}
.si-title{display:flex;align-items:center;gap:8px}
.si-title h2{flex:1;margin:0;font-size:19px;font-weight:700}
.si-accbtn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border:1px solid var(--au-line);border-radius:9px;background:none;color:var(--au-brand-text);font:600 12.5px Rubik,sans-serif;cursor:pointer;min-height:0}
.si-muted{color:var(--au-text2);font-size:12.5px;margin:4px 0 0;line-height:1.55}
.si-small{font-size:11.5px;margin-top:6px}
.si-m{margin:8px 14px}
.si-search{display:flex;align-items:center;gap:7px;height:36px;margin-top:10px;padding:0 10px;border:1px solid var(--au-line);border-radius:10px;color:var(--au-text3);background:var(--au-input,var(--au-pop))}
.si-search input{flex:1;min-width:0;border:none;outline:none;background:none;font:13px Rubik,sans-serif;color:var(--au-text);min-height:0}
.si-filters{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.si-filters button{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:1px solid var(--au-line);border-radius:999px;background:none;color:var(--au-text2);font:500 12px Rubik,sans-serif;cursor:pointer;min-height:0}
.si-filters button[aria-selected=true]{background:rgba(var(--brand-rgb),.1);border-color:rgba(var(--brand-rgb),.45);color:var(--au-text);font-weight:700}
.si-filters em{font-style:normal;font-size:10.5px;font-weight:700;color:var(--au-text3)}
.si-rows{flex:1;min-height:0;overflow-y:auto;padding:4px 6px 12px}
.si-row{width:100%;display:flex;align-items:center;gap:10px;padding:9px 8px;border:none;border-radius:10px;background:none;cursor:pointer;text-align:start;font-family:inherit;color:inherit;min-height:0}
.si-row:hover{background:rgba(var(--ov),.05)}
.si-row.is-on{background:rgba(var(--brand-rgb),.1)}
.si-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.si-row-top{display:flex;align-items:center;gap:8px}
.si-row-top b{flex:1;min-width:0;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.si-row-top small{font-size:11.5px;color:var(--au-text3)}
.si-row-bot{display:flex;align-items:center;gap:6px}
.si-last{flex:1;min-width:0;font-size:12.5px;color:var(--au-text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.si-row.is-unread .si-last{color:var(--au-text);font-weight:600}
.si-badge{flex:none;font-size:10.5px;font-weight:700;border-radius:6px;padding:1px 7px;background:rgba(217,119,6,.13);color:#B45309}
.si-badge.is-lead{background:rgba(22,163,74,.13);color:#15803D}
.si-unread{flex:none;min-width:19px;height:19px;border-radius:999px;background:#16A34A;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 5px}
.si-face{position:relative;flex:none;border-radius:50%;background:rgba(var(--brand-rgb),.14);display:inline-flex;align-items:center;justify-content:center;color:var(--au-brand-text)}
.si-face img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.si-face b{font-size:15px}
.si-face i{position:absolute;bottom:-2px;inset-inline-end:-2px;width:19px;height:19px;border-radius:50%;background:var(--au-pop);display:inline-flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px var(--au-line)}
.si-empty{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:36px 18px;color:var(--au-text2);font-size:13px}
.si-empty b{color:var(--au-text);font-size:14px}
.si-conv{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;background:rgba(var(--ov),.02)}
.si-pick{margin:auto;color:var(--au-text3);font-size:14px}
.si-conv-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--au-line);background:var(--au-pop)}
.si-back{display:none;border:none;background:none;font-size:24px;color:var(--au-text2);cursor:pointer;padding:0 6px;min-height:0}
.si-who{flex:1;min-width:0;display:flex;flex-direction:column}
.si-who b{font-size:15.5px}
.si-who small{font-size:12px;color:var(--au-text2)}
.si-primary{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border:none;border-radius:9px;background:var(--au-brand);color:#fff;font:600 13px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0}
.si-primary:disabled{opacity:.5;cursor:default}
.si-secondary{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border:1px solid var(--au-line);border-radius:9px;background:none;color:var(--au-text);font:500 12.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0}
.si-icon{background:none;cursor:pointer;min-height:0;width:34px;height:34px;border:1px solid var(--au-line);border-radius:9px;display:inline-flex;align-items:center;justify-content:center;color:var(--au-text2)}
.si-x{border:none;background:none;color:var(--au-text3);cursor:pointer;padding:4px;border-radius:7px;display:inline-flex;min-height:0}
.si-msgs{flex:1;min-height:0;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:6px}
.si-bub{max-width:min(560px,78%);padding:8px 12px 6px;border-radius:14px;font-size:14px;line-height:1.5;display:flex;flex-direction:column;gap:4px;white-space:pre-wrap;word-break:break-word;box-shadow:0 1px 1px rgba(0,0,0,.06)}
.si-bub.is-in{align-self:flex-start;background:var(--au-pop);border:1px solid var(--au-line)}
.si-bub.is-out{align-self:flex-end;background:#DCEBFF;color:#0B1B33}
html[data-admin-theme=dark] .si-bub.is-out{background:#1E3A5F;color:#E6EEF9}
.si-bub.is-pending{opacity:.6}
.si-bub img{max-width:260px;border-radius:9px}
.si-bub small{align-self:flex-end;font-size:10.5px;opacity:.6}
.si-composer{display:flex;align-items:flex-end;gap:8px;padding:10px 14px;border-top:1px solid var(--au-line);background:var(--au-pop)}
.si-composer textarea{flex:1;min-height:42px;max-height:160px;resize:vertical;border:1px solid var(--au-line);border-radius:12px;padding:10px 12px;font:14px/1.45 Rubik,sans-serif;background:var(--au-input,var(--au-pop));color:var(--au-text);outline:none}
.si-composer textarea:focus{border-color:var(--au-brand)}
.si-send{display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 16px;border:none;border-radius:12px;background:#0084FF;color:#fff;font:600 13.5px Rubik,sans-serif;cursor:pointer;min-height:0}
.si-send:disabled{opacity:.5;cursor:default}
.si-err{color:#DC2626;font-size:12.5px}
.si-warn{margin:10px 0;padding:10px 12px;border-radius:10px;background:rgba(217,119,6,.1);border:1px solid rgba(217,119,6,.3);color:var(--au-text);font-size:12.5px;line-height:1.6}
.si-warn code{font-size:12px}
.si-leadform{margin:10px 14px 0;padding:12px;border:1px solid rgba(var(--brand-rgb),.35);border-radius:12px;background:var(--au-pop)}
.si-lf-head{display:flex;align-items:center;gap:8px}
.si-lf-head b{flex:1;display:inline-flex;align-items:center;gap:7px;font-size:14.5px}
.si-lf-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px 12px;margin-top:10px}
.si-lf-grid label,.si-lf-wide{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:var(--au-text2)}
.si-lf-wide{grid-column:1/-1}
.si-lf-grid input,.si-lf-grid select,.si-lf-grid textarea{height:38px;border:1px solid var(--au-line);border-radius:9px;padding:0 10px;font:13.5px Rubik,sans-serif;background:var(--au-input,var(--au-pop));color:var(--au-text);outline:none;min-height:0}
.si-lf-grid select{appearance:auto}
.si-lf-grid textarea{height:auto;padding:8px 10px;resize:vertical}
.si-pchips{display:flex;flex-wrap:wrap;gap:6px}
.si-pchips button{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border:1px solid var(--au-line);border-radius:999px;background:none;color:var(--au-text2);font:500 12.5px Rubik,sans-serif;cursor:pointer;min-height:0}
.si-pchips button[aria-pressed=true]{color:var(--au-text);font-weight:700;border-color:var(--au-brand)}
.si-pchips i{width:8px;height:8px;border-radius:50%}
.si-lf-foot{display:flex;gap:8px;margin-top:12px}
.si-acc-bg{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.42);display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px 16px}
.si-acc{width:min(620px,100%);max-height:86vh;overflow:auto;background:var(--au-pop);color:var(--au-text);border:1px solid var(--au-line);border-radius:16px;padding:16px 18px;box-shadow:0 24px 70px rgba(0,0,0,.3)}
.si-acc h4{display:flex;align-items:center;gap:8px;margin:16px 0 6px;font-size:13.5px}
.si-acc-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:8px 10px;border:1px solid var(--au-line);border-radius:10px;margin-bottom:6px;font-size:13px}
.si-acc-row b{flex:1;min-width:0}
.si-pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 9px;background:rgba(217,119,6,.13);color:#B45309}
.si-pill.is-ok{background:rgba(22,163,74,.13);color:#15803D}
.si-more{margin-top:6px;font-size:12.5px}
.si-more summary{cursor:pointer;color:var(--au-brand-text);font-weight:600}
.si-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:7px;background:#15803D;color:#fff;border-radius:999px;padding:9px 16px;font-size:13px;font-weight:600;z-index:3100}
@media (max-width:820px){.si-list{width:100%;border:none}.si-list.has-sel{display:none}.si-conv{display:none}.si-list.has-sel+.si-conv{display:flex}.si-back{display:inline-flex}.si-lf-grid{grid-template-columns:1fr}}
.si-spl{flex:none}
.si-where{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--au-text3);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.si-pages{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.si-pages button{flex:none;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border:1px solid var(--au-line);border-radius:8px;background:none;color:var(--au-text2);font:500 11.5px Rubik,sans-serif;cursor:pointer;min-height:0;white-space:nowrap}
.si-pages button[aria-pressed=true]{background:rgba(var(--brand-rgb),.1);border-color:rgba(var(--brand-rgb),.45);color:var(--au-text);font-weight:700}
.si-pages em{font-style:normal;font-size:10.5px;color:var(--au-text3)}
.si-face.can-zoom{cursor:zoom-in}
.si-face.can-zoom:hover img{filter:brightness(.92)}
.si-face .si-ini{font-size:15px;color:var(--au-brand-text)}
.si-who-name{display:inline-flex;align-items:center;gap:6px;font-size:16px;font-weight:700;color:var(--au-text);text-decoration:none;min-width:0}
.si-who-name bdi{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.si-who-name svg{flex:none;opacity:.45}
.si-who-name:hover{color:var(--au-brand-text)}
.si-who-name:hover svg{opacity:1}
.si-zoom{display:inline-flex;align-items:center;border:1px solid var(--au-line);border-radius:9px;overflow:hidden;height:34px}
.si-zoom button{border:none;background:none;color:var(--au-text2);height:100%;padding:0 8px;cursor:pointer;display:inline-flex;align-items:center;min-height:0;font:600 11.5px Rubik,sans-serif}
.si-zoom button:hover:not(:disabled){background:rgba(var(--ov),.06);color:var(--au-text)}
.si-zoom button:disabled{opacity:.35;cursor:default}
.si-zoom-v{min-width:44px;justify-content:center;border-inline:1px solid var(--au-line)!important}
.si-msgs .si-bub{font-size:calc(14px * var(--si-z,1))}
.si-msgs .si-bub small{font-size:calc(10.5px * var(--si-z,1))}
.si-msgs .si-bub img{max-width:calc(260px * var(--si-z,1))}
.si-composer textarea{font-size:calc(14px * var(--si-z,1))}
.si-tplwin{flex:none;height:min(460px,55%);border-top:1px solid var(--au-line);background:var(--au-pop);min-height:0;display:flex;flex-direction:column;overflow:hidden}
.si-tplwin>*{flex:1;min-height:0}
.si-chips{flex:none;padding:6px 14px 0;background:var(--au-pop);border-top:1px solid var(--au-line)}
.si-chips .si-muted{display:block;font-size:11px;margin:2px 0 4px}
.si-tplbtn{flex:none;display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 12px;border:1px solid var(--au-line);border-radius:12px;background:none;color:var(--au-text);font:600 13px Rubik,sans-serif;cursor:pointer;min-height:0}
.si-tplbtn[aria-pressed=true]{background:rgba(var(--brand-rgb),.1);border-color:rgba(var(--brand-rgb),.45)}
.si-send.is-wa{background:#16A34A}
.si-pick{display:flex;flex-direction:column;align-items:center;gap:10px}
.si-acc-row.is-off{opacity:.78}
.si-pg-pic{width:34px;height:34px;border-radius:9px;object-fit:cover;background:rgba(var(--ov),.08);flex:none}
.si-pg-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.si-pg-main b{font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.si-pg-main small{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--au-text2)}
.si-tag{font-style:normal;font-size:10.5px;font-weight:700;border-radius:6px;padding:1px 6px;background:rgba(var(--brand-rgb),.12);color:var(--au-brand-text)}
.si-full{flex-basis:100%}
.si-switch{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--au-text2);cursor:pointer;user-select:none}
.si-switch input{position:absolute;opacity:0;width:1px;height:1px}
.si-switch span{position:relative;width:34px;height:20px;border-radius:999px;background:rgba(var(--ov),.18);transition:background .15s}
.si-switch span::after{content:'';position:absolute;top:2px;inset-inline-start:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .15s}
.si-switch input:checked+span{background:#16A34A}
.si-switch input:checked+span::after{transform:translateX(14px)}
[dir=rtl] .si-switch input:checked+span::after{transform:translateX(-14px)}
.si-switch input:disabled+span{opacity:.6}
.si-switch input:focus-visible+span{outline:2px solid var(--au-brand);outline-offset:2px}
.si-steps{margin:8px 0 4px;padding-inline-start:20px;font-size:12.5px;line-height:1.65;color:var(--au-text)}
.si-imp{margin-bottom:10px}
.si-imp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.si-spin{animation:siSpin 1s linear infinite}
@keyframes siSpin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.si-spin{animation:none}}
@media (max-width:820px){.si-list{width:100%!important}.si-spl{display:none}.si-zoom{display:none}.si-tplbtn span{display:none}.si-conv-head{flex-wrap:wrap}}
`
