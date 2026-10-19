// Admin → "תוכן האתר" (/admin-panel/content): edit the homepage content (content/home.json) in a form, next to the
// real homepage in a preview frame (/?cms-preview=1) that receives the draft by postMessage as you type.
// Phase 2 of ADMIN-SPEC.md: the draft autosaves in this browser only — publishing (GitHub commit + rebuild),
// history and the translate button come in phase 3. Field rules (lengths, list sizes) are lib/home-content.js;
// the form layout is src/contentEditorSchema.js.
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'
import PUBLISHED from '../content/home.json'
import { validateHome, fieldLimit, listBounds, diffHome, HOME_ICONS } from '../lib/home-content.js'
import { CONTENT_AREAS, newItem } from './contentEditorSchema.js'
import { T, AUTO_CSS, Button, IconButton, Toggle, useToasts, ConfirmProvider, useConfirm } from './automationsUI.jsx'
import { FaSearch, FaBalanceScale, FaMoneyBill, FaHandshake, FaFileAlt, FaTrophy, FaChartLine, FaEye, FaHardHat, FaKey,
  FaChevronDown, FaGripVertical, FaArrowUp, FaArrowDown, FaClone, FaTrash, FaPlus, FaPen, FaMobileAlt, FaDesktop,
  FaExclamationTriangle, FaMoon, FaSun, FaRedo, FaCloudUploadAlt, FaCheckCircle, FaUndo } from 'react-icons/fa'

const ICONS = { FaSearch, FaBalanceScale, FaMoneyBill, FaHandshake, FaFileAlt, FaTrophy, FaChartLine, FaEye, FaHardHat, FaKey }
const ACCENTS = { purple: '#8490D8', green: '#82F67F' }
const DRAFT_KEY = 'afik_cms_home_draft_v1'
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

const clone = o => JSON.parse(JSON.stringify(o))
const hashOf = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h >>> 0) }
const PUBLISHED_HASH = hashOf(JSON.stringify(PUBLISHED))
const getIn = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
function setIn(obj, keys, value) {
  if (!keys.length) return value
  const [k, ...rest] = keys
  const copy = Array.isArray(obj) ? obj.slice() : { ...(obj || {}) }
  copy[k] = setIn(obj?.[k], rest, value)
  return copy
}
const moved = (arr, from, to) => { const a = arr.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a }

function loadDraft() {
  try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); if (d && d.home && d.home.hero && d.home.office) return d } catch {}
  return null
}

const TR = {
  he: {
    title: 'תוכן האתר', sub: 'דף הבית: טקסטים, רשימות ופרטי המשרד',
    clean: 'אין שינויים. זה מה שמופיע עכשיו באתר', dirty: n => `טיוטה שלא פורסמה · ${n} ${n === 1 ? 'שינוי' : 'שינויים'}`,
    saved: 'הטיוטה נשמרת אוטומטית במכשיר הזה. האתר עצמו לא משתנה עד הפרסום.',
    publish: 'פרסם', publishSoon: 'הפרסום יתווסף בשלב הבא. בינתיים הטיוטה נשמרת במכשיר הזה.',
    discard: 'בטל טיוטה', discardQ: 'לבטל את הטיוטה?', discardBody: 'כל השינויים שלא פורסמו יימחקו, והטופס יחזור למה שמופיע באתר.',
    discardOk: 'כן, לבטל', cancel: 'לא', discarded: 'הטיוטה בוטלה',
    issues: n => `${n} ${n === 1 ? 'דבר' : 'דברים'} לתקן לפני פרסום`, noIssues: 'הכול תקין לפרסום', goto: 'עבור לשדה',
    stale: 'הגרסה שבאתר עודכנה מאז שהתחלת את הטיוטה הזו.', keepDraft: 'להמשיך מהטיוטה', freshStart: 'להתחיל מהגרסה שבאתר',
    edit: 'עריכה', preview: 'תצוגה', phone: 'טלפון', desktop: 'מחשב', dark: 'כהה', light: 'בהיר', reload: 'רענן תצוגה',
    loadingPreview: 'טוען את דף הבית…', changed: n => (n === 1 ? 'שינוי 1' : `${n} שינויים`), errs: n => (n === 1 ? 'תיקון 1' : `${n} תיקונים`),
    add: what => `הוסף ${what}`, up: 'הזז למעלה', down: 'הזז למטה', dup: 'שכפל', del: 'מחק', drag: 'גרור לשינוי הסדר',
    delQ: what => `למחוק את ה${what}?`, delBody: 'אפשר לבטל מיד אחרי המחיקה.', delOk: 'מחק', deleted: what => `ה${what} נמחק`, undo: 'בטל',
    min: n => `לפחות ${n}`, max: n => `עד ${n}`, empty: '(ריק)', he: 'עברית', en: 'אנגלית', heTag: 'עב', enTag: 'EN',
    optional: 'לא חובה', photoSoon: 'העלאה מהמכשיר תתווסף בשלב התמונות. בינתיים: נתיב (/img/…) או קישור https.',
    iconPick: 'בחר אייקון', purple: 'סגול', green: 'ירוק', changedDot: 'שונה מהגרסה שבאתר',
  },
  en: {
    title: 'Site content', sub: 'Homepage: texts, lists and office details',
    clean: 'No changes. This is what the site shows now', dirty: n => `Unpublished draft · ${n} ${n === 1 ? 'change' : 'changes'}`,
    saved: 'The draft saves automatically on this device. The site itself changes only when you publish.',
    publish: 'Publish', publishSoon: 'Publishing comes in the next phase. Meanwhile the draft is kept on this device.',
    discard: 'Discard draft', discardQ: 'Discard the draft?', discardBody: 'Every unpublished change is removed and the form goes back to what the site shows.',
    discardOk: 'Yes, discard', cancel: 'No', discarded: 'Draft discarded',
    issues: n => `${n} ${n === 1 ? 'thing' : 'things'} to fix before publishing`, noIssues: 'Ready to publish', goto: 'Go to field',
    stale: 'The live version changed since you started this draft.', keepDraft: 'Keep my draft', freshStart: 'Start from the live version',
    edit: 'Edit', preview: 'Preview', phone: 'Phone', desktop: 'Desktop', dark: 'Dark', light: 'Light', reload: 'Reload preview',
    loadingPreview: 'Loading the homepage…', changed: n => `${n} changed`, errs: n => `${n} to fix`,
    add: what => `Add ${what.toLowerCase()}`, up: 'Move up', down: 'Move down', dup: 'Duplicate', del: 'Delete', drag: 'Drag to reorder',
    delQ: what => `Delete this ${what.toLowerCase()}?`, delBody: 'You can undo right after deleting.', delOk: 'Delete', deleted: what => `${what} deleted`, undo: 'Undo',
    min: n => `at least ${n}`, max: n => `up to ${n}`, empty: '(empty)', he: 'Hebrew', en: 'English', heTag: 'HE', enTag: 'EN',
    optional: 'optional', photoSoon: 'Uploading from the device comes with the images phase. For now: a path (/img/…) or an https link.',
    iconPick: 'Pick an icon', purple: 'Purple', green: 'Green', changedDot: 'Differs from the live version',
  },
}

const CE_CSS = `
  .ce{display:flex;height:100%;min-height:0;background:var(--au-page);color:${T.text};font-family:Rubik,sans-serif}
  .ce-form{width:clamp(380px,45%,640px);display:flex;flex-direction:column;min-height:0;border-inline-end:1px solid ${T.line}}
  .ce-pv{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;background:rgba(var(--ov),.03)}
  .ce.narrow{position:relative}
  .ce.narrow .ce-form,.ce.narrow .ce-pv{position:absolute;inset:0;width:100%;border:none}
  /* one pane at a time; the hidden one keeps its size (the preview stays loaded, the form keeps its scroll) */
  .ce.narrow.show-pv .ce-form,.ce.narrow:not(.show-pv) .ce-pv{visibility:hidden;pointer-events:none}
  .ce-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:12px 14px 120px}
  .ce-area{border:1px solid ${T.s1Line};background:${T.s1};border-radius:12px;margin-bottom:10px;overflow:hidden}
  .ce-area-h{width:100%;display:flex;align-items:center;gap:10px;padding:13px 14px;background:none;border:none;color:${T.text};font:inherit;font-size:14px;font-weight:700;cursor:pointer;text-align:start;min-height:48px}
  .ce-area-h:hover{background:rgba(var(--brand-rgb),.06)}
  .ce-area-b{padding:4px 14px 16px;display:flex;flex-direction:column;gap:14px}
  .ce-label{font-size:12.5px;font-weight:700;color:${T.text2};margin-bottom:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .ce-pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}
  .ce-in{position:relative}
  .ce-in input,.ce-in textarea{width:100%;box-sizing:border-box;border-radius:9px;border:1px solid ${T.s3Line};background:${T.s3};color:${T.text};font-family:inherit;font-size:14px;line-height:1.55;padding:9px 11px 9px 38px}
  .ce-in[dir=rtl] input,.ce-in[dir=rtl] textarea{padding:9px 38px 9px 11px}
  .ce-in input{height:40px}
  .ce-in textarea{resize:vertical;min-height:62px;display:block}
  .ce-in input:focus,.ce-in textarea:focus{outline:none;border-color:var(--au-brand);box-shadow:0 0 0 3px rgba(var(--brand-rgb),.18)}
  .ce-in.bad input,.ce-in.bad textarea{border-color:rgba(224,82,82,.65)}
  .ce-tag{position:absolute;top:9px;inset-inline-start:8px;font-size:10px;font-weight:800;letter-spacing:.04em;color:${T.text3};background:rgba(var(--ov),.07);border-radius:5px;padding:2px 5px;pointer-events:none}
  .ce-meta{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;margin-top:3px;min-height:15px}
  .ce-err{color:${T.redText};font-weight:600}
  .ce-count{color:${T.text3};font-variant-numeric:tabular-nums;margin-inline-start:auto}
  .ce-count.warn{color:${T.amberText}} .ce-count.over{color:${T.redText};font-weight:700}
  .ce-item{border:1px solid ${T.s2Line};background:${T.s2};border-radius:10px;margin-bottom:8px}
  .ce-item.over{border-color:var(--au-brand);box-shadow:0 0 0 2px rgba(var(--brand-rgb),.25)}
  .ce-item-h{display:flex;align-items:center;gap:4px;padding:6px 6px 6px 8px;min-height:44px}
  .ce-item-t{flex:1;min-width:0;background:none;border:none;color:${T.text};font:inherit;font-size:13px;font-weight:600;text-align:start;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:6px 4px;min-height:36px}
  .ce-item-b{padding:4px 12px 12px;display:flex;flex-direction:column;gap:12px}
  .ce-grip{cursor:grab;color:${T.text3};padding:8px 4px;display:flex;touch-action:none}
  .ce-num{font-size:11px;font-weight:800;color:${T.text3};min-width:18px;text-align:center}
  .ce-icons{display:flex;flex-wrap:wrap;gap:6px}
  .ce-icons button,.ce-sw{width:40px;height:40px;border-radius:9px;border:1px solid ${T.s3Line};background:${T.s3};color:${T.text2};display:flex;align-items:center;justify-content:center;cursor:pointer}
  .ce-icons button[aria-pressed=true],.ce-sw[aria-pressed=true]{border-color:var(--au-brand);background:rgba(var(--brand-rgb),.16);color:${T.brandText}}
  .ce-sw{width:auto;padding:0 12px;gap:8px;font:inherit;font-size:12.5px;font-weight:600}
  .ce-dot{width:7px;height:7px;border-radius:50%;background:${T.amber};flex-shrink:0}
  .ce-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px;border-bottom:1px solid ${T.line};background:${T.s1}}
  .ce-pvbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid ${T.line};background:${T.s1}}
  .ce-seg{display:inline-flex;background:rgba(var(--ov),.06);border-radius:9px;padding:3px;gap:2px}
  .ce-seg button{border:none;background:none;color:${T.text2};font:inherit;font-size:12.5px;font-weight:700;padding:0 11px;height:30px;border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
  .ce-seg button[aria-pressed=true]{background:${T.card};color:${T.text};box-shadow:0 1px 3px rgba(0,0,0,.18)}
  .ce-stage{flex:1;min-height:0;position:relative;overflow:hidden}
  .ce-note{font-size:12px;color:${T.text3};line-height:1.55}
  .ce-issues{margin:8px 14px 0;border:1px solid rgba(224,82,82,.3);background:${T.redSoft};border-radius:10px;padding:8px 10px;max-height:200px;overflow:auto}
  .ce-issues button{display:flex;width:100%;gap:8px;align-items:baseline;text-align:start;background:none;border:none;color:${T.text};font:inherit;font-size:12.5px;padding:6px 4px;cursor:pointer;border-radius:6px}
  .ce-issues button:hover{background:rgba(var(--ov),.06)}
  .ce-banner{margin:10px 14px 0;padding:10px 12px;border-radius:10px;font-size:13px;line-height:1.55;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .ce-flash{animation:ce-flash 1.2s ease}
  @keyframes ce-flash{0%,60%{box-shadow:0 0 0 3px rgba(var(--brand-rgb),.55)}100%{box-shadow:none}}
  @media (max-width:900px){.ce-scroll{padding-bottom:calc(150px + env(safe-area-inset-bottom))}}
`

// ─── one text in one language ────────────────────────────────────────────────
function LangInput({ l, value, max, multi, onChange, err, path, t, changed }) {
  const len = value.length
  const ref = useRef(null)
  // a long text grows its box (up to ~14 lines) instead of hiding lines
  useLayoutEffect(() => {
    const el = ref.current
    if (!multi || !el) return
    el.style.height = 'auto'
    el.style.height = Math.min(360, el.scrollHeight + 2) + 'px'
  }, [value, multi])
  const props = { ref, value, onChange: e => onChange(e.target.value), dir: l === 'he' ? 'rtl' : 'ltr', lang: l, 'data-path': path, 'aria-invalid': err ? true : undefined, 'aria-label': l === 'he' ? t.he : t.en }
  return (
    <div className={`ce-in${err ? ' bad' : ''}`} dir={l === 'he' ? 'rtl' : 'ltr'}>
      <span className="ce-tag" aria-hidden>{l === 'he' ? t.heTag : t.enTag}</span>
      {multi ? <textarea rows={2} {...props}/> : <input type="text" {...props}/>}
      <div className="ce-meta" dir="rtl">
        {err ? <span className="ce-err">{err}</span> : <span>{changed && <span className="ce-dot" title={t.changedDot} style={{ display: 'inline-block' }}/>}</span>}
        {max > 0 && <span className={`ce-count${len > max ? ' over' : len > max * 0.9 ? ' warn' : ''}`}>{len}/{max}</span>}
      </div>
    </div>
  )
}

function PairField({ path, field, value, onChange, errs, changes, t, ui, label }) {
  const limit = fieldLimit(path)
  const v = value || { he: '', en: '' }
  return (
    <div>
      {label !== false && <div className="ce-label">{field[ui]}{field.optional && <span style={{ fontWeight: 500, color: T.text3 }}>({t.optional})</span>}</div>}
      <div className="ce-pair">
        {['he', 'en'].map(l => (
          <LangInput key={l} l={l} t={t} value={v[l] ?? ''} multi={field.multi} path={`${path}.${l}`}
            max={limit ? (l === 'en' ? Math.round(limit * 1.3) : limit) : 0}
            err={errs[`${path}.${l}`] || (l === 'he' ? errs[path] : undefined)} changed={changes.has(`${path}.${l}`)}
            onChange={x => onChange(`${path}.${l}`, x)}/>
        ))}
      </div>
    </div>
  )
}

function PlainField({ path, field, value, onChange, errs, changes, t, ui }) {
  const err = errs[path]
  return (
    <div>
      <div className="ce-label">{field[ui]}{changes.has(path) && <span className="ce-dot" title={t.changedDot}/>}</div>
      <div className={`ce-in${err ? ' bad' : ''}`} dir={field.ltr ? 'ltr' : 'rtl'}>
        <input type="text" value={value ?? ''} data-path={path} dir={field.ltr ? 'ltr' : 'rtl'} aria-invalid={err ? true : undefined} aria-label={field[ui]}
          onChange={e => onChange(path, e.target.value)} style={{ paddingInline: 11 }}/>
        <div className="ce-meta">{err && <span className="ce-err">{err}</span>}</div>
      </div>
    </div>
  )
}

function ImageField({ path, field, value, onChange, errs, changes, t, ui }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [value])
  return (
    <div>
      <div className="ce-label">{field[ui]}{changes.has(path) && <span className="ce-dot" title={t.changedDot}/>}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'rgba(var(--ov),.08)', border: `1px solid ${T.s3Line}` }}>
          {value && !broken && <img src={value} alt="" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={`ce-in${errs[path] ? ' bad' : ''}`} dir="ltr">
            <input type="text" value={value ?? ''} data-path={path} dir="ltr" aria-label={field[ui]} onChange={e => onChange(path, e.target.value)} style={{ paddingInline: 11 }}/>
          </div>
          <div className="ce-meta">{errs[path] ? <span className="ce-err">{errs[path]}</span> : <span className="ce-note">{t.photoSoon}</span>}</div>
        </div>
      </div>
    </div>
  )
}

function IconField({ path, field, value, onChange, t, ui }) {
  return (
    <div>
      <div className="ce-label">{field[ui]}</div>
      <div className="ce-icons" role="group" aria-label={t.iconPick} data-path={path}>
        {HOME_ICONS.map(name => { const Ic = ICONS[name]; return (
          <button key={name} type="button" aria-pressed={value === name} aria-label={name.replace(/^Fa/, '')} title={name.replace(/^Fa/, '')} onClick={() => onChange(path, name)}><Ic size={16}/></button>
        ) })}
      </div>
    </div>
  )
}

function AccentField({ path, field, value, onChange, t, ui }) {
  return (
    <div>
      <div className="ce-label">{field[ui]}</div>
      <div style={{ display: 'flex', gap: 6 }} data-path={path}>
        {Object.entries(ACCENTS).map(([k, c]) => (
          <button key={k} type="button" className="ce-sw" aria-pressed={value === k} onClick={() => onChange(path, k)}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: c }}/>{t[k]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── a list: add / duplicate / delete (with undo) / reorder (drag or arrows) ─
function ListField({ path, field, value, onChange, errs, changes, t, ui, openItem, setOpenItem, toast }) {
  const list = Array.isArray(value) ? value : []
  const bounds = listBounds(path) || { min: 0, max: 99 }
  const confirm = useConfirm()
  const dragFrom = useRef(null)
  const [overIdx, setOverIdx] = useState(null)
  const isText = field.type === 'textlist'
  const what = field.item[ui]
  const open = openItem
  const set = next => onChange(path, next)

  const move = (from, to) => {
    if (to < 0 || to >= list.length || from === to) return
    set(moved(list, from, to))
    if (open === from) setOpenItem(to)
    else if (open != null && from < open && to >= open) setOpenItem(open - 1)
    else if (open != null && from > open && to <= open) setOpenItem(open + 1)
  }
  const add = () => { set([...list, newItem(field)]); if (!isText) setOpenItem(list.length) }
  const dup = i => { set([...list.slice(0, i + 1), clone(list[i]), ...list.slice(i + 1)]); if (!isText) setOpenItem(i + 1) }
  const del = async i => {
    if (!isText) { const ok = await confirm({ title: t.delQ(what), body: t.delBody, confirmLabel: t.delOk, cancelLabel: t.cancel, tone: 'danger' }); if (!ok) return }
    const before = list
    set(list.filter((_, j) => j !== i))
    if (open === i) setOpenItem(null)
    toast(t.deleted(what), { action: { label: t.undo, onClick: () => onChange(path, before) } })
  }
  const summary = it => {
    const v = isText ? it : it?.[field.title]
    return (typeof v === 'string' ? v : v?.[ui === 'en' ? 'en' : 'he'] || v?.he) || t.empty
  }
  const itemErr = i => Object.keys(errs).some(k => k.startsWith(`${path}.${i}.`) || k === `${path}.${i}`)

  return (
    <div data-path={path}>
      <div className="ce-label">
        {field[ui]} <span style={{ fontWeight: 500, color: T.text3 }}>· {list.length} ({t.min(bounds.min)}, {t.max(bounds.max)})</span>
        {changes.has(path) && <span className="ce-dot" title={t.changedDot}/>}
      </div>
      {errs[path] && <div className="ce-err" style={{ fontSize: 12, marginBottom: 6 }}>{errs[path]}</div>}
      {list.map((it, i) => {
        const ip = `${path}.${i}`
        const expanded = isText || open === i
        const acts = (
          <>
            <IconButton size={34} icon={<FaArrowUp size={11}/>} label={t.up} disabled={i === 0} onClick={() => move(i, i - 1)}/>
            <IconButton size={34} icon={<FaArrowDown size={11}/>} label={t.down} disabled={i === list.length - 1} onClick={() => move(i, i + 1)}/>
            <IconButton size={34} icon={<FaClone size={11}/>} label={t.dup} disabled={list.length >= bounds.max} onClick={() => dup(i)}/>
            <IconButton size={34} icon={<FaTrash size={11}/>} label={t.del} disabled={list.length <= bounds.min} onClick={() => del(i)}/>
          </>
        )
        return (
          <div key={i} className={`ce-item${overIdx === i ? ' over' : ''}`}
            onDragOver={e => { if (dragFrom.current == null) return; e.preventDefault(); if (overIdx !== i) setOverIdx(i) }}
            onDragLeave={() => setOverIdx(o => (o === i ? null : o))}
            onDrop={e => { e.preventDefault(); const f = dragFrom.current; dragFrom.current = null; setOverIdx(null); if (f != null) move(f, i) }}>
            <div className="ce-item-h">
              <span className="ce-grip" draggable aria-hidden title={t.drag}
                onDragStart={e => { dragFrom.current = i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)) } catch {} }}
                onDragEnd={() => { dragFrom.current = null; setOverIdx(null) }}><FaGripVertical size={12}/></span>
              <span className="ce-num">{i + 1}</span>
              {isText
                ? <span style={{ flex: 1 }}/>
                : <button type="button" className="ce-item-t" aria-expanded={expanded} onClick={() => setOpenItem(expanded ? null : i)}>
                    {itemErr(i) && <FaExclamationTriangle size={11} color={T.red} style={{ marginInlineEnd: 6, verticalAlign: '-1px' }}/>}
                    {summary(it)}
                  </button>}
              {acts}
              {!isText && <IconButton size={34} icon={<FaChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}/>} label={expanded ? '−' : '+'} onClick={() => setOpenItem(expanded ? null : i)}/>}
            </div>
            {expanded && (
              <div className="ce-item-b" style={isText ? { paddingTop: 0 } : undefined}>
                {isText
                  ? <PairField path={ip} field={{ ...field, type: 'text', multi: field.multi }} value={it} onChange={(p, v) => onChange(p, v)} errs={errs} changes={changes} t={t} ui={ui} label={false}/>
                  : field.fields.map(f => <FieldView key={f.key} path={`${ip}.${f.key}`} field={f} value={it?.[f.key]} onChange={onChange} errs={errs} changes={changes} t={t} ui={ui}/>)}
              </div>
            )}
          </div>
        )
      })}
      <Button size="sm" variant="brand" icon={<FaPlus size={10}/>} disabled={list.length >= bounds.max} onClick={add}>{t.add(what)}</Button>
    </div>
  )
}

function FieldView(props) {
  const { field } = props
  if (field.type === 'text') return <PairField {...props}/>
  if (field.type === 'plain') return <PlainField {...props}/>
  if (field.type === 'image') return <ImageField {...props}/>
  if (field.type === 'icon') return <IconField {...props}/>
  if (field.type === 'accent') return <AccentField {...props}/>
  if (field.type === 'bool') return <Toggle checked={props.value !== false} onChange={v => props.onChange(props.path, v)}>{field[props.ui]}</Toggle>
  return null
}

// "שאלות נפוצות › שאלות ותשובות › שאלה 3 › תשובה (אנגלית)"
function describePath(path, ui, t) {
  const parts = path.split('.')
  const area = CONTENT_AREAS.find(a => a.id === parts[0])
  if (!area) return path
  const out = [area[ui]]
  const f = area.fields.find(x => x.key === parts[1])
  if (f) {
    out.push(f[ui])
    let rest = parts.slice(2)
    if ((f.type === 'list' || f.type === 'textlist') && /^\d+$/.test(rest[0] || '')) {
      out.push(`${f.item[ui]} ${Number(rest[0]) + 1}`)
      rest = rest.slice(1)
      const sub = f.type === 'list' && f.fields.find(x => x.key === rest[0])
      if (sub) { out.push(sub[ui]); rest = rest.slice(1) }
    }
    if (rest[0] === 'he' || rest[0] === 'en') out[out.length - 1] += ` (${t[rest[0]]})`
  }
  return out.join(' › ')
}

function Editor({ lang }) {
  const ui = lang === 'en' ? 'en' : 'he'
  const t = TR[ui]
  const confirm = useConfirm()
  const [toast, toastNode] = useToasts()
  const stored = useMemo(loadDraft, [])
  const [draft, setDraft] = useState(() => (stored ? stored.home : clone(PUBLISHED)))
  const [base, setBase] = useState(() => (stored ? stored.base : PUBLISHED_HASH))
  const stale = base !== PUBLISHED_HASH
  const [openAreas, setOpenAreas] = useState(() => new Set(['hero']))
  const [openItems, setOpenItems] = useState({})
  const [showIssues, setShowIssues] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [showPv, setShowPv] = useState(false)
  const [device, setDevice] = useState(() => { try { return localStorage.getItem('afik_cms_device') || 'desktop' } catch { return 'desktop' } })
  const [pvLang, setPvLang] = useState('he')
  const [pvDark, setPvDark] = useState(true)
  const [frameKey, setFrameKey] = useState(0)
  const [ready, setReady] = useState(false)
  const rootRef = useRef(null), stageRef = useRef(null), frameRef = useRef(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })

  const changes = useMemo(() => diffHome(PUBLISHED, draft), [draft])
  const changeSet = useMemo(() => {
    // a changed leaf also marks its list (for the dot next to a list)
    const s = new Set(changes)
    for (const p of changes) { const m = /^(.+)\.\d+(\..+)?$/.exec(p); if (m) s.add(m[1]) }
    return s
  }, [changes])
  const errors = useMemo(() => validateHome(draft), [draft])
  const errs = useMemo(() => Object.fromEntries(errors.map(e => [e.path, e.msg])), [errors])

  const onChange = useCallback((path, value) => setDraft(d => setIn(d, path.split('.'), value)), [])

  // autosave (this device only); a draft equal to the live version is no draft
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        if (!changes.length && !stale) localStorage.removeItem(DRAFT_KEY)
        else localStorage.setItem(DRAFT_KEY, JSON.stringify({ home: draft, base, at: Date.now() }))
      } catch {}
    }, 300)
    return () => clearTimeout(id)
  }, [draft, base, changes.length, stale])

  // layout: one pane at a time on a narrow screen; the preview stage size drives the desktop scale
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const w = rootRef.current?.clientWidth || 0
      setNarrow(w > 0 && w < 900)
      const s = stageRef.current
      if (s) setStage({ w: s.clientWidth, h: s.clientHeight })
    })
    if (rootRef.current) ro.observe(rootRef.current)
    if (stageRef.current) ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { try { localStorage.setItem('afik_cms_device', device) } catch {} }, [device])

  // ── the preview frame ──
  const latest = useRef({})
  latest.current = { draft, pvLang, pvDark }
  const post = useCallback(msg => { try { frameRef.current?.contentWindow?.postMessage(msg, ORIGIN) } catch {} }, [])
  useEffect(() => {
    const on = e => {
      if (e.origin !== ORIGIN || e.source !== frameRef.current?.contentWindow || e.data?.type !== 'cms-ready') return
      const { draft: d, pvLang: l, pvDark: k } = latest.current
      post({ type: 'cms-view', lang: l, dark: k })
      post({ type: 'cms-draft', home: d })
      setReady(true)
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [post])
  useEffect(() => { if (!ready) return; const id = setTimeout(() => post({ type: 'cms-draft', home: draft }), 120); return () => clearTimeout(id) }, [draft, ready, post])
  useEffect(() => { if (ready) post({ type: 'cms-view', lang: pvLang, dark: pvDark }) }, [pvLang, pvDark, ready, post])
  const reload = () => { setReady(false); setFrameKey(k => k + 1) }
  useEffect(() => { setReady(false) }, [device, narrow])   // a new frame mounts; it says when it's ready

  const toggleArea = a => {
    setOpenAreas(s => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else { n.add(a.id); post({ type: 'cms-scroll', section: a.anchor }) } return n })
  }
  const gotoField = path => {
    const parts = path.split('.')
    setOpenAreas(s => new Set([...s, parts[0]]))
    const area = CONTENT_AREAS.find(a => a.id === parts[0])
    const f = area?.fields.find(x => x.key === parts[1])
    if (f?.type === 'list' && /^\d+$/.test(parts[2] || '')) setOpenItems(o => ({ ...o, [`${parts[0]}.${parts[1]}`]: Number(parts[2]) }))
    if (area) post({ type: 'cms-scroll', section: area.anchor })
    if (narrow) setShowPv(false)
    setShowIssues(false)
    setTimeout(() => {
      const el = rootRef.current?.querySelector(`[data-path="${CSS.escape(path)}"]`) || rootRef.current?.querySelector(`[data-path="${CSS.escape(parts.slice(0, -1).join('.'))}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (el.focus && /INPUT|TEXTAREA/.test(el.tagName)) el.focus({ preventScroll: true })
      el.classList.add('ce-flash'); setTimeout(() => el.classList.remove('ce-flash'), 1300)
    }, 80)
  }
  const discard = async () => {
    const ok = await confirm({ title: t.discardQ, body: t.discardBody, confirmLabel: t.discardOk, cancelLabel: t.cancel, tone: 'danger' })
    if (!ok) return
    const before = draft
    setDraft(clone(PUBLISHED)); setBase(PUBLISHED_HASH); setOpenItems({})
    toast(t.discarded, { action: { label: t.undo, onClick: () => setDraft(before) } })
  }

  const areaCount = (id, list) => list.filter(p => p === id || p.startsWith(id + '.')).length
  const DESKTOP_W = 1280
  const scale = stage.w ? Math.min(1, stage.w / DESKTOP_W) : 1
  const phoneW = Math.min(390, Math.max(320, stage.w - 24))

  return (
    <div ref={rootRef} className={`ce au${narrow ? ' narrow' : ''}${showPv ? ' show-pv' : ''}`} dir="rtl">
      <style>{AUTO_CSS + CE_CSS}</style>
      {toastNode}

      {/* ── form ── */}
      <section className="ce-form" aria-label={t.edit}>
        <div className="ce-bar">
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><FaPen size={13} color="var(--au-brand-text)"/>{t.title}</div>
            <div role="status" className="ce-status" style={{ fontSize: 12.5, color: changes.length ? T.amberText : T.text3, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {changes.length ? <span className="ce-dot"/> : <FaCheckCircle size={11} color={T.green}/>}
              {changes.length ? t.dirty(changes.length) : t.clean}
            </div>
          </div>
          {narrow && (
            <div className="ce-seg" role="group">
              <button type="button" aria-pressed={!showPv} onClick={() => setShowPv(false)}><FaPen size={10}/>{t.edit}</button>
              <button type="button" aria-pressed={showPv} onClick={() => setShowPv(true)}><FaEye size={11}/>{t.preview}</button>
            </div>
          )}
          <Button size="sm" variant="danger" icon={<FaUndo size={10}/>} disabled={!changes.length && !stale} onClick={discard}>{t.discard}</Button>
          <Button size="sm" variant="solid" icon={<FaCloudUploadAlt size={12}/>} disabled title={t.publishSoon}>{t.publish}</Button>
        </div>

        {stale && (
          <div className="ce-banner" style={{ background: T.amberSoft, border: '1px solid rgba(245,166,35,.35)' }} role="alert">
            <FaExclamationTriangle size={12} color={T.amber}/><span style={{ flex: 1, minWidth: 180 }}>{t.stale}</span>
            <Button size="sm" variant="brand" onClick={() => setBase(PUBLISHED_HASH)}>{t.keepDraft}</Button>
            <Button size="sm" onClick={() => { setDraft(clone(PUBLISHED)); setBase(PUBLISHED_HASH) }}>{t.freshStart}</Button>
          </div>
        )}

        <div style={{ padding: '10px 14px 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {errors.length
            ? <Button size="sm" variant="danger" icon={<FaExclamationTriangle size={11}/>} aria-expanded={showIssues} onClick={() => setShowIssues(v => !v)}>{t.issues(errors.length)}</Button>
            : <span style={{ fontSize: 12.5, color: T.green, fontWeight: 700, display: 'inline-flex', gap: 6, alignItems: 'center' }}><FaCheckCircle size={11}/>{t.noIssues}</span>}
          <span className="ce-note" style={{ flex: 1, minWidth: 200 }}>{t.saved}</span>
        </div>
        {showIssues && errors.length > 0 && (
          <div className="ce-issues">
            {errors.map(e => (
              <button key={e.path + e.code} type="button" onClick={() => gotoField(e.path)}>
                <span style={{ color: T.redText, fontWeight: 700, flexShrink: 0 }}>•</span>
                <span style={{ flex: 1 }}><b style={{ fontWeight: 600 }}>{describePath(e.path, ui, t)}</b>: {e.msg}</span>
                <span style={{ color: T.brandText, fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{t.goto}</span>
              </button>
            ))}
          </div>
        )}

        <div className="ce-scroll">
          {CONTENT_AREAS.map(a => {
            const isOpen = openAreas.has(a.id)
            const nChanged = areaCount(a.id, changes), nErr = areaCount(a.id, errors.map(e => e.path))
            return (
              <div key={a.id} className="ce-area">
                <button type="button" className="ce-area-h" aria-expanded={isOpen} onClick={() => toggleArea(a)}>
                  <FaChevronDown size={11} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', color: T.text3 }}/>
                  <span style={{ flex: 1 }}>{a[ui]}</span>
                  {nErr > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: T.redText, background: T.redSoft, borderRadius: 20, padding: '2px 8px' }}>{t.errs(nErr)}</span>}
                  {nChanged > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: T.amberText, background: T.amberSoft, borderRadius: 20, padding: '2px 8px' }}>{t.changed(nChanged)}</span>}
                </button>
                {isOpen && (
                  <div className="ce-area-b">
                    {a.note && <div className="ce-note">{a.note[ui]}</div>}
                    {a.fields.map(f => {
                      const path = `${a.id}.${f.key}`
                      const common = { path, field: f, value: getIn(draft, path), onChange, errs, changes: changeSet, t, ui }
                      return (f.type === 'list' || f.type === 'textlist')
                        ? <ListField key={path} {...common} toast={toast} openItem={openItems[path] ?? null} setOpenItem={i => setOpenItems(o => ({ ...o, [path]: i }))}/>
                        : <FieldView key={path} {...common}/>
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── live preview ── */}
      <section className="ce-pv" aria-label={t.preview}>
        <div className="ce-pvbar">
          {narrow && (
            <div className="ce-seg" role="group">
              <button type="button" aria-pressed={!showPv} onClick={() => setShowPv(false)}><FaPen size={10}/>{t.edit}</button>
              <button type="button" aria-pressed={showPv} onClick={() => setShowPv(true)}><FaEye size={11}/>{t.preview}</button>
            </div>
          )}
          {!narrow && (
            <div className="ce-seg" role="group" aria-label={t.preview}>
              <button type="button" aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}><FaMobileAlt size={11}/>{t.phone}</button>
              <button type="button" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><FaDesktop size={11}/>{t.desktop}</button>
            </div>
          )}
          <div className="ce-seg" role="group">
            <button type="button" aria-pressed={pvLang === 'he'} onClick={() => setPvLang('he')}>עברית</button>
            <button type="button" aria-pressed={pvLang === 'en'} onClick={() => setPvLang('en')}>English</button>
          </div>
          <div className="ce-seg" role="group">
            <button type="button" aria-pressed={pvDark} onClick={() => setPvDark(true)}><FaMoon size={10}/>{t.dark}</button>
            <button type="button" aria-pressed={!pvDark} onClick={() => setPvDark(false)}><FaSun size={11}/>{t.light}</button>
          </div>
          <IconButton icon={<FaRedo size={11}/>} label={t.reload} onClick={reload}/>
        </div>
        <div ref={stageRef} className="ce-stage">
          {!ready && <div className="ce-note" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, pointerEvents: 'none' }}>{t.loadingPreview}</div>}
          {stage.w > 0 && (narrow || device === 'phone'
            ? <iframe key={`p${frameKey}`} ref={frameRef} title={t.preview} src="/?cms-preview=1"
                style={{ position: 'absolute', top: narrow ? 0 : 12, left: '50%', transform: 'translateX(-50%)', width: narrow ? stage.w : phoneW, height: narrow ? stage.h : stage.h - 24, border: narrow ? 'none' : `1px solid ${T.s2Line}`, borderRadius: narrow ? 0 : 22, background: '#09090F', opacity: ready ? 1 : 0, transition: 'opacity .2s' }}/>
            : <iframe key={`d${frameKey}`} ref={frameRef} title={t.preview} src="/?cms-preview=1"
                style={{ position: 'absolute', top: 0, left: 0, maxWidth: 'none', width: DESKTOP_W, height: stage.h / scale, transform: `scale(${scale})`, transformOrigin: '0 0', border: 'none', background: '#09090F', opacity: ready ? 1 : 0, transition: 'opacity .2s' }}/>)}
        </div>
      </section>
    </div>
  )
}

export default function ContentEditorTab({ lang }) {
  return <ConfirmProvider dir="rtl"><Editor lang={lang}/></ConfirmProvider>
}
