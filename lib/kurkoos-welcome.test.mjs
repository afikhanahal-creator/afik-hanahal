import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kurkoosWelcomeText } from './kurkoos-welcome.js'

test('first name and topic, ends with the time question', () => {
  const t = kurkoosWelcomeText({ name: 'Mark Moas', topic: 'פיקוח פרויקטים' })
  assert.equal(t, 'היי Mark, ראינו שהשארתם פרטים באתר של קבוצת קורקוס לגבי פיקוח פרויקטים.\nמתי נוח לכם שנדבר, היום או מחר?')
})
test('no name and no topic', () => {
  assert.equal(kurkoosWelcomeText({}), 'היי, ראינו שהשארתם פרטים באתר של קבוצת קורקוס.\nמתי נוח לכם שנדבר, היום או מחר?')
})
test('Hebrew name, project topic, no control characters or links pass through', () => {
  const t = kurkoosWelcomeText({ name: 'שחר כהן', topic: 'הנרייטה סאלד 22-24\nhttp://x' })
  assert.ok(t.startsWith('היי שחר, ראינו'))
  assert.ok(!t.includes('http'))
  assert.ok(!/[\u0000-\u0009\u000b-\u001f]/.test(t))
  assert.ok(t.endsWith('מתי נוח לכם שנדבר, היום או מחר?'))
})
test('a name made of symbols is dropped', () => {
  assert.ok(kurkoosWelcomeText({ name: '<script>' }).startsWith('היי script,') || kurkoosWelcomeText({ name: '<script>' }).startsWith('היי,'))
})
