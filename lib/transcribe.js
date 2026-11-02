// Speech-to-text on the server (the admin's mic, src/SmartVoiceInput.jsx → POST /api/meta/voice-transcribe): one recorded
// segment (≤ 4 MB — the browser cuts a long recording into 2-minute pieces) goes straight to the provider and only the text
// comes back. Nothing is stored. Providers, first one configured wins: OPENAI_API_KEY (gpt-4o-transcribe) · ELEVENLABS_API_KEY
// (Scribe). Both are good at Israeli Hebrew; a vocabulary hint (towns, projects, real-estate words, the lead's name) helps
// with names. Without a key the browser's own speech recognition is used instead (src/lib/voiceService.js).

export const MAX_SEGMENT_BYTES = 4 * 1024 * 1024
export const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac']

export function voiceProvider(env = process.env) {
  if (String(env.OPENAI_API_KEY || '').trim()) return 'openai'
  if (String(env.ELEVENLABS_API_KEY || '').trim()) return 'elevenlabs'
  return ''
}

/** The words that are easy to mishear: our towns, streets, projects and trade words (+ what the screen knows) */
export const BASE_VOCAB = ['אפיק הנחל', 'כפר סבא', 'רעננה', 'הוד השרון', 'הרצליה', 'נתניה', 'רמת השרון', 'כוכב יאיר', 'צור יגאל', 'זרובבל',
  'תב"ע', 'טאבו', 'גוש', 'חלקה', 'משכנתא', 'היתר בנייה', 'דירת גן', 'פנטהאוז', 'מ"ר', 'דונם', 'הון עצמי', 'פינוי בינוי', 'תמ"א 38', 'קבלן', 'יזם', 'שמאי', 'עורך דין', 'מס רכישה']
export function vocabHint(extra = []) {
  const words = [...new Set([...extra.map(x => String(x || '').trim()).filter(Boolean), ...BASE_VOCAB])].slice(0, 60)
  return words.join(', ').slice(0, 800)
}

export const cleanMime = m => {
  const base = String(m || '').toLowerCase().split(';')[0].trim()
  return AUDIO_TYPES.includes(base) ? base : ''
}
const extFor = m => ({ 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' }[m] || 'webm')

/** → { text, provider } | { error, code } */
export async function transcribeAudio(buf, { mime, lang = 'he', hint = '' } = {}, { env = process.env, fetchImpl = fetch } = {}) {
  const provider = voiceProvider(env)
  if (!provider) return { error: 'No speech-to-text key in Vercel (OPENAI_API_KEY or ELEVENLABS_API_KEY)', code: 'no_provider' }
  if (!buf || !buf.length) return { error: 'empty audio', code: 'empty' }
  if (buf.length > MAX_SEGMENT_BYTES) return { error: 'audio segment too large', code: 'too_large' }
  const type = cleanMime(mime)
  if (!type) return { error: 'unsupported audio format', code: 'format' }
  const file = new Blob([buf], { type })
  const fd = new FormData()
  let url, headers
  if (provider === 'openai') {
    fd.append('file', file, `voice.${extFor(type)}`)
    fd.append('model', 'gpt-4o-transcribe')
    fd.append('language', lang === 'en' ? 'en' : 'he')
    fd.append('response_format', 'json')
    if (hint) fd.append('prompt', `מילים שעשויות להופיע: ${hint}`)
    url = 'https://api.openai.com/v1/audio/transcriptions'
    headers = { Authorization: `Bearer ${String(env.OPENAI_API_KEY).trim()}` }
  } else {
    fd.append('file', file, `voice.${extFor(type)}`)
    fd.append('model_id', 'scribe_v1')
    fd.append('language_code', lang === 'en' ? 'eng' : 'heb')
    fd.append('tag_audio_events', 'false')
    url = 'https://api.elevenlabs.io/v1/speech-to-text'
    headers = { 'xi-api-key': String(env.ELEVENLABS_API_KEY).trim() }
  }
  let r
  try { r = await fetchImpl(url, { method: 'POST', headers, body: fd, signal: AbortSignal.timeout(50000) }) }
  catch (e) { return { error: e?.name === 'TimeoutError' ? 'the speech service did not answer in time' : 'the speech service could not be reached', code: 'network', provider } }
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = d?.error?.message || d?.detail?.message || d?.detail || `HTTP ${r.status}`
    const code = r.status === 401 ? 'auth' : r.status === 429 ? 'rate' : r.status === 400 || r.status === 415 ? 'format' : 'api'
    return { error: `${provider}: ${String(msg).slice(0, 200)}`, code, provider }
  }
  return { text: String(d.text || '').replace(/\s+/g, ' ').trim(), provider }
}
