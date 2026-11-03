import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSocialHook, threadId, parseThreadId, contactFromText, previewText, leadBodyFromThread } from './social-hook.js'
import { manualLeadRow } from './manual-lead.js'

test('Messenger and Instagram deliveries: who, which way, the text; echoes are ours; reads are left out', () => {
  const page = { object: 'page', entry: [{ id: '1111', messaging: [
    { sender: { id: '9001' }, recipient: { id: '1111' }, timestamp: 1_800_000_000_000, message: { mid: 'm1', text: 'היי, אפשר פרטים על זרובבל 15?' } },
    { sender: { id: '1111' }, recipient: { id: '9001' }, timestamp: 1_800_000_060_000, message: { mid: 'm2', text: 'בטח', is_echo: true } },
    { sender: { id: '9001' }, recipient: { id: '1111' }, timestamp: 1_800_000_070_000, read: { watermark: 1 } },
    { sender: { id: '9001' }, recipient: { id: '1111' }, timestamp: 1_800_000_080_000, message: { mid: 'm3', attachments: [{ type: 'image', payload: { url: 'https://x/y.jpg' } }] } },
  ] }] }
  const ev = parseSocialHook(page)
  assert.equal(ev.length, 3)
  assert.deepEqual(ev.map(e => [e.platform, e.accountId, e.userId, e.direction, e.mid]), [['messenger', '1111', '9001', 'in', 'm1'], ['messenger', '1111', '9001', 'out', 'm2'], ['messenger', '1111', '9001', 'in', 'm3']])
  assert.equal(ev[2].attachments[0].type, 'image')
  const ig = parseSocialHook({ object: 'instagram', entry: [{ id: '1784', messaging: [{ sender: { id: '5550' }, recipient: { id: '1784' }, timestamp: 1, message: { mid: 'ig1', text: 'מחיר?' } }] }] })
  assert.deepEqual([ig[0].platform, ig[0].accountId, ig[0].userId], ['instagram', '1784', '5550'])
  assert.deepEqual(parseSocialHook({ object: 'page', entry: [{ id: '1', changes: [{ field: 'leadgen' }] }] }), [])
  assert.deepEqual(parseSocialHook({ object: 'user' }), [])
})

test('thread ids, a phone / email written in the chat, previews', () => {
  assert.equal(threadId('instagram', '1784', '5550'), 'instagram:1784:5550')
  assert.deepEqual(parseThreadId('messenger:1111:9001'), { platform: 'messenger', accountId: '1111', userId: '9001' })
  assert.equal(parseThreadId('x:1:2'), null)
  assert.deepEqual(contactFromText('תתקשרו אליי 052-123-4567 בבקשה'), { phone: '0521234567', email: '' })
  assert.deepEqual(contactFromText('+972 54 765 4321, dana@Mail.com'), { phone: '0547654321', email: 'dana@mail.com' })
  assert.deepEqual(contactFromText('3-4 מיליון, 2 חדרים'), { phone: '', email: '' })
  assert.equal(previewText({ text: '', attachments: [{ type: 'image' }] }), '📷 תמונה')
})

test('a conversation becomes a lead, even before a phone was written', () => {
  const th = { id: 'instagram:1784:5550', platform: 'instagram', account_id: '1784', user_id: '5550', name: 'Dana Levi', username: 'dana.l', phone: '' }
  const body = leadBodyFromThread(th, { projectId: 'p_zr15', projectName: 'זרובבל 15' })
  const r = manualLeadRow(body, 'דנה לוי', 1_800_000_000_000)
  assert.equal(r.error, undefined)
  assert.equal(r.row.source, 'instagram'); assert.equal(r.row.name, 'דנה לוי')
  assert.equal(r.row.crm_data.social.threadId, 'instagram:1784:5550'); assert.equal(r.row.crm_data.origin.channel, 'instagram')
  assert.equal(r.row.crm_data.origin.detail, '@dana.l'); assert.equal(r.row.crm_data.projectId, 'p_zr15'); assert.equal(r.row.crm_data.leadStatus, 'contacted')
  // a made-up thread id doesn't skip the phone / email rule
  assert.ok(manualLeadRow({ name: 'x', social: { platform: 'instagram', threadId: 'bad' } }).error)
})
