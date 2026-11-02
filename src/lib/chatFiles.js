// Files attached in a WhatsApp chat (the chats tab, the Lead Center, the lead card) — like WhatsApp itself: photos, videos,
// PDFs, Word / Excel, several at once, picked, dropped or pasted. The browser uploads each one straight to Supabase Storage
// (the wizard's signed URL, folder 'chat' → property-media/chat/<month>/…; no file ever goes through a Vercel function) and
// the server sends it by URL (Green API sendFileByUrl: the lead gets a real attachment, its original name, the text as the
// caption). Photos are compressed first (≤ 1600 px JPEG, like WhatsApp does). Pure helpers are tested.
import { compress } from './templateImage.js'
import { templateFiles, templateImage } from '../../lib/automations-shared.js'

const ADMIN_TOKEN = 'AFIKhanahal2026'
export const CHAT_FILE_MAX_MB = 50
export const CHAT_ACCEPT = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.dwg,.kmz,.heic'
export const MAX_FILES = 30   // WhatsApp's own limit for one send

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
export async function uploadChatFile(file, folder = 'chat') {
  const kind = fileKind(file)
  let body = file, name = file.name || 'file'
  if (kind === 'image' && !/gif/.test(file.type)) {
    try { body = await compress(file, 1600); if (body !== file) name = name.replace(/\.[a-z0-9]+$/i, '') + '.jpg' } catch { body = file }
  }
  const type = body.type || file.type || 'application/octet-stream'
  const meta = await fetch('/api/seller-form?action=wizard-upload-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify({ name, type, size: body.size, kind, folder }),
  }).then(r => r.json().catch(() => ({}))).catch(() => ({}))
  if (!meta?.signedUrl || !meta?.url) throw new Error(meta?.error ? `ההעלאה נכשלה: ${meta.error}` : 'ההעלאה נכשלה, נסו שוב')
  const put = await fetch(meta.signedUrl, { method: 'PUT', headers: { 'Content-Type': type, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }, body }).catch(() => null)
  if (!put?.ok) throw new Error('ההעלאה נכשלה, נסו שוב')
  return { url: meta.url, fileName: name, type, size: body.size }
}

const isStored = f => !!(f?.url && !(typeof File !== 'undefined' && f instanceof File))
/** Photos and videos first, in their order, then the documents: WhatsApp shows media that arrive back to back as one
 *  album, so they go together (the order in the tray = the order sent) */
export function mediaFirst(list, get = x => x) {
  const media = [], rest = []
  for (const x of list || []) (/^(image|video)$/.test(fileKind(get(x) || {})) ? media : rest).push(x)
  return [...media, ...rest]
}

/** Upload every file that isn't in storage yet, 3 at a time → [{ url, fileName }] in the same order (throws with .index) */
export async function uploadAll(files, onProgress, { concurrency = 3, upload = uploadChatFile, folder = 'chat' } = {}) {
  const out = new Array(files.length)
  let next = 0, failed = null
  const worker = async () => {
    while (failed == null && next < files.length) {
      const i = next++
      const f = files[i]
      if (isStored(f)) { out[i] = { url: f.url, fileName: f.name || 'file', type: f.type || '', size: f.size || 0 }; continue }
      onProgress?.(i, 'uploading')
      try { out[i] = await upload(f, folder) } catch (e) { failed = failed ?? i; onProgress?.(i, 'error'); throw Object.assign(new Error(e.message || 'upload failed'), { index: i }) }
      onProgress?.(i, 'ready')
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker))
  return out
}

/**
 * Send the tray as one group, like WhatsApp: everything is uploaded first (3 at a time — so the files then go out back to back
 * and the photos arrive as one album), then sent in order with the text as the first one's caption. With `sendGroup(items,
 * caption)` the whole group is one request (the server sends them one after another, POST /api/meta/chat-send-files); else
 * `sendOne(text, { file, fileName })` per file. Stops at the first failure → { ok, sent, error, quota }
 */
export async function sendFiles(files, caption, sendOne, onProgress, { sendGroup } = {}) {
  let ups
  try { ups = await uploadAll(files, onProgress) } catch (e) { return { ok: false, sent: 0, error: e.message } }
  if (sendGroup) {
    files.forEach((_, i) => onProgress?.(i, 'sending'))
    const r = await sendGroup(ups.map(u => ({ file: u.url, fileName: u.fileName })), caption).catch(e => ({ ok: false, sent: 0, error: e.message }))
    const sent = Math.max(0, Math.min(files.length, Number(r?.sent) || (r?.ok ? files.length : 0)))
    files.forEach((_, i) => onProgress?.(i, i < sent ? 'sent' : (r?.ok ? 'sent' : i === sent ? 'error' : '')))
    return r?.ok ? { ok: true, sent: files.length } : { ok: false, sent, error: r?.error || 'השליחה נכשלה', quota: !!r?.quota }
  }
  let sent = 0
  for (const [i, up] of ups.entries()) {
    onProgress?.(i, 'sending')
    const r = await sendOne(i === 0 ? caption : '', { file: up.url, fileName: up.fileName })
    if (!r?.ok) { onProgress?.(i, 'error'); return { ok: false, sent, error: r?.error || 'השליחה נכשלה', quota: !!r?.quota } }
    onProgress?.(i, 'sent'); sent++
  }
  return { ok: true, sent }
}

/** The group request: the server sends the files one after another to one chat (POST /api/meta/chat-send-files); when it
 *  stops near its time limit (`partial`) the rest goes in the next request → { ok, sent, error, quota } */
export async function sendGroupRequest(phone, items, caption, { quotedMessageId, fetchImpl = fetch } = {}) {
  let sent = 0
  for (let round = 0; round < 6 && sent < items.length; round++) {
    const first = sent === 0
    const r = await fetchImpl('/api/meta/chat-send-files', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ phone, caption: first ? caption || '' : '', items: items.slice(sent), ...(first && quotedMessageId ? { quotedMessageId } : {}) }),
      signal: AbortSignal.timeout(65000) }).catch(e => ({ ok: false, json: async () => ({ error: e.name === 'TimeoutError' ? 'השרת לא ענה בזמן' : e.message }) }))
    const d = await r.json().catch(() => ({}))
    const n = Math.max(0, Number(d.sent) || 0)
    sent += n
    if (d.ok && r.ok) return { ok: true, sent: items.length }
    if (!d.partial || !n) return { ok: false, sent, error: d.error || 'השליחה נכשלה', quota: !!d.quota }
  }
  return sent >= items.length ? { ok: true, sent } : { ok: false, sent, error: 'השליחה נכשלה' }
}

/** A template's attachments for the box / a direct send: its files, with its picture first when it has files too (a
 *  picture alone stays the text's own image, sent with the text as its caption) */
export function templateAttachments(tpl) {
  const files = templateFiles(tpl)
  if (!files.length) return []
  const img = templateImage(tpl)
  return img && !files.some(f => f.url === img) ? [{ url: img, name: (img.split(/[?#]/)[0].split('/').pop() || 'image.jpg').slice(-80), type: 'image/jpeg', size: 0 }, ...files] : files
}
