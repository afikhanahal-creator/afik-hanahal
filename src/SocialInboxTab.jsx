// Admin "תיבת הודעות" (/admin-panel/social): every conversation in one list, newest first — the office's WhatsApp line, and
// Messenger + Instagram of every page in the inbox (the leads' pages, Daniel's, Korkos… — switched on in "חשבונות מחוברים").
// "הכל" opens by default. Unread rows are bold with a green count and an accent bar; the conversation draws a "הודעות חדשות"
// line. A WhatsApp chat is the real WhatsApp conversation (LeadConversation: reply, reactions, forward, select, save as a
// template, emoji, templates, files, ticks, live updates). A Messenger / Instagram chat has the same bubbles with a ▾ menu
// (copy, save as a template, forward to any conversation — Instagram also ❤️), emoji, templates, "mark as unread" and a reply
// box (past 24 h the HUMAN_AGENT tag). "הוסף כליד" (name, phone / email, stage, project / property — pick, search or create, a
// note) → the CRM, with what was said as the first note. "חשבונות מחוברים" is the one-stop shop: the pages in the inbox with
// their status, the pages the Meta token reaches but aren't in yet ("+ הוספה לתיבה"), a 3-step guide (with links) for a page
// that isn't listed yet, the WhatsApp line, and the whole history imported in steps. Server: api/meta.js handleSocial;
// rules: lib/social-hook.js; WhatsApp threads: server/social-inbox-migration.sql.
import { WAText } from './waFormat.jsx'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaFacebookMessenger, FaInstagram, FaWhatsapp } from 'react-icons/fa'
import { Search, Send, UserPlus, X, Check, RefreshCw, Link2, Plug, ExternalLink, AlertTriangle, MessageCircle, ZoomIn, ZoomOut, LayoutTemplate, Smile, Forward, MailOpen, MoreVertical, Plus, Minus, Inbox, Trash2, EyeOff, Eye, Clock, ChevronRight } from 'lucide-react'
import { onSync, debounce } from './lib/syncBus.js'
import { useProjects } from './lib/projectsStore.js'
import { ProjectSelect, ProjectChip, LP_CSS } from './LeadProjects.jsx'
import { ChatNameEdit, StageMenu, AiNoteButton } from './ChatLeadTools.jsx'
import { NotesButton, FollowUpButton } from './FollowUpTask.jsx'
import { leadProject } from './lib/leadFields.js'
import WaFace from './WaFace.jsx'
import Splitter, { SPLITTER_CSS } from './Splitter.jsx'
import ChatTemplatePicker, { ChatQuickChips, ChatTemplateMenu } from './ChatTemplatePicker.jsx'
import ChatMsgMenu from './ChatMsgMenu.jsx'
import TemplateQuickEdit from './TemplateQuickEdit.jsx'
import LeadConversation from './LeadConversation.jsx'
import { EMOJI } from './ChatComposer.jsx'
import { DARK, LIGHT } from './waShared.jsx'
import { useAdminTheme } from './adminTheme.js'
import { useSharedAutoConfig, setSharedAutoConfig } from './lib/autoConfigStore.js'
import { useSharedLeads } from './lib/leadsStore.js'
import { messageToTemplate } from '../lib/template-edit.js'
import { leadProperty } from '../lib/automations-shared.js'

const AUTH = { 'Content-Type': 'application/json', Authorization: 'Bearer AFIKhanahal2026' }
const api = (path, opts = {}) => fetch(`/api/meta/${path}`, { headers: AUTH, signal: AbortSignal.timeout(opts.timeout || 30000), ...opts })
  .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); return d })

const TXT = {
  he: {
    title: 'תיבת הודעות', sub: 'וואטסאפ, מסנג׳ר ואינסטגרם של כל העמודים, לפי הסדר. כל שיחה אפשר להפוך לליד ולשייך לפרויקט.',
    search: 'חיפוש שם, @, טלפון…', f: { all: 'הכל', unread: 'לא נקראו', noreply: 'לא ענו לנו', nolead: 'עוד לא ליד', whatsapp: 'וואטסאפ', messenger: 'מסנג׳ר', instagram: 'אינסטגרם', hidden: 'מוסתרות' },
    windowClosed: 'חלון המענה של Meta נסגר (עברו 24 שעות מההודעה האחרונה שלהם)', windowHow: 'עונים מ-Meta Business Suite, או מאשרים "Human Agent" ב-App Review ואז המערכת שולחת גם אחרי 24 שעות.', openInMeta: 'מענה ב-Meta Business Suite', sendFailed: 'ההודעה לא נשלחה',
    noReply: ago => `לא ענו · ${ago}`, noReplyTip: 'ההודעה האחרונה שלנו, ועוד לא ענו עליה', deleteChat: 'מחיקת השיחה', hideChat: 'הסתרת השיחה מהתיבה', unhideChat: 'החזרה לתיבה', deleteAsk: n => `למחוק את השיחה עם ${n}? ההודעות יימחקו מהתיבה (הליד, אם יש, נשאר).`, hideAsk: n => `להסתיר את השיחה עם ${n}? ההיסטוריה בוואטסאפ נשארת, והיא תופיע תחת "מוסתרות".`, deleted: 'השיחה נמחקה', hiddenDone: 'השיחה הוסתרה', restored: 'השיחה חזרה לתיבה', isHidden: 'מוסתרת', leadCardBtn: 'כרטיס הליד', rename: 'לחיצה על השם לעריכה',
    allPages: 'כל העמודים', waLine: 'קו המשרד', newN: n => (n === 1 ? 'חדשה' : `${n} חדשות`),
    empty: 'אין שיחות כאן', emptySub: 'הודעות חדשות יגיעו לכאן מעצמן. אפשר גם לייבא את כל ההיסטוריה מ"חשבונות מחוברים".',
    pick: 'בחרו שיחה מהרשימה', pickSub: 'כל ההודעות מכל הערוצים, במקום אחד', isLead: 'ליד', addLead: 'הוסף כליד', openLead: 'כרטיס הליד', reply: 'כתבו תשובה…', send: 'שליחה',
    sending: 'שולח…', foundPhone: 'כתבו טלפון', openMeta: 'פתיחה ב-Meta', openChats: 'פתיחה במסך הצ׳אטים', accounts: 'חשבונות מחוברים',
    leadTitle: 'הוספה כליד', name: 'שם', phone: 'טלפון', email: 'אימייל', project: 'פרויקט / נכס', none: 'בלי פרויקט', stage: 'שלב', note: 'הערה',
    notePh: 'מה מחפשים, מה סוכם… (מה שנכתב בשיחה נשמר לבד)', save: 'הוספה ללידים', cancel: 'ביטול', added: 'נוסף ללידים', existing: 'המספר הזה כבר ליד — פתחנו אותו',
    stages: { new: 'ליד חדש', contacted: 'נוצר קשר', discovery: 'מתעניין', meeting: 'נקבעה פגישה' },
    tablesMissing: 'צריך להפעיל פעם אחת את טבלאות הסושיאל במסד הנתונים (server/social-migration.sql).',
    media: { imageMessage: '📷 תמונה', videoMessage: '🎥 סרטון', audioMessage: '🎤 הקלטה', documentMessage: '📎 קובץ', locationMessage: '📍 מיקום', contactMessage: '👤 איש קשר', stickerMessage: 'מדבקה' },
    profile: 'פרופיל', profileOf: { whatsapp: 'פתיחה בוואטסאפ', messenger: 'השיחה ב-Meta Business Suite', instagram: 'הפרופיל באינסטגרם' },
    zoomIn: 'הגדלה', zoomOut: 'הקטנה', zoomReset: 'גודל רגיל', resize: 'גרירה לשינוי רוחב הרשימה', templates: 'תבניות', emoji: 'אימוג׳י',
    socialTpl: 'במסנג׳ר ובאינסטגרם נשלח הטקסט בלבד', more: 'עוד', markUnread: 'סימון כלא נקרא', newMsgs: n => (n === 1 ? 'הודעה חדשה' : `${n} הודעות חדשות`),
    igOnlyLove: 'באינסטגרם Meta מאפשרת רק ❤️ — נשלח ❤️', noReactFb: 'במסנג׳ר Meta לא מאפשרת תגובת אימוג׳י דרך המערכת',
    fwdTitle: n => (n === 1 ? 'העברת הודעה' : `העברת ${n} הודעות`), fwdSearch: 'חיפוש שיחה או מספר…', fwdSend: n => (n ? `שליחה ל-${n}` : 'שליחה'), fwdSending: 'שולח…', fwdDone: (ok, all) => (ok === all ? `הועבר ל-${ok}` : `הועבר ל-${ok} מתוך ${all}`),
    tplSaved: 'התבנית נשמרה',
    accTitle: 'חשבונות מחוברים', accSub: 'כל העמודים והמספרים שמזינים את התיבה. מוסיפים עמוד בלחיצה, והודעות שלו נכנסות לכאן.',
    sumPages: n => `${n} עמודים בתיבה`, sumIg: n => `${n} אינסטגרם`, sumWa: 'וואטסאפ מחובר', sumWaOff: 'וואטסאפ לא מחובר',
    leadsPage: 'עמוד הלידים', receiving: 'מקבל הודעות', notReceiving: 'לא מחובר להודעות', connect: 'חיבור להודעות', connecting: 'מחבר…',
    secIn: 'בתיבה', secAvail: 'עמודים שאפשר להוסיף', addToInbox: 'הוספה לתיבה', adding: 'מוסיף…', remove: 'הסרה מהתיבה', convs: n => (n === 1 ? 'שיחה אחת' : `${n} שיחות`), noConvs: 'עדיין אין שיחות — ייבאו את ההיסטוריה למטה',
    igLinked: u => `אינסטגרם @${u}`, igNone: 'בלי אינסטגרם מקושר', igHow: 'מקשרים בהגדרות העמוד ← חשבונות מקושרים ← Instagram, ובאפליקציית אינסטגרם: הגדרות ← הודעות ← כלים מחוברים ← לאפשר גישה.',
    noAvail: 'כל העמודים שהמפתח של Meta מגיע אליהם כבר בתיבה.',
    addTitle: 'עמוד או חשבון שלא ברשימה (של דניאל, קורקוס…)', addSteps: [
      { t: 'מוסיפים את העמוד לעסק "אפיק הנחל"', d: 'Business settings ← Accounts ← Pages ← Add. עמוד שאתם מנהלים: "Add a Page". עמוד של עסק אחר: "Request access", ומאשרים מהעסק השני.', href: 'https://business.facebook.com/settings/pages', btn: 'פתיחת Pages' },
      { t: 'נותנים למשתמש המערכת afik-api גישה מלאה', d: 'Users ← System users ← afik-api ← Assign assets ← Pages ← העמוד ← Full control. אם לעמוד יש אינסטגרם, גם ב-Instagram accounts.', href: 'https://business.facebook.com/settings/system-users', btn: 'פתיחת System users' },
      { t: 'חוזרים לכאן ולוחצים "רענון"', d: 'העמוד יופיע ב"עמודים שאפשר להוסיף" ← "הוספה לתיבה" ← ייבוא ההיסטוריה.', btn: 'רענון' },
      { t: 'פעם אחת: אישור "Human Agent" ב-App Review', d: 'בלעדיו המערכת יכולה לענות רק בתוך 24 שעות מההודעה האחרונה של הלקוח (אחר כך עונים מ-Meta Business Suite). באפליקציה של Meta ← App Review ← Permissions and Features ← Human Agent ← Request.', href: 'https://developers.facebook.com/apps/', btn: 'פתיחת האפליקציה' },
    ],
    missingScopes: 'להרשאות של המפתח של Meta חסר:', scopesHow: 'ב-business.facebook.com ← משתמשי מערכת ← יצירת מפתח חדש עם ההרשאות האלה, ואז להחליף את META_SYSTEM_USER_TOKEN ב-Vercel.',
    igHook: 'אינסטגרם: באפליקציה של Meta ← Webhooks ← Instagram ← להירשם לשדה messages עם אותה כתובת של הלידים.',
    waLines: 'וואטסאפ', waMain: 'קו המשרד (אפיק הנחל)', waState: { authorized: 'מחובר', notAuthorized: 'לא מחובר', error: 'לא ידוע' },
    waAdd: 'מספר וואטסאפ נוסף', waAddHow: 'פותחים מופע חדש ב-console.green-api.com, סורקים את ה-QR מהטלפון של המספר, ושומרים את המזהה והמפתח ב-Vercel. מספר שני באותה תיבה הוא שלב הבא.',
    importTitle: 'ייבוא היסטוריה', importMeta: 'ייבוא כל השיחות ממסנג׳ר ואינסטגרם', importWa: 'ייבוא כל ההיסטוריה מוואטסאפ', stop: 'עצירה',
    metaProg: (p) => `${p.job ? `${p.job.pageName} · ${p.job.platform === 'instagram' ? 'אינסטגרם' : 'מסנג׳ר'} · ` : ''}${p.threads} שיחות · ${p.messages} הודעות חדשות`,
    waProg: (p) => `${p.chats} מתוך ${p.total} צ׳אטים · ${p.messages} הודעות חדשות`,
    doneTxt: 'הסתיים ✓', close: 'סגירה', refresh: 'רענון',
  },
  en: {
    title: 'Inbox', sub: 'WhatsApp, Messenger and Instagram of every page, in order. Any conversation becomes a lead, linked to a project.',
    search: 'Search name, @, phone…', f: { all: 'All', unread: 'Unread', noreply: 'No reply to us', nolead: 'Not a lead yet', whatsapp: 'WhatsApp', messenger: 'Messenger', instagram: 'Instagram', hidden: 'Hidden' },
    windowClosed: 'Meta’s reply window is closed (24 h since their last message)', windowHow: 'Answer from Meta Business Suite, or get "Human Agent" approved in App Review and the system sends after 24 h too.', openInMeta: 'Reply in Meta Business Suite', sendFailed: 'The message was not sent',
    noReply: ago => `No reply · ${ago}`, noReplyTip: 'Our last message, not answered yet', deleteChat: 'Delete conversation', hideChat: 'Hide from the inbox', unhideChat: 'Back to the inbox', deleteAsk: n => `Delete the conversation with ${n}? Its messages leave the inbox (the lead, if any, stays).`, hideAsk: n => `Hide the conversation with ${n}? The WhatsApp history stays, and it shows under "Hidden".`, deleted: 'Conversation deleted', hiddenDone: 'Conversation hidden', restored: 'Back in the inbox', isHidden: 'Hidden', leadCardBtn: 'Lead card', rename: 'Click the name to edit it',
    allPages: 'All pages', waLine: 'Office line', newN: n => (n === 1 ? 'new' : `${n} new`),
    empty: 'No conversations here', emptySub: 'New messages arrive here by themselves. You can also import the whole history from "Connected accounts".',
    pick: 'Pick a conversation', pickSub: 'Every message from every channel, in one place', isLead: 'Lead', addLead: 'Add as a lead', openLead: 'Lead card', reply: 'Write a reply…', send: 'Send',
    sending: 'Sending…', foundPhone: 'Wrote a phone', openMeta: 'Open in Meta', openChats: 'Open in the chats screen', accounts: 'Connected accounts',
    leadTitle: 'Add as a lead', name: 'Name', phone: 'Phone', email: 'Email', project: 'Project / property', none: 'No project', stage: 'Stage', note: 'Note',
    notePh: 'What they look for, what was agreed… (the conversation is saved by itself)', save: 'Add to leads', cancel: 'Cancel', added: 'Added to the leads', existing: 'This number is already a lead — opened it',
    stages: { new: 'New lead', contacted: 'Contacted', discovery: 'Interested', meeting: 'Meeting set' },
    tablesMissing: 'The social tables need to be created once in the database (server/social-migration.sql).',
    media: { imageMessage: '📷 Photo', videoMessage: '🎥 Video', audioMessage: '🎤 Voice note', documentMessage: '📎 File', locationMessage: '📍 Location', contactMessage: '👤 Contact', stickerMessage: 'Sticker' },
    profile: 'Profile', profileOf: { whatsapp: 'Open in WhatsApp', messenger: 'The chat in Meta Business Suite', instagram: 'Instagram profile' },
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Normal size', resize: 'Drag to resize the list', templates: 'Templates', emoji: 'Emoji',
    socialTpl: 'Messenger and Instagram get the text only', more: 'More', markUnread: 'Mark as unread', newMsgs: n => (n === 1 ? '1 new message' : `${n} new messages`),
    igOnlyLove: 'Instagram allows only ❤️ — sent ❤️', noReactFb: 'Meta does not allow emoji reactions on Messenger through the API',
    fwdTitle: n => (n === 1 ? 'Forward message' : `Forward ${n} messages`), fwdSearch: 'Search a conversation or number…', fwdSend: n => (n ? `Send to ${n}` : 'Send'), fwdSending: 'Sending…', fwdDone: (ok, all) => (ok === all ? `Forwarded to ${ok}` : `Forwarded to ${ok} of ${all}`),
    tplSaved: 'Template saved',
    accTitle: 'Connected accounts', accSub: 'Every page and number that feeds the inbox. Add a page with one click and its messages come here.',
    sumPages: n => `${n} pages in the inbox`, sumIg: n => `${n} Instagram`, sumWa: 'WhatsApp connected', sumWaOff: 'WhatsApp not connected',
    leadsPage: 'Leads page', receiving: 'Receiving messages', notReceiving: 'Not connected to messages', connect: 'Connect messages', connecting: 'Connecting…',
    secIn: 'In the inbox', secAvail: 'Pages you can add', addToInbox: 'Add to the inbox', adding: 'Adding…', remove: 'Remove from the inbox', convs: n => (n === 1 ? '1 conversation' : `${n} conversations`), noConvs: 'No conversations yet — import the history below',
    igLinked: u => `Instagram @${u}`, igNone: 'No Instagram linked', igHow: 'Link it in the page settings → Linked accounts → Instagram, and in the Instagram app: Settings → Messages → Connected tools → allow access.',
    noAvail: 'Every page the Meta token reaches is already in the inbox.',
    addTitle: 'A page or account not listed (Daniel’s, Korkos…)', addSteps: [
      { t: 'Add the page to the "Afik Hanahal" business', d: 'Business settings → Accounts → Pages → Add. A page you manage: "Add a Page". Another business’s page: "Request access", approved there.', href: 'https://business.facebook.com/settings/pages', btn: 'Open Pages' },
      { t: 'Give the system user afik-api full control', d: 'Users → System users → afik-api → Assign assets → Pages → the page → Full control. If it has Instagram, also under Instagram accounts.', href: 'https://business.facebook.com/settings/system-users', btn: 'Open System users' },
      { t: 'Come back and press "Refresh"', d: 'The page shows under "Pages you can add" → "Add to the inbox" → import the history.', btn: 'Refresh' },
      { t: 'Once: get "Human Agent" approved in App Review', d: 'Without it the system can reply only within 24 h of the person’s last message (after that, from Meta Business Suite). Meta app → App Review → Permissions and Features → Human Agent → Request.', href: 'https://developers.facebook.com/apps/', btn: 'Open the app' },
    ],
    missingScopes: 'The Meta token is missing:', scopesHow: 'business.facebook.com → System users → generate a new token with these permissions, then replace META_SYSTEM_USER_TOKEN in Vercel.',
    igHook: 'Instagram: Meta app → Webhooks → Instagram → subscribe to the messages field with the same URL as the leads.',
    waLines: 'WhatsApp', waMain: 'Office line (Afik Hanahal)', waState: { authorized: 'Connected', notAuthorized: 'Not connected', error: 'Unknown' },
    waAdd: 'Another WhatsApp number', waAddHow: 'Open a new instance at console.green-api.com, scan the QR from that number’s phone, and save its id and token in Vercel. A second number in the same inbox is the next step.',
    importTitle: 'Import history', importMeta: 'Import every Messenger and Instagram conversation', importWa: 'Import the whole WhatsApp history', stop: 'Stop',
    metaProg: (p) => `${p.job ? `${p.job.pageName} · ${p.job.platform === 'instagram' ? 'Instagram' : 'Messenger'} · ` : ''}${p.threads} conversations · ${p.messages} new messages`,
    waProg: (p) => `${p.chats} of ${p.total} chats · ${p.messages} new messages`,
    doneTxt: 'Done ✓', close: 'Close', refresh: 'Refresh',
  },
}
const fmtTime = (ts, lang) => {
  const d = new Date(ts); if (!Number.isFinite(d.getTime())) return ''
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'he-IL', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'numeric' })
}
const agoText = (ts, lang) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(ts)) / 60000))
  if (lang === 'en') return m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`
  return m < 60 ? `${m} דק׳` : m < 1440 ? `${Math.round(m / 60)} שע׳` : `${Math.round(m / 1440)} ימים`
}
const fmtDay = (ts, lang) => { const d = new Date(ts); return Number.isFinite(d.getTime()) ? d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { weekday: 'short', day: 'numeric', month: 'short' }) : '' }
const PlatIcon = ({ p, size = 14 }) => (p === 'instagram' ? <FaInstagram size={size} color="#E1306C"/> : p === 'whatsapp' ? <FaWhatsapp size={size} color="#25D366"/> : <FaFacebookMessenger size={size} color="#0084FF"/>)
const localPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('972') ? `0${d.slice(3)}` : d }
const nameOf = th => th?.name_he || th?.name || (th?.username ? `@${th.username}` : th?.platform === 'whatsapp' ? localPhone(th.phone) : '—')
const initial = th => nameOf(th).replace(/^[@0]+/, '').charAt(0) || '?'
// where the person's own profile is: WhatsApp → wa.me, Instagram → the @handle, Messenger → the chat in Meta Business Suite
// (Meta gives a page-scoped id, never the person's profile address)
const profileLink = (th, accounts) => th.platform === 'whatsapp' ? `https://wa.me/${th.phone}`
  : th.platform === 'instagram' ? (th.username ? `https://www.instagram.com/${th.username}/` : 'https://business.facebook.com/latest/inbox/instagram_direct')
  : `https://business.facebook.com/latest/inbox/messenger?asset_id=${accounts?.[th.account_id]?.pageId || th.account_id}&selected_item_id=${th.user_id}`

// one shape for the list: a WhatsApp chat or a Messenger / Instagram thread
const fromWa = (c, t) => ({ key: `wa:${c.phone}`, kind: 'wa', platform: 'whatsapp', phone: c.phone, name: c.name, waName: c.waName, lead_id: c.lead_id, last_text: (c.last_text || '').trim() ? (t.media[c.last_text] || c.last_text) : (t.media[c.last_type] || ''), last_dir: c.last_dir, last_at: c.last_at, unread: c.last_dir === 'in' ? c.waiting : 0, account_id: 'wa', hidden: !!c.hidden })
const fromSocial = th => ({ ...th, key: th.id, kind: 'social' })

// the person's picture with the channel's icon on its corner; a click on a picture opens it big (with "the profile")
function Face({ th, size = 40, zoom = false, t, link, lang }) {
  const ic = <i><PlatIcon p={th?.platform} size={size > 36 ? 13 : 11}/></i>
  if (th?.platform === 'whatsapp') {
    return <span className="si-face" style={{ width: size, height: size }}><WaFace phone={th.phone} name={nameOf(th)} size={size} zoom={zoom} lang={lang}><b className="si-ini">{initial(th)}</b></WaFace>{ic}</span>
  }
  return (
    <span className="si-face" style={{ width: size, height: size }}>
      <WaFace social={th?.id} seed={th?.avatar || ''} seedSrc={th?.platform} name={nameOf(th)} size={size} zoom={zoom} lang={lang}
        viewerSub={th?.username ? `@${th.username}` : (th?.platform === 'instagram' ? 'Instagram' : 'Messenger')}
        viewerLink={link ? { href: link, label: t?.profileOf?.[th?.platform] } : null}>
        <b className="si-ini">{initial(th)}</b>
      </WaFace>
      {ic}
    </span>
  )
}

function LeadForm({ th, t, lang, onDone, onCancel }) {
  const projects = useProjects()
  const active = projects.filter(p => p.status !== 'archived')
  const isWa = th.kind === 'wa'
  const [f, setF] = useState({ name: th.name || th.waName || th.username || '', phone: isWa ? localPhone(th.phone) : th.phone || '', email: th.email || '', projectId: '', leadStatus: 'contacted', note: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [picked, setPicked] = useState(null)
  const save = async () => {
    setBusy(true); setErr('')
    try {
      const p = active.find(x => x.id === f.projectId) || (picked?.id === f.projectId ? picked : null)
      const d = isWa
        ? await api('social-wa-lead', { method: 'POST', body: JSON.stringify({ ...f, phone: th.phone, projectName: p?.name || '' }) })
        : await api('social-to-lead', { method: 'POST', body: JSON.stringify({ id: th.id, ...f, projectName: p?.name || '' }) })
      onDone(d.lead, d.existing)
    } catch (e) { setErr(e.message); setBusy(false) }
  }
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }))
  return (
    <div className="si-leadform" role="form" aria-label={t.leadTitle}>
      <div className="si-lf-head"><b><UserPlus size={15}/>{t.leadTitle}</b><button type="button" className="si-x" onClick={onCancel} aria-label={t.cancel}><X size={15}/></button></div>
      <div className="si-lf-grid">
        <label>{t.name}<input value={f.name} onChange={set('name')} autoFocus/></label>
        <label>{t.phone}<input value={f.phone} onChange={set('phone')} dir="ltr" inputMode="tel" placeholder="05X-XXX-XXXX" readOnly={isWa}/></label>
        <label>{t.email}<input value={f.email} onChange={set('email')} dir="ltr"/></label>
        <label>{t.stage}<select value={f.leadStatus} onChange={set('leadStatus')}>{Object.entries(t.stages).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <div className="si-lf-wide"><span>{t.project}</span>
          <ProjectSelect projects={projects} value={f.projectId} lang={lang} onChange={(id, x) => { setF(v => ({ ...v, projectId: id })); setPicked(x) }}/>
        </div>
        <label className="si-lf-wide">{t.note}<textarea rows={2} value={f.note} onChange={set('note')} placeholder={t.notePh}/></label>
      </div>
      {err && <div className="si-err">{err}</div>}
      <div className="si-lf-foot"><button type="button" className="si-primary" disabled={busy} onClick={save}>{busy ? '…' : t.save}</button><button type="button" className="si-secondary" onClick={onCancel}>{t.cancel}</button></div>
    </div>
  )
}

// an import that runs in steps (each call ~40 s, the next one carries the cursor) until done or stopped
function useStepImport(action) {
  const [st, setSt] = useState(null)
  const stop = useRef(false)
  const run = async onStep => {
    stop.current = false
    let cursor = {}, tot = { threads: 0, messages: 0, chats: 0, total: 0, errors: [] }
    setSt({ running: true, ...tot })
    for (let k = 0; k < 200 && !stop.current; k++) {
      let d
      try { d = await api(action, { method: 'POST', body: JSON.stringify({ cursor }), timeout: 70000 }) }
      catch (e) { setSt(s => ({ ...s, running: false, error: e.message })); return }
      tot = { threads: tot.threads + (d.threads || 0), messages: tot.messages + (d.messages || 0), chats: tot.chats + (d.chats || 0), total: d.total ?? tot.total, job: d.job, errors: [...tot.errors, ...(Array.isArray(d.errors) ? d.errors : [])].slice(-5) }
      setSt({ running: !d.done, done: !!d.done, ...tot })
      onStep?.()
      if (d.done) return
      cursor = d.cursor
    }
    setSt(s => ({ ...s, running: false }))
  }
  return { st, run, stop: () => { stop.current = true } }
}

/** The one-stop shop: pages in the inbox (status, Instagram, conversations, remove), pages the token reaches ("+ add"),
 *  a 3-step guide for a page that isn't listed, the WhatsApp line, the history import */
function Accounts({ t, lang, counts, onClose, onImported }) {
  const [st, setSt] = useState(null)
  const [wa, setWa] = useState(null)
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const metaImp = useStepImport('social-sync')
  const waImp = useStepImport('social-wa-import')
  const load = useCallback(fix => api(`social-status${fix ? '?fix=1' : ''}`, { timeout: 55000 }).then(d => { setSt(d); setErr('') }).catch(e => setSt({ error: e.message })), [])
  useEffect(() => { load(); api('chat-status', { timeout: 15000 }).then(setWa).catch(() => setWa({ state: 'error' })) }, [load])
  const toggle = async (p, on) => {
    setBusy(p.id); setErr('')
    try { await api('social-page', { method: 'POST', body: JSON.stringify({ id: p.id, name: p.name, on }) }); await load(); onImported?.() } catch (e) { setErr(e.message) }
    setBusy('')
  }
  const pageOf = id => (st?.pages || []).find(p => p.id === id)
  const avail = st?.available?.length ? st.available : (st?.pages || []).map(p => ({ id: p.id, name: p.name, inbox: true, leads: p.leads }))
  const inbox = avail.filter(a => a.inbox), out = avail.filter(a => !a.inbox)
  const igOf = a => a.ig || (st?.instagram || []).find(x => x.pageId === a.id)
  const convCount = a => (counts[a.id] || 0) + (igOf(a) ? counts[igOf(a).id] || 0 : 0)
  const prog = (imp, fmt, label, onClick) => (
    <div className="si-imp">
      <div className="si-imp-row">
        <button type="button" className="si-primary" disabled={imp.st?.running} onClick={onClick}><RefreshCw size={14} className={imp.st?.running ? 'si-spin' : ''}/>{label}</button>
        {imp.st?.running && <button type="button" className="si-secondary" onClick={imp.stop}>{t.stop}</button>}
      </div>
      {imp.st && <div className="si-muted">{fmt(imp.st)}{imp.st.done ? ` · ${t.doneTxt}` : ''}</div>}
      {imp.st?.error && <div className="si-err">{imp.st.error}</div>}
      {imp.st?.errors?.length > 0 && <div className="si-err si-small">{imp.st.errors.join(' · ')}</div>}
    </div>
  )
  const waOk = wa?.state === 'authorized'
  return (
    <div className="si-acc-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="si-acc" role="dialog" aria-modal="true" aria-label={t.accTitle} dir={lang === 'en' ? 'ltr' : 'rtl'}>
        <div className="si-lf-head"><b><Plug size={16}/>{t.accTitle}</b><button type="button" className="si-secondary si-sm" onClick={() => load()}><RefreshCw size={13}/>{t.refresh}</button><button type="button" className="si-x" onClick={onClose} aria-label={t.close}><X size={16}/></button></div>
        <p className="si-muted">{t.accSub}</p>
        {st && !st.error && (
          <div className="si-sum">
            <span className="si-sum-pill"><FaFacebookMessenger color="#0084FF" size={12}/>{t.sumPages(inbox.length)}</span>
            <span className="si-sum-pill"><FaInstagram color="#E1306C" size={12}/>{t.sumIg(inbox.filter(a => igOf(a)).length)}</span>
            <span className={`si-sum-pill${waOk ? ' is-ok' : ' is-warn'}`}><FaWhatsapp color="#25D366" size={12}/>{waOk ? t.sumWa : t.sumWaOff}</span>
          </div>
        )}
        {!st ? <div className="si-muted">…</div> : st.error ? <div className="si-err">{st.error}</div> : <>
          {st.tablesMissing && <div className="si-warn">{t.tablesMissing}</div>}
          {st.missing?.length > 0 && <div className="si-warn"><b>{t.missingScopes}</b> <code>{st.missing.join(', ')}</code><div>{t.scopesHow}</div></div>}
          {err && <div className="si-err">{err}</div>}

          <h4><Inbox size={14}/>{t.secIn}</h4>
          {inbox.map(a => {
            const pc = pageOf(a.id), ig = igOf(a), n = convCount(a)
            return (
              <div key={a.id} className="si-pg">
                {a.picture ? <img className="si-pg-pic" src={a.picture} alt="" referrerPolicy="no-referrer"/> : <span className="si-pg-pic"><FaFacebookMessenger color="#0084FF" size={16}/></span>}
                <div className="si-pg-main">
                  <b>{a.name || a.id}{a.leads ? <em className="si-tag">{t.leadsPage}</em> : null}</b>
                  <div className="si-pg-rows">
                    <span className="si-pg-row"><FaFacebookMessenger color="#0084FF" size={12}/>Messenger
                      {pc ? <span className={`si-pill${pc.messages ? ' is-ok' : ''}`}>{pc.messages ? <Check size={11}/> : <AlertTriangle size={11}/>}{pc.messages ? t.receiving : t.notReceiving}</span> : null}
                      {pc && !pc.messages && <button type="button" className="si-link" disabled={!!busy} onClick={async () => { setBusy('fix'); await load(true); setBusy('') }}>{busy === 'fix' ? t.connecting : t.connect}</button>}
                    </span>
                    <span className="si-pg-row"><FaInstagram color="#E1306C" size={12}/>{ig ? t.igLinked(ig.username || ig.name || ig.id) : <span className="si-muted" title={t.igHow}>{t.igNone}</span>}</span>
                    <span className="si-pg-row si-muted">{n ? t.convs(n) : t.noConvs}</span>
                  </div>
                  {pc?.fix && pc.fix !== 'subscribed' && <div className="si-err si-small">{pc.fix}</div>}
                  {pc?.error && <div className="si-err si-small">{pc.error}</div>}
                </div>
                {!a.leads && <button type="button" className="si-secondary si-sm" disabled={busy === a.id} onClick={() => toggle(a, false)}><Minus size={13}/>{t.remove}</button>}
              </div>
            )
          })}

          <h4><Plus size={14}/>{t.secAvail}</h4>
          {out.length ? out.map(a => (
            <div key={a.id} className="si-pg is-off">
              {a.picture ? <img className="si-pg-pic" src={a.picture} alt="" referrerPolicy="no-referrer"/> : <span className="si-pg-pic"><FaFacebookMessenger color="#0084FF" size={16}/></span>}
              <div className="si-pg-main"><b>{a.name || a.id}</b><div className="si-pg-rows"><span className="si-pg-row"><FaInstagram color="#E1306C" size={12}/>{igOf(a) ? t.igLinked(igOf(a).username || igOf(a).id) : <span className="si-muted">{t.igNone}</span>}</span></div></div>
              <button type="button" className="si-primary si-sm" disabled={busy === a.id} onClick={() => toggle(a, true)}><Plus size={13}/>{busy === a.id ? t.adding : t.addToInbox}</button>
            </div>
          )) : <div className="si-muted si-small">{t.noAvail}</div>}
          {st.availableError && <div className="si-err si-small">{st.availableError}</div>}

          <details className="si-more" open={avail.length < 2}><summary><Plus size={13}/>{t.addTitle}</summary>
            <ol className="si-steps">
              {t.addSteps.map((x, i) => (
                <li key={i}><b>{x.t}</b><div className="si-muted">{x.d}</div>
                  {x.href ? <a className="si-secondary si-sm" href={x.href} target="_blank" rel="noreferrer"><ExternalLink size={12}/>{x.btn}</a> : <button type="button" className="si-secondary si-sm" onClick={() => load()}><RefreshCw size={12}/>{x.btn}</button>}
                </li>
              ))}
            </ol>
            <div className="si-muted si-small">{t.igHook}</div>
          </details>
        </>}

        <h4><FaWhatsapp color="#25D366"/>{t.waLines}</h4>
        <div className="si-pg"><span className="si-pg-pic"><FaWhatsapp color="#25D366" size={18}/></span><div className="si-pg-main"><b>{t.waMain}</b><div className="si-pg-rows"><span className="si-pg-row" dir="ltr">{wa?.phone || ''}</span><span className={`si-pill${waOk ? ' is-ok' : ''}`}>{t.waState[wa?.state] || t.waState.error}</span></div></div></div>
        <details className="si-more"><summary><Plus size={13}/>{t.waAdd}</summary><div className="si-muted">{t.waAddHow}</div></details>

        <h4><RefreshCw size={14}/>{t.importTitle}</h4>
        {prog(metaImp, t.metaProg, t.importMeta, () => metaImp.run(onImported))}
        {prog(waImp, t.waProg, t.importWa, () => waImp.run(onImported))}
      </div>
    </div>
  )
}

/** Forward one or more messages (their text) to any conversations in the inbox — WhatsApp numbers and Meta chats alike */
function InboxForward({ t, lang, items, msgs, onClose, onDone }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState([])
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState('')
  const s = q.trim().toLowerCase(), d = q.replace(/\D/g, '')
  const list = items.filter(x => !s || [x.name, x.name_he, x.waName, x.username].some(v => String(v || '').toLowerCase().includes(s)) || (d.length >= 3 && localPhone(x.phone).includes(d))).slice(0, 80)
  const intl = d.startsWith('0') ? '972' + d.slice(1) : d
  const typed = d.length >= 9 && !items.some(x => localPhone(x.phone) === localPhone(d)) ? { key: `wa:${intl}`, kind: 'wa', platform: 'whatsapp', phone: intl, name: '' } : null
  const toggle = x => setSel(v => (v.some(y => y.key === x.key) ? v.filter(y => y.key !== x.key) : v.length < 10 ? [...v, x] : v))
  const go = async () => {
    setBusy(true)
    let ok = 0
    for (const x of sel) {
      let fine = true
      for (const m of msgs) {
        try {
          if (x.kind === 'wa') await api('chat-send', { method: 'POST', body: JSON.stringify({ phone: x.phone, message: m }) })
          else await api('social-send', { method: 'POST', body: JSON.stringify({ id: x.key, text: m }) })
        } catch { fine = false }
      }
      if (fine) ok++
    }
    setBusy(false); setRes(t.fwdDone(ok, sel.length)); onDone?.()
    setTimeout(onClose, 1200)
  }
  return createPortal(
    <div className="si-acc-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="si-acc si-fwd" role="dialog" aria-modal="true" aria-label={t.fwdTitle(msgs.length)} dir={lang === 'en' ? 'ltr' : 'rtl'}>
        <div className="si-lf-head"><b><Forward size={15}/>{t.fwdTitle(msgs.length)}</b><button type="button" className="si-x" onClick={onClose} aria-label={t.close}><X size={16}/></button></div>
        <div className="si-search"><Search size={14}/><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t.fwdSearch}/></div>
        <div className="si-fwd-list">
          {typed && <button type="button" className={`si-row${sel.some(y => y.key === typed.key) ? ' is-on' : ''}`} onClick={() => toggle(typed)}><Face th={typed}/><span className="si-row-main"><b dir="ltr">{localPhone(typed.phone)}</b></span></button>}
          {list.map(x => (
            <button key={x.key} type="button" className={`si-row${sel.some(y => y.key === x.key) ? ' is-on' : ''}`} onClick={() => toggle(x)}>
              <Face th={x}/><span className="si-row-main"><span className="si-row-top"><b><bdi>{nameOf(x)}</bdi></b></span><span className="si-where"><PlatIcon p={x.platform} size={10}/>{x.kind === 'wa' ? localPhone(x.phone) : (x.username ? `@${x.username}` : '')}</span></span>
              {sel.some(y => y.key === x.key) && <Check size={16}/>}
            </button>
          ))}
        </div>
        {res && <div className="si-muted">{res}</div>}
        <div className="si-lf-foot"><button type="button" className="si-primary" disabled={!sel.length || busy} onClick={go}><Send size={14}/>{busy ? t.fwdSending : t.fwdSend(sel.length)}</button><button type="button" className="si-secondary" onClick={onClose}>{t.cancel}</button></div>
      </div>
    </div>, document.body)
}

// the lists are kept for the session, so the inbox paints at once on the next visit and only refreshes
const INBOX_KEY = 'afik_inbox_v1'
const readInbox = () => { try { const v = JSON.parse(sessionStorage.getItem(INBOX_KEY) || 'null') || {}; return Date.now() - (v.at || 0) < 10 * 60e3 ? v : {} } catch { return {} } }   // fresh only: an old list, then a reorder, read as a glitch
const writeInbox = patch => { try { sessionStorage.setItem(INBOX_KEY, JSON.stringify({ ...readInbox(), ...patch, at: Date.now() })) } catch {} }
// one row of the list, memo'd: typing a reply or a live message used to re-render every row (up to 400, each with a face)
const InboxRow = memo(function InboxRow({ x, on, name, time, hiddenText, noReplyText, noReplyTip, leadText, foundText, whereText, unreadTitle, onPick }) {
  return (
    <button type="button" role="listitem" className={`si-row${on ? ' is-on' : ''}${x.unread ? ' is-unread' : ''}`} onClick={() => onPick(x.key)}>
      <Face th={x}/>
      <span className="si-row-main">
        <span className="si-row-top"><b><bdi>{name}</bdi></b><small>{time}</small></span>
        <span className="si-row-bot"><span className="si-last" dir="auto">{x.last_dir === 'out' ? '✓ ' : ''}{x.last_text || ''}</span>
          {hiddenText ? <span className="si-badge is-off">{hiddenText}</span> : noReplyText ? <span className="si-badge is-wait" title={noReplyTip}>{noReplyText}</span> : null}
          {leadText ? <span className="si-badge is-lead">{leadText}</span> : foundText ? <span className="si-badge">{foundText}</span> : null}
          {x.unread > 0 && <span className="si-unread" title={unreadTitle}>{x.unread}</span>}</span>
        {whereText && <span className="si-where"><PlatIcon p={x.platform} size={10}/>{whereText}</span>}
      </span>
    </button>
  )
})
export default function SocialInboxTab({ lang = 'he', onOpenLead, onOpenChat, onUpdateLead, onUpdateStatus, stageLabels = {} }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const [threads, setThreads] = useState(() => readInbox().threads ?? null)
  const [accounts, setAccounts] = useState(() => readInbox().accounts || {})
  const [waChats, setWaChats] = useState(() => readInbox().wa ?? null)
  const [missing, setMissing] = useState(false)
  const [sel, setSel] = useState('')
  const [conv, setConv] = useState({ key: '', thread: null, messages: [], unread: 0 })
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')          // "הכל" every time the screen opens
  const [page, setPage] = useState('all')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [leadForm, setLeadForm] = useState(false)
  const [accOpen, setAccOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [tplOpen, setTplOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [fwd, setFwd] = useState(null)                 // [texts]
  const [editTpl, setEditTpl] = useState(null)
  const [reacts, setReacts] = useState({})             // Instagram ❤️ we sent this session: { mid: true }
  const [zoom, setZoom] = useState(() => { try { const v = Number(localStorage.getItem('afik_inbox_zoom')); return v >= 0.8 && v <= 1.6 ? v : 1 } catch { return 1 } })
  const setZ = v => { const z = Math.round(Math.min(1.6, Math.max(0.8, v)) * 100) / 100; setZoom(z); try { localStorage.setItem('afik_inbox_zoom', String(z)) } catch {} }
  const LIST_W = [280, 640], LIST_DEF = 380
  const [listW, setListW] = useState(() => { try { const v = Number(localStorage.getItem('afik_inbox_list_w')); return v >= LIST_W[0] && v <= LIST_W[1] ? v : LIST_DEF } catch { return LIST_DEF } })
  const saveListW = v => { setListW(v); try { localStorage.setItem('afik_inbox_list_w', String(v)) } catch {} }
  const listRef = useRef(null), msgsRef = useRef(null), inputRef = useRef(null)
  const autoConfig = useSharedAutoConfig()
  const leads = useSharedLeads()
  const projects = useProjects()
  const { isDark } = useAdminTheme()
  const WA = isDark ? DARK : LIGHT
  const endRef = useRef(null)
  const selRef = useRef(sel); selRef.current = sel
  const flash = m => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const loadThreads = useCallback(() => api('social-threads').then(d => { setThreads(d.threads || []); setAccounts(d.accounts || {}); setMissing(!!d.tablesMissing); writeInbox({ threads: d.threads || [], accounts: d.accounts || {} }) }).catch(e => { setThreads([]); setErr(e.message) }), [])
  const loadWa = useCallback(() => api('social-wa').then(d => { setWaChats(d.chats || []); writeInbox({ wa: d.chats || [] }) }).catch(() => setWaChats([])), [])
  const loadAll = useCallback(() => { loadThreads(); loadWa() }, [loadThreads, loadWa])
  const loadConv = useCallback(async (key, first = false) => {
    if (key.startsWith('wa:')) return
    const d = await api(`social-thread?id=${encodeURIComponent(key)}`).catch(() => null)
    if (d && selRef.current === key) setConv(c => ({ key, thread: d.thread, messages: d.messages || [], unread: first ? (d.unread || 0) : c.unread, lastIn: d.lastIn || null }))
  }, [])
  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    if (!sel) return
    setConv({ key: sel, thread: null, messages: [], unread: 0 }); setLeadForm(false); setErr(''); setText(''); setTplOpen(false); setEmojiOpen(false); setMoreOpen(false)
    loadConv(sel, true)
    // the row stops being "unread" at once (the server zeroes it on read)
    if (!sel.startsWith('wa:')) setThreads(ts => (ts || []).map(x => (x.id === sel && x.unread ? { ...x, unread: 0 } : x)))
  }, [sel, loadConv])
  // the database announces every change (a message in, our reply, a lead made): re-read what changed
  useEffect(() => {
    const reS = debounce(() => { loadThreads(); if (selRef.current && !selRef.current.startsWith('wa:')) loadConv(selRef.current) }, 700)
    // the WhatsApp list is re-read at most every 5 s, and not for a status tick (a delivered / read mark changes no row)
    let lastWa = 0, tm = null
    const reW = () => { clearTimeout(tm); tm = setTimeout(() => { lastWa = Date.now(); loadWa() }, Math.max(900, 5000 - (Date.now() - lastWa))) }
    const off = onSync(m => { if (m.t === 'social_threads') reS(); else if (m.t === 'wa_messages') { if (String(m.op || '').toUpperCase() !== 'UPDATE') reW() } else if (m.t === '*') { reS(); reW() } })
    return () => { off(); clearTimeout(tm) }
  }, [loadThreads, loadWa, loadConv])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [conv.messages.length, sel])
  // Ctrl / ⌘ + wheel over the conversation = bigger / smaller text (like a browser, only for the chat)
  useEffect(() => {
    const el = msgsRef.current
    if (!el) return
    const onWheel = e => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZ(zoom + (e.deltaY < 0 ? 0.1 : -0.1)) }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, sel]) // eslint-disable-line react-hooks/exhaustive-deps

  const all = useMemo(() => [...(waChats || []).map(c => fromWa(c, t)), ...(threads || []).map(fromSocial)]
    .sort((a, b) => Date.parse(b.last_at || 0) - Date.parse(a.last_at || 0)), [waChats, threads, t])
  const pageChips = useMemo(() => {
    const m = new Map()
    for (const x of all) {
      if (x.kind !== 'social') continue
      const lab = accounts[x.account_id]
      const pid = lab?.pageId || x.account_id
      if (!m.has(pid)) m.set(pid, { id: pid, name: (lab?.platform === 'messenger' ? lab.name : accounts[pid]?.name) || lab?.name || pid, n: 0 })
      m.get(pid).n++
    }
    return [...m.values()]
  }, [all, accounts])
  const accCounts = useMemo(() => { const m = {}; for (const x of all) if (x.kind === 'social') m[x.account_id] = (m[x.account_id] || 0) + 1; return m }, [all])
  const pageOfItem = x => (x.kind === 'wa' ? 'wa' : accounts[x.account_id]?.pageId || x.account_id)
  const inPage = x => page === 'all' || pageOfItem(x) === page
  const noReply = x => x.last_dir === 'out' && x.last_at && Date.now() - Date.parse(x.last_at) > 3600e3
  const match = (x, f) => (f === 'hidden' ? !!x.hidden : x.hidden ? false : f === 'nolead' ? !x.lead_id : f === 'unread' ? x.unread > 0 : f === 'noreply' ? noReply(x) : f === 'whatsapp' || f === 'messenger' || f === 'instagram' ? x.platform === f : true)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase(), d = q.replace(/\D/g, '')
    return all.filter(x => inPage(x) && match(x, filter) && (!s
      || [x.name, x.name_he, x.waName, x.username, x.last_text].some(v => String(v || '').toLowerCase().includes(s))
      || (d.length >= 3 && (String(x.phone || '').includes(d) || localPhone(x.phone).includes(d)))))
  }, [all, q, filter, page, accounts]) // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => Object.fromEntries(Object.keys(t.f).map(k => [k, all.filter(x => inPage(x) && match(x, k)).length])), [all, t, page, accounts]) // eslint-disable-line react-hooks/exhaustive-deps
  const item = all.find(x => x.key === sel) || null
  const th = item ? (item.kind === 'social' && conv.thread ? { ...fromSocial(conv.thread), name_he: item.name_he } : item) : null
  const where = x => (x.kind === 'wa' ? t.waLine : accounts[x.account_id]?.name || '')

  // the lead the templates are written for: the CRM lead when there is one, else what we know from the conversation
  const crmLead = useMemo(() => {
    if (!th) return null
    return th.lead_id ? (leads || []).find(l => String(l.id) === String(th.lead_id)) : th.kind === 'wa' ? (leads || []).find(l => String(l.phone || '').replace(/\D/g, '').slice(-9) === String(th.phone).slice(-9)) : null
  }, [th?.key, th?.lead_id, leads]) // eslint-disable-line react-hooks/exhaustive-deps
  const tplLead = useMemo(() => crmLead || (th ? { id: th.key, name: nameOf(th).replace(/^@/, ''), phone: th.kind === 'wa' ? localPhone(th.phone) : th.phone || '', source: th.platform, crm_data: { leadStatus: 'new' } } : null), [crmLead, th?.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const tplMsgs = useMemo(() => conv.messages.map(m => ({ direction: m.direction, message: m.body || '' })), [conv.messages])
  const putInBox = v => { setText(String(v || '')); setTplOpen(false); setTimeout(() => inputRef.current?.focus(), 30) }
  const openLead = id => (onOpenLead ? onOpenLead(id) : window.open(`/admin-panel/leads?lead=${encodeURIComponent(id)}`, '_blank'))

  // a WhatsApp chat is the real WhatsApp conversation (LeadConversation): the lead row, or a stand-in for a number that isn't one
  const waLead = useMemo(() => (th?.kind === 'wa' ? (crmLead || { id: `wa:${th.phone}`, name: th.name || th.waName || '', phone: localPhone(th.phone), source: 'whatsapp', crm_data: {} }) : null), [th?.key, crmLead]) // eslint-disable-line react-hooks/exhaustive-deps
  const sendWa = async (phone, body, opts = {}) => {
    try {
      const d = await api('chat-send', { method: 'POST', body: JSON.stringify({ phone, message: body, ...(opts.image ? { image: opts.image } : {}), ...(opts.quotedMessageId ? { quotedMessageId: opts.quotedMessageId } : {}), ...(opts.file ? { file: opts.file, fileName: opts.fileName || '' } : {}) }) })
      return d.ok ? { ok: true } : { ok: false, error: d.error || 'failed' }
    } catch (e) { return { ok: false, error: e.message } }
  }

  // Messenger / Instagram: send text (a template's text too)
  const send = async (override) => {
    const body = String(typeof override === 'string' ? override : text).trim()
    if (!body || !sel || sending) return
    setSending(true); setErr('')
    const tmp = { id: `tmp-${Date.now()}`, direction: 'out', body, ts: new Date().toISOString(), pending: true }
    setConv(c => ({ ...c, messages: [...c.messages, tmp] })); if (typeof override !== 'string') setText('')
    setEmojiOpen(false)
    try { await api('social-send', { method: 'POST', body: JSON.stringify({ id: sel, text: body }) }); setTimeout(() => loadConv(sel), 600) }
    catch (e) { setErr(e.message); if (typeof override !== 'string') setText(body); setConv(c => ({ ...c, messages: c.messages.filter(m => m.id !== tmp.id) })) }
    setSending(false)
  }
  const reactIg = async (m, emo) => {
    if (th?.platform !== 'instagram') { flash(t.noReactFb); return }
    const on = emo !== '' && !(reacts[m.id] && emo === '❤️')
    if (emo && emo !== '❤️') flash(t.igOnlyLove)
    setReacts(r => ({ ...r, [m.id]: on }))
    try { await api('social-react', { method: 'POST', body: JSON.stringify({ id: sel, mid: m.id, on }) }) } catch (e) { setReacts(r => ({ ...r, [m.id]: !on })); setErr(e.message) }
  }
  const saveAsTemplate = txt => {
    const he = /[֐-׿]/.test(txt), body = messageToTemplate(txt, tplLead || {})
    setEditTpl({ tpl: { cat: 'personal', he: '', en: '', he_title: '', en_title: '', project: leadProperty(tplLead || {}) || '' }, initial: he ? { he: body, en: '' } : { he: '', en: body }, lang: he ? 'he' : 'en' })
  }
  const renameThread = async name => {
    if (!th) return
    if (th.kind === 'wa') {
      if (crmLead && onUpdateLead) await onUpdateLead(crmLead.id, { name })
      else { const d = await api('chat-contact-name', { method: 'POST', body: JSON.stringify({ phone: th.phone, name }) }); if (!d) throw new Error('failed') }
      setWaChats(cs => (cs || []).map(c => (c.phone === th.phone ? { ...c, name } : c)))
      return
    }
    const d = await api('social-rename', { method: 'POST', body: JSON.stringify({ id: th.id, name }) })
    setThreads(ts => (ts || []).map(x => (x.id === th.id ? { ...x, name: d.name, name_he: d.name_he } : x)))
    setConv(c => (c.thread ? { ...c, thread: { ...c.thread, name: d.name } } : c))
    if (crmLead && onUpdateLead) onUpdateLead(crmLead.id, { name }).catch?.(() => {})
  }
  const removeChat = async () => {
    setMoreOpen(false)
    if (!th) return
    const who = nameOf(th)
    if (th.kind === 'wa') {
      const on = !th.hidden
      if (on && !window.confirm(t.hideAsk(who))) return
      try { await api('social-wa-hide', { method: 'POST', body: JSON.stringify({ phone: th.phone, on }) }); setWaChats(cs => (cs || []).map(c => (c.phone === th.phone ? { ...c, hidden: on } : c))); flash(on ? t.hiddenDone : t.restored); if (on) setSel('') } catch (e) { setErr(e.message) }
      return
    }
    if (!window.confirm(t.deleteAsk(who))) return
    try { await api('social-delete', { method: 'POST', body: JSON.stringify({ id: th.id }) }); setThreads(ts => (ts || []).filter(x => x.id !== th.id)); setSel(''); flash(t.deleted) } catch (e) { setErr(e.message) }
  }
  const markUnread = async () => {
    setMoreOpen(false)
    if (!sel || sel.startsWith('wa:')) return
    try { await api('social-unread', { method: 'POST', body: JSON.stringify({ id: sel }) }); setThreads(ts => (ts || []).map(x => (x.id === sel ? { ...x, unread: 1 } : x))); setSel('') } catch (e) { setErr(e.message) }
  }
  const insertEmoji = e => {
    const el = inputRef.current
    if (!el) { setText(v => v + e); return }
    const a = el.selectionStart ?? text.length, b = el.selectionEnd ?? text.length
    const next = text.slice(0, a) + e + text.slice(b)
    setText(next); setTimeout(() => { el.focus(); el.setSelectionRange(a + e.length, a + e.length) }, 0)
  }

  // Meta bubbles with a day line and the "new messages" line before the last `unread` incoming ones
  const metaItems = useMemo(() => {
    const out = []
    let lastDay = '', unreadFrom = -1, left = conv.unread
    for (let k = conv.messages.length - 1; k >= 0 && left > 0; k--) if (conv.messages[k].direction === 'in') { unreadFrom = k; left-- }
    conv.messages.forEach((m, i) => {
      const day = new Date(m.ts).toDateString()
      if (day !== lastDay) { lastDay = day; out.push(<div key={`d-${day}`} className="si-day"><span>{fmtDay(m.ts, lang)}</span></div>) }
      if (i === unreadFrom) out.push(<div key="new" className="si-day si-new"><span>{t.newMsgs(conv.unread)}</span></div>)
      const isOut = m.direction === 'out'
      out.push(
        <div key={m.id} className={`si-bub is-${m.direction}${m.pending ? ' is-pending' : ''}${reacts[m.id] ? ' has-react' : ''}`}>
          {!m.pending && <ChatMsgMenu text={m.body || ''} isOut={isOut} WA={WA} lang={lang} bg={isOut ? (isDark ? '#1E3A5F' : '#DCEBFF') : WA.bubbleIn}
            onSaveTemplate={m.body ? saveAsTemplate : undefined} onForward={m.body ? () => setFwd([m.body]) : undefined}
            {...(th?.platform === 'instagram' && !isOut ? { onReact: emo => reactIg(m, emo), myReaction: reacts[m.id] ? '❤️' : '' } : {})}/>}
          {(m.attachments || []).map((a, i2) => a.type === 'image' && a.url ? <img key={i2} src={a.url} alt="" referrerPolicy="no-referrer" loading="lazy"/> : a.url ? <a key={i2} href={a.url} target="_blank" rel="noreferrer">📎 {a.name || a.type}</a> : null)}
          {m.body && <span dir="auto"><WAText text={m.body}/></span>}
          <small>{fmtTime(m.ts, lang)}</small>
          {reacts[m.id] && <i className="si-react" aria-label="❤️">❤️</i>}
        </div>,
      )
    })
    return out
  }, [conv.messages, conv.unread, reacts, lang, WA, isDark, th?.platform]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="si" dir={lang === 'en' ? 'ltr' : 'rtl'}>
      <aside ref={listRef} className={`si-list${sel ? ' has-sel' : ''}`} style={{ width: listW }}>
        <div className="si-top">
          <div className="si-title"><h2>{t.title}</h2><button type="button" className="si-accbtn" onClick={() => setAccOpen(true)}><Plug size={14}/>{t.accounts}</button></div>
          <p className="si-muted">{t.sub}</p>
          <div className="si-search"><Search size={14}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}/></div>
          <div className="si-filters" role="tablist">
            {Object.keys(t.f).filter(k => k !== 'hidden' || counts.hidden > 0).map(k => <button key={k} type="button" role="tab" aria-selected={filter === k} className={k === 'unread' && counts.unread ? 'has-new' : ''} onClick={() => setFilter(k)}>{['whatsapp', 'messenger', 'instagram'].includes(k) ? <PlatIcon p={k} size={12}/> : k === 'hidden' ? <EyeOff size={12}/> : null}{t.f[k]}{counts[k] > 0 && <em>{counts[k]}</em>}</button>)}
          </div>
          {pageChips.length > 0 && (
            <div className="si-pages" aria-label={t.allPages}>
              <button type="button" aria-pressed={page === 'all'} onClick={() => setPage('all')}>{t.allPages}</button>
              {(waChats || []).length > 0 && <button type="button" aria-pressed={page === 'wa'} onClick={() => setPage('wa')}><FaWhatsapp size={11} color="#25D366"/>{t.waLine}</button>}
              {pageChips.map(p => <button key={p.id} type="button" aria-pressed={page === p.id} onClick={() => setPage(p.id)}><FaFacebookMessenger size={11} color="#0084FF"/>{p.name}<em>{p.n}</em></button>)}
            </div>
          )}
        </div>
        {missing && <div className="si-warn si-m">{t.tablesMissing}</div>}
        <div className="si-rows" role="list">
          {threads === null && waChats === null ? <div className="si-muted si-m">…</div> : !list.length ? (
            <div className="si-empty"><b>{t.empty}</b><span>{t.emptySub}</span><button type="button" className="si-secondary" onClick={() => setAccOpen(true)}><Plug size={14}/>{t.accounts}</button></div>
          ) : list.slice(0, 400).map(x => <InboxRow key={x.key} x={x} on={sel === x.key} name={nameOf(x)} time={fmtTime(x.last_at, lang)} hiddenText={x.hidden ? t.isHidden : ''}
            noReplyText={!x.hidden && noReply(x) ? t.noReply(agoText(x.last_at, lang)) : ''} noReplyTip={t.noReplyTip} leadText={x.lead_id ? t.isLead : ''} foundText={!x.lead_id && x.kind === 'social' && x.phone ? t.foundPhone : ''}
            whereText={where(x)} unreadTitle={x.unread > 0 ? t.newN(x.unread) : ''} onPick={setSel}/>)}
        </div>
      </aside>
      <Splitter axis="x" className="si-spl" min={LIST_W[0]} grows={lang === 'en' ? 1 : -1} label={t.resize}
        max={() => Math.min(LIST_W[1], (listRef.current?.parentElement?.getBoundingClientRect().width || 1200) - 420)}
        get={() => listRef.current?.getBoundingClientRect().width || listW}
        apply={v => { if (listRef.current) listRef.current.style.width = `${v}px` }}
        commit={saveListW} reset={() => { if (listRef.current) listRef.current.style.width = `${LIST_DEF}px`; saveListW(LIST_DEF) }}/>

      <section className="si-conv" style={{ '--si-z': zoom }}>
        {!th ? <div className="si-pick"><MessageCircle size={30}/><b>{t.pick}</b><span>{t.pickSub}</span></div> : <>
          <header className="si-conv-head">
            <button type="button" className="si-back" onClick={() => setSel('')} aria-label={t.close}><ChevronRight size={24}/></button>
            <Face th={th} size={46} zoom t={t} lang={lang} link={profileLink(th, accounts)}/>
            <div className="si-who">
              <span className="si-who-name">
                <ChatNameEdit name={nameOf(th).replace(/^@/, '')} lead={crmLead} phone={th.kind === 'wa' ? th.phone : ''} lang={lang} WA={WA} project={(crmLead && leadProject(crmLead)) || ''} onUpdateLead={onUpdateLead} onRename={renameThread} savedText={th.kind === 'wa' ? '' : (lang === 'en' ? 'Saved ✓' : 'נשמר ✓')}>
                  <bdi>{nameOf(th)}</bdi>
                </ChatNameEdit>
                <a className="si-who-link" href={profileLink(th, accounts)} target="_blank" rel="noreferrer" title={t.profileOf[th.platform]} aria-label={t.profileOf[th.platform]}><ExternalLink size={12}/></a>
              </span>
              <small>{th.kind === 'wa' ? `WhatsApp · ${localPhone(th.phone)}` : `${th.platform === 'instagram' ? 'Instagram' : 'Messenger'}${where(th) ? ` · ${where(th)}` : ''}${th.username && th.name ? ` · @${th.username}` : ''}${th.phone ? ` · ${th.phone}` : ''}`}</small></div>
            <div className="si-zoom" role="group" aria-label={t.zoomReset}>
              <button type="button" onClick={() => setZ(zoom - 0.1)} disabled={zoom <= 0.8} title={t.zoomOut} aria-label={t.zoomOut}><ZoomOut size={15}/></button>
              <button type="button" className="si-zoom-v" onClick={() => setZ(1)} title={t.zoomReset}>{Math.round(zoom * 100)}%</button>
              <button type="button" onClick={() => setZ(zoom + 0.1)} disabled={zoom >= 1.6} title={t.zoomIn} aria-label={t.zoomIn}><ZoomIn size={15}/></button>
            </div>
            {th.kind !== 'wa' && <ChatTemplateMenu WA={WA} lang={lang} lead={tplLead} msgs={tplMsgs} autoConfig={autoConfig}
              onSend={txt => send(txt)} onInsert={putInBox} onOpenPanel={() => setTplOpen(true)}/>}
            {!th.lead_id && !crmLead && <button type="button" className="si-primary" onClick={() => setLeadForm(v => !v)}><UserPlus size={14}/>{t.addLead}</button>}
            {th.lead_id && !crmLead && <button type="button" className="si-secondary" onClick={() => openLead(th.lead_id)}><Link2 size={14}/>{t.openLead}</button>}
            {th.kind === 'wa'
              ? <button type="button" className="si-icon" onClick={() => onOpenChat?.({ phone: th.phone, name: nameOf(th), leadId: th.lead_id })} title={t.openChats} aria-label={t.openChats}><FaWhatsapp size={15}/></button>
              : null}
            <span className="si-more-wrap">
              <button type="button" className="si-icon" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen(v => !v)} title={t.more} aria-label={t.more}><MoreVertical size={16}/></button>
              {moreOpen && <div className="si-menu" role="menu">
                {th.kind !== 'wa' && <button type="button" role="menuitem" onClick={markUnread}><MailOpen size={14}/>{t.markUnread}</button>}
                {th.kind !== 'wa' && <a role="menuitem" href="https://business.facebook.com/latest/inbox/all" target="_blank" rel="noreferrer" onClick={() => setMoreOpen(false)}><ExternalLink size={14}/>{t.openMeta}</a>}
                {th.kind === 'wa'
                  ? <button type="button" role="menuitem" onClick={removeChat}>{th.hidden ? <Eye size={14}/> : <EyeOff size={14}/>}{th.hidden ? t.unhideChat : t.hideChat}</button>
                  : <button type="button" role="menuitem" className="is-danger" onClick={removeChat}><Trash2 size={14}/>{t.deleteChat}</button>}
              </div>}
            </span>
          </header>
          {/* the lead's tools, like the chats tab: stage · project · follow-up · notes · AI summary · the card */}
          <div className="si-tools">
            {crmLead && onUpdateLead ? <>
              {onUpdateStatus && <StageMenu lead={crmLead} lang={lang} stageLabels={stageLabels} WA={WA} onChange={st => onUpdateStatus(crmLead, st)}/>}
              <ProjectChip lead={crmLead} projects={projects} lang={lang} size="md" onAssign={patch => onUpdateLead(crmLead.id, patch)}/>
              <FollowUpButton lead={crmLead} lang={lang} size="sm" onSave={p => onUpdateLead(crmLead.id, p)}/>
              <NotesButton lead={crmLead} lang={lang} size="sm" onSave={p => onUpdateLead(crmLead.id, p)}/>
              <AiNoteButton lead={crmLead} lang={lang} stageLabels={stageLabels} WA={WA} onUpdateLead={onUpdateLead} onStage={st => onUpdateStatus?.(crmLead, st)}/>
              <span className="si-tools-sp"/>
              <button type="button" className="si-secondary si-sm" onClick={() => openLead(crmLead.id)}><Link2 size={13}/>{t.leadCardBtn}</button>
            </> : <>
              {noReply(th) && <span className="si-noreply" title={t.noReplyTip}><Clock size={12}/>{t.noReply(agoText(th.last_at, lang))}</span>}
              <span className="si-tools-sp"/>
              <small className="si-muted">{t.rename}</small>
            </>}
            {crmLead && noReply(th) && <span className="si-noreply" title={t.noReplyTip}><Clock size={12}/>{t.noReply(agoText(th.last_at, lang))}</span>}
          </div>
          {leadForm && !th.lead_id && <LeadForm th={th} t={t} lang={lang} onCancel={() => setLeadForm(false)} onDone={(lead, existing) => {
            setLeadForm(false); flash(existing ? t.existing : t.added)
            if (th.kind === 'wa') setWaChats(cs => (cs || []).map(c => (c.phone === th.phone ? { ...c, lead_id: String(lead.id), name: c.name || lead.name } : c)))
            else setConv(c => ({ ...c, thread: { ...c.thread, lead_id: String(lead.id) } }))
            if (existing) openLead(lead.id)
            loadAll()
          }}/>}

          {th.kind === 'wa' ? (
            <div className="si-wa" ref={msgsRef}>
              <LeadConversation key={th.key} lead={waLead} tplLead={tplLead} lang={lang} isDark={isDark} autoConfig={autoConfig} compact
                onAutoConfigSaved={setSharedAutoConfig} onSend={(txt, opts) => sendWa(th.phone, txt, opts)} unreadCount={item?.unread || 0} hideHeader
                onOpenChats={onOpenChat ? () => onOpenChat({ phone: th.phone, name: nameOf(th), leadId: th.lead_id }) : undefined}/>
            </div>
          ) : (<>
            <div ref={msgsRef} className="si-msgs">{metaItems}<div ref={endRef}/></div>
            {(() => {
              const closed = conv.lastIn && Date.now() - Date.parse(conv.lastIn) > 24 * 3600e3
              if (!closed && !err) return null
              return (
                <div className={`si-notice${err ? ' is-err' : ''}`} role={err ? 'alert' : 'status'}>
                  <div className="si-notice-t">{err ? <><AlertTriangle size={14}/><b>{t.sendFailed}</b></> : <><Clock size={14}/><b>{t.windowClosed}</b></>}</div>
                  <div className="si-notice-d">{err || t.windowHow}</div>
                  <a className="si-secondary si-sm" href={profileLink(th, accounts)} target="_blank" rel="noreferrer"><ExternalLink size={12}/>{t.openInMeta}</a>
                </div>
              )
            })()}
            {tplOpen && (
              <div className="si-tplwin">
                <ChatTemplatePicker WA={WA} lang={lang} lead={tplLead} msgs={tplMsgs} autoConfig={autoConfig}
                  onSend={txt => { send(txt); setTplOpen(false) }} onInsert={putInBox} onClose={() => setTplOpen(false)}/>
              </div>
            )}
            {!text.trim() && !tplOpen && (
              <div className="si-chips">
                <ChatQuickChips WA={WA} lang={lang} lead={tplLead} msgs={tplMsgs} autoConfig={autoConfig}
                  onSend={txt => send(txt)} onInsert={putInBox} onMore={() => setTplOpen(true)}/>
                <small className="si-muted">{t.socialTpl}</small>
              </div>
            )}
            {emojiOpen && <div className="si-emoji" role="group" aria-label={t.emoji}>{EMOJI.map(e => <button key={e} type="button" onClick={() => insertEmoji(e)}>{e}</button>)}</div>}
            <div className="si-composer">
              <button type="button" className="si-tplbtn" onClick={() => setTplOpen(v => !v)} aria-pressed={tplOpen} title={t.templates}><LayoutTemplate size={16}/><span>{t.templates}</span></button>
              <button type="button" className="si-tplbtn si-iconb" onClick={() => setEmojiOpen(v => !v)} aria-pressed={emojiOpen} title={t.emoji} aria-label={t.emoji}><Smile size={17}/></button>
              <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder={t.reply} rows={1} dir="auto"
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}/>
              <button type="button" className="si-send" disabled={!text.trim() || sending} onClick={() => send()}><Send size={15}/>{sending ? t.sending : t.send}</button>
            </div>
          </>)}
        </>}
      </section>
      {accOpen && <Accounts t={t} lang={lang} counts={accCounts} onClose={() => setAccOpen(false)} onImported={loadAll}/>}
      {fwd && <InboxForward t={t} lang={lang} items={all.filter(x => x.key !== sel)} msgs={fwd} onClose={() => setFwd(null)} onDone={loadAll}/>}
      {editTpl && (
        <TemplateQuickEdit WA={WA} lang={lang} lead={tplLead} tpl={editTpl.tpl} initial={editTpl.initial} initialLang={editTpl.lang} fromChat create
          autoConfig={autoConfig} onClose={() => setEditTpl(null)} onSaved={next => { setSharedAutoConfig(next); flash(t.tplSaved) }}/>
      )}
      {toast && <div className="si-toast" role="status"><Check size={14}/>{toast}</div>}
      <style>{SI_CSS + SPLITTER_CSS + LP_CSS}</style>
    </div>
  )
}

const SI_CSS = `
.si{display:flex;height:100%;min-height:0;font-family:Rubik,sans-serif;color:var(--au-text);background:var(--au-bg,transparent)}
.si-list{width:380px;flex:none;display:flex;flex-direction:column;min-height:0;border-inline-end:1px solid var(--au-line);background:var(--au-pop)}
.si-spl{flex:none}
.si-top{padding:14px 14px 8px}
.si-title{display:flex;align-items:center;gap:8px}
.si-title h2{flex:1;margin:0;font-size:19px;font-weight:700}
.si-accbtn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border:1px solid var(--au-line);border-radius:9px;background:none;color:var(--au-brand-text);font:600 12.5px Rubik,sans-serif;cursor:pointer;min-height:0}
.si-muted{color:var(--au-text2);font-size:12.5px;margin:4px 0 0;line-height:1.55}
.si-small{font-size:11.5px;margin-top:6px}
.si-m{margin:8px 14px}
.si-search{display:flex;align-items:center;gap:7px;height:36px;margin-top:10px;padding:0 10px;border:1px solid var(--au-line);border-radius:10px;color:var(--au-text3);background:var(--au-input,var(--au-pop))}
.si-search input{flex:1;min-width:0;border:none;outline:none;background:none;font:13px Rubik,sans-serif;color:var(--au-text);min-height:0}
.si-filters{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.si-filters button{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:1px solid var(--au-line);border-radius:999px;background:none;color:var(--au-text2);font:500 12px Rubik,sans-serif;cursor:pointer;min-height:0}
.si-filters button[aria-selected=true]{background:rgba(var(--brand-rgb),.1);border-color:rgba(var(--brand-rgb),.45);color:var(--au-text);font-weight:700}
.si-filters em{font-style:normal;font-size:10.5px;font-weight:700;color:var(--au-text3)}
.si-filters button.has-new em{background:#16A34A;color:#fff;border-radius:999px;padding:0 6px;min-width:17px;text-align:center}
.si-pages{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.si-pages button{flex:none;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border:1px solid var(--au-line);border-radius:8px;background:none;color:var(--au-text2);font:500 11.5px Rubik,sans-serif;cursor:pointer;min-height:0;white-space:nowrap}
.si-pages button[aria-pressed=true]{background:rgba(var(--brand-rgb),.1);border-color:rgba(var(--brand-rgb),.45);color:var(--au-text);font-weight:700}
.si-pages em{font-style:normal;font-size:10.5px;color:var(--au-text3)}
.si-rows{flex:1;min-height:0;overflow-y:auto;padding:4px 6px 12px}
.si-row{position:relative;width:100%;display:flex;align-items:center;gap:10px;padding:9px 8px;border:none;border-radius:10px;background:none;cursor:pointer;text-align:start;font-family:inherit;color:inherit;min-height:0}
.si-row:hover{background:rgba(var(--ov),.05)}
.si-row.is-on{background:rgba(var(--brand-rgb),.1)}
.si-row.is-unread{background:rgba(22,163,74,.06)}
.si-row.is-unread::before{content:'';position:absolute;inset-block:8px;inset-inline-start:0;width:3px;border-radius:3px;background:#16A34A}
.si-row.is-unread.is-on{background:rgba(var(--brand-rgb),.12)}
.si-row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.si-row-top{display:flex;align-items:center;gap:8px}
.si-row-top b{flex:1;min-width:0;font-size:14px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.si-row.is-unread .si-row-top b{font-weight:800}
.si-row-top small{font-size:11.5px;color:var(--au-text3)}
.si-row.is-unread .si-row-top small{color:#16A34A;font-weight:700}
.si-row-bot{display:flex;align-items:center;gap:6px}
.si-last{flex:1;min-width:0;font-size:12.5px;color:var(--au-text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.si-row.is-unread .si-last{color:var(--au-text);font-weight:700}
.si-where{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--au-text3);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.si-badge{flex:none;font-size:10.5px;font-weight:700;border-radius:6px;padding:1px 7px;background:rgba(217,119,6,.13);color:#B45309}
.si-badge.is-lead{background:rgba(22,163,74,.13);color:#15803D}
.si-unread{flex:none;min-width:20px;height:20px;border-radius:999px;background:#16A34A;color:#fff;font-size:11.5px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;padding:0 6px}
.si-face{position:relative;flex:none;border-radius:50%;background:rgba(var(--brand-rgb),.14);display:inline-flex;align-items:center;justify-content:center;color:var(--au-brand-text)}
.si-face img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.si-face .si-ini{font-size:15px;color:var(--au-brand-text);display:flex;align-items:center;justify-content:center;width:100%;height:100%}
.si-face i{position:absolute;bottom:-2px;inset-inline-end:-2px;width:19px;height:19px;border-radius:50%;background:var(--au-pop);display:inline-flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px var(--au-line);z-index:1}
.si-empty{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:36px 18px;color:var(--au-text2);font-size:13px}
.si-empty b{color:var(--au-text);font-size:14px}
.si-conv{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;background:rgba(var(--ov),.02)}
.si-pick{margin:auto;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--au-text3);font-size:13px}
.si-pick b{font-size:15px;color:var(--au-text2)}
.si-conv-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--au-line);background:var(--au-pop);flex:none}
.si-back{display:none;width:38px;height:38px;border-radius:50%;border:none;background:transparent;color:var(--au-text);cursor:pointer;padding:0;min-height:0;flex:none;align-items:center;justify-content:center;margin-inline-start:-6px}
.si-back:active{background:rgba(var(--ov),.08)}
html[dir=ltr] .si-back svg{transform:scaleX(-1)}
.si-who{flex:1;min-width:0;display:flex;flex-direction:column}
.si-who small{font-size:12px;color:var(--au-text2)}
.si-who-name{display:inline-flex;align-items:center;gap:6px;font-size:16px;font-weight:700;color:var(--au-text);text-decoration:none;min-width:0}
.si-who-name .wa-name-btn:hover{text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}
.si-who-link{display:inline-flex;color:var(--au-text3);opacity:.6}
.si-who-link:hover{opacity:1;color:var(--au-brand-text)}
.si-tools{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:7px 14px;border-bottom:1px solid var(--au-line);background:var(--au-pop);flex:none}
.si-tools-sp{flex:1}
.si-noreply{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 9px;border-radius:999px;font-size:11.5px;font-weight:600;color:#B45309;background:rgba(217,119,6,.12)}
.si-badge.is-wait{background:rgba(217,119,6,.12);color:#B45309;font-weight:600}
.si-badge.is-off{background:rgba(var(--ov),.08);color:var(--au-text3)}
.si-menu button.is-danger{color:#DC2626}
.si-notice{flex:none;margin:0 14px 8px;padding:10px 12px;border-radius:12px;border:1px solid rgba(217,119,6,.35);background:rgba(217,119,6,.08);display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;font-size:12.5px;color:var(--au-text)}
.si-notice.is-err{border-color:rgba(220,38,38,.35);background:rgba(220,38,38,.07)}
.si-notice-t{display:inline-flex;align-items:center;gap:6px;color:#B45309}
.si-notice.is-err .si-notice-t{color:#DC2626}
.si-notice-d{flex:1 1 320px;min-width:0;color:var(--au-text2);line-height:1.5}
.si-who-name bdi{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.si-who-name svg{flex:none;opacity:.45}
.si-who-name:hover{color:var(--au-brand-text)}
.si-who-name:hover svg{opacity:1}
.si-zoom{display:inline-flex;align-items:center;border:1px solid var(--au-line);border-radius:9px;overflow:hidden;height:34px}
.si-zoom button{border:none;background:none;color:var(--au-text2);height:100%;padding:0 8px;cursor:pointer;display:inline-flex;align-items:center;min-height:0;font:600 11.5px Rubik,sans-serif}
.si-zoom button:hover:not(:disabled){background:rgba(var(--ov),.06);color:var(--au-text)}
.si-zoom button:disabled{opacity:.35;cursor:default}
.si-zoom-v{min-width:44px;justify-content:center;border-inline:1px solid var(--au-line)!important}
.si-primary{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border:none;border-radius:9px;background:var(--au-brand);color:#fff;font:600 13px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0;text-decoration:none}
.si-primary:disabled{opacity:.5;cursor:default}
.si-secondary{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border:1px solid var(--au-line);border-radius:9px;background:none;color:var(--au-text);font:500 12.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap;min-height:0;text-decoration:none}
.si-sm{height:30px;padding:0 10px;font-size:12px}
.si-link{border:none;background:none;color:var(--au-brand-text);font:600 12px Rubik,sans-serif;cursor:pointer;padding:0;min-height:0}
.si-icon{background:none;cursor:pointer;min-height:0;width:34px;height:34px;border:1px solid var(--au-line);border-radius:9px;display:inline-flex;align-items:center;justify-content:center;color:var(--au-text2)}
.si-more-wrap{position:relative}
.si-menu{position:absolute;top:38px;inset-inline-end:0;z-index:20;min-width:220px;background:var(--au-pop);border:1px solid var(--au-line);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.18);padding:4px;display:flex;flex-direction:column}
.si-menu button,.si-menu a{display:flex;align-items:center;gap:9px;padding:9px 11px;border:none;background:none;border-radius:8px;color:var(--au-text);font:500 13px Rubik,sans-serif;cursor:pointer;text-align:start;text-decoration:none;min-height:0}
.si-menu button:hover,.si-menu a:hover{background:rgba(var(--ov),.06)}
.si-x{border:none;background:none;color:var(--au-text3);cursor:pointer;padding:4px;border-radius:7px;display:inline-flex;min-height:0}
.si-wa{flex:1;min-height:0;display:flex;flex-direction:column}
.si-wa>*{flex:1;min-height:0}
.si-wa .lcv-b{font-size:calc(14.2px * var(--si-z,1));line-height:calc(19px * var(--si-z,1))}
.si-msgs{flex:1;min-height:0;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:6px}
.si-day{display:flex;justify-content:center;margin:10px 0 4px;position:sticky;top:0;z-index:2;pointer-events:none}
.si-day span{font-size:12px;color:var(--au-text2);background:var(--au-pop);border:1px solid var(--au-line);border-radius:8px;padding:4px 11px}
.si-day.si-new span{background:#D9FDD3;color:#0B1B33;border-color:transparent;font-weight:700}
html[data-admin-theme=dark] .si-day.si-new span{background:#005C4B;color:#E9EDEF}
.si-bub{position:relative;max-width:min(560px,78%);padding:8px 12px 6px;border-radius:14px;font-size:calc(14px * var(--si-z,1));line-height:1.5;display:flex;flex-direction:column;gap:4px;white-space:pre-wrap;word-break:break-word;box-shadow:0 1px 1px rgba(0,0,0,.06)}
.si-bub.is-in{align-self:flex-start;background:var(--au-pop);border:1px solid var(--au-line)}
.si-bub.is-out{align-self:flex-end;background:#DCEBFF;color:#0B1B33}
html[data-admin-theme=dark] .si-bub.is-out{background:#1E3A5F;color:#E6EEF9}
.si-bub.is-pending{opacity:.6}
.si-bub.has-react{margin-bottom:14px}
.si-bub img{max-width:calc(260px * var(--si-z,1));border-radius:9px}
.si-bub small{align-self:flex-end;font-size:calc(10.5px * var(--si-z,1));opacity:.6}
.si-bub .wa-bub-btn{opacity:0;transition:opacity .12s}
.si-bub:hover .wa-bub-btn,.si-bub .wa-bub-btn[aria-expanded=true]{opacity:1}
@media (hover:none){.si-bub .wa-bub-btn{opacity:.55}}
.si-react{position:absolute;bottom:-12px;inset-inline-start:8px;font-style:normal;font-size:13px;background:var(--au-pop);border:1px solid var(--au-line);border-radius:999px;padding:1px 6px;line-height:1.3}
.si-tplwin{flex:none;height:min(460px,55%);border-top:1px solid var(--au-line);background:var(--au-pop);min-height:0;display:flex;flex-direction:column;overflow:hidden}
.si-tplwin>*{flex:1;min-height:0}
.si-chips{flex:none;padding:6px 14px 0;background:var(--au-pop);border-top:1px solid var(--au-line)}
.si-chips .si-muted{display:block;font-size:11px;margin:2px 0 4px}
.si-emoji{flex:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:2px;margin:0 14px;padding:6px;border:1px solid var(--au-line);border-radius:14px;background:var(--au-pop)}
.si-emoji button{height:38px;border:none;border-radius:9px;background:transparent;font-size:21px;cursor:pointer;min-height:0;padding:0;line-height:1}
.si-emoji button:hover{background:rgba(var(--ov),.06)}
.si-composer{display:flex;align-items:flex-end;gap:8px;padding:10px 14px;border-top:1px solid var(--au-line);background:var(--au-pop);flex:none}
.si-composer textarea{flex:1;min-height:42px;max-height:160px;resize:vertical;border:1px solid var(--au-line);border-radius:12px;padding:10px 12px;font:calc(14px * var(--si-z,1))/1.45 Rubik,sans-serif;background:var(--au-input,var(--au-pop));color:var(--au-text);outline:none}
.si-composer textarea:focus{border-color:var(--au-brand)}
.si-tplbtn{flex:none;display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 12px;border:1px solid var(--au-line);border-radius:12px;background:none;color:var(--au-text);font:600 13px Rubik,sans-serif;cursor:pointer;min-height:0}
.si-tplbtn[aria-pressed=true]{background:rgba(var(--brand-rgb),.1);border-color:rgba(var(--brand-rgb),.45)}
.si-iconb{width:42px;padding:0;justify-content:center;color:var(--au-text2)}
.si-send{display:inline-flex;align-items:center;gap:6px;height:42px;padding:0 16px;border:none;border-radius:12px;background:#0084FF;color:#fff;font:600 13.5px Rubik,sans-serif;cursor:pointer;min-height:0}
.si-send:disabled{opacity:.5;cursor:default}
.si-err{color:#DC2626;font-size:12.5px}
.si-warn{margin:10px 0;padding:10px 12px;border-radius:10px;background:rgba(217,119,6,.1);border:1px solid rgba(217,119,6,.3);color:var(--au-text);font-size:12.5px;line-height:1.6}
.si-warn code{font-size:12px}
.si-leadform{margin:10px 14px 0;padding:12px;border:1px solid rgba(var(--brand-rgb),.35);border-radius:12px;background:var(--au-pop);flex:none}
.si-lf-head{display:flex;align-items:center;gap:8px}
.si-lf-head b{flex:1;display:inline-flex;align-items:center;gap:7px;font-size:14.5px}
.si-lf-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px 12px;margin-top:10px}
.si-lf-grid label,.si-lf-wide{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:var(--au-text2)}
.si-lf-wide{grid-column:1/-1}
.si-lf-grid input,.si-lf-grid select,.si-lf-grid textarea{height:38px;border:1px solid var(--au-line);border-radius:9px;padding:0 10px;font:13.5px Rubik,sans-serif;background:var(--au-input,var(--au-pop));color:var(--au-text);outline:none;min-height:0}
.si-lf-grid select{appearance:auto}
.si-lf-grid textarea{height:auto;padding:8px 10px;resize:vertical}
.si-lf-foot{display:flex;gap:8px;margin-top:12px}
.si-acc-bg{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.42);display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px 16px}
.si-acc{width:min(680px,100%);max-height:88vh;overflow:auto;background:var(--au-pop);color:var(--au-text);border:1px solid var(--au-line);border-radius:16px;padding:16px 18px;box-shadow:0 24px 70px rgba(0,0,0,.3)}
.si-acc h4{display:flex;align-items:center;gap:8px;margin:18px 0 8px;font-size:13.5px;text-transform:none}
.si-sum{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.si-sum-pill{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;border:1px solid var(--au-line);font-size:12px;font-weight:600}
.si-sum-pill.is-ok{border-color:rgba(22,163,74,.4);background:rgba(22,163,74,.08)}
.si-sum-pill.is-warn{border-color:rgba(217,119,6,.4);background:rgba(217,119,6,.08)}
.si-pg{display:flex;align-items:flex-start;gap:12px;padding:11px 12px;border:1px solid var(--au-line);border-radius:12px;margin-bottom:7px}
.si-pg.is-off{opacity:.9;border-style:dashed}
.si-pg-pic{width:40px;height:40px;border-radius:10px;object-fit:cover;background:rgba(var(--ov),.08);flex:none;display:inline-flex;align-items:center;justify-content:center}
.si-pg-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.si-pg-main b{display:flex;align-items:center;gap:7px;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.si-pg-rows{display:flex;flex-wrap:wrap;gap:4px 14px}
.si-pg-row{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--au-text)}
.si-pg-row .si-muted{margin:0}
.si-pill{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 9px;background:rgba(217,119,6,.13);color:#B45309}
.si-pill.is-ok{background:rgba(22,163,74,.13);color:#15803D}
.si-tag{font-style:normal;font-size:10.5px;font-weight:700;border-radius:6px;padding:1px 6px;background:rgba(var(--brand-rgb),.12);color:var(--au-brand-text)}
.si-more{margin-top:8px;font-size:12.5px;border:1px solid var(--au-line);border-radius:12px;padding:9px 12px}
.si-more summary{cursor:pointer;color:var(--au-brand-text);font-weight:600;display:flex;align-items:center;gap:6px}
.si-steps{margin:8px 0 4px;padding-inline-start:20px;font-size:12.5px;line-height:1.65;color:var(--au-text);display:flex;flex-direction:column;gap:10px}
.si-steps li b{display:block;font-size:13px}
.si-steps li .si-muted{margin:2px 0 6px}
.si-imp{margin-bottom:10px}
.si-imp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.si-spin{animation:siSpin 1s linear infinite}
@keyframes siSpin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.si-spin{animation:none}}
.si-fwd{width:min(520px,100%)}
.si-fwd-list{max-height:52vh;overflow:auto;margin-top:8px;padding:2px}
.si-fwd-list .si-row.is-on{background:rgba(var(--brand-rgb),.12)}
.si-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:inline-flex;align-items:center;gap:7px;background:#15803D;color:#fff;border-radius:999px;padding:9px 16px;font-size:13px;font-weight:600;z-index:3100}
@media (max-width:820px){.si-list{width:100%!important;border:none}.si-list.has-sel{display:none}.si-conv{display:none}.si-list.has-sel+.si-spl+.si-conv{display:flex}.si-spl{display:none}.si-back{display:inline-flex}.si-lf-grid{grid-template-columns:1fr}.si-zoom{display:none}.si-tplbtn span{display:none}
  .si-conv-head{flex-wrap:nowrap;padding:8px 10px;gap:8px}.si-who small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.si-conv-head .si-face{width:40px!important;height:40px!important}.si-who-name{font-size:15px}.si-who-link{display:none}
  .si-tools{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;gap:8px;padding:8px 12px}.si-tools::-webkit-scrollbar{display:none}.si-tools>*{flex:none}.si-tools-sp{display:none}.si-tools .si-sm{height:32px}}
`
