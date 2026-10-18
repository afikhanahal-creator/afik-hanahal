// Admin → "תיאום פגישות": the booking page (/book) — its link, the Google Calendar connection, office hours, the Zoom link
// and the meetings booked through it. API: /api/meta/booking-* (lib/booking-server.js).
import { useEffect, useState } from 'react'
import { T } from './automationsUI.jsx'
import { autoApi } from './AutomationsApi.jsx'

const SITE = 'https://www.afikhanahal.co.il'
const TZ = 'Asia/Jerusalem'
const HALF_HOURS = Array.from({ length: 33 }, (_, i) => 6 + i * 0.5)   // 06:00 … 22:00
const hh = h => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`

const TR = {
  he: {
    title: 'תיאום פגישות', sub: 'עמוד קביעת שיחות ופגישות ביומן של המשרד, במקום קלנדלי',
    link: 'הקישור לקביעת פגישה', linkSub: 'שולחים ללקוחות בוואטסאפ, במייל או במודעה. בתבניות: {bookingLink}', copy: 'העתק', copied: 'הועתק ✓', open: 'פתח', linkEn: 'באנגלית',
    cal: 'יומן גוגל', calOn: 'מחובר', calOff: 'לא מחובר', calErr: 'צריך לחבר מחדש',
    calOnSub: 'פגישות נכנסות ליומן, נשלחת הזמנה עם קישור Meet, ושעות תפוסות ביומן לא מוצעות.',
    calOffSub: 'בלי יומן מחובר העמוד עובד לפי שעות הפעילות בלבד, והמשרד מקבל התראה ומכניס ליומן ידנית.',
    connect: 'חבר יומן', reconnect: 'חבר מחדש', disconnect: 'נתק', connecting: 'מעביר לגוגל…',
    envMissing: 'כדי לחבר יומן צריך קודם להגדיר ב-Vercel את GOOGLE_OAUTH_CLIENT_ID ו-GOOGLE_OAUTH_CLIENT_SECRET.',
    redirect: 'כתובת החזרה (Redirect URI) להגדרה בגוגל:', since: 'מחובר מאז',
    hours: 'שעות ותנאים', closed: 'סגור', save: 'שמור', saving: 'שומר…', saved: 'נשמר ✓',
    zoom: 'קישור זום אישי (לא חובה)', zoomSub: 'אם מוגדר, הלקוחות יוכלו לבחור גם זום', notice: 'הכי מוקדם (שעות מראש)', horizon: 'כמה ימים קדימה',
    buffer: 'מרווח לפני ואחרי פגישות ביומן (דק׳)', perDay: 'מקסימום פגישות ביום', step: 'פגישה מתחילה כל (דק׳)',
    upcoming: 'פגישות קרובות', recent: 'פגישות שעברו (30 יום)', none: 'עוד לא נקבעו פגישות דרך העמוד', cancel: 'בטל', cancelQ: 'לבטל את הפגישה? אם יש הזמנה ביומן, הלקוח יקבל הודעת ביטול.',
    cancelled: 'בוטלה', inCal: 'ביומן', notInCal: 'לא ביומן', meet: 'Google Meet', zoomCh: 'זום', phoneCh: 'טלפון', loading: 'טוען…', err: 'שגיאה',
    days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'], typeTitle: 'סוג פגישה', minutes: 'דקות',
  },
  en: {
    title: 'Bookings', sub: 'A page for booking calls and meetings in the office calendar, instead of Calendly',
    link: 'Booking link', linkSub: 'Send it to clients on WhatsApp, by email or in an ad. In templates: {bookingLink}', copy: 'Copy', copied: 'Copied ✓', open: 'Open', linkEn: 'English',
    cal: 'Google Calendar', calOn: 'Connected', calOff: 'Not connected', calErr: 'Needs reconnecting',
    calOnSub: 'Meetings go into the calendar, an invitation with a Meet link goes out, and busy times are not offered.',
    calOffSub: 'Without a calendar the page works from office hours only; the office is alerted and adds the meeting by hand.',
    connect: 'Connect calendar', reconnect: 'Reconnect', disconnect: 'Disconnect', connecting: 'Opening Google…',
    envMissing: 'To connect a calendar, first set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in Vercel.',
    redirect: 'Redirect URI to set in Google:', since: 'Connected since',
    hours: 'Hours and rules', closed: 'Closed', save: 'Save', saving: 'Saving…', saved: 'Saved ✓',
    zoom: 'Personal Zoom link (optional)', zoomSub: 'When set, clients can also choose Zoom', notice: 'Earliest (hours ahead)', horizon: 'Days ahead',
    buffer: 'Gap before and after calendar events (min)', perDay: 'Max meetings a day', step: 'A meeting starts every (min)',
    upcoming: 'Upcoming meetings', recent: 'Past meetings (30 days)', none: 'No meetings booked through the page yet', cancel: 'Cancel', cancelQ: 'Cancel this meeting? If there is a calendar invitation, the client gets a cancellation.',
    cancelled: 'Cancelled', inCal: 'In calendar', notInCal: 'Not in calendar', meet: 'Google Meet', zoomCh: 'Zoom', phoneCh: 'Phone', loading: 'Loading…', err: 'Error',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], typeTitle: 'Meeting type', minutes: 'minutes',
  },
}

const card = { background: T.card, border: `1px solid ${T.s1Line}`, borderRadius: 14, padding: 18 }
const btn = (primary) => ({ border: primary ? 'none' : `1px solid ${T.line}`, background: primary ? 'var(--au-brand)' : 'transparent', color: primary ? '#fff' : T.text, borderRadius: 9, padding: '8px 14px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' })
const input = { background: T.s2, border: `1px solid ${T.s2Line}`, borderRadius: 8, color: T.text, padding: '7px 10px', fontFamily: 'inherit', fontSize: 13 }
const h3 = { margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: T.text }
const sub = { margin: 0, fontSize: 12.5, color: T.text2, lineHeight: 1.6 }

function CopyBtn({ text, t }) {
  const [ok, setOk] = useState(false)
  return <button style={btn(true)} onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500) }) }}>{ok ? t.copied : t.copy}</button>
}

export default function BookingAdminTab({ lang = 'he' }) {
  const t = TR[lang] || TR.he
  const [state, setState] = useState(null)
  const [err, setErr] = useState('')
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState('')
  const [connecting, setConnecting] = useState(false)

  const load = () => autoApi.get('booking-admin').then(d => { setState(d); setDraft(d.config); setErr('') }).catch(e => setErr(e.message))
  useEffect(() => { load() }, [])

  if (err && !state) return <div style={{ padding: 24, color: T.redText }}>{t.err}: {err}</div>
  if (!state || !draft) return <div style={{ padding: 24, color: T.text2 }}>{t.loading}</div>

  const cal = state.calendar || {}
  const calStatus = cal.connected ? (cal.error ? 'err' : 'on') : 'off'
  const dot = { on: T.green, off: T.grey, err: T.amber }[calStatus]
  const now = Date.now()
  const upcoming = state.bookings.filter(b => Date.parse(b.end) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const past = state.bookings.filter(b => Date.parse(b.end) <= now)
  const when = iso => new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const chName = c => ({ meet: t.meet, zoom: t.zoomCh, phone: t.phoneCh }[c] || c)

  async function connect() {
    setConnecting(true)
    try { const d = await autoApi.post('booking-connect'); window.location.href = d.url } catch (e) { setErr(e.message); setConnecting(false) }
  }
  async function disconnect() {
    if (!window.confirm(t.disconnect + '?')) return
    await autoApi.post('booking-disconnect').catch(e => setErr(e.message))
    load()
  }
  async function save() {
    setSaving('saving')
    try {
      const d = await autoApi.post('booking-settings', { config: { hours: draft.hours, zoomUrl: draft.zoomUrl, minNoticeMin: draft.minNoticeMin, horizonDays: draft.horizonDays, bufferMin: draft.bufferMin, maxPerDay: draft.maxPerDay, stepMin: draft.stepMin, types: draft.types } })
      setDraft(d.config); setState(s => ({ ...s, config: d.config })); setSaving('saved'); setErr('')
      setTimeout(() => setSaving(''), 1800)
    } catch (e) { setErr(e.message); setSaving('') }
  }
  async function cancel(id) {
    if (!window.confirm(t.cancelQ)) return
    await autoApi.post('booking-cancel', { id }).catch(e => setErr(e.message))
    load()
  }
  const setHour = (d, i, v) => setDraft(c => { const h = { ...c.hours }; const cur = h[d] || [9, 18]; const n = [...cur]; n[i] = +v; h[d] = n; return { ...c, hours: h } })
  const toggleDay = d => setDraft(c => ({ ...c, hours: { ...c.hours, [d]: c.hours[d] ? null : [9, 18] } }))
  const num = (k, v) => setDraft(c => ({ ...c, [k]: v }))
  const type0 = draft.types?.[0]
  const setType = patch => setDraft(c => ({ ...c, types: [{ ...c.types[0], ...patch }, ...c.types.slice(1)] }))

  const Row = ({ b }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,auto) 1fr auto', gap: 12, alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${T.divider}`, opacity: b.status === 'cancelled' ? 0.5 : 1 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{when(b.start)}</div>
      <div style={{ fontSize: 13, color: T.text, minWidth: 0 }}>
        <bdi>{b.name}</bdi> · <a href={`tel:${b.phone}`} style={{ color: T.brandText }} dir="ltr">{b.phone}</a>
        <div style={{ fontSize: 12, color: T.text2 }}>
          {b.typeName || b.type} · {chName(b.channel)}
          {b.meetLink && <> · <a href={b.meetLink} target="_blank" rel="noreferrer" style={{ color: T.brandText }}>Meet</a></>}
          {' · '}{b.status === 'cancelled' ? t.cancelled : b.eventId ? t.inCal : <span style={{ color: T.amberText }}>{t.notInCal}</span>}
          {b.notes && <div style={{ color: T.text3, whiteSpace: 'pre-wrap' }}>{b.notes}</div>}
        </div>
      </div>
      {b.status !== 'cancelled' && Date.parse(b.end) > now ? <button style={btn(false)} onClick={() => cancel(b.id)}>{t.cancel}</button> : <span />}
    </div>
  )

  return (
    <div dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ display: 'grid', gap: 16, padding: '4px 0 24px', color: T.text }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{t.title}</h2>
        <p style={sub}>{t.sub}</p>
      </div>
      {err && <div style={{ ...card, borderColor: T.red, color: T.redText, padding: 12 }}>{err}</div>}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
        <section style={card}>
          <h3 style={h3}>{t.link}</h3>
          <p style={sub}>{t.linkSub}</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <code dir="ltr" style={{ ...input, flex: '1 1 200px' }}>{SITE}/book</code>
            <CopyBtn text={`${SITE}/book`} t={t} />
            <a href="/book" target="_blank" rel="noreferrer" style={{ ...btn(false), textDecoration: 'none' }}>{t.open}</a>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: T.text2 }}>{t.linkEn}: <span dir="ltr">{SITE}/book?lang=en</span></div>
        </section>

        <section style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot }} />
            <h3 style={{ ...h3, margin: 0 }}>{t.cal}: {calStatus === 'on' ? t.calOn : calStatus === 'err' ? t.calErr : t.calOff}</h3>
          </div>
          {cal.connected && <p style={{ ...sub, marginTop: 6 }}><bdi dir="ltr">{cal.email}</bdi>{cal.connectedAt && <> · {t.since} {new Date(cal.connectedAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL')}</>}</p>}
          {cal.error && <p style={{ ...sub, color: T.amberText }}>{cal.error}</p>}
          <p style={{ ...sub, marginTop: 6 }}>{cal.connected ? t.calOnSub : t.calOffSub}</p>
          {!cal.oauthReady && <p style={{ ...sub, marginTop: 8, color: T.amberText }}>{t.envMissing}</p>}
          <div style={{ marginTop: 8, fontSize: 12, color: T.text2 }}>{t.redirect} <code dir="ltr" style={{ userSelect: 'all' }}>{cal.redirectUri}</code></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {cal.oauthReady && (!cal.connected || cal.error) && <button style={btn(true)} disabled={connecting} onClick={connect}>{connecting ? t.connecting : cal.connected ? t.reconnect : t.connect}</button>}
            {cal.connected && <button style={btn(false)} onClick={disconnect}>{t.disconnect}</button>}
          </div>
        </section>
      </div>

      <section style={card}>
        <h3 style={h3}>{t.hours}</h3>
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', marginTop: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            {t.days.map((name, d) => {
              const h = draft.hours?.[d]
              return (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, width: 90, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!h} onChange={() => toggleDay(d)} />{name}
                  </label>
                  {h ? (
                    <>
                      <select style={input} value={h[0]} onChange={e => setHour(d, 0, e.target.value)}>{HALF_HOURS.map(x => <option key={x} value={x}>{hh(x)}</option>)}</select>
                      <span style={{ color: T.text3 }}>–</span>
                      <select style={input} value={h[1]} onChange={e => setHour(d, 1, e.target.value)}>{HALF_HOURS.filter(x => x > h[0]).map(x => <option key={x} value={x}>{hh(x)}</option>)}</select>
                    </>
                  ) : <span style={{ color: T.text3 }}>{t.closed}</span>}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'grid', gap: 10, alignContent: 'start', fontSize: 13 }}>
            {type0 && (
              <label style={{ display: 'grid', gap: 4 }}>{t.typeTitle}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...input, flex: 1 }} value={type0.he} onChange={e => setType({ he: e.target.value })} />
                  <input style={{ ...input, width: 80 }} type="number" min={10} max={240} step={5} value={type0.minutes} onChange={e => setType({ minutes: +e.target.value })} title={t.minutes} />
                </div>
                <input style={input} dir="ltr" value={type0.en} onChange={e => setType({ en: e.target.value })} />
              </label>
            )}
            <label style={{ display: 'grid', gap: 4 }}>{t.zoom}
              <input style={input} dir="ltr" placeholder="https://zoom.us/j/…" value={draft.zoomUrl || ''} onChange={e => num('zoomUrl', e.target.value)} />
              <span style={{ fontSize: 11.5, color: T.text2 }}>{t.zoomSub}</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4 }}>{t.notice}<input style={input} type="number" min={0} max={168} value={Math.round((draft.minNoticeMin || 0) / 60)} onChange={e => num('minNoticeMin', +e.target.value * 60)} /></label>
              <label style={{ display: 'grid', gap: 4 }}>{t.horizon}<input style={input} type="number" min={1} max={60} value={draft.horizonDays} onChange={e => num('horizonDays', +e.target.value)} /></label>
              <label style={{ display: 'grid', gap: 4 }}>{t.buffer}<input style={input} type="number" min={0} max={60} step={5} value={draft.bufferMin} onChange={e => num('bufferMin', +e.target.value)} /></label>
              <label style={{ display: 'grid', gap: 4 }}>{t.perDay}<input style={input} type="number" min={1} max={40} value={draft.maxPerDay} onChange={e => num('maxPerDay', +e.target.value)} /></label>
              <label style={{ display: 'grid', gap: 4 }}>{t.step}<input style={input} type="number" min={10} max={120} step={5} value={draft.stepMin} onChange={e => num('stepMin', +e.target.value)} /></label>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}><button style={btn(true)} disabled={saving === 'saving'} onClick={save}>{saving === 'saving' ? t.saving : saving === 'saved' ? t.saved : t.save}</button></div>
      </section>

      <section style={card}>
        <h3 style={h3}>{t.upcoming} ({upcoming.filter(b => b.status !== 'cancelled').length})</h3>
        {upcoming.length ? upcoming.map(b => <Row key={b.id} b={b} />) : <p style={{ ...sub, marginTop: 8 }}>{t.none}</p>}
        {past.length > 0 && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: T.text2 }}>{t.recent} ({past.length})</summary>
            {past.map(b => <Row key={b.id} b={b} />)}
          </details>
        )}
      </section>
    </div>
  )
}
