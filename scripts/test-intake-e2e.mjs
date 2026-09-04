// Run: npm run test:intake — needs no network, no Supabase: the whole pipeline runs against an in-memory PostgREST/Storage/Render.
// End-to-end test of the REAL api/seller-form.js handler against an in-memory Supabase (PostgREST + Storage) and Render.
// Proves: every answer, every file and the story land in ONE seller_submissions row; admin sees it; prepare/publish work.
process.env.SUPABASE_URL = 'http://supa.test'; process.env.SUPABASE_SERVICE_KEY = 'service-key'; process.env.RENDER_URL = 'http://render.test'; process.env.ADMIN_TOKEN = 'AFIKhanahal2026'
const SUPA = 'http://supa.test', RENDER = 'http://render.test'
const table = []; let nextId = 1; const storage = new Map(); const renderStore = new Map(); const log = []
const parseFilters = qs => { const f = []; for (const [k, v] of qs) { if (['select', 'order', 'limit', 'offset'].includes(k)) continue; const m = /^(eq|neq|is|not\.is|ilike|gte|lte)\.(.*)$/.exec(v); if (m) f.push({ k, op: m[1], v: m[2] }) }; return f }
const match = (row, f) => f.every(({ k, op, v }) => { const x = row[k]; if (op === 'eq') return String(x) === v; if (op === 'neq') return String(x) !== v; if (op === 'is') return v === 'null' ? x == null : x === (v === 'true'); if (op === 'not.is') return v === 'null' ? x != null : true; if (op === 'ilike') { const re = new RegExp('^' + v.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i'); return re.test(String(x ?? '')) } return true })
const json = (status, body, headers = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url); const method = (init.method || 'GET').toUpperCase(); log.push(`${method} ${url.pathname}`)
  const body = init.body ? (typeof init.body === 'string' ? init.body : init.body) : null
  if (url.origin === SUPA && url.pathname.startsWith('/rest/v1/seller_submissions')) {
    const f = parseFilters(url.searchParams); const order = url.searchParams.get('order'); const limit = +(url.searchParams.get('limit') || 1000)
    if (method === 'GET') { let rows = table.filter(r => match(r, f)); if (order) { const [col, dir] = order.split('.'); rows = [...rows].sort((a, b) => (String(a[col] ?? '') < String(b[col] ?? '') ? 1 : -1) * (dir === 'desc' ? 1 : -1)) } return json(200, rows.slice(0, limit)) }
    if (method === 'POST') { const rows = JSON.parse(body); const out = (Array.isArray(rows) ? rows : [rows]).map(r => { const row = { id: nextId++, created_at: new Date().toISOString(), ...r }; table.push(row); return row }); return json(201, out) }
    if (method === 'PATCH') { const patch = JSON.parse(body); const rows = table.filter(r => match(r, f)); rows.forEach(r => Object.assign(r, patch)); return json(200, rows) }
    if (method === 'DELETE') { const idx = table.findIndex(r => match(r, f)); if (idx >= 0) table.splice(idx, 1); return json(204, '') }
  }
  if (url.origin === SUPA && url.pathname.startsWith('/storage/v1/')) {
    const p = url.pathname.replace('/storage/v1/', '')
    if (p.startsWith('bucket')) return method === 'POST' ? json(200, { name: 'x' }) : json(200, [])
    let m
    if ((m = /^object\/upload\/sign\/([^/]+)\/(.+)$/.exec(p))) { if (method === 'POST') return json(200, { url: `/object/upload/sign/${m[1]}/${m[2]}?token=UPTOKEN` }); if (method === 'PUT' || method === 'POST') { storage.set(`${m[1]}/${m[2]}`, body); return json(200, { Key: `${m[1]}/${m[2]}` }) } }
    if ((m = /^object\/sign\/([^/]+)\/(.+)$/.exec(p)) && method === 'POST') return json(200, { signedURL: `/object/sign/${m[1]}/${m[2]}?token=SIGNED` })
    if ((m = /^object\/sign\/([^/]+)$/.exec(p)) && method === 'POST') { const { paths = [] } = JSON.parse(body || '{}'); return json(200, paths.map(pt => ({ path: pt, signedURL: `/object/sign/${m[1]}/${pt}?token=SIGNED`, error: null }))) }
    if ((m = /^object\/list\/([^/]+)$/.exec(p))) return json(200, [])
    if ((m = /^object\/([^/]+)$/.exec(p)) && method === 'DELETE') return json(200, [])
    if ((m = /^object\/([^/]+)\/(.+)$/.exec(p))) {
      const key = `${m[1]}/${m[2]}`
      if (method === 'GET') { const data = storage.get(key); return data ? new Response(data, { status: 200, headers: { 'content-type': 'image/jpeg' } }) : json(404, { error: 'not found' }) }
      if (method === 'POST' || method === 'PUT') { storage.set(key, body); return json(200, { Key: key, Id: key }) }
    }
    return json(404, { error: `unmocked storage ${method} ${p}` })
  }
  if (url.origin === RENDER) { const id = decodeURIComponent(url.pathname.split('/').pop()); if (method === 'PUT') { const prop = JSON.parse(body); renderStore.set(id, prop); return json(200, { ok: true, storage: 'supabase', property: prop }) } if (method === 'GET') return renderStore.has(id) ? json(200, renderStore.get(id)) : json(404, {}) }
  return json(500, { error: `unmocked ${method} ${url}` })
}
const { default: handler } = await import('../api/seller-form.js')
const call = async (method, query = {}, body = null, admin = false) => {
  const res = { statusCode: 200, headers: {}, body: null, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this }, setHeader(k, v) { this.headers[k] = v }, end() { return this } }
  await handler({ method, query, body, headers: { 'x-forwarded-for': '1.2.3.4', ...(admin ? { authorization: 'Bearer AFIKhanahal2026' } : {}) }, socket: {} }, res)
  return res
}
const sid = 'e2e-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now()
// the exact answers a seller would produce (sale, apartment, everything filled)
const answers = {
  x_purpose: 'sale', c_name: 'ישראל בן-יהודה', c_phone: '050-123-4567', c_email: 'israel@example.com', c_role: 'owner', c_privacy: { publishPhone: false, showAddress: false }, c_extra: { name: 'דנה בן-יהודה', phone: '052-987-6543', relation: 'בת זוג' },
  p_type: 'apartment', p_address: { city: 'רעננה', neighborhood: 'נווה זמר', street: 'אחוזה', number: '12', apt: '7', entrance: 'ב' }, p_rooms: '4', p_floor: { floor: 3, totalFloors: 6 }, p_area: { built: 118, balcony: 14 }, p_baths: { bathrooms: 2, toilets: 3 }, p_year: 2009, p_directions: ['north', 'east'], p_directions_note: 'דירה פינתית, צפון-מזרח', p_view: ['open', 'park'], p_state: 'secondhand',
  f_mamad: 'yes', f_elevator: 'shabbat', f_parking: { parking: 2 }, f_parking_type: ['covered'], f_storage: 'yes', f_storage_size: 6, f_kitchen: 'open', f_island: 'yes', f_climate: 'other', f_climate_other: 'VRF', f_rooms: ['laundry', 'closet'], f_water: ['solar'], f_systems: ['smart', 'bars'], f_furniture: 'fixed',
  k_renovated: 'partial', k_reno_year: 2021, k_reno_what: ['kitchen', 'baths'], k_matrix: { kitchen: 'excellent', baths: 'good', floor: 'good', windows: 'excellent', ac: 'good' }, k_defects: 'no', k_moisture: 'fixed', k_investment: 'none', k_occupancy: 'owners',
  b_numbers: { year: 2009, apartments: 24, floors: 6, elevators: 2 }, b_amenities: ['lobby', 'bikes'], b_fees: { vaad: 450 }, b_renovation: 'no', b_tama: 'none',
  l_rights: 'tabu', l_owners: 'ישראל ודנה בן-יהודה', l_agree: 'yes', l_more_owners: 'no', l_inherit: 'no', l_matrix: { mortgage: 'yes', liens: 'no', legalProc: 'no', violation: 'no', permit: 'unknown', extraRights: 'unknown', condo: 'yes', parkingTabu: 'yes', storageTabu: 'yes' }, l_mortgage: 900000, l_area_plans: 'no',
  d_ask: 3950000, d_expected: 3800000, d_min: 3650000, d_flex: 'little', d_offers_received: 'yes', d_best_offer: { amount: 3600000, when: 'לפני חודשיים' }, d_timeline: 'm6', d_vacate: 'm6', d_vacate_flex: ['earlier'], d_alt: 'looking', d_why: 'upgrade', d_published: 'past', d_brokers: 'none', d_offers: 'close', d_buyer: 'עדיפות לקונה ללא תלות', d_notes: 'הבעלים בחו״ל בחודש הבא',
  m_pros: 'המרפסת הגדולה שפונה לפארק', m_unique: 'קומה גבוהה ושקט מוחלט', m_love: 'אור הבוקר בסלון', m_nearby: ['schools', 'parks', 'shops'], m_fit: ['family', 'upgraders'], m_story: 'המרחק מהפארק', m_hide: 'שהבעלים מתגרשים', m_extra: 'הבניין שקט',
}
const r = {}
r.draft1 = await call('PUT', { action: 'draft' }, { sid, answers: { x_purpose: 'sale', c_name: answers.c_name, c_phone: answers.c_phone }, cur: 'c_phone', lang: 'he', schemaVersion: 4 })
// uploads: 2 photos, 1 video, 2 plan, 2 docs — signed URL from the API, bytes PUT straight to storage (as the browser does)
const kinds = [['photos', 'a.jpg', 'image/jpeg'], ['photos', 'b.jpg', 'image/jpeg'], ['videos', 'v.mp4', 'video/mp4'], ['plan', 'plan.pdf', 'application/pdf'], ['plan', 'plan2.jpg', 'image/jpeg'], ['docs', 'tabu.pdf', 'application/pdf'], ['docs', 'arnona.jpg', 'image/jpeg']]
const files = []
for (const [kind, name, type] of kinds) {
  const u = await call('POST', { action: 'upload-url' }, { sid, kind, name, type, size: 1234 })
  if (!u.body?.ok) { console.log('upload-url failed', kind, u.statusCode, u.body); continue }
  await fetch(u.body.signedUrl, { method: 'PUT', body: `bytes-of-${name}`, headers: { 'content-type': type } })
  files.push({ kind, path: u.body.path, name, type, size: 1234, status: 'done', tag: kind === 'docs' ? 'tabu' : undefined })
}
const withFiles = { ...answers, u_photos: files.filter(f => f.kind === 'photos'), u_videos: files.filter(f => f.kind === 'videos'), u_plan: files.filter(f => f.kind === 'plan'), u_docs: files.filter(f => f.kind === 'docs') }
r.draft2 = await call('PUT', { action: 'draft' }, { sid, answers: { ...withFiles, __reached: true }, cur: 'r_review', lang: 'he', schemaVersion: 4 })
r.draftGet = await call('GET', { action: 'draft', sid })
r.submit = await call('POST', {}, { sid, lang: 'he', schemaVersion: 4, answers: withFiles, files, story: 'סיפור…', consent: true, ua: 'test' })
const token = r.submit.body?.token
const afterSubmit = JSON.parse(JSON.stringify(table.find(x => x.sid === sid) || {}))
r.list = await call('GET', {}, null, true)
r.stats = await call('GET', { action: 'stats' }, null, true)
const id = r.submit.body?.id
r.detail = await call('GET', { id }, null, true)
r.summary = await call('GET', { action: 'summary', token })
r.verify = await call('POST', { action: 'verify', token }, { name: 'דנה בן-יהודה' })
r.prepare = await call('POST', { action: 'prepare', id }, {}, true)
r.approve = await call('PATCH', { id }, { status: 'approved', notes: 'בדיקה' }, true)
r.publish = await call('POST', { action: 'publish', id }, {}, true)
r.detail2 = await call('GET', { id }, null, true)
const propAfterPublish = JSON.parse(JSON.stringify([...renderStore.values()][0] || {}))
r.unpublish = await call('POST', { action: 'unpublish', id }, {}, true)
const afterUnpublish = { status: table.find(x => x.sid === sid)?.status, files: table.find(x => x.sid === sid)?.files?.length, site: JSON.parse(JSON.stringify([...renderStore.values()][0] || {})) }
r.linked = await call('POST', { action: 'linked', id }, { propertyId: 'intake-' + sid, published: true }, true)
r.resumeLink = await call('POST', { action: 'resume-link' }, { sid })
r.findDraft = await call('POST', { action: 'find-draft' }, { phone: '0501234567' })

// ── report ──
const row = table.find(x => x.sid === sid)
const sentKeys = Object.keys(withFiles), storedKeys = Object.keys(row?.answers || {})
const missing = sentKeys.filter(k => !(k in (row?.answers || {})))
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const changed = sentKeys.filter(k => k in (row?.answers || {}) && !deepEq(withFiles[k], row.answers[k]))
const step = (name, ok, extra = '') => console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`)
step('draft saved (PUT) creates ONE row', r.draft1.statusCode === 200 && table.filter(x => x.sid === sid).length === 1, `status ${r.draft1.statusCode}`)
step('upload-url for every kind → path under <sid>/<kind>/', files.length === 7 && files.every(f => f.path.startsWith(`${sid}/${f.kind}/`)), files.map(f => f.path.split('/').slice(1).join('/')).join(', '))
step('bytes stored in the private bucket', [...storage.keys()].filter(k => k.startsWith('seller-uploads/' + sid)).length === 7, `${[...storage.keys()].filter(k => k.startsWith('seller-uploads/')).length} objects`)
step('draft resume returns the answers + step', r.draftGet.body?.draft?.cur === 'r_review' && r.draftGet.body?.draft?.answers?.__reached === true && r.draftGet.body?.draft?.answers?.c_name === answers.c_name)
step('submit → 201 with ref + share token + summary URL', r.submit.statusCode === 201 && /^AH-\d{6}-[A-Z0-9]{4}$/.test(r.submit.body?.ref || '') && /^[A-Za-z0-9]{16,64}$/.test(token || ''), `${r.submit.statusCode} ${r.submit.body?.ref} ${r.submit.body?.url}`)
step('same row updated (no duplicate row on submit)', table.filter(x => x.sid === sid).length === 1 && afterSubmit.status === 'new' && !!afterSubmit.submitted_at, `rows for sid: ${table.filter(x => x.sid === sid).length}, status after submit: ${afterSubmit.status}`)
step(`ALL ${sentKeys.length} answer keys stored verbatim`, missing.length === 0 && changed.length === 0, missing.length ? 'missing: ' + missing.join(',') : changed.length ? 'changed: ' + changed.join(',') : `${storedKeys.length} keys`)
step('files column: 7 entries with kind/path/name/type/size', Array.isArray(row?.files) && row.files.length === 7 && row.files.every(f => f.kind && f.path && f.name && f.type), `${row?.files?.length} files, tags: ${row?.files?.filter(f => f.tag).length}`)
step('summary columns filled (name, phone, city, address, type, purpose, asking price)', row?.contact_name === answers.c_name && row?.phone === answers.c_phone && row?.city === 'רעננה' && row?.property_type === 'apartment' && row?.purpose === 'sale' && Number(row?.asking_price) === 3950000, `${row?.contact_name} | ${row?.phone} | ${row?.city} | ${row?.address} | ${row?.purpose} | ${row?.asking_price}`)
step('story generated server-side and stored on the row', typeof row?.story === 'string' && row.story.length > 400 && /דירת 4 חדרים/.test(row.story), `story ${row?.story?.length} chars`)
step('history: draft_created → submitted', ['draft_created', 'submitted'].every(a => (row?.history || []).some(h => h.action === a)), (row?.history || []).map(h => h.action).join(' → '))
step('admin list shows it as new', r.list.statusCode === 200 && (r.list.body || []).some(x => x.id === id && x.status === 'new'), `${(r.list.body || []).length} rows`)
step('admin stats counts it (badge)', r.stats.statusCode === 200 && (r.stats.body?.new >= 1 || r.stats.body?.counts?.new >= 1 || JSON.stringify(r.stats.body).includes('"new":1')), JSON.stringify(r.stats.body).slice(0, 120))
step('admin detail: full answers + signed file links', r.detail.statusCode === 200 && Object.keys(r.detail.body?.answers || {}).length === storedKeys.length && (r.detail.body?.files || []).length === 7 && (r.detail.body?.files || []).every(f => f.url), `files with url: ${(r.detail.body?.files || []).filter(f => f.url).length}`)
const pub = JSON.stringify(r.summary.body || {})
if (r.summary.statusCode !== 200) console.log('   summary debug:', r.summary.statusCode, pub.slice(0, 200))
step('public summary hides internal data (min price, expectation, best offer, notes, m_hide)', r.summary.statusCode === 200 && !pub.includes('3650000') && !pub.includes('3,650,000') && !pub.includes('3800000') && !pub.includes('3,800,000') && !pub.includes('3600000') && !pub.includes('מתגרשים') && !pub.includes('בחו״ל'), `${pub.length} chars, story paras ${r.summary.body?.story?.he?.length}`)
step('owner verification recorded', r.verify.statusCode === 200 && (r.verify.body?.verifications || []).length === 1 && !!table.find(x => x.sid === sid)?.owner_verified_at)
step('prepare → property for the wizard (photos public, video signed, published:false)', r.prepare.statusCode === 200 && r.prepare.body?.property?.images?.length === 2 && r.prepare.body?.property?.videos?.length === 1 && r.prepare.body?.property?.published === false && r.prepare.body?.property?.condition === 'במצב שמור', `images ${r.prepare.body?.property?.images?.length}, videos ${r.prepare.body?.property?.videos?.length}, rooms ${r.prepare.body?.property?.rooms}, contact ${r.prepare.body?.property?.contactName}`)
step('publish → property PUT to the site generator, status published', r.publish.statusCode === 200 && renderStore.size === 1 && table.find(x => x.sid === sid)?.status === 'published' && !!table.find(x => x.sid === sid)?.published_property_id, `render props: ${[...renderStore.keys()].join(',')} | ${r.publish.body?.images} images`)
const prop = propAfterPublish
console.log('   publish debug:', r.publish.statusCode, JSON.stringify(r.publish.body).slice(0, 160), '| prop keys:', Object.keys(prop).length, '| size', JSON.stringify(prop.size), 'imgs', prop.images?.length, 'desc', !!prop.description, 'published', prop.published)
step('published property carries the data (title, price, rooms, size, images, description, category)', !!prop.title && prop.price === 3950000 && String(prop.rooms) === '4' && prop.size === 118 && prop.images?.length === 2 && !!prop.description && prop.category === 'apartments' && prop.published === true, `${prop.title} | ${prop.category} | ₪${prop.price}`)
console.log('   unpublish debug:', r.unpublish.statusCode, JSON.stringify(r.unpublish.body).slice(0, 160), '| status', table.find(x => x.sid === sid)?.status, '| site published', [...renderStore.values()][0]?.published)
step('unpublish keeps the row + media, hides on site', r.unpublish.statusCode === 200 && afterUnpublish.status === 'approved' && afterUnpublish.site.published === false && afterUnpublish.files === 7 && (afterUnpublish.site.images || []).length === 2, `status ${afterUnpublish.status}, site published ${afterUnpublish.site.published}, site images kept ${(afterUnpublish.site.images || []).length}`)
step('wizard link (action=linked) syncs status', r.linked.statusCode === 200 && table.find(x => x.sid === sid)?.status === 'published')
step('resume-link / find-draft answer safely without Green API', r.resumeLink.statusCode === 400 && /already submitted/.test(r.resumeLink.body?.error || '') && r.findDraft.statusCode === 200 && r.findDraft.body?.sent === false, `${r.resumeLink.body?.error} | find sent=${r.findDraft.body?.sent}`)
console.log('\nrow columns:', Object.keys(row || {}).join(', '))
console.log('external calls made:', [...new Set(log.map(l => l.replace(/\/[^/]*e2e-[^/]*.*$/, '/<sid>…').replace(/eq\.\d+/g, 'eq.N')))].slice(0, 14).join(' | '))
