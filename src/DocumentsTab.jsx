// Admin "מסמכים וחתימות" (/admin-panel/documents): the office's brokerage-order documents from a template to a signed PDF.
// A dashboard row (created · waiting · signed · problems), the list (search, status / date filters, sort, a row opens the
// document), "+ יצירת מסמך חדש" = a wizard with the form on one side and the live A4 preview (src/DocPreview.jsx) on the
// other (lead / client → property → terms and fees, clause 6's percent editable → preview → send by WhatsApp / email), the
// document drawer (status, the send log, the audit chain, files: the PDF sent, the signed PDF, Word; resend, a fresh link,
// cancel), and settings (VAT, default agent, office notify numbers / email, logo, the clause editor). API: /api/meta/docs-*.
// Everything here uses the admin tokens (T.* / var(--au-*)) and works in light / dark, RTL and on a phone.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, FileSignature, Plus, Search, Send, RefreshCw, Download, Link2, XCircle, Settings, Eye, Copy, Check, AlertTriangle, ChevronLeft, ChevronRight, FileText, Trash2, Upload, Clock, CheckCircle2, PenLine, Mail, MessageCircle, FolderKanban, Cloud, Bell, Users, ExternalLink, Building2, Zap } from 'lucide-react'
import { T, Button, IconButton, StatTile, FilterChip, Badge, EmptyState, Field, inputStyle, Modal, Drawer, useToasts, SectionHead } from './automationsUI.jsx'
import { autoApi } from './AutomationsApi.jsx'
import DocSheet, { DOC_CSS } from './DocPreview.jsx'
import { onSync } from './lib/syncBus.js'
import { SIGN_MESSAGES, SIGN_MESSAGE_IDS, signMessage, signMessagePreview, suggestSignMessage, docFunnel, fmtHours, docMonthKey, verifyLabel, computeFees, renderClauses, cleanDocInput, DEFAULT_CLAUSES, DOC_TYPES, CLIENT_ROLES, DEAL_TYPES, FEE_MODES, STATUS_HE, EVENT_HE, DEFAULT_VAT, docStats, effectiveStatus, fmtMoney, fmtPct, whenHe, todayHe, placeholderValues, PLACEHOLDERS, SIGNER_ROLES, MAX_SIGNERS, signerProgressText, signerInfo, DEFAULT_REMINDERS, DEFAULT_NOTIFY_ON, propertyToDoc } from '../lib/documents.js'
import { leadProperty } from '../lib/automations-shared.js'
import { useProjects } from './lib/projectsStore.js'
import { projectOfLead } from '../lib/projects.js'
import { ProjectSelect } from './LeadProjects.jsx'
import TemplateEditor, { TemplateUpload, TE_CSS } from './TemplateEditor.jsx'
import { templateValues, renderBlocks, missingFields, brokerageTemplate, templateKeys, STANDARD_FIELDS } from '../lib/doc-templates.js'

const AUTH = { Authorization: 'Bearer AFIKhanahal2026' }
const TR = {
  he: {
    title: 'ניהול מסמכים', sub: 'כל מסמך של המשרד — מתבנית, דרך שליחה ללקוח, עד עותק חתום בכרטיס הליד ובפרויקט', newDoc: 'יצירת מסמך חדש', settings: 'הגדרות', refresh: 'רענון',
    areas: { overview: 'סקירה', docs: 'כל המסמכים', templates: 'תבניות', settings: 'הגדרות' }, uploadTpl: 'העלאת מסמך חדש', blankTpl: 'תבנית ריקה', builtin: 'מובנית', tplEdit: 'עריכה', tplUse: 'מסמך חדש מהתבנית', tplDel: 'מחיקה', tplDelAsk: 'למחוק את התבנית? מסמכים שכבר נוצרו ממנה נשארים.', tplFields: n => `${n} שדות משלה`, tplBlocks: n => `${n} פסקאות`, tplNone: 'עדיין אין תבניות משלכם. "העלאת מסמך חדש" הופך כל Word / PDF / סריקה לתבנית עם שדות.',
    by: { project: 'לפי פרויקט', agent: 'לפי סוכן', type: 'לפי סוג מסמך', month: 'לפי חודש' }, noProject: 'ללא פרויקט', projectAll: 'כל הפרויקטים', projectDocs: 'מסמכי הפרויקט', pct: 'השלמת חתימות', openProject: 'לפרויקט', clearProject: 'כל המסמכים',
    stepTpl: 'תבנית', stepFields: 'פרטי המסמך', tplPick: 'איזה מסמך?', fieldsHint: 'השדות של התבנית הזו — ממלאים פעם אחת לכל מסמך. שדות מסומנים ב-* הם חובה.', missingStd: 'שדות מהמערכת שעדיין ריקים במסמך הזה:', project: 'פרויקט', agent: 'סוכן',
    tiles: { total: 'מסמכים שנוצרו', waiting: 'ממתינים לחתימה', signed: 'נחתמו', problem: 'פג תוקף / נכשל' },
    filters: { all: 'הכל', waiting: 'ממתינים לחתימה', signed: 'נחתמו', draft: 'טיוטות', problem: 'בעיות', cancelled: 'בוטלו' }, templates: 'תבניות',
    search: 'חיפוש לפי שם, טלפון, אימייל, מספר מסמך או נכס…', range: { all: 'כל הזמן', week: '7 ימים', month: '30 יום', quarter: '90 יום' },
    cols: { drive: 'Drive', number: 'מספר', type: 'סוג', client: 'לקוח', project: 'פרויקט', property: 'נכס', agent: 'סוכן', fees: 'דמי תיווך', created: 'נוצר', sent: 'נשלח', via: 'ערוץ', opened: 'נפתח', status: 'סטטוס', signed: 'נחתם', actions: '' },
    empty: 'עדיין אין מסמכים. "יצירת מסמך חדש" פותח את הטופס עם תצוגה חיה.', emptyFilter: 'אין מסמכים שמתאימים לסינון.',
    open: 'פתיחה', download: 'הורדת PDF', resend: 'שליחה חוזרת', cancel: 'ביטול המסמך', signedCopy: 'העותק החתום', word: 'Word', link: 'קישור חדש', copy: 'העתקה', copied: 'הועתק ✓',
    steps: ['תבנית', 'לקוח ופרויקט', 'נכס', 'תנאי התיווך', 'פרטי המסמך', 'תצוגה מקדימה', 'שליחה'], next: 'הבא', back: 'חזרה', saveDraft: 'שמירת טיוטה', sendNow: 'שליחה לחתימה', saving: 'שומר…', sending: 'שולח…',
    pickLead: 'בחירת ליד מהמערכת', leadPh: 'חיפוש לפי שם או טלפון…', noLead: 'ללא ליד (לקוח חדש)', leadNote: 'המסמך יישמר בכרטיס הליד. לקוח שעדיין לא במערכת — מספיק טלפון או אימייל.',
    client: { first: 'שם פרטי', last: 'שם משפחה', name: 'שם מלא', id: 'ת.ז.', phone: 'טלפון', email: 'אימייל', address: 'כתובת מגורים', role: 'הלקוח בעסקה' },
    pickProp: 'בחירת נכס מהמערכת', propPh: 'חיפוש נכס…', noProp: 'נכס שלא במערכת', property: { address: 'כתובת הנכס', city: 'עיר', desc: 'תיאור הנכס', type: 'סוג הנכס', dealType: 'סוג העסקה', price: 'מחיר העסקה לפני מע"מ (₪)', notes: 'הערות', link: 'קישור לנכס' },
    fees: { mode: 'בסיס דמי התיווך', pct: 'אחוז דמי התיווך', quick: 'מהיר:', custom: 'אחר', fixed: 'סכום קבוע (₪, לפני מע"מ)', months: 'חודשי שכירות', vat: 'שיעור מע"מ (%)', terms: 'תנאים מסחריים נוספים (נכנסים לסעיף 6)', agent: 'הסוכן', agentName: 'שם הסוכן', license: 'מספר רישיון', agentPhone: 'טלפון', agentEmail: 'אימייל', expiry: 'תוקף הקישור (ימים)', summary: 'חישוב' },
    logo: { title: 'לוגו ומיתוג', show: 'הצגת הלוגו', size: 'גודל', align: 'מיקום', sizes: { s: 'קטן', m: 'בינוני', l: 'גדול' }, aligns: { right: 'ימין', center: 'מרכז', left: 'שמאל' }, upload: 'החלפת לוגו (PNG / JPG)', reset: 'הלוגו של אפיק הנחל', uploading: 'מעלה…' },
    preview: 'תצוגה מקדימה', previewHint: 'כל שינוי בטופס מתעדכן כאן מיד. ה-PDF שיישלח נראה בדיוק כך.', openPdf: 'פתיחת ה-PDF', downloadWord: 'הורדה כ-Word',
    send: { title: 'שליחה לחתימה', via: 'איך לשלוח', wa: 'וואטסאפ', email: 'אימייל', both: 'גם וגם', to: 'אל', personal: 'משפט אישי (לא חובה)', personalPh: 'כמו שדיברנו, הטופס לדירה בזרובבל…', expiry: 'הקישור בתוקף', days: 'ימים', note: 'הלקוח מקבל קישור אישי, קורא את המסמך וחותם בטלפון או במחשב. אחרי החתימה שני הצדדים מקבלים עותק חתום, המשרד מקבל הודעה, והכל נרשם בכרטיס הליד.', missing: 'ללקוח אין טלפון ואין אימייל — חזרו לשלב הלקוח.' },
    sentOk: 'נשלח לחתימה ✓', sentPart: 'נשלח חלקית', sentFail: 'השליחה נכשלה', linkReady: 'קישור חדש מוכן — העתיקו ושלחו בכל דרך', cancelled: 'המסמך בוטל', cancelAsk: 'לבטל את המסמך? הקישור ללקוח יפסיק לעבוד.',
    drawer: { files: 'קבצים', events: 'תיעוד (שרשרת אירועים)', chainOk: 'שרשרת התיעוד שלמה', chainBad: 'שרשרת התיעוד לא תקינה!', sendLog: 'שליחות', signature: 'פרטי החתימה', none: '—', lead: 'כרטיס הליד', noLead: 'לא מקושר לליד', hash: 'SHA-256' },
    st: STATUS_HE,
    signers: { title: 'חותמים נוספים', hint: 'בן/בת זוג, שותף או ערב שחותמים אחרי הלקוח, לפי הסדר: כל אחד מקבל את הקישור רק אחרי שהקודם חתם.', add: 'חותם נוסף', name: 'שם מלא', role: 'תפקיד', remove: 'הסרה', progress: 'חתמו', waiting: 'ממתין', sent: 'הקישור נשלח', opened: 'פתח', signed: 'חתם', current: 'תורו עכשיו' },
    drive: { title: 'Google Drive', col: 'Drive', synced: 'נשמר ב-Drive', pending: 'ממתין לסנכרון', error: 'שגיאת סנכרון', failed: 'הסנכרון נכשל', off: 'לא מחובר', sync: 'סנכרון עכשיו', open: 'פתיחה ב-Drive', connect: 'חיבור Google Drive', disconnect: 'ניתוק', connected: 'מחובר', notConnected: 'לא מחובר', enabled: 'שמירה אוטומטית של כל מסמך שנשלח ונחתם', folder: 'התיקייה', tree: 'Afik HaNahal / Documents / Projects / <פרויקט> / Sent Documents · Signed Documents (ו-General לפי מסמך בלי פרויקט, Templates לתבניות)', naming: 'שם הקובץ: [פרויקט]_[לקוח]_[סוג]_[תאריך]_[Sent | Signed].pdf', setup: 'מחברים פעם אחת: צריך שב-Google Cloud של היומן יהיה מופעל "Google Drive API" (אותו פרויקט ואותו OAuth client כמו היומן). לוחצים "חיבור Google Drive", מתחברים כ-afik.hanahal@gmail.com ומאשרים גישה לקבצים שהמערכת יוצרת בלבד.', counts: { synced: 'נשמרו', pending: 'ממתינים', error: 'בשגיאה', failed: 'נכשלו' }, queue: 'התור רץ כל 15 דקות (auto-tick) ואחרי כל שליחה או חתימה; "סנכרון עכשיו" מריץ אותו מיד.' },
    remind: { title: 'תזכורות והתראות', enabled: 'לשלוח תזכורת למי שעוד לא חתם', days: 'ימים אחרי שליחת הקישור (מופרדים בפסיק)', hours: 'שעות שליחה (ישראל)', from: 'מ-', to: 'עד', hint: 'תזכורת אחת ביום לכל היותר, לחותם שתורו עכשיו, באותו קישור שכבר אצלו. לא למסמך שנחתם, בוטל או פג.', notifyOn: 'התראת וואטסאפ למשרד כש…', on: { opened: 'הלקוח פתח את המסמך', partial: 'חותם חתם וממתינים לבא', signed: 'המסמך נחתם (כולל אימייל ועותק)', expired: 'הקישור פג בלי חתימה', failed: 'שליחה נכשלה', reminder: 'נשלחה תזכורת' }, sentList: 'תזכורות שנשלחו', none: 'עוד לא נשלחו תזכורות', now: 'שליחת תזכורת עכשיו', off: 'בלי תזכורות למסמך הזה', offOn: 'התזכורות למסמך הזה כבויות', nowOk: 'התזכורת נשלחה ✓', nowFail: 'התזכורת לא נשלחה' },
    settingsT: { title: 'הגדרות המסמכים', vat: 'שיעור מע"מ (%)', expiry: 'תוקף קישור ברירת מחדל (ימים)', agent: 'סוכן ברירת מחדל', notify: 'מספרי וואטסאפ להתראה על חתימה (בנוסף לקו המשרד)', notifyPh: '05X-XXX-XXXX, מופרד בפסיקים', notifyEmail: 'אימייל להתראה על חתימה', logo: 'לוגו ברירת מחדל', clauses: 'סעיפי ההתקשרות (התבנית)', clausesHint: 'כאן מדביקים את הנוסח המדויק של טופס המאסטר. משתנים בסוגריים מסולסלים מתמלאים מהמסמך:', reset: 'חזרה לנוסח הבסיס', save: 'שמירה', saved: 'נשמר ✓', wiring: 'חיבורים', db: 'מסד נתונים', wa: 'וואטסאפ (Green API)', email: 'אימייל (Gmail)', provider: 'ספק חתימה', ok: 'מחובר', missing: 'חסר' },
    legal: 'הנוסח המשפטי הוא באחריות המשרד. לפני שימוש מסחרי מומלץ אישור עורך דין, כולל לגבי תוקף החתימה האלקטרונית ואופן הזיהוי.',
  },
}
TR.en = TR.he

const api = {
  get: (a, q = {}) => fetch(`/api/meta/${a}${Object.keys(q).length ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(q).filter(([, v]) => v != null && v !== ''))) : ''}`, { headers: AUTH, signal: AbortSignal.timeout(30000) }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || (d.errors || []).join(' · ') || `HTTP ${r.status}`); return d }),
  post: (a, body) => autoApi.post(a, body),
}
const fileUrl = (id, kind, dl = false) => `/api/meta/docs-file?id=${encodeURIComponent(id)}&kind=${kind}${dl ? '&dl=1' : ''}`
const TONE = { draft: T.grey, sent: T.amber, opened: T.blue, signed: T.green, expired: T.red, cancelled: T.grey, failed: T.red }
const STATUS_ICON = { draft: PenLine, sent: Clock, opened: Eye, signed: CheckCircle2, expired: AlertTriangle, cancelled: XCircle, failed: AlertTriangle }
const localPhone = p => { const d = String(p || '').replace(/\D/g, ''); const l = d.startsWith('972') ? '0' + d.slice(3) : d; return l.length === 10 ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l }
const propLine = d => [d?.property?.address, d?.property?.city].filter(Boolean).join(', ')

export const DOCS_CSS = `
.dt{direction:rtl;color:var(--au-text);font-family:Rubik,sans-serif;display:flex;flex-direction:column;gap:14px;padding:0 0 40px}
.dt-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.dt-head h2{margin:0;font-size:21px;font-weight:600;letter-spacing:-.01em;display:flex;align-items:center;gap:10px}
.dt-head p{margin:4px 0 0;color:var(--au-text3);font-size:13px}
.dt-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}
.dt-tile{background:var(--au-card);border:1px solid var(--au-line);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;cursor:pointer;text-align:start;font:inherit;color:inherit;transition:border-color .12s}
.dt-tile:hover,.dt-tile.on{border-color:rgba(var(--brand-rgb),.5)}
.dt-tile b{font-size:26px;font-weight:600;line-height:1.1}.dt-tile span{font-size:12.5px;color:var(--au-text3)}
.dt-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dt-search{flex:1 1 260px;min-width:200px;display:flex;align-items:center;gap:8px;height:38px;border-radius:999px;border:1px solid var(--au-line);background:rgba(var(--ov),.04);padding:0 14px;color:var(--au-text3)}
.dt-search input{flex:1;border:none;background:transparent;color:var(--au-text);font:inherit;font-size:13.5px;outline:none;min-height:0}
.dt-table{width:100%;border-collapse:separate;border-spacing:0;background:var(--au-card);border:1px solid var(--au-line);border-radius:14px;overflow:hidden;font-size:13.5px}
.dt-table th{text-align:start;font-weight:600;color:var(--au-text3);font-size:12px;padding:10px 12px;border-bottom:1px solid var(--au-line);background:rgba(var(--ov),.03);white-space:nowrap}
.dt-table td{padding:10px 12px;border-bottom:1px solid var(--au-divider);vertical-align:middle}
.dt-table tr:last-child td{border-bottom:none}
.dt-table tbody tr{cursor:pointer}.dt-table tbody tr:hover td{background:rgba(var(--ov),.035)}
.dt-num{font-variant-numeric:tabular-nums;direction:ltr;display:inline-block;color:var(--au-text2)}
.dt-st{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:3px 10px 3px 8px;font-size:12px;font-weight:600;white-space:nowrap}
.dt-st i{width:8px;height:8px;border-radius:50%;display:inline-block}
.dt-acts{display:flex;gap:4px;justify-content:flex-end}
.dt-ib{width:30px;height:30px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--au-text3);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;min-height:0;min-width:0;padding:0}
.dt-ib:hover{border-color:var(--au-line);color:var(--au-text);background:rgba(var(--ov),.05)}
.dt-cards{display:none}
.dw{display:grid;grid-template-columns:minmax(360px,460px) minmax(0,1fr);gap:0;height:100%;min-height:0}
.dw-form{display:flex;flex-direction:column;min-height:0;min-width:0;border-inline-end:1px solid var(--au-line);container-type:inline-size}
@container (max-width:560px){.dw-step:not(.on){flex:0 0 auto}.dw-step:not(.on) .lbl{display:none}.dw-steps{gap:8px}}
.dw>*{min-width:0}.dw-body>*{min-width:0}.qd-sec .dw-chips input{min-width:0}
.dw-steps{display:flex;gap:6px;padding:12px 16px 10px;border-bottom:1px solid var(--au-line);overflow-x:auto}
.dw-step{flex:1;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--au-text3);white-space:nowrap;min-width:0;overflow:hidden}.dw-step .lbl{overflow:hidden;text-overflow:ellipsis}
.dw-step i{width:20px;height:20px;border-radius:50%;border:1px solid var(--au-line);display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:600;flex-shrink:0}
.dw-step.on{color:var(--au-text);font-weight:600}.dw-step.on i{background:var(--au-brand);border-color:var(--au-brand);color:#fff}
.dw-step.done i{background:rgba(37,211,102,.16);border-color:rgba(37,211,102,.5);color:var(--au-green-text)}
.dw-body{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:14px}
.dw-foot{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--au-line);background:var(--au-card)}
.dw-prev{background:#8E8B84;overflow:auto;padding:20px;display:flex;justify-content:center;align-items:flex-start}
.dw-prev-in{transform-origin:top center}
.dw-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.qd{display:flex;flex-direction:column;min-height:0}
.qd-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:16px 18px 10px}
.qd-head h3{margin:0;font-size:18px;font-weight:600;display:flex;gap:8px;align-items:center}.qd-head p{margin:4px 0 0;color:var(--au-text3);font-size:13.5px}
.qd-tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:0 18px 12px;border-bottom:1px solid var(--au-line)}
.qd-search{flex:1;min-width:220px;display:flex;align-items:center;gap:8px;height:42px;border-radius:12px;background:rgba(var(--ov),.05);border:1px solid var(--au-line);padding:0 12px;color:var(--au-text3)}
.qd-search input{flex:1;border:none;background:transparent;font:inherit;font-size:14.5px;color:var(--au-text);outline:none;min-height:0}
.qd-grid{flex:1;overflow:auto;padding:16px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;align-content:start}
.qd-card{display:flex;flex-direction:column;gap:4px;text-align:start;border:1px solid var(--au-line);border-radius:14px;background:var(--au-card);padding:0 0 12px;cursor:pointer;font:inherit;color:var(--au-text);overflow:hidden;transition:box-shadow .15s,border-color .15s;min-height:0}
.qd-card:hover,.qd-card:focus-visible{border-color:rgba(var(--brand-rgb),.5);box-shadow:var(--au-shadow)}
.qd-card b,.qd-card small,.qd-meta{padding:0 12px}.qd-card b{font-size:14.5px;font-weight:600;margin-top:8px}.qd-card small{color:var(--au-text3);font-size:12.5px}
.qd-img{position:relative;aspect-ratio:3/2;background:rgba(var(--ov),.06);display:flex;align-items:center;justify-content:center;color:var(--au-text3)}.qd-img img{width:100%;height:100%;object-fit:cover;display:block}
.qd-tag{position:absolute;top:8px;inset-inline-start:8px;background:rgba(18,140,74,.92);color:#fff;font-size:11.5px;font-weight:600;border-radius:999px;padding:2px 8px}
.qd-meta{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--au-text2)}.qd-meta em{font-style:normal;font-weight:700;color:var(--au-text)}
.qd-empty{grid-column:1/-1;color:var(--au-text3);font-size:14px;padding:30px;text-align:center}
.qd-prop{display:flex;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--au-line);background:rgba(var(--brand-rgb),.05)}
.qd-prop b{display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qd-prop small{display:block;color:var(--au-text3);font-size:12.5px}
.qd-thumb{width:54px;height:42px;border-radius:9px;overflow:hidden;background:rgba(var(--ov),.08);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--au-text3)}.qd-thumb img{width:100%;height:100%;object-fit:cover}
.qd-saved{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:var(--au-green-text);margin-top:2px}
.qd-sec{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--au-line);border-radius:14px;background:var(--au-card)}
.qd-sec h4{margin:0;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}.qd-sec h4 span{width:22px;height:22px;border-radius:50%;background:rgba(var(--brand-rgb),.12);color:var(--au-brand-text);display:inline-flex;align-items:center;justify-content:center;font-size:12px}
.qd-sum{font-size:13px;color:var(--au-text2);background:rgba(var(--ov),.04);border-radius:10px;padding:8px 10px}
.qd-more{align-self:flex-start;border:none;background:none;color:var(--au-brand-text);font:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:2px 0;min-height:0}
.qd-fixed{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px;color:var(--au-text2);align-items:center}
.qd-foot-sec,.qd-foot-main{display:flex;gap:8px;align-items:center}
.qd-done{display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center;padding:20px 8px}.qd-done h3{margin:0;font-size:18px}.qd-done p{margin:0;color:var(--au-text2);font-size:14px;line-height:1.6}
.qd-done .big{width:64px;height:64px;border-radius:50%;background:rgba(37,211,102,.16);color:var(--au-green-text);display:flex;align-items:center;justify-content:center}
@media (max-width:640px){.qd-foot{flex-direction:column-reverse;align-items:stretch;gap:8px}.qd-foot-main{display:grid!important;grid-template-columns:auto auto 1fr;gap:8px}.qd-foot-main>*:last-child{width:100%}.qd-foot-sec{justify-content:space-between}.qd-grid{grid-template-columns:1fr 1fr;gap:8px;padding:12px}.qd-head,.qd-tools{padding-inline:12px}.dw-grid{grid-template-columns:1fr}}
.dw-grid .full{grid-column:1/-1}
.dw-lead{display:flex;flex-direction:column;gap:6px;position:relative}
.dw-lead-list{position:absolute;top:100%;inset-inline:0;z-index:5;background:var(--au-pop);border:1px solid var(--au-line);border-radius:10px;box-shadow:var(--au-shadow);max-height:260px;overflow:auto;margin-top:4px}
.dw-lead-list button{display:flex;width:100%;gap:10px;align-items:center;padding:8px 12px;border:none;background:transparent;color:var(--au-text);font:inherit;text-align:start;cursor:pointer;min-height:0}
.dw-lead-list button:hover{background:rgba(var(--ov),.06)}.dw-lead-list small{color:var(--au-text3);direction:ltr}
.dw-chips{display:flex;gap:6px;flex-wrap:wrap}
.dw-chip{border:1px solid var(--au-line);background:transparent;color:var(--au-text2);border-radius:999px;padding:5px 12px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;min-height:0}
.dw-chip.on{background:var(--au-brand);border-color:var(--au-brand);color:#fff}
.dw-sum{background:rgba(var(--brand-rgb),.07);border:1px solid rgba(var(--brand-rgb),.2);border-radius:12px;padding:10px 14px;font-size:13px;display:grid;grid-template-columns:1fr auto;gap:4px 12px}
.dw-sum b{font-variant-numeric:tabular-nums;direction:ltr;text-align:left}
.dw-sum .t{grid-column:1/-1;border-top:1px solid rgba(var(--brand-rgb),.25);margin-top:4px;padding-top:6px;display:flex;justify-content:space-between;font-weight:700;font-size:14px}
.dw-err{color:var(--au-red-text);font-size:12.5px;background:rgba(224,82,82,.08);border-radius:8px;padding:8px 10px}
.dw-ok{color:var(--au-green-text);font-size:13px;font-weight:600}
.dd-sec{display:flex;flex-direction:column;gap:8px}
.dd-rows{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px}
.dd-rows span{color:var(--au-text3)}.dd-rows b{font-weight:500;word-break:break-all}
.dd-ev{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--au-divider);font-size:12.5px;align-items:flex-start}
.dw-signers{margin-top:14px;padding-top:10px;border-top:1px solid var(--au-divider)}
.dw-signer{padding:10px;border:1px solid var(--au-line);border-radius:12px;margin-bottom:8px;background:rgba(var(--ov),.03)}
.dt-sg{display:inline-block;margin-inline-start:6px;font-size:11px;font-weight:700;color:var(--au-brand-text);background:rgba(var(--brand-rgb),.12);border-radius:999px;padding:1px 7px;vertical-align:middle}
.dd-signers{display:flex;flex-direction:column;gap:6px}
.dd-signer{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:8px 10px;border:1px solid var(--au-line);border-radius:10px;font-size:13px}
.dd-signer span{color:var(--au-text3);font-size:12px}.dd-signer em{grid-column:1/-1;font-style:normal;font-size:12px;color:var(--au-text3)}
.dd-signer.cur{border-color:rgba(var(--brand-rgb),.5);background:rgba(var(--brand-rgb),.06)}.dd-signer.ok em{color:var(--au-green-text)}
.dt-tog{display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer}.dt-tog input{width:16px;height:16px;min-height:0;accent-color:var(--au-brand)}
.dt-drive{display:flex;flex-direction:column;gap:12px}.dt-drive .st{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dt-drive .tree{font-size:12.5px;color:var(--au-text3);line-height:1.7;background:rgba(var(--ov),.04);border-radius:10px;padding:10px 12px}
.dt-counts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.dt-counts div{border:1px solid var(--au-line);border-radius:10px;padding:8px 10px;text-align:center}.dt-counts b{display:block;font-size:18px}.dt-counts span{font-size:11.5px;color:var(--au-text3)}
.dd-ev time{color:var(--au-text3);white-space:nowrap;direction:ltr;font-variant-numeric:tabular-nums}
.dd-ev small{display:block;color:var(--au-text3);font-size:11px;direction:ltr;text-align:right;word-break:break-all}
.dd-files{display:flex;gap:8px;flex-wrap:wrap}
.dt-clause{display:flex;flex-direction:column;gap:6px;border:1px solid var(--au-line);border-radius:12px;padding:10px 12px}
.dt-clause textarea{min-height:90px}
.dt-ph{display:flex;flex-wrap:wrap;gap:4px}.dt-ph code{font-size:11px;background:rgba(var(--ov),.07);border-radius:6px;padding:2px 6px;direction:ltr}
.dt-agsig{display:grid;grid-template-columns:200px minmax(0,1fr);gap:14px;align-items:center;border:1px solid rgba(var(--ov),.12);border-radius:14px;padding:12px}.dt-agsig-img{height:90px;border-radius:10px;background:#fff;border:1px solid rgba(var(--ov),.1);display:flex;align-items:center;justify-content:center;padding:8px}.dt-agsig-img img{max-width:100%;max-height:100%;object-fit:contain}.dt-agsig-img span{color:#8A8798;font-size:12px}.dt-agsig-txt{display:flex;flex-direction:column;gap:6px;min-width:0}.dt-agsig-txt p{margin:0;font-size:12.5px;line-height:1.55;color:var(--au-text3)}@media (max-width:640px){.dt-agsig{grid-template-columns:1fr}}
.dt-wire{display:flex;gap:8px;flex-wrap:wrap}
.dt-input{width:100%;height:40px;padding:0 12px;border-radius:9px;border:1px solid var(--au-line);background:var(--au-input);color:var(--au-text);font:inherit;font-size:13.5px;min-height:0}
textarea.dt-input{height:auto;min-height:70px;padding:9px 12px;resize:vertical;line-height:1.5}
select.dt-input{appearance:auto}
.dt-areas{display:flex;gap:4px;border-bottom:1px solid var(--au-line);padding-bottom:0}
.dt-area{border:none;background:transparent;color:var(--au-text3);font:inherit;font-size:13.5px;font-weight:600;padding:8px 14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;min-height:0;display:inline-flex;gap:6px;align-items:center}
.dt-area.on{color:var(--au-text);border-bottom-color:var(--au-brand)}
.dt-area-n{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:rgba(var(--ov),.08);font-size:11px;display:inline-flex;align-items:center;justify-content:center}
.dt-proj{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--au-card);border:1px solid var(--au-line);border-radius:14px;padding:10px 14px;font-size:13.5px}
.dt-proj .lp-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.dt-proj-kpi{color:var(--au-text2);font-size:13px}.dt-proj-kpi b{font-weight:600}
.dt-tpls{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.dt-tpl{background:var(--au-card);border:1px solid var(--au-line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;text-align:start;font:inherit;color:inherit}
.dt-tpl-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.dt-tpl-top b{font-weight:600;font-size:14px}
.dt-tpl small{color:var(--au-text3);font-size:12px}
.dt-tpl-new{border-style:dashed;align-items:center;justify-content:center;cursor:pointer;min-height:120px;color:var(--au-text2)}.dt-tpl-new:hover{border-color:var(--au-brand)}
.dt-break{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.dt-brk{background:var(--au-card);border:1px solid var(--au-line);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}.dt-brk>b{font-size:13px;font-weight:600;margin-bottom:2px}
.dt-brk-row{display:grid;grid-template-columns:1fr auto;gap:2px 10px;border:none;background:transparent;color:var(--au-text);font:inherit;font-size:12.5px;text-align:start;cursor:pointer;padding:4px 0;min-height:0;border-radius:6px}
.dt-brk-row:hover{background:rgba(var(--ov),.04)}.dt-brk-n{font-variant-numeric:tabular-nums;direction:ltr;color:var(--au-text3)}.dt-brk-n i{font-style:normal}
.dt-brk-bar{grid-column:1/-1;height:4px;border-radius:2px;background:rgba(var(--ov),.08);overflow:hidden}.dt-brk-bar span{display:block;height:100%;background:var(--au-brand)}
.dt-link{border:none;background:transparent;color:var(--au-brand-text);font:inherit;font-size:13px;cursor:pointer;padding:0;min-height:0;text-decoration:underline dotted}
.dw-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.dw-fields .full{grid-column:1/-1}
.dw-msg{display:flex;flex-direction:column;gap:6px;border:1px solid var(--au-line);border-radius:12px;padding:10px 12px;background:rgba(var(--ov),.025)}
.dw-msg-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.dw-msg-sel{display:flex;gap:8px;align-items:center;flex:1;min-width:0}.dw-msg-sel>span{font-size:12.5px;font-weight:600;white-space:nowrap}.dw-msg-sel select{flex:1;min-width:0;height:36px}
.dw-msg-hint{font-size:12px;color:var(--au-text3)}.dw-msg-text{font-size:13.5px;line-height:1.55;resize:vertical;min-height:120px}
.dw-msg-foot{display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap}.dw-msg-foot small{font-size:11.5px;color:var(--au-text3)}
.dw-finder-x{position:absolute;inset-inline-end:8px;top:50%;transform:translateY(-50%);border:none;background:transparent;color:var(--au-text3);cursor:pointer;min-height:0;padding:4px;display:flex}
.dw-lead-list button.hi{background:rgba(var(--brand-rgb),.08)}.dw-finder-av{width:26px;height:26px;border-radius:50%;background:rgba(var(--brand-rgb),.12);color:var(--au-brand-text);display:grid;place-items:center;font-size:12px;font-weight:700;flex:none}
.dw-finder-name{font-weight:600}.dw-finder-sub{color:var(--au-text3);font-size:12px}.dw-finder-st{display:inline-block;margin-inline-start:8px;font-size:11px;color:var(--au-text3);border:1px solid var(--au-line);border-radius:999px;padding:0 7px}
.dw-finder-none{padding:10px 12px;font-size:12.5px;color:var(--au-text3)}
.dt-leadf{display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:rgba(var(--brand-rgb),.06);border:1px solid rgba(var(--brand-rgb),.2);border-radius:12px;padding:8px 12px;font-size:13px}.dt-leadf b{font-weight:600}.dt-leadf-in{height:36px;font-size:12.5px}
.dt-fun{background:var(--au-card);border:1px solid var(--au-line);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.dt-fun-head{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}.dt-fun-head b{font-size:14px;font-weight:600;display:block}.dt-fun-head small{font-size:12px;color:var(--au-text3)}
.dt-fun-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}.dt-fun-kpis>div{border:1px solid var(--au-line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.dt-fun-kpis b{font-size:22px;font-weight:600;line-height:1.1;font-variant-numeric:tabular-nums}.dt-fun-kpis span{font-size:12px;color:var(--au-text3)}
.dt-fun-d{font-size:11px!important;color:var(--au-text3)!important}.dt-fun-d.up{color:var(--au-green-text)!important}.dt-fun-d.down{color:var(--au-amber-text)!important}
.dt-fun-chart{overflow-x:auto;padding:4px 0 0;display:flex;flex-direction:column;align-items:center}.dt-fun-chart svg text{font-family:inherit}.dt-fun-g:hover rect{filter:brightness(.92)}
.dt-fun-legend{display:flex;gap:14px;font-size:12px;color:var(--au-text3);padding-top:4px}.dt-fun-legend span{display:flex;gap:6px;align-items:center}.dt-fun-legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
.dt-fun-table{width:100%;border-collapse:collapse;font-size:12.5px}.dt-fun-table th{font-weight:600;color:var(--au-text3);text-align:start;padding:6px 8px;border-bottom:1px solid var(--au-line);font-size:12px}
.dt-fun-table td{padding:7px 8px;border-bottom:1px solid rgba(var(--ov),.06);font-variant-numeric:tabular-nums;white-space:nowrap}.dt-fun-table tr.has{cursor:pointer}.dt-fun-table tr.has:hover td{background:rgba(var(--ov),.035)}
.dt-fun-table td.ok{color:var(--au-green-text);font-weight:600}.dt-fun-table tfoot td{font-weight:600;border-bottom:none;border-top:1px solid var(--au-line)}
.dt-fun-bar{display:inline-block;width:46px;height:4px;border-radius:2px;background:rgba(var(--ov),.08);margin-inline-start:8px;vertical-align:middle;overflow:hidden}.dt-fun-bar i{display:block;height:100%;background:var(--au-brand)}
@media (max-width:640px){.dt-fun-table .hide-sm{display:none}.dt-fun-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.dt-fun-bar{display:none}.dw-msg-sel{flex-direction:column;align-items:stretch}}
.dw-mhead{display:flex;gap:10px;align-items:center;padding:10px 12px 10px 14px;border-bottom:1px solid var(--au-line);min-height:52px}
.dw-mhead-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}.dw-mhead-t b{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dw-mhead-t small{font-size:12px;color:var(--au-text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dw-mhead-r{display:flex;gap:6px;align-items:center;flex-shrink:0}
.dw-prog{height:3px;background:rgba(var(--ov),.08);display:none}.dw-prog i{display:block;height:100%;background:var(--au-brand);transition:width .25s}
.dw-prev-bar{display:none;gap:10px;align-items:center;padding:8px 12px;background:var(--au-card);border-bottom:1px solid var(--au-line);position:sticky;top:0;z-index:2;width:100%}
.dw-prev-bar b{flex:1;font-size:14px;font-weight:600}
.dw-foot .dw-close-btn{}
.qd-modes{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 18px 12px}
.qd-mode{display:flex;gap:12px;align-items:center;text-align:start;border:1px solid var(--au-line);border-radius:14px;padding:12px 14px;background:var(--au-card);font:inherit;color:var(--au-text);cursor:pointer;min-height:0}
.qd-mode:hover{border-color:rgba(var(--brand-rgb),.5)}.qd-mode.on{border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.12)}
.qd-mode i{width:38px;height:38px;border-radius:11px;background:rgba(var(--brand-rgb),.1);color:var(--au-brand-text);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.qd-mode b{display:block;font-size:14px;font-weight:600}.qd-mode small{display:block;font-size:12px;color:var(--au-text3);line-height:1.4}
@media (max-width:1020px){.dw-prev-bar{display:flex}.dw.show-prev .dw-prev{flex-direction:column;align-items:stretch;justify-content:flex-start}}
@media (max-width:760px){.dw,.qd{height:100%!important;max-height:none!important}.dw{grid-template-columns:minmax(0,1fr)}.dw-form{border-inline-end:none}.dw-steps{display:none}.dw-prog{display:block}
.dw-body{padding:14px 14px 18px;overflow-x:hidden}.dw-grid{grid-template-columns:1fr}.dw-body input[style*="width"],.dw-body .dt-input[style*="width"]{max-width:100%}
.dw-foot{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:8px;padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom))}.dw-foot>div{display:contents!important}
.dw-foot .dw-close-btn,.dw-foot .dw-draft-btn{display:none!important}.dw-foot .dw-prev-btn{width:40px;height:40px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:0}.dw-foot .dw-prev-btn svg{font-size:14px}
.dw-foot .dw-next{grid-column:3;width:100%;justify-content:center}.dw-foot .dw-back{grid-column:1}
.qd-modes{grid-template-columns:1fr;padding:0 12px 10px}.qd-prop{padding:10px 12px}.qd-prop .dw-chip{white-space:nowrap}}
@media (max-width:1020px){.dw{grid-template-columns:1fr}.dw-prev{display:none}.dw.show-prev .dw-form{display:none}.dw.show-prev .dw-prev{display:flex;padding:0;background:#fff}.dw-prev-in{transform:none!important;width:100%}}
@media (max-width:760px){.dt-tiles{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.dt-areas{overflow-x:auto;scrollbar-width:none}.dt-areas::-webkit-scrollbar{display:none}.dt-area{white-space:nowrap;padding:8px 10px}.dt-table{display:none}.dt-cards{display:flex;flex-direction:column;gap:8px}.dt-card{background:var(--au-card);border:1px solid var(--au-line);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;cursor:pointer}.dt-card .r{display:flex;justify-content:space-between;align-items:center;gap:8px}.dw-grid{grid-template-columns:1fr}}
`

const leadMatch = (l, q) => { const s = q.trim().toLowerCase(); if (!s) return true; const d = s.replace(/\D/g, ''); return String(l.name || '').toLowerCase().includes(s) || (d.length >= 3 && String(l.phone || '').replace(/\D/g, '').includes(d)) || String(l.email || '').toLowerCase().includes(s) }
const splitName = n => { const w = String(n || '').trim().split(/\s+/); return { firstName: w[0] || '', lastName: w.slice(1).join(' ') } }
const STEP_LABEL = { tpl: 'תבנית', client: 'לקוח ופרויקט', property: 'נכס', fees: 'תנאי התיווך', fields: 'פרטי המסמך', preview: 'תצוגה מקדימה', send: 'שליחה' }
const FEE_KEYS = ['PRICE', 'COMMISSION', 'COMMISSION_PCT', 'COMMISSION_BASIS', 'VAT', 'VAT_RATE', 'TOTAL', 'TERMS']
const emptyForm = settings => ({ templateId: 'brokerage', projectId: '', projectName: '', fields: {}, leadId: '', propertyId: '', client: { firstName: '', lastName: '', name: '', idNumber: '', phone: '', email: '', address: '', role: 'buyer' }, property: { address: '', city: '', desc: '', type: '', dealType: 'sale', price: '', notes: '', link: '' }, fees: { mode: 'percent', pct: 2, fixed: '', months: 1, vatRate: settings?.vatRate ?? DEFAULT_VAT }, agent: { ...(settings?.agent || { name: '', license: '', phone: '', email: '' }) }, logo: { ...(settings?.logo || { show: true, url: '', size: 'm', align: 'right' }) }, terms: '', expiryDays: settings?.expiryDays || 14, title: '', signers: [] })

/** the view the preview draws, from the wizard's form and its template (same rules as the server) */
function formView(form, tpl, number = '') {
  const { data } = cleanDocInput({ ...form, fees: { ...form.fees, price: form.fees?.price || form.property?.price } }, { requireProperty: false, requireFees: false, requireAgent: false })
  const fees = computeFees({ ...form.fees, price: form.property.price })
  const d = { ...data, fees, client: { ...data.client, name: data.client.name || [form.client.firstName, form.client.lastName].filter(Boolean).join(' ') } }
  const values = templateValues(d, { number, project: form.projectName ? { name: form.projectName } : null })
  return { number, status: 'draft', signer: signerInfo({ data: d, status: 'draft' }), title: d.title || tpl.title || DOC_TYPES.brokerage.name, created_at: new Date().toISOString(), client: d.client, property: d.property, fees, agent: d.agent, logo: d.logo?.url || d.logo?.show === false ? d.logo : { ...tpl.logo, ...(d.logo || {}) }, terms: d.terms, project: form.projectName, kind: tpl.kind, blocks: renderBlocks(tpl, values), sections: tpl.sections, values }
}
const fieldInput = (f, v, on) => f.type === 'checkbox' ? <label className="te-tog"><input type="checkbox" checked={v === true || v === 'true'} onChange={e => on(e.target.checked)}/>{f.label}</label>
  : f.type === 'select' ? <select className="dt-input" value={v || ''} onChange={e => on(e.target.value)} aria-label={f.label}><option value="">—</option>{(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}</select>
  : f.type === 'date' ? <input className="dt-input" type="date" dir="ltr" value={v || ''} onChange={e => on(e.target.value)} aria-label={f.label}/>
  : <input className="dt-input" dir={['number', 'money', 'percent'].includes(f.type) ? 'ltr' : undefined} inputMode={['number', 'money', 'percent'].includes(f.type) ? 'decimal' : undefined} value={v || ''} placeholder={f.hint || ''} onChange={e => on(e.target.value)} aria-label={f.label}/>

export default function DocumentsTab({ lang = 'he', leads = [], properties = [], onOpenLead, initialLeadId = '', initialProject = '', initialPropertyId = '', standalone = true }) {
  const t = TR.he
  const [push, toasts] = useToasts()
  const projects = useProjects()
  const [area, setArea] = useState(initialProject ? 'docs' : 'overview')
  const [project, setProject] = useState(initialProject || '')
  const [agentF, setAgentF] = useState('')
  const [typeF, setTypeF] = useState('')
  const [templates, setTemplates] = useState([])
  const [tplMissing, setTplMissing] = useState(false)
  const [tplEditor, setTplEditor] = useState(null)      // { template } | { upload: true } | { text, source, … }
  const loadTemplates = useCallback(() => api.get('docs-templates').then(d => { setTemplates(d.templates || []); setTplMissing(!!d.missingMigration) }).catch(() => {}), [])
  useEffect(() => { loadTemplates() }, [loadTemplates])
  const [docs, setDocs] = useState([])
  const [wiring, setWiring] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('all')
  const [range, setRange] = useState('all')
  const [q, setQ] = useState('')
  const [leadF, setLeadF] = useState('')        // the list scoped to one lead (the finder)
  const [monthF, setMonthF] = useState('')      // … or to one month of sending (the funnel)
  const leadFRow = leadF ? leads.find(l => String(l.id) === String(leadF)) || null : null
  const leadFPhone = String(leadFRow?.phone || '').replace(/\D/g, '').slice(-9)
  const [wizard, setWizard] = useState(null)       // { doc? (editing a draft), leadId?, prefill? }
  const [quick, setQuick] = useState(() => initialPropertyId ? { propertyId: String(initialPropertyId) } : null)   // "מסמך מהיר מנכס"
  const [open, setOpen] = useState(null)           // the document id in the drawer
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState(null)
  const load = useCallback(async () => {
    try { setErr(''); const d = await api.get('docs-list'); setDocs(d.docs || []); setWiring(d.status || null) } catch (e) { setErr(e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load(); api.get('docs-settings').then(d => setSettings(d.settings)).catch(() => {}) }, [load])
  useEffect(() => onSync(m => { if (m?.t === 'documents') load() }), [load])
  useEffect(() => { if (initialLeadId) setWizard({ leadId: String(initialLeadId) }) }, [initialLeadId])
  const scoped = useMemo(() => docs.filter(d => (!project || d.project_id === project) && (!agentF || (d.agent_name || d.data?.agent?.name || '') === agentF) && (!typeF || (d.data?.title || DOC_TYPES.brokerage.name) === typeF)), [docs, project, agentF, typeF])
  const stats = useMemo(() => docStats(scoped), [scoped])
  const breakdown = useMemo(() => {
    const by = { project: {}, agent: {}, type: {}, month: {} }
    for (const d of scoped) {
      const st = effectiveStatus(d)
      const add = (k, name) => { const r = by[k][name] = by[k][name] || { name, total: 0, signed: 0, waiting: 0 }; r.total++; if (st === 'signed') r.signed++; if (st === 'sent' || st === 'opened') r.waiting++ }
      add('project', d.project_name || t.noProject); add('agent', d.agent_name || d.data?.agent?.name || '—'); add('type', d.data?.title || DOC_TYPES.brokerage.name); add('month', new Date(d.created_at).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }))
    }
    return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, Object.values(v).sort((a, b) => b.total - a.total).slice(0, 12)]))
  }, [scoped, t.noProject])
  const projectRow = project ? projects.find(p => p.id === project) : null
  const list = useMemo(() => {
    const now = Date.now(), days = { week: 7, month: 30, quarter: 90 }[range]
    const s = q.trim().toLowerCase(), dg = s.replace(/\D/g, '')
    return scoped.filter(d => {
      const st = effectiveStatus(d, now)
      if (leadF && !(String(d.lead_id || '') === String(leadF) || (leadFPhone.length === 9 && String(d.client_phone || '').replace(/\D/g, '').slice(-9) === leadFPhone))) return false
      if (monthF && docMonthKey(d.sent_at || d.created_at) !== monthF) return false
      if (filter === 'waiting' && !['sent', 'opened'].includes(st)) return false
      if (filter === 'signed' && st !== 'signed') return false
      if (filter === 'draft' && st !== 'draft') return false
      if (filter === 'problem' && !['expired', 'failed'].includes(st)) return false
      if (filter === 'cancelled' && st !== 'cancelled') return false
      if (days && Date.parse(d.created_at) < now - days * 864e5) return false
      if (s && !(String(d.client_name || '').toLowerCase().includes(s) || String(d.number || '').toLowerCase().includes(s) || String(d.client_email || '').toLowerCase().includes(s) || String(d.project_name || '').toLowerCase().includes(s) || propLine(d.data).toLowerCase().includes(s) || (dg.length >= 3 && String(d.client_phone || '').replace(/\D/g, '').includes(dg)))) return false
      return true
    })
  }, [scoped, filter, range, q, leadF, leadFPhone, monthF])
  const openDoc = d => setOpen(d.id)
  const cur = docs.find(d => d.id === open) || null
  return (
    <div className="dt">
      <style>{DOCS_CSS}{DOC_CSS}{TE_CSS}</style>
      <div className="dt-head">
        <div><h2><FileSignature size={20}/>{t.title}</h2><p>{t.sub}</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" icon={<RefreshCw size={14}/>} onClick={() => { load(); loadTemplates() }} title={t.refresh}>{t.refresh}</Button>
          <Button variant="ghost" icon={<Upload size={14}/>} onClick={() => { setArea('templates'); setTplEditor({ upload: true }) }} className="dt-upload">{t.uploadTpl}</Button>
          <Button variant="soft-green" icon={<Building2 size={15}/>} onClick={() => setQuick({})} className="dt-quick">מסמך מהיר</Button>
          <Button variant="solid" icon={<Plus size={15}/>} onClick={() => setWizard({ projectId: project || '' })} className="dt-new">{t.newDoc}</Button>
        </div>
      </div>
      <div className="dt-areas" role="tablist">{Object.entries(t.areas).map(([k, v]) => <button key={k} type="button" role="tab" aria-selected={area === k} className={`dt-area${area === k ? ' on' : ''}`} onClick={() => { if (k === 'settings') setSettingsOpen(true); else setArea(k) }}>{v}{k === 'templates' && templates.length ? <span className="dt-area-n">{templates.length + 1}</span> : null}{k === 'docs' ? <span className="dt-area-n">{scoped.length}</span> : null}</button>)}</div>
      {projectRow && <div className="dt-proj">
        <span className="lp-dot" style={{ background: projectRow.color }}/><b>{t.projectDocs}: {projectRow.name}</b>{projectRow.town && <span style={{ color: 'var(--au-text3)' }}>· {projectRow.town}</span>}
        <span className="dt-proj-kpi"><b>{stats.total}</b> מסמכים · <b>{stats.waiting}</b> ממתינים · <b style={{ color: 'var(--au-green-text)' }}>{stats.signed}</b> נחתמו · <b>{stats.total ? Math.round(stats.signed / stats.total * 100) : 0}%</b> {t.pct}</span>
        <span style={{ flex: 1 }}/>
        <Button size="sm" variant="ghost" onClick={() => { setProject(''); setArea('overview') }}>{t.clearProject}</Button>
      </div>}
      {tplMissing && <div className="dw-err"><AlertTriangle size={13}/> הטבלאות של גרסה 2 עוד לא נוצרו ב-Supabase — יש להריץ את server/documents-v2-migration.sql ב-SQL editor. עד אז עובדת רק התבנית המובנית.</div>}
      {area === 'templates' && (
        <div className="dt-tpls">
          <div className="dt-tpl dt-tpl-builtin"><div className="dt-tpl-top"><FileText size={16}/><b>{DOC_TYPES.brokerage.name}</b><span className="dt-st" style={{ background: 'rgba(var(--brand-rgb),.12)', color: 'var(--au-brand-text)' }}>{t.builtin}</span></div><small>8 סעיפים · פרטי לקוח · נכס · דמי תיווך · חתימות</small><div className="dd-files"><Button size="sm" variant="ghost" onClick={() => setSettingsOpen('clauses')}>{t.tplEdit}</Button><Button size="sm" variant="soft-green" onClick={() => setWizard({ templateId: 'brokerage', projectId: project || '' })}>{t.tplUse}</Button></div></div>
          {templates.map(tp => <div key={tp.id} className="dt-tpl"><div className="dt-tpl-top"><FileText size={16}/><b>{tp.name}</b>{tp.source?.method && <span className="dt-st" style={{ background: 'rgba(var(--ov),.07)', color: 'var(--au-text2)' }}>{tp.source.method === 'vision' ? 'סריקה' : tp.source.method === 'docx' ? 'Word' : tp.source.method === 'pdf' ? 'PDF' : 'טקסט'}</span>}</div><small>{t.tplBlocks(tp.blocks.length)} · {t.tplFields(tp.fields.length)}{tp.source?.name ? ` · ${tp.source.name}` : ''}</small><div className="dd-files"><Button size="sm" variant="ghost" onClick={() => setTplEditor({ template: tp })}>{t.tplEdit}</Button><Button size="sm" variant="soft-green" onClick={() => setWizard({ templateId: tp.id, projectId: project || '' })}>{t.tplUse}</Button><Button size="sm" variant="danger" icon={<Trash2 size={12}/>} onClick={async () => { if (!window.confirm(t.tplDelAsk)) return; try { await api.post('docs-template-delete', { id: tp.id }); loadTemplates() } catch (e) { push(e.message) } }}>{t.tplDel}</Button></div></div>)}
          <button type="button" className="dt-tpl dt-tpl-new" onClick={() => setTplEditor({ upload: true })}><Upload size={22}/><b>{t.uploadTpl}</b><small>Word · PDF · סריקה → תבנית עם שדות</small></button>
          {!templates.length && <p style={{ gridColumn: '1/-1', margin: 0, fontSize: 13, color: 'var(--au-text3)' }}>{t.tplNone}</p>}
        </div>
      )}
      {area === 'overview' && <FunnelCard docs={scoped} onMonth={m => { setMonthF(m.key); setFilter('all'); setRange('all'); setArea('docs') }}/>}
      {area === 'overview' && (
        <div className="dt-break">
          <div className="dt-brk"><b>המסמכים של ליד</b><LeadFinder leads={leads} value={leadF} onPick={l => { setLeadF(l ? String(l.id) : ''); if (l) { setFilter('all'); setRange('all'); setArea('docs') } }} placeholder="חיפוש ליד לפי שם או טלפון…"/><small style={{ color: 'var(--au-text3)' }}>כל המסמכים שנשלחו לליד, ומשם מסמך חדש או כרטיס הליד</small></div>
          {Object.entries(t.by).map(([k, label]) => <div key={k} className="dt-brk"><b>{label}</b>{breakdown[k].length ? breakdown[k].map(r => <button type="button" key={r.name} className="dt-brk-row" onClick={() => { if (k === 'project') { const p = projects.find(x => x.name === r.name); setProject(p ? p.id : ''); } if (k === 'agent') setAgentF(r.name === '—' ? '' : r.name); if (k === 'type') setTypeF(r.name); setArea('docs') }}><span>{r.name}</span><span className="dt-brk-n"><i style={{ color: 'var(--au-green-text)' }}>{r.signed}</i> / <i style={{ color: 'var(--au-amber-text)' }}>{r.waiting}</i> / {r.total}</span><span className="dt-brk-bar"><span style={{ width: `${r.total ? r.signed / r.total * 100 : 0}%` }}/></span></button>) : <small style={{ color: 'var(--au-text3)' }}>—</small>}</div>)}
          <small style={{ gridColumn: '1/-1', color: 'var(--au-text3)' }}>נחתמו / ממתינים / סה"כ · לחיצה על שורה מסננת את הרשימה</small>
        </div>
      )}
      {wiring && (!wiring.whatsapp || !wiring.email) && <div className="dw-err" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={14}/>{!wiring.whatsapp ? 'וואטסאפ (Green API) לא מוגדר — שליחה וקוד אימות יעבדו רק באימייל. ' : ''}{!wiring.email ? 'אימייל (GMAIL_USER / GMAIL_APP_PASSWORD) לא מוגדר — שליחה וקוד אימות יעבדו רק בוואטסאפ.' : ''}</div>}
      {area !== 'templates' && <div className="dt-tiles">
        {[['total', 'all'], ['waiting', 'waiting'], ['signed', 'signed'], ['problem', 'problem']].map(([k, f]) => <button key={k} type="button" className={`dt-tile${filter === f && area === 'docs' ? ' on' : ''}`} onClick={() => { setFilter(f); setArea('docs') }}><b style={{ color: k === 'problem' && stats[k] ? T.redText : k === 'signed' && stats[k] ? T.green : undefined }}>{stats[k]}</b><span>{t.tiles[k]}</span></button>)}
      </div>}
      {area === 'docs' && <div className="dt-bar">
        <label className="dt-search"><Search size={15}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}/></label>
        <div style={{ width: 230, maxWidth: '100%' }}><LeadFinder leads={leads} value={leadF} onPick={l => setLeadF(l ? String(l.id) : '')} placeholder="לפי ליד…" inputClass="dt-input dt-leadf-in"/></div>
        {Object.entries(t.filters).map(([k, v]) => <FilterChip key={k} selected={filter === k} onClick={() => setFilter(k)}>{v}</FilterChip>)}
        <select className="dt-input" style={{ width: 'auto', height: 32, fontSize: 12.5 }} value={range} onChange={e => setRange(e.target.value)} aria-label="טווח זמן">{Object.entries(t.range).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="dt-input" style={{ width: 'auto', height: 32, fontSize: 12.5 }} value={project} onChange={e => setProject(e.target.value)} aria-label={t.project}><option value="">{t.projectAll}</option>{projects.filter(p => p.status !== 'archived').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        {breakdown.agent.length > 1 && <select className="dt-input" style={{ width: 'auto', height: 32, fontSize: 12.5 }} value={agentF} onChange={e => setAgentF(e.target.value)} aria-label={t.agent}><option value="">{t.agent}: הכל</option>{breakdown.agent.map(a => <option key={a.name} value={a.name === '—' ? '' : a.name}>{a.name}</option>)}</select>}
        {breakdown.type.length > 1 && <select className="dt-input" style={{ width: 'auto', height: 32, fontSize: 12.5 }} value={typeF} onChange={e => setTypeF(e.target.value)} aria-label={t.cols.type}><option value="">{t.cols.type}: הכל</option>{breakdown.type.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}</select>}
      </div>}
      {area === 'docs' && (leadFRow || monthF) && <div className="dt-leadf">
        {leadFRow && <><b>{leadFRow.name || '—'}</b><span dir="ltr">{localPhone(leadFRow.phone)}</span>{leadProperty(leadFRow) ? <span style={{ color: 'var(--au-text3)' }}>· {leadProperty(leadFRow)}</span> : null}<span style={{ color: 'var(--au-text3)' }}>· {list.length} מסמכים</span>
          <Button size="sm" variant="solid" icon={<Plus size={12}/>} onClick={() => setWizard({ leadId: leadF })}>מסמך חדש לליד</Button>
          {onOpenLead && <Button size="sm" variant="ghost" onClick={() => onOpenLead(leadFRow.id)}>כרטיס הליד</Button>}</>}
        {monthF && <span>חודש שליחה: <b>{list.length ? '' : ''}{new Date(Date.UTC(Number(monthF.slice(0, 4)), Number(monthF.slice(5, 7)) - 1, 15)).toLocaleDateString('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</b></span>}
        <span style={{ flex: 1 }}/>
        <Button size="sm" variant="ghost" icon={<XCircle size={12}/>} onClick={() => { setLeadF(''); setMonthF('') }}>ניקוי</Button>
      </div>}
      {err && <div className="dw-err">{err}</div>}
      {area === 'docs' && (!loading && !list.length ? <EmptyState icon={FileSignature} title={docs.length ? t.emptyFilter : t.empty} action={!docs.length ? <Button variant="solid" icon={<Plus size={14}/>} onClick={() => setWizard({})}>{t.newDoc}</Button> : null}/> : (
        <>
          <table className="dt-table" aria-label={t.title}>
            <thead><tr><th>{t.cols.number}</th><th>{t.cols.type}</th><th>{t.cols.client}</th><th>{t.cols.project}</th><th>{t.cols.property}</th><th>{t.cols.agent}</th><th>{t.cols.fees}</th><th>{t.cols.created}</th><th>{t.cols.sent}</th><th>{t.cols.via}</th><th>{t.cols.opened}</th><th>{t.cols.status}</th><th>{t.cols.drive}</th><th>{t.cols.signed}</th><th/></tr></thead>
            <tbody>{list.map(d => { const st = effectiveStatus(d), f = computeFees(d.data?.fees || {}), Ic = STATUS_ICON[st] || Clock; const via = [...new Set((d.send_log || []).filter(x => x.ok).map(x => x.via))]; return (
              <tr key={d.id} onClick={() => openDoc(d)} className="dt-row">
                <td><span className="dt-num">{d.number}</span></td>
                <td style={{ fontSize: 12.5 }}>{d.data?.title || DOC_TYPES.brokerage.name}</td>
                <td><b style={{ fontWeight: 600 }}>{d.client_name || '—'}</b><div style={{ fontSize: 12, color: 'var(--au-text3)', direction: 'ltr', textAlign: 'right' }}>{localPhone(d.client_phone) || d.client_email || ''}</div></td>
                <td>{d.project_name ? <button type="button" className="dt-link" onClick={e => { e.stopPropagation(); setProject(d.project_id || ''); setArea('docs') }}>{d.project_name}</button> : '—'}</td>
                <td>{propLine(d.data) || '—'}</td>
                <td style={{ fontSize: 12.5 }}>{d.agent_name || d.data?.agent?.name || '—'}</td>
                <td>{d.type === 'custom' && !f.price ? '—' : <><span className="dt-num">{f.mode === 'percent' ? fmtPct(f.pct) : f.basis}</span> · <span className="dt-num">{fmtMoney(f.total)}</span></>}</td>
                <td><span className="dt-num">{todayHe(d.created_at)}</span></td>
                <td><span className="dt-num">{d.sent_at ? todayHe(d.sent_at) : '—'}</span></td>
                <td style={{ fontSize: 12 }}>{via.map(v => v === 'whatsapp' ? 'וואטסאפ' : 'אימייל').join(' + ') || '—'}</td>
                <td style={{ fontSize: 12 }}>{d.opened_at || st === 'opened' || st === 'signed' ? <span style={{ color: 'var(--au-green-text)' }}>נפתח</span> : d.sent_at ? <span style={{ color: 'var(--au-text3)' }}>לא נפתח</span> : '—'}</td>
                <td><span className="dt-st" style={{ background: `${TONE[st]}1F`, color: st === 'draft' || st === 'cancelled' ? 'var(--au-text2)' : TONE[st] }}><Ic size={12}/>{t.st[st]}</span>{signerProgressText(d) && <span className="dt-sg" title={t.signers.progress}>{signerProgressText(d)}</span>}</td>
                <td onClick={e => e.stopPropagation()}><DriveMark t={t} doc={d}/></td>
                <td><span className="dt-num">{d.signed_at ? whenHe(d.signed_at) : '—'}</span></td>
                <td onClick={e => e.stopPropagation()}><div className="dt-acts">
                  <a className="dt-ib" href={fileUrl(d.id, st === 'signed' ? 'signed' : 'original')} target="_blank" rel="noreferrer" title={st === 'signed' ? t.signedCopy : t.download} aria-label={t.download}><Download size={14}/></a>
                  {['sent', 'opened', 'expired', 'failed', 'draft'].includes(st) && <button type="button" className="dt-ib" title={t.resend} aria-label={t.resend} onClick={() => setOpen(d.id)}><Send size={14}/></button>}
                  <button type="button" className="dt-ib" title={t.open} aria-label={t.open} onClick={() => openDoc(d)}><Eye size={14}/></button>
                </div></td>
              </tr>) })}</tbody>
          </table>
          <div className="dt-cards">{list.map(d => { const st = effectiveStatus(d), f = computeFees(d.data?.fees || {}); return (
            <div key={d.id} className="dt-card" onClick={() => openDoc(d)} role="button" tabIndex={0}>
              <div className="r"><b style={{ fontWeight: 600 }}>{d.client_name || '—'}</b><span className="dt-st" style={{ background: `${TONE[st]}1F`, color: TONE[st] }}>{t.st[st]}</span></div>
              <div className="r" style={{ fontSize: 12.5, color: 'var(--au-text3)' }}><span>{propLine(d.data) || d.number}</span><span className="dt-num">{fmtMoney(f.total)}</span></div>
              <div className="r" style={{ fontSize: 12, color: 'var(--au-text3)' }}><span className="dt-num">{d.number}{d.project_name ? ` · ${d.project_name}` : ''}</span><span className="dt-num">{todayHe(d.created_at)}</span></div>
            </div>) })}</div>
        </>
      ))}
      <p style={{ fontSize: 12, color: 'var(--au-text3)', margin: 0 }}>{t.legal}</p>
      {quick && <QuickDoc t={t} leads={leads} properties={properties} projects={projects} templates={templates} settings={settings} initPropertyId={quick.propertyId || ''} initLeadId={quick.leadId || ''} initTemplateId={quick.templateId || ''} manual={!!quick.manual} onClose={() => setQuick(null)} onDone={msg => { setQuick(null); if (msg) push(msg); load() }} onFull={prefill => { setQuick(null); setWizard(prefill && prefill.property ? { prefill } : { projectId: project || '' }) }} push={push} onPresetSaved={s => setSettings(s)}/>}
      {wizard && <DocWizard t={t} leads={leads} properties={properties} projects={projects} templates={templates} settings={settings} init={wizard} onClose={() => setWizard(null)} onDone={(msg) => { setWizard(null); if (msg) push(msg); load() }} push={push} onQuick={tid => { const leadId = wizard.leadId || ''; setWizard(null); setQuick({ manual: true, templateId: tid === 'brokerage' ? '' : tid, leadId }) }}/>}
      {tplEditor && <Modal open onClose={() => setTplEditor(null)} title={null} full xl dir="rtl" label={t.areas.templates} closeOnBackdrop={false}>
        <div style={{ height: 'calc(100vh - 80px)', maxHeight: 920, display: 'flex', flexDirection: 'column' }}>
          {tplEditor.upload ? <TemplateUpload push={push} onCancel={() => setTplEditor(null)} onReady={r => setTplEditor({ ...r, ready: true })}/> : <TemplateEditor initial={tplEditor.template ? { template: tplEditor.template } : tplEditor} onClose={() => setTplEditor(null)} onSaved={() => { loadTemplates(); setArea('templates') }}/>}
        </div>
      </Modal>}
      <DocDrawer t={t} doc={cur} onClose={() => setOpen(null)} onChanged={load} push={push} onOpenLead={onOpenLead} leads={leads} onEdit={d => { setOpen(null); setWizard({ doc: d }) }}/>
      {settingsOpen && <DocSettings t={t} tab={settingsOpen === 'clauses' ? 'clauses' : 'general'} settings={settings} wiring={wiring} onClose={() => setSettingsOpen(false)} onSaved={s => { setSettings(s); push(t.settingsT.saved) }}/>}
      {toasts}
    </div>
  )
}

// ── the wizard ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** The wording sent with the signing link: a dropdown of the library (the suggested one marked), the rendered text to edit,
 *  "שחזור הנוסח" once edited. value = { messageId, text, edited }; what goes to the API is `signPayload(value)`. */
const MSG_KEY = 'afik_docs_msg_v1'
export const signPayload = v => ({ messageId: v?.messageId || '', text: v?.edited ? v.text : '' })
function SignMessageField({ doc, lead, value, onChange, resend = false, compact = false }) {
  const suggested = useMemo(() => suggestSignMessage(doc, { lead, resend }), [doc?.data?.client?.role, doc?.data?.property?.dealType, lead?.crm_data?.leadStatus, resend]) // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(!compact)
  useEffect(() => {
    if (value?.messageId) return
    let saved = ''
    try { saved = localStorage.getItem(MSG_KEY) || '' } catch { /* private mode */ }
    onChange({ messageId: !resend && SIGN_MESSAGE_IDS.includes(saved) ? saved : suggested, text: '', edited: false })
  }, [suggested]) // eslint-disable-line react-hooks/exhaustive-deps
  const id = value?.messageId || suggested
  const rendered = useMemo(() => signMessagePreview(doc, { messageId: id }), [doc, id])
  const text = value?.edited ? value.text : rendered
  const pick = mid => { onChange({ messageId: mid, text: '', edited: false }); if (!resend) try { localStorage.setItem(MSG_KEY, mid) } catch { /* ignore */ } }
  const m = signMessage(id)
  return (
    <div className="dw-msg">
      <div className="dw-msg-top">
        <label className="dw-msg-sel">
          <span>נוסח ההודעה</span>
          <select className="dt-input" value={id} aria-label="נוסח ההודעה" onChange={e => pick(e.target.value)}>
            {SIGN_MESSAGES.map(x => <option key={x.id} value={x.id}>{x.title}{x.id === suggested ? ' · מומלץ' : ''}</option>)}
          </select>
        </label>
        {compact && <button type="button" className="dt-link" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'הסתרת ההודעה' : 'עריכת ההודעה'}</button>}
      </div>
      <small className="dw-msg-hint">{m.hint}{id === suggested ? ' · מומלץ לפי הליד והעסקה' : ''}</small>
      {open && <>
        <textarea className="dt-input dw-msg-text" value={text} rows={Math.min(10, text.split('\n').length + 1)} aria-label="ההודעה ללקוח" onChange={e => onChange({ messageId: id, text: e.target.value, edited: true })}/>
        <div className="dw-msg-foot">
          <small>{'{link}'} = הקישור האישי לחתימה, נכנס בשליחה. באימייל נשלח אותו נוסח עם כפתור לחתימה.</small>
          {value?.edited && <button type="button" className="dt-link" onClick={() => pick(id)}>שחזור הנוסח</button>}
        </div>
      </>}
    </div>
  )
}

/** One lead search for the whole tab: name / phone, the lead's project, stage and phone on every row, ↑ ↓ Enter Esc. */
const STAGE_HE = { new: 'חדש', contacted: 'נוצר קשר', discovery: 'מתעניין', meeting: 'נקבעה פגישה', negotiating: 'רוצה להתקדם', won: 'עסקה', lost: 'ללא מענה', nurture: 'לחזור בהמשך', irrelevant: 'לא רלוונטי' }
function LeadFinder({ leads, value = '', onPick, placeholder = 'חיפוש ליד לפי שם או טלפון…', allowNone = false, noneLabel = 'ללא ליד (לקוח חדש)', openOnFocus = true, autoFocus = false, max = 40, inputClass = 'dt-input' }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const picked = value ? leads.find(l => String(l.id) === String(value)) : null
  useEffect(() => { setQ(picked ? picked.name || '' : '') }, [picked?.id, picked?.name]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => {
    const s = q.trim()
    const list = leads.filter(l => leadMatch(l, q))
    // the newest first when nothing is typed, the best name match first otherwise
    const sorted = s ? list.sort((a, b) => (String(b.name || '').toLowerCase().startsWith(s.toLowerCase()) ? 1 : 0) - (String(a.name || '').toLowerCase().startsWith(s.toLowerCase()) ? 1 : 0)) : list.sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0))
    return sorted.slice(0, max)
  }, [leads, q, max])
  const choose = l => { onPick(l); setOpen(false); setQ(l ? l.name || '' : '') }
  const key = e => {
    if (!open) { if (e.key === 'ArrowDown') { setOpen(true); e.preventDefault() } return }
    if (e.key === 'ArrowDown') { setHi(h => Math.min(rows.length - 1, h + 1)); e.preventDefault() }
    else if (e.key === 'ArrowUp') { setHi(h => Math.max(0, h - 1)); e.preventDefault() }
    else if (e.key === 'Enter') { if (rows[hi]) { choose(rows[hi]); e.preventDefault() } }
    else if (e.key === 'Escape') { setOpen(false); e.preventDefault(); e.stopPropagation() }
  }
  return (
    <div className="dw-finder" style={{ position: 'relative' }}>
      <input className={inputClass} value={q} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder} aria-expanded={open} role="combobox" aria-autocomplete="list"
        onChange={e => { setQ(e.target.value); setOpen(true); setHi(0) }} onFocus={() => openOnFocus && setOpen(true)} onKeyDown={key} onBlur={() => setTimeout(() => setOpen(false), 180)}/>
      {picked && <button type="button" className="dw-finder-x" aria-label="ניקוי" onMouseDown={e => e.preventDefault()} onClick={() => choose(null)}><XCircle size={14}/></button>}
      {open && (openOnFocus || q.trim()) && <div className="dw-lead-list" role="listbox">
        {allowNone && <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(null)}><XCircle size={14}/>{noneLabel}</button>}
        {rows.map((l, i) => { const st = l.crm_data?.leadStatus || l.leadStatus || ''; return (
          <button type="button" key={l.id} role="option" aria-selected={i === hi} className={i === hi ? 'hi' : ''} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setHi(i)} onClick={() => choose(l)}>
            <span className="dw-finder-av" aria-hidden="true">{String(l.name || '?').trim().slice(0, 1)}</span>
            <span style={{ flex: 1, minWidth: 0 }}><span className="dw-finder-name">{l.name || '—'}</span>{leadProperty(l) ? <span className="dw-finder-sub"> · {leadProperty(l)}</span> : null}{st && STAGE_HE[st] ? <span className="dw-finder-st">{STAGE_HE[st]}</span> : null}</span>
            <small>{localPhone(l.phone)}</small>
          </button>) })}
        {!rows.length && <div className="dw-finder-none">לא נמצא ליד כזה</div>}
      </div>}
    </div>
  )
}

/** Sent vs. signed by month: period chips, a KPI strip (with the change from the previous equal period), thin bars per
 *  month (sent = a tint, signed = the brand), and the table. A month row filters the list to that month's documents. */
const FUN_PERIODS = [[3, '3 חודשים'], [6, '6 חודשים'], [12, '12 חודשים'], [0, 'מההתחלה']]
function FunnelCard({ docs, onMonth }) {
  const [months, setMonths] = useState(() => { try { return Number(sessionStorage.getItem('afik_docs_fun') ?? 6) } catch { return 6 } })
  const f = useMemo(() => docFunnel(docs, { months }), [docs, months])
  const pickM = m => { setMonths(m); try { sessionStorage.setItem('afik_docs_fun', String(m)) } catch { /* ignore */ } }
  const delta = (a, b, pct = false) => { if (b == null || !f.prev) return null; const d = a - b; if (!d) return <span className="dt-fun-d same">ללא שינוי</span>; return <span className={`dt-fun-d ${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '+' : '−'}{Math.abs(d)}{pct ? ' נק׳' : ''} לעומת התקופה הקודמת</span> }
  const max = Math.max(1, ...f.months.map(m => m.sent))
  const n = f.months.length, COL = Math.round(Math.min(120, Math.max(44, 880 / Math.max(1, n)))), BW = Math.round(Math.min(26, COL * 0.3)), G = 3, H = 120
  const W = Math.max(f.months.length * COL, 1)
  const tip = m => `${m.label}: נשלחו ${m.sent}, נחתמו ${m.signed} (${m.rate}%), ממתינים ${m.waiting}, לא הושלמו ${m.lost}`
  return (
    <div className="dt-fun">
      <div className="dt-fun-head">
        <div><b>נשלחו ונחתמו</b><small>לפי חודש השליחה · כמה מהמסמכים שנשלחו בכל חודש נחתמו</small></div>
        <div className="dw-chips">{FUN_PERIODS.map(([m, l]) => <button type="button" key={m} className={`dw-chip${months === m ? ' on' : ''}`} onClick={() => pickM(m)}>{l}</button>)}</div>
      </div>
      <div className="dt-fun-kpis">
        <div><b>{f.totals.sent}</b><span>נשלחו לחתימה</span>{delta(f.totals.sent, f.prev?.sent)}</div>
        <div><b style={{ color: f.totals.signed ? 'var(--au-green-text)' : undefined }}>{f.totals.signed}</b><span>נחתמו</span>{delta(f.totals.signed, f.prev?.signed)}</div>
        <div><b>{f.totals.rate}%</b><span>אחוז חתימה</span>{delta(f.totals.rate, f.prev?.rate, true)}</div>
        <div><b>{fmtHours(f.totals.medianHours)}</b><span>זמן חציוני עד חתימה</span>{f.prev?.medianHours != null && f.totals.medianHours != null ? <span className={`dt-fun-d ${f.totals.medianHours <= f.prev.medianHours ? 'up' : 'down'}`}>{f.totals.medianHours <= f.prev.medianHours ? 'מהר יותר' : 'איטי יותר'} מהתקופה הקודמת ({fmtHours(f.prev.medianHours)})</span> : null}</div>
        <div><b style={{ color: f.waitingNow ? 'var(--au-amber-text)' : undefined }}>{f.waitingNow}</b><span>ממתינים עכשיו</span></div>
      </div>
      {f.months.length > 0 && <div className="dt-fun-chart" role="img" aria-label={`נשלחו ונחתמו לפי חודש: ${f.months.map(tip).join('; ')}`}>
        <svg viewBox={`0 0 ${W} ${H + 34}`} width={W} height={H + 34} style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }}>
          {[0.5, 1].map(k => <line key={k} x1="0" x2={W} y1={H - H * k * 0.86 + 12} y2={H - H * k * 0.86 + 12} stroke="rgba(var(--ov),.08)" strokeWidth="1"/>)}
          {f.months.map((m, i) => {
            const x = i * COL + (COL - (BW * 2 + G)) / 2
            const hs = Math.round(m.sent / max * H * 0.86), hg = Math.round(m.signed / max * H * 0.86)
            const y0 = H + 12
            return <g key={m.key} className="dt-fun-g" onClick={() => onMonth?.(m)} style={{ cursor: onMonth ? 'pointer' : 'default' }}>
              <title>{tip(m)}</title>
              <rect x={x} y={y0 - hs} width={BW} height={hs} rx="3" fill="rgba(var(--brand-rgb),.28)"/>
              <rect x={x + BW + G} y={y0 - hg} width={BW} height={hg} rx="3" fill="var(--au-brand)"/>
              {m.sent > 0 && <text x={x + BW / 2} y={y0 - hs - 3} textAnchor="middle" fontSize="9.5" fill="var(--au-text3)">{m.sent}</text>}
              {m.signed > 0 && <text x={x + BW + G + BW / 2} y={y0 - hg - 3} textAnchor="middle" fontSize="9.5" fontWeight="600" fill="var(--au-text)">{m.signed}</text>}
              <text x={i * COL + COL / 2} y={H + 28} textAnchor="middle" fontSize={COL < 56 ? 8.5 : 10} fill="var(--au-text3)">{COL < 56 ? m.label.replace(/ \d{4}$/, '').slice(0, 4) : m.label.replace(/ \d{4}$/, '')}{(i === 0 || m.key.endsWith('-01')) && COL >= 56 ? ` ${m.key.slice(2, 4)}׳` : ''}</text>
            </g>
          })}
        </svg>
        <div className="dt-fun-legend"><span><i style={{ background: 'rgba(var(--brand-rgb),.28)' }}/>נשלחו</span><span><i style={{ background: 'var(--au-brand)' }}/>נחתמו</span></div>
      </div>}
      <table className="dt-fun-table" aria-label="נשלחו ונחתמו לפי חודש">
        <thead><tr><th>חודש</th><th>נשלחו</th><th>נחתמו</th><th>אחוז</th><th>ממתינים</th><th className="hide-sm">לא הושלמו</th><th className="hide-sm">זמן חציוני</th></tr></thead>
        <tbody>{f.months.slice().reverse().map(m => <tr key={m.key} className={m.sent ? 'has' : ''} onClick={() => m.sent && onMonth?.(m)} tabIndex={m.sent ? 0 : -1} onKeyDown={e => { if (e.key === 'Enter' && m.sent) onMonth?.(m) }}>
          <td>{m.label}</td><td>{m.sent || '—'}</td><td className={m.signed ? 'ok' : ''}>{m.signed || '—'}</td><td>{m.sent ? `${m.rate}%` : '—'}<span className="dt-fun-bar" aria-hidden="true"><i style={{ width: `${m.rate}%` }}/></span></td><td>{m.waiting || '—'}</td><td className="hide-sm">{m.lost || '—'}</td><td className="hide-sm">{fmtHours(m.medianHours)}</td>
        </tr>)}</tbody>
        {f.months.length > 1 && <tfoot><tr><td>סה"כ</td><td>{f.totals.sent}</td><td className="ok">{f.totals.signed}</td><td>{f.totals.rate}%</td><td>{f.totals.waiting}</td><td className="hide-sm">{f.totals.lost}</td><td className="hide-sm">{fmtHours(f.totals.medianHours)}</td></tr></tfoot>}
      </table>
    </div>
  )
}

/** The bar on top of every full-screen modal of the module: ✕ to leave, what this screen is, where we are. */
function ModalBar({ title, sub, onClose, right = null, pct = null }) {
  return (<>
    <div className="dw-mhead">
      <IconButton icon={<X size={18}/>} label="סגירה" onClick={onClose} size={36}/>
      <div className="dw-mhead-t"><b>{title}</b>{sub && <small>{sub}</small>}</div>
      {right && <div className="dw-mhead-r">{right}</div>}
    </div>
    {pct != null && <div className="dw-prog" aria-hidden="true"><i style={{ width: `${pct}%` }}/></div>}
  </>)
}
/** On a phone the preview replaces the form: this bar brings the form back (and ✕ leaves). */
function PreviewBar({ onBack, onClose, label = 'חזרה לטופס' }) {
  return <div className="dw-prev-bar"><Button size="sm" variant="ghost" icon={<ChevronRight size={14}/>} onClick={onBack}>{label}</Button><b>תצוגה מקדימה</b><IconButton icon={<X size={18}/>} label="סגירה" onClick={onClose} size={34}/></div>
}

function DocWizard({ t, leads, properties, projects = [], templates = [], settings, init, onClose, onDone, push, onQuick = null }) {
  const [step, setStep] = useState(init.templateId || init.doc || init.prefill ? 1 : 0)
  const [form, setForm] = useState(() => {
    const f = emptyForm(settings)
    if (init.doc) { const d = init.doc.data || {}; return { ...f, ...d, client: { ...f.client, ...d.client, ...splitName(d.client?.name) }, property: { ...f.property, ...d.property, price: d.fees?.price || '' }, fees: { ...f.fees, ...d.fees }, agent: { ...f.agent, ...d.agent }, logo: { ...f.logo, ...d.logo }, leadId: init.doc.lead_id || '', propertyId: init.doc.property_id || '', templateId: init.doc.template_id || 'brokerage', projectId: init.doc.project_id || '', projectName: init.doc.project_name || d.projectName || '', fields: d.fields || {} } }
    if (init.prefill) return { ...f, ...init.prefill, client: { ...f.client, ...init.prefill.client }, property: { ...f.property, ...init.prefill.property }, fees: { ...f.fees, ...init.prefill.fees } }
    return { ...f, templateId: init.templateId || 'brokerage', projectId: init.projectId || '', projectName: init.projectId ? (projects.find(p => p.id === init.projectId)?.name || '') : '' }
  })
  const [docId, setDocId] = useState(init.doc?.id || '')
  const [number, setNumber] = useState(init.doc?.number || '')
  const [propQ, setPropQ] = useState('')
  const [propOpen, setPropOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [errs, setErrs] = useState([])
  const [showPrev, setShowPrev] = useState(false)
  const [send, setSend] = useState({ via: 'both', msg: null })
  const [result, setResult] = useState(null)
  const prevRef = useRef(null)
  const [scale, setScale] = useState(1)
  const set = (path, v) => setForm(f => { const n = { ...f }; const [a, b] = path.split('.'); if (b) n[a] = { ...n[a], [b]: v }; else n[a] = v; return n })
  useEffect(() => { if (settings && !init.doc) setForm(f => ({ ...f, fees: { ...f.fees, vatRate: settings.vatRate }, agent: f.agent.name ? f.agent : { ...settings.agent }, logo: f.logo.url || !settings.logo ? f.logo : { ...settings.logo }, expiryDays: settings.expiryDays })) }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps
  const pickLead = useCallback(l => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!l) { setForm(f => ({ ...f, leadId: '' })); return }
    const nm = splitName(l.name)
    const cd = l.crm_data || {}
    const pj = projectOfLead(l, projects)
    setForm(f => ({ ...f, leadId: String(l.id), client: { ...f.client, ...nm, name: l.name || '', phone: l.phone || f.client.phone, email: l.email || f.client.email, role: cd.dealType === 'rent' ? 'renter' : f.client.role }, property: { ...f.property, address: f.property.address || leadProperty(l) || '', dealType: cd.dealType === 'rent' ? 'rent' : f.property.dealType }, ...(pj && !f.projectId ? { projectId: pj.id, projectName: pj.name } : {}) }))
  }, [])
  useEffect(() => { if (init.leadId && !init.doc) { const l = leads.find(x => String(x.id) === String(init.leadId)); if (l) pickLead(l) } }, [init.leadId, init.doc, leads, pickLead])
  const pickProp = p => {
    if (!p) { setForm(f => ({ ...f, propertyId: '' })); setPropQ(''); setPropOpen(false); return }
    const price = Number(String(p.price || '').replace(/\D/g, '')) || ''
    setForm(f => ({ ...f, propertyId: String(p.id), property: { ...f.property, address: [p.street, p.houseNumber].filter(Boolean).join(' ') || p.address || p.title || '', city: p.city || p.location || f.property.city, desc: [p.type, p.rooms ? `${p.rooms} חדרים` : '', p.size ? `${p.size} מ"ר` : ''].filter(Boolean).join(', ') || f.property.desc, type: p.type || f.property.type, price: price || f.property.price, link: p.id ? `https://www.afikhanahal.co.il/p/${p.id}` : f.property.link, dealType: p.category === 'rentals' ? 'rent' : f.property.dealType } }))
    setPropQ(p.title || p.address || ''); setPropOpen(false)
  }
  const fees = computeFees({ ...form.fees, price: form.property.price })
  const clauses = settings?.clauses?.length ? settings.clauses : null
  const tpl = useMemo(() => (form.templateId && form.templateId !== 'brokerage' && templates.find(x => x.id === form.templateId)) || brokerageTemplate(clauses || undefined), [form.templateId, templates, clauses])
  const keys = useMemo(() => templateKeys(tpl), [tpl])
  const usesFees = tpl.sections.fees || keys.some(k => FEE_KEYS.includes(k))
  const usesProperty = tpl.sections.property || keys.some(k => k.startsWith('PROPERTY_') || k === 'DEAL_TYPE')
  const flow = useMemo(() => ['tpl', 'client', ...(usesProperty ? ['property'] : []), ...(usesFees ? ['fees'] : []), ...(tpl.fields.length ? ['fields'] : []), 'preview', 'send'], [usesProperty, usesFees, tpl.fields.length])
  const cur = flow[Math.min(step, flow.length - 1)]
  const view = useMemo(() => formView(form, tpl, number), [form, tpl, number])
  const lastData = flow.indexOf('preview') - 1
  const lead = leads.find(l => String(l.id) === String(form.leadId))
  useEffect(() => {
    const el = prevRef.current; if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, (el.clientWidth - 40) / 794)))
    ro.observe(el); return () => ro.disconnect()
  }, [])
  const reqOpts = { requireProperty: usesProperty, requireFees: usesFees, requireAgent: tpl.kind === 'brokerage' }
  const validate = () => { const { errors } = cleanDocInput({ ...form, fees: { ...form.fees, price: form.property.price } }, reqOpts); const miss = missingFields(tpl, view.values).filter(f => f.required).map(f => `השדה "${f.label}" חסר`); setErrs([...errors, ...miss]); return !errors.length && !miss.length }
  const payload = () => ({ ...form, templateId: form.templateId || 'brokerage', fees: { ...form.fees, price: form.property.price }, client: { ...form.client, name: form.client.name || [form.client.firstName, form.client.lastName].filter(Boolean).join(' ') } })
  const save = async () => {
    if (!validate()) return null
    setBusy('save')
    try {
      const r = docId ? await api.post('docs-update', { id: docId, ...payload() }) : await api.post('docs-create', payload())
      if (r.errors) { setErrs(r.errors); return null }
      setDocId(r.doc.id); setNumber(r.doc.number)
      return r.doc
    } catch (e) { setErrs([e.message]); return null } finally { setBusy('') }
  }
  const next = async () => {
    if (cur === 'client' && !(form.client.name || form.client.firstName)) { setErrs(['שם הלקוח חסר']); return }
    if (cur === 'client' && !form.client.phone && !form.client.email) { setErrs(['צריך טלפון או אימייל של הלקוח']); return }
    if (cur === 'property' && usesProperty && !form.property.address) { setErrs(['כתובת הנכס חסרה']); return }
    if (step === lastData && !validate()) return
    setErrs([])
    if (step === lastData) { const d = await save(); if (!d) return }
    setStep(s => Math.min(flow.length - 1, s + 1))
  }
  const doSend = async () => {
    const d = docId ? { id: docId } : await save()
    if (!d) return
    const via = send.via === 'both' ? ['whatsapp', 'email'] : [send.via]
    setBusy('send')
    try {
      const r = await api.post('docs-send', { id: docId || d.id, via, ...signPayload(send.msg) })
      if (r.error) { setErrs([r.error]); return }
      setResult(r)
      const ok = r.results.filter(x => x.ok).length
      if (ok === r.results.length) push(t.sentOk)
    } catch (e) { setErrs([e.message]) } finally { setBusy('') }
  }
  const hasWa = !!form.client.phone, hasEmail = !!form.client.email
  const tplStep = (
    <>
      <Field label={t.tplPick}/>
      {onQuick && <button type="button" className="qd-mode" onClick={() => onQuick(form.templateId || 'brokerage')}><i><PenLine size={18}/></i><span><b>מילוי מהיר: רק מה שמשתנה</b><small>שם הלקוח, כתובת הנכס, מחיר ופרטי העסקה, דמי התיווך ותוקף החתימה — במסך אחד, עם תצוגה חיה. השאר נלקח מההגדרות.</small></span></button>}
      <div className="dt-tpls">
        {[{ id: 'brokerage', name: DOC_TYPES.brokerage.name, builtin: true, blocks: new Array(8), fields: [] }, ...templates].map(tp => <button type="button" key={tp.id} className={`dt-tpl${(form.templateId || 'brokerage') === tp.id ? ' on' : ''}`} style={(form.templateId || 'brokerage') === tp.id ? { borderColor: 'var(--au-brand)', boxShadow: '0 0 0 3px rgba(var(--brand-rgb),.14)' } : { cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, templateId: tp.id, title: tp.builtin ? '' : (tp.title || tp.name) }))}><div className="dt-tpl-top"><FileText size={15}/><b>{tp.name}</b>{tp.builtin && <span className="dt-st" style={{ background: 'rgba(var(--brand-rgb),.12)', color: 'var(--au-brand-text)' }}>{t.builtin}</span>}</div><small>{tp.builtin ? '8 סעיפים · לקוח · נכס · דמי תיווך' : `${t.tplBlocks(tp.blocks.length)} · ${t.tplFields(tp.fields.length)}`}</small></button>)}
      </div>
    </>
  )
  const fieldsStep = (
    <>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--au-text3)', lineHeight: 1.6 }}>{t.fieldsHint}</p>
      <div className="dw-fields">{tpl.fields.map(f => <div key={f.key} className={f.type === 'checkbox' ? 'full' : ''}><Field label={f.type === 'checkbox' ? '' : `${f.label}${f.required ? ' *' : ''}`}>{fieldInput(f, form.fields?.[f.key] ?? f.default ?? '', v => setForm(x => ({ ...x, fields: { ...(x.fields || {}), [f.key]: v } })))}</Field></div>)}</div>
      {(() => { const empty = keys.filter(k => STANDARD_FIELDS[k] && !String(view.values[k] || '').trim() && k !== 'TERMS'); return empty.length ? <div className="dw-err" style={{ background: 'rgba(245,166,35,.12)', color: 'var(--au-amber-text)' }}>{t.missingStd} {empty.map(k => STANDARD_FIELDS[k].label).join(' · ')}</div> : null })()}
    </>
  )
  const stepUi = [
    <>
      <Field label={t.project}><ProjectSelect projects={projects} value={form.projectId} lang="he" onChange={(id, p) => setForm(f => ({ ...f, projectId: id || '', projectName: p?.name || '' }))}/></Field>
      <div className="dw-lead">
        <Field label={t.pickLead} hint={t.leadNote}>
          <LeadFinder leads={leads} value={form.leadId} onPick={pickLead} placeholder={t.leadPh} allowNone noneLabel={t.noLead}/>
        </Field>
        {lead && <div className="dw-ok"><Check size={13}/> {lead.name}{projectOfLead(lead, projects)?.name ? ` · ${projectOfLead(lead, projects).name}` : ''}</div>}
      </div>
      <div className="dw-grid">
        <Field label={t.client.first}><input className="dt-input" value={form.client.firstName} aria-label={t.client.first} onChange={e => setForm(f => ({ ...f, client: { ...f.client, firstName: e.target.value, name: [e.target.value, f.client.lastName].filter(Boolean).join(' ') } }))}/></Field>
        <Field label={t.client.last}><input className="dt-input" value={form.client.lastName} aria-label={t.client.last} onChange={e => setForm(f => ({ ...f, client: { ...f.client, lastName: e.target.value, name: [f.client.firstName, e.target.value].filter(Boolean).join(' ') } }))}/></Field>
        <Field label={t.client.id}><input className="dt-input" dir="ltr" inputMode="numeric" value={form.client.idNumber} aria-label={t.client.id} onChange={e => set('client.idNumber', e.target.value.replace(/\D/g, '').slice(0, 9))}/></Field>
        <Field label={t.client.phone}><input className="dt-input" dir="ltr" inputMode="tel" value={form.client.phone} aria-label={t.client.phone} onChange={e => set('client.phone', e.target.value)}/></Field>
        <Field label={t.client.email}><input className="dt-input" dir="ltr" inputMode="email" value={form.client.email} aria-label={t.client.email} onChange={e => set('client.email', e.target.value)}/></Field>
        <Field label={t.client.role}><select className="dt-input" value={form.client.role} aria-label={t.client.role} onChange={e => set('client.role', e.target.value)}>{Object.entries(CLIENT_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <div className="full"><Field label={t.client.address}><input className="dt-input" value={form.client.address} aria-label={t.client.address} onChange={e => set('client.address', e.target.value)}/></Field></div>
      </div>
      <div className="dw-signers">
        <SectionHead title={<><Users size={14}/> {t.signers.title}</>} right={(form.signers || []).length < MAX_SIGNERS - 1 && <Button size="sm" variant="ghost" icon={<Plus size={12}/>} onClick={() => set('signers', [...(form.signers || []), { name: '', idNumber: '', phone: '', email: '', role: 'spouse' }])}>{t.signers.add}</Button>}/>
        <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--au-text3)', lineHeight: 1.6 }}>{t.signers.hint}</p>
        {(form.signers || []).map((sg, i) => <div key={i} className="dw-grid dw-signer">
          <Field label={`${t.signers.name} (${i + 2})`}><input className="dt-input" value={sg.name} aria-label={`${t.signers.name} ${i + 2}`} onChange={e => set('signers', form.signers.map((x, k) => k === i ? { ...x, name: e.target.value } : x))}/></Field>
          <Field label={t.signers.role}><select className="dt-input" value={sg.role} aria-label={`${t.signers.role} ${i + 2}`} onChange={e => set('signers', form.signers.map((x, k) => k === i ? { ...x, role: e.target.value } : x))}>{Object.entries(SIGNER_ROLES).filter(([k]) => k !== 'client').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label={t.client.phone}><input className="dt-input" dir="ltr" inputMode="tel" value={sg.phone} aria-label={`${t.client.phone} ${i + 2}`} onChange={e => set('signers', form.signers.map((x, k) => k === i ? { ...x, phone: e.target.value } : x))}/></Field>
          <Field label={t.client.email}><input className="dt-input" dir="ltr" inputMode="email" value={sg.email} aria-label={`${t.client.email} ${i + 2}`} onChange={e => set('signers', form.signers.map((x, k) => k === i ? { ...x, email: e.target.value } : x))}/></Field>
          <Field label={t.client.id}><input className="dt-input" dir="ltr" inputMode="numeric" value={sg.idNumber} aria-label={`${t.client.id} ${i + 2}`} onChange={e => set('signers', form.signers.map((x, k) => k === i ? { ...x, idNumber: e.target.value.replace(/\D/g, '').slice(0, 9) } : x))}/></Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><Button size="sm" variant="ghost" icon={<Trash2 size={12}/>} onClick={() => set('signers', form.signers.filter((_, k) => k !== i))}>{t.signers.remove}</Button></div>
        </div>)}
      </div>
    </>,
    <>
      <div className="dw-lead">
        <Field label={t.pickProp}>
          <div style={{ position: 'relative' }}>
            <input className="dt-input" value={propQ} placeholder={t.propPh} onChange={e => { setPropQ(e.target.value); setPropOpen(true) }} onFocus={() => setPropOpen(true)} aria-label={t.pickProp}/>
            {propOpen && <div className="dw-lead-list" role="listbox">
              <button type="button" onClick={() => pickProp(null)}><XCircle size={14}/>{t.noProp}</button>
              {properties.filter(p => !propQ.trim() || `${p.title || ''} ${p.address || ''} ${p.city || ''} ${p.street || ''}`.toLowerCase().includes(propQ.trim().toLowerCase())).slice(0, 40).map(p => <button type="button" key={p.id} onClick={() => pickProp(p)}><span style={{ flex: 1 }}>{p.title || p.address}</span><small>{p.city || p.location || ''}</small></button>)}
            </div>}
          </div>
        </Field>
      </div>
      <div className="dw-grid">
        <div className="full"><Field label={t.property.address}><input className="dt-input" value={form.property.address} aria-label={t.property.address} onChange={e => set('property.address', e.target.value)}/></Field></div>
        <Field label={t.property.city}><input className="dt-input" value={form.property.city} aria-label={t.property.city} onChange={e => set('property.city', e.target.value)}/></Field>
        <Field label={t.property.type}><input className="dt-input" value={form.property.type} aria-label={t.property.type} onChange={e => set('property.type', e.target.value)} placeholder="דירה / בית פרטי / מגרש / משרד…"/></Field>
        <Field label={t.property.dealType}><div className="dw-chips">{Object.entries(DEAL_TYPES).map(([k, v]) => <button type="button" key={k} className={`dw-chip${form.property.dealType === k ? ' on' : ''}`} onClick={() => { set('property.dealType', k); if (k === 'rent' && form.fees.mode === 'percent') set('fees.mode', 'months') }}>{v}</button>)}</div></Field>
        <Field label={t.property.price}><input className="dt-input" dir="ltr" inputMode="numeric" value={form.property.price} aria-label={t.property.price} onChange={e => set('property.price', e.target.value.replace(/[^\d.]/g, ''))}/></Field>
        <div className="full"><Field label={t.property.desc}><textarea className="dt-input" value={form.property.desc} aria-label={t.property.desc} onChange={e => set('property.desc', e.target.value)}/></Field></div>
        <Field label={t.property.link}><input className="dt-input" dir="ltr" value={form.property.link} aria-label={t.property.link} onChange={e => set('property.link', e.target.value)}/></Field>
        <Field label={t.property.notes}><input className="dt-input" value={form.property.notes} aria-label={t.property.notes} onChange={e => set('property.notes', e.target.value)}/></Field>
      </div>
    </>,
    <>
      <Field label={t.fees.mode}><div className="dw-chips">{Object.entries(FEE_MODES).map(([k, v]) => <button type="button" key={k} className={`dw-chip${form.fees.mode === k ? ' on' : ''}`} onClick={() => set('fees.mode', k)}>{v}</button>)}</div></Field>
      {form.fees.mode === 'percent' && <Field label={t.fees.pct}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--au-text3)' }}>{t.fees.quick}</span>
          {[1, 1.5, 2, 2.5].map(p => <button type="button" key={p} className={`dw-chip${Number(form.fees.pct) === p ? ' on' : ''}`} onClick={() => set('fees.pct', p)}>{p}%</button>)}
          <input className="dt-input" dir="ltr" inputMode="decimal" style={{ width: 90 }} value={form.fees.pct} onChange={e => set('fees.pct', e.target.value.replace(/[^\d.]/g, ''))} aria-label={t.fees.custom}/>
        </div>
      </Field>}
      {form.fees.mode === 'fixed' && <Field label={t.fees.fixed}><input className="dt-input" dir="ltr" inputMode="numeric" value={form.fees.fixed} aria-label={t.fees.fixed} onChange={e => set('fees.fixed', e.target.value.replace(/[^\d.]/g, ''))}/></Field>}
      {form.fees.mode === 'months' && <Field label={t.fees.months}><input className="dt-input" dir="ltr" inputMode="decimal" style={{ width: 120 }} value={form.fees.months} aria-label={t.fees.months} onChange={e => set('fees.months', e.target.value.replace(/[^\d.]/g, ''))}/></Field>}
      <div className="dw-grid">
        <Field label={t.property.price}><input className="dt-input" dir="ltr" inputMode="numeric" value={form.property.price} aria-label={t.property.price} onChange={e => set('property.price', e.target.value.replace(/[^\d.]/g, ''))}/></Field>
        <Field label={t.fees.vat}><input className="dt-input" dir="ltr" inputMode="decimal" value={form.fees.vatRate} aria-label={t.fees.vat} onChange={e => set('fees.vatRate', e.target.value.replace(/[^\d.]/g, ''))}/></Field>
      </div>
      <div className="dw-sum" aria-label={t.fees.summary}>
        <span>{fees.basis}</span><b>{fmtMoney(fees.price)}</b>
        <span>דמי תיווך לפני מע"מ</span><b>{fmtMoney(fees.commission)}</b>
        <span>מע"מ {fmtPct(fees.vatRate)}</span><b>{fmtMoney(fees.vat)}</b>
        <div className="t"><span>סה"כ כולל מע"מ</span><b>{fmtMoney(fees.total)}</b></div>
      </div>
      <Field label={t.fees.terms}><textarea className="dt-input" value={form.terms} aria-label={t.fees.terms} onChange={e => set('terms', e.target.value)}/></Field>
      <SectionHead title={t.fees.agent}/>
      <div className="dw-grid">
        <Field label={t.fees.agentName}><input className="dt-input" value={form.agent.name} aria-label={t.fees.agentName} onChange={e => set('agent.name', e.target.value)}/></Field>
        <Field label={t.fees.license}><input className="dt-input" dir="ltr" value={form.agent.license} aria-label={t.fees.license} onChange={e => set('agent.license', e.target.value)}/></Field>
        <Field label={t.fees.agentPhone}><input className="dt-input" dir="ltr" value={form.agent.phone} aria-label={t.fees.agentPhone} onChange={e => set('agent.phone', e.target.value)}/></Field>
        <Field label={t.fees.expiry}><input className="dt-input" dir="ltr" inputMode="numeric" value={form.expiryDays} aria-label={t.fees.expiry} onChange={e => set('expiryDays', e.target.value.replace(/\D/g, ''))}/></Field>
      </div>
      <LogoFields t={t} logo={form.logo} onChange={l => set('logo', l)} push={push}/>
    </>,
    <>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--au-text3)' }}>{t.previewHint}</p>
      <div className="dw-chips">
        {docId && <a className="dw-chip" href={fileUrl(docId, 'original')} target="_blank" rel="noreferrer">{t.openPdf}</a>}
        {docId && <a className="dw-chip" href={fileUrl(docId, 'docx', true)}>{t.downloadWord}</a>}
        <button type="button" className="dw-chip" onClick={() => setShowPrev(s => !s)}>{showPrev ? 'חזרה לטופס' : t.preview}</button>
      </div>
      {number && <div className="dw-ok"><Check size={13}/> {t.saveDraft}: {number}</div>}
    </>,
    <>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--au-text3)', lineHeight: 1.6 }}>{t.send.note}</p>
      {!hasWa && !hasEmail && <div className="dw-err">{t.send.missing}</div>}
      <Field label={t.send.via}><div className="dw-chips">
        {hasWa && <button type="button" className={`dw-chip${send.via === 'whatsapp' ? ' on' : ''}`} onClick={() => setSend(s => ({ ...s, via: 'whatsapp', picked: true }))}><MessageCircle size={12}/> {t.send.wa} · {localPhone(form.client.phone)}</button>}
        {hasEmail && <button type="button" className={`dw-chip${send.via === 'email' ? ' on' : ''}`} onClick={() => setSend(s => ({ ...s, via: 'email', picked: true }))}><Mail size={12}/> {t.send.email} · {form.client.email}</button>}
        {hasWa && hasEmail && <button type="button" className={`dw-chip${send.via === 'both' ? ' on' : ''}`} onClick={() => setSend(s => ({ ...s, via: 'both', picked: true }))}>{t.send.both}</button>}
      </div></Field>
      <SignMessageField doc={{ data: payload(), expires_at: Date.now() + (Number(form.expiryDays) || 14) * 864e5 }} lead={lead} value={send.msg} onChange={msg => setSend(s => ({ ...s, msg }))} resend={!!init.doc && !!init.doc.sent_at}/>
      <div style={{ fontSize: 12.5, color: 'var(--au-text3)' }}>{t.send.expiry}: {form.expiryDays} {t.send.days}</div>
      {result && <div className="dd-sec">
        {result.results.map(r => <div key={r.via} className={r.ok ? 'dw-ok' : 'dw-err'}>{r.ok ? <Check size={13}/> : <AlertTriangle size={13}/>} {r.via === 'whatsapp' ? t.send.wa : t.send.email}: {r.ok ? 'נשלח' : r.error}</div>)}
        {result.link && <CopyRow label="הקישור ללקוח" value={result.link} t={t}/>}
      </div>}
    </>,
  ]
  // the channel follows what the client has: both when both, else the one there is
  useEffect(() => { setSend(s => { const ok = v => (v === 'whatsapp' && hasWa) || (v === 'email' && hasEmail) || (v === 'both' && hasWa && hasEmail); const best = hasWa && hasEmail ? 'both' : hasWa ? 'whatsapp' : 'email'; return s.picked && ok(s.via) ? s : { ...s, via: best } }) }, [hasWa, hasEmail])   // follows the client's details until a channel is picked by hand
  return (
    <Modal open onClose={onClose} title={null} full xl dir="rtl" label={t.newDoc} closeOnBackdrop={false}>
      <div className={`dw${showPrev ? ' show-prev' : ''}`} style={{ height: 'calc(100vh - 80px)', maxHeight: 900 }}>
        <div className="dw-form">
          <ModalBar title={`${STEP_LABEL[cur]}${number ? ` · ${number}` : ''}`} sub={`${init.doc ? 'עריכת מסמך' : t.newDoc} · שלב ${step + 1} מתוך ${flow.length}`} onClose={onClose} pct={Math.round((step + 1) / flow.length * 100)}
            right={step >= 1 && cur !== 'send' && cur !== 'preview' ? <Button size="sm" variant="ghost" loading={busy === 'save'} onClick={async () => { const d = await save(); if (d) onDone(`${t.saveDraft} ✓ ${d.number}`) }}>{t.saveDraft}</Button> : null}/>
          <div className="dw-steps" role="list">{flow.map((id, i) => <div key={id} role="listitem" className={`dw-step${i === step ? ' on' : i < step ? ' done' : ''}`} title={STEP_LABEL[id]}><i>{i < step ? '✓' : i + 1}</i><span className="lbl">{STEP_LABEL[id]}</span></div>)}</div>
          <div className="dw-body">{cur === 'tpl' ? tplStep : cur === 'fields' ? fieldsStep : stepUi[{ client: 0, property: 1, fees: 2, preview: 3, send: 4 }[cur]]}{!!errs.length && <div className="dw-err" role="alert">{errs.map((e, i) => <div key={i}>{e}</div>)}</div>}</div>
          <div className="dw-foot">
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="plain" className="dw-close-btn" onClick={onClose}>✕ סגירה</Button>
              <Button variant="ghost" className="dw-back" icon={<ChevronRight size={14}/>} disabled={step === 0} onClick={() => { setErrs([]); setStep(s => Math.max(0, s - 1)) }}>{t.back}</Button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="dw-chip dw-prev-btn" onClick={() => setShowPrev(s => !s)} aria-label={showPrev ? 'הטופס' : t.preview}><Eye size={14}/> {showPrev ? 'הטופס' : t.preview}</button>
              {step >= 1 && cur !== 'send' && cur !== 'preview' && <Button variant="ghost" className="dw-draft-btn" loading={busy === 'save'} onClick={async () => { const d = await save(); if (d) onDone(`${t.saveDraft} ✓ ${d.number}`) }}>{t.saveDraft}</Button>}
              {cur !== 'send' ? <Button variant="solid" className="dw-next" icon={<ChevronLeft size={14}/>} loading={busy === 'save'} onClick={next}>{t.next}</Button>
                : result?.results?.some(r => r.ok) ? <Button variant="solid" className="dw-next" onClick={() => onDone('')}>סיום</Button>
                : <Button variant="solid" className="dw-next" icon={<Send size={14}/>} loading={busy === 'send'} disabled={!hasWa && !hasEmail} onClick={doSend}>{t.sendNow}</Button>}
            </div>
          </div>
        </div>
        <div className="dw-prev" ref={prevRef}><PreviewBar onBack={() => setShowPrev(false)} onClose={onClose}/><div className="dw-prev-in" style={{ transform: `scale(${scale})`, width: 794 }}><DocSheet view={view}/></div></div>
      </div>
    </Modal>
  )
}

function CopyRow({ label, value, t }) {
  const [ok, setOk] = useState(false)
  const copy = () => { navigator.clipboard?.writeText(value).then(() => { setOk(true); setTimeout(() => setOk(false), 1800) }).catch(() => {}) }
  return <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ fontSize: 12, color: 'var(--au-text3)', whiteSpace: 'nowrap' }}>{label}</span><input className="dt-input" dir="ltr" readOnly value={value} onFocus={e => e.target.select()} style={{ height: 34, fontSize: 12 }}/><Button size="sm" variant="ghost" icon={ok ? <Check size={12}/> : <Copy size={12}/>} onClick={copy}>{ok ? t.copied : t.copy}</Button></div>
}

/** the logo: show / hide, size, position, upload a PNG / JPG (through the wizard's signed upload → property-media/templates) */
function LogoFields({ t, logo, onChange, push }) {
  const [busy, setBusy] = useState(false)
  const upload = async file => {
    if (!file || !/^image\/(png|jpeg)$/.test(file.type)) { push?.('הלוגו צריך להיות PNG או JPG'); return }
    setBusy(true)
    try {
      const r = await fetch('/api/seller-form?action=wizard-upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json', ...AUTH }, body: JSON.stringify({ name: `logo-${Date.now()}.${file.type === 'image/png' ? 'png' : 'jpg'}`, type: file.type, folder: 'templates' }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.signedUrl) throw new Error(d.error || 'upload url')
      const up = await fetch(d.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type, 'cache-control': 'max-age=31536000' }, body: file })
      if (!up.ok) throw new Error(`upload ${up.status}`)
      onChange({ ...logo, url: d.url, show: true })
    } catch (e) { push?.(`העלאת הלוגו נכשלה: ${e.message}`) } finally { setBusy(false) }
  }
  return (
    <div className="dd-sec">
      <SectionHead title={t.logo.title}/>
      <div className="dw-chips">
        <button type="button" className={`dw-chip${logo.show !== false ? ' on' : ''}`} onClick={() => onChange({ ...logo, show: logo.show === false })}>{t.logo.show}</button>
        {Object.entries(t.logo.sizes).map(([k, v]) => <button type="button" key={k} className={`dw-chip${logo.size === k ? ' on' : ''}`} onClick={() => onChange({ ...logo, size: k })}>{v}</button>)}
        {Object.entries(t.logo.aligns).map(([k, v]) => <button type="button" key={k} className={`dw-chip${(logo.align || 'right') === k ? ' on' : ''}`} onClick={() => onChange({ ...logo, align: k })}>{v}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="dw-chip" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Upload size={12}/>{busy ? t.logo.uploading : t.logo.upload}<input type="file" accept="image/png,image/jpeg" hidden onChange={e => upload(e.target.files?.[0])}/></label>
        {logo.url && <button type="button" className="dw-chip" onClick={() => onChange({ ...logo, url: '' })}>{t.logo.reset}</button>}
        {logo.url && <img src={logo.url} alt="" style={{ height: 32, objectFit: 'contain' }}/>}
      </div>
    </div>
  )
}

// ── the drawer ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
// ── "מסמך מהיר מנכס": pick a property from the system, the document fills itself; only what changes is asked ──────────────
// The property's details (address, town, description, type, deal, price, link, gush / helka) come from the record
// (propertyToDoc); the template, the fee, the terms and the validity come from the property's preset (settings.presets, saved
// with "לזכור לנכס הזה") — so the form left is the client, the fee if it changed, and the template's own fields. Live preview,
// then create + send in one click.
const qdCover = p => { const u = Array.isArray(p?.images) ? p.images.find(x => typeof x === 'string' && /^https?:/.test(x)) : ''; return u ? `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=360&h=240&fit=cover&q=70&output=webp` : '' }
const qdPrice = p => { const n = Number(String(p?.price || '').replace(/[^\d]/g, '')); return n ? `₪${n.toLocaleString('he-IL')}` : '' }
const QD_PCT = [1, 1.5, 2, 2.5, 3]
const MANUAL = { id: '', manual: true, title: 'מסמך חדש' }
function QuickDoc({ t, leads, properties, projects = [], templates = [], settings, initPropertyId = '', initLeadId = '', initTemplateId = '', manual: initManual = false, onClose, onDone, onFull, push, onPresetSaved }) {
  const [propId, setPropId] = useState(initPropertyId ? String(initPropertyId) : '')
  const [manual, setManual] = useState(!!initManual)   // no property from the system: the address, price and deal details are typed
  const [q, setQ] = useState('')
  const [onlyLive, setOnlyLive] = useState(true)
  const [form, setForm] = useState(() => emptyForm(settings))
  const [editProp, setEditProp] = useState(false)
  const [more, setMore] = useState(false)
  useEffect(() => { if (initTemplateId) setForm(f => ({ ...f, templateId: initTemplateId })) }, [initTemplateId])
  const [remember, setRemember] = useState(true)
  const [send, setSend] = useState({ via: 'whatsapp', msg: null })
  const [busy, setBusy] = useState('')
  const [errs, setErrs] = useState([])
  const [result, setResult] = useState(null)
  const [showPrev, setShowPrev] = useState(false)
  const [scale, setScale] = useState(1)
  const prevRef = useRef(null)
  const prop = manual ? MANUAL : (properties.find(p => String(p.id) === propId) || null)
  const preset = propId ? settings?.presets?.[propId] : null
  // a property picked → its fixed details + its preset (or a sensible start) — the client and anything typed stay
  const applied = useRef('')
  useEffect(() => {
    if (!prop || prop.manual) return
    const sig = `${propId}|${settings ? 1 : 0}`
    if (applied.current === sig) return
    applied.current = sig
    const pd = propertyToDoc(prop)
    const pr = settings?.presets?.[String(prop.id)] || null
    setForm(f => {
      const base = emptyForm(settings)
      const proj = pr?.projectId ? projects.find(x => x.id === pr.projectId) : null
      return { ...base, client: f.client, leadId: f.leadId, signers: f.signers, propertyId: pd.propertyId, property: { ...base.property, ...pd.property },
        templateId: pr?.templateId || 'brokerage', fees: { ...base.fees, ...pd.fees, ...(pr?.fees || {}), vatRate: settings?.vatRate ?? DEFAULT_VAT },
        terms: pr?.terms || '', expiryDays: pr?.expiryDays || base.expiryDays,
        projectId: proj?.id || f.projectId || '', projectName: proj?.name || pr?.projectName || f.projectName || '',
        ...(pr?.role ? { client: { ...f.client, role: pr.role } } : pd.property.dealType === 'rent' ? { client: { ...f.client, role: 'renter' } } : {}) }
    })
    setEditProp(false)
  }, [propId, !!prop, !!settings]) // eslint-disable-line react-hooks/exhaustive-deps
  const pickLead = useCallback(l => {
    if (!l) { setForm(f => ({ ...f, leadId: '' })); return }
    const nm = splitName(l.name)
    setForm(f => ({ ...f, leadId: String(l.id), client: { ...f.client, ...nm, name: l.name || '', phone: l.phone || '', email: l.email || '' } }))
  }, [])
  useEffect(() => { if (initLeadId) { const l = leads.find(x => String(x.id) === String(initLeadId)); if (l) pickLead(l) } }, [initLeadId]) // eslint-disable-line react-hooks/exhaustive-deps
  const tpl = useMemo(() => (form.templateId && form.templateId !== 'brokerage' && templates.find(x => x.id === form.templateId)) || brokerageTemplate(settings?.clauses?.length ? settings.clauses : undefined), [form.templateId, templates, settings])
  const keys = useMemo(() => templateKeys(tpl), [tpl])
  const usesFees = tpl.sections.fees || keys.some(k => FEE_KEYS.includes(k))
  const view = useMemo(() => formView(form, tpl, ''), [form, tpl])
  const fees = computeFees({ ...form.fees, price: form.property.price })
  const set = (path, v) => setForm(f => { const n = { ...f }; const [a, b] = path.split('.'); if (b) n[a] = { ...n[a], [b]: v }; else n[a] = v; return n })
  const hasWa = !!form.client.phone, hasEmail = !!form.client.email
  useEffect(() => { setSend(s => { const ok = v => (v === 'whatsapp' && hasWa) || (v === 'email' && hasEmail) || (v === 'both' && hasWa && hasEmail); const best = hasWa && hasEmail ? 'both' : hasWa ? 'whatsapp' : 'email'; return s.picked && ok(s.via) ? s : { ...s, via: best } }) }, [hasWa, hasEmail])   // follows the client's details until a channel is picked by hand
  useEffect(() => {
    const el = prevRef.current; if (!el) return
    const ro = new ResizeObserver(() => setScale(Math.min(1, (el.clientWidth - 40) / 794)))
    ro.observe(el); return () => ro.disconnect()
  }, [propId])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return properties.filter(p => (!onlyLive || p.published !== false) && (!s || `${p.title || ''} ${p.location || ''} ${p.street || ''} ${p.neighborhood || ''} ${p.type || ''} ${p.gush || ''}`.toLowerCase().includes(s)))
  }, [properties, q, onlyLive])
  const payload = () => ({ ...form, templateId: form.templateId || 'brokerage', fees: { ...form.fees, price: form.property.price }, client: { ...form.client, name: form.client.name || [form.client.firstName, form.client.lastName].filter(Boolean).join(' ') } })
  const validate = () => {
    const { errors } = cleanDocInput({ ...form, fees: { ...form.fees, price: form.property.price } }, { requireProperty: true, requireFees: usesFees, requireAgent: tpl.kind === 'brokerage' })
    const miss = missingFields(tpl, view.values).filter(f => f.required).map(f => `השדה "${f.label}" חסר`)
    setErrs([...errors, ...miss]); return !errors.length && !miss.length
  }
  const savePreset = async () => {
    if (!remember || !propId || manual) return
    const pr = { templateId: form.templateId || 'brokerage', fees: { mode: form.fees.mode, pct: form.fees.pct, months: form.fees.months, fixed: form.fees.fixed }, terms: form.terms, expiryDays: form.expiryDays, projectId: form.projectId, projectName: form.projectName, role: form.client.role }
    try { const r = await api.post('docs-settings', { presets: { [propId]: pr } }); if (r.settings) onPresetSaved?.(r.settings) } catch { /* the document itself is what matters */ }
  }
  const go = async (andSend) => {
    if (!validate()) return
    setBusy(andSend ? 'send' : 'save')
    try {
      const c = await api.post('docs-create', payload())
      if (c.errors) { setErrs(c.errors); return }
      await savePreset()
      if (!andSend) { onDone(`${t.saveDraft} ✓ ${c.doc.number}`); return }
      const via = send.via === 'both' ? ['whatsapp', 'email'] : [send.via]
      const r = await api.post('docs-send', { id: c.doc.id, via, ...signPayload(send.msg) })
      if (r.error) { setErrs([r.error]); setResult({ doc: c.doc, results: [] }); return }
      setResult({ ...r, doc: r.doc || c.doc })
    } catch (e) { setErrs([e.message]) } finally { setBusy('') }
  }
  // ── step 1: the properties ──
  if (!prop) return (
    <Modal open onClose={onClose} title={null} full xl dir="rtl" label="מסמך מהיר מנכס" closeOnBackdrop={false}>
      <div className="qd" style={{ height: 'calc(100vh - 80px)', maxHeight: 900 }}>
        <ModalBar title="מסמך מהיר" sub="מסמך לחתימה בדקה: מנכס מהמערכת, או רק הפרטים שמשתנים" onClose={onClose}/>
        <div className="qd-modes" style={{ paddingTop: 12 }}>
          <button type="button" className="qd-mode on" aria-pressed="true"><i><Building2 size={18}/></i><span><b>מנכס מהמערכת</b><small>הכתובת, התיאור והמחיר נכנסים לבד. בוחרים נכס למטה.</small></span></button>
          <button type="button" className="qd-mode" onClick={() => { setManual(true); setEditProp(true); setMore(false) }}><i><PenLine size={18}/></i><span><b>מילוי מהיר: רק מה שמשתנה</b><small>שם הלקוח, כתובת הנכס, מחיר ופרטי העסקה, דמי התיווך ותוקף החתימה.</small></span></button>
        </div>
        <div className="qd-tools">
          <div className="qd-search"><Search size={15}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="חיפוש לפי שם, עיר, רחוב, סוג או גוש…" aria-label="חיפוש נכס" autoFocus/></div>
          <div className="dw-chips"><button type="button" className={`dw-chip${onlyLive ? ' on' : ''}`} onClick={() => setOnlyLive(true)}>באוויר</button><button type="button" className={`dw-chip${!onlyLive ? ' on' : ''}`} onClick={() => setOnlyLive(false)}>כל הנכסים ({properties.length})</button></div>
        </div>
        <div className="qd-grid" role="list">
          {list.map(p => { const pr = settings?.presets?.[String(p.id)]; const img = qdCover(p); return (
            <button type="button" role="listitem" key={p.id} className="qd-card" onClick={() => setPropId(String(p.id))}>
              <div className="qd-img">{img ? <img src={img} alt="" loading="lazy"/> : <Building2 size={26}/>}{pr && <span className="qd-tag">שמור · {pr.fees?.mode === 'percent' && pr.fees?.pct ? fmtPct(pr.fees.pct) : pr.fees?.mode === 'months' ? `${pr.fees.months || 1} חודשי שכ״ד` : 'קבוע'}</span>}</div>
              <b>{p.title || 'נכס ללא שם'}</b>
              <small>{[p.location, p.street].filter(Boolean).join(' · ') || '—'}</small>
              <span className="qd-meta">{[p.category === 'rentals' ? 'להשכרה' : 'למכירה', p.rooms && `${p.rooms} חד׳`, p.size && `${p.size} מ״ר`].filter(Boolean).join(' · ')}{qdPrice(p) ? <em>{qdPrice(p)}</em> : null}</span>
            </button>) })}
          {!list.length && <div className="qd-empty">{properties.length ? 'אין נכס שמתאים לחיפוש.' : 'הנכסים עוד נטענים, או שאין נכסים במערכת.'} <button type="button" className="dt-link" onClick={onFull}>יצירת מסמך בלי נכס מהמערכת</button></div>}
        </div>
      </div>
    </Modal>
  )
  // ── step 2: only what changes ──
  const done = result?.results?.some(r => r.ok)
  return (
    <Modal open onClose={onClose} title={null} full xl dir="rtl" label="מסמך מהיר מנכס" closeOnBackdrop={false}>
      <div className={`dw${showPrev ? ' show-prev' : ''}`} style={{ height: 'calc(100vh - 80px)', maxHeight: 900 }}>
        <div className="dw-form">
          <ModalBar title={manual ? 'מילוי מהיר' : 'מסמך מהיר מנכס'} sub={manual ? 'רק מה שמשתנה · השאר מההגדרות ומהתבנית' : `${prop.title || form.property.address}${form.property.price ? ` · ${fmtMoney(form.property.price)}` : ''}`} onClose={onClose}
            right={<button type="button" className="dw-chip" onClick={() => { setManual(false); setPropId(''); setResult(null); setErrs([]) }}>{manual ? 'מנכס מהמערכת' : 'החלפת נכס'}</button>}/>
          {!manual && <div className="qd-prop">
            <div className="qd-thumb">{qdCover(prop) ? <img src={qdCover(prop)} alt=""/> : <Building2 size={20}/>}</div>
            <div style={{ minWidth: 0, flex: 1 }}><b>{prop.title || form.property.address}</b><small>{propLine({ property: form.property })}{form.property.price ? ` · ${fmtMoney(form.property.price)}` : ''}</small>{preset && <span className="qd-saved"><Check size={12}/> ההגדרות השמורות של הנכס נטענו</span>}</div>
          </div>}
          <div className="dw-body">
            {done ? <div className="qd-done">
              <div className="big"><Check size={30}/></div>
              <h3>נשלח לחתימה ✓ {result.doc?.number}</h3>
              <p>{result.results.filter(r => r.ok).map(r => r.via === 'whatsapp' ? 'בוואטסאפ' : 'באימייל').join(' ו')} ל{form.client.name || [form.client.firstName, form.client.lastName].filter(Boolean).join(' ')}. כשיחתמו תגיע הודעה למשרד, והעותק החתום יישמר בכרטיס הליד.</p>
              {result.link && <CopyRow label="קישור החתימה" value={result.link} t={t}/>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button variant="solid" onClick={() => { setResult(null); setForm(f => ({ ...f, leadId: '', client: { ...emptyForm(settings).client, role: f.client.role }, fields: {} })) }}>מסמך נוסף לאותו נכס</Button>
                <Button variant="ghost" onClick={() => onDone('')}>סיום</Button>
              </div>
            </div> : <>
            {manual && <div className="qd-sec"><h4><span>1</span>הנכס והעסקה</h4>
              <div className="dw-grid">
                <Field label="כתובת הנכס *"><input className="dt-input" value={form.property.address} aria-label="כתובת הנכס" placeholder="רחוב ומספר" onChange={e => set('property.address', e.target.value)}/></Field>
                <Field label="עיר"><input className="dt-input" value={form.property.city} aria-label="עיר" onChange={e => set('property.city', e.target.value)}/></Field>
                <Field label="סוג העסקה"><select className="dt-input" value={form.property.dealType} aria-label="סוג העסקה" onChange={e => { set('property.dealType', e.target.value); if (e.target.value === 'rent' && form.fees.mode === 'percent') set('fees.mode', 'months') }}>{Object.entries(DEAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                <Field label={form.property.dealType === 'rent' ? 'שכר דירה חודשי (₪)' : 'מחיר העסקה לפני מע"מ (₪)'}><input className="dt-input" dir="ltr" inputMode="numeric" value={form.property.price} aria-label="מחיר העסקה" onChange={e => set('property.price', e.target.value.replace(/[^\d]/g, ''))}/></Field>
                <div className="full"><Field label="פרטי העסקה / תיאור הנכס"><input className="dt-input" value={form.property.desc} aria-label="תיאור הנכס" placeholder="דירת 4 חדרים, קומה 3, חניה ומחסן…" onChange={e => set('property.desc', e.target.value)}/></Field></div>
              </div>
            </div>}
            {(templates.length > 0 || manual) && <Field label="איזה מסמך"><div className="dw-chips">{[{ id: 'brokerage', name: DOC_TYPES.brokerage.name }, ...templates].map(tp => <button type="button" key={tp.id} className={`dw-chip${(form.templateId || 'brokerage') === tp.id ? ' on' : ''}`} onClick={() => set('templateId', tp.id)}>{tp.name}</button>)}</div></Field>}
            <div className="qd-sec"><h4><span>{manual ? 2 : 1}</span>מי חותם</h4>
              <div className="dw-lead">
                <LeadFinder leads={leads} value={form.leadId} onPick={pickLead} placeholder="ליד מהמערכת — חיפוש לפי שם או טלפון…" openOnFocus={false}/>
              </div>
              <div className="dw-grid">
                <Field label="שם פרטי"><input className="dt-input" value={form.client.firstName} aria-label="שם פרטי" onChange={e => setForm(f => ({ ...f, client: { ...f.client, firstName: e.target.value, name: [e.target.value, f.client.lastName].filter(Boolean).join(' ') } }))}/></Field>
                <Field label="שם משפחה"><input className="dt-input" value={form.client.lastName} aria-label="שם משפחה" onChange={e => setForm(f => ({ ...f, client: { ...f.client, lastName: e.target.value, name: [f.client.firstName, e.target.value].filter(Boolean).join(' ') } }))}/></Field>
                <Field label="טלפון"><input className="dt-input" dir="ltr" inputMode="tel" value={form.client.phone} aria-label="טלפון" onChange={e => set('client.phone', e.target.value)}/></Field>
                <Field label="אימייל (לא חובה)"><input className="dt-input" dir="ltr" inputMode="email" value={form.client.email} aria-label="אימייל" onChange={e => set('client.email', e.target.value)}/></Field>
                <Field label="ת.ז. (לא חובה)"><input className="dt-input" dir="ltr" inputMode="numeric" value={form.client.idNumber} aria-label="תעודת זהות" onChange={e => set('client.idNumber', e.target.value.replace(/\D/g, '').slice(0, 9))}/></Field>
                <Field label="הלקוח בעסקה כ"><select className="dt-input" value={form.client.role} aria-label="תפקיד הלקוח בעסקה" onChange={e => set('client.role', e.target.value)}>{Object.entries(CLIENT_ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              </div>
            </div>
            {usesFees && <div className="qd-sec"><h4><span>{manual ? 3 : 2}</span>דמי התיווך ותוקף</h4>
              <div className="dw-chips">{Object.entries(FEE_MODES).map(([k, v]) => <button type="button" key={k} className={`dw-chip${form.fees.mode === k ? ' on' : ''}`} onClick={() => set('fees.mode', k)}>{v}</button>)}</div>
              <div className="dw-grid">
                {form.fees.mode === 'percent' && <Field label="אחוז"><div className="dw-chips">{QD_PCT.map(p => <button type="button" key={p} className={`dw-chip${Number(form.fees.pct) === p ? ' on' : ''}`} onClick={() => set('fees.pct', p)}>{fmtPct(p)}</button>)}<input className="dt-input" style={{ width: 80, height: 32 }} dir="ltr" inputMode="decimal" value={form.fees.pct} aria-label="אחוז אחר" onChange={e => set('fees.pct', e.target.value.replace(/[^\d.]/g, ''))}/></div></Field>}
                {form.fees.mode === 'months' && <Field label="חודשי שכירות"><input className="dt-input" dir="ltr" inputMode="decimal" value={form.fees.months} aria-label="חודשי שכירות" onChange={e => set('fees.months', e.target.value.replace(/[^\d.]/g, ''))}/></Field>}
                {form.fees.mode === 'fixed' && <Field label='סכום קבוע (₪, לפני מע"מ)'><input className="dt-input" dir="ltr" inputMode="numeric" value={form.fees.fixed} aria-label="סכום קבוע" onChange={e => set('fees.fixed', e.target.value.replace(/[^\d.]/g, ''))}/></Field>}
                {!manual && <Field label={form.fees.mode === 'months' ? 'שכר דירה חודשי (₪)' : 'מחיר העסקה לפני מע"מ (₪)'}><input className="dt-input" dir="ltr" inputMode="numeric" value={form.property.price} aria-label="מחיר העסקה" onChange={e => set('property.price', e.target.value.replace(/[^\d]/g, ''))}/></Field>}
              </div>
              <div className="qd-sum">{fees.basis} · דמי תיווך <b>{fmtMoney(fees.commission)}</b> + מע"מ {fmtMoney(fees.vat)} = <b>{fmtMoney(fees.total)}</b></div>
              <Field label="תוקף הקישור לחתימה (ימים)"><div className="dw-chips">{[7, 14, 30].map(d => <button type="button" key={d} className={`dw-chip${Number(form.expiryDays) === d ? ' on' : ''}`} onClick={() => set('expiryDays', d)}>{d} ימים</button>)}<input className="dt-input" style={{ width: 80, height: 32 }} dir="ltr" inputMode="numeric" value={form.expiryDays} aria-label="תוקף הקישור" onChange={e => set('expiryDays', e.target.value.replace(/\D/g, ''))}/></div></Field>
            </div>}
            {tpl.fields.length > 0 && <div className="qd-sec"><h4><span>{(manual ? 2 : 1) + (usesFees ? 2 : 1)}</span>פרטי המסמך</h4>
              <div className="dw-fields">{tpl.fields.map(f => <div key={f.key} className={f.type === 'checkbox' ? 'full' : ''}><Field label={f.type === 'checkbox' ? '' : `${f.label}${f.required ? ' *' : ''}`}>{fieldInput(f, form.fields?.[f.key] ?? f.default ?? '', v => setForm(x => ({ ...x, fields: { ...(x.fields || {}), [f.key]: v } })))}</Field></div>)}</div>
            </div>}
            <button type="button" className="qd-more" onClick={() => setMore(m => !m)} aria-expanded={more}>{more ? '▾' : '◂'} {manual ? 'הערות, פרויקט ותנאים נוספים' : 'פרטי הנכס, פרויקט ותנאים נוספים'}</button>
            {more && <div className="qd-sec">
              {manual ? <Field label="הערות (גוש / חלקה, קישור לנכס…)"><input className="dt-input" value={form.property.notes} aria-label="הערות" onChange={e => set('property.notes', e.target.value)}/></Field> : !editProp ? <div className="qd-fixed"><span>{propLine({ property: form.property })}</span><span>{form.property.desc}</span>{form.property.notes && <span>{form.property.notes}</span>}<button type="button" className="dt-link" onClick={() => setEditProp(true)}>עריכה</button></div>
                : <div className="dw-grid">
                  <Field label="כתובת הנכס"><input className="dt-input" value={form.property.address} aria-label="כתובת הנכס" onChange={e => set('property.address', e.target.value)}/></Field>
                  <Field label="עיר"><input className="dt-input" value={form.property.city} aria-label="עיר" onChange={e => set('property.city', e.target.value)}/></Field>
                  <div className="full"><Field label="תיאור הנכס"><input className="dt-input" value={form.property.desc} aria-label="תיאור הנכס" onChange={e => set('property.desc', e.target.value)}/></Field></div>
                  <Field label="סוג העסקה"><select className="dt-input" value={form.property.dealType} aria-label="סוג העסקה" onChange={e => set('property.dealType', e.target.value)}>{Object.entries(DEAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
                  <Field label="הערות"><input className="dt-input" value={form.property.notes} aria-label="הערות" onChange={e => set('property.notes', e.target.value)}/></Field>
                </div>}
              <Field label="פרויקט"><ProjectSelect value={form.projectId} projects={projects} onChange={(id, p) => setForm(f => ({ ...f, projectId: id || '', projectName: p?.name || '' }))}/></Field>
              <Field label="תנאים נוספים"><textarea className="dt-input" value={form.terms} aria-label="תנאים נוספים" onChange={e => set('terms', e.target.value)}/></Field>
            </div>}
            <div className="qd-sec"><h4><span><Send size={12}/></span>שליחה</h4>
              <div className="dw-chips">
                <button type="button" className={`dw-chip${send.via === 'whatsapp' ? ' on' : ''}`} disabled={!hasWa} onClick={() => setSend(s => ({ ...s, via: 'whatsapp', picked: true }))}><MessageCircle size={12}/> וואטסאפ</button>
                <button type="button" className={`dw-chip${send.via === 'email' ? ' on' : ''}`} disabled={!hasEmail} onClick={() => setSend(s => ({ ...s, via: 'email', picked: true }))}><Mail size={12}/> אימייל</button>
                <button type="button" className={`dw-chip${send.via === 'both' ? ' on' : ''}`} disabled={!hasWa || !hasEmail} onClick={() => setSend(s => ({ ...s, via: 'both', picked: true }))}>גם וגם</button>
              </div>
              <SignMessageField doc={{ data: payload(), expires_at: Date.now() + (Number(form.expiryDays) || 14) * 864e5 }} lead={leads.find(l => String(l.id) === String(form.leadId)) || null} value={send.msg} onChange={msg => setSend(s => ({ ...s, msg }))} compact/>
              {!manual && <label className="dt-tog"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/> לזכור לנכס הזה את התבנית, העמלה והתנאים — בפעם הבאה ממלאים רק את הלקוח</label>}
            </div>
            </>}
            {!!errs.length && <div className="dw-err" role="alert">{errs.map((e, i) => <div key={i}>{e}</div>)}</div>}
          </div>
          {!done && <div className="dw-foot qd-foot">
            <div className="qd-foot-sec"><Button variant="ghost" size="sm" onClick={() => onFull(form)}>לאשף המלא</Button></div>
            <div className="qd-foot-main">
              <button type="button" className="dw-chip dw-prev-btn" onClick={() => setShowPrev(s => !s)} aria-label={showPrev ? 'הטופס' : 'תצוגה מקדימה'}><Eye size={14}/> {showPrev ? 'הטופס' : 'תצוגה מקדימה'}</button>
              <Button variant="ghost" loading={busy === 'save'} onClick={() => go(false)}>טיוטה</Button>
              <Button variant="solid" icon={<Send size={14}/>} loading={busy === 'send'} disabled={!hasWa && !hasEmail} onClick={() => go(true)}>שליחה לחתימה</Button>
            </div>
          </div>}
        </div>
        <div className="dw-prev" ref={prevRef}><PreviewBar onBack={() => setShowPrev(false)} onClose={onClose}/><div className="dw-prev-in" style={{ transform: `scale(${scale})`, width: 794 }}><DocSheet view={view}/></div></div>
      </div>
    </Modal>
  )
}

/** the Drive column: a cloud in the state's color, a link when the file is there */
function DriveMark({ t, doc }) {
  const dr = doc.data?.drive
  if (!dr?.status) return <span style={{ color: 'var(--au-text3)' }}>—</span>
  const f = dr.files?.signed || dr.files?.original
  const color = dr.status === 'synced' ? 'var(--au-green-text)' : dr.status === 'pending' ? 'var(--au-text3)' : 'var(--au-red-text)'
  const label = t.drive[dr.status] || dr.status
  return f?.link ? <a className="dt-ib" href={f.link} target="_blank" rel="noreferrer" title={`${label} · ${f.name}`} aria-label={label} style={{ color }}><Cloud size={14}/></a> : <span className="dt-ib" title={dr.error || label} aria-label={label} style={{ color, cursor: 'default' }}><Cloud size={14}/></span>
}
function DocDrawer({ t, doc, onClose, onChanged, push, onOpenLead, leads, onEdit }) {
  const [full, setFull] = useState(null)
  const [busy, setBusy] = useState('')
  const [link, setLink] = useState('')
  const [via, setVia] = useState(null)
  const [msg, setMsg] = useState(null)
  useEffect(() => { setFull(null); setLink(''); setVia(null); setMsg(null); if (doc?.id) api.get('docs-get', { id: doc.id }).then(setFull).catch(e => push(e.message)) }, [doc?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!doc) return null
  const st = effectiveStatus(doc), d = doc.data || {}, f = computeFees(d.fees || {})
  const lead = doc.lead_id ? leads.find(l => String(l.id) === String(doc.lead_id)) : null
  const act = async (what, body, okMsg) => {
    setBusy(what)
    try { const r = await api.post(what, { id: doc.id, ...body }); if (r.error) throw new Error(r.error); if (r.link) setLink(r.link); if (okMsg) push(okMsg); onChanged(); if (r.doc) setFull(x => x ? { ...x, doc: r.doc } : x); return r } catch (e) { push(e.message) } finally { setBusy('') }
  }
  const canResend = ['sent', 'opened', 'expired', 'failed', 'draft'].includes(st)
  return (
    <Drawer open onClose={onClose} title={`${d.title || DOC_TYPES.brokerage.name} · ${doc.number}`} sub={`${d.client?.name || ''} · ${propLine(d) || ''}`} dir="rtl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="dt-st" style={{ background: `${TONE[st]}1F`, color: TONE[st] }}>{t.st[st]}</span>
          {doc.signed_at && <span style={{ fontSize: 12.5, color: 'var(--au-text3)' }}>{whenHe(doc.signed_at)}</span>}
          {lead ? <Button size="sm" variant="brand" onClick={() => onOpenLead?.(lead.id)}>{t.drawer.lead}: {lead.name}</Button> : <span style={{ fontSize: 12.5, color: 'var(--au-text3)' }}>{t.drawer.noLead}</span>}
        </div>
        <div className="dd-rows">
          <span>סוג</span><b>{d.title || DOC_TYPES.brokerage.name}{doc.template_id ? '' : ' (מובנית)'}</b>
          {doc.project_name && <><span>פרויקט</span><b>{doc.project_name}</b></>}
          <span>לקוח</span><b>{d.client?.name}{d.client?.idNumber ? ` · ת.ז. ${d.client.idNumber}` : ''}</b>
          <span>טלפון / אימייל</span><b dir="ltr" style={{ textAlign: 'right' }}>{[localPhone(d.client?.phone), d.client?.email].filter(Boolean).join(' · ')}</b>
          <span>נכס</span><b>{propLine(d)}{d.property?.desc ? ` · ${d.property.desc}` : ''}</b>
          <span>דמי תיווך</span><b>{f.basis} · {fmtMoney(f.commission)} + מע"מ = {fmtMoney(f.total)}</b>
          <span>נוצר</span><b>{whenHe(doc.created_at)}</b>
          {doc.sent_at && <><span>נשלח</span><b>{whenHe(doc.sent_at)}</b></>}
          {doc.expires_at && st !== 'signed' && <><span>תוקף הקישור</span><b>{todayHe(doc.expires_at)}</b></>}
        </div>
        <div className="dd-sec"><SectionHead title={t.drawer.files}/><div className="dd-files">
          <a className="dw-chip" href={fileUrl(doc.id, 'original')} target="_blank" rel="noreferrer"><FileText size={12}/> PDF</a>
          {doc.signed_path && <a className="dw-chip on" href={fileUrl(doc.id, 'signed')} target="_blank" rel="noreferrer"><CheckCircle2 size={12}/> {t.signedCopy}</a>}
          <a className="dw-chip" href={fileUrl(doc.id, 'docx', true)}><Download size={12}/> {t.word}</a>
          {full?.urls?.signature && <a className="dw-chip" href={full.urls.signature} target="_blank" rel="noreferrer">החתימה</a>}
        </div></div>
        <div className="dd-sec"><SectionHead title="פעולות"/><div className="dd-files">
          {canResend && <Button size="sm" variant="soft-green" icon={<Send size={12}/>} loading={busy === 'docs-send'} onClick={() => setVia(via ? null : 'pick')}>{t.resend}</Button>}
          {via && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            <SignMessageField doc={doc} lead={lead} value={msg} onChange={setMsg} resend={!!doc.sent_at} compact/>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {d.client?.phone && <button type="button" className="dw-chip" onClick={() => act('docs-send', { via: ['whatsapp'], ...signPayload(msg) }, t.sentOk)}><MessageCircle size={12}/> {t.send.wa}</button>}
              {d.client?.email && <button type="button" className="dw-chip" onClick={() => act('docs-send', { via: ['email'], ...signPayload(msg) }, t.sentOk)}><Mail size={12}/> {t.send.email}</button>}
              {st !== 'draft' && <button type="button" className="dw-chip" onClick={() => act('docs-send', { via: [d.client?.phone ? 'whatsapp' : 'email'], renew: true, ...signPayload(msg) }, t.sentOk)}><RefreshCw size={12}/> קישור חדש ושליחה</button>}
            </div>
          </div>}
          {canResend && <Button size="sm" variant="ghost" icon={<Link2 size={12}/>} loading={busy === 'docs-link'} onClick={() => act('docs-link', {}, t.linkReady)}>{t.link}</Button>}
          {st === 'draft' && <Button size="sm" variant="ghost" icon={<PenLine size={12}/>} onClick={() => onEdit(doc)}>עריכה</Button>}
          {['draft', 'sent', 'opened', 'expired', 'failed'].includes(st) && <Button size="sm" variant="danger" icon={<Trash2 size={12}/>} loading={busy === 'docs-cancel'} onClick={() => { if (window.confirm(t.cancelAsk)) act('docs-cancel', {}, t.cancelled) }}>{t.cancel}</Button>}
          <Button size="sm" variant="ghost" icon={<Trash2 size={12}/>} loading={busy === 'docs-delete'} title="מחיקה לצמיתות — גם מסמך חתום" onClick={async () => {
            const ans = window.prompt(`מחיקה לצמיתות של ${doc.number}${st === 'signed' ? ' — מסמך חתום: העותק החתום ותיעוד החתימה יימחקו' : ''}.\nכדי לאשר, הקלידו את מספר המסמך:`)
            if (!ans || ans.trim().toUpperCase() !== String(doc.number).toUpperCase()) return
            setBusy('docs-delete')
            try { const r = await api.post('docs-delete', { id: doc.id }); if (r.error) throw new Error(r.error); push(`המסמך ${doc.number} נמחק לצמיתות`); onChanged(); onClose() } catch (e) { push(e.message) } finally { setBusy('') }
          }}>מחיקה לצמיתות</Button>
        </div>{link && <CopyRow label="קישור" value={link} t={t}/>}</div>
        {signerInfo(doc).total > 1 && <div className="dd-sec"><SectionHead title={<><Users size={14}/> חותמים · {signerProgressText(doc)} {t.signers.progress}</>}/>
          <div className="dd-signers">{signerInfo(doc).list.map((sg, i) => <div key={i} className={`dd-signer${i === signerInfo(doc).index && st !== 'signed' ? ' cur' : ''}${sg.status === 'signed' ? ' ok' : ''}`}>
            <b>{i + 1}. {sg.name}</b><span>{SIGNER_ROLES[sg.role] || SIGNER_ROLES.other}</span>
            <em>{sg.status === 'signed' ? `${t.signers.signed} · ${whenHe(sg.signed_at)}` : i === signerInfo(doc).index && ['sent', 'opened'].includes(st) ? `${t.signers.current} · ${sg.status === 'opened' ? t.signers.opened : t.signers.sent}` : t.signers.waiting}</em>
          </div>)}</div>
        </div>}
        {['sent', 'opened'].includes(st) && <div className="dd-sec"><SectionHead title={<><Bell size={14}/> תזכורות</>} right={<Button size="sm" variant="ghost" loading={busy === 'docs-remind'} onClick={() => act('docs-remind', { now: true }, t.remind.nowOk)}>{t.remind.now}</Button>}/>
          {(d.signing?.reminders || []).length ? d.signing.reminders.slice().reverse().map((r, i) => <div key={i} className="dd-ev"><time>{whenHe(r.at)}</time><span>תזכורת {r.step === 'manual' ? 'ידנית' : r.step} · {(r.via || []).map(v => v === 'whatsapp' ? t.send.wa : t.send.email).join(' + ') || '—'}{r.ok === false ? ' · נכשלה' : ''}</span></div>) : <span style={{ fontSize: 12.5, color: 'var(--au-text3)' }}>{t.remind.none}</span>}
          <label className="dt-tog" style={{ marginTop: 6 }}><input type="checkbox" checked={!!d.signing?.noRemind} onChange={e => act('docs-remind', { off: e.target.checked })}/> {d.signing?.noRemind ? t.remind.offOn : t.remind.off}</label>
        </div>}
        {(d.drive || (full?.drive?.connected)) && <div className="dd-sec"><SectionHead title={<><Cloud size={14}/> {t.drive.title}</>} right={<Button size="sm" variant="ghost" loading={busy === 'docs-drive-sync'} onClick={() => act('docs-drive-sync', {}, null)}>{t.drive.sync}</Button>}/>
          <div className="dd-files">
            {Object.entries(d.drive?.files || {}).map(([k, f]) => <a key={k} className="dw-chip on" href={f.link || '#'} target="_blank" rel="noreferrer" title={f.folder}><Cloud size={12}/> {k === 'signed' ? t.signedCopy : 'PDF'} · {f.name}</a>)}
            {!Object.keys(d.drive?.files || {}).length && <span style={{ fontSize: 12.5, color: 'var(--au-text3)' }}>{d.drive?.status ? t.drive[d.drive.status] || d.drive.status : 'עוד לא נשמר'}</span>}
            {d.drive?.error && <span style={{ fontSize: 12.5, color: 'var(--au-red-text)', width: '100%' }}>{d.drive.error}</span>}
          </div>
        </div>}
        {doc.signature && <div className="dd-sec"><SectionHead title={t.drawer.signature}/><div className="dd-rows">
          <span>שם</span><b>{doc.signature.name}{doc.signature.idNumber ? ` · ת.ז. ${doc.signature.idNumber}` : ''}</b>
          <span>מועד</span><b>{whenHe(doc.signature.at)}</b>
          <span>אימות</span><b>{verifyLabel(doc.signature, true)}</b>
          <span>IP</span><b dir="ltr" style={{ textAlign: 'right' }}>{doc.signature.ip || '—'}</b>
          <span>{t.drawer.hash}</span><b style={{ fontSize: 11, direction: 'ltr', textAlign: 'right' }}>{doc.signed_hash || '—'}</b>
        </div></div>}
        {!!(doc.send_log || []).length && <div className="dd-sec"><SectionHead title={t.drawer.sendLog}/>{doc.send_log.slice().reverse().map((s, i) => <div key={i} className="dd-ev"><time>{whenHe(s.at)}</time><span>{s.via === 'whatsapp' ? t.send.wa : t.send.email} · <span dir="ltr">{s.to}</span>{s.title ? <> · <span style={{ color: 'var(--au-text3)' }}>{s.title}</span></> : null} · {s.ok ? <span className="dw-ok">נשלח</span> : <span style={{ color: 'var(--au-red-text)' }}>{s.error || 'נכשל'}</span>}</span></div>)}</div>}
        <div className="dd-sec"><SectionHead title={t.drawer.events} right={full?.chain ? <Badge color={full.chain.ok ? T.green : T.red}>{full.chain.ok ? t.drawer.chainOk : t.drawer.chainBad}</Badge> : null}/>
          {(full?.events || []).slice().reverse().map((e, i) => <div key={i} className="dd-ev"><time>{whenHe(e.at)}</time><span>{EVENT_HE[e.type] || e.type}{e.meta?.via ? ` · ${e.meta.via === 'whatsapp' ? t.send.wa : e.meta.via === 'email' ? t.send.email : e.meta.via}` : ''}{e.meta?.error ? ` · ${e.meta.error}` : ''}<small>{e.ip ? `${e.ip} · ` : ''}{e.hash?.slice(0, 20)}…</small></span></div>)}
          {full && !full.events?.length && <span style={{ fontSize: 12.5, color: 'var(--au-text3)' }}>{t.drawer.none}</span>}
        </div>
      </div>
    </Drawer>
  )
}

// ── settings ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A scanned / photographed signature → a transparent PNG: the ink keeps its darkness as alpha, the paper goes, cropped, ≤ 600 px. */
async function cleanSignatureImage(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('לא הצלחנו לקרוא את התמונה')); i.src = url })
    const sc = Math.min(1, 1800 / Math.max(img.width, img.height)), W = Math.round(img.width * sc), H = Math.round(img.height * sc)
    const c = document.createElement('canvas'); c.width = W; c.height = H; const k = c.getContext('2d'); k.drawImage(img, 0, 0, W, H)
    const px = k.getImageData(0, 0, W, H), d = px.data, lum = new Float32Array(W * H)
    for (let i = 0; i < W * H; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
    const paper = Array.from(lum).sort((a, b) => a - b)[Math.floor(W * H * 0.6)], lo = paper - 28, inkL = Math.min(90, lo - 40)
    let x0 = W, y0 = H, x1 = 0, y1 = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; let a = lum[i] >= lo ? 0 : Math.min(1, (lo - lum[i]) / (lo - inkL)); if (a < 0.08) a = 0
      d[i * 4] = 0x1A; d[i * 4 + 1] = 0x1F; d[i * 4 + 2] = 0x3A; d[i * 4 + 3] = Math.min(255, Math.round(a * 255 * 1.25))
      if (a > 0.35) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    }
    if (x1 <= x0 || y1 <= y0) throw new Error('לא נמצאה חתימה בתמונה')
    k.putImageData(px, 0, 0)
    const pad = 10; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad)
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, s2 = Math.min(1, 600 / cw)
    const o = document.createElement('canvas'); o.width = Math.round(cw * s2); o.height = Math.round(ch * s2)
    const ok2 = o.getContext('2d'); ok2.imageSmoothingQuality = 'high'; ok2.drawImage(c, x0, y0, cw, ch, 0, 0, o.width, o.height)
    return o.toDataURL('image/png')
  } finally { URL.revokeObjectURL(url) }
}
/** settings → "חתימת המתווך": the broker's own signature, stamped on a document once the client has signed it */
function AgentSignatureField({ agentName }) {
  const [sig, setSig] = useState(undefined)
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const inp = useRef(null)
  useEffect(() => { api.get('docs-agent-signature').then(r => setSig(r.signature || null)).catch(() => setSig(null)) }, [])
  const pick = async file => {
    if (!file) return
    if (!/^image\//.test(file.type)) { setErr('צריך קובץ תמונה (צילום או סריקה של החתימה)'); return }
    setBusy(true); setErr('')
    try { const png = await cleanSignatureImage(file); const r = await api.post('docs-agent-signature', { name: agentName || sig?.name || '', png }); if (r.error) throw new Error(r.error); setSig(r.signature) } catch (e) { setErr(e.message) } finally { setBusy(false); if (inp.current) inp.current.value = '' }
  }
  const remove = async () => { if (!window.confirm('להסיר את חתימת המתווך? מסמכים חדשים ייחתמו בלעדיה.')) return; setBusy(true); try { await api.post('docs-agent-signature', { remove: true }); setSig(null) } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  return (
    <div className="dt-agsig">
      <div className="dt-agsig-img">{sig === undefined ? <span>טוען…</span> : sig ? <img src={sig.png} alt={`חתימת ${sig.name}`}/> : <span>עוד לא הועלתה חתימה</span>}</div>
      <div className="dt-agsig-txt">
        <b>חתימת המתווך{sig?.name ? ` · ${sig.name}` : ''}</b>
        <p>מוטבעת אוטומטית במקום "המתווך" ברגע שהלקוח חותם — בעותק החתום (PDF ו-Word) שנשלח ללקוח ולמשרד, ובאישור החתימה. רק במסמכים שהמתווך שלהם הוא {sig?.name || agentName || 'בעל החתימה'}.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" disabled={busy} onClick={() => inp.current?.click()}>{busy ? 'מעבד…' : sig ? 'החלפת החתימה' : 'העלאת חתימה'}</Button>
          {sig && <Button variant="ghost" disabled={busy} onClick={remove}>הסרה</Button>}
        </div>
        {err && <span style={{ color: 'var(--au-red-text)', fontSize: 12.5 }}>{err}</span>}
        <input ref={inp} type="file" accept="image/*" hidden onChange={e => pick(e.target.files?.[0])}/>
      </div>
    </div>
  )
}
function DocSettings({ t, tab: initTab, settings, wiring, onClose, onSaved }) {
  const s = t.settingsT
  const [tab, setTab] = useState(initTab)
  const [f, setF] = useState(() => ({ vatRate: settings?.vatRate ?? DEFAULT_VAT, expiryDays: settings?.expiryDays ?? 14, agent: { ...(settings?.agent || {}) }, notify: (settings?.notify || []).map(localPhone).join(', '), notifyEmail: settings?.notifyEmail || '', logo: { ...(settings?.logo || { show: true, url: '', size: 'm', align: 'right' }) },
    reminders: { ...DEFAULT_REMINDERS, ...(settings?.reminders || {}), days: (settings?.reminders?.days || DEFAULT_REMINDERS.days).join(', ') }, notifyOn: { ...DEFAULT_NOTIFY_ON, ...(settings?.notifyOn || {}) }, drive: { enabled: settings?.drive?.enabled !== false } }))
  const [clauses, setClauses] = useState(() => (settings?.clauses?.length ? settings.clauses : DEFAULT_CLAUSES).map(c => ({ ...c })))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const save = async () => {
    setBusy(true); setErr('')
    try {
      const body = tab === 'clauses' ? { clauses } : tab === 'reminders' ? { reminders: f.reminders, notifyOn: f.notifyOn } : tab === 'drive' ? { drive: f.drive } : { vatRate: f.vatRate, expiryDays: f.expiryDays, agent: f.agent, notify: f.notify.split(/[,\s]+/).filter(Boolean), notifyEmail: f.notifyEmail, logo: f.logo }
      const r = await api.post('docs-settings', body)
      onSaved(r.settings); onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const reset = async () => { setBusy(true); try { const r = await api.post('docs-clauses', { reset: true }); setClauses(r.settings.clauses); onSaved(r.settings) } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const W = wiring || {}
  return (
    <Modal open onClose={onClose} title={s.title} dir="rtl" width={760} footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', width: '100%' }}><span style={{ color: 'var(--au-red-text)', fontSize: 12.5 }}>{err}</span><div style={{ display: 'flex', gap: 8 }}>{tab === 'clauses' && <Button variant="ghost" onClick={reset} loading={busy}>{s.reset}</Button>}<Button variant="plain" onClick={onClose}>סגירה</Button><Button variant="solid" loading={busy} onClick={save}>{s.save}</Button></div></div>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="dw-chips"><button type="button" className={`dw-chip${tab === 'general' ? ' on' : ''}`} onClick={() => setTab('general')}>כללי</button><button type="button" className={`dw-chip${tab === 'clauses' ? ' on' : ''}`} onClick={() => setTab('clauses')}>{s.clauses}</button><button type="button" className={`dw-chip${tab === 'reminders' ? ' on' : ''}`} onClick={() => setTab('reminders')}><Bell size={12}/> {t.remind.title}</button><button type="button" className={`dw-chip${tab === 'drive' ? ' on' : ''}`} onClick={() => setTab('drive')}><Cloud size={12}/> {t.drive.title}</button></div>
        {tab === 'general' ? <>
          <div className="dt-wire">{[['db', s.db, W.db], ['wa', s.wa, W.whatsapp], ['email', s.email, W.email]].map(([k, l, ok]) => <Badge key={k} color={ok ? T.green : T.red}>{l}: {ok ? s.ok : s.missing}</Badge>)}<Badge color={T.brand}>{s.provider}: {W.providerLabel || 'builtin'}</Badge></div>
          <div className="dw-grid">
            <Field label={s.vat}><input className="dt-input" dir="ltr" inputMode="decimal" value={f.vatRate} aria-label={s.vat} onChange={e => setF(x => ({ ...x, vatRate: e.target.value.replace(/[^\d.]/g, '') }))}/></Field>
            <Field label={s.expiry}><input className="dt-input" dir="ltr" inputMode="numeric" value={f.expiryDays} aria-label={s.expiry} onChange={e => setF(x => ({ ...x, expiryDays: e.target.value.replace(/\D/g, '') }))}/></Field>
          </div>
          <SectionHead title={s.agent}/>
          <div className="dw-grid">
            <Field label={t.fees.agentName}><input className="dt-input" value={f.agent.name || ''} aria-label={t.fees.agentName} onChange={e => setF(x => ({ ...x, agent: { ...x.agent, name: e.target.value } }))}/></Field>
            <Field label={t.fees.license}><input className="dt-input" dir="ltr" value={f.agent.license || ''} aria-label={t.fees.license} onChange={e => setF(x => ({ ...x, agent: { ...x.agent, license: e.target.value } }))}/></Field>
            <Field label={t.fees.agentPhone}><input className="dt-input" dir="ltr" value={f.agent.phone || ''} aria-label={t.fees.agentPhone} onChange={e => setF(x => ({ ...x, agent: { ...x.agent, phone: e.target.value } }))}/></Field>
            <Field label={t.fees.agentEmail}><input className="dt-input" dir="ltr" value={f.agent.email || ''} aria-label={t.fees.agentEmail} onChange={e => setF(x => ({ ...x, agent: { ...x.agent, email: e.target.value } }))}/></Field>
          </div>
          <AgentSignatureField agentName={f.agent.name}/>
          <Field label={s.notify} hint={s.notifyPh}><input className="dt-input" dir="ltr" value={f.notify} onChange={e => setF(x => ({ ...x, notify: e.target.value }))}/></Field>
          <Field label={s.notifyEmail}><input className="dt-input" dir="ltr" value={f.notifyEmail} aria-label={s.notifyEmail} onChange={e => setF(x => ({ ...x, notifyEmail: e.target.value }))}/></Field>
          <LogoFields t={t} logo={f.logo} onChange={l => setF(x => ({ ...x, logo: l }))}/>
        </> : tab === 'reminders' ? <>
          <label className="dt-tog"><input type="checkbox" checked={f.reminders.enabled !== false} onChange={e => setF(x => ({ ...x, reminders: { ...x.reminders, enabled: e.target.checked } }))}/> {t.remind.enabled}</label>
          <div className="dw-grid">
            <Field label={t.remind.days}><input className="dt-input" dir="ltr" value={f.reminders.days} aria-label={t.remind.days} onChange={e => setF(x => ({ ...x, reminders: { ...x.reminders, days: e.target.value.replace(/[^\d,\s]/g, '') } }))}/></Field>
            <Field label={t.remind.hours}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 12.5 }}>{t.remind.from}</span><input className="dt-input" dir="ltr" inputMode="numeric" style={{ width: 70 }} value={f.reminders.from} aria-label={t.remind.from} onChange={e => setF(x => ({ ...x, reminders: { ...x.reminders, from: e.target.value.replace(/\D/g, '') } }))}/><span style={{ fontSize: 12.5 }}>{t.remind.to}</span><input className="dt-input" dir="ltr" inputMode="numeric" style={{ width: 70 }} value={f.reminders.to} aria-label={t.remind.to} onChange={e => setF(x => ({ ...x, reminders: { ...x.reminders, to: e.target.value.replace(/\D/g, '') } }))}/></div></Field>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--au-text3)', lineHeight: 1.6 }}>{t.remind.hint}</p>
          <SectionHead title={t.remind.notifyOn}/>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>{Object.entries(t.remind.on).map(([k, l]) => <label key={k} className="dt-tog"><input type="checkbox" checked={f.notifyOn[k] !== false} onChange={e => setF(x => ({ ...x, notifyOn: { ...x.notifyOn, [k]: e.target.checked } }))}/> {l}</label>)}</div>
        </> : tab === 'drive' ? <DriveSettings t={t} f={f} setF={setF} setErr={setErr}/> : <>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--au-text3)', lineHeight: 1.6 }}>{s.clausesHint}</p>
          <div className="dt-ph">{PLACEHOLDERS.map(p => <code key={p}>{`{${p}}`}</code>)}</div>
          {clauses.map((c, i) => <div key={i} className="dt-clause">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><b style={{ fontSize: 13 }}>{i + 1}.</b><input className="dt-input" style={{ height: 34 }} value={c.title} onChange={e => setClauses(cs => cs.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} aria-label={`כותרת סעיף ${i + 1}`}/><button type="button" className="dt-ib" title="מחיקת הסעיף" aria-label="מחיקת הסעיף" onClick={() => setClauses(cs => cs.filter((_, j) => j !== i))}><Trash2 size={13}/></button></div>
            <textarea className="dt-input" value={c.text} onChange={e => setClauses(cs => cs.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} aria-label={`נוסח סעיף ${i + 1}`}/>
          </div>)}
          <Button variant="ghost" icon={<Plus size={13}/>} onClick={() => setClauses(cs => [...cs, { title: '', text: '' }])}>סעיף</Button>
          <p style={{ fontSize: 12, color: 'var(--au-text3)', margin: 0 }}>{t.legal}</p>
        </>}
      </div>
    </Modal>
  )
}
/** the Google Drive card: connection (OAuth, the calendar's Google client), the switch, the folder tree, the queue's counts */
function DriveSettings({ t, f, setF, setErr }) {
  const [st, setSt] = useState(null)
  const [busy, setBusy] = useState('')
  const load = useCallback(() => api.get('docs-drive-status').then(setSt).catch(e => setErr(e.message)), [setErr])
  useEffect(() => { load() }, [load])
  useEffect(() => { const on = () => { if (document.visibilityState === 'visible') load() }; document.addEventListener('visibilitychange', on); return () => document.removeEventListener('visibilitychange', on) }, [load])
  const run = async (what, body) => { setBusy(what); setErr(''); try { const r = await api.post(what, body || {}); if (r.error) throw new Error(r.error); if (r.url) window.open(r.url, '_blank', 'noopener'); await load(); return r } catch (e) { setErr(e.message) } finally { setBusy('') } }
  const d = t.drive
  return (
    <div className="dt-drive">
      <div className="st">
        <Badge color={st?.connected ? T.green : T.red}>{st?.connected ? `${d.connected}${st.email ? ` · ${st.email}` : ''}` : d.notConnected}</Badge>
        {st?.error && <Badge color={T.red}>{st.error}</Badge>}
        {st && !st.oauthReady && <Badge color={T.amber}>GOOGLE_OAUTH_CLIENT_ID / SECRET חסרים ב-Vercel</Badge>}
        {st?.connected ? <Button size="sm" variant="ghost" loading={busy === 'docs-drive-disconnect'} onClick={() => { if (window.confirm('לנתק את Google Drive? הקבצים שכבר נשמרו נשארים בדרייב.')) run('docs-drive-disconnect') }}>{d.disconnect}</Button>
          : <Button size="sm" variant="brand" icon={<Cloud size={13}/>} loading={busy === 'docs-drive-connect'} disabled={st && !st.oauthReady} onClick={() => run('docs-drive-connect')}>{d.connect}</Button>}
        {st?.connected && <Button size="sm" variant="soft-green" icon={<RefreshCw size={12}/>} loading={busy === 'docs-drive-sync'} onClick={() => run('docs-drive-sync')}>{d.sync}</Button>}
        {st?.root && <a className="dw-chip" href={st.root} target="_blank" rel="noreferrer"><ExternalLink size={12}/> {d.folder}</a>}
      </div>
      <label className="dt-tog"><input type="checkbox" checked={f.drive.enabled !== false} onChange={e => setF(x => ({ ...x, drive: { enabled: e.target.checked } }))}/> {d.enabled}</label>
      {st?.connected && <div className="dt-counts">{Object.entries(d.counts).map(([k, l]) => <div key={k}><b style={{ color: k === 'synced' ? 'var(--au-green-text)' : k === 'pending' ? undefined : st.counts?.[k] ? 'var(--au-red-text)' : undefined }}>{st.counts?.[k] ?? 0}</b><span>{l}</span></div>)}</div>}
      <div className="tree"><div>{d.tree}</div><div>{d.naming}</div><div>{d.queue}</div></div>
      {!st?.connected && <p style={{ margin: 0, fontSize: 12.5, color: 'var(--au-text3)', lineHeight: 1.7 }}>{d.setup}</p>}
    </div>
  )
}
export { fileUrl as docFileUrl, TONE as DOC_TONE }
