import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FaFacebookF, FaInstagram, FaChartBar, FaChartLine,
  FaEye, FaUsers, FaDollarSign, FaMousePointer,
  FaBullseye, FaSync, FaExclamationTriangle, FaGoogle,
} from 'react-icons/fa'

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN || 'AFIKhanahal2026'

const TR = {
  he: {
    title:        'ביצועים ושיווק',
    fbAds:        'Facebook Ads',
    ga:           'Google Analytics',
    instagram:    'Instagram',
    yesterday:    'אתמול',
    last7:        '7 ימים',
    last30:       '30 ימים',
    lastMonth:    'חודש קודם',
    loading:      'טוען נתונים...',
    noData:       'אין נתונים לתקופה זו',
    noApiKey:     'מפתח SUPERMETRICS_API_KEY לא הוגדר ב-Vercel',
    refresh:      'רענן',
    impressions:  'חשיפות',
    reach:        'טווח הגעה',
    clicks:       'קליקים',
    spend:        'הוצאה',
    ctr:          'CTR',
    cpc:          'CPC',
    cpm:          'CPM',
    frequency:    'תדירות',
    conversions:  'המרות',
    sessions:     'סשנים',
    users:        'משתמשים',
    newUsers:     'משתמשים חדשים',
    pageviews:    'צפיות',
    bounceRate:   'נטישה',
    duration:     'משך ממוצע',
    goals:        'יעדים',
    followers:    'עוקבים',
    likes:        'לייקים',
    comments:     'תגובות',
    shares:       'שיתופים',
    saves:        'שמירות',
    showing:      'מציג',
    of:           'מתוך',
    rows:         'שורות',
    source:       'מקור',
  },
  en: {
    title:        'Performance & Marketing',
    fbAds:        'Facebook Ads',
    ga:           'Google Analytics',
    instagram:    'Instagram',
    yesterday:    'Yesterday',
    last7:        '7 Days',
    last30:       '30 Days',
    lastMonth:    'Last Month',
    loading:      'Loading data...',
    noData:       'No data for this period',
    noApiKey:     'SUPERMETRICS_API_KEY not set in Vercel',
    refresh:      'Refresh',
    impressions:  'Impressions',
    reach:        'Reach',
    clicks:       'Clicks',
    spend:        'Spend',
    ctr:          'CTR',
    cpc:          'CPC',
    cpm:          'CPM',
    frequency:    'Frequency',
    conversions:  'Conversions',
    sessions:     'Sessions',
    users:        'Users',
    newUsers:     'New Users',
    pageviews:    'Pageviews',
    bounceRate:   'Bounce Rate',
    duration:     'Avg Duration',
    goals:        'Goal Completions',
    followers:    'Followers',
    likes:        'Likes',
    comments:     'Comments',
    shares:       'Shares',
    saves:        'Saves',
    showing:      'Showing',
    of:           'of',
    rows:         'rows',
    source:       'Source',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Normalise a column header to a canonical key
function canonicalKey(header) {
  const h = (header || '').toLowerCase()
  if (h === 'date')                                              return 'date'
  if (h.includes('campaign'))                                   return 'campaign'
  if (h.includes('impression'))                                 return 'impressions'
  if (h.includes('reach') && !h.includes('post'))               return 'reach'
  if (h.includes('post reach'))                                 return 'postReach'
  if (h.includes('click') && !h.includes('unique'))             return 'clicks'
  if (h.includes('spent') || h.includes('spend') || h.includes('cost') || h.includes('amount')) return 'spend'
  if (h === 'ctr' || (h.includes('ctr') && h.length < 20))      return 'ctr'
  if (h === 'cpc' || (h.includes('cpc') && h.length < 20))      return 'cpc'
  if (h === 'cpm' || h.includes('cost per 1'))                  return 'cpm'
  if (h.includes('frequency'))                                  return 'frequency'
  if (h.includes('conversion'))                                 return 'conversions'
  if (h.includes('session') && !h.includes('duration'))        return 'sessions'
  if (h.includes('new user'))                                   return 'newUsers'
  if (h.includes('user') && !h.includes('new'))                return 'users'
  if (h.includes('pageview') || h.includes('page view'))       return 'pageviews'
  if (h.includes('bounce'))                                     return 'bounceRate'
  if (h.includes('duration') || h.includes('avg. session'))    return 'duration'
  if (h.includes('goal'))                                       return 'goals'
  if (h.includes('follower'))                                   return 'followers'
  if (h.includes('post like') || (h.includes('like') && !h.includes('unlike'))) return 'likes'
  if (h.includes('post comment') || h.includes('comment'))     return 'comments'
  if (h.includes('post share') || h.includes('share'))         return 'shares'
  if (h.includes('post save') || h.includes('save'))           return 'saves'
  if (h.includes('profile impression') || (h.includes('impression') && h.includes('profile'))) return 'impressions'
  return h.replace(/[^a-z0-9]/g, '_')
}

function parseData(headers, rows) {
  const keys = (headers || []).map(canonicalKey)
  return (rows || []).map(row => {
    const obj = {}
    keys.forEach((k, i) => { obj[k] = row[i] })
    return obj
  })
}

function toNumber(val) {
  if (val === null || val === undefined || val === '') return null
  const n = parseFloat(String(val).replace(/[%,$, ]/g, ''))
  return isNaN(n) ? null : n
}

function sumMetrics(parsed) {
  const acc = {}
  const cnt = {}
  parsed.forEach(row => {
    Object.entries(row).forEach(([k, v]) => {
      if (k === 'date' || k === 'campaign') return
      const n = toNumber(v)
      if (n === null) return
      // bounceRate, ctr, cpc, cpm, frequency, duration → average
      if (['bounceRate','ctr','cpc','cpm','frequency','duration'].includes(k)) {
        acc[k] = (acc[k] || 0) + n; cnt[k] = (cnt[k] || 0) + 1
      } else {
        acc[k] = (acc[k] || 0) + n
      }
    })
  })
  Object.keys(cnt).forEach(k => { if (cnt[k] > 1) acc[k] = acc[k] / cnt[k] })
  return acc
}

function fmtVal(key, value) {
  if (value === null || value === undefined) return '—'
  const n = toNumber(value)
  if (n === null) return value ?? '—'
  if (key === 'spend')                        return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (key === 'ctr' || key === 'bounceRate')  return `${n.toFixed(2)}%`
  if (key === 'cpc' || key === 'cpm')         return `$${n.toFixed(2)}`
  if (key === 'duration') {
    const m = Math.floor(n / 60), s = Math.round(n % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 })
}

// ── KPI definitions per source ────────────────────────────────────────────────

const KPI_CONFIG = {
  fa: (t) => [
    { key: 'impressions', label: t.impressions, Icon: FaEye,          color: '#60D4F7' },
    { key: 'reach',       label: t.reach,       Icon: FaUsers,        color: '#8490D8' },
    { key: 'clicks',      label: t.clicks,      Icon: FaMousePointer, color: '#F7C948' },
    { key: 'spend',       label: t.spend,       Icon: FaDollarSign,   color: '#22C55E' },
    { key: 'ctr',         label: t.ctr,         Icon: FaChartLine,    color: '#E17BFF' },
    { key: 'cpc',         label: t.cpc,         Icon: FaBullseye,     color: '#FF6B6B' },
    { key: 'cpm',         label: t.cpm,         Icon: FaChartBar,     color: '#F78C3F' },
    { key: 'conversions', label: t.conversions, Icon: FaBullseye,     color: '#34D399' },
  ],
  gawa: (t) => [
    { key: 'sessions',    label: t.sessions,    Icon: FaUsers,        color: '#4285F4' },
    { key: 'users',       label: t.users,       Icon: FaUsers,        color: '#60D4F7' },
    { key: 'newUsers',    label: t.newUsers,    Icon: FaUsers,        color: '#34D399' },
    { key: 'pageviews',   label: t.pageviews,   Icon: FaEye,          color: '#F7C948' },
    { key: 'bounceRate',  label: t.bounceRate,  Icon: FaChartLine,    color: '#FF6B6B' },
    { key: 'duration',    label: t.duration,    Icon: FaChartBar,     color: '#8490D8' },
    { key: 'goals',       label: t.goals,       Icon: FaBullseye,     color: '#22C55E' },
  ],
  igi: (t) => [
    { key: 'impressions', label: t.impressions, Icon: FaEye,          color: '#E1306C' },
    { key: 'reach',       label: t.reach,       Icon: FaUsers,        color: '#F56040' },
    { key: 'followers',   label: t.followers,   Icon: FaUsers,        color: '#FCAF45' },
    { key: 'likes',       label: t.likes,       Icon: FaChartLine,    color: '#405DE6' },
    { key: 'comments',    label: t.comments,    Icon: FaChartBar,     color: '#8490D8' },
    { key: 'shares',      label: t.shares,      Icon: FaMousePointer, color: '#60D4F7' },
    { key: 'saves',       label: t.saves,       Icon: FaBullseye,     color: '#34D399' },
  ],
}

// Chart metric per source
const CHART_METRIC = { fa: 'impressions', gawa: 'sessions', igi: 'impressions' }

// ── Mini bar chart ────────────────────────────────────────────────────────────

function BarChart({ data, color, label }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${color}22`, borderRadius: 14, padding: '18px 18px 10px' }}>
      <div style={{ color: 'rgba(232,228,216,.45)', fontSize: 11, fontWeight: 600, marginBottom: 10 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 72, overflowX: 'auto', paddingBottom: 2 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: '1 0 auto', minWidth: 22 }}>
            <div style={{ width: '100%', background: `${color}cc`, borderRadius: '3px 3px 0 0', height: `${Math.max((d.value / max) * 60, 2)}px`, transition: 'height .3s' }}/>
            <span style={{ color: 'rgba(232,228,216,.3)', fontSize: 8, whiteSpace: 'nowrap', letterSpacing: '-.3px' }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, Icon, color }) {
  return (
    <div style={{ background: `${color}12`, border: `1px solid ${color}28`, borderRadius: 14, padding: '16px 18px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon style={{ color, fontSize: 12 }}/>
        </div>
        <span style={{ color: 'rgba(232,228,216,.5)', fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{label}</span>
      </div>
      <div style={{ color, fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  )
}

// ── Data Table ────────────────────────────────────────────────────────────────

function DataTable({ headers, rows, C }) {
  const [page, setPage] = useState(0)
  const PAGE = 25
  const total = rows.length
  const visible = rows.slice(page * PAGE, page * PAGE + PAGE)
  const pages = Math.ceil(total / PAGE)

  return (
    <div style={{ background: 'rgba(255,255,255,.025)', border: `1px solid ${C.purple}18`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, direction: 'ltr' }}>
          <thead>
            <tr style={{ background: `${C.purple}18` }}>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '10px 13px', color: C.purple, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', borderBottom: `1px solid ${C.purple}22` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: `1px solid ${C.purple}0a`, background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '7px 13px', color: 'rgba(232,228,216,.65)', whiteSpace: 'nowrap' }}>
                    {cell ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 16px', borderTop: `1px solid ${C.purple}15` }}>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.purple}30`, background: 'transparent', color: `${C.cream}55`, cursor: page === 0 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
            ‹
          </button>
          <span style={{ color: `${C.cream}55`, fontSize: 11 }}>{page + 1} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1}
            style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.purple}30`, background: 'transparent', color: `${C.cream}55`, cursor: page === pages - 1 ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 11 }}>
            ›
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const DARK_C = { purple:'#8490D8', cream:'#E8E4D8', green:'#22C55E' }

export default function SupermetricsTab({ C = DARK_C, lang = 'he' }) {
  const t = TR[lang] || TR.he

  const [source, setSource] = useState('fa')
  const [range,  setRange]  = useState('last_7_days')
  const [cache,  setCache]  = useState({})    // key → { headers, rows, ts }
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const abortRef = useRef(null)

  const cacheKey = `${source}_${range}`

  const load = useCallback(async (src, rng, force = false) => {
    const key = `${src}_${rng}`
    const cached = cache[key]
    if (!force && cached && Date.now() - cached.ts < 2 * 60 * 1000) return

    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/meta/supermetrics?source=${src}&range=${rng}`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        signal: ctrl.signal,
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setCache(prev => ({ ...prev, [key]: { headers: body.headers || [], rows: body.rows || [], ts: Date.now() } }))
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [cache])

  useEffect(() => { load(source, range) }, [source, range]) // eslint-disable-line

  const current  = cache[cacheKey]
  const headers  = current?.headers || []
  const rows     = current?.rows    || []
  const parsed   = parseData(headers, rows)
  const agg      = sumMetrics(parsed)
  const kpis     = (KPI_CONFIG[source] || KPI_CONFIG.fa)(t)

  // Chart: pick metric, build daily series
  const chartMetric = CHART_METRIC[source]
  const chartData = parsed
    .filter(r => r.date)
    .map(r => ({
      label: String(r.date || '').slice(5).replace('-', '/'),
      value: toNumber(r[chartMetric]) || 0,
    }))

  const SOURCE_CFG = {
    fa:   { label: t.fbAds,     Icon: FaFacebookF, color: '#1877F2', bg: '#1877F218' },
    gawa: { label: t.ga,        Icon: FaGoogle,    color: '#4285F4', bg: '#4285F418' },
    igi:  { label: t.instagram, Icon: FaInstagram, color: '#E1306C', bg: '#E1306C18' },
  }

  const RANGES = [
    { val: 'yesterday',   label: t.yesterday },
    { val: 'last_7_days', label: t.last7     },
    { val: 'last_30_days',label: t.last30    },
    { val: 'last_month',  label: t.lastMonth },
  ]

  return (
    <div style={{ direction: lang === 'en' ? 'ltr' : 'rtl', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 19, color: 'rgba(232,228,216,.95)', fontWeight: 800 }}>
          📊 {t.title}
        </h2>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
          {RANGES.map(({ val, label }) => (
            <button key={val} onClick={() => setRange(val)}
              style={{ padding: '5px 12px', border: `1px solid ${range === val ? C.purple : `${C.purple}28`}`, borderRadius: 20, background: range === val ? `${C.purple}22` : 'transparent', color: range === val ? C.purple : `rgba(232,228,216,.4)`, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: range === val ? 700 : 400, transition: 'all .15s' }}>
              {label}
            </button>
          ))}
          <button onClick={() => load(source, range, true)} title={t.refresh}
            style={{ padding: '5px 9px', border: `1px solid ${C.purple}28`, borderRadius: 20, background: 'transparent', color: `rgba(232,228,216,.4)`, cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
            <FaSync style={{ fontSize: 10, animation: loading ? 'spin 1s linear infinite' : 'none' }}/>
          </button>
        </div>
      </div>

      {/* ── Source tabs ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(SOURCE_CFG).map(([src, cfg]) => (
          <button key={src} onClick={() => setSource(src)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', border: `1px solid ${source === src ? cfg.color + '55' : 'rgba(255,255,255,.08)'}`, borderRadius: 12, background: source === src ? cfg.bg : 'rgba(255,255,255,.04)', color: source === src ? cfg.color : 'rgba(232,228,216,.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: source === src ? 700 : 400, transition: 'all .18s' }}>
            <cfg.Icon style={{ fontSize: 13 }}/>
            {cfg.label}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(232,228,216,.35)', padding: '40px 0', justifyContent: 'center', fontSize: 13 }}>
          <FaSync style={{ animation: 'spin 1s linear infinite' }}/>
          {t.loading}
        </div>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,80,80,.08)', border: '1px solid rgba(255,80,80,.25)', borderRadius: 12, padding: '14px 18px' }}>
          <FaExclamationTriangle style={{ color: '#FF6B6B', fontSize: 14, marginTop: 1, flexShrink: 0 }}/>
          <div>
            <div style={{ color: '#FF6B6B', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>שגיאה</div>
            <div style={{ color: 'rgba(255,107,107,.8)', fontSize: 12 }}>{error}</div>
            {error.includes('SUPERMETRICS_API_KEY') && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
                הוסף <code style={{ background: 'rgba(255,255,255,.08)', padding: '1px 6px', borderRadius: 4 }}>SUPERMETRICS_API_KEY</code> ב-Vercel → Settings → Environment Variables
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {!loading && !error && current && (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 }}>
            {kpis.map(({ key: k, label, Icon, color }) => (
              <KpiCard key={k} label={label} color={color} Icon={Icon}
                value={agg[k] !== undefined ? fmtVal(k, agg[k]) : '—'}/>
            ))}
          </div>

          {/* Bar chart */}
          {chartData.length > 1 && (
            <BarChart
              data={chartData}
              color={SOURCE_CFG[source]?.color || C.purple}
              label={`${kpis.find(k => k.key === chartMetric)?.label || chartMetric} — ${RANGES.find(r => r.val === range)?.label}`}
            />
          )}

          {/* Raw data table */}
          {rows.length > 0 ? (
            <DataTable headers={headers} rows={rows} C={C}/>
          ) : (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(232,228,216,.3)', fontSize: 13 }}>
              {t.noData}
            </div>
          )}
        </>
      )}

      {/* ── Idle state (not yet loaded) ── */}
      {!loading && !error && !current && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'rgba(232,228,216,.25)', fontSize: 13 }}>
          {t.loading}
        </div>
      )}

    </div>
  )
}
