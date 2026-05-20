// Vercel serverless — fetches Israeli real-estate RSS directly, enriches with og:image
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'

// trusted:true = dedicated real-estate feed, skip keyword filter
const RSS_SOURCES = [
  { name: 'Google נדל"ן',  url: 'https://news.google.com/rss/search?q=%D7%A0%D7%93%D7%9C%D7%9F+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he', trusted: true },
  { name: 'Google דיור',   url: 'https://news.google.com/rss/search?q=%D7%9E%D7%97%D7%99%D7%A8%D7%99+%D7%93%D7%99%D7%A8%D7%95%D7%AA+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he', trusted: true },
  { name: 'Ynet נדל"ן',    url: 'https://www.ynet.co.il/Integration/StoryRss8315.xml' },
  { name: 'Ynet כלכלה',    url: 'https://www.ynet.co.il/Integration/StoryRss6.xml' },
  { name: 'Globes נדל"ן',  url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederKeyword?iID=1385', trusted: true },
]

const RE_FILTER = /נדל|דיר[הות]|דיור|שכיר[ות]|שוכר|משכיר|קרק[ע]|מגרש|משכנת|פינוי.?בינוי|התחדשות עירונית|מקרקעין|טאבו|קבלן|יזם.?נד|בנייה|בניין|תמ.?א|מגורים|שרון|כפר.?סבא|רעננה|נתניה|הוד.השרון|שוק הד|מחירי ד|רכישת ד|real.?estate|mortgage|housing/i
function isRealEstate(title) { return RE_FILTER.test(title) }

function isArticleImage(url) {
  if (!url) return false
  const u = url.toLowerCase()
  return !u.includes('logo') && !u.includes('default') && !u.includes('placeholder')
    && !u.includes('favicon') && !u.includes('generic')
}

function deduplicateImages(articles) {
  const imgCount = {}
  articles.forEach(a => { if (a.image) imgCount[a.image] = (imgCount[a.image] || 0) + 1 })
  // Any image URL shared by 2+ articles is a source logo — clear it
  return articles.map(a => ({ ...a, image: (a.image && imgCount[a.image] === 1) ? a.image : '' }))
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/xml,text/xml,application/rss+xml,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
}

function parseRSS(xml, sourceName, trusted = false) {
  const items = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g
  let m
  while ((m = itemRe.exec(xml)) !== null) {
    const c = m[1]
    const g = (re) => (c.match(re) || [])[1]?.trim()
      ?.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'") || ''

    const rawTitle = g(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)
    const link     = g(/<link[^>]*>\s*(https?:\/\/[^\s<]+)\s*<\/link>/)
               || g(/<guid[^>]*>(https?:\/\/[^\s<]+)<\/guid>/)
    const pubDate  = g(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)
    const imgMedia = g(/<media:content[^>]+url=["']([^"']+)["']/)
               || g(/<media:thumbnail[^>]+url=["']([^"']+)["']/)
    const imgEnc   = g(/<enclosure[^>]+url=["']([^"']+)["']/)
    const imgDesc  = (c.match(/<description[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/) || [])[1] || ''

    if (!rawTitle || !link) continue
    const title = rawTitle.replace(/<[^>]+>/g, '')
    const rawImg = imgMedia || imgEnc || imgDesc || ''
    const image = isArticleImage(rawImg) ? rawImg : ''
    const date  = pubDate ? new Date(pubDate) : new Date()

    // For Google News: extract actual article URL + real source name
    let articleUrl = link
    let displaySource = sourceName
    if (link.includes('news.google.com')) {
      const rawDesc = (c.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] || ''
      const decoded = rawDesc.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&')
      const realHref = decoded.match(/href=["']?(https?:\/\/(?!news\.google)[^"'\s>]+)/i)
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
    const html = await r.text()
    return (
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)?.[1] ||
      ''
    )
  } catch { return '' }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── Primary: fetch RSS directly from Vercel ───────────────────────────────
  try {
    const results = await Promise.allSettled(
      RSS_SOURCES.map(async ({ name, url, trusted = false }) => {
        try {
          const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
          if (!r.ok) { console.warn(`[news] ${name} ${r.status}`); return [] }
          const parsed = parseRSS(await r.text(), name, trusted)
          console.log(`[news] ${name}: ${parsed.length}`)
          return parsed
        } catch (e) { console.warn(`[news] ${name}:`, e.message); return [] }
      })
    )

    // Deduplicate
    const seen = new Set()
    let articles = results
      .flatMap(r => r.status === 'fulfilled' ? r.value : [])
      .filter(a => {
        if (!a.title || !a.link) return false
        const key = a.title.replace(/\s+/g,'').slice(0, 30)
        if (seen.has(key)) return false
        seen.add(key); return true
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))

    // Trusted feeds pass through; general feeds require keyword match
    articles = articles.filter(a => a.trusted || isRealEstate(a.title)).slice(0, 50)

    // Clear any image URL shared by 2+ articles (= source logo, not article image)
    articles = deduplicateImages(articles)

    console.log(`[news] after filter: ${articles.length} articles`)

    if (articles.length > 0) {
      // Enrich with og:image for articles missing images (parallel, max 30)
      // Prioritise non-Google-News articles (direct source URLs are more scrapeable)
      const withoutImg = articles.filter(a => !a.image)
      const needImg = [
        ...withoutImg.filter(a => !a.link.includes('news.google.com')),
        ...withoutImg.filter(a =>  a.link.includes('news.google.com')),
      ].slice(0, 30)
      if (needImg.length > 0) {
        const ogResults = await Promise.allSettled(needImg.map(a => fetchOGImage(a.url)))
        const ogMap = new Map(needImg.map((a, i) => [a.id, ogResults[i]]))
        articles = articles.map(a => {
          if (!a.image && ogMap.has(a.id)) {
            const r = ogMap.get(a.id)
            const ogImg = (r?.status === 'fulfilled' ? r.value : '') || ''
            return { ...a, image: isArticleImage(ogImg) ? ogImg : '' }
          }
          return a
        })
      }

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
      return res.status(200).json(articles)
    }
    console.warn('[news] 0 articles from RSS, falling back to Render')
  } catch (e) {
    console.error('[news] RSS error:', e.message)
  }

  // ── Fallback: Render backend ───────────────────────────────────────────────
  try {
    const r = await fetch(`${RENDER}/api/news/feed`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    })
    if (r.ok) {
      const json = await r.json()
      if (Array.isArray(json) && json.length) {
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
        return res.status(200).json(json)
      }
    }
  } catch (e) { console.error('[news] Render fallback:', e.message) }

  return res.status(502).json({ error: 'Could not load news' })
}
