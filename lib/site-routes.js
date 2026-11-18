// An address for every section of the homepage (2026-11-18 — the office: "a path for every section you click, so the site is easy
// to organise and promote, with a proper sitemap, for more organic and paid exposure"). The homepage stays one page; each section
// also has its own address (/properties/, /process/, /contact/ …, English under /en/), which:
//   • a click in the menu / footer puts in the address bar (pushState) — a link people can share and ads can point at;
//   • opened directly, lands on the homepage scrolled to that section, in that language (src/App.jsx), with the section's own
//     first screen painted from the HTML before the app arrives (lib/home-page.js renderHome { route });
//   • is a real file at deploy time (dist/<path>/index.html, scripts/build-properties.mjs) with its own <title>, description,
//     canonical, hreflang, Open Graph and breadcrumb — and is listed in sitemap.xml.
// "services" and "faq" already have richer static hubs (/services/, /faq/ — scripts/build-content.mjs), so their section
// addresses point their canonical at the hub and stay out of the sitemap (no two pages competing for one search).
// Pure and shared by the build, the app and the probe. Tested in site-routes.test.mjs.

export const ORIGIN = 'https://www.afikhanahal.co.il'
const BRAND = { he: 'אפיק הנחל', en: 'Afik Hanahal' }

/** Every section address. `id` = the section's element id in App.jsx (NAV_LINKS). */
export const SECTION_ROUTES = [
  { id: 'home', path: { he: '/', en: '/en/' }, priority: '1.0',
    title: { he: 'אפיק הנחל - ייזום שיווק ותיווך | נדל״ן וקרקעות בשרון ובמרכז', en: 'Afik Hanahal | Real Estate, Land & Development in the Sharon Region' },
    desc: { he: 'חברה יזמית מהוד השרון: איתור, שיווק וליווי עסקאות קרקע, מגרשים, פרויקטים ודירות בשרון ובמרכז, מהאיתור ועד הרישום בטאבו.', en: 'A development company from Hod Hasharon: sourcing, marketing and guiding land, plot and project deals in the Sharon region, through to Tabu registration.' } },
  { id: 'properties', path: { he: '/properties/', en: '/en/properties/' }, priority: '0.9',
    title: { he: 'נכסים למכירה ולהשכרה: קרקעות, מגרשים ופרויקטים | אפיק הנחל', en: 'Properties for Sale and Rent: Land, Plots & Projects | Afik Hanahal' },
    desc: { he: 'קרקעות, מגרשים, פרויקטים בשיווק, דירות ונכסים מסחריים בשרון ובמרכז. סינון לפי עיר, מחיר וחדרים, ופרטים מלאים על כל נכס.', en: 'Land, plots, projects, apartments and commercial property in the Sharon region and central Israel. Filter by town, price and rooms, with full details.' } },
  { id: 'process', path: { he: '/process/', en: '/en/process/' }, priority: '0.7',
    title: { he: 'תהליך הליווי: שישה שלבים מהאיתור ועד הטאבו | אפיק הנחל', en: 'Our Process: Six Steps from Sourcing to Tabu | Afik Hanahal' },
    desc: { he: 'איך נראית עסקת קרקע איתנו: איתור, בדיקות, תכנון, שיווק, משא ומתן ורישום בטאבו. ליווי אחד, מהשיחה הראשונה ועד המפתח.', en: 'How a land deal works with us: sourcing, due diligence, planning, marketing, negotiation and Tabu registration. One team from the first call to the keys.' } },
  { id: 'services', path: { he: '/our-services/', en: '/en/our-services/' }, canonical: { he: '/services/', en: '/en/services/' }, priority: '0.8',
    title: { he: 'השירותים שלנו: ייזום, שיווק ותיווך קרקעות | אפיק הנחל', en: 'Our Services: Development, Marketing & Land Brokerage | Afik Hanahal' },
    desc: { he: 'ייזום וניהול פרויקטים, שיווק ותיווך קרקעות ומגרשים, ליווי משקיעים ובעלי קרקע בשרון ובמרכז.', en: 'Project development and management, marketing and brokerage of land and plots, and guidance for investors and landowners in the Sharon region and central Israel.' } },
  { id: 'testimonials', path: { he: '/reviews/', en: '/en/reviews/' }, priority: '0.6',
    title: { he: 'לקוחות מספרים: המלצות על אפיק הנחל', en: 'Client Reviews | Afik Hanahal' },
    desc: { he: 'לקוחות שליווינו בקניית קרקע, במכירת מגרש ובהשקעה בפרויקט מספרים איך זה היה.', en: 'Clients we guided through buying land, selling a plot or investing in a project share how it went.' } },
  { id: 'news', path: { he: '/news/', en: '/en/news/' }, priority: '0.6',
    title: { he: 'מה חדש בנדל״ן בשרון ובמרכז | אפיק הנחל', en: 'Real Estate News from the Sharon Region | Afik Hanahal' },
    desc: { he: 'עדכונים מעולם הנדל״ן והקרקעות: תכניות, שינויי שוק ומה שחשוב לדעת לפני עסקה.', en: 'Updates from the world of real estate and land: plans, market changes and what to know before a deal.' } },
  { id: 'faq', path: { he: '/questions/', en: '/en/questions/' }, canonical: { he: '/faq/', en: '/en/faq/' }, priority: '0.7',
    title: { he: 'שאלות נפוצות על קרקעות ועסקאות נדל״ן | אפיק הנחל', en: 'FAQ: Land and Real Estate Deals | Afik Hanahal' },
    desc: { he: 'תשובות לשאלות הנפוצות על קניית קרקע, מגרשים, היטלים, רישום בטאבו ושירותי אפיק הנחל.', en: 'Answers to common questions about buying land and plots, levies, Tabu registration and Afik Hanahal\'s services.' } },
  { id: 'ceo', path: { he: '/ceo/', en: '/en/ceo/' }, priority: '0.5',
    title: { he: 'ישראל בן יהודה, מייסד ומנכ״ל | אפיק הנחל', en: 'Israel Ben-Yehuda, Founder & CEO | Afik Hanahal' },
    desc: { he: 'הדרך של ישראל בן יהודה, מייסד ומנכ״ל אפיק הנחל: כ-30 שנות ניסיון בקרקעות, ייזום ונדל״ן בשרון.', en: 'The path of Israel Ben-Yehuda, founder and CEO of Afik Hanahal: about 30 years in land, development and real estate in the Sharon region.' } },
  { id: 'story', path: { he: '/our-story/', en: '/en/our-story/' }, priority: '0.5',
    title: { he: 'הסיפור שלנו | אפיק הנחל - ייזום שיווק ותיווך', en: 'Our Story | Afik Hanahal' },
    desc: { he: 'כל קרקע נושאת היסטוריה. הסיפור של אפיק הנחל, חברה יזמית מהוד השרון.', en: 'Every plot of land carries a history. The story of Afik Hanahal, a development company from Hod Hasharon.' } },
  { id: 'about', path: { he: '/about/', en: '/en/about/' }, priority: '0.7',
    title: { he: 'אודות אפיק הנחל - ייזום שיווק ותיווך בשרון', en: 'About Afik Hanahal | Development & Brokerage in the Sharon Region' },
    desc: { he: 'חברה יזמית בתחום קרקעות ומגרשים, עם מומחיות בשיווק ותיווך באזור השרון והמרכז. מי אנחנו ואיך אנחנו עובדים.', en: 'A development company specialising in land and plots, with expertise in marketing and brokerage in the Sharon region and central Israel. Who we are and how we work.' } },
  { id: 'contact', path: { he: '/contact/', en: '/en/contact/' }, priority: '0.8',
    title: { he: 'צרו קשר: טלפון, וואטסאפ ותיאום שיחה | אפיק הנחל', en: 'Contact Us: Phone, WhatsApp & Booking a Call | Afik Hanahal' },
    desc: { he: 'דברו איתנו בטלפון 055-981-1814, בוואטסאפ או קבעו שיחת היכרות קצרה. משרד בהוד השרון, ימים א׳-ה׳ 9:00-19:00.', en: 'Call us on +972-55-981-1814, message us on WhatsApp or book a short intro call. Office in Hod Hasharon, Sunday to Thursday 9:00-19:00.' } },
]

const BY_ID = new Map(SECTION_ROUTES.map(r => [r.id, r]))
const norm = p => { let s = String(p || '/').split(/[?#]/)[0] || '/'; try { s = decodeURI(s) } catch { /* as is */ } s = s.replace(/\/{2,}/g, '/'); return s.endsWith('/') ? s : s + '/' }

/** A section's address in a language ('/process/', '/en/process/'); unknown id → the home of that language */
export function sectionPath(id, lang = 'he') {
  const r = BY_ID.get(id) || BY_ID.get('home')
  return r.path[lang === 'en' ? 'en' : 'he']
}

/** The address bar → { id, lang } for a section address (with or without its last slash), else null */
export function routeForPath(pathname) {
  const p = norm(pathname)
  for (const r of SECTION_ROUTES) for (const lang of ['he', 'en']) if (norm(r.path[lang]) === p) return { id: r.id, lang }
  return null
}

/** The same place in the other language (a section address, else the language's home) */
export function switchLangPath(pathname, lang) {
  const hit = routeForPath(pathname)
  return sectionPath(hit ? hit.id : 'home', lang)
}

export const sectionRoute = id => BY_ID.get(id) || null
const abs = (p, origin = ORIGIN) => origin.replace(/\/$/, '') + p

/** The canonical address of a section page: its own, or the hub it duplicates */
export function canonicalOf(route, lang, origin = ORIGIN) {
  const l = lang === 'en' ? 'en' : 'he'
  return abs((route.canonical && route.canonical[l]) || route.path[l], origin)
}

/** Sitemap entries (only the sections that are their own canonical) — { he, en, priority, lastmod } */
export function sitemapEntries(lastmod, origin = ORIGIN) {
  return SECTION_ROUTES.filter(r => !r.canonical).map(r => ({ he: abs(r.path.he, origin), en: abs(r.path.en, origin), priority: r.priority, lastmod }))
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const jsonLd = o => JSON.stringify(o).replace(/</g, '\\u003c')

/**
 * The built index.html → this section page's head: title, description, canonical, hreflang, Open Graph / Twitter, the html
 * lang / dir, a WebPage + BreadcrumbList node (sharing the site's #org), and window.__afikRoute for the app.
 */
export function applyRouteHead(html, route, lang, origin = ORIGIN) {
  const l = lang === 'en' ? 'en' : 'he'
  const title = route.title[l], desc = route.desc[l]
  const self = abs(route.path[l], origin)
  const canonical = canonicalOf(route, l, origin)
  const heUrl = abs(route.path.he, origin), enUrl = abs(route.path.en, origin)
  const crumbs = [{ name: BRAND[l], item: abs(sectionPath('home', l), origin) }]
  if (route.id !== 'home') crumbs.push({ name: title.split(' | ')[0], item: self })
  const graph = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': self + '#webpage', url: self, name: title, description: desc, inLanguage: l === 'en' ? 'en' : 'he-IL', isPartOf: { '@id': origin + '/#website' }, about: { '@id': origin + '/#org' } },
    { '@type': 'BreadcrumbList', '@id': self + '#breadcrumb', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) },
  ] }
  let out = String(html)
  const set = (re, tag) => { out = re.test(out) ? out.replace(re, tag) : out.replace(/<\/head>/i, `${tag}\n</head>`) }
  set(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
  set(/<meta name="description"[^>]*>/i, `<meta name="description" content="${esc(desc)}" />`)
  set(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${esc(title)}" />`)
  set(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${esc(desc)}" />`)
  set(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${esc(self)}" />`)
  set(/<meta property="og:locale"[^>]*>/i, `<meta property="og:locale" content="${l === 'en' ? 'en_US' : 'he_IL'}" />`)
  set(/<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${esc(title)}" />`)
  set(/<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${esc(desc)}" />`)
  set(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${esc(canonical)}" />`)
  // hreflang: both languages + x-default (Hebrew), for the canonical pair
  out = out.replace(/\s*<link rel="alternate" hreflang="[^"]*"[^>]*>/gi, '')
  const alt = route.canonical ? { he: abs(route.canonical.he, origin), en: abs(route.canonical.en, origin) } : { he: heUrl, en: enUrl }
  out = out.replace(/<\/head>/i, `    <link rel="alternate" hreflang="he" href="${esc(alt.he)}" />\n    <link rel="alternate" hreflang="en" href="${esc(alt.en)}" />\n    <link rel="alternate" hreflang="x-default" href="${esc(alt.he)}" />\n    <script type="application/ld+json">${jsonLd(graph)}</script>\n    <script>window.__afikRoute=${JSON.stringify({ id: route.id, lang: l })}</script>\n</head>`)
  if (l === 'en') out = out.replace(/<html([^>]*)>/i, (m, a) => `<html${a.replace(/\s(lang|dir)="[^"]*"/gi, '')} lang="en" dir="ltr">`)
  return out
}

/** For the app: the title and description of the section on screen (document.title / meta description follow navigation) */
export function routeMeta(id, lang) {
  const r = BY_ID.get(id) || BY_ID.get('home')
  const l = lang === 'en' ? 'en' : 'he'
  return { title: r.title[l], desc: r.desc[l], path: r.path[l], canonical: canonicalOf(r, l) }
}
