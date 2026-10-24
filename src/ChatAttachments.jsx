// Files attached to a WhatsApp message, like WhatsApp itself: the strip above the text box (a thumbnail for photos and videos,
// an icon for documents, name, size, ✕ / status), the drop zone over the conversation ("שחררו כאן") and the hook that keeps the
// list. Used by the chats tab's ChatComposer / GreenAPIChat and by LeadConversation (Lead Center, lead card). Uploading and
// sending: src/lib/chatFiles.js.
import { useState, useEffect, useRef, useCallback } from 'react'
import { Icon } from './uiIcons.jsx'
import { acceptFiles, fileKind, formatSize } from './lib/chatFiles.js'

const TR = {
  he: { remove: 'הסרה', drop: 'שחררו כאן כדי לצרף', dropSub: 'תמונות, סרטונים, PDF, Word, Excel ועוד', uploading: 'מעלה…', sending: 'שולח…', sent: 'נשלח', error: 'נכשל', files: n => `${n} קבצים` },
  en: { remove: 'Remove', drop: 'Drop here to attach', dropSub: 'Photos, videos, PDF, Word, Excel and more', uploading: 'Uploading…', sending: 'Sending…', sent: 'Sent', error: 'Failed', files: n => `${n} files` },
}
let uid = 0

/** The list of attached files: add (picker / drop / paste — checked by acceptFiles), remove, clear, a status per file */
export function useAttachments(lang = 'he') {
  const [items, setItems] = useState([])
  const [notice, setNotice] = useState('')
  const itemsRef = useRef(items); itemsRef.current = items
  useEffect(() => () => itemsRef.current.forEach(x => x.preview && URL.revokeObjectURL(x.preview)), [])
  const add = useCallback(list => {
    const { ok, bad } = acceptFiles(list, itemsRef.current.length, lang)
    if (ok.length) setItems(prev => [...prev, ...ok.map(file => ({ id: `f${++uid}`, file, status: '', preview: /^(image|video)$/.test(fileKind(file)) ? URL.createObjectURL(file) : '' }))])
    setNotice(bad.length ? bad.map(b => `${b.name}: ${b.why}`).join(' · ') : '')
    return ok.length
  }, [lang])
  const remove = useCallback(id => setItems(prev => { const x = prev.find(i => i.id === id); if (x?.preview) URL.revokeObjectURL(x.preview); return prev.filter(i => i.id !== id) }), [])
  const clear = useCallback(() => setItems(prev => { prev.forEach(x => x.preview && URL.revokeObjectURL(x.preview)); return [] }), [])
  const setStatus = useCallback((i, status) => setItems(prev => prev.map((x, k) => (k === i ? { ...x, status } : x))), [])
  return { items, files: items.map(x => x.file), add, remove, clear, setStatus, notice, setNotice }
}

/** Drag files over an area → { dragging, bind } (bind = the area's handlers) */
export function useFileDrop(onFiles) {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const has = e => Array.from(e.dataTransfer?.types || []).includes('Files')
  const bind = {
    onDragEnter: e => { if (!has(e)) return; e.preventDefault(); depth.current++; setDragging(true) },
    onDragOver: e => { if (!has(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy' },
    onDragLeave: e => { if (!has(e)) return; depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false) },
    onDrop: e => { if (!has(e)) return; e.preventDefault(); depth.current = 0; setDragging(false); if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files) },
  }
  return { dragging, bind }
}
/** Files pasted into a text box (a screenshot, a copied file) → onFiles; plain text pastes as usual */
export const pasteFiles = onFiles => e => {
  const files = Array.from(e.clipboardData?.files || [])
  if (files.length) { e.preventDefault(); onFiles(files) }
}

export function DropOverlay({ show, lang = 'he', WA = {} }) {
  if (!show) return null
  const t = TR[lang] || TR.he
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 8, zIndex: 30, borderRadius: 14, border: `2px dashed ${WA.green || '#00A884'}`, background: 'rgba(0,168,132,.10)', backdropFilter: 'blur(2px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: WA.bodyText || '#111B21', pointerEvents: 'none' }}>
      <span style={{ width: 56, height: 56, borderRadius: '50%', background: WA.green || '#00A884', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="upload" size={26} sw={2}/></span>
      <b style={{ fontSize: 16 }}>{t.drop}</b>
      <span style={{ fontSize: 13, opacity: .75 }}>{t.dropSub}</span>
    </div>
  )
}

const KIND_ICON = { image: 'image', video: 'video', pdf: 'file', doc: 'file' }
const ext = n => (String(n || '').match(/\.([a-z0-9]{1,5})$/i) || [])[1]?.toUpperCase() || ''

/** The strip of attached files above the text box */
export function AttachTray({ items, onRemove, lang = 'he', WA = {}, isDark = false, notice = '', onDismissNotice }) {
  if (!items.length && !notice) return null
  const t = TR[lang] || TR.he
  const line = isDark ? 'rgba(255,255,255,.10)' : 'rgba(11,20,26,.10)'
  return (
    <div dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ padding: '8px 8px 0' }}>
      {items.length > 0 && (
        <div role="list" aria-label={t.files(items.length)} style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'thin' }}>
          {items.map(x => {
            const kind = fileKind(x.file)
            const st = x.status
            return (
              <div role="listitem" key={x.id} title={x.file.name} style={{ position: 'relative', flex: 'none', width: 168, display: 'flex', gap: 8, alignItems: 'center', padding: 6, borderRadius: 11, border: `1px solid ${st === 'error' ? '#E5484D' : line}`, background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(11,20,26,.03)', opacity: st === 'sent' ? .55 : 1 }}>
                {kind === 'image' && x.preview
                  ? <img src={x.preview} alt="" width={42} height={42} style={{ borderRadius: 7, objectFit: 'cover', flex: 'none', display: 'block' }}/>
                  : kind === 'video' && x.preview
                    ? <span style={{ position: 'relative', flex: 'none', width: 42, height: 42, borderRadius: 7, overflow: 'hidden', background: '#000' }}><video src={x.preview} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/><span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icon name="video" size={16}/></span></span>
                    : <span style={{ flex: 'none', width: 42, height: 42, borderRadius: 7, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, background: kind === 'pdf' ? 'rgba(229,72,77,.12)' : 'rgba(0,168,132,.12)', color: kind === 'pdf' ? '#E5484D' : (WA.green || '#00A884') }}><Icon name={KIND_ICON[kind]} size={17}/><span style={{ fontSize: 8.5, fontWeight: 700 }}>{ext(x.file.name)}</span></span>}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: WA.bodyText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dir="auto">{x.file.name}</span>
                  <span style={{ display: 'block', fontSize: 11, color: st === 'error' ? '#E5484D' : WA.subText }}>{st ? t[st] : formatSize(x.file.size, lang)}</span>
                </span>
                {!st && <button type="button" onClick={() => onRemove(x.id)} aria-label={`${t.remove}: ${x.file.name}`} title={t.remove}
                  style={{ position: 'absolute', top: -7, insetInlineEnd: -7, width: 22, height: 22, minHeight: 0, borderRadius: '50%', border: `1px solid ${line}`, background: isDark ? '#2A3942' : '#fff', color: WA.subText, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><Icon name="x" size={12} sw={2.2}/></button>}
              </div>
            )
          })}
        </div>
      )}
      {notice && <div role="alert" style={{ marginTop: 6, fontSize: 12, color: '#C2283E', display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ flex: 1 }}>{notice}</span>{onDismissNotice && <button type="button" onClick={onDismissNotice} style={{ border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', padding: 0, minHeight: 0 }} aria-label={t.remove}><Icon name="x" size={12}/></button>}</div>}
    </div>
  )
}
