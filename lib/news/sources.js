// Single source of truth for the news pipeline: RSS sources, outlet normalisation,
// per-outlet caps, RSS parsing and image sanity checks.
// Imported by api/news.js, api/cron/warm.js, api/cron/rotate.js, api/news/archive.js and vite.config.js.

const gn = (label, query, extra = {}) => ({
  name: label,
  url: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=he&gl=IL&ceid=IL:he`,
  gn: true,
  ...extra,
})

// trusted:true → dedicated real-estate section: the classifier relaxes corroboration (never the veto).
export const RSS_SOURCES = [
  // ── ערוצי חדשות גדולים — מדורי נדל"ן ייעודיים ──
  { name: 'Ynet נדל"ן',          url: 'https://www.ynet.co.il/Integration/StoryRss8315.xml',                       trusted: true },
  { name: 'Globes נדל"ן',        url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederPage?iID=3',    trusted: true },
  { name: 'כלכליסט נדל"ן',       url: 'https://www.calcalist.co.il/rss/AID-1523869688.xml',                         trusted: true },
  { name: 'TheMarker נדל"ן',     url: 'https://www.themarker.com/cmlink/1.2-rss'                                                  },
  { name: 'Mako נדל"ן',          url: 'https://rss.mako.co.il/rss/31750a2610f26110VgnVCM1000005201000aRCRD.xml',    trusted: true },
  { name: 'מעריב נדל"ן',         url: 'https://www.maariv.co.il/rss/rssfeedsinglkategoriya,7213.xml',               trusted: true },
  { name: 'ישראל היום כלכלה',    url: 'https://www.israelhayom.co.il/rss.php?cat=7'                                               },
  { name: 'וואלה כלכלה',         url: 'https://rss.walla.co.il/feed/6'                                                             },
  { name: 'ביזפורטל נדל"ן',      url: 'https://www.bizportal.co.il/rss/realestate',                                 trusted: true },
  // ── מגזינים, פורטלים ובלוגים מקצועיים ──
  { name: 'BVD בניין ודיור',     url: 'https://www.bhd.co.il/feed/'                                                                },
  { name: 'ZUZNEWS',              url: 'https://zuznews.co.il/feed/',                                                trusted: true },
  { name: 'מרכז הנדל"ן',          url: 'https://www.nadlan-center.co.il/feed/',                                      trusted: true },
  { name: 'נדלן מאסטר',           url: 'https://nadlanmaster.co.il/feed/',                                           trusted: true },
  { name: 'מגדילים',              url: 'https://magdilim.co.il/feed/'                                                               },
  { name: 'Duns 100 נדל"ן',       url: 'https://www.duns100.co.il/feed/'                                                            },
  { name: 'CivilEng',             url: 'https://civileng.co.il/feed/'                                                               },
  { name: 'בית ונוי',              url: 'https://beitvanoy.co.il/feed/'                                                             },
  { name: 'עמית והגר Baddror',    url: 'https://baddror.co.il/feed/',                                                trusted: true },
  { name: 'נדלניר',               url: 'https://nadlannir.co.il/feed/',                                              trusted: true },
  { name: 'גורו נדלן',            url: 'https://gurunadlan.co.il/feed/',                                             trusted: true },
  { name: 'Brookwood נדלן',       url: 'https://brookwood.co.il/blog/feed/',                                         trusted: true },
  { name: 'רשת ברוקר נדל"ן',      url: 'https://broker-nadlan.co.il/feed/',                                          trusted: true },
  { name: 'מגזין הבלוק',          url: 'https://theblok.co.il/feed/',                                                trusted: true },
  { name: 'קפטן אינווסט',         url: 'https://captain-invest.co.il/feed/'                                                         },
  { name: "נדל\"ן בג'ינס",        url: 'https://nadlanbejeans.co.il/feed/',                                          trusted: true },
  { name: 'מדלן',                 url: 'https://www.madlan.co.il/blog/feed/',                                        trusted: true },
  { name: 'NADLAN.COM',           url: 'https://www.nadlan.com/feed/',                                               trusted: true },
  { name: 'השקעות נדל"ן בחו"ל',  url: 'https://israelforestrealestate.co.il/feed/',                                 trusted: true },
  { name: 'קליקת הנדל"ן',         url: 'https://klikat-nadlan.co.il/feed/',                                          trusted: true },
  // ── Google News — נושאים (מביא כתבות ממגוון אתרים) ──
  gn('Google נדל"ן',          'נדל"ן ישראל'),
  gn('Google מחירי דירות',    'מחירי הדירות'),
  gn('Google קרקעות',         'קרקעות למכירה ישראל'),
  gn('Google משכנתאות',       'משכנתאות'),
  gn('Google פינוי בינוי',    'פינוי בינוי'),
  gn('Google התחדשות',        'התחדשות עירונית'),
  gn('Google תמ"א 38',        'תמ"א 38'),
  gn('Google שוק הדיור',      'שוק הדיור'),
  gn('Google מחיר למשתכן',    'מחיר למשתכן OR "דירה בהנחה"'),
  gn('Google רמ"י',           'רמ"י מכרז'),
  gn('Google מס רכישה',       'מס רכישה OR "מס שבח" OR "היטל השבחה"'),
  gn('Google התחלות בנייה',   'התחלות בנייה'),
  gn('Google קבלנים',         'קבלנים בנייה ישראל'),
  gn('Google שכר דירה',       'שכר דירה'),
  gn('Google השקעות נדלן',    'השקעות נדל"ן'),
  gn('Google נדלן מניב',      'נדל"ן מניב OR "שוק המשרדים"'),
  gn('Google קניית דירה',     'קניית דירה'),
  gn('Google ועדה מחוזית',    'הוועדה המחוזית תוכנית יח"ד'),
  gn('Google צמודי קרקע',     'צמודי קרקע'),
  // ── Google News — אזור השרון (הליבה העסקית של אפיק הנחל) ──
  gn('Google נדל"ן השרון',    'נדל"ן השרון'),
  gn('Google כפר סבא',        'כפר סבא דירות OR נדל"ן'),
  gn('Google רעננה',          'רעננה דירות OR נדל"ן'),
  gn('Google הרצליה',         'הרצליה דירות OR נדל"ן'),
  gn('Google הוד השרון',      'הוד השרון דירות OR נדל"ן'),
  gn('Google נתניה',          'נתניה דירות OR נדל"ן'),
  // ── Google News — אתרים ספציפיים ──
  gn('Google ICE נדל"ן',      'site:ice.co.il נדל"ן'),
  gn('Google N12 נדל"ן',      'site:n12.co.il נדל"ן'),
  gn('Google יד2 נדל"ן',      'site:yad2.co.il נדל"ן'),
  gn('Google מדלן',           'site:madlan.co.il'),
  gn('Google Bizportal',      'site:bizportal.co.il נדל"ן'),
  gn('Google כאן נדל"ן',      'site:kan.org.il נדל"ן OR דיור'),
  gn('Google דבר דיור',       'site:davar1.co.il דיור OR נדל"ן'),
  gn('Google מרכז הנדל"ן',    'site:nadlan-center.co.il'),
  gn('Google גלובס נדל"ן',    'site:globes.co.il נדל"ן'),
  gn('Google כלכליסט נדל"ן',  'site:calcalist.co.il נדל"ן'),
  gn('Google TheMarker נדל"ן','site:themarker.com נדל"ן'),
  gn('Google וואלה נדל"ן',    'site:walla.co.il נדל"ן'),
]

// Major outlets publish many articles/day — cap them lower so specialist sites get slots.
export const BIG_OUTLETS = new Set(['ynet', 'maariv', 'globes', 'calcalist', 'themarker', 'mako', 'walla', 'israelhayom', 'bizportal', 'ice', 'kan'])
export const MAX_BIG     = 4   // per major outlet per ingest run
export const MAX_SMALL   = 6   // per specialist outlet per ingest run

// ── Outlet normalisation ──────────────────────────────────────────────────────
// Ynet-direct, Ynet-via-Google-News and "ynet" as a GN <source> label must all count as ONE outlet.
const DOMAIN_KEY = {
  'ynet.co.il': 'ynet', 'ynetnews.com': 'ynet', 'mynet.co.il': 'ynet',
  'globes.co.il': 'globes',
  'calcalist.co.il': 'calcalist',
  'themarker.com': 'themarker', 'haaretz.co.il': 'themarker',
  'mako.co.il': 'mako', 'n12.co.il': 'mako',
  'maariv.co.il': 'maariv',
  'walla.co.il': 'walla',
  'israelhayom.co.il': 'israelhayom',
  'kan.org.il': 'kan', 'reshet13.co.il': 'reshet13',
  'news1.co.il': 'news1', 'davar1.co.il': 'davar1',
  'ice.co.il': 'ice', 'yad2.co.il': 'yad2', 'bizportal.co.il': 'bizportal',
  'nadlan20.co.il': 'nadlan20', 'nadlan-center.co.il': 'nadlan-center', 'madlan.co.il': 'madlan',
  'bhd.co.il': 'bhd', 'nadlan.com': 'nadlan.com',
}
// Display-name → key, for Google News items whose URL is a news.google.com redirect.
const NAME_KEY = [
  [/ynet|וואינט|ווינט/i, 'ynet'], [/globes|גלובס/i, 'globes'], [/calcalist|כלכליסט/i, 'calcalist'],
  [/themarker|דה ?מרקר|הארץ|haaretz/i, 'themarker'], [/mako|מאקו|n12|חדשות 12/i, 'mako'], [/maariv|מעריב/i, 'maariv'],
  [/walla|וואלה/i, 'walla'], [/israel ?hayom|ישראל היום/i, 'israelhayom'], [/^כאן|^kan\b|kan\.org/i, 'kan'],
  [/bizportal|ביזפורטל/i, 'bizportal'], [/^ice$|ice\.co\.il/i, 'ice'], [/yad2|יד2|יד 2/i, 'yad2'], [/^דבר$|^דבר ראשון|davar1/i, 'davar1'],
  [/מרכז הנדל/i, 'nadlan-center'], [/מדלן|madlan/i, 'madlan'], [/בניין ודיור|bhd/i, 'bhd'], [/nadlan\.com/i, 'nadlan.com'],
  [/רשת 13|reshet/i, 'reshet13'], [/news1|ניוז1/i, 'news1'], [/זוז|zuz/i, 'zuznews'], [/ערוץ 7|arutz/i, 'arutz7'],
  [/srugim|סרוגים/i, 'srugim'], [/kikar|כיכר/i, 'kikar'], [/bhol|בחדרי/i, 'bhol'], [/פסגות|psagot/i, 'psagot'],
]
export function outletKey(url, source = '') {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    if (!h.includes('google.')) return DOMAIN_KEY[h] || h
  } catch {}
  for (const [re, key] of NAME_KEY) if (re.test(source)) return key
  return String(source || '').toLowerCase().replace(/["״'׳]/g, '').replace(/\s+/g, '-') || 'unknown'
}
export function outletCap(key) { return BIG_OUTLETS.has(key) ? MAX_BIG : MAX_SMALL }

// ── Image sanity ──────────────────────────────────────────────────────────────
export function isArticleImage(url) {
  if (!url || typeof url !== 'string') return false
  const u = url.toLowerCase()
  if (!u.startsWith('http') || u.length < 24) return false
  return !/logo|favicon|icon|default|placeholder|blank|avatar|generic|pixel|spacer|1x1|sprite|badge/.test(u) &&
         !u.endsWith('.svg') && !u.endsWith('.gif')
}

// Remove image URLs shared by 2+ articles (= source logo / default thumbnail)
export function deduplicateImages(articles) {
  const n = {}
  articles.forEach(a => { if (a.image) n[a.image] = (n[a.image] || 0) + 1 })
  return articles.map(a => ({ ...a, image: a.image && n[a.image] === 1 ? a.image : '' }))
}

export const RSS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/xml,text/xml,application/rss+xml,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
}

const decode = s => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')

// Title-based dedupe key (same story syndicated across outlets / GN + direct)
export function titleKey(title) {
  return String(title || '').replace(/[״"'׳]/g, '').replace(/\s+/g, '').slice(0, 30)
}

/**
 * Parse an RSS/Atom-ish XML string into article objects.
 * Google News items: resolves the real outlet name from <source>; the link stays a GN redirect
 * (GN no longer exposes the publisher URL), so outlet identity comes from `source`.
 */
export function parseRSS(xml, sourceName, { gn = false, trusted = false } = {}) {
  const items = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    const c = m[1]
    const g = re => decode((c.match(re) || [])[1]).trim()

    const rawTitle = g(/<title[^>]*>([\s\S]*?)<\/title>/)
    const link     = g(/<link[^>]*>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+?)\s*(?:\]\]>)?\s*<\/link>/)
                  || g(/<guid[^>]*>\s*(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+?)\s*(?:\]\]>)?\s*<\/guid>/)
    const pubDate  = g(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || g(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/)
    if (!rawTitle || !link) continue

    const tagUrl = tag => ((c.match(new RegExp(`<${tag}[^>]*>`))?.[0] || '').match(/url=["']([^"']+)["']/) || [])[1] || ''
    const imgMedia = tagUrl('media:content') || tagUrl('media:thumbnail')
    const imgEnc   = g(/<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/)
                  || g(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image[^"']*["']/)
    const descHtml = decode((c.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1])
    const contentHtml = decode((c.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/) || [])[1])
    const imgDesc  = ((descHtml + contentHtml).match(/<img[^>]+src=["']([^"']+)["']/) || [])[1] || ''
    // GN thumbnails are source-branded cards, not the article image
    const rawImg = gn ? '' : (imgMedia || imgEnc || imgDesc || '')

    const title = rawTitle.replace(/<[^>]+>/g, '').trim()
    let desc = descHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    let articleUrl = link, displaySource = sourceName
    if (gn) {
      const src = g(/<source[^>]*>([^<]+)<\/source>/)
      if (src) displaySource = src
      // GN titles end with " - Outlet"; GN descriptions are just the linked title → no signal
      const cut = title.lastIndexOf(' - ')
      if (cut > 10) { /* keep title as-is for display; classifier normalises */ }
      desc = ''
      const real = descHtml.match(/href=["']?(https?:\/\/(?!news\.google)[^"'\s>]+)/i)
      if (real) articleUrl = real[1]
    }
    const d = pubDate ? new Date(pubDate) : new Date()
    items.push({
      id: link, title, desc: desc.slice(0, 400), url: articleUrl, link,
      image: isArticleImage(rawImg) ? rawImg : '',
      source: displaySource, trusted, gn,
      publishedAt: isNaN(d) ? new Date().toISOString() : d.toISOString(),
    })
  }
  return items
}

// Fetch every source with bounded concurrency (Google News rate-limits bursts) AND a hard overall
// deadline: whatever has arrived when the deadline hits is returned, the rest is aborted.
// A serverless function must answer inside its maxDuration no matter how slow one publisher is.
export async function fetchAllSources({ timeoutMs = 7000, concurrency = 12, deadlineMs = 12000, log = () => {} } = {}) {
  const queue = [...RSS_SOURCES]
  const out = []
  const master = new AbortController()
  let expired = false
  const deadline = setTimeout(() => { expired = true; master.abort() }, deadlineMs)
  const stats = { ok: 0, failed: 0, skipped: 0 }

  async function worker() {
    while (queue.length && !expired) {
      const s = queue.shift()
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), timeoutMs)
      const onMaster = () => ctrl.abort()
      master.signal.addEventListener('abort', onMaster, { once: true })
      try {
        const r = await fetch(s.url, { headers: RSS_HEADERS, signal: ctrl.signal, redirect: 'follow' })
        if (!r.ok) { stats.failed++; log(`${s.name}: HTTP ${r.status}`); continue }
        const items = parseRSS(await r.text(), s.name, { gn: !!s.gn, trusted: !!s.trusted })
        stats.ok++; log(`${s.name}: ${items.length} items`)
        out.push(...items)
      } catch (e) {
        stats.failed++; log(`${s.name}: ${expired ? 'deadline' : e.name === 'AbortError' ? 'timeout' : e.message}`)
      } finally {
        clearTimeout(t); master.signal.removeEventListener('abort', onMaster)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
  clearTimeout(deadline)
  stats.skipped = queue.length
  log(`done: ${stats.ok} ok, ${stats.failed} failed, ${stats.skipped} not started${expired ? ' (deadline hit)' : ''}`)
  out.stats = stats
  return out
}

// Strip the " - Outlet" suffix Google News appends to titles
export function cleanTitle(title, gn) {
  const t = String(title || '').trim()
  if (!gn) return t
  const cut = t.lastIndexOf(' - ')   // GN appends ' - Outlet'; lastIndexOf keeps any ' - ' inside the headline itself
  return cut > 0 ? t.slice(0, cut).trim() : t
}
