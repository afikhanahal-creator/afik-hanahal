// Which build is running, and is there a newer one? (2026-11-10 — after a deploy, a tab left open or a page the browser
// restored from memory kept the old version: the old screen showed, then a screen whose file no longer exists failed, the
// page reloaded and "jumped". Now the admin notices a newer build itself and switches to it at a quiet moment.)
// The build is named by its main script, /assets/index-<hash>.js — every deploy has another one.

const MAIN = /\/assets\/index-[\w-]+\.js/

/** the main script of an HTML page ('' if none) */
export const buildOf = html => (String(html || '').match(MAIN) || [''])[0]

/** the build this page is running ('' outside the browser or in dev) */
export function runningBuild(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return ''
  for (const s of doc.querySelectorAll('script[src]')) { const m = String(s.getAttribute('src') || '').match(MAIN); if (m) return m[0] }
  return ''
}

/** a reload at most once a minute: a broken deploy must never reload in a loop (the old guard allowed one per session, so
 *  the second stale screen of the day stayed broken) */
const RELOAD_KEY = 'afik_reload_at'
export function canReload(now = Date.now(), store = safeSession()) {
  const last = Number(store?.getItem(RELOAD_KEY) || 0)
  return !last || now - last > 60e3
}
export function reloadOnce(reason = '', now = Date.now(), store = safeSession(), loc = typeof location !== 'undefined' ? location : null) {
  if (!canReload(now, store)) return false
  try { store?.setItem(RELOAD_KEY, String(now)); store?.setItem('afik_reload_why', String(reason).slice(0, 60)) } catch { /* private mode */ }
  loc?.reload()
  return true
}
function safeSession() { try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null } catch { return null } }

/** is the person in the middle of something? (typing in a field, a window open) — then wait */
export function busyNow(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return false
  const a = doc.activeElement
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return true
  return !!doc.querySelector('[role="dialog"][aria-modal="true"]')
}

/** ask the server which build is live (the HTML is never cached: no-store) */
export async function liveBuild(path = '/admin-panel') {
  const r = await fetch(`${path}?_v=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin', headers: { accept: 'text/html' } })
  if (!r.ok) return ''
  return buildOf(await r.text())
}

/**
 * Watch for a newer build: when the page comes back to the screen (after ≥ 15 s away, or from the back-forward cache), when it is
 * back online, and every 10 minutes. A newer build reloads at once when the page was just shown again (nothing is being done
 * yet) or the person isn't busy; otherwise it waits for the next quiet moment. `onStale(build)` lets the screen say so.
 */
export function watchBuild({ onStale = null, every = 10 * 60e3 } = {}) {
  const mine = runningBuild()
  if (!mine || typeof window === 'undefined') return () => {}
  let stale = '', hiddenAt = 0, timer = 0, checking = false
  const check = async (justShown = false) => {
    if (checking) return
    checking = true
    try {
      const live = stale || await liveBuild().catch(() => '')
      if (!live || live === mine) return
      stale = live
      if (justShown || !busyNow()) { if (reloadOnce('build')) return }
      onStale?.(live)
    } finally { checking = false }
  }
  const vis = () => {
    if (document.hidden) { hiddenAt = Date.now(); return }
    const away = hiddenAt ? Date.now() - hiddenAt : 0
    hiddenAt = 0
    if (away >= 15e3 || stale) check(true)
  }
  const show = e => { if (e.persisted) check(true) }
  const online = () => check(false)
  // a quiet moment for a newer build that was waiting: the focus left the field / the window closed
  const idle = () => { if (stale && !busyNow()) setTimeout(() => { if (stale && !busyNow()) reloadOnce('build') }, 400) }
  document.addEventListener('visibilitychange', vis)
  window.addEventListener('pageshow', show)
  window.addEventListener('online', online)
  document.addEventListener('focusout', idle)
  timer = setInterval(() => { if (!document.hidden) check(false) }, every)
  const first = setTimeout(() => check(false), 4000)
  return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pageshow', show); window.removeEventListener('online', online); document.removeEventListener('focusout', idle); clearInterval(timer); clearTimeout(first) }
}
