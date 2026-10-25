// WhatsApp, live: Green API delivers every message and status to /api/meta/green-hook (server/wa-messages-migration.sql); the
// insert is announced on the change bus (src/lib/syncBus.js — the table and the message id only), and this module fetches
// just what is new (GET /api/meta/chat-updates?since=<cursor>) and hands it to every open chat: the chats tab, the Lead
// Center, the lead card, the admin's toasts. A lead's reply shows in about a second, with no polling; the chats keep a slow
// check only while the bus is down (waLiveUp()).
import { onSync, busUp, debounce } from './syncBus.js'

const AUTH = { Authorization: 'Bearer AFIKhanahal2026' }
const subs = new Set()
let cursor = new Date(Date.now() - 2 * 60e3).toISOString()
let started = false, inflight = false, again = false

/** fn(messages) — each = Green's history shape ({ idMessage, type: 'incoming' | 'outgoing', typeMessage, textMessage | caption,
 *  timestamp, statusMessage … }) + phone (972…) — → unsubscribe */
export function onWaLive(fn) {
  subs.add(fn)
  start()
  return () => subs.delete(fn)
}
export const waLiveUp = () => busUp()
export { mergeLive, tail9 } from './waMerge.js'

async function pull() {
  if (inflight) { again = true; return }
  inflight = true
  try {
    const r = await fetch(`/api/meta/chat-updates?since=${encodeURIComponent(cursor)}`, { headers: AUTH, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    const d = r.ok ? await r.json().catch(() => null) : null
    if (d?.cursor) cursor = d.cursor
    if (d?.messages?.length) for (const f of [...subs]) { try { f(d.messages) } catch { /* one screen never stops the others */ } }
  } catch { /* the next announcement tries again */ }
  finally {
    inflight = false
    if (again) { again = false; pull() }
  }
}

function start() {
  if (started) return
  started = true
  const go = debounce(pull, 200)
  // a new message / status, or the bus coming back after a drop (whatever arrived meanwhile)
  onSync(m => { if (m.t === 'wa_messages' || m.t === '*') go() })
}

