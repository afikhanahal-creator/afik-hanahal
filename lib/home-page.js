// Static first screen for the homepage: written into dist/index.html at deploy time (scripts/build-properties.mjs).
// The site is a React app that needs ~180 KB of JavaScript before it can draw anything, so a first-time visitor
// on a phone looked at a plain-text fallback for 1.5–2.6 s. This layer paints the real first screen — the hero
// (badge, headline, tagline, CTAs) and the property grid — from the HTML alone, in the site's own look, and the
// app fades it out once it has rendered the same screen underneath (App.jsx). Cards link to the instant property
// pages (/p/<id>), so they work before any JavaScript arrives. Shown only on "/" (see the inline script).
import { esc } from './share-page.js'

const L = {
  he: {
    badge: 'מומחים בשיווק ותיווך · השרון והמרכז', h1a: 'הבית הבא שלכם', h1b: 'מתחיל כאן', tag: 'מגרשים וקרקעות בלעדיים',
    desc: 'אפיק הנחל - ייזום שיווק ותיווך | חברה יזמית מובילה לאיתור, שיווק וליווי עסקאות קרקע בכל רחבי ישראל',
    cta1: 'צפו בנכסים שלנו', cta2: 'צרו קשר עכשיו',
    propsBadge: 'נכסים זמינים', propsH2: 'הנכסים שלנו', propsDesc: 'קרקעות, מגרשים, פרוייקטים ודירות בלעדיים בכל רחבי ישראל',
    available: n => `${n} נכסים זמינים כעת`, details: 'לפרטים', more: 'לכל הנכסים', noImg: 'אין תמונה', loading: 'טוענים את האתר…',
    price: 'מחיר בפנייה', month: '/ לחודש', mil: 'מיל׳ ₪', k: 'אלף ₪', rooms: 'חד׳', sqm: 'מ"ר', dunam: 'דונם', floor: 'קומה',
    cats: { projects: 'פרוייקטים בשיווק', land: 'מגרשים וקרקעות', apartments: 'דירות למכירה', rentals: 'נכסים להשכרה', commercial: 'נכסים מסחריים' },
  },
  en: {
    badge: 'Experts in Marketing & Brokerage · Sharon & Center', h1a: 'Your Next Home', h1b: 'Starts Here', tag: 'Exclusive Plots & Land',
    desc: 'Afik Hanahal – Real estate promotion, marketing and brokerage | Leading company for locating, marketing and accompanying real estate transactions across Israel',
    cta1: 'View Properties', cta2: 'Contact Us',
    propsBadge: 'Available Properties', propsH2: 'Our Properties', propsDesc: 'Land, plots, projects and exclusive properties throughout Israel',
    available: n => `${n} properties available now`, details: 'Details', more: 'All properties', noImg: 'No photo', loading: 'Loading the site…',
    price: 'Price on request', month: '/ month', mil: 'M ₪', k: 'K ₪', rooms: 'rooms', sqm: 'm²', dunam: 'dunam', floor: 'floor',
    cats: { projects: 'Projects', land: 'Plots & land', apartments: 'Apartments for sale', rentals: 'For rent', commercial: 'Commercial' },
  },
}

// The same cover-image URL the app's cards use (thumbImg → cloudImg 600), so the browser reuses the download
export function cardImage(url) {
  const u = String(url || '')
  if (!u || u.startsWith('data:')) return ''
  const pub = u.indexOf('.supabase.co/storage/v1/object/public/')
  if (pub > 0) return `/media/${u.slice(pub + '.supabase.co/storage/v1/object/public/'.length).split('?')[0]}`
  if (u.includes('.supabase.co/storage/')) return u
  if (u.includes('cloudinary.com') && u.includes('/image/upload/') && !/\/(?:q_auto|q_\d|f_auto|fl_progressive)/.test(u)) return u.replace('/image/upload/', '/image/upload/w_600,q_auto:good,f_auto/')
  return /^(https?:)?\/\//.test(u) || u.startsWith('/') ? u : ''
}

// Site order = the admin's drag order; properties not placed yet (no sortOrder) come first, newest first
const createdTs = p => Date.parse(p?.createdAt || '') || (typeof p?.createdAt === 'number' ? p.createdAt : 0)
export function siteOrder(list) {
  const ordered = [], fresh = []
  for (const p of list || []) (Number.isFinite(p?.sortOrder) ? ordered : fresh).push(p)
  ordered.sort((a, b) => a.sortOrder - b.sortOrder)
  fresh.sort((a, b) => createdTs(b) - createdTs(a))
  return [...fresh, ...ordered]
}

export function cardPrice(p, t) {
  const raw = String(p.price || '').trim()
  if (!raw) return t.price
  const n = Number(raw.replace(/[^\d]/g, ''))
  const rental = p.txType === 'rent' || p.status === 'הושכר' || p.status === 'להשכרה'
  const base = n >= 1000000 ? `${(n / 1000000).toFixed(2).replace(/\.?0+$/, '')} ${t.mil}` : n >= 1000 ? `${Math.round(n / 1000).toLocaleString('en-US')} ${t.k}` : `₪${raw}`
  return rental ? `${base} ${t.month}` : base
}

const specsOf = (p, t) => [
  p.rooms && `${p.rooms} ${t.rooms}`, p.size && `${p.size} ${t.sqm}`, p.dunams && `${p.dunams} ${t.dunam}`, p.floor && `${t.floor} ${p.floor}`,
].filter(Boolean).slice(0, 4)

const both = (he, en) => `<span class="l-he">${he}</span><span class="l-en">${en}</span>`

const CSS = `
html[data-pre-home]{opacity:1!important}
#afik-pre-home{display:none}
html[data-pre-home] #afik-pre-home{display:block}
#afik-pre-home{position:fixed;inset:0;z-index:2147483000;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#09090F;color:#E8E4D8;font-family:Rubik,Heebo,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;transition:opacity .3s ease}
#afik-pre-home.out{opacity:0;pointer-events:none}
#afik-pre-home .ph-nav{position:sticky;top:0;height:82px;display:flex;align-items:center;justify-content:center;background:linear-gradient(90deg,rgba(6,5,14,.98),rgba(10,8,22,.97),rgba(6,5,14,.98));border-bottom:1px solid rgba(132,144,216,.09);z-index:2}
#afik-pre-home .ph-nav img{height:56px;width:auto;display:block}
#afik-pre-home .ph-hero{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:90px 24px 72px;text-align:center;position:relative;overflow:hidden;box-sizing:border-box}
#afik-pre-home .ph-glow{position:absolute;pointer-events:none;border-radius:50%}
#afik-pre-home .ph-inner{max-width:860px;margin:0 auto;position:relative}
#afik-pre-home .ph-badge{display:inline-block;border-radius:9999px;padding:7px 19px;font-size:11px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#8490D8;background:rgba(6,6,16,.9);border:1px solid rgba(132,144,216,.35);margin-bottom:24px;white-space:nowrap}
#afik-pre-home h1{font-size:clamp(36px,6vw,76px);font-weight:800;line-height:1.1;margin:0 0 24px;color:#E8E4D8;letter-spacing:-.02em}
#afik-pre-home .ph-tag{font-size:clamp(18px,3vw,26px);font-weight:600;color:#82F67F;margin-bottom:20px;min-height:40px;letter-spacing:.3px}
#afik-pre-home .ph-tag i{display:inline-block;width:2px;height:1em;background:#82F67F;vertical-align:-.15em;margin-inline-start:4px;animation:phBlink 1s ease infinite}
#afik-pre-home .ph-desc{font-size:clamp(14px,2vw,18px);color:rgba(232,228,216,.73);line-height:1.9;max-width:660px;margin:0 auto 40px}
#afik-pre-home .ph-cta{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:48px}
#afik-pre-home .ph-cta a{display:inline-flex;align-items:center;justify-content:center;padding:16px 38px;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;min-height:48px;box-sizing:border-box}
#afik-pre-home .ph-p{background:#E8E4D8;color:#09090F}
#afik-pre-home .ph-o{background:transparent;color:#E8E4D8;border:1.5px solid rgba(232,228,216,.35)}
#afik-pre-home .ph-props{padding:48px 24px;max-width:1280px;margin:0 auto}
#afik-pre-home .ph-head{text-align:center;margin-bottom:36px}
#afik-pre-home h2{font-size:clamp(28px,4vw,52px);font-weight:900;color:#E8E4D8;margin:0 0 14px}
#afik-pre-home .ph-sub{font-size:15px;color:rgba(232,228,216,.47);max-width:520px;margin:0 auto;line-height:1.8}
#afik-pre-home .ph-count{display:inline-flex;align-items:center;gap:8px;margin-top:16px;background:rgba(132,144,216,.08);border:1px solid rgba(132,144,216,.19);border-radius:20px;padding:6px 16px;font-size:13px;color:rgba(232,228,216,.73);font-weight:600}
#afik-pre-home .ph-count b{width:7px;height:7px;border-radius:50%;background:#82F67F;box-shadow:0 0 8px #82F67F}
#afik-pre-home .ph-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:22px}
#afik-pre-home .ph-card{background:#0E0E1C;border:1px solid rgba(132,144,216,.1);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;text-decoration:none;color:inherit}
#afik-pre-home .ph-img{position:relative;padding-bottom:67%;background:linear-gradient(135deg,rgba(132,144,216,.1),rgba(9,9,15,.5));overflow:hidden}
#afik-pre-home .ph-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#afik-pre-home .ph-img .ph-cat{position:absolute;bottom:12px;left:10px;display:flex;gap:5px}
#afik-pre-home .ph-cat span{border-radius:5px;padding:4px 10px;font-size:10px;font-weight:700}
#afik-pre-home .ph-cat .c{background:#8490D8;color:#fff}
#afik-pre-home .ph-cat .t{background:rgba(0,0,0,.72);color:rgba(255,255,255,.88);font-weight:600}
#afik-pre-home .ph-noimg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:rgba(232,228,216,.19);font-weight:700}
#afik-pre-home .ph-body{padding:16px 18px 18px;display:flex;flex-direction:column;flex:1}
#afik-pre-home h3{font-size:17px;font-weight:800;color:#E8E4D8;line-height:1.3;margin:0 0 5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#afik-pre-home .ph-loc{font-size:12px;color:rgba(232,228,216,.33);margin-bottom:10px}
#afik-pre-home .ph-specs{display:flex;flex-wrap:wrap;gap:3px 8px;margin-bottom:12px;padding-top:8px;border-top:1px solid rgba(132,144,216,.08)}
#afik-pre-home .ph-specs span{font-size:11px;color:rgba(232,228,216,.6);background:rgba(132,144,216,.06);border-radius:4px;padding:3px 8px}
#afik-pre-home .ph-price{margin-top:auto;padding-top:12px;border-top:1px solid rgba(132,144,216,.08);display:flex;align-items:center;justify-content:space-between;gap:8px}
#afik-pre-home .ph-price strong{font-size:21px;font-weight:900;line-height:1.1;color:#E8E4D8}
#afik-pre-home .ph-price em{font-style:normal;padding:8px 13px;border-radius:8px;font-size:12px;font-weight:700;border:1px solid rgba(132,144,216,.27);background:rgba(132,144,216,.09);color:#8490D8;white-space:nowrap}
#afik-pre-home .ph-more{display:block;text-align:center;margin:28px auto 0;color:#8490D8;font-size:14px;font-weight:700}
#afik-pre-home .ph-load{display:flex;align-items:center;justify-content:center;gap:10px;padding:26px 0 40px;font-size:13px;color:rgba(232,228,216,.5)}
#afik-pre-home .ph-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(132,144,216,.3);border-top-color:#8490D8;animation:phSpin .8s linear infinite}
@keyframes phSpin{to{transform:rotate(360deg)}}
@keyframes phBlink{0%,100%{opacity:.6}50%{opacity:1}}
@media (max-width:600px){#afik-pre-home .ph-cta{flex-direction:column;align-items:stretch;gap:12px}#afik-pre-home .ph-grid{grid-template-columns:1fr;gap:18px}#afik-pre-home h1{font-size:clamp(28px,8.5vw,44px);line-height:1.15;margin-bottom:14px}#afik-pre-home .ph-badge{letter-spacing:2px;font-size:10px;white-space:normal}#afik-pre-home .ph-props{padding:32px 16px}}
html[data-pre-lang=en] #afik-pre-home .l-he,html:not([data-pre-lang=en]) #afik-pre-home .l-en{display:none}
html[data-pre-lang=en] #afik-pre-home{direction:ltr}
@media (prefers-reduced-motion:reduce){#afik-pre-home,#afik-pre-home .ph-spin,#afik-pre-home .ph-tag i{transition:none;animation:none}}`

function card(p, lang) {
  const t = L[lang]
  const img = cardImage((p.images || []).find(i => typeof i === 'string' && i.length > 4))
  const cat = t.cats[p.category] || t.cats.land
  const specs = specsOf(p, t)
  return `<a class="ph-card" href="/p/${encodeURIComponent(String(p.id))}">
      <div class="ph-img">${img ? `<img src="${esc(img)}" alt="${esc(p.title || '')}" loading="lazy" decoding="async">` : `<div class="ph-noimg">${esc(t.noImg)}</div>`}
        <div class="ph-cat"><span class="c">${esc(cat)}</span>${p.type ? `<span class="t">${esc(p.type)}</span>` : ''}</div></div>
      <div class="ph-body"><h3>${esc(p.title || '')}</h3><div class="ph-loc">${esc([p.location, p.neighborhood].filter(Boolean).join(' · ') || '—')}</div>
        ${specs.length ? `<div class="ph-specs">${specs.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
        <div class="ph-price"><strong>${esc(cardPrice(p, t))}</strong><em>${esc(t.details)}</em></div></div></a>`
}

export function renderHome(template, properties, { maxCards = 9 } = {}) {
  const list = siteOrder((properties || []).filter(p => p && p.published !== false))
  const shown = list.slice(0, maxCards)
  const n = list.length
  const grid = lang => `<div class="ph-grid l-${lang}">${shown.map(p => card(p, lang)).join('')}</div>`
  const head = `
    <style>${CSS}</style>
    <script>
    (function(){try{
      // the static first screen belongs to the homepage only (not /admin-panel, /sell, an old /?p= link…)
      if(location.pathname!=='/'||/[?&]p=/.test(location.search))return;
      document.documentElement.setAttribute('data-pre-home','1');
      var q=new URLSearchParams(location.search).get('lang'),s='';try{s=localStorage.getItem('afik_lang')}catch(e){}
      if(q==='en'||(q!=='he'&&s==='en'))document.documentElement.setAttribute('data-pre-lang','en');
    }catch(e){}})();
    </script>`
  const body = `
    <div id="afik-pre-home" aria-hidden="true">
      <div class="ph-nav"><img src="/logo.svg" alt="" decoding="async"></div>
      <section class="ph-hero">
        <span class="ph-glow" style="top:20%;right:-8%;width:620px;height:620px;background:radial-gradient(circle,rgba(132,144,216,.1),transparent 70%)"></span>
        <span class="ph-glow" style="bottom:10%;left:-8%;width:520px;height:520px;background:radial-gradient(circle,rgba(130,246,127,.08),transparent 70%)"></span>
        <div class="ph-inner">
          <div><span class="ph-badge">${both(esc(L.he.badge), esc(L.en.badge))}</span></div>
          <h1>${both(`${esc(L.he.h1a)}<br>${esc(L.he.h1b)}`, `${esc(L.en.h1a)}<br>${esc(L.en.h1b)}`)}</h1>
          <div class="ph-tag">${both(esc(L.he.tag), esc(L.en.tag))}<i></i></div>
          <p class="ph-desc">${both(esc(L.he.desc), esc(L.en.desc))}</p>
          <div class="ph-cta"><a class="ph-p" href="#properties">${both(esc(L.he.cta1), esc(L.en.cta1))}</a><a class="ph-o" href="tel:+972559811814">${both(esc(L.he.cta2), esc(L.en.cta2))}</a></div>
        </div>
      </section>
      <section class="ph-props" id="ph-properties">
        <div class="ph-head">
          <span class="ph-badge">${both(esc(L.he.propsBadge), esc(L.en.propsBadge))}</span>
          <h2>${both(esc(L.he.propsH2), esc(L.en.propsH2))}</h2>
          <p class="ph-sub">${both(esc(L.he.propsDesc), esc(L.en.propsDesc))}</p>
          ${n ? `<div class="ph-count"><b></b>${both(esc(L.he.available(n)), esc(L.en.available(n)))}</div>` : ''}
        </div>
        ${grid('he')}${grid('en')}
        ${n > shown.length ? `<a class="ph-more" href="#properties">${both(esc(L.he.more), esc(L.en.more))} (${n})</a>` : ''}
        <div class="ph-load" role="status"><span class="ph-spin"></span>${both(esc(L.he.loading), esc(L.en.loading))}</div>
      </section>
    </div>`
  let html = String(template)
  html = /<meta name="viewport"[^>]*>/i.test(html) ? html.replace(/(<meta name="viewport"[^>]*>)/i, `$1${head}`) : html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1${head}`)
  html = html.replace(/<body([^>]*)>/i, `<body$1>${body}`)
  return html
}
