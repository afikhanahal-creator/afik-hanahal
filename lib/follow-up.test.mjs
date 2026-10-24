import test from 'node:test'
import assert from 'node:assert/strict'
import { israelLocal, fromIsraelLocal, dueIso, describeDue, followUpPresets, addFollowUp, updateTasks, nextFollowUp, dueReminders, reminderKey, reminderText } from './follow-up.js'

test('Israel wall clock both ways, across daylight saving', () => {
  assert.equal(fromIsraelLocal('2026-10-20', '09:00'), '2026-10-20T06:00:00.000Z')   // summer, UTC+3
  assert.equal(fromIsraelLocal('2026-11-03', '09:00'), '2026-11-03T07:00:00.000Z')   // winter, UTC+2
  assert.equal(israelLocal('2026-11-03T07:00:00.000Z'), '2026-11-03T09:00')
  assert.equal(dueIso('2026-10-20T09:00'), '2026-10-20T06:00:00.000Z')                // the board's old local value
  assert.equal(dueIso('2026-10-20'), '2026-10-20T06:00:00.000Z')                      // a date alone = 09:00
  assert.equal(dueIso('2026-10-20T06:00:00.000Z'), '2026-10-20T06:00:00.000Z')
  assert.equal(dueIso(''), '')
})

test('when, in words', () => {
  const now = Date.parse('2026-10-20T10:00:00Z')   // Tuesday 13:00 in Israel
  assert.equal(describeDue('2026-10-20T13:00:00Z', { now }), 'היום 16:00')
  assert.equal(describeDue('2026-10-21T07:00:00Z', { now }), 'מחר 10:00')
  assert.equal(describeDue('2026-10-23T07:00:00Z', { now }), 'יום שישי 10:00')
  assert.equal(describeDue('2026-11-10T08:00:00Z', { now }), '10.11 10:00')
  assert.equal(describeDue('2026-10-21T07:00:00Z', { now, lang: 'en' }), 'Tomorrow 10:00')
})

test('quick picks skip Saturday and today 17:00 only while it is early', () => {
  const fri = Date.parse('2026-10-23T07:00:00Z')   // Friday 10:00
  const p = followUpPresets(fri)
  assert.equal(p.find(x => x.id === 'tom9').at, fromIsraelLocal('2026-10-25', '09:00'))   // Saturday → Sunday
  assert.ok(p.some(x => x.id === 'today17'))
  assert.ok(!followUpPresets(Date.parse('2026-10-20T15:00:00Z')).some(x => x.id === 'today17'))   // 18:00 already
  assert.equal(p[0].label, 'בעוד שעה')
})

test('a follow-up task moves the lead follow-up date and stays in step', () => {
  const lead = { id: 7, name: 'דנה כהן', tasks: [{ id: 'a', text: 'לשלוח מסמכים', due: '', done: false }] }
  const { task, patch } = addFollowUp(lead, { due: '2026-10-22T07:00:00.000Z', now: 1 })
  assert.equal(task.text, 'לחזור לדנה')
  assert.equal(task.kind, 'followup'); assert.equal(task.remind, true)
  assert.equal(patch.tasks.length, 2)
  assert.equal(patch.followUp, '2026-10-22T10:00')
  const second = addFollowUp({ ...lead, tasks: patch.tasks }, { text: 'שיחה שנייה', due: '2026-10-21T07:00:00.000Z' })
  assert.equal(second.patch.followUp, '2026-10-21T10:00')   // the earliest open one
  const done = second.patch.tasks.map(t => (t.id === second.task.id ? { ...t, done: true } : t))
  assert.deepEqual(updateTasks({ tasks: second.patch.tasks }, done), { tasks: done, followUp: '2026-10-22T10:00' })
  assert.deepEqual(updateTasks({ tasks: done }, []), { tasks: [], followUp: '' })
  assert.deepEqual(updateTasks({ tasks: [] }, [{ id: 'x', text: 'y', done: false }]), { tasks: [{ id: 'x', text: 'y', done: false }] })   // a plain task leaves followUp alone
  assert.equal(nextFollowUp([]), '')
  assert.equal(addFollowUp(lead, { due: '' }), null)
})

test('which reminders go out: due, not done, not sent, not too late', () => {
  const now = Date.parse('2026-10-20T10:00:00Z')
  const t = (id, due, extra = {}) => ({ id, text: 'x', due, done: false, remind: true, kind: 'followup', createdAt: Date.parse('2026-10-19T00:00:00Z'), ...extra })
  const rows = [{ id: 1, name: 'א', phone: '0501234567', tasks: [
    t('due', '2026-10-20T09:55:00Z'), t('later', '2026-10-20T11:00:00Z'), t('done', '2026-10-20T09:00:00Z', { done: true }),
    t('quiet', '2026-10-20T09:00:00Z', { remind: false }), t('old', '2026-10-18T09:00:00Z'), t('sent', '2026-10-20T08:00:00Z', { remindedAt: 'x' }),
    t('past', '2026-10-20T09:00:00Z', { createdAt: Date.parse('2026-10-20T09:30:00Z') }), t('failed', '2026-10-20T09:30:00Z'), t('given', '2026-10-20T09:40:00Z'),
  ] }]
  const failed = rows[0].tasks.find(x => x.id === 'failed'), given = rows[0].tasks.find(x => x.id === 'given')
  const sent = { [reminderKey(1, failed)]: { tries: 1 }, [reminderKey(1, given)]: { tries: 3 } }
  assert.deepEqual(dueReminders(rows, sent, now).map(x => x.task.id), ['failed', 'due'])
  assert.deepEqual(dueReminders(rows, { ...sent, [reminderKey(1, failed)]: { ok: true, tries: 1 } }, now).map(x => x.task.id), ['due'])
  // moving the task gives it a new key, so the moved reminder goes out again
  assert.notEqual(reminderKey(1, t('a', '2026-10-20T09:00:00Z')), reminderKey(1, t('a', '2026-10-21T09:00:00Z')))
})

test('the reminder text: name, task, phone, when, links', () => {
  const now = Date.parse('2026-10-20T10:00:00Z')
  const s = reminderText({ id: 42, name: 'יוגב קידר', phone: '0543049491', campaign: 'זרובבל 15' }, { text: 'לשלוח הצעת מחיר', due: '2026-10-20T10:00:00Z' }, { now })
  assert.match(s, /^\*תזכורת: לחזור ליוגב קידר\*/)
  assert.match(s, /לשלוח הצעת מחיר/)
  assert.match(s, /על: זרובבל 15/)
  assert.match(s, /טלפון: 054-304-9491/)
  assert.match(s, /נקבע להיום 13:00/)
  assert.match(s, /https:\/\/wa\.me\/972543049491/)
  assert.match(s, /admin-panel\/leads\?lead=42/)
  assert.ok(!reminderText({ id: 1, name: 'דנה' }, { text: 'לחזור לדנה', due: '2026-10-20T10:00:00Z' }, { now }).includes('\nלחזור לדנה'))   // the default text isn't repeated
})

test('moving the next follow-up from the details field', async () => {
  const { setNextFollowUp } = await import('./follow-up.js')
  const a = setNextFollowUp({ name: 'רון', tasks: [] }, '2026-10-22T07:00:00.000Z')
  assert.equal(a.tasks.length, 1); assert.equal(a.tasks[0].remind, true); assert.equal(a.followUp, '2026-10-22T10:00')
  const moved = setNextFollowUp({ tasks: [{ ...a.tasks[0], remindedAt: 'x' }] }, '2026-10-23T07:00')
  assert.equal(moved.tasks.length, 1); assert.equal(moved.tasks[0].due, '2026-10-23T04:00:00.000Z'); assert.equal(moved.tasks[0].remindedAt, null)
  const plain = { id: 'p', text: 'מסמכים', done: false }
  assert.deepEqual(setNextFollowUp({ tasks: [plain, ...moved.tasks] }, ''), { tasks: [plain], followUp: '' })
})

test('a plain task reminds too, with what the lead looks for and the card link', () => {
  const now = Date.parse('2026-10-20T10:05:00Z')
  const lead = { id: 7, name: 'דנה בן כחיל', phone: '0586622442', campaign: 'זרובבל 15', needs: '3 חדרים, בתקציב של 3–4 מיליון', tasks: [{ id: 't1', text: 'לשלוח תשריט', due: '2026-10-20T10:00:00Z', kind: 'task', remind: true, createdAt: now - 864e5 }] }
  assert.deepEqual(dueReminders([lead], {}, now).map(x => x.task.id), ['t1'])
  const s = reminderText(lead, lead.tasks[0], { now })
  assert.match(s, /^\*תזכורת למשימה: דנה בן כחיל\*/)
  assert.match(s, /משימה: לשלוח תשריט/)
  assert.match(s, /על: זרובבל 15/)
  assert.match(s, /מחפשים: 3 חדרים/)
  assert.match(s, /טלפון: 058-662-2442/)
  assert.match(s, /admin-panel\/leads\?lead=7/)
})
