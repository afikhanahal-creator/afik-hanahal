import test from 'node:test'
import assert from 'node:assert/strict'
import { forwardTarget, forwardGreenHook } from './green-forward.js'

const URL_ = 'https://www.kurkoos-group.co.il/api/finance-whatsapp'
const env = { KURKOOS_FINANCE_HOOK_URL: URL_, KURKOOS_FINANCE_HOOK_TOKEN: 'secret-token-123' }
const raw = '{"typeWebhook":"incomingMessageReceived",  "idMessage":"A1","messageData":{"typeMessage":"imageMessage"}}'
const spy = (answer = { ok: true, status: 200 }) => {
  const calls = []
  const fetchImpl = async (url, init) => { calls.push({ url, init }); if (answer instanceof Error) throw answer; return answer }
  return { calls, fetchImpl }
}

test('the same body goes to the finance system with the bearer token', async () => {
  const { calls, fetchImpl } = spy()
  const out = await forwardGreenHook(raw, { env, fetchImpl, log: () => {} })
  assert.deepEqual(out, { ok: true, status: 200 })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, URL_)
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.body, raw)                       // byte for byte, not re-serialised
  assert.equal(calls[0].init.headers['Content-Type'], 'application/json')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token-123')
  assert.ok(!calls[0].url.includes('secret-token-123'))
  assert.ok(calls[0].init.signal instanceof AbortSignal)
})

test('nothing is sent when a variable is missing, the address is not https, or there is no body', async () => {
  for (const e of [{}, { KURKOOS_FINANCE_HOOK_URL: URL_ }, { KURKOOS_FINANCE_HOOK_TOKEN: 't' }, { ...env, KURKOOS_FINANCE_HOOK_TOKEN: '  ' },
    { ...env, KURKOOS_FINANCE_HOOK_URL: 'http://www.kurkoos-group.co.il/api/finance-whatsapp' }, { ...env, KURKOOS_FINANCE_HOOK_URL: 'not a url' },
    { ...env, KURKOOS_FINANCE_HOOK_URL: 'https://user:pass@example.com/x' }]) {
    const { calls, fetchImpl } = spy()
    assert.equal(forwardTarget(e), null)
    assert.deepEqual(await forwardGreenHook(raw, { env: e, fetchImpl }), { ok: false, skipped: true })
    assert.equal(calls.length, 0)
  }
  const { calls, fetchImpl } = spy()
  assert.deepEqual(await forwardGreenHook('', { env, fetchImpl }), { ok: false, skipped: true })
  assert.equal(calls.length, 0)
})

test('a rejected fetch, a timeout and an error answer never throw, and the log has no token', async () => {
  const logged = []
  const log = (...a) => logged.push(a.join(' '))
  const rejected = await forwardGreenHook(raw, { env, fetchImpl: spy(new Error('connect ECONNREFUSED secret-token-123')).fetchImpl, log })
  assert.equal(rejected.ok, false); assert.match(rejected.error, /ECONNREFUSED/)
  const bad = await forwardGreenHook(raw, { env, fetchImpl: spy({ ok: false, status: 401 }).fetchImpl, log })
  assert.deepEqual(bad, { ok: false, status: 401 })
  const alive = setTimeout(() => {}, 5000)   // AbortSignal.timeout's own timer does not keep the process alive
  const slow = await forwardGreenHook(raw, { env, timeoutMs: 20, log, fetchImpl: (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(init.signal.reason))) })
  clearTimeout(alive)
  assert.deepEqual(slow, { ok: false, error: 'timeout' })
  assert.equal(logged.length, 3)
  assert.ok(logged.every(l => l.startsWith('[green-hook] forward') && !l.includes('secret-token-123')))
})
