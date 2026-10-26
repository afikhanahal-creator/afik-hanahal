import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGreenHook, rowToGreen, mergeHistory, historyToRow } from './green-hook.js'

const base = { instanceData: { idInstance: 1 }, timestamp: 1761382800 }

test('an incoming text, a picture we sent and a status become rows', () => {
  const inc = parseGreenHook({ ...base, typeWebhook: 'incomingMessageReceived', idMessage: 'A1', senderData: { chatId: '972586622442@c.us', senderName: 'Dana' }, messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'כן, נשמח לשיחה' } } })
  assert.equal(inc.kind, 'message')
  assert.deepEqual({ id: inc.row.id, phone: inc.row.phone, dir: inc.row.direction, body: inc.row.body, who: inc.row.sender_name }, { id: 'A1', phone: '972586622442', dir: 'in', body: 'כן, נשמח לשיחה', who: 'Dana' })
  assert.equal(inc.row.ts, new Date(1761382800 * 1000).toISOString())
  const pic = parseGreenHook({ ...base, typeWebhook: 'outgoingAPIMessageReceived', idMessage: 'B2', senderData: { chatId: '972586622442@c.us' }, messageData: { typeMessage: 'imageMessage', fileMessageData: { downloadUrl: 'https://x/y.jpg', caption: 'היי דנה', fileName: 'y.jpg', mimeType: 'image/jpeg' } } })
  assert.deepEqual({ dir: pic.row.direction, type: pic.row.type, body: pic.row.body, url: pic.row.file_url, api: pic.row.by_api, st: pic.row.status }, { dir: 'out', type: 'imageMessage', body: 'היי דנה', url: 'https://x/y.jpg', api: true, st: 'sent' })
  const ext = parseGreenHook({ ...base, typeWebhook: 'incomingMessageReceived', idMessage: 'C3', senderData: { chatId: '972586622442@c.us' }, messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'https://link', quotedMessage: { stanzaId: 'B2', caption: 'היי דנה' } } } })
  assert.equal(ext.row.body, 'https://link'); assert.equal(ext.row.quoted.text, 'היי דנה')
  assert.deepEqual(parseGreenHook({ ...base, typeWebhook: 'outgoingMessageStatus', idMessage: 'B2', chatId: '972586622442@c.us', status: 'read' }), { kind: 'status', id: 'B2', status: 'read', phone: '972586622442' })
})

test('groups, calls and junk are ignored', () => {
  assert.equal(parseGreenHook({ ...base, typeWebhook: 'incomingMessageReceived', idMessage: 'G', senderData: { chatId: '120363@g.us' }, messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'x' } } }).kind, 'ignore')
  assert.equal(parseGreenHook({ typeWebhook: 'incomingCall' }).kind, 'ignore')
  assert.equal(parseGreenHook(null).kind, 'ignore')
  assert.deepEqual(parseGreenHook({ typeWebhook: 'stateInstanceChanged', stateInstance: 'authorized' }), { kind: 'state', state: 'authorized' })
})

test('stored rows join Green\'s history once, in order, with the furthest status', () => {
  const green = [{ idMessage: 'B2', type: 'outgoing', typeMessage: 'imageMessage', caption: 'היי', timestamp: 100, statusMessage: 'sent' }]
  const stored = [
    { id: 'B2', phone: '9725', direction: 'out', type: 'imageMessage', body: 'היי', file_url: 'https://x', status: 'read', ts: new Date(100e3).toISOString() },
    { id: 'A1', phone: '9725', direction: 'in', type: 'textMessage', body: 'כן', ts: new Date(160e3).toISOString() },
  ]
  const out = mergeHistory(green, stored)
  assert.deepEqual(out.map(m => [m.idMessage, m.type, m.statusMessage || '']), [['B2', 'outgoing', 'read'], ['A1', 'incoming', '']])
  assert.equal(rowToGreen(stored[1]).textMessage, 'כן')
})

test('Green history messages become rows that read back the same (the backfill)', () => {
  const inText = { idMessage: 'A1', type: 'incoming', typeMessage: 'textMessage', textMessage: 'היי', timestamp: 1761400000, senderName: 'רונן' }
  const outPic = { idMessage: 'B2', type: 'outgoing', typeMessage: 'imageMessage', caption: 'תוכניות', downloadUrl: 'https://x/y.jpg', fileName: 'y.jpg', mimeType: 'image/jpeg', timestamp: 1761400060, statusMessage: 'read', sendByApi: true }
  const react = { idMessage: 'C3', type: 'incoming', typeMessage: 'reactionMessage', extendedTextMessage: { text: '🙏' }, quotedMessage: { stanzaId: 'B2' }, timestamp: 1761400100 }
  const a = historyToRow(inText, '972501234567'), b = historyToRow(outPic, '972501234567'), c = historyToRow(react, '972501234567')
  assert.equal(a.direction, 'in'); assert.equal(a.body, 'היי'); assert.equal(a.sender_name, 'רונן'); assert.equal(a.status, null)
  assert.equal(b.direction, 'out'); assert.equal(b.status, 'read'); assert.equal(b.by_api, true); assert.equal(b.file_url, 'https://x/y.jpg')
  assert.equal(c.body, '🙏'); assert.deepEqual(c.quoted, { id: 'B2', text: '' })
  assert.equal(rowToGreen(c).reactedTo, 'B2')
  assert.equal(rowToGreen(b).caption, 'תוכניות')
  assert.equal(rowToGreen(a).timestamp, 1761400000)
  assert.equal(historyToRow({ idMessage: 'x', timestamp: 0 }, '972501234567'), null)
  assert.equal(historyToRow(inText, 'abc'), null)
})
