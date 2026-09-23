// Lead intelligence — deterministic, explainable scoring from everything the system knows about a lead.
// Pure functions (no I/O), shared by the server (api/meta.js → lead-analyze) and the admin panel.
//
// dossier = {
//   lead:     { name, phone, email, msg, propTitle, propLocation, source, campaignName, formName, formAnswers:[{q,a}],
//               origin:{ page, referrer, utm, lang }, ts, leadStatus, budget, dealType, timeline, financing, area,
//               rooms, priority, notes:[{ text, ts }], auto:{ intent, optOut } },
//   chat:     [{ dir: 'in' | 'out', text, ts }],     // WhatsApp history, oldest first
//   repeats:  number,                              // other inquiries from the same phone
//   property: { title, price, category, location } | null,   // listing the lead asked about
//   now:      ms timestamp
// }

const DAY = 864e5

// ── Text signal extraction ─────────────────────────────────────────────────────
const norm = s => String(s || '').replace(/[\u0591-\u05C7]/g, '').toLowerCase()

// "2.5 מיליון" · "₪1,800,000" · "1.8M" · "800 אלף" · "3 מ׳" → shekels
export function parseBudget(text) {
  const t = norm(text).replace(/,(?=\d{3})/g, '')
  let best = 0
  const add = v => { if (v >= 100000 && v <= 200000000 && v > best) best = v }
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(מיליון|מליון|מיל'?|מ['׳]|m\b|mil|million)/g)) add(parseFloat(m[1]) * 1e6)
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(אלף|k\b|thousand)/g)) add(parseFloat(m[1]) * 1e3)
  // bare amounts: 6–9 digits, not starting with 0 and not part of a longer number (phone numbers start with 0 / 972)
  for (const m of t.matchAll(/(?<![\d.])([1-9]\d{5,8})(?![\d.])/g)) add(parseInt(m[1], 10))
  return best || null
}

const RX = {
  urgentNow: /(מיידי|דחוף|בהקדם|השבוע|היום|מחר|asap|urgent|this week|immediately|כמה שיותר מהר)/,
  urgentSoon: /(החודש|בחודש הקרוב|חודשיים|3 חודשים|שלושה חודשים|עד סוף השנה|next month|within \d+ months|soon)/,
  later: /(בעתיד|שנה הבאה|בשנה|לא דחוף|רק בודק|רק מתעניין|just looking|next year|no rush)/,
  financing: /(משכנתא|משכנתה|הון עצמי|מזומן|אישור עקרוני|מימון|הלוואה|mortgage|cash|pre.?approv|down payment|equity)/,
  cash: /(מזומן|הון עצמי מלא|ללא משכנתא|cash buyer|all cash)/,
  visit: /(לראות|סיור|לבקר|פגישה|להיפגש|ביקור|להגיע|viewing|visit|tour|meet|schedule)/,
  question: /[?؟]|(כמה|מה המחיר|מתי|האם|איפה|how much|when|is it|what)/,
  sell: /(למכור|מכירה|מוכר|מוכרים|להעריך|הערכת שווי|שמאות|sell|selling|valuation)/,
  buy: /(לקנות|קנייה|רכישה|לרכוש|מחפש|מחפשים|buy|buying|purchase|looking for)/,
  rent: /(לשכור|שכירות|להשכיר|rent|lease|tenant)/,
  invest: /(השקעה|תשואה|להשקיע|יזם|קבוצת רכישה|invest|yield|roi)/,
  negative: /(לא מעוניין|לא רלוונטי|תוריד|תסיר|אל תשלח|טעות|not interested|stop|unsubscribe|wrong number)/,
  positive: /(מעוניין|מעוניינת|אשמח|בשמחה|כן|מתאים|נשמע טוב|interested|sounds good|yes please|let's)/,
}
const hit = (rx, s) => rx.test(norm(s))

export function extractSignals(lead = {}, chat = []) {
  const inbound = chat.filter(m => m.dir === 'in').map(m => m.text || '').join('\n')
  const form = (lead.formAnswers || []).map(x => `${x.q}: ${x.a}`).join('\n')
  const all = [lead.msg, form, inbound, (lead.notes || []).map(n => n.text).join('\n')].filter(Boolean).join('\n')
  const budget = Number(lead.budget) > 0 ? Number(lead.budget) : parseBudget(all)
  const dealType = lead.dealType || (hit(RX.sell, all) ? 'sell' : hit(RX.rent, all) ? 'rent' : hit(RX.invest, all) ? 'invest' : hit(RX.buy, all) ? 'buy' : '')
  const timeline = lead.timeline || (hit(RX.urgentNow, all) ? 'now' : hit(RX.urgentSoon, all) ? 'soon' : hit(RX.later, all) ? 'later' : '')
  const financing = lead.financing || (hit(RX.cash, all) ? 'cash' : hit(RX.financing, all) ? 'mortgage' : '')
  return {
    text: all, budget, dealType, timeline, financing,
    wantsVisit: hit(RX.visit, all), asksQuestion: hit(RX.question, `${lead.msg || ''}\n${inbound}`),
    negative: hit(RX.negative, inbound), positive: hit(RX.positive, inbound),
    msgLen: String(lead.msg || '').trim().length,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const digits = p => String(p || '').replace(/\D/g, '')
export function phoneInfo(p) {
  let d = digits(p)
  if (d.startsWith('972')) d = '0' + d.slice(3)
  const mobile = /^05\d{8}$/.test(d), landline = /^0[2-9]\d{7}$/.test(d)
  return { valid: mobile || landline, mobile, local: d }
}
const validEmail = e => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(e || '').trim())
const fullName = n => String(n || '').trim().split(/\s+/).filter(w => /\p{L}/u.test(w)).length >= 2
const parsePrice = v => { const n = Number(String(v || '').replace(/[^\d.]/g, '')); return n > 1000 ? n : null }

function sourceKind(lead) {
  const s = String(lead.source || '').toLowerCase()
  if (/meta|facebook|fb|instagram/.test(s) || String(lead.id || '').startsWith('meta_') || lead.leadgen_id) return 'meta'
  if (/whatsapp/.test(s)) return 'whatsapp'
  if (/phone|call/.test(s)) return 'phone'
  if (/referral|friend|המלצ/.test(s)) return 'referral'
  if (/^page_|contact|form|website|site/.test(s) || !s) return 'website'
  return 'other'
}

// ── Scoring ────────────────────────────────────────────────────────────────────
// Each factor: { key, group, points, he, en } — points are signed, the sum (from a base of 20) is clamped to 0–100.
export function scoreLead(dossier = {}) {
  const { lead = {}, chat = [], repeats = 0, property = null } = dossier
  const now = dossier.now || Date.now()
  const s = extractSignals(lead, chat)
  const f = []
  const add = (group, key, points, he, en) => { if (points) f.push({ group, key, points, he, en }) }

  // 1 · Contactability
  const ph = phoneInfo(lead.phone)
  if (!ph.valid) add('contact', 'phone_invalid', -12, 'מספר טלפון לא תקין', 'Invalid phone number')
  else add('contact', 'phone_ok', ph.mobile ? 6 : 4, ph.mobile ? 'נייד תקין' : 'טלפון קווי תקין', ph.mobile ? 'Valid mobile' : 'Valid landline')
  if (validEmail(lead.email)) add('contact', 'email', 3, 'השאיר אימייל', 'Left an email')
  if (fullName(lead.name)) add('contact', 'full_name', 2, 'שם מלא', 'Full name given')

  // 2 · Intent & clarity
  if (s.msgLen >= 60) add('intent', 'msg_detailed', 6, 'הודעה מפורטת', 'Detailed message')
  else if (s.msgLen >= 15) add('intent', 'msg_short', 3, 'כתב הודעה', 'Wrote a message')
  if (lead.propTitle || lead.propLocation) add('intent', 'specific_property', 5, 'התעניין בנכס מסוים', 'Asked about a specific property')
  if (s.budget) add('intent', 'budget', 6, 'ציין תקציב', 'Stated a budget')
  if (s.timeline === 'now') add('intent', 'urgent', 8, 'דחיפות גבוהה (מיידי / השבוע)', 'High urgency (now / this week)')
  else if (s.timeline === 'soon') add('intent', 'soon', 4, 'מתכנן בחודשים הקרובים', 'Planning within months')
  else if (s.timeline === 'later') add('intent', 'later', -6, 'לא דחוף / רק בודק', 'Not urgent / just looking')
  if (s.financing === 'cash') add('intent', 'cash', 7, 'הון עצמי / מזומן', 'Cash / full equity')
  else if (s.financing) add('intent', 'financing', 4, 'מדבר על מימון / משכנתא', 'Talks about financing')
  if (s.wantsVisit) add('intent', 'visit', 6, 'מבקש לראות / להיפגש', 'Wants a viewing / meeting')
  if (s.dealType === 'sell') add('intent', 'seller', 4, 'בעל נכס שרוצה למכור (בלעדיות פוטנציאלית)', 'Owner wants to sell (potential exclusive)')
  if ((lead.formAnswers || []).length >= 2) add('intent', 'form_answers', 3, 'ענה על שאלות הטופס', 'Answered the form questions')

  // 3 · Engagement (WhatsApp + automations)
  const inb = chat.filter(m => m.dir === 'in'), out = chat.filter(m => m.dir === 'out')
  if (inb.length >= 6) add('engage', 'wa_many', 16, `שיחה פעילה (${inb.length} הודעות ממנו)`, `Active conversation (${inb.length} messages)`)
  else if (inb.length >= 3) add('engage', 'wa_some', 11, `ענה בוואטסאפ (${inb.length} הודעות)`, `Replied on WhatsApp (${inb.length} messages)`)
  else if (inb.length >= 1) add('engage', 'wa_one', 7, 'ענה בוואטסאפ', 'Replied on WhatsApp')
  else if (out.length >= 2) add('engage', 'wa_silent', -8, `לא ענה ל-${out.length} הודעות`, `No reply to ${out.length} messages`)
  const firstOut = out[0]?.ts, firstInAfter = firstOut ? inb.find(m => m.ts > firstOut)?.ts : null
  if (firstOut && firstInAfter && firstInAfter - firstOut < 3600e3) add('engage', 'fast_reply', 5, 'ענה תוך פחות משעה', 'Replied within an hour')
  const lastIn = inb.length ? inb[inb.length - 1].ts : 0
  if (lastIn && now - lastIn < 2 * DAY) add('engage', 'recent_reply', 6, 'היה בקשר ב-48 השעות האחרונות', 'In touch in the last 48 hours')
  const intent = lead.auto?.intent || (s.negative ? 'negative' : s.positive ? 'positive' : '')
  if (lead.auto?.optOut) add('engage', 'opt_out', -45, 'ביקש לא לקבל הודעות', 'Asked not to be messaged')
  else if (intent === 'negative') add('engage', 'said_no', -35, 'השיב "לא מעוניין"', 'Replied "not interested"')
  else if (intent === 'positive') add('engage', 'said_yes', 10, 'השיב בחיוב', 'Replied positively')

  // 4 · Source & history
  const src = sourceKind(lead)
  const SRC = { website: [6, 'פנה דרך האתר', 'Came through the website'], referral: [8, 'הגיע בהמלצה', 'Referral'], whatsapp: [6, 'פנה בוואטסאפ', 'Reached out on WhatsApp'], phone: [7, 'התקשר בעצמו', 'Called in'], meta: [2, 'טופס לידים בפייסבוק / אינסטגרם', 'Facebook / Instagram lead form'], other: [2, 'מקור אחר', 'Other source'] }
  add('source', `src_${src}`, SRC[src][0], SRC[src][1], SRC[src][2])
  if (repeats >= 1) add('source', 'repeat', Math.min(4 + repeats * 2, 10), `פנה ${repeats + 1} פעמים`, `Inquired ${repeats + 1} times`)
  if (lead.origin?.utm?.utm_source && src === 'website') add('source', 'paid_click', 1, `הגיע מקמפיין (${lead.origin.utm.utm_source})`, `From a campaign (${lead.origin.utm.utm_source})`)

  // 5 · Pipeline stage & freshness
  const STAGE = { new: 0, contacted: 4, discovery: 9, negotiating: 16, won: 25, lost: -18 }
  const st = lead.leadStatus || 'new'
  if (STAGE[st]) add('stage', `stage_${st}`, STAGE[st], { contacted: 'בקשר', discovery: 'בשלב גילוי צרכים', negotiating: 'במשא ומתן', won: 'עסקה נסגרה', lost: 'סומן "ללא מענה"' }[st] || st, { contacted: 'Contacted', discovery: 'Discovery stage', negotiating: 'Negotiating', won: 'Deal closed', lost: 'Marked "no answer"' }[st] || st)
  const age = lead.ts ? now - lead.ts : 0
  const lastTouch = Math.max(lead.ts || 0, lastIn || 0)
  if (age && age < DAY) add('stage', 'fresh', 6, 'ליד טרי (פחות מיממה)', 'Fresh lead (under a day)')
  else if (age && age < 7 * DAY) add('stage', 'this_week', 3, 'נכנס השבוע', 'Came in this week')
  else if (lastTouch && now - lastTouch > 30 * DAY) add('stage', 'stale', -8, 'אין פעילות מעל 30 יום', 'No activity for over 30 days')

  // 6 · Property fit
  const price = parsePrice(property?.price)
  if (property) add('fit', 'listing', 3, `הנכס קיים במלאי: ${property.title || ''}`.trim(), `Listing in stock: ${property.title || ''}`.trim())
  if (price && s.budget) {
    const r = s.budget / price
    if (r >= 0.9) add('fit', 'budget_fits', 7, 'התקציב תואם את מחיר הנכס', 'Budget matches the asking price')
    else if (r >= 0.7) add('fit', 'budget_close', 2, 'התקציב קרוב למחיר הנכס', 'Budget close to the asking price')
    else add('fit', 'budget_low', -6, 'התקציב נמוך משמעותית ממחיר הנכס', 'Budget well below the asking price')
  }

  const raw = 20 + f.reduce((n, x) => n + x.points, 0)
  const score = Math.max(0, Math.min(100, Math.round(raw)))
  const grade = score >= 75 ? 'hot' : score >= 50 ? 'warm' : score >= 30 ? 'cool' : 'cold'

  // What's still unknown → questions for the next call
  const missing = []
  if (!s.budget) missing.push({ key: 'budget', he: 'מה התקציב?', en: 'What is the budget?' })
  if (!s.timeline) missing.push({ key: 'timeline', he: 'מתי מתכננים לבצע את העסקה?', en: 'When do they plan to close?' })
  if (!s.financing && s.dealType !== 'sell' && s.dealType !== 'rent') missing.push({ key: 'financing', he: 'איך ממומנת הרכישה (הון עצמי / משכנתא / אישור עקרוני)?', en: 'How is it financed (equity / mortgage / pre-approval)?' })
  if (!s.dealType) missing.push({ key: 'dealType', he: 'קנייה, מכירה, השכרה או השקעה?', en: 'Buying, selling, renting or investing?' })
  if (!lead.propLocation && !lead.area) missing.push({ key: 'area', he: 'באיזה אזור / יישוב?', en: 'Which area / town?' })
  if (!validEmail(lead.email)) missing.push({ key: 'email', he: 'כתובת אימייל לשליחת חומרים', en: 'Email to send materials' })

  // Best time to reach them — from the hours they actually wrote on WhatsApp (Israel time)
  const hours = inb.map(m => Number(new Date(m.ts).toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hour12: false })) % 24)
  let bestHour = null
  if (hours.length >= 2) {
    const cnt = {}; hours.forEach(h => { cnt[h] = (cnt[h] || 0) + 1 })
    bestHour = Number(Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0])
  }

  // Next best action (rule-based; the AI layer may refine it)
  let next
  if (lead.auto?.optOut || intent === 'negative') next = { key: 'close', he: 'לכבד את הבקשה – לסגור את הליד ולא לשלוח הודעות נוספות', en: 'Respect the request – close the lead, no more messages' }
  else if (st === 'won') next = { key: 'aftercare', he: 'שיחת שירות אחרי עסקה ובקשה להמלצה', en: 'After-sale call and ask for a referral' }
  else if (grade === 'hot') next = { key: 'call_now', he: 'להתקשר עכשיו ולקבוע פגישה / סיור בנכס', en: 'Call now and book a meeting / viewing' }
  else if (!inb.length && out.length >= 2) next = { key: 'call_try', he: 'לנסות שיחה טלפונית – הוואטסאפ לא נענה', en: 'Try a phone call – WhatsApp got no answer' }
  else if (!inb.length && !out.length) next = { key: 'first_touch', he: 'לשלוח הודעת פתיחה ולהתקשר תוך שעה', en: 'Send a first message and call within an hour' }
  else next = { key: 'qualify', he: `שיחת בירור צרכים – ${missing.slice(0, 2).map(m => m.he.replace(/\?$/, '')).join(', ') || 'לחדד את הצורך'}`, en: `Qualification call – ${missing.slice(0, 2).map(m => m.en.replace(/\?$/, '')).join(', ') || 'clarify the need'}` }

  const byGroup = {}
  for (const x of f) byGroup[x.group] = (byGroup[x.group] || 0) + x.points
  return {
    score, grade, factors: f.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)), byGroup,
    signals: { budget: s.budget, dealType: s.dealType, timeline: s.timeline, financing: s.financing, wantsVisit: s.wantsVisit, intent, source: src, inbound: inb.length, outbound: out.length, repeats, listingPrice: price },
    missing, bestHour, next,
  }
}

// Legacy fields the board / table already show (score 1–5, intent hot|warm|cold)
export const legacyScore = score => Math.max(1, Math.min(5, Math.ceil(score / 20)))
export const legacyIntent = grade => (grade === 'hot' ? 'hot' : grade === 'warm' ? 'warm' : 'cold')

// Combine the rule-based result with a Claude briefing (server or browser fallback path)
export function mergeBrief(rules, brief, extra = {}) {
  const adj = brief ? Math.max(-15, Math.min(15, Math.round(Number(brief.scoreAdjustment) || 0))) : 0
  const score = Math.max(0, Math.min(100, rules.score + adj))
  const grade = score >= 75 ? 'hot' : score >= 50 ? 'warm' : score >= 30 ? 'cool' : 'cold'
  const b = rules.signals?.budget
  return {
    version: 2, status: 'done', enrichedAt: Date.now(),
    score100: score, grade, ruleScore: rules.score, adjustment: adj,
    // legacy fields the board, table and filters already read
    score: legacyScore(score), intent: legacyIntent(grade),
    scoreReason: brief?.scoreAdjustmentReason || rules.factors.slice(0, 2).map(f => f.he).join(' · '),
    notes: brief?.summary || '', talkingPoints: brief?.talkingPoints || [], tags: brief?.tags || [],
    estimatedBudget: brief?.budgetRange || (b ? `${(b / 1e6).toFixed(b % 1e6 ? 1 : 0)}M ₪` : ''),
    factors: rules.factors, byGroup: rules.byGroup, signals: rules.signals, missing: rules.missing, bestHour: rules.bestHour, next: rules.next,
    brief: brief || null, ...extra,
  }
}
