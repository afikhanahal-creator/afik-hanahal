// WhatsApp conversation summary for the lead card ("שיחת וואטסאפ" tab): the whole chat with a lead (Green API history),
// summarized by Claude into what was discussed, what the lead wants, what was agreed, open questions, the next step and
// the stage the lead should be in — so moving the lead along the pipeline is one look and one click.
// Voice notes can't be transcribed here (Claude reads text and images, not audio): they are marked and counted.
import { STAGES } from './automations-shared.js'
import { claudeJson } from './claude-json.js'
import { chatHistory } from './lead-analyze.js'
import { normalizeChat } from './chat-format.js'

export { normalizeChat }

const MODEL = 'claude-opus-5-5'
const MAX_MESSAGES = 150
const MAX_CHARS = 24000

/** The chat as plain lines for the model (Israel time), newest kept when it is long */
export function chatTranscript(messages, lead = {}) {
  const fmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  let lines = messages.slice(-MAX_MESSAGES).map(m => `[${m.ts ? fmt.format(new Date(m.ts)) : '?'}] ${m.dir === 'in' ? 'הליד' : 'המשרד'}: ${[m.media && `[${m.media}]`, (m.text || '').replace(/\s+/g, ' ').trim().slice(0, 1200)].filter(Boolean).join(' ')}`)
  while (lines.join('\n').length > MAX_CHARS && lines.length > 10) lines = lines.slice(1)
  const head = [
    `ליד: ${lead.name || 'לא ידוע'}`,
    lead.prop_title || lead.propTitle || lead.campaignName ? `התעניין ב: ${lead.prop_title || lead.propTitle || lead.campaignName}` : '',
    `שלב נוכחי: ${lead.leadStatus || lead.lead_status || 'new'}`,
    lead.msg || lead.message ? `מה כתב כשהשאיר פרטים: ${String(lead.msg || lead.message).slice(0, 500)}` : '',
    `היום: ${fmt.format(new Date())}`,
  ].filter(Boolean)
  return `${head.join('\n')}\n\n# השיחה בוואטסאפ (מהישנה לחדשה, ${lines.length} הודעות)\n${lines.join('\n')}`
}

export const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'leadWants', 'topics', 'agreed', 'openQuestions', 'nextStep', 'suggestedStage', 'stageReason', 'followUpDays', 'temperature', 'lastWord'],
  properties: {
    summary: { type: 'string', description: '2–4 sentences: the story of the conversation so far' },
    leadWants: { type: 'string', description: 'What the lead is looking for (type, area, rooms, budget, timing) — empty if unknown' },
    topics: { type: 'array', items: { type: 'string' }, description: 'What was discussed, a few words each (max 6)' },
    agreed: { type: 'array', items: { type: 'string' }, description: 'Commitments and agreements: meetings, times, material to send (max 5)' },
    openQuestions: { type: 'array', items: { type: 'string' }, description: 'Questions or objections of the lead that were not answered yet (max 5)' },
    nextStep: { type: 'string', description: 'The one concrete thing the office should do next' },
    suggestedStage: { type: 'string', enum: STAGES },
    stageReason: { type: 'string', description: 'Why this stage, one sentence quoting what happened' },
    followUpDays: { type: 'integer', description: 'In how many days to follow up (0 = today, -1 = no follow-up needed)' },
    temperature: { type: 'string', enum: ['hot', 'warm', 'cold'] },
    lastWord: { type: 'string', enum: ['lead', 'office', 'none'], description: 'Who wrote last — "lead" means the lead is waiting for an answer' },
  },
}

export const SUMMARY_SYSTEM = `You summarize a WhatsApp conversation between a real-estate office in the Sharon region of Israel (Afik Hanahal) and a lead, so the agent knows in ten seconds where things stand and can move the lead to the right pipeline stage.
Write every text field in natural, concise Hebrew, the way an agent would write a note to a colleague. Never invent facts: only what the messages say. Quote concrete details (dates, times, numbers, places) exactly. Automatic or template messages from the office count as what the office said, but don't treat them as the lead's interest.
Stages: new = no real two-way contact yet; contacted = the lead answered / a first conversation happened; discovery = needs are being clarified, a meeting or visit is being set or happened; negotiating = price or terms are being discussed, an offer is on the table; won = a deal was signed or agreed; lost = the lead chose something else or stopped; irrelevant = not a real buyer / wrong number / not interested at all; nurture = interested but later (months away).
Media in brackets ([הודעה קולית (לא תומללה)], [תמונה], …) can't be read: mention in the summary that there were voice notes you couldn't hear if they matter.`

/** Keeps the model's answer inside the schema's promises (and our UI's limits) */
export function normalizeSummary(raw = {}) {
  const s = v => String(v ?? '').trim()
  const list = (v, n) => (Array.isArray(v) ? v.map(s).filter(Boolean).slice(0, n) : [])
  const days = Number.isInteger(raw.followUpDays) ? Math.max(-1, Math.min(180, raw.followUpDays)) : -1
  return {
    summary: s(raw.summary), leadWants: s(raw.leadWants), topics: list(raw.topics, 6), agreed: list(raw.agreed, 5), openQuestions: list(raw.openQuestions, 5),
    nextStep: s(raw.nextStep), suggestedStage: STAGES.includes(raw.suggestedStage) ? raw.suggestedStage : null, stageReason: s(raw.stageReason),
    followUpDays: days, temperature: ['hot', 'warm', 'cold'].includes(raw.temperature) ? raw.temperature : 'warm',
    lastWord: ['lead', 'office', 'none'].includes(raw.lastWord) ? raw.lastWord : 'none',
  }
}

/** POST /api/meta/chat-summary { lead } → { ok, summary: {…, msgCount, inbound, voiceNotes, lastAt, at, model} } | { error, code } */
export async function summarizeChat(lead = {}, { history = null } = {}) {
  if (!lead.phone) return { error: 'lead has no phone', code: 'no_phone' }
  const messages = normalizeChat(history || await chatHistory(lead.phone, 200))
  if (!messages.length) return { error: 'no WhatsApp conversation with this lead yet', code: 'empty' }
  const r = await claudeJson({ system: SUMMARY_SYSTEM, user: chatTranscript(messages, lead), schema: SUMMARY_SCHEMA, model: MODEL, maxTokens: 6000, effort: 'medium', timeout: 50000 })
  if (r.error) return r
  return {
    ok: true,
    summary: {
      ...normalizeSummary(r.data),
      msgCount: messages.length, inbound: messages.filter(m => m.dir === 'in').length,
      voiceNotes: messages.filter(m => m.media && /קולית/.test(m.media)).length,
      lastAt: messages[messages.length - 1].ts, at: Date.now(), model: r.model,
    },
  }
}
