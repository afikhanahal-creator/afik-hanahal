import { adminToken } from '../adminAuth.js'
// "קשר אחרון בוואטסאפ" for every phone: read once from GET /api/meta/chat-last (the newest message each way, last 90 days —
// public.afik_wa_last), then kept fresh by the live feed (src/lib/waLive.js): every message in or out moves its phone's time at
// once, with no polling. A re-read when the window comes back after 10 minutes catches anything the feed missed.
import { useSyncExternalStore } from 'react'
import { onWaLive } from './waLive.js'
import { applyWaLast } from './waLastFormat.js'

const AUTH = { get Authorization() { return `Bearer ${adminToken()}` } }
const tail9 = p => String(p || '').replace(/\D/g, '').slice(-9)
let map = new Map()          // tail9(phone) → { in, out } (ms, 0 = none)
let snap = { map, loaded: false }
const subs = new Set()
let started = false, lastLoad = 0, loading = false

const emit = (loaded = snap.loaded) => { snap = { map, loaded }; for (const f of [...subs]) { try { f() } catch { /* never stop the others */ } } }

async function load() {
  if (loading || (typeof document !== 'undefined' && document.hidden)) return
  loading = true
  try {
    const r = await fetch('/api/meta/chat-last', { headers: AUTH, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    const d = r.ok ? await r.json().catch(() => null) : null
    if (Array.isArray(d?.last)) {
      const next = new Map()
      for (const x of d.last) {
        const k = tail9(x.phone); if (k.length !== 9) continue
        const cur = next.get(k) || { in: 0, out: 0 }
        next.set(k, { in: Math.max(cur.in, Date.parse(x.in) || 0), out: Math.max(cur.out, Date.parse(x.out) || 0) })
      }
      // what the live feed brought while this was loading stays (a newer time always wins)
      for (const [k, v] of map) { const n = next.get(k) || { in: 0, out: 0 }; next.set(k, { in: Math.max(n.in, v.in || 0), out: Math.max(n.out, v.out || 0) }) }
      map = next; lastLoad = Date.now(); emit(true)
    }
  } catch { /* the next focus tries again */ }
  finally { loading = false }
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  load()
  onWaLive(msgs => { const next = applyWaLast(map, msgs); if (next !== map) { map = next; emit() } })
  const back = () => { if (!document.hidden && Date.now() - lastLoad > 10 * 60e3) load() }
  window.addEventListener('focus', back)
  document.addEventListener('visibilitychange', back)
}

const subscribe = f => { subs.add(f); start(); return () => subs.delete(f) }
/** { map, loaded } — re-renders when a phone's last message changes */
export function useWaLast() { return useSyncExternalStore(subscribe, () => snap, () => snap) }
/** { in, out } of a phone, or null */
export function waLastOf(s, phone) { const k = tail9(phone); return k.length === 9 ? (s.map.get(k) || null) : null }
