// The audit trail's hashes (node only — lib/documents.js stays browser-safe): a hash chain where every event carries
// sha256(previous hash | the event), so a changed record shows; the files' SHA-256; the signing token kept only as a hash.
import { createHash } from 'crypto'
export function eventHash(prev, ev) {
  const body = JSON.stringify({ t: ev.type, at: ev.at, ip: ev.ip || '', ua: ev.ua || '', m: ev.meta || null })
  return createHash('sha256').update(`${prev || ''}|${body}`).digest('hex')
}
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const tokenHash = t => createHash('sha256').update(String(t)).digest('hex')

// The signing link's code: 10 lowercase English letters / digits without the look-alikes (0 o 1 l i), e.g. "k7dmq2xpwn"
// → https://www.afikhanahal.co.il/s/k7dmq2xpwn. 31^10 ≈ 8·10^14 codes (~50 bits): short to read and type, still unguessable
// (and signing also needs the one-time code sent to the signer's own phone / email).
export const SIGN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export function newSignCode(len = 10) { let s = ''; for (let i = 0; i < len; i++) s += SIGN_ALPHABET[randomInt(SIGN_ALPHABET.length)]; return s }

// The current signer's token, kept encrypted on the document (AES-256-GCM, a key derived from DOC_TOKEN_SECRET, else the
// service key) so a reminder or a "send again" carries the SAME link the client already has; the lookup still goes by hash.
import { createCipheriv, createDecipheriv, randomBytes, randomInt } from 'crypto'
const encKey = () => createHash('sha256').update(`doc-token|${process.env.DOC_TOKEN_SECRET || process.env.SUPABASE_SERVICE_KEY || 'afik'}`).digest()
export function encryptToken(token) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', encKey(), iv)
  const body = Buffer.concat([c.update(String(token), 'utf8'), c.final()])
  return `v1.${iv.toString('base64url')}.${body.toString('base64url')}.${c.getAuthTag().toString('base64url')}`
}
export function decryptToken(enc) {
  try {
    const [v, iv, body, tag] = String(enc || '').split('.')
    if (v !== 'v1' || !iv || !body || !tag) return ''
    const d = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64url'))
    d.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8')
  } catch { return '' }
}
