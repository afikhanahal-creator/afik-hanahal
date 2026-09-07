// Independent archive of every submitted questionnaire: a private GitHub repository owned by the
// office (afikhanahal-creator/afik-hanahal-records). Each form is committed as
//   records/<YYYY>/<MM>/<ref>.json   – the full record (answers, files, story, journey)
//   records/<YYYY>/<MM>/<ref>.md     – a readable summary (opens in the browser, prints, searchable)
// It runs on every submission, next to Supabase, so the data has a second home the office controls,
// with version history, and with GitHub's own search across all forms.
// Needs GITHUB_ARCHIVE_TOKEN (fine-grained PAT with "Contents: write" on that repo) in Vercel.
import { buildSummary, headline, purposeOf, PROPERTY_TYPE_LABEL, DOC_TAG_LABEL } from '../src/sellerFormSchema.js'

const TOKEN = process.env.GITHUB_ARCHIVE_TOKEN || ''
const REPO  = process.env.GITHUB_ARCHIVE_REPO || 'afikhanahal-creator/afik-hanahal-records'
const API   = `https://api.github.com/repos/${REPO}/contents`
const H = { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'afik-hanahal-intake' }

export const archiveEnabled = () => !!TOKEN
export const archiveRepoUrl = () => `https://github.com/${REPO}`

const KIND_HE = { photos: 'תמונות', videos: 'סרטונים', plan: 'תוכניות', docs: 'מסמכים' }
const fmtILS = n => (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) ? '' : Number(n).toLocaleString('he-IL') + ' ₪'

export function recordMarkdown(rec) {
  const a = rec.answers || {}
  const rental = purposeOf(a) === 'rental'
  const when = rec.submitted_at || rec.backed_up_at || new Date().toISOString()
  const j = rec.meta?.journey || {}
  const L = []
  L.push(`# ${headline(a, 'he') || 'נכס חדש'}`)
  L.push('')
  L.push(`**תיק:** ${rec.ref || '—'} · **סוג עסקה:** ${rental ? 'השכרה' : 'מכירה'} · **התקבל:** ${new Date(when).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}${rec.backup ? ' · ⚠️ נשמר כשסופאבייס לא היה זמין' : ''}`)
  L.push('')
  L.push('## איש קשר')
  L.push(`- **שם:** ${rec.contact_name || a.c_name || '—'}`)
  L.push(`- **טלפון:** ${rec.phone || a.c_phone || '—'}`)
  if (rec.email || a.c_email) L.push(`- **אימייל:** ${rec.email || a.c_email}`)
  L.push('')
  L.push('## נתוני מפתח')
  L.push(`- **סוג נכס:** ${PROPERTY_TYPE_LABEL(rec.property_type || a.p_type, 'he') || '—'}`)
  L.push(`- **כתובת:** ${[rec.address, rec.city].filter(Boolean).join(', ') || '—'}`)
  if (rec.asking_price || a.d_ask) L.push(`- **${rental ? 'שכר דירה מבוקש' : 'מחיר מבוקש'}:** ${fmtILS(rec.asking_price || a.d_ask)}`)
  L.push('')
  if (rec.story) { L.push('## סיפור הנכס'); L.push(''); L.push(String(rec.story)); L.push('') }
  try {
    for (const sec of buildSummary(a, 'he')) {
      L.push(`## ${sec.title}`); L.push(''); L.push('| שדה | תשובה |'); L.push('|---|---|')
      for (const it of sec.items) L.push(`| ${String(it.label).replace(/\|/g, '/')} | ${String(it.value).replace(/\|/g, '/').replace(/\n+/g, '<br>')} |`)
      L.push('')
    }
  } catch {}
  const files = rec.files || []
  if (files.length) {
    L.push(`## קבצים (${files.length})`); L.push('')
    for (const f of files) L.push(`- ${KIND_HE[f.kind] || f.kind}: ${f.name || f.path}${f.tag ? ` · ${DOC_TAG_LABEL(f.tag, 'he')}` : ''} — \`${f.path}\``)
    L.push(''); L.push('הקבצים עצמם שמורים ב-Supabase Storage (bucket `seller-uploads`) תחת הנתיבים שלמעלה.'); L.push('')
  }
  if (j.opened_at || j.started_at) { L.push('## מסע הלקוח'); L.push(''); L.push(`- נפתח: ${j.opened_at || '—'}`); L.push(`- התחיל: ${j.started_at || '—'}`); L.push(`- מכשיר: ${j.device || '—'} · מקור: ${j.source || '—'}`); L.push('') }
  L.push('---'); L.push(`_נוצר אוטומטית ממערכת קליטת הנכסים של אפיק הנחל · ${rec.sid || ''}_`)
  return L.join('\n')
}

async function putFile(path, content, message) {
  const body = { message, content: Buffer.from(content, 'utf8').toString('base64') }
  let r = await fetch(`${API}/${path}`, { method: 'PUT', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) })
  if (r.status === 422 || r.status === 409) {
    // file exists (re-submission / restore): fetch its sha and overwrite
    const g = await fetch(`${API}/${path}`, { headers: H, signal: AbortSignal.timeout(15000) })
    const cur = g.ok ? await g.json().catch(() => ({})) : {}
    if (cur.sha) r = await fetch(`${API}/${path}`, { method: 'PUT', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ ...body, sha: cur.sha }), signal: AbortSignal.timeout(15000) })
  }
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}`)
  const d = await r.json().catch(() => ({}))
  return d.content?.html_url || `https://github.com/${REPO}/blob/main/${path}`
}

const README = `# ארכיון שאלוני נכסים · אפיק הנחל

כל שאלון שנשלח דרך https://www.afikhanahal.co.il/newproperty נשמר כאן אוטומטית, במקביל למערכת האתר:

- \`records/<שנה>/<חודש>/<מספר תיק>.md\` – סיכום קריא: איש קשר, נתוני מפתח, סיפור הנכס, כל התשובות לפי נושאים, רשימת קבצים.
- \`records/<שנה>/<חודש>/<מספר תיק>.json\` – הרשומה המלאה כפי שנשמרה (לייבוא, גיבוי או עיבוד).

הקבצים עצמם (תמונות, סרטונים, מסמכים) נשארים ב-Supabase Storage; הנתיבים שלהם רשומים בכל רשומה.

חיפוש: השתמשו בחיפוש של GitHub בתוך המאגר (שם, טלפון, עיר, מספר תיק). היסטוריית הגרסאות של כל קובץ נשמרת אוטומטית.
`
let readmeChecked = false
async function ensureReadme() {
  if (readmeChecked) return
  readmeChecked = true
  try {
    const g = await fetch(`${API}/README.md`, { headers: H, signal: AbortSignal.timeout(10000) })
    const cur = g.ok ? await g.json().catch(() => ({})) : {}
    const existing = cur.content ? Buffer.from(cur.content, 'base64').toString('utf8') : ''
    if (!existing.includes('ארכיון שאלוני נכסים')) await putFile('README.md', README, 'README: מבנה הארכיון')
  } catch (e) { console.warn('[intake] archive README:', e.message) }
}

// Writes <ref>.json + <ref>.md. Returns { ok, url } — never throws (archiving must not break a submission).
export async function archiveSubmission(rec) {
  if (!TOKEN) return { ok: false, error: 'GITHUB_ARCHIVE_TOKEN not configured' }
  try {
    await ensureReadme()
    const when = new Date(rec.submitted_at || rec.backed_up_at || Date.now())
    const dir = `records/${when.getUTCFullYear()}/${String(when.getUTCMonth() + 1).padStart(2, '0')}`
    const safe = String(rec.ref || rec.sid || 'record').replace(/[^\w.-]/g, '_')
    const msg = `${rec.ref || safe} · ${rec.contact_name || ''} · ${headline(rec.answers || {}, 'he')}`.slice(0, 120)
    const { blob_url, ...clean } = rec
    await putFile(`${dir}/${safe}.json`, JSON.stringify(clean, null, 2), msg)
    const url = await putFile(`${dir}/${safe}.md`, recordMarkdown(rec), msg)
    return { ok: true, url }
  } catch (e) {
    console.error('[intake] archive failed:', e.message)
    return { ok: false, error: e.message }
  }
}
