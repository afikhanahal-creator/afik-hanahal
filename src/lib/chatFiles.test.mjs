import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileKind, formatSize, fileProblem, acceptFiles, sendFiles, MAX_FILES, mediaFirst, uploadAll, sendGroupRequest } from './chatFiles.js'

test('chat files: kind, size, what can be sent', () => {
  assert.equal(fileKind({ type: 'image/jpeg', name: 'a.jpg' }), 'image')
  assert.equal(fileKind({ type: 'video/mp4' }), 'video')
  assert.equal(fileKind({ type: '', name: 'Plan.PDF' }), 'pdf')
  assert.equal(fileKind({ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name: 'חוזה.docx' }), 'doc')
  assert.equal(formatSize(1536), '2 KB')
  assert.equal(formatSize(3.4 * 1024 * 1024), '3.4 MB')
  assert.equal(fileProblem({ name: 'x.pdf', type: 'application/pdf', size: 1000 }), '')
  assert.match(fileProblem({ name: 'big.mp4', type: 'video/mp4', size: 60 * 1024 * 1024 }), /גדול מדי/)
  assert.match(fileProblem({ name: 'run.exe', type: 'application/x-msdownload', size: 10 }), /סוג קובץ/)
  const many = Array.from({ length: MAX_FILES + 2 }, (_, i) => ({ name: `${i}.jpg`, type: 'image/jpeg', size: 10 }))
  const r = acceptFiles(many, 0)
  assert.equal(r.ok.length, MAX_FILES); assert.equal(r.bad.length, 2)
})

test('the text goes with the first file only, and a failure stops the rest', async () => {
  globalThis.fetch = async (url, opts) => (String(url).includes('wizard-upload-url')
    ? { json: async () => ({ signedUrl: 'https://s/put', url: `https://s/pub/${JSON.parse(opts.body).name}` }) }
    : { ok: true })
  const calls = []
  const docs = [{ name: 'a.pdf', type: 'application/pdf', size: 10 }, { name: 'b.docx', type: 'application/msword', size: 10 }]
  const ok = await sendFiles(docs, 'הנה התוכניות', async (text, f) => { calls.push([text, f.fileName]); return { ok: true } })
  assert.deepEqual(ok, { ok: true, sent: 2 })
  assert.deepEqual(calls, [['הנה התוכניות', 'a.pdf'], ['', 'b.docx']])
  const bad = await sendFiles(docs, '', async () => ({ ok: false, error: 'Green API 466', quota: true }))
  assert.deepEqual(bad, { ok: false, sent: 0, error: 'Green API 466', quota: true })
})

test('photos and videos first (one album), each group keeps its order; up to 30 files', () => {
  assert.equal(MAX_FILES, 30)
  const l = [{ name: 'a.pdf', type: 'application/pdf' }, { name: '1.jpg', type: 'image/jpeg' }, { name: 'b.docx', type: '' }, { name: 'v.mp4', type: 'video/mp4' }, { name: '2.png', type: 'image/png' }]
  assert.deepEqual(mediaFirst(l).map(x => x.name), ['1.jpg', 'v.mp4', '2.png', 'a.pdf', 'b.docx'])
  assert.deepEqual(mediaFirst(l.map(file => ({ file })), x => x.file).map(x => x.file.name), ['1.jpg', 'v.mp4', '2.png', 'a.pdf', 'b.docx'])
})

test('everything is uploaded first (3 at a time, order kept), then the group goes in one request', async () => {
  let live = 0, peak = 0
  const upload = async f => { live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 5)); live--; return { url: `https://s/${f.name}`, fileName: f.name } }
  const many = Array.from({ length: 8 }, (_, i) => ({ name: `${i}.jpg`, type: 'image/jpeg', size: 1 }))
  const ups = await uploadAll([{ url: 'https://s/tpl.pdf', name: 'tpl.pdf' }, ...many], null, { upload })
  assert.equal(peak, 3)
  assert.deepEqual(ups.map(u => u.fileName), ['tpl.pdf', ...many.map(f => f.name)])
  // the group path: one call with every file, the text as the caption
  globalThis.fetch = async (url, opts) => ({ json: async () => ({ signedUrl: 'https://s/put', url: `https://s/pub/${JSON.parse(opts.body).name}` }), ok: true })
  const calls = []
  const docs = [{ name: 'a.pdf', type: 'application/pdf', size: 10 }, { name: 'b.docx', type: 'application/msword', size: 10 }]
  const st = []
  const r = await sendFiles(docs, 'הנה', null, (i, s) => st.push(`${i}:${s}`), { sendGroup: async (items, caption) => { calls.push([items.map(x => x.fileName), caption]); return { ok: true, sent: 2 } } })
  assert.deepEqual(r, { ok: true, sent: 2 })
  assert.deepEqual(calls, [[['a.pdf', 'b.docx'], 'הנה']])
  assert.ok(st.includes('0:sent') && st.includes('1:sent'))
  const bad = await sendFiles(docs, '', null, null, { sendGroup: async () => ({ ok: false, sent: 1, error: 'Green API 466', quota: true }) })
  assert.deepEqual(bad, { ok: false, sent: 1, error: 'Green API 466', quota: true })
})

test('the group request goes on where the server stopped (near its time limit), the caption only once', async () => {
  const bodies = []
  const fetchImpl = async (url, opts) => { const b = JSON.parse(opts.body); bodies.push(b)
    return { ok: true, json: async () => (bodies.length === 1 ? { ok: false, partial: true, sent: 2 } : { ok: true, sent: b.items.length }) } }
  const items = [1, 2, 3, 4].map(i => ({ file: `https://s/${i}.jpg`, fileName: `${i}.jpg` }))
  const r = await sendGroupRequest('972501234567', items, 'התמונות', { quotedMessageId: 'Q1', fetchImpl })
  assert.deepEqual(r, { ok: true, sent: 4 })
  assert.equal(bodies.length, 2)
  assert.equal(bodies[0].caption, 'התמונות'); assert.equal(bodies[0].quotedMessageId, 'Q1'); assert.equal(bodies[0].items.length, 4)
  assert.equal(bodies[1].caption, ''); assert.equal(bodies[1].quotedMessageId, undefined); assert.deepEqual(bodies[1].items.map(x => x.fileName), ['3.jpg', '4.jpg'])
  const fail = await sendGroupRequest('972501234567', items, '', { fetchImpl: async () => ({ ok: false, json: async () => ({ ok: false, sent: 1, error: 'Green API 466', quota: true }) }) })
  assert.deepEqual(fail, { ok: false, sent: 1, error: 'Green API 466', quota: true })
})
