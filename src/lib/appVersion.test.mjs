import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOf, canReload, reloadOnce, busyNow, runningBuild } from './appVersion.js'

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } }

test('buildOf / runningBuild: the main script names the build', () => {
  assert.equal(buildOf('<script type="module" crossorigin src="/assets/index-DiqGk801.js"></script><link href="/assets/vendor-react-CeB-a8uN.js">'), '/assets/index-DiqGk801.js')
  assert.equal(buildOf('<html>no build</html>'), '')
  assert.equal(buildOf(null), '')
  const doc = { querySelectorAll: () => [{ getAttribute: () => '/assets/vendor-x.js' }, { getAttribute: () => 'https://x.co/assets/index-Ab_9.js' }] }
  assert.equal(runningBuild(doc), '/assets/index-Ab_9.js')
  assert.equal(runningBuild({ querySelectorAll: () => [] }), '')
})

test('reloadOnce: at most once a minute, never a loop', () => {
  const store = mem(); let n = 0; const loc = { reload: () => n++ }
  assert.ok(canReload(1000, store))
  assert.equal(reloadOnce('chunk', 1000, store, loc), true)
  assert.equal(n, 1)
  assert.equal(reloadOnce('chunk', 30e3, store, loc), false, 'again within a minute → no')
  assert.equal(n, 1)
  assert.equal(reloadOnce('chunk', 62e3, store, loc), true, 'after a minute → yes (a second stale screen the same day)')
  assert.equal(n, 2)
  assert.equal(store.getItem('afik_reload_why'), 'chunk')
  assert.equal(reloadOnce('x', 1, null, null), true, 'no storage → still reloads')
})

test('busyNow: typing or an open window waits', () => {
  const doc = (tag, dialog = false) => ({ activeElement: tag ? { tagName: tag } : null, querySelector: () => (dialog ? {} : null) })
  assert.equal(busyNow(doc('INPUT')), true)
  assert.equal(busyNow(doc('TEXTAREA')), true)
  assert.equal(busyNow(doc('BUTTON')), false)
  assert.equal(busyNow(doc('BODY', true)), true)
  assert.equal(busyNow(doc(null)), false)
})
