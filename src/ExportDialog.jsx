// "ייצוא לאקסל" on the leads board: which contacts (selected / the list on screen / everyone / one stage / one campaign),
// which file — the CRM list as Excel (.xlsx, columns to choose) or a Meta customer list (CSV in Meta's format, for a
// Custom Audience and a Lookalike Audience in Ads Manager) — and a short note of what went in. Everything is built in the
// browser from the leads already loaded (lib/contacts-export.js); nothing is sent anywhere.
import { useEffect, useMemo, useState } from 'react'
import { Modal, Button } from './automationsUI.jsx'
import { EXPORT_COLUMNS, DEFAULT_COLUMNS, contactsWorkbook, metaAudienceCsv, exportFileName } from '../lib/contacts-export.js'
import { leadCampaign } from './lib/leadFields.js'

const COLS_KEY = 'afik_export_cols_v1'
const people = n => (n === 1 ? 'איש קשר אחד' : `${n} אנשי קשר`)
const readCols = () => { try { const v = JSON.parse(localStorage.getItem(COLS_KEY) || 'null'); return Array.isArray(v) && v.length ? v : DEFAULT_COLUMNS } catch { return DEFAULT_COLUMNS } }
function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export default function ExportDialog({ open, onClose, leads = [], filtered = [], selectedIds = new Set(), stages = [], stageName = x => x, searching = false, lang = 'he' }) {
  const selected = useMemo(() => leads.filter(l => selectedIds.has(l.id)), [leads, selectedIds])
  const campaigns = useMemo(() => [...new Set(leads.map(l => leadCampaign(l)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'he')), [leads])
  const [scope, setScope] = useState('all')
  const [stage, setStage] = useState('')
  const [camp, setCamp] = useState('')
  const [kind, setKind] = useState('xlsx')       // xlsx · meta
  const [cols, setCols] = useState(readCols)
  const [optOut, setOptOut] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => { if (open) { setScope(selected.length ? 'selected' : searching ? 'filtered' : 'all'); setDone(null); setErr('') } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(COLS_KEY, JSON.stringify(cols)) } catch {} }, [cols])

  const list = scope === 'selected' ? selected : scope === 'filtered' ? filtered
    : scope === 'stage' ? leads.filter(l => (l.leadStatus || 'new') === stage)
    : scope === 'campaign' ? leads.filter(l => leadCampaign(l) === camp) : leads
  const scopes = [
    ['selected', `רק הנבחרים (${selected.length})`, !selected.length],
    ['filtered', `הרשימה שעל המסך (${filtered.length})`, !searching],
    ['all', `כל אנשי הקשר (${leads.length})`, false],
    ['stage', 'שלב בפייפליין', false],
    ['campaign', 'קמפיין', !campaigns.length],
  ]
  const run = async () => {
    setErr(''); setDone(null)
    if (!list.length) { setErr('אין אנשי קשר בבחירה הזו.'); return }
    setBusy(true)
    await new Promise(r => setTimeout(r, 30))   // the "preparing…" state paints first
    try {
      if (kind === 'meta') {
        const r = metaAudienceCsv(list, { includeOptOut: optOut })
        if (!r.rows.length) throw new Error('לאף איש קשר בבחירה אין טלפון או אימייל תקינים.')
        download('﻿' + r.csv, exportFileName('meta'), 'text/csv;charset=utf-8')
        setDone({ n: r.rows.length, notes: [r.dupes && `${r.dupes} כפילויות אוחדו`, r.skipped && `${r.skipped} בלי טלפון או אימייל תקינים`, r.optedOut && `${r.optedOut} שביקשו לא לקבל הודעות לא נכללו`].filter(Boolean) })
      } else {
        if (!cols.length) throw new Error('בחרו לפחות עמודה אחת.')
        const order = EXPORT_COLUMNS.map(c => c.key).filter(k => cols.includes(k))
        download(contactsWorkbook(list, { columns: order, stageName }), exportFileName('xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        setDone({ n: list.length, notes: [] })
      }
    } catch (e) { setErr(e.message || 'הייצוא נכשל, נסו שוב.') }
    setBusy(false)
  }
  const opt = (on, children, onClick, disabled) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'start', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${on ? 'var(--au-brand)' : 'var(--au-s3-line)'}`, background: on ? 'rgba(var(--brand-rgb),.08)' : 'transparent', color: 'var(--au-text)', font: 'inherit', fontSize: 13.5, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .45 : 1 }}>
      <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? 'var(--au-brand)' : 'var(--au-s3-line)'}`, boxShadow: on ? 'inset 0 0 0 3px var(--au-s2), inset 0 0 0 8px var(--au-brand)' : 'none', flexShrink: 0 }}/>
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </button>
  )
  const sel = { height: 34, borderRadius: 9, border: '1px solid var(--au-s3-line)', background: 'var(--au-s2)', color: 'var(--au-text)', font: 'inherit', fontSize: 13, padding: '0 8px', marginInlineStart: 8 }
  return (
    <Modal open={open} onClose={onClose} title="ייצוא אנשי קשר" width={720} dir="rtl"
      footer={<div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
        <span style={{ fontSize: 12.5, color: 'var(--au-text3)', flex: 1 }}>{people(list.length)} · {kind === 'meta' ? 'קובץ CSV לפייסבוק' : `קובץ Excel · ${cols.length} עמודות`}</span>
        <Button onClick={onClose}>סגירה</Button>
        <Button variant="brand" style={{ background: 'var(--au-brand)', borderColor: 'var(--au-brand)', color: '#fff' }} onClick={run} loading={busy} disabled={busy || !list.length}>{busy ? 'מכין את הקובץ…' : kind === 'meta' ? 'הורדת קובץ הקהל' : 'הורדת קובץ Excel'}</Button>
      </div>}>
      <div style={{ display: 'grid', gap: 18 }}>
        <section>
          <h4 style={{ margin: '0 0 8px', fontSize: 13.5 }}>אילו אנשי קשר</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
            {scopes.map(([id, label, disabled]) => opt(scope === id, <>
              {label}
              {id === 'stage' && scope === 'stage' && <select style={sel} value={stage} onClick={e => e.stopPropagation()} onChange={e => setStage(e.target.value)} aria-label="שלב">
                <option value="">בחרו שלב</option>{stages.map(g => <option key={g.id} value={g.id}>{stageName(g.id)} ({leads.filter(l => (l.leadStatus || 'new') === g.id).length})</option>)}
              </select>}
              {id === 'campaign' && scope === 'campaign' && <select style={sel} value={camp} onClick={e => e.stopPropagation()} onChange={e => setCamp(e.target.value)} aria-label="קמפיין">
                <option value="">בחרו קמפיין</option>{campaigns.map(c => <option key={c} value={c}>{c} ({leads.filter(l => leadCampaign(l) === c).length})</option>)}
              </select>}
            </>, () => setScope(id), disabled))}
          </div>
        </section>

        <section>
          <h4 style={{ margin: '0 0 8px', fontSize: 13.5 }}>איזה קובץ</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {opt(kind === 'xlsx', <><b>רשימת אנשי קשר ל-Excel</b><div style={{ fontSize: 12, color: 'var(--au-text2)', marginTop: 2 }}>כל הפרטים שבחרתם, כותרות בעברית, טלפונים נשמרים כטקסט (עם ה-0 בהתחלה). מתאים לסינון, לשליחת הודעות ולגיבוי.</div></>, () => setKind('xlsx'))}
            {opt(kind === 'meta', <><b>קהל לפייסבוק ואינסטגרם (Custom Audience / Lookalike)</b><div style={{ fontSize: 12, color: 'var(--au-text2)', marginTop: 2 }}>קובץ CSV במבנה ש-Meta מקבלת: אימייל, טלפון עם קידומת 972, שם פרטי, שם משפחה, עיר ומדינה. כפילויות מאוחדות, בלי פרטים אחרים.</div></>, () => setKind('meta'))}
          </div>
        </section>

        {kind === 'xlsx' ? (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 13.5, flex: 1 }}>עמודות ({cols.length})</h4>
              <Button size="sm" onClick={() => setCols(EXPORT_COLUMNS.map(c => c.key))}>הכל</Button>
              <Button size="sm" onClick={() => setCols(DEFAULT_COLUMNS)}>ברירת מחדל</Button>
              <Button size="sm" onClick={() => setCols([])}>ניקוי</Button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '6px 12px' }}>
              {EXPORT_COLUMNS.map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '4px 0' }}>
                  <input type="checkbox" checked={cols.includes(c.key)} onChange={e => setCols(v => e.target.checked ? [...v, c.key] : v.filter(k => k !== c.key))}
                    style={{ appearance: 'auto', WebkitAppearance: 'checkbox', width: 16, height: 16, accentColor: 'var(--au-brand)' }}/>{c.he}
                </label>
              ))}
            </div>
          </section>
        ) : (
          <section style={{ fontSize: 12.5, color: 'var(--au-text2)', lineHeight: 1.7, background: 'rgba(var(--ov),.04)', borderRadius: 12, padding: '12px 14px' }}>
            <b style={{ color: 'var(--au-text)' }}>איך משתמשים בקובץ:</b> ב-Meta Ads Manager → קהלים → יצירת קהל → קהל מותאם אישית → רשימת לקוחות → העלאת הקובץ (Meta מצפינה את הפרטים לפני ההתאמה). מהקהל שנוצר אפשר ליצור "קהל דומה" (Lookalike) בישראל. הקובץ עצמו לא יוצר קהל ולא נשלח לשום מקום; ההעלאה נעשית אצלכם, בהתאם למדיניות של Meta ולהסכמה של אנשי הקשר.
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, color: 'var(--au-text)', cursor: 'pointer' }}>
              <input type="checkbox" checked={optOut} onChange={e => setOptOut(e.target.checked)} style={{ appearance: 'auto', WebkitAppearance: 'checkbox', width: 16, height: 16, accentColor: 'var(--au-brand)' }}/>
              לכלול גם מי שביקשו לא לקבל מאיתנו הודעות (כברירת מחדל הם לא נכללים)
            </label>
          </section>
        )}

        {err && <div role="alert" style={{ color: 'var(--au-red-text)', fontSize: 13 }}>{err}</div>}
        {done && <div role="status" style={{ color: 'var(--au-green-text)', fontSize: 13, background: 'rgba(34,197,94,.08)', borderRadius: 10, padding: '10px 12px' }}>
          ✓ הקובץ ירד, {people(done.n)}.{done.notes.length ? ` (${done.notes.join(' · ')})` : ''}
        </div>}
      </div>
    </Modal>
  )
}
