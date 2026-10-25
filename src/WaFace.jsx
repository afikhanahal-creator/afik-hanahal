// A person's WhatsApp profile picture (src/lib/waAvatars.js) over whatever the screen drew before (initials, an icon): the
// fallback shows through until the picture has loaded (an empty <img alt=""> draws nothing) and stays when there is none. The picture is asked for only once the face is
// on screen (IntersectionObserver), so a long chat list asks for the visible rows first.
import { useEffect, useRef, useState } from 'react'
import { getAvatar, avatarBroken, peekAvatar } from './lib/waAvatars.js'

export default function WaFace({ phone, size = 40, radius = '50%', children, style, title }) {
  const ref = useRef(null)
  const [url, setUrl] = useState(() => peekAvatar(phone))
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
  return (
    <div ref={ref} title={title} style={{ position: 'relative', width: size, height: size, borderRadius: radius, flexShrink: 0, overflow: 'hidden', ...style }}>
      {children}
      {url && (
        <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" draggable="false"
          onError={() => { avatarBroken(phone); setUrl('') }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}/>
      )}
    </div>
  )
}
