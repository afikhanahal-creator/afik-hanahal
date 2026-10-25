// The chats tab's bell: how the office hears about a new WhatsApp message (src/lib/waNotify.js). Sound, the OS notification
// (with the browser's permission — and what to do when it is blocked), the card inside the admin, leads only, and a test.
import { useEffect, useState } from 'react'
import { notifyPrefs, setNotifyPrefs, onNotifyPrefs, desktopPermission, askDesktopPermission, desktopNotify, playMessageSound } from './lib/waNotify.js'

const TXT = {
  he: {
    title: 'התראות על הודעות', back: 'חזרה לשיחות',
    lead: 'כל הודעה שליד שולח מגיעה למערכת תוך שנייה. כאן בוחרים איך לשמוע עליה.',
    permOn: 'התראות בדסקטופ פעילות', permOnSub: 'הודעה חדשה תקפוץ גם כשהחלון ברקע או ממוזער.',
    permAsk: 'הפעלת התראות בדסקטופ', permAskSub: 'הדפדפן ישאל פעם אחת. בלי זה תשמעו ותראו הודעות רק כשהמערכת פתוחה מולכם.',
    permDenied: 'הדפדפן חוסם התראות', permDeniedSub: 'לוחצים על סמל המנעול ליד כתובת האתר ← התראות ← אפשר, ואז מרעננים את העמוד.',
    permNone: 'הדפדפן הזה לא תומך בהתראות דסקטופ',
    sound: 'צליל', soundSub: 'צליל קצר בכל הודעה חדשה (שקט יותר כשהשיחה כבר פתוחה)',
    desktop: 'התראה בדסקטופ', desktopSub: 'כשהחלון ברקע: שם הליד, הפרויקט וההודעה. לחיצה פותחת את השיחה',
    toast: 'כרטיס בתוך המערכת', toastSub: 'כרטיס בפינת המסך עם "לפתיחת השיחה". כמה הודעות מאותו ליד מתאחדות לכרטיס אחד',
    leadsOnly: 'רק מלידים', leadsOnlySub: 'בלי התראות ממספרים שאינם לידים במערכת',
    test: 'שליחת התראת בדיקה', tested: 'נשלחה התראת בדיקה',
    testName: 'בדיקת התראות', testText: 'ככה תיראה הודעה חדשה מליד. לחיצה על "לפתיחת השיחה" פותחת אותה.',
  },
  en: {
    title: 'Message alerts', back: 'Back to chats',
    lead: 'Every message a lead sends reaches the system within a second. Choose how you hear about it.',
    permOn: 'Desktop notifications are on', permOnSub: 'A new message pops up even when the window is in the background.',
    permAsk: 'Turn on desktop notifications', permAskSub: 'The browser asks once. Without it you only see messages while the system is in front of you.',
    permDenied: 'The browser blocks notifications', permDeniedSub: 'Click the lock icon next to the address → Notifications → Allow, then reload the page.',
    permNone: 'This browser does not support desktop notifications',
    sound: 'Sound', soundSub: 'A short sound for every new message (softer when the chat is already open)',
    desktop: 'Desktop notification', desktopSub: 'While the window is in the background: the lead, the project and the message. A click opens the chat',
    toast: 'In-app card', toastSub: 'A card in the corner with "Open chat". Several messages from one lead merge into one card',
    leadsOnly: 'Leads only', leadsOnlySub: 'No alerts from numbers that are not leads in the system',
    test: 'Send a test alert', tested: 'Test alert sent',
    testName: 'Alert test', testText: 'This is how a new message from a lead looks. "Open chat" opens it.',
  },
}

function Switch({ on, onChange, label, WA }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      style={{ flexShrink: 0, width: 42, height: 24, minHeight: 0, borderRadius: 12, border: 'none', padding: 2, cursor: 'pointer', background: on ? WA.green : WA.border, transition: 'background .15s', display: 'flex', justifyContent: on ? 'flex-start' : 'flex-end' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }}/>
    </button>
  )
}

export default function WaNotifySettings({ WA, lang = 'he', onBack }) {
  const t = TXT[lang === 'en' ? 'en' : 'he']
  const [prefs, setPrefs] = useState(notifyPrefs)
  const [perm, setPerm] = useState(desktopPermission)
  const [tested, setTested] = useState(false)
  useEffect(() => onNotifyPrefs(setPrefs), [])
  useEffect(() => {
    const on = () => setPerm(desktopPermission())
    window.addEventListener('focus', on)
    return () => window.removeEventListener('focus', on)
  }, [])
  const set = patch => setPrefs(setNotifyPrefs(patch))
  const ask = async () => setPerm(await askDesktopPermission())
  const test = () => {
    if (prefs.sound) playMessageSound()
    window.dispatchEvent(new CustomEvent('afik:wa-test-alert', { detail: { name: t.testName, text: t.testText } }))
    if (prefs.desktop) desktopNotify({ phone: 'test', title: t.testName, body: t.testText })
    setTested(true); setTimeout(() => setTested(false), 2500)
  }
  const rows = [
    ['sound', t.sound, t.soundSub],
    ['desktop', t.desktop, t.desktopSub],
    ['toast', t.toast, t.toastSub],
    ['leadsOnly', t.leadsOnly, t.leadsOnlySub],
  ]
  const permBox = perm === 'granted' ? { c: WA.green, h: t.permOn, s: t.permOnSub }
    : perm === 'denied' ? { c: '#E5484D', h: t.permDenied, s: t.permDeniedSub }
    : perm === 'unsupported' ? { c: WA.subText, h: t.permNone, s: '' }
    : { c: '#D97706', h: t.permAsk, s: t.permAskSub, ask: true }
  return (
    <div dir={lang === 'en' ? 'ltr' : 'rtl'} style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: WA.panelBg, color: WA.bodyText }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 6px' }}>
        <button type="button" onClick={onBack} aria-label={t.back} title={t.back}
          style={{ width: 34, height: 34, minHeight: 0, borderRadius: 8, border: 'none', background: 'transparent', color: WA.subText, cursor: 'pointer', fontSize: 18, transform: lang === 'en' ? 'scaleX(-1)' : 'none' }}>→</button>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{t.title}</h2>
      </div>
      <p style={{ margin: '0 16px 12px', fontSize: 13, color: WA.subText, lineHeight: 1.6 }}>{t.lead}</p>
      <div style={{ margin: '0 12px 12px', padding: '12px 14px', borderRadius: 12, border: `1px solid ${permBox.c}55`, background: permBox.c + '14' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: permBox.c }}>{permBox.h}</div>
        {permBox.s && <div style={{ fontSize: 12.5, color: WA.subText, lineHeight: 1.55, marginTop: 4 }}>{permBox.s}</div>}
        {permBox.ask && (
          <button type="button" onClick={ask}
            style={{ marginTop: 10, border: 'none', borderRadius: 9, padding: '8px 14px', background: '#1DA851', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.permAsk}
          </button>
        )}
      </div>
      <div style={{ margin: '0 12px', borderRadius: 12, border: `1px solid ${WA.border}`, overflow: 'hidden' }}>
        {rows.map(([k, h, sub], i) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? `1px solid ${WA.border}` : 'none', opacity: k === 'desktop' && perm !== 'granted' ? 0.6 : 1 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{h}</div>
              <div style={{ fontSize: 12, color: WA.subText, lineHeight: 1.5, marginTop: 2 }}>{sub}</div>
            </div>
            <Switch on={!!prefs[k]} onChange={v => set({ [k]: v })} label={h} WA={WA}/>
          </div>
        ))}
      </div>
      <div style={{ padding: '14px 12px 20px' }}>
        <button type="button" onClick={test}
          style={{ width: '100%', border: `1.5px solid ${WA.green}`, background: 'transparent', color: WA.green, borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }}>
          {tested ? `✓ ${t.tested}` : t.test}
        </button>
      </div>
    </div>
  )
}
