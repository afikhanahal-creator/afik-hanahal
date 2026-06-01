// Vercel serverless — Meta Lead Ads webhook
// GET  ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=... → verify
// POST { object:'page', entry:[{ changes:[{ field:'leadgen', value:{...} }] }] }

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || process.env.WA_META_TOKEN || ''
const META_APP_SECRET        = process.env.META_APP_SECRET        || ''
const META_LEADS_VERIFY_TOKEN = process.env.META_LEADS_VERIFY_TOKEN || 'AFIKhanahal2026leads'

const WA_META_TOKEN   = process.env.WA_META_TOKEN   || ''
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || '1160230953835065'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  }
}

// ── WhatsApp send helper (local copy) ───────────────────────────────────────
async function sendWAMessage(to, message) {
  try {
    const resp = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_META_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message, preview_url: false },
      }),
    })
    if (!resp.ok) {
      const err = await resp.text()
      console.error('[WA] send error:', err)
      return null
    }
    const data = await resp.json()
    return data?.messages?.[0]?.id || null
  } catch (e) {
    console.error('[WA] sendWAMessage exception:', e)
    return null
  }
}

// ── Phone normalisation ──────────────────────────────────────────────────────
// Meta gives "972501234567" — keep consistent
function normalizePhone(raw) {
  if (!raw) return raw
  const digits = String(raw).replace(/\D/g, '')
  // Already starts with 972
  if (digits.startsWith('972')) return digits
  // Israeli local 05x / 07x / 02-09 → prepend 972, strip leading 0
  if (digits.startsWith('0')) return '972' + digits.slice(1)
  return digits
}

// ── Graph API helpers ────────────────────────────────────────────────────────
async function graphGet(path, token) {
  const url = `https://graph.facebook.com/v20.0${path}${path.includes('?') ? '&' : '?'}access_token=${token}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Graph ${path} → HTTP ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

// ── Parse field_data array into name/email/phone ─────────────────────────────
function parseFieldData(fieldData) {
  const fields = {}
  for (const f of fieldData || []) {
    const key = (f.name || '').toLowerCase().replace(/[\s_-]/g, '')
    const val = Array.isArray(f.values) ? f.values[0] : f.value
    if (!val) continue
    if (key.includes('fullname') || key.includes('name'))  fields.name  = fields.name  || val
    if (key.includes('email'))                              fields.email = fields.email || val
    if (key.includes('phone') || key.includes('mobile'))   fields.phone = fields.phone || val
  }
  return fields
}

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).set(corsHeaders()).end()
  }

  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v))

  // ── GET: webhook verification ────────────────────────────────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && token === META_LEADS_VERIFY_TOKEN) {
      console.log('[MetaLeads] Webhook verified')
      return res.status(200).send(challenge)
    }
    return res.status(403).json({ error: 'Verify token mismatch' })
  }

  // ── POST: lead event ─────────────────────────────────────────────────────
  if (req.method === 'POST') {
    // Respond 200 immediately so Meta doesn't retry
    res.status(200).json({ status: 'ok' })

    try {
      // Verify HMAC signature if app secret is configured
      if (META_APP_SECRET) {
        const sig = req.headers['x-hub-signature-256'] || ''
        const rawBody = JSON.stringify(req.body)
        const expected = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(rawBody).digest('hex')
        if (sig !== expected) {
          console.warn('[MetaLeads] Signature mismatch — ignoring')
          return
        }
      }

      const body = req.body
      if (body?.object !== 'page') return

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'leadgen') continue

          const { leadgen_id, page_id } = change.value || {}
          if (!leadgen_id) continue

          console.log(`[MetaLeads] New lead: ${leadgen_id}`)

          // ── Fetch full lead data ─────────────────────────────────────
          let leadData, campaignName = '', formName = ''
          try {
            leadData = await graphGet(
              `/${leadgen_id}?fields=id,created_time,field_data,campaign_id,ad_id,form_id,page_id`,
              META_PAGE_ACCESS_TOKEN
            )
          } catch (e) {
            console.error('[MetaLeads] Failed to fetch lead:', e.message)
            continue
          }

          // ── Fetch campaign name ──────────────────────────────────────
          if (leadData.campaign_id) {
            try {
              const camp = await graphGet(`/${leadData.campaign_id}?fields=name`, META_PAGE_ACCESS_TOKEN)
              campaignName = camp.name || ''
            } catch (e) {
              console.warn('[MetaLeads] campaign fetch:', e.message)
            }
          }

          // ── Fetch form name ──────────────────────────────────────────
          if (leadData.form_id) {
            try {
              const form = await graphGet(`/${leadData.form_id}?fields=name`, META_PAGE_ACCESS_TOKEN)
              formName = form.name || ''
            } catch (e) {
              console.warn('[MetaLeads] form fetch:', e.message)
            }
          }

          // ── Parse contact fields ─────────────────────────────────────
          const parsed = parseFieldData(leadData.field_data)
          const phone  = normalizePhone(parsed.phone)
          const name   = parsed.name || ''
          const email  = parsed.email || ''
          const firstName = name.split(' ')[0] || name

          // ── Upsert into Supabase ─────────────────────────────────────
          if (!SUPABASE_URL || !SUPABASE_KEY) {
            console.error('[MetaLeads] Supabase env vars missing')
            continue
          }
          const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

          const upsertPayload = {
            leadgen_id,
            name,
            email,
            phone,
            campaign_id:   leadData.campaign_id   || null,
            campaign_name: campaignName,
            ad_id:         leadData.ad_id          || null,
            form_id:       leadData.form_id        || null,
            form_name:     formName,
            raw_fields:    leadData.field_data     || [],
            page_id:       leadData.page_id        || page_id || null,
            status:        'new',
          }

          const { data: inserted, error: upsertErr } = await sb
            .from('meta_leads')
            .upsert(upsertPayload, { onConflict: 'leadgen_id' })
            .select('id')
            .single()

          if (upsertErr) {
            console.error('[MetaLeads] Supabase upsert error:', upsertErr)
            continue
          }

          const leadId = inserted?.id

          // ── Send WhatsApp welcome message ────────────────────────────
          if (phone && WA_META_TOKEN) {
            const sourceName = campaignName || formName || 'הנכס שלנו'
            const waMsg = `היי ${firstName} 👋\nתודה שמלאת פרטים לגבי ${sourceName}!\nאנחנו מצוות אפיק הנחל 🏠\n\nמתי יהיה נוח לך שנדבר?\nנשמח לתאם שיחה ולספר לך יותר פרטים 📞`

            const waMessageId = await sendWAMessage(phone, waMsg)

            // Store outbound message
            if (leadId) {
              await sb.from('meta_messages').insert({
                lead_id: leadId,
                direction: 'out',
                message: waMsg,
                wa_message_id: waMessageId || null,
              })

              await sb.from('meta_leads').update({ wa_sent: true }).eq('id', leadId)
            }

            console.log(`[MetaLeads] WA sent to ${phone} (lead ${leadId})`)
          }
        }
      }
    } catch (err) {
      console.error('[MetaLeads] Unhandled error:', err)
    }

    return
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
