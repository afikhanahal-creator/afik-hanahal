import test from 'node:test'
import assert from 'node:assert/strict'
import { gunzipSync } from 'zlib'
import { compressJson } from './http.js'

function fakeRes() {
  const r = { statusCode: 200, headers: {}, sent: null, ended: false }
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v }
  r.getHeader = k => r.headers[k.toLowerCase()]
  r.status = c => { r.statusCode = c; return r }
  r.send = b => { r.sent = b; return r }
  r.end = () => { r.ended = true; return r }
  return r
}
const big = { items: Array.from({ length: 200 }, (_, i) => ({ i, text: 'הודעה '.repeat(5) })) }

test('compressJson: res.json goes out gzipped with an ETag, status kept', () => {
  const req = { headers: { 'accept-encoding': 'gzip, br' } }
  const res = fakeRes(); compressJson(req, res)
  res.status(201).json(big)
  assert.equal(res.statusCode, 201)
  assert.equal(res.headers['content-encoding'], 'gzip')
  assert.ok(res.headers.etag)
  assert.deepEqual(JSON.parse(gunzipSync(res.sent).toString()), big)
  assert.ok(res.sent.length < JSON.stringify(big).length / 5, 'much smaller on the wire')
})

test('compressJson: a repeat poll with the ETag (GET or POST) gets an empty 304', () => {
  const first = fakeRes(); compressJson({ headers: {} }, first); first.json(big)
  const res = fakeRes(); compressJson({ method: 'POST', headers: { 'if-none-match': first.headers.etag } }, res)
  res.json(big)
  assert.equal(res.statusCode, 304); assert.equal(res.ended, true); assert.equal(res.sent, null)
})

test('compressJson: errors and small answers still work', () => {
  const res = fakeRes(); compressJson({ headers: { 'accept-encoding': 'gzip' } }, res)
  res.status(502).json({ error: 'x' })
  assert.equal(res.statusCode, 502); assert.equal(JSON.parse(res.sent).error, 'x'); assert.equal(res.headers['content-encoding'], undefined)
})
