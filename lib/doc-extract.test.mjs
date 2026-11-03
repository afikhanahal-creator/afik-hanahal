import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kindOf, extractDocument } from './doc-extract.js'
import { renderDocx } from './doc-docx.js'
import { renderPdf } from './doc-pdf.js'
import { cleanDocInput } from './documents.js'
import { textToBlocks, detectFields } from './doc-templates.js'

const doc = () => ({ number: 'AH-2026-0007', status: 'sent', created_at: '2026-11-03T10:00:00Z', data: cleanDocInput({ client: { name: 'רונן כהן', idNumber: '123456782', phone: '0501234567', role: 'buyer' }, property: { address: 'זרובבל 15', city: 'רעננה', dealType: 'sale' }, fees: { mode: 'percent', pct: 1.5, price: 3000000 }, agent: { name: 'ישראל בן-יהודה', license: '12345' } }).data })

test('kindOf reads the file by its bytes', () => {
  assert.equal(kindOf(Buffer.from('%PDF-1.4 x')), 'pdf')
  assert.equal(kindOf(Buffer.from([0x50, 0x4b, 3, 4]), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx'), 'docx')
  assert.equal(kindOf(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0])), 'png')
  assert.equal(kindOf(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpg')
  assert.equal(kindOf(Buffer.from('hello'), 'text/plain'), 'text')
  assert.equal(kindOf(Buffer.from('hello')), '')
})

test('a Word file we wrote comes back as text with its clauses, then blocks and field suggestions', async () => {
  const buf = await renderDocx(doc())
  const r = await extractDocument(buf, { name: 'a.docx' })
  assert.equal(r.method, 'docx')
  assert.ok(r.text.includes('טופס הזמנת שירותי תיווך') && r.text.includes('6. דמי התיווך') && r.text.includes('רונן כהן'))
  const blocks = textToBlocks(r.text)
  assert.ok(blocks.some(b => b.t === 'clause' && b.title === 'דמי התיווך'), 'clause 6 recognized')
  const d = detectFields(blocks)
  assert.ok(d.some(x => x.key === 'CLIENT_ID') && d.some(x => x.key === 'COMMISSION_PCT'))
})

test('a PDF with a text layer comes back through pdf-parse in reading order', async () => {
  const bytes = await renderPdf(doc())
  const r = await extractDocument(Buffer.from(bytes), { name: 'a.pdf', type: 'application/pdf' })
  assert.equal(r.method, 'pdf'); assert.equal(r.pages, 2)
  assert.ok(r.text.includes('טופס הזמנת שירותי תיווך'), 'the Hebrew title reads in logical order')
  assert.ok(r.text.includes('רונן כהן'))
})

test('an empty, oversized or unknown file is refused in words', async () => {
  assert.ok((await extractDocument(Buffer.alloc(0))).error)
  assert.ok((await extractDocument(Buffer.from('abc'), { type: 'application/zip' })).error)
  assert.ok((await extractDocument(Buffer.alloc(16 * 1024 * 1024))).error.includes('15'))
})
