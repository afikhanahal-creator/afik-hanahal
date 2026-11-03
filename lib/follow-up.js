// Follow-up tasks with a WhatsApp reminder to the office. Shared by the admin (src/LeadCard.jsx, src/FollowUpPicker.jsx,
// the Lead Center, the call summary) and the server (lib/automations.js remindTasks(), run every 5 minutes by auto-tick).
// Pure; tested in follow-up.test.mjs.
//
// A task lives in the lead's crm_data.tasks: { id, text, due (ISO, UTC), done, createdAt, kind: 'followup', remind: true,
// remindedAt }. The lead's followUp (the board's "חזרה" date, an Israel-local "YYYY-MM-DDTHH:mm") follows the earliest open
// follow-up task, so every screen that shows the follow-up shows the same thing.

export const TZ = 'Asia/Jerusalem'
const pad = n => String(n).padStart(2, '0')

/** The wall-clock parts of a moment in Israel */
export function israelParts(at) {
  const d = new Date(at)
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
    .formatToParts(d).map(x => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) }
}
/** ISO → "YYYY-MM-DDTHH:mm" in Israel ('' for nothing) */
export function israelLocal(at) {
  if (!at || !Number.isFinite(Date.parse(at))) return ''
  const p = israelParts(at)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`
}
/** "YYYY-MM-DD" + "HH:mm" (Israel wall clock) → ISO; DST-safe (the offset is read at that moment) */
export function fromIsraelLocal(date, time = '10:00') {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || '')), t = /^(\d{1,2}):(\d{2})/.exec(String(time || ''))
  if (!m || !t) return ''
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2])
  let at = guess
  for (let i = 0; i < 2; i++) {   // move by the difference between what Israel shows and what we wanted
    const p = israelParts(at)
    at += guess - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min)
  }
  return new Date(at).toISOString()
}
/** A stored follow-up value (ISO, or an old Israel-local "YYYY-MM-DDTHH:mm" / "YYYY-MM-DD") → ISO */
export function dueIso(v) {
  const s = String(v || '')
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) return new Date(s).toISOString()
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?$/.exec(s)
  return m ? fromIsraelLocal(m[1], m[2] || '09:00') : ''
}

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayKey = p => `${p.y}-${pad(p.m)}-${pad(p.d)}`
const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}` }

/** "היום 16:00" · "מחר 10:00" · "יום שלישי 10:00" (this week) · "22.10 10:00" — in Israel time */
export function describeDue(at, { now = Date.now(), lang = 'he' } = {}) {
  const iso = dueIso(at)
  if (!iso) return ''
  const p = israelParts(iso), n = israelParts(now)
  const time = `${pad(p.h)}:${pad(p.min)}`
  const k = dayKey(p), today = dayKey(n)
  const en = lang === 'en'
  if (k === today) return `${en ? 'Today' : 'היום'} ${time}`
  if (k === addDays(today, 1)) return `${en ? 'Tomorrow' : 'מחר'} ${time}`
  if (k === addDays(today, -1)) return `${en ? 'Yesterday' : 'אתמול'} ${time}`
  const diff = (Date.parse(`${k}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5
  if (diff > 1 && diff < 7) return `${en ? EN_DAYS[p.wd] : `יום ${HE_DAYS[p.wd]}`} ${time}`
  return `${p.d}.${p.m}${p.y !== n.y ? `.${p.y}` : ''} ${time}`
}

/** Quick picks for "when to get back to them" (Israel time; Saturday moves to Sunday) */
export function followUpPresets(now = Date.now(), lang = 'he') {
  const en = lang === 'en'
  const n = israelParts(now), today = dayKey(n)
  const at = (days, hm) => { let k = addDays(today, days); if (israelParts(fromIsraelLocal(k, '12:00')).wd === 6) k = addDays(k, 1); return fromIsraelLocal(k, hm) }
  const inHour = new Date(Math.ceil((now + 60 * 60e3) / (15 * 60e3)) * 15 * 60e3).toISOString()
  const out = [
    { id: '1h', he: 'בעוד שעה', en: 'In an hour', at: inHour },
    { id: '3h', he: 'בעוד 3 שעות', en: 'In 3 hours', at: new Date(Math.ceil((now + 3 * 3600e3) / (15 * 60e3)) * 15 * 60e3).toISOString() },
  ]
  if (n.h < 16 && n.wd !== 6) out.push({ id: 'today17', he: 'היום ב-17:00', en: 'Today 17:00', at: fromIsraelLocal(today, '17:00') })
  out.push(
    { id: 'tom9', he: 'מחר ב-9:00', en: 'Tomorrow 9:00', at: at(1, '09:00') },
    { id: 'tom14', he: 'מחר ב-14:00', en: 'Tomorrow 14:00', at: at(1, '14:00') },
    { id: '2d', he: 'בעוד יומיים', en: 'In 2 days', at: at(2, '10:00') },
    { id: '1w', he: 'בעוד שבוע', en: 'In a week', at: at(7, '10:00') },
    { id: '1m', he: 'בעוד חודש', en: 'In a month', at: at(30, '10:00') },
  )
  return out.map(x => ({ ...x, label: en ? x.en : x.he }))
}

const uid = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const asList = v => (Array.isArray(v) ? v : [])
export const openFollowUps = tasks => asList(tasks).filter(t => t && !t.done && t.kind === 'followup' && dueIso(t.due))

/** The patch that adds a follow-up task to a lead (and moves the lead's followUp to the earliest open one) */
export function addFollowUp(lead, { text, due, remind = true, now = Date.now() } = {}) {
  const iso = dueIso(due)
  if (!iso) return null
  const task = { id: uid(), text: String(text || '').trim() || defaultFollowUpText(lead), due: iso, done: false, createdAt: now, kind: 'followup', remind: !!remind }
  const tasks = [...asList(lead?.tasks), task]
  return { task, patch: { tasks, followUp: nextFollowUp(tasks) } }
}
/** The lead's followUp from its open follow-up tasks (Israel-local, '' when none) */
export function nextFollowUp(tasks) {
  const first = openFollowUps(tasks).map(t => dueIso(t.due)).sort()[0]
  return first ? israelLocal(first) : ''
}
/** Done / reopened / deleted / moved → the patch, followUp kept in step */
export function updateTasks(lead, tasks) {
  const had = openFollowUps(lead?.tasks).length > 0
  const next = { tasks }
  const fu = nextFollowUp(tasks)
  if (fu || had) next.followUp = fu
  return next
}
export function defaultFollowUpText(lead, lang = 'he') {
  const first = String(lead?.name || '').trim().split(/\s+/)[0]
  return lang === 'en' ? `Get back to ${first || 'the lead'}` : `לחזור ל${first || 'ליד'}`
}

// ── reminders that still make sense ────────────────────────────────────────────────────────────────────────────────
// A lead marked "לא רלוונטי" gets no reminder at all, and a closed deal ("won") keeps its tasks (contract, fee…) but needs no
// "get back to them" follow-up. Moving a lead to one of those stages closes what no longer applies (closeForStage), and every
// reminder path (WhatsApp, on-screen, the database's due count) checks reminderAllowed too, for leads changed elsewhere.
const stageOf = l => l?.stage || l?.leadStatus || l?.crm_data?.leadStatus || 'new'
export function reminderAllowed(lead, task) {
  const st = stageOf(lead)
  if (st === 'irrelevant') return false
  if (st === 'won' && (task?.kind || 'followup') === 'followup') return false
  return true
}
/** Moving a lead to `stage` → the patch that closes its follow-ups / tasks that no longer apply (null = nothing to close) */
export function closeForStage(lead, stage, now = Date.now()) {
  const tasks = asList(lead?.tasks)
  const probe = { stage }
  let n = 0
  const next = tasks.map(t => {
    if (!t || t.done || reminderAllowed(probe, t)) return t
    n++
    return { ...t, done: true, doneAt: now, closedBy: `stage:${stage}` }
  })
  return n ? updateTasks(lead, next) : null
}
/** The newest time someone on the team touched the lead (a note, a call, a stage change) */
export function lastTouch(lead) {
  const ts = v => (typeof v === 'number' ? v : Date.parse(v || '') || 0)
  let t = ts(lead?.lastCallAt)
  for (const n of asList(lead?.notes)) t = Math.max(t, ts(n?.ts))
  for (const s of asList(lead?.stageLog)) t = Math.max(t, ts(s?.at))
  return t
}

// ── the server side: which reminders are due ───────────────────────────────────────────────────────────────────────
export const REMIND_WINDOW_MS = 24 * 3600e3   // a reminder missed for longer than this (the tick was down) isn't sent late
export const reminderKey = (leadId, t) => `${leadId}:${t.id}:${dueIso(t.due)}`

/** rows: [{ id, name, phone, tasks }] (+ anything for the text); sent: { key: { at, tries } } → [{ key, lead, task }] */
export function dueReminders(rows, sent = {}, now = Date.now()) {
  const out = []
  for (const r of asList(rows)) {
    for (const t of asList(r.tasks)) {
      if (!t || t.done || !t.remind || t.remindedAt || t.remindGaveUp || !reminderAllowed(r, t)) continue
      const due = Date.parse(dueIso(t.due))
      if (!Number.isFinite(due) || due > now || now - due > REMIND_WINDOW_MS) continue
      if (t.createdAt && due < Number(t.createdAt) - 60e3) continue   // written after the fact: nothing to remind
      const key = reminderKey(r.id, t)
      const s = sent[key]
      if (s && (s.ok || (s.tries || 0) >= 3)) continue
      out.push({ key, lead: r, task: t })
    }
  }
  return out.sort((a, b) => Date.parse(dueIso(a.task.due)) - Date.parse(dueIso(b.task.due)))
}

const localPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('972') ? '0' + d.slice(3) : d }
const prettyPhone = p => { const l = localPhone(p); return /^05\d{8}$/.test(l) ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l }
const intlPhone = p => { const l = localPhone(p); return l.startsWith('0') ? '972' + l.slice(1) : l }

/** The office's WhatsApp reminder (Hebrew, plain, one tap to call / write) */
export function reminderText(lead, task, { now = Date.now(), site = 'https://www.afikhanahal.co.il' } = {}) {
  const name = String(lead?.name || '').trim() || 'ליד בלי שם'
  const what = String(task?.text || '').trim()
  const extra = [lead?.campaign, lead?.prop_title].map(x => String(x || '').trim()).filter(Boolean)[0]
  const needs = String(lead?.needs || '').trim()
  const followUp = !task?.kind || task.kind === 'followup'
  return [
    followUp ? `*תזכורת: לחזור ל${name}*` : `*תזכורת למשימה: ${name}*`,
    what && (!followUp || what !== defaultFollowUpText(lead)) ? (followUp ? what : `משימה: ${what}`) : '',
    extra ? `על: ${extra}` : '',
    needs ? `מחפשים: ${needs}` : '',
    lead?.phone ? `טלפון: ${prettyPhone(lead.phone)}` : '',
    `נקבע ל${describeDue(task.due, { now })}`,
    lead?.phone ? `וואטסאפ: https://wa.me/${intlPhone(lead.phone)}` : '',
    `כרטיס הליד: ${site}/admin-panel/leads?lead=${encodeURIComponent(lead?.id || '')}`,
  ].filter(Boolean).join('\n')
}

/** The details field "next follow-up" changed by hand: the earliest open follow-up task moves there (its reminder goes
 *  out again at the new time), or a new one is made; '' clears the open follow-ups → the patch */
export function setNextFollowUp(lead, due, { now = Date.now() } = {}) {
  const iso = dueIso(due)
  const tasks = asList(lead?.tasks)
  const open = openFollowUps(tasks).sort((a, b) => dueIso(a.due).localeCompare(dueIso(b.due)))
  if (!iso) {
    const ids = new Set(open.map(t => t.id))
    const next = tasks.filter(t => !ids.has(t.id))
    return { tasks: next, followUp: '' }
  }
  if (!open.length) return addFollowUp(lead, { due: iso, now }).patch
  const next = tasks.map(t => (t.id === open[0].id ? { ...t, due: iso, remindedAt: null } : t))
  return { tasks: next, followUp: nextFollowUp(next) }
}

// ── the browser side: the on-screen reminder (src/TaskAlerts.jsx) ─────────────────────────────────────────────────────
// The same tasks the office gets a WhatsApp about also pop up in the open admin: a card that waits until it is handled, a
// sound and an OS notification. `seen` = { key: { at, snooze } } (localStorage, shared by every open tab); only what is due now
// pops up — a task more than 2 h late waits in the follow-ups screen instead (the WhatsApp already told them), so opening the
// panel never brings back old reminders; a lead someone already called / wrote a note on / moved since the due time doesn't
// pop up either, and a snoozed one comes back at `snooze`.
export const SCREEN_WINDOW_MS = 2 * 3600e3
export function screenReminders(rows, seen = {}, now = Date.now()) {
  const out = []
  for (const r of asList(rows)) {
    for (const t of asList(r?.tasks)) {
      if (!t || t.done || !t.remind || !reminderAllowed(r, t)) continue
      const due = Date.parse(dueIso(t.due))
      if (!Number.isFinite(due) || due > now || now - due > SCREEN_WINDOW_MS) continue
      if (t.createdAt && due < Number(t.createdAt) - 60e3) continue
      if (lastTouch(r) > due) continue                     // handled since: a call, a note or a stage change after the due time
      const key = reminderKey(r.id, t)
      const s = seen[key]
      if (s && !(s.snooze && s.snooze <= now)) continue
      out.push({ key, lead: r, task: t, due })
    }
  }
  return out.sort((a, b) => a.due - b.due)
}
/** the next moment one of the open reminders falls due (to set one timer), or 0 */
export function nextReminderAt(rows, seen = {}, now = Date.now()) {
  let next = 0
  const take = at => { if (at > now && (!next || at < next)) next = at }
  for (const r of asList(rows)) for (const t of asList(r?.tasks)) {
    if (!t || t.done || !t.remind || !reminderAllowed(r, t)) continue
    const due = Date.parse(dueIso(t.due))
    if (Number.isFinite(due)) take(due)
  }
  for (const s of Object.values(seen || {})) if (s?.snooze) take(s.snooze)
  return next
}
/** "עכשיו" / "באיחור 25 דק׳" / "באיחור שעתיים" */
export function lateText(due, now = Date.now(), lang = 'he') {
  const m = Math.floor((now - due) / 60e3), en = lang === 'en'
  if (m < 2) return en ? 'Now' : 'עכשיו'
  if (m < 60) return en ? `${m} min late` : `באיחור ${m} דק׳`
  const h = Math.floor(m / 60)
  return en ? `${h} h late` : h === 1 ? 'באיחור שעה' : h === 2 ? 'באיחור שעתיים' : `באיחור ${h} שעות`
}

// ── the follow-ups column on the leads board (src/FollowUpsPanel.jsx) ────────────────────────────────────────────────
/** Every dated task of every lead → [{ key, lead, task, due, past, done }], the next one first, then what already passed
 *  (newest first). kind: 'all' | 'followup' (follow-ups only) */
export function taskAgenda(rows, { now = Date.now(), kind = 'all' } = {}) {
  const items = []
  for (const r of asList(rows)) for (const t of asList(r?.tasks)) {
    if (!t) continue
    if (kind === 'followup' && t.kind !== 'followup') continue
    const due = Date.parse(dueIso(t.due))
    if (!Number.isFinite(due)) continue
    items.push({ key: `${r.id}:${t.id}`, lead: r, task: t, due, past: due <= now, done: !!t.done })
  }
  const up = items.filter(x => !x.past).sort((a, b) => a.due - b.due)
  const past = items.filter(x => x.past).sort((a, b) => b.due - a.due)
  return { upcoming: up, past, overdue: past.filter(x => !x.done) }
}

/** The follow-ups page's group for a task: done · late (due and not done) · today · tomorrow · week (≤ 7 days) · later */
export function agendaBucket(due, done, now = Date.now()) {
  if (done) return 'done'
  if (due <= now) return 'late'
  const d = israelParts(due), n = israelParts(now)
  const k = `${d.y}-${pad(d.m)}-${pad(d.d)}`, today = `${n.y}-${pad(n.m)}-${pad(n.d)}`
  if (k === today) return 'today'
  const days = (Date.parse(`${k}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 864e5
  return days === 1 ? 'tomorrow' : days <= 7 ? 'week' : 'later'
}

// ── "Who do we call now?" — the follow-ups screen's top strip (src/FollowUpsView.jsx) ────────────────────────────────
export const QUEUE_LATE_MS = 48 * 3600e3   // a task missed for longer waits in the "missed" list, not in the call strip
export const QUEUE_SOON_MS = 2 * 3600e3    // and what is due in the next two hours joins it
/** The status of one agenda item in plain words: done · late (passed, not done) · now (±10 min) · soon (≤ 2 h) · later */
export function taskStatus(item, now = Date.now()) {
  if (!item || item.done) return 'done'
  const d = item.due - now
  if (Math.abs(d) <= 10 * 60e3) return 'now'
  if (d < 0) return 'late'
  return d <= QUEUE_SOON_MS ? 'soon' : 'later'
}
/** The call strip: what passed in the last 48 h and wasn't done (the one waiting longest first), then what is due within two
 *  hours (the nearest first); one row per lead (its most urgent task), only leads we can call */
export function callQueue(items, now = Date.now(), { max = 6 } = {}) {
  const open = asList(items).filter(x => x && !x.done && x.lead?.phone)
  const late = open.filter(x => x.due <= now + 10 * 60e3 && now - x.due <= QUEUE_LATE_MS).sort((a, b) => a.due - b.due)
  const soon = open.filter(x => x.due > now + 10 * 60e3 && x.due - now <= QUEUE_SOON_MS).sort((a, b) => a.due - b.due)
  const seen = new Set(), out = []
  for (const x of [...late, ...soon]) {
    const id = String(x.lead.id)
    if (seen.has(id)) continue
    seen.add(id); out.push(x)
    if (out.length >= max) break
  }
  return out
}
