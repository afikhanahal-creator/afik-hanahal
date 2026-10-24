// The "קישור לקביעת שיחה" button of the message boxes (the chats tab's ChatComposer, the Lead Center / lead card's
// LeadConversation): a short line with the booking page link (/book, our own Calendly), put into the box at the cursor.
// `?ref=wa` keeps on the lead that the booking came from a WhatsApp chat; English adds `lang=en`.
export const BOOKING_URL = 'https://www.afikhanahal.co.il/book'

export const bookingLink = (lang = 'he', base = BOOKING_URL) => `${String(base || BOOKING_URL).replace(/[?#].*$/, '')}?ref=wa${lang === 'en' ? '&lang=en' : ''}`

/** The language of what is already in the box (Hebrew letters → he, only Latin → en), else the fallback */
export const textLang = (text, fallback = 'he') => (/[֐-׿]/.test(text || '') ? 'he' : /[a-z]/i.test(text || '') ? 'en' : fallback)

export const bookingLine = (lang = 'he', base) => (lang === 'en'
  ? `Pick a time for a short call here: ${bookingLink('en', base)}`
  : `אפשר לבחור כאן שעה נוחה לשיחה קצרה: ${bookingLink('he', base)}`)

/**
 * Put the booking line into `text` at the selection [start, end): an empty box gets the whole line, text that already
 * has a sentence gets the link on its own line. → { text, cursor }. A text that already holds the link is left as is.
 */
export function insertBooking(text = '', start = text.length, end = start, fallbackLang = 'he', base) {
  const lang = textLang(text, fallbackLang)
  if (text.includes(String(base || BOOKING_URL).replace(/[?#].*$/, ''))) return { text, cursor: text.length, lang }
  const s = Math.max(0, Math.min(start ?? text.length, text.length)), e = Math.max(s, Math.min(end ?? s, text.length))
  const before = text.slice(0, s).replace(/[ \t]+$/, ''), after = text.slice(e)
  const add = before.trim() ? `\n${bookingLine(lang, base)}` : bookingLine(lang, base)
  const next = before + add + (after && !after.startsWith('\n') ? `\n${after}` : after)
  return { text: next, cursor: (before + add).length, lang }
}
