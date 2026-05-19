import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaClock, FaChevronLeft, FaCheck, FaShieldAlt, FaUniversalAccess, FaMobileAlt, FaDesktop } from 'react-icons/fa'

const C = {
  bg:         '#09090F',
  card:       '#0E0E1C',
  purple:     '#8490D8',
  purpleDeep: '#5A68C5',
  cream:      '#E8E4D8',
  green:      '#82F67F',
  pageBg:     '#F8F7F3',
  surface:    '#FFFFFF',
  border:     '#E8E2D8',
  text:       '#1A1410',
  muted:      '#6B6460',
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <span style={{ display:'inline-flex', alignItems:'center', gap:8, fontSize:11, fontWeight:700,
        letterSpacing:'4px', textTransform:'uppercase', color:C.purpleDeep,
        background:`${C.purpleDeep}12`, border:`1px solid ${C.purpleDeep}28`,
        borderRadius:20, padding:'5px 16px' }}>
        {children}
      </span>
    </div>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background:C.surface, borderRadius:16, border:`1px solid ${C.border}`,
      padding:'28px 32px', boxShadow:'0 2px 16px rgba(0,0,0,.06)', ...style }}>
      {children}
    </div>
  )
}

function Section({ label, title, children }) {
  return (
    <div style={{ marginBottom:36 }}>
      {label && <SectionLabel>{label}</SectionLabel>}
      {title && <h2 style={{ fontSize:'clamp(18px,2.5vw,22px)', fontWeight:800, color:C.text,
        marginBottom:16, lineHeight:1.3 }}>{title}</h2>}
      <Card>{children}</Card>
    </div>
  )
}

function CheckList({ items }) {
  return (
    <ul style={{ listStyle:'none', display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'10px 20px' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          <span style={{ color:C.purpleDeep, marginTop:3, flexShrink:0 }}><FaCheck size={11}/></span>
          <span style={{ fontSize:14.5, color:C.text, lineHeight:1.6 }}>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function ContactCard({ icon: Icon, label, value, href, sub }) {
  return (
    <a href={href || undefined} style={{ textDecoration:'none', display:'flex', alignItems:'center',
      gap:14, background:C.pageBg, borderRadius:12, padding:'16px 20px',
      border:`1px solid ${C.border}`, transition:'border-color .15s, box-shadow .15s',
      cursor: href ? 'pointer' : 'default' }}
      onMouseEnter={e => { if(href){ e.currentTarget.style.borderColor=C.purpleDeep; e.currentTarget.style.boxShadow=`0 4px 16px ${C.purpleDeep}18` }}}
      onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.boxShadow='' }}>
      <div style={{ width:42, height:42, borderRadius:12, background:`${C.purpleDeep}15`,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:C.purpleDeep }}>
        <Icon size={17}/>
      </div>
      <div>
        <div style={{ fontSize:11, color:C.muted, marginBottom:2, fontWeight:600 }}>{label}</div>
        <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{value}</div>
        {sub && <div style={{ fontSize:12, color:C.muted, marginTop:1 }}>{sub}</div>}
      </div>
    </a>
  )
}

function Badge({ text, variant = 'purple' }) {
  const bg    = variant === 'green'  ? `${C.green}18`  : `${C.purple}18`
  const clr   = variant === 'green'  ? '#1E7A1B'       : C.purple
  const bordr = variant === 'green'  ? `${C.green}44`  : `${C.purple}44`
  return (
    <span style={{ background:bg, color:clr, border:`1px solid ${bordr}`,
      borderRadius:20, padding:'6px 18px', fontSize:12, fontWeight:700,
      letterSpacing:'.04em' }}>
      {text}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AccessibilityPage() {
  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${C.pageBg}; font-family: 'Rubik','Heebo','Segoe UI',sans-serif;
               direction: rtl; text-align: right; color: ${C.text}; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${C.pageBg}; }
        ::-webkit-scrollbar-thumb { background: ${C.purpleDeep}55; border-radius: 4px; }
        p + p { margin-top: 12px; }
        @media (max-width: 640px) {
          .a11y-hero-badges { flex-direction: column; align-items: center; }
          .a11y-contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header style={{ background:C.bg, position:'sticky', top:0, zIndex:100,
        borderBottom:`1px solid rgba(132,144,216,.15)` }}>
        <div style={{ maxWidth:920, margin:'0 auto', padding:'0 24px',
          display:'flex', alignItems:'center', justifyContent:'space-between', height:68 }}>
          <img src="/logo.svg" alt="אפיק הנחל" style={{ height:44, width:'auto' }}/>
          <a href="/"
            style={{ display:'flex', alignItems:'center', gap:7, color:C.purple,
              textDecoration:'none', fontSize:14, fontWeight:600, transition:'opacity .15s',
              direction:'ltr' }}
            onMouseEnter={e => e.currentTarget.style.opacity='.72'}
            onMouseLeave={e => e.currentTarget.style.opacity='1'}>
            <FaChevronLeft size={10}/>
            <span>חזרה לאתר</span>
          </a>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <div style={{ background:`linear-gradient(150deg,${C.bg} 0%,#12122A 100%)`,
        padding:'64px 24px 56px', textAlign:'center' }}>
        <div className="a11y-hero-badges"
          style={{ display:'flex', justifyContent:'center', gap:10, marginBottom:28, flexWrap:'wrap' }}>
          <Badge text="WCAG 2.1 AA"/>
          <Badge text="תקן ישראלי 5568" variant="green"/>
          <Badge text="נגישות דיגיטלית"/>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, marginBottom:16 }}>
          <FaUniversalAccess size={34} color={C.purple}/>
          <h1 style={{ fontSize:'clamp(28px,5vw,50px)', fontWeight:900, color:C.cream, lineHeight:1.15 }}>
            הצהרת נגישות
          </h1>
        </div>
        <p style={{ fontSize:13, color:`${C.cream}50`, letterSpacing:'.06em', fontWeight:500 }}>
          עודכן לאחרונה: 10 במאי 2026
        </p>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <main style={{ maxWidth:920, margin:'0 auto', padding:'48px 24px 64px' }}>

        {/* ── מבוא ── */}
        <Section label="מבוא" title="מחויבות לנגישות דיגיטלית">
          <p style={{ fontSize:15.5, color:C.text, lineHeight:1.85 }}>
            אנו רואים חשיבות רבה בהנגשת האתר עבור כלל האוכלוסייה, ובפרט עבור אנשים עם מוגבלויות.
            האתר פועל במטרה לאפשר חוויית גלישה <strong>נגישה, שוויונית, מכובדת ונוחה</strong> ככל האפשר.
          </p>
          <p style={{ fontSize:15.5, color:C.text, lineHeight:1.85, marginTop:12 }}>
            אנו משקיעים מאמצים ומשאבים רבים בהתאמת האתר לדרישות הנגישות בהתאם להוראות הדין ולתקנים המקובלים.
          </p>
        </Section>

        {/* ── רמת הנגישות ── */}
        <Section label="תקנים ורמה" title="רמת הנגישות באתר">
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:20 }}>
            {[
              { icon:FaShieldAlt, title:'תקן ישראלי 5568', sub:'עמידה בדרישות חובה' },
              { icon:FaUniversalAccess, title:'WCAG 2.1 רמה AA', sub:'הנחיות נגישות בינלאומיות' },
              { icon:FaDesktop, title:'רב-פלטפורמי', sub:'דסקטופ · מובייל · טאבלט' },
            ].map(({ icon: Ic, title, sub }, i) => (
              <div key={i} style={{ flex:'1 1 200px', background:C.pageBg, borderRadius:12,
                padding:'18px 20px', border:`1px solid ${C.border}`,
                display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:`${C.purpleDeep}15`,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:C.purpleDeep }}>
                  <Ic size={20}/>
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text }}>{title}</div>
                  <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize:14, color:C.muted, lineHeight:1.7 }}>
            ההתאמות בוצעו עבור הדפדפנים הנפוצים ובשימוש גם במכשירים ניידים.
          </p>
        </Section>

        {/* ── התאמות שבוצעו ── */}
        <Section label="התאמות" title="התאמות הנגישות שבוצעו באתר">
          <CheckList items={[
            'תמיכה בגלישה באמצעות מקלדת בלבד',
            'ניווט תקין וברור בין אזורי האתר',
            'אפשרות דילוג לתוכן המרכזי',
            'התאמות לקוראי מסך',
            'שימוש בכותרות היררכיות תקינות',
            'יחס ניגודיות צבעים תקני',
            'אפשרות להגדלת טקסטים',
            'הדגשת קישורים וכפתורים',
            'התאמת האתר לתצוגה במובייל',
            'הוספת טקסט חלופי לתמונות (ALT)',
            'התאמת טפסים לשימוש נגיש',
            'סימון ברור של פוקוס בעת ניווט',
            'עצירת אנימציות והבהובים במידת הצורך',
            'שימוש בפונט קריא וברור',
          ]}/>
        </Section>

        {/* ── תפריט נגישות ── */}
        <Section label="תפריט נגישות" title="שימוש ברכיב הנגישות">
          <p style={{ fontSize:14.5, color:C.text, lineHeight:1.75, marginBottom:20 }}>
            באתר קיים תפריט נגישות המאפשר ביצוע התאמות נוספות בלחיצה על כפתור הנגישות הקבוע בפינה הימנית התחתונה של המסך.
          </p>
          <CheckList items={[
            'הגדלת והקטנת טקסט (עד 130%)',
            'שינוי ניגודיות צבעים',
            'מצב שחור/לבן',
            'הדגשת קישורים',
            'שינוי לפונט נגיש (Arial)',
            'ריווח מוגדל בין שורות ואותיות',
            'עצירת אנימציות ומעברים',
            'ניווט מותאם מקלדת',
            'פס קריאה אופקי',
            'סמן עכבר מוגדל',
            'קריאת תוכן בקול (TTS)',
            'שמירת העדפות לרענון עמוד',
          ]}/>
        </Section>

        {/* ── תאימות דפדפנים ── */}
        <Section label="תאימות" title="תאימות דפדפנים ומכשירים">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:12, marginBottom:16 }}>
            {[
              { name:'Google Chrome', icon:'🌐' },
              { name:'Mozilla Firefox', icon:'🦊' },
              { name:'Microsoft Edge', icon:'🔷' },
              { name:'Safari', icon:'🧭' },
            ].map(({ name, icon }) => (
              <div key={name} style={{ display:'flex', alignItems:'center', gap:10,
                background:C.pageBg, borderRadius:10, padding:'12px 16px',
                border:`1px solid ${C.border}` }}>
                <span style={{ fontSize:20 }}>{icon}</span>
                <span style={{ fontSize:13.5, fontWeight:600, color:C.text }}>{name}</span>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, background:`${C.purpleDeep}0C`,
            borderRadius:10, padding:'12px 18px', border:`1px solid ${C.purpleDeep}20` }}>
            <FaMobileAlt size={16} color={C.purpleDeep}/>
            <span style={{ fontSize:14, color:C.text }}>האתר מותאם למכשירי מובייל וטאבלטים</span>
          </div>
        </Section>

        {/* ── מגבלות ── */}
        <Section label="מגבלות" title="מגבלות נגישות ידועות">
          <p style={{ fontSize:14.5, color:C.text, lineHeight:1.8 }}>
            למרות מאמצינו להנגיש את כלל חלקי האתר, ייתכן ויתגלו חלקים שטרם הונגשו במלואם או שאינם נגישים באופן מיטבי.
            חלק מהסרטונים המוטמעים עשויים להיות חסרי כתוביות.
          </p>
          <p style={{ fontSize:14.5, color:C.text, lineHeight:1.8, marginTop:12 }}>
            אנו פועלים לשיפור מתמיד. במידה ונתקלתם בבעיה — <strong>נשמח לקבל משוב ולטפל בנושא בהקדם האפשרי.</strong>
          </p>
        </Section>

        {/* ── רכז נגישות ── */}
        <div style={{ marginBottom:32 }}>
          <SectionLabel>יצירת קשר</SectionLabel>
          <h2 style={{ fontSize:'clamp(18px,2.5vw,24px)', fontWeight:800, color:C.text, marginBottom:20, lineHeight:1.3 }}>
            פניות בנושא נגישות
          </h2>

          {/* Coordinator card */}
          <div style={{ background:`linear-gradient(135deg,${C.purpleDeep}18,${C.purpleDeep}08)`,
            border:`1.5px solid ${C.purpleDeep}35`, borderRadius:18, padding:'28px 32px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:C.purpleDeep,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <FaUniversalAccess size={22} color="#fff"/>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:'3px', textTransform:'uppercase',
                  color:C.purpleDeep, marginBottom:4 }}>רכז נגישות</div>
                <div style={{ fontSize:20, fontWeight:800, color:C.text }}>Yogev Kidar</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}
              className="a11y-contact-grid">
              <ContactCard icon={FaPhone}    label="טלפון"          value="054-3049491"         href="tel:0543049491"/>
              <ContactCard icon={FaEnvelope} label="אימייל"         value="kidaryogev@gmail.com" href="mailto:kidaryogev@gmail.com"/>
              <ContactCard icon={FaClock}    label="שעות מענה"      value="08:00–17:00"         sub="ימים א׳–ה׳"/>
            </div>
          </div>

          {/* Company contacts */}
          <Card style={{ padding:'24px 32px' }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.muted, marginBottom:14,
              textTransform:'uppercase', letterSpacing:'2px' }}>דרכי יצירת קשר נוספות</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}
              className="a11y-contact-grid">
              <ContactCard icon={FaPhone}       label="טלפון"   value="055-9811814"          href="tel:0559811814"/>
              <ContactCard icon={FaEnvelope}    label="דוא״ל"   value="afik.hanahal@gmail.com" href="mailto:afik.hanahal@gmail.com"/>
              <ContactCard icon={FaMapMarkerAlt} label="כתובת"  value="הנגר 24, הוד השרון"/>
            </div>
          </Card>
        </div>

        {/* ── התחייבות ── */}
        <div style={{ background:`linear-gradient(135deg,#09090F 0%,#12122A 100%)`,
          borderRadius:20, padding:'36px 36px', textAlign:'center', color:C.cream }}>
          <div style={{ marginBottom:16, display:'flex', justifyContent:'center' }}>
            <FaShieldAlt size={32} color={C.purple}/>
          </div>
          <h2 style={{ fontSize:22, fontWeight:800, marginBottom:12 }}>התחייבות להמשך שיפור</h2>
          <p style={{ fontSize:15, color:`${C.cream}AA`, lineHeight:1.85, maxWidth:600, margin:'0 auto' }}>
            אנו ממשיכים לפעול באופן שוטף לשיפור נגישות האתר כחלק ממחויבותנו לאפשר שימוש נוח, נגיש ושוויוני לכלל המשתמשים.
            תודה על הביקור באתר.
          </p>
        </div>

      </main>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ background:C.bg, borderTop:`1px solid rgba(132,144,216,.12)`,
        padding:'24px', textAlign:'center' }}>
        <p style={{ fontSize:13, color:`${C.cream}44` }}>
          © 2026 אפיק הנחל — ייזום שיווק ותיווך. כל הזכויות שמורות.
        </p>
        <a href="/" style={{ display:'inline-flex', alignItems:'center', gap:6,
          marginTop:10, fontSize:13, color:C.purple, textDecoration:'none',
          fontWeight:600, direction:'ltr' }}>
          <FaChevronLeft size={10}/>
          <span>חזרה לאתר הראשי</span>
        </a>
      </footer>
    </>
  )
}
