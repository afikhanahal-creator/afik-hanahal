// The PDF of a document (lib/documents.js): A4, real Hebrew with the Rubik font embedded (lib/fonts), right-to-left layout —
// every line is laid out in logical order and reordered to visual order with the Unicode bidi algorithm (bidi-js), so Hebrew
// reads right to left while numbers, prices, emails and Latin words keep their direction; the text stays selectable and
// searchable. Pages: header (logo per the document's logo settings, company + ח.פ.), title + number + date, the parties and
// the property as label / value rows, the clauses, the fee table, the signature block (the drawn signature + name, id, time
// once signed) and, for a signed document, a certificate page with the audit trail and the hashes. Pure given its inputs
// (tested in lib/doc-pdf.test.mjs). Rendered server-side (api/meta.js → lib/documents-server.js), never in the browser.
import { PDFDocument, rgb, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import bidiFactory from 'bidi-js'
import RUBIK_REGULAR from './fonts/rubik-regular.js'
import RUBIK_BOLD from './fonts/rubik-bold.js'
import LOGO_PNG, { LOGO_W, LOGO_H } from './doc-assets/logo-black.js'
import { COMPANY, DOC_TYPES, CLIENT_ROLES, DEAL_TYPES, computeFees, renderClauses, fmtMoney, fmtPct, fmtPhone, todayHe, whenHe, EVENT_HE, verifyLabel, feeRows as feeTable, cleanNote } from './documents.js'
import { templateOf, docBlocks } from './doc-templates.js'

const bidi = bidiFactory()
const A4 = { w: 595.28, h: 841.89 }
const M = { top: 56, bottom: 56, side: 52 }
const INK = rgb(0.09, 0.09, 0.17), MUTE = rgb(0.37, 0.36, 0.43), LINE = rgb(0.86, 0.84, 0.8), SOFT = rgb(0.965, 0.955, 0.935), BRAND = rgb(0.247, 0.306, 0.69), GREEN = rgb(0.07, 0.55, 0.29), FAINT = rgb(0.82, 0.81, 0.79)
const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' }

/** logical → visual order for one line (RTL paragraph): the bidi reorder segments, brackets mirrored inside RTL runs */
export function visualLine(text) {
  const s = String(text || '')
  if (!s) return ''
  const emb = bidi.getEmbeddingLevels(s, 'rtl')
  const chars = [...s].map((ch, i) => (emb.levels[i] % 2 === 1 && MIRROR[ch]) ? MIRROR[ch] : ch)
  for (const [a, b] of bidi.getReorderSegments(s, emb)) {
    const seg = chars.slice(a, b + 1).reverse()
    for (let i = a; i <= b; i++) chars[i] = seg[i - a]
  }
  return chars.join('').replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')   // the bidi controls did their job; never drawn
}

/** word-wrap in logical order (widths are order-independent) */
export function wrapLines(text, font, size, maxW) {
  const out = []
  for (const para of String(text || '').replace(/\r/g, '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (!words.length) { out.push(''); continue }
    let line = ''
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(cand, size) <= maxW || !line) line = cand
      else { out.push(line); line = w }
    }
    out.push(line)
  }
  return out
}

class Page {
  constructor(doc, fonts, n) { this.p = doc.addPage([A4.w, A4.h]); this.y = A4.h - M.top; this.fonts = fonts; this.n = n }
  get right() { return A4.w - M.side }
  get width() { return A4.w - 2 * M.side }
  /** draw a line of text aligned right (RTL), or left / center */
  text(str, { size = 10.5, bold = false, color = INK, align = 'right', x = null, y = null, w = null, justify = false, opacity = 1, rotate = 0 } = {}) {
    const font = bold ? this.fonts.bold : this.fonts.regular
    const vis = visualLine(str)
    const tw = font.widthOfTextAtSize(vis, size)
    const right = x == null ? this.right : x
    const width = w == null ? this.width : w
    const py = y == null ? this.y : y
    const draw = (s, px) => {
      // fontkit (pdf-lib's text layout) reverses the glyphs of a string it reads as Hebrew script, so a run of Hebrew letters is
      // handed over in logical order (it comes out visual) and every other run as is — each drawn at its own x
      for (const seg of fontRuns(s)) {
        this.p.drawText(seg.heb ? [...seg.s].reverse().join('') : seg.s, { x: px, y: py, size, font, color, opacity, ...(rotate ? { rotate: degrees(rotate) } : {}) })
        px += font.widthOfTextAtSize(seg.s, size)
      }
    }
    // justified: the visual line's words spread over the full width (the last line of a paragraph never is)
    const words = justify ? vis.split(' ').filter(Boolean) : []
    // only when the extra space per gap stays small (a short line stretched over the width reads as holes)
    if (words.length > 1 && tw < width && (width - tw) / (words.length - 1) <= size * 0.5) {
      const gap = (width - words.reduce((a, w) => a + font.widthOfTextAtSize(w, size), 0)) / (words.length - 1)
      let px = right - width
      for (const w of words) { draw(w, px); px += font.widthOfTextAtSize(w, size) + gap }
      return
    }
    draw(vis, align === 'right' ? right - tw : align === 'center' ? right - width / 2 - tw / 2 : right - width)
  }
}
const isHeb = ch => /[\u0590-\u05FF\uFB1D-\uFB4F]/.test(ch)
const isStrongLtr = ch => /[A-Za-z0-9\u00C0-\u024F]/.test(ch)
/** a visual string → runs: Hebrew letters (with the neutrals beside them) vs everything else */
export function fontRuns(vis) {
  const out = []
  let cur = null
  for (const ch of [...vis]) {
    const kind = isHeb(ch) ? 'heb' : isStrongLtr(ch) ? 'ltr' : 'n'
    if (!cur) { cur = { heb: kind === 'heb', s: ch, open: kind === 'n' }; continue }
    if (kind === 'n') { cur.s += ch; continue }
    if (cur.open) { cur.heb = kind === 'heb'; cur.open = false; cur.s += ch; continue }
    if ((kind === 'heb') === cur.heb) { cur.s += ch; continue }
    // a neutral tail between two different runs stays with the run it followed
    out.push(cur); cur = { heb: kind === 'heb', s: ch, open: false }
  }
  if (cur) out.push(cur)
  return out.map(r => ({ heb: r.heb, s: r.s }))
}

function logoBox(size) { const h = size === 's' ? 42 : size === 'l' ? 84 : 60; return { h, w: h * (LOGO_W / LOGO_H) } }

/**
 * renderPdf(doc, { clauses, logoBytes, signaturePng, events, hashes }) → Uint8Array
 *  doc = { number, status, data: { client, property, fees, agent, logo, terms, title }, created_at, signed_at, signature }
 */
export async function renderPdf(doc, { clauses = null, template = null, logoBytes = null, signaturePng = null, signatures = [], events = [], originalHash = '', signedHash = '', agentPng = null } = {}) {
  const d = doc.data || {}
  const tp = templateOf(doc, template, clauses)
  const sec = tp.sections
  const blocks = tp.kind === 'brokerage' && !doc.template && !template ? renderClauses(d, clauses, { date: doc.created_at ? new Date(doc.created_at) : new Date() }).map(c => ({ t: 'clause', n: c.n, title: c.title, text: c.text })) : docBlocks(tp, doc)
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const fonts = { regular: await pdf.embedFont(Buffer.from(RUBIK_REGULAR, 'base64'), { subset: true }), bold: await pdf.embedFont(Buffer.from(RUBIK_BOLD, 'base64'), { subset: true }) }
  const title = d.title || tp.title || DOC_TYPES.brokerage.name
  pdf.setTitle(`${title} ${doc.number || ''}`.trim()); pdf.setAuthor(COMPANY.name); pdf.setSubject(title); pdf.setLanguage('he-IL'); pdf.setCreator('Afik Hanahal CRM')
  let logoImg = null, logoDims = null
  const lg = d.logo?.url || d.logo?.show === false ? d.logo : { ...tp.logo, ...(d.logo || {}) }
  if (lg.show !== false) {
    try {
      if (logoBytes) { logoImg = await (isPng(logoBytes) ? pdf.embedPng(logoBytes) : pdf.embedJpg(logoBytes)); logoDims = { w: logoImg.width, h: logoImg.height } }
      else { logoImg = await pdf.embedPng(Buffer.from(LOGO_PNG, 'base64')); logoDims = { w: LOGO_W, h: LOGO_H } }
    } catch { logoImg = null }
  }
  const pages = []
  let pg = null
  const header = page => {
    let y = A4.h - M.top
    if (pages.length > 1) {   // later pages: a slim line — a small logo, the company, the document — and the rule
      if (logoImg) { const hh = 22, ww = hh * (logoDims.w / logoDims.h); page.p.drawImage(logoImg, { x: A4.w - M.side - ww, y: y - hh + 6, width: ww, height: hh }); page.text(COMPANY.name, { size: 8.5, bold: true, color: MUTE, y: y - 8, x: A4.w - M.side - ww - 10, w: A4.w - 2 * M.side - ww - 10 }) }
      else page.text(COMPANY.name, { size: 8.5, bold: true, color: MUTE, y: y - 8 })
      page.text(`${title} · ${doc.number || ''}`, { size: 8.5, color: MUTE, y: y - 8, align: 'left' })
      page.p.drawLine({ start: { x: M.side, y: y - 20 }, end: { x: A4.w - M.side, y: y - 20 }, thickness: 0.6, color: LINE })
      page.y = y - 40
      return
    }
    if (logoImg) {
      const hh = lg.size === 's' ? 42 : lg.size === 'l' ? 84 : 60
      const ww = hh * (logoDims.w / logoDims.h)
      const lx = lg.align === 'left' ? M.side : lg.align === 'center' ? A4.w / 2 - ww / 2 : A4.w - M.side - ww
      page.p.drawImage(logoImg, { x: lx, y: y - hh + 8, width: ww, height: hh })
      // the company line goes beside the logo (on the free side)
      const tx = lg.align === 'right' ? { align: 'left', x: A4.w - M.side, w: A4.w - 2 * M.side } : lg.align === 'left' ? { align: 'right' } : null
      if (tx) { page.text(COMPANY.name, { size: 10, bold: true, y: y - 6, ...tx }); page.text(`${COMPANY.idLabel} ${COMPANY.id} · ${COMPANY.phone} · ${COMPANY.email}`, { size: 8.5, color: MUTE, y: y - 20, ...tx }) }
      y -= hh + 6
      if (!tx) { page.text(COMPANY.name, { size: 10, bold: true, y: y - 4, align: 'center' }); page.text(`${COMPANY.idLabel} ${COMPANY.id} · ${COMPANY.phone} · ${COMPANY.email}`, { size: 8.5, color: MUTE, y: y - 18, align: 'center' }); y -= 22 }
    } else {
      page.text(COMPANY.name, { size: 11, bold: true, y: y - 6 }); page.text(`${COMPANY.idLabel} ${COMPANY.id} · ${COMPANY.phone} · ${COMPANY.email}`, { size: 8.5, color: MUTE, y: y - 20 }); y -= 26
    }
    if (doc.status === 'signed') {   // the stamp, like the on-screen sheet: under the company line, on the free side
      const label = `נחתם דיגיטלית · ${todayHe(doc.signed_at || new Date())}`, sw = fonts.bold.widthOfTextAtSize(visualLine(label), 9) + 22
      const sx = lg.align === 'left' ? A4.w - M.side - sw : M.side
      page.p.drawRectangle({ x: sx, y: y - 2, width: sw, height: 21, borderColor: GREEN, borderWidth: 1.2, color: rgb(1, 1, 1), opacity: 0.95, borderOpacity: 1 })
      page.text(label, { size: 9, bold: true, color: GREEN, x: sx + sw - 11, w: sw - 22, y: y + 4.5 })
      y -= 18
    }
    page.p.drawLine({ start: { x: M.side, y: y - 6 }, end: { x: A4.w - M.side, y: y - 6 }, thickness: 0.6, color: LINE })
    page.y = y - 22
  }
  const footer = (page, i, total) => {
    const y = M.bottom - 22
    page.p.drawLine({ start: { x: M.side, y: y + 14 }, end: { x: A4.w - M.side, y: y + 14 }, thickness: 0.5, color: LINE })
    page.text(`${title} · ${doc.number || ''}${doc.status === 'signed' ? ' · נחתם דיגיטלית' : ''}`, { size: 8, color: MUTE, y })
    page.text(`עמוד ${i} מתוך ${total}`, { size: 8, color: MUTE, y, align: 'left' })
  }
  const newPage = () => { pg = new Page(pdf, fonts, pages.length + 1); pages.push(pg); header(pg); return pg }
  const need = h => { if (pg.y - h < M.bottom) newPage() }
  const para = (text, { size = 10.5, bold = false, color = INK, gap = 3, indent = 0, align = 'right', justify = false } = {}) => {
    const font = bold ? fonts.bold : fonts.regular
    const paras = String(text || '').replace(/\r/g, '').split('\n')
    const lh = size * 1.5
    for (const ptxt of paras) {
      const lines = wrapLines(ptxt, font, size, pg.width - indent)
      lines.forEach((ln, i) => { need(lh); pg.text(ln, { size, bold, color, align, x: pg.right - indent, w: pg.width - indent, justify: justify && i < lines.length - 1 }); pg.y -= lh })
    }
    pg.y -= gap
  }
  const rows = (pairs, { labelW = 118, size = 10 } = {}) => {
    for (const [k, v] of pairs) {
      if (v == null || v === '') continue
      if (/^\s*$/.test(String(v))) continue
      const lines = wrapLines(String(v), fonts.regular, size, pg.width - labelW - 12)
      // every row is a band between two hairlines with its text centred in it — the text used to hang right under the line
      // above it (2 pt) and float 10 pt over its own line, so it read as belonging to the row before
      const lh = size * 1.44, h = lines.length * lh + 6, cap = size * 0.72
      need(h)
      const top = pg.y + 8, bottom = top - h
      const base = top - (h - (lines.length - 1) * lh) / 2 - cap / 2
      pg.p.drawLine({ start: { x: M.side, y: bottom }, end: { x: A4.w - M.side, y: bottom }, thickness: 0.4, color: LINE })
      pg.text(k, { size: size - 0.5, color: MUTE, bold: true, y: base })
      lines.forEach((ln, i) => pg.text(ln, { size, x: pg.right - labelW, w: pg.width - labelW, y: base - i * lh }))
      pg.y -= h
    }
    pg.y -= 10
  }
  const heading = (t, { size = 12.5 } = {}) => { pg.y -= 2; need(size + 12 + 44); pg.p.drawRectangle({ x: A4.w - M.side - 3, y: pg.y - 3, width: 3, height: size + 4, color: BRAND }); pg.text(t, { size, bold: true, x: pg.right - 10, w: pg.width - 10 }); pg.y -= size + 10 }

  // ── page 1 ──
  newPage()
  if (doc.status === 'draft') pg.text('טיוטה', { size: 120, bold: true, color: FAINT, opacity: 0.35, rotate: 35, x: A4.w / 2 + 150, y: A4.h / 2 - 120 })
  pg.text(title, { size: 19, bold: true, align: 'center' }); pg.y -= 24
  pg.text(`מסמך מס׳ ${doc.number || '—'} · תאריך ${todayHe(doc.created_at || new Date())}${doc.status === 'signed' ? ` · נחתם ${whenHe(doc.signed_at)}` : ''}`, { size: 9.5, color: MUTE, align: 'center' }); pg.y -= 26
  const c = d.client || {}, pr = d.property || {}, f = computeFees(d.fees || {}), ag = d.agent || {}
  if (sec.parties) { heading('פרטי הלקוח'); rows([['שם מלא', c.name], ['ת.ז.', c.idNumber], ['טלפון', fmtPhone(c.phone)], ['אימייל', c.email], ['כתובת', c.address], ['תפקיד בעסקה', CLIENT_ROLES[c.role]], ['פרויקט', doc.project_name || d.projectName]])
    if (tp.kind === 'brokerage' && (ag.name || ag.license)) { heading('המתווך'); rows([['שם', ag.name], ['מס׳ רישיון', ag.license], ['טלפון', fmtPhone(ag.phone)]]) } }
  if (sec.property) { heading('פרטי הנכס'); rows([['כתובת', [pr.address, pr.city].filter(Boolean).join(', ')], ['תיאור', pr.desc], ['סוג הנכס', pr.type], ['סוג העסקה', DEAL_TYPES[pr.dealType]], ['מחיר העסקה (לפני מע"מ)', f.price ? fmtMoney(f.price) : ''], ['הערות', pr.notes], ['קישור לנכס', pr.link]]) }
  if (blocks.length && tp.kind === 'brokerage') heading('תנאי ההתקשרות')
  for (const b of blocks) {
    if (b.t === 'h') { need(30); pg.text(b.text, { size: 12.5, bold: true }); pg.y -= 18; continue }
    if (b.t === 'clause') { need(16 + 10.2 * 1.5 * 2 + 7); pg.text(`${b.n}. ${b.title}`, { size: 11, bold: true }); pg.y -= 16; para(b.text, { size: 10.2, indent: 14, gap: 7, justify: true }); continue }
    para(b.text, { size: 10.2, gap: 7, justify: true })
  }
  if (sec.fees) {
  heading('דמי התיווך')
  const feeRows = feeTable(f)
  {
    const colW = 200, lh = 18
    need(feeRows.length * lh + 10)
    // the same band: the baseline sits so the text is centred between the rule above (+12.5) and the hairline under it (−5.5)
    pg.p.drawLine({ start: { x: A4.w - M.side - 2 * colW, y: pg.y + 12.5 }, end: { x: A4.w - M.side, y: pg.y + 12.5 }, thickness: 0.8, color: INK })
    feeRows.forEach(([k, v], i) => {
      const last = i === feeRows.length - 1
      if (last) pg.p.drawRectangle({ x: A4.w - M.side - 2 * colW, y: pg.y - 5.5, width: 2 * colW, height: lh, color: SOFT })
      pg.text(k, { size: 10, bold: last, x: pg.right - 8, w: colW - 8 })
      pg.text(v, { size: 10.5, bold: last, x: pg.right - colW, w: colW, align: 'left' })
      pg.p.drawLine({ start: { x: A4.w - M.side - 2 * colW, y: pg.y - 5.5 }, end: { x: A4.w - M.side, y: pg.y - 5.5 }, thickness: 0.4, color: LINE })
      pg.y -= lh
    })
    pg.y -= 10
  }
  }
  if (d.terms && sec.fees) { heading('תנאים נוספים'); para(d.terms, { size: 10.2, gap: 8 }) }
  // "הערה לתנאי העסקה" — the office's own words about this deal, in a framed box right after the terms, on every copy
  const note = cleanNote(d.note)
  if (note) {
    const size = 10.4, lh = size * 1.5, pad = 11, inner = pg.width - 2 * pad - 4
    const lines = note.split('\n').flatMap(t => (t.trim() ? wrapLines(t, fonts.regular, size, inner) : ['']))
    const h = 18 + lines.length * lh + pad * 2 - 4
    need(h + 10)
    const top = pg.y + 12, x0 = M.side, w0 = A4.w - 2 * M.side
    pg.p.drawRectangle({ x: x0, y: top - h, width: w0, height: h, color: SOFT, borderColor: BRAND, borderWidth: 0.8 })
    pg.p.drawRectangle({ x: x0 + w0 - 3.5, y: top - h, width: 3.5, height: h, color: BRAND })
    pg.y = top - pad - 9
    pg.text('הערה לתנאי העסקה', { size: 10.6, bold: true, color: BRAND, x: pg.right - pad - 4, w: inner })
    pg.y -= 18
    lines.forEach(ln => { if (ln) pg.text(ln, { size, x: pg.right - pad - 4, w: inner }); pg.y -= lh })
    pg.y = top - h - 14
  }

  // ── signatures ──
  need(12.5 + 10 + 118 + 4)   // the heading and the first row of boxes stay together
  heading('חתימות')
  const boxW = (pg.width - 24) / 2, boxH = 118
  // a box: the title on top, the signature (kept in its own proportions) or an empty line, then up to 3 short lines of text
  const drawBox = (x, who, lines, img) => {
    const bottom = pg.y - boxH, lh = 9.5, textTop = bottom + 7 + lines.length * lh
    pg.p.drawRectangle({ x, y: bottom, width: boxW, height: boxH, borderColor: LINE, borderWidth: 0.7 })
    pg.text(who, { size: 9.5, bold: true, color: MUTE, x: x + boxW - 10, w: boxW - 20, y: pg.y - 16 })
    const areaB = textTop + 3, areaT = pg.y - 20, maxW = Math.min(185, boxW - 30), maxH = Math.max(20, areaT - areaB)
    if (img) { const k = Math.min(maxW / img.width, maxH / img.height); const w = img.width * k, h = img.height * k; pg.p.drawImage(img, { x: x + (boxW - w) / 2, y: areaB + (maxH - h) / 2, width: w, height: h }) }
    else pg.p.drawLine({ start: { x: x + 14, y: areaB + 6 }, end: { x: x + boxW - 14, y: areaB + 6 }, thickness: 0.6, color: LINE })
    lines.forEach((ln, i) => pg.text(ln, { size: 7.8, color: MUTE, x: x + boxW - 10, w: boxW - 20, y: textTop - lh * (i + 1) + 2.5 }))
  }
  // every signer in signing order (the client first); `signatures` = the drawn ones so far (several signers), else the one signature
  const roleHe = { client: 'הלקוח', spouse: 'בן/בת זוג', partner: 'שותף/ה', guarantor: 'ערב/ה', other: 'חותם נוסף' }
  const signerRows = (doc.data?.signing?.list?.length ? doc.data.signing.list : [{ i: 0, name: c.name || '', idNumber: c.idNumber || '', role: 'client', status: doc.status === 'signed' ? 'signed' : 'waiting', signature: doc.signature }])
  const sigOf = s => (signatures.length ? signatures.find(x => (x.signer ?? 0) === (s.i ?? 0)) : null) || (s.i === 0 && signaturePng && (doc.signature || s.signature) ? { png: signaturePng, ...(s.signature || doc.signature || {}) } : null)
  const boxes = []
  for (const s of signerRows) {
    const sg = s.signature || (s.i === 0 ? doc.signature : null) || {}
    const sig = sigOf(s)
    let img = null
    if (sig?.png) { try { img = await pdf.embedPng(sig.png) } catch { img = null } }
    const signed = s.status === 'signed' || (s.i === 0 && doc.status === 'signed' && signerRows.length === 1)
    boxes.push({ who: s.i === 0 && signerRows.length === 1 ? 'הלקוח' : `${roleHe[s.role] || roleHe.other}${s.i === 0 ? '' : ` ${s.i + 1}`}`, img, lines: signed ? [`${sg.name || s.name}${(sg.idNumber || s.idNumber) ? ` · ת.ז. ${sg.idNumber || s.idNumber}` : ''}`, `נחתם דיגיטלית ${whenHe(sg.at || s.signed_at || doc.signed_at)}`, `אומת ${verifyLabel(sg)}`] : [s.name || '', 'שם, חתימה ותאריך'] })
  }
  // the broker's own signature, once the client has signed (data.agentSignature, the image frozen with the document)
  const as = doc.status === 'signed' ? doc.data?.agentSignature : null
  let agImg = null
  if (as && agentPng) { try { agImg = await pdf.embedPng(agentPng) } catch { agImg = null } }
  const agName = as?.name || ag.name
  boxes.push({ who: 'המתווך', img: agImg, lines: agImg ? [`${agName}${ag.license ? ` · רישיון ${ag.license}` : ''}`, `נחתם ${whenHe(as.at)}`, COMPANY.name] : [ag.name ? `${ag.name}${ag.license ? ` · רישיון ${ag.license}` : ''}` : COMPANY.name, COMPANY.name, `${COMPANY.idLabel} ${COMPANY.id}`] })
  for (let k = 0; k < boxes.length; k += 2) {
    if (k) { pg.y -= boxH + 10; need(boxH + 20) }
    drawBox(A4.w - M.side - boxW, boxes[k].who, boxes[k].lines, boxes[k].img)
    if (boxes[k + 1]) drawBox(M.side, boxes[k + 1].who, boxes[k + 1].lines, boxes[k + 1].img)
  }
  const sg = doc.signature || {}
  pg.y -= boxH + 10

  // ── certificate page (signed documents) ──
  if (doc.status === 'signed') {
    newPage()
    pg.text('אישור חתימה דיגיטלית', { size: 17, bold: true, align: 'center' }); pg.y -= 26
    para('מסמך זה נחתם בחתימה אלקטרונית במערכת המסמכים של אפיק הנחל. להלן תיעוד החתימה: מי חתם, מתי, באיזה אמצעי אומתה הזהות, וטביעת האצבע (SHA-256) של הקובץ שעליו נחתם ושל הקובץ החתום. כל אירוע בשרשרת התיעוד נושא גיבוב של האירוע שלפניו, כך ששינוי בדיעבד ניכר.', { size: 10, color: MUTE, gap: 10 })
    const signedList = signerRows.filter(s => s.status === 'signed' && s.signature)
    if (signedList.length > 1) {
      heading(`פרטי החתימות (${signedList.length} חותמים)`)
      rows([['מספר מסמך', doc.number]], { labelW: 120 })
      for (const s of signedList) { const g = s.signature; rows([[`${roleHe[s.role] || roleHe.other}`, `${g.name}${g.idNumber ? ` · ת.ז. ${g.idNumber}` : ''} · ${whenHe(g.at)} · ${verifyLabel(g, true)} · IP ${g.ip || ''}`]], { labelW: 120 }) }
    } else {
    heading('פרטי החתימה')
    rows([['מספר מסמך', doc.number], ['שם החותם', sg.name], ['ת.ז.', sg.idNumber], ['מועד החתימה', whenHe(sg.at || doc.signed_at)], ['אמצעי אימות', verifyLabel(sg, true)], ['כתובת IP', sg.ip], ['דפדפן', sg.ua], ['הצהרת הסכמה', 'החותם אישר כי קרא את המסמך, הבין את תוכנו והסכים לחתום עליו דיגיטלית']])
    }
    if (agImg) { heading('חתימת המתווך'); rows([['המתווך', `${agName}${ag.license ? ` · רישיון ${ag.license}` : ''}`], ['מועד', whenHe(as.at)], ['אופן החתימה', 'חתימת המתווך השמורה במערכת, הוטבעה אוטומטית לאחר חתימת הלקוח']], { labelW: 120 }) }
    heading('טביעות אצבע (SHA-256)')
    rows([['המסמך שנשלח לחתימה', originalHash], ['המסמך החתום', signedHash || '(מחושב על הקובץ הזה לאחר יצירתו)']], { labelW: 150, size: 8.5 })
    if (events.length) {
      heading('שרשרת האירועים')
      for (const ev of events) {
        need(26)
        const when = whenHe(ev.at)
        pg.text(`${when} · ${EVENT_HE[ev.type] || ev.type}${ev.meta?.to ? ` · ${ev.meta.to}` : ''}`, { size: 9 }); pg.y -= 12
        pg.text(`${ev.ip ? `IP ${ev.ip} · ` : ''}${ev.hash ? ev.hash.slice(0, 32) + '…' : ''}`, { size: 7.5, color: MUTE }); pg.y -= 13
      }
    }
  }
  pages.forEach((p, i) => footer(p, i + 1, pages.length))
  return pdf.save({ useObjectStreams: false })
}
const isPng = b => b && b.length > 8 && b[0] === 0x89 && b[1] === 0x50
export { logoBox }
