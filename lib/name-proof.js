// A lead's name in proper Hebrew — the name the WhatsApp welcome greets and every list shows. lib/hebrew-names.js knows ~450
// first names and the common Israeli surnames and fixes the order when the surname was typed first ("Bechar Eddie" → "אדי
// בכר"); a word on no list was only transliterated letter by letter ("Bechar" used to become "בחר"). For such a name Claude
// proofreads it once, before it is saved: which word is the first name, and how an Israeli writes each word in Hebrew. Never
// blocks a lead: no key, a slow answer (8 s) or a doubtful one → the list-based result stays.
import { hebrewFullName, isLatinName, nameIsKnown } from './hebrew-names.js'
import { claudeJson } from './claude-json.js'

const SYSTEM = `You write Israeli people's names in standard Hebrew spelling, for a real-estate office's CRM.
The input is the name a lead typed into a Facebook / website form, usually in Latin letters, sometimes surname first, sometimes all caps or with typos.
Decide which word is the given (first) name and which is the family name, and write each the way the person would write it in Hebrew
(Eddie → אדי, Bechar → בכר, Chaim → חיים, Itzhak → יצחק, Moshe → משה, Ohana → אוחנה, Mizrahi → מזרחי, Abu Hatzeira → אבוחצירא).
Arabic names in their usual Hebrew spelling (Mohammed → מוחמד). Foreign names as they are pronounced (Michael → מייקל only for a clearly
non-Israeli person, else מיכאל). Keep a name the person wrote in Hebrew as is. Set confident=false when the input is not a person's name
(a company, a test, gibberish) or when you are genuinely unsure which word is the first name.`

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['first_he', 'last_he', 'confident'],
  properties: {
    first_he: { type: 'string', description: 'given name in Hebrew letters' },
    last_he: { type: 'string', description: 'family name in Hebrew letters, empty when none was typed' },
    confident: { type: 'boolean' },
  },
}

const HEB = /^[א-ת'"׳״\- ]{1,30}$/
/** the model's answer → "אדי בכר", or '' when it doesn't look like a Hebrew name */
export function acceptProof(d) {
  if (!d || d.confident !== true) return ''
  const first = String(d.first_he || '').trim(), last = String(d.last_he || '').trim()
  if (!HEB.test(first) || (last && !HEB.test(last))) return ''
  return [first, last].filter(Boolean).join(' ')
}

/** raw typed name → the Hebrew name to save (lists first, Claude for what they don't know) */
export async function properHebrewName(raw, { ask = claudeJson, timeout = 8000 } = {}) {
  const typed = String(raw ?? '').trim()
  const listed = hebrewFullName(typed)
  const [head, ...tail] = typed.split(' · ')
  if (!typed || !isLatinName(head) || nameIsKnown(head) || listed === typed) return listed
  try {
    const r = await Promise.race([
      ask({ system: SYSTEM, user: `Name as typed: ${head.slice(0, 80)}`, schema: SCHEMA, model: 'claude-opus-5-5', maxTokens: 1500, effort: 'low', timeout }),
      new Promise(res => setTimeout(() => res(null), timeout + 500)),
    ])
    const he = acceptProof(r?.data)
    return he ? [he, ...tail].join(' · ') : listed
  } catch { return listed }
}
