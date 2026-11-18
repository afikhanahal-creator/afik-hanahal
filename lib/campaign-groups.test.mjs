import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanCampaignCfg, campaignLabel, campaignGroups, applyCampaignOps, invertCampaignOps, mergeSuggestion, rawCampaign } from './campaign-groups.js'

const short = s => s.split(' - ')[0].replace(/\s*#\d+$/, '').trim()
const now = Date.parse('2026-11-18T10:00:00Z')
const D = 864e5
const lead = (c, daysAgo, extra = {}) => ({ campaign_name: c, created_at: new Date(now - daysAgo * D).toISOString(), ...extra })

test('the config is cleaned: control / bidi marks out, empty names dropped, archive unique', () => {
  const c = cleanCampaignCfg({ names: { ' זרובבל 15 - 2# ': '‎זרובבל   15', x: '', '': 'y' }, archived: ['a', 'a', '', 3] })
  assert.deepEqual(c.names, { 'זרובבל 15 - 2#': 'זרובבל 15' })
  assert.deepEqual(c.archived, ['a', '3'])
  assert.deepEqual(cleanCampaignCfg(null), { names: {}, archived: [] })
})

test('a label is the office name, else Meta\'s short name', () => {
  const cfg = { names: { 'הנרייטה סאלד 3#': 'הנרייטה סאלד' } }
  assert.equal(campaignLabel('הנרייטה סאלד 3#', cfg, short), 'הנרייטה סאלד')
  assert.equal(campaignLabel('זרובבל 15 - 2#', cfg, short), 'זרובבל 15')
  assert.equal(campaignLabel('', cfg, short), null)
  assert.equal(rawCampaign({ form_name: 'טופס' }), 'טופס')
  assert.equal(rawCampaign({}), null)
})

test('groups: one row per name with its raw campaigns, counts, newest first, archived last, test leads out', () => {
  const leads = [
    lead('זרובבל 15 - 2#', 1), lead('זרובבל 15 - v2', 40), lead('הנרייטה סאלד 4', 100),
    lead('הנרייטה סאלד 3#', 200), lead('שביל התפוזים', 3), lead('זרובבל 15 - 2#', 2, { test: 1 }),
  ]
  const cfg = { names: { 'הנרייטה סאלד 4': 'הנרייטה סאלד', 'הנרייטה סאלד 3#': 'הנרייטה סאלד' }, archived: ['שביל התפוזים'] }
  const g = campaignGroups(leads, cfg, { short, now, isTest: l => !!l.test })
  assert.deepEqual(g.map(x => x.label), ['זרובבל 15', 'הנרייטה סאלד', 'שביל התפוזים'])
  assert.equal(g[0].count, 2); assert.equal(g[0].recent, 1); assert.equal(g[0].raws.length, 2); assert.equal(g[0].renamed, false)
  assert.equal(g[1].renamed, true); assert.equal(g[1].raws[0].raw, 'הנרייטה סאלד 4')
  assert.equal(g[2].archived, true)
})

test('merge, rename and back to Meta\'s name', () => {
  let cfg = applyCampaignOps({}, [{ op: 'map', raws: ['a 1', 'a 2', 'b'], name: 'פרויקט א', from: ['a 1', 'b'] }])
  assert.deepEqual(cfg.names, { 'a 1': 'פרויקט א', 'a 2': 'פרויקט א', b: 'פרויקט א' })
  cfg = applyCampaignOps(cfg, [{ op: 'map', raws: ['b'], name: '' }])
  assert.deepEqual(cfg.names, { 'a 1': 'פרויקט א', 'a 2': 'פרויקט א' })
  // repeating is a no-op
  assert.deepEqual(applyCampaignOps(cfg, [{ op: 'map', raws: ['b'], name: '' }]), cfg)
})

test('archive: on / off; a merge of archived names stays archived, a merge with a live one is live', () => {
  let cfg = applyCampaignOps({}, [{ op: 'archive', label: 'ישן', on: true }, { op: 'archive', label: 'ישן 2', on: true }])
  assert.deepEqual(cfg.archived, ['ישן', 'ישן 2'])
  const both = applyCampaignOps(cfg, [{ op: 'map', raws: ['r1', 'r2'], name: 'ישנים', from: ['ישן', 'ישן 2'] }])
  assert.deepEqual(both.archived, ['ישנים'])
  const mixed = applyCampaignOps(cfg, [{ op: 'map', raws: ['r1', 'r3'], name: 'חי', from: ['ישן', 'חי'] }])
  assert.deepEqual(mixed.archived, ['ישן 2'])
  assert.deepEqual(applyCampaignOps(cfg, [{ op: 'archive', label: 'ישן', on: false }]).archived, ['ישן 2'])
})

test('undo restores the names and the archive exactly', () => {
  const cfg0 = cleanCampaignCfg({ names: { x: 'שם ישן' }, archived: ['ישן'] })
  const ops = [{ op: 'map', raws: ['x', 'y'], name: 'חדש', from: ['שם ישן', 'ישן'] }]
  const cfg1 = applyCampaignOps(cfg0, ops)
  const back = applyCampaignOps(cfg1, invertCampaignOps(cfg0, ops))
  assert.deepEqual(back, cfg0)
  const arch = [{ op: 'archive', label: 'שם ישן', on: true }]
  assert.deepEqual(applyCampaignOps(applyCampaignOps(cfg0, arch), invertCampaignOps(cfg0, arch)), cfg0)
})

test('the merge suggestion is the campaign with the most leads', () => {
  assert.equal(mergeSuggestion([{ label: 'a', count: 2, last: 9 }, { label: 'b', count: 5, last: 1 }]), 'b')
  assert.equal(mergeSuggestion([]), '')
})
