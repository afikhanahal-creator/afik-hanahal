// Admin "סושיאל" (/admin-panel/social): Messenger + Instagram conversations of the office's pages, like the WhatsApp tab —
// the list (search, filters: all · not a lead yet · unread · Messenger · Instagram), the conversation with a reply box, and
// "הוסף כליד" (name, the phone / email they wrote, project, stage, a note) → the CRM, with what was said as the first note. The
// "חשבונות מחוברים" panel shows every connected account (the Facebook pages, their Instagram accounts, the WhatsApp line) and
// what is missing, and imports the latest conversations. Server: api/meta.js handleSocial; rules: lib/social-hook.js.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaFacebookMessenger, FaInstagram, FaWhatsapp } from 'react-icons/fa'
import { Search, Send, UserPlus, X, Check, RefreshCw, Link2, Plug, ExternalLink, AlertTriangle } from 'lucide-react'
import { onSync, debounce } from './lib/syncBus.js'
import { useProjects } from './lib/projectsStore.js'

const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer AFIKhanahal2026' }
const api = (path, opts = {}) => fetch(`/api/meta/${path}`, { headers: AUTH, signal: AbortSignal.timeout(opts.timeout || 30000), ...opts })
  .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); return d })

const TXT = {
  he: {
    title: 'סושיאל', sub: 'הודעות מסנג׳ר ואינסטגרם של העמודים. כל שיחה אפשר להפוך לליד בלחיצה.',
    search: 'חיפוש שם, @, טלפון…', f: { all: 'הכל', nolead: 'עוד לא ליד', unread: 'לא נקראו', messenger: 'מסנג׳ר', instagram: 'אינסטגרם' },
    empty: 'אין עדיין שיחות', emptySub: 'הודעות חדשות יגיעו לכאן מעצמן אחרי החיבור. אפשר גם לייבא את השיחות האחרונות.',
    pick: 'בחרו שיחה מהרשימה', isLead: 'ליד', addLead: 'הוסף כליד', openLead: 'כרטיס הליד', reply: 'כתבו תשובה…', send: 'שליחה',
    sending: 'שולח…', foundPhone: 'כתבו טלפון', openMeta: 'פתיחה ב-Meta', accounts: 'חשבונות מחוברים', importNow: 'ייבוא שיחות אחרונות',
    importing: 'מייבא…', imported: (t, m) => `יובאו ${t} שיחות, ${m} הודעות`,
    leadTitle: 'הוספה כליד', name: 'שם', phone: 'טלפון', email: 'אימייל', project: 'פרויקט', none: 'בלי פרויקט', stage: 'שלב', note: 'הערה',
    notePh: 'מה מחפשים, מה סוכם… (מה שנכתב בשיחה נשמר לבד)', save: 'הוספה ללידים', cancel: 'ביטול', added: 'נוסף ללידים',
    stages: { new: 'ליד חדש', contacted: 'נוצר קשר', discovery: 'מתעניין', meeting: 'נקבעה פגישה' },
    tablesMissing: 'צריך להפעיל פעם אחת את טבלאות הסושיאל במסד הנתונים (server/social-migration.sql).',
    // accounts panel
    accTitle: 'חשבונות מחוברים', accSub: 'כל ערוץ שמחובר למערכת, והאם הוא מקבל הודעות.', fbPages: 'עמודי פייסבוק (מסנג׳ר)', igAccounts: 'חשבונות אינסטגרם',
    waLines: 'מספרי וואטסאפ', receiving: 'מקבל הודעות', notReceiving: 'לא מחובר להודעות', connect: 'חיבור להודעות', connecting: 'מחבר…',
    noIg: 'לא נמצא חשבון אינסטגרם עסקי שמקושר לעמוד. מקשרים בהגדרות העמוד ← חשבונות מקושרים ← אינסטגרם.',
    missingScopes: 'להרשאות של המפתח של Meta חסר:', scopesHow: 'ב-business.facebook.com ← משתמשי מערכת ← יצירת מפתח חדש עם ההרשאות האלה, ואז להחליף את META_SYSTEM_USER_TOKEN ב-Vercel. באפליקציה של Meta צריך גם לאשר את ההרשאות להודעות (App Review).',
    igHook: 'לאינסטגרם: באפליקציה של Meta ← Webhooks ← Instagram ← להירשם לשדה messages עם אותה כתובת של הלידים.',
    waMain: 'קו המשרד', waState: { authorized: 'מחובר', notAuthorized: 'לא מחובר', error: 'לא ידוע' },
    waAdd: 'הוספת מספר נוסף (למשל של דניאל)', waAddHow: 'פותחים מופע חדש ב-console.green-api.com, סורקים את ה-QR מהטלפון של המספר, ושומרים את המזהה והמפתח ב-Vercel. החיבור של כמה מספרים לאותו מסך שיחות הוא השלב הבא.',
    close: 'סגירה', refresh: 'רענון',
  },
  en: {
    title: 'Social', sub: 'Messenger and Instagram messages of the pages. Any conversation becomes a lead in one click.',
    search: 'Search name, @, phone…', f: { all: 'All', nolead: 'Not a lead yet', unread: 'Unread', messenger: 'Messenger', instagram: 'Instagram' },
    empty: 'No conversations yet', emptySub: 'New messages arrive here by themselves once connected. You can also import the latest conversations.',
    pick: 'Pick a conversation', isLead: 'Lead', addLead: 'Add as a lead', openLead: 'Lead card', reply: 'Write a reply…', send: 'Send',
    sending: 'Sending…', foundPhone: 'Wrote a phone', openMeta: 'Open in Meta', accounts: 'Connected accounts', importNow: 'Import latest conversations',
    importing: 'Importing…', imported: (t, m) => `${t} conversations, ${m} messages imported`,
    leadTitle: 'Add as a lead', name: 'Name', phone: 'Phone', email: 'Email', project: 'Project', none: 'No project', stage: 'Stage', note: 'Note',
    notePh: 'What they look for, what was agreed… (the conversation is saved by itself)', save: 'Add to leads', cancel: 'Cancel', added: 'Added to the leads',
    stages: { new: 'New lead', contacted: 'Contacted', discovery: 'Interested', meeting: 'Meeting set' },
    tablesMissing: 'The social tables need to be created once in the database (server/social-migration.sql).',
    accTitle: 'Connected accounts', accSub: 'Every channel connected to the system, and whether it receives messages.', fbPages: 'Facebook pages (Messenger)', igAccounts: 'Instagram accounts',
    waLines: 'WhatsApp numbers', receiving: 'Receiving messages', notReceiving: 'Not connected to messages', connect: 'Connect messages', connecting: 'Connecting…',
    noIg: 'No Instagram business account is linked to the page. Link it in the page settings → Linked accounts → Instagram.',
    missingScopes: 'The Meta token is missing:', scopesHow: 'business.facebook.com → System users → generate a new token with these permissions, then replace META_SYSTEM_USER_TOKEN in Vercel. The Meta app also needs the messaging permissions approved (App Review).',
    igHook: 'For Instagram: Meta app → Webhooks → Instagram → subscribe to the messages field with the same URL as the leads.',
    waMain: 'Office line', waState: { authorized: 'Connected', notAuthorized: 'Not connected', error: 'Unknown' },
    waAdd: 'Add another number (e.g. Daniel’s)', waAddHow: 'Open a new instance at console.green-api.com, scan the QR from that number’s phone, and save its id and token in Vercel. Several numbers in one chats screen is the next step.',
    close: 'Close', refresh: 'Refresh',
  },
}
const fmtTime = (ts, lang) => {
  const d = new Date(ts); if (!Number.isFinite(d.getTime())) return ''
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'he-IL', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'numeric' })
}
const PlatIcon = ({ p, size = 14 }) => (p === 'instagram' ? <FaInstagram size={size} color="#E1306C"/> : <FaFacebookMessenger size={size} color="#0084FF"/>)
const nameOf = th => th?.name || (th?.username ? `@${th.username}` : '—')

function Face({ th, size = 40 }) {
  const [bad, setBad] = useState(false)
  return (
    <span className="si-face" style={{ width: size, height: size }}>
      {th?.avatar && !bad ? <img src={th.avatar} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)}/> : <b>{nameOf(th).replace('@', '').charAt(0)}</b>}
      <i><PlatIcon p={th?.platform} size={size > 36 ? 13 : 11}/></i>
    </span>
  )
}

function LeadForm({ th, t, lang, onDone, onCancel }) {
  const projects = useProjects()
  const active = projects.filter(p => p.status !== 'archived')
  const [f, setF] = useState({ name: th.name || th.username || '', phone: th.phone || '', email: th.email || '', projectId: '', leadStatus: 'contacted', note: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    setBusy(true); setErr('')
    try {
      const p = active.find(x => x.id === f.projectId)
      const d = await api('social-to-lead', { method: 'POST', body: JSON.stringify({ id: th.id, ...f, projectName: p?.name || '' }) })
      onDone(d.lead)
    } catch (e) { setErr(e.message); setBusy(false) }
  }
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }))
  return (
    <div className="si-leadform" role="form" aria-label={t.leadTitle}>
      <div className="si-lf-head"><b><UserPlus size={15}/>{t.leadTitle}</b><button type="button" className="si-x" onClick={onCancel} aria-label={t.cancel}><X size={15}/></button></div>
      <div className="si-lf-grid">
        <label>{t.name}<input value={f.name} onChange={set('name')} autoFocus/></label>
        <label>{t.phone}<input value={f.phone} onChange={set('phone')} dir="ltr" inputMode="tel" placeholder="05X-XXX-XXXX"/></label>
        <label>{t.email}<input value={f.email} onChange={set('email')} dir="ltr"/></label>
        <label>{t.stage}<select value={f.leadStatus} onChange={set('leadStatus')}>{Object.entries(t.stages).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <div className="si-lf-wide"><span>{t.project}</span>
          <div className="si-pchips">
            <button type="button" aria-pressed={!f.projectId} onClick={() => setF(x => ({ ...x, projectId: '' }))}>{t.none}</button>
            {active.map(p => <button key={p.id} type="button" aria-pressed={f.projectId === p.id} onClick={() => setF(x => ({ ...x, projectId: p.id }))} style={f.projectId === p.id ? { borderColor: p.color, background: `${p.color}1F` } : undefined}><i style={{ background: p.color }}/>{p.name}</button>)}
          </div>
        </div>
        <label className="si-lf-wide">{t.note}<textarea rows={2} value={f.note} onChange={set('note')} placeholder={t.notePh}/></label>
      </div>
      {err && <div className="si-err">{err}</div>}
      <div className="si-lf-foot"><button type="button" className="si-primary" disabled={busy} onClick={save}>{busy ? '…' : t.save}</button><button type="button" className="si-secondary" onClick={onCancel}>{t.cancel}</button></div>
    </div>
  )
}

function Accounts({ t, lang, onClose, onImported }) {
  const [st, setSt] = useState(null)
  const [wa, setWa] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const load = useCallback(fix => api(`social-status${fix ? '?fix=1' : ''}`, { timeout: 45000 }).then(setSt).catch(e => setSt({ error: e.message })), [])
  useEffect(() => { load(); api('chat-status', { timeout: 15000 }).then(setWa).catch(() => setWa({ state: 'error' })) }, [load])
  const doImport = async () => {
    setBusy('import'); setMsg('')
    try { const d = await api('social-sync', { method: 'POST', body: '{}', timeout: 60000 }); const tt = (d.pages || []).reduce((a, p) => a + (p.threads || 0), 0), mm = (d.pages || []).reduce((a, p) => a + (p.messages || 0), 0); setMsg(t.imported(tt, mm) + ((d.pages || []).some(p => p.error) ? ` · ${(d.pages.find(p => p.error) || {}).error}` : '')); onImported?.() }
    catch (e) { setMsg(e.message) }
    setBusy('')
  }
  const ok = v => <span className={`si-pill${v ? ' is-ok' : ''}`}>{v ? <Check size={12}/> : <AlertTriangle size={12}/>}{v ? t.receiving : t.notReceiving}</span>
  return (
    <div className="si-acc-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="si-acc" role="dialog" aria-modal="true" aria-label={t.accTitle} dir={lang === 'en' ? 'ltr' : 'rtl'}>
        <div className="si-lf-head"><b><Plug size={16}/>{t.accTitle}</b><button type="button" className="si-x" onClick={onClose} aria-label={t.close}><X size={16}/></button></div>
        <p className="si-muted">{t.accSub}</p>
        {!st ? <div className="si-muted">…</div> : st.error ? <div className="si-err">{st.error}</div> : <>
          {st.tablesMissing && <div className="si-warn">{t.tablesMissing}</div>}
          {st.missing?.length > 0 && <div className="si-warn"><b>{t.missingScopes}</b> <code>{st.missing.join(', ')}</code><div>{t.scopesHow}</div></div>}
          <h4><FaFacebookMessenger color="#0084FF"/>{t.fbPages}</h4>
          {(st.pages || []).map(p => (
            <div key={p.id} className="si-acc-row">
              <b>{p.name || p.id}</b>{ok(p.messages)}
              {!p.messages && <button type="button" className="si-secondary" disabled={!!busy} onClick={async () => { setBusy('fix'); await load(true); setBusy('') }}>{busy === 'fix' ? t.connecting : t.connect}</button>}
              {p.fix && p.fix !== 'subscribed' && <div className="si-err">{p.fix}</div>}
              {p.error && <div className="si-err">{p.error}</div>}
            </div>
          ))}
          <h4><FaInstagram color="#E1306C"/>{t.igAccounts}</h4>
          {(st.instagram || []).length ? st.instagram.map(a => <div key={a.id} className="si-acc-row"><b>@{a.username || a.name}</b><span className="si-muted">← {a.pageName}</span></div>) : <div className="si-muted">{t.noIg}</div>}
          <div className="si-muted si-small">{t.igHook}</div>
        </>}
        <h4><FaWhatsapp color="#25D366"/>{t.waLines}</h4>
        <div className="si-acc-row"><b>{t.waMain}{wa?.phone ? ` · ${wa.phone}` : ''}</b><span className={`si-pill${wa?.state === 'authorized' ? ' is-ok' : ''}`}>{t.waState[wa?.state] || t.waState.error}</span></div>
        <details className="si-more"><summary>{t.waAdd}</summary><div className="si-muted">{t.waAddHow}</div></details>
        <div className="si-lf-foot">
          <button type="button" className="si-primary" disabled={!!busy} onClick={doImport}><RefreshCw size={14}/>{busy === 'import' ? t.importing : t.importNow}</button>
          <button type="button" className="si-secondary" onClick={() => load()}>{t.refresh}</button>
        </div>
        {msg && <div className="si-muted">{msg}</div>}
      </div>
    </div>
  )
}

export default function SocialInboxTab({ lang = 'he', onOpenLead }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const [threads, setThreads] = useState(null)
  const [missing, setMissing] = useState(false)
  const [sel, setSel] = useState('')
  const [conv, setConv] = useState({ thread: null, messages: [] })
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [leadForm, setLeadForm] = useState(false)
  const [accOpen, setAccOpen] = useState(false)
  const [toast, setToast] = useState('')
  const endRef = useRef(null)
  const selRef = useRef(sel); selRef.current = sel

  const loadThreads = useCallback(() => api('social-threads').then(d => { setThreads(d.threads || []); setMissing(!!d.tablesMissing) }).catch(e => { setThreads([]); setErr(e.message) }), [])
  const loadConv = useCallback(id => api(`social-thread?id=${encodeURIComponent(id)}`).then(d => { if (selRef.current === id) setConv({ thread: d.thread, messages: d.messages || [] }) }).catch(() => {}), [])
  useEffect(() => { loadThreads() }, [loadThreads])
  useEffect(() => { if (sel) { setConv({ thread: null, messages: [] }); setLeadForm(false); setErr(''); loadConv(sel) } }, [sel, loadConv])
  // the database announces every change (a message in, our reply, a lead made): just re-read what changed
  useEffect(() => {
    const re = debounce(() => { loadThreads(); if (selRef.current) loadConv(selRef.current) }, 700)
    return onSync(m => { if (m.t === 'social_threads' || m.t === '*') re() })
  }, [loadThreads, loadConv])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [conv.messages.length, sel])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase(), d = q.replace(/\D/g, '')
    return (threads || []).filter(th => {
      if (filter === 'nolead' && th.lead_id) return false
      if (filter === 'unread' && !th.unread) return false
      if ((filter === 'messenger' || filter === 'instagram') && th.platform !== filter) return false
      if (!s) return true
      return [th.name, th.username, th.last_text].some(v => String(v || '').toLowerCase().includes(s)) || (d.length >= 3 && String(th.phone || '').includes(d))
    })
  }, [threads, q, filter])
  const counts = useMemo(() => ({ all: (threads || []).length, nolead: (threads || []).filter(x => !x.lead_id).length, unread: (threads || []).filter(x => x.unread).length, messenger: (threads || []).filter(x => x.platform === 'messenger').length, instagram: (threads || []).filter(x => x.platform === 'instagram').length }), [threads])
  const th = conv.thread || (threads || []).find(x => x.id === sel) || null

  const send = async () => {
    const body = text.trim()
    if (!body || !sel || sending) return
    setSending(true); setErr('')
    const tmp = { id: `tmp-${Date.now()}`, direction: 'out', body, ts: new Date().toISOString(), pending: true }
    setConv(c => ({ ...c, messages: [...c.messages, tmp] })); setText('')
    try { await api('social-send', { method: 'POST', body: JSON.stringify({ id: sel, text: body }) }); loadConv(sel) }
    catch (e) { setErr(e.message); setText(body); setConv(c => ({ ...c, messages: c.messages.filter(m => m.id !== tmp.id) })) }
    setSending(false)
  }

  return (
    <div className="si" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <aside className={`si-list${sel ? ' has-sel' : ''}`}>
        <div className="si-top">
          <div className="si-title"><h2>{t.title}</h2><button type="button" className="si-accbtn" onClick={() => setAccOpen(true)}><Plug size={14}/>{t.accounts}</button></div>
          <p className="si-muted">{t.sub}</p>
          <div className="si-search"><Search size={14}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}/></div>
          <div className="si-filters" role="tablist">
            {Object.keys(t.f).map(k => <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}>{t.f[k]}{counts[k] > 0 && <em>{counts[k]}</em>}</button>)}
          </div>
        </div>
        {missing && <div className="si-warn si-m">{t.tablesMissing}</div>}
        <div className="si-rows" role="list">
          {threads === null ? <div className="si-muted si-m">…</div> : !list.length ? (
            <div className="si-empty"><b>{t.empty}</b><span>{t.emptySub}</span><button type="button" className="si-secondary" onClick={() => setAccOpen(true)}><Plug size={14}/>{t.accounts}</button></div>
          ) : list.map(x => (
            <button key={x.id} type="button" role="listitem" className={`si-row${sel === x.id ? ' is-on' : ''}${x.unread ? ' is-unread' : ''}`} onClick={() => setSel(x.id)}>
              <Face th={x}/>
              <span className="si-row-main">
                <span className="si-row-top"><b><bdi>{nameOf(x)}</bdi></b><small>{fmtTime(x.last_at, lang)}</small></span>
                <span className="si-row-bot"><span className="si-last" dir="auto">{x.last_dir === 'out' ? '✓ ' : ''}{x.last_text || ''}</span>
                  {x.lead_id ? <span className="si-badge is-lead">{t.isLead}</span> : x.phone ? <span className="si-badge">{t.foundPhone}</span> : null}
                  {x.unread > 0 && <span className="si-unread">{x.unread}</span>}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="si-conv">
        {!th ? <div className="si-pick">{t.pick}</div> : <>
          <header className="si-conv-head">
            <button type="button" className="si-back" onClick={() => setSel('')} aria-label={t.close}>›</button>
            <Face th={th} size={42}/>
            <div className="si-who"><b><bdi>{nameOf(th)}</bdi></b><small>{th.platform === 'instagram' ? 'Instagram' : 'Messenger'}{th.username && th.name ? ` · @${th.username}` : ''}{th.phone ? ` · ${th.phone}` : ''}</small></div>
            {th.lead_id
              ? <button type="button" className="si-secondary" onClick={() => (onOpenLead ? onOpenLead(th.lead_id) : window.open(`/admin-panel/leads?lead=${encodeURIComponent(th.lead_id)}`, '_blank'))}><Link2 size={14}/>{t.openLead}</button>
              : <button type="button" className="si-primary" onClick={() => setLeadForm(v => !v)}><UserPlus size={14}/>{t.addLead}</button>}
            <a className="si-icon" href="https://business.facebook.com/latest/inbox/all" target="_blank" rel="noreferrer" title={t.openMeta} aria-label={t.openMeta}><ExternalLink size={15}/></a>
          </header>
          {leadForm && !th.lead_id && <LeadForm th={th} t={t} lang={lang} onCancel={() => setLeadForm(false)} onDone={lead => { setLeadForm(false); setToast(t.added); setTimeout(() => setToast(''), 3000); setConv(c => ({ ...c, thread: { ...c.thread, lead_id: String(lead.id) } })); loadThreads() }}/>}
          <div className="si-msgs">
            {conv.messages.map(m => (
              <div key={m.id} className={`si-bub is-${m.direction}${m.pending ? ' is-pending' : ''}`}>
                {(m.attachments || []).map((a, i) => a.type === 'image' && a.url ? <img key={i} src={a.url} alt="" referrerPolicy="no-referrer"/> : a.url ? <a key={i} href={a.url} target="_blank" rel="noreferrer">📎 {a.type}</a> : null)}
                {m.body && <span dir="auto">{m.body}</span>}
                <small>{fmtTime(m.ts, lang)}</small>
              </div>
            ))}
            <div ref={endRef}/>
          </div>
          {err && <div className="si-err si-m">{err}</div>}
          <div className="si-composer">
            <textarea value={text} onChange={e => setText(e.target.value)} placeholder={t.reply} rows={1} dir="auto"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}/>
            <button type="button" className="si-send" disabled={!text.trim() || sending} onClick={send}><Send size={15}/>{sending ? t.sending : t.send}</button>
          </div>
        </>}
      </section>
      {accOpen && <Accounts t={t} lang={lang} onClose={() => setAccOpen(false)} onImported={loadThreads}/>}
      {toast && <div className="si-toast" role="status"><Check size={14}/>{toast}</div>}
      <style>{SI_CSS}</style>
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
.si-icon{width:34px;height:34px;border:1px solid var(--au-line);border-radius:9px;display:inline-flex;align-items:center;justify-content:center;color:var(--au-text2)}
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
`
