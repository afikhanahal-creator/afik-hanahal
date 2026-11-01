// A template's files (optional): a property's brochure, price list, plans, more photos or a video — picked, dropped or pasted,
// uploaded by the browser straight to storage (src/lib/chatFiles.js uploadChatFile, folder 'templates' → property-media/
// templates/…; photos compressed to ≤ 1600 px first) and kept on the template as `files: [{ url, name, type, size }]`. When the
// template is put in a chat's box its files join the tray; "שלח" sends the text, then each file (lib/automations-shared.js
// templateFiles). `pal` holds the colors (the templates tab's admin tokens, or the chat's WhatsApp palette).
import { useState, useRef } from 'react'
import { uploadChatFile, acceptFiles, fileKind, formatSize, CHAT_ACCEPT } from './lib/chatFiles.js'
import { TEMPLATE_FILES_MAX } from '../lib/automations-shared.js'
import { imageThumb } from './lib/templateImage.js'
import { Icon } from './uiIcons.jsx'

const TR = {
  he: { label: 'קבצים לשליחה עם ההודעה', optional: 'לא חובה', add: 'הוספת קבצים', drop: 'חוברת, מחירון, תוכניות, תמונות או סרטון — גררו לכאן, הדביקו או לחצו',
    hint: 'יישלחו אחרי הטקסט, לפי הסדר', uploading: n => `מעלה ${n}…`, remove: 'הסרה', up: 'למעלה', max: `עד ${TEMPLATE_FILES_MAX} קבצים` },
  en: { label: 'Files sent with the message', optional: 'optional', add: 'Add files', drop: 'A brochure, price list, plans, photos or a video — drop, paste or click',
    hint: 'Sent after the text, in this order', uploading: n => `Uploading ${n}…`, remove: 'Remove', up: 'Move up', max: `Up to ${TEMPLATE_FILES_MAX} files` },
}

export default function TemplateFilesField({ value = [], onChange, lang = 'he', pal = {}, compact = false }) {
  const t = TR[lang] || TR.he
  const P = { text: 'var(--au-text)', sub: 'var(--au-text3)', line: 'rgba(var(--ink),.14)', bg: 'rgba(var(--ov),.03)', accent: 'var(--au-brand)', danger: '#DC2626', ...pal }
  const files = Array.isArray(value) ? value : []
  const [busy, setBusy] = useState(0)
  const [err, setErr] = useState('')
  const [over, setOver] = useState(false)
  const fileRef = useRef(null)
  const listRef = useRef(files); listRef.current = files

  const take = async list => {
    const { ok, bad } = acceptFiles(list, files.length, lang)
    const room = Math.max(0, TEMPLATE_FILES_MAX - files.length)
    const go = ok.slice(0, room)
    setErr([...bad.map(b => `${b.name}: ${b.why}`), ...(ok.length > room ? [t.max] : [])].join(' · '))
    if (!go.length) return
    setBusy(go.length)
    for (const f of go) {
      try {
        const r = await uploadChatFile(f, 'templates')
        const next = [...listRef.current, { url: r.url, name: r.fileName, type: r.type, size: r.size || f.size }]
        listRef.current = next
        onChange?.(next)
      } catch (e) { setErr(e.message) }
      setBusy(n => Math.max(0, n - 1))
    }
  }
  const move = i => { if (i <= 0) return; const next = [...files]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; onChange?.(next) }
  const btn = { border: 'none', background: 'transparent', color: P.sub, borderRadius: 6, width: 26, height: 26, minHeight: 0, minWidth: 0, padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onPaste={e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); take(fs) } }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: P.sub, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="paperclip" size={14}/>{t.label} <span style={{ fontWeight: 500 }}>· {t.optional}</span></div>
      {files.length > 0 && (
        <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map((f, i) => { const kind = fileKind(f); return (
            <div role="listitem" key={f.url} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6, border: `1px solid ${P.line}`, borderRadius: 10, background: P.bg }}>
              {kind === 'image'
                ? <img src={imageThumb(f.url, 80)} alt="" width={36} height={36} style={{ borderRadius: 7, objectFit: 'cover', flex: 'none', display: 'block' }}/>
                : <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 7, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: kind === 'pdf' ? 'rgba(229,72,77,.12)' : 'rgba(0,168,132,.12)', color: kind === 'pdf' ? '#E5484D' : '#00A884' }}><Icon name={kind === 'video' ? 'video' : 'file'} size={17}/></span>}
              <a href={f.url} target="_blank" rel="noreferrer" dir="auto" style={{ flex: 1, minWidth: 0, color: P.text, fontSize: 12.5, fontWeight: 600, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}{f.size ? <span style={{ fontWeight: 400, color: P.sub }}> · {formatSize(f.size, lang)}</span> : null}
              </a>
              {i > 0 && <button type="button" style={btn} title={t.up} aria-label={`${t.up}: ${f.name}`} onClick={() => move(i)}>▲</button>}
              <button type="button" style={{ ...btn, color: P.danger }} title={t.remove} aria-label={`${t.remove}: ${f.name}`} onClick={() => onChange?.(files.filter(x => x.url !== f.url))}><Icon name="x" size={14}/></button>
            </div>
          ) })}
          <span style={{ fontSize: 11.5, color: P.sub }}>{t.hint}</span>
        </div>
      )}
      {files.length < TEMPLATE_FILES_MAX && (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy}
          onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer?.files) }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: compact ? '8px 12px' : '11px 14px', border: `1.5px dashed ${over ? P.accent : P.line}`, borderRadius: 12, background: 'transparent', color: P.text, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', textAlign: 'start', minHeight: 0 }}>
          <span aria-hidden style={{ width: 32, height: 32, borderRadius: 9, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: P.line, color: P.accent }}><Icon name="paperclip" size={16}/></span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <b style={{ fontSize: 13 }}>{busy ? t.uploading(busy) : t.add}</b>
            {!busy && <span style={{ fontSize: 11.5, color: P.sub }}>{t.drop}</span>}
          </span>
        </button>
      )}
      {err && <div role="alert" style={{ fontSize: 12, color: P.danger }}>{err}</div>}
      <input ref={fileRef} type="file" multiple accept={CHAT_ACCEPT} hidden onChange={e => { take(e.target.files); e.target.value = '' }}/>
    </div>
  )
}
