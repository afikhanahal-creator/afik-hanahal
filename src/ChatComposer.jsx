// The WhatsApp page's message box (src/GreenAPIChat.jsx owns the state; this draws it): one card with
//  · a line naming the template the text came from (changed → "שמירה בתבנית", ✕ clears the box),
//  · the attachment or the template's picture (thumbnail, name, remove),
//  · the text (grows with it; Enter sends, Shift+Enter = a new line),
//  · a toolbar: emoji · attach · "תבניות" … and a labelled send button that says what will go out.
// Line icons from src/uiIcons.jsx; the colors are the chat's WhatsApp palette.
import { useLayoutEffect } from 'react'
import { Icon } from './uiIcons.jsx'
import { imageThumb } from './lib/templateImage.js'

const TR = {
  he: {
    ph: n => (n ? `הודעה ל${n}…` : 'כתבו הודעה…'), send: 'שלח', sendImg: 'שלח עם תמונה', sending: 'שולח…', emoji: 'אימוג׳י', attach: 'צירוף תמונה או PDF', templates: 'תבניות',
    hint: 'Enter שליחה · Shift+Enter שורה חדשה', from: 'מתבנית', edited: 'נערך', saveTpl: 'שמירה בתבנית', saveTip: 'שמירת הנוסח הזה במקום התבנית, כדי שהלידים הבאים יקבלו אותו',
    clear: 'ניקוי ההודעה', remove: 'הסרה', tplPic: 'תמונה מהתבנית', caption: 'הטקסט יופיע מתחתיה', image: 'תמונה', doc: 'מסמך',
  },
  en: {
    ph: n => (n ? `Message ${n}…` : 'Write a message…'), send: 'Send', sendImg: 'Send with picture', sending: 'Sending…', emoji: 'Emoji', attach: 'Attach a picture or PDF', templates: 'Templates',
    hint: 'Enter to send · Shift+Enter new line', from: 'From template', edited: 'edited', saveTpl: 'Save to template', saveTip: 'Save this wording in place of the template, so the next leads get it',
    clear: 'Clear the message', remove: 'Remove', tplPic: 'Picture from the template', caption: 'The text goes under it', image: 'Picture', doc: 'Document',
  },
}
const EMOJI = ['😊', '🙂', '👍', '🙏', '✅', '📞', '📅', '📍', '🏠', '🔑', '💰', '📄', '👏', '💪', '❤️', '🤝', '⭐', '🎉']

const CSS = `
.ccm{flex-shrink:0;padding:8px 12px 12px;background:var(--ccm-soft);border-top:1px solid var(--ccm-line)}
.ccm *{box-sizing:border-box}
.ccm-card{background:var(--ccm-field);border:1px solid var(--ccm-line);border-radius:16px;box-shadow:0 1px 2px rgba(11,20,26,.06);transition:border-color .15s ease,box-shadow .15s ease;overflow:hidden}
.ccm-card:focus-within{border-color:var(--ccm-green);box-shadow:0 0 0 3px rgba(0,168,132,.13)}
.ccm-strip{display:flex;align-items:center;gap:8px;padding:7px 10px 7px 12px;font-size:12.5px;color:var(--ccm-sub);border-bottom:1px solid var(--ccm-line);background:var(--ccm-tint)}
.ccm-strip b{color:var(--ccm-text);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.ccm-att{display:flex;align-items:center;gap:10px;margin:10px 10px 0;padding:6px;padding-inline-end:4px;border:1px solid var(--ccm-line);border-radius:12px;background:var(--ccm-soft);max-width:420px}
.ccm-att img{width:44px;height:44px;border-radius:9px;object-fit:cover;flex:none;display:block}
.ccm-att .doc{width:44px;height:44px;border-radius:9px;flex:none;display:inline-flex;align-items:center;justify-content:center;background:rgba(0,168,132,.12);color:var(--ccm-green)}
.ccm textarea{display:block;width:100%;border:none;outline:none;resize:none;background:transparent;color:var(--ccm-text);font:inherit;font-size:14.5px;line-height:1.5;padding:12px 14px 6px;min-height:0;max-height:180px;overflow-y:auto}
.ccm textarea::placeholder{color:var(--ccm-sub)}
.ccm textarea:focus,.ccm textarea:focus-visible{outline:none!important;box-shadow:none!important}
.ccm-bar{display:flex;align-items:center;gap:2px;padding:4px 6px 6px}
.ccm-ib{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;border:none;background:transparent;color:var(--ccm-sub);cursor:pointer;min-height:0;min-width:0;padding:0;flex:none;transition:background .15s ease,color .15s ease}
.ccm-ib:hover,.ccm-ib[aria-pressed=true]{background:var(--ccm-hover);color:var(--ccm-text)}
.ccm-ib[aria-pressed=true]{color:var(--ccm-green)}
.ccm-tpl{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;margin-inline-start:4px;border-radius:999px;border:1px solid var(--ccm-line);background:transparent;color:var(--ccm-text);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;min-height:0;flex:none;transition:border-color .15s ease,color .15s ease,background .15s ease}
.ccm-tpl:hover{border-color:var(--ccm-green);color:var(--ccm-green)}
.ccm-tpl[aria-pressed=true]{border-color:var(--ccm-green);background:rgba(0,168,132,.10);color:var(--ccm-green)}
.ccm-hint{margin-inline-start:auto;padding-inline-end:10px;font-size:11.5px;color:var(--ccm-sub);white-space:nowrap}
.ccm-send{display:inline-flex;align-items:center;gap:8px;height:38px;padding:0 18px;border-radius:999px;border:none;background:var(--ccm-green);color:#fff;font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;min-height:0;flex:none;box-shadow:0 2px 6px rgba(0,168,132,.35);transition:background .15s ease,box-shadow .15s ease,opacity .15s ease}
.ccm-send:hover:not(:disabled){background:#019574}
.ccm-send:disabled{background:var(--ccm-hover);color:var(--ccm-sub);box-shadow:none;cursor:default}
.ccm-ib:focus-visible,.ccm-tpl:focus-visible,.ccm-send:focus-visible,.ccm-link:focus-visible{outline:2px solid var(--ccm-green);outline-offset:2px}
.ccm-link{border:none;background:transparent;color:var(--ccm-green);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;padding:3px 6px;border-radius:6px;min-height:0;white-space:nowrap}
.ccm-link:hover{background:rgba(0,168,132,.10)}
.ccm-emoji{display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:2px;margin-top:8px;padding:6px;border:1px solid var(--ccm-line);border-radius:14px;background:var(--ccm-field)}
.ccm-emoji button{height:38px;border:none;border-radius:9px;background:transparent;font-size:21px;cursor:pointer;min-height:0;padding:0;line-height:1}
.ccm-emoji button:hover{background:var(--ccm-hover)}
.ccm-ok{display:flex;align-items:center;gap:6px;margin:0 4px 7px;font-size:12.5px;font-weight:600;color:var(--ccm-green)}
@media (max-width:640px){.ccm-hint{display:none}.ccm-send .lbl{display:none}.ccm-send{width:42px;height:42px;padding:0;justify-content:center}.ccm-bar{justify-content:flex-start}.ccm-send{margin-inline-start:auto}}
`
let cssDone = false

export default function ChatComposer({
  WA, lang = 'he', leadName = '', input, setInput, inputRef, onSend, sending, canSend,
  attached, attachedPreview, onRemoveAttached, tplImg, onRemoveTplImg,
  inserted, changed, onSaveTemplate, onClear, savedNote,
  emojiOpen, onToggleEmoji, onPickFile, templatesOpen, onToggleTemplates,
}) {
  const t = TR[lang] || TR.he
  const rtl = lang !== 'en'
  useLayoutEffect(() => {
    if (!cssDone && typeof document !== 'undefined') { const el = document.createElement('style'); el.id = 'ccm-css'; el.textContent = CSS; document.head.appendChild(el); cssDone = true }
  }, [])
  // the box grows with its text (up to its max height)
  useLayoutEffect(() => { const el = inputRef?.current; if (el) { el.style.height = 'auto'; el.style.height = `${Math.min(180, el.scrollHeight)}px` } }, [input, inputRef])
  const v = { '--ccm-green': WA.green, '--ccm-line': WA.border, '--ccm-sub': WA.subText, '--ccm-text': WA.bodyText, '--ccm-hover': WA.hoverRow, '--ccm-field': WA.inputFieldBg, '--ccm-soft': WA.inputBg, '--ccm-tint': WA.panelBg }
  const pic = attached ? (attachedPreview || null) : tplImg ? imageThumb(tplImg.url, 96) : null
  const withPic = !!(tplImg && !attached) || !!(attached && attached.type?.startsWith('image/'))

  return (
    <div className="ccm" dir={rtl ? 'rtl' : 'ltr'} style={v}>
      {savedNote && <div className="ccm-ok" role="status"><Icon name="check" size={15} sw={2.4}/>{savedNote}</div>}
      <div className="ccm-card">
        {inserted && (
          <div className="ccm-strip">
            <Icon name="file" size={14}/>
            <span style={{ flex: 'none' }}>{t.from}</span>
            <b>{inserted.title}</b>
            {changed && <span style={{ flex: 'none' }}>· {t.edited}</span>}
            <span style={{ flex: 1 }}/>
            {changed && onSaveTemplate && <button type="button" className="ccm-link" title={t.saveTip} onClick={onSaveTemplate}>{t.saveTpl}</button>}
            <button type="button" className="ccm-ib" style={{ width: 28, height: 28 }} onClick={onClear} aria-label={t.clear} title={t.clear}><Icon name="x" size={15}/></button>
          </div>
        )}
        {(attached || tplImg) && (
          <div className="ccm-att">
            {pic ? <img src={pic} alt=""/> : <span className="doc"><Icon name="file" size={20}/></span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ccm-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attached ? attached.name : t.tplPic}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ccm-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {attached ? `${(attached.size / 1024).toFixed(0)} KB · ${attached.type?.startsWith('image/') ? t.image : t.doc}` : `${tplImg.title} · ${t.caption}`}
              </div>
            </div>
            <button type="button" className="ccm-ib" onClick={attached ? onRemoveAttached : onRemoveTplImg} aria-label={t.remove} title={t.remove}><Icon name="x" size={16}/></button>
          </div>
        )}
        <textarea ref={inputRef} rows={1} value={input} onChange={e => setInput(e.target.value)} dir="auto" autoComplete="off"
          placeholder={t.ph(leadName)} aria-label={t.ph(leadName)} disabled={sending}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend() } }}/>
        <div className="ccm-bar">
          <button type="button" className="ccm-ib" aria-pressed={!!emojiOpen} onClick={onToggleEmoji} aria-label={t.emoji} title={t.emoji}><Icon name="smile" size={20}/></button>
          <button type="button" className="ccm-ib" onClick={onPickFile} aria-label={t.attach} title={t.attach}><Icon name="paperclip" size={19}/></button>
          <button type="button" className="ccm-tpl" aria-pressed={!!templatesOpen} onClick={onToggleTemplates}><Icon name="file" size={15}/>{t.templates}</button>
          <span className="ccm-hint">{t.hint}</span>
          <button type="button" className="ccm-send" onClick={() => onSend()} disabled={!canSend || sending} aria-label={withPic ? t.sendImg : t.send}>
            {sending ? <span className="lbl">{t.sending}</span> : <><span className="lbl">{withPic ? t.sendImg : t.send}</span><Icon name="send" size={17} flip={rtl}/></>}
          </button>
        </div>
      </div>
      {emojiOpen && (
        <div className="ccm-emoji" role="group" aria-label={t.emoji}>
          {EMOJI.map(em => <button key={em} type="button" onClick={() => { setInput(x => x + em); inputRef?.current?.focus() }} aria-label={em}>{em}</button>)}
        </div>
      )}
    </div>
  )
}
