// Admin "מסמכים וחתימות" (/admin-panel/documents): the office's brokerage-order documents from a template to a signed PDF.
// A dashboard row (created · waiting · signed · problems), the list (search, status / date filters, sort, a row opens the
// document), "+ יצירת מסמך חדש" = a wizard with the form on one side and the live A4 preview (src/DocPreview.jsx) on the
// other (lead / client → property → terms and fees, clause 6's percent editable → preview → send by WhatsApp / email), the
// document drawer (status, the send log, the audit chain, files: the PDF sent, the signed PDF, Word; resend, a fresh link,
// cancel), and settings (VAT, default agent, office notify numbers / email, logo, the clause editor). API: /api/meta/docs-*.
// Everything here uses the admin tokens (T.* / var(--au-*)) and works in light / dark, RTL and on a phone.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileSignature, Plus, Search, Send, RefreshCw, Download, Link2, XCircle, Settings, Eye, Copy, Check, AlertTriangle, ChevronLeft, ChevronRight, FileText, Trash2, Upload, Clock, CheckCircle2, PenLine, Mail, MessageCircle, FolderKanban, Cloud, Bell, Users, ExternalLink } from 'lucide-react'
import { T, Button, StatTile, FilterChip, Badge, EmptyState, Field, inputStyle, Modal, Drawer, useToasts, SectionHead } from './automationsUI.jsx'
import { autoApi } from './AutomationsApi.jsx'
import DocSheet, { DOC_CSS } from './DocPreview.jsx'
import { onSync } from './lib/syncBus.js'
import { computeFees, renderClauses, cleanDocInput, DEFAULT_CLAUSES, DOC_TYPES, CLIENT_ROLES, DEAL_TYPES, FEE_MODES, STATUS_HE, EVENT_HE, DEFAULT_VAT, docStats, effectiveStatus, fmtMoney, fmtPct, whenHe, todayHe, placeholderValues, PLACEHOLDERS, SIGNER_ROLES, MAX_SIGNERS, signerProgressText, signerInfo, DEFAULT_REMINDERS, DEFAULT_NOTIFY_ON } from '../lib/documents.js'
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
    send: { title: 'שליחה לחתימה', via: 'איך לשלוח', wa: 'וואטסאפ', email: 'אימייל', both: 'גם וגם', to: 'אל', personal: 'משפט אישי (לא חובה)', personalPh: 'כמו שדיברנו, הטופס לדירה בזרובבל…', expiry: 'הקישור בתוקף', days: 'ימים', note: 'הלקוח מקבל קישור אישי, מאמת את עצמו בקוד חד-פעמי, קורא וחותם. אחרי החתימה שניכם מקבלים עותק חתום, והמשרד מקבל הודעה בוואטסאפ ובמייל.', missing: 'ללקוח אין טלפון ואין אימייל — חזרו לשלב הלקוח.' },
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
.dw-form{display:flex;flex-direction:column;min-height:0;border-inline-end:1px solid var(--au-line)}
.dw-steps{display:flex;gap:4px;padding:12px 16px 10px;border-bottom:1px solid var(--au-line);overflow-x:auto}
.dw-step{flex:1;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--au-text3);white-space:nowrap;min-width:0}
.dw-step i{width:20px;height:20px;border-radius:50%;border:1px solid var(--au-line);display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:600;flex-shrink:0}
.dw-step.on{color:var(--au-text);font-weight:600}.dw-step.on i{background:var(--au-brand);border-color:var(--au-brand);color:#fff}
.dw-step.done i{background:rgba(37,211,102,.16);border-color:rgba(37,211,102,.5);color:var(--au-green-text)}
.dw-body{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:14px}
.dw-foot{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--au-line);background:var(--au-card)}
.dw-prev{background:#8E8B84;overflow:auto;padding:20px;display:flex;justify-content:center;align-items:flex-start}
.dw-prev-in{transform-origin:top center}
.dw-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
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
@media (max-width:1020px){.dw{grid-template-columns:1fr}.dw-prev{display:none}.dw.show-prev .dw-form{display:none}.dw.show-prev .dw-prev{display:flex;padding:0;background:#fff}.dw-prev-in{transform:none!important;width:100%}}
@media (max-width:760px){.dt-table{display:none}.dt-cards{display:flex;flex-direction:column;gap:8px}.dt-card{background:var(--au-card);border:1px solid var(--au-line);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;cursor:pointer}.dt-card .r{display:flex;justify-content:space-between;align-items:center;gap:8px}.dw-grid{grid-template-columns:1fr}}
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

export default function DocumentsTab({ lang = 'he', leads = [], properties = [], onOpenLead, initialLeadId = '', initialProject = '', standalone = true }) {
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
  const [wizard, setWizard] = useState(null)       // { doc? (editing a draft), leadId? }
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
      if (filter === 'waiting' && !['sent', 'opened'].includes(st)) return false
      if (filter === 'signed' && st !== 'signed') return false
      if (filter === 'draft' && st !== 'draft') return false
      if (filter === 'problem' && !['expired', 'failed'].includes(st)) return false
      if (filter === 'cancelled' && st !== 'cancelled') return false
      if (days && Date.parse(d.created_at) < now - days * 864e5) return false
      if (s && !(String(d.client_name || '').toLowerCase().includes(s) || String(d.number || '').toLowerCase().includes(s) || String(d.client_email || '').toLowerCase().includes(s) || String(d.project_name || '').toLowerCase().includes(s) || propLine(d.data).toLowerCase().includes(s) || (dg.length >= 3 && String(d.client_phone || '').replace(/\D/g, '').includes(dg)))) return false
      return true
    })
  }, [scoped, filter, range, q])
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
      {area === 'overview' && (
        <div className="dt-break">
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
        {Object.entries(t.filters).map(([k, v]) => <FilterChip key={k} selected={filter === k} onClick={() => setFilter(k)}>{v}</FilterChip>)}
        <select className="dt-input" style={{ width: 'auto', height: 32, fontSize: 12.5 }} value={range} onChange={e => setRange(e.target.value)} aria-label="טווח זמן">{Object.entries(t.range).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="dt-input" style={{ width: 'auto', height: 32, fontSize: 12.5 }} value={project} onChange={e => setProject(e.target.value)} aria-label={t.project}><option value="">{t.projectAll}</option>{projects.filter(p => p.status !== 'archived').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        {breakdown.agent.length > 1 && <select className="dt-input" style={{ width: 'auto', height: 32, fontSize: 12.5 }} value={agentF} onChange={e => setAgentF(e.target.value)} aria-label={t.agent}><option value="">{t.agent}: הכל</option>{breakdown.agent.map(a => <option key={a.name} value={a.name === '—' ? '' : a.name}>{a.name}</option>)}</select>}
        {breakdown.type.length > 1 && <select className="dt-input" style={{ width: 'auto', height: 32, fontSize: 12.5 }} value={typeF} onChange={e => setTypeF(e.target.value)} aria-label={t.cols.type}><option value="">{t.cols.type}: הכל</option>{breakdown.type.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}</select>}
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
      {wizard && <DocWizard t={t} leads={leads} properties={properties} projects={projects} templates={templates} settings={settings} init={wizard} onClose={() => setWizard(null)} onDone={(msg) => { setWizard(null); if (msg) push(msg); load() }} push={push}/>}
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
function DocWizard({ t, leads, properties, projects = [], templates = [], settings, init, onClose, onDone, push }) {
  const [step, setStep] = useState(init.templateId || init.doc ? 1 : 0)
  const [form, setForm] = useState(() => {
    const f = emptyForm(settings)
    if (init.doc) { const d = init.doc.data || {}; return { ...f, ...d, client: { ...f.client, ...d.client, ...splitName(d.client?.name) }, property: { ...f.property, ...d.property, price: d.fees?.price || '' }, fees: { ...f.fees, ...d.fees }, agent: { ...f.agent, ...d.agent }, logo: { ...f.logo, ...d.logo }, leadId: init.doc.lead_id || '', propertyId: init.doc.property_id || '', templateId: init.doc.template_id || 'brokerage', projectId: init.doc.project_id || '', projectName: init.doc.project_name || d.projectName || '', fields: d.fields || {} } }
    return { ...f, templateId: init.templateId || 'brokerage', projectId: init.projectId || '', projectName: init.projectId ? (projects.find(p => p.id === init.projectId)?.name || '') : '' }
  })
  const [docId, setDocId] = useState(init.doc?.id || '')
  const [number, setNumber] = useState(init.doc?.number || '')
  const [leadQ, setLeadQ] = useState('')
  const [leadOpen, setLeadOpen] = useState(false)
  const [propQ, setPropQ] = useState('')
  const [propOpen, setPropOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [errs, setErrs] = useState([])
  const [showPrev, setShowPrev] = useState(false)
  const [send, setSend] = useState({ via: 'both', personal: '' })
  const [result, setResult] = useState(null)
  const prevRef = useRef(null)
  const [scale, setScale] = useState(1)
  const set = (path, v) => setForm(f => { const n = { ...f }; const [a, b] = path.split('.'); if (b) n[a] = { ...n[a], [b]: v }; else n[a] = v; return n })
  useEffect(() => { if (settings && !init.doc) setForm(f => ({ ...f, fees: { ...f.fees, vatRate: settings.vatRate }, agent: f.agent.name ? f.agent : { ...settings.agent }, logo: f.logo.url || !settings.logo ? f.logo : { ...settings.logo }, expiryDays: settings.expiryDays })) }, [settings]) // eslint-disable-line react-hooks/exhaustive-deps
  const pickLead = useCallback(l => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!l) { setForm(f => ({ ...f, leadId: '' })); setLeadQ(''); setLeadOpen(false); return }
    const nm = splitName(l.name)
    const cd = l.crm_data || {}
    const pj = projectOfLead(l, projects)
    setForm(f => ({ ...f, leadId: String(l.id), client: { ...f.client, ...nm, name: l.name || '', phone: l.phone || f.client.phone, email: l.email || f.client.email, role: cd.dealType === 'rent' ? 'renter' : f.client.role }, property: { ...f.property, address: f.property.address || leadProperty(l) || '', dealType: cd.dealType === 'rent' ? 'rent' : f.property.dealType }, ...(pj && !f.projectId ? { projectId: pj.id, projectName: pj.name } : {}) }))
    setLeadQ(l.name || ''); setLeadOpen(false)
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
      const r = await api.post('docs-send', { id: docId || d.id, via, personal: send.personal })
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
          <div style={{ position: 'relative' }}>
            <input className="dt-input" value={leadQ} placeholder={t.leadPh} onChange={e => { setLeadQ(e.target.value); setLeadOpen(true) }} onFocus={() => setLeadOpen(true)} aria-label={t.pickLead} aria-expanded={leadOpen}/>
            {leadOpen && <div className="dw-lead-list" role="listbox">
              <button type="button" onClick={() => pickLead(null)}><XCircle size={14}/>{t.noLead}</button>
              {leads.filter(l => leadMatch(l, leadQ)).slice(0, 40).map(l => <button type="button" key={l.id} onClick={() => pickLead(l)}><span style={{ flex: 1 }}>{l.name || '—'}{leadProperty(l) ? <span style={{ color: 'var(--au-text3)', fontSize: 12 }}> · {leadProperty(l)}</span> : null}</span><small>{localPhone(l.phone)}</small></button>)}
            </div>}
          </div>
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
        {hasWa && <button type="button" className={`dw-chip${send.via === 'whatsapp' ? ' on' : ''}`} onClick={() => setSend(s => ({ ...s, via: 'whatsapp' }))}><MessageCircle size={12}/> {t.send.wa} · {localPhone(form.client.phone)}</button>}
        {hasEmail && <button type="button" className={`dw-chip${send.via === 'email' ? ' on' : ''}`} onClick={() => setSend(s => ({ ...s, via: 'email' }))}><Mail size={12}/> {t.send.email} · {form.client.email}</button>}
        {hasWa && hasEmail && <button type="button" className={`dw-chip${send.via === 'both' ? ' on' : ''}`} onClick={() => setSend(s => ({ ...s, via: 'both' }))}>{t.send.both}</button>}
      </div></Field>
      <Field label={t.send.personal}><textarea className="dt-input" placeholder={t.send.personalPh} value={send.personal} aria-label={t.send.personal} onChange={e => setSend(s => ({ ...s, personal: e.target.value }))}/></Field>
      <div style={{ fontSize: 12.5, color: 'var(--au-text3)' }}>{t.send.expiry}: {form.expiryDays} {t.send.days}</div>
      {result && <div className="dd-sec">
        {result.results.map(r => <div key={r.via} className={r.ok ? 'dw-ok' : 'dw-err'}>{r.ok ? <Check size={13}/> : <AlertTriangle size={13}/>} {r.via === 'whatsapp' ? t.send.wa : t.send.email}: {r.ok ? 'נשלח' : r.error}</div>)}
        {result.link && <CopyRow label="הקישור ללקוח" value={result.link} t={t}/>}
      </div>}
    </>,
  ]
  // the channel follows what the client has: both when both, else the one there is
  useEffect(() => { setSend(s => { const ok = v => (v === 'whatsapp' && hasWa) || (v === 'email' && hasEmail) || (v === 'both' && hasWa && hasEmail); return ok(s.via) ? s : { ...s, via: hasWa && hasEmail ? 'both' : hasWa ? 'whatsapp' : 'email' } }) }, [hasWa, hasEmail])
  return (
    <Modal open onClose={onClose} title={null} full xl dir="rtl" label={t.newDoc} closeOnBackdrop={false}>
      <div className={`dw${showPrev ? ' show-prev' : ''}`} style={{ height: 'calc(100vh - 80px)', maxHeight: 900 }}>
        <div className="dw-form">
          <div className="dw-steps" role="list">{flow.map((id, i) => <div key={id} role="listitem" className={`dw-step${i === step ? ' on' : i < step ? ' done' : ''}`}><i>{i < step ? '✓' : i + 1}</i>{STEP_LABEL[id]}</div>)}</div>
          <div className="dw-body">{cur === 'tpl' ? tplStep : cur === 'fields' ? fieldsStep : stepUi[{ client: 0, property: 1, fees: 2, preview: 3, send: 4 }[cur]]}{!!errs.length && <div className="dw-err" role="alert">{errs.map((e, i) => <div key={i}>{e}</div>)}</div>}</div>
          <div className="dw-foot">
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="plain" onClick={onClose}>✕ סגירה</Button>
              {step > 0 && <Button variant="ghost" icon={<ChevronRight size={14}/>} onClick={() => { setErrs([]); setStep(s => s - 1) }}>{t.back}</Button>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="dw-chip dw-prev-btn" onClick={() => setShowPrev(s => !s)}>{showPrev ? 'הטופס' : t.preview}</button>
              {step >= 1 && cur !== 'send' && cur !== 'preview' && <Button variant="ghost" loading={busy === 'save'} onClick={async () => { const d = await save(); if (d) onDone(`${t.saveDraft} ✓ ${d.number}`) }}>{t.saveDraft}</Button>}
              {cur !== 'send' ? <Button variant="solid" icon={<ChevronLeft size={14}/>} loading={busy === 'save'} onClick={next}>{t.next}</Button>
                : result?.results?.some(r => r.ok) ? <Button variant="solid" onClick={() => onDone('')}>סיום</Button>
                : <Button variant="solid" icon={<Send size={14}/>} loading={busy === 'send'} disabled={!hasWa && !hasEmail} onClick={doSend}>{t.sendNow}</Button>}
            </div>
          </div>
        </div>
        <div className="dw-prev" ref={prevRef}><div className="dw-prev-in" style={{ transform: `scale(${scale})`, width: 794 }}><DocSheet view={view}/></div></div>
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
  useEffect(() => { setFull(null); setLink(''); setVia(null); if (doc?.id) api.get('docs-get', { id: doc.id }).then(setFull).catch(e => push(e.message)) }, [doc?.id]) // eslint-disable-line react-hooks/exhaustive-deps
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
          {via && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
            {d.client?.phone && <button type="button" className="dw-chip" onClick={() => act('docs-send', { via: ['whatsapp'] }, t.sentOk)}><MessageCircle size={12}/> {t.send.wa}</button>}
            {d.client?.email && <button type="button" className="dw-chip" onClick={() => act('docs-send', { via: ['email'] }, t.sentOk)}><Mail size={12}/> {t.send.email}</button>}
            {st !== 'draft' && <button type="button" className="dw-chip" onClick={() => act('docs-send', { via: [d.client?.phone ? 'whatsapp' : 'email'], renew: true }, t.sentOk)}><RefreshCw size={12}/> קישור חדש ושליחה</button>}
          </div>}
          {canResend && <Button size="sm" variant="ghost" icon={<Link2 size={12}/>} loading={busy === 'docs-link'} onClick={() => act('docs-link', {}, t.linkReady)}>{t.link}</Button>}
          {st === 'draft' && <Button size="sm" variant="ghost" icon={<PenLine size={12}/>} onClick={() => onEdit(doc)}>עריכה</Button>}
          {['draft', 'sent', 'opened', 'expired', 'failed'].includes(st) && <Button size="sm" variant="danger" icon={<Trash2 size={12}/>} loading={busy === 'docs-cancel'} onClick={() => { if (window.confirm(t.cancelAsk)) act('docs-cancel', {}, t.cancelled) }}>{t.cancel}</Button>}
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
          <span>אימות</span><b>{doc.signature.via === 'email' ? 'קוד לאימייל' : 'קוד לוואטסאפ'} {doc.signature.to}</b>
          <span>IP</span><b dir="ltr" style={{ textAlign: 'right' }}>{doc.signature.ip || '—'}</b>
          <span>{t.drawer.hash}</span><b style={{ fontSize: 11, direction: 'ltr', textAlign: 'right' }}>{doc.signed_hash || '—'}</b>
        </div></div>}
        {!!(doc.send_log || []).length && <div className="dd-sec"><SectionHead title={t.drawer.sendLog}/>{doc.send_log.slice().reverse().map((s, i) => <div key={i} className="dd-ev"><time>{whenHe(s.at)}</time><span>{s.via === 'whatsapp' ? t.send.wa : t.send.email} · <span dir="ltr">{s.to}</span> · {s.ok ? <span className="dw-ok">נשלח</span> : <span style={{ color: 'var(--au-red-text)' }}>{s.error || 'נכשל'}</span>}</span></div>)}</div>}
        <div className="dd-sec"><SectionHead title={t.drawer.events} right={full?.chain ? <Badge color={full.chain.ok ? T.green : T.red}>{full.chain.ok ? t.drawer.chainOk : t.drawer.chainBad}</Badge> : null}/>
          {(full?.events || []).slice().reverse().map((e, i) => <div key={i} className="dd-ev"><time>{whenHe(e.at)}</time><span>{EVENT_HE[e.type] || e.type}{e.meta?.via ? ` · ${e.meta.via === 'whatsapp' ? t.send.wa : e.meta.via === 'email' ? t.send.email : e.meta.via}` : ''}{e.meta?.error ? ` · ${e.meta.error}` : ''}<small>{e.ip ? `${e.ip} · ` : ''}{e.hash?.slice(0, 20)}…</small></span></div>)}
          {full && !full.events?.length && <span style={{ fontSize: 12.5, color: 'var(--au-text3)' }}>{t.drawer.none}</span>}
        </div>
      </div>
    </Drawer>
  )
}

// ── settings ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
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
