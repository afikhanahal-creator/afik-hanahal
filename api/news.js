// Vercel serverless — fetches Israeli real-estate RSS directly, enriches with og:image
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'
const CUTOFF_48H = 48 * 60 * 60 * 1000

const RSS_SOURCES = [
  // מדורי נדל"ן ייעודיים
  { name: 'Bizportal נדל"ן', url: 'https://www.bizportal.co.il/rss/realEstate' },
  { name: 'TheMarker נדל"ן', url: 'https://www.themarker.com/cmlink/1.4476' },
  { name: 'Globes נדל"ן',    url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=1111' },
  { name: 'Calcalist נדל"ן', url: 'https://www.calcalist.co.il/rss/AjaxPage,7340,L-4,00.html' },
  { name: 'Ynet נדל"ן',      url: 'https://www.ynet.co.il/Integration/StoryRss2.aspx?id=3082' },
  { name: 'Mako נדל"ן',      url: 'https://rcs.mako.co.il/rss/economy.xml' },
  { name: 'ישראל היום',      url: 'https://www.israelhayom.co.il/rss.aspx' },
  { name: 'N12 כלכלה',       url: 'https://www.n12.co.il/rss/homepage.xml' },
  // אתרי נדל"ן מתמחים
  { name: 'מרכז הנדל"ן',     url: 'https://www.m-nadlan.co.il/feed/' },
  { name: 'נדל"ן 2.0',        url: 'https://www.nadlan20.co.il/feed/' },
  { name: 'מגדילים',          url: 'https://magdilim.co.il/feed/' },
]

const RE_FILTER = /נדל[""ן]|נדלן|דיר[הות]|דיור|שכיר[ות]|שוכר|משכיר|קרק[ע]|מגרש|משכנת|פינוי.?בינוי|התחדשות עירונית|מקרקעין|טאבו|קבלן|יזם.?נד|בנייה|בניין|תמ.?א|מגורים|שרון|כפר.?סבא|רעננה|נתניה|הוד.השרון|שוק הד|מחירי ד|רכישת ד/
function isRealEstate(title) { return RE_FILTER.test(title) }

function isArticleImage(url) {
  if (!url) return false
  const u = url.toLowerCase()
  return !u.includes('logo') && !u.includes('default') && !u.includes('placeholder') && !u.includes('favicon') && !u.includes('generic')
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/xml,text/xml,application/rss+xml,*/*;q=0.8',
  'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8',
}

function parseRSS(xml, sourceName) {
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

    items.push({ id: link, title, url: link, link, image, source: sourceName,
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
      RSS_SOURCES.map(async ({ name, url }) => {
        try {
          const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
          if (!r.ok) { console.warn(`[news] ${name} ${r.status}`); return [] }
          const parsed = parseRSS(await r.text(), name)
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

    // Strict real-estate keyword filter — no fallback to non-RE content
    articles = articles.filter(a => isRealEstate(a.title)).slice(0, 50)

    console.log(`[news] after 48h filter: ${articles.length} articles`)

    if (articles.length > 0) {
      // Enrich with og:image for articles missing images (parallel, max 15)
      const needImg = articles.filter(a => !a.image).slice(0, 15)
      if (needImg.length > 0) {
        const ogResults = await Promise.allSettled(needImg.map(a => fetchOGImage(a.url)))
        let idx = 0
        articles = articles.map(a => {
          if (!a.image) {
            const r = ogResults[idx++]
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
        res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
        return res.status(200).json(json)
      }
    }
  } catch (e) { console.error('[news] Render fallback:', e.message) }

  return res.status(502).json({ error: 'Could not load news' })
}
