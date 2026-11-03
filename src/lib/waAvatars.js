// Profile pictures in the browser: every face on screen asks for its key once — a WhatsApp number, or a Messenger / Instagram
// thread id ('<platform>:<account>:<user>') — the asks are gathered for 120 ms and sent together (POST /api/meta/chat-avatars,
// up to 40 per call). The server answers the WhatsApp picture, else the person's Messenger / Instagram one (with where it came
// from and a profile link). Answers are kept in memory and in this browser (localStorage, until the link expires), so a list
// opened again shows the faces at once.
import { avatarKey, socialKey, avatarExpiry } from '../../lib/wa-avatar.js'

const KEY = 'afik_wa_avatars_v2'
const AUTH = { Authorization: 'Bearer AFIKhanahal2026' }
const mem = new Map()      // key → { u: url | '', s: source, l: profile link, x: valid until (ms) }
const subs = new Map()     // key → Set<fn>
const queue = new Set()
const inflight = new Set()
const retryAt = new Map()  // key → when to ask again after no answer
const refresh = new Set()  // keys whose picture failed to load: the server re-reads them
const refreshed = new Set()
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

function keep(k, u, s = '', l = '', now = Date.now()) {
  const v = { u: u || '', s: u ? s : '', l: u ? l : '', x: u ? Math.min(avatarExpiry(u, now) - 3600e3, now + 3 * 864e5) : now + 864e5 }
  mem.set(k, v)
  subs.get(k)?.forEach(fn => fn(v.u, v))
  return v
}

async function flush() {
  timer = null
  const keys = [...queue].filter(p => !inflight.has(p)).slice(0, 40)
  keys.forEach(p => { queue.delete(p); inflight.add(p) })
  if (queue.size) timer = setTimeout(flush, 200)
  if (!keys.length) return
  const phones = keys.filter(k => !socialKey(k)), social = keys.filter(k => socialKey(k))
  const again = keys.filter(k => refresh.has(k))
  let d = null
  try {
    const r = await fetch('/api/meta/chat-avatars', { method: 'POST', headers: { 'Content-Type': 'application/json', ...AUTH }, body: JSON.stringify({ phones, social, ...(again.length ? { refresh: again } : {}) }), signal: AbortSignal.timeout(25000) })
    d = r.ok ? await r.json().catch(() => null) : null
  } catch {}
  const got = d?.avatars || {}, from = d?.from || {}, links = d?.links || {}
  const now = Date.now()
  for (const k of keys) {
    inflight.delete(k); refresh.delete(k)
    if (k in got) keep(k, got[k] || '', from[k] || '', links[k] || '', now)
    else retryAt.set(k, now + 60e3)   // the server ran out of time for it: ask again in a minute
  }
  persist()
}

/** the picture of a number / thread: '' = none (or not known yet); cb(url, { s: source, l: link }) when it arrives → unsubscribe */
export function getAvatar(raw, cb) {
  const p = avatarKey(raw)
  if (!p) return { url: '', src: '', link: '', off: () => {} }
  const k = known(p)
  if (cb) { if (!subs.has(p)) subs.set(p, new Set()); subs.get(p).add(cb) }
  if (!k && !inflight.has(p) && (retryAt.get(p) || 0) <= Date.now()) {
    queue.add(p)
    if (!timer) timer = setTimeout(flush, 120)
  }
  return { url: k?.u || '', src: k?.s || '', link: k?.l || '', off: () => subs.get(p)?.delete(cb) }
}

/** a picture failed to load (its link expired early): forget it and have the server read it again — once, then wait */
export function avatarBroken(raw) {
  const p = avatarKey(raw)
  if (!p) return
  mem.delete(p); persist()
  if (refreshed.has(p)) { retryAt.set(p, Date.now() + 5 * 60e3); return }
  refreshed.add(p); refresh.add(p); retryAt.delete(p)
}

/** what this browser already knows, without asking ('' when unknown) */
export function peekAvatar(raw) {
  const p = avatarKey(raw)
  return (p && known(p)?.u) || ''
}

/** a picture the screen already has (a thread row's avatar): keep it so the face shows at once and nothing is asked */
export function seedAvatar(raw, url, src = '', link = '') {
  const p = avatarKey(raw)
  if (!p || !/^https:\/\//.test(String(url || '')) || known(p)) return
  const now = Date.now()
  if (avatarExpiry(url, now) - now < 3600e3) return
  keep(p, url, src, link, now); persist()
}
