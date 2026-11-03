// The client's signing page — /sign/<token> (noindex, no account): the document as it was sent (src/DocPreview.jsx), zoom,
// then the signature step: full name, ID number, a drawn signature (finger / mouse / typed name turned into a drawn one), the
// consent box and "אני מאשר/ת וחותם/ת" → POST sign-submit. The personal link is the verification (no one-time code since
// 2026-11-04); the time, IP and browser are recorded. After signing: a confirmation with the signed copy to download (sign-file?kind=signed). A link that expired,
// a cancelled or an already-signed document reads so in words. Mobile first, the site's light look.
import { useEffect, useRef, useState } from 'react'
import DocSheet, { DOC_CSS } from './DocPreview.jsx'
import { signTokenFromPath, validIsraeliId } from '../lib/documents.js'

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;background:#EFEBE3;color:#17172B;font-family:Rubik,Heebo,Arial,sans-serif;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
.sg{min-height:100vh;direction:rtl;display:flex;flex-direction:column}
.sg-top{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid #E1DBD0;padding:10px 16px;padding-top:max(10px,env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between;gap:10px}
.sg-brand{display:flex;gap:10px;align-items:center;min-width:0}.sg-brand img{height:34px;flex-shrink:0}
.sg-brand .m{display:none}.sg-brand b{font-size:14px;font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-brand small{display:block;color:#5E5B6E;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sg-tools{display:flex;gap:6px;align-items:center;flex-shrink:0}
.sg-dl{height:34px;border-radius:9px;border:1px solid transparent;background:transparent;color:#5E5B6E;font:inherit;font-size:13px;font-weight:500;padding:0 9px;display:inline-flex;align-items:center;gap:6px;text-decoration:none;white-space:nowrap}
.sg-dl:hover{border-color:#3F4EB0;color:#3F4EB0}.sg-dl svg{width:15px;height:15px}
.sg-zoom{display:flex;gap:4px;margin-inline-start:6px}.sg-zoom button{width:36px;height:36px;border-radius:10px;border:1px solid #D9D3C7;background:#fff;font:inherit;font-size:16px;cursor:pointer;color:#17172B}
.sg-intro{display:none}
.sg-intro-dl{display:flex;gap:4px 14px;flex-wrap:wrap;align-items:center;font-size:13px;color:#5E5B6E;margin-top:4px}.sg-intro-dl a{color:#3F4EB0;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:4px}.sg-intro-dl svg{width:14px;height:14px}
.sg-wrap{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:20px;padding:20px;max-width:1240px;width:100%;margin:0 auto;align-items:start}
.sg-doc{overflow:auto;padding:4px 0 20px}
.sg-doc-in{transform-origin:top center;margin:0 auto}
.sg-side{position:sticky;top:76px;background:#fff;border:1px solid #E1DBD0;border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:16px;box-shadow:0 6px 30px rgba(0,0,0,.06);scroll-margin-top:70px}
.sg-side h2{margin:0;font-size:19px;font-weight:600}.sg-side p{margin:0;color:#5E5B6E;font-size:14px;line-height:1.6}
.sg-step{display:flex;flex-direction:column;gap:8px}
.sg-step-h{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:600;color:#17172B}
.sg-num{width:26px;height:26px;border-radius:50%;background:#EEF0FA;color:#3F4EB0;font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.sg-num.ok{background:#E8F7EE;color:#128C4A}
.sg-f{display:flex;flex-direction:column;gap:6px}.sg-f label{font-size:13px;font-weight:600;color:#3C3A4A}
.sg-in{height:52px;border-radius:12px;border:1.5px solid #D9D3C7;background:#fff;padding:0 14px;font:inherit;font-size:16px;color:#17172B;width:100%;-webkit-appearance:none;appearance:none}
.sg-in:focus{outline:none;border-color:#3F4EB0;box-shadow:0 0 0 3px rgba(63,78,176,.18)}
.sg-btn{min-height:52px;border-radius:14px;border:none;background:#3F4EB0;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:0 16px;text-decoration:none;-webkit-tap-highlight-color:transparent}
.sg-btn:disabled{opacity:.5;cursor:not-allowed}.sg-btn.ghost{background:#fff;color:#3F4EB0;border:1.5px solid #C7CCEB}.sg-btn.sm{min-height:44px;font-size:14px;width:auto;padding:0 16px;border-radius:12px}
.sg-btn:focus-visible,.sg-dl:focus-visible{outline:3px solid rgba(63,78,176,.45);outline-offset:2px}
.sg-pad{position:relative;border:1.5px solid #CFC9BC;border-radius:14px;background:#FFFFFF;aspect-ratio:3/2;max-height:320px;min-height:200px;touch-action:none;overflow:hidden;box-shadow:inset 0 0 0 1px rgba(63,78,176,.05)}
.sg-pad.has{border-color:#9CC9AE}
.sg-pad canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair;background:transparent;touch-action:none}
.sg-pad-img{position:absolute;inset:14px 18px 50px;width:calc(100% - 36px);height:calc(100% - 64px);object-fit:contain;pointer-events:none}
.sg-pad-clear{position:absolute;top:10px;left:10px;z-index:2;height:40px;min-height:40px;border-radius:999px;border:1px solid #E1DBD0;background:#fff;color:#5E5B6E;font:inherit;font-size:13px;font-weight:600;padding:0 14px;cursor:pointer}
.sg-pad-clear:hover{color:#B42318;border-color:#F0C4C0}
.sg-full{position:fixed;inset:0;z-index:60;background:#EFEBE3;display:flex;flex-direction:column;gap:12px;padding:max(14px,env(safe-area-inset-top)) 14px max(14px,env(safe-area-inset-bottom))}
.sg-full-head{display:flex;flex-direction:column;gap:2px}.sg-full-head b{font-size:16px}.sg-full-head span{font-size:12.5px;color:#5E5B6E}
.sg-full .sg-pad{flex:1;aspect-ratio:auto;max-height:none;min-height:0;border-radius:18px;border-color:#B9B4A8}
.sg-full .sg-pad .hint b{font-size:22px;color:#8A8798}
.sg-full-acts{display:grid;grid-template-columns:1fr 2fr;gap:10px}
.sg-pad .hint{position:absolute;inset:0 0 44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;pointer-events:none;text-align:center;padding:0 16px}
.sg-pad .hint b{color:#3C3A4A;font-size:17px;font-weight:600}.sg-pad .hint span{color:#8A8798;font-size:13px}
.sg-pad .who{position:absolute;left:18px;right:18px;bottom:14px;display:flex;justify-content:space-between;font-size:12px;color:#8A8798;pointer-events:none}
.sg-pad-ok{display:inline-flex;align-items:center;gap:6px;color:#128C4A;font-size:13.5px;font-weight:600}
.sg-need{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;color:#5E5B6E}
.sg-need span{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 10px;background:#F5F1E9}
.sg-need span.ok{background:#E8F7EE;color:#0E7A3B}
.sg-pad .line{position:absolute;left:18px;right:18px;bottom:44px;border-bottom:1px solid #B9B4A8;pointer-events:none}
.sg-pad-acts{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}
.sg-chk{display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.55;cursor:pointer;padding:12px;border:1.5px solid #E1DBD0;border-radius:12px;background:#FBFAF7}
.sg-chk.on{border-color:#3F4EB0;background:#F4F5FC}
.sg-chk input{width:24px;height:24px;margin:0;accent-color:#3F4EB0;flex-shrink:0}
.sg-err{background:#FDECEC;color:#B42318;border-radius:12px;padding:11px 14px;font-size:14px;line-height:1.5}
.sg-ok{background:#E8F7EE;color:#0E7A3B;border-radius:12px;padding:11px 14px;font-size:14px;line-height:1.5}
.sg-done{text-align:center;display:flex;flex-direction:column;gap:14px;align-items:center;padding:6px 0}
.sg-done .big{width:76px;height:76px;border-radius:50%;background:#E8F7EE;color:#128C4A;display:flex;align-items:center;justify-content:center;font-size:38px}
.sg-done-dl{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}
.sg-foot{text-align:center;color:#8A8798;font-size:12px;padding:16px;line-height:1.6}
.sg-signers{display:flex;flex-direction:column;gap:4px;font-size:13.5px;background:#F5F1E9;border-radius:12px;padding:10px 12px}.sg-signers span{color:#5E5B6E}.sg-signers span.cur{color:#3F4EB0;font-weight:700}.sg-signers span.ok{color:#1E8E4E}
.sg-blocked{max-width:560px;margin:40px auto;background:#fff;border-radius:16px;padding:28px;text-align:center;border:1px solid #E1DBD0}
.sg-mob-cta{display:none}
.sg-sec{font-size:12px;color:#8A8798;display:flex;gap:6px;align-items:center;justify-content:center}
@media (max-width:900px){
  .sg-top{padding:9px 14px;padding-top:max(9px,env(safe-area-inset-top));justify-content:flex-start}.sg-brand img{height:30px}.sg-brand b{font-size:14px}.sg-brand small{font-size:11.5px}
  .sg-brand .d{display:none}.sg-brand .m{display:block}
  .sg-tools{display:none}
  .sg-zoom{display:none}
  .sg-intro{display:flex;flex-direction:column;gap:4px;margin:14px 14px 0;padding:0 2px 12px;border-bottom:1px solid #DDD6C9}
  .sg-intro small{font-size:11.5px;letter-spacing:.04em;color:#8A8798;font-weight:600}
  .sg-intro h1{margin:0;font-size:18px;font-weight:600;line-height:1.35}.sg-intro p{margin:0;color:#5E5B6E;font-size:13.5px;line-height:1.6}
  .sg-wrap{grid-template-columns:1fr;padding:12px 0 0;gap:12px}
  .sg-doc{padding:0 12px}.sg-doc-in{transform:none!important;width:100%!important}
  .sg-doc .dsh{border-radius:16px;border:1px solid #E1DBD0}
  .sg-side{position:static;border-radius:22px 22px 0 0;padding:20px 16px;padding-bottom:calc(24px + env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,.08);border-inline:none;border-bottom:none}
  .sg-pad{aspect-ratio:4/3;max-height:340px}
  .sg-mob-cta{display:flex;position:fixed;bottom:0;inset-inline:0;z-index:6;padding:10px 14px;padding-bottom:calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.97);border-top:1px solid #E1DBD0;transition:transform .2s ease}
  .sg-mob-cta.hide{transform:translateY(110%)}
  .sg-foot{padding-bottom:calc(90px + env(safe-area-inset-bottom))}
}
@media (max-width:380px){.sg-done-dl{grid-template-columns:1fr}}
`
const api = (a, q = '', opts = {}) => fetch(`/api/meta/${a}${q}`, { signal: AbortSignal.timeout(30000), ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } }).then(async r => { const d = await r.json().catch(() => ({})); return { status: r.status, ...d } })

const DlIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
const LockIcon = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>

// A signing pad like DocuSign / Adobe Sign: a roomy, almost square frame; a smooth pen whose width follows the speed of the
// hand; on a touch screen (a phone, a tablet) a tap opens the pad on the whole screen (turn the phone sideways for a long
// signature) with "ניקוי" and "אישור החתימה", and the signature then sits in the frame; on a desktop the frame itself is the pad.
// A typed signature stays as a fallback. The image handed up is a PNG with a transparent background.
function usePen(ref) {
  const st = useRef({ drawing: false, pts: [], w: 2.4, has: false })
  const ctx = () => { const c = ref.current; return c ? { c, k: c.getContext('2d') } : null }
  const setup = () => {
    const o = ctx(); if (!o) return
    const r = o.c.getBoundingClientRect(); const dpr = Math.min(3, window.devicePixelRatio || 1)
    o.c.width = Math.round(r.width * dpr); o.c.height = Math.round(r.height * dpr); o.k.setTransform(dpr, 0, 0, dpr, 0, 0)
    o.k.lineCap = 'round'; o.k.lineJoin = 'round'; o.k.strokeStyle = '#1A2A6C'; o.k.fillStyle = '#1A2A6C'
  }
  const pos = e => { const r = ref.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp || performance.now() } }
  const seg = (a, b, w) => { const o = ctx(); o.k.lineWidth = w; o.k.beginPath(); o.k.moveTo(a.x, a.y); o.k.quadraticCurveTo(b.cx, b.cy, b.x, b.y); o.k.stroke() }
  const down = e => {
    if (e.button != null && e.button !== 0) return
    e.preventDefault(); ref.current.setPointerCapture?.(e.pointerId)
    const p = pos(e); st.current.drawing = true; st.current.pts = [p]; st.current.w = 2.4
    const o = ctx(); o.k.beginPath(); o.k.arc(p.x, p.y, 1.2, 0, Math.PI * 2); o.k.fill()
  }
  const move = e => {
    const s = st.current; if (!s.drawing) return
    e.preventDefault()
    const evs = typeof e.nativeEvent?.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [e]
    for (const ev of evs.length ? evs : [e]) {
      const p = pos(ev), prev = s.pts[s.pts.length - 1]
      const dist = Math.hypot(p.x - prev.x, p.y - prev.y); if (dist < 0.8) continue
      const dt = Math.max(1, p.t - prev.t), speed = dist / dt   // px per ms
      const target = Math.max(1.5, Math.min(3.4, 3.4 - speed * 1.1))
      s.w = s.w * 0.75 + target * 0.25
      // a quadratic curve from the last midpoint to the new one, the previous point as the control: no corners
      if (s.pts.length >= 2) { const q = s.pts[s.pts.length - 2]; const m1 = { x: (q.x + prev.x) / 2, y: (q.y + prev.y) / 2 }, m2 = { x: (prev.x + p.x) / 2, y: (prev.y + p.y) / 2 }; seg(m1, { cx: prev.x, cy: prev.y, x: m2.x, y: m2.y }, s.w) }
      else seg(prev, { cx: prev.x, cy: prev.y, x: p.x, y: p.y }, s.w)
      s.pts.push(p); s.has = true
    }
  }
  const up = () => { const s = st.current; if (!s.drawing) return; s.drawing = false; if (s.pts.length >= 2) { const a = s.pts[s.pts.length - 2], b = s.pts[s.pts.length - 1]; seg({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, { cx: b.x, cy: b.y, x: b.x, y: b.y }, s.w) } s.pts = [] }
  const clear = () => { const o = ctx(); if (!o) return; o.k.save(); o.k.setTransform(1, 0, 0, 1, 0, 0); o.k.clearRect(0, 0, o.c.width, o.c.height); o.k.restore(); st.current.has = false }
  const typed = name => { const o = ctx(); if (!o || !name) return; clear(); const r = o.c.getBoundingClientRect(); o.k.save(); o.k.font = `italic 600 ${Math.min(48, Math.max(26, r.width / Math.max(6, name.length) * 1.4))}px "Rubik", "Heebo", cursive`; o.k.textAlign = 'center'; o.k.textBaseline = 'middle'; o.k.direction = 'rtl'; o.k.fillText(name, r.width / 2, r.height / 2 - 14); o.k.restore(); st.current.has = true }
  const has = () => st.current.has
  const data = () => (ref.current && st.current.has ? ref.current.toDataURL('image/png') : '')
  return { setup, down, move, up, clear, typed, has, data }
}

function SignaturePad({ onChange, name }) {
  const inlineRef = useRef(null), fullRef = useRef(null)
  const inline = usePen(inlineRef), full = usePen(fullRef)
  const [empty, setEmpty] = useState(true)
  const [open, setOpen] = useState(false)       // the whole-screen pad (touch screens)
  const [fullInk, setFullInk] = useState(false)
  const [preview, setPreview] = useState('')     // a signature drawn on the whole screen, shown in the frame
  const touch = useRef(typeof matchMedia === 'function' && matchMedia('(hover: none)').matches).current
  useEffect(() => {
    inline.setup()
    // a phone turned sideways resizes the frame: set it up again while it is still empty (a drawn signature is kept)
    const ro = new ResizeObserver(() => { if (!inline.has()) inline.setup() })
    ro.observe(inlineRef.current); return () => ro.disconnect()
  }, []) // eslint-disable-line
  useEffect(() => {
    if (!open) return
    full.setup(); setFullInk(false)
    const ro = new ResizeObserver(() => { if (!full.has()) full.setup() })
    ro.observe(fullRef.current)
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { ro.disconnect(); document.body.style.overflow = prev }
  }, [open]) // eslint-disable-line
  const done = url => { setEmpty(!url); onChange(url) }
  const inlineDown = e => { if (touch) { if (empty) { e.preventDefault(); setOpen(true) } return } inline.down(e) }
  const inlineUp = () => { if (touch) return; inline.up(); if (inline.has()) done(inline.data()) }
  const clear = () => { inline.clear(); full.clear(); setPreview(''); done('') }
  const typed = () => { if (!name) return; setPreview(''); inline.typed(name); done(inline.data()) }
  const confirmFull = () => { const url = full.data(); if (!url) return; setPreview(url); setOpen(false); done(url) }
  const dateHe = new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })
  return (
    <div className="sg-f">
      <div className={`sg-pad${empty ? '' : ' has'}`}>
        <canvas ref={inlineRef} onPointerDown={inlineDown} onPointerMove={touch ? undefined : inline.move} onPointerUp={inlineUp} onPointerCancel={inlineUp} onPointerLeave={inlineUp}
          role="button" tabIndex={0} aria-label={touch ? 'תיבת חתימה — הקישו כדי לחתום' : 'תיבת חתימה — חתמו כאן בעכבר'} onKeyDown={e => { if (touch && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setOpen(true) } }}
          style={preview ? { visibility: 'hidden' } : undefined}/>
        {preview && <img className="sg-pad-img" src={preview} alt="החתימה שלכם"/>}
        {empty && <div className="hint"><b>{touch ? 'הקישו כאן כדי לחתום' : 'חתמו כאן'}</b><span>{touch ? 'הפד ייפתח על כל המסך' : 'ציירו את החתימה בעכבר, בתוך המסגרת'}</span></div>}
        {!empty && <button type="button" className="sg-pad-clear" onClick={clear} aria-label="ניקוי החתימה">ניקוי</button>}
        <div className="line"/><div className="who"><span>{name ? `חתימת ${name}` : 'החתימה שלכם'}</span><span>{dateHe}</span></div>
      </div>
      <div className="sg-pad-acts">{empty ? <button type="button" className="sg-btn ghost sm" onClick={typed} disabled={!name}>במקום לצייר: חתימה מהשם</button> : <span className="sg-pad-ok">החתימה נקלטה</span>}{!empty && <button type="button" className="sg-btn ghost sm" onClick={clear}>חתימה מחדש</button>}</div>
      {open && (
        <div className="sg-full" role="dialog" aria-modal="true" aria-label="חתימה">
          <div className="sg-full-head"><b>{name ? `חתימת ${name}` : 'החתימה שלכם'}</b><span>ציירו את החתימה באצבע · אפשר לסובב את המכשיר לרוחב</span></div>
          <div className={`sg-pad${fullInk ? ' has' : ''}`}>
            <canvas ref={fullRef} onPointerDown={e => { full.down(e); setFullInk(true) }} onPointerMove={full.move} onPointerUp={full.up} onPointerCancel={full.up} role="img" aria-label="תיבת חתימה"/>
            {!fullInk && <div className="hint"><b>חתמו כאן</b></div>}
            {fullInk && <button type="button" className="sg-pad-clear" onClick={() => { full.clear(); setFullInk(false) }}>ניקוי</button>}
            <div className="line"/><div className="who"><span>{name ? `חתימת ${name}` : ''}</span><span>{dateHe}</span></div>
          </div>
          <div className="sg-full-acts"><button type="button" className="sg-btn ghost" onClick={() => setOpen(false)}>ביטול</button><button type="button" className="sg-btn" disabled={!fullInk} onClick={confirmFull}>אישור החתימה</button></div>
        </div>
      )}
    </div>
  )
}

export default function SignPage() {
  const token = signTokenFromPath(window.location.pathname)
  const [st, setSt] = useState({ loading: true })
  const [zoom, setZoom] = useState(1)
  const [form, setForm] = useState({ name: '', idNumber: '', address: '', agree: false, signature: '' })
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const [sideSeen, setSideSeen] = useState(false)
  const docRef = useRef(null), sideRef = useRef(null)
  const [scale, setScale] = useState(1)
  useEffect(() => { document.title = 'חתימה על מסמך · אפיק הנחל' }, [])
  useEffect(() => {
    if (!token) { setSt({ blocked: 'הקישור לא תקין' }); return }
    api('sign-open', `?t=${encodeURIComponent(token)}`).then(r => {
      if (r.error) setSt({ blocked: r.error })
      else { setSt({ view: r.view, blocked: r.blocked, signed: r.signed, expired: r.expired }); setForm(f => ({ ...f, name: r.view?.signer?.name || r.view?.client?.name || '', idNumber: r.view?.signer?.index ? '' : r.view?.client?.idNumber || '', address: r.view?.signer?.index ? '' : r.view?.client?.address || '' })) }
    }).catch(() => setSt({ blocked: 'לא הצלחנו לטעון את המסמך. נסו שוב בעוד רגע.' }))
  }, [token])
  useEffect(() => {
    const el = docRef.current; if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, (el.clientWidth - 8) / 794)))
    ro.observe(el); return () => ro.disconnect()
  }, [st.view])
  // the bottom "to the signature" bar hides once the signature panel is on screen
  useEffect(() => {
    const el = sideRef.current; if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setSideSeen(e.isIntersecting), { rootMargin: '0px 0px -30% 0px' })
    io.observe(el); return () => io.disconnect()
  }, [st.view])
  const submit = async () => {
    setErr('')
    if (form.name.trim().length < 2) { setErr('כתבו את שמכם המלא'); return }
    if (needId && form.idNumber.length < 5) { setErr('כתבו את מספר תעודת הזהות'); return }
    if (form.idNumber && !validIsraeliId(form.idNumber)) { setErr('מספר תעודת הזהות לא תקין, בדקו את הספרות'); return }
    if (needAddr && form.address.trim().length < 4) { setErr('כתבו את כתובת המגורים (רחוב, מספר ועיר)'); return }
    if (!form.signature) { setErr('ציירו את החתימה בתיבה'); return }
    if (!form.agree) { setErr('צריך לאשר שקראתם את המסמך ומסכימים לחתום עליו'); return }
    setBusy('sign')
    try {
      const r = await api('sign-submit', '', { method: 'POST', body: JSON.stringify({ t: token, name: form.name, idNumber: form.idNumber, address: form.address, agree: form.agree, signature: form.signature }), signal: AbortSignal.timeout(60000) })
      if (r.error) { setErr(r.error); return }
      setDone(r); setSt(s => ({ ...s, view: r.view }))
      setTimeout(() => sideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } catch { setErr('החתימה לא נשלחה. בדקו את החיבור ונסו שוב.') } finally { setBusy('') }
  }
  const v = st.view
  const isSigned = !!(done && !done.partial) || !!st.signed || v?.status === 'signed'
  const file = (kind, dl = true) => `/api/meta/sign-file?t=${encodeURIComponent(token)}&kind=${kind}${dl ? '&dl=1' : ''}`
  const pdfKind = isSigned ? 'signed' : 'original'
  const sgI = v?.signer
  // the client's ID and address are part of a brokerage order (the regulations): asked when the document lacks them
  const isClientSigner = !sgI?.index
  const needId = isClientSigner && !v?.client?.idNumber
  const needAddr = isClientSigner && !v?.client?.address
  const idOk = form.idNumber ? validIsraeliId(form.idNumber) : !needId
  const first = String(form.name || v?.client?.name || '').trim().split(/\s+/)[0] || ''
  const downloads = (
    <div className="sg-done-dl">
      <a className="sg-btn" href={file(pdfKind)} download>הורדת PDF{isSigned ? ' חתום' : ''}</a>
      <a className="sg-btn ghost" href={file('docx')} download>הורדת Word</a>
    </div>
  )
  const side = done?.partial ? (
    <div className="sg-done" aria-live="polite">
      <div className="big">✓</div>
      <h2>החתימה שלכם נקלטה</h2>
      <p>תודה! המסמך עובר עכשיו לחתימת {done.next?.name || 'החותם הבא'}{done.next?.sent ? ', הקישור נשלח אליהם.' : '.'} אחרי שכל החותמים יחתמו, כולם יקבלו עותק חתום.</p>
      <p style={{ fontSize: 12.5 }}>מספר מסמך <span dir="ltr">{v?.number}</span></p>
    </div>
  ) : isSigned ? (
    <div className="sg-done" aria-live="polite">
      <div className="big">✓</div>
      <h2>המסמך נחתם בהצלחה</h2>
      <p>{v?.client?.emailMasked ? `עותק חתום נשלח אליכם לכתובת ${v.client.emailMasked}.` : 'עותק חתום נשלח אליכם בוואטסאפ.'} אפשר גם לשמור אותו כאן:</p>
      {downloads}
      <p style={{ fontSize: 12.5 }}>מספר מסמך <span dir="ltr">{v?.number}</span>{v?.signature?.at ? <> · נחתם <span dir="ltr">{new Date(v.signature.at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></> : ''}</p>
    </div>
  ) : st.blocked ? (
    <div className="sg-done"><h2>{st.expired ? 'תוקף הקישור פג' : 'אי אפשר לחתום על המסמך'}</h2><p>{st.blocked}</p><a className="sg-btn ghost" href="https://wa.me/972559811814">לפנות למשרד בוואטסאפ</a></div>
  ) : (
    <>
      <div><h2>חתימה על המסמך</h2><p style={{ marginTop: 4 }}>יש לקרוא את המסמך, למלא את הפרטים ולחתום בתיבה.</p></div>
      {sgI?.total > 1 && <div className="sg-signers" aria-label="סדר החותמים"><b>חותם {sgI.index + 1} מתוך {sgI.total}: {sgI.name}</b>{sgI.list.map((x, i) => <span key={i} className={x.status === 'signed' ? 'ok' : i === sgI.index ? 'cur' : ''}>{x.status === 'signed' ? '✓ ' : ''}{x.name}</span>)}</div>}
      <section className="sg-step" aria-labelledby="st2">
        <div className="sg-step-h" id="st2"><span className="sg-num">1</span>פרטי החותם</div>
        <div className="sg-f"><label htmlFor="sg-name">שם מלא</label><input id="sg-name" className="sg-in" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoComplete="name" enterKeyHint="next"/></div>
        <div className="sg-f"><label htmlFor="sg-id">תעודת זהות{needId ? '' : ' (לא חובה)'}</label><input id="sg-id" className="sg-in" dir="ltr" inputMode="numeric" pattern="[0-9]*" maxLength={9} autoComplete="off" value={form.idNumber} onChange={e => setForm(f => ({ ...f, idNumber: e.target.value.replace(/\D/g, '').slice(0, 9) }))} style={{ textAlign: 'right' }}/></div>
        {(needAddr || form.address) && <div className="sg-f"><label htmlFor="sg-addr">כתובת מגורים{needAddr ? '' : ' (לא חובה)'}</label><input id="sg-addr" className="sg-in" placeholder="רחוב ומספר, עיר" autoComplete="street-address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}/></div>}
      </section>
      <section className="sg-step" aria-labelledby="st3" id="sign-pad">
        <div className="sg-step-h" id="st3"><span className="sg-num">2</span>חתימה</div>
        <p style={{ margin: '-2px 0 2px', fontSize: 13.5 }}>החתימה תופיע במסמך במקום המסומן "הלקוח", יחד עם השם והתאריך.</p>
        <SignaturePad name={form.name} onChange={s => setForm(f => ({ ...f, signature: s }))}/>
      </section>
      <label className={`sg-chk${form.agree ? ' on' : ''}`}><input type="checkbox" checked={form.agree} onChange={e => setForm(f => ({ ...f, agree: e.target.checked }))}/><span>קראתי את המסמך, הבנתי את תוכנו ואני מסכים/ה לחתום עליו בחתימה אלקטרונית. מועד החתימה וכתובת ה-IP יתועדו כחלק מהמסמך.</span></label>
      {err && <div className="sg-err" role="alert">{err}</div>}
      {!(form.name.trim().length > 1 && idOk && (!needAddr || form.address.trim().length > 3) && form.signature && form.agree) && <div className="sg-need" aria-live="polite"><b style={{ fontWeight: 600 }}>לפני החתימה:</b>
        <span className={form.name.trim().length > 1 ? 'ok' : ''}>{form.name.trim().length > 1 ? '✓' : '○'} שם מלא</span>
        {needId && <span className={idOk && form.idNumber ? 'ok' : ''}>{idOk && form.idNumber ? '✓' : '○'} ת.ז.</span>}
        {needAddr && <span className={form.address.trim().length > 3 ? 'ok' : ''}>{form.address.trim().length > 3 ? '✓' : '○'} כתובת</span>}
        <span className={form.signature ? 'ok' : ''}>{form.signature ? '✓' : '○'} חתימה</span>
        <span className={form.agree ? 'ok' : ''}>{form.agree ? '✓' : '○'} אישור</span>
      </div>}
      <button type="button" className="sg-btn" disabled={busy === 'sign'} onClick={submit}>{busy === 'sign' ? 'חותם…' : 'אני מאשר/ת וחותם/ת על המסמך'}</button>
      <div className="sg-sec"><LockIcon/> קישור אישי ומאובטח · החתימה מתועדת ונשמרת במסמך</div>
    </>
  )
  return (
    <div className="sg">
      <style>{CSS}{DOC_CSS}</style>
      <header className="sg-top">
        <div className="sg-brand"><img src="/logo-black.svg" alt="אפיק הנחל"/><div style={{ minWidth: 0 }}><div className="d"><b>{v?.title || 'מסמך לחתימה'}</b><small>אפיק הנחל{v?.number ? <> · <span dir="ltr">{v.number}</span></> : null}</small></div><div className="m"><b>אפיק הנחל</b><small>יזום, שיווק ותיווך נדל"ן</small></div></div></div>
        {v && <div className="sg-tools">
          <a className="sg-dl" href={file(pdfKind)} download data-short="PDF" aria-label={`הורדת PDF${isSigned ? ' חתום' : ''}`}><DlIcon/><span>PDF{isSigned ? ' חתום' : ''}</span></a>
          <a className="sg-dl" href={file('docx')} download data-short="Word" aria-label="הורדת Word"><DlIcon/><span>Word</span></a>
          <div className="sg-zoom" aria-label="זום"><button type="button" onClick={() => setZoom(z => Math.max(.6, +(z - .1).toFixed(2)))} aria-label="הקטנה">−</button><button type="button" onClick={() => setZoom(1)} aria-label="גודל רגיל" style={{ fontSize: 12 }}>{Math.round(zoom * 100)}%</button><button type="button" onClick={() => setZoom(z => Math.min(1.6, +(z + .1).toFixed(2)))} aria-label="הגדלה">+</button></div>
        </div>}
      </header>
      {st.loading ? <div className="sg-blocked">טוען את המסמך…</div> : !v ? <div className="sg-blocked"><h2>{st.blocked}</h2><a className="sg-btn ghost" href="https://wa.me/972559811814" style={{ marginTop: 12 }}>לפנות למשרד בוואטסאפ</a></div> : (<>
        {!isSigned && !st.blocked && !done && <div className="sg-intro">
          <small>מסמך לחתימה{v.number ? <> · <span dir="ltr">{v.number}</span></> : null}</small>
          <h1>{v.title}</h1>
          <p>{[first ? `עבור ${String(form.name || v.client?.name || '').trim()}` : '', v.property?.address ? [v.property.address, v.property.city].filter(Boolean).join(', ') : '', v.expires_at ? `בתוקף עד ${new Date(v.expires_at).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}` : ''].filter(Boolean).join(' · ')}</p>
          <div className="sg-intro-dl"><span>הורדת עותק:</span><a href={file(pdfKind)} download><DlIcon/>PDF</a><a href={file('docx')} download><DlIcon/>Word</a></div>
        </div>}
        <div className="sg-wrap">
          <div className="sg-doc" ref={docRef}><div className="sg-doc-in" style={{ transform: `scale(${scale * zoom})`, width: 794 }}><DocSheet view={v} signatureUrl={isSigned ? file('signature', false) : ''} agentSignatureUrl={isSigned && v.agentSigned ? file('agent', false) : ''} onSignHere={!isSigned && !st.blocked && !done ? () => document.getElementById('sign-pad')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}/></div></div>
          <aside className="sg-side" ref={sideRef} id="sign">{side}</aside>
        </div>
      </>)}
      {v && !done && !isSigned && !st.blocked && <div className={`sg-mob-cta${sideSeen ? ' hide' : ''}`}><button type="button" className="sg-btn" onClick={() => sideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>המשך לחתימה</button></div>}
      <footer className="sg-foot">אפיק הנחל יזום, שיווק, תיווך נדל"ן בע"מ · ח.פ. 517082038 · <a href="tel:0559811814" style={{ color: 'inherit', whiteSpace: 'nowrap' }} dir="ltr">055-981-1814</a><br/>הקישור אישי ומיועד לנמען בלבד</footer>
    </div>
  )
}
