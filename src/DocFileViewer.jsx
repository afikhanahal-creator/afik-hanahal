// The office's document files (the PDF that was sent, the signed PDF with its certificate page, the Word file) are behind the
// admin login (`docs-file`), so a plain <a href> opened them without the Authorization header and the browser showed
// {"error":"Unauthorized"}. Every admin screen fetches them here with the header, then shows / downloads the bytes from memory.
// DocFileViewer = the preview of a document after (or before) signing: the browser's own PDF viewer in the window, "החתום / כפי
// שנשלח", download PDF / Word, open in a new tab. A phone without a built-in PDF viewer (Android Chrome) gets the buttons only.
import { useEffect, useState } from 'react'
import { Modal } from './automationsUI.jsx'
import { Download, ExternalLink, FileText, CheckCircle2, X, Loader2 } from 'lucide-react'

const AUTH = { Authorization: 'Bearer AFIKhanahal2026' }
const CACHE = new Map()   // `${id}:${kind}` → { url, name } for this session, so a preview opened again doesn't download again

export async function fetchDocFile(id, kind = 'original') {
  const key = `${id}:${kind}`
  if (CACHE.has(key)) return CACHE.get(key)
  const r = await fetch(`/api/meta/docs-file?id=${encodeURIComponent(id)}&kind=${kind}`, { headers: AUTH, signal: AbortSignal.timeout(60000) })
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(r.status === 404 ? 'הקובץ לא נמצא' : d.error || `שגיאה ${r.status}`) }
  const blob = await r.blob()
  const m = (r.headers.get('content-disposition') || '').match(/filename\*=UTF-8''([^;]+)/i)
  const name = m ? decodeURIComponent(m[1]) : `document.${kind === 'docx' ? 'docx' : 'pdf'}`
  const out = { url: URL.createObjectURL(blob), name, size: blob.size }
  CACHE.set(key, out)
  return out
}
export async function downloadDocFile(id, kind = 'original') {
  const f = await fetchDocFile(id, kind)
  const a = document.createElement('a')
  a.href = f.url; a.download = f.name; a.rel = 'noopener'
  document.body.appendChild(a); a.click(); a.remove()
  return f.name
}
/** open the PDF in a new tab — the tab is opened inside the click (no popup block), then pointed at the bytes */
export async function openDocFile(id, kind = 'original') {
  const w = window.open('', '_blank')
  try { const f = await fetchDocFile(id, kind); if (w) w.location.href = f.url; else window.location.href = f.url }
  catch (e) { w?.close(); throw e }
}

const CSS = `
.dfv{display:flex;flex-direction:column;height:100%;min-height:0;direction:rtl;font-family:Rubik,sans-serif;color:var(--au-text)}
.dfv-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--au-line);flex-wrap:wrap}
.dfv-t{flex:1;min-width:0}
.dfv-t b{display:block;font-size:15.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dfv-t small{display:block;font-size:12.5px;color:var(--au-text3);margin-top:2px}
.dfv-seg{display:inline-flex;border:1px solid var(--au-line);border-radius:10px;padding:2px;background:rgba(var(--ov),.04)}
.dfv-seg button{border:0;background:transparent;font:inherit;font-size:12.5px;font-weight:600;color:var(--au-text2);padding:6px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;min-height:0}
.dfv-seg button.on{background:var(--au-card);color:var(--au-text);box-shadow:0 1px 2px rgba(0,0,0,.12)}
.dfv-btn{height:34px;border-radius:9px;border:1px solid var(--au-line);background:var(--au-card);color:var(--au-text);font:inherit;font-size:12.5px;font-weight:600;padding:0 12px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;min-height:0;white-space:nowrap}
.dfv-btn:hover{background:rgba(var(--ov),.06)}
.dfv-btn:disabled{opacity:.55;cursor:default}
.dfv-btn.pri{background:var(--au-brand);border-color:var(--au-brand);color:#fff}
.dfv-x{width:34px;height:34px;border-radius:9px;border:0;background:transparent;color:var(--au-text2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;min-height:0}
.dfv-x:hover{background:rgba(var(--ov),.07)}
.dfv-stage{flex:1;min-height:0;background:rgba(var(--ov),.05);position:relative}
.dfv-stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
.dfv-msg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;font-size:14px;color:var(--au-text2);line-height:1.6}
.dfv-msg.err{color:var(--au-red-text,#C0392B)}
.dfv-spin{animation:dfvspin 1s linear infinite}
@keyframes dfvspin{to{transform:rotate(360deg)}}
.dfv-dl{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
@media (max-width:640px){.dfv-hide-sm{display:none}.dfv-bar{padding:10px 12px;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'t x' 's s' 'a a';gap:8px}.dfv-t{grid-area:t}.dfv-x{grid-area:x}.dfv-seg{grid-area:s;justify-self:start}.dfv-acts{grid-area:a}.dfv-acts{width:100%;display:flex;gap:6px}.dfv-acts .dfv-btn{flex:1;justify-content:center;padding:0 8px}}
`

/** doc = { id, number, title, signed } (a row of the list, a lead's entry, or the full document) */
export function DocFileViewer({ doc, kind: kind0, onClose }) {
  const signed = !!doc?.signed
  const [kind, setKind] = useState(kind0 || (signed ? 'signed' : 'original'))
  const [file, setFile] = useState(null), [err, setErr] = useState(''), [busy, setBusy] = useState(''), [tick, setTick] = useState(0)
  const viewer = typeof navigator === 'undefined' || navigator.pdfViewerEnabled !== false
  useEffect(() => {
    if (!doc?.id) return
    let live = true
    setFile(null); setErr('')
    fetchDocFile(doc.id, kind).then(f => { if (live) setFile(f) }).catch(e => { if (live) setErr(e.message || 'הקובץ לא נטען') })
    return () => { live = false }
  }, [doc?.id, kind, tick])
  const dl = async k => { setBusy(k); try { await downloadDocFile(doc.id, k) } catch (e) { setErr(e.message) } finally { setBusy('') } }
  const open = async () => { try { await openDocFile(doc.id, kind) } catch (e) { setErr(e.message) } }
  return (
    <Modal open={!!doc} onClose={onClose} xl label="תצוגת המסמך">
      <style>{CSS}</style>
      <div className="dfv" style={{ height: '100%' }}>
        <div className="dfv-bar">
          <div className="dfv-t"><b>{doc?.title || 'טופס הזמנת שירותי תיווך'}</b><small dir="auto">{doc?.number}{signed ? ' · נחתם' : ''}</small></div>
          {signed && <div className="dfv-seg" role="tablist" aria-label="איזה קובץ">
            <button type="button" role="tab" aria-selected={kind === 'signed'} className={kind === 'signed' ? 'on' : ''} onClick={() => setKind('signed')}><CheckCircle2 size={13}/> החתום</button>
            <button type="button" role="tab" aria-selected={kind === 'original'} className={kind === 'original' ? 'on' : ''} onClick={() => setKind('original')}><FileText size={13}/> כפי שנשלח</button>
          </div>}
          <div className="dfv-acts" style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="dfv-btn pri" disabled={!!busy} onClick={() => dl(kind)}>{busy === kind ? <Loader2 size={14} className="dfv-spin"/> : <Download size={14}/>} PDF</button>
            <button type="button" className="dfv-btn" disabled={!!busy} onClick={() => dl('docx')}>{busy === 'docx' ? <Loader2 size={14} className="dfv-spin"/> : <Download size={14}/>} Word</button>
            <button type="button" className="dfv-btn" onClick={open} title="פתיחה בלשונית חדשה"><ExternalLink size={14}/><span className="dfv-hide-sm"> לשונית חדשה</span></button>
          </div>
          <button type="button" className="dfv-x" onClick={onClose} aria-label="סגירה"><X size={18}/></button>
        </div>
        <div className="dfv-stage">
          {err ? <div className="dfv-msg err">{err}<button type="button" className="dfv-btn" onClick={() => { CACHE.delete(`${doc.id}:${kind}`); setTick(x => x + 1) }}>נסו שוב</button></div>
            : !file ? <div className="dfv-msg"><Loader2 size={22} className="dfv-spin"/>טוען את המסמך…</div>
            : viewer ? <iframe title={`${doc.number} ${kind === 'signed' ? 'חתום' : ''}`} src={`${file.url}#view=FitH`}/>
            : <div className="dfv-msg">הדפדפן הזה לא מציג PDF בתוך הדף.<div className="dfv-dl"><button type="button" className="dfv-btn pri" onClick={open}><ExternalLink size={14}/> פתיחת ה-PDF</button><button type="button" className="dfv-btn" onClick={() => dl(kind)}><Download size={14}/> הורדה</button></div></div>}
        </div>
      </div>
    </Modal>
  )
}
export default DocFileViewer
