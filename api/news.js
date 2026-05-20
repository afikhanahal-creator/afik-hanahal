// Vercel serverless — fetches Israeli real-estate RSS directly (no Render cold-start dependency)
const RENDER = process.env.RENDER_URL || 'https://afik-hanahal-server.onrender.com'

const RSS_SOURCES = [
  { name: 'Ynet נדל"ן',      url: 'https://www.ynet.co.il/Integration/StoryRss2.aspx?id=3082' },
  { name: 'Walla! נדל"ן',    url: 'https://rss.walla.co.il/feed/22' },
  { name: 'Globes נדל"ן',    url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=1111' },
  { name: 'Calcalist נדל"ן', url: 'https://www.calcalist.co.il/rss/AjaxPage,7340,L-4,00.html' },
  { name: 'Bizportal נדל"ן', url: 'https://www.bizportal.co.il/rss/realEstate' },
  { name: 'Mako נדל"ן',      url: 'https://rcs.mako.co.il/rss/31750a2610f26110VgnVCM1000004463daa0RCRD.xml' },
]

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
    const image = imgMedia || imgEnc || imgDesc || ''
    const date  = pubDate ? new Date(pubDate) : new Date()

    items.push({ id: link, title, url: link, link, image, source: sourceName,
      publishedAt: date.toISOString(), date })
  }
  return items
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ── Primary: fetch RSS directly from Vercel (always available, no cold start) ──
  try {
    const results = await Promise.allSettled(
      RSS_SOURCES.map(async ({ name, url }) => {
        try {
          const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) })
          if (!r.ok) { console.warn(`[news] ${name} returned ${r.status}`); return [] }
          const xml = await r.text()
          const parsed = parseRSS(xml, name)
          console.log(`[news] ${name}: ${parsed.length} articles`)
          return parsed
        } catch (e) {
          console.warn(`[news] ${name} failed:`, e.message)
          return []
        }
      })
    )

    const seen = new Set()
    const articles = results
      .flatMap(r => r.status === 'fulfilled' ? r.value : [])
      .filter(a => {
        if (!a.title || !a.link) return false
        const key = a.title.replace(/\s+/g,'').slice(0, 30)
        if (seen.has(key)) return false
        seen.add(key); return true
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, 50)

    console.log(`[news] total articles: ${articles.length}`)

    if (articles.length > 0) {
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600')
      return res.status(200).json(articles)
    }
    console.warn('[news] all RSS sources returned 0 articles, falling back to Render')
  } catch (e) {
    console.error('[news] RSS fetch error:', e.message)
  }

  // ── Fallback: Render backend (has Supabase cache) ────────────────────────
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
  } catch (e) {
    console.error('[news] Render fallback failed:', e.message)
  }

  return res.status(502).json({ error: 'Could not load news from any source' })
}
