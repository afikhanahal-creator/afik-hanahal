import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avatarExpiry, avatarFresh, avatarPhone } from './wa-avatar.js'

test('avatarExpiry reads WhatsApp\'s oe parameter', () => {
  const s = Math.floor(Date.parse('2026-11-01T00:00:00Z') / 1000)
  assert.equal(avatarExpiry(`https://pps.whatsapp.net/v/t61/x.jpg?ccb=11&oh=01&oe=${s.toString(16).toUpperCase()}&_nc_sid=5e`), s * 1000)
  const now = Date.parse('2026-10-25T10:00:00Z')
  assert.equal(avatarExpiry('https://example.com/a.jpg', now), now + 864e5)
  assert.equal(avatarExpiry('not a url', now), now + 864e5)
})

test('avatarFresh: a picture until its link is about to expire, "none" for a day', () => {
  const now = Date.parse('2026-10-25T10:00:00Z')
  const ago = h => new Date(now - h * 3600e3).toISOString()
  const at = h => new Date(now + h * 3600e3).toISOString()
  assert.equal(avatarFresh({ url: 'u', expires_at: at(48), checked_at: ago(2) }, now), true)
  assert.equal(avatarFresh({ url: 'u', expires_at: at(0.5), checked_at: ago(2) }, now), false)
  assert.equal(avatarFresh({ url: 'u', expires_at: at(400), checked_at: ago(80) }, now), false)
  assert.equal(avatarFresh({ url: null, checked_at: ago(5) }, now), true)
  assert.equal(avatarFresh({ url: null, checked_at: ago(30) }, now), false)
  assert.equal(avatarFresh(null, now), false)
})

test('avatarPhone normalizes any Israeli way of writing the number', () => {
  assert.equal(avatarPhone('050-123-4567'), '972501234567')
  assert.equal(avatarPhone('+972 50 123 4567'), '972501234567')
  assert.equal(avatarPhone('972501234567@c.us'), '972501234567')
  assert.equal(avatarPhone('abc'), '')
})
