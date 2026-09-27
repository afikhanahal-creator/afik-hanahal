// Tell the site that properties changed, so the public snapshot and the instant landing pages
// (/p/<id>) follow right away — see lib/site-rebuild.js. Batched: one call 15 s after the last change,
// so a burst of edits costs one rebuild; a pending call is still sent if the admin closes the tab.
let timer = null
let pendingToken = null

// The admin panel's copy of the property list, offered to the server as the public snapshot. The server keeps
// it only when Render can't answer for itself (suspended / down) — so even then the site, the shared links
// and the next deploy have every property. Sent at most once per list per session.
let lastPushed = ''
export async function pushSnapshot(list, token) {
  if (!token || !Array.isArray(list) || !list.length) return null
  const pub = list.filter(p => p && p.id != null && p.published !== false)
  const sig = pub.map(p => `${p.id}:${p.updatedAt || ''}`).join(',')
  if (!pub.length || sig === lastPushed) return null
  lastPushed = sig
  try {
    const r = await fetch('/api/properties?snapshot=1', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ list: pub }) })
    return await r.json().catch(() => null)
  } catch { return null }
}

async function send(token) {
  pendingToken = null
  try {
    const r = await fetch('/api/properties?changed=1', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json().catch(() => null)
    if (d && d.rebuild === 'throttled' && d.retryInMs) notifyPropertiesChanged(token, d.retryInMs + 2000)
  } catch {}
}

export function notifyPropertiesChanged(token, delay = 15000) {
  if (!token) return
  clearTimeout(timer)
  pendingToken = token
  timer = setTimeout(() => send(token), delay)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    if (!pendingToken || !navigator.sendBeacon) return
    clearTimeout(timer)
    navigator.sendBeacon(`/api/properties?changed=1&key=${encodeURIComponent(pendingToken)}`)
    pendingToken = null
  })
}
