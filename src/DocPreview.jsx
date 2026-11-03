// The document as an A4 sheet in HTML — the wizard's live preview (admin "מסמכים וחתימות") and what the client reads on the
// signing page (/sign/<token>). One component, one look, fed by a `view` (lib/documents.js publicView(): number, title, client,
// property, fees, agent, logo, terms, clauses, signature). Pure RTL HTML, so it reads right on any phone; the PDF (lib/doc-pdf.js)
// follows the same order and sections.
import { COMPANY, CLIENT_ROLES, DEAL_TYPES, fmtMoney, fmtPct, todayHe, whenHe } from '../lib/documents.js'

export const DOC_CSS = `
.dsh{--dsh-ink:#17172B;--dsh-mute:#5E5B6E;--dsh-line:#E6E1D6;--dsh-soft:#F6F3EE;--dsh-brand:#3F4EB0;background:#fff;color:var(--dsh-ink);direction:rtl;font-family:Rubik,Heebo,Arial,sans-serif;width:210mm;max-width:100%;min-height:297mm;box-sizing:border-box;padding:18mm 17mm 20mm;margin:0 auto;box-shadow:0 8px 40px rgba(0,0,0,.14);border-radius:4px;font-size:10.6pt;line-height:1.6;position:relative}
.dsh *{box-sizing:border-box}
.dsh-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-bottom:1px solid var(--dsh-line);padding-bottom:10px;margin-bottom:18px}
.dsh-head.c{flex-direction:column;align-items:center;text-align:center}
.dsh-head.l{flex-direction:row-reverse}
.dsh-logo{display:block;object-fit:contain;flex-shrink:0}
.dsh-logo.s{height:42px}.dsh-logo.m{height:60px}.dsh-logo.l{height:84px}
.dsh-co{font-weight:700;font-size:10.5pt}.dsh-co small{display:block;font-weight:400;color:var(--dsh-mute);font-size:8.5pt;margin-top:2px}
.dsh h1{font-size:19pt;font-weight:700;text-align:center;margin:0 0 4px;letter-spacing:-.01em}
.dsh-meta{text-align:center;color:var(--dsh-mute);font-size:9.5pt;margin-bottom:20px}
.dsh h2{font-size:12.5pt;font-weight:700;margin:16px 0 8px;padding-inline-start:10px;border-inline-start:3px solid var(--dsh-brand);line-height:1.25}
.dsh-rows{width:100%;border-collapse:collapse;margin-bottom:6px}
.dsh-rows td{padding:5px 0;border-bottom:1px solid var(--dsh-line);vertical-align:top;font-size:10pt}
.dsh-rows td:first-child{color:var(--dsh-mute);font-weight:600;width:118px;font-size:9.5pt}
.dsh-p{margin:0 0 10px;white-space:pre-wrap}.dsh-h{border:none;padding:0;font-size:12.5pt}
.dsh-cl{margin:0 0 10px}.dsh-cl b{display:block;font-size:11pt;margin-bottom:2px}.dsh-cl p{margin:0;padding-inline-start:14px;white-space:pre-wrap}
.dsh-fees{border-collapse:collapse;width:400px;max-width:100%;margin:4px 0 10px}
.dsh-fees td{padding:5px 8px;border-bottom:1px solid var(--dsh-line);font-size:10pt}
.dsh-fees td:last-child{text-align:left;direction:ltr;font-variant-numeric:tabular-nums}
.dsh-fees tr.t td{background:var(--dsh-soft);font-weight:700;font-size:10.5pt}
.dsh-sig{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:14px}
.dsh-box{border:1px solid var(--dsh-line);border-radius:4px;min-height:96px;padding:10px 12px;position:relative;display:flex;flex-direction:column;justify-content:space-between}
.dsh-box b{color:var(--dsh-mute);font-size:9.5pt}
.dsh-box .ln{border-bottom:1px solid var(--dsh-line);height:34px;margin:8px 10px 6px}
.dsh-box img{height:44px;object-fit:contain;align-self:center;margin:4px 0}
.dsh-box small{color:var(--dsh-mute);font-size:8.5pt;display:block;line-height:1.4}
.dsh-foot{position:absolute;left:17mm;right:17mm;bottom:9mm;border-top:1px solid var(--dsh-line);padding-top:6px;display:flex;justify-content:space-between;color:var(--dsh-mute);font-size:8pt}
.dsh-stamp{position:absolute;top:14mm;left:17mm;border:2px solid #128C4A;color:#128C4A;border-radius:6px;padding:3px 10px;font-weight:700;font-size:10pt;transform:rotate(-6deg);background:rgba(255,255,255,.9)}
@media (max-width:640px){.dsh{padding:16px 14px 50px;min-height:0;font-size:14px;width:100%;box-shadow:none;border-radius:0}.dsh-sig{grid-template-columns:1fr}.dsh-rows td:first-child{width:96px}.dsh h1{font-size:21px}.dsh-foot{position:static;margin-top:16px}.dsh-head{flex-wrap:wrap}.dsh-logo.m{height:48px}.dsh-logo.l{height:64px}}
@media print{.dsh{box-shadow:none;margin:0;width:auto;min-height:0}}
`
const Row = ({ k, v, ltr }) => (v == null || v === '' ? null : <tr><td>{k}</td><td dir={ltr ? 'ltr' : undefined} style={ltr ? { textAlign: 'right' } : undefined}>{v}</td></tr>)

export default function DocSheet({ view, signatureUrl = '', logoSrc = '/logo-black.svg', className = '' }) {
  if (!view) return null
  const c = view.client || {}, p = view.property || {}, f = view.fees || {}, a = view.agent || {}, lg = view.logo || {}
  const signed = view.status === 'signed' && view.signature
  const sec = view.sections || { parties: true, property: true, fees: true, signatures: true }
  const blocks = view.blocks || (view.clauses || []).map(c => ({ t: 'clause', n: c.n, title: c.title, text: c.text }))
  const brokerage = !view.sections || view.kind === 'brokerage' || (sec.fees && !!view.clauses)
  const logo = lg.show !== false ? (lg.url || logoSrc) : ''
  const align = lg.align === 'center' ? 'c' : lg.align === 'left' ? 'l' : ''
  return (
    <article className={`dsh ${className}`} lang="he" dir="rtl" aria-label={view.title}>
      {signed && <div className="dsh-stamp">נחתם דיגיטלית</div>}
      <header className={`dsh-head ${align}`}>
        {logo && <img className={`dsh-logo ${lg.size || 'm'}`} src={logo} alt={COMPANY.short}/>}
        <div className="dsh-co">{COMPANY.name}<small>{COMPANY.idLabel} {COMPANY.id} · {COMPANY.phone} · {COMPANY.email}</small></div>
      </header>
      <h1>{view.title}</h1>
      <div className="dsh-meta">מסמך מס׳ <span dir="ltr">{view.number || 'טיוטה'}</span> · תאריך {todayHe(view.created_at || new Date())}{signed ? <> · נחתם {whenHe(view.signed_at || view.signature.at)}</> : null}</div>
      {sec.parties && <><h2>פרטי הלקוח</h2>
      <table className="dsh-rows"><tbody>
        <Row k="שם מלא" v={c.name}/><Row k="ת.ז." v={c.idNumber} ltr/><Row k="טלפון" v={c.phone || c.phoneMasked} ltr/><Row k="אימייל" v={c.email || c.emailMasked} ltr/><Row k="כתובת" v={c.address}/><Row k="בעסקה כ" v={CLIENT_ROLES[c.role]}/><Row k="פרויקט" v={view.project}/>
      </tbody></table></>}
      {sec.property && <><h2>פרטי הנכס</h2>
      <table className="dsh-rows"><tbody>
        <Row k="כתובת" v={[p.address, p.city].filter(Boolean).join(', ')}/><Row k="תיאור" v={p.desc}/><Row k="סוג הנכס" v={p.type}/><Row k="סוג העסקה" v={DEAL_TYPES[p.dealType]}/><Row k='מחיר העסקה (לפני מע"מ)' v={f.price ? fmtMoney(f.price) : ''} ltr/><Row k="הערות" v={p.notes}/><Row k="קישור לנכס" v={p.link} ltr/>
      </tbody></table></>}
      {brokerage && blocks.length > 0 && <h2>תנאי ההתקשרות</h2>}
      {blocks.map((b, i) => b.t === 'h' ? <h2 key={i} className="dsh-h">{b.text}</h2> : b.t === 'clause' ? <div className="dsh-cl" key={i}><b>{b.n}. {b.title}</b><p>{b.text}</p></div> : <p className="dsh-p" key={i}>{b.text}</p>)}
      {sec.fees && <><h2>דמי התיווך</h2>
      <table className="dsh-fees"><tbody>
        <tr><td>בסיס החישוב</td><td dir="rtl" style={{ textAlign: 'left' }}>{f.basis}</td></tr>
        <tr><td>מחיר העסקה לפני מע"מ</td><td>{fmtMoney(f.price || 0)}</td></tr>
        <tr><td>דמי תיווך לפני מע"מ</td><td>{fmtMoney(f.commission || 0)}</td></tr>
        <tr><td>מע"מ {fmtPct(f.vatRate ?? 18)}</td><td>{fmtMoney(f.vat || 0)}</td></tr>
        <tr className="t"><td>סה"כ לתשלום כולל מע"מ</td><td>{fmtMoney(f.total || 0)}</td></tr>
      </tbody></table>
      {view.terms && <><h2>תנאים נוספים</h2><p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{view.terms}</p></>}</>}
      <h2>חתימות</h2>
      <div className="dsh-sig">
        <div className="dsh-box"><b>הלקוח</b>{signed && signatureUrl ? <img src={signatureUrl} alt="חתימת הלקוח"/> : <div className="ln"/>}<small>{signed ? <>{view.signature.name}<br/>נחתם דיגיטלית {whenHe(view.signature.at)}</> : <>{c.name}<br/>שם, חתימה ותאריך</>}</small></div>
        <div className="dsh-box"><b>המתווך</b><div className="ln"/><small>{a.name ? `${a.name}${a.license ? ` · רישיון ${a.license}` : ''}` : COMPANY.name}<br/>{COMPANY.name}</small></div>
      </div>
      {(view.signer?.list || []).length > 1 && <div className="dsh-sig">{view.signer.list.slice(1).map((sg, i) => <div key={i} className="dsh-box"><b>{{ spouse: 'בן/בת זוג', partner: 'שותף/ה', guarantor: 'ערב/ה' }[sg.role] || 'חותם נוסף'}</b><div className="ln"/><small>{sg.name}<br/>{sg.status === 'signed' ? `נחתם דיגיטלית ${whenHe(sg.signed_at)}` : 'שם, חתימה ותאריך'}</small></div>)}</div>}
      <footer className="dsh-foot"><span>{view.title} · <span dir="ltr">{view.number || ''}</span></span><span>{COMPANY.short} · {COMPANY.site.replace(/^https?:\/\//, '')}</span></footer>
    </article>
  )
}
