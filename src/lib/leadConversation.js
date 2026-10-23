// Pure helpers for the Lead Center's conversation (src/LeadConversation.jsx), tested in leadConversation.test.mjs.
import { templateList, renderTemplate, mergeConfig, welcomeTemplateId } from '../../lib/automations-shared.js'

const norm = s => String(s || '').replace(/\s+/g, ' ').trim()
const ts = m => Date.parse(m?.created_at || '') || 0

/**
 * One timeline from the WhatsApp history (Green API, already normalized: { id, direction, message, created_at, … }),
 * the Lead Center's own log (meta_messages: { id, direction, message, created_at, wa_message_id }) and messages being
 * sent right now (optimistic, id "opt-…"). The WhatsApp history wins: a logged row is kept only when WhatsApp doesn't
 * have it (same message id, or the same text in the same direction) — e.g. while the history can't be read.
 */
export function mergeConversation(green = [], local = [], pending = []) {
  const ids = new Set(green.map(m => m.id).filter(Boolean))
  const texts = { in: new Set(), out: new Set() }
  for (const m of green) texts[m.direction === 'out' ? 'out' : 'in'].add(norm(m.message))
  const logged = local
    .filter(m => m && norm(m.message) && !(m.wa_message_id && ids.has(m.wa_message_id)) && !texts[m.direction === 'out' ? 'out' : 'in'].has(norm(m.message)))
    .map(m => ({ id: `log-${m.id}`, direction: m.direction === 'out' ? 'out' : 'in', message: m.message, created_at: m.created_at, kind: 'textMessage', status: m.direction === 'out' ? 'sent' : 'read', logged: true }))
  for (const m of logged) texts[m.direction].add(norm(m.message))
  // a message being sent disappears once the history has it
  const waiting = pending.filter(m => !texts.out.has(norm(m.message)))
  return [...green, ...logged, ...waiting].sort((a, b) => ts(a) - ts(b))
}

// the Lead Center's statuses → the CRM stages the templates recommend by
const META_STAGE = { new: 'new', contacted: 'contacted', scheduled: 'discovery', closed: 'lost', saved_to_crm: 'contacted' }

/** A Meta lead (meta_leads row) in the shape the template engine reads; a CRM copy of it (contacts) wins when we have one */
export function templateLead(metaLead, crmLead, formAnswers = []) {
  if (!metaLead) return null
  const base = {
    id: metaLead.id, name: metaLead.name || '', phone: metaLead.phone || '', email: metaLead.email || '', source: 'meta',
    created_at: metaLead.created_at, campaign_name: metaLead.campaign_name || '', form_name: metaLead.form_name || '',
    leadStatus: META_STAGE[metaLead.status] || 'new',
    crm_data: { metaLeadId: metaLead.id, campaignName: metaLead.campaign_name || '', formName: metaLead.form_name || '', formAnswers },
  }
  if (!crmLead) return base
  return { ...base, ...crmLead, phone: crmLead.phone || base.phone, source: 'meta', crm_data: { ...base.crm_data, ...(crmLead.crm_data || {}) } }
}

/** What to tell the office when a send failed: the plan quota in plain words, otherwise Green's reason without raw JSON */
export function sendErrorText(err, lang = 'he') {
  const he = lang !== 'en'
  if (err?.quota || /\b466\b|quota/i.test(String(err?.error || err || ''))) {
    return he ? 'השליחה נחסמה: המכסה החודשית של Green API נגמרה. הקו מחובר, אבל התוכנית החינמית שולחת רק למספרים בודדים. משדרגים ב-console.green-api.com.'
      : 'Blocked: the Green API monthly quota is used up. The line is connected, but the free plan only sends to a few numbers. Upgrade at console.green-api.com.'
  }
  const raw = String(err?.error || err || '').replace(/\{[\s\S]*\}/, '').replace(/\s+/g, ' ').trim().replace(/[:\s]+$/, '')
  const short = raw.length > 140 ? raw.slice(0, 140) + '…' : raw
  return (he ? 'השליחה נכשלה' : 'Sending failed') + (short ? `: ${short}` : '')
}

const sigOf = text => norm(String(text || '').split('\n').filter(l => !/^(שלום|היי|hello|hi)\b/i.test(l.trim())).sort((a, b) => b.length - a.length)[0] || '').slice(0, 36)

/**
 * The template dropdown of the composer: groups of { id, title, text, sent, isDefault }, rendered for the lead.
 * Before anything was sent the welcome wordings come first (the automation's one on top), then the personal ones and the
 * rest of the library by category; afterwards the categories in their usual order. `sent` = its distinctive line is
 * already in one of our messages.
 */
export function templateOptions(autoConfig, lead, lang = 'he', { outTexts = [], first = false, categories = [] } = {}) {
  const cfg = mergeConfig(autoConfig || {})
  const defId = welcomeTemplateId(cfg, lead || {})
  const out = outTexts.map(norm).join('\n')
  const all = templateList(cfg).map(t => {
    const text = renderTemplate(t, lead || {}, cfg, lang)
    const sig = sigOf(text)
    return { id: t.id, cat: t.cat || 'general', title: lang === 'en' ? (t.en_title || t.he_title) : (t.he_title || t.en_title), text, isDefault: t.id === defId, sent: sig.length > 12 && out.includes(sig) }
  }).filter(x => x.text.trim())
  const order = categories.map(c => c.id)
  const catOrder = first ? ['welcome', 'personal', ...order.filter(id => id !== 'welcome' && id !== 'personal')] : order
  for (const x of all) if (!catOrder.includes(x.cat)) catOrder.push(x.cat)
  return catOrder.map(id => {
    const items = all.filter(x => x.cat === id).sort((a, b) => (b.isDefault - a.isDefault))
    const c = categories.find(k => k.id === id)
    return { id, label: c ? (lang === 'en' ? c.en : c.he) : id, items }
  }).filter(g => g.items.length)
}
