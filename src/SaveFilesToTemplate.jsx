// "שמירה לתבנית" from the files tray (the chats tab and the Lead Center / lead card): the photos / files attached in a chat are
// kept on a template, so a property's regular set (photos, price list, plans) goes out again in one click — the template puts
// them in the tray ("הצעות" / the templates window / the quick replies). Local files are uploaded to property-media/templates/…
// first (the browser, straight to storage); an existing template gets them added after its own (addFilesToTemplate,
// lib/template-edit.js, tested), or a new template opens in the quick editor with them (onNewTemplate). Saving re-reads
// auto-config first, so a change made meanwhile elsewhere is never overwritten.
import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { templateList, templateFiles, sameProject, CATEGORIES } from '../lib/automations-shared.js'
import { addFilesToTemplate } from '../lib/template-edit.js'
import { uploadAll, fileKind } from './lib/chatFiles.js'
import { autoApi } from './AutomationsApi.jsx'
import { imageThumb } from './lib/templateImage.js'
import { Icon } from './uiIcons.jsx'

const TR = {
  he: {
    title: 'שמירת הקבצים בתבנית', sub: n => `${n} קבצים יישמרו בתבנית. כששולחים אותה, הם נכנסים לתיבה ויוצאים יחד.`,
    search: 'חיפוש תבנית…', newTpl: 'תבנית חדשה עם הקבצים', newSub: 'שם, נוסח ופרויקט, בחלון העריכה',
    project: p => `של ${p}`, others: 'כל התבניות', files: n => (n ? `${n} קבצים` : 'בלי קבצים'), none: 'לא נמצאה תבנית',
    uploading: (d, n) => `מעלה ${d}/${n}…`, saving: 'שומר…', saved: (n, name) => `נוספו ${n} קבצים ל"${name}"`, nothing: 'הקבצים האלה כבר בתבנית',
    dropped: n => `${n} לא נכנסו (עד 30 בתבנית)`, err: 'השמירה נכשלה', close: 'סגירה', add: 'הוספה',
  },
  en: {
    title: 'Save the files to a template', sub: n => `${n} files will be kept on the template. Sending it puts them in the box, and they go out together.`,
    search: 'Search templates…', newTpl: 'A new template with these files', newSub: 'Name, wording and project, in the editor',
    project: p => `of ${p}`, others: 'All templates', files: n => (n ? `${n} files` : 'no files'), none: 'No template found',
    uploading: (d, n) => `Uploading ${d}/${n}…`, saving: 'Saving…', saved: (n, name) => `${n} files added to "${name}"`, nothing: 'These files are already in the template',
    dropped: n => `${n} didn't fit (up to 30 per template)`, err: 'Saving failed', close: 'Close', add: 'Add',
  },
}

/** items = the tray's items ({ file, remote }); project = the lead's project (its templates first); text = the box's text */
export default function SaveFilesToTemplate({ WA, lang = 'he', items = [], project = '', text = '', autoConfig, onSaved, onNewTemplate, onClose }) {
  const t = TR[lang] || TR.he
  const [q, setQ] = useState('')
  const [state, setState] = useState({ phase: 'idle' })
  const searchRef = useRef(null)
  useEffect(() => { searchRef.current?.focus() }, [])
  useEffect(() => { const k = e => { if (e.key === 'Escape' && state.phase !== 'uploading' && state.phase !== 'saving') onClose?.() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose, state.phase])

  const files = items.map(x => x.file)
  const all = useMemo(() => templateList(autoConfig || undefined), [autoConfig])
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const hit = x => !s || [x.he_title, x.en_title, x.project, x.he].some(v => String(v || '').toLowerCase().includes(s))
    const mine = project ? all.filter(x => x.project && sameProject(x.project, project) && hit(x)) : []
    const ids = new Set(mine.map(x => x.id))
    return { mine, rest: all.filter(x => !ids.has(x.id) && hit(x)) }
  }, [all, q, project])

  // every file in storage first (template folder) → [{ url, name, type, size }]
  const upload = async () => {
    let done = 0
    const n = files.length
    setState({ phase: 'uploading', msg: t.uploading(0, n) })
    const ups = await uploadAll(files, (i, st) => { if (st === 'ready') setState({ phase: 'uploading', msg: t.uploading(++done, n) }) }, { folder: 'templates' })
    return ups.map((u, i) => ({ url: u.url, name: u.fileName || files[i].name || 'file', type: u.type || files[i].type || '', size: u.size || files[i].size || 0 }))
  }

  const addTo = async tpl => {
    try {
      const stored = await upload()
      setState({ phase: 'saving', msg: t.saving })
      const fresh = await autoApi.get('auto-config').then(d => d.config).catch(() => autoConfig) || autoConfig || {}
      const cur = templateList(fresh).find(x => x.id === tpl.id) || tpl
      const r = addFilesToTemplate(fresh, cur, stored)
      if (!r.added) { setState({ phase: 'done', msg: t.nothing }); return }
      await autoApi.post('auto-config', { config: r.next })
      const name = (lang === 'en' ? cur.en_title || cur.he_title : cur.he_title) || cur.id
      setState({ phase: 'done', ok: true, msg: t.saved(r.added, name) + (r.dropped ? ` · ${t.dropped(r.dropped)}` : '') })
      onSaved?.(r.next, cur.id)
      setTimeout(() => onClose?.(), 1400)
    } catch (e) { setState({ phase: 'error', msg: `${t.err}: ${e.message}` }) }
  }

  const createNew = async () => {
    try {
      const stored = await upload()
      setState({ phase: 'idle' })
      const he = /[֐-׿]/.test(text) || !text.trim()
      onNewTemplate?.({ tpl: { cat: 'personal', he: '', en: '', he_title: '', en_title: '', project: project || '', files: stored },
        initial: he ? { he: text, en: '' } : { he: '', en: text }, lang: he ? 'he' : 'en', create: true })
    } catch (e) { setState({ phase: 'error', msg: `${t.err}: ${e.message}` }) }
  }

  const busy = state.phase === 'uploading' || state.phase === 'saving'
  const catName = id => { const c = CATEGORIES.find(x => x.id === id); return c ? (lang === 'en' ? c.en_short || c.en : c.short || c.he) : '' }
  const row = x => {
    const n = templateFiles(x).length
    const name = (lang === 'en' ? x.en_title || x.he_title : x.he_title || x.en_title) || x.id
    return (
      <button key={x.id} type="button" disabled={busy} onClick={() => addTo(x)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', minHeight: 0, border: 'none', borderBottom: `1px solid ${WA.border}`, background: 'transparent', color: WA.bodyText, textAlign: 'start', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
        {x.image ? <img src={imageThumb(x.image, 80)} alt="" width={34} height={34} style={{ borderRadius: 6, objectFit: 'cover', flex: 'none' }}/>
          : <span style={{ width: 34, height: 34, borderRadius: 6, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${WA.green}18`, color: WA.green }}><Icon name="file" size={16}/></span>}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><bdi>{name}</bdi></span>
          <span style={{ display: 'block', fontSize: 11.5, color: WA.subText }}>{[catName(x.cat), x.project, t.files(n)].filter(Boolean).join(' · ')}</span>
        </span>
        <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: WA.green }}>{t.add}</span>
      </button>
    )
  }
  const head = s => <div style={{ padding: '10px 12px 4px', fontSize: 11.5, fontWeight: 700, color: WA.subText }}>{s}</div>

  return createPortal(
    <div onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose?.() }} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={t.title} dir={lang === 'en' ? 'ltr' : 'rtl'}
        style={{ width: 'min(560px, 100%)', maxHeight: 'calc(100vh - 32px)', background: WA.panelBg, color: WA.bodyText, borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 6px' }}>
          <b style={{ fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon name="bookmark" size={16}/>{t.title}</b>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t.close} style={{ marginInlineStart: 'auto', background: 'none', border: 'none', color: WA.subText, cursor: 'pointer', padding: 4, minHeight: 0 }}><Icon name="x" size={18}/></button>
        </div>
        <div style={{ padding: '0 16px 10px', fontSize: 12.5, color: WA.subText }}>{t.sub(files.length)}</div>
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto' }}>
          {items.slice(0, 12).map(x => fileKind(x.file) === 'image' && x.preview
            ? <img key={x.id} src={x.preview} alt="" width={40} height={40} style={{ borderRadius: 6, objectFit: 'cover', flex: 'none' }}/>
            : <span key={x.id} title={x.file.name} style={{ width: 40, height: 40, borderRadius: 6, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${WA.green}18`, color: WA.green }}><Icon name={fileKind(x.file) === 'video' ? 'video' : 'file'} size={16}/></span>)}
          {items.length > 12 && <span style={{ alignSelf: 'center', fontSize: 12, color: WA.subText }}>+{items.length - 12}</span>}
        </div>
        <div style={{ padding: '0 16px 10px' }}>
          <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} disabled={busy}
            style={{ width: '100%', boxSizing: 'border-box', background: WA.inputFieldBg, color: WA.bodyText, border: `1px solid ${WA.border}`, borderRadius: 8, padding: '8px 11px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none' }}/>
        </div>
        <div style={{ flex: 1, minHeight: 120, overflowY: 'auto', borderTop: `1px solid ${WA.border}` }}>
          {onNewTemplate && <button type="button" disabled={busy} onClick={createNew}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', minHeight: 0, border: 'none', borderBottom: `1px solid ${WA.border}`, background: `${WA.green}10`, color: WA.bodyText, textAlign: 'start', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            <span style={{ width: 34, height: 34, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: WA.green, color: '#fff' }}><Icon name="plus" size={17}/></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700 }}>{t.newTpl}</span>
              <span style={{ display: 'block', fontSize: 11.5, color: WA.subText }}>{t.newSub}</span>
            </span>
          </button>}
          {list.mine.length > 0 && <>{head(t.project(project))}{list.mine.map(row)}</>}
          {list.rest.length > 0 && <>{list.mine.length > 0 && head(t.others)}{list.rest.map(row)}</>}
          {!list.mine.length && !list.rest.length && <div style={{ padding: 16, fontSize: 13, color: WA.subText }}>{t.none}</div>}
        </div>
        {state.phase !== 'idle' && <div role="status" style={{ padding: '10px 16px', borderTop: `1px solid ${WA.border}`, fontSize: 12.5, fontWeight: 600, color: state.phase === 'error' ? '#DC2626' : state.ok ? WA.green : WA.subText }}>{state.msg}</div>}
      </div>
    </div>,
    document.body,
  )
}
