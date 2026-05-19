import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

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
  plugins: [react(), ogProxyPlugin()],
  server: {
    port: 3000,
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
