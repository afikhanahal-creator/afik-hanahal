// "Video pack" for NotebookLM: everything Google's Video Overview needs to narrate a property in
// correct Hebrew, built from the two summary pages (review + story) with internal data stripped.
// NotebookLM has no public API, so the office gets a one-click pack: a source document to drop into a
// notebook, the steering instructions for the video, and a ready narration script it can also read
// itself. Nothing here reaches a client automatically; the office presses the button.
import { buildSummary, headline, storyText, storyTitle, storyLine, publicAnswers, purposeOf, marketingTexts, PROPERTY_TYPE_LABEL, roomsOf } from '../src/sellerFormSchema.js'

const OFFICE = { brand: 'אפיק הנחל', tagline: 'ייזום, שיווק ותיווך נדל״ן', phone: '055-981-1814', site: 'www.afikhanahal.co.il' }
const fmtILS = n => (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) ? '' : Number(n).toLocaleString('he-IL') + ' ₪'
const HE_AREA = 'השרון והמרכז'

// Sections that carry sales substance; the rest (contact, upload counts) stay out of the video
const VIDEO_SECTIONS = new Set(['property', 'features', 'condition', 'building', 'marketing', 'deal', 'legal'])

export function videoPack(row, ov = {}) {
  const a = publicAnswers(row.answers || {})
  const rental = purposeOf(a) === 'rental'
  const title = ov.title || headline(a, 'he') || 'נכס חדש'
  const price = ov.price || row.asking_price || a.d_ask
  // Always regenerate the story from the PUBLIC answers: the stored row.story is the office version
  // and carries the minimum price and offers, which must never reach a client-facing video.
  const story = (() => { try { return storyText(a, 'he') } catch { return '' } })()
  const sections = buildSummary(a, 'he').filter(s => VIDEO_SECTIONS.has(s.section))
  const mk = marketingTexts(a, { phone: OFFICE.phone, brand: OFFICE.brand })
  const facts = [
    price ? [rental ? 'שכר דירה חודשי מבוקש' : 'מחיר מבוקש', fmtILS(price)] : null,
    roomsOf(a) ? ['חדרים', roomsOf(a)] : null,
    a.p_area?.built ? ['שטח בנוי', `${a.p_area.built} מ״ר`] : null,
    a.p_floor?.floor !== undefined && a.p_floor?.floor !== '' ? ['קומה', `${a.p_floor.floor}${a.p_floor.totalFloors ? ` מתוך ${a.p_floor.totalFloors}` : ''}`] : null,
    a.f_parking?.parking !== undefined ? ['חניות', String(a.f_parking.parking)] : null,
    ['סוג נכס', PROPERTY_TYPE_LABEL(a.p_type, 'he') || '—'],
    ['עיר', a.p_address?.city || '—'],
  ].filter(Boolean)

  // ── 1. Source document (what NotebookLM reads) ──
  const S = []
  S.push(`# ${title}`)
  S.push('')
  S.push(`${storyTitle(a, 'he')} · ${storyLine(a, 'he')}`)
  S.push(`משווק על ידי ${OFFICE.brand} · ${OFFICE.tagline} · טלפון ${OFFICE.phone} · ${OFFICE.site}`)
  S.push('')
  S.push('## נתוני מפתח')
  facts.forEach(([k, v]) => S.push(`- ${k}: ${v}`))
  S.push('')
  if (story) { S.push('## סיפור הנכס'); S.push(''); S.push(story); S.push('') }
  S.push('## מה משווקים')
  S.push('')
  if (a.m_pros) S.push(`- היתרונות לדעת הבעלים: ${a.m_pros}`)
  if (a.m_unique) S.push(`- מה מייחד את הנכס: ${a.m_unique}`)
  if (a.m_love) S.push(`- מה הבעלים הכי אוהבים בו: ${a.m_love}`)
  S.push(`- שורת המודעה: ${mk.short}`)
  S.push('')
  for (const sec of sections) {
    S.push(`## ${sec.title}`); S.push('')
    for (const it of sec.items) S.push(`- ${it.label}: ${String(it.value).replace(/\n+/g, ' ')}`)
    S.push('')
  }
  S.push('## פרטים ליצירת קשר')
  S.push(`- ${OFFICE.brand}, ${OFFICE.tagline}`)
  S.push(`- טלפון: ${OFFICE.phone}`)
  S.push(`- אתר: ${OFFICE.site}`)
  S.push('')
  S.push('הערה למספר: המסמך מתאר נכס אחד בלבד. אין להמציא פרטים שאינם מופיעים כאן.')
  const source = S.join('\n')

  // ── 2. Steering instructions for NotebookLM's Video Overview ──
  const brief = [
    `צור סרטון סקירה בעברית תקנית ורהוטה, בגוף שני רבים ("תוכלו", "תמצאו"), באורך של שתיים עד שלוש דקות, על הנכס "${title}" ${rental ? 'להשכרה' : 'למכירה'}.`,
    `קהל היעד: ${rental ? 'שוכרים פוטנציאליים' : 'רוכשים פוטנציאליים'} באזור ${HE_AREA}, וגם בעלי הנכס שרוצים לראות איך הנכס שלהם מוצג.`,
    `מבנה: פתיחה עם שם הנכס, העיר וסוג העסקה; נתוני המפתח (${facts.slice(0, 4).map(f => f[0]).join(', ')}); סיפור הנכס לפי הסדר במסמך; מה מייחד אותו; ${rental ? 'תנאי ההשכרה' : 'תנאי המכירה'}; סיום עם קריאה לפעולה ומספר הטלפון ${OFFICE.phone} של ${OFFICE.brand}.`,
    'טון: מקצועי, חם ואמין. בלי סופרלטיבים ריקים, בלי הבטחות שאינן במסמך, בלי המצאת פרטים. אם נתון חסר, פשוט אל תזכיר אותו.',
    'עברית: הקפד על התאמת מין ומספר (דירה מוארת, בית מרווח, משרד נגיש), מספרים במילים כשהם קטנים ("שלושה חדרים"), ומחירים בשקלים חדשים.',
    'ויזואלית: כותרות קצרות בעברית על המסך, נתון אחד לכל שקף, צבעים נקיים. ציין את שם המשרד "אפיק הנחל" בפתיחה ובסיום.',
  ].join('\n')

  // ── 3. Ready narration script (the office can also record or read it) ──
  const N = []
  N.push(`שלום, כאן ${OFFICE.brand}. היום נציג לכם ${storyTitle(a, 'he')}, ${rental ? 'להשכרה' : 'למכירה'}.`)
  if (facts.length) N.push(`בקצרה: ${facts.filter(f => f[0] !== 'סוג נכס' && f[0] !== 'עיר').map(f => `${f[0]} ${f[1]}`).join(', ')}.`)
  if (story) N.push(...String(story).split(/\n{2,}/).map(p => p.replace(/^[^\n]{2,40}\n/, '').trim()).filter(p => p.length > 30))
  if (a.m_unique || a.m_pros) N.push(`מה שמייחד את הנכס: ${[a.m_unique, a.m_pros].filter(Boolean).join('. ')}.`)
  N.push(`לתיאום ביקור ולפרטים נוספים, התקשרו ל${OFFICE.brand} בטלפון ${OFFICE.phone}, או היכנסו לאתר ${OFFICE.site}. נשמח ללוות אתכם.`)
  const script = N.join('\n\n')

  const safe = String(row.ref || 'property').replace(/[^\w.-]/g, '_')
  return { ok: true, title, filename: `${safe}-notebooklm.md`, source, brief, script, notebooklm: 'https://notebooklm.google.com/' }
}
