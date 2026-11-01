import { leadProperty, templateFiles, CATEGORIES, sameProject } from './automations-shared.js'
import { givenName } from './hebrew-names.js'
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
  const merged = { cat: tpl.cat || 'general', he: tpl.he || '', en: tpl.en || '', he_title: tpl.he_title || '', en_title: tpl.en_title || '', image: tpl.image || '', project: tpl.project || '', files: tpl.files || [], ...patch }
  delete merged.id
  // image = the template's picture (an https URL); none = no key at all
  const image = typeof merged.image === 'string' && /^https:\/\//i.test(merged.image.trim()) ? merged.image.trim() : ''
  const project = typeof merged.project === 'string' ? merged.project.trim().slice(0, 80) : ''
  const files = templateFiles(merged)
  next.templates = { ...(next.templates || {}), [id]: { cat: merged.cat, he: merged.he, en: merged.en, he_title: merged.he_title, en_title: merged.en_title, ...(image ? { image } : {}), ...(project ? { project } : {}), ...(files.length ? { files } : {}) } }
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

/** A message from a chat → a template that fits every lead: the lead's project / listing becomes {property} and their first
 *  name {name} (whole words only — "רון" inside "ירון" stays). */
export function messageToTemplate(text = '', lead = {}) {
  let out = String(text || '')
  const esc = v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const word = v => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(v)}(?=$|[^\\p{L}\\p{N}])`, 'gu')
  const prop = String(leadProperty(lead) || '').trim()
  if (prop.length >= 2) out = out.replace(word(prop), (m, pre) => `${pre}{property}`)
  const first = String(givenName(lead?.name || '') || '').trim()
  if (first.length >= 2) out = out.replace(word(first), (m, pre) => `${pre}{name}`)
  return out
}

/** A short name from the message itself: the project, then its first words without the greeting ("זרובבל 15 · מצרפים את המחירון") */
export function autoTitle(project = '', text = '') {
  let x = String(text || '').replace(/\{property\}/g, String(project || '').trim()).replace(/\{[a-z]+\}/g, '').replace(/^\s*(היי|שלום|הי|hi|hello|hey)(?=[\s,.!?]|$)/i, '')
    .replace(/^[\s,.!?:;\-–]+/, '').replace(/\s+([,.!?;:])/g, '$1').replace(/\s+/g, ' ').trim()
  if (x.length > 34) x = `${x.slice(0, 34).replace(/\s+\S*$/, '')}…`
  const p = String(project || '').trim()
  if (p && x.startsWith(p)) x = x.slice(p.length).replace(/^[\s,.!?:;\-–·]+/, '')
  return [p, x].filter(Boolean).join(' · ')
}

/** The projects / groups a template can belong to: the templates' own (most used first), then the leads' projects */
export function knownProjects(tpls = [], leads = [], max = 30) {
  const seen = []
  const add = (name, n = 1) => {
    const v = String(name || '').replace(/\s+/g, ' ').trim()
    if (!v || v.length > 80) return
    const hit = seen.find(x => sameProject(x.name, v))
    if (hit) hit.n += n; else seen.push({ name: v, n, tpl: 0 })
  }
  for (const t of tpls) if (t?.project) { add(t.project); const h = seen.find(x => sameProject(x.name, t.project)); if (h) h.tpl++ }
  for (const l of leads) add(leadProperty(l || {}))
  return seen.sort((a, b) => b.tpl - a.tpl || b.n - a.n).slice(0, max).map(x => ({ name: x.name, templates: x.tpl, leads: x.n - x.tpl }))
}

/** Name ideas for a template — "<category> · <project>", "<project> · <first words>", the first words — none already taken */
export function titleIdeas({ project = '', cat = '', text = '', lang = 'he', taken = [] } = {}) {
  const p = String(project || '').trim()
  const c = CATEGORIES.find(x => x.id === cat)
  const short = c ? (lang === 'en' ? c.en_short : c.short) : ''
  const used = new Set(taken.map(x => String(x || '').trim()).filter(Boolean))
  const free = name => { if (!used.has(name)) return name; for (let i = 2; i < 50; i++) if (!used.has(`${name} ${i}`)) return `${name} ${i}`; return name }
  const raw = [p && short && `${short} · ${p}`, p && autoTitle(p, text), autoTitle('', text), p]
  const out = []
  for (const r of raw) { const v = String(r || '').trim(); if (v && v !== p + ' · ' && !out.includes(free(v))) out.push(free(v)) }
  return out.slice(0, 4)
}
