// The audit trail's hashes (node only — lib/documents.js stays browser-safe): a hash chain where every event carries
// sha256(previous hash | the event), so a changed record shows; the files' SHA-256; the signing token kept only as a hash.
import { createHash } from 'crypto'
export function eventHash(prev, ev) {
  const body = JSON.stringify({ t: ev.type, at: ev.at, ip: ev.ip || '', ua: ev.ua || '', m: ev.meta || null })
  return createHash('sha256').update(`${prev || ''}|${body}`).digest('hex')
}
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const tokenHash = t => createHash('sha256').update(String(t)).digest('hex')
