// The lead card's "מסמכים וחתימות" tab: every document made for this lead (crm_data.documents[], written by the server on
// every step — created, sent, opened, signed, cancelled), with its status, the property, the fee, the dates and the files
// (the PDF sent, the signed copy), and "+ מסמך חדש" → the documents tab's wizard on this lead (the afik:new-doc event).
import { FileSignature, Plus, Download, CheckCircle2, Clock, Eye, AlertTriangle, XCircle, PenLine } from 'lucide-react'
import { STATUS_HE, effectiveStatus, fmtMoney, fmtPct, todayHe, whenHe } from '../lib/documents.js'

const TONE = { draft: '#9A9AA8', sent: '#F5A623', opened: '#60A5FA', signed: '#25D366', expired: '#E05252', cancelled: '#9A9AA8', failed: '#E05252' }
const ICON = { draft: PenLine, sent: Clock, opened: Eye, signed: CheckCircle2, expired: AlertTriangle, cancelled: XCircle, failed: AlertTriangle }
const fileUrl = (id, kind) => `/api/meta/docs-file?id=${encodeURIComponent(id)}&kind=${kind}`
const CSS = `
.ld{display:flex;flex-direction:column;gap:10px}
.ld-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.ld-head h3{margin:0;font-size:15px;font-weight:600;display:flex;gap:8px;align-items:center}
.ld-new{height:36px;border-radius:9px;border:1px solid rgba(var(--brand-rgb),.35);background:var(--au-brand-soft);color:var(--au-brand-text);font:inherit;font-size:13px;font-weight:700;padding:0 14px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;min-height:0}
.ld-row{border:1px solid var(--au-line);border-radius:12px;padding:10px 12px;display:grid;grid-template-columns:1fr auto;gap:4px 12px;font-size:13px;background:var(--au-card)}
.ld-row .st{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:2px 9px;font-size:12px;font-weight:600;white-space:nowrap}
.ld-row small{color:var(--au-text3);display:block;font-size:12px}
.ld-files{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
.ld-files a{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--au-line);border-radius:999px;padding:4px 10px;font-size:12px;color:var(--au-text2);text-decoration:none;min-height:0}
.ld-files a.on{border-color:rgba(37,211,102,.5);color:var(--au-green-text)}
.ld-empty{color:var(--au-text3);font-size:13px;line-height:1.6;padding:8px 0}
`
export function LeadDocsTab({ lead, lang = 'he' }) {
  const list = Array.isArray(lead?.documents) ? lead.documents : (Array.isArray(lead?.crm_data?.documents) ? lead.crm_data.documents : [])
  const en = lang === 'en'
  const open = () => window.dispatchEvent(new CustomEvent('afik:new-doc', { detail: { leadId: lead.id } }))
  return (
    <div className="ld">
      <style>{CSS}</style>
      <div className="ld-head"><h3><FileSignature size={15}/>{en ? 'Documents & signatures' : 'מסמכים וחתימות'}</h3><button type="button" className="ld-new" onClick={open}><Plus size={14}/>{en ? 'New document' : 'מסמך חדש'}</button></div>
      {!list.length ? <div className="ld-empty">{en ? 'No documents for this lead yet. "New document" opens the brokerage order form with this lead\'s details filled in.' : 'עדיין אין מסמכים לליד הזה. "מסמך חדש" פותח את טופס הזמנת שירותי התיווך עם הפרטים של הליד.'}</div>
        : list.map(d => { const st = effectiveStatus(d), Ic = ICON[st] || Clock; return (
          <div key={d.id} className="ld-row">
            <div><b style={{ fontWeight: 600 }}>{d.title}</b> <span dir="ltr" style={{ color: 'var(--au-text3)', fontSize: 12 }}>{d.number}</span><small>{[d.project, d.property].filter(Boolean).join(' · ')}{d.pct != null ? ` · ${fmtPct(d.pct)}` : d.basis ? ` · ${d.basis}` : ''}{d.total ? ` · ${fmtMoney(d.total)} כולל מע"מ` : ''}</small></div>
            <span className="st" style={{ background: `${TONE[st]}1F`, color: TONE[st] }}><Ic size={12}/>{STATUS_HE[st] || st}</span>
            <small style={{ gridColumn: '1/-1' }}>{en ? 'Created' : 'נוצר'} {todayHe(d.created_at)}{d.sent_at ? ` · ${en ? 'sent' : 'נשלח'} ${todayHe(d.sent_at)}` : ''}{d.signed_at ? ` · ${en ? 'signed' : 'נחתם'} ${whenHe(d.signed_at)}` : ''}</small>
            <div className="ld-files">
              <a href={fileUrl(d.id, 'original')} target="_blank" rel="noreferrer"><Download size={11}/> PDF</a>
              {d.signed && <a className="on" href={fileUrl(d.id, 'signed')} target="_blank" rel="noreferrer"><CheckCircle2 size={11}/> {en ? 'Signed copy' : 'העותק החתום'}</a>}
            </div>
          </div>) })}
    </div>
  )
}
export default LeadDocsTab
