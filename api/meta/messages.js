// Vercel serverless — /api/meta/messages
// GET  ?lead_id=X          → return messages for lead ordered by created_at ASC
// POST { lead_id, message } → send WA message to lead, store in meta_messages

import { createClient } from '@supabase/supabase-js'

const ADMIN_TOKEN  = process.env.ADMIN_TOKEN || 'AFIKhanahal2026'
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

const WA_META_TOKEN   = process.env.WA_META_TOKEN   || ''
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || '1160230953835065'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  }
}

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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).set(corsHeaders()).end()
  }
  Object.entries(corsHeaders()).forEach(([k, v]) => res.setHeader(k, v))

  // Auth check
  const auth = req.headers['authorization'] || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

  // ── GET: fetch messages for a lead ─────────────────────────────────────────
  if (req.method === 'GET') {
    const leadId = req.query.lead_id
    if (!leadId) {
      return res.status(400).json({ error: 'lead_id required' })
    }

    try {
      const { data: messages, error } = await sb
        .from('meta_messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return res.status(200).json({ messages: messages || [] })
    } catch (err) {
      console.error('[MetaMessages] GET error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  // ── POST: send new message ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { lead_id, message } = req.body || {}
    if (!lead_id || !message) {
      return res.status(400).json({ error: 'lead_id and message required' })
    }

    try {
      // Fetch lead to get phone
      const { data: lead, error: leadErr } = await sb
        .from('meta_leads')
        .select('id, phone')
        .eq('id', lead_id)
        .single()

      if (leadErr || !lead) {
        return res.status(404).json({ error: 'Lead not found' })
      }

      if (!lead.phone) {
        return res.status(400).json({ error: 'Lead has no phone number' })
      }

      // Send WA message
      const waMessageId = WA_META_TOKEN ? await sendWAMessage(lead.phone, message) : null

      // Store in DB
      const { data: newMsg, error: insertErr } = await sb
        .from('meta_messages')
        .insert({
          lead_id: lead.id,
          direction: 'out',
          message,
          wa_message_id: waMessageId || null,
        })
        .select('*')
        .single()

      if (insertErr) throw insertErr

      return res.status(201).json({ message: newMsg })
    } catch (err) {
      console.error('[MetaMessages] POST error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
