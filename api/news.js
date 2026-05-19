export default async function handler(req, res) {
  const query = req.query.q || 'נדלן ישראל 2025'
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=he&gl=IL&ceid=IL:he`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }
    })
    if (!r.ok) return res.status(502).json({ error: 'upstream failed' })
    const xml = await r.text()
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate')
    res.status(200).send(xml)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
}
