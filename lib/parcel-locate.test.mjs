import test from 'node:test'
import assert from 'node:assert/strict'
import {
  itmToWgs84, wgs84ToItm, wgs84ToMercator, mercatorToWgs84, detectCrs, normalizePoint,
  geometryCenter, parseWktPoint, pointFromWfs, pointFromAutocomplete, pointFromTld, resolveParcel, govmapParcelUrl,
} from './parcel-locate.js'

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) < eps, `${msg}: ${a} vs ${b}`)

test('ITM ↔ WGS84 matches proj4 (EPSG:2039)', () => {
  // Reference values computed with proj4 for the Sharon region, the Dead Sea and Eilat
  for (const [x, y, lat, lon] of [[187000, 675000, 32.167633, 34.8596378], [250000, 580000, 31.3109453, 35.5246051], [160000, 400000, 29.6862719, 34.5894779]]) {
    const w = itmToWgs84(x, y)
    near(w.lat, lat, 1e-6, 'lat'); near(w.lon, lon, 1e-6, 'lon')
    const b = wgs84ToItm(lat, lon)
    near(b.x, x, 0.2, 'x'); near(b.y, y, 0.2, 'y')
  }
})

test('Web Mercator round trip', () => {
  const m = wgs84ToMercator(32.2, 34.9)
  near(m.x, 3885050.8, 1, 'x')
  const w = mercatorToWgs84(m.x, m.y)
  near(w.lat, 32.2, 1e-9, 'lat'); near(w.lon, 34.9, 1e-9, 'lon')
})

test('CRS detection and normalisation', () => {
  assert.equal(detectCrs(190500, 688400), 'itm')
  assert.equal(detectCrs(3884500, 3800000), 'mercator')
  assert.equal(detectCrs(34.9, 32.2), 'wgs84')
  assert.equal(detectCrs(32.2, 34.9), 'wgs84-latlon')
  assert.equal(detectCrs(0, 0), null)
  const p = normalizePoint(190500, 688400)
  assert.deepEqual(p.itm, { x: 190500, y: 688400 })
  const back = normalizePoint(p.mercator.x, p.mercator.y)
  near(back.itm.x, 190500, 0.5, 'x'); near(back.itm.y, 688400, 0.5, 'y')
  assert.equal(normalizePoint(3000000, 3500000), null)   // outside the detectable ranges
})

test('geometry centre and WKT', () => {
  const poly = { type: 'MultiPolygon', coordinates: [[[[10, 10], [20, 10], [20, 30], [10, 30], [10, 10]]]] }
  assert.deepEqual(geometryCenter(poly), { x: 15, y: 20, bbox: [10, 10, 20, 30] })
  assert.deepEqual(geometryCenter({ type: 'Point', coordinates: [5, 6] }), { x: 5, y: 6, bbox: [5, 6, 5, 6] })
  assert.equal(geometryCenter(null), null)
  assert.deepEqual(parseWktPoint('POINT(3884500.5 3800000.25)'), { x: 3884500.5, y: 3800000.25 })
  assert.equal(parseWktPoint('LINESTRING(1 2, 3 4)'), null)
})

test('WFS parsing picks the right parcel, suffix 0 first', () => {
  const sq = (x, y) => ({ type: 'Polygon', coordinates: [[[x, y], [x + 10, y], [x + 10, y + 10], [x, y + 10], [x, y]]] })
  const body = { features: [
    { properties: { gush_num: 10046, gush_suffix: 1, parcel: 13 }, geometry: sq(100, 100) },
    { properties: { gush_num: 10046, gush_suffix: 0, parcel: 13 }, geometry: sq(200, 200) },
    { properties: { gush_num: 10046, parcel: 14 }, geometry: sq(300, 300) },
  ] }
  assert.equal(pointFromWfs(body, 10046, 13).x, 205)
  assert.equal(pointFromWfs({ features: [{ properties: { GUSH_NUM: '10046', PARCEL: '13' }, geometry: sq(0, 0) }] }, 10046, 13).x, 5)
  assert.equal(pointFromWfs({ features: [] }, 10046, 13), null)
  assert.equal(pointFromWfs(body, 10046, 99), null)
})

test('autocomplete parsing needs an exact gush + helka match', () => {
  const body = { results: [
    { text: 'גוש 10046 חלקה 130', type: 'parcel', shape: 'POINT(1 1)' },
    { text: 'רחוב הגוש 13, תל מונד', type: 'address', shape: 'POINT(2 2)' },
    { text: 'גוש 10046 חלקה 13', type: 'parcel', shape: 'POINT(3884500 3800000)' },
  ] }
  assert.deepEqual(pointFromAutocomplete(body, 10046, 13), { x: 3884500, y: 3800000 })
  assert.equal(pointFromAutocomplete({ results: [{ text: 'גוש 10046 חלקה 130', shape: 'POINT(1 1)' }] }, 10046, 13), null)
})

test('legacy TldSearch parsing', () => {
  assert.deepEqual(pointFromTld({ order: ['GOVMAP_PARCEL_ALL'], data: { GOVMAP_PARCEL_ALL: [{ X: 190500, Y: 688400 }] } }), { x: 190500, y: 688400 })
  assert.equal(pointFromTld({ data: {} }), null)
})

const jsonRes = (body, ok = true) => ({ ok, status: ok ? 200 : 500, text: async () => JSON.stringify(body) })

const later = (ms, v) => new Promise(r => setTimeout(() => r(v), ms))

test('resolver: the first source that finds the parcel wins, failures are reported', async () => {
  const fetchImpl = async url => {
    if (url.includes('www.govmap.gov.il/api/geoserver')) return jsonRes({}, false)          // new WFS down
    if (url.includes('open.govmap.gov.il')) return jsonRes({ features: [{ properties: { GUSH_NUM: 10046, PARCEL: 13 }, geometry: { type: 'Point', coordinates: [190500, 688400] } }] })
    if (url.includes('autocomplete')) return later(80, jsonRes({ results: [{ text: 'גוש 10046 חלקה 13', shape: 'POINT(3884000 3800000)' }] }))
    throw new Error('blocked')
  }
  const r = await resolveParcel('10046', '13', { fetchImpl })
  assert.equal(r.ok, true)
  assert.equal(r.source, 'opendata-wfs')
  assert.deepEqual(r.itm, { x: 190500, y: 688400 })
  assert.ok(r.mercator.x > 3.8e6 && r.wgs84.lat > 32)
  assert.equal(r.tried.find(t => t.source === 'govmap-wfs').ok, false)
})

test('resolver: a slow source never holds back a fast answer', async () => {
  const fetchImpl = async url => {
    if (url.includes('www.govmap.gov.il/api/geoserver')) return later(1500, jsonRes({ features: [] }))   // slow, top priority
    if (url.includes('autocomplete')) return jsonRes({ results: [{ text: 'גוש 10046 חלקה 13', shape: 'POINT(3884000 3800000)' }] })
    return later(1500, jsonRes({}, false))
  }
  const t0 = Date.now()
  const r = await resolveParcel(10046, 13, { fetchImpl })
  assert.equal(r.ok, true); assert.equal(r.source, 'govmap-search')
  assert.ok(Date.now() - t0 < 500, `took ${Date.now() - t0} ms`)
})

test('resolver: every source failing gives not_found, bad input is rejected', async () => {
  const r = await resolveParcel(10046, 13, { fetchImpl: async () => { throw new Error('offline') } })
  assert.equal(r.ok, false); assert.equal(r.error, 'not_found'); assert.equal(r.tried.length, 4)
  assert.equal((await resolveParcel('abc', '13')).error, 'bad_input')
  // A point outside Israel is never accepted
  const far = await resolveParcel(10046, 13, { fetchImpl: async () => jsonRes({ data: { A: [{ X: 5, Y: 5 }] } }) })
  assert.equal(far.ok, false)
})

test('govmap link', () => {
  assert.ok(govmapParcelUrl(10046, 13).includes('lot=10046&parcel=13'))
})
