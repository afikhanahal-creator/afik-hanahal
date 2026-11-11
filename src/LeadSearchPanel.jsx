// The leads board's search results (2026-11-11 — "when I search a lead's name I want the lead to show up, not to go looking
// for it among the columns"): a list right under the search box (the lead, its phone, project and stage; ↑ ↓ Enter open the
// lead card), a one-line note over the board that says what was found and where, and the "nothing found" state.
// The matching itself is src/lib/leadSearch.js (pure, tested).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MessageCircle, Plus, Search, X } from 'lucide-react'
import WaFace from './WaFace.jsx'
import { phoneDigits } from './lib/leadSearch.js'
import { leadCampaign } from './lib/leadFields.js'
import { projectOfLead } from '../lib/projects.js'

export const SEARCH_ROWS = 8

export const LS_CSS = `
  input.ls-in,input.ls-in:focus,input.ls-in:focus-visible{border:0!important;outline:0!important;box-shadow:none!important;background:transparent!important;border-radius:0!important;padding:0!important;-webkit-appearance:none;appearance:none}
  input.ls-in::-webkit-search-cancel-button{display:none}
  .ls-pop{position:fixed;z-index:1200;background:var(--au-pop,#fff);border:1px solid var(--au-line2,rgba(28,36,90,.18));border-radius:14px;box-shadow:var(--au-shadow3,0 12px 32px rgba(20,24,60,.14));overflow:hidden;display:flex;flex-direction:column;font-family:Rubik,system-ui,sans-serif;color:var(--au-text,#171A2C)}
  .ls-head{padding:9px 14px 7px;font-size:12px;font-weight:500;color:var(--au-text3,rgba(23,26,44,.58));border-bottom:1px solid var(--au-divider,rgba(28,36,90,.07))}
  .ls-head b{font-weight:600;color:var(--au-text,#171A2C)}
  .ls-list{overflow-y:auto;padding:4px;max-height:min(58vh,468px)}
  .ls-row{display:flex;align-items:center;gap:10px;width:100%;min-height:0;padding:8px 10px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer}
  .ls-row.on,.ls-row:hover{background:rgba(var(--brand-rgb,63,73,166),.09)}
  .ls-row:focus-visible{outline:2px solid var(--au-brand,#3F49A6);outline-offset:-2px}
  .ls-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
  .ls-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ls-sub{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--au-text3,rgba(23,26,44,.58));white-space:nowrap;overflow:hidden}
  .ls-sub span{overflow:hidden;text-overflow:ellipsis}
  .ls-sub .sep{flex-shrink:0;opacity:.6}
  .ls-stage{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:999px;background:rgba(var(--ov,28,36,90),.06);font-size:11.5px;font-weight:500;color:var(--au-text2,rgba(23,26,44,.74));white-space:nowrap}
  .ls-stage i{width:8px;height:8px;border-radius:50%;background:var(--sc,#64748B);flex-shrink:0}
  .ls-chat{flex-shrink:0;width:30px;height:30px;min-height:0;padding:0;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:8px;background:transparent;color:var(--au-text3,rgba(23,26,44,.58));cursor:pointer}
  .ls-chat:hover{background:rgba(37,211,102,.14);color:#128C4A}
  .ls-foot{display:flex;align-items:center;gap:10px;padding:7px 14px;border-top:1px solid var(--au-divider,rgba(28,36,90,.07));font-size:11.5px;color:var(--au-text3,rgba(23,26,44,.58))}
  .ls-foot kbd{font:inherit;font-size:10.5px;padding:1px 5px;border-radius:5px;border:1px solid var(--au-line2,rgba(28,36,90,.18));background:rgba(var(--ov,28,36,90),.04)}
  .ls-none{padding:18px 16px;display:flex;flex-direction:column;gap:10px;align-items:flex-start;font-size:13px;color:var(--au-text2,rgba(23,26,44,.74))}
  .ls-none b{color:var(--au-text,#171A2C);font-weight:600}
  .ls-btn{display:inline-flex;align-items:center;gap:6px;height:30px;min-height:0;padding:0 12px;border-radius:9px;border:1px solid var(--au-line2,rgba(28,36,90,.18));background:transparent;color:var(--au-brand-text,#343C92);font:600 12.5px Rubik,sans-serif;cursor:pointer;white-space:nowrap}
  .ls-btn:hover{background:rgba(var(--brand-rgb,63,73,166),.08)}
  .ls-btn.fill{background:var(--au-brand,#3F49A6);border-color:transparent;color:#fff}
  .ls-btn.fill:hover{background:var(--au-brand-deep,#333B8C)}
  .ls-note{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:10px 20px 0;padding:8px 12px;border-radius:12px;background:var(--au-card,#fff);border:1px solid rgba(var(--brand-rgb,63,73,166),.28);color:var(--au-text2,rgba(23,26,44,.74));font-size:12.5px;font-weight:500;flex-shrink:0}
  .ls-note b{color:var(--au-text,#171A2C);font-weight:600}
  .ls-note .grow{flex:1}
  .ls-note.close{border-color:rgba(214,138,0,.45)}
  .ls-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:40px 24px;text-align:center;color:var(--au-text2,rgba(23,26,44,.74));font-size:14px}
  .ls-empty h3{margin:0;font-size:18px;font-weight:600;color:var(--au-text,#171A2C)}
  .ls-empty p{margin:0;max-width:440px;line-height:1.6}
  .ls-empty .acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
  .ls-empty .ls-btn{height:38px;padding:0 16px;font-size:13.5px}
  .ls-ico{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(var(--brand-rgb,63,73,166),.1);color:var(--au-brand-text,#343C92)}
  @media (max-width:640px){ .ls-note{margin:8px 0 0} .ls-empty .ls-btn{height:44px} }
`

const fmtPhone = p => { const d = phoneDigits(p); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : d.length === 9 ? `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}` : String(p || '') }

/** what the search found, in words */
export function searchSummary(found, query, lang = 'he') {
  const q = String(query || '').trim()
  const n = found?.all?.length || 0
  if (!n) return lang === 'en' ? `No lead matches “${q}”` : `לא נמצא ליד שמתאים ל"${q}"`
  if (!found.exact.length) return lang === 'en' ? `No lead is called “${q}” — ${n === 1 ? 'one similar name' : `${n} similar names`}` : `לא נמצא ליד בשם "${q}" — ${n === 1 ? 'יש שם אחד דומה' : `יש ${n} שמות דומים`}`
  return lang === 'en' ? (n === 1 ? `One lead found for “${q}”` : `${n} leads found for “${q}”`) : (n === 1 ? `נמצא ליד אחד עבור "${q}"` : `נמצאו ${n} לידים עבור "${q}"`)
}

function Row({ lead, on, lang, stages, projects, onOpen, onOpenChat, onHover, id }) {
  const stage = stages.find(s => s.id === (lead.leadStatus || 'new')) || stages[0]
  const project = projectOfLead(lead, projects)?.name || leadCampaign(lead, lang)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button type="button" id={id} role="option" aria-selected={on} className={`ls-row${on ? ' on' : ''}`} onMouseEnter={onHover}
        onMouseDown={e => e.preventDefault()} onClick={() => onOpen(lead)}>
        <WaFace phone={lead.phone} lead={lead} name={lead.name} size={34} lang={lang} zoom={false}/>
        <span className="ls-main">
          <span className="ls-name"><bdi>{lead.name || (lang === 'en' ? 'No name' : 'ללא שם')}</bdi></span>
          <span className="ls-sub">
            {lead.phone && <bdi dir="ltr" style={{ flexShrink: 0 }}>{fmtPhone(lead.phone)}</bdi>}
            {lead.phone && project && <i className="sep" aria-hidden="true">·</i>}
            {project && <span><bdi>{project}</bdi></span>}
          </span>
        </span>
        {stage && <span className="ls-stage" style={{ '--sc': stage.color }}><i aria-hidden="true"/>{lang === 'en' ? stage.en : stage.label}</span>}
      </button>
      {onOpenChat && lead.phone && (
        <button type="button" className="ls-chat" tabIndex={-1} onMouseDown={e => e.preventDefault()} onClick={() => onOpenChat(lead)}
          title={lang === 'en' ? 'Open the WhatsApp chat' : 'פתיחת השיחה בוואטסאפ'} aria-label={lang === 'en' ? `WhatsApp chat with ${lead.name || ''}` : `שיחת וואטסאפ עם ${lead.name || ''}`}>
          <MessageCircle size={16}/>
        </button>
      )}
    </div>
  )
}

/** the list under the search box (a portal: the toolbar scrolls sideways and would clip it) */
export function SearchPopover({ anchorRef, open, found, query, lang = 'he', stages, projects, active, setActive, onOpen, onOpenChat, onClose, onNew }) {
  const [pos, setPos] = useState(null)
  const boxRef = useRef(null)
  const closeRef = useRef(onClose); closeRef.current = onClose
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = anchorRef.current?.getBoundingClientRect()
      if (!r) return
      const vw = window.innerWidth
      const width = Math.min(Math.max(r.width, 460), vw - 24)
      const rtl = lang !== 'en'
      const left = Math.max(12, Math.min(vw - 12 - width, rtl ? r.right - width : r.left))
      setPos({ top: Math.round(r.bottom + 6), left: Math.round(left), width: Math.round(width) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, anchorRef, lang])
  useEffect(() => {
    if (!open) return
    const down = e => { if (!boxRef.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) closeRef.current?.() }
    document.addEventListener('pointerdown', down, true)
    return () => document.removeEventListener('pointerdown', down, true)
  }, [open, anchorRef])
  useEffect(() => { if (open) document.getElementById(`ls-opt-${active}`)?.scrollIntoView({ block: 'nearest' }) }, [open, active])
  if (!open || !pos || !found) return null
  const rows = found.all.slice(0, SEARCH_ROWS)
  const more = found.all.length - rows.length
  const en = lang === 'en'
  return createPortal(
    <div ref={boxRef} className="ls-pop" style={{ top: pos.top, left: pos.left, width: pos.width }} dir={en ? 'ltr' : 'rtl'} data-ls-pop="">
      {rows.length === 0 ? (
        <div className="ls-none" role="status">
          <span>{en ? <>No lead matches <b>“{query.trim()}”</b> — by name, phone, email or project.</> : <>לא נמצא ליד שמתאים ל<b>"{query.trim()}"</b> — לא בשם, לא בטלפון, לא במייל ולא בפרויקט.</>}</span>
          {onNew && <button type="button" className="ls-btn fill" onMouseDown={e => e.preventDefault()} onClick={onNew}><Plus size={14}/>{en ? 'Add as a new lead' : 'הוספה כליד חדש'}</button>}
        </div>
      ) : (<>
        <div className="ls-head" role="status">
          {found.exact.length
            ? (en ? <><b>{found.all.length}</b> {found.all.length === 1 ? 'lead' : 'leads'} · in every project and stage</> : <><b>{found.all.length === 1 ? 'ליד אחד' : `${found.all.length} לידים`}</b> · מכל הפרויקטים והשלבים</>)
            : (en ? <>Nobody is called exactly that — <b>similar names:</b></> : <>אין ליד בשם הזה בדיוק — <b>שמות דומים:</b></>)}
        </div>
        <div className="ls-list" role="listbox" id="ls-listbox" aria-label={en ? 'Leads found' : 'לידים שנמצאו'}>
          {rows.map((l, i) => <Row key={l.id} id={`ls-opt-${i}`} lead={l} on={i === active} lang={lang} stages={stages} projects={projects} onOpen={onOpen} onOpenChat={onOpenChat} onHover={() => setActive(i)}/>)}
        </div>
        <div className="ls-foot">
          <span><kbd>Enter</kbd> {en ? 'opens the lead card' : 'פותח את כרטיס הליד'}</span>
          <span><kbd>↑</kbd> <kbd>↓</kbd></span>
          <span style={{ flex: 1 }}/>
          {more > 0 && <span>{en ? `${more} more on the board` : `עוד ${more} בלוח למטה`}</span>}
        </div>
      </>)}
    </div>, document.body)
}

/** the line over the board while a search is on: what was found, where, and a way out */
export function SearchNote({ found, query, lang = 'he', projectName = '', outside = 0, folded = false, onClear }) {
  if (!found || !found.all.length) return null
  const en = lang === 'en'
  return (
    <div className={`ls-note${found.exact.length ? '' : ' close'}`} role="status" dir={en ? 'ltr' : 'rtl'}>
      <Search size={14} aria-hidden="true"/>
      <b>{searchSummary(found, query, lang)}</b>
      <span>{en ? 'The search covers every lead' : 'החיפוש עובר על כל הלידים'}{projectName && outside > 0 ? (en ? ` · ${outside} outside “${projectName}”` : ` · ${outside} מהם מחוץ ל"${projectName}"`) : ''}{folded ? (en ? ' · stages with no match are folded' : ' · שלבים בלי תוצאה מקופלים') : ''}</span>
      <span className="grow"/>
      <button type="button" className="ls-btn" onClick={onClear}><X size={13}/>{en ? 'Clear search' : 'ניקוי החיפוש'}</button>
    </div>
  )
}

/** nothing found: say so in the middle of the board, with what to do next */
export function SearchEmpty({ query, lang = 'he', onClear, onNew }) {
  const en = lang === 'en'
  const q = String(query || '').trim()
  return (
    <div className="ls-empty" role="status" dir={en ? 'ltr' : 'rtl'}>
      <span className="ls-ico" aria-hidden="true"><Search size={24}/></span>
      <h3>{en ? <>No lead matches “<bdi>{q}</bdi>”</> : <>לא נמצא ליד שמתאים ל"<bdi>{q}</bdi>"</>}</h3>
      <p>{en ? 'We looked at every lead — every project and stage — by name (also as typed in the form), phone, email and project, and for similar spellings.' : 'חיפשנו בכל הלידים, בכל הפרויקטים והשלבים: לפי שם (גם כפי שנכתב בטופס), טלפון, מייל ופרויקט, וגם באיות דומה.'}</p>
      <div className="acts">
        {onNew && <button type="button" className="ls-btn fill" onClick={onNew}><Plus size={15}/>{en ? 'Add as a new lead' : 'הוספה כליד חדש'}</button>}
        <button type="button" className="ls-btn" onClick={onClear}><X size={14}/>{en ? 'Clear search' : 'ניקוי החיפוש'}</button>
      </div>
    </div>
  )
}
