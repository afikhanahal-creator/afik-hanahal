// Vercel serverless — seller intake form (/sell) backend.
//
//   POST  /api/seller-form                     public  — store a submission, notify the office
//   POST  /api/seller-form?action=upload-url   public  — mint a signed Supabase Storage upload URL
//   GET   /api/seller-form?action=streets&city= public  — street names of a locality (data.gov.il, cached)
//   GET   /api/seller-form                     admin   — list submissions
//   GET   /api/seller-form?id=123              admin   — one submission + signed download URLs
//   PATCH /api/seller-form?id=123              admin   — update status / notes
//   DELETE /api/seller-form?id=123             admin   — delete submission + its files
//
// Files never pass through this function (Vercel caps bodies at 4.5MB): the
// browser PUTs straight to Supabase Storage using a short-lived signed URL, so
// videos of a couple hundred MB work fine. The bucket is PRIVATE — the admin
// panel reads files through signed URLs that expire after an hour.
//
// Required Vercel env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY
// Optional (notifications): GMAIL_USER, GMAIL_APP_PASSWORD, ADMIN_NOTIFY_EMAIL,
//                            WA_GREENAPI_INSTANCE, WA_GREENAPI_TOKEN, BUSINESS_NOTIFY_CHATID
//
// One-time SQL migration: server/seller-submissions-migration.sql
import { createClient } from '@supabase/supabase-js'
import { buildSummary, headline, PROPERTY_TYPE_LABEL, DOC_TAG_LABEL } from '../src/sellerFormSchema.js'

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const ADMIN_TOKEN = 'AFIKhanahal2026'
const BUCKET = 'seller-uploads'
const TABLE = 'seller_submissions'
const SITE = 'https://afikhanahal.co.il'

const KIND_LIMITS = { photos: 25, videos: 200, plan: 25, docs: 25 }   // MB
const STREETS_RESOURCE = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b'         // data.gov.il "רחובות בישראל"
const streetsCache = new Map()                                            // per warm lambda
const KIND_TYPES = {
  photos: t => t.startsWith('image/'),
  videos: t => t.startsWith('video/'),
  plan:   t => t.startsWith('image/') || t === 'application/pdf',
  docs:   t => t.startsWith('image/') || t === 'application/pdf',
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}
const isAdmin = req => (req.headers.authorization || '').replace(/^Bearer\s+/i, '') === ADMIN_TOKEN
const sb = () => createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// ── Supabase REST helpers (same pattern as contacts.js) ──────────────────────
async function supaFetch(path, opts = {}) {
  return fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json', Accept: 'application/json',
      ...(opts.headers || {}),
    },
    signal: opts.signal || AbortSignal.timeout(10000),
  })
}

async function insertRow(table, row) {
  const r = await supaFetch(`/${table}`, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
  if (r.ok) { const rows = await r.json().catch(() => []); return Array.isArray(rows) ? rows[0] : rows }
  const msg = await r.text().catch(() => '')
  const missingCol = /Could not find the '([^']+)' column/i.exec(msg)
  if (missingCol && missingCol[1] in row) {
    console.warn(`[seller-form] retrying INSERT into ${table} without column '${missingCol[1]}'`)
    const { [missingCol[1]]: _dropped, ...trimmed } = row
    return insertRow(table, trimmed)
  }
  throw new Error(`Supabase INSERT ${table} ${r.status}: ${msg}`)
}

const safeName = n => String(n || 'file').normalize('NFKD').replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-80) || 'file'
const rand = (n = 4) => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)]; return s }
const makeRef = () => { const d = new Date(); const ymd = d.toISOString().slice(2, 10).replace(/-/g, ''); return `AH-${ymd}-${rand(4)}` }
const toIntlPhone = raw => { const d = String(raw || '').replace(/\D/g, ''); if (!d) return ''; if (d.startsWith('972')) return d; if (d.startsWith('0')) return '972' + d.slice(1); return d }
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const fmtILS = n => (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) ? '' : '₪' + Number(n).toLocaleString('he-IL')

// ── storage ──────────────────────────────────────────────────────────────────
async function ensureBucket(client) {
  const { error } = await client.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 209715200 })
  if (error && !/already exists|duplicate/i.test(error.message || '')) throw new Error(`createBucket: ${error.message}`)
}

async function signedUploadUrl(client, path) {
  let { data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error && /not found|does not exist/i.test(error.message || '')) {
    await ensureBucket(client)
    ;({ data, error } = await client.storage.from(BUCKET).createSignedUploadUrl(path))
  }
  if (error) throw new Error(`createSignedUploadUrl: ${error.message}`)
  return data
}

async function signFiles(client, files, expires = 3600) {
  const paths = (files || []).map(f => f.path).filter(Boolean)
  if (!paths.length) return files || []
  const { data, error } = await client.storage.from(BUCKET).createSignedUrls(paths, expires)
  if (error) { console.warn('[seller-form] createSignedUrls:', error.message); return files }
  const byPath = Object.fromEntries((data || []).map(d => [d.path, d.signedUrl]))
  return files.map(f => ({ ...f, url: byPath[f.path] || null }))
}

async function removeAllFiles(client, sid) {
  if (!sid) return
  for (const kind of Object.keys(KIND_LIMITS)) {
    const { data } = await client.storage.from(BUCKET).list(`${sid}/${kind}`, { limit: 200 })
    const names = (data || []).map(x => `${sid}/${kind}/${x.name}`)
    if (names.length) await client.storage.from(BUCKET).remove(names)
  }
}

// ── notifications (best effort, never block the submission) ──────────────────
const GREEN_INSTANCE = process.env.WA_GREENAPI_INSTANCE || ''
const GREEN_TOKEN    = process.env.WA_GREENAPI_TOKEN || ''
const NOTIFY_CHATID  = process.env.BUSINESS_NOTIFY_CHATID || '972559811814'
const greenBase = () => { const region = String(GREEN_INSTANCE).slice(0, 4); return region ? `https://${region}.api.greenapi.com` : 'https://api.green-api.com' }

async function notifyWhatsApp(row, a) {
  if (!GREEN_INSTANCE || !GREEN_TOKEN) return { ok: false, error: 'Green API not configured' }
  const chatId = NOTIFY_CHATID.includes('@') ? NOTIFY_CHATID : `${toIntlPhone(NOTIFY_CHATID)}@c.us`
  const ts = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })
  const lines = [
    '🏠 *טופס שיווק נכס חדש!*', '',
    `📁 תיק: ${row.ref}`,
    `👤 ${row.contact_name || '—'}`,
    `📱 ${row.phone ? `https://wa.me/${toIntlPhone(row.phone)}` : '—'}`,
    `🏷 ${headline(a, 'he') || '—'}`,
    row.asking_price ? `💰 מחיר מבוקש: ${fmtILS(row.asking_price)}` : null,
    `📎 ${(row.files || []).length} קבצים`,
    `🔗 ${SITE}/admin-panel/seller-forms`,
    `🕐 ${ts}`,
  ].filter(Boolean)
  try {
    const r = await fetch(`${greenBase()}/waInstance${GREEN_INSTANCE}/sendMessage/${GREEN_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message: lines.join('\n') }), signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) return { ok: false, error: `Green API HTTP ${r.status}` }
    return { ok: true }
  } catch (e) { return { ok: false, error: e.message } }
}

function buildEmailHtml(row, a, signedFiles) {
  const sections = buildSummary(a, 'he')
  const secHtml = sections.map(sec => `
    <h3 style="margin:26px 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#3F4EB0">${esc(sec.title)}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${sec.items.map(it => `<tr>
        <td style="padding:7px 10px;border-top:1px solid #ECECF2;color:#7A7A8A;width:38%;vertical-align:top">${esc(it.label)}</td>
        <td style="padding:7px 10px;border-top:1px solid #ECECF2;color:#0B0B0F;white-space:pre-wrap">${esc(it.value)}</td>
      </tr>`).join('')}
    </table>`).join('')
  const filesHtml = signedFiles.length ? `
    <h3 style="margin:26px 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#3F4EB0">קבצים (${signedFiles.length})</h3>
    <ul style="padding-inline-start:18px;font-size:14px;line-height:1.8">
      ${signedFiles.map(f => `<li>${f.url ? `<a href="${esc(f.url)}" style="color:#3F4EB0">${esc(f.name)}</a>` : esc(f.name)} <span style="color:#7A7A8A">· ${esc(f.kind)}${f.tag ? ' · ' + esc(DOC_TAG_LABEL(f.tag, 'he')) : ''}</span></li>`).join('')}
    </ul>
    <p style="font-size:12px;color:#7A7A8A">הקישורים לקבצים תקפים ל-7 ימים. הקבצים נשמרים לצמיתות בתיק הנכס בפאנל הניהול.</p>` : ''
  const storyHtml = row.story ? `
    <h3 style="margin:22px 0 6px;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#3F4EB0">סיפור הנכס</h3>
    <div style="font-size:15px;line-height:1.7;white-space:pre-wrap;background:#F7F7FA;border-radius:10px;padding:14px 16px">${esc(row.story)}</div>` : ''
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#F5F5F9;font-family:Heebo,Arial,sans-serif;color:#0B0B0F">
    <div style="max-width:680px;margin:0 auto;padding:28px 16px">
      <div style="background:#fff;border-radius:16px;padding:28px 30px;border:1px solid #E6E6EC">
        <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#3F4EB0;font-weight:700">אפיק הנחל · טופס שיווק נכס</div>
        <h1 style="margin:8px 0 4px;font-size:24px">${esc(headline(a, 'he') || 'נכס חדש לשיווק')}</h1>
        <div style="font-size:14px;color:#7A7A8A">תיק ${esc(row.ref)} · ${esc(row.contact_name || '')} · <a href="tel:${esc(row.phone || '')}" style="color:#3F4EB0">${esc(row.phone || '')}</a>${row.email ? ` · <a href="mailto:${esc(row.email)}" style="color:#3F4EB0">${esc(row.email)}</a>` : ''}</div>
        ${row.asking_price ? `<div style="margin-top:14px;display:inline-block;background:#F2F3FB;border:1px solid #E4E7F8;border-radius:10px;padding:8px 14px;font-weight:700">מחיר מבוקש: ${fmtILS(row.asking_price)}</div>` : ''}
        ${storyHtml}
        ${secHtml}
        ${filesHtml}
        <div style="margin-top:28px;text-align:center"><a href="${SITE}/admin-panel/seller-forms" style="display:inline-block;background:#0B0B0F;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">פתיחה בפאנל הניהול</a></div>
      </div>
    </div></body></html>`
}

async function notifyEmail(row, a, signedFiles) {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD
  const to = process.env.ADMIN_NOTIFY_EMAIL || user
  if (!user || !pass) return { ok: false, error: 'GMAIL_USER / GMAIL_APP_PASSWORD missing' }
  try {
    const { default: nodemailer } = await import('nodemailer')
    const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass: pass.replace(/\s+/g, '') } })
    const cc = row.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) ? row.email : undefined
    await transporter.sendMail({
      from: `"אפיק הנחל CRM" <${user}>`, to, cc,
      subject: `🏠 טופס שיווק נכס: ${headline(a, 'he') || row.contact_name || row.ref} — תיק ${row.ref}`,
      html: buildEmailHtml(row, a, signedFiles),
    })
    return { ok: true }
  } catch (e) { return { ok: false, error: e.message } }
}

// ── handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (!SUPA_URL || !SUPA_KEY) return res.status(500).json({ ok: false, error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not configured in Vercel env vars' })

  const action = req.query.action || ''
  const id = req.query.id || req.body?.id

  try {
    // ── signed upload URL (public) ──────────────────────────────────────────
    if (action === 'upload-url') {
      if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' })
      const b = req.body || {}
      const sid = String(b.sid || '')
      const kind = String(b.kind || '')
      const type = String(b.type || 'application/octet-stream')
      const size = Number(b.size || 0)
      if (!/^[\w-]{8,64}$/.test(sid)) return res.status(400).json({ ok: false, error: 'invalid sid' })
      if (!KIND_LIMITS[kind]) return res.status(400).json({ ok: false, error: 'invalid kind' })
      if (!KIND_TYPES[kind](type)) return res.status(400).json({ ok: false, error: 'file type not allowed for this kind' })
      if (!size || size > KIND_LIMITS[kind] * 1024 * 1024) return res.status(400).json({ ok: false, error: `file too large (max ${KIND_LIMITS[kind]}MB)` })
      const path = `${sid}/${kind}/${Date.now()}-${rand(3)}-${safeName(b.name)}`
      const data = await signedUploadUrl(sb(), path)
      return res.status(200).json({ ok: true, signedUrl: data.signedUrl, token: data.token, path })
    }

    // ── streets of a locality (public, proxied from data.gov.il, CDN-cached) ──
    if (action === 'streets') {
      const city = String(req.query.city || '').trim().slice(0, 60)
      if (!city) return res.status(400).json({ ok: false, error: 'city required' })
      if (streetsCache.has(city)) { res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000'); return res.status(200).json({ ok: true, city, streets: streetsCache.get(city) }) }
      try {
        const u = `https://data.gov.il/api/3/action/datastore_search?resource_id=${STREETS_RESOURCE}&limit=32000&q=${encodeURIComponent(city)}`
        const r = await fetch(u, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } })
        if (!r.ok) throw new Error(`data.gov.il HTTP ${r.status}`)
        const d = await r.json()
        const recs = d?.result?.records || []
        const cityKey = recs.length ? Object.keys(recs[0]).find(k => /ישוב/.test(k) && !/סמל/.test(k)) : null
        const streetKey = recs.length ? Object.keys(recs[0]).find(k => /רחוב/.test(k) && !/סמל/.test(k)) : null
        const streets = [...new Set(recs.filter(x => String(x[cityKey] || '').trim() === city).map(x => String(x[streetKey] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he'))
        streetsCache.set(city, streets)
        res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=2592000')
        return res.status(200).json({ ok: true, city, streets })
      } catch (e) {
        console.warn('[seller-form] streets lookup failed:', e.message)
        return res.status(502).json({ ok: false, error: e.message, streets: [] })
      }
    }

    // ── public submission ───────────────────────────────────────────────────
    if (req.method === 'POST' && !action) {
      const b = req.body || {}
      const a = b.answers && typeof b.answers === 'object' ? b.answers : {}
      const name = String(a.c_name || '').trim()
      const phone = String(a.c_phone || '').trim()
      if (!name || !phone) return res.status(400).json({ ok: false, error: 'name and phone are required' })
      const files = (Array.isArray(b.files) ? b.files : []).filter(f => f && typeof f.path === 'string' && f.path.startsWith(`${b.sid}/`)).slice(0, 120)
        .map(f => ({ name: String(f.name || '').slice(0, 200), size: Number(f.size || 0), type: String(f.type || ''), kind: String(f.kind || ''), tag: f.tag ? String(f.tag) : null, path: f.path }))
      const addr = a.p_address || {}
      const row = {
        ref: makeRef(),
        sid: String(b.sid || '').slice(0, 64) || null,
        status: 'new',
        lang: b.lang === 'en' ? 'en' : 'he',
        contact_name: name,
        phone,
        email: String(a.c_email || '').trim() || null,
        city: addr.city || null,
        address: [addr.street, addr.number, addr.apt ? `דירה ${addr.apt}` : null].filter(Boolean).join(' ') || null,
        property_type: a.p_type || null,
        asking_price: a.d_ask !== undefined && a.d_ask !== '' && !Number.isNaN(Number(a.d_ask)) ? Number(a.d_ask) : null,
        answers: a,
        files,
        story: typeof b.story === 'string' ? b.story.slice(0, 20000) : null,
        schema_version: Number(b.schemaVersion || 1),
        meta: b.meta && typeof b.meta === 'object' ? { url: b.meta.url, ua: String(b.meta.ua || '').slice(0, 300), durationSec: b.meta.durationSec } : {},
      }
      console.log(`[seller-form] new submission ${row.ref} | ${name} | ${phone} | ${headline(a, 'he')}`)

      let inserted
      try {
        inserted = await insertRow(TABLE, row)
      } catch (e) {
        if (/relation .* does not exist|Could not find the table|404/i.test(e.message)) {
          console.error('[seller-form] table missing — run server/seller-submissions-migration.sql')
          return res.status(500).json({ ok: false, error: 'seller_submissions table not found — run the SQL migration in Supabase' })
        }
        throw e
      }

      // Mirror into the contacts (leads) table so the seller shows up in the CRM board too.
      const lead = insertRow('contacts', {
        name, phone, email: row.email,
        message: `טופס שיווק נכס — תיק ${row.ref}\n${headline(a, 'he')}${row.asking_price ? `\nמחיר מבוקש: ${fmtILS(row.asking_price)}` : ''}`,
        prop_title: headline(a, 'he') || null, prop_location: row.city, source: 'seller-form', crm_data: { sellerRef: row.ref, sellerSubmissionId: inserted?.id ?? null },
      }).catch(e => console.warn('[seller-form] contacts mirror failed:', e.message))

      // Notify office (12s cap so we stay well inside the function timeout)
      const client = sb()
      const work = (async () => {
        const signedFiles = await signFiles(client, files, 7 * 24 * 3600).catch(() => files)
        return Promise.allSettled([notifyEmail(row, a, signedFiles), notifyWhatsApp(row, a)])
      })()
      const results = await Promise.race([Promise.all([work, lead]), new Promise(r => setTimeout(() => r(null), 12000))])
      if (results) {
        results[0].forEach((r, i) => {
          const label = ['email', 'whatsapp'][i]
          if (r.status === 'rejected') console.error(`[seller-form] ${label} crashed:`, r.reason?.message)
          else if (r.value && r.value.ok === false) console.warn(`[seller-form] ${label} skipped/failed:`, r.value.error)
        })
      } else console.warn('[seller-form] notifications past 12s cap — completing in background')

      return res.status(201).json({ ok: true, id: inserted?.id ?? null, ref: row.ref })
    }

    // ── everything below is admin-only ──────────────────────────────────────
    if (!isAdmin(req)) return res.status(401).json({ ok: false, error: 'unauthorized' })

    if (req.method === 'GET' && action === 'file-url') {
      const path = String(req.query.path || '')
      if (!path) return res.status(400).json({ ok: false, error: 'path required' })
      const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(path, 3600)
      if (error) return res.status(404).json({ ok: false, error: error.message })
      return res.status(200).json({ ok: true, url: data.signedUrl })
    }

    if (req.method === 'GET') {
      if (id) {
        const r = await supaFetch(`/${TABLE}?id=eq.${encodeURIComponent(id)}&limit=1`)
        if (!r.ok) return res.status(r.status).json({ ok: false, error: await r.text().catch(() => '') })
        const rows = await r.json().catch(() => [])
        if (!rows[0]) return res.status(404).json({ ok: false, error: 'not found' })
        const row = rows[0]
        row.files = await signFiles(sb(), row.files || [], 3600)
        return res.status(200).json(row)
      }
      const cols = 'id,ref,status,lang,contact_name,phone,email,city,address,property_type,asking_price,files,notes,created_at,updated_at'
      const r = await supaFetch(`/${TABLE}?select=${cols}&order=created_at.desc&limit=500`)
      if (r.status === 404 || r.status === 406) return res.status(200).json([])
      if (!r.ok) return res.status(r.status).json({ ok: false, error: await r.text().catch(() => '') })
      const rows = await r.json().catch(() => [])
      res.setHeader('Cache-Control', 'no-store')
      return res.status(200).json(rows.map(x => ({ ...x, files_count: Array.isArray(x.files) ? x.files.length : 0, files: undefined, property_type_label: PROPERTY_TYPE_LABEL(x.property_type, 'he') })))
    }

    if (req.method === 'PATCH') {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' })
      const b = req.body || {}
      const patch = { updated_at: new Date().toISOString() }
      if (typeof b.status === 'string') patch.status = b.status.slice(0, 40)
      if (typeof b.notes === 'string') patch.notes = b.notes.slice(0, 20000)
      const r = await supaFetch(`/${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
      if (!r.ok) return res.status(r.status).json({ ok: false, error: await r.text().catch(() => '') })
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ ok: false, error: 'id required' })
      const r0 = await supaFetch(`/${TABLE}?id=eq.${encodeURIComponent(id)}&select=sid&limit=1`)
      const rows = r0.ok ? await r0.json().catch(() => []) : []
      const r = await supaFetch(`/${TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      if (!r.ok) return res.status(r.status).json({ ok: false, error: await r.text().catch(() => '') })
      if (rows[0]?.sid) removeAllFiles(sb(), rows[0].sid).catch(e => console.warn('[seller-form] file cleanup failed:', e.message))
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('[seller-form]', e.message)
    return res.status(500).json({ ok: false, error: e.message })
  }
}
