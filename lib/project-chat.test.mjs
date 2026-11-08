import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectKeys, projectsInText, projectFromChat, chatProjectDecision, chatProjectPatch, manualProject, normText } from './project-chat.js'

const P = [
  { id: 'p_zrb', name: 'זרובבל 15', aliases: ['זרובבל 15'], status: 'active' },
  { id: 'p_s22', name: 'הנרייטה סאלד 22-24', aliases: [], status: 'active' },
  { id: 'p_s4', name: 'הנרייטה סאלד 4', aliases: [], status: 'active' },
  { id: 'p_s3', name: 'הנרייטה סאלד 3#', aliases: [], status: 'active' },
  { id: 'p_hk', name: 'חנקין 41', aliases: [], status: 'active' },
  { id: 'p_pk', name: 'פיקוח בניה 1', aliases: [], status: 'active' },
  { id: 'p_bg', name: 'בן גוריון 17 יהוד-מונסון', aliases: [], status: 'active' },
  { id: 'p_rm', name: 'רמחל 6-8 רעננה', aliases: [], status: 'active' },
  { id: 'p_old', name: 'הנשר 9 כפר סבא', aliases: [], status: 'archived' },
]
const keys = projectKeys(P)
const ids = t => [...projectsInText(t, keys)].sort()

test('normText drops quotes and punctuation', () => {
  assert.equal(normText('רמח"ל 6-8, רעננה!'), 'רמחל 6 8 רעננה')
})

test('projectsInText: the street, its number, prefixes, quotes', () => {
  assert.deepEqual(ids('ראינו את הפנייה על זרובבל 15.'), ['p_zrb'])
  assert.deepEqual(ids('מה המחיר בזרובבל?'), ['p_zrb'])                 // a unique street needs no number
  assert.deepEqual(ids('יש משהו בזרובבל 7?'), [])                       // another building on the same street
  assert.deepEqual(ids('מעניין אותי הנרייטה סאלד 4'), ['p_s4'])
  assert.deepEqual(ids('ומה עם סאלד 22?'), [])                          // "סאלד" alone isn't the street "הנרייטה סאלד"
  assert.deepEqual(ids('הנרייטה סאלד 24 נשמע טוב'), ['p_s22'])
  assert.deepEqual(ids('בהנרייטה סאלד יש עוד דירות?'), [])              // three projects on that street: needs a number
  assert.deepEqual(ids('הפרויקט ברמח"ל 6 ברעננה'), ['p_rm'])
  assert.deepEqual(ids('פיקוח בניה זה חשוב'), [])                       // a campaign name, not a place
  assert.deepEqual(ids('בבן גוריון 17 ביהוד'), ['p_bg'])
  assert.deepEqual(ids('הנשר 9 בכפר סבא'), [])                          // archived
  assert.deepEqual(ids('חנקינה'), [])                                   // a longer word is not the street
})

test('projectFromChat: the lead\'s words weigh most; a clear winner only', () => {
  const chat = [
    { direction: 'out', by_api: true, body: 'היי, ראינו את הפנייה על זרובבל 15' },
    { direction: 'in', body: 'האמת שמעניין אותי יותר חנקין 41' },
    { direction: 'out', by_api: false, body: 'בשמחה, שולחים תוכניות של חנקין 41' },
  ]
  const r = projectFromChat(chat, P)
  assert.equal(r.id, 'p_hk')
  assert.equal(r.score, 5)
  assert.match(r.quote, /חנקין/)
  assert.equal(projectFromChat([{ direction: 'out', by_api: true, body: 'זרובבל 15' }], P), null)   // one automatic mention isn't enough
  assert.equal(projectFromChat([{ direction: 'in', body: 'זרובבל 15 או חנקין 41?' }], P), null)      // a tie
  assert.equal(projectFromChat([], P), null)
})

test('chatProjectDecision: no project → the chat\'s; a hand-picked one is never touched', () => {
  const chat = [{ direction: 'in', body: 'מה עם חנקין 41?' }, { direction: 'out', by_api: false, body: 'חנקין 41 — שולחים' }]
  const lead = { id: 1, crm_data: {} }
  assert.equal(chatProjectDecision(lead, chat, P).project.id, 'p_hk')
  assert.equal(chatProjectDecision({ id: 1, crm_data: { projectId: 'p_zrb' } }, chat, P), null)            // by hand
  assert.equal(chatProjectDecision({ id: 1, crm_data: { projectId: '__none' } }, chat, P), null)           // taken out by hand
  assert.equal(manualProject({ crm_data: { projectId: 'p_hk', projectChat: { id: 'p_hk' } } }), false)      // ours, from a chat
})

test('chatProjectDecision: a campaign lead whose conversation moved to another project', () => {
  const lead = { id: 2, source: 'meta', prop_title: 'זרובבל 15 - v2 (כוונה גבוהה)', crm_data: {} }
  const moved = [
    { direction: 'out', by_api: true, body: 'היי, ראינו את הפנייה על זרובבל 15' },
    { direction: 'in', body: 'זרובבל פחות מתאים, יש משהו בבן גוריון 17 ביהוד?' },
    { direction: 'in', body: 'כן, בן גוריון 17 מעניין אותי' },
    { direction: 'out', by_api: false, body: 'שולחים פרטים על בן גוריון 17' },
  ]
  const d = chatProjectDecision(lead, moved, P)
  assert.equal(d.project.id, 'p_bg')                       // 8 points against zrb's 4
  assert.equal(d.from, 'זרובבל 15')
  // both still in the conversation: the campaign's project stays
  const both = [moved[0], { direction: 'in', body: 'זרובבל 15 מעניין, וגם בן גוריון 17' }, { direction: 'in', body: 'בן גוריון 17 זה מה שאני מחפש' }]
  assert.equal(chatProjectDecision(lead, both, P), null)
  // its own campaign's project needs no change
  assert.equal(chatProjectDecision(lead, [{ direction: 'in', body: 'זרובבל 15 מעניין' }], P), null)
})

test('chatProjectPatch: the project, its source and a note on the lead', () => {
  const lead = { id: 3, crm_data: { notes: [{ id: 'a', text: 'x', ts: 1 }] } }
  const p = chatProjectPatch(lead, { project: P[4], quote: 'מה עם חנקין 41?', from: '' }, new Date('2026-11-08T10:00:00Z'))
  assert.equal(p.projectId, 'p_hk')
  assert.equal(p.projectName, 'חנקין 41')
  assert.equal(p.projectChat.id, 'p_hk')
  assert.equal(p.notes.length, 2)
  assert.match(p.notes[0].text, /שויך לפרויקט חנקין 41 לפי השיחה בוואטסאפ/)
  assert.equal(manualProject({ crm_data: p }), false)
})
