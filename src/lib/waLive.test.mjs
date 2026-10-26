import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeLive, tail9, foldReactions } from './waMerge.js'

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

test('reactions sit on the message they react to, one per side, the newest wins', () => {
  const at = s => new Date(Date.UTC(2026, 9, 26, 10, 0, s)).toISOString()
  const msgs = [
    { id: 'A', kind: 'textMessage', direction: 'out', message: 'שלום', created_at: at(0) },
    { id: 'B', kind: 'textMessage', direction: 'in', message: 'היי', created_at: at(1) },
    { id: 'R1', kind: 'reactionMessage', direction: 'in', message: '👍', reactedTo: 'A', created_at: at(2) },
    { id: 'R2', kind: 'reactionMessage', direction: 'in', message: '🙏', reactedTo: 'A', created_at: at(3) },
    { id: 'R3', kind: 'reactionMessage', direction: 'out', message: '❤️', reactedTo: 'A', created_at: at(4) },
    { id: 'R4', kind: 'reactionMessage', direction: 'out', message: '😂', reactedTo: 'B', created_at: at(5) },
    { id: 'R5', kind: 'reactionMessage', direction: 'out', message: '', reactedTo: 'B', created_at: at(6) },      // taken back
    { id: 'R6', kind: 'reactionMessage', direction: 'in', message: '🔥', reactedTo: 'old', created_at: at(7) },   // not in the list
  ]
  const out = foldReactions(msgs)
  assert.deepEqual(out.map(m => m.id), ['A', 'B', 'R6'])
  assert.deepEqual(out[0].reactions.map(r => r.emoji), ['🙏', '❤️'])
  assert.equal(out[1].reactions, undefined)
  assert.equal(out[2].orphan, true)
  const plain = [{ id: 'x', kind: 'textMessage' }]
  assert.equal(foldReactions(plain), plain)
})
