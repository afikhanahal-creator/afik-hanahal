// Share & promote a property: short link with a rich preview (/p/<id>), per-channel campaign links (UTM),
// ready-to-post texts for social media and colleagues, one-tap share buttons and a QR code for signs & print.
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FaTimes, FaCopy, FaCheck, FaExternalLinkAlt, FaWhatsapp, FaFacebookF, FaInstagram, FaLinkedinIn, FaTelegramPlane, FaEnvelope, FaShareAlt, FaUsers, FaGoogle, FaListAlt, FaQrcode, FaDownload, FaExclamationTriangle, FaLink, FaBullhorn, FaMagic } from 'react-icons/fa'
import { T } from './automationsUI.jsx'
import { propertyMeta, formatPrice } from '../lib/share-page.js'
import QRCode from 'qrcode'

const TR = {
  he: {
    title: 'שיתוף ופרסום הנכס', close: 'סגירה', preview: 'כך הקישור ייראה בפייסבוק, וואטסאפ ולינקדאין', main: 'הקישור של הנכס', mainSub: 'קצר, עם תמונה, מחיר ופרטים – מוביל ישר לנכס באתר',
    copy: 'העתק', copied: 'הועתק', open: 'פתח', hidden: 'הנכס מוסתר כרגע מהאתר – פרסמו אותו כדי שהקישור יוביל אליו.',
    channels: 'קישורים לפי ערוץ פרסום', channelsSub: 'לכל ערוץ קישור משלו, כדי לראות בגוגל אנליטיקס ובלידים מאיזו מודעה הגיעו הפניות',
    ch: { facebook: 'פייסבוק – פוסט / מודעה', instagram: 'אינסטגרם – ביו / מודעה', whatsapp: 'וואטסאפ – קבוצות וסטטוס', colleagues: 'לקולגות ומתווכים', yad2: 'יד2 / לוחות מודעות', google: 'גוגל – מודעה ממומנת' },
    custom: 'קישור מותאם לקמפיין', source: 'מקור (utm_source)', medium: 'סוג (utm_medium)', campaign: 'שם קמפיין (utm_campaign)', content: 'גרסת מודעה (utm_content)',
    quick: 'שיתוף מהיר', native: 'שיתוף…', email: 'מייל',
    texts: 'טקסט מוכן לפרסום', social: 'פוסט לסושיאל', colleague: 'הודעה לקולגות', en: 'English',
    qr: 'קוד QR לשלטים ולדפוס', qrSub: 'סריקה פותחת את הנכס באתר', download: 'הורדה',
    fbDebug: 'רענון התצוגה בפייסבוק', fbDebugSub: 'אחרי עדכון תמונה או מחיר – כדי שפייסבוק יטען את הפרטים החדשים',
  },
  en: {
    title: 'Share & promote this property', close: 'Close', preview: 'How the link looks on Facebook, WhatsApp and LinkedIn', main: 'Property link', mainSub: 'Short, with photo, price and details – goes straight to the property on the site',
    copy: 'Copy', copied: 'Copied', open: 'Open', hidden: 'This property is hidden from the site – publish it so the link leads to it.',
    channels: 'Links per channel', channelsSub: 'Each channel gets its own link, so Google Analytics and the leads show which ad brought them',
    ch: { facebook: 'Facebook – post / ad', instagram: 'Instagram – bio / ad', whatsapp: 'WhatsApp – groups & status', colleagues: 'Colleagues & brokers', yad2: 'Yad2 / listing sites', google: 'Google – paid ad' },
    custom: 'Custom campaign link', source: 'Source (utm_source)', medium: 'Medium (utm_medium)', campaign: 'Campaign (utm_campaign)', content: 'Ad variant (utm_content)',
    quick: 'Quick share', native: 'Share…', email: 'Email',
    texts: 'Ready-to-post text', social: 'Social post', colleague: 'Message to colleagues', en: 'English',
    qr: 'QR code for signs & print', qrSub: 'Scanning opens the property on the site', download: 'Download',
    fbDebug: 'Refresh the Facebook preview', fbDebugSub: 'After changing a photo or the price – so Facebook picks up the new details',
  },
}
const CHANNELS = [
  { id: 'facebook', Icon: FaFacebookF, color: '#1877F2', utm: { utm_source: 'facebook', utm_medium: 'paid_social' } },
  { id: 'instagram', Icon: FaInstagram, color: '#E1306C', utm: { utm_source: 'instagram', utm_medium: 'paid_social' } },
  { id: 'whatsapp', Icon: FaWhatsapp, color: '#25D366', utm: { utm_source: 'whatsapp', utm_medium: 'social' } },
  { id: 'colleagues', Icon: FaUsers, color: '#7456C2', utm: { utm_source: 'colleagues', utm_medium: 'referral' } },
  { id: 'yad2', Icon: FaListAlt, color: '#F59E0B', utm: { utm_source: 'yad2', utm_medium: 'listing' } },
  { id: 'google', Icon: FaGoogle, color: '#EA4335', utm: { utm_source: 'google', utm_medium: 'cpc' } },
]
const CSS = `
  .ps *{box-sizing:border-box}.ps button{min-height:0;min-width:0}
  .ps-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:16px;align-items:start}
  .ps-in{width:100%;height:36px;padding:0 10px;border-radius:9px;border:1px solid var(--au-s3-line);background:var(--au-input);color:var(--au-text);font-family:inherit;font-size:13px;outline:none}
  .ps-in::placeholder{color:var(--au-text-dis)}
  .ps-in:focus{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.2)}
  .ps-row:hover{background:rgba(var(--ov),.035)}
  @keyframes ps-in{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
  @media (max-width:900px){.ps-grid{grid-template-columns:1fr}}
  @media (max-width:640px){.ps-wrap{padding:0!important}.ps-dialog{border-radius:0!important;height:100%!important;max-height:none!important}}
`
const slug = p => `prop-${String(p.id).replace(/[^\w-]/g, '').slice(0, 24)}`
function withUtm(base, utm) {
  const q = new URLSearchParams()
  Object.entries(utm).forEach(([k, v]) => { if (v) q.set(k, v) })
  const s = q.toString()
  return s ? `${base}?${s}` : base
}

function Box({ title, sub, icon: Ic, children, right }) {
  return (
    <section style={{ background: T.card, boxShadow: T.cardShadow, border: `1px solid ${T.s1Line}`, borderRadius: 14, padding: 16 }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
        {Ic && <Ic size={12} style={{ color: T.brandText, marginTop: 3 }}/>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.text }}>{title}</h3>
          {sub && <div style={{ fontSize: 12, color: T.text3, marginTop: 3, lineHeight: 1.5 }}>{sub}</div>}
        </div>
        {right}
      </header>
      {children}
    </section>
  )
}
function CopyBtn({ text, t, primary }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500) } catch {} }}
      style={{ height: 34, padding: '0 12px', borderRadius: 9, border: primary ? 'none' : `1px solid ${T.s1Line}`, background: ok ? '#16A34A' : primary ? 'var(--au-brand)' : 'rgba(var(--ov),.04)', color: ok || primary ? '#fff' : T.text2, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, transition: 'background .15s' }}>
      {ok ? <FaCheck size={10}/> : <FaCopy size={10}/>}{ok ? t.copied : t.copy}
    </button>
  )
}
function LinkRow({ url, t, primary }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input readOnly value={url} dir="ltr" onFocus={e => e.target.select()} className="ps-in" style={{ flex: 1, minWidth: 0, fontFamily: 'ui-monospace,Menlo,Consolas,monospace', fontSize: 12.5 }}/>
      <CopyBtn text={url} t={t} primary={primary}/>
    </div>
  )
}

export function buildTexts(p, url, lang) {
  const en = lang === 'en'
  const price = formatPrice(p.price, lang)
  const place = [p.location, p.neighborhood].filter(Boolean).join(', ')
  const facts = [
    p.type,
    p.rooms && (en ? `${p.rooms} rooms` : `${p.rooms} חדרים`),
    (p.size || p.buildSqm) && (en ? `${p.size || p.buildSqm} sqm` : `${p.size || p.buildSqm} מ״ר`),
    p.dunams && (en ? `${p.dunams} dunams` : `${p.dunams} דונם`),
    p.floor && (en ? `floor ${p.floor}${p.totalFloors ? '/' + p.totalFloors : ''}` : `קומה ${p.floor}${p.totalFloors ? '/' + p.totalFloors : ''}`),
  ].filter(Boolean)
  const extras = en
    ? [p.parking && 'parking', p.elevator && 'elevator', p.safeRoom && 'safe room', p.balcony && 'balcony', p.garden && 'garden', p.renovated && 'renovated', p.exclusive && 'exclusive listing'].filter(Boolean)
    : [p.parking && 'חניה', p.elevator && 'מעלית', p.safeRoom && 'ממ״ד', p.balcony && 'מרפסת', p.garden && 'גינה', p.renovated && 'משופץ', p.exclusive && 'בלעדיות'].filter(Boolean)
  const desc = String(p.description || '').replace(/\s+/g, ' ').trim()
  const short = desc.length > 220 ? desc.slice(0, 220).replace(/\s+\S*$/, '') + '…' : desc
  const social = en
    ? [`🏡 ${p.title}${place ? ` | ${place}` : ''}`, facts.length ? `📐 ${facts.join(' · ')}` : '', extras.length ? `✨ ${extras.join(' · ')}` : '', price ? `💰 ${price}` : '', short, '', `👉 Photos, details and viewings: ${url}`, '📞 Afik Hanahal – 055-981-1814'].filter(x => x !== '').join('\n')
    : [`🏡 ${p.title}${place ? ` | ${place}` : ''}`, facts.length ? `📐 ${facts.join(' · ')}` : '', extras.length ? `✨ ${extras.join(' · ')}` : '', price ? `💰 ${price}` : '', short, '', `👉 לכל הפרטים, התמונות ותיאום סיור: ${url}`, '📞 אפיק הנחל – 055-981-1814'].filter(x => x !== '').join('\n')
  const colleague = en
    ? [`Hi, sharing a property we're marketing${p.exclusive ? ' (exclusive)' : ''}:`, `${p.title}${place ? ` – ${place}` : ''}`, facts.length ? facts.join(' · ') : '', price ? `Asking: ${price}` : '', p.gush || p.helka ? `Block ${p.gush || '—'} / parcel ${p.helka || '—'}` : '', `Full details & photos: ${url}`, 'Happy to cooperate – Afik Hanahal, 055-981-1814'].filter(Boolean).join('\n')
    : [`היי, משתפים נכס שאנחנו משווקים${p.exclusive ? ' (בבלעדיות)' : ''}:`, `${p.title}${place ? ` – ${place}` : ''}`, facts.length ? facts.join(' · ') : '', price ? `מחיר מבוקש: ${price}` : '', p.gush || p.helka ? `גוש ${p.gush || '—'} / חלקה ${p.helka || '—'}` : '', `כל הפרטים והתמונות: ${url}`, 'נשמח לשיתוף פעולה – אפיק הנחל, 055-981-1814'].filter(Boolean).join('\n')
  return { social, colleague }
}

export default function PropertyShare({ prop, onClose, lang = 'he' }) {
  const t = TR[lang] || TR.he
  const dir = lang === 'en' ? 'ltr' : 'rtl'
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://afikhanahal.co.il'
  const base = `${origin}/p/${encodeURIComponent(prop.id)}`
  const meta = useMemo(() => propertyMeta(prop, { origin, lang: 'he' }), [prop, origin])
  const live = prop.published !== false
  const [custom, setCustom] = useState({ utm_source: '', utm_medium: '', utm_campaign: slug(prop), utm_content: '' })
  const [textKind, setTextKind] = useState('social')
  const [textLang, setTextLang] = useState('he')
  const ref = useRef(null)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const channelUrl = ch => withUtm(base, { ...ch.utm, utm_campaign: slug(prop) })
  const customUrl = withUtm(base, custom)
  const texts = buildTexts(prop, textLang === 'en' ? withUtm(base, { lang: 'en' }) : base, textLang)
  const text = texts[textKind]
  const waUrl = channelUrl(CHANNELS[2])
  const quick = [
    { id: 'wa', Icon: FaWhatsapp, color: '#25D366', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(buildTexts(prop, waUrl, 'he').social)}` },
    { id: 'fb', Icon: FaFacebookF, color: '#1877F2', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(channelUrl(CHANNELS[0]))}` },
    { id: 'li', Icon: FaLinkedinIn, color: '#0A66C2', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(withUtm(base, { utm_source: 'linkedin', utm_medium: 'social', utm_campaign: slug(prop) }))}` },
    { id: 'tg', Icon: FaTelegramPlane, color: '#229ED9', label: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(withUtm(base, { utm_source: 'telegram', utm_medium: 'social', utm_campaign: slug(prop) }))}&text=${encodeURIComponent(prop.title || '')}` },
    { id: 'mail', Icon: FaEnvelope, color: '#64748B', label: t.email, href: `mailto:?subject=${encodeURIComponent(prop.title || '')}&body=${encodeURIComponent(buildTexts(prop, withUtm(base, { utm_source: 'email', utm_medium: 'email', utm_campaign: slug(prop) }), 'he').colleague)}` },
  ]
  // QR generated in the browser (no third-party service) — PNG for print, tagged utm_source=qr
  const qrTarget = withUtm(base, { utm_source: 'qr', utm_medium: 'print', utm_campaign: slug(prop) })
  const [qrUrl, setQrUrl] = useState('')
  useEffect(() => { QRCode.toDataURL(qrTarget, { width: 720, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#171A2C', light: '#FFFFFF' } }).then(setQrUrl).catch(() => setQrUrl('')) }, [qrTarget])

  return createPortal(
    <div className="ps ps-wrap" dir={dir} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 2500, background: 'var(--au-overlay)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'min(3vh,24px) 12px' }}>
      <style>{CSS}</style>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ps-title" className="ps-dialog"
        style={{ width: 'min(1080px,100%)', maxHeight: '100%', display: 'flex', flexDirection: 'column', background: T.s2, border: `1px solid ${T.s2Line}`, borderRadius: 18, boxShadow: T.shadow2, color: T.text, overflow: 'hidden', outline: 'none', animation: 'ps-in .2s cubic-bezier(.2,.8,.2,1) both' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${T.line}` }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,var(--au-brand),var(--au-brand-deep))', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FaBullhorn size={15}/></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="ps-title" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{t.title}</h2>
            <div style={{ fontSize: 12.5, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prop.title}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t.close} style={{ width: 34, height: 34, borderRadius: 9, border: `1px solid ${T.s1Line}`, background: 'transparent', color: T.text2, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaTimes size={13}/></button>
        </header>

        <div style={{ overflowY: 'auto', padding: 16, background: T.bg }}>
          {!live && (
            <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 12, marginBottom: 14, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.35)', color: T.amberText, fontSize: 13, fontWeight: 600 }}>
              <FaExclamationTriangle size={13}/>{t.hidden}
            </div>
          )}
          <div className="ps-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              <Box title={t.main} sub={t.mainSub} icon={FaLink} right={<a href={base} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: T.brandText, textDecoration: 'none' }}>{t.open}<FaExternalLinkAlt size={9}/></a>}>
                <LinkRow url={base} t={t} primary/>
              </Box>

              <Box title={t.channels} sub={t.channelsSub} icon={FaBullhorn}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {CHANNELS.map(ch => (
                    <div key={ch.id} className="ps-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 6px', borderRadius: 10 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: `${ch.color}1f`, color: ch.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ch.Icon size={13}/></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{t.ch[ch.id]}</div>
                        <div dir="ltr" style={{ fontSize: 11.5, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: dir === 'rtl' ? 'right' : 'left', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>{channelUrl(ch).replace(/^https?:\/\//, '')}</div>
                      </div>
                      <CopyBtn text={channelUrl(ch)} t={t}/>
                    </div>
                  ))}
                </div>
              </Box>

              <Box title={t.custom} icon={FaMagic}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginBottom: 10 }}>
                  {[['utm_source', t.source, 'facebook'], ['utm_medium', t.medium, 'paid_social'], ['utm_campaign', t.campaign, slug(prop)], ['utm_content', t.content, 'video-a']].map(([k, label, ph]) => (
                    <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, fontWeight: 700, color: T.text3 }}>{label}
                      <input className="ps-in" dir="ltr" value={custom[k]} placeholder={ph} onChange={e => setCustom(c => ({ ...c, [k]: e.target.value.replace(/\s+/g, '-').toLowerCase() }))}/>
                    </label>
                  ))}
                </div>
                <LinkRow url={customUrl} t={t}/>
              </Box>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
              <Box title={t.preview} icon={FaShareAlt}>
                <div style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.s1Line}`, background: '#F0F2F5' }}>
                  <img src={meta.image.replace(origin, '')} alt="" style={{ width: '100%', aspectRatio: '1.91/1', objectFit: 'cover', display: 'block', background: '#DDE1EC' }} onError={e => { e.currentTarget.src = '/img/og-default.png' }}/>
                  <div dir="rtl" style={{ padding: '10px 12px', color: '#1C1E21' }}>
                    <div style={{ fontSize: 11.5, color: '#65676B', textTransform: 'uppercase', direction: 'ltr', textAlign: 'right' }}>{origin.replace(/^https?:\/\//, '')}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, marginTop: 2 }}>{meta.title}</div>
                    <div style={{ fontSize: 13, color: '#65676B', marginTop: 2, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{meta.description}</div>
                  </div>
                </div>
                <a href={`https://developers.facebook.com/tools/debug/?q=${encodeURIComponent(base)}`} target="_blank" rel="noopener noreferrer" title={t.fbDebugSub}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, fontWeight: 700, color: T.brandText, textDecoration: 'none' }}><FaFacebookF size={10}/>{t.fbDebug}<FaExternalLinkAlt size={8}/></a>
              </Box>

              <Box title={t.quick} icon={FaShareAlt}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {quick.map(q => (
                    <a key={q.id} href={q.href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 12px', borderRadius: 10, background: `${q.color}14`, border: `1px solid ${q.color}40`, color: T.text, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}>
                      <q.Icon size={13} style={{ color: q.color }}/>{q.label}
                    </a>
                  ))}
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button type="button" onClick={() => navigator.share({ title: prop.title, text: texts.social, url: base }).catch(() => {})}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 36, padding: '0 12px', borderRadius: 10, background: 'rgba(var(--ov),.04)', border: `1px solid ${T.s1Line}`, color: T.text, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><FaShareAlt size={12}/>{t.native}</button>
                  )}
                </div>
              </Box>

              <Box title={t.texts} icon={FaBullhorn} right={
                <div role="group" style={{ display: 'inline-flex', gap: 4 }}>
                  {[['he', 'עב'], ['en', 'EN']].map(([k, l]) => (
                    <button key={k} type="button" aria-pressed={textLang === k} onClick={() => setTextLang(k)} style={{ height: 26, padding: '0 9px', borderRadius: 7, border: `1px solid ${textLang === k ? 'var(--au-brand)' : T.s1Line}`, background: textLang === k ? 'var(--au-brand)' : 'transparent', color: textLang === k ? '#fff' : T.text2, fontSize: 11.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                  ))}
                </div>
              }>
                <div role="tablist" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {[['social', t.social], ['colleague', t.colleague]].map(([k, l]) => (
                    <button key={k} type="button" role="tab" aria-selected={textKind === k} onClick={() => setTextKind(k)} style={{ height: 30, padding: '0 12px', borderRadius: 20, border: `1px solid ${textKind === k ? 'var(--au-brand)' : T.s1Line}`, background: textKind === k ? 'rgba(var(--brand-rgb),.12)' : 'transparent', color: textKind === k ? T.brandText : T.text2, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
                  ))}
                </div>
                <textarea readOnly value={text} dir={textLang === 'en' ? 'ltr' : 'rtl'} rows={9} className="ps-in" style={{ height: 'auto', padding: '10px 12px', lineHeight: 1.6, resize: 'vertical' }}/>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><CopyBtn text={text} t={t} primary/></div>
              </Box>

              <Box title={t.qr} sub={t.qrSub} icon={FaQrcode}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {qrUrl ? <img src={qrUrl} alt={`QR – ${prop.title || ''}`} width={120} height={120} style={{ borderRadius: 10, background: '#fff', padding: 4, border: `1px solid ${T.s1Line}` }}/> : <span style={{ width: 120, height: 120 }}/>}
                  <a href={qrUrl || undefined} download={`${slug(prop)}-qr.png`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 12px', borderRadius: 9, border: `1px solid ${T.s1Line}`, color: T.text2, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }}><FaDownload size={11}/>{t.download}</a>
                </div>
              </Box>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
