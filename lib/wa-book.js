// One name for a lead in our system and in the office phone's own WhatsApp contacts (Green API addContact / editContact with
// saveInAddressbook, getContacts' contactName). Our side → the phone: every rename (the leads board, the lead card, the Lead
// Center, the chats header) writes the contact. The phone → our side: auto-tick / auto-run compare the phone book with the
// names it had last time (app_settings.wa_book_names, keyed by the last 9 digits) and a name changed on the phone renames the
// lead. The first look only records the phone book (no mass renames). Pure rules here, tested; the calls live in
// lib/automations.js.

export const tail9 = p => String(p || '').replace(/\D/g, '').slice(-9)

/** "רונן כהן · זרובבל 15" → { firstName: 'רונן', lastName: 'כהן · זרובבל 15' } (WhatsApp needs a first name) */
export function nameParts(name) {
  const words = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 80).split(' ').filter(Boolean)
  if (!words.length) return null
  return { firstName: words[0].slice(0, 40), ...(words.length > 1 ? { lastName: words.slice(1).join(' ').slice(0, 60) } : {}) }
}

/** getContacts → Map(tail9 → { phone, name }) of the names saved in the phone (contactName), people only */
export function bookNames(contacts = []) {
  const out = new Map()
  for (const c of Array.isArray(contacts) ? contacts : []) {
    const id = String(c?.id || '')
    if (!id.endsWith('@c.us')) continue
    const phone = id.split('@')[0].replace(/\D/g, ''), name = String(c.contactName || '').replace(/\s+/g, ' ').trim()
    const k = tail9(phone)
    if (k.length === 9 && name && !/^\+?[\d\s-]+$/.test(name)) out.set(k, { phone, name })
  }
  return out
}

/**
 * The phone book now vs the names seen last time → { changes: [{ tail, phone, name, was }], next } (next = the new baseline).
 * Only a name that was there before and is different now counts as a change; a new entry is just recorded.
 */
export function bookChanges(book, baseline = {}, { max = 20 } = {}) {
  const base = baseline && typeof baseline === 'object' ? baseline : {}
  const next = { ...base }
  const changes = []
  for (const [tail, { phone, name }] of book) {
    const was = base[tail]
    // the phone kept only the first name of a name we wrote ("רחל קפר" → "רחל"): ours, not a rename made on the phone
    if (was && was !== name && name === nameParts(was)?.firstName) continue
    if (was && was !== name && changes.length < max) changes.push({ tail, phone, name, was })
    if (!was || changes.some(c => c.tail === tail)) next[tail] = name
  }
  return { changes, next }
}
