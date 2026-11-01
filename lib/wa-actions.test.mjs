import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanMsgId, cleanReaction, forwardRequest, quoteFields, FORWARD_MAX_TO } from './wa-actions.js'

test('message ids', () => {
  assert.equal(cleanMsgId('BAE5F4886AD46F2C'), 'BAE5F4886AD46F2C')
  assert.equal(cleanMsgId('false_972501234567@c.us_3EB0ABC'), 'false_972501234567@c.us_3EB0ABC')
  assert.equal(cleanMsgId('opt-123-abc'), '')
  assert.equal(cleanMsgId('a b'), '')
  assert.equal(cleanMsgId(''), '')
  assert.deepEqual(quoteFields('BAE5F4886AD46F2C'), { quotedMessageId: 'BAE5F4886AD46F2C' })
  assert.deepEqual(quoteFields(undefined), {})
})

test('reactions: one emoji, or empty to take it back', () => {
  assert.equal(cleanReaction('👍'), '👍')
  assert.equal(cleanReaction('❤️'), '❤️')
  assert.equal(cleanReaction('👍🏽'), '👍🏽')
  assert.equal(cleanReaction(''), '')
  assert.equal(cleanReaction('hi'), null)
  assert.equal(cleanReaction('<b>'), null)
  assert.equal(cleanReaction('1'), null)
})

test('forward: source chat, recipients and ids are checked', () => {
  const norm = x => { const d = String(x || '').replace(/\D/g, ''); return d.startsWith('0') ? '972' + d.slice(1) : d }
  assert.deepEqual(forwardRequest({ from: '0501234567', to: ['052-111-2222', '0521112222', '0501234567'], ids: ['AAAA1', 'AAAA1', 'BBBB2'] }, norm),
    { from: '972501234567', to: ['972521112222'], ids: ['AAAA1', 'BBBB2'] })
  assert.ok(forwardRequest({ from: '0501234567', to: [], ids: ['AAAA1'] }, norm).error)
  assert.ok(forwardRequest({ from: '0501234567', to: ['0521112222'], ids: [] }, norm).error)
  assert.ok(forwardRequest({ to: ['0521112222'], ids: ['AAAA1'] }, norm).error)
  const many = Array.from({ length: FORWARD_MAX_TO + 1 }, (_, i) => `05211122${String(i).padStart(2, '0')}`)
  assert.ok(forwardRequest({ from: '0501234567', to: many, ids: ['AAAA1'] }, norm).error)
})

test('handled chats leave "waiting" until the lead writes again', async () => {
  const { isHandled, withHandled, withoutHandled } = await import('./wa-actions.js')
  const now = Date.parse('2026-11-01T12:00:00Z')
  let done = withHandled({ 111111111: now - 70 * 864e5 }, [{ phone: '0501234567', ts: '2026-11-01T10:00:00Z' }], now)
  assert.deepEqual(Object.keys(done), ['501234567'])
  assert.equal(isHandled(done, '972501234567', '2026-11-01T10:00:00Z'), true)
  assert.equal(isHandled(done, '972501234567', '2026-11-01T10:05:00Z'), false)
  assert.equal(isHandled(done, '0529999999', '2026-11-01T10:00:00Z'), false)
  done = withHandled(done, [{ phone: '0501234567', ts: '2026-11-01T09:00:00Z' }], now)
  assert.equal(done['501234567'], Date.parse('2026-11-01T10:00:00Z'))
  assert.deepEqual(withoutHandled(done, ['+972-50-123-4567']), {})
})
