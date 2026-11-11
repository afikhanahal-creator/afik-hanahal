import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normText, soundKey, phoneDigits, oneTypo, leadFields, matchLead, searchIndex, searchLeads } from './leadSearch.js'

// fictional people only — the repository is public
const LEADS = [
  { id: 1, name: 'אל רועי ישראלי', phone: '052-801-7218', email: 'roy@example.com', projectName: 'זרובבל 15', ts: '2026-11-01T10:00:00Z' },
  { id: 2, name: 'רונן כהן', originalName: 'Ronen Cohen', phone: '+972 54-123-4567', propTitle: 'הנרייטה סאלד 22', ts: '2026-11-02T10:00:00Z' },
  { id: 3, name: 'אריאל לוי', phone: '0501112233', ts: '2026-11-03T10:00:00Z' },
  { id: 4, name: 'דנה אלרואי', phone: '0509998877', ts: '2026-11-04T10:00:00Z' },
  { id: 5, name: 'רועי מזרחי', phone: '0507776655', projectName: 'בן גוריון 17', ts: '2026-11-05T10:00:00Z' },
  { id: 6, name: 'יעקב ("קובי") בן-דוד', phone: '0523334455', ts: '2026-11-06T10:00:00Z' },
]
const IDX = searchIndex(LEADS)
const ids = (q, part = 'all') => searchLeads(IDX, q)[part].map(l => l.id)

test('normText: quotes, hyphens, final letters and case', () => {
  assert.equal(normText('  יעקב ("קובי") בן-דוד '), 'יעקב קובי בנ דוד')
  assert.equal(normText('Ronen  COHEN'), 'ronen cohen')
  assert.equal(normText('רמח"ל'), 'רמחל')
})

test('phoneDigits: every way a number is typed is the same local number', () => {
  for (const p of ['052-801-7218', '0528017218', '+972 52 801 7218', '972528017218', '00972-52-8017218']) assert.equal(phoneDigits(p), '0528017218')
  assert.equal(phoneDigits('7218'), '7218')
})

test('oneTypo: a changed, missing, added or swapped letter — not more', () => {
  assert.ok(oneTypo('כהן', 'כהן'))
  assert.ok(oneTypo('מזרחי', 'מזרחו'))
  assert.ok(oneTypo('מזרחי', 'מזרי'))
  assert.ok(oneTypo('מזרחי', 'מזרחיי'))
  assert.ok(oneTypo('מזרחי', 'מזחרי'))
  assert.ok(!oneTypo('מזרחי', 'מרזחו'))
  assert.ok(!oneTypo('מזרחי', 'מזר'))
})

test('a name typed without its space finds the lead ("אלרועי" → "אל רועי")', () => {
  assert.deepEqual(ids('אלרועי', 'exact')[0], 1)
  assert.ok(ids('אלרועי').includes(1))
})

test('the words typed read as one name, the other way round', () => {
  const idx = searchIndex([{ id: 9, name: 'אלרועי ישראלי' }])
  assert.deepEqual(searchLeads(idx, 'אל רועי').exact.map(l => l.id), [9])
})

test('every word must match, in any order, each anywhere on the lead', () => {
  assert.deepEqual(ids('כהן רונן'), [2])
  assert.deepEqual(ids('רועי זרובבל'), [1])           // name + project
  assert.deepEqual(ids('רועי בן גוריון'), [5])
  assert.deepEqual(ids('רונן לוי'), [])
})

test('the best match first: a name that starts with what was typed beats one that only holds it', () => {
  const r = ids('רועי')
  assert.equal(r[0], 5)                                   // "רועי מזרחי" starts with it
  assert.ok(r.includes(1))                                // "אל רועי …" has the word
  assert.ok(!r.includes(3))                               // "אריאל לוי" has no "רועי"
})

test('the name as the lead typed it in the form is searched too', () => {
  assert.deepEqual(ids('ronen'), [2])
  assert.deepEqual(ids('Cohen Ronen'), [2])
})

test('a phone in any format, whole or in part', () => {
  assert.deepEqual(ids('0528017218'), [1])
  assert.deepEqual(ids('052-801-7218'), [1])
  assert.deepEqual(ids('+972 52 801 7218'), [1])
  assert.deepEqual(ids('054 123 4567'), [2])
  assert.deepEqual(ids('7218'), [1])
  assert.deepEqual(ids('0500000000'), [])
})

test('email and project are searched', () => {
  assert.deepEqual(ids('roy@example.com'), [1])
  assert.deepEqual(ids('הנרייטה'), [2])
  assert.deepEqual(ids('זרובבל 15'), [1])
})

test('quotes and hyphens in a name do not matter', () => {
  assert.deepEqual(ids('בן דוד'), [6])
  assert.deepEqual(ids('קובי בן-דוד'), [6])
  assert.deepEqual(ids('בנדוד'), [6])
})

test('close matches only when nothing matched exactly: the same sound', () => {
  assert.equal(soundKey('אלרועי'), soundKey('אלרואי'))
  const idx = searchIndex([{ id: 4, name: 'דנה אלרואי' }])
  assert.deepEqual(searchLeads(idx, 'אלרועי').close.map(l => l.id), [4])
  assert.deepEqual(searchLeads(idx, 'אלרועי').exact, [])
})

test('close matches: one typo in a word of the name', () => {
  const r = searchLeads(IDX, 'מזרחו')
  assert.deepEqual(r.exact, [])
  assert.deepEqual(r.close.map(l => l.id), [5])
  assert.deepEqual(searchLeads(IDX, 'מזחרי').close.map(l => l.id), [5])
})

test('an exact answer is never diluted by close ones', () => {
  const idx = searchIndex([{ id: 1, name: 'רועי מזרחי' }, { id: 2, name: 'רואי מזרחי' }])
  const r = searchLeads(idx, 'רועי')
  assert.deepEqual(r.exact.map(l => l.id), [1])
  assert.deepEqual(r.close, [])
})

test('nothing typed, or nonsense, finds nothing', () => {
  assert.deepEqual(ids(''), [])
  assert.deepEqual(ids('   '), [])
  assert.deepEqual(ids('קקקקקקק'), [])
  assert.equal(matchLead('', leadFields(LEADS[0])), null)
})

test('among equal matches the newest lead comes first; max cuts the list', () => {
  const idx = searchIndex([{ id: 1, name: 'רועי א', ts: '2026-01-01T00:00:00Z' }, { id: 2, name: 'רועי ב', ts: '2026-06-01T00:00:00Z' }, { id: 3, name: 'רועי ג', ts: '2026-03-01T00:00:00Z' }])
  assert.deepEqual(searchLeads(idx, 'רועי').all.map(l => l.id), [2, 3, 1])
  assert.deepEqual(searchLeads(idx, 'רועי', { max: 2 }).all.map(l => l.id), [2, 3])
})

test('extra text per lead (the campaign) joins the index', () => {
  const idx = searchIndex([{ id: 1, name: 'נועה' }], () => 'קמפיין פיקוח בניה')
  assert.deepEqual(searchLeads(idx, 'נועה פיקוח').all.map(l => l.id), [1])
})
