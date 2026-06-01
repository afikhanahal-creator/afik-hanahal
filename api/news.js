// Vercel serverless — fetches Israeli real-estate RSS, balances sources, enriches with og:image
const RENDER   = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const MAX_PER_SOURCE = 3   // max articles per outlet (by domain) in the final feed

// ── RSS sources — all real-estate focused ────────────────────────────────────
const RSS_SOURCES = [
  // ── ערוצי חדשות גדולים — קטגוריות נדל"ן ייעודיות ──
  { name: 'Ynet נדל"ן',          url: 'https://www.ynet.co.il/Integration/StoryRss8315.xml'                                                       },
  { name: 'Globes נדל"ן',        url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederPage?iID=3'                                    },
  { name: 'כלכליסט נדל"ן',       url: 'https://www.calcalist.co.il/rss/AID-1523869688.xml'                                                         },
  { name: 'TheMarker נדל"ן',     url: 'https://www.themarker.com/cmlink/1.2-rss'                                                                   },
  { name: 'Mako נדל"ן',          url: 'https://rss.mako.co.il/rss/31750a2610f26110VgnVCM1000005201000aRCRD.xml'                                    },
  { name: 'מעריב נדל"ן',         url: 'https://www.maariv.co.il/rss/rssfeedsinglkategoriya,7213.xml'                                               },
  { name: 'ישראל היום כלכלה',    url: 'https://www.israelhayom.co.il/rss.php?cat=7'                                                                },
  { name: 'Walla כלכלה',         url: 'https://rss.walla.co.il/feed/6'                                                                             },
  { name: 'ביזפורטל נדל"ן',      url: 'https://www.bizportal.co.il/rss/realestate'                                                                 },
  // ── מגזינים, פורטלים ובלוגים מקצועיים ──
  { name: 'BVD בניין ודיור',     url: 'https://www.bhd.co.il/feed/'                                                                               },
  { name: 'ZUZNEWS',              url: 'https://zuznews.co.il/feed/'                                                                               },
  { name: 'מרכז הנדל"ן',          url: 'https://www.nadlan-center.co.il/feed/'                                                                     },
  { name: 'נדלן מאסטר',           url: 'https://nadlanmaster.co.il/feed/'                                                                         },
  { name: 'מגדילים',              url: 'https://magdilim.co.il/feed/'                                                                             },
  { name: 'Duns נדל"ן',           url: 'https://www.duns100.co.il/feed/'                                                                          },
  { name: 'CivilEng',             url: 'https://civileng.co.il/feed/'                                                                             },
  { name: 'בית ונוי',              url: 'https://beitvanoy.co.il/feed/'                                                                           },
  { name: 'Baddror נדלן',         url: 'https://baddror.co.il/feed/'                                                                              },
  { name: 'נדלניר',               url: 'https://nadlannir.co.il/feed/'                                                                            },
  { name: 'גורו נדלן',            url: 'https://gurunadlan.co.il/feed/'                                                                           },
  { name: 'Brookwood נדלן',       url: 'https://brookwood.co.il/blog/feed/'                                                                        },
  { name: 'ברוקר נדל"ן',          url: 'https://broker-nadlan.co.il/feed/'                                                                        },
  { name: 'מגזין הבלוק',          url: 'https://theblok.co.il/feed/'                                                                              },
  { name: 'קפטן אינווסט',         url: 'https://captain-invest.co.il/feed/'                                                                       },
  { name: "נדל\"ן בג'ינס",        url: 'https://nadlanbejeans.co.il/feed/'                                                                        },
  { name: 'מדלן',                 url: 'https://www.madlan.co.il/blog/feed/'                                                                      },
  { name: 'NADLAN.COM',           url: 'https://www.nadlan.com/feed/'                                                                             },
  { name: 'ICE נדל"ן',           url: 'https://www.ice.co.il/category/realestate/feed/' },
  { name: 'N12 כלכלה',           url: 'https://www.n12.co.il/rss/economy.xml' },
  { name: 'יד2 בלוג',            url: 'https://www.yad2.co.il/blog/feed/' },
  { name: 'נדלן 2.0',            url: 'https://nadlan20.co.il/feed/' },
  // ── Google News — נושאים נבחרים ממגוון אתרי חדשות ──
  { name: 'Google נדל"ן',        url: 'https://news.google.com/rss/search?q=%D7%A0%D7%93%D7%9C%22%D7%9F+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',                                                                     gn: true },
  { name: 'Google דירות',        url: 'https://news.google.com/rss/search?q=%D7%9E%D7%97%D7%99%D7%A8%D7%99+%D7%93%D7%99%D7%A8%D7%95%D7%AA+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',                                   gn: true },
  { name: 'Google קרקעות',       url: 'https://news.google.com/rss/search?q=%D7%A7%D7%A8%D7%A7%D7%A2%D7%95%D7%AA+%D7%9C%D7%9E%D7%9B%D7%99%D7%A8%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',                       gn: true },
  { name: 'Google משכנתאות',     url: 'https://news.google.com/rss/search?q=%D7%9E%D7%A9%D7%9B%D7%A0%D7%AA%D7%90%D7%95%D7%AA+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',                                               gn: true },
  { name: 'Google פינוי בינוי',  url: 'https://news.google.com/rss/search?q=%D7%A4%D7%99%D7%A0%D7%95%D7%99+%D7%91%D7%99%D7%A0%D7%95%D7%99+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',                                   gn: true },
  { name: 'Google התחדשות',      url: 'https://news.google.com/rss/search?q=%D7%94%D7%AA%D7%97%D7%93%D7%A9%D7%95%D7%AA+%D7%A2%D7%99%D7%A8%D7%95%D7%A0%D7%99%D7%AA&hl=he&gl=IL&ceid=IL:he',                                         gn: true },
  { name: 'Google שוק הנדל"ן',   url: 'https://news.google.com/rss/search?q=%D7%A9%D7%95%D7%A7+%D7%94%D7%93%D7%99%D7%95%D7%A8+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',                                             gn: true },
  { name: 'Google קבלנים',       url: 'https://news.google.com/rss/search?q=%D7%A7%D7%91%D7%9C%D7%A0%D7%99%D7%9D+%D7%91%D7%A0%D7%99%D7%99%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',                           gn: true },
  { name: 'Google שכר דירה',     url: 'https://news.google.com/rss/search?q=%D7%A9%D7%9B%D7%A8+%D7%93%D7%99%D7%A8%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',                                                   gn: true },
  { name: 'Google השקעות נדלן',  url: 'https://news.google.com/rss/search?q=%D7%94%D7%A9%D7%A7%D7%A2%D7%95%D7%AA+%D7%A0%D7%93%D7%9C%D7%9F+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',                                 gn: true },
  { name: 'Google נדלן מסחרי',   url: 'https://news.google.com/rss/search?q=%D7%A0%D7%93%D7%9C%D7%9F+%D7%9E%D7%A1%D7%97%D7%A8%D7%99+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',                                       gn: true },
  { name: 'Google קניית דירה',   url: 'https://news.google.com/rss/search?q=%D7%A7%D7%A0%D7%99%D7%99%D7%AA+%D7%93%D7%99%D7%A8%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',                                       gn: true },
  { name: 'Google ICE נדל"ן',    url: 'https://news.google.com/rss/search?q=site%3Aice.co.il+%D7%A0%D7%93%D7%9C%D7%9F&hl=he&gl=IL&ceid=IL:he', gn: true },
  { name: 'Google N12 נדל"ן',    url: 'https://news.google.com/rss/search?q=site%3An12.co.il+%D7%A0%D7%93%D7%9C%D7%9F&hl=he&gl=IL&ceid=IL:he', gn: true },
  { name: 'Google יד2 נדל"ן',    url: 'https://news.google.com/rss/search?q=site%3Ayad2.co.il+%D7%A0%D7%93%D7%9C%D7%9F&hl=he&gl=IL&ceid=IL:he', gn: true },
  { name: 'Google רשות מיסים',   url: 'https://news.google.com/rss/search?q=%D7%A8%D7%A9%D7%95%D7%AA+%D7%94%D7%9E%D7%99%D7%A1%D7%99%D7%9D+%D7%9E%D7%99%D7%A1%D7%95%D7%99+%D7%9E%D7%A7%D7%A8%D7%A7%D7%A2%D7%99%D7%9F&hl=he&gl=IL&ceid=IL:he', gn: true },
  { name: 'Google מדלן',         url: 'https://news.google.com/rss/search?q=site%3Amadlan.co.il&hl=he&gl=IL&ceid=IL:he', gn: true },
  { name: 'Google Bizportal',    url: 'https://news.google.com/rss/search?q=site%3Abizportal.co.il+%D7%A0%D7%93%D7%9C%D7%9F&hl=he&gl=IL&ceid=IL:he', gn: true },
]

const HE_RE     = /[א-ת]/
const RE_FILTER = /נדל|דיר[הות]|דיור|שכיר[ות]|שוכר|משכיר|קרק[ע]|מגרש|משכנת|פינוי.?בינוי|התחדשות.?עירונית|מקרקעין|טאבו|קבלן|יזם|בנייה|בניין|תמ.?א|מגורים|שרון|כפר.?סבא|רעננה|נתניה|הוד.?השרון|ראשון.?לציון|פתח.?תקווה|רמת.?גן|בני.?ברק|שוק.?הנד|מחיר.*דיר|רכישת.?דיר|דירה.*למכיר|למכיר.*דיר|אחוזי.?מימון|ריבית.*משכנת|כינוס.?נכסים|תל.?אביב.*נדל|ירושלים.*נדל|הלוואת.?נדל|שכר.?דירה|שוכרים|משכיר|מתחם|יח.?ד|בנייה.?רוויה|בניה.?רוויה|פרויקט|ביצוע.?בינוי|רוכשי.?דיר|שוק.?הדיור|מחיר.?לדיירים|זכות.?בדירה|דמי.?שכירות/i
function isHebrew(text)      { return HE_RE.test(text) }
function isRealEstate(title) { return RE_FILTER.test(title) }

function isArticleImage(url) {
  if (!url || typeof url !== 'string') return false
  const u = url.toLowerCase()
  if (!u.startsWith('http') || u.length < 24) return false
  return !u.includes('logo') && !u.includes('favicon') && !u.includes('icon') &&
         !u.includes('default') && !u.includes('placeholder') && !u.includes('blank') &&
         !u.includes('avatar') && !u.includes('generic') && !u.includes('pixel') &&
         !u.includes('spacer') && !u.includes('1x1') &&
         !u.endsWith('.svg') && !u.endsWith('.gif')
}

// Map URL domain → normalized outlet key so Ynet direct feed + Ynet-from-GN count as one source
const DOMAIN_KEY = {
  'ynet.co.il': 'ynet', 'ynetnews.com': 'ynet',
  'globes.co.il': 'globes',
  'calcalist.co.il': 'calcalist',
  'themarker.com': 'themarker', 'haaretz.co.il': 'themarker',
  'mako.co.il': 'mako', 'n12.co.il': 'mako',
  'maariv.co.il': 'maariv',
  'walla.co.il': 'walla',
  'israelhayom.co.il': 'israelhayom',
  'kan.org.il': 'kan', 'reshet13.co.il': 'reshet13',
  'news1.co.il': 'news1', 'davar1.co.il': 'davar1',
  'ice.co.il': 'ice',
  'yad2.co.il': 'yad2',
  'n12.co.il': 'n12',
  'nadlan20.co.il': 'nadlan20',
}
function outletKey(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    return DOMAIN_KEY[h] || h
  } catch { return '' }
}

// Cap each outlet at MAX_PER_SOURCE articles (keyed by domain, not display name)
function balanceSources(articles) {
  const counts = {}
  const out = []
  for (const a of articles) {
    const key = outletKey(a.url) || a.source || ''
    counts[key] = (counts[key] || 0) + 1
    if (counts[key] <= MAX_PER_SOURCE) out.push(a)
  }
  return out
}

// Interleave articles from different outlets (A, B, C, A, B, C, ...)
// Groups by domain key so Ynet-direct and Ynet-from-GN don't get double slots
function shuffleSources(articles) {
  const byOutlet = {}
  articles.forEach(a => {
    const key = outletKey(a.url) || a.source || ''
    if (!byOutlet[key]) byOutlet[key] = []
    byOutlet[key].push(a)
  })
  const queues = Object.values(byOutlet)
  const out = []
  let anyLeft = true
  while (anyLeft) {
    anyLeft = false
    for (const q of queues) {
      if (q.length) { out.push(q.shift()); anyLeft = true }
    }
  }
  return out
}

// Remove image URLs that appear on 2+ articles (= source logo / default thumbnail)
function deduplicateImages(articles) {
  const imgCount = {}
  articles.forEach(a => { if (a.image) imgCount[a.image] = (imgCount[a.image] || 0) + 1 })
  return articles.map(a => ({ ...a, image: (a.image && imgCount[a.image] === 1) ? a.image : '' }))
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/xml,text/xml,application/rss+xml,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
}

function parseRSS(xml, sourceName, trusted = false, isGN = false) {
  const items = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    const c = m[1]
    const g = (re) => (c.match(re) || [])[1]?.trim()
      ?.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'") || ''

    const rawTitle = g(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
    const link     = g(/<link[^>]*>(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+?)\s*(?:\]\]>)?<\/link>/)
               || g(/<guid[^>]*>(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+?)\s*(?:\]\]>)?<\/guid>/)
    const pubDate  = g(/<pubDate[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/)

    // Image — multiple extraction strategies
    const extractTagUrl = tag => {
      const t = c.match(new RegExp(`<${tag}[^>]*>`))?.[0] || ''
      return (t.match(/url=["']([^"']+)["']/) || [])[1] || ''
    }
    const imgMedia = extractTagUrl('media:content') || extractTagUrl('media:thumbnail')
    const imgEnc   = g(/<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/)
               || g(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image[^"']*["']/)
    // Description HTML (decoded) — Google News thumbnails live here as <img src="...">
    const rawDesc = (c.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] || ''
    const descDec = rawDesc
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&')
    const imgDesc = (descDec.match(/<img[^>]+src=["']([^"']+)["']/) || [])[1] || ''

    const rawImg = imgMedia || imgEnc || imgDesc || ''
    const image  = isArticleImage(rawImg) ? rawImg : ''

    if (!rawTitle || !link) continue
    const title = rawTitle.replace(/<[^>]+>/g, '').trim()
    const date  = pubDate ? new Date(pubDate) : new Date()

    // For Google News: extract actual article URL + real outlet name
    let articleUrl    = link
    let displaySource = sourceName
    if (isGN) {
      const realHref = descDec.match(/href=["']?(https?:\/\/(?!news\.google)[^"'\s>]+)/i)
      if (realHref) articleUrl = realHref[1]
      const gnSrc = g(/<source[^>]*>([^<]+)<\/source>/)
      if (gnSrc) displaySource = gnSrc
    }

    items.push({ id: link, title, url: articleUrl, link, image, source: displaySource, trusted,
      publishedAt: date.toISOString(), date })
  }
  return items
}

async function fetchOGImage(url) {
  try {
    const r = await fetch(url, {
      headers: { ...HEADERS, Accept: 'text/html,application/xhtml+xml,*/*' },
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    })
    if (!r.ok) return ''
    try { if (new URL(r.url).hostname.includes('google.com')) return '' } catch {}
    const html = await r.text()
    const img = (
      html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i)
    )?.[1]?.replace(/&amp;/g,'&').trim() || ''
    return isArticleImage(img) ? img : ''
  } catch { return '' }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── Fast path: serve Supabase-curated "featured" articles (set by rotate cron) ─
  // The rotate cron marks exactly 4 articles as featured=true every morning at 9am.
  // This path is instant (~50ms) vs. the RSS fetch path (~3-8s).
  if (SUPA_URL && SUPA_KEY) {
    try {
      const url = `${SUPA_URL}/rest/v1/news_articles` +
        `?select=id,title,url,image,source,published_at` +
        `&lang=eq.he&featured=eq.true&image=not.is.null&image=neq.` +
        `&order=published_at.desc&limit=8`
      const r = await fetch(url, {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      if (r.ok) {
        const data = await r.json()
        const articles = (Array.isArray(data) ? data : []).filter(a => a.image)
        if (articles.length >= 4) {
          console.log(`[news] serving ${articles.length} featured articles from Supabase`)
          res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
          return res.status(200).json(articles)
        }
      }
    } catch (e) {
      console.warn('[news] Supabase featured read skipped:', e.message)
    }
  }

  // ── RSS path: fetch live from sources, balance, return ───────────────────────
  try {
    const results = await Promise.allSettled(
      RSS_SOURCES.map(async ({ name, url, trusted = false, gn = false }) => {
        try {
          const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
          if (!r.ok) { console.warn(`[news] ${name} ${r.status}`); return [] }
          const parsed = parseRSS(await r.text(), name, trusted, gn)
          console.log(`[news] ${name}: ${parsed.length} (${parsed.filter(a=>a.image).length} with image)`)
          return parsed
        } catch (e) { console.warn(`[news] ${name}:`, e.message); return [] }
      })
    )

    const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
    const byDate = a => new Date(a.publishedAt).getTime()

    // Direct-source articles first (beat GN duplicates in dedup)
    const combined = [
      ...all.filter(a => !a.link.includes('news.google.com')).sort((a,b) => byDate(b) - byDate(a)),
      ...all.filter(a =>  a.link.includes('news.google.com')).sort((a,b) => byDate(b) - byDate(a)),
    ]

    // Deduplicate by title, filter to Hebrew real-estate
    const seen = new Set()
    let articles = combined.filter(a => {
      if (!a.title || !a.link) return false
      if (!isHebrew(a.title)) return false
      if (!isRealEstate(a.title)) return false
      const key = a.title.replace(/\s+/g,'').slice(0, 30)
      if (seen.has(key)) return false
      seen.add(key); return true
    })

    // Sort by date, then balance sources and interleave
    articles = articles.sort((a, b) => byDate(b) - byDate(a))
    articles = balanceSources(articles)   // max MAX_PER_SOURCE per outlet
    articles = shuffleSources(articles)   // interleave: Ynet, Globes, TheMarker, Ynet, ...
    articles = deduplicateImages(articles)
    articles = articles.slice(0, 50)

    const sources = [...new Set(articles.map(a => a.source))]
    console.log(`[news] ${articles.length} articles from ${sources.length} sources: ${sources.join(', ')}`)

    if (articles.length > 0) {
      // OG-enrich articles still missing images (capped at 20 to stay within Vercel timeout)
      const needImg = articles.filter(a => !a.image).slice(0, 20)
      if (needImg.length > 0) {
        const ogResults = await Promise.allSettled(needImg.map(a => fetchOGImage(a.url)))
        const ogMap = new Map(needImg.map((a, i) => [a.id, ogResults[i]]))
        articles = articles.map(a => {
          if (!a.image && ogMap.has(a.id)) {
            const img = ogMap.get(a.id)?.value || ''
            return { ...a, image: isArticleImage(img) ? img : '' }
          }
          return a
        })
      }

      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
      return res.status(200).json(articles)
    }
    console.warn('[news] 0 articles from RSS, falling back to Render')
  } catch (e) {
    console.error('[news] RSS error:', e.message)
  }

  // ── Fallback: Render backend ──────────────────────────────────────────────
  try {
    const r = await fetch(`${RENDER}/api/news/feed`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    })
    if (r.ok) {
      const json = await r.json()
      if (Array.isArray(json) && json.length) {
        res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
        return res.status(200).json(json)
      }
    }
  } catch (e) { console.error('[news] Render fallback:', e.message) }

  return res.status(502).json({ error: 'Could not load news' })
}
