// "ממתינים לתשובה": every chat whose last word is the lead's. Read once from GET /api/meta/chat-waiting
// (public.afik_wa_waiting(), server/wa-waiting-migration.sql), then kept fresh by the live feed (src/lib/waLive.js): a message that
// comes in marks the chat, one we send clears it — the board, the Lead Center and the sidebar show it within a second, no polling.
// A slow re-read when the window comes back after a minute or more catches anything the feed missed.
import { useSyncExternalStore } from 'react'
import { onWaLive } from './waLive.js'
import { tail9 } from './waMerge.js'
import { applyWaiting } from './waInbox.js'
import { isHandled, withHandled, withoutHandled } from '../../lib/wa-actions.js'

const AUTH = { Authorization: 'Bearer AFIKhanahal2026' }
let map = new Map()          // tail9(phone) → { phone, ts (ms), text, type }
let done = {}                // chats marked handled: tail9 → the lead's last message time (ms) — lib/wa-actions.js
let snap = { map, count: 0, done }
const subs = new Set()
let started = false, lastLoad = 0, loading = false

const dropHandled = m => { let n = m; for (const [k, v] of m) if (isHandled(done, k, v.ts)) { if (n === m) n = new Map(m); n.delete(k) } return n }
const emit = () => { snap = { map, count: map.size, done }; for (const f of [...subs]) { try { f() } catch { /* never stop the others */ } } }

async function load() {
  if (loading || document.hidden) return
  loading = true
  try {
    const r = await fetch('/api/meta/chat-waiting', { headers: AUTH, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    const d = r.ok ? await r.json().catch(() => null) : null
    if (Array.isArray(d?.waiting)) {
      if (d.done && typeof d.done === 'object') done = d.done
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
  onWaLive(msgs => { const next = dropHandled(applyWaiting(map, msgs)); if (next !== map) { map = next; emit() } })
  const back = () => { if (!document.hidden && Date.now() - lastLoad > 60e3) load() }
  window.addEventListener('focus', back)
  document.addEventListener('visibilitychange', back)
}

const subscribe = f => { subs.add(f); startWaiting(); return () => subs.delete(f) }
/** { map, count } — re-renders when a chat starts / stops waiting */
export function useWaiting() { return useSyncExternalStore(subscribe, () => snap, () => snap) }
/** The waiting entry of a phone, or null */
export function waitingOf(w, phone) { const k = tail9(phone); return k.length === 9 ? (w.map.get(k) || null) : null }

/** Take chats off "ממתינים לתשובה" — [{ phone, ts }] (ts = the lead's last message). At once on every screen, then saved
 *  for everyone; they come back by themselves when the lead writes again. → Promise<boolean> */
export async function markHandled(items = []) {
  const list = items.filter(x => x?.phone && x.ts)
  if (!list.length) return true
  const prevDone = done, prevMap = map
  done = withHandled(done, list); map = dropHandled(map); emit()
  try {
    const r = await fetch('/api/meta/chat-waiting-done', { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json' }, body: JSON.stringify({ items: list }), signal: AbortSignal.timeout(15000) })
    const d = r.ok ? await r.json().catch(() => null) : null
    if (!d?.ok) throw new Error('save failed')
    done = d.done || done; emit(); return true
  } catch { done = prevDone; map = prevMap; emit(); return false }
}
/** Undo: back on the list */
export async function unmarkHandled(phones = []) {
  done = withoutHandled(done, phones); emit()
  try {
    await fetch('/api/meta/chat-waiting-done', { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json' }, body: JSON.stringify({ undo: phones }), signal: AbortSignal.timeout(15000) })
  } catch { /* the next read decides */ }
  lastLoad = 0; load()
  return true
}
/** Was the chat's current waiting message marked handled? (the chats tab computes waiting from its own messages) */
export const handledAt = (w, phone, ts) => isHandled(w.done, phone, ts)
