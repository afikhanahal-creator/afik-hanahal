// Admin home ("סקירה כללית"): greeting, business KPIs, live system status, pipeline and recent activity.
import { useState, useEffect, useMemo } from 'react'
import { FaBuilding, FaFileAlt, FaUsers, FaFire, FaWhatsapp, FaChartLine, FaRobot, FaClipboardList, FaArrowLeft, FaArrowRight, FaCircle, FaPlus, FaGlobe } from 'react-icons/fa'
import { T } from './automationsUI.jsx'

const TR = {
  he: {
    morning: 'בוקר טוב', noon: 'צהריים טובים', evening: 'ערב טוב', night: 'לילה טוב', sub: 'זה מה שקורה היום באפיק הנחל',
    active: 'נכסים באוויר', of: n => `מתוך ${n} נכסים`, drafts: 'טיוטות', draftsSub: 'ממתינות לפרסום', leads: 'לידים', week: n => `${n} ב-7 הימים האחרונים`,
    today: 'לידים היום', yday: n => `${n} אתמול`, intake: 'נכסים שנקלטו', intakeSub: 'ממתינים לבדיקה', hot: 'לידים חמים', hotSub: 'לפי ציון AI',
    status: 'מצב המערכת', wa: 'WhatsApp (Green API)', ga: 'Google Analytics', auto: 'אוטומציות', site: 'האתר',
    ok: 'מחובר', off: 'לא מחובר', setup: 'דורש חיבור', on: 'פעילות', paused: 'מושהות', checking: 'בודק…', live: n => `${n} גולשים עכשיו`, online: 'באוויר', unread: n => `${n} הודעות שלא נקראו`,
    pipeline: 'צינור המכירות', pipelineSub: 'לידים לפי שלב', recentLeads: 'לידים אחרונים', recentProps: 'נכסים אחרונים', all: 'לכל הלידים', manage: 'לניהול נכסים',
    noLeads: 'אין לידים עדיין', noProps: 'אין נכסים עדיין', published: 'פורסם', draft: 'טיוטה', newProp: 'נכס חדש', viewSite: 'צפה באתר', noName: 'ללא שם',
    ago: { now: 'עכשיו', m: n => `לפני ${n} דק׳`, h: n => `לפני ${n} שע׳`, d: n => (n === 1 ? 'אתמול' : `לפני ${n} ימים`) },
    src: { contact_form: 'טופס באתר', meta: 'פייסבוק', whatsapp: 'WhatsApp', manual: 'ידני', phone: 'טלפון' },
  },
  en: {
    morning: 'Good morning', noon: 'Good afternoon', evening: 'Good evening', night: 'Good night', sub: 'Here is what is happening at Afik Hanahal today',
    active: 'Live properties', of: n => `of ${n} properties`, drafts: 'Drafts', draftsSub: 'Waiting to be published', leads: 'Leads', week: n => `${n} in the last 7 days`,
    today: 'Leads today', yday: n => `${n} yesterday`, intake: 'Submitted properties', intakeSub: 'Waiting for review', hot: 'Hot leads', hotSub: 'By AI score',
    status: 'System status', wa: 'WhatsApp (Green API)', ga: 'Google Analytics', auto: 'Automations', site: 'Website',
    ok: 'Connected', off: 'Not connected', setup: 'Needs setup', on: 'Running', paused: 'Paused', checking: 'Checking…', live: n => `${n} visitors now`, online: 'Online', unread: n => `${n} unread messages`,
    pipeline: 'Sales pipeline', pipelineSub: 'Leads by stage', recentLeads: 'Recent leads', recentProps: 'Recent properties', all: 'All leads', manage: 'Manage properties',
    noLeads: 'No leads yet', noProps: 'No properties yet', published: 'Published', draft: 'Draft', newProp: 'New property', viewSite: 'View site', noName: 'No name',
    ago: { now: 'just now', m: n => `${n} min ago`, h: n => `${n} h ago`, d: n => (n === 1 ? 'yesterday' : `${n} days ago`) },
    src: { contact_form: 'Website form', meta: 'Facebook', whatsapp: 'WhatsApp', manual: 'Manual', phone: 'Phone' },
  },
}
const STAGES = [
  { id: 'new', he: 'ליד חדש', en: 'New', color: '#0073EA' },
  { id: 'contacted', he: 'ניצור קשר', en: 'Contacted', color: '#FDAB3D' },
  { id: 'discovery', he: 'גילוי', en: 'Discovery', color: '#A25DDC' },
  { id: 'negotiating', he: 'במו״מ', en: 'Negotiating', color: '#FF7575' },
  { id: 'won', he: 'סגירה', en: 'Won', color: '#00C875' },
  { id: 'lost', he: 'ללא מענה', en: 'No answer', color: '#7D7D7D' },
]
const CSS = `
  .ah-kpi{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
  .ah-2{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:14px;align-items:start}
  .ah-status{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
  .ah-row{transition:background .12s}.ah-row:hover{background:rgba(132,144,216,.07)}
  .ah-card{transition:border-color .15s,transform .15s}.ah-card:hover{border-color:rgba(132,144,216,.32)!important}
  .ah-home button{min-height:0}
  @media (max-width:1280px){.ah-kpi{grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media (max-width:1000px){.ah-2{grid-template-columns:1fr}.ah-status{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media (max-width:640px){.ah-kpi{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ah-status{grid-template-columns:1fr}}
`
const leadTs = l => l.ts || Date.parse(l.created_at || l.createdAt || '') || 0
function ago(ts, t) {
  const m = Math.floor((Date.now() - ts) / 60000)
  if (m < 1) return t.ago.now
  if (m < 60) return t.ago.m(m)
  if (m < 1440) return t.ago.h(Math.floor(m / 60))
  return t.ago.d(Math.floor(m / 1440))
}
const srcLabel = (l, t) => {
  const s = String(l.source || '')
  if (/meta|facebook|fb_/i.test(s) || l.leadgen_id) return t.src.meta
  if (/whatsapp/i.test(s)) return t.src.whatsapp
  if (/^page_|contact|form/i.test(s)) return t.src.contact_form
  return t.src[s] || s || ''
}

function Card({ children, style, className = '' }) {
  return <div className={`ah-card ${className}`} style={{ background: T.cardGrad, boxShadow: T.cardShadow, border: `1px solid ${T.s1Line}`, borderRadius: 16, padding: 18, minWidth: 0, ...style }}>{children}</div>
}
function Head({ title, sub, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: T.text }}>{title}</h3>
        {sub && <div style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  )
}
function LinkBtn({ children, onClick, Arrow }) {
  return <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: T.brandText, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', padding: '4px 2px', minWidth: 0 }}>{children}<Arrow size={10}/></button>
}

function Kpi({ icon: Ic, color, label, value, sub, onClick }) {
  return (
    <button type="button" onClick={onClick} className="ah-card" style={{ textAlign: 'start', fontFamily: 'inherit', cursor: onClick ? 'pointer' : 'default', background: T.cardGrad, boxShadow: T.cardShadow, border: `1px solid ${T.s1Line}`, borderRadius: 16, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, color: T.text }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: `${color}1f`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={14}/></span>
      <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text2 }}>{label}</span>
        <span style={{ fontSize: 11.5, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
      </span>
    </button>
  )
}

function StatusTile({ icon: Ic, label, state, detail, onClick }) {
  const tone = state === 'ok' ? '#22C55E' : state === 'warn' ? '#F5A623' : state === 'bad' ? '#E05252' : T.grey
  return (
    <button type="button" onClick={onClick} className="ah-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(var(--ov),.025)', border: `1px solid ${T.s1Line}`, cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'start', color: T.text, minWidth: 0 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(var(--ov),.05)', color: T.text2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic size={14}/></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.text3, marginTop: 2 }}>
          <FaCircle size={7} style={{ color: tone, flexShrink: 0 }}/><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</span>
        </span>
      </span>
    </button>
  )
}

export default function AdminHome({ properties = [], leads = [], setTab, autoCfg, chatsUnread = 0, intakeNew = 0, token, lang = 'he', thumbImg = x => x, imgFallback, onNewProperty }) {
  const t = TR[lang] || TR.he
  const Arrow = lang === 'en' ? FaArrowRight : FaArrowLeft
  const [wa, setWa] = useState(null)       // 'authorized' | other state | 'error'
  const [ga, setGa] = useState(null)       // { configured, activeUsers } | { error }

  useEffect(() => {
    const H = { Authorization: `Bearer ${token}` }
    fetch('/api/meta/chat-status', { headers: H, signal: AbortSignal.timeout(12000) }).then(r => r.json()).then(d => setWa(d.state || 'error')).catch(() => setWa('error'))
    fetch('/api/meta/ga4?realtime=1', { headers: H, signal: AbortSignal.timeout(20000) }).then(r => r.json()).then(setGa).catch(() => setGa({ error: true }))
  }, [token])

  const now = new Date(), hr = now.getHours()
  const greet = hr < 5 ? t.night : hr < 12 ? t.morning : hr < 17 ? t.noon : hr < 22 ? t.evening : t.night
  const dateStr = now.toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const stats = useMemo(() => {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const d0 = dayStart.getTime(), d1 = d0 - 864e5, w = Date.now() - 7 * 864e5
    const byStage = Object.fromEntries(STAGES.map(s => [s.id, 0]))
    leads.forEach(l => { const s = l.leadStatus || 'new'; byStage[s] = (byStage[s] || 0) + 1 })
    return {
      live: properties.filter(p => p.published !== false).length,
      drafts: properties.filter(p => p.published === false).length,
      today: leads.filter(l => leadTs(l) >= d0).length,
      yday: leads.filter(l => leadTs(l) >= d1 && leadTs(l) < d0).length,
      week: leads.filter(l => leadTs(l) >= w).length,
      hot: leads.filter(l => l.enrichment?.intent === 'hot').length,
      byStage,
    }
  }, [properties, leads])
  const recent = useMemo(() => [...leads].sort((a, b) => leadTs(b) - leadTs(a)).slice(0, 6), [leads])
  const autoOn = autoCfg ? autoCfg.config?.enabled !== false : null
  const maxStage = Math.max(...Object.values(stats.byStage), 1)

  return (
    <div className="ah-home" style={{ display: 'flex', flexDirection: 'column', gap: 16, color: T.text }}>
      <style>{CSS}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: T.text3, fontWeight: 600 }}>{dateStr}</div>
          <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800, letterSpacing: '-.015em', color: T.text }}>{greet} 👋</h1>
          <div style={{ fontSize: 13, color: T.text2, marginTop: 4 }}>{t.sub}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => window.open('/', '_blank')} style={{ height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid rgba(var(--ink),.16)', background: 'transparent', color: T.text2, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}><FaGlobe size={12}/>{t.viewSite}</button>
          {onNewProperty && <button type="button" onClick={onNewProperty} style={{ height: 36, padding: '0 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8490D8,#6B77C4)', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: '0 6px 18px rgba(132,144,216,.28)' }}><FaPlus size={11}/>{t.newProp}</button>}
        </div>
      </div>

      <div className="ah-kpi">
        <Kpi icon={FaUsers} color="#22C55E" label={t.leads} value={leads.length} sub={t.week(stats.week)} onClick={() => setTab('leads')}/>
        <Kpi icon={FaFire} color="#F97316" label={t.today} value={stats.today} sub={t.yday(stats.yday)} onClick={() => setTab('leads')}/>
        <Kpi icon={FaBuilding} color="#8490D8" label={t.active} value={stats.live} sub={t.of(properties.length)} onClick={() => setTab('live')}/>
        <Kpi icon={FaFileAlt} color="#F7C948" label={t.drafts} value={stats.drafts} sub={t.draftsSub} onClick={() => setTab('props')}/>
        <Kpi icon={FaClipboardList} color="#60A5FA" label={t.intake} value={intakeNew} sub={t.intakeSub} onClick={() => setTab('sellers')}/>
        <Kpi icon={FaWhatsapp} color="#25D366" label="WhatsApp" value={chatsUnread} sub={t.unread(chatsUnread)} onClick={() => setTab('chats')}/>
      </div>

      <Card style={{ padding: 16 }}>
        <Head title={t.status}/>
        <div className="ah-status">
          <StatusTile icon={FaWhatsapp} label={t.wa} onClick={() => setTab('chats')}
            state={wa === null ? 'idle' : wa === 'authorized' ? 'ok' : 'bad'} detail={wa === null ? t.checking : wa === 'authorized' ? t.ok : t.off}/>
          <StatusTile icon={FaChartLine} label={t.ga} onClick={() => setTab('analytics')}
            state={ga === null ? 'idle' : ga.configured && !ga.error ? 'ok' : 'warn'} detail={ga === null ? t.checking : ga.configured && !ga.error ? t.live(ga.activeUsers || 0) : t.setup}/>
          <StatusTile icon={FaRobot} label={t.auto} onClick={() => setTab('automations')}
            state={autoOn === null ? 'idle' : autoOn ? 'ok' : 'warn'} detail={autoOn === null ? t.checking : autoOn ? t.on : t.paused}/>
          <StatusTile icon={FaGlobe} label={t.site} onClick={() => window.open('/', '_blank')} state="ok" detail={`${t.online} · afikhanahal.co.il`}/>
        </div>
      </Card>

      <div className="ah-2">
        <Card>
          <Head title={t.recentLeads} action={<LinkBtn onClick={() => setTab('leads')} Arrow={Arrow}>{t.all}</LinkBtn>}/>
          {recent.length ? recent.map((l, i) => {
            const st = STAGES.find(s => s.id === (l.leadStatus || 'new')) || STAGES[0]
            const src = srcLabel(l, t)
            return (
              <button type="button" key={l.id || i} className="ah-row" onClick={() => setTab('leads')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', border: 'none', borderBottom: i < recent.length - 1 ? `1px solid ${T.divider}` : 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start', color: T.text, borderRadius: 8 }}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(132,144,216,.16)', color: T.brandText, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{[...(l.name || '?').trim()][0] || '?'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || t.noName}</span>
                  <span style={{ display: 'block', fontSize: 12, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[src, leadTs(l) ? ago(leadTs(l), t) : ''].filter(Boolean).join(' · ')}</span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: st.color, background: `${st.color}1f`, borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap', flexShrink: 0 }}>{st[lang] || st.he}</span>
              </button>
            )
          }) : <div style={{ fontSize: 13, color: T.text3, padding: '18px 0', textAlign: 'center' }}>{t.noLeads}</div>}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <Card>
            <Head title={t.pipeline} sub={t.pipelineSub}/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {STAGES.map(s => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '84px minmax(0,1fr) 32px', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
                  <span style={{ color: T.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s[lang] || s.he}</span>
                  <span style={{ height: 8, borderRadius: 5, background: 'rgba(var(--ov),.05)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${(stats.byStage[s.id] / maxStage) * 100}%`, background: s.color, borderRadius: 5, transition: 'width .4s' }}/></span>
                  <b style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums', color: T.text }}>{stats.byStage[s.id] || 0}</b>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <Head title={t.recentProps} action={<LinkBtn onClick={() => setTab('props')} Arrow={Arrow}>{t.manage}</LinkBtn>}/>
            {properties.length ? [...properties].reverse().slice(0, 4).map((p, i) => (
              <div key={p.id || i} className="ah-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 6px', borderRadius: 8 }}>
                <span style={{ width: 44, height: 34, borderRadius: 8, overflow: 'hidden', background: 'rgba(132,144,216,.1)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.images?.[0] ? <img src={thumbImg(p.images[0])} onError={imgFallback} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : <FaBuilding size={12} style={{ color: T.brand }}/>}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || t.noName}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.location}</span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 8px', background: p.published !== false ? 'rgba(34,197,94,.14)' : 'rgba(247,201,72,.14)', color: p.published !== false ? '#22C55E' : '#F7C948' }}>{p.published !== false ? t.published : t.draft}</span>
              </div>
            )) : <div style={{ fontSize: 13, color: T.text3, padding: '14px 0', textAlign: 'center' }}>{t.noProps}</div>}
          </Card>
        </div>
      </div>
    </div>
  )
}
