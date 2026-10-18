// WhatsApp messages (Green API history) in one plain shape — pure, shared by the server summary (lib/chat-summary.js)
// and the lead card's conversation view (src/LeadCard.jsx), so nothing server-only reaches the browser bundle.
const MEDIA = {
  audioMessage: 'הודעה קולית (לא תומללה)', imageMessage: 'תמונה', videoMessage: 'סרטון', documentMessage: 'מסמך',
  stickerMessage: 'מדבקה', locationMessage: 'מיקום', contactMessage: 'איש קשר',
}

/** Green API messages (raw or as chatHistory() returns them) → [{ dir: 'in'|'out', text, ts, media }] oldest first */
export function normalizeChat(list = []) {
  return (Array.isArray(list) ? list : []).map(m => {
    if (m && m.dir) {   // already chatHistory() shape — '[audioMessage]' markers become words
      const kind = /^\[(\w+)\]$/.exec(m.text || '')?.[1]
      return { dir: m.dir, text: kind ? '' : m.text, ts: m.ts || 0, media: kind ? (MEDIA[kind] || kind) : '' }
    }
    const kind = m?.typeMessage || 'textMessage'
    const text = m?.textMessage || m?.caption || m?.extendedTextMessage?.text || ''
    const ts = typeof m?.timestamp === 'number' ? m.timestamp * 1000 : Date.parse(m?.timestamp || '') || 0
    return { dir: m?.type === 'outgoing' ? 'out' : 'in', text, ts, media: kind !== 'textMessage' && kind !== 'extendedTextMessage' ? (MEDIA[kind] || kind) : '' }
  }).filter(m => m.text || m.media).sort((a, b) => a.ts - b.ts)
}
