// Vercel serverless — combined Meta Lead Ads router
// Routes by ?_path= query param (set via vercel.json rewrite from /api/meta/*)
//
//  webhook  → GET verify / POST lead event
//  leads    → GET list all leads
//  messages → GET thread / POST send message
//  sync     → GET historical sync from Meta

import { compressJson, markWait } from '../lib/http.js'
import { GREEN_READ_TTL, greenReadKey } from '../lib/green-read.js'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import * as Auto from '../lib/automations.js'
import { getTemplate } from '../lib/automations-shared.js'
import * as GA4 from '../lib/ga4.js'
import { analyzeLead, buildDossier } from '../lib/lead-analyze.js'
import { summarizeChat } from '../lib/chat-summary.js'
import { processVoice } from '../lib/voice-process.js'
import { transcribeAudio, voiceProvider, vocabHint, MAX_SEGMENT_BYTES } from '../lib/transcribe.js'
import { claudeJson } from '../lib/claude-json.js'
import { researchLead } from '../lib/lead-research.js'
import { mirrorMetaLead, backfillMetaLeads, findMirror } from '../lib/meta-crm.js'
import * as Booking from '../lib/booking-server.js'
import * as GCal from '../lib/google-calendar.js'
import * as Drive from '../lib/google-drive.js'
import { buildLeadEmailHtml, cleanAnswers } from '../lib/lead-email.js'
import { metaFormAnswers, shortCampaign } from '../src/lib/leadFields.js'
import { hebrewFullName } from '../lib/hebrew-names.js'
import { properHebrewName } from '../lib/name-proof.js'
import { hebrewizeRecentNames } from '../lib/hebrew-lead-names.js'
import { parseGreenHook, rowToGreen, mergeHistory, historyToRow } from '../lib/green-hook.js'
import { avatarExpiry, avatarFresh, avatarPhone, socialAvatarFresh, socialKey, avatarKey, profileLinkOf } from '../lib/wa-avatar.js'
import { forwardRequest, fileGroupRequest, cleanMsgId, cleanReaction, isHandled, withHandled, withoutHandled } from '../lib/wa-actions.js'
import { cleanProjects } from '../lib/projects.js'
import { cleanFolders, applyFolderOps, galleryStoragePaths } from '../lib/gallery-folders.js'
import { parseSocialHook, threadId, parseThreadId, previewText, leadBodyFromThread, cleanSocialPages, inboxPageIds, accountLabels, conversationEvents, threadRowFrom, importJobs } from '../lib/social-hook.js'
import { manualLeadRow } from '../lib/manual-lead.js'
import * as Docs from '../lib/documents-server.js'

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
// Green API allows about one call a second per method on the line (measured: a second getChatHistory / getStateInstance /
// lastIncomingMessages within a second answers 429, then we wait 900 ms). Several screens and several people share one
// line, so identical reads are shared: a read already on its way is joined, and its answer is reused for a few seconds
// (GREEN_READ_TTL — reads only, never a send / a setting; an error is never kept). The chats still merge our own table
// (wa_messages, live) over Green's answer, so a reused history is never missing a message the webhook brought.
const greenReads = new Map()   // method + query + body → { at, p }
function greenFetch(url, init = {}) {
  const rk = greenReadKey(url, init)
  if (!rk) return greenFetchRaw(url, init)
  const hit = greenReads.get(rk.key)
  if (hit && (hit.pending || Date.now() - hit.at < GREEN_READ_TTL[rk.method])) return hit.p.then(greenResponse)
  const entry = { at: Date.now(), pending: true }
  entry.p = greenFetchRaw(url, init).then(async r => ({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json' }, body: await r.text() }))
  entry.p.then(c => { entry.pending = false; entry.at = Date.now(); if (c.status !== 200) greenReads.delete(rk.key) }, () => greenReads.delete(rk.key))
  greenReads.set(rk.key, entry)
  if (greenReads.size > 200) greenReads.delete(greenReads.keys().next().value)
  return entry.p.then(greenResponse)
}
// every caller gets its own Response over the shared text (a status that may carry no body gets none)
const greenResponse = c => new Response([101, 204, 205, 304].includes(c.status) ? null : c.body, { status: c.status, headers: c.headers })
// fetch() for Green API: its per-method rate limit answers 429 when the panel asks several things at once — wait, retry
async function greenFetchRaw(url, init = {}, attempt = 0) {
  const r = await globalThis.fetch(url, init)
  if (r.status !== 429 || attempt >= 2 || init.body instanceof FormData) return r
  markWait(900 * (attempt + 1))
  await new Promise(ok => setTimeout(ok, 900 * (attempt + 1)))
  return greenFetchRaw(url, { ...init, signal: AbortSignal.timeout(10000) }, attempt + 1)
}


// ── Email notification ────────────────────────────────────────────────────────

// buildLeadEmailHtml: lib/lead-email.js (shared with the other lead email)

// ── Green API → us: every message of the line as it happens (server/wa-messages-migration.sql, lib/green-hook.js) ──
// Green signs each delivery with the key the database made (app_settings.green_hook_key, sent as webhookUrlToken →
// "Authorization: Bearer <key>"); a delivery is stored in wa_messages and the change bus tells every open chat at once.
let greenHookKey = { v: '', at: 0 }
async function getGreenHookKey(force = false) {
  if (force || !greenHookKey.v || Date.now() - greenHookKey.at > 10 * 60e3) {
    greenHookKey = { v: String((await Auto.getSetting('green_hook_key').catch(() => ({ value: '' }))).value || ''), at: Date.now() }
  }
  return greenHookKey.v
}
async function greenHookKeyValid(key) {
  if (!key || key.length < 32) return false
  let v = await getGreenHookKey()
  if (key !== v) v = await getGreenHookKey(true)
  const a = Buffer.from(key), b = Buffer.from(v || '')
  return !!v && a.length === b.length && crypto.timingSafeEqual(a, b)
}
const GREEN_HOOK_URL = 'https://www.afikhanahal.co.il/api/meta/green-hook'
async function handleGreenHook(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const key = String((req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || req.query?.k || '')
  if (!(await greenHookKeyValid(key))) return res.status(401).json({ error: 'Unauthorized' })
  const ev = parseGreenHook(req.body)
  if (!SUPABASE_URL || !SUPABASE_KEY || (ev.kind !== 'message' && ev.kind !== 'status')) return res.status(200).json({ ok: true, kind: ev.kind })
  // One round trip each (server/wa-fast-path-migration.sql): a message is stored / merged over the row the sender already
  // wrote (afik_wa_put 'hook' — Green's description wins, the status only moves forward, a repeat delivery is a no-op); a
  // status moves forward in one statement (afik_wa_status). The insert announces itself on the change bus at once.
  let stored = false
  try {
    const { error } = ev.kind === 'message'
      ? await sb().rpc('afik_wa_put', { r: ev.row, src: 'hook' })
      : await sb().rpc('afik_wa_status', { mid: ev.id, st: ev.status })
    if (error) console.error('[green-hook] store', error.message)
    else stored = true
  } catch (e) { console.error('[green-hook]', e.message) }
  // Green delivers its webhooks one after another and waits for each answer: the reply goes out as soon as the message is
  // stored, and the slower work (a lead's reply that names a time → Claude reads the chat → a follow-up task) carries on in
  // the background (waitUntil). It used to run before the answer — up to 25 s — and the next message waited behind it (a
  // lead's second message once arrived 124 s late). scanCallbacks (auto-tick) still re-reads the last 3 hours.
  if (stored && ev.kind === 'message' && ev.row.direction === 'in') {
    waitUntil(Auto.onIncomingMessage(ev.row).catch(e => console.error('[green-hook] callback', e.message)))
  }
  return res.status(200).json({ ok: true })
}

// ── Social inbox: Messenger + Instagram DMs of the office's pages (lib/social-hook.js, server/social-migration.sql) ──────
// The Meta webhook brings every message (handleSocialEvents); the admin's "סושיאל" tab lists the conversations, answers them
// (Send API with the page token — Instagram through the page linked to it) and turns a person into a lead in one click.
const SOCIAL_SCOPES = ['pages_messaging', 'instagram_basic', 'instagram_manage_messages', 'pages_manage_metadata']
// Pages in the inbox: the leads' pages (META_PAGE_IDS) + every page switched on in "חשבונות מחוברים" (app_settings
// 'social_pages', [{ id, name, on, ig }]) — Daniel's page, Korkos… any page the System User was given. 60-s cache.
const _sp = { at: 0, list: [] }
async function storedSocialPages(fresh = false) {
  if (!fresh && Date.now() - _sp.at < 60e3) return _sp.list
  _sp.list = cleanSocialPages((await Auto.getSetting('social_pages').catch(() => ({ value: null }))).value || [])
  _sp.at = Date.now()
  return _sp.list
}
async function saveSocialPages(list) { _sp.list = cleanSocialPages(list); _sp.at = Date.now(); await Auto.putSetting('social_pages', _sp.list) }
async function socialPageIds() { return inboxPageIds(resolvePageIds({}), await storedSocialPages()) }

const _igMap = { at: 0, v: {}, accounts: [] }
async function igPageMap() {                 // { <ig business account id>: <page id> } for the inbox pages, 10-min cache
  if (Date.now() - _igMap.at < 10 * 60e3) return _igMap.v
  const v = {}, accounts = []
  await Promise.all((await socialPageIds()).map(async pid => {
    try {
      const tok = await getPageToken(pid)
      const d = await graphGet(`/${pid}?fields=name,instagram_business_account{id,username,name,profile_picture_url}`, tok)
      const ig = d.instagram_business_account
      if (ig?.id) { v[ig.id] = pid; accounts.push({ id: ig.id, username: ig.username || '', name: ig.name || '', pageId: pid, pageName: d.name || '' }) }
    } catch {}
  }))
  Object.assign(_igMap, { at: Date.now(), v, accounts })
  return v
}
async function socialPageToken(platform, accountId) {
  if (platform === 'messenger') return getPageToken(accountId)
  const map = await igPageMap()
  return getPageToken(map[accountId] || (await socialPageIds())[0])
}
async function socialProfile(platform, userId, token) {
  try {
    if (platform === 'messenger') { const d = await graphGet(`/${userId}?fields=first_name,last_name,profile_pic`, token); return { name: [d.first_name, d.last_name].filter(Boolean).join(' '), avatar: d.profile_pic || '' } }
    const d = await graphGet(`/${userId}?fields=name,username,profile_pic`, token); return { name: d.name || '', username: d.username || '', avatar: d.profile_pic || '' }
  } catch { return {} }
}
const cleanGraphErr = e => String(e?.message || e || '').replace(/access_token=[^&\s"]+/g, '').slice(0, 300)

/** Faces from Messenger / Instagram (social_threads.avatar): for numbers WhatsApp has no picture for — the thread of the same
 *  phone, or of the CRM lead with that phone (lead_id) — and for the thread ids asked for. An expired Meta link (and every key in
 *  `refresh`) is re-read from the Graph with the page token (a few per call) and saved back. → Map key → { url, src, link } */
async function socialAvatars({ phones = [], threads = [], refresh = new Set() }) {
  const out = new Map()
  if (!SUPABASE_URL || !SUPABASE_KEY || (!phones.length && !threads.length)) return out
  const client = sb()
  const sel = 'id,platform,account_id,user_id,username,avatar,phone,lead_id,last_at'
  const rows = []
  if (threads.length) { const { data } = await client.from('social_threads').select(sel).in('id', threads); for (const r of data || []) rows.push({ ...r, keys: [r.id] }) }
  if (phones.length) {
    const leads = await leadIdsByPhone()
    const byLead = new Map()                     // lead id → the number asked for
    const tails = phones.map(p => p.slice(-9))
    phones.forEach((p, i) => { const l = leads.get(tails[i]); if (l) byLead.set(l.id, p) })
    const ors = [...tails.map(t => `phone.like.%${t}`), ...(byLead.size ? [`lead_id.in.(${[...byLead.keys()].join(',')})`] : [])]
    const { data } = await client.from('social_threads').select(sel).or(ors.join(',')).order('last_at', { ascending: false }).limit(120)
    const taken = new Set()
    for (const r of data || []) {
      const d = String(r.phone || '').replace(/\D/g, '')
      const p = phones.find(x => d && x.slice(-9) === d.slice(-9)) || byLead.get(String(r.lead_id || ''))
      if (p && !taken.has(p)) { taken.add(p); rows.push({ ...r, keys: [p] }) }
    }
  }
  let budget = 6
  for (const r of rows) {
    const stale = !socialAvatarFresh(r.avatar) || r.keys.some(k => refresh.has(k)) || refresh.has(r.id)
    if (stale && budget > 0) {
      budget--
      const p = await socialProfile(r.platform, r.user_id, await socialPageToken(r.platform, r.account_id))
      if (p.avatar) {
        r.avatar = p.avatar
        if (p.username) r.username = p.username
        await client.from('social_threads').update({ avatar: p.avatar, ...(p.username && !r.username ? { username: p.username } : {}) }).eq('id', r.id).then(() => {}, () => {})
      } else if (!socialAvatarFresh(r.avatar)) r.avatar = ''
    }
    const url = socialAvatarFresh(r.avatar) ? r.avatar : ''
    for (const k of r.keys) if (!out.has(k)) out.set(k, { url, src: r.platform, link: url ? profileLinkOf(r.platform, r) : '' })
  }
  return out
}

/** One conversation's new messages → the thread row + the messages, in 3 queries (the import stores hundreds at a time).
 *  → { stored, isNew, row } */
async function storeThreadBatch(client, { platform, accountId, userId, events, person = {}, quiet }) {
  const id = threadId(platform, accountId, userId)
  const [{ data: have, error: he }, { data: cur, error: ce }] = await Promise.all([
    client.from('social_messages').select('id').eq('thread_id', id).limit(5000),
    client.from('social_threads').select('id,name,username,avatar,phone,email,unread,last_at').eq('id', id).maybeSingle(),
  ])
  if (he || ce) throw new Error((he || ce).message)
  const seen = new Set((have || []).map(r => r.id))
  const fresh = []
  for (const e of events) if (!seen.has(e.mid)) { seen.add(e.mid); fresh.push(e) }
  if (!fresh.length) {
    // nothing new, but an older import may have left the person without a name / picture: fill them in
    if (cur && ((!cur.name && person.name) || (!cur.username && person.username) || !cur.avatar)) {
      const p = cur.avatar ? {} : await socialProfile(platform, userId, await socialPageToken(platform, accountId))
      const fix = { ...(!cur.name && (person.name || p.name) ? { name: person.name || p.name } : {}), ...(!cur.username && (person.username || p.username) ? { username: person.username || p.username } : {}), ...(p.avatar ? { avatar: p.avatar } : {}) }
      if (Object.keys(fix).length) await client.from('social_threads').update(fix).eq('id', id)
    }
    return { stored: 0, isNew: false, row: cur }
  }
  let prof = { name: person.name || '', username: person.username || '' }
  if (!cur?.avatar || (!cur?.name && !cur?.username && !prof.name && !prof.username)) {
    const p = await socialProfile(platform, userId, await socialPageToken(platform, accountId))
    prof = { name: prof.name || p.name || '', username: prof.username || p.username || '', avatar: p.avatar || '' }
  }
  const row = threadRowFrom({ cur, events: fresh, platform, accountId, userId, prof, quiet })
  const { error: te } = await client.from('social_threads').upsert(row, { onConflict: 'id' })
  if (te) throw new Error(te.message)
  const { error: me } = await client.from('social_messages').upsert(fresh.map(e => ({ id: e.mid, thread_id: id, direction: e.direction, body: e.text || null, attachments: e.attachments?.length ? e.attachments : null, ts: e.ts })), { onConflict: 'id', ignoreDuplicates: true })
  if (me) throw new Error(me.message)
  return { stored: fresh.length, isNew: !cur, row: { ...cur, ...row } }
}

/** Webhook deliveries (and our own sends): only the inbox pages; a brand-new conversation alerts the office (WhatsApp). */
async function storeSocialEvents(events, { quiet = false } = {}) {
  if (!events.length || !SUPABASE_URL || !SUPABASE_KEY) return { stored: 0, newThreads: 0 }
  const client = sb()
  const pages = await socialPageIds()
  const ig = await igPageMap()
  const groups = new Map()
  for (const e of events) {
    if (e.platform === 'messenger' && pages.length && !pages.includes(e.accountId)) continue
    if (e.platform === 'instagram' && Object.keys(ig).length && !ig[e.accountId]) continue
    const k = threadId(e.platform, e.accountId, e.userId)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(e)
  }
  let stored = 0, newThreads = 0
  for (const evs of groups.values()) {
    const e0 = evs[0]
    const r = await storeThreadBatch(client, { platform: e0.platform, accountId: e0.accountId, userId: e0.userId, events: evs, quiet })
    stored += r.stored
    if (r.isNew) {
      newThreads++
      const first = evs.find(e => e.direction === 'in')
      if (!quiet && first) {
        const who = r.row?.name || (r.row?.username ? `@${r.row.username}` : 'מישהו')
        const page = accountLabels(await storedSocialPages())[e0.accountId]?.name
        Auto.notifyTeam(`*הודעה חדשה ב${e0.platform === 'instagram' ? 'אינסטגרם' : 'מסנג׳ר'}${page ? ` (${page})` : ''} מ${who}*\n${previewText(first).slice(0, 300)}${r.row?.phone ? `\nטלפון: ${r.row.phone}` : ''}\nלשיחה ולהוספה כליד: https://www.afikhanahal.co.il/admin-panel/social`).catch(() => {})
      }
    }
  }
  return { stored, newThreads }
}

// The pages the inbox imports from, with their Instagram account (names kept in social_pages for the list's labels)
async function inboxPages() {
  const stored = await storedSocialPages()
  const ids = await socialPageIds()
  const map = await igPageMap()
  const igOf = Object.fromEntries(Object.entries(map).map(([igId, pid]) => [pid, igId]))
  return ids.map(id => { const s = stored.find(p => p.id === id) || { id, name: '' }; return { ...s, ig: igOf[id] ? { id: igOf[id], username: s.ig?.username || '' } : null } })
}

/** Import every conversation, in steps (a call has ~60 s): cursor = { j: job index, after: Graph's paging cursor }.
 *  Each step: pages of 25 conversations × their last 100 messages, stored quietly (no alerts, unread kept) until ~40 s,
 *  then → { done, cursor, threads, messages, job: { pageName, platform }, jobs, errors }. The browser calls again with the cursor. */
async function syncSocialStep(cursor = {}) {
  const deadline = Date.now() + 40000
  const client = sb()
  const jobs = importJobs(await inboxPages())
  let j = Math.max(0, Number(cursor.j) || 0), after = String(cursor.after || '')
  const out = { threads: 0, messages: 0, errors: [], jobs: jobs.length }
  const names = Object.fromEntries((await storedSocialPages()).map(p => [p.id, p.name]))
  while (j < jobs.length && Date.now() < deadline) {
    const job = jobs[j]
    out.job = { pageName: names[job.pageId] || job.pageId, platform: job.platform, index: j }
    try {
      const tok = await getPageToken(job.pageId)
      const d = await graphGet(`/${job.pageId}/conversations?platform=${job.platform}&fields=id,updated_time,participants,messages.limit(100){id,message,from,created_time,attachments}&limit=25${after ? `&after=${encodeURIComponent(after)}` : ''}`, tok)
      const convs = (d.data || []).map(c => conversationEvents(c, job)).filter(c => c && c.events.length)
      for (let i = 0; i < convs.length; i += 5) {
        const res = await Promise.all(convs.slice(i, i + 5).map(c => storeThreadBatch(client, { platform: job.platform, accountId: job.accountId, userId: c.person.id, events: c.events, person: c.person, quiet: true }).catch(e => ({ error: e.message }))))
        for (const r of res) { if (r.error) out.errors.push(r.error); else { out.threads++; out.messages += r.stored } }
      }
      after = d.paging?.next && d.paging?.cursors?.after ? d.paging.cursors.after : ''
      if (!after) j++
    } catch (e) { out.errors.push(`${out.job.pageName} · ${job.platform}: ${cleanGraphErr(e)}`); j++; after = '' }
  }
  return { ...out, done: j >= jobs.length, cursor: { j, after } }
}

// ── The office's WhatsApp line in the same inbox ─────────────────────────────────────────────────────────────────────
const _leadPhones = { at: 0, map: new Map() }
async function leadIdsByPhone() {               // last 9 digits → { id, name } of the newest CRM lead with that phone, 2-min cache
  if (Date.now() - _leadPhones.at < 120e3) return _leadPhones.map
  const { data } = await sb().from('contacts').select('id,name,phone').not('phone', 'is', null).order('created_at', { ascending: false }).limit(4000)
  const map = new Map()
  for (const r of data || []) { const k = tail9(r.phone); if (k.length === 9 && !map.has(k)) map.set(k, { id: String(r.id), name: r.name || '' }) }
  Object.assign(_leadPhones, { at: Date.now(), map })
  return map
}
/** Import the WhatsApp history of every chat on the line (Green getChats → getChatHistory 100 each → wa_messages, quietly),
 *  in steps: cursor = { i } over the chats sorted by id. → { done, cursor, total, chats, messages } */
async function waImportStep(cursor = {}) {
  const deadline = Date.now() + 42000
  const r = await greenFetch(greenUrl('getChats'), { signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(r.status === 466 ? 'Green API: חבילת החינם לא מאפשרת לקרוא את כל השיחות (466)' : `Green API getChats: HTTP ${r.status}`)
  const office = String(process.env.BUSINESS_NOTIFY_CHATID || '972559811814').replace(/@.*/, '').replace(/\D/g, '')
  const chats = (await r.json().catch(() => [])).map(c => String(c?.id || '')).filter(id => /^\d{8,15}@c\.us$/.test(id) && !id.startsWith(office)).sort()
  let i = Math.max(0, Number(cursor.i) || 0)
  const out = { total: chats.length, chats: 0, messages: 0, errors: 0 }
  const worker = async () => {
    while (i < chats.length && Date.now() < deadline) {
      const chatId = chats[i++]
      try {
        const h = await greenFetch(greenUrl('getChatHistory'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, count: 100 }), signal: AbortSignal.timeout(15000) })
        if (!h.ok) { out.errors++; continue }
        const data = await h.json().catch(() => [])
        const rows = (Array.isArray(data) ? data : []).map(m => historyToRow(m, chatId.split('@')[0])).filter(Boolean)
        if (rows.length) { const { data: n } = await sb().rpc('afik_wa_backfill', { rows }); out.messages += Number(n) || 0 }
        out.chats++
      } catch { out.errors++ }
    }
  }
  await Promise.all([worker(), worker(), worker()])
  return { ...out, done: i >= chats.length, cursor: { i } }
}

async function handleSocial(req, res, action) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  res.setHeader('Cache-Control', 'no-store')
  const client = SUPABASE_URL && SUPABASE_KEY ? sb() : null
  const missingTables = e => /social_(threads|messages)|relation .* does not exist|schema cache|afik_wa_threads/i.test(String(e?.message || e || ''))
  try {
    if (action === 'social-threads') {
      const [{ data, error }, stored] = await Promise.all([
        client.from('social_threads').select('*').order('last_at', { ascending: false, nullsFirst: false }).limit(1000),
        storedSocialPages(),
      ])
      if (error) return res.status(missingTables(error) ? 200 : 502).json(missingTables(error) ? { threads: [], tablesMissing: true } : { error: error.message })
      // the name in proper Hebrew next to the one Meta gave ("Dana Levi" → "דנה לוי"; an @handle stays)
      return res.status(200).json({ threads: (data || []).map(r => ({ ...r, name_he: r.name ? hebrewFullName(r.name) : '' })), accounts: accountLabels(stored) })
    }
    // GET social-wa → the office line's chats from wa_messages (afik_wa_threads), named (lead, phone book) and linked to the lead
    if (action === 'social-wa') {
      const [{ data, error }, hiddenRow] = await Promise.all([client.rpc('afik_wa_threads', { lim: 600 }), Auto.getSetting('wa_hidden_chats').catch(() => ({ value: null }))])
      if (error) return res.status(missingTables(error) ? 200 : 502).json(missingTables(error) ? { chats: [], fnMissing: true } : { error: error.message })
      const office = String(process.env.BUSINESS_NOTIFY_CHATID || '972559811814').replace(/@.*/, '').replace(/\D/g, '')
      const rows = (data || []).filter(r => r.phone !== office)
      const hidden = hiddenRow?.value || []
      const [names, leads] = await Promise.all([
        chatNames(rows.map(r => ({ phone: r.phone, chatId: `${r.phone}@c.us`, name: '' }))).catch(() => ({ map: new Map() })),
        leadIdsByPhone().catch(() => new Map()),
      ])
      return res.status(200).json({ chats: rows.map(r => {
        const k = tail9(r.phone), n = names.map.get(k), l = leads.get(k)
        const nm = l?.name || n?.name || ''
        return { phone: r.phone, name: nm ? hebrewFullName(nm) : '', waName: n?.waName || '', lead_id: l?.id || null, last_text: r.body || (r.type && r.type !== 'textMessage' ? r.type : ''), last_type: r.type, last_dir: r.direction, last_at: r.ts, msgs: Number(r.msgs) || 0, waiting: Number(r.waiting) || 0, hidden: hidden.includes(r.phone) }
      }), hidden })
    }
    // POST social-wa-lead { phone, name, email, projectId, projectName, leadStatus, note } → a CRM lead from a WhatsApp chat, with
    // the chat's last messages as its first note; a phone that is already a lead answers that lead (existing: true)
    if (action === 'social-wa-lead') {
      const b = req.body || {}
      const p = normalizePhone(b.phone)
      if (!p) return res.status(400).json({ error: 'מספר הטלפון לא תקין' })
      _leadPhones.at = 0
      const had = (await leadIdsByPhone()).get(tail9(p))
      if (had) return res.status(200).json({ ok: true, existing: true, lead: { id: had.id, name: had.name } })
      const r = manualLeadRow({ ...b, phone: p, channel: 'whatsapp', social: null }, await properHebrewName(b.name || ''))
      if (r.error) return res.status(400).json({ error: r.error })
      const { data: msgs } = await client.from('wa_messages').select('direction,body,type,ts').eq('phone', p).order('ts', { ascending: false }).limit(8)
      const said = (msgs || []).reverse().filter(m => m.body && m.type !== 'reactionMessage').map(m => `${m.direction === 'in' ? '←' : '→'} ${m.body}`).join('\n').slice(0, 1200)
      if (said) { const crm = r.row.crm_data; crm.notes = [{ id: `n${Date.now().toString(36)}w`, text: `💬 מה נכתב בוואטסאפ:\n${said}`, ts: Date.now(), kind: 'wa' }, ...(crm.notes || [])] }
      const ins = await client.from('contacts').insert(r.row).select('*').single()
      if (ins.error) return res.status(502).json({ error: ins.error.message })
      _leadPhones.at = 0
      return res.status(201).json({ ok: true, lead: ins.data })
    }
    if (action === 'social-thread') {
      const id = String(req.query.id || '')
      if (!parseThreadId(id)) return res.status(400).json({ error: 'bad id' })
      const [{ data: thread }, { data: msgs }] = await Promise.all([
        client.from('social_threads').select('*').eq('id', id).maybeSingle(),
        client.from('social_messages').select('id,direction,body,attachments,ts').eq('thread_id', id).order('ts', { ascending: false }).limit(500),
      ])
      if (thread?.unread) {
        await client.from('social_threads').update({ unread: 0 }).eq('id', id)
        // Messenger shows the person "seen" like a human agent would (Instagram has no such action)
        const tt = parseThreadId(id)
        if (tt.platform === 'messenger') socialPageToken('messenger', tt.accountId).then(tok => fetch(`https://graph.facebook.com/v20.0/me/messages?access_token=${tok}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient: { id: tt.userId }, sender_action: 'mark_seen' }), signal: AbortSignal.timeout(8000) })).catch(() => {})
      }
      // the unread count the screen draws its "new messages" line with (it is cleared here, so it is sent along)
      const lastIn = (msgs || []).find(m => m.direction === 'in')?.ts || null
      return res.status(200).json({ thread: thread ? { ...thread, unread: 0 } : null, unread: thread?.unread || 0, lastIn, messages: (msgs || []).reverse() })
    }
    if (action === 'social-send') {
      const id = String(req.body?.id || ''), text = String(req.body?.text || '').trim().slice(0, 2000)
      const t = parseThreadId(id)
      if (!t || !text) return res.status(400).json({ error: 'id and text required' })
      const tok = await socialPageToken(t.platform, t.accountId)
      const send = async extra => {
        const r = await fetch(`https://graph.facebook.com/v20.0/me/messages?access_token=${tok}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: { id: t.userId }, message: { text }, ...extra }), signal: AbortSignal.timeout(15000) })
        const d = await r.json().catch(() => ({}))
        return { ok: r.ok && !!d.message_id, d }
      }
      let s = await send({ messaging_type: 'RESPONSE' })
      // more than 24 h since their last message: Meta allows a person's reply for 7 days with the HUMAN_AGENT tag
      if (!s.ok && /24|outside of allowed window|2018278|10\b/.test(JSON.stringify(s.d?.error || {}))) s = await send({ messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' })
      if (!s.ok) {
        const err = s.d?.error || {}
        const txt = JSON.stringify(err)
        const window = /window|2018278|HUMAN_AGENT|human_agent/i.test(txt)
        const approval = /Human Agent.*reviewed|reviewed and approved|\(#10\)/i.test(txt)
        // the person's last message is older than 24 h: Meta lets a page answer only with the HUMAN_AGENT tag, and that tag
        // works only once the app's "Human Agent" feature passed App Review — until then the answer goes from Meta's own inbox
        const msg = approval
          ? 'עברו יותר מ-24 שעות מההודעה האחרונה של הלקוח. Meta מאפשרת לענות מהמערכת רק אחרי אישור "Human Agent" ב-App Review (עוד לא אושר) — בינתיים עונים מ-Meta Business Suite.'
          : window ? 'עברו יותר מ-24 שעות מההודעה האחרונה של הלקוח, ו-Meta לא מאפשרת לשלוח עכשיו. אפשר לענות מ-Meta Business Suite.'
          : (err.message ? `Meta: ${String(err.message).slice(0, 200)}` : 'השליחה נכשלה')
        return res.status(502).json({ error: msg, code: err.code || null, window: window || approval, approval })
      }
      const ts = new Date().toISOString()
      await storeSocialEvents([{ platform: t.platform, accountId: t.accountId, userId: t.userId, direction: 'out', mid: String(s.d.message_id), text, attachments: [], ts }], { quiet: true }).catch(() => {})
      await client.from('social_threads').update({ unread: 0 }).eq('id', id)
      return res.status(200).json({ ok: true, id: s.d.message_id, ts })
    }
    // POST social-react { id, mid, on } → Instagram's ❤️ on a person's message (Meta's API knows only "love"; Messenger has none)
    if (action === 'social-react') {
      const t = parseThreadId(String(req.body?.id || '')), mid = String(req.body?.mid || '').slice(0, 200)
      if (!t || !mid) return res.status(400).json({ error: 'id and mid required' })
      if (t.platform !== 'instagram') return res.status(400).json({ error: 'במסנג׳ר Meta לא מאפשרת לשלוח תגובת אימוג׳י דרך המערכת' })
      const tok = await socialPageToken('instagram', t.accountId)
      const r = await fetch(`https://graph.facebook.com/v20.0/me/messages?access_token=${tok}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: t.userId }, sender_action: req.body?.on === false ? 'unreact' : 'react', payload: { message_id: mid, ...(req.body?.on === false ? {} : { reaction: 'love' }) } }), signal: AbortSignal.timeout(12000) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) return res.status(502).json({ error: d.error?.message ? `Meta: ${String(d.error.message).slice(0, 200)}` : 'התגובה לא נשלחה' })
      return res.status(200).json({ ok: true })
    }
    // POST social-wa-hide { phone, on } → a WhatsApp chat out of the inbox (the history stays; "מוסתרות" shows it, on:false brings it back)
    if (action === 'social-wa-hide') {
      const p = normalizePhone(req.body?.phone)
      if (!p) return res.status(400).json({ error: 'phone required' })
      const cur = (await Auto.getSetting('wa_hidden_chats').catch(() => ({ value: null }))).value || []
      const next = req.body?.on === false ? cur.filter(x => x !== p) : [...new Set([...cur, p])].slice(-500)
      await Auto.putSetting('wa_hidden_chats', next)
      return res.status(200).json({ ok: true, hidden: next })
    }
    // POST social-rename { id, name } → the person's name on a Messenger / Instagram thread (and on its CRM lead, when it has one)
    if (action === 'social-rename') {
      const id = String(req.body?.id || ''), name = String(req.body?.name || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      if (!parseThreadId(id) || !name) return res.status(400).json({ error: 'id and name required' })
      const { data: th, error } = await client.from('social_threads').update({ name }).eq('id', id).select('lead_id').maybeSingle()
      if (error) return res.status(502).json({ error: error.message })
      if (th?.lead_id) {
        const { data: l } = await client.from('contacts').select('id,crm_data').eq('id', th.lead_id).maybeSingle()
        if (l) await client.from('contacts').update({ name, crm_data: { ...(l.crm_data || {}), name } }).eq('id', l.id)
      }
      return res.status(200).json({ ok: true, name, name_he: hebrewFullName(name) })
    }
    // POST social-delete { id } → the conversation out of the inbox for good (its messages with it; the lead, if any, stays)
    if (action === 'social-delete') {
      const id = String(req.body?.id || '')
      if (!parseThreadId(id)) return res.status(400).json({ error: 'bad id' })
      const { error } = await client.from('social_threads').delete().eq('id', id)
      if (error) return res.status(502).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }
    // POST social-unread { id } → back to "unread" (the row is bold again, like WhatsApp's "mark as unread")
    if (action === 'social-unread') {
      const id = String(req.body?.id || '')
      if (!parseThreadId(id)) return res.status(400).json({ error: 'bad id' })
      await client.from('social_threads').update({ unread: 1 }).eq('id', id)
      return res.status(200).json({ ok: true })
    }
    if (action === 'social-to-lead') {
      const b = req.body || {}
      const { data: thread } = await client.from('social_threads').select('*').eq('id', String(b.id || '')).maybeSingle()
      if (!thread) return res.status(404).json({ error: 'השיחה לא נמצאה' })
      const body = leadBodyFromThread(thread, b)
      const r = manualLeadRow(body, await properHebrewName(body.name || ''))
      if (r.error) return res.status(400).json({ error: r.error })
      // the conversation's last messages go into the lead's first note, so the card shows what was said
      const { data: msgs } = await client.from('social_messages').select('direction,body,ts').eq('thread_id', thread.id).order('ts', { ascending: false }).limit(8)
      const said = (msgs || []).reverse().filter(m => m.body).map(m => `${m.direction === 'in' ? '←' : '→'} ${m.body}`).join('\n').slice(0, 1200)
      if (said) {
        const crm = r.row.crm_data
        crm.notes = [{ id: `n${Date.now().toString(36)}s`, text: `💬 מה נכתב ב${thread.platform === 'instagram' ? 'אינסטגרם' : 'מסנג׳ר'}:\n${said}`, ts: Date.now(), kind: 'note' }, ...(crm.notes || [])]
      }
      const ins = await client.from('contacts').insert(r.row).select('*').single()
      if (ins.error) return res.status(502).json({ error: ins.error.message })
      await client.from('social_threads').update({ lead_id: String(ins.data.id), ...(r.row.phone && !thread.phone ? { phone: r.row.phone } : {}) }).eq('id', thread.id)
      _leadPhones.at = 0
      return res.status(201).json({ ok: true, lead: ins.data })
    }
    // POST social-sync { cursor } → one step of importing every conversation of every inbox page (see syncSocialStep)
    if (action === 'social-sync') return res.status(200).json(await syncSocialStep((req.body || {}).cursor || {}))
    // POST wa-import (social-wa-import) { cursor } → one step of importing the WhatsApp line's history
    if (action === 'social-wa-import') return res.status(200).json(await waImportStep((req.body || {}).cursor || {}))
    // POST social-page { id, name, on } → a page in / out of the inbox; in = subscribed to messages (its other fields kept)
    if (action === 'social-page') {
      const b = req.body || {}
      const id = String(b.id || '')
      if (!/^\d{3,25}$/.test(id)) return res.status(400).json({ error: 'bad page id' })
      const list = await storedSocialPages(true)
      const cur = list.find(p => p.id === id)
      const next = cur ? list.map(p => (p.id === id ? { ...p, on: !!b.on, name: b.name || p.name } : p)) : [...list, { id, name: String(b.name || ''), on: !!b.on }]
      let fix = null
      if (b.on) {
        try {
          const tok = await getPageToken(id)
          const subs = await graphGet(`/${id}/subscribed_apps`, tok)
          const fields = [...new Set((subs.data || []).flatMap(a => a.subscribed_fields || []))]
          if (!fields.includes('messages')) {
            const want = [...new Set([...fields, 'messages', 'message_echoes', 'messaging_postbacks'])].join(',')
            const r = await fetch(`https://graph.facebook.com/v20.0/${id}/subscribed_apps?subscribed_fields=${want}&access_token=${tok}`, { method: 'POST', signal: AbortSignal.timeout(15000) })
            fix = r.ok ? 'subscribed' : cleanGraphErr(await r.text())
          }
        } catch (e) { fix = cleanGraphErr(e) }
      }
      await saveSocialPages(next)
      _igMap.at = 0
      return res.status(200).json({ ok: true, pages: next, fix })
    }
    if (action === 'social-status') {
      // what is connected and what is missing: the token's messaging scopes, every page the token reaches (in the inbox or
      // not), each inbox page's webhook fields (messages), its Instagram account; ?fix=1 subscribes the inbox pages to messages
      const out = { pages: [], instagram: [], scopes: [], missing: [], available: [] }
      try {
        const dbg = await graphGet(`/debug_token?input_token=${encodeURIComponent(META_PAGE_ACCESS_TOKEN)}`, META_PAGE_ACCESS_TOKEN)
        out.scopes = dbg.data?.scopes || []
        out.missing = SOCIAL_SCOPES.filter(s => !out.scopes.includes(s))
      } catch (e) { out.tokenError = cleanGraphErr(e) }
      // every page the System User was given (business.facebook.com → System users → Assign assets)
      try {
        const d = await graphGet('/me/accounts?fields=id,name,picture{url},instagram_business_account{id,username}&limit=100', META_PAGE_ACCESS_TOKEN)
        out.available = (d.data || []).map(p => ({ id: String(p.id), name: p.name || '', picture: p.picture?.data?.url || '', ig: p.instagram_business_account ? { id: String(p.instagram_business_account.id), username: p.instagram_business_account.username || '' } : null }))
      } catch (e) { out.availableError = cleanGraphErr(e) }
      const leadsPages = resolvePageIds({})
      _igMap.at = 0
      await igPageMap()
      out.instagram = _igMap.accounts
      const inbox = await socialPageIds()
      for (const pid of inbox) {
        const pc = { id: pid, leads: leadsPages.includes(pid) }
        try {
          const tok = await getPageToken(pid)
          pc.name = (await graphGet(`/${pid}?fields=name`, tok)).name
          const subs = await graphGet(`/${pid}/subscribed_apps`, tok)
          const fields = [...new Set((subs.data || []).flatMap(a => a.subscribed_fields || []))]
          pc.fields = fields
          pc.messages = fields.includes('messages')
          if (req.query.fix && !pc.messages) {
            const want = [...new Set([...fields, ...(pc.leads ? ['leadgen'] : []), 'messages', 'message_echoes', 'messaging_postbacks'])].join(',')
            const r = await fetch(`https://graph.facebook.com/v20.0/${pid}/subscribed_apps?subscribed_fields=${want}&access_token=${tok}`, { method: 'POST', signal: AbortSignal.timeout(15000) })
            pc.fix = r.ok ? 'subscribed' : cleanGraphErr(await r.text())
            if (r.ok) pc.messages = true
          }
        } catch (e) { pc.error = cleanGraphErr(e) }
        out.pages.push(pc)
      }
      // keep the names (and Instagram accounts) for the list's labels; the leads pages are saved as "on"
      const stored = await storedSocialPages(true)
      const known = new Map(stored.map(p => [p.id, p]))
      for (const pc of out.pages) {
        const ig = out.instagram.find(a => a.pageId === pc.id)
        known.set(pc.id, { ...(known.get(pc.id) || { on: true }), id: pc.id, name: pc.name || known.get(pc.id)?.name || '', ig: ig ? { id: ig.id, username: ig.username } : null })
      }
      for (const a of out.available) if (known.has(a.id)) known.set(a.id, { ...known.get(a.id), name: a.name || known.get(a.id).name })
      await saveSocialPages([...known.values()]).catch(() => {})
      out.available = out.available.map(a => ({ ...a, inbox: inbox.includes(a.id), leads: leadsPages.includes(a.id) }))
      if (client) { const { error } = await client.from('social_threads').select('id').limit(1); out.tablesMissing = !!(error && missingTables(error)) }
      out.ok = !out.missing.length && out.pages.length > 0 && out.pages.every(p => p.messages) && !out.tablesMissing
      return res.status(200).json(out)
    }
    return res.status(404).json({ error: 'unknown action' })
  } catch (e) {
    if (missingTables(e)) return res.status(200).json({ tablesMissing: true, threads: [] })
    return res.status(500).json({ error: cleanGraphErr(e) })
  }
}

// ── Projects (deals) the leads belong to (lib/projects.js) — the list lives in app_settings 'lead_projects' ──────────────
// GET → { projects } · POST { projects } → the cleaned list saved (the board sends the whole list; a project is never lost by a
// stale tab: the server merges by id, a missing id stays unless `removed` names it)
// The gallery's own folders (lib/gallery-folders.js): GET → { folders } · POST { ops: [...] } → the ops applied to the stored list.
// A photo no folder holds any more is deleted from Storage — only a gallery upload (property-media/gallery/…), and only when no
// template and no sent WhatsApp message still points at it.
async function handleGalleryFolders(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  res.setHeader('Cache-Control', 'no-store')
  const cur = cleanFolders((await Auto.getSetting('gallery_folders').catch(() => ({ value: null }))).value || [])
  if (req.method === 'GET') return res.status(200).json({ folders: cur })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { folders, removed, errors } = applyFolderOps(cur, (req.body || {}).ops)
  try { await Auto.putSetting('gallery_folders', folders) } catch (e) { return res.status(502).json({ error: e.message }) }
  let deleted = 0
  const ours = removed.filter(u => galleryStoragePaths([u]).length)
  if (ours.length && SUPABASE_URL && SUPABASE_KEY) {
    try {
      const cfg = JSON.stringify(await Auto.loadConfig().catch(() => ({})) || {})
      const { data: used } = await sb().from('wa_messages').select('file_url').in('file_url', ours.slice(0, 200)).limit(400)
      const keep = new Set((used || []).map(r => r.file_url))
      const paths = galleryStoragePaths(ours.filter(u => !keep.has(u) && !cfg.includes(u)))
      if (paths.length) { const { data } = await sb().storage.from('property-media').remove(paths); deleted = (data || []).length }
    } catch (e) { console.warn('[gallery] storage cleanup failed:', e.message) }
  }
  return res.status(200).json({ folders, errors, deleted })
}

async function handleProjects(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  res.setHeader('Cache-Control', 'no-store')
  const cur = cleanProjects((await Auto.getSetting('lead_projects').catch(() => ({ value: null }))).value || [])
  // campaign names already made into projects automatically (lib/projects.js autoProjects) — a project deleted later never returns
  const autoDone = (await Auto.getSetting('lead_projects_auto').catch(() => ({ value: null }))).value || []
  if (req.method === 'GET') return res.status(200).json({ projects: cur, autoDone })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const b = req.body || {}
  const removed = new Set((Array.isArray(b.removed) ? b.removed : []).map(String))
  const incoming = cleanProjects(b.projects)
  const byId = new Map(cur.filter(p => !removed.has(p.id)).map(p => [p.id, p]))
  for (const p of incoming) if (!removed.has(p.id)) byId.set(p.id, p)
  const next = cleanProjects([...incoming.filter(p => byId.has(p.id)), ...[...byId.values()].filter(p => !incoming.some(x => x.id === p.id))])
  try { await Auto.putSetting('lead_projects', next) } catch (e) { return res.status(502).json({ error: e.message }) }
  // a merge: the leads put by hand in a merged-away project move to the one that stays (the board follows on the change bus)
  let moved = 0
  const mg = b.merge && typeof b.merge === 'object' ? b.merge : null
  if (mg && /^p_[a-z0-9]{3,20}$/.test(String(mg.into || '')) && Array.isArray(mg.from) && SUPABASE_URL && SUPABASE_KEY) {
    const into = next.find(p => p.id === mg.into)
    const from = mg.from.map(String).filter(id => /^p_[a-z0-9]{3,20}$/.test(id) && id !== mg.into).slice(0, 20)
    if (into && from.length) {
      const { data: rows } = await sb().from('contacts').select('id,crm_data').in('crm_data->>projectId', from).limit(2000)
      for (const r of rows || []) {
        const { error } = await sb().from('contacts').update({ crm_data: { ...(r.crm_data || {}), projectId: into.id, projectName: into.name } }).eq('id', r.id)
        if (!error) moved++
      }
      // the kept project's leads carry its (maybe new) name too
      const { data: own } = await sb().from('contacts').select('id,crm_data').eq('crm_data->>projectId', into.id).neq('crm_data->>projectName', into.name).limit(2000)
      for (const r of own || []) await sb().from('contacts').update({ crm_data: { ...(r.crm_data || {}), projectName: into.name } }).eq('id', r.id)
    }
  }
  let auto = autoDone
  if (Array.isArray(b.autoDone) && b.autoDone.length) {
    auto = [...new Set([...autoDone, ...b.autoDone.map(x => String(x || '').trim().slice(0, 80)).filter(Boolean)])].slice(-300)
    await Auto.putSetting('lead_projects_auto', auto).catch(() => {})
  }
  return res.status(200).json({ ok: true, projects: next, autoDone: auto, moved })
}

// ── Green API instance settings: the journals that keep the lead's replies ──────────────────────────────────────────
const JOURNAL_FLAGS = ['incomingWebhook', 'outgoingWebhook', 'outgoingMessageWebhook', 'outgoingAPIMessageWebhook']
async function readGreenSettings() {
  const r = await greenFetch(greenUrl('getSettings'), { signal: AbortSignal.timeout(10000) })
  if (!r.ok) throw new Error(`getSettings ${r.status}`)
  return r.json()
}
async function greenSettingsReport({ count = false } = {}) {
  const st = await readGreenSettings()
  const flags = Object.fromEntries(JOURNAL_FLAGS.map(k => [k, st[k] === 'yes']))
  const out = { ok: true, ...flags, stateWebhook: st.stateWebhook === 'yes', hasWebhookUrl: !!st.webhookUrl, webhookOurs: String(st.webhookUrl || '').startsWith(GREEN_HOOK_URL), incomingOff: !flags.incomingWebhook }
  if (count) {
    const [ri, ro] = await Promise.all([
      greenFetch(`${greenUrl('lastIncomingMessages')}?minutes=1440`, { signal: AbortSignal.timeout(20000) }),
      greenFetch(`${greenUrl('lastOutgoingMessages')}?minutes=1440`, { signal: AbortSignal.timeout(20000) }),
    ])
    const n = async r => (r.ok ? ((await r.json().catch(() => [])) || []).length : null)
    out.last24h = { incoming: await n(ri), outgoing: await n(ro) }
  }
  return out
}
async function fixGreenSettings() {
  const body = Object.fromEntries(JOURNAL_FLAGS.map(k => [k, 'yes']))
  // and the deliveries to us, signed with the database's key (only when the key exists — the migration makes it)
  const hookKey = await getGreenHookKey(true)
  if (hookKey) Object.assign(body, { webhookUrl: GREEN_HOOK_URL, webhookUrlToken: hookKey, stateWebhook: 'yes' })
  const r = await greenFetch(greenUrl('setSettings'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) })
  if (!r.ok) return { ok: false, error: `setSettings ${r.status}: ${(await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160)}` }
  settingsCache.at = 0
  return { ok: true }
}
// chat-status asks at most every 10 minutes and turns the incoming journal back on by itself when it finds it off (a plan
// change reset it once — the chats then showed only our side)
const settingsCache = { at: 0, value: null, fixedAt: 0 }
async function greenSettingsCheck() {
  if (Date.now() - settingsCache.at < 10 * 60e3 && settingsCache.value) return settingsCache.value
  let v = await greenSettingsReport()
  if ((v.incomingOff || !v.webhookOurs) && Date.now() - settingsCache.fixedAt > 60 * 60e3) {
    settingsCache.fixedAt = Date.now()
    const fx = await fixGreenSettings().catch(e => ({ ok: false, error: e.message }))
    v = fx.ok ? { ...(await greenSettingsReport().catch(() => v)), autoFixed: true } : { ...v, fixError: fx.error || 'setSettings failed' }
  }
  settingsCache.at = Date.now(); settingsCache.value = v
  return v
}

async function sendMetaLeadEmail({ name, phone, email, campaign, message, ts, fields }) {
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
      // what they asked about (the campaign's short name) and every answer they left in the form
      html:    buildLeadEmailHtml({ name, phone, email, campaign, message, ts: timestamp, badge: 'ליד חדש ממטא',
        interest: shortCampaign(campaign || '') || '', answers: metaFormAnswers(fields || [], 'he').filter(x => !message || x.a !== message) }),
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

// one client per instance (it used to be made again for every call: ~1–3 ms of CPU and a fresh auth helper each time)
let sbClient = null
function sb() {
  return sbClient || (sbClient = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }))
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
        const expected = 'sha256=' + crypto.createHmac('sha256', META_APP_SECRET).update(req.rawBuffer?.length ? req.rawBuffer : (req.rawBody || '')).digest('hex')
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
      // Messenger / Instagram messages of the office's pages → the social inbox (a failure never blocks a lead below)
      const socialEvents = parseSocialHook(body)
      if (socialEvents.length) await storeSocialEvents(socialEvents).catch(e => console.error('[social] store:', cleanGraphErr(e)))
      if (body?.object !== 'page') return res.status(200).json({ status: socialEvents.length ? 'social' : 'ignored', reason: 'not a page event' })

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
          // a Latin name is saved in Hebrew ("Ronen Cohen" → "רונן כהן", "Bechar Eddie" → "אדי בכר"); a name no list knows is
          // proofread by Claude first (lib/name-proof.js, ≤ 8 s); raw_fields keep it as typed
          const name   = await properHebrewName(parsed.name || '')
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
              ...cleanAnswers(metaFormAnswers(leadData.field_data || [], 'he')).filter(x => x.a !== msgText).map(x => `${x.q}: ${x.a}`),
              `התקבל: ${now}`,
            ].filter(Boolean).join('\n')
            // AWAIT both — fire-and-forget here was being killed by Vercel as
            // soon as the response was flushed, so the admin never got pinged.
            await Promise.allSettled([
              sendGreenNotify(BUSINESS_NOTIFY_CHATID, notifyLines),
              sendMetaLeadEmail({ name, phone, email, campaign: campaignName || formName, message: msgText, ts: now, fields: leadData.field_data }),
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
    const { id, status, notes, call_time, deleted_at, wa_sent, name } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id required' })
    const updates = {}
    // a new name (the Lead Center's name editor): the CRM copy and the chats tab's names follow
    const newName = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
    if (typeof name === 'string' && !newName) return res.status(400).json({ error: 'name required' })
    if (newName) updates.name = newName
    // the Lead Center saw our messages in the lead's WhatsApp chat (sent from the chats tab, say): mark it contacted
    if (wa_sent === true) updates.wa_sent = true
    if (status     !== undefined) updates.status     = status
    if (notes      !== undefined) updates.notes      = notes
    if (call_time  !== undefined) updates.call_time  = call_time
    if (deleted_at !== undefined) updates.deleted_at = deleted_at  // null = restore, ISO string = soft-delete
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'nothing to update' })
    const { error } = await sb().from('meta_leads').update(updates).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    let crm = null
    if (newName) {
      nameCache.at = 0                                   // the chats tab reads names from the leads: refresh on the next poll
      const mirror = await findMirror(sb(), id).catch(() => null)
      if (mirror) {
        // the board reads crm_data over the columns, so an older crm_data.name would hide the new one
        const { data: row } = await sb().from('contacts').select('crm_data,name').eq('id', mirror.id).single()
        const cd = row?.crm_data || {}
        const originalName = cd.originalName || (row?.name && row.name !== newName ? row.name : undefined)   // what the lead typed
        const r = await sb().from('contacts').update({ name: newName, crm_data: { ...cd, name: newName, ...(originalName ? { originalName } : {}) } }).eq('id', mirror.id)
        crm = r.error ? { error: r.error.message } : { id: mirror.id }
      }
    }
    // …and the office phone's WhatsApp contacts (lib/wa-book.js)
    let wa = null
    if (newName) {
      const { data: ml } = await sb().from('meta_leads').select('phone').eq('id', id).single()
      if (ml?.phone) wa = await Auto.saveWaContact(ml.phone, newName).catch(e => ({ ok: false, error: e.message }))
    }
    return res.status(200).json({ ok: true, crm, wa })
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
    const { lead_id, message, image, file, fileName, quotedMessageId } = req.body || {}
    if (!lead_id || (!message && !image && !file)) return res.status(400).json({ error: 'lead_id and message required' })

    const { data: lead, error: leadErr } = await client.from('meta_leads').select('id,phone,wa_sent').eq('id', lead_id).single()
    if (leadErr || !lead)  return res.status(404).json({ error: 'Lead not found' })
    if (!lead.phone)       return res.status(400).json({ error: 'Lead has no phone number' })

    // From the office WhatsApp (Green API) — the same number as the welcome message, so the lead sees one conversation
    const sent = await Auto.sendText(lead.phone, String(message || '').slice(0, 4000), { image, file, fileName, quotedMessageId })
    if (!sent.ok) return res.status(502).json({ error: sent.error || 'send failed', quota: !!sent.quota })
    // a person wrote to this lead: the automations send it nothing more (manualContact in lib/automations-shared.js)
    waitUntil(Auto.markManual(lead.phone).catch(() => {}))
    const { data: newMsg, error: insertErr } = await client.from('meta_messages')
      .insert({ lead_id: lead.id, direction: 'out', message: [file ? `📎 ${String(fileName || 'קובץ').slice(0, 120)}` : '', message].filter(Boolean).join('\n') || '📷', wa_message_id: sent.idMessage || null })
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
            leadgen_id: lead.id, name: hebrewFullName(parsed.name || '') || null, email: parsed.email || null,
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
          // a new lead's name that no list knows: proofread once (the welcome below reads the saved name)
          let properName = hebrewFullName(parsed.name || '')
          if (isNew) {
            const proofed = await properHebrewName(parsed.name || '')
            if (proofed && proofed !== properName) { properName = proofed; await client.from('meta_leads').update({ name: proofed }).eq('leadgen_id', lead.id) }
          }

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
            const adminMsg = ['🔔 ליד חדש (sync)', `שם: ${properName || '—'}`, `טלפון: ${displayPhone}`,
              parsed.email ? `אימייל: ${parsed.email}` : null,
              `קמפיין: ${campaignName || form.name || '—'}`,
              ...cleanAnswers(metaFormAnswers(lead.field_data || [], 'he')).map(x => `${x.q}: ${x.a}`),
              `התקבל: ${now}`].filter(Boolean).join('\n')

            // AWAIT all three sends so the function isn't killed before they hit
            // the wire. Per-call timeouts inside sendGreenNotify keep total bounded.
            const { data: saved } = await client.from('meta_leads').select('id').eq('leadgen_id', lead.id).maybeSingle()
            const rs = await Promise.allSettled([
              welcomeMetaLead(client, { id: saved?.id, name: parsed.name || '', phone, campaign: campaignName || form.name }),
              sendGreenNotify(BUSINESS_NOTIFY_CHATID, adminMsg),
              sendMetaLeadEmail({ name: properName || parsed.name, phone, email: parsed.email, campaign: campaignName || form.name, ts: now, fields: lead.field_data }),
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
  const { id, text, templateId, image } = req.body || {}
  if (!id) return res.status(400).json({ error: 'id required' })
  if (text != null && (typeof text !== 'string' || !text.trim() || text.length > 4000)) return res.status(400).json({ error: 'invalid text' })
  const client = sb()
  const { data: lead } = await client.from('meta_leads').select('id,name,phone,campaign_name,form_name').eq('id', id).maybeSingle()
  if (!lead) return res.status(404).json({ error: 'lead not found' })
  if (!lead.phone) return res.status(400).json({ error: 'no phone' })
  // The button means "send it now", whatever the automatic rule's mode
  const r = await Auto.welcomeExternalLead({ id: lead.id, name: lead.name || '', phone: lead.phone, source: 'meta', campaignName: lead.campaign_name || lead.form_name || '' }, { source: 'meta', force: true, text: text || '', templateId: typeof templateId === 'string' ? templateId : '', ...(typeof image === 'string' ? { image } : {}) })
  if (r.ok) {
    waitUntil(Auto.markManual(lead.phone).catch(() => {}))
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
// the database scheduler's key (app_settings.remind_key); re-read at most once a minute, so a wrong key can't make us read it
let remindKey = { v: '', at: 0 }
async function remindKeyValid(key) {
  if (!key || key.length < 32) return false
  if (key !== remindKey.v && Date.now() - remindKey.at > 60e3) {
    remindKey = { v: String((await Auto.getSetting('remind_key').catch(() => ({ value: '' }))).value || ''), at: Date.now() }
  }
  if (!remindKey.v || key.length !== remindKey.v.length) return false
  return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(remindKey.v))
}
async function handleAutomations(req, res, action) {
  if (action === 'auto-tick') {
    const key = req.query?.key || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '')
    if (!Auto.tickKeyValid(key)) return res.status(401).json({ error: 'Unauthorized' })
    // ?catchup=<minutes> (≤ 1440): after an outage, first bring every message of that window into wa_messages (written on the
    // office phone too), so the run below sees who was already contacted by hand (manualContact) — the default covers 3 hours
    const catchupMin = Math.min(1440, Math.max(0, parseInt(req.query?.catchup, 10) || 0))
    const caught = catchupMin > 180 ? await Auto.catchUpMessages({ minutes: catchupMin }).catch(e => ({ error: e.message })) : null
    const [r, meta] = await Promise.all([
      Auto.run({ source: 'external' }).catch(e => ({ ok: false, error: e.message, sent: [], errors: [], suggestions: [], jobs: {} })),
      syncRecentMetaLeads({ hours: 6 }).catch(e => ({ error: e.message })),   // safety net for the Meta webhook
      Booking.retryConfirmations({ client: SUPABASE_URL && SUPABASE_KEY ? sb() : null }).catch(() => null),  // calendar sync + confirmations Green API refused
      hebrewizeRecentNames(SUPABASE_URL && SUPABASE_KEY ? sb() : null).catch(() => null),   // any recent lead still named in Latin → Hebrew
      Auto.syncBookNames().catch(() => null),            // a name changed in the phone's WhatsApp contacts → the lead's name
      Auto.catchUpMessages().catch(() => null).then(() => Promise.all([Auto.scanCallbacks().catch(() => null), Auto.assignProjectsFromChats({ auto: true }).catch(() => null)])),   // missed webhook rows → wa_messages; then times the leads asked for → tasks, and the project each new conversation is about
      Docs.ready() ? Docs.sweepExpired().catch(() => 0).then(() => Docs.remindUnsigned().catch(() => null)).then(() => Docs.driveTick().catch(() => null)) : null,   // documents: expired links, reminders to signers, the Drive queue
    ])
    return res.status(200).json({ ok: r.ok !== false, at: r.at, sent: r.sent?.length || 0, errors: r.errors?.length || 0, queued: r.suggestions?.length || 0, jobs: r.jobs, notes: r.notes, meta, ...(caught ? { catchup: { minutes: catchupMin, checked: caught.checked, added: caught.added, error: caught.error } } : {}) })
  }
  // Follow-up reminders are not polled: the database's own scheduler (pg_cron, every minute, inside Postgres — no transfer)
  // counts the due ones (public.afik_due_reminders()) and calls this only when there is one, with the key it keeps in
  // app_settings.remind_key (made in the database, never in the code). server/sync-bus-migration.sql.
  if (action === 'auto-remind') {
    const key = String(req.body?.key || req.query?.key || '')
    if (!(await remindKeyValid(key))) return res.status(401).json({ error: 'Unauthorized' })
    const r = await Auto.remindTasks().catch(e => ({ error: e.message }))
    return res.status(200).json({ ok: !r.error, due: r.due || 0, sent: r.sent || 0, failed: r.failed || 0 })
  }
  // Paced bulk sends: the database's scheduler (pg_cron, every minute) calls this only while a job is due
  // (public.afik_due_jobs(), server/bulk-pace-migration.sql), with the same database-made key as auto-remind
  if (action === 'auto-jobs-tick' && (req.body?.key || req.query?.key) && !checkAuth(req)) {
    if (!(await remindKeyValid(String(req.body?.key || req.query?.key)))) return res.status(401).json({ error: 'Unauthorized' })
    const r = await Auto.jobsTick().catch(e => ({ error: e.message }))
    return res.status(200).json({ ok: !r.error, busy: !!r.busy, sent: r.jobs?.sent || 0, failed: r.jobs?.failed || 0 })
  }
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  res.setHeader('Cache-Control', 'no-store')
  const b = req.body || {}
  try {
    // POST /api/meta/auto-project-chat { dry, full, max } → which CRM leads' conversations point at a project (lib/project-chat.js);
    // dry = only count, full = the last 90 days again. The probe's `project-chat` action prints counts only.
    if (action === 'auto-project-chat') {
      const r = await Auto.assignProjectsFromChats({ dry: !!b.dry, full: !!b.full, max: Math.min(400, Math.max(1, Number(b.max) || 40)), budgetMs: 40000 })
      return res.status(200).json(r)
    }
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
      if (Docs.ready()) Docs.sweepExpired().catch(() => 0).then(() => Docs.remindUnsigned().catch(() => null)).then(() => Docs.driveTick({ max: 2 }).catch(() => null)).catch(() => null)   // documents: reminders + Drive, best-effort
      const [r, meta] = await Promise.all([Auto.run({ source: 'panel' }), syncRecentMetaLeads({ hours: 6 }).catch(e => ({ error: e.message })), Auto.syncBookNames().catch(() => null), Auto.catchUpMessages().catch(() => null).then(() => Promise.all([Auto.scanCallbacks().catch(() => null), Auto.assignProjectsFromChats({ auto: true }).catch(() => null)])), Booking.retryConfirmations({ client: SUPABASE_URL && SUPABASE_KEY ? sb() : null }).catch(() => null), hebrewizeRecentNames(SUPABASE_URL && SUPABASE_KEY ? sb() : null).catch(() => null)])
      return res.status(200).json({ ...r, meta })
    }
    if (action === 'auto-send')   return res.status(200).json({ results: await Auto.sendItems(Array.isArray(b.items) ? b.items : [], { by: 'manual' }) })
    if (action === 'auto-skip')   return res.status(200).json({ ok: await Auto.skipItem(b.leadId, String(b.ruleKey || '')) })
    if (action === 'auto-optout') return res.status(200).json({ ok: await Auto.setOptOut(b.leadId, !!b.optOut) })
    if (action === 'auto-test') {
      const r = await Auto.sendTest(String(b.text || 'הודעת בדיקה ממערכת האוטומציות של אפיק הנחל ✅'), b.phone, typeof b.image === 'string' ? b.image : '')
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
const nameCache = { at: 0, book: new Map(), leads: new Map(), self: '', info: new Map(), asking: false }
const tail9 = p => String(p || '').replace(/\D/g, '').slice(-9)

async function chatNames(list) {
  const now = Date.now()
  if (now - nameCache.at > NAME_TTL) {
    const book = new Map(), leads = new Map()
    const [rc, rs, dbC, dbM] = await Promise.all([
      greenFetch(greenUrl('getContacts'), { signal: AbortSignal.timeout(12000) }).then(r => (r.ok ? r.json() : [])).catch(() => []),
      greenFetch(greenUrl('getWaSettings'), { signal: AbortSignal.timeout(8000) }).then(r => (r.ok ? r.json() : {})).catch(() => ({})),
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
  // Last resort: getContactInfo for the newest still-unnamed chats. Green answers about one a second, so they are asked one
  // after another in the background (waitUntil) and the list never waits for them — a name found shows on the next read.
  // (They used to go out 6 at once inside the request: most answered 429, cost a 900 ms back-off each, and a 429 was then
  // kept as "no name", so that chat was never asked again.)
  const missing = list.filter(c => !map.has(tail9(c.phone)) && !nameCache.info.has(tail9(c.phone))).slice(0, 4)
  if (missing.length && !nameCache.asking) {
    nameCache.asking = true
    waitUntil((async () => {
      try {
        for (const [i, c] of missing.entries()) {
          if (i) await new Promise(ok => setTimeout(ok, 1100))
          const k = tail9(c.phone)
          try {
            const r = await greenFetch(greenUrl('getContactInfo'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: c.chatId }), signal: AbortSignal.timeout(6000) })
            if (!r.ok) continue                              // a refusal (429) is not "no name": asked again later
            const d = await r.json().catch(() => ({}))
            nameCache.info.set(k, String(d.contactName || d.name || '').trim())   // a real miss is kept, never re-asked
          } catch { /* asked again on a later read */ }
        }
      } finally { nameCache.asking = false }
    })())
  }
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
      const [r, quota, settings] = await Promise.all([greenFetch(greenUrl('getStateInstance'), { signal: AbortSignal.timeout(8000) }), Auto.greenQuota().catch(() => null), greenSettingsCheck().catch(() => null)])
      const d = await r.json().catch(() => ({}))
      return res.status(r.ok ? 200 : 502).json({ state: d.stateInstance || (r.ok ? null : 'error'), instance: GREEN_INSTANCE, http: r.status, quota: quota?.blocked ? { blocked: true, since: quota.since || quota.at, at: quota.at, used: quota.used, description: quota.description } : null, settings })
    }

    // GET /api/meta/chat-settings → the instance's settings that decide whether the lead's replies are kept: Green saves
    // incoming messages (getChatHistory / lastIncomingMessages) only while incomingWebhook = 'yes' — a plan change can reset
    // it, and then a chat shows only our own messages. POST { fix: true } turns the journals on (setSettings). Only yes / no
    // flags and counts come back, never the webhook URL or a token.
    if (action === 'chat-settings') {
      if (req.method === 'POST' && (req.body || {}).fix) {
        const fx = await fixGreenSettings()
        if (!fx.ok) return res.status(502).json(fx)
      }
      return res.status(200).json(await greenSettingsReport({ count: true }))
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
    // POST /api/meta/chat-avatars { phones: [...], social: [thread ids], refresh: [keys] } → { avatars: { key: url | '' }, from:
    // { key: whatsapp | messenger | instagram }, links: { key: profile url } } — the profile picture of every face on screen: the
    // WhatsApp one (Green getAvatar, cached in wa_avatars until WhatsApp's link expires), else the Messenger / Instagram one of
    // the same person (socialAvatars: the thread with that phone or that CRM lead; a thread id asked for directly). A number
    // Green didn't answer for in time is left out (the browser asks again later). Up to 40 numbers, 3 at a time.
    if (action === 'chat-avatars') {
      const b = req.body || {}
      const list = [...new Set((b.phones || []).map(avatarPhone).filter(Boolean))].slice(0, 40)
      const social = [...new Set((b.social || []).map(socialKey).filter(Boolean))].slice(0, 40)
      const refresh = new Set((b.refresh || []).map(avatarKey).filter(Boolean))
      if (!list.length && !social.length) return res.status(200).json({ avatars: {}, from: {}, links: {} })
      const now = Date.now()
      const have = new Map()
      if (SUPABASE_URL && SUPABASE_KEY) {
        const { data } = await sb().from('wa_avatars').select('phone,url,available,expires_at,checked_at').in('phone', list)
        for (const r of data || []) have.set(r.phone, r)
      }
      const need = list.filter(p => refresh.has(p) || !avatarFresh(have.get(p), now))
      const fresh = [], deadline = now + 18000
      let i = 0
      const worker = async () => {
        while (i < need.length && Date.now() < deadline) {
          const p = need[i++]
          try {
            const r = await greenFetch(greenUrl('getAvatar'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: `${p}@c.us` }), signal: AbortSignal.timeout(8000) })
            if (!r.ok) continue
            const d = await r.json().catch(() => null)
            if (!d) continue
            const url = d.available !== false && /^https:\/\//.test(d.urlAvatar || '') ? d.urlAvatar : null
            const row = { phone: p, url, available: !!url, expires_at: url ? new Date(avatarExpiry(url)).toISOString() : null, checked_at: new Date().toISOString() }
            have.set(p, row); fresh.push(row)
          } catch { /* asked again on the next screen */ }
        }
      }
      await Promise.all([worker(), worker(), worker()])
      if (fresh.length && SUPABASE_URL && SUPABASE_KEY) await sb().from('wa_avatars').upsert(fresh, { onConflict: 'phone' }).then(() => {}, () => {})
      const avatars = {}, from = {}, links = {}
      for (const p of list) { const r = have.get(p); if (r && (avatarFresh(r) || fresh.includes(r))) { avatars[p] = r.url || ''; if (r.url) from[p] = 'whatsapp' } }
      // no WhatsApp picture → the person's Messenger / Instagram one; the threads asked for by id
      const noPic = list.filter(p => p in avatars && !avatars[p])
      try {
        const faces = await socialAvatars({ phones: noPic, threads: social, refresh })
        for (const [k, v] of faces) { avatars[k] = v.url; if (v.url) { from[k] = v.src; if (v.link) links[k] = v.link } }
      } catch (e) { console.error('[chat-avatars] social', cleanGraphErr(e)) }
      for (const k of social) if (!(k in avatars)) avatars[k] = ''
      return res.status(200).json({ avatars, from, links })
    }

    if (action === 'chat-read') {
      const p = normalizePhone((req.body || {}).phone)
      if (!p) return res.status(400).json({ error: 'phone required' })
      const r = await greenFetch(greenUrl('readChat'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: `${p}@c.us` }), signal: AbortSignal.timeout(10000) })
      return res.status(r.ok ? 200 : 502).json(r.ok ? { ok: true } : await greenError(r, 'readChat'))
    }

    // GET /api/meta/chat-waiting → every chat whose last word is the lead's (public.afik_wa_waiting(), server/wa-waiting-migration.sql):
    // [{ phone, ts, type, text }], newest first, the office's own number left out. The admin keeps it fresh from the live feed.
    if (action === 'chat-waiting') {
      if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json({ waiting: [] })
      const days = Math.min(60, Math.max(1, Number(req.query?.days) || 14))
      const [{ data, error }, doneRow] = await Promise.all([sb().rpc('afik_wa_waiting', { days }), Auto.getSetting('wa_waiting_done').catch(() => ({ value: null }))])
      if (error) return res.status(502).json({ error: error.message })
      const office = String(process.env.BUSINESS_NOTIFY_CHATID || '972559811814').replace(/@.*/, '').replace(/\D/g, '')
      // chats marked "handled" leave the list until the lead writes again (lib/wa-actions.js)
      const done = doneRow?.value || {}
      return res.status(200).json({ done, waiting: (data || []).filter(r => r.phone !== office && !isHandled(done, r.phone, r.ts)).map(r => ({ phone: r.phone, ts: r.ts, type: r.type, text: r.body || '' })) })
    }
    // POST /api/meta/chat-waiting-done { items: [{ phone, ts }] } → off "ממתינים לתשובה" (ts = the lead's last message);
    // { undo: [phones] } → back on. → { ok, done }
    if (action === 'chat-waiting-done') {
      const b = req.body || {}
      const cur = (await Auto.getSetting('wa_waiting_done')).value || {}
      const next = Array.isArray(b.undo) ? withoutHandled(cur, b.undo) : withHandled(cur, b.items)
      await Auto.putSetting('wa_waiting_done', next)
      return res.status(200).json({ ok: true, done: next })
    }

    // GET /api/meta/chat-updates?since=<ISO> → the messages and delivery statuses that reached us since the cursor (the
    // change bus says when; src/lib/waLive.js asks). Each item = Green's history shape + phone; cursor = the newest updated_at.
    if (action === 'chat-updates') {
      if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(200).json({ messages: [], cursor: null })
      const since = Date.parse(String(req.query?.since || '')) ? new Date(String(req.query.since)).toISOString() : new Date(Date.now() - 10 * 60e3).toISOString()
      const lim = Math.min(600, Math.max(1, Number(req.query?.limit) || 300))
      const { data, error } = await sb().from('wa_messages').select('id,phone,direction,type,body,file_url,file_name,mime,quoted,status,sender_name,ts,updated_at').gt('updated_at', since).order('updated_at', { ascending: true }).limit(lim)
      if (error) return res.status(502).json({ error: error.message })
      const rows = data || []
      return res.status(200).json({ messages: rows.map(r => ({ ...slimGreenMsg(rowToGreen(r)), phone: r.phone, senderName: r.sender_name || undefined })), cursor: rows.length ? rows[rows.length - 1].updated_at : since })
    }

    // POST /api/meta/chat-history { phone, count, stored? } → the chat in Green's history shape. stored:true = only what our
    // own table holds (~0.1 s — the chat paints at once, like WhatsApp); without it Green's getChatHistory (~4 s) is merged
    // in, and whatever our table missed is saved quietly (afik_wa_backfill), so the next open of this chat is complete.
    if (action === 'chat-history') {
      const { phone, count = 100, stored: storedOnly } = req.body || {}
      const p = normalizePhone(phone)
      if (!p) return res.status(400).json({ error: 'phone required' })
      const lim = Math.min(Number(count) || 100, 200)
      const readStored = () => (SUPABASE_URL && SUPABASE_KEY
        ? sb().from('wa_messages').select('id,phone,direction,type,body,file_url,file_name,mime,quoted,status,ts').eq('phone', p).order('ts', { ascending: false }).limit(lim)
        : Promise.resolve({ data: [] }))
      if (storedOnly) {
        const { data: rows, error } = await readStored()
        if (error) return res.status(502).json({ error: error.message })
        return res.status(200).json(mergeHistory([], rows || []).reverse().map(slimGreenMsg))
      }
      const storedP = Promise.resolve(readStored())   // starts now, side by side with Green
      const r = await greenFetch(greenUrl('getChatHistory'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${p}@c.us`, count: Math.min(Number(count) || 100, 200) }),
        signal: AbortSignal.timeout(20000),
      })
      if (!r.ok) return res.status(502).json(await greenError(r, 'getChatHistory'))
      const data = await r.json().catch(() => [])
      // + what Green delivered to us (wa_messages): a reply Green's history misses still shows, and the furthest status wins
      const { data: stored } = await storedP
      if (SUPABASE_URL && SUPABASE_KEY && Array.isArray(data) && data.length) {
        const have = new Set((stored || []).map(x => x.id))
        const missing = data.filter(m => m?.idMessage && !have.has(String(m.idMessage))).map(m => historyToRow(m, p)).filter(Boolean)
        if (missing.length) await sb().rpc('afik_wa_backfill', { rows: missing }).then(() => {}, () => {})
      }
      // Only the fields the chat shows (src/GreenAPIChat.jsx normalizeGreenMsg): Green's raw messages carry a lot more,
      // and this answer is polled (Vercel meters every byte a function sends). A 304 when nothing changed.
      const merged = mergeHistory(Array.isArray(data) ? [...data].reverse() : [], stored || []).reverse()
      return res.status(200).json(merged.map(slimGreenMsg))
    }

    // POST /api/meta/chat-send { phone, message, image? } → sendMessage (or sendFileByUrl: a template's picture + caption)
    if (action === 'chat-send') {
      const { phone, message, image, file, fileName, quotedMessageId } = req.body || {}
      const p = normalizePhone(phone)
      if (!p || (!message && !image && !file)) return res.status(400).json({ error: 'phone and message required' })
      // The engine's sender: retries a 429, remembers a blocked plan (466) for the panels, clears it on success;
      // file + fileName = a file attached in the chat (uploaded to storage by the browser, src/lib/chatFiles.js);
      // quotedMessageId = a reply to that message (WhatsApp shows the quote above the text)
      const r = await Auto.sendText(p, message || '', { image, file, fileName, quotedMessageId })
      if (!r.ok) return res.status(502).json({ error: r.error, quota: !!r.quota })
      waitUntil(Auto.markManual(p).catch(() => {}))
      return res.status(200).json({ ok: true, idMessage: r.idMessage || null })
    }

    // POST /api/meta/chat-send-files { phone, caption, items: [{ file, fileName }], quotedMessageId? } → the files one after
    // another (already in storage — the browser uploaded them all first), so WhatsApp shows the photos as one album; the text
    // is the first file's caption. Stops at the first failure / a quota refusal; near the time limit it answers `partial` with
    // how many went, and the browser sends the rest (src/lib/chatFiles.js sendGroupRequest) → { ok, sent, total, partial? }
    if (action === 'chat-send-files') {
      const g = fileGroupRequest(req.body || {}, normalizePhone)
      if (g.error) return res.status(400).json({ error: g.error })
      const started = Date.now()
      let sent = 0
      for (const [i, it] of g.items.entries()) {
        if (i && Date.now() - started > 45000) return res.status(200).json({ ok: false, partial: true, sent, total: g.items.length })
        const r = await Auto.sendText(g.phone, i === 0 ? g.caption : '', { file: it.file, fileName: it.fileName, ...(i === 0 && g.quotedMessageId ? { quotedMessageId: g.quotedMessageId } : {}) })
        if (!r.ok) return res.status(502).json({ ok: false, sent, total: g.items.length, error: r.error, quota: !!r.quota })
        sent++
      }
      waitUntil(Auto.markManual(g.phone).catch(() => {}))
      return res.status(200).json({ ok: true, sent, total: g.items.length })
    }

    // POST /api/meta/chat-contact-name { phone, name } → the name in the office phone's WhatsApp contacts (a chat that isn't a
    // lead; a lead's rename goes through PATCH /api/contacts, which does the same) — the answer says what WhatsApp holds now
    // ({ saved, synced }); GET ?phone= only reads it, so the UI can verify a rename made by any path.
    if (action === 'chat-contact-name') {
      if (req.method === 'GET') return res.status(200).json(await Auto.readWaContact(normalizePhone(req.query?.phone)))
      const { phone, name } = req.body || {}
      const r = await Auto.saveWaContact(normalizePhone(phone), String(name || ''))
      if (r.ok) nameCache.at = 0
      return res.status(r.ok ? 200 : 502).json(r)
    }
    // POST /api/meta/chat-book-sync → read the phone's contacts now (names changed on the phone rename the leads)
    if (action === 'chat-book-sync') return res.status(200).json(await Auto.syncBookNames().catch(e => ({ error: e.message })))

    // POST /api/meta/chat-forward { from, to: [phones], ids: [idMessage] } → Green forwardMessages, one call per chat (a
    // short gap between them, stops at a quota refusal) → { ok, results: [{ phone, ok, error? }] }
    if (action === 'chat-forward') {
      const fr = forwardRequest(req.body || {}, normalizePhone)
      if (fr.error) return res.status(400).json({ error: fr.error })
      const results = []
      for (const [i, to] of fr.to.entries()) {
        if (i) await new Promise(ok => setTimeout(ok, 700))
        try {
          const r = await greenFetch(greenUrl('forwardMessages'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: `${to}@c.us`, chatIdFrom: `${fr.from}@c.us`, messages: fr.ids }), signal: AbortSignal.timeout(15000) })
          const t = await r.text()
          if (r.ok) { results.push({ phone: to, ok: true }); continue }
          const quota = r.status === 466
          results.push({ phone: to, ok: false, quota, error: quota ? 'המכסה החודשית של Green API נגמרה' : `Green API ${r.status}: ${t.slice(0, 140)}` })
          if (quota) break
        } catch (e) { results.push({ phone: to, ok: false, error: e.name === 'TimeoutError' ? 'Green API לא ענה בזמן' : e.message }) }
      }
      const sent = results.filter(x => x.ok).length
      return res.status(sent ? 200 : 502).json({ ok: sent === fr.to.length, sent, total: fr.to.length, results, quota: results.some(x => x.quota) })
    }

    // POST /api/meta/chat-react { phone, id, reaction } → Green sendReaction (an empty reaction takes ours back)
    if (action === 'chat-react') {
      const { phone, id, reaction } = req.body || {}
      const p = normalizePhone(phone), mid = cleanMsgId(id), emo = cleanReaction(reaction)
      if (!p || !mid || emo === null) return res.status(400).json({ error: 'phone, id and one emoji required' })
      const r = await greenFetch(greenUrl('sendReaction'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${p}@c.us`, idMessage: mid, reaction: emo }), signal: AbortSignal.timeout(15000) }).catch(e => ({ ok: false, status: 0, text: async () => e.message }))
      const t = await r.text().catch(() => '')
      if (!r.ok) return res.status(502).json({ error: r.status === 466 ? 'המכסה החודשית של Green API נגמרה' : `Green API ${r.status || ''}: ${String(t).slice(0, 140)}`, quota: r.status === 466 })
      let d = {}; try { d = JSON.parse(t) } catch {}
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

// The admin's mic (src/SmartVoiceInput.jsx, src/lib/voiceService.js) — nothing is stored, the audio goes straight to the provider:
//   GET  voice-status → { provider: 'openai' | 'elevenlabs' | '', ai } — is server transcription set up (else the browser hears)
//   POST voice-transcribe?mime=&lang=&hint=  (body: the raw audio of one ≤ 4 MB segment) → { text } (lib/transcribe.js)
//   POST voice-process { transcript, mode: exact|smart|call|task, contextType, lang, hint } → { text, summary, tasks, review }
//        (lib/voice-process.js); dictation-polish (the first version's call) = exact mode
async function readRaw(req, limit) {   // the handler already read the bytes (bodyParser is off)
  const buf = req.rawBuffer || Buffer.alloc(0)
  if (buf.length > limit) throw Object.assign(new Error('too large'), { code: 'too_large' })
  return buf
}
async function handleVoice(req, res, path) {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (path === 'voice-status') return res.status(200).json({ provider: voiceProvider(), ai: !!String(process.env.ANTHROPIC_API_KEY || '').trim() })
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    if (path === 'voice-transcribe') {
      let buf
      try { buf = await readRaw(req, MAX_SEGMENT_BYTES + 1024) } catch (e) { return res.status(413).json({ error: 'audio segment too large', code: 'too_large' }) }
      const q = req.query || {}
      const r = await transcribeAudio(buf, { mime: q.mime, lang: q.lang, hint: vocabHint(String(q.hint || '').split(',').slice(0, 12)) })
      const status = !r.error ? 200 : r.code === 'no_provider' ? 501 : r.code === 'too_large' ? 413 : r.code === 'format' || r.code === 'empty' ? 400 : 502
      return res.status(status).json(r)
    }
    const b = req.body || {}
    const legacy = path === 'dictation-polish'
    const r = await processVoice({ transcript: legacy ? b.text : b.transcript, mode: legacy ? (b.kind === 'task' ? 'task' : 'exact') : b.mode, contextType: b.contextType || b.kind, lang: b.lang, hint: b.hint }, { ask: claudeJson })
    return res.status(r.error ? (r.code === 'empty' ? 400 : 502) : 200).json(r)
  } catch (e) {
    console.error('[voice]', path, e.message)
    return res.status(500).json({ error: e.message, code: 'server' })
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
function oauthPage(ok, text, what = 'היומן') {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>חיבור ${what}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#09090F;color:#E8E4D8;font-family:Heebo,Arial,sans-serif">
<div style="max-width:420px;padding:32px;text-align:center"><div style="font-size:44px">${ok ? '✅' : '⚠️'}</div>
<h1 style="font-size:22px;margin:12px 0">${ok ? `${what} חובר` : 'החיבור לא הצליח'}</h1><p style="line-height:1.7;color:#B9B5AA">${esc(text)}</p>
<a href="/admin-panel" style="display:inline-block;margin-top:16px;background:#8490D8;color:#09090F;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none">חזרה לפאנל</a></div></body></html>`
}
// ── Documents & digital signatures (admin "מסמכים וחתימות", src/DocumentsTab.jsx; the client's page src/SignPage.jsx) ──────
//  admin:  GET docs-list[?status=&q=&lead=] → { docs, stats, status } · GET docs-get?id= → { doc, events, chain, urls }
//          POST docs-create {client, property, fees, agent, logo, terms, expiryDays, title, leadId, propertyId} · POST docs-update {id, …}
//          POST docs-send {id, via: [whatsapp|email], personal | messageId (SIGN_MESSAGES) | text (the edited wording, {link} = the link), renew} · POST docs-link {id} (a fresh link to paste anywhere)
//          POST docs-reopen {id} (a sent, unsigned document → a draft again: the old link dies, edit, send the corrected one)
//          POST docs-cancel {id} · GET docs-file?id=&kind=original|signed|docx (the bytes) · GET/POST docs-settings · POST docs-clauses {clauses|reset}
//          POST docs-preview {…document input} → the PDF of what the wizard shows now (never stored)
//  public: GET sign-open?t= → { view } | { view, blocked } · POST sign-otp {t, via} · POST sign-submit {t, code, name, idNumber, agree, signature}
//          GET sign-file?t=&kind=original|signed (the PDF the client sees / the signed copy)
//  Everything is lib/documents-server.js; rules and texts lib/documents.js.
async function handleDocs(req, res, action) {
  const pub = action.startsWith('sign-')
  if (!pub && !checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' })
  if (!Docs.ready()) return res.status(503).json({ error: 'Supabase לא מוגדר (SUPABASE_URL / SUPABASE_SERVICE_KEY)' })
  const b = req.body || {}
  const sendFile = f => { if (!f) return res.status(404).json({ error: 'הקובץ לא נמצא' }); res.setHeader('Content-Type', f.type); res.setHeader('Content-Disposition', `${req.query?.dl ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(f.name)}`); res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Robots-Tag', 'noindex'); return res.status(200).end(Buffer.from(f.bytes)) }
  try {
    if (pub) {
      const t = String(req.query?.t || b.t || '')
      if (action === 'sign-open') { const r = await Docs.openByToken(t, req); return res.status(r.code || 200).json(r) }
      if (action === 'sign-otp') { const r = await Docs.sendOtp(t, b.via, req); return res.status(r.code || 200).json(r) }
      if (action === 'sign-submit') { const r = await Docs.submitSignature(t, b, req); return res.status(r.code || 200).json(r) }
      if (action === 'sign-file') return sendFile(await Docs.signedFileByToken(t, ['signed', 'signature', 'docx', 'agent'].includes(req.query?.kind) ? req.query.kind : 'original'))
      return res.status(404).json({ error: `Unknown path: ${action}` })
    }
    if (action === 'docs-list') {
      await Docs.sweepExpired().catch(() => 0)
      const docs = await Docs.listDocs({ status: req.query?.status, q: req.query?.q, lead: req.query?.lead, project: req.query?.project, limit: req.query?.limit })
      return res.status(200).json({ docs, status: Docs.status() })
    }
    // templates: GET docs-templates → { templates, builtin } · GET docs-template?id= · POST docs-template {…} (id = update) · POST docs-template-delete {id}
    // POST docs-extract (the file's bytes; ?name=&type=) → { text, method, pages, warnings, source } (the file is kept under templates/)
    if (action === 'docs-templates') { const r = await Docs.listTemplates({ all: !!req.query?.all }); return res.status(200).json({ ...r, builtin: await Docs.getTemplate('brokerage') }) }
    if (action === 'docs-template') {
      if (req.method === 'POST') { const r = await Docs.saveTemplate(b, { by: 'admin' }); return res.status(r.error ? 400 : 200).json(r) }
      const t = await Docs.getTemplate(req.query?.id)
      return t ? res.status(200).json({ template: t }) : res.status(404).json({ error: 'התבנית לא נמצאה' })
    }
    if (action === 'docs-template-delete') { const r = await Docs.deleteTemplate(b.id); return res.status(r.error ? 400 : 200).json(r) }
    if (action === 'docs-extract') {
      const bytes = req.rawBuffer || Buffer.alloc(0)
      const r = await Docs.extractUpload(bytes, { name: String(req.query?.name || ''), type: String(req.query?.type || req.headers['content-type'] || '') })
      return res.status(r.error ? 400 : 200).json(r)
    }
    if (action === 'docs-missing') { const d = await Docs.getDoc(req.query?.id); return d ? res.status(200).json({ missing: await Docs.docMissing(d) }) : res.status(404).json({ error: 'המסמך לא נמצא' }) }
    if (action === 'docs-get') {
      const doc = await Docs.getDoc(req.query?.id)
      if (!doc) return res.status(404).json({ error: 'המסמך לא נמצא' })
      const events = await Docs.listEvents(doc.id)
      return res.status(200).json({ doc, events, chain: Docs.verifyChain(events), drive: { connected: await Drive.connected().catch(() => false) }, urls: { original: await Docs.fileUrl(doc.original_path), signed: await Docs.fileUrl(doc.signed_path), signature: await Docs.fileUrl(doc.signature_path) } })
    }
    if (action === 'docs-create') { const r = await Docs.createDoc(b, { req }); return res.status(r.errors ? 400 : 201).json(r) }
    if (action === 'docs-update') { const r = await Docs.updateDoc(b.id, b, { req }); return res.status(r.errors || r.error ? 400 : 200).json(r) }
    if (action === 'docs-send') { const r = await Docs.sendDoc(b.id, { via: b.via, personal: b.personal, messageId: String(b.messageId || ''), text: String(b.text || '').slice(0, 2000), renew: !!b.renew, req }); return res.status(r.error ? 400 : 200).json(r) }
    if (action === 'docs-link') { const r = await Docs.newLink(b.id, { req }); return res.status(r.error ? 400 : 200).json(r) }
    if (action === 'docs-reopen') { const r = await Docs.reopenDoc(b.id, { req }); return res.status(r.error ? 400 : 200).json(r) }
    if (action === 'docs-cancel') { const r = await Docs.cancelDoc(b.id, { req }); return res.status(r.error ? 400 : 200).json(r) }
    if (action === 'docs-delete') { const r = await Docs.deleteDoc(b.id, { req }); return res.status(r.error ? 400 : 200).json(r) }
    if (action === 'docs-file') return sendFile(await Docs.docFile(req.query?.id, req.query?.kind || 'original'))
    if (action === 'docs-preview') {
      const { cleanDocInput } = await import('../lib/documents.js')
      const settings = await Docs.getSettings()
      const ptp = b.templateId && b.templateId !== 'brokerage' ? await Docs.getTemplate(b.templateId).catch(() => null) : null
      const { data, errors } = cleanDocInput({ ...b, fees: { vatRate: settings.vatRate, ...(b.fees || {}) }, agent: b.agent?.name ? b.agent : settings.agent, logo: b.logo || settings.logo }, ptp ? { requireProperty: !!ptp.sections.property, requireFees: !!ptp.sections.fees, requireAgent: false } : {})
      if (errors.length) return res.status(400).json({ errors })
      return sendFile({ bytes: await Docs.renderCurrent({ number: b.number || 'טיוטה', status: 'draft', data, created_at: new Date().toISOString(), template_id: b.templateId && b.templateId !== 'brokerage' ? b.templateId : null, project_name: data.projectName }), type: 'application/pdf', name: 'preview.pdf' })
    }
    if (action === 'docs-agent-signature') { if (req.method !== 'POST') return res.status(200).json(await Docs.agentSignatureInfo()); const r = await Docs.saveAgentSignature(b); return res.status(r.code || 200).json(r) }
    if (action === 'docs-settings') return res.status(200).json({ settings: req.method === 'POST' ? await Docs.saveSettings(b) : await Docs.getSettings(), status: Docs.status() })
    // reminders: POST docs-remind { id, now: true, messageId?, text?, via? } sends one now (the wording picked / edited in the drawer) · { id, off: true | false } = "no reminders for this document"
    if (action === 'docs-remind') {
      if (b.now) { const r = await Docs.remindUnsigned({ only: String(b.id || ''), force: true, max: 1, messageId: String(b.messageId || ''), text: String(b.text || '').slice(0, 1500), via: Array.isArray(b.via) ? b.via.filter(v => v === 'whatsapp' || v === 'email') : [] }); return res.status(200).json({ ...r, ok: r.sent > 0, doc: await Docs.getDoc(b.id) }) }
      const r = await Docs.setNoRemind(b.id, !!b.off); return res.status(r.error ? 400 : 200).json(r)
    }
    // Google Drive: GET docs-drive-status · POST docs-drive-connect → { url } · POST docs-drive-disconnect · POST docs-drive-sync { id? }
    if (action === 'docs-drive-status') return res.status(200).json(await Docs.driveStatus())
    if (action === 'docs-drive-connect') { if (!GCal.oauthReady()) return res.status(400).json({ error: 'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET חסרים ב-Vercel' }); return res.status(200).json({ url: Drive.authUrl() }) }
    if (action === 'docs-drive-disconnect') { await Drive.disconnect(); return res.status(200).json({ ok: true }) }
    if (action === 'docs-drive-sync') {
      if (b.id) { const d = await Docs.getDoc(b.id); if (!d) return res.status(404).json({ error: 'המסמך לא נמצא' }); const kinds = [d.original_path ? 'original' : '', d.signed_path ? 'signed' : ''].filter(Boolean); for (const k of kinds) await Docs.driveQueue(d, k); const r = await Docs.driveSyncDoc(d); return res.status(200).json({ ...r, doc: await Docs.getDoc(b.id) }) }
      return res.status(200).json(await Docs.driveTick({ max: 6 }))
    }
    if (action === 'docs-clauses') { await Docs.saveClauses(b.clauses, { reset: !!b.reset }); return res.status(200).json({ settings: await Docs.getSettings() }) }
    return res.status(404).json({ error: `Unknown path: ${action}` })
  } catch (e) { console.error('[docs]', action, e.message); return res.status(500).json({ error: e.message }) }
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
      const r = action === 'booking-manage' ? await Booking.manage(String(req.query?.m || ''), { ip, client: SUPABASE_URL && SUPABASE_KEY ? sb() : null })
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
      if (Drive.isDriveState(q.state)) {   // the documents module's Google Drive connection shares this callback URL
        if (q.error) return res.status(200).end(oauthPage(false, q.error === 'access_denied' ? 'לא אישרתם גישה ל-Google Drive. אפשר לנסות שוב מהגדרות המסמכים.' : `Google: ${q.error}`, 'Google Drive'))
        if (!Drive.stateValid(q.state)) return res.status(400).end(oauthPage(false, 'הקישור פג. לחצו שוב "חיבור Google Drive" בהגדרות המסמכים.', 'Google Drive'))
        try { const { email } = await Drive.connect(String(q.code || '')); return res.status(200).end(oauthPage(true, `Google Drive של ${email || ''} מחובר. כל מסמך שנשלח או נחתם נשמר מעכשיו גם בתיקייה Afik HaNahal/Documents.`, 'Google Drive')) } catch (e) { return res.status(200).end(oauthPage(false, e.message, 'Google Drive')) }
      }
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
    if (action === 'booking-cancel') return res.status(200).json(await Booking.cancel(String(b.id || ''), { notify: b.notify !== false, client: sb() }))
    if (action === 'booking-guests') return res.status(200).json(await Booking.setGuests(sb(), String(b.id || ''), b.guests))
    if (action === 'booking-move') return res.status(200).json(await Booking.moveByOffice(sb(), String(b.id || ''), String(b.start || ''), { notify: b.notify !== false }))
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
const GREEN_MSG_FIELDS = ['idMessage', 'type', 'typeMessage', 'timestamp', 'statusMessage', 'textMessage', 'caption', 'downloadUrl', 'fileName', 'mimeType', 'jpegThumbnail', 'location', 'latitude', 'longitude', 'nameLocation', 'address', 'contact', 'chatId', 'reactedTo']
const slimQuoted = q => (q && typeof q === 'object' ? { textMessage: q.textMessage, caption: q.caption, typeMessage: q.typeMessage, type: q.type } : undefined)
function slimGreenMsg(m) {
  if (!m || typeof m !== 'object') return m
  const out = {}
  for (const k of GREEN_MSG_FIELDS) if (m[k] !== undefined && m[k] !== null && m[k] !== '') out[k] = m[k]
  // a reaction: its emoji and the message it reacts to (Green keeps them in extendedTextMessage / quotedMessage.stanzaId)
  if (m.typeMessage === 'reactionMessage') {
    const ext = m.extendedTextMessage || m.extendedTextMessageData || m.reaction || {}
    const emoji = m.textMessage || ext.text || ''
    const to = m.reactedTo || m.quotedMessage?.stanzaId || ext.stanzaId || ''
    if (emoji) out.textMessage = emoji
    if (to) out.reactedTo = to
    return out
  }
  const q = slimQuoted(m.quotedMessage || m.extendedTextMessageData?.quotedMessage)
  if (q) out.quotedMessage = q
  return out
}

export default async function handler(req, res) {
  compressJson(req, res)   // gzip + ETag on every JSON answer — Vercel meters what a function sends (Fast Origin Transfer)
  if (req.method === 'OPTIONS') { cors(res); return res.status(204).end() }
  cors(res)

  // Read raw body — needed for signature verification and JSON parsing
  // (bytes first, then text: a voice recording is binary, and a multi-byte letter split between two chunks stays whole)
  const chunks = []
  await new Promise((resolve, reject) => {
    req.on('data', chunk => { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)) })
    req.on('end', resolve)
    req.on('error', reject)
  })
  req.rawBuffer = Buffer.concat(chunks)
  const isAudio = /^(audio\/|application\/octet-stream|application\/pdf|image\/|application\/vnd\.openxmlformats|application\/msword)/i.test(String(req.headers?.['content-type'] || ''))
  const rawBody = isAudio ? '' : req.rawBuffer.toString('utf8')
  try { req.body = rawBody ? JSON.parse(rawBody) : {} } catch { req.body = {} }
  req.rawBody = rawBody

  const path = (req.query._path || '').replace(/^\/+/, '')

  if (path === 'webhook')      return handleWebhook(req, res)
  if (path === 'green-hook')   return handleGreenHook(req, res)
  if (path === 'projects')     return handleProjects(req, res)
  if (path === 'gallery-folders') return handleGalleryFolders(req, res)
  if (path.startsWith('social-')) return handleSocial(req, res, path)
  if (path === 'leads')        return handleLeads(req, res)
  if (path === 'messages')     return handleMessages(req, res)
  if (path === 'sync')         return handleSync(req, res)
  if (path.startsWith('chat-'))  return handleChat(req, res, path)
  if (path.startsWith('auto-'))  return handleAutomations(req, res, path)
  if (path.startsWith('booking-')) return handleBooking(req, res, path)
  if (path.startsWith('docs-') || path.startsWith('sign-')) return handleDocs(req, res, path)
  if (path.startsWith('media-')) return handleMedia(req, res, path)
  if (path === 'supermetrics')   return handleSupermetrics(req, res)
  if (path === 'ga4')            return handleGA4(req, res)
  if (path === 'ga4-dash' || path === 'ga4-property') return handleGA4Dash(req, res, path)
  if (path === 'lead-analyze')   return handleLeadAnalyze(req, res)
  if (path === 'lead-research')  return handleLeadResearch(req, res)
  if (path === 'dictation-polish' || path.startsWith('voice-')) return handleVoice(req, res, path)
  if (path === 'chat-summary')   return handleChatSummary(req, res)
  if (path === 'diagnostics')    return handleDiagnostics(req, res)
  if (path === 'connect')        return handleConnect(req, res)
  if (path === 'lead-welcome')   return handleLeadWelcome(req, res)
  if (path === 'lead-to-crm' || path === 'crm-sync') return handleMetaCRM(req, res, path)

  return res.status(404).json({ error: `Unknown path: ${path}` })
}
