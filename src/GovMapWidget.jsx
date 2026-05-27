import { useState, useEffect, useRef, useCallback, useId } from 'react'

const SCRIPT_URL = 'https://www.govmap.gov.il/govmap/api/govmap.api.js'

// Real-estate relevant layers — organized by category
export const LAYERS_DEF = [
  // מגרשים וחלקות
  { id:'PARCEL_ALL',        label:'חלקות',                   on:true,  color:'#4B8CE8',  cat:'מגרשים' },
  { id:'PARCEL_HOKS',       label:'גושים',                   on:true,  color:'#334',     cat:'מגרשים' },
  { id:'KSHTANN_ASSETS',    label:'נכסי רמ"י',               on:false, color:'#8490D8',  cat:'מגרשים' },
  // תכנון ובנייה
  { id:'TABA_DEST',         label:'ייעוד קרקע',              on:true,  color:'#E84B4B',  cat:'תכנון' },
  { id:'PLAN_INFO',         label:'תכניות בניין עיר',        on:false, color:'#F7A348',  cat:'תכנון' },
  { id:'TAMA38',            label:'תמ"א 38',                 on:false, color:'#A25DDC',  cat:'תכנון' },
  { id:'BUILDING_PERMITS',  label:'היתרי בנייה',             on:false, color:'#00C875',  cat:'תכנון' },
  // מגבלות
  { id:'ARCHEOLOGY',        label:'אתרים ארכיאולוגיים',      on:false, color:'#C4A35A',  cat:'מגבלות' },
  { id:'NATBDR',            label:'גבולות מינהליים',          on:false, color:'#E2445C',  cat:'מגבלות' },
  // תשתיות וסביבה
  { id:'bus_stops',         label:'תחנות אוטובוס',          on:false, color:'#82F67F',  cat:'סביבה' },
  { id:'TRAIN_LINES',       label:'קווי רכבת',              on:false, color:'#0073EA',  cat:'סביבה' },
  { id:'GASSTATIONS',       label:'תחנות דלק',              on:false, color:'#F7C948',  cat:'סביבה' },
  { id:'SCHOOL_AREAS',      label:'אזורי בתי ספר',           on:false, color:'#03C9D7',  cat:'סביבה' },
]
const LAYER_CATS = ['מגרשים', 'תכנון', 'מגבלות', 'סביבה']

export const LAYER_CATS_DEF = ['מגרשים', 'תכנון', 'מגבלות', 'סביבה']

export const BG_OPTIONS = [
  { v:'2', label:'משולב' },
  { v:'1', label:'תצלום אוויר' },
  { v:'0', label:'רחובות ומבנים' },
  { v:'9', label:'טופוגרפי' },
  { v:'3', label:'CIR' },
]

// Singleton state machine prevents double-loading the heavy govmap bundle
let scriptState = 'idle' // 'idle' | 'loading' | 'ready' | 'error'
const scriptCallbacks = []

function loadGovMapScript(cb) {
  if (scriptState === 'ready' && window.govmap) { cb(); return }
  if (scriptState === 'error') return
  scriptCallbacks.push(cb)
  if (scriptState === 'loading') return
  scriptState = 'loading'
  const s = document.createElement('script')
  s.src = SCRIPT_URL
  s.onload = () => { scriptState = 'ready'; scriptCallbacks.splice(0).forEach(fn => fn()) }
  s.onerror = () => { scriptState = 'error'; scriptCallbacks.splice(0) }
  document.head.appendChild(s)
}

export default function GovMapWidget({ gush, helka, subHelka, token, C, isDark, compact = false }) {
  const uid = useId().replace(/:/g, '')
  const mapDivId = `gm_${uid}`

  const [layers, setLayers] = useState(() => {
    try {
      const s = localStorage.getItem('govmap_default_layers')
      if (s) { const d = JSON.parse(s); return Object.fromEntries(LAYERS_DEF.map(l => [l.id, d[l.id] ?? l.on])) }
    } catch {}
    return Object.fromEntries(LAYERS_DEF.map(l => [l.id, l.on]))
  })
  const [bg, setBg] = useState(() => localStorage.getItem('govmap_default_bg') || '2')
  const [gushVal, setGushVal]         = useState(gush || '')
  const [helkaVal, setHelkaVal]       = useState(helka || '')
  const [subHelkaVal, setSubHelkaVal] = useState(subHelka || '')
  const [showPanel, setShowPanel]     = useState(false)
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
      if (gush && helka) zoomToParcel(gush, helka)
    } catch {
      setError('שגיאה ביצירת המפה. ודא שמפתח ה-API תקין ורשום לדומיין זה.')
      created.current = false
    }
  }, [mapDivId, token, bg, gush, helka])

  useEffect(() => {
    if (!token) return
    loadGovMapScript(createMap)
  }, [token, createMap])

  function zoomToParcel(g, h) {
    if (!g || !h) return
    const lot = Number(g), parcel = Number(h)
    const tryZoom = () => {
      if (!window.govmap?.searchAndLocate) return
      try {
        window.govmap.searchAndLocate({
          type:   window.govmap.locateType?.addressToLotParcel ?? 3,
          lot, parcel,
        })
      } catch {}
    }
    // Four independent attempts — later ones correct any silent early failure
    ;[600, 1800, 4000, 8000].forEach(ms => setTimeout(tryZoom, ms))
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

        {/* גוש / חלקה / תת-חלקה search */}
        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:`${C.cream}66`, fontWeight:600 }}>גוש</span>
          <input value={gushVal} onChange={e=>setGushVal(e.target.value)} placeholder="40095" style={inputSt}
            onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
          <span style={{ fontSize:11, color:`${C.cream}66`, fontWeight:600 }}>חלקה</span>
          <input value={helkaVal} onChange={e=>setHelkaVal(e.target.value)} placeholder="13" style={inputSt}
            onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
          <span style={{ fontSize:11, color:`${C.cream}66`, fontWeight:600 }}>תת</span>
          <input value={subHelkaVal} onChange={e=>setSubHelkaVal(e.target.value)} placeholder="0" style={{ ...inputSt, width:48 }}
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

      {/* ── Layer Panel — categorised ── */}
      {showPanel && (
        <div style={{ position:'absolute', top:44, right:0, zIndex:20, background: panelBg, backdropFilter:'blur(12px)', border:`1px solid ${C.purple}28`, borderRadius:'0 0 0 12px', padding:'14px 16px', minWidth:230, maxHeight:420, overflowY:'auto', boxShadow:'0 8px 32px rgba(0,0,0,.4)', direction:'rtl' }}>
          <div style={{ fontSize:11, fontWeight:800, color:`${C.cream}55`, letterSpacing:'.07em', marginBottom:12, textTransform:'uppercase' }}>שכבות מידע</div>
          {LAYER_CATS.map(cat => {
            const catLayers = LAYERS_DEF.filter(l => l.cat === cat)
            return (
              <div key={cat} style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, fontWeight:700, color:`${C.cream}44`, letterSpacing:'.05em', textTransform:'uppercase', marginBottom:6, borderBottom:`1px solid ${C.purple}15`, paddingBottom:4 }}>{cat}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {catLayers.map(l => (
                    <label key={l.id} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12.5, color:C.cream, userSelect:'none' }}>
                      <span style={{ width:17, height:17, borderRadius:4, border:`2px solid ${layers[l.id] ? l.color : `${C.cream}28`}`, background: layers[l.id] ? l.color : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }}>
                        {layers[l.id] && <span style={{ color:'#fff', fontSize:10, fontWeight:900, lineHeight:1 }}>✓</span>}
                      </span>
                      <input type="checkbox" checked={layers[l.id]} onChange={()=>toggleLayer(l.id)} style={{ display:'none' }}/>
                      <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <span style={{ width:9, height:9, borderRadius:2, background:l.color, flexShrink:0, border:`1px solid ${l.color}88` }}/>
                        {l.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
          <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${C.purple}15`, fontSize:10, color:`${C.cream}33` }}>
            מקור: פורטל GovMap הממשלתי
          </div>
        </div>
      )}

      {/* ── Map container ── */}
      <div id={mapDivId} style={{ width:'100%', height: compact ? 340 : 480 }}/>

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
