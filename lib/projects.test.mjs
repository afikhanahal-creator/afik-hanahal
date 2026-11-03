import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanProjects, newProject, projectOfLead, projectHow, assignPatch, projectCounts, filterByProject, projectSuggestions, NONE } from './projects.js'
import { leadProperty } from './automations-shared.js'

const zr = { id: 'p_zr15', name: 'זרובבל 15', color: '#3B82F6', aliases: [], status: 'active' }
const nv = { id: 'p_nveoz', name: 'נווה עוז', color: '#16A34A', aliases: ['פרויקט הגפן'], status: 'active', town: 'פתח תקווה' }
const P = cleanProjects([zr, nv])
const meta = (id, camp, extra = {}) => ({ id, name: 'x', source: 'meta', crm_data: { metaLeadId: 'm' + id, campaignName: camp }, leadStatus: 'new', ...extra })

test('a lead belongs to the project it was put in, else the one its campaign / listing matches', () => {
  assert.equal(projectOfLead(meta(1, 'זרובבל 15 - v2 (כוונה גבוהה)'), P)?.id, 'p_zr15')
  assert.equal(projectHow(meta(1, 'זרובבל 15 - v2'), P), 'auto')
  assert.equal(projectOfLead({ id: 2, propTitle: 'פרויקט הגפן' }, P)?.id, 'p_nveoz')            // by an alias
  const moved = meta(3, 'זרובבל 15 - v2', { projectId: 'p_nveoz', projectName: 'נווה עוז' })
  assert.equal(projectOfLead(moved, P)?.id, 'p_nveoz'); assert.equal(projectHow(moved, P), 'manual')
  assert.equal(projectOfLead(meta(4, 'זרובבל 15', { projectId: NONE }), P), null)                // taken out by hand
  assert.equal(projectOfLead({ id: 5, source: 'website' }, P), null)
  assert.deepEqual(assignPatch(nv), { projectId: 'p_nveoz', projectName: 'נווה עוז' })
  assert.deepEqual(assignPatch(null), { projectId: NONE, projectName: '' })
  // an archived project doesn't take new leads by itself
  assert.equal(projectOfLead(meta(6, 'זרובבל 15'), cleanProjects([{ ...zr, status: 'archived' }])), null)
})

test('counts, filters and suggestions', () => {
  const leads = [meta(1, 'זרובבל 15 - v2'), meta(2, 'זרובבל 15', { leadStatus: 'won' }), { id: 3, propTitle: 'פרויקט הגפן', leadStatus: 'contacted' },
    meta(4, 'רמת השרון - קמפיין', { leadStatus: 'new' }), meta(5, 'רמת השרון - v3'), { id: 6, source: 'website' }]
  const c = projectCounts(leads, P)
  assert.equal(c.p_zr15.total, 2); assert.equal(c.p_zr15.open, 1); assert.equal(c.p_zr15.byStage.won, 1)
  assert.equal(c.p_nveoz.total, 1); assert.equal(c[NONE].total, 3)
  assert.deepEqual(filterByProject(leads, P, 'p_zr15').map(l => l.id), [1, 2])
  assert.deepEqual(filterByProject(leads, P, NONE).map(l => l.id), [4, 5, 6])
  assert.equal(filterByProject(leads, P, '').length, 6)
  assert.deepEqual(projectSuggestions(leads, P), [{ name: 'רמת השרון', count: 2 }])
})

test('new projects: a name, no duplicate, the next free color; the list is cleaned', () => {
  const p = newProject({ name: '  רמת השרון  ', town: 'רמת השרון' }, P, 1_800_000_000_000)
  assert.equal(p.name, 'רמת השרון'); assert.match(p.id, /^p_[a-z0-9]+$/); assert.notEqual(p.color, P[0].color); assert.notEqual(p.color, P[1].color)
  assert.throws(() => newProject({ name: 'זרובבל 15' }, P), /כבר יש/)
  assert.throws(() => newProject({ name: ' ' }, P), /שם/)
  assert.equal(cleanProjects([zr, { ...zr, id: 'p_other' }, { id: 'bad', name: 'x' }, { id: 'p_ok', name: '' }]).length, 1)
})

test('the project put by hand is what the messages call {property}', () => {
  assert.equal(leadProperty({ source: 'meta', crm_data: { campaignName: 'זרובבל 15 - v2', projectName: 'נווה עוז' } }), 'נווה עוז')
  assert.equal(leadProperty({ source: 'meta', crm_data: { campaignName: 'זרובבל 15 - v2' } }), 'זרובבל 15')
})
