import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// the old password is read from git history-free source: the test only knows it through the legacy check
const OLD = process.env.TEST_LEGACY_PASSWORD || ''
process.env.SUPABASE_SERVICE_KEY = 'service-key-for-tests-0123456789'
const A = await import('./admin-auth.js')
const { createHash } = await import('node:crypto')
if (OLD) A.__setLegacyHashForTests(createHash('sha256').update(OLD).digest('hex'))

test('no password, no token', async () => {
  assert.equal(await A.passwordOk(''), false)
  assert.equal(A.adminKeyOk(''), false)
  assert.equal(A.adminKeyOk('anything'), false)
})
test('a session works, a tampered or expired one does not', () => {
  const s = A.makeSession('admin')
  assert.ok(A.sessionOk(s) && A.adminKeyOk(s))
  assert.equal(A.sessionOk(s.slice(0, -2) + (s.endsWith('A') ? 'BB' : 'AA')), false)
  const old = A.makeSession('admin', -1)
  assert.equal(A.sessionOk(old), false)
})
test('the internal token works for the site itself', () => {
  assert.ok(A.adminKeyOk(A.internalToken()))
})
test('ADMIN_PASSWORD set: only it logs in; ADMIN_TOKEN from the env still works for servers', async () => {
  process.env.ADMIN_PASSWORD = 'new-long-password-xyz'
  process.env.ADMIN_TOKEN = 'server-token-abcdefghijklmnop'
  assert.equal(A.setupMode(), false)
  assert.ok(await A.passwordOk('new-long-password-xyz'))
  assert.equal(await A.passwordOk('wrong'), false)
  assert.ok(A.adminKeyOk('server-token-abcdefghijklmnop'))
  delete process.env.ADMIN_PASSWORD; delete process.env.ADMIN_TOKEN
})
test('the old password: accepted only before ADMIN_PASSWORD is set', { skip: !OLD }, async () => {
  assert.ok((await A.passwordOk(OLD)) && A.adminKeyOk(OLD))
  process.env.ADMIN_PASSWORD = 'new-long-password-xyz'
  assert.equal(await A.passwordOk(OLD), false)
  assert.equal(A.adminKeyOk(OLD), false)
  process.env.ADMIN_TOKEN = OLD   // even when someone left it as the server token
  assert.equal(A.adminKeyOk(OLD), false)
  delete process.env.ADMIN_PASSWORD; delete process.env.ADMIN_TOKEN
})
test('no admin file in src/ carries the old password', { skip: !OLD }, async () => {
  const { execSync } = await import('node:child_process')
  const hits = execSync(`grep -rlF -- "${OLD}" src || true`, { encoding: 'utf8' }).trim()
  assert.equal(hits, '')
})
test('no form of the old password in the code', () => {
  assert.ok(!/[0-9a-f]{64}/.test(readFileSync(new URL('./admin-auth.js', import.meta.url), 'utf8')))
})
