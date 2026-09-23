// Small, eagerly-loaded part of the automations feature: the API helper and the "send the stage
// message?" prompt the leads board shows. The full tab (AutomationsTab.jsx) stays lazy-loaded.
import { useState, useEffect } from 'react'

const ADMIN_TOKEN = 'AFIKhanahal2026'
const API = '/api/meta'
const HJ = { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` }
const handle = async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); return d }
export const autoApi = {
  get: a => fetch(`${API}/${a}`, { headers: HJ, signal: AbortSignal.timeout(30000) }).then(handle),
  post: (a, body) => fetch(`${API}/${a}`, { method: 'POST', headers: HJ, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(45000) }).then(handle),
}

const TR = {
  he: { title: 'לשלוח הודעה ללקוח?', moved: 'עבר לשלב', send: 'שלח עכשיו', later: 'אחר כך (נשאר בלשונית "לאישור")', skip: 'לא לשלוח', sending: 'שולח…', sent: 'נשלח ✓', error: 'שגיאה' },
  en: { title: 'Send a message to the lead?', moved: 'Moved to', send: 'Send now', later: 'Later (stays in "To approve")', skip: 'Do not send', sending: 'Sending…', sent: 'Sent ✓', error: 'Error' },
}

// prompt = { lead, stage, stageName, ruleKey, templateId, text }
export function StageSendPrompt({ prompt, lang = 'he', onClose, onSent }) {
  const t = TR[lang] || TR.he
  const [text, setText] = useState(prompt?.text || '')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { setText(prompt?.text || ''); setErr(''); setBusy('') }, [prompt])
  if (!prompt) return null
  const act = async what => {
    setBusy(what); setErr('')
    try {
      if (what === 'send') {
        const r = await autoApi.post('auto-send', { items: [{ leadId: String(prompt.lead.id), phone: prompt.lead.phone, name: prompt.lead.name, text, ruleKey: prompt.ruleKey, templateId: prompt.templateId }] })
        if (!r.results?.[0]?.ok) throw new Error(r.results?.[0]?.error || t.error)
        onSent?.()
      } else await autoApi.post('auto-skip', { leadId: String(prompt.lead.id), ruleKey: prompt.ruleKey })
      onClose()
    } catch (e) { setErr(e.message); setBusy('') }
  }
  const b = (bg, bd, c) => ({ padding: '9px 14px', borderRadius: 9, border: `1px solid ${bd}`, background: bg, color: c, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: 0 })
  return (
    <div onMouseDown={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 2600, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ width: '100%', maxWidth: 480, background: 'var(--au-pop)', border: '1px solid rgba(37,211,102,.35)', borderRadius: 16, padding: 18, color: 'var(--au-text)', boxShadow: 'var(--au-shadow2)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>💬 {t.title}</div>
        <div style={{ fontSize: 13, color: 'rgba(var(--ink),.7)' }}><b style={{ color: 'var(--au-text)' }}>{prompt.lead.name || prompt.lead.phone}</b> · {t.moved} "{prompt.stageName || prompt.stage}"</div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6} dir="auto" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, background: '#0B2A22', border: '1px solid rgba(37,211,102,.25)', color: '#E9EDEF', fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.55, resize: 'vertical', outline: 'none' }}/>
        {err && <div style={{ color: '#E05252', fontSize: 12.5 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button onClick={() => act('skip')} disabled={!!busy} style={b('transparent', 'rgba(var(--ink),.2)', 'rgba(var(--ink),.65)')}>{t.skip}</button>
          <button onClick={onClose} disabled={!!busy} style={b('transparent', 'rgba(132,144,216,.3)', '#8490D8')}>{t.later}</button>
          <button onClick={() => act('send')} disabled={!!busy || !text.trim()} style={b('rgba(37,211,102,.16)', 'rgba(37,211,102,.55)', '#25D366')}>{busy === 'send' ? t.sending : t.send}</button>
        </div>
      </div>
    </div>
  )
}
