// A person's WhatsApp profile picture (src/lib/waAvatars.js) over whatever the screen drew before (initials, an icon): the
// fallback shows through until the picture has loaded (an empty <img alt=""> draws nothing) and stays when there is none. The
// picture is asked for only once the face is on screen (IntersectionObserver), so a long list asks for the visible rows first.
// A click on a face that has a picture opens it big (FaceViewer): the original file WhatsApp keeps (usually 640×640), never
// stretched past its own size by more than the screen asks, with the name, the phone and "open the original".
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getAvatar, avatarBroken, peekAvatar } from './lib/waAvatars.js'

export default function WaFace({ phone, name = '', size = 40, radius = '50%', children, style, title, zoom = true, lang = 'he' }) {
  const ref = useRef(null)
  const [url, setUrl] = useState(() => peekAvatar(phone))
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!phone) { setUrl(''); return }
    let off = () => {}
    const ask = () => { const r = getAvatar(phone, u => setUrl(u)); setUrl(r.url); off = r.off }
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { ask(); return () => off() }
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); ask() } }, { rootMargin: '200px' })
    io.observe(el)
    return () => { io.disconnect(); off() }
  }, [phone])
  const canZoom = zoom && !!url
  const en = lang === 'en'
  const stop = e => e.stopPropagation()
  return (
    <>
      <div ref={ref} title={canZoom ? (en ? 'Show the profile picture' : 'הצגת תמונת הפרופיל') : title}
        role={canZoom ? 'button' : undefined} tabIndex={canZoom ? 0 : undefined}
        aria-label={canZoom ? (en ? `Profile picture of ${name || phone}` : `תמונת הפרופיל של ${name || phone}`) : undefined}
        onClick={canZoom ? e => { stop(e); e.preventDefault(); setOpen(true) } : undefined}
        onPointerDown={canZoom ? stop : undefined}
        onKeyDown={canZoom ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stop(e); setOpen(true) } } : undefined}
        style={{ position: 'relative', width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: 'hidden', cursor: canZoom ? 'zoom-in' : undefined, ...style }}>
        {children}
        {url && (
          <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" draggable="false"
            onError={() => { avatarBroken(phone); setUrl('') }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}/>
        )}
      </div>
      {open && url && <FaceViewer url={url} name={name} phone={phone} en={en} onClose={() => setOpen(false)} back={ref}/>}
    </>
  )
}

const local = p => {
  const d = String(p || '').replace(/\D/g, '')
  const l = d.startsWith('972') ? '0' + d.slice(3) : d
  return l.length === 10 ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l
}

function FaceViewer({ url, name, phone, en, onClose, back }) {
  const closeRef = useRef(null)
  const [nat, setNat] = useState(null)
  const [vw, setVw] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() } }
    const onResize = () => setVw({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', onResize)
    const el = back?.current
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', onResize); el?.focus?.() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // as big as the screen allows, at least 560 px wide, but never more than twice the picture's own size
  const side = Math.round(Math.min(vw.w * 0.92, vw.h * 0.78, nat ? Math.max(nat.w * 2, 560) : 640))
  const btn = { border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', borderRadius: 10, padding: '9px 14px', font: '600 13.5px Rubik, sans-serif', cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 0 }
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={en ? `Profile picture of ${name || local(phone)}` : `תמונת הפרופיל של ${name || local(phone)}`}
      onClick={onClose} onPointerDown={e => e.stopPropagation()}
      style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(11,20,26,.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 16, direction: en ? 'ltr' : 'rtl', fontFamily: 'Rubik, sans-serif', animation: 'waFaceIn .18s ease' }} data-waface>
      <style>{'@keyframes waFaceIn{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){[data-waface]{animation:none!important}}'}</style>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 12, width: side, maxWidth: '100%', color: '#E9EDEF' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {name && <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><bdi>{name}</bdi></div>}
          <div dir="ltr" style={{ fontSize: 13.5, color: '#AEBAC1', textAlign: en ? 'left' : 'right' }}>{local(phone)}{nat ? ` · ${nat.w}×${nat.h}` : ''}</div>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={btn}>{en ? 'Open original' : 'פתיחת המקור'}</a>
        <button ref={closeRef} type="button" onClick={onClose} aria-label={en ? 'Close' : 'סגירה'} style={{ ...btn, padding: '9px 12px' }}>✕</button>
      </div>
      <img src={url} alt={en ? `Profile picture of ${name || local(phone)}` : `תמונת הפרופיל של ${name || local(phone)}`} referrerPolicy="no-referrer"
        onClick={e => e.stopPropagation()} onLoad={e => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        style={{ width: side, height: side, maxWidth: '100%', objectFit: 'contain', borderRadius: 12, background: '#111B21', boxShadow: '0 24px 64px rgba(0,0,0,.5)', imageRendering: 'auto' }}/>
    </div>,
    document.body,
  )
}
