import test from 'node:test'
import assert from 'node:assert/strict'
import { dictationMode, collectResults, joinText, liveText, polishedNote, fmtClock, dictationError, pickMime, micErrorCode, joinSegments, modesFor, voiceTaskItem } from './dictation.js'

const res = (...xs) => Object.assign(xs.map(([t, f]) => Object.assign([{ transcript: t }], { isFinal: f })), {})

test('mode per browser', () => {
  assert.deepEqual(dictationMode({}, 'Mozilla Firefox'), { supported: false })
  function R() {}
  const desk = dictationMode({ webkitSpeechRecognition: R }, 'Mozilla/5.0 (Windows NT 10.0) Chrome/130')
  assert.equal(desk.supported, true); assert.equal(desk.continuous, true); assert.equal(desk.Rec, R)
  const and = dictationMode({ SpeechRecognition: R }, 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile')
  assert.equal(and.continuous, false); assert.equal(and.android, true)
  assert.equal(dictationMode({ webkitSpeechRecognition: R }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari').ios, true)
})

test('results of a session: finals + what is still heard', () => {
  assert.deepEqual(collectResults(res(['דיברנו עם ', true], ['רונן היום', true], ['והוא ', false], ['מחפש', false])), { final: 'דיברנו עם רונן היום', interim: 'והוא מחפש' })
  assert.deepEqual(collectResults(null), { final: '', interim: '' })
})

test('joining text', () => {
  assert.equal(joinText('', 'שלום'), 'שלום')
  assert.equal(joinText('הערה קודמת.  ', 'חדש'), 'הערה קודמת. חדש')
  assert.equal(joinText('שורה\n', 'חדש'), 'שורה\nחדש')
  assert.equal(joinText('קיים', '  '), 'קיים')
  assert.equal(liveText('לפני', 'משפט ראשון', { final: 'שני', interim: 'שלי' }), 'לפני משפט ראשון שני שלי')
  assert.equal(liveText('', '', { final: '', interim: 'מתחיל' }), 'מתחיל')
})

test('polished note, clock and errors', () => {
  assert.equal(polishedNote({ text: 'טקסט מלא.', summary: '' }), 'טקסט מלא.')
  assert.equal(polishedNote({ text: 'טקסט מלא.', summary: 'בקצרה' }), 'סיכום: בקצרה\n\nטקסט מלא.')
  assert.equal(polishedNote({ text: 'Full.', summary: 'Gist' }, 'en'), 'Summary: Gist\n\nFull.')
  assert.equal(fmtClock(7), '0:07'); assert.equal(fmtClock(125), '2:05')
  assert.match(dictationError('not-allowed'), /מיקרופון/)
  assert.match(dictationError('unsupported', 'en'), /Chrome/)
  assert.match(dictationError('weird'), /נעצרה/)
})

test('recording format, mic errors, segments, modes', () => {
  assert.equal(pickMime(t => t === 'audio/mp4'), 'audio/mp4')                       // Safari
  assert.equal(pickMime(t => t.startsWith('audio/webm')), 'audio/webm;codecs=opus')  // Chrome
  assert.equal(pickMime(() => { throw new Error('x') }), '')
  assert.equal(micErrorCode({ name: 'NotAllowedError' }), 'not-allowed')
  assert.equal(micErrorCode({ name: 'NotFoundError' }), 'audio-capture')
  assert.equal(micErrorCode({ name: 'NotReadableError' }), 'busy')
  assert.equal(micErrorCode(null), 'unsupported')
  assert.equal(joinSegments([{ text: ' דיברנו ' }, { text: '' }, { text: 'עם רונן' }]), 'דיברנו עם רונן')
  assert.deepEqual(modesFor('task'), { modes: ['task'], def: 'task' })
  assert.equal(modesFor('call').def, 'call'); assert.equal(modesFor('note').def, 'exact'); assert.deepEqual(modesFor('property').modes, ['exact', 'smart'])
  assert.match(dictationError('offline'), /נשמרה/)
})

test('voice task → lead task', () => {
  const toIso = (d, hm) => `${d}T${hm}:00+02:00`
  const a = voiceTaskItem({ title: 'להתקשר לרונן', description: 'לגבי זרובבל 15', due: '2026-11-03T09:00', owner: 'יוגב' }, { now: 1, toIso, id: 'x' })
  assert.deepEqual(a, { id: 'x', text: 'להתקשר לרונן · לגבי זרובבל 15', done: false, createdAt: 1, by: 'voice', kind: 'followup', remind: true, due: '2026-11-03T09:00:00+02:00', owner: 'יוגב' })
  assert.equal(voiceTaskItem({ title: 'לבדוק', due: '2026-11-08' }, { toIso, id: 'y' }).due, '2026-11-08T10:00:00+02:00')
  const plain = voiceTaskItem({ title: 'לשלוח הצעת מחיר', due: '' }, { toIso, id: 'z' })
  assert.equal(plain.kind, 'task'); assert.equal(plain.due, undefined); assert.equal(plain.remind, false)
  assert.equal(voiceTaskItem({ title: ' ' }), null)
})
