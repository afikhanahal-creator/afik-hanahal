// Google News RSS links are redirects (news.google.com/rss/articles/<id>) that expose neither the
// publisher URL nor an image. This resolves them to the real article URL so the ingest can store a
// clickable outlet link and fetch the og:image.
//   legacy ids  — base64url protobuf with the URL embedded in clear text → decoded offline
//   current ids — payload starts with "AU_yqL…" → needs Google's batchexecute endpoint
//                 (signature + timestamp scraped from the article's interstitial page)
import { RSS_HEADERS } from './sources.js'

export function gnArticleId(url) {
  const m = String(url || '').match(/news\.google\.com\/(?:rss\/)?articles\/([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}
export const isGoogleNewsUrl = url => !!gnArticleId(url)

function b64url(s) { return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64') }

// Returns a URL string (legacy id), { modern: 'AU_yqL…' } (current id), or null.
export function decodeLegacyGnId(id) {
  try {
    let b = b64url(id)
    if (b[0] !== 0x08 || b[1] !== 0x13 || b[2] !== 0x22) return null
    b = b.subarray(3)
    let len = b[0], i = 1
    if (len & 0x80) { len = (len & 0x7f) | (b[1] << 7); i = 2 }
    const s = b.subarray(i, i + len).toString('utf8')
    if (/^https?:\/\//.test(s)) return s
    if (s.startsWith('AU_yqL')) return { modern: s }
    return null
  } catch { return null }
}

// Parse the batchexecute response: `)]}'\n\n<json>` where one entry's [2] is a JSON string
// whose element [1] is the resolved URL.
export function parseBatchexecute(text) {
  const chunk = String(text).split('\n\n').slice(1).join('\n\n').replace(/^\d+\n/, '')
  let arr
  try { arr = JSON.parse(chunk) } catch { return null }
  for (const entry of Array.isArray(arr) ? arr : []) {
    const inner = Array.isArray(entry) ? entry[2] : null
    if (typeof inner !== 'string' || !inner.includes('http')) continue
    try { const u = JSON.parse(inner)?.[1]; if (typeof u === 'string' && /^https?:\/\//.test(u)) return u } catch {}
  }
  return null
}

export async function resolveGoogleNewsUrl(url, { timeoutMs = 6000, fetchImpl = fetch } = {}) {
  const id = gnArticleId(url)
  if (!id) return url
  const legacy = decodeLegacyGnId(id)
  if (typeof legacy === 'string') return legacy
  try {
    const page = await fetchImpl(`https://news.google.com/articles/${id}`, { headers: RSS_HEADERS, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' })
    if (!page.ok) return null
    const html = await page.text()
    const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1], ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1]
    if (!sg || !ts) return null
    const payload = ['Fbv4je', `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`]
    const r = await fetchImpl('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST', signal: AbortSignal.timeout(timeoutMs),
      headers: { ...RSS_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'f.req=' + encodeURIComponent(JSON.stringify([[payload]])),
    })
    if (!r.ok) return null
    return parseBatchexecute(await r.text())
  } catch { return null }
}
