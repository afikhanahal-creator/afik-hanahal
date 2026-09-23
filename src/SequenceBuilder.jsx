// No-reply sequence timeline (spec C20): start node → delay chip → reminder card → … → end node.
import { useState, useRef } from 'react'
import { FaPaperPlane, FaHourglassHalf, FaEllipsisV, FaFlagCheckered, FaPlus, FaMoon, FaArrowUp, FaArrowDown, FaTrash } from 'react-icons/fa'
import { T, Popover, Button, MenuButton, MenuItem, ModeSwitch } from './automationsUI.jsx'
import { WAText } from './waFormat.jsx'

const TR = {
  he: {
    anchor: 'הודעת פתיחה', anchorSub: 'נקודת ההתחלה', delay: (n, u) => `מחכה ${n} ${u} ללא תשובה`, hours: 'שעות', days: 'ימים', hour1: 'שעה', day1: 'יום',
    reminder: n => `תזכורת ${n}`, approx: d => `בערך ${d} ימים אחרי הפתיחה`, approxH: h => `בערך ${h} שעות אחרי הפתיחה`,
    add: 'הוסף תזכורת', max: 'עד 6 תזכורות', up: 'הזז למעלה', down: 'הזז למטה', del: 'מחק תזכורת', menu: 'אפשרויות תזכורת',
    range: 'בין שעה אחת ל-30 ימים', end: 'הרצף נעצר כשהלקוח עונה', summary: (d, n) => `הרצף כולו: ${d} ימים · ${n} תזכורות`,
    quiet: 'תזכורת שנופלת מחוץ לשעות השליחה יוצאת כשהן נפתחות.', hoursLink: 'שעות שליחה', ok: 'אישור', editDelay: 'עריכת זמן המתנה', tpl: 'תבנית', gone: 'התבנית נמחקה – בחרו אחרת',
  },
  en: {
    anchor: 'Welcome message', anchorSub: 'Starting point', delay: (n, u) => `Wait ${n} ${u} with no reply`, hours: 'hours', days: 'days', hour1: 'hour', day1: 'day',
    reminder: n => `Reminder ${n}`, approx: d => `About ${d} days after the welcome`, approxH: h => `About ${h} hours after the welcome`,
    add: 'Add reminder', max: 'Up to 6 reminders', up: 'Move up', down: 'Move down', del: 'Delete reminder', menu: 'Reminder options',
    range: 'Between 1 hour and 30 days', end: 'The sequence stops as soon as the lead replies', summary: (d, n) => `Full sequence: ${d} days · ${n} reminders`,
    quiet: 'A reminder that falls outside sending hours goes out when they open.', hoursLink: 'Sending hours', ok: 'Done', editDelay: 'Edit wait time', tpl: 'Template', gone: 'Template deleted – choose another',
  },
}
const half = n => Math.round(n * 2) / 2

export default function SequenceBuilder({ steps, onChange, templates, tplName, renderPreview, lang = 'he', max = 6, onGoHours, renderToken }) {
  const t = TR[lang] || TR.he
  const dir = lang === 'en' ? 'ltr' : 'rtl'
  const set = (i, patch) => onChange(steps.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  const move = (i, d) => { const n = [...steps]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n) }
  const remove = i => onChange(steps.filter((_, k) => k !== i))
  const add = () => onChange([...steps, { hours: steps[steps.length - 1]?.hours || 72, templateId: templates.find(x => x.id === 'nr3') ? 'nr3' : templates[0]?.id }])
  const totalH = steps.reduce((n, s) => n + (Number(s.hours) || 0), 0)
  let acc = 0

  const Node = ({ children, tone = 'grey' }) => (
    <span style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800,
      background: tone === 'brand' ? T.brandSoft : 'rgba(var(--ov),.08)', color: tone === 'brand' ? T.brand : T.text3, border: `1px solid ${tone === 'brand' ? 'rgba(132,144,216,.35)' : 'rgba(var(--ov),.1)'}` }}>{children}</span>
  )
  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden style={{ position: 'absolute', insetInlineStart: 17, top: 18, bottom: 18, width: 2, background: 'rgba(132,144,216,.25)' }}/>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <li style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Node><FaPaperPlane size={13}/></Node>
          <div><div style={{ fontSize: 13.5, fontWeight: 700 }}>{t.anchor}</div><div style={{ fontSize: 11.5, color: T.text3 }}>{t.anchorSub}</div></div>
        </li>
        {steps.map((s, i) => {
          acc += Number(s.hours) || 0
          const tpl = templates.find(x => x.id === s.templateId)
          const prev = tpl ? renderPreview(s.templateId) : ''
          return (
            <li key={i} className="au-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ paddingInlineStart: 44 }}><DelayChip hours={Number(s.hours) || 24} onChange={h => set(i, { hours: h })} t={t} dir={dir}/></div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Node tone="brand">{i + 1}</Node>
                <div style={{ flex: 1, minWidth: 0, background: T.s1, border: `1px solid ${tpl ? T.s1Line : 'rgba(224,82,82,.45)'}`, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 13.5 }}>{t.reminder(i + 1)}</b>
                    {renderToken({ value: s.templateId, onChange: v => set(i, { templateId: v }), label: `${t.reminder(i + 1)} · ${t.tpl}` })}
                    <div style={{ flex: 1 }}/>
                    <MenuButton icon={<FaEllipsisV size={12}/>} label={t.menu} dir={dir}>
                      <MenuItem icon={<FaArrowUp size={10}/>} onClick={() => move(i, -1)}>{t.up}</MenuItem>
                      <MenuItem icon={<FaArrowDown size={10}/>} onClick={() => move(i, 1)}>{t.down}</MenuItem>
                      <MenuItem danger icon={<FaTrash size={10}/>} onClick={() => remove(i)}>{t.del}</MenuItem>
                    </MenuButton>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.text3 }}>{acc >= 24 ? t.approx(half(acc / 24)) : t.approxH(acc)}</div>
                  {tpl ? <div dir="auto" style={{ fontSize: 12.5, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', unicodeBidi: 'plaintext' }}><WAText text={prev.replace(/\n/g, ' ')}/></div>
                    : <div style={{ fontSize: 12, color: T.redText }}>{t.gone}</div>}
                </div>
              </div>
            </li>
          )
        })}
        <li style={{ paddingInlineStart: 48 }}>
          {steps.length < max
            ? <Button onClick={add} full icon={<FaPlus size={11}/>} style={{ borderStyle: 'dashed', height: 40 }}>{t.add}</Button>
            : <span style={{ fontSize: 12, color: T.text3 }}>{t.max}</span>}
        </li>
        <li style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Node><FaFlagCheckered size={13}/></Node>
          <span style={{ fontSize: 13, color: T.text2 }}>{t.end}</span>
        </li>
      </ol>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: T.text3 }}>
        <span style={{ fontWeight: 700, color: T.text2 }}>{t.summary(half(totalH / 24), steps.length)}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><FaMoon size={11}/>{t.quiet}{onGoHours && <button type="button" onClick={onGoHours} style={{ background: 'none', border: 'none', color: T.brandText, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0, minHeight: 0, minWidth: 0, textDecoration: 'underline' }}>{t.hoursLink}</button>}</span>
      </div>
    </div>
  )
}

function DelayChip({ hours, onChange, t, dir }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const isDays = hours % 24 === 0 && hours >= 24
  const n = isDays ? hours / 24 : hours
  const unit = isDays ? (n === 1 ? t.day1 : t.days) : (n === 1 ? t.hour1 : t.hours)
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${t.editDelay}: ${t.delay(n, unit)}`}
        style={{ height: 28, padding: '0 11px', borderRadius: 20, background: T.s2, border: '1px solid rgba(245,166,35,.45)', color: T.amberText, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', minHeight: 0, minWidth: 0 }}>
        <FaHourglassHalf size={10}/> {t.delay(n, unit)}
      </button>
      <Popover anchor={ref} open={open} onClose={() => setOpen(false)} width={260} dir={dir} label={t.editDelay}>
        {close => <DelayEditor hours={hours} t={t} onDone={h => { onChange(h); close() }} onCancel={close}/>}
      </Popover>
    </>
  )
}
function DelayEditor({ hours, t, onDone, onCancel }) {
  const isDays = hours % 24 === 0 && hours >= 24
  const [unit, setUnit] = useState(isDays ? 'd' : 'h')
  const [val, setVal] = useState(String(isDays ? hours / 24 : hours))
  const h = Math.round(Number(val) * (unit === 'd' ? 24 : 1))
  const bad = !Number.isFinite(h) || h < 1 || h > 720
  const commit = () => { if (!bad) onDone(h) }
  return (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 10 }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}>
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{t.editDelay}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input data-autofocus inputMode="numeric" value={val} onChange={e => setVal(e.target.value.replace(/[^\d.]/g, ''))} aria-label={t.editDelay}
          style={{ width: 72, height: 36, textAlign: 'center', borderRadius: 9, border: `1px solid ${bad ? T.red : T.s3Line}`, background: T.s3, color: T.text, fontFamily: 'inherit', fontSize: 14, fontVariantNumeric: 'tabular-nums', minHeight: 0 }}/>
        <ModeSwitch value={unit} onChange={setUnit} modes={['h', 'd']} labels={{ h: t.hours, d: t.days }} icons={{}} colors={{ h: T.brand, d: T.brand }} size="sm" label={t.editDelay}/>
      </div>
      {bad && <div style={{ fontSize: 12, color: T.redText }}>{t.range}</div>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Button size="sm" onClick={onCancel}>✕</Button>
        <Button size="sm" variant="solid" disabled={bad} onClick={commit}>{t.ok}</Button>
      </div>
    </div>
  )
}
