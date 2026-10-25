import test from 'node:test'
import assert from 'node:assert/strict'
import { properHebrewName, acceptProof } from './name-proof.js'

test('names on the lists never ask Claude; others are proofread, doubtful answers are ignored', async () => {
  let asked = 0
  const ask = async () => { asked++; return { data: { first_he: 'רונן', last_he: 'משעל', confident: true } } }
  assert.equal(await properHebrewName('Bechar Eddie', { ask }), 'אדי בכר')
  assert.equal(await properHebrewName('דנה כהן', { ask }), 'דנה כהן')
  assert.equal(asked, 0)
  assert.equal(await properHebrewName('Ronen Mishal', { ask }), 'רונן משעל')
  assert.equal(await properHebrewName('Ronen Mishal · זרובבל 15', { ask }), 'רונן משעל · זרובבל 15')
  assert.equal(asked, 2)
  const unsure = async () => ({ data: { first_he: 'רונן', last_he: 'מישל', confident: false } })
  assert.equal(await properHebrewName('Ronen Mishal', { ask: unsure }), 'רונן מישל')        // the list-based result
  const broken = async () => { throw new Error('down') }
  assert.equal(await properHebrewName('Ronen Mishal', { ask: broken }), 'רונן מישל')
  const slow = () => new Promise(() => {})
  assert.equal(await properHebrewName('Ronen Mishal', { ask: slow, timeout: 10 }), 'רונן מישל')
})

test('only a Hebrew-letter answer is taken', () => {
  assert.equal(acceptProof({ first_he: 'אדי', last_he: 'בכר', confident: true }), 'אדי בכר')
  assert.equal(acceptProof({ first_he: 'Eddie', last_he: 'בכר', confident: true }), '')
  assert.equal(acceptProof({ first_he: 'אדי', last_he: '', confident: true }), 'אדי')
  assert.equal(acceptProof({ first_he: 'אדי', last_he: 'בכר', confident: false }), '')
})
