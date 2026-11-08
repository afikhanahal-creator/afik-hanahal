// The admin's property list, published for screens that aren't handed it (the chat's photo gallery in the chats tab, the Lead
// Center, the lead card and the inbox). The admin keeps it fresh; a screen opened before the admin had it reads the site's own
// published list once (/api/properties — the table / snapshot, never Render).
import { useEffect, useState } from 'react'

let cur = []
let fetched = null
const subs = new Set()
const emit = list => { for (const f of [...subs]) { try { f(list) } catch { /* one screen never stops the others */ } } }
export function setSharedProperties(list) {
  if (!Array.isArray(list) || list === cur || !list.length) return
  cur = list
  emit(list)
}
export function useSharedProperties(active = true) {
  const [l, setL] = useState(cur)
  useEffect(() => { setL(cur); subs.add(setL); return () => subs.delete(setL) }, [])
  useEffect(() => {
    if (!active || cur.length || fetched) return
    fetched = fetch('/api/properties', { signal: AbortSignal.timeout(15000) }).then(r => (r.ok ? r.json() : [])).then(d => {
      const list = Array.isArray(d) ? d : Array.isArray(d?.properties) ? d.properties : []
      if (!cur.length && list.length) { cur = list; emit(list) }
    }).catch(() => { fetched = null })
  }, [active])
  return l
}
