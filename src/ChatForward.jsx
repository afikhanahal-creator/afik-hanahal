// "העברה" like WhatsApp: one or several messages forwarded to one or several chats at once (Green forwardMessages through
// POST /api/meta/chat-forward — the lead sees "הועברה", the original file / text as is). Pick chats from the list (search by
// name or phone, a typed number that isn't a chat yet works too), up to 10, then a result per chat.
import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import WaFace from './WaFace.jsx'
import { intlPhone } from '../lib/automations-shared.js'

const MAX_TO = 10
const TXT = {
  he: { title: n => (n === 1 ? 'העברת הודעה' : `העברת ${n} הודעות`), search: 'חיפוש שם או מספר', close: 'סגירה', send: n => (n ? `העברה ל-${n}` : 'העברה'), sending: 'מעביר…',
    max: `עד ${MAX_TO} שיחות בבת אחת`, none: 'לא נמצאו שיחות', typed: p => `העברה למספר ${p}`, chosen: 'נבחרו', ok: 'הועבר', fail: 'לא הועבר', allOk: n => `הועבר ל-${n} שיחות ✓`, some: (a, b) => `הועבר ל-${a} מתוך ${b}`,
    quota: 'המכסה החודשית של Green API נגמרה — אפשר לשדרג ב-console.green-api.com', err: 'ההעברה נכשלה', remove: 'הסרה', file: 'קובץ', retry: 'לנסות שוב לשאר' },
  en: { title: n => (n === 1 ? 'Forward message' : `Forward ${n} messages`), search: 'Search name or number', close: 'Close', send: n => (n ? `Forward to ${n}` : 'Forward'), sending: 'Forwarding…',
    max: `Up to ${MAX_TO} chats at once`, none: 'No chats found', typed: p => `Forward to ${p}`, chosen: 'Selected', ok: 'Forwarded', fail: 'Not forwarded', allOk: n => `Forwarded to ${n} chats ✓`, some: (a, b) => `Forwarded to ${a} of ${b}`,
    quota: 'The Green API monthly quota is used up — upgrade at console.green-api.com', err: 'Forwarding failed', remove: 'Remove', file: 'File', retry: 'Try the rest again' },
}
const local = p => { const d = intlPhone(p); return d.startsWith('972') ? `0${d.slice(3, 5)}-${d.slice(5, 8)}-${d.slice(8)}` : d }

/** contacts: [{ phone, name }] newest first · messages: [{ id, text }] · fromPhone: the chat they are in */
export default function ChatForward({ WA, lang = 'he', contacts = [], messages = [], fromPhone, onClose, onDone, authHeader = {} }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const rtl = lang !== 'en'
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState([])     // [{ phone, name }]
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)         // { results, sent, total, error, quota }
  const inputRef = useRef(null)
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 30) }, [])
  useEffect(() => { const k = e => { if (e.key === 'Escape' && !busy) { e.preventDefault(); onClose() } }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [busy, onClose])

  const from = intlPhone(fromPhone)
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase(), qd = q.replace(/\D/g, '')
    const seen = new Set()
    return contacts.filter(c => {
      const p = intlPhone(c.phone)
      if (!p || p === from || seen.has(p)) return false
      seen.add(p)
      if (!ql) return true
      return String(c.name || '').toLowerCase().includes(ql) || (qd.length >= 3 && (p.includes(qd) || ('0' + p.slice(3)).includes(qd)))
    }).slice(0, 200)
  }, [contacts, q, from])
  const typed = useMemo(() => { const p = intlPhone(q); return /^972\d{8,9}$/.test(p) && p !== from && !list.some(c => intlPhone(c.phone) === p) ? p : '' }, [q, list, from])
  const isOn = p => picked.some(x => intlPhone(x.phone) === intlPhone(p))
  const toggle = c => setPicked(cur => isOn(c.phone) ? cur.filter(x => intlPhone(x.phone) !== intlPhone(c.phone)) : cur.length >= MAX_TO ? cur : [...cur, c])

  const send = async () => {
    if (!picked.length || busy) return
    setBusy(true); setRes(null)
    try {
      const r = await fetch('/api/meta/chat-forward', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ from, to: picked.map(x => intlPhone(x.phone)), ids: messages.map(m => m.id) }), signal: AbortSignal.timeout(55000) })
      const d = await r.json().catch(() => ({}))
      setRes(d.results ? d : { error: d.error || `HTTP ${r.status}` })
      if (d.ok) { onDone?.(d); setTimeout(onClose, 1100) }
    } catch (e) { setRes({ error: e.name === 'TimeoutError' ? 'timeout' : e.message }) } finally { setBusy(false) }
  }
  const resOf = p => res?.results?.find(x => x.phone === intlPhone(p))

  const line = WA.border, sub = WA.subText
  const row = on => ({ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '8px 16px', border: 'none', background: on ? 'rgba(0,168,132,.10)' : 'transparent', color: WA.bodyText, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', textAlign: 'start', minHeight: 0 })
  const box = on => ({ flex: 'none', width: 20, height: 20, borderRadius: 5, border: `2px solid ${on ? WA.green : sub}`, background: on ? WA.green : 'transparent', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 })

  return createPortal(
    <div role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 3100, background: 'rgba(11,20,26,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={t.title(messages.length)} dir={rtl ? 'rtl' : 'ltr'}
        style={{ width: 'min(520px, 100%)', maxHeight: 'min(720px, 92vh)', display: 'flex', flexDirection: 'column', background: WA.modalBg || WA.panelBg, color: WA.bodyText, borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,.35)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${line}` }}>
          <b style={{ flex: 1, fontSize: 16 }}>{t.title(messages.length)}</b>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t.close} style={{ width: 34, height: 34, minHeight: 0, borderRadius: '50%', border: 'none', background: 'transparent', color: sub, cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        {/* what is forwarded */}
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${line}`, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 108, overflowY: 'auto', background: WA.inputBg }}>
          {messages.map(m => <div key={m.id} dir="auto" style={{ fontSize: 12.5, color: sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↪ {m.text || t.file}</div>)}
        </div>
        <div style={{ padding: '10px 16px 6px' }}>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}
            onKeyDown={e => { if (e.key === 'Enter' && typed) { e.preventDefault(); toggle({ phone: typed, name: local(typed) }); setQ('') } }}
            style={{ width: '100%', height: 38, borderRadius: 9, border: `1px solid ${line}`, background: WA.inputFieldBg || WA.inputBg, color: WA.bodyText, padding: '0 12px', fontFamily: 'inherit', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
        </div>
        {picked.length > 0 && <div aria-label={t.chosen} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '2px 16px 8px' }}>
          {picked.map(c => { const r = resOf(c.phone); return (
            <span key={c.phone} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 6px 0 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600,
              background: r ? (r.ok ? 'rgba(0,168,132,.14)' : 'rgba(229,72,77,.12)') : WA.inputBg, border: `1px solid ${r ? (r.ok ? WA.green : '#E5484D') : line}` }} title={r && !r.ok ? r.error : undefined}>
              {r ? (r.ok ? '✓' : '!') : null}<bdi>{c.name || local(c.phone)}</bdi>
              {!res && <button type="button" onClick={() => toggle(c)} aria-label={`${t.remove}: ${c.name || local(c.phone)}`} style={{ width: 20, height: 20, minHeight: 0, border: 'none', borderRadius: '50%', background: 'transparent', color: sub, cursor: 'pointer', padding: 0 }}>✕</button>}
            </span>
          ) })}
        </div>}
        <div role="listbox" aria-multiselectable="true" style={{ flex: 1, minHeight: 120, overflowY: 'auto', borderTop: `1px solid ${line}` }}>
          {typed && <button type="button" role="option" aria-selected={false} style={row(false)} onClick={() => { toggle({ phone: typed, name: local(typed) }); setQ('') }}>
            <span style={box(false)}/><span style={{ fontWeight: 600 }}>{t.typed(local(typed))}</span>
          </button>}
          {list.map(c => { const on = isOn(c.phone); const full = !on && picked.length >= MAX_TO; return (
            <button key={c.phone} type="button" role="option" aria-selected={on} disabled={full || !!res} onClick={() => toggle(c)} style={{ ...row(on), opacity: full ? .45 : 1 }} title={full ? t.max : undefined}>
              <span style={box(on)}>{on ? '✓' : ''}</span>
              <WaFace phone={c.phone} name={c.name} size={36} zoom={false} lang={lang}/>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><bdi>{c.name || local(c.phone)}</bdi></span>
                {c.name && <span style={{ display: 'block', fontSize: 12, color: sub, direction: 'ltr', textAlign: rtl ? 'right' : 'left' }}>{local(c.phone)}</span>}
              </span>
            </button>
          ) })}
          {!list.length && !typed && <div style={{ padding: 24, textAlign: 'center', color: sub, fontSize: 13 }}>{t.none}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderTop: `1px solid ${line}` }}>
          <span role="status" style={{ flex: 1, fontSize: 12.5, color: res?.error || (res && !res.ok) ? '#E5484D' : sub }}>
            {res ? (res.error ? `${t.err}: ${res.error}` : res.quota ? t.quota : res.ok ? t.allOk(res.sent) : t.some(res.sent, res.total)) : picked.length >= MAX_TO ? t.max : ''}
          </span>
          <button type="button" onClick={res && !res.ok ? () => { setPicked(cur => cur.filter(c => !resOf(c.phone)?.ok)); setRes(null) } : send} disabled={!picked.length || busy || (res && res.ok)}
            style={{ height: 40, padding: '0 18px', borderRadius: 999, border: 'none', background: WA.green, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: !picked.length || busy ? .5 : 1, minHeight: 0 }}>
            {busy ? t.sending : res && !res.ok ? t.retry : t.send(picked.length)}
          </button>
        </div>
      </div>
    </div>, document.body)
}
