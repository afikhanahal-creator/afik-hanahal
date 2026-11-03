import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeState, isDriveState, stateValid, multipartBody, authUrl, FOLDER_MIME } from './google-drive.js'
import { makeState as calState, stateValid as calValid } from './google-calendar.js'
import { encryptToken, decryptToken, tokenHash } from './documents-hash.js'

test('the Drive OAuth state is told apart from the calendar\'s on the shared callback, and expires', () => {
  const now = Date.now()
  const d = makeState(now), c = calState(now)
  assert.ok(isDriveState(d) && !isDriveState(c))
  assert.ok(stateValid(d, now + 1000) && !calValid(d, now + 1000), 'the calendar never accepts a Drive state')
  assert.ok(calValid(c, now + 1000) && !stateValid(c, now + 1000))
  assert.equal(stateValid(d, now + 21 * 60e3), false, '20 minutes')
  assert.equal(stateValid(d.replace(/.$/, 'x'), now), false, 'a changed signature')
  const u = new URL(authUrl())
  assert.ok(u.searchParams.get('scope').includes('drive.file') && !u.searchParams.get('scope').includes('calendar'), 'only drive.file — the app sees nothing else in the Drive')
  assert.ok(isDriveState(u.searchParams.get('state')))
})

test('multipart upload body: JSON metadata then the bytes, closed by the boundary', () => {
  const { body, type } = multipartBody({ name: 'a.pdf', parents: ['p1'] }, Buffer.from('%PDF-1.7'), 'application/pdf', 'bb')
  assert.equal(type, 'multipart/related; boundary=bb')
  const s = body.toString()
  assert.ok(s.startsWith('--bb\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"a.pdf","parents":["p1"]}\r\n--bb\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.7\r\n--bb--'))
  assert.equal(FOLDER_MIME, 'application/vnd.google-apps.folder')
})

test('the signing token is kept encrypted (same link again for a reminder) while the lookup stays by hash', () => {
  const tok = 'abcdefghijklmnopqrstuvwxyz123456'
  const enc = encryptToken(tok)
  assert.ok(enc.startsWith('v1.') && !enc.includes(tok))
  assert.equal(decryptToken(enc), tok)
  assert.notEqual(encryptToken(tok), enc, 'a fresh IV every time')
  assert.equal(decryptToken(enc.slice(0, -2) + 'zz'), '', 'a tampered record decrypts to nothing')
  assert.equal(decryptToken(''), '')
  assert.equal(tokenHash(tok).length, 64)
})
