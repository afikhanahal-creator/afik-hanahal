// A template's picture (optional): pick, drop or paste an image → compressed and uploaded (src/lib/templateImage.js) →
// its URL is the template's `image`; the message then goes out as a WhatsApp image with the text as its caption.
// Used by the templates tab's editor (admin tokens) and the chat's quick editor (WhatsApp colors) — `pal` holds the colors.
import { useState, useRef } from 'react'
import { uploadTemplateImage, imageThumb, TEMPLATE_IMAGE_TYPES } from './lib/templateImage.js'
import { Icon } from './uiIcons.jsx'

const TR = {
  he: { label: 'תמונה להודעה', optional: 'לא חובה', add: 'הוספת תמונה', drop: 'גררו לכאן תמונה, הדביקו (Ctrl+V) או לחצו לבחירה', hint: 'ההודעה תישלח כתמונה, והטקסט יופיע מתחתיה', change: 'החלפה', remove: 'הסרה', uploading: 'מעלה ודוחס…', open: 'פתיחה בגודל מלא' },
  en: { label: 'Picture', optional: 'optional', add: 'Add a picture', drop: 'Drop a picture here, paste (Ctrl+V) or click to choose', hint: 'The message goes out as a picture, with the text under it', change: 'Replace', remove: 'Remove', uploading: 'Uploading…', open: 'Open full size' },
}

export default function TemplateImageField({ value = '', onChange, lang = 'he', pal = {}, compact = false }) {
  const t = TR[lang] || TR.he
  const P = { text: 'var(--au-text)', sub: 'var(--au-text3)', line: 'rgba(var(--ink),.14)', bg: 'rgba(var(--ov),.03)', accent: 'var(--au-brand)', danger: '#DC2626', ...pal }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [over, setOver] = useState(false)
  const fileRef = useRef(null)
  const take = async file => {
    if (!file) return
    setBusy(true); setErr('')
    try { const r = await uploadTemplateImage(file); onChange?.(r.url) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const onPaste = e => { const f = [...(e.clipboardData?.files || [])].find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); take(f) } }
  const input = <input ref={fileRef} type="file" accept={TEMPLATE_IMAGE_TYPES} hidden onChange={e => { take(e.target.files?.[0]); e.target.value = '' }}/>
  const btn = (extra = {}) => ({ border: `1px solid ${P.line}`, background: 'transparent', color: P.text, borderRadius: 8, padding: '5px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0, ...extra })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onPaste={onPaste}>
      <div style={{ fontSize: 12, fontWeight: 700, color: P.sub, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="image" size={14}/>{t.label} <span style={{ fontWeight: 500 }}>· {t.optional}</span></div>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, border: `1px solid ${P.line}`, borderRadius: 12, background: P.bg }}>
          <a href={value} target="_blank" rel="noreferrer" title={t.open} style={{ flex: 'none', lineHeight: 0 }}>
            <img src={imageThumb(value, 200)} alt="" width={compact ? 64 : 84} height={compact ? 64 : 84} style={{ borderRadius: 9, objectFit: 'cover', display: 'block', background: P.line }}/>
          </a>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: P.sub, lineHeight: 1.45 }}>{busy ? t.uploading : t.hint}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" style={btn()} disabled={busy} onClick={() => fileRef.current?.click()}>{t.change}</button>
              <button type="button" style={btn({ color: P.danger, borderColor: 'transparent' })} disabled={busy} onClick={() => onChange?.('')}>{t.remove}</button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); take([...(e.dataTransfer?.files || [])].find(x => /^image\//.test(x.type))) }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: compact ? '9px 12px' : '12px 14px', border: `1.5px dashed ${over ? P.accent : P.line}`, borderRadius: 12, background: over ? 'rgba(37,211,102,.08)' : P.bg, color: P.text, cursor: busy ? 'progress' : 'pointer', fontFamily: 'inherit', textAlign: 'start', minHeight: 0 }}>
          <span aria-hidden style={{ width: 34, height: 34, borderRadius: 9, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: P.line, fontSize: 17, color: P.accent }}><Icon name={busy ? 'clock' : 'plus'} size={18} sw={2}/></span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <b style={{ fontSize: 13 }}>{busy ? t.uploading : t.add}</b>
            {!busy && <span style={{ fontSize: 11.5, color: P.sub }}>{t.drop}</span>}
          </span>
        </button>
      )}
      {err && <div role="alert" style={{ fontSize: 12, color: P.danger }}>{err}</div>}
      {input}
    </div>
  )
}
