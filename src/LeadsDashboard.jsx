// Leads overview ("תמונת מצב") — a manager's dashboard over the CRM leads.
// One filter row (period presets / custom range, source, campaign) scopes everything below it:
//   • "Leads created": last week / month / 3 months / 6 months / year, each against the period before it
//   • KPIs for the period: new leads, contact rate, median first response, interested+, won + win rate, waiting now
//   • Leads over time (stacked by source, with a hover tooltip and a table view)
//   • The funnel: how many reached each stage (cumulative), step-to-step conversion, where they are now; exits
//   • Campaign performance, open-lead aging + follow-ups, when leads arrive (weekday × hour)
//   • Drill-down: click a stage / bucket / campaign and its leads open below
// Colours: the source series use the validated categorical slots (blue / orange / aqua); the funnel is an ordinal
// single-hue ramp (validated light + dark); status colours only where the colour means good / bad.
import { useMemo, useState, useRef } from 'react'
import { Phone, MessageSquare, ExternalLink, AlertCircle, Clock, CalendarClock, ArrowUpRight, ArrowDownRight, Minus, Table2, BarChart3 } from 'lucide-react'
import { leadCampaign, prettyLeadText } from './lib/leadFields.js'
import DateTimePicker from './DateTimePicker.jsx'

const FUNNEL = ['new', 'contacted', 'discovery', 'meeting', 'negotiating', 'won']
const OUTCOMES = ['lost', 'irrelevant', 'nurture']
const OPEN = ['new', 'contacted', 'discovery', 'meeting', 'negotiating']
const DAY = 864e5, HOUR = 36e5
const PALETTE = {
  light: { series: ['#2a78d6', '#eb6834', '#1baf7a'], ramp: ['#8db4e8', '#6198dd', '#3d7fd3', '#2667b8', '#1a4d8f'], good: '#0F8A4F', bad: '#D63B3B', warn: '#B86E00' },
  dark: { series: ['#3987e5', '#d95926', '#199e70'], ramp: ['#1d4f8f', '#2a6cc0', '#3987e5', '#6ea7ee', '#a4c8f5'], good: '#3DCB82', bad: '#F07070', warn: '#E9A23B' },
}
const PRESETS = [['7', 7], ['30', 30], ['90', 90], ['180', 182], ['365', 365], ['all', 0]]
const asNotes = n => (Array.isArray(n) ? n : typeof n === 'string' && n.trim() ? [{ text: n, ts: 0 }] : [])
const stageOf = l => l.leadStatus || 'new'
const srcKey = l => { const s = l.source || (String(l.id || '').startsWith('meta_') ? 'meta' : 'website'); return s === 'meta' ? 'meta' : ['website', 'contact_form', 'property_form', 'pdf_download'].includes(s) ? 'site' : 'other' }
const reachedIdx = l => {
  let m = FUNNEL.indexOf(stageOf(l))
  for (const x of Array.isArray(l.stageLog) ? l.stageLog : []) m = Math.max(m, FUNNEL.indexOf(x?.to), FUNNEL.indexOf(x?.from))
  if (OUTCOMES.includes(stageOf(l)) && m < 1 && firstTouch(l)) m = 1      // a lead that was answered and closed off was contacted
  return m
}
// the first human touch: a note / call written by the team, or the first stage move (automatic WhatsApp doesn't count)
const firstTouch = l => {
  const ts = []
  for (const n of asNotes(l.notes)) if (n?.ts && !/^🔗/.test(n.text || '')) ts.push(Number(n.ts))
  for (const x of Array.isArray(l.stageLog) ? l.stageLog : []) if (x?.at) ts.push(Number(x.at) || Date.parse(x.at))
  if (l.lastCallAt) ts.push(Number(l.lastCallAt))
  const f = ts.filter(x => x && x >= (l.ts || 0) - 60e3)
  return f.length ? Math.min(...f) : 0
}
const lastActivity = l => {
  const ts = [l.ts || 0]
  for (const n of asNotes(l.notes)) if (n?.ts) ts.push(Number(n.ts))
  for (const x of Array.isArray(l.stageLog) ? l.stageLog : []) if (x?.at) ts.push(Number(x.at) || Date.parse(x.at))
  return Math.max(...ts.filter(Boolean))
}
const enteredAt = l => {
  const log = Array.isArray(l.stageLog) ? l.stageLog : []
  for (let i = log.length - 1; i >= 0; i--) if (log[i]?.to === stageOf(l)) return Number(log[i].at) || Date.parse(log[i].at) || l.ts || 0
  return l.ts || 0
}
const lastNote = l => asNotes(l.notes).filter(n => n.text).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || null
const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const pctOf = (a, b) => (b ? Math.round((a / b) * 100) : 0)
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
const toInput = t => { const d = new Date(t); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) }

// `leads` is the whole list: the board's search box doesn't narrow the dashboard (it used to, silently — every number read 1)
export default function LeadsDashboard({ leads = [], search = '', onClearSearch, stages = [], T, isDark, lang = 'he', onOpen, onOpenChat }) {
  const en = lang === 'en'
  const L = (he, e) => (en ? e : he)
  const P = isDark ? PALETTE.dark : PALETTE.light
  const C = isDark
    ? { page: '#0F1420', card: '#161D2B', line: '#263042', line2: '#1E2636', text: '#E8ECF6', text2: '#A9B3CA', text3: '#7D88A3', chip: '#1E2738', hover: '#1B2333' }
    : { page: '#F5F6FA', card: '#FFFFFF', line: '#E3E7EF', line2: '#EEF1F6', text: '#1F2433', text2: '#5A6275', text3: '#8A92A6', chip: '#F1F3F8', hover: '#F6F8FC' }
  const st = id => stages.find(g => g.id === id) || { id, label: id, en: id, color: '#7D7D7D' }
  const stName = id => (en ? st(id).en : st(id).label)
  const now = Date.now()

  // ── filters (one row, above everything) ─────────────────────────────────────
  const [preset, setPreset] = useState('30')
  const [from, setFrom] = useState(toInput(now - 30 * DAY)), [to, setTo] = useState(toInput(now))
  const [src, setSrc] = useState('all')
  const [camp, setCamp] = useState('')
  const [drill, setDrill] = useState({ kind: 'stage', key: 'new', label: '' })
  const [sort, setSort] = useState('oldest')
  const [trendTable, setTrendTable] = useState(false)
  const [tip, setTip] = useState(null)
  const drillRef = useRef(null)

  const range = useMemo(() => {
    if (preset === 'custom') { const a = Date.parse(from), b = Date.parse(to) + DAY - 1; return a && b && b > a ? [a, b] : [0, now] }
    const days = (PRESETS.find(p => p[0] === preset) || [0, 30])[1]
    return days ? [startOfDay(now - (days - 1) * DAY), now] : [0, now]
  }, [preset, from, to]) // eslint-disable-line
  const span = range[1] - range[0]
  // the first lead in the system: a previous period that starts before it has no data to compare with (not "0 → +100%")
  const oldest = useMemo(() => leads.reduce((m, l) => (l.ts && l.ts < m ? l.ts : m), now), [leads]) // eslint-disable-line
  const hasPrev = range[0] > 0 && range[0] - span >= startOfDay(oldest)

  const base = useMemo(() => leads.filter(l => (src === 'all' || srcKey(l) === src) && (!camp || (leadCampaign(l, lang) || '—') === camp)), [leads, src, camp, lang])
  const inRange = (l, a, b) => (l.ts || 0) >= a && (l.ts || 0) <= b
  const cur = useMemo(() => base.filter(l => inRange(l, range[0], range[1])), [base, range])
  const prev = useMemo(() => (hasPrev ? base.filter(l => inRange(l, range[0] - span - 1, range[0] - 1)) : []), [base, range, span, hasPrev])
  const campaigns = useMemo(() => [...new Set(leads.map(l => leadCampaign(l, lang) || '—'))].sort((a, b) => a.localeCompare(b, 'he')), [leads, lang])

  // ── numbers ─────────────────────────────────────────────────────────────────
  const stats = set => {
    const n = set.length
    const touched = set.filter(l => firstTouch(l) || reachedIdx(l) >= 1)
    const resp = set.map(l => { const f = firstTouch(l); return f ? f - (l.ts || f) : null }).filter(x => x != null && x >= 0)
    const reached = FUNNEL.map((_, i) => set.filter(l => reachedIdx(l) >= i).length)
    const won = set.filter(l => stageOf(l) === 'won').length
    const closedOff = set.filter(l => ['lost', 'irrelevant'].includes(stageOf(l))).length
    return { n, contactRate: pctOf(touched.length, n), resp: median(resp), interested: pctOf(reached[2], n), won, winRate: pctOf(won, won + closedOff), reached }
  }
  const S = useMemo(() => stats(cur), [cur]) // eslint-disable-line
  const SP = useMemo(() => (hasPrev ? stats(prev) : null), [prev, hasPrev]) // eslint-disable-line
  const waiting = base.filter(l => stageOf(l) === 'new' && !firstTouch(l) && now - (l.ts || 0) > DAY).length

  const created = [[7, L('בשבוע האחרון', 'Last 7 days')], [30, L('בחודש האחרון', 'Last 30 days')], [90, L('ב-3 חודשים', 'Last 3 months')], [182, L('בחצי שנה', 'Last 6 months')], [365, L('בשנה האחרונה', 'Last 12 months')]]
    .map(([d, label]) => {
      const a = now - d * DAY, n = base.filter(l => (l.ts || 0) >= a).length
      const p = a - d * DAY >= startOfDay(oldest) ? base.filter(l => (l.ts || 0) >= a - d * DAY && (l.ts || 0) < a).length : null
      return { d, label, n, p }
    })

  // ── over time ───────────────────────────────────────────────────────────────
  const trend = useMemo(() => {
    const a = range[0] || Math.min(...cur.map(l => l.ts || now), now - 90 * DAY)
    const days = (range[1] - a) / DAY
    const unit = days <= 31 ? 'day' : days <= 200 ? 'week' : 'month'
    const keyOf = t => {
      const d = new Date(t)
      if (unit === 'day') return startOfDay(t)
      if (unit === 'week') { const s = startOfDay(t); return s - new Date(s).getDay() * DAY }   // week starts on Sunday
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    }
    const buckets = []
    for (let k = keyOf(a); k <= range[1]; ) {
      buckets.push({ k, meta: 0, site: 0, other: 0 })
      const d = new Date(k)
      k = unit === 'day' ? k + DAY : unit === 'week' ? k + 7 * DAY : new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    }
    const idx = new Map(buckets.map((b, i) => [b.k, i]))
    for (const l of cur) { const i = idx.get(keyOf(l.ts || 0)); if (i != null) buckets[i][srcKey(l)]++ }
    return { unit, buckets: buckets.slice(-60) }
  }, [cur, range]) // eslint-disable-line
  const tMax = Math.max(1, ...trend.buckets.map(b => b.meta + b.site + b.other))
  const niceMax = (() => { const p = 10 ** Math.floor(Math.log10(tMax)); return Math.ceil(tMax / p) * p })()
  const bucketLabel = k => {
    const d = new Date(k)
    if (trend.unit === 'month') return d.toLocaleDateString(en ? 'en-GB' : 'he-IL', { month: 'short', year: '2-digit' })
    return `${d.getDate()}/${d.getMonth() + 1}`
  }
  const SRC = [['meta', L('פייסבוק / אינסטגרם', 'Facebook / Instagram'), 0], ['site', L('אתר', 'Website'), 1], ['other', L('אחר', 'Other'), 2]]
  const srcTotals = Object.fromEntries(SRC.map(([k]) => [k, cur.filter(l => srcKey(l) === k).length]))

  // ── campaigns, aging, follow-ups, arrival heat ─────────────────────────────
  const campRows = useMemo(() => {
    const m = {}
    for (const l of cur) {
      const c = leadCampaign(l, lang) || '—'
      const r = m[c] || (m[c] = { name: c, n: 0, touched: 0, interested: 0, won: 0, waiting: 0, resp: [] })
      r.n++
      const f = firstTouch(l)
      if (f || reachedIdx(l) >= 1) r.touched++
      if (reachedIdx(l) >= 2) r.interested++
      if (stageOf(l) === 'won') r.won++
      if (stageOf(l) === 'new' && !f) r.waiting++
      if (f) r.resp.push(f - (l.ts || f))
    }
    return Object.values(m).sort((a, b) => b.n - a.n)
  }, [cur, lang]) // eslint-disable-line
  const open = base.filter(l => OPEN.includes(stageOf(l)))
  const AGE = [[0, 2, L('עד יומיים', '0–2 days')], [2, 7, L('3–7 ימים', '3–7 days')], [7, 30, L('8–30 ימים', '8–30 days')], [30, 1e9, L('מעל חודש', '30+ days')]]
  const aging = AGE.map(([a, b, label], i) => ({ i, label, list: open.filter(l => { const d = (now - lastActivity(l)) / DAY; return d >= a && d < b }) }))
  const eod = startOfDay(now) + DAY - 1
  const fu = { overdue: base.filter(l => { const f = Date.parse(l.followUp || ''); return f && f < startOfDay(now) && !['won', 'irrelevant'].includes(stageOf(l)) }),
    today: base.filter(l => { const f = Date.parse(l.followUp || ''); return f && f >= startOfDay(now) && f <= eod }),
    week: base.filter(l => { const f = Date.parse(l.followUp || ''); return f && f > eod && f <= eod + 7 * DAY }) }
  const HOURS = [[0, 9, '00–09'], [9, 12, '09–12'], [12, 15, '12–15'], [15, 18, '15–18'], [18, 21, '18–21'], [21, 24, '21–24']]
  const DAYS = en ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
  const heat = useMemo(() => {
    const g = DAYS.map(() => HOURS.map(() => 0))
    for (const l of cur) { const d = new Date(l.ts || 0), h = d.getHours(); const j = HOURS.findIndex(([a, b]) => h >= a && h < b); if (j >= 0) g[d.getDay()][j]++ }
    return g
  }, [cur]) // eslint-disable-line
  const heatMax = Math.max(1, ...heat.flat())

  // ── drill-down ──────────────────────────────────────────────────────────────
  const openDrill = (kind, key, label = '') => { setDrill({ kind, key, label }); setTimeout(() => drillRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30) }
  const drillList = useMemo(() => {
    let xs
    if (drill.kind === 'stage') xs = base.filter(l => stageOf(l) === drill.key)
    else if (drill.kind === 'aging') xs = aging[drill.key]?.list || []
    else if (drill.kind === 'fu') xs = fu[drill.key] || []
    else if (drill.kind === 'waiting') xs = base.filter(l => stageOf(l) === 'new' && !firstTouch(l) && now - (l.ts || 0) > DAY)
    else if (drill.kind === 'camp') xs = cur.filter(l => (leadCampaign(l, lang) || '—') === drill.key)
    else xs = []
    const rows = xs.map(l => ({ l, at: drill.kind === 'stage' ? enteredAt(l) : lastActivity(l), note: lastNote(l), f: Date.parse(l.followUp || '') || 0 }))
    if (sort === 'oldest') rows.sort((a, b) => a.at - b.at)
    else if (sort === 'newest') rows.sort((a, b) => b.at - a.at)
    else rows.sort((a, b) => (a.f || Infinity) - (b.f || Infinity))
    return rows
  }, [drill, base, cur, sort, lang]) // eslint-disable-line
  const drillTitle = drill.kind === 'stage' ? stName(drill.key) : drill.label
  const drillColor = drill.kind === 'stage' ? st(drill.key).color : P.series[0]

  // ── pieces ──────────────────────────────────────────────────────────────────
  const fmtResp = ms => (ms == null ? '—' : ms < HOUR ? L(`${Math.max(1, Math.round(ms / 6e4))} דק׳`, `${Math.max(1, Math.round(ms / 6e4))} min`) : ms < DAY ? L(`${(ms / HOUR).toFixed(1)} שע׳`, `${(ms / HOUR).toFixed(1)} h`) : L(`${(ms / DAY).toFixed(1)} ימים`, `${(ms / DAY).toFixed(1)} days`))
  const fmtD = t => new Date(t).toLocaleDateString(en ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'short' })
  const days = ms => { const d = Math.floor(ms / DAY); return d <= 0 ? L('היום', 'today') : d === 1 ? L('יום', '1 day') : L(`${d} ימים`, `${d} days`) }
  // a change against the previous period: arrow + word, never colour alone; `lowerIsBetter` flips the meaning
  const Delta = ({ now: a, before: b, unit = '%', lowerIsBetter, always }) => {
    if (b == null || a == null || (!hasPrev && !always)) return null
    // from nothing a percentage means nothing: say "+N" instead of "+100%"
    if (unit === '%' && !b && a) return <span title={L('לעומת התקופה הקודמת', 'vs. the previous period')} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11.5, fontWeight: 700, color: lowerIsBetter ? P.bad : P.good }}><ArrowUpRight size={13}/>+{Math.round(a).toLocaleString()}</span>
    const diff = unit === '%' ? (b ? Math.round(((a - b) / b) * 100) : 0) : Math.round(a - b)
    if (!diff) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: C.text3 }}><Minus size={12}/>{L('ללא שינוי', 'no change')}</span>
    const up = diff > 0, good = lowerIsBetter ? !up : up
    return (
      <span title={L('לעומת התקופה הקודמת', 'vs. the previous period')} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11.5, fontWeight: 700, color: good ? P.good : P.bad }}>
        {up ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}{Math.abs(diff)}{unit === '%' ? '%' : unit}
      </span>
    )
  }
  const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12 }
  const H = ({ children, sub, right }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text }}>{children}</h3>
      {sub && <span style={{ fontSize: 12, color: C.text3 }}>{sub}</span>}
      {right && <span style={{ marginInlineStart: 'auto' }}>{right}</span>}
    </div>
  )
  const seg = (on) => ({ height: 30, padding: '0 12px', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 500, background: on ? C.card : 'transparent', color: on ? C.text : C.text2, boxShadow: on ? `0 1px 2px rgba(0,0,0,${isDark ? .4 : .08}), 0 0 0 1px ${C.line}` : 'none' })
  const kpis = [
    { label: L('לידים חדשים', 'New leads'), value: S.n.toLocaleString(), delta: <Delta now={S.n} before={SP?.n}/>, hint: L('נכנסו בתקופה', 'created in the period') },
    { label: L('שיעור יצירת קשר', 'Contact rate'), value: `${S.contactRate}%`, delta: <Delta now={S.contactRate} before={SP?.contactRate} unit={L(" נק׳", " pts")}/>, hint: L('לידים שדיברו איתם או התקדמו', 'leads called, noted or moved') },
    { label: L('זמן תגובה (חציון)', 'First response (median)'), value: fmtResp(S.resp), delta: SP?.resp != null && S.resp != null ? <Delta now={S.resp} before={SP.resp} lowerIsBetter/> : null, hint: L('מהכניסה ועד הטיפול הראשון', 'from arrival to first touch') },
    { label: L('מתעניינים ומעלה', 'Interested or further'), value: `${S.interested}%`, delta: <Delta now={S.interested} before={SP?.interested} unit={L(" נק׳", " pts")}/>, hint: L('הגיעו לשלב "מתעניין" או מעבר', 'reached "interested" or beyond') },
    { label: L('סגירות', 'Won'), value: S.won.toLocaleString(), delta: <Delta now={S.won} before={SP?.won}/>, hint: L(`אחוז סגירה ${S.winRate}% מהעסקאות שהוכרעו`, `win rate ${S.winRate}% of decided deals`) },
    { label: L('ממתינים לטיפול', 'Waiting for a first touch'), value: waiting.toLocaleString(), hint: L('חדשים, יותר מ-24 שעות בלי מגע', 'new, over 24 h untouched'), alert: waiting > 0, go: () => openDrill('waiting', 'waiting', L('ממתינים לטיפול', 'Waiting for a first touch')) },
  ]
  const periodLabel = preset === 'all' ? L('כל הזמן', 'All time') : preset === 'custom' ? `${fmtD(range[0])} – ${fmtD(range[1])}` : L(`${(PRESETS.find(p => p[0] === preset) || [])[1]} הימים האחרונים`, `Last ${(PRESETS.find(p => p[0] === preset) || [])[1]} days`)

  return (
    <div className="ld" style={{ padding: '16px 20px 48px', direction: en ? 'ltr' : 'rtl', background: C.page, minHeight: '100%', color: C.text, WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', fontFeatureSettings: '"tnum"' }}>
      <style>{`
        .ld *{box-sizing:border-box}
        .ld-6{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
        .ld-5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0}
        .ld-2{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}
        .ld-click{cursor:pointer;transition:background .15s, box-shadow .15s}
        .ld-click:hover{background:${C.hover}}
        .ld-click:focus-visible,.ld button:focus-visible{outline:2px solid ${P.series[0]};outline-offset:2px}
        .ld-row:hover{background:${C.hover}}
        @media (max-width:1280px){.ld-6{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media (max-width:1100px){.ld-2{grid-template-columns:1fr}}
        @media (max-width:760px){.ld-6{grid-template-columns:repeat(2,minmax(0,1fr))}.ld-5{grid-template-columns:repeat(2,minmax(0,1fr))}.ld-item{grid-template-columns:minmax(0,1fr) auto!important;row-gap:4px!important}.ld-note,.ld-when{grid-column:1/-1}.ld-acts{grid-row:1;grid-column:2}.ld-seg{max-width:100%;overflow-x:auto;scrollbar-width:none}.ld-seg button{white-space:nowrap}.ld-fun{grid-template-columns:78px minmax(0,1fr) 58px!important;gap:6px!important}.ld-step{padding-inline-start:90px!important}.ld .ld-out{gap:6px!important}.ld-out button{padding:8px!important}}
      `}</style>

      {/* Filters — one row, scoping everything below */}
      <div role="group" aria-label={L('סינון', 'Filters')} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div role="radiogroup" className="ld-seg" aria-label={L('תקופה', 'Period')} style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 9, background: C.chip, border: `1px solid ${C.line}` }}>
          {[['7', L('שבוע', 'Week')], ['30', L('חודש', 'Month')], ['90', L('3 חודשים', '3 months')], ['180', L('חצי שנה', '6 months')], ['365', L('שנה', 'Year')], ['all', L('הכול', 'All')], ['custom', L('טווח…', 'Range…')]].map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={preset === k} onClick={() => setPreset(k)} style={seg(preset === k)}>{l}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.text2 }}>
            <DateTimePicker value={from} onChange={v => v && setFrom(v)} format="date" max={to} lang={lang} size="sm" clearable={false} label={L('מתאריך', 'From')}/>
            –
            <DateTimePicker value={to} onChange={v => v && setTo(v)} format="date" min={from} lang={lang} size="sm" clearable={false} label={L('עד תאריך', 'To')}/>
          </span>
        )}
        <select value={src} onChange={e => setSrc(e.target.value)} aria-label={L('מקור', 'Source')} style={{ height: 36, borderRadius: 9, border: `1px solid ${C.line}`, background: C.card, color: C.text, padding: '0 10px', fontFamily: 'inherit', fontSize: 13 }}>
          <option value="all">{L('כל המקורות', 'All sources')}</option>
          <option value="meta">{L('פייסבוק / אינסטגרם', 'Facebook / Instagram')}</option>
          <option value="site">{L('אתר', 'Website')}</option>
          <option value="other">{L('אחר', 'Other')}</option>
        </select>
        <select value={camp} onChange={e => setCamp(e.target.value)} aria-label={L('קמפיין', 'Campaign')} style={{ height: 36, borderRadius: 9, border: `1px solid ${C.line}`, background: C.card, color: C.text, padding: '0 10px', fontFamily: 'inherit', fontSize: 13, maxWidth: 220 }}>
          <option value="">{L('כל הקמפיינים', 'All campaigns')}</option>
          {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {search && (
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 8, background: C.chip, border: `1px solid ${C.line}`, fontSize: 12, color: C.text2 }}>
            {L(`החיפוש "${search}" חל על הטבלה וה-Pipeline, לא על תמונת המצב`, `The search "${search}" applies to the table and Pipeline, not to this dashboard`)}
            {onClearSearch && <button type="button" onClick={onClearSearch} style={{ border: 'none', background: 'transparent', color: P.series[0], fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0 }}>{L('נקה חיפוש', 'Clear')}</button>}
          </span>
        )}
        <span style={{ fontSize: 12.5, color: C.text3, marginInlineStart: 'auto' }}>{periodLabel}{hasPrev ? ` · ${L('השוואה לתקופה הקודמת', 'compared with the previous period')}` : preset !== 'all' ? ` · ${L('אין נתונים לתקופה הקודמת', 'no data for the previous period')}` : ''}</span>
      </div>

      {/* Leads created */}
      <section style={{ ...card, marginBottom: 14 }} aria-label={L('לידים שנוצרו', 'Leads created')}>
        <div style={{ padding: '12px 18px 0', fontSize: 13, fontWeight: 700, color: C.text2 }}>{L('לידים שנוצרו', 'Leads created')}</div>
        <div className="ld-5">
          {created.map((c, i) => (
            <div key={c.d} style={{ padding: '8px 18px 14px', borderInlineStart: i ? `1px solid ${C.line2}` : 'none' }}>
              <div style={{ fontSize: 12, color: C.text3 }}>{c.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.01em' }}>{c.n.toLocaleString()}</span>
                <Delta now={c.n} before={c.p} always/>
              </div>
              <div style={{ fontSize: 11, color: C.text3 }}>{c.p == null ? L('אין נתונים לתקופה שלפני', 'no data for the period before') : L(`ב-${c.d} הימים שלפני: ${c.p}`, `the ${c.d} days before: ${c.p}`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* KPIs for the period */}
      <div className="ld-6" style={{ marginBottom: 14 }}>
        {kpis.map(k => {
          const Tag = k.go ? 'button' : 'div'
          return (
            <Tag key={k.label} type={k.go ? 'button' : undefined} onClick={k.go} className={k.go ? 'ld-click' : undefined}
              style={{ ...card, padding: '14px 16px', textAlign: 'start', fontFamily: 'inherit', color: C.text, borderTop: `3px solid ${k.alert ? P.warn : P.series[0]}` }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text2 }}>{k.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.15 }}>{k.value}</span>
                {k.delta}
              </div>
              <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>{k.hint}</div>
            </Tag>
          )
        })}
      </div>

      <div className="ld-2">
        {/* Funnel */}
        <section style={{ ...card, padding: 18 }} aria-label={L('משפך', 'Funnel')}>
          <H sub={L('כמה לידים מהתקופה הגיעו לכל שלב, ואחוז המעבר משלב לשלב', 'How many of the period\'s leads reached each stage, and the step-to-step conversion')}>{L('משפך המכירה', 'Sales funnel')}</H>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {FUNNEL.map((k, i) => {
              const n = S.reached[i], nowIn = cur.filter(l => stageOf(l) === k).length
              const w = S.n ? Math.max(3, (n / S.n) * 84) : 3 // ≤ 84% of the track: the count always fits after the bar
              const step = i ? pctOf(n, S.reached[i - 1]) : null
              return (
                <div key={k}>
                  {i > 0 && <div className="ld-step" style={{ fontSize: 11, color: C.text3, padding: '0 0 2px', paddingInlineStart: 128 }}>↓ {L(`${step}% עברו הלאה`, `${step}% moved on`)}</div>}
                  <button type="button" className="ld-click ld-fun" onClick={() => openDrill('stage', k)} aria-label={`${stName(k)}: ${n}`}
                    style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr) 96px', alignItems: 'center', gap: 10, width: '100%', background: 'transparent', border: 'none', borderRadius: 8, padding: '4px 6px', fontFamily: 'inherit', color: C.text, textAlign: 'start' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: st(k).color, flexShrink: 0 }}/>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stName(k)}</span>
                    </span>
                    <span style={{ position: 'relative', height: 26, background: C.line2, borderRadius: 4 }}>
                      <span style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${w}%`, background: P.ramp[i], borderRadius: 4 }}/>
                      <span style={{ position: 'absolute', insetInlineStart: `calc(${w}% + 8px)`, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 800, color: C.text, whiteSpace: 'nowrap' }}>{n.toLocaleString()}</span>
                    </span>
                    <span style={{ fontSize: 11.5, color: C.text2, textAlign: 'end', lineHeight: 1.3 }}>
                      <b style={{ fontSize: 13, color: C.text }}>{pctOf(n, S.n)}%</b>
                      <span style={{ display: 'block', color: C.text3 }}>{L(`כרגע: ${nowIn}`, `now: ${nowIn}`)}</span>
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
          <div className="ld-out" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line2}` }}>
            {OUTCOMES.map(k => {
              const n = cur.filter(l => stageOf(l) === k).length
              return (
                <button key={k} type="button" className="ld-click" onClick={() => openDrill('stage', k)}
                  style={{ textAlign: 'start', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.line}`, background: 'transparent', fontFamily: 'inherit', color: C.text }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={stName(k)}><span style={{ width: 8, height: 8, borderRadius: 2, background: st(k).color, flexShrink: 0 }}/>{k === 'nurture' ? L('לחזור בהמשך', 'Nurture') : stName(k)}</span>
                  <span style={{ display: 'block', fontSize: 20, fontWeight: 800, marginTop: 2 }}>{n} <span style={{ fontSize: 12, fontWeight: 600, color: C.text3 }}>{pctOf(n, S.n)}%</span></span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Over time */}
        <section style={{ ...card, padding: 18 }} aria-label={L('לידים לאורך זמן', 'Leads over time')}>
          <H sub={trend.unit === 'day' ? L('לפי יום', 'per day') : trend.unit === 'week' ? L('לפי שבוע', 'per week') : L('לפי חודש', 'per month')}
            right={<button type="button" onClick={() => setTrendTable(v => !v)} aria-pressed={trendTable} title={trendTable ? L('תרשים', 'Chart') : L('טבלה', 'Table')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 7, border: `1px solid ${C.line}`, background: 'transparent', color: C.text2, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>{trendTable ? <BarChart3 size={13}/> : <Table2 size={13}/>}{trendTable ? L('תרשים', 'Chart') : L('טבלה', 'Table')}</button>}>
            {L('לידים לאורך זמן', 'Leads over time')}
          </H>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
            {SRC.map(([k, label, i]) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text2 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: P.series[i] }}/>{label} <b style={{ color: C.text }}>{srcTotals[k]}</b></span>)}
          </div>
          {trendTable ? (
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ color: C.text3 }}><th style={{ textAlign: 'start', padding: 6 }}>{L('תקופה', 'Period')}</th>{SRC.map(([k, label]) => <th key={k} style={{ padding: 6 }}>{label}</th>)}<th style={{ padding: 6 }}>{L('סה"כ', 'Total')}</th></tr></thead>
                <tbody>{[...trend.buckets].reverse().map(b => <tr key={b.k} style={{ borderTop: `1px solid ${C.line2}` }}><td style={{ padding: 6 }}>{bucketLabel(b.k)}</td>{SRC.map(([k]) => <td key={k} style={{ padding: 6, textAlign: 'center' }}>{b[k]}</td>)}<td style={{ padding: 6, textAlign: 'center', fontWeight: 700 }}>{b.meta + b.site + b.other}</td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <div style={{ position: 'relative' }} onMouseLeave={() => setTip(null)}>
              <div style={{ position: 'relative', height: 200, display: 'flex', alignItems: 'flex-end', gap: 2, paddingInlineStart: 30, borderBottom: `1px solid ${C.line}` }}>
                {[0.5, 1].map(f => (
                  <div key={f} aria-hidden style={{ position: 'absolute', insetInline: 0, bottom: `${f * 100}%`, borderTop: `1px solid ${C.line2}`, pointerEvents: 'none' }}>
                    <span style={{ position: 'absolute', insetInlineStart: 0, top: -8, fontSize: 10.5, color: C.text3 }}>{Math.round(niceMax * f)}</span>
                  </div>
                ))}
                {trend.buckets.map((b, i) => {
                  const total = b.meta + b.site + b.other
                  return (
                    <div key={b.k} tabIndex={0} role="img" aria-label={`${bucketLabel(b.k)}: ${total}`}
                      onMouseEnter={() => setTip({ i, b })} onFocus={() => setTip({ i, b })} onBlur={() => setTip(null)}
                      style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', cursor: 'default', outline: 'none', background: tip?.i === i ? C.line2 : 'transparent', borderRadius: 4 }}>
                      <div style={{ width: '100%', maxWidth: 24, display: 'flex', flexDirection: 'column-reverse', gap: total ? 2 : 0 }}>
                        {SRC.map(([k, , si], j) => b[k] ? <div key={k} style={{ height: `${(b[k] / niceMax) * 196}px`, background: P.series[si], borderRadius: j === SRC.length - 1 || !SRC.slice(j + 1).some(([kk]) => b[kk]) ? '4px 4px 0 0' : 0 }}/> : null)}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 2, paddingInlineStart: 30, marginTop: 4 }}>
                {trend.buckets.map((b, i) => {
                  const every = Math.max(1, Math.ceil(trend.buckets.length / 8))
                  return <div key={b.k} style={{ flex: 1, minWidth: 0, position: 'relative', height: 14 }}>
                    {i % every === 0 && <bdi style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontSize: 10.5, color: C.text3, whiteSpace: 'nowrap' }}>{bucketLabel(b.k)}</bdi>}
                  </div>
                })}
              </div>
              {tip && (
                <div role="tooltip" style={{ position: 'absolute', top: 6, insetInlineStart: `calc(30px + (100% - 30px) * ${(tip.i + 0.5) / trend.buckets.length})`, transform: en ? 'translateX(-50%)' : 'translateX(50%)', background: isDark ? '#0B0F18' : '#1F2433', color: '#fff', borderRadius: 8, padding: '8px 10px', fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 2, boxShadow: '0 6px 18px rgba(0,0,0,.25)' }}>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{tip.b.meta + tip.b.site + tip.b.other} <span style={{ fontSize: 11, fontWeight: 500, opacity: .75 }}>{bucketLabel(tip.b.k)}</span></div>
                  {SRC.map(([k, label, si]) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}><span style={{ width: 10, height: 2, background: P.series[si] }}/><b>{tip.b[k]}</b><span style={{ opacity: .75 }}>{label}</span></div>)}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Campaign performance */}
      <section style={{ ...card, padding: 18, marginTop: 14, overflowX: 'auto' }} aria-label={L('ביצועי קמפיינים', 'Campaign performance')}>
        <H sub={L('לידים שנכנסו בתקופה — לחצו על שורה כדי לראות את הלידים', 'Leads created in the period — click a row to see them')}>{L('ביצועי קמפיינים ומקורות', 'Campaigns & sources')}</H>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
          <thead>
            <tr style={{ color: C.text3, fontSize: 12 }}>
              {[L('קמפיין', 'Campaign'), L('לידים', 'Leads'), L('נוצר קשר', 'Contacted'), L('מתעניינים+', 'Interested+'), L('נסגרו', 'Won'), L('ממתינים', 'Waiting'), L('זמן תגובה', 'Response')].map((h, i) => <th key={h} style={{ textAlign: i ? 'center' : 'start', padding: '6px 8px', fontWeight: 600 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {campRows.slice(0, 15).map(r => (
              <tr key={r.name} className="ld-row" onClick={() => openDrill('camp', r.name, r.name)} style={{ borderTop: `1px solid ${C.line2}`, cursor: 'pointer' }}>
                <td style={{ padding: '9px 8px', fontWeight: 700, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
                <td style={{ padding: '9px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, minWidth: 28, textAlign: 'end' }}>{r.n}</span>
                    <span style={{ flex: 1, height: 6, background: C.line2, borderRadius: 3, minWidth: 50 }}><span style={{ display: 'block', height: '100%', width: `${(r.n / (campRows[0]?.n || 1)) * 100}%`, background: P.series[0], borderRadius: 3 }}/></span>
                  </div>
                </td>
                <td style={{ padding: '9px 8px', textAlign: 'center' }}>{pctOf(r.touched, r.n)}%</td>
                <td style={{ padding: '9px 8px', textAlign: 'center' }}>{pctOf(r.interested, r.n)}%</td>
                <td style={{ padding: '9px 8px', textAlign: 'center', fontWeight: 700 }}>{r.won}</td>
                <td style={{ padding: '9px 8px', textAlign: 'center', color: r.waiting ? P.warn : C.text3, fontWeight: r.waiting ? 700 : 400 }}>{r.waiting}</td>
                <td style={{ padding: '9px 8px', textAlign: 'center', color: C.text2 }}>{fmtResp(median(r.resp))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!campRows.length && <div style={{ padding: '14px 0', color: C.text3, fontSize: 13 }}>{L('אין לידים בתקופה', 'No leads in the period')}</div>}
      </section>

      <div className="ld-2" style={{ marginTop: 14 }}>
        {/* Aging + follow-ups */}
        <section style={{ ...card, padding: 18 }} aria-label={L('לידים פתוחים לפי זמן מהפעילות האחרונה', 'Open leads by time since last activity')}>
          <H sub={L(`${open.length} לידים פתוחים — זמן מהפעילות האחרונה`, `${open.length} open leads — time since last activity`)}>{L('בריאות הצנרת', 'Pipeline health')}</H>
          <div style={{ display: 'flex', height: 14, borderRadius: 4, overflow: 'hidden', gap: 2, background: C.line2 }}>
            {aging.map(a => a.list.length ? <div key={a.i} title={`${a.label}: ${a.list.length}`} style={{ flex: a.list.length, background: P.ramp[[0, 1, 3, 4][a.i]] }}/> : null)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8, marginTop: 12 }}>
            {aging.map(a => (
              <button key={a.i} type="button" className="ld-click" onClick={() => openDrill('aging', a.i, L(`פתוחים — ${a.label} מהפעילות האחרונה`, `Open — ${a.label} since last activity`))}
                style={{ textAlign: 'start', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: 'transparent', fontFamily: 'inherit', color: C.text }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: C.text2 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: P.ramp[[0, 1, 3, 4][a.i]] }}/>{a.label}</span>
                <span style={{ display: 'block', fontSize: 19, fontWeight: 800 }}>{a.list.length}</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line2}` }}>
            {[['overdue', L('מעקבים באיחור', 'Overdue follow-ups'), fu.overdue.length ? P.bad : C.text3, AlertCircle], ['today', L('מעקבים להיום', 'Due today'), C.text2, CalendarClock], ['week', L('ב-7 הימים הבאים', 'Next 7 days'), C.text2, Clock]].map(([k, label, color, Ic]) => (
              <button key={k} type="button" className="ld-click" onClick={() => openDrill('fu', k, label)} style={{ textAlign: 'start', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: 'transparent', fontFamily: 'inherit', color: C.text }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color }}><Ic size={13}/>{label}</span>
                <span style={{ display: 'block', fontSize: 19, fontWeight: 800 }}>{fu[k].length}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Arrival heat */}
        <section style={{ ...card, padding: 18 }} aria-label={L('מתי נכנסים לידים', 'When leads arrive')}>
          <H sub={L('ימים ושעות שבהם הלידים בתקופה נכנסו — כדאי שיהיה מי שעונה', 'Days and hours the period\'s leads came in — have someone answering then')}>{L('מתי נכנסים לידים', 'When leads arrive')}</H>
          <div style={{ display: 'grid', gridTemplateColumns: `34px repeat(${HOURS.length}, minmax(0,1fr))`, gap: 3, fontSize: 11, color: C.text3 }}>
            <span/>
            {HOURS.map(h => <span key={h[2]} style={{ textAlign: 'center' }}>{h[2]}</span>)}
            {DAYS.map((d, di) => [
              <span key={d} style={{ display: 'flex', alignItems: 'center' }}>{d}</span>,
              ...HOURS.map((h, hi) => {
                const n = heat[di][hi], q = n ? Math.min(4, Math.floor((n / heatMax) * 4.999)) : -1
                return <span key={d + h[2]} title={`${d} ${h[2]}: ${n}`} aria-label={`${d} ${h[2]}: ${n}`}
                  style={{ height: 26, borderRadius: 4, background: q < 0 ? C.line2 : P.ramp[q], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: q >= 2 ? '#fff' : (q < 0 ? 'transparent' : C.text) }}>{n || ''}</span>
              }),
            ])}
          </div>
        </section>
      </div>

      {/* Drill-down */}
      <section ref={drillRef} style={{ ...card, marginTop: 14, overflow: 'hidden', scrollMarginTop: 12 }} aria-label={drillTitle}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.line2}`, borderTop: `3px solid ${drillColor}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{drillTitle}</h3>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: C.text, background: C.chip, borderRadius: 20, padding: '2px 10px' }}>{drillList.length}</span>
            {drill.kind === 'stage' && <span style={{ fontSize: 12, color: C.text3 }}>{L('כל הלידים שנמצאים כרגע בשלב (לפי מקור וקמפיין שבחרתם)', 'Every lead currently in this stage (for the chosen source / campaign)')}</span>}
            <label style={{ fontSize: 12, color: C.text2, display: 'flex', alignItems: 'center', gap: 6, marginInlineStart: 'auto' }}>
              {L('מיון', 'Sort')}
              <select value={sort} onChange={e => setSort(e.target.value)} style={{ background: C.card, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 12 }}>
                <option value="oldest">{L('הכי הרבה זמן ללא התקדמות', 'Longest without progress')}</option>
                <option value="newest">{L('האחרונים', 'Most recent')}</option>
                <option value="followup">{L('לפי מעקב קרוב', 'By next follow-up')}</option>
              </select>
            </label>
          </div>
          {drillList.length > 0 && (() => {
            const avg = Math.round(drillList.reduce((s, x) => s + (now - x.at) / DAY, 0) / drillList.length)
            const noNote = drillList.filter(x => !x.note).length, late = drillList.filter(x => x.f && x.f < now).length
            return (
              <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap', fontSize: 12.5, color: C.text2 }}>
                <span>{L('ממוצע:', 'Average:')} <b style={{ color: C.text }}>{L(`${avg} ימים`, `${avg} days`)}</b></span>
                <span style={{ color: noNote ? P.warn : C.text2 }}>{L('בלי תיעוד:', 'No notes:')} <b>{noNote}</b></span>
                <span style={{ color: late ? P.bad : C.text2 }}>{L('מעקב באיחור:', 'Overdue:')} <b>{late}</b></span>
              </div>
            )
          })()}
        </div>
        {!drillList.length && <div style={{ padding: '28px 18px', textAlign: 'center', color: C.text3, fontSize: 13.5 }}>{L('אין לידים כאן', 'No leads here')}</div>}
        <div role="list">
          {drillList.slice(0, 200).map(({ l, at, note, f }) => {
            const c = leadCampaign(l, lang), late = f && f < now, since = now - at
            return (
              <div key={l.id} role="listitem" className="ld-row ld-item" onClick={() => onOpen?.(l)}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1.1fr) minmax(0,1.7fr) 130px auto', gap: 12, alignItems: 'center', padding: '10px 18px', borderTop: `1px solid ${C.line2}`, cursor: 'pointer' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || '—'}{c && <span style={{ fontSize: 11.5, fontWeight: 500, color: C.text3, marginInlineStart: 5 }}>(<bdi>{c}</bdi>)</span>}</div>
                  <div style={{ fontSize: 12, color: C.text3, direction: 'ltr', textAlign: en ? 'left' : 'right' }}>{l.phone || ''}</div>
                </div>
                <div className="ld-note" style={{ minWidth: 0, fontSize: 12.5, color: note ? C.text : C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={note?.text || ''}>
                  {note ? `📝 ${note.text}` : l.msg ? prettyLeadText(l.msg, lang) : L('אין תיעוד עדיין', 'Nothing logged yet')}
                </div>
                <div className="ld-when" style={{ fontSize: 11.5, lineHeight: 1.45 }}>
                  <div style={{ color: since > 7 * DAY && OPEN.includes(stageOf(l)) ? P.warn : C.text2, fontWeight: 600 }}>{drill.kind === 'stage' ? L('בשלב', 'In stage') : L('ללא פעילות', 'Idle')} {days(since)}</div>
                  {f ? <div style={{ color: late ? P.bad : C.text2, fontWeight: 600 }}>⏰ {fmtD(f)}</div> : null}
                </div>
                <div className="ld-acts" style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                  {l.phone && <a href={`tel:${l.phone}`} aria-label={L('התקשר', 'Call')} title={L('התקשר', 'Call')} style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: C.chip, color: P.series[0], border: `1px solid ${C.line}` }}><Phone size={13}/></a>}
                  {l.phone && onOpenChat && <button type="button" onClick={() => onOpenChat(l)} aria-label="WhatsApp" title="WhatsApp" style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: C.chip, color: '#1FAF55', border: `1px solid ${C.line}`, cursor: 'pointer' }}><MessageSquare size={13}/></button>}
                  <button type="button" onClick={() => onOpen?.(l)} aria-label={L('פתח', 'Open')} title={L('פתח', 'Open')} style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: C.chip, color: C.text2, border: `1px solid ${C.line}`, cursor: 'pointer' }}><ExternalLink size={13}/></button>
                </div>
              </div>
            )
          })}
        </div>
        {drillList.length > 200 && <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: C.text3 }}>{L(`מוצגים 200 מתוך ${drillList.length}`, `Showing 200 of ${drillList.length}`)}</div>}
      </section>
    </div>
  )
}
