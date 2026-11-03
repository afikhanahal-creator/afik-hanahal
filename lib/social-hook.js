// Messenger + Instagram messages of the office's pages (the Meta webhook, api/meta.js handleWebhook → handleSocialEvents).
// Pure and tested (social-hook.test.mjs): what a delivery says, the thread it belongs to, a phone / email the person wrote, and
// the lead a conversation becomes ("הוסף כליד", lib/manual-lead.js).

export const PLATFORMS = ['messenger', 'instagram']
export const threadId = (platform, accountId, userId) => `${platform}:${accountId}:${userId}`
export function parseThreadId(id) {
  const m = /^(messenger|instagram):(\d+):(\d+)$/.exec(String(id || ''))
  return m ? { platform: m[1], accountId: m[2], userId: m[3] } : null
}

/**
 * A webhook body → [{ platform, accountId, userId, direction, mid, text, attachments, ts }]
 * object 'page' = Messenger (entry.id = the page), object 'instagram' = Instagram DMs (entry.id = the IG business account).
 * An echo (`message.is_echo`) is a message the page sent (from Meta Business Suite, the phone app or our Send API): the person
 * is the recipient then. Reactions, reads and deliveries are left out.
 */
export function parseSocialHook(body) {
  const obj = body?.object
  if (obj !== 'page' && obj !== 'instagram') return []
  const platform = obj === 'page' ? 'messenger' : 'instagram'
  const out = []
  for (const entry of Array.isArray(body.entry) ? body.entry : []) {
    const accountId = String(entry?.id || '')
    for (const ev of Array.isArray(entry?.messaging) ? entry.messaging : []) {
      const msg = ev?.message
      if (!msg || !msg.mid || msg.is_deleted) continue
      const echo = !!msg.is_echo
      const userId = String(echo ? ev?.recipient?.id || '' : ev?.sender?.id || '')
      if (!/^\d+$/.test(userId) || !/^\d+$/.test(accountId) || userId === accountId) continue
      const attachments = (Array.isArray(msg.attachments) ? msg.attachments : [])
        .map(a => ({ type: String(a?.type || 'file'), url: String(a?.payload?.url || '').slice(0, 2000) })).filter(a => a.url || a.type).slice(0, 10)
      out.push({
        platform, accountId, userId, direction: echo ? 'out' : 'in', mid: String(msg.mid),
        text: String(msg.text || '').slice(0, 4000), attachments, ts: new Date(Number(ev.timestamp) || Date.now()).toISOString(),
      })
    }
  }
  return out
}

/** A phone number / an email the person wrote ("אפשר להתקשר 052-1234567", "+972 54 …") → { phone: '05X…', email } */
export function contactFromText(text) {
  const s = String(text || '')
  let phone = ''
  const m = s.replace(/[‎‏]/g, '').match(/(?:\+?972[\s-]?|0)(5\d)[\s-]?(\d{3})[\s-]?(\d{4})(?!\d)/)
  if (m) phone = `0${m[1]}${m[2]}${m[3]}`
  const e = s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  return { phone, email: e ? e[0].toLowerCase() : '' }
}

/** The text shown in the list for a message without text */
export function previewText(m, lang = 'he') {
  if (m?.text) return m.text.slice(0, 200)
  const t = m?.attachments?.[0]?.type
  const he = { image: '📷 תמונה', video: '🎥 סרטון', audio: '🎤 הקלטה', file: '📎 קובץ', share: '🔗 שיתוף', story_mention: '📣 תיוג בסטורי', ig_reel: '🎬 ריל' }
  const en = { image: '📷 Photo', video: '🎥 Video', audio: '🎤 Voice note', file: '📎 File', share: '🔗 Shared post', story_mention: '📣 Story mention', ig_reel: '🎬 Reel' }
  return (lang === 'en' ? en : he)[t] || (lang === 'en' ? 'Message' : 'הודעה')
}

/** The "הוסף כליד" body for lib/manual-lead.js: the conversation's person, what they wrote, where from */
export function leadBodyFromThread(thread, pick = {}) {
  const found = { phone: thread?.phone || '', email: thread?.email || '' }
  return {
    name: String(pick.name ?? thread?.name ?? thread?.username ?? '').trim(),
    phone: String(pick.phone ?? found.phone ?? ''),
    email: String(pick.email ?? found.email ?? ''),
    projectId: pick.projectId || '', projectName: pick.projectName || '',
    leadStatus: pick.leadStatus || 'contacted',
    source: thread?.platform === 'instagram' ? 'instagram' : 'messenger',
    sourceDetail: thread?.username ? `@${thread.username}` : '',
    note: String(pick.note || '').trim(),
    social: { platform: thread?.platform, threadId: thread?.id, accountId: thread?.account_id || thread?.accountId, userId: thread?.user_id || thread?.userId, username: thread?.username || '' },
  }
}

// ── Several pages in one inbox (app_settings 'social_pages') ─────────────────────────────────────────────────────────────
// The leads' pages (META_PAGE_IDS) are always in; any other page the token reaches (Daniel's page, Korkos…) is added from the
// admin's "חשבונות מחוברים" → [{ id, name, on, ig: { id, username } | null }]
export function cleanSocialPages(list) {
  const out = [], seen = new Set()
  for (const p of Array.isArray(list) ? list : []) {
    const id = String(p?.id || '')
    if (!/^\d{3,25}$/.test(id) || seen.has(id)) continue
    seen.add(id)
    const ig = p?.ig && /^\d{3,25}$/.test(String(p.ig.id || '')) ? { id: String(p.ig.id), username: String(p.ig.username || '').slice(0, 60) } : null
    out.push({ id, name: String(p?.name || '').slice(0, 80), on: p?.on !== false, ig })
  }
  return out.slice(0, 30)
}
/** The pages whose messages come into the inbox: the leads' pages first, then every page switched on */
export function inboxPageIds(envIds = [], stored = []) {
  return [...new Set([...envIds.map(String).filter(Boolean), ...cleanSocialPages(stored).filter(p => p.on).map(p => p.id)])]
}
/** { <account id>: { name, platform, pageId } } — a page's Messenger and its Instagram account, for the list's labels */
export function accountLabels(stored = []) {
  const out = {}
  for (const p of cleanSocialPages(stored)) {
    out[p.id] = { name: p.name, platform: 'messenger', pageId: p.id }
    if (p.ig) out[p.ig.id] = { name: p.ig.username ? `@${p.ig.username}` : p.name, platform: 'instagram', pageId: p.id }
  }
  return out
}

/** One conversation of Graph's /{page}/conversations → { person: { id, name, username }, events } (oldest first) */
export function conversationEvents(c, { platform, accountId, pageId }) {
  const ours = id => String(id) === String(accountId) || String(id) === String(pageId)
  const person = (c?.participants?.data || []).find(p => p?.id && !ours(p.id))
  if (!person?.id || !/^\d+$/.test(String(person.id))) return null
  const events = []
  for (const m of [...(c.messages?.data || [])].reverse()) {
    if (!m?.id) continue
    events.push({
      platform, accountId: String(accountId), userId: String(person.id), direction: ours(m.from?.id) ? 'out' : 'in', mid: String(m.id), text: String(m.message || '').slice(0, 4000),
      attachments: (m.attachments?.data || []).map(a => ({ type: String(a.mime_type || a.type || 'file').split('/')[0], url: String(a.image_data?.url || a.video_data?.url || a.file_url || '').slice(0, 2000) })).slice(0, 10),
      ts: new Date(m.created_time || Date.now()).toISOString(),
    })
  }
  return { person: { id: String(person.id), name: String(person.name || '').slice(0, 80), username: String(person.username || '').slice(0, 60) }, events }
}

/** The thread row after a batch of new messages (webhook or import): the newest line, unread, a phone / email they wrote */
export function threadRowFrom({ cur = null, events = [], platform, accountId, userId, prof = {}, quiet = false, now = new Date().toISOString() }) {
  const sorted = [...events].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts))
  const last = sorted[sorted.length - 1]
  const newer = last && (!cur?.last_at || Date.parse(last.ts) >= Date.parse(cur.last_at))
  let phone = '', email = ''
  for (const e of sorted) if (e.direction === 'in') { const f = contactFromText(e.text); phone = f.phone || phone; email = f.email || email }
  let unread = cur?.unread || 0
  if (!quiet) for (const e of sorted) unread = e.direction === 'in' ? unread + 1 : 0
  return {
    id: threadId(platform, accountId, userId), platform, account_id: String(accountId), user_id: String(userId), updated_at: now,
    ...(prof.name && !cur?.name ? { name: prof.name } : {}), ...(prof.username && !cur?.username ? { username: prof.username } : {}), ...(prof.avatar ? { avatar: prof.avatar } : {}),
    ...(newer ? { last_text: previewText(last), last_dir: last.direction, last_at: last.ts } : {}),
    unread, ...(phone && !cur?.phone ? { phone } : {}), ...(email && !cur?.email ? { email } : {}),
  }
}

/** The import's work list: every inbox page's Messenger, then its Instagram account */
export function importJobs(pages = []) {
  const jobs = []
  for (const p of pages) { jobs.push({ pageId: p.id, platform: 'messenger', accountId: p.id }); if (p.ig?.id) jobs.push({ pageId: p.id, platform: 'instagram', accountId: p.ig.id }) }
  return jobs
}
