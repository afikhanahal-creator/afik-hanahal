// Admin → "סטודיו וידאו" (/admin-panel/studio): the office's video studio. The editor itself is OpenMontage + Claude Code,
// installed on the office PC (it renders with FFmpeg / Remotion and AI providers — it can't run on Vercel). This tab:
// 1. builds the instruction for Claude Code from the chosen properties and options (lib/video-brief.js, tested) — copy,
//    paste into Claude Code inside the OpenMontage folder;
// 2. shows OpenMontage's production board (Backlot, http://127.0.0.1:4750 on the same PC) in a frame or a new tab;
// 3. walks through the one-time install (public/studio/: the Afik style playbook, the real-estate skill, the PowerShell
//    installer). Settings are kept in localStorage.afik_studio_v1. Nothing here sends data anywhere.
import { useEffect, useMemo, useState, useCallback } from 'react'
import { cdnImg } from '../lib/img-url.js'
import { buildBrief, setupCommands, FORMATS, MOODS, VOICES, AI_MODES, BACKLOT_URL, STUDIO_ROOT_DEFAULT, propertyFacts, propertyPlace, propertyPhotos } from '../lib/video-brief.js'
import { Icon } from './uiIcons.jsx'

const KEY = 'afik_studio_v1'
const PACK = '/studio/afik-studio-pack.zip'
const DEF = { format: 'reel', seconds: 35, mood: 'premium', voice: 'none', lang: 'he', ai: 'fill', music: true, footage: '', notes: '', budget: 5 }
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { return {} } }
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* private mode */ } }

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok
    } catch { return false }
  }
}

const TR = {
  he: {
    title: 'סטודיו וידאו', sub: 'בוחרים נכס ואיך הסרטון ייראה, מעתיקים את ההוראה ל-Claude Code, והסרטון נערך על המחשב במשרד',
    s1: '1. נכסים', s2: '2. איך הסרטון ייראה', s3: '3. ההוראה ל-Claude Code',
    search: 'חיפוש נכס…', live: 'באוויר', all: 'הכל', hidden: 'מוסתר', photos: n => n === 1 ? 'תמונה אחת' : `${n} תמונות`, noPhotos: 'בלי תמונות',
    picked: n => n ? `נבחרו ${n}` : 'לא נבחר נכס', clear: 'ניקוי', none: 'לא נמצאו נכסים',
    format: 'פורמט', allFormats: 'כל הפורמטים', seconds: 'אורך', sec: n => `${n} שנ׳`, mood: 'אווירה', voice: 'קול', lang: 'שפה',
    langs: { he: 'עברית', en: 'אנגלית', both: 'שתיהן' }, ai: 'חומרים', music: 'מוזיקה ברקע',
    footage: 'תיקיית צילומים / רחפן במחשב (לא חובה)', footagePh: 'C:\\Users\\HP\\Videos\\נכס בכפר סבא',
    notes: 'הערות (לא חובה)', notesPh: 'למשל: להתחיל מהנוף מהמרפסת, להדגיש את המטבח', budget: 'תקציב AI מקסימלי ($)',
    copy: 'העתקת ההוראה', copied: 'הועתק ✓', copyFail: 'לא הצלחנו להעתיק, סמנו את הטקסט והעתיקו',
    howTo: 'ב-Claude Code, בתוך תיקיית OpenMontage: מדביקים (Ctrl+V) ושולחים. Claude יציג תסריט ועלות לפני שהוא מתחיל.',
    board: 'לוח ההפקה (Backlot)', boardSub: 'כל הסרטונים שבעבודה במחשב, בזמן אמת: תסריט, סטוריבורד, חומרים ותוצאה',
    checking: 'בודק…', up: 'פועל במחשב הזה', down: 'לא פועל', unknown: 'לא נבדק', check: 'בדיקה',
    openTab: 'פתיחה בחלון חדש', showHere: 'הצגה כאן', hide: 'הסתרה',
    downHint: 'כדי להפעיל את הלוח, הריצו ב-PowerShell:', lna: 'אם הדפדפן שואל אם לאפשר גישה לרשת המקומית, אשרו. הלוח עובד רק במחשב שבו OpenMontage מותקן.',
    setup: 'התקנה במחשב (פעם אחת)', root: 'איפה OpenMontage במחשב',
    steps: [
      ['הורדת חבילת אפיק הנחל', 'סגנון המותג, ההנחיות לסרטוני נדל״ן ותוכנת ההתקנה. חלצו את הקובץ לכל תיקייה.'],
      ['התקנה', 'בתיקייה שחולצה: קליק ימני ← "פתח ב-Terminal" (או PowerShell), הדביקו והריצו. מתקין Python, Node ו-FFmpeg אם חסר, ומחבר את הסגנון שלנו.'],
      ['פתיחת הסטודיו', 'צריך Claude Code מותקן במחשב. מכאן מדביקים את ההוראות.'],
      ['לוח ההפקה', 'לראות את ההפקה מתקדמת, גם מהטאב הזה.'],
    ],
    download: 'הורדת החבילה', keys: 'מפתחות API (לא חובה, ליצירת תמונות / וידאו / קול ב-AI): פותחים את הקובץ .env בתיקיית OpenMontage ב-Notepad ומדביקים שם (FAL_KEY, ELEVENLABS_API_KEY…). אף פעם לא בצ׳אט ולא באתר.',
    free: 'בלי מפתחות זה עובד בחינם עם התמונות והצילומים של הנכס, מוזיקה וכתוביות.',
    license: 'OpenMontage הוא קוד פתוח (AGPLv3) ורץ רק אצלכם במחשב. האתר לא מריץ אותו ולא שולח אליו כלום.',
    copyCmd: 'העתקה',
  },
  en: {
    title: 'Video studio', sub: 'Pick a property and the look, copy the instruction into Claude Code, and the video is edited on the office PC',
    s1: '1. Properties', s2: '2. The look', s3: '3. Instruction for Claude Code',
    search: 'Search properties…', live: 'Live', all: 'All', hidden: 'Hidden', photos: n => n === 1 ? '1 photo' : `${n} photos`, noPhotos: 'No photos',
    picked: n => n ? `${n} selected` : 'No property selected', clear: 'Clear', none: 'No properties found',
    format: 'Format', allFormats: 'All formats', seconds: 'Length', sec: n => `${n}s`, mood: 'Mood', voice: 'Voice', lang: 'Language',
    langs: { he: 'Hebrew', en: 'English', both: 'Both' }, ai: 'Material', music: 'Background music',
    footage: 'Footage / drone folder on the PC (optional)', footagePh: 'C:\\Users\\HP\\Videos\\Kfar Saba property',
    notes: 'Notes (optional)', notesPh: 'e.g. open on the balcony view, highlight the kitchen', budget: 'Max AI budget ($)',
    copy: 'Copy the instruction', copied: 'Copied ✓', copyFail: 'Couldn\'t copy, select the text and copy it',
    howTo: 'In Claude Code, inside the OpenMontage folder: paste (Ctrl+V) and send. Claude shows a script and the cost before it starts.',
    board: 'Production board (Backlot)', boardSub: 'Every video in progress on the PC, live: script, storyboard, assets and result',
    checking: 'Checking…', up: 'Running on this PC', down: 'Not running', unknown: 'Not checked', check: 'Check',
    openTab: 'Open in a new tab', showHere: 'Show here', hide: 'Hide',
    downHint: 'To start the board, run in PowerShell:', lna: 'If the browser asks to allow local network access, allow it. The board only works on the PC where OpenMontage is installed.',
    setup: 'Install on the PC (once)', root: 'Where OpenMontage is on the PC',
    steps: [
      ['Download the Afik Hanahal pack', 'The brand style, the real-estate video rules and the installer. Unzip it anywhere.'],
      ['Install', 'In the unzipped folder: right-click → "Open in Terminal" (or PowerShell), paste and run. Installs Python, Node and FFmpeg if missing and adds our style.'],
      ['Open the studio', 'Needs Claude Code on the PC. Paste the instructions here.'],
      ['Production board', 'Watch the production, also from this tab.'],
    ],
    download: 'Download the pack', keys: 'API keys (optional, for AI images / video / voice): open the .env file in the OpenMontage folder in Notepad and paste them there (FAL_KEY, ELEVENLABS_API_KEY…). Never in a chat or on the site.',
    free: 'Without keys it works for free with the property\'s photos and footage, music and captions.',
    license: 'OpenMontage is open source (AGPLv3) and runs only on your PC. The site doesn\'t run it or send it anything.',
    copyCmd: 'Copy',
  },
}

const CSS = `
.vst{display:grid;gap:16px;padding:4px 0 40px;color:var(--au-text);font-size:13px}
.vst *{box-sizing:border-box}
.vst button,.vst input,.vst textarea,.vst select{font:inherit;min-height:0}
.vst h2{margin:0;font-size:22px;font-weight:600}
.vst .sub{margin:2px 0 0;color:var(--au-text2);line-height:1.5}
.vst-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
.vst-col{display:grid;gap:16px;min-width:0}
.vst-card{background:var(--au-card);border:1px solid var(--au-s1-line);border-radius:14px;padding:14px 16px;display:grid;gap:12px;min-width:0}
.vst-card h3{margin:0;font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.vst-card h3 .grow{flex:1}
.vst-muted{color:var(--au-text2);font-size:12px;line-height:1.6}
.vst-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.vst-in{height:34px;border-radius:9px;border:1px solid var(--au-line);background:var(--au-card);color:var(--au-text);padding:0 12px;width:100%}
.vst-in:focus,.vst-ta:focus{outline:2px solid rgba(var(--brand-rgb),.45);outline-offset:0}
.vst-ta{min-height:64px;border-radius:9px;border:1px solid var(--au-line);background:var(--au-card);color:var(--au-text);padding:8px 12px;width:100%;resize:vertical;line-height:1.5}
.vst-seg{display:inline-flex;flex-wrap:wrap;gap:2px;padding:3px;border-radius:10px;background:rgba(var(--ov),.06)}
.vst-seg button{height:30px;padding:0 12px;border:none;border-radius:8px;background:transparent;color:var(--au-text2);font-weight:500;cursor:pointer;white-space:nowrap}
.vst-seg button[aria-checked=true]{background:var(--au-card);color:var(--au-text);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.1)}
.vst-chips{display:flex;flex-wrap:wrap;gap:6px}
.vst-chip{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--au-line);background:transparent;color:var(--au-text2);cursor:pointer;font-size:12.5px}
.vst-chip[aria-checked=true]{border-color:var(--au-brand);background:rgba(var(--brand-rgb),.12);color:var(--au-brand-text);font-weight:600}
.vst-field{display:grid;gap:6px;min-width:0}
.vst-field>label,.vst-lbl{font-size:12px;color:var(--au-text2);font-weight:500}
.vst-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.vst-list{display:grid;gap:6px;max-height:430px;overflow:auto;padding:2px;overscroll-behavior:contain}
.vst-prop{display:grid;grid-template-columns:22px 56px minmax(0,1fr);gap:10px;align-items:center;padding:6px 8px;border-radius:10px;border:1px solid transparent;cursor:pointer;text-align:start;background:transparent;color:inherit;width:100%}
.vst-prop:hover{background:rgba(var(--ov),.04)}
.vst-prop[aria-checked=true]{border-color:rgba(var(--brand-rgb),.5);background:rgba(var(--brand-rgb),.07)}
.vst-box{width:18px;height:18px;border-radius:5px;border:2px solid rgba(var(--ink),.35);display:inline-flex;align-items:center;justify-content:center;color:#fff}
.vst-prop[aria-checked=true] .vst-box{background:var(--au-brand);border-color:var(--au-brand)}
.vst-thumb{width:56px;height:42px;border-radius:7px;object-fit:cover;background:rgba(var(--ov),.08);display:block}
.vst-pt{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vst-pm{font-size:11.5px;color:var(--au-text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vst-tag{font-size:10.5px;border-radius:5px;padding:0 6px;background:rgba(var(--ov),.08);color:var(--au-text2);margin-inline-start:6px;font-weight:500}
.vst-range{display:flex;align-items:center;gap:10px}
.vst-range input{flex:1;appearance:auto;-webkit-appearance:auto;accent-color:var(--au-brand);height:24px}
.vst-range b{min-width:52px;font-variant-numeric:tabular-nums}
.vst-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-size:12.5px}
.vst-switch input{appearance:auto;-webkit-appearance:auto;width:16px;height:16px;accent-color:var(--au-brand)}
.vst-brief{margin:0;white-space:pre-wrap;word-break:break-word;background:rgba(var(--ov),.04);border:1px solid var(--au-line);border-radius:10px;padding:12px 14px;font-family:inherit;font-size:13px;line-height:1.7;max-height:56vh;overflow:auto;direction:rtl;text-align:right}
.vst-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 14px;border-radius:9px;border:1px solid var(--au-line);background:var(--au-card);color:var(--au-text);font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;text-decoration:none}
.vst-btn:hover:not(:disabled){border-color:rgba(var(--brand-rgb),.5)}
.vst-btn.pri{background:var(--au-brand);border-color:var(--au-brand);color:#fff;font-weight:600}
.vst-btn.big{height:42px;font-size:14px;padding:0 20px}
.vst-btn:disabled{opacity:.5;cursor:default}
.vst-pill{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:999px;font-size:11.5px;font-weight:600;background:rgba(var(--ov),.07);color:var(--au-text2)}
.vst-pill i{width:7px;height:7px;border-radius:50%;background:currentColor}
.vst-pill.up{background:rgba(52,199,89,.14);color:#1E9E4A}
.vst-pill.down{background:rgba(245,166,35,.14);color:#B26B00}
html[data-admin-theme=dark] .vst-pill.up{color:#5FD58A}
html[data-admin-theme=dark] .vst-pill.down{color:#F5B651}
.vst-cmd{display:flex;gap:8px;align-items:stretch;min-width:0}
.vst-cmd code{flex:1;min-width:0;direction:ltr;text-align:left;background:rgba(var(--ov),.06);border-radius:8px;padding:8px 10px;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-x:auto;white-space:nowrap}
.vst-steps{list-style:none;margin:0;padding:0;display:grid;gap:14px;counter-reset:s}
.vst-steps li{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;counter-increment:s}
.vst-steps li::before{content:counter(s);width:26px;height:26px;border-radius:50%;background:rgba(var(--brand-rgb),.14);color:var(--au-brand-text);font-weight:700;display:flex;align-items:center;justify-content:center;font-size:12.5px}
.vst-steps b{display:block;font-size:13.5px;margin-bottom:2px}
.vst-frame{width:100%;height:78vh;min-height:480px;border:1px solid var(--au-line);border-radius:12px;background:#fff}
.vst-note{background:rgba(245,166,35,.1);border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.7}
.vst-sum{cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600}
.vst-sum::-webkit-details-marker{display:none}
.vst details[open] .vst-chev{transform:rotate(180deg)}
.vst-chev{transition:transform .15s;display:inline-flex}
@media (min-width:1061px){.vst-sticky{position:sticky;top:12px}}
@media (max-width:1060px){.vst-main{grid-template-columns:1fr}}
@media (max-width:560px){.vst-grid2{grid-template-columns:1fr}.vst-card{padding:12px}.vst-cmd{flex-direction:column}}
`
let cssDone = false
const useCss = () => { if (cssDone || typeof document === 'undefined') return; cssDone = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s) }

function Seg({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="vst-seg">
      {options.map(([id, text]) => <button key={id} type="button" role="radio" aria-checked={value === id} onClick={() => onChange(id)}>{text}</button>)}
    </div>
  )
}
function Chips({ value, onChange, options, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="vst-chips">
      {options.map(([id, text]) => <button key={id} type="button" role="radio" aria-checked={value === id} className="vst-chip" onClick={() => onChange(id)}>{text}</button>)}
    </div>
  )
}
function Cmd({ text, label }) {
  const [ok, setOk] = useState(false)
  return (
    <div className="vst-cmd">
      <code>{text}</code>
      <button type="button" className="vst-btn" onClick={async () => { if (await copyText(text)) { setOk(true); setTimeout(() => setOk(false), 1600) } }}>{ok ? '✓' : label}</button>
    </div>
  )
}

export default function VideoStudioTab({ properties = [], lang = 'he' }) {
  useCss()
  const en = lang === 'en'
  const t = TR[en ? 'en' : 'he']
  const saved = useMemo(read, [])
  const [opts, setOpts] = useState({ ...DEF, ...(saved.opts || {}) })
  const [sel, setSel] = useState(() => (Array.isArray(saved.sel) ? saved.sel.map(String) : []))
  const [root, setRoot] = useState(saved.root || STUDIO_ROOT_DEFAULT)
  const [scope, setScope] = useState(saved.scope === 'all' ? 'all' : 'live')
  const [q, setQ] = useState('')
  const [copied, setCopied] = useState('')
  const [board, setBoard] = useState('unknown')
  const [frame, setFrame] = useState(false)
  const [seen, setSeen] = useState(!!saved.seen)

  useEffect(() => { write({ opts, sel, root, scope, seen }) }, [opts, sel, root, scope, seen])
  const set = (k, v) => setOpts(o => ({ ...o, [k]: v }))

  const ping = useCallback(async () => {
    setBoard('checking')
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 1800)
      await fetch(`${BACKLOT_URL}/api/health`, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal })
      clearTimeout(tm); setBoard('up'); setSeen(true)
    } catch { setBoard('down'); setFrame(false) }
  }, [])
  // Ask the PC only after it answered once (a browser may ask to allow local network access — not on a first visit)
  useEffect(() => { if (seen) ping() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (properties || []).filter(p => p && (scope === 'all' || p.published !== false))
      .filter(p => !s || [p.title, p.location, p.neighborhood, p.type, p.id].some(v => String(v ?? '').toLowerCase().includes(s)))
  }, [properties, q, scope])
  const chosen = useMemo(() => sel.map(id => (properties || []).find(p => String(p?.id) === id)).filter(Boolean), [sel, properties])
  const brief = useMemo(() => buildBrief(chosen, opts), [chosen, opts])
  const cmds = useMemo(() => setupCommands(root), [root])
  const toggle = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))

  const doCopy = async () => { const ok = await copyText(brief); setCopied(ok ? 'ok' : 'fail'); setTimeout(() => setCopied(''), 2200) }
  const single = opts.format !== 'all'
  const pill = { checking: ['', t.checking], up: ['up', t.up], down: ['down', t.down], unknown: ['', t.unknown] }[board]

  return (
    <div className="vst" dir={en ? 'ltr' : 'rtl'}>
      <div>
        <h2>{t.title}</h2>
        <p className="sub">{t.sub}</p>
      </div>

      <div className="vst-main">
        <div className="vst-col">
          <section className="vst-card" aria-label={t.s1}>
            <h3><span className="grow">{t.s1}</span><span className="vst-muted">{t.picked(chosen.length)}</span>
              {chosen.length > 0 && <button type="button" className="vst-btn" onClick={() => setSel([])}>{t.clear}</button>}</h3>
            <div className="vst-bar">
              <input className="vst-in" style={{ flex: 1, minWidth: 160 }} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} aria-label={t.search}/>
              <Seg value={scope} onChange={setScope} label={t.s1} options={[['live', t.live], ['all', t.all]]}/>
            </div>
            <div className="vst-list" role="group" aria-label={t.s1}>
              {list.map(p => {
                const id = String(p.id); const on = sel.includes(id); const n = propertyPhotos(p)
                const img = (p.images || []).find(u => typeof u === 'string' && /^https?:\/\//.test(u))
                return (
                  <button key={id} type="button" role="checkbox" aria-checked={on} className="vst-prop" onClick={() => toggle(id)}>
                    <span className="vst-box" aria-hidden="true">{on && <Icon name="check" size={12}/>}</span>
                    {img ? <img className="vst-thumb" src={cdnImg(img, 120)} alt="" loading="lazy" referrerPolicy="no-referrer"/> : <span className="vst-thumb" aria-hidden="true"/>}
                    <span style={{ minWidth: 0 }}>
                      <span className="vst-pt" style={{ display: 'block' }}>{p.title || '—'}{p.published === false && <span className="vst-tag">{t.hidden}</span>}</span>
                      <span className="vst-pm" style={{ display: 'block' }}>{[propertyPlace(p), propertyFacts(p).slice(1, 3).join(' · '), n ? t.photos(n) : t.noPhotos].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                )
              })}
              {!list.length && <div className="vst-muted" style={{ padding: 12 }}>{t.none}</div>}
            </div>
          </section>

          <section className="vst-card" aria-label={t.s2}>
            <h3>{t.s2}</h3>
            <div className="vst-field"><span className="vst-lbl">{t.format}</span>
              <Seg value={opts.format} onChange={v => setOpts(o => ({ ...o, format: v, seconds: FORMATS[v]?.sec || o.seconds }))} label={t.format}
                options={[...Object.entries(FORMATS).map(([id, f]) => [id, `${en ? f.en : f.he} ${f.ratio}`]), ['all', t.allFormats]]}/>
            </div>
            {single && (
              <div className="vst-field"><label htmlFor="vst-sec">{t.seconds}</label>
                <div className="vst-range"><input id="vst-sec" type="range" min={10} max={opts.format === 'tour' ? 180 : 90} step={5} value={opts.seconds} onChange={e => set('seconds', Number(e.target.value))}/><b>{t.sec(opts.seconds)}</b></div>
              </div>
            )}
            <div className="vst-field"><span className="vst-lbl">{t.mood}</span>
              <Chips value={opts.mood} onChange={v => set('mood', v)} label={t.mood} options={Object.entries(MOODS).map(([id, m]) => [id, en ? m.en : m.he])}/></div>
            <div className="vst-field"><span className="vst-lbl">{t.voice}</span>
              <Chips value={opts.voice} onChange={v => set('voice', v)} label={t.voice} options={Object.entries(VOICES).map(([id, m]) => [id, en ? m.en : m.he])}/></div>
            <div className="vst-field"><span className="vst-lbl">{t.ai}</span>
              <Chips value={opts.ai} onChange={v => set('ai', v)} label={t.ai} options={Object.entries(AI_MODES).map(([id, m]) => [id, en ? m.en : m.he])}/></div>
            <div className="vst-grid2">
              <div className="vst-field"><span className="vst-lbl">{t.lang}</span>
                <Seg value={opts.lang} onChange={v => set('lang', v)} label={t.lang} options={Object.entries(t.langs)}/></div>
              <div className="vst-field"><label htmlFor="vst-bud">{t.budget}</label>
                <input id="vst-bud" className="vst-in" type="number" min={0} step={1} dir="ltr" value={opts.budget} onChange={e => set('budget', e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}/></div>
            </div>
            <label className="vst-switch"><input type="checkbox" checked={opts.music !== false} onChange={e => set('music', e.target.checked)}/>{t.music}</label>
            <div className="vst-field"><label htmlFor="vst-foot">{t.footage}</label>
              <input id="vst-foot" className="vst-in" dir="auto" value={opts.footage} onChange={e => set('footage', e.target.value)} placeholder={t.footagePh}/></div>
            <div className="vst-field"><label htmlFor="vst-notes">{t.notes}</label>
              <textarea id="vst-notes" className="vst-ta" dir="auto" value={opts.notes} onChange={e => set('notes', e.target.value)} placeholder={t.notesPh}/></div>
          </section>
        </div>

        <div className="vst-col vst-sticky">
          <section className="vst-card" aria-label={t.s3}>
            <h3><span className="grow">{t.s3}</span>
              <button type="button" className="vst-btn pri big" onClick={doCopy}>{copied === 'ok' ? t.copied : t.copy}</button></h3>
            {copied === 'fail' && <span role="alert" className="vst-muted">{t.copyFail}</span>}
            <p className="vst-muted" style={{ margin: 0 }}>{t.howTo}</p>
            <pre className="vst-brief" dir="rtl" aria-label={t.s3}>{brief}</pre>
          </section>

          <section className="vst-card" aria-label={t.board}>
            <h3><span className="grow">{t.board}</span>
              <span className={`vst-pill ${pill[0]}`} role="status"><i aria-hidden="true"/>{pill[1]}</span></h3>
            <p className="vst-muted" style={{ margin: 0 }}>{t.boardSub}</p>
            <div className="vst-bar">
              <button type="button" className="vst-btn" onClick={ping} disabled={board === 'checking'}>{t.check}</button>
              <a className="vst-btn" href={BACKLOT_URL} target="_blank" rel="noreferrer">{t.openTab}</a>
              {board === 'up' && <button type="button" className="vst-btn pri" onClick={() => setFrame(f => !f)}>{frame ? t.hide : t.showHere}</button>}
            </div>
            {board === 'down' && (<div className="vst-field"><span className="vst-lbl">{t.downHint}</span><Cmd text={cmds.backlot} label={t.copyCmd}/></div>)}
            <p className="vst-muted" style={{ margin: 0 }}>{t.lna}</p>
          </section>
        </div>
      </div>

      {frame && board === 'up' && <iframe className="vst-frame" src={BACKLOT_URL} title={t.board}/>}

      <details className="vst-card" open={!seen}>
        <summary className="vst-sum"><span style={{ flex: 1 }}>{t.setup}</span><span className="vst-chev" aria-hidden="true"><Icon name="chevronDown" size={16}/></span></summary>
        <div className="vst-field"><label htmlFor="vst-root">{t.root}</label>
          <input id="vst-root" className="vst-in" dir="ltr" value={root} onChange={e => setRoot(e.target.value)}/></div>
        <ol className="vst-steps">
          <li><div><b>{t.steps[0][0]}</b><span className="vst-muted">{t.steps[0][1]}</span>
            <div style={{ marginTop: 8 }}><a className="vst-btn pri" href={PACK} download><Icon name="upload" size={14} style={{ transform: 'rotate(180deg)' }}/>{t.download}</a></div></div></li>
          <li><div><b>{t.steps[1][0]}</b><span className="vst-muted">{t.steps[1][1]}</span><div style={{ marginTop: 8 }}><Cmd text={cmds.install} label={t.copyCmd}/></div></div></li>
          <li><div><b>{t.steps[2][0]}</b><span className="vst-muted">{t.steps[2][1]}</span><div style={{ marginTop: 8 }}><Cmd text={cmds.open} label={t.copyCmd}/></div></div></li>
          <li><div><b>{t.steps[3][0]}</b><span className="vst-muted">{t.steps[3][1]}</span><div style={{ marginTop: 8 }}><Cmd text={cmds.backlot} label={t.copyCmd}/></div></div></li>
        </ol>
        <div className="vst-note">{t.free}<br/>{t.keys}</div>
        <p className="vst-muted" style={{ margin: 0 }}>{t.license}</p>
      </details>
    </div>
  )
}
