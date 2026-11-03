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
