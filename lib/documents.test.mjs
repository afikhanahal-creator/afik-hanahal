import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eventHash } from './documents-hash.js'
import { computeFees, docNumber, validIsraeliId, cleanDocInput, renderClauses, fillText, placeholderValues, canSign, publicView, leadDocEntry, mergeLeadDocs, clientWaText, clientEmail, officeSignedText, officeSignedEmail, clientSignedEmail, docStats, effectiveStatus, cleanClauses, DEFAULT_CLAUSES, fmtMoney, fmtPct, maskPhone, maskEmail } from './documents.js'

const base = () => ({ client: { name: 'רונן כהן', idNumber: '123456782', phone: '050-123-4567', email: 'ronen@example.com', address: 'הרצל 5, רעננה', role: 'buyer' }, property: { address: 'זרובבל 15', city: 'רעננה', desc: 'דירת 4 חדרים, קומה 3', type: 'דירה', dealType: 'sale' }, fees: { mode: 'percent', pct: 1.5, price: 3000000, vatRate: 18 }, agent: { name: 'ישראל בן-יהודה', license: '12345', phone: '055-981-1814' }, terms: '' })

test('computeFees: percent, fixed and months of rent, VAT separate, rounded', () => {
  const p = computeFees({ mode: 'percent', pct: 1.5, price: 3000000, vatRate: 18 })
  assert.equal(p.commission, 45000); assert.equal(p.vat, 8100); assert.equal(p.total, 53100); assert.equal(p.basis, '1.5% ממחיר העסקה')
  const m = computeFees({ mode: 'months', months: 1, price: 6500, vatRate: 17 })
  assert.equal(m.commission, 6500); assert.equal(m.vat, 1105); assert.equal(m.total, 7605); assert.equal(m.basis, '1 חודש שכירות')
  const f = computeFees({ mode: 'fixed', fixed: 10000.555, price: 1 })
  assert.equal(f.commission, 10000.56); assert.equal(f.vatRate, 18)
  assert.equal(computeFees({}).pct, 2)
  assert.equal(computeFees({ mode: 'percent', pct: 2.5, price: 1234567 }).commission, 30864.18)
  assert.equal(fmtMoney(53100), '₪53,100'); assert.equal(fmtMoney(1234.5, { sign: false }), '1,234.5'); assert.equal(fmtPct(2.5), '2.5%'); assert.equal(fmtPct(2), '2%')
})

test('docNumber and the Israeli id checksum', () => {
  assert.equal(docNumber(0, new Date('2026-11-03T10:00:00Z')), 'AH-2026-0001')
  assert.equal(docNumber(41, new Date('2026-12-31T23:30:00Z')), 'AH-2027-0042')   // 01:30 Israel time on Jan 1
  assert.equal(validIsraeliId('123456782'), true)
  assert.equal(validIsraeliId('123456789'), false)
  assert.equal(validIsraeliId(''), true)
  assert.equal(validIsraeliId('12'), false)
})

test('cleanDocInput: validation and cleaning', () => {
  const ok = cleanDocInput(base())
  assert.deepEqual(ok.errors, [])
  assert.equal(ok.data.client.phone, '0501234567'); assert.equal(ok.data.fees.total, 53100); assert.equal(ok.data.expiryDays, 14); assert.equal(ok.data.logo.show, true)
  const bad = cleanDocInput({ ...base(), client: { name: '', phone: '123', idNumber: '123456789' }, property: {}, fees: { mode: 'percent', pct: 20, price: 0 }, agent: {} })
  assert.ok(bad.errors.includes('שם הלקוח חסר')); assert.ok(bad.errors.includes('מספר הטלפון של הלקוח לא תקין')); assert.ok(bad.errors.includes('מספר תעודת הזהות לא תקין'))
  assert.ok(bad.errors.includes('כתובת הנכס חסרה')); assert.ok(bad.errors.includes('מחיר העסקה (לפני מע"מ) חסר')); assert.ok(bad.errors.includes('אחוז דמי התיווך צריך להיות בין 0.1 ל-15')); assert.ok(bad.errors.includes('שם הסוכן חסר'))
  const email = cleanDocInput({ ...base(), client: { name: 'דנה', email: 'Dana@Example.com' } })
  assert.deepEqual(email.errors, []); assert.equal(email.data.client.email, 'dana@example.com')
  assert.equal(cleanDocInput({ ...base(), logo: { show: false, url: 'http://x', size: 'xl', align: 'up' } }).data.logo.show, false)
  assert.equal(cleanDocInput({ ...base(), logo: { url: 'http://x', size: 'xl', align: 'up' } }).data.logo.url, '')
})

test('clauses: placeholders filled, clause 6 carries the fee variables, missing values print a blank', () => {
  const d = cleanDocInput(base()).data
  const cl = renderClauses(d, DEFAULT_CLAUSES, { date: new Date('2026-11-03T10:00:00Z') })
  assert.equal(cl.length, 8)
  assert.ok(cl[0].text.includes('רונן כהן') && cl[0].text.includes('123456782') && cl[0].text.includes('517082038'))
  assert.ok(cl[1].text.includes('זרובבל 15') && cl[1].text.includes('מכר') && cl[1].text.includes('כקונה'))
  assert.ok(cl[5].text.includes('1.5%') && cl[5].text.includes('₪45,000') && cl[5].text.includes('₪8,100') && cl[5].text.includes('₪53,100') && cl[5].text.includes('₪3,000,000'))
  assert.ok(!cl[5].text.includes('{') && !cl[5].text.includes('________'))
  assert.ok(cl[7].text.includes('12345'))
  const blank = renderClauses({ ...d, client: { ...d.client, idNumber: '' } })
  assert.ok(blank[0].text.includes('________'))
  assert.equal(fillText('א {terms} ב.', { terms: '' }), 'א ב.')
  assert.equal(fillText('{unknown}', {}), '{unknown}')
  assert.equal(placeholderValues(d).dealType, 'מכר')
  const custom = cleanClauses([{ title: 'א', text: 'שלום {clientName}' }, { title: '', text: '' }])
  assert.equal(custom.length, 1); assert.equal(custom[0].n, 1)
  assert.equal(cleanClauses([]).length, 8)
})

test('canSign / effectiveStatus / docStats', () => {
  const now = Date.parse('2026-11-03T10:00:00Z')
  const at = d => new Date(now + d * 864e5).toISOString()
  assert.equal(canSign({ status: 'sent', expires_at: at(3) }, now).ok, true)
  assert.equal(canSign({ status: 'opened', expires_at: at(-1) }, now).expired, true)
  assert.equal(canSign({ status: 'signed' }, now).signed, true)
  assert.equal(canSign({ status: 'draft' }, now).ok, false)
  assert.equal(canSign({ status: 'cancelled' }, now).ok, false)
  assert.equal(effectiveStatus({ status: 'sent', expires_at: at(-1) }, now), 'expired')
  assert.equal(effectiveStatus({ status: 'sent', expires_at: at(1) }, now), 'sent')
  assert.deepEqual(docStats([{ status: 'sent', expires_at: at(1) }, { status: 'opened', expires_at: at(-2) }, { status: 'signed' }, { status: 'draft' }, { status: 'failed' }], now), { total: 5, waiting: 1, signed: 1, problem: 2 })
})

test('audit chain: a changed event changes every later hash', () => {
  const e1 = { type: 'created', at: '2026-11-03T10:00:00Z' }, e2 = { type: 'signed', at: '2026-11-03T11:00:00Z', ip: '1.2.3.4', ua: 'x' }
  const h1 = eventHash('', e1), h2 = eventHash(h1, e2)
  assert.equal(h1.length, 64); assert.notEqual(h1, h2)
  assert.notEqual(eventHash(eventHash('', { ...e1, at: '2026-11-03T10:00:01Z' }), e2), h2)
  assert.equal(eventHash(h1, e2), h2)
})

test('publicView hides what the client must not see; leadDocEntry is compact', () => {
  const d = cleanDocInput(base()).data
  const doc = { id: 'u1', number: 'AH-2026-0007', status: 'sent', data: d, token_hash: 'secret', otp_hash: 'secret2', created_at: '2026-11-03T10:00:00Z', expires_at: '2026-11-17T10:00:00Z' }
  const v = publicView(doc)
  assert.equal(v.token_hash, undefined); assert.equal(v.otp_hash, undefined)
  assert.equal(v.client.phoneMasked, '050-***-*567'); assert.equal(v.client.emailMasked, 'ro***@example.com'); assert.equal(v.client.idNumber, '123456782'); assert.equal(v.client.phone, '0501234567')
  assert.equal(v.clauses.length, 8); assert.equal(v.fees.total, 53100); assert.deepEqual(v.channels, { whatsapp: true, email: true })
  assert.equal(maskPhone(''), ''); assert.equal(maskEmail('x'), '')
  const e = leadDocEntry(doc)
  assert.equal(e.number, 'AH-2026-0007'); assert.equal(e.property, 'זרובבל 15, רעננה'); assert.equal(e.pct, 1.5); assert.equal(e.total, 53100); assert.equal(e.signed, false)
  const merged = mergeLeadDocs([{ id: 'u1', status: 'draft' }, { id: 'u0' }], e)
  assert.equal(merged.length, 2); assert.equal(merged[0].status, 'sent')
})

test('messages: client WhatsApp / email, office and client after signing — plural office voice, no Hebrew in links', () => {
  const d = cleanDocInput(base()).data
  const doc = { number: 'AH-2026-0007', status: 'sent', data: d, expires_at: '2026-11-17T10:00:00Z', signed_at: '2026-11-04T09:30:00Z' }
  const link = 'https://www.afikhanahal.co.il/sign/abc'
  const wa = clientWaText(doc, link)
  assert.ok(wa.startsWith('היי רונן,') && wa.includes(link) && wa.includes('זרובבל 15, רעננה') && wa.includes('17.11.2026'))
  const wa2 = clientWaText(doc, link, { personal: 'כמו שדיברנו, הטופס לדירה.' })
  assert.ok(wa2.includes('כמו שדיברנו') && !wa2.includes('בהמשך לשיחתנו'))
  const em = clientEmail(doc, link)
  assert.ok(em.subject.includes('טופס הזמנת שירותי תיווך') && em.html.includes(link) && em.text.includes(link) && em.html.includes('dir="rtl"'))
  const ot = officeSignedText(doc, { cardLink: 'https://www.afikhanahal.co.il/admin-panel/leads?lead=9' })
  assert.ok(ot.startsWith('נחתם מסמך חדש!') && ot.includes('רונן כהן') && ot.includes('1.5%') && ot.includes('₪53,100') && ot.includes('AH-2026-0007') && ot.includes('lead=9'))
  const oe = officeSignedEmail(doc)
  assert.ok(oe.subject.includes('רונן כהן') && oe.html.includes('ronen@example.com'))
  const ce = clientSignedEmail(doc)
  assert.ok(ce.subject.includes('העותק החתום') && ce.text.includes('AH-2026-0007'))
})
