import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSocialHook, threadId, parseThreadId, contactFromText, previewText, leadBodyFromThread, cleanSocialPages, inboxPageIds, accountLabels, conversationEvents, threadRowFrom, importJobs } from './social-hook.js'
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

test('several pages in one inbox: the leads pages always, then every page switched on; labels per account', () => {
  const stored = [{ id: '2222', name: 'קבוצת קורקוס', on: true, ig: { id: '17841', username: 'korkos' } }, { id: '3333', name: 'reeco', on: false }, { id: 'bad' }, { id: '2222', name: 'dup' }]
  assert.deepEqual(cleanSocialPages(stored).map(p => p.id), ['2222', '3333'])
  assert.deepEqual(inboxPageIds(['1111'], stored), ['1111', '2222'])
  assert.deepEqual(inboxPageIds(['2222'], stored), ['2222'])
  const l = accountLabels(stored)
  assert.equal(l['2222'].name, 'קבוצת קורקוס'); assert.equal(l['17841'].name, '@korkos'); assert.equal(l['17841'].platform, 'instagram')
  assert.deepEqual(importJobs(cleanSocialPages(stored)).map(j => `${j.platform}:${j.accountId}`), ['messenger:2222', 'instagram:17841', 'messenger:3333'])
})

test('an imported conversation: the person, our messages vs theirs, oldest first', () => {
  const c = { participants: { data: [{ id: '1111', name: 'אפיק הנחל' }, { id: '9001', name: 'Dana Levi' }] }, messages: { data: [
    { id: 'm2', message: 'בטח', from: { id: '1111' }, created_time: '2026-11-01T10:05:00+0000' },
    { id: 'm1', message: 'מה המחיר? 052-1234567', from: { id: '9001' }, created_time: '2026-11-01T10:00:00+0000' },
  ] } }
  const r = conversationEvents(c, { platform: 'messenger', accountId: '1111', pageId: '1111' })
  assert.equal(r.person.name, 'Dana Levi')
  assert.deepEqual(r.events.map(e => `${e.mid}:${e.direction}`), ['m1:in', 'm2:out'])
  assert.equal(conversationEvents({ participants: { data: [{ id: '1111' }] } }, { platform: 'messenger', accountId: '1111', pageId: '1111' }), null)
  // Instagram: the IG account is "us", the page id too
  const ig = conversationEvents({ participants: { data: [{ id: '178', username: 'afik.hanahal' }, { id: '555', username: 'dana' }] }, messages: { data: [{ id: 'x', message: 'hi', from: { id: '555' }, created_time: '2026-11-01T10:00:00Z' }] } }, { platform: 'instagram', accountId: '178', pageId: '1111' })
  assert.equal(ig.person.username, 'dana'); assert.equal(ig.events[0].direction, 'in')

  const row = threadRowFrom({ events: r.events, platform: 'messenger', accountId: '1111', userId: '9001', prof: { name: 'Dana Levi' }, quiet: true })
  assert.equal(row.id, 'messenger:1111:9001'); assert.equal(row.phone, '0521234567'); assert.equal(row.last_dir, 'out'); assert.equal(row.unread, 0); assert.equal(row.name, 'Dana Levi')
  // live: an incoming message after ours counts; an older batch doesn't move the last line; a known name stays
  const live = threadRowFrom({ cur: { name: 'דנה', last_at: '2026-11-01T11:00:00Z', unread: 2 }, events: [{ direction: 'in', text: 'עוד שאלה', ts: '2026-11-01T12:00:00Z', mid: 'm9' }], platform: 'messenger', accountId: '1111', userId: '9001', prof: { name: 'x' } })
  assert.equal(live.unread, 3); assert.equal(live.last_text, 'עוד שאלה'); assert.equal(live.name, undefined)
  const old = threadRowFrom({ cur: { last_at: '2026-11-02T00:00:00Z' }, events: r.events, platform: 'messenger', accountId: '1111', userId: '9001', quiet: true })
  assert.equal(old.last_text, undefined)
})

test('a WhatsApp chat becomes a lead with its own source', () => {
  const r = manualLeadRow({ name: 'Dana', phone: '972521234567', channel: 'whatsapp', projectId: 'p_zr15', projectName: 'זרובבל 15' })
  assert.equal(r.row.source, 'whatsapp'); assert.equal(r.row.phone, '0521234567'); assert.equal(r.row.crm_data.origin.channel, 'whatsapp')
  assert.ok(manualLeadRow({ name: 'x', channel: 'whatsapp' }).error)
})
