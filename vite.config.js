import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import fs from 'node:fs'
import { fetchAllSources, outletKey, outletCap, titleKey, cleanTitle, deduplicateImages, isArticleImage, RSS_HEADERS } from './lib/news/sources.js'
import { scoreRealEstate } from './lib/news/classify.js'

const UA = RSS_HEADERS['User-Agent']

async function fetchOGImageDev(url) {
  try {
    const r = await fetch(url, { headers: { ...RSS_HEADERS, Accept: 'text/html,application/xhtml+xml,*/*' }, signal: AbortSignal.timeout(5000), redirect: 'follow' })
    if (!r.ok) return ''
    try { if (new URL(r.url).hostname.includes('google.com')) return '' } catch {}
    const html = await r.text()
    const img = (
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] || ''
    ).replace(/&amp;/g, '&')
    return isArticleImage(img) ? img : ''
  } catch { return '' }
}

// Dev-only /api/news — the same sources + real-estate classifier as production (api/news.js live path),
// so what you see on localhost is what the Vercel function would return.
// Offline / screenshots: NEWS_FIXTURE=lib/news/fixture.json npm run dev  → serves { board, archive } from the file.
function newsDevPlugin() {
  let cache = null, cacheTs = 0
  return {
    name: 'news-dev',
    configureServer(server) {
      server.middlewares.use('/api/news', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Content-Type', 'application/json')
        if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return }
        const isArchive = (req.url || '').startsWith('/archive')

        if (process.env.NEWS_FIXTURE) {
          try {
            const j = JSON.parse(fs.readFileSync(process.env.NEWS_FIXTURE, 'utf8'))
            const list = Array.isArray(j) ? j : (isArchive ? j.archive : j.board)
            res.end(JSON.stringify(list || [])); return
          } catch (e) { console.warn('[news-dev] fixture:', e.message); res.end('[]'); return }
        }
        if (isArchive) { res.end('[]'); return }   // the archive lives in Supabase — no dev equivalent
        if (cache && (Date.now() - cacheTs) < 30 * 60 * 1000) { res.end(JSON.stringify(cache)); return }

        try {
          const all = await fetchAllSources({ timeoutMs: 8000, concurrency: 12, log: m => console.log('[news-dev]', m) })
          const seen = new Set(), counts = {}
          let articles = [...all.filter(a => !a.gn), ...all.filter(a => a.gn)]
            .map(a => ({ ...a, title: cleanTitle(a.title, a.gn) }))
            .filter(a => {
              if (!scoreRealEstate(a.title, a.desc, { trusted: a.trusted }).ok) return false
              const k = titleKey(a.title); if (seen.has(k)) return false; seen.add(k); return true
            })
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
            .filter(a => { const k = outletKey(a.url, a.source); counts[k] = (counts[k] || 0) + 1; return counts[k] <= outletCap(k) })
          articles = deduplicateImages(articles).slice(0, 40)

          const needImg = articles.filter(a => !a.image).slice(0, 20)
          if (needImg.length) {
            const og = await Promise.allSettled(needImg.map(a => fetchOGImageDev(a.url)))
            const m = new Map(needImg.map((a, i) => [a.id, og[i].status === 'fulfilled' ? og[i].value : '']))
            articles = articles.map(a => (!a.image && m.has(a.id)) ? { ...a, image: m.get(a.id) || '' } : a)
          }
          console.log(`[news-dev] ${articles.length} articles from ${new Set(articles.map(a => outletKey(a.url, a.source))).size} outlets`)
          cache = articles; cacheTs = Date.now()
          res.end(JSON.stringify(articles))
        } catch (e) {
          console.warn('[news-dev]', e.message)
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
          // Supabase is admin-only and dynamically imported — keep it in its own
          // chunk so it loads lazily (with the admin code) instead of riding along
          // in the eagerly-loaded vendor-misc chunk on every public page view.
          if (id.includes('/@supabase/')) return 'vendor-supabase'
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
