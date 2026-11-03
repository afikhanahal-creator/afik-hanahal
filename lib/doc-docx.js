// The Word (.docx) version of a document — the same content as the PDF (lib/doc-pdf.js), editable in Microsoft Word: every
// paragraph is right-to-left (bidirectional) with Rubik / Arial, label-value tables for the parties and the property, the
// eight clauses, the fee table and the signature boxes (the drawn signature as an image once signed). Built with the `docx`
// package; the logo is the same PNG the PDF uses. Tested in lib/doc-pdf.test.mjs (the zip is opened and its XML checked).
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, AlignmentType, BorderStyle, WidthType, ShadingType, Footer, PageNumber } from 'docx'
import LOGO_PNG, { LOGO_W, LOGO_H } from './doc-assets/logo-black.js'
import { COMPANY, DOC_TYPES, CLIENT_ROLES, DEAL_TYPES, computeFees, renderClauses, fmtMoney, fmtPct, todayHe, whenHe , fmtPhone, verifyLabel } from './documents.js'
import { templateOf, docBlocks } from './doc-templates.js'

const FONT = 'Rubik'
const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), font: { name: FONT, hint: 'cs' }, rightToLeft: true, size: o.size || 21, bold: !!o.bold, color: o.color || '17172B', ...(o.break ? { break: 1 } : {}) })
const lines = (text, o = {}) => String(text ?? '').split('\n').map((l, i) => run(l, { ...o, ...(i ? { break: true } : {}) }))   // a clause's own line breaks
const par = (children, o = {}) => new Paragraph({ bidirectional: true, alignment: o.align || AlignmentType.RIGHT, keepNext: !!o.keepNext, spacing: { after: o.after ?? 120, line: o.line || 300 }, children: Array.isArray(children) ? children : [children], ...(o.heading ? { heading: o.heading } : {}) })
const NOB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const LINEB = { style: BorderStyle.SINGLE, size: 4, color: 'DCD8CE' }
const cell = (children, { width, shade, borders } = {}) => new TableCell({ children: Array.isArray(children) ? children : [children], width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined, margins: { top: 40, bottom: 40, left: 100, right: 100 }, borders: borders || { top: NOB, left: NOB, right: NOB, bottom: LINEB }, ...(shade ? { shading: { type: ShadingType.CLEAR, fill: shade, color: 'auto' } } : {}) })
const rowsTable = pairs => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: true, rows: pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => new TableRow({ children: [cell(par(run(k, { bold: true, color: '5E5B6E', size: 19 }), { after: 0 }), { width: 28 }), cell(par(run(v), { after: 0 }), { width: 72 })] })) })

/** renderDocx(doc, { clauses, signaturePng, logoBytes }) → Buffer */
export async function renderDocx(doc, { clauses = null, template = null, signaturePng = null, logoBytes = null, agentPng = null } = {}) {
  const d = doc.data || {}
  const tp = templateOf(doc, template, clauses)
  const sec = tp.sections
  const blocks = tp.kind === 'brokerage' && !doc.template && !template ? renderClauses(d, clauses, { date: doc.created_at ? new Date(doc.created_at) : new Date() }).map(x => ({ t: 'clause', n: x.n, title: x.title, text: x.text })) : docBlocks(tp, doc)
  const c = d.client || {}, pr = d.property || {}, f = computeFees(d.fees || {}), ag = d.agent || {}, lg = d.logo?.url || d.logo?.show === false ? d.logo : { ...tp.logo, ...(d.logo || {}) }
  const title = d.title || tp.title || DOC_TYPES.brokerage.name
  const kids = []
  if (lg.show !== false) {
    const bytes = logoBytes || Buffer.from(LOGO_PNG, 'base64')
    const h = lg.size === 's' ? 56 : lg.size === 'l' ? 112 : 80
    const w = Math.round(h * (logoBytes ? 1 : LOGO_W / LOGO_H))
    kids.push(new Paragraph({ alignment: lg.align === 'left' ? AlignmentType.LEFT : lg.align === 'center' ? AlignmentType.CENTER : AlignmentType.RIGHT, bidirectional: false, spacing: { after: 60 }, children: [new ImageRun({ type: 'png', data: bytes, transformation: { width: w, height: h } })] }))
  }
  kids.push(par(run(COMPANY.name, { bold: true, size: 20 }), { after: 0 }))
  kids.push(par(run(`${COMPANY.idLabel} ${COMPANY.id} · ${COMPANY.phone} · ${COMPANY.email}`, { size: 17, color: '5E5B6E' }), { after: 240 }))
  kids.push(par(run(title, { bold: true, size: 36 }), { align: AlignmentType.CENTER, after: 60 }))
  kids.push(par(run(`מסמך מס׳ ${doc.number || '—'} · תאריך ${todayHe(doc.created_at || new Date())}${doc.status === 'signed' ? ` · נחתם ${whenHe(doc.signed_at)}` : ''}`, { size: 18, color: '5E5B6E' }), { align: AlignmentType.CENTER, after: 280 }))
  const h2 = t => par(run(t, { bold: true, size: 25, color: '3F4EB0' }), { after: 100, keepNext: true })
  if (sec.parties) { kids.push(h2('פרטי הלקוח')); kids.push(rowsTable([['שם מלא', c.name], ['ת.ז.', c.idNumber], ['טלפון', fmtPhone(c.phone)], ['אימייל', c.email], ['כתובת', c.address], ['בעסקה כ', CLIENT_ROLES[c.role]], ['פרויקט', doc.project_name || d.projectName]])); kids.push(par(run(''), { after: 120 }))
    if (tp.kind === 'brokerage' && (ag.name || ag.license)) { kids.push(h2('המתווך')); kids.push(rowsTable([['שם', ag.name], ['מס׳ רישיון', ag.license], ['טלפון', fmtPhone(ag.phone)]])); kids.push(par(run(''), { after: 120 })) } }
  if (sec.property) { kids.push(h2('פרטי הנכס')); kids.push(rowsTable([['כתובת', [pr.address, pr.city].filter(Boolean).join(', ')], ['תיאור', pr.desc], ['סוג הנכס', pr.type], ['סוג העסקה', DEAL_TYPES[pr.dealType]], ['מחיר העסקה (לפני מע"מ)', f.price ? fmtMoney(f.price) : ''], ['הערות', pr.notes], ['קישור לנכס', pr.link]])); kids.push(par(run(''), { after: 120 })) }
  if (blocks.length && tp.kind === 'brokerage') kids.push(h2('תנאי ההתקשרות'))
  for (const b of blocks) {
    if (b.t === 'h') { kids.push(par(run(b.text, { bold: true, size: 25 }), { after: 100 })); continue }
    if (b.t === 'clause') { kids.push(par(run(`${b.n}. ${b.title}`, { bold: true, size: 22 }), { after: 40, keepNext: true })); kids.push(par(lines(b.text), { after: 220, line: 330, align: AlignmentType.BOTH })); continue }
    kids.push(par(lines(b.text), { after: 160, align: AlignmentType.BOTH }))
  }
  if (sec.fees) {
  kids.push(h2('דמי התיווך'))
  const feeRows = [['בסיס החישוב', f.basis], ['מחיר העסקה לפני מע"מ', fmtMoney(f.price)], ['דמי תיווך לפני מע"מ', fmtMoney(f.commission)], [`מע"מ ${fmtPct(f.vatRate)}`, fmtMoney(f.vat)], ['סה"כ לתשלום כולל מע"מ', fmtMoney(f.total)]]
  kids.push(new Table({ width: { size: 70, type: WidthType.PERCENTAGE }, visuallyRightToLeft: true, rows: feeRows.map(([k, v], i) => { const last = i === feeRows.length - 1; return new TableRow({ children: [cell(par(run(k, { bold: last }), { after: 0 }), { width: 55, shade: last ? 'F6F3EE' : undefined }), cell(par(run(v, { bold: last }), { after: 0, align: AlignmentType.LEFT }), { width: 45, shade: last ? 'F6F3EE' : undefined })] }) }) }))
  kids.push(par(run(''), { after: 120 }))
  if (d.terms) { kids.push(h2('תנאים נוספים')); kids.push(par(run(d.terms), { after: 200 })) }
  }
  kids.push(h2('חתימות'))
  const sg = doc.signature || {}
  const boxB = { top: LINEB, bottom: LINEB, left: LINEB, right: LINEB }
  const more = (doc.data?.signing?.list || []).filter(s => s.i > 0)
  const clientBox = [par(run(more.length ? 'הלקוח' : 'הלקוח', { bold: true, color: '5E5B6E', size: 19 }), { after: 120 })]
  if (doc.status === 'signed' && signaturePng) clientBox.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new ImageRun({ type: 'png', data: signaturePng, transformation: { width: 160, height: 58 } })] }))
  else clientBox.push(par(run('_____________________________', { color: 'B9B5AA' }), { after: 80 }))
  clientBox.push(par(run(doc.status === 'signed' ? `${sg.name || c.name}${sg.idNumber ? ` · ת.ז. ${sg.idNumber}` : ''}` : c.name || '', { size: 18 }), { after: 0 }))
  clientBox.push(par(run(doc.status === 'signed' ? `נחתם דיגיטלית ${whenHe(sg.at || doc.signed_at)}` : 'שם, חתימה ותאריך', { size: 17, color: '5E5B6E' }), { after: 0 }))
  const as = doc.status === 'signed' && agentPng ? doc.data?.agentSignature : null
  const agentBox = [par(run('המתווך', { bold: true, color: '5E5B6E', size: 19 }), { after: 120 }),
    as ? new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new ImageRun({ type: 'png', data: agentPng, transformation: { width: 140, height: 58 } })] }) : par(run('_____________________________', { color: 'B9B5AA' }), { after: 80 }),
    par(run((as?.name || ag.name) ? `${as?.name || ag.name}${ag.license ? ` · רישיון ${ag.license}` : ''}` : COMPANY.name, { size: 18 }), { after: 0 }),
    par(run(as ? `נחתם ${whenHe(as.at)} · ${COMPANY.name}` : COMPANY.name, { size: 17, color: '5E5B6E' }), { after: 0 })]
  kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: true, rows: [new TableRow({ cantSplit: true, children: [cell(clientBox, { width: 50, borders: boxB }), cell(agentBox, { width: 50, borders: boxB })] })] }))
  for (const s of more) {   // more signers (a spouse, a partner, a guarantor): a box each
    const g = s.signature || {}
    kids.push(par(run(''), { after: 80 }))
    kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: true, rows: [new TableRow({ children: [cell([par(run({ spouse: 'בן/בת זוג', partner: 'שותף/ה', guarantor: 'ערב/ה' }[s.role] || 'חותם נוסף', { bold: true, color: '5E5B6E', size: 19 }), { after: 120 }), par(run('_____________________________', { color: 'B9B5AA' }), { after: 80 }), par(run(s.status === 'signed' ? `${g.name || s.name}${g.idNumber ? ` · ת.ז. ${g.idNumber}` : ''}` : s.name || '', { size: 18 }), { after: 0 }), par(run(s.status === 'signed' ? `נחתם דיגיטלית ${whenHe(g.at)}` : 'שם, חתימה ותאריך', { size: 17, color: '5E5B6E' }), { after: 0 })], { width: 50, borders: boxB }), cell([par(run(''))], { width: 50, borders: {} })] })] }))
  }
  if (doc.status === 'signed') {
    kids.push(par(run(''), { after: 200 }))
    kids.push(h2('אישור חתימה דיגיטלית'))
    kids.push(rowsTable([['מספר מסמך', doc.number], ['שם החותם', sg.name], ['ת.ז.', sg.idNumber], ['מועד החתימה', whenHe(sg.at || doc.signed_at)], ['אמצעי אימות', verifyLabel(sg, true)], ['כתובת IP', sg.ip], ['דפדפן', sg.ua]]))
  }
  const docx = new Document({
    creator: 'Afik Hanahal CRM', title: `${title} ${doc.number || ''}`.trim(), description: title,
    styles: { default: { document: { run: { font: FONT, size: 21, rightToLeft: true }, paragraph: { bidirectional: true } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: kids,
      footers: { default: new Footer({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: `${title} · ${doc.number || ''}${doc.status === 'signed' ? ' · נחתם דיגיטלית' : ''} · עמוד `, font: { name: FONT, hint: 'cs' }, rightToLeft: true, size: 16, color: '8A8798' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '8A8798', font: { name: FONT } }),
        new TextRun({ text: ' מתוך ', font: { name: FONT, hint: 'cs' }, rightToLeft: true, size: 16, color: '8A8798' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '8A8798', font: { name: FONT } }),
      ] })] }) } }],
  })
  return Packer.toBuffer(docx)
}
