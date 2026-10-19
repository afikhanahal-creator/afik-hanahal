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
    waClient: 'אישור בוואטסאפ ללקוח', waOk: 'נשלח', waQuota: 'לא נשלח: מכסת Green API נגמרה (שדרוג בחשבון Green API)', waFail: 'לא נשלח',
    mailClient: 'אישור במייל ללקוח', mailOk: 'נשלח', mailNone: 'הלקוח לא השאיר אימייל',
    openAdmin: 'פתיחה בפאנל הניהול', call: 'התקשרות', wa: 'וואטסאפ', ref: 'מקור',
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

const button = (href, text, primary) => `<a href="${esc(href)}" style="display:inline-block;margin:0 0 8px;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;${primary ? `background:${BRAND};color:#FFFFFF;border:1px solid ${BRAND}` : `background:#FFFFFF;color:${BRAND};border:1px solid ${BRAND}`}">${esc(text)}</a>`

function layout({ lang, preheader, title, intro, rows, buttons = [], note = '', after = '', client = true }) {
  const dir = lang === 'en' ? 'ltr' : 'rtl', align = lang === 'en' ? 'left' : 'right'
  const t = T[lang] || T.he
  const rowHtml = rows.map(([k, v, strong, html]) => `<tr>
      <td style="padding:12px 0;border-top:1px solid ${LINE};width:34%;vertical-align:top;color:${MUTE};font-size:13px">${esc(k)}</td>
      <td style="padding:12px 0;border-top:1px solid ${LINE};vertical-align:top;color:${INK};font-size:${strong ? 16 : 14}px;font-weight:${strong ? 700 : 400};line-height:1.6;white-space:pre-line">${html ? v : esc(v)}</td>
    </tr>`).join('')
  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:Rubik,Heebo,Arial,Helvetica,sans-serif;color:${INK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG}"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid ${LINE};border-radius:12px" dir="${dir}">
    <tr><td style="padding:22px 28px;border-bottom:3px solid ${BRAND};text-align:${align}">
      <div style="font-size:18px;font-weight:700;color:${INK};letter-spacing:.2px">${lang === 'en' ? 'Afik Hanahal' : 'אפיק הנחל'}</div>
      <div style="font-size:12px;color:${MUTE};margin-top:2px">${lang === 'en' ? 'Development · Marketing · Brokerage' : 'ייזום · שיווק · תיווך'}</div>
    </td></tr>
    <tr><td style="padding:28px 28px 8px;text-align:${align}">
      <h1 style="margin:0 0 10px;font-size:22px;line-height:1.35;color:${INK};font-weight:700">${esc(title)}</h1>
      ${intro ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:${INK}">${intro}</p>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ${LINE}">${rowHtml}</table>
      ${note ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:${MUTE}">${note}</p>` : ''}
      ${buttons.length ? `<div style="margin:20px 0 4px">${buttons.join('&nbsp;&nbsp;')}</div>` : ''}
      ${after}
    </td></tr>
    <tr><td style="padding:18px 28px 24px;text-align:${align};font-size:12px;line-height:1.8;color:${MUTE};border-top:1px solid ${LINE}">
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
  const t = T[lang]
  const name = String(b.name || '').trim().split(/\s+/)[0]
  const title = t[kind]
  const manage = manageUrl(b, lang)
  const cal = googleCalendarLink(b, { title: `${typeName(b, lang)} · ${lang === 'en' ? 'Afik Hanahal' : 'אפיק הנחל'}`, details: manage ? `${t.manage}: ${manage}` : '', location: b.meetLink || (b.channel === 'phone' ? localPhone(b.phone) : '') })
  const intro = `${esc(t.hello(name))}<br>${esc(kind === 'moved' ? t.introMoved : kind === 'cancelled' ? t.introCancelled : t.introCreated)}`
  const buttons = kind === 'cancelled'
    ? [button(`${SITE}/book${lang === 'en' ? '?lang=en' : ''}`, t.rebook, true)]
    : [manage && button(manage, t.manage, true), b.eventId && b.email ? '' : button(cal, t.addCal, false), manage && button(`${manage}&do=cancel`, t.cancel, false)].filter(Boolean)
  const after = `<p style="margin:18px 0 0;font-size:14px;line-height:1.7;color:${INK}">${esc(t.contact)} <a href="tel:${esc(OFFICE.tel)}" style="color:${BRAND}" dir="ltr">${esc(OFFICE.phone)}</a> · <a href="https://wa.me/${esc(OFFICE.whatsapp)}" style="color:${BRAND}">WhatsApp</a><br>${esc(t.sign)}</p>`
  const html = layout({
    lang, title, intro, after, buttons,
    preheader: `${typeName(b, lang)} · ${whenLine(b, lang)}`,
    rows: detailRows(b, lang, { previous }),
    note: kind === 'cancelled' ? '' : esc(t.manageNote),
  })
  const subject = `${title}: ${typeName(b, lang)} · ${dateText(b.start, lang)} ${timeText(b.start)}`
  const text = [t.hello(name), '', title, `${t.when}: ${whenLine(b, lang)}`, `${t.type}: ${typeName(b, lang)}`, manage && kind !== 'cancelled' ? `${t.manage}: ${manage}` : '', '', t.sign].filter(x => x !== false && x !== undefined).join('\n')
  return { subject, html, text }
}

/** The office's email (always Hebrew). state: { calendar, leadNew, wa: { ok, quota }, mail: { ok } | null, ref } */
export function officeEmail(kind, b, state = {}, { previous } = {}) {
  const t = T.he
  const title = kind === 'moved' ? t.officeMoved : kind === 'cancelled' ? t.officeCancelled : t.officeCreated
  const calendar = state.calendar === 'connected' || b.eventId ? t.calOn : state.calendar === 'error' ? t.calErr : t.calOff
  const wa = state.wa ? (state.wa.ok ? t.waOk : state.wa.quota ? t.waQuota : t.waFail) : ''
  const mail = b.email ? (state.mail?.ok ? t.mailOk : t.waFail) : t.mailNone
  const rows = [
    ...detailRows(b, 'he', { office: true, previous }),
    [t.calendar, calendar],
    state.leadNew !== undefined ? [t.crm, state.leadNew ? t.crmNew : t.crmOld] : null,
    wa ? [t.waClient, wa] : null,
    kind !== 'cancelled' ? [t.mailClient, mail] : null,
    b.ref ? [t.ref, b.ref] : null,
  ].filter(Boolean)
  const tel = localPhone(b.phone).replace(/\D/g, '')
  const html = layout({
    lang: 'he', title, rows, client: false,
    preheader: `${b.name} · ${whenLine(b, 'he')}`,
    intro: '',
    buttons: [button(`${SITE}/admin-panel/bookings`, t.openAdmin, true), button(`tel:${tel}`, t.call, false), button(`https://wa.me/972${tel.slice(1)}`, t.wa, false)],
  })
  const subject = `${title}: ${b.name} · ${dateText(b.start, 'he')} ${timeText(b.start)}`
  return { subject, html }
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
