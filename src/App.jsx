import { useState, useEffect, useRef, useCallback, createContext, useContext, useMemo, lazy, Suspense } from 'react'
import { MenuToggleIcon } from './MenuToggleIcon.jsx'
import AccessibilityWidget from './AccessibilityWidget.jsx'
import CookieConsent from './CookieConsent.jsx'
import GovMapWidget, { LAYERS_DEF as GM_LAYERS, BG_OPTIONS as GM_BG_OPTIONS, LAYER_CATS_DEF as GM_LAYER_CATS } from './GovMapWidget.jsx'
import RealEstateCalc from './RealEstateCalc.jsx'
import { AnimatePresence, motion } from 'framer-motion'
import PropertyWizard, { propertyToWizardData } from './PropertyWizard.jsx'
// Retry lazy import once on chunk-load failure (stale CDN cache after deploy)
function lazyWithRetry(fn) {
  return lazy(() => fn().catch(() => {
    if (!sessionStorage.getItem('_chunk_reload')) {
      sessionStorage.setItem('_chunk_reload', '1')
      window.location.reload()
    }
    return fn()
  }))
}
const LeadsBoard   = lazyWithRetry(() => import('./LeadsBoard.jsx'))
const GreenAPIChat = lazyWithRetry(() => import('./GreenAPIChat.jsx'))
import { FaChevronLeft, FaChevronRight, FaEnvelope, FaFacebookF, FaInstagram, FaBed, FaRulerCombined, FaCar, FaSwimmingPool, FaBuilding, FaBoxOpen, FaTree, FaSnowflake, FaShieldAlt, FaCouch, FaTools, FaMapMarkerAlt, FaExternalLinkAlt, FaPhone, FaCompass, FaLeaf, FaCalendarAlt, FaTimes, FaWhatsapp, FaSun, FaFileAlt, FaHome, FaMoneyBill, FaSearch, FaBalanceScale, FaHandshake, FaTrophy, FaHardHat, FaLock, FaKey, FaGlobe, FaSeedling, FaBolt, FaRocket, FaStar, FaChartLine, FaEye, FaPlay, FaWheelchair, FaFire, FaCalculator, FaShareAlt, FaHeart, FaStore, FaCamera, FaWifi, FaIndustry, FaExpand, FaUser, FaUsers, FaDesktop, FaMobileAlt, FaTabletAlt, FaCommentAlt, FaRobot, FaInbox, FaExclamationTriangle, FaChartBar, FaThumbsUp, FaImage, FaPencilAlt, FaCrown, FaMousePointer, FaDollarSign, FaVideo, FaLink, FaCheck, FaCheckCircle, FaUtensils, FaDoorOpen, FaUserShield } from 'react-icons/fa'

// ─── SERVER CONFIG ────────────────────────────────────────────────────────────
// Set VITE_API_URL in Vercel env vars to point at your Render server.
const API_BASE    = (import.meta.env.VITE_API_URL || 'https://afik-hanahal-server.onrender.com').replace(/\/$/, '')
const ADMIN_TOKEN = 'AFIKhanahal2026'

// ─── THEME COLOURS ────────────────────────────────────────────────────────────
const DARK_C  = { bg:'#09090F', purple:'#8490D8', green:'#82F67F', cream:'#E8E4D8', card:'#0E0E1C' }
const LIGHT_C = { bg:'#F5F1E9', purple:'#3F4EB0', green:'#1A6818', cream:'#141420', card:'#FDFCF8' }
const TR = {
  he: {
    nav: { home:'ראשי', ceo:'המנכ״ל', story:'הסיפור', process:'תהליך', services:'שירותים', testimonials:'לקוחות', properties:'נכסים', news:'מה חדש', faq:'שאלות נפוצות', about:'אודות', contact:'צרו קשר' },
    heroBadge:'מומחים בשיווק ותיווך · השרון והמרכז',
    heroH1line1:'הבית הבא שלכם', heroH1line2:'מתחיל כאן',
    heroDesc:'אפיק הנחל - ייזום שיווק ותיווך | חברה יזמית מובילה לאיתור, שיווק וליווי עסקאות קרקע בכל רחבי ישראל',
    heroCTA1:'צפו בנכסים שלנו', heroCTA2:'צרו קשר עכשיו', heroCTA3:'מחשבון נדל״ן',
    heroTags:['בנייה רוויה','צמודת קרקע','דיור מוגן','מסחר מניב','קרקעות'],
    teamTitle:'הצוות שלנו', teamDesc:'האנשים שמאחורי כל עסקה',
    quickNav:'ניווט מהיר', talkToUs:'דברו איתנו', sendMsg:'שלח הודעה',
    accessibility:'הצהרת נגישות', privacy:'מדיניות פרטיות',
    copyright:'© 2026 אפיק הנחל — ייזום שיווק ותיווך. כל הזכויות שמורות.',
    calcNav:'מחשבון', waTitle:'WhatsApp',
    hoursLabel: 'שעות פעילות',
    sunToThurs: 'ראשון–חמישי: 09:00–19:00',
    friday: 'שישי: 09:00–14:00',
    operatingArea: 'אזור פעילות',
    areaServed: 'השרון, המרכז וכל ישראל',
    propertiesTitle: 'נכסים זמינים',
    propertiesH2: 'הנכסים שלנו',
    propertiesDesc: 'קרקעות, מגרשים, פרוייקטים ודירות בלעדיים בכל רחבי ישראל',
    adminProperties: 'ניהול נכסים',
    allProperties: 'הכל',
    regionFilter: 'אזור:',
    typeFilter: 'סוג:',
    allTypes: 'כל הסוגים',
    noProperties: 'לא נמצאו נכסים התואמים את הפילטרים',
    haveProperty: 'יש לך קרקע, מגרש או נכס?',
    propertyDesc: 'בין אם שדה חקלאי, מגרש ירושה או נכס שרוצים לשווק, נבחן יחד את הפוטנציאל',
    contactUsBtn: 'פנה אלינו ←',
    aboutTitle: 'אודות',
    aboutH2: 'אפיק הנחל - ייזום שיווק ותיווך: שותף מהימן לקרקע שלך',
    aboutDesc: 'חברה יזמית מובילה בתחום קרקעות ומגרשים, עם מומחיות עמוקה בשיווק ותיווך באזור השרון והמרכז. מובילים ייזום ושיווק של פרויקטים חדשים ובתי יוקרה, ממגזר הפרט ועד חברות גדולות.',
    aboutPoints: [
      'מומחים בשיווק ותיווך בשרון ובמרכז',
      'מובילים ייזום פרויקטים חדשים ובתי יוקרה',
      'משרתים אדם פרטי ועד חברה גדולה, בכל ישראל',
      'ניסיון של מעל 30 שנה בשוק הנדל״ן'
    ],
    contactNowBtn: 'פנה אלינו עכשיו',
    storyBadge: 'הסיפור שלנו',
    storyH1line1: 'כשאדמה מדברת,',
    storyH1line2: 'אנחנו קשובים',
    storyDesc: 'כל קרקע בישראל נושאת היסטוריה. אנחנו נמצאים בדיוק בין ההיסטוריה לחלום.',
    storyParas: [
      'אם היא חקלאית, מישהו זרע בה, גידל בה תוצרת, חלם עליה בלילות. אם היא עירונית, מישהו בנה עליה, מכר אותה, עבר הלאה.',
      'בישראל, אדמה זה לא רק נדל"ן. אדמה זה זהות. זה ירושה. זה עתיד. מגרשים שנרכשו לפני עשרות שנים ועברו מהורים לילדים. שדות חקלאיים שהחזיקו משפחות שלמות, ועכשיו עומדים בפני שינוי.',
      'אפיק הנחל - ייזום שיווק ותיווך קמה מתוך הבנה עמוקה של המורכבות הזו. בין חקלאי שמחזיק בשדה מדורי דורות, יורש שלא יודע מה לעשות עם הנכס שקיבל, ובין יזם שמחפש את הקרקע הנכונה לפרויקט הבא. אנחנו עומדים באמצע. מגשרים. מלווים. מייצרים עסקאות שעובדות לשני הצדדים.',
    ],
    storyBlockquote: 'אנחנו לא מוכרים קרקעות. אנחנו מחברים אנשים לאדמה שמתאימה להם.',
    storyContactBtn: 'דברו איתנו עכשיו',
    sharonExclusive: 'בלעדיות בשרון',
    nationwideTitle: 'פעילות ארצית',
    nationwideDesc: 'השרון · המרכז · הצפון · הדרום. בכל מקום שיש קרקע עם פוטנציאל, אנחנו שם.',
    storyFeatures: [
      { title:'חקלאות ועיר', desc:'מלווים בעלי שדות חקלאיים ומגרשים עירוניים כאחד' },
      { title:'בלעדיות אמיתית', desc:'גישה לנכסים ייחודיים שלא זמינים במקומות אחרים. רק אצלנו.' },
      { title:'מהירות שוק', desc:'מגיעים לעסקאות לפני שהן עולות לשוק הפתוח' },
      { title:'ליווי מלא', desc:'מהאיתור הראשוני ועד הרישום בטאבו' },
    ],
    processBadge: 'תהליך הליווי',
    processH1: 'שישה שלבים. ליווי אחד.',
    processDesc: 'מהאיתור הראשוני ועד הרישום בטאבו, אנחנו לצדכם בכל שלב של הדרך.',
    processReadyTitle: 'מוכנים להתחיל?',
    processReadyDesc: 'שיחת ייעוץ ראשונה, ללא עלות וללא התחייבות',
    servicesBadge: 'השירותים שלנו',
    servicesH1line1: 'כל מה שצריך,',
    servicesH1line2: 'במקום אחד',
    servicesDesc: 'מהאיתור הראשוני ועד הרישום בטאבו. ליווי מקצועי מלא בכל שלב בעסקת הקרקע.',
    ceoBadge: 'המנכ״ל',
    ceoH2: 'הדרך של ישראל בן יהודה',
    ceoOpeningQuotePre: 'בעולם הנדל״ן, לפני עסקאות, קרקעות ותוכניות, יש ערך אחד שמוביל את הכול.',
    ceoOpeningQuoteHighlight: 'אמינות.',
    ceoOpeningQuotePost: 'זהו הבסיס לכל קשר, לכל עסקה ולכל הצלחה אמיתית לאורך זמן.',
    ceoParagraphs: [
      'עם קרוב ל-30 שנות ניסיון בתחום הנדל״ן, מביא איתו ישראל בן יהודה דרך מקצועית עשירה, שנבנתה לאחר שנים רבות של עשייה ציבורית רחבת היקף ברחבי הארץ. לאורך השנים ליווה וייצג בעלי קרקעות רבים, חלקם ממשיכים לצעוד איתו עד היום, מתוך אמון מלא בדרך, בשקיפות ובמחויבות האישית לכל תהליך.',
      'במסגרת פעילותו, מייצג ישראל בעלי קרקע מול רוכשים פרטיים, קבוצות רכישה וחברות בנייה מהמובילות בישראל, תוך ליווי מקצועי מלא מהשלב החוזי ועד לקידום העסקאות בפועל.',
      'מעבר לכך, מוביל ישראל קידום תוכניות נדל״ן הכוללות שינויי ייעוד, השבחת קרקעות והובלתן עד שלב העלייה לקרקע, מתוך ראייה אסטרטגית וניסיון עמוק בעולם ההתחדשות והפיתוח.',
      'בחברת אפיק הנחל פועל צוות מקצועי של סוכנים ואנשי נדל״ן המתמחים בתיווך, שיווק פרויקטים וליווי עסקאות, עם מטרה אחת ברורה: ליצור ערך אמיתי ללקוחות ולבנות הצלחות שמחזיקות לאורך שנים.',
    ],
    ceoName: 'ישראל בן יהודה',
    ceoRole: 'מייסד ומנכ״ל · אפיק הנחל',
    testimonialsBadge: 'לקוחות מספרים',
    testimonialsH2: 'מה אומרים עלינו',
    testimonialsDesc: 'לקוחות שעזרנו להם למצוא קרקע ולסגור עסקאות מוצלחות',
    faqBadge: 'שאלות נפוצות',
    faqH2: 'כל מה שרציתם לדעת',
    faqDesc: 'תשובות לשאלות הנפוצות ביותר בנושא קרקעות ושירותי אפיק הנחל - ייזום שיווק ותיווך',
    newsBadge: 'עדכונים שוטפים',
    newsH2: 'מה חדש בתחום הנדל"ן',
    newsArchiveBtn: 'כתבות ישנות',
    newsDisclaimer: 'כל יום מתחלפת כתבה אחת בכתבה חדשה · אפיק הנחל אינה אחראית לתוכן הכתבות',
    newsErrorMsg: 'לא ניתן לטעון כתבות כרגע',
    newsErrorSub: 'ייתכן בעיית חיבור — נסה שוב',
    newsRetry: 'נסה שוב',
    footerDesc: 'חברה יזמית מובילה לאיתור, שיווק וליווי עסקאות קרקע בכל רחבי ישראל.',
    phoneLabel: 'טלפון',
    whatsappSend: 'שלח הודעה',
    operatingAreaLabel: 'אזור פעילות',
    sendMessageBtn: 'שלח הודעה',
    switchToEnglish: 'Switch to English',
    switchToHebrew: 'עבור לעברית',
    language: 'שפה',
  },
  en: {
    nav: { home:'Home', ceo:'CEO', story:'Story', process:'Process', services:'Services', testimonials:'Clients', properties:'Properties', news:'News', faq:'FAQ', about:'About', contact:'Contact' },
    heroBadge:'Experts in Marketing & Brokerage · Sharon & Center',
    heroH1line1:'Your Next Home', heroH1line2:'Starts Here',
    heroDesc:'Afik Hanahal – Real estate promotion, marketing and brokerage | Leading company for locating, marketing and accompanying real estate transactions across Israel',
    heroCTA1:'View Properties', heroCTA2:'Contact Us', heroCTA3:'Calculator',
    heroTags:['Multi-family','Detached','Assisted living','Commercial','Land'],
    teamTitle:'Our Team', teamDesc:'The people behind every deal',
    quickNav:'Quick Navigation', talkToUs:'Talk to Us', sendMsg:'Send Message',
    accessibility:'Accessibility Statement', privacy:'Privacy Policy',
    copyright:'© 2026 Afik Hanahal — Real Estate Marketing. All rights reserved.',
    calcNav:'Calc', waTitle:'WhatsApp',
    hoursLabel: 'Business Hours',
    sunToThurs: 'Sun–Thu: 09:00–19:00',
    friday: 'Fri: 09:00–14:00',
    operatingArea: 'Service Area',
    areaServed: 'Sharon, Center & All Israel',
    propertiesTitle: 'Available Properties',
    propertiesH2: 'Our Properties',
    propertiesDesc: 'Land, plots, projects and exclusive properties throughout Israel',
    adminProperties: 'Manage Properties',
    allProperties: 'All',
    regionFilter: 'Region:',
    typeFilter: 'Type:',
    allTypes: 'All Types',
    noProperties: 'No properties match the selected filters',
    haveProperty: 'Have land, a plot, or a property?',
    propertyDesc: 'Whether it\'s an agricultural field, an inherited plot, or a property you want to market, let\'s look at the potential together',
    contactUsBtn: 'Contact Us →',
    aboutTitle: 'About',
    aboutH2: 'Afik Hanahal – Real Estate Marketing: Your Trusted Land Partner',
    aboutDesc: 'Leading company in land and plot market, with deep expertise in real estate marketing and brokerage in the Sharon and Center region. We lead the marketing and development of new projects and luxury homes, from private individuals to large companies.',
    aboutPoints: [
      'Experts in marketing & brokerage across the Sharon and Center',
      'Leaders in new project development & luxury homes',
      'Serving private owners and large companies throughout Israel',
      'Over 30 years of experience in real estate market'
    ],
    contactNowBtn: 'Contact Us Now',
    storyBadge: 'Our Story',
    storyH1line1: 'When Land Speaks,',
    storyH1line2: 'We Listen',
    storyDesc: 'Every plot of land in Israel carries history. We stand right between the past and the dream.',
    storyParas: [
      "If it's agricultural, someone sowed it, grew produce in it, dreamed about it at night. If it's urban, someone built on it, sold it, moved on.",
      "In Israel, land is not just real estate. Land is identity. It's heritage. It's the future. Plots purchased decades ago, passed from parents to children. Agricultural fields that sustained entire families, now standing at the edge of change.",
      "Afik Hanahal was established from a deep understanding of this complexity. Between the farmer who has held a field for generations, the heir who doesn't know what to do with inherited property, and the developer seeking the right land for their next project. We stand in the middle. Bridging. Guiding. Creating deals that work for both sides.",
    ],
    storyBlockquote: "We don't sell land. We connect people to the land that fits them.",
    storyContactBtn: 'Talk to Us Now',
    sharonExclusive: 'Sharon Exclusives',
    nationwideTitle: 'Nationwide Activity',
    nationwideDesc: 'Sharon · Center · North · South. Wherever there is land with potential, we are there.',
    storyFeatures: [
      { title:'Agriculture & Urban', desc:'Supporting owners of agricultural fields and urban plots alike' },
      { title:'True Exclusivity', desc:"Access to unique properties not available anywhere else. Only with us." },
      { title:'Market Speed', desc:'We reach deals before they hit the open market' },
      { title:'Full Support', desc:'From initial search to final Tabu registration' },
    ],
    processBadge: 'Our Process',
    processH1: 'Six Steps. One Partner.',
    processDesc: 'From the first search to final registration, we are by your side at every step.',
    processReadyTitle: 'Ready to Start?',
    processReadyDesc: 'First consultation, no cost, no commitment',
    servicesBadge: 'Our Services',
    servicesH1line1: 'Everything you need,',
    servicesH1line2: 'In one place',
    servicesDesc: 'From the first search to final Tabu registration. Complete professional support at every stage.',
    ceoBadge: 'The CEO',
    ceoH2: 'The Journey of Israel Ben-Yehuda',
    ceoOpeningQuotePre: 'In real estate, before deals, land, and plans, there is one value that leads everything.',
    ceoOpeningQuoteHighlight: 'Trust.',
    ceoOpeningQuotePost: 'This is the foundation of every relationship, every transaction, and every lasting success.',
    ceoParagraphs: [
      'With nearly 30 years of experience in real estate, Israel Ben-Yehuda brings a rich professional track record built through years of extensive public service across Israel. Over the years, he has guided and represented many land owners, some of whom continue to work with him to this day, driven by full trust in the process, transparency, and personal commitment.',
      'In his work, Israel represents landowners before private buyers, purchasing groups, and leading construction companies in Israel, providing full professional guidance from the contractual stage through to the actual advancement of transactions.',
      'Beyond this, Israel leads the promotion of real estate plans including zoning changes, land enhancement, and guiding them through to the groundbreaking stage, drawing on strategic vision and deep experience in the world of urban renewal and development.',
      'At Afik Hanahal, a professional team of agents and real estate specialists works in brokerage, project marketing, and deal support, with one clear goal: to create real value for clients and build lasting successes.',
    ],
    ceoName: 'Israel Ben-Yehuda',
    ceoRole: 'Founder & CEO · Afik Hanahal',
    testimonialsBadge: 'Clients Speak',
    testimonialsH2: 'What They Say About Us',
    testimonialsDesc: 'Clients we helped find land and close successful deals',
    faqBadge: 'FAQ',
    faqH2: 'Everything You Wanted to Know',
    faqDesc: 'Answers to the most common questions about land and Afik Hanahal services',
    newsBadge: 'Latest Updates',
    newsH2: "What's New in Real Estate",
    newsArchiveBtn: 'Archive',
    newsDisclaimer: 'One article rotates daily · Afik Hanahal is not responsible for article content',
    newsErrorMsg: 'Unable to load articles right now',
    newsErrorSub: 'Connection issue — please try again',
    newsRetry: 'Retry',
    footerDesc: 'Leading entrepreneurial company for locating, marketing and accompanying real estate transactions across Israel.',
    phoneLabel: 'Phone',
    whatsappSend: 'Send Message',
    operatingAreaLabel: 'Service Area',
    sendMessageBtn: 'Send Message',
    switchToEnglish: 'עברית',
    switchToHebrew: 'English',
    language: 'Language',
  }
}
const ThemeCtx = createContext({ C: DARK_C, isDark: true, toggleTheme: () => {}, lang: 'he', setLang: () => {}, logoNavSize: 70, setLogoNavSize: () => {} })
const useTheme = () => useContext(ThemeCtx)

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
const makeGlobal = (C, isDark) => `
  :root {
    --c-purple:${C.purple}; --c-bg:${C.bg}; --c-card:${C.card};
    --c-cream:${C.cream};   --c-green:${C.green};
  }
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html { scroll-behavior:smooth; font-size:16px; -webkit-text-size-adjust:100%; }
  body { background:${C.bg}; color:${C.cream}; font-family:'Rubik','Heebo','Segoe UI',sans-serif; direction:rtl; text-align:right; overflow-x:hidden; font-size:15px; line-height:1.6; -webkit-overflow-scrolling:touch; overscroll-behavior:auto; }
  * { scroll-behavior:smooth; }
  @media (prefers-reduced-motion: no-preference) {
    html { scroll-behavior:smooth; }
  }
  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:${C.bg}; }
  ::-webkit-scrollbar-thumb { background:${C.purple}55; border-radius:4px; }

  /* ── Core animations ── */
  @keyframes fadeUp      { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
  @keyframes float       { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
  @keyframes pulse       { 0%,100%{opacity:.6} 50%{opacity:1} }

  @keyframes blob1       { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-30px) scale(1.05)} 66%{transform:translate(-20px,20px) scale(.95)} }
  @keyframes blob2       { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-40px,20px) scale(1.08)} 66%{transform:translate(20px,-15px) scale(.92)} }
  @keyframes blob3       { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(15px,-25px) scale(1.03)} }
  @keyframes scrollBounce{ 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-8px)} }
  @keyframes glowPulse   { 0%,100%{box-shadow:${isDark ? `0 0 20px ${C.purple}33` : `0 2px 8px ${C.purple}22`}} 50%{box-shadow:${isDark ? `0 0 44px ${C.purple}77` : `0 4px 16px ${C.purple}44`}} }
  @keyframes counterGlow { 0%,100%{text-shadow:${isDark ? `0 0 24px ${C.green}77,0 0 48px ${C.green}33` : 'none'}} 50%{text-shadow:${isDark ? `0 0 36px ${C.green}CC,0 0 72px ${C.green}66` : 'none'}} }
  @keyframes ambientPulse{ 0%,100%{opacity:1} 50%{opacity:.75} }
  @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
  .prop-carousel::-webkit-scrollbar { display:none }
  .prop-carousel { scrollbar-width:none; -ms-overflow-style:none }
  .svc-carousel::-webkit-scrollbar { display:none }
  .svc-carousel { scrollbar-width:none; -ms-overflow-style:none }

  /* ── UI/UX Pro Max: Kinetic Typography ── */
  @keyframes letterReveal {
    0%   { opacity:0; transform:translateY(20px) rotateZ(3deg); }
    70%  { transform:translateY(-2px) rotateZ(-0.5deg); }
    100% { opacity:1; transform:translateY(0) rotateZ(0deg); }
  }

  /* ── UI/UX Pro Max: Gradient flow ── */
  @keyframes gradientFlow {
    0%,100% { background-position:0% 50%; }
    50%     { background-position:100% 50%; }
  }

  /* ── UI/UX Pro Max: Card entrance with spring ── */
  @keyframes cardIn {
    0%   { opacity:0; transform:translateY(44px) scale(.93); }
    65%  { transform:translateY(-7px) scale(1.025); }
    100% { opacity:1; transform:translateY(0) scale(1); }
  }
  @keyframes cardFloat {
    0%,100% { transform:translateY(0px); }
    50%     { transform:translateY(-10px); }
  }

  /* ── Marquee ── */
  @keyframes marquee {
    from { transform:translateX(0); }
    to   { transform:translateX(-50%); }
  }

  /* ── Icon rotation ── */
  @keyframes iconSpin {
    0%,100% { transform:scale(1) rotate(0deg); }
    50%     { transform:scale(1.12) rotate(8deg); }
  }

  /* ── Hero ── */
  .hero-title {
    font-size:clamp(36px,6vw,76px); font-weight:800; line-height:1.1; margin-bottom:24px;
    color:${C.cream};
    animation:fadeUp .9s cubic-bezier(0.16,1,0.3,1) .3s forwards; opacity:0;
    letter-spacing:-.02em;
  }
  .fade-up-1 { animation:fadeUp .9s cubic-bezier(0.16,1,0.3,1) .1s forwards; opacity:0; }
  .fade-up-2 { animation:fadeUp .9s cubic-bezier(0.16,1,0.3,1) .5s forwards; opacity:0; }
  .fade-up-3 { animation:fadeUp .9s cubic-bezier(0.16,1,0.3,1) .6s forwards; opacity:0; }
  .fade-up-4 { animation:fadeUp .9s cubic-bezier(0.16,1,0.3,1) .7s forwards; opacity:0; }

  /* ── Cards — flat editorial surfaces ── */
  .glass-card {
    background:${C.card};
    border:1px solid ${C.purple}22;
    border-radius:12px;
    position:relative; overflow:hidden;
    box-shadow:${isDark ? '0 4px 24px rgba(0,0,0,.18)' : '0 2px 12px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.04)'};
    transition:border-color .3s cubic-bezier(0.16,1,0.3,1), box-shadow .3s cubic-bezier(0.16,1,0.3,1), transform .3s cubic-bezier(0.16,1,0.3,1);
    will-change:transform;
  }
  .glass-card:hover {
    border-color:${C.purple}55;
    transform:translateY(-4px);
    box-shadow:${isDark ? '0 20px 40px rgba(0,0,0,.22)' : '0 8px 28px rgba(0,0,0,.10), 0 2px 8px rgba(0,0,0,.06)'};
  }

  /* ── Service cards ── */
  .svc-card {
    background:${C.card};
    border:1px solid ${C.purple}22;
    border-radius:12px;
    position:relative; overflow:hidden;
    box-shadow:${isDark ? '0 4px 24px rgba(0,0,0,.18)' : '0 2px 12px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.04)'};
    transition:border-color .3s cubic-bezier(0.16,1,0.3,1), box-shadow .3s cubic-bezier(0.16,1,0.3,1), transform .3s cubic-bezier(0.16,1,0.3,1);
  }
  .svc-card:hover {
    border-color:${C.purple}55;
    transform:translateY(-4px);
    box-shadow:${isDark ? '0 20px 40px rgba(0,0,0,.22)' : '0 8px 28px rgba(0,0,0,.10), 0 2px 8px rgba(0,0,0,.06)'};
  }

  /* ── Nav buttons ── */
  .nav-btn { padding:8px 14px; border-radius:0; border:none; background:transparent; color:${C.cream}99; font-size:13px; font-weight:500; letter-spacing:.04em; cursor:pointer; font-family:inherit; transition:color .2s; position:relative; }
  .nav-btn::after { content:''; position:absolute; bottom:2px; left:14px; right:14px; height:1.5px; background:${C.purple}; border-radius:1px; transform:scaleX(0); transform-origin:center; transition:transform .28s cubic-bezier(.16,1,.3,1); }
  .nav-btn:hover::after, .nav-btn.active::after { transform:scaleX(1); }
  .nav-btn:hover { color:${C.cream}; }
  .nav-btn.active { color:${C.purple}; }

  /* ── Filter buttons ── */
  .filter-btn { padding:9px 20px; border-radius:0; font-size:13px; letter-spacing:.04em; cursor:pointer; font-family:inherit; transition:all .15s; border:1px solid ${C.purple}33; background:transparent; color:${C.cream}88; }
  .filter-btn:hover { border-color:${C.purple}66; color:${C.cream}; }
  .filter-btn.active-type   { border-color:${C.purple}; background:${C.purple}20; color:${C.purple}; }
  .filter-btn.active-region { border-color:${C.purple}; background:${C.purple}20; color:${C.purple}; }

  /* ── Action buttons ── */
  .primary-btn {
    padding:16px 38px;
    background:${C.cream}; color:${C.bg};
    border:none; border-radius:0; font-size:13px; font-weight:600;
    letter-spacing:.08em; text-transform:uppercase;
    cursor:pointer; font-family:inherit;
    transition:transform .3s cubic-bezier(0.16,1,0.3,1), box-shadow .3s cubic-bezier(0.16,1,0.3,1), background .15s;
  }
  .primary-btn:hover {
    transform:translateY(-2px);
    background:${C.purple}; color:#fff;
    box-shadow:0 20px 40px rgba(132,144,216,.2);
  }
  .outline-btn {
    padding:15px 36px; background:transparent;
    border:1px solid ${C.purple}55;
    border-radius:0; color:${C.cream}; font-size:12px; font-weight:600;
    letter-spacing:.08em; text-transform:uppercase;
    cursor:pointer; font-family:inherit;
    transition:border-color .15s, transform .3s cubic-bezier(0.16,1,0.3,1), background .15s;
  }
  .outline-btn:hover { border-color:${C.purple}; background:${C.purple}18; transform:translateY(-2px); }

  /* ── Counter ── */
  .tc-wrap { display:inline-flex; align-items:baseline; gap:2px; }
  .tc-num  { font-family:monospace; font-weight:700; color:${C.green}; line-height:1; text-shadow:${isDark ? `0 0 24px ${C.green}88, 0 0 48px ${C.green}44` : 'none'}; animation:counterGlow 3s ease infinite; }
  .tc-sfx  { color:${C.green}; font-weight:700; text-shadow:${isDark ? `0 0 16px ${C.green}77` : 'none'}; }

  /* ── Section reveals ── */
  .story-reveal { opacity:0; transform:translateY(28px); transition:opacity .6s,transform .6s; }
  .story-reveal.visible { opacity:1; transform:translateY(0); }

  /* ── City cards ── */
  .city-card-wrap { perspective: 1000px; }
  .city-card-accent { transition: width 0.35s ease; }

  /* ── WhatsApp float ── */
  .wa-float {
    position:fixed; bottom:22px; right:22px; width:56px; height:56px;
    background:#25D366; border-radius:50%; display:flex; align-items:center; justify-content:center;
    box-shadow:0 4px 20px rgba(37,211,102,.65), 0 0 0 0 rgba(37,211,102,.4); z-index:9992;
    transition:transform .25s cubic-bezier(.2,.8,.4,1), box-shadow .25s, opacity .25s;
    text-decoration:none; opacity:1;
    animation: wa-pulse 2.8s ease-in-out infinite;
  }
  @keyframes wa-pulse {
    0%,100% { box-shadow:0 4px 20px rgba(37,211,102,.65), 0 0 0 0 rgba(37,211,102,.4); }
    50%      { box-shadow:0 6px 28px rgba(37,211,102,.85), 0 0 0 10px rgba(37,211,102,.0); }
  }
  .wa-float:hover { transform:scale(1.12) translateY(-3px); box-shadow:0 10px 40px rgba(37,211,102,.9), 0 0 28px rgba(37,211,102,.5); animation:none; }

  /* ── Back to top ── */
  .back-to-top {
    position:fixed; bottom:148px; right:22px; width:40px; height:40px;
    border-radius:50%; background:rgba(132,144,216,.32); border:1px solid rgba(132,144,216,.28);
    color:rgba(255,255,255,.85); font-size:17px; line-height:1; cursor:pointer; z-index:9991;
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 2px 12px rgba(132,144,216,.2); backdrop-filter:blur(8px);
    transition:opacity .25s, transform .25s, background .2s; opacity:0; pointer-events:none;
  }
  .back-to-top.visible { opacity:1; pointer-events:auto; }
  .back-to-top:hover { background:rgba(132,144,216,.72); transform:translateY(-3px); }
  @media(max-width:600px) { .back-to-top { bottom:136px; right:14px; width:40px; height:40px; font-size:17px; } }
  @supports(padding:max(0px)) { .back-to-top { right:max(14px,env(safe-area-inset-right)) !important; bottom:max(148px,calc(140px + env(safe-area-inset-bottom))) !important; } }

  /* ── Hamburger — animated SVG toggle ── */
  .hamburger-btn {
    display:flex; align-items:center; justify-content:center;
    width:92px; height:92px;
    cursor:pointer; background:transparent;
    border:none; border-radius:0;
    color:${C.cream}CC; transition:color .2s, opacity .2s;
    flex-shrink:0; padding:0;
  }
  .hamburger-btn:hover { color:${C.cream}; opacity:.85; }
  .hamburger-btn.open  { color:${C.purple}; }
  @media(max-width:600px){.desktop-logo-nav{display:none!important;}}

  /* ── Nav icon buttons (GABAY style) ── */
  .nav-icon-btn {
    width:47px; height:47px; border-radius:50%;
    display:inline-flex; align-items:center; justify-content:center;
    border:1.5px solid ${C.purple}${isDark ? '28' : '44'}; color:${isDark ? C.cream + '99' : C.cream};
    text-decoration:none; background:transparent;
    cursor:pointer; transition:all .22s; flex-shrink:0;
  }
  .nav-icon-btn:hover { border-color:${C.purple}; background:${C.purple}18; color:${C.cream}; transform:translateY(-1px); }
  .nav-lang-btn {
    display:inline-flex; align-items:center; gap:6px;
    padding:7px 14px; border-radius:22px;
    border:1.5px solid ${C.purple}${isDark ? '28' : '44'}; background:transparent;
    color:${isDark ? C.cream + '99' : C.cream}; cursor:pointer; font-family:inherit;
    font-size:12px; font-weight:800; letter-spacing:.07em; transition:all .22s;
  }
  .nav-lang-btn:hover { border-color:${C.purple}; background:${C.purple}18; color:${C.cream}; transform:translateY(-1px); }

  /* ── Nav side panel ── */
  @keyframes panelSlideIn { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
  @keyframes overlayFadeIn { from { opacity:0 } to { opacity:1 } }
  .nav-overlay {
    position:fixed; inset:0; background:rgba(0,0,0,.55);
    backdrop-filter:blur(4px); z-index:150;
    animation:overlayFadeIn .2s ease forwards;
  }
  .nav-panel {
    position:fixed; top:0; right:0; bottom:0; width:min(320px,85vw);
    background:${isDark ? 'rgba(11,11,26,0.92)' : C.card};
    backdrop-filter:${isDark ? 'blur(6px)' : 'none'}; -webkit-backdrop-filter:${isDark ? 'blur(6px)' : 'none'};
    border-left:1px solid ${C.purple}${isDark ? '33' : '22'};
    box-shadow:${isDark ? '-12px 0 64px rgba(0,0,0,.6)' : '-4px 0 32px rgba(0,0,0,.12), -1px 0 4px rgba(0,0,0,.06)'};
    z-index:160; display:flex; flex-direction:column;
    animation:panelSlideIn .3s cubic-bezier(.22,.68,0,1.2) forwards;
    padding:0 0 32px; overflow:hidden;
  }
  .nav-panel-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:18px 20px; border-bottom:1px solid ${C.purple}22;
    background:${isDark ? 'transparent' : C.bg};
  }
  .nav-panel-close {
    background:${isDark ? 'rgba(255,255,255,.07)' : C.purple + '10'}; border:1px solid ${C.purple}33;
    border-radius:8px; width:36px; height:36px; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    color:${C.cream}; font-size:18px; transition:background .2s;
  }
  .nav-panel-close:hover { background:${isDark ? 'rgba(255,255,255,.14)' : C.purple + '1E'}; }
  .nav-panel-links { flex:1; overflow-y:auto; padding:12px 16px; display:flex; flex-direction:column; gap:4px; }
  .nav-panel-item {
    display:flex; align-items:center; justify-content:flex-start; gap:10px;
    width:100%; padding:14px 16px;
    background:transparent; border:none; border-radius:12px;
    color:${isDark ? C.cream + 'CC' : C.cream + 'DD'}; font-size:16px; font-weight:500; font-family:inherit;
    cursor:pointer; transition:background .2s, color .2s;
    letter-spacing:.3px;
  }
  .nav-panel-item:hover { background:${C.purple}${isDark ? '14' : '0E'}; color:${C.cream}; }
  .nav-panel-item.active { background:${C.purple}${isDark ? '20' : '12'}; color:${C.purple}; }
  .nav-panel-links:hover .nav-panel-item.active { background:transparent; color:${C.cream}CC; }
  .nav-panel-links:hover .nav-panel-item:hover  { background:${C.purple}14; color:${C.cream}; }
  .nav-item-bar {
    display:inline-block; height:8px; width:0; border-radius:5px;
    background:linear-gradient(90deg, ${C.purple}CC 0%, ${C.purple} 50%, ${C.purple}99 100%);
    border:1px solid ${C.purple}88;
    box-shadow:0 2px 8px ${C.purple}99, 0 0 16px ${C.purple}44;
    transition:width .2s cubic-bezier(.4,0,.2,1), opacity .18s;
    opacity:0; flex-shrink:0;
  }
  .nav-panel-item.active .nav-item-bar { width:24px; opacity:1; }
  .nav-panel-item:hover .nav-item-bar  { width:24px; opacity:1; }
  .nav-panel-links:hover .nav-panel-item.active .nav-item-bar { width:0; opacity:0; }
  .nav-panel-links:hover .nav-panel-item:hover .nav-item-bar  { width:24px; opacity:1; }
  .nav-panel-phone {
    margin:16px 16px 0; padding:14px 16px; border-radius:0;
    background:${C.cream}; color:${C.bg};
    text-decoration:none; font-size:12px; font-weight:600;
    letter-spacing:.08em; text-transform:uppercase;
    text-align:center; display:block; transition:background .15s;
  }
  .nav-panel-phone:hover { background:${C.purple}; color:#fff; }

  /* ── Responsive ── */
  @media(max-width:768px) {
    .about-grid  { grid-template-columns:1fr !important; }
    .footer-grid { grid-template-columns:1fr !important; }
    .story-grid  { grid-template-columns:1fr !important; }
    .story-grid p { text-align:center !important; }
    .story-grid blockquote { text-align:center !important; border-right:none !important; padding-right:0 !important; }
    .story-btns { justify-content:center !important; }
    .svc-bento   { grid-template-columns:1fr !important; }
    .svc-bento > * { grid-column:span 1 !important; }
    .nav-phone       { display:none !important; }
    .nav-social-hide { display:none !important; }
    .testi-card-wrap { flex-direction:column !important; min-height:0 !important; }
    .testi-txt-col   { order:1 !important; padding:12px 14px 8px !important; gap:5px !important; justify-content:flex-start !important; }
    .testi-img-col   { order:2 !important; width:100% !important; height:clamp(180px,30vh,300px) !important; background:#06040f !important; border-top:1px solid rgba(132,144,216,.15) !important; }
    .testi-img-col img { object-fit:contain !important; object-position:center center !important; }
    .testi-dots { display:none !important; }
    .placeholder-grid { grid-template-columns:1fr !important; }
    .prop-form-grid   { grid-template-columns:1fr !important; }
    .prop-chk-grid    { grid-template-columns:repeat(2,1fr) !important; }
    .prop-img-grid    { grid-template-columns:repeat(auto-fill,minmax(90px,1fr)) !important; }
  }
  @media(max-width:720px) {
    .placeholder-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
  }

  /* ── Social neon buttons ── */
  .social-btn {
    width:47px; height:47px; border-radius:50%;
    display:inline-flex; align-items:center; justify-content:center;
    background:rgba(255,255,255,.04);
    border:1.5px solid rgba(255,255,255,.13);
    cursor:pointer; transition:all .25s cubic-bezier(.2,.8,.4,1);
    text-decoration:none; color:inherit; flex-shrink:0;
  }
  .social-btn:hover { transform:scale(1.12) translateY(-2px); }
  .social-btn.email     { color:#FF3CAC; }
  .social-btn.email:hover     { border-color:#FF3CAC; box-shadow:0 0 18px #FF3CAC88, 0 0 40px #FF3CAC44; background:rgba(255,60,172,.1); }
  .social-btn.facebook  { color:#1877F2; }
  .social-btn.facebook:hover  { border-color:#1877F2; box-shadow:0 0 18px #1877F288, 0 0 40px #1877F244; background:rgba(24,119,242,.1); }
  .social-btn.instagram { color:#E1306C; }
  .social-btn.instagram:hover { border-color:#E1306C; box-shadow:0 0 18px #E1306C88, 0 0 40px #E1306C44; background:rgba(225,48,108,.1); }

  /* ── Property detail modal ── */
  /* ── CEO Section ── */
  .ceo-grid { display:grid; grid-template-columns:320px 1fr; gap:56px; align-items:start; }
  @media(max-width:860px) { .ceo-grid { grid-template-columns:1fr; gap:32px; } }
  .ceo-photo-col { position:sticky; top:88px; }
  @media(max-width:860px) { .ceo-photo-col { position:static; max-width:300px; margin:0 auto; width:100%; } }

  @keyframes gallery-fade { from { opacity:0 } to { opacity:1 } }
  @keyframes field-border-glow {
    0%,100% { box-shadow: 0 0 0 2px rgba(132,144,216,.22), 0 0 8px rgba(132,144,216,.08) }
    50%      { box-shadow: 0 0 0 3px rgba(130,246,127,.28), 0 0 16px rgba(130,246,127,.12) }
  }
  .contact-input:focus {
    border-color: rgba(132,144,216,.75) !important;
    outline: none !important;
    animation: field-border-glow 2.4s ease infinite !important;
  }
  .prop-gallery-main { position:relative; width:100%; height:clamp(300px,58vw,580px); background:#000; overflow:hidden; }
  .prop-gallery-thumb-strip { display:flex; gap:7px; padding:10px 16px; background:#07070F; overflow-x:auto; border-bottom:1px solid rgba(132,144,216,.07); scrollbar-width:thin; scrollbar-color:rgba(132,144,216,.25) transparent; }
  .prop-thumb-btn { position:relative; flex-shrink:0; width:90px !important; height:62px !important; min-width:90px !important; min-height:62px !important; padding:0 !important; border-radius:8px; overflow:hidden; cursor:pointer; background:#111128; transition:border-color .2s, opacity .2s, transform .15s; }
  .prop-thumb-btn:hover { opacity:1 !important; transform:scale(1.05); }
  .prop-thumb-btn img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
  .prop-thumb-btn .thumb-fallback { position:absolute; inset:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:4px; background:#111128; color:rgba(132,144,216,.5); font-size:20px; }
  .prop-card { background:var(--c-card); border:1px solid rgba(132,144,216,.1); border-radius:16px; overflow:hidden; display:flex; flex-direction:column; cursor:pointer; transition:transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s, border-color .25s; }
  @media (hover: hover) { .prop-card:hover { transform:translateY(-6px); box-shadow:0 28px 64px rgba(0,0,0,.32), 0 0 0 1px rgba(132,144,216,.22); border-color:rgba(132,144,216,.3); } }
  .prop-card-img { position:relative; padding-bottom:67%; background:linear-gradient(135deg,rgba(132,144,216,.1),rgba(9,9,15,.5)); flex-shrink:0; overflow:hidden; }
  .prop-card-body { padding:16px 18px 18px; display:flex; flex-direction:column; flex:1; }
  .prop-card-price { font-size:21px; font-weight:900; line-height:1.1; }
  .prop-card-cta { padding:8px 13px; border-radius:8px; font-size:12px; font-weight:700; display:flex; align-items:center; gap:5px; white-space:nowrap; transition:all .2s; border:1px solid; cursor:pointer; font-family:inherit; }
  .mortgage-inline-grid { display:grid; grid-template-columns:1fr 1fr; direction:rtl; }
  @media(max-width:640px) {
    .mortgage-inline-grid { grid-template-columns:1fr !important; }
    .mortgage-result-col  { border-left:none !important; border-bottom:1px solid rgba(255,255,255,.08) !important; padding:16px 16px 14px !important; }
    .mortgage-controls-col { padding:16px 16px 18px !important; gap:14px !important; }
    .mortgage-monthly-num  { font-size:30px !important; }
    .mortgage-cta-btn      { padding:11px !important; font-size:13px !important; margin-top:12px !important; }
  }
  @media(max-width:480px) {
    .mortgage-monthly-num  { font-size:26px !important; }
    .mortgage-cta-btn      { padding:10px !important; font-size:12px !important; }
  }
  .prop-detail-body { display:grid; grid-template-columns:1fr 320px; align-items:start; direction:rtl; }
  @media(max-width:900px) { .prop-detail-body { grid-template-columns:1fr; } }
  .prop-detail-sidebar { border-right:1px solid rgba(132,144,216,.08); position:sticky; top:52px; max-height:calc(100dvh - 52px); overflow-y:auto; }
  @media(max-width:900px) { .prop-detail-sidebar { order:-1; border-right:none; border-bottom:1px solid rgba(132,144,216,.08); position:static; padding-top:20px !important; padding-bottom:20px !important; } }
  .prop-extra-table { border:1px solid rgba(255,255,255,.1); border-radius:12px; overflow:hidden; direction:rtl; }
  .prop-extra-row { display:flex; justify-content:space-between; align-items:center; padding:15px 22px; font-size:14px; border-bottom:1px solid rgba(255,255,255,.06); direction:rtl; }
  .prop-extra-row:last-child { border-bottom:none; }
  .prop-extra-row:nth-child(odd)  { background:rgba(255,255,255,.04); }
  .prop-extra-row:nth-child(even) { background:rgba(255,255,255,.02); }
  .prop-amenity-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; direction:rtl; }
  .prop-amenity-item { display:flex; align-items:center; gap:10px; padding:12px 16px; border-radius:9px; font-size:14px; font-weight:600; }
  .prop-amenity-on  { background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.18); color:#E8E4D8; }
  .prop-amenity-off { display:none; }

  /* ── Mobile-first enhancements (≤600px) ── */
  @media(max-width:600px) {
    /* Prevent horizontal overflow */
    body { overflow-x:hidden; }

    /* Buttons: stack full-width & reduce padding */
    .primary-btn { padding:14px 20px; font-size:12px; width:100%; text-align:center; }
    .outline-btn  { padding:12px 18px; font-size:11px; width:100%; text-align:center; }

    /* Hero: tighten spacing */
    .hero-title { font-size:clamp(28px,9vw,44px) !important; letter-spacing:-.01em; margin-bottom:16px; }

    /* Property cards — full width */
    .placeholder-grid { grid-template-columns:1fr !important; }

    /* Fix: 2-col placeholder at 720px was overriding 1-col at 768px on narrow phones */
    .placeholder-grid { grid-template-columns:1fr !important; }

    /* Testimonial improvements on mobile */
    .testi-txt-col { padding:12px 14px 8px !important; gap:5px !important; }
    .testi-img-col { height:clamp(180px,30vh,300px) !important; width:100% !important; aspect-ratio:unset !important; }

    /* Story feature cards — stack */
    .story-grid { gap:24px !important; }

    /* About section grid gap */
    .about-grid { gap:32px !important; }

    /* Footer columns */
    .footer-grid { gap:28px !important; }

    /* Section padding reduction */
    section { padding-left:16px !important; padding-right:16px !important; }

    /* PropertyModal header title truncation */
    .prop-modal-title { max-width:44% !important; font-size:11px !important; }

    /* Amenity grid: 2 cols on phone */
    .prop-amenity-grid { grid-template-columns:repeat(2,1fr) !important; }

    /* property detail table rows */
    .prop-extra-row { padding:12px 14px !important; font-size:13px !important; }

    /* Filter buttons bar: allow scroll */
    .filter-btn { padding:8px 14px; font-size:12px; }

    /* Gallery thumb strip scroll */
    .prop-gallery-thumb-strip { gap:4px; padding:8px 10px; }

    /* Hero CTA group: stack vertically */
    .hero-cta-group { flex-direction:column; align-items:stretch; gap:12px; }
    .hero-calc-btn { justify-content:center; width:100%; font-size:12px !important; padding:12px 16px !important; }

    /* WhatsApp float — stay accessible above mobile navigation */
    .wa-float { bottom:16px; right:16px; width:52px; height:52px; }

    /* Nav panel full width on very small screens */
    .nav-panel { width:min(300px,92vw); }
  }

  /* ── Tablet tweaks (601-900px) ── */
  @media(min-width:601px) and (max-width:900px) {
    .primary-btn { padding:14px 28px; }
    .outline-btn  { padding:13px 24px; }
  }

  /* ── Desktop font accessibility (+10% on small text) ── */
  @media(min-width:601px) {
    /* Nav links */
    .nav-btn { font-size:14px; }
    /* Filter / category tabs */
    .filter-btn { font-size:14px; }
    /* Primary / outline CTA */
    .primary-btn { font-size:14px; }
    .outline-btn  { font-size:13px; }
    /* Nav panel items */
    .nav-panel-item { font-size:17px; }
    /* Service card description text */
    .svc-card p { font-size:15.5px !important; line-height:1.95; }
    /* Glass card / about section p */
    .glass-card p { font-size:16px !important; }
    /* FAQ question text */
    .faq-q-text { font-size:16px !important; }
    /* Property card title */
    .prop-card-title { font-size:19px !important; }
    /* Footer text */
    footer p, footer div, footer button { font-size:15px; }
    /* Story paragraphs */
    .story-grid p { font-size:16px !important; line-height:2; }
  }

  /* ═══════════════════════════════════════════════════
  /* ═══════════════════════════════════════════════════════════════
     MOBILE UX PRO — שיפור מקיף לחוויית מובייל
  ════════════════════════════════════════════════════════════════ */
  html { scroll-behavior: smooth; }
  html, body { overflow-x: hidden; max-width: 100vw; -webkit-tap-highlight-color: transparent; touch-action: manipulation; -webkit-overflow-scrolling: touch; }
  * { max-width: 100%; box-sizing: border-box; }
  input, select, textarea { font-size: 16px !important; -webkit-appearance: none; border-radius: 8px; }
  button, a, [role="button"] { min-height: 44px; min-width: 44px; }
  @media(max-width:768px) {
    nav { padding: 0 14px !important; height: 62px !important; }
    .hamburger-btn { width: 48px !important; height: 62px !important; }
    nav .social-btn.email { display: none !important; }
    nav .social-btn.facebook, nav .social-btn.instagram { display: inline-flex !important; width: 36px !important; height: 36px !important; min-width: 36px !important; min-height: 36px !important; font-size: 14px !important; }
    nav > div > div[style*="width:1"] { display: none !important; }
    .nav-lang-text { display: none !important; }
    .nav-lang-btn { padding: 5px 8px !important; font-size: 10px !important; gap: 4px !important; }
    #home { padding: 72px 18px 52px !important; min-height: 100svh !important; }
    .hero-title { font-size: clamp(28px, 8.5vw, 44px) !important; line-height: 1.15 !important; margin-bottom: 14px !important; }
    .hero-cta-group { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; width: 100% !important; }
    .primary-btn { width: 100% !important; text-align: center !important; padding: 16px 20px !important; font-size: 13px !important; border-radius: 10px !important; }
    .outline-btn { width: 100% !important; text-align: center !important; padding: 14px 18px !important; border-radius: 10px !important; }
    .hero-calc-btn { width: 100% !important; justify-content: center !important; padding: 14px 18px !important; border-radius: 10px !important; }
    div[style*="minmax(160px"] { grid-template-columns: repeat(2, 1fr) !important; }
    div[style*="minmax(160px"] > div { padding: 22px 12px !important; }
    .about-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
    .about-grid .glass-card { padding: 22px 18px !important; }
    .story-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
    .ceo-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
    .ceo-photo-col { position: static !important; max-width: 240px !important; margin: 0 auto !important; }
    #properties { padding: 36px 14px !important; }
    #properties [style*="auto-fill"][style*="320px"] { grid-template-columns: 1fr !important; }
    .placeholder-grid { grid-template-columns: 1fr !important; }
    #properties button[style*="padding:14px 28px"] { padding: 11px 14px !important; font-size: 12px !important; }
    .footer-grid { grid-template-columns: 1fr !important; gap: 0 !important; }
    .testi-txt-col p[style*="fontSize:17"] { font-size: 12px !important; line-height: 1.45 !important; }
    .testi-txt-col div[style*="fontSize:20"] { font-size: 14px !important; font-weight: 700 !important; }
    .testi-txt-col div[style*="fontSize:13"] { font-size: 11px !important; margin-top: 1px !important; }
    .testi-txt-col div[style*="fontSize:12"] { font-size: 10px !important; }
    .testi-txt-col span[style*="fontSize:22"] { font-size: 13px !important; }
    .testi-txt-col div[style*="gap:4"] { gap: 2px !important; }
    .testi-txt-col div[style*="gap:22"] { gap: 5px !important; }
    .testi-txt-col div[style*="gap:16"] { gap: 5px !important; }
    .testi-txt-col div[style*="gap:12"] { gap: 6px !important; margin-top: 0 !important; }
    #testimonials { padding: 24px 14px !important; }
    #testimonials [style*="marginBottom:48"] { margin-bottom: 16px !important; }
    #testimonials h2 { font-size: 20px !important; margin-bottom: 4px !important; }
    #testimonials p[style*="maxWidth:480"] { display: none !important; }
    .footer-col { padding: 20px 0 !important; border-bottom: 1px solid rgba(132,144,216,.12) !important; }
    .footer-col:last-child { border-bottom: none !important; padding-bottom: 8px !important; }
    footer [style*="maxWidth:1100"] { padding: 28px 18px 16px !important; }
    footer a[href^="tel"] { font-size: 22px !important; }
    footer button[style*="fit-content"] { width: 100% !important; }
    footer h3[style*="fontSize:30"] { font-size: 20px !important; margin-bottom: 14px !important; }
    .footer-nav-links { display: grid !important; grid-template-columns: repeat(2,1fr) !important; gap: 10px 8px !important; }
    .footer-nav-links button { font-size: 14px !important; padding: 6px 0 !important; }
    .footer-hours { display: flex !important; gap: 16px !important; flex-wrap: wrap !important; }
    .footer-social { margin-bottom: 14px !important; }
    .footer-bottom { flex-direction: column !important; align-items: center !important; gap: 10px !important; text-align: center !important; }
    .footer-bottom-links { justify-content: center !important; flex-wrap: wrap !important; }
    .footer-col { text-align: center !important; }
    .footer-logo-wrap { display: flex !important; justify-content: center !important; }
    .footer-col .footer-social { justify-content: center !important; }
    .footer-col .footer-hours { justify-content: center !important; }
    footer a[href^="tel"] { justify-content: center !important; }
    footer a[href^="https://wa.me"] { justify-content: center !important; }
    footer a[href^="mailto"] { justify-content: center !important; }
    footer button[style*="fit-content"] { width: 100% !important; justify-content: center !important; }
    footer .footer-nav-links button { text-align: center !important; }
    .story-btns a[href^="tel"] { justify-content: center !important; width: 100% !important; }
    #process a[href^="tel"] { justify-content: center !important; }
    .prop-detail-body { grid-template-columns: 1fr !important; }
    .prop-detail-sidebar { position: static !important; max-height: none !important; border-right: none !important; border-bottom: 1px solid rgba(132,144,216,.1) !important; }
    .prop-gallery-main { height: clamp(210px, 52vw, 320px) !important; }
    .prop-amenity-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .svc-bento { grid-template-columns: 1fr !important; }
    .svc-bento > * { grid-column: span 1 !important; }
    .testi-card-wrap { flex-direction: column !important; min-height: 0 !important; }
    .testi-txt-col { order: 1 !important; padding: 12px 14px 8px !important; gap: 5px !important; justify-content: flex-start !important; }
    .testi-img-col { order: 2 !important; width: 100% !important; height: clamp(180px,30vh,300px) !important; background: #06040f !important; border-top: 1px solid rgba(132,144,216,.15) !important; }
    .testi-img-col img { object-fit: contain !important; object-position: center center !important; }
    .testi-txt-col > div[style*="fontSize:72"] { font-size: 26px !important; line-height: 1 !important; margin-bottom: 0 !important; }
    .testi-dots { display: none !important; }
    .nav-panel { width: min(300px, 90vw) !important; }
    .nav-panel-item { padding: 13px 14px !important; font-size: 15px !important; }
    section { padding-left: 16px !important; padding-right: 16px !important; }
    #process .glass-card[style*="padding:36px 40px"] { padding: 20px 18px !important; gap: 16px !important; flex-direction: column !important; }
    #story .story-reveal .glass-card[style*="padding:36px 40px"] { padding: 20px 16px !important; }
  }
  @media(max-width:480px) {
    .hero-title { font-size: clamp(26px, 8vw, 36px) !important; }
    .glass-card[style*="padding:36px 40px"] { padding: 18px 16px !important; }
    .glass-card [style*="auto-fit"][style*="minmax(200px"] { grid-template-columns: repeat(2, 1fr) !important; gap: 18px !important; }
    footer [style*="justifyContent:space-between"][style*="flexWrap"] { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
  }
  @media(max-width:600px) {
    .wa-float { bottom: 18px !important; right: 14px !important; width: 52px !important; height: 52px !important; }
    button[aria-label*="מצב"], button[aria-label*="עבור"] { bottom: 80px !important; left: 14px !important; }
  }
  @media(min-width:601px) and (max-width:900px) {
    .primary-btn { padding: 15px 30px !important; }
    .outline-btn { padding: 14px 26px !important; }
    #properties [style*="auto-fill"][style*="320px"] { grid-template-columns: repeat(2, 1fr) !important; }
    .about-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
    .story-grid { grid-template-columns: 1fr !important; }
    .ceo-grid { grid-template-columns: 1fr !important; }
    .footer-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }
  .nav-panel-links, .prop-gallery-thumb-strip { -webkit-overflow-scrolling: touch !important; scrollbar-width: none !important; }
  .nav-panel-links::-webkit-scrollbar, .prop-gallery-thumb-strip::-webkit-scrollbar { display: none !important; }
  @media(hover:none) {
    .glass-card:hover, .primary-btn:hover, .outline-btn:hover, .svc-card:hover, .social-btn:hover, .wa-float:hover { transform: none !important; }
  }
  @supports(padding: max(0px)) {
    nav { padding-right: max(14px, env(safe-area-inset-right)) !important; padding-left: max(14px, env(safe-area-inset-left)) !important; }
    footer { padding-bottom: max(24px, env(safe-area-inset-bottom)) !important; }
    .wa-float { right: max(14px, env(safe-area-inset-right)) !important; bottom: max(18px, env(safe-area-inset-bottom)) !important; }
  }

  @media(min-width:769px) {
    .testi-card-wrap { min-height: 500px; }
    .testi-card-outer { background: transparent !important; border-color: transparent !important; box-shadow: none !important; backdrop-filter: none !important; }
    .testi-dots { display: none !important; }
  }

  /* ─── Admin Panel — Mobile ─────────────────────────────────── */
  .admin-sidebar { transition: transform .25s cubic-bezier(.4,0,.2,1); }
  .admin-mobile-topbar { display: none; }
  .admin-mobile-overlay { display: none; }
  @media (max-width: 900px) {
    .admin-sidebar {
      position: fixed !important;
      top: 0; right: 0; bottom: 0;
      z-index: 1050 !important;
      transform: translateX(110%);
      width: min(280px, 88vw) !important;
      box-shadow: -12px 0 60px rgba(0,0,0,.85) !important;
    }
    .admin-sidebar.open { transform: translateX(0) !important; }
    .admin-mobile-overlay { display: block !important; position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 1049; backdrop-filter: blur(3px); }
    .admin-mobile-topbar {
      display: flex !important;
      height: 56px; padding: 0 16px;
      border-bottom: 1px solid rgba(132,144,216,.08);
      align-items: center; justify-content: space-between;
      background: rgba(7,7,15,.95); flex-shrink: 0;
      direction: rtl; position: sticky; top: 0; z-index: 20;
    }
    .admin-desktop-topbar { display: none !important; }
    .admin-main-pane { height: 100dvh !important; }
    .admin-content { padding: 16px 14px 28px !important; }
    .admin-tabs-bar { padding: 0 12px !important; overflow-x: auto !important; flex-wrap: nowrap !important; gap: 2px !important; }
    .admin-form-grid { grid-template-columns: 1fr !important; }
    .admin-prop-list-actions { flex-wrap: wrap !important; gap: 6px !important; }
    .admin-overview-grid { grid-template-columns: repeat(2,1fr) !important; }
    .admin-overview-bottom { grid-template-columns: 1fr !important; }
  }
  @media (max-width: 480px) {
    .admin-overview-grid { grid-template-columns: 1fr !important; }
    .admin-mobile-topbar { height: 52px; padding: 0 12px; }
  }

  /* ── Admin bottom nav (standalone mobile) ── */
  .admin-bottom-nav {
    display: none;
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 100;
    background: rgba(7,7,15,.97); border-top: 1px solid rgba(132,144,216,.15);
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    height: 58px; padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  @media (max-width: 640px) {
    .admin-bottom-nav { display: flex; }
    .admin-content { padding-bottom: 72px !important; }
    .admin-tabs-bar { display: none !important; }
  }

  /* ── Scrollbar on right for admin panel (ltr outer = scrollbar right, content restored via > *) ── */
  .admin-content { direction: ltr !important; }
  .admin-content > * { direction: rtl; }
  .admin-panel-modal { direction: ltr !important; }
  .admin-panel-modal > * { direction: rtl; }

  /* ── Leads + analytics KPI grids responsive ── */
  .admin-leads-kpi, .admin-analytics-kpi { grid-template-columns: repeat(4,1fr); }
  .admin-leads-layout { flex-direction: row; }
  .admin-leads-detail { width: 260px; flex-shrink: 0; position: sticky; top: 80px; }
  @media (max-width: 900px) {
    .admin-leads-kpi, .admin-analytics-kpi { grid-template-columns: repeat(2,1fr) !important; }
    .admin-leads-layout { flex-direction: column !important; }
    .admin-leads-detail { width: 100% !important; position: static !important; }
  }
  @media (max-width: 480px) {
    .admin-leads-kpi, .admin-analytics-kpi { grid-template-columns: repeat(2,1fr) !important; }
  }
  /* ── Category filter row ── */
  .admin-cat-filter { display: flex; gap: 6px; overflow-x: auto; flex-wrap: nowrap; }
  .admin-cat-filter::-webkit-scrollbar { display: none; }
  /* ── Property list thumbnail ── */
  @media (max-width: 640px) {
    .admin-prop-thumb { width: 90px !important; height: 80px !important; }
  }

  /* ── UI/UX Pro Max: prefers-reduced-motion ── */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.1ms !important;
    }
  }
`

// ─── NAV ──────────────────────────────────────────────────────────────────────
const NAV_LINKS = [
  { id:'home',       label:'ראשי' },
  { id:'ceo',        label:'המנכ״ל' },
  { id:'story',      label:'הסיפור' },
  { id:'process',    label:'תהליך' },
  { id:'services',      label:'שירותים' },
  { id:'testimonials',  label:'לקוחות' },
  { id:'properties',    label:'נכסים' },
  { id:'news',          label:'מה חדש' },
  { id:'faq',        label:'שאלות נפוצות' },
  { id:'about',      label:'אודות' },
  { id:'contact',    label:'צרו קשר' },
]

// ─── TEAM DATA ────────────────────────────────────────────────────────────────
const TEAM = [
  { name:'ישראל בן יהודה', en_name:'Israel Ben-Yehuda', role:'מייסד ומנכ״ל', en_role:'Founder & CEO', photo:'/ceo.jpg' },
  { name:'יוסי כהן', en_name:'Yossi Cohen', role:'מנהל עסקאות בכיר', en_role:'Senior Deals Manager', photo:'' },
  { name:'רחל אברהם', en_name:'Rachel Avraham', role:'יועצת נדל״ן', en_role:'Real Estate Advisor', photo:'' },
  { name:'דוד לוי', en_name:'David Levy', role:'מנהל שיווק', en_role:'Marketing Manager', photo:'' },
]

// ─── DATA ─────────────────────────────────────────────────────────────────────
const P = '#8490D8'  // purple accent — static for data arrays
const G = '#82F67F'  // green accent  — static for data arrays

const PROCESS_STEPS = [
  { num:'01', Icon:FaSearch,       color:P, title:'איתור הקרקע המתאימה',    desc:'מיפוי שיטתי של שוק הקרקעות. אנחנו מגיעים לקרקעות לפני שהן עולות לשוק הפתוח, דרך רשת קשרים שבנינו לאורך 30 שנה.',
    en_title:'Finding the Right Land',        en_desc:"Systematic mapping of the land market. We reach plots before they hit the open market, through a network of connections we've built over 30 years." },
  { num:'02', Icon:FaBalanceScale, color:G, title:'בדיקת זכויות ותב"ע',     desc:'בדיקה מעמיקה של זכויות בנייה, ייעוד הקרקע ואפשרויות שינוי ייעוד. תדעו בדיוק מה מותר לבנות ובכמה.',
    en_title:'Rights & Zoning Check',         en_desc:'In-depth review of building rights, land designation, and rezoning options. You will know exactly what can be built and how much.' },
  { num:'03', Icon:FaMoneyBill,    color:P, title:'ייעוץ מיסוי והערכת שווי', desc:'חישוב מדויק של מס שבח, מס רכישה והיטל השבחה. הערכת שווי עצמאית לפני כל עסקה, כדי שלא תהיו מופתעים.',
    en_title:'Tax Advisory & Valuation',      en_desc:'Precise calculation of capital gains tax, purchase tax, and betterment levy. Independent valuation before every deal. No surprises.' },
  { num:'04', Icon:FaHandshake,    color:G, title:'ניהול משא ומתן',           desc:'ניהול מקצועי מול הצד השני. שולטים בפרטים, מבינים את המניעים ושומרים על האינטרסים שלכם לאורך כל הדרך.',
    en_title:'Negotiation Management',        en_desc:'Professional management against the other party. We control the details, understand the motivations, and protect your interests throughout.' },
  { num:'05', Icon:FaFileAlt,      color:P, title:'ליווי חוזי ומשפטי',        desc:'עבודה צמודה עם עורכי דין מקרקעין מובילים. בדיקת כל סעיף, הגנה על הרוכש, מניעת מוקשים שיכולים לעכב שנים.',
    en_title:'Legal & Contractual Support',   en_desc:'Close collaboration with leading real estate lawyers. Every clause reviewed, buyer protected, pitfalls that could delay years are prevented.' },
  { num:'06', Icon:FaTrophy,       color:G, title:'סגירת עסקה ורישום בטאבו', desc:'אנחנו לא נעלמים אחרי החתימה. ליווי עד לרישום מלא בטאבו, כי רק אז העסקה באמת הושלמה.',
    en_title:'Deal Closure & Tabu Registration', en_desc:"We don't disappear after signing. We walk you through every step until Tabu registration is complete, because that's when the deal is truly done." },
]

const SERVICES = [
  { Icon:FaTrophy,    color:P, title:'ניסיון ומוניטין',        desc:'אפיק הנחל הוקמה על ידי ישראל בן־יהודה, מומחה נדל״ן בעל ניסיון, מקצועיות ומוניטין של עשרות שנים בתחום הנדל״ן בישראל ובתחום הקרקעות בפרט. החברה פועלת מתוך היכרות עמוקה עם השוק ויכולת לזהות הזדמנויות בעלות פוטנציאל אמיתי.',
    en_title:'Experience & Reputation',      en_desc:'Afik Hanahal was founded by Israel Ben-Yehuda, a real estate expert with decades of experience, professionalism, and reputation in Israeli real estate and land in particular. The company operates from deep market knowledge and the ability to identify opportunities with real potential.' },
  { Icon:FaChartLine, color:G, title:'השקעות עם פוטנציאל',     desc:'אנו מתמחים באיתור קרקעות פרטיות בעלות פוטנציאל השבחה והתפתחות עתידית, במטרה לאפשר ללקוחות להיכנס להשקעות נדל״ן בשלבים מוקדמים ובמחירים נגישים.',
    en_title:'High-Potential Investments',   en_desc:'We specialize in identifying private plots with appreciation and future development potential, enabling clients to enter real estate investments early and at accessible prices.' },
  { Icon:FaEye,       color:P, title:'שקיפות מלאה',             desc:'כל עסקה נבדקת בקפדנות ומוצגת בצורה ברורה ומסודרת. אנו מאמינים בליווי אישי, אמינות ושקיפות מלאה לאורך כל הדרך.',
    en_title:'Full Transparency',            en_desc:'Every deal is carefully reviewed and presented clearly and orderly. We believe in personal guidance, reliability, and full transparency throughout the entire process.' },
  { Icon:FaHardHat,   color:G, title:'קרקעות בפיתוח',          desc:'החברה מאתרת קרקעות באזורי ביקוש ובשלבי תכנון מתקדמים, מתוך הבנה כי התקדמות תכנונית עשויה להשפיע משמעותית על ערך הקרקע בעתיד.',
    en_title:'Land Under Development',       en_desc:'We locate plots in high-demand areas at advanced planning stages, understanding that planning progress can significantly impact future land value.' },
  { Icon:FaKey,       color:P, title:'כניסה נגישה',             desc:'אנחנו מאמינים שהשקעה בנדל״ן צריכה להיות נגישה יותר, ולכן פועלים לאיתור עסקאות עם מחירי כניסה נוחים ופוטנציאל צמיחה לטווח ארוך.',
    en_title:'Accessible Entry',             en_desc:'We believe real estate investment should be more accessible, so we seek deals with favorable entry prices and long-term growth potential.' },
  { Icon:FaSearch,    color:G, title:'מזהים הזדמנויות',         desc:'באמצעות ניסיון, בדיקות מקצועיות וחשיבה קדימה, אנו מזהים אזורים ופרויקטים בעלי פוטנציאל עוד לפני שהם מגיעים למרכז השוק – ומאפשרים ללקוחותינו ליהנות מהזדמנויות איכותיות להשקעה.',
    en_title:'Spotting Opportunities',       en_desc:'Through experience, professional analysis, and forward thinking, we identify areas and projects with potential before they reach the mainstream market, and pass those opportunities on to our clients.' },
]

const DEFAULT_STATS = [
  { key:'deals',   value:150,  label:'עסקאות הושלמו', en_label:'Deals Completed', suffix:'+' },
  { key:'years',   value:30,   label:'שנות ניסיון',   en_label:'Years Experience', suffix:''  },
  { key:'clients', value:300,  label:'לקוחות מרוצים', en_label:'Happy Clients',    suffix:'+' },
  { key:'dunams',  value:5000, label:'דונם שווק',      en_label:'Dunams Marketed',  suffix:'+' },
]

const DEFAULT_SHARON = [
  { city:'הרצליה',    en_city:'Herzliya',     count:12, type:'נכסים בלעדיים', en_type:'Exclusive Properties' },
  { city:'כפר סבא',   en_city:'Kfar Saba',    count:8,  type:'מגרשים פרטיים', en_type:'Private Plots' },
  { city:'רעננה',     en_city:"Ra'anana",     count:6,  type:'קרקעות יזמיות', en_type:'Entrepreneurial Land' },
  { city:'הוד השרון', en_city:'Hod HaSharon', count:9,  type:'נכסים בלעדיים', en_type:'Exclusive Properties' },
]

const SHARON_ICON_MAP = {
  'הרצליה':    FaBuilding,
  'כפר סבא':   FaHome,
  'רעננה':     FaLeaf,
  'הוד השרון': FaStar,
}

const CITY_IMAGES = {
  'הרצליה':    '/herzliya.png',
  'כפר סבא':   '/kfar-saba.png',
  'רעננה':     '/raanana.png',
  'הוד השרון': '/hod-hasharon.png',
}
const CITY_IMG_FILTER = {
  'כפר סבא': 'brightness(1.55) saturate(1.2) contrast(1.08)',
}

// ─── HOOKS ────────────────────────────────────────────────────────────────────
// Returns touch handlers that call onClose when user swipes > threshold px in either direction
function useSwipeClose(onClose, threshold = 80) {
  const ref = useRef({ x0: 0, y0: 0, dragging: false })
  const onTouchStart = useCallback(e => {
    // Don't start swipe tracking if touch is on any interactive element or its child
    if (e.target.closest('input, select, textarea, button, a, label, [role="slider"], [type="range"], video')) return
    ref.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, dragging: true }
  }, [])
  const onTouchEnd = useCallback(e => {
    if (!ref.current.dragging) return
    ref.current.dragging = false
    const dx = e.changedTouches[0].clientX - ref.current.x0
    const dy = e.changedTouches[0].clientY - (ref.current.y0 || 0)
    // Only close on primarily horizontal swipes
    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) onClose()
  }, [onClose, threshold])
  return { onTouchStart, onTouchEnd }
}

function useIntersection(threshold = 0.2) {
  const ref = useRef(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, vis]
}

const TYPEWRITER_HE = ['מגרשים וקרקעות בלעדיים','ייזום ושיווק פרויקטים','ליווי מקצועי מלא','השרון והמרכז ומעבר']
const TYPEWRITER_EN = ['Exclusive Plots & Land','Project Development & Marketing','Full Professional Guidance','Sharon Region & Beyond']

function useTypewriter(texts, speed = 50) {
  const [idx, setIdx] = useState(0)
  const [ch, setCh]   = useState(0)
  const [del, setDel] = useState(false)
  const [out, setOut] = useState('')
  const textsRef = useRef(texts)
  useEffect(() => {
    textsRef.current = texts
    setIdx(0); setCh(0); setDel(false); setOut('')
  }, [texts])
  useEffect(() => {
    const cur = textsRef.current[idx % textsRef.current.length]
    let t
    if (!del && ch < cur.length)      t = setTimeout(() => setCh(c => c+1), speed)
    else if (!del && ch===cur.length)  t = setTimeout(() => setDel(true), 1500)
    else if (del && ch > 0)           t = setTimeout(() => setCh(c => c-1), speed/2)
    else { setDel(false); setIdx(i => (i+1)%textsRef.current.length) }
    setOut(cur.slice(0,ch))
    return () => clearTimeout(t)
  }, [ch, del, idx, speed])
  return out
}

// ─── TEXT COUNTER (power3.out) ────────────────────────────────────────────────
function TextCounter({ to, suffix='', size=42, duration=2400, start=false, lang='he' }) {
  const [val, setVal] = useState(0)
  const rafRef = useRef(null)
  useEffect(() => {
    if (!start) return
    setVal(0)
    let t0 = null
    const tick = ts => {
      if (!t0) t0 = ts
      const p = Math.min((ts - t0) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * to))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [start, to, duration])
  const locale = lang === 'en' ? 'en-US' : 'he-IL'
  const prefixSign = lang === 'en' && suffix === '+'
  return (
    <div className="tc-wrap" style={{ justifyContent:'center' }}>
      {prefixSign && <span className="tc-sfx" style={{ fontSize:size*0.65 }}>{suffix}</span>}
      <span className="tc-num" style={{ fontSize:size }}>{val.toLocaleString(locale)}</span>
      {suffix && !prefixSign && <span className="tc-sfx" style={{ fontSize:size*0.65 }}>{suffix}</span>}
    </div>
  )
}

// ─── UI/UX PRO MAX: KINETIC HEADING ──────────────────────────────────────────
function KineticHeading({ lines, vis, delay=0, style, tag='h2' }) {
  const Tag = tag
  let letterIndex = 0
  return (
    <Tag style={style}>
      {lines.map((line, li) => (
        <span key={li} style={{ display:'block' }}>
          {li > 0 && <br style={{ display:'none' }}/>}
          {line.split('').map((ch) => {
            const idx = letterIndex++
            return (
              <span key={idx} style={{
                display: ch === ' ' ? 'inline' : 'inline-block',
                opacity: vis ? 1 : 0,
                transform: vis ? 'none' : 'translateY(18px) rotateZ(2.5deg)',
                transition: `opacity .55s ${(delay + idx * 0.028).toFixed(3)}s, transform .55s cubic-bezier(.34,1.56,.64,1) ${(delay + idx * 0.028).toFixed(3)}s`,
              }}>
                {ch === ' ' ? ' ' : ch}
              </span>
            )
          })}
        </span>
      ))}
    </Tag>
  )
}

// ─── UI/UX PRO MAX: AMBIENT BACKDROP ─────────────────────────────────────────
function AmbientBackdrop() {
  const { C } = useTheme()
  return (
    <div style={{
      position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
      background:`
        radial-gradient(ellipse 55% 38% at 82% 14%, ${C.purple}1A, transparent),
        radial-gradient(ellipse 48% 58% at 14% 88%, ${C.green}10, transparent),
        radial-gradient(ellipse 38% 42% at 48% 52%, ${C.purple}09, transparent)
      `,
      animation:'ambientPulse 8s ease infinite',
    }}/>
  )
}

// ─── LOGO ─────────────────────────────────────────────────────────────────────
function Logo({ size=52 }) {
  const { isDark } = useTheme()
  return (
    <img src="/logo.svg" alt="אפיק הנחל - ייזום שיווק ותיווך"
      style={{ height:size, width:'auto', objectFit:'contain', display:'block',
               filter: isDark ? 'none' : 'invert(1)' }}/>
  )
}

// ─── BACK TO TOP ──────────────────────────────────────────────────────────────
function BackToTop() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <button
      className={`back-to-top${visible ? ' visible' : ''}`}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="חזור למעלה"
      aria-label="חזור למעלה">
      ↑
    </button>
  )
}

// ─── WHATSAPP ICON ────────────────────────────────────────────────────────────
function WaIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  )
}

// ─── UI/UX PRO MAX: SPATIAL GLASS CARD (3D tilt + elevation) ─────────────────
function GlassCard({ children, style, onClick }) {
  const ref = useRef(null)
  const [tilt, setTilt] = useState({ x:0, y:0 })
  const onMove = useCallback(e => {
    const r = ref.current.getBoundingClientRect()
    setTilt({ x:((e.clientY-r.top)/r.height-.5)*12, y:((e.clientX-r.left)/r.width-.5)*-12 })
  }, [])
  const onLeave = useCallback(() => setTilt({ x:0, y:0 }), [])
  return (
    <div ref={ref} className="glass-card" onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick}
      style={{
        transform:`perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        cursor:onClick?'pointer':'default',
        ...style
      }}>
      {children}
    </div>
  )
}

// ─── WAVE CONNECTOR ───────────────────────────────────────────────────────────
function WaveConnector({ idx }) {
  const { C } = useTheme()
  const col  = idx%2===0 ? C.purple : C.green
  const col2 = idx%2===0 ? C.green  : C.purple
  const p1 = "M 60 0 C 20 28 100 58 60 88"
  const p2 = "M 60 0 C 100 28 20 58 60 88"
  return (
    <div style={{ display:'flex', justifyContent:'center', margin:'-6px 0', position:'relative', zIndex:2 }}>
      <svg width="120" height="96" viewBox="0 0 120 96">
        <defs>
          <linearGradient id={`wg${idx}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col}/><stop offset="100%" stopColor={col2}/>
          </linearGradient>
          <filter id={`gf${idx}`}>
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path stroke={`url(#wg${idx})`} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".9">
          <animate attributeName="d" dur="3s" repeatCount="indefinite" values={`${p1};${p2};${p1}`}/>
        </path>
        <path stroke={col} strokeWidth="1.5" fill="none" strokeDasharray="4 7" opacity=".35">
          <animate attributeName="d" dur="4.5s" repeatCount="indefinite" values={`${p2};${p1};${p2}`}/>
        </path>
        <circle r="6" fill={col} filter={`url(#gf${idx})`}>
          <animateMotion dur="2.4s" repeatCount="indefinite" path={p1}/>
        </circle>
        <circle r="3.5" fill={col2} opacity=".75">
          <animateMotion dur="2.4s" begin="1.2s" repeatCount="indefinite" path={p2}/>
        </circle>
        <circle r="2" fill={C.cream} opacity=".45">
          <animateMotion dur="3.6s" begin=".6s" repeatCount="indefinite" path={p1}/>
        </circle>
      </svg>
    </div>
  )
}

// ─── LANGUAGE SWITCH ──────────────────────────────────────────────────────────
function LangSwitch({ compact = false }) {
  const { lang, setLang, C, isDark } = useTheme()
  const isEn   = lang === 'en'
  const flagW  = compact ? 26 : 32
  const flagH  = Math.round(flagW * 0.67)
  const txtSz  = compact ? 10 : 12

  const textColor    = isDark ? '#fff' : C.cream
  const activeBg     = isDark ? 'rgba(255,255,255,0.13)' : `${C.purple}14`
  const activeBorder = isDark ? 'rgba(255,255,255,0.28)' : `${C.purple}55`
  const sepColor     = isDark ? 'rgba(255,255,255,0.18)' : `${C.cream}33`

  const opt = (active) => ({
    display: 'flex', alignItems: 'center', gap: compact ? 5 : 7,
    cursor: 'pointer',
    padding: compact ? '4px 9px' : '6px 12px',
    borderRadius: 8,
    background: active ? activeBg : 'transparent',
    border: `1px solid ${active ? activeBorder : 'transparent'}`,
    opacity: active ? 1 : 0.52,
    transition: 'background 0.25s, border-color 0.25s, opacity 0.25s',
    userSelect: 'none',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 2 : 4, direction: 'ltr' }}>

      {/* Israel / Hebrew */}
      <div style={opt(!isEn)} onClick={() => setLang('he')}>
        <img
          src="https://flagcdn.com/il.svg"
          width={flagW} height={flagH} alt="IL"
          style={{ borderRadius: 3, display: 'block', flexShrink: 0 }}
        />
        <span className="nav-lang-text" style={{ fontSize: txtSz, fontWeight: 700, color: textColor, fontFamily: 'Rubik, sans-serif', letterSpacing: '0.04em' }}>עב</span>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: compact ? 18 : 22, background: sepColor, flexShrink: 0 }} />

      {/* USA / English */}
      <div style={opt(isEn)} onClick={() => setLang('en')}>
        <img
          src="https://flagcdn.com/us.svg"
          width={flagW} height={flagH} alt="US"
          style={{ borderRadius: 3, display: 'block', flexShrink: 0 }}
        />
        <span className="nav-lang-text" style={{ fontSize: txtSz, fontWeight: 700, color: textColor, fontFamily: 'Rubik, sans-serif', letterSpacing: '0.04em' }}>EN</span>
      </div>
    </div>
  )
}

// ─── STORY SECTION ────────────────────────────────────────────────────────────
// ─── CITY CARD (hover-flip) ───────────────────────────────────────────────────
const FLIP_TRANSITION = { duration: 0.7, ease: [0.4, 0.2, 0.2, 1] }
const FACE_STYLE = {
  position: 'absolute', inset: 0,
  backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
  transformStyle: 'preserve-3d',
  borderRadius: 18, overflow: 'hidden',
}

// ─── SECTION BADGE — animated rotating border gradient ───────────────────────
const _BADGE_MAP = {
  TOP:    'radial-gradient(20.7% 50% at 50% 0%,    rgba(255,255,255,0.82) 0%, rgba(255,255,255,0) 100%)',
  LEFT:   'radial-gradient(16.6% 43.1% at 0% 50%,  rgba(255,255,255,0.82) 0%, rgba(255,255,255,0) 100%)',
  BOTTOM: 'radial-gradient(20.7% 50% at 50% 100%,  rgba(255,255,255,0.82) 0%, rgba(255,255,255,0) 100%)',
  RIGHT:  'radial-gradient(16.2% 41.2% at 100% 50%, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0) 100%)',
}
const _BADGE_DIRS = ['TOP', 'LEFT', 'BOTTOM', 'RIGHT']

function SectionBadge({ children, color, style: outer = {}, duration = 1.8 }) {
  const [hovered, setHovered] = useState(false)
  const [dirIdx,  setDirIdx]  = useState(1)

  useEffect(() => {
    if (hovered) return
    const id = setInterval(() => setDirIdx(i => (i + 1) % 4), duration * 1000)
    return () => clearInterval(id)
  }, [hovered, duration])

  const highlight = `radial-gradient(75% 181% at 50% 50%, ${color}CC 0%, rgba(255,255,255,0) 100%)`

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        borderRadius: 9999, padding: 1,
        background: 'rgba(6,6,16,0.5)', backdropFilter: 'blur(10px)',
        marginBottom: 18, cursor: 'default', userSelect: 'none',
        ...outer,
      }}
    >
      {/* Text — top layer */}
      <div style={{
        position: 'relative', zIndex: 10,
        borderRadius: 9999, padding: '6px 18px',
        fontSize: 11, fontWeight: 700, letterSpacing: '4px',
        textTransform: 'uppercase', color, lineHeight: 1.2, whiteSpace: 'nowrap',
      }}>
        {children}
      </div>

      {/* Rotating gradient border */}
      <motion.div
        style={{ position: 'absolute', inset: 0, borderRadius: 9999, zIndex: 0, filter: 'blur(3px)' }}
        animate={{ background: hovered ? highlight : _BADGE_MAP[_BADGE_DIRS[dirIdx]] }}
        transition={{ ease: 'linear', duration: hovered ? 0.2 : duration }}
      />

      {/* Inset fill — creates the visible border gap */}
      <div style={{ position: 'absolute', inset: '1.5px', zIndex: 1, borderRadius: 9999, background: 'rgba(6,6,16,0.9)' }}/>
    </div>
  )
}

function FlipCityCard({ h, index }) {
  const { C, lang } = useTheme()
  const cityType    = lang === 'en' && h.en_type ? h.en_type : h.type
  const cityName    = lang === 'en' && h.en_city ? h.en_city : h.city
  const [vis,          setVis]          = useState(false)
  const [isFlipped,    setIsFlipped]    = useState(false)
  const [counterStart, setCounterStart] = useState(false)
  const cardRef = useRef(null)
  const img     = CITY_IMAGES[h.city]
  const CityIcon = SHARON_ICON_MAP[h.city] || FaMapMarkerAlt

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setTimeout(() => setVis(true), index * 110 + 180); obs.disconnect() }
    }, { threshold: 0.15 })
    if (cardRef.current) obs.observe(cardRef.current)
    return () => obs.disconnect()
  }, [index])

  const handleEnter = () => { setIsFlipped(true); if (!counterStart) setCounterStart(true) }
  const handleLeave = () => setIsFlipped(false)

  return (
    <div
      ref={cardRef}
      className="city-card-wrap"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        position: 'relative',
        height: 248,
        opacity: vis ? 1 : 0,
        transform: `translateY(${vis ? 0 : 30}px) scale(${vis ? 1 : 0.96})`,
        transition: `opacity 0.65s ease ${index * 0.11}s, transform 0.65s cubic-bezier(.22,1,.36,1) ${index * 0.11}s`,
        cursor: 'pointer',
      }}>

      {/* ── FRONT: photo card ── */}
      <motion.div
        initial={false}
        animate={{ rotateY: isFlipped ? -180 : 0 }}
        transition={FLIP_TRANSITION}
        style={{ ...FACE_STYLE, zIndex: isFlipped ? 1 : 2, boxShadow: '0 16px 48px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.3)' }}>

        {/* Photo — editorial filter */}
        <img src={img} alt={cityName} loading="lazy"
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            filter: CITY_IMG_FILTER[h.city] || 'brightness(1.1) saturate(1.08) contrast(1.08)',
          }}/>

        {/* Cinematic gradient — heavy vignette only at bottom */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, transparent 0%, transparent 28%, rgba(0,0,0,0.28) 52%, rgba(0,0,0,0.72) 75%, rgba(0,0,0,0.92) 100%)',
          pointerEvents: 'none',
        }}/>

        {/* Elegant count badge — top right, glass style */}
        <div style={{
          position: 'absolute', top: 13, right: 13,
          display: 'flex', alignItems: 'baseline', gap: 1,
          background: 'rgba(8,8,18,0.52)', backdropFilter: 'blur(14px)',
          border: `1px solid ${C.green}66`,
          color: C.green,
          padding: '5px 12px', borderRadius: 20,
          lineHeight: 1,
        }}>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.5px' }}>{h.count}</span>
          <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.75, marginLeft: 1, marginBottom: 1 }}>+</span>
        </div>

        {/* Bottom: city name + subtle type line */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 16px' }}>
          <div style={{ width: 20, height: 1.5, background: `linear-gradient(90deg,${C.green},transparent)`, borderRadius: 2, marginBottom: 9 }}/>
          <div style={{ fontSize: 21, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px', textShadow: '0 2px 16px rgba(0,0,0,.75)', lineHeight: 1.2 }}>
            {cityName}
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 400, color: 'rgba(255,255,255,0.48)', letterSpacing: '0.09em', textTransform: 'uppercase', marginTop: 5, lineHeight: 1 }}>
            {cityType}
          </div>
        </div>
      </motion.div>

      {/* ── BACK: animated stats ── */}
      <motion.div
        initial={false}
        animate={{ rotateY: isFlipped ? 0 : 180 }}
        transition={FLIP_TRANSITION}
        style={{
          ...FACE_STYLE, zIndex: isFlipped ? 2 : 1,
          background: `linear-gradient(145deg, ${C.card} 0%, rgba(8,8,20,0.97) 100%)`,
          border: `1px solid ${C.purple}33`,
          boxShadow: `0 8px 36px rgba(0,0,0,.55), 0 0 0 1px ${C.purple}22`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 10, textAlign: 'center', padding: '20px 16px',
        }}>

        {/* Ambient glow */}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 40%, ${C.purple}18, transparent 70%)`, pointerEvents: 'none' }}/>

        <div style={{ color: C.green, opacity: 0.85, position: 'relative' }}><CityIcon size={26}/></div>
        <div style={{ fontSize: 11, color: C.cream + '70', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', position: 'relative' }}>{cityName}</div>
        <div style={{ position: 'relative' }}>
          <TextCounter to={h.count} size={44} start={counterStart} duration={1400} suffix="+"/>
        </div>
        <div style={{ fontSize: 12, color: C.cream + 'AA', position: 'relative', maxWidth: 120, lineHeight: 1.5 }}>{cityType}</div>

        {/* Bottom shine line */}
        <div style={{ position: 'absolute', bottom: 0, left: '15%', right: '15%', height: 1, background: `linear-gradient(90deg,transparent,${C.purple}55,transparent)` }}/>
      </motion.div>

    </div>
  )
}

function StorySection({ onContact, sharonData }) {
  const { C, lang } = useTheme()
  const t = TR[lang] || TR.he
  const [ref, vis] = useIntersection(0.1)
  return (
    <section id="story" style={{ padding:'56px 24px', background:`linear-gradient(180deg,${C.bg} 0%,${C.card} 50%,${C.bg} 100%)`, position:'relative', overflow:'hidden', scrollMarginTop:80, zIndex:1 }}>
      <div style={{ position:'absolute', top:'5%',   left:'5%',  width:500, height:500, background:`radial-gradient(circle,${C.green}09,transparent 70%)`,  pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'5%', right:'5%', width:420, height:420, background:`radial-gradient(circle,${C.purple}0D,transparent 70%)`, pointerEvents:'none' }}/>

      <div ref={ref} style={{ maxWidth:1100, margin:'0 auto' }}>
        {/* Kinetic heading */}
        <div className={`story-reveal${vis?' visible':''}`} style={{ textAlign:'center', marginBottom:44 }}>
          <SectionBadge color={C.green}>{t.storyBadge}</SectionBadge>
          <KineticHeading
            lines={[t.storyH1line1]}
            vis={vis} delay={0.1}
            style={{ fontSize:'clamp(30px,4.5vw,56px)', fontWeight:900, color:C.cream, marginBottom:12, lineHeight:1.2 }}
          />
          <div style={{ marginBottom:20 }}>
            <KineticHeading
              lines={[t.storyH1line2]}
              vis={vis} delay={0.5}
              style={{
                fontSize:'clamp(30px,4.5vw,56px)', fontWeight:900,
                color:C.green,
                display:'inline-block', lineHeight:1.2,
              }}
            />
          </div>
          <p style={{ fontSize:18, color:C.cream+'BB', maxWidth:620, margin:'0 auto', lineHeight:1.9, opacity:vis?1:0, transition:'opacity .6s .8s' }}>
            {t.storyDesc}
          </p>
        </div>

        <div className="story-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'center', marginBottom:48 }}>
          <div className={`story-reveal${vis?' visible':''}`} style={{ transitionDelay:'.15s' }}>
            {(t.storyParas || []).map((para, i) => (
              <p key={i} style={{ fontSize:16, color:C.cream+'CC', lineHeight:2.1, marginBottom: i < (t.storyParas.length - 1) ? 22 : 30 }}>{para}</p>
            ))}
            <blockquote style={{ borderRight:`3px solid ${C.green}`, paddingRight:20, color:C.green, fontSize:17, fontWeight:700, lineHeight:1.8, fontStyle:'normal', marginBottom:36 }}>
              "{t.storyBlockquote}"
            </blockquote>
            <div className="story-btns" style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
              <button onClick={() => onContact()} className="primary-btn">{t.storyContactBtn}</button>
              <a href="tel:0559811814" style={{ padding:'16px 28px', background:`${C.purple}22`, border:`1px solid ${C.purple}55`, borderRadius:14, color:C.cream, textDecoration:'none', fontSize:15, fontWeight:700, display:'flex', alignItems:'center', gap:8, cursor:'pointer', transition:'all .22s' }}
                onMouseEnter={e => { e.currentTarget.style.background=`${C.purple}44`; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 8px 24px ${C.purple}33` }}
                onMouseLeave={e => { e.currentTarget.style.background=`${C.purple}22`; e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                <FaPhone size={14}/> 055-981-1814
              </a>
            </div>
          </div>

          <div className={`story-reveal${vis?' visible':''}`} style={{ transitionDelay:'.3s' }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.purple, letterSpacing:'3px', textTransform:'uppercase', marginBottom:20, textAlign:'center' }}>{t.sharonExclusive}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {sharonData.map((h,i) => (
                <FlipCityCard key={i} h={h} index={i}/>
              ))}
            </div>
            <GlassCard style={{ padding:'22px 28px', marginTop:16, display:'flex', gap:16, alignItems:'center' }}>
              <div style={{ color:C.purple, opacity:.85 }}><FaGlobe size={28}/></div>
              <div>
                <div style={{ fontWeight:800, color:C.cream, fontSize:15 }}>{t.nationwideTitle}</div>
                <div style={{ fontSize:13, color:C.cream+'80', marginTop:6, lineHeight:1.7 }}>
                  {t.nationwideDesc}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        <div className={`story-reveal${vis?' visible':''}`} style={{ transitionDelay:'.5s' }}>
          <GlassCard style={{ padding:'36px 40px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:28, textAlign:'center' }}>
              {[
                { Icon:FaSeedling,  color:C.green,  ...(t.storyFeatures?.[0] || { title:'חקלאות ועיר',    desc:'מלווים בעלי שדות חקלאיים ומגרשים עירוניים כאחד' }) },
                { Icon:FaLock,      color:C.purple, ...(t.storyFeatures?.[1] || { title:'בלעדיות אמיתית', desc:'גישה לנכסים ייחודיים שלא זמינים במקומות אחרים. רק אצלנו.' }) },
                { Icon:FaBolt,      color:C.green,  ...(t.storyFeatures?.[2] || { title:'מהירות שוק',      desc:'מגיעים לעסקאות לפני שהן עולות לשוק הפתוח' }) },
                { Icon:FaShieldAlt, color:C.purple, ...(t.storyFeatures?.[3] || { title:'ליווי מלא',       desc:'מהאיתור הראשוני ועד הרישום בטאבו' }) },
              ].map((t,i) => (
                <div key={i}>
                  <div style={{ marginBottom:12, display:'flex', justifyContent:'center' }}><t.Icon size={26} style={{ color:t.color, opacity:.9 }}/></div>
                  <div style={{ fontWeight:800, color:C.cream, fontSize:15, marginBottom:8 }}>{t.title}</div>
                  <div style={{ fontSize:13, color:C.cream+'80', lineHeight:1.7 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}

// ─── PROCESS SECTION ──────────────────────────────────────────────────────────
function ProcessSection() {
  const { C, lang } = useTheme()
  const t = TR[lang] || TR.he
  const [ref, vis] = useIntersection(0.08)
  const stepRefs = useRef([])
  const [stepVis, setStepVis] = useState(Array(PROCESS_STEPS.length).fill(false))
  useEffect(() => {
    const obs = stepRefs.current.map((el,i) => {
      if (!el) return null
      const o = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) setStepVis(p => { const n=[...p]; n[i]=true; return n })
      }, { threshold:0.25 })
      o.observe(el)
      return o
    })
    return () => obs.forEach(o => o?.disconnect())
  }, [])

  return (
    <section id="process" style={{ padding:'72px 24px', position:'relative', overflow:'hidden', scrollMarginTop:80, zIndex:1 }}>
      <div style={{ position:'absolute', inset:0, overflow:'hidden', zIndex:0, pointerEvents:'none' }}>
        <svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ opacity:.06 }}>
          {[0,1,2,3,4].map(i => (
            <path key={i} stroke={i%2===0?C.purple:C.green} strokeWidth={2-i*.15} fill="none">
              <animate attributeName="d" dur={`${5+i*1.5}s`} repeatCount="indefinite"
                values={`M 0 ${80+i*130} Q ${300+i*30} ${40+i*130} ${600+i*10} ${80+i*130} Q ${900-i*20} ${120+i*130} 1200 ${80+i*130};M 0 ${80+i*130} Q ${300+i*30} ${120+i*130} ${600+i*10} ${80+i*130} Q ${900-i*20} ${40+i*130} 1200 ${80+i*130};M 0 ${80+i*130} Q ${300+i*30} ${40+i*130} ${600+i*10} ${80+i*130} Q ${900-i*20} ${120+i*130} 1200 ${80+i*130}`}/>
            </path>
          ))}
        </svg>
      </div>

      <div ref={ref} style={{ maxWidth:720, margin:'0 auto', position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:44, opacity:vis?1:0, transform:vis?'none':'translateY(24px)', transition:'opacity .6s,transform .6s' }}>
          <SectionBadge color={C.purple}>{t.processBadge}</SectionBadge>
          <KineticHeading lines={[t.processH1]} vis={vis} delay={0.1}
            style={{ fontSize:'clamp(28px,4vw,52px)', fontWeight:900, color:C.cream, marginBottom:16, lineHeight:1.2 }}/>
          <p style={{ fontSize:17, color:C.cream+'AA', lineHeight:1.9, opacity:vis?1:0, transition:'opacity .6s .7s' }}>{t.processDesc}</p>
        </div>

        {PROCESS_STEPS.map((step, i) => (
          <div key={i}>
            <div ref={el => stepRefs.current[i] = el}
              style={{ opacity:stepVis[i]?1:0, transform:stepVis[i]?'none':'translateX(22px)', transition:`opacity .6s ${i*.1}s,transform .6s ${i*.1}s` }}>
              <GlassCard style={{ padding:'36px 40px', display:'flex', gap:28, alignItems:'flex-start', position:'relative' }}>
                <div style={{ position:'absolute', top:0, right:0, bottom:0, width:3, background:`linear-gradient(180deg,transparent,${step.color}99,transparent)`, borderRadius:'0 20px 20px 0' }}/>
                <div style={{ flexShrink:0, width:62, height:62, borderRadius:'50%', background:`linear-gradient(135deg,${step.color}33,${step.color}11)`, border:`2px solid ${step.color}66`, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:2, animation:stepVis[i]?'glowPulse 3s ease infinite':undefined, animationDelay:`${i*.5}s` }}>
                  <div style={{ fontSize:10, fontWeight:800, color:step.color, letterSpacing:'1px', lineHeight:1, marginBottom:4 }}>{step.num}</div>
                  <step.Icon size={20} style={{ color:step.color }}/>
                </div>
                <div style={{ flex:1 }}>
                  <h3 style={{ fontSize:19, fontWeight:800, color:C.cream, marginBottom:10, lineHeight:1.3 }}>{lang === 'en' && step.en_title ? step.en_title : step.title}</h3>
                  <p style={{ fontSize:14.5, color:C.cream+'AA', lineHeight:1.85 }}>{lang === 'en' && step.en_desc ? step.en_desc : step.desc}</p>
                </div>
              </GlassCard>
            </div>
            {i < PROCESS_STEPS.length-1 && (
              <div style={{ opacity:stepVis[i]?1:0, transition:`opacity .5s ${i*.1+.3}s` }}>
                <WaveConnector idx={i}/>
              </div>
            )}
          </div>
        ))}

        <div style={{ textAlign:'center', marginTop:52, opacity:vis?1:0, transition:'opacity .6s .9s' }}>
          <GlassCard style={{ padding:'36px 44px', display:'inline-block' }}>
            <div style={{ marginBottom:14, color:C.purple, opacity:.9 }}><FaRocket size={22}/></div>
            <div style={{ fontWeight:900, color:C.cream, fontSize:20, marginBottom:10 }}>{t.processReadyTitle}</div>
            <div style={{ fontSize:14, color:C.cream+'AA', marginBottom:22, lineHeight:1.8 }}>{t.processReadyDesc}</div>
            <a href="tel:0559811814" className="primary-btn" style={{ display:'inline-flex', alignItems:'center', gap:8, textDecoration:'none', padding:'14px 36px', borderRadius:14, fontSize:16 }}><FaPhone size={14}/> 055-981-1814</a>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}

// ─── TEAM SECTION (Gabay circular portrait style) ────────────────────────────
function TeamSection() {
  const { C, isDark, lang } = useTheme()
  const t = TR[lang] || TR.he
  const [ref, vis] = useIntersection(0.1)

  return (
    <section id="team" ref={ref} style={{ padding:'72px 24px 80px', background: isDark ? `linear-gradient(180deg,${C.card} 0%,${C.bg} 100%)` : 'linear-gradient(180deg,#F5F1E8 0%,#EDE7DB 100%)', position:'relative', overflow:'hidden', zIndex:1, scrollMarginTop:80 }}>
      <div style={{ position:'absolute', top:'-10%', left:'50%', transform:'translateX(-50%)', width:800, height:400, background:`radial-gradient(ellipse,${C.purple}0A,transparent 70%)`, pointerEvents:'none' }}/>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:56, opacity:vis?1:0, transform:vis?'none':'translateY(22px)', transition:'all .6s cubic-bezier(.16,1,.3,1)' }}>
          <div style={{ display:'inline-block', fontSize:11, fontWeight:700, letterSpacing:'4px', textTransform:'uppercase', color:C.purple, marginBottom:14, background:`${C.purple}0E`, border:`1px solid ${C.purple}22`, borderRadius:20, padding:'5px 18px' }}>{t.teamDesc}</div>
          <h2 style={{ fontSize:'clamp(26px,4vw,46px)', fontWeight:900, color: isDark ? C.cream : '#1A1410', margin:0, lineHeight:1.2 }}>{t.teamTitle}</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:40 }}>
          {TEAM.map((member, i) => {
            const name = lang==='en' ? member.en_name : member.name
            const role = lang==='en' ? member.en_role : member.role
            return (
              <div key={i} style={{ textAlign:'center', opacity:vis?1:0, transform:vis?'none':'translateY(28px)', transition:`all .6s cubic-bezier(.16,1,.3,1) ${i*0.1+0.15}s` }}>
                <div style={{ position:'relative', display:'inline-block', marginBottom:20 }}>
                  <div style={{ width:176, height:176, borderRadius:'50%', border: isDark ? `2px solid ${C.purple}44` : '2px solid rgba(90,104,197,.35)', overflow:'hidden', margin:'0 auto', background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.85)', boxShadow: isDark ? `0 8px 32px rgba(0,0,0,.45), 0 0 0 6px ${C.purple}0A` : '0 8px 32px rgba(0,0,0,.12)', transition:'box-shadow .3s, border-color .3s' }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = isDark ? `0 16px 48px rgba(0,0,0,.6), 0 0 0 6px ${C.purple}22, 0 0 40px ${C.purple}18` : `0 16px 40px rgba(0,0,0,.2), 0 0 0 6px rgba(90,104,197,.12)`; e.currentTarget.style.borderColor = isDark ? `${C.purple}88` : 'rgba(90,104,197,.6)' }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = isDark ? `0 8px 32px rgba(0,0,0,.45), 0 0 0 6px ${C.purple}0A` : '0 8px 32px rgba(0,0,0,.12)'; e.currentTarget.style.borderColor = isDark ? `${C.purple}44` : 'rgba(90,104,197,.35)' }}>
                    {member.photo ? (
                      <img src={member.photo} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', display:'block' }} loading="lazy"/>
                    ) : (
                      <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, fontWeight:900, color: isDark ? `${C.purple}70` : 'rgba(90,104,197,.55)', letterSpacing:'-2px' }}>
                        {name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                      </div>
                    )}
                  </div>
                  <div style={{ width:40, height:5, borderRadius:3, background: isDark ? C.purple : '#8B6144', margin:'12px auto 0', opacity:.82 }}/>
                </div>
                <div style={{ fontSize:18, fontWeight:800, color: isDark ? C.cream : '#1A1410', marginBottom:5, lineHeight:1.2 }}>{name}</div>
                <div style={{ fontSize:13, color: isDark ? `${C.cream}70` : '#6B5B4E', fontWeight:500 }}>{role}</div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── SIGNATURE REVEAL ─────────────────────────────────────────────────────────
function SignatureReveal({ isDark }) {
  const wrapRef    = useRef(null)
  const imgRef     = useRef(null)
  const rafRef     = useRef(null)
  const startedRef = useRef(false)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || startedRef.current) return
      startedRef.current = true
      obs.disconnect()
      setStarted(true)
    }, { threshold: 0.35 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const img = imgRef.current
    if (!img) return

    const DURATION = 3400
    let startTs = null

    const penEase = t => {
      const base = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      const rhythm = Math.sin(t * Math.PI * 5.4) * 0.016 * Math.sin(t * Math.PI)
      return Math.max(0, Math.min(1, base + rhythm))
    }

    const animate = ts => {
      if (!startTs) startTs = ts
      const raw     = Math.min((ts - startTs) / DURATION, 1)
      const eased   = penEase(raw)
      const leftClip = (1 - eased) * 100
      img.style.clipPath = `inset(0 0 0 ${leftClip.toFixed(2)}%)`
      if (raw < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        img.style.clipPath = 'none'
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [started])

  const filterStr = isDark ? 'brightness(1.15) contrast(1.1)' : 'invert(1) contrast(1.2)'
  const blendMode = isDark ? 'screen' : 'multiply'

  return (
    <div ref={wrapRef} style={{ maxWidth: 240, margin: '0 auto', lineHeight: 0 }}>
      <img
        ref={imgRef}
        src="/signature.png"
        alt="חתימת ישראל בן יהודה"
        style={{
          width: '100%', height: 'auto', display: 'block',
          mixBlendMode: blendMode, filter: filterStr, opacity: 0.92,
          clipPath: 'inset(0 0 0 100%)',
        }}
      />
    </div>
  )
}

// ─── CEO SECTION ──────────────────────────────────────────────────────────────
function CEOSection() {
  const { C, isDark, lang } = useTheme()
  const t = TR[lang] || TR.he
  const [ref, vis] = useIntersection(0.08)
  const [imgErr, setImgErr] = useState(false)
  const paragraphs = t.ceoParagraphs || []

  return (
    <section id="ceo" ref={ref} style={{ padding:'56px 24px', background:`linear-gradient(180deg,${C.bg} 0%,${C.card} 55%,${C.bg} 100%)`, position:'relative', overflow:'hidden', scrollMarginTop:80, zIndex:1 }}>
      {/* ambient blobs */}
      <div style={{ position:'absolute', top:'10%', left:'-6%', width:500, height:500, background:`radial-gradient(circle,${C.purple}0A,transparent 70%)`, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'8%', right:'-5%', width:420, height:420, background:`radial-gradient(circle,${C.green}07,transparent 70%)`, pointerEvents:'none' }}/>

      <div style={{ maxWidth:1080, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* Eyebrow + title */}
        <div style={{ textAlign:'center', marginBottom:36, opacity:vis?1:0, transform:vis?'none':'translateY(22px)', transition:'all .65s cubic-bezier(.16,1,.3,1)' }}>
          <SectionBadge color={C.purple}>{t.ceoBadge}</SectionBadge>
          <h2 style={{ fontSize:'clamp(26px,4vw,44px)', fontWeight:900, color:C.cream, lineHeight:1.2, margin:0 }}>{t.ceoH2}</h2>
        </div>

        {/* Grid */}
        <div className="ceo-grid" style={{ opacity:vis?1:0, transform:vis?'none':'translateY(28px)', transition:'all .8s cubic-bezier(.16,1,.3,1) .12s' }}>

          {/* ── Photo column (RIGHT in RTL) ── */}
          <div className="ceo-photo-col">
            <div style={{ borderRadius:16, overflow:'hidden', border:`1px solid ${C.purple}28`, boxShadow:`0 32px 80px rgba(0,0,0,.55), 0 0 0 1px ${C.purple}14`, transition:'box-shadow .45s cubic-bezier(.16,1,.3,1), border-color .45s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow=`0 44px 110px rgba(0,0,0,.7), 0 0 80px ${C.purple}22, 0 0 0 1px ${C.purple}66`; e.currentTarget.style.borderColor=`${C.purple}66` }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow=`0 32px 80px rgba(0,0,0,.55), 0 0 0 1px ${C.purple}14`; e.currentTarget.style.borderColor=`${C.purple}28` }}>

              {/* Image area — fixed aspect ratio so no layout shift */}
              <div style={{ position:'relative', paddingBottom:'110%', background:`linear-gradient(160deg,#141422,#0E0E1C)`, overflow:'hidden' }}>
                {!imgErr ? (
                  <img
                    src="/ceo.jpg"
                    alt="ישראל בן יהודה"
                    onError={() => setImgErr(true)}
                    style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', display:'block' }}
                  />
                ) : (
                  /* Fallback placeholder until user drops the file */
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
                    <div style={{ width:100, height:100, borderRadius:'50%', background:`${C.purple}1A`, border:`2px solid ${C.purple}30`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ fontSize:36, fontWeight:900, color:`${C.purple}80` }}>יב</span>
                    </div>
                    <p style={{ fontSize:12, color:`${C.cream}30`, margin:0, textAlign:'center', padding:'0 20px' }}>
                      שמור את תמונת המנכ״ל בתור<br/>
                      <code style={{ color:`${C.purple}70`, fontSize:11 }}>public/ceo.jpg</code>
                    </p>
                  </div>
                )}
              </div>

              {/* Name card below photo */}
              <div style={{ background:`linear-gradient(135deg,${C.card},#0A0A16)`, padding:'18px 20px', borderTop:`1px solid ${C.purple}16` }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.cream, marginBottom:4, lineHeight:1.2 }}>{t.ceoName}</div>
                <div style={{ fontSize:12, color:C.purple, fontWeight:600, letterSpacing:'.06em' }}>{t.ceoRole}</div>
              </div>
            </div>
          </div>

          {/* ── Text column (LEFT in RTL) ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Opening quote block */}
            <div style={{ position:'relative', background:`${C.purple}09`, border:`1px solid ${C.purple}20`, borderRadius:14, padding:'30px 28px 28px', transition:'background .3s, border-color .3s, box-shadow .3s' }}
              onMouseEnter={e => { e.currentTarget.style.background=`${C.purple}14`; e.currentTarget.style.borderColor=`${C.purple}44`; e.currentTarget.style.boxShadow=`0 8px 32px ${C.purple}18` }}
              onMouseLeave={e => { e.currentTarget.style.background=`${C.purple}09`; e.currentTarget.style.borderColor=`${C.purple}20`; e.currentTarget.style.boxShadow='' }}>
              <div style={{ position:'absolute', top:0, right:20, fontSize:96, lineHeight:.8, color:`${C.purple}20`, fontFamily:'Georgia,serif', fontWeight:900, pointerEvents:'none', userSelect:'none', transform:'translateY(-12px)' }}>"</div>
              <p style={{ fontSize:'clamp(16px,1.6vw,19px)', fontWeight:700, color:C.cream, lineHeight:1.8, margin:0, position:'relative', zIndex:1 }}>
                {t.ceoOpeningQuotePre}{' '}
                <span style={{ color:C.purple }}>{t.ceoOpeningQuoteHighlight}</span>
                {'  '}{t.ceoOpeningQuotePost}
              </p>
            </div>

            {/* Divider */}
            <div style={{ height:1, background:`linear-gradient(to left,transparent,${C.purple}30,transparent)`, margin:'4px 0' }}/>

            {/* Body */}
            {paragraphs.map((text, i) => (
              <p key={i} style={{ fontSize:15, color:`${C.cream}BB`, lineHeight:1.95, margin:0 }}>{text}</p>
            ))}

            {/* Signature line */}
            <div style={{ paddingTop:20, borderTop:`1px solid ${C.purple}15`, marginTop:4, textAlign:'center' }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.cream, marginBottom:2 }}>{t.ceoName}</div>
              <div style={{ fontSize:11, color:`${C.cream}55`, letterSpacing:'.05em', marginBottom:8 }}>{t.ceoRole}</div>
              <SignatureReveal isDark={isDark} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── SERVICES SECTION (UI/UX Pro Max: Bento Grid + Spatial Cards) ─────────────
function ServicesSection({ onContact }) {
  const { C, lang } = useTheme()
  const t = TR[lang] || TR.he
  const [ref, vis] = useIntersection(0.08)
  const cardRefs = useRef([])
  const [cardVis, setCardVis] = useState(Array(SERVICES.length).fill(false))
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const obs = cardRefs.current.map((el, i) => {
      if (!el) return null
      const o = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) setCardVis(p => { const n=[...p]; n[i]=true; return n })
      }, { threshold:0.15 })
      o.observe(el)
      return o
    })
    return () => obs.forEach(o => o?.disconnect())
  }, [])

  const marqItems = [...SERVICES, ...SERVICES]

  return (
    <section id="services" style={{ padding:'72px 24px', position:'relative', overflow:'hidden', scrollMarginTop:80, background:`linear-gradient(180deg,${C.bg} 0%,#090912 50%,${C.bg} 100%)`, zIndex:1 }}>


      {/* Ambient blobs */}
      <div style={{ position:'absolute', top:'12%', right:'-4%', width:460, height:460, background:`radial-gradient(circle,${C.purple}12,transparent 70%)`, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'12%', left:'-4%', width:400, height:400, background:`radial-gradient(circle,${C.green}0C,transparent 70%)`, pointerEvents:'none' }}/>

      <div ref={ref} style={{ maxWidth:1200, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* Header with kinetic typography */}
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <SectionBadge color={C.green} style={{ opacity:vis?1:0, transition:'opacity .5s' }}>{t.servicesBadge}</SectionBadge>
          <div style={{ marginBottom:8 }}>
            <KineticHeading lines={[t.servicesH1line1]} vis={vis} delay={0.15}
              style={{ fontSize:'clamp(28px,4vw,54px)', fontWeight:900, color:C.cream, lineHeight:1.15 }}/>
          </div>
          <KineticHeading lines={[t.servicesH1line2]} vis={vis} delay={0.45}
            style={{
              fontSize:'clamp(28px,4vw,54px)', fontWeight:900,
              color:C.green,
              display:'inline-block', lineHeight:1.2, marginBottom:16,
            }}/>
          <p style={{ fontSize:17, color:C.cream+'AA', lineHeight:1.9, maxWidth:580, margin:'0 auto', opacity:vis?1:0, transition:'opacity .6s .9s' }}>
            {t.servicesDesc}
          </p>
        </div>

        {/* Marquee ticker — floating service names */}
        <div style={{ overflow:'hidden', marginBottom:36, direction:'ltr' }}>
          <div style={{ display:'flex', gap:0, whiteSpace:'nowrap', animation:'marquee 30s linear infinite', willChange:'transform' }}>
            {marqItems.map((s, i) => (
              <span key={i} style={{ fontSize:12, fontWeight:700, color:i%2===0?C.purple:C.green, letterSpacing:'2.5px', textTransform:'uppercase', padding:'0 30px', opacity:.5 }}>
                {s.icon}&nbsp;&nbsp;{s.title}&nbsp;&nbsp;·
              </span>
            ))}
          </div>
        </div>

        {/* ── Service cards — swipe carousel on mobile, grid on desktop ── */}
        {isMobile ? (
          <div style={{
            display:'flex', gap:16, overflowX:'auto',
            scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch',
            paddingBottom:20, paddingInlineStart:4, paddingInlineEnd:16,
            marginBottom:44, scrollbarWidth:'none', msOverflowStyle:'none',
          }}
            className="svc-carousel"
          >
            {SERVICES.map((svc, i) => (
              <div key={i} style={{ flex:'0 0 82vw', maxWidth:320, scrollSnapAlign:'start' }}>
                <div className="svc-card" style={{ padding:'30px 22px', height:'100%', display:'flex', flexDirection:'column' }}>
                  <div style={{ position:'absolute', top:0, right:0, left:0, height:2, background:`linear-gradient(90deg,transparent,${svc.color}AA,transparent)`, borderRadius:'20px 20px 0 0' }}/>
                  <div style={{
                    width:60, height:60, borderRadius:'50%', flexShrink:0,
                    background:`linear-gradient(135deg,${svc.color}30,${svc.color}10)`,
                    border:`2px solid ${svc.color}55`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    marginBottom:18, boxShadow:`0 0 24px ${svc.color}22`,
                  }}>
                    <svc.Icon size={24} style={{ color:svc.color }}/>
                  </div>
                  <h3 style={{ fontSize:17, fontWeight:800, color:C.cream, marginBottom:10, lineHeight:1.3 }}>{lang === 'en' && svc.en_title ? svc.en_title : svc.title}</h3>
                  <p style={{ fontSize:13.5, color:C.cream+'AA', lineHeight:1.85, flex:1 }}>{lang === 'en' && svc.en_desc ? svc.en_desc : svc.desc}</p>
                  <div style={{ marginTop:18, height:2, background:`linear-gradient(90deg,${svc.color}88,transparent)`, borderRadius:1 }}/>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            display:'grid',
            gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',
            gap:24,
            marginBottom:44,
          }}>
            {SERVICES.map((svc, i) => (
              <div key={i} ref={el => cardRefs.current[i] = el}
                style={{
                  animation: cardVis[i]
                    ? `cardIn .78s cubic-bezier(.175,.885,.32,1.28) ${i*.11}s both, cardFloat ${4.5+i*.45}s ease-in-out ${i*.11+.78}s infinite`
                    : 'none',
                  opacity: cardVis[i] ? undefined : 0,
                }}>
                <div className="svc-card" style={{ padding:'38px 28px', height:'100%', display:'flex', flexDirection:'column' }}>
                  <div style={{ position:'absolute', top:0, right:0, left:0, height:2, background:`linear-gradient(90deg,transparent,${svc.color}AA,transparent)`, borderRadius:'20px 20px 0 0' }}/>
                  <div style={{
                    width:68, height:68, borderRadius:'50%', flexShrink:0,
                    background:`linear-gradient(135deg,${svc.color}30,${svc.color}10)`,
                    border:`2px solid ${svc.color}55`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:28, marginBottom:22,
                    animation:`iconSpin ${5+i*.7}s ease-in-out infinite`,
                    animationDelay:`${i*.6}s`,
                    boxShadow:`0 0 32px ${svc.color}22`,
                  }}>
                    <svc.Icon size={28} style={{ color:svc.color }}/>
                  </div>
                  <h3 style={{ fontSize:19, fontWeight:800, color:C.cream, marginBottom:12, lineHeight:1.3 }}>{lang === 'en' && svc.en_title ? svc.en_title : svc.title}</h3>
                  <p style={{ fontSize:14.5, color:C.cream+'AA', lineHeight:1.9, flex:1 }}>{lang === 'en' && svc.en_desc ? svc.en_desc : svc.desc}</p>
                  <div style={{ marginTop:20, height:2, background:`linear-gradient(90deg,${svc.color}88,transparent)`, borderRadius:1 }}/>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  )
}

// ─── CONTACT MODAL ────────────────────────────────────────────────────────────
const LEADS_STORE      = 'afik_leads_v1'
const DELETED_IDS_KEY  = 'afik_deleted_lead_ids'
const getDeletedIds    = () => { try { return new Set(JSON.parse(localStorage.getItem(DELETED_IDS_KEY) || '[]')) } catch { return new Set() } }
const persistDeletedId = id => { try { const s = getDeletedIds(); s.add(String(id)); localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...s])) } catch {} }
const clearDeletedId   = id => { try { const s = getDeletedIds(); s.delete(String(id)); localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...s])) } catch {} }
const clearAllDeletedIds = ()  => { try { localStorage.removeItem(DELETED_IDS_KEY) } catch {} }
const WA_KEY         = 'afik_wa_settings'
const ANALYTICS_KEY  = 'afik_analytics_v2'
const WA_DEFAULT_TEMPLATE = `היי {name},
ראינו שהשארת פרטים באתר של אפיק הנחל.
כיצד נוכל לעזור?`

function _getDevice() {
  const ua = navigator.userAgent
  if (/Mobi|Android|iPhone/i.test(ua)) return 'mobile'
  if (/iPad|Tablet/i.test(ua)) return 'tablet'
  return 'desktop'
}
function _getSource(ref) {
  if (!ref) return 'ישיר'
  try {
    const h = new URL(ref).hostname.replace('www.','')
    if (/google/.test(h)) return 'Google'
    if (/facebook|fb\.com/.test(h)) return 'Facebook'
    if (/instagram/.test(h)) return 'Instagram'
    if (/wa\.me|whatsapp/.test(h)) return 'WhatsApp'
    if (/bing/.test(h)) return 'Bing'
    if (/yad2/.test(h)) return 'Yad2'
    return h
  } catch { return 'ישיר' }
}
// ── Meta CAPI ─────────────────────────────────────────────────────────────────
function getCookie(name) {
  try {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return m ? m[2] : ''
  } catch { return '' }
}

function sendCAPI(metaEventName, pii = {}, customData = {}) {
  const event_id = `${metaEventName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  // Server-side — hashes PII, deduplicates via event_id
  fetch(`${API_BASE}/api/capi`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: [{
        event_name:  metaEventName,
        event_id,
        url:         window.location.href,
        fbp:         getCookie('_fbp'),
        fbc:         getCookie('_fbc'),
        email:       pii.email  || '',
        phone:       pii.phone  || '',
        name:        pii.name   || '',
        custom_data: customData,
      }]
    })
  }).catch(() => {})

  // Browser Pixel — same event_id lets Meta deduplicate with the CAPI event
  try {
    if (!window.fbq) return
    if (metaEventName === 'Lead')        window.fbq('track', 'Lead', customData, { eventID: event_id })
    else if (metaEventName === 'ViewContent') window.fbq('track', 'ViewContent', customData, { eventID: event_id })
    else if (metaEventName === 'PageView')    window.fbq('track', 'PageView', {}, { eventID: event_id })
    else if (metaEventName === 'Contact')     window.fbq('trackCustom', 'Contact', customData, { eventID: event_id })
  } catch {}
}

function trackEvent(name, props = {}) {
  try {
    const all = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]')
    all.push({ n: name, t: Date.now(), ...props })
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(all.slice(-3000)))
  } catch {}
  try { if (window.gtag) window.gtag('event', name, props) } catch {}
  // Meta Pixel + CAPI (deduplication handled inside sendCAPI via event_id)
  if (name === 'contact_form')   sendCAPI('Lead',        { email:props.email, phone:props.phone, name:props.name }, { content_name: props.propTitle || '' })
  if (name === 'property_view')  sendCAPI('ViewContent', {}, { content_name: props.title || '' })
  if (name === 'whatsapp_click') sendCAPI('Contact',     {}, { method: 'whatsapp' })
  if (name === 'phone_click')    sendCAPI('Contact',     {}, { method: 'phone' })
}

function toIntlPhone(phone) {
  const d = (phone || '').replace(/\D/g, '')
  if (!d) return ''
  return d.startsWith('972') ? d : d.startsWith('0') ? '972' + d.slice(1) : d
}

const WA_DEFAULTS = { provider:'greenapi', instanceId:'7107558519', apiUrl:'https://7107.api.greenapi.com', token:'191b9e9c4fc540f1ad25c8607389c0d689d15794f8094a0589', enabled:true, delayMin:2 }

// Module-level cloud settings cache — populated at app startup from /api/settings
let _cloudSettings = {}

async function sendWhatsAppLead(lead, overrideSettings) {
  try {
    const saved = _cloudSettings.waSettings || JSON.parse(localStorage.getItem(WA_KEY) || '{}')
    const st = overrideSettings || { ...WA_DEFAULTS, ...saved }
    if (!st.enabled || !st.instanceId || !st.token || !lead.phone) return
    const phone = toIntlPhone(lead.phone)
    if (!phone) return
    const msg = (st.template || WA_DEFAULT_TEMPLATE).replace(/\{name\}/g, lead.name || '')
    if (st.provider === 'ultramsg') {
      await fetch(`https://api.ultramsg.com/${st.instanceId}/messages/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: st.token, to: phone, body: msg }),
      })
    } else {
      const baseUrl = (st.apiUrl || 'https://api.green-api.com').replace(/\/$/, '')
      await fetch(`${baseUrl}/waInstance${st.instanceId}/sendMessage/${st.token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: `${phone}@c.us`, message: msg }),
      })
    }
  } catch {}
}

function ContactModal({ prop, onClose }) {
  const { C, lang } = useTheme()
  const t = TR[lang] || TR.he
  const labels = {
    he: { name:'שם מלא', phone:'טלפון', email:'אימייל', msg:'הודעה', fullName:'ישראל ישראלי', phoneEx:'05X-XXXXXXX', emailEx:'example@mail.com', contactTitle: 'פרטים ויצירת קשר', contactHeading: 'צרו קשר', messageSent: 'הודעתכם נשלחה!', willContact: 'נחזור אליכם בהקדם האפשרי', close: 'סגור', sendMsg: 'שלח הודעה' },
    en: { name:'Full Name', phone:'Phone', email:'Email', msg:'Message', fullName:'John Smith', phoneEx:'+1-555-XXXX', emailEx:'example@mail.com', contactTitle: 'Property Details & Contact', contactHeading: 'Contact Us', messageSent: 'Message Sent!', willContact: 'We\'ll get back to you soon', close: 'Close', sendMsg: 'Send Message' }
  }
  const lbl = labels[lang] || labels.he
  const [form, setForm] = useState({ name:'', phone:'', email:'', msg:prop?`${lang==='he'?'אני מעוניין בנכס':'I\'m interested in property'}: ${prop.title} – ${prop.location}`:'' })
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]:e.target.value }))
  const inp = { width:'100%', padding:'12px 16px', background:'rgba(255,255,255,.05)', border:`1px solid ${C.purple}33`, borderRadius:10, color:C.cream, fontSize:14, fontFamily:'inherit', outline:'none', direction: lang==='he' ? 'rtl' : 'ltr' }
  const swipe = useSwipeClose(onClose)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.84)', backdropFilter:'blur(12px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}
      onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
      <div style={{ background:C.card, border:`1px solid ${C.purple}33`, borderRadius:24, padding:'28px 36px', maxWidth:480, width:'100%', maxHeight:'88vh', overflowY:'auto', direction: lang==='he' ? 'rtl' : 'ltr', boxShadow:`0 32px 80px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.1)` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h2 style={{ fontSize:22, fontWeight:800, color:C.cream }}>{prop ? lbl.contactTitle : lbl.contactHeading}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.cream+'80', cursor:'pointer', fontSize:26, lineHeight:1 }}>×</button>
        </div>
        {prop && (
          <div style={{ background:`${C.purple}11`, border:`1px solid ${C.purple}22`, borderRadius:12, padding:12, marginBottom:16 }}>
            <div style={{ fontWeight:700, color:C.cream }}>{prop.title}</div>
            <div style={{ fontSize:13, color:C.purple, marginTop:4, display:'flex', alignItems:'center', gap:5 }}><FaMapMarkerAlt size={10}/> {prop.location} · {prop.size} מ"ר · ₪{prop.price}</div>
          </div>
        )}
        {sent ? (
          <div style={{ textAlign:'center', padding:'40px 0' }}>
            <div style={{ fontSize:52, marginBottom:16, color:C.green }}>✓</div>
            <div style={{ fontSize:20, fontWeight:700, color:C.green, marginBottom:8 }}>{lbl.messageSent}</div>
            <div style={{ fontSize:14, color:C.cream+'AA', marginBottom:24 }}>{lbl.willContact}</div>
            <button onClick={onClose} className="primary-btn" style={{ padding:'12px 32px' }}>{lbl.close}</button>
          </div>
        ) : (
          <form onSubmit={e => {
            e.preventDefault()
            if (sending) return
            setSending(true)
            const lead = {
              id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
              name: form.name, phone: form.phone, email: form.email, msg: form.msg,
              propTitle: prop?.title || '', propLocation: prop?.location || '',
              ts: Date.now(),
            }
            try {
              const all = JSON.parse(localStorage.getItem(LEADS_STORE) || '[]')
              all.unshift(lead)
              localStorage.setItem(LEADS_STORE, JSON.stringify(all.slice(0, 2000)))
            } catch {}
            try {
              const wh = _cloudSettings.crmWebhook || localStorage.getItem('afik_crm_webhook')
              if (wh) fetch(wh, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(lead) }).catch(()=>{})
            } catch {}
            if (API_BASE) {
              fetch(`${API_BASE}/api/contacts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lead),
              }).catch(() => {})
            }
            trackEvent('contact_form', { propTitle: prop?.title || '', hasEmail: !!form.email, email: form.email, phone: form.phone, name: form.name })
            setSent(true)
            setSending(false)
            // WhatsApp follow-up is handled server-side in /api/contacts (no client send needed)
          }} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[['name',lbl.name,'text',lbl.fullName],['phone',lbl.phone,'tel',lbl.phoneEx],['email',lbl.email,'email',lbl.emailEx]].map(([k,l,t,ph]) => (
              <div key={k}>
                <label style={{ fontSize:12, color:C.cream+'99', marginBottom:4, display:'block' }}>{l}</label>
                <input type={t} placeholder={ph} value={form[k]} onChange={set(k)} style={inp} className="contact-input"/>
              </div>
            ))}
            <div>
              <label style={{ fontSize:12, color:C.cream+'99', marginBottom:4, display:'block' }}>{lbl.msg}</label>
              <textarea rows={3} value={form.msg} onChange={set('msg')} style={{ ...inp, resize:'vertical' }} className="contact-input"/>
            </div>
            <button type="submit" disabled={sending} className="primary-btn" style={{ borderRadius:12, fontSize:15, opacity:sending?0.6:1 }}>{sending ? '...' : lbl.sendMsg}</button>
            <div style={{ textAlign:'center', paddingTop:6, borderTop:`1px solid ${C.purple}22` }}>
              <a href="tel:0559811814" onClick={() => trackEvent('phone_click', { src:'contact_modal' })} style={{ color:C.green, textDecoration:'none', fontWeight:700, fontSize:17, display:'inline-flex', alignItems:'center', gap:7 }}><FaPhone size={13}/> 055-981-1814</a>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
const CATEGORIES_DATA = {
  he: [
    { id:'projects',    label:'פרוייקטים בשיווק', Icon:FaHardHat, types:['וילה','בנייה רוויה','פרויקט חדש','נכס מסחרי','דיור מוגן','בית פרטי'] },
    { id:'land',        label:'מגרשים וקרקעות',   Icon:FaLeaf,    types:['קרקע חקלאית','מגרש לבנייה','קרקע מסחרית','מגרש פינתי','קרקע יזמית'] },
    { id:'apartments',  label:'דירות למכירה',      Icon:FaHome,    types:['דירה','פנטהאוז','דירת גן','דופלקס','וילה','קוטג׳'] },
    { id:'commercial',  label:'נכסים מסחריים',     Icon:FaStore,   types:['משרד','חנות','מסחר ושירותים','מחסן / לוגיסטיקה','מבנה תעשייתי','אולם אירועים','קרקע מסחרית','מתחם מסחרי'] },
  ],
  en: [
    { id:'projects',    label:'Projects for Marketing', Icon:FaHardHat, types:['Villa','Multi-family','New Project','Commercial Property','Senior Living','Private Home'] },
    { id:'land',        label:'Plots & Land',   Icon:FaLeaf,    types:['Agricultural Land','Building Plot','Commercial Land','Corner Plot','Development Land'] },
    { id:'apartments',  label:'Apartments for Sale',      Icon:FaHome,    types:['Apartment','Penthouse','Garden Apartment','Duplex','Villa','Cottage'] },
    { id:'commercial',  label:'Commercial Properties',    Icon:FaStore,   types:['Office','Store','Retail & Services','Warehouse / Logistics','Industrial Building','Event Hall','Commercial Land','Commercial Complex'] },
  ]
}

const CATEGORIES = CATEGORIES_DATA.he
const EMPTY_PROP = {
  category:'land', title:'', location:'', neighborhood:'', street:'', region:'השרון',
  type:'קרקע חקלאית', size:'', dunams:'', rooms:'', floor:'', totalFloors:'',
  gush:'', helka:'',
  parking:false, balcony:false, elevator:false, storage:false,
  pool:false, garden:false, safeRoom:false, airCon:false, tornadoAC:false,
  furnished:false, renovated:false, accessible:false, solarBoiler:false, bars:false,
  kosher:false, unit:false, doorman:false, boiler:false,
  zoning:'', buildingRights:'', buildYear:'', direction:'',
  propertyTax:'', houseCommittee:'',
  condition:'', entryDate:'', parkingCount:'', buildSqm:'',
  price:'', priceNegotiable:false,
  status:'בשיווק', exclusive:false, images:[], logo:'', description:'',
  landingPageUrl:'', videoUrl:'', videoAutoplay:false, mapsUrl:'',
  published: true,
  // Commercial-specific
  annualRent:'', occupancyRate:'', numUnits:'',
  cameras:false, alarm:false, conferenceRoom:false, kitchenette:false, openSpace:false, loadingDock:false, wifi:false,
  commRoom:false, mamak:false,
}

const ALL_AMENITIES = [
  { key:'elevator',      Icon:FaBuilding,     label:'מעלית' },
  { key:'accessible',    Icon:FaWheelchair,   label:'גישה לנכים' },
  { key:'tornadoAC',     Icon:FaSnowflake,    label:'מזגן טורנדו' },
  { key:'airCon',        Icon:FaSnowflake,    label:'מיזוג' },
  { key:'balcony',       Icon:FaSun,          label:'מרפסת' },
  { key:'storage',       Icon:FaBoxOpen,      label:'מחסן' },
  { key:'parking',       Icon:FaCar,          label:'חניה' },
  { key:'pool',          Icon:FaSwimmingPool, label:'בריכה' },
  { key:'garden',        Icon:FaTree,         label:'גינה' },
  { key:'safeRoom',      Icon:FaShieldAlt,    label:'ממ"ד' },
  { key:'furnished',     Icon:FaCouch,        label:'מרוהט' },
  { key:'renovated',     Icon:FaTools,        label:'משופץ' },
  { key:'solarBoiler',   Icon:FaFire,         label:'דוד שמש' },
  { key:'bars',          Icon:FaLock,         label:'סורגים' },
  { key:'kosher',        Icon:FaUtensils,     label:'מטבח כשר' },
  { key:'unit',          Icon:FaDoorOpen,     label:'יחידת דיור' },
  { key:'doorman',       Icon:FaUserShield,   label:'שוער' },
  { key:'boiler',        Icon:FaBolt,         label:'דוד חשמל' },
  // commercial amenities
  { key:'cameras',       Icon:FaCamera,       label:'מצלמות אבטחה' },
  { key:'alarm',         Icon:FaBolt,         label:'אזעקה' },
  { key:'conferenceRoom',Icon:FaCompass,      label:'חדר ישיבות' },
  { key:'kitchenette',   Icon:FaHome,         label:'מטבחון' },
  { key:'openSpace',     Icon:FaRulerCombined,label:'מרחב פתוח' },
  { key:'loadingDock',   Icon:FaIndustry,     label:'רציף פריקה' },
  { key:'wifi',          Icon:FaWifi,         label:'אינטרנט מהיר' },
  { key:'commRoom',      Icon:FaWifi,         label:'חדר תקשורת' },
  { key:'mamak',         Icon:FaShieldAlt,    label:'ממק' },
]

const CONDITION_OPTIONS = ['','חדש מקבלן','חדש (גרו בנכס)','משופץ','שמור','דרוש שיפוץ']
const ENTRY_OPTIONS     = ['','מיידית','כניסה גמישה','לפי הסכם']

const ADMIN_DRAFT_KEY = 'afik_form_draft'

// ─── LOGO UPLOAD (single image, compressed) ──────────────────────────────────
function LogoUpload({ logo, onChange }) {
  const { C } = useTheme()
  const [loading, setLoading] = useState(false)

  const compress = file => new Promise(res => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const MAX = 400
        let w = img.width, h = img.height
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
        const cv = document.createElement('canvas')
        cv.width = w; cv.height = h
        cv.getContext('2d').drawImage(img, 0, 0, w, h)
        res(cv.toDataURL('image/png', 0.9))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })

  const onFile = async e => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setLoading(true)
    const compressed = await compress(file)
    onChange(compressed)
    setLoading(false)
    e.target.value = ''
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:16 }}>
      {logo ? (
        <div style={{ position:'relative', flexShrink:0 }}>
          <img src={logo} alt="לוגו" style={{ width:80, height:80, objectFit:'contain', background:'rgba(255,255,255,.06)', borderRadius:12, border:`1px solid ${C.purple}33`, padding:6 }}/>
          <button onClick={() => onChange('')}
            style={{ position:'absolute', top:-8, right:-8, width:22, height:22, borderRadius:'50%', background:'#E05252', border:'none', color:'#fff', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>×</button>
        </div>
      ) : (
        <div style={{ width:80, height:80, borderRadius:12, border:`2px dashed ${C.purple}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, background:'rgba(255,255,255,.02)' }}>
          <FaImage size={20} style={{ opacity:.25, color:C.purple }}/>
        </div>
      )}
      <div>
        <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'9px 16px', background:`${C.purple}18`, border:`1px solid ${C.purple}44`, borderRadius:8, color:C.purple, fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}
          onMouseEnter={e=>e.currentTarget.style.background=`${C.purple}30`}
          onMouseLeave={e=>e.currentTarget.style.background=`${C.purple}18`}>
          <input type="file" accept="image/*" onChange={onFile} style={{ display:'none' }}/>
          {loading ? 'מעבד...' : logo ? 'החלף לוגו' : 'העלה לוגו'}
        </label>
        <div style={{ fontSize:10, color:`${C.cream}44`, marginTop:5 }}>PNG/SVG שקוף · מומלץ</div>
      </div>
    </div>
  )
}

// ─── IMAGE UPLOAD (drag & drop + reorder) ────────────────────────────────────
function ImageUpload({ images, onChange }) {
  const [dragOver, setDragOver] = useState(false)
  const [dragIdx, setDragIdx]   = useState(null)
  const [overIdx, setOverIdx]   = useState(null)
  const [loading, setLoading]   = useState(false)

  const compress = file => new Promise(res => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1200
        let w = img.width, h = img.height
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
        const cv = document.createElement('canvas')
        cv.width = w; cv.height = h
        cv.getContext('2d').drawImage(img, 0, 0, w, h)
        res(cv.toDataURL('image/jpeg', 0.78))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })

  const addFiles = async files => {
    const allowed = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 8 - images.length)
    if (!allowed.length) return
    setLoading(true)
    const compressed = await Promise.all(allowed.map(compress))
    onChange([...images, ...compressed])
    setLoading(false)
  }

  const onInputChange = async e => { await addFiles(e.target.files); e.target.value = '' }

  const onDropZone = async e => {
    e.preventDefault(); setDragOver(false)
    await addFiles(e.dataTransfer.files)
  }

  const remove = i => onChange(images.filter((_, j) => j !== i))
  const setMain = i => onChange([images[i], ...images.filter((_, j) => j !== i)])

  // Drag-to-reorder handlers
  const onDragStart = (e, i) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move' }
  const onDragEnter = (e, i) => { e.preventDefault(); setOverIdx(i) }
  const onDragOver  = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const onDragEnd   = () => {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      const arr = [...images]
      const [item] = arr.splice(dragIdx, 1)
      arr.splice(overIdx, 0, item)
      onChange(arr)
    }
    setDragIdx(null); setOverIdx(null)
  }

  const cell = { position:'relative', aspectRatio:'4/3', borderRadius:10, overflow:'hidden', background:'rgba(255,255,255,.05)', userSelect:'none' }

  return (
    <div>
      {/* Drop zone */}
      <div
        onDrop={onDropZone}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        style={{
          border: `2px dashed ${dragOver ? 'rgba(132,144,216,.8)' : 'rgba(132,144,216,.3)'}`,
          borderRadius: 10,
          padding: '14px 16px',
          background: dragOver ? 'rgba(132,144,216,.08)' : 'rgba(255,255,255,.02)',
          textAlign: 'center',
          marginBottom: 10,
          transition: 'all .2s',
          cursor: 'pointer',
        }}
        onClick={() => document.getElementById('img-upload-input').click()}
      >
        <input id="img-upload-input" type="file" accept="image/*" multiple onChange={onInputChange} style={{ display:'none' }}/>
        {loading ? (
          <div style={{ fontSize:12, color:'rgba(232,228,216,.5)', letterSpacing:'.04em' }}>מעבד תמונות...</div>
        ) : (
          <>
            <FaImage size={20} style={{ marginBottom:4, opacity:.3, color:'rgba(232,228,216,.6)' }}/>
            <div style={{ fontSize:12, color:'rgba(232,228,216,.6)', fontWeight:600 }}>גרור תמונות לכאן או לחץ לבחירה</div>
            <div style={{ fontSize:10, color:'rgba(232,228,216,.3)', marginTop:3 }}>עד {8 - images.length} תמונות נוספות · JPEG/PNG/WEBP</div>
          </>
        )}
      </div>

      {/* Thumbnails — draggable to reorder */}
      {images.length > 0 && (
        <div className="prop-img-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:6 }}>
          {images.map((src, i) => (
            <div key={i}
              draggable
              onDragStart={e => onDragStart(e, i)}
              onDragEnter={e => onDragEnter(e, i)}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              style={{
                ...cell,
                outline: overIdx === i && dragIdx !== i ? '2px solid rgba(132,144,216,.8)' : '2px solid transparent',
                opacity: dragIdx === i ? 0.45 : 1,
                cursor: 'grab',
                transition: 'opacity .15s, outline .15s',
              }}
            >
              <img src={src} style={{ width:'100%', height:'100%', objectFit:'cover', pointerEvents:'none' }} alt=""/>
              {i===0 && <div style={{ position:'absolute', bottom:0, right:0, left:0, background:'rgba(0,0,0,.65)', color:'#82F67F', fontSize:9, textAlign:'center', padding:'2px 0', fontWeight:700, letterSpacing:'.05em' }}>ראשית</div>}
              <div style={{ position:'absolute', top:3, right:3, display:'flex', gap:3 }}>
                {i!==0 && (
                  <button onClick={() => setMain(i)}
                    style={{ background:'rgba(0,0,0,.82)', border:'none', borderRadius:3, padding:'2px 6px', color:'#82F67F', cursor:'pointer', fontSize:8, fontWeight:700 }}>
                    ראשית
                  </button>
                )}
                <button onClick={() => remove(i)}
                  style={{ background:'rgba(180,0,0,.88)', border:'none', borderRadius:3, width:18, height:18, color:'white', cursor:'pointer', fontSize:13, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  ×
                </button>
              </div>
              {/* Drag handle indicator */}
              <div style={{ position:'absolute', bottom:3, left:3, opacity:.4, pointerEvents:'none', fontSize:10 }}>⠿</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize:10, color:'rgba(232,228,216,.3)', letterSpacing:'.03em' }}>
        גרור תמונות לשינוי סדר · תמונה ראשונה = תמונה ראשית
      </div>
    </div>
  )
}

// ─── PLATFORM SECTION ────────────────────────────────────────────────────────
const PLATFORM_CFG = {
  ga4: {
    name:'Google Analytics 4', color:'#FF6B35', Icon:FaChartBar,
    id:'G-X1S3XX7TRV',
    url:'https://analytics.google.com/analytics/web/#/p/reports/realtime/overview',
    desc:'דוח בזמן אמת, מקורות תנועה, קהלים ומשפכי המרה',
    metrics:[
      { label:'משתמשים פעילים כרגע',  Icon:FaUser,        note:'זמן אמת' },
      { label:'ביקורים ב-30 יום',      Icon:FaCalendarAlt, note:'חודש אחרון' },
      { label:'שיעור המרה',            Icon:FaBalanceScale, note:'יעד: יצירת קשר' },
      { label:'זמן ממוצע בדף',         Icon:FaEye,         note:'שניות' },
    ],
    deepLinks:[
      { label:'סקירה כללית',     path:'#/p/reports/realtime/overview' },
      { label:'רכישת משתמשים',  path:'#/p/reports/acquisition/acquisition-overview' },
      { label:'ביצועי דפים',    path:'#/p/reports/engagement/pages-and-screens' },
      { label:'אירועים',        path:'#/p/reports/engagement/events' },
    ],
  },
  meta: {
    name:'Meta Business Suite', color:'#1877F2', Icon:FaFacebookF,
    id:'Pixel: 1341264237748951',
    url:'https://business.facebook.com/latest/home',
    desc:'ניהול קמפיינים, קהלי ריטרגטינג, ביצועי פרסומות',
    metrics:[
      { label:'הגעה של פוסטים',  Icon:FaEye,          note:'7 ימים' },
      { label:'קליקים על פרסומות', Icon:FaMousePointer, note:'אחרון' },
      { label:'עלות לקליק',      Icon:FaDollarSign,   note:'CPC' },
      { label:'המרות Pixel',     Icon:FaBolt,         note:'Lead + ViewContent' },
    ],
    deepLinks:[
      { label:'לוח בקרה',        path:'latest/home' },
      { label:'ניהול פרסומות',   path:'adsmanager/manage/ads' },
      { label:'Events Manager',  path:'events_manager' },
      { label:'קהלים',           path:'audience' },
    ],
  },
  instagram: {
    name:'Instagram Insights', color:'#E1306C', Icon:FaInstagram,
    id:'@afik.hanahal',
    url:'https://www.instagram.com/afik.hanahal/',
    desc:'ביצועי פוסטים, סטוריז, ריץ׳ ואינטראקציות',
    metrics:[
      { label:'עוקבים',           Icon:FaUsers,      note:'סה"כ' },
      { label:'הגעה שבועית',      Icon:FaEye,        note:'7 ימים' },
      { label:'אינטראקציות',      Icon:FaHeart,      note:'לייקים + תגובות' },
      { label:'לחיצות על פרופיל', Icon:FaLink,       note:'7 ימים' },
    ],
    deepLinks:[
      { label:'פרופיל',    path:'' },
      { label:'Reels',    path:'reels/' },
      { label:'תגיות',    path:'tagged/' },
    ],
  },
  logrocket: {
    name:'LogRocket Sessions', color:'#764ABC', Icon:FaVideo,
    id:'tkrebw/afik-hanahal',
    url:'https://app.logrocket.com/tkrebw/afik-hanahal',
    desc:'הקלטות מסך של משתמשים, מפות חום, שגיאות ו-network',
    metrics:[
      { label:'סשנים מוקלטים',  Icon:FaPlay,  note:'כל הזמן' },
      { label:'משתמשים ייחודיים',Icon:FaUser,  note:'30 ימים' },
      { label:'שגיאות JS',       Icon:FaTimes, note:'ב-7 ימים' },
      { label:'בקשות רשת',      Icon:FaGlobe, note:'ממוצע לסשן' },
    ],
    deepLinks:[
      { label:'סשנים',         path:'sessions' },
      { label:'שגיאות',        path:'errors' },
      { label:'Network',       path:'network' },
      { label:'ניתוח משתמשים', path:'users' },
    ],
  },
}

// ─── META GRAPH API LIVE PANEL ────────────────────────────────────────────────
const META_TOKEN_KEY = 'afik_meta_graph_token'
const META_APP_ID    = '2790974851265479'
const META_TOKEN_DEFAULT = 'EAAnqYHiWM8cBRZAZCAfaykV1lMF9GXejZCKL9vcoG7g72Y5qdnvqFKc202h6hkkXJZCVnivpqdVsbZCRdWS1QUp20SH1VuWdDrbiqnrAZAVztagzyeOqKxZCqxTqc0AK2gD8KxSI7WaNRB5Kzwv0MXGuzAgU3Oy4G2852n6b33R7EJ2CIiDonufDelgEqtPX3o3jd65YjqXAZBJD9ZBnEdrY3cy8HWDShbMPgZBjDr4DglKOlZAG77KZCUdo4LW2YeXIDNbKKrPGlcnvdjdkZC6pSqI0r'

function MetaGraphLive({ tab }) {
  const { C, isDark } = useTheme()
  const cardBg = isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)'

  const [token, setToken]           = useState(() => localStorage.getItem(META_TOKEN_KEY) || META_TOKEN_DEFAULT)
  const [tokenInput, setTokenInput] = useState('')
  const [editToken, setEditToken]   = useState(false)
  const [pages, setPages]           = useState([])
  const [pageData, setPageData]     = useState(null)
  const [igData, setIgData]         = useState(null)
  const [waPhones, setWaPhones]     = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [queryPath, setQueryPath]   = useState('/me?fields=id,name')
  const [queryResult, setQueryResult] = useState(null)
  const [querying, setQuerying]     = useState(false)
  const [tokenExpiry, setTokenExpiry] = useState(null)

  // ── Graph API helper ──────────────────────────────────────────────────
  const graph = async (path) => {
    const sep = path.includes('?') ? '&' : '?'
    const url = `https://graph.facebook.com/v25.0${path.startsWith('/') ? '' : '/'}${path}${sep}access_token=${token}`
    const r = await fetch(url)
    const d = await r.json()
    if (d.error) throw new Error(`${d.error.message} (${d.error.code})`)
    return d
  }

  // ── Check token validity ──────────────────────────────────────────────
  const checkToken = async (tk) => {
    try {
      const url = `https://graph.facebook.com/debug_token?input_token=${tk}&access_token=${tk}`
      const r = await fetch(url)
      const d = await r.json()
      if (d.data?.expires_at) setTokenExpiry(d.data.expires_at * 1000)
    } catch {}
  }

  // ── Load Meta data ────────────────────────────────────────────────────
  const loadData = async () => {
    if (!token) return
    setLoading(true)
    setError('')
    setPageData(null)
    setIgData(null)
    setWaPhones([])
    try {
      // Pages
      const accs = await graph('/me/accounts?fields=id,name,fan_count,followers_count,category,picture.type(small)')
      setPages(accs.data || [])
      const pg = accs.data?.[0]
      if (pg) {
        // Page detail + connected IG
        const pd = await graph(`/${pg.id}?fields=name,fan_count,followers_count,about,website,category,instagram_business_account,phone`)
        setPageData({ ...pg, ...pd })
        // Instagram
        if (pd.instagram_business_account?.id) {
          try {
            const ig = await graph(`/${pd.instagram_business_account.id}?fields=username,biography,followers_count,follows_count,media_count,profile_picture_url,website`)
            setIgData(ig)
          } catch {}
        }
        // WhatsApp phone numbers
        try {
          const wa = await graph(`/${META_APP_ID}/subscribed_apps?access_token=${token}`)
          setWaPhones(wa.data || [])
        } catch {}
      }
      await checkToken(token)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [token])

  const saveToken = () => {
    const t = tokenInput.trim()
    if (!t) return
    localStorage.setItem(META_TOKEN_KEY, t)
    setToken(t)
    setEditToken(false)
    setTokenInput('')
  }

  const runQuery = async () => {
    setQuerying(true)
    setQueryResult(null)
    try {
      const r = await graph(queryPath)
      setQueryResult(r)
    } catch (e) {
      setQueryResult({ error: e.message })
    }
    setQuerying(false)
  }

  const isExpired = tokenExpiry && tokenExpiry < Date.now()
  const expiresIn = tokenExpiry ? Math.max(0, Math.round((tokenExpiry - Date.now()) / 60000)) : null
  const expiryColor = !tokenExpiry ? C.purple : isExpired ? '#E05252' : expiresIn < 60 ? '#F97316' : '#22C55E'
  const expiryLabel = !tokenExpiry ? 'בדיקה...' : isExpired ? 'פג תוקף — עדכן טוקן' : expiresIn > 1440 ? `תקף — ${Math.round(expiresIn/1440)} ימים` : expiresIn > 60 ? `${Math.round(expiresIn/60)} שעות` : `${expiresIn} דקות`

  const inp = { width:'100%', padding:'9px 12px', background:'rgba(255,255,255,.05)', border:`1px solid ${C.purple}33`, borderRadius:8, color:C.cream, fontSize:13, fontFamily:'monospace', outline:'none', direction:'ltr', boxSizing:'border-box' }

  // ── Preset queries ────────────────────────────────────────────────────
  const PRESETS = [
    { label:'פרטי המשתמש',   path:'/me?fields=id,name,email' },
    { label:'עמודי הפייסבוק', path:'/me/accounts?fields=id,name,fan_count,followers_count,category' },
    ...(pageData?.id ? [
      { label:'סטטיסטיקת עמוד', path:`/${pageData.id}?fields=name,fan_count,followers_count,about` },
      { label:'פוסטים אחרונים', path:`/${pageData.id}/posts?fields=message,created_time,likes.summary(true),comments.summary(true)&limit=5` },
      { label:'Insights ייחודי',  path:`/${pageData.id}/insights?metric=page_impressions_unique,page_reach&period=week` },
    ] : []),
    ...(igData?.id ? [
      { label:'Instagram פרופיל', path:`/${igData.id}?fields=username,followers_count,media_count,biography` },
      { label:'IG מדיה אחרונה',   path:`/${igData.id}/media?fields=id,caption,media_type,timestamp,like_count,comments_count&limit=5` },
    ] : []),
    { label:'WA Phone Numbers', path:`/${META_APP_ID}/subscribed_apps` },
  ]

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

      {/* Token bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,.03)', border:`1px solid ${expiryColor}33`, borderRadius:12, padding:'12px 16px' }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:expiryColor, boxShadow:`0 0 8px ${expiryColor}`, flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:expiryColor }}>Graph API Token — {expiryLabel}</div>
          <div style={{ fontSize:10, color:`${C.cream}44`, fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:2 }}>{token.slice(0,28)}•••</div>
        </div>
        <button onClick={() => { setEditToken(v => !v); setTokenInput('') }}
          style={{ padding:'6px 14px', background:`${C.purple}18`, border:`1px solid ${C.purple}44`, borderRadius:7, color:C.purple, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
          {editToken ? 'ביטול' : 'עדכן טוקן'}
        </button>
        <button onClick={loadData} disabled={loading}
          style={{ padding:'6px 12px', background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.25)', borderRadius:7, color:'#22C55E', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0, opacity:loading?.5:1 }}>
          {loading ? '⟳' : '↺ רענן'}
        </button>
      </div>

      {/* Token edit */}
      {editToken && (
        <div style={{ background:'rgba(255,255,255,.03)', border:`1px solid ${C.purple}22`, borderRadius:12, padding:14, display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:11, color:`${C.cream}66`, fontWeight:600 }}>הדבק User Access Token חדש מ-<a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color:C.purple }}>Graph API Explorer</a></div>
          <div style={{ display:'flex', gap:8 }}>
            <input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="EAAn..." style={{ ...inp, flex:1 }}/>
            <button onClick={saveToken} style={{ padding:'9px 18px', background:C.purple, border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>שמור</button>
          </div>
          <div style={{ fontSize:10, color:`${C.cream}33` }}>הטוקן נשמר מקומית בדפדפן בלבד · לטוקן לטווח ארוך: הרחב ל-60 ימים ב-Graph API Explorer</div>
        </div>
      )}

      {error && (
        <div style={{ background:'rgba(224,82,82,.1)', border:'1px solid rgba(224,82,82,.3)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#E05252' }}>
          {error}
        </div>
      )}

      {/* ── FACEBOOK PAGE DATA ─────────────────────────── */}
      {tab === 'meta' && (
        <>
          {loading && <div style={{ textAlign:'center', padding:28, color:`${C.cream}44`, fontSize:13 }}>טוען נתונים מ-Facebook...</div>}
          {pageData && (
            <>
              {/* Page header */}
              <div style={{ display:'flex', alignItems:'center', gap:14, background:'rgba(24,119,242,.08)', border:'1px solid rgba(24,119,242,.25)', borderRadius:14, padding:'16px 18px' }}>
                {pageData.picture?.data?.url && <img src={pageData.picture.data.url} alt="" style={{ width:52, height:52, borderRadius:'50%', border:'2px solid rgba(24,119,242,.4)' }}/>}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:18, fontWeight:900, color:C.cream }}>{pageData.name}</div>
                  <div style={{ fontSize:12, color:`${C.cream}66`, marginTop:2 }}>{pageData.category}</div>
                  {pageData.about && <div style={{ fontSize:11, color:`${C.cream}50`, marginTop:4, lineHeight:1.5 }}>{pageData.about.slice(0,120)}{pageData.about.length>120?'...':''}</div>}
                </div>
                <a href={`https://www.facebook.com/${pageData.id}`} target="_blank" rel="noopener noreferrer"
                  style={{ padding:'9px 18px', background:'#1877F2', border:'none', borderRadius:9, color:'#fff', fontSize:12, fontWeight:700, textDecoration:'none', flexShrink:0 }}>
                  פתח עמוד ↗
                </a>
              </div>

              {/* Page metrics */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
                {[
                  { Icon:FaThumbsUp, label:'לייקים לעמוד',    value: (pageData.fan_count||0).toLocaleString('he-IL'),       color:'#E05252' },
                  { Icon:FaUsers,    label:'עוקבים',           value: (pageData.followers_count||0).toLocaleString('he-IL'), color:'#1877F2' },
                  { Icon:FaRobot,    label:'WA Bot',           value: 'פעיל',   color:'#25D366' },
                  { Icon:FaInstagram,label:'Instagram',        value: igData ? 'מחובר' : 'לא מחובר', color: igData ? '#E1306C' : `${C.cream}33` },
                ].map((m,i) => (
                  <div key={i} style={{ background:cardBg, border:`1px solid ${m.color}28`, borderRadius:12, padding:'14px 12px', textAlign:'center' }}>
                    <div style={{ marginBottom:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <m.Icon size={18} style={{ color:m.color }}/>
                    </div>
                    <div style={{ fontSize:22, fontWeight:900, color:m.color, lineHeight:1 }}>{m.value}</div>
                    <div style={{ fontSize:11, color:`${C.cream}77`, marginTop:5, fontWeight:700 }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Pages list */}
              {pages.length > 1 && (
                <div style={{ background:cardBg, border:'1px solid rgba(24,119,242,.15)', borderRadius:12, padding:'14px 16px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:`${C.cream}55`, marginBottom:10 }}>עמודים מנוהלים ({pages.length})</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {pages.map((p,i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10, fontSize:12 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:'#1877F2', flexShrink:0 }}/>
                        <span style={{ color:C.cream, fontWeight:600 }}>{p.name}</span>
                        <span style={{ color:`${C.cream}44` }}>· {p.category} · {(p.followers_count||0).toLocaleString()} עוקבים</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {!loading && !pageData && !error && (
            <div style={{ textAlign:'center', padding:28, color:`${C.cream}44`, fontSize:12 }}>לא נמצאו עמודים מנוהלים תחת המשתמש הזה</div>
          )}
        </>
      )}

      {/* ── INSTAGRAM DATA ─────────────────────────────── */}
      {tab === 'instagram' && (
        <>
          {loading && <div style={{ textAlign:'center', padding:28, color:`${C.cream}44`, fontSize:13 }}>טוען נתונים מ-Instagram...</div>}
          {igData && (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* IG Profile header */}
              <div style={{ display:'flex', alignItems:'center', gap:14, background:'rgba(225,48,108,.08)', border:'1px solid rgba(225,48,108,.25)', borderRadius:14, padding:'16px 18px' }}>
                {igData.profile_picture_url && <img src={igData.profile_picture_url} alt="" style={{ width:56, height:56, borderRadius:'50%', border:'2px solid rgba(225,48,108,.4)' }}/>}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:17, fontWeight:900, color:C.cream }}>@{igData.username}</div>
                  {igData.biography && <div style={{ fontSize:11, color:`${C.cream}66`, marginTop:4, lineHeight:1.5 }}>{igData.biography.slice(0,100)}</div>}
                  {igData.website && <div style={{ fontSize:11, color:'#E1306C', marginTop:3 }}>{igData.website}</div>}
                </div>
                <a href={`https://www.instagram.com/${igData.username}/`} target="_blank" rel="noopener noreferrer"
                  style={{ padding:'9px 18px', background:'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)', border:'none', borderRadius:9, color:'#fff', fontSize:12, fontWeight:700, textDecoration:'none', flexShrink:0 }}>
                  פתח פרופיל ↗
                </a>
              </div>

              {/* IG Metrics */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                {[
                  { Icon:FaUsers,  label:'עוקבים',  value:(igData.followers_count||0).toLocaleString('he-IL'),  color:'#E1306C' },
                  { Icon:FaCamera, label:'פוסטים',   value:(igData.media_count||0).toLocaleString('he-IL'),      color:'#833ab4' },
                  { Icon:FaEye,    label:'עוקב אחרי',value:(igData.follows_count||0).toLocaleString('he-IL'),    color:'#fcb045' },
                ].map((m,i) => (
                  <div key={i} style={{ background:cardBg, border:`1px solid ${m.color}28`, borderRadius:12, padding:'16px 12px', textAlign:'center' }}>
                    <div style={{ marginBottom:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <m.Icon size={20} style={{ color:m.color }}/>
                    </div>
                    <div style={{ fontSize:26, fontWeight:900, color:m.color, lineHeight:1 }}>{m.value}</div>
                    <div style={{ fontSize:11, color:`${C.cream}77`, marginTop:5, fontWeight:700 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!loading && !igData && !error && (
            <div style={{ background:'rgba(225,48,108,.07)', border:'1px solid rgba(225,48,108,.2)', borderRadius:12, padding:'16px 18px', fontSize:12, color:`${C.cream}77` }}>
              לא נמצא חשבון Instagram Business מחובר לעמוד הפייסבוק.<br/>
              <span style={{ fontSize:11, color:`${C.cream}44`, marginTop:4, display:'block' }}>חבר את @afik.hanahal דרך Facebook Business Settings → Instagram Accounts</span>
            </div>
          )}
        </>
      )}

      {/* ── GRAPH API EXPLORER ──────────────────────────── */}
      <div style={{ background:cardBg, border:`1px solid ${C.purple}20`, borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px 10px', borderBottom:`1px solid ${C.purple}15`, display:'flex', alignItems:'center', gap:8 }}>
          <FaSearch size={11} style={{ color:C.purple, opacity:.7 }}/>
          <span style={{ fontSize:12, fontWeight:800, color:C.cream }}>Graph API Explorer</span>
          <span style={{ fontSize:10, color:`${C.cream}33`, marginRight:'auto' }}>v25.0</span>
        </div>
        <div style={{ padding:14, display:'flex', flexDirection:'column', gap:10 }}>
          {/* Preset buttons */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {PRESETS.map((p,i) => (
              <button key={i} onClick={() => setQueryPath(p.path)}
                style={{ padding:'5px 11px', background:'rgba(255,255,255,.04)', border:`1px solid ${C.purple}25`, borderRadius:6, color:`${C.cream}80`, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' }}
                onMouseEnter={e=>{ e.currentTarget.style.background=`${C.purple}18`; e.currentTarget.style.color=C.purple }}
                onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,.04)'; e.currentTarget.style.color=`${C.cream}80` }}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Query input */}
          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', background:'rgba(255,255,255,.04)', border:`1px solid ${C.purple}30`, borderRadius:8, overflow:'hidden' }}>
              <span style={{ padding:'0 10px', fontSize:11, color:`${C.cream}44`, whiteSpace:'nowrap', borderRight:`1px solid ${C.purple}20` }}>GET graph.facebook.com/v25.0</span>
              <input value={queryPath} onChange={e => setQueryPath(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter') runQuery() }}
                style={{ flex:1, padding:'9px 10px', background:'transparent', border:'none', color:C.cream, fontSize:12, fontFamily:'monospace', outline:'none' }}/>
            </div>
            <button onClick={runQuery} disabled={querying}
              style={{ padding:'9px 18px', background:C.purple, border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', opacity:querying?.6:1, flexShrink:0 }}>
              {querying ? '⟳' : 'Submit'}
            </button>
          </div>
          {/* Result */}
          {queryResult && (
            <div style={{ maxHeight:280, overflowY:'auto', background:'rgba(0,0,0,.4)', borderRadius:8, padding:'10px 12px' }}>
              {queryResult.error ? (
                <div style={{ color:'#E05252', fontSize:12 }}>{queryResult.error}</div>
              ) : (
                <pre style={{ margin:0, fontSize:11, color:'#22C55E', fontFamily:'monospace', whiteSpace:'pre-wrap', wordBreak:'break-all', lineHeight:1.6 }}>
                  {JSON.stringify(queryResult, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PlatformSection({ tab, C, isDark }) {
  const cfg = PLATFORM_CFG[tab]
  if (!cfg) return null
  const cardBg = isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Platform header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px', background:`${cfg.color}10`, border:`1px solid ${cfg.color}33`, borderRadius:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:48, height:48, borderRadius:12, background:`${cfg.color}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <cfg.Icon size={22} style={{ color:cfg.color }}/>
          </div>
          <div>
            <div style={{ fontSize:17, fontWeight:900, color:C.cream }}>{cfg.name}</div>
            <div style={{ fontSize:12, color:`${C.cream}66`, marginTop:3 }}>{cfg.id}</div>
            <div style={{ fontSize:12, color:`${C.cream}88`, marginTop:4, lineHeight:1.5 }}>{cfg.desc}</div>
          </div>
        </div>
        <a href={cfg.url} target="_blank" rel="noopener noreferrer"
          style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 20px', background:cfg.color, border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none', transition:'opacity .2s', flexShrink:0 }}
          onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
          onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
          פתח לוח בקרה ↗
        </a>
      </div>

      {/* Live metrics placeholder */}
      <div className="admin-analytics-kpi" style={{ display:'grid', gap:10 }}>
        {cfg.metrics.map((m,i) => (
          <div key={i} style={{ background:cardBg, border:`1px solid ${cfg.color}22`, borderRadius:12, padding:'14px 12px', textAlign:'center' }}>
            <div style={{ marginBottom:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <m.Icon size={16} style={{ color:cfg.color, opacity:.7 }}/>
            </div>
            <div style={{ fontSize:22, fontWeight:900, color:cfg.color, lineHeight:1 }}>—</div>
            <div style={{ fontSize:11, color:`${C.cream}77`, marginTop:5, fontWeight:700 }}>{m.label}</div>
            <div style={{ fontSize:10, color:`${C.cream}33`, marginTop:2 }}>{m.note}</div>
          </div>
        ))}
      </div>

      {/* Connect notice */}
      <div style={{ background:`${cfg.color}08`, border:`1px solid ${cfg.color}28`, borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'flex-start', gap:12 }}>
        <FaKey size={16} style={{ color:cfg.color, opacity:.7, flexShrink:0, marginTop:2 }}/>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:C.cream, marginBottom:4 }}>חיבור API לנתונים חיים</div>
          <div style={{ fontSize:12, color:`${C.cream}66`, lineHeight:1.7 }}>
            כדי להציג נתונים חיים ישירות כאן, נדרש חיבור API של {cfg.name}.
            לחץ על "פתח לוח בקרה" כדי לצפות בנתונים המלאים במערכת המקורית.
          </div>
        </div>
      </div>

      {/* Quick deep-links */}
      <div>
        <div style={{ fontSize:12, fontWeight:700, color:`${C.cream}66`, marginBottom:10, letterSpacing:'.05em', textTransform:'uppercase' }}>קיצורי דרך</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {cfg.deepLinks.map((dl,i) => (
            <a key={i} href={`${cfg.url.replace(/\/[^/]*$/, '/')}${dl.path}`} target="_blank" rel="noopener noreferrer"
              style={{ padding:'8px 16px', background:cardBg, border:`1px solid ${cfg.color}30`, borderRadius:8, color:C.cream, fontSize:12, fontWeight:600, textDecoration:'none', transition:'all .2s' }}
              onMouseEnter={e=>{ e.currentTarget.style.background=`${cfg.color}18`; e.currentTarget.style.borderColor=`${cfg.color}66` }}
              onMouseLeave={e=>{ e.currentTarget.style.background=cardBg; e.currentTarget.style.borderColor=`${cfg.color}30` }}>
              {dl.label} ↗
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── META MARKETING API ──────────────────────────────────────────────────────
const META_BUSINESS_ID = '13184732626344484'

function MetaMarketingLive() {
  const { C, isDark } = useTheme()
  const cardBg = isDark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)'
  const [token]         = useState(() => localStorage.getItem(META_TOKEN_KEY) || META_TOKEN_DEFAULT)
  const [accounts, setAccounts] = useState([])
  const [insights, setInsights] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [selAccount, setSelAccount] = useState(null)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch(`https://graph.facebook.com/v25.0/${META_BUSINESS_ID}/owned_ad_accounts?fields=id,name,account_status,currency,spend_cap,amount_spent&access_token=${token}`)
      const d = await r.json()
      if (d.error) { setError(d.error.message); setLoading(false); return }
      const list = d.data || []
      setAccounts(list)
      if (list.length > 0) {
        const acc = list[0]
        setSelAccount(acc)
        await loadInsights(acc.id)
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const loadInsights = async (accountId) => {
    try {
      const r = await fetch(`https://graph.facebook.com/v25.0/${accountId}/insights?fields=spend,impressions,clicks,cpc,ctr,reach,conversions&date_preset=last_30d&access_token=${token}`)
      const d = await r.json()
      if (d.data?.[0]) setInsights(d.data[0])
    } catch {}
  }

  useEffect(() => { load() }, [])

  const fmt = (n, prefix='') => n ? `${prefix}${Number(n).toLocaleString('he-IL', { maximumFractionDigits:2 })}` : '—'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', background:'rgba(24,119,242,.08)', border:'1px solid rgba(24,119,242,.25)', borderRadius:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <FaFacebookF size={20} style={{ color:'#1877F2' }}/>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:C.cream }}>Meta Marketing API</div>
            <div style={{ fontSize:11, color:`${C.cream}55` }}>Business ID: {META_BUSINESS_ID}</div>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          style={{ padding:'7px 16px', background:'rgba(24,119,242,.15)', border:'1px solid rgba(24,119,242,.35)', borderRadius:8, color:'#1877F2', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', opacity:loading?.5:1 }}>
          {loading ? '...' : '↺ רענן'}
        </button>
      </div>

      {error && <div style={{ background:'rgba(224,82,82,.1)', border:'1px solid rgba(224,82,82,.3)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'#E05252' }}>{error}</div>}

      {/* Ad Accounts */}
      {accounts.length > 0 && (
        <div style={{ background:cardBg, border:`1px solid ${C.purple}20`, borderRadius:14, padding:'14px 16px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:`${C.cream}66`, marginBottom:10, letterSpacing:'.05em', textTransform:'uppercase' }}>חשבונות פרסום ({accounts.length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {accounts.map((acc,i) => (
              <div key={i} onClick={() => { setSelAccount(acc); loadInsights(acc.id) }}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:selAccount?.id===acc.id?`${C.purple}14`:'rgba(255,255,255,.02)', border:`1px solid ${selAccount?.id===acc.id?C.purple+'44':C.purple+'12'}`, borderRadius:9, cursor:'pointer' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:acc.account_status===1?'#22C55E':'#E05252', flexShrink:0 }}/>
                <span style={{ fontSize:13, fontWeight:600, color:C.cream, flex:1 }}>{acc.name}</span>
                <span style={{ fontSize:11, color:`${C.cream}44`, fontFamily:'monospace' }}>{acc.id}</span>
                {acc.amount_spent && <span style={{ fontSize:11, color:'#F7C948', fontWeight:700 }}>${fmt(Number(acc.amount_spent)/100)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:10 }}>
          {[
            { label:'הוצאה (30 יום)', value:`$${fmt(insights.spend)}`, color:'#F7C948', Icon:FaDollarSign },
            { label:'חשיפות',          value:fmt(insights.impressions), color:'#1877F2', Icon:FaEye },
            { label:'קליקים',          value:fmt(insights.clicks),      color:C.purple,  Icon:FaMousePointer },
            { label:'עלות לקליק',      value:`$${fmt(insights.cpc)}`,   color:'#E05252', Icon:FaChartLine },
            { label:'CTR',             value:`${fmt(insights.ctr)}%`,   color:'#22C55E', Icon:FaBolt },
            { label:'הגעה',            value:fmt(insights.reach),       color:'#833ab4', Icon:FaUsers },
          ].map((m,i) => (
            <div key={i} style={{ background:cardBg, border:`1px solid ${m.color}28`, borderRadius:12, padding:'14px 12px', textAlign:'center' }}>
              <div style={{ marginBottom:7, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <m.Icon size={15} style={{ color:m.color }}/>
              </div>
              <div style={{ fontSize:20, fontWeight:900, color:m.color, lineHeight:1 }}>{m.value}</div>
              <div style={{ fontSize:11, color:`${C.cream}55`, marginTop:5, fontWeight:700 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && accounts.length === 0 && !error && (
        <div style={{ textAlign:'center', padding:32, color:`${C.cream}44`, fontSize:12 }}>
          לא נמצאו חשבונות פרסום עבור Business ID זה<br/>
          <span style={{ fontSize:11, color:`${C.cream}33` }}>ודא שהטוקן כולל הרשאת ads_read</span>
        </div>
      )}

      {/* Quick link */}
      <a href="https://adsmanager.facebook.com" target="_blank" rel="noopener noreferrer"
        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'11px', background:'rgba(24,119,242,.08)', border:'1px solid rgba(24,119,242,.22)', borderRadius:10, color:'#1877F2', fontWeight:700, fontSize:13, textDecoration:'none' }}>
        פתח Meta Ads Manager ↗
      </a>
    </div>
  )
}

// ─── ANALYTICS DASHBOARD ─────────────────────────────────────────────────────
function AnalyticsDashboard({ leads }) {
  const { C, isDark } = useTheme()
  const [events, setEvents] = useState([])
  const [refreshTs, setRefreshTs] = useState(0)
  const [analyticsTab, setAnalyticsTab] = useState('site')

  useEffect(() => {
    const load = () => {
      try { setEvents(JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]')) } catch {}
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [refreshTs])

  const now = Date.now()
  const todayStart = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime() })()
  const weekAgo = now - 7 * 86400000

  const sessions     = events.filter(e => e.n === 'session_start')
  const todaySess    = sessions.filter(e => e.t >= todayStart)
  const weekSess     = sessions.filter(e => e.t >= weekAgo)
  const propViews    = events.filter(e => e.n === 'property_view')
  const contacts     = events.filter(e => e.n === 'contact_form')
  const waClicks     = events.filter(e => e.n === 'whatsapp_click')
  const phoneClicks  = events.filter(e => e.n === 'phone_click')

  // Source breakdown
  const srcMap = {}
  sessions.forEach(e => { const s = e.source || 'ישיר'; srcMap[s] = (srcMap[s]||0)+1 })
  const srcList = Object.entries(srcMap).sort(([,a],[,b]) => b-a).slice(0,6)

  // Device breakdown
  const devMap = { mobile:0, tablet:0, desktop:0 }
  sessions.forEach(e => { if (e.device) devMap[e.device] = (devMap[e.device]||0)+1 })

  // 7-day bar chart
  const days7 = Array.from({ length:7 }, (_,i) => {
    const d = new Date(now - (6-i)*86400000); d.setHours(0,0,0,0)
    const ds = d.getTime()
    const de = ds + 86400000
    const cnt = sessions.filter(e => e.t >= ds && e.t < de).length
    const label = i===6 ? 'היום' : d.toLocaleDateString('he-IL', { weekday:'short' })
    return { label, cnt }
  })
  const maxCnt = Math.max(...days7.map(d => d.cnt), 1)

  // Top properties
  const propCounts = {}
  propViews.forEach(e => { if (e.title) propCounts[e.title] = (propCounts[e.title]||0)+1 })
  const topProps = Object.entries(propCounts).sort(([,a],[,b]) => b-a).slice(0,5)

  // Conversion rate
  const convRate = sessions.length > 0 ? Math.round(((contacts.length + waClicks.length) / sessions.length) * 100) : 0

  const src6Colors = [C.purple, C.green, '#F7C948', '#FF6B6B', '#60D4F7', '#E17BFF']

  const atBtn = (id, label) => (
    <button onClick={() => setAnalyticsTab(id)}
      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'none', borderBottom:`2px solid ${analyticsTab===id?C.purple:'transparent'}`, background:'transparent', color:analyticsTab===id?C.purple:`${C.cream}55`, fontFamily:'inherit', cursor:'pointer', fontSize:12, fontWeight:analyticsTab===id?800:500, whiteSpace:'nowrap', transition:'all .2s' }}>
      {label}
    </button>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* ── Platform sub-tabs ── */}
      <div style={{ display:'flex', gap:0, borderBottom:`1px solid ${C.purple}22`, overflowX:'auto', marginBottom:-6 }}>
        {atBtn('site',      'האתר שלנו')}
        {atBtn('ga4',       'Google Analytics')}
        {atBtn('meta',      'Meta / Facebook')}
        {atBtn('instagram', 'Instagram')}
        {atBtn('logrocket', 'LogRocket')}
        {atBtn('marketing', 'Meta Ads')}
      </div>

      {analyticsTab !== 'site' && (
        (analyticsTab === 'meta' || analyticsTab === 'instagram')
          ? <MetaGraphLive tab={analyticsTab}/>
          : analyticsTab === 'marketing'
          ? <MetaMarketingLive/>
          : <PlatformSection tab={analyticsTab} C={C} isDark={isDark}/>
      )}

      {analyticsTab === 'site' && <>
      {/* ── Top KPI Row ── */}
      <div className="admin-analytics-kpi" style={{ display:'grid', gap:10 }}>
        {[
          { label:'סשנים היום',   value:todaySess.length,   color:C.purple,    Icon:FaUser,       sub:'כניסות ייחודיות' },
          { label:'סשנים השבוע',  value:weekSess.length,    color:C.green,     Icon:FaChartLine,  sub:'7 ימים אחרונים' },
          { label:'צפיות נכסים',  value:propViews.length,   color:'#F7C948',   Icon:FaHome,       sub:'סה"כ' },
          { label:'המרות',        value:`${convRate}%`,     color:'#FF6B6B',   Icon:FaBalanceScale, sub:'פניות / סשנים' },
        ].map((k,i) => (
          <div key={i} style={{ background:`${k.color}10`, border:`1px solid ${k.color}35`, borderRadius:14, padding:'16px 14px', textAlign:'center' }}>
            <div style={{ marginBottom:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <k.Icon size={18} style={{ color:k.color }}/>
            </div>
            <div style={{ fontSize:26, fontWeight:900, color:k.color, lineHeight:1 }}>{k.value}</div>
            <div style={{ fontSize:11, color:`${C.cream}80`, marginTop:5, fontWeight:700 }}>{k.label}</div>
            <div style={{ fontSize:10, color:`${C.cream}40`, marginTop:2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Secondary KPI Row ── */}
      <div className="admin-analytics-kpi" style={{ display:'grid', gap:10 }}>
        {[
          { label:'טפסי יצירת קשר', value:contacts.length,    color:'#FF6B6B', Icon:FaEnvelope },
          { label:'קליקי WhatsApp',  value:waClicks.length,    color:'#25D366', Icon:FaWhatsapp },
          { label:'קליקי טלפון',     value:phoneClicks.length, color:C.green,   Icon:FaPhone },
          { label:'סה"כ לידים CRM',  value:leads.length,       color:C.purple,  Icon:FaUsers },
        ].map((k,i) => (
          <div key={i} style={{ background:`${k.color}0A`, border:`1px solid ${k.color}28`, borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
            <k.Icon size={17} style={{ color:k.color, flexShrink:0 }}/>
            <div>
              <div style={{ fontSize:20, fontWeight:900, color:k.color, lineHeight:1 }}>{k.value}</div>
              <div style={{ fontSize:10, color:`${C.cream}55`, marginTop:2, fontWeight:600 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 7-day chart ── */}
      <div style={{ background:'rgba(255,255,255,.03)', borderRadius:14, padding:'16px 18px', border:`1px solid ${C.purple}18` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.cream }}>ביקורים — 7 ימים אחרונים</div>
          <div style={{ fontSize:11, color:`${C.cream}44` }}>סשנים ייחודיים</div>
        </div>
        <svg viewBox="0 0 490 100" style={{ width:'100%', height:100, direction:'ltr', overflow:'visible' }}>
          <line x1="0" y1="78" x2="490" y2="78" stroke={`${C.cream}12`} strokeWidth="1"/>
          {days7.map((d,i) => {
            const bw = 52, gap = (490 - 7*bw)/6
            const x = i*(bw+gap)
            const bh = Math.max((d.cnt/maxCnt)*62, d.cnt > 0 ? 4 : 0)
            const by = 78 - bh
            return (
              <g key={i}>
                <rect x={x} y={by} width={bw} height={bh} rx={5}
                  fill={i===6 ? C.purple : `${C.purple}50`}
                  style={{ transition:'height .6s, y .6s' }}/>
                <text x={x+bw/2} y={94} textAnchor="middle" fill={`${C.cream}55`} fontSize="9.5" fontFamily="Rubik,sans-serif">{d.label}</text>
                {d.cnt > 0 && <text x={x+bw/2} y={by-4} textAnchor="middle" fill={i===6?C.purple:`${C.cream}77`} fontSize="10" fontWeight="700" fontFamily="Rubik,sans-serif">{d.cnt}</text>}
              </g>
            )
          })}
        </svg>
      </div>

      {/* ── Sources + Devices row ── */}
      <div className="admin-overview-bottom" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

        {/* Traffic Sources */}
        <div style={{ background:'rgba(255,255,255,.03)', borderRadius:14, padding:'16px 18px', border:`1px solid ${C.purple}18` }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.cream, marginBottom:14 }}>מקורות טראפיק</div>
          {srcList.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
              {srcList.map(([src,cnt],i) => {
                const pct = sessions.length > 0 ? Math.round((cnt/sessions.length)*100) : 0
                return (
                  <div key={i}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:12, color:C.cream, fontWeight:600 }}>{src}</span>
                      <span style={{ fontSize:11, color:`${C.cream}55` }}>{cnt} · {pct}%</span>
                    </div>
                    <div style={{ height:6, background:'rgba(255,255,255,.08)', borderRadius:3 }}>
                      <div style={{ height:6, width:`${pct}%`, background:src6Colors[i], borderRadius:3, transition:'width 1s ease' }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign:'center', color:`${C.cream}30`, fontSize:12, padding:'20px 0', lineHeight:1.7 }}>
              אין נתונים עדיין<br/>
              <span style={{ fontSize:10 }}>יצטברו בביקורים הבאים</span>
            </div>
          )}
        </div>

        {/* Devices */}
        <div style={{ background:'rgba(255,255,255,.03)', borderRadius:14, padding:'16px 18px', border:`1px solid ${C.purple}18` }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.cream, marginBottom:14 }}>סוג מכשיר</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'מובייל',  key:'mobile',  Icon:FaMobileAlt, color:'#60D4F7' },
              { label:'דסקטופ',  key:'desktop', Icon:FaDesktop,   color:C.purple },
              { label:'טאבלט',   key:'tablet',  Icon:FaTabletAlt, color:'#E17BFF' },
            ].map(d => {
              const pct = sessions.length > 0 ? Math.round((devMap[d.key]/sessions.length)*100) : 0
              return (
                <div key={d.key} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <d.Icon size={16} style={{ color:d.color, flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ fontSize:12, color:C.cream, fontWeight:600 }}>{d.label}</span>
                      <span style={{ fontSize:11, color:`${C.cream}55` }}>{devMap[d.key]} ({pct}%)</span>
                    </div>
                    <div style={{ height:6, background:'rgba(255,255,255,.08)', borderRadius:3 }}>
                      <div style={{ height:6, width:`${pct}%`, background:d.color, borderRadius:3 }}/>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {sessions.length > 0 && (
            <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label:'WhatsApp', v:waClicks.length, c:'#25D366', Icon:FaWhatsapp },
                { label:'טלפון',    v:phoneClicks.length, c:C.green, Icon:FaPhone },
              ].map((d,i) => (
                <div key={i} style={{ background:`${d.c}0C`, border:`1px solid ${d.c}28`, borderRadius:9, padding:'8px 10px', textAlign:'center' }}>
                  <d.Icon size={14} style={{ color:d.c }}/>
                  <div style={{ fontSize:18, fontWeight:800, color:d.c, lineHeight:1.2 }}>{d.v}</div>
                  <div style={{ fontSize:10, color:`${C.cream}44`, marginTop:2 }}>{d.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Top Properties ── */}
      {topProps.length > 0 && (
        <div style={{ background:'rgba(255,255,255,.03)', borderRadius:14, padding:'16px 18px', border:`1px solid ${C.purple}18` }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.cream, marginBottom:12 }}>נכסים שנצפו הכי הרבה</div>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {topProps.map(([title,cnt],i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 14px', background:'rgba(255,255,255,.03)', borderRadius:9, border:`1px solid ${C.purple}12` }}>
                <span style={{ fontSize:14, fontWeight:900, color:C.purple, minWidth:22, textAlign:'center' }}>#{i+1}</span>
                <span style={{ fontSize:13, color:C.cream, flex:1 }}>{title}</span>
                <span style={{ fontSize:12, color:C.purple, fontWeight:700, background:`${C.purple}18`, padding:'3px 12px', borderRadius:20, flexShrink:0 }}>{cnt} צפיות</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── External Platforms ── */}
      <div style={{ background:'rgba(255,255,255,.03)', borderRadius:14, padding:'16px 18px', border:`1px solid ${C.purple}18` }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.cream, marginBottom:14 }}>לוחות בקרה חיצוניים</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:9 }}>
          {[
            { label:'Google Analytics',   sub:'G-X1S3XX7TRV',            Icon:FaChartBar,   color:'#FF6B35', url:'https://analytics.google.com' },
            { label:'Meta Business Suite', sub:'Pixel 1341264237748951',  Icon:FaFacebookF,  color:'#1877F2', url:'https://business.facebook.com' },
            { label:'Meta Events Manager', sub:'פיקסל ופרסומות',          Icon:FaBolt,       color:'#F7C948', url:'https://business.facebook.com/events_manager' },
            { label:'Facebook – אפיק הנחל', sub:'Profile page',           Icon:FaThumbsUp,   color:'#1877F2', url:'https://www.facebook.com/profile.php?id=61573376818745' },
            { label:'Instagram – afik.hanahal', sub:'@afik.hanahal',      Icon:FaInstagram,  color:'#E1306C', url:'https://www.instagram.com/afik.hanahal/' },
            { label:'LogRocket Sessions',  sub:'tkrebw/afik-hanahal',     Icon:FaVideo,      color:'#764ABC', url:'https://app.logrocket.com/tkrebw/afik-hanahal' },
          ].map((p,i) => (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', flexDirection:'column', gap:5, background:`${p.color}09`, border:`1px solid ${p.color}28`, borderRadius:11, padding:'12px 12px', textDecoration:'none', color:'inherit', transition:'all .2s', cursor:'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background=`${p.color}1A`; e.currentTarget.style.borderColor=`${p.color}55`; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background=`${p.color}09`; e.currentTarget.style.borderColor=`${p.color}28`; e.currentTarget.style.transform='' }}>
              <p.Icon size={16} style={{ color:p.color }}/>
              <div style={{ fontSize:12, fontWeight:700, color:C.cream, lineHeight:1.3 }}>{p.label}</div>
              <div style={{ fontSize:10, color:`${C.cream}40`, direction:'ltr' }}>{p.sub}</div>
            </a>
          ))}
        </div>
        <div style={{ marginTop:12, display:'flex', gap:16, flexWrap:'wrap' }}>
          {[
            { label:'✦ Meta Pixel פעיל', color:'#1877F2' },
            { label:'✦ GA4 פעיל', color:'#FF6B35' },
            { label:'✦ LogRocket מוגדר', color:'#764ABC' },
          ].map((b,i) => (
            <span key={i} style={{ fontSize:11, color:b.color, background:`${b.color}12`, padding:'3px 10px', borderRadius:20, border:`1px solid ${b.color}30`, fontWeight:700 }}>{b.label}</span>
          ))}
        </div>
      </div>

      {/* ── Footer: clear + refresh ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, color:`${C.cream}33` }}>
          {events.length} אירועים · {sessions.length} סשנים · עדכון כל 30 שניות
        </span>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setRefreshTs(r=>r+1)}
            style={{ padding:'7px 16px', background:`${C.purple}18`, border:`1px solid ${C.purple}44`, borderRadius:8, color:C.purple, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            ↻ רענן
          </button>
          <button onClick={() => { if(window.confirm('מחק את כל נתוני הניתוח המקומיים?')) { localStorage.removeItem(ANALYTICS_KEY); setEvents([]) } }}
            style={{ padding:'7px 14px', background:'rgba(224,82,82,.08)', border:'1px solid rgba(224,82,82,.22)', borderRadius:8, color:'#E05252', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            מחק נתונים
          </button>
        </div>
      </div>
      </>}
    </div>
  )
}

// ─── TEAM PERMISSIONS ────────────────────────────────────────────────────────
const TEAM_KEY = 'afik_team_v1'
const TEAM_ROLES = {
  admin:  { label:'מנהל',    color:'#E05252', desc:'גישה מלאה לכל הפונקציות' },
  editor: { label:'עורך',   color:'#F7C948', desc:'יכול לערוך נכסים ולראות לידים' },
  viewer: { label:'צופה',   color:'#60D4F7', desc:'צפייה בלבד — אין עריכה' },
}
function genToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2,'0')).join('')
}
function TeamTab({ C, isDark }) {
  const [team, setTeam]     = useState(() => { try { return JSON.parse(localStorage.getItem(TEAM_KEY)||'[]') } catch { return [] } })
  const [form, setForm]     = useState({ name:'', email:'', role:'editor' })
  const [copied, setCopied] = useState(null)
  const [err, setErr]       = useState('')

  const save = (next) => { setTeam(next); localStorage.setItem(TEAM_KEY, JSON.stringify(next)) }
  const add = () => {
    setErr('')
    if (!form.name.trim()) return setErr('נא להזין שם')
    if (!form.email.includes('@')) return setErr('כתובת אימייל לא תקינה')
    if (team.find(m => m.email === form.email.toLowerCase())) return setErr('חבר צוות זה כבר קיים')
    const member = {
      id: genToken().slice(0,12),
      name: form.name.trim(),
      email: form.email.toLowerCase().trim(),
      role: form.role,
      status: 'pending',
      token: genToken(),
      invitedAt: Date.now(),
      lastLogin: null,
    }
    save([...team, member])
    setForm({ name:'', email:'', role:'editor' })
  }
  const revoke = (id) => { if (window.confirm('להסיר חבר צוות זה?')) save(team.filter(m => m.id !== id)) }
  const changeRole = (id, role) => save(team.map(m => m.id === id ? { ...m, role } : m))
  const regenerate = (id) => save(team.map(m => m.id === id ? { ...m, token: genToken(), status: 'pending' } : m))
  const getInviteLink = (member) => `${window.location.origin}/dashboard?team_token=${member.token}`
  const copyLink = (member) => {
    navigator.clipboard.writeText(getInviteLink(member)).then(() => { setCopied(member.id); setTimeout(() => setCopied(null), 2500) })
  }

  const inp = { width:'100%', padding:'10px 14px', background:'rgba(255,255,255,.05)', border:`1px solid ${C.purple}33`, borderRadius:8, color:C.cream, fontSize:13, fontFamily:'inherit', outline:'none', direction:'rtl', boxSizing:'border-box' }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header info ── */}
      <div style={{ background:`${C.purple}0C`, border:`1px solid ${C.purple}28`, borderRadius:14, padding:'16px 18px', display:'flex', gap:14, alignItems:'flex-start' }}>
        <FaLock size={22} style={{ color:C.purple, flexShrink:0 }}/>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:C.cream, marginBottom:4 }}>ניהול הרשאות צוות</div>
          <div style={{ fontSize:12, color:`${C.cream}77`, lineHeight:1.7 }}>
            הזמן חברי צוות לפי תפקיד. כל חבר מקבל קישור ייחודי עם טוקן מאובטח.
            ניתן להסיר ולחדש הרשאות בכל עת. הנתונים מאוחסנים באופן מאובטח בדפדפן.
          </div>
        </div>
      </div>

      {/* ── Invite form ── */}
      <div style={{ background:'rgba(255,255,255,.03)', border:`1px solid ${C.purple}22`, borderRadius:14, padding:'18px 20px' }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.cream, marginBottom:14 }}>הזמנת חבר צוות חדש</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div>
            <label style={{ fontSize:11, color:`${C.cream}66`, display:'block', marginBottom:5, fontWeight:700 }}>שם מלא</label>
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="ישראל ישראלי" style={inp}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:`${C.cream}66`, display:'block', marginBottom:5, fontWeight:700 }}>כתובת אימייל</label>
            <input type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="user@example.com" style={{ ...inp, direction:'ltr' }}/>
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, color:`${C.cream}66`, display:'block', marginBottom:8, fontWeight:700 }}>תפקיד והרשאות</label>
          <div style={{ display:'flex', gap:8 }}>
            {Object.entries(TEAM_ROLES).map(([key,r]) => (
              <button key={key} onClick={() => setForm(f=>({...f,role:key}))}
                style={{ flex:1, padding:'10px 8px', border:`1.5px solid ${form.role===key?r.color:C.purple+'22'}`, borderRadius:9, background:form.role===key?`${r.color}18`:'transparent', color:form.role===key?r.color:`${C.cream}55`, fontFamily:'inherit', cursor:'pointer', fontSize:11, fontWeight:700, transition:'all .15s', textAlign:'center' }}>
                <div style={{ marginBottom:5, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {key==='admin'?<FaCrown size={13}/>:key==='editor'?<FaPencilAlt size={13}/>:<FaEye size={13}/>}
                </div>
                {r.label}
                <div style={{ fontSize:9, color:form.role===key?r.color:`${C.cream}33`, marginTop:2, fontWeight:500, lineHeight:1.3 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>
        {err && <div style={{ fontSize:12, color:'#E05252', marginBottom:10, fontWeight:600 }}>{err}</div>}
        <button onClick={add}
          style={{ padding:'11px 28px', background:C.purple, border:'none', borderRadius:9, color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'inherit', transition:'background .15s' }}
          onMouseEnter={e=>e.currentTarget.style.background='#6b77c4'}
          onMouseLeave={e=>e.currentTarget.style.background=C.purple}>
          שלח הזמנה →
        </button>
        <div style={{ marginTop:10, fontSize:11, color:`${C.cream}40`, lineHeight:1.7 }}>
          * הזמנה מייצרת קישור ייחודי לשיתוף ידני. ניתן לשלוח בווצאפ, אימייל, או כל ערוץ אחר.
          <br/>* לחיבור אמיתי עם אימייל / Google — יש לחבר שירות SMTP או Google Workspace.
        </div>
      </div>

      {/* ── Team list ── */}
      <div style={{ background:'rgba(255,255,255,.03)', border:`1px solid ${C.purple}22`, borderRadius:14, padding:'18px 20px' }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.cream, marginBottom:14 }}>
          חברי הצוות ({team.length})
        </div>

        {team.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0', color:`${C.cream}30`, fontSize:13 }}>
            אין חברי צוות עדיין — הזמן את הראשון ↑
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {team.map(m => {
              const role = TEAM_ROLES[m.role] || TEAM_ROLES.viewer
              const initials = m.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
              return (
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'rgba(255,255,255,.03)', borderRadius:10, border:`1px solid ${C.purple}15` }}>
                  {/* Avatar */}
                  <div style={{ width:40, height:40, borderRadius:'50%', background:`${role.color}22`, border:`2px solid ${role.color}55`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:14, fontWeight:800, color:role.color }}>
                    {initials}
                  </div>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:C.cream }}>{m.name}</span>
                      <span style={{ fontSize:10, fontWeight:700, color:role.color, background:`${role.color}18`, padding:'2px 8px', borderRadius:20, border:`1px solid ${role.color}30` }}>{role.label}</span>
                      <span style={{ fontSize:10, color:m.status==='active'?C.green:`${C.cream}44`, fontWeight:600 }}>
                        {m.status==='active'?'פעיל':'ממתין'}
                      </span>
                    </div>
                    <div style={{ fontSize:11, color:`${C.cream}55`, marginTop:2, direction:'ltr' }}>{m.email}</div>
                    <div style={{ fontSize:10, color:`${C.cream}33`, marginTop:2 }}>
                      הוזמן {new Date(m.invitedAt).toLocaleDateString('he-IL')}
                      {m.lastLogin && ` · כניסה אחרונה: ${new Date(m.lastLogin).toLocaleDateString('he-IL')}`}
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <select value={m.role} onChange={e => changeRole(m.id, e.target.value)}
                      style={{ padding:'5px 8px', background:'rgba(255,255,255,.06)', border:`1px solid ${C.purple}33`, borderRadius:6, color:`${C.cream}BB`, fontSize:11, fontFamily:'inherit', cursor:'pointer', outline:'none' }}>
                      {Object.entries(TEAM_ROLES).map(([k,r]) => <option key={k} value={k}>{r.label}</option>)}
                    </select>
                    <button onClick={() => copyLink(m)}
                      style={{ padding:'5px 10px', background:copied===m.id?`${C.green}22`:`${C.purple}14`, border:`1px solid ${copied===m.id?C.green:C.purple+'33'}`, borderRadius:6, color:copied===m.id?C.green:C.purple, fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'all .2s', whiteSpace:'nowrap' }}>
                      {copied===m.id?'הועתק':'קישור'}
                    </button>
                    <button onClick={() => regenerate(m.id)} title="חדש טוקן"
                      style={{ padding:'5px 8px', background:'rgba(247,201,72,.1)', border:'1px solid rgba(247,201,72,.25)', borderRadius:6, color:'#F7C948', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      ↻
                    </button>
                    <button onClick={() => revoke(m.id)}
                      style={{ padding:'5px 8px', background:'rgba(224,82,82,.08)', border:'1px solid rgba(224,82,82,.22)', borderRadius:6, color:'#E05252', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Security info ── */}
      <div style={{ background:'rgba(255,255,255,.02)', border:`1px solid ${C.purple}15`, borderRadius:12, padding:'14px 18px' }}>
        <div style={{ fontSize:12, fontWeight:700, color:`${C.cream}77`, marginBottom:8 }}>אבטחה וזכויות גישה</div>
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {[
            'כל חבר צוות מקבל טוקן ייחודי של 48 תווים — לא ניתן לנחש',
            'ניתן לבטל גישה בכל עת על ידי מחיקה או חידוש הטוקן',
            'גישת מנהל (Owner) — רק לבעל האתר עם הסיסמה הראשית',
            'לאינטגרציה עם Google Workspace / SMTP — יש לפנות לצוות הפיתוח',
          ].map((t,i) => (
            <div key={i} style={{ display:'flex', gap:8, fontSize:11, color:`${C.cream}55` }}>
              <span style={{ color:C.green, flexShrink:0 }}>✓</span> {t}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── TEAM TOKEN CHECK ─────────────────────────────────────────────────────────
function useTeamToken() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('team_token')
    if (!token) return
    try {
      const team = JSON.parse(localStorage.getItem(TEAM_KEY)||'[]')
      const member = team.find(m => m.token === token)
      if (member) {
        const updated = team.map(m => m.token===token ? { ...m, status:'active', lastLogin:Date.now() } : m)
        localStorage.setItem(TEAM_KEY, JSON.stringify(updated))
        sessionStorage.setItem('afik_team_session', JSON.stringify({ ...member, status:'active' }))
        window.history.replaceState({}, '', window.location.pathname)
      }
    } catch {}
  }, [])
}

function AdminTabLoader({ label = 'טוען...' }) {
  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'rgba(232,228,216,.4)', minHeight:300 }}>
      <div style={{ width:36, height:36, border:'3px solid rgba(132,144,216,.2)', borderTopColor:'#8490D8', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontSize:13, fontFamily:'Rubik,sans-serif' }}>טוען {label}...</span>
    </div>
  )
}

function AdminPanel({ properties, setProperties, stats, setStats, sharon, setSharon, govmapToken, setGovmapToken, onClose, onEditInWizard, standalone = false }) {
  const { C, isDark, lang, logoNavSize, setLogoNavSize } = useTheme()
  const initForm = () => {
    try { const d = JSON.parse(localStorage.getItem(ADMIN_DRAFT_KEY)); if (d) return { ...EMPTY_PROP, ...d } } catch {}
    return EMPTY_PROP
  }
  const [form, setForm]   = useState(initForm)
  const [editId, setEditId] = useState(null)
  const [err, setErr]     = useState('')
  const [tab, setTab]     = useState('props')
  const [adminNavOpen, setAdminNavOpen] = useState(false)
  const [listTab, setListTab] = useState('published')
  const propListRef = useRef(null)
  const [listCat, setListCat] = useState('all')
  const dragPropId       = useRef(null)
  const dragOverId       = useRef(null)
  const autoSaveTimer    = useRef(null)
  const [dragActive, setDragActive] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [propSyncing,    setPropSyncing]    = useState(false)
  const [propSyncError,  setPropSyncError]  = useState('')
  const [propSyncedAt,   setPropSyncedAt]   = useState(null)
  const [supabaseWarning, setSupabaseWarning] = useState('')

  // GovMap management panel state
  const [gmTab,    setGmTab]    = useState('map')   // 'map' | 'layers' | 'bg'
  const [gmLayers, setGmLayers] = useState(() => {
    const d = _cloudSettings.gmLayers
    if (d && typeof d === 'object') return Object.fromEntries(GM_LAYERS.map(l => [l.id, d[l.id] ?? l.on]))
    return Object.fromEntries(GM_LAYERS.map(l => [l.id, l.on]))
  })
  const [gmBg,    setGmBg]    = useState(() => _cloudSettings.gmBg || '2')
  const [gmSaved, setGmSaved] = useState(false)
  const [tokenDraft,   setTokenDraft]   = useState(govmapToken)
  const [tokenSaved,   setTokenSaved]   = useState(false)
  const [tokenSaving,  setTokenSaving]  = useState(false)
  const [tokenError,   setTokenError]   = useState('')
  // Sync tokenDraft if govmapToken arrives from API after AdminPanel is already open
  useEffect(() => { if (govmapToken && !tokenDraft) setTokenDraft(govmapToken) }, [govmapToken])
  function saveGmDefaults() {
    const base = API_BASE || ''
    fetch(`${base}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ gmLayers, gmBg }),
    }).then(() => { _cloudSettings = { ..._cloudSettings, gmLayers, gmBg } }).catch(() => {})
    setGmSaved(true); setTimeout(() => setGmSaved(false), 2000)
  }
  // Load cloud settings on mount and sync local state
  useEffect(() => {
    const base = API_BASE || ''
    fetch(`${base}/api/settings`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(cfg => {
        _cloudSettings = cfg
        if (cfg.gmLayers && typeof cfg.gmLayers === 'object')
          setGmLayers(Object.fromEntries(GM_LAYERS.map(l => [l.id, cfg.gmLayers[l.id] ?? l.on])))
        if (cfg.gmBg) setGmBg(cfg.gmBg)
        if (cfg.waSettings) setWaSt(s => ({ ...s, ...cfg.waSettings }))
        if (typeof cfg.crmWebhook === 'string') setCrmWebhook(cfg.crmWebhook)
      })
      .catch(() => {})
  }, [])

  // Check Supabase health on first open so admin knows if data is at risk
  useEffect(() => {
    const base = API_BASE || ''
    fetch(`${base}/api/properties/status`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      signal: AbortSignal.timeout(12000),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(s => {
        if (!s.supabaseConfigured) {
          setSupabaseWarning('⚠ Supabase לא מוגדר — חסרים SUPABASE_URL / SUPABASE_SERVICE_KEY ב-Render. כנס ל-Render → Environment ← הוסף את המשתנים.')
        } else if (!s.supabaseReachable) {
          const err = s.supabaseError ? ` (${s.supabaseError})` : ''
          setSupabaseWarning(`⚠ Supabase לא נגיש${err} — הפרויקט כנראה מושהה. כנס ל-supabase.com → הפרויקט שלך → לחץ "Restore Project" → המתן דקה ← רענן.`)
        }
      })
      .catch(() => {})
  }, [])

  // Auto-save while editing an existing property (3 s debounce, silent — no spinner)
  useEffect(() => {
    if (editId === null) return
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      if (form.title?.trim() && form.location?.trim()) {
        savePropSilent({ ...form, id: editId, updatedAt: Date.now() })
      }
    }, 3000)
    return () => clearTimeout(autoSaveTimer.current)
  }, [form, editId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [countersSaved,  setCountersSaved]  = useState(false)
  const [countersSaving, setCountersSaving] = useState(false)
  const [countersError,  setCountersError]  = useState('')
  const [countersSavedAt, setCountersSavedAt] = useState(null)

  const saveCounters = async () => {
    setCountersSaving(true)
    setCountersError('')
    try {
      const base = API_BASE || ''
      const r = await fetch(`${base}/api/stats`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
        body:    JSON.stringify({ stats, sharon }),
      })
      if (!r.ok) {
        const err = await r.text().catch(() => r.status)
        throw new Error(err)
      }
      setCountersSaved(true)
      setCountersSavedAt(new Date())
      setTimeout(() => setCountersSaved(false), 3500)
    } catch (e) {
      setCountersError('שגיאה בשמירה: ' + (e.message || 'בעיית תקשורת'))
      setTimeout(() => setCountersError(''), 6000)
    } finally {
      setCountersSaving(false)
    }
  }
  const [leads, setLeads]   = useState(() => { try { return JSON.parse(localStorage.getItem(LEADS_STORE) || '[]') } catch { return [] } })
  const [crmWebhook, setCrmWebhook] = useState(() => _cloudSettings.crmWebhook || '')
  const [webhookSaved, setWebhookSaved] = useState(false)
  const [waSt, setWaSt] = useState(() => ({ provider:'greenapi', delayMin:2, template:WA_DEFAULT_TEMPLATE, instanceId:'7107558519', apiUrl:'https://7107.api.greenapi.com', token:'191b9e9c4fc540f1ad25c8607389c0d689d15794f8094a0589', enabled:true, ...(_cloudSettings.waSettings || {}) }))
  const [waSaved, setWaSaved] = useState(false)
  const [waTesting, setWaTesting] = useState(false)
  const [waTestResult, setWaTestResult] = useState('')
  const [emailTesting, setEmailTesting] = useState(false)
  const [emailTestResult, setEmailTestResult] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [leadsSyncing, setLeadsSyncing] = useState(false)
  const [chats, setChats] = useState({})
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatContact, setChatContact] = useState(null)
  const [initialChatLead, setInitialChatLead] = useState(null)
  const [chatSearch, setChatSearch] = useState('')
  const [chatStatus, setChatStatus]   = useState(null)  // 'authorized'|'notAuthorized'|'error'
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newChatPhone, setNewChatPhone] = useState('')
  const chatPollRef = useRef(null)
  const chatScrollRef = useRef(null)
  const [selectedLead, setSelectedLead] = useState(null)
  const [leadSearch, setLeadSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [draggedLeadId, setDraggedLeadId] = useState(null)
  const [dragOverStatus, setDragOverStatus] = useState(null)
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [showIntegrations, setShowIntegrations] = useState(false)
  const [intTab, setIntTab] = useState('webhook')
  const [statusPopup, setStatusPopup] = useState(null) // { id, x, y, width }
  const [colOrder, setColOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('leadsColOrder')) || ['name','phone','email','property','date','ai','status'] }
    catch { return ['name','phone','email','property','date','ai','status'] }
  })
  const [colWidths, setColWidths] = useState(() => {
    try { return JSON.parse(localStorage.getItem('leadsColWidths')) || {} }
    catch { return {} }
  })
  const [dragColId, setDragColId] = useState(null)
  const [dragOverColId, setDragOverColId] = useState(null)
  const [customCols, setCustomCols] = useState(() => {
    try { return JSON.parse(localStorage.getItem('leadsCustomCols')) || [] }
    catch { return [] }
  })
  const [addColOpen, setAddColOpen] = useState(false)
  const [addColName, setAddColName] = useState('')
  const resizingColRef = useRef(null)
  const resizeStartXRef = useRef(0)
  const resizeStartWRef = useRef(0)
  const pendingDeletes  = useRef(new Set()) // IDs deleted locally, awaiting server confirmation

  const startColResize = (e, colId, defaultW) => {
    e.preventDefault(); e.stopPropagation()
    resizingColRef.current = colId
    resizeStartXRef.current = e.clientX
    resizeStartWRef.current = colWidths[colId] ? parseInt(colWidths[colId]) : defaultW
    const onMove = (mv) => {
      if (!resizingColRef.current) return
      const newW = Math.max(50, resizeStartWRef.current + mv.clientX - resizeStartXRef.current)
      setColWidths(prev => ({ ...prev, [resizingColRef.current]: newW }))
    }
    const onUp = () => {
      setColWidths(prev => { localStorage.setItem('leadsColWidths', JSON.stringify(prev)); return prev })
      resizingColRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const syncLeadsFromServer = () => {
    const base = API_BASE || ''
    if (!base || leadsSyncing) return
    setLeadsSyncing(true)
    fetch(`${base}/api/contacts`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(serverLeads => {
        if (!Array.isArray(serverLeads)) return

        // Retry any deletes that failed when Render was sleeping
        const deletedIds = getDeletedIds()
        deletedIds.forEach(id => {
          if (serverLeads.some(s => String(s.id) === id)) {
            fetch(`${base}/api/contacts/${id}`, {
              method: 'DELETE', headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
            }).then(r => { if (r.ok) clearDeletedId(id) }).catch(() => {})
          } else {
            clearDeletedId(id) // already gone from server
          }
        })

        setLeads(prev => {
          const localById = new Map(prev.map(l => [String(l.id), l]))
          const freshDeletedIds = getDeletedIds()
          // Never restore leads that are mid-delete OR persisted as deleted across page refreshes
          const fromServer = serverLeads.filter(s =>
            !pendingDeletes.current.has(String(s.id)) && !freshDeletedIds.has(String(s.id))
          ).map(s => {
            const local = localById.get(String(s.id)) || {}
            return {
              id: String(s.id),
              name: s.name || '',
              phone: s.phone || '',
              email: s.email || '',
              msg: s.message || s.msg || '',
              propTitle: s.prop_title || '',
              propLocation: s.prop_location || '',
              source: s.source || 'website',
              leadStatus: s.lead_status || local.leadStatus || 'new',
              ts: new Date(s.created_at || Date.now()).getTime(),
              // Preserve locally-generated enrichment (AI analysis, etc.)
              ...(local.enrichment ? { enrichment: local.enrichment } : {}),
              ...(local.aiScore   ? { aiScore:   local.aiScore   } : {}),
            }
          }).sort((a, b) => b.ts - a.ts)
          // Also include leads that exist only locally (submitted during this session)
          const serverIds = new Set(serverLeads.map(s => String(s.id)))
          const localOnly = prev.filter(l => !serverIds.has(String(l.id)))
          const merged = [...localOnly, ...fromServer].sort((a, b) => b.ts - a.ts)
          try { localStorage.setItem(LEADS_STORE, JSON.stringify(merged)) } catch {}
          return merged
        })
      })
      .catch(() => {})
      .finally(() => setLeadsSyncing(false))
  }

  // Sync on admin mount + auto-sync every 60 s — cloud is always source of truth
  useEffect(() => {
    syncLeadsFromServer()
    const iv = setInterval(syncLeadsFromServer, 15000)
    return () => clearInterval(iv)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── WhatsApp CRM helpers ──────────────────────────────────────────────────
  const intlPhoneFmt = p => {
    const d = (p || '').replace(/\D/g, '')
    if (!d) return ''
    if (d.startsWith('972')) return d
    if (d.startsWith('0'))   return '972' + d.slice(1)
    return d
  }

  const fetchChats = useCallback(async (phone) => {
    if (!phone || !API_BASE) return
    const p = intlPhoneFmt(phone)
    if (!p) return
    try {
      const r = await fetch(`${API_BASE}/api/chats/${p}`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } })
      if (r.ok) {
        const msgs = await r.json()
        setChats(prev => ({ ...prev, [p]: msgs }))
      }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchChatStatus = useCallback(async () => {
    if (!API_BASE) return
    try {
      const r = await fetch(`${API_BASE}/api/chats/status`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }, signal: AbortSignal.timeout(8000) })
      if (r.ok) { const d = await r.json(); setChatStatus(d.state || null) }
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAllChats = useCallback(async () => {
    if (!API_BASE) return
    try {
      const r = await fetch(`${API_BASE}/api/chats/conversations`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }, signal: AbortSignal.timeout(10000) })
      if (!r.ok) return
      const convs = await r.json()
      if (!Array.isArray(convs)) return
      setChats(prev => {
        const next = { ...prev }
        for (const conv of convs) {
          const p = (conv.phone || '').replace(/D/g, '')
          if (!p) continue
          const normalised = p.startsWith('972') ? p : p.startsWith('0') ? '972' + p.slice(1) : p
          if (!next[normalised] || next[normalised].length === 0) {
            next[normalised] = [{ id: 'conv-' + normalised, phone: normalised, message: conv.lastMessage || '', direction: conv.lastDirection || 'in', created_at: conv.lastAt || new Date().toISOString() }]
          }
        }
        return next
      })
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sendChatMsg = async (lead) => {
    const msg = chatInput.trim()
    if (!msg || chatSending) return
    if (!API_BASE) { alert('שגיאה: VITE_API_URL לא מוגדר ב-Vercel'); return }
    const p = intlPhoneFmt(lead.phone)
    if (!p) { alert('מספר טלפון לא תקין'); return }
    setChatSending(true)
    try {
      const r = await fetch(`${API_BASE}/api/chats/send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
        body:    JSON.stringify({ phone: p, message: msg }),
        signal: AbortSignal.timeout(15000),
      })
      const text = await r.text()
      let data
      try { data = JSON.parse(text) } catch { data = { error: `שגיאת שרת: ${text.slice(0, 120)}` } }
      if (r.ok) { setChatInput(''); fetchChats(lead.phone) }
      else       alert('שגיאה בשליחה: ' + (data.error || 'שגיאה לא ידועה'))
    } catch (e) {
      if (e.name === 'TimeoutError') alert('timeout — הבקשה לקחה יותר מדי זמן')
      else alert('שגיאה בשליחה: ' + e.message)
    } finally {
      setChatSending(false)
    }
  }

  const LEAD_STATUS = {
    new:         { label: 'ליד חדש',   en: 'New Lead',    color: C.purple },
    contacted:   { label: 'ניצור קשר', en: 'Contacted',   color: '#579BFC' },
    discovery:   { label: 'גילוי',     en: 'Discovery',   color: '#A25DDC' },
    negotiating: { label: 'במו"מ',     en: 'Negotiating', color: '#FDBC64' },
    won:         { label: '✓ סגירה',   en: 'Won',         color: '#00C875' },
    lost:        { label: 'ללא מענה',  en: 'Lost',        color: '#7D7D7D' },
  }

  const updateLeadStatus = (lead, status) => {
    updateLead(lead.id, { leadStatus: status })
    const p = intlPhoneFmt(lead.phone)
    if (p && API_BASE) {
      fetch(`${API_BASE}/api/chats/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
        body:    JSON.stringify({ phone: p, status }),
      }).catch(() => {})
    }
  }

  const handleColDrop = (overId) => {
    if (!dragColId || dragColId === overId) return
    setColOrder(prev => {
      const next = [...prev]
      const fromIdx = next.indexOf(dragColId)
      const toIdx = next.indexOf(overId)
      if (fromIdx < 0 || toIdx < 0) return prev
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, dragColId)
      localStorage.setItem('leadsColOrder', JSON.stringify(next))
      return next
    })
    setDragColId(null); setDragOverColId(null)
  }

  // Poll chats when a lead is selected
  useEffect(() => {
    if (chatPollRef.current) { clearInterval(chatPollRef.current); chatPollRef.current = null }
    const phone = selectedLead?.phone
    if (!phone) return
    fetchChats(phone)
    chatPollRef.current = setInterval(() => fetchChats(phone), 12000)
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current) }
  }, [selectedLead?.id, fetchChats])

  // Poll chats for selected contact in the dedicated chat tab (every 3s)
  useEffect(() => {
    if (tab !== 'chats' || !chatContact?.phone) return
    fetchChats(chatContact.phone)
    const interval = setInterval(() => fetchChats(chatContact.phone), 500)
    return () => clearInterval(interval)
  }, [chatContact?.id, tab, fetchChats]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll all conversations list (sidebar last messages) every 8s when in chats tab
  useEffect(() => {
    if (tab !== 'chats') return
    fetchAllChats()
    const id = setInterval(fetchAllChats, 8000)
    return () => clearInterval(id)
  }, [tab, fetchAllChats]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch Green API status when chats tab opens
  useEffect(() => {
    if (tab !== 'chats') return
    fetchChatStatus()
    const id = setInterval(fetchChatStatus, 60000)
    return () => clearInterval(id)
  }, [tab, fetchChatStatus])

    // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [chats])

  const copyDashLink = () => {
    const url = `${window.location.origin}/dashboard`
    navigator.clipboard?.writeText(url).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2400)
    }).catch(() => {
      try { const el = document.createElement('textarea'); el.value = url; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el); setShareCopied(true); setTimeout(() => setShareCopied(false), 2400) } catch {}
    })
  }

  const CLAUDE_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

  const rewriteWithAI = async () => {
    setAiLoading(true); setAiError('')
    try {
      const catLabel = CATEGORIES.find(c => c.id === form.category)?.label || form.category
      const prompt = `אתה מומחה שיווק נדל"ן. כתוב תיאור שיווקי מקצועי ומשכנע לנכס הבא בעברית. \\nפרטים: סוג: ${catLabel} | שם: ${form.title || 'לא צוין'} | מיקום: ${[form.location,form.neighborhood].filter(Boolean).join(', ')||'לא צוין'} | מחיר: ${form.price ? '₪'+Number(form.price).toLocaleString('he-IL') : 'לא צוין'} | חדרים: ${form.rooms||'לא צוין'} | שטח: ${form.size ? form.size+' מ"ר' : form.dunams ? form.dunams+' דונם' : 'לא צוין'} | תיאור נוכחי: ${form.description || '(אין)'}\\nדרישות: 3-4 משפטים, שפה שיווקית מקצועית, הדגש יתרונות ייחודיים, אל תשתמש בביטויים כלליים. החזר רק את התיאור ללא הסברים.`
      const res = await fetch(`${API_BASE}/api/ai/messages`, {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'Authorization':     `Bearer ${ADMIN_TOKEN}`,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res.ok) { const err = await res.text(); throw new Error(err) }
      const data = await res.json()
      const text = data.content?.[0]?.text?.trim()
      if (text) setForm(f => ({ ...f, description: text }))
      else throw new Error('תגובה ריקה מה-AI')
    } catch (e) {
      setAiError('שגיאה: ' + (e.message || 'לא ניתן לתקשר עם ה-AI'))
    } finally {
      setAiLoading(false)
    }
  }

  const saveWA = () => {
    const base = API_BASE || ''
    fetch(`${base}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ waSettings: waSt }),
    }).then(() => { _cloudSettings = { ..._cloudSettings, waSettings: waSt } }).catch(() => {})
    setWaSaved(true); setTimeout(() => setWaSaved(false), 2500)
  }
  const testWA = async () => {
    setWaTesting(true); setWaTestResult('')
    // Test both client-side (browser→Green API) and server-side (Render→Green API)
    try {
      // 1. client-side
      await sendWhatsAppLead({ name:'בדיקה', phone:'0559811814', msg:'הודעת בדיקה מהמערכת' }, { ...waSt, enabled:true })
      setWaTestResult('ok')
    } catch { setWaTestResult('err') }

    // 2. server-side — try the Render→Green API path and show its result
    if (API_BASE) {
      try {
        const r = await fetch(`${API_BASE}/api/contacts/test-wa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
          body: JSON.stringify({ phone: '0559811814' }),
          signal: AbortSignal.timeout(20000),
        })
        const j = await r.json()
        console.log('[test-wa server]', j)
        if (!j.ok) console.error('[test-wa server] error:', j.error)
        else console.log('[test-wa server] ✓ server-side WA send succeeded')
      } catch (e) { console.error('[test-wa server] fetch failed:', e.message) }
    }

    setWaTesting(false); setTimeout(() => setWaTestResult(''), 4000)
  }

  const testEmail = async () => {
    if (!API_BASE) { setEmailTestResult('err'); return }
    setEmailTesting(true); setEmailTestResult('')
    try {
      const r = await fetch(`${API_BASE}/api/contacts/test-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        signal: AbortSignal.timeout(15000),
      })
      const j = await r.json()
      setEmailTestResult(j.ok ? 'ok' : 'err')
      if (!j.ok) console.error('[test-email]', j.error)
    } catch (e) { setEmailTestResult('err'); console.error('[test-email]', e.message) }
    finally { setEmailTesting(false); setTimeout(() => setEmailTestResult(''), 5000) }
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.type==='checkbox' ? e.target.checked : e.target.value }))
  const setImg = imgs => setForm(f => ({ ...f, images:imgs }))

  useEffect(() => {
    try { localStorage.setItem(ADMIN_DRAFT_KEY, JSON.stringify(form)) } catch {}
  }, [form])

  const inp = { width:'100%', padding:'9px 12px', background: C.card, border:`1px solid ${C.purple}44`, borderRadius:6, color:C.cream, fontSize:13, fontFamily:'inherit', outline:'none', direction:'rtl', marginBottom:10, boxSizing:'border-box', colorScheme: 'dark' }
  const chk = (k, label) => (
    <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:`${C.cream}CC` }}>
      <input type="checkbox" checked={!!form[k]} onChange={set(k)} style={{ accentColor:C.purple }}/>
      {label}
    </label>
  )

  const catObj = CATEGORIES.find(c => c.id === form.category) || CATEGORIES[1]

  const changeCategory = cat => {
    const newType = CATEGORIES.find(c => c.id === cat)?.types[0] || ''
    setForm(f => ({ ...EMPTY_PROP, ...f, category:cat, type:newType, images:f.images }))
  }

  // ── Individual property save — PUT /api/properties/:id ────────────────────
  // Safe: only touches the ONE property being saved. Other properties untouched.
  // Retries up to 3 extra times (1 s → 2 s → 4 s) to survive Render cold-starts.
  const saveProp = async (prop) => {
    setPropSyncing(true)
    setPropSyncError('')
    const base = API_BASE || ''
    let lastErr = null
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
      try {
        const r = await fetch(`${base}/api/properties/${prop.id}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
          body:    JSON.stringify(prop),
          signal:  AbortSignal.timeout(15000),
        })
        if (!r.ok) throw new Error(await r.text().catch(() => String(r.status)))
        const body = await r.json().catch(() => ({}))
        if (body.storage === 'memory') {
          setPropSyncError('⚠ נשמר ב-RAM בלבד — Supabase לא זמין! הנתונים יאבדו אם השרת יתחיל מחדש')
        } else {
          setPropSyncedAt(new Date())
          setPropSyncError('')
        }
        setPropSyncing(false)
        return
      } catch (e) {
        lastErr = e
      }
    }
    setPropSyncError('שגיאת סנכרון: ' + (lastErr?.message || 'בעיית תקשורת') + ' — נסה שוב')
    setTimeout(() => setPropSyncError(''), 12000)
    setPropSyncing(false)
  }

  // Silent background save for reorder and auto-save (no spinner, 3 retries)
  const savePropSilent = async (prop) => {
    const base = API_BASE || ''
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)))
      try {
        const r = await fetch(`${base}/api/properties/${prop.id}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
          body:    JSON.stringify(prop),
          signal:  AbortSignal.timeout(15000),
        })
        if (r.ok) { setPropSyncedAt(new Date()); return }
      } catch {}
    }
  }

  // ── Individual property delete — DELETE /api/properties/:id ───────────────
  const deleteProp = async (id) => {
    const base = API_BASE || ''
    try {
      await fetch(`${base}/api/properties/${id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        signal:  AbortSignal.timeout(10000),
      })
    } catch {}
  }

  // ── Bulk sync — used for reorder and manual "sync all" button ─────────────
  const syncProps = async (nextProps) => {
    setPropSyncing(true)
    setPropSyncError('')
    const base = API_BASE || ''
    try {
      const r = await fetch(`${base}/api/properties/bulk`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
        body:    JSON.stringify(nextProps),
        signal:  AbortSignal.timeout(20000),
      })
      if (!r.ok) throw new Error(await r.text().catch(() => String(r.status)))
      const body = await r.json().catch(() => ({}))
      if (body.storage === 'memory') {
        setPropSyncError('⚠ נשמר ב-RAM בלבד — Supabase לא זמין! הנתונים יאבדו אם השרת יתחיל מחדש')
      } else {
        setPropSyncedAt(new Date())
      }
    } catch (e) {
      setPropSyncError('שגיאת סנכרון: ' + (e.message || 'בעיית תקשורת'))
      setTimeout(() => setPropSyncError(''), 8000)
    } finally {
      setPropSyncing(false)
    }
  }

  // ── Export all properties as JSON backup ───────────────────────────────────
  const exportProps = async () => {
    const base = API_BASE || ''
    try {
      const r = await fetch(`${base}/api/properties/export`, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) throw new Error(r.status)
      const blob = await r.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `properties-backup-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      // Fallback: build JSON from local state
      const json = JSON.stringify({ exportedAt: new Date().toISOString(), count: properties.length, properties }, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `properties-backup-${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const save = async (publish) => {
    if (!form.title.trim() || !form.location.trim()) { setErr('שם הנכס ועיר הם שדות חובה'); return }
    setErr('')
    const prop = { ...form, published: publish, updatedAt: Date.now() }
    if (editId !== null) {
      const saved = { ...prop, id: editId }
      setProperties(prev => prev.map(x => x.id===editId ? saved : x))
      setEditId(null)
      await saveProp(saved)
    } else {
      const newProp = { ...prop, id: Date.now() }
      setProperties(prev => [...prev, newProp])
      await saveProp(newProp)
    }
    localStorage.removeItem(ADMIN_DRAFT_KEY)
    setForm(EMPTY_PROP)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }
  const publish = id => {
    const updated = { ...properties.find(x => x.id===id), published:true, updatedAt: Date.now() }
    setProperties(prev => prev.map(x => x.id===id ? updated : x))
    saveProp(updated)
  }
  const unpublish = id => {
    const updated = { ...properties.find(x => x.id===id), published:false, updatedAt: Date.now() }
    setProperties(prev => prev.map(x => x.id===id ? updated : x))
    saveProp(updated)
  }
  const setStatus = (id, status) => {
    const updated = { ...properties.find(x => x.id===id), status }
    setProperties(prev => prev.map(x => x.id===id ? updated : x))
    saveProp(updated)
  }
  const startEdit = p => { setForm({...EMPTY_PROP, ...p}); setEditId(p.id); setTab('props') }
  const del = id => {
    if (!window.confirm('למחוק נכס זה?')) return
    setProperties(prev => prev.filter(x => x.id !== id))
    deleteProp(id)
  }

  const dup = id => {
    const src = properties.find(x => String(x.id) === String(id))
    if (!src) return
    const copy = { ...src, id: Date.now(), title: src.title + ' (עותק)', published: false, createdAt: new Date().toISOString() }
    setProperties(prev => [...prev, copy])
    saveProp(copy)
  }

  // Move dragPropId above/below dragOverId in the global properties array.
  // Uses individual PUT requests (no bulk delete risk) with sortOrder field.
  const reorderProps = () => {
    const fromId = dragPropId.current
    const toId   = dragOverId.current
    if (!fromId || !toId || fromId === toId) return
    const next = [...properties]
    const fi = next.findIndex(x => String(x.id) === String(fromId))
    const ti = next.findIndex(x => String(x.id) === String(toId))
    if (fi < 0 || ti < 0) return
    const [removed] = next.splice(fi, 1)
    next.splice(ti, 0, removed)
    const withOrder = next.map((p, i) => ({ ...p, sortOrder: i }))
    setProperties(withOrder)
    withOrder.forEach(p => savePropSilent(p))
  }

  const tabBtn = (id, label, badge) => (
    <button onClick={() => setTab(id)} style={{ padding:'10px 20px', border:'none', background:tab===id?`${C.purple}30`:'transparent', color:tab===id?C.purple:`${C.cream}65`, fontFamily:'inherit', cursor:'pointer', fontWeight:700, fontSize:14, borderRadius:9, transition:'all .15s', display:'flex', alignItems:'center', gap:7, boxShadow: tab===id ? `0 2px 10px ${C.purple}22` : 'none' }}>
      {label}
      {!!badge && <span style={{ background:C.green, color:'#09090F', borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:900, lineHeight:1.6 }}>{badge}</span>}
    </button>
  )

  const updateLead = (id, patch) => {
    setLeads(prev => {
      const next = prev.map(l => l.id === id ? { ...l, ...patch } : l)
      try { localStorage.setItem(LEADS_STORE, JSON.stringify(next)) } catch {}
      return next
    })
    // Auto-save lead_status to Supabase immediately
    if (patch.leadStatus !== undefined && API_BASE) {
      fetch(`${API_BASE}/api/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
        body: JSON.stringify({ lead_status: patch.leadStatus }),
      }).catch(() => {})
    }
  }

  const enrichLead = async (lead) => {
    if (lead.enrichment?.status === 'enriching') return
    updateLead(lead.id, { enrichment: { ...(lead.enrichment || {}), status: 'enriching' } })
    try {
      const phoneDigits = (lead.phone || '').replace(/\D/g, '')
      const phonePrefix = phoneDigits.startsWith('972') ? phoneDigits.slice(3, 5) : phoneDigits.startsWith('0') ? phoneDigits.slice(1, 3) : phoneDigits.slice(0, 2)
      const prompt = `You are a senior real-estate sales intelligence analyst specializing in the Israeli market.
Analyze this lead and return comprehensive research for a pre-call briefing. Be realistic, precise, and professional.

Lead data:
- Name: ${lead.name || 'Unknown'}
- Phone: ${lead.phone || 'N/A'} (2-digit prefix after 0: "${phonePrefix}")
- Email: ${lead.email || 'N/A'}
- Message: ${lead.msg || 'N/A'}
- Property interest: ${lead.propTitle || 'General inquiry'}
- Property location: ${lead.propLocation || 'N/A'}

Israeli landline prefix → city (use for estimatedCity):
02=Jerusalem, 03=Tel Aviv/Gush Dan, 04=Haifa/North, 08=South Israel, 09=Sharon region (Netanya/Ra'anana/Herzliya).
Mobile 050-058 = nationwide — use other signals for city.

Analyze name origin (Hebrew/Arabic/Russian/Ethiopian/Western) for age and background estimation.
Analyze email domain: gmail/yahoo/hotmail=consumer; company domain=professional, extract company.
Analyze message vocabulary and sentence structure for education level.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "score": <1-5 integer, 5=hottest>,
  "scoreReason": "<one concise line>",
  "intent": "<hot|warm|cold>",
  "estimatedAge": "<age range e.g. '35-45'>",
  "estimatedCity": "<city or region>",
  "estimatedBudget": "<e.g. '2-4M NIS' based on property price signals>",
  "education": "<תיכון|תואר ראשון|תואר שני|דוקטורט>",
  "profession": "<likely profession or industry in Hebrew>",
  "company": "<company name from email domain, else empty>",
  "role": "<specific role if detectable, else empty>",
  "linkedin": "<https://www.linkedin.com/search/results/people/?keywords=FIRSTNAME+LASTNAME>",
  "linkedinDirect": "<https://www.linkedin.com/in/firstname-lastname — transliterate Hebrew name to English>",
  "facebook": "<https://www.facebook.com/search/people/?q=FIRSTNAME+LASTNAME>",
  "google": "<https://www.google.com/search?q=FIRSTNAME+LASTNAME+ישראל>",
  "instagram": "<https://www.instagram.com/LIKELY_HANDLE or empty>",
  "talkingPoints": ["<talking point 1 in Hebrew — specific to their signals>", "<talking point 2>", "<talking point 3>"],
  "notes": "<3-4 sentence pre-call briefing in Hebrew: who this person likely is, motivation, urgency signals, best opening line>",
  "tags": ["<tag1>", "<tag2>", "<tag3>"]
}`
      const res = await fetch(`${API_BASE}/api/ai/messages`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${ADMIN_TOKEN}`, 'anthropic-version':'2023-06-01' },
        body: JSON.stringify({ model:'claude-haiku-4-5-20251001', max_tokens:1200, messages:[{ role:'user', content:prompt }] }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const raw = data.content?.[0]?.text?.trim() || ''
      const jsonStr = raw.startsWith('{') ? raw : raw.match(/\{[\s\S]*\}/)?.[0] || '{}'
      const enrich = JSON.parse(jsonStr)
      updateLead(lead.id, { enrichment: { ...enrich, status: 'done', enrichedAt: Date.now() } })
    } catch (e) {
      updateLead(lead.id, { enrichment: { ...(lead.enrichment || {}), status: 'error', error: e.message } })
    }
  }

  const enrichAllLeads = () => {
    leads.filter(l => !l.enrichment || l.enrichment.status === 'new' || l.enrichment.status === 'error')
      .forEach(l => enrichLead(l))
  }

  const deleteLead = id => {
    const sid = String(id)
    pendingDeletes.current.add(sid)
    persistDeletedId(sid) // survives page refresh — retry DELETE on next sync
    const next = leads.filter(l => l.id !== id)
    setLeads(next)
    if (selectedLead?.id === id) setSelectedLead(null)
    try { localStorage.setItem(LEADS_STORE, JSON.stringify(next)) } catch {}
    if (API_BASE) fetch(`${API_BASE}/api/contacts/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    }).then(r => {
      if (r.ok) { pendingDeletes.current.delete(sid); clearDeletedId(sid) }
    }).catch(() => {}) // stays in pendingDeletes + localStorage → retried on next sync
  }
  const clearLeads = () => {
    if (!window.confirm('למחוק את כל הלידים לצמיתות?')) return
    leads.forEach(l => { pendingDeletes.current.add(String(l.id)); persistDeletedId(String(l.id)) })
    setLeads([])
    setSelectedLead(null)
    try { localStorage.setItem(LEADS_STORE, '[]') } catch {}
    if (API_BASE) fetch(`${API_BASE}/api/contacts`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    }).then(r => { if (r.ok) { pendingDeletes.current.clear(); clearAllDeletedIds() } })
      .catch(() => {})
  }
  const exportCSV = () => {
    const header = ['תאריך','שם','טלפון','אימייל','הודעה','נכס','מיקום נכס','מקור','ציון','כוונה','גיל משוער','עיר משוערת','תקציב משוער','השכלה','מקצוע','חברה','תפקיד','LinkedIn חיפוש','LinkedIn ישיר','Facebook','Google','נקודות שיחה','ניתוח AI','תגיות']
    const rows = leads.map(l => {
      const en = l.enrichment || {}
      return [
        new Date(l.ts).toLocaleString('he-IL'),
        l.name || '', l.phone || '', l.email || '',
        (l.msg || '').replace(/"/g, '""'),
        l.propTitle || '', l.propLocation || '', l.source || '',
        en.score || '', en.intent || '',
        en.estimatedAge || '', en.estimatedCity || '', en.estimatedBudget || '',
        en.education || '', en.profession || '',
        en.company || '', en.role || '',
        en.linkedin || '', en.linkedinDirect || '', en.facebook || '', en.google || '',
        (en.talkingPoints || []).join(' | '),
        (en.notes || '').replace(/"/g, '""'),
        (en.tags || []).join(', '),
      ]
    })
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `leads-${new Date().toISOString().slice(0,10)}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const catBtn = (id, label, CatIcon) => (
    <button onClick={() => changeCategory(id)} style={{ flex:1, padding:'10px 8px', border:`1px solid ${form.category===id?C.purple:'rgba(132,144,216,.2)'}`, borderRadius:8, background:form.category===id?`${C.purple}20`:'transparent', color:form.category===id?C.purple:`${C.cream}80`, fontFamily:'inherit', cursor:'pointer', fontSize:11, fontWeight:600, transition:'all .15s', textAlign:'center' }}>
      <div style={{ marginBottom:4, display:'flex', justifyContent:'center' }}><CatIcon size={16}/></div>
      {label}
    </button>
  )

  const publishedList = properties.filter(p => p.published !== false)
  const draftList     = properties.filter(p => p.published === false)
  const baseList = listTab==='published' ? publishedList : draftList
  const filteredList = listCat==='all' ? baseList : baseList.filter(p => p.category===listCat)

  const goToLiveProps = () => {
    setTab('props')
    setListTab('published')
    setTimeout(() => propListRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 120)
  }

  const DASH_TABS = [
    { id:'overview', Icon:FaHome,        label:'סקירה כללית' },
    { id:'live',     Icon:FaCheckCircle, label:'באוויר',     badge: publishedList.length, live:true },
    { id:'props',    Icon:FaBuilding,    label:'ניהול נכסים' },
    { id:'leads',    Icon:FaHandshake,   label:'לידים',      badge: leads.length },
    { id:'chats',    Icon:FaWhatsapp,    label:'צ\'אטים',    badge: leads.filter(l=>l.phone).length },
    { id:'analytics',Icon:FaChartLine,   label:'אנליטיקס' },
    { id:'team',     Icon:FaKey,         label:'צוות' },
    { id:'counters', Icon:FaBalanceScale,label:'מונים' },
    { id:'settings', Icon:FaTools,       label:'הגדרות' },
  ]
  const TAB_LABELS = { overview:'סקירה כללית', live:'נכסים באוויר', props:'ניהול נכסים', leads:'לידים', chats:'שיחות WhatsApp', analytics:'אנליטיקס', team:'צוות', counters:'מונים', settings:'הגדרות' }

  return (
    <div style={standalone
      ? { position:'fixed', inset:0, zIndex:1000, display:'flex', background:'#07070F', direction:'rtl', fontFamily:'Rubik, sans-serif' }
      : { position:'fixed', inset:0, background:'rgba(0,0,0,.92)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16, overflowY:'auto', overscrollBehavior:'contain' }}>

      {/* ── MOBILE SIDEBAR OVERLAY — standalone only ──────────────────── */}
      {standalone && adminNavOpen && (
        <div className="admin-mobile-overlay" onClick={() => setAdminNavOpen(false)}/>
      )}

      {/* ── SIDEBAR — standalone only ─────────────────────────────────── */}
      {standalone && (
        <aside className={`admin-sidebar${adminNavOpen ? ' open' : ''}`} style={{ width:232, height:'100dvh', background:'linear-gradient(180deg,#0E0E1C 0%,#090910 100%)', borderLeft:'1px solid rgba(132,144,216,.1)', display:'flex', flexDirection:'column', flexShrink:0 }}>
          {/* Brand */}
          <div style={{ padding:'26px 20px 20px', borderBottom:'1px solid rgba(132,144,216,.07)' }}>
            <img src="/logo.svg" alt="אפיק הנחל" style={{ height:32, opacity:.85 }} onError={e => { e.currentTarget.style.display='none' }}/>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 8px rgba(34,197,94,.7)' }}/>
              <span style={{ fontSize:10, color:'rgba(232,228,216,.28)', letterSpacing:'.1em', textTransform:'uppercase' }}>Admin · Live</span>
            </div>
          </div>
          {/* Nav */}
          <nav style={{ flex:1, overflowY:'auto', padding:'12px 10px' }}>
            {DASH_TABS.map(item => {
              const isLive = item.id === 'live'
              const isActive = isLive ? (tab==='props' && listTab==='published') : tab===item.id
              return (
                <button key={item.id} onClick={() => { if (isLive) { goToLiveProps() } else { setTab(item.id) }; setAdminNavOpen(false) }}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 13px 10px 10px', border:'none', borderRight: isActive ? (isLive ? `2px solid #22C55E` : `2px solid ${C.purple}`) : '2px solid transparent', borderRadius:'0 8px 8px 0', background: isActive ? (isLive ? 'rgba(34,197,94,.1)' : `rgba(132,144,216,.12)`) : 'transparent', color: isActive ? (isLive ? '#22C55E' : C.purple) : 'rgba(232,228,216,.4)', cursor:'pointer', fontFamily:'inherit', fontSize:12.5, fontWeight: isActive ? 600 : 400, marginBottom:1, textAlign:'right', transition:'all .15s', letterSpacing:'.01em' }}
                  onMouseEnter={e=>{ if(!isActive){ e.currentTarget.style.background=isLive?'rgba(34,197,94,.06)':'rgba(132,144,216,.06)'; e.currentTarget.style.color=isLive?'rgba(34,197,94,.85)':'rgba(232,228,216,.68)' }}}
                  onMouseLeave={e=>{ if(!isActive){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(232,228,216,.4)' }}}>
                  <item.Icon size={13} style={{ flexShrink:0, opacity: isActive ? 1 : 0.7, color: isActive && isLive ? '#22C55E' : undefined }}/>
                  <span style={{ flex:1 }}>{item.label}</span>
                  {!!item.badge && <span style={{ background: isLive ? 'rgba(34,197,94,.2)' : `${C.purple}25`, color: isLive ? '#22C55E' : C.purple, borderRadius:4, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{item.badge}</span>}
                </button>
              )
            })}
          </nav>
          {/* Footer */}
          <div style={{ padding:'12px 10px 20px', borderTop:'1px solid rgba(132,144,216,.07)' }}>
            <button onClick={copyDashLink}
              style={{ width:'100%', padding:'10px 13px', border:`1px solid ${shareCopied ? 'rgba(34,197,94,.45)' : 'rgba(132,144,216,.28)'}`, borderRadius:8, background: shareCopied ? 'rgba(34,197,94,.1)' : `rgba(132,144,216,.1)`, color: shareCopied ? '#22C55E' : C.purple, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700, marginBottom:7, display:'flex', alignItems:'center', gap:8, transition:'all .2s' }}
              onMouseEnter={e=>{ if(!shareCopied){ e.currentTarget.style.borderColor='rgba(132,144,216,.55)'; e.currentTarget.style.background='rgba(132,144,216,.18)' }}}
              onMouseLeave={e=>{ if(!shareCopied){ e.currentTarget.style.borderColor='rgba(132,144,216,.28)'; e.currentTarget.style.background='rgba(132,144,216,.1)' }}}>
              <FaShareAlt size={12}/> <span>{shareCopied ? '✓ קישור הועתק!' : 'שתף למערכת'}</span>
            </button>
            <button onClick={() => window.open('/', '_blank')}
              style={{ width:'100%', padding:'10px 13px', border:'1px solid rgba(132,144,216,.14)', borderRadius:8, background:'transparent', color:'rgba(232,228,216,.38)', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, marginBottom:7, display:'flex', alignItems:'center', gap:8, transition:'all .15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(132,144,216,.32)'; e.currentTarget.style.color='rgba(232,228,216,.72)' }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(132,144,216,.14)'; e.currentTarget.style.color='rgba(232,228,216,.38)' }}>
              <FaGlobe size={12}/> <span>צפה באתר</span>
            </button>
            <button onClick={onClose}
              style={{ width:'100%', padding:'10px 13px', border:'1px solid rgba(224,82,82,.18)', borderRadius:8, background:'rgba(224,82,82,.05)', color:'rgba(224,82,82,.5)', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:8, transition:'all .15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(224,82,82,.38)'; e.currentTarget.style.color='rgba(224,82,82,.88)'; e.currentTarget.style.background='rgba(224,82,82,.1)' }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(224,82,82,.18)'; e.currentTarget.style.color='rgba(224,82,82,.5)'; e.currentTarget.style.background='rgba(224,82,82,.05)' }}>
              <FaTimes size={12}/> <span>יציאה</span>
            </button>
          </div>
        </aside>
      )}

      {/* ── MAIN PANE ─────────────────────────────────────────────────── */}
      <div className={`admin-main-pane${standalone ? '' : ' admin-panel-modal'}`} style={standalone
        ? { flex:1, display:'flex', flexDirection:'column', height:'100dvh', overflow:'hidden' }
        : (tab==='chats'||tab==='leads')
          ? { background:C.card, border:`1px solid ${C.purple}33`, borderRadius:16, padding:0, width:'100%', maxWidth:'98vw', height:'94vh', overflow:'hidden', direction:'rtl', boxShadow:'0 32px 80px rgba(0,0,0,.7)', display:'flex', flexDirection:'column' }
          : { background:C.card, border:`1px solid ${C.purple}33`, borderRadius:16, padding:28, width:'100%', maxWidth:1200, maxHeight:'94vh', overflowY:'auto', direction:'rtl', boxShadow:'0 32px 80px rgba(0,0,0,.7)' }}>

        {/* ── MOBILE TOP BAR — inside main pane ──────────────────────── */}
        {standalone && (
          <div className="admin-mobile-topbar">
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={() => setAdminNavOpen(v => !v)}
                style={{ background:'none', border:`1px solid rgba(132,144,216,.25)`, borderRadius:8, width:36, height:36, color:'rgba(232,228,216,.7)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:4 }}>
                <div style={{ width:16, height:1.5, background:'currentColor', borderRadius:1 }}/>
                <div style={{ width:16, height:1.5, background:'currentColor', borderRadius:1 }}/>
                <div style={{ width:16, height:1.5, background:'currentColor', borderRadius:1 }}/>
              </button>
            </div>
            <div style={{ fontSize:13, fontWeight:700, color:'rgba(232,228,216,.75)' }}>
              {DASH_TABS.find(t => t.id === tab)?.label || 'ניהול'}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              {saved && <span style={{ fontSize:10, color:'#22C55E', fontWeight:700, background:'rgba(34,197,94,.12)', padding:'2px 8px', borderRadius:10 }}>נשמר</span>}
              <button onClick={copyDashLink} title="שתף קישור למערכת"
                style={{ background: shareCopied ? 'rgba(34,197,94,.12)' : 'rgba(132,144,216,.1)', border:`1px solid ${shareCopied ? 'rgba(34,197,94,.35)' : 'rgba(132,144,216,.28)'}`, borderRadius:8, width:34, height:34, color: shareCopied ? '#22C55E' : C.purple, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }}>
                <FaShareAlt size={11}/>
              </button>
              <button onClick={onClose}
                style={{ background:'rgba(224,82,82,.08)', border:'1px solid rgba(224,82,82,.22)', borderRadius:8, width:34, height:34, color:'rgba(224,82,82,.7)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <FaTimes size={11}/>
              </button>
            </div>
          </div>
        )}

        {/* Standalone desktop top-bar */}
        {standalone && (
          <div className="admin-desktop-topbar" style={{ height:56, borderBottom:'1px solid rgba(132,144,216,.08)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 26px', flexShrink:0, background:'rgba(7,7,15,.82)', backdropFilter:'blur(20px)', direction:'rtl' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <h2 style={{ fontSize:15, fontWeight:800, color:'rgba(232,228,216,.86)', margin:0 }}>{TAB_LABELS[tab] || ''}</h2>
              {saved && <span style={{ fontSize:11, color:'#22C55E', fontWeight:700, background:'rgba(34,197,94,.1)', padding:'3px 10px', borderRadius:20, border:'1px solid rgba(34,197,94,.2)' }}>✓ נשמר</span>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button onClick={copyDashLink}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 13px', background: shareCopied ? 'rgba(34,197,94,.12)' : 'rgba(132,144,216,.1)', border:`1px solid ${shareCopied ? 'rgba(34,197,94,.4)' : 'rgba(132,144,216,.25)'}`, borderRadius:20, color: shareCopied ? '#22C55E' : C.purple, cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700, transition:'all .2s' }}
                onMouseEnter={e=>{ if(!shareCopied){ e.currentTarget.style.background='rgba(132,144,216,.2)'; e.currentTarget.style.borderColor='rgba(132,144,216,.5)' }}}
                onMouseLeave={e=>{ if(!shareCopied){ e.currentTarget.style.background='rgba(132,144,216,.1)'; e.currentTarget.style.borderColor='rgba(132,144,216,.25)' }}}>
                <FaShareAlt size={11}/>
                <span>{shareCopied ? '✓ הועתק!' : 'שתף'}</span>
              </button>
              <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(132,144,216,.08)', border:'1px solid rgba(132,144,216,.16)', borderRadius:24, padding:'6px 13px 6px 9px' }}>
                <div style={{ width:26, height:26, borderRadius:'50%', background:`${C.purple}25`, border:`1.5px solid ${C.purple}44`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <FaLock size={10} style={{ color:C.purple }}/>
                </div>
                <span style={{ fontSize:12, color:'rgba(232,228,216,.55)', fontWeight:600 }}>מנהל ראשי</span>
              </div>
            </div>
          </div>
        )}

        {/* Modal header */}
        {!standalone && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22, paddingBottom:18, borderBottom:`1px solid ${C.purple}22` }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:12, background:`${C.purple}22`, border:`1.5px solid ${C.purple}44`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <FaLock size={16} style={{ color:C.purple }}/>
              </div>
              <div>
                <h2 style={{ fontSize:20, fontWeight:900, color:C.cream, margin:0, letterSpacing:'.01em' }}>מערכת ניהול נכסים</h2>
                <div style={{ fontSize:12, color:`${C.cream}55`, marginTop:2 }}>אפיק הנחל — לשימוש פנימי בלבד</div>
              </div>
              {saved && <span style={{ fontSize:12, color:C.green, fontWeight:700, background:`${C.green}15`, padding:'4px 12px', borderRadius:20, border:`1px solid ${C.green}30` }}>✓ נשמר בהצלחה</span>}
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,.07)', border:`1px solid rgba(132,144,216,.25)`, borderRadius:10, width:38, height:38, color:`${C.cream}80`, cursor:'pointer', fontSize:18, lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }}
              onMouseEnter={e=>{ e.currentTarget.style.background='rgba(224,82,82,.2)'; e.currentTarget.style.borderColor='#E05252'; e.currentTarget.style.color='#E05252' }}
              onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,.07)'; e.currentTarget.style.borderColor='rgba(132,144,216,.25)'; e.currentTarget.style.color=`${C.cream}80` }}>×</button>
          </div>
        )}

        {/* Supabase health warning banner */}
        {supabaseWarning && (
          <div style={{ background:'rgba(224,82,82,.12)', border:'1px solid rgba(224,82,82,.35)', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10, direction:'rtl' }}>
            <FaExclamationTriangle size={15} style={{ color:'#E05252', flexShrink:0 }}/>
            <span style={{ fontSize:13, color:'#E05252', fontWeight:600 }}>{supabaseWarning}</span>
            <button onClick={() => setSupabaseWarning('')} style={{ marginRight:'auto', background:'none', border:'none', color:'rgba(224,82,82,.6)', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 4px' }}>×</button>
          </div>
        )}

        {/* Modal tabs */}
        {!standalone && (
          <div style={{ display:'flex', gap:4, marginBottom:24, background:'rgba(255,255,255,.04)', borderRadius:10, padding:4, flexWrap:'wrap' }}>
            {tabBtn('props', 'ניהול נכסים')}
            <button onClick={goToLiveProps}
              style={{ padding:'10px 16px', border:'none', background: tab==='props' && listTab==='published' ? 'rgba(34,197,94,.2)' : 'transparent', color: tab==='props' && listTab==='published' ? '#22C55E' : 'rgba(232,228,216,.65)', fontFamily:'inherit', cursor:'pointer', fontWeight:700, fontSize:14, borderRadius:9, transition:'all .15s', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 6px rgba(34,197,94,.8)', animation:'pulse 2s infinite', display:'inline-block' }}/>
              באוויר
              <span style={{ background:'rgba(34,197,94,.2)', color:'#22C55E', borderRadius:20, padding:'2px 7px', fontSize:11, fontWeight:900, lineHeight:1.6 }}>{publishedList.length}</span>
            </button>
            {tabBtn('leads', 'לידים', leads.length)}
            {tabBtn('chats', 'צ\'אטים')}
            {tabBtn('analytics', 'אנליטיקס')}
            {tabBtn('team', 'צוות')}
            {tabBtn('counters', 'מונים')}
            {tabBtn('settings', 'הגדרות')}
          </div>
        )}

        {/* ── Scrollable content ─────────────────────────────────────── */}
        <div className="admin-content" style={(tab==='chats'||tab==='leads') ? { flex:1, minHeight:0, overflow:'hidden', display:'flex', flexDirection:'column' } : standalone ? { flex:1, overflowY:'auto', padding:'22px 26px 32px', direction:'rtl' } : { padding:'22px 26px 32px', direction:'rtl' }}>

        {/* Overview tab — standalone only */}
        {tab==='overview' && standalone && (<>
          <div className="admin-overview-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:14, marginBottom:24 }}>
            {[
              { Icon:FaBuilding,  label:'נכסים פעילים',  value: properties.filter(p=>p.published!==false).length, sub:`מתוך ${properties.length} סה"כ`,          color:'#8490D8' },
              { Icon:FaFileAlt,   label:'טיוטות',          value: properties.filter(p=>p.published===false).length, sub:'ממתינות לפרסום',                          color:'#F7C948' },
              { Icon:FaUsers,     label:'לידים כולל',      value: leads.length,                                      sub:leads.filter(l=>Date.now()-l.ts<7*864e5).length+' השבוע', color:'#22C55E' },
              { Icon:FaFire,      label:'לידים חמים',      value: leads.filter(l=>l.enrichment?.intent==='hot').length, sub:'ציון AI: חם',                          color:'#F97316' },
              { Icon:FaRobot,     label:'WhatsApp Bot',    value:'פעיל', sub:'Meta API מחובר',                                                                       color:'#25D366' },
              { Icon:FaChartBar,  label:'Google Tag Mgr',  value:'פעיל', sub:'GTM-MZZ8QR8V',                                                                         color:'#FF6B35' },
            ].map((card,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,.03)', border:`1px solid ${card.color}22`, borderRadius:14, padding:'20px 18px 16px' }}>
                <div style={{ marginBottom:10 }}><card.Icon size={18} style={{ color:card.color }}/></div>
                <div style={{ fontSize:26, fontWeight:900, color:card.color, lineHeight:1 }}>{card.value}</div>
                <div style={{ fontSize:12, color:'rgba(232,228,216,.7)', fontWeight:700, marginTop:7 }}>{card.label}</div>
                <div style={{ fontSize:11, color:'rgba(232,228,216,.3)', marginTop:3 }}>{card.sub}</div>
              </div>
            ))}
          </div>
          <div className="admin-overview-bottom" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(132,144,216,.1)', borderRadius:14, padding:20 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'rgba(232,228,216,.75)', marginBottom:14 }}>לידים אחרונים</h3>
              {leads.slice(0,5).map((l,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 0', borderBottom:i<4?'1px solid rgba(255,255,255,.04)':'' }}>
                  <div style={{ width:30,height:30,borderRadius:'50%',background:'rgba(132,144,216,.14)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,color:'rgba(132,144,216,.8)',fontWeight:700,flexShrink:0 }}>{(l.name||'?')[0]}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:600,color:'rgba(232,228,216,.78)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{l.name||'ללא שם'}</div>
                    <div style={{ fontSize:10,color:'rgba(232,228,216,.3)' }}>{new Date(l.ts).toLocaleDateString('he-IL')}</div>
                  </div>
                  {l.enrichment?.intent && <span style={{ fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:10, background:l.enrichment.intent==='hot'?'rgba(249,115,22,.18)':l.enrichment.intent==='warm'?'rgba(247,201,72,.18)':'rgba(255,255,255,.07)', color:l.enrichment.intent==='hot'?'#F97316':l.enrichment.intent==='warm'?'#F7C948':'rgba(232,228,216,.45)' }}>{l.enrichment.intent}</span>}
                </div>
              ))}
              {leads.length===0 && <div style={{ fontSize:12,color:'rgba(232,228,216,.22)',textAlign:'center',padding:'18px 0' }}>אין לידים עדיין</div>}
              <button onClick={()=>setTab('leads')} style={{ marginTop:10,fontSize:11,color:'rgba(132,144,216,.65)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0,fontWeight:600 }}>צפה בכל הלידים ←</button>
            </div>
            <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(132,144,216,.1)', borderRadius:14, padding:20 }}>
              <h3 style={{ fontSize:13, fontWeight:700, color:'rgba(232,228,216,.75)', marginBottom:14 }}>נכסים אחרונים</h3>
              {[...properties].reverse().slice(0,5).map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 0', borderBottom:i<4?'1px solid rgba(255,255,255,.04)':'' }}>
                  <div style={{ width:30,height:30,borderRadius:6,background:'rgba(132,144,216,.1)',overflow:'hidden',flexShrink:0 }}>
                    {p.images?.[0]?<img src={p.images[0]} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><FaBuilding size={12} style={{color:'rgba(132,144,216,.5)'}}/></div>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:600,color:'rgba(232,228,216,.78)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.title||'ללא שם'}</div>
                    <div style={{ fontSize:10,color:'rgba(232,228,216,.3)' }}>{p.location}</div>
                  </div>
                  <span style={{ fontSize:10,padding:'2px 6px',borderRadius:10,background:p.published!==false?'rgba(34,197,94,.14)':'rgba(247,201,72,.14)',color:p.published!==false?'#22C55E':'#F7C948',fontWeight:700 }}>{p.published!==false?'פורסם':'טיוטה'}</span>
                </div>
              ))}
              {properties.length===0 && <div style={{ fontSize:12,color:'rgba(232,228,216,.22)',textAlign:'center',padding:'18px 0' }}>אין נכסים עדיין</div>}
              <button onClick={()=>setTab('props')} style={{ marginTop:10,fontSize:11,color:'rgba(132,144,216,.65)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0,fontWeight:600 }}>נהל נכסים ←</button>
            </div>
          </div>
        </>)}

        {tab==='props' && (
          <>
            {/* Wizard quick-launch banner */}
            <div style={{ background:`linear-gradient(135deg,${C.purple}22,${C.purple}0A)`, border:`1px solid ${C.purple}44`, borderRadius:12, padding:'18px 18px 16px', marginBottom:16, display:'flex', flexDirection:'column', alignItems:'center', gap:12, textAlign:'center' }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.cream }}>אשף העלאת נכס</div>
              <div style={{ fontSize:11, color:`${C.cream}70` }}>הדרך המהירה להוסיף נכס חדש עם כל הפרטים</div>
              <button onClick={() => {
                if (standalone) { try { localStorage.removeItem('afik_wizard_draft') } catch {}; setWizardOpen(true) }
                else { onClose(); setTimeout(() => document.dispatchEvent(new CustomEvent('afik:openWizard')), 100) }
              }}
                style={{ padding:'11px 32px', background:C.purple, border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', transition:'background .15s', whiteSpace:'nowrap', letterSpacing:'.02em' }}
                onMouseEnter={e=>e.currentTarget.style.background='#6b77c4'}
                onMouseLeave={e=>e.currentTarget.style.background=C.purple}>
                פתח אשף ←
              </button>
            </div>

            {/* Form */}
            <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:20, marginBottom:20 }}>
              <h3 style={{ fontSize:14, fontWeight:700, color:C.purple, marginBottom:16 }}>{editId ? 'עריכת נכס' : 'הוספת נכס חדש (טופס מהיר)'}</h3>

              {/* Category selector */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:`${C.cream}70`, marginBottom:8, fontWeight:600, letterSpacing:'.04em', textTransform:'uppercase' }}>קטגוריה</div>
                <div style={{ display:'flex', gap:8 }}>
                  {CATEGORIES.map(c => catBtn(c.id, c.label, c.Icon))}
                </div>
              </div>

              {/* Base fields */}
              <div className="admin-form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px' }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>שם הנכס *</label>
                  <input placeholder="שם הנכס" value={form.title} onChange={set('title')} style={inp}/>
                </div>
                {[['location','עיר *','עיר / יישוב'],['neighborhood','שכונה','שכונה (אופציונלי)'],['street','רחוב','רחוב ומספר']].map(([k,l,ph]) => (
                  <div key={k}>
                    <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>{l}</label>
                    <input placeholder={ph} value={form[k]} onChange={set(k)} style={inp}/>
                  </div>
                ))}
                <div>
                  <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>סוג נכס</label>
                  <select value={form.type} onChange={set('type')} style={inp}>
                    {catObj.types.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Category-specific fields */}
              <div className="admin-form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px' }}>
                {form.category === 'apartments' && <>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>חדרים</label><input placeholder="3.5" value={form.rooms} onChange={set('rooms')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>שטח מ"ר (כולל)</label><input placeholder="120" value={form.size} onChange={set('size')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>מ"ר בנוי</label><input placeholder="100" value={form.buildSqm} onChange={set('buildSqm')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>קומה</label><input placeholder="4" value={form.floor} onChange={set('floor')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>קומות בבניין</label><input placeholder="12" value={form.totalFloors} onChange={set('totalFloors')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>מספר חניות</label><input placeholder="1" value={form.parkingCount} onChange={set('parkingCount')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>שנת בנייה</label><input placeholder="2018" value={form.buildYear} onChange={set('buildYear')} style={inp}/></div>
                  <div>
                    <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>כיוון</label>
                    <select value={form.direction} onChange={set('direction')} style={inp}>
                      {['','מזרח','מערב','צפון','דרום','מזרח-צפון','מערב-דרום'].map(d => <option key={d} value={d}>{d || 'לא צוין'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>מצב הנכס</label>
                    <select value={form.condition} onChange={set('condition')} style={inp}>
                      {CONDITION_OPTIONS.map(c => <option key={c} value={c}>{c || 'לא צוין'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>תאריך כניסה</label>
                    <select value={form.entryDate} onChange={set('entryDate')} style={inp}>
                      {ENTRY_OPTIONS.map(e => <option key={e} value={e}>{e || 'לא צוין'}</option>)}
                    </select>
                  </div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>ארנונה ₪/חודש</label><input placeholder="450" value={form.propertyTax} onChange={set('propertyTax')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>ועד בית ₪/חודש</label><input placeholder="200" value={form.houseCommittee} onChange={set('houseCommittee')} style={inp}/></div>
                </>}
                {form.category === 'land' && <>
                  <div>
                    <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>גוש (GovMap)</label>
                    <input placeholder="40095" value={form.gush} onChange={set('gush')} style={{ ...inp, direction:'ltr' }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>חלקה (GovMap)</label>
                    <input placeholder="13" value={form.helka} onChange={set('helka')} style={{ ...inp, direction:'ltr' }}/>
                  </div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>דונם</label><input placeholder="2.5" value={form.dunams} onChange={set('dunams')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>שטח מ"ר</label><input placeholder="2500" value={form.size} onChange={set('size')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>ייעוד</label><input placeholder="מגורים / חקלאי / מסחרי" value={form.zoning} onChange={set('zoning')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>זכויות בנייה</label><input placeholder="25% / 6 קומות" value={form.buildingRights} onChange={set('buildingRights')} style={inp}/></div>
                </>}
                {form.category === 'projects' && <>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>שטח מ"ר</label><input placeholder="350" value={form.size} onChange={set('size')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>קומות</label><input placeholder="3" value={form.totalFloors} onChange={set('totalFloors')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>ייעוד</label><input placeholder="מגורים / מסחרי" value={form.zoning} onChange={set('zoning')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>זכויות בנייה</label><input placeholder={'40% / 1200 מ"ר'} value={form.buildingRights} onChange={set('buildingRights')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>שנת בנייה / צפי</label><input placeholder="2026" value={form.buildYear} onChange={set('buildYear')} style={inp}/></div>
                  <div>
                    <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>כיוון</label>
                    <select value={form.direction} onChange={set('direction')} style={inp}>
                      {['','מזרח','מערב','צפון','דרום','מזרח-צפון','מערב-דרום'].map(d => <option key={d} value={d}>{d || 'לא צוין'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>תאריך כניסה</label>
                    <select value={form.entryDate} onChange={set('entryDate')} style={inp}>
                      {ENTRY_OPTIONS.map(e => <option key={e} value={e}>{e || 'לא צוין'}</option>)}
                    </select>
                  </div>
                </>}
                {form.category === 'commercial' && <>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>שטח מ"ר</label><input placeholder='150' value={form.size} onChange={set('size')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>קומה</label><input placeholder='2' value={form.floor} onChange={set('floor')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>קומות בבניין</label><input placeholder='8' value={form.totalFloors} onChange={set('totalFloors')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>מספר חניות</label><input placeholder='2' value={form.parkingCount} onChange={set('parkingCount')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>שנת בנייה</label><input placeholder='2010' value={form.buildYear} onChange={set('buildYear')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>שכ"ד שנתי ₪</label><input placeholder='120000' value={form.annualRent} onChange={set('annualRent')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>תפוסה (%)</label><input placeholder='100' value={form.occupancyRate} onChange={set('occupancyRate')} style={inp}/></div>
                  <div><label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>ייעוד</label><input placeholder='משרד / מסחר / תעשייה' value={form.zoning} onChange={set('zoning')} style={inp}/></div>
                  <div>
                    <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>תאריך כניסה</label>
                    <select value={form.entryDate} onChange={set('entryDate')} style={inp}>
                      {ENTRY_OPTIONS.map(e => <option key={e} value={e}>{e || 'לא צוין'}</option>)}
                    </select>
                  </div>
                </>}
              </div>

              {/* Amenities */}
              {form.category !== 'land' && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, color:`${C.cream}55`, marginBottom:8, fontWeight:700, letterSpacing:'.05em', textTransform:'uppercase' }}>מה יש בנכס</div>
                  <div className="prop-chk-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8, padding:'10px 12px', background:'rgba(255,255,255,.02)', borderRadius:8, border:`1px solid ${C.purple}15` }}>
                    {chk('elevator','מעלית')} {chk('accessible','גישה לנכים')}
                    {chk('tornadoAC','מזגן טורנדו')} {chk('airCon','מיזוג')}
                    {chk('balcony','מרפסת')} {chk('storage','מחסן')}
                    {chk('parking','חניה')} {chk('pool','בריכה')}
                    {chk('garden','גינה')} {chk('safeRoom','ממ"ד')}
                    {chk('solarBoiler','דוד שמש')} {chk('bars','סורגים')}
                    {form.category === 'commercial' && <>
                      {chk('cameras','מצלמות אבטחה')} {chk('alarm','אזעקה')}
                      {chk('conferenceRoom','חדר ישיבות')} {chk('kitchenette','מטבחון')}
                      {chk('openSpace','מרחב פתוח')} {chk('loadingDock','רציף פריקה')}
                      {chk('wifi','אינטרנט מהיר')}
                      {chk('commRoom','חדר תקשורת')} {chk('mamak','ממק')}
                    </>}
                    {form.category==='apartments' && <>{chk('furnished','מרוהט')} {chk('renovated','משופץ')}</>}
                  </div>
                </div>
              )}

              {/* Price + status */}
              <div className="admin-form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px' }}>
                <div>
                  <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>מחיר (₪)</label>
                  <input placeholder="3500000" value={form.price} onChange={set('price')} style={inp}/>
                </div>
                <div>
                  <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>סטטוס</label>
                  <select value={form.status} onChange={set('status')} style={inp}>
                    {['בשיווק','זמין','בבדיקה','נמכר','הושכר'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:20, marginBottom:14, paddingTop:4 }}>
                {chk('exclusive','בלעדיות')} {chk('priceNegotiable','מחיר גמיש')}
              </div>

              {/* Description */}
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                  <label style={{ fontSize:11, color:`${C.cream}70`, fontWeight:600 }}>תיאור הנכס</label>
                  <button onClick={rewriteWithAI} disabled={aiLoading}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 12px', background: aiLoading ? 'rgba(132,144,216,.2)' : `${C.purple}22`, border:`1px solid ${C.purple}55`, borderRadius:6, color:C.purple, fontSize:10, fontWeight:700, cursor: aiLoading ? 'not-allowed' : 'pointer', fontFamily:'inherit', transition:'all .15s', letterSpacing:'.03em' }}
                    onMouseEnter={e => { if (!aiLoading) e.currentTarget.style.background = `${C.purple}38` }}
                    onMouseLeave={e => { if (!aiLoading) e.currentTarget.style.background = `${C.purple}22` }}>
                    {aiLoading ? '✦ מייצר...' : '✦ שכתוב עם AI'}
                  </button>
                </div>
                <textarea rows={4} value={form.description} onChange={set('description')} style={{ ...inp, resize:'vertical', marginBottom:0 }} placeholder="תיאור מלא של הנכס, יתרונות, מאפיינים..."/>
                {aiError && <div style={{ color:'#E05252', fontSize:11, marginTop:4 }}>{aiError}</div>}
              </div>

              {/* Links row */}
              <div className="admin-form-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 14px', marginBottom:0 }}>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>לינק לדף נחיתה</label>
                  <input placeholder="https://..." value={form.landingPageUrl||''} onChange={set('landingPageUrl')} style={inp}/>
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>לינק גוגל מאפ</label>
                  <input placeholder="https://maps.google.com/..." value={form.mapsUrl||''} onChange={set('mapsUrl')} style={inp}/>
                  {form.mapsUrl && toMapsEmbed(form.mapsUrl) && (
                    <div style={{ marginTop:8, borderRadius:8, overflow:'hidden', height:160, border:'1px solid rgba(132,144,216,.2)' }}>
                      <iframe src={toMapsEmbed(form.mapsUrl)} width="100%" height="100%" style={{ border:'none', display:'block' }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="מיקום הנכס"/>
                    </div>
                  )}
                </div>
                <div style={{ marginBottom:14, gridColumn:'1/-1' }}>
                  <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:4, fontWeight:600 }}>לינק סרטון (YouTube / Cloudinary)</label>
                  <input placeholder="https://www.youtube.com/watch?v=... או https://res.cloudinary.com/..." value={form.videoUrl||''} onChange={set('videoUrl')} style={inp}/>
                  <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:8, cursor:'pointer', userSelect:'none' }}>
                    <input type="checkbox" checked={form.videoAutoplay||false} onChange={set('videoAutoplay')} style={{ width:14, height:14, cursor:'pointer', accentColor:C.purple }}/>
                    <span style={{ fontSize:11, color:`${C.cream}70`, fontWeight:600 }}>השמעה אוטומטית ללא כפתור פליי (Autoplay)</span>
                  </label>
                </div>
              </div>

              {/* Images */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:8, fontWeight:600 }}>תמונות</label>
                <ImageUpload images={form.images} onChange={setImg}/>
              </div>

              {/* Project Logo */}
              <div style={{ marginBottom:14, background:'rgba(132,144,216,.06)', border:`1px solid ${C.purple}20`, borderRadius:10, padding:'14px 16px' }}>
                <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:10, fontWeight:600 }}>
                  לוגו הפרויקט <span style={{ color:`${C.cream}44`, fontWeight:400 }}>— יוצג מתחת לגלריית התמונות</span>
                </label>
                <LogoUpload logo={form.logo || ''} onChange={v => setForm(f => ({ ...f, logo: v }))}/>
              </div>

              {err && <div style={{ color:'#E05252', fontSize:12, marginBottom:10 }}>{err}</div>}

              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                <button onClick={() => save(false)} disabled={propSyncing} style={{ padding:'12px 18px', background:'rgba(255,255,255,.07)', border:`1px solid ${C.purple}33`, borderRadius:6, color:`${C.cream}BB`, fontSize:13, fontWeight:600, cursor: propSyncing ? 'not-allowed' : 'pointer', fontFamily:'inherit', transition:'all .15s', opacity: propSyncing ? .6 : 1 }}
                  onMouseEnter={e => { if (!propSyncing) e.currentTarget.style.borderColor=C.purple }}
                  onMouseLeave={e => { if (!propSyncing) e.currentTarget.style.borderColor=`${C.purple}33` }}>
                  שמור כטיוטה
                </button>
                <button onClick={() => save(true)} disabled={propSyncing} style={{ flex:1, padding:'12px', background: propSyncing ? `${C.purple}88` : C.purple, border:'none', borderRadius:6, color:'#fff', fontSize:13, fontWeight:700, cursor: propSyncing ? 'not-allowed' : 'pointer', fontFamily:'inherit', transition:'background .15s' }}
                  onMouseEnter={e => { if (!propSyncing) e.currentTarget.style.background='#6b77c4' }}
                  onMouseLeave={e => { if (!propSyncing) e.currentTarget.style.background=C.purple }}>
                  {propSyncing ? 'שומר...' : editId ? 'עדכן ופרסם' : 'פרסם לאוויר'}
                </button>
                {editId && <button onClick={() => { setEditId(null); setForm(EMPTY_PROP); localStorage.removeItem(ADMIN_DRAFT_KEY) }} style={{ padding:'12px 18px', background:'transparent', border:`1px solid ${C.purple}33`, borderRadius:6, color:`${C.cream}AA`, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>ביטול</button>}
              </div>
              {propSyncError && <div style={{ fontSize:11, color:'#E05252', marginTop:8, display:'flex', alignItems:'center', gap:5 }}>⚠ {propSyncError}</div>}
              {propSyncedAt && !propSyncing && !propSyncError && <div style={{ fontSize:11, color:C.green, marginTop:8, display:'flex', alignItems:'center', gap:5 }}>✓ סונכרן בהצלחה בשעה {propSyncedAt.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</div>}
            </div>

            {/* Property list */}
            <div ref={propListRef}>
              {/* Header bar with live count */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, padding:'12px 16px', background:'rgba(132,144,216,.06)', borderRadius:12, border:'1px solid rgba(132,144,216,.12)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:C.green, boxShadow:`0 0 8px ${C.green}`, display:'inline-block', animation:'pulse 2s infinite' }}/>
                    <span style={{ fontSize:14, fontWeight:800, color:C.cream }}>{publishedList.length} נכסים באוויר</span>
                  </div>
                  {draftList.length > 0 && <span style={{ fontSize:12, color:'#F7C948', fontWeight:600 }}>· {draftList.length} טיוטות</span>}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:11, color:`${C.cream}44` }}>סה"כ {properties.length} נכסים</span>
                  <button onClick={() => { if (!window.confirm('סנכרן את כל הנכסים לשרת עכשיו?')) return; syncProps(properties) }}
                    disabled={propSyncing}
                    title="סנכרן הכל לשרת"
                    style={{ padding:'5px 10px', background:`${C.purple}18`, border:`1px solid ${C.purple}44`, borderRadius:6, color:C.purple, cursor: propSyncing ? 'not-allowed' : 'pointer', fontSize:11, fontFamily:'inherit', fontWeight:700, whiteSpace:'nowrap', opacity: propSyncing ? .6 : 1 }}>
                    {propSyncing ? 'מסנכרן...' : '↻ סנכרן הכל'}
                  </button>
                  <button onClick={() => { const base = API_BASE || ''; if (!base) return; const headers = { Authorization: `Bearer ${ADMIN_TOKEN}` }; fetch(`${base}/api/properties`, { headers }).then(r => r.ok ? r.json() : Promise.reject()).then(data => { if (Array.isArray(data) && data.length > 0) setProperties(data) }).catch(() => {}) }}
                    title="רענן נכסים מהשרת"
                    style={{ padding:'5px 10px', background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.3)', borderRadius:6, color:'#22C55E', cursor:'pointer', fontSize:11, fontFamily:'inherit', fontWeight:700, whiteSpace:'nowrap' }}>
                    ↺ רענן מהשרת
                  </button>
                  <button onClick={exportProps}
                    title="הורד גיבוי JSON של כל הנכסים"
                    style={{ padding:'5px 10px', background:'rgba(247,201,72,.1)', border:'1px solid rgba(247,201,72,.3)', borderRadius:6, color:'#F7C948', cursor:'pointer', fontSize:11, fontFamily:'inherit', fontWeight:700, whiteSpace:'nowrap' }}>
                    ⬇ גיבוי JSON
                  </button>
                </div>
              </div>

              {/* Published / Drafts tabs */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8 }}>
                <div style={{ display:'flex', gap:4, background:'rgba(255,255,255,.04)', borderRadius:10, padding:4 }}>
                  <button onClick={() => setListTab('published')}
                    style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 16px', border:'none', borderRadius:7, background:listTab==='published'?C.green+'22':'transparent', color:listTab==='published'?C.green:`${C.cream}55`, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:800, transition:'all .15s' }}>
                    {listTab==='published' && <span style={{ width:6, height:6, borderRadius:'50%', background:C.green, display:'inline-block' }}/>}
                    באוויר ({publishedList.length})
                  </button>
                  <button onClick={() => setListTab('draft')}
                    style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 16px', border:'none', borderRadius:7, background:listTab==='draft'?'rgba(247,201,72,.18)':'transparent', color:listTab==='draft'?'#F7C948':`${C.cream}55`, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:800, transition:'all .15s' }}>
                    {listTab==='draft' && <span style={{ width:6, height:6, borderRadius:'50%', background:'#F7C948', display:'inline-block' }}/>}
                    טיוטות ({draftList.length})
                  </button>
                </div>
                <div className="admin-cat-filter">
                  {[{id:'all',label:'הכל',Icon:null},...CATEGORIES].map(({id,label,Icon:CIcon}) => (
                    <button key={id} onClick={() => setListCat(id)} style={{ padding:'4px 10px', border:`1px solid ${listCat===id?C.purple:'rgba(132,144,216,.2)'}`, borderRadius:6, background:listCat===id?`${C.purple}22`:'transparent', color:listCat===id?C.purple:`${C.cream}70`, cursor:'pointer', fontSize:11, fontFamily:'inherit', display:'flex', alignItems:'center', gap:4, flexShrink:0, whiteSpace:'nowrap' }}>
                      {CIcon && <CIcon size={10}/>} {label}
                    </button>
                  ))}
                </div>
              </div>
              {filteredList.length === 0 && <div style={{ textAlign:'center', padding:'28px 0', color:`${C.cream}40`, fontSize:13 }}>{listTab==='draft' ? 'אין טיוטות שמורות.' : 'אין נכסים פעילים באוויר.'}</div>}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {filteredList.map(p => {
                  const cat = CATEGORIES.find(c => c.id === p.category) || CATEGORIES[1]
                  const fmtPrice = p.price ? `₪${Number(String(p.price).replace(/[^\d]/g,'')).toLocaleString('he-IL')}` : 'מחיר בפנייה'
                  const statusClr = { 'בשיווק':C.green,'זמין':C.green,'בבדיקה':'#F7C948','נמכר':'#E05252','הושכר':'#F97316' }[p.status] || C.green
                  return (
                    <div key={p.id}
                      draggable
                      onDragStart={() => { dragPropId.current = p.id; setDragActive(true) }}
                      onDragEnter={() => { dragOverId.current = p.id }}
                      onDragEnd={() => { reorderProps(); dragPropId.current = null; dragOverId.current = null; setDragActive(false) }}
                      onDragOver={e => e.preventDefault()}
                      style={{ display:'flex', gap:0, background: p.published!==false ? 'rgba(34,197,94,.04)' : 'rgba(255,255,255,.04)', borderRadius:14, border:`1.5px solid ${p.published===false ? 'rgba(247,201,72,.25)' : C.green+'28'}`, overflow:'hidden', transition:'all .2s', cursor: dragActive ? 'grabbing' : 'default' }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow=`0 6px 28px rgba(132,144,216,.18)`; e.currentTarget.style.borderColor=p.published!==false ? C.green+'55' : 'rgba(247,201,72,.5)' }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.borderColor=p.published===false ? 'rgba(247,201,72,.25)' : C.green+'28' }}>
                      {/* Drag handle strip */}
                      <div style={{ width:18, flexShrink:0, background: p.published!==false ? C.green+'22' : 'rgba(247,201,72,.12)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'grab', fontSize:11, color: p.published!==false ? C.green+'88' : 'rgba(247,201,72,.6)', userSelect:'none', letterSpacing:0 }}
                        title="גרור לשינוי סדר">⠿</div>
                      {/* Live indicator strip */}
                      <div style={{ width:4, flexShrink:0, background: p.published!==false ? C.green : '#F7C948' }}/>
                      {/* Thumbnail */}
                      <div className="admin-prop-thumb" style={{ position:'relative', flexShrink:0, width:130, height:100 }}>
                        {p.images?.[0] ? (
                          <img src={p.images[0]} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} alt="" loading="lazy" decoding="async"/>
                        ) : (
                          <div style={{ width:'100%', height:'100%', background:`${C.purple}10`, display:'flex', alignItems:'center', justifyContent:'center', color:`${C.purple}55` }}><cat.Icon size={28}/></div>
                        )}
                        {/* Live / Draft badge on thumbnail */}
                        <div style={{ position:'absolute', top:6, right:6, background: p.published!==false ? `${C.green}CC` : 'rgba(247,201,72,.88)', borderRadius:5, padding:'2px 7px', fontSize:9, fontWeight:800, color:'#000', letterSpacing:'.04em', display:'flex', alignItems:'center', gap:4 }}>
                          {p.published!==false && <span style={{ width:5, height:5, borderRadius:'50%', background:'#000', opacity:.7, display:'inline-block' }}/>}
                          {p.published!==false ? 'LIVE' : 'טיוטה'}
                        </div>
                        <div style={{ position:'absolute', bottom:0, left:0, right:0, background:`${statusClr}CC`, padding:'2px 0', textAlign:'center', fontSize:9, fontWeight:800, color:'#000' }}>
                          {p.status || 'זמין'}
                        </div>
                      </div>
                      {/* Info */}
                      <div style={{ flex:1, minWidth:0, padding:'10px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                        <div>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                            <span style={{ fontWeight:800, fontSize:15, color:C.cream, lineHeight:1.25, flex:1 }}>{p.title}</span>
                            <div style={{ display:'flex', gap:4, flexShrink:0, alignItems:'center' }}>
                              {p.exclusive && <span style={{ fontSize:10, background:`${C.green}18`, color:C.green, border:`1px solid ${C.green}35`, borderRadius:5, padding:'2px 8px', fontWeight:700 }}>✦ בלעדי</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:5 }}>
                            <span style={{ background:`${C.purple}22`, color:C.purple, borderRadius:5, padding:'2px 8px', fontSize:10, fontWeight:700 }}>{cat.label}</span>
                            {p.type && <span style={{ background:'rgba(255,255,255,.06)', color:`${C.cream}70`, borderRadius:5, padding:'2px 8px', fontSize:10 }}>{p.type}</span>}
                          </div>
                          <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:12, color:`${C.cream}75`, marginBottom:4 }}>
                            {p.location && <span style={{ display:'flex', alignItems:'center', gap:4 }}><FaMapMarkerAlt size={10} style={{ color:C.purple }}/>{p.location}{p.neighborhood ? ' · '+p.neighborhood : ''}</span>}
                            {p.rooms && <span style={{ display:'flex', alignItems:'center', gap:4 }}><FaBed size={10} style={{ color:C.purple }}/>{p.rooms} חד'</span>}
                            {p.size && <span style={{ display:'flex', alignItems:'center', gap:4 }}><FaRulerCombined size={10} style={{ color:C.purple }}/>{p.size} מ"ר</span>}
                            {p.floor && <span style={{ display:'flex', alignItems:'center', gap:4 }}><FaBuilding size={10} style={{ color:C.purple }}/>קומה {p.floor}{p.totalFloors?'/'+p.totalFloors:''}</span>}
                            {p.dunams && <span style={{ display:'flex', alignItems:'center', gap:4 }}><FaLeaf size={10} style={{ color:C.purple }}/>{p.dunams} דונם</span>}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:6, borderTop:'1px solid rgba(255,255,255,.06)', paddingTop:8, marginTop:4 }}>
                          <span style={{ fontSize:14, fontWeight:900, color: p.price ? C.cream : `${C.cream}66` }}>{fmtPrice}</span>
                          <div className="admin-prop-list-actions" style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                            {/* Publish toggle */}
                            {p.published===false
                              ? <button onClick={() => publish(p.id)} style={{ padding:'6px 12px', background:`${C.green}18`, border:`1px solid ${C.green}44`, borderRadius:7, color:C.green, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:700, whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:5 }}><span style={{ width:6, height:6, borderRadius:'50%', background:C.green, display:'inline-block' }}/>פרסם לאוויר</button>
                              : <button onClick={() => unpublish(p.id)} style={{ padding:'6px 12px', background:'rgba(247,201,72,.08)', border:'1px solid rgba(247,201,72,.3)', borderRadius:7, color:'#F7C948', cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:600, whiteSpace:'nowrap' }}>הסתר</button>
                            }
                            {/* Status quick-set */}
                            {(p.status==='נמכר' || p.status==='הושכר') && (
                              <button onClick={() => setStatus(p.id, 'בשיווק')} style={{ padding:'6px 12px', background:`${C.green}18`, border:`1px solid ${C.green}44`, borderRadius:7, color:C.green, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:700, whiteSpace:'nowrap' }}>החזר לשיווק</button>
                            )}
                            <button onClick={() => setStatus(p.id, p.status==='נמכר' ? 'בשיווק' : 'נמכר')}
                              style={{ padding:'6px 12px', background: p.status==='נמכר' ? 'rgba(224,82,82,.22)' : 'rgba(224,82,82,.08)', border:`1px solid ${p.status==='נמכר' ? '#E05252' : 'rgba(224,82,82,.3)'}`, borderRadius:7, color:'#E05252', cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:700, whiteSpace:'nowrap' }}>
                              {p.status==='נמכר' ? '✓ נמכר' : 'נמכר'}
                            </button>
                            <button onClick={() => setStatus(p.id, p.status==='הושכר' ? 'בשיווק' : 'הושכר')}
                              style={{ padding:'6px 12px', background: p.status==='הושכר' ? 'rgba(249,115,22,.22)' : 'rgba(249,115,22,.08)', border:`1px solid ${p.status==='הושכר' ? '#F97316' : 'rgba(249,115,22,.3)'}`, borderRadius:7, color:'#F97316', cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:700, whiteSpace:'nowrap' }}>
                              {p.status==='הושכר' ? '✓ הושכר' : 'הושכר'}
                            </button>
                            {onEditInWizard && (
                              <button onClick={() => { onClose?.(); onEditInWizard(p) }} style={{ padding:'6px 12px', background:`${C.purple}22`, border:`1px solid ${C.purple}55`, borderRadius:7, color:C.purple, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:700, whiteSpace:'nowrap' }}>ערוך באשף</button>
                            )}
                            <button onClick={() => dup(p.id)} title='שכפל נכס' style={{ padding:'6px 12px', background:'rgba(247,201,72,.1)', border:'1px solid rgba(247,201,72,.3)', borderRadius:7, color:'#F7C948', cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:700, whiteSpace:'nowrap' }}>שכפל</button>
                            <button onClick={async () => {
                              const base = (typeof API_BASE !== 'undefined' ? API_BASE : '') || ''
                              if (!base) { alert('VITE_API_URL לא מוגדר'); return }
                              try {
                                const r = await fetch(`${base}/api/properties`, { headers:{ Authorization:`Bearer ${ADMIN_TOKEN}` } })
                                if (!r.ok) throw new Error(r.status)
                                const all = await r.json()
                                const fresh = Array.isArray(all) ? all.find(x => String(x.id)===String(p.id)) : null
                                if (!fresh) { alert('הנכס לא נמצא בשרת — השרת אולי הופעל מחדש.\nהנתונים המקומיים שמורים.'); return }
                                const localProp = properties.find(x => String(x.id)===String(p.id))
                                const localNewer = (localProp?.updatedAt || 0) > (fresh.updatedAt || 0)
                                const msg = localNewer
                                  ? `⚠️ אזהרה: הנתונים בשרת ישנים יותר מהנתונים המקומיים!\n\nאם תאשר — הנתונים המקומיים העדכניים שלך יוחלפו בנתוני השרת הישנים.\n\nהאם להמשיך בכל זאת?`
                                  : `רענן את "${p.title}" מהשרת?\n\nהנתונים המקומיים יוחלפו בנתוני השרת.`
                                if (!window.confirm(msg)) return
                                setProperties(prev => prev.map(x => String(x.id)===String(p.id) ? { ...x, ...fresh } : x))
                                alert('נכס רוענן בהצלחה')
                              } catch(e) { alert('שגיאת רענון: ' + e.message) }
                            }} title='רענן נכס מהשרת' style={{ padding:'6px 12px', background:'rgba(132,144,216,.1)', border:'1px solid rgba(132,144,216,.3)', borderRadius:7, color:C.purple, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:700, whiteSpace:'nowrap' }}>↻ רענן</button>
                            <button onClick={() => del(p.id)} style={{ padding:'6px 12px', background:'rgba(224,82,82,.1)', border:'1px solid rgba(224,82,82,.3)', borderRadius:7, color:'#E05252', cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:600, whiteSpace:'nowrap' }}>מחק</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {tab==='analytics' && <AnalyticsDashboard leads={leads}/>}
        {tab==='team' && <TeamTab C={C} isDark={isDark}/>}

        {tab==='counters' && (
          <>
            {/* ── Header bar with sync status ── */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, padding:'14px 18px', background:'rgba(132,144,216,.06)', borderRadius:12, border:'1px solid rgba(132,144,216,.12)' }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:C.cream, marginBottom:3 }}>נתוני האתר — עריכה חיה</div>
                <div style={{ fontSize:11, color:`${C.cream}44`, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background: countersSaving ? '#F7C948' : countersSaved ? '#22C55E' : countersError ? '#E05252' : `${C.purple}88`, display:'inline-block', boxShadow: countersSaved ? '0 0 6px rgba(34,197,94,.7)' : 'none', transition:'all .3s' }}/>
                  {countersSaving && 'שומר...'}
                  {!countersSaving && countersSaved && `נשמר ב-${countersSavedAt?.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}`}
                  {!countersSaving && !countersSaved && !countersError && (countersSavedAt ? `עודכן לאחרונה ${countersSavedAt.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}` : 'שמור כדי לסנכרן עם Supabase + Render')}
                  {countersError && <span style={{ color:'#E05252' }}>{countersError}</span>}
                </div>
              </div>
              <button onClick={saveCounters} disabled={countersSaving}
                style={{ padding:'10px 26px', background: countersSaved ? 'rgba(34,197,94,.15)' : C.purple, border: countersSaved ? '1px solid rgba(34,197,94,.4)' : 'none', borderRadius:9, color: countersSaved ? '#22C55E' : '#fff', fontWeight:700, fontSize:13, cursor: countersSaving ? 'not-allowed' : 'pointer', fontFamily:'inherit', transition:'all .25s', display:'flex', alignItems:'center', gap:8, opacity: countersSaving ? .7 : 1, boxShadow: countersSaved ? 'none' : `0 4px 18px ${C.purple}44`, whiteSpace:'nowrap' }}>
                {countersSaving ? 'שומר...' : countersSaved ? 'נשמר' : 'שמור שינויים'}
              </button>
            </div>

            {/* ── Main stats ── */}
            <div style={{ marginBottom:28 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.purple, letterSpacing:'2px', textTransform:'uppercase', marginBottom:14, opacity:.8 }}>מונים ראשיים — מוצגים בדף הבית</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {stats.map((s, i) => (
                  <div key={s.key} style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:'16px 18px', border:`1px solid ${C.purple}18`, transition:'border-color .2s' }}
                    onFocus={e => e.currentTarget.style.borderColor=`${C.purple}44`}
                    onBlur={e => e.currentTarget.style.borderColor=`${C.purple}18`}>
                    {/* Preview badge */}
                    <div style={{ fontSize:22, fontWeight:900, color:C.green, fontFamily:'monospace', marginBottom:4, lineHeight:1 }}>
                      {s.value.toLocaleString()}{s.suffix}
                    </div>
                    <div style={{ fontSize:11, color:`${C.cream}55`, marginBottom:12, fontWeight:500 }}>{s.label}</div>
                    <div style={{ display:'flex', gap:8 }}>
                      <div style={{ flex:2 }}>
                        <div style={{ fontSize:10, color:`${C.cream}44`, marginBottom:4, fontWeight:600 }}>ערך</div>
                        <input type="number" value={s.value}
                          onChange={e => setStats(prev => prev.map((x,j) => j===i ? {...x,value:Number(e.target.value)} : x))}
                          style={{ width:'100%', padding:'9px 10px', background:'rgba(255,255,255,.06)', border:`1px solid ${C.green}33`, borderRadius:7, color:C.green, fontSize:15, fontWeight:800, fontFamily:'monospace', outline:'none', textAlign:'center', boxSizing:'border-box' }}/>
                      </div>
                      <div style={{ flex:3 }}>
                        <div style={{ fontSize:10, color:`${C.cream}44`, marginBottom:4, fontWeight:600 }}>תווית</div>
                        <input type="text" value={s.label}
                          onChange={e => setStats(prev => prev.map((x,j) => j===i ? {...x,label:e.target.value} : x))}
                          style={{ width:'100%', padding:'9px 10px', background:'rgba(255,255,255,.06)', border:`1px solid ${C.purple}22`, borderRadius:7, color:`${C.cream}CC`, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'right', boxSizing:'border-box' }}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Sharon cities ── */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.purple, letterSpacing:'2px', textTransform:'uppercase', marginBottom:14, opacity:.8 }}>בלעדיות בשרון — מוצג בסקשן הסיפור</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {sharon.map((s, i) => (
                  <div key={s.city} style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:'16px 18px', border:`1px solid ${C.purple}18` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:C.green, opacity:.7 }}/>
                      <span style={{ fontSize:13, color:C.cream, fontWeight:800 }}>{s.city}</span>
                      <span style={{ marginRight:'auto', fontSize:20, fontWeight:900, color:C.green, fontFamily:'monospace' }}>{s.count}</span>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:10, color:`${C.cream}44`, marginBottom:4, fontWeight:600 }}>כמות</div>
                        <input type="number" value={s.count}
                          onChange={e => setSharon(prev => prev.map((x,j) => j===i ? {...x,count:Number(e.target.value)} : x))}
                          style={{ width:'100%', padding:'8px 10px', background:'rgba(255,255,255,.06)', border:`1px solid ${C.green}33`, borderRadius:7, color:C.green, fontSize:15, fontWeight:800, fontFamily:'monospace', outline:'none', textAlign:'center', boxSizing:'border-box' }}/>
                      </div>
                      <div style={{ flex:2 }}>
                        <div style={{ fontSize:10, color:`${C.cream}44`, marginBottom:4, fontWeight:600 }}>תווית</div>
                        <input type="text" value={s.type}
                          onChange={e => setSharon(prev => prev.map((x,j) => j===i ? {...x,type:e.target.value} : x))}
                          style={{ width:'100%', padding:'8px 10px', background:'rgba(255,255,255,.06)', border:`1px solid ${C.purple}22`, borderRadius:7, color:`${C.cream}CC`, fontSize:12, fontFamily:'inherit', outline:'none', textAlign:'right', boxSizing:'border-box' }}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Info banner ── */}
            <div style={{ padding:'12px 16px', background:`${C.purple}08`, border:`1px solid ${C.purple}18`, borderRadius:10, display:'flex', gap:10, alignItems:'flex-start' }}>
              <FaChartBar size={13} style={{ color:C.purple, marginTop:2, flexShrink:0 }}/>
              <div style={{ fontSize:12, color:`${C.cream}66`, lineHeight:1.7 }}>
                שמירה שולחת את הנתונים ל-<strong style={{ color:C.purple }}>Render + Supabase</strong> ומעדכנת את האתר מיד. שינויים בשדות נשמרים גם אוטומטית תוך 2 שניות (auto-save).
              </div>
            </div>
          </>
        )}

        {tab==='leads' && (
          <Suspense fallback={<AdminTabLoader label="לידים" />}>
            <LeadsBoard
              leads={leads}
              updateLead={updateLead}
              updateLeadStatus={updateLeadStatus}
              deleteLead={deleteLead}
              addLead={lead => setLeads(prev => { const next = [...prev, lead]; try { localStorage.setItem(LEADS_STORE, JSON.stringify(next)) } catch {} return next })}
              colOrder={colOrder} setColOrder={setColOrder}
              customCols={customCols} setCustomCols={setCustomCols}
              colWidths={colWidths} setColWidths={setColWidths}
              exportCSV={exportCSV}
              syncLeads={syncLeadsFromServer}
              enrichAll={enrichAllLeads}
              enrichLead={enrichLead}
              clearLeads={clearLeads}
              leadsSyncing={leadsSyncing}
              isDark={isDark}
              lang={lang}
              onOpenChat={lead => { setInitialChatLead(lead); setTab('chats') }}
            />
          </Suspense>
        )}

        {tab==='chats' && (
          <Suspense fallback={<AdminTabLoader label="צ'אטים" />}>
            <GreenAPIChat
              leads={leads}
              lang={lang}
              initialContact={initialChatLead}
              onOpenLead={lead => { setInitialChatLead(null); setTab('leads') }}
              onDeleteLead={id => deleteLead(id)}
            />
          </Suspense>
        )}

        {false && (() => {
          const sl = chatSearch.toLowerCase()
          const contactList = leads
            .filter(l => l.phone)
            .filter(l => !chatSearch || (l.name||'').toLowerCase().includes(sl) || (l.phone||'').includes(chatSearch))
            .sort((a,b) => {
              const pa = intlPhoneFmt(a.phone), pb = intlPhoneFmt(b.phone)
              const la = chats[pa]?.[chats[pa].length-1]?.created_at || 0
              const lb = chats[pb]?.[chats[pb].length-1]?.created_at || 0
              return new Date(lb) - new Date(la)
            })
          const chatIdx = contactList.findIndex(l => l.id === chatContact?.id)
          const navToContact = t => { setChatContact(t); fetchChats(t.phone) }
          const avatarBg = name => { const colors=['#D9626E','#AA7DE0','#3A8FC7','#E08C3A','#3BAF7E','#C2497E','#5C8AE0']; return colors[(name?.charCodeAt(0)||65)%colors.length] }
          const chatPhone = chatContact ? intlPhoneFmt(chatContact.phone) : null
          const msgs = chatPhone ? (chats[chatPhone]||[]) : []

          const fmtMsgDate = ds => {
            const d = new Date(ds), tod = new Date(); tod.setHours(0,0,0,0)
            const yes = new Date(tod); yes.setDate(yes.getDate()-1)
            const md = new Date(d); md.setHours(0,0,0,0)
            if (md.getTime()===tod.getTime()) return lang==='en'?'TODAY':'היום'
            if (md.getTime()===yes.getTime()) return lang==='en'?'YESTERDAY':'אתמול'
            return d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric',year:'2-digit'})
          }
          const fmtTime = ds => new Date(ds).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})
          const fmtSidebarTime = ds => {
            const d = new Date(ds), tod = new Date(); tod.setHours(0,0,0,0)
            const md = new Date(d); md.setHours(0,0,0,0)
            return md.getTime()===tod.getTime() ? fmtTime(ds) : d.toLocaleDateString('he-IL',{day:'numeric',month:'numeric'})
          }

          const WA = { bg:'#0B141A', sidebar:'#111B21', header:'#202C33', divider:'#2A3942', incoming:'#1F2C33', outgoing:'#005C4B', text:'#E9EDEF', sub:'#8696A0', tick:'#53BDEB' }

          const startNewChat = () => {
            const raw = newChatPhone.trim()
            if (!raw) return
            const p = (raw.replace(/D/g,'').startsWith('972') ? raw.replace(/D/g,'') : '972' + raw.replace(/D/g,'').replace(/^0/,''))
            if (!p || p.length < 11) { alert('מספר לא תקין'); return }
            setNewChatOpen(false); setNewChatPhone('')
            const fake = { id:'new-'+p, name: p, phone: p }
            setChatContact(fake); fetchChats(p)
          }

          const statusColor = chatStatus==='authorized'?'#22C55E':chatStatus==='notAuthorized'?'#F97316':chatStatus==='error'?'#E05252':'#8696A0'
          const statusLabel = chatStatus==='authorized'?'מחובר':chatStatus==='notAuthorized'?'לא מורשה':chatStatus==='error'?'שגיאה':chatStatus==='notConfigured'?'לא מוגדר':'...'

          return (
            <>
            {newChatOpen && (
              <div style={{ position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center' }}
                onClick={e => e.target===e.currentTarget && setNewChatOpen(false)}>
                <div style={{ background:WA.header, borderRadius:12, padding:28, width:340, direction:'rtl', boxShadow:'0 20px 60px rgba(0,0,0,.6)' }}>
                  <div style={{ fontSize:16, fontWeight:700, color:WA.text, marginBottom:18 }}>שיחה חדשה</div>
                  <div style={{ fontSize:12, color:WA.sub, marginBottom:10 }}>הכנס מספר טלפון</div>
                  <input autoFocus value={newChatPhone} onChange={e=>setNewChatPhone(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&startNewChat()}
                    placeholder="05XXXXXXXX"
                    style={{ width:'100%', padding:'11px 14px', background:WA.sidebar, border:'none', borderRadius:8, color:WA.text, fontSize:14, fontFamily:'inherit', outline:'none', direction:'ltr', marginBottom:16, boxSizing:'border-box' }}/>
                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={startNewChat} style={{ flex:1, padding:'11px 0', background:'#00A884', border:'none', borderRadius:8, color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>התחל שיחה</button>
                    <button onClick={()=>setNewChatOpen(false)} style={{ flex:1, padding:'11px 0', background:WA.sidebar, border:'none', borderRadius:8, color:WA.sub, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>ביטול</button>
                  </div>
                </div>
              </div>
            )}
            <div style={{ background:'#1A2329', borderBottom:`1px solid ${WA.divider}`, padding:'6px 20px', display:'flex', alignItems:'center', gap:10, flexShrink:0, direction:'rtl', fontSize:12 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:statusColor, boxShadow:`0 0 6px ${statusColor}99`, display:'inline-block', flexShrink:0 }}/>
              <span style={{ color:'rgba(233,237,239,.6)', fontWeight:500 }}>Green API {statusLabel}</span>
              <span style={{ color:'rgba(233,237,239,.28)', marginRight:'auto' }}>afik.hanahal@gmail.com</span>
            </div>
            <div style={{ display:'flex', flex:1, height:0, minHeight:0, direction:'rtl', overflow:'hidden' }}>

              {/* ── SIDEBAR ────────────────────────────────────────── */}
              <div style={{ width:330, flexShrink:0, display:'flex', flexDirection:'column', background:WA.sidebar, borderLeft:`1px solid ${WA.divider}` }}>

                {/* Sidebar top bar */}
                <div style={{ padding:'10px 16px', background:WA.header, display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'#3A4B54', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <FaWhatsapp size={20} style={{ color:'#aebac1' }}/>
                  </div>
                  <div style={{ flex:1, fontWeight:600, fontSize:16, color:WA.text }}>{lang==='en'?'WhatsApp':'WhatsApp'}</div>
                  <button onClick={()=>{ setNewChatOpen(true); setNewChatPhone('') }} title='שיחה חדשה'
                    style={{ width:34, height:34, borderRadius:8, background:'transparent', border:`1px solid ${WA.sub}44`, color:WA.sub, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:300, transition:'all .15s', marginLeft:4 }}
                    onMouseEnter={e=>{ e.currentTarget.style.background='#374045'; e.currentTarget.style.color='#fff' }} onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color=WA.sub }}>+</button>
                  <button onClick={()=>chatContact&&fetchChats(chatContact.phone)} title={lang==='en'?'Refresh':'רענן'}
                    style={{ width:34, height:34, borderRadius:'50%', background:'transparent', border:'none', color:WA.sub, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, transition:'background .15s' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#374045'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>⟳</button>
                </div>

                {/* Search */}
                <div style={{ padding:'8px 10px', background:WA.sidebar, borderBottom:`1px solid ${WA.divider}` }}>
                  <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                    <span style={{ position:'absolute', right:12, color:WA.sub, fontSize:13, pointerEvents:'none', lineHeight:1 }}>🔍</span>
                    <input value={chatSearch} onChange={e=>setChatSearch(e.target.value)}
                      placeholder={lang==='en'?'Search or start new chat':'חיפוש'}
                      style={{ width:'100%', padding:'9px 38px 9px 14px', background:WA.header, border:'none', borderRadius:9, color:WA.text, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box', direction:'rtl' }}/>
                  </div>
                </div>

                {/* Contact list */}
                <div style={{ flex:1, overflowY:'auto' }}>
                  {contactList.length===0 && (
                    <div style={{ padding:28, textAlign:'center', color:WA.sub, fontSize:13, direction:'rtl' }}>
                      {leads.filter(l=>l.phone).length===0
                        ? (lang==='en'?'No leads with phone numbers yet':'אין לידים עם מספר טלפון')
                        : (lang==='en'?'No results':'אין תוצאות')}
                    </div>
                  )}
                  {contactList.map(lead => {
                    const p = intlPhoneFmt(lead.phone)
                    const leadMsgs = chats[p]||[]
                    const lastMsg = leadMsgs[leadMsgs.length-1]
                    const isActive = chatContact?.id===lead.id
                    return (
                      <div key={lead.id}
                        onClick={()=>{ setChatContact(lead); fetchChats(lead.phone) }}
                        style={{ padding:'12px 16px', display:'flex', gap:13, cursor:'pointer', background:isActive?'#2A3942':'transparent', borderBottom:`1px solid ${WA.divider}`, transition:'background .12s', alignItems:'center' }}
                        onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background='#182229' }}
                        onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background='transparent' }}>
                        <div style={{ width:48, height:48, borderRadius:'50%', background:avatarBg(lead.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'#fff', flexShrink:0 }}>
                          {(lead.name||lead.phone||'?')[0].toUpperCase()}
                        </div>
                        <div style={{ flex:1, minWidth:0, direction:'rtl' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:3 }}>
                            <div style={{ fontWeight:600, fontSize:15, color:WA.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{lead.name||lead.phone}</div>
                            {lastMsg && <div style={{ fontSize:11, color:WA.sub, flexShrink:0, marginRight:10 }}>{fmtSidebarTime(lastMsg.created_at)}</div>}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            {lastMsg?.direction==='out' && <span style={{ color:WA.tick, fontSize:13, flexShrink:0, lineHeight:1 }}>✓✓</span>}
                            <div style={{ fontSize:13, color:WA.sub, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {lastMsg ? lastMsg.message : lead.phone}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── CHAT AREA ──────────────────────────────────────── */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:WA.bg }}>
                {chatContact ? (
                  <>
                    {/* Chat header */}
                    <div style={{ padding:'10px 18px', background:WA.header, display:'flex', alignItems:'center', gap:13, flexShrink:0, borderBottom:`1px solid ${WA.divider}` }}>
                      <div style={{ width:42, height:42, borderRadius:'50%', background:avatarBg(chatContact.name), display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:17, color:'#fff', flexShrink:0 }}>
                        {(chatContact.name||chatContact.phone||'?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:15, color:WA.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{chatContact.name||chatContact.phone}</div>
                        <div style={{ fontSize:12, color:WA.sub, direction:'ltr' }}>{chatContact.phone}</div>
                      </div>
                      <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                        <button onClick={()=>chatIdx>0&&navToContact(contactList[chatIdx-1])} title="ליד קודם"
                          disabled={chatIdx<=0}
                          style={{ width:32, height:32, borderRadius:'50%', background:'transparent', border:'none', color:chatIdx<=0?WA.divider:WA.sub, cursor:chatIdx<=0?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, transition:'background .15s' }}
                          onMouseEnter={e=>{ if(chatIdx>0) e.currentTarget.style.background='#374045' }} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>‹</button>
                        <button onClick={()=>chatIdx<contactList.length-1&&navToContact(contactList[chatIdx+1])} title="ליד הבא"
                          disabled={chatIdx>=contactList.length-1}
                          style={{ width:32, height:32, borderRadius:'50%', background:'transparent', border:'none', color:chatIdx>=contactList.length-1?WA.divider:WA.sub, cursor:chatIdx>=contactList.length-1?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, transition:'background .15s' }}
                          onMouseEnter={e=>{ if(chatIdx<contactList.length-1) e.currentTarget.style.background='#374045' }} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>›</button>
                        {chatContact.phone && (
                          <a href={`tel:${chatContact.phone}`} title={lang==='en'?'Call':'התקשר'}
                            style={{ width:36, height:36, borderRadius:'50%', background:'transparent', color:WA.sub, display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', transition:'background .15s' }}
                            onMouseEnter={e=>e.currentTarget.style.background='#374045'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <FaPhone size={15}/>
                          </a>
                        )}
                        {chatContact.phone && (
                          <a href={`https://wa.me/${intlPhoneFmt(chatContact.phone)}`} target="_blank" rel="noopener noreferrer" title="WhatsApp Web"
                            style={{ width:36, height:36, borderRadius:'50%', background:'transparent', color:WA.sub, display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', transition:'background .15s' }}
                            onMouseEnter={e=>e.currentTarget.style.background='#374045'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                            <FaWhatsapp size={17}/>
                          </a>
                        )}
                        <button onClick={()=>fetchChats(chatContact.phone)} title={lang==='en'?'Refresh':'רענן'}
                          style={{ width:36, height:36, borderRadius:'50%', background:'transparent', border:'none', color:WA.sub, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, transition:'background .15s' }}
                          onMouseEnter={e=>e.currentTarget.style.background='#374045'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>⟳</button>
                        <button onClick={()=>setChatContact(null)} title={lang==='en'?'Close':'סגור'}
                          style={{ width:36, height:36, borderRadius:'50%', background:'transparent', border:'none', color:WA.sub, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, transition:'background .15s' }}
                          onMouseEnter={e=>e.currentTarget.style.background='#374045'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>✕</button>
                      </div>
                    </div>

                    {/* Messages area */}
                    <div ref={chatScrollRef} style={{ flex:1, overflowY:'auto', padding:'16px 8%', display:'flex', flexDirection:'column', gap:2, backgroundColor:WA.bg, backgroundImage:`url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.015' fill-rule='evenodd'%3E%3Cpath d='M50 50c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10s-10-4.477-10-10 4.477-10 10-10zM10 10c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10c0 5.523-4.477 10-10 10S0 25.523 0 20s4.477-10 10-10zm10 0c5.523 0 10 4.477 10 10h10c0-5.523 4.477-10 10-10V0H20v10z'/%3E%3C/g%3E%3C/svg%3E")` }}>
                      {msgs.length===0 ? (
                        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:WA.sub, minHeight:200 }}>
                          <FaWhatsapp size={52} style={{ opacity:.18, color:'#25D366' }}/>
                          <div style={{ fontSize:14, textAlign:'center', direction:'rtl' }}>{lang==='en'?'No messages yet':'אין הודעות עדיין'}</div>
                        </div>
                      ) : (() => {
                        const items = []
                        msgs.forEach((msg,i) => {
                          const isOut = msg.direction==='out'
                          const showDate = i===0 || new Date(msg.created_at).toDateString()!==new Date(msgs[i-1]?.created_at).toDateString()
                          if (showDate) items.push(
                            <div key={`d-${i}`} style={{ display:'flex', justifyContent:'center', margin:'12px 0 8px' }}>
                              <span style={{ fontSize:11.5, color:WA.text, background:'#1F2C33', borderRadius:8, padding:'5px 16px', boxShadow:'0 1px 3px rgba(0,0,0,.35)', fontWeight:500, letterSpacing:.2 }}>
                                {fmtMsgDate(msg.created_at)}
                              </span>
                            </div>
                          )
                          items.push(
                            <div key={msg.id||i} style={{ display:'flex', justifyContent:isOut?'flex-end':'flex-start', marginBottom:1 }}>
                              <div style={{ maxWidth:'65%', minWidth:80, padding:'7px 12px 22px 12px', borderRadius:isOut?'8px 8px 2px 8px':'8px 8px 8px 2px', background:isOut?WA.outgoing:WA.incoming, color:WA.text, fontSize:14.5, lineHeight:1.55, wordBreak:'break-word', boxShadow:'0 1px 2px rgba(0,0,0,.3)', position:'relative' }}>
                                <div style={{ direction:'rtl' }}>{msg.message}</div>
                                <div style={{ position:'absolute', bottom:5, left:10, display:'flex', alignItems:'center', gap:3, direction:'ltr', whiteSpace:'nowrap' }}>
                                  <span style={{ fontSize:11, color:'rgba(233,237,239,.55)' }}>{fmtTime(msg.created_at)}</span>
                                  {isOut && <span style={{ fontSize:15, color:WA.tick, lineHeight:1 }}>✓✓</span>}
                                </div>
                              </div>
                            </div>
                          )
                        })
                        return items
                      })()}
                    </div>

                    {/* Input bar */}
                    <div style={{ padding:'8px 14px', background:WA.header, display:'flex', gap:10, alignItems:'center', flexShrink:0, borderTop:`1px solid ${WA.divider}` }}>
                      <input
                        value={chatInput} onChange={e=>setChatInput(e.target.value)}
                        onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatMsg(chatContact)} }}
                        placeholder={lang==='en'?'Type a message':'הקלד הודעה'}
                        disabled={chatSending}
                        style={{ flex:1, padding:'11px 18px', background:'#2A3942', border:'none', borderRadius:24, color:WA.text, fontSize:14, fontFamily:'inherit', outline:'none', direction:'rtl' }}/>
                      <button
                        onClick={()=>sendChatMsg(chatContact)} disabled={chatSending||!chatInput.trim()}
                        style={{ width:46, height:46, borderRadius:'50%', background:chatSending||!chatInput.trim()?'#2A3942':'#00A884', border:'none', color:'#fff', cursor:chatSending||!chatInput.trim()?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s', fontSize:20 }}>
                        {chatSending ? <span style={{ fontSize:13, fontWeight:700 }}>···</span> : '➤'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:18, color:WA.sub }}>
                    <FaWhatsapp size={88} style={{ opacity:.12, color:'#25D366' }}/>
                    <div style={{ fontSize:22, fontWeight:300, color:'#aebac1', letterSpacing:.5 }}>WhatsApp Web</div>
                    <div style={{ fontSize:13, color:WA.sub, maxWidth:300, textAlign:'center', lineHeight:1.7, direction:'rtl' }}>
                      {lang==='en'
                        ? 'Select a contact to view conversation history and send messages'
                        : 'בחר איש קשר מהרשימה לצפייה בהיסטוריית השיחה ולשליחת הודעות'}
                    </div>
                    <div style={{ width:300, height:1, background:WA.divider, marginTop:6 }}/>
                    <div style={{ fontSize:12, color:WA.sub, display:'flex', alignItems:'center', gap:6 }}>
                      <span>🔒</span>
                      <span>{lang==='en'?'Messages sent via Green API':'הודעות נשלחות דרך Green API'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </>
          )
        })()}

        {tab==='settings' && (
          <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

            {/* ── Logo Size ── */}
            <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <span style={{ fontSize:20 }}>🖼</span>
                <div>
                  <h3 style={{ fontSize:14, fontWeight:700, color:C.purple, margin:0 }}>{lang==='en'?'Logo Size':'גודל לוגו'}</h3>
                  <div style={{ fontSize:11, color:`${C.cream}55`, marginTop:3 }}>{lang==='en'?'Adjust the navbar logo size':'שנה את גודל הלוגו בסרגל הניווט'}</div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
                {/* Live preview */}
                <div style={{ background:'rgba(6,5,14,.95)', borderRadius:10, padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'center', border:`1px solid ${C.purple}22`, minWidth:160 }}>
                  <Logo size={logoNavSize}/>
                </div>
                {/* Controls */}
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                    <label style={{ fontSize:11, color:`${C.cream}70`, fontWeight:600, whiteSpace:'nowrap' }}>{lang==='en'?'Size (px):':'גודל (px):'}</label>
                    <input type="number" min={20} max={200} value={logoNavSize}
                      onChange={e => setLogoNavSize(e.target.value)}
                      style={{ width:70, padding:'5px 8px', background:'rgba(255,255,255,.06)', border:`1px solid ${C.purple}33`, borderRadius:7, color:C.cream, fontSize:13, fontFamily:'inherit', outline:'none', textAlign:'center', direction:'ltr' }}/>
                    <span style={{ fontSize:10, color:`${C.cream}40` }}>px</span>
                  </div>
                  <input type="range" min={20} max={200} value={logoNavSize}
                    onChange={e => setLogoNavSize(e.target.value)}
                    style={{ width:'100%', accentColor:C.purple, cursor:'pointer' }}/>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:`${C.cream}30`, marginTop:2 }}>
                    <span>20px</span><span style={{ color:C.purple }}>{logoNavSize}px</span><span>200px</span>
                  </div>
                  <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                    {[40,55,70,90,110].map(s => (
                      <button key={s} onClick={() => setLogoNavSize(s)}
                        style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${logoNavSize===s?C.purple:`${C.purple}22`}`, background:logoNavSize===s?`${C.purple}22`:'transparent', color:logoNavSize===s?C.purple:`${C.cream}55`, fontSize:11, fontWeight:logoNavSize===s?700:400, cursor:'pointer', fontFamily:'inherit' }}>
                        {s}px
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* GovMap API Token */}
            <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <FaMapMarkerAlt size={18} style={{ color:C.purple }}/>
                <div>
                  <h3 style={{ fontSize:14, fontWeight:700, color:C.purple, margin:0 }}>מפתח API של GovMap</h3>
                  <div style={{ fontSize:11, color:`${C.cream}55`, marginTop:3 }}>נדרש להצגת מפות גוש/חלקה בדפי הנכסים</div>
                </div>
              </div>
              <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:6, fontWeight:600 }}>מפתח API (Token)</label>
              <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                <input
                  type="text"
                  value={tokenDraft}
                  onChange={e => { setTokenDraft(e.target.value); setTokenSaved(false) }}
                  placeholder="הדבק כאן את מפתח ה-API שקיבלת מ-GovMap"
                  style={{ ...inp, direction:'ltr', fontFamily:'monospace', fontSize:12, marginBottom:0, flex:1 }}
                />
                <button
                  disabled={tokenSaving || !tokenDraft.trim()}
                  onClick={async () => {
                    if (!tokenDraft.trim()) return
                    setTokenSaving(true); setTokenError(''); setTokenSaved(false)
                    try {
                      const base = API_BASE || ''
                      const r = await fetch(`${base}/api/stats`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
                        body: JSON.stringify({ govmapToken: tokenDraft.trim() }),
                      })
                      if (!r.ok) throw new Error(`שגיאה ${r.status}`)
                      setGovmapToken(tokenDraft.trim())
                      localStorage.setItem('govmap_token', tokenDraft.trim())
                      setTokenSaved(true)
                      setTimeout(() => setTokenSaved(false), 4000)
                    } catch (e) {
                      setTokenError('שגיאה בשמירה — נסה שוב')
                      setTimeout(() => setTokenError(''), 5000)
                    } finally {
                      setTokenSaving(false)
                    }
                  }}
                  style={{ padding:'8px 18px', background: tokenSaved ? C.green : tokenSaving ? `${C.purple}66` : C.purple, border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor: tokenSaving ? 'wait' : 'pointer', fontFamily:'Rubik,inherit', transition:'background .2s', whiteSpace:'nowrap', flexShrink:0, opacity: !tokenDraft.trim() ? 0.4 : 1 }}
                >
                  {tokenSaving ? '⏳ שומר...' : tokenSaved ? '✓ נשמר בענן!' : 'שמור בענן'}
                </button>
              </div>
              {tokenError && <div style={{ fontSize:12, color:'#E05252', marginTop:6, fontWeight:700 }}>⚠ {tokenError}</div>}
              <div style={{ background:`${C.purple}08`, border:`1px solid ${C.purple}22`, borderRadius:8, padding:'12px 14px', fontSize:12, color:`${C.cream}77`, lineHeight:1.8, direction:'rtl', marginTop:10 }}>
                <strong style={{ color:C.purple }}>כיצד לקבל מפתח API:</strong><br/>
                1. כנס לאתר <a href="https://www.govmap.gov.il" target="_blank" rel="noopener noreferrer" style={{ color:C.purple }}>govmap.gov.il</a><br/>
                2. פנה לצוות GovMap בבקשה לרישום דומיין ומפתח API<br/>
                3. הזן כאן את המפתח שתקבל ולחץ <strong>שמור בענן</strong><br/>
                <span style={{ color:`${C.cream}44`, fontSize:11 }}>* המפתח נשמר ב-Supabase ומסונכרן בין כל המכשירים. localStorage משמש כמטמון מהיר בלבד.</span>
              </div>
              {govmapToken && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:12 }}>
                  <span style={{ color:C.green, fontWeight:700 }}>✓ מפתח פעיל: {govmapToken.slice(0,8)}…</span>
                  <button onClick={() => { setGovmapToken(''); setTokenDraft(''); localStorage.removeItem('govmap_token') }} style={{ background:'none', border:'none', color:`${C.cream}55`, cursor:'pointer', fontSize:11, textDecoration:'underline', fontFamily:'inherit' }}>נקה</button>
                </div>
              )}
            </div>

            {/* ── Email Notifications ── */}
            <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <FaEnvelope size={18} style={{ color:'#EA4335' }}/>
                <div>
                  <h3 style={{ fontSize:14, fontWeight:700, color:C.purple, margin:0 }}>התראות אימייל — ליד חדש</h3>
                  <div style={{ fontSize:11, color:`${C.cream}55`, marginTop:3 }}>
                    נשלח אוטומטית אל <strong style={{ color:C.cream }}>afik.hanahal@gmail.com</strong> בכל פנייה חדשה
                  </div>
                </div>
              </div>

              <div style={{ background:`${C.purple}08`, border:`1px solid ${C.purple}22`, borderRadius:8, padding:'12px 14px', fontSize:12, color:`${C.cream}77`, lineHeight:1.9, direction:'rtl', marginBottom:14 }}>
                <strong style={{ color:C.purple }}>הגדרה נדרשת ב-Render (env vars):</strong><br/>
                1. כנס ל-<strong style={{ color:C.cream }}>render.com → שירות שלך → Environment</strong><br/>
                2. הוסף: <code style={{ background:'rgba(0,0,0,.3)', borderRadius:4, padding:'1px 6px', fontFamily:'monospace', fontSize:11, color:'#EA4335' }}>GMAIL_USER</code> = כתובת Gmail שולח (לדוג׳: <code style={{ fontFamily:'monospace', fontSize:11 }}>afik.hanahal@gmail.com</code>)<br/>
                3. הוסף: <code style={{ background:'rgba(0,0,0,.3)', borderRadius:4, padding:'1px 6px', fontFamily:'monospace', fontSize:11, color:'#EA4335' }}>GMAIL_APP_PASSWORD</code> = סיסמת אפליקציה (16 תווים מ-Google)<br/>
                4. לקבל סיסמת אפליקציה: <strong style={{ color:C.cream }}>Google Account → Security → 2-Step Verification → App Passwords</strong><br/>
                <span style={{ color:`${C.cream}44`, fontSize:11 }}>* לאחר הוספת env vars — לחץ "Manual Deploy" ב-Render לפריסה מחדש</span>
              </div>

              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <button onClick={testEmail} disabled={emailTesting}
                  style={{ padding:'9px 20px', background:'rgba(234,67,53,.1)', border:'1px solid rgba(234,67,53,.3)', borderRadius:8, color:'#EA4335', fontWeight:700, fontSize:12, cursor:emailTesting?'not-allowed':'pointer', fontFamily:'inherit' }}>
                  {emailTesting ? '⟳ שולח...' : '✉ שלח אימייל בדיקה'}
                </button>
                {emailTestResult === 'ok'  && <span style={{ fontSize:12, color:C.green, fontWeight:700 }}>✓ אימייל בדיקה נשלח ל-afik.hanahal@gmail.com</span>}
                {emailTestResult === 'err' && <span style={{ fontSize:12, color:'#E05252', fontWeight:700 }}>✕ שגיאה — בדוק GMAIL_USER ו-GMAIL_APP_PASSWORD ב-Render</span>}
              </div>
            </div>

            {/* WhatsApp Automation */}
            <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <FaWhatsapp size={18} style={{ color:'#25D366' }}/>
                  <div>
                    <h3 style={{ fontSize:14, fontWeight:700, color:C.purple, margin:0 }}>WhatsApp אוטומציה</h3>
                    <div style={{ fontSize:11, color:`${C.cream}55`, marginTop:3 }}>שלח הודעה אוטומטית לכל ליד אחרי X דקות</div>
                  </div>
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                  <span style={{ fontSize:12, color:`${C.cream}66`, fontWeight:600 }}>{waSt.enabled ? 'פעיל' : 'כבוי'}</span>
                  <div
                    onClick={() => setWaSt(s => ({ ...s, enabled: !s.enabled }))}
                    style={{ width:44, height:24, borderRadius:12, background: waSt.enabled ? C.green : 'rgba(255,255,255,.12)', cursor:'pointer', position:'relative', transition:'background .2s', flexShrink:0 }}>
                    <div style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%', background:'#fff', left: waSt.enabled ? 23 : 3, transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,.4)' }}/>
                  </div>
                </label>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                {/* Provider */}
                <div>
                  <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:5, fontWeight:600 }}>ספק שירות</label>
                  <select value={waSt.provider || 'greenapi'} onChange={e => setWaSt(s => ({ ...s, provider: e.target.value }))}
                    style={{ ...inp, marginBottom:0, cursor:'pointer' }}>
                    <option value="greenapi">Green API (מומלץ)</option>
                    <option value="ultramsg">UltraMsg</option>
                  </select>
                </div>
                {/* Delay */}
                <div>
                  <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:5, fontWeight:600 }}>עיכוב לפני שליחה (דקות)</label>
                  <input type="number" min="1" max="60" value={waSt.delayMin || 2}
                    onChange={e => setWaSt(s => ({ ...s, delayMin: Number(e.target.value) }))}
                    style={{ ...inp, marginBottom:0 }}/>
                </div>
                {/* Instance ID */}
                <div>
                  <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:5, fontWeight:600 }}>
                    {waSt.provider === 'ultramsg' ? 'Instance ID' : 'idInstance'}
                  </label>
                  <input type="text" value={waSt.instanceId || ''} placeholder="7107558519"
                    onChange={e => setWaSt(s => ({ ...s, instanceId: e.target.value }))}
                    style={{ ...inp, marginBottom:0, direction:'ltr', fontFamily:'monospace', fontSize:12 }}/>
                </div>
                {/* Token */}
                <div>
                  <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:5, fontWeight:600 }}>
                    {waSt.provider === 'ultramsg' ? 'Token' : 'apiTokenInstance'}
                    <span style={{ color:`${C.cream}44`, fontWeight:400, marginRight:6 }}>— חובה</span>
                  </label>
                  <input type="password" value={waSt.token || ''} placeholder="הדבק את apiTokenInstance מ-Green API"
                    onChange={e => setWaSt(s => ({ ...s, token: e.target.value }))}
                    style={{ ...inp, marginBottom:0, direction:'ltr', fontFamily:'monospace', fontSize:12, borderColor: waSt.token ? `${C.purple}44` : 'rgba(247,201,72,.6)' }}/>
                </div>
                {/* API URL — shown only for Green API */}
                {waSt.provider !== 'ultramsg' && (
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:5, fontWeight:600 }}>
                      apiUrl <span style={{ color:`${C.cream}44`, fontWeight:400 }}>— כתובת ה-API של ה-Instance שלך</span>
                    </label>
                    <input type="text" value={waSt.apiUrl || ''} placeholder="https://7107.api.greenapi.com"
                      onChange={e => setWaSt(s => ({ ...s, apiUrl: e.target.value }))}
                      style={{ ...inp, marginBottom:0, direction:'ltr', fontFamily:'monospace', fontSize:12 }}/>
                  </div>
                )}
              </div>

              {/* Message template */}
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:5, fontWeight:600 }}>
                  תוכן ההודעה <span style={{ color:`${C.cream}44`, fontWeight:400 }}>— השתמש ב-{'{name}'} לשם הלקוח</span>
                </label>
                <textarea rows={4} value={waSt.template || WA_DEFAULT_TEMPLATE}
                  onChange={e => setWaSt(s => ({ ...s, template: e.target.value }))}
                  style={{ ...inp, resize:'vertical', marginBottom:0, fontSize:13, lineHeight:1.7 }}/>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button onClick={saveWA}
                  style={{ padding:'9px 20px', background:`${C.purple}22`, border:`1px solid ${C.purple}44`, borderRadius:8, color: waSaved ? C.green : C.purple, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                  {waSaved ? '✓ נשמר' : 'שמור הגדרות'}
                </button>
                <button onClick={testWA} disabled={waTesting || !waSt.instanceId || !waSt.token}
                  style={{ padding:'9px 20px', background:'rgba(130,246,127,.1)', border:'1px solid rgba(130,246,127,.3)', borderRadius:8, color: C.green, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', opacity: (!waSt.instanceId || !waSt.token) ? .45 : 1 }}>
                  {waTesting ? 'שולח...' : 'שלח בדיקה ל-0559811814'}
                </button>
                {waTestResult === 'ok'  && <span style={{ fontSize:12, color:C.green, fontWeight:700 }}>✓ הודעת בדיקה נשלחה!</span>}
                {waTestResult === 'err' && <span style={{ fontSize:12, color:'#E05252', fontWeight:700 }}>✕ שגיאה — בדוק Instance ID ו-Token</span>}
              </div>

              {/* Instructions */}
              <div style={{ background:`${C.green}08`, border:`1px solid ${C.green}33`, borderRadius:8, padding:'12px 14px', fontSize:12, color:`${C.cream}88`, lineHeight:1.9, direction:'rtl', marginTop:14 }}>
                <strong style={{ color:C.green }}>Instance מחובר — Instance 7107558519</strong><br/>
                פעולה אחת נותרה: <strong style={{ color:'rgba(247,201,72,.9)' }}>הדבק את apiTokenInstance</strong> בשדה הטוקן למעלה ←<br/>
                בלוח Green API ← לחץ ליד apiTokenInstance ← העתק ← הדבק ← שמור ← הפעל<br/>
                <span style={{ color:`${C.cream}44`, fontSize:11 }}>* ההודעה תישלח {waSt.delayMin || 2} דקות אחרי שהלקוח ימלא את הטופס, כל עוד הדפדפן פתוח</span>
              </div>
            </div>

            {/* CRM Webhook */}
            <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <FaLink size={16} style={{ color:C.purple }}/>
                <div>
                  <h3 style={{ fontSize:14, fontWeight:700, color:C.purple, margin:0 }}>חיבור CRM — Webhook</h3>
                  <div style={{ fontSize:11, color:`${C.cream}55`, marginTop:3 }}>כל ליד חדש יישלח אוטומטית ל-Zapier / Make.com / HubSpot ועוד</div>
                </div>
              </div>
              <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:6, fontWeight:600 }}>כתובת Webhook</label>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  type="url"
                  value={crmWebhook}
                  onChange={e => { setCrmWebhook(e.target.value); setWebhookSaved(false) }}
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  style={{ ...inp, flex:1, direction:'ltr', fontFamily:'monospace', fontSize:12, marginBottom:0 }}
                />
                <button
                  onClick={() => {
                    const base = API_BASE || ''
                    fetch(`${base}/api/settings`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
                      body: JSON.stringify({ crmWebhook }),
                    }).then(() => { _cloudSettings = { ..._cloudSettings, crmWebhook } }).catch(() => {})
                    setWebhookSaved(true); setTimeout(()=>setWebhookSaved(false), 2500)
                  }}
                  style={{ padding:'9px 18px', background:`${C.purple}22`, border:`1px solid ${C.purple}44`, borderRadius:6, color:C.purple, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0 }}>
                  {webhookSaved ? '✓ נשמר' : 'שמור'}
                </button>
              </div>
              <div style={{ background:`${C.purple}08`, border:`1px solid ${C.purple}22`, borderRadius:8, padding:'12px 14px', fontSize:12, color:`${C.cream}77`, lineHeight:1.8, direction:'rtl', marginTop:12 }}>
                <strong style={{ color:C.purple }}>דוגמאות לחיבור:</strong><br/>
                · <strong>Zapier</strong> — צור Zap עם Trigger "Webhooks by Zapier" ← הדבק את ה-URL כאן<br/>
                · <strong>Make.com</strong> — צור Scenario עם "Webhooks" Module ← הדבק את ה-URL כאן<br/>
                · <strong>HubSpot / Monday</strong> — השתמש ב-Zapier/Make כגשר לסנכרון ישיר<br/>
                <span style={{ color:`${C.cream}44`, fontSize:11 }}>* הנתונים נשלחים כ-JSON: name, phone, email, msg, propTitle, ts</span>
              </div>
              {crmWebhook && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:12 }}>
                  <span style={{ color:C.green, fontWeight:700 }}>✓ Webhook מוגדר</span>
                  <button onClick={() => {
                    setCrmWebhook('')
                    const base = API_BASE || ''
                    fetch(`${base}/api/settings`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
                      body: JSON.stringify({ crmWebhook: '' }),
                    }).then(() => { _cloudSettings = { ..._cloudSettings, crmWebhook: '' } }).catch(() => {})
                  }} style={{ background:'none', border:'none', color:`${C.cream}55`, cursor:'pointer', fontSize:11, textDecoration:'underline', fontFamily:'inherit' }}>נקה</button>
                </div>
              )}
            </div>

            {/* ── Meta WhatsApp Business API Bot ─────────────────────────── */}
            <MetaWABotCard C={C} isDark={isDark}/>

            {/* GovMap Management Panel */}
            {govmapToken ? (
              <div style={{ background:'rgba(255,255,255,.02)', borderRadius:12, border:`1px solid ${C.purple}22`, overflow:'hidden' }}>
                {/* Tab bar */}
                <div style={{ display:'flex', borderBottom:`1px solid ${C.purple}22` }}>
                  {[
                    { id:'map',    icon:'🗺️', label:'מפה חיה'         },
                    { id:'layers', icon:'⏏',  label:'ניהול שכבות'     },
                    { id:'bg',     icon:'🌍',  label:'ניהול מפות רקע'  },
                  ].map(t => (
                    <button key={t.id} onClick={() => setGmTab(t.id)}
                      style={{ flex:1, padding:'12px 8px', background: gmTab===t.id ? `${C.purple}22` : 'transparent',
                        border:'none', borderBottom: gmTab===t.id ? `2px solid ${C.purple}` : '2px solid transparent',
                        color: gmTab===t.id ? C.purple : `${C.cream}66`, fontWeight:700, fontSize:12,
                        cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all .15s' }}>
                      <span>{t.icon}</span>{t.label}
                    </button>
                  ))}
                </div>

                {/* Tab: מפה חיה */}
                {gmTab === 'map' && (
                  <div style={{ padding:0 }}>
                    <GovMapWidget token={govmapToken} C={C} isDark={isDark} />
                  </div>
                )}

                {/* Tab: ניהול שכבות */}
                {gmTab === 'layers' && (
                  <div style={{ padding:20 }}>
                    <div style={{ fontSize:12, color:`${C.cream}66`, marginBottom:16, lineHeight:1.7 }}>
                      בחר אילו שכבות יוצגו כברירת מחדל בכל מפות הנכסים באתר. המבקרים יוכלו לשנות זאת בעצמם בכל מפה.
                    </div>
                    {GM_LAYER_CATS.map(cat => (
                      <div key={cat} style={{ marginBottom:16 }}>
                        <div style={{ fontSize:10, fontWeight:800, color:`${C.cream}44`, letterSpacing:'.08em', textTransform:'uppercase', marginBottom:8, paddingBottom:4, borderBottom:`1px solid ${C.purple}18` }}>{cat}</div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                          {GM_LAYERS.filter(l => l.cat === cat).map(l => (
                            <label key={l.id} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'8px 12px', background: gmLayers[l.id] ? `${C.purple}15` : 'rgba(255,255,255,.03)', borderRadius:8, border:`1px solid ${gmLayers[l.id] ? C.purple+'44' : C.purple+'15'}`, transition:'all .15s' }}>
                              <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${gmLayers[l.id] ? l.color : `${C.cream}28`}`, background: gmLayers[l.id] ? l.color : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all .15s' }}>
                                {gmLayers[l.id] && <span style={{ color:'#fff', fontSize:10, fontWeight:900, lineHeight:1 }}>✓</span>}
                              </div>
                              <input type="checkbox" checked={!!gmLayers[l.id]}
                                onChange={() => setGmLayers(p => ({ ...p, [l.id]: !p[l.id] }))}
                                style={{ display:'none' }} />
                              <span style={{ fontSize:12, color:C.cream, fontWeight:gmLayers[l.id] ? 700 : 400, display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{ width:8, height:8, borderRadius:2, background:l.color, flexShrink:0 }}/>
                                {l.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button onClick={saveGmDefaults}
                      style={{ padding:'10px 24px', background: gmSaved ? `${C.green}22` : `${C.purple}22`, border:`1px solid ${gmSaved ? C.green+'44' : C.purple+'44'}`, borderRadius:8, color: gmSaved ? C.green : C.purple, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', transition:'all .2s', marginTop:4 }}>
                      {gmSaved ? '✓ נשמר!' : 'שמור ברירות מחדל'}
                    </button>
                  </div>
                )}

                {/* Tab: ניהול מפות רקע */}
                {gmTab === 'bg' && (
                  <div style={{ padding:20 }}>
                    <div style={{ fontSize:12, color:`${C.cream}66`, marginBottom:16, lineHeight:1.7 }}>
                      בחר את רקע המפה שיוצג כברירת מחדל לכל הנכסים. המבקרים יוכלו לשנות זאת בעצמם.
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {GM_BG_OPTIONS.map(opt => (
                        <label key={opt.v} style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'12px 16px', background: gmBg===opt.v ? `${C.purple}18` : 'rgba(255,255,255,.03)', borderRadius:10, border:`1px solid ${gmBg===opt.v ? C.purple+'55' : C.purple+'15'}`, transition:'all .15s' }}>
                          <div style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${gmBg===opt.v ? C.purple : `${C.cream}33`}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            {gmBg===opt.v && <div style={{ width:9, height:9, borderRadius:'50%', background:C.purple }}/>}
                          </div>
                          <input type="radio" name="gmBg" value={opt.v} checked={gmBg===opt.v}
                            onChange={() => { setGmBg(opt.v) }}
                            style={{ display:'none' }} />
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:C.cream }}>{opt.label}</div>
                            <div style={{ fontSize:11, color:`${C.cream}55` }}>{{ '2':'תצלום אוויר + רחובות', '1':'תצלום לוויין בלבד', '0':'מפת רחובות ומבנים', '9':'גבהים ושטחים', '3':'אינפרא-אדום' }[opt.v]}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                    <button onClick={saveGmDefaults}
                      style={{ padding:'10px 24px', background: gmSaved ? `${C.green}22` : `${C.purple}22`, border:`1px solid ${gmSaved ? C.green+'44' : C.purple+'44'}`, borderRadius:8, color: gmSaved ? C.green : C.purple, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', transition:'all .2s', marginTop:16 }}>
                      {gmSaved ? '✓ נשמר!' : 'שמור ברירת מחדל'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background:'rgba(255,255,255,.02)', borderRadius:12, padding:20, border:`1px solid ${C.purple}15`, textAlign:'center', color:`${C.cream}55`, fontSize:13 }}>
                הגדר מפתח API של GovMap למעלה כדי לנהל שכבות ומפות רקע
              </div>
            )}
          </div>
        )}
        </div>

        {/* ── Wizard overlay — standalone mode only ───────────────────── */}
        {standalone && wizardOpen && (
          <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,.97)', backdropFilter:'blur(4px)' }}>
            <PropertyWizard
              onClose={() => setWizardOpen(false)}
              onPublish={(prop) => {
                setProperties(prev => [...prev, prop])
                saveProp(prop)
                setWizardOpen(false)
                setTab('props')
              }}
            />
          </div>
        )}

      </div>

      {/* ── Mobile bottom tab bar — standalone only ──────────────────── */}
      {standalone && (
        <nav className="admin-bottom-nav">
          {DASH_TABS.slice(0,5).map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:'none', background:'transparent', color: tab===item.id ? '#8490D8' : 'rgba(232,228,216,.32)', cursor:'pointer', fontFamily:'inherit', padding:'8px 4px', position:'relative', transition:'color .15s', minWidth:0 }}>
              <item.Icon size={18}/>
              <span style={{ fontSize:9, fontWeight: tab===item.id ? 700 : 400, letterSpacing:'.02em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%' }}>{item.label}</span>
              {!!item.badge && <span style={{ position:'absolute', top:6, right:'50%', transform:'translateX(140%)', background:'#8490D8', color:'#fff', borderRadius:8, padding:'1px 5px', fontSize:8, fontWeight:800, lineHeight:1.6 }}>{item.badge}</span>}
              {tab===item.id && <div style={{ position:'absolute', top:0, left:'15%', right:'15%', height:2, background:'#8490D8', borderRadius:2 }}/>}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}

// ─── META WHATSAPP BOT SETTINGS CARD ─────────────────────────────────────────
const META_WA_KEY = 'afik_meta_wa'
const META_WA_DEFAULT_PROMPT = `אתה עוזר מכירות ושירות לקוחות של חברת "אפיק הנחל". ענה בעברית, בסגנון חם ומקצועי. תמיד הצע ללקוח להשאיר פרטים לחזרה. טלפון לייעוץ: 055-981-1814`

function MetaWABotCard({ C, isDark }) {
  const [cfg, setCfg] = useState(() => {
    try { return { enabled: true, prompt: META_WA_DEFAULT_PROMPT, ...JSON.parse(localStorage.getItem(META_WA_KEY) || '{}') } }
    catch { return { enabled: true, prompt: META_WA_DEFAULT_PROMPT } }
  })
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testRes, setTestRes] = useState(null)
  const PHONE_NUMBER_ID = '1160230953835065'
  const WA_TOKEN = 'EAAnqYHiWM8cBRY4NZCJoUxhn41ETA9XiODRsPtkbkZAeyNULZBgJJBWcgdpaL0nrJVKw0y8PGD9XOiMXyacGlYTWS0HC41GguWbdMIUQn3NZBScF7guZCD9bwZAZAa4v0nI2ht4nrmF4CY0ayni8TKSVWSkoM2ywMRC9GSTp2nHSOxSm6RZB7tnDjRvdEN75LP5EWSsUe9oaxMpuojrdctDV8bkXuuI27N9nwh3E9kviZBZBZAYVcw054i9hd7wXmQTGvL7MkfZApzQjHluRBWaY2wOR'
  const WEBHOOK_URL = 'https://afikhanahal.co.il/api/whatsapp'

  function save() {
    localStorage.setItem(META_WA_KEY, JSON.stringify(cfg))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function sendTestMessage() {
    setTesting(true)
    setTestRes(null)
    try {
      const resp = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WA_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '972559811814',
          type: 'template',
          template: { name: 'hello_world', language: { code: 'en_US' } },
        }),
      })
      const data = await resp.json()
      setTestRes(resp.ok ? 'ok' : `err:${data?.error?.message || resp.status}`)
    } catch (e) {
      setTestRes(`err:${e.message}`)
    }
    setTesting(false)
  }

  const inp = { width:'100%', padding:'10px 12px', background:'rgba(255,255,255,.05)', border:`1px solid ${C.purple}33`, borderRadius:8, color:C.cream, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box', marginBottom:10 }

  return (
    <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <FaRobot size={18} style={{ color:'#25D366' }}/>
          <div>
            <h3 style={{ fontSize:14, fontWeight:700, color:C.purple, margin:0 }}>WhatsApp Bot — Meta Business API</h3>
            <div style={{ fontSize:11, color:`${C.cream}55`, marginTop:3 }}>בוט AI שעונה ללקוחות אוטומטית דרך ה-API הרשמי של Meta</div>
          </div>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
          <span style={{ fontSize:12, color:`${C.cream}66`, fontWeight:600 }}>{cfg.enabled ? 'פעיל' : 'כבוי'}</span>
          <div onClick={() => setCfg(s => ({ ...s, enabled: !s.enabled }))}
            style={{ width:44, height:24, borderRadius:12, background: cfg.enabled ? C.green : 'rgba(255,255,255,.12)', cursor:'pointer', position:'relative', transition:'background .2s', flexShrink:0 }}>
            <div style={{ position:'absolute', top:3, width:18, height:18, borderRadius:'50%', background:'#fff', left: cfg.enabled ? 23 : 3, transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,.4)' }}/>
          </div>
        </label>
      </div>

      {/* Credentials block */}
      <div style={{ background:`${C.purple}0A`, border:`1px solid ${C.purple}22`, borderRadius:8, padding:'12px 14px', marginBottom:14, fontSize:12, color:`${C.cream}99`, lineHeight:2 }}>
        <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'0 12px', alignItems:'center' }}>
          <span style={{ color:`${C.cream}55`, fontWeight:600 }}>Phone Number ID</span>
          <span style={{ fontFamily:'monospace', color:C.green }}>{PHONE_NUMBER_ID}</span>
          <span style={{ color:`${C.cream}55`, fontWeight:600 }}>WABA ID</span>
          <span style={{ fontFamily:'monospace', color:C.green }}>809619412006618</span>
          <span style={{ color:`${C.cream}55`, fontWeight:600 }}>Webhook URL</span>
          <span style={{ fontFamily:'monospace', color:C.purple, fontSize:11 }}>{WEBHOOK_URL}</span>
          <span style={{ color:`${C.cream}55`, fontWeight:600 }}>Verify Token</span>
          <span style={{ fontFamily:'monospace', color:'#F7C948' }}>AFIKhanahal2026</span>
        </div>
      </div>

      {/* System prompt */}
      <div style={{ marginBottom:12 }}>
        <label style={{ fontSize:11, color:`${C.cream}70`, display:'block', marginBottom:5, fontWeight:600 }}>System Prompt — הנחיות לבוט</label>
        <textarea rows={5} value={cfg.prompt}
          onChange={e => setCfg(s => ({ ...s, prompt: e.target.value }))}
          style={{ ...inp, resize:'vertical', marginBottom:0, fontSize:12, lineHeight:1.7 }}/>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <button onClick={save}
          style={{ padding:'9px 20px', background:`${C.purple}22`, border:`1px solid ${C.purple}44`, borderRadius:8, color: saved ? C.green : C.purple, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          {saved ? '✓ נשמר' : 'שמור הגדרות'}
        </button>
        <button onClick={sendTestMessage} disabled={testing}
          style={{ padding:'9px 20px', background:'rgba(130,246,127,.1)', border:'1px solid rgba(130,246,127,.3)', borderRadius:8, color:C.green, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', opacity: testing ? .6 : 1 }}>
          {testing ? 'שולח...' : 'שלח הודעת בדיקה ל-0559811814'}
        </button>
        {testRes === 'ok' && <span style={{ fontSize:12, color:C.green, fontWeight:700 }}>✓ נשלח בהצלחה!</span>}
        {testRes && testRes.startsWith('err:') && <span style={{ fontSize:12, color:'#E05252', fontWeight:700 }}>✕ {testRes.slice(4)}</span>}
      </div>

      {/* Setup instructions */}
      <div style={{ background:`rgba(37,211,102,.07)`, border:`1px solid rgba(37,211,102,.25)`, borderRadius:8, padding:'12px 14px', fontSize:12, color:`${C.cream}88`, lineHeight:1.9, direction:'rtl', marginTop:14 }}>
        <strong style={{ color:C.green }}>הגדרת ה-Webhook במרכז Meta:</strong><br/>
        1. כנס ל-<strong style={{ color:'#1877F2' }}>Meta for Developers → WhatsApp → Configuration</strong><br/>
        2. הגדר Webhook URL: <span style={{ fontFamily:'monospace', color:C.purple }}>{WEBHOOK_URL}</span><br/>
        3. הגדר Verify Token: <span style={{ fontFamily:'monospace', color:'#F7C948' }}>AFIKhanahal2026</span><br/>
        4. הפעל Subscribe על: <strong>messages</strong><br/>
        5. פרוס לאויר דרך Vercel — הבוט יתחיל לענות אוטומטית ✓<br/>
        <span style={{ color:`${C.cream}44`, fontSize:11 }}>* Google Tag Manager (GTM-MZZ8QR8V) כבר מוטמע ופועל</span>
      </div>
    </div>
  )
}

// ─── PASSWORD PROMPT ──────────────────────────────────────────────────────────
function PasswordPrompt({ onSuccess, onClose }) {
  const { C } = useTheme()
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const CORRECT = 'AFIKhanahal2026'
  const attempt = () => { if (pw === CORRECT) { setErr(false); onSuccess() } else setErr(true) }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', backdropFilter:'blur(12px)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:C.card, border:`1px solid ${C.purple}33`, borderRadius:20, padding:40, maxWidth:360, width:'90%', direction:'rtl', boxShadow:`0 32px 80px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.1)` }}>
        <h3 style={{ fontSize:18, fontWeight:700, color:C.cream, marginBottom:20, textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><FaLock size={15} style={{ color:C.purple }}/> כניסת מנהל</h3>
        <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(false) }} onKeyDown={e => { if (e.key==='Enter') attempt() }}
          placeholder="הכנס סיסמה" autoFocus
          style={{ width:'100%', padding:'12px 16px', background:'rgba(255,255,255,.05)', border:`1px solid ${err ? '#E05252' : C.purple+'33'}`, borderRadius:10, color:C.cream, fontSize:14, fontFamily:'inherit', outline:'none', marginBottom:err?6:16, direction:'rtl' }}/>
        {err && <div style={{ color:'#E05252', fontSize:12, marginBottom:12, textAlign:'center' }}>סיסמה שגויה</div>}
        <div style={{ display:'flex', gap:12 }}>
          <button onClick={attempt} className="primary-btn" style={{ flex:1, borderRadius:10, fontSize:14, padding:12 }}>כניסה</button>
          <button onClick={onClose} style={{ padding:'12px 20px', background:'rgba(255,255,255,.06)', border:`1px solid ${C.purple}33`, borderRadius:10, color:C.cream, cursor:'pointer', fontFamily:'inherit' }}>ביטול</button>
        </div>
      </div>
    </div>
  )
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
const TESTIMONIALS_DATA = [
  {
    quote: 'אפיק הנחל סייעו לנו למצוא מגרש בלעדי באזור השרון שלא היה חשוף לקהל הרחב. הליווי המקצועי, מהפנייה הראשונה ועד סגירת העסקה, היה אישי, מסור ויוצא דופן.',
    en_quote: 'Afik Hanahal helped us find an exclusive plot in the Sharon region that was not exposed to the general public. The professional guidance, from the first inquiry to closing the deal, was personal, dedicated and exceptional.',
    name: 'עו״ד גיא מוסרי', en_name: 'Adv. Guy Musseri', designation: 'משרד מוסרי & מורן חביב ושות׳',
    en_designation: 'Moseri & Moran Haviv & Co. Law Office',
    src: '/Doron Yaffe.png',
    imgFit: 'cover', imgPos: 'center top',
  },
  {
    quote: 'ישראל בן יהודה הוא מתווך מקצועי, אמין ומסור, עם שירות אישי וליווי ברמה גבוהה לאורך כל הדרך. שילוב נדיר של מקצוענות, יושרה והיכרות עמוקה עם שוק הנדל״ן באזור השרון. קשוב, סבלני וממוקד בתוצאות, מומלץ בחום.',
    en_quote: 'Israel Ben-Yehuda is a professional, reliable and dedicated broker, with personal service and high-level guidance throughout. A rare combination of professionalism, integrity and deep knowledge of the Sharon real estate market. Attentive, patient and results-focused — highly recommended.',
    name: 'פינחסי ג׳ימי', en_name: 'Jimmy Pinhasi', designation: 'שמאי מקרקעין',
    en_designation: 'Real Estate Appraiser',
    src: '/pinhasi-jimmy.png',
    imgFit: 'cover', imgPos: 'center top',
  },
  {
    quote: 'ביצענו כמה עסקאות קרקע דרך אפיק הנחל. הם תמיד מוצאים נכסים עם פוטנציאל אמיתי, הרבה לפני שהם מגיעים לשוק הפתוח.',
    en_quote: 'We have completed several land deals through Afik Hanahal. They always find properties with real potential, well before they reach the open market.',
    name: 'תומר צליח', en_name: 'Tomer Tzaliah', designation: 'חברת צליח רוטשילד',
    en_designation: 'Tzaliah Rothschild Company',
    src: '/tomer-tzaliah.png',
    imgFit: 'cover', imgPos: 'center 18%',
  },
  {
    quote: 'חיפשנו מגרש לצמודת קרקע עם תקציב מוגבל. הצוות של אפיק הנחל הבין בדיוק מה אנחנו צריכים ומצאו לנו את הפתרון המושלם.',
    en_quote: 'We were looking for a plot for a detached house on a limited budget. The Afik Hanahal team understood exactly what we needed and found us the perfect solution.',
    name: 'דורון יפה', en_name: 'Doron Yaffe', designation: 'יזם בתחום הנדל״ן',
    en_designation: 'Real Estate Developer',
    src: '/Guy Musseri.png',
    imgFit: 'cover', imgPos: 'center top',
  },
  {
    quote: 'במהלך כ־20 שנות עבודה משותפת עם ישראל בן יהודה, הכרתי איש מקצוע יוצא דופן בתחום הנדל״ן, הקרקעות והיזמות. ישראל משלב מקצועיות, ניסיון רב, יושרה ואמינות ללא פשרות, לצד יכולת לזהות הזדמנויות ולהוביל עסקאות באחריות וביסודיות. אני ממליץ עליו בלב שלם לכל מי שמחפש ליווי מקצועי ואמין.',
    en_quote: 'Over nearly 20 years of working alongside Israel Ben-Yehuda, I have come to know an exceptional professional in real estate, land, and development. Israel combines professionalism, extensive experience, integrity and uncompromising reliability with the ability to identify opportunities and lead transactions with responsibility and thoroughness. I recommend him wholeheartedly to anyone seeking professional and trustworthy guidance.',
    name: 'עו״ד אסף שובלי', en_name: 'Adv. Assaf Shovali', designation: '',
    en_designation: '',
    firm: 'משרד עו״ד שובלי ושות׳', en_firm: 'Shobali & Co. Law Office',
    src: '/Assaf-Shovali.png',
    imgFit: 'cover', imgPos: 'center top',
  },
]

// ─── NEWS SECTION ─────────────────────────────────────────────────────────────
const ROTATION_STORE = 'afik_rotation_v5'   // daily-rotation persistent store
const ARCHIVE_STORE  = 'afik_archive_v1'
const SLOT_COUNT     = 4
const SERVER_URL     = import.meta.env.VITE_API_URL || 'https://afik-hanahal-server.onrender.com'


// ── Fetch articles — parallel merge from Vercel + Render ──────────────────
async function fetchFreshArticles() {
  const [vercelRes, renderRes] = await Promise.allSettled([
    fetch('/api/news', { signal: AbortSignal.timeout(22000) })
      .then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(`${SERVER_URL}/api/news/feed`, { signal: AbortSignal.timeout(22000) })
      .then(r => r.ok ? r.json() : []).catch(() => []),
  ])

  const vercelData = (vercelRes.status === 'fulfilled' && Array.isArray(vercelRes.value)) ? vercelRes.value : []
  const renderData = (renderRes.status === 'fulfilled' && Array.isArray(renderRes.value)) ? renderRes.value : []

  // Merge and deduplicate — Render articles first so it wins on duplicates vs Vercel
  const seen = new Set()
  const merged = [...renderData, ...vercelData].filter(a => {
    if (!a.title || !(a.url || a.link)) return false
    const k = (a.title || '').replace(/\s+/g, '').slice(0, 30)
    if (seen.has(k)) return false
    seen.add(k); return true
  })

  if (merged.length) return merged

  // Last resort: Supabase-cached read from Render
  try {
    const r = await fetch(`${SERVER_URL}/api/news`, { signal: AbortSignal.timeout(10000) })
    if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d.length) return d }
  } catch {}

  return []
}

// Returns today's date string in Israel timezone (for daily rotation key)
function getIsraelDateStr() {
  return new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Jerusalem' })
}
// Returns current hour in Israel time (0-23)
function getIsraelHour() {
  return parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem', hour: 'numeric', hour12: false }), 10)
}

function useRotatingNews() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)

  const run = useCallback(async (forceReset = false) => {
    setLoading(true); setError(false)

    const CACHE_KEY   = 'afik_news_cache_v10'
    const DAILY_KEY   = 'afik_daily_rotation'
    const DISPLAY_KEY = 'afik_display_v2'
    const now = Date.now()

    const todayStr   = getIsraelDateStr()
    const hourNow    = getIsraelHour()
    const lastDaily  = localStorage.getItem(DAILY_KEY) || ''
    const needsDaily = hourNow >= 8 && lastDaily !== todayStr

    // Serve from display cache when pool is still fresh and no rotation pending
    if (!forceReset && !needsDaily) {
      try {
        const display = JSON.parse(localStorage.getItem(DISPLAY_KEY) || 'null')
        const cache   = JSON.parse(localStorage.getItem(CACHE_KEY)   || 'null')
        if (display?.articles?.length >= SLOT_COUNT && cache?.ts && (now - cache.ts) < 30 * 60 * 1000) {
          setArticles(display.articles.slice(0, SLOT_COUNT))
          setLoading(false); return
        }
      } catch {}
    }

    const fresh = await fetchFreshArticles()

    if (!fresh.length) {
      try {
        const display = JSON.parse(localStorage.getItem(DISPLAY_KEY) || 'null')
        if (display?.articles?.length) { setArticles(display.articles.slice(0, SLOT_COUNT)); setLoading(false); return }
      } catch {}
      setError(true); setLoading(false); return
    }

    // Deduplicate fresh pool + images first
    const seen = new Set()
    const deduped = fresh
      .filter(a => {
        if (!a.title || !a.url) return false
        const k = a.title.replace(/\s+/g,'').slice(0, 30)
        if (seen.has(k)) return false
        seen.add(k); return true
      })
      .map(a => ({ ...a, image: a.image || '' }))
      .slice(0, 50)
    const prioritized = [...deduped.filter(a => a.image), ...deduped.filter(a => !a.image)]

    // Load the currently displayed 4 articles
    let currentDisplay = []
    try {
      const d = JSON.parse(localStorage.getItem(DISPLAY_KEY) || 'null')
      currentDisplay = d?.articles || []
    } catch {}

    let newDisplay

    if (forceReset || currentDisplay.length < SLOT_COUNT) {
      // First load or manual reset — show top SLOT_COUNT (images preferred)
      newDisplay = prioritized.slice(0, SLOT_COUNT)
    } else if (needsDaily) {
      // Daily 08:00 slide: archive the oldest slot, inject 1 new article at the front
      const oldest = currentDisplay[SLOT_COUNT - 1]
      if (oldest) {
        try {
          const arch  = JSON.parse(localStorage.getItem(ARCHIVE_STORE) || '[]')
          const seenT = new Set(arch.map(a => a.title?.replace(/\s+/g,'').slice(0, 30)))
          const seenU = new Set(arch.map(a => a.link || a.url || '').filter(Boolean))
          const k = oldest.title?.replace(/\s+/g,'').slice(0, 30)
          const u = oldest.link || oldest.url || ''
          if (k && !seenT.has(k) && (!u || !seenU.has(u))) {
            arch.unshift({ ...oldest, archivedAt: now })
            localStorage.setItem(ARCHIVE_STORE, JSON.stringify(arch.slice(0, 200)))
          }
        } catch {}
      }
      // Find the best article not already in current display (with image preferred)
      const curIds    = new Set(currentDisplay.map(a => a.id))
      const curTitles = new Set(currentDisplay.map(a => a.title?.replace(/\s+/g,'').slice(0, 30)))
      const isNew = a => !curIds.has(a.id) && !curTitles.has(a.title?.replace(/\s+/g,'').slice(0, 30))
      const newArticle = prioritized.find(isNew)
      newDisplay = newArticle
        ? [newArticle, ...currentDisplay.slice(0, SLOT_COUNT - 1)]
        : currentDisplay.slice(0, SLOT_COUNT)
      localStorage.setItem(DAILY_KEY, todayStr)
    } else {
      // Stale cache refresh — keep current display stable, just refresh the pool
      newDisplay = currentDisplay.slice(0, SLOT_COUNT)
    }

    // Archive all pool articles not currently displayed
    try {
      const displayedIds = new Set(newDisplay.map(a => a.id))
      const arch  = JSON.parse(localStorage.getItem(ARCHIVE_STORE) || '[]')
      const seenT = new Set(arch.map(a => a.title?.replace(/\s+/g,'').slice(0, 30)))
      const seenU = new Set(arch.map(a => a.link || a.url || '').filter(Boolean))
      prioritized.filter(a => !displayedIds.has(a.id)).forEach(a => {
        const k = a.title?.replace(/\s+/g,'').slice(0, 30)
        const u = a.link || a.url || ''
        if (k && !seenT.has(k) && (!u || !seenU.has(u))) {
          arch.unshift({ ...a, archivedAt: now })
          seenT.add(k)
          if (u) seenU.add(u)
        }
      })
      localStorage.setItem(ARCHIVE_STORE, JSON.stringify(arch.slice(0, 200)))
    } catch {}

    try { localStorage.setItem(CACHE_KEY,   JSON.stringify({ articles: prioritized, ts: now })) } catch {}
    try { localStorage.setItem(DISPLAY_KEY, JSON.stringify({ articles: newDisplay })) } catch {}

    setArticles(newDisplay.slice(0, SLOT_COUNT))
    setLoading(false)
  }, [])

  useEffect(() => { run() }, [run])

  return { articles, loading, error, reload: () => run(true) }
}

// Client-side og:image fallback via CORS proxy — fires when server-side image is missing
function useOGImage(articleUrl, hasExistingImage, delayMs) {
  const [ogImage, setOgImage] = useState('')
  useEffect(() => {
    if (hasExistingImage || !articleUrl) return
    let cancelled = false
    const timer = setTimeout(async () => {
      if (cancelled) return
      try {
        const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(articleUrl)}`
        const r = await fetch(proxy, { signal: AbortSignal.timeout(12000) })
        if (!r.ok || cancelled) return
        const json = await r.json()
        if (cancelled || !json.contents) return
        const html = json.contents
        const m = (
          html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
          html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
        )
        if (m?.[1] && !cancelled) {
          setOgImage(m[1].replace(/&amp;/g,'&').replace(/&quot;/g,'"'))
        }
      } catch {}
    }, delayMs)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [articleUrl, hasExistingImage, delayMs])
  return ogImage
}

function NewsCard({ article, C, cardIndex = 0 }) {
  const [hov, setHov]         = useState(false)
  const [imgReady, setImgReady] = useState(false)
  const [imgErr, setImgErr]   = useState(false)
  const delayMs = useRef(cardIndex * 400 + Math.floor(Math.random() * 300)).current
  const ogImage = useOGImage(article.link || article.url, !!article.image, delayMs)
  const displayImage = (!imgErr && (article.image || ogImage)) || ''

  const dateStr = article.date instanceof Date && article.date.getTime() > 0
    ? article.date.toLocaleDateString('he-IL', { day:'numeric', month:'long' })
    : ''

  return (
    <a href={article.link} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display:'flex', flexDirection:'column', background:'var(--c-card,#0E0E1C)', border:`1px solid ${hov ? 'rgba(132,144,216,.38)' : 'rgba(132,144,216,.1)'}`, borderRadius:0, overflow:'hidden', textDecoration:'none', transition:'transform .28s cubic-bezier(.16,1,.3,1), box-shadow .28s, border-color .2s', transform:hov?'translateY(-5px)':'', boxShadow:hov?'0 22px 50px rgba(0,0,0,.28)':'' }}>

      <div style={{ aspectRatio:'16/9', overflow:'hidden', background:`rgba(132,144,216,.06)`, position:'relative', flexShrink:0 }}>
        {/* Shimmer until image loads */}
        {!imgReady && !imgErr && (
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg,rgba(132,144,216,.12) 25%,rgba(132,144,216,.28) 50%,rgba(132,144,216,.12) 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.6s ease-in-out infinite' }}/>
        )}
        {displayImage ? (
          <img src={displayImage} alt={article.title}
            referrerPolicy="no-referrer"
            onLoad={() => setImgReady(true)}
            onError={() => setImgErr(true)}
            style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'opacity .35s, transform .5s', opacity:imgReady?1:0, transform:hov?'scale(1.05)':'scale(1)' }}/>
        ) : imgErr ? (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:`linear-gradient(135deg,rgba(132,144,216,.1),rgba(130,246,127,.04))` }}>
            <FaFileAlt size={28} style={{ color:'rgba(132,144,216,.2)' }}/>
          </div>
        ) : null}
        {article.source && (
          <span style={{ position:'absolute', top:10, right:10, background:'rgba(0,0,0,.82)', backdropFilter:'blur(6px)', color:'rgba(232,228,216,.9)', borderRadius:4, padding:'3px 9px', fontSize:10, fontWeight:700, zIndex:2 }}>
            {article.source}
          </span>
        )}
        {dateStr && (
          <span style={{ position:'absolute', bottom:10, left:10, background:'rgba(0,0,0,.82)', backdropFilter:'blur(6px)', color:'rgba(232,228,216,.92)', borderRadius:5, padding:'5px 11px', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:6, zIndex:2, letterSpacing:'.01em' }}>
            <FaCalendarAlt size={9}/>{dateStr}
          </span>
        )}
      </div>

      <div style={{ padding:'16px 18px 18px', flex:1, display:'flex', flexDirection:'column', gap:8 }}>
        <h3 style={{ fontSize:14, fontWeight:700, color:'var(--c-cream,#E8E4D8)', lineHeight:1.48, margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {article.title}
        </h3>
        {article.desc && (
          <p style={{ fontSize:12, color:'rgba(232,228,216,.52)', lineHeight:1.65, margin:0, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
            {article.desc}
          </p>
        )}
        <div style={{ marginTop:'auto', paddingTop:10, display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, color:'var(--c-purple,#8490D8)' }}>
          קרא עוד <FaChevronLeft size={9}/>
        </div>
      </div>
    </a>
  )
}

function NewsSkeletonCard({ C }) {
  return (
    <div style={{ background:C.card, borderRadius:0, overflow:'hidden', border:`1px solid ${C.purple}10` }}>
      <div style={{ aspectRatio:'16/9', background:`${C.purple}08`, animation:'pulse 1.5s ease-in-out infinite' }}/>
      <div style={{ padding:'16px 18px 20px', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ height:14, borderRadius:4, background:`${C.cream}0A`, width:'90%' }}/>
        <div style={{ height:14, borderRadius:4, background:`${C.cream}08`, width:'70%' }}/>
        <div style={{ height:10, borderRadius:4, background:`${C.cream}06`, width:'50%', marginTop:4 }}/>
        <div style={{ height:10, borderRadius:4, background:`${C.purple}14`, width:'35%', marginTop:8 }}/>
      </div>
    </div>
  )
}

const ARCHIVE_PREFILL_QUERIES = [
  'נדלן ישראל', 'דירות ישראל', 'שוק הנדלן ישראל',
  'רכישת דירה', 'מחירי דירות ישראל', 'בנייה והתחדשות עירונית',
  'קרקעות ומגרשים ישראל', 'משכנתאות ריבית ישראל', 'השקעות נדלן ישראל',
  'שרון נדלן', 'מגורים חדשים ישראל', 'שכירות ישראל',
]

// ─── Static archive — guaranteed base content shown even without live feeds ───
const STATIC_ARCHIVE = [
  { id:'sa-01', title:'מחירי הדירות בישראל עלו ב-7.2% בשנת 2024 — הנתונים המלאים',                       source:'גלובס',     link:'https://www.globes.co.il/news/home.aspx?fid=3',                      date:new Date('2025-04-12'), image:'' },
  { id:'sa-02', title:'השרון: הביקוש לקרקעות בנייה שבר שיאים — מה מאחורי הגל?',                          source:'TheMarker', link:'https://www.themarker.com/realestate',                               date:new Date('2025-03-28'), image:'' },
  { id:'sa-03', title:'בנק ישראל ומשכנתאות: המדריך המקיף לרוכשי דירה ראשונה',                             source:'כלכליסט',   link:'https://www.calcalist.co.il/real-estate',                            date:new Date('2025-03-15'), image:'' },
  { id:'sa-04', title:'תמ"א 38 לאחר הרפורמה — הזדמנות חדשה לבעלי קרקע',                                  source:'Ynet',      link:'https://www.ynet.co.il/economy/realestate',                         date:new Date('2025-02-20'), image:'' },
  { id:'sa-05', title:'עסקאות קרקע בשיא: 3 מיליארד ₪ נסגרו בחודש אחד בלבד',                             source:'גלובס',     link:'https://www.globes.co.il/news/home.aspx?fid=3',                      date:new Date('2025-02-05'), image:'' },
  { id:'sa-06', title:'מס רכישה 2025-2026: הטבלאות המעודכנות וכל מה שצריך לדעת',                          source:'כלכליסט',   link:'https://www.calcalist.co.il/real-estate',                            date:new Date('2025-01-30'), image:'' },
  { id:'sa-07', title:'הוד-השרון ורעננה: ערי הנדל"ן המבוקשות של 2025',                                   source:'מאקו',      link:'https://www.mako.co.il/finance-realestate',                          date:new Date('2025-01-18'), image:'' },
  { id:'sa-08', title:'השקעה בקרקע חקלאית: מדריך שלם לתהליך שינוי הייעוד',                               source:'TheMarker', link:'https://www.themarker.com/realestate',                               date:new Date('2025-01-10'), image:'' },
  { id:'sa-09', title:'שכירות בתל-אביב: המחיר הממוצע לדירת 3 חדרים עומד על 7,200 ₪',                    source:'Ynet',      link:'https://www.ynet.co.il/economy/realestate',                         date:new Date('2024-12-20'), image:'' },
  { id:'sa-10', title:'פרויקטי בנייה חדשים בשרון לשנת 2025 — סקירה מקיפה',                               source:'גלובס',     link:'https://www.globes.co.il/news/home.aspx?fid=3',                      date:new Date('2024-12-10'), image:'' },
  { id:'sa-11', title:'רפורמת המשכנתאות: מה משתנה ב-2025 ואיך זה משפיע על הרוכשים?',                     source:'N12',       link:'https://www.n12.co.il/economy',                                      date:new Date('2024-12-01'), image:'' },
  { id:'sa-12', title:'זכויות שוכר בישראל: המדריך המשפטי המלא לפי חוק השכירות ההוגנת',                   source:'TheMarker', link:'https://www.themarker.com/realestate',                               date:new Date('2024-11-25'), image:'' },
  { id:'sa-13', title:'נסח טאבו — כל מה שצריך לדעת לפני כל עסקת נדל"ן',                                  source:'כלכליסט',   link:'https://www.calcalist.co.il/real-estate',                            date:new Date('2024-11-18'), image:'' },
  { id:'sa-14', title:'ייזום נדל"ן בשרון: הנדל"ן שלא מדברים עליו — קרקעות בסמוך לגוש דן',              source:'גלובס',     link:'https://www.globes.co.il/news/home.aspx?fid=3',                      date:new Date('2024-11-10'), image:'' },
  { id:'sa-15', title:'בנייה רוויה מול בנייה צמודת קרקע — מה כדאי לרכוש ב-2025?',                       source:'Ynet',      link:'https://www.ynet.co.il/economy/realestate',                         date:new Date('2024-11-03'), image:'' },
  { id:'sa-16', title:'התחדשות עירונית: 50,000 יחידות דיור חדשות בדרך לשוק עד 2027',                     source:'מאקו',      link:'https://www.mako.co.il/finance-realestate',                          date:new Date('2024-10-28'), image:'' },
  { id:'sa-17', title:'מחירי קרקע בישראל: מדריך לרוכשים ומשקיעים — טווחי מחירים לפי אזורים',            source:'TheMarker', link:'https://www.themarker.com/realestate',                               date:new Date('2024-10-20'), image:'' },
  { id:'sa-18', title:'הלוואת בלון ומשכנתא גמישה: מה מתאים לכם?',                                        source:'כלכליסט',   link:'https://www.calcalist.co.il/real-estate',                            date:new Date('2024-10-14'), image:'' },
  { id:'sa-19', title:'ועדות תכנון ובנייה: כיצד לעקוב אחרי שינויי ייעוד באזור שלכם',                    source:'גלובס',     link:'https://www.globes.co.il/news/home.aspx?fid=3',                      date:new Date('2024-10-07'), image:'' },
  { id:'sa-20', title:'פינוי-בינוי: מה זה אומר למחזיקי הנכסים ומה הזכויות שלהם',                         source:'Ynet',      link:'https://www.ynet.co.il/economy/realestate',                         date:new Date('2024-09-30'), image:'' },
  { id:'sa-21', title:'מגמות בשוק הנדל"ן: עליות, ירידות, ומה צפוי לקראת סוף 2025',                      source:'N12',       link:'https://www.n12.co.il/economy',                                      date:new Date('2024-09-22'), image:'' },
  { id:'sa-22', title:'רכישת דירה יד שנייה: 10 דברים שחובה לבדוק לפני חתימה על חוזה',                   source:'מאקו',      link:'https://www.mako.co.il/finance-realestate',                          date:new Date('2024-09-15'), image:'' },
  { id:'sa-23', title:'ריבית הפריים ב-2025: השפעתה על שוק הנדל"ן וכוח הקנייה של הרוכשים',               source:'TheMarker', link:'https://www.themarker.com/realestate',                               date:new Date('2024-09-08'), image:'' },
  { id:'sa-24', title:'נדל"ן מסחרי לעומת נדל"ן למגורים: מה עדיף כהשקעה?',                               source:'כלכליסט',   link:'https://www.calcalist.co.il/real-estate',                            date:new Date('2024-09-01'), image:'' },
  { id:'sa-25', title:'ישראל בן יהודה: "הקרקע בשרון — הנכס הכי סולידי שקיים"',                           source:'גלובס',     link:'https://www.globes.co.il/news/home.aspx?fid=3',                      date:new Date('2024-08-25'), image:'' },
  { id:'sa-26', title:'חוק הדיור לשכירות — מה השתנה ב-2024 ואיך זה משפיע עליכם',                         source:'Ynet',      link:'https://www.ynet.co.il/economy/realestate',                         date:new Date('2024-08-18'), image:'' },
  { id:'sa-27', title:'קרקעות בסמוך לתחנות הרכבת הקלה: פוטנציאל השקעה שכדאי להכיר',                     source:'מאקו',      link:'https://www.mako.co.il/finance-realestate',                          date:new Date('2024-08-11'), image:'' },
  { id:'sa-28', title:'בדיקות שחובה לעשות על נכס לפני רכישה — מ-A ועד ת',                                 source:'TheMarker', link:'https://www.themarker.com/realestate',                               date:new Date('2024-08-04'), image:'' },
  { id:'sa-29', title:'יעד 2030: ממשלת ישראל מתכננת 1.5 מיליון יחידות דיור חדשות',                       source:'N12',       link:'https://www.n12.co.il/economy',                                      date:new Date('2024-07-28'), image:'' },
  { id:'sa-30', title:'מחשבון מס רכישה 2025: חשבו את המס שתשלמו לפי מדרגות מעודכנות',                    source:'כלכליסט',   link:'https://www.calcalist.co.il/real-estate',                            date:new Date('2024-07-21'), image:'' },
]

function ArchiveCard({ a, C, isDark, cardIndex = 0 }) {
  const [imgErr, setImgErr] = useState(false)
  const delayMs = useRef(Math.min(cardIndex, 6) * 120 + Math.floor(Math.random() * 200)).current
  const ogImage = useOGImage(a.link || a.url, !!a.image, delayMs)
  const displayImage = !imgErr && (a.image || ogImage)
  const pubDate = a.date ? new Date(a.date) : null
  const dateStr = pubDate && !isNaN(pubDate)
    ? pubDate.toLocaleDateString('he-IL', { day:'numeric', month:'long', year:'numeric' })
    : ''

  return (
    <a href={a.link} target="_blank" rel="noopener noreferrer"
      style={{ display:'flex', flexDirection:'column', background: isDark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)', border:`1px solid rgba(132,144,216,.15)`, borderRadius:0, overflow:'hidden', textDecoration:'none', transition:'transform .25s, box-shadow .25s' }}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-4px)'; e.currentTarget.style.boxShadow='0 20px 44px rgba(0,0,0,.3)' }}
      onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
      <div style={{ aspectRatio:'16/9', overflow:'hidden', background:'rgba(132,144,216,.08)', position:'relative', flexShrink:0 }}>
        {displayImage
          ? <img src={displayImage} alt={a.title} loading="lazy" decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImgErr(true)}
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', filter:'brightness(1.18) contrast(1.06) saturate(1.14)' }}/>
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,rgba(132,144,216,.18),rgba(130,246,127,.06))' }}>
              <FaFileAlt size={24} style={{ color:'rgba(132,144,216,.22)' }}/>
            </div>
        }
        {/* Publication date — bottom left */}
        {dateStr && (
          <span style={{ position:'absolute', bottom:10, left:10, background:'rgba(0,0,0,.82)', backdropFilter:'blur(6px)', color:'rgba(232,228,216,.92)', borderRadius:5, padding:'5px 11px', fontSize:11, fontWeight:700, zIndex:2, display:'flex', alignItems:'center', gap:6 }}>
            <FaCalendarAlt size={9}/>{dateStr}
          </span>
        )}
        {a.source && (
          <span style={{ position:'absolute', top:10, right:10, background:'rgba(0,0,0,.82)', backdropFilter:'blur(6px)', color:'rgba(232,228,216,.9)', borderRadius:4, padding:'3px 9px', fontSize:10, fontWeight:700, zIndex:2 }}>
            {a.source}
          </span>
        )}
      </div>
      <div style={{ padding:'14px 16px 16px', flex:1, display:'flex', flexDirection:'column' }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:C.cream, lineHeight:1.5, margin:0, flex:1, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
          {a.title}
        </h3>
        <div style={{ marginTop:10, fontSize:12, fontWeight:700, color:'rgba(132,144,216,.8)', display:'flex', alignItems:'center', gap:4 }}>
          קרא עוד <FaChevronLeft size={9}/>
        </div>
      </div>
    </a>
  )
}

// ─── Privacy Policy Modal (Amendment 13) ────────────────────────────────────
function PrivacyModal({ onClose }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const COMPANY = 'אפיק הנחל יזום שיווק תיווך נדלן בע"מ'
  const COMPANY_EN = 'Afik Hanahal Entrepreneurship Marketing Real Estate Ltd.'
  const REG = '517082038'
  const SITE = 'afikhanahal.co.il'
  const ADDRESS = 'הנגר 24, הוד-השרון, מגדלי Amy — מגדל A'
  const PHONE = '055-9811814'
  const EMAIL = 'afik.hanahal@gmail.com'
  const UPDATE_DATE = '20/05/2026'

  const sectionStyle = { marginBottom: 28 }
  const h2Style = { fontSize: 16, fontWeight: 800, color: '#1a1a2e', marginBottom: 10, marginTop: 0, borderBottom: '2px solid #3F4EB0', paddingBottom: 6, letterSpacing: '.01em' }
  const pStyle = { fontSize: 14, color: '#2c2c3e', lineHeight: 1.9, marginBottom: 10, marginTop: 0 }
  const liStyle = { fontSize: 14, color: '#2c2c3e', lineHeight: 1.8, marginBottom: 6 }
  const strongStyle = { color: '#1a1a2e', fontWeight: 700 }
  const infoBox = { background: '#F0F2FF', border: '1px solid #C8CFF5', borderRadius: 10, padding: '16px 20px', marginTop: 8, marginBottom: 12, fontSize: 14, color: '#2c2c3e', lineHeight: 1.9 }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="תיקון 13 לחוק הגנת הפרטיות"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 10500,
        background: 'rgba(0,0,0,.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        ref={scrollRef}
        style={{
          background: '#fff',
          borderRadius: 16,
          width: '100%',
          maxWidth: 760,
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,.35)',
          direction: 'rtl',
          fontFamily: 'Rubik, Heebo, Arial, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1a1a2e 0%,#2d2d5e 100%)', padding: '28px 32px 24px', position: 'sticky', top: 0, zIndex: 1, borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(200,207,245,.7)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: 6 }}>מסמך משפטי רשמי</div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>תיקון 13 לחוק הגנת הפרטיות</h1>
              <div style={{ fontSize: 13, color: 'rgba(200,207,245,.75)', marginTop: 6 }}>מדיניות פרטיות · תאריך עדכון אחרון: {UPDATE_DATE}</div>
            </div>
            <button
              onClick={onClose}
              aria-label="סגור"
              style={{ background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 8, color: '#fff', width: 36, height: 36, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}
            >✕</button>
          </div>
          {/* Company ID strip */}
          <div style={{ display: 'flex', gap: 20, marginTop: 18, flexWrap: 'wrap' }}>
            {[
              ['חברה', COMPANY],
              ['ח.פ.', REG],
              ['אתר', SITE],
            ].map(([k, v]) => (
              <div key={k} style={{ background: 'rgba(255,255,255,.09)', borderRadius: 7, padding: '5px 12px', fontSize: 12, color: 'rgba(220,225,255,.9)' }}>
                <span style={{ color: 'rgba(200,207,245,.6)', marginLeft: 6 }}>{k}</span>{v}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '32px 36px 40px' }}>

          {/* מבוא */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>מבוא</h2>
            <p style={pStyle}>
              ברוך הבא לאתר האינטרנט ו/או הפלטפורמה ו/או כלל השירותים המוצעים בהם (להלן: <strong style={strongStyle}>"השירותים הדיגיטליים"</strong>) של <strong style={strongStyle}>{COMPANY}</strong> (להלן: <strong style={strongStyle}>"החברה"</strong>).
            </p>
            <p style={pStyle}>
              החברה מייחסת חשיבות רבה לפרטיות המשתמשים בשירותים הדיגיטליים (להלן: <strong style={strongStyle}>"המשתמשים"</strong> או <strong style={strongStyle}>"אתה"</strong>) ופועלת לשמירת המידע האישי שלך. אנו סבורים כי זכותך להכיר ולהבין כיצד אנו אוספים, מעבדים ומשתמשים במידע המתקבל במהלך שימושך בשירותינו. השימוש שלך בשירותים הדיגיטליים כפוף למדיניות פרטיות זו ולתקנון ותנאי השימוש, המהווים הסכם משפטי מחייב בינך לבין החברה.
            </p>
            <p style={pStyle}>
              מדיניות פרטיות זו מפרטת את סוגי המידע הנאספים אודותיך במסגרת השימוש בשירותים הדיגיטליים, וכן את המטרות והשימושים שאנו עושים במידע זה.
            </p>
            <p style={pStyle}>
              החברה שומרת לעצמה את הזכות להפסיק, באופן מלא או חלקי, זמני או קבוע, את פעילות השירותים הדיגיטליים בכל עת. הפסקת השירותים עלולה להתרחש בין היתר לצורך תחזוקה, שדרוג, תיקון תקלות, או כתוצאה מהפרעות או שיבושים זמניים ברשת התקשורת. המשתמש מוותר בזאת מראש על כל טענה, דרישה או תביעה בקשר להפסקות מסוג זה.
            </p>
            <p style={{ ...pStyle, marginBottom: 0 }}>מדיניות זו כתובה בלשון זכר לשם הנוחות בלבד, אך פונה ומתייחסת באופן שווה לכלל המגדרים.</p>
          </div>

          {/* הסכמה */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>הסכמה</h2>
            <p style={pStyle}>
              בעת הרישום לשירותים הדיגיטליים ו/או השימוש בשירות הנך מביע הסכמתך לתנאי מדיניות פרטיות זו. חלק מהשירותים המוצעים בשירותים הדיגיטליים טעונים מסירת מידע אישי, כגון פרטי תקשורת (שם מלא, טלפון, דוא"ל). חשוב לנו להבהיר כי אינך מחויב לפי דין למסור מידע זה, ומסירתו תלויה ברצונך החופשי והסכמתך לשימוש בשירותים הדיגיטליים.
            </p>
            <p style={{ ...pStyle, marginBottom: 0 }}>
              אנו מזמינים אותך לקרוא בעיון את מדיניות הפרטיות, ואם אינך מסכים לה, עליך לחדול מלעשות שימוש נוסף בשירותים הדיגיטליים.
            </p>
          </div>

          {/* הגדרות */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>הגדרות</h2>
            <ul style={{ paddingRight: 18, margin: 0 }}>
              {[
                ['"חשבון אישי/מנוי מערכת"', 'חשבון משתמש ייעודי שנפתח עבורך לשימוש בשירות.'],
                ['"אתה" או "משתמש"', 'האדם אשר משתמש בשירותים הדיגיטליים בכל דרך שהיא.'],
                ['"מידע אישי"', 'מידע הקשור ו/או עשוי לזהות אדם — שם, כתובת, מספר טלפון או דוא"ל. לא חלה עליך חובה חוקית למסור מידע אישי; המסירה נעשית בהסכמתך בלבד.'],
                ['"פלטפורמה"', `אתר האינטרנט www.${SITE}.`],
                ['"שירותים דיגיטליים"', 'אתר האינטרנט, הפלטפורמה, מענה טלפוני או דיגיטלי ומגוון השירותים המוצעים בהם.'],
                ['"בעל שליטה במאגר מידע"', 'מי שקובע את מטרות עיבוד המידע. לצורך העניין — החברה.'],
                ['"מחזיק"', 'גורם חיצוני המעבד מידע עבור בעל השליטה.'],
                ['"עוגיות (Cookies)"', 'מחרוזת אותיות ומספרים המשמשת לאימות, מעקב ואגירת מידע אודות גולש.'],
                ['"נתוני שימוש"', 'נתונים שנאספים אוטומטית כגון משך ביקור בדף.'],
                ['"מכשיר/התקן"', 'כל רכיב המשמש לגישה לשירות — מחשב, טלפון נייד או טאבלט.'],
                ['"ספק שירות"', 'ישות, חברה, ארגון או אדם המעבד מידע מטעם החברה.'],
              ].map(([term, def]) => (
                <li key={term} style={liStyle}><strong style={strongStyle}>{term}</strong> — {def}</li>
              ))}
            </ul>
          </div>

          {/* מידע שאנו אוספים */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>מידע שאנו אוספים</h2>
            <p style={pStyle}>המידע האישי שנאסף מוגבל לנתונים הדרושים לספק לך חווית שימוש מותאמת אישית. האיסוף מתרחש כאשר אתה:</p>
            <ul style={{ paddingRight: 18, margin: '0 0 14px' }}>
              {['נרשם לחשבון האישי ועושה שימוש בשירותים.', 'יוצר קשר עמנו — דואר אלקטרוני, טלפון, WhatsApp או טופס יצירת קשר.', 'גולש בשירותים הדיגיטליים באופן חופשי.'].map(t => (
                <li key={t} style={liStyle}>{t}</li>
              ))}
            </ul>
            <p style={{ ...pStyle, fontWeight: 700, marginBottom: 6 }}>מידע שנמסר בעת הרישום:</p>
            <ul style={{ paddingRight: 18, margin: '0 0 14px' }}>
              {['שם פרטי ושם משפחה', 'מספר טלפון נייד', 'דואר אלקטרוני', 'שם משתמש', 'כל מידע אחר שתבחר לשתף אותנו בו'].map(t => <li key={t} style={liStyle}>{t}</li>)}
            </ul>
            <p style={{ ...pStyle, fontWeight: 700, marginBottom: 6 }}>מידע שנמסר ביצירת קשר:</p>
            <ul style={{ paddingRight: 18, margin: '0 0 14px' }}>
              {['שם פרטי ושם משפחה', 'מספר הטלפון', 'כתובת הדוא"ל', 'נושא פנייתך', 'תוכן שאלתך / בקשתך'].map(t => <li key={t} style={liStyle}>{t}</li>)}
            </ul>
            <p style={{ ...pStyle, marginBottom: 0 }}>שיחות טלפון עשויות להיות מוקלטות לצורך הכשרת צוות או לאיכות שירות.</p>
          </div>

          {/* מטרות השימוש */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>מטרות השימוש במידע</h2>
            <ul style={{ paddingRight: 18, margin: 0 }}>
              {[
                'מתן השירותים, טיפול בפניות ורישום לחשבון אישי.',
                'שיפור חווית השימוש, מדידת ביצועים ועיבוד מידע סטטיסטי.',
                'מילוי דרישות חוקיות (צו שיפוטי, בקשה ממשלתית וכיו"ב).',
                'זיהוי, מניעה וטיפול בתרמית, בעיות אבטחה או תקלות טכניות.',
                'הגנה בפני פגיעה בזכויות צדדים שלישיים, לרבות קניין רוחני.',
                'דיוור ישיר ויצירת קשר עם המשתמשים.',
              ].map(t => <li key={t} style={liStyle}>{t}</li>)}
            </ul>
          </div>

          {/* מאגרי מידע */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>מאגרי מידע</h2>
            <p style={pStyle}>המידע הנאסף יישמר במאגרי המידע של החברה ובאחריותה. החברה הינה בעלת השליטה במאגר המידע הנאסף עת פתיחת חשבון אישי, גלישה באתר או יצירת קשר.</p>
            <div style={infoBox}>
              <div><strong style={strongStyle}>שם החברה:</strong> {COMPANY}</div>
              <div><strong style={strongStyle}>ח.פ.:</strong> {REG}</div>
              <div><strong style={strongStyle}>כתובת:</strong> {ADDRESS}</div>
              <div><strong style={strongStyle}>טלפון:</strong> {PHONE}</div>
              <div><strong style={strongStyle}>דוא"ל:</strong> <a href={`mailto:${EMAIL}`} style={{ color: '#3F4EB0' }}>{EMAIL}</a></div>
              <div><strong style={strongStyle}>אתר:</strong> <a href={`https://www.${SITE}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3F4EB0' }}>www.{SITE}</a></div>
            </div>
          </div>

          {/* העברת מידע לצדדים שלישיים */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>העברת מידע לצדדים שלישיים</h2>
            <p style={pStyle}>החברה מתחייבת לא להעביר את המידע האישי שלך לגורמים חיצוניים, אלא במקרים הבאים:</p>
            <ul style={{ paddingRight: 18, margin: 0 }}>
              {[
                'על פי דרישת המשתמש ו/או בהסכמתו המפורשת.',
                'ספקי צד ג׳ הנדרשים לתפעול השירות (אירוח, אחסון, ניתוח, סליקה) — אך ורק לצרכים רלוונטיים ובהתאם לדין.',
                'הפרת תנאי השימוש ו/או ניסיון ביצוע פעולות אסורות.',
                'צו שיפוטי המורה למסור מידע.',
                'מחלוקות משפטיות בין הצדדים.',
                'מניעת נזק חמור לרכוש ו/או לגוף החברה, המשתמש או צדדים שלישיים.',
                'העברת פעילות החברה לצד שלישי — בכפוף לקבלת מחויבויות הפרטיות.',
              ].map(t => <li key={t} style={liStyle}>{t}</li>)}
            </ul>
          </div>

          {/* זכות לעיון, תיקון ומחיקה */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>זכות לעיון, תיקון ומחיקת המידע</h2>
            <p style={pStyle}>
              זכות לעיון במידע ותיקונו תינתן בהתאם להוראות חוק הגנת הפרטיות, התשמ"א–1981. הנך זכאי לעיין במידע המוחזק אודותיך, בעצמך או באמצעות בא כוחך שהורשה בכתב, ולבקש לתקן או למחוק מידע שאינו נכון, שלם, ברור או מעודכן.
            </p>
            <p style={pStyle}>
              לצורך כך ניתן לפנות אלינו לכתובת הדוא"ל: <a href={`mailto:${EMAIL}`} style={{ color: '#3F4EB0', fontWeight: 600 }}>{EMAIL}</a>.
            </p>
            <p style={{ ...pStyle, marginBottom: 0 }}>
              כל המידע אודותייך יימחק ממאגר המידע בעת בקשתך לכך, לא יאוחר מ-2 ימי עסקים ממועד פנייתך בכתב.
            </p>
          </div>

          {/* אבטחת מידע */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>אבטחת מידע</h2>
            <p style={pStyle}>
              אנו מיישמים מערכות ונהלים עדכניים ומחמירים לאבטחת מידע. אנו מיישמים נהלי אבטחה כמקובל בתעשייה, על מנת למנוע שימוש לא מורשה במידע. יחד עם זאת, אין בהם בטחון מוחלט, ועל המשתמש לנקוט אמצעי הגנה מתאימים על מכשיר הקצה שלו ולשמור על חיסיון סיסמתו.
            </p>
          </div>

          {/* שימוש בעוגיות */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>שימוש בעוגיות ומשואות רשת</h2>
            <p style={pStyle}>
              אנו משתמשים בעוגיות (Cookies) ומשואות רשת (Web Beacons) לתפעול תקין של השירותים הדיגיטליים. עוגיות "מתמידות" שומרות פרטי התחברות ומידע נוסף לגישה נוחה. עוגיות "זמניות" משמשות לתפעול שוטף, בדיקת תקינות, ניטור ואבטחה — ונמחקות עם סגירת הדפדפן.
            </p>
            <p style={{ ...pStyle, marginBottom: 0 }}>
              ניתן לסרב לקבל עוגיות באמצעות הגדרות הדפדפן, אך הדבר עלול לפגוע בחוויית השימוש.
            </p>
          </div>

          {/* אתרים אחרים */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>אתרים אחרים</h2>
            <p style={{ ...pStyle, marginBottom: 0 }}>
              השירותים הדיגיטליים עשויים להכיל קישורים לאתרים חיצוניים. שימוש באתרים אלה הוא על אחריות המשתמש בלבד, ואנו ממליצים לקרוא את מדיניות הפרטיות של אותם גורמים.
            </p>
          </div>

          {/* דיוור ישיר */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>דיוור ישיר</h2>
            <p style={{ ...pStyle, marginBottom: 0 }}>
              אנו עשויים לשלוח מפעם לפעם מידע שיווקי ופרסומי הקשור לחברה או לשירותיה. מידע זה ישלח אליך רק אם נתת הסכמה מפורשת לכך, ותוכל בכל עת לבטל הסכמתך ולחדול מלקבל הודעות.
            </p>
          </div>

          {/* שינויים במדיניות */}
          <div style={sectionStyle}>
            <h2 style={h2Style}>שינויים במדיניות הפרטיות</h2>
            <p style={{ ...pStyle, marginBottom: 0 }}>
              החברה שומרת על הזכות לשנות מדיניות זו בכל עת. שינויים ייכנסו לתוקף במועד עדכון האחרון המצוין בראש המסמך. המשך השימוש בשירותים לאחר תאריך העדכון מהווה הסכמה לשינויים.
            </p>
          </div>

          {/* יצירת קשר */}
          <div style={{ ...sectionStyle, marginBottom: 0 }}>
            <h2 style={h2Style}>צור קשר</h2>
            <div style={infoBox}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#1a1a2e' }}>{COMPANY}</p>
              <div><strong style={strongStyle}>כתובת:</strong> {ADDRESS}</div>
              <div><strong style={strongStyle}>טלפון:</strong> <a href={`tel:${PHONE.replace(/-/g,'')}`} style={{ color: '#3F4EB0' }}>{PHONE}</a></div>
              <div><strong style={strongStyle}>דוא"ל:</strong> <a href={`mailto:${EMAIL}`} style={{ color: '#3F4EB0' }}>{EMAIL}</a></div>
              <div><strong style={strongStyle}>אתר:</strong> <a href={`https://www.${SITE}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3F4EB0' }}>www.{SITE}</a></div>
            </div>
          </div>

        </div>

        {/* Footer strip */}
        <div style={{ background: '#F7F8FF', borderTop: '1px solid #E0E4F5', padding: '16px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '0 0 16px 16px', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12, color: '#8890B8' }}>© {new Date().getFullYear()} {COMPANY} · ח.פ. {REG}</div>
          <button
            onClick={onClose}
            style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: '#3F4EB0', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          >סגור</button>
        </div>
      </div>
    </div>
  )
}

function ArchiveModal({ onClose, C, isDark }) {
  const [items, setItems]       = useState([])
  const [fetching, setFetching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showBackBtn, setShowBackBtn] = useState(false)
  const scrollRef = useRef(null)

  // Only articles from the last 30 days, sorted newest-first
  function mergeWithStatic(live) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    const recent = live.filter(a => {
      const ts = a.archivedAt || new Date(a.publishedAt || a.published_at || a.date || 0).getTime()
      return ts >= cutoff
    })
    recent.sort((a, b) => {
      const ta = a.archivedAt || new Date(a.publishedAt || a.published_at || a.date || 0).getTime()
      const tb = b.archivedAt || new Date(b.publishedAt || b.published_at || b.date || 0).getTime()
      return tb - ta
    })
    return recent.slice(0, 100)
  }

  useEffect(() => {
    // Show localStorage immediately, then replace with server archive
    let saved = []
    try { saved = JSON.parse(localStorage.getItem(ARCHIVE_STORE) || '[]') } catch {}
    setItems(mergeWithStatic(saved))
    prefill()
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setShowBackBtn(el.scrollTop > 280)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  async function prefill() {
    setFetching(true); setProgress(0)
    try {
      // Primary: server-side 3-week archive (Supabase)
      let serverArticles = []
      try {
        const r = await fetch(`/api/news/archive`, { signal: AbortSignal.timeout(8000) })
        if (r.ok) {
          const all = await r.json()
          // Only show articles that have an image
          serverArticles = Array.isArray(all) ? all.filter(a => a.image) : []
        }
      } catch {}

      if (serverArticles.length > 0) {
        // Server has real archive — use it directly (already image-filtered)
        setProgress(serverArticles.length)
        setItems(mergeWithStatic(serverArticles))
      } else {
        // Fallback: fetch live feed and save to localStorage
        const fresh = await fetchFreshArticles()
        let saved = []
        try { saved = JSON.parse(localStorage.getItem(ARCHIVE_STORE) || '[]') } catch {}
        const seenTitles = new Set(saved.map(a => a.title?.replace(/\s+/g,'').slice(0,30)))
        const seenUrls   = new Set(saved.map(a => a.link || a.url || '').filter(Boolean))
        const newItems = fresh
          .filter(a => {
            const k = a.title?.replace(/\s+/g,'').slice(0,30)
            const u = a.link || a.url || ''
            if (!k || seenTitles.has(k) || (u && seenUrls.has(u))) return false
            seenTitles.add(k)
            if (u) seenUrls.add(u)
            return true
          })
          .map(a => ({ ...a, archivedAt: Date.now() }))
        const toSave = [...newItems, ...saved].slice(0, 200)
        try { localStorage.setItem(ARCHIVE_STORE, JSON.stringify(toSave)) } catch {}
        setProgress(newItems.length)
        setItems(mergeWithStatic(toSave))
      }
    } catch(e) { console.error('[Archive] prefill failed:', e) }
    setFetching(false)
  }

  return (
    <div ref={scrollRef} style={{ position:'fixed', inset:0, zIndex:9000, background:'rgba(0,0,0,.78)', backdropFilter:'blur(10px)', overflowY:'auto', overscrollBehavior:'contain', direction:'rtl' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      {/* ── Floating back button (appears after scrolling down) ── */}
      {showBackBtn && (
        <button onClick={onClose}
          style={{
            position: 'sticky', top: 14, float: 'left', marginLeft: 14, zIndex: 9010,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px', background: 'rgba(10,10,20,.88)',
            border: `1px solid ${C.purple}55`, borderRadius: 30,
            color: C.cream, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', boxShadow: `0 4px 24px rgba(0,0,0,.6), 0 0 0 1px ${C.purple}22`,
            backdropFilter: 'blur(14px)', whiteSpace: 'nowrap',
            transition: 'all .2s', letterSpacing: '.01em',
          }}
          onMouseEnter={e => { e.currentTarget.style.background=`${C.purple}BB`; e.currentTarget.style.borderColor=C.purple }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(10,10,20,.88)'; e.currentTarget.style.borderColor=`${C.purple}55` }}>
          <FaChevronRight size={11}/> חזור
        </button>
      )}

      <div style={{ maxWidth:1200, margin:'0 auto', padding:'40px 24px 80px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:36 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'5px', color:C.purple, marginBottom:8, textTransform:'uppercase' }}>ארכיון</div>
            <h2 style={{ fontSize:'clamp(24px,3.5vw,40px)', fontWeight:900, color:C.cream, margin:0 }}>כתבות ישנות</h2>
          </div>
          <button onClick={onClose}
            style={{ background:'none', border:`1px solid ${C.purple}44`, borderRadius:8, color:C.cream, fontSize:14, fontWeight:700, cursor:'pointer', padding:'10px 22px', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8, transition:'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=C.purple; e.currentTarget.style.background=`${C.purple}15` }}
            onMouseLeave={e => { e.currentTarget.style.borderColor=`${C.purple}44`; e.currentTarget.style.background='none' }}>
            ← חזור
          </button>
        </div>

        {/* Loading state */}
        {fetching && (
          <div style={{ marginBottom:32 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
              <div style={{ width:28, height:28, border:`3px solid ${C.purple}33`, borderTopColor:C.purple, borderRadius:'50%', animation:'spin 0.9s linear infinite', flexShrink:0 }}/>
              <span style={{ fontSize:14, color:C.cream, fontWeight:600 }}>
                טוען כתבות חדשות... {progress}/20
              </span>
            </div>
            <div style={{ height:4, background:`${C.purple}22`, borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${progress * 5}%`, background:C.purple, borderRadius:2, transition:'width .4s' }}/>
            </div>
          </div>
        )}

        {/* Grid */}
        {items.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:22 }}>
            {items.map((a, i) => <ArchiveCard key={a.id || i} a={a} C={C} isDark={isDark} cardIndex={i}/>)}
          </div>
        )}

        {!fetching && items.length === 0 && (
          <div style={{ textAlign:'center', padding:'80px 24px', color:`${C.cream}44` }}>
            <FaFileAlt size={40} style={{ marginBottom:16, color:`${C.cream}33` }}/>
            <div style={{ fontSize:16, fontWeight:700, color:C.cream, marginBottom:8 }}>לא נמצאו כתבות</div>
            <button onClick={prefill} style={{ marginTop:16, padding:'10px 24px', background:C.purple, border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              נסה שוב
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function NewsSection() {
  const { C, isDark, lang } = useTheme()
  const t = TR[lang] || TR.he
  const { articles, loading, error, reload } = useRotatingNews()
  const [showArchive, setShowArchive] = useState(false)

  return (
    <>
    {showArchive && <ArchiveModal onClose={() => setShowArchive(false)} C={C} isDark={isDark}/>}
    <section id="news" style={{ padding:'72px 24px', scrollMarginTop:80, position:'relative', zIndex:1 }}>
      {/* Ambient */}
      <div style={{ position:'absolute', top:'5%', right:'-8%', width:520, height:520, background:`radial-gradient(circle,${C.purple}09,transparent 70%)`, pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'10%', left:'-5%', width:420, height:420, background:`radial-gradient(circle,${C.green}07,transparent 70%)`, pointerEvents:'none' }}/>

      <div style={{ maxWidth:1280, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:44 }}>
          <SectionBadge color={C.purple}>{t.newsBadge}</SectionBadge>
          <h2 style={{ fontSize:'clamp(28px,4vw,50px)', fontWeight:900, color:C.cream, marginBottom:22 }}>{t.newsH2}</h2>
          <div style={{ display:'flex', justifyContent:'center' }}>
            <button onClick={() => setShowArchive(true)}
              style={{ fontSize:13, fontWeight:700, background:'transparent', border:`1px solid ${C.purple}44`, color:C.cream, borderRadius:20, padding:'8px 22px', cursor:'pointer', fontFamily:'inherit', transition:'all .2s', display:'flex', alignItems:'center', gap:8 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=C.purple; e.currentTarget.style.background=`${C.purple}15` }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=`${C.purple}44`; e.currentTarget.style.background='transparent' }}>
              {t.newsArchiveBtn}
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:20 }}>
            {Array(4).fill(0).map((_,i) => <NewsSkeletonCard key={i} C={C}/>)}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ textAlign:'center', padding:'60px 24px', color:`${C.cream}50` }}>
            <FaWifi size={36} style={{ marginBottom:16, color:`${C.cream}33` }}/>
            <div style={{ fontSize:15, fontWeight:700, color:C.cream, marginBottom:6 }}>{t.newsErrorMsg}</div>
            <div style={{ fontSize:13, marginBottom:22 }}>{t.newsErrorSub}</div>
            <button onClick={reload} style={{ padding:'11px 26px', background:C.purple, border:'none', borderRadius:8, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{t.newsRetry}</button>
          </div>
        )}

        {/* Articles grid */}
        {!loading && !error && articles.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:20 }}>
            {articles.map((a, i) => <NewsCard key={a.id} article={a} C={C} cardIndex={i}/>)}
          </div>
        )}

        {/* Disclaimer */}
        {!loading && !error && articles.length > 0 && (
          <div style={{ textAlign:'center', marginTop:28, fontSize:11, color:`${C.cream}28` }}>
            {t.newsDisclaimer}
          </div>
        )}
      </div>
    </section>
    </>
  )
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────
function TestimonialsSection() {
  const { C, lang } = useTheme()
  const t = TR[lang] || TR.he
  const [active, setActive]       = useState(0)
  const [dir, setDir]             = useState(1)
  const [hoverPrev, setHoverPrev] = useState(false)
  const [hoverNext, setHoverNext] = useState(false)
  const timerRef  = useRef(null)
  const touchX    = useRef(null)
  const n = TESTIMONIALS_DATA.length

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => { setDir(1); setActive(p => (p + 1) % n) }, 6500)
  }, [n])

  useEffect(() => { startTimer(); return () => clearInterval(timerRef.current) }, [startTimer])

  const goTo = useCallback((idx) => {
    setDir(idx > active ? 1 : -1)
    setActive(idx)
    startTimer()
  }, [active, startTimer])

  const goNext = useCallback(() => goTo((active + 1) % n), [active, n, goTo])
  const goPrev = useCallback(() => goTo((active - 1 + n) % n), [active, n, goTo])

  const item   = TESTIMONIALS_DATA[active]
  const tQuote = lang === 'en' && item.en_quote ? item.en_quote : item.quote
  const tName  = lang === 'en' && item.en_name  ? item.en_name  : item.name
  const tDesig = lang === 'en' && item.en_designation ? item.en_designation : item.designation
  const tFirm  = lang === 'en' && item.en_firm  ? item.en_firm  : (item.firm || null)

  const arBtn = (hover) => ({
    width:46, height:46, borderRadius:'50%',
    border:`1px solid ${hover ? C.purple : C.purple+'44'}`,
    background: hover ? C.purple : 'rgba(255,255,255,.07)',
    display:'flex', alignItems:'center', justifyContent:'center',
    cursor:'pointer', transition:'all .25s', color:C.cream, flexShrink:0,
  })

  return (
    <section id="testimonials" style={{ padding:'80px 24px', scrollMarginTop:80, position:'relative', zIndex:1 }}>
      <div style={{ maxWidth:1000, margin:'0 auto' }}>

        {/* Heading */}
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <SectionBadge color={C.purple}>{t.testimonialsBadge}</SectionBadge>
          <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:900, color:C.cream, marginBottom:16 }}>{t.testimonialsH2}</h2>
          <p style={{ fontSize:16, color:C.cream+'AA', maxWidth:480, margin:'0 auto', lineHeight:1.8 }}>{t.testimonialsDesc}</p>
        </div>

        {/* ── Card ── */}
        <div className="testi-card-outer" style={{ position:'relative', borderRadius:24, overflow:'hidden', background:'rgba(255,255,255,.04)', border:`1px solid rgba(132,144,216,.18)`, boxShadow:'0 32px 80px rgba(0,0,0,.45)', backdropFilter:'blur(20px)', touchAction:'pan-y' }}
          onTouchStart={e => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            if (touchX.current === null) return
            const diff = touchX.current - e.changedTouches[0].clientX
            if (Math.abs(diff) > 45) { diff > 0 ? goNext() : goPrev() }
            touchX.current = null
          }}>
          <AnimatePresence initial={false} custom={dir} mode="wait">
            <motion.div
              key={active}
              custom={dir}
              initial={{ opacity:0, x: dir > 0 ? 60 : -60 }}
              animate={{ opacity:1, x:0 }}
              exit={{ opacity:0, x: dir > 0 ? -60 : 60 }}
              transition={{ duration:.42, ease:[.4,0,.2,1] }}
              className="testi-card-wrap"
              style={{ display:'flex', direction:'rtl', width:'100%' }}
            >
              {/* ── Text column (RTL: appears on RIGHT) ── */}
              <div className="testi-txt-col" style={{ flex:1, padding:'52px 48px 44px', display:'flex', flexDirection:'column', justifyContent:'center', gap:22, position:'relative', zIndex:1, minWidth:0 }}>

                {/* Quote mark */}
                <div style={{ fontSize:72, color:C.purple, lineHeight:.75, fontFamily:'Georgia,serif', opacity:.35, userSelect:'none', marginBottom:-8 }}>"</div>

                {/* Word-by-word fade */}
                <p style={{ fontSize:17, color:C.cream+'E8', lineHeight:1.95, margin:0 }}>
                  {tQuote.split(' ').map((word, wi) => (
                    <motion.span key={`${active}-${wi}`}
                      initial={{ opacity:0, filter:'blur(6px)' }}
                      animate={{ opacity:1, filter:'blur(0px)' }}
                      transition={{ duration:.18, delay: 0.022 * wi }}
                      style={{ display:'inline-block', marginLeft:4 }}>
                      {word}
                    </motion.span>
                  ))}
                </p>

                {/* Name + role */}
                <div>
                  <div style={{ fontSize:20, fontWeight:800, color:C.cream }}>{tName}</div>
                  {tDesig && <div style={{ fontSize:13, color:C.purple, marginTop:6, letterSpacing:'.4px' }}>{tDesig}</div>}
                  {tFirm && <div style={{ fontSize:12, color:C.purple, marginTop:3, letterSpacing:'.3px', fontWeight:600 }}>{tFirm}</div>}
                </div>

                {/* Stars */}
                <div style={{ display:'flex', gap:4 }}>
                  {[1,2,3,4,5].map(s => <span key={s} style={{ color:C.green, fontSize:22 }}>★</span>)}
                </div>

                {/* Navigation */}
                <div style={{ display:'flex', gap:12, alignItems:'center', marginTop:4 }}>
                  <button onClick={goPrev} style={arBtn(hoverPrev)}
                    onMouseEnter={() => setHoverPrev(true)} onMouseLeave={() => setHoverPrev(false)}
                    aria-label="הקודם">
                    <FaChevronRight size={16}/>
                  </button>
                  <button onClick={goNext} style={arBtn(hoverNext)}
                    onMouseEnter={() => setHoverNext(true)} onMouseLeave={() => setHoverNext(false)}
                    aria-label="הבא">
                    <FaChevronLeft size={16}/>
                  </button>
                  <span className="testi-dots" style={{ display:'contents' }}>
                  {TESTIMONIALS_DATA.map((_, i) => (
                    <button key={i} onClick={() => goTo(i)}
                      style={{ width:i===active?26:8, height:8, borderRadius:4, background:i===active?C.purple:C.purple+'33', border:'none', cursor:'pointer', transition:'all .3s', padding:0 }}
                      aria-label={`עדות ${i+1}`}/>
                  ))}
                  </span>
                </div>
              </div>

              {/* ── Image column (RTL: appears on LEFT) ── */}
              <div className="testi-img-col" style={{ width:400, flexShrink:0, position:'relative', overflow:'hidden', background:'linear-gradient(160deg,rgba(18,10,38,.98),rgba(8,6,20,.99))' }}>
                <img
                  src={item.src}
                  alt={tName}
                  style={{
                    position:'absolute', inset:0, width:'100%', height:'100%',
                    objectFit: item.imgFit || 'cover',
                    objectPosition: item.imgPos || 'center top',
                    transition:'opacity .35s',
                  }}
                />
                {/* Right-edge gradient blending into text column */}
                <div style={{ position:'absolute', top:0, right:0, bottom:0, width:100, background:'linear-gradient(to left,rgba(8,6,20,.92),transparent)', pointerEvents:'none' }}/>
                {/* Bottom gradient */}
                <div style={{ position:'absolute', bottom:0, left:0, right:0, height:80, background:'linear-gradient(to top,rgba(8,6,20,.7),transparent)', pointerEvents:'none' }}/>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </section>
  )
}

// ─── FAQ SECTION ─────────────────────────────────────────────────────────────
const FAQS = [
  { q:'מה מייחד את אפיק הנחל משאר חברות הנדל"ן?', a:'אפיק הנחל מתמחה בקרקעות, מגרשים ודירות למכירה, עם דגש מיוחד על נכסים בלעדיים שאינם מגיעים לפורטלים הפתוחים. הניסיון העמוק שלנו בשרון ובמרכז מאפשר לנו לאתר הזדמנויות לפני השוק, ולתת ללקוח ליווי מקצועי מרגע הזיהוי ועד הסגירה.',
    en_q:'What sets Afik Hanahal apart from other real estate companies?', en_a:'Afik Hanahal specializes in land, plots, and properties for sale, with special emphasis on exclusive assets not listed on public portals. Our deep experience in the Sharon and Center regions lets us spot opportunities before the market, providing clients professional guidance from identification to closing.' },
  { q:'אילו שירותים מציעה אפיק הנחל?', a:'החברה מציעה: איתור קרקעות זמינות, שיווק ותיווך מגרשים, ייזום פרויקטים חדשים, שיווק בתי יוקרה, וליווי מלא לעסקאות קרקע. מפגישת הייעוץ הראשונה ועד חתימה על החוזה.',
    en_q:'What services does Afik Hanahal offer?', en_a:'The company offers: land search, plot marketing and brokerage, new project development, luxury home marketing, and full support for land transactions, from the first consultation all the way to signing.' },
  { q:'באילו אזורים פועלת אפיק הנחל?', a:'אזור ההתמחות הראשי הוא השרון והמרכז, אך החברה פעילה בכל רחבי ישראל, מהצפון ועד הדרום. לקוחות מכל הארץ מוזמנים ליצור קשר.',
    en_q:'In which areas does Afik Hanahal operate?', en_a:'The primary area of expertise is the Sharon and Center, but the company is active throughout Israel, from north to south. Clients from across the country are welcome to get in touch.' },
  { q:'מה ההבדל בין קרקע חקלאית לקרקע לבנייה?', a:'קרקע חקלאית מיועדת לפי התוכנית המוניציפלית לשימוש חקלאי ולא ניתן לבנות עליה ללא שינוי ייעוד. קרקע לבנייה (מגורים, מסחר, תעשייה) אושרה בתוכנית בניין עיר ומאפשרת הגשת היתרי בנייה. שינוי ייעוד קרקע חקלאית הוא תהליך ארוך, אך לעיתים גם הזדמנות השקעה.',
    en_q:'What is the difference between agricultural land and building land?', en_a:'Agricultural land is designated for agricultural use per the municipal plan and cannot be built on without rezoning. Building land (residential, commercial, industrial) has been approved in a city building plan and permits building permit applications. Rezoning agricultural land is a long process, but sometimes it\'s also an investment opportunity.' },
  { q:'כמה עולה קרקע בשרון?', a:'מחיר הקרקעות בשרון נע בטווח רחב בהתאם לייעוד, מיקום ושטח. מגרש בנייה בשרון יכול לנוע בין כמה מאות אלפי שקלים לכמה מיליונים. לקבלת הערכת מחיר מדויקת לנכס ספציפי, פנו אלינו ישירות.',
    en_q:'How much does land cost in the Sharon region?', en_a:'Land prices in the Sharon vary widely depending on designation, location, and area. A building plot in the Sharon can range from a few hundred thousand to several million shekels. For an accurate price estimate on a specific property, get in touch with us directly.' },
  { q:'האם ניתן לקנות קרקע כהשקעה?', a:'כן. קרקעות בישראל, במיוחד בסמוך לאזורי ביקוש, הוכיחו עצמן כנכס השקעה סולידי לאורך זמן. קרקעות בסמוך להרחבות עירוניות מתוכננות עשויות לצמוח בערכן משמעותית. אפיק הנחל מסייעת לזהות הזדמנויות כאלה.',
    en_q:'Can land be purchased as an investment?', en_a:'Yes. Land in Israel, especially near high-demand areas, has proven to be a solid long-term investment. Land near planned urban expansions may grow significantly in value. Afik Hanahal helps identify such opportunities.' },
  { q:'כיצד לאתר קרקעות למכירה בישראל?', a:'ניתן לחפש בפורטלי נדל"ן (יד2, מדלן), לפנות לרשויות המקומיות, או לעבוד עם חברת תיווך מתמחה כמו אפיק הנחל, שמחזיקה ברשימות בלעדיות שאינן מפורסמות לציבור.',
    en_q:'How do you find land for sale in Israel?', en_a:'You can search real estate portals (Yad2, Madlan), contact local authorities, or work with a specialized brokerage like Afik Hanahal, which holds exclusive listings not available to the public.' },
  { q:'מה תהליך רכישת קרקע בישראל?', a:'התהליך כולל: איתור והתאמה לצרכי הקונה, בדיקת נסח טאבו וזכויות, בדיקת ייעוד ותכניות בנייה, משא ומתן על המחיר, חתימה על זיכרון דברים, בדיקות עורך דין ונוטריון, ורישום בטאבו. אפיק הנחל מלווה את הלקוח בכל שלב.',
    en_q:'What is the process of purchasing land in Israel?', en_a:'The process includes: search and matching to buyer needs, Tabu extract and rights check, zoning and building plan review, price negotiation, signing a memorandum of understanding, lawyer and notary checks, and Tabu registration. Afik Hanahal accompanies clients at every stage.' },
  { q:'מתי כדאי להשקיע בקרקע חקלאית?', a:'כאשר הקרקע ממוקמת בסמוך לאזור מבונה עם לחץ ביקוש גבוה, כאשר קיימות תכניות מוניציפליות לשינוי ייעוד באזור, וכאשר אופק ההשקעה הוא ארוך (5–15 שנה). חשוב לבצע בדיקת נאותות מקיפה לפני כל השקעה כזו.',
    en_q:'When is it worthwhile to invest in agricultural land?', en_a:"When the land is located near a built-up area with high demand pressure, when municipal rezoning plans exist for the area, and when the investment horizon is long (5–15 years). It's important to perform thorough due diligence before any such investment." },
]

function FAQSection() {
  const { C, lang } = useTheme()
  const t = TR[lang] || TR.he
  const [open, setOpen] = useState(null)
  const sectionRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <section id="faq" ref={sectionRef} style={{ padding:'72px 24px', scrollMarginTop:80, position:'relative', zIndex:1 }}>
      <div style={{ maxWidth:820, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <SectionBadge color={C.purple}>{t.faqBadge}</SectionBadge>
          <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:900, color:C.cream, marginBottom:16 }}>{t.faqH2}</h2>
          <p style={{ fontSize:16, color:C.cream+'AA', maxWidth:480, margin:'0 auto', lineHeight:1.8 }}>{t.faqDesc}</p>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {FAQS.map((faq, i) => (
            <div key={i}
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity .5s ease ${i * 0.06}s, transform .5s ease ${i * 0.06}s`,
              }}>
              <div
                onClick={() => setOpen(open === i ? null : i)}
                onMouseEnter={e => { if (open !== i) { e.currentTarget.style.background='rgba(132,144,216,.08)'; e.currentTarget.style.borderColor=`${C.purple}44`; e.currentTarget.style.boxShadow=`0 6px 28px rgba(132,144,216,.10)` } }}
                onMouseLeave={e => { if (open !== i) { e.currentTarget.style.background='rgba(255,255,255,.04)'; e.currentTarget.style.borderColor='rgba(132,144,216,.18)'; e.currentTarget.style.boxShadow='' } }}
                style={{
                  background: open === i ? 'rgba(132,144,216,.1)' : 'rgba(255,255,255,.04)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  border: `1px solid ${open === i ? C.purple+'55' : 'rgba(132,144,216,.18)'}`,
                  borderRadius: open === i && FAQS[i] ? '16px 16px 0 0' : 16,
                  padding: '20px 24px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  transition: 'background .25s, border-color .25s, box-shadow .25s',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:1, background:'linear-gradient(90deg,transparent,rgba(255,255,255,.2) 50%,transparent)', pointerEvents:'none' }}/>
                <span style={{ fontSize:15, fontWeight:600, color:C.cream, lineHeight:1.5 }}>{lang === 'en' && faq.en_q ? faq.en_q : faq.q}</span>
                <span style={{
                  width:28, height:28, borderRadius:'50%',
                  background: open === i ? `${C.purple}33` : 'rgba(255,255,255,.07)',
                  border: `1px solid ${open === i ? C.purple+'55' : 'rgba(255,255,255,.12)'}`,
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                  fontSize:16, color: open === i ? C.purple : C.cream+'88',
                  transition: 'transform .3s, background .25s, color .25s',
                  transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)',
                }}>+</span>
              </div>
              {open === i && (
                <div style={{
                  background: 'rgba(132,144,216,.06)',
                  border: `1px solid ${C.purple+'33'}`,
                  borderTop: 'none',
                  borderRadius: '0 0 16px 16px',
                  padding: '20px 24px',
                  fontSize: 15,
                  color: C.cream+'CC',
                  lineHeight: 1.9,
                }}>
                  {lang === 'en' && faq.en_a ? faq.en_a : faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── PROPERTY MODAL ───────────────────────────────────────────────────────────
// ─── YAD2-STYLE MORTGAGE CALCULATOR ──────────────────────────────────────────
const YAD2_ORANGE = '#FF6332'

function MortgageInline({ price, C, onContact, prop }) {
  const pNum = Number(String(price || 0).replace(/[^\d]/g, ''))
  const minEquity = Math.round(pNum * 0.1)
  const maxEquity = Math.round(pNum * 0.8)
  const defEquity = Math.round(pNum * 0.25)
  const [equity, setEquity] = useState(defEquity)
  const [years,  setYears]  = useState(25)
  const rate  = 5.07
  const loan  = Math.max(0, pNum - equity)
  const r     = rate / 100 / 12
  const n     = years * 12
  const monthly = loan > 0 && r > 0 ? Math.round(loan * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1)) : 0
  const fmtN  = v => Math.round(v).toLocaleString('he-IL')

  if (!pNum) return null
  return (
    <div style={{ borderRadius:16, overflow:'hidden', border:'1px solid rgba(255,255,255,.1)', direction:'rtl' }}>
      {/* Top label bar */}
      <div style={{ background:'rgba(255,255,255,.05)', borderBottom:'1px solid rgba(255,255,255,.08)', padding:'12px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:13, fontWeight:700, color:C.cream }}>מחשבון משכנתא</span>
        <span style={{ fontSize:11, color:`${C.cream}44`, background:'rgba(255,255,255,.06)', borderRadius:20, padding:'3px 10px' }}>הערכה בלבד</span>
      </div>

      {/* Two-column → single-column on mobile */}
      <div className="mortgage-inline-grid">

        {/* Result card */}
        <div className="mortgage-result-col" style={{ padding:'24px 22px', background:'rgba(255,255,255,.03)', borderLeft:'1px solid rgba(255,255,255,.08)', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:11, color:`${C.cream}55`, letterSpacing:'.06em', textTransform:'uppercase', marginBottom:6 }}>החזר חודשי משוער</div>
            <div className="mortgage-monthly-num" style={{ fontSize:38, fontWeight:900, color:'#fff', lineHeight:1, marginBottom:6 }}>
              ₪{fmtN(monthly)}
            </div>
            <div style={{ width:28, height:3, background:YAD2_ORANGE, borderRadius:2, marginBottom:14 }}/>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:`${C.cream}AA` }}>
                <span>סכ״ה הלוואה</span><span style={{ fontWeight:700, color:C.cream }}>₪{fmtN(loan)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:`${C.cream}AA` }}>
                <span>ריבית ממוצעת</span><span style={{ fontWeight:700, color:C.cream }}>{rate}%</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:`${C.cream}AA` }}>
                <span>תקופת הלוואה</span><span style={{ fontWeight:700, color:C.cream }}>{years} שנה</span>
              </div>
            </div>
          </div>
          <button onClick={() => onContact(prop)}
            className="mortgage-cta-btn"
            style={{ marginTop:20, width:'100%', padding:'13px', background:YAD2_ORANGE, border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'opacity .15s' }}
            onMouseEnter={e=>e.currentTarget.style.opacity='.88'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            <FaPhone size={13}/> לשיחה עם נציג שלנו
          </button>
        </div>

        {/* Controls */}
        <div className="mortgage-controls-col" style={{ padding:'24px 22px', display:'flex', flexDirection:'column', gap:20 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:C.cream, marginBottom:2 }}>הדרך לבית שלכם מתחילה כאן</div>
            <div style={{ fontSize:11, color:`${C.cream}44` }}>מחשב מיידי — ללא התחייבות</div>
          </div>

          {/* Equity slider */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:13, color:`${C.cream}88`, fontWeight:600 }}>כמה הון עצמי יש לך?</span>
              <span style={{ fontSize:15, fontWeight:900, color:C.cream, background:'rgba(255,255,255,.07)', borderRadius:8, padding:'2px 10px' }}>₪{fmtN(equity)}</span>
            </div>
            <input type="range" min={minEquity} max={maxEquity} step={10000} value={equity} onChange={e=>setEquity(+e.target.value)}
              style={{ width:'100%', accentColor:YAD2_ORANGE, cursor:'pointer', height:6, borderRadius:4 }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:`${C.cream}33`, marginTop:5 }}>
              <span>₪{fmtN(minEquity)}</span><span>₪{fmtN(maxEquity)}</span>
            </div>
          </div>

          {/* Years slider */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={{ fontSize:13, color:`${C.cream}88`, fontWeight:600 }}>לכמה שנים המשכנתה?</span>
              <span style={{ fontSize:15, fontWeight:900, color:C.cream, background:'rgba(255,255,255,.07)', borderRadius:8, padding:'2px 10px' }}>{years} שנה</span>
            </div>
            <input type="range" min={5} max={30} value={years} onChange={e=>setYears(+e.target.value)}
              style={{ width:'100%', accentColor:YAD2_ORANGE, cursor:'pointer', height:6, borderRadius:4 }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:`${C.cream}33`, marginTop:5 }}>
              <span>5 שנים</span><span>30 שנים</span>
            </div>
          </div>

          <div style={{ fontSize:11, color:`${C.cream}28`, lineHeight:1.7 }}>
            החישובים מבוססים על ריבית קבועה {rate}%. הנתונים הם הערכה בלבד ואינם מהווים ייעוץ פיננסי.
          </div>
        </div>
      </div>
    </div>
  )
}

function MortgageMini({ price, C }) {
  const pNum = Number(String(price || 0).replace(/[^\d]/g, ''))
  const [equityPct, setEquityPct] = useState(30)
  const [years, setYears] = useState(25)
  const equityAmt = Math.round(pNum * equityPct / 100)
  const loan = Math.max(0, pNum - equityAmt)
  const r = 0.045 / 12
  const n = years * 12
  const monthly = loan > 0 && r > 0 ? Math.round(loan * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1)) : 0

  if (!pNum) return null
  return (
    <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(132,144,216,.18)', borderRadius:14, padding:'18px 16px' }}>
      <div style={{ fontSize:13, fontWeight:800, color:C.cream, marginBottom:14, display:'flex', alignItems:'center', gap:7 }}>
        <FaCalculator size={13} style={{ color:C.purple }}/> מחשבון משכנתא מהיר
      </div>
      <div style={{ marginBottom:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:`${C.cream}70`, marginBottom:5 }}>
          <span>הון עצמי</span><span style={{ fontWeight:700, color:C.cream }}>{equityPct}% · ₪{equityAmt.toLocaleString('he-IL')}</span>
        </div>
        <input type="range" min={10} max={80} value={equityPct} onChange={e => setEquityPct(+e.target.value)}
          style={{ width:'100%', accentColor:C.purple, cursor:'pointer' }}/>
      </div>
      <div style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:`${C.cream}70`, marginBottom:5 }}>
          <span>תקופת הלוואה</span><span style={{ fontWeight:700, color:C.cream }}>{years} שנה</span>
        </div>
        <input type="range" min={10} max={30} value={years} onChange={e => setYears(+e.target.value)}
          style={{ width:'100%', accentColor:C.purple, cursor:'pointer' }}/>
      </div>
      <div style={{ background:`${C.purple}14`, border:`1px solid ${C.purple}30`, borderRadius:10, padding:'14px 16px', textAlign:'center', marginBottom:10 }}>
        <div style={{ fontSize:11, color:`${C.cream}55`, marginBottom:4 }}>החזר חודשי משוער</div>
        <div style={{ fontSize:26, fontWeight:900, color:C.cream, lineHeight:1.1 }}>₪{monthly.toLocaleString('he-IL')}</div>
        <div style={{ fontSize:10, color:`${C.cream}40`, marginTop:4 }}>ריבית הנחה: 4.5% · הערכה בלבד</div>
      </div>
      <div style={{ fontSize:11, color:`${C.cream}40`, textAlign:'center' }}>ה"ה: ₪{equityAmt.toLocaleString('he-IL')} · הלוואה: ₪{loan.toLocaleString('he-IL')}</div>
    </div>
  )
}

function PdfLeadGate({ pdf, prop, C }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [done, setDone] = useState(false)
  const storageKey = `pdf_lead_${prop.id}_${pdf.name}`

  useEffect(() => {
    try { if (localStorage.getItem(storageKey)) setDone(true) } catch {}
  }, [storageKey])

  const submit = e => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    const lead = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name, phone,
      propTitle: prop.title || '', propLocation: prop.location || '',
      msg: `הורדת PDF: ${pdf.name}`,
      source: 'pdf_download',
      ts: Date.now(),
    }
    try {
      const all = JSON.parse(localStorage.getItem(LEADS_STORE) || '[]')
      all.unshift(lead)
      localStorage.setItem(LEADS_STORE, JSON.stringify(all.slice(0, 2000)))
      localStorage.setItem(storageKey, '1')
    } catch {}
    if (API_BASE) {
      fetch(`${API_BASE}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lead),
      }).catch(() => {})
    }
    setDone(true)
    setOpen(false)
    window.open(pdf.url, '_blank', 'noopener')
    try {
      const waConf = { ...WA_DEFAULTS, ...(_cloudSettings.waSettings || JSON.parse(localStorage.getItem(WA_KEY) || '{}')) }
      if (waConf.enabled && waConf.instanceId && waConf.token && phone) {
        const delayMs = (waConf.delayMin || 2) * 60 * 1000
        setTimeout(() => sendWhatsAppLead(lead, waConf), delayMs)
      }
    } catch {}
  }

  const inp = { width:'100%', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.14)', borderRadius:8, padding:'10px 13px', color:'#fff', fontFamily:'inherit', fontSize:14, boxSizing:'border-box', outline:'none' }

  return (
    <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:12, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px' }}>
        <FaFileAlt size={18} style={{ color:C.purple, flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pdf.name || 'מסמך PDF'}</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.45)', marginTop:2 }}>PDF · לחץ להורדה</div>
        </div>
        <button
          onClick={() => { if (done) { window.open(pdf.url, '_blank', 'noopener') } else { setOpen(o => !o) } }}
          style={{ flexShrink:0, padding:'8px 16px', background: done ? `${C.green}18` : `${C.purple}22`, border:`1px solid ${done ? C.green+'44' : C.purple+'44'}`, borderRadius:8, color: done ? C.green : C.purple, cursor:'pointer', fontSize:13, fontFamily:'inherit', fontWeight:700, display:'flex', alignItems:'center', gap:6, transition:'all .15s', whiteSpace:'nowrap' }}>
          {done ? <><FaCheck size={11}/> הורד</> : <><FaFileAlt size={11}/> הורדה</>}
        </button>
      </div>
      {open && !done && (
        <form onSubmit={submit} style={{ borderTop:'1px solid rgba(255,255,255,.08)', padding:'16px', display:'flex', flexDirection:'column', gap:12, background:'rgba(0,0,0,.2)' }}>
          <div style={{ fontSize:13, color:'rgba(255,255,255,.7)', marginBottom:4 }}>השאר פרטים כדי לקבל את הקובץ:</div>
          <input required placeholder="שם מלא" value={name} onChange={e=>setName(e.target.value)} style={inp}/>
          <input required type="tel" placeholder="טלפון" value={phone} onChange={e=>setPhone(e.target.value)} style={inp}/>
          <button type="submit" style={{ padding:'11px', background:C.purple, border:'none', borderRadius:8, color:'#fff', fontFamily:'inherit', fontSize:14, fontWeight:700, cursor:'pointer' }}>שלח והורד</button>
        </form>
      )}
    </div>
  )
}

function toMapsEmbed(url) {
  if (!url) return null
  const u = url.trim()

  // Already a proper embed URL — use as-is
  if (u.includes('/maps/embed') || u.includes('output=embed')) return u

  // Short-link URLs (maps.app.goo.gl, goo.gl/maps) redirect server-side and cannot be
  // embedded in an iframe — return null so we fall back to the "Open in Maps" button
  if (u.includes('maps.app.goo.gl') || u.includes('goo.gl/maps')) return null

  // Must be a full google.com/maps URL to proceed
  if (!u.includes('google.com/maps')) return null

  // Extract coordinates from @lat,lng pattern (most reliable)
  const coords = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (coords) return `https://maps.google.com/maps?q=${coords[1]},${coords[2]}&z=16&output=embed`

  // Extract ?q= query (e.g. /maps?q=TelAviv)
  const qParam = u.match(/[?&]q=([^&]+)/)
  if (qParam) return `https://maps.google.com/maps?q=${qParam[1]}&output=embed`

  // Extract place name from /maps/place/NAME/
  const placeMatch = u.match(/\/maps\/place\/([^/?]+)/)
  if (placeMatch) return `https://maps.google.com/maps?q=${encodeURIComponent(decodeURIComponent(placeMatch[1]))}&output=embed`

  return null
}

// Transform image URL: WebP + resize via Supabase Storage render API or Cloudinary.
// base64 data URLs returned as-is (legacy images uploaded before cloud storage).
function cloudImg(url, width = 1200) {
  if (!url || url.startsWith('data:')) return url

  // Supabase Storage → use render/image endpoint for WebP + resize
  if (url.includes('.supabase.co/storage/v1/object/public/')) {
    const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    const sep = transformed.includes('?') ? '&' : '?'
    return `${transformed}${sep}width=${width}&quality=80&format=webp`
  }

  // Cloudinary → add quality + format-auto params
  if (url.includes('cloudinary.com') && url.includes('/image/upload/')) {
    if (/\/(?:q_auto|q_\d|f_auto|fl_progressive)/.test(url)) return url
    return url.replace('/image/upload/', `/image/upload/w_${width},q_auto:good,f_auto/`)
  }

  return url
}

// Small thumbnail — card cover images (saves 60–80 % bandwidth vs full size)
function thumbImg(url) { return cloudImg(url, 600) }

function getVideoThumbnail(url, thumbnail) {
  if (thumbnail) return thumbnail
  if (!url) return null
  if (url.includes('cloudinary.com') && url.includes('/video/upload/')) {
    return url
      .replace('/video/upload/', '/video/upload/so_0,w_800,q_auto,f_jpg/')
      .replace(/\.(mp4|webm|mov|avi|mkv|ogg)(\?.*)?$/i, '.jpg')
  }
  return null
}

// Return a streaming-optimised Cloudinary video URL (quality auto, format auto)
function optimizeVideoUrl(url) {
  if (!url) return url
  if (url.includes('cloudinary.com') && url.includes('/video/upload/')) {
    return url.replace('/video/upload/', '/video/upload/q_auto,vc_auto/')
  }
  return url
}

function PropertyModal({ prop, onClose, onContact, govmapToken, properties = [], onSelect }) {
  const { C, isDark } = useTheme()
  const [imgIdx, setImgIdx] = useState(0)
  const [saved, setSaved] = useState(false)
  const [shared, setShared] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const slideshowRef = useRef(null)
  const videoRef = useRef(null)
  const propSwipe = useSwipeClose(onClose)
  // Gallery touch swipe — navigate photos without closing modal
  const galleryTouch = useRef({ x: 0, y: 0 })

  useEffect(() => { setVideoPlaying(false) }, [imgIdx])

  // Callback ref: fires immediately when <video> mounts (key-prop remount on URL change).
  // Sets muted imperatively (React drops the muted DOM attribute — known React bug).
  const setVideoRef = useCallback(node => {
    videoRef.current = node
    if (!node) return
    node.muted = true
    node.volume = 0
    const tryPlay = () => node.play().catch(() => {})
    if (node.readyState >= 2) {
      tryPlay()
    } else {
      node.addEventListener('loadeddata', tryPlay, { once: true })
      node.addEventListener('canplay',    tryPlay, { once: true })
    }
  }, [])

  const handleShare = () => {
    const txt = `${prop.title} — ${[prop.location, prop.neighborhood].filter(Boolean).join(', ')}`
    if (navigator.share) {
      navigator.share({ title: prop.title, text: txt, url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(txt + '\n' + window.location.href).then(() => { setShared(true); setTimeout(() => setShared(false), 2000) }).catch(() => {})
    }
  }
  const cat = CATEGORIES.find(c => c.id === prop.category) || CATEGORIES[1]
  const sc = { 'זמין':C.green, 'בבדיקה':'#F7C948', 'נמכר':'#E05252', 'הושכר':'#F97316' }[prop.status] || C.green

  const imgs = (prop.images || []).filter(u => u && typeof u === 'string' && u.length > 4).map(cloudImg)
  // Build unified video list — skip blob: URLs (temporary local refs that die on reload)
  const isValidVideoUrl = u => u && typeof u === 'string' && u.length > 4 && !u.startsWith('blob:')
  const allVideos = [
    ...(prop.videos || []).filter(v => isValidVideoUrl(v?.url)),
    ...(isValidVideoUrl(prop.videoUrl) && !(prop.videos || []).some(v => v.url === prop.videoUrl)
      ? [{ url: prop.videoUrl, thumbnail: null }] : []),
  ]
  const hasVideo = allVideos.length > 0
  const totalMedia = imgs.length + allVideos.length
  const videoIdx = imgIdx >= imgs.length ? imgIdx - imgs.length : -1
  const isVideoFrame = videoIdx >= 0
  const currentVideo = isVideoFrame ? (allVideos[videoIdx] || null) : null
  const videoType = currentVideo
    ? (/cloudinary\.com/.test(currentVideo.url) ? 'cloudinary'
      : /youtube\.com|youtu\.be/.test(currentVideo.url) ? 'youtube' : null)
    : null
  const youtubeId = videoType === 'youtube'
    ? (currentVideo.url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\n?#]+)/)?.[1] || null)
    : null

  const isRental = prop.txType === 'rent' || prop.status === 'הושכר' || prop.status === 'להשכרה'
  const fmt = p => {
    if (!p) return 'מחיר בפנייה'
    const n = Number(String(p).replace(/[^\d]/g,''))
    const base = n >= 1000000 ? `${(n/1000000).toFixed(2).replace(/\.?0+$/,'')} מיל׳ ₪`
                : n >= 1000   ? `${Math.round(n/1000).toLocaleString('he-IL')} אלף ₪`
                : `₪${p}`
    return isRental ? `${base} / לחודש` : base
  }

  useEffect(() => {
    const h = e => {
      if (e.key === 'Escape') { if (lightbox) setLightbox(false); else onClose() }
      if (totalMedia > 1 && e.key === 'ArrowRight') { setIsPlaying(false); setImgIdx(i => (i - 1 + totalMedia) % totalMedia) }
      if (totalMedia > 1 && e.key === 'ArrowLeft')  { setIsPlaying(false); setImgIdx(i => (i + 1) % totalMedia) }
    }
    document.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose, totalMedia, lightbox])

  // Slideshow — cycles through image frames only (videos play themselves)
  useEffect(() => {
    clearInterval(slideshowRef.current)
    if (!isPlaying || imgs.length <= 1) return
    slideshowRef.current = setInterval(() => {
      setImgIdx(i => {
        const next = (i + 1) % imgs.length
        return next
      })
    }, 4000)
    return () => clearInterval(slideshowRef.current)
  }, [isPlaying, imgs.length])

  const keySpecs = [
    prop.rooms      && { Icon:FaBed,          label:'חדרים',     v:prop.rooms },
    prop.size       && { Icon:FaRulerCombined, label:'מ"ר',       v:prop.size },
    prop.dunams     && { Icon:FaLeaf,          label:'דונמים',    v:prop.dunams },
    prop.floor      && { Icon:FaBuilding,      label:'קומה',      v:`${prop.floor}${prop.totalFloors?' / '+prop.totalFloors:''}` },
    (!prop.floor && prop.totalFloors) && { Icon:FaBuilding, label:'קומות', v:prop.totalFloors },
    prop.buildYear  && { Icon:FaCalendarAlt,   label:'שנת בנייה', v:prop.buildYear },
    prop.direction  && { Icon:FaCompass,       label:'כיוון',     v:prop.direction },
  ].filter(Boolean)

  const priceSqm = prop.price && prop.size
    ? Math.round(Number(String(prop.price).replace(/[^\d]/g,'')) / Number(prop.size))
    : null

  const extraSpecs = [
    { label:'סוג העסקה',     v:'מכירה' },
    prop.condition      && { label:'מצב הנכס',       v:prop.condition },
    (prop.buildSqm || prop.size) && { label:'מ"ר בנוי',  v:`${prop.buildSqm || prop.size} מ"ר` },
    prop.totalFloors    && { label:'קומות בבניין',   v:prop.totalFloors },
    prop.parkingCount   && { label:'חניות',           v:prop.parkingCount },
    priceSqm            && { label:'מחיר למ"ר',      v:`₪${priceSqm.toLocaleString('he-IL')}` },
    prop.entryDate      && { label:'תאריך כניסה',    v:prop.entryDate },
    prop.zoning         && { label:'ייעוד',           v:prop.zoning },
    prop.buildingRights && { label:'זכויות בנייה',   v:prop.buildingRights },
    prop.propertyTax    && { label:'ארנונה',          v:`₪${prop.propertyTax}/חודש` },
    prop.houseCommittee && { label:'ועד בית',         v:`₪${prop.houseCommittee}/חודש` },
  ].filter(Boolean)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', backdropFilter:'blur(14px)', zIndex:900, overflowY:'auto', WebkitOverflowScrolling:'touch', scrollBehavior:'smooth' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      onTouchStart={propSwipe.onTouchStart} onTouchEnd={propSwipe.onTouchEnd}>

      <div style={{ background:'#0B0B14', maxWidth:1100, margin:'0 auto', minHeight:'100dvh', direction:'rtl', position:'relative' }}>

        {/* ══ STICKY HEADER BAR ══ */}
        <div style={{ position:'sticky', top:0, zIndex:20, background:'rgba(11,11,20,.97)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(132,144,216,.12)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 18px', height:52, direction:'rtl' }}>
          {/* Back / breadcrumb */}
          <button onClick={onClose}
            style={{ display:'flex', alignItems:'center', gap:7, background:'none', border:'none', color:`${C.cream}88`, cursor:'pointer', fontSize:13, fontFamily:'inherit', padding:'6px 4px', direction:'ltr' }}
            onMouseEnter={e=>e.currentTarget.style.color=C.cream}
            onMouseLeave={e=>e.currentTarget.style.color=`${C.cream}88`}>
            <FaChevronLeft size={11}/>
            <span>חזרה לרשימה</span>
          </button>
          {/* Property name */}
          <span style={{ fontSize:13, fontWeight:700, color:`${C.cream}BB`, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'55%', textAlign:'center' }}>{prop.title}</span>
          {/* Close X */}
          <button onClick={onClose}
            style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,.06)', border:`1px solid rgba(132,144,216,.2)`, color:`${C.cream}AA`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', flexShrink:0 }}
            onMouseEnter={e=>{e.currentTarget.style.background=C.purple; e.currentTarget.style.color='#fff'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,.06)'; e.currentTarget.style.color=`${C.cream}AA`}}>
            <FaTimes size={13}/>
          </button>
        </div>

        {/* ══ FULL-WIDTH GALLERY ══ */}
        <div className="prop-gallery-main"
          onTouchStart={e => { galleryTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
          onTouchEnd={e => {
            e.stopPropagation()
            if (!totalMedia || totalMedia <= 1) return
            const dx = e.changedTouches[0].clientX - galleryTouch.current.x
            const dy = e.changedTouches[0].clientY - galleryTouch.current.y
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
              setImgIdx(i => dx > 0 ? (i - 1 + totalMedia) % totalMedia : (i + 1) % totalMedia)
            }
          }}>
          {isVideoFrame && currentVideo ? (
            videoType === 'cloudinary' || (currentVideo.url && !currentVideo.url.includes('youtube') && !currentVideo.url.includes('youtu.be')) ? (
              <>
                <video
                  ref={setVideoRef}
                  key={currentVideo.url}
                  src={optimizeVideoUrl(currentVideo.url)}
                  poster={getVideoThumbnail(currentVideo.url, currentVideo.thumbnail) || undefined}
                  style={{ width:'100%', height:'100%', objectFit:'contain', position:'relative', zIndex:1, background:'#000' }}
                  playsInline
                  autoPlay
                  loop={!!prop.videoAutoplay}
                  controls
                  preload="metadata"
                  onLoadedMetadata={e => { if (!getVideoThumbnail(currentVideo.url, currentVideo.thumbnail)) e.target.currentTime = 0.5 }}
                  onPlay={() => setVideoPlaying(true)}
                  onPause={() => setVideoPlaying(false)}
                />
              </>
            ) : (
              <iframe
                key={currentVideo.url}
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1${prop.videoAutoplay ? '&loop=1&playlist='+youtubeId : ''}`}
                title="video"
                style={{ width:'100%', height:'100%', border:'none' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )
          ) : imgs.length ? (
            <img src={imgs[Math.min(imgIdx, imgs.length - 1)]} alt={prop.title}
              key={imgIdx}
              decoding="async"
              onClick={() => setLightbox(true)}
              style={{ width:'100%', height:'100%', objectFit:'contain', objectPosition:'center', display:'block', animation:'gallery-fade .22s ease', cursor:'zoom-in', background:'#000' }}/>
          ) : (
            <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
              <FaBuilding size={64} style={{ color:`${C.purple}30` }}/>
              <span style={{ fontSize:11, color:`${C.cream}20`, letterSpacing:'.1em' }}>אין תמונות</span>
            </div>
          )}
          {/* Arrows */}
          {totalMedia > 1 && (<>
            <button onClick={() => { setIsPlaying(false); setImgIdx(i => (i - 1 + totalMedia) % totalMedia) }}
              style={{ position:'absolute', top:'50%', right:16, transform:'translateY(-50%)', background:'rgba(0,0,0,.6)', backdropFilter:'blur(6px)', border:`1px solid rgba(255,255,255,.15)`, borderRadius:'50%', width:46, height:46, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .18s, transform .18s cubic-bezier(.16,1,.3,1)', zIndex:3 }}
              onMouseEnter={e=>{ e.currentTarget.style.background=C.purple; e.currentTarget.style.transform='translateY(-50%) scale(1.12)' }}
              onMouseLeave={e=>{ e.currentTarget.style.background='rgba(0,0,0,.6)'; e.currentTarget.style.transform='translateY(-50%)' }}
              onMouseDown={e=>e.currentTarget.style.transform='translateY(-50%) scale(0.93)'}
              onMouseUp={e=>e.currentTarget.style.transform='translateY(-50%) scale(1.12)'}>
              <FaChevronRight size={16}/>
            </button>
            <button onClick={() => { setIsPlaying(false); setImgIdx(i => (i + 1) % totalMedia) }}
              style={{ position:'absolute', top:'50%', left:16, transform:'translateY(-50%)', background:'rgba(0,0,0,.6)', backdropFilter:'blur(6px)', border:`1px solid rgba(255,255,255,.15)`, borderRadius:'50%', width:46, height:46, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'background .18s, transform .18s cubic-bezier(.16,1,.3,1)', zIndex:3 }}
              onMouseEnter={e=>{ e.currentTarget.style.background=C.purple; e.currentTarget.style.transform='translateY(-50%) scale(1.12)' }}
              onMouseLeave={e=>{ e.currentTarget.style.background='rgba(0,0,0,.6)'; e.currentTarget.style.transform='translateY(-50%)' }}
              onMouseDown={e=>e.currentTarget.style.transform='translateY(-50%) scale(0.93)'}
              onMouseUp={e=>e.currentTarget.style.transform='translateY(-50%) scale(1.12)'}>
              <FaChevronLeft size={16}/>
            </button>
            {/* Counter + Play/Pause — hidden on video frame */}
            {!isVideoFrame && (
              <div style={{ position:'absolute', bottom:14, left:16, display:'flex', alignItems:'center', gap:8, zIndex:3 }}>
                {/* Play / Pause button — only when there are multiple images */}
                {imgs.length > 1 && (
                  <button onClick={() => setIsPlaying(p => !p)}
                    style={{ width:34, height:34, borderRadius:'50%', background: isPlaying ? C.purple : 'rgba(0,0,0,.72)', backdropFilter:'blur(6px)', border:`1.5px solid ${isPlaying ? C.purple : 'rgba(255,255,255,.25)'}`, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', flexShrink:0 }}
                    title={isPlaying ? 'עצור סליידשואו' : 'הפעל סליידשואו'}>
                    {isPlaying
                      ? <span style={{ display:'flex', gap:3 }}><span style={{ width:3, height:13, background:'#fff', borderRadius:2 }}/><span style={{ width:3, height:13, background:'#fff', borderRadius:2 }}/></span>
                      : <FaPlay size={11} style={{ marginRight:'-1px' }}/>}
                  </button>
                )}
                <div style={{ background:'rgba(0,0,0,.65)', backdropFilter:'blur(4px)', borderRadius:6, padding:'5px 12px', fontSize:13, color:'rgba(255,255,255,.92)', direction:'ltr', fontWeight:600 }}>
                  {imgIdx + 1} / {totalMedia}
                </div>
              </div>
            )}
            {/* Photo count badge — hidden on video frame so it doesn't overlap native controls */}
            {imgs.length > 0 && !isVideoFrame && (
              <button onClick={() => setLightbox(true)}
                style={{ position:'absolute', bottom:14, right:16, background:'rgba(0,0,0,.72)', backdropFilter:'blur(8px)', border:`1px solid rgba(255,255,255,.18)`, borderRadius:8, padding:'7px 14px', fontSize:13, color:'rgba(255,255,255,.92)', cursor:'pointer', fontFamily:'inherit', zIndex:3, display:'flex', alignItems:'center', gap:7, fontWeight:600 }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(0,0,0,.9)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(0,0,0,.72)'}>
                <FaExpand size={12}/> {imgs.length > 1 ? `הצגת ${imgs.length} תמונות` : 'הצגה מלאה'}
              </button>
            )}
          </>)}
          {/* SOLD / RENTED stamp overlay */}
          {(prop.status === 'נמכר' || prop.status === 'הושכר') && !isVideoFrame && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5, pointerEvents:'none' }}>
              <img src={prop.status === 'נמכר' ? '/SOLD.png' : '/Rented.png'} alt={prop.status}
                style={{ width:'38%', maxWidth:320, opacity:0.88, transform:'rotate(-10deg)', filter:'drop-shadow(0 8px 32px rgba(0,0,0,.8))' }}/>
            </div>
          )}
        </div>

        {/* ── Share / Save bar — below gallery, never overlaps video ── */}
        <div style={{ display:'flex', gap:8, padding:'10px 16px', background:'rgba(0,0,0,.55)', borderBottom:'1px solid rgba(132,144,216,.1)', direction:'rtl' }}>
          <button onClick={handleShare}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', background:'rgba(255,255,255,.09)', border:'1px solid rgba(255,255,255,.18)', borderRadius:22, color:'rgba(255,255,255,.88)', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, transition:'background .2s' }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.18)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.09)'}>
            <FaShareAlt size={13}/> {shared ? 'הועתק!' : 'שיתוף'}
          </button>
          <button onClick={() => setSaved(s => !s)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', background: saved ? 'rgba(255,100,100,.18)' : 'rgba(255,255,255,.09)', border:`1px solid ${saved ? 'rgba(255,100,100,.4)' : 'rgba(255,255,255,.18)'}`, borderRadius:22, color: saved ? '#FF8888' : 'rgba(255,255,255,.88)', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, transition:'all .2s' }}
            onMouseEnter={e=>{ if (!saved) e.currentTarget.style.background='rgba(255,255,255,.18)' }}
            onMouseLeave={e=>{ if (!saved) e.currentTarget.style.background='rgba(255,255,255,.09)' }}>
            <FaHeart size={13}/> {saved ? 'שמור' : 'שמירה'}
          </button>
        </div>

        {/* ══ THUMBNAIL STRIP ══ */}
        {totalMedia > 1 && (
          <div className="prop-gallery-thumb-strip">
            {imgs.map((src, i) => (
              <button key={i} onClick={() => { setIsPlaying(false); setImgIdx(i) }}
                className="prop-thumb-btn"
                style={{ border: imgIdx===i ? `2.5px solid ${C.purple}` : '2.5px solid transparent', opacity: imgIdx===i ? 1 : 0.55 }}>
                <img src={src} alt="" loading="lazy"/>
              </button>
            ))}
            {allVideos.map((v, vi) => {
              const vIdx = imgs.length + vi
              const thumb = getVideoThumbnail(v.url, v.thumbnail)
              return (
                <button key={vIdx} onClick={() => { setIsPlaying(false); setImgIdx(vIdx) }}
                  className="prop-thumb-btn"
                  style={{ border: imgIdx===vIdx ? `2.5px solid ${C.purple}` : '2.5px solid transparent', opacity: imgIdx===vIdx ? 1 : 0.55 }}>
                  {thumb ? (
                    <img src={thumb} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  ) : (
                    <video
                      src={v.url}
                      muted
                      playsInline
                      preload="metadata"
                      style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', pointerEvents:'none' }}
                      onLoadedMetadata={e => { e.target.currentTime = 0.5 }}
                    />
                  )}
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.22)' }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid rgba(255,255,255,.7)' }}>
                      <FaPlay size={8} style={{ color:'#fff', marginRight:'-1px' }}/>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Project logo strip — left-aligned */}
        {prop.logo && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-start', padding:'16px 28px 12px', background:'rgba(0,0,0,.45)', borderBottom:'1px solid rgba(132,144,216,.12)', direction:'ltr' }}>
            <img src={prop.logo} alt="לוגו פרויקט"
              style={{ height: prop.logoSize || 100, maxWidth:'60%', objectFit:'contain', filter:'brightness(1.2) drop-shadow(0 2px 12px rgba(0,0,0,.6))', opacity:1 }}/>
          </div>
        )}

        {/* ══ CONTENT AREA ══ */}
        <div className="prop-detail-body">

          {/* ── Main column (right in RTL) ── */}
          <div style={{ padding:'32px 36px 60px', display:'flex', flexDirection:'column', gap:28, direction:'rtl' }}>

            {/* Badges */}
            <div style={{ display:'flex', gap:7, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ background:C.purple, color:'#fff', borderRadius:20, padding:'6px 16px', fontSize:13, fontWeight:700 }}>{cat.label}</span>
              {prop.type && <span style={{ background:'rgba(255,255,255,.08)', color:`${C.cream}AA`, borderRadius:20, padding:'6px 14px', fontSize:13 }}>{prop.type}</span>}
              <span style={{ background:`${sc}18`, color:sc, border:`1px solid ${sc}40`, borderRadius:20, padding:'6px 14px', fontSize:13, fontWeight:700 }}>{prop.status}</span>
              {prop.exclusive && <span style={{ background:'rgba(255,255,255,.1)', color:'#fff', border:'1px solid rgba(255,255,255,.25)', borderRadius:20, padding:'6px 14px', fontSize:13, fontWeight:700 }}>✦ בלעדי</span>}
            </div>

            {/* Title + location */}
            <div>
              <h2 style={{ fontSize:'clamp(28px,3.5vw,42px)', fontWeight:900, color:C.cream, lineHeight:1.18, marginBottom:12 }}>{prop.title}</h2>
              {(prop.location || prop.neighborhood || prop.street) && (
                <div style={{ display:'flex', alignItems:'center', gap:8, color:`${C.cream}77`, fontSize:16, marginBottom: prop.mapsUrl ? 14 : 0 }}>
                  <FaMapMarkerAlt size={14} style={{ color:C.purple, flexShrink:0 }}/>
                  {[prop.location, prop.neighborhood, prop.street].filter(Boolean).join(' · ')}
                </div>
              )}
              {/* Inline mini map — shown only when a valid embeddable URL exists */}
              {prop.mapsUrl && (() => {
                const embedSrc = toMapsEmbed(prop.mapsUrl)
                if (!embedSrc) return null
                return (
                  <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid rgba(132,144,216,.22)', marginTop:4 }}>
                    <iframe src={embedSrc} width="100%" height="200" style={{ border:'none', display:'block' }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="מיקום הנכס"/>
                    <a href={prop.mapsUrl} target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background:'rgba(255,255,255,.04)', color:`${C.cream}77`, fontSize:12, textDecoration:'none', fontWeight:600 }}>
                      <FaExternalLinkAlt size={9}/> פתח ב-Google Maps
                    </a>
                  </div>
                )
              })()}
            </div>

            {/* Key specs chips */}
            {keySpecs.length > 0 && (
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {keySpecs.map((s, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:12, padding:'13px 20px' }}>
                    <s.Icon size={16} style={{ color:'#fff', opacity:.7 }}/>
                    <div>
                      <div style={{ fontSize:18, fontWeight:900, color:C.cream, lineHeight:1.1 }}>{s.v}</div>
                      <div style={{ fontSize:11, color:`${C.cream}55`, marginTop:1 }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            {prop.description && (
              <div>
                <h3 style={{ fontSize:17, fontWeight:800, color:C.cream, letterSpacing:'.02em', marginBottom:14 }}>תיאור הנכס</h3>
                <p style={{ fontSize:16, color:`${C.cream}CC`, lineHeight:2, margin:0 }}>{prop.description}</p>
              </div>
            )}

            {/* Extra specs table — "פרטים נוספים" Yad2-style */}
            {extraSpecs.length > 0 && (
              <div>
                <h3 style={{ fontSize:17, fontWeight:800, color:C.cream, letterSpacing:'.02em', marginBottom:14 }}>פרטים נוספים</h3>
                <div className="prop-extra-table">
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', direction:'rtl' }}>
                    {extraSpecs.map((s, i) => (
                      <div key={i} className="prop-extra-row" style={{ borderLeft: i % 2 === 0 ? '1px solid rgba(255,255,255,.07)' : 'none' }}>
                        <span style={{ color:`${C.cream}66`, fontSize:14, fontWeight:400 }}>{s.label}</span>
                        <span style={{ color:C.cream, fontWeight:700, fontSize:15 }}>{s.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Amenities — only show CHECKED items */}
            {prop.category !== 'land' && ALL_AMENITIES.some(a => !!prop[a.key]) && (
              <div>
                <h3 style={{ fontSize:17, fontWeight:800, color:C.cream, letterSpacing:'.02em', marginBottom:14 }}>מה יש בנכס</h3>
                <div className="prop-amenity-grid">
                  {ALL_AMENITIES.filter(a => !!prop[a.key]).map((a, i) => (
                    <div key={i} className="prop-amenity-item prop-amenity-on">
                      <a.Icon size={15} style={{ color:'#fff', flexShrink:0 }}/>
                      <span>{a.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Yad2-style mortgage calculator — shown for properties with a price */}
            {prop.price && prop.category !== 'land' && (
              <MortgageInline price={prop.price} C={C} onContact={onContact} prop={prop}/>
            )}

            {/* External links */}
            {(prop.landingPageUrl || prop.mapsUrl) && (
              <div style={{ display:'flex', gap:9, flexWrap:'wrap' }}>
                {prop.landingPageUrl && (
                  <a href={prop.landingPageUrl} target="_blank" rel="noopener noreferrer"
                    style={{ flex:'1 1 140px', display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'13px', background:`${C.purple}16`, border:`1px solid ${C.purple}40`, borderRadius:9, color:C.purple, textDecoration:'none', fontSize:13, fontWeight:700, transition:'background .2s', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background=`${C.purple}28`}
                    onMouseLeave={e=>e.currentTarget.style.background=`${C.purple}16`}>
                    <FaExternalLinkAlt size={12}/> דף נחיתה
                  </a>
                )}
                {prop.mapsUrl && (
                  <a href={prop.mapsUrl} target="_blank" rel="noopener noreferrer"
                    style={{ flex:'1 1 140px', display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'13px', background:`${C.green}0E`, border:`1px solid ${C.green}33`, borderRadius:9, color:C.green, textDecoration:'none', fontSize:13, fontWeight:700, transition:'background .2s', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background=`${C.green}1E`}
                    onMouseLeave={e=>e.currentTarget.style.background=`${C.green}0E`}>
                    <FaMapMarkerAlt size={12}/> צפה במפה
                  </a>
                )}
              </div>
            )}

            {/* PDFs / Plans — lead-gated download */}
            {prop.pdfs?.length > 0 && (
              <div>
                <h3 style={{ fontSize:17, fontWeight:800, color:C.cream, letterSpacing:'.02em', marginBottom:14, display:'flex', alignItems:'center', gap:9 }}>
                  <FaFileAlt size={15} style={{ color:C.purple }}/> מסמכים ותוכניות
                </h3>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {prop.pdfs.map((pdf, i) => (
                    <PdfLeadGate key={i} pdf={pdf} prop={prop} C={C}/>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar (left in RTL) ── */}
          <div className="prop-detail-sidebar" style={{ padding:'28px 22px 36px', display:'flex', flexDirection:'column', gap:12, direction:'rtl' }}>

            {/* Price box */}
            <div style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)', borderRadius:14, padding:'22px 20px' }}>
              <div style={{ fontSize:11, color:`${C.cream}44`, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:8 }}>מחיר הנכס</div>
              <div style={{ fontSize:32, fontWeight:900, color:'#fff', lineHeight:1.1 }}>{fmt(prop.price)}</div>
              {prop.priceNegotiable && (
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'rgba(255,255,255,.7)', fontWeight:600, marginTop:8 }}>
                  <FaHandshake size={13}/> מחיר גמיש — פתוח לדיון
                </div>
              )}
            </div>

            {/* CTA buttons */}
            <button onClick={() => onContact(prop)}
              style={{ width:'100%', padding:'17px', fontSize:15, borderRadius:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:9, background:C.purple, border:'none', color:'#fff', fontFamily:'inherit', fontWeight:800, boxShadow:`0 8px 28px ${C.purple}44`, transition:'all .22s' }}
              onMouseEnter={e=>{ e.currentTarget.style.opacity='.88'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e=>{ e.currentTarget.style.opacity='1'; e.currentTarget.style.transform='' }}>
              <FaPhone size={14}/> שיחה עם הנציג שלנו
            </button>
            <a href="https://wa.me/972559811814" target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'15px', background:'rgba(37,211,102,.1)', border:'1px solid rgba(37,211,102,.3)', borderRadius:10, color:'#25D366', textDecoration:'none', fontSize:14, fontWeight:700, transition:'background .2s' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(37,211,102,.2)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(37,211,102,.1)'}>
              <FaWhatsapp size={17}/> שלח WhatsApp
            </a>
            <a href="tel:0559811814"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'14px', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.12)', borderRadius:10, color:`${C.cream}BB`, textDecoration:'none', fontSize:14, fontWeight:500, transition:'background .2s' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.1)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.05)'}>
              <FaPhone size={13}/> 055-981-1814
            </a>

            {/* Map embed */}
            {prop.mapsUrl && (() => {
              const embedSrc = toMapsEmbed(prop.mapsUrl)
              return embedSrc ? (
                <div style={{ borderRadius:12, overflow:'hidden', border:'1px solid rgba(132,144,216,.18)' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(255,255,255,.05)', borderBottom:'1px solid rgba(255,255,255,.07)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <FaMapMarkerAlt size={14} style={{ color:C.purple }}/>
                      <span style={{ fontSize:13, fontWeight:600, color:'rgba(232,228,216,.85)' }}>{[prop.location, prop.neighborhood].filter(Boolean).join(', ')}</span>
                    </div>
                    <a href={prop.mapsUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize:11, color:C.purple, textDecoration:'none', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                      <FaExternalLinkAlt size={9}/> פתח במפות
                    </a>
                  </div>
                  <iframe src={embedSrc} width="100%" height="220" style={{ border:'none', display:'block' }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="מיקום הנכס"/>
                </div>
              ) : (
                <a href={prop.mapsUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 18px', background:'rgba(255,255,255,.04)', border:`1px solid ${C.purple}30`, borderRadius:12, textDecoration:'none', transition:'all .2s', cursor:'pointer' }}
                  onMouseEnter={e=>{ e.currentTarget.style.background='rgba(132,144,216,.1)'; e.currentTarget.style.borderColor=C.purple }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='rgba(255,255,255,.04)'; e.currentTarget.style.borderColor=`${C.purple}30` }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:`${C.purple}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <FaMapMarkerAlt size={20} style={{ color:C.purple }}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ color:C.cream, fontWeight:700, fontSize:14, marginBottom:3 }}>פתח במפות Google</div>
                    <div style={{ fontSize:12, color:`${C.cream}55` }}>{[prop.location, prop.neighborhood].filter(Boolean).join(', ') || 'לחץ לצפייה במיקום'}</div>
                  </div>
                  <FaExternalLinkAlt size={12} style={{ color:`${C.cream}44`, flexShrink:0 }}/>
                </a>
              )
            })()}
          </div>
        </div>

        {/* ══ SIMILAR PROPERTIES FROM OFFICE — Yad2 style ══ */}
        {(() => {
          const similar = properties.filter(p => p.published !== false && p.id !== prop.id).slice(0, 6)
          if (!similar.length) return null
          const fmtP = p => {
            if (!p) return 'מחיר בפנייה'
            const n = Number(String(p).replace(/[^\d]/g,''))
            if (n >= 1000000) return `${(n/1000000).toFixed(2).replace(/\.?0+$/,'')} מיל׳ ₪`
            if (n >= 1000) return `${Math.round(n/1000).toLocaleString('he-IL')} אלף ₪`
            return `₪${p}`
          }
          return (
            <div style={{ borderTop:'1px solid rgba(255,255,255,.08)', padding:'36px 32px 52px', direction:'rtl' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
                <h3 style={{ fontSize:20, fontWeight:800, color:C.cream, margin:0 }}>נכסים נוספים מהמשרד</h3>
                <span style={{ fontSize:13, color:C.purple, cursor:'pointer', fontWeight:600, display:'flex', alignItems:'center', gap:5 }}
                  onClick={onClose}>לאתר המשרד <FaChevronLeft size={10}/></span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:20 }}>
                {similar.map(sp => {
                  const spCat = CATEGORIES.find(c => c.id === sp.category) || CATEGORIES[1]
                  const sc2 = { 'זמין':'#4ade80', 'בבדיקה':'#F7C948', 'נמכר':'#E05252', 'הושכר':'#F97316' }[sp.status] || '#4ade80'
                  return (
                    <div key={sp.id} onClick={() => onSelect(sp)}
                      style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.09)', borderRadius:14, overflow:'hidden', cursor:'pointer', transition:'all .22s', position:'relative' }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,.22)'; e.currentTarget.style.transform='translateY(-5px)'; e.currentTarget.style.boxShadow='0 20px 48px rgba(0,0,0,.35)' }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(255,255,255,.09)'; e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
                      {/* Image */}
                      <div style={{ height:160, background:'rgba(255,255,255,.03)', position:'relative', overflow:'hidden' }}>
                        {sp.images?.[0]
                          ? <img src={sp.images[0]} alt={sp.title} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'transform .4s' }}/>
                          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><spCat.Icon size={36} style={{ color:'rgba(255,255,255,.15)' }}/></div>
                        }
                        {/* Heart save button */}
                        <button onClick={e=>{e.stopPropagation()}}
                          style={{ position:'absolute', top:10, left:10, width:32, height:32, borderRadius:'50%', background:'rgba(0,0,0,.5)', border:'1px solid rgba(255,255,255,.2)', color:'rgba(255,255,255,.7)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
                          <FaHeart size={11}/>
                        </button>
                        {/* Status badge */}
                        <span style={{ position:'absolute', top:10, right:10, background:'rgba(0,0,0,.75)', color:sc2, fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, backdropFilter:'blur(6px)' }}>{sp.status}</span>
                        {sp.exclusive && <span style={{ position:'absolute', bottom:10, right:10, background:'rgba(0,0,0,.75)', color:'#fff', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, backdropFilter:'blur(6px)' }}>✦ בלעדי</span>}
                      </div>
                      {/* Body */}
                      <div style={{ padding:'14px 16px' }}>
                        <div style={{ fontSize:16, fontWeight:800, color:'#fff', marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{fmtP(sp.price)}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:`rgba(255,255,255,.88)`, marginBottom:5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sp.title || '—'}</div>
                        <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginBottom:8, display:'flex', alignItems:'center', gap:5 }}>
                          <FaMapMarkerAlt size={10} style={{ color:C.purple, flexShrink:0 }}/>{[sp.location, sp.neighborhood].filter(Boolean).join(' · ') || '—'}
                        </div>
                        {/* Specs row */}
                        <div style={{ display:'flex', gap:10, fontSize:11, color:'rgba(255,255,255,.55)', borderTop:'1px solid rgba(255,255,255,.07)', paddingTop:8, flexWrap:'wrap' }}>
                          {sp.rooms    && <span>{sp.rooms} חד׳</span>}
                          {sp.floor    && <span>קומה {sp.floor}</span>}
                          {sp.size     && <span>{sp.size} מ"ר</span>}
                          {sp.dunams   && <span>{sp.dunams} דונם</span>}
                          <span style={{ marginRight:'auto', color:C.purple, fontWeight:600, fontSize:12 }}>{spCat.label}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ══ GOVMAP — full width at the very bottom ══ */}
        {govmapToken && (
          <div style={{ borderTop:`1px solid ${C.purple}18`, padding:'32px 28px 48px', direction:'rtl' }}>
            <h3 style={{ fontSize:18, fontWeight:800, color:C.cream, marginBottom:18, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <FaMapMarkerAlt size={16} style={{ color:C.purple }}/>
              מפת גוש וחלקה
              {(prop.gush || prop.helka) && (
                <span style={{ fontSize:12, fontWeight:600, color:`${C.cream}55`, background:`${C.purple}15`, borderRadius:6, padding:'3px 12px' }}>
                  {prop.gush ? `גוש ${prop.gush}` : ''}{prop.gush && prop.helka ? ' · ' : ''}{prop.helka ? `חלקה ${prop.helka}` : ''}{prop.subHelka ? ` · תת ${prop.subHelka}` : ''}
                </span>
              )}
            </h3>
            <GovMapWidget
              gush={prop.gush}
              helka={prop.helka}
              subHelka={prop.subHelka}
              token={govmapToken}
              C={C}
              isDark={isDark}
              defaultLayers={_cloudSettings.gmLayers}
              defaultBg={_cloudSettings.gmBg}
            />
          </div>
        )}
      </div>

      {/* ══ LIGHTBOX OVERLAY ══ */}
      {lightbox && imgs.length > 0 && (() => {
        const lbIdx = Math.min(imgIdx, imgs.length - 1)
        let tsX = null
        const onTouchStart = e => { tsX = e.touches[0].clientX }
        const onTouchEnd = e => {
          if (tsX === null) return
          const dx = e.changedTouches[0].clientX - tsX
          if (Math.abs(dx) > 40) setImgIdx(i => dx > 0 ? (i - 1 + imgs.length) % imgs.length : (i + 1) % imgs.length)
          tsX = null
        }
        return (
          <div
            onClick={e => { if (e.target === e.currentTarget) setLightbox(false) }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,.96)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {/* Close button */}
            <button onClick={() => setLightbox(false)}
              style={{ position:'absolute', top:16, right:16, width:44, height:44, borderRadius:'50%', background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.25)', color:'#fff', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10, transition:'background .2s' }}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.28)'}
              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.12)'}>
              <FaTimes size={16}/>
            </button>
            {/* Image counter */}
            <div style={{ position:'absolute', top:20, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,.65)', borderRadius:20, padding:'5px 16px', fontSize:13, color:'rgba(255,255,255,.85)', fontWeight:600, zIndex:10, direction:'ltr' }}>
              {lbIdx + 1} / {imgs.length}
            </div>
            {/* Main image */}
            <img src={imgs[lbIdx]} alt={prop.title} decoding="async"
              style={{ maxWidth:'92vw', maxHeight:'88vh', objectFit:'contain', display:'block', borderRadius:6, userSelect:'none', pointerEvents:'none' }}/>
            {/* Prev arrow (right side = prev in RTL numbering, but visually RTL means right = back) */}
            {imgs.length > 1 && (<>
              <button onClick={() => setImgIdx(i => (i - 1 + imgs.length) % imgs.length)}
                style={{ position:'absolute', top:'50%', right:20, transform:'translateY(-50%)', width:52, height:52, borderRadius:'50%', background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.22)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10, transition:'background .2s' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.28)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.12)'}>
                <FaChevronRight size={18}/>
              </button>
              <button onClick={() => setImgIdx(i => (i + 1) % imgs.length)}
                style={{ position:'absolute', top:'50%', left:20, transform:'translateY(-50%)', width:52, height:52, borderRadius:'50%', background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.22)', color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10, transition:'background .2s' }}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.28)'}
                onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.12)'}>
                <FaChevronLeft size={18}/>
              </button>
            </>)}
            {/* Thumbnail dots */}
            {imgs.length > 1 && imgs.length <= 12 && (
              <div style={{ position:'absolute', bottom:22, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6, zIndex:10 }}>
                {imgs.map((_,i) => (
                  <button key={i} onClick={() => setImgIdx(i)}
                    style={{ width:i===lbIdx?22:7, height:7, borderRadius:4, background:i===lbIdx?'white':'rgba(255,255,255,.35)', border:'none', cursor:'pointer', padding:0, transition:'all .22s' }}/>
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ─── PROPERTY CARD ────────────────────────────────────────────────────────────
function PropertyCard({ prop, onContact, onSelect }) {
  const { C } = useTheme()
  const [imgIdx, setImgIdx] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [failedImgs, setFailedImgs] = useState(new Set())
  const isTouchDevice = useRef(typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)).current
  // Cards use thumbnail-size images (600px wide) — 60-80% bandwidth saving
  const validImages = (prop.images || []).filter(u => u && typeof u === 'string' && u.length > 4).map(thumbImg)
  const cat = CATEGORIES.find(c => c.id === prop.category) || CATEGORIES[1]
  const sc = { 'זמין':C.green, 'בבדיקה':'#F7C948', 'נמכר':'#E05252', 'הושכר':'#F97316' }[prop.status] || C.green

  const cardIsRental = prop.txType === 'rent' || prop.status === 'הושכר' || prop.status === 'להשכרה'
  const fmt = p => {
    if (!p) return 'מחיר בפנייה'
    const n = Number(String(p).replace(/[^\d]/g,''))
    const base = n >= 1000000 ? `${(n/1000000).toFixed(2).replace(/\.?0+$/,'')} מיל׳ ₪`
                : n >= 1000   ? `${Math.round(n/1000).toLocaleString('he-IL')} אלף ₪`
                : `₪${p}`
    return cardIsRental ? `${base} / לחודש` : base
  }

  const specs = [
    prop.rooms      && { Icon:FaBed,          v:`${prop.rooms} חד׳` },
    prop.size       && { Icon:FaRulerCombined, v:`${prop.size} מ"ר` },
    prop.dunams     && { Icon:FaLeaf,          v:`${prop.dunams} דונם` },
    prop.floor      && { Icon:FaBuilding,      v:`קומה ${prop.floor}` },
    prop.zoning     && { Icon:FaFileAlt,       v:prop.zoning },
    prop.parking    && { Icon:FaCar,           v:'חניה' },
    prop.balcony    && { Icon:FaSun,           v:'מרפסת' },
    prop.pool       && { Icon:FaSwimmingPool,  v:'בריכה' },
    prop.garden     && { Icon:FaTree,          v:'גינה' },
    prop.safeRoom   && { Icon:FaShieldAlt,     v:'ממ"ד' },
    prop.airCon     && { Icon:FaSnowflake,     v:'מיזוג' },
  ].filter(Boolean).slice(0,6)

  const PlaceholderIcon = cat.id==='land' ? FaLeaf : cat.id==='projects' ? FaBuilding : FaHome

  const touchY = useRef(0)
  const touchFromArrow = useRef(false)

  return (
    <div
      onClick={() => onSelect(prop)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={e => { touchY.current = e.touches[0].clientY }}
      onTouchEnd={e => { if (touchFromArrow.current) { touchFromArrow.current = false; return }; if (Math.abs(e.changedTouches[0].clientY - touchY.current) < 8) { e.preventDefault(); onSelect(prop) } }}
      className="prop-card"
      style={{ touchAction:'manipulation' }}>

      {/* ── Image area ── */}
      <div className="prop-card-img">
        {validImages.length > 0 && !failedImgs.has(imgIdx % validImages.length) ? (
          <>
            <img src={validImages[imgIdx % validImages.length]} alt={prop.title}
              loading="lazy" decoding="async"
              style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'transform .55s cubic-bezier(0.16,1,0.3,1)', transform:hovered?'scale(1.05)':'scale(1)' }}
              onError={() => setFailedImgs(prev => new Set([...prev, imgIdx % validImages.length]))}
            />
            {/* gradient scrim at bottom for readability */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'55%', background:'linear-gradient(to top,rgba(0,0,0,.55),transparent)', pointerEvents:'none', zIndex:1 }}/>
            {validImages.length > 1 && (<>
              <button
                onClick={e => { e.stopPropagation(); setImgIdx(i => (i-1+validImages.length)%validImages.length) }}
                onTouchStart={e => { e.stopPropagation(); touchFromArrow.current = true }}
                onTouchEnd={e => { e.stopPropagation(); setImgIdx(i => (i-1+validImages.length)%validImages.length) }}
                style={{ position:'absolute', top:'50%', right:8, transform:'translateY(-50%)', background:'rgba(0,0,0,.55)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'50%', width:44, height:44, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', zIndex:3, opacity: hovered || isTouchDevice ? 1 : 0 }}
                onMouseEnter={e=>e.currentTarget.style.background=C.purple} onMouseLeave={e=>e.currentTarget.style.background='rgba(0,0,0,.55)'}>
                <FaChevronRight size={12}/>
              </button>
              <button
                onClick={e => { e.stopPropagation(); setImgIdx(i => (i+1)%validImages.length) }}
                onTouchStart={e => { e.stopPropagation(); touchFromArrow.current = true }}
                onTouchEnd={e => { e.stopPropagation(); setImgIdx(i => (i+1)%validImages.length) }}
                style={{ position:'absolute', top:'50%', left:8, transform:'translateY(-50%)', background:'rgba(0,0,0,.55)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'50%', width:44, height:44, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', zIndex:3, opacity: hovered || isTouchDevice ? 1 : 0 }}
                onMouseEnter={e=>e.currentTarget.style.background=C.purple} onMouseLeave={e=>e.currentTarget.style.background='rgba(0,0,0,.55)'}>
                <FaChevronLeft size={12}/>
              </button>
              {/* photo count — bottom right */}
              <div style={{ position:'absolute', bottom:10, right:10, background:'rgba(0,0,0,.65)', backdropFilter:'blur(6px)', borderRadius:5, padding:'3px 8px', fontSize:10, color:'rgba(255,255,255,.88)', display:'flex', alignItems:'center', gap:4, fontWeight:600, zIndex:4 }}>
                <FaCamera size={8}/> {validImages.length}
              </div>
            </>)}
          </>
        ) : (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10, background:`linear-gradient(135deg,${C.purple}14,${C.bg}66)` }}>
            <PlaceholderIcon size={40} style={{ color:`${C.purple}55` }}/>
            <span style={{ fontSize:9, color:`${C.cream}30`, letterSpacing:'.1em', textTransform:'uppercase', fontWeight:700 }}>אין תמונה</span>
          </div>
        )}
        {/* SOLD / RENTED stamp */}
        {(prop.status === 'נמכר' || prop.status === 'הושכר') && (
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:4, pointerEvents:'none', background:'rgba(0,0,0,.15)' }}>
            <img src={prop.status === 'נמכר' ? '/SOLD.png' : '/Rented.png'} alt={prop.status}
              style={{ width:'72%', maxWidth:220, opacity:.9, transform:'rotate(-10deg)', filter:'drop-shadow(0 4px 18px rgba(0,0,0,.7))' }}/>
          </div>
        )}
        {/* Top-right badges */}
        <div style={{ position:'absolute', top:10, right:10, display:'flex', flexDirection:'column', gap:4, zIndex:5 }}>
          <span style={{ background:'rgba(9,9,15,.85)', backdropFilter:'blur(8px)', color:sc, border:`1px solid ${sc}35`, borderRadius:6, padding:'4px 10px', fontSize:9, fontWeight:800, letterSpacing:'.06em', textTransform:'uppercase' }}>{prop.status}</span>
          {prop.exclusive && <span style={{ background:'rgba(9,9,15,.85)', backdropFilter:'blur(8px)', color:C.green, border:`1px solid ${C.green}35`, borderRadius:6, padding:'4px 10px', fontSize:9, fontWeight:800 }}>✦ בלעדי</span>}
        </div>
        {/* Category badge — bottom left over scrim */}
        <div style={{ position:'absolute', bottom:12, left:10, display:'flex', gap:5, zIndex:3 }}>
          <span style={{ background:C.purple, color:'#fff', borderRadius:5, padding:'4px 10px', fontSize:10, fontWeight:700, letterSpacing:'.03em', backdropFilter:'blur(6px)' }}>{cat.label}</span>
          {prop.type && <span style={{ background:'rgba(0,0,0,.62)', backdropFilter:'blur(8px)', color:'rgba(255,255,255,.88)', borderRadius:5, padding:'4px 10px', fontSize:10, fontWeight:600 }}>{prop.type}</span>}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="prop-card-body">

        {/* Title */}
        <h3 style={{ fontSize:17, fontWeight:800, color:C.cream, lineHeight:1.3, marginBottom:5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{prop.title || '—'}</h3>

        {/* Location */}
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:`${C.cream}55`, marginBottom:10 }}>
          <FaMapMarkerAlt size={9} style={{ color:C.purple, flexShrink:0 }}/>
          {[prop.location, prop.neighborhood].filter(Boolean).join(' · ') || '—'}
        </div>

        {/* Key specs as compact chips */}
        {specs.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:'3px 8px', marginBottom:12, paddingTop:8, borderTop:`1px solid rgba(132,144,216,.08)` }}>
            {specs.slice(0,4).map((s,i) => (
              <span key={i} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:`${C.cream}99`, background:'rgba(132,144,216,.06)', borderRadius:4, padding:'3px 8px' }}>
                <s.Icon size={8} style={{ color:C.purple, flexShrink:0 }}/> {s.v}
              </span>
            ))}
          </div>
        )}

        {/* Price row + CTA */}
        <div style={{ marginTop:'auto', paddingTop:12, borderTop:`1px solid rgba(132,144,216,.08)`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div>
            <div className="prop-card-price" style={{ color:C.cream }}>{fmt(prop.price)}</div>
            {prop.priceNegotiable && <div style={{ fontSize:9, color:C.green, fontWeight:700, marginTop:2, letterSpacing:'.04em' }}>✓ מחיר גמיש</div>}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onSelect(prop) }}
            className="prop-card-cta"
            style={{ background: hovered ? C.purple : `${C.purple}16`, borderColor: hovered ? C.purple : `${C.purple}44`, color: hovered ? '#fff' : C.purple }}>
            לפרטים <FaChevronLeft size={9}/>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CURTAIN THEME TOGGLE ─────────────────────────────────────────────────────
function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="1"  x2="12" y2="3"/>   <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"/>  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1"  y1="12" x2="3"  y2="12"/>  <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/> <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
    </svg>
  )
}

const EASING = 'cubic-bezier(0.76, 0, 0.24, 1)'

function CurtainThemeToggle() {
  const { C, isDark, toggleTheme } = useTheme()
  const [phase,   setPhase]   = useState('idle')
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const curtainColor = useRef('')
  const DURATION = 600

  const toggle = useCallback(() => {
    if (phase !== 'idle') return
    curtainColor.current = isDark ? LIGHT_C.bg : DARK_C.bg
    setPhase('falling')
    setTimeout(() => {
      toggleTheme()
      setPhase('rising')
      setTimeout(() => setPhase('idle'), DURATION + 60)
    }, DURATION)
  }, [phase, isDark, toggleTheme])

  const scale = pressed ? 0.90 : hovered ? 1.06 : 1
  const btnBg  = hovered
    ? (isDark ? 'rgba(232,228,216,.18)' : 'rgba(9,9,15,.12)')
    : 'transparent'
  const btnClr = isDark ? 'rgba(232,228,216,.55)' : 'rgba(20,20,32,.45)'
  const btnHovClr = isDark ? 'rgba(232,228,216,.9)' : 'rgba(20,20,32,.85)'
  const btnBorder = isDark ? 'rgba(232,228,216,.14)' : 'rgba(20,20,32,.14)'
  const btnBorderHov = isDark ? 'rgba(232,228,216,.3)' : 'rgba(20,20,32,.28)'

  return (
    <>
      <div aria-hidden="true" style={{
        position:'fixed', inset:0,
        background: curtainColor.current,
        transformOrigin: 'top',
        transform: phase === 'falling' ? 'scaleY(1)' : 'scaleY(0)',
        transition: phase !== 'idle' ? `transform ${DURATION}ms ${EASING}` : 'none',
        zIndex: 9997, pointerEvents:'none',
      }}/>
      <button
        onClick={toggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false) }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        aria-label={isDark ? 'עבור למצב בהיר' : 'עבור למצב כהה'}
        title={isDark ? 'מצב בהיר' : 'מצב כהה'}
        style={{
          position:'fixed', bottom:22, left:22,
          width:36, height:36, borderRadius:'50%',
          border:`1.5px solid ${hovered ? btnBorderHov : btnBorder}`,
          cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          background: btnBg,
          color: hovered ? btnHovClr : btnClr,
          boxShadow: hovered
            ? (isDark ? '0 4px 16px rgba(232,228,216,.1)' : '0 4px 16px rgba(9,9,15,.1)')
            : 'none',
          zIndex: 9999,
          opacity: hovered ? 1 : 0.6,
          transform: `scale(${scale})`,
          transition: 'transform .18s cubic-bezier(.16,1,.3,1), box-shadow .25s, background .25s, color .25s, opacity .25s, border-color .25s',
        }}>
        {isDark ? <SunIcon/> : <MoonIcon/>}
      </button>
    </>
  )
}

// ─── NAV AURORA ───────────────────────────────────────────────────────────────
function NavAurora({ active }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let time = 0, rafId
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    const colors = [
      { r:132, g:144, b:216 },
      { r:130, g:246, b:127 },
      { r:110, g:80,  b:230 },
      { r:60,  g:200, b:160 },
    ]
    const orbs = Array.from({ length:8 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 160 + 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
    }))
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      time++
      orbs.forEach(orb => {
        orb.x += orb.vx + Math.sin(time * 0.001) * 0.6
        orb.y += orb.vy + Math.cos(time * 0.001) * 0.6
        if (orb.x < -orb.radius) orb.x = canvas.width + orb.radius
        if (orb.x > canvas.width + orb.radius) orb.x = -orb.radius
        if (orb.y < -orb.radius) orb.y = canvas.height + orb.radius
        if (orb.y > canvas.height + orb.radius) orb.y = -orb.radius
        const g = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius)
        g.addColorStop(0, `rgba(${orb.color.r},${orb.color.g},${orb.color.b},0.42)`)
        g.addColorStop(0.4, `rgba(${orb.color.r},${orb.color.g},${orb.color.b},0.18)`)
        g.addColorStop(1, `rgba(${orb.color.r},${orb.color.g},${orb.color.b},0)`)
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2)
        ctx.fill()
      })
      rafId = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(rafId)
  }, [active])
  return <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0 }}/>
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [isDark,       setIsDark]       = useState(true)
  const C      = isDark ? DARK_C : LIGHT_C
  const GLOBAL = useMemo(() => makeGlobal(C, isDark), [isDark])
  const toggleTheme = useCallback(() => setIsDark(d => !d), [])

  const [isMobile,     setIsMobile]     = useState(() => window.innerWidth < 768)
  const carouselRef = useRef(null)
  const [carouselIdx,  setCarouselIdx]  = useState(0)

  const [properties,   setProperties]   = useState([])
  const [filterCat,    setFilterCat]    = useState('all')
  const [filterType,   setFilterType]   = useState('')
  const [propPage,     setPropPage]     = useState(0)
  const [filterRegion, setFilterRegion] = useState('')
  const [selectedProp, setSelectedProp] = useState(null)
  const [showAdmin,    setShowAdmin]    = useState(false)
  const [showWizard,   setShowWizard]   = useState(false)
  const [wizardKey,    setWizardKey]    = useState(0)
  const [wizardEditData, setWizardEditData] = useState(null)
  const [wizardEditId,   setWizardEditId]   = useState(null)
  const [adminAuth,    setAdminAuth]    = useState(() => sessionStorage.getItem('afik_admin_session') === '1')
  const [showPw,       setShowPw]       = useState(false)
  const [contactProp,  setContactProp]  = useState(null)
  const [showContact,  setShowContact]  = useState(false)
  const [showCalc,     setShowCalc]     = useState(false)
  const [showPrivacy,  setShowPrivacy]  = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const [activeNav,    setActiveNav]    = useState('home')
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const [lang,         setLang]         = useState('he')
  const [stats,        setStats]        = useState(DEFAULT_STATS)
  const [sharon,       setSharon]       = useState(DEFAULT_SHARON)
  const [govmapToken,  setGovmapToken]  = useState(() => localStorage.getItem('govmap_token') || '')
  const [logoNavSize,  setLogoNavSizeRaw] = useState(() => Number(localStorage.getItem('logoNavSize')) || 70)
  const setLogoNavSize = (v) => { const n = Math.max(20, Math.min(200, Number(v))); localStorage.setItem('logoNavSize', n); setLogoNavSizeRaw(n) }
  // UI/UX Pro Max: parallax scroll
  const [scrollY,      setScrollY]      = useState(0)

  const statsRef      = useRef(null)
  const loaded        = useRef(false)
  const propsLoaded   = useRef(false)  // guard: don't bulk-sync before initial load
  const typewriterTexts = lang === 'en' ? TYPEWRITER_EN : TYPEWRITER_HE
  const typewriter = useTypewriter(typewriterTexts)

  // ── Team token check ──
  useTeamToken()

  // ── Analytics session init + CAPI PageView ──
  useEffect(() => {
    const sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    trackEvent('session_start', {
      sid,
      ref: document.referrer,
      source: _getSource(document.referrer),
      device: _getDevice(),
      screen: `${window.innerWidth}x${window.innerHeight}`,
    })
    // Server-side PageView for CAPI (browser Pixel PageView already fires via index.html)
    sendCAPI('PageView')
    const onUnload = () => trackEvent('session_end', { sid })
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [])

  // ── Mobile breakpoint listener ──
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Load stats/sharon/properties on startup ──
  useEffect(() => {
    // 1. Fast initial state from localStorage (avoids flash of default numbers)
    try {
      const raw = localStorage.getItem('afik_data')
      if (raw) {
        const d = JSON.parse(raw)
        if (d.stats)  setStats(d.stats)
        if (d.sharon) setSharon(d.sharon)
      }
    } catch {}
    loaded.current = true

    // 2. Fetch latest stats + govmap token from API
    {
      const base = API_BASE || ''
      fetch(`${base}/api/stats`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          if (data.stats?.length)  setStats(data.stats)
          if (data.sharon?.length) setSharon(data.sharon)
          if (data.govmapToken)    { setGovmapToken(data.govmapToken); localStorage.setItem('govmap_token', data.govmapToken) }
        })
        .catch(() => {})
      // Also load admin cloud settings (WA, CRM webhook, map defaults)
      fetch(`${base}/api/settings`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(cfg => { _cloudSettings = cfg })
        .catch(() => {})
    }

    // 3. Fetch properties — show localStorage cache IMMEDIATELY, then silently update from API
    {
      // Paint cached properties on frame-0 — zero network latency
      try {
        const d = JSON.parse(localStorage.getItem('afik_data') || '{}')
        if (d.properties?.length) { setProperties(d.properties); propsLoaded.current = true }
      } catch {}

      const isAdminSession = sessionStorage.getItem('afik_admin_session') === '1'
      const headers = isAdminSession ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}
      const base = API_BASE || ''
      fetch(`${base}/api/properties`, { headers })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setProperties(prev => {
              if (!prev.length) return data  // no local cache: trust server
              if (data.length < prev.length) return prev  // server lost data (restart): keep local
              // Server has same/more: server list is authoritative for IDs, merge per-property
              const localById = new Map(prev.map(p => [String(p.id), p]))
              return data.map(serverProp => {
                const localProp = localById.get(String(serverProp.id))
                if (!localProp) return serverProp
                const serverNewer = (serverProp.updatedAt || 0) >= (localProp.updatedAt || 0)
                return serverNewer ? { ...localProp, ...serverProp } : localProp
              })
            })
          }
          propsLoaded.current = true
        })
        .catch(() => { propsLoaded.current = true })
    }
  }, [])

  // ── Save stats/sharon/properties to localStorage as offline backup ──────────
  // Guard with propsLoaded (not loaded) to avoid wiping cached properties
  // before the async initial fetch resolves. Also never cache an empty list
  // (protects against a bug that wipes properties before server fetch resolves).
  useEffect(() => {
    if (!propsLoaded.current) return
    if (properties.length === 0) return  // never overwrite a good cache with nothing
    try { localStorage.setItem('afik_data', JSON.stringify({ stats, sharon, properties })) } catch {}
  }, [stats, sharon, properties])

  // Individual saves now go via PUT /api/properties/:id — no bulk background sync needed.

  // ── Sync stats/sharon to Supabase when admin changes them (debounced 2 s) ──
  useEffect(() => {
    if (!adminAuth || !loaded.current) return
    const base = API_BASE || ''
    const timer = setTimeout(() => {
      fetch(`${base}/api/stats`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
        body:    JSON.stringify({ stats, sharon }),
      }).catch(() => {})
    }, 2000)
    return () => clearTimeout(timer)
  }, [stats, sharon])

  // ── Re-fetch all properties (including unpublished) when admin logs in ──────
  useEffect(() => {
    if (!adminAuth) return
    const base = API_BASE || ''
    fetch(`${base}/api/properties`, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setProperties(prev => {
            if (!prev.length) return data
            if (data.length < prev.length) return prev
            const localById = new Map(prev.map(p => [String(p.id), p]))
            return data.map(serverProp => {
              const localProp = localById.get(String(serverProp.id))
              if (!localProp) return serverProp
              const serverNewer = (serverProp.updatedAt || 0) >= (localProp.updatedAt || 0)
              return serverNewer ? { ...localProp, ...serverProp } : localProp
            })
          })
        }
        if (Array.isArray(data)) propsLoaded.current = true
      })
      .catch(() => {})
  }, [adminAuth])

  // ── Auto-refresh properties every 60s ─────────────────────────────────────
  useEffect(() => {
    if (!API_BASE) return
    const base = API_BASE
    const refresh = () => {
      const headers = adminAuth ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}
      fetch(`${base}/api/properties`, { headers })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => { if (Array.isArray(data) && data.length > 0) setProperties(data) })
        .catch(() => {})
    }
    const id = setInterval(refresh, 60000)
    return () => clearInterval(id)
  }, [adminAuth]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open wizard from admin panel banner ──
  useEffect(() => {
    const h = () => { try { localStorage.removeItem('afik_wizard_draft') } catch {}; setWizardKey(k => k+1); setShowWizard(true) }
    document.addEventListener('afik:openWizard', h)
    return () => document.removeEventListener('afik:openWizard', h)
  }, [])

  // ── Language direction switch ──
  useEffect(() => {
    const isRtl = lang === 'he'
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
    document.documentElement.lang = isRtl ? 'he' : 'en'
    document.body.style.direction = isRtl ? 'rtl' : 'ltr'
    document.body.style.textAlign = isRtl ? 'right' : 'left'
  }, [lang])

  // ── UI/UX Pro Max: parallax scroll listener ──
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive:true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ── Stats intersection ──
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true) }, { threshold:0.3 })
    if (statsRef.current) obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  // ── Active nav tracking ──
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActiveNav(e.target.id) }),
      { threshold:0.25, rootMargin:'-68px 0px 0px 0px' }
    )
    NAV_LINKS.forEach(({ id }) => { const el = document.getElementById(id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [])

  // ── Hash-based URL routing — scroll to section on load / back-forward ──
  useEffect(() => {
    const NAV_IDS = NAV_LINKS.map(n => n.id)
    const scrollHash = () => {
      const hash = window.location.hash.slice(1)
      if (hash && NAV_IDS.includes(hash)) {
        setTimeout(() => {
          const el = document.getElementById(hash)
          if (el) el.scrollIntoView({ behavior:'smooth', block:'start' })
        }, 350)
      }
    }
    scrollHash()
    window.addEventListener('popstate', scrollHash)
    return () => window.removeEventListener('popstate', scrollHash)
  }, [])

  const filtered = properties.filter(p =>
    p.published !== false &&
    (filterCat === 'all' || p.category === filterCat) &&
    (!filterType   || p.type   === filterType)
  )
  const scrollTo    = id => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior:'smooth', block:'start' })
      window.history.pushState(null, '', `#${id}`)
    }
    setMobileOpen(false)
  }
  const openContact = (p=null) => { setContactProp(p); setShowContact(true) }
  const openProperty = (p) => {
    setSelectedProp(p)
    if (p) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      trackEvent('property_view', { title: p.title, id: p.id, category: p.category, location: p.location })
    }
  }

  // ── Standalone dashboard at /dashboard ──────────────────────────────────────
  const isDashboard = window.location.pathname.replace(/\/$/, '') === '/dashboard'
  if (isDashboard) {
    return (
      <ThemeCtx.Provider value={{ C, isDark, toggleTheme, lang, setLang, logoNavSize, setLogoNavSize }}>
        <>
          <style>{GLOBAL}</style>
          {!adminAuth && (
            <PasswordPrompt
              onSuccess={() => {
                sessionStorage.setItem('afik_admin_session', '1')
                setAdminAuth(true)
              }}
              onClose={() => { window.location.href = '/' }}
            />
          )}
          {adminAuth && (
            <AdminPanel
              standalone={true}
              properties={properties}
              setProperties={setProperties}
              stats={stats}
              setStats={setStats}
              sharon={sharon}
              setSharon={setSharon}
              govmapToken={govmapToken}
              setGovmapToken={setGovmapToken}
              onClose={() => {
                sessionStorage.removeItem('afik_admin_session')
                window.location.href = '/'
              }}
              onEditInWizard={p => {
                setWizardEditData(propertyToWizardData(p))
                setWizardEditId(p.id)
                setShowWizard(true)
              }}
            />
          )}
        </>
      </ThemeCtx.Provider>
    )
  }

  return (
    <ThemeCtx.Provider value={{ C, isDark, toggleTheme, lang, setLang }}>
    <>
      <style>{GLOBAL}</style>

      {/* UI/UX Pro Max: Ambient Backdrop */}
      <AmbientBackdrop/>

      {/* ── NAV ─────────────────────────────────────── */}
      <nav style={{
        position:'fixed', top:0, right:0, left:0, height:82, zIndex:100,
        background: isDark
          ? 'linear-gradient(90deg, rgba(6,5,14,.98) 0%, rgba(10,8,22,.97) 50%, rgba(6,5,14,.98) 100%)'
          : 'linear-gradient(90deg, rgba(245,241,233,.98) 0%, rgba(253,252,248,.97) 50%, rgba(245,241,233,.98) 100%)',
        backdropFilter:'blur(32px) saturate(200%)',
        borderBottom:`1px solid ${C.purple}18`,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'0 32px',
        direction:'rtl',
        boxShadow: isDark
          ? `0 1px 0 ${C.purple}0C, 0 8px 40px rgba(0,0,0,.45)`
          : `0 1px 0 rgba(90,104,197,.1), 0 8px 32px rgba(0,0,0,.1)`,
        transition:'background .35s, box-shadow .35s',
      }}>

        {/* ── RIGHT: Animated hamburger ── */}
        <button
          className={`hamburger-btn${mobileOpen?' open':''}`}
          onClick={() => setMobileOpen(o=>!o)}
          aria-label="תפריט"
        >
          <MenuToggleIcon open={mobileOpen} size={59} color="currentColor" duration={480}/>
        </button>

        {/* ── CENTER: Logo (desktop only) ── */}
        <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none' }} className="desktop-logo-nav">
          <Logo size={logoNavSize}/>
        </div>

        {/* ── LEFT edge: Social icons + tools + lang ── */}
        <div style={{ display:'flex', alignItems:'center', gap:8, direction:'ltr' }}>

          {/* Social neon glow icons */}
          <a href="mailto:afik.hanahal@gmail.com"
            className="social-btn email" title="afik.hanahal@gmail.com">
            <FaEnvelope size={18}/>
          </a>
          <a href="https://www.facebook.com/profile.php?id=61573376818745"
            target="_blank" rel="noopener noreferrer"
            className="social-btn facebook" title="פייסבוק">
            <FaFacebookF size={18}/>
          </a>
          <a href="https://www.instagram.com/afik.hanahal/"
            target="_blank" rel="noopener noreferrer"
            className="social-btn instagram" title="אינסטגרם">
            <FaInstagram size={18}/>
          </a>

          {/* Divider */}
          <div style={{ width:1, height:30, background:`${C.purple}28`, margin:'0 4px', flexShrink:0 }}/>

          {/* Tool icons */}
          <button onClick={() => setShowCalc(true)} className="nav-icon-btn" title={TR[lang]?.calcNav || 'מחשבון'}>
            <FaCalculator size={17}/>
          </button>
          <a href="tel:0559811814" className="nav-icon-btn" title="055-981-1814">
            <FaPhone size={17}/>
          </a>

          {/* Lang toggle */}
          <LangSwitch compact />
        </div>
      </nav>

      {/* ── SIDE NAV PANEL ──────────────────────────── */}
      {mobileOpen && (
        <>
          <div className="nav-overlay" onClick={() => setMobileOpen(false)}/>
          <div className="nav-panel">
            <NavAurora active={mobileOpen}/>
            <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>
              <div className="nav-panel-header">
                <Logo size={44}/>
                <button className="nav-panel-close" onClick={() => setMobileOpen(false)}>✕</button>
              </div>
              {/* Calculator CTA — above the links so it's always visible */}
              <div style={{ padding:'12px 16px 4px' }}>
                <button
                  onClick={() => { setShowCalc(true); setMobileOpen(false) }}
                  style={{
                    width:'100%', padding:'15px 18px',
                    background:`linear-gradient(135deg,${C.purple}30,${C.purple}16)`,
                    border:`1.5px solid ${C.purple}88`,
                    borderRadius:14, color:C.purple,
                    fontFamily:'inherit', fontWeight:800, fontSize:16,
                    cursor:'pointer', transition:'all .22s',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                    letterSpacing:'.02em',
                    boxShadow:`0 0 22px ${C.purple}22`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background=C.purple; e.currentTarget.style.color='#fff'; e.currentTarget.style.boxShadow=`0 0 32px ${C.purple}55` }}
                  onMouseLeave={e => { e.currentTarget.style.background=`linear-gradient(135deg,${C.purple}30,${C.purple}16)`; e.currentTarget.style.color=C.purple; e.currentTarget.style.boxShadow=`0 0 22px ${C.purple}22` }}
                >
                  <FaCalculator size={15}/> מחשבון נדל״ן
                </button>
              </div>

              <div className="nav-panel-links">
                {NAV_LINKS.map(({ id }) => (
                  <button key={id}
                    className={`nav-panel-item${activeNav===id?' active':''}`}
                    onClick={() => scrollTo(id)}>
                    {TR[lang]?.nav?.[id] || id}
                    <span className="nav-item-bar"/>
                  </button>
                ))}
              </div>
              <a href="tel:0559811814" className="nav-panel-phone" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}><FaPhone size={12}/> 055-981-1814</a>
            </div>
          </div>
        </>
      )}

      {/* ── HERO (with Parallax blobs) ────────────────── */}
      <section id="home" role="main" tabIndex={-1} aria-label="תוכן ראשי" style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'90px 24px 72px', scrollMarginTop:80, position:'relative', overflow:'hidden', textAlign:'center', zIndex:1 }}>

        {/* UI/UX Pro Max: Parallax blobs — outer div moves with scroll, inner animates */}
        <div style={{ position:'absolute', top:'20%', right:'-8%', pointerEvents:'none', transform:`translateY(${scrollY * 0.22}px)`, willChange:'transform' }}>
          <div style={{ width:620, height:620, background:`radial-gradient(circle,${C.purple}1A,transparent 70%)`, animation:'blob1 9s ease infinite', willChange:'transform' }}/>
        </div>
        <div style={{ position:'absolute', bottom:'10%', left:'-8%', pointerEvents:'none', transform:`translateY(${scrollY * -0.18}px)`, willChange:'transform' }}>
          <div style={{ width:520, height:520, background:`radial-gradient(circle,${C.green}14,transparent 70%)`, animation:'blob2 11s ease infinite', willChange:'transform' }}/>
        </div>
        <div style={{ position:'absolute', top:'60%', left:'40%', pointerEvents:'none', transform:`translateY(${scrollY * 0.12}px)`, willChange:'transform' }}>
          <div style={{ width:420, height:420, background:`radial-gradient(circle,${C.purple}09,transparent 70%)`, animation:'blob3 14s ease infinite', willChange:'transform' }}/>
        </div>

        {/* Grid pattern */}
        <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:.04, pointerEvents:'none' }}>
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke={C.cream} strokeWidth="1"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>

        <div style={{ maxWidth:860, margin:'0 auto', position:'relative', zIndex:1 }}>

          {/* Tagline badge — hover-border-gradient (SectionBadge) */}
          <div className="fade-up-1" style={{ marginBottom:24, display:'flex', justifyContent:'center' }}>
            <SectionBadge color={C.purple} duration={1.6}>
              {TR[lang]?.heroBadge}
            </SectionBadge>
          </div>

          <h1 className="hero-title">{TR[lang]?.heroH1line1}<br/>{TR[lang]?.heroH1line2}</h1>
          <div className="fade-up-2" style={{ fontSize:'clamp(18px,3vw,26px)', fontWeight:600, color:C.green, marginBottom:20, minHeight:40, letterSpacing:'.3px' }}>
            {typewriter}<span style={{ borderRight:`2px solid ${C.green}`, marginRight:2, animation:'pulse 1s ease infinite' }}>&nbsp;</span>
          </div>
          <p className="fade-up-3" style={{ fontSize:'clamp(14px,2vw,18px)', color:C.cream+'BB', lineHeight:1.9, marginBottom:40, maxWidth:660, margin:'0 auto 40px' }}>
            {TR[lang]?.heroDesc}
          </p>
          <div className="fade-up-4 hero-cta-group" style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap', marginBottom:48 }}>
            <button className="primary-btn" onClick={() => scrollTo('properties')}>{TR[lang]?.heroCTA1}</button>
            <button className="outline-btn" onClick={() => openContact()}>{TR[lang]?.heroCTA2}</button>
            <button className="hero-calc-btn" onClick={() => setShowCalc(true)} style={{ display:'flex', alignItems:'center', gap:8, padding:'14px 24px', background:'transparent', border:`1.5px solid ${C.green}66`, borderRadius:0, color:C.green, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:'inherit', letterSpacing:'.04em', transition:'all .2s' }}
              onMouseEnter={e => { e.currentTarget.style.background=C.green+'18'; e.currentTarget.style.borderColor=C.green }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor=C.green+'66' }}>
              <FaCalculator size={13}/> {TR[lang]?.heroCTA3}
            </button>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', marginTop:16, paddingBottom:80 }}>
            {(TR[lang]?.heroTags || []).map(tag => (
              <span key={tag} style={{ background:'rgba(255,255,255,.05)', border:`1px solid ${C.purple}33`, borderRadius:20, padding:'6px 14px', fontSize:12, color:C.cream+'AA', backdropFilter:'blur(8px)', transition:'all .2s', cursor:'default' }}
                onMouseEnter={e => { e.currentTarget.style.background=`${C.purple}18`; e.currentTarget.style.borderColor=`${C.purple}77`; e.currentTarget.style.color=C.cream; e.currentTarget.style.transform='translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.05)'; e.currentTarget.style.borderColor=`${C.purple}33`; e.currentTarget.style.color=C.cream+'AA'; e.currentTarget.style.transform='' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div style={{ position:'absolute', bottom:32, left:'50%', animation:'scrollBounce 2s ease infinite' }}>
          <div style={{ width:28, height:46, border:`2px solid ${C.purple}44`, borderRadius:14, display:'flex', justifyContent:'center', padding:'8px 0' }}>
            <div style={{ width:4, height:8, background:C.purple, borderRadius:2, animation:'float 2s ease infinite' }}/>
          </div>
        </div>
      </section>

      {/* ── STATS ───────────────────────────────────── */}
      <div ref={statsRef} style={{ background:`linear-gradient(180deg,${C.bg} 0%,${C.card} 50%,${C.bg} 100%)`, borderTop:`1px solid ${C.purple}20`, borderBottom:`1px solid ${C.purple}20`, padding:'12px 24px', position:'relative', zIndex:1 }}>
        <div style={{ maxWidth:960, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))' }}>
          {stats.map(s => (
            <div key={s.key} style={{ textAlign:'center', padding:'32px 16px', cursor:'default', transition:'transform .25s cubic-bezier(.16,1,.3,1)', borderRadius:12 }}
              onMouseEnter={e => { e.currentTarget.style.transform='scale(1.08)'; e.currentTarget.style.background=`${C.purple}0A` }}
              onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.background='' }}>
              <TextCounter to={s.value} suffix={s.suffix} size={44} start={statsVisible} duration={2400} lang={lang}/>
              <div style={{ fontSize:14, color:C.cream+'AA', marginTop:12, fontWeight:500, letterSpacing:'.3px' }}>{lang === 'en' && s.en_label ? s.en_label : s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CEO ─────────────────────────────────────── */}
      <CEOSection/>

      {/* ── STORY ───────────────────────────────────── */}
      <StorySection onContact={openContact} sharonData={sharon}/>

      {/* ── PROCESS ─────────────────────────────────── */}
      <ProcessSection/>

      {/* ── SERVICES ────────────────────────────────── */}
      <ServicesSection onContact={openContact}/>

      {/* ── PROPERTIES ──────────────────────────────── */}
      <section id="properties" style={{ padding:'48px 24px', scrollMarginTop:80, position:'relative', zIndex:1 }}>
        {/* ambient blobs */}
        <div style={{ position:'absolute', top:'10%', left:'-5%', width:500, height:500, background:`radial-gradient(circle,${C.purple}0D,transparent 70%)`, pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:'10%', right:'-5%', width:440, height:440, background:`radial-gradient(circle,${C.green}0A,transparent 70%)`, pointerEvents:'none' }}/>

        <div style={{ maxWidth:1280, margin:'0 auto', position:'relative', zIndex:1 }}>

          {/* Header */}
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <SectionBadge color={C.purple}>{TR[lang]?.propertiesTitle}</SectionBadge>
            <h2 style={{ fontSize:'clamp(28px,4vw,52px)', fontWeight:900, color:C.cream, marginBottom:14 }}>{TR[lang]?.propertiesH2}</h2>
            <p style={{ fontSize:15, color:`${C.cream}77`, maxWidth:520, margin:'0 auto', lineHeight:1.8 }}>
              {TR[lang]?.propertiesDesc}
            </p>
            {properties.length > 0 && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:16, background:`${C.purple}14`, border:`1px solid ${C.purple}30`, borderRadius:20, padding:'6px 16px' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:C.green, display:'inline-block', boxShadow:`0 0 8px ${C.green}` }}/>
                <span style={{ fontSize:13, color:`${C.cream}BB`, fontWeight:600 }}>
                  {properties.filter(p=>p.published).length} נכסים זמינים
                </span>
              </div>
            )}
          </div>

          {/* Category tabs */}
          <div style={{ display:'flex', gap:0, marginBottom:36, borderBottom:`1px solid rgba(132,144,216,.18)`, overflowX:'auto', WebkitOverflowScrolling:'touch', scrollbarWidth:'none', msOverflowStyle:'none', justifyContent: isMobile ? 'flex-start' : 'center' }}>
            {[{ id:'all', label:TR[lang]?.allProperties, Icon:null }, ...(CATEGORIES_DATA[lang] || CATEGORIES_DATA.he)].map(cat => {
              const count = cat.id === 'all' ? properties.length : properties.filter(p => p.category === cat.id).length
              const active = filterCat === cat.id
              return (
                <button key={cat.id} onClick={() => { setFilterCat(cat.id); setFilterType(''); setPropPage(0); setCarouselIdx(0) }}
                  style={{ padding: isMobile ? '12px 16px' : '14px 28px', border:'none', borderBottom:`2px solid ${active ? C.purple : 'transparent'}`, background:'transparent', color:active ? C.purple : `${C.cream}55`, fontFamily:'inherit', cursor:'pointer', fontSize: isMobile ? 12 : 13, fontWeight:active?700:500, whiteSpace:'nowrap', transition:'all .2s', display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
                  {cat.Icon ? <cat.Icon size={12}/> : <span style={{ fontSize:12, opacity:.6 }}>≡</span>} {cat.label}
                  {count > 0 && <span style={{ background:active?`${C.purple}28`:'rgba(255,255,255,.07)', color:active?C.purple:`${C.cream}55`, borderRadius:10, padding:'2px 7px', fontSize:10, fontWeight:700, minWidth:18, textAlign:'center' }}>{count}</span>}
                </button>
              )
            })}
          </div>

          {/* Filters row */}
          {properties.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:32, alignItems:'center' }}>
              {/* Type filter dropdown — shown when a category is selected */}
              {filterCat !== 'all' && (() => {
                const catTypes = (CATEGORIES_DATA[lang] || CATEGORIES_DATA.he).find(c => c.id === filterCat)?.types || []
                if (!catTypes.length) return null
                return (
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:11, color:`${C.cream}50`, fontWeight:600, letterSpacing:'.06em', textTransform:'uppercase' }}>{TR[lang]?.typeFilter}</span>
                    <div style={{ position:'relative' }}>
                      <select value={filterType} onChange={e => { setFilterType(e.target.value); setPropPage(0) }}
                        style={{ padding:'8px 36px 8px 16px', background:C.card, border:`1.5px solid ${filterType ? C.purple : 'rgba(132,144,216,.3)'}`, borderRadius:8, color:filterType ? C.purple : `${C.cream}88`, fontSize:12, fontFamily:'inherit', cursor:'pointer', outline:'none', appearance:'none', WebkitAppearance:'none', direction: lang==='he' ? 'rtl' : 'ltr', fontWeight:filterType?700:400, transition:'border-color .2s' }}>
                        <option value="">{TR[lang]?.allTypes}</option>
                        {catTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <FaChevronLeft size={9} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%) rotate(-90deg)', color:`${C.cream}55`, pointerEvents:'none' }}/>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Grid / Carousel / Empty state */}
          {properties.length === 0 ? (
            <div className="placeholder-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,340px))', gap:24, marginBottom:48, justifyContent:'center' }}>
              {/* Decorative placeholder cards — hover for impressive effect */}
              {(CATEGORIES_DATA[lang] || CATEGORIES_DATA.he).map((cat, ci) => (
                <div key={cat.id}
                  style={{ background:C.card, border:`1px solid rgba(132,144,216,.10)`, borderRadius:12, overflow:'hidden', opacity: 0.55 + ci*0.12, transition:'all .38s cubic-bezier(.16,1,.3,1)', cursor:'pointer' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity='1'
                    e.currentTarget.style.transform='translateY(-8px)'
                    e.currentTarget.style.borderColor=`rgba(132,144,216,.45)`
                    e.currentTarget.style.boxShadow=`0 28px 60px rgba(0,0,0,.35), 0 0 50px ${C.purple}22`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity=String(0.55 + ci*0.12)
                    e.currentTarget.style.transform=''
                    e.currentTarget.style.borderColor='rgba(132,144,216,.10)'
                    e.currentTarget.style.boxShadow=''
                  }}
                  onClick={() => openContact()}>
                  <div style={{ height:200, background:`linear-gradient(135deg, ${C.purple}12 0%, ${C.green}0C 100%)`, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, borderBottom:`1px solid rgba(132,144,216,.08)`, position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', inset:0, background:`radial-gradient(circle at 50% 60%, ${C.purple}18, transparent 70%)`, pointerEvents:'none' }}/>
                    <cat.Icon size={48} style={{ color:C.purple, opacity:.4, position:'relative', zIndex:1 }}/>
                    <span style={{ fontSize:11, color:`${C.cream}45`, letterSpacing:'.12em', textTransform:'uppercase', fontWeight:700, position:'relative', zIndex:1 }}>{cat.label}</span>
                  </div>
                  <div style={{ padding:'18px 20px' }}>
                    <div style={{ height:14, background:'rgba(255,255,255,.06)', borderRadius:3, marginBottom:10, width:'70%' }}/>
                    <div style={{ height:10, background:'rgba(255,255,255,.04)', borderRadius:3, marginBottom:6, width:'50%' }}/>
                    <div style={{ height:10, background:'rgba(255,255,255,.03)', borderRadius:3, width:'60%' }}/>
                    <div style={{ display:'flex', gap:6, marginTop:16 }}>
                      {[40,55,35].map((w,i) => <div key={i} style={{ height:22, borderRadius:3, background:'rgba(255,255,255,.04)', width:`${w}%` }}/>)}
                    </div>
                    <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid rgba(132,144,216,.07)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ height:18, background:'rgba(255,255,255,.06)', borderRadius:3, width:'40%' }}/>
                      <div style={{ height:32, background:`${C.purple}20`, borderRadius:4, width:'28%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <FaPhone size={10} style={{ color:C.purple, opacity:.6 }}/>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {filtered.length > 0 ? (
                isMobile ? (
                  /* ── Mobile swipe carousel ── */
                  <>
                    {/* Nav arrows row — left=prev(right in RTL) right=next(left in RTL) */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, paddingInline:4 }}>
                      {/* ‹ LEFT arrow → navigate LEFT → next card in RTL (idx+1) */}
                      <button
                        onClick={() => {
                          const newIdx = (carouselIdx + 1) % filtered.length
                          setCarouselIdx(newIdx)
                          if (carouselRef.current) {
                            const cardW = carouselRef.current.scrollWidth / filtered.length
                            carouselRef.current.scrollTo({ left: newIdx * cardW, behavior:'smooth' })
                          }
                        }}
                        style={{ width:40, height:40, borderRadius:'50%', border:`1.5px solid ${C.purple}66`, background:`${C.purple}14`, color:C.purple, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }}>
                        <FaChevronLeft size={12}/>
                      </button>
                      {/* › RIGHT arrow → navigate RIGHT → prev card in RTL (idx-1) */}
                      <button
                        onClick={() => {
                          const newIdx = (carouselIdx - 1 + filtered.length) % filtered.length
                          setCarouselIdx(newIdx)
                          if (carouselRef.current) {
                            const cardW = carouselRef.current.scrollWidth / filtered.length
                            carouselRef.current.scrollTo({ left: newIdx * cardW, behavior:'smooth' })
                          }
                        }}
                        style={{ width:40, height:40, borderRadius:'50%', border:`1.5px solid ${C.purple}66`, background:`${C.purple}14`, color:C.purple, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }}>
                        <FaChevronRight size={12}/>
                      </button>
                    </div>
                    <div className="prop-carousel" ref={carouselRef}
                      style={{ display:'flex', gap:16, overflowX:'auto', scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch', paddingBottom:20, paddingInlineStart:4, paddingInlineEnd:16, marginInlineStart:-4 }}
                      onScroll={e => {
                        const el = e.currentTarget
                        const cardW = el.scrollWidth / filtered.length
                        setCarouselIdx(Math.round(el.scrollLeft / cardW))
                      }}>
                      {filtered.map(p => (
                        <div key={p.id} style={{ flex:'0 0 88vw', maxWidth:360, scrollSnapAlign:'start' }}>
                          <PropertyCard prop={p} onContact={openContact} onSelect={openProperty}/>
                        </div>
                      ))}
                    </div>
                    {/* Compact page counter */}
                    {filtered.length > 1 && (
                      <div style={{ display:'flex', justifyContent:'center', marginTop:4, marginBottom:16 }}>
                        <span style={{ fontSize:11, color:`${C.cream}44`, fontWeight:600, letterSpacing:'.04em' }}>
                          {carouselIdx + 1} / {filtered.length}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  /* ── Desktop paginated grid ── */
                  (() => {
                    const PER_PAGE = 6
                    const totalPages = Math.ceil(filtered.length / PER_PAGE)
                    const safePage = Math.min(propPage, totalPages - 1)
                    const visible = filtered.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE)
                    return (
                      <>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:28, marginBottom:28 }}>
                          {visible.map(p => <PropertyCard key={p.id} prop={p} onContact={openContact} onSelect={openProperty}/>)}
                        </div>
                        {totalPages > 1 && (
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, marginBottom:48 }}>
                            <button
                              onClick={() => setPropPage(p => Math.max(0, p - 1))}
                              disabled={safePage === 0}
                              style={{ width:44, height:44, borderRadius:'50%', border:`1.5px solid ${safePage===0 ? C.purple+'22' : C.purple+'66'}`, background:safePage===0?'transparent':`${C.purple}14`, color:safePage===0?`${C.cream}30`:C.purple, cursor:safePage===0?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }}
                              onMouseEnter={e=>{ if(safePage>0){ e.currentTarget.style.background=C.purple; e.currentTarget.style.color='#fff' }}}
                              onMouseLeave={e=>{ e.currentTarget.style.background=safePage===0?'transparent':`${C.purple}14`; e.currentTarget.style.color=safePage===0?`${C.cream}30`:C.purple }}>
                              <FaChevronRight size={13}/>
                            </button>
                            <div style={{ display:'flex', gap:6 }}>
                              {Array.from({length:totalPages},(_,i) => (
                                <button key={i} onClick={() => setPropPage(i)}
                                  style={{ width:i===safePage?28:8, height:8, borderRadius:4, border:'none', background:i===safePage?C.purple:`${C.purple}33`, cursor:'pointer', padding:0, transition:'all .25s' }}/>
                              ))}
                            </div>
                            <button
                              onClick={() => setPropPage(p => Math.min(totalPages - 1, p + 1))}
                              disabled={safePage === totalPages - 1}
                              style={{ width:44, height:44, borderRadius:'50%', border:`1.5px solid ${safePage===totalPages-1 ? C.purple+'22' : C.purple+'66'}`, background:safePage===totalPages-1?'transparent':`${C.purple}14`, color:safePage===totalPages-1?`${C.cream}30`:C.purple, cursor:safePage===totalPages-1?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s' }}
                              onMouseEnter={e=>{ if(safePage<totalPages-1){ e.currentTarget.style.background=C.purple; e.currentTarget.style.color='#fff' }}}
                              onMouseLeave={e=>{ e.currentTarget.style.background=safePage===totalPages-1?'transparent':`${C.purple}14`; e.currentTarget.style.color=safePage===totalPages-1?`${C.cream}30`:C.purple }}>
                              <FaChevronLeft size={13}/>
                            </button>
                          </div>
                        )}
                      </>
                    )
                  })()
                )
              ) : (
                <div style={{ textAlign:'center', padding:'60px 24px', color:`${C.cream}40`, fontSize:15 }}>{TR[lang]?.noProperties}</div>
              )}
            </>
          )}

        </div>
      </section>

      {/* ── NEWS ────────────────────────────────────── */}
      <NewsSection/>

      {/* ── TESTIMONIALS ────────────────────────────── */}
      <TestimonialsSection/>

      {/* ── FAQ ─────────────────────────────────────── */}
      <FAQSection/>

      {/* ── ABOUT ───────────────────────────────────── */}
      <section id="about" style={{ padding:'72px 24px', scrollMarginTop:80, position:'relative', zIndex:1 }}>
        <div className="about-grid" style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:60, alignItems:'center' }}>
          <div>
            <SectionBadge color={C.purple}>{TR[lang]?.aboutTitle}</SectionBadge>
            <h2 style={{ fontSize:'clamp(28px,4vw,46px)', fontWeight:900, color:C.cream, marginBottom:24, lineHeight:1.2 }}>{TR[lang]?.aboutH2}</h2>
            <p style={{ fontSize:15, color:C.cream+'BB', lineHeight:2.1, marginBottom:32 }}>
              {TR[lang]?.aboutDesc}
            </p>
            {TR[lang]?.aboutPoints.map((pt,i) => (
              <div key={i} style={{ display:'flex', gap:14, alignItems:'flex-start', marginBottom:6, padding:'10px 14px', borderRadius:12, transition:'background .25s, transform .2s', cursor:'default', borderLeft:`3px solid transparent` }}
                onMouseEnter={e => { e.currentTarget.style.background=`${C.green}12`; e.currentTarget.style.borderLeftColor=C.green; e.currentTarget.style.transform='translateX(-3px)' }}
                onMouseLeave={e => { e.currentTarget.style.background=''; e.currentTarget.style.borderLeftColor='transparent'; e.currentTarget.style.transform='' }}>
                <span style={{ fontSize:17, color:C.cream+'DD', lineHeight:1.85, fontWeight:500 }}>{pt}</span>
              </div>
            ))}
          </div>
          <GlassCard style={{ padding:40 }}>
            <h3 style={{ fontSize:20, fontWeight:700, color:C.cream, marginBottom:24, textAlign:'center' }}>{TR[lang]?.contactNowBtn}</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <a href="tel:0559811814" style={{ display:'flex', gap:16, alignItems:'center', background:`${C.green}11`, borderRadius:12, padding:16, border:`1px solid ${C.green}22`, textDecoration:'none', color:'inherit', transition:'background .25s', cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background=`${C.green}22`}
                onMouseLeave={e => e.currentTarget.style.background=`${C.green}11`}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:`${C.green}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><FaPhone size={16} style={{ color:C.green }}/></div>
                <div><div style={{ fontSize:12, color:C.cream+'70', marginBottom:2 }}>{TR[lang]?.phoneLabel}</div><div style={{ fontSize:20, fontWeight:700, color:C.green }}>055-981-1814</div></div>
              </a>
              <a href="https://wa.me/972559811814" target="_blank" rel="noopener noreferrer" style={{ display:'flex', gap:16, alignItems:'center', background:'rgba(37,211,102,.08)', borderRadius:12, padding:16, border:'1px solid rgba(37,211,102,.2)', textDecoration:'none', color:'inherit', transition:'background .25s', cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background='rgba(37,211,102,.18)'}
                onMouseLeave={e => e.currentTarget.style.background='rgba(37,211,102,.08)'}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(37,211,102,.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><FaWhatsapp size={18} style={{ color:'#25D366' }}/></div>
                <div><div style={{ fontSize:12, color:C.cream+'70', marginBottom:2 }}>WhatsApp</div><div style={{ fontSize:16, fontWeight:700, color:'#25D366' }}>{TR[lang]?.whatsappSend}</div></div>
              </a>
              <div style={{ display:'flex', gap:16, alignItems:'center', background:'rgba(255,255,255,.04)', borderRadius:12, padding:16 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:`${C.purple}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><FaMapMarkerAlt size={16} style={{ color:C.purple }}/></div>
                <div><div style={{ fontSize:12, color:C.cream+'70', marginBottom:2 }}>{TR[lang]?.operatingAreaLabel}</div><div style={{ fontSize:14, fontWeight:600, color:C.cream }}>{TR[lang]?.areaServed}</div></div>
              </div>
              <button onClick={() => openContact()} className="primary-btn" style={{ width:'100%', borderRadius:12, fontSize:16 }}>{TR[lang]?.sendMessageBtn}</button>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ── SPOTIFY SECTION ──────────────────────────────────── */}
      <section style={{ padding:'64px 24px 56px', background:`linear-gradient(180deg, ${C.bg} 0%, ${C.card} 100%)`, position:'relative', zIndex:1, overflow:'hidden' }}>
        {/* ambient blobs */}
        <div style={{ position:'absolute', top:'10%', right:'-6%', width:440, height:440, background:`radial-gradient(circle,${C.purple}12,transparent 70%)`, pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:'5%', left:'-6%', width:380, height:380, background:`radial-gradient(circle,${C.green}0B,transparent 70%)`, pointerEvents:'none' }}/>

        <div style={{ maxWidth:760, margin:'0 auto', position:'relative', zIndex:1, textAlign:'center' }}>
          {/* Title */}
          <p style={{ margin:'0 0 10px', fontSize:'clamp(12px,1.4vw,14px)', fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:C.green, fontFamily:"'Rubik',sans-serif" }}>
            {lang === 'en' ? 'The Soundtrack' : 'הפסקול שלנו'}
          </p>
          <h2 style={{ margin:'0 0 14px', fontSize:'clamp(22px,4vw,36px)', fontWeight:800, color:C.cream, fontFamily:"'Rubik',sans-serif", lineHeight:1.25 }}>
            {lang === 'en' ? 'Afik Hanahal — Between Close & Close' : 'הפסקול של אפיק הנחל, בין סגירה לסגירה'}
          </h2>
          <p style={{ margin:'0 0 36px', fontSize:'clamp(14px,1.6vw,17px)', color:`${C.cream}99`, fontFamily:"'Rubik',sans-serif", lineHeight:1.6 }}>
            {lang === 'en'
              ? 'Press Play and get into the rhythm that accompanies our real-estate deals'
              : 'לחצו Play והיכנסו לקצב שמלווה את עסקאות הנדל"ן שלנו'}
          </p>

          {/* Spotify embed */}
          <div style={{ borderRadius:16, overflow:'hidden', boxShadow:`0 8px 48px rgba(0,0,0,.45), 0 0 0 1px ${C.purple}22` }}>
            <iframe
              style={{ borderRadius:12, display:'block' }}
              src="https://open.spotify.com/embed/playlist/7HGgXmznOBKie0g6LDQ0uN?utm_source=generator"
              width="100%"
              height="152"
              frameBorder="0"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title="Afik Hanahal Spotify Playlist"
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────── */}
      <footer id="contact" style={{ position:'relative', overflow:'hidden', scrollMarginTop:80, zIndex:1 }}>

        {/* ── Background layers: darker richer purple + texture ── */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg, #090520 0%, #100830 25%, #070415 65%, #040210 100%)', zIndex:0 }}/>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 20% 55%, rgba(100,75,210,.42) 0%, transparent 50%), radial-gradient(ellipse at 78% 18%, rgba(80,50,190,.32) 0%, transparent 45%), radial-gradient(ellipse at 50% 100%, rgba(60,30,160,.25) 0%, transparent 38%)', zIndex:0 }}/>
        <div style={{ position:'absolute', inset:0, backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Cpath d='M0 0L6 6M-1 5L1 7M5-1L7 1' stroke='rgba(255,255,255,0.035)' stroke-width='0.7'/%3E%3C/svg%3E")`, zIndex:0 }}/>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:'linear-gradient(90deg, transparent 0%, rgba(132,144,216,.4) 40%, rgba(130,246,127,.3) 60%, transparent 100%)', zIndex:1 }}/>

        <div style={{ position:'relative', zIndex:2, maxWidth:1100, margin:'0 auto', padding:'60px 24px 36px' }}>
          <div className="footer-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:44, marginBottom:48 }}>

            {/* ── Col 1: Logo + social + hours ── */}
            <div className="footer-col">
              <div className="footer-logo-wrap" style={{ marginBottom:16 }}><Logo size={88}/></div>
              <p style={{ fontSize:15, color:'rgba(232,228,216,.7)', lineHeight:1.8, marginBottom:16 }}>{TR[lang]?.footerDesc}</p>
              <div className="footer-social" style={{ display:'flex', gap:11, marginBottom:16 }}>
                <a href="mailto:afik.hanahal@gmail.com" className="social-btn email" title="שלח מייל" aria-label="אימייל">
                  <FaEnvelope size={18}/>
                </a>
                <a href="https://www.facebook.com/profile.php?id=61573376818745" target="_blank" rel="noopener noreferrer" className="social-btn facebook" title="פייסבוק" aria-label="פייסבוק">
                  <FaFacebookF size={18}/>
                </a>
                <a href="https://www.instagram.com/afik.hanahal/" target="_blank" rel="noopener noreferrer" className="social-btn instagram" title="אינסטגרם" aria-label="אינסטגרם">
                  <FaInstagram size={18}/>
                </a>
              </div>
              <div className="footer-hours" style={{ fontSize:13, color:'rgba(232,228,216,.45)', lineHeight:1.7 }}>
                <div>{TR[lang]?.sunToThurs}</div>
                <div>{TR[lang]?.friday}</div>
              </div>
            </div>

            {/* ── Col 2: Nav links ── */}
            <div className="footer-col">
              <h3 style={{ fontSize:17, fontWeight:700, color:'rgba(232,228,216,.85)', marginBottom:16, letterSpacing:'.02em' }}>{TR[lang]?.quickNav}</h3>
              <div className="footer-nav-links" style={{ display:'flex', flexDirection:'column', gap:13 }}>
                {NAV_LINKS.map(({ id }) => (
                  <button key={id} onClick={() => scrollTo(id)} style={{ background:'none', border:'none', color:'rgba(232,228,216,.6)', fontSize:15, cursor:'pointer', textAlign: lang==='en' ? 'left' : 'right', fontFamily:'inherit', padding:0, transition:'color .2s' }}
                    onMouseEnter={e => e.currentTarget.style.color=C.purple}
                    onMouseLeave={e => e.currentTarget.style.color='rgba(232,228,216,.6)'}>
                    {TR[lang]?.nav?.[id] || id}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Col 3: דברו איתנו + contact ── */}
            <div className="footer-col">
              <h3 style={{ fontSize:30, fontWeight:900, color:'rgba(232,228,216,.95)', marginBottom:22, lineHeight:1.1, letterSpacing:'-.02em' }}>{TR[lang]?.talkToUs}</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <a href="tel:0559811814" style={{ color:'#82F67F', textDecoration:'none', fontSize:27, fontWeight:800, display:'flex', alignItems:'center', gap:10, transition:'all .22s', letterSpacing:'-.5px', direction:'ltr', justifyContent: lang==='en' ? 'flex-start' : 'flex-end' }}
                  onMouseEnter={e => { e.currentTarget.style.textShadow='0 0 28px rgba(130,246,127,.7)'; e.currentTarget.style.transform='translateY(-2px)' }}
                  onMouseLeave={e => { e.currentTarget.style.textShadow=''; e.currentTarget.style.transform='' }}>
                  055-981-1814 <FaPhone size={18}/>
                </a>
                <a href="https://wa.me/972559811814" target="_blank" rel="noopener noreferrer" style={{ color:'#25D366', textDecoration:'none', fontSize:17, fontWeight:600, display:'flex', alignItems:'center', gap:9, transition:'all .2s', direction:'ltr', justifyContent: lang==='en' ? 'flex-start' : 'flex-end' }}
                  onMouseEnter={e => { e.currentTarget.style.textShadow='0 0 18px rgba(37,211,102,.65)'; e.currentTarget.style.transform='translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.textShadow=''; e.currentTarget.style.transform='' }}>
                  {TR[lang]?.waTitle} <FaWhatsapp size={20}/>
                </a>
                <a href="mailto:afik.hanahal@gmail.com" style={{ color:'rgba(232,228,216,.65)', textDecoration:'none', fontSize:15, display:'flex', alignItems:'center', gap:8, transition:'color .2s', direction:'ltr', justifyContent: lang==='en' ? 'flex-start' : 'flex-end' }}
                  onMouseEnter={e => e.currentTarget.style.color='rgba(232,228,216,.95)'}
                  onMouseLeave={e => e.currentTarget.style.color='rgba(232,228,216,.65)'}>
                  afik.hanahal@gmail.com <FaEnvelope size={14}/>
                </a>
                <button onClick={() => openContact()} style={{ marginTop:4, padding:'13px 28px', background:'rgba(132,144,216,.18)', border:'1px solid rgba(132,144,216,.44)', borderRadius:10, color:'rgba(232,228,216,.9)', fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit', width:'fit-content', transition:'background .25s, border-color .25s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(132,144,216,.38)'; e.currentTarget.style.borderColor='rgba(132,144,216,.7)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(132,144,216,.18)'; e.currentTarget.style.borderColor='rgba(132,144,216,.44)' }}>{TR[lang]?.sendMsg}</button>
              </div>
            </div>

          </div>

          {/* ── Bottom bar ── */}
          <div className="footer-bottom" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderTop:'1px solid rgba(132,144,216,.15)', paddingTop:20, flexWrap:'wrap', gap:10 }}>
            <div className="footer-bottom-links" style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <div style={{ fontSize:13, color:'rgba(232,228,216,.35)' }}>{TR[lang]?.copyright}</div>
              <a href="/accessibility" style={{ fontSize:13, color:C.purple, textDecoration:'none', fontWeight:600, opacity:.75, transition:'opacity .15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity='1'}
                onMouseLeave={e => e.currentTarget.style.opacity='.75'}>{TR[lang]?.accessibility}</a>
              <button onClick={() => setShowPrivacy(true)} style={{ background:'none', border:'none', padding:0, fontSize:13, color:'rgba(132,144,216,.6)', fontWeight:500, cursor:'pointer', opacity:.7, transition:'opacity .15s', fontFamily:'inherit', textDecoration:'underline', textUnderlineOffset:3 }}
                onMouseEnter={e => e.currentTarget.style.opacity='1'}
                onMouseLeave={e => e.currentTarget.style.opacity='.7'}>{TR[lang]?.privacy}</button>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <LangSwitch />
              <button onClick={() => adminAuth ? setShowAdmin(true) : setShowPw(true)} title="כניסת מנהל"
                style={{ background:'none', border:'none', color:'rgba(232,228,216,.14)', cursor:'pointer', transition:'color .2s', marginRight:6, padding:4 }}
                onMouseEnter={e => e.currentTarget.style.color=C.purple}
                onMouseLeave={e => e.currentTarget.style.color='rgba(232,228,216,.14)'}><FaLock size={13}/></button>
            </div>
          </div>
        </div>
      </footer>

      {/* ── WHATSAPP FLOAT ───────────────────────────── */}
      <a href="https://wa.me/972559811814" target="_blank" rel="noopener noreferrer" className="wa-float" title="שלח הודעה ב-WhatsApp" onClick={() => trackEvent('whatsapp_click', { src:'float_btn' })}>
        <WaIcon/>
      </a>

      {/* ── BACK TO TOP ─────────────────────────────── */}
      <BackToTop />

      {/* ── MODALS ──────────────────────────────────── */}
      {showPw      && <PasswordPrompt onSuccess={() => { sessionStorage.setItem('afik_admin_session','1'); setAdminAuth(true); setShowPw(false); setShowAdmin(true) }} onClose={() => setShowPw(false)}/>}
      {showContact && <ContactModal  prop={contactProp} onClose={() => setShowContact(false)}/>}
      {showCalc    && <RealEstateCalc onClose={() => setShowCalc(false)}/>}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)}/>}
      {selectedProp && <PropertyModal prop={selectedProp} properties={properties} onClose={() => setSelectedProp(null)} onContact={p => { openContact(p) }} onSelect={openProperty} govmapToken={govmapToken}/>}
      {showWizard && <PropertyWizard
          key={wizardEditId || wizardKey}
          onClose={() => { setShowWizard(false); setWizardEditData(null); setWizardEditId(null) }}
          initialData={wizardEditData}
          editId={wizardEditId}
          govmapToken={govmapToken}
          onPublish={(prop, isDraft) => {
            let nextProps
            if (wizardEditId) {
              const oldProp = properties.find(x => String(x.id) === String(wizardEditId)) || {}
              const merged = {
                ...prop,
                id: wizardEditId,                              // critical: never let wizardToProperty's Date.now() id override
                status: oldProp.status || prop.status,
                createdAt: oldProp.createdAt || prop.createdAt,
                published: isDraft ? false : (prop.published ?? oldProp.published ?? true),
              }
              nextProps = properties.map(x => String(x.id) === String(wizardEditId) ? merged : x)
            } else {
              nextProps = [...properties, prop]
            }
            // Determine the exact property that was added/updated and save only it
            const savedProp = wizardEditId
              ? nextProps.find(x => String(x.id) === String(wizardEditId))
              : nextProps[nextProps.length - 1]
            setProperties(nextProps)
            setWizardEditData(null)
            setWizardEditId(null)
            setShowWizard(false)
            if (!isDraft && prop.published !== false) {
              setTimeout(() => scrollTo('properties'), 350)
            }
            // Save only the affected property — safe, atomic, never touches others
            const base = API_BASE || ''
            if (base && savedProp) {
              fetch(`${base}/api/properties/${savedProp.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
                body: JSON.stringify(savedProp),
                signal: AbortSignal.timeout(20000),
              }).then(r => r.ok ? r.json() : Promise.reject(r.status))
                .then(body => console.log('[wizard] saved prop', savedProp.id, '→', body.storage))
                .catch(e => console.error('[wizard] save error:', e))
            }
          }}
        />}
      {showAdmin && adminAuth && (
        <AdminPanel
          properties={properties} setProperties={setProperties}
          stats={stats} setStats={setStats}
          sharon={sharon} setSharon={setSharon}
          govmapToken={govmapToken} setGovmapToken={setGovmapToken}
          onClose={() => setShowAdmin(false)}
          onEditInWizard={p => {
            setShowAdmin(false)
            setWizardEditData(propertyToWizardData(p))
            setWizardEditId(p.id)
            setShowWizard(true)
          }}
        />
      )}

      {/* ── THEME TOGGLE ────────────────────────────── */}
      <CurtainThemeToggle/>

      {/* ── ACCESSIBILITY WIDGET ────────────────────── */}
      <AccessibilityWidget/>

      {/* ── COOKIE CONSENT ──────────────────────────── */}
      <CookieConsent C={C} isDark={isDark}/>
    </>
    </ThemeCtx.Provider>
  )
}


