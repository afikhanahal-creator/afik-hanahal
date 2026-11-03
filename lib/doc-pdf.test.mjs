import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { visualLine, fontRuns, wrapLines, renderPdf } from './doc-pdf.js'
import { renderDocx } from './doc-docx.js'
import { cleanDocInput, whenHe } from './documents.js'

const sample = () => cleanDocInput({ client: { name: 'רונן כהן', idNumber: '123456782', phone: '050-123-4567', email: 'ronen@example.com', address: 'הרצל 5, רעננה', role: 'buyer' }, property: { address: 'זרובבל 15', city: 'רעננה', desc: 'דירת 4 חדרים (כולל חניה)', type: 'דירה', dealType: 'sale' }, fees: { mode: 'percent', pct: 1.5, price: 3000000, vatRate: 18 }, agent: { name: 'ישראל בן-יהודה', license: '12345', phone: '055-981-1814' } }).data

test('visualLine: Hebrew reversed to visual order, numbers and Latin keep theirs, brackets mirrored, bidi controls dropped', () => {
  assert.equal(visualLine('שלום 123'), '123 םולש')
  assert.equal(visualLine('דירת 4 חדרים (כולל חניה)'), '(הינח ללוכ) םירדח 4 תריד')
  assert.equal(visualLine('מסמך AH-2026-0007 · תאריך 03.11.2026'), '03.11.2026 ךיראת · AH-2026-0007 ךמסמ')
  const w = whenHe('2026-11-04T08:13:00Z')
  assert.ok(w.startsWith('‪') && w.endsWith('‬'))
  const v = visualLine(`נחתם ${w} · אומת`)
  assert.ok(v.includes('04.11.2026, 10:13') && !/[‪‬]/.test(v))
  assert.equal(visualLine(''), '')
})

test('fontRuns: Hebrew runs (handed to fontkit in logical order) vs the rest', () => {
  assert.deepEqual(fontRuns('123 םולש'), [{ heb: false, s: '123 ' }, { heb: true, s: 'םולש' }])
  assert.deepEqual(fontRuns('ronen@example.com'), [{ heb: false, s: 'ronen@example.com' }])
  assert.deepEqual(fontRuns('(הינח ללוכ) םירדח 4 תריד'), [{ heb: true, s: '(הינח ללוכ) םירדח ' }, { heb: false, s: '4 ' }, { heb: true, s: 'תריד' }])
})

test('renderPdf: a sent document (2 pages) and a signed one (certificate page), text extractable in reading order', async () => {
  const data = sample()
  const doc = { number: 'AH-2026-0007', status: 'sent', data, created_at: '2026-11-03T10:00:00Z' }
  const bytes = await renderPdf(doc)
  assert.ok(bytes.length > 20000)
  const fake = { ...doc, status: 'signed', signed_at: '2026-11-04T08:13:00Z', signature: { name: 'רונן כהן', idNumber: '123456782', at: '2026-11-04T08:13:00Z', via: 'whatsapp', to: '050-***-*567', ip: '1.2.3.4', ua: 'UA' } }
  const signed = await renderPdf(fake, { events: [{ type: 'signed', at: '2026-11-04T08:13:00Z', ip: '1.2.3.4', hash: 'ab'.repeat(32) }], originalHash: 'cd'.repeat(32) })
  assert.ok(signed.length > bytes.length)
  // pdftotext (poppler) reads the embedded Hebrew back in logical order when it is present on this machine
  let pdftotext = true
  try { execFileSync('pdftotext', ['-v'], { stdio: 'ignore' }) } catch { pdftotext = false }
  if (pdftotext) {
    const dir = mkdtempSync(join(tmpdir(), 'afik-pdf-'))
    writeFileSync(join(dir, 'a.pdf'), bytes); writeFileSync(join(dir, 'b.pdf'), signed)
    const clean = t => t.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')   // pdftotext marks the runs with bidi controls
    const txt = clean(execFileSync('pdftotext', ['-layout', join(dir, 'a.pdf'), '-'], { encoding: 'utf8' }))
    assert.ok(txt.includes('טופס הזמנת שירותי תיווך'), 'the title reads in logical order')
    assert.ok(txt.includes('רונן כהן') && txt.includes('זרובבל') && txt.includes('1.5%') && txt.includes('53,100') && txt.includes('ronen@example.com'))
    assert.equal((txt.match(/\f/g) || []).length, 2, 'two pages')
    const t2 = clean(execFileSync('pdftotext', ['-layout', join(dir, 'b.pdf'), '-'], { encoding: 'utf8' }))
    assert.ok(t2.includes('אישור חתימה דיגיטלית') && t2.includes('cdcdcd') && t2.includes('נחתם דיגיטלית'))
    assert.equal((t2.match(/\f/g) || []).length, 3, 'three pages')
  }
})

test('renderDocx: a Word file with right-to-left paragraphs and the clauses', async () => {
  const data = sample()
  const buf = await renderDocx({ number: 'AH-2026-0007', status: 'sent', data, created_at: '2026-11-03T10:00:00Z' })
  assert.ok(buf.length > 20000)
  assert.equal(buf.slice(0, 2).toString(), 'PK')
  const dir = mkdtempSync(join(tmpdir(), 'afik-docx-'))
  writeFileSync(join(dir, 'a.docx'), buf)
  const xml = execFileSync('unzip', ['-p', join(dir, 'a.docx'), 'word/document.xml'], { encoding: 'utf8' })
  assert.ok(xml.includes('<w:bidi'), 'bidirectional paragraphs')
  assert.ok(xml.includes('<w:rtl'), 'right-to-left runs')
  assert.ok(xml.includes('טופס הזמנת שירותי תיווך') && xml.includes('רונן כהן') && xml.includes('53,100') && xml.includes('6. דמי התיווך'))
  assert.ok(execFileSync('unzip', ['-l', join(dir, 'a.docx')], { encoding: 'utf8' }).includes('word/media/'), 'the logo is embedded')
})
