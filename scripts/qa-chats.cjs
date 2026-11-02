// QA for the admin's chats screen (the WhatsApp tab): opens a chat with fake data and presses every button in the header and
// the message box — notes, follow-up, pipeline stage, AI summary, templates (header menu, window, chips), "✓ טופל", emoji,
// attach, booking link, send, rename, next / previous / refresh / close, the list filters — checking that each one does its
// job and that typing inside a popover keeps the focus (a notes box once took one letter: Popover re-ran its autofocus on
// every keystroke). No network: every API is answered locally. Run after `npm run build`:  npm run qa:chats
// Prints PASS / FAIL per check and exits 1 on any FAIL; screenshots go to $QA_OUT (default /tmp/qa-chats).
const http = require('http'), fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const DIST = path.join(__dirname, '..', 'dist')
const S = process.env.QA_OUT || '/tmp/qa-chats'
fs.mkdirSync(path.join(S, 'bk'), { recursive: true })
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res)
}).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
let fails = 0
const now = Date.now()
const PHONE = '972528017218'
const lead = { id: 'L1', name: 'אנילה ניסימוב · זרובבל 15', phone: '0528017218', email: '', source: 'meta', created_at: new Date(now - 3 * 864e5).toISOString(), updated_at: new Date(now - 3600e3).toISOString(),
  crm_data: { leadStatus: 'discovery', notes: [], metaLeadId: 'm1', campaignName: 'זרובבל 15 - v2' } }
const hist = [
  { idMessage: 'a1', type: 'outgoing', typeMessage: 'textMessage', textMessage: 'היי אנילה, קיבלנו את הפרטים על זרובבל 15. נוח שנתקשר היום?', timestamp: Math.floor(now / 1000) - 90000, statusMessage: 'read', chatId: PHONE + '@c.us' },
  { idMessage: 'a2', type: 'incoming', typeMessage: 'textMessage', textMessage: 'לא', timestamp: Math.floor(now / 1000) - 86000, chatId: PHONE + '@c.us' },
  { idMessage: 'a3', type: 'outgoing', typeMessage: 'textMessage', textMessage: 'היי אנילה, מתי זה זמן נוח לדבר?', timestamp: Math.floor(now / 1000) - 7200, statusMessage: 'delivered', chatId: PHONE + '@c.us' },
  { idMessage: 'a4', type: 'incoming', typeMessage: 'textMessage', textMessage: 'אחרי שלוש', timestamp: Math.floor(now / 1000) - 3600, chatId: PHONE + '@c.us' },
]
const calls = []
const log = (ok, what, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${extra ? '  — ' + extra : ''}`) }
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: 1600, height: 950 }, locale: 'he-IL' })
  await ctx.addInitScript(() => { sessionStorage.setItem('afik_admin_session', '1'); localStorage.setItem('afik_admin_theme', 'light'); localStorage.setItem('afik_no_track', '1') })
  // storage uploads (signed URLs) are cross-origin PUTs: answer the preflight like Supabase does
  await ctx.route(/onrender\.com|supabase\.co/, r => r.fulfill({ json: [], headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS' } }))
  await ctx.route(/\/api\/properties/, r => r.fulfill({ json: [] }))
  await ctx.route(/\/api\/contacts/, async r => {
    const m = r.request().method()
    if (m === 'GET') return r.fulfill({ json: [lead] })
    calls.push({ api: 'contacts', m, body: r.request().postData() })
    return r.fulfill({ json: { ok: true } })
  })
  await ctx.route(/\/api\/(meta|seller-form|stats)/, async r => {
    const u = new URL(r.request().url()); const a = u.searchParams.get('action') || u.pathname.replace(/^\/api\/meta\/?/, '') || ''
    calls.push({ api: a, m: r.request().method(), body: r.request().postData() })
    if (a === 'chat-status') return r.fulfill({ json: { state: 'authorized' } })
    if (a.startsWith('chat-list')) return r.fulfill({ json: [{ chatId: PHONE + '@c.us', phone: PHONE, name: 'אנילה ניסימוב · זרובבל 15', timestamp: Math.floor(now / 1000) - 3600, type: 'incoming', text: 'אחרי שלוש', incoming: 2 }] })
    if (a === 'chat-history') return r.fulfill({ json: hist })
    if (a === 'chat-avatars') return r.fulfill({ json: { avatars: {} } })
    if (a === 'chat-summary') return r.fulfill({ json: { ok: true, summary: { summary: 'סיכום בדיקה', stage: 'meeting', followUpDays: 1, temperature: 'warm' } } })
    if (a === 'chat-waiting-done') { const b = JSON.parse(r.request().postData() || '{}'); const done = {}; for (const it of b.items || []) done[String(it.phone).replace(/\D/g, '').slice(-9)] = it.ts; return r.fulfill({ json: { ok: true, done } }) }
    if (a === 'chat-send') return r.fulfill({ json: { ok: true, idMessage: 'n' + Date.now() } })
    if (a === 'wizard-upload-url') { const b = JSON.parse(r.request().postData() || '{}'); return r.fulfill({ json: { signedUrl: `https://x.supabase.co/put/${b.name}`, url: `https://x.supabase.co/pub/${b.folder}/${b.name}` } }) }
    if (a === 'chat-send-files') { const b = JSON.parse(r.request().postData() || '{}'); return r.fulfill({ json: { ok: true, sent: (b.items || []).length, total: (b.items || []).length } }) }
    if (a === 'auto-config') return r.fulfill({ json: r.request().method() === 'GET' ? { config: { templates: {} } } : { ok: true } })
    return r.fulfill({ json: {} })
  })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message)))
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text().slice(0, 200)) })
  await p.goto(`${BASE}/admin-panel/chats`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const row = p.getByText('אנילה ניסימוב', { exact: false }).first()
  await row.click()
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${S}/bk/qa-1-open.png` })
  const typeCheck = async (loc, txt, label) => {
    await loc.click(); await loc.pressSequentially(txt, { delay: 25 })
    const v = await loc.inputValue().catch(() => '')
    log(v.includes(txt), `${label}: typing keeps the focus`, `got "${v}"`)
  }
  const hdr = p.locator('body')
  // 1. Notes
  try {
    await p.getByRole('button', { name: 'הערות' }).first().click()
    const ta = p.getByRole('textbox', { name: 'הערה חדשה' })
    await typeCheck(ta, 'שיחה טובה, רוצים פגישה', 'Notes')
    const before = calls.length
    await p.getByRole('button', { name: 'הוספת הערה' }).click(); await p.waitForTimeout(600)
    const patched = calls.slice(before).some(c => c.api === 'contacts' && c.m === 'PATCH' && /שיחה טובה/.test(c.body || ''))
    log(patched, 'Notes: save sends the note')
    log(await p.getByText('נשמר בכל המסכים').isVisible().catch(() => false), 'Notes: "saved" shown')
    await p.screenshot({ path: `${S}/bk/qa-2-notes.png` })
    await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  } catch (e) { log(false, 'Notes', e.message.split('\n')[0]) }
  // 2. Follow-up
  try {
    await p.getByRole('button', { name: /פולו אפ/ }).first().click(); await p.waitForTimeout(300)
    const inp = p.locator('.tpi input').first()
    await typeCheck(inp, 'להתקשר לתאם פגישה', 'Follow-up text')
    await p.keyboard.press('Escape')   // closes the presets list only
    await p.waitForTimeout(200)
    const still = await inp.isVisible().catch(() => false)
    log(still, 'Follow-up: Esc closes the presets list, not the window')
    const before = calls.length
    const save = p.locator('.fu-save').first()
    log(await save.isEnabled(), 'Follow-up: save enabled')
    await save.click(); await p.waitForTimeout(600)
    log(calls.slice(before).some(c => c.api === 'contacts' && c.m === 'PATCH' && /followup/.test(c.body || '')), 'Follow-up: save sends a task')
    await p.screenshot({ path: `${S}/bk/qa-3-followup.png` })
    await p.keyboard.press('Escape'); await p.mouse.click(5, 500); await p.waitForTimeout(300)
  } catch (e) { log(false, 'Follow-up', e.message.split('\n')[0]) }
  // 3. Stage menu
  try {
    const stageBtn = p.locator('button[title="שלב"]').first()
    await stageBtn.click(); await p.waitForTimeout(300)
    await p.screenshot({ path: `${S}/bk/qa-4-stage.png` })
    const opt = p.getByRole('option').filter({ hasText: 'פגישה' }).first()
    const before = calls.length
    await opt.click(); await p.waitForTimeout(600)
    log(calls.slice(before).some(c => c.api === 'contacts' && /meeting/.test(c.body || '')), 'Stage: moving sends the stage')
  } catch (e) { log(false, 'Stage menu', e.message.split('\n')[0]) }
  // 4. AI summary
  try {
    const before = calls.length
    await p.getByRole('button', { name: /סיכום AI/ }).first().click(); await p.waitForTimeout(900)
    log(calls.slice(before).some(c => c.api === 'chat-summary'), 'AI summary: asks the server')
    await p.screenshot({ path: `${S}/bk/qa-5-ai.png` })
    await p.keyboard.press('Escape'); await p.mouse.click(5, 500); await p.waitForTimeout(300)
  } catch (e) { log(false, 'AI summary', e.message.split('\n')[0]) }
  // 5. Templates menu in the header
  try {
    await p.getByRole('button', { name: /^תבניות/ }).first().click(); await p.waitForTimeout(400)
    const s = p.locator('input[type=search], input[placeholder*="חיפוש"]').last()
    await typeCheck(s, 'פגישה', 'Templates menu search')
    await p.screenshot({ path: `${S}/bk/qa-6-tpl.png` })
    await p.keyboard.press('Escape'); await p.waitForTimeout(300)
    log(!(await p.locator('div.ctp-in[role=dialog]').isVisible().catch(() => false)), 'Templates menu closes with Esc')
  } catch (e) { log(false, 'Templates menu', e.message.split('\n')[0]) }
  // ✓ handled (before we send — our message ends the wait by itself)
  try {
    const handled = p.locator('.wa-wb-btn').first()
    const before = calls.length
    await handled.click(); await p.waitForTimeout(500)
    log(calls.slice(before).some(c => c.api === 'chat-waiting-done'), '"✓ טופל" saves')
    log(!(await handled.isVisible().catch(() => false)), '"✓ טופל" disappears')
  } catch (e) { log(false, 'Handled', e.message.split('\n')[0]) }
  // 6. Composer
  try {
    const box = p.locator('textarea').last()
    await typeCheck(box, 'בדיקה של הודעה', 'Message box')
    await p.getByRole('button', { name: 'קישור לקביעת שיחה' }).first().click(); await p.waitForTimeout(200)
    log(/afikhanahal\.co\.il\/book/.test(await box.inputValue()), 'Booking link button inserts the link')
    const before = calls.length
    await p.locator('.ccm-send').click(); await p.waitForTimeout(800)
    log(calls.slice(before).some(c => c.api === 'chat-send'), 'Send button sends')
    log((await box.inputValue()) === '', 'Box clears after sending')
    await p.getByRole('button', { name: 'אימוג׳י' }).first().click(); await p.waitForTimeout(200)
    const em = p.locator('.ccm-emoji button').first()
    log(await em.isVisible(), 'Emoji button opens the emoji row')
    await em.click(); log((await box.inputValue()).length > 0, 'Emoji goes into the box')
    await p.getByRole('button', { name: 'אימוג׳י' }).first().click()
    const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), p.locator('button[aria-label^="צירוף קבצים"]').first().click()])
    log(!!fc, 'Attach button opens the file picker')
    await box.fill('')
    await p.locator('.ccm-tpl').click(); await p.waitForTimeout(500)
    await p.screenshot({ path: `${S}/bk/qa-7-picker.png` })
    const dlg = p.locator('.ctp-list').first()
    log(await dlg.isVisible().catch(() => false), 'Composer "תבניות" opens the templates window')
    await p.keyboard.press('Escape'); await p.waitForTimeout(300)
    log(!(await dlg.isVisible().catch(() => false)), 'Templates window closes with Esc')
  } catch (e) { log(false, 'Composer', e.message.split('\n')[0]) }
  // files: several at once, photos first, saved to a template, sent as one group
  try {
    const box = p.locator('textarea').last()
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    const [fc] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }), p.locator('button[aria-label^="צירוף קבצים"]').first().click()])
    await fc.setFiles([{ name: 'מחירון.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') }, { name: 'a.png', mimeType: 'image/png', buffer: png }, { name: 'b.png', mimeType: 'image/png', buffer: png }])
    await p.waitForTimeout(500)
    const names = await p.locator('[role=listitem][title]').evaluateAll(xs => xs.map(x => x.getAttribute('title')))
    log(JSON.stringify(names) === JSON.stringify(['a.png', 'b.png', 'מחירון.pdf']), 'Tray puts the photos first (one album)', JSON.stringify(names))
    log(await p.getByText(/3 קבצים · יישלחו יחד/).first().isVisible().catch(() => false), 'Tray says the files go together')
    await p.screenshot({ path: `${S}/bk/qa-7b-tray.png` })
    await p.getByRole('button', { name: 'שמירה לתבנית' }).first().click(); await p.waitForTimeout(400)
    const dlg = p.getByRole('dialog', { name: 'שמירת הקבצים בתבנית' })
    log(await dlg.isVisible().catch(() => false), '"שמירה לתבנית" opens the window')
    await typeCheck(dlg.locator('input').first(), 'פגישה', 'Save-to-template search')
    await p.screenshot({ path: `${S}/bk/qa-7c-savetpl.png` })
    const before = calls.length
    await dlg.getByRole('button', { name: /הוספה/ }).first().click(); await p.waitForTimeout(1500)
    await p.screenshot({ path: `${S}/bk/qa-7d-saved.png` })
    const status = await dlg.locator('[role=status]').textContent().catch(() => '')
    const post = calls.slice(before).find(c => c.api === 'auto-config' && c.m === 'POST')
    const saved = post ? Object.values(JSON.parse(post.body).config.templates || {}).flatMap(t => t.files || []) : []
    log(saved.length === 3 && saved.every(f => /^https:\/\/x\.supabase\.co\/pub\/templates\//.test(f.url)), 'Files saved on the template (uploaded to templates/)', JSON.stringify(saved.map(f => f.name)) + ' ' + status)
    await p.waitForTimeout(1200)
    log(!(await dlg.isVisible().catch(() => false)), 'The window closes after saving')
    if (await dlg.isVisible().catch(() => false)) await p.keyboard.press('Escape')
    await box.fill('התמונות של הדירה')
    const b2 = calls.length
    await p.locator('.ccm-send').click(); await p.waitForTimeout(1500)
    const sends = calls.slice(b2).filter(c => c.api === 'chat-send-files')
    const body = sends[0] ? JSON.parse(sends[0].body) : {}
    log(sends.length === 1 && body.items?.length === 3 && body.caption === 'התמונות של הדירה', 'The files go in one group request with the text as caption', JSON.stringify({ n: sends.length, items: body.items?.map(x => x.fileName) }))
    log(!calls.slice(b2).some(c => c.api === 'chat-send'), 'No file goes one by one')
    log((await p.locator('[role=listitem][title]').count()) === 0, 'The tray clears after sending')
  } catch (e) { log(false, 'Files', e.message.split('\n')[0]) }
  // chips over the box
  try {
    const all = p.getByRole('button', { name: /כל התבניות/ }).first()
    await all.click(); await p.waitForTimeout(400)
    log(await p.locator('.ctp-list').first().isVisible().catch(() => false), '"כל התבניות" opens the window')
    await p.keyboard.press('Escape'); await p.waitForTimeout(300)
    await p.getByRole('button', { name: /הודעות נכסים/ }).first().click(); await p.waitForTimeout(300)
    await p.screenshot({ path: `${S}/bk/qa-8-props.png` })
    log(true, '"הודעות נכסים" clicks (see screenshot)')
    await p.keyboard.press('Escape'); await p.mouse.click(700, 500); await p.waitForTimeout(200)
  } catch (e) { log(false, 'Chips', e.message.split('\n')[0]) }
  // header buttons
  try {
    for (const name of ['ליד הבא', 'ליד קודם']) log(await p.locator(`button[title="${name}"]`).first().isDisabled(), `"${name}" is disabled with one chat`)
    const before = calls.length
    await p.locator('button[title="רענן"]').first().click(); await p.waitForTimeout(500)
    log(calls.slice(before).some(c => c.api === 'chat-history'), 'Refresh reloads the chat')
    const heads = await p.locator('button').evaluateAll(bs => bs.filter(b => b.offsetParent && b.getBoundingClientRect().top < 320 && b.getBoundingClientRect().top > 230).map(b => (b.getAttribute('aria-label') || b.title || b.textContent || '').trim().slice(0, 30)))
    console.log('HEADER BUTTONS:', JSON.stringify(heads))
  } catch (e) { log(false, 'Header', e.message.split('\n')[0]) }
  // 7. Name edit
  try {
    await p.locator('button[title*="שם"], [aria-label*="שינוי שם"], [aria-label*="עריכת שם"]').first().click(); await p.waitForTimeout(300)
    const n = p.locator('input[aria-label*="שם"]').first()
    await n.fill(''); await n.pressSequentially('אנילה בדיקה', { delay: 25 })
    log((await n.inputValue()) === 'אנילה בדיקה', 'Rename: typing keeps the focus')
    await p.keyboard.press('Escape'); await p.waitForTimeout(200)
  } catch (e) { log(false, 'Rename', e.message.split('\n')[0]) }
  try {
    await p.locator('button[title="סגור"]').first().click(); await p.waitForTimeout(300)
    log(!(await p.locator('.ccm-send').isVisible().catch(() => false)), 'Close (✕) closes the chat')
    for (const f of ['ממתינים לתשובה', 'לא נקראו', 'הכל']) { await p.getByText(f, { exact: false }).first().click({ timeout: 5000 }); await p.waitForTimeout(200) }
    log(true, 'List filters click')
    await p.locator('button[title="שיחה חדשה"], button[aria-label="שיחה חדשה"]').first().click(); await p.waitForTimeout(300)
    await p.screenshot({ path: `${S}/bk/qa-9-new.png` })
  } catch (e) { log(false, 'List', e.message.split('\n')[0]) }
  await p.screenshot({ path: `${S}/bk/qa-9-end.png` })
  console.log('ERRORS:', errs.length ? errs.slice(0, 8).join(' | ') : 'none')
  await b.close()
  server.close()
  if (errs.length) fails++
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); server.close(); process.exit(1) })
