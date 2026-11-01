// "ממתינים לתשובה": every chat whose last word is the lead's. Read once from GET /api/meta/chat-waiting
// (public.afik_wa_waiting(), server/wa-waiting-migration.sql), then kept fresh by the live feed (src/lib/waLive.js): a message that
// comes in marks the chat, one we send clears it — the board, the Lead Center and the sidebar show it within a second, no polling.
// A slow re-read when the window comes back after a minute or more catches anything the feed missed.
import { useSyncExternalStore } from 'react'
import { onWaLive } from './waLive.js'
import { tail9 } from './waMerge.js'
import { applyWaiting } from './waInbox.js'

const AUTH = { Authorization: 'Bearer AFIKhanahal2026' }
let map = new Map()          // tail9(phone) → { phone, ts (ms), text, type }
let snap = { map, count: 0 }
const subs = new Set()
let started = false, lastLoad = 0, loading = false

const emit = () => { snap = { map, count: map.size }; for (const f of [...subs]) { try { f() } catch { /* never stop the others */ } } }

async function load() {
  if (loading || document.hidden) return
  loading = true
  try {
    const r = await fetch('/api/meta/chat-waiting', { headers: AUTH, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    const d = r.ok ? await r.json().catch(() => null) : null
    if (Array.isArray(d?.waiting)) {
      map = new Map(d.waiting.map(w => [tail9(w.phone), { phone: w.phone, ts: Date.parse(w.ts) || 0, text: w.text || '', type: w.type || '' }]))
      lastLoad = Date.now()
      emit()
    }
  } catch { /* the next focus tries again */ }
  finally { loading = false }
}

export function startWaiting() {
  if (started || typeof window === 'undefined') return
  started = true
  load()
  onWaLive(msgs => { const next = applyWaiting(map, msgs); if (next !== map) { map = next; emit() } })
  const back = () => { if (!document.hidden && Date.now() - lastLoad > 60e3) load() }
  window.addEventListener('focus', back)
  document.addEventListener('visibilitychange', back)
}

const subscribe = f => { subs.add(f); startWaiting(); return () => subs.delete(f) }
/** { map, count } — re-renders when a chat starts / stops waiting */
export function useWaiting() { return useSyncExternalStore(subscribe, () => snap, () => snap) }
/** The waiting entry of a phone, or null */
export function waitingOf(w, phone) { const k = tail9(phone); return k.length === 9 ? (w.map.get(k) || null) : null }
