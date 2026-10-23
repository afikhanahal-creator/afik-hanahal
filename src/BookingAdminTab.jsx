// Admin → "תיאום פגישות": the booking page (/book) — the meetings booked through it (the client's private link, a resend of
// a confirmation Green API refused, move / cancel), its link, the Google Calendar connection, office hours and rules.
// Apple-like grouped lists: switches for the days, time pills, steppers, a segmented duration, a save bar when dirty.
// API: /api/meta/booking-* (lib/booking-server.js).
import { useEffect, useMemo, useState } from 'react'
import { T } from './automationsUI.jsx'
import { autoApi } from './AutomationsApi.jsx'

const SITE = 'https://www.afikhanahal.co.il'
const TZ = 'Asia/Jerusalem'
const HALF_HOURS = Array.from({ length: 33 }, (_, i) => 6 + i * 0.5)   // 06:00 … 22:00
const hh = h => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`
const DURATIONS = [15, 20, 30, 45, 60, 90]
const CH_KEYS = ['phone', 'meet', 'zoom']

const TR = {
  he: {
    title: 'תיאום פגישות', sub: 'עמוד קביעת שיחות ביומן המשרד, במקום קלנדלי',
    link: 'הקישור לקביעת שיחה', linkSub: 'לשליחה בוואטסאפ, במייל או במודעה. בתבניות: {bookingLink}', copy: 'העתקה', copied: 'הועתק', open: 'פתיחה', linkEn: 'English',
    kUpcoming: 'שיחות קרובות', kWeek: 'השבוע', kWa: 'אישור לא נשלח', kCal: 'יומן Google',
    cal: 'יומן Google', calOn: 'מחובר', calOff: 'לא מחובר', calErr: 'צריך לחבר מחדש',
    calOnSub: 'שיחות נכנסות ליומן, הלקוח מקבל הזמנה, ושעות תפוסות ביומן לא מוצעות.',
    calOffSub: 'בלי יומן מחובר העמוד עובד לפי שעות הפעילות בלבד. המשרד מקבל התראה ומכניס ליומן ידנית.',
    connect: 'חיבור יומן', reconnect: 'חיבור מחדש', disconnect: 'ניתוק', connecting: 'מעביר לגוגל…',
    envMissing: 'כדי לחבר יומן צריך להגדיר ב-Vercel את GOOGLE_OAUTH_CLIENT_ID ו-GOOGLE_OAUTH_CLIENT_SECRET.',
    redirect: 'Redirect URI בגוגל', since: 'מחובר מאז',
    hours: 'שעות פעילות', hoursSub: 'הלקוחות רואים רק שעות בתוך החלון הזה, לפי שעון ישראל', closed: 'סגור', from: 'מ-', to: 'עד',
    typeH: 'סוג השיחה', nameHe: 'שם (עברית)', nameEn: 'שם (אנגלית)', duration: 'משך', min: 'דק׳', channels: 'אופן השיחה',
    chPhone: 'טלפון', chMeet: 'Google Meet', chZoom: 'זום', zoomNeeds: 'זום מוצע רק כשיש קישור זום',
    rules: 'כללים', notice: 'הכי מוקדם', noticeU: 'שעות מראש', horizon: 'אפשר לקבוע עד', horizonU: 'ימים קדימה',
    buffer: 'מרווח סביב פגישות ביומן', perDay: 'מקסימום שיחות ביום', step: 'שיחה מתחילה כל',
    zoom: 'קישור זום אישי', zoomSub: 'לא חובה. כשמוגדר, אפשר להציע גם זום',
    photo: 'תמונה בעמוד', photoSub: 'מופיעה בתחתית הצד של העמוד במחשב, בפרופורציות שלה (בטלפון לא מוצגת). הכי טוב דמות בלי רקע (PNG / WebP שקוף). קישור לתמונה, למשל /img/booking-portrait-2.webp או https://…. ריק = בלי תמונה', photoReset: 'תמונת ברירת המחדל',
    dirty: 'יש שינויים שלא נשמרו', save: 'שמירה', saving: 'שומר…', saved: 'נשמר', discard: 'ביטול השינויים',
    upcoming: 'שיחות קרובות', recent: 'שיחות שעברו (30 יום)', none: 'עוד לא נקבעו שיחות דרך העמוד',
    today: 'היום', tomorrow: 'מחר',
    inCal: 'ביומן', notInCal: 'לא ביומן', waOk: 'אישור וואטסאפ נשלח', waNo: 'אישור וואטסאפ לא נשלח', waQuota: 'וואטסאפ חסום (מכסת Green API)', mailOk: 'אישור במייל נשלח', moved: n => `הוזז ${n === 1 ? 'פעם אחת' : `${n} פעמים`}`,
    cancelledBy: { client: 'בוטלה על ידי הלקוח', office: 'בוטלה על ידי המשרד', calendar: 'נמחקה מהיומן', guest: 'הלקוח דחה את הזימון ביומן' }, cancelled: 'בוטלה',
    clientLink: 'העתקת הקישור של הלקוח', linkCopied: 'הקישור הועתק', move: 'שינוי מועד', resend: 'שליחת האישור שוב', resending: 'שולח…', resent: 'נשלח', cancel: 'ביטול',
    cancelQ: 'לבטל את השיחה? אם יש הזמנה ביומן, הלקוח יקבל הודעת ביטול.', loading: 'טוען…', err: 'שגיאה',
    days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'], dec: 'הפחתה', inc: 'הוספה',
    synced: 'מסונכרן עם היומן', syncing: 'מסנכרן…', refresh: 'רענון מהיומן', cancelledN: n => `בוטלו (${n})`,
    moveBtn: 'הזזה', delBtn: 'מחיקה', copyLinkTip: 'העתקת הקישור האישי של הלקוח', resendShort: 'שליחה שוב',
    st: { cal: 'ביומן Google', noCal: 'לא נכנס ליומן', wa: 'וואטסאפ נשלח ללקוח', waBad: 'הוואטסאפ ללקוח לא יצא', mail: 'מייל נשלח ללקוח', noMail: 'בלי מייל' },
    moveH: name => `הזזת השיחה עם ${name}`, pickDay: 'יום', pickTime: 'שעה פנויה', noSlots: 'אין שעות פנויות בימים הקרובים',
    notifyClient: 'לעדכן את הלקוח (וואטסאפ, מייל והזמנה ביומן)', moveTo: w => `העברה ל${w}`, moving: 'מעביר…', back: 'חזרה', taken: 'השעה הזו כבר נתפסה, בחרו שעה אחרת',
    delQ: (name, w) => `למחוק את השיחה עם ${name} (${w})? היא תימחק גם מיומן Google.`, delNotify: 'מחיקה ועדכון הלקוח', delQuiet: 'מחיקה בלי הודעה', deleting: 'מוחק…',
    guestsBtn: 'משתתפים בזימון', guestsH: name => `משתתפים בזימון לשיחה עם ${name}`, guestsSub: 'כל מי שברשימה מקבל הזמנה ביומן Google. מי שמוסר מהרשימה מקבל הודעת ביטול.',
    guestPh: 'כתובת מייל (אפשר כמה, מופרדות בפסיק)', guestAdd: 'הוספה', guestsSave: 'שמירה ושליחת הזמנות', guestsSaving: 'מעדכן את היומן…', clientChip: 'הלקוח', noClientMail: 'הלקוח לא השאיר מייל',
    openCal: 'פתיחה ביומן Google', guestsN: n => `${n} משתתפים`,
    okMoved: (name, w) => `השיחה עם ${name} הועברה ל${w} ועודכנה ביומן Google ✓`, badMoved: (name, e) => `השיחה עם ${name} הועברה באתר, אבל היומן לא התעדכן: ${e}`,
    okDeleted: name => `השיחה עם ${name} נמחקה, גם מיומן Google ✓`, delCalErr: (name, e) => `השיחה עם ${name} בוטלה, אבל האירוע עוד לא נמחק מיומן Google (${e}). המערכת תנסה שוב כל כמה דקות, ואפשר גם למחוק אותו ביומן ידנית.`, okGuests: n => `עודכן ביומן Google ✓ · ${n} משתתפים קיבלו זימון`,
    gErr: { invalid: b => `כתובות לא תקינות: ${b.join(', ')}`, no_event: 'השיחה לא נמצאת ביומן (היומן לא היה מחובר כשנקבעה)', event_gone: 'האירוע נמחק מיומן Google', not_saved: m => `היומן לא שמר את: ${m.join(', ')}`, no_calendar: 'היומן לא מחובר', cancelled: 'השיחה בוטלה' },
    calErrTip: e => `היומן לא התעדכן: ${e}`, stillInCal: 'עוד ביומן Google, המערכת מוחקת', noEvent: 'לא ביומן',
    testMail: 'מייל לדוגמה', testMailTip: 'שולח למייל המשרד את שני המיילים: מה שהלקוח מקבל ומה שהמשרד מקבל', testSending: 'שולח…', testSent: to => `נשלח ל-${to}`,
  },
  en: {
    title: 'Bookings', sub: 'A page for booking calls in the office calendar, instead of Calendly',
    link: 'Booking link', linkSub: 'Send it on WhatsApp, by email or in an ad. In templates: {bookingLink}', copy: 'Copy', copied: 'Copied', open: 'Open', linkEn: 'English',
    kUpcoming: 'Upcoming calls', kWeek: 'This week', kWa: 'Confirmation not sent', kCal: 'Google Calendar',
    cal: 'Google Calendar', calOn: 'Connected', calOff: 'Not connected', calErr: 'Needs reconnecting',
    calOnSub: 'Calls go into the calendar, the client gets an invitation, and busy times are not offered.',
    calOffSub: 'Without a calendar the page works from office hours only. The office is alerted and adds the call by hand.',
    connect: 'Connect calendar', reconnect: 'Reconnect', disconnect: 'Disconnect', connecting: 'Opening Google…',
    envMissing: 'To connect a calendar, set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in Vercel.',
    redirect: 'Redirect URI in Google', since: 'Connected since',
    hours: 'Office hours', hoursSub: 'Clients only see times inside this window, in Israel time', closed: 'Closed', from: 'from', to: 'to',
    typeH: 'Call type', nameHe: 'Name (Hebrew)', nameEn: 'Name (English)', duration: 'Length', min: 'min', channels: 'How we talk',
    chPhone: 'Phone', chMeet: 'Google Meet', chZoom: 'Zoom', zoomNeeds: 'Zoom is offered only with a Zoom link',
    rules: 'Rules', notice: 'Earliest', noticeU: 'hours ahead', horizon: 'Bookable up to', horizonU: 'days ahead',
    buffer: 'Gap around calendar events', perDay: 'Max calls a day', step: 'A call starts every',
    zoom: 'Personal Zoom link', zoomSub: 'Optional. When set, Zoom can be offered too',
    photo: 'Page photo', photoSub: 'Shown at the bottom of the page side panel on computers, in its own proportions (not shown on phones). Best: a cut-out figure with no background (transparent PNG / WebP). A link to the image, e.g. /img/booking-portrait-2.webp or https://…. Empty = no photo', photoReset: 'Default photo',
    dirty: 'You have unsaved changes', save: 'Save', saving: 'Saving…', saved: 'Saved', discard: 'Discard',
    upcoming: 'Upcoming calls', recent: 'Past calls (30 days)', none: 'No calls booked through the page yet',
    today: 'Today', tomorrow: 'Tomorrow',
    inCal: 'In calendar', notInCal: 'Not in calendar', waOk: 'WhatsApp confirmation sent', waNo: 'WhatsApp confirmation not sent', waQuota: 'WhatsApp blocked (Green API quota)', mailOk: 'Email confirmation sent', moved: n => `Moved ${n === 1 ? 'once' : `${n} times`}`,
    cancelledBy: { client: 'Cancelled by the client', office: 'Cancelled by the office', calendar: 'Deleted from the calendar', guest: 'The client declined the invitation' }, cancelled: 'Cancelled',
    clientLink: 'Copy the client link', linkCopied: 'Link copied', move: 'Reschedule', resend: 'Resend confirmation', resending: 'Sending…', resent: 'Sent', cancel: 'Cancel',
    cancelQ: 'Cancel this call? If there is a calendar invitation, the client gets a cancellation.', loading: 'Loading…', err: 'Error',
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], dec: 'Decrease', inc: 'Increase',
    synced: 'In sync with the calendar', syncing: 'Syncing…', refresh: 'Refresh from the calendar', cancelledN: n => `Cancelled (${n})`,
    moveBtn: 'Move', delBtn: 'Delete', copyLinkTip: "Copy the client's private link", resendShort: 'Send again',
    st: { cal: 'In Google Calendar', noCal: 'Not in the calendar', wa: 'WhatsApp sent to the client', waBad: "The client's WhatsApp didn't go out", mail: 'Email sent to the client', noMail: 'No email' },
    moveH: name => `Move the call with ${name}`, pickDay: 'Day', pickTime: 'Free time', noSlots: 'No free times in the coming days',
    notifyClient: 'Tell the client (WhatsApp, email and calendar invitation)', moveTo: w => `Move to ${w}`, moving: 'Moving…', back: 'Back', taken: 'That time was just taken, pick another',
    delQ: (name, w) => `Delete the call with ${name} (${w})? It is removed from Google Calendar too.`, delNotify: 'Delete and tell the client', delQuiet: 'Delete quietly', deleting: 'Deleting…',
    guestsBtn: 'Invitees', guestsH: name => `Invitees for the call with ${name}`, guestsSub: 'Everyone on the list gets a Google Calendar invitation. Anyone removed gets a cancellation.',
    guestPh: 'Email address (several allowed, comma separated)', guestAdd: 'Add', guestsSave: 'Save and send invitations', guestsSaving: 'Updating the calendar…', clientChip: 'Client', noClientMail: 'The client left no email',
    openCal: 'Open in Google Calendar', guestsN: n => `${n} invitees`,
    okMoved: (name, w) => `The call with ${name} moved to ${w} and Google Calendar was updated ✓`, badMoved: (name, e) => `The call with ${name} moved on the site, but the calendar wasn't updated: ${e}`,
    okDeleted: name => `The call with ${name} was deleted, also from Google Calendar ✓`, delCalErr: (name, e) => `The call with ${name} is cancelled, but the event isn't out of Google Calendar yet (${e}). The system retries every few minutes; you can also delete it in the calendar.`, okGuests: n => `Google Calendar updated ✓ · ${n} invitees got the invitation`,
    gErr: { invalid: b => `Invalid addresses: ${b.join(', ')}`, no_event: "This call isn't in the calendar (it wasn't connected when the call was booked)", event_gone: 'The event was deleted from Google Calendar', not_saved: m => `The calendar didn't keep: ${m.join(', ')}`, no_calendar: 'The calendar is not connected', cancelled: 'The call was cancelled' },
    calErrTip: e => `The calendar wasn't updated: ${e}`, stillInCal: 'Still in Google Calendar, being removed', noEvent: 'Not in the calendar',
    testMail: 'Sample email', testMailTip: 'Sends both emails to the office address: what the client gets and what the office gets', testSending: 'Sending…', testSent: to => `Sent to ${to}`,
  },
}

const CSS = `
.bka{--r:14px;display:grid;gap:18px;padding:4px 0 90px;color:var(--au-text);font-size:13px;line-height:1.5}
.bka *{box-sizing:border-box}
.bka button,.bka select{min-height:0;min-width:0}
.bka>*{min-width:0}
.bka h2{margin:0;font-size:22px;font-weight:600;letter-spacing:-.01em}
.bka .sub{margin:2px 0 0;color:var(--au-text2);font-size:13px}
.bka-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.bka-link{display:flex;align-items:center;gap:6px;background:var(--au-card);border:1px solid var(--au-s1-line);border-radius:999px;padding:5px 5px 5px 14px;min-width:0}
[dir=rtl] .bka-link{padding:5px 14px 5px 5px}
.bka-link code{font-family:inherit;font-size:13px;color:var(--au-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bka-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.bka-kpi{background:var(--au-card);border:1px solid var(--au-s1-line);border-radius:var(--r);padding:12px 14px}
.bka-kpi span{display:block;font-size:12px;color:var(--au-text2)}
.bka-kpi b{display:block;font-size:22px;font-weight:600;margin-top:2px;font-variant-numeric:tabular-nums}
.bka-kpi b.sm{font-size:15px;margin-top:6px;display:flex;align-items:center;gap:7px}
.bka-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:18px;align-items:start}
.bka-col{display:grid;gap:18px}
.bka-sec h3{margin:0 0 2px;font-size:15px;font-weight:600}
.bka-sec .hint{margin:0 0 10px;color:var(--au-text2);font-size:12.5px}
.bka-list{background:var(--au-card);border:1px solid var(--au-s1-line);border-radius:var(--r);overflow:hidden}
.bka-row{display:flex;align-items:center;gap:12px;min-height:50px;padding:9px 16px}
.bka-row+.bka-row{border-top:1px solid var(--au-divider)}
.bka-row .lbl{flex:1;min-width:0}
.bka-row .lbl small{display:block;color:var(--au-text2);font-size:12px}
.bka-row.off .lbl{color:var(--au-text2)}
.bka-switch{position:relative;width:44px;height:26px;border-radius:999px;border:none;background:rgba(var(--ink),.18);cursor:pointer;flex-shrink:0;transition:background .2s;padding:0}
.bka-switch::after{content:'';position:absolute;top:3px;inset-inline-start:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}
.bka-switch[aria-checked=true]{background:#34C759}
.bka-switch[aria-checked=true]::after{transform:translateX(18px)}
[dir=rtl] .bka-switch[aria-checked=true]::after{transform:translateX(-18px)}
.bka-time{appearance:none;-webkit-appearance:none;background:rgba(var(--ov),.06);border:1px solid transparent;border-radius:9px;padding:6px 12px;font:inherit;font-size:14px;font-weight:500;color:var(--au-text);cursor:pointer;font-variant-numeric:tabular-nums;text-align:center}
.bka-time:hover{background:rgba(var(--brand-rgb),.1)}
.bka-time option{background:var(--au-pop);color:var(--au-text)}
.bka-dash{color:var(--au-text3)}
.bka-step{display:inline-flex;align-items:center;background:rgba(var(--ov),.06);border-radius:9px;overflow:hidden;flex-shrink:0}
.bka-step button{width:34px;height:32px;border:none;background:none;color:var(--au-text);font-size:17px;cursor:pointer;line-height:1}
.bka-step button:hover:not(:disabled){background:rgba(var(--brand-rgb),.12)}
.bka-step button:disabled{opacity:.3;cursor:default}
.bka-step output{min-width:58px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums;font-size:13.5px}
.bka-seg{display:inline-flex;background:rgba(var(--ov),.07);border-radius:9px;padding:2px;gap:2px;flex-wrap:wrap}
.bka-seg button{border:none;background:none;border-radius:7px;padding:5px 11px;font:inherit;font-size:12.5px;font-weight:500;color:var(--au-text);cursor:pointer;font-variant-numeric:tabular-nums}
.bka-seg button[aria-pressed=true],.bka-seg button[aria-checked=true]{background:var(--au-card);box-shadow:0 1px 3px rgba(0,0,0,.14);font-weight:600}
.bka-seg button:disabled{opacity:.4;cursor:default}
.bka-in{width:100%;background:none;border:none;font:inherit;font-size:14px;color:var(--au-text);padding:4px 0;outline:none}
.bka-in::placeholder{color:var(--au-text3)}
.bka-btn{min-height:0;line-height:1.25;display:inline-flex;align-items:center;gap:6px;border:none;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;text-decoration:none}
.bka-btn.pri{background:var(--au-brand);color:#fff}
.bka-btn.sec{background:rgba(var(--brand-rgb),.1);color:var(--au-brand-text)}
.bka-btn.plain{background:none;color:var(--au-brand-text);padding:6px 8px}
.bka-btn.danger{background:none;color:var(--au-red-text);padding:6px 8px}
.bka-btn:disabled{opacity:.55;cursor:default}
.bka-btn:hover:not(:disabled){filter:brightness(1.06)}
.bka-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.bka-mtg{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:start;padding:14px 16px}
.bka-mtg+.bka-mtg{border-top:1px solid var(--au-divider)}
.bka-mtg.gone{opacity:.55}
.bka-tile{width:52px;border-radius:11px;overflow:hidden;text-align:center;border:1px solid var(--au-s2-line);background:var(--au-s2)}
.bka-tile i{display:block;font-style:normal;background:var(--au-brand);color:#fff;font-size:10.5px;font-weight:600;padding:2px 0}
.bka-tile b{display:block;font-size:19px;font-weight:600;padding:3px 0 2px;font-variant-numeric:tabular-nums}
.bka-mtg .who{font-size:14px;font-weight:600}
.bka-mtg .meta{color:var(--au-text2);font-size:12.5px;margin-top:1px}
.bka-mtg .note{margin-top:6px;font-size:12.5px;color:var(--au-text);background:rgba(var(--ov),.05);border-radius:9px;padding:7px 10px;white-space:pre-wrap}
.bka-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.bka-chip{font-size:11.5px;font-weight:500;border-radius:999px;padding:2px 9px;background:rgba(var(--ov),.07);color:var(--au-text2)}
.bka-chip.ok{background:rgba(52,199,89,.13);color:var(--au-text)}
.bka-chip.warn{background:rgba(245,166,35,.15);color:var(--au-amber-text)}
.bka-chip.bad{background:rgba(224,82,82,.12);color:var(--au-red-text)}
.bka-acts{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:4px;max-width:360px}
.bka-mh{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.bka-sync{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--au-text2)}
.bka-sync button{border:none;background:rgba(var(--ov),.06);color:var(--au-text);width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px}
.bka-sync button:hover{background:rgba(var(--brand-rgb),.12)}
.bka-day{padding:9px 16px 7px;font-size:12px;font-weight:600;color:var(--au-text2);background:rgba(var(--ov),.03);border-top:1px solid var(--au-divider)}
.bka-day:first-child{border-top:none}
.bka-day b{color:var(--au-text);font-weight:600}
.bka-m{display:grid;grid-template-columns:62px minmax(0,1fr) auto auto;gap:14px;align-items:center;padding:11px 16px;border-top:1px solid var(--au-divider);position:relative}
.bka-day+.bka-m{border-top:none}
.bka-m::before{content:'';position:absolute;inset-inline-start:0;top:10px;bottom:10px;width:3px;border-radius:3px;background:var(--st,var(--au-brand))}
.bka-m.gone{opacity:.5}
.bka-m .tm{font-variant-numeric:tabular-nums;line-height:1.2}
.bka-m .tm b{display:block;font-size:16px;font-weight:600}
.bka-m .tm small{color:var(--au-text3);font-size:11.5px}
.bka-m .who{font-size:14px;font-weight:600;display:flex;gap:8px;align-items:baseline;min-width:0}
.bka-m .who bdi{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bka-m .who span{font-size:12px;font-weight:400;color:var(--au-text2);white-space:nowrap}
.bka-m .sub2{display:flex;gap:8px;align-items:baseline;font-size:12.5px;color:var(--au-text2);margin-top:2px;min-width:0}
.bka-m .sub2 a{color:var(--au-brand-text);text-decoration:none;white-space:nowrap}
.bka-m .sub2 .nt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.bka-ic{display:inline-flex;gap:4px}
.bka-ic span{width:26px;height:26px;border-radius:8px;display:inline-grid;place-items:center;background:rgba(var(--ov),.06);color:var(--au-text3)}
.bka-ic span.ok{background:rgba(52,199,89,.14);color:#1E8E4A}
.bka-ic span.bad{background:rgba(224,82,82,.14);color:var(--au-red-text)}
.bka-ic span.warn{background:rgba(245,166,35,.16);color:var(--au-amber-text)}
html[data-admin-theme="dark"] .bka-ic span.ok{color:#4ADE80}
.bka-m .acts{display:flex;gap:4px;align-items:center}
.bka-ib{border:none;background:none;width:32px;height:32px;border-radius:9px;display:inline-grid;place-items:center;color:var(--au-text2);cursor:pointer}
.bka-ib:hover{background:rgba(var(--brand-rgb),.1);color:var(--au-brand-text)}
.bka-ib.del:hover{background:rgba(224,82,82,.1);color:var(--au-red-text)}
.bka-panel{grid-column:1/-1;margin-top:4px;padding:14px;border-radius:12px;background:rgba(var(--ov),.04);border:1px solid var(--au-divider);display:grid;gap:12px}
.bka-panel h4{margin:0;font-size:13.5px;font-weight:600}
.bka-panel .row{display:flex;gap:6px;flex-wrap:wrap}
.bka-chipbtn{border:1px solid var(--au-s1-line);background:var(--au-card);color:var(--au-text);border-radius:10px;padding:6px 10px;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;font-variant-numeric:tabular-nums;line-height:1.25;text-align:center}
.bka-chipbtn small{display:block;font-size:10.5px;color:var(--au-text2)}
.bka-chipbtn[aria-pressed=true]{background:var(--au-brand);border-color:var(--au-brand);color:#fff}
.bka-chipbtn[aria-pressed=true] small{color:#fff;opacity:.85}
.bka-check{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer}
.bka-check input{width:16px;height:16px;accent-color:var(--au-brand);appearance:auto;-webkit-appearance:checkbox;opacity:1;position:static}
.bka-panel .foot{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.bka-btn.dsolid{background:var(--au-red-text);color:#fff}
.bka-note{display:flex;gap:10px;align-items:center;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:500}
.bka-note.ok{background:rgba(52,199,89,.12);color:var(--au-text)}
.bka-note.bad{background:rgba(224,82,82,.1);color:var(--au-red-text)}
.bka-note button{margin-inline-start:auto;border:none;background:none;color:inherit;cursor:pointer;font-size:15px}
.bka-gl{display:flex;flex-wrap:wrap;gap:6px}
.bka-g{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:4px 6px 4px 10px;background:var(--au-card);border:1px solid var(--au-s1-line);font-size:12.5px}
[dir=rtl] .bka-g{padding:4px 10px 4px 6px}
.bka-g em{font-style:normal;font-size:11px;color:var(--au-text2)}
.bka-g button{border:none;background:rgba(var(--ov),.08);width:20px;height:20px;border-radius:50%;cursor:pointer;color:var(--au-text2);line-height:1;font-size:12px}
.bka-g button:hover{background:rgba(224,82,82,.15);color:var(--au-red-text)}
.bka-gin{display:flex;gap:8px;align-items:center}
.bka-gin input{flex:1;min-width:0;border:1px solid var(--au-s1-line);background:var(--au-card);color:var(--au-text);border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;outline:none}
.bka-gin input:focus{border-color:var(--au-brand)}
.bka-ib .n{position:absolute;top:2px;inset-inline-end:1px;min-width:15px;height:15px;border-radius:8px;background:var(--au-brand);color:#fff;font-size:9.5px;font-weight:700;display:grid;place-items:center;padding:0 3px}
.bka-ib{position:relative}
.bka-bar{position:sticky;bottom:12px;z-index:20;display:flex;align-items:center;gap:10px;justify-content:space-between;background:var(--au-pop);border:1px solid var(--au-s1-line);border-radius:999px;padding:8px 8px 8px 18px;box-shadow:var(--au-shadow3);max-width:560px;margin:0 auto;width:100%}
[dir=rtl] .bka-bar{padding:8px 18px 8px 8px}
.bka-err{background:rgba(224,82,82,.1);color:var(--au-red-text);border-radius:12px;padding:10px 14px}
.bka summary{cursor:pointer;color:var(--au-text2);padding:12px 16px;list-style:none}
.bka summary::-webkit-details-marker{display:none}
@media (max-width:1000px){.bka-grid{grid-template-columns:1fr}}
@media (max-width:640px){
  .bka-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  .bka-mtg{grid-template-columns:auto minmax(0,1fr)}
  .bka-m{grid-template-columns:54px minmax(0,1fr) auto}
  .bka-m .bka-ic{grid-column:2;grid-row:2}
  .bka-m .acts{grid-row:1/3;grid-column:3}
  .bka-acts{grid-column:1/-1;justify-content:flex-start;max-width:none}
  .bka-head .bka-link{width:100%;flex-wrap:wrap;border-radius:16px;padding:10px!important}
  .bka-head .bka-link code{flex:1 1 100%;padding:0 4px 4px}
}
`

function Switch({ on, onChange, label }) {
  return <button type="button" role="switch" aria-checked={!!on} aria-label={label} className="bka-switch" onClick={() => onChange(!on)} />
}
function Stepper({ value, onChange, min = 0, max = 999, step = 1, unit = '', label, t }) {
  const clamp = v => Math.max(min, Math.min(max, v))
  return (
    <span className="bka-step" role="group" aria-label={label}>
      <button type="button" aria-label={`${t.dec}: ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>−</button>
      <output aria-live="polite">{value}{unit ? ` ${unit}` : ''}</output>
      <button type="button" aria-label={`${t.inc}: ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>+</button>
    </span>
  )
}
function useCopy() {
  const [k, setK] = useState('')
  return [k, (text, key) => navigator.clipboard?.writeText(text).then(() => { setK(key); setTimeout(() => setK(''), 1600) })]
}

export default function BookingAdminTab({ lang = 'he' }) {
  const t = TR[lang] || TR.he
  const [state, setState] = useState(null)
  const [err, setErr] = useState('')
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [resending, setResending] = useState({})
  const [testMail, setTestMail] = useState('')
  const [copied, copy] = useCopy()
  const [panel, setPanel] = useState(null)       // { id, kind: 'move' | 'del', slots, day, start, notify, busy, err }
  const [syncedAt, setSyncedAt] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [notice, setNotice] = useState(null)     // { kind: 'ok' | 'bad', text } after a move / delete / invitees change
  useEffect(() => { if (!notice || notice.kind === 'bad') return; const id = setTimeout(() => setNotice(null), 7000); return () => clearTimeout(id) }, [notice])

  // the list is re-read from the server, which re-checks every upcoming event against Google Calendar first
  const load = (quiet = false) => {
    if (!quiet) setSyncing(true)
    return autoApi.get('booking-admin').then(d => {
      setState(d); setDraft(cur => (cur && quiet ? cur : d.config)); setErr(''); setSyncedAt(Date.now())
    }).catch(e => setErr(e.message)).finally(() => setSyncing(false))
  }
  useEffect(() => { load() }, [])
  // keep it in step with the calendar while the screen is open (every minute, only when visible, never mid-edit)
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible' && !panel) load(true) }, 60000)
    return () => clearInterval(id)
  }, [panel])

  const dirty = useMemo(() => {
    if (!state || !draft) return false
    const pick = c => JSON.stringify([c.hours, c.zoomUrl || '', c.photo ?? '', c.minNoticeMin, c.horizonDays, c.bufferMin, c.maxPerDay, c.stepMin, c.types])
    return pick(state.config) !== pick(draft)
  }, [state, draft])

  if (err && !state) return <div className="bka-err" style={{ margin: 16 }}>{t.err}: {err}</div>
  if (!state || !draft) return <div style={{ padding: 24, color: T.text2 }}>{t.loading}</div>

  const cal = state.calendar || {}
  const calStatus = cal.connected ? (cal.error ? 'err' : 'on') : 'off'
  const dot = { on: '#34C759', off: T.grey, err: T.amber }[calStatus]
  const now = Date.now()
  const live = state.bookings.filter(b => b.status !== 'cancelled')
  const upcoming = state.bookings.filter(b => Date.parse(b.end) > now).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  const past = state.bookings.filter(b => Date.parse(b.end) <= now)
  const weekEnd = now + 7 * 864e5
  const kUpcoming = live.filter(b => Date.parse(b.end) > now).length
  const kWeek = live.filter(b => Date.parse(b.start) > now && Date.parse(b.start) < weekEnd).length
  const kWa = live.filter(b => Date.parse(b.end) > now && b.wa && !b.wa.ok).length
  const loc = lang === 'en' ? 'en-GB' : 'he-IL'
  const fmt = (iso, o) => new Date(iso).toLocaleString(loc, { timeZone: TZ, ...o })
  const time = iso => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  const dayOf = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
  const rel = iso => { const n = Math.round((Date.parse(dayOf(iso)) - Date.parse(dayOf(new Date().toISOString()))) / 864e5); return n === 0 ? t.today : n === 1 ? t.tomorrow : fmt(iso, { weekday: 'long' }) }
  const chName = c => ({ meet: t.chMeet, zoom: t.chZoom, phone: t.chPhone }[c] || c)
  const prettyPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : p }

  async function connect() {
    setConnecting(true)
    try { const d = await autoApi.post('booking-connect'); window.location.href = d.url } catch (e) { setErr(e.message); setConnecting(false) }
  }
  async function disconnect() {
    if (!window.confirm(`${t.disconnect}?`)) return
    await autoApi.post('booking-disconnect').catch(e => setErr(e.message))
    load()
  }
  async function save() {
    setSaving('saving')
    try {
      const d = await autoApi.post('booking-settings', { config: { hours: draft.hours, zoomUrl: draft.zoomUrl, photo: draft.photo ?? '', minNoticeMin: draft.minNoticeMin, horizonDays: draft.horizonDays, bufferMin: draft.bufferMin, maxPerDay: draft.maxPerDay, stepMin: draft.stepMin, types: draft.types } })
      setDraft(d.config); setState(s => ({ ...s, config: d.config })); setSaving('saved'); setErr('')
      setTimeout(() => setSaving(''), 1800)
    } catch (e) { setErr(e.message); setSaving('') }
  }
  async function openMove(b) {
    setPanel({ id: b.id, kind: 'move', slots: null, day: '', start: '', notify: true })
    const m = new URL(b.manageUrl || 'x:/', 'https://x').searchParams.get('m') || ''
    const from = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
    try {
      const d = await autoApi.get(`booking-slots?type=${encodeURIComponent(b.type)}&from=${from}&days=${Math.min(31, (state.config.horizonDays || 21) + 1)}${m ? `&m=${encodeURIComponent(m)}` : ''}`)
      const slots = d.slots || {}
      const first = Object.keys(slots).sort().find(k => slots[k].length) || ''
      setPanel(p => (p?.id === b.id ? { ...p, slots, day: first } : p))
    } catch (e) { setPanel(p => (p?.id === b.id ? { ...p, slots: {}, err: e.message } : p)) }
  }
  async function doMove(b) {
    setPanel(p => ({ ...p, busy: true, err: '' }))
    try {
      const to = panel.start
      const d = await autoApi.post('booking-move', { id: b.id, start: to, notify: panel.notify })
      if (!d.ok) throw new Error(d.error === 'taken' ? t.taken : d.error || t.err)
      setNotice(d.calendar?.ok ? { kind: 'ok', text: t.okMoved(b.name, longWhen(to)) } : { kind: 'bad', text: t.badMoved(b.name, d.calendar?.error === 'no_event' ? t.gErr.no_event : d.calendar?.error || t.err) })
      setPanel(null); load()
    } catch (e) { setPanel(p => ({ ...p, busy: false, err: e.message })) }
  }
  const openGuests = b => setPanel({ id: b.id, kind: 'guests', list: [...(b.guests || [])], input: '' })
  const addTyped = () => setPanel(p => {
    const parts = String(p.input || '').split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean)
    const bad = parts.filter(x => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x))
    const ok = parts.filter(x => !bad.includes(x) && !p.list.includes(x))
    return { ...p, list: [...p.list, ...ok], input: bad.join(', '), err: bad.length ? t.gErr.invalid(bad) : '' }
  })
  async function saveGuests(b) {
    const typed = String(panel.input || '').trim()
    const list = typed ? [...panel.list, ...typed.split(/[\s,;]+/).filter(Boolean)] : panel.list
    setPanel(p => ({ ...p, busy: true, err: '' }))
    try {
      const d = await autoApi.post('booking-guests', { id: b.id, guests: list })
      if (!d.ok) {
        const f = t.gErr[d.error]
        throw new Error(typeof f === 'function' ? f(d.bad || d.missing || []) : f || d.error || t.err)
      }
      setNotice({ kind: 'ok', text: t.okGuests(d.guests.length + (b.email ? 1 : 0)) })
      setPanel(null); load()
    } catch (e) { setPanel(p => ({ ...p, busy: false, err: e.message })) }
  }
  async function doDelete(b, notify) {
    setPanel(p => ({ ...p, busy: notify ? 'notify' : 'quiet', err: '' }))
    try {
      const d = await autoApi.post('booking-cancel', { id: b.id, notify })
      if (!d.ok) throw new Error(d.error || t.err)
      setNotice(d.calendar === 'error' ? { kind: 'bad', text: t.delCalErr(b.name, d.calendarError || '') } : { kind: 'ok', text: t.okDeleted(b.name) })
      setPanel(null); load()
    } catch (e) { setPanel(p => ({ ...p, busy: false, err: e.message })) }
  }
  async function resend(id) {
    setResending(r => ({ ...r, [id]: 'busy' }))
    try {
      const d = await autoApi.post('booking-resend', { id })
      if (!d.ok) setErr(d.error || t.waNo)
      setResending(r => ({ ...r, [id]: d.ok ? 'done' : '' }))
      load()
    } catch (e) { setErr(e.message); setResending(r => ({ ...r, [id]: '' })) }
  }
  async function sendTestMail() {
    setTestMail('busy')
    try { const d = await autoApi.post('booking-test-email'); if (!d.ok) throw new Error(d.error); setTestMail(t.testSent(d.to)) } catch (e) { setErr(e.message); setTestMail('') }
  }
  const setHour = (d, i, v) => setDraft(c => { const h = { ...c.hours }; const n = [...(h[d] || [9, 18])]; n[i] = +v; if (n[1] <= n[0]) n[1] = Math.min(22, n[0] + 0.5); h[d] = n; return { ...c, hours: h } })
  const toggleDay = (d, on) => setDraft(c => ({ ...c, hours: { ...c.hours, [d]: on ? (c.hours[d] || [9, 18]) : null } }))
  const val = (k, v) => setDraft(c => ({ ...c, [k]: v }))
  const type0 = draft.types?.[0]
  const setType = patch => setDraft(c => ({ ...c, types: [{ ...c.types[0], ...patch }, ...c.types.slice(1)] }))
  const toggleCh = ch => { const cur = type0.channels || []; const next = cur.includes(ch) ? cur.filter(x => x !== ch) : [...cur, ch]; if (next.length) setType({ channels: CH_KEYS.filter(k => next.includes(k)) }) }

  const Ic = {
    cal: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
    wa: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.8-1.3 2.2 2.2 0 00.1-1.3c0-.1-.2-.2-.4-.3z"/></svg>,
    mail: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>,
    move: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M10 15h5m-2-2l2 2-2 2"/></svg>,
    link: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>,
    people: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M21.5 20a6.5 6.5 0 00-4-6"/></svg>,
    ext: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>,
    del: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"/></svg>,
  }
  const longWhen = iso => `${fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' })}, ${time(iso)}`
  const meeting = b => {
    const gone = b.status === 'cancelled'
    const live = !gone && Date.parse(b.end) > now
    const moved = (b.history || []).filter(h => h.kind === 'moved').length
    const color = gone ? T.grey : !b.eventId || (b.wa && !b.wa.ok) ? T.amber : '#34C759'
    const p = panel?.id === b.id ? panel : null
    const days = p?.slots ? Object.keys(p.slots).sort().filter(k => p.slots[k].length) : []
    return (
      <div key={b.id} className={`bka-m${gone ? ' gone' : ''}`} style={{ '--st': color }}>
        <div className="tm"><b dir="ltr">{time(b.start)}</b><small dir="ltr">{time(b.end)}</small></div>
        <div style={{ minWidth: 0 }}>
          <div className="who"><bdi>{b.name}</bdi><span>{b.typeName || b.type} · {chName(b.channel)}{b.guests?.length ? ` · ${t.guestsN(b.guests.length + (b.email ? 1 : 0))}` : ''}{moved > 0 ? ` · ${t.moved(moved)}` : ''}</span></div>
          <div className="sub2">
            <a href={`tel:${b.phone}`} dir="ltr">{prettyPhone(b.phone)}</a>
            {b.meetLink && <a href={b.meetLink} target="_blank" rel="noreferrer">Meet</a>}
            {gone ? <span style={{ color: 'var(--au-red-text)' }}>{t.cancelledBy[b.cancelledBy] || t.cancelled}{b.calendarPending ? <span title={b.calendarError || ''}> · {t.stillInCal}</span> : null}</span> : b.notes ? <span className="nt" title={b.notes}>“{b.notes}”</span> : null}
          </div>
        </div>
        {!gone ? (
          <div className="bka-ic">
            <span className={b.calendar === 'error' ? 'bad' : b.eventId ? 'ok' : 'warn'} title={b.calendar === 'error' ? t.calErrTip(b.calendarError || '') : b.eventId ? t.st.cal : t.st.noCal}>{Ic.cal}</span>
            {b.wa && <span className={b.wa.ok ? 'ok' : 'bad'} title={b.wa.ok ? t.st.wa : `${b.wa.quota ? t.waQuota : t.st.waBad}${b.wa.error ? ` · ${b.wa.error}` : ''}`}>{Ic.wa}</span>}
            <span className={b.mail?.ok ? 'ok' : ''} title={b.mail?.ok ? t.st.mail : t.st.noMail}>{Ic.mail}</span>
          </div>
        ) : <span />}
        <div className="acts">
          {live && b.wa && !b.wa.ok && <button className="bka-btn sec" style={{ padding: '5px 10px', fontSize: 12 }} disabled={resending[b.id] === 'busy'} onClick={() => resend(b.id)}>{resending[b.id] === 'busy' ? t.resending : resending[b.id] === 'done' ? t.resent : t.resendShort}</button>}
          {live && b.manageUrl && <button className="bka-ib" title={copied === b.id ? t.linkCopied : t.copyLinkTip} aria-label={t.copyLinkTip} onClick={() => copy(b.manageUrl, b.id)}>{copied === b.id ? '✓' : Ic.link}</button>}
          {live && b.eventId && <button className="bka-ib" title={t.guestsBtn} aria-label={t.guestsBtn} aria-expanded={p?.kind === 'guests'} onClick={() => (p?.kind === 'guests' ? setPanel(null) : openGuests(b))}>{Ic.people}{b.guests?.length ? <span className="n">{b.guests.length}</span> : null}</button>}
          {b.htmlLink && !gone && <a className="bka-ib" href={b.htmlLink} target="_blank" rel="noreferrer" title={t.openCal} aria-label={t.openCal}>{Ic.ext}</a>}
          {live && <button className="bka-ib" title={t.moveBtn} aria-label={t.moveBtn} aria-expanded={p?.kind === 'move'} onClick={() => (p?.kind === 'move' ? setPanel(null) : openMove(b))}>{Ic.move}</button>}
          {live && <button className="bka-ib del" title={t.delBtn} aria-label={t.delBtn} aria-expanded={p?.kind === 'del'} onClick={() => setPanel(p?.kind === 'del' ? null : { id: b.id, kind: 'del' })}>{Ic.del}</button>}
        </div>

        {p?.kind === 'move' && (
          <div className="bka-panel">
            <h4>{t.moveH(b.name)}</h4>
            {!p.slots ? <div style={{ color: T.text2 }}>{t.loading}</div> : !days.length ? <div style={{ color: T.text2 }}>{t.noSlots}</div> : <>
              <div className="row" role="group" aria-label={t.pickDay}>
                {days.map(d => (
                  <button key={d} type="button" className="bka-chipbtn" aria-pressed={p.day === d} onClick={() => setPanel(x => ({ ...x, day: d, start: '' }))}>
                    <small>{rel(`${d}T12:00:00Z`)}</small>{fmt(`${d}T12:00:00Z`, { day: 'numeric', month: 'short' })}
                  </button>
                ))}
              </div>
              <div className="row" role="group" aria-label={t.pickTime}>
                {(p.slots[p.day] || []).map(st => {
                  const cur = st === new Date(b.start).toISOString()
                  return <button key={st} type="button" className="bka-chipbtn" disabled={cur} style={cur ? { opacity: .45 } : undefined} aria-pressed={p.start === st} onClick={() => setPanel(x => ({ ...x, start: st }))} dir="ltr">{time(st)}</button>
                })}
              </div>
            </>}
            <label className="bka-check"><input type="checkbox" checked={p.notify !== false} onChange={e => setPanel(x => ({ ...x, notify: e.target.checked }))}/>{t.notifyClient}</label>
            {p.err && <div className="bka-err" role="alert">{p.err}</div>}
            <div className="foot">
              <button className="bka-btn pri" disabled={!p.start || p.busy} onClick={() => doMove(b)}>{p.busy ? t.moving : p.start ? t.moveTo(longWhen(p.start)) : t.moveBtn}</button>
              <button className="bka-btn plain" onClick={() => setPanel(null)}>{t.back}</button>
            </div>
          </div>
        )}
        {p?.kind === 'guests' && (
          <div className="bka-panel">
            <h4>{t.guestsH(b.name)}</h4>
            <div style={{ color: T.text2, fontSize: 12.5, marginTop: -6 }}>{t.guestsSub}</div>
            <div className="bka-gl">
              {b.email ? <span className="bka-g"><em>{t.clientChip}</em><bdi dir="ltr">{b.email}</bdi></span> : <span className="bka-g"><em>{t.noClientMail}</em></span>}
              {p.list.map(g => <span key={g} className="bka-g"><bdi dir="ltr">{g}</bdi><button type="button" aria-label={`✕ ${g}`} onClick={() => setPanel(x => ({ ...x, list: x.list.filter(y => y !== g) }))}>✕</button></span>)}
            </div>
            <div className="bka-gin">
              <input type="email" dir="ltr" inputMode="email" placeholder={t.guestPh} value={p.input} onChange={e => setPanel(x => ({ ...x, input: e.target.value, err: '' }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTyped() } }} aria-label={t.guestPh}/>
              <button className="bka-btn sec" type="button" onClick={addTyped} disabled={!String(p.input || '').trim()}>{t.guestAdd}</button>
            </div>
            {p.err && <div className="bka-err" role="alert">{p.err}</div>}
            <div className="foot">
              <button className="bka-btn pri" disabled={p.busy} onClick={() => saveGuests(b)}>{p.busy ? t.guestsSaving : t.guestsSave}</button>
              <button className="bka-btn plain" onClick={() => setPanel(null)}>{t.back}</button>
            </div>
          </div>
        )}
        {p?.kind === 'del' && (
          <div className="bka-panel" role="alertdialog" aria-label={t.delBtn}>
            <h4>{t.delQ(b.name, longWhen(b.start))}</h4>
            {p.err && <div className="bka-err" role="alert">{p.err}</div>}
            <div className="foot">
              <button className="bka-btn dsolid" disabled={!!p.busy} onClick={() => doDelete(b, true)}>{p.busy === 'notify' ? t.deleting : t.delNotify}</button>
              <button className="bka-btn danger" disabled={!!p.busy} onClick={() => doDelete(b, false)}>{p.busy === 'quiet' ? t.deleting : t.delQuiet}</button>
              <button className="bka-btn plain" onClick={() => setPanel(null)}>{t.back}</button>
            </div>
          </div>
        )}
      </div>
    )
  }
  // rows grouped by day, under a quiet day header
  const byDay = list => {
    const out = []; let last = ''
    for (const b of list) {
      const d = dayOf(b.start)
      if (d !== last) { out.push(<div key={`d-${d}`} className="bka-day"><b>{rel(b.start)}</b> · {fmt(b.start, { day: 'numeric', month: 'long' })}</div>); last = d }
      out.push(meeting(b))
    }
    return out
  }
  const upcomingLive = upcoming.filter(b => b.status !== 'cancelled')
  const upcomingGone = upcoming.filter(b => b.status === 'cancelled')

  return (
    <div className="bka" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <style>{CSS}</style>
      <div className="bka-head">
        <div>
          <h2>{t.title}</h2>
          <p className="sub">{t.sub}</p>
        </div>
        <div className="bka-link" title={t.linkSub}>
          <code dir="ltr">{SITE.replace('https://', '')}/book</code>
          <button className="bka-btn pri" onClick={() => copy(`${SITE}/book`, 'link')}>{copied === 'link' ? t.copied : t.copy}</button>
          <a className="bka-btn sec" href="/book" target="_blank" rel="noreferrer">{t.open}</a>
          <button className="bka-btn plain" onClick={() => copy(`${SITE}/book?lang=en`, 'en')}>{copied === 'en' ? t.copied : t.linkEn}</button>
          <button className="bka-btn plain" title={t.testMailTip} disabled={testMail === 'busy'} onClick={sendTestMail}>{testMail === 'busy' ? t.testSending : testMail || t.testMail}</button>
        </div>
      </div>
      {err && <div className="bka-err" role="alert">{err}</div>}

      <div className="bka-kpis">
        <div className="bka-kpi"><span>{t.kUpcoming}</span><b>{kUpcoming}</b></div>
        <div className="bka-kpi"><span>{t.kWeek}</span><b>{kWeek}</b></div>
        <div className="bka-kpi"><span>{t.kWa}</span><b style={kWa ? { color: 'var(--au-red-text)' } : undefined}>{kWa}</b></div>
        <div className="bka-kpi"><span>{t.kCal}</span><b className="sm"><span className="bka-dot" style={{ background: dot }} />{calStatus === 'on' ? t.calOn : calStatus === 'err' ? t.calErr : t.calOff}</b></div>
      </div>

      <section className="bka-sec">
        <div className="bka-mh">
          <h3>{t.upcoming} ({upcomingLive.length})</h3>
          <span className="bka-sync" aria-live="polite">
            <span className="bka-dot" style={{ background: calStatus === 'on' ? '#34C759' : T.amber }}/>
            {syncing ? t.syncing : `${t.synced} · ${new Date(syncedAt || now).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}`}
            <button type="button" title={t.refresh} aria-label={t.refresh} disabled={syncing} onClick={() => load()}>↻</button>
          </span>
        </div>
        {notice && <div className={`bka-note ${notice.kind}`} role={notice.kind === 'bad' ? 'alert' : 'status'} style={{ marginTop: 8 }}>{notice.text}<button type="button" aria-label="✕" onClick={() => setNotice(null)}>✕</button></div>}
        <div className="bka-list" style={{ marginTop: 8 }}>
          {upcomingLive.length ? byDay(upcomingLive) : <div className="bka-row" style={{ color: T.text2 }}>{t.none}</div>}
          {upcomingGone.length > 0 && (
            <details style={{ borderTop: `1px solid ${T.divider}` }}>
              <summary>{t.cancelledN(upcomingGone.length)}</summary>
              {byDay(upcomingGone)}
            </details>
          )}
          {past.length > 0 && (
            <details style={{ borderTop: `1px solid ${T.divider}` }}>
              <summary>{t.recent} ({past.length})</summary>
              {byDay([...past].sort((a, b) => Date.parse(b.start) - Date.parse(a.start)))}
            </details>
          )}
        </div>
      </section>

      <div className="bka-grid">
        <div className="bka-col">
          <section className="bka-sec">
            <h3>{t.hours}</h3>
            <p className="hint">{t.hoursSub}</p>
            <div className="bka-list">
              {t.days.map((name, d) => {
                const h = draft.hours?.[d]
                return (
                  <div key={d} className={`bka-row${h ? '' : ' off'}`}>
                    <Switch on={!!h} onChange={on => toggleDay(d, on)} label={name} />
                    <span className="lbl">{name}</span>
                    {h ? (
                      <>
                        <select className="bka-time" aria-label={`${name} ${t.from}`} value={h[0]} onChange={e => setHour(d, 0, e.target.value)}>{HALF_HOURS.slice(0, -1).map(x => <option key={x} value={x}>{hh(x)}</option>)}</select>
                        <span className="bka-dash" aria-hidden="true">–</span>
                        <select className="bka-time" aria-label={`${name} ${t.to}`} value={h[1]} onChange={e => setHour(d, 1, e.target.value)}>{HALF_HOURS.filter(x => x > h[0]).map(x => <option key={x} value={x}>{hh(x)}</option>)}</select>
                      </>
                    ) : <span style={{ color: T.text3 }}>{t.closed}</span>}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="bka-sec">
            <h3>{t.cal}</h3>
            <p className="hint">{cal.connected ? t.calOnSub : t.calOffSub}</p>
            <div className="bka-list">
              <div className="bka-row">
                <span className="bka-dot" style={{ background: dot }} />
                <span className="lbl">{calStatus === 'on' ? t.calOn : calStatus === 'err' ? t.calErr : t.calOff}
                  {cal.connected && <small><bdi dir="ltr">{cal.email}</bdi>{cal.connectedAt && <> · {t.since} {new Date(cal.connectedAt).toLocaleDateString(loc)}</>}</small>}
                  {cal.error && <small style={{ color: T.amberText }}>{cal.error}</small>}
                </span>
                {cal.oauthReady && (!cal.connected || cal.error) && <button className="bka-btn pri" disabled={connecting} onClick={connect}>{connecting ? t.connecting : cal.connected ? t.reconnect : t.connect}</button>}
                {cal.connected && <button className="bka-btn danger" onClick={disconnect}>{t.disconnect}</button>}
              </div>
              {!cal.oauthReady && <div className="bka-row"><span className="lbl" style={{ color: T.amberText }}>{t.envMissing}</span></div>}
              <div className="bka-row"><span className="lbl">{t.redirect}<small dir="ltr" style={{ userSelect: 'all', overflowWrap: 'anywhere' }}>{cal.redirectUri}</small></span><button className="bka-btn plain" onClick={() => copy(cal.redirectUri, 'redir')}>{copied === 'redir' ? t.copied : t.copy}</button></div>
            </div>
          </section>
        </div>

        <div className="bka-col">
          {type0 && (
            <section className="bka-sec">
              <h3>{t.typeH}</h3>
              <div className="bka-list" style={{ marginTop: 8 }}>
                <label className="bka-row"><span className="lbl" style={{ flex: '0 0 110px', color: T.text2 }}>{t.nameHe}</span><input className="bka-in" value={type0.he} onChange={e => setType({ he: e.target.value })} /></label>
                <label className="bka-row"><span className="lbl" style={{ flex: '0 0 110px', color: T.text2 }}>{t.nameEn}</span><input className="bka-in" dir="ltr" value={type0.en} onChange={e => setType({ en: e.target.value })} /></label>
                <div className="bka-row" style={{ flexWrap: 'wrap' }}>
                  <span className="lbl">{t.duration}</span>
                  <div className="bka-seg" role="radiogroup" aria-label={t.duration}>
                    {DURATIONS.map(m => <button key={m} type="button" role="radio" aria-checked={type0.minutes === m} onClick={() => setType({ minutes: m })}>{m} {t.min}</button>)}
                  </div>
                </div>
                <div className="bka-row" style={{ flexWrap: 'wrap' }}>
                  <span className="lbl">{t.channels}{!draft.zoomUrl && <small>{t.zoomNeeds}</small>}</span>
                  <div className="bka-seg" role="group" aria-label={t.channels}>
                    {CH_KEYS.map(c => <button key={c} type="button" aria-pressed={(type0.channels || []).includes(c)} disabled={c === 'zoom' && !draft.zoomUrl && !(type0.channels || []).includes(c)} onClick={() => toggleCh(c)}>{chName(c)}</button>)}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="bka-sec">
            <h3>{t.rules}</h3>
            <div className="bka-list" style={{ marginTop: 8 }}>
              <div className="bka-row"><span className="lbl">{t.notice}<small>{t.noticeU}</small></span><Stepper t={t} label={t.notice} value={Math.round((draft.minNoticeMin || 0) / 60)} min={0} max={168} onChange={v => val('minNoticeMin', v * 60)} /></div>
              <div className="bka-row"><span className="lbl">{t.horizon}<small>{t.horizonU}</small></span><Stepper t={t} label={t.horizon} value={draft.horizonDays} min={1} max={60} onChange={v => val('horizonDays', v)} /></div>
              <div className="bka-row"><span className="lbl">{t.buffer}</span><Stepper t={t} label={t.buffer} value={draft.bufferMin} min={0} max={60} step={5} unit={t.min} onChange={v => val('bufferMin', v)} /></div>
              <div className="bka-row"><span className="lbl">{t.perDay}</span><Stepper t={t} label={t.perDay} value={draft.maxPerDay} min={1} max={40} onChange={v => val('maxPerDay', v)} /></div>
              <div className="bka-row"><span className="lbl">{t.step}</span><Stepper t={t} label={t.step} value={draft.stepMin} min={10} max={120} step={5} unit={t.min} onChange={v => val('stepMin', v)} /></div>
            </div>
          </section>

          <section className="bka-sec">
            <h3>{t.photo}</h3>
            <p className="hint">{t.photoSub}</p>
            <div className="bka-list">
              <div className="bka-row" style={{ alignItems: 'center' }}>
                {draft.photo ? <img src={draft.photo} alt="" style={{ width: 56, height: 42, objectFit: 'contain', borderRadius: 8, flexShrink: 0, background: 'rgba(var(--ov),.06)' }}/> : <span style={{ width: 56, height: 42, borderRadius: 8, flexShrink: 0, border: '1px dashed var(--au-line)' }}/>}
                <input className="bka-in" dir="ltr" placeholder="/img/booking-portrait-2.webp" aria-label={t.photo} value={draft.photo ?? ''} onChange={e => val('photo', e.target.value)} />
                {draft.photo !== '/img/booking-portrait-2.webp' && <button type="button" className="bka-btn plain" onClick={() => val('photo', '/img/booking-portrait-2.webp')}>{t.photoReset}</button>}
              </div>
            </div>
          </section>

          <section className="bka-sec">
            <h3>{t.zoom}</h3>
            <p className="hint">{t.zoomSub}</p>
            <div className="bka-list">
              <label className="bka-row"><input className="bka-in" dir="ltr" placeholder="https://zoom.us/j/…" aria-label={t.zoom} value={draft.zoomUrl || ''} onChange={e => val('zoomUrl', e.target.value)} /></label>
            </div>
          </section>
        </div>
      </div>

      {(dirty || saving) && (
        <div className="bka-bar" role="region" aria-label={t.dirty}>
          <span style={{ fontWeight: 500 }}>{saving === 'saved' ? t.saved : t.dirty}</span>
          <span style={{ display: 'flex', gap: 6 }}>
            {dirty && <button className="bka-btn plain" onClick={() => setDraft(state.config)}>{t.discard}</button>}
            <button className="bka-btn pri" disabled={saving === 'saving' || !dirty} onClick={save}>{saving === 'saving' ? t.saving : saving === 'saved' ? t.saved : t.save}</button>
          </span>
        </div>
      )}
    </div>
  )
}
