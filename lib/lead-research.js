// Prospect research (server): what an SDR does before the first call — validate the phone number, check who the
// person is from public sources (name + city + phone + email → LinkedIn / Facebook / Instagram / company site /
// listings), spot red flags (test lead, competitor broker, throw-away number) and collect rapport hooks.
// Claude with the web search server tool does the searching; the pure helpers below (phone, name, parsing)
// are tested. Boundaries are in the system prompt: public information only, no sensitive categories, no guessing —
// a match is reported only when two independent signals agree, everything else is "unverified".
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-5'

// ── Phone: Israeli numbering plan ─────────────────────────────────────────────
// mobile 05x (050–059), landline 02/03/04/08/09, 07x = VoIP / cable / other carriers, 1-xxx service numbers
const MOBILE_CARRIER = { '050': 'Pelephone', '051': 'WeCom / other', '052': 'Cellcom', '053': 'Hot Mobile', '054': 'Partner', '055': 'virtual / MVNO', '056': 'Palestinian carrier', '058': 'Golan Telecom', '059': 'Palestinian carrier' }
const LANDLINE_AREA = { '02': 'Jerusalem', '03': 'Tel Aviv & centre', '04': 'Haifa & north', '08': 'south & lowlands', '09': 'Sharon' }

export function phoneCheck(raw) {
  const s = String(raw || '').trim()
  const digits = s.replace(/\D/g, '')
  if (!digits) return { input: s, valid: false, type: 'missing', notes: ['no number'] }
  const notes = []
  let local = null
  if (digits.startsWith('972') && digits.length >= 11) local = '0' + digits.slice(3)
  else if (digits.startsWith('0')) local = digits
  else if (digits.length === 9) local = '0' + digits          // "521234567" typed without the 0
  else if (s.startsWith('+') || digits.length > 10) return { input: s, digits, valid: true, type: 'foreign', e164: `+${digits}`, notes: ['not an Israeli number'] }
  else local = digits
  const e164 = local && local.startsWith('0') ? `+972${local.slice(1)}` : null
  let type = 'invalid', carrier = null, area = null
  if (/^05\d{8}$/.test(local)) { type = 'mobile'; carrier = MOBILE_CARRIER[local.slice(0, 3)] || null }
  else if (/^0[23489]\d{7}$/.test(local)) { type = 'landline'; area = LANDLINE_AREA[local.slice(0, 2)] || null }
  else if (/^07\d{8}$/.test(local)) type = 'voip'
  else if (/^1[0-9]{3,5}$/.test(local)) type = 'service'
  if (type === 'invalid') notes.push(`unusual length or prefix (${local.length} digits)`)
  const body = local.slice(type === 'mobile' || type === 'voip' ? 3 : 2)
  if (/^(\d)\1+$/.test(body) || /^(0123456|1234567|7654321)/.test(body)) notes.push('looks made up (repeated or sequential digits)')
  if (type === 'landline') notes.push('landline — WhatsApp will not reach it; ask for a mobile')
  if (type === 'voip') notes.push('07x number — VoIP / cable, sometimes a temporary line')
  return { input: s, digits, local, e164, valid: type !== 'invalid', type, carrier, area, notes }
}

// ── Name: is this a real, full name? ──────────────────────────────────────────
// (\b is ASCII-only in JS — Hebrew needs letter lookarounds)
const TEST_WORDS = /(?<!\p{L})(?:test|testing|בדיקה|בדיקת|ניסיון|נסיון|דוגמה|דוגמא|asdf|qwerty|aaa+|xxx+|zzz+|null|undefined|unknown|לא ידוע|אנונימי|anonymous)(?!\p{L})/iu
export function nameQuality(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim()
  if (!s) return { name: s, quality: 'missing', notes: ['no name'] }
  const notes = []
  if (TEST_WORDS.test(s)) return { name: s, quality: 'suspicious', notes: ['looks like a test / placeholder name'] }
  if (/\d/.test(s)) notes.push('contains digits')
  if (/(.)\1{3,}/.test(s)) notes.push('repeated characters')
  const parts = s.split(' ').filter(Boolean)
  const letters = s.replace(/[^\p{L}]/gu, '')
  if (letters.length < 2) return { name: s, quality: 'suspicious', notes: [...notes, 'too short'] }
  if (parts.length === 1) return { name: s, quality: 'first-only', notes: [...notes, 'first name only — ask for the family name'] }
  if (notes.length) return { name: s, quality: 'suspicious', notes }
  return { name: s, quality: 'full', notes: [], first: parts[0], last: parts.slice(1).join(' ') }
}

// ── Research call ─────────────────────────────────────────────────────────────
export const RESEARCH_SYSTEM = `You are the SDR (sales development researcher) of Afik Hanahal, a real-estate marketing & brokerage firm in the Sharon region of Israel.
A prospect left their details on the site. Before the broker calls, find out who they are and how to warm the conversation — from PUBLIC sources only.

Do, in this order, with the web search tool (Hebrew and English queries; the person is most likely Israeli):
1. Phone number: search the exact number in several formats ("052-1234567", "0521234567", "+972521234567"). Does it appear publicly — a business listing, a marketplace ad (yad2, Facebook Marketplace), a company page, a professional directory? That tells you who owns it.
2. Full name: search the name with the city / area, with the phone, and with the email handle. Look for LinkedIn, Facebook, Instagram, a company website, press mentions, professional directories (lawyers, accountants, doctors, brokers), business registries. Try the Latin transliteration of a Hebrew name and vice versa.
3. Real-estate context: is the person themselves a broker, investor, developer, contractor, architect or a landlord with public listings (yad2, madlan, homeless)? Did they post about looking for / selling property?
4. Rapport: anything public and professional that helps the broker open warmly — the business they run, the town they live in, a shared field.

Rules — these matter more than finding something:
- A profile is a MATCH only when two independent signals agree (name + city, name + phone, name + email handle, name + occupation the lead mentioned). One common name alone is NOT a match: report it as unverified and say what would confirm it.
- Public, professional information only. Never report or infer: health, religion, ethnicity, political views, sexual orientation, criminal or legal matters, debts or financial distress, family details, children, minors, a home address, or anything from a private / locked account. If a source contains such things, ignore them.
- Never invent. Every claim carries the URL it came from. No URL → it goes in "unverified", not in findings.
- Distinguish clearly: confirmed (two signals) / likely (strong single signal) / unverified.
- A lead whose name looks like a test, a placeholder or a joke, or whose number looks made up, is a red flag — say so plainly.
- Keep it short and useful: the broker reads this in 30 seconds before dialing.

Write all text values in Hebrew (URLs and network names stay as they are). When you are done searching, end your answer with ONE fenced \`\`\`json block containing exactly this object (no other JSON blocks):
{
  "identity": { "verdict": "confirmed" | "likely" | "unverified" | "mismatch", "confidence": "high" | "medium" | "low", "who": "one or two sentences: who this most likely is", "matchedBy": ["signals that agreed"], "toConfirm": ["what would confirm the identity"] },
  "phone": { "publicOwner": "who the number belongs to publicly, or empty", "mentions": [{ "url": "", "what": "" }] },
  "profiles": [{ "network": "linkedin" | "facebook" | "instagram" | "website" | "yad2" | "madlan" | "directory" | "news" | "other", "url": "", "title": "", "note": "", "confidence": "high" | "medium" | "low" }],
  "professional": { "occupation": "", "company": "", "role": "", "location": "", "sourceUrl": "" },
  "realEstate": { "isProfessional": false, "kind": "" , "signals": [], "listings": [{ "url": "", "what": "" }] },
  "redFlags": [],
  "hooks": ["specific, evidence-based rapport hooks the broker can use"],
  "verifyQuestions": ["gentle questions that confirm identity / context without sounding like an interrogation"],
  "opener": "one natural opening sentence for the call or WhatsApp, in the lead's language",
  "dataQuality": "rich" | "some" | "thin" | "none",
  "sources": [{ "url": "", "title": "" }]
}`

export function researchPrompt(lead, extras = {}) {
  const L = lead || {}
  const ph = phoneCheck(L.phone), nm = nameQuality(L.name)
  const lines = [
    `# Prospect`,
    `name: ${L.name || '—'} (${nm.quality}${nm.notes.length ? ': ' + nm.notes.join('; ') : ''})`,
    `phone: ${L.phone || '—'} → ${ph.e164 || ph.input || '—'} (${ph.type}${ph.carrier ? ', ' + ph.carrier : ''}${ph.area ? ', ' + ph.area : ''}${ph.notes.length ? '; ' + ph.notes.join('; ') : ''})`,
    `email: ${L.email || '—'}`,
    `city / area they mentioned: ${L.area || L.propLocation || L.city || '—'}`,
    `site language: ${L.origin?.lang || 'he'} | source: ${L.source || '—'}${L.campaignName ? ` | campaign: ${L.campaignName}` : ''}`,
    `interested in: ${L.propTitle || '—'}${L.propLocation ? ` (${L.propLocation})` : ''}`,
    `their message: ${L.msg || L.message || '—'}`,
  ]
  const known = ['budget', 'dealType', 'timeline', 'financing', 'rooms', 'propertyType'].filter(k => L[k]).map(k => `${k}: ${L[k]}`)
  if (known.length) lines.push(`office fields: ${known.join(' | ')}`)
  if (L.formAnswers?.length) lines.push(`form answers:\n${L.formAnswers.map(x => `- ${x.q}: ${x.a}`).join('\n')}`)
  if (extras.chatSample?.length) lines.push(`WhatsApp (their own messages, latest):\n${extras.chatSample.map(m => `- ${m}`).join('\n')}`)
  if (extras.repeats) lines.push(`repeat inquiries with this number in our system: ${extras.repeats}`)
  if (L.notes?.length) lines.push(`office notes:\n${L.notes.slice(-5).map(n => `- ${n.text}`).join('\n')}`)
  lines.push(`today: ${new Date().toISOString().slice(0, 10)}`)
  return lines.join('\n')
}

// The last fenced json block (or the last balanced {...}) in the model's text → object, or null
export function parseResearchJson(text) {
  const s = String(text || '')
  const fenced = [...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(m => m[1].trim()).filter(c => c.startsWith('{'))
  for (const c of fenced.reverse()) { try { const o = JSON.parse(c); if (o && typeof o === 'object') return o } catch {} }
  // walk back from the last '}' to the '{' that balances it
  const end = s.lastIndexOf('}')
  if (end < 0) return null
  let depth = 0
  for (let i = end; i >= 0; i--) {
    if (s[i] === '}') depth++
    else if (s[i] === '{') { depth--; if (depth === 0) { try { const o = JSON.parse(s.slice(i, end + 1)); if (o && typeof o === 'object') return o } catch {} break } }
  }
  return null
}

const arr = v => (Array.isArray(v) ? v.filter(x => x != null && x !== '') : [])
const str = (v, n = 400) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
const isUrl = u => /^https?:\/\/[^\s]+$/i.test(String(u || ''))

// Normalise + sanitise what the model returned (drop claims without a URL, cap lengths)
export function normalizeResearch(o, { phone, name } = {}) {
  const r = o && typeof o === 'object' ? o : {}
  const id = r.identity && typeof r.identity === 'object' ? r.identity : {}
  const verdict = ['confirmed', 'likely', 'unverified', 'mismatch'].includes(id.verdict) ? id.verdict : 'unverified'
  const conf = ['high', 'medium', 'low'].includes(id.confidence) ? id.confidence : 'low'
  const profiles = arr(r.profiles).filter(p => p && isUrl(p.url)).map(p => ({ network: str(p.network, 20) || 'other', url: str(p.url, 300), title: str(p.title, 120), note: str(p.note, 240), confidence: ['high', 'medium', 'low'].includes(p.confidence) ? p.confidence : 'low' })).slice(0, 8)
  const pro = r.professional && typeof r.professional === 'object' ? r.professional : {}
  const re = r.realEstate && typeof r.realEstate === 'object' ? r.realEstate : {}
  const ph = r.phone && typeof r.phone === 'object' ? r.phone : {}
  return {
    version: 1, at: Date.now(),
    phoneCheck: phoneCheck(phone), nameCheck: nameQuality(name),
    identity: { verdict, confidence: conf, who: str(id.who, 600), matchedBy: arr(id.matchedBy).map(x => str(x, 120)).slice(0, 6), toConfirm: arr(id.toConfirm).map(x => str(x, 160)).slice(0, 5) },
    phone: { publicOwner: str(ph.publicOwner, 200), mentions: arr(ph.mentions).filter(m => m && isUrl(m.url)).map(m => ({ url: str(m.url, 300), what: str(m.what, 200) })).slice(0, 5) },
    profiles,
    professional: { occupation: str(pro.occupation, 120), company: str(pro.company, 120), role: str(pro.role, 120), location: str(pro.location, 80), sourceUrl: isUrl(pro.sourceUrl) ? str(pro.sourceUrl, 300) : '' },
    realEstate: { isProfessional: !!re.isProfessional, kind: str(re.kind, 80), signals: arr(re.signals).map(x => str(x, 200)).slice(0, 6), listings: arr(re.listings).filter(l => l && isUrl(l.url)).map(l => ({ url: str(l.url, 300), what: str(l.what, 200) })).slice(0, 5) },
    redFlags: arr(r.redFlags).map(x => str(x, 200)).slice(0, 6),
    hooks: arr(r.hooks).map(x => str(x, 220)).slice(0, 6),
    verifyQuestions: arr(r.verifyQuestions).map(x => str(x, 220)).slice(0, 5),
    opener: str(r.opener, 400),
    dataQuality: ['rich', 'some', 'thin', 'none'].includes(r.dataQuality) ? r.dataQuality : 'none',
    sources: arr(r.sources).filter(s => s && isUrl(s.url)).map(s => ({ url: str(s.url, 300), title: str(s.title, 120) })).slice(0, 12),
  }
}

// Plain-text version for the briefing's dossier
export function researchText(r) {
  if (!r || r.error) return `# Prospect research: ${r?.error ? 'not available (' + r.error + ')' : 'not run'}`
  const L = []
  L.push(`# Prospect research (public sources, ${r.dataQuality || 'none'} data)`)
  L.push(`identity: ${r.identity.verdict} (${r.identity.confidence}) — ${r.identity.who || '—'}${r.identity.matchedBy?.length ? ` | matched by: ${r.identity.matchedBy.join(', ')}` : ''}${r.identity.toConfirm?.length ? ` | to confirm: ${r.identity.toConfirm.join('; ')}` : ''}`)
  const pc = r.phoneCheck || {}
  L.push(`phone: ${pc.e164 || pc.input || '—'} ${pc.type || ''}${pc.carrier ? ' ' + pc.carrier : ''}${pc.notes?.length ? ' — ' + pc.notes.join('; ') : ''}${r.phone?.publicOwner ? ` | public owner: ${r.phone.publicOwner}` : ''}`)
  const nc = r.nameCheck || {}
  if (nc.quality && nc.quality !== 'full') L.push(`name: ${nc.quality} — ${nc.notes?.join('; ') || ''}`)
  if (r.professional?.occupation || r.professional?.company) L.push(`professional: ${[r.professional.occupation, r.professional.role, r.professional.company, r.professional.location].filter(Boolean).join(' · ')}${r.professional.sourceUrl ? ` (${r.professional.sourceUrl})` : ''}`)
  if (r.profiles?.length) L.push(`profiles:\n${r.profiles.map(p => `- ${p.network} ${p.url} (${p.confidence})${p.note ? ' — ' + p.note : ''}`).join('\n')}`)
  if (r.realEstate?.isProfessional || r.realEstate?.signals?.length || r.realEstate?.listings?.length) L.push(`real-estate context: ${r.realEstate.isProfessional ? `PROFESSIONAL (${r.realEstate.kind || ''})` : 'private person'}${r.realEstate.signals?.length ? ' — ' + r.realEstate.signals.join('; ') : ''}${r.realEstate.listings?.length ? ` | listings: ${r.realEstate.listings.map(l => l.what + ' ' + l.url).join('; ')}` : ''}`)
  if (r.redFlags?.length) L.push(`red flags: ${r.redFlags.join('; ')}`)
  if (r.hooks?.length) L.push(`rapport hooks: ${r.hooks.join(' | ')}`)
  if (r.verifyQuestions?.length) L.push(`verification questions: ${r.verifyQuestions.join(' | ')}`)
  if (r.opener) L.push(`opener: ${r.opener}`)
  return L.join('\n')
}

// Run the research: web search + a pause_turn loop (server-side tool iterations), capped in time and searches.
// createClient is injectable for tests. → normalised research object, or { error, code }
export async function researchLead(lead, { extras = {}, createClient, maxSearches = 8, budgetMs = 48000, model = MODEL } = {}) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim()
  if (!createClient && !apiKey) return { error: 'ANTHROPIC_API_KEY is not set in Vercel', code: 'no_key' }
  const workspace = String(process.env.ANTHROPIC_WORKSPACE_ID || '').trim()
  const client = createClient ? createClient() : new Anthropic({ apiKey, timeout: budgetMs, maxRetries: 0, ...(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {}) })
  const t0 = Date.now()
  const messages = [{ role: 'user', content: researchPrompt(lead, extras) }]
  const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxSearches, user_location: { type: 'approximate', country: 'IL', timezone: 'Asia/Jerusalem' } }]
  let res = null, searches = 0
  try {
    for (let i = 0; i < 4; i++) {
      res = await client.messages.create({ model, max_tokens: 6000, system: RESEARCH_SYSTEM, tools, messages, thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } })
      searches += (res.content || []).filter(b => b.type === 'server_tool_use').length
      if (res.stop_reason !== 'pause_turn' || Date.now() - t0 > budgetMs - 8000) break
      messages.push({ role: 'assistant', content: res.content })   // the server resumes where it stopped
    }
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { error: 'ANTHROPIC_API_KEY is invalid', code: 'auth' }
    if (e instanceof Anthropic.BadRequestError && /not scoped to a workspace|anthropic-workspace-id/i.test(e.message || '')) return { error: 'API key not tied to a workspace', code: 'workspace' }
    if (e instanceof Anthropic.RateLimitError) return { error: 'Rate limited', code: 'rate' }
    return { error: e.message || 'research failed', code: e instanceof Anthropic.APIError ? 'api' : 'network' }
  }
  if (!res) return { error: 'no answer', code: 'api' }
  if (res.stop_reason === 'refusal') return { error: 'The model declined this request', code: 'refusal' }
  const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n')
  const parsed = parseResearchJson(text)
  if (!parsed) return { error: 'Could not read the research output', code: 'parse', searches, ms: Date.now() - t0 }
  const out = normalizeResearch(parsed, { phone: lead?.phone, name: lead?.name })
  return { ...out, searches, ms: Date.now() - t0, model: res.model || model, truncated: res.stop_reason === 'pause_turn' || res.stop_reason === 'max_tokens' }
}
