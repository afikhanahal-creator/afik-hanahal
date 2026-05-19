// Vercel serverless function — Meta WhatsApp Business API bot
// Handles webhook verification (GET) and incoming messages (POST)

const WA_META_TOKEN   = process.env.WA_META_TOKEN   || 'EAAnqYHiWM8cBRY4NZCJoUxhn41ETA9XiODRsPtkbkZAeyNULZBgJJBWcgdpaL0nrJVKw0y8PGD9XOiMXyacGlYTWS0HC41GguWbdMIUQn3NZBScF7guZCD9bwZAZAa4v0nI2ht4nrmF4CY0ayni8TKSVWSkoM2ywMRC9GSTp2nHSOxSm6RZB7tnDjRvdEN75LP5EWSsUe9oaxMpuojrdctDV8bkXuuI27N9nwh3E9kviZBZBZAYVcw054i9hd7wXmQTGvL7MkfZApzQjHluRBWaY2wOR'
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || '1160230953835065'
const VERIFY_TOKEN    = process.env.WA_VERIFY_TOKEN    || 'AFIKhanahal2026'
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY  || process.env.ANTHROPIC_API_KEY
const WA_BOT_ENABLED  = process.env.WA_BOT_ENABLED !== 'false'

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
    const body = req.body

    // Always respond 200 immediately so Meta doesn't retry
    res.status(200).json({ status: 'ok' })

    if (!WA_BOT_ENABLED) return

    try {
      if (body?.object !== 'whatsapp_business_account') return

      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue
          const value = change.value || {}

          for (const msg of value.messages || []) {
            if (msg.type !== 'text') continue

            const from    = msg.from        // e.g. "972501234567"
            const text    = msg.text?.body  // customer message
            const msgId   = msg.id

            if (!from || !text) continue

            // Mark message as read
            await markRead(msgId)

            // Send typing indicator (optional — best-effort)
            // await sendTyping(from)

            // Get AI response
            const reply = await getAIResponse(text, from)

            // Send reply
            await sendWAMessage(from, reply)

            console.log(`[WA] Replied to ${from}: ${reply.slice(0, 80)}...`)
          }
        }
      }
    } catch (err) {
      console.error('[WA] Error processing message:', err)
    }

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
