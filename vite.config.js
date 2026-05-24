import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// trusted:true = dedicated real-estate section feed, skip keyword filter
const RSS_SOURCES = [
  // Direct Hebrew feeds — include media:content images
  { name: 'Ynet נדל"ן',       url: 'https://www.ynet.co.il/Integration/StoryRss8315.xml',                                                                                  trusted: true  },
  { name: 'Ynet כלכלה',       url: 'https://www.ynet.co.il/Integration/StoryRss6.xml',                                                                                     trusted: false },
  { name: 'Globes נדל"ן',     url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederPage?iID=3',                                                              trusted: true  },
  { name: 'כלכליסט נדל"ן',    url: 'https://www.calcalist.co.il/rss/AID-1523869688.xml',                                                                                   trusted: true  },
  { name: 'TheMarker נדל"ן',   url: 'https://www.themarker.com/cmlink/1.2-rss',                                                                                             trusted: true  },
  { name: 'Mako נדל"ן',       url: 'https://rss.mako.co.il/rss/31750a2610f26110VgnVCM1000005201000aRCRD.xml',                                                              trusted: true  },
  { name: 'Walla כלכלה',      url: 'https://rss.walla.co.il/feed/6',                                                                                                       trusted: false },
  // Google News Hebrew searches — no images but ensure Hebrew content breadth
  { name: 'Google נדל"ן',     url: 'https://news.google.com/rss/search?q=%D7%A0%D7%93%D7%9C%D7%9F+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he',              trusted: true  },
  { name: 'Google דיור',      url: 'https://news.google.com/rss/search?q=%D7%9E%D7%97%D7%99%D7%A8%D7%99+%D7%93%D7%99%D7%A8%D7%95%D7%AA+%D7%99%D7%A9%D7%A8%D7%90%D7%9C&hl=he&gl=IL&ceid=IL:he', trusted: true },
]

const HE_RE     = /[א-ת]/
const RE_FILTER = /נדל|דיר[הות]|דיור|שכיר[ות]|שוכר|משכיר|קרק[ע]|מגרש|משכנת|פינוי.?בינוי|התחדשות עירונית|מקרקעין|טאבו|קבלן|יזם.?נד|בנייה|בניין|תמ.?א|מגורים|שרון|כפר.?סבא|רעננה|נתניה|הוד.השרון|שוק הד|מחירי ד|רכישת ד/i
function isHebrew(text)      { return HE_RE.test(text) }
function isRealEstate(title) { return RE_FILTER.test(title) }

// Skip logos, placeholders, and generic thumbnails
function isArticleImage(url) {
  if (!url) return false
  const u = url.toLowerCase()
  return !u.includes('logo') && !u.includes('default') && !u.includes('placeholder')
    && !u.includes('favicon') && !u.includes('generic')
}

function deduplicateImages(articles) {
  const imgCount = {}
  articles.forEach(a => { if (a.image) imgCount[a.image] = (imgCount[a.image] || 0) + 1 })
  return articles.map(a => ({ ...a, image: (a.image && imgCount[a.image] === 1) ? a.image : '' }))
}

const RSS_HEADERS = {
  'User-Agent': UA,
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
    const link     = g(/<link[^>]*>(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+?)\s*(?:\]\]>)?<\/link>/)
               || g(/<guid[^>]*>(?:<!\[CDATA\[)?\s*(https?:\/\/[^\s<\]]+?)\s*(?:\]\]>)?<\/guid>/)
    const pubDate  = g(/<pubDate[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/)
    const imgMedia = g(/<media:content[^>]+url=["']([^"']+)["']/)
               || g(/<media:thumbnail[^>]+url=["']([^"']+)["']/)
    const imgEnc   = g(/<enclosure[^>]+url=["']([^"']+)["']/)
    const imgDesc  = (c.match(/<description[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/) || [])[1] || ''
    if (!rawTitle || !link) continue
    const title = rawTitle.replace(/<[^>]+>/g, '')
    // Google News media:thumbnail/content is a source-branded card, not the real article image
    const rawImg = link.includes('news.google.com') ? '' : (imgMedia || imgEnc || imgDesc || '')
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
    items.push({ id: link, title, url: articleUrl, link, image, source: displaySource, trusted, publishedAt: date.toISOString(), date })
  }
  return items
}

const CUTOFF_48H = 48 * 60 * 60 * 1000

async function fetchOGImageDev(url) {
  try {
    const r = await fetch(url, {
      headers: { ...RSS_HEADERS, Accept: 'text/html,application/xhtml+xml,*/*' },
      signal: AbortSignal.timeout(5000), redirect: 'follow',
    })
    if (!r.ok) return ''
    // If redirect landed on a Google domain, we'd only get their site icon — skip
    try { if (new URL(r.url).hostname.includes('google.com')) return '' } catch {}
    const html = await r.text()
    return (
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      ''
    )
  } catch { return '' }
}

function newsDevPlugin() {
  let cache = null, cacheTs = 0
  return {
    name: 'news-dev',
    configureServer(server) {
      server.middlewares.use('/api/news', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }
        if (cache && (Date.now() - cacheTs) < 30 * 60 * 1000) { res.end(JSON.stringify(cache)); return }
        try {
          const results = await Promise.allSettled(
            RSS_SOURCES.map(async ({ name, url, trusted = false }) => {
              try {
                const r = await fetch(url, { headers: RSS_HEADERS, signal: AbortSignal.timeout(10000) })
                if (!r.ok) return []
                return parseRSS(await r.text(), name, trusted)
              } catch { return [] }
            })
          )
          // Merge: direct-source articles first so they beat Google News duplicates in deduplication
          const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
          const byDate = a => new Date(a.publishedAt).getTime()
          const combined = [
            ...all.filter(a => !a.link.includes('news.google.com')).sort((a,b) => byDate(b) - byDate(a)),
            ...all.filter(a =>  a.link.includes('news.google.com')).sort((a,b) => byDate(b) - byDate(a)),
          ]
          const seen = new Set()
          // Trusted feeds pass through; general feeds require keyword match
          let articles = combined
            .filter(a => {
              if (!a.title || !a.link) return false
              if (!isHebrew(a.title)) return false
              if (!a.trusted && !isRealEstate(a.title)) return false
              const k = a.title.replace(/\s+/g,'').slice(0,30)
              if (seen.has(k)) return false
              seen.add(k); return true
            })
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
            .slice(0, 50)

          // Clear any image URL shared by 2+ articles (= source logo)
          articles = deduplicateImages(articles)

          // Enrich with og:image (max 30, direct-source URLs first — more scrapeable)
          const withoutImg = articles.filter(a => !a.image)
          const needImg = [
            ...withoutImg.filter(a => !a.link.includes('news.google.com')),
            ...withoutImg.filter(a =>  a.link.includes('news.google.com')),
          ].slice(0, 30)
          if (needImg.length > 0) {
            const ogResults = await Promise.allSettled(needImg.map(a => fetchOGImageDev(a.url)))
            const ogMap = new Map(needImg.map((a, i) => [a.id, ogResults[i]]))
            articles = articles.map(a => {
              if (!a.image && ogMap.has(a.id)) {
                const r = ogMap.get(a.id)
                return { ...a, image: (r?.status === 'fulfilled' ? r.value : '') || '' }
              }
              return a
            })
          }

          cache = articles; cacheTs = Date.now()
          res.end(JSON.stringify(articles))
        } catch (e) {
          res.end(JSON.stringify([]))
        }
      })
    },
  }
}

function ogProxyPlugin() {
  return {
    name: 'og-proxy',
    configureServer(server) {
      server.middlewares.use('/api/og', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/json')
        try {
          const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : req.url.slice(1)
          const targetUrl = new URLSearchParams(qs).get('url')
          if (!targetUrl) { res.end(JSON.stringify({ image: '' })); return }

          const resp = await fetch(targetUrl, {
            headers: { 'User-Agent': UA, 'Accept': 'text/html' },
            redirect: 'follow',
            signal: AbortSignal.timeout(10000),
          })
          const html = await resp.text()

          // Extract og:image (try both attribute orders)
          const m =
            html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
            html.match(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i)
          const image = m ? m[1] : ''
          const finalUrl = resp.url

          res.end(JSON.stringify({ image, url: finalUrl }))
        } catch (e) {
          res.end(JSON.stringify({ image: '', error: e.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), newsDevPlugin(), ogProxyPlugin()],

  build: {
    target: 'es2017',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/react-dom/') || (id.includes('/react/') && !id.includes('/react-icons/'))) return 'vendor-react'
          if (id.includes('/framer-motion/')) return 'vendor-framer'
          if (id.includes('/react-icons/') || id.includes('/lucide-react/')) return 'vendor-icons'
          if (id.includes('/@dnd-kit/')) return 'vendor-dnd'
          if (id.includes('/logrocket/')) return 'vendor-analytics'
          return 'vendor-misc'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },

  server: {
    port: 3000,
    host: '127.0.0.1',
    open: true,
    proxy: {
      '/api/properties': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/contacts': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/stats': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/rss': {
        target: 'https://news.google.com',
        changeOrigin: true,
        secure: true,
      },
      '/bing': {
        target: 'https://www.bing.com',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/bing/, ''),
      },
      '/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        secure: true,
        rewrite: path => path.replace(/^\/anthropic/, ''),
        configure: (proxy) => {
          // Strip browser-origin headers so Anthropic treats this as a server-to-server request
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
          })
        },
      },
    },
  },
})
