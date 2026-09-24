// Design system for the automations tab (spec: tokens · C1–C28). Inline styles only; hover, focus,
// motion and breakpoints live in AUTO_CSS. Everything bilingual comes in through props.
import { useState, useEffect, useRef, useCallback, useLayoutEffect, createContext, useContext, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { FaTimes, FaCircleNotch, FaPowerOff, FaUserCheck, FaBolt, FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaInfoCircle, FaMinusCircle, FaCopy, FaHome } from 'react-icons/fa'
import { WAText } from './waFormat.jsx'

// ── Tokens ─────────────────────────────────────────────────────────────────────
export const T = {
  bg: 'var(--au-bg)',
  s1: 'var(--au-s1)', s1Line: 'var(--au-s1-line)',
  s2: 'var(--au-s2)', s2Line: 'var(--au-s2-line)',
  s3: 'var(--au-s3)', s3Line: 'var(--au-s3-line)',
  line: 'var(--au-line)', line2: 'var(--au-line2)', divider: 'var(--au-divider)',
  text: 'var(--au-text)', text2: 'var(--au-text2)', text3: 'var(--au-text3)', textDis: 'var(--au-text-dis)',
  brand: '#6F7AC7', brandSoft: 'var(--au-brand-soft)', brandText: 'var(--au-brand-text)',
  green: '#25D366', greenSoft: 'rgba(37,211,102,.14)', greenLine: 'rgba(37,211,102,.5)',
  amber: '#F5A623', amberSoft: 'rgba(245,166,35,.12)', amberText: 'var(--au-amber-text)',
  red: '#E05252', redSoft: 'rgba(224,82,82,.12)', redText: 'var(--au-red-text)',
  blue: '#60A5FA', grey: '#9A9AA8',
  wa: { header: '#202C33', chat: '#0B141A', out: '#005C4B', text: '#E9EDEF', meta: 'rgba(233,237,239,.6)', link: '#53BDEB' },
  shadow2: 'var(--au-shadow2)', shadow3: 'var(--au-shadow3)', cardShadow: 'var(--au-card-shadow)', card: 'var(--au-card)', cardGrad: 'var(--au-card-grad)', pop: 'var(--au-pop)', tooltip: 'var(--au-tooltip)',
}
export const MODE_COLOR = { off: T.grey, suggest: T.amber, auto: T.green }
export const MODE_ICON = { off: FaPowerOff, suggest: FaUserCheck, auto: FaBolt }

export const AUTO_CSS = `
  .au *{box-sizing:border-box}
  .au :focus-visible{outline:none!important;box-shadow:0 0 0 2px var(--au-bg),0 0 0 4px var(--au-brand)!important;border-radius:9px}
  .au-hov:hover:not(:disabled){background:rgba(var(--brand-rgb),.1)!important}
  .au-hov-lift{transition:filter .15s}.au-hov-lift:hover:not(:disabled){filter:brightness(1.12)}
  .au-card-hov{transition:border-color .15s,transform .15s}
  .au-card-hov:hover{border-color:rgba(var(--brand-rgb),.35)!important}
  .au-scroll-x{overflow-x:auto;scrollbar-width:none;padding-inline-end:16px}.au-scroll-x::-webkit-scrollbar{display:none}
  .au-row-actions{opacity:1}
  @media (hover:hover) and (min-width:1000px){.au-row .au-row-actions{opacity:0;transition:opacity .15s}.au-row:hover .au-row-actions,.au-row:focus-within .au-row-actions{opacity:1}}
  @keyframes au-spin{to{transform:rotate(360deg)}}
  @keyframes au-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  @keyframes au-sh{0%{background-position:-200px 0}100%{background-position:calc(200px + 100%) 0}}
  @keyframes au-drawer{from{transform:translateX(var(--au-dx,100%))}to{transform:none}}
  @keyframes au-sheet{from{transform:translateY(100%)}to{transform:none}}
  .au-spin{animation:au-spin .8s linear infinite}
  .au-in{animation:au-in .2s ease both}
  .au-skel{background:linear-gradient(90deg,var(--au-skel) 0,var(--au-skel-hi) 40px,var(--au-skel) 80px) no-repeat,var(--au-skel);background-size:200px 100%;animation:au-sh 1.3s linear infinite}
  .au-today{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
  .au-today-aside{position:sticky;top:64px;display:flex;flex-direction:column;gap:12px}
  .au-kpi{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .au-tpl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
  .au-ed-body{display:grid;grid-template-columns:minmax(0,1fr) 400px;flex:1;min-height:0}
  .au-branches{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
  .au-nav{display:flex;gap:6px}
  .au-nav-btn{height:36px;padding:0 14px;border-radius:9px;display:inline-flex;align-items:center;gap:7px;position:relative}
  .au-only-m{display:none!important}
  .au-sched-row{display:grid;grid-template-columns:88px minmax(0,1.2fr) minmax(0,1fr) 150px 112px;align-items:center;gap:10px;min-height:52px;padding:6px 14px}
  .au-log-row{display:grid;grid-template-columns:28px 96px 170px 110px minmax(0,1fr) 110px 88px;align-items:center;gap:10px;min-height:48px;padding:6px 14px}
  .au-day-row{display:grid;grid-template-columns:72px 52px minmax(0,1fr) 132px 36px;align-items:center;gap:10px;min-height:44px;padding:0 8px;border-radius:8px}
  .au-wiz{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:16px;min-height:0}
  .au-wiz2{display:grid;grid-template-columns:300px minmax(0,1fr);gap:16px;min-height:0}
  @media (max-width:1000px){
    .au-today{grid-template-columns:1fr}.au-today-aside{position:static}
    .au-sched-row{grid-template-columns:56px minmax(0,1fr) auto;row-gap:2px}
    .au-sched-row .au-sr-kind,.au-sched-row .au-sr-mode{display:none}
    .au-log-row{grid-template-columns:24px minmax(0,1fr) auto;row-gap:4px}
    .au-log-row .au-lr-kind,.au-log-row .au-lr-by,.au-log-row .au-lr-msg{grid-column:2/4}
  }
  @media (max-width:760px){
    .au-ed-body{grid-template-columns:1fr}
    .au-wiz,.au-wiz2{grid-template-columns:1fr}
  }
  @media (max-width:640px){
    .au-hide-m{display:none!important}.au-only-m{display:flex!important}
    .au-nav{display:grid;grid-template-columns:repeat(6,1fr);gap:0}
    .au-nav-btn{height:52px;padding:0 2px;flex-direction:column;justify-content:center;gap:3px;border-radius:0!important;border:none!important;font-size:10.5px!important}
    .au-day-row{grid-template-columns:1fr}
  }
  @media (prefers-reduced-motion:reduce){.au-skel,.au-in,.au-spin{animation:none!important}}
`

// ── C1 Button ──────────────────────────────────────────────────────────────────
export const Button = forwardRef(function Button({ children, onClick, variant = 'ghost', size = 'md', icon, loading, disabled, title, ariaLabel, full, type = 'button', style, ...rest }, ref) {
  const h = size === 'sm' ? 30 : size === 'lg' ? 44 : 36
  const V = {
    solid: { bg: T.green, bd: T.green, fg: '#07130C', fw: 800 },
    'soft-green': { bg: T.greenSoft, bd: T.greenLine, fg: T.green },
    brand: { bg: T.brandSoft, bd: 'rgba(var(--brand-rgb),.3)', fg: T.brandText },
    ghost: { bg: 'transparent', bd: 'rgba(var(--ink),.18)', fg: T.text2 },
    danger: { bg: 'transparent', bd: 'rgba(224,82,82,.4)', fg: T.redText },
    plain: { bg: 'transparent', bd: 'transparent', fg: T.text2 },
  }[variant]
  return (
    <button ref={ref} type={type} onClick={onClick} disabled={disabled || loading} title={title} aria-label={ariaLabel} aria-busy={loading || undefined} className={variant === 'solid' || variant === 'soft-green' ? 'au-hov-lift' : 'au-hov'} {...rest}
      style={{ height: h, padding: `0 ${size === 'sm' ? 10 : size === 'lg' ? 18 : 14}px`, borderRadius: 9, border: `1px solid ${V.bd}`, background: V.bg, color: V.fg,
        fontSize: size === 'sm' ? 12 : size === 'lg' ? 14 : 13, fontWeight: V.fw || 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        cursor: disabled || loading ? 'not-allowed' : 'pointer', opacity: disabled ? .45 : 1, minHeight: 0, minWidth: 0, whiteSpace: 'nowrap', width: full ? '100%' : undefined, flexShrink: 0, ...style }}>
      {loading ? <FaCircleNotch size={12} className="au-spin"/> : icon}{children}
    </button>
  )
})
export const IconButton = forwardRef(function IconButton({ icon, onClick, label, size = 32, variant = 'plain', style, ...rest }, ref) {
  return <Button ref={ref} variant={variant} onClick={onClick} ariaLabel={label} title={label} style={{ width: size, height: size, padding: 0, ...style }} {...rest}>{icon}</Button>
})

// ── C2 ModeSwitch ──────────────────────────────────────────────────────────────
export function ModeSwitch({ value, onChange, labels, modes = ['off', 'suggest', 'auto'], size = 'md', label, full, colors = MODE_COLOR, icons = MODE_ICON }) {
  const refs = useRef([])
  const onKey = e => {
    const i = modes.indexOf(value)
    let d = 0
    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
    if (e.key === 'ArrowRight') d = rtl ? -1 : 1
    if (e.key === 'ArrowLeft') d = rtl ? 1 : -1
    if (!d) return
    e.preventDefault()
    const n = (i + d + modes.length) % modes.length
    onChange(modes[n]); refs.current[n]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} style={{ display: full ? 'flex' : 'inline-flex', padding: 2, gap: 2, borderRadius: 9, background: 'rgba(var(--ov),.04)', border: '1px solid rgba(var(--brand-rgb),.2)', flexShrink: 0, width: full ? '100%' : undefined }}>
      {modes.map((m, i) => {
        const on = value === m, c = colors[m] || T.brand, Ic = icons[m]
        return (
          <button key={m} ref={el => { refs.current[i] = el }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onChange(m)}
            style={{ height: full ? 40 : size === 'sm' ? 28 : 32, padding: '0 12px', borderRadius: 7, border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer', minHeight: 0, minWidth: 0, flex: full ? 1 : undefined,
              background: on ? `${c}29` : 'transparent', color: on ? (c === T.brand ? T.brandText : c) : T.text3, boxShadow: on ? `inset 0 0 0 1px ${c}66` : 'none' }}>
            {Ic && <Ic size={11}/>}{labels[m]}
          </button>
        )
      })}
    </div>
  )
}
export function ModeBadge({ mode, labels }) {
  const c = MODE_COLOR[mode] || T.grey, Ic = MODE_ICON[mode]
  return <span style={{ height: 22, padding: '0 8px', borderRadius: 20, fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, background: `${c}1f`, color: mode === 'suggest' ? T.amberText : c, whiteSpace: 'nowrap' }}>{Ic && <Ic size={9}/>}{labels[mode]}</span>
}

// ── C3 Toggle ──────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label, children, disabled }) {
  const sw = (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={children ? undefined : label} disabled={disabled} onClick={() => onChange(!checked)}
      style={{ width: 40, height: 22, borderRadius: 11, border: 'none', padding: 0, position: 'relative', background: checked ? T.green : 'rgba(var(--ov),.16)', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0, minHeight: 0, minWidth: 0, transition: 'background .18s', opacity: disabled ? .5 : 1 }}>
      <span style={{ position: 'absolute', top: 2, insetInlineStart: checked ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .18s', boxShadow: '0 1px 3px rgba(0,0,0,.35)' }}/>
    </button>
  )
  if (!children) return sw
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.text, cursor: 'pointer', minHeight: 32 }}>{sw}<span>{children}</span></label>
}

// ── C6 StatTile · C7 FilterChip ────────────────────────────────────────────────
export function StatTile({ value, label, tone = T.text, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={onClick ? 'au-card-hov' : undefined}
      style={{ minHeight: 76, padding: '12px 14px', borderRadius: 12, background: T.s1, border: `1px solid ${T.s1Line}`, boxShadow: T.cardShadow, textAlign: 'start', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2, cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit', color: 'inherit', minWidth: 0 }}>
      <span style={{ fontSize: 24, fontWeight: 900, color: tone, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>{label}</span>
    </Tag>
  )
}
export function FilterChip({ children, selected, count, color = T.brand, onClick, title }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={!!selected} title={title}
      style={{ height: 28, padding: '0 11px', borderRadius: 20, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0, minHeight: 0, minWidth: 0,
        background: selected ? `${color}26` : 'transparent', border: `1px solid ${selected ? color : 'rgba(var(--brand-rgb),.2)'}`, color: selected ? color : T.text2 }}>
      {children}{count != null && <span style={{ fontSize: 11, fontWeight: 800, opacity: .8, fontVariantNumeric: 'tabular-nums' }}>{count}</span>}
    </button>
  )
}
export function Badge({ children, color = T.brand, textColor, outline, title }) {
  return <span title={title} style={{ height: 20, padding: '0 7px', borderRadius: 20, fontSize: 10.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', background: outline ? 'transparent' : `${color}22`, border: outline ? `1px solid ${color}` : 'none', color: textColor || color, lineHeight: 1 }}>{children}</span>
}

// ── C13 EmptyState · C14 Skeleton / InlineError ────────────────────────────────
export function EmptyState({ icon: Ic, title, body, action, compact }) {
  return (
    <div style={{ padding: compact ? '24px 16px' : '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
      {Ic && <span style={{ width: compact ? 40 : 56, height: compact ? 40 : 56, borderRadius: '50%', background: T.brandSoft, color: T.brandText, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Ic size={compact ? 17 : 22}/></span>}
      <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{title}</div>
      {body && <div style={{ fontSize: 13, color: T.text2, maxWidth: 380, lineHeight: 1.55 }}>{body}</div>}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  )
}
export const Skeleton = ({ h = 16, w = '100%', r = 8, style }) => <div className="au-skel" aria-hidden style={{ height: h, width: w, borderRadius: r, ...style }}/>
export function InlineError({ message, onRetry, retryLabel }) {
  return (
    <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: T.redSoft, border: '1px solid rgba(224,82,82,.35)', color: T.redText, fontSize: 13 }}>
      <FaExclamationTriangle/><span style={{ flex: 1 }}>{message}</span>{onRetry && <Button size="sm" onClick={onRetry}>{retryLabel}</Button>}
    </div>
  )
}

// ── Card / section ─────────────────────────────────────────────────────────────
export function Card({ children, pad = 16, style, accent, className, id }) {
  return <div id={id} className={className} style={{ background: T.s1, border: `1px solid ${T.s1Line}`, boxShadow: T.cardShadow, borderRadius: 14, padding: pad, ...(accent ? { borderInlineStart: `3px solid ${accent}` } : {}), ...style }}>{children}</div>
}
export function SectionHead({ title, count, right, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 10px', flexWrap: 'wrap' }}>
      {icon}<h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text }}>{title}</h3>
      {count != null && <span style={{ fontSize: 12, fontWeight: 800, color: T.text3, fontVariantNumeric: 'tabular-nums' }}>({count})</span>}
      <div style={{ flex: 1 }}/>{right}
    </div>
  )
}
export const inputStyle = { width: '100%', height: 40, padding: '0 12px', borderRadius: 9, border: `1px solid ${T.s3Line}`, background: T.s3, color: T.text, fontFamily: 'inherit', fontSize: 13.5, outline: 'none', minHeight: 0 }
export function Field({ label, children, hint, htmlFor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label htmlFor={htmlFor} style={{ fontSize: 12, fontWeight: 700, color: T.text2 }}>{label}</label>}
      {children}
      {hint && <span style={{ fontSize: 11.5, color: T.text3, lineHeight: 1.5 }}>{hint}</span>}
    </div>
  )
}

// ── Overlays: Modal / ConfirmDialog / Drawer / Popover ─────────────────────────
function useFocusTrap(open, ref, onEsc, initialSel) {
  const escRef = useRef(onEsc)
  escRef.current = onEsc          // always call the latest handler (it may depend on unsaved state)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const el = ref.current
    setTimeout(() => { (initialSel ? el?.querySelector(initialSel) : null)?.focus?.() || el?.querySelector('[data-autofocus],textarea,input,select,button')?.focus() }, 20)
    const onKey = e => {
      // only the dialog that holds focus reacts (nested dialogs, popovers)
      if (el && document.activeElement && document.activeElement !== document.body && !el.contains(document.activeElement)) return
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); escRef.current?.() }
      if (e.key !== 'Tab' || !el) return
      const f = [...el.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('keydown', onKey, true); prev?.focus?.() }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
}
export function Modal({ open, onClose, title, children, footer, width = 560, full, dir, closeOnBackdrop = true, initialFocus, label }) {
  const ref = useRef(null)
  useFocusTrap(open, ref, onClose, initialFocus)
  if (!open) return null
  return createPortal(
    <div className="au" dir={dir} onMouseDown={e => { if (closeOnBackdrop && e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'var(--au-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: full ? 16 : 14 }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label || (typeof title === 'string' ? title : undefined)} className="au-in"
        style={{ width: full ? 'min(1120px, calc(100vw - 32px))' : '100%', maxWidth: full ? undefined : width, height: full ? 'min(780px, calc(100dvh - 32px))' : undefined, maxHeight: 'calc(100dvh - 28px)', display: 'flex', flexDirection: 'column', background: T.s2, border: `1px solid ${T.s2Line}`, borderRadius: 16, boxShadow: T.shadow2, overflow: 'hidden', color: T.text }}>
        {title != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${T.line}`, minHeight: 56 }}>
            <IconButton icon={<FaTimes/>} label="✕" onClick={onClose} size={36}/>
            <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800 }}>{title}</div>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'auto', padding: title != null ? 18 : 0, minHeight: 0 }}>{children}</div>
        {footer && <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.line}`, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', background: 'rgba(var(--shade),.06)' }}>{footer}</div>}
      </div>
    </div>, document.body)
}
// Promise-based confirm: const ok = await confirm({ title, body, confirmLabel, cancelLabel, tone })
const ConfirmCtx = createContext(null)
export function ConfirmProvider({ children, dir }) {
  const [st, setSt] = useState(null)
  const [can, setCan] = useState(true)
  const ask = useCallback(opts => new Promise(res => { setCan(opts.canConfirm !== false); setSt({ ...opts, res }) }), [])
  const close = v => { st?.res(v); setSt(null) }
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Modal open={!!st} onClose={() => close(false)} width={420} dir={dir} label={st?.title} initialFocus="[data-safe]">
        {st && (
          <div role="alertdialog" aria-label={st.title} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{st.title}</div>
            {st.body && <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.6 }}>{st.body}</div>}
            {typeof st.content === 'function' ? st.content({ setCanConfirm: setCan }) : st.content}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6, flexWrap: 'wrap' }}>
              <Button data-safe onClick={() => close(false)}>{st.cancelLabel}</Button>
              <Button variant={st.tone === 'danger' ? 'danger' : 'solid'} disabled={!can} onClick={() => close(true)}>{st.confirmLabel}</Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmCtx.Provider>
  )
}
export const useConfirm = () => useContext(ConfirmCtx)

export function Drawer({ open, onClose, title, sub, children, dir }) {
  const ref = useRef(null)
  useFocusTrap(open, ref, onClose)
  if (!open) return null
  const rtl = dir === 'rtl'
  return createPortal(
    <div className="au" dir={dir} onMouseDown={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 2600, background: 'var(--au-overlay)' }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        style={{ '--au-dx': rtl ? '-100%' : '100%', position: 'absolute', top: 0, bottom: 0, insetInlineEnd: 0, width: 'min(440px, 100vw)', background: T.s2, borderInlineStart: `1px solid ${T.s2Line}`, boxShadow: T.shadow2, display: 'flex', flexDirection: 'column', animation: 'au-drawer .22s ease both', color: T.text }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '16px 18px', borderBottom: `1px solid ${T.line}` }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 800 }}>{title}</div>{sub}</div>
          <IconButton icon={<FaTimes/>} label="✕" onClick={onClose} size={36}/>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 18px 18px' }}>{children}</div>
      </div>
    </div>, document.body)
}

// Anchored popover (bottom sheet under 640px). Children receive a close() fn.
export function Popover({ anchor, open, onClose, children, width = 260, dir, label }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  const mobile = typeof window !== 'undefined' && window.innerWidth <= 640
  useLayoutEffect(() => {
    if (!open || mobile || !anchor?.current) return
    const r = anchor.current.getBoundingClientRect()
    const rtl = dir === 'rtl'
    let left = rtl ? r.right - width : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    const below = window.innerHeight - r.bottom > 280
    setPos({ left, top: below ? r.bottom + 6 : undefined, bottom: below ? undefined : window.innerHeight - r.top + 6 })
  }, [open, anchor, width, dir, mobile])
  useEffect(() => {
    if (!open) return
    const onDown = e => { if (ref.current && !ref.current.contains(e.target) && !anchor?.current?.contains(e.target)) onClose() }
    const onKey = e => { if (e.key === 'Escape') { onClose(); anchor?.current?.focus?.() } }
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey)
    setTimeout(() => ref.current?.querySelector('[data-autofocus],input,button')?.focus(), 20)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open, onClose, anchor])
  if (!open) return null
  const body = mobile ? (
    <div className="au" dir={dir} onMouseDown={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 2700, background: 'var(--au-overlay)' }}>
      <div ref={ref} role="dialog" aria-label={label} style={{ position: 'absolute', insetInline: 0, bottom: 0, maxHeight: '85dvh', overflow: 'auto', background: T.s2, borderRadius: '16px 16px 0 0', border: `1px solid ${T.s2Line}`, padding: '8px 12px calc(14px + env(safe-area-inset-bottom))', animation: 'au-sheet .2s ease both', color: T.text }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(var(--ov),.2)', margin: '4px auto 10px' }}/>
        {typeof children === 'function' ? children(onClose) : children}
      </div>
    </div>
  ) : pos && (
    <div className="au" dir={dir}>
      <div ref={ref} role="dialog" aria-label={label} className="au-in" style={{ position: 'fixed', zIndex: 2700, left: pos.left, top: pos.top, bottom: pos.bottom, width, maxHeight: 340, overflow: 'auto', background: T.s2, border: `1px solid ${T.s2Line}`, borderRadius: 12, padding: 6, boxShadow: T.shadow3, color: T.text }}>
        {typeof children === 'function' ? children(onClose) : children}
      </div>
    </div>
  )
  return createPortal(body, document.body)
}
export function MenuItem({ children, onClick, danger, icon }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="au-hov"
      style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 8, border: 'none', background: 'transparent', color: danger ? T.redText : T.text, display: 'flex', alignItems: 'center', gap: 9, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', textAlign: 'start', minHeight: 0, minWidth: 0 }}>
      {icon && <span style={{ width: 14, display: 'inline-flex', justifyContent: 'center', color: danger ? T.redText : T.text3 }}>{icon}</span>}{children}
    </button>
  )
}
// Button + popover menu in one
export function MenuButton({ icon, label, children, dir, width = 230, size = 32 }) {
  const [open, setOpen] = useState(false)
  const a = useRef(null)
  return (
    <>
      <IconButton ref={a} icon={icon} label={label} size={size} onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}/>
      <Popover anchor={a} open={open} onClose={() => setOpen(false)} dir={dir} width={width} label={label}>
        {close => <div role="menu" onClick={close}>{children}</div>}
      </Popover>
    </>
  )
}

// ── C10 Sticky save bar ────────────────────────────────────────────────────────
export function SaveBar({ dirty, saving, error, onSave, onDiscard, t, justSaved }) {
  useEffect(() => {
    if (!dirty) return
    const k = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); onSave() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [dirty, onSave])
  if (!dirty && !justSaved) return null
  const ok = !dirty && justSaved
  return (
    <div className="au-in au-savebar" role="region" aria-live="polite"
      style={{ position: 'sticky', bottom: 12, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, flexWrap: 'wrap',
        background: ok ? 'color-mix(in srgb, #25D366 12%, var(--au-pop))' : error ? 'color-mix(in srgb, #E05252 12%, var(--au-pop))' : 'color-mix(in srgb, #F5A623 12%, var(--au-pop))', border: `1px solid ${ok ? T.greenLine : error ? 'rgba(224,82,82,.5)' : 'rgba(245,166,35,.5)'}`, boxShadow: T.shadow3 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? T.green : error ? T.red : T.amber }}/>
      <span style={{ flex: 1, minWidth: 150, fontSize: 13, fontWeight: 700, color: ok ? T.green : error ? T.redText : T.amberText }}>{ok ? t.saved : error ? t.saveError(error) : t.unsaved}</span>
      {!ok && <Button onClick={onDiscard} disabled={saving}>{t.discard}</Button>}
      {!ok && <Button variant="solid" onClick={onSave} loading={saving}>{error ? t.retry : t.saveChanges}</Button>}
    </div>
  )
}

// ── C11 Toasts (stack, actions, undo) ──────────────────────────────────────────
export function useToasts() {
  const [list, setList] = useState([])
  const push = useCallback((text, opts = {}) => {
    const id = Math.random().toString(36).slice(2)
    const tone = opts.tone || 'success'
    const dur = opts.duration ?? (tone === 'error' ? 0 : opts.action ? 6000 : 3200)
    setList(l => [...l.slice(-2), { id, text, tone, action: opts.action }])
    if (dur) setTimeout(() => setList(l => l.filter(x => x.id !== id)), dur)
    return id
  }, [])
  const dismiss = id => setList(l => l.filter(x => x.id !== id))
  const node = (
    <div aria-live="polite" style={{ position: 'fixed', zIndex: 3000, insetInlineStart: 16, bottom: 'calc(16px + var(--au-toast-lift, 0px) + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 'min(420px, calc(100vw - 32px))' }}>
      {list.map(x => {
        const c = x.tone === 'error' ? T.red : x.tone === 'info' ? T.brand : x.tone === 'warn' ? T.amber : T.green
        const Ic = x.tone === 'error' ? FaTimesCircle : x.tone === 'info' ? FaInfoCircle : x.tone === 'warn' ? FaExclamationTriangle : FaCheckCircle
        return (
          <div key={x.id} role={x.tone === 'error' ? 'alert' : 'status'} className="au-in" style={{ minWidth: 260, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--au-pop)', border: `1px solid ${c}66`, boxShadow: T.shadow3, color: T.text, fontSize: 13, fontWeight: 700 }}>
            <Ic size={14} color={c}/><span style={{ flex: 1 }}>{x.text}</span>
            {x.action && <button type="button" onClick={() => { x.action.onClick(); dismiss(x.id) }} style={{ background: 'none', border: 'none', color: T.brandText, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0, minWidth: 0, padding: 0 }}>{x.action.label}</button>}
            {x.tone === 'error' && <button type="button" aria-label="✕" onClick={() => dismiss(x.id)} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', minHeight: 0, minWidth: 0, padding: 2 }}><FaTimes size={11}/></button>}
          </div>
        )
      })}
    </div>
  )
  return [push, node]
}

// ── C16 Phone preview (WhatsApp dark) ──────────────────────────────────────────
export function PhonePreview({ text, lang = 'he', online = 'מחובר/ת', title = 'אפיק הנחל', time = '14:32', fill, highlight }) {
  return (
    <div style={{ width: fill ? '100%' : 340, maxWidth: '100%', margin: '0 auto', borderRadius: 28, border: '6px solid #1A1D29', overflow: 'hidden', background: T.wa.chat, boxShadow: '0 12px 36px rgba(0,0,0,.45)' }}>
      <div dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ height: 52, background: T.wa.header, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px' }}>
        <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#2A3942', color: T.wa.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaHome size={14}/></span>
        <div><div style={{ color: T.wa.text, fontSize: 14, fontWeight: 700 }}>{title}</div><div style={{ color: T.wa.meta, fontSize: 11 }}>{online}</div></div>
      </div>
      <div style={{ padding: 14, minHeight: fill ? 360 : 300, backgroundImage: 'radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
        <div dir={lang === 'en' ? 'ltr' : 'rtl'} lang={lang}
          style={{ position: 'relative', background: T.wa.out, color: T.wa.text, borderRadius: '10px 10px 2px 10px', padding: '7px 10px 18px', maxWidth: '88%', marginInlineStart: 'auto', fontSize: 14.2, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', boxShadow: '0 1px 1px rgba(0,0,0,.2)' }}>
          {text ? <WAText text={text} highlight={highlight}/> : <span style={{ opacity: .45 }}>…</span>}
          <span style={{ position: 'absolute', bottom: 4, insetInlineEnd: 8, fontSize: 11, color: T.wa.meta, direction: 'ltr' }}>{time} <span style={{ color: T.wa.link }}>✓✓</span></span>
        </div>
      </div>
    </div>
  )
}

// ── C24 Health · C25 CopyField ─────────────────────────────────────────────────
export const TONE = {
  ok: { c: T.green, Ic: FaCheckCircle }, warn: { c: T.amber, Ic: FaExclamationTriangle }, error: { c: T.red, Ic: FaTimesCircle },
  info: { c: T.brand, Ic: FaInfoCircle }, off: { c: T.grey, Ic: FaMinusCircle },
}
export function HealthItem({ tone, title, detail, children, toneWord }) {
  const { c, Ic } = TONE[tone] || TONE.info
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: `1px solid ${T.divider}` }}>
      <Ic size={20} color={c} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{title} <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{toneWord}</span></div>
        {detail && <div style={{ fontSize: 12.5, color: tone === 'error' ? T.redText : T.text2, marginTop: 3, lineHeight: 1.55, wordBreak: 'break-word' }}>{detail}</div>}
        {children && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{children}</div>}
      </div>
    </div>
  )
}
export function StatusPill({ tone, text, onClick }) {
  const c = TONE[tone]?.c || T.grey
  return (
    <button type="button" onClick={onClick} aria-haspopup="dialog"
      style={{ height: 30, padding: '0 12px', borderRadius: 20, display: 'inline-flex', alignItems: 'center', gap: 8, background: `${c}1A`, border: `1px solid ${c}55`, color: T.text, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', minHeight: 0, minWidth: 0, whiteSpace: 'nowrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, boxShadow: tone === 'ok' ? `0 0 0 3px ${c}33` : 'none' }}/>{text}
    </button>
  )
}
export function CopyField({ value, masked, labels }) {
  const [show, setShow] = useState(!masked)
  const [copied, setCopied] = useState(false)
  const shown = show ? value : value.replace(/key=[^&]+/, 'key=••••••')
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input readOnly value={shown} dir="ltr" onFocus={e => e.target.select()} aria-label={labels.url} style={{ ...inputStyle, height: 36, fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 12, flex: 1, minWidth: 0 }}/>
      {masked && <Button size="sm" onClick={() => setShow(s => !s)}>{show ? labels.hide : labels.show}</Button>}
      <Button size="sm" variant="brand" icon={<FaCopy size={10}/>} onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {} }}>{copied ? labels.copied : labels.copy}</Button>
    </div>
  )
}

// ── C22 progress bar ───────────────────────────────────────────────────────────
export function ProgressBar({ done, failed = 0, total, label }) {
  const p = total ? (done / total) * 100 : 0, f = total ? (failed / total) * 100 : 0
  return (
    <div role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-valuetext={label} style={{ height: 6, borderRadius: 3, background: 'rgba(var(--ov),.08)', overflow: 'hidden', display: 'flex' }}>
      <i style={{ width: `${p}%`, background: T.green, transition: 'width .3s' }}/><i style={{ width: `${f}%`, background: T.red }}/>
    </div>
  )
}
