import { useState, useRef, useCallback, useEffect } from 'react'
import {
  FaTimes, FaChevronRight, FaChevronLeft, FaCheck, FaCamera,
  FaWhatsapp, FaCopy,
  FaWheelchair, FaSnowflake, FaBuilding, FaCar, FaBox, FaShieldAlt,
  FaExpand, FaUtensils, FaSun, FaLock, FaDoorOpen, FaCouch,
  FaTools, FaUserShield, FaWind, FaBolt,
  FaHome, FaKey,
  FaLightbulb, FaExclamationTriangle,
  FaTag, FaMapMarkerAlt, FaBed, FaRulerCombined, FaMoneyBill,
  FaCalendarAlt, FaCog, FaFileAlt, FaPhone, FaLayerGroup,
  FaPlay, FaVideo, FaCloudUploadAlt, FaCircleNotch,
  FaGlobe, FaSave, FaMagic, FaSyncAlt,
  FaSwimmingPool, FaWifi, FaUsers, FaBriefcase,
} from 'react-icons/fa'

// ─── Cloudinary config ── fill in your own cloud name + unsigned preset ───────
const CLOUDINARY_CLOUD  = 'your-cloud-name'    // e.g. 'dxyz123abc'
const CLOUDINARY_PRESET = 'your-upload-preset' // unsigned upload preset

const uploadToCloudinary = (file, onProgress) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest()
  const fd  = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', CLOUDINARY_PRESET)
  xhr.upload.addEventListener('progress', e => {
    if (e.lengthComputable) onProgress?.(Math.round(e.loaded / e.total * 100))
  })
  xhr.addEventListener('load', () => {
    if (xhr.status === 200) resolve(JSON.parse(xhr.responseText))
    else reject(new Error(`Upload failed (${xhr.status})`))
  })
  xhr.addEventListener('error', () => reject(new Error('Network error')))
  xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`)
  xhr.send(fd)
})

// Compress image → base64 JPEG (mirrors App.jsx ImageUpload logic)
const compressImage = file => new Promise(res => {
  const reader = new FileReader()
  reader.onload = e => {
    const img = new Image()
    img.onload = () => {
      const MAX = 1000
      let w = img.width, h = img.height
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
      const cv = document.createElement('canvas')
      cv.width = w; cv.height = h
      cv.getContext('2d').drawImage(img, 0, 0, w, h)
      res(cv.toDataURL('image/jpeg', 0.75))
    }
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
})

// ─── Data ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: 'סוג עסקה' },
  { id: 2, title: 'כתובת' },
  { id: 3, title: 'פרטי נכס' },
  { id: 4, title: 'מחיר' },
  { id: 5, title: 'תיאור' },
  { id: 6, title: 'מדיה' },
  { id: 7, title: 'סיכום' },
]

const PROPERTY_TYPES = [
  'דירה', 'דירת גן', 'בית פרטי / קוטג׳', 'גג / פנטהאוז',
  'מגרש', 'דופלקס', 'דירת נופש', 'דו משפחתי',
  'מרתף / פרטר', 'טריפלקס', 'נחלה', 'קרקע חקלאית',
  'משרד', 'חנות', 'נכס מסחרי', 'מבנה תעשייתי', 'קרקע מסחרית',
]

const COMMERCIAL_TYPES = ['משרד', 'חנות', 'נכס מסחרי', 'מבנה תעשייתי', 'קרקע מסחרית']

const CONDITIONS = [
  { v: 'new_contractor', l: 'חדש מקבלן', d: 'לא גרו בו בכלל' },
  { v: 'new',            l: 'חדש',        d: 'נכס בן עד 10 שנים' },
  { v: 'renovated',      l: 'משופץ',      d: 'שופץ ב-5 השנים האחרונות' },
  { v: 'good',           l: 'במצב שמור',  d: 'במצב טוב, לא שופץ' },
  { v: 'needs_reno',     l: 'דרוש שיפוץ', d: 'זקוק לעבודות שיפוץ' },
]

const AMENITIES = [
  { k: 'accessible',  l: 'גישה לנכים',  Icon: FaWheelchair },
  { k: 'ac',          l: 'מיזוג',        Icon: FaSnowflake },
  { k: 'elevator',    l: 'מעלית',        Icon: FaBuilding },
  { k: 'parking',     l: 'חניה',         Icon: FaCar },
  { k: 'storage',     l: 'מחסן',         Icon: FaBox },
  { k: 'shelter',     l: 'ממ"ד',         Icon: FaShieldAlt },
  { k: 'balcony',     l: 'מרפסת',        Icon: FaExpand },
  { k: 'pool',        l: 'בריכה',        Icon: FaSwimmingPool },
  { k: 'kosher',      l: 'מטבח כשר',     Icon: FaUtensils },
  { k: 'solar',       l: 'דוד שמש',      Icon: FaSun },
  { k: 'bars',        l: 'סורגים',       Icon: FaLock },
  { k: 'unit',        l: 'יחידת דיור',   Icon: FaDoorOpen },
  { k: 'furnished',   l: 'ריהוט',        Icon: FaCouch },
  { k: 'renovated_f', l: 'שיפוץ',        Icon: FaTools },
  { k: 'doorman',     l: 'שוער',         Icon: FaUserShield },
  { k: 'tornado_ac',  l: 'מזגן טורנדו',  Icon: FaWind },
  { k: 'boiler',      l: 'דוד חשמל',     Icon: FaBolt },
]

const COMMERCIAL_AMENITIES = [
  { k: 'kitchenette',    l: 'מטבחון',        Icon: FaUtensils },
  { k: 'alarm',          l: 'אזעקה',          Icon: FaExclamationTriangle },
  { k: 'cameras',        l: 'מצלמות אבטחה',  Icon: FaCamera },
  { k: 'conf_room',      l: 'חדר ישיבות',    Icon: FaUsers },
  { k: 'comm_room',      l: 'חדר תקשורת',    Icon: FaWifi },
  { k: 'mamak',          l: 'ממק',            Icon: FaBriefcase },
  { k: 'accessible',     l: 'גישה לנכים',    Icon: FaWheelchair },
  { k: 'elevator',       l: 'מעלית',          Icon: FaBuilding },
  { k: 'parking',        l: 'חניה',           Icon: FaCar },
  { k: 'ac',             l: 'מיזוג',          Icon: FaSnowflake },
  { k: 'storage',        l: 'מחסן',           Icon: FaBox },
  { k: 'shelter',        l: 'ממ"ד',           Icon: FaShieldAlt },
]

const VIEWS      = ['ללא', 'ים', 'פארק', 'עיר', 'טבע']
const DIRECTIONS = ['1', '2', '3', '4']

const HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                   'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
const HE_DAYS   = ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳']

const INIT = {
  txType: 'sale', propType: '',
  city: '', street: '', houseNum: '', floor: '', totalFloors: '',
  onPilotis: false, neighborhood: '', area: '', district: '',
  rooms: '', bathrooms: 1, parking: 0, balconies: 0,
  size: '', sqmBuilt: '', condition: '', directions: '', view: '',
  amenities: {},
  price: '', priceOnInquiry: false, entryDate: '', entryFlex: false,
  description: '',
  media: [],    // { url, name, type:'image'|'video', thumbnail? }
  contactName: '', contactPhone: '',
  gush: '', helka: '', mapsUrl: '', landingPageUrl: '', youtubeUrl: '',
  logo: '',
  pdfs: [],  // [{name, url}] — uploaded project PDFs
}

const parsePrice = raw => raw.replace(/[^\d]/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,',')

// Wizard data → App.jsx property format
const inferCategory = propType => {
  if (['קרקע חקלאית','מגרש','קרקע מסחרית'].includes(propType)) return 'land'
  if (['בית פרטי / קוטג׳','דו משפחתי','נחלה'].includes(propType)) return 'projects'
  if (COMMERCIAL_TYPES.includes(propType)) return 'commercial'
  return 'apartments'
}

export function wizardToProperty(d, isDraft) {
  const amenMap = {
    accessible: 'accessible', ac: 'airCon', elevator: 'elevator',
    parking: 'parking', storage: 'storage', shelter: 'safeRoom',
    balcony: 'balcony', solar: 'solarBoiler', bars: 'bars',
    furnished: 'furnished', renovated_f: 'renovated', tornado_ac: 'tornadoAC',
  }
  const amenities = {}
  Object.entries(amenMap).forEach(([wk, ak]) => { amenities[ak] = !!d.amenities[wk] })

  const images = d.media.filter(m => m.type === 'image').map(m => m.url)
  const videoItems = d.media.filter(m => m.type === 'video')

  return {
    id: Date.now(),
    category: inferCategory(d.propType),
    title: `${d.propType}${d.rooms ? `, ${d.rooms} חד׳` : ''}${d.size ? `, ${d.size} מ"ר` : ''} - ${d.city}`,
    type: d.propType,
    txType: d.txType,
    location: d.city,
    street: [d.street, d.houseNum].filter(Boolean).join(' '),
    neighborhood: d.neighborhood || '',
    region: d.area || 'השרון',
    district: d.district || '',
    floor: d.floor || '',
    totalFloors: d.totalFloors || '',
    rooms: d.rooms || '',
    bathrooms: d.bathrooms,
    parking: d.parking > 0,
    parkingCount: d.parking,
    balcony: d.balconies > 0,
    balconies: d.balconies,
    size: d.size || '',
    buildSqm: d.sqmBuilt || '',
    condition: CONDITIONS.find(c => c.v === d.condition)?.l || '',
    direction: d.directions || '',
    view: d.view || '',
    price: d.priceOnInquiry ? 0 : (d.price ? Number(d.price.replace(/,/g,'')) : 0),
    priceDisplay: d.priceOnInquiry ? 'מחיר בפנייה' : (d.price ? `₪${d.price}` : ''),
    entryDate: d.entryFlex ? 'גמיש' : d.entryDate,
    description: d.description || '',
    images,
    videos: videoItems.map(v => ({ url: v.url, thumbnail: v.thumbnail || null })),
    videoUrl: d.youtubeUrl || videoItems[0]?.url || '',
    gush: d.gush || '',
    helka: d.helka || '',
    mapsUrl: d.mapsUrl || '',
    landingPageUrl: d.landingPageUrl || '',
    logo: d.logo || '',
    contactName: d.contactName || '',
    contactPhone: d.contactPhone || '',
    status: 'בשיווק',
    published: !isDraft,
    source: 'wizard',
    createdAt: new Date().toISOString(),
    ...amenities,
  }
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────

const P      = '#8490D8'
const G      = '#82F67F'
const DARK   = 'rgba(255,255,255,0.05)'
const BORDER = 'rgba(132,144,216,0.22)'
const TEXT   = '#E8E4D8'
const MUTED  = 'rgba(232,228,216,0.5)'
const BG_CARD = 'rgba(255,255,255,0.04)'
const FONT   = 'Rubik, Heebo, sans-serif'
const BG_INNER = 'linear-gradient(160deg,#0c0820,#08061a)'

const fieldStyle = {
  width: '100%', padding: '13px 16px',
  background: DARK, border: `1.5px solid ${BORDER}`,
  borderRadius: 12, color: TEXT, fontSize: 15,
  fontFamily: FONT, outline: 'none',
  boxSizing: 'border-box', transition: 'border-color .2s',
}
const labelStyle = {
  display: 'block', fontSize: 13, fontWeight: 700, color: MUTED,
  marginBottom: 7, letterSpacing: '.05em', fontFamily: FONT,
}

// ─── Shared UI pieces ────────────────────────────────────────────────────────

function Label({ text, req }) {
  return <label style={labelStyle}>{text}{req && <span style={{ color: P }}> *</span>}</label>
}
function Field({ label, req, children }) {
  return (
    <div style={{ marginBottom: 15 }}>
      {label && <Label text={label} req={req} />}
      {children}
    </div>
  )
}
function Input({ label, req, ...props }) {
  return (
    <Field label={label} req={req}>
      <input style={fieldStyle} {...props}
        onFocus={e => e.target.style.borderColor = P}
        onBlur={e  => e.target.style.borderColor = BORDER}
      />
    </Field>
  )
}
function Select({ label, req, children, value, onChange }) {
  return (
    <Field label={label} req={req}>
      <select value={value} onChange={onChange} className="pw-select"
        style={{ ...fieldStyle, appearance: 'none', cursor: 'pointer',
          color: TEXT, backgroundColor: '#0c0820' }}>
        {children}
      </select>
    </Field>
  )
}
function Counter({ label, value, onChange, min = 0, max = 20 }) {
  return (
    <div style={{ marginBottom: 15 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => onChange(Math.max(min, value - 1))}
          style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${BORDER}`,
            background: DARK, color: TEXT, fontSize: 18, cursor: 'pointer', fontFamily: FONT }}
          onMouseEnter={e => e.target.style.borderColor = P}
          onMouseLeave={e => e.target.style.borderColor = BORDER}>−</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: TEXT, minWidth: 40,
          textAlign: 'center', fontFamily: FONT }}>{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))}
          style={{ width: 38, height: 38, borderRadius: 10, border: `1.5px solid ${BORDER}`,
            background: DARK, color: TEXT, fontSize: 18, cursor: 'pointer', fontFamily: FONT }}
          onMouseEnter={e => e.target.style.borderColor = P}
          onMouseLeave={e => e.target.style.borderColor = BORDER}>+</button>
      </div>
    </div>
  )
}
function ToggleGroup({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: 15 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => {
          const active = value === (o.v || o)
          return (
            <button key={o.v || o} onClick={() => onChange(o.v || o)}
              style={{ padding: '8px 18px', borderRadius: 10,
                border: `1.5px solid ${active ? P : BORDER}`,
                background: active ? P + '22' : DARK,
                color: active ? P : TEXT, fontSize: 14, cursor: 'pointer',
                fontFamily: FONT, fontWeight: active ? 700 : 400, transition: 'all .2s' }}>
              {o.l || o}
              {o.d && <span style={{ fontSize: 11, color: MUTED, display: 'block', marginTop: 1 }}>{o.d}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
function CheckGrid({ items, checked, onChange }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 7 }}>
      {items.map(it => {
        const on = !!checked[it.k]
        return (
          <button key={it.k} onClick={() => onChange({ ...checked, [it.k]: !on })}
            style={{ padding: '8px 10px', borderRadius: 12,
              border: `1.5px solid ${on ? P : BORDER}`,
              background: on ? P + '22' : DARK,
              color: on ? P : TEXT, fontSize: 13.5, cursor: 'pointer',
              transition: 'all .18s', textAlign: 'right', fontFamily: FONT,
              display: 'flex', alignItems: 'center', gap: 8 }}>
            <it.Icon size={15} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: on ? 700 : 400 }}>{it.l}</span>
            {on && <FaCheck size={11} style={{ marginRight: 'auto', flexShrink: 0 }} />}
          </button>
        )
      })}
    </div>
  )
}

// ─── Calendar Picker ──────────────────────────────────────────────────────────

function CalendarPicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const today           = new Date(); today.setHours(0,0,0,0)
  const selected        = value ? new Date(value + 'T00:00:00') : null
  const thisYear        = today.getFullYear()
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = e => { if (!containerRef.current?.contains(e.target)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  const firstDay    = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)]

  const prevMonth = () => setView(v => v.month === 0  ? {year: v.year - 1, month: 11} : {year: v.year, month: v.month - 1})
  const nextMonth = () => setView(v => v.month === 11 ? {year: v.year + 1, month: 0}  : {year: v.year, month: v.month + 1})

  const select = day => {
    if (!day || disabled) return
    const d = new Date(view.year, view.month, day)
    onChange(d.toISOString().split('T')[0])
    setOpen(false)
  }

  const displayDate = selected
    ? selected.toLocaleDateString('he-IL', {day: '2-digit', month: '2-digit', year: 'numeric'})
    : ''

  const navBtn = {
    width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`,
    background: DARK, color: TEXT, cursor: 'pointer', fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: FONT, transition: 'all .15s', flexShrink: 0,
  }

  const dropdownStyle = {
    background: '#0c0820', border: `1px solid ${BORDER}`, borderRadius: 8,
    color: TEXT, fontSize: 14, fontFamily: FONT, padding: '5px 10px',
    cursor: 'pointer', outline: 'none', fontWeight: 700,
    appearance: 'none', textAlign: 'center',
  }

  // Year range: today → +6 years
  const yearOptions = Array.from({length: 7}, (_, i) => thisYear + i)

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <div onClick={() => !disabled && setOpen(o => !o)}
        style={{ ...fieldStyle, cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: displayDate ? TEXT : MUTED, fontFamily: FONT }}>
          {displayDate || 'בחר תאריך...'}
        </span>
        <FaCalendarAlt size={14} style={{ color: MUTED, flexShrink: 0 }} />
      </div>

      {/* Inline calendar */}
      {open && (
        <div style={{ marginTop: 8, background: '#0f0d22',
          border: `1.5px solid ${BORDER}`, borderRadius: 16, padding: '14px 16px',
          boxShadow: `0 8px 32px rgba(0,0,0,.7)`, direction: 'ltr' }}>

          {/* Navigation row — LTR: [‹ prev] [Month ▾] [Year ▾] [next ›] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8,
            justifyContent: 'space-between', marginBottom: 14 }}>

            {/* ← Previous month */}
            <button style={navBtn} onClick={prevMonth} title="חודש קודם"
              onMouseEnter={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.color = P }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT }}>
              ‹
            </button>

            {/* Month + Year dropdowns */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
              <select
                value={view.month}
                onChange={e => setView(v => ({...v, month: Number(e.target.value)}))}
                style={dropdownStyle}
                className="pw-select">
                {HE_MONTHS.map((m, i) => (
                  <option key={i} value={i} style={{ background: '#0c0820', color: TEXT }}>{m}</option>
                ))}
              </select>
              <select
                value={view.year}
                onChange={e => setView(v => ({...v, year: Number(e.target.value)}))}
                style={{...dropdownStyle, minWidth: 68}}
                className="pw-select">
                {yearOptions.map(y => (
                  <option key={y} value={y} style={{ background: '#0c0820', color: TEXT }}>{y}</option>
                ))}
              </select>
            </div>

            {/* Next month → */}
            <button style={navBtn} onClick={nextMonth} title="חודש הבא"
              onMouseEnter={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.color = P }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT }}>
              ›
            </button>
          </div>

          {/* Day-of-week header — RTL: א׳ on right, ש׳ on left */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2,
            marginBottom: 6, direction: 'rtl' }}>
            {HE_DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, color: MUTED,
                fontWeight: 700, fontFamily: FONT, padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Days grid — RTL so Sunday (index 0) is rightmost */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, direction: 'rtl' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} />
              const thisDate = new Date(view.year, view.month, day); thisDate.setHours(0,0,0,0)
              const isToday  = thisDate.getTime() === today.getTime()
              const isSel    = selected && thisDate.getTime() === selected.getTime()
              const isPast   = thisDate < today
              return (
                <button key={day} onClick={() => !isPast && select(day)}
                  style={{ padding: '9px 4px', borderRadius: 8, border: 'none',
                    background: isSel ? P : isToday ? `${P}30` : 'transparent',
                    color: isSel ? '#fff' : isPast ? MUTED : isToday ? P : TEXT,
                    fontSize: 13, cursor: isPast ? 'not-allowed' : 'pointer',
                    fontWeight: isSel || isToday ? 700 : 400, fontFamily: FONT,
                    transition: 'background .12s', opacity: isPast ? 0.38 : 1 }}>
                  {day}
                </button>
              )
            })}
          </div>

          {/* Quick actions row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}` }}>
            <button onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })}
              style={{ padding: '5px 14px', background: `${P}20`, border: `1px solid ${P}44`,
                borderRadius: 8, color: P, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT }}>
              היום
            </button>
            {selected && (
              <button onClick={() => { onChange(''); setOpen(false) }}
                style={{ padding: '5px 14px', background: 'transparent', border: `1px solid ${BORDER}`,
                  borderRadius: 8, color: MUTED, fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
                נקה בחירה
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Publish Decision Modal ────────────────────────────────────────────────────

function PublishModal({ onPublish, onDraft, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      padding: 20, direction: 'rtl' }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'linear-gradient(160deg,#0d0b1f,#0a0818)',
        border: `1.5px solid ${BORDER}`, borderRadius: 22,
        padding: '32px 28px', boxShadow: `0 24px 60px rgba(0,0,0,.8), 0 0 0 1px ${P}44`,
        fontFamily: FONT }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>
            <FaCheck size={30} style={{ color: G }} />
          </div>
          <h2 style={{ color: TEXT, fontSize: 22, fontWeight: 900, margin: '0 0 10px', fontFamily: FONT }}>
            כמעט שם!
          </h2>
          <p style={{ color: MUTED, fontSize: 14.5, lineHeight: 1.7, margin: 0, fontFamily: FONT }}>
            האם תרצה לשמור את הנכס בטיוטות או לפרסם באתר?
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Publish CTA */}
          <button onClick={onPublish}
            style={{ padding: '16px 20px', borderRadius: 14, border: 'none',
              background: P, color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', fontFamily: FONT, transition: 'all .2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: `0 6px 24px ${P}55` }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.12)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
            <FaGlobe size={15} />
            <div>
              <div>פרסם באתר</div>
              <div style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>
                הנכס יופיע מיד בחיפוש ובדפי המשרד
              </div>
            </div>
          </button>

          {/* Draft option */}
          <button onClick={onDraft}
            style={{ padding: '16px 20px', borderRadius: 14,
              border: `1.5px solid ${BORDER}`, background: DARK,
              color: TEXT, fontSize: 15, fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT, transition: 'all .2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.color = P }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT }}>
            <FaSave size={14} />
            <div>
              <div>שמור כטיוטה</div>
              <div style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>
                לא גלוי לציבור — ניתן לפרסם מאוחר יותר
              </div>
            </div>
          </button>

          {/* Cancel */}
          <button onClick={onCancel}
            style={{ padding: '9px 16px', background: 'none', border: 'none',
              color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
              textAlign: 'center', transition: 'color .2s' }}
            onMouseEnter={e => e.currentTarget.style.color = TEXT}
            onMouseLeave={e => e.currentTarget.style.color = MUTED}>
            ← חזרה לסיכום
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Step components ──────────────────────────────────────────────────────────

function Step1({ d, upd }) {
  return (
    <div>
      <h3 style={{ color: TEXT, fontSize: 20, fontWeight: 800, marginBottom: 24, marginTop: 0, fontFamily: FONT }}>
        סוג עסקה
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
        {[
          { v: 'sale', l: 'מכירה', d: 'אני מוכר נכס',  Icon: FaHome },
          { v: 'rent', l: 'השכרה', d: 'אני משכיר נכס', Icon: FaKey  },
        ].map(o => {
          const on = d.txType === o.v
          return (
            <button key={o.v} onClick={() => upd('txType', o.v)}
              style={{ padding: '22px 16px', borderRadius: 16,
                border: `2px solid ${on ? P : BORDER}`, background: on ? P + '18' : DARK,
                color: on ? P : TEXT, cursor: 'pointer', transition: 'all .22s',
                textAlign: 'center', fontFamily: FONT }}>
              <o.Icon size={28} style={{ marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
              <div style={{ fontSize: 17, fontWeight: 800 }}>{o.l}</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>{o.d}</div>
            </button>
          )
        })}
      </div>
      <Field label="סוג נכס" req>
        <select value={d.propType} onChange={e => upd('propType', e.target.value)}
          className="pw-select"
          style={{ ...fieldStyle, appearance: 'none', cursor: 'pointer', color: TEXT, backgroundColor: '#0c0820' }}>
          <option value="" style={{ background: '#0c0820', color: TEXT }}>בחר סוג נכס...</option>
          {PROPERTY_TYPES.map(t => (
            <option key={t} value={t} style={{ background: '#0c0820', color: TEXT }}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="שם המפרסם / איש קשר" req>
        <input style={fieldStyle} value={d.contactName} placeholder="שם מלא"
          onChange={e => upd('contactName', e.target.value)}
          onFocus={e => e.target.style.borderColor = P}
          onBlur={e  => e.target.style.borderColor = BORDER} />
      </Field>
      <Field label="טלפון ליצירת קשר" req>
        <input style={fieldStyle} value={d.contactPhone} placeholder="05X-XXXXXXX" dir="ltr"
          onChange={e => upd('contactPhone', e.target.value)}
          onFocus={e => e.target.style.borderColor = P}
          onBlur={e  => e.target.style.borderColor = BORDER} />
      </Field>
    </div>
  )
}

function Step2({ d, upd }) {
  return (
    <div>
      <h3 style={{ color: TEXT, fontSize: 20, fontWeight: 800, marginBottom: 24, marginTop: 0, fontFamily: FONT }}>
        כתובת הנכס
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="ישוב / עיר" req value={d.city}
            onChange={e => upd('city', e.target.value)} placeholder="לדוג׳: הרצליה, רעננה, כפר סבא..." />
        </div>
        <Input label="רחוב" req value={d.street}
          onChange={e => upd('street', e.target.value)} placeholder="שם הרחוב" />
        <Input label='מס׳ בית' req value={d.houseNum}
          onChange={e => upd('houseNum', e.target.value)} placeholder="מספר" />
        <Input label="קומה" value={d.floor}
          onChange={e => upd('floor', e.target.value)} placeholder="מספר קומה" />
        <Input label='סה"כ קומות בבניין' value={d.totalFloors}
          onChange={e => upd('totalFloors', e.target.value)} placeholder="מספר" />
        <div style={{ gridColumn: '1 / -1' }}>
          <Input label="שכונה" value={d.neighborhood}
            onChange={e => upd('neighborhood', e.target.value)} placeholder="שם השכונה (אופציונלי)" />
        </div>
        <Input label="אזור" value={d.area}
          onChange={e => upd('area', e.target.value)} placeholder='לדוג׳: שרון, גוש דן...' />
        <Input label="מחוז" value={d.district}
          onChange={e => upd('district', e.target.value)} placeholder='מחוז' />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, padding: '12px 16px',
        background: DARK, borderRadius: 10, border: `1px solid ${BORDER}` }}>
        <input type="checkbox" id="pilotis" checked={d.onPilotis}
          onChange={e => upd('onPilotis', e.target.checked)}
          style={{ width: 16, height: 16, accentColor: P, cursor: 'pointer' }} />
        <label htmlFor="pilotis" style={{ color: TEXT, fontSize: 14, cursor: 'pointer', fontFamily: FONT }}>
          על עמודים (פילוטיס)
        </label>
      </div>

      {/* Gush / Helka + Maps URL */}
      <div style={{ marginTop: 20, padding: '16px 18px', background: DARK, borderRadius: 12, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: P, marginBottom: 14, fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
          🗺️ גוש, חלקה וקישורים
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>גוש (GovMap)</label>
            <input value={d.gush} placeholder="לדוג׳: 40095"
              onChange={e => upd('gush', e.target.value)}
              style={{ ...fieldStyle, direction: 'ltr' }}
              onFocus={e => e.target.style.borderColor = P}
              onBlur={e  => e.target.style.borderColor = BORDER} />
          </div>
          <div>
            <label style={labelStyle}>חלקה (GovMap)</label>
            <input value={d.helka} placeholder="לדוג׳: 13"
              onChange={e => upd('helka', e.target.value)}
              style={{ ...fieldStyle, direction: 'ltr' }}
              onFocus={e => e.target.style.borderColor = P}
              onBlur={e  => e.target.style.borderColor = BORDER} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>קישור גוגל מאפ (אופציונלי)</label>
          <input value={d.mapsUrl} placeholder="https://maps.google.com/..."
            onChange={e => upd('mapsUrl', e.target.value)}
            style={{ ...fieldStyle, direction: 'ltr' }}
            onFocus={e => e.target.style.borderColor = P}
            onBlur={e  => e.target.style.borderColor = BORDER} />
        </div>
      </div>
    </div>
  )
}

function Step3({ d, upd }) {
  return (
    <div>
      <h3 style={{ color: TEXT, fontSize: 18, fontWeight: 800, marginBottom: 16, marginTop: 0, fontFamily: FONT }}>
        פרטי הנכס
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
        <Select label="מספר חדרים" req value={d.rooms} onChange={e => upd('rooms', e.target.value)}>
          <option value="" style={{ background: '#0c0820', color: TEXT }}>בחר...</option>
          {['1','1.5','2','2.5','3','3.5','4','4.5','5','5.5','6','6.5','7','7.5','8','8.5','9','9.5','10','10+'].map(r => (
            <option key={r} value={r} style={{ background: '#0c0820', color: TEXT }}>{r} חדרים</option>
          ))}
        </Select>
        <Counter label="חדרי מקלחת" value={d.bathrooms} min={1} max={8} onChange={v => upd('bathrooms', v)} />
        <Counter label="חניות" value={d.parking} min={0} max={5} onChange={v => upd('parking', v)} />
        <Counter label="מרפסות" value={d.balconies} min={0} max={5} onChange={v => upd('balconies', v)} />
        <Input label='גודל הנכס במ"ר' req value={d.size} placeholder="לדוג׳: 85"
          onChange={e => upd('size', e.target.value)} />
        <Input label='מ"ר בנוי' value={d.sqmBuilt} placeholder="לדוג׳: 75"
          onChange={e => upd('sqmBuilt', e.target.value)} />
      </div>
      <ToggleGroup label="מצב הנכס" options={CONDITIONS} value={d.condition} onChange={v => upd('condition', v)} />
      <ToggleGroup label="כיווני אוויר" options={DIRECTIONS} value={d.directions} onChange={v => upd('directions', v)} />
      <ToggleGroup label="נוף פתוח" options={VIEWS} value={d.view} onChange={v => upd('view', v)} />
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>מאפייני הנכס</label>
        {COMMERCIAL_TYPES.includes(d.propType) ? (
          <CheckGrid items={COMMERCIAL_AMENITIES} checked={d.amenities} onChange={a => upd('amenities', a)} />
        ) : (
          <CheckGrid items={AMENITIES} checked={d.amenities} onChange={a => upd('amenities', a)} />
        )}
      </div>
    </div>
  )
}

function Step4({ d, upd }) {
  const perSqm = d.price && d.size
    ? Math.round(Number(d.price.replace(/,/g,'')) / Number(d.size)).toLocaleString('he-IL')
    : ''
  return (
    <div>
      <h3 style={{ color: TEXT, fontSize: 20, fontWeight: 800, marginBottom: 24, marginTop: 0, fontFamily: FONT }}>
        מחיר ותאריכים
      </h3>
      <Field label={d.txType === 'rent' ? 'שכר דירה חודשי (₪)' : 'מחיר (₪)'} req={!d.priceOnInquiry}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
          color: TEXT, fontSize: 14, fontFamily: FONT, marginBottom: 10 }}>
          <input type="checkbox" checked={!!d.priceOnInquiry}
            onChange={e => { upd('priceOnInquiry', e.target.checked); if (e.target.checked) upd('price', '') }}
            style={{ width: 16, height: 16, accentColor: P, cursor: 'pointer' }} />
          מחיר בפנייה (אין להציג מחיר)
        </label>
        {!d.priceOnInquiry && (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              color: MUTED, fontSize: 15, pointerEvents: 'none' }}>₪</span>
            <input value={d.price} placeholder="הכנס מחיר..."
              onChange={e => upd('price', parsePrice(e.target.value))}
              style={{ ...fieldStyle, paddingRight: 36 }} dir="ltr"
              onFocus={e => e.target.style.borderColor = P}
              onBlur={e  => e.target.style.borderColor = BORDER} />
          </div>
        )}
        {d.priceOnInquiry && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: `${P}12`,
            border: `1px solid ${P}30`, color: `${P}CC`, fontSize: 14, fontFamily: FONT, fontWeight: 600 }}>
            מחיר בפנייה — יוצג ללא מחיר בלוח הנכסים
          </div>
        )}
        {perSqm && !d.priceOnInquiry && (
          <div style={{ marginTop: 6, fontSize: 12.5, color: MUTED, fontFamily: FONT }}>≈ ₪{perSqm} למ"ר</div>
        )}
      </Field>
      {d.txType === 'sale' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input label='גודל במ"ר (לחישוב מחיר למ"ר)' value={d.size} placeholder="לדוג׳: 85"
            onChange={e => upd('size', e.target.value)} />
          <Input label='מ"ר בנוי' value={d.sqmBuilt} placeholder="לדוג׳: 75"
            onChange={e => upd('sqmBuilt', e.target.value)} />
        </div>
      )}

      <Field label="תאריך כניסה" req>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            color: TEXT, fontSize: 14, fontFamily: FONT }}>
            <input type="checkbox" checked={d.entryFlex}
              onChange={e => upd('entryFlex', e.target.checked)}
              style={{ width: 16, height: 16, accentColor: P, cursor: 'pointer' }} />
            גמיש / מיידי (ללא תאריך ספציפי)
          </label>
          {!d.entryFlex && (
            <CalendarPicker value={d.entryDate} onChange={v => upd('entryDate', v)} disabled={d.entryFlex} />
          )}
        </div>
      </Field>

      <div style={{ padding: '14px 18px', borderRadius: 12, background: `${G}10`,
        border: `1px solid ${G}30`, color: `${G}CC`, fontSize: 13.5, lineHeight: 1.7,
        display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: FONT }}>
        <FaLightbulb size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span><strong>טיפ:</strong> נכסים עם מחירים ריאליים מקבלים יותר פניות ונמכרים מהר יותר.</span>
      </div>
    </div>
  )
}

const WIZ_API_BASE    = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const WIZ_ADMIN_TOKEN = 'AFIKhanahal2026'

async function callClaudeRewrite(d, _retry = 0) {
  const typeMap = { apartment:'דירה', land:'מגרש', penthouse:'פנטהאוז', villa:'וילה', office:'משרד', commercial:'נכס מסחרי', cottage:'קוטג׳', rooftop:'גג', storage:'מחסן', parking:'חנייה' }
  const condMap = { new:'חדש מקבלן', renovated:'משופץ', good:'במצב טוב', asis:'כמות שהוא' }
  const typeName = typeMap[d.category] || d.category || 'נכס'
  const cond = condMap[d.condition] || ''
  const amenities = AMENITIES.filter(a => d.amenities?.[a.k]).map(a => a.l).join(', ') || ''
  const prompt = `אתה מומחה שיווק נדל"ן ישראלי. כתוב תיאור שיווקי מקצועי ומשכנע בעברית לנכס הבא.

פרטי הנכס:
- סוג: ${typeName}${d.txType === 'rent' ? ' להשכרה' : ' למכירה'}
- כותרת: ${d.title || 'לא צוינה'}
- עיר: ${d.city || 'לא צוינה'}
- שכונה: ${d.neighborhood || ''}
- שטח: ${d.size ? d.size + ' מ"ר' : 'לא צוין'}
- חדרים: ${d.rooms || 'לא צוין'}
- קומה: ${d.floor || 'לא צוינה'}${d.totalFloors ? ' מתוך ' + d.totalFloors : ''}
- מצב: ${cond || 'לא צוין'}
- חניה: ${d.parking > 0 ? d.parking + ' מקומות' : 'אין'}
- מרפסות: ${d.balconies > 0 ? d.balconies : 'אין'}
- מאפיינים: ${amenities || 'לא צוינו'}
- מחיר: ${d.price ? '₪' + Number(d.price).toLocaleString('he-IL') : 'לא צוין'}
- תיאור קיים: ${d.description || '(אין)'}

דרישות:
- 3-4 משפטים שיווקיים, שפה מקצועית ומושכת
- הדגש יתרונות ייחודיים ומיקום
- אל תתחיל בביטויים כמו "הנכס הזה" — הכנס מיד לתוכן
- החזר רק את התיאור, ללא כותרות או הסברים
- מקסימום 380 תווים`

  const endpoint = WIZ_API_BASE
    ? `${WIZ_API_BASE}/api/ai/messages`
    : '/api/ai/messages'
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'Authorization':     `Bearer ${WIZ_ADMIN_TOKEN}`,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    let errMsg = `שגיאת שרת (${res.status})`
    try {
      const errJson = await res.json()
      if (errJson?.error?.type === 'overloaded_error' && _retry < 3) {
        await new Promise(r => setTimeout(r, 2500 * (_retry + 1)))
        return callClaudeRewrite(d, _retry + 1)
      }
      if (errJson?.error?.type === 'overloaded_error')
        throw new Error('השרת עמוס כרגע — נסה שוב בעוד דקה')
      errMsg = errJson?.error?.message || errJson?.message || JSON.stringify(errJson)
    } catch (e) {
      if (e.message.includes('עמוס') || e.message.includes('שרת')) throw e
    }
    throw new Error(errMsg)
  }
  const data = await res.json()
  const text = data.content?.[0]?.text?.trim()
  if (!text) throw new Error('תגובה ריקה מה-AI')
  return text.slice(0, 400)
}

function Step5({ d, upd }) {
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState('')

  const handleAI = async () => {
    setGenerating(true)
    setAiError('')
    try {
      const result = await callClaudeRewrite(d)
      upd('description', result)
    } catch (e) {
      setAiError('שגיאה: ' + (e.message?.slice(0, 120) || 'לא ניתן להתחבר ל-AI'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <h3 style={{ color: TEXT, fontSize: 20, fontWeight: 800, marginBottom: 24, marginTop: 0, fontFamily: FONT }}>
        מה חשוב לדעת על הנכס?
      </h3>
      <Field>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: MUTED, fontFamily: FONT }}>
            תאר את הנכס, בלטי את יתרונותיו, מיקומו, קרבה לתחבורה, מוסדות חינוך וכו׳
          </div>
          <button onClick={handleAI} disabled={generating}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: generating ? `${P}33` : `linear-gradient(135deg,${P},#8b5cf6)`, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: generating ? 'default' : 'pointer', fontFamily: FONT, whiteSpace: 'nowrap', flexShrink: 0, transition: 'opacity .2s', opacity: generating ? .7 : 1 }}>
            {generating ? <FaCircleNotch size={12} style={{ animation: 'spin 1s linear infinite' }}/> : <FaMagic size={12}/>}
            {generating ? 'כותב...' : 'AI שכתוב'}
          </button>
        </div>
        <textarea value={d.description} onChange={e => upd('description', e.target.value)}
          placeholder="זה המקום לתאר את הפרטים הבולטים. למשל: האם נערך שיפוץ? מה שופץ? מה מצב הבניין? כיווני האוויר ברחוב? האם יש גינה / חצר? וכו׳"
          style={{ ...fieldStyle, minHeight: 180, resize: 'vertical', lineHeight: 1.7 }}
          maxLength={400}
          onFocus={e => e.target.style.borderColor = P}
          onBlur={e  => e.target.style.borderColor = BORDER} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <button onClick={handleAI} disabled={generating}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'transparent', border: `1px solid ${P}44`, borderRadius: 6, color: `${P}CC`, fontSize: 12, fontWeight: 600, cursor: generating ? 'default' : 'pointer', fontFamily: FONT, transition: 'border-color .2s' }}
            onMouseEnter={e => !generating && (e.currentTarget.style.borderColor = P)}
            onMouseLeave={e => e.currentTarget.style.borderColor = `${P}44`}>
            <FaSyncAlt size={11} style={{ animation: generating ? 'spin 1s linear infinite' : 'none' }}/>
            שכתוב נוסף
          </button>
          <div style={{ fontSize: 12, color: MUTED, fontFamily: FONT }}>{d.description.length} / 400</div>
        </div>
        {aiError && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(224,82,82,.1)', border: '1px solid rgba(224,82,82,.3)', fontSize: 12, color: '#E05252', fontFamily: FONT }}>
            {aiError}
          </div>
        )}
      </Field>
      <div style={{ padding: '14px 18px', borderRadius: 12, background: `${P}10`,
        border: `1px solid ${P}25`, fontSize: 13.5, color: `${P}CC`, lineHeight: 1.7,
        display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: FONT }}>
        <FaExclamationTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span><strong>שימו לב:</strong> אין לציין מחיר ומספר טלפון בתיאור.</span>
      </div>
    </div>
  )
}

// ─── PDF Uploader ────────────────────────────────────────────────────────────

const UPLOAD_BASE = (import.meta.env.VITE_API_URL || 'https://afik-hanahal-server.onrender.com').replace(/\/$/, '')

function PdfUploader({ pdfs, onUpdate, adminToken }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [err, setErr] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef(null)

  const uploadFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setErr('יש לבחור קובץ PDF בלבד')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setErr('קובץ גדול מדי — מקסימום 25MB')
      return
    }
    setUploading(true)
    setErr('')
    setProgress(0)

    const fd = new FormData()
    fd.append('file', file)

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100))
      })
      xhr.addEventListener('load', () => {
        setUploading(false)
        setProgress(0)
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText)
            if (data.url) {
              onUpdate([...pdfs, { name: data.name || file.name, url: data.url }])
            } else {
              setErr(data.error || 'שגיאה בהעלאה')
            }
          } catch {
            setErr('שגיאה בפענוח תגובה')
          }
        } else {
          try {
            const data = JSON.parse(xhr.responseText)
            setErr(data.error || `שגיאה ${xhr.status}`)
          } catch {
            setErr(`שגיאה ${xhr.status}`)
          }
        }
        resolve()
      })
      xhr.addEventListener('error', () => {
        setUploading(false)
        setErr('שגיאת רשת — בדוק חיבור אינטרנט')
        resolve()
      })
      xhr.open('POST', `${UPLOAD_BASE}/api/upload/pdf`)
      xhr.setRequestHeader('Authorization', `Bearer ${adminToken}`)
      xhr.send(fd)
    })
  }

  const handleFiles = async (files) => {
    for (const file of Array.from(files)) {
      if (pdfs.length >= 5) { setErr('מקסימום 5 קבצי PDF'); break }
      await uploadFile(file)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragOver(false)
    await handleFiles(e.dataTransfer.files)
  }

  const removePdf = (idx) => onUpdate(pdfs.filter((_, i) => i !== idx))

  return (
    <div>
      {/* Drop zone */}
      {pdfs.length < 5 && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false) }}
          onClick={() => !uploading && inputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragOver ? P : BORDER}`,
            borderRadius: 12, background: isDragOver ? `${P}14` : 'transparent',
            padding: '20px 16px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8, cursor: uploading ? 'default' : 'pointer',
            transition: 'all .2s', marginBottom: pdfs.length ? 12 : 0,
          }}>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple style={{ display: 'none' }}
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
          {uploading ? (
            <>
              <FaCircleNotch size={20} style={{ color: P, animation: 'pw-spin 1s linear infinite' }} />
              <div style={{ fontSize: 13, color: P, fontFamily: FONT, fontWeight: 700 }}>מעלה... {progress}%</div>
              <div style={{ width: '100%', maxWidth: 200, height: 4, background: BORDER, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: P, width: `${progress}%`, transition: 'width .2s' }} />
              </div>
            </>
          ) : (
            <>
              <FaFileAlt size={22} style={{ color: isDragOver ? P : MUTED }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: isDragOver ? P : TEXT, fontWeight: 700, fontSize: 14, fontFamily: FONT }}>
                  {isDragOver ? 'שחרר להעלאה' : 'גרור PDF לכאן'}
                </div>
                <div style={{ color: MUTED, fontSize: 12, fontFamily: FONT, marginTop: 3 }}>
                  או <span style={{ color: P, fontWeight: 600 }}>לחץ לבחירה</span> · PDF בלבד · עד 25MB
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {err && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(224,82,82,.1)', border: '1px solid rgba(224,82,82,.3)', color: '#E05252', fontSize: 12, fontFamily: FONT, marginBottom: 8 }}>
          {err}
        </div>
      )}

      {/* PDF list */}
      {pdfs.map((pdf, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: `${P}10`, border: `1px solid ${P}30`, borderRadius: 10, marginBottom: 7 }}>
          <FaFileAlt size={16} style={{ color: P, flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: TEXT, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pdf.name}</span>
          <a href={pdf.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: P, fontWeight: 700, fontFamily: FONT, textDecoration: 'none', padding: '3px 8px', border: `1px solid ${P}44`, borderRadius: 6 }}>
            תצוגה
          </a>
          <button onClick={() => removePdf(i)}
            style={{ background: 'rgba(224,82,82,.12)', border: '1px solid rgba(224,82,82,.35)', borderRadius: 6, color: '#E05252', cursor: 'pointer', fontSize: 11, fontFamily: FONT, padding: '3px 8px' }}>
            הסר
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Step 6: Media upload (images + Cloudinary video) ─────────────────────────

function Step6({ d, upd }) {
  const imgInputRef      = useRef(null)
  const localVidRef      = useRef(null)
  const cloudVidRef      = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [uploadErr, setUploadErr] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)

  const processImageFiles = async files => {
    const remaining = 10 - d.media.filter(m => m.type === 'image').length
    const toAdd = files.filter(f => f.type.startsWith('image/')).slice(0, remaining)
    if (!toAdd.length) return
    const compressed = await Promise.all(toAdd.map(async f => ({
      url: await compressImage(f),
      name: f.name,
      type: 'image',
    })))
    upd('media', [...d.media, ...compressed])
  }

  const addImages = async e => {
    await processImageFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleDrop = async e => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    await processImageFiles(files)
  }

  const handleDragOver = e => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false) }

  // Local file → blob URL (works immediately, no upload needed)
  const addLocalVideos = async e => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const videoCount = d.media.filter(m => m.type === 'video').length
    const remaining  = 3 - videoCount
    const toAdd = files.filter(f => f.type.startsWith('video/')).slice(0, remaining)
    const videos = toAdd.map(f => ({
      url:   URL.createObjectURL(f),
      name:  f.name,
      type:  'video',
      local: true,
    }))
    upd('media', [...d.media, ...videos])
    e.target.value = ''
  }

  // Cloudinary upload → permanent hosted URL
  const addCloudinaryVideo = async e => {
    const file = e.target.files[0]
    if (!file) return
    setUploadErr('')

    if (CLOUDINARY_CLOUD === 'your-cloud-name') {
      setUploadErr('יש להגדיר את שם הענן (CLOUDINARY_CLOUD) בקוד לפני העלאת סרטונים.')
      e.target.value = ''
      return
    }

    setUploading(true)
    setProgress(0)
    try {
      const result = await uploadToCloudinary(file, setProgress)
      const thumbnail = result.secure_url
        .replace('/video/upload/', '/video/upload/so_0.0,f_jpg/')
        .replace(/\.(mp4|mov|avi|webm|ogg)$/i, '.jpg')
      upd('media', [...d.media, {
        url: result.secure_url,
        name: file.name,
        type: 'video',
        thumbnail,
        cloudinaryId: result.public_id,
      }])
    } catch (err) {
      setUploadErr(`שגיאה בהעלאה: ${err.message}`)
    } finally {
      setUploading(false)
      setProgress(0)
      e.target.value = ''
    }
  }

  const remove = idx => upd('media', d.media.filter((_, i) => i !== idx))
  const imgCount   = d.media.filter(m => m.type === 'image').length
  const videoCount = d.media.filter(m => m.type === 'video').length

  return (
    <div>
      <h3 style={{ color: TEXT, fontSize: 20, fontWeight: 800, marginBottom: 8, marginTop: 0, fontFamily: FONT }}>
        תמונות וסרטונים
      </h3>
      <p style={{ color: MUTED, fontSize: 14, marginBottom: 24, lineHeight: 1.7, fontFamily: FONT }}>
        עד 10 תמונות + עד 3 סרטונים. תמונות איכותיות מגדילות משמעותית את הסיכוי למכירה מהירה.
      </p>

      {/* Hidden inputs */}
      <input ref={imgInputRef}  type="file" accept="image/*"  multiple style={{ display: 'none' }} onChange={addImages} />
      <input ref={localVidRef}  type="file" accept="video/*"  multiple style={{ display: 'none' }} onChange={addLocalVideos} />
      <input ref={cloudVidRef}  type="file" accept="video/*"           style={{ display: 'none' }} onChange={addCloudinaryVideo} />

      {/* Drag & drop zone */}
      {imgCount < 10 && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => imgInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragOver ? P : BORDER}`,
            borderRadius: 16,
            background: isDragOver ? `${P}14` : DARK,
            padding: '36px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            cursor: 'pointer', marginBottom: 14, transition: 'all .2s',
            transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
          }}
        >
          <div style={{ width: 56, height: 56, borderRadius: '50%',
            background: isDragOver ? `${P}22` : `${P}14`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}>
            <FaCloudUploadAlt size={24} style={{ color: isDragOver ? P : MUTED, transition: 'color .2s' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: isDragOver ? P : TEXT, fontWeight: 700, fontSize: 15, fontFamily: FONT, marginBottom: 4 }}>
              {isDragOver ? 'שחרר להוספה' : 'גרור תמונות לכאן'}
            </div>
            <div style={{ color: MUTED, fontSize: 13, fontFamily: FONT }}>
              או <span style={{ color: P, fontWeight: 600 }}>לחץ לבחירת קבצים</span> &nbsp;·&nbsp; {imgCount}/10 תמונות
            </div>
          </div>
        </div>
      )}

      {/* Video upload — up to 3 videos */}
      {videoCount < 3 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Local file (blob URL — works offline) */}
            <button onClick={() => localVidRef.current?.click()}
              style={{ flex: 1, padding: '13px 10px', borderRadius: 12,
                border: `1px solid ${BORDER}`, background: 'transparent',
                color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.color = P }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = MUTED }}>
              <FaVideo size={15} />
              <span>העלה מהמחשב</span>
            </button>

            {/* Cloudinary (permanent hosted URL) */}
            <button onClick={() => !uploading && cloudVidRef.current?.click()}
              style={{ flex: 1, padding: '13px 10px', borderRadius: 12,
                border: `1px solid ${uploading ? P : BORDER}`,
                background: uploading ? `${P}12` : 'transparent',
                color: uploading ? P : MUTED, fontSize: 13,
                cursor: uploading ? 'default' : 'pointer', fontFamily: FONT,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all .2s' }}>
              {uploading ? (
                <>
                  <FaCircleNotch size={14} style={{ animation: 'pw-spin 1s linear infinite' }} />
                  <span>{progress}%</span>
                  <div style={{ flex: 1, height: 3, background: BORDER, borderRadius: 2, overflow: 'hidden', maxWidth: 80 }}>
                    <div style={{ height: '100%', background: P, width: `${progress}%`, transition: 'width .2s' }} />
                  </div>
                </>
              ) : (
                <>
                  <FaCloudUploadAlt size={15} />
                  <span>העלאה (Cloudinary)</span>
                </>
              )}
            </button>
          </div>

          {/* Counter + hint */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: MUTED, fontFamily: FONT }}>
            <span>סרטונים: {videoCount}/3</span>
            {videoCount > 0 && <span style={{ color: `${P}BB` }}>✓ סרטון מהמחשב עובד מקומית — Cloudinary לפרסום מקוון</span>}
          </div>
        </div>
      )}

      {uploadErr && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#ff444418',
          border: '1px solid #ff444440', color: '#ff8888', fontSize: 13, marginBottom: 16, fontFamily: FONT }}>
          {uploadErr}
        </div>
      )}

      {/* External links: YouTube + Landing page */}
      <div style={{ marginBottom: 16, padding: '16px 18px', background: DARK, borderRadius: 12, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: P, marginBottom: 14, fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 6 }}>
          🔗 קישורים חיצוניים
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>קישור יוטיוב / סרטון</label>
            <input value={d.youtubeUrl || ''} placeholder="https://www.youtube.com/watch?v=..."
              onChange={e => upd('youtubeUrl', e.target.value)}
              style={{ ...fieldStyle, direction: 'ltr' }}
              onFocus={e => e.target.style.borderColor = P}
              onBlur={e  => e.target.style.borderColor = BORDER} />
            {d.youtubeUrl && !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(d.youtubeUrl) && (
              <div style={{ marginTop: 4, fontSize: 11.5, color: '#F7C948', fontFamily: FONT }}>
                ⚠️ אנא הכנס קישור יוטיוב תקין
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>דף נחיתה / קישור חיצוני</label>
            <input value={d.landingPageUrl || ''} placeholder="https://..."
              onChange={e => upd('landingPageUrl', e.target.value)}
              style={{ ...fieldStyle, direction: 'ltr' }}
              onFocus={e => e.target.style.borderColor = P}
              onBlur={e  => e.target.style.borderColor = BORDER} />
          </div>
        </div>
      </div>

      {/* Project logo */}
      <div style={{ marginBottom: 16, padding: '14px 18px', background: DARK, borderRadius: 12, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: P, marginBottom: 12, fontFamily: FONT }}>
          לוגו הפרויקט <span style={{ fontWeight: 400, color: MUTED, fontSize: 12 }}>— יוצג מתחת לגלריית התמונות</span>
        </div>
        {d.logo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src={d.logo} alt="לוגו" style={{ height: 60, maxWidth: 140, objectFit: 'contain',
              background: 'rgba(255,255,255,.06)', borderRadius: 10, border: `1px solid ${BORDER}`, padding: 6 }} />
            <button onClick={() => upd('logo', '')}
              style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(224,82,82,.4)',
                background: 'rgba(224,82,82,.1)', color: '#E05252', cursor: 'pointer', fontSize: 12, fontFamily: FONT }}>
              הסר לוגו
            </button>
          </div>
        ) : (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px',
            borderRadius: 10, border: `1.5px dashed ${BORDER}`, cursor: 'pointer',
            color: MUTED, fontSize: 13, fontFamily: FONT, transition: 'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.color = P }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = MUTED }}>
            <FaCloudUploadAlt size={14} />
            העלה לוגו — PNG / SVG / JPEG
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async e => {
              const f = e.target.files[0]
              if (!f) return
              const url = await compressImage(f)
              upd('logo', url)
              e.target.value = ''
            }} />
          </label>
        )}
      </div>

      {/* Media grid — drag to reorder images */}
      {d.media.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: MUTED, fontFamily: FONT, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ opacity: .6 }}>↕</span> גרור תמונות לשינוי סדר · תמונה ראשונה = תמונה ראשית
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 10 }}>
            {d.media.map((item, i) => (
              <div
                key={i}
                draggable={item.type === 'image'}
                onDragStart={() => setDragIdx(i)}
                onDragOver={e => { e.preventDefault() }}
                onDrop={e => {
                  e.preventDefault()
                  if (dragIdx === null || dragIdx === i) return
                  const next = [...d.media]
                  const [moved] = next.splice(dragIdx, 1)
                  next.splice(i, 0, moved)
                  upd('media', next)
                  setDragIdx(null)
                }}
                onDragEnd={() => setDragIdx(null)}
                style={{
                  position: 'relative', aspectRatio: '4/3',
                  borderRadius: 12, overflow: 'hidden',
                  border: dragIdx === i ? `2px solid ${P}` : `1px solid ${BORDER}`,
                  cursor: item.type === 'image' ? 'grab' : 'default',
                  opacity: dragIdx === i ? 0.5 : 1,
                  transition: 'opacity .15s, border-color .15s',
                }}>
                {item.type === 'video' ? (
                  <>
                    {item.thumbnail
                      ? <img src={item.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <video src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />
                    }
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                        <FaPlay size={14} style={{ color: '#fff', marginRight: -2 }} />
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: 6, right: 6, background: `${P}EE`,
                      color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px',
                      borderRadius: 5, fontFamily: FONT, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FaVideo size={9} /> וידאו
                    </div>
                  </>
                ) : (
                  <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                )}
                {i === 0 && item.type === 'image' && (
                  <div style={{ position: 'absolute', top: 6, right: 6, background: P,
                    color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '3px 8px',
                    borderRadius: 6, fontFamily: FONT }}>ראשית</div>
                )}
                <button onClick={() => remove(i)}
                  style={{ position: 'absolute', top: 6, left: 6, width: 24, height: 24,
                    borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none',
                    color: '#fff', cursor: 'pointer', fontSize: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 20, padding: '14px 18px', borderRadius: 12,
        background: `${G}10`, border: `1px solid ${G}25`, color: `${G}CC`, fontSize: 13.5,
        lineHeight: 1.7, fontFamily: FONT, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <FaCamera size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span><strong>המלצות:</strong> אור טבעי, חדרים מסודרים, מבט רחב. תמונת הכניסה / סלון כתמונה ראשית.</span>
      </div>
    </div>
  )
}

// ─── Step 7: Summary ──────────────────────────────────────────────────────────

const SUMMARY_ROWS = [
  { key: 'txType',      Icon: FaTag,          label: 'סוג עסקה',  fmt: (v)    => v === 'sale' ? 'מכירה' : 'השכרה' },
  { key: 'propType',    Icon: FaHome,          label: 'סוג נכס',   fmt: (v)    => v },
  { key: '_address',    Icon: FaMapMarkerAlt,  label: 'כתובת',     fmt: (_,d)  => [d.street, d.houseNum, d.city, d.neighborhood].filter(Boolean).join(', ') },
  { key: '_floor',      Icon: FaLayerGroup,    label: 'קומה',      fmt: (_,d)  => d.floor ? `${d.floor}${d.totalFloors ? ` / ${d.totalFloors}` : ''}` : '' },
  { key: 'rooms',       Icon: FaBed,           label: 'חדרים',     fmt: (v)    => v ? `${v} חדרים` : '' },
  { key: 'size',        Icon: FaRulerCombined, label: 'שטח',       fmt: (v)    => v ? `${v} מ"ר` : '' },
  { key: '_condition',  Icon: FaCheck,         label: 'מצב',       fmt: (_,d)  => CONDITIONS.find(c => c.v === d.condition)?.l || '' },
  { key: 'price',       Icon: FaMoneyBill,     label: 'מחיר',      fmt: (v)    => v ? `₪${v}` : '' },
  { key: '_entry',      Icon: FaCalendarAlt,   label: 'כניסה',     fmt: (_,d)  => d.entryFlex ? 'גמיש / מיידי' : d.entryDate },
  { key: '_amenities',  Icon: FaCog,           label: 'מאפיינים',  fmt: (_,d)  => AMENITIES.filter(a => d.amenities[a.k]).map(a => a.l).join(' • ') },
  { key: 'description', Icon: FaFileAlt,       label: 'תיאור',     fmt: (v)    => v },
  { key: '_contact',    Icon: FaPhone,         label: 'איש קשר',   fmt: (_,d)  => `${d.contactName} | ${d.contactPhone}` },
]

function Step7({ d }) {
  const summaryText = [
    `סוג עסקה: ${d.txType === 'sale' ? 'מכירה' : 'השכרה'}`,
    `סוג נכס: ${d.propType}`,
    `כתובת: ${d.street} ${d.houseNum}, ${d.city}`,
    d.rooms     ? `חדרים: ${d.rooms}` : '',
    d.size      ? `שטח: ${d.size} מ"ר` : '',
    d.price     ? `מחיר: ₪${d.price}` : '',
    d.entryDate ? `כניסה: ${d.entryFlex ? 'גמיש' : d.entryDate}` : '',
    d.description ? `תיאור: ${d.description}` : '',
    `איש קשר: ${d.contactName} | ${d.contactPhone}`,
    '',
    'פורסם דרך מערכת אפיק הנחל נדל"ן',
  ].filter(Boolean).join('\n')

  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(summaryText).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }, [summaryText])

  return (
    <div>
      <h3 style={{ color: TEXT, fontSize: 20, fontWeight: 800, marginBottom: 24, marginTop: 0, fontFamily: FONT }}>
        סיכום הנכס
      </h3>
      <div style={{ background: BG_CARD, borderRadius: 18, padding: '20px 22px',
        border: `1.5px solid ${BORDER}`, marginBottom: 24, lineHeight: 1.85 }}>
        {SUMMARY_ROWS.map(row => {
          const val = row.fmt(d[row.key], d)
          if (!val) return null
          return (
            <div key={row.label} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
              <row.Icon size={13} style={{ flexShrink: 0, color: P, marginTop: 3 }} />
              <span style={{ color: MUTED, minWidth: 80, flexShrink: 0, fontSize: 13.5, fontFamily: FONT }}>{row.label}:</span>
              <span style={{ color: TEXT, fontSize: 14, fontWeight: 600, fontFamily: FONT }}>{val}</span>
            </div>
          )
        })}
      </div>
      {d.media.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 8, marginBottom: 24 }}>
          {d.media.map((item, i) => (
            <div key={i} style={{ aspectRatio: '4/3', borderRadius: 10, overflow: 'hidden',
              border: `1px solid ${BORDER}`, position: 'relative' }}>
              <img src={item.thumbnail || item.url} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {item.type === 'video' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: 'rgba(0,0,0,.4)' }}>
                  <FaPlay size={12} style={{ color: '#fff' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <button onClick={copy}
          style={{ padding: '14px', borderRadius: 14, border: `1.5px solid ${P}`,
            background: copied ? P : P + '22', color: copied ? '#fff' : P,
            fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'all .22s', fontFamily: FONT,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <FaCopy size={14} /> {copied ? 'הועתק!' : 'העתק פרטים'}
        </button>
        <button onClick={() => window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}`, '_blank')}
          style={{ padding: '14px', borderRadius: 14, border: `1.5px solid ${G}`,
            background: `${G}22`, color: G, fontSize: 15, fontWeight: 700,
            cursor: 'pointer', transition: 'all .22s', fontFamily: FONT,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          onMouseEnter={e => { e.currentTarget.style.background = G; e.currentTarget.style.color = '#000' }}
          onMouseLeave={e => { e.currentTarget.style.background = `${G}22`; e.currentTarget.style.color = G }}>
          <FaWhatsapp size={16} /> שלח בוואטסאפ
        </button>
      </div>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

const STEP_COMPONENTS = [Step1, Step2, Step3, Step4, Step5, Step6, Step7]

const WIZARD_DRAFT_KEY = 'afik_wizard_draft'

export default function PropertyWizard({ onClose, onPublish }) {
  const [step, setStep]             = useState(1)
  const [data, setData]             = useState(() => {
    try {
      const saved = localStorage.getItem(WIZARD_DRAFT_KEY)
      return saved ? { ...INIT, ...JSON.parse(saved) } : INIT
    } catch { return INIT }
  })
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const glowRef = useRef(null)

  // Auto-save on every change
  useEffect(() => {
    try { localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(data)) } catch {}
  }, [data])

  const handleSaveDraft = () => {
    try { localStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(data)) } catch {}
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2500)
  }

  const upd = useCallback((key, val) => setData(prev => ({ ...prev, [key]: val })), [])

  const handleMouseMove = useCallback(e => {
    if (!glowRef.current) return
    const rect  = glowRef.current.getBoundingClientRect()
    const angle = Math.atan2(e.clientY - (rect.top + rect.height/2), e.clientX - (rect.left + rect.width/2))
    glowRef.current.style.setProperty('--bh-rot', `${angle}rad`)
  }, [])

  const canNext = () => {
    if (step === 1) return data.txType && data.propType && data.contactName && data.contactPhone
    if (step === 2) return data.city && data.street && data.houseNum
    if (step === 3) return data.rooms && data.size && data.condition
    return true
  }

  const handleFinish = () => setShowPublishModal(true)

  const handlePublish = (isDraft) => {
    setShowPublishModal(false)
    if (!isDraft) {
      try { localStorage.removeItem(WIZARD_DRAFT_KEY) } catch {}
    }
    if (onPublish) {
      onPublish(wizardToProperty(data, isDraft), isDraft)
    } else {
      onClose()
    }
  }

  const StepComp = STEP_COMPONENTS[step - 1]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
        padding: '20px 12px 40px', overflowY: 'auto', direction: 'rtl' }}>

      <style>{`
        .pw-select option { background:#0c0820 !important; color:#E8E4D8 !important; }
        @keyframes pw-glow-pulse {
          0%,100% { box-shadow:0 0 24px rgba(132,144,216,.35),0 32px 80px rgba(0,0,0,.8); }
          50%      { box-shadow:0 0 44px rgba(130,246,127,.3), 0 32px 80px rgba(0,0,0,.8); }
        }
        @keyframes pw-spin { to { transform:rotate(360deg); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        .pw-glow-outer { animation:pw-glow-pulse 3s ease-in-out infinite; }
        @media (min-height:700px) and (min-width:601px) { .pw-outer { align-self:center; } }
        .pw-next:not(:disabled):hover { filter:brightness(1.12); }
      `}</style>

      <div className="pw-outer" style={{ width: '100%', maxWidth: 860 }}>
        <div ref={glowRef} onMouseMove={handleMouseMove}
          className="pw-glow-outer" onClick={e => e.stopPropagation()}
          style={{ background: `linear-gradient(var(--bh-rot,4.2rad),${P}CC,${G}88,#a18affCC,${P}CC)`,
            borderRadius: 26, padding: '2px' }}>

          <div style={{ background: BG_INNER, borderRadius: 24, overflow: 'hidden', fontFamily: FONT }}>

            {/* ── Header ── */}
            <div style={{ padding: '14px 22px 12px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', borderBottom: `1px solid ${BORDER}` }}>
              <div>
                <div style={{ fontSize: 19, fontWeight: 900, color: TEXT, fontFamily: FONT }}>פרסום נכס חדש</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 2, fontFamily: FONT }}>
                  שלב {step} מתוך {STEPS.length}
                </div>
              </div>
              <button onClick={onClose}
                style={{ width: 36, height: 36, borderRadius: '50%', border: `1px solid ${BORDER}`,
                  background: DARK, color: TEXT, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#ff444420'; e.currentTarget.style.borderColor = '#ff4444' }}
                onMouseLeave={e => { e.currentTarget.style.background = DARK; e.currentTarget.style.borderColor = BORDER }}>
                <FaTimes />
              </button>
            </div>

            {/* ── Step indicator — all 7 always visible ── */}
            <div style={{ padding: '10px 18px 6px' }}>
              <div style={{ position: 'relative' }}>
                {/* progress track */}
                <div style={{ position: 'absolute', top: 11, right: 11, left: 11, height: 2,
                  background: BORDER, zIndex: 0, borderRadius: 2 }}>
                  <div style={{ height: '100%', background: `${G}88`, transition: 'width .4s', borderRadius: 2,
                    width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
                </div>
                {/* grid of dots + labels */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STEPS.length},1fr)`,
                  position: 'relative', zIndex: 1 }}>
                  {STEPS.map(s => {
                    const done    = step > s.id
                    const current = step === s.id
                    const clickable = done
                    return (
                      <div key={s.id}
                        onClick={() => clickable && setStep(s.id)}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                          cursor: clickable ? 'pointer' : 'default' }}
                        title={clickable ? `חזור לשלב ${s.id}: ${s.title}` : ''}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%',
                          background: done ? G : current ? P : '#0c0820',
                          border: `2px solid ${done ? G : current ? P : BORDER}`,
                          color: done ? '#000' : current ? '#fff' : MUTED,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 800, transition: 'all .3s', flexShrink: 0,
                          boxShadow: clickable ? `0 0 0 0 ${G}` : 'none' }}>
                          {done ? <FaCheck size={9}/> : s.id}
                        </div>
                        <span style={{ fontSize: 11, color: current ? TEXT : done ? `${G}BB` : MUTED,
                          fontWeight: current ? 800 : 400, textAlign: 'center', lineHeight: 1.25,
                          fontFamily: FONT, whiteSpace: 'normal',
                          textDecoration: clickable ? 'underline dotted' : 'none',
                          textUnderlineOffset: 2 }}>
                          {s.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── Step content ── */}
            <div style={{ padding: '14px 28px 18px', minHeight: 300, maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
              <StepComp d={data} upd={upd} />
            </div>

            {/* ── Footer — CTA centered ── */}
            <div style={{ padding: '12px 22px 16px', borderTop: `1px solid ${BORDER}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>

              {step < STEPS.length ? (
                <button onClick={() => canNext() && setStep(s => s + 1)}
                  className="pw-next"
                  style={{ width: '75%', maxWidth: 300, padding: '13px 26px', borderRadius: 14,
                    border: 'none', background: canNext() ? P : `${P}40`,
                    color: canNext() ? '#fff' : `${TEXT}60`,
                    fontSize: 15, fontWeight: 800, cursor: canNext() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    fontFamily: FONT, transition: 'all .2s',
                    boxShadow: canNext() ? `0 6px 20px ${P}44` : 'none' }}>
                  המשך <FaChevronLeft size={12} />
                </button>
              ) : (
                <button onClick={handleFinish}
                  style={{ width: '75%', maxWidth: 300, padding: '13px 26px', borderRadius: 14,
                    border: 'none', background: G, color: '#000', fontSize: 15, fontWeight: 800,
                    cursor: 'pointer', fontFamily: FONT,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: `0 6px 20px ${G}44` }}>
                  <FaCheck size={13} /> סיום ופרסום
                </button>
              )}

              {/* Save draft button */}
              <button onClick={handleSaveDraft}
                style={{ width: '75%', maxWidth: 300, padding: '9px 20px', borderRadius: 10,
                  border: `1.5px solid ${draftSaved ? G : BORDER}`,
                  background: draftSaved ? `${G}18` : 'transparent',
                  color: draftSaved ? G : MUTED,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  transition: 'all .25s' }}>
                {draftSaved ? <><FaCheck size={11} /> נשמר בטיוטות</> : <><FaSave size={11} /> שמור טיוטה</>}
              </button>

              {step > 1 && (
                <button onClick={() => setStep(s => Math.max(1, s - 1))}
                  style={{ padding: '5px 18px', background: 'none', border: 'none',
                    color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                    display: 'flex', alignItems: 'center', gap: 6, transition: 'color .2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = TEXT}
                  onMouseLeave={e => e.currentTarget.style.color = MUTED}>
                  <FaChevronRight size={11} /> חזרה
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Publish / Draft decision modal */}
      {showPublishModal && (
        <PublishModal
          onPublish={() => handlePublish(false)}
          onDraft={() => handlePublish(true)}
          onCancel={() => setShowPublishModal(false)}
        />
      )}
    </div>
  )
}
