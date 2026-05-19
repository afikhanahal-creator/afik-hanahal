// Vercel serverless function — Meta Conversions API (CAPI)
// Receives events from the browser, hashes PII server-side, forwards to Meta
// Token type: Dataset Quality API / System User token (permanent)

import { createHash } from 'crypto'

const CAPI_TOKEN = process.env.META_CAPI_TOKEN ||
  'EAAOBFZAXNIScBRSg6zKgQmxOqYMWUNSu1YmLZC6hcd44hbs0FpZCr3qKlbHtx7UJEbCPXDhWBZCOLq9xITdQXJwGiBz2gnzZC4iA0F6uGHFLIPWUTo2iHLK11xSHBPsZCHuf3UpzcQfXrmjlo3JZBtkmcfGDKetE2J4CECQelzw3WJCTOUjZBhOgFSXlzPWEqAZDZD'
const PIXEL_ID   = process.env.META_PIXEL_ID || '1341264237748951'

const sha256 = v =>
  v ? createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('972')) return digits
  if (digits.startsWith('0'))   return '972' + digits.slice(1)
  return digits
}

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const { events = [] } = req.body || {}
  if (!events.length) return res.status(400).json({ error: 'No events provided' })

  // Client IP (Vercel sets x-forwarded-for)
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const ua = req.headers['user-agent'] || ''

  const data = events.map(ev => {
    const user_data = {
      client_ip_address: ip || undefined,
      client_user_agent: ua || undefined,
    }

    // Hash PII (required by Meta)
    if (ev.email) user_data.em = [sha256(ev.email)]
    if (ev.phone) {
      const ph = normalizePhone(ev.phone)
      if (ph) user_data.ph = [sha256(ph)]
    }
    if (ev.name) {
      const parts = String(ev.name).trim().split(/\s+/)
      user_data.fn = [sha256(parts[0])]
      if (parts.length > 1) user_data.ln = [sha256(parts.slice(1).join(' '))]
    }

    // Cookie-based matching (passed from browser)
    if (ev.fbp) user_data.fbp = ev.fbp
    if (ev.fbc) user_data.fbc = ev.fbc

    const entry = {
      event_name:       ev.event_name,
      event_time:       Math.floor(Date.now() / 1000),
      event_source_url: ev.url || 'https://afikhanahal.co.il/',
      action_source:    'website',
      user_data,
    }

    // event_id enables deduplication with browser Pixel
    if (ev.event_id) entry.event_id = ev.event_id

    // Custom data (content_name, value, currency, etc.)
    if (ev.custom_data && Object.keys(ev.custom_data).length) {
      entry.custom_data = ev.custom_data
    }

    return entry
  })

  try {
    const resp = await fetch(
      `https://graph.facebook.com/v25.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ data }),
      }
    )
    const result = await resp.json()
    console.log('[CAPI] Response:', JSON.stringify(result))
    return res.status(resp.ok ? 200 : 400).json(result)
  } catch (err) {
    console.error('[CAPI] Fetch error:', err)
    return res.status(500).json({ error: err.message })
  }
}
