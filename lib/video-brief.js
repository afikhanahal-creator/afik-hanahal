// The video studio's brief: one Hebrew instruction for Claude Code inside OpenMontage (installed on the office PC, see
// public/studio/) built from the admin's choices and the property records. Pure — the admin tab (src/VideoStudioTab.jsx)
// only renders and copies it. Every fact in it comes from the property record; nothing is invented here.

export const STUDIO_SITE = 'https://www.afikhanahal.co.il'
export const STUDIO_ROOT_DEFAULT = 'C:\\Users\\HP\\Desktop\\Downloads\\OpenMontage-main'
export const BACKLOT_URL = 'http://127.0.0.1:4750'

export const FORMATS = {
  reel: { he: 'רילס / סטורי', en: 'Reel / Story', ratio: '9:16', size: '1080×1920', sec: 35 },
  feed: { he: 'פוסט בפיד', en: 'Feed post', ratio: '4:5', size: '1080×1350', sec: 25 },
  tour: { he: 'סיור מלא', en: 'Full tour', ratio: '16:9', size: '1920×1080', sec: 90 },
}
export const MOODS = {
  premium: { he: 'יוקרתי ורגוע', en: 'Premium and calm' },
  warm: { he: 'משפחתי וחם', en: 'Warm, family' },
  energetic: { he: 'קצבי ואנרגטי', en: 'Upbeat' },
  investor: { he: 'עסקי למשקיעים', en: 'For investors' },
}
export const VOICES = {
  none: { he: 'בלי קריינות (מוזיקה + כתוביות)', en: 'No voice-over (music + captions)' },
  he: { he: 'קריינות בעברית', en: 'Hebrew voice-over' },
  en: { he: 'קריינות באנגלית', en: 'English voice-over' },
}
export const AI_MODES = {
  real: { he: 'רק חומר אמיתי של הנכס', en: 'Real material only' },
  fill: { he: 'השלמות AI רק איפה שחסר (מסומן "הדמיה")', en: 'AI only to fill gaps (labelled)' },
  full: { he: 'הדמיות AI חופשיות (מסומן "הדמיה")', en: 'Free AI visuals (labelled)' },
}

const CAT_HE = { apartments: 'דירה', land: 'מגרש', commercial: 'נכס מסחרי', rentals: 'נכס להשכרה' }
const clean = v => String(v ?? '').replace(/\s+/g, ' ').trim()
const num = v => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : 0 }
export const formatShekel = v => { const n = num(v); return n ? `₪${Math.round(n).toLocaleString('en-US')}` : '' }

/** The facts of one property as short Hebrew phrases (only what the record has) */
export function propertyFacts(p = {}) {
  const size = num(p.size) || num(p.buildSqm)
  return [
    clean(p.type) || CAT_HE[p.category] || '',
    num(p.rooms) ? `${num(p.rooms)} חדרים` : '',
    size ? `${size} מ״ר` : '',
    num(p.dunams) ? `${num(p.dunams)} דונם` : '',
    clean(p.floor) ? `קומה ${clean(p.floor)}` : '',
    formatShekel(p.price) ? `מחיר ${formatShekel(p.price)}${p.category === 'rentals' ? ' לחודש' : ''}` : '',
    p.gush && p.helka ? `גוש ${clean(p.gush)} חלקה ${clean(p.helka)}` : '',
  ].filter(Boolean)
}
export const propertyPlace = (p = {}) => [p.location, p.neighborhood].map(clean).filter(Boolean).join(', ')
export const propertyPhotos = (p = {}) => (Array.isArray(p.images) ? p.images : []).filter(u => typeof u === 'string' && /^https?:\/\//.test(u)).length
export const isSoldOut = (p = {}) => /נמכר|הושכר|sold|rented/i.test(String(p.status || ''))

/** A short project folder name for the property (ASCII, for OpenMontage's projects/<id>) */
export function projectSlug(p = {}) {
  const id = clean(p.id).replace(/[^\w-]/g, '')
  return `afik-${id || 'property'}`
}

/**
 * The brief. opts: { format: 'reel'|'feed'|'tour'|'all', seconds, mood, voice, lang: 'he'|'en'|'both', ai, music,
 * footage (a folder on the PC), notes, budget (USD) }
 */
export function buildBrief(properties = [], opts = {}) {
  const list = (Array.isArray(properties) ? properties : []).filter(Boolean)
  const fmtIds = opts.format === 'all' ? Object.keys(FORMATS) : [FORMATS[opts.format] ? opts.format : 'reel']
  const single = fmtIds.length === 1 ? FORMATS[fmtIds[0]] : null
  const seconds = Math.max(10, Math.min(300, Math.round(Number(opts.seconds) || (single ? single.sec : 35))))
  const mood = MOODS[opts.mood] || MOODS.premium
  const voice = VOICES[opts.voice] ? opts.voice : 'none'
  const ai = AI_MODES[opts.ai] ? opts.ai : 'fill'
  const lang = ['he', 'en', 'both'].includes(opts.lang) ? opts.lang : 'he'
  const budget = Math.max(0, Number(opts.budget) || 0)
  const L = []

  L.push(list.length > 1
    ? `אנחנו צריכים ${list.length} סרטוני נדל״ן לאפיק הנחל, אחד לכל נכס ברשימה.`
    : 'אנחנו צריכים סרטון נדל״ן לאפיק הנחל.')
  L.push('עבדו לפי skills/creative/real-estate-afik.md ועם סגנון afik-hanahal (styles/afik-hanahal.yaml).')
  L.push('')

  if (!list.length) L.push('נכס: עוד לא נבחר. תשאלו אותנו על איזה נכס מדובר.')
  list.forEach((p, i) => {
    const head = list.length > 1 ? `${i + 1}. ` : 'נכס: '
    const title = clean(p.title) || 'ללא שם'
    const place = propertyPlace(p)
    L.push(`${head}${title}${place ? ` · ${place}` : ''}`)
    const facts = propertyFacts(p)
    if (facts.length) L.push(`   עובדות (רק אלה, בדיוק ככה): ${facts.join(' · ')}`)
    L.push(`   פרטים ותמונות: ${STUDIO_SITE}/api/properties?one=${encodeURIComponent(clean(p.id))}`)
    L.push(`   עמוד הנכס: ${STUDIO_SITE}/p/${encodeURIComponent(clean(p.id))}`)
    const n = propertyPhotos(p)
    L.push(`   ${n > 1 ? `${n} תמונות באתר` : n ? 'תמונה אחת באתר' : 'אין תמונות באתר'} · תיקיית פרויקט: projects/${projectSlug(p)}`)
    if (p.published === false) {
      const urls = (Array.isArray(p.images) ? p.images : []).filter(u => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 20)
      L.push('   הנכס עוד לא מפורסם באתר, אז הקישורים למעלה לא יעבדו.' + (urls.length ? ' התמונות:' : ''))
      urls.forEach(u => L.push(`   ${u}`))
      if (clean(p.description)) L.push(`   תיאור: ${clean(p.description).slice(0, 600)}`)
    }
    if (isSoldOut(p)) L.push('   שימו לב: הנכס מסומן נמכר / הושכר. לא סרטון "למכירה", תשאלו אותנו מה המטרה.')
  })
  L.push('')

  L.push(single
    ? `פורמט: ${single.he}, ${single.ratio} (${single.size}), בערך ${seconds} שניות.`
    : `פורמטים: ${fmtIds.map(f => `${FORMATS[f].he} ${FORMATS[f].ratio} (${FORMATS[f].size})`).join(', ')}. האורך לפי ההנחיות של כל פורמט.`)
  L.push(`אווירה: ${mood.he}.`)
  L.push(`סאונד: ${VOICES[voice].he}${opts.music === false ? ', בלי מוזיקה' : ', מוזיקה מתאימה בלי מילים'}.`)
  L.push(lang === 'both' ? 'שפה: גרסה בעברית וגרסה באנגלית (כתוביות באנגלית טבעית של נדל״ן).' : lang === 'en' ? 'שפה: אנגלית (כתוביות באנגלית טבעית של נדל״ן).' : 'שפה: עברית, מימין לשמאל.')
  L.push(`חומרים: ${AI_MODES[ai].he}.`)
  const footage = clean(opts.footage)
  if (footage) L.push(`צילומים ורחפן שלנו נמצאים בתיקייה: ${footage} (הם החומר הראשי, התמונות מהאתר רק להשלמה).`)
  if (clean(opts.notes)) L.push(`הערות שלנו: ${clean(opts.notes)}`)
  L.push('')

  L.push('איך לעבוד:')
  L.push(`- לפני כל קריאה בתשלום תגידו כמה זה יעלה${budget ? `, ולא יותר מ-$${budget} ${list.length > 1 ? 'לכל הסדרה' : 'לסרטון'}` : ''}.`)
  if (list.length > 1) L.push('- תכינו קודם סרטון אחד לאישור, ואחרי שאישרנו תמשיכו לשאר בלי לעצור. בסוף batch-report.md עם כל הסרטונים.')
  else L.push('- תראו לנו את התסריט והסטוריבורד לפני הרינדור.')
  L.push('- כל מספר על המסך בדיוק כמו בעובדות למעלה. עובדה שלא כתובה כאן לא נכנסת לסרטון.')
  L.push('- בסוף: 3 שניות עם הלוגו, 055-981-1814 וקישור לקביעת שיחה afikhanahal.co.il/book.')
  L.push('- תוצאה: MP4 (H.264) + קובץ כתוביות SRT, ותגידו לנו איפה הם נשמרו.')
  return L.join('\n')
}

/** The PowerShell lines of the setup card, for the office's own folder */
export function setupCommands(root = STUDIO_ROOT_DEFAULT) {
  const r = clean(root) || STUDIO_ROOT_DEFAULT
  const q = `"${r.replace(/"/g, '')}"`
  return {
    install: `powershell -ExecutionPolicy Bypass -File .\\install-openmontage.ps1 -Root ${q}`,
    open: `cd ${q}; claude`,
    backlot: `cd ${q}; .\\.venv\\Scripts\\python -m backlot open`,
  }
}
