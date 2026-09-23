// Templates tab (spec §3.2–3.3): library grid · full-screen editor with phone preview · starters ·
// safe delete (replacement for templates in use) · quick send to one lead · office details.
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { FaPlus, FaSearch, FaBold, FaItalic, FaStrikethrough, FaRegSmile, FaTag, FaPaperPlane, FaEllipsisV, FaCopy, FaUndo, FaTrash, FaLink, FaCheck, FaTimes, FaInfoCircle, FaExclamationTriangle, FaChevronDown, FaChevronUp, FaBuilding } from 'react-icons/fa'
import { T, Button, IconButton, FilterChip, Badge, Card, EmptyState, Modal, Popover, MenuButton, MenuItem, ModeBadge, PhonePreview, Field, inputStyle, useConfirm } from './automationsUI.jsx'
import { WAText, toggleMarker, EMOJI_POPULAR, recentEmoji, pushRecentEmoji } from './waFormat.jsx'
import { CATEGORIES, VARIABLES, DEFAULT_TEMPLATES, renderTemplate, templateUsage, replaceTemplateRefs, unknownPlaceholders, intlPhone } from '../lib/automations-shared.js'
import { autoApi } from './AutomationsApi.jsx'

const TR = {
  he: {
    search: 'חיפוש לפי שם או טקסט', newTemplate: 'תבנית חדשה', all: 'הכל',
    usedByN: n => `בשימוש ב-${n} כללים`, notUsed: 'לא בשימוש', edited: 'נערכה', noEn: 'חסר נוסח באנגלית',
    mEdit: 'ערוך', mSend: 'שלח לליד', mDup: 'שכפל', mCopy: 'העתק טקסט', mRestore: 'שחזר לנוסח המקורי', mDel: 'מחק', more: 'אפשרויות',
    noResultsT: 'לא נמצאו תבניות', noResultsB: 'נסו מילה אחרת או נקו את הסינון.', clear: 'נקה סינון',
    officeTitle: 'פרטי המשרד בהודעות', officeHelp: 'הערכים האלה ממלאים את {agent}, {phone} ו-{sellLink} בכל התבניות.',
    agentHe: 'שם הנציג (עברית)', agentEn: 'שם הנציג (אנגלית)', officePhone: 'טלפון המשרד', sellLink: 'קישור לטופס קליטת נכס',
    startTitle: 'איך להתחיל?', stDupe: 'שכפל תבנית קיימת', copySuffix: ' (עותק)', pick: 'בחרו תבנית…',
    starters: [['blank', '✨', 'תבנית ריקה', 'מתחילים מאפס'], ['welcome', '👋', 'הודעת פתיחה', 'ברוכים הבאים לליד חדש'], ['nr1', '⏰', 'תזכורת ללא מענה', 'תזכורת עדינה'], ['positive', '🚀', 'תיאום שיחה או סיור', 'לקבוע פגישה'], ['docs', '📎', 'בקשת מסמכים', 'רשימת מסמכים להמשך'], ['listing', '🏡', 'נכס חדש שמתאים לך', 'עדכון על נכס חדש'], ['holiday', '🌼', 'ברכת חג', 'ברכה חמה ללקוחות']],
    listingTitle: 'נכס חדש שמתאים לך', listingHe: 'היי {name} 👋\nנכנס אלינו נכס חדש ב{location} שנראה לי מתאים בדיוק למה שחיפשת.\nלשלוח לך פרטים ותמונות?', listingEn: "Hi {name} 👋\nA new listing just came in near {location} that looks like a great fit for what you're after.\nShall I send you the details and photos?",
    edNew: 'תבנית חדשה', edEdit: 'עריכת תבנית', tplName: 'שם התבנית', category: 'קטגוריה', tabHe: 'עברית', tabEn: 'English', missing: 'חסר',
    textPh: 'כתבו כאן את ההודעה…', tBold: 'מודגש (Ctrl+B)', tItalic: 'נטוי (Ctrl+I)', tStrike: 'קו חוצה (Ctrl+Shift+X)', tEmoji: 'אימוג׳י', tVar: 'משתנה',
    emojiRecent: 'בשימוש לאחרונה', emojiPopular: 'נפוצים', personalise: 'הוסיפו פרטים אישיים:', editValues: 'ערוך ערכים',
    chars: n => `${n} תווים`, longHint: 'הודעה ארוכה – הודעות קצרות מקבלות יותר תשובות', tooLong: 'ארוך מדי – וואטסאפ מקבל עד 4,000 תווים',
    unknownVar: x => `{${x}} אינו משתנה מוכר ויישלח כמו שהוא`, enMissing: 'אין נוסח באנגלית – לידים מהאתר באנגלית יקבלו את הנוסח העברי.', copyHe: 'העתק מהעברית לתרגום',
    previewFor: 'תצוגה עבור', sample: 'ליד לדוגמה', noProp: 'ליד בלי נכס', highlight: 'סמן ערכים אישיים', online: 'מחובר/ת', brand: 'אפיק הנחל',
    testMe: 'שלח לי בדיקה', testNum: 'לאיזה מספר?', testSend: 'שלח בדיקה', testSent: p => `הבדיקה נשלחה ל-${p}`,
    usedByLbl: 'בשימוש ב:', notUsedAny: 'לא בשימוש באף כלל', autoImpact: n => `שינוי כאן ישפיע מיד על הודעות אוטומטיות ב-${n} כללים.`,
    saveTpl: 'שמור תבנית', unsavedShort: 'לא נשמר', mEditTab: 'עריכה', mPreviewTab: 'תצוגה',
    needName: 'תנו לתבנית שם', needText: 'כתבו את נוסח ההודעה', saved: 'התבנית נשמרה',
    leaveT: 'לצאת בלי לשמור?', leaveB: 'השינויים שעשית ילכו לאיבוד.', keep: 'המשך לערוך', leave: 'צא בלי לשמור',
    inUseT: 'התבנית בשימוש', inUseB: (n, c) => `״${n}״ משמשת ב-${c} כללים. בחרו תבנית חלופית לפני המחיקה:`, replacement: 'תבנית חלופית', replaceDelete: 'החלף ומחק', offTag: '(כבוי)',
    delT: n => `למחוק את ״${n}״?`, delB: 'התבנית תוסר מהספרייה.', deleted: 'התבנית נמחקה', undo: 'בטל', cancel: 'ביטול', del: 'מחק',
    copied: 'הטקסט הועתק', restored: 'הנוסח המקורי שוחזר',
    qsTitle: n => `שליחה ללקוח · ${n}`, qsSearch: 'חיפוש ליד לפי שם או טלפון', qsSend: 'שלח', qsSent: n => `נשלח ל${n}`, qsOpt: 'ביקש להפסיק', change: 'החלף', error: 'שגיאה',
    modes: { off: 'כבוי', suggest: 'יחכה לאישור', auto: 'יישלח אוטומטית' }, stageNames: {},
  },
  en: {
    search: 'Search by name or text', newTemplate: 'New template', all: 'All',
    usedByN: n => `Used by ${n} rules`, notUsed: 'Not in use', edited: 'Edited', noEn: 'No English version',
    mEdit: 'Edit', mSend: 'Send to a lead', mDup: 'Duplicate', mCopy: 'Copy text', mRestore: 'Restore original', mDel: 'Delete', more: 'Options',
    noResultsT: 'No templates found', noResultsB: 'Try another word or clear the filter.', clear: 'Clear filter',
    officeTitle: 'Office details used in messages', officeHelp: 'These values fill in {agent}, {phone} and {sellLink} in every template.',
    agentHe: 'Agent name (Hebrew)', agentEn: 'Agent name (English)', officePhone: 'Office phone', sellLink: 'Property intake form link',
    startTitle: 'How would you like to start?', stDupe: 'Duplicate an existing template', copySuffix: ' (copy)', pick: 'Choose a template…',
    starters: [['blank', '✨', 'Blank template', 'Start from scratch'], ['welcome', '👋', 'Welcome', 'Greet a new lead'], ['nr1', '⏰', 'No-reply reminder', 'A gentle nudge'], ['positive', '🚀', 'Book a call or viewing', 'Set a meeting'], ['docs', '📎', 'Request documents', 'What we need next'], ['listing', '🏡', 'New listing that fits', 'Share a new property'], ['holiday', '🌼', 'Holiday greeting', 'A warm note to clients']],
    listingTitle: 'New listing that fits', listingHe: 'היי {name} 👋\nנכנס אלינו נכס חדש ב{location} שנראה לי מתאים בדיוק למה שחיפשת.\nלשלוח לך פרטים ותמונות?', listingEn: "Hi {name} 👋\nA new listing just came in near {location} that looks like a great fit for what you're after.\nShall I send you the details and photos?",
    edNew: 'New template', edEdit: 'Edit template', tplName: 'Template name', category: 'Category', tabHe: 'עברית', tabEn: 'English', missing: 'Missing',
    textPh: 'Write your message here…', tBold: 'Bold (Ctrl+B)', tItalic: 'Italic (Ctrl+I)', tStrike: 'Strikethrough (Ctrl+Shift+X)', tEmoji: 'Emoji', tVar: 'Placeholder',
    emojiRecent: 'Recently used', emojiPopular: 'Popular', personalise: 'Personalise with:', editValues: 'Edit values',
    chars: n => `${n} characters`, longHint: "That's long – shorter messages get more replies", tooLong: 'Too long – WhatsApp allows up to 4,000 characters',
    unknownVar: x => `{${x}} isn't a known placeholder and will be sent as is`, enMissing: 'No English version – leads from the English site will get the Hebrew text.', copyHe: 'Copy Hebrew to translate',
    previewFor: 'Preview for', sample: 'Sample lead', noProp: 'Lead with no property', highlight: 'Highlight personal details', online: 'online', brand: 'Afik Hanahal',
    testMe: 'Send me a test', testNum: 'Which number?', testSend: 'Send test', testSent: p => `Test sent to ${p}`,
    usedByLbl: 'Used by:', notUsedAny: 'Not used by any rule', autoImpact: n => `Changes here apply straight away to automatic messages in ${n} rules.`,
    saveTpl: 'Save template', unsavedShort: 'Unsaved', mEditTab: 'Edit', mPreviewTab: 'Preview',
    needName: 'Give the template a name', needText: 'Write the message text', saved: 'Template saved',
    leaveT: 'Leave without saving?', leaveB: 'Your changes will be lost.', keep: 'Keep editing', leave: 'Discard and leave',
    inUseT: 'This template is in use', inUseB: (n, c) => `“${n}” is used by ${c} rules. Choose a replacement before deleting:`, replacement: 'Replacement template', replaceDelete: 'Replace and delete', offTag: '(off)',
    delT: n => `Delete “${n}”?`, delB: 'The template will be removed from the library.', deleted: 'Template deleted', undo: 'Undo', cancel: 'Cancel', del: 'Delete',
    copied: 'Text copied', restored: 'Original wording restored',
    qsTitle: n => `Send to a lead · ${n}`, qsSearch: 'Search a lead by name or phone', qsSend: 'Send', qsSent: n => `Sent to ${n}`, qsOpt: 'Opted out', change: 'Change', error: 'Error',
    modes: { off: 'Off', suggest: 'Waits for approval', auto: 'Sent automatically' }, stageNames: {},
  },
}
const catOf = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[5]
const snap = x => x ? { cat: x.cat, he: x.he || '', en: x.en || '', he_title: x.he_title || '', en_title: x.en_title || '' } : null
const titleOf = (x, isEn) => (isEn ? x.en_title || x.he_title : x.he_title || x.en_title) || ''
const SAMPLE = isEn => ({ id: '__sample', name: isEn ? 'Dana Cohen' : 'דנה כהן', prop_title: isEn ? 'Plot in Tel Mond' : 'מגרש בתל מונד', prop_location: isEn ? 'Tel Mond' : 'תל מונד', crm_data: {} })
const NOPROP = isEn => ({ id: '__noprop', name: isEn ? 'Yossi Levi' : 'יוסי לוי', crm_data: {} })
const asLead = l => ({ id: l.id, name: l.name, phone: l.phone, prop_title: l.propTitle || l.prop_title, prop_location: l.propLocation || l.prop_location, crm_data: { origin: l.origin || l.crm_data?.origin || {} } })

export default function TemplatesTab({ lang = 'he', cfg, tpls, leads, states = {}, setCfg, persist, toast, onGoRule, stageName }) {
  const t = TR[lang] || TR.he
  const isEn = lang === 'en'
  const dir = isEn ? 'ltr' : 'rtl'
  const confirm = useConfirm()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [editing, setEditing] = useState(null)       // template object (copy) or null
  const [starter, setStarter] = useState(false)
  const [sendTpl, setSendTpl] = useState(null)
  const [officeOpen, setOfficeOpen] = useState(false)
  const list = useMemo(() => tpls.filter(x => cat === 'all' || x.cat === cat).filter(x => !q || `${x.he_title} ${x.en_title} ${x.he} ${x.en}`.toLowerCase().includes(q.toLowerCase())), [tpls, cat, q])
  const groups = cat === 'all' && !q ? CATEGORIES.map(c => [c, list.filter(x => x.cat === c.id)]).filter(([, l]) => l.length) : [[null, list]]
  const sample = asLead(leads.find(l => l.name && (l.propTitle || l.prop_title)) || leads.find(l => l.name) || SAMPLE(isEn))

  const saveTpl = async x => {
    const { builtIn, isNew, id, ...rest } = x
    await persist(c => { c.templates = { ...(c.templates || {}), [id]: { cat: rest.cat, he: rest.he, en: rest.en, he_title: rest.he_title, en_title: rest.en_title } }; c.deletedTemplates = (c.deletedTemplates || []).filter(d => d !== id) })
  }
  const restore = async x => { await persist(c => { c.templates = { ...(c.templates || {}) }; delete c.templates[x.id] }); toast(t.restored) }
  const copyText = async x => { try { await navigator.clipboard.writeText(renderTemplate(x, sample, cfg, isEn ? 'en' : 'he')); toast(t.copied) } catch {} }
  const remove = async x => {
    const uses = templateUsage(cfg, x.id)
    const name = titleOf(x, isEn)
    if (uses.length) {
      let repl = ''
      const others = tpls.filter(y => y.id !== x.id)
      const Content = ({ setCan }) => {
        const [v, setV] = useState('')
        useEffect(() => { repl = v; setCan(!!v) }, [v]) // eslint-disable-line react-hooks/exhaustive-deps
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 13, color: T.text2, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {uses.map(u => <li key={u.key} style={{ opacity: u.mode === 'off' ? .55 : 1 }}>{isEn ? u.en : u.he}{u.stage && stageName ? ` · ${stageName(u.stage)}` : ''} {u.mode === 'off' ? t.offTag : ''}</li>)}
            </ul>
            <Field label={t.replacement}><select value={v} onChange={e => setV(e.target.value)} style={inputStyle} data-autofocus><option value="">{t.pick}</option>{others.map(y => <option key={y.id} value={y.id}>{titleOf(y, isEn)}</option>)}</select></Field>
          </div>
        )
      }
      // two-step: pick replacement inside the dialog, then confirm
      const ok = await confirm({ title: t.inUseT, body: t.inUseB(name, uses.length), content: ({ setCanConfirm }) => <Content setCan={setCanConfirm}/>, canConfirm: false, confirmLabel: t.replaceDelete, cancelLabel: t.cancel, tone: 'danger' })
      if (!ok || !repl) return
      await persist(c => { replaceTemplateRefs(c, x.id, repl); if (x.builtIn) c.deletedTemplates = [...new Set([...(c.deletedTemplates || []), x.id])]; c.templates = { ...(c.templates || {}) }; delete c.templates[x.id] })
      toast(t.deleted)
      return
    }
    if (!await confirm({ title: t.delT(name), body: t.delB, confirmLabel: t.del, cancelLabel: t.cancel, tone: 'danger' })) return
    const before = cfg.templates?.[x.id] ? JSON.parse(JSON.stringify(cfg.templates[x.id])) : null
    await persist(c => { if (x.builtIn) c.deletedTemplates = [...new Set([...(c.deletedTemplates || []), x.id])]; c.templates = { ...(c.templates || {}) }; delete c.templates[x.id] })
    toast(t.deleted, { action: { label: t.undo, onClick: () => persist(c => { c.deletedTemplates = (c.deletedTemplates || []).filter(d => d !== x.id); if (before || !x.builtIn) c.templates = { ...(c.templates || {}), [x.id]: before || { cat: x.cat, he: x.he, en: x.en, he_title: x.he_title, en_title: x.en_title } } }) } })
  }
  const startFrom = key => {
    setStarter(false)
    const id = `c_${Date.now().toString(36)}`
    if (key === 'blank') return setEditing({ id, cat: cat === 'all' ? 'general' : cat, he: '', en: '', he_title: '', en_title: '', isNew: true })
    if (key === 'listing') return setEditing({ id, cat: 'progress', he: t.listingHe, en: t.listingEn, he_title: isEn ? 'נכס חדש שמתאים לך' : t.listingTitle, en_title: 'New listing that fits', isNew: true })
    const base = tpls.find(x => x.id === key) || DEFAULT_TEMPLATES.find(x => x.id === key)
    if (base) setEditing({ ...base, id, builtIn: false, isNew: true, he_title: `${base.he_title || ''}${TR.he.copySuffix}`, en_title: base.en_title ? `${base.en_title}${TR.en.copySuffix}` : '' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360, minWidth: 180 }}>
          <FaSearch size={12} style={{ position: 'absolute', top: 12, insetInlineStart: 12, color: T.text3 }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} style={{ ...inputStyle, height: 36, paddingInlineStart: 32 }}/>
        </div>
        <div style={{ flex: 1 }}/>
        <Button variant="solid" icon={<FaPlus size={11}/>} onClick={() => setStarter(true)}>{t.newTemplate}</Button>
      </div>
      <div className="au-scroll-x" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <FilterChip selected={cat === 'all'} count={tpls.length} onClick={() => setCat('all')}>{t.all}</FilterChip>
        {CATEGORIES.map(c => { const n = tpls.filter(x => x.cat === c.id).length; return n ? <FilterChip key={c.id} selected={cat === c.id} color={c.color} count={n} onClick={() => setCat(c.id)}>{c.icon} {isEn ? c.en : c.he}</FilterChip> : null })}
      </div>

      {!list.length ? <Card><EmptyState icon={FaSearch} title={t.noResultsT} body={t.noResultsB} action={<Button onClick={() => { setQ(''); setCat('all') }}>{t.clear}</Button>}/></Card> : groups.map(([c, l]) => (
        <section key={c?.id || 'list'}>
          {c && <h3 style={{ margin: '20px 0 8px', fontSize: 14, fontWeight: 800, display: 'flex', gap: 6, alignItems: 'center' }}>{c.icon} {isEn ? c.en : c.he} <span style={{ color: T.text3, fontWeight: 700, fontSize: 12 }}>{l.length}</span></h3>}
          <div className="au-tpl-grid">
            {l.map(x => {
              const cc = catOf(x.cat), uses = templateUsage(cfg, x.id), edited = x.builtIn && !!cfg.templates?.[x.id]
              return (
                <div key={x.id} className="au-card-hov" style={{ background: T.s1, border: `1px solid ${T.s1Line}`, borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 232 }}>
                  <button type="button" onClick={() => setEditing({ ...x })} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, color: T.text, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'start', minHeight: 0, minWidth: 0 }}>
                    <span style={{ fontSize: 17 }}>{cc.icon}</span><b style={{ flex: 1, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleOf(x, isEn)}</b>
                  </button>
                  <div dir={isEn ? 'ltr' : 'rtl'} onClick={() => setEditing({ ...x })} style={{ flex: 1, cursor: 'pointer', background: '#0B2A22', border: '1px solid rgba(37,211,102,.18)', color: T.wa.text, borderRadius: 10, padding: '9px 11px', fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical' }}>
                    <WAText text={renderTemplate(x, sample, cfg, isEn ? 'en' : 'he')}/>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Badge color={uses.length ? T.brand : T.grey} textColor={uses.length ? T.brandText : T.text3} title={uses.map(u => isEn ? u.en : u.he).join(' · ')}><FaLink size={9}/> {uses.length ? t.usedByN(uses.length) : t.notUsed}</Badge>
                    <Badge color={T.grey} textColor={T.text2}>HE</Badge>
                    {x.en ? <Badge color={T.grey} textColor={T.text2}>EN</Badge> : <Badge outline color={T.amber} textColor={T.amberText} title={t.noEn}>EN</Badge>}
                    {edited && <Badge color={T.amber} textColor={T.amberText}>{t.edited}</Badge>}
                    <div style={{ flex: 1 }}/>
                    <IconButton icon={<FaPaperPlane size={12}/>} label={t.mSend} variant="soft-green" onClick={() => setSendTpl(x)}/>
                    <MenuButton icon={<FaEllipsisV size={12}/>} label={`${t.more} · ${titleOf(x, isEn)}`} dir={dir}>
                      <MenuItem icon={<FaPaperPlane size={11}/>} onClick={() => setSendTpl(x)}>{t.mSend}</MenuItem>
                      <MenuItem icon={<FaCopy size={11}/>} onClick={() => setEditing({ ...x, id: `c_${Date.now().toString(36)}`, builtIn: false, isNew: true, he_title: `${x.he_title || ''}${TR.he.copySuffix}`, en_title: x.en_title ? `${x.en_title}${TR.en.copySuffix}` : '' })}>{t.mDup}</MenuItem>
                      <MenuItem icon={<FaCopy size={11}/>} onClick={() => copyText(x)}>{t.mCopy}</MenuItem>
                      {edited && <MenuItem icon={<FaUndo size={11}/>} onClick={() => restore(x)}>{t.mRestore}</MenuItem>}
                      <div style={{ height: 1, background: T.divider, margin: '4px 0' }}/>
                      <MenuItem danger icon={<FaTrash size={11}/>} onClick={() => remove(x)}>{t.mDel}</MenuItem>
                    </MenuButton>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <Card pad={0} id="au-office">
        <button type="button" onClick={() => setOfficeOpen(o => !o)} aria-expanded={officeOpen} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'none', border: 'none', color: T.text, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'start', minHeight: 0 }}>
          <FaBuilding color={T.brand}/><b style={{ flex: 1, fontSize: 14 }}>{t.officeTitle}</b>{officeOpen ? <FaChevronUp size={11}/> : <FaChevronDown size={11}/>}
        </button>
        {officeOpen && (
          <div className="au-in" style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12.5, color: T.text3 }}><bdi dir="ltr">{t.officeHelp}</bdi></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {[['agent', t.agentHe, 'rtl'], ['en_agent', t.agentEn, 'ltr'], ['phone', t.officePhone, 'ltr'], ['sellLink', t.sellLink, 'ltr']].map(([k, l, d]) => (
                <Field key={k} label={l} htmlFor={`au-v-${k}`}><input id={`au-v-${k}`} value={cfg.vars?.[k] || ''} dir={d} onChange={e => setCfg(c => { c.vars = { ...(c.vars || {}), [k]: e.target.value } })} style={inputStyle}/></Field>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Modal open={starter} onClose={() => setStarter(false)} title={t.startTitle} width={600} dir={dir}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
          {t.starters.map(([k, ic, title, sub]) => (
            <button key={k} type="button" onClick={() => startFrom(k)} className="au-card-hov"
              style={{ minHeight: 72, padding: '12px 14px', borderRadius: 12, background: T.s1, border: `1px solid ${T.s1Line}`, color: T.text, textAlign: 'start', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ fontSize: 22 }}>{ic}</span><span><b style={{ fontSize: 14, fontWeight: 700, display: 'block' }}>{title}</b><span style={{ fontSize: 12, color: T.text3 }}>{sub}</span></span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Field label={t.stDupe}>
            <select defaultValue="" onChange={e => { const b = tpls.find(x => x.id === e.target.value); if (b) { setStarter(false); setEditing({ ...b, id: `c_${Date.now().toString(36)}`, builtIn: false, isNew: true, he_title: `${b.he_title || ''}${TR.he.copySuffix}`, en_title: b.en_title ? `${b.en_title}${TR.en.copySuffix}` : '' }) } }} style={inputStyle}>
              <option value="">{t.pick}</option>{tpls.map(x => <option key={x.id} value={x.id}>{catOf(x.cat).icon} {titleOf(x, isEn)}</option>)}
            </select>
          </Field>
        </div>
      </Modal>

      {editing && <TemplateEditor key={editing.id} t={t} lang={lang} cfg={cfg} tpl={editing} leads={leads} onClose={() => setEditing(null)} onSave={async x => { await saveTpl(x); toast(t.saved); setEditing(null) }} toast={toast} onGoRule={onGoRule} onGoOffice={() => { setEditing(null); setOfficeOpen(true); setTimeout(() => document.getElementById('au-office')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60) }}/>}
      {sendTpl && <QuickSend t={t} lang={lang} cfg={cfg} tpl={sendTpl} leads={leads} states={states} onClose={() => setSendTpl(null)} toast={toast}/>}
    </div>
  )
}

// ── Editor (full screen) ───────────────────────────────────────────────────────
function TemplateEditor({ t, lang, cfg, tpl, leads, onClose, onSave, toast, onGoRule, onGoOffice }) {
  const isEn = lang === 'en'
  const dir = isEn ? 'ltr' : 'rtl'
  const confirm = useConfirm()
  const [x, setX] = useState(() => ({ ...tpl }))
  const [origin] = useState(() => tpl.isNew ? null : snap(tpl))
  const [tab, setTab] = useState('he')
  const [pane, setPane] = useState('edit')
  const [hl, setHl] = useState(true)
  const [who, setWho] = useState('__sample')
  const [saving, setSaving] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [varOpen, setVarOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const ta = useRef(null), emojiBtn = useRef(null), varBtn = useRef(null), testBtn = useRef(null), testBtnM = useRef(null)
  const dirty = tpl.isNew ? !!(x.he || x.en || x.he_title || x.en_title) : JSON.stringify(snap(x)) !== JSON.stringify(origin)
  const text = x[tab] || ''
  const leadsOpts = leads.filter(l => l.name).slice(0, 30)
  const previewLead = who === '__sample' ? SAMPLE(isEn) : who === '__noprop' ? NOPROP(isEn) : asLead(leadsOpts.find(l => String(l.id) === who) || {})
  const rendered = renderTemplate(x, previewLead, cfg, tab, { highlight: true })
  const uses = templateUsage(cfg, x.id)
  const autoUses = uses.filter(u => u.mode === 'auto').length
  const unknown = unknownPlaceholders(text)
  const tooLong = text.length > 4000

  useEffect(() => {
    if (!dirty) return
    const h = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
  // autosize 8–18 rows
  useEffect(() => { const el = ta.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(Math.max(el.scrollHeight, 8 * 22.4 + 20), 18 * 22.4 + 20)}px` }, [text, tab, pane])

  const tryClose = useCallback(async () => {
    if (dirty && !await confirm({ title: t.leaveT, body: t.leaveB, confirmLabel: t.leave, cancelLabel: t.keep, tone: 'danger' })) return
    onClose()
  }, [dirty, confirm, onClose, t])
  const set = patch => setX(o => ({ ...o, ...patch }))
  const setText = v => set({ [tab]: v })
  const fmt = marker => {
    const el = ta.current
    const { next, selStart, selEnd } = toggleMarker(text, el?.selectionStart ?? text.length, el?.selectionEnd ?? text.length, marker)
    setText(next)
    setTimeout(() => { if (el) { el.focus(); el.selectionStart = selStart; el.selectionEnd = selEnd } }, 0)
  }
  const insert = str => {
    const el = ta.current
    const a = el?.selectionStart ?? text.length, b = el?.selectionEnd ?? text.length
    setText(text.slice(0, a) + str + text.slice(b))
    setTimeout(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = a + str.length } }, 0)
  }
  const save = async () => {
    if (!(x.he_title || x.en_title)) { toast(t.needName, { tone: 'warn' }); return }
    if (!x.he?.trim()) { setTab('he'); toast(t.needText, { tone: 'warn' }); return }
    if ((x.he || '').length > 4000 || (x.en || '').length > 4000) return
    setSaving(true)
    try { await onSave(x) } catch (e) { toast(`${t.error}: ${e.message}`, { tone: 'error' }) } finally { setSaving(false) }
  }
  const onKey = e => {
    if (!(e.ctrlKey || e.metaKey)) return
    const k = e.key.toLowerCase()
    if (k === 'b') { e.preventDefault(); fmt('*') }
    else if (k === 'i') { e.preventDefault(); fmt('_') }
    else if (k === 'x' && e.shiftKey) { e.preventDefault(); fmt('~') }
    else if (k === 's') { e.preventDefault(); save() }
  }
  const recent = recentEmoji()
  const cat = catOf(x.cat)

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 60, borderBottom: `1px solid ${T.line}`, flexShrink: 0 }}>
      <IconButton icon={<FaTimes/>} label="✕" size={36} onClick={tryClose}/>
      <b style={{ fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap' }}>{tpl.isNew ? t.edNew : t.edEdit}</b>
      <select value={x.cat} onChange={e => set({ cat: e.target.value })} aria-label={t.category} className="au-hide-m"
        style={{ height: 32, padding: '0 10px', borderRadius: 20, border: `1px solid ${cat.color}66`, background: `${cat.color}1f`, color: T.text, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, minHeight: 0 }}>
        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {isEn ? c.en : c.he}</option>)}
      </select>
      <div style={{ flex: 1 }}/>
      {dirty && <span style={{ fontSize: 12, fontWeight: 700, color: T.amberText, display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: T.amber }}/><span className="au-hide-m">{t.unsavedShort}</span></span>}
      <span className="au-hide-m" style={{ display: 'contents' }}>
        <Button ref={testBtn} icon={<FaPaperPlane size={11}/>} onClick={() => setTestOpen(true)}>{t.testMe}</Button>
        <Button variant="solid" icon={<FaCheck size={11}/>} loading={saving} disabled={tooLong} onClick={save}>{t.saveTpl}</Button>
      </span>
    </div>
  )
  const editorPane = (
    <div style={{ overflow: 'auto', padding: 20, display: pane === 'edit' ? 'flex' : undefined, flexDirection: 'column', gap: 12, minHeight: 0 }} className={pane === 'edit' ? undefined : 'au-hide-m'}>
      <div role="tablist" aria-label={t.tplName} style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${T.line}` }}>
        {['he', 'en'].map(l => {
          const has = !!(x[l] || '').trim()
          return (
            <button key={l} role="tab" aria-selected={tab === l} onClick={() => setTab(l)}
              style={{ height: 36, padding: '0 14px', border: 'none', borderBottom: `2px solid ${tab === l ? T.green : 'transparent'}`, background: 'transparent', color: tab === l ? T.text : T.text3, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0, minWidth: 0, marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: has ? T.green : T.amber }}/>{l === 'he' ? t.tabHe : t.tabEn}{!has && <span style={{ fontSize: 11, color: T.amberText }}>{t.missing}</span>}
            </button>
          )
        })}
      </div>
      <select value={x.cat} onChange={e => set({ cat: e.target.value })} aria-label={t.category} className="au-only-m" style={{ ...inputStyle }}>
        {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {isEn ? c.en : c.he}</option>)}
      </select>
      <Field label={t.tplName} htmlFor="au-tpl-name">
        <input id="au-tpl-name" dir={tab === 'he' ? 'rtl' : 'ltr'} lang={tab} value={x[`${tab}_title`] || ''} onChange={e => set({ [`${tab}_title`]: e.target.value })} style={inputStyle}/>
      </Field>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 40, padding: '0 4px', background: T.s3, border: `1px solid ${T.s3Line}`, borderBottom: 'none', borderRadius: '9px 9px 0 0' }}>
          <IconButton icon={<FaBold size={11}/>} label={t.tBold} onClick={() => fmt('*')}/>
          <IconButton icon={<FaItalic size={11}/>} label={t.tItalic} onClick={() => fmt('_')}/>
          <IconButton icon={<FaStrikethrough size={11}/>} label={t.tStrike} onClick={() => fmt('~')}/>
          <span aria-hidden style={{ width: 1, height: 20, background: T.line2, margin: '0 4px' }}/>
          <IconButton ref={emojiBtn} icon={<FaRegSmile size={13}/>} label={t.tEmoji} onClick={() => setEmojiOpen(true)} aria-haspopup="dialog"/>
          <Button ref={varBtn} variant="plain" size="sm" icon={<FaTag size={10}/>} onClick={() => setVarOpen(true)} aria-haspopup="menu">{t.tVar}</Button>
          <div style={{ flex: 1 }}/>
          <span aria-live="polite" style={{ fontSize: 11.5, paddingInline: 8, fontVariantNumeric: 'tabular-nums', color: tooLong ? T.redText : text.length > 700 ? T.amberText : T.text3 }}>{t.chars(text.length)}</span>
        </div>
        <textarea ref={ta} value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey} dir={tab === 'he' ? 'rtl' : 'ltr'} lang={tab} placeholder={t.textPh} aria-label={tab === 'he' ? t.tabHe : t.tabEn}
          style={{ ...inputStyle, height: 200, padding: '10px 12px', borderRadius: '0 0 9px 9px', resize: 'none', lineHeight: 1.6, fontSize: 14, display: 'block' }}/>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: T.text2, fontWeight: 700 }}>{t.personalise}</span>
        {VARIABLES.map(v => (
          <button key={v.key} type="button" onClick={() => insert(`{${v.key}}`)} title={`{${v.key}} → ${renderTemplate({ he: `{${v.key}}`, en: `{${v.key}}` }, previewLead, cfg, tab) || '—'}`}
            style={{ height: 26, padding: '0 9px', borderRadius: 20, border: '1px solid rgba(132,144,216,.3)', background: 'transparent', color: T.brandText, fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', minHeight: 0, minWidth: 0 }}>{isEn ? v.en : v.he}</button>
        ))}
        <button type="button" onClick={onGoOffice} style={{ background: 'none', border: 'none', color: T.text3, fontSize: 12, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', padding: 0, minHeight: 0, minWidth: 0 }}>{t.editValues}</button>
      </div>
      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
        {unknown.map(u => <div key={u} style={{ color: T.redText, display: 'flex', gap: 6, alignItems: 'center' }}><FaExclamationTriangle size={11}/><bdi>{t.unknownVar(u)}</bdi></div>)}
        {tab === 'en' && !(x.en || '').trim() && (
          <div style={{ color: T.amberText, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><FaExclamationTriangle size={11}/>{t.enMissing}
            <Button size="sm" variant="brand" onClick={() => set({ en: x.he || '' })}>{t.copyHe}</Button></div>
        )}
        {tooLong ? <div style={{ color: T.redText }}>{t.tooLong}</div> : text.length > 700 ? <div style={{ color: T.amberText }}>{t.longHint}</div> : null}
      </div>
    </div>
  )
  const previewPane = (
    <div className={pane === 'preview' ? undefined : 'au-hide-m'} style={{ background: 'var(--au-pane)', borderInlineStart: `1px solid ${T.line}`, padding: 20, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2, whiteSpace: 'nowrap' }}>{t.previewFor}</span>
        <select value={who} onChange={e => setWho(e.target.value)} aria-label={t.previewFor} style={{ ...inputStyle, height: 32, fontSize: 12.5 }}>
          <option value="__sample">{t.sample}</option><option value="__noprop">{t.noProp}</option>
          {leadsOpts.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: T.text2, cursor: 'pointer' }}>
        <input type="checkbox" checked={hl} onChange={e => setHl(e.target.checked)} style={{ appearance: 'auto', width: 18, height: 18, minHeight: 0 }}/>{t.highlight}
      </label>
      <PhonePreview text={rendered} lang={tab} highlight={hl} online={t.online} title={t.brand} fill/>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, marginBottom: 6 }}>{t.usedByLbl}</div>
        {uses.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {uses.map(u => (
              <button key={u.key} type="button" onClick={() => onGoRule?.(u.rule)} className="au-hov" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'transparent', border: `1px solid ${T.divider}`, color: T.text, fontFamily: 'inherit', fontSize: 12.5, cursor: 'pointer', textAlign: 'start', minHeight: 0 }}>
                <span style={{ flex: 1 }}>{isEn ? u.en : u.he}</span><ModeBadge mode={u.mode || 'off'} labels={t.modes}/>
              </button>
            ))}
          </div>
        ) : <div style={{ fontSize: 12, color: T.text3 }}>{t.notUsedAny}</div>}
        {autoUses > 0 && <div style={{ marginTop: 8, display: 'flex', gap: 8, fontSize: 12, color: T.brandText, background: T.brandSoft, borderRadius: 9, padding: '8px 10px', alignItems: 'flex-start' }}><FaInfoCircle style={{ marginTop: 2, flexShrink: 0 }}/>{t.autoImpact(autoUses)}</div>}
      </div>
    </div>
  )
  return (
    <Modal open onClose={tryClose} full closeOnBackdrop={false} dir={dir} label={tpl.isNew ? t.edNew : t.edEdit} initialFocus="textarea">
      <div className="au" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {header}
        <div className="au-only-m" style={{ padding: '8px 16px', borderBottom: `1px solid ${T.line}` }}>
          <div role="radiogroup" style={{ display: 'flex', width: '100%', padding: 2, gap: 2, borderRadius: 9, background: 'rgba(var(--ov),.04)', border: '1px solid rgba(132,144,216,.2)' }}>
            {[['edit', t.mEditTab], ['preview', t.mPreviewTab]].map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={pane === k} onClick={() => setPane(k)} style={{ flex: 1, height: 36, borderRadius: 7, border: 'none', background: pane === k ? T.brandSoft : 'transparent', color: pane === k ? T.brandText : T.text3, fontWeight: 800, fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', minHeight: 0 }}>{l}</button>)}
          </div>
        </div>
        <div className="au-ed-body">{editorPane}{previewPane}</div>
        <div className="au-only-m" style={{ gap: 8, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.line}`, height: 64, alignItems: 'center' }}>
          <IconButton ref={testBtnM} icon={<FaPaperPlane size={14}/>} label={t.testMe} size={44} variant="ghost" onClick={() => setTestOpen(true)}/>
          <Button variant="solid" size="lg" full loading={saving} disabled={tooLong} onClick={save} icon={<FaCheck size={12}/>} style={{ flex: 1 }}>{t.saveTpl}</Button>
        </div>
      </div>
      <Popover anchor={emojiBtn} open={emojiOpen} onClose={() => setEmojiOpen(false)} width={296} dir={dir} label={t.tEmoji}>
        {close => <EmojiGrid t={t} recent={recent} onPick={e => { pushRecentEmoji(e); insert(e); close() }}/>}
      </Popover>
      <Popover anchor={varBtn} open={varOpen} onClose={() => setVarOpen(false)} width={260} dir={dir} label={t.tVar}>
        {close => <div role="menu">{VARIABLES.map(v => <MenuItem key={v.key} onClick={() => { insert(`{${v.key}}`); close() }}><span style={{ flex: 1 }}>{isEn ? v.en : v.he}</span><code dir="ltr" style={{ fontSize: 11, color: T.text3 }}>{`{${v.key}}`}</code></MenuItem>)}</div>}
      </Popover>
      <Popover anchor={window.innerWidth <= 640 ? testBtnM : testBtn} open={testOpen} onClose={() => setTestOpen(false)} width={280} dir={dir} label={t.testMe}>
        {close => <TestSend t={t} cfg={cfg} text={renderTemplate(x, previewLead, cfg, tab)} onDone={p => { toast(t.testSent(p)); close() }} onError={m => toast(`${t.error}: ${m}`, { tone: 'error' })}/>}
      </Popover>
    </Modal>
  )
}

function EmojiGrid({ t, recent, onPick }) {
  const refs = useRef([])
  const onKey = (e, i) => {
    const cols = 8, rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
    let n = null
    if (e.key === 'ArrowRight') n = i + (rtl ? -1 : 1)
    if (e.key === 'ArrowLeft') n = i + (rtl ? 1 : -1)
    if (e.key === 'ArrowDown') n = i + cols
    if (e.key === 'ArrowUp') n = i - cols
    if (n != null && refs.current[n]) { e.preventDefault(); refs.current[n].focus() }
  }
  const grid = (items, offset) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 32px)', gap: 4, justifyContent: 'center' }}>
      {items.map((e, k) => (
        <button key={`${e}-${k}`} ref={el => { refs.current[offset + k] = el }} type="button" onClick={() => onPick(e)} onKeyDown={ev => onKey(ev, offset + k)} className="au-hov" aria-label={e}
          data-autofocus={offset + k === 0 ? true : undefined} style={{ width: 32, height: 32, fontSize: 20, lineHeight: 1, background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', minHeight: 0, minWidth: 0, padding: 0 }}>{e}</button>
      ))}
    </div>
  )
  return (
    <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {!!recent.length && <><div style={{ fontSize: 11.5, fontWeight: 700, color: T.text3 }}>{t.emojiRecent}</div>{grid(recent, 0)}</>}
      <div style={{ fontSize: 11.5, fontWeight: 700, color: T.text3 }}>{t.emojiPopular}</div>
      {grid(EMOJI_POPULAR, recent.length)}
    </div>
  )
}

function TestSend({ t, cfg, text, onDone, onError }) {
  const [p, setP] = useState(() => { try { return localStorage.getItem('afik_auto_test_phone') || cfg.vars?.phone || '' } catch { return cfg.vars?.phone || '' } })
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try { await autoApi.post('auto-test', { text, phone: intlPhone(p) }); try { localStorage.setItem('afik_auto_test_phone', p) } catch {} onDone(p) }
    catch (e) { onError(e.message) } finally { setBusy(false) }
  }
  return (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Field label={t.testNum} htmlFor="au-test-phone"><input id="au-test-phone" data-autofocus dir="ltr" inputMode="tel" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} style={inputStyle}/></Field>
      <Button variant="solid" full loading={busy} disabled={intlPhone(p).length < 11} onClick={go} icon={<FaPaperPlane size={11}/>}>{t.testSend}</Button>
    </div>
  )
}

// ── Quick send to one lead ─────────────────────────────────────────────────────
function QuickSend({ t, lang, cfg, tpl, leads, states, onClose, toast }) {
  const isEn = lang === 'en'
  const [q, setQ] = useState('')
  const [lead, setLead] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const matches = leads.filter(l => l.phone && (!q || (l.name || '').toLowerCase().includes(q.toLowerCase()) || String(l.phone).includes(q))).slice(0, 10)
  const pick = l => { setLead(l); setText(renderTemplate(tpl, asLead(l), cfg)) }
  const send = async () => {
    setBusy(true)
    try {
      const r = await autoApi.post('auto-send', { items: [{ leadId: String(lead.id), phone: intlPhone(lead.phone), name: lead.name, text, ruleKey: `tpl:${tpl.id}`, templateId: tpl.id }] })
      if (!r.results?.[0]?.ok) throw new Error(r.results?.[0]?.error || t.error)
      toast(t.qsSent(lead.name || lead.phone)); onClose()
    } catch (e) { toast(`${t.error}: ${e.message}`, { tone: 'error' }) } finally { setBusy(false) }
  }
  return (
    <Modal open onClose={onClose} title={t.qsTitle(titleOf(tpl, isEn))} width={560} dir={isEn ? 'ltr' : 'rtl'}
      footer={lead ? <Button variant="solid" loading={busy} disabled={!text.trim()} onClick={send} icon={<FaPaperPlane size={11}/>}>{t.qsSend}</Button> : null}>
      {!lead ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input data-autofocus value={q} onChange={e => setQ(e.target.value)} placeholder={t.qsSearch} aria-label={t.qsSearch} style={inputStyle}/>
          {matches.map(l => {
            const opt = states[String(l.id)]?.optOut
            return (
              <button key={l.id} type="button" disabled={opt} onClick={() => pick(l)} className="au-hov"
                style={{ minHeight: 44, display: 'flex', gap: 10, alignItems: 'center', padding: '0 10px', borderRadius: 9, border: `1px solid ${T.divider}`, background: 'transparent', color: T.text, fontFamily: 'inherit', cursor: opt ? 'not-allowed' : 'pointer', opacity: opt ? .45 : 1, textAlign: 'start' }}>
                <b style={{ flex: 1, fontSize: 13.5 }}>{l.name || '—'}</b>
                {opt && <span style={{ fontSize: 11, color: T.redText }}>{t.qsOpt}</span>}
                <bdi dir="ltr" style={{ fontSize: 12, color: T.text3 }}>{l.phone}</bdi>
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}><b>{lead.name}</b><bdi dir="ltr" style={{ color: T.text3 }}>{lead.phone}</bdi><Button size="sm" onClick={() => setLead(null)}>{t.change}</Button></div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={7} dir={lead.origin?.lang === 'en' ? 'ltr' : 'rtl'} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', background: '#0B2A22', border: '1px solid rgba(37,211,102,.25)', color: T.wa.text, lineHeight: 1.6, fontSize: 13.5, resize: 'vertical' }}/>
        </div>
      )}
    </Modal>
  )
}
