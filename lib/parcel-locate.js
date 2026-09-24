// Gush / helka → map point, for the GovMap widget.
// The widget used to resolve parcels in the browser through GovMap's legacy TldSearch service
// (es.govmap.gov.il), and swallowed every failure — when that service stopped answering, the map
// silently stayed on the whole country. This resolver runs server-side (no CORS, no browser
// blocking) and asks several GovMap sources in parallel, so one retired endpoint can't break it:
//   1. GovMap's own parcel layer over WFS (the new govmap.gov.il platform)
//   2. GovMap open-data parcels WFS (ITM)
//   3. GovMap search autocomplete (the new site's search box)
//   4. legacy TldSearch
// Every answer is auto-detected (ITM / Web Mercator / WGS84), sanity-checked to lie in Israel and
// returned in all three systems, so the client can feed zoomToXY whichever one the SDK expects.

// ── Coordinates ────────────────────────────────────────────────────────────────
const A = 6378137.0
const F = 1 / 298.257223563
const E2 = 2 * F - F * F
const LAT0 = (31 + 44 / 60 + 3.817 / 3600) * Math.PI / 180
const LON0 = (35 + 12 / 60 + 16.261 / 3600) * Math.PI / 180
const K0 = 1.0000067
const FE = 219529.584
const FN = 626907.39
const R2D = 180 / Math.PI
const MERC = 20037508.342789244

// Meridian arc length from the equator (Snyder 3-21)
const arc = phi => A * (
  (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * phi
  - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(2 * phi)
  + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(4 * phi)
  - (35 * E2 ** 3 / 3072) * Math.sin(6 * phi))
const M0 = arc(LAT0)
const EP2 = E2 / (1 - E2)

// ITM (EPSG:2039) is a transverse Mercator on GRS80, whose ellipsoid is WGS84 to well under a
// millimetre; the ~1 m datum shift is irrelevant for centring a map on a parcel.
export function itmToWgs84(x, y) {
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2))
  const mu = (M0 + (y - FN) / K0) / (A * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256))
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu)
  const n1 = A / Math.sqrt(1 - E2 * Math.sin(p1) ** 2)
  const t1 = Math.tan(p1) ** 2
  const c1 = EP2 * Math.cos(p1) ** 2
  const r1 = A * (1 - E2) / (1 - E2 * Math.sin(p1) ** 2) ** 1.5
  const d = (x - FE) / (n1 * K0)
  const lat = p1 - (n1 * Math.tan(p1) / r1) * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * EP2) * d ** 4 / 24
    + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * EP2 - 3 * c1 ** 2) * d ** 6 / 720)
  const lon = LON0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * EP2 + 24 * t1 ** 2) * d ** 5 / 120) / Math.cos(p1)
  return { lat: lat * R2D, lon: lon * R2D }
}

export function wgs84ToItm(lat, lon) {
  const phi = lat / R2D, lam = lon / R2D
  const n = A / Math.sqrt(1 - E2 * Math.sin(phi) ** 2)
  const t = Math.tan(phi) ** 2
  const c = EP2 * Math.cos(phi) ** 2
  const a = (lam - LON0) * Math.cos(phi)
  const x = FE + K0 * n * (a + (1 - t + c) * a ** 3 / 6 + (5 - 18 * t + t ** 2 + 72 * c - 58 * EP2) * a ** 5 / 120)
  const y = FN + K0 * (arc(phi) - M0 + n * Math.tan(phi) * (a ** 2 / 2 + (5 - t + 9 * c + 4 * c ** 2) * a ** 4 / 24
    + (61 - 58 * t + t ** 2 + 600 * c - 330 * EP2) * a ** 6 / 720))
  return { x, y }
}

export const wgs84ToMercator = (lat, lon) => ({
  x: lon * MERC / 180,
  y: Math.log(Math.tan((90 + lat) * Math.PI / 360)) * MERC / Math.PI,
})
export const mercatorToWgs84 = (x, y) => ({
  lat: (2 * Math.atan(Math.exp(y / MERC * Math.PI)) - Math.PI / 2) * R2D,
  lon: x / MERC * 180,
})

const inIsrael = ({ lat, lon }) => lat > 29.3 && lat < 33.5 && lon > 34.1 && lon < 35.95

// Which system a raw x/y pair is in, judged by magnitude (the three never overlap over Israel)
export function detectCrs(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  if (x > 34 && x < 36.5 && y > 29 && y < 34) return 'wgs84'          // lon, lat
  if (y > 34 && y < 36.5 && x > 29 && x < 34) return 'wgs84-latlon'   // lat, lon
  if (x > 3.5e6 && x < 4.2e6 && y > 3.3e6 && y < 4.1e6) return 'mercator'
  if (x > 100000 && x < 300000 && y > 350000 && y < 820000) return 'itm'
  return null
}

// One point in every system the client might need. Returns null when it isn't in Israel.
export function normalizePoint(x, y) {
  const crs = detectCrs(Number(x), Number(y))
  if (!crs) return null
  let wgs
  if (crs === 'wgs84') wgs = { lat: +y, lon: +x }
  else if (crs === 'wgs84-latlon') wgs = { lat: +x, lon: +y }
  else if (crs === 'mercator') wgs = mercatorToWgs84(+x, +y)
  else wgs = itmToWgs84(+x, +y)
  if (!inIsrael(wgs)) return null
  const itm = crs === 'itm' ? { x: +x, y: +y } : wgs84ToItm(wgs.lat, wgs.lon)
  const mercator = crs === 'mercator' ? { x: +x, y: +y } : wgs84ToMercator(wgs.lat, wgs.lon)
  const r = v => Math.round(v * 100) / 100
  return {
    itm: { x: r(itm.x), y: r(itm.y) },
    mercator: { x: r(mercator.x), y: r(mercator.y) },
    wgs84: { lat: Math.round(wgs.lat * 1e7) / 1e7, lon: Math.round(wgs.lon * 1e7) / 1e7 },
  }
}

// ── Response parsing ───────────────────────────────────────────────────────────
// Bounding-box centre of any GeoJSON geometry (a parcel's centre is all a map needs)
export function geometryCenter(geom) {
  if (!geom) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const walk = c => {
    if (!Array.isArray(c)) return
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1])
      return
    }
    c.forEach(walk)
  }
  if (geom.type === 'GeometryCollection') (geom.geometries || []).forEach(g => walk(g.coordinates))
  else walk(geom.coordinates)
  if (!Number.isFinite(minX)) return null
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, bbox: [minX, minY, maxX, maxY] }
}

export function parseWktPoint(wkt) {
  const m = String(wkt || '').match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i)
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null
}

const num = v => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : NaN }
const pick = (o, keys) => { for (const k of Object.keys(o || {})) if (keys.includes(k.toLowerCase())) return o[k]; return undefined }

// WFS FeatureCollection → centre of the requested parcel (prefers the plain block, suffix 0)
export function pointFromWfs(body, gush, helka) {
  const feats = Array.isArray(body?.features) ? body.features : []
  const match = feats.filter(f => {
    const p = f?.properties || {}
    const g = num(pick(p, ['gush_num', 'gush', 'lot']))
    const h = num(pick(p, ['parcel', 'helka', 'parcel_num']))
    return (!Number.isFinite(g) || g === gush) && (!Number.isFinite(h) || h === helka)
  })
  const suffix0 = match.find(f => !num(pick(f.properties || {}, ['gush_suffix', 'gush_suffi'])))
  const feat = suffix0 || match[0]
  return feat ? geometryCenter(feat.geometry) : null
}

// GovMap autocomplete → the result that is exactly this gush + helka
export function pointFromAutocomplete(body, gush, helka) {
  const results = Array.isArray(body?.results) ? body.results : Array.isArray(body) ? body : []
  const rx = new RegExp(`(^|\\D)${gush}(\\D|$)[\\s\\S]*?(^|\\D)${helka}(\\D|$)`)
  const exact = results.filter(r => rx.test(String(r?.text || r?.originalText || '')) || rx.test(String(r?.id || '')))
  const best = exact.find(r => /parcel|חלק/i.test(`${r?.type || ''} ${r?.text || ''}`)) || exact[0]
  if (!best) return null
  return parseWktPoint(best.shape) || geometryCenter(best.geometry) || (Number(best.x) && { x: Number(best.x), y: Number(best.y) }) || null
}

// Legacy TldSearch → first hit's X/Y (ITM)
export function pointFromTld(body) {
  const groups = body?.data || {}
  const key = (Array.isArray(body?.order) && body.order[0]) || Object.keys(groups)[0]
  const item = key && Array.isArray(groups[key]) ? groups[key][0] : null
  const x = Number(item?.X ?? item?.x), y = Number(item?.Y ?? item?.y)
  return x && y ? { x, y } : null
}

// ── Sources ────────────────────────────────────────────────────────────────────
const HEADERS = {
  Accept: 'application/json',
  Origin: 'https://www.govmap.gov.il',
  Referer: 'https://www.govmap.gov.il/',
  'User-Agent': 'Mozilla/5.0 (compatible; AfikHanahal/1.0; +https://afikhanahal.co.il)',
}

export function sources(gush, helka) {
  const q = `גוש ${gush} חלקה ${helka}`
  return [
    {
      name: 'govmap-wfs',
      url: 'https://www.govmap.gov.il/api/geoserver/wfs?' + new URLSearchParams({
        service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'govmap:layer_parcel_all',
        CQL_FILTER: `gush_num=${gush} AND parcel=${helka}`, outputFormat: 'application/json', count: '5',
      }),
      parse: b => pointFromWfs(b, gush, helka),
    },
    {
      name: 'opendata-wfs',
      url: 'https://open.govmap.gov.il/geoserver/opendata/wfs?' + new URLSearchParams({
        SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature', typeName: 'Parcels_ITM',
        outputFormat: 'json', count: '5', cql_filter: `GUSH_NUM = ${gush} AND PARCEL = ${helka}`,
      }),
      parse: b => pointFromWfs(b, gush, helka),
    },
    {
      name: 'govmap-search',
      url: 'https://www.govmap.gov.il/api/search-service/autocomplete',
      init: { method: 'POST', body: JSON.stringify({ searchText: q, language: 'he', isAccurate: true, maxResults: 5 }) },
      parse: b => pointFromAutocomplete(b, gush, helka),
    },
    {
      name: 'tldsearch',
      url: `https://es.govmap.gov.il/TldSearch/api/DetailsByQuery?query=${encodeURIComponent(q)}&lyrs=276589&gid=govmap`,
      parse: pointFromTld,
    },
  ]
}

async function trySource(src, fetchImpl, timeoutMs) {
  const init = { ...(src.init || {}), headers: { ...HEADERS, ...(src.init?.body ? { 'Content-Type': 'application/json' } : {}) } }
  const r = await fetchImpl(src.url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  if (!r.ok) throw new Error(`${src.name}: HTTP ${r.status}`)
  const text = await r.text()
  let body
  try { body = JSON.parse(text) } catch { throw new Error(`${src.name}: not JSON`) }
  const raw = src.parse(body)
  if (!raw) throw new Error(`${src.name}: parcel not found`)
  const point = normalizePoint(raw.x, raw.y)
  if (!point) throw new Error(`${src.name}: point outside Israel (${raw.x}, ${raw.y})`)
  return { source: src.name, ...point }
}

// Ask every source at once and answer with the FIRST one that finds the parcel — all of them return
// the parcel itself (checked to lie in Israel), so there's no reason to wait for a slower "better" one.
// Only when every source has failed is the answer "not found".
export function resolveParcel(gush, helka, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const g = parseInt(gush, 10), h = parseInt(helka, 10)
  if (!(g > 0 && g < 1e6 && h > 0 && h < 1e5)) return Promise.resolve({ ok: false, error: 'bad_input', tried: [] })
  const list = sources(g, h)
  const state = list.map(() => null)   // null = pending · { ok, error? }
  const t0 = Date.now()
  return new Promise(done => {
    let finished = false
    const tried = () => state.map((s, i) => s && { source: list[i].name, ok: s.ok, ...(s.ok ? {} : { error: s.error }) }).filter(Boolean)
    list.forEach((s, i) => {
      trySource(s, fetchImpl, timeoutMs).then(value => {
        state[i] = { ok: true }
        if (!finished) { finished = true; done({ ok: true, gush: g, helka: h, ...value, ms: Date.now() - t0, tried: tried() }) }
      }, e => {
        state[i] = { ok: false, error: String(e?.message || e).slice(0, 160) }
        if (!finished && state.every(Boolean)) { finished = true; done({ ok: false, gush: g, helka: h, error: 'not_found', ms: Date.now() - t0, tried: tried() }) }
      })
    })
  })
}

// Link that opens the parcel on govmap.gov.il itself
export const govmapParcelUrl = (gush, helka) =>
  `https://www.govmap.gov.il/?q=${encodeURIComponent(`גוש ${gush} חלקה ${helka}`)}&lay=PARCEL_ALL&lot=${encodeURIComponent(gush)}&parcel=${encodeURIComponent(helka)}`
