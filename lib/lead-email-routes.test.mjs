import test from 'node:test'
import assert from 'node:assert/strict'
import { normCampaign, parseEmails, cleanEmailRoutes, routeRecipients, maskEmail } from './lead-email-routes.js'

const R = [{ id: 'h', match: 'הנרייטה סאלד', to: ['partner@example.com'] }]

test('a campaign name is matched however Meta wrote it', () => {
  assert.equal(normCampaign('הנרייטה סאלד 3#'), 'הנרייטה סאלד 3')
  assert.equal(normCampaign('‎"הנרייטה  סאלד" - 4 (כוונה)'), 'הנרייטה סאלד 4 כוונה')
  for (const c of ['הנרייטה סאלד 4', 'הנרייטה סאלד 3#', 'הנרייטה סאלד - v2 (כוונה גבוהה)', 'קמפיין הנרייטה סאלד חדש'])
    assert.deepEqual(routeRecipients(R, { campaign: c }), ['partner@example.com'], c)
})

test('other campaigns get nothing; the form name and the office\'s own name for the campaign count too', () => {
  assert.deepEqual(routeRecipients(R, { campaign: 'זרובבל 15 - 2#' }), [])
  assert.deepEqual(routeRecipients(R, { campaign: '', form: 'טופס הנרייטה סאלד' }), ['partner@example.com'])
  assert.deepEqual(routeRecipients(R, { campaign: 'Leads 2026', label: 'הנרייטה סאלד' }), ['partner@example.com'])
  assert.deepEqual(routeRecipients(R, {}), [])
})

test('the office\'s own address is never repeated; several routes merge without duplicates; a route can be switched off', () => {
  const routes = [...R, { id: 'all', match: 'סאלד', to: ['partner@example.com', 'b@example.org'] }, { id: 'off', match: 'הנרייטה', to: ['c@example.org'], on: false }]
  assert.deepEqual(routeRecipients(routes, { campaign: 'הנרייטה סאלד 4' }, ['B@example.org']), ['partner@example.com'])
  assert.deepEqual(routeRecipients(routes, { campaign: 'הנרייטה סאלד 4' }), ['partner@example.com', 'b@example.org'])
})

test('addresses are cleaned: typed with commas / spaces, case, junk and repeats', () => {
  assert.deepEqual(parseEmails(' A@Example.com, a@example.com;b@x.co\nnot-an-email, <x@y>'), ['a@example.com', 'b@x.co'])
  assert.deepEqual(cleanEmailRoutes([{ match: 'x', to: 'nope' }, { match: '', to: 'a@b.co' }, null, { match: 'הנרייטה סאלד', to: 'a@b.co' }]).map(r => r.to), [['a@b.co']])
  assert.equal(maskEmail('partner@example.com'), 'pa…@example.com')
})
