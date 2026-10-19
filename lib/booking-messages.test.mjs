import test from 'node:test'
import assert from 'node:assert/strict'
import { clientEmail, officeEmail, officeText, clientText } from './booking-messages.js'
import { DEFAULT_BOOKING } from './booking.js'

const b = {
  id: 'a1b2c3d4e5f6', token: 'Zx9_-abcdefghijklmno', type: DEFAULT_BOOKING.types[0], channel: 'phone', lang: 'he',
  name: 'אביה קידר', phone: '0559991052', email: 'client@example.com', notes: 'לקנות פרדס <בפרדס חנה>',
  start: '2026-10-19T09:30:00.000Z', end: '2026-10-19T10:00:00.000Z',
}
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

test('the office email is formal: no emoji, a details table, escaped input, the confirmation status', () => {
  const { subject, html } = officeEmail('created', b, { calendar: 'none', leadNew: true, wa: { ok: false, quota: true }, mail: { ok: true } })
  for (const s of [subject, html]) assert.doesNotMatch(s, EMOJI)
  assert.match(subject, /^פגישה חדשה נקבעה דרך האתר: אביה קידר · יום שני, 19 באוקטובר 2026 12:30$/)
  assert.match(html, /12:30–13:00/)
  assert.match(html, /&lt;בפרדס חנה&gt;/)
  assert.doesNotMatch(html, /<בפרדס/)
  assert.match(html, /מכסת Green API/)
  assert.match(html, /ליד חדש נוסף/)
  assert.match(html, /admin-panel\/bookings/)
  assert.match(html, /dir="rtl"/)
})

test('the client email carries the private link to reschedule / cancel, in the client language', () => {
  const he = clientEmail('created', b)
  assert.doesNotMatch(he.html + he.subject, EMOJI)
  assert.match(he.html, /book\?m=a1b2c3d4e5f6\.Zx9_-abcdefghijklmno"/)
  assert.match(he.html, /&amp;do=cancel/)
  assert.match(he.html, /שינוי מועד/)
  assert.match(he.html, /calendar\.google\.com/)
  const en = clientEmail('moved', { ...b, lang: 'en', name: 'Dana Levi' }, { previous: { start: '2026-10-18T09:30:00Z', end: '2026-10-18T10:00:00Z' } })
  assert.match(en.subject, /^Your call has been rescheduled: Intro call/)
  assert.match(en.html, /Hello Dana,/)
  assert.match(en.html, /Previous time/)
  assert.match(en.html, /lang=en/)
  const gone = clientEmail('cancelled', b)
  assert.doesNotMatch(gone.html, /book\?m=/)
  assert.match(gone.html, /קביעת מועד חדש/)
})

test('WhatsApp texts: plural voice, no emoji, the private link', () => {
  const t = clientText('created', b, { firstName: 'אביה' })
  assert.match(t, /^היי אביה, תודה שקבעתם איתנו שיחה באפיק הנחל\./)
  assert.match(t, /קבענו שיחת היכרות ליום שני, 19 באוקטובר בשעה 12:30\./)
  assert.match(t, /נתקשר אליכם למספר 055-999-1052/)
  assert.match(t, /צריכים להזיז או לבטל\? https:\/\/www\.afikhanahal\.co\.il\/book\?m=/)
  assert.match(clientText('moved', b), /עדכנו את המועד/)
  assert.match(clientText('cancelled', b), /בוטלה/)
  assert.match(clientText('created', { ...b, lang: 'en' }, { firstName: 'Dana' }), /Need to move or cancel it\?/)
  for (const s of [t, clientText('moved', b), officeText('created', b, { calendar: 'none', leadNew: false }), officeText('moved', b, {}, { previous: b })]) {
    assert.doesNotMatch(s, EMOJI)
    assert.doesNotMatch(s, /אשמח|ראיתי|לך\b/)
  }
  assert.match(officeText('moved', b, {}, { previous: { start: '2026-10-18T09:30:00Z', end: '2026-10-18T10:00:00Z' } }), /המועד הקודם: יום ראשון/)
})
