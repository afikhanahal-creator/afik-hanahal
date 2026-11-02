// The voice routes of api/meta.js end to end with a fake provider: the raw audio bytes reach the speech service unchanged
// (the handler used to read every body as text), and the JSON routes still parse.
import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'

process.env.OPENAI_API_KEY = 'test-key'
const { default: handler } = await import('../api/meta.js')

function call(path, { method = 'POST', body, type = 'application/json', query = {} } = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body == null ? '' : JSON.stringify(body))
  const req = Readable.from([buf.subarray(0, 3), buf.subarray(3)])
  Object.assign(req, { method, headers: { authorization: 'Bearer AFIKhanahal2026', 'content-type': type }, query: { _path: path, ...query }, url: `/api/meta/${path}` })
  return new Promise(resolve => {
    const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v }, getHeader(k) { return this.headers[k.toLowerCase()] },
      status(c) { this.statusCode = c; return this }, json(d) { resolve({ status: this.statusCode, body: d }); return this }, end(d) { let body; try { body = d ? JSON.parse(Buffer.isBuffer(d) ? d.toString('utf8') : d) : undefined } catch { body = d } resolve({ status: this.statusCode, body }); return this }, write() { return true }, send(d) { return this.end(d) } }
    handler(req, res)
  })
}

test('voice-transcribe passes the exact bytes; voice-status; auth', async () => {
  const audio = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0xff, 0x00, 0xd7, 0x90, 0x80])   // not valid UTF-8 on purpose
  let sent
  const realFetch = globalThis.fetch
  globalThis.fetch = async (url, o) => { if (/openai/.test(url)) { sent = Buffer.from(await o.body.get('file').arrayBuffer()); return { ok: true, json: async () => ({ text: 'שלום' }) } } return realFetch(url, o) }
  try {
    const r = await call('voice-transcribe', { body: audio, type: 'application/octet-stream', query: { mime: 'audio/webm;codecs=opus', lang: 'he' } })
    assert.equal(r.status, 200); assert.equal(r.body.text, 'שלום')
    assert.ok(sent.equals(audio))
  } finally { globalThis.fetch = realFetch }
  const st = await call('voice-status', { method: 'GET' })
  assert.equal(st.body.provider, 'openai')
  const req = await call('voice-process', { body: { transcript: '' } })
  assert.equal(req.status, 400)
})
