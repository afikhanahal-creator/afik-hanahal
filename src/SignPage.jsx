// The client's signing page — /sign/<token> (noindex, no account): the document as it was sent (src/DocPreview.jsx), zoom,
// then the signature step: a one-time code to the client's WhatsApp or email (POST sign-otp), full name, ID number, the
// consent box, a drawn signature (finger / mouse / typed name turned into a drawn one) and "אני מאשר/ת וחותם/ת" → POST
// sign-submit. After signing: a confirmation with the signed copy to download (sign-file?kind=signed). A link that expired,
// a cancelled or an already-signed document reads so in words. Mobile first, the site's light look.
import { useEffect, useRef, useState } from 'react'
import DocSheet, { DOC_CSS } from './DocPreview.jsx'
import { OTP_MINUTES } from '../lib/documents.js'

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;background:#EFEBE3;color:#17172B;font-family:Rubik,Heebo,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.sg{min-height:100vh;direction:rtl;display:flex;flex-direction:column}
.sg-top{position:sticky;top:0;z-index:5;background:rgba(239,235,227,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid #E1DBD0;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.sg-top img{height:34px}.sg-top b{font-size:14px;font-weight:600}.sg-top small{display:block;color:#5E5B6E;font-size:12px}
.sg-zoom{display:flex;gap:4px}.sg-zoom button{width:34px;height:34px;border-radius:8px;border:1px solid #D9D3C7;background:#fff;font:inherit;font-size:16px;cursor:pointer;color:#17172B}
.sg-wrap{flex:1;display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:20px;padding:20px;max-width:1240px;width:100%;margin:0 auto;align-items:start}
.sg-doc{overflow:auto;padding:4px 0 20px}
.sg-doc-in{transform-origin:top center;margin:0 auto}
.sg-side{position:sticky;top:70px;background:#fff;border:1px solid #E1DBD0;border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 6px 30px rgba(0,0,0,.06)}
.sg-side h2{margin:0;font-size:18px;font-weight:600}.sg-side p{margin:0;color:#5E5B6E;font-size:13.5px;line-height:1.6}
.sg-f{display:flex;flex-direction:column;gap:5px}.sg-f label{font-size:12.5px;font-weight:600;color:#3C3A4A}
.sg-in{height:44px;border-radius:10px;border:1px solid #D9D3C7;background:#FBFAF7;padding:0 12px;font:inherit;font-size:15px;color:#17172B;width:100%}
.sg-in:focus{outline:2px solid #3F4EB0;outline-offset:1px}
.sg-btn{height:48px;border-radius:12px;border:none;background:#3F4EB0;color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%}
.sg-btn:disabled{opacity:.5;cursor:not-allowed}.sg-btn.ghost{background:#fff;color:#3F4EB0;border:1px solid #C7CCEB}.sg-btn.sm{height:38px;font-size:13.5px;width:auto;padding:0 14px}
.sg-chips{display:flex;gap:6px;flex-wrap:wrap}.sg-chip{border:1px solid #D9D3C7;background:#fff;border-radius:999px;padding:7px 12px;font:inherit;font-size:13px;cursor:pointer}.sg-chip.on{background:#3F4EB0;border-color:#3F4EB0;color:#fff}
.sg-otp{display:flex;gap:8px;align-items:center}.sg-otp input{letter-spacing:8px;text-align:center;font-size:22px;font-weight:700;direction:ltr}
.sg-pad{position:relative;border:1.5px dashed #B9B5AA;border-radius:12px;background:#FBFAF7;height:170px;touch-action:none;overflow:hidden}
.sg-pad canvas{width:100%;height:100%;display:block;cursor:crosshair}
.sg-pad .hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#B9B5AA;font-size:14px;pointer-events:none}
.sg-pad .line{position:absolute;left:14px;right:14px;bottom:36px;border-bottom:1px solid #D9D3C7;pointer-events:none}
.sg-pad-acts{display:flex;justify-content:space-between;gap:8px;align-items:center}
.sg-chk{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.5;cursor:pointer}.sg-chk input{width:20px;height:20px;margin:1px 0 0;accent-color:#3F4EB0;flex-shrink:0}
.sg-err{background:#FDECEC;color:#B42318;border-radius:10px;padding:9px 12px;font-size:13.5px;line-height:1.5}
.sg-ok{background:#E8F7EE;color:#0E7A3B;border-radius:10px;padding:9px 12px;font-size:13.5px}
.sg-done{text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center;padding:10px 0}
.sg-done .big{width:72px;height:72px;border-radius:50%;background:#E8F7EE;color:#128C4A;display:flex;align-items:center;justify-content:center;font-size:36px}
.sg-foot{text-align:center;color:#8A8798;font-size:12px;padding:16px}
.sg-blocked{max-width:560px;margin:40px auto;background:#fff;border-radius:16px;padding:28px;text-align:center;border:1px solid #E1DBD0}
.sg-mob-cta{display:none}
@media (max-width:900px){.sg-wrap{grid-template-columns:1fr;padding:0;gap:0}.sg-doc{padding:0}.sg-side{position:static;border-radius:20px 20px 0 0;margin-top:-8px;box-shadow:0 -8px 30px rgba(0,0,0,.08)}.sg-doc-in{transform:none!important;width:100%!important}.sg-zoom{display:none}.sg-mob-cta{display:flex;position:fixed;bottom:0;inset-inline:0;z-index:6;padding:10px 14px;background:rgba(255,255,255,.96);border-top:1px solid #E1DBD0}.sg-foot{padding-bottom:80px}}
`
const api = (a, q = '', opts = {}) => fetch(`/api/meta/${a}${q}`, { signal: AbortSignal.timeout(30000), ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } }).then(async r => { const d = await r.json().catch(() => ({})); return { status: r.status, ...d } })

function SignaturePad({ onChange, name }) {
  const ref = useRef(null), drawing = useRef(false), last = useRef(null), has = useRef(false)
  const [empty, setEmpty] = useState(true)
  const ctx = () => { const c = ref.current; const k = c.getContext('2d'); return { c, k } }
  useEffect(() => {
    const { c, k } = ctx(); const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); k.scale(dpr, dpr); k.lineWidth = 2.4; k.lineCap = 'round'; k.lineJoin = 'round'; k.strokeStyle = '#1A2A6C'
  }, [])
  const pos = e => { const r = ref.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const down = e => { e.preventDefault(); ref.current.setPointerCapture?.(e.pointerId); drawing.current = true; last.current = pos(e); const { k } = ctx(); k.beginPath(); k.moveTo(last.current.x, last.current.y); k.lineTo(last.current.x + .1, last.current.y + .1); k.stroke() }
  const move = e => { if (!drawing.current) return; e.preventDefault(); const p = pos(e); const { k } = ctx(); k.beginPath(); k.moveTo(last.current.x, last.current.y); k.lineTo(p.x, p.y); k.stroke(); last.current = p; if (!has.current) { has.current = true; setEmpty(false) } }
  const up = () => { if (!drawing.current) return; drawing.current = false; if (has.current) onChange(ref.current.toDataURL('image/png')) }
  const clear = () => { const { c, k } = ctx(); k.save(); k.setTransform(1, 0, 0, 1, 0, 0); k.clearRect(0, 0, c.width, c.height); k.restore(); has.current = false; setEmpty(true); onChange('') }
  const typed = () => { if (!name) return; clear(); const { c, k } = ctx(); const r = c.getBoundingClientRect(); k.save(); k.font = `italic 600 ${Math.min(44, Math.max(26, r.width / Math.max(6, name.length) * 1.4))}px "Rubik", "Heebo", cursive`; k.fillStyle = '#1A2A6C'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.direction = 'rtl'; k.fillText(name, r.width / 2, r.height / 2 - 8); k.restore(); has.current = true; setEmpty(false); onChange(c.toDataURL('image/png')) }
  return (
    <div className="sg-f">
      <label>החתימה שלכם</label>
      <div className="sg-pad"><canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} aria-label="תיבת חתימה — ציירו את החתימה באצבע או בעכבר"/>{empty && <div className="hint">ציירו כאן את החתימה באצבע או בעכבר</div>}<div className="line"/></div>
      <div className="sg-pad-acts"><button type="button" className="sg-btn ghost sm" onClick={typed} disabled={!name}>חתימה מהשם שהקלדתם</button><button type="button" className="sg-btn ghost sm" onClick={clear}>ניקוי</button></div>
    </div>
  )
}

export default function SignPage() {
  const token = (window.location.pathname.match(/^\/sign\/([A-Za-z0-9_-]{20,64})/) || [])[1] || ''
  const [st, setSt] = useState({ loading: true })
  const [zoom, setZoom] = useState(1)
  const [form, setForm] = useState({ name: '', idNumber: '', code: '', agree: false, signature: '' })
  const [otp, setOtp] = useState(null)        // { via, to, minutes, at }
  const [via, setVia] = useState('')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const docRef = useRef(null), sideRef = useRef(null)
  const [scale, setScale] = useState(1)
  useEffect(() => { document.title = 'חתימה על מסמך · אפיק הנחל' }, [])
  useEffect(() => {
    if (!token) { setSt({ blocked: 'הקישור לא תקין' }); return }
    api('sign-open', `?t=${encodeURIComponent(token)}`).then(r => {
      if (r.error) setSt({ blocked: r.error })
      else { setSt({ view: r.view, blocked: r.blocked, signed: r.signed, expired: r.expired }); setForm(f => ({ ...f, name: r.view?.client?.name || '' })); setVia(r.view?.channels?.whatsapp ? 'whatsapp' : 'email') }
    }).catch(() => setSt({ blocked: 'לא הצלחנו לטעון את המסמך. נסו שוב בעוד רגע.' }))
  }, [token])
  useEffect(() => {
    const el = docRef.current; if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, (el.clientWidth - 8) / 794)))
    ro.observe(el); return () => ro.disconnect()
  }, [st.view])
  const sendOtp = async () => {
    setBusy('otp'); setErr('')
    try { const r = await api('sign-otp', '', { method: 'POST', body: JSON.stringify({ t: token, via }) }); if (r.error) setErr(r.error); else setOtp({ ...r, at: Date.now() }) } catch { setErr('הקוד לא נשלח. נסו שוב.') } finally { setBusy('') }
  }
  const submit = async () => {
    setErr('')
    if (!otp) { setErr('קודם מקבלים קוד אימות'); return }
    if (form.code.replace(/\D/g, '').length !== 6) { setErr('הקלידו את 6 ספרות הקוד'); return }
    if (form.name.trim().length < 2) { setErr('כתבו את שמכם המלא'); return }
    if (!form.signature) { setErr('ציירו את החתימה בתיבה'); return }
    if (!form.agree) { setErr('צריך לאשר שקראתם את המסמך ומסכימים לחתום עליו'); return }
    setBusy('sign')
    try {
      const r = await api('sign-submit', '', { method: 'POST', body: JSON.stringify({ t: token, code: form.code, name: form.name, idNumber: form.idNumber, agree: form.agree, signature: form.signature }), signal: AbortSignal.timeout(60000) })
      if (r.error) { setErr(r.error); return }
      setDone(r); setSt(s => ({ ...s, view: r.view }))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { setErr('החתימה לא נשלחה. בדקו את החיבור ונסו שוב.') } finally { setBusy('') }
  }
  const v = st.view
  const signedUrl = `/api/meta/sign-file?t=${encodeURIComponent(token)}&kind=signed&dl=1`
  const side = done || st.signed ? (
    <div className="sg-done" aria-live="polite">
      <div className="sg-done"><div className="big">✓</div></div>
      <h2 style={{ margin: 0 }}>המסמך נחתם בהצלחה</h2>
      <p>{v?.client?.emailMasked ? `עותק חתום נשלח אליכם לכתובת ${v.client.emailMasked}.` : 'העותק החתום שמור אצלנו ונשלח לכם בוואטסאפ לפי בקשה.'}{' '}אפשר גם להוריד אותו כאן.</p>
      <a className="sg-btn" href={signedUrl}>הורדת העותק החתום (PDF)</a>
      <p style={{ fontSize: 12.5 }}>מספר מסמך <span dir="ltr">{v?.number}</span>{v?.signature?.at ? ` · נחתם ${new Date(v.signature.at).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}` : ''}</p>
    </div>
  ) : st.blocked ? (
    <div className="sg-done"><h2 style={{ margin: 0 }}>{st.expired ? 'תוקף הקישור פג' : 'אי אפשר לחתום על המסמך'}</h2><p>{st.blocked}</p><a className="sg-btn ghost" href="https://wa.me/972559811814">לפנות למשרד בוואטסאפ</a></div>
  ) : (
    <>
      <h2>חתימה על המסמך</h2>
      <p>קראו את המסמך, קבלו קוד אימות חד-פעמי, ציירו את החתימה ואשרו. זה לוקח דקה.</p>
      <div className="sg-f"><label>1. קוד אימות</label>
        {v?.channels?.whatsapp && v?.channels?.email && <div className="sg-chips"><button type="button" className={`sg-chip${via === 'whatsapp' ? ' on' : ''}`} onClick={() => setVia('whatsapp')}>לוואטסאפ {v.client.phoneMasked}</button><button type="button" className={`sg-chip${via === 'email' ? ' on' : ''}`} onClick={() => setVia('email')}>לאימייל {v.client.emailMasked}</button></div>}
        {!otp ? <button type="button" className="sg-btn ghost" disabled={busy === 'otp'} onClick={sendOtp}>{busy === 'otp' ? 'שולח…' : `שליחת קוד ${via === 'email' ? `לאימייל ${v?.client?.emailMasked || ''}` : `לוואטסאפ ${v?.client?.phoneMasked || ''}`}`}</button>
          : <><div className="sg-ok">הקוד נשלח {otp.via === 'email' ? 'לאימייל' : 'לוואטסאפ'} {otp.to}. תקף ל-{otp.minutes || OTP_MINUTES} דקות.</div>
            <div className="sg-otp"><input className="sg-in" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))} aria-label="קוד האימות"/><button type="button" className="sg-btn ghost sm" disabled={busy === 'otp'} onClick={sendOtp}>שוב</button></div></>}
      </div>
      <div className="sg-f"><label>2. שם מלא</label><input className="sg-in" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoComplete="name"/></div>
      <div className="sg-f"><label>תעודת זהות{v?.client?.idNumber ? '' : ' (לא חובה)'}</label><input className="sg-in" dir="ltr" inputMode="numeric" maxLength={9} value={form.idNumber} onChange={e => setForm(f => ({ ...f, idNumber: e.target.value.replace(/\D/g, '').slice(0, 9) }))}/></div>
      <SignaturePad name={form.name} onChange={s => setForm(f => ({ ...f, signature: s }))}/>
      <label className="sg-chk"><input type="checkbox" checked={form.agree} onChange={e => setForm(f => ({ ...f, agree: e.target.checked }))}/><span>קראתי את המסמך, הבנתי את תוכנו ואני מסכים/ה לחתום עליו בחתימה אלקטרונית. מועד החתימה, אמצעי האימות וכתובת ה-IP יתועדו כחלק מהמסמך.</span></label>
      {err && <div className="sg-err" role="alert">{err}</div>}
      <button type="button" className="sg-btn" disabled={busy === 'sign'} onClick={submit}>{busy === 'sign' ? 'חותם…' : 'אני מאשר/ת וחותם/ת על המסמך'}</button>
    </>
  )
  return (
    <div className="sg">
      <style>{CSS}{DOC_CSS}</style>
      <header className="sg-top">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><img src="/logo-black.svg" alt="אפיק הנחל"/><div><b>{v?.title || 'מסמך לחתימה'}</b><small>אפיק הנחל יזום, שיווק, תיווך נדל"ן בע"מ{v?.number ? <> · <span dir="ltr">{v.number}</span></> : null}</small></div></div>
        <div className="sg-zoom" aria-label="זום"><button type="button" onClick={() => setZoom(z => Math.max(.6, +(z - .1).toFixed(2)))} aria-label="הקטנה">−</button><button type="button" onClick={() => setZoom(1)} aria-label="גודל רגיל" style={{ fontSize: 12 }}>{Math.round(zoom * 100)}%</button><button type="button" onClick={() => setZoom(z => Math.min(1.6, +(z + .1).toFixed(2)))} aria-label="הגדלה">+</button></div>
      </header>
      {st.loading ? <div className="sg-blocked">טוען את המסמך…</div> : !v ? <div className="sg-blocked"><h2>{st.blocked}</h2><a className="sg-btn ghost" href="https://wa.me/972559811814" style={{ marginTop: 12 }}>לפנות למשרד בוואטסאפ</a></div> : (
        <div className="sg-wrap">
          <div className="sg-doc" ref={docRef}><div className="sg-doc-in" style={{ transform: `scale(${scale * zoom})`, width: 794 }}><DocSheet view={v} signatureUrl={done || st.signed ? `/api/meta/sign-file?t=${encodeURIComponent(token)}&kind=signature` : ''}/></div></div>
          <aside className="sg-side" ref={sideRef} id="sign">{side}</aside>
        </div>
      )}
      {v && !done && !st.signed && !st.blocked && <div className="sg-mob-cta"><button type="button" className="sg-btn" onClick={() => sideRef.current?.scrollIntoView({ behavior: 'smooth' })}>לחתימה ↓</button></div>}
      <footer className="sg-foot">אפיק הנחל יזום, שיווק, תיווך נדל"ן בע"מ · ח.פ. 517082038 · 055-981-1814 · הקישור אישי ומיועד לנמען בלבד</footer>
    </div>
  )
}
