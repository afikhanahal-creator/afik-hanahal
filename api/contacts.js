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

// nodemailer is loaded dynamically inside sendLeadEmail to prevent a static-import
// crash from taking down the entire module (same fix applied to meta.js).

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
  if (!GREEN_INSTANCE || !GREEN_TOKEN) {
    console.error('[green-api] WA_GREENAPI_INSTANCE or WA_GREENAPI_TOKEN not set in Vercel env vars')
    return { ok: false, error: 'Green API not configured (WA_GREENAPI_INSTANCE/TOKEN missing in Vercel)' }
  }
  if (!chatId) return { ok: false, error: 'no chatId' }
  const finalChatId = chatId.includes('@') ? chatId : `${toIntlPhone(chatId)}@c.us`
  if (!finalChatId || finalChatId === '@c.us') return { ok: false, error: 'invalid chatId' }
  console.log('[green-api] sending to', finalChatId, '| instance:', GREEN_INSTANCE)
  try {
    const r = await fetch(greenUrl('sendMessage'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: finalChatId, message }),
      signal: AbortSignal.timeout(20000),
    })
    const text = await r.text()
    if (!r.ok) {
      console.error('[green-api] HTTP', r.status, text.slice(0, 300))
      return { ok: false, error: `Green API HTTP ${r.status}: ${text.slice(0, 200)}` }
    }
    let d; try { d = JSON.parse(text) } catch { d = {} }
    console.log('[green-api] ✓ sent, idMessage:', d.idMessage || 'n/a')
    return { ok: true, idMessage: d.idMessage || null }
  } catch (e) {
    console.error('[green-api] error:', e.message)
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
  // Falls back to Afik's number (055-981-1814 = 972559811814) so the alert
  // still fires even when BUSINESS_NOTIFY_CHATID was never configured on Vercel.
  const target = BUSINESS_NOTIFY_CHATID || '972559811814'
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
  const r = await sendToChatId(target, lines.join('\n'))
  if (r.ok) console.log(`[admin-notify] ✓ alert sent to ${target}`)
  else      console.error(`[admin-notify] failed sending to ${target}: ${r.error}`)
  return r
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
  // 404 / 406 means the contacts table hasn't been created yet — return empty instead of 500
  if (r.status === 404 || r.status === 406) {
    console.warn('[contacts] table not found — run the SQL migration in Supabase')
    return []
  }
  if (!r.ok) throw new Error(`Supabase GET ${r.status}: ${await r.text().catch(() => '')}`)
  return r.json()
}

async function insertContact(row) {
  const r = await supaFetch('/contacts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  })
  if (r.ok) {
    const rows = await r.json().catch(() => [])
    return Array.isArray(rows) ? rows[0] : rows
  }
  if (r.status === 409) return row  // duplicate id — already saved

  const msg = await r.text().catch(() => '')
  // Schema-mismatch retry: if the Supabase contacts table is missing optional
  // columns (e.g. crm_data was never migrated), strip unknown fields and try
  // again. The error message includes 'Could not find the X column'.
  const missingCol = /Could not find the '([^']+)' column/i.exec(msg)
  if (missingCol && missingCol[1] in row) {
    const colName = missingCol[1]
    console.warn(`[contacts] retrying INSERT without missing column '${colName}'`)
    const { [colName]: _dropped, ...trimmed } = row
    return insertContact(trimmed)   // recursive retry — may strip more cols
  }
  throw new Error(`Supabase INSERT ${r.status}: ${msg}`)
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
  // Schema-mismatch: drop unknown columns and retry. Keeps CRM-edit alive even
  // if the contacts table is missing crm_data — at worst, that field silently
  // no-ops until the column is migrated.
  if (!r.ok) {
    const msg = await r.text().catch(() => '')
    const missingCol = /Could not find the '([^']+)' column/i.exec(msg)
    if (missingCol && missingCol[1] in body) {
      const colName = missingCol[1]
      const { [colName]: _dropped, ...trimmed } = body
      console.warn(`[contacts] PATCH retrying without missing column '${colName}'`)
      if (Object.keys(trimmed).length === 0) return true  // nothing left to write
      return patchContact(id, trimmed)
    }
    console.error(`[contacts] PATCH failed: ${r.status} — ${msg}`)
    return false
  }
  return true
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

const ADMIN_PANEL_URL = 'https://www.afikhanahal.co.il/admin-panel'

function buildLeadEmailHtml({ name, phone, email, message, propTitle, source, campaign, ts, badge }) {
  const phoneIntl = phone ? toIntlPhone(phone) : ''
  const phoneDisplay = phone ? (phoneIntl.startsWith('972') ? '0' + phoneIntl.slice(3) : phone) : ''
  const rows = [
    name      && { label: 'שם',       value: `<strong style="color:#1a1a2e">${name}</strong>` },
    phone     && { label: 'טלפון',    value: `<a href="https://wa.me/${phoneIntl}" style="color:#25D366;font-weight:700;text-decoration:none">📱 ${phoneDisplay}</a>&nbsp;&nbsp;<a href="tel:${phone}" style="color:#0073EA;font-size:13px;text-decoration:none">חייג</a>` },
    email     && { label: 'אימייל',   value: `<a href="mailto:${email}" style="color:#0073EA;text-decoration:none">${email}</a>` },
    message   && { label: 'הודעה',    value: `<span style="color:#333;line-height:1.6">${message}</span>` },
    propTitle && { label: 'נכס',      value: `<span style="color:#555">${propTitle}</span>` },
    campaign  && { label: 'קמפיין',   value: `<span style="color:#8490D8;font-weight:600">${campaign}</span>` },
    source    && { label: 'מקור',     value: `<span style="color:#555">${source}</span>` },
    ts        && { label: 'תאריך',    value: `<span style="color:#888">${ts}</span>` },
  ].filter(Boolean)

  const tableRows = rows.map(r => `
    <tr>
      <td style="padding:11px 18px;border-bottom:1px solid #eef0f5;color:#888;font-size:13px;white-space:nowrap;width:110px;text-align:right">${r.label}</td>
      <td style="padding:11px 18px;border-bottom:1px solid #eef0f5;font-size:14px;text-align:right">${r.value}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f7;font-family:Arial,'Helvetica Neue',sans-serif;direction:rtl">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f7;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#2d2d5e 100%);border-radius:14px 14px 0 0;padding:28px 32px;text-align:right">
          <div style="color:#8490D8;font-size:13px;font-weight:600;letter-spacing:1px;margin-bottom:6px">אפיק הנחל — ייזום שיווק ותיווך</div>
          <div style="color:#fff;font-size:22px;font-weight:800;margin-bottom:4px">🔔 ${badge || 'ליד חדש התקבל'}</div>
          <div style="color:#a0a8c8;font-size:13px">${ts || ''}</div>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#fff;border-radius:0 0 14px 14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${tableRows}
          </table>

          <!-- CTA button -->
          <div style="padding:24px 32px 28px;text-align:center">
            <a href="${ADMIN_PANEL_URL}"
               style="display:inline-block;background:linear-gradient(135deg,#8490D8,#6070c8);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:13px 36px;border-radius:50px;box-shadow:0 4px 16px rgba(132,144,216,.4);letter-spacing:.3px">
              כניסה למערכת הניהול ←
            </a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 0 0;text-align:center">
          <p style="margin:0;font-size:12px;color:#aaa">מייל זה נשלח אוטומטית ממערכת CRM · <a href="${ADMIN_PANEL_URL}" style="color:#8490D8;text-decoration:none">אפיק הנחל</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendLeadEmail(lead) {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  const to   = process.env.ADMIN_NOTIFY_EMAIL || user
  if (!user || !pass) {
    console.warn('[lead-email] skipped — GMAIL_USER / GMAIL_APP_PASSWORD missing on Vercel')
    return { ok: false, error: 'GMAIL_USER / GMAIL_APP_PASSWORD missing' }
  }
  const ts = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  try {
    const { default: nodemailer } = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host:   'smtp.gmail.com',
      port:   465,
      secure: true,
      auth:   { user, pass: pass.replace(/\s+/g, '') },
    })
    const info = await transporter.sendMail({
      from:    `"אפיק הנחל CRM" <${user}>`,
      to,
      subject: `🔔 ליד חדש: ${lead.name || lead.phone || 'אנונימי'} — אפיק הנחל`,
      html:    buildLeadEmailHtml({
        name:      lead.name,
        phone:     lead.phone,
        email:     lead.email,
        message:   lead.msg || lead.message,
        propTitle: lead.propTitle || lead.prop_title,
        source:    lead.source,
        ts,
      }),
    })
    console.log(`[lead-email] ✓ sent to ${to}, messageId: ${info.messageId}`)
    return { ok: true, messageId: info.messageId }
  } catch (e) {
    console.error(`[lead-email] failed sending to ${to}: ${e.message}`)
    return { ok: false, error: e.message }
  }
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
      const { default: nodemailer } = await import('nodemailer')
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
        // No custom id — let Supabase auto-generate it.
        // The contacts table uses bigint (serial), so sending a text id causes a 400.
        name:         b.name         || null,
        phone:        b.phone        || null,
        email:        b.email        || null,
        message:      b.msg          || b.message || null,
        prop_title:   b.propTitle    || null,
        prop_location:b.propLocation || null,
        source:       b.source       || 'website',
        crm_data:     {},
      }
      console.log(`[new-lead] ${row.name || '—'} | ${row.phone || '—'} | source=${row.source}`)

      // Fast-path dedup: SAME phone submitted in the last 2 minutes (double-click /
      // form retry / network retry) → skip insert AND notifications entirely.
      // Best-effort: any error here never blocks a genuine lead.
      if (row.phone) {
        try {
          const since = new Date(Date.now() - 2 * 60 * 1000).toISOString()
          const dupR = await supaFetch(`/contacts?phone=eq.${encodeURIComponent(row.phone)}&created_at=gte.${encodeURIComponent(since)}&select=id&order=created_at.desc&limit=1`)
          if (dupR.ok) {
            const dups = await dupR.json().catch(() => [])
            if (Array.isArray(dups) && dups.length) {
              console.log(`[new-lead] duplicate within 2min for ${row.phone} — skipping notify + insert`)
              return res.status(200).json(dups[0])
            }
          }
        } catch { /* dedup is best-effort — never block a real lead */ }
      }

      // Insert FIRST so the saved row is the atomic dedup anchor. This closes the
      // race where two near-simultaneous submits both pass the fast-path check
      // above (neither has inserted yet) and both fire an email.
      let inserted = row
      let insertOk = false
      try {
        inserted = await insertContact(row) || row
        insertOk = !!(inserted && inserted.id)
      } catch (dbErr) {
        console.error('[new-lead] DB insert failed (will still notify as fallback):', dbErr.message)
      }

      // Originality gate: only the EARLIEST same-phone row in the 2-min window sends
      // notifications. Concurrent duplicates see an earlier row and defer → exactly
      // ONE email per lead, sent immediately after the row lands. If the insert
      // failed we can't dedup reliably, so we fall back to notifying (never lose a lead).
      let shouldNotify = true
      if (insertOk && row.phone) {
        try {
          const since = new Date(Date.now() - 2 * 60 * 1000).toISOString()
          const origR = await supaFetch(`/contacts?phone=eq.${encodeURIComponent(row.phone)}&created_at=gte.${encodeURIComponent(since)}&select=id&order=created_at.asc&limit=1`)
          if (origR.ok) {
            const rows = await origR.json().catch(() => [])
            if (rows[0] && String(rows[0].id) !== String(inserted.id)) {
              shouldNotify = false
              console.log(`[new-lead] not the original submission for ${row.phone} — skipping duplicate notify`)
            }
          }
        } catch { /* best-effort — on error, default to notifying */ }
      }

      if (shouldNotify) {
        // Fire all 3 notifications immediately, in parallel. Hard 12s cap fits the 30s maxDuration.
        const labels = ['lead-email', 'admin-wa', 'lead-autoreply']
        const work = Promise.allSettled([
          sendLeadEmail(b),
          notifyAdmin(row),
          sendLeadAutoReply(row),
        ])
        const results = await Promise.race([
          work,
          new Promise(resolve => setTimeout(() => resolve(null), 12000)),
        ])
        if (results) {
          results.forEach((r, i) => {
            if (r.status === 'rejected')              console.error(`[${labels[i]}] crashed:`, r.reason?.message || r.reason)
            else if (r.value && r.value.ok === false) console.error(`[${labels[i]}] failed:`, r.value.error)
          })
        } else {
          console.warn('[new-lead] notifications past 12s cap — completing in background')
          work.then(rs => rs.forEach((r, i) => {
            if (r.status === 'rejected')              console.error(`[${labels[i]}] late-crash:`, r.reason?.message || r.reason)
            else if (r.value && r.value.ok === false) console.error(`[${labels[i]}] late-fail:`, r.value.error)
          })).catch(() => {})
        }
      }

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
