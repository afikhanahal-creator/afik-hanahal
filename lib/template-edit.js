// Turning an edited WhatsApp message back into a template, and saving a template edit into the automations config.
// Pure and shared by the browser (the chat's "save in place of the template") and the tests.
//
// The message in the box was rendered for one lead ("היי אמיר, … זרובבל 15"). Saving that text as is would send "אמיר" to
// everyone. So the render is marked (renderTemplate(…, { keys: true }) → keyvalue), the edited text is
// aligned with the rendered one character by character, and every filled-in value that survived the edit unchanged goes
// back to its placeholder ({name}, {property}…). A value the user rewrote stays as the user wrote it.

const OPEN = '', SEP = '', CLOSE = ''

/** marked render → { plain, spans: [{ start, end, key }] } */
export function parseMarked(marked = '') {
  let plain = ''
  const spans = []
  const re = new RegExp(`${OPEN}(\\w+)${SEP}([\\s\\S]*?)${CLOSE}`, 'g')
  let last = 0, m
  while ((m = re.exec(marked))) {
    plain += marked.slice(last, m.index)
    spans.push({ start: plain.length, end: plain.length + m[2].length, key: m[1] })
    plain += m[2]
    last = re.lastIndex
  }
  plain += marked.slice(last)
  return { plain, spans }
}

// LCS alignment: for every character of a, its index in b (or -1)
function align(a, b) {
  const n = a.length, m = b.length
  const W = m + 1
  const dp = new Uint16Array((n + 1) * W)
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i * W + j] = a[i] === b[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1])
  }
  const map = new Array(n).fill(-1)
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { map[i] = j; i++; j++ }
    else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++
    else j++
  }
  return map
}

/** edited message + the marked render it came from → template text with placeholders back */
export function untemplate(edited = '', marked = '') {
  const { plain, spans } = parseMarked(marked)
  if (!spans.length) return edited
  let repl = []
  if (plain.length * edited.length <= 4e6) {
    const map = align(plain, edited)
    for (const sp of spans) {
      const idx = []
      for (let k = sp.start; k < sp.end; k++) idx.push(map[k])
      const whole = idx.every((v, k) => v >= 0 && (k === 0 || v === idx[k - 1] + 1))
      if (whole) repl.push({ from: idx[0], to: idx[idx.length - 1] + 1, key: sp.key })
    }
  } else {
    // a very long text: the first occurrence of each value that is long enough to be unambiguous
    for (const sp of spans) {
      const val = plain.slice(sp.start, sp.end)
      const at = val.length >= 3 ? edited.indexOf(val) : -1
      if (at >= 0 && !repl.some(r => at < r.to && at + val.length > r.from)) repl.push({ from: at, to: at + val.length, key: sp.key })
    }
  }
  repl = repl.sort((x, y) => y.from - x.from)
  let out = edited
  for (const r of repl) out = out.slice(0, r.from) + `{${r.key}}` + out.slice(r.to)
  return out
}

/** A template edit into the automations config (same shape the templates tab saves). Returns a new config. */
export function withTemplate(cfg = {}, tpl = {}, patch = {}) {
  const next = JSON.parse(JSON.stringify(cfg || {}))
  const id = patch.id || tpl.id
  const merged = { cat: tpl.cat || 'general', he: tpl.he || '', en: tpl.en || '', he_title: tpl.he_title || '', en_title: tpl.en_title || '', ...patch }
  delete merged.id
  next.templates = { ...(next.templates || {}), [id]: { cat: merged.cat, he: merged.he, en: merged.en, he_title: merged.he_title, en_title: merged.en_title } }
  next.deletedTemplates = (next.deletedTemplates || []).filter(d => d !== id)
  return next
}

/** Back to the built-in wording: drops the office's override of a built-in template */
export function withoutOverride(cfg = {}, id) {
  const next = JSON.parse(JSON.stringify(cfg || {}))
  if (next.templates) delete next.templates[id]
  return next
}

export const newTemplateId = () => `c_${Date.now().toString(36)}`
