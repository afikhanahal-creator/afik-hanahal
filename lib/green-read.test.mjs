import test from 'node:test'
import assert from 'node:assert/strict'
import { greenReadKey } from './green-read.js'

const U = m => `https://7105.api.greenapi.com/waInstance7105000000/${m}/tok123`
test('reads are shared by method, query and body', () => {
  assert.deepEqual(greenReadKey(U('getStateInstance')), { method: 'getStateInstance', key: 'getStateInstance|' })
  assert.equal(greenReadKey(U('lastIncomingMessages') + '?minutes=1440').key, 'lastIncomingMessages?minutes=1440|')
  const a = greenReadKey(U('getChatHistory'), { method: 'POST', body: '{"chatId":"972501@c.us","count":100}' })
  const b = greenReadKey(U('getChatHistory'), { method: 'POST', body: '{"chatId":"972502@c.us","count":100}' })
  assert.notEqual(a.key, b.key)
})
test('sends, settings and forwards are never shared', () => {
  for (const m of ['sendMessage', 'sendFileByUrl', 'setSettings', 'forwardMessages', 'readChat', 'sendReaction']) assert.equal(greenReadKey(U(m), { method: 'POST', body: '{}' }), null)
  assert.equal(greenReadKey('https://example.com/x'), null)
})
