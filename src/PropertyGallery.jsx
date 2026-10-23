// Admin → נכסים: a gallery-first workspace. The page opens on the properties themselves (no form above them): a compact
// header (title, counts, one primary action "נכס חדש" = the property wizard, a quick form, sync / refresh / backup), a sticky
// toolbar (search, visibility, category, status, sort, gallery / site-order view) and the gallery — a click on a card opens
// that property for editing (the same record, never a copy). The site-order list (PropertyManagerList in AdminPanel.jsx,
// drag to reorder) stays one click away. Filters are kept for the session, so coming back from an edit lands where you were.
import { useEffect, useMemo, useRef, useState, lazy, Suspense, createContext, useContext } from 'react'

const PropertyShare = lazy(() => import('./PropertyShare.jsx'))
const SS_KEY = 'afik_props_view_v1'
const readView = () => { try { return JSON.parse(sessionStorage.getItem(SS_KEY) || '{}') } catch { return {} } }

export const PG_CSS = `
.pg{--pg-gap:16px;direction:rtl}
.pg-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.pg-title{margin:0;font-size:22px;font-weight:700;letter-spacing:-.01em;color:var(--au-text)}
.pg-sub{display:flex;gap:14px;flex-wrap:wrap;margin-top:4px;font-size:13px;color:var(--au-text2)}
.pg-sub b{font-weight:700;color:var(--au-text)}
.pg-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-inline-end:6px;vertical-align:1px}
.pg-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pg-btn{height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--au-s3-line);background:var(--au-s2);color:var(--au-text);font:inherit;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px;white-space:nowrap;transition:background .15s,border-color .15s}
.pg-btn:hover{border-color:rgba(var(--brand-rgb),.55);background:rgba(var(--brand-rgb),.06)}
.pg-btn.pri{background:var(--au-brand);border-color:var(--au-brand);color:#fff;font-weight:700;padding:0 18px}
.pg-btn.pri:hover{filter:brightness(1.08);background:var(--au-brand)}
.pg-btn:disabled{opacity:.5;cursor:default}
.pg-more{position:relative}
.pg-menu{position:absolute;top:calc(100% + 6px);inset-inline-end:0;z-index:40;min-width:210px;background:var(--au-pop);border:1px solid var(--au-s2-line);border-radius:12px;box-shadow:var(--au-shadow3);padding:6px;display:flex;flex-direction:column;gap:2px}
.pg-menu button{text-align:start;padding:9px 12px;border-radius:8px;border:none;background:transparent;color:var(--au-text);font:inherit;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:9px}
.pg-menu button:hover{background:rgba(var(--brand-rgb),.1)}
.pg-menu button.danger{color:var(--au-red-text)}
.pg-menu button.danger:hover{background:rgba(224,82,82,.12)}
.pg-menu hr{border:none;height:1px;background:var(--au-divider);margin:4px 6px}
.pg-bar{position:sticky;top:-22px;z-index:20;display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 0;margin-bottom:6px;background:var(--au-page,var(--au-bg))}
.pg-search{position:relative;flex:1 1 240px;max-width:420px}
.pg-search input{width:100%;box-sizing:border-box;height:36px;padding:0 36px 0 12px;border-radius:10px;border:1px solid var(--au-s3-line);background:var(--au-s2);color:var(--au-text);font:inherit;font-size:13px;outline:none}
.pg-search input:focus{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.16)}
.pg-search svg{position:absolute;inset-inline-start:12px;top:50%;transform:translateY(-50%);color:var(--au-text3)}
.pg-seg{display:inline-flex;background:rgba(var(--ov),.05);border:1px solid var(--au-s3-line);border-radius:10px;padding:3px;gap:2px}
.pg-seg button{height:28px;padding:0 11px;border-radius:7px;border:none;background:transparent;color:var(--au-text2);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap}
.pg-seg button[aria-pressed="true"]{background:var(--au-seg-active,var(--au-s2));color:var(--au-text);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.pg-sel{height:36px;padding:0 10px;border-radius:10px;border:1px solid var(--au-s3-line);background:var(--au-s2);color:var(--au-text);font:inherit;font-size:13px;cursor:pointer}
.pg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:var(--pg-gap)}
.pg-card{position:relative;display:flex;flex-direction:column;background:var(--au-card-solid,var(--au-s2));border:1px solid var(--au-s2-line);border-radius:14px;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .15s;outline:none}
.pg-card:hover{border-color:rgba(var(--brand-rgb),.5);box-shadow:0 10px 28px rgba(0,0,0,.14);transform:translateY(-2px)}
.pg-card:focus-visible{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.25)}
.pg-card.sel{border-color:var(--au-brand);box-shadow:0 0 0 2px rgba(var(--brand-rgb),.35)}
.pg-card.hidden .pg-img img{filter:saturate(.55)}
.pg-img{position:relative;aspect-ratio:4/3;background:rgba(var(--brand-rgb),.08);overflow:hidden;border-radius:13px 13px 0 0}
.pg-card.menu-open{z-index:60;transform:none}
.pg-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s}
.pg-card:hover .pg-img img{transform:scale(1.03)}
.pg-noimg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--au-brand-text);font-size:12px}
.pg-badges{position:absolute;top:10px;inset-inline-start:10px;inset-inline-end:10px;display:flex;gap:6px;align-items:center;pointer-events:none}
.pg-pill{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:700;background:rgba(10,10,20,.72);color:#fff;backdrop-filter:blur(4px)}
.pg-pill .d{width:6px;height:6px;border-radius:50%}
.pg-pos{margin-inline-start:auto}
.pg-count{position:absolute;bottom:10px;inset-inline-end:10px}
.pg-chk{position:absolute;bottom:10px;inset-inline-start:10px;width:24px;height:24px;border-radius:7px;border:2px solid #fff;background:rgba(10,10,20,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;cursor:pointer;opacity:0;transition:opacity .15s;padding:0}
.pg-card:hover .pg-chk,.pg-card.sel .pg-chk,.pg.selecting .pg-chk,.pg-chk:focus-visible{opacity:1}
.pg-card.sel .pg-chk{background:var(--au-brand);border-color:var(--au-brand)}
.pg-body{padding:12px 14px 10px;display:flex;flex-direction:column;gap:5px;flex:1;min-width:0}
.pg-cat{font-size:11.5px;color:var(--au-brand-text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pg-name{font-size:15px;font-weight:700;line-height:1.35;color:var(--au-text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em}
.pg-loc{font-size:12.5px;color:var(--au-text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pg-specs{font-size:12px;color:var(--au-text3);display:flex;gap:10px;flex-wrap:wrap}
.pg-price{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-top:auto;padding-top:6px}
.pg-price b{font-size:16px;font-weight:800;color:var(--au-text);font-variant-numeric:tabular-nums}
.pg-price b.none{font-size:13px;font-weight:600;color:var(--au-text3)}
.pg-price small{font-size:11px;color:var(--au-text3);white-space:nowrap}
.pg-foot{display:flex;align-items:center;gap:6px;padding:8px 10px 10px;border-top:1px solid var(--au-divider)}
.pg-tog{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 10px 0 4px;border-radius:999px;border:1px solid var(--au-s3-line);background:transparent;color:var(--au-text2);font:inherit;font-size:12px;font-weight:600;cursor:pointer}
.pg-tog .sw{position:relative;width:28px;height:16px;border-radius:999px;background:rgba(var(--ov),.2);transition:background .15s}
.pg-tog .sw::after{content:"";position:absolute;top:2px;inset-inline-start:2px;width:12px;height:12px;border-radius:50%;background:#fff;transition:inset-inline-start .15s}
.pg-tog.on{color:var(--au-green-text);border-color:rgba(34,197,94,.4)}
.pg-tog.on .sw{background:#22C55E}
.pg-tog.on .sw::after{inset-inline-start:14px}
.pg-ico{width:30px;height:28px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--au-text2);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:14px;padding:0}
.pg-ico:hover{background:rgba(var(--ov),.07);color:var(--au-text)}
.pg-edit{margin-inline-start:auto;height:28px;padding:0 12px;border-radius:8px;border:none;background:rgba(var(--brand-rgb),.12);color:var(--au-brand-text);font:inherit;font-size:12px;font-weight:700;cursor:pointer}
.pg-edit:hover{background:var(--au-brand);color:#fff}
.pg-bulk{position:sticky;top:34px;z-index:25;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;margin-bottom:12px;background:var(--au-pop);border:1px solid rgba(var(--brand-rgb),.45);border-radius:12px;box-shadow:var(--au-shadow3)}
.pg-bulk b{font-size:13px;color:var(--au-brand-text);margin-inline-end:6px}
.pg-empty{text-align:center;padding:56px 16px;border:1px dashed var(--au-s3-line);border-radius:16px;color:var(--au-text2)}
.pg-empty h3{margin:10px 0 6px;font-size:16px;color:var(--au-text)}
@media (max-width:640px){.pg-edit,.pg-foot .pg-share{display:none}.pg-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}.pg-body{padding:10px}.pg-name{font-size:14px}.pg-foot .pg-tog span.t{display:none}.pg-bar{top:-14px}}
`
let cssIn = false
function useCss() { useEffect(() => { if (cssIn) return; cssIn = true; const el = document.createElement('style'); el.id = 'pg-css'; el.textContent = PG_CSS; document.head.appendChild(el) }, []) }

const Search = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
const Plus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
const priceText = p => { const n = Number(String(p.price || '').replace(/[^\d]/g, '')); return n ? `₪${n.toLocaleString('he-IL')}` : '' }
const when = t => { const d = new Date(t); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) : '' }

/** The page header: title, counts, the one primary action and the rest in a menu */
export function PropertiesHeader({ total, live, hidden, onNew, onQuickNew, onSyncAll, onRefresh, onBackup, syncing, view, setView }) {
  useCss()
  const [more, setMore] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!more) return
    const close = e => { if (!ref.current?.contains(e.target)) setMore(false) }
    const esc = e => { if (e.key === 'Escape') setMore(false) }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [more])
  return (
    <div className="pg-head">
      <div>
        <h2 className="pg-title">נכסים</h2>
        <div className="pg-sub">
          <span><span className="pg-dot" style={{ background: '#22C55E' }}/><b>{live}</b> באוויר</span>
          <span><span className="pg-dot" style={{ background: '#F5A623' }}/><b>{hidden}</b> מוסתרים וטיוטות</span>
          <span>סה״כ <b>{total}</b></span>
        </div>
      </div>
      <div className="pg-actions">
        <div className="pg-seg" role="group" aria-label="תצוגה">
          <button type="button" aria-pressed={view === 'gallery'} onClick={() => setView('gallery')}>גלריה</button>
          <button type="button" aria-pressed={view === 'order'} onClick={() => setView('order')} title="גרירה לקביעת סדר הנכסים באתר">סדר באתר</button>
        </div>
        <button type="button" className="pg-btn" onClick={onQuickNew} title="כל השדות בחלון אחד">טופס מהיר</button>
        <div className="pg-more" ref={ref}>
          <button type="button" className="pg-btn" aria-haspopup="menu" aria-expanded={more} onClick={() => setMore(m => !m)} disabled={syncing}>{syncing ? 'מסנכרן…' : 'עוד ▾'}</button>
          {more && (
            <div className="pg-menu" role="menu">
              <button role="menuitem" onClick={() => { setMore(false); onRefresh() }}>↺ רענון מהשרת</button>
              <button role="menuitem" onClick={() => { setMore(false); onSyncAll() }}>↻ סנכרון כל הנכסים לשרת</button>
              <button role="menuitem" onClick={() => { setMore(false); onBackup() }}>⬇ גיבוי (קובץ JSON)</button>
            </div>
          )}
        </div>
        <button type="button" className="pg-btn pri" onClick={onNew}><Plus/> נכס חדש</button>
      </div>
    </div>
  )
}

/** The gallery itself (toolbar, bulk bar, cards) */
export default function PropertyGallery({ list, publishedList, categories, statuses, thumbImg, imgFallback, lang = 'he',
  onEdit, onQuickEdit, publish, unpublish, setStatus, dup, del, onTop, refreshOne, bulkPatch, bulkDelete, onNew }) {
  useCss()
  const init = readView()
  const [q, setQ] = useState(init.q || '')
  const [vis, setVis] = useState(init.vis || 'all')        // all · live · hidden
  const [cat, setCat] = useState(init.cat || 'all')
  const [st, setSt] = useState(init.st || 'all')            // all · בשיווק · נמכר · הושכר
  const [sort, setSort] = useState(init.sort || 'order')    // order (as on the site) · updated · title · price
  const [selected, setSelected] = useState(() => new Set())
  const [menuId, setMenuId] = useState(null)
  const [shareProp, setShareProp] = useState(null)
  useEffect(() => { try { sessionStorage.setItem(SS_KEY, JSON.stringify({ q, vis, cat, st, sort })) } catch {} }, [q, vis, cat, st, sort])
  useEffect(() => {
    if (menuId === null) return
    const close = e => { if (!e.target.closest?.('[data-pg-menu]')) setMenuId(null) }
    const esc = e => { if (e.key === 'Escape') setMenuId(null) }
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [menuId])

  const posOf = useMemo(() => { const m = new Map(); publishedList.forEach((p, i) => m.set(String(p.id), i + 1)); return m }, [publishedList])
  const statusOf = p => (['נמכר', 'הושכר'].includes(p.status) ? p.status : 'בשיווק')
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let r = list.filter(p => (vis === 'all' || (vis === 'live' ? p.published !== false : p.published === false))
      && (cat === 'all' || p.category === cat) && (st === 'all' || statusOf(p) === st)
      && (!needle || [p.title, p.location, p.neighborhood, p.street, p.type, p.gush, p.helka, p.id].filter(Boolean).some(v => String(v).toLowerCase().includes(needle))))
    if (sort === 'updated') r = [...r].sort((a, b) => (Number(b.updatedAt) || Number(b.id) || 0) - (Number(a.updatedAt) || Number(a.id) || 0))
    else if (sort === 'title') r = [...r].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'he'))
    else if (sort === 'price') r = [...r].sort((a, b) => (Number(String(b.price || '').replace(/[^\d]/g, '')) || 0) - (Number(String(a.price || '').replace(/[^\d]/g, '')) || 0))
    return r
  }, [list, q, vis, cat, st, sort])
  const ids = rows.map(p => String(p.id))
  const selIds = [...selected].filter(id => ids.includes(id))
  const toggle = id => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const filtered = q || vis !== 'all' || cat !== 'all' || st !== 'all'
  const clearFilters = () => { setQ(''); setVis('all'); setCat('all'); setSt('all') }

  return (
    <div className={`pg${selIds.length ? ' selecting' : ''}`}>
      {shareProp && <Suspense fallback={null}><PropertyShare prop={shareProp} lang={lang} onClose={() => setShareProp(null)}/></Suspense>}
      <div className="pg-bar">
        <label className="pg-search"><Search/><input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש לפי שם, עיר, רחוב, סוג, גוש…" aria-label="חיפוש נכסים"/></label>
        <div className="pg-seg" role="group" aria-label="מצב באתר">
          {[['all', 'הכל'], ['live', 'באוויר'], ['hidden', 'מוסתרים']].map(([id, l]) => <button key={id} type="button" aria-pressed={vis === id} onClick={() => setVis(id)}>{l}</button>)}
        </div>
        <select className="pg-sel" value={cat} onChange={e => setCat(e.target.value)} aria-label="קטגוריה">
          <option value="all">כל הקטגוריות</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="pg-sel" value={st} onChange={e => setSt(e.target.value)} aria-label="סטטוס">
          <option value="all">כל הסטטוסים</option>
          {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select className="pg-sel" value={sort} onChange={e => setSort(e.target.value)} aria-label="מיון">
          <option value="order">לפי הסדר באתר</option>
          <option value="updated">עודכנו לאחרונה</option>
          <option value="title">לפי שם (א–ת)</option>
          <option value="price">לפי מחיר (גבוה לנמוך)</option>
        </select>
        <span style={{ fontSize: 12.5, color: 'var(--au-text3)', marginInlineStart: 'auto' }}>{rows.length} נכסים{filtered && <> · <button type="button" onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--au-brand-text)', font: 'inherit', cursor: 'pointer', padding: 0, fontWeight: 600 }}>ניקוי סינון</button></>}</span>
      </div>

      {selIds.length > 0 && (
        <div className="pg-bulk" role="region" aria-label="פעולות על הנבחרים">
          <b>נבחרו {selIds.length}</b>
          <button type="button" className="pg-btn" onClick={() => { bulkPatch(selIds, { published: true }); setSelected(new Set()) }}>פרסום באתר</button>
          <button type="button" className="pg-btn" onClick={() => { bulkPatch(selIds, { published: false }); setSelected(new Set()) }}>הסתרה מהאתר</button>
          {statuses.map(s => <button key={s.id} type="button" className="pg-btn" onClick={() => { bulkPatch(selIds, { status: s.id }); setSelected(new Set()) }}>סימון: {s.label}</button>)}
          <span style={{ flex: 1 }}/>
          <button type="button" className="pg-btn" onClick={() => setSelected(new Set(ids))}>בחירת כל {ids.length}</button>
          <button type="button" className="pg-btn" style={{ color: 'var(--au-red-text)' }} onClick={() => { bulkDelete(selIds); setSelected(new Set()) }}>מחיקה</button>
          <button type="button" className="pg-btn" onClick={() => setSelected(new Set())}>ביטול בחירה</button>
        </div>
      )}

      {!rows.length && (
        <div className="pg-empty">
          <div style={{ fontSize: 30 }} aria-hidden="true">🏠</div>
          <h3>{filtered ? 'לא נמצאו נכסים לסינון הזה' : 'עדיין אין נכסים'}</h3>
          <p style={{ margin: '0 0 14px', fontSize: 13 }}>{filtered ? 'נסו חיפוש אחר, או נקו את הסינון.' : 'נכס חדש נבנה באשף בכמה דקות, עם תמונות, מפה ותיאור.'}</p>
          {filtered ? <button type="button" className="pg-btn" onClick={clearFilters}>ניקוי סינון</button> : <button type="button" className="pg-btn pri" onClick={onNew}><Plus/> נכס חדש</button>}
        </div>
      )}

      <div className="pg-grid">
        {rows.map(p => {
          const id = String(p.id)
          const live = p.published !== false
          const c = categories.find(x => x.id === p.category)
          const status = statusOf(p)
          const sObj = statuses.find(s => s.id === status)
          const pos = posOf.get(id)
          const price = priceText(p)
          const specs = [p.rooms && `${p.rooms} חד׳`, p.size && `${p.size} מ״ר`, p.floor && `קומה ${p.floor}`, p.dunams && `${p.dunams} דונם`].filter(Boolean)
          const isSel = selected.has(id)
          const open = e => { if (e.target.closest('[data-pg-stop]')) return; onEdit(p) }
          return (
            <article key={id} className={`pg-card${isSel ? ' sel' : ''}${live ? '' : ' hidden'}${menuId === id ? ' menu-open' : ''}`} tabIndex={0} role="button"
              aria-label={`עריכת ${p.title || 'נכס ללא שם'}`} onClick={open} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onEdit(p) } }}>
              <div className="pg-img">
                {p.images?.[0]
                  ? <img src={thumbImg(p.images[0])} onError={imgFallback} alt="" loading="lazy" decoding="async"/>
                  : <div className="pg-noimg">{c?.Icon && <c.Icon size={26}/>}<span>אין תמונה</span></div>}
                <div className="pg-badges">
                  <span className="pg-pill"><span className="d" style={{ background: live ? '#22C55E' : '#F5A623' }}/>{live ? 'באוויר' : 'מוסתר'}</span>
                  {status !== 'בשיווק' && <span className="pg-pill" style={{ background: sObj?.color || '#E05252' }}>{status}</span>}
                  {p.exclusive && <span className="pg-pill">✦ בלעדי</span>}
                  {live && pos && <span className="pg-pill pg-pos" title="המיקום בעמוד הנכסים באתר">#{pos}</span>}
                </div>
                {(p.images?.length || 0) > 1 && <span className="pg-pill pg-count">📷 {p.images.length}</span>}
                <button type="button" data-pg-stop className="pg-chk" aria-pressed={isSel} aria-label={isSel ? 'ביטול בחירה' : 'בחירת הנכס'} onClick={() => toggle(id)}>{isSel ? '✓' : ''}</button>
              </div>
              <div className="pg-body">
                <span className="pg-cat">{[c?.label, p.type].filter(Boolean).join(' · ')}</span>
                <span className="pg-name">{p.title || 'נכס ללא שם'}</span>
                <span className="pg-loc">{[p.location, p.neighborhood, p.street].filter(Boolean).join(' · ') || '—'}</span>
                {specs.length > 0 && <span className="pg-specs">{specs.map(s => <span key={s}>{s}</span>)}</span>}
                <div className="pg-price">{price ? <b>{price}</b> : <b className="none">מחיר בפנייה</b>}{p.updatedAt && <small>עודכן {when(p.updatedAt)}</small>}</div>
              </div>
              <div className="pg-foot" data-pg-stop>
                <button type="button" className={`pg-tog${live ? ' on' : ''}`} onClick={() => (live ? unpublish(p.id) : publish(p.id))} title={live ? 'הסתרה מהאתר' : 'פרסום באתר'} aria-pressed={live}>
                  <span className="sw" aria-hidden="true"/><span className="t">{live ? 'באוויר' : 'מוסתר'}</span>
                </button>
                <button type="button" className="pg-ico pg-share" title="שיתוף וקידום" aria-label="שיתוף וקידום" onClick={() => setShareProp(p)}>↗</button>
                <div data-pg-menu style={{ position: 'relative' }}>
                  <button type="button" className="pg-ico" aria-haspopup="menu" aria-expanded={menuId === id} aria-label="פעולות נוספות" title="פעולות נוספות" onClick={() => setMenuId(menuId === id ? null : id)}>⋯</button>
                  {menuId === id && (
                    <div className="pg-menu" role="menu" style={{ bottom: 'calc(100% + 6px)', top: 'auto', insetInlineEnd: 'auto', insetInlineStart: 0, minWidth: 230 }}>
                      <button role="menuitem" onClick={() => { setMenuId(null); onEdit(p) }}>✏️ עריכה באשף</button>
                      {onQuickEdit && <button role="menuitem" onClick={() => { setMenuId(null); onQuickEdit(p) }}>⚡ עריכה מהירה (כל השדות)</button>}
                      <button role="menuitem" onClick={() => { setMenuId(null); dup(p.id) }}>📄 שכפול</button>
                      {live && pos > 1 && <button role="menuitem" onClick={() => { setMenuId(null); onTop(p.id) }}>⤒ לראש הרשימה באתר</button>}
                      {statuses.filter(s => s.id !== status).map(s => <button key={s.id} role="menuitem" onClick={() => { setMenuId(null); setStatus(p.id, s.id) }}>סימון: {s.label}</button>)}
                      <button role="menuitem" onClick={() => { setMenuId(null); window.open(`/p/${encodeURIComponent(p.id)}`, '_blank', 'noopener') }}>🔗 פתיחה באתר</button>
                      <button role="menuitem" onClick={() => { setMenuId(null); refreshOne(p) }}>↻ רענון מהשרת</button>
                      <hr/>
                      <button role="menuitem" className="danger" onClick={() => { setMenuId(null); del(p.id) }}>🗑 מחיקת הנכס</button>
                    </div>
                  )}
                </div>
                <button type="button" className="pg-edit" onClick={() => onEdit(p)}>עריכה</button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

// ── The quick form, in a side window instead of on the page ──────────────────────────────────────────────────────────
// Opens only from "טופס מהיר" (new) or "עריכה מהירה" (an existing property, same record). Every section starts open (the whole
// form at a glance); each can be folded, and "פתיחת הכל / סגירת הכל" does them all. Values live in the parent's form state,
// so folding a section never loses what was typed.
const SecCtx = createContext(null)

export const QF_CSS = `
.qf-bg{position:fixed;inset:0;z-index:2600;background:var(--au-overlay,rgba(0,0,0,.45));display:flex;justify-content:flex-start;animation:qf-fade .15s ease both}
@keyframes qf-fade{from{opacity:0}to{opacity:1}}
.qf{position:relative;height:100%;width:min(980px,100%);background:var(--au-page,var(--au-bg));border-inline-end:1px solid var(--au-s2-line);box-shadow:var(--au-shadow3);display:flex;flex-direction:column;animation:qf-in .2s ease both;direction:rtl}
@keyframes qf-in{from{transform:translateX(30px);opacity:.4}to{transform:none;opacity:1}}
.qf-head{display:flex;align-items:center;gap:10px;padding:14px 22px;border-bottom:1px solid var(--au-divider);background:var(--au-s1)}
.qf-head h3{margin:0;font-size:17px;font-weight:700;color:var(--au-text);flex:1;min-width:0}
.qf-body{flex:1;min-height:0;overflow-y:auto;padding:18px 22px 24px;display:flex;flex-direction:column;gap:12px}
.qf-foot{border-top:1px solid var(--au-divider);padding:12px 22px;background:var(--au-s1)}
.qf-sec{border:1px solid var(--au-s2-line);border-radius:14px;background:var(--au-s2)}
.qf-sec>button{width:100%;display:flex;align-items:center;gap:10px;padding:13px 16px;border:none;background:none;color:var(--au-text);font:inherit;font-size:14px;font-weight:700;cursor:pointer;text-align:start;border-radius:14px}
.qf-sec>button:hover{background:rgba(var(--ov),.03)}
.qf-sec>button .chev{margin-inline-start:auto;color:var(--au-text3);transition:transform .15s;font-size:12px}
.qf-sec>div{padding:4px 16px 14px}
.qf-x{width:34px;height:34px;border-radius:10px;border:1px solid var(--au-s3-line);background:transparent;color:var(--au-text2);cursor:pointer;font-size:15px}
.qf-x:hover{background:rgba(var(--ov),.07)}
@media (max-width:640px){.qf-head,.qf-body,.qf-foot{padding-inline:14px}}
`
let qfCss = false
function useQfCss() { useEffect(() => { if (qfCss) return; qfCss = true; const el = document.createElement('style'); el.id = 'qf-css'; el.textContent = QF_CSS; document.head.appendChild(el) }, []) }

export function QuickFormDrawer({ open, title, onClose, footer, children }) {
  useQfCss()
  const [closed, setClosed] = useState(() => new Set())
  const ids = useRef(new Set())
  useEffect(() => { if (open) setClosed(new Set()) }, [open])
  useEffect(() => {
    if (!open) return
    const k = e => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', k)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  const ctx = { closed, ids: ids.current, toggle: id => setClosed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  return (
    <div className="qf-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="qf" role="dialog" aria-modal="true" aria-label={title}>
        <div className="qf-head">
          <h3>{title}</h3>
          <button type="button" className="pg-btn" onClick={() => setClosed(new Set())}>פתיחת כל הסעיפים</button>
          <button type="button" className="pg-btn" onClick={() => setClosed(new Set(ids.current))}>סגירת כל הסעיפים</button>
          <button type="button" className="qf-x" onClick={onClose} aria-label="סגירה">✕</button>
        </div>
        <SecCtx.Provider value={ctx}><div className="qf-body">{children}</div></SecCtx.Provider>
        {footer && <div className="qf-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function FormSection({ id, title, children }) {
  const c = useContext(SecCtx)
  if (!c) return children   // outside the drawer: just the fields
  c.ids.add(id)
  const open = !c.closed.has(id)
  return (
    <section className="qf-sec" data-open={open}>
      <button type="button" aria-expanded={open} onClick={() => c.toggle(id)}>{title}<span className="chev" aria-hidden="true">{open ? '▾' : '◂'}</span></button>
      <div hidden={!open}>{children}</div>   {/* folded, not unmounted: an upload in progress keeps going */}
    </section>
  )
}
