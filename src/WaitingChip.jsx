// "ממתין לתשובה": a lead wrote to us on WhatsApp and nobody has answered yet (src/lib/waWaiting.js). Green under 10 minutes,
// amber under an hour, red after — the same scale as the chats list. A click opens the chat when onOpen is given.
import { useWaiting, waitingOf } from './lib/waWaiting.js'
import { waitingState, fmtWait } from './lib/waInbox.js'

const COLORS = { fresh: ['rgba(37,211,102,.14)', '#128C4A'], warn: ['rgba(245,158,11,.16)', 'var(--au-amber-text, #9A5B00)'], late: ['rgba(224,82,82,.14)', 'var(--au-red-text, #C0392B)'] }

export default function WaitingChip({ phone, lang = 'he', onOpen, size = 'sm' }) {
  const w = waitingOf(useWaiting(), phone)
  if (!w) return null
  const st = waitingState({ dir: 'in', ts: w.ts }, Date.now(), { maxDays: 14 })
  if (!st.waiting) return null
  const [bg, fg] = COLORS[st.level] || COLORS.late
  const en = lang === 'en'
  const tip = `${en ? 'Wrote to us and is waiting for a reply' : 'כתבו לנו ועוד לא ענינו'}${w.text ? ` · «${w.text.slice(0, 90)}»` : ''}`
  const Tag = onOpen ? 'button' : 'span'
  return (
    <Tag type={onOpen ? 'button' : undefined} title={tip} aria-label={tip} className="wa-waiting-chip"
      onClick={onOpen ? e => { e.stopPropagation(); onOpen() } : undefined}
      onPointerDown={onOpen ? e => e.stopPropagation() : undefined}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap', minHeight: 0, minWidth: 0, border: 'none', cursor: onOpen ? 'pointer' : 'default',
        background: bg, color: fg, borderRadius: 999, padding: size === 'xs' ? '1px 7px' : '2px 8px', fontSize: size === 'xs' ? 10.5 : 11.5, fontWeight: 800, fontFamily: 'inherit', lineHeight: 1.6 }}>
      <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm1 11h-5v-2h3V6h2v7Z"/></svg>
      {fmtWait(st.mins, lang)}
    </Tag>
  )
}
