import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STANDARD_FIELDS, keyFromLabel, cleanField, cleanTemplate, brokerageTemplate, templateKeys, templateValues, fillBlockText, renderBlocks, missingFields, emptyStandardKeys, textToBlocks, detectFields, applyField, sampleValues } from './doc-templates.js'
import { cleanDocInput } from './documents.js'

test('keys and fields are cleaned: a safe key, a type, options for a select', () => {
  assert.equal(keyFromLabel('Unit Number'), 'UNIT_NUMBER')
  assert.equal(keyFromLabel('שם היזם'), 'FIELD')
  assert.equal(keyFromLabel('שם היזם', ['FIELD']), 'FIELD_2')
  assert.equal(keyFromLabel('CLIENT_NAME'), 'CLIENT_NAME_2')
  const f = cleanField({ key: 'bad key', label: 'מספר יחידה', type: 'select', options: 'א, ב ,ג', required: 'yes' })
  assert.equal(f.key, 'FIELD'); assert.equal(f.type, 'select'); assert.deepEqual(f.options, ['א', 'ב', 'ג']); assert.equal(f.required, true)
  assert.equal(cleanField({ key: 'DEVELOPER', label: 'היזם' }).type, 'text')
})

test('cleanTemplate: blocks, unique fields, sections per kind; the brokerage template from the clauses', () => {
  const tp = cleanTemplate({ name: 'הסכם שכירות', blocks: [{ t: 'h', text: 'הסכם' }, { t: 'p', text: 'שלום {CLIENT_NAME}' }, { t: 'x', text: '' }], fields: [{ key: 'DEVELOPER', label: 'יזם' }, { key: 'DEVELOPER', label: 'כפול' }], sections: { fees: true } })
  assert.equal(tp.kind, 'custom'); assert.equal(tp.blocks.length, 2); assert.equal(tp.fields.length, 1); assert.equal(tp.sections.fees, true); assert.equal(tp.sections.parties, true)
  assert.equal(cleanTemplate({ name: 'x' }).sections.fees, false)
  const b = brokerageTemplate()
  assert.equal(b.kind, 'brokerage'); assert.equal(b.blocks.length, 8); assert.equal(b.blocks[5].t, 'clause'); assert.equal(b.sections.fees, true)
  assert.ok(templateKeys(b).includes('COMMISSION_BASIS') && templateKeys(b).includes('VAT') && templateKeys(b).includes('CLIENT_NAME'), 'legacy keys normalized')
})

test('templateValues + renderBlocks: standard values, custom fields, legacy placeholders, blanks', () => {
  const { data } = cleanDocInput({ client: { name: 'רונן כהן', idNumber: '123456782', phone: '0501234567', role: 'buyer' }, property: { address: 'זרובבל 15', city: 'רעננה', dealType: 'sale' }, fees: { mode: 'percent', pct: 1.5, price: 3000000, vatRate: 18 }, agent: { name: 'ישראל' } })
  const v = templateValues({ ...data, fields: { DEVELOPER: 'שכינתא', AGREE: true } }, { number: 'AH-2026-0009', project: { name: 'זרובבל 15', town: 'רעננה' } })
  assert.equal(v.CLIENT_FIRST_NAME, 'רונן'); assert.equal(v.CLIENT_LAST_NAME, 'כהן'); assert.equal(v.TOTAL, '₪53,100'); assert.equal(v.PROJECT_TOWN, 'רעננה'); assert.equal(v.DEVELOPER, 'שכינתא'); assert.equal(v.AGREE, '✓'); assert.equal(v.DOCUMENT_NUMBER, 'AH-2026-0009'); assert.equal(v.COMPANY_ID, '517082038')
  assert.equal(fillBlockText('שלום {CLIENT_NAME}, היזם {DEVELOPER}, {clientPhone}.', v), 'שלום רונן כהן, היזם שכינתא, 050-123-4567.')
  assert.equal(fillBlockText('אימייל: {CLIENT_EMAIL} {TERMS}', v), 'אימייל: ________')
  assert.equal(fillBlockText('{UNKNOWN}', v), '{UNKNOWN}')
  const tp = cleanTemplate({ name: 'x', blocks: [{ t: 'h', text: 'כותרת' }, { t: 'clause', title: 'הצדדים', text: '{CLIENT_NAME} ו-{COMPANY_NAME}' }, { t: 'clause', title: 'היזם', text: '{DEVELOPER}' }], fields: [{ key: 'DEVELOPER', label: 'יזם', required: true }, { key: 'NOTE', label: 'הערה' }] })
  const r = renderBlocks(tp, v)
  assert.equal(r[1].n, 1); assert.equal(r[2].n, 2); assert.ok(r[1].text.includes('רונן כהן') && r[1].text.includes('אפיק הנחל'))
  assert.deepEqual(missingFields(tp, v).map(f => f.key), ['NOTE'])
  assert.deepEqual(missingFields(tp, {}).map(f => f.key), ['DEVELOPER', 'NOTE'])
  assert.deepEqual(emptyStandardKeys(cleanTemplate({ name: 'x', blocks: [{ t: 'p', text: '{CLIENT_EMAIL} {CLIENT_NAME} {TERMS}' }] }), v), ['CLIENT_EMAIL'])
  assert.equal(sampleValues().CLIENT_NAME, 'רונן כהן')
})

test('textToBlocks: headings, numbered clauses (title line or inline), paragraphs', () => {
  const b = textToBlocks('הסכם שכירות\n\n1. הצדדים\nבין משכיר לשוכר.\n\n2. הנכס: הדירה ברחוב ______ בעיר ______.\n\nפסקה ארוכה שמסתיימת בנקודה ומכילה הרבה מילים כדי שלא תיחשב כותרת.\nשורה שנייה של אותה פסקה.\n')
  assert.deepEqual(b.map(x => x.t), ['h', 'clause', 'clause', 'p'])
  assert.equal(b[0].text, 'הסכם שכירות'); assert.equal(b[1].title, 'הצדדים'); assert.equal(b[1].text, 'בין משכיר לשוכר.'); assert.equal(b[2].title, 'הנכס'); assert.ok(b[2].text.startsWith('הדירה'))
  assert.ok(b[3].text.includes('שורה שנייה'))
  assert.deepEqual(textToBlocks(''), [])
})

test('detectFields + applyField: blanks and known patterns become fields', () => {
  const blocks = [{ t: 'p', text: 'אני הח"מ, שם מלא: ______ ת.ז. 123456782 טלפון: 050-123-4567, מזמין שירותי תיווך בשיעור של 2% ממחיר העסקה.' }, { t: 'p', text: 'תאריך: 03/11/2026 חתימה ________' }]
  const d = detectFields(blocks)
  const keys = d.map(x => x.key)
  assert.ok(keys.includes('CLIENT_NAME') && keys.includes('CLIENT_ID') && keys.includes('CLIENT_PHONE') && keys.includes('COMMISSION_PCT') && keys.includes('DOCUMENT_DATE'))
  const blank = d.find(x => x.block === 1 && !x.key)
  assert.ok(blank && blank.found === '________')
  const id = d.find(x => x.key === 'CLIENT_ID')
  assert.equal(applyField(blocks[0].text, id.start, id.end, 'CLIENT_ID').includes('ת.ז. {CLIENT_ID}'), true)
  assert.equal(applyField('abc', 1, 2, 'X'), 'a{X}c')
  assert.ok(Object.keys(STANDARD_FIELDS).length > 30)
})

test('a frozen brokerage template reads like the built-in clauses: no [[ ]] on the page, an unknown ID / address drops out, phones formatted', async () => {
  const { brokerageTemplate, renderBlocks, templateValues, fillBlockText } = await import('./doc-templates.js')
  const { renderClauses } = await import('./documents.js')
  const data = { client: { name: 'שלומי קורקוס', phone: '0506855656' }, property: { address: 'הרצל 12', city: 'רעננה', dealType: 'sale' }, fees: { mode: 'percent', pct: 2, price: 3000000, vatRate: 18 } }
  const blocks = renderBlocks(brokerageTemplate(), templateValues(data))
  for (const b of blocks) assert.ok(!/\[\[|\]\]/.test(`${b.title || ''} ${b.text}`), `no brackets: ${b.text}`)
  assert.ok(blocks[0].text.includes('שלומי קורקוס, טלפון 050-685-5656') && !blocks[0].text.includes('ת.ז.'))
  // the template path and the built-in path print the same first clause
  assert.equal(blocks[0].text, renderClauses(data)[0].text)
  const full = renderBlocks(brokerageTemplate(), templateValues({ ...data, client: { ...data.client, idNumber: '123456782', address: 'הרצל 5, רעננה' } }))
  assert.ok(full[0].text.includes('ת.ז. 123456782, מרחוב הרצל 5, רעננה, טלפון 050-685-5656'))
  // the office's own clause without brackets, new key names
  assert.equal(fillBlockText('אני {CLIENT_NAME}, ת.ז. {CLIENT_ID}, טלפון {CLIENT_PHONE}.', { CLIENT_NAME: 'דנה', CLIENT_ID: '', CLIENT_PHONE: '050' }), 'אני דנה, טלפון 050.')
  // a plain unknown value still prints a blank line to fill by hand
  assert.ok(fillBlockText('מחיר {PRICE}', { PRICE: '' }).includes('____'))
})
