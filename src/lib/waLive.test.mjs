import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeLive, tail9 } from './waMerge.js'

const norm = r => ({ id: r.idMessage, direction: r.type === 'incoming' ? 'in' : 'out', message: r.textMessage || '', status: r.statusMessage || 'read', created_at: new Date(r.timestamp * 1000).toISOString() })

test('a live reply joins the chat once; a status only moves forward', () => {
  const list = [norm({ idMessage: 'B2', type: 'outgoing', textMessage: 'היי', statusMessage: 'sent', timestamp: 100 })]
  const a = mergeLive(list, [{ idMessage: 'A1', type: 'incoming', textMessage: 'כן', timestamp: 160 }], norm)
  assert.deepEqual(a.map(m => m.id), ['B2', 'A1'])
  assert.equal(mergeLive(a, [{ idMessage: 'A1', type: 'incoming', textMessage: 'כן', timestamp: 160 }], norm), a)   // nothing new → same list
  const b = mergeLive(a, [{ idMessage: 'B2', type: 'outgoing', statusMessage: 'read', timestamp: 100 }], norm)
  assert.equal(b[0].status, 'read')
  assert.equal(mergeLive(b, [{ idMessage: 'B2', type: 'outgoing', statusMessage: 'delivered', timestamp: 100 }], norm)[0].status, 'read')
  assert.equal(tail9('+972-58-662-2442'), '586622442')
})
