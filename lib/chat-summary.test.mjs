import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeChat, chatTranscript, normalizeSummary, summarizeChat, SUMMARY_SCHEMA } from './chat-summary.js'

const raw = [
  { type: 'incoming', typeMessage: 'textMessage', textMessage: 'היי, מעוניין במגרש בזרובבל 15', timestamp: 1760700000 },
  { type: 'outgoing', typeMessage: 'extendedTextMessage', extendedTextMessage: { text: 'היי רונן, ישראל מאפיק הנחל' }, timestamp: 1760690000 },
  { type: 'incoming', typeMessage: 'audioMessage', timestamp: 1760710000 },
  { type: 'incoming', typeMessage: 'imageMessage', caption: 'זה התשריט?', timestamp: 1760720000 },
  { type: 'incoming', typeMessage: 'reactionMessage', timestamp: 1760730000, textMessage: '' },
]

test('normalizeChat: Green messages → oldest first, media marked, voice notes counted as media', () => {
  const m = normalizeChat(raw)
  assert.deepEqual(m.map(x => x.dir), ['out', 'in', 'in', 'in', 'in'])
  assert.equal(m[0].text, 'היי רונן, ישראל מאפיק הנחל')
  assert.equal(m[2].media, 'הודעה קולית (לא תומללה)')
  assert.equal(m[3].text, 'זה התשריט?'); assert.equal(m[3].media, 'תמונה')
  // the server's chatHistory() shape ('[audioMessage]' markers) reads the same
  const fromHistory = normalizeChat([{ dir: 'in', text: '[audioMessage]', ts: 2 }, { dir: 'out', text: 'שלום', ts: 1 }])
  assert.deepEqual(fromHistory, [{ dir: 'out', text: 'שלום', ts: 1, media: '' }, { dir: 'in', text: '', ts: 2, media: 'הודעה קולית (לא תומללה)' }])
})

test('chatTranscript: who said what, the lead context, long chats keep the newest messages', () => {
  const t = chatTranscript(normalizeChat(raw), { name: 'רונן', prop_title: 'זרובבל 15', leadStatus: 'contacted' })
  assert.match(t, /ליד: רונן/); assert.match(t, /התעניין ב: זרובבל 15/); assert.match(t, /שלב נוכחי: contacted/)
  assert.match(t, /המשרד: היי רונן/); assert.match(t, /הליד: \[הודעה קולית \(לא תומללה\)\]/)
  const many = Array.from({ length: 400 }, (_, i) => ({ dir: i % 2 ? 'in' : 'out', text: `הודעה ${i} ${'א'.repeat(150)}`, ts: i * 1000, media: '' }))
  const long = chatTranscript(many)
  assert.ok(long.length < 26000)
  assert.match(long, /הודעה 399/); assert.doesNotMatch(long, /הודעה 10 /)
})

test('normalizeSummary keeps the answer inside the schema and the UI limits', () => {
  const n = normalizeSummary({ summary: ' סיכום ', topics: ['א', '', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז'], suggestedStage: 'bogus', followUpDays: 999, temperature: 'lukewarm' })
  assert.equal(n.summary, 'סיכום'); assert.deepEqual(n.topics, ['א', 'ב', 'ג', 'ד', 'ה', 'ו'])
  assert.equal(n.suggestedStage, null); assert.equal(n.followUpDays, 180); assert.equal(n.temperature, 'warm'); assert.equal(n.lastWord, 'none')
  assert.equal(normalizeSummary({ followUpDays: 2.5 }).followUpDays, -1)
  assert.deepEqual(SUMMARY_SCHEMA.required.slice().sort(), Object.keys(SUMMARY_SCHEMA.properties).sort())
})

test('summarizeChat: no phone, no conversation, no key — clear answers, no call', async () => {
  assert.equal((await summarizeChat({})).code, 'no_phone')
  assert.equal((await summarizeChat({ phone: '0547577877' }, { history: [] })).code, 'empty')
  const saved = process.env.ANTHROPIC_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  assert.equal((await summarizeChat({ phone: '0547577877' }, { history: raw })).code, 'no_key')
  if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved
})
