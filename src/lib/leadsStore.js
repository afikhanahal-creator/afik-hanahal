// The admin's lead list, published for screens that aren't handed it as a prop (the Lead Center / lead card conversation's
// forward window lists every lead to forward a message to). The admin keeps it fresh (change bus); readers only read.
import { useEffect, useState } from 'react'

let cur = []
const subs = new Set()
export function setSharedLeads(list) {
  if (!Array.isArray(list) || list === cur) return
  cur = list
  for (const f of [...subs]) { try { f(list) } catch { /* one screen never stops the others */ } }
}
export function useSharedLeads() {
  const [l, setL] = useState(cur)
  useEffect(() => { setL(cur); subs.add(setL); return () => subs.delete(setL) }, [])
  return l
}
