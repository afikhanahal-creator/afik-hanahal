import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCallbackTime, detectCallback, askedForTime, aiDue, callbackTaskText, callbackNotice, notifyNumbers, whenText } from './callback-time.js'
import { israelLocal } from './follow-up.js'

// Israel wall clock → ms (November = UTC+2)
const at = (d, t) => Date.parse(`${d}T${t}:00+02:00`)
const local = r => (r ? israelLocal(r.due) : null)
const ask = text => ({ text, at: null })

test('the screenshots: a reply to "when?" becomes a task at the time the lead named', () => {
  // "היי זוהר… מתי זה זמן נוח לדבר?" → "בשעות הצהריים" at 08:07 → today 13:00
  assert.equal(local(detectCallback({ text: 'בשעות הצהריים', prevOut: ask('היי זוהר, קיבלנו את הפרטים על זרובבל 15.\nמתי זה זמן נוח לדבר?'), now: at('2026-11-03', '08:07') })), '2026-11-03T13:00')
  // "מחר בבוקר 9:00" at 21:41 → tomorrow 09:00, clear on its own
  const r = detectCallback({ text: 'מחר בבוקר 9:00', now: at('2026-11-02', '21:41') })
  assert.equal(local(r), '2026-11-03T09:00'); assert.equal(r.why, 'clear')
  // "מחר ב4" at 20:00 → tomorrow 16:00
  assert.equal(local(detectCallback({ text: 'מחר ב4', now: at('2026-11-01', '20:00') })), '2026-11-02T16:00')
  // "אחלה" / "נדבר בבוקר" from our side are not the lead's; "אחלה" from them is no time
  assert.equal(detectCallback({ text: 'אחלה', prevOut: ask('מתי נוח?'), now: at('2026-11-03', '08:00') }), null)
})

test('hours, parts of the day, words and relative times', () => {
  const now = at('2026-11-03', '10:00')   // Tuesday
  const q = ask('מתי נוח לכם שנתקשר?')
  const d = text => local(detectCallback({ text, prevOut: q, now }))
  assert.equal(d('אחרי שלוש'), '2026-11-03T15:00')
  assert.equal(d('ב 8 בערב'), '2026-11-03T20:00')
  assert.equal(d('שמונה וחצי בערב'), '2026-11-03T20:30')
  assert.equal(d('בארבע ורבע'), '2026-11-03T16:15')
  assert.equal(d('ב10 בבוקר'), '2026-11-04T10:00')          // 10:00 already passed → tomorrow
  assert.equal(d('בשעה 12:30'), '2026-11-03T12:30')
  assert.equal(d('בעוד שעה'), '2026-11-03T11:00')
  assert.equal(d('עוד 20 דקות'), '2026-11-03T10:20')
  assert.equal(d('אפשר עכשיו'), '2026-11-03T10:05')
  assert.equal(d('מחר'), '2026-11-04T10:00')
  assert.equal(d('מחרתיים אחה"צ'), '2026-11-05T16:00')
  assert.equal(d('ביום חמישי בערב'), '2026-11-05T19:00')
  assert.equal(d('בשבוע הבא'), '2026-11-08T10:00')
  assert.equal(d('בוקר טוב, מחר ב4 נוח'), '2026-11-04T16:00')   // "בוקר טוב" is a greeting, not the morning
  assert.equal(d('בשישי ב-12'), '2026-11-06T12:00')
})

test('Saturday moves to Sunday, and a time that passed today moves on', () => {
  const fri = at('2026-11-06', '15:00')
  assert.equal(local(detectCallback({ text: 'מחר ב5', now: fri })), '2026-11-08T17:00')
  // "ב4" at 17:30 with no day → tomorrow 16:00
  assert.equal(local(detectCallback({ text: 'ב4', prevOut: ask('מתי נוח לדבר?'), now: at('2026-11-03', '17:30') })), '2026-11-04T16:00')
  // "ב9" at 10:00 → tonight 21:00
  assert.equal(local(detectCallback({ text: 'ב9', prevOut: ask('מתי נוח לדבר?'), now: at('2026-11-03', '10:00') })), '2026-11-03T21:00')
})

test('no task for refusals, numbers that are not hours, or a weak hint without a question', () => {
  const q = ask('מתי נוח לדבר?')
  const now = at('2026-11-03', '10:00')
  for (const text of ['לא תודה', 'לא מעוניין', 'תסירו אותי', 'לא זמין מחר', '3-4 מיליון', 'יש לנו 2 ילדים', 'בשני חדרים', 'ב4 חדרים', 'אחלה', 'תודה רבה'])
    assert.equal(detectCallback({ text, prevOut: q, now }), null, text)
  // a weak hint ("בצהריים") with no question from us and no call word
  assert.equal(detectCallback({ text: 'אני בעבודה בצהריים', prevOut: ask('שלחנו את התוכניות'), now }), null)
  // …but with a call word it counts
  assert.equal(local(detectCallback({ text: 'תתקשרו בצהריים', now })), '2026-11-03T13:00')
  // an old question (over 3 days) doesn't make a weak hint count
  assert.equal(detectCallback({ text: 'בצהריים', prevOut: { text: 'מתי נוח לדבר?', at: new Date(now - 4 * 864e5).toISOString() }, now }), null)
})

test('our question about timing', () => {
  assert.ok(askedForTime('היי ישי, קיבלנו את הפרטים על זרובבל 15.\nמתי זה זמן נוח לדבר?'))
  assert.ok(askedForTime('נוח שנתקשר היום?'))
  assert.equal(askedForTime('שלחנו את התוכניות'), false)
  assert.equal(askedForTime('מתי נוח'), false)   // no question mark
})

test("Claude's reading is taken only when sure, in the future and in reasonable hours", () => {
  const now = at('2026-11-03', '10:00')
  assert.equal(israelLocal(aiDue({ callback: true, date: '2026-11-03', time: '17:30', confidence: 'high' }, now)), '2026-11-03T17:30')
  assert.equal(israelLocal(aiDue({ callback: true, date: '2026-11-07', time: '11:00', confidence: 'medium' }, now)), '2026-11-08T11:00')   // Saturday
  assert.equal(aiDue({ callback: true, date: '2026-11-03', time: '17:30', confidence: 'low' }, now), null)
  assert.equal(aiDue({ callback: false, date: '2026-11-03', time: '17:30', confidence: 'high' }, now), null)
  assert.equal(aiDue({ callback: true, date: '2026-11-03', time: '03:00', confidence: 'high' }, now), null)
  assert.equal(aiDue({ callback: true, date: '2026-12-30', time: '10:00', confidence: 'high' }, now), null)
  assert.equal(aiDue({ callback: true, date: 'tomorrow', time: '10:00', confidence: 'high' }, now), null)
})

test('the task text, the notice and the numbers', () => {
  const lead = { id: 77, name: 'זוהר כהן', phone: '0521234567' }
  assert.equal(callbackTaskText(lead, 'בשעות הצהריים'), 'לחזור לזוהר — ביקשו בוואטסאפ: "בשעות הצהריים"')
  const now = at('2026-11-03', '08:07')
  const n = callbackNotice(lead, { due: new Date(at('2026-11-03', '13:00')).toISOString(), quote: 'בשעות הצהריים', project: 'זרובבל 15', now })
  assert.match(n, /^\*משימה חדשה: לחזור לזוהר כהן היום 13:00\*/)
  assert.match(n, /טלפון: 052-123-4567/)
  assert.match(n, /wa\.me\/972521234567/)
  assert.match(n, /admin-panel\/leads\?lead=77/)
  assert.match(callbackNotice(lead, { due: new Date(at('2026-11-04', '16:00')).toISOString(), quote: 'x', now, moved: true }), /^\*המשימה עודכנה: לחזור לזוהר כהן מחר 16:00\*/)
  assert.equal(whenText(new Date(at('2026-11-05', '19:00')).toISOString(), now), 'יום חמישי 19:00')
  assert.deepEqual(notifyNumbers('054-304-9491, 0543049491; +972 55 981 1814, 123'), ['972543049491', '972559811814'])
})

test('"שלישי שבוע הבא": next week\'s Tuesday (the lead on holiday, 2026-11-03), and a bare weekday only when it is clearly a day', () => {
  // written on Tuesday 3.11 20:09 → Tuesday 10.11 10:00; "נדבר" is a call word, so it counts on its own
  const r = detectCallback({ text: 'בחופשה נדבר שאחזור🙏🏼 שלישי שבוע הבא', now: at('2026-11-03', '20:09') })
  assert.equal(local(r), '2026-11-10T10:00'); assert.equal(r.why, 'clear')
  assert.equal(local(detectCallback({ text: 'ביום שלישי בשבוע הבא', prevOut: ask('מתי נוח לדבר?'), now: at('2026-11-02', '09:00') })), '2026-11-10T10:00')   // Monday: not tomorrow (a day alone answers our question)
  assert.equal(local(detectCallback({ text: 'ביום שני שבוע הבא בבוקר', now: at('2026-11-01', '09:00') })), '2026-11-09T10:00')   // Sunday
  assert.equal(local(detectCallback({ text: 'נדבר שבוע הבא', now: at('2026-11-03', '20:09') })), '2026-11-08T10:00')   // next Sunday
  assert.equal(local(detectCallback({ text: 'תתקשרו חמישי', now: at('2026-11-03', '20:09') })), '2026-11-05T10:00')
  assert.equal(detectCallback({ text: 'שני חדרים', now: at('2026-11-03', '20:09') }), null)
  assert.equal(detectCallback({ text: 'שני', now: at('2026-11-03', '20:09') }), null)
  assert.equal(detectCallback({ text: 'שלישי', now: at('2026-11-03', '20:09') }), null)   // a bare day with nothing else
})
