import test from 'node:test'
import assert from 'node:assert/strict'
import { inflateRawSync } from 'node:zlib'
import { contactsWorkbook, metaAudienceCsv, localPhone, intlPhone, splitName, EXPORT_COLUMNS, DEFAULT_COLUMNS, exportFileName } from './contacts-export.js'
import { zipStore, createXlsx, colName } from './xlsx-writer.js'

// read a stored zip back (method 0) → { name: text }
function unzip(buf) {
  const b = Buffer.from(buf), out = {}
  let o = 0
  while (b.readUInt32LE(o) === 0x04034b50) {
    const method = b.readUInt16LE(o + 8), size = b.readUInt32LE(o + 18), nl = b.readUInt16LE(o + 26), xl = b.readUInt16LE(o + 28)
    const name = b.slice(o + 30, o + 30 + nl).toString('utf8'), start = o + 30 + nl + xl
    const data = b.slice(start, start + size)
    out[name] = (method === 8 ? inflateRawSync(data) : data).toString('utf8')
    o = start + size
  }
  return out
}

const leads = [
  { id: '1', name: 'יוגב קידר', phone: '054-304-9491', email: 'Kidar@Example.com', leadStatus: 'contacted', source: 'meta', campaignName: 'זרובבל 15 - v2', propTitle: 'זרובבל 15', budget: '3,000,000', tags: ['חם', 'משקיע'], ts: Date.parse('2026-10-20T07:00:00Z'), notes: [{ text: 'ישן', ts: 1 }, { text: 'חדש', ts: 2 }] },
  { id: '2', name: '=HYPERLINK("x")', phone: '+972 50 123 4567', email: '', leadStatus: 'new', source: 'website', ts: 0 },
  { id: '3', name: 'כפול', phone: '0543049491', email: 'other@x.co' },
  { id: '4', name: 'בלי פרטים', phone: '', email: 'not-an-email' },
  { id: '5', name: 'ביקש להפסיק', phone: '0529998877', auto: { optOut: true } },
]

test('phones and names', () => {
  assert.equal(localPhone('+972 54-304-9491'), '0543049491')
  assert.equal(intlPhone('054-304-9491'), '972543049491')
  assert.equal(intlPhone('543049491'), '972543049491')
  assert.deepEqual(splitName('דנה בר לב · זרובבל 15'), { first: 'דנה', last: 'בר לב' })
  assert.deepEqual(splitName('Moshe'), { first: 'Moshe', last: '' })
  assert.ok(DEFAULT_COLUMNS.includes('phone') && EXPORT_COLUMNS.length > DEFAULT_COLUMNS.length)
  assert.equal(colName(0), 'A'); assert.equal(colName(25), 'Z'); assert.equal(colName(26), 'AA')
})

test('the Excel file: a valid zip, Hebrew headers, RTL, phones as text, nothing evaluated', () => {
  const x = unzip(contactsWorkbook(leads, { columns: ['name', 'phone', 'phoneIntl', 'email', 'stage', 'budget', 'tags', 'lastNote', 'created'], stageName: id => ({ contacted: 'נוצר קשר', new: 'חדש' }[id]) }))
  assert.ok(x['[Content_Types].xml'] && x['xl/workbook.xml'] && x['xl/styles.xml'])
  const sh = x['xl/worksheets/sheet1.xml']
  assert.match(sh, /rightToLeft="1"/)
  assert.match(sh, /<t xml:space="preserve">שם מלא<\/t>/)
  assert.match(sh, /t="inlineStr"[^>]*><is><t xml:space="preserve">0543049491</)   // the leading zero is kept
  assert.match(sh, /\+972543049491/)
  assert.match(sh, /kidar@example\.com/)
  assert.match(sh, /<v>3000000<\/v>/)                                               // a budget is a number
  assert.match(sh, /חם, משקיע/)
  assert.match(sh, />חדש</); assert.match(sh, /נוצר קשר/)
  assert.match(sh, /20\/10\/2026 10:00/)                                           // Israel time
  assert.ok(!/<f>/.test(sh)); assert.match(sh, /=HYPERLINK\(&quot;x&quot;\)/)      // a "formula" stays text
  assert.match(sh, /<autoFilter ref="A1:I6"\/>/)
})

test('the Meta audience file: identifiers only, one row per person, opt-outs out', () => {
  const r = metaAudienceCsv(leads)
  const lines = r.csv.trim().split('\n')
  assert.equal(lines[0], 'email,phone,fn,ln,ct,country')
  assert.equal(r.rows.length, 2)                    // 1 + 2; 3 duplicates 1's phone, 4 has nothing usable, 5 opted out
  assert.equal(r.dupes, 1); assert.equal(r.skipped, 1); assert.equal(r.optedOut, 1)
  assert.equal(lines[1], 'kidar@example.com,972543049491,יוגב,קידר,,il')
  assert.ok(lines[2].startsWith(',972501234567,'))
  assert.ok(!lines.some(l => /^=|,=/.test(l)))      // no cell starts a formula
  assert.equal(metaAudienceCsv(leads, { includeOptOut: true }).rows.length, 3)
  assert.equal(exportFileName('meta', new Date('2026-10-23T10:00:00Z')), 'meta_audience_2026-10-23.csv')
  assert.equal(exportFileName('xlsx', new Date('2026-10-23T22:30:00Z')), 'contacts_export_2026-10-24.xlsx')
})

test('a bigger workbook stays a valid zip', () => {
  const many = Array.from({ length: 2000 }, (_, i) => ({ id: i, name: `ליד ${i}`, phone: `05${String(i).padStart(8, '0')}` }))
  const z = contactsWorkbook(many, { columns: ['name', 'phone'] })
  assert.ok(unzip(z)['xl/worksheets/sheet1.xml'].includes('ליד 1999'))
  assert.equal(Buffer.from(zipStore([{ name: 'a.txt', data: 'x' }])).readUInt32LE(0), 0x04034b50)
  assert.ok(createXlsx([{ name: 'a/b?', columns: [], rows: [] }]).length > 100)
})
