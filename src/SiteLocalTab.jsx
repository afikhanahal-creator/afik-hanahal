// Admin → אנליטיקס → "האתר שלנו (הדפדפן הזה)": what this browser recorded itself (trackEvent → localStorage
// ANALYTICS_KEY). It is not the site's traffic — that is the Google Analytics tab — so the page says so up front.
// Same look as GA4Tab (src/analyticsUI.jsx): full width, calm tiles, a short explanation on every number.
import { useState, useEffect, useRef, useMemo } from 'react'
import { AN_CSS, TipLayer, Lbl } from './analyticsUI.jsx'

const TR = {
  he: {
    title: 'האתר שלנו — הדפדפן הזה', sub: 'פעולות שנמדדו בדפדפן הזה בלבד. התנועה של כל הגולשים נמצאת בלשונית Google Analytics.',
    k: { today: 'ביקורים היום', week: 'ביקורים ב-7 ימים', props: 'צפיות בנכסים', cr: 'שיעור פנייה', forms: 'טפסים שנשלחו', wa: 'לחיצות וואטסאפ', phone: 'לחיצות טלפון', leads: 'לידים במערכת' },
    tips: { today: 'כניסות לאתר מהדפדפן הזה היום', week: 'כניסות מהדפדפן הזה בשבוע האחרון', props: 'כמה פעמים נפתח חלון של נכס', cr: 'טפסים + וואטסאפ מתוך הביקורים', forms: 'טפסי פנייה שנשלחו מכאן', wa: 'לחיצות על כפתורי וואטסאפ', phone: 'לחיצות על מספר הטלפון', leads: 'כל הלידים בלוח הלידים' },
    subs: { today: 'מאז חצות', week: '7 ימים אחרונים', props: 'סה״כ', cr: 'פניות / ביקורים', forms: 'סה״כ', wa: 'סה״כ', phone: 'סה״כ', leads: 'כל המקורות' },
    week7: 'ביקורים ב-7 הימים האחרונים', week7Tip: 'כניסות לאתר בכל יום', today: 'היום', visits: n => `${n} ביקורים`,
    sources: 'מקורות תנועה', sourcesTip: 'מאיפה הגיעו הביקורים', devices: 'מכשירים', devicesTip: 'סוג המכשיר בכל ביקור', direct: 'ישיר',
    dev: { mobile: 'נייד', desktop: 'מחשב', tablet: 'טאבלט' },
    top: 'הנכסים שנצפו הכי הרבה', topTip: 'לפי פתיחות של חלון הנכס', col: { prop: 'נכס', views: 'צפיות' }, colTip: { prop: 'שם הנכס', views: 'כמה פעמים נפתח' },
    links: 'לוחות בקרה חיצוניים', linksTip: 'קישורים לכלי המדידה והפרסום',
    none: 'אין עדיין נתונים בדפדפן הזה', footer: (e, s) => `${e} אירועים · ${s} ביקורים · מתעדכן כל 30 שניות`,
    refresh: 'רענון', clear: 'מחיקת הנתונים', clearQ: 'למחוק את כל נתוני המדידה המקומיים בדפדפן הזה?',
  },
  en: {
    title: 'Our site — this browser', sub: 'Actions measured in this browser only. Traffic from every visitor is in the Google Analytics tab.',
    k: { today: 'Visits today', week: 'Visits in 7 days', props: 'Property views', cr: 'Contact rate', forms: 'Forms sent', wa: 'WhatsApp clicks', phone: 'Phone clicks', leads: 'Leads in the CRM' },
    tips: { today: 'Visits from this browser today', week: 'Visits from this browser in the last week', props: 'How often a property window opened', cr: 'Forms + WhatsApp out of visits', forms: 'Contact forms sent from here', wa: 'Clicks on WhatsApp buttons', phone: 'Clicks on the phone number', leads: 'Every lead on the leads board' },
    subs: { today: 'Since midnight', week: 'Last 7 days', props: 'Total', cr: 'Contacts / visits', forms: 'Total', wa: 'Total', phone: 'Total', leads: 'All sources' },
    week7: 'Visits in the last 7 days', week7Tip: 'Visits to the site each day', today: 'Today', visits: n => `${n} visits`,
    sources: 'Traffic sources', sourcesTip: 'Where the visits came from', devices: 'Devices', devicesTip: 'The device of each visit', direct: 'Direct',
    dev: { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet' },
    top: 'Most viewed properties', topTip: 'By property-window opens', col: { prop: 'Property', views: 'Views' }, colTip: { prop: 'The property', views: 'How often it opened' },
    links: 'External dashboards', linksTip: 'Links to the measurement and ad tools',
    none: 'No data in this browser yet', footer: (e, s) => `${e} events · ${s} visits · updates every 30 seconds`,
    refresh: 'Refresh', clear: 'Clear data', clearQ: 'Delete all local measurement data in this browser?',
  },
}

const LINKS = [
  ['Google Analytics', 'G-X1S3XX7TRV', 'https://analytics.google.com'],
  ['Meta Business Suite', 'Pixels 1311196023271539 · 1341264237748951', 'https://business.facebook.com'],
  ['Meta Events Manager', 'Pixel & ads', 'https://business.facebook.com/events_manager'],
  ['Facebook – Afik Hanahal', 'Profile page', 'https://www.facebook.com/profile.php?id=61573376818745'],
  ['Instagram', '@afik.hanahal', 'https://www.instagram.com/afik.hanahal/'],
  ['LogRocket', 'tkrebw/afik-hanahal', 'https://app.logrocket.com/tkrebw/afik-hanahal'],
]

export default function SiteLocalTab({ storageKey, leads = [], lang = 'he' }) {
  const t = TR[lang] || TR.he
  const en = lang === 'en'
  const rootRef = useRef(null)
  const [events, setEvents] = useState([])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const load = () => { try { setEvents(JSON.parse(localStorage.getItem(storageKey) || '[]')) } catch { setEvents([]) } }
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [storageKey, tick])

  const d = useMemo(() => {
    const now = Date.now(), midnight = new Date(); midnight.setHours(0, 0, 0, 0)
    const of = n => events.filter(e => e.n === n)
    const sessions = of('session_start'), contacts = of('contact_form'), wa = of('whatsapp_click'), phone = of('phone_click'), views = of('property_view')
    const src = {}; sessions.forEach(e => { const k = e.source || ''; src[k] = (src[k] || 0) + 1 })
    const dev = {}; sessions.forEach(e => { if (e.device) dev[e.device] = (dev[e.device] || 0) + 1 })
    const days = Array.from({ length: 7 }, (_, i) => {
      const s = new Date(midnight); s.setDate(s.getDate() - (6 - i))
      const a = s.getTime(), b = a + 864e5
      return { label: i === 6 ? t.today : s.toLocaleDateString(en ? 'en-GB' : 'he-IL', { weekday: 'short' }), n: sessions.filter(e => e.t >= a && e.t < b).length, today: i === 6 }
    })
    const top = {}; views.forEach(e => { if (e.title) top[e.title] = (top[e.title] || 0) + 1 })
    return {
      sessions, today: sessions.filter(e => e.t >= midnight.getTime()).length, week: sessions.filter(e => e.t >= now - 7 * 864e5).length,
      views: views.length, forms: contacts.length, wa: wa.length, phone: phone.length,
      cr: sessions.length ? Math.round(((contacts.length + wa.length) / sessions.length) * 100) : 0,
      src: Object.entries(src).sort((a, b) => b[1] - a[1]).slice(0, 6), dev: Object.entries(dev).sort((a, b) => b[1] - a[1]),
      days, top: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 6),
    }
  }, [events, t, en])

  const tiles = [['today', d.today], ['week', d.week], ['props', d.views], ['cr', `${d.cr}%`], ['forms', d.forms], ['wa', d.wa], ['phone', d.phone], ['leads', leads.length]]
  const peak = Math.max(1, ...d.days.map(x => x.n))
  const bars = (list, total, name = k => k) => list.length ? (
    <div className="an-bars">{list.map(([k, n]) => (
      <div key={k}>
        <div className="an-bar__head"><span>{name(k)}</span><span><span className="an-dim">{n} · </span><b>{total ? Math.round((n / total) * 100) : 0}%</b></span></div>
        <div className="an-bar__track"><i style={{ width: `${total ? (n / total) * 100 : 0}%` }}/></div>
      </div>))}
    </div>) : <p className="an-empty an-empty--sm">{t.none}</p>

  return (
    <div className="an" ref={rootRef} dir={en ? 'ltr' : 'rtl'}>
      <style>{AN_CSS}</style>
      <TipLayer rootRef={rootRef}/>
      <header className="an-top">
        <div><h3 className="an-title">{t.title}</h3><span className="an-sub">{t.sub}</span></div>
        <div className="an-top__side">
          <button type="button" className="an-csv" onClick={() => setTick(x => x + 1)}>↻ {t.refresh}</button>
          <button type="button" className="an-csv an-btn--danger" onClick={() => { if (window.confirm(t.clearQ)) { try { localStorage.removeItem(storageKey) } catch {} setEvents([]) } }}>{t.clear}</button>
        </div>
      </header>

      <section className="an-metrics an-metrics--auto">
        {tiles.map(([id, v]) => (
          <div key={id} className="an-metric">
            <Lbl tip={t.tips[id]} className="an-metric__label">{t.k[id]}</Lbl>
            <span className="an-metric__value">{v}</span>
            <span className="an-metric__sub">{t.subs[id]}</span>
          </div>
        ))}
      </section>

      <div className="an-cols an-cols--chart">
        <section className="an-section">
          <div className="an-sect-head"><Lbl tip={t.week7Tip} className="an-h5" as="h4">{t.week7}</Lbl><span className="an-sub">{t.visits(d.week)}</span></div>
          <div className="an-bars7">{d.days.map((x, i) => (
            <div key={i} className={`an-bars7__col${x.today ? ' is-today' : ''}`} data-tip={`${x.label} · ${t.visits(x.n)}`}>
              <span className="an-bars7__v">{x.n || ''}</span>
              <span className="an-bars7__bar" style={{ height: `${(x.n / peak) * 100}%` }}/>
              <span className="an-bars7__l">{x.label}</span>
            </div>))}
          </div>
        </section>
        <section className="an-section">
          <Lbl tip={t.topTip} className="an-h5" as="h4">{t.top}</Lbl>
          {d.top.length ? (
            <div className="an-scroll"><table className="an-table">
              <thead><tr><th><Lbl tip={t.colTip.prop}>{t.col.prop}</Lbl></th><th className="is-num"><Lbl tip={t.colTip.views}>{t.col.views}</Lbl></th></tr></thead>
              <tbody>{d.top.map(([title, n]) => <tr key={title}><td className="an-td-main"><span className="an-page-t">{title}</span><span className="an-share"><i style={{ width: `${(n / d.top[0][1]) * 100}%` }}/></span></td><td className="is-num">{n}</td></tr>)}</tbody>
            </table></div>
          ) : <p className="an-empty an-empty--sm">{t.none}</p>}
        </section>
      </div>

      <div className="an-cols">
        <section className="an-section"><Lbl tip={t.sourcesTip} className="an-h5" as="h4">{t.sources}</Lbl>{bars(d.src, d.sessions.length, k => k || t.direct)}</section>
        <section className="an-section"><Lbl tip={t.devicesTip} className="an-h5" as="h4">{t.devices}</Lbl>{bars(d.dev, d.sessions.length, k => t.dev[k] || k)}</section>
      </div>

      <section className="an-section">
        <Lbl tip={t.linksTip} className="an-h5" as="h4">{t.links}</Lbl>
        <div className="an-links">{LINKS.map(([label, sub, url]) => <a key={url} className="an-link" href={url} target="_blank" rel="noopener noreferrer"><b>{label} ↗</b><span dir="ltr">{sub}</span></a>)}</div>
      </section>

      <p className="an-footnote">{t.footer(events.length, d.sessions.length)}</p>
    </div>
  )
}
