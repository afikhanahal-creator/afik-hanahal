import { useState, useEffect } from 'react'

const STORAGE_KEY = 'afik_cookies'

const COOKIE_TYPES = [
  {
    id: 'essential',
    title: 'עוגיות הכרחיות',
    desc: 'נדרשות לתפקוד תקין של האתר, כגון שמירת העדפות ונגישות. לא ניתן לכבותן.',
    alwaysOn: true,
  },
  {
    id: 'analytics',
    title: 'עוגיות ניתוח ביצועים',
    desc: 'מסייעות לנו להבין כיצד המשתמשים מנווטים באתר ולשפר את חווית השימוש.',
    alwaysOn: false,
  },
  {
    id: 'marketing',
    title: 'עוגיות שיווקיות',
    desc: 'מאפשרות הצגת תוכן פרסומי רלוונטי ומדידת אפקטיביות קמפיינים.',
    alwaysOn: false,
  },
]

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: 46,
        height: 26,
        borderRadius: 13,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: on
          ? 'var(--c-purple,#8490D8)'
          : 'color-mix(in srgb,var(--c-cream,#E8E4D8) 18%,transparent)',
        transition: 'background .2s',
        flexShrink: 0,
        outline: 'none',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 4,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: on
            ? 'var(--c-bg,#09090F)'
            : 'color-mix(in srgb,var(--c-cream,#E8E4D8) 60%,transparent)',
          left: on ? 24 : 4,
          transition: 'left .2s, background .2s',
          pointerEvents: 'none',
        }}
      />
    </button>
  )
}

function SettingsModal({ C, isDark, prefs, onSave, onClose }) {
  const [local, setLocal] = useState({ ...prefs })

  function toggle(id) {
    setLocal(p => ({ ...p, [id]: !p[id] }))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="הגדרות עוגיות"
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,.55)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.purple}33`,
          borderRadius: 16,
          padding: '28px 24px',
          width: '100%',
          maxWidth: 440,
          direction: 'rtl',
          fontFamily: 'Rubik,Heebo,sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.cream, letterSpacing: '.01em' }}>התאמת העדפות פרטיות</div>
          <button
            onClick={onClose}
            aria-label="סגור"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: `${C.cream}88`, fontSize: 18, lineHeight: 1, padding: 4,
            }}
          >✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {COOKIE_TYPES.map(ct => (
            <div
              key={ct.id}
              style={{
                background: isDark ? `${C.bg}` : `${C.bg}88`,
                border: `1px solid ${C.purple}22`,
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.cream, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {ct.title}
                  {ct.alwaysOn && (
                    <span style={{ fontSize: 11, background: `${C.green}22`, color: C.green, borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
                      תמיד פעיל
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: `${C.cream}88`, lineHeight: 1.5 }}>{ct.desc}</div>
              </div>
              <Toggle
                on={ct.alwaysOn ? true : local[ct.id]}
                onChange={() => toggle(ct.id)}
                disabled={ct.alwaysOn}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: `1px solid ${C.purple}55`,
              background: 'none',
              color: C.cream,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >ביטול</button>
          <button
            onClick={() => onSave(local)}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: C.purple,
              color: isDark ? C.bg : '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >שמור העדפות</button>
        </div>
      </div>
    </div>
  )
}

export default function CookieConsent({ C, isDark }) {
  const [visible, setVisible] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [prefs, setPrefs] = useState({ essential: true, analytics: false, marketing: false })

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      const timer = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  function acceptAll() {
    const all = { essential: true, analytics: true, marketing: true }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    setPrefs(all)
    setVisible(false)
  }

  function acceptEssential() {
    const min = { essential: true, analytics: false, marketing: false }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(min))
    setPrefs(min)
    setVisible(false)
  }

  function saveCustom(custom) {
    const saved = { essential: true, ...custom }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    setPrefs(saved)
    setShowSettings(false)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <>
      {showSettings && (
        <SettingsModal
          C={C}
          isDark={isDark}
          prefs={prefs}
          onSave={saveCustom}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div
        role="region"
        aria-label="הסכמה לעוגיות"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9990,
          background: isDark
            ? `linear-gradient(to top, ${C.card} 0%, ${C.bg}EE 100%)`
            : `linear-gradient(to top, ${C.card} 0%, ${C.bg}F5 100%)`,
          borderTop: `1px solid ${C.purple}33`,
          backdropFilter: 'blur(12px)',
          direction: 'rtl',
          fontFamily: 'Rubik,Heebo,sans-serif',
          animation: 'cookieSlideUp .4s cubic-bezier(.22,1,.36,1) both',
        }}
      >
        <style>{`
          @keyframes cookieSlideUp {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>

        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          {/* Icon + text */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 240 }}>
            {/* Cookie emoji icon */}
            <span style={{ flexShrink: 0, userSelect: 'none', display: 'flex', alignItems: 'center' }} aria-hidden="true">
              <svg width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <clipPath id="cookieClip">
                    {/* Cookie circle minus bite */}
                    <path d="M23 8 A15 15 0 1 0 38 23 A6 6 0 0 1 29 14 A6 6 0 0 1 23 8 Z"/>
                  </clipPath>
                </defs>
                {/* Glow ring */}
                <circle cx="23" cy="23" r="21" fill="var(--c-purple,#8490D8)" opacity="0.12"/>
                {/* Cookie body with bite */}
                <path d="M23 8 A15 15 0 1 0 38 23 A6 6 0 0 1 29 14 A6 6 0 0 1 23 8 Z"
                  fill="var(--c-purple,#8490D8)" opacity="0.9"/>
                {/* Subtle edge highlight */}
                <path d="M23 8 A15 15 0 1 0 38 23 A6 6 0 0 1 29 14 A6 6 0 0 1 23 8 Z"
                  fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
                {/* Chocolate chips */}
                <circle cx="18" cy="19" r="2.2" fill="rgba(0,0,0,0.4)" clipPath="url(#cookieClip)"/>
                <circle cx="26" cy="17" r="1.8" fill="rgba(0,0,0,0.4)" clipPath="url(#cookieClip)"/>
                <circle cx="21" cy="27" r="2" fill="rgba(0,0,0,0.4)" clipPath="url(#cookieClip)"/>
                <circle cx="28.5" cy="25" r="1.7" fill="rgba(0,0,0,0.4)" clipPath="url(#cookieClip)"/>
                <circle cx="16" cy="26" r="1.5" fill="rgba(0,0,0,0.35)" clipPath="url(#cookieClip)"/>
                <circle cx="24" cy="22" r="1.4" fill="rgba(0,0,0,0.3)" clipPath="url(#cookieClip)"/>
              </svg>
            </span>

            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: C.cream,
                letterSpacing: '.02em', marginBottom: 3,
              }}>
                אנחנו משתמשים בעוגיות
              </div>
              <div style={{ fontSize: 12, color: `${C.cream}99`, lineHeight: 1.6, maxWidth: 580 }}>
                האתר משתמש בעוגיות לשיפור חווית הגלישה, ניתוח שימוש ומטרות שיווקיות.
                תוכלו לאשר הכל, לבחור רק הכרחיות, או להתאים אישית את ההעדפות שלכם.
                לפרטים נוספים ראו את{' '}
                <a
                  href="/accessibility"
                  style={{ color: C.purple, textDecoration: 'underline', fontWeight: 600 }}
                >
                  מדיניות הפרטיות
                </a>
                .
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                background: 'none',
                border: 'none',
                color: `${C.cream}77`,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                padding: '8px 6px',
                letterSpacing: '.02em',
                transition: 'color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = `${C.cream}BB` }}
              onMouseLeave={e => { e.currentTarget.style.color = `${C.cream}77` }}
            >
              הגדרות
            </button>

            <button
              onClick={acceptEssential}
              style={{
                padding: '8px 18px',
                borderRadius: 0,
                border: `1px solid ${C.purple}55`,
                background: 'none',
                color: C.cream,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                transition: 'border-color .15s, background .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.purple; e.currentTarget.style.background = `${C.purple}14` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${C.purple}55`; e.currentTarget.style.background = 'none' }}
            >
              הכרחיות בלבד
            </button>

            <button
              onClick={acceptAll}
              style={{
                padding: '9px 22px',
                borderRadius: 0,
                border: 'none',
                background: C.purple,
                color: isDark ? C.bg : '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                transition: 'opacity .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '.85' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              אישור והמשך
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
