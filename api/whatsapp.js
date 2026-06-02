// Vercel serverless function — Meta WhatsApp Business API bot
// Handles webhook verification (GET) and incoming messages (POST)

import { createClient } from '@supabase/supabase-js'

const WA_META_TOKEN   = process.env.WA_META_TOKEN   || 'EAAnqYHiWM8cBRY4NZCJoUxhn41ETA9XiODRsPtkbkZAeyNULZBgJJBWcgdpaL0nrJVKw0y8PGD9XOiMXyacGlYTWS0HC41GguWbdMIUQn3NZBScF7guZCD9bwZAZAa4v0nI2ht4nrmF4CY0ayni8TKSVWSkoM2ywMRC9GSTp2nHSOxSm6RZB7tnDjRvdEN75LP5EWSsUe9oaxMpuojrdctDV8bkXuuI27N9nwh3E9kviZBZBZAYVcw054i9hd7wXmQTGvL7MkfZApzQjHluRBWaY2wOR'
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || '1160230953835065'
const VERIFY_TOKEN    = process.env.WA_VERIFY_TOKEN    || 'AFIKhanahal2026'
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY  || process.env.ANTHROPIC_API_KEY
const WA_BOT_ENABLED  = process.env.WA_BOT_ENABLED !== 'false'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

// ── Normalize phone: strip non-digits, ensure 972-prefixed ──────────────────
function normalizePhone(raw) {
  if (!raw) return raw
  const d = String(raw).replace(/\D/g, '')
  if (d.startsWith('972')) return d
  if (d.startsWith('0')) return '972' + d.slice(1)
  return d
}

// ── Store inbound message in meta_messages if phone matches a meta_lead ──────
async function storeInboundMetaMessage(from, text) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
    const normFrom = normalizePhone(from)

    // Try several phone variants to find a match
    const variants = new Set([normFrom])
    // Add without country code (Israeli local)
    if (normFrom.startsWith('972')) variants.add('0' + normFrom.slice(3))
    // The raw value as-is
    variants.add(from)

    let matchedLead = null
    for (const variant of variants) {
      const { data } = await sb
        .from('meta_leads')
        .select('id')
        .eq('phone', variant)
        .limit(1)
        .single()
      if (data) { matchedLead = data; break }
    }

    if (!matchedLead) return // no meta lead for this number

    await sb.from('meta_messages').insert({
      lead_id: matchedLead.id,
      direction: 'in',
      message: text,
    })
  } catch (e) {
    // Non-fatal — don't block main bot flow
    console.warn('[WA] storeInboundMetaMessage error:', e.message)
  }
}

const SYSTEM_PROMPT = `אתה עוזר מכירות ושירות לקוחות של חברת "אפיק הנחל" — חברה יזמית מובילה לאיתור, שיווק וליווי עסקאות קרקע בישראל.

תפקידך:
- לענות על שאלות לקוחות בנוגע לקרקעות ומגרשים בשרון ובמרכז ישראל
- לעזור ללקוחות להבין את תהליך רכישת קרקע
- לסנן לידים ולעודד אותם להשאיר פרטים או לתאם פגישה

כללים:
- ענה תמיד בעברית, בסגנון חם, מקצועי ואישי
- תשובות קצרות וממוקדות (עד 3–4 משפטים)
- אם הלקוח מבקש מחיר מדויק — אמור שהמחיר תלוי במיקום ובייעוד ותזמן שיחה
- תמיד סיים עם הצעה לפעולה: "אשמח לחבר אותך עם הצוות שלנו — שלח לי שם ומספר טלפון ונחזור אליך תוך שעה"
- אל תמציא פרטי נכסים ספציפיים שלא ידועים לך
- הטלפון לייעוץ: 055-981-1814 (ישראל בן יהודה)

מידע על החברה:
- שם: אפיק הנחל — ייזום שיווק ותיווך
- מתמחים: קרקעות ומגרשים (לא דירות, לא שכירות)
- אזורי פעילות: שרון, מרכז, וכל רחבי ישראל
- שעות פעילות: ראשון–חמישי 9:00–19:00, שישי 9:00–14:00`

export default async function handler(req, res) {
  // ── Webhook verification (Meta sends GET to confirm URL) ──────────────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[WA] Webhook verified')
      return res.status(200).send(challenge)
    }
    return res.status(403).json({ error: 'Forbidden — verify token mismatch' })
  }

  // ── Incoming messages (Meta sends POST) ───────────────────────────────────
  if (req.method === 'POST') {
    // CRITICAL: must NOT respond before processing. Vercel kills the function
    // the instant the response is flushed, so the Supabase insert + WA reply
    // would die mid-flight. Meta accepts up to 20s; maxDuration is 30s.
    const body = req.body

    if (!WA_BOT_ENABLED) return res.status(200).json({ status: 'ok', skipped: 'bot disabled' })

    try {
      if (body?.object !== 'whatsapp_business_account') {
        return res.status(200).json({ status: 'ok', skipped: 'not a WhatsApp event' })
      }

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue
          const value = change.value || {}

          for (const msg of value.messages || []) {
            if (msg.type !== 'text') continue

            const from  = msg.from         // e.g. "972501234567"
            const text  = msg.text?.body   // customer message
            const msgId = msg.id

            if (!from || !text) continue

            // Mark read + persist + AI reply, all awaited so nothing dies on flush.
            await markRead(msgId).catch(e => console.warn('[WA] markRead:', e.message))
            await storeInboundMetaMessage(from, text).catch(e => console.warn('[WA] store inbound:', e.message))
            const reply = await getAIResponse(text, from)
            await sendWAMessage(from, reply)
            console.log(`[WA] Replied to ${from}: ${reply.slice(0, 80)}...`)
          }
        }
      }
    } catch (err) {
      console.error('[WA] Error processing message:', err)
      if (!res.headersSent) return res.status(200).json({ status: 'error', error: err.message })
    }

    if (!res.headersSent) return res.status(200).json({ status: 'ok' })
    return
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ── Claude AI ─────────────────────────────────────────────────────────────────
async function getAIResponse(userMessage, from) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[AI] API error:', err)
      return fallbackReply()
    }

    const data = await response.json()
    return data.content?.[0]?.text || fallbackReply()
  } catch (err) {
    console.error('[AI] Fetch error:', err)
    return fallbackReply()
  }
}

function fallbackReply() {
  return 'תודה על פנייתך לאפיק הנחל! נציג שלנו יחזור אליך בהקדם. לייעוץ מיידי: 055-981-1814'
}

// ── WhatsApp API helpers ───────────────────────────────────────────────────────
async function sendWAMessage(to, message) {
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
    console.error('[WA] Send error:', err)
  }
}

async function markRead(messageId) {
  try {
    await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_META_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    })
  } catch {}
}
