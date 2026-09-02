import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gnArticleId, decodeLegacyGnId, parseBatchexecute, resolveGoogleNewsUrl } from './gnews.js'

const b64url = s => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const legacyId = url => { const u = Buffer.from(url); return b64url(Buffer.concat([Buffer.from([8, 0x13, 0x22, u.length]), u, Buffer.from([0xd2, 1, 0])])) }
const modernId = () => { const s = Buffer.from('AU_yqLNxwOEp' + 'x'.repeat(155)); return b64url(Buffer.concat([Buffer.from([8, 0x13, 0x22, 0xa7, 0x01]), s])) }

test('extracts the article id from rss and non-rss links', () => {
  assert.equal(gnArticleId('https://news.google.com/rss/articles/CBMiAbc-_?oc=5'), 'CBMiAbc-_')
  assert.equal(gnArticleId('https://news.google.com/articles/CBMiAbc'), 'CBMiAbc')
  assert.equal(gnArticleId('https://www.globes.co.il/x'), null)
})

test('legacy ids decode offline', async () => {
  const id = legacyId('https://www.globes.co.il/news/article.aspx?did=1001')
  assert.equal(decodeLegacyGnId(id), 'https://www.globes.co.il/news/article.aspx?did=1001')
  assert.equal(await resolveGoogleNewsUrl(`https://news.google.com/rss/articles/${id}`, { fetchImpl: () => { throw new Error('no network expected') } }),
    'https://www.globes.co.il/news/article.aspx?did=1001')
})

test('modern ids are recognised and resolved through batchexecute', async () => {
  const id = modernId()
  assert.deepEqual(typeof decodeLegacyGnId(id), 'object')
  const calls = []
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body })
    if (url.includes('/articles/')) return new Response('<c-wiz><div data-n-a-sg="SIG123" data-n-a-ts="1700000000" data-p="x"></div></c-wiz>', { status: 200 })
    return new Response(`)]}'\n\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://www.calcalist.co.il/real-estate/article/abc\\",null]",null,null,null,"generic"],["di",12],["af.httprm",12,"x",1]]`, { status: 200 })
  }
  const real = await resolveGoogleNewsUrl(`https://news.google.com/rss/articles/${id}`, { fetchImpl })
  assert.equal(real, 'https://www.calcalist.co.il/real-estate/article/abc')
  assert.equal(calls.length, 2)
  assert.equal(calls[1].method, 'POST')
  assert.ok(decodeURIComponent(calls[1].body).includes('SIG123') && decodeURIComponent(calls[1].body).includes('1700000000') && decodeURIComponent(calls[1].body).includes(id))
})

test('batchexecute parser tolerates chunk-length prefixes and junk', () => {
  assert.equal(parseBatchexecute(`)]}'\n\n123\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://x.co.il/a\\"]",null]]`), 'https://x.co.il/a')
  assert.equal(parseBatchexecute('garbage'), null)
})

test('unresolvable modern id returns null, never throws', async () => {
  const real = await resolveGoogleNewsUrl(`https://news.google.com/rss/articles/${modernId()}`, { fetchImpl: async () => new Response('nope', { status: 403 }) })
  assert.equal(real, null)
})
