// WhatsApp profile pictures in the browser: every face on screen asks for its number once; the asks are gathered for 120 ms and
// sent together (POST /api/meta/chat-avatars, up to 40 per call — the server keeps them in wa_avatars). Answers are kept in
// memory and in this browser (localStorage, until WhatsApp's link expires), so a chat list opened again shows the faces at once.
import { avatarPhone, avatarExpiry } from '../../lib/wa-avatar.js'

const KEY = 'afik_wa_avatars_v1'
const AUTH = { Authorization: 'Bearer AFIKhanahal2026' }
const mem = new Map()      // phone → { u: url | '', x: valid until (ms) }
const subs = new Map()     // phone → Set<fn>
const queue = new Set()
const inflight = new Set()
const retryAt = new Map()  // phone → when to ask again after no answer
let timer = null

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
  const now = Date.now()
  for (const [p, v] of Object.entries(saved)) if (v && v.x > now) mem.set(p, v)
} catch {}
function persist() {
  try {
    const out = {}
    const now = Date.now()
    for (const [p, v] of mem) if (v.x > now) out[p] = v
    localStorage.setItem(KEY, JSON.stringify(out))
  } catch {}
}

function known(p) {
  const v = mem.get(p)
  if (v && v.x > Date.now()) return v
  return null
}

async function flush() {
  timer = null
  const phones = [...queue].filter(p => !inflight.has(p)).slice(0, 40)
  phones.forEach(p => { queue.delete(p); inflight.add(p) })
  if (queue.size) timer = setTimeout(flush, 200)
  if (!phones.length) return
  let got = {}
  try {
    const r = await fetch('/api/meta/chat-avatars', { method: 'POST', headers: { 'Content-Type': 'application/json', ...AUTH }, body: JSON.stringify({ phones }), signal: AbortSignal.timeout(25000) })
    got = r.ok ? ((await r.json().catch(() => null))?.avatars || {}) : {}
  } catch {}
  const now = Date.now()
  for (const p of phones) {
    inflight.delete(p)
    if (p in got) {
      const u = got[p] || ''
      mem.set(p, { u, x: u ? Math.min(avatarExpiry(u, now) - 3600e3, now + 3 * 864e5) : now + 864e5 })
      subs.get(p)?.forEach(fn => fn(u))
    } else retryAt.set(p, now + 60e3)   // the server ran out of time for it: ask again in a minute
  }
  persist()
}

/** the picture of a number: '' = none (or not known yet); cb gets it when it arrives → unsubscribe */
export function getAvatar(raw, cb) {
  const p = avatarPhone(raw)
  if (!p) return { url: '', off: () => {} }
  const k = known(p)
  if (cb) { if (!subs.has(p)) subs.set(p, new Set()); subs.get(p).add(cb) }
  if (!k && !inflight.has(p) && (retryAt.get(p) || 0) <= Date.now()) {
    queue.add(p)
    if (!timer) timer = setTimeout(flush, 120)
  }
  return { url: k?.u || '', off: () => subs.get(p)?.delete(cb) }
}

/** a picture failed to load (WhatsApp's link expired early): forget it and ask again */
export function avatarBroken(raw) {
  const p = avatarPhone(raw)
  if (!p) return
  mem.delete(p); persist()
  retryAt.set(p, Date.now() + 5 * 60e3)
}

/** what this browser already knows, without asking ('' when unknown) */
export function peekAvatar(raw) {
  const p = avatarPhone(raw)
  return (p && known(p)?.u) || ''
}
