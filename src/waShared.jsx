// The WhatsApp look shared by the chats tab (GreenAPIChat.jsx) and the Lead Center's conversation (LeadConversation.jsx):
// the two palettes, the doodle backgrounds, Green API message → { id, direction, message, … }, and the delivery ticks.

// ─── Theme palettes ───────────────────────────────────────────────────────────
export const DARK = {
  bubbleOut:     '#005C4B',
  bubbleIn:      '#2A3942',
  chatBg:        '#17222A',
  panelBg:       '#111B21',
  selectedRow:   '#2A3942',
  authBadgeBg:   '#1B3B2E',
  authBadgeTxt:  '#22C55E',
  green:         '#00A884',
  unread:        '#075E54',   // WhatsApp authentic dark green (unread badge)
  inputBg:       '#202C33',
  inputFieldBg:  '#2A3942',
  bodyText:      '#E9EDEF',
  subText:       '#8696A0',
  border:        '#222D34',
  topBorder:     '#222D34',
  tick:          '#53BDEB',
  tickGray:      '#8696A0',
  dateSepBg:     '#182229',
  dateSepText:   '#8696A0',
  modalBg:       '#202C33',
  modalOverlay:  'rgba(0,0,0,.65)',
  hoverRow:      '#1E2D36',
  delBtn:        'rgba(224,82,82,.18)',
}

export const LIGHT = {
  bubbleOut:     '#D9FDD3',
  bubbleIn:      '#FFFFFF',
  chatBg:        '#EFEAE2',
  panelBg:       '#FFFFFF',
  selectedRow:   '#E8F5E9',
  authBadgeBg:   '#D4F4DD',
  authBadgeTxt:  '#2E7D32',
  green:         '#00A884',
  unread:        '#075E54',   // WhatsApp authentic dark green (unread badge)
  inputBg:       '#F0F2F5',
  inputFieldBg:  '#FFFFFF',
  bodyText:      '#111B21',
  subText:       '#667781',
  border:        '#E9EDEF',
  topBorder:     '#E5E5E5',
  tick:          '#53BDEB',
  tickGray:      '#8696A0',
  dateSepBg:     '#FFFFFF',
  dateSepText:   '#54656F',
  modalBg:       '#FFFFFF',
  modalOverlay:  'rgba(0,0,0,.45)',
  hoverRow:      '#F5F6F6',
  delBtn:        'rgba(224,82,82,.12)',
}

// ─── Doodle backgrounds ───────────────────────────────────────────────────────
export const DOODLE_LIGHT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='76' height='76'%3E%3Cdefs%3E%3Cpattern id='wa' x='0' y='0' width='76' height='76' patternUnits='userSpaceOnUse'%3E%3Cg fill='none' stroke='%23A09880' stroke-opacity='0.12' stroke-width='1'%3E%3Ccircle cx='38' cy='38' r='13'/%3E%3Ccircle cx='38' cy='38' r='5'/%3E%3Cline x1='38' y1='5' x2='38' y2='18'/%3E%3Cline x1='38' y1='58' x2='38' y2='71'/%3E%3Cline x1='5' y1='38' x2='18' y2='38'/%3E%3Cline x1='58' y1='38' x2='71' y2='38'/%3E%3Cline x1='13' y1='13' x2='22' y2='22'/%3E%3Cline x1='54' y1='54' x2='63' y2='63'/%3E%3Cline x1='63' y1='13' x2='54' y2='22'/%3E%3Cline x1='22' y1='54' x2='13' y2='63'/%3E%3C/g%3E%3C/pattern%3E%3C/defs%3E%3Crect width='76' height='76' fill='url(%23wa)'/%3E%3C/svg%3E")`
export const DOODLE_DARK  = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='76' height='76'%3E%3Cdefs%3E%3Cpattern id='wad' x='0' y='0' width='76' height='76' patternUnits='userSpaceOnUse'%3E%3Cg fill='none' stroke='%23FFFFFF' stroke-opacity='0.06' stroke-width='1'%3E%3Ccircle cx='38' cy='38' r='13'/%3E%3Ccircle cx='38' cy='38' r='5'/%3E%3Cline x1='38' y1='5' x2='38' y2='18'/%3E%3Cline x1='38' y1='58' x2='38' y2='71'/%3E%3Cline x1='5' y1='38' x2='18' y2='38'/%3E%3Cline x1='58' y1='38' x2='71' y2='38'/%3E%3Cline x1='13' y1='13' x2='22' y2='22'/%3E%3Cline x1='54' y1='54' x2='63' y2='63'/%3E%3Cline x1='63' y1='13' x2='54' y2='22'/%3E%3Cline x1='22' y1='54' x2='13' y2='63'/%3E%3C/g%3E%3C/pattern%3E%3C/defs%3E%3Crect width='76' height='76' fill='url(%23wad)'/%3E%3C/svg%3E")`

// ─── Green API message normalizer ────────────────────────────────────────────
export function normalizeGreenMsg(m) {
  const text = m.textMessage
    || m.caption
    || (m.typeMessage === 'imageMessage'    ? '📷 תמונה'
      : m.typeMessage === 'documentMessage' ? '📎 מסמך'
      : m.typeMessage === 'videoMessage'    ? '🎥 סרטון'
      : m.typeMessage === 'audioMessage'    ? '🎵 הקלטה'
      : m.typeMessage === 'stickerMessage'  ? '🎭 מדבקה'
      : m.typeMessage === 'contactMessage'  ? '👤 איש קשר'
      : m.typeMessage === 'locationMessage' ? '📍 מיקום'
      : m.typeMessage || '')
  const quoted = m.quotedMessage || m.extendedTextMessageData?.quotedMessage || null
  return {
    id:         m.idMessage,
    direction:  m.type === 'outgoing' ? 'out' : 'in',
    message:    (m.typeMessage === 'imageMessage' || m.typeMessage === 'videoMessage') && !m.caption ? '' : (m.typeMessage === 'audioMessage' ? '' : text),
    kind:       m.typeMessage || 'textMessage',
    media:      m.downloadUrl ? { url: m.downloadUrl, name: m.fileName || '', mime: m.mimeType || '', thumb: m.jpegThumbnail ? `data:image/jpeg;base64,${m.jpegThumbnail}` : null } : (m.jpegThumbnail ? { url: null, thumb: `data:image/jpeg;base64,${m.jpegThumbnail}` } : null),
    location:   m.location || (m.typeMessage === 'locationMessage' ? { latitude: m.latitude, longitude: m.longitude, nameLocation: m.nameLocation, address: m.address } : null),
    contactCard: m.contact || null,
    quoted:     quoted ? { text: quoted.textMessage || quoted.caption || (quoted.typeMessage ? '📎' : ''), out: quoted.type === 'outgoing' } : null,
    created_at: new Date((m.timestamp || 0) * 1000).toISOString(),
    // Preserve the real delivery state for outgoing messages so the ticks can
    // show sent (✓) → delivered (✓✓ gray) → read (✓✓ blue). Incoming needs none.
    status:     m.type === 'outgoing' ? (m.statusMessage || 'sent') : 'read',
  }
}

export function TickMark({ status, WA, size = 14 }) {
  if (status === 'sending' || status === 'pending') {
    return (
      <svg width={size - 1} height={size - 1} viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="6.4" fill="none" stroke={WA.tickGray} strokeWidth="1.3" />
        <path d="M8 4.4V8l2.4 1.5" fill="none" stroke={WA.tickGray} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    )
  }
  if (status === 'failed' || status === 'noAccount') {
    return <span style={{ fontSize: size - 1, color: '#E05252', fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>!</span>
  }
  const read = status === 'read'
  const single = status === 'sent'
  return (
    <span style={{ fontSize: size, lineHeight: 1, color: read ? WA.tick : WA.tickGray, flexShrink: 0, letterSpacing: '-1px' }}>
      {single ? '✓' : '✓✓'}
    </span>
  )
}

