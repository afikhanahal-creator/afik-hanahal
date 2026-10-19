// Vercel serverless — combined Meta Lead Ads router
// Routes by ?_path= query param (set via vercel.json rewrite from /api/meta/*)
//
//  webhook  → GET verify / POST lead event
//  leads    → GET list all leads
//  messages → GET thread / POST send message
//  sync     → GET historical sync from Meta

import { compressJson } from '../lib/http.js'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import * as Auto from '../lib/automations.js'
import { getTemplate } from '../lib/automations-shared.js'
import * as GA4 from '../lib/ga4.js'
import { analyzeLead, buildDossier } from '../lib/lead-analyze.js'
import { summarizeChat } from '../lib/chat-summary.js'
import { researchLead } from '../lib/lead-research.js'
import { mirrorMetaLead, backfillMetaLeads } from '../lib/meta-crm.js'
import * as Booking from '../lib/booking-server.js'
import * as GCal from '../lib/google-calendar.js'

const SUPERMETRICS_API_KEY    = process.env.SUPERMETRICS_API_KEY    || ''
// System User token (afik-api) — permanent, survives password changes. Used to
// DERIVE a per-page Page Access Token (required for reading leadgen forms/leads).
// We intentionally do NOT read the old META_PAGE_ACCESS_TOKEN / WA_META_TOKEN env
// vars here: the previous value was invalidated by a password change and still lives
// in Vercel's env, which would override (poison) this good token. Rotate via the
// fresh META_SYSTEM_USER_TOKEN env var instead.
const META_PAGE_ACCESS_TOKEN  = process.env.META_SYSTEM_USER_TOKEN ||
  'EAAnqYHiWM8cBRvFbXjxZAVjg39koOtAVOJuZC0p1YUFVWpPZACkVAt065X4wJ7FdoBOsvMGN7ldvj6LdiyOFfOcKeXirqcmFPY4sSGJMwK22lagJh2oKC6tERZADuRNNnu7S0Y9B212hWWxfyzy5N4VBprMRNlswT3KF9E8MtVyq2qzSkzZAVhlmBwrmN5jyVqBU2cm344AmvzscH9KXZBIgxI2ZASF4ZBTijw2E'
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
// fetch() for Green API: its per-method rate limit answers 429 when the panel asks several things at once — wait, retry
async function greenFetch(url, init = {}, attempt = 0) {
  const r = await globalThis.fetch(url, init)
  if (r.status !== 429 || attempt >= 2 || init.body instanceof FormData) return r
  await new Promise(ok => setTimeout(ok, 900 * (attempt + 1)))
  return greenFetch(url, { ...init, signal: AbortSignal.timeout(10000) }, attempt + 1)
}

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
  const items = (fieldData || []).map(item => ({
    key: (item.name || '').toLowerCase().replace(/[\s_-]/g, ''),
    val: Array.isArray(item.values) ? item.values[0] : item.value,
  })).filter(x => x.val)
  // Pass 1: Meta's standard keys, exact — so a custom "street_name" question can never
  // become the lead's name just because it appears first in the form.
  for (const { key, val } of items) {
    if (['fullname', 'name'].includes(key))                    f.name  = f.name  || val
    if (['email', 'workemail'].includes(key))                  f.email = f.email || val
    if (['phonenumber', 'phone', 'mobile', 'workphone'].includes(key)) f.phone = f.phone || val
  }
  if (!f.name) { const fn = items.find(x => x.key === 'firstname')?.val, ln = items.find(x => x.key === 'lastname')?.val; if (fn || ln) f.name = [fn, ln].filter(Boolean).join(' ') }
  // Pass 2: loose match, only for whatever is still missing
  for (const { key, val } of items) {
    if (!f.name  && key.includes('name'))                      f.name  = val
    if (!f.email && key.includes('email'))                     f.email = val
    if (!f.phone && (key.includes('phone') || key.includes('mobile'))) f.phone = val
  }
  return f
}

async function graphGet(path, token) {
  const url = `https://graph.facebook.com/v20.0${path}${path.includes('?') ? '&' : '?'}access_token=${token}`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Graph ${path} → HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

// Reading leadgen forms/leads requires a PAGE access token. We derive it on the fly
// from the System User token (which is permanent), and cache per page for this invocation.
// Falls back to the base token if derivation fails.
const _pageTokenCache = {}
async function getPageToken(pageId) {
  if (!pageId) return META_PAGE_ACCESS_TOKEN
  if (_pageTokenCache[pageId]) return _pageTokenCache[pageId]
  try {
    const d = await graphGet(`/${pageId}?fields=access_token`, META_PAGE_ACCESS_TOKEN)
    if (d.access_token) { _pageTokenCache[pageId] = d.access_token; return d.access_token }
  } catch (e) { console.warn(`[meta] page-token derive failed for ${pageId}: ${e.message}`) }
  return META_PAGE_ACCESS_TOKEN
}

// Resolve a campaign's name from its ID (ad-account-scoped → System User token).
// Cached per invocation. Lets each lead show its real CAMPAIGN ("הנרייטה סאלד #3")
// instead of only the form name (which is often reused across campaigns).
const _campaignNameCache = {}
async function getCampaignName(campaignId) {
  if (!campaignId) return ''
  if (campaignId in _campaignNameCache) return _campaignNameCache[campaignId]
  let name = ''
  try { name = (await graphGet(`/${campaignId}?fields=name`, META_PAGE_ACCESS_TOKEN)).name || '' } catch {}
  _campaignNameCache[campaignId] = name
  return name
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

// The last webhook deliveries (app_settings 'meta_webhook_log'): { last, count, events: [{ at, object, changes }] }
async function logWebhookEvent(ev) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return
  const client = sb()
  const { data } = await client.from('app_settings').select('value').eq('key', 'meta_webhook_log').maybeSingle()
  const prev = data?.value && typeof data.value === 'object' ? data.value : {}
  const at = new Date().toISOString()
  const value = { last: at, count: (prev.count || 0) + 1, events: [{ at, ...ev }, ...(prev.events || [])].slice(0, 20) }
  await client.from('app_settings').upsert({ key: 'meta_webhook_log', value, updated_at: at }, { onConflict: 'key' })
}
async function noteWebhookError(leadgenId, error) {
  const client = sb()
  const { data } = await client.from('app_settings').select('value').eq('key', 'meta_webhook_log').maybeSingle()
  const v = data?.value
  if (!v || !Array.isArray(v.events)) return
  const ev = v.events.find(e => (e.changes || []).some(c => c.leadgen === leadgenId))
  if (!ev) return
  ev.error = error
  await client.from('app_settings').upsert({ key: 'meta_webhook_log', value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}
async function readWebhookLog() {
  try { const { data } = await sb().from('app_settings').select('value').eq('key', 'meta_webhook_log').maybeSingle(); return data?.value || null } catch { return null }
}

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
        // WARN-but-PROCESS: a stale/wrong META_APP_SECRET must never silently drop a
        // real lead (zero-delay email/WA is the priority). We log the mismatch for
        // visibility but still process the event. Forged page-leadgen events are low
        // risk here (worst case: a spam lead the admin deletes).
        if (sig !== expected) console.warn('[MetaLeads] Signature mismatch — processing anyway (check META_APP_SECRET)')
      }

      const body = req.body
      // Every delivery is recorded (app_settings 'meta_webhook_log', last 20): the Lead Center and /connect show when
      // Meta last reached us — a webhook that stopped arriving is visible instead of silent
      await logWebhookEvent({ object: body?.object || null, changes: (body?.entry || []).flatMap(e => (e.changes || []).map(c => ({ field: c.field, page: c.value?.page_id || e.id || null, leadgen: c.value?.leadgen_id || null }))) }).catch(() => {})
      if (body?.object !== 'page') return res.status(200).json({ status: 'ignored', reason: 'not a page event' })

      const client = sb()
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'leadgen') continue
          const { leadgen_id, page_id } = change.value || {}
          if (!leadgen_id) continue
          // Only the office's own pages (META_PAGE_IDS): the token may manage other pages too, and their leads must
          // never get an Afik Hanahal welcome
          const ownPages = resolvePageIds({})
          if (ownPages.length && page_id && !ownPages.includes(String(page_id))) { console.warn(`[MetaLeads] lead ${leadgen_id} from page ${page_id} ignored (not ours)`); continue }

          const pageToken = await getPageToken(page_id)

          let leadData, campaignName = '', formName = ''
          // Meta can send the webhook while the lead is still being processed ("Pending" in the testing tool), so a
          // read is retried for ~5 s; a lead that still can't be read is noted in the webhook log and fetched through
          // the forms right away (below). A single Lead has no page_id field — asking for it made every read fail
          // with #100 until October 2026.
          let fetchErr = null
          for (const wait of [0, 1500, 3000]) {
            if (wait) await new Promise(r => setTimeout(r, wait))
            try { leadData = await graphGet(`/${leadgen_id}?fields=id,created_time,field_data,campaign_id,ad_id,form_id`, pageToken); fetchErr = null; break }
            catch (e) { fetchErr = e }
          }
          if (!leadData) {
            const msg = String(fetchErr?.message || 'fetch failed').replace(/access_token=[^&\s"]+/g, '').slice(0, 300)
            console.error('[MetaLeads] fetch lead:', msg)
            // Fallback: read the page's leads of the last 15 minutes through the forms (the path the sync uses) —
            // saves and welcomes this lead now instead of at the next tick
            const errs = [], stats = {}
            try { await syncOnePage(page_id || resolvePageIds({})[0], client, errs, { sinceSec: Math.floor(Date.now() / 1000) - 900, stats }) } catch (e) { errs.push(e.message) }
            await noteWebhookError(leadgen_id, `${msg}${stats.new ? ` → saved by fallback sync (${stats.new})` : errs.length ? ` → fallback: ${String(errs[0]).replace(/access_token=[^&\s"]+/g, '').slice(0, 160)}` : ' → fallback found nothing'}`).catch(() => {})
            continue
          }

          if (leadData.campaign_id) {
            // Campaign objects are ad-account-scoped → use the System User token (has ads access).
            try { campaignName = (await graphGet(`/${leadData.campaign_id}?fields=name`, META_PAGE_ACCESS_TOKEN)).name || '' } catch {}
          }
          if (leadData.form_id) {
            try { formName = (await graphGet(`/${leadData.form_id}?fields=name`, pageToken)).name || '' } catch {}
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
              raw_fields: leadData.field_data || [], page_id: page_id || null,
              ...(leadData.created_time && !isNaN(Date.parse(leadData.created_time)) ? { created_at: new Date(leadData.created_time).toISOString() } : {}),
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
          // Welcome: the same template, on/off switch and office WhatsApp number (Green API) as website leads
          // (admin tab "אוטומציות"), logged in automation_log — see welcomeMetaLead
          await welcomeMetaLead(client, { id: leadId, name, phone, campaign: campaignName || formName })
          await mirrorToCRM(client, leadgen_id)

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
    const { id, status, notes, call_time, deleted_at, wa_sent } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id required' })
    const updates = {}
    // the Lead Center saw our messages in the lead's WhatsApp chat (sent from the chats tab, say): mark it contacted
    if (wa_sent === true) updates.wa_sent = true
    if (status     !== undefined) updates.status     = status
    if (notes      !== undefined) updates.notes      = notes
    if (call_time  !== undefined) updates.call_time  = call_time
    if (deleted_at !== undefined) updates.deleted_at = deleted_at  // null = restore, ISO string = soft-delete
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'nothing to update' })
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

    const { data: lead, error: leadErr } = await client.from('meta_leads').select('id,phone,wa_sent').eq('id', lead_id).single()
    if (leadErr || !lead)  return res.status(404).json({ error: 'Lead not found' })
    if (!lead.phone)       return res.status(400).json({ error: 'Lead has no phone number' })

    // From the office WhatsApp (Green API) — the same number as the welcome message, so the lead sees one conversation
    const sent = await Auto.sendText(lead.phone, String(message).slice(0, 4000))
    if (!sent.ok) return res.status(502).json({ error: sent.error || 'send failed', quota: !!sent.quota })
    const { data: newMsg, error: insertErr } = await client.from('meta_messages')
      .insert({ lead_id: lead.id, direction: 'out', message, wa_message_id: sent.idMessage || null })
      .select('*').single()
    if (insertErr) return res.status(500).json({ error: insertErr.message })
    if (!lead.wa_sent) await client.from('meta_leads').update({ wa_sent: true }).eq('id', lead.id).then(() => {}, () => {})
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

async function syncOnePage(pageId, client, errors, { sinceSec = 0, stats = {} } = {}) {
  let totalSynced = 0, newLeads = 0
  const pageToken = await getPageToken(pageId)
  let formsData
  // limit=200: Graph's default page is 25 forms (the page has 23) — a new campaign's form must never fall off
  try { formsData = await graphGet(`/${pageId}/leadgen_forms?fields=id,name&limit=200`, pageToken) }
  catch (e) { errors.push(`Page ${pageId}: ${e.message}`); return 0 }

  for (const form of formsData.data || []) {
    let cursor = null, page = 1
    do {
      let url = `/${form.id}/leads?fields=id,created_time,field_data,campaign_id,ad_id,page_id`
      // A routine safety-net run reads only recent leads (the full history is the manual "סנכרון")
      if (sinceSec) url += `&filtering=${encodeURIComponent(JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: sinceSec }]))}`
      if (cursor) url += `&after=${cursor}`
      let leadsData
      try { leadsData = await graphGet(url, pageToken) }
      catch (e) { errors.push(`Form ${form.id}: ${e.message}`); break }

      for (const lead of leadsData.data || []) {
        try {
          const parsed  = parseFieldData(lead.field_data)
          const phone   = normalizePhone(parsed.phone)
          const campaignName = await getCampaignName(lead.campaign_id)

          // Atomic claim: plain INSERT decides "is new". Success → genuinely new
          // (notify). 23505 unique-violation → already saved (a concurrent sync, or
          // the webhook got it first) → skip notify. This replaces the old racy
          // "pre-query existingIds" that double-notified when two syncs overlapped.
          const { error: insErr } = await client.from('meta_leads').insert({
            leadgen_id: lead.id, name: parsed.name || null, email: parsed.email || null,
            phone: phone || null,
            campaign_id: lead.campaign_id || null, campaign_name: campaignName || null,
            ad_id: lead.ad_id || null,
            form_id: form.id, form_name: form.name || null,
            raw_fields: lead.field_data || [], page_id: lead.page_id || pageId, status: 'new',
            // the time the person left the details (a lead saved late keeps its real date in the Lead Center)
            ...(lead.created_time && !isNaN(Date.parse(lead.created_time)) ? { created_at: new Date(lead.created_time).toISOString() } : {}),
          })
          const isDuplicate = insErr && (insErr.code === '23505' || /duplicate key|already exists/i.test(insErr.message || ''))
          if (insErr && !isDuplicate) { errors.push(`Lead ${lead.id}: ${insErr.message}`); continue }
          const isNew = !insErr

          // Backfill: existing leads saved before campaign capture get their campaign
          // name filled in (only when still empty — cheap no-op once populated).
          if (isDuplicate && campaignName) {
            await client.from('meta_leads').update({ campaign_name: campaignName }).eq('leadgen_id', lead.id).is('campaign_name', null)
          }
          // Backfill: a lead saved long after it came in (a missed webhook) gets its real date back
          if (isDuplicate && lead.created_time && !isNaN(Date.parse(lead.created_time))) {
            const real = Date.parse(lead.created_time)
            await client.from('meta_leads').update({ created_at: new Date(real).toISOString() }).eq('leadgen_id', lead.id).gt('created_at', new Date(real + 3600e3).toISOString())
          }

          // For genuinely new leads: send WA to customer + admin (same as webhook handler)
          // Only a fresh lead (≤ 24 h old) is welcomed and announced. An older one the webhook missed (the token was dead
          // for months) is saved quietly — a "thanks for leaving your details" weeks later, and a burst of office
          // notifications, would do more harm than good. It shows up in the Lead Center as usual.
          const ageH = (Date.now() - Date.parse(lead.created_time || '')) / 36e5
          const fresh = Number.isFinite(ageH) ? ageH <= 24 : false
          if (isNew && !fresh) stats.quiet = (stats.quiet || 0) + 1
          if (isNew && phone && fresh) {
            const displayPhone = phone.startsWith('972') ? '0' + phone.slice(3) : phone
            const now = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            const adminMsg = ['🔔 ליד חדש (sync)', `שם: ${parsed.name || '—'}`, `טלפון: ${displayPhone}`,
              parsed.email ? `אימייל: ${parsed.email}` : null,
              `קמפיין: ${form.name || '—'}`, `התקבל: ${now}`].filter(Boolean).join('\n')

            // AWAIT all three sends so the function isn't killed before they hit
            // the wire. Per-call timeouts inside sendGreenNotify keep total bounded.
            const { data: saved } = await client.from('meta_leads').select('id').eq('leadgen_id', lead.id).maybeSingle()
            const rs = await Promise.allSettled([
              welcomeMetaLead(client, { id: saved?.id, name: parsed.name || '', phone, campaign: campaignName || form.name }),
              sendGreenNotify(BUSINESS_NOTIFY_CHATID, adminMsg),
              sendMetaLeadEmail({ name: parsed.name, phone, email: parsed.email, campaign: form.name, ts: now }),
            ])
            rs.forEach((r, i) => {
              const lbl = ['lead-wa', 'admin-wa', 'admin-email'][i]
              if (r.status === 'rejected') console.error(`[sync/${lbl}] crashed:`, r.reason?.message || r.reason)
            })

          }

          if (isNew) { newLeads++; await mirrorToCRM(client, lead.id, { quiet: !fresh }) }
          totalSynced++
        } catch (e) { errors.push(`Lead ${lead.id}: ${e.message}`) }
      }

      cursor = leadsData.paging?.next ? leadsData.paging?.cursors?.after : null
      page++
    } while (cursor && page < 20)
  }
  stats.new = (stats.new || 0) + newLeads
  return totalSynced
}

// Welcome a Meta lead through the automations engine and record it on the lead (wa_sent + the thread)
async function welcomeMetaLead(client, { id, name, phone, campaign }) {
  if (!phone) return { ok: false, skipped: 'no phone' }
  const r = await Auto.welcomeExternalLead({ id, name, phone, prop_title: '', source: 'meta', campaignName: campaign || '' }, { source: 'meta' })
  if (r.ok && id) {
    await client.from('meta_messages').insert({ lead_id: id, direction: 'out', message: r.text, wa_message_id: r.idMessage || null }).then(() => {}, () => {})
    await client.from('meta_leads').update({ wa_sent: true }).eq('id', id).then(() => {}, () => {})
  }
  if (!r.ok && !r.skipped) console.error(`[MetaLeads] welcome to ${phone} failed: ${r.error}`)
  return r
}

// Every Meta lead also goes into the CRM (contacts = admin "לידים" and the bulk-send audience) — lib/meta-crm.js.
// quiet = a lead saved late (older than 24 h): no CRM follow-ups are proposed for it.
const META_CRM_FIELDS = 'id,leadgen_id,name,email,phone,campaign_name,form_name,raw_fields,status,notes,call_time,wa_sent,created_at,deleted_at'
async function mirrorToCRM(client, leadgenId, { quiet = false } = {}) {
  try {
    const { data: ml } = await client.from('meta_leads').select(META_CRM_FIELDS).eq('leadgen_id', String(leadgenId)).maybeSingle()
    if (!ml) return { skipped: 'not saved' }
    return await mirrorMetaLead(client, ml, { welcome: ml.wa_sent ? 'sent' : 'handled', quiet })
  } catch (e) { console.error('[MetaLeads] CRM copy failed:', e.message); return { error: e.message } }
}

// Safety net for the webhook: the last `hours` of leads from every lead form, saved + welcomed like a webhook
// lead (idempotent — a lead already saved is skipped). Run by auto-tick (external pinger), the panel's auto-run
// and the daily cron. → { pages, new, synced, errors? }
async function syncRecentMetaLeads({ hours = 48 } = {}) {
  if (!META_PAGE_ACCESS_TOKEN || !SUPABASE_URL) return { skipped: 'not configured' }
  const pageIds = resolvePageIds({})
  if (!pageIds.length) return { skipped: 'no page ids' }
  const client = sb(), errors = [], stats = {}
  let synced = 0
  const sinceSec = Math.floor(Date.now() / 1000) - hours * 3600
  for (const pageId of pageIds) synced += await syncOnePage(pageId, client, errors, { sinceSec, stats })
  return { pages: pageIds.length, new: stats.new || 0, synced, ...(errors.length ? { errors: errors.slice(0, 5) } : {}) }
}

// ── GET /api/meta/connect (admin) → is everything a new lead needs connected? (no secrets in the answer)
//   Meta: the token, the pages it manages, each page's webhook subscription for `leadgen`, its lead forms and the
//   newest lead on Meta vs in our table; the ad accounts it sees (and whether ?account= is one of them) with their
//   campaigns. Green API: the WhatsApp instance state and number. Automations: the welcome rule and its text.
//   ?fix=1 subscribes every page that isn't subscribed to `leadgen` (so new leads reach the webhook).
async function handleConnect(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  res.setHeader('Cache-Control', 'no-store')
  const out = { at: new Date().toISOString(), meta: {}, green: null, welcome: null, db: {} }
  const g = (p, tok = META_PAGE_ACCESS_TOKEN) => graphGet(p, tok)
  // Token
  try { const me = await g('/me?fields=id,name'); out.meta.token = { ok: true, id: me.id, name: me.name } }
  catch (e) {
    const msg = String(e.message).replace(/access_token=[^&\s"]+/g, 'access_token=…')
    // 190 = the token itself is dead (password change, expiry, revoked) → a new token is needed, nothing else helps
    out.meta.token = { ok: false, reason: /"code":190/.test(msg) ? 'invalid_token' : 'error', error: msg.slice(0, 300) }
  }
  // Quick mode (admin home tile, daily cron alert): the token and the configured pages' leadgen subscription only
  if (req.query.quick) {
    out.meta.configuredPages = resolvePageIds({})
    if (out.meta.token.ok) {
      out.meta.pageChecks = []
      for (const pid of out.meta.configuredPages.slice(0, 3)) {
        try { const subs = await g(`/${pid}/subscribed_apps`, await getPageToken(pid)); out.meta.pageChecks.push({ id: pid, leadgenSubscribed: (subs.data || []).some(a => (a.subscribed_fields || []).includes('leadgen')) }) }
        catch (e) { out.meta.pageChecks.push({ id: pid, error: String(e.message).replace(/access_token=[^&\s"]+/g, '').slice(0, 200) }) }
      }
    }
    try { const { data } = await sb().from('meta_leads').select('created_at').order('created_at', { ascending: false }).limit(1); out.db.newestMetaLead = data?.[0]?.created_at || null } catch {}
    const wl = await readWebhookLog()
    out.webhook = wl ? { last: wl.last, count: wl.count || 0, lastLead: (wl.events || []).find(e => (e.changes || []).some(c => c.field === 'leadgen'))?.at || null } : { last: null, count: 0 }
    if (req.query.green) out.green = await Auto.greenStatus().then(g => ({ state: g.state, phone: g.phone || '' })).catch(e => ({ state: 'error', error: e.message }))
    try { const { cfg } = await Auto.loadConfig(); out.welcome = { enabled: !!cfg.enabled, mode: cfg.rules.welcome.mode } } catch {}
    out.ok = !!out.meta.token.ok && (out.meta.pageChecks || []).every(p => p.leadgenSubscribed)
    return res.status(200).json(out)
  }
  // Pages the token manages + the configured ones
  const configured = resolvePageIds({})
  out.meta.configuredPages = configured
  try { const acc = await g('/me/accounts?fields=id,name,tasks&limit=50'); out.meta.pages = (acc.data || []).map(p => ({ id: p.id, name: p.name })) }
  catch (e) { out.meta.pagesError = e.message.slice(0, 200) }
  // Token details (type, expiry, scopes) — so a token that will die in 60 days is visible now
  try {
    const dbg = await g(`/debug_token?input_token=${encodeURIComponent(META_PAGE_ACCESS_TOKEN)}`)
    const d = dbg.data || {}
    out.meta.token.type = d.type; out.meta.token.app = d.application
    out.meta.token.expires = d.expires_at ? new Date(d.expires_at * 1000).toISOString() : 'never'
    out.meta.token.dataAccessExpires = d.data_access_expires_at ? new Date(d.data_access_expires_at * 1000).toISOString() : null
    out.meta.token.scopes = d.scopes || []
    out.meta.token.missing = ['leads_retrieval', 'pages_manage_metadata', 'pages_show_list', 'pages_read_engagement', 'ads_read'].filter(s => !(d.scopes || []).includes(s))
  } catch (e) { out.meta.token.debugError = e.message.replace(/input_token=[^&\s"]+|access_token=[^&\s"]+/g, '').slice(0, 160) }
  // Pages that aren't the office's but were subscribed to our app (?unsub=id,id): unsubscribe
  const unsub = String(req.query.unsub || '').split(',').map(s => s.trim()).filter(id => /^\d+$/.test(id) && !configured.includes(id))
  if (unsub.length) {
    out.meta.unsubscribed = []
    for (const pid of unsub) {
      try {
        const tok = await getPageToken(pid)
        const r = await fetch(`https://graph.facebook.com/v20.0/${pid}/subscribed_apps?access_token=${tok}`, { method: 'DELETE', signal: AbortSignal.timeout(15000) })
        out.meta.unsubscribed.push({ id: pid, result: r.ok ? 'removed' : `HTTP ${r.status}: ${(await r.text()).replace(/access_token=[^&\s"]+/g, '').slice(0, 160)}` })
      } catch (e) { out.meta.unsubscribed.push({ id: pid, error: e.message.slice(0, 160) }) }
    }
  }
  const pageIds = [...new Set([...configured, ...(out.meta.pages || []).map(p => p.id)])]
  out.meta.pageChecks = []
  for (const pid of pageIds.slice(0, 6)) {
    const pc = { id: pid }
    try {
      const tok = await getPageToken(pid)
      try { pc.name = (await g(`/${pid}?fields=name`, tok)).name } catch {}
      const subs = await g(`/${pid}/subscribed_apps`, tok)
      pc.apps = (subs.data || []).map(a => ({ id: a.id, name: a.name, fields: a.subscribed_fields || [] }))
      pc.leadgenSubscribed = pc.apps.some(a => (a.fields || []).includes('leadgen'))
      pc.ours = configured.includes(pid)
      if (req.query.fix && !pc.leadgenSubscribed && pc.ours) {   // only the office's own pages
        const r = await fetch(`https://graph.facebook.com/v20.0/${pid}/subscribed_apps?subscribed_fields=leadgen&access_token=${tok}`, { method: 'POST', signal: AbortSignal.timeout(15000) })
        pc.fix = r.ok ? 'subscribed' : `HTTP ${r.status}: ${(await r.text()).replace(/access_token=[^&\s"]+/g, '').slice(0, 200)}`
        if (r.ok) pc.leadgenSubscribed = true
      }
      const forms = await g(`/${pid}/leadgen_forms?fields=id,name,status,leads_count,created_time&limit=200`, tok)
      pc.formsTotal = (forms.data || []).length
      // forms with leads, plus any form created in the last 30 days (a new campaign's form shows up before its first lead)
      pc.forms = (forms.data || []).filter(f => f.leads_count > 0 || Date.now() - Date.parse(f.created_time || 0) < 30 * 864e5).map(f => ({ id: f.id, name: f.name, status: f.status, leads: f.leads_count, created: f.created_time }))
      // Newest lead on Meta's side across the active forms
      let newest = null
      for (const f of (forms.data || []).filter(f => f.status === 'ACTIVE').sort((a, b) => String(b.created_time).localeCompare(String(a.created_time))).slice(0, 12)) {
        try { const l = await g(`/${f.id}/leads?fields=id,created_time&limit=1`, tok); const t = l.data?.[0]?.created_time; if (t && (!newest || t > newest)) newest = t } catch {}
      }
      pc.newestLeadOnMeta = newest
    } catch (e) { pc.error = String(e.message).replace(/access_token=[^&\s"]+/g, '').slice(0, 300) }
    out.meta.pageChecks.push(pc)
  }
  // Ad accounts + the one the office runs campaigns from
  const want = String(req.query.account || '').replace(/\D/g, '')
  try {
    const ad = await g('/me/adaccounts?fields=id,account_id,name,account_status,currency&limit=50')
    out.meta.adAccounts = (ad.data || []).map(a => ({ id: a.account_id, name: a.name, status: a.account_status }))
    if (want) out.meta.wantedAccount = { id: want, visible: out.meta.adAccounts.some(a => a.id === want) }
    const acct = want || out.meta.adAccounts[0]?.id
    if (acct) {
      try {
        const c = await g(`/act_${acct}/campaigns?fields=name,objective,effective_status,daily_budget&limit=30`)
        out.meta.campaigns = (c.data || []).map(x => ({ name: x.name, objective: x.objective, status: x.effective_status }))
      } catch (e) { out.meta.campaignsError = e.message.replace(/access_token=[^&\s"]+/g, '').slice(0, 200) }
    }
  } catch (e) { out.meta.adAccountsError = e.message.replace(/access_token=[^&\s"]+/g, '').slice(0, 200) }
  // Green API + the welcome rule
  out.green = await Auto.greenStatus().catch(e => ({ state: 'error', error: e.message }))
  if (out.green && out.green.instance) out.green.instance = String(out.green.instance).slice(0, 4) + '…'
  try {
    const { cfg, saved } = await Auto.loadConfig({ fresh: true })
    const w = cfg.rules.welcome
    const tpl = getTemplate(cfg, w.templateId)
    out.welcome = { enabled: !!cfg.enabled, mode: w.mode, saved, template: w.templateId, preview: String((tpl && tpl.he) || '').slice(0, 300) }
  } catch (e) { out.welcome = { error: e.message } }
  // Our side
  try {
    const { data } = await sb().from('meta_leads').select('created_at').order('created_at', { ascending: false }).limit(1)
    out.db.newestMetaLead = data?.[0]?.created_at || null
  } catch {}
  out.webhookUrl = 'https://www.afikhanahal.co.il/api/meta/webhook'
  out.webhook = await readWebhookLog()
  return res.status(200).json(out)
}

// POST /api/meta/lead-welcome { id, text?, templateId? } (admin) → send the welcome to one Meta lead now (the Lead Center):
// the configured welcome template, or the wording picked from the template library there
async function handleLeadWelcome(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { id, text, templateId } = req.body || {}
  if (!id) return res.status(400).json({ error: 'id required' })
  if (text != null && (typeof text !== 'string' || !text.trim() || text.length > 4000)) return res.status(400).json({ error: 'invalid text' })
  const client = sb()
  const { data: lead } = await client.from('meta_leads').select('id,name,phone,campaign_name,form_name').eq('id', id).maybeSingle()
  if (!lead) return res.status(404).json({ error: 'lead not found' })
  if (!lead.phone) return res.status(400).json({ error: 'no phone' })
  // The button means "send it now", whatever the automatic rule's mode
  const r = await Auto.welcomeExternalLead({ id: lead.id, name: lead.name || '', phone: lead.phone, source: 'meta', campaignName: lead.campaign_name || lead.form_name || '' }, { source: 'meta', force: true, text: text || '', templateId: typeof templateId === 'string' ? templateId : '' })
  if (r.ok) {
    await client.from('meta_messages').insert({ lead_id: lead.id, direction: 'out', message: r.text, wa_message_id: r.idMessage || null }).then(() => {}, () => {})
    await client.from('meta_leads').update({ wa_sent: true }).eq('id', lead.id).then(() => {}, () => {})
  }
  return res.status(r.ok ? 200 : 502).json(r)
}

// POST /api/meta/lead-to-crm { id } (admin) → the Meta lead's CRM row (copied now if it isn't there yet)
// POST /api/meta/crm-sync (admin) → copy every Meta lead that isn't in the CRM yet, quietly (no messages)
async function handleMetaCRM(req, res, path) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const client = sb()
  try {
    if (path === 'crm-sync') return res.status(200).json({ ok: true, ...(await backfillMetaLeads(client)) })
    const id = (req.body || {}).id
    if (!id) return res.status(400).json({ error: 'id required' })
    const { data: ml } = await client.from('meta_leads').select(META_CRM_FIELDS).eq('id', id).maybeSingle()
    if (!ml) return res.status(404).json({ error: 'lead not found' })
    const r = await mirrorMetaLead(client, { ...ml, deleted_at: null }, { welcome: ml.wa_sent ? 'sent' : 'handled' })
    return res.status(r.id ? 200 : 422).json(r)
  } catch (e) { return res.status(500).json({ error: e.message }) }
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

  const stats = {}
  for (const pageId of pageIds) {
    totalSynced += await syncOnePage(pageId, client, errors, { stats })
  }

  return res.status(200).json({
    synced: totalSynced, new: stats.new || 0, savedQuietly: stats.quiet || 0,
    pages: pageIds.length,
    page_ids: pageIds,
    errors: errors.length ? errors : undefined,
  })
}

// ── WhatsApp automations (admin tab "אוטומציות") ──────────────────────────────
//  GET  auto-config            → { config, storage, green }
//  POST auto-config {config}   → save
//  POST auto-run               → execute due automatic rules, return the approval queue
//  POST auto-send {items}      → send approved / manual messages (≤25 per call)
//  POST auto-skip {leadId, ruleKey}
//  POST auto-optout {leadId, optOut}
//  POST auto-test {text, phone?}
//  GET  auto-log · GET auto-leads · GET auto-status · GET auto-health
//  GET  auto-jobs · POST auto-job {job} · POST auto-job-cancel {id} · POST auto-job-delete {id}
//  GET  auto-tick?key=…       → a run triggered by an external pinger (e.g. cron-job.org every 5 minutes)
async function handleAutomations(req, res, action) {
  if (action === 'auto-tick') {
    const key = req.query?.key || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '')
    if (!Auto.tickKeyValid(key)) return res.status(401).json({ error: 'Unauthorized' })
    const [r, meta] = await Promise.all([
      Auto.run({ source: 'external' }).catch(e => ({ ok: false, error: e.message, sent: [], errors: [], suggestions: [], jobs: {} })),
      syncRecentMetaLeads({ hours: 6 }).catch(e => ({ error: e.message })),   // safety net for the Meta webhook
      Booking.retryConfirmations().catch(() => null),                          // booking confirmations Green API refused
    ])
    return res.status(200).json({ ok: r.ok !== false, at: r.at, sent: r.sent?.length || 0, errors: r.errors?.length || 0, queued: r.suggestions?.length || 0, jobs: r.jobs, notes: r.notes, meta })
  }
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  res.setHeader('Cache-Control', 'no-store')
  const b = req.body || {}
  try {
    if (action === 'auto-config' && req.method === 'GET') {
      const { cfg, storage, updatedAt, saved } = await Auto.loadConfig({ fresh: true })
      return res.status(200).json({ config: cfg, storage, updatedAt, saved, greenConfigured: Auto.greenConfigured() })
    }
    if (action === 'auto-config' && req.method === 'POST') {
      if (!b.config || typeof b.config !== 'object') return res.status(400).json({ error: 'config required' })
      await Auto.saveConfig(b.config)
      return res.status(200).json({ ok: true })
    }
    if (action === 'auto-run') {
      // The panel calls this every 5 minutes while open: also pick up any Meta lead the webhook missed
      const [r, meta] = await Promise.all([Auto.run({ source: 'panel' }), syncRecentMetaLeads({ hours: 6 }).catch(e => ({ error: e.message })), Booking.retryConfirmations().catch(() => null)])
      return res.status(200).json({ ...r, meta })
    }
    if (action === 'auto-send')   return res.status(200).json({ results: await Auto.sendItems(Array.isArray(b.items) ? b.items : [], { by: 'manual' }) })
    if (action === 'auto-skip')   return res.status(200).json({ ok: await Auto.skipItem(b.leadId, String(b.ruleKey || '')) })
    if (action === 'auto-optout') return res.status(200).json({ ok: await Auto.setOptOut(b.leadId, !!b.optOut) })
    if (action === 'auto-test') {
      const r = await Auto.sendTest(String(b.text || 'הודעת בדיקה ממערכת האוטומציות של אפיק הנחל ✅'), b.phone)
      return res.status(r.ok ? 200 : 502).json(r)
    }
    if (action === 'auto-log')    return res.status(200).json(await Auto.listLog(Number(req.query?.limit) || 150))
    if (action === 'auto-leads')  return res.status(200).json(await Auto.leadStates())
    if (action === 'auto-status') return res.status(200).json(await Auto.greenStatus())
    if (action === 'auto-health') return res.status(200).json(await Auto.health())
    if (action === 'auto-jobs')   return res.status(200).json(await Auto.listJobs())
    if (action === 'auto-job')    return res.status(200).json({ job: await Auto.saveJob(b.job) })
    if (action === 'auto-job-cancel') return res.status(200).json({ ok: await Auto.cancelJob(String(b.id || '')) })
    if (action === 'auto-job-delete') return res.status(200).json({ ok: await Auto.deleteJob(String(b.id || '')) })
    if (action === 'auto-job-retry')  return res.status(200).json({ ok: await Auto.retryJob(String(b.id || '')) })
    if (action === 'auto-jobs-tick')  return res.status(200).json(await Auto.jobsTick())
    return res.status(404).json({ error: `Unknown automation action: ${action}` })
  } catch (e) {
    console.error('[automations]', action, e.message)
    return res.status(500).json({ error: e.message })
  }
}

// ── Chat name resolution ─────────────────────────────────────────────────────
// Warm serverless instances keep this cache between polls (the panel polls every 30s).
const NAME_TTL = 10 * 60 * 1000
const nameCache = { at: 0, book: new Map(), leads: new Map(), self: '', info: new Map() }
const tail9 = p => String(p || '').replace(/\D/g, '').slice(-9)

async function chatNames(list) {
  const now = Date.now()
  if (now - nameCache.at > NAME_TTL) {
    const book = new Map(), leads = new Map()
    const [rc, rs, dbC, dbM] = await Promise.all([
      fetch(greenUrl('getContacts'), { signal: AbortSignal.timeout(12000) }).then(r => (r.ok ? r.json() : [])).catch(() => []),
      fetch(greenUrl('getWaSettings'), { signal: AbortSignal.timeout(8000) }).then(r => (r.ok ? r.json() : {})).catch(() => ({})),
      SUPABASE_URL && SUPABASE_KEY ? sb().from('contacts').select('name,phone').order('created_at', { ascending: false }).limit(3000).then(r => r.data || []).catch(() => []) : [],
      SUPABASE_URL && SUPABASE_KEY ? sb().from('meta_leads').select('name,phone').order('created_at', { ascending: false }).limit(3000).then(r => r.data || []).catch(() => []) : [],
    ])
    for (const c of Array.isArray(rc) ? rc : []) {
      if (!String(c.id || '').endsWith('@c.us')) continue
      const n = String(c.contactName || c.name || '').trim()
      if (n) book.set(tail9(c.id.split('@')[0]), n)
    }
    // Leads first (newest wins), then Meta leads fill what is still missing
    for (const row of [...dbC, ...dbM]) {
      const k = tail9(row.phone), n = String(row.name || '').trim()
      if (k.length === 9 && n && !leads.has(k)) leads.set(k, n)
    }
    Object.assign(nameCache, { at: now, book, leads, self: tail9(rs?.phone) })
  }
  const map = new Map()
  for (const c of list) {
    const k = tail9(c.phone)
    const waName = nameCache.book.get(k) || c.name || nameCache.info.get(k) || ''
    const leadName = nameCache.leads.get(k) || ''
    if (waName || leadName) map.set(k, { name: leadName || waName, leadName, waName })
  }
  // Last resort: getContactInfo for the newest still-unnamed chats (rate-limited, so a few per poll)
  const missing = list.filter(c => !map.has(tail9(c.phone)) && !nameCache.info.has(tail9(c.phone))).slice(0, 6)
  await Promise.all(missing.map(async c => {
    const k = tail9(c.phone)
    try {
      const r = await fetch(greenUrl('getContactInfo'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: c.chatId }), signal: AbortSignal.timeout(6000) })
      const d = r.ok ? await r.json() : {}
      const n = String(d.contactName || d.name || '').trim()
      nameCache.info.set(k, n)                           // cache misses too, so we never re-ask
      if (n) map.set(k, { name: n, waName: n })
    } catch { nameCache.info.set(k, '') }
  }))
  return { map, self: nameCache.self }
}

// ── Green API chat proxy ───────────────────────────────────────────────────────
// Keeps WA_GREENAPI_TOKEN server-side. The browser only ever talks to these
// endpoints (with the ADMIN_TOKEN guard); it never sees the Green API token.
async function handleChat(req, res, action) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (!GREEN_INSTANCE || !GREEN_TOKEN) {
    const missing = [!GREEN_INSTANCE && 'WA_GREENAPI_INSTANCE', !GREEN_TOKEN && 'WA_GREENAPI_TOKEN'].filter(Boolean)
    // 200 for the status probe so the panel can say exactly what is missing instead of guessing
    if (action === 'chat-status') return res.status(200).json({ state: 'notConfigured', missing })
    return res.status(503).json({ error: `Green API לא מוגדר ב-Vercel (חסר: ${missing.join(', ')})`, notConfigured: true, missing })
  }
  // Green API answers with plain text / JSON errors; pass the real reason through (e.g. 466 = plan limit)
  const greenError = async (r, what) => {
    const t = await r.text().catch(() => '')
    const hint = r.status === 466 ? ' — מגבלת התוכנית ב-Green API (בתוכנית DEVELOPER מספר הצ׳אטים מוגבל)' : r.status === 401 || r.status === 403 ? ' — הטוקן או מספר ה-instance שגויים' : ''
    return { error: `Green API ${what} ${r.status}${hint}`, detail: t.slice(0, 300) }
  }

  try {
    // GET /api/meta/chat-status → instance connection state + the plan quota (466: "connected" but sending is blocked)
    if (action === 'chat-status') {
      const [r, quota] = await Promise.all([greenFetch(greenUrl('getStateInstance'), { signal: AbortSignal.timeout(8000) }), Auto.greenQuota().catch(() => null)])
      const d = await r.json().catch(() => ({}))
      return res.status(r.ok ? 200 : 502).json({ state: d.stateInstance || (r.ok ? null : 'error'), instance: GREEN_INSTANCE, http: r.status, quota: quota?.blocked ? { blocked: true, since: quota.since || quota.at, at: quota.at, used: quota.used, description: quota.description } : null })
    }

    // GET /api/meta/chat-list?days=30 → recent conversations (incoming + outgoing), newest first.
    // Lets the panel show every WhatsApp chat, not only people who are already leads.
    if (action === 'chat-list') {
      const minutes = Math.min(Math.max(Number(req.query?.days) || 30, 1), 90) * 1440
      const [ri, ro] = await Promise.all([
        greenFetch(`${greenUrl('lastIncomingMessages')}?minutes=${minutes}`, { signal: AbortSignal.timeout(20000) }),
        greenFetch(`${greenUrl('lastOutgoingMessages')}?minutes=${minutes}`, { signal: AbortSignal.timeout(20000) }),
      ])
      if (!ri.ok && !ro.ok) return res.status(502).json(await greenError(ri, 'chat-list'))
      const inc = ri.ok ? await ri.json().catch(() => []) : []
      const out = ro.ok ? await ro.json().catch(() => []) : []
      const byChat = new Map()
      for (const m of [...(Array.isArray(inc) ? inc : []), ...(Array.isArray(out) ? out : [])]) {
        const chatId = m.chatId || ''
        if (!chatId.endsWith('@c.us')) continue            // 1:1 chats only (no groups / status)
        const prev = byChat.get(chatId)
        // senderName on an outgoing message is *our* name, so only incoming messages name the chat
        const name = (m.type === 'incoming' ? (m.senderContactName || m.senderName || m.chatName) : m.chatName) || prev?.name || ''
        if (!prev || (m.timestamp || 0) > prev.timestamp) byChat.set(chatId, { chatId, phone: chatId.split('@')[0], name, timestamp: m.timestamp || 0, type: m.type, typeMessage: m.typeMessage, text: m.textMessage || m.caption || '', incoming: (prev?.incoming || 0) + (m.type === 'incoming' ? 1 : 0) })
        else { if (!prev.name && name) prev.name = name; if (m.type === 'incoming') prev.incoming++ }
      }
      const list = [...byChat.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 300)
      // Outgoing messages carry no contact name and incoming ones only sometimes, so resolve
      // names from the phone book, our leads, Meta leads and (last resort) per-chat contact info.
      const names = await chatNames(list).catch(() => ({ map: new Map(), self: '' }))
      for (const c of list) {
        const k = c.phone.slice(-9)
        const hit = names.map.get(k)
        if (hit) { c.name = hit.name || c.name; if (hit.leadName) c.leadName = hit.leadName; if (hit.waName) c.waName = hit.waName }
        if (names.self && c.phone.endsWith(names.self)) c.self = true
        if (BUSINESS_NOTIFY_CHATID && c.chatId === BUSINESS_NOTIFY_CHATID) c.office = true
      }
      return res.status(200).json(list)
    }

    // POST /api/meta/chat-read { phone } → readChat (blue ticks on the customer's side)
    if (action === 'chat-read') {
      const p = normalizePhone((req.body || {}).phone)
      if (!p) return res.status(400).json({ error: 'phone required' })
      const r = await greenFetch(greenUrl('readChat'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: `${p}@c.us` }), signal: AbortSignal.timeout(10000) })
      return res.status(r.ok ? 200 : 502).json(r.ok ? { ok: true } : await greenError(r, 'readChat'))
    }

    // POST /api/meta/chat-history { phone, count } → raw Green getChatHistory array
    if (action === 'chat-history') {
      const { phone, count = 100 } = req.body || {}
      const p = normalizePhone(phone)
      if (!p) return res.status(400).json({ error: 'phone required' })
      const r = await greenFetch(greenUrl('getChatHistory'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${p}@c.us`, count: Math.min(Number(count) || 100, 200) }),
        signal: AbortSignal.timeout(20000),
      })
      if (!r.ok) return res.status(502).json(await greenError(r, 'getChatHistory'))
      const data = await r.json().catch(() => [])
      // Only the fields the chat shows (src/GreenAPIChat.jsx normalizeGreenMsg): Green's raw messages carry a lot more,
      // and this answer is polled every 8 s (Vercel meters every byte a function sends). A 304 when nothing changed.
      return res.status(200).json(Array.isArray(data) ? data.map(slimGreenMsg) : [])
    }

    // POST /api/meta/chat-send { phone, message } → sendMessage
    if (action === 'chat-send') {
      const { phone, message } = req.body || {}
      const p = normalizePhone(phone)
      if (!p || !message) return res.status(400).json({ error: 'phone and message required' })
      // The engine's sender: retries a 429, remembers a blocked plan (466) for the panels, clears it on success
      const r = await Auto.sendText(p, message)
      if (!r.ok) return res.status(502).json({ error: r.error, quota: !!r.quota })
      return res.status(200).json({ ok: true, idMessage: r.idMessage || null })
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
      const r = await greenFetch(greenUrl('sendFileByUpload'), { method: 'POST', body: fd, signal: AbortSignal.timeout(60000) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return res.status(502).json({ error: r.status === 466 ? 'Green API 466 — המכסה החודשית של Green API נגמרה' : `Green API file send failed (${r.status})`, quota: r.status === 466, detail: d })
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
    // NOTE: do NOT add 'follower_count' (New followers) — that metric rejects any
    // date range that includes the current day, which makes the WHOLE query fail
    // with a 500 ("only supports querying data for the last 30 days excluding the
    // current day"), so no Instagram data shows at all. reach + profile_views are
    // the daily metrics that actually return data.
    fields:      ['date', 'reach', 'profile_views'],
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

// ── Google Analytics 4 (direct Data API) ──────────────────────────────────────
// GET /api/meta/ga4?days=28[&fresh=1]   full report (KPIs vs previous period, trend, channels, pages, …)
// GET /api/meta/ga4?realtime=1           active users in the last 30 minutes
async function handleGA4(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const q = req.query || {}
    const data = q.realtime ? await GA4.realtime() : await GA4.report({ days: q.days, fresh: !!q.fresh })
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(data)
  } catch (e) {
    console.error(`[ga4] ${e.message}`)
    return res.status(502).json({ configured: true, error: e.message, kind: e.kind || 'api', serviceAccount: GA4.ga4Credentials().email || '' })
  }
}

// POST /api/meta/ga4-dash { type: dashboard|realtime|page|test, start, end, path, fresh } → the analytics dashboard
// (the same reports as the Korkos site, lib/ga4.js dash). POST /api/meta/ga4-property { property } saves the property id
// (app_settings 'ga4_property_id', used when GA4_PROPERTY_ID isn't set) and tests the connection.
let ga4PropCache = { v: '', at: 0 }
async function ga4Property() {
  if (process.env.GA4_PROPERTY_ID) return ''
  if (Date.now() - ga4PropCache.at < 10 * 60000) return ga4PropCache.v
  try { const { data } = await sb().from('app_settings').select('value').eq('key', 'ga4_property_id').maybeSingle(); ga4PropCache = { v: String(data?.value || '').replace(/\D/g, ''), at: Date.now() } } catch { ga4PropCache = { v: '', at: Date.now() } }
  return ga4PropCache.v
}
async function handleGA4Dash(req, res, action) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  res.setHeader('Cache-Control', 'no-store')
  const b = req.body || {}
  try {
    if (action === 'ga4-property') {
      if (req.method !== 'POST') return res.status(200).json({ property: (await ga4Property()) || GA4.ga4Credentials().property, fromEnv: !!process.env.GA4_PROPERTY_ID })
      const v = String(b.property || '').replace(/\D/g, '')
      if (!v) return res.status(400).json({ error: 'property id required' })
      await sb().from('app_settings').upsert({ key: 'ga4_property_id', value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      ga4PropCache = { v, at: Date.now() }
      return res.status(200).json(await GA4.dash({ type: 'test' }, { property: v }))
    }
    return res.status(200).json(await GA4.dash(b, { property: await ga4Property(), fresh: !!b.fresh }))
  } catch (e) {
    console.error(`[ga4-dash] ${e.message}`)
    const cred = GA4.ga4Credentials()
    return res.status(e.kind === 'request' ? 400 : 502).json({ configured: true, error: e.message, kind: e.kind || 'api', serviceAccount: cred.email || '', keyId: cred.keyId || '' })
  }
}

// ── Lead analysis ─────────────────────────────────────────────────────────────
// POST /api/meta/lead-analyze { lead, ai = true } → rule-based score + Claude briefing (see lib/lead-analyze.js)
async function handleLeadAnalyze(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { lead, ai = true, research = null } = req.body || {}
  if (!lead || (!lead.phone && !lead.name && !lead.msg)) return res.status(400).json({ error: 'lead required' })
  try {
    return res.status(200).json(await analyzeLead(lead, { useAI: ai !== false, research: research && typeof research === 'object' ? research : null }))
  } catch (e) {
    console.error('[lead-analyze]', e.message)
    return res.status(500).json({ error: e.message })
  }
}

// POST /api/meta/chat-summary { lead } → the WhatsApp conversation with the lead, summarized for the lead card
// (lib/chat-summary.js): what was discussed, what they want, what was agreed, open questions, next step, suggested stage
async function handleChatSummary(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { lead } = req.body || {}
  if (!lead || !lead.phone) return res.status(400).json({ error: 'lead with a phone required' })
  try {
    const r = await summarizeChat(lead)
    return res.status(r.error ? (r.code === 'empty' || r.code === 'no_phone' ? 200 : 502) : 200).json(r)
  } catch (e) {
    console.error('[chat-summary]', e.message)
    return res.status(500).json({ error: e.message })
  }
}

// POST /api/meta/lead-research { lead } → who the person is, from public sources (lib/lead-research.js); the panel
// runs it before lead-analyze and passes the result in, so each step has its own time budget
async function handleLeadResearch(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { lead } = req.body || {}
  if (!lead || (!lead.phone && !lead.name)) return res.status(400).json({ error: 'lead with a name or phone required' })
  try {
    // their own recent WhatsApp messages + repeat inquiries help the search (same dossier as the analysis)
    // (capped at 4 s: the research has its own budget and the WhatsApp history is only a hint for it)
    const d = await Promise.race([buildDossier(lead).catch(() => null), new Promise(r => setTimeout(() => r(null), 4000))])
    const extras = d ? { chatSample: d.chat.filter(m => m.dir === 'in').slice(-6).map(m => m.text.slice(0, 160)), repeats: d.repeats } : {}
    return res.status(200).json(await researchLead(lead, { extras }))
  } catch (e) {
    console.error('[lead-research]', e.message)
    return res.status(500).json({ error: e.message })
  }
}

// ── Booking page (our own Calendly: /book) ────────────────────────────────────
//  public: GET booking-config · GET booking-slots?type=&from=&days=[&m=] · POST booking-create
//          GET booking-manage?m= · POST booking-reschedule {m, start} · POST booking-cancel-self {m}  (m = the client's private key)
//          GET booking-oauth-callback (Google sends the office back here after "connect the calendar")
//  admin:  GET booking-admin · POST booking-settings {config} · POST booking-connect → {url} · POST booking-disconnect
//          POST booking-cancel {id} · POST booking-resend {id} · POST booking-test-email
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
function oauthPage(ok, text) {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>חיבור היומן</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#09090F;color:#E8E4D8;font-family:Heebo,Arial,sans-serif">
<div style="max-width:420px;padding:32px;text-align:center"><div style="font-size:44px">${ok ? '✅' : '⚠️'}</div>
<h1 style="font-size:22px;margin:12px 0">${ok ? 'היומן חובר' : 'החיבור לא הצליח'}</h1><p style="line-height:1.7;color:#B9B5AA">${esc(text)}</p>
<a href="/admin-panel" style="display:inline-block;margin-top:16px;background:#8490D8;color:#09090F;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none">חזרה לפאנל</a></div></body></html>`
}
// ── Image library (admin "תמונות האתר", src/MediaLibraryTab.jsx) ─────────────────────────────────────────────────────
//  GET  media-status → { canReplace, repo, branch }
//  POST media-replace { path: '/img/ceo.webp', content: <base64>, type } → commits public<path> on the content branch
//       (GITHUB_CONTENT_TOKEN, a fine-grained token with Contents: read & write on the repository) → Vercel redeploys
const GH_REPO = () => process.env.GITHUB_CONTENT_REPO || 'afikhanahal-creator/afik-hanahal'
const GH_BRANCH = () => process.env.GITHUB_CONTENT_BRANCH || 'main'
async function handleMedia(req, res, action) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  res.setHeader('Cache-Control', 'no-store')
  const token = process.env.GITHUB_CONTENT_TOKEN || ''
  if (action === 'media-status') return res.status(200).json({ canReplace: !!token, repo: GH_REPO(), branch: GH_BRANCH() })
  if (action !== 'media-replace' || req.method !== 'POST') return res.status(404).json({ error: `Unknown path: ${action}` })
  if (!token) return res.status(400).json({ ok: false, setup: true, error: 'GITHUB_CONTENT_TOKEN חסר ב-Vercel' })
  const { REPLACEABLE, mimeFor } = await import('../lib/site-images.js')
  const b = req.body || {}
  const p = String(b.path || '')
  if (!REPLACEABLE.test(p)) return res.status(400).json({ ok: false, error: 'אפשר להחליף רק תמונות מתוך /img או את הלוגו' })
  const content = String(b.content || '').replace(/^data:[^,]*,/, '')
  if (!content || content.length > 4_000_000 || !/^[A-Za-z0-9+/=\s]+$/.test(content)) return res.status(400).json({ ok: false, error: 'קובץ ריק או גדול מדי (עד 3MB)' })
  const ext = p.split('.').pop()
  if (b.type && mimeFor(ext) && b.type !== mimeFor(ext)) return res.status(400).json({ ok: false, error: `הקובץ צריך להיות ${ext.toUpperCase()} כדי לשמור על אותו שם` })
  const api = `https://api.github.com/repos/${GH_REPO()}/contents/public${p}`
  const H = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'afik-hanahal-admin' }
  try {
    const cur = await fetch(`${api}?ref=${encodeURIComponent(GH_BRANCH())}`, { headers: H, signal: AbortSignal.timeout(10000) })
    const sha = cur.ok ? (await cur.json()).sha : undefined
    const put = await fetch(api, {
      method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ message: `Admin image library: replace ${p}`, content: content.replace(/\s+/g, ''), branch: GH_BRANCH(), ...(sha ? { sha } : {}) }),
    })
    const d = await put.json().catch(() => ({}))
    if (!put.ok) return res.status(502).json({ ok: false, error: `GitHub ${put.status}: ${String(d.message || '').slice(0, 160)}` })
    return res.status(200).json({ ok: true, commit: d.commit?.sha?.slice(0, 7) || '', path: p })
  } catch (e) { return res.status(502).json({ ok: false, error: e.message }) }
}

async function handleBooking(req, res, action) {
  try {
    if (action === 'booking-config') {
      const [cfg, st] = await Promise.all([Booking.loadConfig(), GCal.status()])
      res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600')
      return res.status(200).json(Booking.publicConfig(cfg, st.connected))
    }
    if (action === 'booking-slots') {
      const q = req.query || {}
      const m = String(q.m || '')
      const r = await Booking.slots({ typeId: String(q.type || ''), from: String(q.from || ''), days: Number(q.days) || 7, m })
      res.setHeader('Cache-Control', m ? 'no-store' : 'public, s-maxage=20, stale-while-revalidate=40')
      return res.status(200).json(r)
    }
    if (['booking-manage', 'booking-reschedule', 'booking-cancel-self'].includes(action)) {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Robots-Tag', 'noindex')
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      const body = req.body || {}
      if (action !== 'booking-manage' && req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
      const r = action === 'booking-manage' ? await Booking.manage(String(req.query?.m || ''), { ip })
        : action === 'booking-reschedule' ? await Booking.reschedule(sb(), String(body.m || ''), String(body.start || ''), { ip })
        : await Booking.cancelByClient(sb(), String(body.m || ''), { ip })
      return res.status(r.ok ? 200 : r.status || 400).json(r)
    }
    if (action === 'booking-create') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
      res.setHeader('Cache-Control', 'no-store')
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      const r = await Booking.create(sb(), req.body || {}, { ip })
      return res.status(r.ok ? 200 : r.status || 400).json(r)
    }
    if (action === 'booking-oauth-callback') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      const q = req.query || {}
      if (q.error) return res.status(200).end(oauthPage(false, q.error === 'access_denied' ? 'לא אישרתם גישה ליומן. אפשר לנסות שוב מהפאנל.' : `Google: ${q.error}`))
      if (!GCal.stateValid(q.state)) return res.status(400).end(oauthPage(false, 'הקישור פג. לחצו שוב "חבר יומן" בפאנל.'))
      try {
        const { email } = await GCal.connect(String(q.code || ''))
        return res.status(200).end(oauthPage(true, `היומן ${email || ''} מחובר. מעכשיו כל פגישה שנקבעת באתר נכנסת אליו, והשעות התפוסות בו לא יוצעו ללקוחות.`))
      } catch (e) { return res.status(200).end(oauthPage(false, e.message)) }
    }
    if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
    res.setHeader('Cache-Control', 'no-store')
    const b = req.body || {}
    if (action === 'booking-admin') return res.status(200).json(await Booking.adminState(sb()))
    if (action === 'booking-settings') return res.status(200).json({ ok: true, config: await Booking.saveConfig(b.config || {}) })
    if (action === 'booking-connect') {
      if (!GCal.oauthReady()) return res.status(400).json({ error: 'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET חסרים ב-Vercel', redirectUri: GCal.REDIRECT_URI() })
      return res.status(200).json({ url: GCal.authUrl() })
    }
    if (action === 'booking-disconnect') { await GCal.disconnect(); return res.status(200).json({ ok: true }) }
    if (action === 'booking-cancel') return res.status(200).json(await Booking.cancel(String(b.id || '')))
    if (action === 'booking-resend') return res.status(200).json(await Booking.resend(String(b.id || '')))
    if (action === 'booking-test-email') return res.status(200).json(await Booking.testEmail())
    return res.status(404).json({ error: `Unknown path: ${action}` })
  } catch (e) {
    console.error('[booking]', action, e.message)
    return res.status(500).json({ error: e.message })
  }
}

// ── main router ───────────────────────────────────────────────────────────────

// Disable Vercel's automatic body parser so we can read the raw bytes.
// Required for correct Meta webhook signature verification — Meta signs the
// exact raw payload bytes, and JSON.stringify(parsedBody) ≠ original bytes.
export const config = { api: { bodyParser: false } }

// The fields of a Green API message the panel's chat uses (kept in step with normalizeGreenMsg in src/GreenAPIChat.jsx)
const GREEN_MSG_FIELDS = ['idMessage', 'type', 'typeMessage', 'timestamp', 'statusMessage', 'textMessage', 'caption', 'downloadUrl', 'fileName', 'mimeType', 'jpegThumbnail', 'location', 'latitude', 'longitude', 'nameLocation', 'address', 'contact', 'chatId']
const slimQuoted = q => (q && typeof q === 'object' ? { textMessage: q.textMessage, caption: q.caption, typeMessage: q.typeMessage, type: q.type } : undefined)
function slimGreenMsg(m) {
  if (!m || typeof m !== 'object') return m
  const out = {}
  for (const k of GREEN_MSG_FIELDS) if (m[k] !== undefined && m[k] !== null && m[k] !== '') out[k] = m[k]
  const q = slimQuoted(m.quotedMessage || m.extendedTextMessageData?.quotedMessage)
  if (q) out.quotedMessage = q
  return out
}

export default async function handler(req, res) {
  compressJson(req, res)   // gzip + ETag on every JSON answer — Vercel meters what a function sends (Fast Origin Transfer)
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
  if (path.startsWith('auto-'))  return handleAutomations(req, res, path)
  if (path.startsWith('booking-')) return handleBooking(req, res, path)
  if (path.startsWith('media-')) return handleMedia(req, res, path)
  if (path === 'supermetrics')   return handleSupermetrics(req, res)
  if (path === 'ga4')            return handleGA4(req, res)
  if (path === 'ga4-dash' || path === 'ga4-property') return handleGA4Dash(req, res, path)
  if (path === 'lead-analyze')   return handleLeadAnalyze(req, res)
  if (path === 'lead-research')  return handleLeadResearch(req, res)
  if (path === 'chat-summary')   return handleChatSummary(req, res)
  if (path === 'diagnostics')    return handleDiagnostics(req, res)
  if (path === 'connect')        return handleConnect(req, res)
  if (path === 'lead-welcome')   return handleLeadWelcome(req, res)
  if (path === 'lead-to-crm' || path === 'crm-sync') return handleMetaCRM(req, res, path)

  return res.status(404).json({ error: `Unknown path: ${path}` })
}
