// Vercel serverless — contacts CRUD backed by Supabase + email notification on new lead.
// Supabase never sleeps → DELETE and PATCH are reliable regardless of Render's state.
//
// Required Vercel env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD
//
// One-time SQL migration (run in Supabase SQL editor):
//   CREATE TABLE IF NOT EXISTS contacts (
//     id TEXT PRIMARY KEY,
//     name TEXT, phone TEXT, email TEXT, message TEXT,
//     prop_title TEXT, prop_location TEXT,
//     source TEXT DEFAULT 'website',
//     crm_data JSONB DEFAULT '{}',
//     created_at TIMESTAMPTZ DEFAULT NOW()
//   );
//   CREATE INDEX IF NOT EXISTS contacts_created_at_idx ON contacts(created_at DESC);

import nodemailer from 'nodemailer'

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const ADMIN_TOKEN = 'AFIKhanahal2026'

// ── Green API (token stays server-side) ──────────────────────────────────────
const GREEN_INSTANCE          = process.env.WA_GREENAPI_INSTANCE || ''
const GREEN_TOKEN             = process.env.WA_GREENAPI_TOKEN    || ''
const BUSINESS_NOTIFY_CHATID  = process.env.BUSINESS_NOTIFY_CHATID || ''
const GREEN_BASE_URL = (() => {
  const region = String(GREEN_INSTANCE).slice(0, 4)
  return region ? `https://${region}.api.greenapi.com` : 'https://api.green-api.com'
})()
const greenUrl = (method) => `${GREEN_BASE_URL}/waInstance${GREEN_INSTANCE}/${method}/${GREEN_TOKEN}`
const WA_AUTOREPLY_ENABLED  = process.env.WA_AUTOREPLY_ENABLED !== 'false'   // default on
const WA_AUTOREPLY_TEMPLATE = process.env.WA_AUTOREPLY_TEMPLATE || `היי {name} 👋
תודה שהשארת פרטים!
ראינו את הפנייה שלך

מתי נוח לך לדבר? נשמח לתאם שיחה

צוות אפיק הנחל`

function toIntlPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('972')) return d
  if (d.startsWith('0'))   return '972' + d.slice(1)
  return d
}

// Low-level send — chatId may be "972XXXXXXXX@c.us" or a raw phone number.
async function sendToChatId(chatId, message) {
  if (!GREEN_INSTANCE || !GREEN_TOKEN) return { ok: false, error: 'Green API not configured (WA_GREENAPI_INSTANCE/TOKEN)' }
  if (!chatId) return { ok: false, error: 'no chatId' }
  const finalChatId = chatId.includes('@') ? chatId : `${toIntlPhone(chatId)}@c.us`
  if (!finalChatId || finalChatId === '@c.us') return { ok: false, error: 'invalid chatId' }
  try {
    const r = await fetch(greenUrl('sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: finalChatId, message }),
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) return { ok: false, error: `Green API HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}` }
    const d = await r.json().catch(() => ({}))
    return { ok: true, idMessage: d.idMessage || null }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// Send to a phone number (converts to chatId automatically).
async function sendGreenMessage(phone, message) {
  const p = toIntlPhone(phone)
  if (!p) return { ok: false, error: 'invalid phone' }
  return sendToChatId(`${p}@c.us`, message)
}

// Auto-reply to the lead who submitted the form.
async function sendLeadAutoReply(lead) {
  if (!WA_AUTOREPLY_ENABLED || !lead.phone) return
  const firstName = String(lead.name || '').split(' ')[0] || ''
  const msg = WA_AUTOREPLY_TEMPLATE.replace(/\{name\}/g, firstName)
  const r = await sendGreenMessage(lead.phone, msg)
  if (!r.ok) console.error('[lead-autoreply]', r.error)
}

// Notify the business owner (admin) about a new lead.
async function notifyAdmin(lead) {
  if (!BUSINESS_NOTIFY_CHATID) return
  const ts = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })
  const lines = [
    '🔔 *ליד חדש התקבל!*',
    '',
    `👤 שם: ${lead.name || '—'}`,
    `📱 טלפון: ${lead.phone ? `https://wa.me/${toIntlPhone(lead.phone)}` : '—'}`,
  ]
  if (lead.email)                       lines.push(`📧 אימייל: ${lead.email}`)
  if (lead.message || lead.msg)         lines.push(`💬 הודעה: ${lead.message || lead.msg}`)
  if (lead.prop_title || lead.propTitle) lines.push(`🏠 נכס: ${lead.prop_title || lead.propTitle}`)
  if (lead.source)                      lines.push(`📍 מקור: ${lead.source}`)
  lines.push(`🕐 ${ts}`)
  const r = await sendToChatId(BUSINESS_NOTIFY_CHATID, lines.join('\n'))
  if (!r.ok) console.error('[admin-notify]', r.error)
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function supaFetch(path, opts = {}) {
  const r = await fetch(`${SUPA_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey:         SUPA_KEY,
      Authorization:  `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
      ...(opts.headers || {}),
    },
    signal: opts.signal || AbortSignal.timeout(10000),
  })
  return r
}

async function getContacts() {
  const r = await supaFetch('/contacts?order=created_at.desc&limit=500')
  if (!r.ok) throw new Error(`Supabase GET ${r.status}: ${await r.text().catch(() => '')}`)
  return r.json()
}

async function insertContact(row) {
  const r = await supaFetch('/contacts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  })
  if (!r.ok) {
    const msg = await r.text().catch(() => '')
    // Conflict (duplicate id) — still OK, just return the id
    if (r.status === 409) return row
    throw new Error(`Supabase INSERT ${r.status}: ${msg}`)
  }
  const rows = await r.json().catch(() => [])
  return Array.isArray(rows) ? rows[0] : rows
}

async function getCrmData(id) {
  const r = await supaFetch(`/contacts?id=eq.${encodeURIComponent(id)}&select=crm_data`, {
    signal: AbortSignal.timeout(5000),
  })
  if (!r.ok) return {}
  const rows = await r.json().catch(() => [])
  return rows[0]?.crm_data || {}
}

async function patchContact(id, body) {
  const url = `/contacts?id=eq.${encodeURIComponent(id)}`
  const r = await supaFetch(url, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  })
  return r.ok
}

async function deleteContact(id) {
  const r = await supaFetch(`/contacts?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
    signal: AbortSignal.timeout(8000),
  })
  return r.ok
}

// ── Email notification ────────────────────────────────────────────────────────

async function sendLeadEmail(lead) {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return

  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  const ts = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })

  await transporter.sendMail({
    from: `"אפיק הנחל CRM" <${user}>`,
    to: user,
    subject: `🔔 ליד חדש: ${lead.name || lead.phone || 'אנונימי'} — אפיק הנחל`,
    html: `
      <div dir="rtl" style="font-family:Arial,sans-serif;direction:rtl;max-width:520px;margin:0 auto;background:#f9f9f9;padding:24px;border-radius:12px">
        <h2 style="color:#8490D8;margin:0 0 16px">🔔 ליד חדש התקבל!</h2>
        <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
          ${lead.name    ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#666;width:120px">שם</td><td style="padding:10px 16px;border-bottom:1px solid #eee;font-weight:700;color:#222">${lead.name}</td></tr>` : ''}
          ${lead.phone   ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#666">טלפון</td><td style="padding:10px 16px;border-bottom:1px solid #eee"><a href="tel:${lead.phone}" style="color:#0073EA;font-weight:700;text-decoration:none">${lead.phone}</a></td></tr>` : ''}
          ${lead.email   ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#666">אימייל</td><td style="padding:10px 16px;border-bottom:1px solid #eee"><a href="mailto:${lead.email}" style="color:#0073EA;text-decoration:none">${lead.email}</a></td></tr>` : ''}
          ${lead.msg || lead.message ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#666">הודעה</td><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#333">${lead.msg || lead.message}</td></tr>` : ''}
          ${lead.propTitle ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#666">נכס</td><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#333">${lead.propTitle}</td></tr>` : ''}
          ${lead.source  ? `<tr><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#666">מקור</td><td style="padding:10px 16px;border-bottom:1px solid #eee;color:#333">${lead.source}</td></tr>` : ''}
          <tr><td style="padding:10px 16px;color:#666">תאריך</td><td style="padding:10px 16px;color:#333">${ts}</td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#999">נשלח אוטומטית ממערכת CRM אפיק הנחל</p>
      </div>`,
  })
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v))
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── Sub-action: test-email (merged from /api/contacts/test-email) ────────────
  if (req.query.action === 'test-email') {
    if (req.method !== 'POST') return res.status(405).end()
    if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const user = process.env.GMAIL_USER
    const pass = process.env.GMAIL_APP_PASSWORD
    if (!user || !pass) {
      return res.status(500).json({ error: 'GMAIL_USER / GMAIL_APP_PASSWORD לא מוגדרים ב-Vercel env vars' })
    }
    try {
      const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
      await transporter.sendMail({
        from: `"אפיק הנחל CRM" <${user}>`,
        to: user,
        subject: '✅ בדיקת אימייל — מערכת CRM אפיק הנחל',
        html: `
          <div dir="rtl" style="font-family:Arial,sans-serif;direction:rtl;max-width:480px;margin:0 auto">
            <h2 style="color:#8490D8;margin-bottom:8px">✅ אימייל בדיקה נשלח בהצלחה!</h2>
            <p style="color:#333;line-height:1.7">מערכת האימייל של <strong>אפיק הנחל CRM</strong> פועלת כראוי.</p>
            <p style="color:#666;font-size:13px">נשלח מ-${user}</p>
          </div>`,
      })
      return res.status(200).json({ ok: true })
    } catch (e) {
      console.error('[test-email]', e.message)
      return res.status(500).json({ ok: false, error: e.message })
    }
  }

  // ── Sub-action: test-wa (admin button — server-side Green API send) ──────────
  if (req.query.action === 'test-wa') {
    if (req.method !== 'POST') return res.status(405).end()
    if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const phone = req.body?.phone || '0559811814'
    const result = await sendGreenMessage(phone, 'הודעת בדיקה ממערכת אפיק הנחל ✅')
    return res.status(result.ok ? 200 : 500).json(result)
  }

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({
      error: 'SUPABASE_URL / SUPABASE_SERVICE_KEY not configured in Vercel env vars',
    })
  }

  const id = req.query.id || req.body?.id

  try {
    // ── GET: list all contacts ───────────────────────────────────────────────
    if (req.method === 'GET') {
      const contacts = await getContacts()
      return res.status(200).json(contacts)
    }

    // ── POST: create new contact ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const b = req.body || {}
      const row = {
        id:           b.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
        name:         b.name         || null,
        phone:        b.phone        || null,
        email:        b.email        || null,
        message:      b.msg          || b.message || null,
        prop_title:   b.propTitle    || null,
        prop_location:b.propLocation || null,
        source:       b.source       || 'website',
        crm_data:     {},
      }
      const inserted = await insertContact(row)
      // Fire all notifications in parallel, never block the response.
      sendLeadEmail(b).catch(e => console.error('[lead-email]', e.message))
      sendLeadAutoReply(row).catch(e => console.error('[lead-autoreply]', e.message))
      notifyAdmin(row).catch(e => console.error('[admin-notify]', e.message))
      return res.status(201).json(inserted || row)
    }

    // ── PATCH: update CRM data (merge with existing) ─────────────────────────
    if (req.method === 'PATCH') {
      if (!id) return res.status(400).json({ error: 'id required' })
      const patch = req.body || {}
      // Merge patch into existing crm_data so partial updates don't wipe other fields
      const existing = await getCrmData(id)
      const merged   = { ...existing, ...patch }
      const ok       = await patchContact(id, { crm_data: merged })
      return res.status(ok ? 200 : 404).json({ ok })
    }

    // ── DELETE: remove contact permanently ───────────────────────────────────
    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'id required' })
      const ok = await deleteContact(id)
      return res.status(ok ? 200 : 404).json({ ok })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('[contacts]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
