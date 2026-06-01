// Vercel serverless — GET /api/meta/leads
// Returns all Meta leads with message counts, ordered by created_at DESC
// Requires: Authorization: Bearer AFIKhanahal2026

import { createClient } from '@supabase/supabase-js'

const ADMIN_TOKEN  = process.env.ADMIN_TOKEN || 'AFIKhanahal2026'
const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  }
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

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Fetch leads ordered by created_at DESC
    const { data: leads, error: leadsErr } = await sb
      .from('meta_leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (leadsErr) throw leadsErr

    if (!leads || leads.length === 0) {
      return res.status(200).json({ leads: [] })
    }

    // Fetch message counts per lead
    const leadIds = leads.map(l => l.id)
    const { data: msgCounts, error: msgErr } = await sb
      .from('meta_messages')
      .select('lead_id')
      .in('lead_id', leadIds)

    // Build a count map
    const countMap = {}
    for (const row of msgCounts || []) {
      countMap[row.lead_id] = (countMap[row.lead_id] || 0) + 1
    }

    const enriched = leads.map(l => ({ ...l, message_count: countMap[l.id] || 0 }))

    return res.status(200).json({ leads: enriched })
  } catch (err) {
    console.error('[MetaLeads] leads.js error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
