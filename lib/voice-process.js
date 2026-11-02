// What a voice recording becomes (the admin's mic, src/SmartVoiceInput.jsx → POST /api/meta/voice-process): Claude turns the
// raw transcript into the text the office keeps, in one of four modes — and, from anything but a task box, lists the tasks
// that were SAID ("להתקשר אליו מחר בבוקר") for the office to approve. Pure but for `ask` (lib/claude-json.js), tested with a
// fake. Nothing is invented: a fact, task or date that wasn't said is left out; what wasn't heard clearly is marked "(לבדיקה)".
//   exact — what was said, with punctuation and recognition fixes only (stutters and false starts out)
//   smart — a clear professional summary that keeps every detail
//   call  — a structured call / meeting summary: titled sections with bullet points (only the sections that have content)
//   task  — one short task line
export const VOICE_MODES = ['exact', 'smart', 'call', 'task']
export const SECTION_ORDER = ['נושא השיחה', 'פרטי הלקוח', 'צרכים ודרישות', 'פרטים חשובים', 'מחירים ותקציבים', 'החלטות', 'שאלות פתוחות', 'התחייבויות', 'פעולות המשך', 'תאריך למעקב']
export const SECTION_ORDER_EN = ['Topic', 'Client details', 'Needs', 'Key details', 'Prices and budget', 'Decisions', 'Open questions', 'Commitments', 'Next steps', 'Follow-up date']
const MAX_IN = 30000

const SYSTEM = `You process dictated notes for Afik Hanahal, a real-estate office in the Sharon region of Israel.
The input is a speech-to-text transcript (Israeli Hebrew, spoken style, sometimes English words mixed in). It may contain recognition errors, missing punctuation, pauses, self-corrections ("לא, רגע, ביום שלישי"), stutters and unfinished sentences.
Golden rule: be faithful. Keep every fact — names (people, streets, towns, projects), phone numbers, prices, budgets, sizes, rooms, floors, dates, times, decisions, objections, promises. Never invent a fact, a task or a date. Never change the meaning. When the speaker corrected themselves, keep the corrected version only.
Fix recognition errors only when the context makes the intended word obvious (real-estate words are common: תב"ע, טאבו, גוש, חלקה, משכנתא, היתר בנייה, דירת גן, פנטהאוז, מ"ר, דונם, הון עצמי, פינוי בינוי, תמ"א 38, שמאי, יזם, קבלן). If a word, name or number is unclear, keep it and add " (לבדיקה)" right after it, and list it in "review".
Write numbers as digits (4 חדרים, 3.5 מיליון ₪, 054-1234567, 14:00). Keep English words that were said in English as they are.
Write natural, correct, fluent Hebrew (or English if the app language is English and the speech was English).

Modes:
- "exact": the speaker's own words, cleaned: punctuation, sentences, paragraphs for a long text; remove stutters, filler words (אממ, אה, כאילו) and false starts. Do not summarize. sections = [].
- "smart": a professional, well-organized summary in paragraphs that keeps every important detail (names, numbers, dates, what was agreed, next steps). Shorter than the transcript, never missing a fact. sections = [].
- "call": a structured summary of a call or meeting. Fill "sections" using ONLY these titles, in this order, and only those that have content: ${SECTION_ORDER.join(' · ')}. Each section has short bullet items (no bullet characters). "text" = "".
- "task": one short line that says what to do (e.g. "להתקשר לרונן ולשלוח תוכניות של זרובבל 15"), no trailing period. sections = [], tasks = [].

Tasks (every mode except "task"): list each action the speaker said should be done ("תתקשר אליו מחר בבוקר", "צריך לשלוח הצעת מחיר", "לתאם פגישה לשבוע הבא", "לבדוק מול האדריכל את ההיתר"). Only actions that were said — never suggest your own. For each: title (short, starts with a verb in the infinitive: להתקשר, לשלוח, לתאם, לבדוק), description (the details said, or ""), due, dueSaid (the words that set the time, or ""), owner (who should do it if said, else ""), uncertain (true when the time or the action is not clear).
due: compute from what was said, relative to "now" given below, Israel time. Format "YYYY-MM-DDTHH:mm" when a time of day was said ("בבוקר" = 09:00, "בצהריים" = 13:00, "אחר הצהריים" = 16:00, "בערב" = 19:00, "בשלוש" in a work context = 15:00), "YYYY-MM-DD" when only a day was said, "" when no time was said. "יום ראשון" = the next Sunday; "שבוע הבא" without a day = "" and uncertain true.
Return JSON only.`

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['text', 'summary', 'sections', 'tasks', 'review'],
  properties: {
    text: { type: 'string' },
    summary: { type: 'string' },
    sections: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'items'], properties: { title: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } } } },
    tasks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'description', 'due', 'dueSaid', 'owner', 'uncertain'],
      properties: { title: { type: 'string' }, description: { type: 'string' }, due: { type: 'string' }, dueSaid: { type: 'string' }, owner: { type: 'string' }, uncertain: { type: 'boolean' } } } },
    review: { type: 'array', items: { type: 'string' } },
  },
}

const clean = s => String(s || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length
const one = s => clean(s).replace(/\n+/g, ' ')

/** Israel-local "now" for the model: "Monday 2026-11-02 15:40" */
export function israelNow(now = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(now)).map(x => [x.type, x.value]))
  return { text: `${p.weekday} ${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`, date: `${p.year}-${p.month}-${p.day}` }
}

/** A due the model gave: "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm", not before today; anything else → '' */
export function cleanDue(v, today) {
  const s = String(v || '').trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/)
  if (!m) return ''
  const [, y, mo, d, h, mi] = m
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31 || (h != null && (+h > 23 || +mi > 59))) return ''
  if (today && `${y}-${mo}-${d}` < today) return ''
  return s
}

/** Sections → the note's text: a title line, then "• item" lines; a blank line between sections */
export function composeSections(sections = [], lang = 'he') {
  const order = lang === 'en' ? SECTION_ORDER_EN : SECTION_ORDER
  const list = (Array.isArray(sections) ? sections : [])
    .map(s => ({ title: one(s?.title), items: (Array.isArray(s?.items) ? s.items : []).map(one).filter(Boolean) }))
    .filter(s => s.title && s.items.length)
  list.sort((a, b) => { const i = order.indexOf(a.title), j = order.indexOf(b.title); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) })
  return list.map(s => `${s.title}:\n${s.items.map(x => `• ${x}`).join('\n')}`).join('\n\n')
}

/** The model's answer → what the screen shows; null when it looks invented (much longer than what was said) */
export function shapeResult(raw, out, mode, { today, lang = 'he' } = {}) {
  if (!out || typeof out !== 'object') return null
  const said = words(raw)
  let text = mode === 'call' ? composeSections(out.sections, lang) : clean(out.text)
  if (mode === 'call' && !text) text = clean(out.text)
  if (!text) return null
  const limit = mode === 'call' ? Math.max(40, said * 2.4) : mode === 'task' ? Math.max(20, said * 1.5) : Math.max(14, said * 1.6)
  if (words(text) > limit) return null
  if (mode === 'task') text = one(text).replace(/[.。]\s*$/, '')
  const tasks = mode === 'task' ? [] : (Array.isArray(out.tasks) ? out.tasks : []).map(t => ({
    title: one(t?.title).replace(/[.]\s*$/, '').slice(0, 140),
    description: one(t?.description).slice(0, 400),
    due: cleanDue(t?.due, today),
    dueSaid: one(t?.dueSaid).slice(0, 60),
    owner: one(t?.owner).slice(0, 60),
    uncertain: !!t?.uncertain,
  })).filter(t => t.title).slice(0, 8)
  const summary = mode === 'exact' && said > 60 ? one(out.summary).slice(0, 280) : ''
  const review = (Array.isArray(out.review) ? out.review : []).map(one).filter(Boolean).slice(0, 10)
  return { mode, text, summary, tasks, review }
}

/** → { mode, text, summary, tasks, review } | { error, code } */
export async function processVoice({ transcript, mode = 'exact', contextType = 'note', lang = 'he', hint = '', now = Date.now() } = {}, { ask } = {}) {
  const raw = clean(transcript).slice(0, MAX_IN)
  if (!raw) return { error: 'empty transcript', code: 'empty' }
  const m = VOICE_MODES.includes(mode) ? mode : 'exact'
  const n = israelNow(now)
  const r = await ask({
    system: SYSTEM,
    user: [
      `mode: ${m}`,
      `where it will be saved: ${String(contextType || 'note').slice(0, 30)}`,
      `app language: ${lang === 'en' ? 'English' : 'Hebrew'}`,
      `now (Israel): ${n.text}`,
      hint ? `context (names and words that may appear): ${String(hint).slice(0, 600)}` : '',
      '',
      'Transcript:',
      raw,
    ].filter(x => x !== '').join('\n'),
    schema: SCHEMA, model: 'claude-opus-5-5', maxTokens: 8000, effort: 'low', timeout: 40000,
  })
  if (!r || r.error) return { error: r?.error || 'no answer', code: r?.code || 'api' }
  return shapeResult(raw, r.data, m, { today: n.date, lang }) || { error: 'unusable answer', code: 'parse' }
}
