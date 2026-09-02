import { useState, useEffect, useLayoutEffect, useRef, useCallback, createContext, useContext, useMemo, lazy, Suspense } from 'react'
import { isRealEstateArticle } from '../lib/news/classify.js'
import { MenuToggleIcon } from './MenuToggleIcon.jsx'
import AccessibilityWidget from './AccessibilityWidget.jsx'
import CookieConsent from './CookieConsent.jsx'
import { AnimatePresence, motion } from 'framer-motion'
// PropertyWizard (2k+ lines, admin-only) is lazy-loaded below. Its propertyToWizardData
// helper is dynamically imported at the edit call sites so it never pulls the wizard
// (and its GovMapWidget dependency) into the public bundle.
// NOTE: @supabase/supabase-js is heavy and only used by the admin realtime channel
// below — it is imported dynamically there (not here) so the public bundle stays lean.
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
const MetaLeadsTab      = lazyWithRetry(() => import('./MetaLeadsTab.jsx'))
const SupermetricsTab   = lazyWithRetry(() => import('./SupermetricsTab.jsx'))
// On-demand, heavy single-purpose modules — lazy so the public bundle stays lean.
const RealEstateCalc    = lazyWithRetry(() => import('./RealEstateCalc.jsx'))
const GovMapWidget      = lazyWithRetry(() => import('./GovMapWidget.jsx'))
const PropertyWizard    = lazyWithRetry(() => import('./PropertyWizard.jsx'))
import { FaChevronLeft, FaChevronRight, FaEnvelope, FaFacebookF, FaInstagram, FaBed, FaRulerCombined, FaCar, FaSwimmingPool, FaBuilding, FaBoxOpen, FaTree, FaSnowflake, FaShieldAlt, FaCouch, FaTools, FaMapMarkerAlt, FaExternalLinkAlt, FaPhone, FaCompass, FaLeaf, FaCalendarAlt, FaTimes, FaWhatsapp, FaSun, FaFileAlt, FaHome, FaMoneyBill, FaSearch, FaBalanceScale, FaHandshake, FaTrophy, FaHardHat, FaLock, FaKey, FaGlobe, FaSeedling, FaBolt, FaRocket, FaStar, FaChartLine, FaEye, FaPlay, FaWheelchair, FaFire, FaCalculator, FaShareAlt, FaHeart, FaStore, FaCamera, FaWifi, FaIndustry, FaExpand, FaUser, FaUsers, FaDesktop, FaMobileAlt, FaTabletAlt, FaCommentAlt, FaRobot, FaInbox, FaExclamationTriangle, FaChartBar, FaThumbsUp, FaImage, FaPencilAlt, FaCrown, FaMousePointer, FaDollarSign, FaVideo, FaLink, FaCheck, FaCheckCircle, FaUtensils, FaDoorOpen, FaUserShield, FaTrash } from 'react-icons/fa'

// ─── SERVER CONFIG ────────────────────────────────────────────────────────────
// Set VITE_API_URL in Vercel env vars to point at your Render server.
const API_BASE     = (import.meta.env.VITE_API_URL || 'https://afik-hanahal-server.onrender.com').replace(/\/$/, '')
// In production, contacts CRUD goes through Vercel → Supabase (never sleeps).
// In dev, fall back to the Render server so local testing still works.
const CONTACTS_API = import.meta.env.PROD ? '' : API_BASE
const ADMIN_TOKEN  = 'AFIKhanahal2026'

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
    newsDisclaimer: 'כל בוקר מתחלפות שתי כתבות בכתבות חדשות ממקורות שונים · כתבות נדל״ן בלבד · אפיק הנחל אינה אחראית לתוכן הכתבות',
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
    newsDisclaimer: 'Two articles rotate every morning from different outlets · real-estate news only · Afik Hanahal is not responsible for article content',
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
  /* ── Global scrollbars ── */
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:${C.purple}44; border-radius:4px; }
  ::-webkit-scrollbar-thumb:hover { background:${C.purple}88; }
  ::-webkit-scrollbar-corner { background:transparent; }

  /* ── Admin panel always-dark surfaces ── */
  .admin-board-dark { background:#0D1117 !important; color:#E2E8F8 !important; }
  .admin-board-dark ::-webkit-scrollbar-thumb { background:rgba(100,120,200,.35) !important; }
  .admin-board-dark ::-webkit-scrollbar-thumb:hover { background:rgba(100,120,200,.6) !important; }

  /* ── Kanban board horizontal scroll ── */
  .kanban-board-scroll {
    overflow-x: auto !important;
    overflow-y: hidden !important;
    scrollbar-width: thin;
    scrollbar-color: rgba(100,120,200,.3) transparent;
    -webkit-overflow-scrolling: touch;
  }
  .kanban-board-scroll::-webkit-scrollbar { height: 7px; }
  .kanban-board-scroll::-webkit-scrollbar-thumb { background: rgba(100,120,200,.3); border-radius: 4px; }
  .kanban-board-scroll::-webkit-scrollbar-track { background: transparent; }

  /* ── Kanban column vertical scroll ── */
  .kanban-col-scroll {
    overflow-y: auto !important;
    scrollbar-width: thin;
    scrollbar-color: rgba(100,120,200,.2) transparent;
    -webkit-overflow-scrolling: touch;
  }
  .kanban-col-scroll::-webkit-scrollbar { width: 4px; }
  .kanban-col-scroll::-webkit-scrollbar-thumb { background: rgba(100,120,200,.25); border-radius: 3px; }

  /* ── Table horizontal scroll ── */
  .leads-table-scroll {
    overflow-x: auto !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: rgba(100,120,200,.25) transparent;
  }

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
    /* Contact cards on the "פנה אלינו עכשיו" panel: center icon + text as a balanced group */
    .contact-card-row { justify-content:center !important; gap:18px !important; }
    .contact-card-text { flex:0 1 auto !important; text-align:center !important; }
    .contact-card-text > div { text-align:center !important; }
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
    .footer-bottom { flex-wrap: wrap !important; gap: 10px 0 !important; padding-top: 16px !important; }
    .footer-bottom-links { order: 0 !important; flex: 1 1 100% !important; justify-content: center !important; }
    .footer-bottom-copyright { order: 1 !important; flex: 1 1 100% !important; text-align: center !important; white-space: normal !important; overflow: visible !important; padding: 0 !important; }
    .footer-bottom-actions { order: 2 !important; flex: 1 1 100% !important; justify-content: center !important; }
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
  .admin-content { direction: ltr !important; position: relative; -webkit-overflow-scrolling: touch !important; overscroll-behavior: contain; }
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
  { name:'ישראל בן יהודה', en_name:'Israel Ben-Yehuda', role:'מייסד ומנכ״ל', en_role:'Founder & CEO', photo:'/img/ceo.webp' },
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
  'הרצליה':    '/img/herzliya.webp',
  'כפר סבא':   '/img/kfar-saba.webp',
  'רעננה':     '/img/raanana.webp',
  'הוד השרון': '/img/hod-hasharon.webp',
}
const CITY_IMG_FILTER = {
  'כפר סבא': 'brightness(1.55) saturate(1.2) contrast(1.08)',
}

// ─── HOOKS ────────────────────────────────────────────────────────────────────
// Returns touch handlers that call onClose when user swipes > threshold px in either direction
function useSwipeClose(onClose, threshold = 120) {
  const ref = useRef({ x0: 0, y0: 0, dragging: false })
  const onTouchStart = useCallback(e => {
    if (e.target.closest('input, select, textarea, button, a, label, [role="slider"], [type="range"], video, [data-no-swipe]')) return
    ref.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, dragging: true }
  }, [])
  // Cancel the swipe the moment the finger moves more than 12 px vertically —
  // this stops any accidental close during normal vertical page scrolling.
  const onTouchMove = useCallback(e => {
    if (!ref.current.dragging) return
    if (Math.abs(e.touches[0].clientY - ref.current.y0) > 12) ref.current.dragging = false
  }, [])
  const onTouchEnd = useCallback(e => {
    if (!ref.current.dragging) return
    ref.current.dragging = false
    const dx = e.changedTouches[0].clientX - ref.current.x0
    if (Math.abs(dx) > threshold) onClose()
  }, [onClose, threshold])
  return { onTouchStart, onTouchMove, onTouchEnd }
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
  const activeBg     = `${C.purple}22`
  const activeBorder = `${C.purple}66`
  const sepColor     = isDark ? 'rgba(132,144,216,0.25)' : `${C.cream}33`

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
        src="/img/signature.webp"
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
                    src="/img/ceo.webp"
                    alt="ישראל בן יהודה"
                    loading="lazy" decoding="async"
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
                      <code style={{ color:`${C.purple}70`, fontSize:11 }}>public/img/ceo.webp</code>
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
const LEADS_STORE    = 'afik_leads_v1'
const LEADS_DELETED  = 'afik_leads_deleted_v1'
const LEADS_TRASH    = 'afik_leads_trash_v1'
const WA_KEY         = 'afik_wa_settings'
const ANALYTICS_KEY  = 'afik_analytics_v2'
// Additional Meta lead-source pages (beyond the main page hardcoded in MetaLeadsTab).
// Shape: [{ id, name, adAccountId, pageId, enabled }]. Read by MetaLeadsTab sync,
// managed in the Settings → "מקורות לידים — Meta" card, synced to cloud as `metaLeadSources`.
const META_LEAD_PAGES_KEY = 'afik_meta_lead_pages'
const WA_DEFAULT_TEMPLATE = `היי {name} 👋
תודה שהשארת פרטים!
ראינו את הפנייה שלך

מתי נוח לך לדבר? נשמח לתאם שיחה

צוות אפיק הנחל`

// One-time migration: if the saved WA template still equals the OLD pre-2026
// default (which said "תודה שפנית לאפיק הנחל" and had no "צוות אפיק הנחל"
// signature), upgrade it to the new WA_DEFAULT_TEMPLATE. Any user-customized
// template is left untouched. Runs once per browser.
const _WA_OLD_DEFAULT = `היי {name} 👋
תודה שפנית לאפיק הנחל!
ראינו את הפנייה שלך

מתי נוח לך לדבר? נשמח לתאם שיחה`
try {
  const _waMigKey = 'afik_wa_template_v2'
  if (!localStorage.getItem(_waMigKey)) {
    const _saved = JSON.parse(localStorage.getItem(WA_KEY) || '{}')
    const _tpl = (_saved.template || '').trim()
    if (!_tpl || _tpl === _WA_OLD_DEFAULT.trim()) {
      localStorage.setItem(WA_KEY, JSON.stringify({ ..._saved, template: WA_DEFAULT_TEMPLATE }))
    }
    localStorage.setItem(_waMigKey, '1')
  }
} catch {}

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

// No secrets here — the Green API token lives only in server env (WA_GREENAPI_TOKEN).
// The lead auto-reply is sent server-side from /api/contacts on lead creation.
const WA_DEFAULTS = { provider:'greenapi', instanceId:'7107558519', apiUrl:'https://7107.api.greenapi.com', enabled:true, delayMin:2 }

// Module-level cloud settings cache — populated at app startup from /api/settings
let _cloudSettings = {}
// ES module imports are read-only bindings — the admin chunk mutates this through the setter
export function setCloudSettings(v) { _cloudSettings = v }

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
      onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd}>
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
            fetch(`${CONTACTS_API}/api/contacts`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(lead),
            }).catch(() => {})
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

// ─── ADMIN DASHBOARD — lazy chunk (src/AdminPanel.jsx) ─────────────────────
// Only the login prompt and the team-token hook stay here; the dashboard itself is
// downloaded the first time an authenticated admin opens it.
const AdminPanel = lazyWithRetry(() => import('./AdminPanel.jsx'))
const TEAM_KEY = 'afik_team_v1'

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
    src: '/img/doron-yaffe.webp',
    imgFit: 'cover', imgPos: 'center top',
  },
  {
    quote: 'ישראל בן יהודה הוא מתווך מקצועי, אמין ומסור, עם שירות אישי וליווי ברמה גבוהה לאורך כל הדרך. שילוב נדיר של מקצוענות, יושרה והיכרות עמוקה עם שוק הנדל״ן באזור השרון. קשוב, סבלני וממוקד בתוצאות, מומלץ בחום.',
    en_quote: 'Israel Ben-Yehuda is a professional, reliable and dedicated broker, with personal service and high-level guidance throughout. A rare combination of professionalism, integrity and deep knowledge of the Sharon real estate market. Attentive, patient and results-focused — highly recommended.',
    name: 'פינחסי ג׳ימי', en_name: 'Jimmy Pinhasi', designation: 'שמאי מקרקעין',
    en_designation: 'Real Estate Appraiser',
    src: '/img/pinhasi-jimmy.webp',
    imgFit: 'cover', imgPos: 'center top',
  },
  {
    quote: 'ביצענו כמה עסקאות קרקע דרך אפיק הנחל. הם תמיד מוצאים נכסים עם פוטנציאל אמיתי, הרבה לפני שהם מגיעים לשוק הפתוח.',
    en_quote: 'We have completed several land deals through Afik Hanahal. They always find properties with real potential, well before they reach the open market.',
    name: 'תומר צליח', en_name: 'Tomer Tzaliah', designation: 'חברת צליח רוטשילד',
    en_designation: 'Tzaliah Rothschild Company',
    src: '/img/tomer-tzaliah.webp',
    imgFit: 'cover', imgPos: 'center 18%',
  },
  {
    quote: 'חיפשנו מגרש לצמודת קרקע עם תקציב מוגבל. הצוות של אפיק הנחל הבין בדיוק מה אנחנו צריכים ומצאו לנו את הפתרון המושלם.',
    en_quote: 'We were looking for a plot for a detached house on a limited budget. The Afik Hanahal team understood exactly what we needed and found us the perfect solution.',
    name: 'דורון יפה', en_name: 'Doron Yaffe', designation: 'יזם בתחום הנדל״ן',
    en_designation: 'Real Estate Developer',
    src: '/img/guy-musseri.webp',
    imgFit: 'cover', imgPos: 'center top',
  },
  {
    quote: 'במהלך כ־20 שנות עבודה משותפת עם ישראל בן יהודה, הכרתי איש מקצוע יוצא דופן בתחום הנדל״ן, הקרקעות והיזמות. ישראל משלב מקצועיות, ניסיון רב, יושרה ואמינות ללא פשרות, לצד יכולת לזהות הזדמנויות ולהוביל עסקאות באחריות וביסודיות. אני ממליץ עליו בלב שלם לכל מי שמחפש ליווי מקצועי ואמין.',
    en_quote: 'Over nearly 20 years of working alongside Israel Ben-Yehuda, I have come to know an exceptional professional in real estate, land, and development. Israel combines professionalism, extensive experience, integrity and uncompromising reliability with the ability to identify opportunities and lead transactions with responsibility and thoroughness. I recommend him wholeheartedly to anyone seeking professional and trustworthy guidance.',
    name: 'עו״ד אסף שובלי', en_name: 'Adv. Assaf Shovali', designation: '',
    en_designation: '',
    firm: 'משרד עו״ד שובלי ושות׳', en_firm: 'Shobali & Co. Law Office',
    src: '/img/assaf-shovali.webp',
    imgFit: 'cover', imgPos: 'center top',
  },
]

// ─── NEWS SECTION ─────────────────────────────────────────────────────────────
const ARCHIVE_STORE  = 'afik_archive_v1'
const SLOT_COUNT     = 4
const SERVER_URL     = import.meta.env.VITE_API_URL || 'https://afik-hanahal-server.onrender.com'


// ── Normalise any article shape (Vercel / Supabase / Render / localStorage) ──
function normalizeArticle(a) {
  const url = a.url || a.link || ''
  const publishedAt = a.publishedAt || a.published_at || (a.date ? new Date(a.date).toISOString() : null)
  const d = publishedAt ? new Date(publishedAt) : null
  return { id: a.id || url, title: a.title, url, link: a.link || url, image: a.image || '', source: a.source || '',
           publishedAt, date: d && !isNaN(d) ? d : null }
}
const newsKey = a => (a.title || '').replace(/\s+/g, '').slice(0, 30)

// ── Fetch the board — /api/news (curated in Supabase by /api/cron/rotate) is the source of truth.
// The legacy Render feed is only consulted when Vercel comes back short, and EVERYTHING is
// re-checked by the shared real-estate classifier so nothing off-topic can reach a card.
async function fetchFreshArticles() {
  const get = (u, ms) => fetch(u, { signal: AbortSignal.timeout(ms) }).then(r => r.ok ? r.json() : []).catch(() => [])
  let list = await get('/api/news', 22000)
  if (!Array.isArray(list)) list = []
  if (list.length < SLOT_COUNT) {
    const extra = await get(`${SERVER_URL}/api/news/feed`, 15000)
    if (Array.isArray(extra)) list = [...list, ...extra]
  }
  const seen = new Set()
  return list
    .filter(a => a?.title && (a.url || a.link))
    .filter(isRealEstateArticle)
    .map(normalizeArticle)
    .filter(a => { const k = newsKey(a); if (seen.has(k)) return false; seen.add(k); return true })
}

// The server swaps 2 of the 4 cards every morning (/api/cron/rotate). The client just shows the
// board, image-bearing cards first, and caches it for 6h so a visitor sees a stable set.
function useRotatingNews() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(false)

  const run = useCallback(async (forceReset = false) => {
    setLoading(true); setError(false)
    const CACHE_KEY = 'afik_news_board_v11'
    const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') } catch { return null } }
    const hydrate = list => (list || []).map(normalizeArticle).filter(isRealEstateArticle).slice(0, SLOT_COUNT)

    if (!forceReset) {
      const c = readCache()
      if (c?.articles?.length >= SLOT_COUNT && Date.now() - c.ts < 6 * 60 * 60 * 1000) {
        const cached = hydrate(c.articles)
        if (cached.length >= SLOT_COUNT) { setArticles(cached); setLoading(false); return }
      }
    }

    const fresh = await fetchFreshArticles()
    if (!fresh.length) {
      const cached = hydrate(readCache()?.articles)
      if (cached.length) { setArticles(cached); setLoading(false); return }
      setError(true); setLoading(false); return
    }

    const board = [...fresh.filter(a => a.image), ...fresh.filter(a => !a.image)].slice(0, SLOT_COUNT)
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ articles: board, ts: Date.now() })) } catch {}

    // Local archive of everything seen — the archive modal's offline fallback
    try {
      const arch = JSON.parse(localStorage.getItem(ARCHIVE_STORE) || '[]')
      const seen = new Set(arch.map(newsKey))
      fresh.forEach(a => { const k = newsKey(a); if (!seen.has(k)) { arch.unshift({ ...a, archivedAt: Date.now() }); seen.add(k) } })
      localStorage.setItem(ARCHIVE_STORE, JSON.stringify(arch.slice(0, 200)))
    } catch {}

    setArticles(board); setLoading(false)
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
    const recent = live.filter(isRealEstateArticle).map(a => ({ ...a, date: a.date || a.publishedAt || a.published_at || null })).filter(a => {
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
                  loading="lazy" decoding="async"
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
    fetch(`${CONTACTS_API}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    }).catch(() => {})
    setDone(true)
    setOpen(false)
    window.open(pdf.url, '_blank', 'noopener')
    // WhatsApp auto-reply is sent server-side from /api/contacts (token stays on the server)
  }

  const inp = { width:'100%', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.16)', borderRadius:10, padding:'12px 14px', color:'#fff', fontFamily:'inherit', fontSize:14, boxSizing:'border-box', outline:'none', transition:'border-color .15s' }

  return (
    <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:14, overflow:'hidden' }}>
      {/* PDF row */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px' }}>
        <div style={{ width:40, height:40, borderRadius:10, background:`${C.purple}22`, border:`1px solid ${C.purple}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <FaFileAlt size={17} style={{ color:C.purple }}/>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pdf.name || 'מסמך PDF'}</div>
          <div style={{ fontSize:12, color:'rgba(255,255,255,.45)', marginTop:2 }}>PDF · חינם להורדה</div>
        </div>
        <button
          onClick={() => { if (done) { window.open(pdf.url, '_blank', 'noopener') } else { setOpen(o => !o) } }}
          style={{ flexShrink:0, padding:'9px 18px', background: done ? `linear-gradient(135deg,${C.green}cc,${C.green}88)` : `linear-gradient(135deg,${C.purple}dd,${C.purple}99)`, border:'none', borderRadius:10, color:'#fff', cursor:'pointer', fontSize:13, fontFamily:'inherit', fontWeight:700, display:'flex', alignItems:'center', gap:6, transition:'opacity .15s', whiteSpace:'nowrap', boxShadow: done ? `0 2px 8px ${C.green}40` : `0 2px 8px ${C.purple}40` }}>
          {done ? <><FaCheck size={11}/> הורד</> : <><FaFileAlt size={11}/> הורדה</>}
        </button>
      </div>

      {/* Lead-gate form */}
      {open && !done && (
        <form onSubmit={submit} style={{ borderTop:'1px solid rgba(255,255,255,.09)', background:'linear-gradient(160deg,rgba(255,255,255,.05) 0%,rgba(0,0,0,.25) 100%)', padding:'20px 18px 18px' }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <div style={{ width:36, height:36, borderRadius:50, background:`linear-gradient(135deg,${C.purple},${C.purple}88)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 2px 10px ${C.purple}55` }}>
              <FaFileAlt size={15} style={{ color:'#fff' }}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'#fff', lineHeight:1.2 }}>קבל את המסמך חינם</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.5)', marginTop:2 }}>מלא פרטים ותוריד מיידית</div>
            </div>
          </div>

          {/* Two-column: name (left) | phone (right — RTL start) */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12, direction:'rtl' }}>
            <input
              required
              placeholder="טלפון"
              type="tel"
              value={phone}
              onChange={e=>setPhone(e.target.value)}
              style={inp}
            />
            <input
              required
              placeholder="שם מלא"
              value={name}
              onChange={e=>setName(e.target.value)}
              style={inp}
            />
          </div>

          <button type="submit" style={{ width:'100%', padding:'13px', background:`linear-gradient(135deg,${C.purple} 0%,${C.purple}bb 100%)`, border:'none', borderRadius:10, color:'#fff', fontFamily:'inherit', fontSize:15, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:`0 3px 14px ${C.purple}55`, transition:'opacity .15s' }}>
            <FaFileAlt size={14}/> שלח והורד
          </button>
          <div style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,.3)', marginTop:10 }}>הפרטים שלך נשמרים בסודיות מוחלטת</div>
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

// Free image CDN (wsrv.nl) — fetches the source ONCE, caches it on Cloudflare's
// edge, then serves a resized + compressed WebP copy to every visitor. This is
// the single biggest lever on Supabase egress: without it every browser pulls
// every full-resolution photo straight from Supabase Storage on every page view
// (Supabase's own render/image transforms are Pro-plan only). With it, Supabase
// serves each image just once (to the CDN) and the CDN absorbs all the rest.
// Disable or swap the proxy via VITE_IMG_CDN ('' = serve original Supabase URLs).
const IMG_CDN = (import.meta.env.VITE_IMG_CDN ?? 'https://wsrv.nl').replace(/\/$/, '')

// Route a remote image through the CDN: resize to `width`, compress to `quality`,
// convert to WebP, and never upscale smaller originals (`we`).
function proxyImg(url, width, quality) {
  if (!IMG_CDN) return url
  return `${IMG_CDN}/?url=${encodeURIComponent(url)}&w=${width}&q=${quality}&output=webp&we`
}

// Recover the original source URL from a proxied one (used as an onError fallback
// so images stay visible even if the CDN is ever unreachable).
function unproxyImg(url) {
  if (typeof url === 'string' && IMG_CDN && url.startsWith(`${IMG_CDN}/?url=`)) {
    try { return decodeURIComponent(url.slice(`${IMG_CDN}/?url=`.length).split('&')[0]) } catch {}
  }
  return url
}

// <img onError> handler: if a CDN-proxied image fails, retry once with the
// original source before giving up.
function imgFallback(e) {
  const el = e.currentTarget
  if (el.dataset.fellBack) return
  const orig = unproxyImg(el.src)
  if (orig !== el.src) { el.dataset.fellBack = '1'; el.src = orig }
}

// Transform image URL: Cloudinary quality/format optimisation.
// base64 data URLs returned as-is (legacy images uploaded before cloud storage).
function cloudImg(url, width = 1200) {
  if (!url || url.startsWith('data:')) return url

  // Supabase Storage — serve original URL directly (wsrv.nl proxy disabled
  // because it fails to fetch from this bucket and hides all images).
  if (url.includes('.supabase.co/storage/')) return url

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
  const [confirmLeave, setConfirmLeave] = useState(false)  // "stay or go back" choice
  const [imgIdx, setImgIdx] = useState(0)
  const [saved, setSaved] = useState(false)
  const [shared, setShared] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const slideshowRef = useRef(null)
  const videoRef = useRef(null)
  const modalScrollRef = useRef(null)

  // useLayoutEffect fires synchronously after DOM mutations but BEFORE the
  // browser paints — the user never sees the new property at the old position.
  // behavior:'instant' overrides scroll-behavior:smooth on the container so
  // the jump is frame-perfect even when CSS smooth-scroll is enabled.
  useLayoutEffect(() => {
    const el = modalScrollRef.current
    if (!el) return
    el.scrollTo({ top: 0, behavior: 'instant' })
  }, [prop.id])
  // Backdrop-close guard: only close when the press AND release both land on the
  // backdrop (a deliberate tap) — never after a scroll/drag that ends there.
  const backdropDown = useRef(false)
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
      // Ignore keys originating inside the GovMap widget (root carries data-no-swipe)
      // or any input/select — pressing Escape to close a GovMap popup, or panning the
      // map with the keyboard, must NOT close the property modal or flip the gallery.
      if (e.target?.closest?.('[data-no-swipe], input, textarea, select')) return
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
    // Swipe-to-close was REMOVED here — on mobile it misfired while interacting with
    // the GovMap map / scrolling and bounced the user back to the home screen.
    <div ref={modalScrollRef} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.88)', backdropFilter:'blur(14px)', zIndex:900, overflowY:'auto', WebkitOverflowScrolling:'touch', scrollBehavior:'smooth' }}
      onMouseDown={e => { backdropDown.current = e.target === e.currentTarget }}
      onClick={e => { if (e.target === e.currentTarget && backdropDown.current) setConfirmLeave(true) }}>

      {/* ══ "Stay or go back" choice — instead of bouncing the user off the property ══ */}
      {confirmLeave && (
        <div onClick={e => { e.stopPropagation(); setConfirmLeave(false) }}
          style={{ position:'fixed', inset:0, zIndex:1500, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, direction:'rtl' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'#14141f', border:`1px solid ${C.purple}44`, borderRadius:18, padding:'26px 24px', maxWidth:360, width:'100%', boxShadow:'0 24px 70px rgba(0,0,0,.6)', textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:C.cream, marginBottom:8 }}>לחזור לרשימת הנכסים?</div>
            <div style={{ fontSize:13.5, color:`${C.cream}88`, marginBottom:22, lineHeight:1.6 }}>אתה בעמוד הנכס. רוצה להישאר כאן או לחזור לרשימה?</div>
            <div style={{ display:'flex', gap:10 }}>
              <button type="button" onClick={() => setConfirmLeave(false)}
                style={{ flex:1, padding:'13px 0', borderRadius:11, border:'none', background:C.purple, color:'#fff', fontSize:14.5, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
                להישאר בנכס
              </button>
              <button type="button" onClick={() => { setConfirmLeave(false); onClose() }}
                style={{ flex:1, padding:'13px 0', borderRadius:11, border:`1px solid ${C.cream}28`, background:'transparent', color:`${C.cream}AA`, fontSize:14.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                חזור לרשימה
              </button>
            </div>
          </div>
        </div>
      )}

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
          onTouchStart={e => { e.stopPropagation(); galleryTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
          onTouchMove={e => e.stopPropagation()}
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
              onError={imgFallback}
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
              <img src={prop.status === 'נמכר' ? '/img/sold.webp' : '/img/rented.webp'} alt={prop.status} loading="lazy" decoding="async"
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
                <img src={src} alt="" decoding="async" onError={imgFallback}/>
                <div className="thumb-fallback" style={{ display:'none' }}><FaBuilding size={18}/></div>
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
            <img src={cloudImg(prop.logo, 600)} alt="לוגו פרויקט" onError={imgFallback}
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
                          ? <img src={thumbImg(sp.images[0])} alt={sp.title} loading="lazy" decoding="async" onError={imgFallback} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'transform .4s' }}/>
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

        {/* ══ GOVMAP — full-width, below all property details ══ */}
        {govmapToken && (
          <div style={{ borderTop:'1px solid rgba(255,255,255,.08)', padding:'36px 32px 52px', direction:'rtl' }}>
            <h3 style={{ fontSize:20, fontWeight:800, color:C.cream, margin:'0 0 18px', display:'flex', alignItems:'center', gap:10 }}>
              <FaMapMarkerAlt size={16} style={{ color:C.purple }}/> מפת GovMap
              {(prop.gush || prop.helka) ? (
                <span style={{ fontSize:13, fontWeight:600, color:`${C.cream}66`, background:`${C.purple}15`, borderRadius:6, padding:'3px 12px' }}>
                  גוש {prop.gush}{prop.helka ? ` · חלקה ${prop.helka}` : ''}{prop.subHelka ? ` · תת ${prop.subHelka}` : ''}
                </span>
              ) : (
                <span style={{ fontSize:12, fontWeight:500, color:`${C.cream}33`, background:`${C.purple}08`, borderRadius:6, padding:'3px 12px' }}>הכנס גוש/חלקה לניווט לחלקה</span>
              )}
            </h3>
            <Suspense fallback={<div style={{ height: 360, display:'flex', alignItems:'center', justifyContent:'center', color:`${C.cream}44`, fontSize:13 }}>טוען מפה…</div>}>
              <GovMapWidget
                gush={prop.gush}
                helka={prop.helka}
                subHelka={prop.subHelka}
                token={govmapToken}
                C={C}
                isDark={isDark}
              />
            </Suspense>
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
            <img src={imgs[lbIdx]} alt={prop.title} decoding="async" onError={imgFallback}
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
  const touchX = useRef(0)
  const touchMoved = useRef(false)
  const lastTouch = useRef(0)
  const touchFromArrow = useRef(false)

  return (
    <div
      // Ignore the click that some mobile browsers synthesize after a touch — the
      // touch handler already decided (so a scroll never opens a property).
      onClick={() => { if (Date.now() - lastTouch.current < 700) return; onSelect(prop) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; touchY.current = e.touches[0].clientY; touchMoved.current = false }}
      onTouchMove={e => {
        // Mark as a scroll/swipe the moment the finger travels > 10px in ANY
        // direction, so scrolling between properties never counts as a tap.
        if (Math.abs(e.touches[0].clientX - touchX.current) > 10 || Math.abs(e.touches[0].clientY - touchY.current) > 10) touchMoved.current = true
      }}
      onTouchEnd={e => {
        lastTouch.current = Date.now()
        if (touchFromArrow.current) { touchFromArrow.current = false; return }
        // Open ONLY on a genuine tap (no scroll/swipe in any axis). The old check
        // looked at vertical movement only, so a horizontal swipe opened a property.
        if (!touchMoved.current) { e.preventDefault(); onSelect(prop) }
      }}
      className="prop-card"
      style={{ touchAction:'manipulation' }}>

      {/* ── Image area ── */}
      <div className="prop-card-img">
        {validImages.length > 0 && !failedImgs.has(imgIdx % validImages.length) ? (
          <>
            <img src={validImages[imgIdx % validImages.length]} alt={prop.title}
              loading="lazy" decoding="async"
              style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', display:'block', transition:'transform .55s cubic-bezier(0.16,1,0.3,1)', transform:hovered?'scale(1.05)':'scale(1)' }}
              onError={e => {
                const el = e.currentTarget
                const orig = unproxyImg(el.src)
                if (orig !== el.src && !el.dataset.fellBack) { el.dataset.fellBack = '1'; el.src = orig; return }
                setFailedImgs(prev => new Set([...prev, imgIdx % validImages.length]))
              }}
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
            <img src={prop.status === 'נמכר' ? '/img/sold.webp' : '/img/rented.webp'} alt={prop.status} loading="lazy" decoding="async"
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
  const [govmapToken,  setGovmapToken]  = useState(() => {
    const stored = localStorage.getItem('govmap_token')
    if (stored) return stored
    const def = '402956e5-908c-4797-accd-7c7b19c7803a'
    localStorage.setItem('govmap_token', def)
    return def
  })
  const [logoNavSize,  setLogoNavSizeRaw] = useState(() => Number(localStorage.getItem('logoNavSize')) || 70)
  const setLogoNavSize = (v) => { const n = Math.max(20, Math.min(200, Number(v))); localStorage.setItem('logoNavSize', n); setLogoNavSizeRaw(n) }

  // Always persist govmapToken — guards against the standalone mode missing the wrapper
  useEffect(() => { localStorage.setItem('govmap_token', govmapToken) }, [govmapToken])

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

  // ── /admin-panel URL routing ──
  useEffect(() => {
    if (window.location.pathname.startsWith('/admin-panel')) {
      const alreadyAuth = sessionStorage.getItem('afik_admin_session') === '1'
      if (alreadyAuth) setShowAdmin(true)
      else setShowPw(true)
    }
    const onPop = () => {
      if (!window.location.pathname.startsWith('/admin-panel')) setShowAdmin(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, []) // eslint-disable-line

  useEffect(() => {
    if (showAdmin && adminAuth) {
      if (!window.location.pathname.startsWith('/admin-panel')) history.replaceState({}, '', '/admin-panel')
    } else {
      if (window.location.pathname.startsWith('/admin-panel')) history.replaceState({}, '', '/')
    }
  }, [showAdmin, adminAuth]) // eslint-disable-line

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
      // Public read goes through Vercel's CDN-cached /api/properties (instant, no
      // Render cold-start). Admins send a token → that endpoint bypasses the cache.
      fetch(`/api/properties`, { headers })
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
    const refresh = () => {
      const headers = adminAuth ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}
      // Public refresh hits Vercel's CDN-cached endpoint (instant, served from the
      // edge); admins send a token so they bypass the cache and get fresh data.
      fetch(`/api/properties`, { headers })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          if (!Array.isArray(data) || !data.length) return
          // Use same merge as initial fetch — never blindly overwrite optimistic updates
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
        })
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
      // NOTE: do NOT scroll the page here. The property modal is position:fixed and
      // covers the screen, so scrolling the page to the top is pointless — and it
      // dumped the user at the top/home after they closed a property (felt like a
      // "bounce to home", especially after a stray tap-open while scrolling the grid).
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
            <Suspense fallback={null}>
            <AdminPanel
              standalone={true}
              properties={properties}
              setProperties={setProperties}
              stats={stats}
              setStats={setStats}
              sharon={sharon}
              setSharon={setSharon}
              govmapToken={govmapToken}
              setGovmapToken={t => { setGovmapToken(t); localStorage.setItem('govmap_token', t) }}
              onClose={() => {
                sessionStorage.removeItem('afik_admin_session')
                window.location.href = '/'
              }}
              onEditInWizard={async p => {
                const { propertyToWizardData } = await import('./PropertyWizard.jsx')
                setWizardEditData(propertyToWizardData(p))
                setWizardEditId(p.id)
                setShowWizard(true)
              }}
            />
            </Suspense>
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
          <GlassCard style={{ padding:'32px 28px' }}>
            <h3 style={{ fontSize:21, fontWeight:800, color:C.cream, marginBottom:22, textAlign:'center', letterSpacing:'-.01em' }}>{TR[lang]?.contactNowBtn}</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:12, direction:'rtl' }}>

              {/* טלפון */}
              <a href="tel:0559811814" className="contact-card-row"
                style={{ display:'flex', flexDirection:'row', alignItems:'center', gap:14, background:`${C.green}12`, borderRadius:14, padding:'16px 18px', border:`1.5px solid ${C.green}28`, textDecoration:'none', color:'inherit', transition:'all .2s', cursor:'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background=`${C.green}22`; e.currentTarget.style.borderColor=`${C.green}55`; e.currentTarget.style.transform='translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.background=`${C.green}12`; e.currentTarget.style.borderColor=`${C.green}28`; e.currentTarget.style.transform='' }}>
                <div className="contact-card-icon" style={{ width:46, height:46, borderRadius:'50%', background:`linear-gradient(135deg,${C.green}33,${C.green}18)`, border:`1.5px solid ${C.green}44`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 4px 14px ${C.green}25` }}>
                  <FaPhone size={18} style={{ color:C.green }}/>
                </div>
                <div className="contact-card-text" style={{ flex:1, textAlign:'right' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:`${C.cream}60`, marginBottom:3, letterSpacing:'.04em', textTransform:'uppercase' }}>{TR[lang]?.phoneLabel}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:C.green, direction:'ltr', letterSpacing:'.01em' }}>055-981-1814</div>
                </div>
              </a>

              {/* WhatsApp */}
              <a href="https://wa.me/972559811814" target="_blank" rel="noopener noreferrer" className="contact-card-row"
                style={{ display:'flex', flexDirection:'row', alignItems:'center', gap:14, background:'rgba(37,211,102,.09)', borderRadius:14, padding:'16px 18px', border:'1.5px solid rgba(37,211,102,.22)', textDecoration:'none', color:'inherit', transition:'all .2s', cursor:'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(37,211,102,.2)'; e.currentTarget.style.borderColor='rgba(37,211,102,.5)'; e.currentTarget.style.transform='translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(37,211,102,.09)'; e.currentTarget.style.borderColor='rgba(37,211,102,.22)'; e.currentTarget.style.transform='' }}>
                <div className="contact-card-icon" style={{ width:46, height:46, borderRadius:'50%', background:'linear-gradient(135deg,rgba(37,211,102,.25),rgba(37,211,102,.12))', border:'1.5px solid rgba(37,211,102,.4)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 4px 14px rgba(37,211,102,.2)' }}>
                  <FaWhatsapp size={20} style={{ color:'#25D366' }}/>
                </div>
                <div className="contact-card-text" style={{ flex:1, textAlign:'right' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:`${C.cream}60`, marginBottom:3, letterSpacing:'.04em', textTransform:'uppercase' }}>WhatsApp</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#25D366' }}>{TR[lang]?.whatsappSend}</div>
                </div>
              </a>

              {/* אזור פעילות */}
              <div className="contact-card-row" style={{ display:'flex', flexDirection:'row', alignItems:'center', gap:14, background:`${C.purple}0D`, borderRadius:14, padding:'16px 18px', border:`1.5px solid ${C.purple}1E` }}>
                <div className="contact-card-icon" style={{ width:46, height:46, borderRadius:'50%', background:`linear-gradient(135deg,${C.purple}30,${C.purple}15)`, border:`1.5px solid ${C.purple}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 4px 14px ${C.purple}20` }}>
                  <FaMapMarkerAlt size={18} style={{ color:C.purple }}/>
                </div>
                <div className="contact-card-text" style={{ flex:1, textAlign:'right' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:`${C.cream}60`, marginBottom:3, letterSpacing:'.04em', textTransform:'uppercase' }}>{TR[lang]?.operatingAreaLabel}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:C.cream }}>{TR[lang]?.areaServed}</div>
                </div>
              </div>

              {/* CTA button */}
              <button onClick={() => openContact()}
                style={{ width:'100%', marginTop:4, padding:'17px 0', borderRadius:14, border:'none', cursor:'pointer', fontFamily:'Rubik, sans-serif', fontSize:17, fontWeight:800, color:'#fff', background:`linear-gradient(135deg,#8490D8,#6B7BE0)`, boxShadow:`0 6px 28px ${C.purple}55`, letterSpacing:'-.01em', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all .22s' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 12px 40px ${C.purple}70`; e.currentTarget.style.background='linear-gradient(135deg,#9AA4E8,#7B8EF0)' }}
                onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=`0 6px 28px ${C.purple}55`; e.currentTarget.style.background='linear-gradient(135deg,#8490D8,#6B7BE0)' }}>
                <FaEnvelope size={15}/> {TR[lang]?.sendMessageBtn}
              </button>

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
          <div className="footer-bottom" style={{ display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderTop:'1px solid rgba(132,144,216,.15)', paddingTop:18, gap:12 }}>

            {/* Right (RTL start): legal links */}
            <div className="footer-bottom-links" style={{ display:'flex', flexDirection:'row', alignItems:'center', flexWrap:'nowrap', gap:6, flexShrink:0 }}>
              <button onClick={() => window.open('/accessibility','_blank')}
                style={{ background:'none', border:'none', padding:'2px 0', margin:0, fontSize:12, color:C.purple, fontWeight:600, cursor:'pointer', opacity:.85, transition:'opacity .15s', fontFamily:'inherit', whiteSpace:'nowrap', lineHeight:1, display:'inline-flex', alignItems:'center' }}
                onMouseEnter={e => e.currentTarget.style.opacity='1'}
                onMouseLeave={e => e.currentTarget.style.opacity='.85'}>
                {TR[lang]?.accessibility}
              </button>
              <span style={{ color:'rgba(132,144,216,.28)', fontSize:12, lineHeight:1, userSelect:'none', flexShrink:0 }}>|</span>
              <button onClick={() => setShowPrivacy(true)}
                style={{ background:'none', border:'none', padding:'2px 0', margin:0, fontSize:12, color:'rgba(132,144,216,.75)', fontWeight:500, cursor:'pointer', opacity:.85, transition:'opacity .15s', fontFamily:'inherit', whiteSpace:'nowrap', lineHeight:1, display:'inline-flex', alignItems:'center' }}
                onMouseEnter={e => { e.currentTarget.style.opacity='1'; e.currentTarget.style.color=C.purple }}
                onMouseLeave={e => { e.currentTarget.style.opacity='.85'; e.currentTarget.style.color='rgba(132,144,216,.75)' }}>
                {TR[lang]?.privacy}
              </button>
            </div>

            {/* Center: copyright */}
            <div className="footer-bottom-copyright" style={{ flex:1, fontSize:11, color:'rgba(132,144,216,.35)', textAlign:'center', padding:'0 8px', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {TR[lang]?.copyright}
            </div>

            {/* Left (RTL end): lang + admin lock */}
            <div className="footer-bottom-actions" style={{ display:'flex', flexDirection:'row', alignItems:'center', gap:6, flexShrink:0 }}>
              <LangSwitch />
              <button onClick={() => adminAuth ? setShowAdmin(true) : setShowPw(true)} title="כניסת מנהל"
                style={{ background:'none', border:'none', color:'rgba(132,144,216,.18)', cursor:'pointer', transition:'color .2s', padding:'4px 6px', borderRadius:6, display:'inline-flex', alignItems:'center' }}
                onMouseEnter={e => e.currentTarget.style.color=C.purple}
                onMouseLeave={e => e.currentTarget.style.color='rgba(132,144,216,.18)'}><FaLock size={12}/></button>
            </div>
          </div>
        </div>
      </footer>

      {/* ── WHATSAPP FLOAT ───────────────────────────── */}
      {!(showAdmin && adminAuth) && (
        <a href="https://wa.me/972559811814" target="_blank" rel="noopener noreferrer" className="wa-float" title="שלח הודעה ב-WhatsApp" onClick={() => trackEvent('whatsapp_click', { src:'float_btn' })}>
          <WaIcon/>
        </a>
      )}

      {/* ── BACK TO TOP ─────────────────────────────── */}
      {!(showAdmin && adminAuth) && <BackToTop />}

      {/* ── MODALS ──────────────────────────────────── */}
      {showPw      && <PasswordPrompt onSuccess={() => { sessionStorage.setItem('afik_admin_session','1'); setAdminAuth(true); setShowPw(false); setShowAdmin(true) }} onClose={() => setShowPw(false)}/>}
      {showContact && <ContactModal  prop={contactProp} onClose={() => setShowContact(false)}/>}
      {showCalc    && <Suspense fallback={null}><RealEstateCalc onClose={() => setShowCalc(false)}/></Suspense>}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)}/>}
      {selectedProp && <PropertyModal key={selectedProp.id} prop={selectedProp} properties={properties} onClose={() => setSelectedProp(null)} onContact={p => { openContact(p) }} onSelect={setSelectedProp} govmapToken={govmapToken}/>}
      {showWizard && <Suspense fallback={null}><PropertyWizard
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
                signal: AbortSignal.timeout(30000),
              }).then(r => r.ok ? r.json() : Promise.reject(r.status))
                .then(body => {
                  console.log('[wizard] saved prop', savedProp.id, '→', body.storage)
                  // Re-fetch after confirmed save so UI reflects what the server actually stored
                  return fetch(`${base}/api/properties`, {
                    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
                  }).then(r => r.ok ? r.json() : Promise.reject())
                    .then(data => {
                      if (Array.isArray(data) && data.length > 0) {
                        setProperties(prev => {
                          if (!prev.length) return data
                          if (data.length < prev.length) return prev
                          const localById = new Map(prev.map(p => [String(p.id), p]))
                          return data.map(sp => {
                            const lp = localById.get(String(sp.id))
                            if (!lp) return sp
                            return ((sp.updatedAt || 0) >= (lp.updatedAt || 0)) ? { ...lp, ...sp } : lp
                          })
                        })
                      }
                    })
                })
                .catch(e => console.error('[wizard] save error:', e))
            }
          }}
        /></Suspense>}
      {showAdmin && adminAuth && (
        <Suspense fallback={null}>
        <AdminPanel
          properties={properties} setProperties={setProperties}
          stats={stats} setStats={setStats}
          sharon={sharon} setSharon={setSharon}
          govmapToken={govmapToken} setGovmapToken={setGovmapToken}
          onClose={() => setShowAdmin(false)}
          onEditInWizard={async p => {
            setShowAdmin(false)
            const { propertyToWizardData } = await import('./PropertyWizard.jsx')
            setWizardEditData(propertyToWizardData(p))
            setWizardEditId(p.id)
            setShowWizard(true)
          }}
        />
        </Suspense>
      )}

      {/* ── THEME TOGGLE ────────────────────────────── */}
      <CurtainThemeToggle/>

      {/* ── ACCESSIBILITY WIDGET — hidden when admin panel is open ── */}
      {!(showAdmin && adminAuth) && <AccessibilityWidget/>}

      {/* ── COOKIE CONSENT ──────────────────────────── */}
      <CookieConsent C={C} isDark={isDark}/>
    </>
    </ThemeCtx.Provider>
  )
}

// Shared with the lazily-loaded admin dashboard (src/AdminPanel.jsx)
export { TEAM_KEY, LeadsBoard, GreenAPIChat, MetaLeadsTab, SupermetricsTab, PropertyWizard, API_BASE, CONTACTS_API, ADMIN_TOKEN, DARK_C, useTheme, TEAM, G, Logo, LEADS_STORE, LEADS_DELETED, LEADS_TRASH, ANALYTICS_KEY, META_LEAD_PAGES_KEY, WA_DEFAULT_TEMPLATE, _cloudSettings, CATEGORIES, EMPTY_PROP, CONDITION_OPTIONS, ENTRY_OPTIONS, ADMIN_DRAFT_KEY, toMapsEmbed, imgFallback, thumbImg }
