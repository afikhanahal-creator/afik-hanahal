// TranscriptionService — everything the admin's mic does that isn't drawing (src/SmartVoiceInput.jsx draws):
// • the recorder (MediaRecorder): pause / resume / cancel, a live level for the waveform, and a long recording cut into
//   2-minute pieces (each a complete audio file, so each can be transcribed while you are still talking, and each stays under
//   the 4 MB a request may carry); 15 minutes at most;
// • transcription on the server (POST /api/meta/voice-transcribe → lib/transcribe.js: OpenAI / ElevenLabs, keys in Vercel only),
//   or — when no key is set — the browser's own speech recognition, live, as before;
// • the AI layer (POST /api/meta/voice-process → lib/voice-process.js): exact / smart summary / call summary / task + the tasks
//   that were said.
// A session (VoiceSession) lives in this module, not in a screen: if the box that started it closes, the recording goes on and
// the text is offered by the global VoiceHost. Nothing is stored anywhere: the audio stays in this tab's memory until the text is
// in, so a failed transcription can be tried again.
import { dictationMode, collectResults, joinText, liveText, pickMime, micErrorCode, joinSegments, modesFor } from './dictation.js'

const AUTH = { Authorization: 'Bearer AFIKhanahal2026' }
export const SEGMENT_SEC = 120
export const MAX_SEC = 900

/** The browser's own word on the mic for this site: 'granted' | 'denied' | 'prompt' | '' (unknown — Safari / Firefox) */
export async function micPermission() {
  try { return (await navigator.permissions?.query({ name: 'microphone' }))?.state || '' } catch { return '' }
}

export const MIC = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }

let statusP = null, statusAt = 0
/** { provider: 'openai' | 'elevenlabs' | '', ai } — read once per 5 minutes */
export function voiceStatus() {
  if (statusP && Date.now() - statusAt < 300000) return statusP
  statusAt = Date.now()
  statusP = fetch('/api/meta/voice-status', { headers: AUTH, signal: AbortSignal.timeout(8000) })
    .then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(d => ({ provider: d.provider || '', ai: d.ai !== false }))
  return statusP
}

export const canRecord = () => typeof window !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)

const err = (code, message) => Object.assign(new Error(message || code), { code })

async function post(url, init, tries = 2) {
  for (let i = 0; i < tries; i++) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw err('offline')
    try {
      const r = await fetch(url, init)
      const d = await r.json().catch(() => ({}))
      if (r.ok) return d
      if (r.status >= 500 && r.status !== 501 && i < tries - 1) continue
      throw err(d.code === 'format' ? 'format' : d.code === 'no_provider' ? 'no-provider' : d.code === 'empty' ? 'no-speech' : 'server', d.error || `HTTP ${r.status}`)
    } catch (e) {
      if (e.code) throw e
      if (i === tries - 1) throw err(navigator.onLine === false ? 'offline' : 'network', e.message)
    }
  }
}

/** One recorded piece → its text */
export async function transcribeSegment(blob, { lang = 'he', hint = '' } = {}) {
  const q = new URLSearchParams({ mime: blob.type || 'audio/webm', lang, hint: String(hint || '').slice(0, 300) })
  const d = await post(`/api/meta/voice-transcribe?${q}`, { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/octet-stream' }, body: blob, signal: AbortSignal.timeout(60000) })
  return String(d.text || '')
}

/** The transcript → { mode, text, summary, tasks, review } */
export async function processTranscript(transcript, { mode = 'exact', contextType = 'note', lang = 'he', hint = '' } = {}) {
  return post('/api/meta/voice-process', { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, mode, contextType, lang, hint }), signal: AbortSignal.timeout(60000) }, 1)
}

// ── the recorder ───────────────────────────────────────────────────────────────────────────────────────────────────────────
function createRecorder({ segmentSec = SEGMENT_SEC, onSegment, onLevel }) {
  let stream = null, ctx = null, analyser = null, rec = null, mime = '', chunks = [], segStart = 0, segActive = 0, raf = 0, done = null, discarding = false, index = 0, peak = 0
  const level = () => {
    if (!analyser) return
    const a = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(a)
    let sum = 0
    for (let i = 0; i < a.length; i++) { const v = (a[i] - 128) / 128; sum += v * v }
    const rms = Math.min(1, Math.sqrt(sum / a.length) * 3.2)
    peak = Math.max(peak, rms)
    onLevel?.(rec?.state === 'recording' ? rms : 0)
    raf = requestAnimationFrame(level)
  }
  const newRec = () => {
    chunks = []
    rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 })
    rec.ondataavailable = e => { if (e.data?.size) chunks.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] })
      if (!discarding && blob.size > 600) onSegment?.(blob, index++)
      if (done) { const d = done; done = null; d() } else if (!discarding) { newRec(); rec.start(1000); segStart = Date.now(); segActive = 0 }
    }
  }
  const api = {
    get peak() { return peak },
    async start(given) {
      stream = given || await navigator.mediaDevices.getUserMedia(MIC)
      mime = pickMime()
      try {
        const AC = window.AudioContext || window.webkitAudioContext
        ctx = new AC(); const src = ctx.createMediaStreamSource(stream)
        analyser = ctx.createAnalyser(); analyser.fftSize = 512; src.connect(analyser)
        if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      } catch { analyser = null }
      newRec(); rec.start(1000); segStart = Date.now(); segActive = 0
      raf = requestAnimationFrame(level)
    },
    /** called every second while recording: cut a piece when it is long enough */
    tick() {
      if (rec?.state !== 'recording') return
      if (segActive + (Date.now() - segStart) / 1000 >= segmentSec) rec.stop()   // onstop starts the next piece
    },
    pause() { if (rec?.state === 'recording') { rec.pause(); segActive += (Date.now() - segStart) / 1000 } },
    resume() { if (rec?.state === 'paused') { rec.resume(); segStart = Date.now() } },
    stop() {
      return new Promise(res => {
        if (!rec || rec.state === 'inactive') { api.release(); res(); return }
        done = () => { api.release(); res() }
        try { rec.stop() } catch { api.release(); res() }
      })
    },
    cancel() { discarding = true; try { if (rec && rec.state !== 'inactive') rec.stop() } catch { /* already stopped */ } api.release() },
    release() {
      cancelAnimationFrame(raf); onLevel?.(0)
      try { stream?.getTracks().forEach(t => t.stop()) } catch { /* gone */ }
      try { ctx?.close() } catch { /* gone */ }
      stream = null; ctx = null; analyser = null
    },
  }
  return api
}

// ── the browser's own recognition (no server key): live words, as in the first version ───────────────────────────────
function createBrowserEngine({ lang, onText, onError }) {
  const mode = dictationMode()
  if (!mode.supported) return null
  let rec = null, committed = '', session = { final: '', interim: '' }, running = false, began = 0, fails = 0
  const begin = () => {
    rec = new mode.Rec()
    rec.lang = lang === 'en' ? 'en-US' : 'he-IL'; rec.continuous = mode.continuous; rec.interimResults = true; rec.maxAlternatives = 1
    rec.onresult = e => { session = collectResults(e.results); fails = 0; onText(liveText('', committed, session)) }
    rec.onerror = e => {
      const c = e?.error || ''
      if (c === 'no-speech' || c === 'aborted' || (c === 'network' && fails < 2)) return
      if ((c === 'not-allowed' || c === 'service-not-allowed') && (committed || session.final)) { running = false; return }
      running = false; onError(c || 'error')
    }
    rec.onend = () => {
      committed = joinText(committed, joinText(session.final, session.interim)); session = { final: '', interim: '' }
      onText(committed)
      if (!running) return
      if (Date.now() - began < 400 && ++fails > 4) { running = false; onError('network'); return }
      began = Date.now()
      try { begin() } catch { running = false }
    }
    rec.start()
  }
  return {
    get text() { return joinText(committed, joinText(session.final, session.interim)) },
    start() { running = true; began = Date.now(); begin() },
    pause() { running = false; try { rec?.stop() } catch { /* stopped */ } },
    resume() { if (!running) { running = true; began = Date.now(); try { begin() } catch { running = false } } },
    stop() { running = false; try { rec?.stop() } catch { /* stopped */ } return new Promise(r => setTimeout(r, 450)) },
    cancel() { running = false; try { rec?.abort() } catch { /* stopped */ } },
  }
}

// ── a session: one recording from the mic tap to the text in the box ────────────────────────────────────────────────────
let seq = 0
const sessions = new Map()
const hostSubs = new Set()
const emitHost = () => hostSubs.forEach(f => f())
export const subscribeHost = fn => { hostSubs.add(fn); return () => hostSubs.delete(fn) }
export const detachedSessions = () => [...sessions.values()].filter(s => s.detached && s.phase !== 'closed')
let ACTIVE = null

export class VoiceSession {
  constructor({ contextType = 'note', lang = 'he', hint = '', mode, onLive } = {}) {
    this.id = ++seq
    this.contextType = contextType; this.lang = lang; this.hint = hint
    const m = modesFor(contextType)
    this.modes = m.modes
    let saved = ''
    try { saved = localStorage.getItem(`afik_voice_mode:${contextType}`) || '' } catch { /* private mode */ }
    this.mode = mode || (m.modes.includes(saved) ? saved : m.def)
    this.phase = 'idle'; this.sec = 0; this.level = 0; this.engine = ''
    this.segments = []; this.transcript = ''; this.results = {}; this.error = null; this.notice = ''
    this.detached = false; this.onLive = onLive; this.subs = new Set()
    sessions.set(this.id, this)
  }
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn) }
  emit() { this.subs.forEach(f => f(this)); if (this.detached) emitHost() }
  set(patch) { Object.assign(this, patch); this.emit() }

  async start() {
    // Ask for the mic FIRST, in the same tap (before anything is awaited): the browser shows its permission question only for
    // a request it can tie to the click, and its answer says exactly why when it refuses (the site, the computer, a closed prompt)
    const micP = canRecord() ? navigator.mediaDevices.getUserMedia(MIC).then(s => ({ s }), e => ({ e })) : Promise.resolve({})
    const statusP = voiceStatus()
    if (ACTIVE && ACTIVE !== this && (ACTIVE.phase === 'rec' || ACTIVE.phase === 'paused')) await ACTIVE.finish()
    ACTIVE = this
    const mic = await micP
    if (mic.e) { this.micDetail = `${mic.e.name || ''}: ${mic.e.message || ''}`.slice(0, 140); return this.fail(micErrorCode(mic.e, await micPermission())) }
    const st = await statusP
    this.ai = st.ai
    if (st.provider && canRecord()) {
      this.engine = 'server'
      this.rec = createRecorder({
        onSegment: (blob, i) => { this.segments[i] = { blob, text: '', status: 'pending' }; this.transcribe(i) },
        onLevel: v => { this.level = v; this.levelSubs?.forEach(f => f(v)) },
      })
      try { await this.rec.start(mic.s) } catch (e) { this.rec = null; mic.s?.getTracks().forEach(t => t.stop()); return this.fail(micErrorCode(e, await micPermission())) }
    } else {
      mic.s?.getTracks().forEach(t => t.stop())   // permission is granted now; the browser's recognition opens the mic itself
      this.engine = 'browser'
      this.live = createBrowserEngine({ lang: this.lang, onText: t => this.onLive?.(t), onError: async c => this.fail(c === 'not-allowed' && (await micPermission()) === 'granted' ? 'os-blocked' : c) })
      if (!this.live) return this.fail('unsupported')
      try { this.live.start() } catch { return this.fail('unsupported') }
    }
    this.set({ phase: 'rec', sec: 0, error: null })
    const t0 = Date.now(); let paused = 0, pausedAt = 0
    this.timer = setInterval(() => {
      if (this.phase === 'paused') { if (!pausedAt) pausedAt = Date.now(); return }
      if (pausedAt) { paused += Date.now() - pausedAt; pausedAt = 0 }
      const sec = Math.floor((Date.now() - t0 - paused) / 1000)
      if (sec !== this.sec) this.set({ sec })
      this.rec?.tick()
      if (sec >= MAX_SEC) { this.notice = 'too-long'; this.finish() }
    }, 250)
  }
  onLevel(fn) { (this.levelSubs ||= new Set()).add(fn); return () => this.levelSubs.delete(fn) }
  pause() { if (this.phase !== 'rec') return; this.rec?.pause(); this.live?.pause(); this.set({ phase: 'paused' }) }
  resume() { if (this.phase !== 'paused') return; this.rec?.resume(); this.live?.resume(); this.set({ phase: 'rec' }) }

  async transcribe(i) {
    const s = this.segments[i]; if (!s || s.status === 'busy') return
    s.status = 'busy'; this.emit()
    try { s.text = await transcribeSegment(s.blob, { lang: this.lang, hint: this.hint }); s.status = 'done' }
    catch (e) { s.status = 'failed'; s.code = e.code }
    this.emit()
    if (this.phase === 'transcribing') this.afterSegments()
  }

  async finish() {
    if (this.phase !== 'rec' && this.phase !== 'paused') return
    clearInterval(this.timer)
    if (ACTIVE === this) ACTIVE = null
    if (this.engine === 'browser') {
      await this.live.stop()
      this.transcript = this.live.text
      if (!this.transcript.trim()) return this.fail('no-speech')
      return this.process(this.mode)
    }
    this.set({ phase: 'transcribing' })
    await this.rec.stop()
    if (!this.segments.length) return this.fail('no-speech')
    this.afterSegments()
  }
  afterSegments() {
    const segs = this.segments.filter(Boolean)
    if (segs.some(s => s.status === 'pending' || s.status === 'busy')) return
    const failed = segs.find(s => s.status === 'failed')
    if (failed) return this.fail(failed.code === 'offline' ? 'offline' : failed.code === 'format' ? 'format' : failed.code === 'no-provider' ? 'transcribe' : 'transcribe', { canRetry: true })
    this.transcript = joinSegments(segs)
    if (!this.transcript.trim()) return this.fail('no-speech')
    this.process(this.mode)
  }
  /** "נסו שוב": the failed pieces again (the audio is still here), or the processing again */
  retry() {
    if (this.transcript) return this.process(this.mode)
    this.set({ phase: 'transcribing', error: null })
    this.segments.forEach((s, i) => { if (s && s.status === 'failed') { s.status = 'pending'; this.transcribe(i) } })
  }

  async process(mode) {
    this.mode = mode
    try { localStorage.setItem(`afik_voice_mode:${this.contextType}`, mode) } catch { /* private mode */ }
    if (this.results[mode]) { this.set({ phase: 'result', error: null }); return this.results[mode] }
    if (this.ai === false) { this.results[mode] = { mode, text: this.transcript, tasks: [], review: [], summary: '', raw: true }; this.set({ phase: 'result', notice: this.notice || 'process' }); return this.results[mode] }
    this.set({ phase: 'processing', error: null })
    try {
      const r = await processTranscript(this.transcript, { mode, contextType: this.contextType, lang: this.lang, hint: this.hint })
      this.results[mode] = r
      this.set({ phase: 'result' })
      return r
    } catch (e) {
      // the words are in — never lose them: show the transcript as it is and say why
      this.results[mode] = { mode, text: this.transcript, tasks: [], review: [], summary: '', raw: true }
      this.set({ phase: 'result', notice: e.code === 'offline' ? 'offline' : 'process' })
      return this.results[mode]
    }
  }
  fail(code, { canRetry = false } = {}) {
    clearInterval(this.timer)
    if (ACTIVE === this) ACTIVE = null
    try { this.rec?.release() } catch { /* gone */ }
    this.set({ phase: 'error', error: { code, canRetry } })
  }
  cancel() {
    clearInterval(this.timer)
    if (ACTIVE === this) ACTIVE = null
    try { this.rec?.cancel() } catch { /* gone */ }
    try { this.live?.cancel() } catch { /* gone */ }
    this.close()
  }
  close() { this.phase = 'closed'; this.segments = []; sessions.delete(this.id); this.emit(); emitHost() }
  /** the box that started it closed: keep going, the global VoiceHost offers the text */
  detach() {
    if (this.phase === 'idle' || this.phase === 'closed') { this.close(); return }
    if (this.phase === 'result' && this.applied) { this.close(); return }
    this.detached = true; this.onLive = null; emitHost()
  }
  get result() { return this.results[this.mode] || null }
}
