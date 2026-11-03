// The template editor (admin "מסמכים וחתימות" → "תבניות"): an uploaded Word / PDF / scan (POST docs-extract) or a blank page
// becomes a template — three panes: the fields on the right (the standard ones the CRM fills by itself, grouped; the template's
// own fields; "+ הוספת שדה"), the document in the middle (its blocks as editable paragraphs: select text → "הפיכה לשדה", the
// suggestions found in the text — blanks, ת.ז., phones, dates, percents — applied with one click, blocks added / removed /
// reordered, a block's kind: heading / paragraph / numbered clause), the chosen field's settings on the left (label, key,
// type, required, default, options) with the template's own settings (name, title, sections: parties / property / fees /
// signatures, logo). "תצוגה מקדימה" shows the sheet (src/DocPreview.jsx) with sample values. Rules: lib/doc-templates.js.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, FileText, Plus, Trash2, ChevronUp, ChevronDown, Wand2, Eye, Check, AlertTriangle, X, Save, Type, Hash, ListOrdered } from 'lucide-react'
import { Button, Field, Modal, useToasts } from './automationsUI.jsx'
import DocSheet from './DocPreview.jsx'
import { STANDARD_FIELDS, FIELD_GROUPS, FIELD_TYPES, cleanTemplate, templateKeys, textToBlocks, detectFields, applyField, keyFromLabel, sampleValues, renderBlocks } from '../lib/doc-templates.js'

const AUTH = { Authorization: 'Bearer AFIKhanahal2026' }
export const TE_CSS = `
.te{display:grid;grid-template-columns:260px minmax(0,1fr) 300px;gap:0;height:100%;min-height:0;direction:rtl;color:var(--au-text);font-family:Rubik,sans-serif}
.te-pane{min-height:0;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:14px}
.te-fields{border-inline-end:1px solid var(--au-line)}
.te-props{border-inline-start:1px solid var(--au-line)}
.te-doc{background:rgba(var(--ov),.035)}
.te-h{font-size:12px;font-weight:700;color:var(--au-text3);margin:6px 0 2px;text-transform:none}
.te-chip{display:flex;align-items:center;gap:6px;width:100%;text-align:start;border:1px solid var(--au-line);background:var(--au-card);color:var(--au-text);border-radius:9px;padding:6px 9px;font:inherit;font-size:12.5px;cursor:pointer;min-height:0}
.te-chip:hover{border-color:rgba(var(--brand-rgb),.5)}.te-chip.on{border-color:var(--au-brand);background:rgba(var(--brand-rgb),.08)}
.te-chip code{font-size:10.5px;color:var(--au-text3);direction:ltr;margin-inline-start:auto}
.te-chip.used code{color:var(--au-green-text)}
.te-block{background:var(--au-card);border:1px solid var(--au-line);border-radius:12px;padding:8px 10px;display:flex;flex-direction:column;gap:6px}
.te-block.on{border-color:rgba(var(--brand-rgb),.6);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.12)}
.te-block-bar{display:flex;gap:4px;align-items:center;font-size:11.5px;color:var(--au-text3)}
.te-block-bar .sp{flex:1}
.te-kind{border:1px solid var(--au-line);background:transparent;border-radius:999px;padding:2px 8px;font:inherit;font-size:11px;cursor:pointer;color:var(--au-text2);min-height:0}
.te-kind.on{background:var(--au-brand);border-color:var(--au-brand);color:#fff}
.te-ib{width:26px;height:26px;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--au-text3);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;min-height:0;min-width:0;padding:0}
.te-ib:hover{border-color:var(--au-line);color:var(--au-text)}
.te-ta{width:100%;border:1px solid transparent;background:transparent;color:var(--au-text);font:inherit;font-size:14px;line-height:1.65;resize:vertical;min-height:44px;padding:4px 6px;border-radius:8px}
.te-ta:focus{outline:none;border-color:var(--au-line);background:var(--au-input)}
.te-title{font-weight:700;font-size:14px}
.te-sel{position:sticky;top:0;z-index:3;background:var(--au-card);border:1px solid rgba(var(--brand-rgb),.4);border-radius:12px;padding:8px 10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;box-shadow:var(--au-shadow)}
.te-sel b{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.te-sugg{display:flex;flex-direction:column;gap:4px}
.te-sugg button{display:flex;gap:8px;align-items:center;text-align:start;border:1px dashed rgba(var(--brand-rgb),.45);background:rgba(var(--brand-rgb),.05);border-radius:9px;padding:6px 9px;font:inherit;font-size:12px;cursor:pointer;color:var(--au-text);min-height:0}
.te-sugg button i{font-style:normal;color:var(--au-text3);direction:ltr}
.te-input{width:100%;height:36px;padding:0 10px;border-radius:9px;border:1px solid var(--au-line);background:var(--au-input);color:var(--au-text);font:inherit;font-size:13px;min-height:0}
.te-tog{display:flex;gap:8px;align-items:center;font-size:12.5px;cursor:pointer}.te-tog input{accent-color:var(--au-brand);width:16px;height:16px}
.te-ph{font-family:ui-monospace,Menlo,monospace;font-size:11px;direction:ltr;background:rgba(var(--ov),.07);border-radius:6px;padding:2px 6px}
.te-warn{background:rgba(245,166,35,.12);color:var(--au-amber-text);border-radius:9px;padding:7px 10px;font-size:12.5px;line-height:1.5}
.te-err{background:rgba(224,82,82,.1);color:var(--au-red-text);border-radius:9px;padding:7px 10px;font-size:12.5px}
.te-up{border:2px dashed var(--au-line);border-radius:16px;padding:28px 16px;text-align:center;display:flex;flex-direction:column;gap:8px;align-items:center;cursor:pointer;color:var(--au-text2)}
.te-up.drag{border-color:var(--au-brand);background:rgba(var(--brand-rgb),.06)}
.te-foot{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:10px 14px;border-top:1px solid var(--au-line);background:var(--au-card)}
.te-prev{background:#8E8B84;overflow:auto;padding:16px;display:flex;justify-content:center}
@media (max-width:1100px){.te{grid-template-columns:1fr}.te-fields,.te-props{display:none}.te.show-fields .te-fields{display:flex}.te.show-fields .te-doc,.te.show-props .te-doc{display:none}.te.show-props .te-props{display:flex}}
`
const T = {
  fields: 'שדות', std: 'שדות מהמערכת (מתמלאים לבד)', own: 'שדות של התבנית (ממלאים לכל מסמך)', add: 'הוספת שדה', insert: 'הכנסה למסמך', used: 'בשימוש', doc: 'המסמך', preview: 'תצוגה מקדימה', back: 'חזרה לעריכה',
  sel: 'הטקסט שנבחר:', makeField: 'הפיכה לשדה', pick: 'איזה שדה?', newField: 'שדה חדש…', sugg: 'שדות שזוהו בטקסט', apply: 'החלה', applyAll: 'החלת כל ההצעות', ignore: 'התעלמות',
  block: { h: 'כותרת', p: 'פסקה', clause: 'סעיף ממוספר' }, addBlock: 'פסקה', del: 'מחיקה', up: 'למעלה', down: 'למטה', clauseTitle: 'כותרת הסעיף',
  props: 'הגדרות', tpl: 'התבנית', name: 'שם התבנית', title: 'כותרת המסמך', sections: 'חלקים קבועים במסמך', parties: 'טבלת פרטי הלקוח', property: 'טבלת פרטי הנכס', fees: 'טבלת דמי התיווך (ושדות ההתקשרות)', signatures: 'חתימות', field: 'השדה שנבחר', label: 'תווית', key: 'מפתח (באנגלית)', type: 'סוג', required: 'שדה חובה', def: 'ערך ברירת מחדל', options: 'אפשרויות (מופרדות בפסיק)', hint: 'הסבר למי שממלא', removeField: 'הסרת השדה', stdInfo: 'שדה מהמערכת: מתמלא מכרטיס הליד, הנכס, הפרויקט, הסוכן או החברה.',
  save: 'שמירת התבנית', saving: 'שומר…', saved: 'התבנית נשמרה ✓', cancel: 'סגירה', upload: 'גררו לכאן קובץ Word, PDF, או סריקה (PNG / JPG) — או לחצו לבחירה', uploading: 'קורא את הקובץ…', paste: 'או הדביקו את הטקסט של המסמך', pasteBtn: 'המשך עם הטקסט', blank: 'תבנית ריקה', method: { docx: 'הטקסט נקרא מקובץ Word', pdf: 'הטקסט נקרא משכבת הטקסט של ה-PDF', vision: 'הטקסט נקרא מהסריקה בעזרת AI — יש להגיה', text: 'טקסט שהודבק' },
  legal: 'הנוסח שבמסמך נשאר כפי שהוא. המערכת מחליפה רק את מה שסימנתם כשדה; כל שינוי אחר הוא שלכם ונשמר רק כשלוחצים "שמירת התבנית".',
  noText: 'לתבנית אין טקסט', mobile: { fields: 'שדות', doc: 'המסמך', props: 'הגדרות' },
}
const groups = () => { const g = {}; for (const [k, f] of Object.entries(STANDARD_FIELDS)) (g[f.group] = g[f.group] || []).push({ key: k, ...f }); return g }

/** the upload step → { text, source, method, warnings } or a blank template */
export function TemplateUpload({ onReady, onCancel, push }) {
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pasted, setPasted] = useState('')
  const inp = useRef(null)
  const take = async file => {
    if (!file) return
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/meta/docs-extract?name=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type || 'application/octet-stream')}`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', ...AUTH }, body: file, signal: AbortSignal.timeout(90000) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`)
      onReady({ text: d.text, source: d.source, method: d.method, warnings: d.warnings || [], name: file.name.replace(/\.[^.]+$/, '') })
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div className={`te-up${drag ? ' drag' : ''}`} onClick={() => inp.current?.click()} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]) }} role="button" tabIndex={0} aria-label={T.upload}>
        <Upload size={28}/><b style={{ fontSize: 14 }}>{busy ? T.uploading : T.upload}</b><span style={{ fontSize: 12, color: 'var(--au-text3)' }}>DOCX · PDF · PNG · JPG · עד 15 MB · עברית מלאה</span>
        <input ref={inp} type="file" hidden accept=".docx,.pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => take(e.target.files?.[0])}/>
      </div>
      {err && <div className="te-err" role="alert">{err}</div>}
      <Field label={T.paste}><textarea className="te-input" style={{ height: 120, padding: 8, resize: 'vertical' }} value={pasted} onChange={e => setPasted(e.target.value)} aria-label={T.paste}/></Field>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="plain" onClick={onCancel}>{T.cancel}</Button>
        <Button variant="ghost" onClick={() => onReady({ text: '', source: null, method: 'text', warnings: [], name: '' })}>{T.blank}</Button>
        <Button variant="solid" disabled={!pasted.trim()} onClick={() => onReady({ text: pasted, source: null, method: 'text', warnings: [], name: '' })}>{T.pasteBtn}</Button>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--au-text3)' }}>{T.legal}</p>
    </div>
  )
}

export default function TemplateEditor({ initial, onSaved, onClose }) {
  const [push, toasts] = useToasts()
  const [tp, setTp] = useState(() => cleanTemplate(initial?.template || { name: initial?.name || '', title: initial?.name || '', blocks: initial?.text ? textToBlocks(initial.text) : [{ t: 'h', text: initial?.name || 'כותרת המסמך' }, { t: 'p', text: '' }], fields: [], sections: { parties: true, property: false, fees: false, signatures: true }, source: initial?.source || null }))
  const [id, setId] = useState(initial?.template?.id || '')
  const [sel, setSel] = useState(null)              // { block, start, end, text } the selected text in a block
  const [curField, setCurField] = useState('')       // the field whose settings show
  const [curBlock, setCurBlock] = useState(-1)
  const [sugg, setSugg] = useState(() => (initial?.text && !initial?.template ? detectFields(textToBlocks(initial.text)) : []))
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [pane, setPane] = useState('doc')
  const [newF, setNewF] = useState(null)
  const taRefs = useRef({})
  const used = useMemo(() => new Set(templateKeys(tp)), [tp])
  const G = useMemo(groups, [])
  const setBlock = (i, patch) => setTp(t => ({ ...t, blocks: t.blocks.map((b, j) => j === i ? { ...b, ...patch } : b) }))
  const addBlock = (i, kind = 'p') => setTp(t => { const b = [...t.blocks]; b.splice(i + 1, 0, { t: kind, text: '', ...(kind === 'clause' ? { title: '' } : {}) }); return { ...t, blocks: b } })
  const delBlock = i => setTp(t => ({ ...t, blocks: t.blocks.filter((_, j) => j !== i) }))
  const move = (i, d) => setTp(t => { const b = [...t.blocks]; const j = i + d; if (j < 0 || j >= b.length) return t; [b[i], b[j]] = [b[j], b[i]]; return { ...t, blocks: b } })
  const onSelect = i => { const ta = taRefs.current[i]; if (!ta) return; const s = ta.selectionStart, e = ta.selectionEnd; if (e > s) setSel({ block: i, start: s, end: e, text: ta.value.slice(s, e) }); else setSel(x => (x && x.block === i ? null : x)) }
  const insertKey = key => {
    if (sel) { setBlock(sel.block, { text: applyField(tp.blocks[sel.block].text, sel.start, sel.end, key) }); setSel(null); return }
    const i = curBlock >= 0 ? curBlock : tp.blocks.length - 1
    if (i < 0) return
    const ta = taRefs.current[i]; const pos = ta ? ta.selectionStart : tp.blocks[i].text.length
    setBlock(i, { text: applyField(tp.blocks[i].text, pos, pos, key) })
  }
  const applySugg = (s, key) => { const k = key || s.key; if (!k) return; setBlock(s.block, { text: applyField(tp.blocks[s.block].text, s.start, s.end, k) }); setSugg(list => list.filter(x => x !== s).map(x => (x.block === s.block && x.start > s.start ? { ...x, start: x.start + (k.length + 2) - (s.end - s.start), end: x.end + (k.length + 2) - (s.end - s.start) } : x))) }
  const applyAll = () => { const list = [...sugg].filter(s => s.key).sort((a, b) => b.block - a.block || b.start - a.start); let blocks = tp.blocks.map(b => ({ ...b })); for (const s of list) blocks[s.block].text = applyField(blocks[s.block].text, s.start, s.end, s.key); setTp(t => ({ ...t, blocks })); setSugg(x => x.filter(s => !s.key)) }
  const addField = f => { const key = f.key || keyFromLabel(f.label, tp.fields.map(x => x.key)); setTp(t => ({ ...t, fields: [...t.fields, { key, label: f.label || key, type: f.type || 'text', required: !!f.required, default: f.default || '', ...(f.type === 'select' ? { options: f.options || [] } : {}) }] })); setCurField(key); return key }
  const setField = (key, patch) => setTp(t => ({ ...t, fields: t.fields.map(f => f.key === key ? { ...f, ...patch } : f) }))
  const removeField = key => { setTp(t => ({ ...t, fields: t.fields.filter(f => f.key !== key), blocks: t.blocks.map(b => ({ ...b, text: b.text.split(`{${key}}`).join('') })) })); setCurField('') }
  const save = async () => {
    const clean = cleanTemplate({ ...tp, id })
    if (!clean.blocks.some(b => b.text)) { setErr(T.noText); return }
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/meta/docs-template', { method: 'POST', headers: { 'Content-Type': 'application/json', ...AUTH }, body: JSON.stringify({ ...clean, id }), signal: AbortSignal.timeout(30000) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`)
      setId(d.template.id); push(T.saved); onSaved?.(d.template)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const field = tp.fields.find(f => f.key === curField) || null
  const stdCur = !field && STANDARD_FIELDS[curField] ? { key: curField, ...STANDARD_FIELDS[curField] } : null
  const previewView = useMemo(() => ({ number: 'AH-2026-0001', status: 'draft', title: tp.title || tp.name, created_at: new Date().toISOString(), client: { name: 'רונן כהן', idNumber: '123456782', phone: '0501234567', email: 'ronen@example.com', address: 'הרצל 5, רעננה', role: 'buyer' }, property: { address: 'זרובבל 15', city: 'רעננה', desc: 'דירת 4 חדרים', type: 'דירה', dealType: 'sale' }, fees: { price: 3000000, commission: 60000, vat: 10800, total: 70800, vatRate: 18, basis: '2% ממחיר העסקה' }, agent: { name: 'ישראל בן-יהודה', license: '12345' }, logo: tp.logo, project: 'זרובבל 15', blocks: renderBlocks(tp, { ...sampleValues(), ...Object.fromEntries(tp.fields.map(f => [f.key, f.default || `[${f.label}]`])) }), sections: tp.sections, kind: 'custom' }), [tp])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <style>{TE_CSS}</style>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--au-line)', flexWrap: 'wrap' }}>
        <FileText size={16}/><b style={{ fontSize: 15 }}>{tp.name || 'תבנית חדשה'}</b>
        {initial?.method && <span style={{ fontSize: 12, color: 'var(--au-text3)' }}>· {T.method[initial.method] || ''}</span>}
        <span style={{ flex: 1 }}/>
        <div style={{ display: 'flex', gap: 4 }} className="te-mob">{['fields', 'doc', 'props'].map(p => <button key={p} type="button" className={`te-kind${pane === p ? ' on' : ''}`} onClick={() => setPane(p)}>{T.mobile[p]}</button>)}</div>
        <Button variant="ghost" icon={<Eye size={13}/>} onClick={() => setPreview(v => !v)}>{preview ? T.back : T.preview}</Button>
        <Button variant="solid" icon={<Save size={13}/>} loading={busy} onClick={save}>{T.save}</Button>
        <button type="button" className="te-ib" onClick={onClose} aria-label={T.cancel}><X size={16}/></button>
      </div>
      {(initial?.warnings || []).map((w, i) => <div key={i} className="te-warn" style={{ margin: '8px 14px 0' }}><AlertTriangle size={13}/> {w}</div>)}
      {err && <div className="te-err" style={{ margin: '8px 14px 0' }} role="alert">{err}</div>}
      {preview ? <div className="te-prev" style={{ flex: 1 }}><div style={{ width: 794, maxWidth: '100%' }}><DocSheet view={previewView}/></div></div> : (
        <div className={`te show-${pane}`} style={{ flex: 1 }}>
          <aside className="te-pane te-fields">
            <div className="te-h">{T.own}</div>
            {tp.fields.map(f => <button key={f.key} type="button" className={`te-chip${curField === f.key ? ' on' : ''}${used.has(f.key) ? ' used' : ''}`} onClick={() => { setCurField(f.key); setPane('props') }} onDoubleClick={() => insertKey(f.key)} title={`${T.insert}: לחיצה כפולה`}>{f.label}{f.required ? ' *' : ''}<code>{used.has(f.key) ? '✓ ' : ''}{`{${f.key}}`}</code></button>)}
            <button type="button" className="te-chip" style={{ borderStyle: 'dashed', justifyContent: 'center' }} onClick={() => setNewF({ label: '', type: 'text', required: false })}><Plus size={13}/>{T.add}</button>
            <div className="te-h">{T.std}</div>
            {Object.entries(G).map(([g, list]) => <details key={g} open={g === 'client'}><summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, padding: '4px 0' }}>{FIELD_GROUPS[g]}</summary><div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0 6px' }}>{list.map(f => <button key={f.key} type="button" className={`te-chip${curField === f.key ? ' on' : ''}${used.has(f.key) ? ' used' : ''}`} onClick={() => { setCurField(f.key); insertKey(f.key) }} title={T.insert}>{f.label}<code>{used.has(f.key) ? '✓ ' : ''}{`{${f.key}}`}</code></button>)}</div></details>)}
          </aside>
          <section className="te-pane te-doc" aria-label={T.doc}>
            {sel && <div className="te-sel"><span>{T.sel}</span><b>"{sel.text}"</b><span style={{ flex: 1 }}/><span style={{ fontSize: 12, color: 'var(--au-text3)' }}>{T.makeField}: לחצו על שדה ברשימה</span><Button size="sm" variant="ghost" onClick={() => setNewF({ label: sel.text.slice(0, 40).replace(/_+/g, '').trim(), type: 'text', required: true, forSel: true })}>{T.newField}</Button><button type="button" className="te-ib" onClick={() => setSel(null)} aria-label={T.ignore}><X size={13}/></button></div>}
            {sugg.length > 0 && <div className="te-block"><div className="te-block-bar"><Wand2 size={13}/> {T.sugg} ({sugg.length})<span className="sp"/><Button size="sm" variant="soft-green" onClick={applyAll} disabled={!sugg.some(s => s.key)}>{T.applyAll}</Button><button type="button" className="te-ib" onClick={() => setSugg([])} aria-label={T.ignore}><X size={13}/></button></div>
              <div className="te-sugg">{sugg.slice(0, 20).map((s, i) => <button key={i} type="button" onClick={() => s.key ? applySugg(s) : setNewF({ label: '', type: 'text', required: true, forSugg: s })}><Check size={12}/><span>{s.key ? STANDARD_FIELDS[s.key]?.label : 'שדה חדש למילוי'}</span><i>"{s.found.slice(0, 24)}"</i><span style={{ color: 'var(--au-text3)', marginInlineStart: 'auto', fontSize: 11 }}>פסקה {s.block + 1}</span></button>)}</div></div>}
            {tp.blocks.map((b, i) => (
              <div key={i} className={`te-block${curBlock === i ? ' on' : ''}`} onFocus={() => setCurBlock(i)}>
                <div className="te-block-bar">
                  {Object.entries(T.block).map(([k, v]) => <button key={k} type="button" className={`te-kind${b.t === k ? ' on' : ''}`} onClick={() => setBlock(i, { t: k, ...(k === 'clause' && !b.title ? { title: '' } : {}) })}>{v}</button>)}
                  <span className="sp"/>
                  <button type="button" className="te-ib" title={T.up} aria-label={T.up} onClick={() => move(i, -1)}><ChevronUp size={14}/></button>
                  <button type="button" className="te-ib" title={T.down} aria-label={T.down} onClick={() => move(i, 1)}><ChevronDown size={14}/></button>
                  <button type="button" className="te-ib" title={T.addBlock} aria-label={`${T.addBlock} +`} onClick={() => addBlock(i)}><Plus size={14}/></button>
                  <button type="button" className="te-ib" title={T.del} aria-label={T.del} onClick={() => delBlock(i)}><Trash2 size={13}/></button>
                </div>
                {b.t === 'clause' && <input className="te-input te-title" value={b.title || ''} placeholder={T.clauseTitle} onChange={e => setBlock(i, { title: e.target.value })} aria-label={T.clauseTitle}/>}
                <textarea ref={el => { taRefs.current[i] = el }} className={`te-ta${b.t === 'h' ? ' te-title' : ''}`} value={b.text} rows={b.t === 'h' ? 1 : Math.min(12, Math.max(2, Math.ceil(b.text.length / 90)))} onChange={e => setBlock(i, { text: e.target.value })} onSelect={() => onSelect(i)} onMouseUp={() => onSelect(i)} onKeyUp={() => onSelect(i)} aria-label={`${T.block[b.t]} ${i + 1}`} dir="rtl"/>
              </div>
            ))}
            {!tp.blocks.length && <button type="button" className="te-chip" style={{ justifyContent: 'center' }} onClick={() => addBlock(-1)}><Plus size={13}/>{T.addBlock}</button>}
            <p style={{ margin: 0, fontSize: 12, color: 'var(--au-text3)' }}>{T.legal}</p>
          </section>
          <aside className="te-pane te-props">
            <div className="te-h">{T.tpl}</div>
            <Field label={T.name}><input className="te-input" value={tp.name} onChange={e => setTp(t => ({ ...t, name: e.target.value }))} aria-label={T.name}/></Field>
            <Field label={T.title}><input className="te-input" value={tp.title} onChange={e => setTp(t => ({ ...t, title: e.target.value }))} aria-label={T.title}/></Field>
            <div className="te-h">{T.sections}</div>
            {['parties', 'property', 'fees', 'signatures'].map(k => <label key={k} className="te-tog"><input type="checkbox" checked={!!tp.sections[k]} onChange={e => setTp(t => ({ ...t, sections: { ...t.sections, [k]: e.target.checked } }))}/>{T[k]}</label>)}
            <div className="te-h">{T.field}</div>
            {field ? <>
              <Field label={T.label}><input className="te-input" value={field.label} onChange={e => setField(field.key, { label: e.target.value })} aria-label={T.label}/></Field>
              <Field label={T.key}><span className="te-ph">{`{${field.key}}`}</span></Field>
              <Field label={T.type}><select className="te-input" value={field.type} onChange={e => setField(field.key, { type: e.target.value })} aria-label={T.type}>{Object.entries(FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              {field.type === 'select' && <Field label={T.options}><input className="te-input" value={(field.options || []).join(', ')} onChange={e => setField(field.key, { options: e.target.value.split(/[,\n]/).map(x => x.trim()).filter(Boolean) })} aria-label={T.options}/></Field>}
              <label className="te-tog"><input type="checkbox" checked={!!field.required} onChange={e => setField(field.key, { required: e.target.checked })}/>{T.required}</label>
              <Field label={T.def}><input className="te-input" value={field.default || ''} onChange={e => setField(field.key, { default: e.target.value })} aria-label={T.def}/></Field>
              <Field label={T.hint}><input className="te-input" value={field.hint || ''} onChange={e => setField(field.key, { hint: e.target.value })} aria-label={T.hint}/></Field>
              <Button size="sm" variant="ghost" icon={<Plus size={12}/>} onClick={() => insertKey(field.key)}>{T.insert}</Button>
              <Button size="sm" variant="danger" icon={<Trash2 size={12}/>} onClick={() => removeField(field.key)}>{T.removeField}</Button>
            </> : stdCur ? <div style={{ fontSize: 12.5, color: 'var(--au-text2)', lineHeight: 1.6 }}><b>{stdCur.label}</b><br/><span className="te-ph">{`{${stdCur.key}}`}</span><br/>{T.stdInfo}</div> : <div style={{ fontSize: 12.5, color: 'var(--au-text3)' }}>בחרו שדה ברשימה, או סמנו טקסט במסמך והפכו אותו לשדה.</div>}
          </aside>
        </div>
      )}
      {newF && <Modal open onClose={() => setNewF(null)} title={T.add} dir="rtl" width={460} footer={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}><Button variant="plain" onClick={() => setNewF(null)}>{T.cancel}</Button><Button variant="solid" disabled={!newF.label.trim()} onClick={() => { const key = addField({ ...newF, key: newF.key && /^[A-Z][A-Z0-9_]{1,40}$/.test(newF.key) ? newF.key : '' }); if (newF.forSel && sel) { setBlock(sel.block, { text: applyField(tp.blocks[sel.block].text, sel.start, sel.end, key) }); setSel(null) } if (newF.forSugg) applySugg(newF.forSugg, key); setNewF(null) }}>{T.add}</Button></div>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label={T.label}><input className="te-input" autoFocus value={newF.label} onChange={e => setNewF(x => ({ ...x, label: e.target.value }))} aria-label={T.label}/></Field>
          <Field label={T.key} hint="אותיות באנגלית, מספרים וקו תחתון; ריק = נקבע מהתווית"><input className="te-input" dir="ltr" value={newF.key || ''} onChange={e => setNewF(x => ({ ...x, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))} aria-label={T.key}/></Field>
          <Field label={T.type}><select className="te-input" value={newF.type} onChange={e => setNewF(x => ({ ...x, type: e.target.value }))} aria-label={T.type}>{Object.entries(FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          {newF.type === 'select' && <Field label={T.options}><input className="te-input" value={(newF.options || []).join(', ')} onChange={e => setNewF(x => ({ ...x, options: e.target.value.split(/[,\n]/).map(s => s.trim()).filter(Boolean) }))} aria-label={T.options}/></Field>}
          <label className="te-tog"><input type="checkbox" checked={!!newF.required} onChange={e => setNewF(x => ({ ...x, required: e.target.checked }))}/>{T.required}</label>
        </div>
      </Modal>}
      {toasts}
    </div>
  )
}
export const TemplateIcons = { Type, Hash, ListOrdered }
