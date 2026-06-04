// Vercel serverless — combined Meta Lead Ads router
// Routes by ?_path= query param (set via vercel.json rewrite from /api/meta/*)
//
//  webhook  → GET verify / POST lead event
//  leads    → GET list all leads
//  messages → GET thread / POST send message
//  sync     → GET historical sync from Meta

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const SUPERMETRICS_API_KEY    = process.env.SUPERMETRICS_API_KEY    || ''
const META_PAGE_ACCESS_TOKEN  = process.env.META_PAGE_ACCESS_TOKEN  || process.env.WA_META_TOKEN || ''
const META_APP_SECRET         = process.env.META_APP_SECRET         || ''
const META_LEADS_VERIFY_TOKEN = process.env.META_LEADS_VERIFY_TOKEN || 'AFIKhanahal2026leads'
const ADMIN_TOKEN             = process.env.ADMIN_TOKEN             || 'AFIKhanahal2026'
const WA_META_TOKEN           = process.env.WA_META_TOKEN           || ''
const PHONE_NUMBER_ID         = process.env.WA_PHONE_NUMBER_ID      || '1160230953835065'
const SUPABASE_URL            = process.env.SUPABASE_URL            || process.env.VITE_SUPABASE_URL        || ''
const SUPABASE_KEY            = process.env.SUPABASE_SERVICE_KEY    || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const META_NOTIFY_PHONE       = process.env.META_NOTIFY_PHONE       || '972559811814'

// ── Green API (admin notifications) ──────────────────────────────────────────
const GREEN_INSTANCE = process.env.WA_GREENAPI_INSTANCE || ''
const GREEN_TOKEN    = process.env.WA_GREENAPI_TOKEN    || ''
const BUSINESS_NOTIFY_CHATID = (() => {
  const raw = (process.env.BUSINESS_NOTIFY_CHATID || '972559811814').replace(/\D/g, '')
  return raw ? `${raw}@c.us` : ''
})()
const GREEN_BASE_URL = (() => {
  const region = String(GREEN_INSTANCE).slice(0, 4)
  return region ? `https://${region}.api.greenapi.com` : 'https://api.green-api.com'
})()
// Build a Green API method URL. The apiToken stays server-side — never sent to the browser.
const greenUrl = (method) => `${GREEN_BASE_URL}/waInstance${GREEN_INSTANCE}/${method}/${GREEN_TOKEN}`

const ADMIN_PANEL_URL = 'https://www.afikhanahal.co.il/admin-panel'

// ── Email notification ────────────────────────────────────────────────────────

function buildLeadEmailHtml({ name, phone, email, message, campaign, source, ts, badge }) {
  const d = String(phone || '').replace(/\D/g, '')
  const phoneIntl    = d.startsWith('972') ? d : d.startsWith('0') ? '972' + d.slice(1) : d
  const phoneDisplay = phoneIntl.startsWith('972') ? '0' + phoneIntl.slice(3) : phone || ''

  const rows = [
    name     && { label: 'שם',      value: `<strong style="color:#1a1a2e">${name}</strong>` },
    phone    && { label: 'טלפון',   value: `<a href="https://wa.me/${phoneIntl}" style="color:#25D366;font-weight:700;text-decoration:none">📱 ${phoneDisplay}</a>&nbsp;&nbsp;<a href="tel:${phone}" style="color:#0073EA;font-size:13px;text-decoration:none">חייג</a>` },
    email    && { label: 'אימייל',  value: `<a href="mailto:${email}" style="color:#0073EA;text-decoration:none">${email}</a>` },
    message  && { label: 'הודעה',   value: `<span style="color:#333;line-height:1.6">${message}</span>` },
    campaign && { label: 'קמפיין',  value: `<span style="color:#8490D8;font-weight:600">${campaign}</span>` },
    source   && { label: 'מקור',    value: `<span style="color:#555">${source}</span>` },
    ts       && { label: 'תאריך',   value: `<span style="color:#888">${ts}</span>` },
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
        <tr><td style="background:linear-gradient(135deg,#1a1a2e 0%,#2d2d5e 100%);border-radius:14px 14px 0 0;padding:28px 32px;text-align:right">
          <div style="color:#8490D8;font-size:13px;font-weight:600;letter-spacing:1px;margin-bottom:6px">אפיק הנחל — ייזום שיווק ותיווך</div>
          <div style="color:#fff;font-size:22px;font-weight:800;margin-bottom:4px">🔔 ${badge || 'ליד חדש התקבל'}</div>
          <div style="color:#a0a8c8;font-size:13px">${ts || ''}</div>
        </td></tr>
        <tr><td style="background:#fff;border-radius:0 0 14px 14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10)">
          <table width="100%" cellpadding="0" cellspacing="0">${tableRows}</table>
          <div style="padding:24px 32px 28px;text-align:center">
            <a href="${ADMIN_PANEL_URL}" style="display:inline-block;background:linear-gradient(135deg,#8490D8,#6070c8);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:13px 36px;border-radius:50px;box-shadow:0 4px 16px rgba(132,144,216,.4)">
              כניסה למערכת הניהול ←
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:18px 0 0;text-align:center">
          <p style="margin:0;font-size:12px;color:#aaa">מייל זה נשלח אוטומטית ממערכת CRM · <a href="${ADMIN_PANEL_URL}" style="color:#8490D8;text-decoration:none">אפיק הנחל</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function sendMetaLeadEmail({ name, phone, email, campaign, message, ts }) {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  const to   = process.env.ADMIN_NOTIFY_EMAIL || user
  if (!user || !pass) {
    console.warn('[meta-lead-email] skipped — GMAIL_USER / GMAIL_APP_PASSWORD missing on Vercel')
    return
  }
  try {
    // Dynamic import keeps a potential nodemailer bundling issue from crashing the module
    const { default: nodemailer } = await import('nodemailer')
    // Explicit smtp.gmail.com:465 + secure — service:'gmail' can fail on Vercel
    // cold-starts. App-password spaces are stripped (Google shows them with spaces).
    const transporter = nodemailer.createTransport({
      host:   'smtp.gmail.com',
      port:   465,
      secure: true,
      auth:   { user, pass: pass.replace(/\s+/g, '') },
    })
    const timestamp = ts || new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const info = await transporter.sendMail({
      from:    `"אפיק הנחל CRM" <${user}>`,
      to,
      subject: `🔔 ליד Meta חדש: ${name || phone || 'אנונימי'} — אפיק הנחל`,
      html:    buildLeadEmailHtml({ name, phone, email, campaign, message, ts: timestamp, badge: 'ליד חדש ממטא' }),
    })
    console.log(`[meta-lead-email] ✓ sent to ${to}, messageId: ${info.messageId}`)
  } catch (e) {
    console.error(`[meta-lead-email] failed sending to ${to}: ${e.message}`)
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
}

function sb() {
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

function checkAuth(req) {
  const auth = req.headers['authorization'] || ''
  return auth.replace(/^Bearer\s+/i, '') === ADMIN_TOKEN
}

function normalizePhone(raw) {
  if (!raw) return raw
  const d = String(raw).replace(/\D/g, '')
  if (d.startsWith('972')) return d
  if (d.startsWith('0'))   return '972' + d.slice(1)
  return d
}

function parseFieldData(fieldData) {
  const f = {}
  for (const item of fieldData || []) {
    const key = (item.name || '').toLowerCase().replace(/[\s_-]/g, '')
    const val = Array.isArray(item.values) ? item.values[0] : item.value
    if (!val) continue
    if (key.includes('fullname') || key.includes('name'))  f.name  = f.name  || val
    if (key.includes('email'))                              f.email = f.email || val
    if (key.includes('phone') || key.includes('mobile'))   f.phone = f.phone || val
  }
  return f
}

async function graphGet(path, token) {
  const url = `https://graph.facebook.com/v20.0${path}${path.includes('?') ? '&' : '?'}access_token=${token}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Graph ${path} → HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

async function sendWA(to, message) {
  try {
    const r = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${WA_META_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message, preview_url: false } }),
    })
    if (!r.ok) { console.error('[WA]', await r.text()); return null }
    return (await r.json())?.messages?.[0]?.id || null
  } catch (e) { console.error('[WA]', e); return null }
}

// Sends admin notification via Green API with one automatic retry
async function sendGreenNotify(chatId, message) {
  if (!GREEN_INSTANCE || !GREEN_TOKEN || !chatId) return
  const url = `${GREEN_BASE_URL}/waInstance${GREEN_INSTANCE}/sendMessage/${GREEN_TOKEN}`
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message }),
        signal: AbortSignal.timeout(15000),
      })
      if (r.ok) { console.log(`[GreenNotify] ✓ sent to ${chatId}`); return }
      console.error(`[GreenNotify] attempt ${attempt}: HTTP ${r.status} — ${(await r.text().catch(() => '')).slice(0, 200)}`)
    } catch (e) {
      console.error(`[GreenNotify] attempt ${attempt} error: ${e.message}`)
    }
    if (attempt < 2) await new Promise(res => setTimeout(res, 3000))
  }
  console.error('[GreenNotify] all attempts failed — notification not delivered (lead is safe)')
}

// ── route handlers ────────────────────────────────────────────────────────────

async function handleWebhook(req, res) {
  if (req.method === 'GET') {
    const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query
    if (mode === 'subscribe' && token === META_LEADS_VERIFY_TOKEN) {
      console.log('[MetaLeads] Webhook verified')
      return res.status(200).send(challenge)
    }
    return res.status(403).json({ error: 'Verify token mismatch' })
  }

  if (req.method === 'POST') {
    // CRITICAL: must NOT respond before processing. Vercel kills the function as
    // soon as the response is flushed, so all the lead-save + WA/email work would
    // die mid-flight. We respond at the END once everything has run (or thrown).
    // Meta accepts up to ~20s for the webhook response; our maxDuration is 30s.

    try {
      if (META_APP_SECRET) {
        const sig      = req.headers['x-hub-signature-256'] || ''
        // Must use raw bytes — Meta signs the original payload, not re-serialised JSON
        const expected = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(req.rawBody || '').digest('hex')
        if (sig !== expected) { console.warn('[MetaLeads] Signature mismatch'); return res.status(403).json({ error: 'signature mismatch' }) }
      }

      const body = req.body
      if (body?.object !== 'page') return res.status(200).json({ status: 'ignored', reason: 'not a page event' })

      const client = sb()
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'leadgen') continue
          const { leadgen_id, page_id } = change.value || {}
          if (!leadgen_id) continue

          let leadData, campaignName = '', formName = ''
          try {
            leadData = await graphGet(`/${leadgen_id}?fields=id,created_time,field_data,campaign_id,ad_id,form_id,page_id`, META_PAGE_ACCESS_TOKEN)
          } catch (e) { console.error('[MetaLeads] fetch lead:', e.message); continue }

          if (leadData.campaign_id) {
            try { campaignName = (await graphGet(`/${leadData.campaign_id}?fields=name`, META_PAGE_ACCESS_TOKEN)).name || '' } catch {}
          }
          if (leadData.form_id) {
            try { formName = (await graphGet(`/${leadData.form_id}?fields=name`, META_PAGE_ACCESS_TOKEN)).name || '' } catch {}
          }

          const parsed = parseFieldData(leadData.field_data)
          const phone  = normalizePhone(parsed.phone)
          const name   = parsed.name  || ''
          const email  = parsed.email || ''

          // Atomic claim: plain INSERT (not upsert). If this leadgen_id already
          // exists we get a 23505 unique-violation — meaning this is a Meta webhook
          // RETRY (Meta re-delivers if it didn't get our 200 fast enough) or the
          // client sync already saved it. In that case we skip ALL notifications so
          // the admin is never emailed/pinged twice for the same lead.
          const { data: inserted, error: insErr } = await client
            .from('meta_leads')
            .insert({
              leadgen_id, name, email, phone,
              campaign_id: leadData.campaign_id || null, campaign_name: campaignName,
              ad_id: leadData.ad_id || null, form_id: leadData.form_id || null, form_name: formName,
              raw_fields: leadData.field_data || [], page_id: leadData.page_id || page_id || null,
              status: 'new',
            })
            .select('id').single()

          if (insErr) {
            if (insErr.code === '23505' || /duplicate key|already exists/i.test(insErr.message || '')) {
              console.log(`[MetaLeads] ${leadgen_id} already saved — skipping duplicate notification`)
              continue
            }
            console.error('[MetaLeads] insert:', insErr); continue
          }

          const leadId    = inserted?.id
          const firstName = name.split(' ')[0] || name
          if (phone) {
            const waMsg = `היי ${firstName} 👋\nתודה שפנית לאפיק הנחל!\nראינו את הפנייה שלך\n\nמתי נוח לך לדבר? נשמח לתאם שיחה`
            let waSent = false

            if (WA_META_TOKEN) {
              const waId = await sendWA(phone, waMsg)
              waSent = !!waId
              if (leadId) {
                await client.from('meta_messages').insert({ lead_id: leadId, direction: 'out', message: waMsg, wa_message_id: waId || null })
                await client.from('meta_leads').update({ wa_sent: true }).eq('id', leadId)
              }
            }

            // Fallback: send via Green API when Meta token not configured or send failed
            if (!waSent && GREEN_INSTANCE && GREEN_TOKEN) {
              const custChatId = phone.startsWith('972') ? `${phone}@c.us` : `972${phone.replace(/^0/, '')}@c.us`
              await sendGreenNotify(custChatId, waMsg).catch(() => {})
              if (leadId && !WA_META_TOKEN) {
                await client.from('meta_messages').insert({ lead_id: leadId, direction: 'out', message: waMsg, wa_message_id: null }).catch(() => {})
                await client.from('meta_leads').update({ wa_sent: true }).eq('id', leadId).catch(() => {})
              }
            }
          }

          // ── Admin notification via Green API ──────────────────────────────
          {
            const displayPhone = phone ? (phone.startsWith('972') ? '0' + phone.slice(3) : phone) : '—'
            const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            // Extract free-text message field if present in the lead form
            const msgField = (leadData.field_data || []).find(f =>
              ['message','msg','הודעה','תיאור','description','comments','comment','text'].some(k =>
                (f.name || '').toLowerCase().includes(k)
              )
            )
            const msgText = msgField ? (Array.isArray(msgField.values) ? msgField.values[0] : msgField.value) || '' : ''
            const notifyLines = [
              '🔔 ליד חדש',
              `שם: ${name || '—'}`,
              `טלפון: ${displayPhone}`,
              email ? `אימייל: ${email}` : null,
              `קמפיין: ${campaignName || formName || '—'}`,
              msgText ? `הודעה: ${msgText}` : null,
              `התקבל: ${now}`,
            ].filter(Boolean).join('\n')
            // AWAIT both — fire-and-forget here was being killed by Vercel as
            // soon as the response was flushed, so the admin never got pinged.
            await Promise.allSettled([
              sendGreenNotify(BUSINESS_NOTIFY_CHATID, notifyLines),
              sendMetaLeadEmail({ name, phone, email, campaign: campaignName || formName, message: msgText, ts: now }),
            ]).then(rs => rs.forEach((r, i) => {
              const lbl = i === 0 ? 'admin-wa' : 'admin-email'
              if (r.status === 'rejected') console.error(`[${lbl}] crashed:`, r.reason?.message || r.reason)
            }))
          }

          // Legacy: notify via Meta Business WA API if token is configured
          if (WA_META_TOKEN && META_NOTIFY_PHONE) {
            const displayPhone = phone ? (phone.startsWith('972') ? '0' + phone.slice(3) : phone) : '—'
            const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            const notifyMsg = [
              '🔔 ליד חדש נכנס!',
              '',
              `👤 שם: ${name || '—'}`,
              `📞 טלפון: ${displayPhone}`,
              email ? `📧 אימייל: ${email}` : null,
              `📣 קמפיין: ${campaignName || formName || '—'}`,
              `📅 ${now}`,
            ].filter(Boolean).join('\n')
            await sendWA(META_NOTIFY_PHONE, notifyMsg)
          }
        }
      }
    } catch (err) {
      console.error('[MetaLeads] unhandled:', err)
      if (!res.headersSent) return res.status(200).json({ status: 'error', error: err.message })
      return
    }
    // ALL processing done — only NOW respond. Meta will accept this 200.
    if (!res.headersSent) return res.status(200).json({ status: 'ok' })
    return
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleLeads(req, res) {
  if (req.method === 'PATCH') {
    if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
    const { id, status, notes, call_time, deleted_at } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id required' })
    const updates = {}
    if (status     !== undefined) updates.status     = status
    if (notes      !== undefined) updates.notes      = notes
    if (call_time  !== undefined) updates.call_time  = call_time
    if (deleted_at !== undefined) updates.deleted_at = deleted_at  // null = restore, ISO string = soft-delete
    const { error } = await sb().from('meta_leads').update(updates).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAuth(req))      return res.status(401).json({ error: 'Unauthorized' })
  if (!SUPABASE_URL)        return res.status(500).json({ error: 'SUPABASE_URL not configured in Vercel env vars' })
  if (!SUPABASE_KEY)        return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY not configured in Vercel env vars' })

  const client   = sb()
  const showDel  = req.query.deleted === '1'  // ?deleted=1 → archived leads only

  let query = client.from('meta_leads').select('*').order('created_at', { ascending: false })
  if (showDel) {
    query = query.not('deleted_at', 'is', null)
  } else {
    query = query.is('deleted_at', null)
  }

  const { data: leads, error } = await query
  if (error) {
    const msg = error.message || ''
    // Guide the user if the table simply doesn't exist yet
    if (msg.includes('does not exist') || msg.includes('relation')) {
      return res.status(500).json({ error: 'טבלת meta_leads לא קיימת — הרץ את ה-SQL ב-Supabase (ראה הוראות)' })
    }
    return res.status(500).json({ error: msg })
  }
  if (!leads?.length) return res.status(200).json({ leads: [] })

  const { data: msgs } = await client.from('meta_messages').select('lead_id').in('lead_id', leads.map(l => l.id))
  const countMap = {}
  for (const m of msgs || []) countMap[m.lead_id] = (countMap[m.lead_id] || 0) + 1

  return res.status(200).json({ leads: leads.map(l => ({ ...l, message_count: countMap[l.id] || 0 })) })
}

async function handleMessages(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (!SUPABASE_URL)   return res.status(500).json({ error: 'Supabase not configured' })

  const client = sb()

  if (req.method === 'GET') {
    const { lead_id } = req.query
    if (!lead_id) return res.status(400).json({ error: 'lead_id required' })
    const { data, error } = await client.from('meta_messages').select('*').eq('lead_id', lead_id).order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ messages: data || [] })
  }

  if (req.method === 'POST') {
    const { lead_id, message } = req.body || {}
    if (!lead_id || !message) return res.status(400).json({ error: 'lead_id and message required' })

    const { data: lead, error: leadErr } = await client.from('meta_leads').select('id,phone').eq('id', lead_id).single()
    if (leadErr || !lead)  return res.status(404).json({ error: 'Lead not found' })
    if (!lead.phone)       return res.status(400).json({ error: 'Lead has no phone number' })

    let waId = null
    if (WA_META_TOKEN) {
      waId = await sendWA(lead.phone, message)
    } else if (GREEN_INSTANCE && GREEN_TOKEN) {
      const cid = lead.phone.startsWith('972') ? `${lead.phone}@c.us` : `972${lead.phone.replace(/^0/, '')}@c.us`
      await sendGreenNotify(cid, message).catch(() => {})
    }
    const { data: newMsg, error: insertErr } = await client.from('meta_messages')
      .insert({ lead_id: lead.id, direction: 'out', message, wa_message_id: waId || null })
      .select('*').single()
    if (insertErr) return res.status(500).json({ error: insertErr.message })
    return res.status(201).json({ message: newMsg })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// Resolve all page IDs to sync:
// 1. ?page_id=X query param (single, for manual override)
// 2. META_PAGE_IDS env var (comma-separated list, e.g. "591701444021114,otherPageId")
// 3. META_PAGE_ID env var (single legacy)
function resolvePageIds(query) {
  if (query.page_id) return [query.page_id]
  const multi = (process.env.META_PAGE_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (multi.length) return multi
  const single = process.env.META_PAGE_ID || ''
  if (single) return [single]
  return []
}

async function syncOnePage(pageId, client, errors) {
  let totalSynced = 0
  let formsData
  try { formsData = await graphGet(`/${pageId}/leadgen_forms?fields=id,name`, META_PAGE_ACCESS_TOKEN) }
  catch (e) { errors.push(`Page ${pageId}: ${e.message}`); return 0 }

  for (const form of formsData.data || []) {
    let cursor = null, page = 1
    do {
      let url = `/${form.id}/leads?fields=id,created_time,field_data,campaign_id,ad_id,page_id`
      if (cursor) url += `&after=${cursor}`
      let leadsData
      try { leadsData = await graphGet(url, META_PAGE_ACCESS_TOKEN) }
      catch (e) { errors.push(`Form ${form.id}: ${e.message}`); break }

      for (const lead of leadsData.data || []) {
        try {
          const parsed  = parseFieldData(lead.field_data)
          const phone   = normalizePhone(parsed.phone)

          // Atomic claim: plain INSERT decides "is new". Success → genuinely new
          // (notify). 23505 unique-violation → already saved (a concurrent sync, or
          // the webhook got it first) → skip notify. This replaces the old racy
          // "pre-query existingIds" that double-notified when two syncs overlapped.
          const { error: insErr } = await client.from('meta_leads').insert({
            leadgen_id: lead.id, name: parsed.name || null, email: parsed.email || null,
            phone: phone || null,
            campaign_id: lead.campaign_id || null, ad_id: lead.ad_id || null,
            form_id: form.id, form_name: form.name || null,
            raw_fields: lead.field_data || [], page_id: lead.page_id || pageId, status: 'new',
          })
          const isDuplicate = insErr && (insErr.code === '23505' || /duplicate key|already exists/i.test(insErr.message || ''))
          if (insErr && !isDuplicate) { errors.push(`Lead ${lead.id}: ${insErr.message}`); continue }
          const isNew = !insErr

          // For genuinely new leads: send WA to customer + admin (same as webhook handler)
          if (isNew && phone) {
            const firstName = (parsed.name || '').split(' ')[0] || parsed.name || ''
            const waMsg = `היי ${firstName} 👋\nתודה שפנית לאפיק הנחל!\nראינו את הפנייה שלך\n\nמתי נוח לך לדבר? נשמח לתאם שיחה`
            const custChatId = `${phone}@c.us`
            const displayPhone = phone.startsWith('972') ? '0' + phone.slice(3) : phone
            const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            const adminMsg = ['🔔 ליד חדש (sync)', `שם: ${parsed.name || '—'}`, `טלפון: ${displayPhone}`,
              parsed.email ? `אימייל: ${parsed.email}` : null,
              `קמפיין: ${form.name || '—'}`, `התקבל: ${now}`].filter(Boolean).join('\n')

            // AWAIT all three sends so the function isn't killed before they hit
            // the wire. Per-call timeouts inside sendGreenNotify keep total bounded.
            const rs = await Promise.allSettled([
              sendGreenNotify(custChatId, waMsg),
              sendGreenNotify(BUSINESS_NOTIFY_CHATID, adminMsg),
              sendMetaLeadEmail({ name: parsed.name, phone, email: parsed.email, campaign: form.name, ts: now }),
            ])
            rs.forEach((r, i) => {
              const lbl = ['lead-wa', 'admin-wa', 'admin-email'][i]
              if (r.status === 'rejected') console.error(`[sync/${lbl}] crashed:`, r.reason?.message || r.reason)
            })

            // Mark wa_sent so we don't re-notify on subsequent syncs
            await client.from('meta_leads').update({ wa_sent: true }).eq('leadgen_id', lead.id)
          }

          totalSynced++
        } catch (e) { errors.push(`Lead ${lead.id}: ${e.message}`) }
      }

      cursor = leadsData.paging?.next ? leadsData.paging?.cursors?.after : null
      page++
    } while (cursor && page < 20)
  }
  return totalSynced
}

async function handleSync(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  // Accept either a Bearer token (admin UI) OR a ?key= query param, so an external
  // cron service (e.g. cron-job.org) can trigger near-real-time lead sync with a
  // single plain URL — no custom headers needed.
  if (!checkAuth(req) && req.query.key !== ADMIN_TOKEN) return res.status(401).json({ error: 'Unauthorized' })
  if (!META_PAGE_ACCESS_TOKEN) return res.status(500).json({ error: 'META_PAGE_ACCESS_TOKEN not configured' })
  if (!SUPABASE_URL)        return res.status(500).json({ error: 'Supabase not configured' })

  const pageIds = resolvePageIds(req.query)
  if (!pageIds.length) return res.status(400).json({ error: 'No page IDs configured. Set META_PAGE_IDS or META_PAGE_ID in Vercel env vars.' })

  const client = sb()
  let totalSynced = 0
  const errors = []

  for (const pageId of pageIds) {
    totalSynced += await syncOnePage(pageId, client, errors)
  }

  return res.status(200).json({
    synced: totalSynced,
    pages: pageIds.length,
    page_ids: pageIds,
    errors: errors.length ? errors : undefined,
  })
}

// ── Green API chat proxy ───────────────────────────────────────────────────────
// Keeps WA_GREENAPI_TOKEN server-side. The browser only ever talks to these
// endpoints (with the ADMIN_TOKEN guard); it never sees the Green API token.
async function handleChat(req, res, action) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (!GREEN_INSTANCE || !GREEN_TOKEN) return res.status(500).json({ error: 'Green API not configured' })

  try {
    // GET /api/meta/chat-status → instance connection state
    if (action === 'chat-status') {
      const r = await fetch(greenUrl('getStateInstance'), { signal: AbortSignal.timeout(8000) })
      const d = await r.json().catch(() => ({}))
      return res.status(r.ok ? 200 : 502).json({ state: d.stateInstance || null })
    }

    // POST /api/meta/chat-history { phone, count } → raw Green getChatHistory array
    if (action === 'chat-history') {
      const { phone, count = 100 } = req.body || {}
      const p = normalizePhone(phone)
      if (!p) return res.status(400).json({ error: 'phone required' })
      const r = await fetch(greenUrl('getChatHistory'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${p}@c.us`, count: Math.min(Number(count) || 100, 200) }),
        signal: AbortSignal.timeout(20000),
      })
      const data = await r.json().catch(() => [])
      return res.status(r.ok ? 200 : 502).json(Array.isArray(data) ? data : [])
    }

    // POST /api/meta/chat-send { phone, message } → sendMessage
    if (action === 'chat-send') {
      const { phone, message } = req.body || {}
      const p = normalizePhone(phone)
      if (!p || !message) return res.status(400).json({ error: 'phone and message required' })
      const r = await fetch(greenUrl('sendMessage'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${p}@c.us`, message }),
        signal: AbortSignal.timeout(20000),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return res.status(502).json({ error: 'Green API send failed', detail: d })
      return res.status(200).json({ ok: true, idMessage: d.idMessage || null })
    }

    // POST /api/meta/chat-send-file { phone, fileName, fileType, fileBase64, caption } → sendFileByUpload
    if (action === 'chat-send-file') {
      const { phone, fileName, fileType, fileBase64, caption } = req.body || {}
      const p = normalizePhone(phone)
      if (!p || !fileName || !fileBase64) return res.status(400).json({ error: 'phone, fileName, fileBase64 required' })
      const buffer = Buffer.from(fileBase64, 'base64')
      const fd = new FormData()
      fd.append('chatId', `${p}@c.us`)
      fd.append('file', new Blob([buffer], { type: fileType || 'application/octet-stream' }), fileName)
      fd.append('fileName', fileName)
      if (caption) fd.append('caption', caption)
      const r = await fetch(greenUrl('sendFileByUpload'), { method: 'POST', body: fd, signal: AbortSignal.timeout(60000) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return res.status(502).json({ error: 'Green API file send failed', detail: d })
      return res.status(200).json({ ok: true, idMessage: d.idMessage || null })
    }

    return res.status(404).json({ error: `Unknown chat action: ${action}` })
  } catch (e) {
    return res.status(502).json({ error: e.message || 'Green API proxy error' })
  }
}

// ── Diagnostics ───────────────────────────────────────────────────────────────
// GET /api/meta/diagnostics — returns which env vars are set vs missing
async function handleDiagnostics(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  const check = (v) => v ? '✅ set' : '❌ MISSING'
  return res.status(200).json({
    supabase: {
      SUPABASE_URL:         check(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      SUPABASE_SERVICE_KEY: check(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY),
    },
    whatsapp_greenapi: {
      WA_GREENAPI_INSTANCE:  check(process.env.WA_GREENAPI_INSTANCE),
      WA_GREENAPI_TOKEN:     check(process.env.WA_GREENAPI_TOKEN),
      BUSINESS_NOTIFY_CHATID:check(process.env.BUSINESS_NOTIFY_CHATID),
    },
    email: {
      GMAIL_USER:         check(process.env.GMAIL_USER),
      GMAIL_APP_PASSWORD: check(process.env.GMAIL_APP_PASSWORD),
    },
    meta_leads: {
      META_PAGE_ACCESS_TOKEN: check(process.env.META_PAGE_ACCESS_TOKEN || process.env.WA_META_TOKEN),
      META_PAGE_IDS:          check(process.env.META_PAGE_IDS || process.env.META_PAGE_ID),
      META_APP_SECRET:        check(process.env.META_APP_SECRET) + ' (optional)',
    },
    supermetrics: {
      SUPERMETRICS_API_KEY: check(process.env.SUPERMETRICS_API_KEY),
    },
    green_api_url: (() => {
      const inst = process.env.WA_GREENAPI_INSTANCE || ''
      const region = inst.slice(0, 4)
      return region ? `https://${region}.api.greenapi.com/waInstance${inst}/...` : 'https://api.green-api.com/...'
    })(),
  })
}

// ── Supermetrics proxy ────────────────────────────────────────────────────────
// Merged here (instead of a separate file) to stay within Vercel Hobby 12-function limit.

// Per-source query config — mirrors the original URLs provided by the user exactly.
// No `fields` parameter: Supermetrics returns its default field set and rejects
// custom field lists that don't exactly match the connection's schema.
const SM_SOURCES = {
  fa: {
    label:       'Facebook Ads',
    ds_id:       'FA',
    ds_accounts: 'list.all_accounts',
    // ds_user omitted — auto-resolves, avoids stale cached schedule_id
    fields:      ['adcampaign_name', 'impressions', 'Clicks', 'cost', 'reach', 'CTR', 'CPC'],
  },
  gawa: {
    label:       'Google Analytics',
    ds_id:       'GAWA',
    ds_accounts: 'list.all_accounts',
    ds_user:     'afik.hanahal@gmail.com',
    fields:      ['date', 'sessions', 'activeUsers', 'newUsers', 'screenPageViews', 'bounceRate', 'averageSessionDuration'],
  },
  igi: {
    label:       'Instagram Insights',
    ds_id:       'IGI',
    ds_accounts: '17841445211723833',
    ds_user:     '3729535990520124',
    report_type: 'AccountInsightsDaily',
    fields:      ['date', 'reach', 'profile_views', 'follower_count'],
  },
  device: {
    label:       'GA4 Device Breakdown',
    ds_id:       'GAWA',
    ds_accounts: 'list.all_accounts',
    ds_user:     'afik.hanahal@gmail.com',
    // Field order MUST match the frontend row parser in AnalyticsDashboard:
    // [deviceCategory, sessions, activeUsers, newUsers, bounceRate, screenPageViews, averageSessionDuration]
    fields:      ['deviceCategory', 'sessions', 'activeUsers', 'newUsers', 'bounceRate', 'screenPageViews', 'averageSessionDuration'],
  },
  traffic: {
    label:       'GA4 Traffic Overview',
    ds_id:       'GAWA',
    ds_accounts: 'list.all_accounts',
    ds_user:     'afik.hanahal@gmail.com',
    fields:      ['date', 'sessions', 'activeUsers', 'newUsers', 'screenPageViews', 'bounceRate', 'averageSessionDuration'],
  },
}

// Recursively coerce Supermetrics' nested error object into a human-readable string.
// Their API returns shapes like { error: { code, message, description } } or
// { meta: { error: '...' } } — the frontend was getting "[object Object]"
// because we were forwarding the whole object.
function flattenError(payload, status) {
  const e = payload?.error ?? payload?.meta?.error ?? payload?.message
  if (!e) return `HTTP ${status}`
  if (typeof e === 'string') return e
  if (typeof e === 'object') {
    // Supermetrics shapes: { code, message, description }
    return e.description || e.message || e.code || JSON.stringify(e).slice(0, 300)
  }
  return String(e)
}

// Supermetrics' /enterprise/v2/query/data/json returns the result table in
// `body.data` as an array-of-arrays: [ [header...], [row...], [row...] ].
// (It is NOT an object with .headers/.rows — that mismatch is what previously
// made every query look "empty" and fall through to a broken async poll.)
// This normalises that shape into { headers, rows } for the rest of the code.
function extractTable(body) {
  const d = body?.data
  if (Array.isArray(d) && d.length) {
    return { headers: d[0] || [], rows: d.slice(1) }
  }
  // Tolerate the alternative {headers, rows} object shape, just in case.
  if (d && Array.isArray(d.rows)) return { headers: d.headers || [], rows: d.rows }
  return { headers: [], rows: [] }
}

// Most queries return their data inline in the submit response. For the rare
// async case (status_code reports the job is still running), poll the STATUS
// endpoint — /enterprise/v2/query/status?schedule_id=… — until rows appear.
// Waits up to ~25s (fits inside our 30s function maxDuration).
async function pollSupermetricsResult(scheduleId, source) {
  const url = `https://api.supermetrics.com/enterprise/v2/query/status?schedule_id=${encodeURIComponent(scheduleId)}&api_key=${encodeURIComponent(SUPERMETRICS_API_KEY)}`
  const start = Date.now()
  let delayMs = 800
  while (Date.now() - start < 25000) {
    await new Promise(res => setTimeout(res, delayMs))
    delayMs = Math.min(delayMs * 1.4, 3000)
    let r
    try { r = await fetch(url, { signal: AbortSignal.timeout(15000) }) }
    catch (e) { console.warn(`[supermetrics/poll ${source}] fetch error: ${e.message}`); continue }
    const txt = await r.text()
    let b; try { b = JSON.parse(txt) } catch { b = {} }
    if (!r.ok || b?.error) return { ok: false, error: flattenError(b, r.status) }
    const status = b?.meta?.status_code || b?.data?.status
    const { headers, rows } = extractTable(b)
    if (rows.length) return { ok: true, headers, rows, meta: b?.meta || {} }
    if (['FAILED', 'failed', 'ERROR', 'error'].includes(status)) {
      return { ok: false, error: flattenError(b, r.status) }
    }
    // SUCCESS-but-empty or still running — keep polling until rows arrive
  }
  return { ok: false, error: 'Query timed out after 25s — Supermetrics still processing' }
}

// Convert relative range (last_7_days, last_30_days, etc.) to explicit custom dates.
// This ensures every calendar day gets a unique cache key in Supermetrics so stale
// schedule_ids never block us.
function rangeToCustomDates(range) {
  const today = new Date()
  const pad = n => String(n).padStart(2,'0')
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const end_date = fmt(today)
  const days = { last_7_days:7, last_14_days:14, last_30_days:30, last_month:30, last_90_days:90, yesterday:1 }[range] || 7
  const start = new Date(today); start.setDate(start.getDate() - days)
  return { date_range_type: 'custom', start_date: fmt(start), end_date }
}

async function handleSupermetrics(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!checkAuth(req))        return res.status(401).json({ error: 'Unauthorized' })
  if (!SUPERMETRICS_API_KEY)  return res.status(500).json({ error: 'SUPERMETRICS_API_KEY not configured in Vercel env vars' })

  const source = (req.query.source || 'fa').toLowerCase()
  const range  = req.query.range   || 'last_7_days'
  const cfg    = SM_SOURCES[source]
  if (!cfg) return res.status(400).json({ error: `Unknown source: ${source}. Use fa, gawa, or igi.` })

  const { date_range_type, start_date, end_date } = rangeToCustomDates(range)

  const query = {
    ds_id:           cfg.ds_id,
    ds_accounts:     cfg.ds_accounts,
    ...(cfg.ds_user ? { ds_user: cfg.ds_user } : {}),
    fields:          cfg.fields,
    ...(cfg.report_type ? { report_type: cfg.report_type } : {}),
    date_range_type,
    start_date,
    end_date,
    max_rows:        1000,
    api_key:         SUPERMETRICS_API_KEY,
  }
  try {
    const url  = `https://api.supermetrics.com/enterprise/v2/query/data/json?json=${encodeURIComponent(JSON.stringify(query))}`
    console.log(`[supermetrics] querying ${source} (${range})`)
    const r    = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const text = await r.text()
    let body; try { body = JSON.parse(text) } catch { body = {} }
    if (!r.ok || body?.error || body?.meta?.error) {
      const msg = flattenError(body, r.status)
      console.error(`[supermetrics] ${source} submit failed: ${msg}`)
      return res.status(502).json({ error: msg, source, status: r.status })
    }
    // The result table is normally returned inline in the submit response.
    let { headers, rows } = extractTable(body)
    const scheduleId = body?.meta?.schedule_id || body?.data?.schedule_id || body?.schedule_id
    // Only if the data hasn't materialised yet do we poll the status endpoint.
    if (rows.length === 0 && scheduleId) {
      console.log(`[supermetrics] ${source} no inline rows (schedule_id=${scheduleId.slice(0, 12)}…) — polling status`)
      const polled = await pollSupermetricsResult(scheduleId, source)
      if (!polled.ok) {
        console.error(`[supermetrics] ${source} poll failed: ${polled.error}`)
        return res.status(502).json({ error: polled.error, source, schedule_id: scheduleId })
      }
      headers = polled.headers
      rows    = polled.rows
    }
    console.log(`[supermetrics] ${source} → ${rows.length} rows ready`)
    return res.status(200).json({
      source, range, label: cfg.label,
      headers, rows,
      meta: body?.meta || {},
    })
  } catch (e) {
    console.error(`[supermetrics] ${source} exception: ${e.message}`)
    return res.status(502).json({ error: e.message || 'Supermetrics request failed', source })
  }
}

// ── main router ───────────────────────────────────────────────────────────────

// Disable Vercel's automatic body parser so we can read the raw bytes.
// Required for correct Meta webhook signature verification — Meta signs the
// exact raw payload bytes, and JSON.stringify(parsedBody) ≠ original bytes.
export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); return res.status(204).end() }
  cors(res)

  // Read raw body — needed for signature verification and JSON parsing
  let rawBody = ''
  await new Promise((resolve, reject) => {
    req.on('data', chunk => { rawBody += chunk })
    req.on('end', resolve)
    req.on('error', reject)
  })
  try { req.body = rawBody ? JSON.parse(rawBody) : {} } catch { req.body = {} }
  req.rawBody = rawBody

  const path = (req.query._path || '').replace(/^\/+/, '')

  if (path === 'webhook')      return handleWebhook(req, res)
  if (path === 'leads')        return handleLeads(req, res)
  if (path === 'messages')     return handleMessages(req, res)
  if (path === 'sync')         return handleSync(req, res)
  if (path.startsWith('chat-'))  return handleChat(req, res, path)
  if (path === 'supermetrics')   return handleSupermetrics(req, res)
  if (path === 'diagnostics')    return handleDiagnostics(req, res)

  return res.status(404).json({ error: `Unknown path: ${path}` })
}
