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

test('several signers: cleanDocInput keeps them, the state advances in order, the public view points the OTP at whoever signs now', async () => {
  const { startSigning, currentSigner, advanceSigning, signerProgress, signerInfo, signerProgressText, SIGNER_ROLES } = await import('./documents.js')
  const { data, errors } = cleanDocInput({ ...base(), signers: [{ name: 'דנה כהן', phone: '052-123-4567', role: 'spouse' }, { name: '', phone: '', email: '' }, { name: 'ערב', role: 'guarantor' }] })
  assert.deepEqual(errors, ['לחותם הנוסף ערב צריך טלפון או אימייל'])
  assert.equal(data.signers.length, 2)
  assert.equal(data.signers[0].role, 'spouse'); assert.equal(data.signers[0].phone, '0521234567')
  const ok = cleanDocInput({ ...base(), signers: [{ name: 'דנה כהן', phone: '052-123-4567', role: 'nonsense' }] }).data
  assert.equal(ok.signers[0].role, 'other')
  const sg = startSigning(ok)
  assert.equal(sg.list.length, 2); assert.equal(sg.list[0].role, 'client'); assert.equal(sg.current, 0)
  const doc = { number: 'AH-2026-0001', status: 'sent', data: { ...ok, signing: { ...sg, list: sg.list.map((x, k) => k === 0 ? { ...x, status: 'sent' } : x) } } }
  assert.equal(currentSigner(doc).name, 'רונן כהן')
  const a = advanceSigning(doc.data.signing, 0, { name: 'רונן כהן', at: '2026-11-04T08:00:00Z' }, { path: 'x/sig.png' })
  assert.equal(a.current, 1); assert.equal(a.finished, false); assert.equal(a.list[0].status, 'signed'); assert.equal(a.list[0].signature_path, 'x/sig.png')
  const doc2 = { ...doc, data: { ...doc.data, signing: { ...a, list: a.list.map((x, k) => k === 1 ? { ...x, status: 'sent' } : x) } } }
  assert.equal(currentSigner(doc2).name, 'דנה כהן')
  assert.deepEqual(signerProgress(doc2), { done: 1, total: 2, multi: true, finished: false })
  assert.equal(signerProgressText(doc2), '1/2')
  const view = publicView(doc2, DEFAULT_CLAUSES)
  assert.equal(view.client.phoneMasked, '052-***-*567', 'the OTP destination is the second signer\'s phone')
  assert.deepEqual(view.channels, { whatsapp: true, email: false })
  assert.equal(view.client.name, 'רונן כהן', 'the document still names the client')
  assert.equal(view.signer.index, 1); assert.equal(view.signer.total, 2); assert.equal(view.signer.list[0].status, 'signed')
  const b = advanceSigning(doc2.data.signing, 1, { name: 'דנה', at: '2026-11-05T08:00:00Z' })
  assert.equal(b.finished, true)
  // an old document without a signing state = one signer, the client
  const old = { status: 'signed', data: base() }
  assert.equal(currentSigner(old).role, 'client'); assert.equal(signerInfo(old).total, 1); assert.equal(signerProgressText(old), '')
  assert.equal(SIGNER_ROLES.spouse, 'בן/בת זוג')
  assert.equal(leadDocEntry(doc2).signers, '1/2')
})

test('reminders: due by the signer\'s own clock, once per step, one a day, only in the hours, never for a finished or muted document', async () => {
  const { reminderDue, cleanReminders, DEFAULT_REMINDERS, startSigning } = await import('./documents.js')
  const at = (h, dayOffset = 0) => Date.UTC(2026, 10, 10 + dayOffset, h - 2)   // Israel = UTC+2 in November
  const sent = new Date(at(10)).toISOString()
  const doc = { status: 'sent', sent_at: sent, expires_at: new Date(at(10, 14)).toISOString(), data: base() }
  assert.equal(reminderDue(doc, DEFAULT_REMINDERS, at(12, 1)), null, 'day 1: nothing')
  assert.deepEqual(reminderDue(doc, DEFAULT_REMINDERS, at(12, 2)), { step: 1, signer: 0, days: 2 })
  assert.equal(reminderDue(doc, DEFAULT_REMINDERS, at(7, 2)), null, 'outside the hours')
  assert.equal(reminderDue(doc, DEFAULT_REMINDERS, at(21, 2)), null)
  assert.deepEqual(reminderDue(doc, DEFAULT_REMINDERS, at(12, 6)), { step: 2, signer: 0, days: 5 }, 'late: only the latest step')
  const once = { ...doc, data: { ...doc.data, signing: { ...startSigning(doc.data), list: [{ ...startSigning(doc.data).list[0], status: 'sent', sent_at: sent }], reminders: [{ signer: 0, step: 1, at: new Date(at(12, 2)).toISOString() }] } } }
  assert.equal(reminderDue(once, DEFAULT_REMINDERS, at(13, 2)), null, 'step 1 already sent')
  assert.equal(reminderDue(once, DEFAULT_REMINDERS, at(12, 4)), null, 'between the steps: nothing')
  assert.deepEqual(reminderDue(once, DEFAULT_REMINDERS, at(12, 5)), { step: 2, signer: 0, days: 5 })
  const twice = { ...once, data: { ...once.data, signing: { ...once.data.signing, reminders: [...once.data.signing.reminders, { signer: 0, step: 2, at: new Date(at(12, 5)).toISOString() }] } } }
  assert.equal(reminderDue(twice, DEFAULT_REMINDERS, at(12, 9)), null, 'every step sent')
  assert.equal(reminderDue({ ...doc, data: { ...doc.data, signing: { noRemind: true } } }, DEFAULT_REMINDERS, at(12, 3)), null, 'muted')
  assert.equal(reminderDue({ ...doc, status: 'signed' }, DEFAULT_REMINDERS, at(12, 3)), null)
  assert.equal(reminderDue({ ...doc, expires_at: new Date(at(9, 2)).toISOString() }, DEFAULT_REMINDERS, at(12, 3)), null, 'expired')
  assert.equal(reminderDue(doc, { ...DEFAULT_REMINDERS, enabled: false }, at(12, 3)), null)
  // the second signer's clock starts when THEY got the link
  const sg = startSigning(doc.data)
  const two = { ...doc, data: { ...doc.data, signers: [{ name: 'דנה', phone: '0521234567', role: 'spouse' }] } }
  const sg2 = startSigning(two.data); sg2.current = 1; sg2.list[0] = { ...sg2.list[0], status: 'signed' }; sg2.list[1] = { ...sg2.list[1], status: 'sent', sent_at: new Date(at(10, 4)).toISOString() }
  assert.equal(reminderDue({ ...two, data: { ...two.data, signing: sg2 } }, DEFAULT_REMINDERS, at(12, 5)), null, 'one day after the second signer got it')
  assert.deepEqual(reminderDue({ ...two, data: { ...two.data, signing: sg2 } }, DEFAULT_REMINDERS, at(12, 6)), { step: 1, signer: 1, days: 2 })
  void sg
  assert.deepEqual(cleanReminders({ days: '5, 2, 2, 90', from: '8', to: '19' }), { enabled: true, days: [2, 5], from: 8, to: 19 })
  assert.deepEqual(cleanReminders({ enabled: false, days: [] }).days, [2, 5])
})

test('Drive naming and folders; the office event texts; the next-signer and reminder messages', async () => {
  const { driveFileName, driveFolderPath, officeEventText, nextSignerWaText, reminderWaText, reminderEmail, nextSignerEmail, cleanNotifyOn } = await import('./documents.js')
  const doc = { number: 'AH-2026-0007', status: 'sent', project_name: 'זרובבל 15 / v2', sent_at: '2026-11-03T10:00:00Z', expires_at: '2026-11-17T10:00:00Z', data: { ...base(), title: 'טופס הזמנת שירותי תיווך' } }
  assert.equal(driveFileName(doc, 'original'), 'זרובבל 15 v2_רונן כהן_טופס הזמנת שירותי תיווך_2026-11-03_Sent.pdf')
  assert.equal(driveFileName({ ...doc, signed_at: '2026-11-05T10:00:00Z' }, 'signed'), 'זרובבל 15 v2_רונן כהן_טופס הזמנת שירותי תיווך_2026-11-05_Signed.pdf')
  assert.deepEqual(driveFolderPath(doc, 'signed'), ['Afik HaNahal', 'Documents', 'Projects', 'זרובבל 15 v2', 'Signed Documents'])
  assert.deepEqual(driveFolderPath({ data: base() }, 'original'), ['Afik HaNahal', 'Documents', 'General', 'Sent Documents'])
  assert.equal(driveFileName({ data: { client: {} } }, 'docx', new Date('2026-01-02T00:00:00Z')), 'General_Client_טופס הזמנת שירותי תיווך_2026-01-02_Draft.docx')
  const t = officeEventText('opened', doc, { cardLink: 'https://x/l' })
  assert.ok(t.startsWith('רונן כהן פתחו את המסמך לחתימה') && t.includes('AH-2026-0007') && t.includes('https://x/l'))
  assert.ok(officeEventText('expired', doc).includes('פג'))
  assert.ok(officeEventText('failed', doc, { error: 'quota' }).includes('quota'))
  assert.equal(officeEventText('nothing', doc), '')
  const w = nextSignerWaText(doc, 'https://l', { name: 'דנה כהן', role: 'spouse' }, { name: 'רונן כהן', role: 'client' })
  assert.ok(w.startsWith('היי דנה,') && w.includes('רונן כהן חתמו') && w.includes('https://l') && !/\bאני\b/.test(w))
  const r = reminderWaText(doc, 'https://l', { step: 2 })
  assert.ok(r.startsWith('היי רונן,') && r.includes('עוד תזכורת') && r.includes('https://l') && r.includes('17.11.2026'))
  assert.ok(reminderEmail(doc, 'https://l', {}).html.includes('https://l') && nextSignerEmail(doc, 'https://l', { name: 'דנה' }, { name: 'רונן' }).subject.includes('תורכם'))
  assert.deepEqual(cleanNotifyOn({ opened: false, signed: 'false' }), { opened: false, partial: true, signed: false, expired: true, failed: true, reminder: false })
})

test('short signing links: /s/<10 letters / digits>, the old /sign/<token> still opens, capitals read the same', async () => {
  const { signUrl, signTokenFromPath } = await import('./documents.js')
  const { newSignCode, SIGN_ALPHABET } = await import('./documents-hash.js')
  const codes = new Set(Array.from({ length: 200 }, () => newSignCode()))
  assert.equal(codes.size, 200, 'no repeats')
  for (const c of codes) assert.match(c, /^[a-hjkmnp-z2-9]{10}$/, 'lowercase English letters and digits, no 0 o 1 l i')
  assert.ok(!/[01oli]/.test(SIGN_ALPHABET))
  assert.equal(signUrl('k7dmq2xpwn'), 'https://www.afikhanahal.co.il/s/k7dmq2xpwn')
  assert.equal(signTokenFromPath('/s/k7dmq2xpwn'), 'k7dmq2xpwn')
  assert.equal(signTokenFromPath('/s/K7DMQ2XPWN/'), 'k7dmq2xpwn')
  assert.equal(signTokenFromPath('/sign/8gL4JsZW5tm12j2GhnXD4yB5JplRhQzs'), '8gL4JsZW5tm12j2GhnXD4yB5JplRhQzs', 'an old long token keeps its case')
  assert.equal(signTokenFromPath('/s/abc'), '')
  assert.equal(signTokenFromPath('/book'), '')
})
