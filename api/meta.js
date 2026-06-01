// Vercel serverless — combined Meta Lead Ads router
// Routes by ?_path= query param (set via vercel.json rewrite from /api/meta/*)
//
//  webhook  → GET verify / POST lead event
//  leads    → GET list all leads
//  messages → GET thread / POST send message
//  sync     → GET historical sync from Meta

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const META_PAGE_ACCESS_TOKEN  = process.env.META_PAGE_ACCESS_TOKEN  || process.env.WA_META_TOKEN || ''
const META_APP_SECRET         = process.env.META_APP_SECRET         || ''
const META_LEADS_VERIFY_TOKEN = process.env.META_LEADS_VERIFY_TOKEN || 'AFIKhanahal2026leads'
const ADMIN_TOKEN             = process.env.ADMIN_TOKEN             || 'AFIKhanahal2026'
const WA_META_TOKEN           = process.env.WA_META_TOKEN           || ''
const PHONE_NUMBER_ID         = process.env.WA_PHONE_NUMBER_ID      || '1160230953835065'
const SUPABASE_URL            = process.env.SUPABASE_URL            || ''
const SUPABASE_KEY            = process.env.SUPABASE_SERVICE_KEY    || ''
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
    res.status(200).json({ status: 'ok' }) // respond immediately

    try {
      if (META_APP_SECRET) {
        const sig      = req.headers['x-hub-signature-256'] || ''
        const expected = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(JSON.stringify(req.body)).digest('hex')
        if (sig !== expected) { console.warn('[MetaLeads] Signature mismatch'); return }
      }

      const body = req.body
      if (body?.object !== 'page') return

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

          const { data: inserted, error: upsertErr } = await client
            .from('meta_leads')
            .upsert({
              leadgen_id, name, email, phone,
              campaign_id: leadData.campaign_id || null, campaign_name: campaignName,
              ad_id: leadData.ad_id || null, form_id: leadData.form_id || null, form_name: formName,
              raw_fields: leadData.field_data || [], page_id: leadData.page_id || page_id || null,
              status: 'new',
            }, { onConflict: 'leadgen_id' })
            .select('id').single()

          if (upsertErr) { console.error('[MetaLeads] upsert:', upsertErr); continue }

          const leadId    = inserted?.id
          const firstName = name.split(' ')[0] || name
          if (phone && WA_META_TOKEN) {
            const src  = campaignName || formName || 'הנכס שלנו'
            const waMsg = `היי ${firstName} 👋\nתודה שמלאת פרטים לגבי ${src}!\nאנחנו מצוות אפיק הנחל 🏠\n\nמתי יהיה נוח לך שנדבר?\nנשמח לתאם שיחה ולספר לך יותר פרטים 📞`
            const waId  = await sendWA(phone, waMsg)
            if (leadId) {
              await client.from('meta_messages').insert({ lead_id: leadId, direction: 'out', message: waMsg, wa_message_id: waId || null })
              await client.from('meta_leads').update({ wa_sent: true }).eq('id', leadId)
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
              `קמפיין: ${campaignName || formName || '—'}`,
              msgText ? `הודעה: ${msgText}` : null,
              `התקבל: ${now}`,
            ].filter(Boolean).join('\n')
            // Send via Green API (fire-and-forget; errors are logged but never block lead saving)
            sendGreenNotify(BUSINESS_NOTIFY_CHATID, notifyLines).catch(e => console.error('[GreenNotify]', e.message))
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
              `📣 קמפיין: ${campaignName || formName || '—'}`,
              `📅 ${now}`,
            ].join('\n')
            await sendWA(META_NOTIFY_PHONE, notifyMsg)
          }
        }
      }
    } catch (err) { console.error('[MetaLeads] unhandled:', err) }
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
  if (!SUPABASE_URL)        return res.status(500).json({ error: 'Supabase not configured' })

  const client   = sb()
  const showDel  = req.query.deleted === '1'  // ?deleted=1 → archived leads only

  let query = client.from('meta_leads').select('*').order('created_at', { ascending: false })
  if (showDel) {
    query = query.not('deleted_at', 'is', null)
  } else {
    query = query.is('deleted_at', null)
  }

  const { data: leads, error } = await query
  if (error) return res.status(500).json({ error: error.message })
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

    const waId = WA_META_TOKEN ? await sendWA(lead.phone, message) : null
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
          const parsed = parseFieldData(lead.field_data)
          await client.from('meta_leads').upsert({
            leadgen_id: lead.id, name: parsed.name || null, email: parsed.email || null,
            phone: normalizePhone(parsed.phone) || null,
            campaign_id: lead.campaign_id || null, ad_id: lead.ad_id || null,
            form_id: form.id, form_name: form.name || null,
            raw_fields: lead.field_data || [], page_id: lead.page_id || pageId, status: 'new',
          }, { onConflict: 'leadgen_id', ignoreDuplicates: true })
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
  if (!checkAuth(req))      return res.status(401).json({ error: 'Unauthorized' })
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

// ── main router ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { cors(res); return res.status(204).end() }
  cors(res)

  const path = (req.query._path || '').replace(/^\/+/, '')

  if (path === 'webhook')      return handleWebhook(req, res)
  if (path === 'leads')        return handleLeads(req, res)
  if (path === 'messages')     return handleMessages(req, res)
  if (path === 'sync')         return handleSync(req, res)
  if (path.startsWith('chat-')) return handleChat(req, res, path)

  return res.status(404).json({ error: `Unknown path: ${path}` })
}
