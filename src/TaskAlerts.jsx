// The on-screen reminder for a follow-up / task (the same ones the office gets a WhatsApp about — lib/follow-up.js
// screenReminders()): when the time comes, a card drops in at the top of the admin and waits until it is handled — call,
// WhatsApp, the lead card, "done" or "remind me later" — with a chime, an OS notification that stays until clicked while the
// window is in the background, and the browser tab's badge. Which reminders were shown is kept in localStorage
// (afik_task_alerts_v1) and shared by every open tab: a reminder handled in one tab leaves the others too.
import { useCallback, useEffect, useRef, useState } from 'react'
import { FaBell, FaPhoneAlt, FaWhatsapp, FaUser, FaCheck, FaClock } from 'react-icons/fa'
import { screenReminders, lateText, defaultFollowUpText, describeDue } from '../lib/follow-up.js'
import { notifyPrefs, playReminderSound, reminderNotify, bumpTab, desktopPermission, askDesktopPermission } from './lib/waNotify.js'
import { leadCampaign } from './lib/leadFields.js'
import WaFace from './WaFace.jsx'

const KEY = 'afik_task_alerts_v1'
const readSeen = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch { return {} } }
const writeSeen = seen => {
  const cut = Date.now() - 4 * 864e5   // forget what is older than 4 days
  const keep = Object.fromEntries(Object.entries(seen).filter(([, v]) => (v?.snooze || v?.at || 0) > cut))
  try { localStorage.setItem(KEY, JSON.stringify(keep)) } catch {}
}
const markSeen = (key, patch) => { const s = readSeen(); s[key] = { at: Date.now(), ...patch }; writeSeen(s) }

const local = p => { const d = String(p || '').replace(/\D/g, ''); const l = d.startsWith('972') ? '0' + d.slice(3) : d; return l.length === 10 ? `${l.slice(0, 3)}-${l.slice(3, 6)}-${l.slice(6)}` : l }
const intl = p => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('0') ? '972' + d.slice(1) : d }

const TXT = {
  he: { followUp: 'תזכורת: לחזור לליד', task: 'תזכורת למשימה', call: 'התקשר', wa: 'וואטסאפ', card: 'כרטיס ליד', done: 'בוצע',
    later: 'הזכר לי שוב', m10: 'בעוד 10 דק׳', h1: 'בעוד שעה', tomorrow: 'מחר ב-9:00', close: 'סגירה', all: n => `סגירת הכל (${n})`,
    more: n => `ועוד ${n} תזכורות`, perm: 'הפעלת התראות גם כשהחלון ברקע', back: (name) => `לחזור ל${name}`, region: 'תזכורות' },
  en: { followUp: 'Reminder: get back to the lead', task: 'Task reminder', call: 'Call', wa: 'WhatsApp', card: 'Lead card', done: 'Done',
    later: 'Remind me again', m10: 'In 10 min', h1: 'In an hour', tomorrow: 'Tomorrow 9:00', close: 'Close', all: n => `Dismiss all (${n})`,
    more: n => `${n} more reminders`, perm: 'Allow notifications while the window is in the background', back: (name) => `Get back to ${name}`, region: 'Reminders' },
}

function tomorrowNine() {
  // 9:00 tomorrow, Israel wall clock (good enough in the browser: the office works in Israel)
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime()
}

export default function TaskAlerts({ leads, lang = 'he', onDone, onOpenChat, onOpenCard }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const [cards, setCards] = useState([])        // [{ key, leadId, taskId, due }]
  const [laterFor, setLaterFor] = useState('')  // the card whose "remind me again" menu is open
  const [, tick] = useState(0)
  const [perm, setPerm] = useState(desktopPermission)
  const leadsRef = useRef(leads); leadsRef.current = leads
  const cardsRef = useRef(cards); cardsRef.current = cards

  const check = useCallback(() => {
    const rows = leadsRef.current || []
    if (!rows.length) return
    const now = Date.now()
    const fresh = screenReminders(rows, readSeen(), now).filter(x => !cardsRef.current.some(c => c.key === x.key))
    if (!fresh.length) return
    const seen = readSeen()
    for (const x of fresh) seen[x.key] = { at: now }
    writeSeen(seen)
    setCards(cs => [...cs, ...fresh.map(x => ({ key: x.key, leadId: String(x.lead.id), taskId: x.task.id, due: x.due }))])
    const prefs = notifyPrefs()
    if (prefs.sound) playReminderSound()
    const away = document.hidden || !document.hasFocus()
    for (const x of fresh) {
      const name = String(x.lead.name || '').trim() || local(x.lead.phone)
      const head = x.task.kind === 'followup' ? t.back(name) : `${t.task}: ${name}`
      if (away) bumpTab(`⏰ ${head}`)
      if (away && prefs.desktop) {
        const body = [x.task.text && x.task.text !== defaultFollowUpText(x.lead) ? x.task.text : '', local(x.lead.phone), describeDue(x.task.due, { lang })].filter(Boolean).join(' · ')
        reminderNotify({ key: x.key, title: `⏰ ${head}`, body, onClick: () => onOpenCard?.(x.lead) })
      }
    }
  }, [lang, onOpenCard]) // eslint-disable-line react-hooks/exhaustive-deps

  // every 15 s (and whenever the leads change — a new task, a moved one); the "late" chips refresh with it
  useEffect(() => { check() }, [leads, check])
  useEffect(() => {
    const id = setInterval(() => { check(); tick(n => n + 1) }, 15000)
    const onFocus = () => { setPerm(desktopPermission()); check() }
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [check])
  // handled in another tab → leaves this one too
  useEffect(() => {
    const onStorage = e => {
      if (e.key !== KEY) return
      const seen = readSeen()
      setCards(cs => cs.filter(c => !seen[c.key]?.handled && !seen[c.key]?.snooze))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const drop = key => setCards(cs => cs.filter(c => c.key !== key))
  const done = c => { markSeen(c.key, { handled: true }); drop(c.key); const lead = leadsRef.current.find(l => String(l.id) === c.leadId); if (lead) onDone?.(lead, c.taskId) }
  const snooze = (c, until) => { markSeen(c.key, { snooze: until }); setLaterFor(''); drop(c.key) }
  const close = c => { markSeen(c.key, { handled: true }); drop(c.key) }

  // the lead / task as they are now (renamed, done on another screen…)
  const live = cards.map(c => {
    const lead = (leads || []).find(l => String(l.id) === c.leadId)
    const task = lead && (lead.tasks || []).find(x => x.id === c.taskId)
    return lead && task && !task.done ? { ...c, lead, task } : null
  }).filter(Boolean)
  useEffect(() => { if (live.length < cards.length) setCards(cs => cs.filter(c => live.some(l => l.key === c.key))) }, [live.length, cards.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!live.length) return null
  const shown = live.slice(0, 3)
  const now = Date.now()
  return (
    <div className="task-alerts" role="alertdialog" aria-live="assertive" aria-label={t.region} dir={lang === 'en' ? 'ltr' : 'rtl'}>
      {shown.map(c => {
        const { lead, task } = c
        const name = String(lead.name || '').trim() || local(lead.phone)
        const followUp = task.kind === 'followup'
        const extra = task.text && task.text !== defaultFollowUpText(lead) ? task.text : ''
        const camp = leadCampaign(lead, lang)
        const late = now - c.due > 2 * 60e3
        return (
          <div key={c.key} className={`task-alert${late ? ' task-alert--late' : ''}`}>
            <div className="task-alert-top">
              <span className="task-alert-bell" aria-hidden="true"><FaBell size={13}/></span>
              <span className="task-alert-kind">{followUp ? t.followUp : t.task}</span>
              <span className={`task-alert-late${late ? ' is-late' : ''}`}>{lateText(c.due, now, lang)}</span>
              <button type="button" className="task-alert-x" aria-label={t.close} onClick={() => close(c)}>✕</button>
            </div>
            <div className="task-alert-main">
              <WaFace phone={lead.phone} name={name} size={46} lang={lang} style={{ background: 'rgba(var(--brand-rgb),.14)' }}>
                <span className="task-alert-ini">{name.charAt(0)}</span>
              </WaFace>
              <div className="task-alert-who">
                <div className="task-alert-title">{followUp ? t.back('') : ''}<bdi>{followUp ? name : (extra || name)}</bdi></div>
                <div className="task-alert-sub">
                  {!followUp && extra && <bdi>{name}</bdi>}
                  {camp && <span className="task-alert-camp">{camp}</span>}
                  {lead.phone && <span dir="ltr">{local(lead.phone)}</span>}
                  <span>{describeDue(task.due, { now, lang })}</span>
                </div>
                {followUp && extra && <div className="task-alert-note" dir="auto">{extra}</div>}
              </div>
            </div>
            <div className="task-alert-actions">
              {lead.phone && <a className="task-alert-btn task-alert-call" href={`tel:${local(lead.phone).replace(/-/g, '')}`}><FaPhoneAlt size={12}/>{t.call}</a>}
              {lead.phone && <button type="button" className="task-alert-btn task-alert-wa" onClick={() => onOpenChat?.(lead)} title={`wa.me/${intl(lead.phone)}`}><FaWhatsapp size={14}/>{t.wa}</button>}
              <button type="button" className="task-alert-btn" onClick={() => onOpenCard?.(lead)}><FaUser size={11}/>{t.card}</button>
            </div>
            <div className="task-alert-actions task-alert-actions--end">
              <button type="button" className="task-alert-btn task-alert-done" onClick={() => done(c)}><FaCheck size={11}/>{t.done}</button>
              <div className="task-alert-later-wrap">
                <button type="button" className="task-alert-btn" aria-expanded={laterFor === c.key} onClick={() => setLaterFor(f => (f === c.key ? '' : c.key))}><FaClock size={11}/>{t.later}</button>
                {laterFor === c.key && (
                  <div className="task-alert-later" role="menu">
                    <button type="button" role="menuitem" onClick={() => snooze(c, Date.now() + 10 * 60e3)}>{t.m10}</button>
                    <button type="button" role="menuitem" onClick={() => snooze(c, Date.now() + 60 * 60e3)}>{t.h1}</button>
                    <button type="button" role="menuitem" onClick={() => snooze(c, tomorrowNine())}>{t.tomorrow}</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
      {(live.length > 3 || perm === 'default' || live.length > 1) && (
        <div className="task-alerts-foot">
          {live.length > 3 && <span>{t.more(live.length - 3)}</span>}
          {perm === 'default' && <button type="button" onClick={async () => setPerm(await askDesktopPermission())}>{t.perm}</button>}
          {live.length > 1 && <button type="button" onClick={() => live.forEach(close)}>{t.all(live.length)}</button>}
        </div>
      )}
      <style>{`
        .task-alerts{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:10px;width:min(460px,calc(100vw - 24px));font-family:Rubik,sans-serif}
        .task-alert{background:var(--au-pop);color:var(--au-text);border:1px solid rgba(217,119,6,.45);border-top:4px solid #D97706;border-radius:16px;padding:12px 14px 12px;box-shadow:0 18px 50px rgba(0,0,0,.28),0 0 0 4px rgba(217,119,6,.12);animation:taskAlertIn .35s cubic-bezier(.2,.9,.3,1.25)}
        .task-alert--late{border-color:rgba(220,38,38,.45);border-top-color:#DC2626;box-shadow:0 18px 50px rgba(0,0,0,.28),0 0 0 4px rgba(220,38,38,.12)}
        @keyframes taskAlertIn{from{opacity:0;transform:translateY(-18px) scale(.97)}to{opacity:1;transform:none}}
        .task-alert-top{display:flex;align-items:center;gap:8px}
        .task-alert-bell{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#D97706;color:#fff;animation:taskBell 1.8s ease-in-out infinite;transform-origin:50% 10%}
        .task-alert--late .task-alert-bell{background:#DC2626}
        @keyframes taskBell{0%,60%,100%{transform:rotate(0)}10%{transform:rotate(16deg)}20%{transform:rotate(-14deg)}30%{transform:rotate(10deg)}40%{transform:rotate(-6deg)}}
        .task-alert-kind{font-size:12.5px;font-weight:700;color:#B45309}
        .task-alert--late .task-alert-kind{color:#DC2626}
        .task-alert-late{margin-inline-start:auto;font-size:11.5px;font-weight:700;border-radius:999px;padding:2px 9px;background:rgba(217,119,6,.12);color:#B45309}
        .task-alert-late.is-late{background:rgba(220,38,38,.12);color:#DC2626}
        .task-alert-x{border:none;background:none;color:var(--au-text3);cursor:pointer;font-size:13px;line-height:1;padding:4px 2px;min-height:0}
        .task-alert-main{display:flex;gap:12px;align-items:center;margin-top:10px}
        .task-alert-ini{width:46px;height:46px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:19px;color:var(--au-brand-text)}
        .task-alert-who{flex:1;min-width:0}
        .task-alert-title{font-size:17px;font-weight:700;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .task-alert-sub{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin-top:3px;font-size:12.5px;color:var(--au-text2)}
        .task-alert-camp{font-size:11.5px;font-weight:600;color:var(--au-brand-text);background:rgba(var(--brand-rgb),.1);border-radius:6px;padding:1px 6px}
        .task-alert-note{margin-top:6px;font-size:13px;line-height:1.45;background:rgba(var(--ov),.05);border-radius:8px;padding:6px 9px}
        .task-alert-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
        .task-alert-actions--end{margin-top:8px;padding-top:8px;border-top:1px solid var(--au-line)}
        .task-alert-btn{display:inline-flex;align-items:center;gap:7px;min-height:36px;border:1px solid var(--au-line);background:transparent;color:var(--au-text);border-radius:10px;padding:7px 13px;font:600 13px Rubik,sans-serif;cursor:pointer;text-decoration:none}
        .task-alert-btn:hover{background:rgba(var(--ov),.06)}
        .task-alert-call{background:var(--au-brand);border-color:transparent;color:#fff;flex:1;justify-content:center;font-weight:700}
        .task-alert-call:hover{background:var(--au-brand);filter:brightness(1.08)}
        .task-alert-wa{color:#1DA851;border-color:rgba(29,168,81,.45)}
        .task-alert-done{color:#15803D;border-color:rgba(21,128,61,.45);font-weight:700}
        .task-alert-later-wrap{position:relative}
        .task-alert-later{position:absolute;top:calc(100% + 6px);inset-inline-start:0;min-width:150px;background:var(--au-pop);border:1px solid var(--au-line);border-radius:12px;box-shadow:var(--au-shadow3);padding:5px;display:flex;flex-direction:column;z-index:2}
        .task-alert-later button{border:none;background:none;text-align:start;padding:8px 10px;border-radius:8px;font:500 13px Rubik,sans-serif;color:var(--au-text);cursor:pointer;min-height:0}
        .task-alert-later button:hover{background:rgba(var(--ov),.07)}
        .task-alerts-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;font-size:12px;color:var(--au-text2)}
        .task-alerts-foot button{border:1px solid var(--au-line);background:var(--au-pop);color:var(--au-text2);border-radius:999px;padding:5px 12px;font:600 12px Rubik,sans-serif;cursor:pointer;box-shadow:var(--au-shadow2);min-height:0}
        @media (max-width:600px){.task-alerts{top:8px;width:calc(100vw - 16px)}.task-alert-title{font-size:16px}}
        @media (prefers-reduced-motion:reduce){.task-alert,.task-alert-bell{animation:none}}
      `}</style>
    </div>
  )
}
