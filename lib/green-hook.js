// Green API's webhook deliveries (POST /api/meta/green-hook) → rows of public.wa_messages (server/wa-messages-migration.sql).
// Pure; tested in green-hook.test.mjs. Every message of the line arrives here as it happens: incomingMessageReceived (the lead
// wrote), outgoingAPIMessageReceived (the system sent), outgoingMessageReceived (sent from the office phone) and
// outgoingMessageStatus (sent / delivered / read / failed). Groups, statuses (stories) and calls are ignored. This is also
// where the future chatbot will hear an incoming message first.

const phoneOf = chatId => (/^(\d{8,15})@c\.us$/.exec(String(chatId || '')) || [])[1] || ''
const clip = (s, n) => (s == null ? null : String(s).slice(0, n))

/** messageData → { type, body, file_url, file_name, mime, quoted } */
export function messageParts(md = {}) {
  const type = md.typeMessage || 'textMessage'
  const file = md.fileMessageData || {}
  const ext = md.extendedTextMessageData || {}
  let body = md.textMessageData?.textMessage ?? ext.text ?? file.caption ?? null
  if (type === 'locationMessage' || type === 'liveLocationMessage') {
    const l = md.locationMessageData || md.liveLocationMessageData || {}
    body = [l.nameLocation, l.address].filter(Boolean).join(' · ') || null
  }
  if (type === 'contactMessage') body = md.contactMessageData?.displayName || null
  if (type === 'reactionMessage') body = ext.text || null
  if (type === 'pollMessage') body = md.pollMessageData?.name || null
  if (type === 'buttonsResponseMessage' || type === 'templateButtonsReplyMessage') body = md.buttonsResponseMessage?.selectedButtonText || md.templateButtonReplyMessage?.selectedDisplayText || body
  if (type === 'listResponseMessage') body = md.listResponseMessage?.title || body
  const q = md.quotedMessage || ext.quotedMessage || null
  return {
    type,
    body: clip(body, 8000),
    file_url: clip(file.downloadUrl, 1000),
    file_name: clip(file.fileName, 300),
    mime: clip(file.mimeType, 120),
    quoted: q ? { id: q.stanzaId || null, text: clip(q.textMessage || q.caption || q.text || '', 400), out: q.participant ? undefined : undefined } : null,
  }
}

/**
 * One delivery → what to store:
 *   { kind: 'message', row }               a new message (upsert by id)
 *   { kind: 'status', id, status, phone }  a delivery status of one of ours
 *   { kind: 'state', state }               the line connected / disconnected
 *   { kind: 'ignore', why }
 */
export function parseGreenHook(b) {
  if (!b || typeof b !== 'object') return { kind: 'ignore', why: 'empty' }
  const t = b.typeWebhook
  if (t === 'outgoingMessageStatus') {
    const phone = phoneOf(b.chatId)
    if (!b.idMessage || !phone) return { kind: 'ignore', why: 'status without a chat' }
    return { kind: 'status', id: String(b.idMessage), status: String(b.status || ''), phone }
  }
  if (t === 'stateInstanceChanged') return { kind: 'state', state: String(b.stateInstance || '') }
  if (!['incomingMessageReceived', 'outgoingMessageReceived', 'outgoingAPIMessageReceived'].includes(t)) return { kind: 'ignore', why: t || 'no type' }
  const s = b.senderData || {}
  const phone = phoneOf(s.chatId)
  if (!phone) return { kind: 'ignore', why: 'not a private chat' }      // groups, status broadcasts
  if (!b.idMessage) return { kind: 'ignore', why: 'no id' }
  const incoming = t === 'incomingMessageReceived'
  const p = messageParts(b.messageData)
  const ts = Number(b.timestamp) > 0 ? new Date(Number(b.timestamp) * 1000) : new Date()
  return {
    kind: 'message',
    row: {
      id: String(b.idMessage), phone, direction: incoming ? 'in' : 'out', ...p,
      sender_name: incoming ? clip(s.senderContactName || s.senderName || s.chatName || '', 200) : null,
      status: incoming ? null : 'sent', by_api: incoming ? null : t === 'outgoingAPIMessageReceived',
      ts: ts.toISOString(),
    },
  }
}

/** A stored row → the shape Green's getChatHistory returns (so the chats' normalizeGreenMsg reads it as is) */
export function rowToGreen(r) {
  const file = r.file_url || r.file_name
  return {
    idMessage: r.id, chatId: `${r.phone}@c.us`, type: r.direction === 'in' ? 'incoming' : 'outgoing',
    typeMessage: r.type, timestamp: Math.floor(Date.parse(r.ts) / 1000),
    ...(file ? { caption: r.body || '', downloadUrl: r.file_url || '', fileName: r.file_name || '', mimeType: r.mime || '' } : { textMessage: r.body || '' }),
    ...(r.quoted?.text ? { quotedMessage: { textMessage: r.quoted.text } } : {}),
    ...(r.direction === 'out' && r.status ? { statusMessage: r.status } : {}),
    ...(r.sender_name ? { senderName: r.sender_name } : {}),
  }
}

/** Green's history + our stored rows for one chat: one list by id, newest last; a stored status that moved further wins */
const RANK = { failed: -1, sent: 1, delivered: 2, read: 3, played: 4 }
export function mergeHistory(green = [], stored = []) {
  const byId = new Map()
  for (const m of green) if (m?.idMessage) byId.set(m.idMessage, m)
  for (const r of stored) {
    const g = rowToGreen(r), have = byId.get(g.idMessage)
    if (!have) byId.set(g.idMessage, g)
    else if (g.statusMessage && (RANK[g.statusMessage] || 0) > (RANK[have.statusMessage] || 0)) byId.set(g.idMessage, { ...have, statusMessage: g.statusMessage })
  }
  return [...byId.values()].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
}
