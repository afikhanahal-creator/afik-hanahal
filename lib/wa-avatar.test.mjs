import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avatarExpiry, avatarFresh, avatarPhone, socialAvatarFresh, socialKey, avatarKey, leadSocialKey, pickFace, profileLinkOf } from './wa-avatar.js'

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

test('avatarExpiry reads Messenger\'s ext parameter too', () => {
  const s = Math.floor(Date.parse('2026-12-01T00:00:00Z') / 1000)
  assert.equal(avatarExpiry(`https://platform-lookaside.fbsbx.com/platform/profilepic/?psid=1&width=1024&ext=${s}&hash=abc`), s * 1000)
})

test('socialAvatarFresh: a Meta picture link until an hour before it expires', () => {
  const now = Date.parse('2026-10-25T10:00:00Z')
  const at = h => Math.floor((now + h * 3600e3) / 1000)
  assert.equal(socialAvatarFresh(`https://platform-lookaside.fbsbx.com/p/?psid=1&ext=${at(48)}`, now), true)
  assert.equal(socialAvatarFresh(`https://platform-lookaside.fbsbx.com/p/?psid=1&ext=${at(0.5)}`, now), false)
  assert.equal(socialAvatarFresh('https://scontent.cdninstagram.com/a.jpg', now), true)
  assert.equal(socialAvatarFresh('', now), false)
  assert.equal(socialAvatarFresh('http://x/a.jpg', now), false)
})

test('face keys: a number or a thread id; the thread of a lead; WhatsApp wins', () => {
  assert.equal(socialKey('messenger:591701444021114:9003'), 'messenger:591701444021114:9003')
  assert.equal(socialKey('whatsapp:1:2'), '')
  assert.equal(avatarKey('050-123-4567'), '972501234567')
  assert.equal(avatarKey('instagram:17841400000:123456'), 'instagram:17841400000:123456')
  assert.equal(leadSocialKey({ crm_data: { social: { platform: 'instagram', threadId: 'instagram:1784:1234' } } }), 'instagram:1784:1234')
  assert.equal(leadSocialKey({ crm_data: {} }), '')
  assert.deepEqual(pickFace({ url: 'wa.jpg' }, { url: 'fb.jpg', src: 'messenger' }), { url: 'wa.jpg', src: 'whatsapp', link: '' })
  assert.deepEqual(pickFace({ url: 'fb.jpg', src: 'messenger' }, null), { url: 'fb.jpg', src: 'messenger', link: '' })
  assert.deepEqual(pickFace({ url: '' }, { url: 'ig.jpg', src: 'instagram', link: 'https://www.instagram.com/yossi/' }), { url: 'ig.jpg', src: 'instagram', link: 'https://www.instagram.com/yossi/' })
  assert.deepEqual(pickFace(null, null), { url: '', src: '', link: '' })
  assert.equal(profileLinkOf('instagram', { username: '@yossi.k' }), 'https://www.instagram.com/yossi.k/')
  assert.equal(profileLinkOf('messenger', { username: 'x' }), '')
})
