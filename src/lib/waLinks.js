// Links inside WhatsApp / Messenger / Instagram message text (src/waFormat.jsx draws them as real <a> tags).
// A link ends before trailing punctuation that belongs to the sentence ("…/p/12." / "(www.x.co)") — like WhatsApp
export function splitLink(raw) {
  let url = String(raw || '')
  while (url.length) {
    const c = url[url.length - 1]
    if (/[.,!?;:'"\u00BB\u201D\u2019\u05F3\u05F4]/.test(c)) { url = url.slice(0, -1); continue }
    if (c === ')' && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) { url = url.slice(0, -1); continue }
    if (c === ']' && !url.includes('[')) { url = url.slice(0, -1); continue }
    break
  }
  return { url, rest: String(raw || '').slice(url.length), href: /^https?:\/\//i.test(url) ? url : `https://${url}` }
}
