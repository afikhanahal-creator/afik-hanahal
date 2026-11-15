import { test } from 'node:test'
import assert from 'node:assert/strict'
import { statusForStage, stageForStatus, needsStagePick } from './lead-status-sync.js'

test('every pipeline stage has a status chip', () => {
  assert.equal(statusForStage('new'), 'new')
  for (const s of ['contacted', 'discovery', 'lost', 'nurture']) assert.equal(statusForStage(s), 'contacted', s)
  for (const s of ['meeting', 'negotiating']) assert.equal(statusForStage(s), 'scheduled', s)
  for (const s of ['won', 'irrelevant']) assert.equal(statusForStage(s), 'closed', s)
  assert.equal(statusForStage('something-else'), null)
})

test('"נוצר קשר" on a lead marked not relevant moves it to contacted (the case in the screenshot)', () => {
  assert.equal(stageForStatus('contacted', 'irrelevant'), 'contacted')
  assert.equal(stageForStatus('contacted', 'new'), 'contacted')
  assert.equal(stageForStatus('contacted', undefined), 'contacted')
})

test('a chip never pulls a lead backwards: a stage that already says it stays', () => {
  assert.equal(stageForStatus('contacted', 'discovery'), null)   // מתעניין is past "contacted"
  assert.equal(stageForStatus('contacted', 'contacted'), null)
  assert.equal(stageForStatus('scheduled', 'negotiating'), null)  // במו"מ is past "meeting"
  assert.equal(stageForStatus('new', 'new'), null)
})

test('"נקבעה שיחה" → a meeting; "חדש" → new lead', () => {
  assert.equal(stageForStatus('scheduled', 'discovery'), 'meeting')
  assert.equal(stageForStatus('scheduled', 'new'), 'meeting')
  assert.equal(stageForStatus('new', 'contacted'), 'new')
})

test('"סגור" moves nothing by itself, it asks for the stage', () => {
  assert.equal(stageForStatus('closed', 'contacted'), null)
  assert.equal(needsStagePick('closed', 'contacted'), true)
  assert.equal(needsStagePick('closed', 'won'), false)
  assert.equal(needsStagePick('closed', 'irrelevant'), false)
  assert.equal(needsStagePick('contacted', 'new'), false)
})

test('both directions agree: the stage a chip picks maps back to that chip', () => {
  for (const status of ['new', 'contacted', 'scheduled']) {
    for (const cur of ['new', 'contacted', 'discovery', 'meeting', 'negotiating', 'won', 'lost', 'irrelevant', 'nurture']) {
      const to = stageForStatus(status, cur)
      assert.equal(statusForStage(to || cur), status, `${status} from ${cur}`)
    }
  }
})
