import { test } from 'node:test'
import assert from 'node:assert/strict'
import { eventHash } from './documents-hash.js'
import { clientLegalIssues, SIGN_MESSAGES, signMessageList, cleanSignMessages, WORDING_GROUPS, signMessagePreview, suggestSignMessage, docNoteText, docFunnel, fmtHours, computeFees, docNumber, validIsraeliId, cleanDocInput, renderClauses, fillText, placeholderValues, canSign, publicView, leadDocEntry, mergeLeadDocs, clientWaText, clientEmail, officeSignedText, officeSignedEmail, clientSignedEmail, docStats, effectiveStatus, cleanClauses, DEFAULT_CLAUSES, fmtMoney, fmtPct, maskPhone, maskEmail } from './documents.js'

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
  assert.ok(cl[5].text.includes('\nלסכום זה יתווסף מע"מ כדין בשיעור 18%, בסך ₪8,100.\n'), 'the VAT on a line of its own, no brackets')
  assert.ok(!cl[5].text.includes('(₪') && (cl[5].text.match(/1\.5%/g) || []).length === 1, 'the percentage once, no amount squeezed in brackets')
  assert.ok(cl[7].text.includes('12345'))
  const blank = renderClauses({ ...d, client: { ...d.client, idNumber: '' } })
  assert.ok(!blank[0].text.includes('________') && !blank[0].text.includes('ת.ז.'), 'an unknown ID leaves the clause whole, not a blank line')
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
  assert.ok(ce.subject.includes('העותק החתום') && !ce.text.includes('AH-2026-0007'))
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

test('a document from a property: the fixed details are filled, a rental starts on months of rent; presets keep what repeats', async () => {
  const { propertyToDoc, cleanPreset, mergePresets } = await import('./documents.js')
  const sale = propertyToDoc({ id: 1761234567890, title: 'דירת גן בזרובבל', street: 'זרובבל', houseNumber: '15', location: 'רעננה', type: 'דירת גן', rooms: 4, size: 120, floor: 0, gush: '6578', helka: '12', price: '3,250,000 ₪', category: 'apartments' })
  assert.equal(sale.propertyId, '1761234567890')
  assert.deepEqual(sale.property, { address: 'זרובבל 15', city: 'רעננה', desc: 'דירת גן, 4 חדרים, 120 מ"ר, קומה 0', type: 'דירת גן', dealType: 'sale', price: 3250000, link: 'https://www.afikhanahal.co.il/p/1761234567890', notes: 'גוש 6578 חלקה 12' })
  assert.equal(sale.fees.mode, 'percent')
  const rent = propertyToDoc({ id: 7, title: 'פנטהאוז להשכרה', location: 'כפר סבא', price: '9500', category: 'rentals' })
  assert.equal(rent.property.address, 'פנטהאוז להשכרה', 'no street → the title')
  assert.equal(rent.property.dealType, 'rent'); assert.deepEqual(rent.fees, { mode: 'months', months: 1 }); assert.equal(rent.property.price, 9500)
  assert.equal(propertyToDoc({}).property.price, '')
  const pr = cleanPreset({ templateId: 'brokerage', fees: { mode: 'percent', pct: '1.5', months: 'x', fixed: -3 }, terms: '  שני   תשלומים ', expiryDays: 10, projectId: 'p_zrb', projectName: 'זרובבל 15', role: 'buyer', junk: 1 })
  assert.deepEqual({ ...pr, at: undefined }, { templateId: 'brokerage', fees: { mode: 'percent', pct: 1.5 }, terms: 'שני תשלומים', role: 'buyer', expiryDays: 10, projectId: 'p_zrb', projectName: 'זרובבל 15', at: undefined })
  assert.equal(cleanPreset({ templateId: 'drop table', fees: { mode: 'weird' } }).templateId, 'brokerage')
  assert.equal(cleanPreset({ fees: { mode: 'weird' } }).fees.mode, 'percent')
  let m = mergePresets({}, { 1: { fees: { pct: 2 } }, 2: { fees: { pct: 1 } } })
  assert.equal(Object.keys(m).length, 2)
  m = mergePresets(m, { 1: null, 3: { fees: { mode: 'months', months: 1 } } })
  assert.deepEqual(Object.keys(m).sort(), ['2', '3'])
  const many = {}; for (let i = 0; i < 320; i++) many[i] = { at: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString() }
  const capped = mergePresets(many, {})
  assert.equal(Object.keys(capped).length, 300); assert.ok(capped['319'] && !capped['0'], 'the newest are kept')
})

test('verifyLabel: the personal link by default, an older one-time code still reads right', async () => {
  const { verifyLabel } = await import('./documents.js')
  assert.equal(verifyLabel({ method: 'link', via: 'whatsapp', to: '054-***-*491' }, true), 'קישור אישי שנשלח לוואטסאפ 054-***-*491')
  assert.equal(verifyLabel({ method: 'link', via: 'email' }), 'באמצעות קישור אישי לאימייל')
  assert.equal(verifyLabel({ via: 'email', to: 'a***@x.com' }, true), 'קוד חד-פעמי לאימייל a***@x.com')
  assert.equal(verifyLabel({ via: 'whatsapp' }), 'בקוד חד-פעמי לוואטסאפ')
})

test('agentSigns: the broker signature goes on documents of that broker (or with no broker named)', async () => {
  const { agentSigns, sameAgent, publicView } = await import('./documents.js')
  const sig = { name: 'ישראל בן-יהודה' }
  assert.ok(sameAgent('ישראל בן יהודה', 'ישראל בן-יהודה'))
  assert.ok(agentSigns({ data: { agent: { name: 'ישראל בן-יהודה' } } }, sig))
  assert.ok(agentSigns({ data: {} }, sig))
  assert.equal(agentSigns({ data: { agent: { name: 'דנה לוי' } } }, sig), false)
  assert.equal(agentSigns({ data: {} }, null), false)
  const v = publicView({ id: 'x', number: 'AH-2026-0009', status: 'signed', data: { client: { name: 'א ב' }, agentSignature: { name: 'ישראל בן-יהודה', at: '2026-11-04T08:00:00Z', path: 'secret/path.png' } } }, [])
  assert.deepEqual(v.agentSigned, { name: 'ישראל בן-יהודה', at: '2026-11-04T08:00:00Z' })
  assert.ok(!JSON.stringify(v).includes('secret/path'))
})

test('clause 1 without an ID / address reads whole (no "________"); the office\'s own wording gets the same treatment', async () => {
  const { fillText, optionalParts, renderClauses } = await import('./documents.js')
  assert.equal(fillText('א, {n}[[, ת.ז. {id}]][[, מרחוב {addr}]], טלפון {ph}.', { n: 'רונן', id: '', addr: '', ph: '050' }), 'א, רונן, טלפון 050.')
  assert.equal(fillText('א, {n}[[, ת.ז. {id}]], טלפון {ph}.', { n: 'רונן', id: '123', ph: '050' }), 'א, רונן, ת.ז. 123, טלפון 050.')
  assert.equal(optionalParts('הח"מ, {clientName}, ת.ז. {clientId}, מרחוב {clientAddress}, טלפון {clientPhone}'), 'הח"מ, {clientName}[[, ת.ז. {clientId}]][[, מרחוב {clientAddress}]], טלפון {clientPhone}')
  const c1 = renderClauses({ client: { name: 'רונן כהן', phone: '0501234567', role: 'buyer' } })[0].text
  assert.ok(!c1.includes('________') && c1.includes('רונן כהן, טלפון 050-123-4567'), c1)
  const c2 = renderClauses({ client: { name: 'רונן כהן', phone: '0501234567', idNumber: '123456782', address: 'הרצל 5, רעננה' } })[0].text
  assert.ok(c2.includes('ת.ז. 123456782, מרחוב הרצל 5, רעננה, טלפון'), c2)
})

test('pre-signing wordings: first name only, plural office voice, no document number, no emoji, {link} once; the edited text keeps the link', () => {
  const d = cleanDocInput(base()).data
  const doc = { number: 'AH-2026-0007', status: 'draft', data: d, expires_at: '2026-11-17T10:00:00Z' }
  const link = 'https://www.afikhanahal.co.il/s/abc123defg'
  assert.ok(SIGN_MESSAGES.length >= 18 && SIGN_MESSAGES.every(m => WORDING_GROUPS[m.group] && m.body.includes('{title}')))
  const singular = /(^|[\s,.!?])(לך|אתה|שלך|תוכל|תוכלי|השארת|ראיתי|אשמח)([\s,.!?]|$)/
  for (const m of SIGN_MESSAGES) {
    const wa = clientWaText(doc, link, { messageId: m.id })
    assert.ok(wa.startsWith('היי רונן,'), m.id + ' greets the first name')
    assert.ok(!wa.includes('רונן כהן') && !wa.includes('AH-2026'), m.id + ' no full name / number')
    assert.equal(wa.split(link).length, 2, m.id + ' the link once')
    assert.ok(!/[\u{1F300}-\u{1FAFF}]|–|•/u.test(wa), m.id + ' no emoji / dashes')
    assert.ok(!singular.test(wa), m.id + ' plural: ' + wa)
    assert.ok(wa.includes('זרובבל 15, רעננה') && wa.includes('17.11.2026'), m.id + ' property + validity')
    assert.ok(wa.split('\n').length <= 8, m.id + ' short')
    const em = clientEmail(doc, link, { messageId: m.id })
    assert.ok(em.html.includes(link) && em.text.includes(link) && !em.html.includes('AH-2026') && !em.text.includes('AH-2026'), m.id + ' email without the number')
  }
  // the office's edited text: sent as is; a removed {link} comes back at the end
  const pv = signMessagePreview(doc, { messageId: 'warm' })
  assert.ok(pv.includes('{link}') && pv.includes('שמחים להתחיל'))
  const edited = clientWaText(doc, link, { text: 'היי רונן, הטופס מחכה לכם כאן:\n{link}\nתודה' })
  assert.equal(edited, `היי רונן, הטופס מחכה לכם כאן:\n${link}\nתודה`)
  assert.ok(clientWaText(doc, link, { text: 'בלי קישור בכלל' }).endsWith('\n' + link))
  // no first name → "שלום,"
  assert.ok(clientWaText({ ...doc, data: { ...d, client: { ...d.client, name: '' } } }, link).startsWith('שלום,'))
  // the suggestion
  assert.equal(suggestSignMessage(doc), 'after_call')
  assert.equal(suggestSignMessage(doc, { lead: { crm_data: { leadStatus: 'meeting' } } }), 'after_meeting')
  assert.equal(suggestSignMessage(doc, { lead: { crm_data: { leadStatus: 'negotiating' } } }), 'buyer_pre_offer')
  assert.equal(suggestSignMessage(doc, { lead: { crm_data: { leadStatus: 'new' } } }), 'buyer_pre_viewing')
  assert.equal(suggestSignMessage({ data: { ...d, client: { ...d.client, role: 'landlord' } } }), 'landlord')
  assert.equal(suggestSignMessage({ data: { ...d, client: { ...d.client, role: 'seller' } } }), 'seller')
  assert.equal(suggestSignMessage({ data: { ...d, property: { ...d.property, dealType: 'rent' } } }), 'renter_pre_viewing')
  assert.equal(suggestSignMessage(doc, { resend: true }), 'resend')
  // the office's own edits: an override of a built-in, an own wording, a restore
  const ov = cleanSignMessages({}, { after_call: { title: 'אחרי שיחה (שלנו)', body: 'היי, {title} עבור {prop} מוכן.\n\n  ', group: 'nope' }, w_mine: { title: 'שלנו', hint: 'h', body: 'נוסח משלנו על {address}', group: 'buy' }, 'bad id!': { body: 'x' }, w_empty: { body: '  ' } })
  assert.deepEqual(Object.keys(ov).sort(), ['after_call', 'w_mine'])
  assert.equal(ov.after_call.group, 'general')
  const list = signMessageList({ signMessages: ov })
  assert.ok(list.find(m => m.id === 'after_call').edited && list.find(m => m.id === 'after_call').title === 'אחרי שיחה (שלנו)')
  assert.ok(list.find(m => m.id === 'w_mine').custom && list.length === SIGN_MESSAGES.length + 1)
  assert.ok(clientWaText(doc, link, { messageId: 'w_mine' }, { signMessages: ov }).includes('נוסח משלנו על זרובבל 15, רעננה'))
  assert.ok(clientWaText(doc, link, { messageId: 'after_call' }, { signMessages: ov }).includes('מוכן.') && !clientWaText(doc, link, { messageId: 'after_call' }, { signMessages: ov }).includes('תודה על השיחה'))
  assert.equal(Object.keys(cleanSignMessages(ov, { after_call: null, w_mine: null })).length, 0)
  // the lead's note names the wording
  assert.ok(docNoteText('sent_whatsapp', doc, { message: 'אחרי שיחת טלפון' }).includes('נוסח: אחרי שיחת טלפון'))
  assert.ok(docNoteText('resent', doc, { via: 'וואטסאפ' }).includes('נשלח שוב') && docNoteText('resent', doc, { via: 'וואטסאפ' }).includes('בוואטסאפ'))
})

test('docFunnel: sent vs signed per month (Israel time), the cohort rate, the median time to sign, the previous period', () => {
  const now = Date.parse('2026-11-04T10:00:00Z')
  const mk = (id, sent_at, signed_at, status, extra = {}) => ({ id, status, created_at: sent_at || '2026-10-01T08:00:00Z', sent_at, signed_at, expires_at: '2027-01-01T00:00:00Z', data: {}, ...extra })
  const list = [
    mk(1, '2026-11-01T08:00:00Z', '2026-11-01T10:00:00Z', 'signed'),           // Nov: signed in 2 h
    mk(2, '2026-11-02T08:00:00Z', null, 'sent'),                               // Nov: waiting
    mk(3, '2026-10-05T08:00:00Z', '2026-10-06T08:00:00Z', 'signed'),           // Oct: 24 h
    mk(4, '2026-10-20T08:00:00Z', null, 'expired'),                            // Oct: lost
    mk(5, '2026-10-31T22:30:00Z', '2026-11-03T10:00:00Z', 'signed'),           // 00:30 Israel on 1.11 → November, signed after ~60 h
    mk(6, null, null, 'draft'),                                                // never sent
    mk(7, '2026-06-01T08:00:00Z', '2026-06-02T08:00:00Z', 'signed'),           // long ago
  ]
  const f = docFunnel(list, { months: 3, now })
  assert.deepEqual(f.months.map(m => m.key), ['2026-09', '2026-10', '2026-11'])
  const nov = f.months[2], oct = f.months[1]
  assert.equal(nov.sent, 3); assert.equal(nov.signed, 2); assert.equal(nov.waiting, 1); assert.equal(nov.rate, 67)
  assert.equal(nov.signedIn, 2)   // #1 and #5 were signed in November (#3 in October)
  assert.equal(oct.sent, 2); assert.equal(oct.signed, 1); assert.equal(oct.lost, 1); assert.equal(oct.rate, 50); assert.equal(oct.medianHours, 24)
  assert.equal(f.totals.sent, 5); assert.equal(f.totals.signed, 3); assert.equal(f.totals.rate, 60)
  assert.equal(f.waitingNow, 1)
  assert.equal(f.prev.sent, 1)   // the 3 months before September are June, July, August → #7
  assert.ok(f.months[2].label.includes('2026'))
  const all = docFunnel(list, { months: 0, now })
  assert.equal(all.months[0].key, '2026-06'); assert.equal(all.months.length, 6); assert.equal(all.prev, null)
  assert.equal(fmtHours(0.5), '30 דק׳'); assert.equal(fmtHours(2), '2 שע׳'); assert.equal(fmtHours(72), '3 ימים'); assert.equal(fmtHours(null), '—')
})

test('clientLegalIssues: the ID and the home address are the client\'s to give when signing — never required to send', () => {
  const full = clientLegalIssues({ idNumber: '123456782', address: 'הרצל 5, רעננה' })
  assert.ok(full.ok && !full.missing.length && full.idValid === true)
  const none = clientLegalIssues({})
  assert.ok(none.ok && none.missing.join() === 'id,address' && !none.errors.length)   // the office may send without them
  const strict = clientLegalIssues({}, { fillAtSign: false })                         // an explicit choice still asks
  assert.ok(!strict.ok && strict.errors[0].includes('מספר ת.ז. וכתובת מגורים'))
  const bad = clientLegalIssues({ idNumber: '123456789', address: 'הרצל 5' })
  assert.ok(!bad.ok && bad.idValid === false && bad.errors[0].includes('לא תקין'))   // a wrong ID is never waved through
  assert.equal(clientLegalIssues({ idNumber: '12345', address: 'הרצל 5' }).idValid, false)   // too short to be a real ID
  assert.deepEqual(clientLegalIssues({ idNumber: '123456782', address: 'אב' }).missing, ['address'])
})

test('agents: a list with one default, the old single agent as the default, the right signature per document', async () => {
  const { cleanAgents, agentsFromSettings, defaultAgent, agentOfDoc, signatureForDoc, signatureOwner, docAgent, cleanDocInput, cleanPreset } = await import('./documents.js')
  const list = cleanAgents([{ name: 'ישראל בן-יהודה', license: '12345', phone: '055-981-1814', id: 'a_main' }, { name: 'דנה לוי', isDefault: true, email: 'DANA@x.co' }, { name: '' }, { name: 'יוסי', id: 'a_main' }])
  assert.equal(list.length, 3, 'unnamed rows are dropped')
  assert.equal(list.filter(a => a.isDefault).length, 1)
  assert.equal(defaultAgent(list).name, 'דנה לוי')
  assert.equal(list[1].email, 'dana@x.co')
  assert.notEqual(list[2].id, 'a_main', 'a repeated id gets a new one')
  assert.ok(list.every(a => /^a_[a-z0-9]+$/.test(a.id)))
  assert.equal(cleanAgents([{ name: 'א' }, { name: 'ב' }]).findIndex(a => a.isDefault), 0, 'no default → the first')
  assert.equal(cleanAgents(Array.from({ length: 30 }, (_, i) => ({ name: `סוכן ${i}` }))).length, 20)
  // the old settings: one agent → a list of one, the default
  const old = agentsFromSettings({ agent: { name: 'ישראל בן-יהודה', license: '12345' } })
  assert.deepEqual(old.map(a => [a.id, a.name, a.isDefault]), [['a_main', 'ישראל בן-יהודה', true]])
  assert.deepEqual(agentsFromSettings({}), [])
  // a document's agent: by id, else by name
  assert.equal(agentOfDoc(list, { agent: { id: list[2].id, name: 'שם אחר' } }).name, 'יוסי')
  assert.equal(agentOfDoc(list, { agent: { name: 'ישראל בן יהודה' } }).id, 'a_main')
  assert.equal(agentOfDoc(list, { agent: { name: 'זר' } }), null)
  // signatures: per agent; the old single signature belongs to the agent with its name
  const sigs = { a_main: { name: 'ישראל בן-יהודה' }, [list[1].id]: { name: 'דנה לוי' } }
  assert.equal(signatureForDoc(list, sigs, { data: { agent: { id: 'a_main', name: 'ישראל בן-יהודה' } } }).name, 'ישראל בן-יהודה')
  assert.equal(signatureForDoc(list, sigs, { data: { agent: { name: 'דנה לוי' } } }).name, 'דנה לוי')
  assert.equal(signatureForDoc(list, sigs, { data: {} }).name, 'דנה לוי', 'no agent named → the default agent')
  assert.equal(signatureForDoc(list, sigs, { data: { agent: { id: list[2].id, name: 'יוסי' } } }), null, 'an agent without a signature gets none — never another one')
  assert.equal(signatureForDoc(list, sigs, { data: { agent: { name: 'זר' } } }), null)
  assert.equal(signatureOwner(list, { name: 'ישראל בן-יהודה' }), 'a_main')
  assert.equal(signatureOwner(list, { name: 'לא ברשימה' }), list[1].id, 'an unknown owner → the default agent')
  // the document keeps the agent's id; a preset remembers the agent
  assert.equal(cleanDocInput({ agent: docAgent(list[2]) }, { requireProperty: false, requireFees: false }).data.agent.id, list[2].id)
  assert.equal(cleanDocInput({ agent: { id: 'bad id', name: 'x' } }, { requireProperty: false, requireFees: false }).data.agent.id, undefined)
  assert.equal(cleanPreset({ agentId: 'a_main' }).agentId, 'a_main')
  assert.equal(cleanPreset({ agentId: 'nope' }).agentId, undefined)
})

test('a broker as the client, a fee in shekels without a price, and the deal note', async () => {
  const { cleanDocInput, CLIENT_ROLES, computeFees, feeRows, feeShare, cleanNote, placeholderValues, renderClauses, publicView, cleanPreset } = await import('./documents.js')
  assert.equal(CLIENT_ROLES.broker, 'מתווך')
  const base = { client: { name: 'רונן כהן', phone: '0501234567', role: 'broker' }, property: { address: 'זרובבל 15' }, agent: { name: 'ישראל בן יהודה' } }
  // a sum in shekels needs no deal price; a percent still does
  const fixed = cleanDocInput({ ...base, fees: { mode: 'fixed', fixed: '35000' } })
  assert.deepEqual(fixed.errors, [])
  assert.equal(fixed.data.client.role, 'broker')
  assert.equal(fixed.data.fees.commission, 35000)
  assert.ok(cleanDocInput({ ...base, fees: { mode: 'percent', pct: 2 } }).errors.some(e => /מחיר העסקה/.test(e)))
  // the fee table drops the price row without a price; the share shows with one
  assert.equal(feeRows(computeFees({ mode: 'fixed', fixed: 35000 })).some(([k]) => /מחיר העסקה/.test(k)), false)
  assert.equal(feeRows(computeFees({ mode: 'percent', pct: 2, price: 1e6 })).length, 5)
  assert.equal(feeShare(computeFees({ mode: 'fixed', fixed: 35000, price: 2e6 })), '1.75% ממחיר העסקה')
  assert.equal(feeShare(computeFees({ mode: 'fixed', fixed: 35000 })), '')
  // clause 6 leaves the price sentence out instead of a blank line
  const c6 = renderClauses(fixed.data).find(c => c.n === 6).text
  assert.ok(!/מחיר העסקה לצורך החישוב/.test(c6) && !/____/.test(c6), c6)
  assert.equal(placeholderValues(fixed.data).price, '')
  // the note keeps its lines, drops invisible marks, ≤ 12 lines / 800 chars
  assert.equal(cleanNote(' דמי התיווך ישולמו בחתימה.\r\n\r\n\r\n‏העמלה כוללת ליווי '), 'דמי התיווך ישולמו בחתימה.\n\nהעמלה כוללת ליווי')
  assert.equal(cleanNote('x\n'.repeat(30)).split('\n').length, 12)
  const withNote = cleanDocInput({ ...base, fees: { mode: 'fixed', fixed: 1000 }, note: 'שורה 1\nשורה 2' })
  assert.equal(withNote.data.note, 'שורה 1\nשורה 2')
  assert.equal(publicView({ data: withNote.data, status: 'sent' }).note, 'שורה 1\nשורה 2')
  assert.equal(cleanPreset({ note: '  הערה קבועה  ' }).note, 'הערה קבועה')
})

test('a sent, unsigned document can be reopened for a correction; the corrected send has its own wording and lead note', async () => {
  const D = await import('./documents.js')
  const sent = { status: 'sent', number: 'AH-2026-0002', data: { title: 'טופס הזמנת שירותי תיווך', client: { name: 'רונן כהן' }, property: { address: 'זרובבל 15', city: 'רעננה' },
    signing: { current: 0, list: [{ i: 0, name: 'רונן כהן', status: 'opened' }], tok: 'x' }, drive: { status: 'synced', want: ['original'], files: { original: { id: 'f1' } } } } }
  assert.equal(D.canRevise(sent), true)
  assert.equal(D.canRevise({ ...sent, status: 'opened' }), true)
  assert.equal(D.canRevise({ ...sent, status: 'expired' }), true)
  assert.equal(D.canRevise({ ...sent, status: 'signed' }), false)
  assert.equal(D.canRevise({ ...sent, status: 'cancelled' }), false)
  assert.equal(D.canRevise({ ...sent, status: 'draft' }), false)
  // a partner already signed: the signatures belong to that text
  assert.equal(D.canRevise({ ...sent, data: { ...sent.data, signing: { current: 1, list: [{ i: 0, status: 'signed' }, { i: 1, status: 'sent' }] } } }), false)
  const d1 = D.reopenData(sent.data, '2026-11-09T10:00:00.000Z')
  assert.equal(d1.signing, undefined)
  assert.equal(d1.revision, 1)
  assert.equal(d1.revisedAt, '2026-11-09T10:00:00.000Z')
  assert.equal(d1.client.name, 'רונן כהן')
  assert.equal(d1.drive.files.original, undefined)
  assert.deepEqual(d1.drive.want, [])
  assert.equal(sent.data.drive.files.original.id, 'f1')              // the input is untouched
  assert.equal(D.reopenData(d1).revision, 2)
  assert.equal(D.suggestSignMessage({ data: d1 }), 'revised')
  assert.equal(D.suggestSignMessage({ data: d1 }, { resend: true }), 'resend')
  const w = D.signMessage('revised')
  assert.ok(w && /מתוקן/.test(w.body) && !/[🙏🙂]/u.test(w.body))
  assert.match(D.docNoteText('reopened', sent), /נפתח לתיקון/)
  assert.match(D.docNoteText('revised_whatsapp', sent, { message: 'גרסה מתוקנת של המסמך' }), /^📄 גרסה מתוקנת של .*AH-2026-0002 נשלחה לחתימה בוואטסאפ · נוסח: גרסה מתוקנת/)
})

test('a broker as the client: clauses 5, 6, 7 turn around — he is paid from the deal, he does not pay us', async () => {
  const D = await import('./documents.js')
  const base = { client: { name: 'דני לוי', phone: '0501234567', role: 'buyer' }, property: { address: 'זרובבל 15', city: 'רעננה', desc: 'דירה' }, fees: { mode: 'fixed', fixed: 20000 } }
  const buyer = D.cleanDocInput(base, {}).data
  const broker = D.cleanDocInput({ ...base, client: { ...base.client, role: 'broker' } }, {}).data
  const c6 = data => D.renderClauses(data).find(c => c.n === 6)
  assert.match(c6(buyer).text, /ישלם הלקוח למתווך/)
  assert.match(c6(broker).text, /אינו משלם דמי תיווך/)
  assert.match(c6(broker).text, /זכאי לקבל מתוך העסקה תשלום של סכום קבוע, בסך ₪20,000 לפני מע"מ, שישולם לו על ידי המתווך/)
  assert.match(c6(broker).text, /סך הכל לתשלום ללקוח: ₪23,600 כולל מע"מ/)
  assert.doesNotMatch(c6(broker).text, /ישלם הלקוח/)
  // clauses 5 and 7 turn too; every other clause stays
  const a = D.renderClauses(buyer), b = D.renderClauses(broker)
  assert.equal(a.length, b.length)
  const c5 = b.find(c => c.n === 5).text, c7 = b.find(c => c.n === 7).text
  assert.match(c5, /הלקוח יהיה זכאי לתשלום לפי סעיף 6 רק אם היה גורם יעיל/)
  assert.doesNotMatch(c5, /מתחייב לשלם/)
  assert.match(c7, /התשלום ללקוח ישולם בתוך 14 ימים מהיום שבו קיבל המתווך בפועל את התשלום/)
  assert.doesNotMatch(c7, /דמי התיווך ישולמו/)
  for (let i = 0; i < a.length; i++) if (![5, 6, 7].includes(a[i].n)) assert.equal(a[i].text.replace('כקונה', 'כמתווך'), b[i].text)
  // the office's own (edited) clauses: still clause 6 that turns, found by number or by its title
  const edited = D.DEFAULT_CLAUSES.map(c => c.n === 6 ? { ...c, n: undefined, text: 'נוסח המשרד' } : { ...c })
  assert.match(D.renderClauses(broker, edited)[5].text, /אינו משלם דמי תיווך/)
  assert.equal(D.renderClauses(buyer, edited)[5].text, 'נוסח המשרד')
  // the fee table's labels follow
  const rows = D.feeRows(D.computeFees(broker.fees), broker).map(r => r[0]).join(' | ')
  assert.match(rows, /התשלום ללקוח \(מתווך\)/)
  assert.doesNotMatch(D.feeRows(D.computeFees(buyer.fees), buyer).map(r => r[0]).join(' | '), /מתווך\)/)
  assert.equal(D.suggestSignMessage({ data: broker }), 'broker')
})
