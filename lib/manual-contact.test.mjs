// The office's rule (2026-11-06): automatic messages only to a lead who got nothing from us — once a person wrote to them
// (on the office phone, from the panel, a bulk send) the automations send nothing more.
import test from 'node:test'
import assert from 'node:assert/strict'
import { manualContact, AUTO_MATCH_MS } from './automations-shared.js'

const T = Date.parse('2026-11-06T10:00:00Z')
const iso = ms => new Date(ms).toISOString()

test('a lead nobody wrote to is not manual', () => {
  assert.equal(manualContact({}).manual, false)
  assert.equal(manualContact({ auto: { sent: {} } }).manual, false)
})
test('a message written on the office phone stops the automations', () => {
  const r = manualContact({ lastOut: T, lastPhoneOut: T })
  assert.deepEqual([r.manual, r.why, r.at], [true, 'phone', T])
})
test('a send from the panel (stamped manualAt) stops them, even right after the automatic welcome', () => {
  const r = manualContact({ auto: { sent: { welcome: iso(T) }, manualAt: iso(T + 60e3) }, lastOut: T + 60e3 })
  assert.deepEqual([r.manual, r.why], [true, 'panel'])
})
test('a send logged by a person (manual / bulk) counts', () => {
  assert.equal(manualContact({ auto: { log: [{ at: iso(T), ok: true, by: 'manual', ruleKey: 'welcome' }] } }).why, 'manual')
  assert.equal(manualContact({ auto: { log: [{ at: iso(T), ok: true, by: 'bulk', ruleKey: 'tpl:x' }] } }).why, 'bulk')
  // a failed manual send is not contact
  assert.equal(manualContact({ auto: { log: [{ at: iso(T), ok: false, by: 'manual' }] } }).manual, false)
})
test('our own automatic message in the chat is not manual contact', () => {
  const auto = { sent: { welcome: iso(T) }, log: [{ at: iso(T), ok: true, by: 'auto', ruleKey: 'welcome' }] }
  assert.equal(manualContact({ auto, lastOut: T + 20e3 }).manual, false)
  assert.equal(manualContact({ auto, lastOut: T + AUTO_MATCH_MS }).manual, false)
  assert.equal(manualContact({ auto: { sent: { 'noreply:1': iso(T + 864e5) } }, lastOut: T + 864e5 - 5e3 }).manual, false)
})
test('a message in the chat that no automatic send explains is a person', () => {
  const auto = { sent: { welcome: iso(T) } }
  const r = manualContact({ auto, lastOut: T + 2 * 3600e3 })
  assert.deepEqual([r.manual, r.why, r.at], [true, 'chat', T + 2 * 3600e3])
  // a brand-new lead whose number we already wrote to
  assert.equal(manualContact({ lastOut: T }).manual, true)
})
