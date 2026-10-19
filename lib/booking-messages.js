// Booking messages: the emails (office + client) and the WhatsApp texts for a booking that was made, moved or cancelled.
// Pure (tested in lib/booking-messages.test.mjs). The emails are formal and table-based (Gmail / Outlook safe, inline
// styles, no emoji, no images); the WhatsApp texts follow the templates' voice (plural "we", short lines, no emoji).
import { readFileSync } from 'fs'
import { CHANNELS, SITE, manageUrl, googleCalendarLink, TZ } from './booking.js'

let OFFICE = { phone: '055-981-1814', tel: '0559811814', whatsapp: '972559811814', email: 'afik.hanahal@gmail.com' }
try { OFFICE = { ...OFFICE, ...JSON.parse(readFileSync(new URL('../content/home.json', import.meta.url), 'utf8')).office } } catch {}
export { OFFICE }

const BRAND = '#3F4EB0', INK = '#17172B', MUTE = '#5E5B6E', LINE = '#E6E1D6', BG = '#F5F1E9'
const ORG = { he: 'אפיק הנחל - ייזום שיווק ותיווך', en: 'Afik Hanahal - Development, Marketing & Brokerage' }

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const loc = lang => (lang === 'en' ? 'en-GB' : 'he-IL')
export const dateText = (iso, lang) => new Date(iso).toLocaleDateString(loc(lang), { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const timeText = iso => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
export const rangeText = b => `${timeText(b.start)}–${timeText(b.end)}`
const whenLine = (b, lang) => `${dateText(b.start, lang)}, ${rangeText(b)}`
// in an RTL email the time range keeps its order ("12:30–13:00", not "13:00–12:30")
const whenHtml = (b, lang) => `${esc(dateText(b.start, lang))}, <span dir="ltr" style="white-space:nowrap">${rangeText(b)}</span>`
const typeName = (b, lang) => (lang === 'en' ? b.type?.en || b.typeEn || 'Meeting' : b.type?.he || b.typeName || 'פגישה')
const minutesOf = b => b.type?.minutes || Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60e3)
const localPhone = p => { const d = String(p || '').replace(/\D/g, ''); const l = d.startsWith('972') ? '0' + d.slice(3) : d; return l.length === 10 ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l }

const T = {
  he: {
    created: 'השיחה נקבעה', moved: 'מועד השיחה עודכן', cancelled: 'השיחה בוטלה',
    officeCreated: 'פגישה חדשה נקבעה דרך האתר', officeMoved: 'הלקוח שינה את מועד הפגישה', officeCancelled: 'הלקוח ביטל את הפגישה',
    hello: n => (n ? `שלום ${n},` : 'שלום,'),
    introCreated: 'תודה שקבעתם איתנו שיחה. ריכזנו כאן את כל הפרטים.',
    introMoved: 'עדכנו את מועד השיחה לפי בקשתכם. אלה הפרטים המעודכנים.',
    introCancelled: 'השיחה בוטלה לפי בקשתכם. נשמח לקבוע מועד אחר בכל זמן.',
    when: 'מועד', was: 'המועד הקודם', type: 'סוג הפגישה', length: 'משך', min: n => `${n} דקות`, how: 'אופן השיחה',
    name: 'שם', phone: 'טלפון', email: 'אימייל', notes: 'נושא השיחה', link: 'קישור לשיחה',
    phoneHow: p => `אנחנו מתקשרים אליכם למספר ${p}`, video: 'שיחת וידאו',
    manage: 'שינוי מועד', cancel: 'ביטול השיחה', addCal: 'הוספה ליומן Google', rebook: 'קביעת מועד חדש',
    manageNote: 'צריכים להזיז את השיחה? אפשר לבחור שעה אחרת או לבטל בלחיצה, עד תחילת השיחה.',
    contact: 'לכל שאלה:', sign: 'צוות אפיק הנחל',
    footer: 'קיבלתם את ההודעה כי קבעתם שיחה באתר אפיק הנחל.',
    // office
    status: 'מצב', calendar: 'יומן Google', calOn: 'נוסף ליומן', calOff: 'היומן לא מחובר. יש להוסיף את הפגישה ליומן ידנית ולאשר ללקוח.',
    calErr: 'ההוספה ליומן נכשלה. יש להוסיף ידנית.', crm: 'CRM', crmNew: 'ליד חדש נוסף', crmOld: 'ליד קיים עודכן',
    waClient: 'וואטסאפ ללקוח', waOk: 'נשלח', waQuota: 'לא נשלח: מכסת Green API נגמרה', waFail: 'לא נשלח',
    mailClient: 'מייל ללקוח', mailOk: 'נשלח', mailNone: 'הלקוח לא השאיר אימייל',
    openAdmin: 'פתיחה בפאנל', call: 'התקשרות ללקוח', wa: 'וואטסאפ', ref: 'מקור / קמפיין',
    needs: 'מה מחפשים', wrote: 'מה הלקוח כתב', leadH: 'פרטי הליד', callH: 'פרטי השיחה', statusH: 'מצב', stNew: 'פגישה חדשה',
    stBooked: 'מאושרת', stMoved: 'מועד מעודכן', stCancelled: 'בוטלה', detailsH: 'פרטי השיחה', nextH: 'מה הלאה',
    next: (b, how) => [b.channel === 'phone' ? `${how}, בשעה שנקבעה.` : `${how}. הקישור לשיחה נמצא למעלה ובהזמנה ליומן.`, 'כדאי להכין: מה אתם מחפשים, אזורים מועדפים, תקציב משוער ולוח זמנים.', 'צריכים להזיז? לחיצה על "שינוי מועד" ובוחרים שעה אחרת.'],
  },
  en: {
    created: 'Your call is booked', moved: 'Your call has been rescheduled', cancelled: 'Your call has been cancelled',
    hello: n => (n ? `Hello ${n},` : 'Hello,'),
    introCreated: 'Thank you for booking a call with us. Here are all the details.',
    introMoved: 'We have moved your call as requested. Here are the updated details.',
    introCancelled: 'Your call has been cancelled as requested. You are welcome to book another time whenever it suits you.',
    when: 'When', was: 'Previous time', type: 'Meeting', length: 'Length', min: n => `${n} minutes`, how: 'How we talk',
    name: 'Name', phone: 'Phone', email: 'Email', notes: 'Topic', link: 'Call link',
    phoneHow: p => `We will call you on ${p}`, video: 'Video call',
    manage: 'Reschedule', cancel: 'Cancel the call', addCal: 'Add to Google Calendar', rebook: 'Book a new time',
    manageNote: 'Need to move it? You can pick another time or cancel with one click, up until the call starts.',
    contact: 'Questions? Call us on', sign: 'The Afik Hanahal team',
    stBooked: 'Confirmed', stMoved: 'Rescheduled', stCancelled: 'Cancelled', detailsH: 'CALL DETAILS', nextH: 'WHAT HAPPENS NEXT',
    next: (b, how) => [b.channel === 'phone' ? `${how} at the booked time.` : `${how}. The call link is above and in the calendar invitation.`, 'Worth preparing: what you are looking for, preferred areas, an approximate budget and your timing.', 'Need to move it? Press "Reschedule" and pick another time.'],
    footer: 'You are receiving this because you booked a call on the Afik Hanahal website.',
  },
}

/** Label / value rows of a booking (shared by both emails) */
function detailRows(b, lang, { office = false, previous } = {}) {
  const t = T[lang]
  const ch = b.channel === 'phone' ? (office ? CHANNELS.phone.he : t.phoneHow(localPhone(b.phone))) : `${t.video} · ${CHANNELS[b.channel]?.[lang] || b.channel}`
  return [
    [t.when, whenHtml(b, lang), true, true],
    previous ? [t.was, whenHtml(previous, lang), false, true] : null,
    [t.type, typeName(b, lang)],
    [t.length, t.min(minutesOf(b))],
    [t.how, ch],
    b.meetLink ? [t.link, `<a href="${esc(b.meetLink)}" style="color:${BRAND}">${esc(b.meetLink.replace(/^https:\/\//, ''))}</a>`, false, true] : null,
    b.channel === 'zoom' && b.zoomUrl ? [t.link, `<a href="${esc(b.zoomUrl)}" style="color:${BRAND}">Zoom</a>`, false, true] : null,
    [t.name, b.name],
    [t.phone, `<span dir="ltr">${esc(localPhone(b.phone))}</span>`, false, true],
    b.email ? [t.email, `<span dir="ltr">${esc(b.email)}</span>`, false, true] : null,
    b.notes ? [t.notes, b.notes] : null,
  ].filter(Boolean)
}

const button = (href, text, kind = 'pri') => {
  const st = kind === 'pri' ? `background:${BRAND};color:#FFFFFF;border:1px solid ${BRAND}` : kind === 'danger' ? `background:#FFFFFF;color:#B3261E;border:1px solid #E7C2BF` : `background:#FFFFFF;color:${BRAND};border:1px solid #C9CDEB`
  return `<a href="${esc(href)}" style="display:inline-block;margin:0 0 8px;padding:12px 20px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;${st}">${esc(text)}</a>`
}
const NAVY = '#1B1D3A', OK = '#1E7A4C', WARN = '#9A5B00', BAD = '#B3261E'
const pill = (text, color) => `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;color:${color};background:${color}14;border:1px solid ${color}33">${esc(text)}</span>`
const sectionTitle = (text, align) => `<div style="margin:26px 0 8px;font-size:12px;font-weight:700;letter-spacing:.06em;color:${MUTE};text-align:${align}">${esc(text)}</div>`
const relDay = (iso, lang) => {
  const d = x => new Date(x).toLocaleDateString('en-CA', { timeZone: TZ })
  const n = Math.round((Date.parse(d(iso)) - Date.parse(d(Date.now()))) / 864e5)
  return n === 0 ? (lang === 'en' ? 'Today' : 'היום') : n === 1 ? (lang === 'en' ? 'Tomorrow' : 'מחר') : ''
}
// a bordered card with a small title; rows inside are compact label / value pairs
const card = (title, inner, align, { tint = false } = {}) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:14px;background:${tint ? BG : '#FFFFFF'}"><tr><td style="padding:14px 18px 10px;text-align:${align}">
    ${title ? `<div style="margin:0 0 4px;font-size:11.5px;font-weight:700;letter-spacing:.06em;color:${MUTE}">${esc(title)}</div>` : ''}${inner}</td></tr></table>`
const kv = (rows, align) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.map(([k, v, strong, html], i) => `<tr>
      <td style="padding:7px 0;${i ? `border-top:1px solid ${LINE};` : ''}width:34%;vertical-align:top;color:${MUTE};font-size:12.5px;line-height:1.5;text-align:${align}">${esc(k)}</td>
      <td style="padding:7px 0;${i ? `border-top:1px solid ${LINE};` : ''}vertical-align:top;color:${INK};font-size:${strong ? 15 : 14}px;font-weight:${strong ? 700 : 400};line-height:1.5;white-space:pre-line;text-align:${align}">${html ? v : esc(v)}</td>
    </tr>`).join('')}</table>`
// two columns side by side (stacked on phones by the .col rule in the layout's <style>)
const twoCol = (a, b, lang, first = '56%') => {
  const s = lang === 'en' ? 'left' : 'right', e = lang === 'en' ? 'right' : 'left'
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${lang === 'en' ? 'ltr' : 'rtl'}" style="margin:14px 0 0"><tr>
    <td class="col" width="${first}" style="width:${first};vertical-align:top;padding-${e}:8px">${a}</td>
    <td class="col" style="vertical-align:top;padding-${s}:8px">${b}</td></tr></table>`
}
const stack = btns => btns.map(x => x.replace('display:inline-block;margin:0 0 8px', 'display:block;text-align:center;margin:0 0 8px')).join('')
const table = (rows, align) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ${LINE}">${rows.map(([k, v, strong, html]) => `<tr>
      <td style="padding:11px 0;border-top:1px solid ${LINE};width:32%;vertical-align:top;color:${MUTE};font-size:13px;text-align:${align}">${esc(k)}</td>
      <td style="padding:11px 0;border-top:1px solid ${LINE};vertical-align:top;color:${INK};font-size:${strong ? 15 : 14}px;font-weight:${strong ? 700 : 400};line-height:1.6;white-space:pre-line;text-align:${align}">${html ? v : esc(v)}</td>
    </tr>`).join('')}</table>`

// The date card: a calendar tile + the day, the time range, how we talk
function dateCard(b, lang, { cancelled = false, sub = '' } = {}) {
  const align = lang === 'en' ? 'left' : 'right'
  const month = new Date(b.start).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: TZ, month: 'short' })
  const day = new Date(b.start).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric' })
  const weekday = new Date(b.start).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const rel = cancelled ? '' : relDay(b.start, lang)
  const tile = `<td width="76" style="width:76px;vertical-align:top"><table role="presentation" width="76" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:12px;overflow:hidden;background:#FFFFFF">
      <tr><td align="center" style="background:${cancelled ? MUTE : BRAND};color:#FFFFFF;font-size:12px;font-weight:700;padding:5px 0">${esc(month)}</td></tr>
      <tr><td align="center" style="font-size:30px;font-weight:700;color:${INK};padding:6px 0 7px;line-height:1.2">${esc(day)}</td></tr></table></td>`
  const text = `<td style="vertical-align:middle;padding-${lang === 'en' ? 'left' : 'right'}:16px;text-align:${align}">
      <div style="font-size:18px;font-weight:700;color:${INK};line-height:1.35;${cancelled ? 'text-decoration:line-through;color:' + MUTE + ';' : ''}">${esc(weekday)}</div>
      <div style="font-size:15px;color:${INK};margin-top:3px"><span dir="ltr" style="white-space:nowrap;font-weight:600">${rangeText(b)}</span>${rel ? ` · <b style="color:${BRAND}">${esc(rel)}</b>` : ''} <span style="color:${MUTE};font-size:13px">· ${lang === 'en' ? 'Israel time' : 'שעון ישראל'}</span></div>
      ${sub ? `<div style="font-size:14px;color:${MUTE};margin-top:4px">${sub}</div>` : ''}
    </td>`
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0;background:${BG};border-radius:14px"><tr><td style="padding:16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${lang === 'en' ? 'ltr' : 'rtl'}"><tr>${tile}${text}</tr></table></td></tr></table>`
}

function layout({ lang, preheader, title, status, intro = '', body, client = true }) {
  const dir = lang === 'en' ? 'ltr' : 'rtl', align = lang === 'en' ? 'left' : 'right'
  const t = T[lang] || T.he
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title>
<style>@media (max-width:640px){.col{display:block!important;width:100%!important;padding:0 0 12px!important}.pad{padding-left:18px!important;padding-right:18px!important}}</style></head>
<body style="margin:0;padding:0;background:${BG};font-family:Rubik,Heebo,Arial,Helvetica,sans-serif;color:${INK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;background:#FFFFFF;border:1px solid ${LINE};border-radius:16px;overflow:hidden" dir="${dir}">
    <tr><td class="pad" style="background:${NAVY};padding:16px 32px;text-align:${align}">
      <table role="presentation" cellpadding="0" cellspacing="0" dir="${dir}"><tr>
        <td style="vertical-align:middle"><img src="${SITE}/img/icon-192.png" width="40" height="40" alt="" style="display:block;border-radius:50%;background:#FFFFFF"></td>
        <td style="vertical-align:middle;padding-${lang === 'en' ? 'left' : 'right'}:12px">
          <div style="font-size:17px;font-weight:700;color:#FFFFFF">${lang === 'en' ? 'Afik Hanahal' : 'אפיק הנחל'}</div>
          <div style="font-size:12px;color:#B9BCE0;margin-top:1px">${lang === 'en' ? 'Development · Marketing · Brokerage' : 'ייזום · שיווק · תיווך'}</div>
        </td></tr></table>
    </td></tr>
    <tr><td class="pad" style="padding:24px 32px 22px;text-align:${align}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}"><tr>
        <td style="vertical-align:middle;text-align:${align}"><h1 style="margin:0;font-size:22px;line-height:1.35;color:${INK};font-weight:700">${esc(title)}</h1></td>
        ${status ? `<td style="vertical-align:middle;text-align:${lang === 'en' ? 'right' : 'left'};white-space:nowrap;padding-${lang === 'en' ? 'left' : 'right'}:12px">${status}</td>` : ''}
      </tr></table>
      ${intro ? `<p style="margin:8px 0 0;font-size:15px;line-height:1.7;color:${INK}">${intro}</p>` : ''}
      ${body}
    </td></tr>
    <tr><td class="pad" style="padding:16px 32px 20px;text-align:${align};font-size:12px;line-height:1.8;color:${MUTE};border-top:1px solid ${LINE}">
      ${esc(ORG[lang] || ORG.he)} · <a href="${SITE}" style="color:${MUTE}">afikhanahal.co.il</a> · <span dir="ltr" style="white-space:nowrap">${esc(OFFICE.phone)}</span>${client && t.footer ? `<br>${esc(t.footer)}` : ''}
    </td></tr>
  </table>
</td></tr></table></body></html>`
}

/**
 * The client's email. kind: 'created' | 'moved' | 'cancelled'. entry = the booking log entry (id, token, start, end, …),
 * b = the same with `type` as an object ({ he, en, minutes }). → { subject, html, text }
 */
export function clientEmail(kind, b, { previous } = {}) {
  const lang = b.lang === 'en' ? 'en' : 'he'
  const align = lang === 'en' ? 'left' : 'right'
  const t = T[lang]
  const name = String(b.name || '').trim().split(/\s+/)[0]
  const title = t[kind]
  const manage = manageUrl(b, lang)
  const cal = googleCalendarLink(b, { title: `${typeName(b, lang)} · ${lang === 'en' ? 'Afik Hanahal' : 'אפיק הנחל'}`, details: manage ? `${t.manage}: ${manage}` : '', location: b.meetLink || (b.channel === 'phone' ? localPhone(b.phone) : '') })
  const intro = `${esc(t.hello(name))}<br>${esc(kind === 'moved' ? t.introMoved : kind === 'cancelled' ? t.introCancelled : t.introCreated)}`
  const how = b.channel === 'phone' ? t.phoneHow(localPhone(b.phone)) : `${t.video} · ${CHANNELS[b.channel]?.[lang] || b.channel}`
  const buttons = kind === 'cancelled'
    ? [button(`${SITE}/book${lang === 'en' ? '?lang=en' : ''}`, t.rebook)]
    : [manage && button(manage, t.manage), b.eventId && b.email ? '' : button(cal, t.addCal, 'sec'), manage && button(`${manage}&do=cancel`, t.cancel, 'danger')].filter(Boolean)
  const statusPill = kind === 'cancelled' ? pill(t.stCancelled, BAD) : kind === 'moved' ? pill(t.stMoved, BRAND) : pill(t.stBooked, OK)
  const next = kind === 'cancelled' ? '' : card(t.nextH, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${t.next(b, how).map((x, i) => `<tr>
      <td width="30" style="width:30px;vertical-align:top;padding:6px 0"><div style="width:22px;height:22px;border-radius:50%;background:${BRAND};color:#FFFFFF;font-size:12px;font-weight:700;text-align:center;line-height:22px">${i + 1}</div></td>
      <td style="vertical-align:top;padding:6px 0;font-size:14px;line-height:1.55;color:${INK};text-align:${align}">${esc(x).replace(/(0\d{1,2}-\d{3}-\d{4})/g, '<span dir="ltr" style="white-space:nowrap">$1</span>')}</td></tr>`).join('')}</table>`, align)
  const dateBlock = dateCard(b, lang, { cancelled: kind === 'cancelled', sub: esc(how) })
    + (previous ? `<p style="margin:8px 0 0;font-size:13px;color:${MUTE}">${esc(t.was)}: <span style="text-decoration:line-through">${whenHtml(previous, lang)}</span></p>` : '')
  const actions = stack(buttons) + (kind === 'cancelled' ? '' : `<p style="margin:2px 0 0;font-size:12.5px;line-height:1.6;color:${MUTE};text-align:center">${esc(t.manageNote)}</p>`)
  const details = card(t.detailsH, kv(detailRows(b, lang, { previous }).filter(r => ![t.when, t.was, t.how].includes(r[0])), align), align)
  const body = [
    twoCol(dateBlock, actions, lang, '60%'),
    next ? twoCol(details, next, lang, '52%') : `<div style="margin:14px 0 0">${details}</div>`,
    `<p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:${INK}">${esc(t.contact)} <a href="tel:${esc(OFFICE.tel)}" style="color:${BRAND}" dir="ltr">${esc(OFFICE.phone)}</a> · <a href="https://wa.me/${esc(OFFICE.whatsapp)}" style="color:${BRAND}">WhatsApp</a> · ${esc(t.sign)}</p>`,
  ].join('')
  const html = layout({ lang, title, intro, body, status: statusPill, preheader: `${typeName(b, lang)} · ${whenLine(b, lang)}` })
  const subject = `${title}: ${typeName(b, lang)} · ${dateText(b.start, lang)} ${timeText(b.start)}`
  const text = [t.hello(name), '', title, `${t.when}: ${whenLine(b, lang)}`, `${t.type}: ${typeName(b, lang)}`, `${t.how}: ${how}`, manage && kind !== 'cancelled' ? `${t.manage}: ${manage}` : '', '', t.sign].filter(x => x !== false && x !== undefined).join('\n')
  return { subject, html, text }
}

/** "קנייה · פרדס · פרדס חנה-כרכור · עד 3,000,000 ₪ · 4 חדרים" from notesToNeeds() */
export function needsLine(n = {}) {
  const deal = { buy: 'קנייה', sell: 'מכירה', rent: 'השכרה', invest: 'השקעה' }[n.dealType]
  return [deal, n.propertyType, n.area, n.budget ? `עד ${Number(n.budget).toLocaleString('en-US')} ₪` : '', n.rooms ? `${n.rooms} חדרים` : ''].filter(Boolean).join(' · ')
}

/** The office's email (always Hebrew). state: { calendar, leadNew, wa: { ok, quota }, mail: { ok } | null, needs } */
export function officeEmail(kind, b, state = {}, { previous } = {}) {
  const t = T.he
  const title = kind === 'moved' ? t.officeMoved : kind === 'cancelled' ? t.officeCancelled : t.officeCreated
  const calOk = state.calendar === 'connected' || !!b.eventId
  const calendar = calOk ? [t.calOn, OK] : state.calendar === 'error' ? [t.calErr, BAD] : [t.calOff, WARN]
  const wa = state.wa ? (state.wa.ok ? [t.waOk, OK] : state.wa.quota ? [t.waQuota, BAD] : [t.waFail, BAD]) : null
  const mail = kind === 'cancelled' ? null : b.email ? (state.mail?.ok ? [t.mailOk, OK] : [t.waFail, BAD]) : [t.mailNone, MUTE]
  const dot = ([text, color]) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-inline-end:6px;vertical-align:middle"></span><span style="color:${color === MUTE ? MUTE : INK}">${esc(text)}</span>`
  const status = [
    [t.calendar, dot(calendar), false, true],
    state.leadNew !== undefined ? [t.crm, dot([state.leadNew ? t.crmNew : t.crmOld, OK]), false, true] : null,
    wa ? [t.waClient, dot(wa), false, true] : null,
    mail ? [t.mailClient, dot(mail), false, true] : null,
  ].filter(Boolean)
  const tel = localPhone(b.phone).replace(/\D/g, '')
  const needs = needsLine(state.needs)
  const lead = [
    [t.name, b.name, true],
    [t.phone, `<a href="tel:${tel}" dir="ltr" style="color:${BRAND};font-weight:600">${esc(localPhone(b.phone))}</a>`, false, true],
    b.email ? [t.email, `<a href="mailto:${esc(b.email)}" dir="ltr" style="color:${BRAND}">${esc(b.email)}</a>`, false, true] : null,
    needs ? [t.needs, needs] : null,
    b.ref ? [t.ref, b.ref] : null,
  ].filter(Boolean)
  const call = [
    [t.type, typeName(b, 'he')],
    [t.length, t.min(minutesOf(b))],
    [t.how, CHANNELS[b.channel]?.he || b.channel],
    b.meetLink ? [t.link, `<a href="${esc(b.meetLink)}" style="color:${BRAND}">${esc(b.meetLink.replace(/^https:\/\//, ''))}</a>`, false, true] : null,
  ].filter(Boolean)
  const dateBlock = dateCard(b, 'he', { cancelled: kind === 'cancelled', sub: esc([typeName(b, 'he'), t.min(minutesOf(b)), CHANNELS[b.channel]?.he || b.channel].join(' · ')) })
    + (previous ? `<p style="margin:8px 0 0;font-size:13px;color:${MUTE}">${esc(t.was)}: <span style="text-decoration:line-through">${whenHtml(previous, 'he')}</span></p>` : '')
  const actions = stack([button(`tel:${tel}`, t.call), button(`https://wa.me/972${tel.slice(1)}`, t.wa, 'sec'), button(`${SITE}/admin-panel/bookings`, t.openAdmin, 'sec')])
  const body = [
    twoCol(dateBlock, actions, 'he', '62%'),
    b.notes ? `<div style="margin:14px 0 0">${card(t.wrote, `<div style="font-size:15px;line-height:1.65;color:${INK};white-space:pre-line;padding:2px 0 6px">${esc(b.notes)}</div>`, 'right', { tint: true })}</div>` : '',
    twoCol(card(t.leadH, kv(lead, 'right'), 'right'), card(t.statusH, kv([...call.filter(r => r[0] === t.link), ...status], 'right'), 'right'), 'he', '52%'),
  ].join('')
  const statusPill = kind === 'cancelled' ? pill(t.stCancelled, BAD) : kind === 'moved' ? pill(t.stMoved, BRAND) : pill(t.stNew, OK)
  const html = layout({ lang: 'he', title, body, status: statusPill, client: false, preheader: `${b.name} · ${whenLine(b, 'he')}` })
  const subject = `${title}: ${b.name} · ${dateText(b.start, 'he')} ${timeText(b.start)}`
  const text = [title, `${typeName(b, 'he')}: ${whenLine(b, 'he')}`, `${b.name} · ${localPhone(b.phone)}${b.email ? ` · ${b.email}` : ''}`, b.notes ? `${t.notes}: ${b.notes}` : '', `${SITE}/admin-panel/bookings`].filter(Boolean).join('\n')
  return { subject, html, text }
}

/** The office's WhatsApp alert (formal, no emoji) */
export function officeText(kind, b, state = {}, { previous } = {}) {
  const t = T.he
  const head = kind === 'moved' ? t.officeMoved : kind === 'cancelled' ? t.officeCancelled : t.officeCreated
  const cal = state.calendar === 'connected' || b.eventId ? t.calOn : state.calendar === 'error' ? t.calErr : t.calOff
  return [
    `*${head}*`,
    `${typeName(b, 'he')}: ${whenLine(b, 'he')}`,
    previous ? `${t.was}: ${whenLine(previous, 'he')}` : '',
    `${b.name} · ${localPhone(b.phone)}${b.email ? ` · ${b.email}` : ''}`,
    `${t.how}: ${CHANNELS[b.channel]?.he || b.channel}${b.meetLink ? ` · ${b.meetLink}` : ''}`,
    b.notes ? `${t.notes}: ${String(b.notes).slice(0, 300)}` : '',
    kind === 'cancelled' ? '' : `${t.calendar}: ${cal}`,
    state.leadNew !== undefined ? `${t.crm}: ${state.leadNew ? t.crmNew : t.crmOld}` : '',
  ].filter(Boolean).join('\n')
}

/** The client's WhatsApp (plural voice, the private link to move / cancel) */
export function clientText(kind, b, { firstName = '', zoomUrl = '' } = {}) {
  const en = b.lang === 'en'
  const name = firstName
  const type = typeName(b, en ? 'en' : 'he')
  const day = new Date(b.start).toLocaleDateString(en ? 'en-GB' : 'he-IL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })
  const when = `${day} ${en ? 'at' : 'בשעה'} ${timeText(b.start)}`
  const manage = manageUrl(b)
  if (kind === 'cancelled') {
    return en
      ? `Hi${name ? ` ${name}` : ''}, it's Afik Hanahal.\nYour ${type.toLowerCase()} on ${when} is cancelled.\nTo book another time: ${SITE}/book?lang=en`
      : `היי${name ? ` ${name}` : ''}, כאן אפיק הנחל.\n${type} שנקבעה ל${when} בוטלה.\nלקביעת מועד אחר: ${SITE}/book`
  }
  const how = b.channel === 'meet'
    ? (b.meetLink ? (en ? `Google Meet link: ${b.meetLink}` : `הקישור לגוגל מיט: ${b.meetLink}`) : (en ? 'The Google Meet link is in the invitation we emailed you.' : 'הקישור לשיחה נמצא בהזמנה ששלחנו לכם במייל.'))
    : b.channel === 'zoom' ? (en ? `Zoom link: ${zoomUrl}` : `הקישור לזום: ${zoomUrl}`)
    : (en ? `We'll call you on ${localPhone(b.phone)}.` : `נתקשר אליכם למספר ${localPhone(b.phone)}.`)
  const head = kind === 'moved'
    ? (en ? `We've moved your ${type.toLowerCase()} to ${when}.` : `עדכנו את המועד: ${type} ל${when}.`)
    : (en ? `Your ${type.toLowerCase()} with us is booked for ${when}.` : `קבענו ${type} ל${when}.`)
  const link = manage ? (en ? `Need to move or cancel it? ${manage}` : `צריכים להזיז או לבטל? ${manage}`) : (en ? 'If anything changes, just message us here.' : 'אם משהו משתנה, אפשר לכתוב לנו כאן.')
  return en
    ? `Hi${name ? ` ${name}` : ''}, it's Afik Hanahal.\n${head}\n${how}\n${link}`
    : `היי${name ? ` ${name}` : ''}, כאן אפיק הנחל.\n${head}\n${how}\n${link}`
}
