// Message alerts in the browser: the office's preferences (sound / desktop notification / in-panel card / leads only), which
// chat is on screen right now (no alert for a message you are already looking at), a short WhatsApp-like sound (different from
// the new-lead chime), the OS notification (one per chat — a newer message replaces it) and the browser tab's badge (the count in
// the title + a red dot on the icon, and the title flashing "name: text" while the window is in the background).
const PREF_KEY = 'afik_wa_notify_v1'
export const NOTIFY_DEFAULTS = { sound: true, desktop: true, toast: true, leadsOnly: false }
const prefSubs = new Set()

export function notifyPrefs() {
  try { return { ...NOTIFY_DEFAULTS, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') } } catch { return { ...NOTIFY_DEFAULTS } }
}
export function setNotifyPrefs(patch) {
  const next = { ...notifyPrefs(), ...patch }
  try { localStorage.setItem(PREF_KEY, JSON.stringify(next)) } catch {}
  prefSubs.forEach(f => { try { f(next) } catch {} })
  return next
}
export function onNotifyPrefs(fn) { prefSubs.add(fn); return () => prefSubs.delete(fn) }

// ── which chat is on screen (the chats tab, the Lead Center, a lead card) ──
const viewing = new Map()   // source → last 9 digits of the phone
const tail9 = p => String(p || '').replace(/\D/g, '').slice(-9)
export function setViewing(source, phone) { if (phone) viewing.set(source, tail9(phone)); else viewing.delete(source) }
/** a chat counts as seen only while the window is visible and focused */
export function isViewing(phone) {
  if (typeof document === 'undefined' || document.hidden || !document.hasFocus()) return false
  const k = tail9(phone)
  for (const v of viewing.values()) if (v === k) return true
  return false
}

// ── sound ──
let ctx = null
export function playMessageSound({ soft = false } = {}) {
  try {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ctx = new C() }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const now = ctx.currentTime
    const notes = soft ? [[740, 0]] : [[620, 0], [930, 0.11]]   // a short "pop-pop", softer when the chat is already open
    for (const [f, at] of notes) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'triangle'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, now + at)
      g.gain.exponentialRampToValueAtTime(soft ? 0.06 : 0.16, now + at + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.18)
      o.connect(g).connect(ctx.destination)
      o.start(now + at); o.stop(now + at + 0.2)
    }
  } catch {}
}
/** the first click anywhere unlocks the audio, so the first alert isn't silent */
if (typeof window !== 'undefined') {
  const unlock = () => { try { if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C() } ctx?.resume?.() } catch {} }
  window.addEventListener('pointerdown', unlock, { once: true, capture: true })
}

/** a task reminder: three rising notes, longer and louder than a message (src/TaskAlerts.jsx) */
export function playReminderSound() {
  try {
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; ctx = new C() }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const now = ctx.currentTime
    for (const [f, at] of [[523, 0], [659, 0.16], [784, 0.32], [1047, 0.5]]) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, now + at)
      g.gain.exponentialRampToValueAtTime(0.22, now + at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.42)
      o.connect(g).connect(ctx.destination)
      o.start(now + at); o.stop(now + at + 0.45)
    }
  } catch {}
}

// ── OS notification ──
export const desktopPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
export async function askDesktopPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  try { return await Notification.requestPermission() } catch { return Notification.permission }
}
export function desktopNotify({ phone, title, body, onClick }) {
  if (desktopPermission() !== 'granted') return null
  try {
    const n = new Notification(title, { body, icon: '/img/icon-192.png', badge: '/img/icon-192.png', tag: `wa-${tail9(phone)}`, renotify: true, dir: 'auto', lang: 'he' })
    n.onclick = () => { try { window.focus() } catch {} onClick?.(); n.close() }
    return n
  } catch { return null }
}

/** a task reminder's OS notification: stays on screen until it is clicked or closed */
export function reminderNotify({ key, title, body, onClick }) {
  if (desktopPermission() !== 'granted') return null
  try {
    const n = new Notification(title, { body, icon: '/img/icon-192.png', badge: '/img/icon-192.png', tag: `task-${key}`, renotify: true, requireInteraction: true, dir: 'auto', lang: 'he' })
    n.onclick = () => { try { window.focus() } catch {} onClick?.(); n.close() }
    return n
  } catch { return null }
}

// ── the browser tab: count in the title, a red dot on the icon, flashing while in the background ──
let baseTitle = null, count = 0, flash = '', flashTimer = null, icons = null, badgeUrl = ''
function drawIcon(n) {
  if (!icons) icons = [...document.querySelectorAll('link[rel~="icon"]')].map(l => [l, l.href])
  if (!icons.length) return
  if (!n) { icons.forEach(([l, href]) => { l.href = href }); return }
  const img = new Image()
  img.onload = () => {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 64
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 64, 64)
      g.fillStyle = '#E5484D'; g.beginPath(); g.arc(44, 20, 19, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#fff'; g.font = 'bold 24px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(n > 9 ? '9+' : String(n), 44, 21)
      badgeUrl = c.toDataURL('image/png')
      if (count) icons.forEach(([l]) => { l.href = badgeUrl })
    } catch {}
  }
  img.src = '/img/icon-192.png'
}
function paint(alt) {
  if (baseTitle === null) baseTitle = document.title
  document.title = alt && flash ? flash : count ? `(${count}) ${baseTitle}` : baseTitle
}
/** one more unseen message; text = "name: message" (flashes in the title while the window is in the background) */
export function bumpTab(text) {
  if (typeof document === 'undefined') return
  if (baseTitle === null) baseTitle = document.title
  count += 1; flash = text ? (/^\p{Extended_Pictographic}/u.test(text) ? text : `💬 ${text}`).slice(0, 60) : ''
  drawIcon(count); paint(false)
  if (!flashTimer && (document.hidden || !document.hasFocus())) {
    let alt = false
    flashTimer = setInterval(() => { alt = !alt; paint(alt) }, 1400)
  }
}
export function clearTab() {
  if (typeof document === 'undefined' || baseTitle === null) return
  count = 0; flash = ''
  if (flashTimer) { clearInterval(flashTimer); flashTimer = null }
  drawIcon(0); document.title = baseTitle
}
if (typeof window !== 'undefined') {
  const back = () => { if (!document.hidden && document.hasFocus()) clearTab() }
  window.addEventListener('focus', back)
  document.addEventListener('visibilitychange', back)
}
