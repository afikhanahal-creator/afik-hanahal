// "ניהול קמפיינים" — the Lead Center's campaigns, the office's way (2026-11-18): pick campaigns and merge them under one name,
// rename one, take a Meta campaign back out of a merge, fold old campaigns into the archive (their leads stay). Changes are
// saved at once for every screen (src/lib/campaignNamesStore.js → /api/meta/campaign-names) with "בטל" for 8 s.
// Only the Lead Center's names change — Meta keeps its own campaign names. Rules: lib/campaign-groups.js (tested).
import { useState, useMemo, useEffect, useRef } from 'react'
import { Modal, Button, IconButton } from './automationsUI.jsx'
import { Pencil, Archive, ArchiveRestore, Undo2, Filter, Merge, Search, ChevronDown, Check, X } from 'lucide-react'
import { campaignGroups, invertCampaignOps, mergeSuggestion, cleanLabel } from '../lib/campaign-groups.js'
import { useCampaignCfg, campaignOps, campaignCfgNow } from './lib/campaignNamesStore.js'
import { shortCampaign } from './lib/leadFields.js'

const TX = {
  he: {
    title: 'ניהול קמפיינים', hint: 'סמנו קמפיינים כדי למזג אותם לשם אחד, ערכו שם, או העבירו קמפיין ישן לארכיון. השמות משתנים רק במרכז הלידים — במטא הקמפיינים נשארים כמו שהם, והלידים לא זזים.',
    search: 'חיפוש קמפיין…', leads: 'לידים', last30: 'ב-30 יום', last: 'אחרון', metaNames: n => `${n} קמפיינים במטא`, ownName: 'שם שלכם',
    rename: 'שינוי שם', filter: 'הצגת הלידים שלו', archive: 'העברה לארכיון', unarchive: 'החזרה מהארכיון', reset: 'חזרה לשם של מטא',
    takeOut: 'הוצאה מהמיזוג', archived: n => `בארכיון (${n})`, none: 'אין קמפיינים', noMatch: 'לא נמצא קמפיין',
    selected: n => `${n} נבחרו`, merge: 'מיזוג', mergeN: n => `מיזוג ${n} קמפיינים`, clear: 'ביטול בחירה', archiveSel: 'לארכיון', unarchiveSel: 'החזרה מהארכיון',
    mergeName: 'השם המאוחד', mergeHint: 'בחרו אחד מהשמות או כתבו שם חדש', save: 'שמירה', cancel: 'ביטול', willJoin: n => `יאוחד עם הקמפיין "${n}"`,
    merged: (n, name) => `${n} קמפיינים אוחדו ל-"${name}"`, renamed: n => `השם שונה ל-"${n}"`, archivedT: 'הועבר לארכיון', restored: 'הוחזר מהארכיון', resetT: 'חזר לשם של מטא',
    undo: 'בטל', failed: 'השמירה נכשלה, נסו שוב', close: 'סגירה', pickTwo: 'סמנו לפחות שני קמפיינים כדי למזג',
  },
  en: {
    title: 'Manage campaigns', hint: 'Select campaigns to merge them under one name, rename one, or move an old campaign to the archive. Names change only in the Lead Center — Meta keeps its campaigns as they are and no lead moves.',
    search: 'Search campaigns…', leads: 'leads', last30: 'in 30 days', last: 'last', metaNames: n => `${n} Meta campaigns`, ownName: 'Your name',
    rename: 'Rename', filter: 'Show its leads', archive: 'Archive', unarchive: 'Restore', reset: 'Back to Meta\'s name',
    takeOut: 'Take out of the merge', archived: n => `Archived (${n})`, none: 'No campaigns', noMatch: 'No campaign found',
    selected: n => `${n} selected`, merge: 'Merge', mergeN: n => `Merge ${n} campaigns`, clear: 'Clear', archiveSel: 'Archive', unarchiveSel: 'Restore',
    mergeName: 'Merged name', mergeHint: 'Pick one of the names or type a new one', save: 'Save', cancel: 'Cancel', willJoin: n => `Will join "${n}"`,
    merged: (n, name) => `${n} campaigns merged into "${name}"`, renamed: n => `Renamed to "${n}"`, archivedT: 'Archived', restored: 'Restored', resetT: 'Back to Meta\'s name',
    undo: 'Undo', failed: 'Saving failed, try again', close: 'Close', pickTwo: 'Select at least two campaigns to merge',
  },
}

const CSS = `
.cm{display:flex;flex-direction:column;gap:12px}
.cm-hint{margin:0;font-size:12.5px;line-height:1.6;color:var(--au-text2)}
.cm-search{display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-radius:10px;border:1px solid var(--au-line);background:rgba(var(--ov),.03)}
.cm-search input{flex:1;min-width:0;border:none;background:none;outline:none;color:var(--au-text);font:inherit;font-size:14px;height:100%;padding:0}
.cm-list{display:flex;flex-direction:column;border:1px solid var(--au-line);border-radius:12px;overflow:hidden}
.cm-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:10px;align-items:start;padding:11px 12px;border-top:1px solid var(--au-line);background:var(--au-s2)}
.cm-row:first-child{border-top:none}
.cm-row.sel{background:rgba(var(--brand-rgb),.08)}
.cm-row.arch{opacity:.72}
.cm-chk{width:20px;height:20px;margin-top:1px;border-radius:6px;border:1.5px solid rgba(var(--ink),.35);background:transparent;display:grid;place-items:center;cursor:pointer;padding:0;min-height:0;min-width:0;color:#fff}
.cm-chk.on{background:var(--au-brand);border-color:var(--au-brand)}
.cm-name{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:14.5px;font-weight:700;color:var(--au-text);line-height:1.35}
.cm-dot{width:8px;height:8px;border-radius:50%;flex:none}
.cm-tag{font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(var(--brand-rgb),.12);color:var(--au-brand-text)}
.cm-meta{font-size:12px;color:var(--au-text3);margin-top:3px;font-feature-settings:"tnum"}
.cm-raws{margin-top:6px;display:flex;flex-direction:column;gap:3px}
.cm-raws-btn{display:inline-flex;align-items:center;gap:4px;margin-top:5px;border:none;background:none;padding:0;color:var(--au-text3);font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;min-height:0;min-width:0}
.cm-raw{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--au-text2)}
.cm-raw span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm-raw b{font-weight:600;color:var(--au-text3);font-feature-settings:"tnum"}
.cm-raw button{border:none;background:none;color:var(--au-text3);cursor:pointer;padding:2px;min-height:0;min-width:0;display:inline-flex;border-radius:5px}
.cm-raw button:hover{color:var(--au-red-text);background:rgba(224,82,82,.1)}
.cm-acts{display:flex;gap:2px;align-items:center}
.cm-edit{display:flex;flex-direction:column;gap:6px;margin-top:2px}
.cm-edit input,.cm-merge input{height:40px;border-radius:9px;border:1px solid rgba(var(--brand-rgb),.45);background:var(--au-s1);color:var(--au-text);font:inherit;font-size:14px;padding:0 11px;outline:none;width:100%}
.cm-edit-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cm-warn{font-size:11.5px;color:var(--au-amber-text);font-weight:600}
.cm-sec{display:flex;align-items:center;gap:6px;border:none;background:none;padding:6px 2px;color:var(--au-text2);font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;min-height:0;min-width:0}
.cm-empty{padding:18px;text-align:center;font-size:13px;color:var(--au-text3)}
.cm-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:100%}
.cm-foot .cm-count{font-size:13px;font-weight:800;color:var(--au-text);margin-inline-end:auto}
.cm-merge{display:flex;flex-direction:column;gap:8px;width:100%}
.cm-merge label{font-size:12px;font-weight:700;color:var(--au-text2)}
.cm-chips{display:flex;gap:6px;flex-wrap:wrap}
.cm-chip{height:30px;padding:0 11px;border-radius:999px;border:1px solid var(--au-line);background:transparent;color:var(--au-text2);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;min-height:0;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm-chip.on{border-color:var(--au-brand);background:rgba(var(--brand-rgb),.12);color:var(--au-brand-text)}
.cm-note{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(var(--brand-rgb),.1);font-size:13px;font-weight:600;color:var(--au-text)}
.cm-note.err{background:rgba(224,82,82,.12);color:var(--au-red-text)}
.cm-note button{margin-inline-start:auto;border:none;background:none;color:var(--au-brand-text);font:inherit;font-weight:800;cursor:pointer;min-height:0;min-width:0;padding:0}
@media (max-width:640px){
  .cm-row{grid-template-columns:26px minmax(0,1fr);}
  .cm-acts{grid-column:2;justify-content:flex-start;margin-inline-start:-6px}
  .cm-search input,.cm-edit input,.cm-merge input{font-size:16px}
}`

const COLORS = ['#6F7AC7', '#25D366', '#F5A623', '#60A5FA', '#E05252', '#A78BFA', '#2DD4BF', '#F472B6']
const shortDate = ts => { if (!ts) return '—'; const d = new Date(ts); return `${d.getDate()}.${d.getMonth() + 1}` }

export default function CampaignManager({ open, onClose, leads = [], isTest = () => false, lang = 'he', onFilter }) {
  const t = TX[lang] || TX.he
  const dir = lang === 'en' ? 'ltr' : 'rtl'
  const cfg = useCampaignCfg()
  const groups = useMemo(() => campaignGroups(leads, cfg, { short: shortCampaign, isTest }), [leads, cfg, isTest])
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(() => new Set())
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [merging, setMerging] = useState(false)
  const [mergeName, setMergeName] = useState('')
  const [showArch, setShowArch] = useState(false)
  const [rawsOpen, setRawsOpen] = useState(() => new Set())
  const [note, setNote] = useState(null)       // { text, undo?: ops, err? }
  const noteTimer = useRef(0)

  useEffect(() => { if (!open) { setSel(new Set()); setEditing(null); setMerging(false); setQ(''); setNote(null) } }, [open])
  // a merged / renamed name leaves the selection
  useEffect(() => { setSel(s => { const live = new Set(groups.map(g => g.label)); const n = new Set([...s].filter(x => live.has(x))); return n.size === s.size ? s : n }) }, [groups])

  const ql = q.trim().toLowerCase()
  const match = g => !ql || g.label.toLowerCase().includes(ql) || g.raws.some(r => r.raw.toLowerCase().includes(ql))
  const live = groups.filter(g => !g.archived && match(g))
  const arch = groups.filter(g => g.archived && match(g))
  const selected = groups.filter(g => sel.has(g.label))
  const color = label => COLORS[Math.max(0, groups.findIndex(g => g.label === label)) % COLORS.length]

  const flash = (n) => { clearTimeout(noteTimer.current); setNote(n); noteTimer.current = setTimeout(() => setNote(null), n.err ? 6000 : 8000) }
  const run = async (ops, text) => {
    const before = campaignCfgNow()
    const undo = invertCampaignOps(before, ops)
    try { const p = campaignOps(ops); flash({ text, undo }); await p }
    catch { flash({ text: t.failed, err: true }) }
  }
  const undo = async ops => { setNote(null); try { await campaignOps(ops) } catch { flash({ text: t.failed, err: true }) } }

  const toggle = label => setSel(s => { const n = new Set(s); n.has(label) ? n.delete(label) : n.add(label); return n })
  const startRename = g => { setEditing(g.label); setEditVal(g.label); setMerging(false) }
  const saveRename = g => {
    const name = cleanLabel(editVal)
    setEditing(null)
    if (!name || name === g.label) return
    const backToMeta = g.raws.every(r => cleanLabel(shortCampaign(r.raw)) === name)
    run([{ op: 'map', raws: g.raws.map(r => r.raw), name: backToMeta ? '' : name, from: [g.label] }], t.renamed(name))
  }
  const resetGroup = g => run([{ op: 'map', raws: g.raws.map(r => r.raw), name: '' }], t.resetT)
  const takeOut = (g, raw) => run([{ op: 'map', raws: [raw], name: '' }], t.resetT)
  const setArch = (labels, on) => run(labels.map(label => ({ op: 'archive', label, on })), on ? t.archivedT : t.restored)
  const openMerge = () => { setMergeName(mergeSuggestion(selected)); setMerging(true); setEditing(null) }
  const doMerge = () => {
    const name = cleanLabel(mergeName)
    if (!name || selected.length < 2) return
    const n = selected.length
    run([{ op: 'map', raws: selected.flatMap(g => g.raws.map(r => r.raw)), name, from: selected.map(g => g.label) }], t.merged(n, name))
    setSel(new Set()); setMerging(false)
  }
  const joinWarn = (val, own) => { const v = cleanLabel(val); return v && v !== own && groups.some(g => g.label === v) ? t.willJoin(v) : '' }

  const row = g => {
    const on = sel.has(g.label)
    const ed = editing === g.label
    const showRaws = g.raws.length > 1 || g.renamed
    const rawsVisible = rawsOpen.has(g.label)
    return (
      <div key={g.label} className={`cm-row${on ? ' sel' : ''}${g.archived ? ' arch' : ''}`}>
        <button type="button" className={`cm-chk${on ? ' on' : ''}`} role="checkbox" aria-checked={on} aria-label={g.label} onClick={() => toggle(g.label)}>{on && <Check size={13} strokeWidth={3}/>}</button>
        <div style={{ minWidth: 0 }}>
          {ed ? (
            <div className="cm-edit">
              <input autoFocus value={editVal} maxLength={60} aria-label={t.rename} onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveRename(g) } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditing(null) } }}/>
              {joinWarn(editVal, g.label) && <span className="cm-warn">{joinWarn(editVal, g.label)}</span>}
              <div className="cm-edit-row">
                <Button size="sm" variant="brand" onClick={() => saveRename(g)} icon={<Check size={13}/>}>{t.save}</Button>
                <Button size="sm" onClick={() => setEditing(null)}>{t.cancel}</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="cm-name"><span className="cm-dot" style={{ background: color(g.label) }}/><bdi>{g.label}</bdi>{g.renamed && <span className="cm-tag">{t.ownName}</span>}</div>
              <div className="cm-meta">{g.count} {t.leads} · {g.recent} {t.last30} · {t.last} {shortDate(g.last)}</div>
              {showRaws && (
                <>
                  <button type="button" className="cm-raws-btn" aria-expanded={rawsVisible} onClick={() => setRawsOpen(s => { const n = new Set(s); n.has(g.label) ? n.delete(g.label) : n.add(g.label); return n })}>
                    {t.metaNames(g.raws.length)}<ChevronDown size={13} style={{ transform: rawsVisible ? 'rotate(180deg)' : 'none' }}/>
                  </button>
                  {rawsVisible && (
                    <div className="cm-raws">
                      {g.raws.map(r => (
                        <div key={r.raw} className="cm-raw" title={r.raw}>
                          <span><bdi>{r.raw}</bdi></span><b>{r.count}</b>
                          {g.renamed && cfg.names[r.raw] && g.raws.length > 1 && <button type="button" title={t.takeOut} aria-label={`${t.takeOut}: ${r.raw}`} onClick={() => takeOut(g, r.raw)}><X size={12}/></button>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
        {!ed && (
          <div className="cm-acts">
            <IconButton size={34} label={t.rename} icon={<Pencil size={15}/>} onClick={() => startRename(g)}/>
            {onFilter && <IconButton size={34} label={t.filter} icon={<Filter size={15}/>} onClick={() => { onFilter(g.label); onClose() }}/>}
            {g.renamed && <IconButton size={34} label={t.reset} icon={<Undo2 size={15}/>} onClick={() => resetGroup(g)}/>}
            <IconButton size={34} label={g.archived ? t.unarchive : t.archive} icon={g.archived ? <ArchiveRestore size={15}/> : <Archive size={15}/>} onClick={() => setArch([g.label], !g.archived)}/>
          </div>
        )}
      </div>
    )
  }

  const allArch = selected.length > 0 && selected.every(g => g.archived)
  const footer = merging ? (
    <div className="cm-merge">
      <label htmlFor="cm-merge-name">{t.mergeName} · <span style={{ fontWeight: 500, color: 'var(--au-text3)' }}>{t.mergeHint}</span></label>
      <div className="cm-chips">
        {selected.map(g => <button key={g.label} type="button" className={`cm-chip${cleanLabel(mergeName) === g.label ? ' on' : ''}`} onClick={() => setMergeName(g.label)}><bdi>{g.label}</bdi> · {g.count}</button>)}
      </div>
      <input id="cm-merge-name" value={mergeName} maxLength={60} onChange={e => setMergeName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doMerge() } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMerging(false) } }}/>
      <div className="cm-foot">
        <Button variant="brand" onClick={doMerge} disabled={!cleanLabel(mergeName)} icon={<Merge size={14}/>}>{t.mergeN(selected.length)}</Button>
        <Button onClick={() => setMerging(false)}>{t.cancel}</Button>
      </div>
    </div>
  ) : sel.size > 0 ? (
    <div className="cm-foot">
      <span className="cm-count">{t.selected(sel.size)}</span>
      <Button variant="brand" onClick={openMerge} disabled={sel.size < 2} title={sel.size < 2 ? t.pickTwo : undefined} icon={<Merge size={14}/>}>{t.merge}</Button>
      <Button onClick={() => { setArch(selected.map(g => g.label), !allArch); setSel(new Set()) }} icon={allArch ? <ArchiveRestore size={14}/> : <Archive size={14}/>}>{allArch ? t.unarchiveSel : t.archiveSel}</Button>
      <Button variant="plain" onClick={() => setSel(new Set())}>{t.clear}</Button>
    </div>
  ) : null

  return (
    <Modal open={open} onClose={onClose} title={t.title} width={680} dir={dir} footer={footer}>
      <style>{CSS}</style>
      <div className="cm">
        <p className="cm-hint">{t.hint}</p>
        {note && <div className={`cm-note${note.err ? ' err' : ''}`} role="status"><span>{note.text}</span>{note.undo?.length ? <button type="button" onClick={() => undo(note.undo)}>{t.undo}</button> : null}</div>}
        <div className="cm-search"><Search size={15} style={{ color: 'var(--au-text3)', flex: 'none' }}/><input value={q} placeholder={t.search} aria-label={t.search} onChange={e => setQ(e.target.value)}/></div>
        {groups.length === 0 ? <div className="cm-empty">{t.none}</div> : (
          <>
            {live.length > 0 ? <div className="cm-list">{live.map(row)}</div> : (!arch.length && <div className="cm-empty">{t.noMatch}</div>)}
            {arch.length > 0 && (
              <>
                <button type="button" className="cm-sec" aria-expanded={showArch || !!ql} onClick={() => setShowArch(v => !v)}>
                  <ChevronDown size={14} style={{ transform: showArch || ql ? 'none' : 'rotate(-90deg)' }}/>{t.archived(arch.length)}
                </button>
                {(showArch || !!ql) && <div className="cm-list">{arch.map(row)}</div>}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
