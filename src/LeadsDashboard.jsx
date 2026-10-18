// Leads overview ("תמונת מצב"): KPIs, a funnel of the pipeline stages, the exits (no answer / not relevant), leads per
// campaign by stage, and a drill-down — click a stage (or a campaign × stage cell) and its leads open below with what
// needs attention: days in the stage, the last note, follow-ups, quick actions.
import { useMemo, useState } from 'react'
import { Phone, MessageSquare, ExternalLink, AlertCircle, Clock, Users, TrendingUp, CalendarClock, Inbox } from 'lucide-react'
import { leadCampaign, prettyLeadText } from './lib/leadFields.js'

const FUNNEL = ['new', 'contacted', 'discovery', 'negotiating', 'won']
const EXITS = ['lost', 'irrelevant']
const DAY = 864e5
const asNotes = n => (Array.isArray(n) ? n : typeof n === 'string' && n.trim() ? [{ text: n, ts: 0 }] : [])
const stageOf = l => l.leadStatus || 'new'
// when the lead entered its current stage: the last stage-log entry into it, else its arrival
const enteredAt = l => {
  const log = Array.isArray(l.stageLog) ? l.stageLog : []
  for (let i = log.length - 1; i >= 0; i--) if (log[i]?.to === stageOf(l)) return Number(log[i].at) || Date.parse(log[i].at) || l.ts || 0
  return l.ts || 0
}
// the furthest pipeline stage a lead ever reached (a lead that ended in "no answer" may have been "interested" before)
const reachedIdx = l => {
  let m = FUNNEL.indexOf(stageOf(l))
  for (const x of Array.isArray(l.stageLog) ? l.stageLog : []) m = Math.max(m, FUNNEL.indexOf(x?.to), FUNNEL.indexOf(x?.from))
  return m
}
const lastNote = l => asNotes(l.notes).filter(n => n.text).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || null
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime() }

export default function LeadsDashboard({ leads = [], stages = [], T, isDark, lang = 'he', onOpen, onOpenChat }) {
  const en = lang === 'en'
  const L = (he, e) => (en ? e : he)
  const st = id => stages.find(g => g.id === id) || { id, label: id, en: id, color: '#7D7D7D' }
  const stName = id => (en ? st(id).en : st(id).label)
  const [sel, setSel] = useState({ stage: 'new', campaign: '' })
  const [sort, setSort] = useState('oldest')
  const now = Date.now()

  const data = useMemo(() => {
    const by = Object.fromEntries([...FUNNEL, ...EXITS].map(k => [k, []]))
    for (const l of leads) (by[stageOf(l)] || (by[stageOf(l)] = [])).push(l)
    const total = leads.length
    const reached = FUNNEL.map((_, i) => leads.filter(l => reachedIdx(l) >= i).length)
    const camps = {}
    for (const l of leads) {
      const c = leadCampaign(l, lang) || L('ללא', 'None')
      const row = camps[c] || (camps[c] = { name: c, total: 0, by: {} })
      row.total++; row.by[stageOf(l)] = (row.by[stageOf(l)] || 0) + 1
    }
    const eod = endOfToday()
    return {
      by, total, reached,
      week: leads.filter(l => now - (l.ts || 0) < 7 * DAY).length,
      waiting: (by.new || []).filter(l => !lastNote(l)).length,
      due: leads.filter(l => { const f = Date.parse(l.followUp || ''); return f && f <= eod && !['won', 'irrelevant'].includes(stageOf(l)) }).length,
      wonRate: total ? Math.round(((by.won || []).length / Math.max(1, total - (by.irrelevant || []).length)) * 100) : 0,
      camps: Object.values(camps).sort((a, b) => b.total - a.total),
    }
  }, [leads, lang]) // eslint-disable-line

  const card = { background: isDark ? '#141B29' : '#FFFFFF', border: `1px solid ${isDark ? '#232E42' : '#E1E5F5'}`, borderRadius: 16, boxShadow: isDark ? '0 2px 12px rgba(0,0,0,.25)' : '0 2px 10px rgba(20,30,80,.06)' }
  const kpis = [
    { Ic: Users, label: L('לידים', 'Leads'), value: data.total, sub: L(`${data.week} השבוע`, `${data.week} this week`), color: '#0073EA' },
    { Ic: Inbox, label: L('חדשים בלי טיפול', 'New, untouched'), value: data.waiting, sub: L('ללא הערה או שיחה', 'no note or call yet'), color: '#FDAB3D', go: { stage: 'new' } },
    { Ic: CalendarClock, label: L('מעקבים להיום', 'Follow-ups due'), value: data.due, sub: L('כולל באיחור', 'including overdue'), color: data.due ? '#E2445C' : '#7D7D7D' },
    { Ic: TrendingUp, label: L('אחוז סגירה', 'Win rate'), value: `${data.wonRate}%`, sub: L(`${(data.by.won || []).length} נסגרו`, `${(data.by.won || []).length} won`), color: '#00C875', go: { stage: 'won' } },
  ]

  // ── drill-down list
  const list = useMemo(() => {
    let xs = (data.by[sel.stage] || []).filter(l => !sel.campaign || (leadCampaign(l, lang) || L('ללא', 'None')) === sel.campaign)
    xs = xs.map(l => ({ l, at: enteredAt(l), note: lastNote(l), fu: Date.parse(l.followUp || '') || 0 }))
    if (sort === 'oldest') xs.sort((a, b) => a.at - b.at)
    else if (sort === 'newest') xs.sort((a, b) => b.at - a.at)
    else xs.sort((a, b) => (a.fu || Infinity) - (b.fu || Infinity))
    return xs
  }, [data, sel, sort, lang]) // eslint-disable-line
  const avgDays = list.length ? Math.round(list.reduce((s, x) => s + (now - x.at) / DAY, 0) / list.length) : 0
  const noNote = list.filter(x => !x.note).length
  const overdue = list.filter(x => x.fu && x.fu < now).length
  const selCamps = useMemo(() => {
    const m = {}
    for (const l of data.by[sel.stage] || []) { const c = leadCampaign(l, lang) || L('ללא', 'None'); m[c] = (m[c] || 0) + 1 }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [data, sel.stage, lang]) // eslint-disable-line

  const pick = (stage, campaign = '') => { setSel({ stage, campaign }); setTimeout(() => document.getElementById('ld-drill')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30) }
  const maxCount = Math.max(1, ...FUNNEL.map(k => (data.by[k] || []).length))
  const fmtD = ts => new Date(ts).toLocaleDateString(en ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'short' })
  const days = ms => { const d = Math.floor(ms / DAY); return d <= 0 ? L('היום', 'today') : d === 1 ? L('יום', '1 day') : L(`${d} ימים`, `${d} days`) }

  return (
    <div style={{ padding: '18px 20px 40px', direction: en ? 'ltr' : 'rtl', background: isDark ? '#0D1117' : '#F3F5FB', minHeight: '100%' }}>
      <style>{`
        .ld-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .ld-main{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;margin-top:14px;align-items:start}
        .ld-btn{transition:transform .12s, box-shadow .15s, background .15s}
        .ld-btn:hover{transform:translateY(-1px)}
        .ld-row:hover{background:${isDark ? '#1A2335' : '#F4F6FD'}}
        @media (max-width:1100px){.ld-main{grid-template-columns:1fr}}
        @media (max-width:760px){.ld-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.ld-item{grid-template-columns:minmax(0,1fr) auto!important;row-gap:4px!important}.ld-note,.ld-when{grid-column:1/-1}.ld-acts{grid-row:1;grid-column:2}}
        @media (prefers-reduced-motion:reduce){.ld-btn{transition:none}.ld-btn:hover{transform:none}}
      `}</style>

      {/* KPIs */}
      <div className="ld-grid">
        {kpis.map(k => {
          const Tag = k.go ? 'button' : 'div'
          return (
            <Tag key={k.label} type={k.go ? 'button' : undefined} className={k.go ? 'ld-btn' : undefined} onClick={k.go ? () => pick(k.go.stage) : undefined}
              style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'start', fontFamily: 'inherit', cursor: k.go ? 'pointer' : 'default', color: T.text }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: `${k.color}1c`, color: k.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><k.Ic size={18}/></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 24, fontWeight: 900, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{k.value}</span>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: T.text }}>{k.label}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: T.textSub }}>{k.sub}</span>
              </span>
            </Tag>
          )
        })}
      </div>

      <div className="ld-main">
        {/* Funnel */}
        <section style={{ ...card, padding: 18 }} aria-label={L('משפך לידים', 'Lead funnel')}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.text }}>{L('משפך הלידים', 'Lead funnel')}</h3>
            <span style={{ fontSize: 12, color: T.textSub }}>{L('לחצו על שלב כדי לראות את הלידים שבו', 'Click a stage to see its leads')}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {FUNNEL.map((k, i) => {
              const n = (data.by[k] || []).length, s = st(k), on = sel.stage === k
              const w = 34 + 66 * (n / maxCount)
              const pct = data.total ? Math.round((data.reached[i] / data.total) * 100) : 0
              return (
                <button key={k} type="button" className="ld-btn" onClick={() => pick(k)} aria-pressed={on}
                  style={{ display: 'grid', gridTemplateColumns: '110px minmax(0,1fr) 108px', alignItems: 'center', gap: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: T.text, textAlign: 'start' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: on ? s.color : T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stName(k)}</span>
                  <span style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{ width: `${w}%`, height: 40, borderRadius: 10, background: `linear-gradient(90deg, ${s.color}, ${s.color}cc)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, fontVariantNumeric: 'tabular-nums', boxShadow: on ? `0 0 0 3px ${s.color}55, 0 6px 18px ${s.color}44` : `0 2px 8px ${s.color}33`, transition: 'width .4s' }}>{n}</span>
                  </span>
                  <span style={{ fontSize: 11.5, color: T.textSub, lineHeight: 1.3 }} title={L('כמה מכל הלידים הגיעו לשלב הזה או מעבר לו', 'Share of all leads that reached this stage or beyond')}>
                    <b style={{ color: T.text, fontSize: 13 }}>{pct}%</b> {L('הגיעו לכאן', 'reached')}
                  </span>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {EXITS.map(k => {
              const n = (data.by[k] || []).length, s = st(k), on = sel.stage === k
              return (
                <button key={k} type="button" className="ld-btn" onClick={() => pick(k)} aria-pressed={on}
                  style={{ flex: 1, minWidth: 150, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', background: on ? `${s.color}22` : 'transparent', border: `1.5px ${on ? 'solid' : 'dashed'} ${s.color}88`, color: T.text }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{stName(k)}</span>
                  <span style={{ fontSize: 11.5, color: T.textSub, marginInlineStart: 'auto' }}>{data.total ? Math.round((n / data.total) * 100) : 0}%</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Campaign × stage */}
        <section style={{ ...card, padding: 18, overflowX: 'auto' }} aria-label={L('לפי קמפיין', 'By campaign')}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: T.text }}>{L('לפי קמפיין', 'By campaign')}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, color: T.text }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'start', padding: '6px 6px', color: T.textSub, fontWeight: 700 }}>{L('קמפיין', 'Campaign')}</th>
                <th style={{ padding: '6px 4px', color: T.textSub, fontWeight: 700 }}>{L('סה"כ', 'Total')}</th>
                {[...FUNNEL, ...EXITS].map(k => <th key={k} title={stName(k)} style={{ padding: '6px 4px' }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: st(k).color }}/></th>)}
              </tr>
            </thead>
            <tbody>
              {data.camps.slice(0, 12).map(c => (
                <tr key={c.name} style={{ borderTop: `1px solid ${isDark ? '#232E42' : '#EDF0F8'}` }}>
                  <td style={{ padding: '7px 6px', fontWeight: 700, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>{c.name}</td>
                  <td style={{ padding: '7px 4px', textAlign: 'center', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{c.total}</td>
                  {[...FUNNEL, ...EXITS].map(k => {
                    const n = c.by[k] || 0, on = sel.stage === k && sel.campaign === c.name
                    return (
                      <td key={k} style={{ padding: 2, textAlign: 'center' }}>
                        {n ? <button type="button" onClick={() => pick(k, c.name)} title={`${c.name} · ${stName(k)}`} aria-pressed={on}
                          style={{ minWidth: 30, height: 26, borderRadius: 7, border: on ? `2px solid ${st(k).color}` : 'none', background: `${st(k).color}${n >= 10 ? '44' : '22'}`, color: T.text, fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums' }}>{n}</button>
                          : <span style={{ color: T.textDim }}>·</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!data.camps.length && <div style={{ fontSize: 13, color: T.textSub, padding: '12px 0' }}>{L('אין לידים', 'No leads')}</div>}
        </section>
      </div>

      {/* Drill-down */}
      <section id="ld-drill" style={{ ...card, marginTop: 14, overflow: 'hidden', scrollMarginTop: 12 }} aria-label={stName(sel.stage)}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${isDark ? '#232E42' : '#EDF0F8'}`, background: `linear-gradient(90deg, ${st(sel.stage).color}18, transparent)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: st(sel.stage).color }}/>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: T.text }}>{stName(sel.stage)}</h3>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', background: st(sel.stage).color, borderRadius: 20, padding: '1px 10px' }}>{list.length}</span>
            {sel.campaign && <button type="button" onClick={() => setSel(x => ({ ...x, campaign: '' }))} style={{ fontSize: 12, fontWeight: 700, color: T.text, background: isDark ? '#232E42' : '#E8ECF8', border: 'none', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>{sel.campaign} ✕</button>}
            <span style={{ flex: 1 }}/>
            <label style={{ fontSize: 12, color: T.textSub, display: 'flex', alignItems: 'center', gap: 6 }}>
              {L('מיון', 'Sort')}
              <select value={sort} onChange={e => setSort(e.target.value)} style={{ background: isDark ? '#1A2335' : '#F4F6FD', color: T.text, border: `1px solid ${isDark ? '#2A3347' : '#D8DCF0'}`, borderRadius: 8, padding: '5px 8px', fontFamily: 'inherit', fontSize: 12 }}>
                <option value="oldest">{L('הכי הרבה זמן בשלב', 'Longest in stage')}</option>
                <option value="newest">{L('נכנסו לשלב לאחרונה', 'Newest in stage')}</option>
                <option value="followup">{L('לפי מעקב קרוב', 'By next follow-up')}</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 12.5, color: T.textSub }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Clock size={13}/>{L('ממוצע בשלב:', 'Avg. in stage:')} <b style={{ color: T.text }}>{L(`${avgDays} ימים`, `${avgDays} days`)}</b></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: noNote ? '#D97706' : T.textSub }}><AlertCircle size={13}/>{L('בלי תיעוד:', 'No notes:')} <b>{noNote}</b></span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: overdue ? '#E2445C' : T.textSub }}><CalendarClock size={13}/>{L('מעקב באיחור:', 'Overdue follow-up:')} <b>{overdue}</b></span>
          </div>
          {selCamps.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {selCamps.map(([c, n]) => {
                const on = sel.campaign === c
                return <button key={c} type="button" onClick={() => setSel(x => ({ ...x, campaign: on ? '' : c }))} aria-pressed={on}
                  style={{ fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? st(sel.stage).color : (isDark ? '#2A3347' : '#D8DCF0')}`, background: on ? `${st(sel.stage).color}22` : 'transparent', color: T.text }}>{c} · {n}</button>
              })}
            </div>
          )}
        </div>
        {!list.length && <div style={{ padding: '30px 18px', textAlign: 'center', color: T.textSub, fontSize: 13.5 }}>{L('אין לידים בשלב הזה', 'No leads in this stage')}</div>}
        <div role="list">
          {list.slice(0, 200).map(({ l, at, note, fu }) => {
            const camp = leadCampaign(l, lang), late = fu && fu < now
            const inStage = now - at
            return (
              <div key={l.id} role="listitem" className="ld-row ld-item" onClick={() => onOpen?.(l)}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(170px,1.1fr) minmax(0,1.6fr) 120px auto', gap: 12, alignItems: 'center', padding: '11px 18px', borderTop: `1px solid ${isDark ? '#1C2536' : '#F0F2F9'}`, cursor: 'pointer' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || '—'}{camp && <span style={{ fontSize: 11.5, fontWeight: 500, color: T.textSub, marginInlineStart: 5 }}>(<bdi>{camp}</bdi>)</span>}</div>
                  <div style={{ fontSize: 12, color: T.textSub, direction: 'ltr', textAlign: en ? 'left' : 'right' }}>{l.phone || ''}</div>
                </div>
                <div className="ld-note" style={{ minWidth: 0, fontSize: 12.5, color: note ? T.text : T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={note?.text || ''}>
                  {note ? `📝 ${note.text}` : l.msg ? prettyLeadText(l.msg, lang) : L('אין תיעוד עדיין', 'Nothing logged yet')}
                </div>
                <div className="ld-when" style={{ fontSize: 11.5, lineHeight: 1.45 }}>
                  <div style={{ color: inStage > 7 * DAY && !['won', 'irrelevant'].includes(sel.stage) ? '#D97706' : T.textSub, fontWeight: 700 }}>{L('בשלב', 'In stage')} {days(inStage)}</div>
                  {fu ? <div style={{ color: late ? '#E2445C' : '#0073EA', fontWeight: 700 }}>⏰ {fmtD(fu)}</div> : null}
                </div>
                <div className="ld-acts" style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                  {l.phone && <a href={`tel:${l.phone}`} aria-label={L('התקשר', 'Call')} title={L('התקשר', 'Call')} style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0073EA14', color: '#0073EA', border: '1px solid #0073EA30' }}><Phone size={13}/></a>}
                  {l.phone && onOpenChat && <button type="button" onClick={() => onOpenChat(l)} aria-label="WhatsApp" title="WhatsApp" style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#25D36614', color: '#25D366', border: '1px solid #25D36630', cursor: 'pointer' }}><MessageSquare size={13}/></button>}
                  <button type="button" onClick={() => onOpen?.(l)} aria-label={L('פתח', 'Open')} title={L('פתח', 'Open')} style={{ width: 30, height: 30, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: isDark ? '#232E42' : '#EEF1FA', color: T.textSub, border: 'none', cursor: 'pointer' }}><ExternalLink size={13}/></button>
                </div>
              </div>
            )
          })}
        </div>
        {list.length > 200 && <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: T.textSub }}>{L(`מוצגים 200 מתוך ${list.length}`, `Showing 200 of ${list.length}`)}</div>}
      </section>
    </div>
  )
}
