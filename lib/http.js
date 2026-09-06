// Shared response helper for the Vercel functions.
// Vercel meters every byte a function returns to the edge ("Fast Origin Transfer"), so JSON goes out
// gzipped (5-50x smaller) and with an ETag: a client that polls with If-None-Match gets an empty 304
// when nothing changed. Works for public (CDN-cached) and admin (no-store) responses alike.
import { gzipSync } from 'zlib'
import { createHash } from 'crypto'

export function sendJson(req, res, data, status = 200) {
  const body = JSON.stringify(data)
  const etag = `"${createHash('sha1').update(body).digest('hex').slice(0, 20)}"`
  res.setHeader('ETag', etag)
  const vary = res.getHeader('Vary')
  res.setHeader('Vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding, Authorization')
  if (status === 200 && (req.headers['if-none-match'] || '') === etag) return res.status(304).end()
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '') && body.length > 1024) {
    res.setHeader('Content-Encoding', 'gzip')
    return res.status(status).send(gzipSync(Buffer.from(body, 'utf8')))
  }
  return res.status(status).send(body)
}
