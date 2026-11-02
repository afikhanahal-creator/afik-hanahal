// QA of voice dictation (src/VoiceDictate.jsx) with a fake speech engine (two sessions of Hebrew phrases, then silence): in the
// chats tab's notes box and a follow-up task box — the words appear live, every phrase reaches the polish once, the polished
// Hebrew replaces them, "לטקסט כפי שנאמר" puts the raw text back, the note saves, a task comes back as one short line.
// No network: every API is answered locally. Run after `npm run build`:  npm run qa:dictation  (exit 1 on any FAIL)
const http = require('http'), fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const DIST = path.join(__dirname, '..', 'dist')
const S = process.env.QA_OUT || '/tmp/qa-dictation'
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
  await ctx.addInitScript(() => {
    // a fake speech engine: speaks two phrases per session, the second session ends the talk
    let n = 0
    window.webkitSpeechRecognition = function () {
      const me = this; n++
      const phrases = (n % 3) === 1 ? ['דיברנו עם רונן ', 'הוא מחפש ארבעה חדרים בכפר סבא'] : (n % 3) === 2 ? ['תקציב שלוש וחצי מיליון'] : []
      me.start = () => {
        if (!phrases.length) return   // silence: waits for the stop
        let i = 0
        const step = () => {
          if (me._stopped) return
          if (i < phrases.length) {
            const res = phrases.slice(0, i + 1).map((t, k) => Object.assign([{ transcript: t }], { isFinal: k < i }))
            me.onresult?.({ results: res, resultIndex: i }); i++; setTimeout(step, 120)
          } else {
            const res = phrases.map(t => Object.assign([{ transcript: t }], { isFinal: true }))
            me.onresult?.({ results: res, resultIndex: 0 }); setTimeout(() => me.onend?.(), 80)
          }
        }
        setTimeout(step, 100)
      }
      me.stop = () => { me._stopped = true; setTimeout(() => me.onend?.(), 30) }
      me.abort = me.stop
    }
    window.SpeechRecognition = window.webkitSpeechRecognition
 sessionStorage.setItem('afik_admin_session', '1'); localStorage.setItem('afik_admin_theme', 'light'); localStorage.setItem('afik_no_track', '1') })
  await ctx.route(/onrender\.com|supabase\.co/, r => r.fulfill({ json: [] }))
  await ctx.route(/\/api\/properties/, r => r.fulfill({ json: [] }))
  await ctx.route(/\/api\/contacts/, async r => {
    const m = r.request().method()
    if (m === 'GET') return r.fulfill({ json: [lead] })
    calls.push({ api: 'contacts', m, body: r.request().postData() })
    return r.fulfill({ json: { ok: true } })
  })
  await ctx.route(/\/api\/(meta|seller-form|stats)/, async r => {
    const u = new URL(r.request().url()); const a = u.pathname.replace(/^\/api\/meta\/?/, '') || u.searchParams.get('action') || ''
    calls.push({ api: a, m: r.request().method(), body: r.request().postData() })
    if (a === 'chat-status') return r.fulfill({ json: { state: 'authorized' } })
    if (a.startsWith('chat-list')) return r.fulfill({ json: [{ chatId: PHONE + '@c.us', phone: PHONE, name: 'אנילה ניסימוב · זרובבל 15', timestamp: Math.floor(now / 1000) - 3600, type: 'incoming', text: 'אחרי שלוש', incoming: 2 }] })
    if (a === 'chat-history') return r.fulfill({ json: hist })
    if (a === 'chat-avatars') return r.fulfill({ json: { avatars: {} } })
    if (a === 'chat-summary') return r.fulfill({ json: { ok: true, summary: { summary: 'סיכום בדיקה', stage: 'meeting', followUpDays: 1, temperature: 'warm' } } })
    if (a === 'chat-waiting-done') { const b = JSON.parse(r.request().postData() || '{}'); const done = {}; for (const it of b.items || []) done[String(it.phone).replace(/\D/g, '').slice(-9)] = it.ts; return r.fulfill({ json: { ok: true, done } }) }
    if (a === 'dictation-polish') { const b = JSON.parse(r.request().postData() || '{}'); calls.push({ api: 'polish-in', body: b.text }); return r.fulfill({ json: b.kind === 'task' ? { text: 'להתקשר לרונן לגבי 4 חדרים בכפר סבא', summary: '' } : { text: 'דיברנו עם רונן. הוא מחפש 4 חדרים בכפר סבא, תקציב 3.5 מיליון.', summary: '' } }) }
    if (a === 'chat-send') return r.fulfill({ json: { ok: true, idMessage: 'n' + Date.now() } })
    return r.fulfill({ json: {} })
  })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message)))
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text().slice(0, 200)) })
  await p.goto(`${BASE}/admin-panel/chats`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  const row = p.getByText('אנילה ניסימוב', { exact: false }).first()
  await row.click(); await p.waitForTimeout(1200)
  // notes popover
  await p.getByRole('button', { name: 'הערות' }).first().click(); await p.waitForTimeout(300)
  const ta = p.getByRole('textbox', { name: 'הערה חדשה' })
  const mic = p.locator('.vd-btn').first()
  await mic.click(); await p.waitForTimeout(250)
  log(await mic.evaluate(b => b.classList.contains('rec')), 'Mic: recording state shown')
  await p.waitForTimeout(500)
  const live = await ta.inputValue()
  log(/דיברנו עם רונן/.test(live), 'Mic: words appear live in the box', live)
  await p.screenshot({ path: `${S}/bk/dict-1-live.png` })
  await p.waitForTimeout(700)
  await mic.click(); await p.waitForTimeout(1200)
  const fin = await ta.inputValue()
  const sent = calls.find(c => c.api === 'polish-in')
  log(!!sent && !/(דיברנו עם רונן).*\1/.test(sent.body), 'Mic: polish gets every phrase once', sent && sent.body)
  log(fin === 'דיברנו עם רונן. הוא מחפש 4 חדרים בכפר סבא, תקציב 3.5 מיליון.', 'Mic: box shows the polished Hebrew', fin)
  await p.screenshot({ path: `${S}/bk/dict-2-polished.png` })
  const undo = p.locator('.vd-tip button').first()
  await undo.click(); await p.waitForTimeout(200)
  log(/דיברנו עם רונן הוא מחפש/.test(await ta.inputValue()), '"כפי שנאמר" restores the raw text', await ta.inputValue())
  log(await ta.isVisible(), 'Notes popover stays open after the undo')
  await p.locator('.vd-tip button').first().click(); await p.waitForTimeout(200)
  await p.getByRole('button', { name: 'הוספת הערה' }).click(); await p.waitForTimeout(500)
  log(calls.some(c => c.api === 'contacts' && /3\.5 מיליון/.test(c.body || '')), 'The dictated note is saved')
  await p.keyboard.press('Escape'); await p.waitForTimeout(300)
  // follow-up (task box)
  await p.getByRole('button', { name: /פולו אפ/ }).first().click(); await p.waitForTimeout(400)
  const tmic = p.locator('.tpi .vd-btn').first()
  log(await tmic.isVisible(), 'Task box has a mic')
  await tmic.click(); await p.waitForTimeout(1300); await tmic.click(); await p.waitForTimeout(1200)
  const tv = await p.locator('.tpi input').first().inputValue()
  log(tv === 'להתקשר לרונן לגבי 4 חדרים בכפר סבא', 'Task: polished as one short line', tv)
  await p.screenshot({ path: `${S}/bk/dict-3-task.png` })
  console.log('ERRORS:', errs.length ? errs.slice(0, 8).join(' | ') : 'none')
  await b.close(); server.close(); process.exit(fails || errs.length ? 1 : 0)
})().catch(e => { console.error(e); server.close(); process.exit(1) })
