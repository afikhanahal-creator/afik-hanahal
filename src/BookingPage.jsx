// Booking page (/book, also /booking, /meet) — our own Calendly, in Afik Hanahal's colors.
// Steps: meeting type (skipped when there is one) → day & time → details & how to talk → the call's own page.
// The call's own page (/book?m=<id>.<token>, the private link sent by WhatsApp and email) shows every detail and lets the
// client move the call to another free time or cancel it (?do=cancel opens the cancel question right away).
// Slots: /api/meta/booking-slots (office hours minus what is busy in the office Google Calendar; with m= the call's own
// time counts as free). A booking: booking-create; the page: booking-manage; a move: booking-reschedule; booking-cancel-self.
import { useEffect, useMemo, useRef, useState } from 'react'

const API = import.meta.env.PROD ? '' : (import.meta.env.VITE_SELLER_API_BASE || '')
const TZ = 'Asia/Jerusalem'
const OFFICE_WA = '972559811814'

const TR = {
  he: {
    howPhone: 'נתקשר אליכם בשעה שבחרתם, למספר שתשאירו כאן.', howVideo: 'הקישור לשיחה יישלח למייל שתשאירו כאן.',
    langBtn: 'English', home: 'חזרה לאתר', wa: 'וואטסאפ', waTip: 'כתבו לנו בוואטסאפ', call: 'חייגו אלינו', photoAlt: 'צוות אפיק הנחל', pick: 'בחרו סוג פגישה', minutes: n => `${n} דקות`,
    stepTime: 'מועד', stepDetails: 'פרטים', stepDone: 'אישור', stepOf: (i, n) => `שלב ${i} מתוך ${n}`,
    chooseDay: 'בחרו יום ושעה', times: 'שעות פנויות', noTimes: 'אין שעות פנויות ביום הזה', tzNote: 'לפי שעון ישראל',
    loading: 'טוען שעות פנויות…', loadErr: 'לא הצלחנו לטעון את השעות. נסו לרענן את העמוד.',
    nothing: 'כרגע אין שעות פנויות בשבועות הקרובים. כתבו לנו בוואטסאפ ונמצא זמן.',
    back: 'חזרה', details: 'הפרטים שלכם', how: 'איך נדבר?',
    name: 'שם מלא', phone: 'טלפון נייד', email: 'אימייל', emailHintVideo: 'נשלח לכאן את ההזמנה והקישור לשיחה',
    emailOpt: 'אימייל (לא חובה)', emailHint: 'נשלח לכאן אישור עם כל הפרטים', notes: 'על מה תרצו לדבר? (לא חובה)', notesPh: 'למשל: מחפשים 4 חדרים בכפר סבא, תקציב עד 3 מיליון',
    confirm: 'קבעו את השיחה', sending: 'קובעים…',
    chMeet: 'Google Meet', chZoom: 'זום', chPhone: 'שיחת טלפון',
    chMeetD: 'שיחת וידאו, הקישור יגיע במייל', chZoomD: 'שיחת וידאו בזום', chPhoneD: 'אנחנו מתקשרים אליכם',
    errName: 'מה השם?', errPhone: 'מספר טלפון לא תקין', errEmail: 'צריך אימייל תקין', errEmailReq: 'לשיחת וידאו צריך אימייל, לשם נשלח את הקישור',
    taken: 'השעה הזו נתפסה הרגע. בחרו שעה אחרת.', tooMany: 'כבר קבעתם שתי פגישות קרובות. אפשר לשנות אותן מהקישור שקיבלתם, או לכתוב לנו בוואטסאפ.',
    rate: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.', fail: 'משהו השתבש. נסו שוב, או כתבו לנו בוואטסאפ.',
    privacy: 'הפרטים משמשים רק לתיאום השיחה איתכם.',
    callPage: 'פרטי השיחה', created: 'השיחה נקבעה', createdSub: 'שמרנו לכם מקום. כל הפרטים כאן, ואפשר לחזור לעמוד הזה כדי לשנות מועד.',
    moved: 'המועד עודכן', movedSub: 'השיחה הועברה לשעה החדשה. שלחנו לכם עדכון.',
    stBooked: 'מאושרת', stCancelled: 'בוטלה', stPast: 'הסתיימה',
    today: 'היום', tomorrow: 'מחר', inDays: n => `בעוד ${n} ימים`,
    dType: 'סוג הפגישה', dLen: 'משך', dHow: 'אופן השיחה', dName: 'שם', dPhone: 'טלפון', dEmail: 'אימייל', dNotes: 'על מה נדבר', dLink: 'קישור לשיחה',
    weCall: p => `אנחנו מתקשרים אליכם למספר ${p}`,
    sentWa: p => `שלחנו אישור בוואטסאפ למספר ${p}`, sentMail: e => `שלחנו אישור במייל לכתובת ${e}`,
    keepLink: 'שמרו את הקישור לעמוד הזה, דרכו אפשר לשנות מועד או לבטל.', copy: 'העתקת הקישור', copied: 'הקישור הועתק', saveWa: 'שליחת הקישור לעצמכם בוואטסאפ',
    reschedule: 'שינוי מועד', cancel: 'ביטול השיחה', addCal: 'הוספה ליומן Google', writeUs: 'כתבו לנו בוואטסאפ',
    cancelQ: 'לבטל את השיחה?', cancelYes: 'כן, לבטל', cancelNo: 'לא, להשאיר', cancelling: 'מבטלים…',
    cancelledTitle: 'השיחה בוטלה', cancelledSub: 'נשמח לקבוע מועד אחר בכל זמן שנוח לכם.', rebook: 'קביעת מועד חדש',
    pastSub: 'מועד השיחה עבר. רוצים לקבוע שיחה נוספת?', another: 'קביעת שיחה נוספת',
    moveTitle: 'בחרו מועד חדש', current: 'המועד הנוכחי', newTime: 'המועד החדש', moveQ: 'להעביר את השיחה?', moveYes: 'אישור השינוי', moving: 'מעדכנים…',
    noChange: { cancelled: 'השיחה בוטלה ואי אפשר לשנות אותה.', past: 'מועד השיחה עבר.', limit: 'הגעתם למספר השינויים המרבי. כתבו לנו בוואטסאפ ונסדר.' },
    notFound: 'לא מצאנו את השיחה. ייתכן שהקישור לא שלם. אפשר לקבוע שיחה חדשה או לכתוב לנו.',
    prepH: 'כדי להפיק את המרב מהשיחה', prep: ['מה אתם מחפשים: דירה, בית, מגרש או השקעה', 'אזורים שמעניינים אתכם', 'תקציב משוער ומימון', 'לוח זמנים: מתי תרצו לעבור או לסגור'],
    waText: 'היי, קבעתי שיחה דרך האתר ויש לי שאלה', selfWa: (when, url) => `השיחה עם אפיק הנחל: ${when}\nלשינוי או ביטול: ${url}`,
    weekdays: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'], prevM: 'החודש הקודם', nextM: 'החודש הבא',
    pickDay: 'בחרו יום', monthView: 'לוח חודשי', stripView: 'ימים קרובים', moreDays: n => `עוד ${n} ימים`, lessDays: 'פחות ימים', freeTimes: n => `${n} שעות פנויות`,
  },
  en: {
    howPhone: "We'll call you at the time you picked, on the number you leave here.", howVideo: "The call link will be sent to the email you leave here.",
    langBtn: 'עברית', home: 'Back to the website', wa: 'WhatsApp', waTip: 'Message us on WhatsApp', call: 'Call us', photoAlt: 'The Afik Hanahal team', pick: 'Choose a meeting type', minutes: n => `${n} minutes`,
    stepTime: 'Time', stepDetails: 'Details', stepDone: 'Confirmed', stepOf: (i, n) => `Step ${i} of ${n}`,
    chooseDay: 'Pick a day and time', times: 'Available times', noTimes: 'No free times on this day', tzNote: 'Israel time',
    loading: 'Loading available times…', loadErr: 'We couldn\'t load the times. Please refresh the page.',
    nothing: 'There are no free times in the next few weeks. Message us on WhatsApp and we\'ll find one.',
    back: 'Back', details: 'Your details', how: 'How shall we talk?',
    name: 'Full name', phone: 'Mobile phone', email: 'Email', emailHintVideo: 'We\'ll send the invitation and the call link here',
    emailOpt: 'Email (optional)', emailHint: 'We\'ll send a confirmation with all the details here', notes: 'What would you like to talk about? (optional)', notesPh: 'e.g. looking for a 4-room home in Kfar Saba, budget up to 3 million',
    confirm: 'Book the call', sending: 'Booking…',
    chMeet: 'Google Meet', chZoom: 'Zoom', chPhone: 'Phone call',
    chMeetD: 'Video call, the link comes by email', chZoomD: 'Video call on Zoom', chPhoneD: 'We call you',
    errName: 'What\'s your name?', errPhone: 'Please enter a valid phone number', errEmail: 'Please enter a valid email', errEmailReq: 'A video call needs an email, that\'s where the link goes',
    taken: 'That time was just taken. Please pick another one.', tooMany: 'You already have two upcoming calls with us. You can change them from the link you received, or message us on WhatsApp.',
    rate: 'Too many attempts. Please try again in a few minutes.', fail: 'Something went wrong. Please try again, or message us on WhatsApp.',
    privacy: 'Your details are only used to arrange the call with you.',
    callPage: 'Your call', created: 'Your call is booked', createdSub: 'Your time is reserved. Everything is here, and you can come back to this page to reschedule.',
    moved: 'Your call has been rescheduled', movedSub: 'The call is now at the new time. We\'ve sent you an update.',
    stBooked: 'Confirmed', stCancelled: 'Cancelled', stPast: 'Completed',
    today: 'Today', tomorrow: 'Tomorrow', inDays: n => `In ${n} days`,
    dType: 'Meeting', dLen: 'Length', dHow: 'How we talk', dName: 'Name', dPhone: 'Phone', dEmail: 'Email', dNotes: 'Topic', dLink: 'Call link',
    weCall: p => `We'll call you on ${p}`,
    sentWa: p => `We sent a WhatsApp confirmation to ${p}`, sentMail: e => `We sent an email confirmation to ${e}`,
    keepLink: 'Keep the link to this page: you can reschedule or cancel from it.', copy: 'Copy the link', copied: 'Link copied', saveWa: 'Send the link to yourself on WhatsApp',
    reschedule: 'Reschedule', cancel: 'Cancel the call', addCal: 'Add to Google Calendar', writeUs: 'Message us on WhatsApp',
    cancelQ: 'Cancel this call?', cancelYes: 'Yes, cancel', cancelNo: 'No, keep it', cancelling: 'Cancelling…',
    cancelledTitle: 'Your call has been cancelled', cancelledSub: 'You are welcome to book another time whenever it suits you.', rebook: 'Book a new time',
    pastSub: 'This call has already taken place. Would you like to book another one?', another: 'Book another call',
    moveTitle: 'Pick a new time', current: 'Current time', newTime: 'New time', moveQ: 'Move the call?', moveYes: 'Confirm the change', moving: 'Updating…',
    noChange: { cancelled: 'This call was cancelled and can no longer be changed.', past: 'This call has already taken place.', limit: 'You\'ve reached the maximum number of changes. Message us on WhatsApp and we\'ll sort it out.' },
    notFound: 'We couldn\'t find this call. The link may be incomplete. You can book a new call or message us.',
    prepH: 'To get the most out of the call', prep: ['What you are looking for: an apartment, a house, a plot or an investment', 'The areas you are interested in', 'An approximate budget and financing', 'Timing: when you would like to move or close'],
    waText: 'Hi, I booked a call on your website and have a question', selfWa: (when, url) => `My call with Afik Hanahal: ${when}\nTo reschedule or cancel: ${url}`,
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], prevM: 'Previous month', nextM: 'Next month',
    pickDay: 'Pick a day', monthView: 'Month view', stripView: 'Next days', moreDays: n => `${n} more days`, lessDays: 'Fewer days', freeTimes: n => `${n} free times`,
  },
}

const CSS = `
html,body{background:#09090F;margin:0}
@media (prefers-color-scheme: light){html,body{background:#F5F1E9}}
.bk{--bg:#09090F;--card:#0E0E1C;--card2:#14142A;--side:#11112A;--ink:#E8E4D8;--mute:#A6A3B4;--line:rgba(232,228,216,.10);--brand:#8490D8;--brand-ink:#09090F;--brand-text:#A9B3EE;--brand-soft:rgba(132,144,216,.14);--err:#F08A8A;--err-soft:rgba(240,138,138,.12);--ok:#5FD39A;--ok-soft:rgba(95,211,154,.12);--shadow:0 30px 80px rgba(0,0,0,.35);
  min-height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);font-family:Rubik,Heebo,system-ui,-apple-system,Arial,sans-serif;font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased}
@media (prefers-color-scheme: light){.bk{--bg:#F5F1E9;--card:#FFFFFF;--card2:#FAF8F3;--side:#F7F5FD;--ink:#17172B;--mute:#5E5B6E;--line:rgba(23,23,43,.10);--brand:#3F4EB0;--brand-ink:#FFFFFF;--brand-text:#3F4EB0;--brand-soft:rgba(63,78,176,.09);--err:#B3261E;--err-soft:rgba(179,38,30,.08);--ok:#1E7A4C;--ok-soft:rgba(30,122,76,.10);--shadow:0 30px 80px rgba(40,34,20,.12)}}
.bk *{box-sizing:border-box}
.bk a{color:var(--brand-text)}
.bk :focus-visible{outline:3px solid var(--brand-text);outline-offset:2px}
.bk [tabindex="-1"]:focus,.bk [tabindex="-1"]:focus-visible{outline:none}
.bk-top{width:100%;max-width:1240px;margin:0 auto;padding:16px 20px 0;display:flex;align-items:center;justify-content:space-between;gap:12px}
.bk-brand{display:flex;align-items:center;gap:10px;color:inherit!important;text-decoration:none;font-weight:600;font-size:15px;min-width:0}
.bk-brand img{height:64px;width:auto;flex-shrink:0}
.bk-brand span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bk-top-act{display:flex;gap:8px;align-items:center;flex-shrink:0}
.bk-pill{display:inline-flex;align-items:center;gap:7px;background:var(--card);border:1px solid var(--line);color:var(--ink)!important;border-radius:999px;padding:8px 16px;font:inherit;font-size:13.5px;font-weight:500;cursor:pointer;text-decoration:none;white-space:nowrap}
.bk-pill:hover{border-color:var(--brand)}
.bk-wa{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:38px;padding:0 14px;border-radius:999px;background:#25D366;color:#06301A!important;font-size:13.5px;font-weight:600;text-decoration:none;white-space:nowrap}
.bk-wa:hover{filter:brightness(1.05)}
/* the figure stands at the bottom of the side panel: a cut-out (no frame, no background), its own proportions */
/* it takes whatever height the panel has left (never more), so the card fits the screen on every step */
.bk-photo{margin:0;position:relative;flex:1 1 0;min-height:170px;max-height:440px}
.bk-photo img{position:absolute;inset:0;z-index:1;display:block;width:100%;height:100%;object-fit:contain;object-position:50% 100%}
.bk-photo::after{content:'';position:absolute;bottom:-6px;left:50%;width:62%;height:16px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(23,23,43,.16),transparent)}
.bk-contact.bk-ph-contact{display:none}
.bk-contact{display:flex;flex-wrap:wrap;gap:8px}
.bk-contact a{flex:1 1 auto;display:inline-flex;align-items:center;justify-content:center;gap:7px;height:38px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink)!important;text-decoration:none;font-size:13px;font-weight:500;white-space:nowrap}
.bk-contact a:hover{border-color:var(--brand)}
.bk-contact a.wa{border-color:transparent;background:#25D366;color:#06301A!important;font-weight:600}
.bk-contact .ic{display:inline-flex}
.bk-lead{margin:-10px 0 4px;color:var(--mute);font-size:14px}
.bk-shell{flex:1;width:100%;max-width:1240px;margin:0 auto;padding:16px 20px 14px;display:flex;flex-direction:column;justify-content:center}
.bk-card{background:var(--card);border:1px solid var(--line);border-radius:24px;overflow:hidden;display:grid;grid-template-columns:380px 1fr;min-height:min(720px,calc(100vh - 140px));box-shadow:var(--shadow)}
.bk-side{padding:28px 30px;background:var(--side);border-inline-end:1px solid var(--line);display:flex;flex-direction:column;gap:16px}
.bk-org{font-size:12.5px;color:var(--mute);font-weight:500;letter-spacing:.02em}
.bk-h1{font-size:28px;font-weight:700;margin:0;letter-spacing:-.01em;line-height:1.25}
.bk-meta{display:flex;flex-direction:column;gap:9px;color:var(--mute);font-size:14.5px}
.bk-meta span{display:flex;align-items:center;gap:9px}
.bk-meta svg{color:var(--brand-text)}
.bk-desc{color:var(--mute);font-size:14.5px;margin:0;line-height:1.7}
.bk-chosen{padding:14px 16px;border-radius:14px;background:var(--brand-soft);color:var(--ink);font-weight:600;font-size:14.5px;display:flex;gap:9px;align-items:flex-start}
.bk-chosen svg{color:var(--brand-text);margin-top:3px;flex-shrink:0}
.bk-chosen small{display:block;font-weight:500;color:var(--mute);font-size:12px;margin-bottom:2px}
.bk-chosen.old{background:none;border:1px dashed var(--line);font-weight:500}
.bk-side-foot{margin-top:auto;flex:1 1 0;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;gap:14px}
.bk-main{padding:28px 40px 28px;min-width:0;display:flex;flex-direction:column}
.bk-steps{display:flex;gap:6px;align-items:center;margin:0 0 22px;padding:0;list-style:none;font-size:13px;color:var(--mute);flex-wrap:wrap}
.bk-steps li{display:flex;align-items:center;gap:7px}
.bk-steps li+li::before{content:'';width:22px;height:1px;background:var(--line);margin-inline-end:6px}
.bk-steps b{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;border:1px solid var(--line);font-weight:600}
.bk-steps .on{color:var(--ink);font-weight:600}
.bk-steps .on b{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
.bk-steps .done b{background:var(--brand-soft);border-color:transparent;color:var(--brand-text)}
.bk-h2{font-size:21px;font-weight:700;margin:0 0 20px;outline:none}
.bk-types{display:grid;gap:12px}
.bk-type{display:flex;gap:14px;align-items:flex-start;text-align:start;width:100%;background:var(--card2);border:1px solid var(--line);border-radius:16px;padding:18px 20px;color:inherit;font:inherit;cursor:pointer}
.bk-type:hover{border-color:var(--brand)}
.bk-type b{display:block;font-size:16px;margin-bottom:2px}
.bk-type small{color:var(--mute);font-size:13px}
.bk-cal-wrap{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:34px}
.bk-month{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-weight:600;font-size:16px}
.bk-nav{width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:none;color:var(--ink);cursor:pointer;font-size:18px;line-height:1}
.bk-nav:hover:not(:disabled){border-color:var(--brand)}
.bk-nav:disabled{opacity:.3;cursor:default}
.bk-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;text-align:center}
.bk-wd{font-size:12px;color:var(--mute);padding:4px 0;font-weight:500}
.bk-day{aspect-ratio:1;max-height:54px;width:100%;border-radius:50%;border:none;background:none;color:var(--mute);font:inherit;font-size:15px;opacity:.45;cursor:default}
.bk-day.on{opacity:1;color:var(--brand-text);background:var(--brand-soft);font-weight:600;cursor:pointer}
.bk-day.on:hover{outline:2px solid var(--brand)}
.bk-day.sel{background:var(--brand);color:var(--brand-ink)}
.bk-day.today{text-decoration:underline;text-underline-offset:4px}
.bk-day.cur{box-shadow:inset 0 0 0 2px var(--brand)}
.bk-times{display:flex;flex-direction:column;gap:9px;max-height:430px;overflow:auto;padding-inline-end:4px}
.bk-times-h{font-size:14.5px;font-weight:600;margin:0 0 12px}
.bk-time{border:1px solid var(--brand);color:var(--brand-text);background:none;border-radius:12px;padding:12px 8px;font:inherit;font-weight:600;cursor:pointer;font-variant-numeric:tabular-nums}
.bk-time:hover,.bk-time.sel{background:var(--brand);color:var(--brand-ink)}
.bk-time.cur{border-style:dashed;opacity:.6;cursor:default}
.bk-time.cur:hover{background:none;color:var(--brand-text)}
.bk-note{font-size:12.5px;color:var(--mute);margin-top:14px}
.bk-empty{color:var(--mute);font-size:14px}
.bk-form{display:grid;gap:12px;max-width:560px}
.bk-chs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.bk-ch{border:1px solid var(--line);background:var(--card2);color:inherit;border-radius:12px;padding:12px;text-align:start;font:inherit;cursor:pointer}
.bk-ch b{display:block;font-size:14px}
.bk-ch small{color:var(--mute);font-size:12px}
.bk-ch.sel{border-color:var(--brand);box-shadow:inset 0 0 0 1px var(--brand);background:var(--brand-soft)}
.bk-f label{display:block;font-size:13.5px;font-weight:500;margin-bottom:5px}
.bk-f input,.bk-f textarea{width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:11px 14px;color:var(--ink);font:inherit;font-size:16px}
.bk-f input:focus,.bk-f textarea:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.bk-f textarea{min-height:72px;resize:vertical}
.bk-f .hint{font-size:12px;color:var(--mute);margin-top:4px}
.bk-f .err{font-size:12.5px;color:var(--err);margin-top:4px}
.bk-hp{position:absolute;inset-inline-start:-9999px;width:1px;height:1px;overflow:hidden}
.bk-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bk-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--brand);color:var(--brand-ink)!important;border:1px solid var(--brand);border-radius:999px;padding:13px 26px;font:inherit;font-weight:600;font-size:15px;cursor:pointer;text-decoration:none}
.bk-btn:disabled{opacity:.6;cursor:default}
.bk-btn.sec{background:none;color:var(--brand-text)!important}
.bk-btn.sec:hover{background:var(--brand-soft)}
.bk-btn.danger{background:none;border-color:var(--line);color:var(--err)!important}
.bk-btn.danger:hover{border-color:var(--err);background:var(--err-soft)}
.bk-btn.danger.solid{background:var(--err);border-color:var(--err);color:#fff!important}
@media (prefers-color-scheme: dark){.bk-btn.danger.solid{color:#1A0B0B!important}}
.bk-ghost{background:none;border:none;color:var(--mute);font:inherit;cursor:pointer;padding:8px}
.bk-alert{border-radius:12px;padding:12px 14px;background:var(--err-soft);color:var(--err);font-size:14px}
.bk-ok{border-radius:14px;padding:14px 16px;background:var(--ok-soft);color:var(--ink);font-size:14.5px;display:flex;gap:10px;align-items:flex-start}
.bk-ok svg{color:var(--ok);flex-shrink:0;margin-top:1px}
.bk-badge{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;border-radius:999px;padding:4px 12px}
.bk-badge::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}
.bk-badge.booked{background:var(--ok-soft);color:var(--ok)}
.bk-badge.cancelled{background:var(--err-soft);color:var(--err)}
.bk-badge.past{background:var(--brand-soft);color:var(--mute)}
.bk-when{display:flex;gap:18px;align-items:center;margin:20px 0 22px}
.bk-tile{width:78px;flex-shrink:0;border-radius:16px;overflow:hidden;border:1px solid var(--line);text-align:center;background:var(--card2)}
.bk-tile .m{background:var(--brand);color:var(--brand-ink);font-size:12px;font-weight:600;padding:5px 0;letter-spacing:.04em}
.bk-tile .d{font-size:30px;font-weight:700;line-height:1.3;padding:6px 0 4px;font-variant-numeric:tabular-nums}
.bk-when-t{font-size:22px;font-weight:700;line-height:1.3}
.bk-when-s{color:var(--mute);font-size:14.5px;margin-top:3px}
.bk-when-s b{color:var(--brand-text);font-weight:600}
.bk-dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px;margin:0;border-top:1px solid var(--line)}
.bk-dl div{padding:13px 0;border-bottom:1px solid var(--line);min-width:0}
.bk-dl div.wide{grid-column:1/-1}
.bk-dl dt{font-size:12.5px;color:var(--mute);margin-bottom:2px}
.bk-dl dd{margin:0;font-size:15px;font-weight:500;overflow-wrap:anywhere;white-space:pre-line}
.bk-sent{display:flex;flex-direction:column;gap:6px;margin:18px 0 0;font-size:13.5px;color:var(--mute)}
.bk-sent span{display:flex;gap:8px;align-items:center}
.bk-sent svg{color:var(--ok);flex-shrink:0}
.bk-keep{margin-top:16px;padding:14px 16px;border-radius:14px;border:1px dashed var(--line);font-size:13.5px;color:var(--mute);display:flex;flex-direction:column;gap:10px}
.bk-keep .row{display:flex;gap:8px;flex-wrap:wrap}
.bk-keep .bk-pill{font-size:13px;padding:7px 14px}
.bk-manage{margin-top:24px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.bk-confirm{margin-top:18px;padding:18px;border-radius:16px;border:1px solid var(--err);background:var(--err-soft)}
.bk-confirm h3{margin:0 0 6px;font-size:17px}
.bk-confirm p{margin:0 0 14px;color:var(--ink);font-size:14.5px}
.bk-prep{margin-top:26px;padding-top:20px;border-top:1px solid var(--line)}
.bk-prep h3{font-size:14.5px;margin:0 0 10px}
.bk-prep ul{margin:0;padding-inline-start:20px;color:var(--mute);font-size:14px;display:grid;gap:4px}
.bk-done-head{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
.bk-foot{font-size:12px;color:var(--mute);text-align:center;margin-top:16px}
.bk-skel{height:14px;border-radius:7px;background:var(--line);margin:10px 0;animation:bkp 1.2s ease-in-out infinite}
@keyframes bkp{50%{opacity:.4}}
@media (prefers-reduced-motion: reduce){.bk-skel{animation:none}}
/* short laptop screens: a tighter rhythm, so the card and its buttons still fit without scrolling */
@media (min-width:901px) and (max-height:820px){
  .bk-top{padding-top:10px}
  .bk-brand img{height:52px}
  .bk-shell{padding-top:10px;padding-bottom:8px}
  .bk-card{min-height:calc(100vh - 118px)}
  .bk-side{padding:22px 28px;gap:12px}
  .bk-main{padding:22px 36px 22px}
  .bk-steps{margin-bottom:14px}
  .bk-h2{margin-bottom:12px}
  .bk-lead{margin-top:-6px}
  .bk-form{gap:9px}
  .bk-f input,.bk-f textarea{padding:9px 13px}
  .bk-f textarea{min-height:56px}
  .bk-f .hint{margin-top:2px}
  .bk-btn{padding:11px 24px}
  .bk-foot{margin-top:8px}
  .bk-photo{min-height:140px}
}
@media (max-width:900px){
  .bk-top{padding:12px 14px 0}
  .bk-brand span{display:none}
  .bk-brand img{height:50px}
  .bk-top-act .bk-pill{padding:0 13px;height:38px}
  .bk-top-act .bk-home-t{display:none}
  .bk-wa{width:38px;padding:0}
  .bk-wa span{display:none}
  /* phones: the app-like layout on every step — a one-row summary on top, the task, help at the bottom; no figure */
  .bk-shell{padding:12px 10px 16px;justify-content:flex-start}
  .bk-card{grid-template-columns:1fr;min-height:0;border-radius:20px;overflow:clip}
  .bk-side{border-inline-end:none;border-bottom:1px solid var(--line);padding:14px 16px;gap:8px}
  .bk-side-foot,.bk-desc,.bk-org{display:none}
  .bk-h1{font-size:19px}
  .bk-meta{flex-direction:row;flex-wrap:wrap;gap:6px 14px;font-size:13.5px}
  .bk-chosen{padding:10px 12px;font-size:14px;border-radius:12px;margin-top:2px}
  .bk-main{padding:16px 14px 20px}
  .bk-steps{margin-bottom:12px}
  .bk-h2{font-size:19px;margin-bottom:14px}
  .bk-contact.bk-ph-contact{display:flex;flex-wrap:nowrap;position:fixed;z-index:30;left:0;right:0;bottom:0;padding:10px 14px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--side);box-shadow:0 -8px 24px rgba(0,0,0,.12)}
  .bk-contact.bk-ph-contact a{flex:1 1 0;height:46px;font-size:14px}
  .bk{padding-bottom:calc(76px + env(safe-area-inset-bottom))}
  /* everything centered on a phone */
  .bk-side,.bk-main{text-align:center}
  .bk-side-head{justify-content:center}
  .bk-meta,.bk-steps,.bk-actions,.bk-done-head{justify-content:center;align-items:center}
  .bk-done-head{align-items:center}
  .bk-chosen{justify-content:center;text-align:start}
  .bk-strip-h{justify-content:center;flex-direction:column;gap:0}
  .bk-ph-times .bk-times-h{flex-direction:column;align-items:center;gap:2px}
  .bk-ph-times .bk-times{display:flex;flex-wrap:wrap;justify-content:center}
  .bk-ph-times .bk-time{flex:0 0 calc((100% - 16px) / 3)}
  .bk-type{justify-content:center;text-align:center}
  .bk-ok{justify-content:center;text-align:center}
  .bk-when{justify-content:center;text-align:start}
  .bk-sent span{justify-content:center}
  .bk-keep{align-items:stretch;text-align:center}
  .bk-prep ul{list-style:none;padding:0}
  .bk-ghost{min-height:44px}
  /* meeting type */
  .bk-type{padding:16px;border-radius:14px;min-height:64px}
  /* calendar (the month view on a phone) and times */
  .bk-time{min-height:46px}
  .bk-day{max-height:none}
  .bk-cal-wrap{grid-template-columns:1fr;gap:22px}
  .bk-times{max-height:none;display:grid;grid-template-columns:repeat(3,1fr)}
  /* details: the main button stays at the bottom of the screen while typing */
  .bk-form{gap:14px}
  .bk-chs{grid-template-columns:1fr}
  .bk-ch{min-height:56px}
  .bk-actions{position:sticky;bottom:0;z-index:2;background:var(--card);margin:0 -14px;padding:10px 14px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--line);flex-wrap:nowrap}
  .bk-actions .bk-btn{flex:1;min-height:50px}
  /* the call's page and the move confirmation: stacked, full-width buttons */
  .bk-when{gap:14px;margin:16px 0 18px}
  .bk-tile{width:64px}
  .bk-tile .d{font-size:25px}
  .bk-when-t{font-size:18px}
  .bk-dl{grid-template-columns:1fr}
  .bk-dl div{padding:11px 0}
  .bk-manage{flex-direction:column;align-items:stretch;gap:10px;margin-top:20px}
  .bk-manage .bk-btn{width:100%;min-height:50px}
  .bk-manage>a:not(.bk-btn){text-align:center;min-height:44px;display:flex;align-items:center;justify-content:center}
  .bk-confirm .bk-actions{position:static;margin:0;padding:0;border:0;background:none;flex-direction:column;align-items:stretch}
  .bk-keep .bk-pill{flex:1;justify-content:center;min-height:44px}
  .bk-prep{margin-top:22px}
}
.bk-more{display:flex;justify-content:center;margin-top:4px}
.bk-dgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.bk-dgrid .bk-dchip{width:auto;min-height:74px}
.bk-strip-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 10px}
.bk-strip-h b{font-size:14.5px;font-weight:600}
.bk-link{background:none;border:none;color:var(--brand-text);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;padding:8px 4px;min-height:40px}
.bk-strip{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding:2px 2px 10px;margin:0 -14px;padding-inline:14px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.bk-strip::-webkit-scrollbar{display:none}
.bk-dchip{flex:0 0 auto;scroll-snap-align:start;width:64px;min-height:78px;border-radius:14px;border:1px solid var(--line);background:var(--card2);color:var(--ink);font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 0}
.bk-dchip small{font-size:12px;color:var(--mute);font-weight:500}
.bk-dchip b{font-size:21px;font-weight:700;line-height:1.15;font-variant-numeric:tabular-nums}
.bk-dchip[aria-pressed=true]{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
.bk-dchip[aria-pressed=true] small{color:var(--brand-ink);opacity:.85}
.bk-dchip.cur:not([aria-pressed=true]){border:2px dashed var(--brand)}
.bk-ph-times{margin-top:14px}
.bk-ph-times .bk-times-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.bk-ph-times .bk-times-h span{font-size:12.5px;color:var(--mute);font-weight:500}
.bk-ph-times .bk-times{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.bk-ph-times .bk-time{min-height:48px;font-size:16px;border-radius:12px}
`

const Icon = {
  clock: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  video: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>,
  phone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>,
  cal: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>,
  check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>,
  tick: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>,
  wa: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>,
  back: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>,
}

const fmt = (iso, lang, o) => new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: TZ, ...o })
const timeOf = iso => new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const longWhen = (iso, lang) => `${fmt(iso, lang, { weekday: 'long', day: 'numeric', month: 'long' })}${lang === 'en' ? ' at ' : ' בשעה '}${timeOf(iso)}`
const dayLabel = (date, lang) => new Date(`${date}T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
const israelToday = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
const israelDay = iso => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ })
const monthKey = d => d.slice(0, 7)
const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7) }
const normPhone = raw => { const d = String(raw || '').replace(/\D/g, ''); return d.startsWith('972') ? '0' + d.slice(3) : d }
const prettyPhone = p => { const l = normPhone(p); return l.length === 10 ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l }
const PHONE_OK = /^0(5\d{8}|[2-489]\d{7}|7\d{8})$/
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
function track(name, params = {}) {
  try { window.dataLayer?.push({ event: name, ...params }) } catch {}
  try { if (name === 'booking_created') window.fbq?.('track', 'Schedule') } catch {}
}
const calLink = (b, title, details) => {
  const f = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${f(b.start)}/${f(b.end)}`, details, location: b.meetLink || b.zoomUrl || '', ctz: TZ })}`
}
const dayDiff = iso => Math.round((Date.parse(`${israelDay(iso)}T00:00:00Z`) - Date.parse(`${israelToday()}T00:00:00Z`)) / 864e5)

export default function BookingPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const [lang, setLang] = useState(() => (params.get('lang') === 'en' ? 'en' : 'he'))
  const t = TR[lang]
  const [cfg, setCfg] = useState(null)
  const [type, setType] = useState(null)
  const [slots, setSlots] = useState(null)
  const [loadErr, setLoadErr] = useState(false)
  const [month, setMonth] = useState(monthKey(israelToday()))
  const [day, setDay] = useState('')
  const [start, setStart] = useState('')
  // type → time → details → call   ·   call → move (time) → moveConfirm → call
  const [step, setStep] = useState(params.get('m') ? 'call' : 'type')
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '', channel: '', website: '' })
  const [errs, setErrs] = useState({})
  const [busy, setBusy] = useState(false)
  const [alert, setAlert] = useState('')
  // the call's own page
  const [mkey, setMkey] = useState(params.get('m') || '')
  const [call, setCall] = useState(null)
  const [callErr, setCallErr] = useState('')
  const [banner, setBanner] = useState('')            // 'created' | 'moved'
  const [askCancel, setAskCancel] = useState(params.get('do') === 'cancel')
  const [copied, setCopied] = useState(false)
  const headRef = useRef(null)
  // phones get the app-like layout (strip of days); the month grid stays one tap away
  const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches)
  const [monthOnPhone, setMonthOnPhone] = useState(false)
  const [moreDays, setMoreDays] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const on = () => setIsPhone(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  const moving = step === 'move' || step === 'moveConfirm'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl'
    document.title = step === 'call' ? (lang === 'en' ? 'Your call · Afik Hanahal' : 'פרטי השיחה · אפיק הנחל') : (lang === 'en' ? 'Book a call · Afik Hanahal' : 'קביעת שיחה · אפיק הנחל')
  }, [lang, step])

  useEffect(() => {
    const pre = window.__bk?.cfg
    ;(pre ? pre.catch(() => fetch(`${API}/api/meta/booking-config`).then(r => r.json())) : fetch(`${API}/api/meta/booking-config`).then(r => r.json())).then(c => {
      setCfg(c)
      if (params.get('m')) return
      const want = c.types?.find(x => x.id === params.get('type')) || (c.types?.length === 1 ? c.types[0] : null)
      if (want) { setType(want); setStep('time') }
    }).catch(() => setLoadErr(true))
  }, [params])

  // the call's page: read it once (a move / a cancel answers with the fresh call)
  useEffect(() => {
    if (!mkey || call) return
    fetch(`${API}/api/meta/booking-manage?m=${encodeURIComponent(mkey)}`).then(r => r.json()).then(d => {
      if (d.ok) { setCall(d.booking); if (!params.get('lang') && d.booking.lang) setLang(d.booking.lang) } else setCallErr(d.error === 'rate' ? 'rate' : 'notFound')
    }).catch(() => setCallErr('fail'))
  }, [mkey]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSlots = (ty = type, own = moving ? mkey : '') => {
    if (!ty || !cfg) return
    setSlots(null)
    const days = Math.min(31, (cfg.horizonDays || 21) + 1)
    // the first list may already be on its way (started by index.html before the bundle loaded)
    const pre = window.__bk
    const usePre = pre?.slots && !own && pre.days === days && pre.from === israelToday() && (pre.type === ty.id || (!pre.type && cfg.types?.[0]?.id === ty.id))
    if (pre) window.__bk = null
    ;(usePre ? pre.slots.catch(() => null) : Promise.resolve(null))
      .then(d => d || fetch(`${API}/api/meta/booking-slots?type=${encodeURIComponent(ty.id)}&from=${israelToday()}&days=${days}${own ? `&m=${encodeURIComponent(own)}` : ''}`).then(r => r.json()))
      .then(d => {
        setSlots(d.slots || {})
        const first = Object.keys(d.slots || {}).sort().find(k => d.slots[k].length)
        setDay(cur => {
          const pick = cur && d.slots?.[cur]?.length ? cur : first
          if (pick) setMonth(monthKey(pick))
          return pick || cur
        })
      })
      .catch(() => setLoadErr(true))
  }
  useEffect(() => { if (step === 'time') loadSlots() }, [type, cfg]) // eslint-disable-line react-hooks/exhaustive-deps

  // a call's page uses its own meeting type (from the config when it is still there)
  const callType = call ? (cfg?.types?.find(x => x.id === call.type.id) || call.type) : null
  const shownType = callType || type
  const channels = type?.channels || []
  useEffect(() => { if (channels.length && !channels.includes(form.channel)) setForm(f => ({ ...f, channel: channels[0] })) }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  // the heading of every new step gets the focus (keyboard / screen reader users land on it)
  useEffect(() => { if (step !== 'type' && (step !== 'call' || call || callErr)) headRef.current?.focus({ preventScroll: true }) }, [step, !!call, !!callErr]) // eslint-disable-line react-hooks/exhaustive-deps
  // on a phone the next step is below the side panel: bring it into view
  useEffect(() => {
    if (!['details', 'moveConfirm'].includes(step) && !(step === 'call' && banner)) return
    if (window.innerWidth > 900) return
    document.querySelector('.bk-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = israelToday()
  const available = slots ? Object.keys(slots).filter(k => slots[k].length).sort() : []
  const lastMonth = available.length ? monthKey(available[available.length - 1]) : month
  const grid = useMemo(() => {
    const [y, m] = month.split('-').map(Number)
    const first = new Date(Date.UTC(y, m - 1, 1))
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const cells = Array(first.getUTCDay()).fill(null)
    for (let d = 1; d <= n; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
    return cells
  }, [month])
  const monthName = new Date(`${month}-01T12:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: 'UTC', month: 'long', year: 'numeric' })

  const typeName = shownType ? (lang === 'en' ? shownType.en : shownType.he) : ''
  const typeDesc = shownType ? (lang === 'en' ? shownType.en_desc : shownType.he_desc) : ''
  const photo = cfg?.photo || ''
  const orgName = cfg ? (lang === 'en' ? cfg.title?.en : cfg.title?.he) : (lang === 'en' ? 'Afik Hanahal' : 'אפיק הנחל')
  const chLabel = c => ({ meet: t.chMeet, zoom: t.chZoom, phone: t.chPhone }[c])
  const chDesc = c => ({ meet: t.chMeetD, zoom: t.chZoomD, phone: t.chPhoneD }[c])
  const video = form.channel === 'meet' || form.channel === 'zoom'
  const pageUrl = mkey ? `${window.location.origin}/book?m=${mkey}${lang === 'en' ? '&lang=en' : ''}` : ''
  const homeHref = lang === 'en' ? '/?lang=en' : '/'

  function validate() {
    const e = {}
    if (form.name.trim().length < 2) e.name = t.errName
    if (!PHONE_OK.test(normPhone(form.phone))) e.phone = t.errPhone
    if (form.email.trim() && !EMAIL_OK.test(form.email.trim())) e.email = t.errEmail
    if (video && !form.email.trim()) e.email = t.errEmailReq
    setErrs(e)
    // the first field to fix gets the focus, so a keyboard / screen-reader user lands on it (WCAG 3.3.1)
    const first = ['name', 'phone', 'email'].find(k => e[k])
    if (first) setTimeout(() => document.getElementById(`bk-${first}`)?.focus(), 0)
    return !Object.keys(e).length
  }

  // after a booking the address becomes the call's own page, so a refresh or a bookmark keeps it
  const openCall = (key, booking, kind) => {
    setMkey(key); setCall(booking); setBanner(kind); setAskCancel(false); setAlert('')
    try { window.history.replaceState(null, '', `/book?m=${key}${lang === 'en' ? '&lang=en' : ''}`) } catch {}
    setStep('call')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit(ev) {
    ev.preventDefault()
    setAlert('')
    if (!validate()) return
    setBusy(true)
    try {
      const ref = params.get('utm_campaign') || params.get('ref') || params.get('utm_source') || ''
      const r = await fetch(`${API}/api/meta/booking-create`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, type: type.id, start, lang, ref }) })
      const d = await r.json().catch(() => ({}))
      if (d.ok) {
        track('booking_created', { booking_type: type.id, channel: form.channel })
        openCall(d.manage, d.booking, 'created')
      } else if (d.error === 'taken') { setAlert(t.taken); setStart(''); setStep('time'); loadSlots() }
      else if (d.error === 'too_many') setAlert(t.tooMany)
      else if (d.error === 'rate') setAlert(t.rate)
      else if (d.error === 'invalid' && d.errors) {
        const m = { name: t.errName, phone: t.errPhone, email: d.errors.email === 'required' ? t.errEmailReq : t.errEmail }
        setErrs(Object.fromEntries(Object.keys(d.errors).filter(k => m[k]).map(k => [k, m[k]])))
        if (d.errors.start || d.errors.channel) setAlert(t.fail)
      } else setAlert(t.fail)
    } catch { setAlert(t.fail) }
    setBusy(false)
  }

  function startMove() {
    setAlert(''); setBanner(''); setStart(''); setAskCancel(false)
    setType(callType); setDay(israelDay(call.start)); setMonth(monthKey(israelDay(call.start)))
    setStep('move')
    loadSlots(callType, mkey)
    track('booking_reschedule_open')
  }
  async function confirmMove() {
    setBusy(true); setAlert('')
    try {
      const r = await fetch(`${API}/api/meta/booking-reschedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ m: mkey, start }) })
      const d = await r.json().catch(() => ({}))
      if (d.ok) { track('booking_rescheduled'); setStart(''); openCall(mkey, d.booking, 'moved') }
      else if (d.error === 'taken') { setAlert(t.taken); setStart(''); setStep('move'); loadSlots(callType, mkey) }
      else if (t.noChange[d.error]) setAlert(t.noChange[d.error])
      else setAlert(d.error === 'rate' ? t.rate : t.fail)
    } catch { setAlert(t.fail) }
    setBusy(false)
  }
  async function confirmCancel() {
    setBusy(true); setAlert('')
    try {
      const r = await fetch(`${API}/api/meta/booking-cancel-self`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ m: mkey }) })
      const d = await r.json().catch(() => ({}))
      if (d.ok) { track('booking_cancelled'); setCall(d.booking); setAskCancel(false); setBanner(''); setTimeout(() => headRef.current?.focus(), 0) }
      else setAlert(t.noChange[d.error] || (d.error === 'rate' ? t.rate : t.fail))
    } catch { setAlert(t.fail) }
    setBusy(false)
  }
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(pageUrl); setCopied(true); setTimeout(() => setCopied(false), 2500) } catch {}
  }
  const rebook = () => {
    const ty = cfg?.types?.length === 1 ? cfg.types[0] : callType && cfg?.types?.find(x => x.id === callType.id)
    setCall(null); setMkey(''); setBanner(''); setStart(''); setAlert(''); setCallErr('')
    try { window.history.replaceState(null, '', `/book${lang === 'en' ? '?lang=en' : ''}`) } catch {}
    if (ty) { setType(ty); setStep('time'); loadSlots(ty, '') } else setStep('type')
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const waHref = `https://wa.me/${OFFICE_WA}?text=${encodeURIComponent(t.waText)}`

  // ── pieces (plain render functions, not components: the calendar keeps its buttons — and their focus — between renders)
  const flowAt = { time: 0, details: 1 }[step]
  const stepsEl = flowAt === undefined ? null : (
    <ol className="bk-steps" aria-label={t.stepOf(flowAt + 1, 3)}>
      {[t.stepTime, t.stepDetails, t.stepDone].map((s, i) => (
        <li key={s} className={i === flowAt ? 'on' : i < flowAt ? 'done' : ''} aria-current={i === flowAt ? 'step' : undefined}>
          <b>{i < flowAt ? Icon.tick : i + 1}</b>{s}
        </li>
      ))}
    </ol>
  )

  const dayChip = d => new Date(`${d}T12:00:00Z`)
  const DAYS_SHOWN = 10   // two rows of five on a phone
  const phoneCalendarEl = current => (
    <div>
      <div className="bk-strip-h">
        <b>{monthOnPhone ? monthName : t.pickDay}</b>
        <button type="button" className="bk-link" onClick={() => setMonthOnPhone(v => !v)} aria-pressed={monthOnPhone}>{monthOnPhone ? t.stripView : t.monthView}</button>
      </div>
      {monthOnPhone ? calendarEl(current, true) : (<>
        <div className="bk-dgrid" role="group" aria-label={t.pickDay}>
          {(moreDays || available.indexOf(day) >= DAYS_SHOWN ? available : available.slice(0, DAYS_SHOWN)).map(d => (
            <button key={d} type="button" className={`bk-dchip${current && d === israelDay(current) ? ' cur' : ''}`} aria-pressed={d === day} aria-label={dayLabel(d, lang)} onClick={() => { setDay(d); setStart('') }}>
              <small>{d === today ? (lang === 'en' ? 'Today' : 'היום') : dayChip(d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: 'UTC', weekday: 'short' })}</small>
              <b>{Number(d.slice(8))}</b>
              <small>{dayChip(d).toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { timeZone: 'UTC', month: 'short' })}</small>
            </button>
          ))}
        </div>
        {available.length > DAYS_SHOWN && available.indexOf(day) < DAYS_SHOWN && (
          <div className="bk-more"><button type="button" className="bk-link" aria-expanded={moreDays} onClick={() => setMoreDays(v => !v)}>{moreDays ? t.lessDays : t.moreDays(available.length - DAYS_SHOWN)}</button></div>
        )}
      </>)}
      <div className="bk-ph-times">
        <h3 className="bk-times-h">{day ? dayLabel(day, lang) : t.times}{day && (slots[day] || []).length > 0 && <span>{t.freeTimes((slots[day] || []).length)}</span>}</h3>
        <div className="bk-times">
          {(slots[day] || []).map(s => {
            const isCur = !!current && s === new Date(current).toISOString()
            return (
              <button key={s} className={`bk-time${s === start ? ' sel' : ''}${isCur ? ' cur' : ''}`} disabled={isCur} aria-label={isCur ? `${timeOf(s)} · ${t.current}` : undefined}
                onClick={() => { setStart(s); setAlert(''); setStep(moving ? 'moveConfirm' : 'details') }}>{timeOf(s)}</button>
            )
          })}
          {day && !(slots[day] || []).length && <div className="bk-empty">{t.noTimes}</div>}
        </div>
        <div className="bk-note">{t.tzNote}</div>
      </div>
    </div>
  )
  const calendarEl = (current, gridOnly = false) => gridOnly ? (
    <div>
      <div className="bk-month">
        <button className="bk-nav" aria-label={t.prevM} disabled={month <= monthKey(today)} onClick={() => setMonth(m => addMonths(m, -1))}>{lang === 'en' ? '‹' : '›'}</button>
        <span aria-live="polite">{monthName}</span>
        <button className="bk-nav" aria-label={t.nextM} disabled={month >= lastMonth} onClick={() => setMonth(m => addMonths(m, 1))}>{lang === 'en' ? '›' : '‹'}</button>
      </div>
      <div className="bk-grid">
        {t.weekdays.map(w => <div key={w} className="bk-wd" aria-hidden="true">{w}</div>)}
        {grid.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const on = !!slots[d]?.length
          return (
            <button key={d} className={`bk-day${on ? ' on' : ''}${d === day ? ' sel' : ''}${d === today ? ' today' : ''}`} disabled={!on}
              aria-label={dayLabel(d, lang)} aria-pressed={d === day} onClick={() => { setDay(d); setStart('') }}>{Number(d.slice(8))}</button>
          )
        })}
      </div>
    </div>
  ) : (
    <div className="bk-cal-wrap">
      <div>
        <div className="bk-month">
          <button className="bk-nav" aria-label={t.prevM} disabled={month <= monthKey(today)} onClick={() => setMonth(m => addMonths(m, -1))}>{lang === 'en' ? '‹' : '›'}</button>
          <span aria-live="polite">{monthName}</span>
          <button className="bk-nav" aria-label={t.nextM} disabled={month >= lastMonth} onClick={() => setMonth(m => addMonths(m, 1))}>{lang === 'en' ? '›' : '‹'}</button>
        </div>
        <div className="bk-grid">
          {t.weekdays.map(w => <div key={w} className="bk-wd" aria-hidden="true">{w}</div>)}
          {grid.map((d, i) => {
            if (!d) return <div key={`e${i}`} />
            const on = !!slots[d]?.length
            const cur = current && d === israelDay(current)
            return (
              <button key={d} className={`bk-day${on ? ' on' : ''}${d === day ? ' sel' : ''}${d === today ? ' today' : ''}${cur ? ' cur' : ''}`} disabled={!on}
                aria-label={dayLabel(d, lang)} aria-pressed={d === day} onClick={() => { setDay(d); setStart('') }}>
                {Number(d.slice(8))}
              </button>
            )
          })}
        </div>
        <div className="bk-note">{t.tzNote}</div>
      </div>
      <div>
        <h3 className="bk-times-h">{day ? dayLabel(day, lang) : t.times}</h3>
        <div className="bk-times">
          {(slots[day] || []).map(s => {
            const isCur = !!current && s === new Date(current).toISOString()
            return (
              <button key={s} className={`bk-time${s === start ? ' sel' : ''}${isCur ? ' cur' : ''}`} disabled={isCur} aria-label={isCur ? `${timeOf(s)} · ${t.current}` : undefined}
                onClick={() => { setStart(s); setAlert(''); setStep(moving ? 'moveConfirm' : 'details') }}>{timeOf(s)}</button>
            )
          })}
          {day && !(slots[day] || []).length && <div className="bk-empty">{t.noTimes}</div>}
        </div>
      </div>
    </div>
  )

  const statusText = { booked: t.stBooked, cancelled: t.stCancelled, past: t.stPast }
  const relDay = iso => { const n = dayDiff(iso); return n === 0 ? t.today : n === 1 ? t.tomorrow : n > 1 && n < 15 ? t.inDays(n) : '' }

  const callPageEl = () => {
    if (callErr) return (
      <>
        <h2 className="bk-h2" ref={headRef} tabIndex={-1}>{t.callPage}</h2>
        <div className="bk-alert" role="alert">{t[callErr] || t.fail}</div>
        <div className="bk-manage"><button className="bk-btn" onClick={rebook}>{t.rebook}</button><a className="bk-btn sec" href={waHref} target="_blank" rel="noreferrer">{t.writeUs}</a></div>
      </>
    )
    if (!call) return <div aria-busy="true">{[60, 85, 70, 90, 50].map((w, i) => <div key={i} className="bk-skel" style={{ width: `${w}%` }} />)}</div>
    const cancelled = call.status === 'cancelled', past = call.status === 'past'
    const live = !cancelled && !past
    const rel = live ? relDay(call.start) : ''
    const title = cancelled ? t.cancelledTitle : banner === 'created' ? t.created : banner === 'moved' ? t.moved : t.callPage
    const calTitle = `${typeName} · ${lang === 'en' ? 'Afik Hanahal' : 'אפיק הנחל'}`
    return (
      <>
        <div className="bk-done-head">
          <span className={`bk-badge ${call.status}`}>{statusText[call.status]}</span>
          <h2 className="bk-h2" style={{ margin: 0 }} ref={headRef} tabIndex={-1}>{title}</h2>
        </div>
        {banner && live && <div className="bk-ok" role="status" style={{ marginTop: 14 }}>{Icon.check}<span>{banner === 'created' ? t.createdSub : t.movedSub}</span></div>}
        {cancelled && <p style={{ color: 'var(--mute)', margin: '10px 0 0' }}>{t.cancelledSub}</p>}
        {past && <p style={{ color: 'var(--mute)', margin: '10px 0 0' }}>{t.pastSub}</p>}

        <div className="bk-when" style={cancelled ? { opacity: .6 } : undefined}>
          <div className="bk-tile" aria-hidden="true">
            <div className="m">{fmt(call.start, lang, { month: 'short' })}</div>
            <div className="d">{fmt(call.start, 'en', { day: 'numeric' })}</div>
          </div>
          <div>
            <div className="bk-when-t" style={cancelled ? { textDecoration: 'line-through' } : undefined}>{fmt(call.start, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <div className="bk-when-s"><span dir="ltr">{timeOf(call.start)}–{timeOf(call.end)}</span>{rel && <> · <b>{rel}</b></>} · {t.tzNote}</div>
          </div>
        </div>

        <dl className="bk-dl">
          <div><dt>{t.dType}</dt><dd>{typeName}</dd></div>
          <div><dt>{t.dLen}</dt><dd>{t.minutes(call.type.minutes)}</dd></div>
          <div className="wide"><dt>{t.dHow}</dt><dd>{call.channel === 'phone' ? t.weCall(prettyPhone(call.phone)) : `${chLabel(call.channel)} · ${chDesc(call.channel)}`}</dd></div>
          {(call.meetLink || call.zoomUrl) && <div className="wide"><dt>{t.dLink}</dt><dd><a href={call.meetLink || call.zoomUrl} target="_blank" rel="noreferrer" dir="ltr">{(call.meetLink || call.zoomUrl).replace(/^https:\/\//, '')}</a></dd></div>}
          <div><dt>{t.dName}</dt><dd>{call.name}</dd></div>
          <div><dt>{t.dPhone}</dt><dd><bdi dir="ltr">{prettyPhone(call.phone)}</bdi></dd></div>
          {call.email && <div className="wide"><dt>{t.dEmail}</dt><dd><bdi dir="ltr">{call.email}</bdi></dd></div>}
          {call.notes && <div className="wide"><dt>{t.dNotes}</dt><dd>{call.notes}</dd></div>}
        </dl>

        {live && (call.whatsapp || call.emailed) && (
          <div className="bk-sent">
            {call.whatsapp && <span>{Icon.tick}{t.sentWa(prettyPhone(call.phone))}</span>}
            {call.emailed && <span>{Icon.tick}{t.sentMail(call.email)}</span>}
          </div>
        )}
        {live && banner && (
          <div className="bk-keep">
            {t.keepLink}
            <div className="row">
              <button className="bk-pill" onClick={copyLink}><span aria-live="polite">{copied ? t.copied : t.copy}</span></button>
              <a className="bk-pill" href={`https://wa.me/?text=${encodeURIComponent(t.selfWa(longWhen(call.start, lang), pageUrl))}`} target="_blank" rel="noreferrer">{t.saveWa}</a>
            </div>
          </div>
        )}

        {alert && <div className="bk-alert" role="alert" style={{ marginTop: 16 }}>{alert}</div>}

        {askCancel && call.canChange ? (
          <div className="bk-confirm" role="group" aria-labelledby="bk-cq" aria-describedby="bk-cq-d">
            <h3 id="bk-cq">{t.cancelQ}</h3>
            <p id="bk-cq-d">{typeName} · {longWhen(call.start, lang)}</p>
            <div className="bk-actions">
              <button className="bk-btn danger solid" disabled={busy} onClick={confirmCancel} ref={el => el && !busy && el !== document.activeElement && askCancel === true && (el.focus(), setAskCancel('shown'))}>{busy ? t.cancelling : t.cancelYes}</button>
              <button className="bk-btn sec" onClick={() => setAskCancel(false)}>{t.cancelNo}</button>
            </div>
          </div>
        ) : (
          <div className="bk-manage">
            {call.canChange && <button className="bk-btn" onClick={startMove}>{Icon.cal}{t.reschedule}</button>}
            {call.canChange && !call.invite && <a className="bk-btn sec" href={calLink(call, calTitle, pageUrl)} target="_blank" rel="noreferrer">{t.addCal}</a>}
            {call.canChange && <button className="bk-btn danger" onClick={() => setAskCancel(true)}>{t.cancel}</button>}
            {(cancelled || past) && <button className="bk-btn" onClick={rebook}>{cancelled ? t.rebook : t.another}</button>}
            {!call.canChange && call.why === 'limit' && <div className="bk-note" style={{ marginTop: 0 }}>{t.noChange.limit}</div>}
            <a href={waHref} target="_blank" rel="noreferrer" style={{ fontSize: 14, padding: '8px 4px' }}>{t.writeUs}</a>
          </div>
        )}

        {live && (
          <div className="bk-prep">
            <h3>{t.prepH}</h3>
            <ul>{t.prep.map(x => <li key={x}>{x}</li>)}</ul>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="bk" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <style>{CSS}</style>
      <header className="bk-top">
        <a className="bk-brand" href={homeHref} aria-label={orgName}>
          <picture>
            <source srcSet="/logo-black.svg" media="(prefers-color-scheme: light)" />
            <img src="/logo.svg" alt="" />
          </picture>
          <span>{orgName}</span>
        </a>
        <div className="bk-top-act">
          <a className="bk-wa" href={waHref} target="_blank" rel="noreferrer" aria-label={t.waTip} title={t.waTip}>{Icon.wa}<span>{t.wa}</span></a>
          <a className="bk-pill" href={homeHref} aria-label={t.home}><span aria-hidden="true" style={{ display: 'inline-flex', transform: lang === 'en' ? 'none' : 'scaleX(-1)' }}>{Icon.back}</span><span className="bk-home-t">{t.home}</span></a>
          <button className="bk-pill" lang={lang === 'en' ? 'he' : 'en'} onClick={() => setLang(l => (l === 'en' ? 'he' : 'en'))}>{t.langBtn}</button>
        </div>
      </header>

      <main className="bk-shell">
        <div className="bk-card">
          <aside className="bk-side">
            <div className="bk-side-head">
              <div>
                <div className="bk-org">{orgName}</div>
                <h1 className="bk-h1">{typeName || (mkey ? t.callPage : t.pick)}</h1>
              </div>
            </div>
            {shownType && (
              <div className="bk-meta">
                <span>{Icon.clock}{t.minutes(shownType.minutes)}</span>
                {(call ? [call.channel] : shownType.channels || []).map(c => <span key={c}>{c === 'phone' ? Icon.phone : Icon.video}{chLabel(c)}</span>)}
              </div>
            )}
            {typeDesc && <p className="bk-desc">{typeDesc}</p>}
            {moving && call && <div className="bk-chosen old">{Icon.cal}<span><small>{t.current}</small>{longWhen(call.start, lang)}</span></div>}
            {start && (step === 'details' || step === 'moveConfirm') && <div className="bk-chosen">{Icon.cal}<span>{moving && <small>{t.newTime}</small>}{longWhen(start, lang)}</span></div>}
            <div className="bk-side-foot">
              {photo && !isPhone && <figure className="bk-photo"><img src={photo} alt={t.photoAlt} decoding="async" width="454" height="1100"/></figure>}
              <div className="bk-contact">
                <a className="wa" href={waHref} target="_blank" rel="noreferrer" aria-label={t.waTip}><span className="ic">{Icon.wa}</span>{t.wa}</a>
                <a href={`tel:0${OFFICE_WA.slice(3)}`} aria-label={`${t.call} 055-981-1814`}><span className="ic" style={{ color: 'var(--brand-text)' }}>{Icon.phone}</span><bdi dir="ltr">055-981-1814</bdi></a>
              </div>
            </div>
          </aside>

          <section className="bk-main">
            {loadErr && <div className="bk-alert">{t.loadErr}</div>}

            {!loadErr && !cfg && step !== 'call' && <div aria-busy="true">{[70, 90, 55, 80].map((w, i) => <div key={i} className="bk-skel" style={{ width: `${w}%` }} />)}</div>}

            {cfg && step === 'type' && (
              <>
                <h2 className="bk-h2">{t.pick}</h2>
                <div className="bk-types">
                  {cfg.types.map(x => (
                    <button key={x.id} className="bk-type" onClick={() => { setType(x); setStep('time') }}>
                      <span style={{ color: 'var(--brand-text)', marginTop: 3 }}>{Icon.cal}</span>
                      <span><b>{lang === 'en' ? x.en : x.he}</b><small>{t.minutes(x.minutes)} · {x.channels.map(chLabel).join(' · ')}</small></span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {cfg && (step === 'time' || step === 'move') && (
              <>
                {stepsEl}
                <h2 className="bk-h2" ref={headRef} tabIndex={-1}>{step === 'move' ? t.moveTitle : t.chooseDay}</h2>
                {alert && <div className="bk-alert" role="alert" style={{ marginBottom: 14 }}>{alert}</div>}
                {!slots && !loadErr && <div className="bk-empty">{t.loading}</div>}
                {slots && !available.length && <div className="bk-empty">{t.nothing} <a href={waHref} target="_blank" rel="noreferrer">WhatsApp</a></div>}
                {slots && available.length > 0 && (isPhone ? phoneCalendarEl(step === 'move' ? call?.start : null) : calendarEl(step === 'move' ? call?.start : null))}
                <div style={{ marginTop: 20 }}>
                  {step === 'move'
                    ? <button className="bk-ghost" onClick={() => { setStep('call'); setStart(''); setAlert('') }}>{lang === 'en' ? '←' : '→'} {t.back}</button>
                    : cfg.types.length > 1 && <button className="bk-ghost" onClick={() => { setStep('type'); setStart('') }}>{lang === 'en' ? '←' : '→'} {t.back}</button>}
                </div>
              </>
            )}

            {cfg && step === 'moveConfirm' && call && (
              <>
                <h2 className="bk-h2" ref={headRef} tabIndex={-1}>{t.moveQ}</h2>
                <dl className="bk-dl">
                  <div><dt>{t.current}</dt><dd style={{ textDecoration: 'line-through', color: 'var(--mute)' }}>{longWhen(call.start, lang)}</dd></div>
                  <div><dt>{t.newTime}</dt><dd style={{ fontWeight: 700 }}>{longWhen(start, lang)}</dd></div>
                </dl>
                {alert && <div className="bk-alert" role="alert" style={{ marginTop: 16 }}>{alert}</div>}
                <div className="bk-manage">
                  <button className="bk-btn" disabled={busy} onClick={confirmMove}>{busy ? t.moving : t.moveYes}</button>
                  <button className="bk-btn sec" onClick={() => { setStep('move'); setAlert('') }}>{t.back}</button>
                </div>
              </>
            )}

            {cfg && step === 'details' && (
              <form className="bk-form" onSubmit={submit} noValidate>
                {stepsEl}
                {channels.length > 1 ? <>
                  <h2 className="bk-h2" style={{ margin: 0 }} ref={headRef} tabIndex={-1}>{t.how}</h2>
                  <div className="bk-chs" role="radiogroup" aria-label={t.how}>
                    {channels.map(c => (
                      <button type="button" key={c} role="radio" aria-checked={form.channel === c} className={`bk-ch${form.channel === c ? ' sel' : ''}`} onClick={() => setForm(f => ({ ...f, channel: c }))}>
                        <b>{chLabel(c)}</b><small>{chDesc(c)}</small>
                      </button>
                    ))}
                  </div>
                  <h2 className="bk-h2" style={{ margin: '6px 0 0' }}>{t.details}</h2>
                </> : <>
                  <h2 className="bk-h2" style={{ margin: 0 }} ref={headRef} tabIndex={-1}>{t.details}</h2>
                  {channels[0] && <p className="bk-lead">{channels[0] === 'phone' ? t.howPhone : t.howVideo}</p>}
                </>}
                <div className="bk-f">
                  <label htmlFor="bk-name">{t.name}</label>
                  <input id="bk-name" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errs.name} aria-required="true" aria-describedby={errs.name ? 'bk-name-err' : undefined} />
                  {errs.name && <div className="err" id="bk-name-err">{errs.name}</div>}
                </div>
                <div className="bk-f">
                  <label htmlFor="bk-phone">{t.phone}</label>
                  <input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" style={{ textAlign: lang === 'en' ? 'left' : 'right' }} value={form.phone} onChange={set('phone')} aria-invalid={!!errs.phone} aria-required="true" aria-describedby={errs.phone ? 'bk-phone-err' : undefined} />
                  {errs.phone && <div className="err" id="bk-phone-err">{errs.phone}</div>}
                </div>
                <div className="bk-f">
                  <label htmlFor="bk-email">{video ? t.email : t.emailOpt}</label>
                  <input id="bk-email" type="email" inputMode="email" autoComplete="email" dir="ltr" style={{ textAlign: lang === 'en' ? 'left' : 'right' }} value={form.email} onChange={set('email')} aria-invalid={!!errs.email} aria-required={video || undefined} aria-describedby={errs.email ? 'bk-email-err' : 'bk-email-hint'} />
                  {errs.email ? <div className="err" id="bk-email-err">{errs.email}</div> : <div className="hint" id="bk-email-hint">{video ? t.emailHintVideo : t.emailHint}</div>}
                </div>
                <div className="bk-f">
                  <label htmlFor="bk-notes">{t.notes}</label>
                  <textarea id="bk-notes" placeholder={t.notesPh} value={form.notes} onChange={set('notes')} maxLength={1000} />
                </div>
                <div className="bk-hp" aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></div>
                {alert && <div className="bk-alert" role="alert">{alert}</div>}
                <div className="bk-actions">
                  <button className="bk-btn" disabled={busy}>{busy ? t.sending : t.confirm}</button>
                  <button type="button" className="bk-ghost" onClick={() => setStep('time')}>{t.back}</button>
                </div>
                <div className="bk-note" style={{ marginTop: 0 }}>{t.privacy}</div>
              </form>
            )}

            {step === 'call' && callPageEl()}
          </section>
        </div>
        <div className="bk-foot">{orgName} · <a href={homeHref} style={{ color: 'inherit' }}>afikhanahal.co.il</a></div>
      </main>
      {step !== 'details' && (
        <div className="bk-contact bk-ph-contact">
          <a className="wa" href={waHref} target="_blank" rel="noreferrer" aria-label={t.waTip}><span className="ic">{Icon.wa}</span>{t.wa}</a>
          <a href={`tel:0${OFFICE_WA.slice(3)}`} aria-label={`${t.call} 055-981-1814`}><span className="ic" style={{ color: 'var(--brand-text)' }}>{Icon.phone}</span><bdi dir="ltr">055-981-1814</bdi></a>
        </div>
      )}
    </div>
  )
}
