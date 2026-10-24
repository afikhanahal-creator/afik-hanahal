import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileKind, formatSize, fileProblem, acceptFiles, sendFiles, MAX_FILES } from './chatFiles.js'

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
