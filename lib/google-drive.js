// Google Drive for the documents module — a SYNC TARGET only (the database and the private bucket stay the source of truth):
// every sent PDF, every signed PDF and every uploaded template is also filed in the office's own Drive, in a fixed tree
//   Afik HaNahal / Documents / Projects / <project> / { Sent Documents, Signed Documents }   (General/ for a document without a project)
//   Afik HaNahal / Documents / Templates · Archived
// The same Google OAuth client as the calendar (GOOGLE_OAUTH_CLIENT_ID / _SECRET, the booking callback URL) with the
// `drive.file` scope — the app sees only the files it created, nothing else in the Drive. The refresh token is kept in
// app_settings.google_drive (service role only), never in code or in the browser. Enable "Google Drive API" in the same
// Google Cloud project before connecting.
import { getSetting, putSetting } from './automations.js'
import { sign, tokenCall, emailOf, REDIRECT_URI, oauthReady } from './google-calendar.js'

const KEY = 'google_drive'
const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'openid', 'email']
const API = 'https://www.googleapis.com'
export const FOLDER_MIME = 'application/vnd.google-apps.folder'

// ── OAuth (the state carries ".drive." so the shared callback knows whose code it is) ──────────────────────────────
export const makeState = (now = Date.now()) => `${now}.drive.${sign(`drive.${now}`)}`
export const isDriveState = s => /^\d+\.drive\./.test(String(s || ''))
export function stateValid(state, now = Date.now()) {
  const [t, kind, sig] = String(state || '').split('.')
  if (kind !== 'drive' || !t || !sig || sig !== sign(`drive.${t}`)) return false
  return now - Number(t) < 20 * 60e3
}
export function authUrl() {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || '', redirect_uri: REDIRECT_URI(), response_type: 'code', scope: SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: makeState(), login_hint: 'afik.hanahal@gmail.com',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}
export async function connect(code) {
  const d = await tokenCall({ code, grant_type: 'authorization_code', redirect_uri: REDIRECT_URI() })
  const prev = (await getSetting(KEY)).value || {}
  const refresh = d.refresh_token || prev.refresh_token
  if (!refresh) throw new Error('Google לא החזיר הרשאה קבועה. נסו שוב (הסירו את הגישה בחשבון גוגל ואז חברו מחדש).')
  if (!/drive\.file/.test(d.scope || '')) throw new Error('ההרשאה ל-Google Drive לא אושרה. חברו שוב ואשרו את הגישה לקבצים.')
  const email = emailOf(d.id_token) || prev.email || ''
  await putSetting(KEY, { refresh_token: refresh, email, scope: d.scope || '', connectedAt: new Date().toISOString(), error: null, folders: {} })
  cache = { token: d.access_token, exp: Date.now() + (d.expires_in || 3000) * 1000 - 60e3 }
  return { email }
}
export async function disconnect() {
  const s = (await getSetting(KEY)).value
  if (s?.refresh_token) fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(s.refresh_token)}`, { method: 'POST', signal: AbortSignal.timeout(5000) }).catch(() => {})
  await putSetting(KEY, null)
  cache = null
}
/** → { connected, email, connectedAt, error, oauthReady, root } — never the token */
export async function status() {
  const s = (await getSetting(KEY)).value
  return { connected: !!s?.refresh_token, email: s?.email || '', connectedAt: s?.connectedAt || null, error: s?.error || null, oauthReady: oauthReady(), root: s?.rootLink || '' }
}
export async function connected() { return !!((await getSetting(KEY)).value?.refresh_token) }

let cache = null
async function accessToken() {
  if (cache && cache.exp > Date.now()) return cache.token
  const s = (await getSetting(KEY)).value
  if (!s?.refresh_token) return null
  try {
    const d = await tokenCall({ refresh_token: s.refresh_token, grant_type: 'refresh_token' })
    cache = { token: d.access_token, exp: Date.now() + (d.expires_in || 3000) * 1000 - 60e3 }
    if (s.error) putSetting(KEY, { ...s, error: null }).catch(() => {})
    return cache.token
  } catch (e) {
    if (e.code === 'invalid_grant') await putSetting(KEY, { ...s, error: 'החיבור ל-Google Drive פג. צריך לחבר מחדש.' }).catch(() => {})
    throw e
  }
}
async function gd(path, opts = {}) {
  const token = await accessToken()
  if (!token) throw new Error('Google Drive לא מחובר')
  const r = await fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) }, signal: AbortSignal.timeout(opts.timeout || 15000) })
  if (r.status === 204) return {}
  const d = await r.json().catch(() => ({}))
  if (!r.ok) { const e = new Error(`Google Drive ${r.status}: ${d.error?.message || ''}`.trim()); e.status = r.status; throw e }
  return d
}
const q = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

// ── folders ────────────────────────────────────────────────────────────────────────────────────────────────
async function findFolder(name, parentId) {
  const d = await gd(`/drive/v3/files?${new URLSearchParams({ q: `name = '${q(name)}' and mimeType = '${FOLDER_MIME}' and '${parentId || 'root'}' in parents and trashed = false`, fields: 'files(id,name,webViewLink)', pageSize: '5', spaces: 'drive' })}`)
  return d.files?.[0] || null
}
async function createFolder(name, parentId) {
  return gd('/drive/v3/files?fields=id,name,webViewLink', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }) })
}
/** the folder for a path (made when missing); ids cached in the setting (a deleted folder is re-made on the next miss) */
export async function ensureFolderPath(parts, { fresh = false } = {}) {
  const s = (await getSetting(KEY)).value || {}
  const folders = { ...(s.folders || {}) }
  let parentId = '', changed = false
  for (let i = 0; i < parts.length; i++) {
    const key = parts.slice(0, i + 1).join('/')
    let id = fresh ? '' : folders[key]
    if (id) { try { await gd(`/drive/v3/files/${id}?fields=id,trashed`).then(f => { if (f.trashed) id = '' }) } catch { id = '' } }
    if (!id) {
      const f = (await findFolder(parts[i], parentId)) || (await createFolder(parts[i], parentId))
      id = f.id; folders[key] = id; changed = true
      if (i === 1 && f.webViewLink) s.rootLink = f.webViewLink
    }
    parentId = id
  }
  if (changed) await putSetting(KEY, { ...s, folders }).catch(() => {})
  return parentId
}

// ── files ──────────────────────────────────────────────────────────────────────────────────────────────────
/** the multipart body Drive's upload endpoint takes: JSON metadata + the bytes */
export function multipartBody(meta, bytes, mime, boundary = 'afik_doc_boundary') {
  const head = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`, 'utf8')
  const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8')
  return { body: Buffer.concat([head, Buffer.from(bytes), tail]), type: `multipart/related; boundary=${boundary}` }
}
/** upload a file (a new one in `parentId`, or a new version of `fileId` — Drive keeps the revisions) → { id, name, webViewLink, md5Checksum } */
export async function upload({ name, parentId, bytes, mime = 'application/pdf', fileId = '' }) {
  const meta = fileId ? { name } : { name, parents: [parentId] }
  const { body, type } = multipartBody(meta, bytes, mime)
  const fields = 'fields=id,name,webViewLink,md5Checksum,size'
  return gd(fileId ? `/upload/drive/v3/files/${fileId}?uploadType=multipart&${fields}` : `/upload/drive/v3/files?uploadType=multipart&${fields}`, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': type, 'Content-Length': String(body.length) }, body, timeout: 40000 })
}
export async function fileInfo(id) { return gd(`/drive/v3/files/${id}?fields=id,name,webViewLink,trashed,parents,md5Checksum,size,modifiedTime`) }
export async function rename(id, name) { return gd(`/drive/v3/files/${id}?fields=id,name`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }) }
