// Google Analytics 4 — full property dashboard, fed by /api/meta/ga4 (GA4 Data API, server-side).
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { FaSyncAlt, FaExternalLinkAlt, FaUsers, FaUserPlus, FaMousePointer, FaEye, FaHeartbeat, FaClock, FaBullseye, FaPercent, FaDesktop, FaMobileAlt, FaTabletAlt, FaMapMarkerAlt, FaBolt, FaFileAlt, FaSignInAlt, FaRoute, FaBullhorn, FaKey, FaCheckCircle, FaArrowUp, FaArrowDown, FaChartLine } from 'react-icons/fa'
import { T, AUTO_CSS, Button, Badge, Skeleton, CopyField } from './automationsUI.jsx'

const TR = {
  he: {
    title: 'Google Analytics 4', sub: p => `נכס ${p} · הנגר 24 הוד השרון`, days: n => `${n} ימים`, refresh: 'רענון', openGa: 'פתח ב-Google Analytics',
    updated: m => (m < 1 ? 'עודכן עכשיו' : `עודכן לפני ${m} דק׳`), vsPrev: n => `לעומת ${n} הימים הקודמים`,
    rtTitle: 'בזמן אמת', rtSub: 'משתמשים פעילים ב-30 הדקות האחרונות', rtPages: 'עמודים פתוחים עכשיו', rtNone: 'אין כרגע גולשים באתר',
    k: { totalUsers: 'משתמשים', newUsers: 'משתמשים חדשים', sessions: 'ביקורים', screenPageViews: 'צפיות בדפים', engagementRate: 'שיעור מעורבות', averageSessionDuration: 'משך ביקור ממוצע', keyEvents: 'המרות (אירועי מפתח)', conv: 'שיעור המרה' },
    trend: 'מגמה', prevLine: 'תקופה קודמת', curLine: 'התקופה הנוכחית',
    channels: 'ערוצי הגעה', channelsSub: 'מאיפה מגיעים הגולשים', sources: 'מקור / מדיום', devices: 'מכשירים', audience: 'חדשים מול חוזרים', newU: 'חדשים', retU: 'חוזרים',
    pages: 'העמודים הנצפים ביותר', landing: 'דפי נחיתה', cities: 'ערים', countries: 'מדינות', events: 'אירועים', heat: 'מתי מבקרים באתר', heatSub: 'ביקורים לפי יום ושעה (שעון ישראל)',
    campaigns: 'קמפיינים (UTM)', colViews: 'צפיות', colUsers: 'משתמשים', colSessions: 'ביקורים', colTime: 'זמן ממוצע', colConv: 'המרות', colEng: 'מעורבות', colCount: 'כמות', share: 'נתח',
    key: 'המרה', empty: 'אין נתונים בטווח הזה', loading: 'טוען נתונים מ-Google Analytics…',
    dow: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'], less: 'פחות', more: 'יותר',
    setupTitle: 'חיבור ישיר ל-Google Analytics', setupSub: 'כדי להציג כאן את כל הנתונים של GA4 בזמן אמת, צריך לחבר חשבון שירות של Google (חינם, פעם אחת, כ-5 דקות).',
    smNote: 'למה זה נדרש? עד היום הנתונים הגיעו דרך Supermetrics — תקופת הניסיון שם הסתיימה ב-16.6.2026 ולכן הנתונים הפסיקו להתעדכן. החיבור הישיר ל-Google חינמי ולא תלוי בשירות חיצוני.',
    steps: [
      ['הפעילו את Google Analytics Data API', 'ב-Google Cloud Console, בפרויקט קיים או חדש.', 'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com', 'פתח'],
      ['צרו חשבון שירות והורידו מפתח JSON', 'ב-IAM & Admin פתחו Service Accounts וצרו חשבון חדש. בלשונית Keys בחרו Add key ואז JSON — הקובץ יירד למחשב.', 'https://console.cloud.google.com/iam-admin/serviceaccounts', 'פתח'],
      ['הוסיפו את חשבון השירות לנכס ב-GA4', 'בתפריט Admin פתחו Property access management, לחצו ➕, הדביקו את כתובת ה-client_email מהקובץ ובחרו הרשאת Viewer.', 'https://analytics.google.com/analytics/web/#/a/p536943897/admin', 'פתח'],
      ['הדביקו את קובץ ה-JSON ב-Vercel', 'ב-Settings פתחו Environment Variables, הוסיפו משתנה בשם GA4_SERVICE_ACCOUNT_JSON שהערך שלו הוא כל התוכן של הקובץ, ובצעו Redeploy.', 'https://vercel.com/dashboard', 'פתח'],
    ],
    envName: 'שם המשתנה', propId: 'מזהה הנכס (GA4_PROPERTY_ID, כבר מוגדר כברירת מחדל)', copy: 'העתק', copied: 'הועתק', url: 'ערך',
    errTitle: 'Google Analytics החזיר שגיאה', retry: 'נסה שוב',
    why: {
      permission: e => `חשבון השירות${e ? ` ${e}` : ''} עדיין לא קיבל גישה לנכס. ב-GA4, בתפריט Admin תחת Property access management, הוסיפו אותו בהרשאת Viewer.`,
      api: 'ה-Google Analytics Data API לא מופעל בפרויקט של חשבון השירות. הפעילו אותו ב-Google Cloud Console.',
      auth: 'המפתח של חשבון השירות לא תקין או בוטל. צרו מפתח JSON חדש והדביקו אותו שוב ב-Vercel.',
      property: 'מזהה הנכס שגוי. בדקו את GA4_PROPERTY_ID (מספר, לא G-XXXX).',
      other: 'נסו שוב בעוד רגע. אם זה חוזר — פרטי השגיאה למטה.',
    },
    ch: { 'Direct': 'ישיר', 'Organic Search': 'חיפוש אורגני', 'Paid Search': 'חיפוש ממומן', 'Organic Social': 'רשתות חברתיות', 'Paid Social': 'רשתות – ממומן', 'Referral': 'הפניות מאתרים', 'Email': 'אימייל', 'Unassigned': 'לא משויך', 'Organic Maps': 'מפות', 'Display': 'באנרים', 'Cross-network': 'Performance Max', 'Organic Video': 'וידאו', 'Paid Video': 'וידאו ממומן', 'Paid Other': 'ממומן – אחר', 'SMS': 'SMS', 'Organic Shopping': 'שופינג' },
    dev: { mobile: 'נייד', desktop: 'מחשב', tablet: 'טאבלט', 'smart tv': 'טלוויזיה' },
    ev: { page_view: 'צפייה בדף', session_start: 'תחילת ביקור', first_visit: 'ביקור ראשון', user_engagement: 'מעורבות', scroll: 'גלילה לתחתית', click: 'קליק לאתר חיצוני', form_start: 'התחלת טופס', form_submit: 'שליחת טופס', generate_lead: 'ליד', contact_form: 'טופס יצירת קשר', whatsapp_click: 'קליק ל-WhatsApp', phone_click: 'קליק לחיוג', property_view: 'צפייה בנכס', view_search_results: 'חיפוש באתר', file_download: 'הורדת קובץ', video_start: 'צפייה בווידאו' },
  },
  en: {
    title: 'Google Analytics 4', sub: p => `Property ${p} · Hanegar 24 Hod Hasharon`, days: n => `${n} days`, refresh: 'Refresh', openGa: 'Open Google Analytics',
    updated: m => (m < 1 ? 'Updated just now' : `Updated ${m} min ago`), vsPrev: n => `vs. previous ${n} days`,
    rtTitle: 'Realtime', rtSub: 'Active users in the last 30 minutes', rtPages: 'Pages open right now', rtNone: 'Nobody on the site right now',
    k: { totalUsers: 'Users', newUsers: 'New users', sessions: 'Sessions', screenPageViews: 'Page views', engagementRate: 'Engagement rate', averageSessionDuration: 'Avg. session duration', keyEvents: 'Conversions (key events)', conv: 'Conversion rate' },
    trend: 'Trend', prevLine: 'Previous period', curLine: 'This period',
    channels: 'Traffic channels', channelsSub: 'Where visitors come from', sources: 'Source / medium', devices: 'Devices', audience: 'New vs returning', newU: 'New', retU: 'Returning',
    pages: 'Top pages', landing: 'Landing pages', cities: 'Cities', countries: 'Countries', events: 'Events', heat: 'When people visit', heatSub: 'Sessions by weekday and hour (Israel time)',
    campaigns: 'Campaigns (UTM)', colViews: 'Views', colUsers: 'Users', colSessions: 'Sessions', colTime: 'Avg. time', colConv: 'Conv.', colEng: 'Engaged', colCount: 'Count', share: 'Share',
    key: 'Key event', empty: 'No data in this range', loading: 'Loading Google Analytics data…',
    dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], less: 'Less', more: 'More',
    setupTitle: 'Connect Google Analytics directly', setupSub: 'To show every GA4 metric here in real time, connect a Google service account (free, one-time, about 5 minutes).',
    smNote: 'Why? Data used to come through Supermetrics — its trial ended on 16 Jun 2026, so the numbers stopped updating. The direct Google connection is free and has no third-party dependency.',
    steps: [
      ['Enable the Google Analytics Data API', 'In Google Cloud Console, in an existing or new project.', 'https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com', 'Open'],
      ['Create a service account and download a JSON key', 'IAM → Service Accounts → Create → Keys → Add key → JSON.', 'https://console.cloud.google.com/iam-admin/serviceaccounts', 'Open'],
      ['Give the service account access to the GA4 property', 'Admin → Property access management → ➕ → the client_email from the file → Viewer role.', 'https://analytics.google.com/analytics/web/#/a/p536943897/admin', 'Open'],
      ['Paste the JSON into Vercel', 'Settings → Environment Variables → name: GA4_SERVICE_ACCOUNT_JSON, value: the whole file → Redeploy.', 'https://vercel.com/dashboard', 'Open'],
    ],
    envName: 'Variable name', propId: 'Property ID (GA4_PROPERTY_ID, already the default)', copy: 'Copy', copied: 'Copied', url: 'Value',
    errTitle: 'Google Analytics returned an error', retry: 'Try again',
    why: {
      permission: e => `The service account${e ? ` ${e}` : ''} has no access to the property yet. In GA4 → Admin → Property access management add it as Viewer.`,
      api: 'The Google Analytics Data API is not enabled in the service account’s project. Enable it in Google Cloud Console.',
      auth: 'The service-account key is invalid or revoked. Create a new JSON key and paste it into Vercel again.',
      property: 'Wrong property ID. Check GA4_PROPERTY_ID (a number, not G-XXXX).',
      other: 'Try again in a moment. If it keeps happening, the details are below.',
    },
    ch: {}, dev: { mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet', 'smart tv': 'Smart TV' },
    ev: { page_view: 'Page view', session_start: 'Session start', first_visit: 'First visit', user_engagement: 'Engagement', scroll: 'Scrolled to bottom', click: 'Outbound click', form_start: 'Form start', form_submit: 'Form submit', generate_lead: 'Lead', contact_form: 'Contact form', whatsapp_click: 'WhatsApp click', phone_click: 'Phone click', property_view: 'Property view', view_search_results: 'Site search', file_download: 'File download', video_start: 'Video start' },
  },
}

const CSS = `
  .ga *{box-sizing:border-box}
  .ga-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .ga-2{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;align-items:start}
  .ga-2e{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}
  .ga-rt{display:grid;grid-template-columns:220px minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:center}
  .ga-row:hover{background:rgba(132,144,216,.06)}
  .ga-seg button{min-height:0!important;min-width:0!important}
  @keyframes ga-pulse{0%{box-shadow:0 0 0 0 rgba(37,211,102,.55)}70%{box-shadow:0 0 0 9px rgba(37,211,102,0)}100%{box-shadow:0 0 0 0 rgba(37,211,102,0)}}
  .ga-live{animation:ga-pulse 2s infinite}
  @media (max-width:1100px){.ga-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}.ga-2,.ga-2e{grid-template-columns:1fr}.ga-rt{grid-template-columns:1fr}}
  @media (max-width:640px){.ga-kpi{gap:8px}.ga-hide-m{display:none!important}}
  @media (prefers-reduced-motion:reduce){.ga-live{animation:none}}
`

// ── formatting ────────────────────────────────────────────────────────────────
const nf = (lang, opts) => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'he-IL', opts)
const fmtN = (v, lang) => nf(lang, { maximumFractionDigits: 0 }).format(v || 0)
const fmtC = (v, lang) => (v >= 10000 ? nf(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(v) : fmtN(v, lang))
const fmtP = (v, lang, d = 1) => nf(lang, { style: 'percent', maximumFractionDigits: d }).format(v || 0)
const fmtDur = s => { s = Math.round(s || 0); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}` }
const ymd = s => new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)))
const dayKey = d => d.toISOString().slice(0, 10).replace(/-/g, '')
const conv = r => (r?.sessions ? (r.keyEvents || 0) / r.sessions : 0)

function delta(cur, prev) {
  if (!prev) return cur ? null : 0
  return (cur - prev) / prev
}

// ── small building blocks ─────────────────────────────────────────────────────
function Panel({ title, sub, icon: Ic, right, children, pad = 18, style }) {
  return (
    <section style={{ background: T.cardGrad, boxShadow: T.cardShadow, border: `1px solid ${T.s1Line}`, borderRadius: 16, padding: pad, minWidth: 0, ...style }}>
      {(title || right) && (
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          {Ic && <span style={{ width: 30, height: 30, borderRadius: 9, background: T.brandSoft, color: T.brandText, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic size={13}/></span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: T.text, letterSpacing: '-.005em' }}>{title}</h3>
            {sub && <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>{sub}</div>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  )
}

function Delta({ v, invert, lang }) {
  if (v === null) return <span style={{ fontSize: 11.5, fontWeight: 700, color: T.brandText }}>{lang === 'en' ? 'new' : 'חדש'}</span>
  if (!Number.isFinite(v) || Math.abs(v) < 0.005) return <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text3 }}>0%</span>
  const good = invert ? v < 0 : v > 0
  const c = good ? '#4ADE80' : '#F87171'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 800, color: c, background: `${c}14`, borderRadius: 6, padding: '2px 6px', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>
      {v > 0 ? <FaArrowUp size={8}/> : <FaArrowDown size={8}/>}{fmtP(Math.abs(v), lang, 0)}
    </span>
  )
}

function Spark({ data, color = T.brand, h = 30 }) {
  if (!data || data.length < 2) return <div style={{ height: h }}/>
  const max = Math.max(...data, 1), w = 100
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - (v / max) * (h - 4)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h} aria-hidden style={{ display: 'block', direction: 'ltr' }}>
      <path d={`${line}L${w},${h}L0,${h}Z`} fill={`${color}1f`}/>
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
    </svg>
  )
}

function Kpi({ icon: Ic, label, value, d, invert, spark, color, lang, hint }) {
  return (
    <div style={{ background: T.cardGrad, boxShadow: T.cardShadow, border: `1px solid ${T.s1Line}`, borderRadius: 14, padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }} title={hint}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text3, fontSize: 12, fontWeight: 700 }}>
        <Ic size={11} style={{ color, flexShrink: 0 }}/><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</span>
        <Delta v={d} invert={invert} lang={lang}/>
      </div>
      <Spark data={spark} color={color}/>
    </div>
  )
}

// Horizontal bar list (channels, cities, sources…)
function BarList({ rows, label, value, fmt, color = T.brand, extra, lang, max: maxRows = 8, emptyText }) {
  const list = rows.slice(0, maxRows)
  const max = Math.max(...list.map(value), 1)
  const total = rows.reduce((n, r) => n + value(r), 0) || 1
  if (!list.length) return <div style={{ fontSize: 13, color: T.text3, padding: '8px 0' }}>{emptyText}</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {list.map((r, i) => (
        <div key={i} className="ga-row" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 9, minHeight: 36 }}>
          <div aria-hidden style={{ position: 'absolute', insetInlineStart: 0, top: 3, bottom: 3, width: `${(value(r) / max) * 100}%`, background: `${color}1c`, borderRadius: 8, transition: 'width .4s' }}/>
          <span style={{ position: 'relative', flex: 1, minWidth: 0, fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'start' }}><bdi>{label(r)}</bdi></span>
          {extra && <span style={{ position: 'relative', fontSize: 11.5, color: T.text3, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{extra(r)}</span>}
          <span style={{ position: 'relative', fontSize: 13, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums', minWidth: 44, textAlign: 'end' }}>{fmt(value(r))}</span>
          <span style={{ position: 'relative', fontSize: 11, color: T.text3, fontVariantNumeric: 'tabular-nums', minWidth: 38, textAlign: 'end' }}>{fmtP(value(r) / total, lang, 0)}</span>
        </div>
      ))}
    </div>
  )
}

function Table({ cols, rows, emptyText }) {
  if (!rows.length) return <div style={{ fontSize: 13, color: T.text3, padding: '8px 0' }}>{emptyText}</div>
  const grid = cols.map(c => c.w || 'minmax(0,1fr)').join(' ')
  return (
    <div role="table" style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
      <div role="row" style={{ display: 'grid', gridTemplateColumns: grid, gap: 10, padding: '0 10px 8px', color: T.text3, fontSize: 11.5, fontWeight: 700, borderBottom: `1px solid ${T.divider}` }}>
        {cols.map((c, i) => <span role="columnheader" key={i} className={c.hideM ? 'ga-hide-m' : ''} style={{ textAlign: c.num ? 'end' : 'start' }}>{c.label}</span>)}
      </div>
      {rows.map((r, ri) => (
        <div role="row" key={ri} className="ga-row" style={{ display: 'grid', gridTemplateColumns: grid, gap: 10, padding: '9px 10px', borderBottom: `1px solid ${T.divider}`, alignItems: 'center', borderRadius: 8 }}>
          {cols.map((c, i) => (
            <span role="cell" key={i} className={c.hideM ? 'ga-hide-m' : ''} style={{ minWidth: 0, textAlign: c.num ? 'end' : 'start', fontVariantNumeric: 'tabular-nums', color: c.num ? T.text : T.text, fontWeight: c.strong ? 800 : 500, overflow: 'hidden' }}>{c.render(r, ri)}</span>
          ))}
        </div>
      ))}
    </div>
  )
}

function Donut({ parts, size = 132, stroke = 16, center }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  let off = 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(var(--ov),.06)" strokeWidth={stroke}/>
        {parts.map((p, i) => {
          const len = (p.value / total) * c
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-off}/>
          off += len
          return el
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>{center}</div>
    </div>
  )
}

// Main trend chart: current period (solid, area) vs previous period (dashed)
function TrendChart({ cur, prev, labels, lang, fmt, color }) {
  const [hover, setHover] = useState(null)
  const ref = useRef(null)
  const H = 220, W = 1000, n = cur.length
  const max = Math.max(...cur, ...prev, 1) * 1.12
  const x = i => (n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const y = v => H - (v / max) * H
  const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const ticks = [0, .25, .5, .75, 1].map(f => max / 1.12 * f)
  const every = Math.max(1, Math.ceil(n / 8))
  const onMove = e => {
    const r = ref.current?.getBoundingClientRect(); if (!r || !n) return
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1))
    setHover(Math.min(Math.max(i, 0), n - 1))
  }
  return (
    <div dir="ltr" style={{ position: 'relative' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', gap: 8 }}>
        <div style={{ position: 'relative', height: H }}>
          {ticks.map((t, i) => <span key={i} style={{ position: 'absolute', right: 0, top: y(t) - 7, fontSize: 10.5, color: T.text3, fontVariantNumeric: 'tabular-nums' }}>{fmtC(Math.round(t), lang)}</span>)}
        </div>
        <div ref={ref} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ position: 'relative', height: H, cursor: 'crosshair' }}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ display: 'block', overflow: 'visible' }} aria-hidden>
            <defs>
              <linearGradient id="ga-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".32"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient>
            </defs>
            {ticks.map((t, i) => <line key={i} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="rgba(var(--ov),.06)" vectorEffect="non-scaling-stroke"/>)}
            {prev.length > 1 && <path d={path(prev)} fill="none" stroke="rgba(var(--ink),.35)" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke"/>}
            {n > 1 && <path d={`${path(cur)}L${W},${H}L0,${H}Z`} fill="url(#ga-area)"/>}
            <path d={path(cur)} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="rgba(var(--ink),.3)" vectorEffect="non-scaling-stroke"/>}
          </svg>
          {hover !== null && (
            <>
              <span style={{ position: 'absolute', left: `${(x(hover) / W) * 100}%`, top: y(cur[hover]), width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: '50%', background: color, boxShadow: `0 0 0 3px ${T.bg}` }}/>
              <div role="status" style={{ position: 'absolute', top: 6, [hover > n / 2 ? 'right' : 'left']: `${hover > n / 2 ? 100 - (x(hover) / W) * 100 + 2 : (x(hover) / W) * 100 + 2}%`, background: T.tooltip, border: `1px solid ${T.s2Line}`, borderRadius: 10, padding: '8px 10px', fontSize: 12, color: T.text, boxShadow: T.shadow3, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2 }}>
                <div style={{ color: T.text3, marginBottom: 4 }}>{labels[hover]}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><i style={{ width: 8, height: 8, borderRadius: 2, background: color }}/><b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(cur[hover])}</b></div>
                {prev[hover] !== undefined && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: T.text2 }}><i style={{ width: 8, height: 2, background: 'rgba(var(--ink),.5)' }}/><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(prev[hover])}</span></div>}
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr)', gap: 8, marginTop: 6 }}>
        <span/>
        <div style={{ position: 'relative', height: 16 }}>
          {labels.map((l, i) => (i % every === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= every / 2) ? <span key={i} style={{ position: 'absolute', left: `${(x(i) / W) * 100}%`, transform: i === 0 ? 'none' : i === n - 1 ? 'translateX(-100%)' : 'translateX(-50%)', fontSize: 10.5, color: T.text3, whiteSpace: 'nowrap' }}>{l}</span> : null)}
        </div>
      </div>
    </div>
  )
}

function Heatmap({ rows, t, lang }) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
  rows.forEach(r => { const d = +r.dayOfWeek, h = +r.hour; if (d >= 0 && d < 7 && h >= 0 && h < 24) grid[d][h] += r.sessions || 0 })
  const max = Math.max(...grid.flat(), 1)
  return (
    <div style={{ overflowX: 'auto' }}>
      <div dir="ltr" style={{ minWidth: 560, display: 'grid', gridTemplateColumns: '34px repeat(24,minmax(0,1fr))', gap: 3, alignItems: 'center' }}>
        <span/>
        {Array.from({ length: 24 }, (_, h) => <span key={h} style={{ fontSize: 9.5, color: T.text3, textAlign: 'center' }}>{h % 3 === 0 ? String(h).padStart(2, '0') : ''}</span>)}
        {grid.map((row, d) => [
          <span key={`l${d}`} style={{ fontSize: 11, color: T.text2, textAlign: 'end', paddingInlineEnd: 4 }}>{t.dow[d]}</span>,
          ...row.map((v, h) => <span key={`${d}-${h}`} title={`${t.dow[d]} ${String(h).padStart(2, '0')}:00 · ${fmtN(v, lang)}`} style={{ height: 18, borderRadius: 4, background: v ? `rgba(132,144,216,${0.12 + (v / max) * 0.88})` : 'rgba(var(--ov),.035)' }}/>),
        ])}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginTop: 10, fontSize: 11, color: T.text3 }}>
        {t.less}{[0.15, 0.35, 0.6, 0.85, 1].map(a => <i key={a} style={{ width: 14, height: 10, borderRadius: 3, background: `rgba(132,144,216,${a})` }}/>)}{t.more}
      </div>
    </div>
  )
}

// ── Setup / error states ──────────────────────────────────────────────────────
function Setup({ t, property }) {
  const labels = { copy: t.copy, copied: t.copied, url: t.url }
  return (
    <Panel pad={22} style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(249,171,0,.14)', color: '#F9AB00', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FaKey size={17}/></span>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text }}>{t.setupTitle}</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13.5, color: T.text2, lineHeight: 1.6 }}>{t.setupSub}</p>
        </div>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {t.steps.map(([title, body, href, cta], i) => (
          <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: 'rgba(var(--ov),.025)', border: `1px solid ${T.divider}` }}>
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: T.brandSoft, color: T.brandText, fontSize: 12.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{title}</div>
              <div style={{ fontSize: 12.5, color: T.text3, marginTop: 3, lineHeight: 1.55 }}>{body}</div>
            </div>
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.s2Line}`, color: T.brandText, fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>{cta}<FaExternalLinkAlt size={9}/></a>
          </li>
        ))}
      </ol>
      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        <div><div style={{ fontSize: 12, color: T.text3, marginBottom: 5 }}>{t.envName}</div><CopyField value="GA4_SERVICE_ACCOUNT_JSON" labels={labels}/></div>
        <div><div style={{ fontSize: 12, color: T.text3, marginBottom: 5 }}>{t.propId}</div><CopyField value={property || '536943897'} labels={labels}/></div>
      </div>
      <p style={{ margin: '16px 0 0', fontSize: 12.5, color: T.text3, lineHeight: 1.6, paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>{t.smNote}</p>
    </Panel>
  )
}

function ErrorState({ t, err, onRetry }) {
  const msg = err?.error || ''
  const kind = /has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(msg) ? 'api' : err?.kind === 'permission' ? 'permission' : err?.kind === 'auth' ? 'auth' : err?.kind === 'property' ? 'property' : 'other'
  const why = kind === 'permission' ? t.why.permission(err?.serviceAccount) : t.why[kind]
  return (
    <Panel pad={22} style={{ maxWidth: 860 }}>
      <div role="alert" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: T.redSoft, color: T.redText, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FaChartLine size={17}/></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.text }}>{t.errTitle}</h3>
          <p style={{ margin: '6px 0 12px', fontSize: 13.5, color: T.text2, lineHeight: 1.6 }}>{why}</p>
          {msg && <code dir="ltr" style={{ display: 'block', fontSize: 11.5, color: T.text3, background: 'rgba(var(--shade),.08)', borderRadius: 8, padding: '8px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 12 }}>{msg}</code>}
          <Button variant="brand" icon={<FaSyncAlt size={11}/>} onClick={onRetry}>{t.retry}</Button>
        </div>
      </div>
    </Panel>
  )
}

// ── Realtime strip ────────────────────────────────────────────────────────────
function Realtime({ token, t, lang }) {
  const [rt, setRt] = useState(null)
  useEffect(() => {
    let dead = false
    const load = () => fetch('/api/meta/ga4?realtime=1', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (!dead && d?.configured) setRt(d) }).catch(() => {})
    load()
    const iv = setInterval(() => { if (!document.hidden) load() }, 60000)
    return () => { dead = true; clearInterval(iv) }
  }, [token])
  if (!rt) return null
  const devTotal = rt.devices.reduce((n, d) => n + d.activeUsers, 0) || 1
  return (
    <Panel pad={16}>
      <div className="ga-rt">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="ga-live" style={{ width: 10, height: 10, borderRadius: '50%', background: T.green, flexShrink: 0 }}/>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.green, letterSpacing: '.02em' }}>{t.rtTitle}</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: T.text, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{fmtN(rt.activeUsers, lang)}</div>
            <div style={{ fontSize: 11.5, color: T.text3 }}>{t.rtSub}</div>
          </div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 700, marginBottom: 6 }}>{t.rtPages}</div>
          {rt.pages.length ? rt.pages.slice(0, 4).map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '3px 0', color: T.text2, alignItems: 'baseline' }}>
              <span style={{ flex: '0 1 auto', minWidth: 0, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><bdi>{p.unifiedScreenName || '—'}</bdi></span>
              <b style={{ color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmtN(p.activeUsers, lang)}</b>
            </div>
          )) : <div style={{ fontSize: 12.5, color: T.text3 }}>{t.rtNone}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {rt.devices.map(d => (
            <div key={d.deviceCategory} style={{ flex: '1 1 90px', background: 'rgba(var(--ov),.03)', border: `1px solid ${T.divider}`, borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: 11.5, color: T.text3 }}>{t.dev[d.deviceCategory] || d.deviceCategory}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmtP(d.activeUsers / devTotal, lang, 0)}</div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
const RANGES = [7, 28, 90]
const METRICS = [
  { key: 'totalUsers', icon: FaUsers, color: '#8490D8' },
  { key: 'sessions', icon: FaMousePointer, color: '#60A5FA' },
  { key: 'screenPageViews', icon: FaEye, color: '#34D399' },
  { key: 'keyEvents', icon: FaBullseye, color: '#F9AB00' },
]
const DEV_ICON = { mobile: FaMobileAlt, desktop: FaDesktop, tablet: FaTabletAlt }
const DEV_COLOR = { mobile: '#8490D8', desktop: '#34D399', tablet: '#F9AB00' }

export default function GA4Tab({ token, lang = 'he' }) {
  const t = TR[lang] || TR.he
  const dir = lang === 'en' ? 'ltr' : 'rtl'
  const [days, setDays] = useState(() => { try { return Number(localStorage.getItem('ga4_days')) || 28 } catch { return 28 } })
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [loading, setLoading] = useState(true)
  const [metric, setMetric] = useState('totalUsers')
  const [, tick] = useState(0)

  const load = useCallback(async (fresh = false) => {
    setLoading(true); setErr(null)
    try {
      const r = await fetch(`/api/meta/ga4?days=${days}${fresh ? '&fresh=1' : ''}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(45000) })
      const d = await r.json().catch(() => ({ error: `HTTP ${r.status}` }))
      if (!r.ok || d.error) { setErr({ ...d, error: d.error || `HTTP ${r.status}` }); setData(d.configured === false ? d : null) }
      else setData(d)
    } catch (e) { setErr({ error: e?.message || 'Network error' }) }
    setLoading(false)
  }, [days, token])
  useEffect(() => { load() }, [load])
  useEffect(() => { try { localStorage.setItem('ga4_days', String(days)) } catch {} }, [days])
  useEffect(() => { const iv = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(iv) }, [])
  // Keep it fresh while the tab stays open (server caches for 5 minutes)
  useEffect(() => { const iv = setInterval(() => { if (!document.hidden) load() }, 5 * 60000); return () => clearInterval(iv) }, [load])

  const series = useMemo(() => {
    if (!data?.configured || !data.trend) return null
    const start = new Date(`${data.range.startDate}T00:00:00Z`)
    const n = data.days
    const curKeys = Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setUTCDate(d.getUTCDate() + i); return dayKey(d) })
    const prevKeys = Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setUTCDate(d.getUTCDate() - n + i); return dayKey(d) })
    const idx = {}
    data.trend.forEach(r => { idx[`${r.range || 'cur'}:${r.date}`] = r })
    const pick = (keys, rng, m) => keys.map(k => idx[`${rng}:${k}`]?.[m] || 0)
    const out = { labels: curKeys.map(k => ymd(k).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'short', timeZone: 'UTC' })) }
    for (const m of ['totalUsers', 'sessions', 'screenPageViews', 'keyEvents']) out[m] = { cur: pick(curKeys, 'cur', m), prev: pick(prevKeys, 'prev', m) }
    return out
  }, [data, lang])

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 260px', minWidth: 0 }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#F9AB00,#E37400)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 18px rgba(227,116,0,.25)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><rect x="16" y="3" width="5" height="18" rx="2.5" fill="#fff"/><rect x="9.5" y="9" width="5" height="12" rx="2.5" fill="#fff" opacity=".85"/><circle cx="5.5" cy="18.5" r="2.5" fill="#fff" opacity=".7"/></svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: T.text, letterSpacing: '-.01em' }}>{t.title}</h2>
          <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>{t.sub(data?.property || '536943897')}{data?.generatedAt && ` · ${t.updated(Math.floor((Date.now() - new Date(data.generatedAt)) / 60000))}`}</div>
        </div>
      </div>
      {data?.configured !== false && (
        <div className="ga-seg" role="group" aria-label={t.days('')} style={{ display: 'inline-flex', background: 'rgba(var(--ov),.04)', border: `1px solid ${T.s1Line}`, borderRadius: 10, padding: 3, gap: 2 }}>
          {RANGES.map(n => (
            <button key={n} type="button" onClick={() => setDays(n)} aria-pressed={days === n}
              style={{ height: 30, padding: '0 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: days === n ? T.brandSoft : 'transparent', color: days === n ? T.brandText : T.text3 }}>{t.days(n)}</button>
          ))}
        </div>
      )}
      {data?.configured !== false && <Button size="sm" icon={<FaSyncAlt size={10} className={loading ? 'au-spin' : ''}/>} onClick={() => load(true)} disabled={loading}>{t.refresh}</Button>}
      <a href={`https://analytics.google.com/analytics/web/#/p${data?.property || '536943897'}/reports/intelligenthome`} target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 30, padding: '0 12px', borderRadius: 9, border: '1px solid rgba(var(--ink),.18)', color: T.text2, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
        {t.openGa}<FaExternalLinkAlt size={9}/>
      </a>
    </div>
  )

  let body
  if (loading && !data) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-busy="true" aria-label={t.loading}>
        <div className="ga-kpi">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} h={112} r={14}/>)}</div>
        <Skeleton h={300} r={16}/>
        <div className="ga-2e"><Skeleton h={260} r={16}/><Skeleton h={260} r={16}/></div>
      </div>
    )
  } else if (data?.configured === false) {
    body = <Setup t={t} property={data.property}/>
  } else if (err && !data) {
    body = <ErrorState t={t} err={err} onRetry={() => load(true)}/>
  } else if (data) {
    const c = data.totals.cur || {}, p = data.totals.prev || {}
    const s = series
    const mDef = METRICS.find(m => m.key === metric)
    const devs = (data.devices || []).map(d => ({ ...d, color: DEV_COLOR[d.deviceCategory] || T.grey }))
    const devTotal = devs.reduce((n, d) => n + d.sessions, 0) || 1
    const aud = data.audience || []
    const nu = aud.find(a => a.newVsReturning === 'new')?.totalUsers || 0, ru = aud.find(a => a.newVsReturning === 'returning')?.totalUsers || 0
    const chName = n => t.ch[n] || n || '—'
    const evName = n => t.ev[n] || n
    const campaigns = (data.campaigns || []).filter(r => r.sessionCampaignName && !/^\((not set|direct|organic|referral)\)$/.test(r.sessionCampaignName))
    const kpis = [
      { key: 'totalUsers', icon: FaUsers, color: '#8490D8', v: fmtN(c.totalUsers, lang), d: delta(c.totalUsers, p.totalUsers), spark: s?.totalUsers.cur },
      { key: 'newUsers', icon: FaUserPlus, color: '#A78BFA', v: fmtN(c.newUsers, lang), d: delta(c.newUsers, p.newUsers) },
      { key: 'sessions', icon: FaMousePointer, color: '#60A5FA', v: fmtN(c.sessions, lang), d: delta(c.sessions, p.sessions), spark: s?.sessions.cur },
      { key: 'screenPageViews', icon: FaEye, color: '#34D399', v: fmtN(c.screenPageViews, lang), d: delta(c.screenPageViews, p.screenPageViews), spark: s?.screenPageViews.cur },
      { key: 'engagementRate', icon: FaHeartbeat, color: '#F472B6', v: fmtP(c.engagementRate, lang), d: delta(c.engagementRate, p.engagementRate) },
      { key: 'averageSessionDuration', icon: FaClock, color: '#22D3EE', v: fmtDur(c.averageSessionDuration), d: delta(c.averageSessionDuration, p.averageSessionDuration) },
      { key: 'keyEvents', icon: FaBullseye, color: '#F9AB00', v: fmtN(c.keyEvents, lang), d: delta(c.keyEvents, p.keyEvents), spark: s?.keyEvents.cur },
      { key: 'conv', icon: FaPercent, color: '#4ADE80', v: fmtP(conv(c), lang, 2), d: delta(conv(c), conv(p)) },
    ]
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
        {err && <div role="alert" style={{ fontSize: 12.5, color: T.redText }}>{err.error}</div>}
        <Realtime token={token} t={t} lang={lang}/>
        <div>
          <div className="ga-kpi">{kpis.map(k => <Kpi key={k.key} icon={k.icon} color={k.color} label={t.k[k.key]} value={k.v} d={k.d} spark={k.spark} lang={lang} hint={t.vsPrev(data.days)}/>)}</div>
          <div style={{ fontSize: 11.5, color: T.text3, marginTop: 8 }}>{t.vsPrev(data.days)}</div>
        </div>

        <Panel title={t.trend} icon={FaChartLine} right={
          <div className="ga-seg" role="group" aria-label={t.trend} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
            {METRICS.map(m => (
              <button key={m.key} type="button" onClick={() => setMetric(m.key)} aria-pressed={metric === m.key}
                style={{ height: 28, padding: '0 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, border: `1px solid ${metric === m.key ? m.color : T.s1Line}`, background: metric === m.key ? `${m.color}1f` : 'transparent', color: metric === m.key ? T.text : T.text3 }}>{t.k[m.key]}</button>
            ))}
          </div>
        }>
          {s && <TrendChart cur={s[metric].cur} prev={s[metric].prev} labels={s.labels} lang={lang} fmt={v => fmtN(v, lang)} color={mDef.color}/>}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11.5, color: T.text3 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: mDef.color }}/>{t.curLine}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 14, height: 0, borderTop: '2px dashed rgba(var(--ink),.5)' }}/>{t.prevLine}</span>
          </div>
        </Panel>

        <div className="ga-2">
          <Panel title={t.channels} sub={t.channelsSub} icon={FaRoute}>
            <BarList rows={data.channels} label={r => chName(r.sessionDefaultChannelGroup)} value={r => r.sessions} fmt={v => fmtN(v, lang)} lang={lang} emptyText={t.empty}
              extra={r => (r.keyEvents ? `${fmtN(r.keyEvents, lang)} ${t.colConv}` : fmtP(r.engagementRate, lang, 0))}/>
          </Panel>
          <Panel title={t.devices} icon={FaDesktop}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <Donut parts={devs.map(d => ({ value: d.sessions, color: d.color }))} center={<><b style={{ fontSize: 20, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmtC(devTotal === 1 && !devs.length ? 0 : devTotal, lang)}</b><span style={{ fontSize: 11, color: T.text3 }}>{t.colSessions}</span></>}/>
              <div style={{ flex: 1, minWidth: 150, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {devs.length ? devs.map(d => { const Ic = DEV_ICON[d.deviceCategory] || FaDesktop; return (
                  <div key={d.deviceCategory} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: `${d.color}22`, color: d.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={12}/></span>
                    <span style={{ flex: 1, fontSize: 13, color: T.text }}>{t.dev[d.deviceCategory] || d.deviceCategory}</span>
                    <b style={{ fontSize: 13, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{fmtP(d.sessions / devTotal, lang, 0)}</b>
                  </div>) }) : <span style={{ fontSize: 13, color: T.text3 }}>{t.empty}</span>}
              </div>
            </div>
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${T.divider}` }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2, marginBottom: 8 }}>{t.audience}</div>
              <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: 'rgba(var(--ov),.06)' }}>
                <span style={{ width: `${(nu / ((nu + ru) || 1)) * 100}%`, background: '#8490D8' }}/>
                <span style={{ width: `${(ru / ((nu + ru) || 1)) * 100}%`, background: '#34D399' }}/>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: T.text2 }}>
                <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#8490D8', marginInlineEnd: 6 }}/>{t.newU} · <b style={{ color: T.text }}>{fmtN(nu, lang)}</b></span>
                <span><i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#34D399', marginInlineEnd: 6 }}/>{t.retU} · <b style={{ color: T.text }}>{fmtN(ru, lang)}</b></span>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title={t.pages} icon={FaFileAlt}>
          <Table emptyText={t.empty} rows={(data.pages || []).slice(0, 15)} cols={[
            { label: '#', w: '26px', render: (_, i) => <span style={{ color: T.text3 }}>{i + 1}</span> },
            { label: t.pages, w: 'minmax(0,3fr)', render: r => (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><bdi>{r.pageTitle || r.pagePath}</bdi></div>
                <div style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}><a href={`https://www.afikhanahal.co.il${r.pagePath}`} target="_blank" rel="noopener noreferrer" dir="ltr" style={{ color: T.text3, textDecoration: 'none', unicodeBidi: 'isolate' }}>{decodeURIComponent(r.pagePath || '')}</a></div>
              </div>) },
            { label: t.colViews, num: true, strong: true, render: r => fmtN(r.screenPageViews, lang) },
            { label: t.colUsers, num: true, render: r => fmtN(r.totalUsers, lang) },
            { label: t.colTime, num: true, hideM: true, render: r => fmtDur(r.totalUsers ? r.userEngagementDuration / r.totalUsers : 0) },
            { label: t.colConv, num: true, hideM: true, render: r => (r.keyEvents ? <span style={{ color: '#F9AB00', fontWeight: 800 }}>{fmtN(r.keyEvents, lang)}</span> : <span style={{ color: T.text3 }}>—</span>) },
          ]}/>
        </Panel>

        <div className="ga-2e">
          <Panel title={t.landing} icon={FaSignInAlt}>
            <BarList rows={data.landing || []} label={r => decodeURIComponent(r.landingPage || '') || '/'} value={r => r.sessions} fmt={v => fmtN(v, lang)} lang={lang} emptyText={t.empty} max={10} color="#60A5FA"
              extra={r => fmtP(r.engagementRate, lang, 0)}/>
          </Panel>
          <Panel title={t.sources} icon={FaRoute}>
            <BarList rows={data.sources || []} label={r => r.sessionSourceMedium} value={r => r.sessions} fmt={v => fmtN(v, lang)} lang={lang} emptyText={t.empty} max={10} color="#34D399"
              extra={r => (r.keyEvents ? `${fmtN(r.keyEvents, lang)} ${t.colConv}` : '')}/>
          </Panel>
        </div>

        <div className="ga-2e">
          <Panel title={t.cities} icon={FaMapMarkerAlt}>
            <BarList rows={(data.cities || []).filter(r => r.city && r.city !== '(not set)')} label={r => r.city} value={r => r.totalUsers} fmt={v => fmtN(v, lang)} lang={lang} emptyText={t.empty} max={10} color="#F472B6"/>
            {(data.countries || []).length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {data.countries.slice(0, 6).map(r => <Badge key={r.country} color={T.grey} textColor={T.text2}>{r.country} · {fmtN(r.totalUsers, lang)}</Badge>)}
              </div>
            )}
          </Panel>
          <Panel title={t.events} icon={FaBolt}>
            <Table emptyText={t.empty} rows={(data.events || []).slice(0, 12)} cols={[
              { label: t.events, w: 'minmax(0,2.2fr)', render: r => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ flexShrink: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evName(r.eventName)}</span>
                  {r.keyEvents > 0 && <span style={{ flexShrink: 0 }}><Badge color="#F9AB00"><FaCheckCircle size={8}/>{t.key}</Badge></span>}
                  {t.ev[r.eventName] && <code className="ga-hide-m" dir="ltr" style={{ fontSize: 10.5, color: T.text3, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', unicodeBidi: 'isolate' }}>{r.eventName}</code>}
                </div>) },
              { label: t.colCount, num: true, strong: true, render: r => fmtN(r.eventCount, lang) },
              { label: t.colUsers, num: true, render: r => fmtN(r.totalUsers, lang) },
            ]}/>
          </Panel>
        </div>

        <Panel title={t.heat} sub={t.heatSub} icon={FaClock}><Heatmap rows={data.heat || []} t={t} lang={lang}/></Panel>

        {campaigns.length > 0 && (
          <Panel title={t.campaigns} icon={FaBullhorn}>
            <Table emptyText={t.empty} rows={campaigns} cols={[
              { label: t.campaigns, w: 'minmax(0,2.5fr)', render: r => <bdi>{r.sessionCampaignName}</bdi> },
              { label: t.colSessions, num: true, strong: true, render: r => fmtN(r.sessions, lang) },
              { label: t.colUsers, num: true, render: r => fmtN(r.totalUsers, lang) },
              { label: t.colConv, num: true, render: r => fmtN(r.keyEvents, lang) },
            ]}/>
          </Panel>
        )}
      </div>
    )
  }

  return (
    <div className="ga au" dir={dir} style={{ display: 'flex', flexDirection: 'column', gap: 16, color: T.text }}>
      <style>{AUTO_CSS}{CSS}</style>
      {header}
      {body}
    </div>
  )
}
