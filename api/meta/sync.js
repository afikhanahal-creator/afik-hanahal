// Vercel serverless — GET /api/meta/sync?page_id=X
// Sync existing leads from Meta Graph API into meta_leads table
// Requires: Authorization: Bearer AFIKhanahal2026

import { createClient } from '@supabase/supabase-js'

const ADMIN_TOKEN            = process.env.ADMIN_TOKEN            || 'AFIKhanahal2026'
const META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || process.env.WA_META_TOKEN || ''
const SUPABASE_URL           = process.env.SUPABASE_URL           || ''
const SUPABASE_KEY           = process.env.SUPABASE_SERVICE_KEY   || ''

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  }
}

async function graphGet(path, token) {
  const url = `https://graph.facebook.com/v20.0${path}${path.includes('?') ? '&' : '?'}access_token=${token}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Graph ${path} → HTTP ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

function normalizePhone(raw) {
  if (!raw) return raw
  const digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('972')) return digits
  if (digits.startsWith('0')) return '972' + digits.slice(1)
  return digits
}

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
  if (req.method === 'OPTIONS') {
    return res.status(204).set(corsHeaders()).end()
  }
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v))

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check
  const auth = req.headers['authorization'] || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const pageId = req.query.page_id || process.env.META_PAGE_ID || ''
  if (!pageId) {
    return res.status(400).json({ error: 'page_id query param required' })
  }

  if (!META_PAGE_ACCESS_TOKEN) {
    return res.status(500).json({ error: 'META_PAGE_ACCESS_TOKEN not configured' })
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
  let totalSynced = 0
  const errors = []

  try {
    // Fetch all lead forms for this page
    let formsData
    try {
      formsData = await graphGet(`/${pageId}/leadgen_forms?fields=id,name`, META_PAGE_ACCESS_TOKEN)
    } catch (e) {
      return res.status(500).json({ error: `Failed to fetch forms: ${e.message}` })
    }

    const forms = formsData.data || []
    console.log(`[Sync] Found ${forms.length} forms for page ${pageId}`)

    for (const form of forms) {
      let cursor = null
      let page = 1

      do {
        let leadsUrl = `/${form.id}/leads?fields=id,created_time,field_data,campaign_id,ad_id,page_id`
        if (cursor) leadsUrl += `&after=${cursor}`

        let leadsData
        try {
          leadsData = await graphGet(leadsUrl, META_PAGE_ACCESS_TOKEN)
        } catch (e) {
          errors.push(`Form ${form.id} p${page}: ${e.message}`)
          break
        }

        const leads = leadsData.data || []

        for (const lead of leads) {
          try {
            const parsed = parseFieldData(lead.field_data)
            const phone  = normalizePhone(parsed.phone)

            const payload = {
              leadgen_id:    lead.id,
              name:          parsed.name  || null,
              email:         parsed.email || null,
              phone:         phone        || null,
              campaign_id:   lead.campaign_id || null,
              ad_id:         lead.ad_id   || null,
              form_id:       form.id,
              form_name:     form.name    || null,
              raw_fields:    lead.field_data || [],
              page_id:       lead.page_id || pageId,
              status:        'new',
              // Do NOT set wa_sent — historical leads don't get welcome WA
            }

            const { error: upsertErr } = await sb
              .from('meta_leads')
              .upsert(payload, { onConflict: 'leadgen_id', ignoreDuplicates: true })

            if (upsertErr) throw upsertErr
            totalSynced++
          } catch (e) {
            errors.push(`Lead ${lead.id}: ${e.message}`)
          }
        }

        cursor = leadsData.paging?.cursors?.after
        const hasNext = !!(leadsData.paging?.next)
        if (!hasNext) cursor = null
        page++
      } while (cursor && page < 20) // safety cap

    }

    return res.status(200).json({
      synced: totalSynced,
      forms: forms.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('[Sync] Fatal error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
