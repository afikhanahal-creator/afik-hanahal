// Shared look of the admin analytics tabs (GA4Tab, SiteLocalTab): full-width layout, a calm Apple-like type scale
// (13px body, semibold rather than black weights, hairline separators), and one hover / focus tooltip layer for every
// [data-tip] inside `.an`. The tooltip is a fixed-position element clamped to the viewport, so it is never clipped by
// a scrolling table and never runs off the screen. Colours follow the admin theme (var(--au-*)); data colours come from
// the validated dataviz palette (#2a78d6 / #eb6834 light, #3987e5 / #d95926 dark).
import { useState, useEffect, useLayoutEffect, useRef } from 'react'

export function TipLayer({ rootRef }) {
  const [tip, setTip] = useState(null)
  const boxRef = useRef(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let timer = 0
    const target = e => { const el = e.target?.closest?.('[data-tip]'); return el && root.contains(el) && el.getAttribute('data-tip') ? el : null }
    const show = e => {
      const el = target(e); if (!el) return
      clearTimeout(timer)
      timer = setTimeout(() => setTip({ text: el.getAttribute('data-tip'), r: el.getBoundingClientRect() }), e.type === 'focusin' ? 0 : 140)
    }
    const hide = e => {
      const el = target(e); if (!el) return
      if (e.relatedTarget && el.contains(e.relatedTarget)) return
      clearTimeout(timer); setTip(null)
    }
    const off = () => { clearTimeout(timer); setTip(null) }
    root.addEventListener('pointerover', show); root.addEventListener('pointerout', hide)
    root.addEventListener('focusin', show); root.addEventListener('focusout', hide)
    window.addEventListener('scroll', off, true); window.addEventListener('resize', off)
    return () => {
      clearTimeout(timer)
      root.removeEventListener('pointerover', show); root.removeEventListener('pointerout', hide)
      root.removeEventListener('focusin', show); root.removeEventListener('focusout', hide)
      window.removeEventListener('scroll', off, true); window.removeEventListener('resize', off)
    }
  }, [rootRef])
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box || !tip) return
    const { r } = tip, w = box.offsetWidth, h = box.offsetHeight, vw = window.innerWidth
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8)
    const top = r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8
    box.style.left = `${left}px`; box.style.top = `${top}px`; box.style.opacity = '1'
  }, [tip])
  if (!tip) return null
  return <div ref={boxRef} className="an-tooltip" role="tooltip" dir="auto">{tip.text}</div>
}

// A label with a short explanation on hover / focus (and a small ⓘ so it is discoverable)
export function Lbl({ tip, children, className = '', as: Tag = 'span' }) {
  if (!tip) return <Tag className={className}>{children}</Tag>
  return <Tag className={`an-lbl ${className}`} data-tip={tip} tabIndex={0}>{children}<InfoIcon/></Tag>
}
export const InfoIcon = () => (
  <svg className="an-i" viewBox="0 0 16 16" width="12" height="12" aria-hidden focusable="false">
    <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.2"/>
    <circle cx="8" cy="5.1" r=".85" fill="currentColor"/>
    <path d="M8 7.2v4.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)

export const AN_CSS = `
.an{--an-accent:#2a78d6;--an-accent-2:#eb6834;--an-good:#1d7f45;--an-bad:#c0392b;--an-warn:#9a5b00;
  --an-line:var(--au-line,rgba(28,36,90,.1));--an-line-2:var(--au-line2,rgba(28,36,90,.18));--an-muted:var(--au-text3,#6b7480);--an-ink-2:var(--au-text2,#3a3f55);--an-ink:var(--au-text,#16202e);
  --an-surface:var(--au-s2,#fff);--an-surface-2:rgba(var(--ov,0,0,0),.035);--an-empty:rgba(var(--ov,0,0,0),.06);--an-tip-bg:#1d1d1f;--an-tip-ink:#f5f5f7;--an-seg-on:#fff;
  --an-r:12px;
  display:flex;flex-direction:column;gap:14px;width:100%;min-width:0;font-size:13px;line-height:1.45;font-variant-numeric:tabular-nums;color:var(--an-ink);-webkit-font-smoothing:antialiased}
html[data-admin-theme="dark"] .an{--an-accent:#3987e5;--an-accent-2:#d95926;--an-good:#4ade80;--an-bad:#f08a8a;--an-warn:#f5c26b;--an-tip-bg:#2c2c2e;--an-tip-ink:#f5f5f7;--an-seg-on:rgba(255,255,255,.12)}
.an *{box-sizing:border-box}
.an h3,.an h4{font-weight:600;letter-spacing:-.005em}
.an-skeleton{padding:3rem 1rem;text-align:center;color:var(--an-muted);border:1px dashed var(--an-line-2);border-radius:var(--an-r);background:var(--an-surface)}
.an-empty{color:var(--an-muted);text-align:center;padding:1.6rem 0;margin:0;font-size:12.5px}
.an-empty--sm{padding:.8rem 0;font-size:12px}
.an-muted,.an-dim{color:var(--an-muted)}
.an-error{color:var(--an-bad);font-size:12px}
.an-status{font-size:12px;font-weight:600}
.an-sub{font-size:12px;color:var(--an-muted)}

/* header */
.an-top{display:flex;justify-content:space-between;align-items:center;gap:12px 20px;flex-wrap:wrap;padding:2px 2px 4px}
.an-title{margin:0 0 2px;font-size:20px;font-weight:600;letter-spacing:-.01em}
.an-top__side{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.an-live{font-size:12px;font-weight:500;display:inline-flex;align-items:center;gap:6px;color:var(--an-ink-2);border:1px solid var(--an-line);background:var(--an-surface);border-radius:999px;padding:5px 11px;white-space:nowrap}
.an-live b{font-weight:600;color:var(--an-ink)}
.an-dot{width:7px;height:7px;border-radius:50%;background:var(--an-good);flex:none;animation:an-pulse 2s ease-in-out infinite}
@keyframes an-pulse{0%,100%{opacity:1}50%{opacity:.35}}

/* controls: Apple-style segmented control and plain buttons */
.an-seg{display:inline-flex;border-radius:9px;background:rgba(var(--ov,0,0,0),.06);padding:2px;gap:0;max-width:100%;overflow-x:auto}
.an-seg button{border:none;background:transparent;color:var(--an-ink-2);border-radius:7px;padding:5px 12px;font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;white-space:nowrap;line-height:1.35}
.an-seg button:hover{color:var(--an-ink)}
.an-seg button.is-on{background:var(--an-seg-on);color:var(--an-ink);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08),0 0 0 .5px rgba(0,0,0,.05)}
.an-seg--sm button{padding:3px 9px;font-size:11.5px}
.an-check{font-size:12px;color:var(--an-ink-2);display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}
.an-check input,.an-selfex input{accent-color:var(--an-accent);width:14px;height:14px;margin:0}
.an-csv,.an-btn{border:1px solid var(--an-line-2);border-radius:8px;background:var(--an-surface);color:var(--an-ink-2);font-size:12px;font-weight:500;cursor:pointer;padding:5px 11px;text-decoration:none;font-family:inherit;white-space:nowrap;line-height:1.35;display:inline-flex;align-items:center;gap:5px}
.an-csv:hover,.an-btn:hover{color:var(--an-accent);border-color:var(--an-accent)}
.an-btn--danger:hover{color:var(--an-bad);border-color:var(--an-bad)}
.an-search{border:1px solid var(--an-line-2);border-radius:8px;background:var(--an-surface);color:inherit;padding:5px 10px;font-size:12px;width:170px;font-family:inherit}
.an-search:focus{outline:none;border-color:var(--an-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--an-accent) 18%,transparent)}

/* cards and sections */
.an-section{display:flex;flex-direction:column;gap:10px;background:var(--an-surface);border:1px solid var(--an-line);border-radius:var(--an-r);padding:14px 16px 16px;min-width:0}
.an-h5{margin:0;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:6px;color:var(--an-ink)}
.an-h6{font-size:11.5px;font-weight:500;color:var(--an-muted);display:block;margin-bottom:4px}
.an-sect-head{display:flex;justify-content:space-between;align-items:center;gap:8px 12px;flex-wrap:wrap;min-height:28px}
.an-sect-head .an-sub{margin-inline-end:auto}
.an-sect-tools{display:flex;gap:6px;align-items:center}
.an-footnote{margin:0;font-size:11.5px;color:var(--an-muted);line-height:1.5}

/* layout: everything uses the full width; pairs side by side on wide screens */
.an-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:stretch}
.an-cols--3{grid-template-columns:repeat(3,minmax(0,1fr))}
.an-cols--chart{grid-template-columns:minmax(0,2.1fr) minmax(300px,1fr)}
.an-cols--dgh{grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,2fr)}

/* KPI tiles: every cell draws its inline-end and bottom hairline (the outer ones are clipped), so any column count —
   and a half-empty last row — keeps clean separators */
.an-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;background:var(--an-surface);border:1px solid var(--an-line);border-radius:var(--an-r);overflow:hidden}
.an-metrics--auto{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.an-metric,.an-secondary__item,.an-conv__cell{box-shadow:1px 0 0 var(--an-line),0 1px 0 var(--an-line)}
[dir=rtl] .an-metric,[dir=rtl] .an-secondary__item,[dir=rtl] .an-conv__cell{box-shadow:-1px 0 0 var(--an-line),0 1px 0 var(--an-line)}
.an-metric{background:var(--an-surface);padding:12px 16px 11px;display:flex;flex-direction:column;gap:3px;min-width:0}
.an-metric__label{font-size:12px;font-weight:500;color:var(--an-muted)}
.an-metric__value{font-size:24px;font-weight:600;line-height:1.15;letter-spacing:-.015em;color:var(--an-ink)}
.an-metric__foot{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:22px}
.an-metric__sub{font-size:11.5px;color:var(--an-muted)}
.an-spark polyline{stroke:var(--an-accent);stroke-width:1.5;stroke-linejoin:round}
.an-delta{font-size:11.5px;font-weight:600;color:var(--an-muted);direction:ltr;unicode-bidi:isolate;white-space:nowrap}
.an-delta.is-good{color:var(--an-good)}.an-delta.is-bad{color:var(--an-bad)}.an-delta--na{font-weight:400}
.an-secondary{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:0;background:color-mix(in srgb,var(--an-surface) 97%,var(--an-ink));border:1px solid var(--an-line);border-top:0;border-radius:0 0 var(--an-r) var(--an-r);overflow:hidden}
.an-kpis{display:flex;flex-direction:column;min-width:0}
.an-kpis .an-metrics{border-radius:var(--an-r) var(--an-r) 0 0}
.an-secondary__item{display:flex;flex-direction:column;gap:1px;padding:8px 16px 9px;background:color-mix(in srgb,var(--an-surface) 97%,var(--an-ink));min-width:0}
.an-secondary__item .an-lbl,.an-secondary__item>span:first-child{font-size:11.5px;color:var(--an-muted);font-weight:500}
.an-secondary__val{display:flex;align-items:baseline;gap:6px;font-size:14px;font-weight:600}

/* tooltip trigger: the label shows a small ⓘ */
.an-lbl{display:inline-flex;align-items:center;gap:4px;cursor:help;border-radius:4px}
.an-i{flex:none;color:var(--an-muted);opacity:.55;transition:opacity .15s}
.an-lbl:hover .an-i,.an-lbl:focus-visible .an-i{opacity:1;color:var(--an-accent)}
.an [data-tip]{cursor:help}
.an [data-tip]:focus-visible,.an button:focus-visible,.an a:focus-visible,.an tr:focus-visible{outline:2px solid var(--an-accent);outline-offset:2px}
.an-tooltip{position:fixed;z-index:4000;left:0;top:0;opacity:0;max-width:260px;padding:6px 10px;border-radius:8px;background:var(--an-tip-bg);color:var(--an-tip-ink);font-size:12px;font-weight:400;line-height:1.45;text-align:start;pointer-events:none;box-shadow:0 6px 20px rgba(0,0,0,.18),0 0 0 .5px rgba(255,255,255,.06);transition:opacity .12s ease-out;white-space:normal}

/* main chart */
.an-hero{display:flex;flex-direction:column;gap:10px;min-width:0}
.an-hero__bar{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.an-hero__bar-side{display:flex;align-items:center;gap:10px}
.an-hero__plot{position:relative;width:100%}
.an-hero__plot svg{width:100%;display:block}
.an-grid{stroke:var(--an-line);stroke-width:1}
.an-axis{font-size:10.5px;fill:var(--an-muted)}
.an-line{stroke:var(--an-accent);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.an-line--prev{stroke:var(--an-muted);stroke-width:1.5;stroke-dasharray:4 4;opacity:.6}
.an-area{fill:color-mix(in srgb,var(--an-accent) 8%,transparent)}
.an-cross{stroke:var(--an-muted);stroke-width:1;stroke-dasharray:3 3}
.an-dot--spike{fill:var(--an-good);stroke:var(--an-surface);stroke-width:2}
.an-dot--drop{fill:var(--an-bad);stroke:var(--an-surface);stroke-width:2}
.an-dot--last{fill:var(--an-accent);stroke:var(--an-surface);stroke-width:2}
.an-tip{position:absolute;top:4px;transform:translateX(-50%);background:var(--an-tip-bg);color:var(--an-tip-ink);border-radius:8px;padding:6px 10px;font-size:11.5px;display:flex;flex-direction:column;gap:1px;pointer-events:none;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.18)}
.an-tip__prev{opacity:.7}
.an-legend{display:flex;gap:14px;font-size:11.5px;color:var(--an-muted);align-items:center;flex-wrap:wrap}
.an-legend i{display:inline-block;width:14px;height:2px;border-radius:2px;background:var(--an-accent);margin-inline-end:5px;vertical-align:middle}
.an-legend i.is-prev{background:none;border-top:1.5px dashed var(--an-muted);height:0}
.an-anom-note{margin:0;font-size:11.5px;color:var(--an-warn)}

/* insights: neutral rows, a small status dot carries the tone */
.an-insights{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.an-insights li{display:flex;gap:10px;align-items:baseline;padding:9px 0;font-size:12.5px;line-height:1.55;color:var(--an-ink-2);border-bottom:1px solid var(--an-line)}
.an-insights li:last-child{border-bottom:0}
.an-insights li::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--an-accent);flex:none;transform:translateY(-1px)}
.an-insights li.is-good::before{background:var(--an-good)}.an-insights li.is-bad::before{background:var(--an-bad)}.an-insights li.is-warn::before{background:var(--an-warn)}

/* tables */
.an-scroll{overflow-x:auto;margin:0 -4px;padding:0 4px}
.an-table{width:100%;border-collapse:collapse;font-size:12.5px}
.an-table thead th{text-align:start;font-size:11.5px;font-weight:500;color:var(--an-muted);padding:6px 8px;border-bottom:1px solid var(--an-line-2);white-space:nowrap}
.an-table thead th.is-num,.an-table td.is-num{text-align:end}
.an-table thead th[role=button]{cursor:pointer;user-select:none}
.an-table thead th[role=button]:hover{color:var(--an-ink)}
.an-table thead th .an-lbl{cursor:help}
.an-table td{text-align:start;padding:7px 8px;border-bottom:1px solid var(--an-line);vertical-align:middle}
.an-table td.is-num{font-weight:500;white-space:nowrap}
.an-table tbody tr:hover td{background:rgba(var(--ov,0,0,0),.03)}
.an-table tbody tr:last-child td{border-bottom:0}
.an-table--click tbody tr{cursor:pointer}
.an-table tbody tr.is-open td{background:color-mix(in srgb,var(--an-accent) 6%,transparent)}
.an-td-main{font-weight:500;max-width:420px}
.an-quality{color:var(--an-good);font-weight:600}
.an-share{display:block;height:3px;background:var(--an-empty);border-radius:99px;margin-top:5px;max-width:200px}
.an-share i{display:block;height:100%;background:var(--an-accent);border-radius:inherit}
.an-page-t{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.an-page-p{display:block;font-size:11px;color:var(--an-muted);font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.an-ev-hint{display:block;font-size:11px;font-weight:400;margin-top:1px}
.an-drill-row>td{padding:0}
.an-drill{display:grid;grid-template-columns:auto 1fr 1fr;gap:24px;padding:12px 14px}
.an-drill--loading{display:block;color:var(--an-muted);font-size:12px}
.an-row{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--an-line)}
.an-row:last-child{border-bottom:0}
.an-row b{font-weight:600}
.an-geo{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}

/* bars (devices, sources, new vs returning) */
.an-bars{display:flex;flex-direction:column;gap:10px}
.an-bar__head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12.5px;margin-bottom:4px}
.an-bar__head b{font-weight:600}
.an-bar__head span.an-dim{font-size:11.5px}
.an-bar__track{height:6px;background:var(--an-empty);border-radius:99px;overflow:hidden}
.an-bar__track i{display:block;height:100%;background:var(--an-accent);border-radius:99px}
.an-split{display:flex;height:8px;gap:2px;margin-top:2px}
.an-split>i{display:block;height:100%;border-radius:4px}.an-split>i.a{background:var(--an-accent)}.an-split>i.b{background:var(--an-accent-2)}
.an-split__legend{display:flex;gap:16px;font-size:12px;margin-top:6px;color:var(--an-muted)}
.an-split__legend b{display:inline-block;width:8px;height:8px;border-radius:2px;margin-inline-end:5px}.an-split__legend b.a{background:var(--an-accent)}.an-split__legend b.b{background:var(--an-accent-2)}

/* heat map */
.an-heat{display:grid;grid-template-columns:30px repeat(24,minmax(14px,1fr));gap:2px;min-width:520px}
.an-heat i{display:block;height:20px;border-radius:3px}
.an-heat__h{font-size:10px;color:var(--an-muted);text-align:center}
.an-heat__d{font-size:10.5px;color:var(--an-muted);align-self:center}
.an-heat__legend{display:flex;align-items:center;gap:3px;font-size:11px;color:var(--an-muted)}
.an-heat__legend i{width:14px;height:8px;border-radius:2px;display:inline-block}

/* live panel */
.an-live-panel{background:var(--an-surface);border:1px solid var(--an-line);border-radius:var(--an-r);padding:14px 16px 16px}
.an-live-panel__head{display:flex;justify-content:space-between;align-items:center;gap:8px 16px;flex-wrap:wrap;margin-bottom:12px}
.an-live-panel__head h3{margin:0;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
.an-live-panel__grid{display:grid;grid-template-columns:minmax(200px,.8fr) minmax(0,1.2fr) minmax(0,1.2fr);gap:12px;align-items:stretch}
.an-live-now{display:flex;flex-direction:column;gap:4px;padding:12px 14px;border:1px solid var(--an-line);border-radius:10px;min-width:0}
.an-live-now__num{font-size:28px;font-weight:600;line-height:1.1;letter-spacing:-.015em}
.an-live-now__lbl{font-size:12px;color:var(--an-muted)}
.an-live-now__foot{font-size:11.5px;color:var(--an-muted)}
.an-live-spark{display:flex;align-items:flex-end;gap:2px;height:30px;width:100%;margin:6px 0 2px;direction:ltr}
.an-live-spark i{flex:1;background:var(--an-accent);border-radius:2px 2px 0 0;min-height:2px;opacity:.85}
.an-live-spark i.is-empty{background:var(--an-empty);opacity:1}
.an-live-list{border:1px solid var(--an-line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;min-width:0}
.an-live-list h4{margin:0 0 6px;font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:6px}
.an-live-list ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.an-live-list li{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12.5px;padding:5px 0;border-bottom:1px solid var(--an-line)}
.an-live-list li:last-child{border-bottom:none}
.an-live-list__name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.an-live-list li b{font-weight:600;flex:none}
.an-live-badge{font-size:10.5px;font-weight:500;color:var(--an-muted);background:var(--an-empty);border-radius:999px;padding:1px 7px}
.an-live-note{margin:6px 0 0;font-size:11px;line-height:1.5;color:var(--an-muted)}
.an-selfex{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--an-ink-2);cursor:pointer;white-space:nowrap}

/* contacts */
.an-conv__grid{display:grid;grid-template-columns:minmax(220px,1.1fr) repeat(4,minmax(0,1fr));gap:0;background:var(--an-surface);border:1px solid var(--an-line);border-radius:10px;overflow:hidden}
.an-conv__cell{background:var(--an-surface);padding:12px 14px;display:flex;flex-direction:column;gap:3px;min-width:0}
.an-conv__cell--big{background:color-mix(in srgb,var(--an-surface) 95%,var(--an-accent))}
.an-conv__value{font-size:22px;font-weight:600;line-height:1.15;letter-spacing:-.015em;display:flex;align-items:baseline;gap:8px}
.an-conv__cell--big .an-conv__value{font-size:26px}

/* awaiting data / setup */
.an-await{text-align:center;padding:2.4rem 1.5rem;background:var(--an-surface);border:1px dashed var(--an-line-2);border-radius:var(--an-r);display:flex;flex-direction:column;align-items:center;gap:6px}
.an-await__badge{font-size:11.5px;font-weight:500;color:var(--an-good);border:1px solid var(--an-line-2);border-radius:999px;padding:3px 10px}
.an-await h4{margin:4px 0 0;font-size:15px}.an-await p{margin:0;max-width:56ch;font-size:12.5px;line-height:1.6;color:var(--an-muted)}
.an-setup{max-width:780px;display:flex;flex-direction:column;gap:10px;background:var(--an-surface);border:1px solid var(--an-line);border-radius:var(--an-r);padding:18px 20px}
.an-setup h3{margin:0;font-size:16px}.an-setup h4{margin:6px 0 0;font-size:13px}
.an-steps{margin:0;padding-inline-start:1.2rem;display:flex;flex-direction:column;gap:6px;font-size:12.5px;line-height:1.6}
.an-steps a{color:var(--an-accent);font-weight:500}
.an-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.an-inline input{border:1px solid var(--an-line-2);border-radius:8px;padding:6px 10px;font-size:12.5px;background:var(--an-surface);color:inherit;min-width:220px;font-family:inherit}
.an-inline button{background:var(--an-accent);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12.5px;font-weight:500;cursor:pointer;font-family:inherit}
.an-settings{background:var(--an-surface);border:1px solid var(--an-line);border-radius:var(--an-r);padding:10px 16px}
.an-settings summary{font-size:12px;font-weight:500;color:var(--an-muted);cursor:pointer}
.an-settings[open] summary{margin-bottom:10px}

/* external links (site tab) */
.an-links{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
.an-link{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border:1px solid var(--an-line);border-radius:10px;text-decoration:none;color:inherit;min-width:0;transition:border-color .15s,background .15s}
.an-link:hover{border-color:var(--an-accent);background:rgba(var(--ov,0,0,0),.02)}
.an-link b{font-size:12.5px;font-weight:600}
.an-link span{font-size:11px;color:var(--an-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.an-bars7{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;align-items:end;height:150px;padding-top:16px}
.an-bars7__col{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px;height:100%;min-width:0}
.an-bars7__bar{width:100%;max-width:56px;background:var(--an-accent);border-radius:4px 4px 0 0;min-height:2px;opacity:.85}
.an-bars7__col.is-today .an-bars7__bar{opacity:1}
.an-bars7__v{font-size:11.5px;font-weight:600}
.an-bars7__l{font-size:11px;color:var(--an-muted)}
.an-bars7__col.is-today .an-bars7__l{color:var(--an-ink);font-weight:600}

@media (max-width:1280px){.an-cols--chart{grid-template-columns:minmax(0,1fr)}.an-secondary>:nth-child(7){grid-column:span 2}.an-cols--dgh{grid-template-columns:repeat(2,minmax(0,1fr))}.an-cols--dgh>:nth-child(3){grid-column:1/-1}.an-conv__grid{grid-template-columns:repeat(4,minmax(0,1fr))}.an-conv__cell--big{grid-column:1/-1}.an-secondary{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media (max-width:1100px){.an-cols,.an-cols--3,.an-cols--dgh{grid-template-columns:minmax(0,1fr)}.an-metrics:not(.an-metrics--auto)>:nth-child(5){grid-column:span 2}.an-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.an-metrics--auto{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.an-drill{grid-template-columns:1fr 1fr}.an-live-panel__grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.an-live-now{grid-column:1/-1}}
@media (max-width:680px){.an{gap:10px}.an-metrics>:last-child:nth-child(odd),.an-secondary>:last-child:nth-child(odd){grid-column:1/-1}.an-title{font-size:18px}.an-metrics,.an-metrics--auto{grid-template-columns:repeat(2,minmax(0,1fr))}.an-metric{padding:10px 12px}.an-metric__value{font-size:20px}.an-secondary{grid-template-columns:repeat(2,minmax(0,1fr))}.an-secondary__item{padding:7px 12px}.an-conv__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.an-section{padding:12px 12px 14px}.an-table{min-width:460px;font-size:12px}.an-geo{grid-template-columns:1fr}.an-drill{grid-template-columns:1fr;gap:12px}.an-search{width:120px}.an-top__side{width:100%}.an-live-panel__grid{grid-template-columns:minmax(0,1fr)}.an-bars7{height:120px;gap:6px}}
`
