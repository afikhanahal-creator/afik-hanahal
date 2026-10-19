// Admin → "תמונות האתר": every image the site shows — the design images (public/img and the logos, listed at build time in
// /site-images.json with where each one is used) and every property photo — with: download the original, resize / convert
// / compress in the browser (canvas), and replace. A design image is replaced by committing the new file under the same
// name (POST /api/meta/media-replace → GitHub → the site redeploys in ~2 minutes; needs GITHUB_CONTENT_TOKEN in Vercel).
// A property photo is uploaded to Supabase Storage (the wizard's signed URL) and the property is saved with the new URL.
import { useEffect, useMemo, useRef, useState } from 'react'
import { fitSize, mimeFor } from '../lib/site-images.js'
import { cdnImg } from '../lib/img-url.js'

const ADMIN_TOKEN = 'AFIKhanahal2026'
const AUTH = { Authorization: `Bearer ${ADMIN_TOKEN}` }
const kb = n => `\u2066${n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`}\u2069`
const PRESETS = [600, 1200, 1600, 2400]
const FORMATS = [['image/webp', 'WebP'], ['image/jpeg', 'JPEG'], ['image/png', 'PNG']]

const TR = {
  he: {
    title: 'תמונות האתר', sub: 'כל התמונות באתר במקום אחד: הורדה, שינוי גודל, דחיסה והחלפה',
    design: 'עיצוב האתר', props: 'תמונות נכסים', search: 'חיפוש לפי שם, נכס או מקום…', none: 'לא נמצאו תמונות',
    listMissing: 'רשימת תמונות העיצוב נוצרת בבנייה של האתר (site-images.json) ותופיע אחרי הפריסה הבאה.',
    usedIn: 'מופיעה ב', unused: 'לא בשימוש', cover: 'תמונה ראשית', photoN: n => `תמונה ${n}`,
    download: 'הורדה', edit: 'שינוי גודל והחלפה', close: 'סגירה',
    source: 'מקור', current: 'התמונה הנוכחית', newFile: 'העלאת תמונה אחרת…', dropHint: 'או גררו לכאן קובץ',
    size: 'גודל', width: 'רוחב', height: 'גובה', original: 'מקורי', keep: 'שמירה על יחס', format: 'פורמט', quality: 'איכות',
    result: 'התוצאה', before: 'לפני', after: 'אחרי', saving: n => `חיסכון של ${n}%`, bigger: 'גדול מהמקור',
    dl: 'הורדת תמונה', replace: 'החלפה באתר', replacing: 'מחליף…',
    fixedFmt: ext => `כדי שהאתר ימשיך לקשר לאותה תמונה, ההחלפה נשמרת כ-${ext.toUpperCase()} באותו שם`,
    svgNote: 'קובץ SVG מוחלף כמו שהוא (בלי שינוי גודל). בחרו קובץ SVG אחר כדי להחליף.',
    doneStatic: commit => `הוחלף. האתר מתעדכן בעוד כ-2 דקות (עדכון ${commit}).`, doneProp: 'הוחלף בנכס ונשמר.',
    setupTitle: 'כדי להחליף תמונות עיצוב צריך חיבור חד-פעמי לגיטהאב',
    setup: ['github.com ← Settings ← Developer settings ← Personal access tokens ← Fine-grained tokens ← Generate new token', 'Repository access: רק afikhanahal-creator/afik-hanahal · Permissions: Contents → Read and write', 'ב-Vercel ← Settings ← Environment Variables: GITHUB_CONTENT_TOKEN = הטוקן · Production ← Save ← Redeploy', 'את הטוקן לא שולחים בצ׳אט, רק מדביקים ב-Vercel.'],
    canDownload: 'בינתיים אפשר להוריד ולשנות גודל, וההחלפה תעבוד אחרי החיבור.',
    loadErr: 'לא הצלחנו לטעון את התמונה לעריכה', webpWarn: 'הדפדפן הזה לא יודע לשמור WebP, נשמר כ-PNG. מומלץ Chrome.',
    count: n => `${n} תמונות`,
  },
  en: {
    title: 'Site images', sub: 'Every image on the site in one place: download, resize, compress and replace',
    design: 'Site design', props: 'Property photos', search: 'Search by name, property or place…', none: 'No images found',
    listMissing: 'The design image list is built with the site (site-images.json) and appears after the next deploy.',
    usedIn: 'Used in', unused: 'Not used', cover: 'Cover photo', photoN: n => `Photo ${n}`,
    download: 'Download', edit: 'Resize & replace', close: 'Close',
    source: 'Source', current: 'Current image', newFile: 'Upload another image…', dropHint: 'or drop a file here',
    size: 'Size', width: 'Width', height: 'Height', original: 'Original', keep: 'Keep ratio', format: 'Format', quality: 'Quality',
    result: 'Result', before: 'Before', after: 'After', saving: n => `${n}% smaller`, bigger: 'Bigger than the original',
    dl: 'Download image', replace: 'Replace on the site', replacing: 'Replacing…',
    fixedFmt: ext => `To keep the site linking to the same image, the replacement is saved as ${ext.toUpperCase()} under the same name`,
    svgNote: 'An SVG is replaced as is (no resizing). Pick another SVG file to replace it.',
    doneStatic: commit => `Replaced. The site updates in about 2 minutes (commit ${commit}).`, doneProp: 'Replaced in the property and saved.',
    setupTitle: 'Replacing design images needs a one-time GitHub connection',
    setup: ['github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token', 'Repository access: only afikhanahal-creator/afik-hanahal · Permissions: Contents → Read and write', 'In Vercel → Settings → Environment Variables: GITHUB_CONTENT_TOKEN = the token · Production → Save → Redeploy', 'Never send the token in a chat, only paste it into Vercel.'],
    canDownload: 'Meanwhile you can download and resize; replacing works once it is connected.',
    loadErr: 'Couldn\'t load the image for editing', webpWarn: 'This browser can\'t save WebP, saved as PNG. Chrome is recommended.',
    count: n => `${n} images`,
  },
}

const CSS = `
.mlib{display:grid;gap:16px;padding:4px 0 40px;color:var(--au-text);font-size:13px}
.mlib *{box-sizing:border-box}
.mlib button,.mlib input,.mlib select{font:inherit;min-height:0}
.mlib h2{margin:0;font-size:22px;font-weight:600}
.mlib .sub{margin:2px 0 0;color:var(--au-text2)}
.mlib-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.mlib-seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:rgba(var(--ov),.06)}
.mlib-seg button{height:30px;padding:0 14px;border:none;border-radius:8px;background:transparent;color:var(--au-text2);font-weight:500;cursor:pointer}
.mlib-seg button[aria-selected=true]{background:var(--au-card);color:var(--au-text);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.mlib-search{flex:1;min-width:200px;max-width:420px;height:34px;border-radius:9px;border:1px solid var(--au-line);background:var(--au-card);color:var(--au-text);padding:0 12px}
.mlib-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}
.mlib-card{background:var(--au-card);border:1px solid var(--au-s1-line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.mlib-thumb{aspect-ratio:4/3;background:repeating-conic-gradient(rgba(var(--ov),.06) 0 25%,transparent 0 50%) 0 0/16px 16px;display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:zoom-in;border:none;padding:0;width:100%}
.mlib-thumb img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.mlib-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px;flex:1}
.mlib-name{font-weight:600;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mlib-meta{color:var(--au-text2);font-size:12px;font-variant-numeric:tabular-nums}
.mlib-chips{display:flex;flex-wrap:wrap;gap:4px}
.mlib-chip{font-size:11px;border-radius:6px;padding:1px 7px;background:rgba(var(--ov),.07);color:var(--au-text2)}
.mlib-acts{display:flex;gap:6px;margin-top:auto;padding-top:4px}
.mlib-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--au-line);background:var(--au-card);color:var(--au-text);font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;text-decoration:none}
.mlib-btn:hover:not(:disabled){border-color:rgba(var(--brand-rgb),.5)}
.mlib-btn.pri{background:var(--au-brand);border-color:var(--au-brand);color:#fff;font-weight:600}
.mlib-btn:disabled{opacity:.5;cursor:default}
.mlib-btn.grow{flex:1}
.mlib-ov{position:fixed;inset:0;z-index:4000;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:16px}
.mlib-dlg{width:min(1060px,100%);max-height:calc(100vh - 32px);overflow:auto;background:var(--au-pop);color:var(--au-text);border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.35);display:grid;grid-template-columns:minmax(0,1.3fr) minmax(300px,1fr)}
.mlib-prev{background:repeating-conic-gradient(rgba(var(--ov),.06) 0 25%,transparent 0 50%) 0 0/18px 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:20px;min-height:360px}
.mlib-prev img{max-width:100%;max-height:60vh;object-fit:contain;border-radius:6px;box-shadow:0 2px 12px rgba(0,0,0,.15)}
.mlib-side{padding:18px 18px 20px;display:flex;flex-direction:column;gap:14px;border-inline-start:1px solid var(--au-s1-line)}
.mlib-side h3{margin:0;font-size:16px;font-weight:600;overflow-wrap:anywhere}
.mlib-row{display:flex;flex-direction:column;gap:6px}
.mlib-row label,.mlib-lbl{font-size:12px;color:var(--au-text2);font-weight:500}
.mlib-nums{display:flex;gap:8px;align-items:center}
.mlib-nums input[type=number]{width:96px;height:34px;border-radius:8px;border:1px solid var(--au-line);background:var(--au-card);color:var(--au-text);padding:0 10px;font-variant-numeric:tabular-nums}
.mlib-drop{border:1.5px dashed var(--au-line);border-radius:10px;padding:12px;text-align:center;color:var(--au-text2);font-size:12.5px;cursor:pointer}
.mlib-drop.on{border-color:var(--au-brand);background:rgba(var(--brand-rgb),.06)}
.mlib-stat{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mlib-stat div{background:rgba(var(--ov),.05);border-radius:10px;padding:8px 10px}
.mlib-stat b{display:block;font-size:14px;font-variant-numeric:tabular-nums}
.mlib-note{font-size:12px;color:var(--au-text2);line-height:1.6}
.mlib input[type=range]{appearance:auto;-webkit-appearance:auto;width:100%;accent-color:var(--au-brand);height:24px}
.mlib-seg button:disabled{opacity:.35;cursor:default}
.mlib-ok{background:rgba(52,199,89,.12);border-radius:10px;padding:10px 12px;font-size:13px}
.mlib-err{background:rgba(224,82,82,.1);color:var(--au-red-text);border-radius:10px;padding:10px 12px;font-size:13px}
.mlib-setup{background:rgba(245,166,35,.1);border-radius:12px;padding:12px 14px;font-size:12.5px;line-height:1.7}
.mlib-setup ol{margin:6px 0 0;padding-inline-start:18px}
@media (max-width:820px){.mlib-dlg{grid-template-columns:1fr}.mlib-side{border-inline-start:none;border-top:1px solid var(--au-s1-line)}.mlib-prev{min-height:220px}}
`

// The image as a Blob from anywhere: same-origin path, or a public Supabase / other URL (CORS), else through the CDN
async function loadBlob(url) {
  try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) return await r.blob() } catch {}
  const r = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(url)}&output=png`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.blob()
}
const blobToBase64 = blob => new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.onerror = no; fr.readAsDataURL(blob) })
function saveFile(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
const baseName = n => String(n || 'image').replace(/\.[a-z0-9]+$/i, '')
const extOf = type => ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/svg+xml': 'svg' }[type] || 'png')

export default function MediaLibraryTab({ lang = 'he', properties = [], onReplacePropertyPhoto }) {
  const t = TR[lang] || TR.he
  const [view, setView] = useState('design')
  const [q, setQ] = useState('')
  const [site, setSite] = useState(null)        // { images } | { missing: true }
  const [status, setStatus] = useState(null)
  const [open, setOpen] = useState(null)        // the item being edited
  const [dims, setDims] = useState({})          // path → [w, h] seen in the grid

  useEffect(() => {
    fetch('/site-images.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject())).then(setSite).catch(() => setSite({ missing: true, images: [] }))
    fetch('/api/meta/media-status', { headers: AUTH }).then(r => r.json()).then(setStatus).catch(() => setStatus({ canReplace: false }))
  }, [])

  const designItems = useMemo(() => (site?.images || []).map(x => ({ kind: 'design', key: x.path, url: x.path, name: x.name, bytes: x.bytes, ext: x.ext, usedIn: x.usedIn || [], replaceable: x.replaceable })), [site])
  const propItems = useMemo(() => properties.flatMap(p => (p.images || []).filter(u => typeof u === 'string' && /^https?:\/\//.test(u)).map((u, i) => ({
    kind: 'prop', key: `${p.id}:${i}`, url: u, propId: p.id, name: `${p.title || p.name || p.id} · ${i ? t.photoN(i + 1) : t.cover}`, propTitle: p.title || p.name || String(p.id),
    ext: (u.split('?')[0].split('.').pop() || 'jpg').toLowerCase(), usedIn: [{ he: p.title || '', en: p.title || '' }], replaceable: true,
  }))), [properties, t])
  const items = (view === 'design' ? designItems : propItems).filter(x => {
    const s = q.trim().toLowerCase()
    return !s || `${x.name} ${x.usedIn.map(u => u.he + ' ' + u.en).join(' ')}`.toLowerCase().includes(s)
  })

  const download = async it => { try { saveFile(await loadBlob(it.url), it.kind === 'design' ? it.name : `${baseName(it.propTitle)}-${it.key.split(':')[1]}.${it.ext}`) } catch { window.open(it.url, '_blank') } }

  return (
    <div className="mlib" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <style>{CSS}</style>
      <div>
        <h2>{t.title}</h2>
        <p className="sub">{t.sub}</p>
      </div>
      <div className="mlib-bar">
        <div className="mlib-seg" role="tablist">
          <button type="button" role="tab" aria-selected={view === 'design'} onClick={() => setView('design')}>{t.design} · {designItems.length}</button>
          <button type="button" role="tab" aria-selected={view === 'props'} onClick={() => setView('props')}>{t.props} · {propItems.length}</button>
        </div>
        <input className="mlib-search" value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}/>
        <span style={{ color: 'var(--au-text2)' }}>{t.count(items.length)}</span>
      </div>
      {view === 'design' && site?.missing && <div className="mlib-note">{t.listMissing}</div>}
      {view === 'design' && status && !status.canReplace && (
        <div className="mlib-setup"><b>{t.setupTitle}</b><ol>{t.setup.map(x => <li key={x}>{x}</li>)}</ol><div style={{ marginTop: 6 }}>{t.canDownload}</div></div>
      )}

      {!items.length ? <div className="mlib-note">{t.none}</div> : (
        <div className="mlib-grid">
          {items.map(it => {
            const d = dims[it.key]
            return (
              <div key={it.key} className="mlib-card">
                <button type="button" className="mlib-thumb" onClick={() => setOpen(it)} aria-label={`${t.edit}: ${it.name}`}>
                  <img src={it.kind === 'prop' ? cdnImg(it.url, 420) : it.url} alt="" loading="lazy" decoding="async"
                    onLoad={e => { if (it.kind === 'design' && !d) { const w = e.currentTarget.naturalWidth, h = e.currentTarget.naturalHeight; setDims(m => ({ ...m, [it.key]: [w, h] })) } }}/>
                </button>
                <div className="mlib-body">
                  <div className="mlib-name" title={it.name}>{it.name}</div>
                  <div className="mlib-meta">{[d && `${d[0]}×${d[1]}`, it.bytes && kb(it.bytes), it.ext.toUpperCase()].filter(Boolean).join(' · ')}</div>
                  {it.kind === 'design' && <div className="mlib-chips">{it.usedIn.length ? it.usedIn.map(u => <span key={u.he} className="mlib-chip">{lang === 'en' ? u.en : u.he}</span>) : <span className="mlib-chip">{t.unused}</span>}</div>}
                  <div className="mlib-acts">
                    <button type="button" className="mlib-btn" onClick={() => download(it)}>{t.download}</button>
                    <button type="button" className="mlib-btn pri grow" onClick={() => setOpen(it)}>{t.edit}</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open && <ImageEditor item={open} t={t} lang={lang} canReplaceStatic={!!status?.canReplace} onClose={() => setOpen(null)}
        onDone={(newUrl) => { if (open.kind === 'prop' && newUrl) onReplacePropertyPhoto?.(open.propId, open.url, newUrl) }}/>}
    </div>
  )
}

function ImageEditor({ item, t, lang, canReplaceStatic, onClose, onDone }) {
  const isSvg = item.ext === 'svg'
  const fixedType = item.kind === 'design' ? mimeFor(item.ext) : ''          // a design image keeps its name, so its format
  const [src, setSrc] = useState(null)        // { blob, url, w, h, name }
  const [err, setErr] = useState('')
  const [w, setW] = useState(0), [h, setH] = useState(0), [keep, setKeep] = useState(true)
  const [type, setType] = useState(fixedType && !isSvg ? fixedType : 'image/webp')
  const [quality, setQuality] = useState(82)
  const [out, setOut] = useState(null)        // { blob, url, w, h, type }
  const [busy, setBusy] = useState(''), [done, setDone] = useState('')
  const [drag, setDrag] = useState(false)
  const fileRef = useRef(null)

  const takeBlob = async (blob, name) => {
    setErr(''); setDone('')
    const url = URL.createObjectURL(blob)
    if (blob.type === 'image/svg+xml') { setSrc({ blob, url, w: 0, h: 0, name, svg: true }); setOut({ blob, url, w: 0, h: 0, type: blob.type }); return }
    const img = new Image()
    img.onload = () => { setSrc({ blob, url, w: img.naturalWidth, h: img.naturalHeight, name, img }); setW(img.naturalWidth); setH(img.naturalHeight) }
    img.onerror = () => setErr(t.loadErr)
    img.src = url
  }
  useEffect(() => { loadBlob(item.url).then(b => takeBlob(b, item.name)).catch(() => setErr(t.loadErr)) }, [item.url]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

  // re-encode whenever size / format / quality change (a short pause between keystrokes)
  useEffect(() => {
    if (!src?.img || !w || !h) return
    const id = setTimeout(() => {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'
      if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h) }
      ctx.drawImage(src.img, 0, 0, w, h)
      c.toBlob(b => { if (!b) return; setOut(o => { if (o?.url && o.url !== src.url) URL.revokeObjectURL(o.url); return { blob: b, url: URL.createObjectURL(b), w, h, type: b.type } }) }, type, quality / 100)
    }, 180)
    return () => clearTimeout(id)
  }, [src, w, h, type, quality])

  const setWidth = v => { const n = Math.max(1, Math.round(+v || 0)); setW(n); if (keep && src?.w) setH(Math.max(1, Math.round(n * src.h / src.w))) }
  const setHeight = v => { const n = Math.max(1, Math.round(+v || 0)); setH(n); if (keep && src?.h) setW(Math.max(1, Math.round(n * src.w / src.h))) }
  const preset = pw => { if (!src?.w) return; const f = fitSize(src.w, src.h, { width: pw }); setW(f.width); setH(f.height) }

  const pick = f => { if (f && /^image\//.test(f.type)) takeBlob(f, f.name) }
  const typeMismatch = out && out.type !== type && !isSvg
  const wrongFixed = fixedType && out && out.type !== fixedType
  const origBytes = item.bytes || src?.blob?.size || 0

  async function replace() {
    if (!out?.blob) return
    setBusy('replace'); setErr(''); setDone('')
    try {
      if (item.kind === 'design') {
        const r = await fetch('/api/meta/media-replace', { method: 'POST', headers: { 'Content-Type': 'application/json', ...AUTH }, body: JSON.stringify({ path: item.url, type: out.type, content: await blobToBase64(out.blob) }) })
        const d = await r.json().catch(() => ({}))
        if (!d.ok) throw new Error(d.error || `HTTP ${r.status}`)
        setDone(t.doneStatic(d.commit || ''))
      } else {
        const ext = extOf(out.type)
        const meta = await fetch('/api/seller-form?action=wizard-upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json', ...AUTH }, body: JSON.stringify({ name: `photo.${ext}`, type: out.type, size: out.blob.size, kind: 'image' }) }).then(r => (r.ok ? r.json() : null))
        if (!meta?.signedUrl || !meta?.url) throw new Error('upload url')
        const put = await fetch(meta.signedUrl, { method: 'PUT', headers: { 'Content-Type': out.type, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }, body: out.blob })
        if (!put.ok) throw new Error(`upload ${put.status}`)
        await onDone?.(meta.url)
        setDone(t.doneProp)
      }
    } catch (e) { setErr(e.message) }
    setBusy('')
  }

  const pct = out?.blob && origBytes ? Math.round((1 - out.blob.size / origBytes) * 100) : null
  return (
    <div className="mlib-ov" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mlib-dlg" role="dialog" aria-modal="true" aria-label={`${t.edit}: ${item.name}`} dir={lang === 'en' ? 'ltr' : 'rtl'}>
        <div className="mlib-prev"
          onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]) }}>
          {out?.url ? <img src={out.url} alt=""/> : src?.url ? <img src={src.url} alt=""/> : <span className="mlib-note">…</span>}
          {out && <span className="mlib-note">{t.after}: {out.w ? `${out.w}×${out.h} · ` : ''}{kb(out.blob.size)}</span>}
        </div>
        <div className="mlib-side">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <h3 style={{ flex: 1 }}>{item.name}</h3>
            <button type="button" className="mlib-btn" onClick={onClose} aria-label={t.close}>✕</button>
          </div>
          {item.kind === 'design' && item.usedIn?.length > 0 && <div className="mlib-chips">{item.usedIn.map(u => <span key={u.he} className="mlib-chip">{lang === 'en' ? u.en : u.he}</span>)}</div>}

          <div className="mlib-row">
            <span className="mlib-lbl">{t.source}</span>
            <div className={`mlib-drop${drag ? ' on' : ''}`} role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}>
              {src?.name && src.name !== item.name ? src.name : t.current} · <b>{t.newFile}</b><div>{t.dropHint}</div>
            </div>
            <input ref={fileRef} type="file" accept={isSvg ? 'image/svg+xml' : 'image/*'} hidden onChange={e => pick(e.target.files?.[0])}/>
          </div>

          {isSvg || src?.svg ? <div className="mlib-note">{t.svgNote}</div> : <>
            <div className="mlib-row">
              <span className="mlib-lbl">{t.size} · {t.original}: {src?.w || '–'}×{src?.h || '–'}</span>
              <div className="mlib-nums">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t.width}<input type="number" min={1} max={8000} value={w || ''} onChange={e => setWidth(e.target.value)}/></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t.height}<input type="number" min={1} max={8000} value={h || ''} onChange={e => setHeight(e.target.value)}/></label>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}><input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} style={{ appearance: 'auto', width: 16, height: 16 }}/>{t.keep}</label>
              <div className="mlib-seg">
                {PRESETS.map(p => <button key={p} type="button" disabled={!src?.w || p >= src.w} aria-selected={src?.w > p && w === p} onClick={() => preset(p)}>{p}</button>)}
                <button type="button" aria-selected={w === src?.w} onClick={() => { setW(src?.w || 0); setH(src?.h || 0) }}>{t.original}</button>
              </div>
            </div>
            <div className="mlib-row">
              <span className="mlib-lbl">{t.format}</span>
              <div className="mlib-seg">
                {FORMATS.map(([v, l]) => <button key={v} type="button" aria-selected={type === v} disabled={!!fixedType && v !== fixedType} onClick={() => setType(v)}>{l}</button>)}
              </div>
              {fixedType && <span className="mlib-note">{t.fixedFmt(item.ext)}</span>}
            </div>
            {type !== 'image/png' && (
              <div className="mlib-row">
                <label className="mlib-lbl" htmlFor="mlib-q">{t.quality}: {quality}</label>
                <input id="mlib-q" type="range" min={40} max={100} value={quality} onChange={e => setQuality(+e.target.value)}/>
              </div>
            )}
          </>}

          {out && (
            <div className="mlib-stat">
              <div><span className="mlib-lbl">{t.before}</span><b>{origBytes ? kb(origBytes) : '–'}</b></div>
              <div><span className="mlib-lbl">{t.after}</span><b>{kb(out.blob.size)}</b>{pct !== null && <span className="mlib-note">{pct >= 0 ? t.saving(pct) : t.bigger}</span>}</div>
            </div>
          )}
          {typeMismatch && <div className="mlib-err">{t.webpWarn}</div>}
          {err && <div className="mlib-err" role="alert">{err}</div>}
          {done && <div className="mlib-ok" role="status">{done}</div>}
          {item.kind === 'design' && !canReplaceStatic && <div className="mlib-note">{t.setupTitle}. {t.canDownload}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
            <button type="button" className="mlib-btn grow" disabled={!out} onClick={() => saveFile(out.blob, `${baseName(item.kind === 'design' ? item.name : item.propTitle)}-${out.w || 'svg'}.${extOf(out.type)}`)}>{t.dl}</button>
            <button type="button" className="mlib-btn pri grow" disabled={!out || !!busy || (item.kind === 'design' && (!canReplaceStatic || !item.replaceable || wrongFixed))} onClick={replace}>{busy ? t.replacing : t.replace}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
