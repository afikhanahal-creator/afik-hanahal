// ─── ADMIN: "טפסי מוכרים" — seller intake submissions (from /sell) ───────────
// Lists every property file the public seller form produced, with the full
// answer sheet grouped by section, uploaded media/documents (signed URLs from
// the private bucket), status pipeline, internal notes and export.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { FaWhatsapp, FaPhone, FaEnvelope, FaTrash, FaSearch, FaCopy, FaDownload, FaFileAlt, FaVideo, FaSyncAlt, FaExternalLinkAlt, FaCheck } from 'react-icons/fa'
import { buildSummary, headline, PROPERTY_TYPE_LABEL, DOC_TAG_LABEL, fmtNum } from './sellerFormSchema.js'

const ADMIN_TOKEN = 'AFIKhanahal2026'
const API = '/api/seller-form'
const H = { Authorization: `Bearer ${ADMIN_TOKEN}` }

export const SELLER_STATUSES = [
  { v: 'new',       l: 'חדש',           color: '#E05252' },
  { v: 'contacted', l: 'נוצר קשר',      color: '#F5A623' },
  { v: 'meeting',   l: 'נקבעה פגישה',   color: '#60D4F7' },
  { v: 'signed',    l: 'נחתם הסכם',     color: '#8490D8' },
  { v: 'marketing', l: 'בשיווק',        color: '#22C55E' },
  { v: 'closed',    l: 'נסגרה עסקה',    color: '#82F67F' },
  { v: 'rejected',  l: 'לא רלוונטי',    color: '#6B6B7A' },
]
const statusOf = v => SELLER_STATUSES.find(s => s.v === v) || SELLER_STATUSES[0]
const KIND_LABEL = { photos: 'תמונות', videos: 'סרטונים', plan: 'תוכנית', docs: 'מסמכים' }
const fmtDate = iso => { try { return new Date(iso).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }
const toIntl = raw => { const d = String(raw || '').replace(/\D/g, ''); if (d.startsWith('972')) return d; if (d.startsWith('0')) return '972' + d.slice(1); return d }

export default function SellerSubmissionsTab({ C }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [selId, setSelId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch(API, { headers: H })
      const data = await r.json().catch(() => [])
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`)
      setRows(Array.isArray(data) ? data : [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const open = useCallback(async id => {
    setSelId(id); setDetail(null); setDetailLoading(true); setNotesSaved(false)
    try {
      const r = await fetch(`${API}?id=${encodeURIComponent(id)}`, { headers: H })
      const data = await r.json().catch(() => null)
      if (!r.ok || !data) throw new Error(data?.error || `HTTP ${r.status}`)
      setDetail(data); setNotes(data.notes || '')
    } catch (e) { setError(e.message) }
    finally { setDetailLoading(false) }
  }, [])

  const patch = async (id, body) => {
    const r = await fetch(`${API}?id=${encodeURIComponent(id)}`, { method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || `HTTP ${r.status}`) }
  }
  const setStatus = async (id, status) => {
    setRows(rs => rs.map(x => x.id === id ? { ...x, status } : x))
    if (detail?.id === id) setDetail(d => ({ ...d, status }))
    try { await patch(id, { status }) } catch (e) { setError(e.message); load() }
  }
  const saveNotes = async () => {
    if (!detail) return
    try { await patch(detail.id, { notes }); setNotesSaved(true); setRows(rs => rs.map(x => x.id === detail.id ? { ...x, notes } : x)); setTimeout(() => setNotesSaved(false), 1800) }
    catch (e) { setError(e.message) }
  }
  const remove = async id => {
    if (!window.confirm('למחוק את התיק הזה לצמיתות, כולל כל הקבצים שהועלו?')) return
    try {
      const r = await fetch(`${API}?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: H })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setRows(rs => rs.filter(x => x.id !== id)); if (selId === id) { setSelId(null); setDetail(null) }
    } catch (e) { setError(e.message) }
  }

  const summary = useMemo(() => detail ? buildSummary(detail.answers || {}, 'he') : [], [detail])
  const copySummary = () => {
    if (!detail) return
    const lines = [`תיק ${detail.ref} · ${headline(detail.answers || {}, 'he')}`, `${detail.contact_name} · ${detail.phone}${detail.email ? ' · ' + detail.email : ''}`, '']
    summary.forEach(sec => { lines.push(`— ${sec.title} —`); sec.items.forEach(it => lines.push(`${it.label}: ${it.value}`)); lines.push('') })
    navigator.clipboard?.writeText(lines.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
  }
  const exportJson = () => {
    if (!detail) return
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${detail.ref || 'seller-form'}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter(r => (filter === 'all' || r.status === filter) && (!s || [r.ref, r.contact_name, r.phone, r.email, r.city, r.address, r.property_type_label].some(x => String(x || '').toLowerCase().includes(s))))
  }, [rows, q, filter])
  const counts = useMemo(() => rows.reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m }, {}), [rows])

  const purple = C?.purple || '#8490D8'
  const card = { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(132,144,216,.14)', borderRadius: 12 }
  const btn = (extra = {}) => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(132,144,216,.3)', background: 'rgba(132,144,216,.1)', color: purple, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', ...extra })

  return (
    <div style={{ display: 'flex', gap: 18, height: '100%', minHeight: 0, direction: 'rtl', color: '#E8E4D8' }}>
      {/* ── list ── */}
      <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', minHeight: 0, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>טפסי מוכרים <span style={{ fontSize: 12, color: purple, fontWeight: 600 }}>{rows.length}</span></div>
            <div style={{ fontSize: 11.5, color: 'rgba(232,228,216,.5)' }}>תיקי נכס שהגיעו מהטופס בכתובת <a href="/sell" target="_blank" rel="noreferrer" style={{ color: purple }}>/sell</a></div>
          </div>
          <button onClick={load} title="רענון" style={btn()}><FaSyncAlt size={11} style={loading ? { animation: 'spin 1s linear infinite' } : undefined}/></button>
        </div>
        <div style={{ position: 'relative' }}>
          <FaSearch size={12} style={{ position: 'absolute', right: 12, top: 11, color: 'rgba(232,228,216,.4)' }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש לפי שם, טלפון, עיר, מספר תיק…"
            style={{ width: '100%', padding: '9px 34px 9px 12px', borderRadius: 10, border: '1px solid rgba(132,144,216,.2)', background: 'rgba(255,255,255,.04)', color: '#E8E4D8', fontFamily: 'inherit', fontSize: 13 }}/>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[{ v: 'all', l: 'הכל' }, ...SELLER_STATUSES].map(s => (
            <button key={s.v} onClick={() => setFilter(s.v)} style={{ padding: '4px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${filter === s.v ? (s.color || purple) : 'rgba(132,144,216,.2)'}`, background: filter === s.v ? `${s.color || purple}22` : 'transparent', color: filter === s.v ? (s.color || purple) : 'rgba(232,228,216,.6)' }}>
              {s.l}{s.v !== 'all' && counts[s.v] ? ` · ${counts[s.v]}` : ''}
            </button>
          ))}
        </div>
        {error && <div style={{ fontSize: 12, color: '#E05252', background: 'rgba(224,82,82,.1)', border: '1px solid rgba(224,82,82,.3)', borderRadius: 8, padding: '8px 10px' }}>{error}</div>}
        <div className="admin-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
          {loading && !rows.length && <div style={{ color: 'rgba(232,228,216,.5)', fontSize: 13, padding: 20, textAlign: 'center' }}>טוען…</div>}
          {!loading && !filtered.length && <div style={{ color: 'rgba(232,228,216,.5)', fontSize: 13, padding: 20, textAlign: 'center' }}>{rows.length ? 'אין תוצאות לסינון הזה' : 'עדיין לא התקבלו טפסים. שתפו את הקישור /sell עם בעלי נכסים.'}</div>}
          {filtered.map(r => {
            const st = statusOf(r.status); const on = r.id === selId
            return (
              <button key={r.id} onClick={() => open(r.id)} style={{ ...card, textAlign: 'right', padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', borderColor: on ? purple : 'rgba(132,144,216,.14)', background: on ? 'rgba(132,144,216,.12)' : 'rgba(255,255,255,.03)', transition: 'all .15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{r.contact_name || '—'}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: st.color, background: `${st.color}1F`, border: `1px solid ${st.color}55`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>{st.l}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(232,228,216,.75)', marginTop: 3 }}>{[r.property_type_label, [r.address, r.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'rgba(232,228,216,.45)' }}>
                  <span dir="ltr">{r.ref}</span>
                  <span>{r.asking_price ? `₪${fmtNum(r.asking_price, 'he')}` : ''}{r.files_count ? ` · ${r.files_count} קבצים` : ''}</span>
                  <span>{fmtDate(r.created_at)}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── detail ── */}
      <div className="admin-scroll" style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', ...card, padding: 0 }}>
        {!selId && <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(232,228,216,.4)', fontSize: 14, padding: 40, textAlign: 'center' }}>בחרו תיק מהרשימה כדי לראות את כל הפרטים, הקבצים וההערות</div>}
        {selId && detailLoading && <div style={{ padding: 40, textAlign: 'center', color: 'rgba(232,228,216,.5)' }}>טוען תיק…</div>}
        {detail && !detailLoading && (
          <div style={{ padding: '20px 22px 30px' }}>
            {/* header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: '.14em', color: purple, fontWeight: 700 }}>תיק <span dir="ltr">{detail.ref}</span> · התקבל {fmtDate(detail.created_at)}{detail.lang === 'en' ? ' · מולא באנגלית' : ''}</div>
                <h2 style={{ margin: '6px 0 4px', fontSize: 21, fontWeight: 800 }}>{headline(detail.answers || {}, 'he') || PROPERTY_TYPE_LABEL(detail.property_type, 'he') || 'נכס'}</h2>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'rgba(232,228,216,.8)', alignItems: 'center' }}>
                  <b>{detail.contact_name}</b>
                  {detail.phone && <a href={`https://wa.me/${toIntl(detail.phone)}`} target="_blank" rel="noreferrer" style={{ ...btn({ background: 'rgba(37,211,102,.12)', borderColor: 'rgba(37,211,102,.4)', color: '#25D366' }) }}><FaWhatsapp size={12}/> <span dir="ltr">{detail.phone}</span></a>}
                  {detail.phone && <a href={`tel:${detail.phone}`} style={btn()}><FaPhone size={11}/> חיוג</a>}
                  {detail.email && <a href={`mailto:${detail.email}`} style={btn()}><FaEnvelope size={11}/> {detail.email}</a>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={detail.status || 'new'} onChange={e => setStatus(detail.id, e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${statusOf(detail.status).color}66`, background: `${statusOf(detail.status).color}1A`, color: statusOf(detail.status).color, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700 }}>
                  {SELLER_STATUSES.map(s => <option key={s.v} value={s.v} style={{ color: '#111' }}>{s.l}</option>)}
                </select>
                <button onClick={copySummary} style={btn()}>{copied ? <FaCheck size={11}/> : <FaCopy size={11}/>} {copied ? 'הועתק' : 'העתקת סיכום'}</button>
                <button onClick={exportJson} style={btn()}><FaDownload size={11}/> JSON</button>
                <button onClick={() => remove(detail.id)} style={btn({ color: '#E05252', borderColor: 'rgba(224,82,82,.35)', background: 'rgba(224,82,82,.08)' })}><FaTrash size={11}/> מחיקה</button>
              </div>
            </div>

            {/* key facts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, margin: '18px 0' }}>
              {[
                ['מחיר מבוקש', detail.asking_price ? `₪${fmtNum(detail.asking_price, 'he')}` : '—'],
                ['סוג נכס', PROPERTY_TYPE_LABEL(detail.property_type, 'he') || '—'],
                ['עיר', detail.city || '—'],
                ['כתובת', detail.address || '—'],
                ['קבצים', (detail.files || []).length],
              ].map(([k, v]) => (
                <div key={k} style={{ ...card, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10.5, color: 'rgba(232,228,216,.5)', letterSpacing: '.06em' }}>{k}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* property story */}
            {detail.story && (
              <div style={{ ...card, padding: '14px 16px', marginBottom: 18, borderColor: 'rgba(132,144,216,.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ fontSize: 12, letterSpacing: '.12em', color: purple, margin: 0, fontWeight: 700 }}>סיפור הנכס</h3>
                  <button onClick={() => navigator.clipboard?.writeText(detail.story)} style={btn()}><FaCopy size={11}/> העתקה</button>
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'rgba(232,228,216,.9)' }}>{detail.story}</div>
              </div>
            )}

            {/* files */}
            {(detail.files || []).length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ fontSize: 12, letterSpacing: '.12em', color: purple, margin: '0 0 8px', fontWeight: 700 }}>קבצים ({detail.files.length})</h3>
                {Object.entries(detail.files.reduce((m, f) => { (m[f.kind] = m[f.kind] || []).push(f); return m }, {})).map(([kind, list]) => (
                  <div key={kind} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'rgba(232,228,216,.6)', marginBottom: 6 }}>{KIND_LABEL[kind] || kind} · {list.length}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                      {list.map((f, i) => (
                        <a key={f.path || i} href={f.url || '#'} target="_blank" rel="noreferrer" title={f.name} style={{ ...card, overflow: 'hidden', textDecoration: 'none', color: 'inherit', display: 'block' }}>
                          <div style={{ height: 84, background: 'rgba(132,144,216,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: purple, overflow: 'hidden' }}>
                            {f.url && String(f.type || '').startsWith('image/') ? <img src={f.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : String(f.type || '').startsWith('video/') ? <FaVideo size={22}/> : <FaFileAlt size={22}/>}
                          </div>
                          <div style={{ padding: '6px 8px', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.tag ? DOC_TAG_LABEL(f.tag, 'he') : f.name}</div>
                          <div style={{ padding: '0 8px 6px', fontSize: 10, color: 'rgba(232,228,216,.45)', display: 'flex', justifyContent: 'space-between' }}><span>{f.size ? `${Math.round(f.size / 1024)}KB` : ''}</span><FaExternalLinkAlt size={9}/></div>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 10.5, color: 'rgba(232,228,216,.4)' }}>הקישורים תקפים לשעה. רענון התיק מנפיק קישורים חדשים.</div>
              </div>
            )}

            {/* answers */}
            {summary.map(sec => (
              <div key={sec.section} style={{ ...card, padding: '4px 16px', marginBottom: 10 }}>
                <h3 style={{ fontSize: 12, letterSpacing: '.12em', color: purple, margin: '12px 0 4px', fontWeight: 700 }}>{sec.title}</h3>
                {sec.items.map(it => (
                  <div key={it.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: '1px solid rgba(132,144,216,.1)', fontSize: 13 }}>
                    <span style={{ flex: '0 0 36%', color: 'rgba(232,228,216,.55)', lineHeight: 1.4 }}>{it.label}</span>
                    <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>{it.value}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* notes */}
            <div style={{ ...card, padding: 14, marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 style={{ fontSize: 12, letterSpacing: '.12em', color: purple, margin: 0, fontWeight: 700 }}>הערות פנימיות</h3>
                <button onClick={saveNotes} style={btn({ background: notesSaved ? 'rgba(34,197,94,.12)' : undefined, color: notesSaved ? '#22C55E' : undefined, borderColor: notesSaved ? 'rgba(34,197,94,.4)' : undefined })}>{notesSaved ? <><FaCheck size={11}/> נשמר</> : 'שמירת הערות'}</button>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="סיכום שיחה, הערכת שווי, משימות פתוחות…"
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid rgba(132,144,216,.2)', background: 'rgba(255,255,255,.04)', color: '#E8E4D8', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }}/>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
