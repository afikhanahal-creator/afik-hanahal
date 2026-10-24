// A WhatsApp template's picture: compressed in the browser (≤ 1280 px JPEG — WhatsApp shows ~800 px anyway, and every send
// makes Green API download it once from Supabase Storage) and uploaded through the wizard's signed URL into the public
// bucket's `templates/` folder (api/seller-form.js `wizard-upload-url`, folder 'templates'), cached for a year.
// → the picture's public https URL, saved as the template's `image`.
const ADMIN_TOKEN = 'AFIKhanahal2026'
export const TEMPLATE_IMAGE_MAX = 1280
export const TEMPLATE_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif'

/** The longest side ≤ max, the ratio kept, never upscaled (pure) */
export function fitWithin(w, h, max = TEMPLATE_IMAGE_MAX) {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 }
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.round(w * k), h: Math.round(h * k) }
}

export async function compress(file, max = TEMPLATE_IMAGE_MAX) {
  // a small GIF keeps its animation; everything else becomes a JPEG on a white background (no black PNG transparency)
  if (file.type === 'image/gif' && file.size < 900 * 1024) return file
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('התמונה לא נפתחה – נסו קובץ JPG או PNG')); i.src = url })
    const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight, max)
    if (!w) throw new Error('התמונה ריקה')
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h)
    const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.84))
    if (!blob) throw new Error('הדחיסה נכשלה')
    return blob.size < file.size || file.type !== 'image/jpeg' ? new File([blob], 'image.jpg', { type: 'image/jpeg' }) : file
  } finally { URL.revokeObjectURL(url) }
}

/** file (from a picker, a drop or a paste) → { url, size } */
export async function uploadTemplateImage(file) {
  if (!file || !/^image\//.test(file.type || '')) throw new Error('אפשר לצרף רק תמונה')
  if (file.size > 25 * 1024 * 1024) throw new Error('התמונה גדולה מדי (עד 25MB)')
  const blob = await compress(file)
  const type = blob.type || 'image/jpeg'
  const ext = type === 'image/gif' ? 'gif' : 'jpg'
  const meta = await fetch('/api/seller-form?action=wizard-upload-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
    body: JSON.stringify({ name: `template.${ext}`, type, size: blob.size, kind: 'image', folder: 'templates' }),
  }).then(r => r.json().catch(() => ({}))).catch(() => ({}))
  if (!meta?.signedUrl || !meta?.url) throw new Error(meta?.error ? `ההעלאה נכשלה: ${meta.error}` : 'ההעלאה נכשלה – נסו שוב')
  const put = await fetch(meta.signedUrl, { method: 'PUT', headers: { 'Content-Type': type, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }, body: blob }).catch(() => null)
  if (!put?.ok) throw new Error('ההעלאה נכשלה – נסו שוב')
  return { url: meta.url, size: blob.size }
}

/** A small preview of a template picture through the image CDN (never the original from Supabase) */
export const imageThumb = (url, w = 160) => (url ? `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${w}&h=${w}&fit=cover&output=webp&q=70` : '')
