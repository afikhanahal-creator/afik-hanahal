import test from 'node:test'
import assert from 'node:assert/strict'
import { voiceProvider, transcribeAudio, cleanMime, vocabHint, MAX_SEGMENT_BYTES } from './transcribe.js'

test('provider and mime', () => {
  assert.equal(voiceProvider({}), '')
  assert.equal(voiceProvider({ ELEVENLABS_API_KEY: 'x' }), 'elevenlabs')
  assert.equal(voiceProvider({ OPENAI_API_KEY: ' k ', ELEVENLABS_API_KEY: 'x' }), 'openai')
  assert.equal(cleanMime('audio/webm;codecs=opus'), 'audio/webm')
  assert.equal(cleanMime('audio/mp4'), 'audio/mp4')
  assert.equal(cleanMime('video/mp4'), '')
  assert.match(vocabHint(['רונן כהן']), /^רונן כהן, אפיק הנחל/)
})

test('openai call: model, language, prompt; errors in words', async () => {
  let got
  const fetchImpl = async (url, o) => { got = { url, o }; return { ok: true, json: async () => ({ text: '  דיברנו   עם רונן ' }) } }
  const r = await transcribeAudio(Buffer.from('abc'), { mime: 'audio/webm;codecs=opus', hint: 'רונן' }, { env: { OPENAI_API_KEY: 'k' }, fetchImpl })
  assert.deepEqual(r, { text: 'דיברנו עם רונן', provider: 'openai' })
  assert.match(got.url, /audio\/transcriptions/)
  assert.equal(got.o.body.get('model'), 'gpt-4o-transcribe')
  assert.equal(got.o.body.get('language'), 'he')
  assert.match(got.o.body.get('prompt'), /רונן/)
  assert.equal(got.o.headers.Authorization, 'Bearer k')
  const el = await transcribeAudio(Buffer.from('a'), { mime: 'audio/mp4' }, { env: { ELEVENLABS_API_KEY: 'e' }, fetchImpl: async (u, o) => { got = { u, o }; return { ok: true, json: async () => ({ text: 'שלום' }) } } })
  assert.equal(el.text, 'שלום'); assert.equal(got.o.body.get('language_code'), 'heb'); assert.equal(got.o.headers['xi-api-key'], 'e')
  assert.equal((await transcribeAudio(Buffer.from('a'), { mime: 'audio/webm' }, { env: {} })).code, 'no_provider')
  assert.equal((await transcribeAudio(Buffer.alloc(0), { mime: 'audio/webm' }, { env: { OPENAI_API_KEY: 'k' } })).code, 'empty')
  assert.equal((await transcribeAudio(Buffer.alloc(MAX_SEGMENT_BYTES + 1), { mime: 'audio/webm' }, { env: { OPENAI_API_KEY: 'k' } })).code, 'too_large')
  assert.equal((await transcribeAudio(Buffer.from('a'), { mime: 'text/plain' }, { env: { OPENAI_API_KEY: 'k' } })).code, 'format')
  const bad = await transcribeAudio(Buffer.from('a'), { mime: 'audio/webm' }, { env: { OPENAI_API_KEY: 'k' }, fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'Incorrect API key' } }) }) })
  assert.equal(bad.code, 'auth'); assert.match(bad.error, /Incorrect API key/)
  const net = await transcribeAudio(Buffer.from('a'), { mime: 'audio/webm' }, { env: { OPENAI_API_KEY: 'k' }, fetchImpl: async () => { throw new Error('x') } })
  assert.equal(net.code, 'network')
})
