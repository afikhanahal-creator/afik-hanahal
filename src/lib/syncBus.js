// The admin's change bus: instead of asking the server every minute "did anything change?", the database announces every
// change itself. Triggers on contacts / meta_leads / seller_submissions (server/sync-bus-migration.sql) send a Supabase
// Realtime broadcast on the public channel 'afik-sync' with the table and the row id only (never a name, phone or note), and
// every open admin screen, on any device, fetches just that change. Nothing is polled while the bus is up; a screen whose bus is
// down falls back to a slow check (busUp() tells which).
import { supabase } from './supabaseClient'

const subs = new Set()
let channel = null
let up = false

/** fn({ t: 'contacts' | 'meta_leads' | 'seller_submissions' | '*', id, op, reconnect? }) → unsubscribe */
export function onSync(fn) {
  subs.add(fn)
  start()
  return () => subs.delete(fn)
}
export const busUp = () => up

function emit(msg) { for (const f of [...subs]) { try { f(msg) } catch { /* one screen's error never stops the others */ } } }

function start() {
  if (channel || !supabase) return
  channel = supabase.channel('afik-sync')
    .on('broadcast', { event: 'change' }, ({ payload }) => { if (payload?.t) emit(payload) })
    .subscribe(status => {
      const was = up
      up = status === 'SUBSCRIBED'
      // back after a drop (sleep, network): whatever changed meanwhile is fetched once
      if (up && !was) emit({ t: '*', reconnect: true })
    })
}

/** Calls fn at most once per `ms`, after the burst settles (a bulk update sends one event per row) */
export function debounce(fn, ms = 700) {
  let t = null
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) }
}
