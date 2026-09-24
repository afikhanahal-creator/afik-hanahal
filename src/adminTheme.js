// Admin-only appearance: dark · light · system. Independent of the public site's theme and saved per browser.
// Colors are CSS variables so every admin component (and portals: dialogs, popovers, toasts) switches at once.
import { useSyncExternalStore, useCallback } from 'react'

const KEY = 'afik_admin_theme'
const listeners = new Set()
const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null

function readPref() {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark' } catch { return 'dark' }
}
let pref = typeof window !== 'undefined' ? readPref() : 'dark'
const resolve = p => (p === 'system' ? (mq?.matches ? 'light' : 'dark') : p)
let resolved = resolve(pref)

function apply() {
  resolved = resolve(pref)
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-admin-theme', resolved)
  listeners.forEach(l => l())
}
if (typeof window !== 'undefined') {
  apply()
  mq?.addEventListener?.('change', () => { if (pref === 'system') apply() })
  window.addEventListener('storage', e => { if (e.key === KEY) { pref = readPref(); apply() } })
}

export function setAdminThemePref(p) {
  pref = p
  try { localStorage.setItem(KEY, p) } catch {}
  apply()
}
const subscribe = l => { listeners.add(l); return () => listeners.delete(l) }
const snap = () => `${pref}|${resolved}`

export function useAdminTheme() {
  const s = useSyncExternalStore(subscribe, snap, () => 'dark|dark')
  const [p, r] = s.split('|')
  const toggle = useCallback(() => setAdminThemePref(r === 'dark' ? 'light' : 'dark'), [r])
  return { pref: p, theme: r, isDark: r === 'dark', setPref: setAdminThemePref, toggle }
}

// Theme-context colors (`C`) for the admin. Dark = the site's dark palette; light = a cool, crisp office palette.
export const ADMIN_DARK_C  = { bg: '#09090F', purple: '#6F7AC7', green: '#82F67F', cream: '#E8E4D8', card: '#0E0E1C' }
export const ADMIN_LIGHT_C = { bg: '#F4F5F9', purple: '#3F49A6', green: '#15803D', cream: '#171A2C', card: '#FFFFFF' }

// --ink / --ov are "r,g,b" triplets for rgba(var(--ink), a) — text tints and surface overlays.
export const ADMIN_THEME_CSS = `
:root, html[data-admin-theme="dark"] {
  color-scheme: dark;
  --ink: 232,228,216; --ov: 255,255,255; --shade: 0,0,0; --brand-rgb: 111,122,199; --au-brand: #5A64B6; --au-brand-deep: #464F9E;
  --au-bg: #09090F; --au-page: #07070F; --au-sidebar: linear-gradient(180deg,#0D0E1A 0%,#08080F 100%); --au-topbar: rgba(9,9,17,.86);
  --au-card: rgba(255,255,255,.03); --au-card-grad: linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.015)); --au-card-shadow: none;
  --au-s1: rgba(255,255,255,.03); --au-s1-line: rgba(var(--brand-rgb),.14);
  --au-s2: #10121E; --au-s2-line: rgba(var(--brand-rgb),.25);
  --au-s3: rgba(255,255,255,.04); --au-s3-line: rgba(var(--brand-rgb),.22);
  --au-line: rgba(var(--brand-rgb),.14); --au-line2: rgba(var(--brand-rgb),.25); --au-divider: rgba(var(--brand-rgb),.08);
  --au-text: #E8E4D8; --au-text2: rgba(232,228,216,.72); --au-text3: rgba(232,228,216,.6); --au-text-dis: rgba(232,228,216,.35);
  --au-brand-soft: rgba(var(--brand-rgb),.16); --au-brand-text: #AAB3EE; --au-amber-text: #F5C26B; --au-red-text: #F08A8A; --au-green-text: #4ADE80;
  --au-pop: #10121E; --au-tooltip: #141627; --au-overlay: rgba(0,0,0,.6);
  --au-shadow2: 0 24px 70px rgba(0,0,0,.6); --au-shadow3: 0 12px 32px rgba(0,0,0,.45);
  --au-skel: rgba(255,255,255,.06); --au-skel-hi: rgba(255,255,255,.1);
  --au-seg-active: rgba(var(--brand-rgb),.22);
  --au-sticky: rgba(9,9,15,.94); --au-input: rgba(0,0,0,.25); --au-card-solid: #0E0E1C; --au-pane: #0C0E18;
  --mk-bg: #0D1117; --mk-card: #1A2235; --mk-card-hov: #212D42; --mk-surf: #131B2A; --mk-surf-hov: #1E2840; --mk-border: #2A3347; --mk-border-l: #1E2A3A; --mk-text: #E2E8F8; --mk-sub: #8B98BC; --mk-dim: #4A5568; --mk-popup: #0F1825;
}
html[data-admin-theme="light"] {
  color-scheme: light;
  --ink: 23,26,44; --ov: 28,36,90; --shade: 20,24,60; --brand-rgb: 63,73,166; --au-brand: #3F49A6; --au-brand-deep: #333B8C;
  --au-bg: #F4F5F9; --au-page: #F4F5F9; --au-sidebar: #FFFFFF; --au-topbar: rgba(255,255,255,.88);
  --au-card: #FFFFFF; --au-card-grad: #FFFFFF; --au-card-shadow: 0 1px 2px rgba(20,24,60,.05), 0 2px 8px rgba(20,24,60,.04);
  --au-s1: #FFFFFF; --au-s1-line: rgba(28,36,90,.1);
  --au-s2: #FFFFFF; --au-s2-line: rgba(28,36,90,.16);
  --au-s3: #F5F6FA; --au-s3-line: rgba(28,36,90,.16);
  --au-line: rgba(28,36,90,.1); --au-line2: rgba(28,36,90,.18); --au-divider: rgba(28,36,90,.07);
  --au-text: #171A2C; --au-text2: rgba(23,26,44,.74); --au-text3: rgba(23,26,44,.58); --au-text-dis: rgba(23,26,44,.36);
  --au-brand-soft: rgba(63,73,166,.1); --au-brand-text: #343C92; --au-amber-text: #9A5B00; --au-red-text: #C0392B; --au-green-text: #15803D;
  --au-pop: #FFFFFF; --au-tooltip: #FFFFFF; --au-overlay: rgba(20,24,60,.32);
  --au-shadow2: 0 24px 60px rgba(20,24,60,.18); --au-shadow3: 0 12px 32px rgba(20,24,60,.14);
  --au-skel: rgba(28,36,90,.06); --au-skel-hi: rgba(28,36,90,.11);
  --au-seg-active: #FFFFFF;
  --au-sticky: rgba(244,245,249,.94); --au-input: #FFFFFF; --au-card-solid: #FFFFFF; --au-pane: #EEF0F6;
  --mk-bg: #F4F5F9; --mk-card: #FFFFFF; --mk-card-hov: #F7F8FC; --mk-surf: #EEF0F6; --mk-surf-hov: #E6E9F2; --mk-border: #DDE1EC; --mk-border-l: #E8EBF3; --mk-text: #171A2C; --mk-sub: #5B6380; --mk-dim: #9AA1B8; --mk-popup: #FFFFFF;
}
html[data-admin-theme] .admin-shell { transition: background-color .25s ease, color .25s ease; }
/* Board cards: focus ring for keyboard users only */
.lb-card:focus:not(:focus-visible) { outline: none; }
.lb-card:focus-visible { outline: 2px solid var(--au-brand); outline-offset: 2px; }
@keyframes au-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
.admin-cmdk-btn:hover { border-color: rgba(var(--brand-rgb),.45) !important; color: var(--au-text2) !important; }
@media (max-width: 1250px) { .admin-cmdk-btn { min-width: 0 !important; } .admin-cmdk-btn span, .admin-cmdk-btn kbd { display: none; } }
@media (prefers-reduced-motion: reduce) { html[data-admin-theme] .admin-shell { transition: none; } }
`
