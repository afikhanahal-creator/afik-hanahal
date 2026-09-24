// Property share links: https://afikhanahal.co.il/p/<id>
// Social / chat crawlers (Facebook, Instagram, WhatsApp, LinkedIn, X, Telegram…) get a small HTML page
// with the property's own title, price, specs and photo (Open Graph + JSON-LD), so every post and ad
// shows the right preview. People are redirected straight to the property on the site, keeping any
// campaign parameters (utm_*, fbclid, lang) so leads are attributed to the ad that brought them.

const BOT_RX = /(facebookexternalhit|facebot|facebookcatalog|meta-externalagent|instagram|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|skypeuripreview|pinterest|redditbot|vkshare|applebot|googlebot|bingbot|embedly|quora link preview|outbrain|w3c_validator|iframely|viber|snapchat|tiktok|yandex|duckduckbot|google-inspectiontool|chrome-lighthouse)/i
export const isPreviewBot = ua => BOT_RX.test(String(ua || ''))

const CAT_HE = { projects: 'פרויקט בשיווק', land: 'מגרש / קרקע', apartments: 'דירה למכירה', rentals: 'נכס להשכרה', commercial: 'נכס מסחרי' }
const CAT_EN = { projects: 'Project for sale', land: 'Plot / land', apartments: 'Apartment for sale', rentals: 'Property for rent', commercial: 'Commercial property' }

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function formatPrice(price, lang = 'he') {
  const raw = String(price ?? '').trim()
  if (!raw) return ''
  const digits = raw.replace(/[^\d]/g, '')
  if (digits.length >= 4 && /^[\d,.\s₪]+$/.test(raw.replace(/ש"ח|nis|ils/gi, ''))) return `₪${Number(digits).toLocaleString('en-US')}`
  return raw
}

// Absolute, crawler-friendly image URL (Supabase public files go through the /media CDN proxy)
export function absoluteImage(url, origin) {
  const u = String(url || '').trim()
  if (!u || u.startsWith('data:') || u.startsWith('blob:')) return ''
  const pub = u.indexOf('.supabase.co/storage/v1/object/public/')
  if (pub > 0) return `${origin}/media/${u.slice(pub + '.supabase.co/storage/v1/object/public/'.length).split('?')[0]}`
  if (u.includes('cloudinary.com') && u.includes('/image/upload/') && !/\/(?:w_\d|q_auto|f_auto)/.test(u)) return u.replace('/image/upload/', '/image/upload/w_1200,h_630,c_fill,q_auto:good,f_jpg/')
  if (u.startsWith('//')) return `https:${u}`
  if (u.startsWith('/')) return `${origin}${u}`
  return /^https?:\/\//.test(u) ? u : ''
}

export function propertyMeta(p = {}, { origin, lang = 'he' } = {}) {
  const en = lang === 'en'
  const title = String(p.title || '').trim() || (en ? 'Property for sale' : 'נכס למכירה')
  const place = [p.location, p.neighborhood].filter(Boolean).join(', ')
  const price = formatPrice(p.price, lang)
  const specs = [
    (en ? CAT_EN : CAT_HE)[p.category] && !p.type ? (en ? CAT_EN : CAT_HE)[p.category] : p.type,
    p.rooms && (en ? `${p.rooms} rooms` : `${p.rooms} חדרים`),
    (p.size || p.buildSqm) && (en ? `${p.size || p.buildSqm} sqm` : `${p.size || p.buildSqm} מ״ר`),
    p.dunams && (en ? `${p.dunams} dunams` : `${p.dunams} דונם`),
  ].filter(Boolean)
  const sold = /נמכר|הושכר|sold|rented/i.test(p.status || '')
  const head = [sold ? (en ? 'Sold' : 'נמכר') : '', price].filter(Boolean).join(' · ')
  const desc = String(p.description || '').replace(/\s+/g, ' ').trim()
  const description = [head, specs.join(' · '), desc.slice(0, 160) + (desc.length > 160 ? '…' : '')].filter(Boolean).join(' — ')
  const image = (p.images || []).map(i => absoluteImage(i, origin)).find(Boolean) || `${origin}/img/og-default.png`
  return {
    title: place ? `${title} | ${place}` : title,
    description: description || (en ? 'Afik Hanahal — real estate marketing & brokerage in the Sharon region' : 'אפיק הנחל — שיווק ותיווך נדל״ן בשרון'),
    image, place, price, specs, sold,
    url: `${origin}/p/${encodeURIComponent(p.id)}`,
  }
}

// Where a person lands: the property window on the site, with the ad's parameters carried over
export function targetUrl(id, query = {}) {
  const q = new URLSearchParams()
  q.set('p', String(id))
  for (const [k, v] of Object.entries(query || {})) {
    if (k === 'id' || k === 'share' || k === 'p' || v == null || v === '') continue
    if (/^(utm_[a-z]+|fbclid|gclid|ttclid|lang|ref)$/.test(k)) q.set(k, String(Array.isArray(v) ? v[0] : v).slice(0, 200))
  }
  return `/?${q.toString()}#properties`
}

export function renderSharePage(p, { origin, lang = 'he', target }) {
  const m = propertyMeta(p, { origin, lang })
  const dir = lang === 'en' ? 'ltr' : 'rtl'
  const price = Number(String(p.price || '').replace(/[^\d]/g, ''))
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: m.title, description: m.description, url: m.url, image: m.image,
    ...(price > 1000 ? { offers: { '@type': 'Offer', price, priceCurrency: 'ILS', availability: m.sold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' } } : {}),
    ...(p.location ? { contentLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: p.location, addressCountry: 'IL' } } } : {}),
    provider: { '@id': 'https://afikhanahal.co.il/#org' },
  }
  const go = esc(target)
  return `<!doctype html>
<html lang="${lang === 'en' ? 'en' : 'he'}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(m.title)} | אפיק הנחל</title>
<meta name="description" content="${esc(m.description)}">
<link rel="canonical" href="${esc(m.url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="אפיק הנחל – Afik Hanahal">
<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'he_IL'}">
<meta property="og:title" content="${esc(m.title)}">
<meta property="og:description" content="${esc(m.description)}">
<meta property="og:url" content="${esc(m.url)}">
<meta property="og:image" content="${esc(m.image)}">
<meta property="og:image:secure_url" content="${esc(m.image)}">
<meta property="og:image:alt" content="${esc(m.title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(m.title)}">
<meta name="twitter:description" content="${esc(m.description)}">
<meta name="twitter:image" content="${esc(m.image)}">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;background:#F4F5F9;color:#171A2C;display:flex;min-height:100vh;align-items:center;justify-content:center}a.c{display:block;max-width:480px;margin:16px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(20,24,60,.12);text-decoration:none;color:inherit}img{width:100%;aspect-ratio:1.91/1;object-fit:cover;display:block}div{padding:16px 18px}h1{font-size:18px;margin:0 0 6px}p{margin:0;color:#555;font-size:14px;line-height:1.5}b{display:inline-block;margin-top:12px;background:#3F49A6;color:#fff;border-radius:10px;padding:9px 16px;font-size:14px}</style>
</head>
<body>
<a class="c" href="${go}"><img src="${esc(m.image)}" alt=""><div><h1>${esc(m.title)}</h1><p>${esc(m.description)}</p><b>${lang === 'en' ? 'View the property' : 'לצפייה בנכס'}</b></div></a>
<script>location.replace(${JSON.stringify(target).replace(/</g, '\\u003c')})</script>
</body>
</html>`
}
