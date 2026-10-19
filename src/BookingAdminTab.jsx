// Admin → "תיאום פגישות": the booking page (/book) — the meetings booked through it (the client's private link, a resend of
// a confirmation Green API refused, move / cancel), its link, the Google Calendar connection, office hours and rules.
// Apple-like grouped lists: switches for the days, time pills, steppers, a segmented duration, a save bar when dirty.
// API: /api/meta/booking-* (lib/booking-server.js).
import { useEffect, useMemo, useState } from 'react'
import { T } from './automationsUI.jsx'
import { autoApi } from './AutomationsApi.jsx'

const SITE = 'https://www.afikhanahal.co.il'
const TZ = 'Asia/Jerusalem'
const HALF_HOURS = Array.from({ length: 33 }, (_, i) => 6 + i * 0.5)   // 06:00 … 22:00
const hh = h => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`
const DURATIONS = [15, 20, 30, 45, 60, 90]
const CH_KEYS = ['phone', 'meet', 'zoom']

const TR = {
  he: {
    title: 'תיאום פגישות', sub: 'עמוד קביעת שיחות ביומן המשרד, במקום קלנדלי',
    link: 'הקישור לקביעת שיחה', linkSub: 'לשליחה בוואטסאפ, במייל או במודעה. בתבניות: {bookingLink}', copy: 'העתקה', copied: 'הועתק', open: 'פתיחה', linkEn: 'English',
    kUpcoming: 'שיחות קרובות', kWeek: 'השבוע', kWa: 'אישור לא נשלח', kCal: 'יומן Google',
    cal: 'יומן Google', calOn: 'מחובר', calOff: 'לא מחובר', calErr: 'צריך לחבר מחדש',
    calOnSub: 'שיחות נכנסות ליומן, הלקוח מקבל הזמנה, ושעות תפוסות ביומן לא מוצעות.',
    calOffSub: 'בלי יומן מחובר העמוד עובד לפי שעות הפעילות בלבד. המשרד מקבל התראה ומכניס ליומן ידנית.',
    connect: 'חיבור יומן', reconnect: 'חיבור מחדש', disconnect: 'ניתוק', connecting: 'מעביר לגוגל…',
    envMissing: 'כדי לחבר יומן צריך להגדיר ב-Vercel את GOOGLE_OAUTH_CLIENT_ID ו-GOOGLE_OAUTH_CLIENT_SECRET.',
    redirect: 'Redirect URI בגוגל', since: 'מחובר מאז',
    hours: 'שעות פעילות', hoursSub: 'הלקוחות רואים רק שעות בתוך החלון הזה, לפי שעון ישראל', closed: 'סגור', from: 'מ-', to: 'עד',
    typeH: 'סוג השיחה', nameHe: 'שם (עברית)', nameEn: 'שם (אנגלית)', duration: 'משך', min: 'דק׳', channels: 'אופן השיחה',
    chPhone: 'טלפון', chMeet: 'Google Meet', chZoom: 'זום', zoomNeeds: 'זום מוצע רק כשיש קישור זום',
    rules: 'כללים', notice: 'הכי מוקדם', noticeU: 'שעות מראש', horizon: 'אפשר לקבוע עד', horizonU: 'ימים קדימה',
    buffer: 'מרווח סביב פגישות ביומן', perDay: 'מקסימום שיחות ביום', step: 'שיחה מתחילה כל',
    zoom: 'קישור זום אישי', zoomSub: 'לא חובה. כשמוגדר, אפשר להציע גם זום',
    photo: 'תמונה בעמוד', photoSub: 'מופיעה בתחתית הצד של העמוד במחשב, בפרופורציות שלה (בטלפון לא מוצגת). הכי טוב דמות בלי רקע (PNG / WebP שקוף). קישור לתמונה, למשל /img/booking-portrait.webp או https://…. ריק = בלי תמונה', photoReset: 'תמונת ברירת המחדל',
    dirty: 'יש שינויים שלא נשמרו', save: 'שמירה', saving: 'שומר…', saved: 'נשמר', discard: 'ביטול השינויים',
    upcoming: 'שיחות קרובות', recent: 'שיחות שעברו (30 יום)', none: 'עוד לא נקבעו שיחות דרך העמוד',
    today: 'היום', tomorrow: 'מחר',
    inCal: 'ביומן', notInCal: 'לא ביומן', waOk: 'אישור וואטסאפ נשלח', waNo: 'אישור וואטסאפ לא נשלח', waQuota: 'וואטסאפ חסום (מכסת Green API)', mailOk: 'אישור במייל נשלח', moved: n => `הוזז ${n === 1 ? 'פעם אחת' : `${n} פעמים`}`,
    cancelledBy: { client: 'בוטלה על ידי הלקוח', office: 'בוטלה על ידי המשרד' }, cancelled: 'בוטלה',
    clientLink: 'העתקת הקישור של הלקוח', linkCopied: 'הקישור הועתק', move: 'שינוי מועד', resend: 'שליחת האישור שוב', resending: 'שולח…', resent: 'נשלח', cancel: 'ביטול',
    cancelQ: 'לבטל את השיחה? אם יש הזמנה ביומן, הלקוח יקבל הודעת ביטול.', loading: 'טוען…', err: 'שגיאה',
    days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'], dec: 'הפחתה', inc: 'הוספה',
    testMail: 'מייל לדוגמה', testMailTip: 'שולח למייל המשרד את שני המיילים: מה שהלקוח מקבל ומה שהמשרד מקבל', testSending: 'שולח…', testSent: to => `נשלח ל-${to}`,
  },
  en: {
    title: 'Bookings', sub: 'A page for booking calls in the office calendar, instead of Calendly',
    link: 'Booking link', linkSub: 'Send it on WhatsApp, by email or in an ad. In templates: {bookingLink}', copy: 'Copy', copied: 'Copied', open: 'Open', linkEn: 'English',
    kUpcoming: 'Upcoming calls', kWeek: 'This week', kWa: 'Confirmation not sent', kCal: 'Google Calendar',
    cal: 'Google Calendar', calOn: 'Connected', calOff: 'Not connected', calErr: 'Needs reconnecting',
    calOnSub: 'Calls go into the calendar, the client gets an invitation, and busy times are not offered.',
    calOffSub: 'Without a calendar the page works from office hours only. The office is alerted and adds the call by hand.',
    connect: 'Connect calendar', reconnect: 'Reconnect', disconnect: 'Disconnect', connecting: 'Opening Google…',
    envMissing: 'To connect a calendar, set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in Vercel.',
    redirect: 'Redirect URI in Google', since: 'Connected since',
    hours: 'Office hours', hoursSub: 'Clients only see times inside this window, in Israel time', closed: 'Closed', from: 'from', to: 'to',
    typeH: 'Call type', nameHe: 'Name (Hebrew)', nameEn: 'Name (English)', duration: 'Length', min: 'min', channels: 'How we talk',
    chPhone: 'Phone', chMeet: 'Google Meet', chZoom: 'Zoom', zoomNeeds: 'Zoom is offered only with a Zoom link',
    rules: 'Rules', notice: 'Earliest', noticeU: 'hours ahead', horizon: 'Bookable up to', horizonU: 'days ahead',
    buffer: 'Gap around calendar events', perDay: 'Max calls a day', step: 'A call starts every',
    zoom: 'Personal Zoom link', zoomSub: 'Optional. When set, Zoom can be offered too',
    photo: 'Page photo', photoSub: 'Shown at the bottom of the page side panel on computers, in its own proportions (not shown on phones). Best: a cut-out figure with no background (transparent PNG / WebP). A link to the image, e.g. /img/booking-portrait.webp or https://…. Empty = no photo', photoReset: 'Default photo',
    dirty: 'You have unsaved changes', save: 'Save', saving: 'Saving…', saved: 'Saved', discard: 'Discard',
    upcoming: 'Upcoming calls', recent: 'Past calls (30 days)', none: 'No calls booked through the page yet',
    today: 'Today', tomorrow: 'Tomorrow',
    inCal: 'In calendar', notInCal: 'Not in calendar', waOk: 'WhatsApp confirmation sent', waNo: 'WhatsApp confirmation not sent', waQuota: 'WhatsApp blocked (Green API quota)', mailOk: 'Email confirmation sent', moved: n => `Moved ${n === 1 ? 'once' : `${n} times`}`,
    cancelledBy: { client: 'Cancelled by the client', office: 'Cancelled by the office' }, cancelled: 'Cancelled',
    clientLink: 'Copy the client link', linkCopied: 'Link copied', move: 'Reschedule', resend: 'Resend confirmation', resending: 'Sending…', resent: 'Sent', cancel: 'Cancel',
    cancelQ: 'Cancel this call? If there is a calendar invitation, the client gets a cancellation.', loading: 'Loading…', err: 'Error',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], dec: 'Decrease', inc: 'Increase',
    testMail: 'Sample email', testMailTip: 'Sends both emails to the office address: what the client gets and what the office gets', testSending: 'Sending…', testSent: to => `Sent to ${to}`,
  },
}

const CSS = `
.bka{--r:14px;display:grid;gap:18px;padding:4px 0 90px;color:var(--au-text);font-size:13px;line-height:1.5}
.bka *{box-sizing:border-box}
.bka button,.bka select{min-height:0;min-width:0}
.bka>*{min-width:0}
.bka h2{margin:0;font-size:22px;font-weight:600;letter-spacing:-.01em}
.bka .sub{margin:2px 0 0;color:var(--au-text2);font-size:13px}
.bka-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.bka-link{display:flex;align-items:center;gap:6px;background:var(--au-card);border:1px solid var(--au-s1-line);border-radius:999px;padding:5px 5px 5px 14px;min-width:0}
[dir=rtl] .bka-link{padding:5px 14px 5px 5px}
.bka-link code{font-family:inherit;font-size:13px;color:var(--au-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bka-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.bka-kpi{background:var(--au-card);border:1px solid var(--au-s1-line);border-radius:var(--r);padding:12px 14px}
.bka-kpi span{display:block;font-size:12px;color:var(--au-text2)}
.bka-kpi b{display:block;font-size:22px;font-weight:600;margin-top:2px;font-variant-numeric:tabular-nums}
.bka-kpi b.sm{font-size:15px;margin-top:6px;display:flex;align-items:center;gap:7px}
.bka-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:18px;align-items:start}
.bka-col{display:grid;gap:18px}
.bka-sec h3{margin:0 0 2px;font-size:15px;font-weight:600}
.bka-sec .hint{margin:0 0 10px;color:var(--au-text2);font-size:12.5px}
.bka-list{background:var(--au-card);border:1px solid var(--au-s1-line);border-radius:var(--r);overflow:hidden}
.bka-row{display:flex;align-items:center;gap:12px;min-height:50px;padding:9px 16px}
.bka-row+.bka-row{border-top:1px solid var(--au-divider)}
.bka-row .lbl{flex:1;min-width:0}
.bka-row .lbl small{display:block;color:var(--au-text2);font-size:12px}
.bka-row.off .lbl{color:var(--au-text2)}
.bka-switch{position:relative;width:44px;height:26px;border-radius:999px;border:none;background:rgba(var(--ink),.18);cursor:pointer;flex-shrink:0;transition:background .2s;padding:0}
.bka-switch::after{content:'';position:absolute;top:3px;inset-inline-start:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}
.bka-switch[aria-checked=true]{background:#34C759}
.bka-switch[aria-checked=true]::after{transform:translateX(18px)}
[dir=rtl] .bka-switch[aria-checked=true]::after{transform:translateX(-18px)}
.bka-time{appearance:none;-webkit-appearance:none;background:rgba(var(--ov),.06);border:1px solid transparent;border-radius:9px;padding:6px 12px;font:inherit;font-size:14px;font-weight:500;color:var(--au-text);cursor:pointer;font-variant-numeric:tabular-nums;text-align:center}
.bka-time:hover{background:rgba(var(--brand-rgb),.1)}
.bka-time option{background:var(--au-pop);color:var(--au-text)}
.bka-dash{color:var(--au-text3)}
.bka-step{display:inline-flex;align-items:center;background:rgba(var(--ov),.06);border-radius:9px;overflow:hidden;flex-shrink:0}
.bka-step button{width:34px;height:32px;border:none;background:none;color:var(--au-text);font-size:17px;cursor:pointer;line-height:1}
.bka-step button:hover:not(:disabled){background:rgba(var(--brand-rgb),.12)}
.bka-step button:disabled{opacity:.3;cursor:default}
.bka-step output{min-width:58px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums;font-size:13.5px}
.bka-seg{display:inline-flex;background:rgba(var(--ov),.07);border-radius:9px;padding:2px;gap:2px;flex-wrap:wrap}
.bka-seg button{border:none;background:none;border-radius:7px;padding:5px 11px;font:inherit;font-size:12.5px;font-weight:500;color:var(--au-text);cursor:pointer;font-variant-numeric:tabular-nums}
.bka-seg button[aria-pressed=true],.bka-seg button[aria-checked=true]{background:var(--au-card);box-shadow:0 1px 3px rgba(0,0,0,.14);font-weight:600}
.bka-seg button:disabled{opacity:.4;cursor:default}
.bka-in{width:100%;background:none;border:none;font:inherit;font-size:14px;color:var(--au-text);padding:4px 0;outline:none}
.bka-in::placeholder{color:var(--au-text3)}
.bka-btn{min-height:0;line-height:1.25;display:inline-flex;align-items:center;gap:6px;border:none;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;text-decoration:none}
.bka-btn.pri{background:var(--au-brand);color:#fff}
.bka-btn.sec{background:rgba(var(--brand-rgb),.1);color:var(--au-brand-text)}
.bka-btn.plain{background:none;color:var(--au-brand-text);padding:6px 8px}
.bka-btn.danger{background:none;color:var(--au-red-text);padding:6px 8px}
.bka-btn:disabled{opacity:.55;cursor:default}
.bka-btn:hover:not(:disabled){filter:brightness(1.06)}
.bka-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.bka-mtg{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:start;padding:14px 16px}
.bka-mtg+.bka-mtg{border-top:1px solid var(--au-divider)}
.bka-mtg.gone{opacity:.55}
.bka-tile{width:52px;border-radius:11px;overflow:hidden;text-align:center;border:1px solid var(--au-s2-line);background:var(--au-s2)}
.bka-tile i{display:block;font-style:normal;background:var(--au-brand);color:#fff;font-size:10.5px;font-weight:600;padding:2px 0}
.bka-tile b{display:block;font-size:19px;font-weight:600;padding:3px 0 2px;font-variant-numeric:tabular-nums}
.bka-mtg .who{font-size:14px;font-weight:600}
.bka-mtg .meta{color:var(--au-text2);font-size:12.5px;margin-top:1px}
.bka-mtg .note{margin-top:6px;font-size:12.5px;color:var(--au-text);background:rgba(var(--ov),.05);border-radius:9px;padding:7px 10px;white-space:pre-wrap}
.bka-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.bka-chip{font-size:11.5px;font-weight:500;border-radius:999px;padding:2px 9px;background:rgba(var(--ov),.07);color:var(--au-text2)}
.bka-chip.ok{background:rgba(52,199,89,.13);color:var(--au-text)}
.bka-chip.warn{background:rgba(245,166,35,.15);color:var(--au-amber-text)}
.bka-chip.bad{background:rgba(224,82,82,.12);color:var(--au-red-text)}
.bka-acts{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:4px;max-width:360px}
.bka-bar{position:sticky;bottom:12px;z-index:20;display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--au-pop);border:1px solid var(--au-s1-line);border-radius:999px;padding:8px 8px 8px 18px;box-shadow:var(--au-shadow3);max-width:560px;margin:0 auto;width:100%}
[dir=rtl] .bka-bar{padding:8px 18px 8px 8px}
.bka-err{background:rgba(224,82,82,.1);color:var(--au-red-text);border-radius:12px;padding:10px 14px}
.bka summary{cursor:pointer;color:var(--au-text2);padding:12px 16px;list-style:none}
.bka summary::-webkit-details-marker{display:none}
@media (max-width:1000px){.bka-grid{grid-template-columns:1fr}}
@media (max-width:640px){
  .bka-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .bka-mtg{grid-template-columns:auto minmax(0,1fr)}
  .bka-acts{grid-column:1/-1;justify-content:flex-start;max-width:none}
  .bka-head .bka-link{width:100%;flex-wrap:wrap;border-radius:16px;padding:10px!important}
  .bka-head .bka-link code{flex:1 1 100%;padding:0 4px 4px}
}
`

function Switch({ on, onChange, label }) {
  return <button type="button" role="switch" aria-checked={!!on} aria-label={label} className="bka-switch" onClick={() => onChange(!on)} />
}
function Stepper({ value, onChange, min = 0, max = 999, step = 1, unit = '', label, t }) {
  const clamp = v => Math.max(min, Math.min(max, v))
  return (
    <span className="bka-step" role="group" aria-label={label}>
      <button type="button" aria-label={`${t.dec}: ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>−</button>
      <output aria-live="polite">{value}{unit ? ` ${unit}` : ''}</output>
      <button type="button" aria-label={`${t.inc}: ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>+</button>
    </span>
  )
}
function useCopy() {
  const [k, setK] = useState('')
  return [k, (text, key) => navigator.clipboard?.writeText(text).then(() => { setK(key); setTimeout(() => setK(''), 1600) })]
}

export default function BookingAdminTab({ lang = 'he' }) {
  const t = TR[lang] || TR.he
  const [state, setState] = useState(null)
  const [err, setErr] = useState('')
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [resending, setResending] = useState({})
  const [testMail, setTestMail] = useState('')
  const [copied, copy] = useCopy()

  const load = () => autoApi.get('booking-admin').then(d => { setState(d); setDraft(d.config); setErr('') }).catch(e => setErr(e.message))
  useEffect(() => { load() }, [])

  const dirty = useMemo(() => {
    if (!state || !draft) return false
    const pick = c => JSON.stringify([c.hours, c.zoomUrl || '', c.photo ?? '', c.minNoticeMin, c.horizonDays, c.bufferMin, c.maxPerDay, c.stepMin, c.types])
    return pick(state.config) !== pick(draft)
  }, [state, draft])

  if (err && !state) return <div className="bka-err" style={{ margin: 16 }}>{t.err}: {err}</div>
  if (!state || !draft) return <div style={{ padding: 24, color: T.text2 }}>{t.loading}</div>

  const cal = state.calendar || {}
  const calStatus = cal.connected ? (cal.error ? 'err' : 'on') : 'off'
  const dot = { on: '#34C759', off: T.grey, err: T.amber }[calStatus]
  const now = Date.now()
  const live = state.bookings.filter(b => b.status !== 'cancelled')
  const upcoming = state.bookings.filter(b => Date.parse(b.end) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const past = state.bookings.filter(b => Date.parse(b.end) <= now)
  const weekEnd = now + 7 * 864e5
  const kUpcoming = live.filter(b => Date.parse(b.end) > now).length
  const kWeek = live.filter(b => Date.parse(b.start) > now && Date.parse(b.start) < weekEnd).length
  const kWa = live.filter(b => Date.parse(b.end) > now && b.wa && !b.wa.ok).length
  const loc = lang === 'en' ? 'en-GB' : 'he-IL'
  const fmt = (iso, o) => new Date(iso).toLocaleString(loc, { timeZone: TZ, ...o })
  const time = iso => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  const dayOf = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
  const rel = iso => { const n = Math.round((Date.parse(dayOf(iso)) - Date.parse(dayOf(new Date().toISOString()))) / 864e5); return n === 0 ? t.today : n === 1 ? t.tomorrow : fmt(iso, { weekday: 'long' }) }
  const chName = c => ({ meet: t.chMeet, zoom: t.chZoom, phone: t.chPhone }[c] || c)
  const prettyPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : p }

  async function connect() {
    setConnecting(true)
    try { const d = await autoApi.post('booking-connect'); window.location.href = d.url } catch (e) { setErr(e.message); setConnecting(false) }
  }
  async function disconnect() {
    if (!window.confirm(`${t.disconnect}?`)) return
    await autoApi.post('booking-disconnect').catch(e => setErr(e.message))
    load()
  }
  async function save() {
    setSaving('saving')
    try {
      const d = await autoApi.post('booking-settings', { config: { hours: draft.hours, zoomUrl: draft.zoomUrl, photo: draft.photo ?? '', minNoticeMin: draft.minNoticeMin, horizonDays: draft.horizonDays, bufferMin: draft.bufferMin, maxPerDay: draft.maxPerDay, stepMin: draft.stepMin, types: draft.types } })
      setDraft(d.config); setState(s => ({ ...s, config: d.config })); setSaving('saved'); setErr('')
      setTimeout(() => setSaving(''), 1800)
    } catch (e) { setErr(e.message); setSaving('') }
  }
  async function cancel(id) {
    if (!window.confirm(t.cancelQ)) return
    await autoApi.post('booking-cancel', { id }).catch(e => setErr(e.message))
    load()
  }
  async function resend(id) {
    setResending(r => ({ ...r, [id]: 'busy' }))
    try {
      const d = await autoApi.post('booking-resend', { id })
      if (!d.ok) setErr(d.error || t.waNo)
      setResending(r => ({ ...r, [id]: d.ok ? 'done' : '' }))
      load()
    } catch (e) { setErr(e.message); setResending(r => ({ ...r, [id]: '' })) }
  }
  async function sendTestMail() {
    setTestMail('busy')
    try { const d = await autoApi.post('booking-test-email'); if (!d.ok) throw new Error(d.error); setTestMail(t.testSent(d.to)) } catch (e) { setErr(e.message); setTestMail('') }
  }
  const setHour = (d, i, v) => setDraft(c => { const h = { ...c.hours }; const n = [...(h[d] || [9, 18])]; n[i] = +v; if (n[1] <= n[0]) n[1] = Math.min(22, n[0] + 0.5); h[d] = n; return { ...c, hours: h } })
  const toggleDay = (d, on) => setDraft(c => ({ ...c, hours: { ...c.hours, [d]: on ? (c.hours[d] || [9, 18]) : null } }))
  const val = (k, v) => setDraft(c => ({ ...c, [k]: v }))
  const type0 = draft.types?.[0]
  const setType = patch => setDraft(c => ({ ...c, types: [{ ...c.types[0], ...patch }, ...c.types.slice(1)] }))
  const toggleCh = ch => { const cur = type0.channels || []; const next = cur.includes(ch) ? cur.filter(x => x !== ch) : [...cur, ch]; if (next.length) setType({ channels: CH_KEYS.filter(k => next.includes(k)) }) }

  const meeting = b => {
    const gone = b.status === 'cancelled'
    const upcomingLive = !gone && Date.parse(b.end) > now
    const moved = (b.history || []).filter(h => h.kind === 'moved').length
    return (
      <div key={b.id} className={`bka-mtg${gone ? ' gone' : ''}`}>
        <div className="bka-tile" aria-hidden="true"><i>{fmt(b.start, { month: 'short' })}</i><b>{fmt(b.start, { day: 'numeric' })}</b></div>
        <div style={{ minWidth: 0 }}>
          <div className="who"><bdi>{b.name}</bdi></div>
          <div className="meta">
            {rel(b.start)} · <span dir="ltr">{time(b.start)}–{time(b.end)}</span> · {b.typeName || b.type} · {chName(b.channel)}
            {' · '}<a href={`tel:${b.phone}`} style={{ color: T.brandText, whiteSpace: 'nowrap' }} dir="ltr">{prettyPhone(b.phone)}</a>
            {b.meetLink && <> · <a href={b.meetLink} target="_blank" rel="noreferrer" style={{ color: T.brandText }}>Meet</a></>}
          </div>
          {b.notes && <div className="note">{b.notes}</div>}
          <div className="bka-chips">
            {gone ? <span className="bka-chip bad">{t.cancelledBy[b.cancelledBy] || t.cancelled}</span> : <>
              <span className={`bka-chip ${b.eventId ? 'ok' : 'warn'}`}>{b.eventId ? t.inCal : t.notInCal}</span>
              {b.wa && <span className={`bka-chip ${b.wa.ok ? 'ok' : 'bad'}`} title={b.wa.ok ? '' : b.wa.error || ''}>{b.wa.ok ? t.waOk : b.wa.quota ? t.waQuota : t.waNo}</span>}
              {b.mail?.ok && <span className="bka-chip ok">{t.mailOk}</span>}
              {moved > 0 && <span className="bka-chip">{t.moved(moved)}</span>}
            </>}
          </div>
        </div>
        <div className="bka-acts">
          {upcomingLive && b.manageUrl && <button className="bka-btn plain" onClick={() => copy(b.manageUrl, b.id)}>{copied === b.id ? t.linkCopied : t.clientLink}</button>}
          {upcomingLive && b.manageUrl && <a className="bka-btn plain" href={b.manageUrl} target="_blank" rel="noreferrer">{t.move}</a>}
          {upcomingLive && b.wa && !b.wa.ok && <button className="bka-btn sec" disabled={resending[b.id] === 'busy'} onClick={() => resend(b.id)}>{resending[b.id] === 'busy' ? t.resending : resending[b.id] === 'done' ? t.resent : t.resend}</button>}
          {upcomingLive && <button className="bka-btn danger" onClick={() => cancel(b.id)}>{t.cancel}</button>}
        </div>
      </div>
    )
  }

  return (
    <div className="bka" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <style>{CSS}</style>
      <div className="bka-head">
        <div>
          <h2>{t.title}</h2>
          <p className="sub">{t.sub}</p>
        </div>
        <div className="bka-link" title={t.linkSub}>
          <code dir="ltr">{SITE.replace('https://', '')}/book</code>
          <button className="bka-btn pri" onClick={() => copy(`${SITE}/book`, 'link')}>{copied === 'link' ? t.copied : t.copy}</button>
          <a className="bka-btn sec" href="/book" target="_blank" rel="noreferrer">{t.open}</a>
          <button className="bka-btn plain" onClick={() => copy(`${SITE}/book?lang=en`, 'en')}>{copied === 'en' ? t.copied : t.linkEn}</button>
          <button className="bka-btn plain" title={t.testMailTip} disabled={testMail === 'busy'} onClick={sendTestMail}>{testMail === 'busy' ? t.testSending : testMail || t.testMail}</button>
        </div>
      </div>
      {err && <div className="bka-err" role="alert">{err}</div>}

      <div className="bka-kpis">
        <div className="bka-kpi"><span>{t.kUpcoming}</span><b>{kUpcoming}</b></div>
        <div className="bka-kpi"><span>{t.kWeek}</span><b>{kWeek}</b></div>
        <div className="bka-kpi"><span>{t.kWa}</span><b style={kWa ? { color: 'var(--au-red-text)' } : undefined}>{kWa}</b></div>
        <div className="bka-kpi"><span>{t.kCal}</span><b className="sm"><span className="bka-dot" style={{ background: dot }} />{calStatus === 'on' ? t.calOn : calStatus === 'err' ? t.calErr : t.calOff}</b></div>
      </div>

      <section className="bka-sec">
        <h3>{t.upcoming} ({upcoming.filter(b => b.status !== 'cancelled').length})</h3>
        <div className="bka-list" style={{ marginTop: 8 }}>
          {upcoming.length ? upcoming.map(meeting) : <div className="bka-row" style={{ color: T.text2 }}>{t.none}</div>}
          {past.length > 0 && (
            <details style={{ borderTop: `1px solid ${T.divider}` }}>
              <summary>{t.recent} ({past.length})</summary>
              {past.map(meeting)}
            </details>
          )}
        </div>
      </section>

      <div className="bka-grid">
        <div className="bka-col">
          <section className="bka-sec">
            <h3>{t.hours}</h3>
            <p className="hint">{t.hoursSub}</p>
            <div className="bka-list">
              {t.days.map((name, d) => {
                const h = draft.hours?.[d]
                return (
                  <div key={d} className={`bka-row${h ? '' : ' off'}`}>
                    <Switch on={!!h} onChange={on => toggleDay(d, on)} label={name} />
                    <span className="lbl">{name}</span>
                    {h ? (
                      <>
                        <select className="bka-time" aria-label={`${name} ${t.from}`} value={h[0]} onChange={e => setHour(d, 0, e.target.value)}>{HALF_HOURS.slice(0, -1).map(x => <option key={x} value={x}>{hh(x)}</option>)}</select>
                        <span className="bka-dash" aria-hidden="true">–</span>
                        <select className="bka-time" aria-label={`${name} ${t.to}`} value={h[1]} onChange={e => setHour(d, 1, e.target.value)}>{HALF_HOURS.filter(x => x > h[0]).map(x => <option key={x} value={x}>{hh(x)}</option>)}</select>
                      </>
                    ) : <span style={{ color: T.text3 }}>{t.closed}</span>}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="bka-sec">
            <h3>{t.cal}</h3>
            <p className="hint">{cal.connected ? t.calOnSub : t.calOffSub}</p>
            <div className="bka-list">
              <div className="bka-row">
                <span className="bka-dot" style={{ background: dot }} />
                <span className="lbl">{calStatus === 'on' ? t.calOn : calStatus === 'err' ? t.calErr : t.calOff}
                  {cal.connected && <small><bdi dir="ltr">{cal.email}</bdi>{cal.connectedAt && <> · {t.since} {new Date(cal.connectedAt).toLocaleDateString(loc)}</>}</small>}
                  {cal.error && <small style={{ color: T.amberText }}>{cal.error}</small>}
                </span>
                {cal.oauthReady && (!cal.connected || cal.error) && <button className="bka-btn pri" disabled={connecting} onClick={connect}>{connecting ? t.connecting : cal.connected ? t.reconnect : t.connect}</button>}
                {cal.connected && <button className="bka-btn danger" onClick={disconnect}>{t.disconnect}</button>}
              </div>
              {!cal.oauthReady && <div className="bka-row"><span className="lbl" style={{ color: T.amberText }}>{t.envMissing}</span></div>}
              <div className="bka-row"><span className="lbl">{t.redirect}<small dir="ltr" style={{ userSelect: 'all', overflowWrap: 'anywhere' }}>{cal.redirectUri}</small></span><button className="bka-btn plain" onClick={() => copy(cal.redirectUri, 'redir')}>{copied === 'redir' ? t.copied : t.copy}</button></div>
            </div>
          </section>
        </div>

        <div className="bka-col">
          {type0 && (
            <section className="bka-sec">
              <h3>{t.typeH}</h3>
              <div className="bka-list" style={{ marginTop: 8 }}>
                <label className="bka-row"><span className="lbl" style={{ flex: '0 0 110px', color: T.text2 }}>{t.nameHe}</span><input className="bka-in" value={type0.he} onChange={e => setType({ he: e.target.value })} /></label>
                <label className="bka-row"><span className="lbl" style={{ flex: '0 0 110px', color: T.text2 }}>{t.nameEn}</span><input className="bka-in" dir="ltr" value={type0.en} onChange={e => setType({ en: e.target.value })} /></label>
                <div className="bka-row" style={{ flexWrap: 'wrap' }}>
                  <span className="lbl">{t.duration}</span>
                  <div className="bka-seg" role="radiogroup" aria-label={t.duration}>
                    {DURATIONS.map(m => <button key={m} type="button" role="radio" aria-checked={type0.minutes === m} onClick={() => setType({ minutes: m })}>{m} {t.min}</button>)}
                  </div>
                </div>
                <div className="bka-row" style={{ flexWrap: 'wrap' }}>
                  <span className="lbl">{t.channels}{!draft.zoomUrl && <small>{t.zoomNeeds}</small>}</span>
                  <div className="bka-seg" role="group" aria-label={t.channels}>
                    {CH_KEYS.map(c => <button key={c} type="button" aria-pressed={(type0.channels || []).includes(c)} disabled={c === 'zoom' && !draft.zoomUrl && !(type0.channels || []).includes(c)} onClick={() => toggleCh(c)}>{chName(c)}</button>)}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="bka-sec">
            <h3>{t.rules}</h3>
            <div className="bka-list" style={{ marginTop: 8 }}>
              <div className="bka-row"><span className="lbl">{t.notice}<small>{t.noticeU}</small></span><Stepper t={t} label={t.notice} value={Math.round((draft.minNoticeMin || 0) / 60)} min={0} max={168} onChange={v => val('minNoticeMin', v * 60)} /></div>
              <div className="bka-row"><span className="lbl">{t.horizon}<small>{t.horizonU}</small></span><Stepper t={t} label={t.horizon} value={draft.horizonDays} min={1} max={60} onChange={v => val('horizonDays', v)} /></div>
              <div className="bka-row"><span className="lbl">{t.buffer}</span><Stepper t={t} label={t.buffer} value={draft.bufferMin} min={0} max={60} step={5} unit={t.min} onChange={v => val('bufferMin', v)} /></div>
              <div className="bka-row"><span className="lbl">{t.perDay}</span><Stepper t={t} label={t.perDay} value={draft.maxPerDay} min={1} max={40} onChange={v => val('maxPerDay', v)} /></div>
              <div className="bka-row"><span className="lbl">{t.step}</span><Stepper t={t} label={t.step} value={draft.stepMin} min={10} max={120} step={5} unit={t.min} onChange={v => val('stepMin', v)} /></div>
            </div>
          </section>

          <section className="bka-sec">
            <h3>{t.photo}</h3>
            <p className="hint">{t.photoSub}</p>
            <div className="bka-list">
              <div className="bka-row" style={{ alignItems: 'center' }}>
                {draft.photo ? <img src={draft.photo} alt="" style={{ width: 56, height: 42, objectFit: 'contain', borderRadius: 8, flexShrink: 0, background: 'rgba(var(--ov),.06)' }}/> : <span style={{ width: 56, height: 42, borderRadius: 8, flexShrink: 0, border: '1px dashed var(--au-line)' }}/>}
                <input className="bka-in" dir="ltr" placeholder="/img/booking-portrait.webp" aria-label={t.photo} value={draft.photo ?? ''} onChange={e => val('photo', e.target.value)} />
                {draft.photo !== '/img/booking-portrait.webp' && <button type="button" className="bka-btn plain" onClick={() => val('photo', '/img/booking-portrait.webp')}>{t.photoReset}</button>}
              </div>
            </div>
          </section>

          <section className="bka-sec">
            <h3>{t.zoom}</h3>
            <p className="hint">{t.zoomSub}</p>
            <div className="bka-list">
              <label className="bka-row"><input className="bka-in" dir="ltr" placeholder="https://zoom.us/j/…" aria-label={t.zoom} value={draft.zoomUrl || ''} onChange={e => val('zoomUrl', e.target.value)} /></label>
            </div>
          </section>
        </div>
      </div>

      {(dirty || saving) && (
        <div className="bka-bar" role="region" aria-label={t.dirty}>
          <span style={{ fontWeight: 500 }}>{saving === 'saved' ? t.saved : t.dirty}</span>
          <span style={{ display: 'flex', gap: 6 }}>
            {dirty && <button className="bka-btn plain" onClick={() => setDraft(state.config)}>{t.discard}</button>}
            <button className="bka-btn pri" disabled={saving === 'saving' || !dirty} onClick={save}>{saving === 'saving' ? t.saving : saving === 'saved' ? t.saved : t.save}</button>
          </span>
        </div>
      )}
    </div>
  )
}
