import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBudget, extractSignals, scoreLead, phoneInfo, legacyScore } from './lead-intel.js'

const NOW = Date.parse('2026-09-23T10:00:00Z')

test('parseBudget reads Hebrew / English amounts and ignores phone numbers', () => {
  assert.equal(parseBudget('תקציב של 2.5 מיליון'), 2.5e6)
  assert.equal(parseBudget('עד ₪1,800,000'), 1.8e6)
  assert.equal(parseBudget('around 1.2M'), 1.2e6)
  assert.equal(parseBudget('800 אלף הון עצמי'), 8e5)
  assert.equal(parseBudget('תתקשרו 0545433232'), null)
  assert.equal(parseBudget('972545433232'), null)
  assert.equal(parseBudget('3 חדרים בקומה 2'), null)
})

test('extractSignals finds deal type, urgency, financing, visit', () => {
  const s = extractSignals({ msg: 'מחפשים לקנות דירת 4 חדרים בהוד השרון, יש אישור עקרוני למשכנתא, דחוף, אפשר לראות השבוע?' })
  assert.equal(s.dealType, 'buy'); assert.equal(s.timeline, 'now'); assert.equal(s.financing, 'mortgage'); assert.ok(s.wantsVisit); assert.ok(s.asksQuestion)
  assert.equal(extractSignals({ msg: 'רוצה למכור את הבית, הערכת שווי' }).dealType, 'sell')
})

test('phoneInfo', () => {
  assert.equal(phoneInfo('+972-54-543-3232').mobile, true)
  assert.equal(phoneInfo('09-7654321').valid, true)
  assert.equal(phoneInfo('12345').valid, false)
})

test('hot lead: specific, urgent, engaged, budget fits the listing', () => {
  const r = scoreLead({
    now: NOW,
    lead: { name: 'דנה כהן', phone: '0501112222', email: 'dana@x.co.il', msg: 'שלום, מעוניינת במגרש בתל מונד, תקציב 2.4 מיליון במזומן, רוצה לראות השבוע', propTitle: 'מגרש בתל מונד', ts: NOW - 3 * 3600e3, leadStatus: 'contacted' },
    chat: [{ dir: 'out', text: 'היי דנה', ts: NOW - 2 * 3600e3 }, { dir: 'in', text: 'כן אשמח, מתי אפשר?', ts: NOW - 1.5 * 3600e3 }, { dir: 'in', text: 'גם מחר מתאים', ts: NOW - 3600e3 }],
    property: { title: 'מגרש בתל מונד', price: '2,500,000' },
  })
  assert.ok(r.score >= 75, `score ${r.score}`); assert.equal(r.grade, 'hot'); assert.equal(r.next.key, 'call_now')
  assert.ok(r.factors.some(f => f.key === 'budget_fits')); assert.ok(r.factors.some(f => f.key === 'fast_reply'))
  assert.equal(legacyScore(r.score), 5)
})

test('cold lead: vague, silent, stale, invalid phone', () => {
  const r = scoreLead({ now: NOW, lead: { name: 'x', phone: '123', msg: '', ts: NOW - 60 * 864e5, source: 'meta' }, chat: [{ dir: 'out', text: 'a', ts: NOW - 50 * 864e5 }, { dir: 'out', text: 'b', ts: NOW - 45 * 864e5 }] })
  assert.ok(r.score < 30, `score ${r.score}`); assert.equal(r.grade, 'cold')
  assert.ok(r.missing.some(m => m.key === 'budget'))
})

test('negative reply sinks the score and recommends closing', () => {
  const r = scoreLead({ now: NOW, lead: { name: 'יוסי לוי', phone: '0521234567', msg: 'מעוניין בדירה', ts: NOW - 864e5 }, chat: [{ dir: 'out', text: 'היי', ts: NOW - 5e6 }, { dir: 'in', text: 'לא מעוניין תודה', ts: NOW - 4e6 }] })
  assert.equal(r.signals.intent, 'negative'); assert.equal(r.next.key, 'close'); assert.ok(r.score < 30)
})

test('budget far below the price is flagged', () => {
  const r = scoreLead({ now: NOW, lead: { name: 'a b', phone: '0501234567', msg: 'תקציב 900 אלף', ts: NOW }, property: { title: 'וילה', price: '4500000' } })
  assert.ok(r.factors.some(f => f.key === 'budget_low'))
})
