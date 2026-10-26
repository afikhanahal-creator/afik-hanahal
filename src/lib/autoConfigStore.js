// One copy of the automations config (the template library + rules) for the whole admin: the admin loads it, every screen
// that shows templates reads it (the chats, the Lead Center, the lead card — which used to keep its own copy, read once per
// session, so an edit in "אוטומציות" or from the chat didn't reach it until a reload), and any save anywhere publishes the new one.
import { useEffect, useState } from 'react'

let cur = null
const subs = new Set()
export const getSharedAutoConfig = () => cur
export function setSharedAutoConfig(cfg) {
  if (!cfg || cfg === cur) return
  cur = cfg
  for (const f of [...subs]) { try { f(cfg) } catch { /* one screen never stops the others */ } }
}
export function onSharedAutoConfig(fn) { subs.add(fn); return () => subs.delete(fn) }
export function useSharedAutoConfig() {
  const [c, setC] = useState(cur)
  useEffect(() => { setC(cur); return onSharedAutoConfig(setC) }, [])
  return c
}
