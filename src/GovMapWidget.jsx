import { useState, useEffect, useRef, useCallback, useId } from 'react'

const SCRIPT_URL = 'https://www.govmap.gov.il/govmap/api/govmap.api.js'

// Key layers for real estate / land parcels
const LAYERS_DEF = [
  { id:'PARCEL_ALL',     label:'חלקות',              on:true,  color:'#4B8CE8' },
  { id:'PARCEL_HOKS',    label:'גושים',               on:true,  color:'#222' },
  { id:'TABA_DEST',      label:'ייעוד קרקע',          on:true,  color:'#E84B4B' },
  { id:'KSHTANN_ASSETS', label:'נכסי רמ"י',            on:false, color:'#8490D8' },
  { id:'bus_stops',      label:'תחנות אוטובוס',       on:false, color:'#82F67F' },
  { id:'GASSTATIONS',    label:'תחנות דלק',           on:false, color:'#F7C948' },
]

const BG_OPTIONS = [
  { v:'2', label:'משולב' },
  { v:'1', label:'תצלום אוויר' },
  { v:'0', label:'רחובות ומבנים' },
  { v:'9', label:'טופוגרפי' },
  { v:'3', label:'CIR' },
]

let scriptLoaded = false
let scriptCallbacks = []

function loadGovMapScript(cb) {
  if (scriptLoaded && window.govmap) { cb(); return }
  scriptCallbacks.push(cb)
  if (scriptCallbacks.length > 1) return
  const s = document.createElement('script')
  s.src = SCRIPT_URL
  s.defer = true
  s.onload = () => {
    scriptLoaded = true
    scriptCallbacks.forEach(fn => fn())
    scriptCallbacks = []
  }
  s.onerror = () => { scriptCallbacks = [] }
  document.head.appendChild(s)
}

export default function GovMapWidget({ gush, helka, token, C, isDark }) {
  const uid = useId().replace(/:/g, '')
  const mapDivId = `gm_${uid}`

  const [layers, setLayers]       = useState(() => Object.fromEntries(LAYERS_DEF.map(l => [l.id, l.on])))
  const [bg, setBg]               = useState('2')
  const [gushVal, setGushVal]     = useState(gush || '')
  const [helkaVal, setHelkaVal]   = useState(helka || '')
  const [showPanel, setShowPanel] = useState(false)
  const [mapReady, setMapReady]   = useState(false)
  const [error, setError]         = useState('')
  const [measuring, setMeasuring] = useState(false)
  const created = useRef(false)

  const createMap = useCallback(() => {
    if (created.current || !window.govmap) return
    const el = document.getElementById(mapDivId)
    if (!el) return
    created.current = true
    try {
      const activeLayers = LAYERS_DEF.filter(l => layers[l.id]).map(l => l.id)
      window.govmap.createMap(mapDivId, {
        token:           token || '',
        layers:          activeLayers,
        showXY:          false,
        identifyOnClick: true,
        isEmbeddedToggle:false,
        background:      bg,
        layersMode:      1,
        zoomButtons:     true,
      })
      setMapReady(true)
      setError('')
      if (gush && helka) {
        setTimeout(() => zoomToParcel(gush, helka), 1800)
      }
    } catch (e) {
      setError('שגיאה ביצירת המפה. ודא שמפתח ה-API תקין ורשום לדומיין זה.')
      created.current = false
    }
  }, [mapDivId, token, bg, gush, helka])

  useEffect(() => {
    if (!token) return
    loadGovMapScript(createMap)
  }, [token, createMap])

  function zoomToParcel(g, h) {
    if (!window.govmap || !g || !h) return
    window.govmap.searchAndLocate({
      type:   window.govmap.locateType.addressToLotParcel,
      lot:    Number(g),
      parcel: Number(h),
    }).catch(() => {})
  }

  function toggleLayer(id) {
    setLayers(prev => {
      const next = { ...prev, [id]: !prev[id] }
      if (window.govmap && mapReady) {
        if (next[id]) window.govmap.setVisibleLayers([id], [])
        else          window.govmap.setVisibleLayers([], [id])
      }
      return next
    })
  }

  function handleBg(v) {
    setBg(v)
    if (window.govmap && mapReady) window.govmap.setBackground(Number(v))
  }

  function handleSearch() {
    if (gushVal && helkaVal) zoomToParcel(gushVal, helkaVal)
  }

  function toggleMeasure() {
    if (!window.govmap || !mapReady) return
    if (measuring) { window.govmap.closeMeasure(); setMeasuring(false) }
    else           { window.govmap.showMeasure();  setMeasuring(true) }
  }

  const panelBg   = isDark ? 'rgba(9,9,15,.97)'  : 'rgba(248,247,243,.97)'
  const border    = `1px solid ${C.purple}28`
  const inputSt   = { padding:'6px 10px', background: isDark ? 'rgba(255,255,255,.06)' : '#fff', border, borderRadius:6, color:C.cream, fontSize:12, fontFamily:'Rubik,inherit', outline:'none', width:68, direction:'ltr', textAlign:'center' }
  const btnSt     = (active) => ({ padding:'6px 13px', background: active ? C.purple : (isDark ? 'rgba(255,255,255,.06)' : '#fff'), border, borderRadius:6, color: active ? '#fff' : C.cream, fontSize:12, fontFamily:'Rubik,inherit', cursor:'pointer', fontWeight:600, transition:'all .15s' })

  if (!token) {
    return (
      <div style={{ padding:'32px 24px', textAlign:'center', background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.03)', border:`1px dashed ${C.purple}33`, borderRadius:12, direction:'rtl', fontFamily:'Rubik,inherit' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🗺️</div>
        <div style={{ fontSize:15, fontWeight:700, color:C.cream, marginBottom:8 }}>מפת GovMap</div>
        <div style={{ fontSize:13, color:`${C.cream}77`, lineHeight:1.7, maxWidth:360, margin:'0 auto 16px' }}>
          כדי להציג את מפת הגוש/חלקה, יש להגדיר מפתח API של GovMap בלוח הניהול תחת הכרטיסייה <strong style={{ color:C.purple }}>הגדרות</strong>.
        </div>
        <div style={{ fontSize:11, color:`${C.cream}44` }}>
          לקבלת מפתח API פנה ל-GovMap: <span style={{ color:C.purple }}>govmap.gov.il</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position:'relative', border:`1px solid ${C.purple}22`, borderRadius:12, overflow:'hidden', background:'#0A0A16', direction:'rtl', fontFamily:'Rubik,inherit' }}>

      {/* ── Toolbar ── */}
      <div style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', background: isDark ? 'rgba(11,11,20,.95)' : 'rgba(240,237,230,.97)', borderBottom:`1px solid ${C.purple}18`, flexWrap:'wrap' }}>

        {/* גוש / חלקה search */}
        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
          <span style={{ fontSize:11, color:`${C.cream}66`, fontWeight:600 }}>גוש</span>
          <input value={gushVal} onChange={e=>setGushVal(e.target.value)} placeholder="40095" style={inputSt}
            onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
          <span style={{ fontSize:11, color:`${C.cream}66`, fontWeight:600 }}>חלקה</span>
          <input value={helkaVal} onChange={e=>setHelkaVal(e.target.value)} placeholder="13" style={inputSt}
            onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
          <button onClick={handleSearch} style={{ ...btnSt(false), padding:'6px 12px' }}>חפש</button>
        </div>

        <div style={{ width:1, height:20, background:`${C.purple}22`, flexShrink:0 }}/>

        {/* Background */}
        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
          <span style={{ fontSize:11, color:`${C.cream}66`, fontWeight:600 }}>רקע</span>
          <select value={bg} onChange={e=>handleBg(e.target.value)}
            style={{ ...inputSt, width:'auto', padding:'6px 10px', appearance:'none', cursor:'pointer', direction:'rtl', textAlign:'right' }}>
            {BG_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </div>

        <div style={{ width:1, height:20, background:`${C.purple}22`, flexShrink:0 }}/>

        {/* Layer toggle */}
        <button onClick={() => setShowPanel(p=>!p)} style={btnSt(showPanel)}>
          שכבות {showPanel ? '▲' : '▼'}
        </button>

        {/* Measure */}
        <button onClick={toggleMeasure} style={btnSt(measuring)} title="כלי מדידה">
          📐 מדידה
        </button>

        {error && <span style={{ fontSize:11, color:'#E05252', marginRight:'auto' }}>{error}</span>}
      </div>

      {/* ── Layer Panel ── */}
      {showPanel && (
        <div style={{ position:'absolute', top:44, right:0, zIndex:20, background: panelBg, backdropFilter:'blur(12px)', border:`1px solid ${C.purple}28`, borderRadius:'0 0 0 10px', padding:'14px 16px', minWidth:210, boxShadow:'0 8px 32px rgba(0,0,0,.35)', direction:'rtl' }}>
          <div style={{ fontSize:11, fontWeight:800, color:`${C.cream}66`, letterSpacing:'.06em', marginBottom:10, textTransform:'uppercase' }}>שכבות מידע</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {LAYERS_DEF.map(l => (
              <label key={l.id} style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer', fontSize:13, color:C.cream, userSelect:'none' }}>
                <span style={{
                  width:18, height:18, borderRadius:4, border:`2px solid ${layers[l.id] ? C.purple : `${C.cream}33`}`,
                  background: layers[l.id] ? C.purple : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s',
                }}>
                  {layers[l.id] && <span style={{ color:'#fff', fontSize:11, fontWeight:900 }}>✓</span>}
                </span>
                <input type="checkbox" checked={layers[l.id]} onChange={()=>toggleLayer(l.id)} style={{ display:'none' }}/>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:10, height:10, borderRadius:2, background:l.color, flexShrink:0 }}/>
                  {l.label}
                </span>
              </label>
            ))}
          </div>
          <div style={{ marginTop:12, paddingTop:10, borderTop:`1px solid ${C.purple}15`, fontSize:10, color:`${C.cream}33` }}>
            לייבוא שכבות נוספות — פורטל GovMap
          </div>
        </div>
      )}

      {/* ── Map container ── */}
      <div id={mapDivId} style={{ width:'100%', height:480 }}/>

      {/* Loading overlay */}
      {!mapReady && token && (
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'rgba(9,9,15,.88)', zIndex:5, color:`${C.cream}88` }}>
          <div style={{ width:36, height:36, border:`3px solid ${C.purple}33`, borderTopColor:C.purple, borderRadius:'50%', animation:'spin 0.9s linear infinite' }}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <span style={{ fontSize:13 }}>טוען מפה…</span>
        </div>
      )}
    </div>
  )
}
