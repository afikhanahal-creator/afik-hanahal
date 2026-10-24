// Files attached in a WhatsApp chat (the chats tab, the Lead Center, the lead card) — like WhatsApp itself: photos, videos,
// PDFs, Word / Excel, several at once, picked, dropped or pasted. The browser uploads each one straight to Supabase Storage
// (the wizard's signed URL, folder 'chat' → property-media/chat/<month>/…; no file ever goes through a Vercel function) and
// the server sends it by URL (Green API sendFileByUrl: the lead gets a real attachment, its original name, the text as the
// caption). Photos are compressed first (≤ 1600 px JPEG, like WhatsApp does). Pure helpers are tested.
import { compress } from './templateImage.js'

const ADMIN_TOKEN = 'AFIKhanahal2026'
export const CHAT_FILE_MAX_MB = 50
export const CHAT_ACCEPT = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.dwg,.kmz,.heic'
export const MAX_FILES = 10

/** → 'image' | 'video' | 'pdf' | 'doc' (the upload kind and the icon) */
export function fileKind(f) {
  const t = String(f?.type || ''), n = String(f?.name || '').toLowerCase()
  if (t.startsWith('image/') && !/svg/.test(t)) return 'image'
  if (t.startsWith('video/')) return 'video'
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'
  return 'doc'
}
/** 1536 → "1.5 KB"; 3_400_000 → "3.2 MB" */
export function formatSize(n, lang = 'he') {
  const b = Number(n) || 0
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
/** Why a file can't be sent ('' = fine) */
export function fileProblem(f, lang = 'he') {
  if (!f) return lang === 'en' ? 'No file' : 'אין קובץ'
  if (f.size > CHAT_FILE_MAX_MB * 1024 * 1024) return lang === 'en' ? `Too large (up to ${CHAT_FILE_MAX_MB} MB)` : `גדול מדי (עד ${CHAT_FILE_MAX_MB}MB)`
  if (/^(text\/html|application\/(xhtml|javascript|x-msdownload|x-sh))|image\/svg/i.test(f.type || '') || /\.(exe|bat|cmd|sh|js|html?|svg)$/i.test(f.name || '')) return lang === 'en' ? 'This file type cannot be sent' : 'אי אפשר לשלוח סוג קובץ כזה'
  return ''
}
/** Files from a picker / drop / paste → the ones to add (the rest with a reason), at most MAX_FILES in the tray */
export function acceptFiles(list, have = 0, lang = 'he') {
  const ok = [], bad = []
  for (const f of Array.from(list || [])) {
    const why = fileProblem(f, lang)
    if (why) bad.push({ name: f.name, why })
    else if (have + ok.length >= MAX_FILES) bad.push({ name: f.name, why: lang === 'en' ? `Up to ${MAX_FILES} files at once` : `עד ${MAX_FILES} קבצים בבת אחת` })
    else ok.push(f)
  }
  return { ok, bad }
}

/** Upload one file → { url, fileName, type } (throws a readable error) */
export async function uploadChatFile(file) {
  const kind = fileKind(file)
  let body = file, name = file.name || 'file'
  if (kind === 'image' && !/gif/.test(file.type)) {
    try { body = await compress(file, 1600); if (body !== file) name = name.replace(/\.[a-z0-9]+$/i, '') + '.jpg' } catch { body = file }
  }
  const type = body.type || file.type || 'application/octet-stream'
  const meta = await fetch('/api/seller-form?action=wizard-upload-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify({ name, type, size: body.size, kind, folder: 'chat' }),
  }).then(r => r.json().catch(() => ({}))).catch(() => ({}))
  if (!meta?.signedUrl || !meta?.url) throw new Error(meta?.error ? `ההעלאה נכשלה: ${meta.error}` : 'ההעלאה נכשלה, נסו שוב')
  const put = await fetch(meta.signedUrl, { method: 'PUT', headers: { 'Content-Type': type, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }, body }).catch(() => null)
  if (!put?.ok) throw new Error('ההעלאה נכשלה, נסו שוב')
  return { url: meta.url, fileName: name, type }
}

/**
 * Send the tray: every file in order (the text as the first one's caption, like WhatsApp), through `sendOne(text, { file,
 * fileName })` → { ok, error, quota }. Stops at the first failure. → { ok, sent, error, quota }
 */
export async function sendFiles(files, caption, sendOne, onProgress) {
  let sent = 0
  for (const [i, f] of files.entries()) {
    onProgress?.(i, 'uploading')
    let up
    try { up = await uploadChatFile(f) } catch (e) { onProgress?.(i, 'error'); return { ok: false, sent, error: e.message } }
    onProgress?.(i, 'sending')
    const r = await sendOne(i === 0 ? caption : '', { file: up.url, fileName: up.fileName })
    if (!r?.ok) { onProgress?.(i, 'error'); return { ok: false, sent, error: r?.error || 'השליחה נכשלה', quota: !!r?.quota } }
    onProgress?.(i, 'sent'); sent++
  }
  return { ok: true, sent }
}
