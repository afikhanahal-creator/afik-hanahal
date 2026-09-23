// ── WhatsApp automations: shared, dependency-free logic ─────────────────────────
// Imported by the server engine (lib/automations.js) AND by the admin panel (src/AutomationsTab.jsx,
// src/GreenAPIChat.jsx), so templates, placeholders, quiet hours and reply detection behave the same
// in the browser preview and in the message that is actually sent.
//
// Every template has a Hebrew text and an English text: a lead who came from the English site
// (crm_data.origin.lang === 'en') gets the English version.

export const STAGES = ['new', 'contacted', 'discovery', 'negotiating', 'won', 'lost']

// Placeholders the office can use in any template
export const VARIABLES = [
  { key: 'name',     he: 'שם פרטי',          en: 'First name' },
  { key: 'fullName', he: 'שם מלא',           en: 'Full name' },
  { key: 'property', he: 'הנכס שהתעניין בו', en: 'Property of interest' },
  { key: 'location', he: 'מיקום הנכס',       en: 'Property location' },
  { key: 'agent',    he: 'שם הנציג',         en: 'Agent name' },
  { key: 'phone',    he: 'טלפון המשרד',      en: 'Office phone' },
  { key: 'site',     he: 'אתר',              en: 'Website' },
  { key: 'sellLink', he: 'קישור לטופס נכס',  en: 'Property form link' },
]

export const CATEGORIES = [
  { id: 'welcome',  he: 'פנייה חדשה',     en: 'New inquiry',    color: '#22C55E', icon: '👋' },
  { id: 'followup', he: 'לא ענה',         en: 'No reply',       color: '#F5A623', icon: '⏰' },
  { id: 'progress', he: 'רוצה להתקדם',    en: 'Moving forward', color: '#0073EA', icon: '🚀' },
  { id: 'closing',  he: 'לא מעוניין',     en: 'Not interested', color: '#7D7D7D', icon: '🙏' },
  { id: 'deal',     he: 'עסקה וסגירה',    en: 'Deal & closing', color: '#A25DDC', icon: '🤝' },
  { id: 'general',  he: 'כללי',           en: 'General',        color: '#8490D8', icon: '💬' },
]

// Built-in library. The office can edit any of them (edits are saved in the settings) or add new ones.
export const DEFAULT_TEMPLATES = [
  { id: 'welcome', cat: 'welcome', he_title: 'ברוכים הבאים – ליד חדש', en_title: 'Welcome – new lead',
    he: 'היי {name} 👋\nתודה שהשארת פרטים!\nראינו את הפנייה שלך\n\nמתי נוח לך לדבר? נשמח לתאם שיחה\n\nצוות אפיק הנחל',
    en: 'Hi {name} 👋\nThank you for getting in touch!\nWe received your inquiry.\n\nWhen would be a good time to talk? We would be happy to set up a call.\n\nThe Afik Hanahal team' },
  { id: 'welcome_prop', cat: 'welcome', he_title: 'ברוכים הבאים – התעניין בנכס', en_title: 'Welcome – asked about a property',
    he: 'היי {name} 👋\nתודה על ההתעניינות ב{property}!\nאשמח לשלוח לך את כל הפרטים, תוכניות ומחירים.\n\nמתי נוח לך לשיחה קצרה?\n\n{agent} · אפיק הנחל',
    en: 'Hi {name} 👋\nThank you for your interest in {property}!\nI would be glad to send you the full details, plans and prices.\n\nWhen would suit you for a short call?\n\n{agent} · Afik Hanahal' },
  { id: 'after_hours', cat: 'welcome', he_title: 'מחוץ לשעות הפעילות', en_title: 'Outside office hours',
    he: 'היי {name}, תודה שפנית לאפיק הנחל 🙏\nקיבלנו את ההודעה ונחזור אליך כבר מחר בבוקר.\nלשיחה דחופה: {phone}',
    en: 'Hi {name}, thank you for contacting Afik Hanahal 🙏\nWe received your message and will get back to you first thing tomorrow.\nFor anything urgent: {phone}' },
  { id: 'nr1', cat: 'followup', he_title: 'לא ענה – תזכורת ראשונה', en_title: 'No reply – first reminder',
    he: 'היי {name}, רק מוודא שההודעה שלנו הגיעה 🙂\nאשמח לעזור עם כל שאלה על {property}.\nמתי נוח לדבר?',
    en: 'Hi {name}, just making sure our message reached you 🙂\nHappy to help with any question about {property}.\nWhen is a good time to talk?' },
  { id: 'nr2', cat: 'followup', he_title: 'לא ענה – ערך נוסף', en_title: 'No reply – added value',
    he: 'היי {name} 👋\nיש לנו כמה הזדמנויות חדשות בשרון שעדיין לא פורסמו.\nרוצה שאשלח לך סקירה קצרה? אפשר לענות פשוט "כן".',
    en: 'Hi {name} 👋\nWe have a few new opportunities in the Sharon region that are not published yet.\nWould you like a short overview? Just reply "yes".' },
  { id: 'nr3', cat: 'followup', he_title: 'לא ענה – ניסיון אחרון', en_title: 'No reply – last try',
    he: 'היי {name}, לא רוצים להציק 🙏\nנשמור את הפרטים שלך, ואם תרצה לחזור לזה בהמשך – אנחנו כאן: {phone}\nבהצלחה!',
    en: 'Hi {name}, we do not want to bother you 🙏\nWe will keep your details, and whenever you want to pick this up again we are here: {phone}\nAll the best!' },
  { id: 'missed_call', cat: 'followup', he_title: 'ניסינו להתקשר', en_title: 'We tried to call',
    he: 'היי {name}, ניסיתי להשיג אותך בטלפון ולא הצלחתי 📞\nמתי יהיה לך נוח שנדבר?',
    en: 'Hi {name}, I tried to reach you by phone 📞\nWhen would be a convenient time to talk?' },
  { id: 'positive', cat: 'progress', he_title: 'רוצה להתקדם – תיאום שיחה', en_title: 'Moving forward – book a call',
    he: 'מעולה {name}! 🙌\nבוא נקבע שיחה או סיור בשטח.\nאיזה יום ושעה נוחים לך השבוע?',
    en: 'Great, {name}! 🙌\nLet us book a call or a site visit.\nWhich day and time suit you this week?' },
  { id: 'meeting_confirm', cat: 'progress', he_title: 'אישור פגישה', en_title: 'Meeting confirmation',
    he: 'היי {name}, מאשר את הפגישה שלנו ✅\nאם משהו משתנה, פשוט תכתוב כאן.\nנתראה!',
    en: 'Hi {name}, confirming our meeting ✅\nIf anything changes, just write here.\nSee you soon!' },
  { id: 'docs', cat: 'progress', he_title: 'מסמכים להמשך', en_title: 'Documents for next step',
    he: 'היי {name}, כדי להתקדם נצטרך:\n• צילום ת"ז\n• נסח טאבו (אם יש)\n• אישור עקרוני למשכנתא (אם רלוונטי)\nאפשר לשלוח כאן בוואטסאפ 📎',
    en: 'Hi {name}, to move forward we will need:\n• ID copy\n• Tabu registration extract (if available)\n• Mortgage pre-approval (if relevant)\nYou can send them right here on WhatsApp 📎' },
  { id: 'negotiation', cat: 'progress', he_title: 'במו"מ – עדכון', en_title: 'Negotiation – update',
    he: 'היי {name}, רציתי לעדכן שאנחנו מתקדמים מול הצד השני לגבי {property}.\nאעדכן אותך ברגע שיש תשובה 🙏',
    en: 'Hi {name}, a quick update: we are moving forward with the other side regarding {property}.\nI will let you know as soon as there is an answer 🙏' },
  { id: 'closing_polite', cat: 'closing', he_title: 'לא מעוניין – סגירה מנומסת', en_title: 'Not interested – polite close',
    he: 'תודה על העדכון {name} 🙏\nלא נשלח יותר הודעות.\nאם בעתיד תחפש נכס או קרקע בשרון – נשמח לעזור.',
    en: 'Thank you for letting us know, {name} 🙏\nWe will not send further messages.\nIf you ever look for a property or land in the Sharon region, we would be glad to help.' },
  { id: 'reengage', cat: 'closing', he_title: 'חזרה ללקוח אחרי תקופה', en_title: 'Re-engage after a while',
    he: 'היי {name}, מזמן לא דיברנו 🙂\nעדיין מחפש נכס? נכנסו אלינו כמה נכסים חדשים שיכולים להתאים לך.',
    en: 'Hi {name}, it has been a while 🙂\nStill looking for a property? A few new listings came in that could suit you.' },
  { id: 'won_thanks', cat: 'deal', he_title: 'אחרי סגירה – תודה', en_title: 'After closing – thank you',
    he: 'מזל טוב {name}! 🎉\nתודה שבחרת באפיק הנחל. היה לנו כבוד ללוות אותך.\nאם תרצה לשתף חוויה, זה עוזר לנו מאוד 🙏',
    en: 'Congratulations, {name}! 🎉\nThank you for choosing Afik Hanahal. It was an honour to be with you all the way.\nIf you would like to share your experience, it helps us a lot 🙏' },
  { id: 'seller_invite', cat: 'general', he_title: 'בעל נכס – טופס קליטה', en_title: 'Owner – intake form',
    he: 'היי {name}, כדי שנוכל לשווק את הנכס שלך בצורה הכי טובה, אפשר למלא כאן את כל הפרטים והתמונות (5 דקות):\n{sellLink}',
    en: 'Hi {name}, so we can market your property as well as possible, you can fill in all the details and photos here (5 minutes):\n{sellLink}' },
  { id: 'holiday', cat: 'general', he_title: 'ברכת חג', en_title: 'Holiday greeting',
    he: 'חג שמח {name}! 🌼\nמאחלים לך ולמשפחה שנה של בית, צמיחה ושקט.\nצוות אפיק הנחל',
    en: 'Happy holidays, {name}! 🌼\nWishing you and your family a year of home, growth and peace.\nThe Afik Hanahal team' },
]

export const DEFAULT_CONFIG = {
  version: 1,
  enabled: true,
  // Automations only act on leads / replies / stage changes that happen after this moment,
  // so switching the system on never messages the whole historical list.
  installedAt: '2026-09-23T00:00:00.000Z',
  vars: { agent: 'צוות אפיק הנחל', en_agent: 'The Afik Hanahal team', phone: '055-981-1814', site: 'https://www.afikhanahal.co.il', sellLink: 'https://www.afikhanahal.co.il/newproperty' },
  // Scheduled messages (follow-ups, re-engagement) only go out inside these hours, Israel time.
  // Day 0 = Sunday. Saturday is closed.
  quiet: { enabled: true, days: { 0: [9, 20], 1: [9, 20], 2: [9, 20], 3: [9, 20], 4: [9, 20], 5: [9, 13], 6: null } },
  templates: {},           // { [id]: { he, en, he_title, en_title, cat } } overrides + custom templates
  deletedTemplates: [],
  rules: {
    // mode: 'off' | 'suggest' (waits in the approval queue) | 'auto' (sent by the system)
    welcome: { mode: 'auto', templateId: 'welcome', propTemplateId: 'welcome_prop' },
    noReply: { mode: 'suggest', stages: ['new', 'contacted'], steps: [
      { hours: 24, templateId: 'nr1' },
      { hours: 48, templateId: 'nr2' },
      { hours: 96, templateId: 'nr3' },
    ] },
    replies: {
      mode: 'auto',               // detect replies, notify the team, stop follow-ups
      notifyTeam: true,
      negative: ['לא תודה', 'לא מעוניין', 'לא מעוניינת', 'לא רלוונטי', 'כבר לא רלוונטי', 'תסירו', 'הסר', 'הסירו', 'להסיר', 'אל תשלחו', 'תפסיקו', 'כבר קניתי', 'כבר מצאתי', 'סגרתי כבר', 'no thanks', 'not interested', 'stop', 'unsubscribe', 'remove me'],
      positive: ['מעוניין', 'מעוניינת', 'אשמח', 'כן', 'בטח', 'בשמחה', 'רוצה לראות', 'מתי אפשר', 'אפשר לתאם', 'לתאם', 'תתקשרו', 'תתקשר', 'תחזרו אליי', 'להתקדם', 'לקבוע', 'פגישה', 'סיור', 'yes', 'interested', 'call me', 'schedule', 'lets talk', "let's talk"],
      negativeMode: 'suggest', negativeTemplateId: 'closing_polite', negativeMoveTo: '',
      positiveMode: 'suggest', positiveTemplateId: 'positive', positiveMoveTo: '',
    },
    stage: {
      contacted:   { mode: 'off',     templateId: 'missed_call' },
      discovery:   { mode: 'off',     templateId: 'docs' },
      negotiating: { mode: 'off',     templateId: 'negotiation' },
      won:         { mode: 'suggest', templateId: 'won_thanks' },
      lost:        { mode: 'off',     templateId: 'closing_polite' },
    },
    reengage: { mode: 'suggest', days: 45, templateId: 'reengage' },
  },
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v)
function deepMerge(base, over) {
  if (!isObj(over)) return base
  const out = { ...base }
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : v
  return out
}
export function mergeConfig(saved) {
  return deepMerge(DEFAULT_CONFIG, isObj(saved) ? saved : {})
}

// Full template list: built-ins with the office's edits applied, plus custom ones
export function templateList(cfg) {
  const over = cfg?.templates || {}
  const gone = new Set(cfg?.deletedTemplates || [])
  const base = DEFAULT_TEMPLATES.filter(t => !gone.has(t.id)).map(t => ({ ...t, ...(over[t.id] || {}), builtIn: true }))
  const custom = Object.entries(over).filter(([id]) => !DEFAULT_TEMPLATES.some(t => t.id === id) && !gone.has(id)).map(([id, t]) => ({ id, cat: 'general', ...t, builtIn: false }))
  return [...base, ...custom]
}
export function getTemplate(cfg, id) {
  return templateList(cfg).find(t => t.id === id) || null
}

export function intlPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('972')) return d
  if (d.startsWith('0')) return '972' + d.slice(1)
  return d
}

// Lead language: the English site stores origin.lang = 'en'
export function leadLang(lead) {
  const l = lead?.crm_data?.origin?.lang || lead?.origin?.lang || lead?.lang || ''
  return String(l).toLowerCase().startsWith('en') ? 'en' : 'he'
}

// Fill a template for one lead. Missing values collapse gracefully ("ב{property}" → "בנכס").
// opts.highlight wraps every filled-in value in \uE000…\uE001 (the editor preview underlines them)
export function renderTemplate(tpl, lead = {}, cfg = DEFAULT_CONFIG, forceLang, opts = {}) {
  if (!tpl) return ''
  const lang = forceLang || leadLang(lead)
  const text = (lang === 'en' ? (tpl.en || tpl.he) : (tpl.he || tpl.en)) || ''
  const fullName = String(lead.name || '').trim()
  const first = fullName.split(/\s+/)[0] || ''
  const v = cfg?.vars || {}
  const prop = lead.prop_title || lead.propTitle || ''
  const values = {
    name: first || (lang === 'en' ? 'there' : ''),
    fullName: fullName || first,
    property: prop || (lang === 'en' ? 'the property' : 'הנכס'),
    location: lead.prop_location || lead.propLocation || (lang === 'en' ? 'the Sharon region' : 'השרון'),
    agent: lang === 'en' ? (v.en_agent || v.agent || '') : (v.agent || ''),
    phone: v.phone || '',
    site: v.site || '',
    sellLink: v.sellLink || '',
  }
  return text
    .replace(/\{(\w+)\}/g, (m, k) => (k in values ? (opts.highlight && values[k] ? `\uE000${values[k]}\uE001` : values[k]) : m))
    .replace(/היי\s+,/g, 'היי,').replace(/ {2,}/g, ' ').trim()
}

// Placeholders in a text that the renderer does not know (they would be sent as typed)
export function unknownPlaceholders(text) {
  const known = new Set(VARIABLES.map(v => v.key))
  return [...new Set([...String(text || '').matchAll(/\{(\w+)\}/g)].map(m => m[1]).filter(k => !known.has(k)))]
}

// ── Quiet hours (Israel time) ──────────────────────────────────────────────────
export function israelNow(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
    .formatToParts(d).map(p => [p.type, p.value]))
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  return { day, hour: Number(parts.hour) + Number(parts.minute) / 60 }
}
export function isSendWindow(cfg, d = new Date()) {
  if (!cfg?.quiet?.enabled) return true
  const { day, hour } = israelNow(d)
  const w = cfg.quiet.days?.[day]
  return Array.isArray(w) && hour >= w[0] && hour < w[1]
}

// First moment at or after `from` that is inside the sending hours (null when every day is closed).
// Scans in 15-minute steps for up to 8 days — cheap, and correct across DST changes.
export function nextSendWindow(cfg, from = new Date()) {
  if (!cfg?.quiet?.enabled) return new Date(from)
  const days = cfg.quiet.days || {}
  if (![0, 1, 2, 3, 4, 5, 6].some(d => Array.isArray(days[d]) && days[d][1] > days[d][0])) return null
  let t = new Date(from).getTime()
  if (isSendWindow(cfg, new Date(t))) return new Date(t)
  t = Math.ceil(t / 900000) * 900000
  for (let i = 0; i < 8 * 96; i++, t += 900000) if (isSendWindow(cfg, new Date(t))) return new Date(t)
  return null
}

// 9.5 → "09:30"
export const fmtHour = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` }

// Today's status and the next `count` sending windows, Israel time
export function nextWindows(cfg, now = new Date(), count = 3) {
  if (!cfg?.quiet?.enabled) return { open: true, unlimited: true, windows: [] }
  const days = cfg.quiet.days || {}
  const { day, hour } = israelNow(now)
  const windows = []
  let open = false, closesAt = null
  for (let i = 0; i < 8 && windows.length < count; i++) {
    const d = (day + i) % 7, w = days[d]
    if (!Array.isArray(w) || !(w[1] > w[0])) continue
    if (i === 0 && hour >= w[1]) continue
    if (i === 0 && hour >= w[0]) { open = true; closesAt = w[1] }
    windows.push({ offset: i, day: d, start: w[0], end: w[1], current: i === 0 && hour >= w[0] })
  }
  return { open, closesAt, windows }
}

// Point every rule that uses template `fromId` at `toId` (used before deleting a template)
export function replaceTemplateRefs(cfg, fromId, toId) {
  const R = cfg.rules || {}
  if (R.welcome?.templateId === fromId) R.welcome.templateId = toId
  if (R.welcome?.propTemplateId === fromId) R.welcome.propTemplateId = toId
  ;(R.noReply?.steps || []).forEach(st => { if (st.templateId === fromId) st.templateId = toId })
  if (R.replies?.positiveTemplateId === fromId) R.replies.positiveTemplateId = toId
  if (R.replies?.negativeTemplateId === fromId) R.replies.negativeTemplateId = toId
  Object.values(R.stage || {}).forEach(r => { if (r?.templateId === fromId) r.templateId = toId })
  if (R.reengage?.templateId === fromId) R.reengage.templateId = toId
  return cfg
}

// Which keyword decided the intent (for the reply tester)
export function matchedKeyword(text, cfg = DEFAULT_CONFIG) {
  const t = norm(text), r = cfg?.rules?.replies || DEFAULT_CONFIG.rules.replies
  for (const list of [r.negative, r.positive]) for (const k of list || []) { const n = norm(k); if (n.trim() && t.includes(n)) return k }
  return null
}

// Where a template is used (so the office sees the impact of editing or deleting it)
export function templateUsage(cfg, id) {
  const R = cfg?.rules || {}
  const out = []
  if (R.welcome?.templateId === id) out.push({ key: 'welcome', rule: 'welcome', mode: R.welcome.mode, he: 'הודעת פתיחה', en: 'Welcome message' })
  if (R.welcome?.propTemplateId === id) out.push({ key: 'welcome_prop', rule: 'welcome', mode: R.welcome.mode, he: 'הודעת פתיחה – התעניין בנכס', en: 'Welcome – asked about a property' })
  ;(R.noReply?.steps || []).forEach((st, i) => { if (st.templateId === id) out.push({ key: `noreply:${i + 1}`, rule: 'noReply', mode: R.noReply.mode, he: `לא ענה – תזכורת ${i + 1}`, en: `No reply – reminder ${i + 1}` }) })
  if (R.replies?.positiveTemplateId === id) out.push({ key: 'reply:positive', rule: 'replies', mode: R.replies.mode === 'off' ? 'off' : R.replies.positiveMode, he: 'רוצה להתקדם', en: 'Wants to move forward' })
  if (R.replies?.negativeTemplateId === id) out.push({ key: 'reply:negative', rule: 'replies', mode: R.replies.mode === 'off' ? 'off' : R.replies.negativeMode, he: 'ענה "לא תודה"', en: 'Replied "no thanks"' })
  Object.entries(R.stage || {}).forEach(([st, r]) => { if (r?.templateId === id) out.push({ key: `stage:${st}`, rule: 'stage', mode: r.mode, he: `שינוי שלב – ${st}`, en: `Stage change – ${st}`, stage: st }) })
  if (R.reengage?.templateId === id) out.push({ key: 'reengage', rule: 'reengage', mode: R.reengage.mode, he: 'חזרה ללקוח', en: 'Re-engagement' })
  return out
}

// ── Reply intent ───────────────────────────────────────────────────────────────
const norm = s => ' ' + String(s || '').toLowerCase().replace(/[^\p{L}\p{N}']+/gu, ' ').replace(/\s+/g, ' ').trim() + ' '
export function classifyReply(text, cfg = DEFAULT_CONFIG) {
  const t = norm(text)
  if (t.trim() === '') return null
  const r = cfg?.rules?.replies || DEFAULT_CONFIG.rules.replies
  const has = list => (list || []).some(k => { const n = norm(k); return n.trim() && t.includes(n) })
  if (has(r.negative)) return 'negative'     // "לא, תודה" wins over "תודה"
  if (has(r.positive)) return 'positive'
  return 'reply'
}

export const RULE_LABELS = {
  welcome:  { he: 'הודעת פתיחה לליד חדש', en: 'Welcome message to a new lead' },
  noreply:  { he: 'מעקב – לא ענה', en: 'Follow-up – no reply' },
  positive: { he: 'ענה בחיוב – רוצה להתקדם', en: 'Positive reply – wants to move forward' },
  negative: { he: 'ענה "לא תודה"', en: 'Replied "no thanks"' },
  stage:    { he: 'שינוי שלב בלוח', en: 'Board stage change' },
  reengage: { he: 'חזרה ללקוח אחרי תקופה', en: 'Re-engagement after a while' },
  manual:   { he: 'שליחה ידנית', en: 'Manual send' },
  test:     { he: 'הודעת בדיקה', en: 'Test message' },
}
export function ruleKind(ruleKey) {
  return String(ruleKey || '').split(':')[0]
}
