// A PNG that will actually draw: the signature (8 bytes), an IHDR first, every chunk's CRC-32 right, IEND last. Pure, tested.
// The admin's broker signature and every drawn signature go through it, so a cut-off or garbled file never reaches a PDF.
const TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c } return t })()
export function crc32(buf, start = 0, end = buf.length) { let c = -1; for (let i = start; i < end; i++) c = TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0 }
/** → { ok, width, height, why? } */
export function pngInfo(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf || [])
  if (b.length < 33) return { ok: false, why: 'short' }
  for (const [i, v] of [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A].entries()) if (b[i] !== v) return { ok: false, why: 'signature' }
  const u32 = o => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0
  let o = 8, width = 0, height = 0, first = true, end = false
  while (o + 12 <= b.length) {
    const len = u32(o), type = String.fromCharCode(b[o + 4], b[o + 5], b[o + 6], b[o + 7])
    if (o + 12 + len > b.length) return { ok: false, why: 'cut' }
    if (first) { if (type !== 'IHDR' || len !== 13) return { ok: false, why: 'ihdr' }; width = u32(o + 8); height = u32(o + 12); first = false }
    if (crc32(b, o + 4, o + 8 + len) !== u32(o + 8 + len)) return { ok: false, why: `crc ${type}` }
    o += 12 + len
    if (type === 'IEND') { end = true; break }
  }
  if (!end) return { ok: false, why: 'no IEND' }
  return { ok: width > 0 && height > 0, width, height }
}
export const pngIntact = buf => pngInfo(buf).ok
