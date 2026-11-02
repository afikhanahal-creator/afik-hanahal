// Voice dictation → correct Hebrew (the admin's mic button, src/VoiceDictate.jsx): the browser turns speech into raw text
// (no punctuation, misheard words); Claude rewrites it as clear, correct Hebrew — keeping every fact, name, number and date,
// fixing only what is obviously misheard — and, for a long note, adds a one-line summary on top. Pure but for `ask`
// (lib/claude-json.js claudeJson), so it is tested with a fake. → { text, summary } | { error, code } (the raw text stays then).

export const POLISH_MAX = 6000
const SYSTEM = `You clean up dictated notes for a real-estate office in the Sharon region of Israel (Afik Hanahal).
The input is raw browser speech-to-text: no punctuation, run-on sentences, some misheard words.
Rewrite it as clear, correct, natural text in the SAME language it was spoken (normally Hebrew), as the speaker meant it.
Rules:
- Keep every fact: names, phone numbers, prices, sizes, rooms, dates, times, places, project names, what was agreed, objections, next steps. Never drop content, never add facts, never guess.
- Fix only what is obviously misheard from context; real-estate terms are common: תב"ע, טאבו, גוש, חלקה, משכנתא, היתר בנייה, דירת גן, פנטהאוז, מ"ר, דונם, הון עצמי, פינוי בינוי, תמ"א 38, זרובבל, כפר סבא, רעננה, הוד השרון, הרצליה.
- Punctuation, sentences and, for a long note, short paragraphs. Numbers as digits (3.5 מיליון, 4 חדרים, 054-1234567), times as 14:00.
- Keep the speaker's person and tone; remove filler words (אממ, כאילו, אה) and repeated false starts.
- kind "task": one short line that says what to do (e.g. "להתקשר לרונן ולשלוח תוכניות של זרובבל 15"), no trailing period.
- kind "note": the full note. If it is long (more than ~50 words) also give "summary": one short sentence with the gist; otherwise summary is "".
Return JSON only.`
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'summary'],
  properties: { text: { type: 'string' }, summary: { type: 'string' } },
}

const clean = s => String(s || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

/** A sane answer: something left, not wildly longer than what was said (no invented paragraphs) */
export function acceptPolish(raw, out) {
  const t = clean(out?.text)
  if (!t) return null
  const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length
  if (words(t) > Math.max(12, words(raw) * 1.6)) return null
  const summary = clean(out?.summary).replace(/\n+/g, ' ')
  return { text: t, summary: summary && words(raw) > 35 ? summary.slice(0, 240) : '' }
}

export async function polishDictation({ text, kind = 'note', lang = 'he' } = {}, { ask } = {}) {
  const raw = clean(text).slice(0, POLISH_MAX)
  if (!raw) return { error: 'empty', code: 'empty' }
  const r = await ask({
    system: SYSTEM,
    user: `kind: ${kind === 'task' ? 'task' : 'note'}\nlanguage of the app: ${lang === 'en' ? 'English' : 'Hebrew'}\n\nDictated text:\n${raw}`,
    schema: SCHEMA, model: 'claude-opus-5-5', maxTokens: 4000, effort: 'low', timeout: 25000,
  })
  if (!r || r.error) return { error: r?.error || 'no answer', code: r?.code || 'api' }
  const ok = acceptPolish(raw, r.data)
  return ok || { error: 'unusable answer', code: 'parse' }
}
