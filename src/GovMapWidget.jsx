import { useState, useEffect, useRef, useCallback, useId } from 'react'

const SCRIPT_URL = 'https://www.govmap.gov.il/govmap/api/govmap.api.js'

// Real-estate layers — on:true = shown by default
export const LAYERS_DEF = [
  { id:'PARCEL_ALL',       label:'חלקות',                on:true,  color:'#4B8CE8', cat:'מגרשים' },
  { id:'PARCEL_HOKS',      label:'גושים',                on:true,  color:'#5566AA', cat:'מגרשים' },
  { id:'KSHTANN_ASSETS',   label:'נכסי רמ"י',            on:false, color:'#8490D8', cat:'מגרשים' },
  { id:'TABA_DEST',        label:'ייעוד קרקע',           on:false, color:'#E84B4B', cat:'תכנון'  },
  { id:'PLAN_INFO',        label:'תכניות בניין עיר',     on:false, color:'#F7A348', cat:'תכנון'  },
  { id:'TAMA38',           label:'תמ"א 38',              on:false, color:'#A25DDC', cat:'תכנון'  },
  { id:'BUILDING_PERMITS', label:'היתרי בנייה',          on:false, color:'#00C875', cat:'תכנון'  },
  { id:'ARCHEOLOGY',       label:'אתרים ארכיאולוגיים',   on:false, color:'#C4A35A', cat:'מגבלות' },
  { id:'NATBDR',           label:'גבולות מינהליים',       on:false, color:'#E2445C', cat:'מגבלות' },
  { id:'bus_stops',        label:'תחנות אוטובוס',        on:false, color:'#82F67F', cat:'סביבה'  },
  { id:'TRAIN_LINES',      label:'קווי רכבת',            on:false, color:'#0073EA', cat:'סביבה'  },
  { id:'GASSTATIONS',      label:'תחנות דלק',            on:false, color:'#F7C948', cat:'סביבה'  },
  { id:'SCHOOL_AREAS',     label:'אזורי בתי ספר',        on:false, color:'#03C9D7', cat:'סביבה'  },
]
const LAYER_CATS = ['מגרשים', 'תכנון', 'נדל"ן', 'גבולות', 'מגבלות', 'סביבה']

export const LAYER_CATS_DEF = LAYER_CATS

export const BG_OPTIONS = [
  { v:'0', label:'רחובות ומבנים' },
  { v:'1', label:'תצלום אוויר'  },
  { v:'2', label:'משולב'        },
  { v:'9', label:'טופוגרפי'     },
  { v:'3', label:'CIR'          },
]

// ── Script singleton ───────────────────────────────────────────────────────────
// 'idle' | 'loading' | 'ready' | 'error'
let scriptState        = 'idle'
let scriptCallbacks    = []
let scriptErrCallbacks = []

function loadGovMapScript(cb, onErr) {
  if (scriptState === 'ready' && window.govmap) { cb(); return }
  // Reset on error so callers can retry (e.g. transient network failure)
  if (scriptState === 'error') scriptState = 'idle'
  scriptCallbacks.push(cb)
  if (onErr) scriptErrCallbacks.push(onErr)
  if (scriptState === 'loading') return
  scriptState = 'loading'
  const s = document.createElement('script')
  s.src   = SCRIPT_URL
  s.async = true
  s.onload  = () => { scriptState = 'ready'; scriptCallbacks.splice(0).forEach(fn => fn()) }
  s.onerror = () => {
    scriptState = 'error'
    scriptCallbacks.splice(0)
    scriptErrCallbacks.splice(0).forEach(fn => fn())
  }
  document.head.appendChild(s)
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GovMapWidget({ gush, helka, subHelka, token, C, isDark, compact = false }) {
  const uid      = useId().replace(/:/g, '')
  const mapDivId = `gm_${uid}`

  const containerRef = useRef(null)
  const created      = useRef(false)

  const [inView,    setInView]    = useState(false)
  const [mapReady,  setMapReady]  = useState(false)
  const [error,     setError]     = useState('')
  const [measuring, setMeasuring] = useState(false)
  const [showPanel, setShowPanel] = useState(false)

  const [layers, setLayers] = useState(() => {
    try {
      const stored = localStorage.getItem('govmap_default_layers')
      if (stored) {
        const d = JSON.parse(stored)
        return Object.fromEntries(LAYERS_DEF.map(l => [l.id, d[l.id] ?? l.on]))
      }
    } catch {}
    return Object.fromEntries(LAYERS_DEF.map(l => [l.id, l.on]))
  })

  const [bg, setBg] = useState(() => localStorage.getItem('govmap_default_bg') || '0')

  const layersRef = useRef(layers)
  const bgRef     = useRef(bg)
  useEffect(() => { layersRef.current = layers }, [layers])
  useEffect(() => { bgRef.current     = bg     }, [bg])

  // Refs so async callbacks always see the latest gush/helka values.
  const gushRef  = useRef(gush  || '')
  const helkaRef = useRef(helka || '')
  useEffect(() => { gushRef.current  = gush  || '' }, [gush])
  useEffect(() => { helkaRef.current = helka || '' }, [helka])

  const [gushVal,     setGushVal]     = useState(gush     || '')
  const [helkaVal,    setHelkaVal]    = useState(helka    || '')
  const [subHelkaVal, setSubHelkaVal] = useState(subHelka || '')

  // ── 1. Lazy: only load script after the widget enters the viewport ──────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold: 0.05 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── 2. Zoom to parcel using searchAndLocate (only proven working method) ─────
  const doSearchAndLocate = useCallback((g, h) => {
    if (!g || !h || !window.govmap) return
    const type = window.govmap.locateType?.parcel
               ?? window.govmap.locateType?.addressToLotParcel
               ?? 5
    try { window.govmap.searchAndLocate({ type, lot: Number(g), parcel: Number(h) }) } catch {}
  }, [])

  const zoomToParcel = useCallback((g, h) => {
    if (!g || !h) return
    // Fire at multiple offsets — GovMap createMap is async under the hood and
    // searchAndLocate silently no-ops if called before internal init completes.
    const attempts = [100, 800, 2000, 4000, 7000]
    attempts.forEach(ms => setTimeout(() => doSearchAndLocate(g, h), ms))
  }, [doSearchAndLocate])

  // ── 3. Create map ────────────────────────────────────────────────────────────
  const createMap = useCallback(() => {
    if (created.current || !window.govmap) return
    const el = document.getElementById(mapDivId)
    if (!el) return
    created.current = true
    try {
      const activeLayers = LAYERS_DEF.filter(l => layersRef.current[l.id]).map(l => l.id)
      window.govmap.createMap(mapDivId, {
        token:            token || '',
        layers:           activeLayers,
        showXY:           false,
        identifyOnClick:  true,
        isEmbeddedToggle: false,
        background:       Number(bgRef.current) || 0,
        layersMode:       1,
        zoomButtons:      true,
      })
      setError('')

      // setMapReadyCallback fires when the API has truly finished internal init —
      // this is the most reliable moment to call searchAndLocate.
      if (typeof window.govmap.setMapReadyCallback === 'function') {
        window.govmap.setMapReadyCallback(() => {
          setMapReady(true)
          const g = gushRef.current
          const h = helkaRef.current
          doSearchAndLocate(g, h)
        })
      } else {
        // Fallback for API versions without setMapReadyCallback
        setMapReady(true)
      }
    } catch {
      setError('שגיאה ביצירת המפה — ודא שמפתח ה-API תקין ורשום לדומיין זה.')
      created.current = false
    }
  }, [mapDivId, token, doSearchAndLocate])

  const onScriptError = useCallback(() => {
    setError('שגיאה בטעינת ספריית GovMap. בדוק חיבור אינטרנט ולחץ לנסות שוב.')
  }, [])

  // ── Load SDK + create map once in view ────────────────────────────────────
  useEffect(() => {
    if (!token || !inView) return
    loadGovMapScript(createMap, onScriptError)
  }, [token, inView, createMap, onScriptError])

  // ── 4. Zoom when map ready or gush/helka change (backup staggered retries) ──
  useEffect(() => {
    if (!mapReady || !gush || !helka) return
    zoomToParcel(gush, helka)
  }, [gush, helka, mapReady, zoomToParcel])

  // ── Controls ─────────────────────────────────────────────────────────────────
  function toggleLayer(id) {
    setLayers(prev => {
      const next = !prev[id]
      if (window.govmap && mapReady) {
        try {
          if (next) window.govmap.showLayer(id)
          else      window.govmap.hideLayer(id)
        } catch {}
      }
      return { ...prev, [id]: next }
    })
  }

  function handleBg(v) {
    setBg(v)
    if (window.govmap && mapReady) window.govmap.setBackground(Number(v))
  }

  function toggleMeasure() {
    if (!window.govmap || !mapReady) return
    if (measuring) { window.govmap.closeMeasure(); setMeasuring(false) }
    else           { window.govmap.showMeasure();  setMeasuring(true)  }
  }

  function handleSearch() {
    if (!gushVal || !helkaVal) return
    zoomToParcel(gushVal, helkaVal)
  }

  // ── Styles ───────────────────────────────────────────────────────────────────
  const panelBg = isDark ? 'rgba(9,9,15,.98)'    : 'rgba(248,247,243,.98)'
  const border  = `1px solid ${C.purple}28`
  const selBg   = isDark ? '#1c1c30' : '#eceaf5'
  const selFg   = isDark ? '#e8e4d4' : '#1a1a2e'

  const inputSt = {
    padding:'6px 10px', borderRadius:6, border, outline:'none',
    background: isDark ? 'rgba(255,255,255,.07)' : '#fff',
    color: C.cream, fontSize:12, fontFamily:'Rubik,inherit',
    width:68, direction:'ltr', textAlign:'center',
  }
  const btnSt = (active) => ({
    padding:'6px 13px', borderRadius:6, border, cursor:'pointer',
    background: active ? C.purple : (isDark ? 'rgba(255,255,255,.07)' : '#fff'),
    color: active ? '#fff' : C.cream,
    fontSize:12, fontFamily:'Rubik,inherit', fontWeight:600, transition:'all .15s',
    whiteSpace:'nowrap',
  })

  // ── No token ──────────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div style={{ padding:'32px 24px', textAlign:'center', background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.03)', border:`1px dashed ${C.purple}33`, borderRadius:12, direction:'rtl', fontFamily:'Rubik,inherit' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🗺️</div>
        <div style={{ fontSize:15, fontWeight:700, color:C.cream, marginBottom:8 }}>מפת GovMap</div>
        <div style={{ fontSize:13, color:`${C.cream}77`, lineHeight:1.7, maxWidth:360, margin:'0 auto 16px' }}>
          הגדר מפתח API של GovMap בלוח הניהול תחת הכרטיסייה <strong style={{ color:C.purple }}>הגדרות</strong>.
        </div>
      </div>
    )
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────────
  if (!inView) {
    return (
      <div ref={containerRef} style={{ position:'relative', border:`1px solid ${C.purple}15`, borderRadius:12, overflow:'hidden', background: isDark ? '#0A0A16' : '#F5F4F0', height: compact ? 340 : 480, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, direction:'rtl', fontFamily:'Rubik,inherit' }}>
        <div style={{ width:48, height:48, borderRadius:'50%', background:`${C.purple}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:24 }}>🗺️</span>
        </div>
        <div style={{ fontSize:14, fontWeight:700, color:`${C.cream}66` }}>מפת גוש/חלקה</div>
        {gush && helka && <div style={{ fontSize:12, color:`${C.cream}44` }}>גוש {gush} · חלקה {helka}</div>}
        <div style={{ fontSize:12, color:`${C.cream}33` }}>המפה תיטען בעת גלילה לאזור זה</div>
        <style>{`@keyframes shimmer{0%{opacity:.4}50%{opacity:.8}100%{opacity:.4}}`}</style>
        <div style={{ position:'absolute', inset:0, background:`linear-gradient(135deg,${C.purple}05,${C.purple}0A,${C.purple}05)`, animation:'shimmer 2s ease-in-out infinite' }}/>
      </div>
    )
  }

  // ── Map ───────────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef}
      data-no-swipe="true"
      onClick={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
      style={{ position:'relative', border:`1px solid ${C.purple}22`, borderRadius:12,
               overflow:'hidden', background: isDark ? '#0A0A16' : '#f8f7f3',
               direction:'rtl', fontFamily:'Rubik,inherit' }}>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:8, alignItems:'center', padding:'9px 12px',
                    background: isDark ? 'rgba(14,14,28,.97)' : 'rgba(236,234,245,.97)',
                    borderBottom:`1px solid ${C.purple}20`, flexWrap:'wrap' }}>

        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:`${C.cream}88`, fontWeight:700 }}>גוש</span>
          <input value={gushVal}     onChange={e=>setGushVal(e.target.value)}     placeholder="40095" style={inputSt} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')handleSearch()}}/>
          <span style={{ fontSize:11, color:`${C.cream}88`, fontWeight:700 }}>חלקה</span>
          <input value={helkaVal}    onChange={e=>setHelkaVal(e.target.value)}    placeholder="13"    style={inputSt} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')handleSearch()}}/>
          <span style={{ fontSize:11, color:`${C.cream}88`, fontWeight:700 }}>תת</span>
          <input value={subHelkaVal} onChange={e=>setSubHelkaVal(e.target.value)} placeholder="0"     style={{ ...inputSt, width:44 }} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')handleSearch()}}/>
          <button onClick={handleSearch} disabled={!mapReady}
            style={{ ...btnSt(false), padding:'6px 14px', background: C.purple, color:'#fff', border:'none', opacity: !mapReady ? .5 : 1 }}>
            חפש
          </button>
        </div>

        <div style={{ width:1, height:22, background:`${C.purple}25`, flexShrink:0 }}/>

        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <span style={{ fontSize:11, color:`${C.cream}88`, fontWeight:700 }}>רקע</span>
          <div style={{ position:'relative' }}>
            <select value={bg} onChange={e=>handleBg(e.target.value)}
              style={{ padding:'6px 26px 6px 10px', background: selBg, color: selFg,
                       border:`1px solid ${C.purple}55`, borderRadius:6,
                       fontSize:12, fontFamily:'Rubik,inherit', fontWeight:700,
                       outline:'none', appearance:'none', WebkitAppearance:'none',
                       cursor:'pointer', direction:'rtl', minWidth:138 }}>
              {BG_OPTIONS.map(o => (
                <option key={o.v} value={o.v} style={{ background: selBg, color: selFg }}>{o.label}</option>
              ))}
            </select>
            <span style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)',
                           pointerEvents:'none', fontSize:10, color: selFg, fontWeight:900 }}>▾</span>
          </div>
        </div>

        <div style={{ width:1, height:22, background:`${C.purple}25`, flexShrink:0 }}/>

        <button onClick={()=>setShowPanel(p=>!p)} style={btnSt(showPanel)}>
          שכבות {showPanel ? '▲' : '▼'}
        </button>

        <button onClick={toggleMeasure} style={btnSt(measuring)} title="כלי מדידה">
          📐 מדידה
        </button>

        {error && (
          <span
            style={{ fontSize:11, color:'#E05252', marginRight:'auto', maxWidth:240, cursor:'pointer' }}
            onClick={() => { created.current = false; setMapReady(false); setError(''); loadGovMapScript(createMap, onScriptError) }}
          >
            {error} — לחץ לנסות שוב
          </span>
        )}
      </div>

      {/* Layer panel */}
      {showPanel && (
        <div style={{ position:'absolute', top:43, right:0, zIndex:30,
                      background: panelBg, backdropFilter:'blur(14px)',
                      border:`1px solid ${C.purple}30`, borderRadius:'0 0 0 14px',
                      padding:'14px 16px', minWidth:240, maxHeight:440,
                      overflowY:'auto', boxShadow:'0 10px 40px rgba(0,0,0,.45)',
                      direction:'rtl' }}>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span style={{ fontSize:11, fontWeight:800, color:`${C.cream}66`, letterSpacing:'.07em', textTransform:'uppercase' }}>שכבות מידע</span>
            <button onClick={()=>setShowPanel(false)}
              style={{ background:'none', border:'none', color:`${C.cream}55`, cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 2px' }}>×</button>
          </div>

          {LAYER_CATS.map(cat => {
            const catLayers = LAYERS_DEF.filter(l => l.cat === cat)
            return (
              <div key={cat} style={{ marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:800, color:`${C.cream}50`, letterSpacing:'.06em',
                              textTransform:'uppercase', marginBottom:7,
                              borderBottom:`1px solid ${C.purple}18`, paddingBottom:4 }}>
                  {cat}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                  {catLayers.map(l => (
                    <label key={l.id}
                      style={{ display:'flex', alignItems:'center', gap:9, cursor:'pointer',
                               fontSize:13, color: layers[l.id] ? C.cream : `${C.cream}88`,
                               userSelect:'none', transition:'color .12s' }}>
                      <span onClick={()=>toggleLayer(l.id)}
                        style={{ width:18, height:18, borderRadius:5, flexShrink:0, transition:'all .15s',
                                 border:`2px solid ${layers[l.id] ? l.color : `${C.cream}28`}`,
                                 background: layers[l.id] ? l.color : 'transparent',
                                 display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {layers[l.id] && <span style={{ color:'#fff', fontSize:11, fontWeight:900, lineHeight:1 }}>✓</span>}
                      </span>
                      <input type="checkbox" checked={!!layers[l.id]} onChange={()=>toggleLayer(l.id)} style={{ display:'none' }}/>
                      <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:10, height:10, borderRadius:3, background:l.color, flexShrink:0 }}/>
                        {l.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}

          <div style={{ marginTop:6, paddingTop:8, borderTop:`1px solid ${C.purple}15`,
                        fontSize:10, color:`${C.cream}33`, textAlign:'center' }}>
            מקור: פורטל GovMap הממשלתי
          </div>
        </div>
      )}

      {/* Map canvas */}
      <div id={mapDivId} style={{ width:'100%', height: compact ? 340 : 500 }}/>

      {/* Loading overlay */}
      {!mapReady && (
        <div style={{ position:'absolute', inset:0, top:43, zIndex:5,
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                      gap:16,
                      background: isDark ? 'rgba(10,10,22,.93)' : 'rgba(245,242,252,.93)' }}>
          <>
            <style>{`@keyframes gm_spin{to{transform:rotate(360deg)}}`}</style>
            <div style={{ width:44, height:44, border:`3px solid ${C.purple}28`,
                          borderTopColor:C.purple, borderRadius:'50%',
                          animation:'gm_spin 0.8s linear infinite' }}/>
            <div style={{ textAlign:'center', direction:'rtl' }}>
              <div style={{ fontSize:14, color:`${C.cream}99`, fontFamily:'Rubik,inherit', marginBottom:6 }}>
                טוען מפת GovMap…
              </div>
              {(gush || helka) && (
                <div style={{ fontSize:12, color:C.purple, fontFamily:'Rubik,inherit', opacity:.8 }}>
                  מאתר: גוש {gush}{helka ? ` · חלקה ${helka}` : ''}
                </div>
              )}
            </div>
          </>
        </div>
      )}
    </div>
  )
}
