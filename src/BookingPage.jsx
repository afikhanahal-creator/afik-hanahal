// Booking page (/book, also /booking, /meet) — our own Calendly, in Afik Hanahal's colors.
// Steps: meeting type (skipped when there is one) → day & time → details & how to talk → done.
// Slots come from /api/meta/booking-slots (office hours minus what is busy in the office Google Calendar);
// the booking is /api/meta/booking-create (calendar event + Meet link, CRM lead, office alert, WhatsApp confirmation).
import { useEffect, useMemo, useState } from 'react'

const API = import.meta.env.PROD ? '' : (import.meta.env.VITE_SELLER_API_BASE || '')
const TZ = 'Asia/Jerusalem'
const OFFICE_WA = '972559811814'

const TR = {
  he: {
    langBtn: 'English', pick: 'בחרו סוג פגישה', min: 'דק׳', minutes: n => `${n} דקות`,
    chooseDay: 'בחרו יום ושעה', times: 'שעות פנויות', noTimes: 'אין שעות פנויות ביום הזה', tzNote: 'השעות לפי שעון ישראל',
    loading: 'טוען שעות פנויות…', loadErr: 'לא הצלחנו לטעון את השעות. נסו לרענן את העמוד.',
    nothing: 'כרגע אין שעות פנויות בשבועות הקרובים. כתבו לנו בוואטסאפ ונמצא זמן.',
    next: 'המשך', back: 'חזרה', details: 'הפרטים שלכם', how: 'איך נדבר?',
    name: 'שם מלא', phone: 'טלפון נייד', email: 'אימייל', emailHintVideo: 'נשלח לכאן את ההזמנה והקישור לשיחה',
    emailOpt: 'אימייל (לא חובה)', notes: 'על מה תרצו לדבר? (לא חובה)', notesPh: 'למשל: מחפשים 4 חדרים בכפר סבא, תקציב עד 3 מיליון',
    confirm: 'קבעו את הפגישה', sending: 'קובעים…',
    chMeet: 'Google Meet', chZoom: 'זום', chPhone: 'שיחת טלפון',
    chMeetD: 'שיחת וידאו, הקישור יגיע במייל', chZoomD: 'שיחת וידאו בזום', chPhoneD: 'אנחנו מתקשרים אליכם',
    errName: 'מה השם?', errPhone: 'מספר טלפון לא תקין', errEmail: 'צריך אימייל תקין', errEmailReq: 'לשיחת וידאו צריך אימייל, לשם נשלח את הקישור',
    taken: 'השעה הזו נתפסה הרגע. בחרו שעה אחרת.', tooMany: 'כבר קבעתם שתי פגישות קרובות. כדי לשנות, כתבו לנו בוואטסאפ.',
    rate: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.', fail: 'משהו השתבש. נסו שוב, או כתבו לנו בוואטסאפ.',
    doneTitle: 'הפגישה נקבעה', doneSub: 'שלחנו אישור', doneInvite: 'הזמנה ליומן נשלחה למייל שלכם.',
    doneMeet: 'קישור לשיחה', donePhone: 'נתקשר אליכם בשעה שנקבעה למספר', addCal: 'הוספה ליומן גוגל',
    change: 'צריכים לשנות? כתבו לנו', another: 'קביעת פגישה נוספת', privacy: 'הפרטים משמשים רק לתיאום השיחה איתכם.',
    waText: 'היי, קבעתי פגישה דרך האתר ורוצה לשנות את המועד',
    weekdays: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'], prevM: 'החודש הקודם', nextM: 'החודש הבא',
  },
  en: {
    langBtn: 'עברית', pick: 'Choose a meeting type', min: 'min', minutes: n => `${n} minutes`,
    chooseDay: 'Pick a day and time', times: 'Available times', noTimes: 'No free times on this day', tzNote: 'Times are in Israel time',
    loading: 'Loading available times…', loadErr: 'We couldn\'t load the times. Please refresh the page.',
    nothing: 'There are no free times in the next few weeks. Message us on WhatsApp and we\'ll find one.',
    next: 'Continue', back: 'Back', details: 'Your details', how: 'How shall we talk?',
    name: 'Full name', phone: 'Mobile phone', email: 'Email', emailHintVideo: 'We\'ll send the invitation and the call link here',
    emailOpt: 'Email (optional)', notes: 'What would you like to talk about? (optional)', notesPh: 'e.g. looking for a 4-room home in Kfar Saba, budget up to 3 million',
    confirm: 'Book the meeting', sending: 'Booking…',
    chMeet: 'Google Meet', chZoom: 'Zoom', chPhone: 'Phone call',
    chMeetD: 'Video call, the link comes by email', chZoomD: 'Video call on Zoom', chPhoneD: 'We call you',
    errName: 'What\'s your name?', errPhone: 'Please enter a valid phone number', errEmail: 'Please enter a valid email', errEmailReq: 'A video call needs an email, that\'s where the link goes',
    taken: 'That time was just taken. Please pick another one.', tooMany: 'You already have two upcoming meetings with us. To change one, message us on WhatsApp.',
    rate: 'Too many attempts. Please try again in a few minutes.', fail: 'Something went wrong. Please try again, or message us on WhatsApp.',
    doneTitle: 'You\'re booked', doneSub: 'Confirmation sent', doneInvite: 'A calendar invitation is on its way to your email.',
    doneMeet: 'Call link', donePhone: 'We\'ll call you at the booked time on', addCal: 'Add to Google Calendar',
    change: 'Need to change it? Message us', another: 'Book another meeting', privacy: 'Your details are only used to arrange the call with you.',
    waText: 'Hi, I booked a meeting on your website and would like to change the time',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], prevM: 'Previous month', nextM: 'Next month',
  },
}

const CSS = `
html,body{background:#09090F;margin:0}
@media (prefers-color-scheme: light){html,body{background:#F5F1E9}}
.bk{--bg:#09090F;--card:#0E0E1C;--card2:#14142A;--ink:#E8E4D8;--mute:#A6A3B4;--line:rgba(232,228,216,.10);--brand:#8490D8;--brand-ink:#09090F;--brand-soft:rgba(132,144,216,.14);--err:#F08A8A;--ok:#5FD39A;
  min-height:100vh;background:var(--bg);color:var(--ink);font-family:Rubik,Heebo,system-ui,-apple-system,Arial,sans-serif;font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
@media (prefers-color-scheme: light){.bk{--bg:#F5F1E9;--card:#FFFFFF;--card2:#FAF8F3;--ink:#17172B;--mute:#5E5B6E;--line:rgba(23,23,43,.10);--brand:#3F4EB0;--brand-ink:#FFFFFF;--brand-soft:rgba(63,78,176,.10);--err:#C0392B;--ok:#1E8E5A}}
.bk *{box-sizing:border-box}
.bk-top{max-width:1040px;margin:0 auto;padding:18px 16px 0;display:flex;align-items:center;justify-content:space-between;gap:12px}
.bk-brand{display:flex;align-items:center;gap:10px;color:inherit;text-decoration:none;font-weight:600;font-size:15px}
.bk-brand img{height:30px;width:auto}
.bk-lang{background:none;border:1px solid var(--line);color:var(--ink);border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;cursor:pointer}
.bk-lang:hover{border-color:var(--brand)}
.bk-shell{max-width:1040px;margin:18px auto 40px;padding:0 16px}
.bk-card{background:var(--card);border:1px solid var(--line);border-radius:20px;overflow:hidden;display:grid;grid-template-columns:320px 1fr;min-height:540px;box-shadow:0 20px 60px rgba(0,0,0,.18)}
.bk-side{padding:28px 26px;border-inline-end:1px solid var(--line);display:flex;flex-direction:column;gap:14px}
.bk-org{font-size:13px;color:var(--mute);font-weight:500}
.bk-h1{font-size:24px;font-weight:700;margin:0;letter-spacing:-.01em}
.bk-meta{display:flex;flex-direction:column;gap:8px;color:var(--mute);font-size:14px}
.bk-meta span{display:flex;align-items:center;gap:8px}
.bk-desc{color:var(--mute);font-size:14px;margin:0}
.bk-chosen{margin-top:4px;padding:12px 14px;border-radius:12px;background:var(--brand-soft);color:var(--ink);font-weight:600;font-size:14px}
.bk-main{padding:28px 28px 30px;min-width:0}
.bk-h2{font-size:18px;font-weight:600;margin:0 0 18px}
.bk-types{display:grid;gap:12px}
.bk-type{display:flex;gap:14px;align-items:flex-start;text-align:start;width:100%;background:var(--card2);border:1px solid var(--line);border-radius:14px;padding:16px 18px;color:inherit;font:inherit;cursor:pointer}
.bk-type:hover{border-color:var(--brand)}
.bk-type b{display:block;font-size:16px;margin-bottom:2px}
.bk-type small{color:var(--mute);font-size:13px}
.bk-cal-wrap{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:26px}
.bk-month{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-weight:600}
.bk-nav{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:none;color:var(--ink);cursor:pointer;font-size:16px;line-height:1}
.bk-nav:disabled{opacity:.3;cursor:default}
.bk-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center}
.bk-wd{font-size:12px;color:var(--mute);padding:4px 0}
.bk-day{aspect-ratio:1;max-height:48px;border-radius:50%;border:none;background:none;color:var(--mute);font:inherit;font-size:14px;opacity:.45;cursor:default}
.bk-day.on{opacity:1;color:var(--brand);background:var(--brand-soft);font-weight:600;cursor:pointer}
.bk-day.on:hover{outline:2px solid var(--brand)}
.bk-day.sel{background:var(--brand);color:var(--brand-ink)}
.bk-day.today{text-decoration:underline;text-underline-offset:4px}
.bk-times{display:flex;flex-direction:column;gap:8px;max-height:400px;overflow:auto;padding-inline-end:4px}
.bk-times-h{font-size:14px;font-weight:600;margin:0 0 10px}
.bk-time{border:1px solid var(--brand);color:var(--brand);background:none;border-radius:10px;padding:11px 8px;font:inherit;font-weight:600;cursor:pointer;font-variant-numeric:tabular-nums}
.bk-time:hover,.bk-time.sel{background:var(--brand);color:var(--brand-ink)}
.bk-note{font-size:12px;color:var(--mute);margin-top:12px}
.bk-empty{color:var(--mute);font-size:14px}
.bk-form{display:grid;gap:16px;max-width:520px}
.bk-chs{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.bk-ch{border:1px solid var(--line);background:var(--card2);color:inherit;border-radius:12px;padding:12px;text-align:start;font:inherit;cursor:pointer}
.bk-ch b{display:block;font-size:14px}
.bk-ch small{color:var(--mute);font-size:12px}
.bk-ch.sel{border-color:var(--brand);box-shadow:inset 0 0 0 1px var(--brand);background:var(--brand-soft)}
.bk-f label{display:block;font-size:13px;font-weight:500;margin-bottom:6px}
.bk-f input,.bk-f textarea{width:100%;background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:12px 14px;color:var(--ink);font:inherit;font-size:16px}
.bk-f input:focus,.bk-f textarea:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.bk-f textarea{min-height:84px;resize:vertical}
.bk-f .hint{font-size:12px;color:var(--mute);margin-top:4px}
.bk-f .err{font-size:12px;color:var(--err);margin-top:4px}
.bk-hp{position:absolute;inset-inline-start:-9999px;width:1px;height:1px;overflow:hidden}
.bk-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bk-btn{background:var(--brand);color:var(--brand-ink);border:none;border-radius:999px;padding:13px 28px;font:inherit;font-weight:600;font-size:15px;cursor:pointer}
.bk-btn:disabled{opacity:.6;cursor:default}
.bk-ghost{background:none;border:none;color:var(--mute);font:inherit;cursor:pointer;padding:8px}
.bk-alert{border-radius:12px;padding:12px 14px;background:rgba(240,138,138,.12);color:var(--err);font-size:14px}
.bk-done{text-align:center;max-width:460px;margin:20px auto 0;display:flex;flex-direction:column;gap:12px;align-items:center}
.bk-check{width:64px;height:64px;border-radius:50%;background:var(--brand-soft);color:var(--brand);display:grid;place-items:center;font-size:30px}
.bk-done .when{font-size:18px;font-weight:600}
.bk-done a{color:var(--brand)}
.bk-links{display:flex;flex-direction:column;gap:8px;margin-top:8px;font-size:14px}
.bk-foot{font-size:12px;color:var(--mute);text-align:center;margin-top:16px}
.bk-skel{height:14px;border-radius:7px;background:var(--line);margin:10px 0;animation:bkp 1.2s ease-in-out infinite}
@keyframes bkp{50%{opacity:.4}}
@media (max-width:820px){
  .bk-card{grid-template-columns:1fr;min-height:0}
  .bk-side{border-inline-end:none;border-bottom:1px solid var(--line);padding:22px 20px}
  .bk-main{padding:22px 18px 24px}
  .bk-cal-wrap{grid-template-columns:1fr}
  .bk-times{max-height:none;display:grid;grid-template-columns:repeat(3,1fr)}
  .bk-h1{font-size:21px}
}
`

const Icon = {
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  video: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>,
  phone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>,
  cal: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
}

const fmt = (iso, lang, o) => new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: TZ, ...o })
const timeOf = (iso, lang) => fmt(iso, lang, { hour: '2-digit', minute: '2-digit' })
const longWhen = (iso, lang) => fmt(iso, lang, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const dayLabel = (date, lang) => new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
const israelToday = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
const monthKey = d => d.slice(0, 7)
const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7) }
const normPhone = raw => { const d = String(raw || '').replace(/\D/g, ''); return d.startsWith('972') ? '0' + d.slice(3) : d }
const PHONE_OK = /^0(5\d{8}|[2-489]\d{7}|7\d{8})$/
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
function track(name, params = {}) {
  try { window.dataLayer?.push({ event: name, ...params }) } catch {}
  try { if (name === 'booking_created') window.fbq?.('track', 'Schedule') } catch {}
}
const calLink = (b, title) => {
  const f = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${f(b.start)}/${f(b.end)}`, details: b.meetLink || b.zoomUrl || '', ctz: TZ })}`
}

export default function BookingPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const [lang, setLang] = useState(() => (params.get('lang') === 'en' ? 'en' : 'he'))
  const t = TR[lang]
  const [cfg, setCfg] = useState(null)
  const [type, setType] = useState(null)
  const [slots, setSlots] = useState(null)
  const [loadErr, setLoadErr] = useState(false)
  const [month, setMonth] = useState(monthKey(israelToday()))
  const [day, setDay] = useState('')
  const [start, setStart] = useState('')
  const [step, setStep] = useState('type')
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', channel: '', website: '' })
  const [errs, setErrs] = useState({})
  const [busy, setBusy] = useState(false)
  const [alert, setAlert] = useState('')
  const [done, setDone] = useState(null)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl'
    document.title = lang === 'en' ? 'Book a call · Afik Hanahal' : 'קביעת שיחה · אפיק הנחל'
  }, [lang])

  useEffect(() => {
    fetch(`${API}/api/meta/booking-config`).then(r => r.json()).then(c => {
      setCfg(c)
      const want = c.types?.find(x => x.id === params.get('type')) || (c.types?.length === 1 ? c.types[0] : null)
      if (want) { setType(want); setStep('time') }
    }).catch(() => setLoadErr(true))
  }, [params])

  const loadSlots = (ty = type) => {
    if (!ty || !cfg) return
    setSlots(null)
    const days = Math.min(31, (cfg.horizonDays || 21) + 1)
    fetch(`${API}/api/meta/booking-slots?type=${encodeURIComponent(ty.id)}&from=${israelToday()}&days=${days}`)
      .then(r => r.json()).then(d => {
        setSlots(d.slots || {})
        const first = Object.keys(d.slots || {}).sort().find(k => d.slots[k].length)
        const pick = day && d.slots?.[day]?.length ? day : first
        if (pick) { setDay(pick); setMonth(monthKey(pick)) }
      })
      .catch(() => setLoadErr(true))
  }
  useEffect(() => { loadSlots() }, [type, cfg]) // eslint-disable-line react-hooks/exhaustive-deps

  const channels = type?.channels || []
  useEffect(() => { if (channels.length && !channels.includes(form.channel)) setForm(f => ({ ...f, channel: channels[0] })) }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = israelToday()
  const available = slots ? Object.keys(slots).filter(k => slots[k].length).sort() : []
  const lastMonth = available.length ? monthKey(available[available.length - 1]) : month
  const grid = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const first = new Date(Date.UTC(y, m - 1, 1))
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const cells = Array(first.getUTCDay()).fill(null)
    for (let d = 1; d <= n; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
    return cells
  }, [month])
  const monthName = new Date(`${month}-01T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: 'UTC', month: 'long', year: 'numeric' })

  const typeName = type ? (lang === 'en' ? type.en : type.he) : ''
  const typeDesc = type ? (lang === 'en' ? type.en_desc : type.he_desc) : ''
  const orgName = cfg ? (lang === 'en' ? cfg.title?.en : cfg.title?.he) : (lang === 'en' ? 'Afik Hanahal' : 'אפיק הנחל')
  const chLabel = c => ({ meet: t.chMeet, zoom: t.chZoom, phone: t.chPhone }[c])
  const chDesc = c => ({ meet: t.chMeetD, zoom: t.chZoomD, phone: t.chPhoneD }[c])
  const video = form.channel === 'meet' || form.channel === 'zoom'

  function validate() {
    const e = {}
    if (form.name.trim().length < 2) e.name = t.errName
    if (!PHONE_OK.test(normPhone(form.phone))) e.phone = t.errPhone
    if (form.email.trim() && !EMAIL_OK.test(form.email.trim())) e.email = t.errEmail
    if (video && !form.email.trim()) e.email = t.errEmailReq
    setErrs(e)
    return !Object.keys(e).length
  }

  async function submit(ev) {
    ev.preventDefault()
    setAlert('')
    if (!validate()) return
    setBusy(true)
    try {
      const ref = params.get('utm_campaign') || params.get('ref') || params.get('utm_source') || ''
      const r = await fetch(`${API}/api/meta/booking-create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, type: type.id, start, lang, ref }) })
      const d = await r.json().catch(() => ({}))
      if (d.ok) {
        setDone(d.booking)
        setStep('done')
        track('booking_created', { booking_type: type.id, channel: form.channel })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (d.error === 'taken') { setAlert(t.taken); setStart(''); setStep('time'); loadSlots() }
      else if (d.error === 'too_many') setAlert(t.tooMany)
      else if (d.error === 'rate') setAlert(t.rate)
      else if (d.error === 'invalid' && d.errors) {
        const m = { name: t.errName, phone: t.errPhone, email: d.errors.email === 'required' ? t.errEmailReq : t.errEmail }
        setErrs(Object.fromEntries(Object.keys(d.errors).filter(k => m[k]).map(k => [k, m[k]])))
        if (d.errors.start || d.errors.channel) setAlert(t.fail)
      } else setAlert(t.fail)
    } catch { setAlert(t.fail) }
    setBusy(false)
  }

  // on a phone the next step is below the side panel: bring it into view
  useEffect(() => {
    if (!['details', 'done'].includes(step) || window.innerWidth > 820) return
    document.querySelector('.bk-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const waHref = `https://wa.me/${OFFICE_WA}?text=${encodeURIComponent(t.waText)}`

  return (
    <div className="bk" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <style>{CSS}</style>
      <header className="bk-top">
        <a className="bk-brand" href="/" aria-label={orgName}>
          <picture>
            <source srcSet="/logo-black.svg" media="(prefers-color-scheme: light)" />
            <img src="/logo.svg" alt="" />
          </picture>
          <span>{orgName}</span>
        </a>
        <button className="bk-lang" onClick={() => setLang(l => (l === 'en' ? 'he' : 'en'))}>{t.langBtn}</button>
      </header>

      <main className="bk-shell">
        <div className="bk-card">
          <aside className="bk-side">
            <div className="bk-org">{orgName}</div>
            <h1 className="bk-h1">{typeName || t.pick}</h1>
            {type && (
              <div className="bk-meta">
                <span>{Icon.clock}{t.minutes(type.minutes)}</span>
                {type.channels.map(c => <span key={c}>{c === 'phone' ? Icon.phone : Icon.video}{chLabel(c)}</span>)}
              </div>
            )}
            {typeDesc && <p className="bk-desc">{typeDesc}</p>}
            {start && step !== 'time' && <div className="bk-chosen">{Icon.cal} {longWhen(start, lang)}</div>}
          </aside>

          <section className="bk-main">
            {loadErr && <div className="bk-alert">{t.loadErr}</div>}

            {!loadErr && !cfg && <div aria-busy="true">{[70, 90, 55, 80].map((w, i) => <div key={i} className="bk-skel" style={{ width: `${w}%` }} />)}</div>}

            {cfg && step === 'type' && (
              <>
                <h2 className="bk-h2">{t.pick}</h2>
                <div className="bk-types">
                  {cfg.types.map(x => (
                    <button key={x.id} className="bk-type" onClick={() => { setType(x); setStep('time') }}>
                      <span style={{ color: 'var(--brand)', marginTop: 3 }}>{Icon.cal}</span>
                      <span><b>{lang === 'en' ? x.en : x.he}</b><small>{t.minutes(x.minutes)} · {x.channels.map(chLabel).join(' · ')}</small></span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {cfg && step === 'time' && (
              <>
                <h2 className="bk-h2">{t.chooseDay}</h2>
                {alert && <div className="bk-alert" style={{ marginBottom: 14 }}>{alert}</div>}
                {!slots && !loadErr && <div className="bk-empty">{t.loading}</div>}
                {slots && !available.length && <div className="bk-empty">{t.nothing} <a href={waHref} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>WhatsApp</a></div>}
                {slots && available.length > 0 && (
                  <div className="bk-cal-wrap">
                    <div>
                      <div className="bk-month">
                        <button className="bk-nav" aria-label={t.prevM} disabled={month <= monthKey(today)} onClick={() => setMonth(m => addMonths(m, -1))}>{lang === 'en' ? '‹' : '›'}</button>
                        <span>{monthName}</span>
                        <button className="bk-nav" aria-label={t.nextM} disabled={month >= lastMonth} onClick={() => setMonth(m => addMonths(m, 1))}>{lang === 'en' ? '›' : '‹'}</button>
                      </div>
                      <div className="bk-grid">
                        {t.weekdays.map(w => <div key={w} className="bk-wd">{w}</div>)}
                        {grid.map((d, i) => {
                          if (!d) return <div key={`e${i}`} />
                          const on = !!slots[d]?.length
                          return (
                            <button key={d} className={`bk-day${on ? ' on' : ''}${d === day ? ' sel' : ''}${d === today ? ' today' : ''}`} disabled={!on}
                              aria-label={dayLabel(d, lang)} aria-pressed={d === day} onClick={() => { setDay(d); setStart('') }}>
                              {Number(d.slice(8))}
                            </button>
                          )
                        })}
                      </div>
                      <div className="bk-note">🌍 {t.tzNote}</div>
                    </div>
                    <div>
                      <h3 className="bk-times-h">{day ? dayLabel(day, lang) : t.times}</h3>
                      <div className="bk-times">
                        {(slots[day] || []).map(s => (
                          <button key={s} className={`bk-time${s === start ? ' sel' : ''}`} onClick={() => { setStart(s); setAlert(''); setStep('details') }}>{timeOf(s, lang)}</button>
                        ))}
                        {day && !(slots[day] || []).length && <div className="bk-empty">{t.noTimes}</div>}
                      </div>
                    </div>
                  </div>
                )}
                {cfg.types.length > 1 && <div style={{ marginTop: 18 }}><button className="bk-ghost" onClick={() => { setStep('type'); setStart('') }}>{lang === 'en' ? '←' : '→'} {t.back}</button></div>}
              </>
            )}

            {cfg && step === 'details' && (
              <form className="bk-form" onSubmit={submit} noValidate>
                {channels.length > 1 ? <>
                  <h2 className="bk-h2" style={{ margin: 0 }}>{t.how}</h2>
                  <div className="bk-chs" role="radiogroup">
                    {channels.map(c => (
                      <button type="button" key={c} role="radio" aria-checked={form.channel === c} className={`bk-ch${form.channel === c ? ' sel' : ''}`} onClick={() => setForm(f => ({ ...f, channel: c }))}>
                        <b>{chLabel(c)}</b><small>{chDesc(c)}</small>
                      </button>
                    ))}
                  </div>
                </> : channels[0] && <div className="bk-chosen" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{channels[0] === 'phone' ? Icon.phone : Icon.video}<span><b>{chLabel(channels[0])}</b> · {chDesc(channels[0])}</span></div>}
                <h2 className="bk-h2" style={{ margin: '6px 0 0' }}>{t.details}</h2>
                <div className="bk-f">
                  <label htmlFor="bk-name">{t.name}</label>
                  <input id="bk-name" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errs.name} />
                  {errs.name && <div className="err">{errs.name}</div>}
                </div>
                <div className="bk-f">
                  <label htmlFor="bk-phone">{t.phone}</label>
                  <input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" style={{ textAlign: lang === 'en' ? 'left' : 'right' }} value={form.phone} onChange={set('phone')} aria-invalid={!!errs.phone} />
                  {errs.phone && <div className="err">{errs.phone}</div>}
                </div>
                <div className="bk-f">
                  <label htmlFor="bk-email">{video ? t.email : t.emailOpt}</label>
                  <input id="bk-email" type="email" inputMode="email" autoComplete="email" dir="ltr" style={{ textAlign: lang === 'en' ? 'left' : 'right' }} value={form.email} onChange={set('email')} aria-invalid={!!errs.email} />
                  {errs.email ? <div className="err">{errs.email}</div> : video && <div className="hint">{t.emailHintVideo}</div>}
                </div>
                <div className="bk-f">
                  <label htmlFor="bk-notes">{t.notes}</label>
                  <textarea id="bk-notes" placeholder={t.notesPh} value={form.notes} onChange={set('notes')} maxLength={1000} />
                </div>
                <div className="bk-hp" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></div>
                {alert && <div className="bk-alert">{alert}</div>}
                <div className="bk-actions">
                  <button className="bk-btn" disabled={busy}>{busy ? t.sending : t.confirm}</button>
                  <button type="button" className="bk-ghost" onClick={() => setStep('time')}>{t.back}</button>
                </div>
                <div className="bk-note" style={{ marginTop: 0 }}>{t.privacy}</div>
              </form>
            )}

            {step === 'done' && done && (
              <div className="bk-done">
                <div className="bk-check">✓</div>
                <h2 className="bk-h2" style={{ margin: 0 }}>{t.doneTitle}</h2>
                <div className="when">{longWhen(done.start, lang)}</div>
                <div style={{ color: 'var(--mute)' }}>{typeName} · {chLabel(done.channel)}</div>
                {done.invite && <div>{t.doneInvite}</div>}
                {done.meetLink && <div>{t.doneMeet}: <a href={done.meetLink} target="_blank" rel="noreferrer" dir="ltr">{done.meetLink.replace(/^https:\/\//, '')}</a></div>}
                {done.zoomUrl && <div>{t.doneMeet}: <a href={done.zoomUrl} target="_blank" rel="noreferrer" dir="ltr">Zoom</a></div>}
                {done.channel === 'phone' && <div>{t.donePhone} <bdi dir="ltr">{normPhone(form.phone)}</bdi></div>}
                <div className="bk-links">
                  {!done.invite && <a href={calLink(done, `${typeName} · ${lang === 'en' ? 'Afik Hanahal' : 'אפיק הנחל'}`)} target="_blank" rel="noreferrer">{t.addCal}</a>}
                  <a href={waHref} target="_blank" rel="noreferrer">{t.change}</a>
                  <button className="bk-ghost" onClick={() => { setDone(null); setStart(''); setStep(cfg.types.length > 1 ? 'type' : 'time'); loadSlots() }}>{t.another}</button>
                </div>
              </div>
            )}
          </section>
        </div>
        <div className="bk-foot">{orgName} · <a href="/" style={{ color: 'inherit' }}>afikhanahal.co.il</a></div>
      </main>
    </div>
  )
}
