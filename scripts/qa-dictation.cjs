// QA of the voice input (src/SmartVoiceInput.jsx + src/lib/voiceService.js), end to end in Chromium with its fake microphone
// (a real MediaRecorder recording of a test tone) and every API answered locally:
//   server transcription: timer + waveform, pause / resume, finish → "מתמלל" → the exact text in the box, "סיכום שיחה" replaces
//   it, the tasks that were said are offered and created on the lead, "כפי שנאמר"; cancel leaves the box as it was; a failed
//   transcription keeps the audio and "נסו שוב" succeeds; a task box gives one line; a closed popover keeps recording in
//   VoiceHost; the browser's own recognition (no key) writes live; a phone gets the panel at the bottom.
// Run after `npm run build`:  npm run qa:dictation   (exit 1 on any FAIL; screenshots in $QA_OUT, default /tmp/qa-dictation)
const http = require('http'), fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const DIST = path.join(__dirname, '..', 'dist')
const S = process.env.QA_OUT || '/tmp/qa-dictation'
fs.mkdirSync(S, { recursive: true })
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname))
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res)
}).listen(0)
const BASE = `http://127.0.0.1:${server.address().port}`
let fails = 0
const log = (ok, what, extra = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${extra ? '  — ' + String(extra).slice(0, 160) : ''}`) }

const now = Date.now()
const PHONE = '972528017218'
const lead = { id: 'L1', name: 'אנילה ניסימוב', phone: '0528017218', source: 'meta', created_at: new Date(now - 3 * 864e5).toISOString(), updated_at: new Date(now - 3600e3).toISOString(), crm_data: { leadStatus: 'discovery', notes: [], tasks: [] } }
const hist = [{ idMessage: 'a1', type: 'incoming', typeMessage: 'textMessage', textMessage: 'שלום', timestamp: Math.floor(now / 1000) - 3600, chatId: PHONE + '@c.us' }]
const EXACT = 'דיברנו עם רונן. הוא מחפש 4 חדרים בכפר סבא, תקציב 3.5 מיליון ₪. צריך להתקשר אליו מחר בבוקר.'
const CALL = 'נושא השיחה:\n• דירת 4 חדרים בכפר סבא\n\nמחירים ותקציבים:\n• 3.5 מיליון ₪\n\nפעולות המשך:\n• להתקשר אליו מחר בבוקר'
const TASK = { title: 'להתקשר לרונן', description: 'לגבי 4 חדרים בכפר סבא', due: '2026-12-01T09:00', dueSaid: 'מחר בבוקר', owner: '', uncertain: false }

async function page(b, { provider = 'openai', viewport = { width: 1500, height: 950 }, failFirst = false, mobile = false } = {}) {
  const ctx = await b.newContext({ viewport, locale: 'he-IL', permissions: ['microphone'], ...(mobile ? { isMobile: true, hasTouch: true } : {}) })
  await ctx.addInitScript(([prov]) => {
    sessionStorage.setItem('afik_admin_session', '1'); localStorage.setItem('afik_admin_theme', 'light'); localStorage.setItem('afik_no_track', '1')
    if (!prov) {   // no server key: a fake browser recognition that "hears" two phrases
      window.SpeechRecognition = window.webkitSpeechRecognition = function () {
        const me = this; me.start = () => { setTimeout(() => me.onresult?.({ results: [Object.assign([{ transcript: 'דיברנו עם רונן' }], { isFinal: true }), Object.assign([{ transcript: ' הוא מחפש' }], { isFinal: false })] }), 150) }
        me.stop = () => setTimeout(() => me.onend?.(), 20); me.abort = me.stop
      }
    }
  }, [provider])
  const calls = []
  let transcribeN = 0
  await ctx.route(/onrender\.com|supabase\.co/, r => r.fulfill({ json: [] }))
  await ctx.route(/\/api\/properties/, r => r.fulfill({ json: [] }))
  await ctx.route(/\/api\/contacts/, async r => {
    if (r.request().method() === 'GET') return r.fulfill({ json: [lead] })
    calls.push({ api: 'contacts', body: r.request().postData() }); return r.fulfill({ json: { ok: true } })
  })
  await ctx.route(/\/api\/(meta|seller-form|stats)/, async r => {
    const u = new URL(r.request().url()); const a = u.pathname.replace(/^\/api\/meta\/?/, '')
    const req = r.request()
    calls.push({ api: a, size: (req.postDataBuffer() || Buffer.alloc(0)).length, type: req.headers()['content-type'], q: u.search, body: a === 'voice-process' ? req.postData() : '' })
    if (a === 'voice-status') return r.fulfill({ json: { provider, ai: true } })
    if (a === 'voice-transcribe') { transcribeN++; if (failFirst && transcribeN <= 2) return r.fulfill({ status: 502, json: { error: 'openai: down', code: 'api' } }); return r.fulfill({ json: { text: 'דיברנו עם רונן הוא מחפש ארבעה חדרים בכפר סבא תקציב שלוש וחצי מיליון צריך להתקשר אליו מחר בבוקר', provider } }) }
    if (a === 'voice-process') {
      const b = JSON.parse(req.postData() || '{}')
      if (b.mode === 'task') return r.fulfill({ json: { mode: 'task', text: 'להתקשר לרונן לגבי 4 חדרים בכפר סבא', summary: '', tasks: [], review: [] } })
      if (b.mode === 'call') return r.fulfill({ json: { mode: 'call', text: CALL, summary: '', tasks: [TASK], review: [] } })
      return r.fulfill({ json: { mode: b.mode, text: b.mode === 'smart' ? 'רונן מחפש 4 חדרים בכפר סבא בתקציב 3.5 מיליון ₪; לחזור אליו מחר בבוקר.' : EXACT, summary: '', tasks: [TASK], review: ['רונן'] } })
    }
    if (a === 'chat-status') return r.fulfill({ json: { state: 'authorized' } })
    if (a.startsWith('chat-list')) return r.fulfill({ json: [{ chatId: PHONE + '@c.us', phone: PHONE, name: lead.name, timestamp: Math.floor(now / 1000) - 3600, type: 'incoming', text: 'שלום', incoming: 1 }] })
    if (a === 'chat-history') return r.fulfill({ json: hist })
    if (a === 'chat-avatars') return r.fulfill({ json: { avatars: {} } })
    return r.fulfill({ json: {} })
  })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(String(e.message)))
  await p.goto(`${BASE}/admin-panel/chats`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2200)
  await p.getByText(lead.name, { exact: false }).first().click()
  await p.waitForTimeout(1000)
  return { p, ctx, calls, errs }
}
const openNotes = async p => { await p.getByRole('button', { name: 'הערות' }).first().click(); await p.waitForTimeout(300); return p.getByRole('textbox', { name: 'הערה חדשה' }) }

;(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  // ── A. server transcription, full flow ──
  {
    const { p, calls, errs } = await page(b)
    const ta = await openNotes(p)
    await ta.fill('הערה קיימת.')
    const mic = p.locator('.svi-mic').first()
    await mic.click(); await p.waitForTimeout(1600)
    const panel = p.locator('.svi-panel')
    log(await panel.isVisible(), 'Panel opens while recording')
    log(await p.locator('.svi-wave').isVisible(), 'Waveform is drawn')
    log(/0:0[1-9]/.test(await p.locator('.svi-time').innerText()), 'Timer runs', await p.locator('.svi-time').innerText())
    await p.screenshot({ path: `${S}/a1-recording.png` })
    await p.getByRole('button', { name: 'השהיה' }).click(); await p.waitForTimeout(1300)
    const t1 = await p.locator('.svi-time').innerText(); await p.waitForTimeout(1200)
    log(t1 === await p.locator('.svi-time').innerText(), 'Pause stops the timer', t1)
    await p.getByRole('button', { name: 'המשך' }).click(); await p.waitForTimeout(1200)
    await p.getByRole('button', { name: 'סיום ותמלול' }).first().click()
    await p.waitForSelector('text=הטקסט בתיבה', { timeout: 15000 })
    const tr = calls.find(c => c.api === 'voice-transcribe')
    log(!!tr && tr.size > 1000 && tr.type === 'application/octet-stream' && /mime=audio/.test(tr.q), 'The audio is uploaded as raw bytes', tr && `${tr.size} bytes ${tr.q.slice(0, 60)}`)
    log((await ta.inputValue()) === `הערה קיימת. ${EXACT}`, 'Exact text lands after what was in the box', await ta.inputValue())
    log(await p.getByText('לבדיקה:').isVisible(), 'Unclear words are listed for review')
    await p.screenshot({ path: `${S}/a2-result.png` })
    await p.getByRole('button', { name: 'סיכום שיחה' }).click(); await p.waitForTimeout(600)
    log((await ta.inputValue()) === `הערה קיימת.\n\n${CALL}`, 'Call summary replaces it (structured, on its own lines)')
    log(await p.getByText('זוהתה משימה אחת שנאמרה').isVisible(), 'The task that was said is offered')
    await p.screenshot({ path: `${S}/a3-call.png` })
    await p.getByRole('button', { name: 'יצירת המשימה' }).click(); await p.waitForTimeout(600)
    const tk = calls.find(c => c.api === 'contacts' && /להתקשר לרונן/.test(c.body || ''))
    log(!!tk && /"kind":"followup"/.test(tk.body) && /"remind":true/.test(tk.body), 'Creating it saves a follow-up with a reminder on the lead')
    log(await p.getByText('המשימה נוצרה ✓').isVisible(), '"created" shown')
    await p.getByRole('button', { name: 'כפי שנאמר' }).click(); await p.waitForTimeout(300)
    log(/דיברנו עם רונן הוא מחפש ארבעה/.test(await ta.inputValue()), '"כפי שנאמר" puts the raw transcript back')
    await ta.fill('ערכתי בעצמי'); await p.getByRole('button', { name: 'תמלול מדויק' }).click(); await p.waitForTimeout(400)
    log(await p.getByText('ערכתם את הטקסט').isVisible() && (await ta.inputValue()) === 'ערכתי בעצמי', 'An edit is never overwritten without asking')
    await p.getByRole('button', { name: 'להחליף', exact: true }).click(); await p.waitForTimeout(200)
    log((await ta.inputValue()).includes(EXACT), '"להחליף" applies it')
    await p.getByRole('button', { name: 'הוספת הערה' }).click(); await p.waitForTimeout(600)
    log(!(await panel.isVisible().catch(() => false)), 'Saving the note (box cleared) closes the panel')
    // B. cancel
    await ta.fill('לא לגעת'); const before = calls.filter(c => c.api === 'voice-transcribe').length
    await p.locator('.svi-mic').first().click(); await p.waitForTimeout(1200)
    await p.getByRole('button', { name: 'ביטול ההקלטה' }).click(); await p.waitForTimeout(800)
    log((await ta.inputValue()) === 'לא לגעת' && calls.filter(c => c.api === 'voice-transcribe').length === before && !(await panel.isVisible().catch(() => false)), 'Cancel discards the recording and leaves the box')
    // G. the popover closes mid-recording → VoiceHost keeps it
    await p.locator('.svi-mic').first().click(); await p.waitForTimeout(1200)
    await p.mouse.click(700, 600); await p.waitForTimeout(500)
    log(await p.getByText('הקלטה ממשיכה ברקע').isVisible().catch(() => false), 'Closing the popover keeps recording (VoiceHost)')
    await p.getByRole('button', { name: 'סיום ותמלול' }).first().click()
    await p.waitForSelector('text=הטקסט מההקלטה מוכן', { timeout: 15000 }).catch(() => {})
    log(await p.getByText('הטקסט מההקלטה מוכן').isVisible().catch(() => false), 'Its text is offered to copy')
    await p.screenshot({ path: `${S}/a4-host.png` })
    log(!errs.length, 'No page errors (A)', errs.join(' | '))
    await p.context().close()
  }
  // ── C. a failed transcription keeps the audio; retry ──
  {
    const { p, calls, errs } = await page(b, { failFirst: true })
    const ta = await openNotes(p)
    await p.locator('.svi-mic').first().click(); await p.waitForTimeout(1300)
    await p.getByRole('button', { name: 'סיום ותמלול' }).first().click()
    await p.waitForSelector('text=התמלול נכשל', { timeout: 15000 }).catch(() => {})
    log(await p.getByText('התמלול נכשל').isVisible().catch(() => false), 'A failure is explained')
    await p.screenshot({ path: `${S}/c1-failed.png` })
    await p.getByRole('button', { name: 'נסו שוב' }).click()
    await p.waitForSelector('text=הטקסט בתיבה', { timeout: 15000 }).catch(() => {})
    const ups = calls.filter(c => c.api === 'voice-transcribe')
    log(ups.length === 3 && ups[0].size === ups[2].size && (await ta.inputValue()).includes(EXACT), 'One automatic retry, then "נסו שוב" re-sends the same audio and succeeds', `${ups.length} uploads`)
    // E. a task box: one line, no mode switch
    await p.keyboard.press('Escape'); await p.mouse.click(700, 600); await p.waitForTimeout(300)
    await p.getByRole('button', { name: /פולו אפ/ }).first().click(); await p.waitForTimeout(400)
    await p.locator('.tpi .svi-mic').first().click(); await p.waitForTimeout(1300)
    await p.getByRole('button', { name: 'סיום ותמלול' }).first().click()
    await p.waitForSelector('text=הטקסט בתיבה', { timeout: 15000 }).catch(() => {})
    log((await p.locator('.tpi input').first().inputValue()) === 'להתקשר לרונן לגבי 4 חדרים בכפר סבא', 'Task box gets one short line')
    log(!(await p.locator('.svi-seg').isVisible().catch(() => false)), 'Task box has no mode switch')
    log(!errs.length, 'No page errors (C)', errs.join(' | '))
    await p.context().close()
  }
  // ── F. no server key: the browser's recognition writes live ──
  {
    const { p, errs } = await page(b, { provider: '' })
    const ta = await openNotes(p)
    await p.locator('.svi-mic').first().click(); await p.waitForTimeout(800)
    log(/דיברנו עם רונן/.test(await ta.inputValue()), 'Without a key the words appear live (browser engine)', await ta.inputValue())
    log(await p.getByText('המילים נכתבות בתיבה תוך כדי').isVisible(), 'The panel says so')
    await p.getByRole('button', { name: 'סיום ותמלול' }).first().click()
    await p.waitForSelector('text=הטקסט בתיבה', { timeout: 15000 }).catch(() => {})
    log((await ta.inputValue()).includes(EXACT), 'Then the AI layer cleans it')
    log(!errs.length, 'No page errors (F)', errs.join(' | '))
    await p.context().close()
  }
  // ── H. phone ──
  {
    const { p, errs } = await page(b, { viewport: { width: 390, height: 844 }, mobile: true })
    await p.locator('.svi-mic').first().click().catch(() => {})
    const ta = await openNotes(p).catch(() => null)
    if (ta) {
      await p.locator('.svi-mic').first().click(); await p.waitForTimeout(1200)
      const box = await p.locator('.svi-panel').boundingBox()
      log(!!box && box.width >= 380 && Math.abs(box.y + box.height - 844) < 4, 'Phone: the panel sits at the bottom, full width', box && JSON.stringify(box))
      const btn = await p.getByRole('button', { name: 'סיום ותמלול' }).first().boundingBox()
      log(!!btn && btn.width >= 44 && btn.height >= 44, 'Phone: buttons are thumb-sized', btn && `${btn.width}×${btn.height}`)
      await p.screenshot({ path: `${S}/h1-phone.png` })
      await p.getByRole('button', { name: 'סיום ותמלול' }).last().click()
      await p.waitForSelector('text=הטקסט בתיבה', { timeout: 15000 }).catch(() => {})
      const rb = await p.locator('.svi-panel').boundingBox()
      const save = await p.getByRole('button', { name: 'הוספת הערה' }).boundingBox()
      log(!!rb && !!save && rb.y < 5 && save.y > rb.y + rb.height, 'Phone: the result moves to the top, the save button stays visible', rb && save && `${Math.round(rb.y + rb.height)} < ${Math.round(save.y)}`)
      await p.screenshot({ path: `${S}/h2-phone-result.png` })
    } else log(false, 'Phone: notes not reachable')
    log(!errs.length, 'No page errors (H)', errs.join(' | '))
    await p.context().close()
  }
  await b.close(); server.close()
  process.exit(fails ? 1 : 0)
})().catch(e => { console.error(e); server.close(); process.exit(1) })
