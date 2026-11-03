// Text out of an uploaded document (admin "תבניות" → "העלאת מסמך"): a Word file through mammoth (paragraph breaks kept), a
// PDF with a text layer through pdf-parse (pages joined, lines kept), and a scan (an image, or a PDF without a text layer)
// through Claude's vision (lib/claude-json.js) when ANTHROPIC_API_KEY is set — the office is told which way the text came
// and that a scan's text must be proofread. Nothing is rewritten: the text comes back as it is, the blocks are split by
// lib/doc-templates.js textToBlocks(). → { text, method: docx | pdf | vision | none, pages, warnings }
import { claudeJson } from './claude-json.js'

const MAX = 15 * 1024 * 1024
const isPdf = b => b.length > 4 && b.slice(0, 4).toString() === '%PDF'
const isZip = b => b.length > 2 && b[0] === 0x50 && b[1] === 0x4b
const isPng = b => b.length > 8 && b[0] === 0x89 && b[1] === 0x50
const isJpg = b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8
export function kindOf(bytes, type = '', name = '') {
  if (isPdf(bytes)) return 'pdf'
  if (isZip(bytes) && (/wordprocessingml|msword|officedocument/.test(type) || /\.docx$/i.test(name) || true)) return 'docx'
  if (isPng(bytes)) return 'png'
  if (isJpg(bytes)) return 'jpg'
  if (/^text\//.test(type) || /\.(txt|md)$/i.test(name)) return 'text'
  return ''
}

/** Word → text with paragraph breaks (mammoth's raw text keeps one blank line between paragraphs) */
export async function extractDocx(bytes) {
  const mammoth = (await import('mammoth')).default || (await import('mammoth'))
  const r = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
  return { text: String(r.value || '').replace(/\r/g, ''), warnings: (r.messages || []).map(m => m.message).slice(0, 5) }
}
/** PDF with a text layer → text, one line per text line, pages separated by a blank line */
export async function extractPdf(bytes) {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(bytes) })
  try {
    const r = await parser.getText()
    const pages = r.pages || []
    const text = pages.map(p => String(p.text || '')).join('\n\n').replace(/\r/g, '')
    return { text, pages: r.total || pages.length || 0 }
  } finally { await parser.destroy?.().catch(() => {}) }
}
const VISION_SYSTEM = 'You transcribe Hebrew (and English) business documents exactly as written, in reading order, for a real-estate office in Israel. Keep every clause number, title, blank line (________), number, date and amount exactly. Separate paragraphs with a blank line. Never summarize, translate, correct or add anything. Output JSON only.'
const VISION_SCHEMA = { type: 'object', additionalProperties: false, required: ['text', 'pages', 'confidence'], properties: { text: { type: 'string' }, pages: { type: 'integer' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] } } }
/** a scan or an image → text through Claude's vision; { text, pages, confidence } or { error } */
export async function extractVision(bytes, mime) {
  const media = mime === 'application/pdf' ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(bytes).toString('base64') } } : { type: 'image', source: { type: 'base64', media_type: mime, data: Buffer.from(bytes).toString('base64') } }
  const r = await claudeJson({ system: VISION_SYSTEM, user: [media, { type: 'text', text: 'Transcribe this document exactly. Return { text, pages, confidence }.' }], schema: VISION_SCHEMA, model: 'claude-opus-5-5', effort: 'low', maxTokens: 16000, timeout: 50000 })
  if (r.error) return { error: r.error, code: r.code }
  return { text: String(r.data?.text || ''), pages: Number(r.data?.pages) || 1, confidence: r.data?.confidence || 'medium' }
}
/** the whole thing: by the file's kind, with the scan fallback for a PDF without text */
export async function extractDocument(bytes, { type = '', name = '' } = {}) {
  if (!bytes?.length) return { error: 'הקובץ ריק' }
  if (bytes.length > MAX) return { error: 'הקובץ גדול מ-15 MB' }
  const kind = kindOf(bytes, type, name)
  const warnings = []
  try {
    if (kind === 'text') return { text: Buffer.from(bytes).toString('utf8'), method: 'text', pages: 1, warnings }
    if (kind === 'docx') { const r = await extractDocx(bytes); if (!r.text.trim()) return { error: 'לא נמצא טקסט בקובץ ה-Word' }; return { text: r.text, method: 'docx', pages: 0, warnings: r.warnings } }
    if (kind === 'pdf') {
      const r = await extractPdf(bytes).catch(e => ({ text: '', pages: 0, err: e.message }))
      if (r.text && r.text.replace(/\s+/g, '').length > 40) return { text: r.text, method: 'pdf', pages: r.pages, warnings }
      warnings.push('ל-PDF אין שכבת טקסט (סריקה) — הטקסט נקרא בעזרת AI ויש להגיה אותו')
      const v = await extractVision(bytes, 'application/pdf')
      if (v.error) return { error: v.code === 'no_key' ? 'זה PDF סרוק ללא טקסט, וקריאה בעזרת AI לא מוגדרת (ANTHROPIC_API_KEY ב-Vercel). אפשר להדביק את הטקסט ידנית.' : `קריאת הסריקה נכשלה: ${v.error}` }
      return { text: v.text, method: 'vision', pages: v.pages, confidence: v.confidence, warnings }
    }
    if (kind === 'png' || kind === 'jpg') {
      warnings.push('התמונה נקראה בעזרת AI — יש להגיה את הטקסט')
      const v = await extractVision(bytes, kind === 'png' ? 'image/png' : 'image/jpeg')
      if (v.error) return { error: v.code === 'no_key' ? 'קריאת תמונות בעזרת AI לא מוגדרת (ANTHROPIC_API_KEY ב-Vercel). אפשר להדביק את הטקסט ידנית.' : `קריאת התמונה נכשלה: ${v.error}` }
      return { text: v.text, method: 'vision', pages: v.pages, confidence: v.confidence, warnings }
    }
    return { error: 'סוג קובץ לא נתמך — Word (.docx), PDF, PNG או JPG' }
  } catch (e) { return { error: `הקריאה נכשלה: ${e.message}` } }
}
