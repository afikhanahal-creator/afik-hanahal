// Vercel serverless — fetches Israeli real-estate RSS, balances sources, enriches with og:image
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'

const MAX_PER_SOURCE = 3   // max articles per outlet in the final feed

// trusted:true = dedicated real-estate section, skip keyword filter
const RSS_SOURCES = [
  // ── Direct Hebrew feeds ──────────────────────────────────────────────────────
  { name: 'Ynet נדל"ן',       url: 'https://www.ynet.co.il/Integration/StoryRss8315.xml',                                                                                  trusted: true  },
  { name: 'Globes נדל"ן',     url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederPage?iID=3',                                                              trusted: true  },
  { name: 'כלכליסט נדל"ן',    url: 'https://www.calcalist.co.il/rss/AID-1523869688.xml',                                                                                   trusted: true  },
  { name: 'TheMarker נדל"ן',  url: 'https://www.themarker.com/cmlink/1.2-rss',                                                                                             trusted: true  },
  { name: 'Mako נדל"ן',       url: 'https://rss.mako.co.il/rss/31750a2610f26110VgnVCM1000005201000aRCRD.xml',                                                              trusted: true  },
  { name: 'מעריב נדל"ן',      url: 'https://www.maariv.co.il/rss/rssfeedsinglkategoriya,7213.xml',                                                                         trusted: true  },
  { name: 'ישראל היום כלכלה', url: 'https://www.israelhayom.co.il/rss.php?cat=7',                                                                                          trusted: false },
  { name: 'Walla כלכלה',      url: 'https://rss.walla.co.il/feed/6',                                                                                                       trusted: false },
  // ── Google News searches (aggregate many outlets, always provide thumbnails) ──
  { name: 'Google נדל"ן',     url: 'https://news.google.com/rss/search?q=%D7%A0%D7%93%D7%9C%D7%9F+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',              trusted: true, gn: true },
  { name: 'Google דירות',     url: 'https://news.google.com/rss/search?q=%D7%9E%D7%97%D7%99%D7%A8%D7%99+%D7%93%D7%99%D7%A8%D7%95%D7%AA+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he', trusted: true, gn: true },
  { name: 'Google קרקעות',    url: 'https://news.google.com/rss/search?q=%D7%A7%D7%A8%D7%A7%D7%A2%D7%95%D7%AA+%D7%9C%D7%9E%D7%9B%D7%99%D7%A8%D7%94+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he', trusted: true, gn: true },
  { name: 'Google משכנתאות',  url: 'https://news.google.com/rss/search?q=%D7%9E%D7%A9%D7%9B%D7%A0%D7%AA%D7%90%D7%95%D7%AA+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he', trusted: true, gn: true },
  { name: 'Google פינוי בינוי',url: 'https://news.google.com/rss/search?q=%D7%A4%D7%99%D7%A0%D7%95%D7%99+%D7%91%D7%99%D7%A0%D7%95%D7%99+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he', trusted: true, gn: true },
  { name: 'Google התחדשות',   url: 'https://news.google.com/rss/search?q=%D7%94%D7%AA%D7%97%D7%93%D7%A9%D7%95%D7%AA+%D7%A2%D7%99%D7%A8%D7%95%D7%A0%D7%99%D7%AA&hl=he&gl=IL&ceid=IL:he', trusted: true, gn: true },
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

// Interleave articles from different sources (A, B, C, A, B, C, ...)
function shuffleSources(articles) {
  const bySource = {}
  articles.forEach(a => {
    const s = a.source || ''
    if (!bySource[s]) bySource[s] = []
    bySource[s].push(a)
  })
  const queues = Object.values(bySource)
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

  // ── Primary: fetch RSS from Vercel ────────────────────────────────────────
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
