#!/usr/bin/env node
// ─── Static content engine ────────────────────────────────────────────────────
// Turns content/*.mjs into crawlable static HTML under dist/ — served by Vercel BEFORE the SPA
// rewrite (filesystem first), so search engines and AI crawlers get real HTML with no JS needed.
//   dist/<hub>/<slug>/index.html      Hebrew (RTL)
//   dist/en/<hub>/<slug>/index.html   English (LTR)
//   dist/<hub>/index.html             hub pages  (services, areas, guides, glossary, faq, tools, company)
//   dist/sitemap.xml                  every page, with hreflang alternates
// Run after `vite build` (see package.json). Pure Node, no dependencies.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SITE, UI, CTA } from '../content/site.mjs'
import { SERVICES } from '../content/services.mjs'
import { AREAS } from '../content/areas.mjs'
import { GUIDES } from '../content/guides.mjs'
import { GLOSSARY } from '../content/glossary.mjs'
import { COMPANY } from '../content/company.mjs'
import { TOOLS } from '../content/tools.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const ORIGIN = SITE.origin
const TODAY = new Date().toISOString().slice(0, 10)
const LANGS = ['he', 'en']

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const attr = esc
const monthName = (iso, lang) => new Date(iso + 'T00:00:00Z').toLocaleDateString(lang === 'en' ? 'en-GB' : 'he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// ── URL helpers ──────────────────────────────────────────────────────────────
const HUBS = { service: 'services', area: 'areas', guide: 'guides', glossary: 'glossary', tool: 'tools', company: 'company', faq: 'faq' }
const pagePath = (type, slug, lang) => `${lang === 'en' ? '/en' : ''}/${HUBS[type]}/${slug ? slug + '/' : ''}`
const abs = p => ORIGIN + p
const homePath = lang => lang === 'en' ? '/?lang=en' : '/'

// ── Registry (for cross-links) ───────────────────────────────────────────────
const ALL = [
  ...SERVICES.map(p => ({ ...p, type: 'service' })),
  ...AREAS.map(p => ({ ...p, type: 'area' })),
  ...GUIDES.map(p => ({ ...p, type: 'guide' })),
  ...GLOSSARY.map(p => ({ ...p, type: 'glossary' })),
  ...TOOLS.map(p => ({ ...p, type: 'tool' })),
]
const byKey = new Map(ALL.map(p => [`${p.type}:${p.slug}`, p]))
function ref(type, slug) { const p = byKey.get(`${type}:${slug}`); if (!p) throw new Error(`broken related link ${type}:${slug}`); return p }

// ── Inline CSS (dark brand theme, mobile-first, both directions) ─────────────
const CSS = `
:root{--bg:#09090F;--bg2:#0F0F1A;--card:#13132A;--cream:#E8E4D8;--muted:#A9A599;--dim:#6E6B78;--purple:#8490D8;--green:#82F67F;--line:rgba(132,144,216,.18)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--cream);font-family:Rubik,Heebo,Arial,sans-serif;line-height:1.7;font-size:17px;-webkit-font-smoothing:antialiased}
a{color:var(--purple)}a:hover{color:#a9b3ee}img{max-width:100%;height:auto}
.skip{position:absolute;top:-40px;left:0;background:var(--purple);color:#fff;padding:8px 12px;z-index:100}.skip:focus{top:0}
header.top{position:sticky;top:0;z-index:50;background:rgba(9,9,15,.92);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.wrap{max-width:1080px;margin:0 auto;padding:0 20px}
.topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;height:64px}
.brand{display:flex;align-items:center;gap:10px;color:var(--cream);text-decoration:none;font-weight:800;font-size:18px}.brand img{width:34px;height:34px;border-radius:9px}
nav.main{display:flex;gap:4px;flex-wrap:wrap}nav.main a{color:var(--muted);text-decoration:none;font-size:14px;padding:6px 10px;border-radius:8px}nav.main a:hover,nav.main a[aria-current]{color:var(--cream);background:rgba(132,144,216,.12)}
.topcta{display:flex;gap:8px}.btn{display:inline-flex;align-items:center;gap:8px;padding:11px 20px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px;border:1px solid transparent;cursor:pointer;font-family:inherit;transition:transform .15s}
.btn:hover{transform:translateY(-1px)}.btn-p{background:var(--purple);color:#fff}.btn-g{background:var(--green);color:#0a1a0a}.btn-o{background:transparent;border-color:var(--line);color:var(--cream)}
.btn-wa{background:#25D366;color:#062a12}.small{font-size:13px;padding:7px 12px}
@media(max-width:820px){nav.main{display:none}.topcta .btn-o{display:none}}
main{padding:36px 0 40px}.crumbs{font-size:13px;color:var(--dim);margin-bottom:18px}.crumbs a{color:var(--muted);text-decoration:none}.crumbs span{margin:0 6px}
h1{font-size:clamp(28px,4.4vw,44px);line-height:1.2;margin:0 0 14px;font-weight:900;letter-spacing:-.01em}
.lead{font-size:19px;color:var(--cream);background:linear-gradient(135deg,rgba(132,144,216,.14),rgba(130,246,127,.06));border:1px solid var(--line);border-radius:16px;padding:18px 22px;margin:18px 0 26px}
.lead b{color:var(--green)}.meta{font-size:13px;color:var(--dim);margin-bottom:10px;display:flex;gap:14px;flex-wrap:wrap}
article h2{font-size:26px;margin:38px 0 12px;font-weight:800;color:var(--cream)}article h3{font-size:20px;margin:26px 0 8px;font-weight:700;color:#d9d5f5}
article p{margin:0 0 14px;color:#d8d4c8}article ul,article ol{padding-inline-start:22px;margin:0 0 16px;color:#d8d4c8}article li{margin:6px 0}
table{width:100%;border-collapse:collapse;margin:12px 0 20px;font-size:15px;display:block;overflow-x:auto}th,td{text-align:start;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--purple);font-weight:700;background:rgba(132,144,216,.06)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin:14px 0 8px}
.card{display:block;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;color:var(--cream);text-decoration:none;transition:border-color .15s,transform .15s}.card:hover{border-color:var(--purple);transform:translateY(-2px)}
.card b{display:block;font-size:16px;margin-bottom:6px}.card span{font-size:14px;color:var(--muted);line-height:1.55}.card small{display:block;margin-top:10px;font-size:12px;color:var(--purple)}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 18px}.chip{font-size:13px;padding:5px 12px;border-radius:20px;border:1px solid var(--line);color:var(--cream);text-decoration:none;background:rgba(255,255,255,.03)}.chip:hover{border-color:var(--purple)}
.faq details{border:1px solid var(--line);border-radius:12px;padding:0 18px;margin:8px 0;background:var(--bg2)}.faq summary{cursor:pointer;font-weight:700;padding:14px 0;list-style:none;display:flex;justify-content:space-between;gap:12px}.faq summary::after{content:'+';color:var(--purple);font-size:20px}.faq details[open] summary::after{content:'–'}
.faq summary::-webkit-details-marker{display:none}.faq .a{padding:0 0 16px;color:#d8d4c8}
section.cta{margin:44px 0 10px;background:linear-gradient(135deg,#171633,#0f1f19);border:1px solid var(--line);border-radius:20px;padding:26px 24px}
section.cta h2{margin:0 0 6px;font-size:24px}section.cta p{color:var(--muted);margin:0 0 18px}.ctarow{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.form{margin-top:8px}.form .step{display:none}.form .step.on{display:block}.form label{display:block;font-size:13px;color:var(--muted);margin:10px 0 4px}
.form input,.form select,.form textarea{width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--cream);font:inherit;font-size:16px}
.form input:focus,.form select:focus,.form textarea:focus{outline:2px solid var(--purple);outline-offset:1px}
.intents{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.intents button{padding:12px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--cream);font:inherit;font-weight:700;cursor:pointer}
.intents button[aria-pressed=true]{border-color:var(--green);background:rgba(130,246,127,.12)}.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:560px){.row2{grid-template-columns:1fr}}
.form .nav{display:flex;gap:10px;margin-top:16px;align-items:center}.form .ok{color:var(--green);font-weight:700}.form .err{color:#ff8a8a}.form .priv{font-size:12px;color:var(--dim);margin-top:10px}
.progress{height:4px;background:rgba(255,255,255,.08);border-radius:4px;margin:6px 0 14px;overflow:hidden}.progress i{display:block;height:100%;background:var(--green);width:33%;transition:width .3s}
.trust{margin:40px 0;border:1px solid var(--line);border-radius:16px;padding:20px 22px;background:var(--bg2)}.trust h2{margin:0 0 10px;font-size:20px}.trust ul{margin:0;padding-inline-start:20px;color:#d8d4c8}
.trust .who{display:flex;gap:14px;align-items:center;margin-top:14px}.trust .who img{width:56px;height:56px;border-radius:50%;object-fit:cover}.trust .who b{display:block}.trust .who span{font-size:13px;color:var(--muted)}
footer.site{border-top:1px solid var(--line);margin-top:40px;padding:34px 0 40px;font-size:14px;color:var(--muted)}.fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:22px}footer.site h3{color:var(--cream);font-size:15px;margin:0 0 8px}footer.site a{color:var(--muted);text-decoration:none;display:block;padding:3px 0}footer.site a:hover{color:var(--cream)}
.disc{font-size:12px;color:var(--dim);margin-top:22px;line-height:1.6}.updated{font-size:12px;color:var(--dim)}
.sticky-cta{display:none}@media(max-width:820px){.sticky-cta{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:60;gap:8px;padding:10px 12px;background:rgba(9,9,15,.94);border-top:1px solid var(--line)}.sticky-cta .btn{flex:1;justify-content:center;padding:12px}main{padding-bottom:90px}}
.tool{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin:18px 0}.tool .field{margin:10px 0}.tool label{display:block;font-size:13px;color:var(--muted);margin:0 0 4px}.tool input[type=text]{width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--cream);font:inherit;font-size:16px}.tool input:focus{outline:2px solid var(--purple);outline-offset:1px}.tool fieldset{border:1px solid var(--line);border-radius:10px;padding:10px 14px}.tool legend{font-size:13px;color:var(--muted);padding:0 6px}.tool .radio{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--cream);margin:6px 0}.tool .radio input{width:auto;accent-color:var(--purple)}.tool .btn{background:var(--purple);color:#fff;margin-top:8px}.tool-result{margin-top:16px}.tool-result .big{display:flex;flex-direction:column;gap:2px;margin-bottom:12px}.tool-result .big span{font-size:13px;color:var(--muted)}.tool-result .big b{font-size:34px;font-weight:900;color:var(--green);font-family:monospace}.tool-result .big small{color:var(--muted)}.tool table{width:100%;border-collapse:collapse;font-size:14px}.tool caption{text-align:start;color:var(--muted);font-size:13px;padding:6px 0}.tool th,.tool td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:start}.tool .note{font-size:12px;color:var(--dim);margin-top:12px}.tool .out{font-size:34px;font-weight:900;color:var(--green);font-family:monospace}.tool .sub{color:var(--muted);font-size:14px}
`.trim()

// ── Shared JS: tracking + multi-step lead form (no framework) ────────────────
const JS = (lang, page) => `
(function(){
  var L=${JSON.stringify(UI[lang].form)}, PAGE=${JSON.stringify({ type: page.type, slug: page.slug, title: page.h1, lang })};
  function ev(n,p){try{if(window.gtag)gtag('event',n,Object.assign({page_type:PAGE.type,page_slug:PAGE.slug},p||{}))}catch(e){}}
  function origin(){try{var u=new URL(location.href),utm={};['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid'].forEach(function(k){if(u.searchParams.get(k))utm[k]=u.searchParams.get(k).slice(0,120)});var ref=document.referrer&&document.referrer.indexOf(u.hostname)<0?document.referrer.slice(0,200):'';return{page:(u.pathname+u.hash).slice(0,160),referrer:ref,utm:utm,device:/Mobi|Android/i.test(navigator.userAgent)?'mobile':'desktop'}}catch(e){return{}}}
  document.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';
    if(h.indexOf('tel:')===0){ev('phone_click');if(window.fbq)fbq('track','Contact',{method:'phone'})}
    else if(h.indexOf('wa.me')>-1){ev('whatsapp_click');if(window.fbq)fbq('track','Contact',{method:'whatsapp'})}
    else if(h.indexOf('mailto:')===0)ev('email_click');
    else if(a.dataset.cta)ev('cta_click',{cta:a.dataset.cta})});
  var f=document.getElementById('lead');if(!f)return;
  var steps=f.querySelectorAll('.step'),cur=0,intent=f.dataset.intent||'consult',bar=f.querySelector('.progress i');
  function show(i){cur=i;steps.forEach(function(s,j){s.classList.toggle('on',j===i)});bar.style.width=((i+1)/steps.length*100)+'%';if(i>0)ev('lead_form_step',{step:i+1})}
  f.querySelectorAll('.intents button').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.v===intent);b.addEventListener('click',function(){intent=b.dataset.v;f.querySelectorAll('.intents button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});show(1)})});
  f.querySelectorAll('[data-next]').forEach(function(b){b.addEventListener('click',function(){show(cur+1)})});
  f.querySelectorAll('[data-back]').forEach(function(b){b.addEventListener('click',function(){show(cur-1)})});
  f.addEventListener('submit',function(e){e.preventDefault();var d=Object.fromEntries(new FormData(f).entries());
    if(!d.name||!d.phone){f.querySelector('.msg').textContent=L.error;return}
    var parts=[L.intents[intent]||intent];['city','type','size','when','notes'].forEach(function(k){if(d[k])parts.push(L[k]+': '+d[k])});
    var body={name:d.name,phone:d.phone,email:d.email||'',msg:parts.join(' · '),propTitle:PAGE.title,source:'page_'+PAGE.type+'_'+intent,lang:PAGE.lang,origin:origin()};
    var btn=f.querySelector('button[type=submit]');btn.disabled=true;btn.textContent=L.sending;
    fetch('/api/contacts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(function(r){if(!r.ok)throw 0;
      f.innerHTML='<p class="ok">'+L.done+'</p><p>'+L.doneSub+' <a href="tel:${SITE.phoneIntl}">${SITE.phone}</a></p>';
      ev('contact_form',{intent:intent,propTitle:PAGE.title});ev('generate_lead',{intent:intent});if(window.fbq)fbq('track','Lead',{content_name:PAGE.title})
    }).catch(function(){btn.disabled=false;btn.textContent=L.send;f.querySelector('.msg').textContent=L.error})});
  show(0);
})();`

// ── Analytics snippets (same IDs as index.html; pixel deferred to idle) ──────
const ANALYTICS = `
<script async src="https://www.googletagmanager.com/gtag/js?id=${SITE.gaId}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${SITE.gaId}',{send_page_view:true});</script>
<script>(function(){function initPixel(){!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');${SITE.metaPixels.map(p => `fbq('init','${p}');`).join('')}fbq('track','PageView')}
function whenIdle(){if('requestIdleCallback' in window)requestIdleCallback(initPixel,{timeout:3000});else setTimeout(initPixel,1500)}if(document.readyState==='complete')whenIdle();else window.addEventListener('load',whenIdle)})();</script>`

// ── Schema.org graph ─────────────────────────────────────────────────────────
function orgNode(lang) {
  return {
    '@type': ['Organization', 'RealEstateAgent'], '@id': `${ORIGIN}/#org`,
    name: lang === 'en' ? SITE.brand.en : `${SITE.brand.he} - ייזום שיווק ותיווך`,
    legalName: SITE.legalName, alternateName: [SITE.brand.he, SITE.brand.en, SITE.legalNameEn],
    url: ORIGIN + '/', logo: abs(SITE.logo), image: abs(SITE.ogImage),
    telephone: SITE.phoneIntl, email: SITE.email,
    founder: { '@type': 'Person', '@id': `${ORIGIN}/#founder`, name: lang === 'en' ? SITE.founder.en : SITE.founder.he, jobTitle: lang === 'en' ? SITE.founder.role.en : SITE.founder.role.he, worksFor: { '@id': `${ORIGIN}/#org` } },
    address: { '@type': 'PostalAddress', streetAddress: lang === 'en' ? SITE.address.streetEn : `${SITE.address.street}, ${SITE.address.extra}`, addressLocality: lang === 'en' ? SITE.address.city.en : SITE.address.city.he, addressRegion: lang === 'en' ? SITE.address.region.en : SITE.address.region.he, addressCountry: 'IL' },
    areaServed: (lang === 'en' ? SITE.areaServed.en : SITE.areaServed.he).map(n => ({ '@type': 'Place', name: n })),
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'], opens: '09:00', closes: '19:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Friday', opens: '09:00', closes: '14:00' },
    ],
    sameAs: [SITE.social.facebook, SITE.social.instagram, SITE.whatsapp].filter(Boolean),
    knowsAbout: lang === 'en'
      ? ['Real estate development', 'Land brokerage', 'Private land', 'Rezoning', 'Land improvement', 'Property marketing', 'Sharon region real estate']
      : ['יזמות נדל"ן', 'תיווך קרקעות', 'קרקעות פרטיות', 'שינוי ייעוד', 'השבחת קרקע', 'שיווק נכסים', 'נדל"ן בשרון'],
  }
}
const siteNode = lang => ({ '@type': 'WebSite', '@id': `${ORIGIN}/#website`, url: ORIGIN + '/', name: lang === 'en' ? SITE.brand.en : SITE.brand.he, publisher: { '@id': `${ORIGIN}/#org` }, inLanguage: lang === 'en' ? 'en' : 'he' })

function graphFor(page, lang, url, crumbs) {
  const t = page[lang]
  const nodes = [orgNode(lang), siteNode(lang)]
  const webPage = {
    '@type': page.type === 'guide' ? 'Article' : page.type === 'faq' || page.type === 'hub' ? 'CollectionPage' : 'WebPage',
    '@id': url + '#page', url, name: t.metaTitle || t.h1, headline: t.h1, description: t.description, inLanguage: lang === 'en' ? 'en' : 'he',
    isPartOf: { '@id': `${ORIGIN}/#website` }, about: { '@id': `${ORIGIN}/#org` }, dateModified: page.updated || TODAY, datePublished: page.published || page.updated || TODAY,
    primaryImageOfPage: abs(page.image || SITE.ogImage),
  }
  if (page.type === 'guide') Object.assign(webPage, { author: { '@id': `${ORIGIN}/#org` }, publisher: { '@id': `${ORIGIN}/#org` }, image: abs(page.image || SITE.ogImage) })
  nodes.push(webPage)
  nodes.push({ '@type': 'BreadcrumbList', '@id': url + '#crumbs', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.href) })) })
  if (page.type === 'service') nodes.push({ '@type': 'Service', '@id': url + '#service', name: t.h1, description: t.description, serviceType: t.serviceType || t.h1, provider: { '@id': `${ORIGIN}/#org` }, areaServed: (lang === 'en' ? SITE.areaServed.en : SITE.areaServed.he).map(n => ({ '@type': 'Place', name: n })), url })
  if (page.type === 'area') nodes.push({ '@type': 'Place', '@id': url + '#place', name: t.placeName || t.h1, address: { '@type': 'PostalAddress', addressLocality: t.placeName, addressCountry: 'IL' }, url })
  if (page.type === 'glossary') nodes.push({ '@type': 'DefinedTerm', '@id': url + '#term', name: t.h1, description: t.summaryText || t.description, inDefinedTermSet: abs(pagePath('glossary', '', lang)), url })
  if (t.faq && t.faq.length) nodes.push({ '@type': 'FAQPage', '@id': url + '#faq', mainEntity: t.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a.replace(/<[^>]+>/g, '') } })) })
  return { '@context': 'https://schema.org', '@graph': nodes }
}

// ── Rendering helpers ────────────────────────────────────────────────────────
const rtl = lang => lang !== 'en'
function renderBody(sections) {
  return (sections || []).map(s => {
    let out = s.h2 ? `<h2 id="${attr(slugify(s.h2))}">${esc(s.h2)}</h2>` : ''
    if (s.h3) out += `<h3>${esc(s.h3)}</h3>`
    for (const p of s.paras || []) out += `<p>${inline(p)}</p>`
    if (s.bullets) out += `<ul>${s.bullets.map(b => `<li>${inline(b)}</li>`).join('')}</ul>`
    if (s.steps) out += `<ol>${s.steps.map(b => `<li>${inline(b)}</li>`).join('')}</ol>`
    if (s.table) out += `<table><thead><tr>${s.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    if (s.html) out += s.html
    for (const sub of s.subs || []) out += renderBody([sub])
    return out
  }).join('\n')
}
// tiny inline markup: **bold**, [text](href)
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
const slugify = s => String(s).toLowerCase().replace(/["'״׳?]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60)

function card(p, lang) { const t = p[lang]; return `<a class="card" href="${pagePath(p.type, p.slug, lang)}"><b>${esc(t.cardTitle || t.h1)}</b><span>${esc(t.description)}</span><small>${esc(UI[lang].readMore)} →</small></a>` }

function relatedBlock(page, lang) {
  const r = page.related || {}; const u = UI[lang]; let out = ''
  const groups = [['services', 'service', u.relatedServices], ['areas', 'area', u.relatedAreas], ['guides', 'guide', u.relatedGuides], ['tools', 'tool', u.nav.tools]]
  for (const [key, type, title] of groups) {
    const items = (r[key] || []).map(s => ref(type, s))
    if (items.length) out += `<h2>${esc(title)}</h2><div class="grid">${items.map(p => card(p, lang)).join('')}</div>`
  }
  const terms = (r.glossary || []).map(s => ref('glossary', s))
  if (terms.length) out += `<h2>${esc(u.relatedTerms)}</h2><div class="chips">${terms.map(p => `<a class="chip" href="${pagePath('glossary', p.slug, lang)}">${esc(p[lang].h1)}</a>`).join('')}</div>`
  return out
}

function faqBlock(t, lang) {
  if (!t.faq || !t.faq.length) return ''
  return `<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">${esc(UI[lang].faq)}</h2>${t.faq.map(f => `<details><summary>${esc(f.q)}</summary><div class="a">${inline(f.a)}</div></details>`).join('')}</section>`
}

function ctaBlock(page, lang) {
  const c = CTA[page.cta || 'consult'][lang], u = UI[lang], F = u.form
  const types = F.types.map(x => `<option>${esc(x)}</option>`).join('')
  const whens = F.whens.map(x => `<option>${esc(x)}</option>`).join('')
  return `<section class="cta" id="contact" aria-labelledby="cta-h"><h2 id="cta-h">${esc(c.h)}</h2><p>${esc(c.p)}</p>
<form id="lead" class="form" data-intent="${attr(page.cta || 'consult')}" novalidate>
<div class="progress"><i></i></div>
<div class="step on"><label>${esc(F.step1)}</label><div class="intents">${Object.entries(F.intents).map(([k, v]) => `<button type="button" data-v="${k}">${esc(v)}</button>`).join('')}</div></div>
<div class="step"><label>${esc(F.step2)}</label><div class="row2"><div><label for="f-city">${esc(F.city)}</label><input id="f-city" name="city" autocomplete="address-level2"></div><div><label for="f-type">${esc(F.type)}</label><select id="f-type" name="type"><option value="">—</option>${types}</select></div></div>
<div class="row2"><div><label for="f-size">${esc(F.size)}</label><input id="f-size" name="size" inputmode="numeric"></div><div><label for="f-when">${esc(F.when)}</label><select id="f-when" name="when"><option value="">—</option>${whens}</select></div></div>
<div class="nav"><button type="button" class="btn btn-o small" data-back>${esc(F.back)}</button><button type="button" class="btn btn-p" data-next>${esc(F.next)}</button></div></div>
<div class="step"><label>${esc(F.step3)}</label><div class="row2"><div><label for="f-name">${esc(F.name)}</label><input id="f-name" name="name" required autocomplete="name"></div><div><label for="f-phone">${esc(F.phone)}</label><input id="f-phone" name="phone" type="tel" required autocomplete="tel" dir="ltr"></div></div>
<label for="f-email">${esc(F.email)}</label><input id="f-email" name="email" type="email" autocomplete="email" dir="ltr"><label for="f-notes">${esc(F.notes)}</label><textarea id="f-notes" name="notes" rows="2"></textarea>
<div class="nav"><button type="button" class="btn btn-o small" data-back>${esc(F.back)}</button><button type="submit" class="btn btn-g">${esc(F.send)}</button><span class="msg err" role="status"></span></div><p class="priv">${esc(F.privacy)}</p></div>
</form>
<div class="ctarow"><a class="btn btn-wa" href="${SITE.whatsapp}" target="_blank" rel="noopener">${esc(u.ctaWa)}</a><a class="btn btn-o" href="tel:${SITE.phoneIntl}">${esc(u.ctaCall)} ${SITE.phone}</a><a class="btn btn-o" href="mailto:${SITE.email}">${esc(u.ctaEmail)}</a></div></section>`
}

function trustBlock(lang) {
  const u = UI[lang]
  return `<aside class="trust" aria-labelledby="trust-h"><h2 id="trust-h">${esc(u.trustTitle)}</h2><ul>${u.trustPoints.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
<div class="who"><img src="/img/ceo.webp" alt="${attr(lang === 'en' ? SITE.founder.en : SITE.founder.he)}" width="56" height="56" loading="lazy"><div><b>${esc(lang === 'en' ? SITE.founder.en : SITE.founder.he)}</b><span>${esc(lang === 'en' ? SITE.founder.role.en : SITE.founder.role.he)} · ${esc(SITE.brand[lang])}</span></div></div>
<p style="margin:12px 0 0;font-size:14px;color:var(--muted)"><a href="${pagePath('company', '', lang)}">${esc(u.nav.company)} →</a></p></aside>`
}

function shell({ lang, page, url, altUrl, crumbs, body, title, description, ogType = 'website', noindex = false, schema }) {
  const u = UI[lang], dir = rtl(lang) ? 'rtl' : 'ltr'
  const NAV_TYPE = { services: 'service', areas: 'area', guides: 'guide', glossary: 'glossary', tools: 'tool', faq: 'faq', company: 'company' }
  const nav = Object.keys(NAV_TYPE).map(k => `<a href="${pagePath(NAV_TYPE[k], '', lang)}"${page.type === NAV_TYPE[k] ? ' aria-current="page"' : ''}>${esc(u.nav[k])}</a>`).join('')
  const otherLang = lang === 'he' ? 'en' : 'he'
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">'}
<link rel="alternate" hreflang="he" href="${lang === 'he' ? url : altUrl}"><link rel="alternate" hreflang="en" href="${lang === 'en' ? url : altUrl}"><link rel="alternate" hreflang="x-default" href="${lang === 'he' ? url : altUrl}">
<meta property="og:type" content="${ogType}"><meta property="og:title" content="${attr(title)}"><meta property="og:description" content="${attr(description)}"><meta property="og:url" content="${url}"><meta property="og:site_name" content="${attr(SITE.brand[lang])}"><meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'he_IL'}"><meta property="og:image" content="${abs(page.image || SITE.ogImage)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${attr(title)}"><meta name="twitter:description" content="${attr(description)}"><meta name="twitter:image" content="${abs(page.image || SITE.ogImage)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="icon" type="image/png" sizes="192x192" href="/img/icon-192.png"><link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800;900&display=swap" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;800;900&display=swap"></noscript>
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(schema)}</script>
${ANALYTICS}
</head>
<body>
<a class="skip" href="#main">${esc(u.skip)}</a>
<header class="top"><div class="wrap topbar"><a class="brand" href="${homePath(lang)}"><img src="/img/icon-192.png" alt="" width="34" height="34">${esc(SITE.brand[lang])}</a><nav class="main" aria-label="${esc(u.nav.services)}">${nav}</nav><div class="topcta"><a class="btn btn-o small" href="${altUrl}" hreflang="${otherLang}" lang="${otherLang}">${otherLang === 'en' ? 'EN' : 'עב'}</a><a class="btn btn-wa small" href="${SITE.whatsapp}" target="_blank" rel="noopener">${esc(u.ctaWa)}</a></div></div></header>
<main id="main"><div class="wrap">
<nav class="crumbs" aria-label="breadcrumb">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${c.href}">${esc(c.name)}</a><span>›</span>` : `<span aria-current="page">${esc(c.name)}</span>`).join('')}</nav>
${body}
</div></main>
<div class="sticky-cta"><a class="btn btn-wa" href="${SITE.whatsapp}" target="_blank" rel="noopener">${esc(u.ctaWa)}</a><a class="btn btn-p" href="#contact" data-cta="sticky">${esc(CTA[page.cta || 'consult'][lang].b)}</a></div>
<footer class="site"><div class="wrap"><div class="fgrid">
<div><h3>${esc(SITE.brand[lang])}</h3><div>${esc(lang === 'en' ? SITE.legalNameEn : SITE.legalName)}</div><div>${esc(u.footer.company)} ${SITE.regNumber}</div><div style="margin-top:8px">${esc(u.footer.address)}: ${esc(lang === 'en' ? SITE.address.streetEn + ', ' + SITE.address.city.en : SITE.address.street + ', ' + SITE.address.extra + ', ' + SITE.address.city.he)}</div><div>${esc(u.footer.hours)}: ${esc(SITE.hours[lang])}</div><div style="margin-top:8px"><a href="tel:${SITE.phoneIntl}">${SITE.phone}</a><a href="mailto:${SITE.email}">${SITE.email}</a></div></div>
<div><h3>${esc(u.nav.services)}</h3>${SERVICES.map(p => `<a href="${pagePath('service', p.slug, lang)}">${esc(p[lang].cardTitle || p[lang].h1)}</a>`).join('')}</div>
<div><h3>${esc(u.nav.areas)}</h3>${AREAS.map(p => `<a href="${pagePath('area', p.slug, lang)}">${esc(p[lang].cardTitle || p[lang].h1)}</a>`).join('')}</div>
<div><h3>${esc(u.nav.guides)}</h3><a href="${pagePath('guide', '', lang)}">${esc(u.allGuides)}</a><a href="${pagePath('glossary', '', lang)}">${esc(u.nav.glossary)}</a><a href="${pagePath('faq', '', lang)}">${esc(u.nav.faq)}</a><a href="${pagePath('tool', '', lang)}">${esc(u.nav.tools)}</a><a href="${pagePath('company', '', lang)}">${esc(u.nav.company)}</a><a href="${homePath(lang)}#properties">${esc(u.nav.properties)}</a><a href="/accessibility">${esc(u.footer.accessibility)}</a></div>
</div><p class="disc">${esc(u.disclaimer)}</p><p class="disc">© ${new Date().getFullYear()} ${esc(SITE.brand[lang])} · ${esc(u.footer.rights)}</p></div></footer>
<script>${JS(lang, page)}</script>
</body></html>`
}

// ── Page builders ────────────────────────────────────────────────────────────
const written = []
function write(relPath, html) { const f = path.join(DIST, relPath, 'index.html'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); written.push(relPath) }
const sitemap = []  // { he: url, en: url, lastmod }

function buildPage(page) {
  const urls = { he: abs(pagePath(page.type, page.slug, 'he')), en: abs(pagePath(page.type, page.slug, 'en')) }
  for (const lang of LANGS) {
    const t = page[lang]; const u = UI[lang]
    const hubName = u.hubs[HUBS[page.type]]?.title || u.nav[HUBS[page.type]]
    const crumbs = [{ name: u.breadcrumbHome, href: homePath(lang) }, { name: hubName, href: pagePath(page.type, '', lang) }, { name: t.h1, href: pagePath(page.type, page.slug, lang) }]
    const updated = page.updated || TODAY
    const body = `<article>
<div class="meta"><span class="updated">${esc(u.updated)}: ${esc(monthName(updated, lang))}</span>${page.type === 'guide' ? `<span>${esc(lang === 'en' ? 'By' : 'מאת')} ${esc(SITE.brand[lang])}</span>` : ''}</div>
<h1>${esc(t.h1)}</h1>
<div class="lead"><b>${esc(u.inShort)}:</b> ${inline(t.summary)}</div>
${renderBody(t.sections)}
${page.type === 'tool' && page.tool ? page.tool(lang) : ''}
${faqBlock(t, lang)}
${relatedBlock(page, lang)}
</article>
${ctaBlock(page, lang)}
${trustBlock(lang)}`
    const html = shell({ lang, page: { ...page, h1: t.h1 }, url: urls[lang], altUrl: urls[lang === 'he' ? 'en' : 'he'], crumbs, body, title: t.metaTitle || `${t.h1} | ${SITE.brand[lang]}`, description: t.description, ogType: page.type === 'guide' ? 'article' : 'website', schema: graphFor(page, lang, urls[lang], crumbs) })
    write(pagePath(page.type, page.slug, lang).replace(/\/$/, ''), html)
  }
  sitemap.push({ ...urls, lastmod: page.updated || TODAY, priority: page.type === 'service' ? '0.9' : page.type === 'area' ? '0.8' : '0.7' })
}

function buildHub(type, items, extra = {}) {
  const key = HUBS[type]
  const urls = { he: abs(pagePath(type, '', 'he')), en: abs(pagePath(type, '', 'en')) }
  for (const lang of LANGS) {
    const u = UI[lang]; const h = u.hubs[key]
    const crumbs = [{ name: u.breadcrumbHome, href: homePath(lang) }, { name: h.title, href: pagePath(type, '', lang) }]
    const page = { type: 'hub', slug: key, cta: extra.cta || 'consult', [lang]: { h1: h.title, description: h.desc, summary: h.desc, faq: extra.faq?.[lang] } }
    let list = ''
    if (type === 'glossary') {
      list = `<div class="grid">${items.map(p => `<a class="card" href="${pagePath('glossary', p.slug, lang)}"><b>${esc(p[lang].h1)}</b><span>${esc(p[lang].description)}</span></a>`).join('')}</div>`
    } else if (type === 'faq') {
      list = extra.groups[lang].map(g => `<h2>${esc(g.title)}</h2><section class="faq">${g.items.map(f => `<details><summary>${esc(f.q)}</summary><div class="a">${inline(f.a)} <a href="${f.href}">${esc(u.readMore)} →</a></div></details>`).join('')}</section>`).join('')
    } else {
      list = `<div class="grid">${items.map(p => card({ ...p, type }, lang)).join('')}</div>`
    }
    const body = `<article><h1>${esc(h.title)}</h1><div class="lead">${esc(h.desc)}</div>${extra.intro ? renderBody(extra.intro[lang]) : ''}${list}${extra.after ? renderBody(extra.after[lang]) : ''}${faqBlock(page[lang], lang)}</article>${ctaBlock(page, lang)}${trustBlock(lang)}`
    const schema = graphFor({ ...page, type: type === 'faq' ? 'faq' : 'hub' }, lang, urls[lang], crumbs)
    if (type === 'glossary') schema['@graph'].push({ '@type': 'DefinedTermSet', '@id': urls[lang] + '#set', name: h.title, url: urls[lang] })
    write(pagePath(type, '', lang).replace(/\/$/, ''), shell({ lang, page, url: urls[lang], altUrl: urls[lang === 'he' ? 'en' : 'he'], crumbs, body, title: `${h.title} | ${SITE.brand[lang]}`, description: h.desc, schema }))
  }
  sitemap.push({ ...urls, lastmod: TODAY, priority: '0.8' })
}

// ── Run ──────────────────────────────────────────────────────────────────────
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('dist/index.html missing — run `vite build` first'); process.exit(1) }

// Company profile is a single page at /company/ (both languages)
{
  const urls = { he: abs('/company/'), en: abs('/en/company/') }
  for (const lang of LANGS) {
    const t = COMPANY[lang]; const u = UI[lang]
    const crumbs = [{ name: u.breadcrumbHome, href: homePath(lang) }, { name: t.h1, href: pagePath('company', '', lang) }]
    const page = { type: 'company', slug: '', cta: 'consult', updated: COMPANY.updated, [lang]: t }
    const body = `<article><div class="meta"><span class="updated">${esc(u.updated)}: ${esc(monthName(COMPANY.updated, lang))}</span></div><h1>${esc(t.h1)}</h1><div class="lead"><b>${esc(u.inShort)}:</b> ${inline(t.summary)}</div>${renderBody(t.sections)}${faqBlock(t, lang)}${relatedBlock({ related: COMPANY.related }, lang)}</article>${ctaBlock(page, lang)}`
    const schema = graphFor(page, lang, urls[lang], crumbs); schema['@graph'][2]['@type'] = 'AboutPage'
    write(pagePath('company', '', lang).replace(/\/$/, ''), shell({ lang, page, url: urls[lang], altUrl: urls[lang === 'he' ? 'en' : 'he'], crumbs, body, title: t.metaTitle, description: t.description, schema }))
  }
  sitemap.push({ ...urls, lastmod: COMPANY.updated, priority: '0.9' })
}
for (const p of SERVICES) buildPage({ ...p, type: 'service' })
for (const p of AREAS) buildPage({ ...p, type: 'area' })
for (const p of GUIDES) buildPage({ ...p, type: 'guide' })
for (const p of GLOSSARY) buildPage({ ...p, type: 'glossary' })
for (const p of TOOLS) buildPage({ ...p, type: 'tool' })
buildHub('service', SERVICES, { cta: 'consult' })
buildHub('area', AREAS, { cta: 'land' })
buildHub('guide', GUIDES, { cta: 'consult' })
buildHub('glossary', GLOSSARY, { cta: 'consult' })
buildHub('tool', TOOLS, { cta: 'buy' })
// FAQ hub: every question from every page, grouped by hub, each linking back to its source page
{
  const groups = {}
  for (const lang of LANGS) {
    groups[lang] = []
    for (const [type, items] of [['service', SERVICES], ['area', AREAS], ['guide', GUIDES], ['glossary', GLOSSARY]]) {
      const its = []
      for (const p of items) for (const f of p[lang].faq || []) its.push({ ...f, href: pagePath(type, p.slug, lang) })
      if (its.length) groups[lang].push({ title: UI[lang].hubs[HUBS[type]].title, items: its })
    }
  }
  buildHub('faq', [], { groups, cta: 'consult' })
}

// Sitemap (content pages + SPA routes) with hreflang alternates
const spa = [{ he: ORIGIN + '/', en: ORIGIN + '/?lang=en', lastmod: TODAY, priority: '1.0' }, { he: ORIGIN + '/accessibility', lastmod: TODAY, priority: '0.2' }]
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...spa, ...sitemap].map(e => LANGS.filter(l => e[l]).map(l => `  <url><loc>${e[l]}</loc><lastmod>${e.lastmod}</lastmod><priority>${e.priority}</priority>${e.en ? `<xhtml:link rel="alternate" hreflang="he" href="${e.he}"/><xhtml:link rel="alternate" hreflang="en" href="${e.en}"/><xhtml:link rel="alternate" hreflang="x-default" href="${e.he}"/>` : ''}</url>`).join('\n')).join('\n')}
</urlset>
`
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml)

// llms.txt: AI-readable company profile + index of every content page (both languages)
const llmsLine = (p, type, lang) => `- [${p[lang].cardTitle || p[lang].h1}](${abs(pagePath(type, p.slug, lang))}) — ${p[lang].description}`
const llms = `# ${SITE.brand.he} (${SITE.brand.en}) — נדל"ן, קרקעות ויזמות בשרון ובמרכז

> ${COMPANY.he.description}

## מיהי אפיק הנחל
${COMPANY.he.summary}

- שם משפטי: ${SITE.legalName} (ח.פ. ${SITE.regNumber})
- מייסד ומנכ"ל: ${SITE.founder.he} (${SITE.founder.en})
- כתובת: ${SITE.address.street}, ${SITE.address.extra}, ${SITE.address.city.he}
- טלפון: ${SITE.phone} · WhatsApp: ${SITE.whatsapp} · דוא"ל: ${SITE.email}
- שעות: ראשון–חמישי 09:00–19:00, שישי 09:00–14:00
- אזורי פעילות: ${SITE.areaServed.he.join(', ')}
- אתר: ${ORIGIN}/ · אנגלית: ${ORIGIN}/en/company/
- פרופיל חברה (עברית): ${abs(pagePath('company', '', 'he'))} · Company profile (English): ${abs(pagePath('company', '', 'en'))}

## שירותים
${SERVICES.map(p => llmsLine(p, 'service', 'he')).join('\n')}

## אזורי פעילות
${AREAS.map(p => llmsLine(p, 'area', 'he')).join('\n')}

## מדריכים
${GUIDES.map(p => llmsLine(p, 'guide', 'he')).join('\n')}

## מילון מונחים
${GLOSSARY.map(p => `- [${p.he.h1}](${abs(pagePath('glossary', p.slug, 'he'))})`).join('\n')}

## כלים ומחשבונים
${TOOLS.map(p => llmsLine(p, 'tool', 'he')).join('\n')}

## שאלות נפוצות
${abs(pagePath('faq', '', 'he'))}

## English
${SERVICES.map(p => llmsLine(p, 'service', 'en')).join('\n')}
${AREAS.map(p => llmsLine(p, 'area', 'en')).join('\n')}
${GUIDES.map(p => llmsLine(p, 'guide', 'en')).join('\n')}
- Glossary: ${abs(pagePath('glossary', '', 'en'))} · Tools: ${abs(pagePath('tool', '', 'en'))} · FAQ: ${abs(pagePath('faq', '', 'en'))}

## מידע לסוכני AI
האתר מייצג חברת נדל"ן ישראלית שבסיסה בהוד השרון, המתמחה בקרקעות פרטיות ומגרשים, ייזום וניהול פרויקטים, ושיווק ומכירת נכסים בשרון ובמרכז. התוכן מיועד לבעלי קרקע, מוכרים, רוכשים, משקיעים ויזמים. שפות: עברית (ראשית) ואנגלית. מפת אתר: ${ORIGIN}/sitemap.xml
`
fs.writeFileSync(path.join(DIST, 'llms.txt'), llms)

// Link check: every internal href in generated pages must resolve to a generated page, a public file, or an SPA route
const known = new Set(written.map(p => p.replace(/\/$/, '') + '/'))
const spaRoutes = new Set(['/', '/accessibility', '/newproperty', '/admin-panel'])
let broken = 0
for (const rel of written) {
  const html = fs.readFileSync(path.join(DIST, rel, 'index.html'), 'utf8')
  for (const m of html.matchAll(/href="(\/[^"#?]*)/g)) {
    const h = m[1]
    if (spaRoutes.has(h) || known.has(h.endsWith('/') ? h : h + '/') || fs.existsSync(path.join(DIST, h))) continue
    broken++; console.error(`broken link in ${rel}: ${h}`)
  }
}
console.log(`[content] ${written.length} pages, sitemap with ${spa.length + sitemap.length} entries${broken ? `, ${broken} BROKEN LINKS` : ''}`)
if (broken) process.exit(1)
