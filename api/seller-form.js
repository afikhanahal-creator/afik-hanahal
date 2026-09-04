// Vercel serverless — property intake (/newproperty) backend.
//
// Public (no login; secrets are the random draft id `sid` / share `token`):
//   GET   ?action=draft&sid=          load a saved draft (resume from any device / shared with a partner)
//   PUT   ?action=draft               save draft progress { sid, answers, cur, lang }
//   POST  ?action=upload-url          mint a signed Supabase Storage upload URL
//   GET   ?action=streets&city=       street names of a locality (data.gov.il, cached)
//   POST  (no action)                 submit the intake → Property record (status "new"), ref + share token
//   GET   ?action=summary&token=      public / shareable summary (internal-only answers stripped)
//   POST  ?action=verify&token=       owner / co-owner confirms the details are correct
//
// Admin (Bearer ADMIN_TOKEN):
//   GET   /                           list intake properties (all statuses)
//   GET   ?id=                        one property: everything + signed media/document URLs + history
//   PATCH ?id=                        { status, notes, overrides } — every change is logged to history
//   POST  ?action=publish&id=         approved → published: builds a property for the site's property
//                                     generator, copies photos to the public bucket, saves via Render
//   POST  ?action=unpublish&id=       hides the property on the site (published:false), keeps everything
//   DELETE ?id=[&media=1]             delete the intake record; media is deleted ONLY with media=1
//
// Leads (contacts table) and intake properties (seller_submissions table) are
// fully separate: nothing here writes to contacts, and nothing here is read by
// the leads board.
//
// Files never pass through this function: the browser PUTs straight to Supabase
// Storage (private bucket `seller-uploads`, folder = sid) using signed URLs.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_KEY. Optional: RENDER_URL,
// GMAIL_USER, GMAIL_APP_PASSWORD, ADMIN_NOTIFY_EMAIL, WA_GREENAPI_INSTANCE,
// WA_GREENAPI_TOKEN, BUSINESS_NOTIFY_CHATID.
// One-time SQL: server/seller-submissions-migration.sql
import { createClient } from '@supabase/supabase-js'
import { buildSummary, headline, PROPERTY_TYPE_LABEL, DOC_TAG_LABEL, publicAnswers, buildStory, storyText, directionsText, STEPS, INTAKE_STATUSES, purposeOf } from '../src/sellerFormSchema.js'

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const RENDER = (process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com').replace(/\/$/, '')
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'AFIKhanahal2026'   // same token the admin panel and the Render backend use
const BUCKET = 'seller-uploads'          // private: intake media + documents
const PUBLIC_BUCKET = 'property-media'   // public: photos copied at publish time
const TABLE = 'seller_submissions'
const SITE = 'https://www.afikhanahal.co.il'

const KIND_LIMITS = { photos: 25, videos: 200, plan: 25, docs: 25 }   // MB
const KIND_TYPES = {
  photos: t => t.startsWith('image/'),
  videos: t => t.startsWith('video/'),
  plan:   t => t.startsWith('image/') || t === 'application/pdf',
  docs:   t => t.startsWith('image/') || t === 'application/pdf',
}
const STREETS_RESOURCE = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b'
const streetsCache = new Map()
const STATUS_VALUES = INTAKE_STATUSES.map(s => s.v)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}
const isAdmin = req => (req.headers.authorization || '').replace(/^Bearer\s+/i, '') === ADMIN_TOKEN
const sb = () => createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
const SID_RE = /^[\w-]{8,64}$/
const TOKEN_RE = /^[A-Za-z0-9]{16,64}$/
const now = () => new Date().toISOString()

// ── abuse guards (best effort, per lambda instance) ─────────────────────────
const RL = new Map()
const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || 'unknown'
function rateLimited(req, bucket, max, windowMs = 60000) {
  const key = `${bucket}:${clientIp(req)}`, t = Date.now(), e = RL.get(key)
  if (!e || t - e.t > windowMs) { if (RL.size > 5000) RL.clear(); RL.set(key, { t, n: 1 }); return false }
  e.n += 1
  return e.n > max
}
const PHONE_RE = /^\+?\d[\d\s\-()]{6,17}\d$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const STEP_IDS = new Set(STEPS.map(s => s.id))
// Only keys the questionnaire actually defines are stored (plus their _other / _note companions)
const sanitizeAnswers = a => Object.fromEntries(Object.entries(a && typeof a === 'object' ? a : {}).filter(([k]) => typeof k === 'string' && k.length < 60 && (k === '__reached' || STEP_IDS.has(k.replace(/_(other|note)$/, '')))))

// ── Supabase REST helpers ────────────────────────────────────────────────────
async function supaFetch(path, opts = {}) {
  return fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers || {}) },
    signal: opts.signal || AbortSignal.timeout(12000),
  })
}
const stripMissingColumn = (msg, row) => { const m = /Could not find the '([^']+)' column/i.exec(msg); return m && m[1] in row ? m[1] : null }

async function insertRow(row) {
  const r = await supaFetch(`/${TABLE}`, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
  if (r.ok) { const rows = await r.json().catch(() => []); return Array.isArray(rows) ? rows[0] : rows }
  const msg = await r.text().catch(() => '')
  const col = stripMissingColumn(msg, row)
  if (col) { console.warn(`[intake] INSERT without missing column '${col}' — run the migration`); const { [col]: _d, ...rest } = row; return insertRow(rest) }
  throw new Error(`Supabase INSERT ${r.status}: ${msg}`)
}
async function patchRow(where, patch) {
  const r = await supaFetch(`/${TABLE}?${where}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) })
  if (r.ok) { const rows = await r.json().catch(() => []); return Array.isArray(rows) ? rows[0] : rows }
  const msg = await r.text().catch(() => '')
  const col = stripMissingColumn(msg, patch)
  if (col) { console.warn(`[intake] PATCH without missing column '${col}' — run the migration`); const { [col]: _d, ...rest } = patch; return Object.keys(rest).length ? patchRow(where, rest) : null }
  throw new Error(`Supabase PATCH ${r.status}: ${msg}`)
}
async function getRow(where, select = '*') {
  const r = await supaFetch(`/${TABLE}?${where}&select=${encodeURIComponent(select)}&limit=1`)
  if (r.status === 404 || r.status === 406) return null
  if (!r.ok) throw new Error(`Supabase GET ${r.status}: ${await r.text().catch(() => '')}`)
  const rows = await r.json().catch(() => [])
  return rows[0] || null
}
const withHistory = (row, entry) => [...(Array.isArray(row?.history) ? row.history : []), { at: now(), ...entry }].slice(-200)

const safeName = n => String(n || 'file').normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'file'
const rand = (n = 4, A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') => { let s = ''; for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)]; return s }
const makeRef = () => `AH-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${rand(4)}`
const makeToken = () => rand(24, 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789')
const toIntlPhone = raw => { const d = String(raw || '').replace(/\D/g, ''); if (!d) return ''; if (d.startsWith('972')) return d; if (d.startsWith('0')) return '972' + d.slice(1); return d }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmtILS = n => (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) ? '' : '₪' + Number(n).toLocaleString('he-IL')
const num = v => (v === undefined || v === null || v === '' || Number.isNaN(Number(v))) ? null : Number(v)
const cleanFiles = (files, sid) => (Array.isArray(files) ? files : [])
  .filter(f => f && typeof f.path === 'string' && f.path.startsWith(`${sid}/`)).slice(0, 150)
  .map(f => ({ name: String(f.name || '').slice(0, 200), size: Number(f.size || 0), type: String(f.type || ''), kind: String(f.kind || ''), tag: f.tag ? String(f.tag) : null, path: f.path }))
const filesFromAnswers = (a, sid) => {
  const out = []
  STEPS.filter(s => s.type === 'upload').forEach(s => (Array.isArray(a?.[s.id]) ? a[s.id] : []).forEach(f => { if (f && f.path && (!f.status || f.status === 'done')) out.push({ ...f, kind: f.kind || s.kind }) }))
  return cleanFiles(out, sid)
}
const summaryFields = a => {
  const addr = a?.p_address || {}
  return {
    contact_name: String(a?.c_name || '').trim() || null,
    phone: String(a?.c_phone || '').trim() || null,
    email: String(a?.c_email || '').trim() || null,
    city: addr.city || null,
    address: [addr.street, addr.number, addr.apt ? `דירה ${addr.apt}` : null].filter(Boolean).join(' ') || null,
    property_type: a?.p_type || null,
    asking_price: num(a?.d_ask),
    purpose: purposeOf(a || {}),
  }
}

// ── storage ──────────────────────────────────────────────────────────────────
async function ensureBucket(client, name, isPublic) {
  const { error } = await client.storage.createBucket(name, { public: isPublic, fileSizeLimit: 209715200 })
  if (error && !/already exists|duplicate/i.test(error.message || '')) throw new Error(`createBucket ${name}: ${error.message}`)
}
async function signedUploadUrl(client, path) {
  let { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error && /not found|does not exist/i.test(error.message || '')) { await ensureBucket(client, BUCKET, false); ({ data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path)) }
  if (error) throw new Error(`createSignedUploadUrl: ${error.message}`)
  return data
}
async function signFiles(client, files, expires = 3600) {
  const paths = (files || []).map(f => f.path).filter(Boolean)
  if (!paths.length) return files || []
  const { data, error } = await client.storage.from(BUCKET).createSignedUrls(paths, expires)
  if (error) { console.warn('[intake] createSignedUrls:', error.message); return files }
  const byPath = Object.fromEntries((data || []).map(d => [d.path, d.signedUrl]))
  return files.map(f => ({ ...f, url: byPath[f.path] || null }))
}
async function removeAllFiles(client, sid) {
  if (!sid) return
  for (const kind of Object.keys(KIND_LIMITS)) {
    const { data } = await client.storage.from(BUCKET).list(`${sid}/${kind}`, { limit: 500 })
    const names = (data || []).map(x => `${sid}/${kind}/${x.name}`)
    if (names.length) await client.storage.from(BUCKET).remove(names)
  }
  const { data: pub } = await client.storage.from(PUBLIC_BUCKET).list(sid, { limit: 500 }).catch(() => ({ data: [] }))
  const pubNames = (pub || []).map(x => `${sid}/${x.name}`)
  if (pubNames.length) await client.storage.from(PUBLIC_BUCKET).remove(pubNames)
}
// Copy intake photos into the public bucket so the site's property generator can show them.
async function publishMedia(client, row) {
  const files = Array.isArray(row.files) ? row.files : []
  const map = { ...((row.meta || {}).publicMedia || {}) }
  const photos = files.filter(f => f.kind === 'photos' && f.path)
  const todo = photos.filter(f => !map[f.path])
  if (todo.length) await ensureBucket(client, PUBLIC_BUCKET, true).catch(() => {})
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(todo.slice(i, i + 4).map(async f => {
      try {
        const { data, error } = await client.storage.from(BUCKET).download(f.path)
        if (error || !data) throw new Error(error?.message || 'download failed')
        const dest = `${row.sid}/${f.path.split('/').pop()}`
        const up = await client.storage.from(PUBLIC_BUCKET).upload(dest, data, { contentType: f.type || 'image/jpeg', upsert: true, cacheControl: '31536000' })
        if (up.error) throw new Error(up.error.message)
        map[f.path] = client.storage.from(PUBLIC_BUCKET).getPublicUrl(dest).data.publicUrl
      } catch (e) { console.warn('[intake] publish photo failed:', f.path, e.message) }
    }))
  }
  const images = photos.map(f => map[f.path]).filter(Boolean)
  // Videos stay in the private bucket behind long-lived signed URLs (no multi-hundred-MB copies inside a lambda)
  const videos = []
  for (const v of files.filter(f => f.kind === 'videos' && f.path)) {
    const { data } = await client.storage.from(BUCKET).createSignedUrl(v.path, 10 * 365 * 24 * 3600)
    if (data?.signedUrl) videos.push({ url: data.signedUrl, thumbnail: null })
  }
  return { images, videos, map }
}

// ── property generator mapping (answers + office overrides → site property) ──
const TYPE_HE = { apartment: 'דירה', garden: 'דירת גן', penthouse: 'פנטהאוז', duplex: 'דופלקס', cottage: 'קוטג׳', house: 'בית פרטי', land: 'מגרש לבנייה', commercial: 'נכס מסחרי', other: 'דירה' }
const CATEGORY = (t, rental) => t === 'land' ? 'land' : t === 'commercial' ? 'commercial' : rental ? 'rentals' : 'apartments'
// labels must match the wizard's CONDITIONS / VIEWS / DIRECTIONS so a prepared property opens fully selected
const CONDITION_HE = { new: 'חדש מקבלן', secondhand: 'במצב שמור', renovated: 'משופץ', needs: 'דרוש שיפוץ' }
const VIEW_WIZ = { sea: 'ים', park: 'פארק', urban: 'עיר', open: 'טבע', hills: 'טבע', garden: 'טבע', sunset: 'טבע', none: 'ללא' }
const ENTRY_HE = { immediate: 'מיידית', flexible: 'כניסה גמישה' }
const optLabelHe = (id, v) => { const st = STEPS.find(s => s.id === id); const o = st?.opts?.find(x => x.v === v); return o ? o.l : '' }
function buildSiteProperty(row, media) {
  const a = row.answers || {}
  const ov = row.overrides || {}
  const addr = a.p_address || {}
  const priv = a.c_privacy || {}
  const typeHe = ov.type || TYPE_HE[a.p_type] || (a.p_type === 'other' ? (a.p_type_other || 'נכס') : 'נכס')
  const rooms = ov.rooms ?? a.p_rooms ?? ''
  const size = ov.size ?? a.p_area?.built ?? ''
  const price = num(ov.price) ?? num(a.d_ask) ?? 0
  const showAddress = ov.showAddress !== undefined ? !!ov.showAddress : !!priv.showAddress
  const showPhone = ov.showPhone !== undefined ? !!ov.showPhone : !!priv.publishPhone
  const marketing = [a.m_pros, a.m_unique, a.m_love, a.m_story].filter(Boolean).join('\n\n')
  const has = (arr, v) => Array.isArray(arr) && arr.includes(v)
  const pk = Number(a.f_parking?.parking || 0)
  const rental = purposeOf(a) === 'rental'
  return {
    id: row.published_property_id || `intake-${row.sid}`,
    category: ov.category || CATEGORY(a.p_type, purposeOf(a) === 'rental'),
    title: ov.title || `${typeHe}${rooms ? `, ${rooms} חד׳` : ''}${size ? `, ${size} מ"ר` : ''} - ${addr.city || ''}`.trim(),
    type: typeHe,
    txType: rental ? 'rent' : 'sale',
    purpose: rental ? 'rental' : 'sale',
    location: addr.city || '',
    street: showAddress ? [addr.street, addr.number].filter(Boolean).join(' ') : '',
    neighborhood: addr.neighborhood || '',
    region: ov.region || 'השרון',
    floor: a.p_floor?.floor ?? '',
    totalFloors: a.p_floor?.totalFloors ?? '',
    rooms: rooms,
    bathrooms: a.p_baths?.bathrooms ?? '',
    size: size,
    buildSqm: a.p_area?.built ?? '',
    dunams: a.p_area?.plot ? +(Number(a.p_area.plot) / 1000).toFixed(3) : '',
    condition: CONDITION_HE[a.p_state] || '',
    direction: Array.isArray(a.p_directions) && a.p_directions.length ? String(Math.min(4, a.p_directions.length)) : '',
    directionNames: (Array.isArray(a.p_directions) ? a.p_directions : []).map(d => optLabelHe('p_directions', d)).join(', '),
    directionText: a.p_directions_note || directionsText(a.p_directions, 'he'),
    view: (Array.isArray(a.p_view) ? a.p_view : []).map(v => VIEW_WIZ[v]).filter(Boolean).find(v => v !== 'ללא') || (a.p_view?.length ? 'ללא' : ''),
    viewNames: (Array.isArray(a.p_view) ? a.p_view : []).map(v => optLabelHe('p_view', v)).join(', '),
    buildYear: a.p_year || '',
    houseCommittee: a.b_fees?.vaad ? String(a.b_fees.vaad) : '',
    price,
    priceDisplay: price ? `₪${price.toLocaleString('he-IL')}${rental ? ' לחודש' : ''}` : 'מחיר בפנייה',
    priceNegotiable: a.d_flex ? a.d_flex !== 'firm' : false,
    entryDate: rental ? ({ now: 'מיידית', flex: 'כניסה גמישה' }[a.d_timeline] || (a.d_timeline ? 'לפי הסכם' : '')) : (ENTRY_HE[a.d_vacate] || (a.d_vacate ? 'לפי הסכם' : '')),
    description: ov.description || marketing,
    // amenities (same keys the wizard / site cards use)
    parking: pk > 0, parkingCount: pk ? String(pk) : '',
    coveredParking: has(a.f_parking_type, 'covered') || has(a.f_parking_type, 'underground'),
    balcony: !!num(a.p_area?.balcony) || has(a.f_rooms, 'balcony'),
    elevator: !!a.f_elevator && a.f_elevator !== 'no',
    storage: a.f_storage === 'yes',
    pool: has(a.f_rooms, 'pool') || has(a.b_amenities, 'pool'),
    garden: !!num(a.p_area?.garden) || has(a.f_rooms, 'garden'),
    safeRoom: a.f_mamad === 'yes',
    airCon: !!a.f_climate && a.f_climate !== 'none',
    furnished: ['partial', 'full'].includes(a.f_furniture),
    renovated: a.k_renovated === 'yes' || a.p_state === 'renovated',
    accessible: has(a.f_systems, 'accessible') || has(a.b_amenities, 'accessible'),
    solarBoiler: has(a.f_water, 'solar'),
    boiler: has(a.f_water, 'electric'),
    bars: has(a.f_systems, 'bars'),
    doorman: has(a.b_amenities, 'guard'),
    unit: has(a.f_rooms, 'unit'),
    images: media.images,
    videos: media.videos,
    videoUrl: media.videos[0]?.url || '',
    // the site card / wizard always has a contact: the owner when they allowed it, otherwise the office
    contactName: showPhone && a.c_name ? a.c_name : 'אפיק הנחל',
    contactPhone: showPhone && a.c_phone ? a.c_phone : '055-981-1814',
    status: rental ? 'להשכרה' : 'בשיווק',
    published: true,
    source: 'intake',
    intakeRef: row.ref,
    intakeId: row.id,
    createdAt: row.published_at || now(),
    updatedAt: now(),
  }
}
async function renderPut(property) {
  const r = await fetch(`${RENDER}/api/properties/${encodeURIComponent(property.id)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify(property), signal: AbortSignal.timeout(42000),
  })
  if (!r.ok) throw new Error(`property generator HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  return r.json().catch(() => ({}))
}
async function renderGet(id) {
  const r = await fetch(`${RENDER}/api/properties`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }, signal: AbortSignal.timeout(42000) })
  if (!r.ok) throw new Error(`property generator HTTP ${r.status}`)
  const list = await r.json().catch(() => [])
  return (Array.isArray(list) ? list : []).find(p => String(p.id) === String(id)) || null
}

// ── notifications (best effort) ──────────────────────────────────────────────
const GREEN_INSTANCE = process.env.WA_GREENAPI_INSTANCE || ''
const GREEN_TOKEN    = process.env.WA_GREENAPI_TOKEN || ''
const NOTIFY_CHATID  = process.env.BUSINESS_NOTIFY_CHATID || '972559811814'
const greenBase = () => { const region = String(GREEN_INSTANCE).slice(0, 4); return region ? `https://${region}.api.greenapi.com` : 'https://api.green-api.com' }
async function notifyWhatsApp(row, a) {
  if (!GREEN_INSTANCE || !GREEN_TOKEN) return { ok: false, error: 'Green API not configured' }
  const chatId = NOTIFY_CHATID.includes('@') ? NOTIFY_CHATID : `${toIntlPhone(NOTIFY_CHATID)}@c.us`
  const lines = [purposeOf(a) === 'rental' ? '🏠 *נכס חדש נקלט להשכרה!*' : '🏠 *נכס חדש נקלט למכירה!*', '', `📁 תיק: ${row.ref}`, `👤 ${row.contact_name || '—'}`, `📱 ${row.phone ? `https://wa.me/${toIntlPhone(row.phone)}` : '—'}`,
    `🏷 ${headline(a, 'he') || '—'}`, row.asking_price ? `💰 מחיר מבוקש: ${fmtILS(row.asking_price)}` : null, `📎 ${(row.files || []).length} קבצים`,
    `🔗 ${SITE}/admin-panel/properties-intake`, `🕐 ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`].filter(Boolean)
  try {
    const r = await fetch(`${greenBase()}/waInstance${GREEN_INSTANCE}/sendMessage/${GREEN_TOKEN}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, message: lines.join('\n') }), signal: AbortSignal.timeout(15000) })
    return r.ok ? { ok: true } : { ok: false, error: `Green API HTTP ${r.status}` }
  } catch (e) { return { ok: false, error: e.message } }
}
function buildEmailHtml(row, a, signedFiles) {
  const sections = buildSummary(a, 'he')
  const secHtml = sections.map(sec => `
    <h3 style="margin:26px 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#3F4EB0">${esc(sec.title)}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${sec.items.map(it => `<tr><td style="padding:7px 10px;border-top:1px solid #ECECF2;color:#7A7A8A;width:38%;vertical-align:top">${esc(it.label)}</td><td style="padding:7px 10px;border-top:1px solid #ECECF2;color:#0B0B0F;white-space:pre-wrap">${esc(it.value)}</td></tr>`).join('')}</table>`).join('')
  const filesHtml = signedFiles.length ? `<h3 style="margin:26px 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#3F4EB0">קבצים (${signedFiles.length})</h3><ul style="padding-inline-start:18px;font-size:14px;line-height:1.8">${signedFiles.map(f => `<li>${f.url ? `<a href="${esc(f.url)}" style="color:#3F4EB0">${esc(f.name)}</a>` : esc(f.name)} <span style="color:#7A7A8A">· ${esc(f.kind)}${f.tag ? ' · ' + esc(DOC_TAG_LABEL(f.tag, 'he')) : ''}</span></li>`).join('')}</ul><p style="font-size:12px;color:#7A7A8A">הקישורים לקבצים תקפים ל-7 ימים. הקבצים נשמרים לצמיתות בכרטיס הנכס בפאנל הניהול.</p>` : ''
  const storyHtml = row.story ? `<h3 style="margin:22px 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#3F4EB0">סיפור הנכס</h3><div style="font-size:15px;line-height:1.7;white-space:pre-wrap;background:#F7F7FA;border-radius:10px;padding:14px 16px">${esc(row.story)}</div>` : ''
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#F5F5F9;font-family:Heebo,Arial,sans-serif;color:#0B0B0F"><div style="max-width:680px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border-radius:16px;padding:28px 30px;border:1px solid #E6E6EC">
    <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#3F4EB0;font-weight:700">אפיק הנחל · נכס חדש נקלט למכירה</div>
    <h1 style="margin:8px 0 4px;font-size:24px">${esc(headline(a, 'he') || 'נכס חדש')}</h1>
    <div style="font-size:14px;color:#7A7A8A">תיק ${esc(row.ref)} · ${esc(row.contact_name || '')} · <a href="tel:${esc(row.phone || '')}" style="color:#3F4EB0">${esc(row.phone || '')}</a>${row.email ? ` · <a href="mailto:${esc(row.email)}" style="color:#3F4EB0">${esc(row.email)}</a>` : ''}</div>
    ${row.asking_price ? `<div style="margin-top:14px;display:inline-block;background:#F2F3FB;border:1px solid #E4E7F8;border-radius:10px;padding:8px 14px;font-weight:700">מחיר מבוקש: ${fmtILS(row.asking_price)}</div>` : ''}
    ${storyHtml}${secHtml}${filesHtml}
    <div style="margin-top:28px;text-align:center"><a href="${SITE}/admin-panel/properties-intake" style="display:inline-block;background:#0B0B0F;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">פתיחת כרטיס הנכס בפאנל</a> &nbsp; <a href="${SITE}/newproperty/${esc(row.share_token || '')}" style="display:inline-block;background:#F2F3FB;color:#3F4EB0;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">דף הסיכום ששותף עם הבעלים</a></div>
  </div></div></body></html>`
}
async function notifyEmail(row, a, signedFiles) {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD
  const to = process.env.ADMIN_NOTIFY_EMAIL || user
  if (!user || !pass) return { ok: false, error: 'GMAIL_USER / GMAIL_APP_PASSWORD missing' }
  try {
    const { default: nodemailer } = await import('nodemailer')
    const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: pass.replace(/\s+/g, '') } })
    const cc = row.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) ? row.email : undefined
    await transporter.sendMail({ from: `"אפיק הנחל · קליטת נכסים" <${user}>`, to, cc, subject: `🏠 נכס חדש נקלט: ${headline(a, 'he') || row.contact_name || row.ref} — תיק ${row.ref}`, html: buildEmailHtml(row, a, signedFiles) })
    return { ok: true }
  } catch (e) { return { ok: false, error: e.message } }
}

// Public / shareable view of a record: internal-only answers stripped, media signed for an hour
async function publicView(client, row) {
  const a = publicAnswers(row.answers || {})
  const files = (row.files || []).filter(f => f.kind === 'photos' || f.kind === 'videos' || f.kind === 'plan')
  const signed = await signFiles(client, files, 3600)
  return {
    ok: true, ref: row.ref, lang: row.lang || 'he', submitted_at: row.submitted_at || row.created_at, status: row.status,
    headline: { he: headline(a, 'he'), en: headline(a, 'en') },
    property_type: row.property_type, city: row.city, purpose: purposeOf(a),
    sections: { he: buildSummary(a, 'he'), en: buildSummary(a, 'en') },
    story: { he: buildStory(a, 'he'), en: buildStory(a, 'en') },
    facts: { price: num(a.d_ask), rooms: a.p_rooms || null, built: num(a.p_area?.built), floor: a.p_floor?.floor ?? null, totalFloors: a.p_floor?.totalFloors ?? null, parking: num(a.f_parking?.parking), state: a.p_state || null },
    media: signed.map(f => ({ kind: f.kind, name: f.name, type: f.type, url: f.url })),
    verifications: (Array.isArray(row.verifications) ? row.verifications : []).map(v => ({ name: v.name, at: v.at })),
    owner_verified_at: row.owner_verified_at || null,
  }
}

// ── handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!SUPA_URL || !SUPA_KEY) return res.status(500).json({ ok: false, error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not configured in Vercel env vars' })
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')

  const action = String(req.query.action || '')
  const id = req.query.id || req.body?.id

  try {
    // ── streets (public) ────────────────────────────────────────────────────
    if (action === 'streets') {
      const city = String(req.query.city || '').trim().slice(0, 60)
      if (!city) return res.status(400).json({ ok: false, error: 'city required' })
      if (streetsCache.has(city)) { res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000'); return res.status(200).json({ ok: true, city, streets: streetsCache.get(city) }) }
      try {
        const r = await fetch(`https://data.gov.il/api/3/action/datastore_search?resource_id=${STREETS_RESOURCE}&limit=32000&q=${encodeURIComponent(city)}`, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } })
        if (!r.ok) throw new Error(`data.gov.il HTTP ${r.status}`)
        const d = await r.json()
        const recs = d?.result?.records || []
        const cityKey = recs.length ? Object.keys(recs[0]).find(k => /ישוב/.test(k) && !/סמל/.test(k)) : null
        const streetKey = recs.length ? Object.keys(recs[0]).find(k => /רחוב/.test(k) && !/סמל/.test(k)) : null
        const streets = [...new Set(recs.filter(x => String(x[cityKey] || '').trim() === city).map(x => String(x[streetKey] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'))
        streetsCache.set(city, streets)
        res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000')
        return res.status(200).json({ ok: true, city, streets })
      } catch (e) { return res.status(502).json({ ok: false, error: e.message, streets: [] }) }
    }

    // ── signed upload URL (public) ──────────────────────────────────────────
    if (action === 'upload-url') {
      if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })
      if (rateLimited(req, 'upload', 120)) return res.status(429).json({ ok: false, error: 'too many uploads, try again in a minute' })
      const b = req.body || {}
      const sid = String(b.sid || ''), kind = String(b.kind || ''), type = String(b.type || 'application/octet-stream'), size = Number(b.size || 0)
      if (!SID_RE.test(sid)) return res.status(400).json({ ok: false, error: 'invalid sid' })
      if (!KIND_LIMITS[kind]) return res.status(400).json({ ok: false, error: 'invalid kind' })
      if (!KIND_TYPES[kind](type)) return res.status(400).json({ ok: false, error: 'file type not allowed for this kind' })
      if (!size || size > KIND_LIMITS[kind] * 1024 * 1024) return res.status(400).json({ ok: false, error: `file too large (max ${KIND_LIMITS[kind]}MB)` })
      const submitted = await getRow(`sid=eq.${encodeURIComponent(sid)}`, 'submitted_at').catch(() => null)
      if (submitted?.submitted_at) return res.status(409).json({ ok: false, error: 'this property was already submitted' })
      const path = `${sid}/${kind}/${Date.now()}-${rand(3)}-${safeName(b.name)}`
      const data = await signedUploadUrl(sb(), path)
      return res.status(200).json({ ok: true, signedUrl: data.signedUrl, token: data.token, path })
    }

    // ── draft: load / save (public, sid is the secret) ──────────────────────
    if (action === 'draft') {
      if (req.method === 'GET') {
        const sid = String(req.query.sid || '')
        if (!SID_RE.test(sid)) return res.status(400).json({ ok: false, error: 'invalid sid' })
        const row = await getRow(`sid=eq.${encodeURIComponent(sid)}`, 'sid,answers,cur,lang,status,submitted_at,share_token,ref,draft_updated_at')
        res.setHeader('Cache-Control', 'no-store')
        if (!row) return res.status(404).json({ ok: false, error: 'not found' })
        if (row.submitted_at) return res.status(200).json({ ok: true, submitted: true, token: row.share_token, ref: row.ref })
        return res.status(200).json({ ok: true, submitted: false, draft: { answers: row.answers || {}, cur: row.cur || null, lang: row.lang || 'he', updatedAt: row.draft_updated_at } })
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        const b = req.body || {}
        const sid = String(b.sid || '')
        if (!SID_RE.test(sid)) return res.status(400).json({ ok: false, error: 'invalid sid' })
        if (rateLimited(req, 'draft', 90)) return res.status(429).json({ ok: false, error: 'too many requests' })
        const answers = sanitizeAnswers(b.answers)
        if (JSON.stringify(answers).length > 300000) return res.status(413).json({ ok: false, error: 'draft too large' })
        const existing = await getRow(`sid=eq.${encodeURIComponent(sid)}`, 'id,submitted_at,history')
        if (existing?.submitted_at) return res.status(409).json({ ok: false, error: 'already submitted' })
        const patch = { answers, cur: b.cur ? String(b.cur).slice(0, 40) : null, lang: b.lang === 'en' ? 'en' : 'he', files: filesFromAnswers(answers, sid), draft_updated_at: now(), updated_at: now(), ...summaryFields(answers) }
        if (existing) await patchRow(`id=eq.${existing.id}`, patch)
        else await insertRow({ sid, status: 'draft', schema_version: Number(b.schemaVersion || 1), history: [{ at: now(), by: 'seller', action: 'draft_created' }], meta: { ua: String(b.ua || '').slice(0, 300) }, ...patch })
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).json({ ok: true, savedAt: patch.draft_updated_at })
      }
      return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    // ── public summary + owner verification ─────────────────────────────────
    if (action === 'summary' || action === 'verify') {
      const token = String(req.query.token || req.body?.token || '')
      if (!TOKEN_RE.test(token)) return res.status(400).json({ ok: false, error: 'invalid token' })
      const row = await getRow(`share_token=eq.${encodeURIComponent(token)}`)
      res.setHeader('Cache-Control', 'no-store')
      if (!row || !row.submitted_at) return res.status(404).json({ ok: false, error: 'not found' })
      const client = sb()
      if (action === 'verify') {
        if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })
        if (rateLimited(req, 'verify', 10)) return res.status(429).json({ ok: false, error: 'too many requests' })
        const name = String(req.body?.name || '').trim().slice(0, 80)
        if (!name) return res.status(400).json({ ok: false, error: 'name required' })
        const verifications = [...(Array.isArray(row.verifications) ? row.verifications : []), { name, at: now(), ua: String(req.headers['user-agent'] || '').slice(0, 200) }].slice(-50)
        const patch = { verifications, owner_verified_at: row.owner_verified_at || now(), updated_at: now(), history: withHistory(row, { by: 'owner', action: 'verified', note: name }) }
        await patchRow(`id=eq.${row.id}`, patch)
        return res.status(200).json({ ok: true, verifications: verifications.map(v => ({ name: v.name, at: v.at })), owner_verified_at: patch.owner_verified_at })
      }
      return res.status(200).json(await publicView(client, row))
    }

    // ── submission (public) ─────────────────────────────────────────────────
    if (req.method === 'POST' && !action) {
      if (rateLimited(req, 'submit', 6)) return res.status(429).json({ ok: false, error: 'too many submissions, try again in a minute' })
      const b = req.body || {}
      const a = sanitizeAnswers(b.answers)
      const sid = String(b.sid || '')
      if (!SID_RE.test(sid)) return res.status(400).json({ ok: false, error: 'invalid sid' })
      const name = String(a.c_name || '').trim(), phone = String(a.c_phone || '').trim(), email = String(a.c_email || '').trim()
      if (!name || !phone) return res.status(400).json({ ok: false, error: 'name and phone are required' })
      if (!PHONE_RE.test(phone)) return res.status(400).json({ ok: false, error: 'invalid phone number' })
      if (email && !EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'invalid email address' })
      if (a.d_ask !== undefined && a.d_ask !== '' && !(num(a.d_ask) > 0)) return res.status(400).json({ ok: false, error: 'invalid asking price' })
      if (!a.p_address?.city || !a.p_type) return res.status(400).json({ ok: false, error: 'property type and city are required' })
      const files = cleanFiles(b.files, sid)
      const existing = await getRow(`sid=eq.${encodeURIComponent(sid)}`, 'id,ref,share_token,submitted_at,history,status')
      if (existing?.submitted_at) return res.status(200).json({ ok: true, id: existing.id, ref: existing.ref, token: existing.share_token, url: `${SITE}/newproperty/${existing.share_token}`, already: true })
      const ref = existing?.ref || makeRef(), share_token = existing?.share_token || makeToken()
      const row = {
        sid, ref, share_token, status: 'new', lang: b.lang === 'en' ? 'en' : 'he', answers: a, files, cur: null,
        story: typeof b.story === 'string' ? b.story.slice(0, 20000) : storyText(a, 'he'),
        schema_version: Number(b.schemaVersion || 1), submitted_at: now(), updated_at: now(),
        meta: { url: String(b.meta?.url || '').slice(0, 300), ua: String(b.meta?.ua || '').slice(0, 300), durationSec: b.meta?.durationSec },
        history: withHistory(existing, { by: 'seller', action: 'submitted', note: `${name} · ${(files || []).length} קבצים` }),
        ...summaryFields(a),
      }
      let saved
      try { saved = existing ? await patchRow(`id=eq.${existing.id}`, row) : await insertRow(row) }
      catch (e) {
        if (/relation .* does not exist|Could not find the table|404/i.test(e.message)) return res.status(500).json({ ok: false, error: 'seller_submissions table not found — run server/seller-submissions-migration.sql' })
        throw e
      }
      const rec = { ...row, id: saved?.id ?? existing?.id ?? null }
      console.log(`[intake] submitted ${ref} | ${name} | ${headline(a, 'he')}`)
      // Notify the office (capped so we stay inside the function timeout)
      const client = sb()
      const work = (async () => { const signed = await signFiles(client, files, 7 * 24 * 3600).catch(() => files); return Promise.allSettled([notifyEmail(rec, a, signed), notifyWhatsApp(rec, a)]) })()
      const results = await Promise.race([work, new Promise(r => setTimeout(() => r(null), 12000))])
      if (results) results.forEach((r, i) => { const label = ['email', 'whatsapp'][i]; if (r.status === 'rejected') console.error(`[intake] ${label} crashed:`, r.reason?.message); else if (r.value?.ok === false) console.warn(`[intake] ${label} skipped:`, r.value.error) })
      return res.status(201).json({ ok: true, id: rec.id, ref, token: share_token, url: `${SITE}/newproperty/${share_token}` })
    }

    // ── everything below is admin-only ──────────────────────────────────────
    if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'unauthorized' })
    res.setHeader('Cache-Control', 'no-store')

    // Cheap counters for the admin sidebar badge / "new property" alert (polled by the admin panel)
    if (req.method === 'GET' && action === 'stats') {
      const r = await supaFetch(`/${TABLE}?select=id,ref,status,purpose,contact_name,city,property_type,asking_price,submitted_at,owner_verified_at&submitted_at=not.is.null&order=submitted_at.desc&limit=400`)
      if (r.status === 404 || r.status === 406) return res.status(200).json({ ok: true, new: 0, unverified: 0, total: 0, latest: [] })
      if (!r.ok) return res.status(r.status).json({ ok: false, error: await r.text().catch(() => '') })
      const rows = await r.json().catch(() => [])
      const counts = rows.reduce((m, x) => { m[x.status] = (m[x.status] || 0) + 1; return m }, {})
      return res.status(200).json({ ok: true, total: rows.length, new: counts.new || 0, review: counts.review || 0, approved: counts.approved || 0, published: counts.published || 0,
        unverified: rows.filter(x => !x.owner_verified_at).length, sale: rows.filter(x => (x.purpose || 'sale') === 'sale').length, rental: rows.filter(x => x.purpose === 'rental').length,
        latest: rows.slice(0, 8).map(x => ({ id: x.id, ref: x.ref, status: x.status, purpose: x.purpose || 'sale', name: x.contact_name, city: x.city, type: PROPERTY_TYPE_LABEL(x.property_type, 'he'), price: x.asking_price, submitted_at: x.submitted_at })) })
    }

    // Media library: add a file to an existing property (admin) — same bucket/folder layout as the seller's uploads
    if (req.method === 'POST' && action === 'admin-upload-url') {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' })
      const b = req.body || {}
      const kind = String(b.kind || ''), type = String(b.type || 'application/octet-stream'), size = Number(b.size || 0)
      if (!KIND_LIMITS[kind]) return res.status(400).json({ ok: false, error: 'invalid kind' })
      if (!KIND_TYPES[kind](type)) return res.status(400).json({ ok: false, error: 'file type not allowed for this kind' })
      if (!size || size > KIND_LIMITS[kind] * 1024 * 1024) return res.status(400).json({ ok: false, error: `file too large (max ${KIND_LIMITS[kind]}MB)` })
      const row = await getRow(`id=eq.${encodeURIComponent(id)}`, 'id,sid')
      if (!row?.sid) return res.status(404).json({ ok: false, error: 'not found' })
      const path = `${row.sid}/${kind}/${Date.now()}-${rand(3)}-${safeName(b.name)}`
      const data = await signedUploadUrl(sb(), path)
      return res.status(200).json({ ok: true, signedUrl: data.signedUrl, token: data.token, path })
    }
    if (req.method === 'POST' && action === 'file') {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' })
      const row = await getRow(`id=eq.${encodeURIComponent(id)}`, 'id,sid,files,history')
      if (!row?.sid) return res.status(404).json({ ok: false, error: 'not found' })
      const [f] = cleanFiles([req.body || {}], row.sid)
      if (!f || !KIND_LIMITS[f.kind]) return res.status(400).json({ ok: false, error: 'invalid file' })
      const files = [...(Array.isArray(row.files) ? row.files : []).filter(x => x.path !== f.path), f].slice(0, 150)
      await patchRow(`id=eq.${row.id}`, { files, updated_at: now(), history: withHistory(row, { by: 'admin', action: 'file_added', note: `${f.kind} · ${f.name}` }) })
      return res.status(200).json({ ok: true, files: files.length })
    }
    if (req.method === 'DELETE' && action === 'file') {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' })
      const path = String(req.query.path || req.body?.path || '')
      const row = await getRow(`id=eq.${encodeURIComponent(id)}`, 'id,sid,files,meta,history')
      if (!row?.sid) return res.status(404).json({ ok: false, error: 'not found' })
      if (!path.startsWith(`${row.sid}/`)) return res.status(400).json({ ok: false, error: 'invalid path' })
      const client = sb()
      const gone = (Array.isArray(row.files) ? row.files : []).find(x => x.path === path)
      await client.storage.from(BUCKET).remove([path]).catch(() => {})
      const meta = { ...(row.meta || {}) }
      if (meta.publicMedia?.[path]) { await client.storage.from(PUBLIC_BUCKET).remove([`${row.sid}/${path.split('/').pop()}`]).catch(() => {}); const pm = { ...meta.publicMedia }; delete pm[path]; meta.publicMedia = pm }
      const files = (Array.isArray(row.files) ? row.files : []).filter(x => x.path !== path)
      await patchRow(`id=eq.${row.id}`, { files, meta, updated_at: now(), history: withHistory(row, { by: 'admin', action: 'file_deleted', note: gone ? `${gone.kind} · ${gone.name}` : path.split('/').pop() }) })
      return res.status(200).json({ ok: true, files: files.length })
    }

    if (req.method === 'GET' && action === 'file-url') {
      const path = String(req.query.path || '')
      if (!path) return res.status(400).json({ ok: false, error: 'path required' })
      const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(path, 3600)
      if (error) return res.status(404).json({ ok: false, error: error.message })
      return res.status(200).json({ ok: true, url: data.signedUrl })
    }

    if (req.method === 'GET') {
      if (id) {
        const row = await getRow(`id=eq.${encodeURIComponent(id)}`)
        if (!row) return res.status(404).json({ ok: false, error: 'not found' })
        row.files = await signFiles(sb(), row.files || [], 3600)
        row.public_url = row.share_token ? `${SITE}/newproperty/${row.share_token}` : null
        row.form_url = row.sid ? `${SITE}/newproperty?d=${row.sid}` : null
        return res.status(200).json(row)
      }
      const cols = 'id,ref,sid,status,lang,purpose,contact_name,phone,email,city,address,property_type,asking_price,files,notes,created_at,updated_at,submitted_at,draft_updated_at,owner_verified_at,verifications,published_property_id,published_at,share_token'
      const r = await supaFetch(`/${TABLE}?select=${cols}&order=created_at.desc&limit=1000`)
      if (r.status === 404 || r.status === 406) return res.status(200).json([])
      if (!r.ok) return res.status(r.status).json({ ok: false, error: await r.text().catch(() => '') })
      const rows = await r.json().catch(() => [])
      return res.status(200).json(rows.map(x => ({ ...x, files_count: Array.isArray(x.files) ? x.files.length : 0, photos_count: Array.isArray(x.files) ? x.files.filter(f => f.kind === 'photos').length : 0, files: undefined, verifications_count: Array.isArray(x.verifications) ? x.verifications.length : 0, verifications: undefined, property_type_label: PROPERTY_TYPE_LABEL(x.property_type, 'he') })))
    }

    if (req.method === 'PATCH') {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' })
      const b = req.body || {}
      const row = await getRow(`id=eq.${encodeURIComponent(id)}`, 'id,status,notes,overrides,history,published_property_id,purpose')
      if (!row) return res.status(404).json({ ok: false, error: 'not found' })
      const patch = { updated_at: now() }
      let history = Array.isArray(row.history) ? row.history : []
      if (typeof b.status === 'string' && b.status !== row.status) {
        if (!STATUS_VALUES.includes(b.status)) return res.status(400).json({ ok: false, error: 'invalid status' })
        if (b.status === 'published') return res.status(400).json({ ok: false, error: 'use action=publish' })
        patch.status = b.status
        history = [...history, { at: now(), by: 'admin', action: 'status', note: `${row.status} → ${b.status}` }]
        // Single source of truth: a property that is live on the site follows the intake status
        if (row.published_property_id && ['sold', 'inactive'].includes(b.status)) {
          const siteStatus = b.status === 'sold' ? (row.purpose === 'rental' ? 'הושכר' : 'נמכר') : 'לא פעיל'
          try {
            const current = await renderGet(row.published_property_id)
            if (current) { await renderPut({ ...current, id: row.published_property_id, published: false, status: siteStatus, updatedAt: now() }); history = [...history, { at: now(), by: 'system', action: 'unpublished', note: `${siteStatus} · הוסר מהאתר אוטומטית` }] }
          } catch (e) { history = [...history, { at: now(), by: 'system', action: 'status', note: `עדכון האתר נכשל: ${e.message}` }] }
        }
      }
      if (typeof b.notes === 'string' && b.notes !== (row.notes || '')) { patch.notes = b.notes.slice(0, 20000); history = [...history, { at: now(), by: 'admin', action: 'notes' }] }
      if (b.overrides && typeof b.overrides === 'object') {
        const allowed = ['title', 'price', 'description', 'rooms', 'size', 'type', 'category', 'region', 'showAddress', 'showPhone', 'minPrice', 'ai_copy']
        const next = { ...(row.overrides || {}) }
        const changed = []
        allowed.forEach(k => { if (k in b.overrides) { const v = b.overrides[k]; if (v === '' || v === null || v === undefined) delete next[k]; else if (k === 'ai_copy') { if (typeof v === 'object' && JSON.stringify(v).length <= 40000) next[k] = Object.fromEntries(Object.entries(v).filter(([ck, cv]) => /^[a-z_]{1,24}$/.test(ck) && typeof cv === 'string').map(([ck, cv]) => [ck, cv.slice(0, 6000)])) } else next[k] = typeof v === 'string' ? v.slice(0, 5000) : v; changed.push(k) } })
        patch.overrides = next
        if (changed.length) history = [...history, { at: now(), by: 'admin', action: 'edit', note: changed.join(', ') }]
      }
      patch.history = history.slice(-200)
      await patchRow(`id=eq.${row.id}`, patch)
      return res.status(200).json({ ok: true, status: patch.status || row.status, overrides: patch.overrides || row.overrides || {} })
    }

    // Repopulate the office's property wizard: photos copied to the public bucket, videos signed,
    // every answer mapped to the site's property shape — nothing is pushed to the site yet.
    if (req.method === 'POST' && action === 'prepare') {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' })
      const row = await getRow(`id=eq.${encodeURIComponent(id)}`)
      if (!row) return res.status(404).json({ ok: false, error: 'not found' })
      if (!row.submitted_at) return res.status(400).json({ ok: false, error: 'draft cannot be prepared' })
      const media = await publishMedia(sb(), row)
      const property = { ...buildSiteProperty(row, media), published: false }
      await patchRow(`id=eq.${row.id}`, { meta: { ...(row.meta || {}), publicMedia: media.map }, updated_at: now(),
        history: withHistory(row, { by: 'admin', action: 'edit', note: `נפתח באשף הנכסים · ${media.images.length} תמונות, ${media.videos.length} סרטונים` }) })
      return res.status(200).json({ ok: true, property, images: media.images.length, videos: media.videos.length })
    }
    // The wizard saved/published the property itself — record the link and the status here
    if (req.method === 'POST' && action === 'linked') {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' })
      const row = await getRow(`id=eq.${encodeURIComponent(id)}`, 'id,status,history,published_at,published_property_id')
      if (!row) return res.status(404).json({ ok: false, error: 'not found' })
      const b = req.body || {}
      const propertyId = String(b.propertyId || row.published_property_id || '').slice(0, 120)
      if (!propertyId) return res.status(400).json({ ok: false, error: 'propertyId required' })
      const published = !!b.published
      const patch = { published_property_id: propertyId, updated_at: now(),
        status: published ? 'published' : (row.status === 'published' ? 'published' : (['new', 'review'].includes(row.status) ? 'approved' : row.status)),
        published_at: published ? (row.published_at || now()) : row.published_at,
        history: withHistory(row, { by: 'admin', action: published ? (row.status === 'published' ? 'republished' : 'published') : 'edit', note: `${published ? 'פורסם' : 'נשמר כטיוטה'} דרך אשף הנכסים · property ${propertyId}` }) }
      await patchRow(`id=eq.${row.id}`, patch)
      return res.status(200).json({ ok: true, status: patch.status })
    }
    if (req.method === 'POST' && (action === 'publish' || action === 'unpublish')) {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' })
      const row = await getRow(`id=eq.${encodeURIComponent(id)}`)
      if (!row) return res.status(404).json({ ok: false, error: 'not found' })
      if (!row.submitted_at) return res.status(400).json({ ok: false, error: 'draft cannot be published' })
      const client = sb()
      if (action === 'publish') {
        if (!['approved', 'published'].includes(row.status)) return res.status(400).json({ ok: false, error: 'only an approved property can be published' })
        const media = await publishMedia(client, row)
        const property = buildSiteProperty(row, media)
        const saved = await renderPut(property)
        const patch = { status: 'published', published_property_id: String(property.id), published_at: row.published_at || now(), updated_at: now(),
          meta: { ...(row.meta || {}), publicMedia: media.map, lastPublishStorage: saved?.storage || null },
          history: withHistory(row, { by: 'admin', action: row.status === 'published' ? 'republished' : 'published', note: `property ${property.id} · ${media.images.length} תמונות` }) }
        await patchRow(`id=eq.${row.id}`, patch)
        return res.status(200).json({ ok: true, propertyId: property.id, images: media.images.length, videos: media.videos.length, storage: saved?.storage || null })
      }
      // unpublish: keep the property record in the generator, just hide it on the site
      if (!row.published_property_id) return res.status(400).json({ ok: false, error: 'not published' })
      const current = await renderGet(row.published_property_id).catch(() => null)
      const media = { images: current?.images || [], videos: current?.videos || [], map: (row.meta || {}).publicMedia || {} }
      const property = { ...(current || buildSiteProperty(row, media)), id: row.published_property_id, published: false, status: 'לא פעיל', updatedAt: now() }
      await renderPut(property)
      const patch = { status: 'approved', updated_at: now(), history: withHistory(row, { by: 'admin', action: 'unpublished', note: `property ${row.published_property_id}` }) }
      await patchRow(`id=eq.${row.id}`, patch)
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' })
      const row = await getRow(`id=eq.${encodeURIComponent(id)}`, 'id,sid,status,published_property_id')
      if (!row) return res.status(404).json({ ok: false, error: 'not found' })
      if (row.status === 'published') return res.status(400).json({ ok: false, error: 'unpublish first' })
      const r = await supaFetch(`/${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      if (!r.ok) return res.status(r.status).json({ ok: false, error: await r.text().catch(() => '') })
      // Media is deleted only on an explicit request (never as a side effect)
      if (String(req.query.media || '') === '1' && row.sid) await removeAllFiles(sb(), row.sid).catch(e => console.warn('[intake] media cleanup failed:', e.message))
      return res.status(200).json({ ok: true, mediaDeleted: String(req.query.media || '') === '1' })
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('[intake]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
