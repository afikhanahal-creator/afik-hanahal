// "גלריה" next to "צירוף" in every chat (2026-11-08): every property's photos in one window — the lead's own project first —, pick
// one or several (across properties too, in the order picked), look at a photo big, and add them to the message as an album
// (the tray's remote files: nothing is uploaded again, Green fetches each photo by its URL). Optional: the properties' links into
// the box. Rules: src/lib/photoGallery.js (tested); the list: src/lib/propertiesStore.js.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './uiIcons.jsx'
import { imageThumb } from './lib/templateImage.js'
import { useSharedProperties } from './lib/propertiesStore.js'
import { galleryProperties, togglePick, picksToFiles, picksLinks, pushRecent } from './lib/photoGallery.js'

const RECENT_KEY = 'afik_gallery_recent_v1'
const readRecent = () => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } }
const big = url => `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1600&output=webp&q=82`

const TR = {
  he: { title: 'גלריית נכסים', sub: n => (n ? `בחרו תמונות לשליחה ל${n}` : 'בחרו תמונות לשליחה בשיחה'), search: 'חיפוש נכס, עיר, רחוב…', close: 'סגירה',
    recent: 'נבחרו לאחרונה', match: 'הנכס של הליד', hidden: 'לא באוויר', photos: n => `${n} תמונות`, all: n => `בחירת כל ה-${n}`, none: 'ניקוי',
    open: 'פתיחת הנכס באתר', zoom: 'הגדלה', picked: (n, r) => `${n} נבחרו${r > n ? ` · אפשר עד ${r}` : ' · הגעתם למקסימום'}`, nothing: 'עוד לא נבחרו תמונות — לחיצה על תמונה בוחרת אותה',
    links: 'להוסיף להודעה קישור לנכס', add: n => (n ? `הוספה להודעה (${n})` : 'הוספה להודעה'), cancel: 'ביטול', back: 'כל הנכסים', empty: 'אין נכסים עם תמונות',
    noHit: 'לא נמצא נכס', loading: 'טוען את הנכסים…', pick: 'בחירה', unpick: 'הסרה מהבחירה', prev: 'הקודמת', next: 'הבאה', remove: 'הסרה', count: (i, n) => `${i} מתוך ${n}` },
  en: { title: 'Property gallery', sub: n => (n ? `Pick photos to send to ${n}` : 'Pick photos to send'), search: 'Search a property, town, street…', close: 'Close',
    recent: 'Picked lately', match: 'The lead\'s property', hidden: 'Not on the site', photos: n => `${n} photos`, all: n => `Select all ${n}`, none: 'Clear',
    open: 'Open on the site', zoom: 'Enlarge', picked: (n, r) => `${n} selected${r > n ? ` · up to ${r}` : ' · that\'s the maximum'}`, nothing: 'No photos yet — click a photo to select it',
    links: 'Add the property link to the message', add: n => (n ? `Add to message (${n})` : 'Add to message'), cancel: 'Cancel', back: 'All properties', empty: 'No properties with photos',
    noHit: 'No property found', loading: 'Loading the properties…', pick: 'Select', unpick: 'Unselect', prev: 'Previous', next: 'Next', remove: 'Remove', count: (i, n) => `${i} of ${n}` },
}

const CSS = `
.pgk{position:fixed;inset:0;z-index:2600;background:var(--au-overlay,rgba(0,0,0,.45));display:flex;align-items:center;justify-content:center;padding:14px}
.pgk-win{width:min(1280px,100%);height:min(860px,calc(100dvh - 28px));display:flex;flex-direction:column;background:var(--au-pop,#fff);color:var(--au-text,#111);border:1px solid var(--au-line,#e5e7eb);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.28);overflow:hidden;font-size:14px}
.pgk-head{display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid var(--au-line)}
.pgk-head h2{margin:0;font-size:17px;font-weight:700;line-height:1.2}
.pgk-head small{display:block;font-size:12.5px;color:var(--au-text3);font-weight:500;margin-top:2px}
.pgk-search{flex:1;max-width:420px;margin-inline-start:auto;display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border-radius:999px;background:rgba(var(--ov,0,0,0),.05);border:1px solid var(--au-line);color:var(--au-text3)}
.pgk-search input{flex:1;min-width:0;border:none;background:transparent;color:var(--au-text);font:inherit;font-size:14px;outline:none;min-height:0}
.pgk-ib{flex:none;width:36px;height:36px;min-height:0;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:none;background:transparent;color:var(--au-text2);cursor:pointer}
.pgk-ib:hover{background:rgba(var(--ov,0,0,0),.07)}
.pgk-body{flex:1;min-height:0;display:grid;grid-template-columns:300px minmax(0,1fr)}
.pgk-side{overflow-y:auto;border-inline-end:1px solid var(--au-line);padding:8px}
.pgk-row{width:100%;display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:10px;border:none;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer;min-height:0}
.pgk-row:hover{background:rgba(var(--ov,0,0,0),.05)}
.pgk-row[aria-current=true]{background:rgba(var(--brand-rgb,63,78,176),.12)}
.pgk-row img,.pgk-row .ph{width:58px;height:44px;border-radius:8px;object-fit:cover;flex:none;background:rgba(var(--ov,0,0,0),.08)}
.pgk-row .ph{display:flex;align-items:center;justify-content:center;color:var(--au-text3)}
.pgk-row b{display:block;font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pgk-row span{display:block;font-size:12px;color:var(--au-text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pgk-tag{display:inline-block;font-size:10.5px;font-weight:600;border-radius:999px;padding:0 7px;line-height:17px;margin-inline-start:6px;vertical-align:1px}
.pgk-tag.m{background:rgba(22,163,74,.14);color:var(--au-green-text,#15803d)}
.pgk-tag.h{background:rgba(var(--ov,0,0,0),.08);color:var(--au-text3)}
.pgk-sel{flex:none;min-width:20px;height:20px;border-radius:999px;background:var(--au-brand,#3F4EB0);color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 6px}
.pgk-main{display:flex;flex-direction:column;min-width:0;min-height:0}
.pgk-mh{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--au-line)}
.pgk-mh h3{margin:0;font-size:15.5px;font-weight:700;min-width:0;flex:1}
.pgk-mh h3 small{display:block;font-size:12.5px;font-weight:500;color:var(--au-text3);margin-top:2px}
.pgk-btn{height:34px;min-height:0;padding:0 14px;border-radius:999px;border:1px solid var(--au-line);background:var(--au-pop);color:var(--au-text);font:inherit;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.pgk-btn:hover{border-color:rgba(var(--brand-rgb,63,78,176),.5)}
.pgk-grid{flex:1;min-height:0;overflow-y:auto;padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;align-content:start}
.pgk-tile{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:rgba(var(--ov,0,0,0),.07);cursor:pointer;border:none;padding:0;min-height:0;outline:none}
.pgk-tile img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .15s}
.pgk-tile:hover img{transform:scale(1.03)}
.pgk-tile:focus-visible{box-shadow:0 0 0 3px var(--au-brand)}
.pgk-tile[aria-pressed=true]{box-shadow:0 0 0 3px var(--au-brand)}
.pgk-tile[aria-pressed=true] img{opacity:.82}
.pgk-check{position:absolute;top:8px;inset-inline-start:8px;width:26px;height:26px;border-radius:999px;border:2px solid #fff;background:rgba(0,0,0,.28);color:#fff;font-size:12.5px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.pgk-tile[aria-pressed=true] .pgk-check{background:var(--au-brand);border-color:var(--au-brand)}
.pgk-zoom{position:absolute;bottom:8px;inset-inline-end:8px;width:32px;height:32px;min-height:0;border-radius:999px;border:none;background:rgba(0,0,0,.5);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity .12s}
.pgk-tile:hover .pgk-zoom,.pgk-tile:focus-within .pgk-zoom{opacity:1}
@media (hover:none){.pgk-zoom{opacity:1}}
.pgk-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--au-line);background:rgba(var(--ov,0,0,0),.03)}
.pgk-strip{flex:1;min-width:0;display:flex;gap:6px;overflow-x:auto;scrollbar-width:thin;align-items:center}
.pgk-strip .it{position:relative;flex:none;width:46px;height:46px;border-radius:8px;overflow:hidden}
.pgk-strip .it img{width:100%;height:100%;object-fit:cover}
.pgk-strip .it button{position:absolute;top:2px;inset-inline-end:2px;width:18px;height:18px;min-height:0;border-radius:999px;border:none;background:rgba(0,0,0,.6);color:#fff;font-size:11px;line-height:1;cursor:pointer;padding:0}
.pgk-strip .it i{position:absolute;bottom:2px;inset-inline-start:3px;font-style:normal;font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7)}
.pgk-hint{font-size:13px;color:var(--au-text3)}
.pgk-cnt{font-size:12.5px;color:var(--au-text2);white-space:nowrap}
.pgk-lk{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--au-text2);cursor:pointer;white-space:nowrap}
.pgk-lk input{width:16px;height:16px;min-height:0;accent-color:var(--au-brand);appearance:auto}
.pgk-go{height:40px;min-height:0;padding:0 20px;border-radius:999px;border:none;background:var(--au-brand,#3F4EB0);color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
.pgk-go:disabled{opacity:.45;cursor:default}
.pgk-empty{padding:40px 20px;text-align:center;color:var(--au-text3);grid-column:1/-1}
.pgk-lb{position:fixed;inset:0;z-index:2700;background:rgba(0,0,0,.9);display:flex;flex-direction:column;color:#fff}
.pgk-lb-top{display:flex;align-items:center;gap:10px;padding:10px 14px}
.pgk-lb-top b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14.5px}
.pgk-lb-img{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;position:relative;padding:0 60px 12px}
.pgk-lb-img img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px}
.pgk-lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;min-height:0;border-radius:999px;border:none;background:rgba(255,255,255,.14);color:#fff;font-size:24px;cursor:pointer}
.pgk-lb .pgk-ib{color:#fff}.pgk-lb .pgk-ib:hover{background:rgba(255,255,255,.12)}
.pgk-lb-pick{height:38px;min-height:0;padding:0 18px;border-radius:999px;border:none;font:inherit;font-size:14px;font-weight:700;cursor:pointer;background:#fff;color:#111}
.pgk-lb-pick[aria-pressed=true]{background:var(--au-brand,#3F4EB0);color:#fff}
.pgk-back{display:none}
@media (max-width:760px){
  .pgk{padding:0}.pgk-win{height:100dvh;border-radius:0;border:none}
  .pgk-head{flex-wrap:wrap}.pgk-search{order:3;flex-basis:100%;max-width:none;margin:0}
  .pgk-body{grid-template-columns:minmax(0,1fr)}
  .pgk-body.has-prop .pgk-side{display:none}
  .pgk-body:not(.has-prop) .pgk-main{display:none}
  .pgk-back{display:inline-flex}
  .pgk-mh{gap:6px;padding:10px 12px}.pgk-mh h3{flex-basis:100%;order:-1}.pgk-mh .pgk-btn{height:32px;padding:0 11px;font-size:12.5px}
  .pgk-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:10px}
  .pgk-foot{gap:8px}.pgk-strip{flex-basis:100%}.pgk-go{flex:1}
  .pgk-lb-img{padding:0 0 12px}.pgk-lb-nav{display:none}
}`

/** open · onClose · onAdd(files, linksText) · room (how many files the tray still takes) · project (the lead's) · leadName · lang */
export default function PhotoGalleryPicker({ open, onClose, onAdd, room = 30, project = '', leadName = '', lang = 'he' }) {
  const t = TR[lang] || TR.he
  const raw = useSharedProperties(open)
  const [q, setQ] = useState('')
  const [cur, setCur] = useState('')          // a property id, 'recent', or '' (none chosen yet: phones show the list)
  const [picks, setPicks] = useState([])
  const [links, setLinks] = useState(false)
  const [zoom, setZoom] = useState(-1)       // index in the shown photos, -1 = closed
  const [recent, setRecent] = useState(readRecent)
  const winRef = useRef(null)
  const props = useMemo(() => galleryProperties(raw, { project, query: q }), [raw, project, q])
  const narrow = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches
  useEffect(() => { if (open) { setPicks([]); setQ(''); setZoom(-1); setRecent(readRecent()); setCur('') } }, [open])
  // desktop: open on the lead's property (else the first); a phone starts on the list
  useEffect(() => { if (open && !cur && props.length && !narrow) setCur(props[0].id) }, [open, cur, props, narrow])
  const prop = props.find(p => p.id === cur) || (cur === 'recent' ? null : null)
  const shown = useMemo(() => (cur === 'recent'
    ? recent.map(r => ({ url: r.url, propId: r.propId, title: r.title, n: r.n || 1 }))
    : (prop?.images || []).map((url, i) => ({ url, propId: prop.id, title: prop.title, n: i + 1 }))), [cur, recent, prop])
  const max = Math.max(0, room)
  const pickedN = useMemo(() => new Map(picks.map((p, i) => [p.url, i + 1])), [picks])
  const toggle = useCallback(pk => setPicks(cur0 => togglePick(cur0, pk, max)), [max])
  const selAll = () => setPicks(cur0 => shown.reduce((a, pk) => (a.some(x => x.url === pk.url) ? a : togglePick(a, pk, max)), cur0))
  const clearHere = () => setPicks(cur0 => cur0.filter(p => !shown.some(s => s.url === p.url)))
  const add = () => {
    if (!picks.length) return
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(pushRecent(readRecent(), picks))) } catch {}
    onAdd?.(picksToFiles(picks, max), links ? picksLinks(picks, { lang }) : '')
    onClose?.()
  }
  // keys: Esc closes the big photo, then the window; ← / → move in the big photo; space selects it
  useEffect(() => {
    if (!open) return undefined
    const k = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (zoom >= 0) setZoom(-1); else onClose?.() }
      else if (zoom >= 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); const fwd = (e.key === 'ArrowLeft') === (lang !== 'en'); setZoom(z => (z + (fwd ? 1 : -1) + shown.length) % shown.length) }
      else if (zoom >= 0 && e.key === ' ') { e.preventDefault(); if (shown[zoom]) toggle(shown[zoom]) }
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [open, zoom, shown, toggle, onClose, lang])
  useEffect(() => { if (open) setTimeout(() => winRef.current?.querySelector('.pgk-search input')?.focus(), 30) }, [open])
  if (!open) return null
  const z = zoom >= 0 ? shown[zoom] : null
  return createPortal(
    <div className="pgk au" dir={lang === 'en' ? 'ltr' : 'rtl'} onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <style>{CSS}</style>
      <div className="pgk-win" ref={winRef} role="dialog" aria-modal="true" aria-label={t.title}>
        <div className="pgk-head">
          <Icon name="image" size={22}/>
          <div style={{ minWidth: 0 }}><h2>{t.title}</h2><small>{t.sub(leadName)}</small></div>
          <label className="pgk-search"><Icon name="search" size={16}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}/></label>
          <button type="button" className="pgk-ib" onClick={onClose} aria-label={t.close} title={t.close}>✕</button>
        </div>
        <div className={`pgk-body${cur ? ' has-prop' : ''}`}>
          <div className="pgk-side" role="list">
            {recent.length > 0 && !q && (
              <button type="button" className="pgk-row" role="listitem" aria-current={cur === 'recent'} onClick={() => setCur('recent')}>
                <div className="ph"><Icon name="clock" size={18}/></div>
                <div style={{ minWidth: 0, flex: 1 }}><b>{t.recent}</b><span>{t.photos(recent.length)}</span></div>
              </button>
            )}
            {!raw.length && <div className="pgk-empty">{t.loading}</div>}
            {raw.length > 0 && !props.length && <div className="pgk-empty">{q ? t.noHit : t.empty}</div>}
            {props.map(p => {
              const n = p.images.filter(u => pickedN.has(u)).length
              return (
                <button key={p.id} type="button" className="pgk-row" role="listitem" aria-current={cur === p.id} onClick={() => setCur(p.id)}>
                  <img src={imageThumb(p.cover, 120)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <b><bdi>{p.title}</bdi>{p.match && <i className="pgk-tag m" style={{ fontStyle: 'normal' }}>{t.match}</i>}</b>
                    <span>{[p.place, t.photos(p.images.length), p.status, !p.live ? t.hidden : ''].filter(Boolean).join(' · ')}</span>
                  </div>
                  {n > 0 && <span className="pgk-sel">{n}</span>}
                </button>
              )
            })}
          </div>
          <div className="pgk-main">
            {(prop || cur === 'recent') && (
              <div className="pgk-mh">
                <button type="button" className="pgk-btn pgk-back" onClick={() => setCur('')}>{lang === 'en' ? '‹' : '›'} {t.back}</button>
                <h3><bdi>{cur === 'recent' ? t.recent : prop.title}</bdi>{prop && <small>{[prop.place, t.photos(prop.images.length)].filter(Boolean).join(' · ')}</small>}</h3>
                <button type="button" className="pgk-btn" onClick={selAll} disabled={picks.length >= max}>{t.all(shown.length)}</button>
                {shown.some(s => pickedN.has(s.url)) && <button type="button" className="pgk-btn" onClick={clearHere}>{t.none}</button>}
                {prop?.live && <a className="pgk-btn" href={`/p/${encodeURIComponent(prop.id)}`} target="_blank" rel="noopener noreferrer" title={t.open}>↗ {t.open}</a>}
              </div>
            )}
            <div className="pgk-grid">
              {shown.map((pk, i) => {
                const n = pickedN.get(pk.url)
                return (
                  <div key={pk.url} className="pgk-tile" role="button" tabIndex={0} aria-pressed={!!n} aria-label={`${pk.title} ${pk.n}${n ? ` · ${t.unpick}` : ''}`}
                    onClick={() => toggle(pk)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(pk) } }}>
                    <img src={imageThumb(pk.url, 420)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>
                    <span className="pgk-check" aria-hidden="true">{n || ''}</span>
                    <button type="button" className="pgk-zoom" aria-label={t.zoom} title={t.zoom} onClick={e => { e.stopPropagation(); setZoom(i) }}><Icon name="search" size={16}/></button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div className="pgk-foot">
          <div className="pgk-strip" aria-live="polite">
            {!picks.length ? <span className="pgk-hint">{t.nothing}</span> : picks.map((p, i) => (
              <div key={p.url} className="it" title={`${p.title} ${p.n}`}>
                <img src={imageThumb(p.url, 100)} alt="" referrerPolicy="no-referrer"/><i>{i + 1}</i>
                <button type="button" aria-label={`${t.remove}: ${p.title} ${p.n}`} onClick={() => toggle(p)}>✕</button>
              </div>
            ))}
          </div>
          {picks.length > 0 && <span className="pgk-cnt">{t.picked(picks.length, max)}</span>}
          <label className="pgk-lk"><input type="checkbox" checked={links} onChange={e => setLinks(e.target.checked)}/>{t.links}</label>
          <button type="button" className="pgk-btn" onClick={onClose}>{t.cancel}</button>
          <button type="button" className="pgk-go" disabled={!picks.length} onClick={add}>{t.add(picks.length)}</button>
        </div>
      </div>
      {z && (
        <div className="pgk-lb" role="dialog" aria-modal="true" aria-label={z.title} onMouseDown={e => { if (e.target === e.currentTarget) setZoom(-1) }}>
          <div className="pgk-lb-top">
            <button type="button" className="pgk-ib" onClick={() => setZoom(-1)} aria-label={t.close}>✕</button>
            <b><bdi>{z.title}</bdi> · {t.count(zoom + 1, shown.length)}</b>
            <button type="button" className="pgk-lb-pick" aria-pressed={pickedN.has(z.url)} onClick={() => toggle(z)}>{pickedN.has(z.url) ? `✓ ${t.unpick}` : t.pick}</button>
          </div>
          <div className="pgk-lb-img">
            <img src={big(z.url)} alt="" referrerPolicy="no-referrer"/>
            {shown.length > 1 && <>
              <button type="button" className="pgk-lb-nav" style={{ insetInlineStart: 8 }} aria-label={t.prev} onClick={() => setZoom(i => (i - 1 + shown.length) % shown.length)}>{lang === 'en' ? '‹' : '›'}</button>
              <button type="button" className="pgk-lb-nav" style={{ insetInlineEnd: 8 }} aria-label={t.next} onClick={() => setZoom(i => (i + 1) % shown.length)}>{lang === 'en' ? '›' : '‹'}</button>
            </>}
          </div>
        </div>
      )}
    </div>, document.body)
}
