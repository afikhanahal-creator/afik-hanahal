// Vercel cron — every 2 hours:
//   1. Fetches RSS from 39 real-estate sources in parallel
//   2. Filters to Hebrew real-estate articles from the last 7 days
//   3. Balances sources (max 3 per outlet) then upserts new articles to Supabase
//   4. Pings Render to keep the free-tier server alive
// schedule: "0 */2 * * *"   maxDuration: 15

const RENDER      = process.env.RENDER_URL       || 'https://afik-hanahal-server.onrender.com'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN       || 'AFIKhanahal2026'
const SUPA_URL    = process.env.SUPABASE_URL      || process.env.VITE_SUPABASE_URL
const SUPA_KEY    = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const MAX_PER_SOURCE = 3

// ── Same source list as api/news.js ──────────────────────────────────────────
const RSS_SOURCES = [
  // ערוצי חדשות גדולים
  { name: 'Ynet נדל"ן',          url: 'https://www.ynet.co.il/Integration/StoryRss8315.xml'                                                       },
  { name: 'Globes נדל"ן',        url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederPage?iID=3'                                    },
  { name: 'כלכליסט נדל"ן',       url: 'https://www.calcalist.co.il/rss/AID-1523869688.xml'                                                         },
  { name: 'TheMarker נדל"ן',     url: 'https://www.themarker.com/cmlink/1.2-rss'                                                                   },
  { name: 'Mako נדל"ן',          url: 'https://rss.mako.co.il/rss/31750a2610f26110VgnVCM1000005201000aRCRD.xml'                                    },
  { name: 'מעריב נדל"ן',         url: 'https://www.maariv.co.il/rss/rssfeedsinglkategoriya,7213.xml'                                               },
  { name: 'ישראל היום כלכלה',    url: 'https://www.israelhayom.co.il/rss.php?cat=7'                                                                },
  { name: 'Walla כלכלה',         url: 'https://rss.walla.co.il/feed/6'                                                                             },
  { name: 'ביזפורטל נדל"ן',      url: 'https://www.bizportal.co.il/rss/realestate'                                                                 },
  // מגזינים, פורטלים ובלוגים מקצועיים
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
  // Google News — נושאים נבחרים
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
]

const HE_RE     = /[א-ת]/
const RE_FILTER = /נדל|דיר[הות]|דיור|שכיר[ות]|שוכר|משכיר|קרק[ע]|מגרש|משכנת|פינוי.?בינוי|התחדשות.?עירונית|מקרקעין|טאבו|קבלן|יזם|בנייה|בניין|תמ.?א|מגורים|כפר.?סבא|רעננה|נתניה|הוד.?השרון|ראשון.?לציון|פתח.?תקווה|רמת.?גן|בני.?ברק|שוק.?הנד|מחיר.*דיר|רכישת.?דיר|דירה.*למכיר|למכיר.*דיר|אחוזי.?מימון|ריבית.*משכנת|כינוס.?נכסים|הלוואת.?נדל|שכר.?דירה|שוכרים|מתחם|יח.?ד|בנייה.?רוויה|פרויקט|ביצוע.?בינוי|רוכשי.?דיר|שוק.?הדיור|דמי.?שכירות/i

const DOMAIN_KEY = {
  'ynet.co.il': 'ynet', 'ynetnews.com': 'ynet',
  'globes.co.il': 'globes',
  'calcalist.co.il': 'calcalist',
  'themarker.com': 'themarker', 'haaretz.co.il': 'themarker',
  'mako.co.il': 'mako', 'n12.co.il': 'mako',
  'maariv.co.il': 'maariv',
  'walla.co.il': 'walla',
  'israelhayom.co.il': 'israelhayom',
}

const HEADERS = {
  'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Accept':        'application/xml,text/xml,application/rss+xml,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
}

function outletKey(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '')
    return DOMAIN_KEY[h] || h
  } catch { return '' }
}

function parseRSS(xml, sourceName, isGN = false) {
  const items = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    const c = m[1]
    const g = re => (c.match(re) || [])[1]?.trim()
      ?.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'") || ''

    const rawTitle = g(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
    const link     = g(/<link[^>]*>(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+?)\s*(?:\]\]>)?<\/link>/)
               || g(/<guid[^>]*>(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+?)\s*(?:\]\]>)?<\/guid>/)
    const pubDate  = g(/<pubDate[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/)

    const extractTagUrl = tag => {
      const t = c.match(new RegExp(`<${tag}[^>]*>`))?.[0] || ''
      return (t.match(/url=["']([^"']+)["']/) || [])[1] || ''
    }
    const imgMedia = extractTagUrl('media:content') || extractTagUrl('media:thumbnail')
    const imgEnc   = g(/<enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']+)["']/)
               || g(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image[^"']*["']/)
    const rawDesc  = (c.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] || ''
    const descDec  = rawDesc.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
      .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&')
    const imgDesc  = (descDec.match(/<img[^>]+src=["']([^"']+)["']/) || [])[1] || ''

    const rawImg = imgMedia || imgEnc || imgDesc || ''
    const isGoodImg = url => {
      if (!url || !url.startsWith('http') || url.length < 24) return false
      const u = url.toLowerCase()
      return !u.includes('logo') && !u.includes('favicon') && !u.includes('icon') &&
             !u.includes('default') && !u.includes('placeholder') && !u.includes('blank') &&
             !u.includes('avatar') && !u.includes('pixel') && !u.includes('spacer') &&
             !u.includes('1x1') && !u.endsWith('.svg') && !u.endsWith('.gif')
    }
    const image = isGoodImg(rawImg) ? rawImg : ''

    if (!rawTitle || !link) continue
    const title = rawTitle.replace(/<[^>]+>/g, '').trim()
    const date  = pubDate ? new Date(pubDate) : new Date()

    let articleUrl    = link
    let displaySource = sourceName
    if (isGN) {
      const realHref = descDec.match(/href=["']?(https?:\/\/(?!news\.google)[^"'\s>]+)/i)
      if (realHref) articleUrl = realHref[1]
      const gnSrc = g(/<source[^>]*>([^<]+)<\/source>/)
      if (gnSrc) displaySource = gnSrc
    }

    items.push({ title, url: articleUrl, image, source: displaySource,
      publishedAt: isNaN(date) ? new Date().toISOString() : date.toISOString() })
  }
  return items
}

async function refreshSupabase() {
  if (!SUPA_URL || !SUPA_KEY) return { count: 0, note: 'no Supabase config' }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)

  // 1. Fetch all RSS sources in parallel (7s timeout each)
  const raw = await Promise.allSettled(
    RSS_SOURCES.map(async ({ name, url, gn = false }) => {
      try {
        const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(7000) })
        if (!r.ok) return []
        const parsed = parseRSS(await r.text(), name, gn)
        console.log(`[warm] ${name}: ${parsed.length} articles`)
        return parsed
      } catch (e) {
        console.warn(`[warm] ${name}: ${e.message}`)
        return []
      }
    })
  )

  const all = raw.flatMap(r => r.status === 'fulfilled' ? r.value : [])

  // 2. Filter: Hebrew, real-estate, within 7 days, dedup by title
  const seen = new Set()
  const filtered = all.filter(a => {
    if (!a.title || !a.url) return false
    if (!HE_RE.test(a.title)) return false
    if (!RE_FILTER.test(a.title)) return false
    if (new Date(a.publishedAt) < sevenDaysAgo) return false
    const key = a.title.replace(/\s+/g, '').slice(0, 30)
    if (seen.has(key)) return false
    seen.add(key); return true
  })

  // 3. Balance: max MAX_PER_SOURCE articles per outlet (newest first)
  const counts = {}
  const balanced = filtered
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .filter(a => {
      const key = outletKey(a.url) || a.source || ''
      counts[key] = (counts[key] || 0) + 1
      return counts[key] <= MAX_PER_SOURCE
    })

  if (!balanced.length) return { count: 0, note: 'nothing passed filters' }

  // 4. Fetch existing URLs from Supabase to skip duplicates
  let existingUrls = new Set()
  try {
    const cutoff = encodeURIComponent(sevenDaysAgo.toISOString())
    const er = await fetch(
      `${SUPA_URL}/rest/v1/news_articles?select=url&lang=eq.he&published_at=gte.${cutoff}&limit=1000`,
      { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(4000) }
    )
    if (er.ok) existingUrls = new Set((await er.json()).map(a => a.url))
  } catch {}

  const newRows = balanced
    .filter(a => !existingUrls.has(a.url))
    .map(a => ({
      title:        a.title.slice(0, 500),
      url:          a.url,
      image:        a.image || null,
      source:       a.source,
      published_at: a.publishedAt,
      lang:         'he',
      archived:     false,
    }))

  if (!newRows.length) return { count: 0, note: 'all articles already in Supabase' }

  // 5. Batch insert new articles
  const ir = await fetch(`${SUPA_URL}/rest/v1/news_articles`, {
    method: 'POST',
    headers: {
      apikey:         SUPA_KEY,
      Authorization:  `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify(newRows),
    signal: AbortSignal.timeout(8000),
  })

  if (!ir.ok) {
    const t = await ir.text().catch(() => '')
    console.error('[warm] insert failed:', ir.status, t.slice(0, 200))
    return { count: 0, error: `Supabase ${ir.status}: ${t.slice(0, 100)}` }
  }

  const sources = [...new Set(newRows.map(a => a.source))]
  console.log(`[warm] inserted ${newRows.length} articles from ${sources.length} sources: ${sources.slice(0, 12).join(', ')}`)
  return { count: newRows.length, sourceCount: sources.length, sources: sources.slice(0, 15) }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  // Ping Render in background (non-blocking — just keeps it alive)
  fetch(`${RENDER}/api/news/rebuild`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
    signal:  AbortSignal.timeout(10000),
  }).catch(() => {})

  // RSS fetch + Supabase upsert (this is the main work)
  const result = await refreshSupabase()

  return res.status(200).json({ ok: true, ...result, ts: new Date().toISOString() })
}
