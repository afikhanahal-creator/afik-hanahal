import { useState, useEffect, useRef, useCallback, useId } from 'react'

const SCRIPT_URL = 'https://www.govmap.gov.il/govmap/api/govmap.api.js'

export const LAYERS_DEF = [
  // מגרשים וחלקות — property-focused layers (on by default)
  { id:'PARCEL_ALL',         label:'חלקות',                on:true,  color:'#4B8CE8', cat:'מגרשים' },
  { id:'PARCEL_HOKS',        label:'גושים',                on:true,  color:'#334488', cat:'מגרשים' },
  { id:'KSHTANN_ASSETS',     label:'נכסי רמ"י',            on:false, color:'#8490D8', cat:'מגרשים' },
  { id:'OWNERSHIP_TYPE',     label:'סוג בעלות בחלקות',    on:false, color:'#C97B3E', cat:'מגרשים' },
  // תכנון ובנייה
  { id:'TABA_DEST',          label:'ייעוד קרקע',           on:true,  color:'#E84B4B', cat:'תכנון' },
  { id:'PLAN_INFO',          label:'תכניות בניין עיר',     on:false, color:'#F7A348', cat:'תכנון' },
  { id:'TAMA38',             label:'תמ"א 38',              on:false, color:'#A25DDC', cat:'תכנון' },
  { id:'BUILDING_PERMITS',   label:'היתרי בנייה',           on:false, color:'#00C875', cat:'תכנון' },
  { id:'PLAN_ROAD',          label:'תכניות דרכים',         on:false, color:'#F0965A', cat:'תכנון' },
  // נדל"ן
  { id:'REAL_ESTATE',        label:'עסקאות נדל"ן',         on:false, color:'#FF6B35', cat:'נדל"ן' },
  // גבולות מינהל
  { id:'NATBDR',             label:'גבולות מינהליים',       on:false, color:'#E2445C', cat:'גבולות' },
  { id:'MUNICIPALITIES',     label:'רשויות מקומיות',        on:false, color:'#F96854', cat:'גבולות' },
  { id:'LOCAL_COMMITTEES',   label:'ועדות מקומיות',         on:false, color:'#FF7575', cat:'גבולות' },
  { id:'NEIGHBORHOODS',      label:'שכונות',                on:false, color:'#FFD700', cat:'גבולות' },
  { id:'STATISTICAL_AREAS',  label:'אזורים סטטיסטיים',     on:false, color:'#98D8C8', cat:'גבולות' },
  // מגבלות
  { id:'ARCHEOLOGY',         label:'אתרים ארכיאולוגיים',   on:false, color:'#C4A35A', cat:'מגבלות' },
  { id:'NATURE_RESERVES',    label:'שמורות טבע',            on:false, color:'#6DBF67', cat:'מגבלות' },
  { id:'FOREST',             label:'יערות',                 on:false, color:'#2E8B57', cat:'מגבלות' },
  // תשתיות וסביבה
  { id:'bus_stops',          label:'תחנות אוטובוס',        on:false, color:'#82F67F', cat:'סביבה' },
  { id:'TRAIN_LINES',        label:'קווי רכבת',            on:false, color:'#0073EA', cat:'סביבה' },
  { id:'GASSTATIONS',        label:'תחנות דלק',            on:false, color:'#F7C948', cat:'סביבה' },
  { id:'SCHOOL_AREAS',       label:'אזורי בתי ספר',        on:false, color:'#03C9D7', cat:'סביבה' },
  { id:'SCHOOLS',            label:'בתי ספר',              on:false, color:'#A8D8EA', cat:'סביבה' },
  { id:'KINDERGARTENS',      label:'גני ילדים',            on:false, color:'#FF9EC4', cat:'סביבה' },
  { id:'SHELTERS',           label:'מקלטים',               on:false, color:'#B5EAD7', cat:'סביבה' },
  { id:'HOSPITALS',          label:'בתי חולים',            on:false, color:'#FF6B8A', cat:'סביבה' },
  { id:'PARKS',              label:'פארקים וגנים',         on:false, color:'#77DD77', cat:'סביבה' },
]
const LAYER_CATS = ['מגרשים', 'תכנון', 'נדל"ן', 'גבולות', 'מגבלות', 'סביבה']

export const LAYER_CATS_DEF = LAYER_CATS

export const BG_OPTIONS = [
  { v:'2', label:'משולב' },
  { v:'1', label:'תצלום אוויר' },
  { v:'0', label:'רחובות ומבנים' },
  { v:'9', label:'טופוגרפי' },
  { v:'3', label:'CIR' },
]

// ── Script singleton ───────────────────────────────────────────────────────────
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
  s.async = true
  s.onload  = () => { scriptState = 'ready'; scriptCallbacks.splice(0).forEach(fn => fn()) }
  s.onerror = () => { scriptState = 'error';  scriptCallbacks.splice(0) }
  document.head.appendChild(s)
}

// Start downloading the SDK as soon as a token is known — before the widget
// scrolls into view. Hides the download latency inside the scroll window.
export function preloadGovMapScript() {
  if (scriptState === 'idle') loadGovMapScript(() => {})
}

// ── Zoom helper ────────────────────────────────────────────────────────────────
// Verified against GovMap iframe source (index-892f07a9.js):
//   handler uses LocateType.addressToLotParcel (= 1)
//   with params:  { type:1, lot:<gush>, parcel:<helka>, subParcel }
//   internally calls: search("block {lot} parcel {parcel}", ..., "parcel")
// We use .call(gm,…) so `this` is always the govmap instance.
function makeZoomer(gush, helka, subHelka) {
  const lot       = Number(gush)
  const parcel    = Number(helka)
  const subParcel = subHelka ? Number(subHelka) : 0
  if (!lot || !parcel) return null

  return function tryZoom() {
    const gm = window.govmap
    if (!gm) return
    const fn = gm.searchAndLocate
    if (typeof fn !== 'function') return
    try {
      fn.call(gm, {
        type:     gm.locateType?.addressToLotParcel ?? 1,
        lot,
        parcel,
        subParcel,
      })
    } catch {}
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function GovMapWidget({ gush, helka, subHelka, token, C, isDark,
                                       compact = false, defaultLayers, defaultBg }) {
  const uid      = useId().replace(/:/g, '')
  const mapDivId = `gm_${uid}`

  const containerRef = useRef(null)
  const panelRef     = useRef(null)
  const created      = useRef(false)
  const zoomTimers   = useRef([])          // all pending setTimeout handles
  const [inView,      setInView]      = useState(false)
  const [mapReady,    setMapReady]    = useState(false)
  const [error,       setError]       = useState('')
  const [measuring,   setMeasuring]   = useState(false)
  const [searching,   setSearching]   = useState(false)

  const [layers, setLayers] = useState(() => {
    if (defaultLayers && typeof defaultLayers === 'object')
      return Object.fromEntries(LAYERS_DEF.map(l => [l.id, defaultLayers[l.id] ?? l.on]))
    return Object.fromEntries(LAYERS_DEF.map(l => [l.id, l.on]))
  })
  const [bg,          setBg]          = useState(defaultBg || '0')
  const [gushVal,     setGushVal]     = useState(gush    || '')
  const [helkaVal,    setHelkaVal]    = useState(helka   || '')
  const [subHelkaVal, setSubHelkaVal] = useState(subHelka || '')
  const [showPanel,   setShowPanel]   = useState(false)

  // ── Cleanup all pending timers on unmount ──────────────────────────────────
  useEffect(() => () => { zoomTimers.current.forEach(clearTimeout) }, [])

  // ── Close layer panel on outside click ────────────────────────────────────
  // Uses capture phase (true) so it fires before React's bubble-phase handlers.
  // This means stopPropagation on the outer wrapper (which prevents modal close)
  // does NOT cancel this listener — both can fire independently.
  useEffect(() => {
    if (!showPanel) return
    const handler = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setShowPanel(false)
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [showPanel])

  // ── Helper: schedule zoom retries ─────────────────────────────────────────
  // GovMap's iframe initialises asynchronously — searchAndLocate silently
  // fails until the internal state is ready (typically 2–6 s on first load).
  // Start at 500 ms to avoid the silent-fail window; go up to 25 s.
  function scheduleZoom(zoom, delaysMs = [500, 1200, 2500, 4000, 6000, 9000, 13000, 18000, 25000]) {
    zoomTimers.current.forEach(clearTimeout)
    zoomTimers.current = delaysMs.map(ms => setTimeout(zoom, ms))
  }

  // ── Preload SDK as soon as token is known ──────────────────────────────────
  useEffect(() => {
    if (token) preloadGovMapScript()
  }, [token])

  // ── IntersectionObserver: defer actual map creation until visible ──────────
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { rootMargin: '200px' }
    )
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // Sync search fields when parent swaps to a different property
  useEffect(() => { setGushVal(gush    || '') }, [gush])
  useEffect(() => { setHelkaVal(helka  || '') }, [helka])
  useEffect(() => { setSubHelkaVal(subHelka || '') }, [subHelka])

  // ── Re-zoom when gush/helka props change (switching between properties) ────
  useEffect(() => {
    if (!created.current) return      // map not yet created — initial zoom handled by createMap
    const zoom = makeZoomer(gush, helka, subHelka)
    if (!zoom) return
    scheduleZoom(zoom, [200, 800, 2000, 4000])
  }, [gush, helka, subHelka]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create the map ─────────────────────────────────────────────────────────
  const createMap = useCallback(() => {
    if (created.current || !window.govmap) return
    const el = document.getElementById(mapDivId)
    if (!el) return
    created.current = true

    const zoom = (gush && helka) ? makeZoomer(gush, helka, subHelka) : null

    try {
      const activeLayers = LAYERS_DEF.filter(l => layers[l.id]).map(l => l.id)
      window.govmap.createMap(mapDivId, {
        token:            token || '',
        layers:           activeLayers,
        showXY:           false,
        identifyOnClick:  true,
        isEmbeddedToggle: false,
        background:       Number(bg),
        layersMode:       1,
        zoomButtons:      true,
      })
      setMapReady(true)
      setError('')

      // Aggressive retry schedule — GovMap tiles take 2–5 s to initialise.
      // No "done" flag: each call is safe to repeat; retries stop after ~15 s.
      if (zoom) scheduleZoom(zoom)
    } catch {
      setError('שגיאה ביצירת המפה. ודא שמפתח ה-API תקין.')
      created.current = false
    }
  }, [mapDivId, token, bg, gush, helka, subHelka, layers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load SDK + create map once in view ────────────────────────────────────
  useEffect(() => {
    if (!token || !inView) return
    loadGovMapScript(createMap)
  }, [token, inView, createMap])

  // ── Manual gush/helka search ───────────────────────────────────────────────
  function handleSearch() {
    if (!gushVal || !helkaVal) return
    const zoom = makeZoomer(gushVal, helkaVal, subHelkaVal)
    if (!zoom) return
    setSearching(true)
    // Map is already initialised — start immediately (delay=0), then retry
    scheduleZoom(zoom, [0, 400, 1200, 2500, 4500])
    setTimeout(() => setSearching(false), 5000)
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

  function toggleMeasure() {
    if (!window.govmap || !mapReady) return
    if (measuring) { window.govmap.closeMeasure(); setMeasuring(false) }
    else           { window.govmap.showMeasure();  setMeasuring(true)  }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const panelBg = isDark ? 'rgba(9,9,15,.97)' : 'rgba(248,247,243,.97)'
  const border  = `1px solid ${C.purple}28`
  const inputSt = { padding:'6px 10px', background: isDark ? 'rgba(255,255,255,.06)' : '#fff', border, borderRadius:6, color:C.cream, fontSize:12, fontFamily:'Rubik,inherit', outline:'none', width:68, direction:'ltr', textAlign:'center' }
  const btnSt   = (active) => ({ padding:'6px 13px', background: active ? C.purple : (isDark ? 'rgba(255,255,255,.06)' : '#fff'), border, borderRadius:6, color: active ? '#fff' : C.cream, fontSize:12, fontFamily:'Rubik,inherit', cursor:'pointer', fontWeight:600, transition:'all .15s' })
  // Select always uses dark bg + light text so it's readable regardless of theme
  const selectSt = { ...inputSt, width:'auto', padding:'6px 10px', appearance:'none', cursor:'pointer', direction:'rtl', textAlign:'right', background:'rgba(18,10,40,.92)', color:'#e8e3ff', border:`1px solid ${C.purple}55` }

  // ── No token ───────────────────────────────────────────────────────────────
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

  // ── Skeleton (not yet in viewport) ────────────────────────────────────────
  if (!inView) {
    return (
      <div ref={containerRef} style={{ position:'relative', border:`1px solid ${C.purple}15`, borderRadius:12, overflow:'hidden', background: isDark ? '#0A0A16' : '#F5F4F0', height: compact ? 340 : 480, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, direction:'rtl', fontFamily:'Rubik,inherit' }}>
        <div style={{ width:48, height:48, borderRadius:'50%', background:`${C.purple}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:24 }}>🗺️</span>
        </div>
        <div style={{ fontSize:14, fontWeight:700, color:`${C.cream}66` }}>מפת גוש/חלקה</div>
        {gush && helka && (
          <div style={{ fontSize:12, color:`${C.cream}44` }}>גוש {gush} · חלקה {helka}</div>
        )}
        <div style={{ fontSize:12, color:`${C.cream}33` }}>המפה תיטען בעת גלילה לאזור זה</div>
        <style>{`@keyframes shimmer{0%{opacity:.4}50%{opacity:.8}100%{opacity:.4}}`}</style>
        <div style={{ position:'absolute', inset:0, background:`linear-gradient(135deg,${C.purple}05,${C.purple}0A,${C.purple}05)`, animation:'shimmer 2s ease-in-out infinite' }}/>
      </div>
    )
  }

  // ── Map ────────────────────────────────────────────────────────────────────
  const toolbarHeight = 50 // approx height of the toolbar row

  return (
    // Outer wrapper: stopPropagation on all mouse events prevents clicks from
    // bubbling to the modal backdrop and accidentally closing the property panel.
    <div
      style={{ position:'relative', direction:'rtl', fontFamily:'Rubik,inherit' }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >

      {/* ── Clipped inner: toolbar + map + loading overlay ── */}
      <div ref={containerRef} style={{ position:'relative', border:`1px solid ${C.purple}22`, borderRadius:12, overflow:'hidden', background:'#0A0A16' }}>

        {/* ── Toolbar ── */}
        <div style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', background: isDark ? 'rgba(11,11,20,.95)' : 'rgba(240,237,230,.97)', borderBottom:`1px solid ${C.purple}18`, flexWrap:'wrap' }}>

          <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:`${C.cream}66`, fontWeight:600 }}>גוש</span>
            <input value={gushVal} onChange={e=>setGushVal(e.target.value)} placeholder="6443" style={inputSt}
              onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
            <span style={{ fontSize:11, color:`${C.cream}66`, fontWeight:600 }}>חלקה</span>
            <input value={helkaVal} onChange={e=>setHelkaVal(e.target.value)} placeholder="276" style={inputSt}
              onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
            <span style={{ fontSize:11, color:`${C.cream}66`, fontWeight:600 }}>תת</span>
            <input value={subHelkaVal} onChange={e=>setSubHelkaVal(e.target.value)} placeholder="0" style={{ ...inputSt, width:46 }}
              onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
            <button onClick={handleSearch} disabled={!mapReady}
              style={{ ...btnSt(false), padding:'6px 12px', background: searching ? `${C.purple}BB` : C.purple, color:'#fff', border:'none', minWidth:52, opacity: !mapReady ? .5 : 1 }}>
              {searching ? '...' : 'חפש'}
            </button>
          </div>

          <div style={{ width:1, height:20, background:`${C.purple}22`, flexShrink:0 }}/>

          <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
            <span style={{ fontSize:11, color:`${C.cream}66`, fontWeight:600 }}>רקע</span>
            <select value={bg} onChange={e=>handleBg(e.target.value)} style={selectSt}>
              {BG_OPTIONS.map(o => (
                <option key={o.v} value={o.v} style={{ background:'#120a28', color:'#e8e3ff' }}>{o.label}</option>
              ))}
            </select>
          </div>

          <div style={{ width:1, height:20, background:`${C.purple}22`, flexShrink:0 }}/>

          <button onClick={() => setShowPanel(p=>!p)} style={btnSt(showPanel)}>
            שכבות {showPanel ? '▲' : '▼'}
          </button>

          <button onClick={toggleMeasure} style={btnSt(measuring)} title="כלי מדידה">
            📐 מדידה
          </button>

          {error && (
            <span style={{ fontSize:11, color:'#E05252', marginRight:'auto', cursor:'pointer' }}
              onClick={() => { created.current = false; setMapReady(false); setError(''); loadGovMapScript(createMap) }}>
              {error} — לחץ לנסות שוב
            </span>
          )}
        </div>

        {/* ── Map + overlay ── */}
        <div style={{ position:'relative' }}>
          <div id={mapDivId} style={{ width:'100%', height: compact ? 340 : 480 }}/>

          {/* When panel is open, a transparent overlay sits above the GovMap iframe.
              Without it, clicks pass straight into the iframe (another document) and
              never reach the parent — the panel can't be closed by clicking the map,
              and the iframe may fire identify-on-click unexpectedly. */}
          {showPanel && (
            <div
              style={{ position:'absolute', inset:0, zIndex:10, background:'transparent', cursor:'default' }}
              onMouseDown={e => { e.stopPropagation(); setShowPanel(false) }}
            />
          )}
        </div>

        {/* Loading overlay */}
        {!mapReady && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'rgba(9,9,15,.88)', zIndex:5, color:`${C.cream}88` }}>
            <div style={{ width:36, height:36, border:`3px solid ${C.purple}33`, borderTopColor:C.purple, borderRadius:'50%', animation:'spin 0.9s linear infinite' }}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <span style={{ fontSize:13 }}>טוען מפה…</span>
            {gush && helka && (
              <span style={{ fontSize:11, color:`${C.cream}55` }}>גוש {gush} · חלקה {helka}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Layer Panel — OUTSIDE overflow:hidden so it isn't clipped ── */}
      {showPanel && (
        <div ref={panelRef}
          onMouseDown={e => e.stopPropagation()}
          style={{ position:'absolute', top: toolbarHeight + 2, right:0, zIndex:50,
            background:panelBg, backdropFilter:'blur(14px)',
            border:`1px solid ${C.purple}28`, borderRadius:'0 0 0 12px',
            padding:'14px 16px', minWidth:230, maxHeight:420, overflowY:'auto',
            boxShadow:'0 8px 32px rgba(0,0,0,.5)', direction:'rtl' }}>
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
    </div>
  )
}
