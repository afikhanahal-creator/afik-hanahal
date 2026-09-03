// ─── PUBLIC PROPERTY SUMMARY — /newproperty/<token> ──────────────────────────
// The shareable confirmation page a seller gets after submitting the intake
// form. Shows everything the seller entered EXCEPT internal-only answers
// (minimum price, expected price, past offers, mortgage balance, "keep out of
// the listing" notes), so a spouse / co-owner can verify the details and click
// "I confirm the details are correct". noindex, no login, token in the URL.
//
// Also exports the pieces the intake form reuses right after submission:
//   SummaryView        – the rendered summary (from API data or local answers)
//   ShareMenu          – copy link / WhatsApp / native share
//   buildLocalSummary  – turn local answers into the same data shape the API returns
import { useState, useEffect, useRef, useMemo } from 'react'
import { buildSummary, buildStory, headline, publicAnswers, fmtNum, STEPS, purposeOf } from './sellerFormSchema.js'

const API = import.meta.env.PROD ? '' : (import.meta.env.VITE_SELLER_API_BASE || '')
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap'

export const T = {
  he: {
    brand: 'אפיק הנחל', thanks: 'תודה, הפרטים התקבלו בהצלחה', thanksSub: 'הנכס נקלט אצלנו ומחכה לבדיקת צוות אפיק הנחל. זה סיכום כל מה שנמסר. בדקו שהכל נכון, ושתפו עם מי שצריך לאמת.',
    pageTitle: 'סיכום פרטי הנכס', pageSub: 'סיכום הפרטים שנמסרו לאפיק הנחל לקליטת הנכס. בדקו שהכל נכון ואשרו למטה.',
    refLabel: 'מספר תיק', submittedAt: 'התקבל', share: 'שתף ואמת את הפרטים', shareForm: 'שתף טופס', copyLink: 'העתקת קישור', copied: 'הקישור הועתק', whatsapp: 'שליחה בוואטסאפ', native: 'שיתוף…',
    shareText: 'היי, מילאתי את פרטי הנכס לאפיק הנחל. תעברו על הסיכום ותאשרו שהכל נכון:', shareFormText: 'היי, אפיק הנחל מבקשים שנמלא את פרטי הנכס. אפשר להמשיך את הטופס כאן:',
    story: 'סיפור הנכס', details: 'כל הפרטים', media: 'תמונות וסרטונים', verifyTitle: 'אימות הפרטים', verifySub: 'כל אחד מהבעלים יכול לאשר כאן שהפרטים נכונים. האישור נרשם בתיק הנכס.',
    yourName: 'השם שלכם', verifyBtn: 'אני מאשר/ת שהפרטים נכונים', verified: 'אימתו את הפרטים', verifiedBadge: 'הפרטים אומתו', notVerified: 'ממתין לאימות בעלים', verifyDone: 'תודה! האישור נרשם.',
    factPrice: 'מחיר מבוקש', factRent: 'שכירות חודשית', factRooms: 'חדרים', factArea: 'מ״ר בנוי', factFloor: 'קומה', factParking: 'חניות',
    loading: 'טוען את פרטי הנכס…', notFound: 'הקישור לא נמצא או שפג תוקפו', error: 'לא הצלחנו לטעון את הסיכום. נסו שוב בעוד רגע.', retry: 'נסו שוב',
    privacy: 'עמוד זה מיועד לבעלי הנכס ולמי שהם בחרו לשתף. מידע פנימי (מחיר מינימום, הצעות קודמות) אינו מוצג כאן.', home: 'לאתר אפיק הנחל', wa: 'לשלוח לנו הודעה בוואטסאפ',
    demo: 'תצוגה מקומית: הסיכום נבנה מהתשובות שמולאו במכשיר הזה.', videos: 'סרטונים', photos: 'תמונות', plan: 'תוכנית',
  },
  en: {
    brand: 'Afik Hanahal', thanks: 'Thank you, your details were received', thanksSub: 'The property is now in our system, waiting for the Afik Hanahal team to review it. This is a summary of everything you told us. Check it, and share it with anyone who should verify it.',
    pageTitle: 'Property summary', pageSub: 'A summary of the details given to Afik Hanahal for listing the property. Check that everything is correct and confirm below.',
    refLabel: 'File number', submittedAt: 'Received', share: 'Share and verify the details', shareForm: 'Share form', copyLink: 'Copy link', copied: 'Link copied', whatsapp: 'Send on WhatsApp', native: 'Share…',
    shareText: 'Hi, I filled in our property details for Afik Hanahal. Please review the summary and confirm everything is correct:', shareFormText: 'Hi, Afik Hanahal asked us to fill in our property details. You can continue the form here:',
    story: 'The property story', details: 'All the details', media: 'Photos and videos', verifyTitle: 'Verify the details', verifySub: 'Each owner can confirm here that the details are correct. The confirmation is recorded in the property file.',
    yourName: 'Your name', verifyBtn: 'I confirm the details are correct', verified: 'verified the details', verifiedBadge: 'Details verified', notVerified: 'Awaiting owner verification', verifyDone: 'Thank you! Your confirmation was recorded.',
    factPrice: 'Asking price', factRent: 'Monthly rent', factRooms: 'Rooms', factArea: 'm² built', factFloor: 'Floor', factParking: 'Parking',
    loading: 'Loading the property details…', notFound: 'This link was not found or has expired', error: 'We could not load the summary. Please try again in a moment.', retry: 'Try again',
    privacy: 'This page is for the property owners and whoever they choose to share it with. Internal information (minimum price, past offers) is not shown here.', home: 'Afik Hanahal website', wa: 'Message us on WhatsApp',
    demo: 'Local view: this summary was built from the answers filled in on this device.', videos: 'Videos', photos: 'Photos', plan: 'Floor plan',
  },
}
const OFFICE_WA = '972559811814'

// Button + share-menu styles, self-contained so ShareMenu also works inside the intake form header
const SHARE_CSS = `
.ps-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:11px 20px; border-radius:6px; border:1px solid #26242B; background:#26242B; color:#fff; font-size:15.5px; font-weight:700; cursor:pointer; text-decoration:none; transition:all .15s; font-family:inherit; }
.ps-btn:hover { background:#3F4EB0; border-color:#3F4EB0; }
.ps-btn:disabled { opacity:.5; cursor:default; }
.ps-btn.ghost { background:#fff; color:#26242B; border-color:#C6C6CC; }
.ps-btn.ghost:hover { background:#EEF0FA; color:#3F4EB0; border-color:#3F4EB0; }
.ps-btn.wa { background:#25D366; border-color:#25D366; }
.ps-btn.sm { padding:8px 12px; min-height:38px; font-size:13.5px; }
.ps-share { position:relative; display:inline-block; }
.ps-share-menu { position:absolute; top:calc(100% + 6px); inset-inline-start:50%; transform:translateX(-50%); background:#fff; border:1px solid #C6C6CC; border-radius:8px; box-shadow:0 12px 32px rgba(0,0,0,.14); padding:6px; z-index:80; display:flex; flex-direction:column; min-width:220px; }
[dir="rtl"] .ps-share-menu { transform:translateX(50%); }
.ps-share-menu button, .ps-share-menu a { display:flex; align-items:center; gap:10px; width:100%; text-align:start; padding:12px 14px; min-height:44px; border:0; background:none; color:#26242B; font-size:15px; font-weight:500; cursor:pointer; border-radius:6px; text-decoration:none; font-family:inherit; }
.ps-share-menu button:hover, .ps-share-menu a:hover { background:#EEF0FA; color:#3F4EB0; }
.ps-share-menu a.wa { color:#128C7E; }
.ps-share-menu a.wa svg { color:#25D366; }
.ps-share-menu a.wa:hover { background:#E6F7EC; color:#0B7A6B; }
`

// ── share helpers ────────────────────────────────────────────────────────────
export function ShareMenu({ url, title, text, lang = 'he', label, compact }) {
  const t = T[lang] || T.he
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef(null)
  const canNative = typeof navigator !== 'undefined' && !!navigator.share
  // close on outside tap / Escape (mobile and desktop)
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  const copy = async () => { try { await navigator.clipboard.writeText(url) } catch { const i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select(); document.execCommand('copy'); i.remove() } setCopied(true); setTimeout(() => setCopied(false), 1800) }
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
  const native = async () => { try { await navigator.share({ title, text, url }) ; setOpen(false) } catch {} }
  return (
    <div className={`ps-share${open ? ' open' : ''}${compact ? ' compact' : ''}`} ref={rootRef}>
      <style>{SHARE_CSS}</style>
      <button type="button" className={`ps-btn${compact ? ' sm ghost' : ''}`} onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="menu"><IcoShare/>{label || t.share}</button>
      {open && (
        <div className="ps-share-menu" role="menu">
          <button type="button" role="menuitem" onClick={copy}><IcoLink/>{copied ? t.copied : t.copyLink}</button>
          <a role="menuitem" className="wa" href={wa} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><IcoWa/>{t.whatsapp}</a>
          {canNative && <button type="button" role="menuitem" onClick={native}><IcoShare/>{t.native}</button>}
        </div>
      )}
    </div>
  )
}

// Same shape as the API's public view, built locally from answers (used right after submit, and in the demo)
export function buildLocalSummary(answers, { ref, token, files = [] } = {}) {
  const a = publicAnswers(answers || {})
  const n = v => (v === undefined || v === null || v === '' || Number.isNaN(Number(v))) ? null : Number(v)
  const media = []
  STEPS.filter(s => s.type === 'upload' && ['photos', 'videos', 'plan'].includes(s.kind)).forEach(s => (Array.isArray(answers?.[s.id]) ? answers[s.id] : []).forEach(f => { if (f.status === 'done' || !f.status) media.push({ kind: s.kind, name: f.name, type: f.type, url: f.preview || f.url || null }) }))
  return {
    ok: true, ref, token, lang: 'he', submitted_at: new Date().toISOString(), status: 'new', local: true, purpose: purposeOf(a),
    headline: { he: headline(a, 'he'), en: headline(a, 'en') },
    sections: { he: buildSummary(a, 'he'), en: buildSummary(a, 'en') },
    story: { he: buildStory(a, 'he'), en: buildStory(a, 'en') },
    facts: { price: n(a.d_ask), rooms: a.p_rooms || null, built: n(a.p_area?.built), floor: a.p_floor?.floor ?? null, totalFloors: a.p_floor?.totalFloors ?? null, parking: n(a.f_parking?.parking) },
    media, verifications: [], owner_verified_at: null,
  }
}

const fmtDate = (iso, lang) => { try { return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return '' } }

// ── the summary itself ───────────────────────────────────────────────────────
export function SummaryView({ data, lang, setLang, shareUrl, mode = 'page', onVerified }) {
  const t = T[lang] || T.he
  const [name, setName] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState('')
  const [verifications, setVerifications] = useState(data.verifications || [])
  const sections = data.sections?.[lang] || data.sections?.he || []
  const story = data.story?.[lang] || data.story?.he || []
  const title = data.headline?.[lang] || data.headline?.he || ''
  const f = data.facts || {}
  const facts = [
    f.price ? { k: data.purpose === 'rental' ? t.factRent : t.factPrice, v: `${lang === 'en' ? '₪' : ''}${fmtNum(f.price, lang)}${lang === 'en' ? '' : ' ₪'}`, hi: true } : null,
    f.rooms ? { k: t.factRooms, v: f.rooms } : null,
    f.built ? { k: t.factArea, v: fmtNum(f.built, lang) } : null,
    f.floor !== null && f.floor !== undefined && f.floor !== '' ? { k: t.factFloor, v: `${f.floor}${f.totalFloors ? ` / ${f.totalFloors}` : ''}` } : null,
    f.parking !== null && f.parking !== undefined ? { k: t.factParking, v: f.parking } : null,
  ].filter(Boolean)
  const photos = (data.media || []).filter(m => m.kind === 'photos' && m.url)
  const videos = (data.media || []).filter(m => m.kind === 'videos' && m.url)
  const plans = (data.media || []).filter(m => m.kind === 'plan' && m.url)
  const verify = async e => {
    e.preventDefault()
    if (!name.trim() || !data.token) return
    setVerifying(true); setVerifyMsg('')
    try {
      const r = await fetch(`${API}/api/seller-form?action=verify&token=${encodeURIComponent(data.token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setVerifications(d.verifications || []); setVerifyMsg(t.verifyDone); setName(''); onVerified?.(d)
    } catch (err) { setVerifyMsg(t.error) }
    finally { setVerifying(false) }
  }
  const verified = verifications.length > 0
  return (
    <div className="ps-wrap">
      <header className="ps-top">
        <a href="/" className="ps-brand" aria-label={t.brand}><img src="/logo-mark-black.svg" alt="" className="ps-logo"/><span>{t.brand}</span></a>
        {setLang && <button type="button" className="ps-lang" onClick={() => setLang(lang === 'he' ? 'en' : 'he')}>{lang === 'he' ? 'English' : 'עברית'}</button>}
      </header>
      <main className="ps-main">
        <section className="ps-hero">
          <div className="ps-ok"><IcoCheck/></div>
          <h1>{mode === 'done' ? t.thanks : t.pageTitle}</h1>
          <p>{mode === 'done' ? t.thanksSub : t.pageSub}</p>
          <div className="ps-meta">
            {data.ref && <span><small>{t.refLabel}</small><b dir="ltr">{data.ref}</b></span>}
            {data.submitted_at && <span><small>{t.submittedAt}</small><b>{fmtDate(data.submitted_at, lang)}</b></span>}
            <span className={`ps-vbadge${verified ? ' on' : ''}`}>{verified ? t.verifiedBadge : t.notVerified}</span>
          </div>
          {shareUrl && <div className="ps-share-row"><ShareMenu url={shareUrl} title={title} text={t.shareText} lang={lang}/></div>}
          {data.local && <p className="ps-demo">{t.demo}</p>}
        </section>

        <section className="ps-card ps-headline">
          <h2>{title}</h2>
          {facts.length > 0 && <div className="ps-facts">{facts.map(x => <div key={x.k} className={`ps-fact${x.hi ? ' hi' : ''}`}><small>{x.k}</small><b>{x.v}</b></div>)}</div>}
        </section>

        {(photos.length > 0 || videos.length > 0 || plans.length > 0) && (
          <section className="ps-card">
            <h3>{t.media}</h3>
            {photos.length > 0 && <div className="ps-gallery">{photos.map((m, i) => <a key={i} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt="" loading="lazy"/></a>)}</div>}
            {videos.length > 0 && <div className="ps-videos">{videos.map((m, i) => <video key={i} src={m.url} controls preload="metadata" playsInline/>)}</div>}
            {plans.length > 0 && <div className="ps-plans">{plans.map((m, i) => <a key={i} href={m.url} target="_blank" rel="noreferrer" className="ps-btn sm ghost"><IcoLink/>{t.plan} {plans.length > 1 ? i + 1 : ''}</a>)}</div>}
          </section>
        )}

        {story.length > 0 && (
          <section className="ps-card ps-story">
            <h3>{t.story}</h3>
            {story.map((p, i) => <div key={i} className="ps-para"><h4><span>{String(i + 1).padStart(2, '0')}</span>{p.title}</h4><p>{p.text}</p></div>)}
          </section>
        )}

        <section className="ps-card">
          <h3>{t.details}</h3>
          <div className="ps-grid">
            {sections.map(sec => (
              <div className="ps-sec" key={sec.section}>
                <h4>{sec.title}</h4>
                {sec.items.map(it => (
                  <div className="ps-item" key={it.id}>
                    <span className="k">{it.label}</span>
                    <span className="v">{it.chips ? <><span className="ps-chips">{it.chips.map(c => <em key={c}>{c}</em>)}</span>{it.note && <span className="ps-note">{it.note}</span>}</> : it.value}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {data.token && (
          <section className="ps-card ps-verify" id="verify">
            <h3>{t.verifyTitle}</h3>
            <p>{t.verifySub}</p>
            {verifications.length > 0 && (
              <ul className="ps-vlist">{verifications.map((v, i) => <li key={i}><IcoCheck small/> <b>{v.name}</b> {t.verified} · {fmtDate(v.at, lang)}</li>)}</ul>
            )}
            <form onSubmit={verify} className="ps-vform">
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t.yourName} required maxLength={80}/>
              <button type="submit" className="ps-btn" disabled={verifying || !name.trim()}>{t.verifyBtn}</button>
            </form>
            {verifyMsg && <div className="ps-vmsg">{verifyMsg}</div>}
          </section>
        )}

        <footer className="ps-foot">
          <p>{t.privacy}</p>
          <div className="ps-foot-links">
            <a className="ps-btn ghost sm" href="/">{t.home}</a>
            <a className="ps-btn wa sm" href={`https://wa.me/${OFFICE_WA}?text=${encodeURIComponent(`${data.ref ? `תיק ${data.ref}: ` : ''}`)}`} target="_blank" rel="noreferrer"><IcoWa/>{t.wa}</a>
          </div>
        </footer>
      </main>
      <style>{CSS}</style>
    </div>
  )
}

// ── standalone page: /newproperty/<token> ────────────────────────────────────
export default function PropertySummary({ token }) {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('afik_lang') === 'en' ? 'en' : 'he' } catch { return 'he' } })
  const [state, setState] = useState({ loading: true, data: null, error: '' })
  const t = T[lang] || T.he
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_HREF; document.head.appendChild(l) }
    document.documentElement.style.opacity = '1'
    document.body.style.background = '#EFEFF1'
  }, [])
  useEffect(() => { document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'; document.documentElement.lang = lang; document.title = lang === 'en' ? 'Property summary · Afik Hanahal' : 'סיכום פרטי הנכס · אפיק הנחל'; try { localStorage.setItem('afik_lang', lang) } catch {} }, [lang])
  const load = () => {
    setState({ loading: true, data: null, error: '' })
    fetch(`${API}/api/seller-form?action=summary&token=${encodeURIComponent(token)}`)
      .then(async r => { const d = await r.json().catch(() => ({})); if (r.status === 404) throw new Error('notfound'); if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`); return d })
      .then(d => setState({ loading: false, data: { ...d, token }, error: '' }))
      .catch(e => setState({ loading: false, data: null, error: e.message === 'notfound' ? 'notfound' : 'error' }))
  }
  useEffect(load, [token]) // eslint-disable-line react-hooks/exhaustive-deps
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/newproperty/${token}` : ''
  if (state.loading) return <div className="ps-wrap"><div className="ps-center"><div className="ps-spin"/><p>{t.loading}</p></div><style>{CSS}</style></div>
  if (state.error) return <div className="ps-wrap"><div className="ps-center"><h1>{state.error === 'notfound' ? t.notFound : t.error}</h1>{state.error !== 'notfound' && <button className="ps-btn" onClick={load}>{t.retry}</button>}<a className="ps-btn ghost" href="/">{t.home}</a></div><style>{CSS}</style></div>
  return <SummaryView data={state.data} lang={lang} setLang={setLang} shareUrl={shareUrl} mode="page"/>
}

// ── icons ────────────────────────────────────────────────────────────────────
const IcoCheck = ({ small }) => <svg width={small ? 14 : 34} height={small ? 14 : 34} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
const IcoShare = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
const IcoLink = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>
const IcoWa = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3C4.1 15 3.7 13.5 3.7 12c0-4.6 3.7-8.3 8.3-8.3s8.3 3.7 8.3 8.3-3.7 8.2-8.3 8.2z"/></svg>

const CSS = `
.ps-wrap { --ink:#26242B; --ink2:#4A4852; --muted:#75727C; --canvas:#EFEFF1; --paper:#fff; --line:#DCDCE0; --line2:#C6C6CC; --box:#E3E3E7; --purple:#8490D8; --deep:#3F4EB0; --tint:#EEF0FA; --tint2:#DFE3F6; --ok:#1F9D55;
  font-family:'Heebo', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color:var(--ink); background:var(--canvas); min-height:100dvh; -webkit-font-smoothing:antialiased; }
.ps-wrap *, .ps-wrap *::before, .ps-wrap *::after { box-sizing:border-box; }
.ps-wrap button, .ps-wrap input { font-family:inherit; }
.ps-top { position:sticky; top:0; z-index:20; background:var(--paper); border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; padding:0 clamp(14px,3vw,32px); min-height:56px; }
.ps-brand { display:flex; align-items:center; gap:10px; text-decoration:none; color:var(--ink); font-weight:700; font-size:14px; }
.ps-logo { height:30px; width:auto; }
.ps-lang { font-size:13px; font-weight:600; min-height:40px; padding:8px 12px; border-radius:6px; border:1px solid var(--line2); background:#fff; color:var(--ink); cursor:pointer; }
.ps-main { max-width:860px; margin:0 auto; padding:28px clamp(14px,3vw,28px) 60px; display:flex; flex-direction:column; gap:14px; }
.ps-hero { text-align:center; padding:8px 0 6px; }
.ps-ok { width:64px; height:64px; border-radius:50%; background:var(--tint2); color:var(--deep); display:inline-flex; align-items:center; justify-content:center; margin-bottom:14px; }
.ps-hero h1 { font-size:clamp(26px, 4.2vw, 38px); font-weight:700; margin:0 0 10px; letter-spacing:-.015em; line-height:1.2; text-wrap:balance; }
.ps-hero p { margin:0 auto; max-width:560px; color:var(--ink2); font-size:16px; line-height:1.6; }
.ps-meta { display:flex; justify-content:center; flex-wrap:wrap; gap:10px; margin:16px 0 0; align-items:center; }
.ps-meta > span { display:inline-flex; align-items:center; gap:8px; background:var(--paper); border:1px solid var(--line); border-radius:20px; padding:6px 12px; font-size:13px; }
.ps-meta small { color:var(--muted); font-size:11px; letter-spacing:.08em; text-transform:uppercase; }
.ps-meta b { font-weight:700; font-variant-numeric:tabular-nums; }
.ps-vbadge { color:#9A6B00; background:#FFF4D6 !important; border-color:#F3DFA3 !important; font-weight:600; }
.ps-vbadge.on { color:var(--ok); background:#E6F7EC !important; border-color:#BFE8CC !important; }
.ps-share-row { margin-top:16px; display:flex; justify-content:center; }
.ps-demo { margin-top:12px !important; font-size:12.5px !important; color:var(--muted) !important; }
.ps-card { background:var(--paper); border:1px solid var(--line); border-radius:16px; padding:20px clamp(16px, 3vw, 28px) 22px; box-shadow:0 6px 24px rgba(38,36,43,.05); }
.ps-card h3 { margin:0 0 12px; font-size:12.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--deep); font-weight:700; }
.ps-headline { background:linear-gradient(135deg, #26242B 0%, #33324A 100%); color:#fff; border-color:var(--ink); text-align:center; box-shadow:0 18px 50px rgba(38,36,43,.18); }
.ps-headline h2 { margin:0; font-size:clamp(22px, 3.2vw, 30px); font-weight:700; letter-spacing:-.01em; line-height:1.25; text-wrap:balance; }
.ps-facts { display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:16px; }
.ps-fact { min-width:96px; padding:9px 14px; border-radius:8px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); display:flex; flex-direction:column; align-items:center; gap:2px; }
.ps-fact small { font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.6); }
.ps-fact b { font-size:17px; font-variant-numeric:tabular-nums; }
.ps-fact.hi { background:var(--deep); border-color:var(--deep); }
.ps-gallery { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:8px; }
.ps-gallery a { display:block; aspect-ratio:4/3; border-radius:8px; overflow:hidden; background:var(--box); }
.ps-gallery img { width:100%; height:100%; object-fit:cover; display:block; }
.ps-videos { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:10px; margin-top:10px; }
.ps-videos video { width:100%; border-radius:8px; background:#000; max-height:320px; }
.ps-plans { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
.ps-story { padding-top:22px; }
.ps-para { padding:18px 0; border-top:1px solid var(--line); }
.ps-para:first-of-type { border-top:0; padding-top:4px; }
.ps-para h4 { display:flex; align-items:center; gap:10px; margin:0 0 8px; font-size:12.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--deep); font-weight:700; }
.ps-para h4 span { flex:none; width:24px; height:24px; border-radius:50%; background:var(--tint2); color:var(--deep); font-size:11px; letter-spacing:0; display:inline-flex; align-items:center; justify-content:center; font-variant-numeric:tabular-nums; }
.ps-para p { margin:0; font-size:16.5px; line-height:1.8; }
.ps-para:first-of-type p { font-size:18.5px; line-height:1.7; font-weight:500; padding-inline-start:16px; border-inline-start:3px solid var(--deep); }
.ps-grid { display:flex; flex-direction:column; gap:18px; }
.ps-sec h4 { margin:0 0 4px; font-size:15px; font-weight:700; color:var(--ink); padding-bottom:9px; border-bottom:2px solid var(--tint2); }
.ps-item { display:grid; grid-template-columns:170px 1fr; gap:12px; padding:8px 0; border-top:1px solid var(--line); font-size:14.5px; align-items:baseline; }
.ps-item:first-of-type { border-top:0; }
.ps-item .k { color:var(--muted); font-size:12.5px; }
.ps-item .v { white-space:pre-wrap; word-break:break-word; line-height:1.5; }
.ps-chips { display:flex; flex-wrap:wrap; gap:4px; }
.ps-chips em { font-style:normal; font-size:12.5px; padding:2px 8px; border-radius:20px; background:var(--tint2); }
.ps-note { display:block; margin-top:5px; font-size:12.5px; color:var(--ink2); }
.ps-verify p { margin:0 0 12px; color:var(--ink2); font-size:14.5px; line-height:1.5; }
.ps-vlist { list-style:none; margin:0 0 14px; padding:0; display:flex; flex-direction:column; gap:6px; }
.ps-vlist li { display:flex; align-items:center; gap:6px; font-size:14px; color:var(--ok); background:#E6F7EC; border-radius:6px; padding:8px 12px; }
.ps-vlist li b { color:var(--ink); }
.ps-vform { display:flex; gap:8px; flex-wrap:wrap; }
.ps-vform input { flex:1 1 200px; padding:11px 12px; font-size:16px; border:1px solid var(--line2); border-radius:6px; background:#fff; }
.ps-vmsg { margin-top:10px; font-size:14px; color:var(--ok); font-weight:600; }
.ps-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:11px 20px; border-radius:6px; border:1px solid var(--ink); background:var(--ink); color:#fff; font-size:15.5px; font-weight:700; cursor:pointer; text-decoration:none; transition:all .15s; }
.ps-btn:hover { background:var(--deep); border-color:var(--deep); }
.ps-btn:disabled { opacity:.5; cursor:default; }
.ps-btn.ghost { background:#fff; color:var(--ink); border-color:var(--line2); }
.ps-btn.ghost:hover { background:var(--tint); color:var(--deep); border-color:var(--deep); }
.ps-btn.wa { background:#25D366; border-color:#25D366; }
.ps-btn.sm { padding:8px 14px; font-size:14px; }
.ps-share { position:relative; display:inline-block; }
.ps-share-menu { position:absolute; top:calc(100% + 6px); inset-inline-start:50%; transform:translateX(-50%); background:#fff; border:1px solid var(--line2); border-radius:8px; box-shadow:0 12px 32px rgba(0,0,0,.14); padding:6px; z-index:30; display:flex; flex-direction:column; min-width:220px; }
[dir="rtl"] .ps-share-menu { transform:translateX(50%); }
.ps-share-menu button, .ps-share-menu a { display:flex; align-items:center; gap:10px; width:100%; text-align:start; padding:10px 12px; border:0; background:none; color:var(--ink); font-size:14.5px; font-weight:500; cursor:pointer; border-radius:6px; text-decoration:none; }
.ps-share-menu button:hover, .ps-share-menu a:hover { background:var(--tint); color:var(--deep); }
.ps-share-menu a.wa { color:#128C7E; }
.ps-share-menu a.wa svg { color:#25D366; }
.ps-share-menu a.wa:hover { background:#E6F7EC; color:#0B7A6B; }
.ps-foot { text-align:center; padding:14px 0 0; }
.ps-foot p { font-size:12.5px; color:var(--muted); margin:0 0 12px; }
.ps-foot-links { display:flex; justify-content:center; gap:8px; flex-wrap:wrap; }
.ps-center { min-height:70dvh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; text-align:center; padding:24px; }
.ps-center h1 { font-size:20px; font-weight:600; margin:0; }
.ps-spin { width:34px; height:34px; border-radius:50%; border:3px solid var(--line2); border-top-color:var(--deep); animation:psSpin .9s linear infinite; }
@keyframes psSpin { to { transform:rotate(360deg) } }
@media (max-width: 640px) { .ps-item { grid-template-columns:1fr; gap:2px; } .ps-fact { min-width:80px; } .ps-videos { grid-template-columns:1fr; } .ps-item .k { font-size:13.5px; } .ps-btn.sm { min-height:44px; } .ps-lang { min-height:44px; } }
`
