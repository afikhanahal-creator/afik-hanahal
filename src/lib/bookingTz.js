// Time zones for the booking page (/book), Calendly style: the visitor sees the free times in the zone they pick (their
// device's zone by default), while the office, the calendar and every confirmation stay in Israel time. Pure; tested in
// bookingTz.test.mjs.

export const OFFICE_TZ = 'Asia/Jerusalem'

// The zones people book from: Israel first, then the places Israelis abroad and foreign investors call from
export const ZONES = [
  { id: 'Asia/Jerusalem', g: 'il', he: 'ישראל', en: 'Israel' },
  { id: 'Europe/London', g: 'eu', he: 'לונדון', en: 'London' },
  { id: 'Europe/Paris', g: 'eu', he: 'פריז', en: 'Paris' },
  { id: 'Europe/Berlin', g: 'eu', he: 'ברלין', en: 'Berlin' },
  { id: 'Europe/Amsterdam', g: 'eu', he: 'אמסטרדם', en: 'Amsterdam' },
  { id: 'Europe/Madrid', g: 'eu', he: 'מדריד', en: 'Madrid' },
  { id: 'Europe/Rome', g: 'eu', he: 'רומא', en: 'Rome' },
  { id: 'Europe/Zurich', g: 'eu', he: 'ציריך', en: 'Zurich' },
  { id: 'Europe/Athens', g: 'eu', he: 'אתונה', en: 'Athens' },
  { id: 'Europe/Kyiv', g: 'eu', he: 'קייב', en: 'Kyiv' },
  { id: 'Europe/Istanbul', g: 'eu', he: 'איסטנבול', en: 'Istanbul' },
  { id: 'Europe/Moscow', g: 'eu', he: 'מוסקבה', en: 'Moscow' },
  { id: 'America/New_York', g: 'am', he: 'ניו יורק, מיאמי', en: 'New York, Miami' },
  { id: 'America/Toronto', g: 'am', he: 'טורונטו', en: 'Toronto' },
  { id: 'America/Chicago', g: 'am', he: 'שיקגו', en: 'Chicago' },
  { id: 'America/Denver', g: 'am', he: 'דנבר', en: 'Denver' },
  { id: 'America/Los_Angeles', g: 'am', he: 'לוס אנג׳לס', en: 'Los Angeles' },
  { id: 'America/Mexico_City', g: 'am', he: 'מקסיקו סיטי', en: 'Mexico City' },
  { id: 'America/Sao_Paulo', g: 'am', he: 'סאו פאולו', en: 'São Paulo' },
  { id: 'America/Argentina/Buenos_Aires', g: 'am', he: 'בואנוס איירס', en: 'Buenos Aires' },
  { id: 'Asia/Dubai', g: 'as', he: 'דובאי', en: 'Dubai' },
  { id: 'Asia/Kolkata', g: 'as', he: 'הודו', en: 'India' },
  { id: 'Asia/Bangkok', g: 'as', he: 'בנגקוק', en: 'Bangkok' },
  { id: 'Asia/Singapore', g: 'as', he: 'סינגפור', en: 'Singapore' },
  { id: 'Asia/Hong_Kong', g: 'as', he: 'הונג קונג', en: 'Hong Kong' },
  { id: 'Asia/Tokyo', g: 'as', he: 'טוקיו', en: 'Tokyo' },
  { id: 'Australia/Sydney', g: 'as', he: 'סידני', en: 'Sydney' },
  { id: 'Australia/Melbourne', g: 'as', he: 'מלבורן', en: 'Melbourne' },
  { id: 'Pacific/Auckland', g: 'as', he: 'אוקלנד', en: 'Auckland' },
  { id: 'Africa/Johannesburg', g: 'af', he: 'יוהנסבורג', en: 'Johannesburg' },
  { id: 'Africa/Cairo', g: 'af', he: 'קהיר', en: 'Cairo' },
  { id: 'UTC', g: 'af', he: 'זמן אוניברסלי (UTC)', en: 'Universal time (UTC)' },
]
export const GROUPS = [
  { id: 'mine', he: 'אזור הזמן שלכם', en: 'Your time zone' },
  { id: 'il', he: 'ישראל', en: 'Israel' },
  { id: 'eu', he: 'אירופה', en: 'Europe' },
  { id: 'am', he: 'אמריקה', en: 'Americas' },
  { id: 'as', he: 'אסיה ואוסטרליה', en: 'Asia & Australia' },
  { id: 'af', he: 'אפריקה ועוד', en: 'Africa & more' },
]

export const validTz = tz => { try { if (!tz) return false; new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false } }
export const deviceTz = () => { try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; return validTz(z) ? z : OFFICE_TZ } catch { return OFFICE_TZ } }

/** A zone's name in the page's language: the list's own, else its city from the IANA id ("America/Phoenix" → "Phoenix") */
export function zoneLabel(tz, lang = 'he') {
  const z = ZONES.find(x => x.id === tz)
  if (z) return lang === 'en' ? z.en : z.he
  return String(tz || '').split('/').pop().replace(/_/g, ' ')
}

/** "GMT+3" / "GMT-4" at a moment */
export function gmtOffset(tz, at = new Date()) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(at).find(x => x.type === 'timeZoneName')
    return (p?.value || 'GMT').replace('UTC', 'GMT')
  } catch { return '' }
}

export const dayIn = (iso, tz) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz })
export const todayIn = (tz, now = Date.now()) => new Date(now).toLocaleDateString('en-CA', { timeZone: tz })
export const timeIn = (iso, tz, h12 = false) => new Date(iso).toLocaleTimeString(h12 ? 'en-US' : 'en-GB',
  { timeZone: tz, hour: h12 ? 'numeric' : '2-digit', minute: '2-digit', hour12: h12 })

/** The server's slots ({ israelDay: [iso…] }) regrouped by the day they fall on in `tz`, each day sorted */
export function regroupSlots(slots, tz) {
  if (!slots) return null
  if (tz === OFFICE_TZ) return slots
  const out = {}
  for (const list of Object.values(slots)) for (const iso of list || []) (out[dayIn(iso, tz)] ||= []).push(iso)
  for (const k of Object.keys(out)) out[k].sort()
  return out
}

/** The picker's list: the visitor's own zone on top (when it isn't in the list), then each group; `q` filters by name,
 *  id or offset in either language → [{ group, zones: [{ id, label, offset }] }] */
export function zoneOptions({ lang = 'he', q = '', mine = deviceTz(), at = new Date() } = {}) {
  const needle = q.trim().toLowerCase()
  const row = z => ({ id: z.id, label: lang === 'en' ? z.en : z.he, offset: gmtOffset(z.id, at), other: lang === 'en' ? z.he : z.en })
  const hit = r => !needle || [r.label, r.other, r.id, r.offset].some(s => String(s).toLowerCase().includes(needle))
  const out = []
  if (mine && !ZONES.some(z => z.id === mine)) {
    const r = { id: mine, label: zoneLabel(mine, lang), offset: gmtOffset(mine, at), other: mine }
    if (hit(r)) out.push({ group: GROUPS[0], zones: [r] })
  }
  for (const g of GROUPS.slice(1)) {
    const zones = ZONES.filter(z => z.g === g.id).map(row).filter(hit)
    if (zones.length) out.push({ group: g, zones })
  }
  return out
}
