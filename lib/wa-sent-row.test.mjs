import test from 'node:test'
import assert from 'node:assert/strict'
import { sentRow } from './automations.js'

const now = new Date('2026-11-04T10:00:00Z')
test('a text the server sent is a row at once (the webhook merges the rest)', () => {
  assert.deepEqual(sentRow({ id: 'ABC', phone: '972501234567', message: 'היי', now }), {
    id: 'ABC', phone: '972501234567', direction: 'out', type: 'textMessage', body: 'היי', file_url: null, file_name: null,
    quoted: null, status: 'sent', by_api: true, ts: '2026-11-04T10:00:00.000Z',
  })
})
test('files keep their kind, name and caption; a reply keeps the quoted id', () => {
  const pic = sentRow({ id: 'A', phone: '972501234567', message: 'כיתוב', file: 'https://x.supabase.co/s/a.JPG?x=1', fileName: 'תמונה.jpg', now })
  assert.equal(pic.type, 'imageMessage'); assert.equal(pic.file_name, 'תמונה.jpg'); assert.equal(pic.body, 'כיתוב')
  assert.equal(sentRow({ id: 'A', phone: '972501234567', file: 'https://x/v.mp4', now }).type, 'videoMessage')
  assert.equal(sentRow({ id: 'A', phone: '972501234567', file: 'https://x/p.pdf', now }).type, 'documentMessage')
  assert.equal(sentRow({ id: 'A', phone: '972501234567', file: 'https://x/a.ogg', now }).body, null)
  assert.deepEqual(sentRow({ id: 'A', phone: '972501234567', message: 'כן', quotedMessageId: 'Q1', now }).quoted, { id: 'Q1', text: '' })
})
test('no id or a bad number → nothing is stored', () => {
  assert.equal(sentRow({ phone: '972501234567', message: 'x' }), null)
  assert.equal(sentRow({ id: 'A', phone: '05-1', message: 'x' }), null)
})
