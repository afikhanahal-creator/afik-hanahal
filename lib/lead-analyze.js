// Lead analysis (server): gathers everything we know about a lead, scores it deterministically
// (lib/lead-intel.js) and asks Claude for a sales briefing on top of that evidence.
import Anthropic from '@anthropic-ai/sdk'
import { scoreLead, mergeBrief } from './lead-intel.js'
import { createFeed } from './property-feed.js'
import { researchText } from './lead-research.js'

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
const GREEN_INSTANCE = process.env.WA_GREENAPI_INSTANCE || ''
const GREEN_TOKEN = process.env.WA_GREENAPI_TOKEN || ''
const GREEN_BASE = GREEN_INSTANCE ? `https://${String(GREEN_INSTANCE).slice(0, 4)}.api.greenapi.com` : ''
const RENDER = (process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com').replace(/\/$/, '')
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'AFIKhanahal2026'
const MODEL = 'claude-opus-5'
const catalogFeed = createFeed({ renderUrl: RENDER, supaUrl: SUPA_URL.replace(/\/$/, ''), supaKey: SUPA_KEY, renderBudgetMs: 4000, renderTimeoutMs: 8000 })

const tail9 = p => String(p || '').replace(/\D/g, '').slice(-9)
const intl = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('972') ? d : d.startsWith('0') ? '972' + d.slice(1) : d }
const ms = v => (typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : Date.parse(v || '') || 0)

async function supa(path) {
  if (!SUPA_URL || !SUPA_KEY) return null
  const r = await fetch(`${SUPA_URL}/rest/v1${path}`, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }).catch(() => null)
  return r && r.ok ? r.json().catch(() => null) : null
}

// WhatsApp history via Green API (oldest first)
async function chatHistory(phone) {
  if (!GREEN_BASE || !GREEN_TOKEN || !phone) return []
  const r = await fetch(`${GREEN_BASE}/waInstance${GREEN_INSTANCE}/getChatHistory/${GREEN_TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: `${intl(phone)}@c.us`, count: 80 }), signal: AbortSignal.timeout(12000),
  }).catch(() => null)
  const d = r && r.ok ? await r.json().catch(() => []) : []
  return (Array.isArray(d) ? d : [])
    .map(m => ({ dir: m.type === 'incoming' ? 'in' : 'out', text: m.textMessage || m.caption || m.extendedTextMessage?.text || (m.typeMessage && m.typeMessage !== 'textMessage' ? `[${m.typeMessage}]` : ''), ts: ms(m.timestamp) }))
    .filter(m => m.text)
    .sort((a, b) => a.ts - b.ts)
}

// The listing the lead asked about, from the property catalog
async function matchProperty(lead) {
  const title = String(lead.propTitle || '').trim(), loc = String(lead.propLocation || '').trim()
  if (!title && !loc) return null
  // Snapshot-first (lib/property-feed.js): no full-list download from Render per analysis
  const all = await catalogFeed.getList().then(r => r.list, () => [])
  if (!Array.isArray(all)) return null
  const n = s => String(s || '').replace(/\s+/g, ' ').trim()
  const p = all.find(x => title && n(x.title) === n(title)) || all.find(x => title && (n(x.title).includes(n(title)) || n(title).includes(n(x.title)))) || all.find(x => loc && n(x.location).includes(n(loc)))
  return p ? { title: p.title, price: p.price, category: p.category, location: p.location, type: p.type, size: p.size || p.buildSqm || p.dunams, rooms: p.rooms, status: p.status } : null
}

export async function buildDossier(input = {}) {
  const lead = { ...input }
  const now = Date.now()
  lead.ts = ms(lead.ts || lead.created_at) || now
  const numericId = /^\d+$/.test(String(lead.id || ''))
  const t9 = tail9(lead.phone)
  const [row, log, chat, contactsSame, metaSame, property] = await Promise.all([
    numericId ? supa(`/contacts?id=eq.${encodeURIComponent(lead.id)}&select=*`).then(x => x?.[0] || null) : null,
    lead.id ? supa(`/automation_log?lead_id=eq.${encodeURIComponent(String(lead.id))}&select=created_at,rule_key,message,ok&order=created_at.asc&limit=40`) : null,
    chatHistory(lead.phone),
    t9.length === 9 ? supa(`/contacts?phone=ilike.*${t9.slice(-4)}*&select=id,created_at,phone,prop_title,message,source&limit=40`) : null,
    t9.length === 9 ? supa(`/meta_leads?phone=ilike.*${t9.slice(-4)}*&select=id,created_at,phone,campaign_name,form_name,raw_fields&limit=20`) : null,
    matchProperty(lead),
  ])
  if (row) {
    const crm = row.crm_data || {}
    lead.auto = crm.auto || lead.auto
    lead.origin = lead.origin || crm.origin
    lead.notes = lead.notes || crm.notes
  }
  const same = (contactsSame || []).filter(c => tail9(c.phone) === t9 && String(c.id) !== String(lead.id))
  const metaHits = (metaSame || []).filter(m => tail9(m.phone) === t9)
  const repeats = same.length + metaHits.filter(m => `meta_${m.id}` !== String(lead.id)).length
  return {
    lead, chat, property, repeats, now,
    history: {
      otherInquiries: same.map(c => ({ at: c.created_at, property: c.prop_title, message: String(c.message || '').slice(0, 300), source: c.source })),
      metaForms: metaHits.map(m => ({ at: m.created_at, campaign: m.campaign_name, form: m.form_name, answers: (m.raw_fields || []).map(f => `${f.name}: ${Array.isArray(f.values) ? f.values.join(', ') : f.value || ''}`).slice(0, 12) })),
      automationLog: (log || []).map(e => ({ at: e.created_at, rule: e.rule_key, ok: e.ok, message: String(e.message || '').slice(0, 200) })),
    },
  }
}

// ── Claude briefing ───────────────────────────────────────────────────────────
const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'persona', 'identityCheck', 'motivation', 'urgency', 'dealType', 'budgetRange', 'keyNeeds', 'objections', 'questionsToAsk', 'talkingPoints', 'rapportHooks', 'openingLine', 'warmUpPlan', 'nextBestAction', 'bestTimeToContact', 'suggestedMessage', 'scoreAdjustment', 'scoreAdjustmentReason', 'confidence', 'tags', 'risks'],
  properties: {
    summary: { type: 'string', description: '3–4 short sentences a broker reads in 15 seconds before dialing: who, what they want, how warm, what to do' },
    persona: { type: 'string', description: 'Who this lead most likely is — 1–2 sentences, evidence only' },
    identityCheck: { type: 'string', description: 'What was verified about the person (name, phone, public profile) and what was not — plain words, 1–2 sentences' },
    rapportHooks: { type: 'array', items: { type: 'string' }, description: 'Specific, evidence-based ways to warm the conversation (their business, town, what they wrote). Empty when nothing real is known' },
    openingLine: { type: 'string', description: 'The first sentence of the call, personal and natural, in the lead language' },
    warmUpPlan: { type: 'array', items: { type: 'string' }, description: '3 steps: first touch (channel + what to say), follow-up if no answer (when + what), value to bring (a listing, a document, a number)' },
    motivation: { type: 'string' },
    urgency: { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] },
    dealType: { type: 'string', enum: ['buy', 'sell', 'rent', 'invest', 'unknown'] },
    budgetRange: { type: 'string', description: 'e.g. "2–2.5 מיליון ₪" or "לא ידוע"' },
    keyNeeds: { type: 'array', items: { type: 'string' } },
    objections: { type: 'array', items: { type: 'string' }, description: 'Likely objections / hesitations and how to answer them' },
    questionsToAsk: { type: 'array', items: { type: 'string' }, description: 'Discovery questions in the order to ask them: situation → need → timing → money → decision makers' },
    talkingPoints: { type: 'array', items: { type: 'string' } },
    nextBestAction: { type: 'string' },
    bestTimeToContact: { type: 'string' },
    suggestedMessage: { type: 'string', description: 'Ready-to-send WhatsApp message in the lead language, signed by the office' },
    scoreAdjustment: { type: 'integer', description: 'Between -15 and 15, applied to the rule-based score' },
    scoreAdjustmentReason: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    tags: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
}

const SYSTEM = `You are the senior SDR (sales development representative) of Afik Hanahal, a real-estate marketing & brokerage firm in the Sharon region of Israel (land, plots, apartments, commercial, projects).
Your job: qualify the lead, verify who they are, and hand the broker a briefing they can act on in the next call.
You receive a dossier: the lead's own words, form answers, WhatsApp conversation, automation history, repeat inquiries, the listing they asked about, a prospect research report from public sources (identity, phone, profiles, red flags, rapport hooks), and a transparent rule-based score with its factors.

How to reason:
- Ground every statement in the dossier or in the research report; when something is unknown, say so in one short clause and turn it into a question. Never invent age, profession, income, family or intentions.
- Identity: say plainly what was verified (name, phone type, a public profile that matched) and what was not. "Unverified" is a normal outcome, not a problem — the verify questions handle it in the call.
- Weigh the conversation most: what the lead actually wrote beats form metadata and beats research. A clear "not interested" or an opt-out overrides everything.
- A research red flag (test name, made-up number, competitor broker) belongs in risks and in the summary, and lowers the score.
- scoreAdjustment corrects the rule-based score only for evidence the rules cannot see (tone, a concrete plan, a mismatch, a red flag, a verified professional); keep it 0 when the rules already capture the picture.

How to write (the broker reads this on a phone, between calls):
- Hebrew, natural and direct, the way a sharp colleague briefs you. Short sentences. No filler ("ככל הנראה", "ייתכן ש", "חשוב לציין") more than once in the whole briefing. No repetition between fields — each field adds something.
- Concrete over generic: "ביקש תשריט של המגרש בחדרה" beats "מתעניין בנכס". Numbers, places and dates when you have them.
- Lists: 3–5 items, each one line, each actionable. Questions in the order to ask them.
- openingLine and suggestedMessage in the lead's language (English when they wrote in English or came from the English site); everything else in Hebrew.
- suggestedMessage: WhatsApp, up to 60 words, warm, one clear question, no pressure, signed "אפיק הנחל". Use a rapport hook only if it is verified and public.`

export function dossierText(d, rules) {
  const L = d.lead
  const lines = [
    `# Lead`,
    `name: ${L.name || '—'} | phone: ${L.phone || '—'} | email: ${L.email || '—'} | site language: ${L.origin?.lang || 'he'}`,
    `created: ${new Date(L.ts).toISOString()} | stage: ${L.leadStatus || 'new'} | source: ${L.source || '—'}${L.campaignName ? ` | campaign: ${L.campaignName}` : ''}${L.formName ? ` | form: ${L.formName}` : ''}`,
    `interested in: ${L.propTitle || '—'}${L.propLocation ? ` (${L.propLocation})` : ''}`,
    `message: ${L.msg || '—'}`,
  ]
  const known = ['budget', 'dealType', 'timeline', 'financing', 'area', 'rooms', 'propertyType', 'priority'].filter(k => L[k]).map(k => `${k}: ${L[k]}`)
  if (known.length) lines.push(`fields filled by the office: ${known.join(' | ')}`)
  if (L.formAnswers?.length) lines.push(`form answers:\n${L.formAnswers.map(x => `- ${x.q}: ${x.a}`).join('\n')}`)
  if (L.origin && (L.origin.page || L.origin.referrer || L.origin.utm)) lines.push(`landing: ${L.origin.page || '—'} | referrer: ${L.origin.referrer || '—'} | utm: ${JSON.stringify(L.origin.utm || {})}`)
  if (L.notes?.length) lines.push(`office notes:\n${L.notes.slice(-10).map(n => `- [${new Date(ms(n.ts)).toISOString().slice(0, 10)}] ${n.text}`).join('\n')}`)
  if (d.property) lines.push(`listing asked about: ${JSON.stringify(d.property)}`)
  if (d.repeats) lines.push(`repeat inquiries: ${d.repeats}\n${JSON.stringify(d.history.otherInquiries.slice(0, 5))}`)
  if (d.history.metaForms.length) lines.push(`meta lead forms: ${JSON.stringify(d.history.metaForms.slice(0, 3))}`)
  if (d.chat.length) lines.push(`# WhatsApp (oldest first, last ${Math.min(d.chat.length, 60)})\n${d.chat.slice(-60).map(m => `[${new Date(m.ts).toISOString().slice(0, 16)}] ${m.dir === 'in' ? 'LEAD' : 'OFFICE'}: ${m.text.slice(0, 400)}`).join('\n')}`)
  else lines.push('# WhatsApp: no conversation yet')
  if (d.history.automationLog.length) lines.push(`# Automations sent\n${d.history.automationLog.slice(-10).map(e => `- ${e.at} ${e.rule} ${e.ok ? 'sent' : 'failed'}`).join('\n')}`)
  lines.push(researchText(d.research))
  lines.push(`# Rule-based score: ${rules.score}/100 (${rules.grade})\n${rules.factors.map(f => `${f.points > 0 ? '+' : ''}${f.points} ${f.en}`).join('\n')}`)
  lines.push(`missing info: ${rules.missing.map(m => m.en).join('; ') || 'none'}`)
  lines.push(`now: ${new Date(d.now).toISOString()} (Israel time zone)`)
  return lines.join('\n')
}

async function claudeBrief(d, rules) {
  if (!process.env.ANTHROPIC_API_KEY) return { error: 'ANTHROPIC_API_KEY is not set in Vercel', code: 'no_key' }
  // A key created outside a workspace (Console → API keys at the organization level) must name the workspace on every
  // request. ANTHROPIC_WORKSPACE_ID (optional, Vercel) sends it; a key created inside a workspace needs nothing.
  const workspace = String(process.env.ANTHROPIC_WORKSPACE_ID || '').trim()
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim()   // a pasted key often carries a stray space / newline
  if (/^sk-ant-admin/.test(apiKey)) return { error: 'ANTHROPIC_API_KEY is an Admin key (sk-ant-admin…) — admin keys cannot send messages. Create a regular API key inside a workspace', code: 'admin_key' }
  const makeClient = ws => new Anthropic({ apiKey, timeout: 45000, maxRetries: 1, ...(ws ? { defaultHeaders: { 'anthropic-workspace-id': ws } } : {}) })
  let client = makeClient(workspace)
  const notScoped = e => e instanceof Anthropic.BadRequestError && /not scoped to a workspace|anthropic-workspace-id/i.test(e.message || '')
  const create = () => client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: BRIEF_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: dossierText(d, rules) }],
    })
  try {
    let res
    try { res = await create() }
    catch (e) {
      // A key without a workspace and no ANTHROPIC_WORKSPACE_ID: try the organization's default workspace once
      if (!notScoped(e) || workspace) throw e
      client = makeClient('default')
      res = await create()
    }
    if (res.stop_reason === 'refusal') return { error: 'The model declined this request', code: 'refusal' }
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('')
    const brief = JSON.parse(text)
    return { brief, model: res.model }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: 'ANTHROPIC_API_KEY is invalid', code: 'auth' }
    if (e instanceof Anthropic.RateLimitError) return { error: 'Rate limited – try again in a minute', code: 'rate' }
    if (notScoped(e)) return { error: 'The API key is not tied to a workspace: create a new key inside a workspace (Console → Workspaces → Default → API keys) and put it in ANTHROPIC_API_KEY, or set ANTHROPIC_WORKSPACE_ID in Vercel', code: 'workspace' }
    if (e instanceof Anthropic.APIError) return { error: `Claude API ${e.status}: ${e.message}`, code: 'api' }
    if (e instanceof SyntaxError) return { error: 'Could not read the model output', code: 'parse' }
    return { error: e.message || 'AI request failed', code: 'network' }
  }
}

// Full analysis. `useAI=false` → rules only (instant).
// Without ANTHROPIC_API_KEY on Vercel the result carries `proxy` (system + dossier + schema) so the admin panel can
// run the same briefing through the existing Render AI proxy and merge it with mergeBrief().
export async function analyzeLead(input, { useAI = true, research = null } = {}) {
  const d = await buildDossier(input)
  d.research = research
  const rules = scoreLead(d)
  const ai = useAI ? await claudeBrief(d, rules) : null
  return mergeBrief(rules, ai?.brief || null, {
    aiError: ai?.error || null, aiCode: ai?.code || null, model: ai?.model || null,
    context: { chatMessages: d.chat.length, inbound: rules.signals.inbound, repeats: d.repeats, property: d.property, automations: d.history.automationLog.length },
    research: research || null,
    rules,
    ...(ai?.code === 'no_key' ? { proxy: { system: SYSTEM, user: dossierText(d, rules), schema: BRIEF_SCHEMA } } : {}),
  })
}

export { BRIEF_SCHEMA, SYSTEM }
