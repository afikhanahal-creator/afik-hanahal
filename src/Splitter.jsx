// A draggable edge between two panes, like an editor's (the Lead Center's list / conversation / details, the header,
// the composer). Drag with the mouse or a finger (pointer capture), arrows (Shift = bigger steps), Home / End,
// double-click or Enter to reset. While dragging only `apply(v)` runs (a DOM style, no React render per pixel); the
// value is committed when the drag ends.
//   axis  'x' (a vertical line, sizes a width) | 'y' (a horizontal line, sizes a height)
//   grows +1 when moving right / down makes the pane bigger, -1 when moving left / up does
import { useRef } from 'react'

export const SPLITTER_CSS = `
  .spl{position:relative;z-index:6;touch-action:none;outline:none;flex-shrink:0}
  .spl.x{flex-basis:8px;margin-inline:-4px;cursor:col-resize}
  .spl.y{flex-basis:8px;margin-block:-4px;cursor:row-resize}
  .spl.gap.x{flex-basis:14px;margin-inline:0}
  .spl.gap.y{flex-basis:12px;margin-block:0}
  .spl::before{content:'';position:absolute;border-radius:2px;background:transparent;transition:background .15s}
  .spl.x::before{top:0;bottom:0;left:50%;width:2px;transform:translateX(-50%)}
  .spl.y::before{left:0;right:0;top:50%;height:2px;transform:translateY(-50%)}
  .spl::after{content:'';position:absolute;top:50%;left:50%;border-radius:3px;background:rgba(var(--ink),.22);opacity:0;transition:opacity .15s}
  .spl.x::after{width:4px;height:30px;transform:translate(-50%,-50%)}
  .spl.y::after{width:34px;height:4px;transform:translate(-50%,-50%)}
  .spl:hover::before,.spl:focus-visible::before,.spl.on::before{background:rgba(var(--brand-rgb),.6)}
  .spl:hover::after,.spl:focus-visible::after,.spl.gap::after{opacity:1}
  body.spl-x,body.spl-x *{cursor:col-resize!important;user-select:none!important}
  body.spl-y,body.spl-y *{cursor:row-resize!important;user-select:none!important}
  body.spl-x iframe,body.spl-y iframe{pointer-events:none}
`

export default function Splitter({ axis = 'x', get, apply, commit, reset, min = 0, max, grows = 1, label, gap = false, className = '', style }) {
  const drag = useRef(null)
  const hi = () => (typeof max === 'function' ? max() : max ?? Infinity)
  const clamp = v => Math.round(Math.min(hi(), Math.max(min, v)))
  const pos = e => (axis === 'y' ? e.clientY : e.clientX)
  const end = e => {
    if (!drag.current) return
    const v = drag.current.last
    drag.current = null
    document.body.classList.remove(`spl-${axis}`)
    e.currentTarget.classList.remove('on')
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    commit(v)
  }
  const key = e => {
    const step = e.shiftKey ? 64 : 16
    const keys = axis === 'y' ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 }
    if (keys[e.key]) { e.preventDefault(); const v = clamp(get() + keys[e.key] * grows * step); apply(v); commit(v) }
    else if (e.key === 'Home') { e.preventDefault(); apply(min); commit(min) }
    else if (e.key === 'End') { e.preventDefault(); const v = clamp(Infinity); apply(v); commit(v) }
    else if (e.key === 'Enter') { e.preventDefault(); reset() }
  }
  const now = (() => { try { return Math.round(get()) } catch { return undefined } })()
  return (
    <div role="separator" aria-orientation={axis === 'y' ? 'horizontal' : 'vertical'} aria-label={label} title={label}
      aria-valuenow={now} aria-valuemin={min} tabIndex={0} className={`spl ${axis}${gap ? ' gap' : ''} ${className}`} style={style}
      onPointerDown={e => {
        if (e.button !== 0) return
        e.preventDefault()
        const v = clamp(get())
        drag.current = { p: pos(e), v, last: v }
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.classList.add('on')
        document.body.classList.add(`spl-${axis}`)
      }}
      onPointerMove={e => { if (!drag.current) return; const v = clamp(drag.current.v + (pos(e) - drag.current.p) * grows); drag.current.last = v; apply(v) }}
      onPointerUp={end} onPointerCancel={end} onDoubleClick={reset} onKeyDown={key}/>
  )
}
