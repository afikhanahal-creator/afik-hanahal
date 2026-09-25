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

// ── Instant property landing: /p/<id> for everyone ───────────────────────────────────────────────
// The SPA needs ~230 KB of JavaScript before it can draw anything, which takes more than a second on
// a slow phone. So a shared link gets the property itself as plain HTML — photo, title, price, specs,
// description, WhatsApp / call — painted with no JavaScript at all, and the full site (the same
// index.html + bundle) loads underneath and takes over: App.jsx opens the property window with the
// embedded data and then removes this layer. The same page carries the property's Open Graph tags, so
// link-preview crawlers get the right card from the CDN too. Written per property at deploy time
// (scripts/build-properties.mjs → dist/p/<id>/index.html) and by api/properties.js for newer ones.
const PHONE = '+972559811814'
const WA = 'https://wa.me/972559811814'
const L = {
  he: { call: 'התקשרו', wa: 'שלחו הודעה בוואטסאפ', loading: 'טוענים את כל הפרטים…', site: 'לאתר המלא', sold: 'נמכר', gone: 'הנכס הזה כבר לא מפורסם — מעבירים אתכם לכל הנכסים…', waText: 'שלום, אשמח לפרטים על הנכס' },
  en: { call: 'Call us', wa: 'Message us on WhatsApp', loading: 'Loading all the details…', site: 'Full website', sold: 'Sold', gone: 'This property is no longer listed — taking you to all properties…', waText: 'Hello, I would like details about the property' },
}
const both = (k, extra = '') => `<span class="l-he"${extra}>${esc(L.he[k])}</span><span class="l-en"${extra}>${esc(L.en[k])}</span>`
export const CDN_BASE = 'https://wsrv.nl/?url='
export const cdnImg = (url, w, base = CDN_BASE) => (url && /^https?:\/\//.test(url) ? `${base}${encodeURIComponent(url)}&w=${w}&q=72&output=webp&we` : url)
// The photo sizes a landing page offers (1x phones · 2x phones and tablets · desktop)
export const LANDING_WIDTHS = [480, 900, 1400]
export const LANDING_SIZES = '(min-width: 900px) 760px, 100vw'
// A 24px-wide JPEG of the photo, for the inline blurred placeholder (fetched at build time)
export const lqipUrl = (url, base = CDN_BASE) => (url && /^https?:\/\//.test(url) ? `${base}${encodeURIComponent(url)}&w=24&h=15&fit=cover&q=45&output=jpg` : '')
// Every CDN variant a landing page can request — warmed at deploy time so the first visitor never waits on a resize
export const landingImageUrls = (p, origin) => {
  const img = propertyMeta(p, { origin }).image
  if (!img || img.endsWith('/img/og-default.png')) return []
  return [...LANDING_WIDTHS.map(w => cdnImg(img, w)), lqipUrl(img)]
}
// JSON inside <script>: no "</script>", no U+2028/9 surprises
const inlineJson = v => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

const PRE_CSS = `html{opacity:1!important}
#afik-pre{position:fixed;inset:0;z-index:2147483000;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#09090F;color:#E8E4D8;font-family:Rubik,Heebo,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;transition:opacity .25s ease}
#afik-pre.out{opacity:0;pointer-events:none}
#afik-pre .ap-wrap{max-width:760px;margin:0 auto;padding:0 0 36px}
#afik-pre .ap-ph{position:relative;aspect-ratio:16/10;background:#15162A center/cover no-repeat;overflow:hidden}
#afik-pre .ap-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
#afik-pre .ap-body{padding:18px 18px 0}
#afik-pre .ap-chip{display:inline-block;font-size:13px;font-weight:700;color:#A5AEF5;background:rgba(132,144,216,.16);border:1px solid rgba(165,174,245,.45);border-radius:999px;padding:4px 12px;margin-inline-end:6px}
#afik-pre .ap-chip.sold{color:#F59A9A;background:rgba(245,154,154,.12);border-color:rgba(245,154,154,.45)}
#afik-pre h1{font-size:clamp(22px,5.5vw,32px);line-height:1.25;margin:12px 0 6px;font-weight:800;color:#F3F1EA}
#afik-pre .ap-place{font-size:15px;color:#CDCBD8}
#afik-pre .ap-price{font-size:30px;font-weight:800;color:#7EE2A2;margin:14px 0 4px;direction:ltr;text-align:left}
#afik-pre[dir=rtl] .ap-price{text-align:right}
#afik-pre .ap-specs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
#afik-pre .ap-specs span{font-size:14px;color:#F3F1EA;background:#1C1E30;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:7px 12px}
#afik-pre .ap-desc{font-size:15.5px;line-height:1.75;color:#CDCBD8;white-space:pre-line;margin:18px 0 0}
#afik-pre .ap-cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
#afik-pre .ap-cta a{flex:1 1 180px;min-height:52px;display:flex;align-items:center;justify-content:center;border-radius:14px;font-weight:700;font-size:16px;text-decoration:none}
#afik-pre .ap-wa{background:#25D366;color:#06260F}
#afik-pre .ap-call{background:#4F59BE;color:#fff}
#afik-pre .ap-load{display:flex;align-items:center;justify-content:center;gap:10px;margin:22px 0 0;font-size:14px;color:#A9A7BA}
#afik-pre .ap-spin{width:16px;height:16px;border-radius:50%;border:2px solid rgba(165,174,245,.3);border-top-color:#A5AEF5;animation:apspin .8s linear infinite}
#afik-pre .ap-site{display:block;text-align:center;margin-top:14px;color:#A5AEF5;font-size:14px}
#afik-pre a:focus-visible{outline:3px solid #A5AEF5;outline-offset:2px}
@keyframes apspin{to{transform:rotate(360deg)}}
@media (min-width:900px){#afik-pre .ap-wrap{padding-top:28px}#afik-pre .ap-ph{border-radius:18px}}
@media (prefers-reduced-motion:reduce){#afik-pre,#afik-pre .ap-spin{transition:none;animation:none}}
html[data-pre-lang=en] #afik-pre .l-he,html:not([data-pre-lang=en]) #afik-pre .l-en{display:none}
html[data-pre-lang=en] #afik-pre{direction:ltr}html[data-pre-lang=en] #afik-pre .ap-price{text-align:left}`

// What the page embeds for the app: the property without inline (base64) photos or other huge fields,
// so a landing page stays a few KB — the live list brings anything left out a moment later
export function slimProperty(p) {
  const out = {}
  for (const [k, v] of Object.entries(p || {})) {
    if (Array.isArray(v)) out[k] = v.filter(x => !(typeof x === 'string' && (x.startsWith('data:') || x.length > 20000)))
    else if (typeof v === 'string' && (v.startsWith('data:') || v.length > 20000)) continue
    else out[k] = v
  }
  return out
}

export function renderLanding(template, p, { origin, lang = 'he', cdn = CDN_BASE } = {}) {
  const m = propertyMeta(p, { origin, lang })
  const id = String(p.id)
  const desc = String(p.description || '').replace(/\r/g, '').trim()
  const shortDesc = desc.length > 420 ? `${desc.slice(0, 420).replace(/\s+\S*$/, '')}…` : desc
  const img = m.image
  const hasPhoto = !!img && !img.endsWith('/img/og-default.png')
  const imgSm = cdnImg(img, 900, cdn)
  const srcset = LANDING_WIDTHS.map(w => `${cdnImg(img, w, cdn)} ${w}w`).join(', ')
  const lqip = typeof p.__lqip === 'string' && p.__lqip.startsWith('data:image/') ? p.__lqip : ''
  const waHref = `${WA}?text=${encodeURIComponent(`${L[lang === 'en' ? 'en' : 'he'].waText}: ${String(p.title || '').trim()} ${m.url}`)}`
  const price = Number(String(p.price || '').replace(/[^\d]/g, ''))
  const ld = {
    '@context': 'https://schema.org', '@type': 'RealEstateListing', name: m.title, description: m.description, url: m.url, image: img,
    ...(price > 1000 ? { offers: { '@type': 'Offer', price, priceCurrency: 'ILS', availability: m.sold ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' } } : {}),
    provider: { '@id': 'https://afikhanahal.co.il/#org' },
  }
  const head = `
    <title>${esc(m.title)} | אפיק הנחל</title>
    <meta name="description" content="${esc(m.description)}" />
    <link rel="canonical" href="${esc(m.url)}" />
    <meta name="robots" content="noindex, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="אפיק הנחל – Afik Hanahal" />
    <meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'he_IL'}" />
    <meta property="og:title" content="${esc(m.title)}" />
    <meta property="og:description" content="${esc(m.description)}" />
    <meta property="og:url" content="${esc(m.url)}" />
    <meta property="og:image" content="${esc(img)}" />
    <meta property="og:image:secure_url" content="${esc(img)}" />
    <meta property="og:image:alt" content="${esc(m.title)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(m.title)}" />
    <meta name="twitter:description" content="${esc(m.description)}" />
    <meta name="twitter:image" content="${esc(img)}" />
    <script type="application/ld+json">${inlineJson(ld)}</script>
    ${hasPhoto ? `<link rel="preload" as="image" imagesrcset="${esc(srcset)}" imagesizes="${LANDING_SIZES}" fetchpriority="high" />` : ''}
    <script>window.__afikLanding=1</script>
    <script>
    // The site's JavaScript (~180 KB) is started by afikBoot() — after the photo has arrived, or after 1.2 s at
    // most — so on a slow connection the photo never shares the line with code the reader doesn't need yet.
    (function(){var b=false;window.afikBoot=function(){if(b)return;b=true;var m=document.querySelector('script[type="afik/module"]');if(!m)return;
      document.querySelectorAll('link[rel="afik-modulepreload"]').forEach(function(l){var p=document.createElement('link');p.rel='modulepreload';p.crossOrigin='anonymous';p.href=l.getAttribute('data-href');document.head.appendChild(p)});
      var s=document.createElement('script');s.type='module';s.crossOrigin='anonymous';s.src=m.getAttribute('data-src');document.body.appendChild(s)};
      setTimeout(window.afikBoot,1200)})();
    </script>
    <style>${PRE_CSS}</style>
    <script>
    (function(){try{
      var P=${inlineJson(slimProperty(p))},id=String(P.id),q=new URLSearchParams(location.search);
      if(q.get('lang')==='en')document.documentElement.setAttribute('data-pre-lang','en');
      q.set('p',id);try{history.replaceState(null,'','/?'+q.toString()+'#properties')}catch(e){}
      var fresh=fetch('/api/properties?one='+encodeURIComponent(id),{headers:{Accept:'application/json'}})
        .then(function(r){return r.status===404?{gone:1}:(r.ok?r.json():null)}).catch(function(){return null});
      window.__afikShared={id:id,pre:true,promise:Promise.resolve(P),fresh:fresh.then(function(d){return d&&!d.gone&&d.id!=null?d:null})};
      fresh.then(function(d){var el=document.getElementById('afik-pre');if(!el||!d)return;
        if(d.gone){var s=el.querySelector('[data-f=load]');if(s)s.innerHTML=el.querySelector('[data-f=gone]').innerHTML;return}
        if(d.title&&d.title!==P.title){var t=el.querySelector('[data-f=title]');if(t)t.textContent=d.title}
        if(d.price!==P.price){var pr=el.querySelector('[data-f=price]');if(pr)pr.textContent=d.price||''}});
    }catch(e){}})();
    </script>`
  const body = `
    <div id="afik-pre" dir="${lang === 'en' ? 'ltr' : 'rtl'}" aria-busy="true">
      <main class="ap-wrap">
        ${hasPhoto ? `<div class="ap-ph"${lqip ? ` style="background-image:url(${lqip})"` : ''}><img class="ap-img" src="${esc(imgSm)}" srcset="${esc(srcset)}" sizes="${LANDING_SIZES}" alt="${esc(m.title)}" fetchpriority="high" decoding="async" onload="window.afikBoot&&afikBoot()" onerror="if(!this.dataset.f){this.dataset.f=1;this.removeAttribute('srcset');this.src=${esc(JSON.stringify(img))}}else{this.style.display='none';window.afikBoot&&afikBoot()}" /></div>` : ''}
        <div class="ap-body">
          ${m.specs[0] ? `<span class="ap-chip">${esc(m.specs[0])}</span>` : ''}${m.sold ? `<span class="ap-chip sold">${both('sold')}</span>` : ''}
          <h1 data-f="title">${esc(String(p.title || '').trim() || m.title)}</h1>
          ${m.place ? `<div class="ap-place">${esc(m.place)}</div>` : ''}
          ${m.price ? `<div class="ap-price" data-f="price">${esc(m.price)}</div>` : ''}
          ${m.specs.length > 1 ? `<div class="ap-specs">${m.specs.slice(1).map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
          <div class="ap-cta">
            <a class="ap-wa" href="${esc(waHref)}" target="_blank" rel="noopener noreferrer">${both('wa')}</a>
            <a class="ap-call" href="tel:${PHONE}">${both('call')}</a>
          </div>
          ${shortDesc ? `<p class="ap-desc">${esc(shortDesc)}</p>` : ''}
          <div class="ap-load" data-f="load" role="status"><span class="ap-spin" aria-hidden="true"></span>${both('loading')}</div>
          <template data-f="gone">${both('gone')}</template>
          ${hasPhoto ? '' : '<script>window.afikBoot&&afikBoot()</script>'}
          <a class="ap-site" href="/">${both('site')}</a>
        </div>
      </main>
    </div>`
  let html = String(template)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, '')
    .replace(/(<div id="root">)[\s\S]*?(<\/div>\s*<script type="module")/i, '$1$2')
    .replace(/<link rel="preconnect" href="https:\/\/(www\.govmap\.gov\.il|afik-hanahal-server\.onrender\.com|[a-z]+\.supabase\.co)"[^>]*>\s*/gi, '')
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<link rel="modulepreload"([^>]*?)\shref="([^"]+)"([^>]*)>/gi, '<link rel="afik-modulepreload" data-href="$2">')
    .replace(/<script type="module"([^>]*?)\ssrc="([^"]+)"([^>]*)><\/script>/i, '<script type="afik/module" data-src="$2"></script>')
    .replace(/<meta\s+(?:name|property)="(?:description|robots|og:[^"]+|twitter:[^"]+)"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="(?:canonical|alternate)"[^>]*>\s*/gi, '')
  html = /<meta name="viewport"[^>]*>/i.test(html) ? html.replace(/(<meta name="viewport"[^>]*>)/i, `$1${head}`) : html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1${head}`)
  html = html.replace(/<body([^>]*)>/i, `<body$1>${body}`)
  return html
}
