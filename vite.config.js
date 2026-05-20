import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const RSS_SOURCES = [
  { name: 'Ynet נדל"ן',      url: 'https://www.ynet.co.il/Integration/StoryRss2.aspx?id=3082' },
  { name: 'Walla! נדל"ן',    url: 'https://rss.walla.co.il/feed/22' },
  { name: 'Globes נדל"ן',    url: 'https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=1111' },
  { name: 'Calcalist נדל"ן', url: 'https://www.calcalist.co.il/rss/AjaxPage,7340,L-4,00.html' },
  { name: 'Bizportal נדל"ן', url: 'https://www.bizportal.co.il/rss/realEstate' },
  { name: 'Mako נדל"ן',      url: 'https://rcs.mako.co.il/rss/31750a2610f26110VgnVCM1000004463daa0RCRD.xml' },
]

const RSS_HEADERS = {
  'User-Agent': UA,
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
    items.push({ id: link, title, url: link, link, image, source: sourceName, publishedAt: date.toISOString(), date })
  }
  return items
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
            RSS_SOURCES.map(async ({ name, url }) => {
              try {
                const r = await fetch(url, { headers: RSS_HEADERS, signal: AbortSignal.timeout(10000) })
                if (!r.ok) return []
                return parseRSS(await r.text(), name)
              } catch { return [] }
            })
          )
          const seen = new Set()
          const articles = results
            .flatMap(r => r.status === 'fulfilled' ? r.value : [])
            .filter(a => {
              if (!a.title || !a.link) return false
              const k = a.title.replace(/\s+/g,'').slice(0,30)
              if (seen.has(k)) return false
              seen.add(k); return true
            })
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
            .slice(0, 50)
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
  server: {
    port: 3000,
    host: '127.0.0.1',
    open: true,
    proxy: {
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
