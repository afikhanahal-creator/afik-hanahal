import { useState, useEffect, useRef, useCallback, useId } from 'react'
import { LAYERS_DEF, LAYER_CATS_DEF, BG_OPTIONS } from './govmapLayers.js'

// Re-export so existing importers of these constants keep working.
export { LAYERS_DEF, LAYER_CATS_DEF, BG_OPTIONS }

const SCRIPT_URL = 'https://www.govmap.gov.il/govmap/api/govmap.api.js'
const LAYER_CATS = LAYER_CATS_DEF

// ── Script loader — singleton so the script is injected only once ─────────────
// scriptState: 'idle' | 'loading' | 'ready' | 'error'
let scriptState     = 'idle'
let scriptCallbacks = []

function loadGovMapScript(cb) {
  // Already loaded — run immediately
  if (scriptState === 'ready' && window.govmap) { cb(); return }
  // Previously errored — don't keep retrying mid-session (caller will get a skeleton + error)
  if (scriptState === 'error') return
  // Currently loading — queue and let the existing load notify us
  scriptCallbacks.push(cb)
  if (scriptState === 'loading') return
  // First call — actually inject the <script> tag
  scriptState = 'loading'
  const s   = document.createElement('script')
  s.src     = SCRIPT_URL
  s.async   = true
  s.onload  = () => {
    scriptState = 'ready'
    const queued = scriptCallbacks
    scriptCallbacks = []
    queued.forEach(fn => { try { fn() } catch (e) { console.error('[GovMap] callback error:', e) } })
  }
  s.onerror = () => {
    scriptState = 'error'
    scriptCallbacks = []
    console.error('[GovMap] failed to load', SCRIPT_URL)
  }
  document.head.appendChild(s)
}

// ── Parcel lookup helpers ─────────────────────────────────────────────────────
const govmapLink = (g, h) =>
  `https://www.govmap.gov.il/?q=${encodeURIComponent(`גוש ${g} חלקה ${h}`)}&lay=PARCEL_ALL&lot=${g}&parcel=${h}`

// Same ITM → Web Mercator maths as lib/parcel-locate.js, only needed for the in-browser fallback
function itmToMercator(x, y) {
  const A = 6378137, F = 1 / 298.257223563, E2 = 2 * F - F * F, EP2 = E2 / (1 - E2)
  const LAT0 = 0.553869654637742, LON0 = 0.614434732254763, K0 = 1.0000067
  const m = phi => A * ((1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * phi - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * E2 ** 3 / 3072) * Math.sin(6 * phi))
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2))
  const mu = (m(LAT0) + (y - 626907.39) / K0) / (A * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256))
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu)
  const n1 = A / Math.sqrt(1 - E2 * Math.sin(p1) ** 2), t1 = Math.tan(p1) ** 2, c1 = EP2 * Math.cos(p1) ** 2
  const r1 = A * (1 - E2) / (1 - E2 * Math.sin(p1) ** 2) ** 1.5, d = (x - 219529.584) / (n1 * K0)
  const lat = p1 - (n1 * Math.tan(p1) / r1) * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * EP2) * d ** 4 / 24 + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * EP2 - 3 * c1 ** 2) * d ** 6 / 720)
  const lon = LON0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * EP2 + 24 * t1 ** 2) * d ** 5 / 120) / Math.cos(p1)
  return { x: lon * 6378137, y: Math.log(Math.tan(Math.PI / 4 + lat / 2)) * 6378137 }
}

// { itm, mercator } for a gush/helka: the server resolver first, the legacy TldSearch service from
// the browser as a fallback (works while it's still up and the site's API isn't, e.g. local dev).
async function resolveParcelPoint(lot, parcel) {
  try {
    const r = await fetch(`/api/properties?parcel=${lot}-${parcel}`, { headers: { Accept: 'application/json' } })
    const d = r.ok ? await r.json() : null
    if (d && d.ok && d.itm && d.mercator) return { itm: d.itm, mercator: d.mercator }
    if (d && !d.ok) console.warn('[GovMap] parcel not resolved on the server:', d.tried)
  } catch (e) { console.warn('[GovMap] parcel resolver unreachable:', e && e.message) }
  try {
    const q = encodeURIComponent(`גוש ${lot} חלקה ${parcel}`)
    const r = await fetch(`https://es.govmap.gov.il/TldSearch/api/DetailsByQuery?query=${q}&lyrs=276589&gid=govmap`, { headers: { Accept: 'application/json' } })
    const body = r.ok ? await r.json() : null
    const groups = (body && body.data) || {}
    const item = (groups[((body && body.order) || Object.keys(groups))[0]] || [])[0]
    const x = Number(item && item.X), y = Number(item && item.Y)
    if (x > 100000 && x < 300000 && y > 350000 && y < 820000) return { itm: { x, y }, mercator: itmToMercator(x, y) }
  } catch (e) { console.warn('[GovMap] TldSearch unreachable:', e && e.message) }
  return null
}

// GovMap's own gush/helka locate (needs the parcel to have a registered address — last resort only)
async function locateViaSdk(lot, parcel) {
  const gm = window.govmap
  if (!gm || typeof gm.searchAndLocate !== 'function' || !gm.locateType) return false
  for (const type of [gm.locateType.lotParcelToAddress, gm.locateType.lotParcel].filter(v => v !== undefined)) {
    try {
      const r = await Promise.resolve(gm.searchAndLocate({ type, lot, parcel }))
      const d = r && (r.data !== undefined ? r.data : r)
      if (d && ((Array.isArray(d) && d.length) || (!Array.isArray(d) && typeof d === 'object' && (d.X || d.x || Object.keys(d).length > 1)))) return true
    } catch {}
  }
  return false
}

// Normalise whatever an EXTENT_CHANGE event carries into { xmin, ymin, xmax, ymax, cx, cy }
function readExtent(e) {
  const src = (e && (e.extent || e.Extent || e.mapExtent)) || e
  if (!src || typeof src !== 'object') return null
  const get = k => { for (const key of Object.keys(src)) if (key.toLowerCase() === k) return Number(src[key]); return NaN }
  let [xmin, ymin, xmax, ymax] = ['xmin', 'ymin', 'xmax', 'ymax'].map(get)
  if (![xmin, ymin, xmax, ymax].every(Number.isFinite) && Array.isArray(src) && src.length === 4) [xmin, ymin, xmax, ymax] = src.map(Number)
  if (![xmin, ymin, xmax, ymax].every(Number.isFinite)) return null
  return { xmin, ymin, xmax, ymax, cx: (xmin + xmax) / 2, cy: (ymin + ymax) / 2 }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GovMapWidget({ gush, helka, subHelka, token, C, isDark, compact = false }) {
  const uid      = useId().replace(/:/g, '')
  const mapDivId = `gm_${uid}`

  const containerRef = useRef(null)
  const created      = useRef(false)   // true once window.govmap.createMap() succeeded

  // Start the GovMap SDK + map loading immediately on mount (the widget only
  // renders inside an opened property modal, so the user wants the map fast). The
  // 786KB SDK is cached after the first load, so later maps open instantly.
  const [inView,    setInView]    = useState(true)
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

  // Refs so createMap reads the latest values without being in its dep array
  // (prevents the script-loading effect from re-firing on every layer toggle)
  const layersRef = useRef(layers)
  const bgRef     = useRef(bg)
  useEffect(() => { layersRef.current = layers }, [layers])
  useEffect(() => { bgRef.current     = bg     }, [bg])

  // Search-bar state — seeded from props
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

  // Refs so timed retries always use the latest prop values without stale closures
  const gushRef    = useRef(gush)
  const helkaRef   = useRef(helka)
  const timerIds   = useRef([])
  const locateRun  = useRef(0)
  useEffect(() => { gushRef.current  = gush  }, [gush])
  useEffect(() => { helkaRef.current = helka }, [helka])

  const clearRetryTimers = useCallback(() => {
    timerIds.current.forEach(clearTimeout)
    timerIds.current = []
  }, [])

  // ── 2. Zoom to parcel ────────────────────────────────────────────────────────
  // Gush/helka → point is resolved server-side (/api/properties?parcel=, lib/parcel-locate.js), which
  // asks several GovMap sources at once. The widget used to call GovMap's legacy TldSearch service
  // (es.govmap.gov.il) straight from the browser and swallowed every failure, so when that service
  // stopped answering the map silently stayed on the whole country. Now every step is visible
  // (locating → shown / not found, with a link to open the parcel on govmap.gov.il).
  //
  // GovMap ignores zoomToXY until the map has finished initialising, so the zoom is re-issued a few
  // times over the first seconds. The map's own extent events tell us when it has really landed on the
  // parcel, and in which coordinate system the SDK works (ITM, or Web Mercator on newer builds).
  const extentRef = useRef(null)
  const [locate, setLocate] = useState(null)   // null | { state: 'locating' | 'ok' | 'error', g, h, url? }

  const zoomToParcel = useCallback((g, h) => {
    const lot = parseInt(g, 10), parcel = parseInt(h, 10)
    if (!lot || !parcel) return
    timerIds.current.forEach(clearTimeout)
    timerIds.current = []
    const url = govmapLink(lot, parcel)
    const run = ++locateRun.current
    const alive = () => run === locateRun.current
    setError('')
    setLocate({ state: 'locating', g: lot, h: parcel, url })

    const landedOn = pt => {
      const ex = extentRef.current
      if (!ex) return null                         // unknown — the SDK doesn't report its extent
      const p = pt[ex.crs]
      const w = Math.abs(ex.xmax - ex.xmin)
      return Math.hypot(ex.cx - p.x, ex.cy - p.y) < Math.max(250, w / 4) && w < 8000
    }

    const ticks = [0, 400, 900, 1600, 2600, 4000, 6000]
    const STRATEGY = [['itm', 13], ['itm', 13], ['itm', 13], ['auto', 13], ['auto', 10], ['itm', 10], ['itm', 13]]
    const zoomRepeatedly = pt => {
      ticks.forEach((d, i) => {
        timerIds.current.push(setTimeout(() => {
          if (!alive()) return
          const gm = window.govmap
          if (landedOn(pt)) { setLocate({ state: 'ok', g: lot, h: parcel, url }); timerIds.current.forEach(clearTimeout); return }
          if (gm && gm.zoomToXY) {
            // ITM + level 13 is the API's documented contract (and what worked so far). Only when the
            // map reports its extent and still hasn't moved do we try its own system and level 10.
            const ex = extentRef.current
            const [crs, lvl] = STRATEGY[i]
            const p = pt[crs === 'auto' && ex ? ex.crs : 'itm']
            const level = ex ? lvl : 13
            try { gm.zoomToXY({ x: p.x, y: p.y, level, marker: true }) }
            catch { try { gm.zoomToXY({ x: p.x, y: p.y, level: 10, marker: true }) } catch {} }
          }
          if (i === ticks.length - 1) {
            const landed = landedOn(pt)
            if (landed === false) {
              console.warn('[GovMap] zoomToXY did not move the map to', pt)
              locateViaSdk(lot, parcel).then(ok => alive() && setLocate({ state: ok ? 'ok' : 'error', g: lot, h: parcel, url }))
            } else setLocate({ state: 'ok', g: lot, h: parcel, url })
          }
        }, d))
      })
    }

    resolveParcelPoint(lot, parcel).then(pt => {
      if (!alive()) return
      if (pt) { zoomRepeatedly(pt); return }
      // Nothing resolved the parcel — last resort: GovMap's own locate
      locateViaSdk(lot, parcel).then(ok => alive() && setLocate({ state: ok ? 'ok' : 'error', g: lot, h: parcel, url }))
    })
  }, [])

  // ── 3. Create map (runs once when token + inView are ready) ────────────────
  const createMap = useCallback(() => {
    if (created.current || !window.govmap) return
    const el = document.getElementById(mapDivId)
    if (!el) return
    created.current = true
    try {
      // Load ALL layers (not just the default-on ones) so GovMap's own white
      // "שכבות" control lists every one of them. Effect #5 below then hides the
      // non-default layers via setVisibleLayers, so the map opens uncluttered while
      // all layers remain available to toggle in both the GovMap control and ours.
      const allLayers = LAYERS_DEF.map(l => l.id)
      window.govmap.createMap(mapDivId, {
        token:            token || '',
        layers:           allLayers,
        showXY:           false,
        identifyOnClick:  true,
        isEmbeddedToggle: false,
        background:       Number(bgRef.current) || 0,
        layersMode:       1,   // 1 = GovMap's own on-map "שכבות" button (restored).
                               // All 18 layers loaded above are listed in it.
        zoomButtons:      true,
      })
      watchExtent()
      setMapReady(true)
      setError('')
      // The auto-zoom is driven by effect #4 below (it fires once mapReady flips
      // true), so the parcel is shown zoomed-in on open without any "חפש" click.
    } catch (e) {
      setError('שגיאה ביצירת המפה — ודא שמפתח ה-API תקין ורשום לדומיין זה.')
      created.current = false
    }
  }, [mapDivId, token, zoomToParcel, clearRetryTimers])  // eslint-disable-line

  // Track the map's extent (center + coordinate system) so the zoom can verify it really landed.
  // GovMap's event API is jQuery-deferred style (onEvent(e).progress(cb)); newer builds may take the
  // callback directly — both are wired, and a missing event API just means "can't verify".
  function watchExtent() {
    const gm = window.govmap
    try {
      const ev = gm && gm.events && (gm.events.EXTENT_CHANGE || gm.events.extentChange)
      if (!ev || typeof gm.onEvent !== 'function') return
      // The map's coordinate system is judged once, from the first extent it reports (the opening
      // country view) — or any Web Mercator-sized one — never from where a wrong-system zoom landed.
      const cb = e => {
        const ex = readExtent(e)
        if (!ex) return
        const prev = extentRef.current
        const crs = Math.abs(ex.cx) > 1e6 ? 'mercator' : prev ? prev.crs : 'itm'
        extentRef.current = { ...ex, crs }
      }
      const h = gm.onEvent(ev, cb)
      if (h && typeof h.progress === 'function') h.progress(cb)
    } catch (e) { console.warn('[GovMap] extent events unavailable:', e && e.message) }
  }

  // ── Load SDK + create map once in view ────────────────────────────────────
  useEffect(() => {
    if (!token || !inView) return
    loadGovMapScript(createMap)
  }, [token, inView, createMap])

  // Cancel timers on unmount
  useEffect(() => clearRetryTimers, [])  // eslint-disable-line

  // Keep the toolbar inputs in step with the property's gush/helka (e.g. typed in the wizard)
  useEffect(() => { setGushVal(gush || ''); setHelkaVal(helka || ''); setSubHelkaVal(subHelka || '') }, [gush, helka, subHelka])

  // ── 4. Auto-zoom to the parcel once the map is ready (and on prop change) ───
  // zoomToParcel itself re-issues the zoom over the first few seconds, so this
  // single trigger reliably lands the map on the gush/helka WITHOUT a "חפש" click.
  useEffect(() => {
    if (!mapReady || !gush || !helka) return
    zoomToParcel(gush, helka)
  }, [gush, helka, mapReady, zoomToParcel])

  // ── 5. Apply the layer selection to the map ─────────────────────────────────
  // This effect was MISSING — toggling a layer only updated React state (the
  // checkbox) but never told the map, so nothing ever appeared. GovMap's runtime
  // API for showing/hiding layers is setVisibleLayers(layersOn, layersOff); we call
  // it on every change (and once the map is ready) so the map mirrors the panel,
  // exactly like the GovMap site.
  useEffect(() => {
    if (!mapReady || !window.govmap || typeof window.govmap.setVisibleLayers !== 'function') return
    const on  = LAYERS_DEF.filter(l =>  layers[l.id]).map(l => l.id)
    const off = LAYERS_DEF.filter(l => !layers[l.id]).map(l => l.id)
    // Re-issue over the first seconds — GovMap ignores setVisibleLayers until the
    // map finishes loading (same as zoomToXY). Without this the non-default layers
    // we load in createMap (so the white control lists them all) would stay visible
    // and clutter the map on open.
    const ts = [0, 500, 1200, 2400].map(d => setTimeout(() => {
      try { window.govmap.setVisibleLayers(on, off) } catch (e) { console.error('[GovMap] setVisibleLayers failed:', e) }
    }, d))
    return () => ts.forEach(clearTimeout)
  }, [layers, mapReady])

  // ── Layer / BG controls ─────────────────────────────────────────────────────
  function toggleLayer(id) {
    // Pure state update — the effect above applies it to the map via setVisibleLayers.
    setLayers(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleBg(v) {
    setBg(v)
    if (window.govmap && mapReady) window.govmap.setBackground(Number(v))
  }

  // Manual search from the toolbar inputs (גוש / חלקה / תת). Falls back to the
  // pre-existing zoom helper, which already has retry-on-not-ready logic.
  function handleSearch() {
    const g = String(gushVal  || '').trim()
    const h = String(helkaVal || '').trim()
    if (!g || !h) return
    if (!mapReady || !window.govmap) {
      setError('המפה עוד לא מוכנה — נסה שוב בעוד רגע')
      return
    }
    zoomToParcel(g, h)
  }

  function toggleMeasure() {
    if (!window.govmap || !mapReady) return
    if (measuring) { window.govmap.closeMeasure(); setMeasuring(false) }
    else           { window.govmap.showMeasure();  setMeasuring(true)  }
  }

  // ── Shared styles ───────────────────────────────────────────────────────────
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

  // ── No token ────────────────────────────────────────────────────────────────
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
    // data-no-swipe: the parent PropertyModal closes on a horizontal swipe
    // (useSwipeClose). Panning the GovMap map horizontally was triggering that and
    // bouncing the user back to the main page — this attribute tells the swipe
    // handler to ignore every touch that originates inside the map widget.
    <div ref={containerRef} data-no-swipe
      onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
      style={{ position:'relative', border:`1px solid ${C.purple}22`, borderRadius:12,
               overflow:'hidden', background: isDark ? '#0A0A16' : '#f8f7f3',
               direction:'rtl', fontFamily:'Rubik,inherit' }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      {/* position:relative + high z-index keeps the toolbar (and its חפש button)
          clickable above the GovMap canvas, which otherwise overlays it. */}
      <div style={{ position:'relative', zIndex:40,
                    display:'flex', gap:8, alignItems:'center', padding:'9px 12px',
                    background: isDark ? 'rgba(14,14,28,.97)' : 'rgba(236,234,245,.97)',
                    borderBottom:`1px solid ${C.purple}20`, flexWrap:'wrap' }}>

        {/* Gush / Helka search */}
        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:`${C.cream}88`, fontWeight:700 }}>גוש</span>
          <input value={gushVal}     onChange={e=>setGushVal(e.target.value)}     placeholder="40095" style={inputSt} onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
          <span style={{ fontSize:11, color:`${C.cream}88`, fontWeight:700 }}>חלקה</span>
          <input value={helkaVal}    onChange={e=>setHelkaVal(e.target.value)}    placeholder="13"    style={inputSt} onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
          <span style={{ fontSize:11, color:`${C.cream}88`, fontWeight:700 }}>תת</span>
          <input value={subHelkaVal} onChange={e=>setSubHelkaVal(e.target.value)} placeholder="0"     style={{ ...inputSt, width:44 }} onKeyDown={e=>e.key==='Enter'&&handleSearch()}/>
          <button type="button" onClick={handleSearch} style={{ ...btnSt(false), padding:'6px 14px', background: C.purple, color:'#fff', border:'none' }}>
            חפש
          </button>
        </div>

        <div style={{ width:1, height:22, background:`${C.purple}25`, flexShrink:0 }}/>

        {/* Background selector with visible arrow */}
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

        {/* Layers are selected via GovMap's own on-map "שכבות" button (layersMode:2),
            so our custom layer panel/button was removed to avoid two competing controls. */}

        {/* Measure */}
        <button type="button" onClick={toggleMeasure} style={btnSt(measuring)} title="כלי מדידה">
          📐 מדידה
        </button>

        {error && <span style={{ fontSize:11, color:'#E05252', marginRight:'auto', maxWidth:220 }}>{error}</span>}
      </div>

      {/* ── Layer panel — full-screen bottom-sheet so it's NEVER clipped by the
            map's overflow:hidden (that clipping is why only ~2 layers showed on
            mobile), shows ALL layers in a responsive grid, and fully isolates its
            events so interacting with it never bounces the property modal closed. */}
      {showPanel && (
        <div
          data-no-swipe
          onClick={e => { e.stopPropagation(); setShowPanel(false) }}
          onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
          style={{ position:'fixed', inset:0, zIndex:100000, background:'rgba(0,0,0,.55)',
                   display:'flex', alignItems:'flex-end', justifyContent:'center', direction:'rtl' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: panelBg, width:'100%', maxWidth:560, maxHeight:'82vh',
                     borderRadius:'20px 20px 0 0', display:'flex', flexDirection:'column',
                     boxShadow:'0 -14px 50px rgba(0,0,0,.6)', border:`1px solid ${C.purple}30`,
                     borderBottom:'none', overflow:'hidden', fontFamily:'Rubik,inherit' }}>

            {/* Header + grab handle */}
            <div style={{ flexShrink:0, padding:'10px 18px 12px', borderBottom:`1px solid ${C.purple}1A` }}>
              <div style={{ width:42, height:4, borderRadius:3, background:`${C.cream}33`, margin:'0 auto 12px' }}/>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:16, fontWeight:800, color:C.cream }}>שכבות מידע</span>
                <button type="button" onClick={() => setShowPanel(false)}
                  style={{ width:32, height:32, borderRadius:9, background:`${C.cream}12`, border:'none', color:C.cream, cursor:'pointer', fontSize:19, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
              </div>
            </div>

            {/* Scrollable, responsive layer grid */}
            <div style={{ flex:1, minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', overscrollBehavior:'contain', scrollBehavior:'smooth', padding:'14px 16px 20px' }}>
              {LAYER_CATS.map(cat => {
                const catLayers = LAYERS_DEF.filter(l => l.cat === cat)
                if (!catLayers.length) return null
                return (
                  <div key={cat} style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:`${C.cream}55`, letterSpacing:'.06em',
                                  textTransform:'uppercase', marginBottom:9, borderBottom:`1px solid ${C.purple}18`, paddingBottom:5 }}>
                      {cat}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:9 }}>
                      {catLayers.map(l => (
                        <div key={l.id} role="checkbox" aria-checked={!!layers[l.id]}
                          onClick={() => toggleLayer(l.id)}
                          style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13.5,
                                   color: layers[l.id] ? C.cream : `${C.cream}AA`, userSelect:'none', transition:'all .12s',
                                   padding:'12px 12px', borderRadius:11,
                                   border:`1px solid ${layers[l.id] ? `${l.color}77` : `${C.purple}1A`}`,
                                   background: layers[l.id] ? `${l.color}24` : `${C.cream}07` }}>
                          <span style={{ width:21, height:21, borderRadius:6, flexShrink:0, transition:'all .15s',
                                     border:`2px solid ${layers[l.id] ? l.color : `${C.cream}33`}`,
                                     background: layers[l.id] ? l.color : 'transparent',
                                     display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {layers[l.id] && <span style={{ color:'#fff', fontSize:12, fontWeight:900, lineHeight:1 }}>✓</span>}
                          </span>
                          <span style={{ flex:1, lineHeight:1.25 }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div style={{ paddingTop:6, fontSize:10, color:`${C.cream}33`, textAlign:'center' }}>
                מקור: פורטל GovMap הממשלתי
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Map canvas ──────────────────────────────────────────────────────── */}
      <div style={{ position:'relative' }}>
        <div id={mapDivId} style={{ width:'100%', height: compact ? 340 : 500 }}/>
        {mapReady && locate && (
          <div role="status" aria-live="polite"
            style={{ position:'absolute', top:10, left:10, zIndex:30, maxWidth:'calc(100% - 20px)',
                     display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
                     padding:'7px 12px', borderRadius:10, fontSize:12, fontWeight:600, direction:'rtl',
                     background: locate.state === 'error' ? 'rgba(254,242,242,.97)' : 'rgba(255,255,255,.96)',
                     color: locate.state === 'error' ? '#B42318' : '#1F2340',
                     border:`1px solid ${locate.state === 'error' ? '#F4B4AE' : 'rgba(31,35,64,.14)'}`,
                     boxShadow:'0 4px 14px rgba(0,0,0,.18)' }}>
            {locate.state === 'locating' && (
              <span style={{ width:12, height:12, border:'2px solid rgba(63,73,166,.25)', borderTopColor:'#3F49A6', borderRadius:'50%', animation:'gm_spin .8s linear infinite', flexShrink:0 }}/>
            )}
            <span>
              {locate.state === 'locating' && `מאתר גוש ${locate.g} · חלקה ${locate.h}…`}
              {locate.state === 'ok'       && `📍 גוש ${locate.g} · חלקה ${locate.h}`}
              {locate.state === 'error'    && `לא הצלחנו לאתר את גוש ${locate.g} חלקה ${locate.h} במפה`}
            </span>
            {locate.state !== 'locating' && (
              <a href={locate.url} target="_blank" rel="noopener noreferrer"
                style={{ color:'#3F49A6', textDecoration:'underline', whiteSpace:'nowrap' }}>
                פתח ב-GovMap ↗
              </a>
            )}
            {locate.state === 'error' && (
              <button type="button" onClick={() => zoomToParcel(locate.g, locate.h)}
                style={{ background:'#3F49A6', color:'#fff', border:'none', borderRadius:7, padding:'4px 10px', fontSize:11.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                נסה שוב
              </button>
            )}
            <style>{`@keyframes gm_spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </div>

      {/* ── Loading / placeholder overlay ───────────────────────────────────── */}
      {!mapReady && (
        <div style={{ position:'absolute', inset:0, top:43, zIndex:5,
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                      gap:16,
                      background: isDark ? 'rgba(10,10,22,.93)' : 'rgba(245,242,252,.93)' }}>
          {inView ? (
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
          ) : (
            <div style={{ textAlign:'center', direction:'rtl' }}>
              <div style={{ fontSize:28, marginBottom:10 }}>🗺️</div>
              <div style={{ fontSize:13, color:`${C.cream}55`, fontFamily:'Rubik,inherit' }}>
                גלול למטה להצגת המפה
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
