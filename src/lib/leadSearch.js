// Finding a lead by what the office types (2026-11-11 — "when I search a lead's name I want the lead to show up, not to go
// looking for it among the columns"). The old search was a plain `includes` inside the chosen project only: a name typed
// without its space ("אלרועי" for "אל רועי"), a phone typed with dashes, a lead of another project or one sitting in a folded
// column all read as "no such lead". Pure and tested (leadSearch.test.mjs).
//
// A lead matches when EVERY word typed is found in it, in any order; each word may be found in the name (as shown, or as the
// lead typed it in the form — `originalName`), the phone (digits, any format), the email, or the project / campaign / listing.
// How it was found ranks the result: exact name > name starts with > a word starts with > inside the name > the name without
// spaces > the same sound (א = ע, ט = ת, כ = ק, no vowel letters) > one typo. `kind` says which: 'exact' or 'close'.

const NIQQUD = /[֑-ׇ]/g
const FINALS = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' }

/** lowercase, no niqqud / quotes / punctuation, final letters as regular ones, single spaces */
export function normText(s) {
  return String(s ?? '').toLowerCase().replace(NIQQUD, '')
    .replace(/[ךםןףץ]/g, c => FINALS[c])
    .replace(/["'`׳״’‘“”]/g, '')
    .replace(/[^a-z0-9א-ת@.]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}
const squash = s => s.replace(/ /g, '')

/** how a name sounds, roughly: letters that are written either way count as one, vowel letters and doubles are dropped */
export function soundKey(s) {
  return squash(normText(s))
    .replace(/ע/g, 'א').replace(/ט/g, 'ת').replace(/כ/g, 'ק').replace(/ש/g, 'ס').replace(/וו/g, 'ו')
    .replace(/(?!^)[ויהא]/g, '')
    .replace(/ph/g, 'f').replace(/[ck]+/g, 'k').replace(/(?!^)[aeiouyh]/g, '')
    .replace(/(.)\1+/g, '$1')
}

/** a phone as its local digits: +972 52-801 7218 → 0528017218 */
export function phoneDigits(s) {
  let d = String(s ?? '').replace(/\D/g, '')
  if (d.startsWith('00972')) d = d.slice(5)
  else if (d.startsWith('972') && d.length >= 11) d = d.slice(3)
  else return d
  return d.startsWith('0') ? d : '0' + d
}

/** one letter changed, missing, added, or two neighbours swapped */
export function oneTypo(a, b) {
  if (a === b) return true
  const la = a.length, lb = b.length
  if (Math.abs(la - lb) > 1) return false
  let i = 0
  while (i < la && i < lb && a[i] === b[i]) i++
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1)
}

/** what the search reads on a lead (made once per lead per list — see `searchIndex`) */
export function leadFields(lead, extra = '') {
  const crm = lead?.crm_data || {}
  const names = [...new Set([lead?.name, lead?.originalName ?? crm.originalName].map(normText).filter(Boolean))]
  const other = normText([lead?.projectName ?? crm.projectName, lead?.propTitle, lead?.campaign, lead?.metaCampaign, extra].filter(Boolean).join(' '))
  return {
    names,
    words: [...new Set(names.flatMap(n => n.split(' ')))],
    flat: names.map(squash),
    sound: names.map(soundKey),
    wsound: [...new Set(names.flatMap(n => n.split(' ')).map(soundKey))],
    phone: phoneDigits(lead?.phone),
    email: normText(lead?.email),
    other,
  }
}

function tokenScore(tok, f) {
  // a number: the phone, in whatever way it was typed
  if (/^\d+$/.test(tok)) {
    if (tok.length >= 3 && f.phone) {
      const t = phoneDigits(tok)
      if (f.phone === t) return 96
      if (f.phone.includes(t) || f.phone.includes(tok) || (t.length >= 7 && f.phone.endsWith(t.slice(-7)))) return 80
    }
    return f.other.split(' ').includes(tok) ? 50 : f.names.some(n => n.includes(tok)) ? 45 : 0
  }
  let best = 0
  for (const n of f.names) {
    if (n === tok) best = Math.max(best, 100)
    else if (n.startsWith(tok)) best = Math.max(best, 92)
  }
  if (best < 88 && f.words.includes(tok)) best = 88
  if (best < 84 && f.words.some(w => w.startsWith(tok))) best = 84
  if (best < 70 && f.names.some(n => n.includes(tok))) best = 70
  if (best < 64 && tok.length >= 3 && f.flat.some(n => n.includes(tok))) best = 64      // "אלרועי" → "אל רועי"
  if (best < 60 && f.email && f.email.includes(tok)) best = 60
  if (best < 52 && f.other && f.other.includes(tok)) best = 52
  if (best) return best
  // close, not exact: the same sound, then one typo in a word of the name (or in what was typed of it so far)
  if (tok.length >= 3) {
    const k = soundKey(tok)
    if (k.length >= 2 && (f.sound.includes(k) || f.wsound.includes(k) || (k.length >= 4 && f.sound.some(x => x.startsWith(k))))) return 34
  }
  if (tok.length >= 4 && (f.words.some(w => oneTypo(w, tok) || (tok.length >= 5 && w.length > tok.length + 1 && oneTypo(w.slice(0, tok.length), tok))) || f.flat.some(n => oneTypo(n, tok)))) return 26
  return 0
}

/** { score, kind: 'exact' | 'close' } when the lead matches everything typed, else null */
export function matchLead(query, fields) {
  const q = normText(query)
  if (!q) return null
  // a phone typed with spaces / dashes is one number, not three words
  const asPhone = /^[\d\s+()\-.]+$/.test(String(query).trim()) ? String(query).replace(/\D/g, '') : ''
  const toks = asPhone ? [asPhone] : q.split(' ')
  let sum = 0, close = false
  for (const t of toks) {
    const s = tokenScore(t, fields)
    if (!s) { sum = 0; break }
    if (s < 40) close = true
    sum += s
  }
  // the words typed, read as one ("אל רועי" for a lead saved as "אלרועי", and the other way round)
  if (!sum && toks.length > 1 && !asPhone) {
    const one = squash(q)
    if (fields.flat.some(n => n.includes(one))) return { score: 62, kind: 'exact' }
  }
  if (!sum) return null
  return { score: Math.round(sum / toks.length), kind: close ? 'close' : 'exact' }
}

/** the index of a list: [{ lead, f }] — build it once per list (useMemo), search it on every key */
export const searchIndex = (leads, extraOf = null) => (leads || []).map(lead => ({ lead, f: leadFields(lead, extraOf ? extraOf(lead) : '') }))

/**
 * Search the index → { exact: [lead…], close: [lead…], all: [lead…] } — best first; among equals the newest lead first.
 * `close` (same sound / one typo) is filled only when nothing matched exactly, so a clear answer is never diluted.
 */
export function searchLeads(index, query, { max = 0 } = {}) {
  const hits = []
  for (const row of index || []) {
    const m = matchLead(query, row.f)
    if (m) hits.push({ lead: row.lead, ...m })
  }
  const when = l => { const t = Date.parse(l.ts || l.createdAt || l.created_at || ''); return Number.isNaN(t) ? 0 : t }
  const byRank = (a, b) => b.score - a.score || when(b.lead) - when(a.lead)
  const exact = hits.filter(h => h.kind === 'exact').sort(byRank).map(h => h.lead)
  const close = exact.length ? [] : hits.filter(h => h.kind === 'close').sort(byRank).map(h => h.lead)
  const cut = l => (max ? l.slice(0, max) : l)
  return { exact: cut(exact), close: cut(close), all: cut(exact.length ? exact : close) }
}
