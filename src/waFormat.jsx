// WhatsApp text formatting → React nodes (no innerHTML), the subset WhatsApp itself renders:
//   *bold*  _italic_  ~strike~  ```mono```  + links.  One level of nesting.
// A marker must touch a non-space character inside, and the opening marker must follow the start of the
// line, a space or punctuation (so "2*3*4" and "snake_case_name" stay plain, like on WhatsApp).
// Personal values can be highlighted in previews: renderTemplate output wrapped with HL_OPEN/HL_CLOSE.
import { Fragment } from 'react'

export const HL_OPEN = '\uE000', HL_CLOSE = '\uE001'
const PRE = '(^|[\\s.,!?;:()\\[\\]"\'\\u05BE\\u2013\\u2014-])'
const M = c => `\\${c}(?=[^\\s\\${c}])(?:[^\\${c}\\n]*?[^\\s\\${c}])?\\${c}`
const TOKEN = new RegExp(`${PRE}(\`\`\`[\\s\\S]+?\`\`\`|${M('*')}|${M('_')}|${M('~')})|(https?:\\/\\/[^\\s${HL_CLOSE}]+)|(${HL_OPEN}[^${HL_CLOSE}]*${HL_CLOSE})`, 'g')

function inline(text, key, depth = 0, highlight) {
  const out = []
  let last = 0, m, i = 0
  const re = new RegExp(TOKEN.source, 'g')
  while ((m = re.exec(text))) {
    const [all, pre = '', fmt, url, hl] = m
    const start = m.index + pre.length
    if (start > last) out.push(text.slice(last, start))
    const k = `${key}-${i++}`
    if (hl) {
      const inner = hl.slice(1, -1)
      out.push(highlight ? <span key={k} style={{ borderBottom: '1px dotted #53BDEB', paddingBottom: 1 }}>{inline(inner, k, depth, highlight)}</span> : <Fragment key={k}>{inline(inner, k, depth, highlight)}</Fragment>)
    } else if (url) {
      out.push(<span key={k} style={{ color: '#53BDEB', textDecoration: 'underline', wordBreak: 'break-all' }}>{url}</span>)
    } else if (fmt) {
      const inner = fmt.startsWith('```') ? fmt.slice(3, -3) : fmt.slice(1, -1)
      const kids = depth < 1 && !fmt.startsWith('```') ? inline(inner, k, depth + 1, highlight) : inner
      if (fmt.startsWith('```')) out.push(<code key={k} style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: '.92em' }}>{kids}</code>)
      else if (fmt[0] === '*') out.push(<b key={k}>{kids}</b>)
      else if (fmt[0] === '_') out.push(<i key={k}>{kids}</i>)
      else out.push(<s key={k}>{kids}</s>)
    }
    last = m.index + all.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function WAText({ text, highlight }) {
  const src = highlight ? String(text || '') : String(text || '').replace(new RegExp(`[${HL_OPEN}${HL_CLOSE}]`, 'g'), '')
  const lines = src.split('\n')
  return lines.map((ln, i) => <Fragment key={i}>{inline(ln, `l${i}`, 0, highlight)}{i < lines.length - 1 && '\n'}</Fragment>)
}
export const stripHL = s => String(s || '').replace(new RegExp(`[${HL_OPEN}${HL_CLOSE}]`, 'g'), '')

// Toolbar: wrap the selection (trimmed) with a marker, or unwrap it when it is already wrapped.
// With no selection, insert the pair and put the caret in between.
export function toggleMarker(value, a, b, marker) {
  const L = marker.length
  let s = a, e = b
  while (s < e && /\s/.test(value[s])) s++
  while (e > s && /\s/.test(value[e - 1])) e--
  if (value.slice(s - L, s) === marker && value.slice(e, e + L) === marker && e > s) {
    const next = value.slice(0, s - L) + value.slice(s, e) + value.slice(e + L)
    return { next, selStart: s - L, selEnd: e - L }
  }
  const sel = value.slice(s, e)
  if (sel.startsWith(marker) && sel.endsWith(marker) && sel.length > 2 * L) {
    const inner = sel.slice(L, -L)
    return { next: value.slice(0, s) + inner + value.slice(e), selStart: s, selEnd: s + inner.length }
  }
  const next = value.slice(0, s) + marker + sel + marker + value.slice(e)
  return { next, selStart: s + L, selEnd: s + L + sel.length }
}

export const EMOJI_POPULAR = ['👋', '🙂', '😊', '🙏', '🙌', '👍', '🎉', '✨', '🔥', '❤️', '✅', '☑️', '📞', '📱', '💬', '📩', '📅', '⏰', '📍', '🗺️', '🏡', '🏠', '🏘️', '🏗️', '🌳', '🌿', '☀️', '🌼', '🔑', '🤝', '💰', '📈', '📝', '📄', '📎', '🧾', '🚗', '🛋️', '🪴', '🏊', '👨‍👩‍👧', '🎁', '🥂', '🕯️', '🍎', '🍯', '⭐', '👉']
const RECENT_KEY = 'afik_auto_emoji_recent'
export function recentEmoji() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 16) } catch { return [] } }
export function pushRecentEmoji(e) { try { const r = [e, ...recentEmoji().filter(x => x !== e)].slice(0, 16); localStorage.setItem(RECENT_KEY, JSON.stringify(r)) } catch {} }
