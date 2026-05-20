import { useState, useEffect, useRef, useCallback } from 'react'

// ── Big cursor SVG (base64) ────────────────────────────────────────────────────
const _CSV = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M10 4l26 16-14 3-3 19z" fill="#000" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>`
const _CUR = `url("data:image/svg+xml;base64,${btoa(_CSV)}") 10 4, auto`

// ── Global CSS (injected once, outside React tree) ─────────────────────────────
const A11Y_CSS = `
/* ═══ Skip link ════════════════════════════════════════════════════════════ */
.a11y-skip {
  position:fixed; top:-100px; right:50%; transform:translateX(50%);
  background:var(--c-bg,#0A0A0A); color:var(--c-cream,#fff);
  padding:14px 28px; font-weight:700; font-size:16px;
  text-decoration:none; z-index:999999;
  border-radius:0 0 12px 12px; transition:top .15s;
  direction:rtl; font-family:inherit; white-space:nowrap;
  border-bottom:2px solid var(--c-purple,#8490D8);
}
.a11y-skip:focus { top:0 !important; outline:3px solid #FFD700; outline-offset:2px; }

/* ═══ Text size ═════════════════════════════════════════════════════════════ */
.a11y-t1 { font-size: 110% !important; }
.a11y-t2 { font-size: 120% !important; }
.a11y-t3 { font-size: 130% !important; }
.a11y-t4 { font-size: 150% !important; }

/* ═══ Contrast ══════════════════════════════════════════════════════════════ */
.a11y-hi body { background-color:#000!important; color:#fff!important; }
.a11y-hi *    { border-color:#555!important; }
.a11y-hi a    { color:#FFD700!important; }
.a11y-hi button { background:#222!important; color:#fff!important; }
.a11y-inv     { filter: invert(1) hue-rotate(180deg); }
.a11y-bw      { filter: grayscale(1); }

/* ═══ Links ═════════════════════════════════════════════════════════════════ */
.a11y-lnk a {
  text-decoration: underline !important;
  text-decoration-thickness: 2.5px !important;
  text-underline-offset: 4px !important;
  text-decoration-color: var(--c-purple,#8490D8) !important;
  outline: 1px dashed color-mix(in srgb,var(--c-purple,#8490D8) 30%,transparent);
  outline-offset: 2px;
}

/* ═══ Highlight headings ════════════════════════════════════════════════════ */
.a11y-hdg h1, .a11y-hdg h2, .a11y-hdg h3,
.a11y-hdg h4, .a11y-hdg h5, .a11y-hdg h6 {
  outline: 2px solid var(--c-purple,#8490D8) !important;
  outline-offset: 3px !important;
  background: color-mix(in srgb,var(--c-purple,#8490D8) 8%,transparent) !important;
  border-radius: 4px !important;
}

/* ═══ Readable font ═════════════════════════════════════════════════════════ */
.a11y-font, .a11y-font * {
  font-family: Arial, Helvetica, "Liberation Sans", sans-serif !important;
}

/* ═══ Text spacing ══════════════════════════════════════════════════════════ */
.a11y-spc p, .a11y-spc h1, .a11y-spc h2, .a11y-spc h3,
.a11y-spc h4, .a11y-spc h5, .a11y-spc span, .a11y-spc div,
.a11y-spc li, .a11y-spc td, .a11y-spc th, .a11y-spc label {
  line-height: 1.9 !important;
  letter-spacing: 0.06em !important;
  word-spacing: 0.14em !important;
}

/* ═══ No animations ═════════════════════════════════════════════════════════ */
.a11y-noanim *,
.a11y-noanim *::before,
.a11y-noanim *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}

/* ═══ Focus highlight ═══════════════════════════════════════════════════════ */
.a11y-foc *:focus,
.a11y-foc *:focus-visible {
  outline: 3px solid var(--c-purple,#8490D8) !important;
  outline-offset: 3px !important;
  box-shadow: 0 0 0 6px color-mix(in srgb,var(--c-purple,#8490D8) 22%,transparent) !important;
}

/* ═══ Big cursor ════════════════════════════════════════════════════════════ */
.a11y-cur, .a11y-cur * { cursor: ${_CUR} !important; }

/* ═══ Reading mask ══════════════════════════════════════════════════════════ */
#a11y-rmask {
  position: fixed; left: 0; right: 0; height: 60px;
  background: color-mix(in srgb,var(--c-purple,#8490D8) 7%,transparent);
  border-top: 2px solid color-mix(in srgb,var(--c-purple,#8490D8) 45%,transparent);
  border-bottom: 2px solid color-mix(in srgb,var(--c-purple,#8490D8) 45%,transparent);
  pointer-events: none; z-index: 999990;
  transform: translateY(-50%);
  display: none;
}
.a11y-msk #a11y-rmask { display: block; }

/* ═══ Trigger button ════════════════════════════════════════════════════════ */
#a11y-btn {
  position: fixed;
  bottom: 76px; right: 22px;
  width: 50px; height: 50px;
  border-radius: 50%;
  background: var(--c-purple,#8490D8);
  border: 2.5px solid color-mix(in srgb,var(--c-purple,#8490D8) 60%,#fff);
  box-shadow: 0 4px 18px color-mix(in srgb,var(--c-purple,#8490D8) 50%,transparent), 0 2px 6px rgba(0,0,0,.35);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 999993;
  color: #fff;
  opacity: 1;
  transition: transform .25s cubic-bezier(.2,.8,.4,1), box-shadow .22s, background .22s, border-color .22s;
}
#a11y-btn:hover {
  background: color-mix(in srgb,var(--c-purple,#8490D8) 80%,#fff);
  border-color: #fff;
  transform: scale(1.1) translateY(-2px);
  box-shadow: 0 6px 24px color-mix(in srgb,var(--c-purple,#8490D8) 60%,transparent), 0 3px 10px rgba(0,0,0,.4);
}
#a11y-btn:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
#a11y-btn:active { transform: scale(.92); }
@media(max-width:768px) {
  #a11y-btn { bottom: 70px; right: 16px; width: 46px; height: 46px; }
}

/* Counter-invert: keep widget readable when page is inverted */
.a11y-inv #a11y-panel { filter: invert(1) hue-rotate(180deg); }
.a11y-inv #a11y-btn   { filter: invert(1) hue-rotate(180deg); }

/* ═══ Overlay ═══════════════════════════════════════════════════════════════ */
#a11y-ovl {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.52);
  backdrop-filter: blur(3px);
  z-index: 999994;
  animation: a11yFadeIn .22s ease;
}
@keyframes a11yFadeIn { from{opacity:0} to{opacity:1} }

/* ═══ Panel ═════════════════════════════════════════════════════════════════ */
#a11y-panel {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: min(360px, 94vw);
  background: var(--c-bg,#09090F);
  color: var(--c-cream,#E8E4D8);
  z-index: 999995;
  direction: rtl;
  display: flex; flex-direction: column;
  box-shadow: -4px 0 48px rgba(0,0,0,.45);
  border-left: 1px solid color-mix(in srgb,var(--c-purple,#8490D8) 22%,transparent);
  animation: a11ySlideIn .3s cubic-bezier(.16,1,.3,1);
  overflow: hidden;
}
@keyframes a11ySlideIn {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

/* Panel header */
#a11y-hdr {
  background: var(--c-card,#0E0E1C);
  color: var(--c-cream,#E8E4D8);
  padding: 18px 20px;
  display: flex; align-items: center; gap: 13px; flex-shrink: 0;
  border-bottom: 1.5px solid color-mix(in srgb,var(--c-purple,#8490D8) 32%,transparent);
}
#a11y-hdr-close {
  background: color-mix(in srgb,var(--c-cream,#E8E4D8) 8%,transparent);
  border: 1px solid color-mix(in srgb,var(--c-cream,#E8E4D8) 14%,transparent);
  border-radius: 9px; width: 36px; height: 36px;
  color: var(--c-cream,#E8E4D8);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 18px; line-height: 1; flex-shrink: 0; transition: background .15s;
}
#a11y-hdr-close:hover { background: color-mix(in srgb,var(--c-cream,#E8E4D8) 18%,transparent); }
#a11y-hdr-close:focus-visible { outline: 3px solid var(--c-purple,#8490D8); outline-offset: 2px; }

/* Panel body */
#a11y-body {
  flex: 1; overflow-y: auto;
  padding: 12px 12px 24px;
  display: flex; flex-direction: column; gap: 5px;
  background: var(--c-bg,#09090F);
  -webkit-overflow-scrolling: touch;
}
#a11y-body::-webkit-scrollbar { width: 4px; }
#a11y-body::-webkit-scrollbar-thumb {
  background: color-mix(in srgb,var(--c-purple,#8490D8) 40%,transparent);
  border-radius: 2px;
}

/* Panel footer */
#a11y-ftr {
  padding: 12px 16px;
  border-top: 1px solid color-mix(in srgb,var(--c-purple,#8490D8) 18%,transparent);
  font-size: 12px;
  color: color-mix(in srgb,var(--c-cream,#E8E4D8) 55%,transparent);
  text-align: center; flex-shrink: 0;
  background: var(--c-card,#0E0E1C);
  line-height: 1.6;
}

/* Section label */
.a11y-sec {
  font-size: 10px; font-weight: 800; letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--c-purple,#8490D8);
  padding: 10px 4px 4px;
}

/* Item button */
.a11y-it {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 11px 12px;
  background: var(--c-card,#0E0E1C);
  border: 1.5px solid color-mix(in srgb,var(--c-purple,#8490D8) 10%,transparent);
  border-radius: 11px; cursor: pointer; font-size: 13.5px;
  font-weight: 600; color: var(--c-cream,#E8E4D8); text-align: right;
  font-family: inherit; direction: rtl;
  transition: background .13s, border-color .13s, transform .08s;
}
.a11y-it:hover {
  background: color-mix(in srgb,var(--c-purple,#8490D8) 10%,var(--c-card,#0E0E1C));
  border-color: color-mix(in srgb,var(--c-purple,#8490D8) 38%,transparent);
}
.a11y-it:focus-visible { outline: 3px solid var(--c-purple,#8490D8); outline-offset: 2px; }
.a11y-it:active { transform: scale(.97); }
.a11y-it.on {
  background: color-mix(in srgb,var(--c-purple,#8490D8) 14%,var(--c-card,#0E0E1C));
  border-color: var(--c-purple,#8490D8);
  color: var(--c-purple,#8490D8);
}

/* Item icon */
.a11y-ico {
  width: 36px; height: 36px; border-radius: 9px;
  background: color-mix(in srgb,var(--c-purple,#8490D8) 12%,transparent);
  color: var(--c-purple,#8490D8);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: background .13s;
}
.a11y-it.on .a11y-ico {
  background: var(--c-purple,#8490D8);
  color: var(--c-bg,#09090F);
}

/* Item check */
.a11y-chk {
  margin-right: auto; width: 20px; height: 20px;
  border-radius: 6px;
  border: 2px solid color-mix(in srgb,var(--c-cream,#E8E4D8) 25%,transparent);
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 11px; font-weight: 900; color: transparent;
  transition: all .13s;
}
.a11y-it.on .a11y-chk {
  background: var(--c-purple,#8490D8);
  border-color: var(--c-purple,#8490D8);
  color: var(--c-bg,#09090F);
}

/* Row layout */
.a11y-row { display: flex; gap: 5px; }
.a11y-row .a11y-it { flex: 1; flex-direction: column; gap: 6px; padding: 10px 6px; font-size: 11.5px; text-align: center; justify-content: center; }
.a11y-row .a11y-ico { margin: 0 auto; }
.a11y-row .a11y-chk { display: none; }

/* Size buttons */
.a11y-sizes { display: flex; gap: 5px; }
.a11y-sz {
  flex: 1; padding: 9px 4px;
  background: var(--c-card,#0E0E1C);
  border: 1.5px solid color-mix(in srgb,var(--c-purple,#8490D8) 10%,transparent);
  border-radius: 9px;
  cursor: pointer; font-family: inherit; font-weight: 700;
  color: var(--c-cream,#E8E4D8);
  transition: all .13s; text-align: center;
}
.a11y-sz:hover {
  background: color-mix(in srgb,var(--c-purple,#8490D8) 10%,var(--c-card,#0E0E1C));
  border-color: color-mix(in srgb,var(--c-purple,#8490D8) 38%,transparent);
}
.a11y-sz.on {
  background: color-mix(in srgb,var(--c-purple,#8490D8) 14%,var(--c-card,#0E0E1C));
  border-color: var(--c-purple,#8490D8);
  color: var(--c-purple,#8490D8);
}
.a11y-sz:focus-visible { outline: 3px solid var(--c-purple,#8490D8); }

/* Reset button */
.a11y-rst {
  width: 100%; padding: 11px; margin-top: 6px;
  background: transparent;
  border: 1.5px solid color-mix(in srgb,var(--c-cream,#E8E4D8) 20%,transparent);
  border-radius: 10px; cursor: pointer; font-family: inherit;
  font-size: 13px; font-weight: 600;
  color: color-mix(in srgb,var(--c-cream,#E8E4D8) 50%,transparent);
  transition: all .15s;
}
.a11y-rst:hover {
  background: color-mix(in srgb,#cc3333 10%,transparent);
  border-color: #cc3333; color: #cc3333;
}
.a11y-rst:focus-visible { outline: 3px solid var(--c-purple,#8490D8); }

/* Footer link */
.a11y-ftr-link {
  background: none; border: none;
  color: var(--c-purple,#8490D8);
  text-decoration: underline; cursor: pointer;
  font-size: 12px; font-family: inherit; padding: 0;
  transition: opacity .15s;
}
.a11y-ftr-link:hover { opacity: .72; }
.a11y-ftr-link:focus-visible { outline: 2px solid var(--c-purple,#8490D8); outline-offset: 2px; border-radius: 2px; }

/* ═══ Declaration modal ═════════════════════════════════════════════════════ */
#a11y-decl-wrap {
  position: fixed; inset: 0; background: rgba(0,0,0,.72);
  backdrop-filter: blur(4px); z-index: 999999;
  display: flex; align-items: center; justify-content: center;
  padding: 20px; animation: a11yFadeIn .2s ease;
}
#a11y-decl {
  background: var(--c-bg,#09090F);
  color: var(--c-cream,#E8E4D8);
  border: 1px solid color-mix(in srgb,var(--c-purple,#8490D8) 25%,transparent);
  border-radius: 18px; max-width: 620px;
  width: 100%; max-height: 88vh; overflow-y: auto;
  direction: rtl; padding: 36px 32px;
  box-shadow: 0 28px 90px rgba(0,0,0,.6);
}
#a11y-decl h2 { font-size:22px; font-weight:800; color:var(--c-cream,#E8E4D8); margin:0 0 20px; }
#a11y-decl h3 { font-size:15px; font-weight:700; color:var(--c-purple,#8490D8); margin:20px 0 8px; }
#a11y-decl p  { font-size:14px; color:var(--c-cream,#E8E4D8); opacity:.85; line-height:1.85; margin:0 0 10px; }
#a11y-decl ul { padding-right:20px; margin:0; }
#a11y-decl li { font-size:14px; color:var(--c-cream,#E8E4D8); opacity:.85; line-height:1.8; margin-bottom:4px; }
#a11y-decl a  { color:var(--c-purple,#8490D8); }

/* Declaration inner elements */
#a11y-decl-close-x {
  background: color-mix(in srgb,var(--c-cream,#E8E4D8) 9%,transparent);
  border: 1px solid color-mix(in srgb,var(--c-cream,#E8E4D8) 15%,transparent);
  border-radius: 9px; width: 38px; height: 38px;
  cursor: pointer; font-size: 20px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; color: var(--c-cream,#E8E4D8);
  transition: background .15s;
}
#a11y-decl-close-x:hover { background: color-mix(in srgb,var(--c-cream,#E8E4D8) 18%,transparent); }
#a11y-decl-close-x:focus-visible { outline: 3px solid var(--c-purple,#8490D8); outline-offset: 2px; }
#a11y-decl-info-box {
  margin-top: 24px; padding: 14px 16px;
  background: color-mix(in srgb,var(--c-purple,#8490D8) 10%,var(--c-card,#0E0E1C));
  border-radius: 10px; font-size: 13px; line-height: 1.7;
  border: 1px solid color-mix(in srgb,var(--c-purple,#8490D8) 28%,transparent);
  color: var(--c-cream,#E8E4D8);
}
#a11y-decl-close-btn {
  width: 100%; margin-top: 22px; padding: 13px;
  background: var(--c-purple,#8490D8); color: var(--c-bg,#09090F);
  border: none; border-radius: 10px; cursor: pointer;
  font-family: inherit; font-size: 14px; font-weight: 700;
  transition: opacity .15s;
}
#a11y-decl-close-btn:hover { opacity: .86; }
#a11y-decl-close-btn:focus-visible { outline: 3px solid var(--c-purple,#8490D8); outline-offset: 3px; }

/* ═══ Print reset ════════════════════════════════════════════════════════════ */
@media print {
  html[class*="a11y-"] { filter: none !important; }
  html[class*="a11y-t"] { font-size: 100% !important; }
  #a11y-btn, #a11y-ovl, #a11y-panel { display: none !important; }
}
`

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'afik_a11y'
const CSS_ID      = 'a11y-global-styles'
const ALL_CLS     = ['a11y-t1','a11y-t2','a11y-t3','a11y-t4','a11y-hi','a11y-inv','a11y-bw','a11y-lnk','a11y-font','a11y-spc','a11y-noanim','a11y-foc','a11y-cur','a11y-msk','a11y-hdg']

const DEFAULTS = {
  textSize:    0,    // 0=normal 1=110% 2=120% 3=130% 4=150%
  contrast:    '',   // ''|'high'|'invert'|'bw'
  links:       false,
  font:        false,
  spacing:     false,
  noAnim:      false,
  focus:       false,
  bigCursor:   false,
  readingMask: false,
  headings:    false,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULTS }
}

function applyPrefs(p) {
  const h = document.documentElement
  ALL_CLS.forEach(c => h.classList.remove(c))
  if (p.textSize > 0)          h.classList.add(`a11y-t${p.textSize}`)
  if (p.contrast === 'high')   h.classList.add('a11y-hi')
  if (p.contrast === 'invert') h.classList.add('a11y-inv')
  if (p.contrast === 'bw')     h.classList.add('a11y-bw')
  if (p.links)       h.classList.add('a11y-lnk')
  if (p.font)        h.classList.add('a11y-font')
  if (p.spacing)     h.classList.add('a11y-spc')
  if (p.noAnim)      h.classList.add('a11y-noanim')
  if (p.focus)       h.classList.add('a11y-foc')
  if (p.bigCursor)   h.classList.add('a11y-cur')
  if (p.readingMask) h.classList.add('a11y-msk')
  if (p.headings)    h.classList.add('a11y-hdg')
}

function injectCSS() {
  if (document.getElementById(CSS_ID)) return
  const s = document.createElement('style')
  s.id = CSS_ID
  s.textContent = A11Y_CSS
  document.head.appendChild(s)
}

function ensureMask() {
  if (document.getElementById('a11y-rmask')) return
  const el = document.createElement('div')
  el.id = 'a11y-rmask'
  document.body.appendChild(el)
}

// ── Sub-components ────────────────────────────────────────────────────────────
function A11yIcon({ size = 28, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      aria-hidden="true" focusable="false" style={style}>
      {/* Head */}
      <circle cx="11.5" cy="3.5" r="2"/>
      {/* Torso & arm */}
      <path d="M14.5 8H9L7.5 15H10l-.5 1.5H7L6 20h2l.5-2h2.5l.5 2H14l-1-7h2.5l-1-5z"/>
      {/* Wheel */}
      <circle cx="9" cy="20" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="14.5" cy="19.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  )
}

function Item({ label, icon, active, onClick, desc }) {
  return (
    <button
      className={`a11y-it${active ? ' on' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={desc || label}>
      <span className="a11y-ico" aria-hidden="true" style={{ fontSize: 18 }}>{icon}</span>
      <span>{label}</span>
      <span className="a11y-chk" aria-hidden="true">{active ? '✓' : ''}</span>
    </button>
  )
}

function RowItem({ label, icon, active, onClick, desc }) {
  return (
    <button
      className={`a11y-it${active ? ' on' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={desc || label}
      style={{ flexDirection:'column', gap:6, padding:'10px 6px', fontSize:11.5, textAlign:'center', justifyContent:'center', flex:1 }}>
      <span className="a11y-ico" aria-hidden="true" style={{ fontSize:18, margin:'0 auto' }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}

function Declaration({ onClose }) {
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div id="a11y-decl-wrap" role="dialog" aria-modal="true" aria-labelledby="decl-h"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div id="a11y-decl">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <h2 id="decl-h">הצהרת נגישות</h2>
          <button id="a11y-decl-close-x" ref={closeRef} onClick={onClose} aria-label="סגור הצהרת נגישות">✕</button>
        </div>

        <p><strong>אפיק הנחל – ייזום שיווק ותיווך</strong> מחויבת לנגישות דיגיטלית ולשוויון הזדמנויות לכלל המשתמשים, לרבות אנשים עם מוגבלויות.</p>

        <h3>רמת ההתאמה</h3>
        <p>האתר עושה מאמצים לעמוד בדרישות <strong>WCAG 2.1 ברמה AA</strong> ובהתאם ל<strong>תקן ישראלי 5568</strong> ולחוק שוויון זכויות לאנשים עם מוגבלות.</p>

        <h3>התאמות שבוצעו</h3>
        <ul>
          {[
            'הגדלת טקסט עד 150% ללא פגיעה בפריסה',
            'מצבי ניגודיות: גבוהה, הפוכה ושחור-לבן',
            'הדגשת קישורים לזיהוי קל',
            'הדגשת כותרות H1–H6 לניווט קל',
            'פונט קריא ונגיש (Arial)',
            'ריווח מוגדל בין שורות, אותיות ומילים',
            'עצירת אנימציות ומעברים',
            'הדגשת פוקוס מקלדת לניווט נוח',
            'פס קריאה אופקי שעוקב אחר העכבר',
            'סמן עכבר מוגדל',
            'קריאת תוכן הדף בקול (Text-to-Speech)',
            'ניווט מלא במקלדת (Tab / Shift+Tab / Enter / Esc)',
            'קישור "דלג לתוכן" לניווט מהיר',
            'תמיכה מלאה ב-RTL ובעברית',
            'שמירת העדפות ב-localStorage לרענון עמוד',
            'aria-label ו-role מלאים לכל הרכיבים',
          ].map((it, i) => <li key={i}>✓ {it}</li>)}
        </ul>

        <h3>תאריך עדכון</h3>
        <p>{new Date().toLocaleDateString('he-IL', { year:'numeric', month:'long', day:'numeric' })}</p>

        <h3>רכז נגישות</h3>
        <p>
          לפניות, תלונות ובקשות נגישות ניתן לפנות:<br/>
          <a href="tel:0559811814">055-981-1814</a><br/>
          <a href="mailto:afik.hanahal@gmail.com">afik.hanahal@gmail.com</a>
        </p>

        <h3>אזורים שטרם הונגשו במלואם</h3>
        <p>חלק מהסרטונים המוטמעים עשויים להיות חסרי כתוביות. אנו פועלים לשיפור מתמיד של הנגישות.</p>

        <div id="a11y-decl-info-box">
          <strong>כיצד להשתמש בתפריט הנגישות?</strong><br/>
          לחצו על כפתור הנגישות בפינה הימנית התחתונה של המסך לפתיחת תפריט ההתאמות המלא.
        </div>

        <button id="a11y-decl-close-btn" onClick={onClose} aria-label="סגור">
          סגור הצהרת נגישות
        </button>
      </div>
    </div>
  )
}

// ── Main Widget ───────────────────────────────────────────────────────────────
export default function AccessibilityWidget() {
  const [open,     setOpen]     = useState(false)
  const [prefs,    setPrefs]    = useState(loadPrefs)
  const [showDecl, setShowDecl] = useState(false)
  const [liveMsg,  setLiveMsg]  = useState('')

  const panelRef     = useRef(null)
  const triggerRef   = useRef(null)
  const closeRef     = useRef(null)
  const prevPrefsRef = useRef(prefs)

  // ── Bootstrap: inject CSS + mask element ──
  useEffect(() => {
    injectCSS()
    ensureMask()
  }, [])

  // ── Apply prefs on every change ──
  useEffect(() => {
    applyPrefs(prefs)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)) } catch {}
  }, [prefs])

  // ── Announce prefs changes to screen reader ──
  useEffect(() => {
    const prev = prevPrefsRef.current
    prevPrefsRef.current = prefs
    const featureLabels = {
      font: 'פונט קריא', spacing: 'ריווח מוגדל', links: 'הדגש קישורים',
      readingMask: 'פס קריאה', focus: 'הדגש פוקוס', bigCursor: 'סמן גדול',
      noAnim: 'עצור אנימציות', headings: 'הדגש כותרות',
    }
    for (const [k, label] of Object.entries(featureLabels)) {
      if (prev[k] !== prefs[k]) {
        setLiveMsg('')
        setTimeout(() => setLiveMsg(`${label}: ${prefs[k] ? 'מופעל' : 'כבוי'}`), 50)
        return
      }
    }
    if (prev.contrast !== prefs.contrast) {
      const cLabels = { high: 'ניגודיות גבוהה', invert: 'ניגודיות הפוכה', bw: 'שחור-לבן', '': 'ניגודיות רגילה' }
      setLiveMsg('')
      setTimeout(() => setLiveMsg(`ניגודיות: ${cLabels[prefs.contrast] || 'שונתה'}`), 50)
      return
    }
    if (prev.textSize !== prefs.textSize) {
      const sLabels = { 0: 'רגיל', 1: '110%', 2: '120%', 3: '130%', 4: '150%' }
      setLiveMsg('')
      setTimeout(() => setLiveMsg(`גודל טקסט: ${sLabels[prefs.textSize]}`), 50)
    }
  }, [prefs])

  // ── Reading mask: follow mouse ──
  useEffect(() => {
    const mask = document.getElementById('a11y-rmask')
    if (!prefs.readingMask || !mask) return
    const move = e => { mask.style.top = e.clientY + 'px' }
    document.addEventListener('mousemove', move, { passive: true })
    return () => document.removeEventListener('mousemove', move)
  }, [prefs.readingMask])

  // ── Focus trap + keyboard ──
  useEffect(() => {
    if (!open) return
    // Focus first element in panel
    setTimeout(() => closeRef.current?.focus(), 50)

    const onKey = e => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
      if (e.key !== 'Tab' || !panelRef.current) return
      const els = panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input, select, [tabindex]:not([tabindex="-1"])'
      )
      if (!els.length) return
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // ── Alt+A keyboard shortcut ──
  useEffect(() => {
    const onKey = e => {
      if (e.code === 'KeyA' && e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault()
        setOpen(o => !o)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ── Updaters ──
  const set    = useCallback((k, v) => setPrefs(p => ({ ...p, [k]: v })), [])
  const toggle = useCallback(k       => setPrefs(p => ({ ...p, [k]: !p[k] })), [])
  const setContrast = useCallback(v  => setPrefs(p => ({ ...p, contrast: p.contrast === v ? '' : v })), [])
  const reset  = useCallback(()      => setPrefs({ ...DEFAULTS }), [])

  const onClose = useCallback(() => {
    setOpen(false)
    setTimeout(() => triggerRef.current?.focus(), 50)
  }, [])

  // ── TTS ──
  const speak = useCallback(() => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const main = document.getElementById('main-content') || document.body
    const text = main.innerText?.slice(0, 800) || ''
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'he-IL'; u.rate = 0.88; u.pitch = 1
    window.speechSynthesis.speak(u)
  }, [])

  const stopSpeak = useCallback(() => {
    window.speechSynthesis?.cancel()
  }, [])

  return (
    <>
      {/* ── Skip to content ─────────────────────────────────────────────── */}
      <a href="#main-content" className="a11y-skip">דלג לתוכן הראשי</a>

      {/* ── Screen reader live region (always mounted, outside panel) ────── */}
      <div role="status" aria-live="polite" aria-atomic="true"
        style={{ position:'absolute', insetInlineStart:'-9999px', width:1, height:1, overflow:'hidden' }}>
        {liveMsg}
      </div>

      {/* ── Trigger button ──────────────────────────────────────────────── */}
      <button
        id="a11y-btn"
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        aria-label="פתח תפריט נגישות"
        aria-expanded={open}
        aria-controls="a11y-panel"
        aria-haspopup="dialog"
        aria-keyshortcuts="Alt+A"
        title="תפריט נגישות – לחץ לפתיחה (Alt+A)">
        <A11yIcon size={26}/>
      </button>

      {/* ── Panel ───────────────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Overlay */}
          <div id="a11y-ovl" onClick={onClose} aria-hidden="true"/>

          {/* Panel */}
          <div id="a11y-panel" ref={panelRef}
            role="dialog" aria-modal="true"
            aria-labelledby="a11y-panel-title"
            aria-describedby="a11y-panel-desc">

            {/* Header */}
            <div id="a11y-hdr">
              <A11yIcon size={30}/>
              <div style={{ flex:1 }}>
                <div id="a11y-panel-title" style={{ fontWeight:800, fontSize:16.5, lineHeight:1.25 }}>תפריט נגישות</div>
                <div id="a11y-panel-desc" style={{ fontSize:11, opacity:.6, marginTop:3, lineHeight:1.4 }}>WCAG 2.1 AA · תקן ישראלי 5568</div>
              </div>
              <button id="a11y-hdr-close" ref={closeRef} onClick={onClose} aria-label="סגור תפריט נגישות">✕</button>
            </div>

            {/* Body */}
            <div id="a11y-body" role="group" aria-label="אפשרויות נגישות">

              {/* ── Text size ─────────────────────────────────────── */}
              <div className="a11y-sec">גודל טקסט</div>
              <div className="a11y-sizes" role="group" aria-label="בחר גודל טקסט">
                {[
                  { v:0, lbl:'רגיל',   size:'13px' },
                  { v:1, lbl:'110%',   size:'14px' },
                  { v:2, lbl:'120%',   size:'15px' },
                  { v:3, lbl:'130%',   size:'16px' },
                  { v:4, lbl:'150%',   size:'17px' },
                ].map(({ v, lbl, size }) => (
                  <button key={v}
                    className={`a11y-sz${prefs.textSize === v ? ' on' : ''}`}
                    onClick={() => set('textSize', v)}
                    aria-pressed={prefs.textSize === v}
                    aria-label={`גודל טקסט ${lbl}`}
                    style={{ fontSize: size }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {/* ── Contrast ──────────────────────────────────────── */}
              <div className="a11y-sec">ניגודיות וצבע</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                <RowItem icon="◑" label="ניגודיות גבוהה" active={prefs.contrast==='high'}   onClick={() => setContrast('high')}   desc="הפעל ניגודיות גבוהה"/>
                <RowItem icon="◐" label="ניגודיות הפוכה" active={prefs.contrast==='invert'} onClick={() => setContrast('invert')} desc="היפוך צבעי האתר"/>
                <RowItem icon="◔" label="שחור-לבן"        active={prefs.contrast==='bw'}     onClick={() => setContrast('bw')}     desc="מצב שחור לבן"/>
              </div>

              {/* ── Reading aids ───────────────────────────────────── */}
              <div className="a11y-sec">עזרי קריאה</div>
              <Item icon="T" label="פונט קריא (Arial)" active={prefs.font}    onClick={() => toggle('font')}    desc="החלף לפונט נגיש"/>
              <Item icon="⇕" label="ריווח מוגדל"       active={prefs.spacing} onClick={() => toggle('spacing')} desc="הגדל ריווח בין שורות ואותיות"/>
              <Item icon="🔗" label="הדגש קישורים"     active={prefs.links}   onClick={() => toggle('links')}   desc="הדגש את כל הקישורים"/>
              <Item icon="▬" label="פס קריאה"           active={prefs.readingMask} onClick={() => toggle('readingMask')} desc="פס קריאה שעוקב אחרי העכבר"/>
              <Item icon="#" label="הדגש כותרות"        active={prefs.headings}    onClick={() => toggle('headings')}    desc="הדגש כותרות H1–H6 לניווט קל"/>

              {/* ── Navigation & interaction ───────────────────────── */}
              <div className="a11y-sec">ניווט ואינטראקציה</div>
              <Item icon="⌨" label="הדגש פוקוס מקלדת" active={prefs.focus}     onClick={() => toggle('focus')}     desc="הדגש אלמנטים בפוקוס מקלדת"/>
              <Item icon="🖱" label="סמן עכבר גדול"    active={prefs.bigCursor} onClick={() => toggle('bigCursor')} desc="הגדל את סמן העכבר"/>

              {/* ── Motion ────────────────────────────────────────── */}
              <div className="a11y-sec">תנועה ואנימציות</div>
              <Item icon="⏸" label="עצור אנימציות" active={prefs.noAnim} onClick={() => toggle('noAnim')} desc="השבת אנימציות ומעברים"/>

              {/* ── TTS ───────────────────────────────────────────── */}
              {typeof window !== 'undefined' && window.speechSynthesis && (
                <>
                  <div className="a11y-sec">קריאת טקסט</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                    <RowItem icon="🔊" label="קרא בקול" onClick={speak}     desc="קרא את תוכן הדף"/>
                    <RowItem icon="🔇" label="עצור קריאה" onClick={stopSpeak} desc="עצור קריאה"/>
                  </div>
                </>
              )}

              {/* ── Reset ─────────────────────────────────────────── */}
              <button className="a11y-rst" onClick={reset} aria-label="אפס את כל הגדרות הנגישות">
                ↺ &nbsp;אפס את כל ההגדרות
              </button>
            </div>

            {/* Footer */}
            <div id="a11y-ftr">
              <p style={{ margin:'0 0 6px' }}>
                האתר עושה מאמצים לעמוד בדרישות הנגישות בהתאם לתקן הישראלי 5568.
              </p>
              <button className="a11y-ftr-link" onClick={() => setShowDecl(true)} aria-label="פתח הצהרת נגישות מלאה">
                הצהרת נגישות מלאה ←
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Declaration modal ───────────────────────────────────────────── */}
      {showDecl && <Declaration onClose={() => setShowDecl(false)}/>}
    </>
  )
}
