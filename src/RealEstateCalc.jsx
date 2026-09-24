import { useState, useEffect, useRef, useId, createContext, useContext } from 'react'
import {
  FaTimes, FaHome, FaBalanceScale, FaHandshake, FaMoneyBill,
  FaExternalLinkAlt, FaChevronDown, FaMinus, FaPlus, FaCheck, FaExclamationTriangle, FaInfoCircle,
} from 'react-icons/fa'

// ── 2026 מדרגות מס רכישה (also in content/tools.mjs — update both every January) ──
const BRACKETS_FIRST = [
  { from: 0,          to: 2_058_000,  rate: 0     },
  { from: 2_058_000,  to: 2_441_000,  rate: 0.035 },
  { from: 2_441_000,  to: 6_297_000,  rate: 0.05  },
  { from: 6_297_000,  to: 20_991_000, rate: 0.08  },
  { from: 20_991_000, to: Infinity,   rate: 0.10  },
]
const BRACKETS_SECOND = [
  { from: 0,         to: 6_108_000, rate: 0.08 },
  { from: 6_108_000, to: Infinity,  rate: 0.10 },
]

const LTV = { first: 0.75, replacement: 0.70, second: 0.50 }

function calcTax(price, brackets) {
  let total = 0
  const details = []
  for (const b of brackets) {
    if (price <= b.from) break
    const taxable = Math.min(price, b.to) - b.from
    const amount  = taxable * b.rate
    details.push({ ...b, taxable, amount })
    total += amount
  }
  return { total: Math.round(total), details }
}

// ── Texts (Hebrew + English) ─────────────────────────────────────────────────
const T = {
  he: {
    kicker: 'כלי עזר לרוכשים ומשקיעים', title: 'מחשבון נדל״ן', close: 'סגירה',
    tabs: { tax: 'מס רכישה', ltv: 'משכנתא', tabu: 'טאבו / רמ״י', rental: 'זכויות שוכר' },
    price: 'מחיר הנכס', priceHint: 'הקלידו מחיר או בחרו סכום מהיר',
    buyer: 'סוג הרוכש',
    buyerFirst: 'דירה ראשונה / יחידה', buyerFirstSub: 'מדרגות מופחתות',
    buyerSecond: 'דירה נוספת / משקיע', buyerSecondSub: 'מ-8% מהשקל הראשון',
    taxIntro: 'חישוב מס רכישה לפי מדרגות 2026.',
    taxTotal: 'סה״כ מס רכישה', effRate: 'שיעור מס אפקטיבי', exempt: 'פטור ממס',
    brackets: 'פירוט לפי מדרגות', taxable: 'חייב במס', upTo: 'עד', above: 'מעל',
    taxNote: 'מדרגות 2026, לצורך הערכה בלבד. יש לאמת מול רשות המסים.',
    emptyPrice: 'הזינו מחיר נכס כדי לראות את החישוב',
    ltvIntro: 'כמה משכנתא אפשר לקבל, כמה הון עצמי צריך ומה יהיה ההחזר החודשי — לפי כללי בנק ישראל.',
    purchase: 'סוג הרכישה',
    ltvFirst: 'דירה ראשונה', ltvFirstNote: 'עד 75% מימון',
    ltvRepl: 'דירה חלופית', ltvReplNote: 'עד 70% · מכירת הדירה הקיימת תוך 18 חודשים',
    ltvSecond: 'דירה נוספת / השקעה', ltvSecondNote: 'עד 50% מימון',
    equity: 'הון עצמי', loanShare: 'משכנתא', equityShare: 'הון עצמי',
    eqAtMin: m => `${m}% — המינימום הנדרש לסוג רכישה זה.`,
    equityCash: 'כמה הון עצמי יש לכם?', equityCashHint: 'הקלידו סכום — או קבעו אחוז בסליידר למטה',
    eqPct: 'הון עצמי כאחוז מהמחיר',
    eqShort: (gap, m) => `חסרים ${gap} כדי להגיע למינימום של ${m}% הון עצמי. החישוב מוצג לפי המינימום.`,
    eqNoLoan: 'ההון העצמי מכסה את כל המחיר — אין צורך במשכנתא.',
    eqCanBuy: (cash, max, f) => `עם ${cash} הון עצמי אפשר לרכוש נכס עד ${max} (לפי ${f}% מימון).`,
    maxPrice: 'מחיר נכס מקסימלי', byEquity: f => `לפי ההון העצמי ו-${f}% מימון`, byIncome: 'מוגבל לפי ההכנסה (החזר עד 35%)',
    maxHint: 'הזינו מחיר נכס כדי לראות חישוב מלא',
    eqGood: 'הון עצמי גבוה — סיכוי לריבית טובה יותר ופחות סיכון.',
    income: 'הכנסה חודשית נטו (משק בית)', optional: 'רשות',
    rate: 'ריבית שנתית', years: 'תקופת המשכנתא', yearsUnit: 'שנים',
    less: 'הפחתה', more: 'הוספה',
    loan: 'סכום המשכנתא', ofPrice: 'ממחיר הנכס', underCap: 'מתחת לתקרה',
    equityNeeded: 'הון עצמי נדרש', extraCosts: 'בנוסף: מס רכישה, עו״ד ותיווך',
    monthly: 'החזר חודשי משוער', ofIncome: 'מההכנסה', ratioOk: 'יחס החזר תקין', ratioHigh: 'גבוה מ-35% — הבנק עלול להגביל',
    totalPaid: 'סה״כ תשלומים', totalInterest: 'מתוכם ריבית', estTax: 'מס רכישה משוער',
    ltvNote: 'לפי כללי בנק ישראל ובמסלול שפיצר בריבית קבועה. התנאים בפועל נקבעים על ידי הבנק.',
    tabuIntro: 'ההבדל בין נכס רשום בטאבו לנכס בחכירה מרשות מקרקעי ישראל — חשוב לבדוק לפני כל עסקה.',
    tabuTitle: 'טאבו — פנקס המקרקעין',
    tabuItems: ['בעלות פרטית מלאה, רשומה על שם הקונה', 'אפשר למכור, להוריש ולשעבד ללא הגבלה', 'אין דמי חכירה שנתיים למדינה', 'רישום בלשכת רישום המקרקעין', 'אפשר להפיק נסח טאבו מקוון'],
    ramiTitle: 'רמ״י — חכירה מהמדינה',
    ramiItems: ['הקרקע בבעלות מדינת ישראל', 'הרוכש מקבל זכות חכירה ל-49 או 98 שנה', 'בשינוי ייעוד עשויים לחול דמי היתר', 'מכירה עשויה לדרוש אישור רמ״י', 'חלק מהחוזים כוללים דמי חכירה שנתיים'],
    howTitle: 'איך בודקים? נסח טאבו',
    howText: 'נסח טאבו מראה מי הבעלים הרשום, האם יש משכנתאות, שעבודים או הערות אזהרה, ומה מצב הזכויות בנכס. אפשר להפיק אותו באתר gov.il.',
    links: [['מאגר עסקאות נדל״ן — רשות המסים', 'https://www.gov.il/he/service/real_estate_information'], ['מחירי נדל״ן — מדלן', 'https://www.madlan.co.il'], ['הפקת נסח טאבו', 'https://www.gov.il/he/service/land_registration_extract']],
    newTab: '(נפתח בלשונית חדשה)',
    rentalIntro: 'חוק השכירות ההוגנת — הזכויות והחובות של שוכר ומשכיר.',
    rental: [
      { title: 'חובות המשכיר', tone: 'green', items: [
        ['מסירת דירה ראויה למגורים', 'על המשכיר למסור דירה תקינה, העומדת בתקני בטיחות ובריאות.'],
        ['תיקון ליקויים', 'ליקוי שמונע מגורים סבירים יתוקן תוך 30 יום; ליקוי דחוף — תוך 3 ימים.'],
        ['הודעה מוקדמת', 'משכיר שלא מאריך חוזה מודיע 90 יום מראש; שוכר — 60 יום.'],
      ] },
      { title: 'זכויות השוכר', tone: 'brand', items: [
        ['הגנה מפני פינוי שרירותי', 'אי אפשר לפנות שוכר ללא הליך משפטי.'],
        ['עליית שכר דירה', 'בתקופת אופציה — לפי מה שנקבע מראש בחוזה.'],
        ['ביטחונות מוגבלים', 'עד 3 חודשי שכירות או שליש משכר הדירה לכל התקופה — הנמוך מביניהם.'],
      ] },
      { title: 'לפני שחותמים', tone: 'amber', items: [
        ['בדקו בעלות', 'בקשו נסח טאבו וודאו שהמשכיר הוא הבעלים הרשום או מורשה מטעמו.'],
        ['מה כלול בשכר הדירה', 'ארנונה, ועד בית, מים וגז — מי משלם? שיהיה כתוב בחוזה.'],
        ['פרוטוקול מסירה', 'צלמו כל ליקוי לפני הכניסה וחתמו יחד על פרוטוקול.'],
      ] },
    ],
    summaryTax: 'מס רכישה', summaryLtv: 'החזר חודשי', toDetails: 'לפירוט',
  },
  en: {
    kicker: 'Tools for buyers & investors', title: 'Real estate calculator', close: 'Close',
    tabs: { tax: 'Purchase tax', ltv: 'Mortgage', tabu: 'Tabu / ILA', rental: 'Tenant rights' },
    price: 'Property price', priceHint: 'Type a price or pick a quick amount',
    buyer: 'Buyer type',
    buyerFirst: 'First / only home', buyerFirstSub: 'Reduced brackets',
    buyerSecond: 'Additional home / investor', buyerSecondSub: '8% from the first shekel',
    taxIntro: 'Purchase tax by the 2026 brackets.',
    taxTotal: 'Total purchase tax', effRate: 'Effective tax rate', exempt: 'Tax-exempt',
    brackets: 'Breakdown by bracket', taxable: 'taxable', upTo: 'up to', above: 'above',
    taxNote: '2026 brackets, for estimation only. Verify with the Israel Tax Authority.',
    emptyPrice: 'Enter a property price to see the calculation',
    ltvIntro: 'How much mortgage you can get, the equity you need and your monthly payment, by Bank of Israel rules.',
    purchase: 'Purchase type',
    ltvFirst: 'First home', ltvFirstNote: 'Up to 75% financing',
    ltvRepl: 'Replacement home', ltvReplNote: 'Up to 70% · current home sold within 18 months',
    ltvSecond: 'Additional home / investment', ltvSecondNote: 'Up to 50% financing',
    equity: 'Equity', loanShare: 'Mortgage', equityShare: 'Equity',
    eqAtMin: m => `${m}% — the minimum for this purchase type.`,
    equityCash: 'How much equity do you have?', equityCashHint: 'Type an amount — or set a percentage with the slider below',
    eqPct: 'Equity as a share of the price',
    eqShort: (gap, m) => `You are ${gap} short of the ${m}% minimum equity. The calculation uses the minimum.`,
    eqNoLoan: 'Your equity covers the full price — no mortgage needed.',
    eqCanBuy: (cash, max, f) => `With ${cash} in equity you can buy a property of up to ${max} (at ${f}% financing).`,
    maxPrice: 'Maximum property price', byEquity: f => `By your equity at ${f}% financing`, byIncome: 'Limited by income (repayment up to 35%)',
    maxHint: 'Enter a property price for the full calculation',
    eqGood: 'Higher equity — a better rate and less risk.',
    income: 'Net monthly household income', optional: 'optional',
    rate: 'Annual interest rate', years: 'Mortgage term', yearsUnit: 'years',
    less: 'Decrease', more: 'Increase',
    loan: 'Mortgage amount', ofPrice: 'of the price', underCap: 'below the cap',
    equityNeeded: 'Equity required', extraCosts: 'Plus: purchase tax, lawyer and agent fees',
    monthly: 'Estimated monthly payment', ofIncome: 'of income', ratioOk: 'Healthy repayment ratio', ratioHigh: 'Above 35% — the bank may limit it',
    totalPaid: 'Total payments', totalInterest: 'of which interest', estTax: 'Estimated purchase tax',
    ltvNote: 'Bank of Israel rules, fixed-rate amortising (Spitzer) loan. Actual terms are set by your bank.',
    tabuIntro: 'Tabu-registered ownership vs. a lease from the Israel Land Authority (ILA) — check before any deal.',
    tabuTitle: 'Tabu — Land Registry',
    tabuItems: ['Full private ownership, registered to the buyer', 'Free to sell, bequeath or mortgage', 'No annual lease fees to the state', 'Registered at the Land Registry office', 'A Tabu extract can be ordered online'],
    ramiTitle: 'ILA — state lease',
    ramiItems: ['The land belongs to the State of Israel', 'The buyer receives a 49- or 98-year lease', 'Change of use may carry permit fees', 'A sale may need ILA approval', 'Some contracts include annual lease fees'],
    howTitle: 'How to check: a Tabu extract',
    howText: 'A Tabu extract shows the registered owner, any mortgages, liens or caveats, and the state of the rights in the property. Order it on gov.il.',
    links: [['Real estate deals database — Tax Authority', 'https://www.gov.il/he/service/real_estate_information'], ['Property prices — Madlan', 'https://www.madlan.co.il'], ['Order a Tabu extract', 'https://www.gov.il/he/service/land_registration_extract']],
    newTab: '(opens in a new tab)',
    rentalIntro: 'The Fair Rental Law — rights and duties of tenants and landlords.',
    rental: [
      { title: "Landlord's duties", tone: 'green', items: [
        ['A habitable home', 'The landlord must hand over a sound home that meets safety and health standards.'],
        ['Repairs', 'A defect that prevents reasonable living must be fixed within 30 days; an urgent one within 3 days.'],
        ['Advance notice', 'A landlord not renewing gives 90 days’ notice; a tenant gives 60 days.'],
      ] },
      { title: "Tenant's rights", tone: 'brand', items: [
        ['No arbitrary eviction', 'A tenant cannot be evicted without legal proceedings.'],
        ['Rent increases', 'During an option period — only as agreed in advance in the contract.'],
        ['Limited deposits', 'Up to 3 months’ rent or a third of the rent for the whole term, whichever is lower.'],
      ] },
      { title: 'Before you sign', tone: 'amber', items: [
        ['Check ownership', 'Get a Tabu extract and make sure the landlord is the registered owner or authorised.'],
        ['What the rent covers', 'Municipal tax, building fees, water and gas — who pays? Put it in the contract.'],
        ['Handover protocol', 'Photograph every defect before moving in and sign a protocol together.'],
      ] },
    ],
    summaryTax: 'Purchase tax', summaryLtv: 'Monthly payment', toDetails: 'Details',
  },
}

const TAB_ICONS = { tax: FaMoneyBill, ltv: FaHome, tabu: FaBalanceScale, rental: FaHandshake }
const TAB_IDS = ['tax', 'ltv', 'tabu', 'rental']

// Colors: every text/background pair here is ≥ 4.5:1 (AA), large numbers ≥ 7:1.
const PALETTE = {
  dark: {
    overlay: 'rgba(4,4,12,.72)', bg: '#151624', panel: '#1C1E30', raised: '#24273C', input: '#10111C',
    line: 'rgba(255,255,255,.14)', lineStrong: 'rgba(255,255,255,.28)',
    text: '#F3F1EA', text2: '#CDCBD8', text3: '#A9A7BA',
    brand: '#A5AEF5', brandFill: '#4F59BE', brandSoft: 'rgba(132,144,216,.16)', brandLine: 'rgba(165,174,245,.55)',
    green: '#7EE2A2', greenSoft: 'rgba(126,226,162,.12)', greenLine: 'rgba(126,226,162,.45)',
    amber: '#F5C66B', amberSoft: 'rgba(245,198,107,.12)', amberLine: 'rgba(245,198,107,.45)',
    track: 'rgba(255,255,255,.14)', shadow: '0 30px 80px rgba(0,0,0,.6)',
  },
  light: {
    overlay: 'rgba(20,22,45,.45)', bg: '#F5F5F9', panel: '#FFFFFF', raised: '#EEEFF6', input: '#FFFFFF',
    line: 'rgba(23,26,44,.14)', lineStrong: 'rgba(23,26,44,.3)',
    text: '#171A2C', text2: '#3C4160', text3: '#555B7A',
    brand: '#3A44A0', brandFill: '#3F49A6', brandSoft: 'rgba(63,73,166,.09)', brandLine: 'rgba(63,73,166,.55)',
    green: '#136B34', greenSoft: 'rgba(21,128,61,.08)', greenLine: 'rgba(21,128,61,.4)',
    amber: '#8A4B00', amberSoft: 'rgba(180,110,0,.09)', amberLine: 'rgba(180,110,0,.4)',
    track: 'rgba(23,26,44,.14)', shadow: '0 30px 80px rgba(20,24,60,.25)',
  },
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function useCountUp(end, duration = 600) {
  const [val, setVal] = useState(end)
  const raf = useRef(null)
  const from = useRef(end)
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    if (reduceMotion() || !end) { setVal(end); from.current = end; return }
    const start = from.current, t0 = performance.now()
    const tick = now => {
      const p = Math.min((now - t0) / duration, 1)
      const v = Math.round(start + (end - start) * (1 - Math.pow(1 - p, 3)))
      setVal(v); from.current = v
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [end, duration])
  return val
}

const digits = raw => String(raw).replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '').slice(0, 11)
const withCommas = d => d.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
// Quick-amount labels: ₪1.5M / ₪15K in English, natural Hebrew (1.5 מיליון / 15 אלף) in Hebrew
const short = (n, en) => n >= 1_000_000 ? (en ? `₪${n / 1_000_000}M` : `${n / 1_000_000} מיליון`) : (en ? `₪${n / 1_000}K` : `${n / 1_000} אלף`)


// ── Building blocks (module level so inputs keep focus between renders) ──
const CalcCtx = createContext(null)

function Label({ htmlFor, id, children, extra }) {
  const { P, t, en, uid } = useContext(CalcCtx)
  return (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
    {htmlFor
      ? <label htmlFor={htmlFor} id={id} style={{ fontSize: 14.5, fontWeight: 700, color: P.text }}>{children}</label>
      : <div id={id} style={{ fontSize: 14.5, fontWeight: 700, color: P.text }}>{children}</div>}
    {extra}
  </div>
)
}

function MoneyField({ id, value, onChange, placeholder, describedBy, onFocus, onBlur }) {
  const { P, t, en, uid } = useContext(CalcCtx)
  return (
  <div className="rcx-field" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 56, padding: '0 16px', background: P.input, border: `1.5px solid ${P.lineStrong}`, borderRadius: 14, direction: 'ltr', transition: 'border-color .15s, box-shadow .15s' }}>
    <span aria-hidden="true" style={{ color: P.text3, fontSize: 18, fontWeight: 600 }}>₪</span>
    <input id={id} type="text" inputMode="numeric" autoComplete="off" enterKeyHint="done"
      value={value ? withCommas(value) : ''} onChange={e => onChange(digits(e.target.value))}
      placeholder={placeholder} aria-describedby={describedBy} onFocus={onFocus} onBlur={onBlur}
      style={{ flex: 1, minWidth: 0, height: '100%', background: 'transparent', border: 'none', outline: 'none', color: P.text, fontSize: 20, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '.01em' }}/>
    {value && (
      <button type="button" className="rcx-btn" onClick={() => onChange('')} aria-label={en ? 'Clear' : 'ניקוי'}
        style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: P.text3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FaTimes size={13}/>
      </button>
    )}
  </div>
)
}

function Chips({ values, current, onPick, label }) {
  const { P, t, en, uid } = useContext(CalcCtx)
  return (
  <div role="group" aria-label={label} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
    {values.map(v => {
      const on = Number(current) === v
      return (
        <button key={v} type="button" className="rcx-btn rcx-chip" onClick={() => onPick(String(v))} aria-pressed={on}
          style={{ minHeight: 40, padding: '0 14px', borderRadius: 999, border: `1.5px solid ${on ? P.brand : P.line}`, background: on ? P.brandSoft : 'transparent', color: on ? P.brand : P.text2, fontSize: 14, fontWeight: 700 }}>
          {short(v, en)}
        </button>
      )
    })}
  </div>
)

// A choice group rendered as big radio cards
}

function Options({ name, label, value, onChange, options }) {
  const { P, t, en, uid } = useContext(CalcCtx)
  return (
  <fieldset style={{ border: 'none', padding: 0, margin: '0 0 22px' }}>
    <legend style={{ fontSize: 14.5, fontWeight: 700, color: P.text, marginBottom: 8, padding: 0 }}>{label}</legend>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${options.length > 2 ? 150 : 170}px, 1fr))`, gap: 10 }}>
      {options.map(o => {
        const on = value === o.v
        return (
          <label key={o.v} className="rcx-opt" style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 14px', minHeight: 64, borderRadius: 14, cursor: 'pointer', border: `1.5px solid ${on ? P.brand : P.line}`, background: on ? P.brandSoft : P.panel }}>
            <input type="radio" name={`${uid}-${name}`} value={o.v} checked={on} onChange={() => onChange(o.v)}
              style={{ position: 'absolute', opacity: 0, inset: 0, margin: 0, cursor: 'pointer' }}/>
            <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, width: 20, height: 20, borderRadius: '50%', border: `2px solid ${on ? P.brand : P.lineStrong}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {on && <span style={{ width: 10, height: 10, borderRadius: '50%', background: P.brand }}/>}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: P.text, lineHeight: 1.35 }}>{o.t}</span>
              <span style={{ display: 'block', fontSize: 13, color: on ? P.brand : P.text3, marginTop: 3, lineHeight: 1.4, fontWeight: on ? 600 : 400 }}>{o.sub}</span>
            </span>
          </label>
        )
      })}
    </div>
  </fieldset>
)

// Slider + −/+ steppers + a large live value. Works with touch, mouse and keyboard.
}

function Slider({ id, label, value, setValue, min, max, step, unit, color, marks, format = v => v }) {
  const { P, t, en, uid } = useContext(CalcCtx)
  const pct = (value - min) / (max - min) * 100
  const clamp = v => Math.min(max, Math.max(min, Math.round(v / step) * step))
  const fix = v => Number(clamp(v).toFixed(step < 1 ? 1 : 0))
  const fillDir = en ? 'to right' : 'to left'
  return (
    <div style={{ marginBottom: 22 }}>
      <Label htmlFor={id}>{label}</Label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="rcx-btn rcx-step" aria-label={`${t.less} — ${label}`} disabled={value <= min} onClick={() => setValue(fix(value - step))}
          style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: `1.5px solid ${P.line}`, background: P.panel, color: P.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FaMinus size={12}/>
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 26, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }} aria-hidden="true">
          {format(value)}<span style={{ fontSize: 15, fontWeight: 600, color: P.text2, marginInlineStart: 4 }}>{unit}</span>
        </div>
        <button type="button" className="rcx-btn rcx-step" aria-label={`${t.more} — ${label}`} disabled={value >= max} onClick={() => setValue(fix(value + step))}
          style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: `1.5px solid ${P.line}`, background: P.panel, color: P.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FaPlus size={12}/>
        </button>
      </div>
      <input id={id} type="range" className="rcx-range" min={min} max={max} step={step} value={value}
        onChange={e => setValue(Number(e.target.value))} aria-valuetext={`${format(value)} ${unit}`}
        style={{ marginTop: 10, direction: en ? 'ltr' : 'rtl', '--c': color, '--fill': `linear-gradient(${fillDir}, ${color} ${pct}%, ${P.track} ${pct}%)` }}/>
      {marks && (
        <div role="group" aria-label={label} style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {marks.map(m => {
            const on = value === m
            return (
              <button key={m} type="button" className="rcx-btn rcx-chip" aria-pressed={on} onClick={() => setValue(m)}
                style={{ flex: 1, minWidth: 0, minHeight: 40, borderRadius: 10, border: `1.5px solid ${on ? color : P.line}`, background: on ? P.raised : 'transparent', color: on ? P.text : P.text2, fontSize: 14, fontWeight: 700 }}>
                {format(m)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, sub, color, soft, line, big, icon }) {
  const { P, t, en, uid } = useContext(CalcCtx)
  return (
  <div style={{ background: soft, border: `1.5px solid ${line}`, borderRadius: 16, padding: '16px 18px' }}>
    <div style={{ fontSize: 14, fontWeight: 600, color: P.text2, marginBottom: 6 }}>{label}</div>
    <div className={big ? 'rcx-big' : undefined} style={{ fontSize: big ? 40 : 30, fontWeight: 800, color, lineHeight: 1.1, direction: 'ltr', textAlign: en ? 'left' : 'right', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {sub && <div style={{ fontSize: 14, color: P.text2, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.45 }}>{icon}{sub}</div>}
  </div>
)
}

function Note({ children }) {
  const { P, t, en, uid } = useContext(CalcCtx)
  return (
  <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: P.text3, lineHeight: 1.55, margin: '14px 0 0' }}>
    <FaInfoCircle size={13} style={{ flexShrink: 0, marginTop: 3 }} aria-hidden="true"/>{children}
  </p>
)
}

function Empty({ Icon }) {
  const { P, t, en, uid } = useContext(CalcCtx)
  return (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '40px 16px', textAlign: 'center', border: `1.5px dashed ${P.line}`, borderRadius: 16, background: P.panel }}>
    <div style={{ width: 60, height: 60, borderRadius: '50%', background: P.brandSoft, color: P.brand, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={24} aria-hidden="true"/></div>
    <div style={{ fontSize: 15, color: P.text2, maxWidth: 260, lineHeight: 1.5 }}>{t.emptyPrice}</div>
  </div>
)
}

function Intro({ children }) {
  const { P, t, en, uid } = useContext(CalcCtx)
  return <p style={{ fontSize: 15, color: P.text2, lineHeight: 1.65, margin: '0 0 20px' }}>{children}</p>
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RealEstateCalc({ onClose, lang = 'he', isDark = true }) {
  const en = lang === 'en'
  const t = T[en ? 'en' : 'he']
  const P = PALETTE[isDark ? 'dark' : 'light']
  const uid = useId().replace(/:/g, '')
  const fmt = n => Math.round(n).toLocaleString(en ? 'en-US' : 'he-IL')
  const money = n => `₪${fmt(n)}`
  const ctx = { P, t, en, uid, money }

  const [tab,       setTab]       = useState('tax')
  const [price,     setPrice]     = useState('')        // shared by the tax and mortgage tabs
  const [buyer,     setBuyer]     = useState('first')
  const [ltvType,   setLtvType]   = useState('first')
  const [equityPct, setEquityPct] = useState(25)        // used when the slider is the source
  const [equityCash, setEquityCash] = useState('')       // the amount the buyer actually has (source when typed)
  const [cashEditing, setCashEditing] = useState(false)  // while focused the field shows exactly what's typed
  const [income,    setIncome]    = useState('')
  const [rate,      setRate]      = useState(4.8)
  const [years,     setYears]     = useState(25)
  const [openAcc,   setOpenAcc]   = useState(0)

  const dialogRef  = useRef(null)
  const bodyRef    = useRef(null)
  const resultsRef = useRef(null)
  const tabRefs    = useRef({})

  // Body scroll lock, Escape to close, focus into the dialog and back to the opener on close.
  // Runs once: onClose is read through a ref (the parent passes a new function on every render).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    const onClose = () => onCloseRef.current()
    const prevOverflow = document.body.style.overflow
    const opener = document.activeElement
    document.body.style.overflow = 'hidden'
    const onKey = e => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab' && dialogRef.current) {           // keep keyboard focus inside the dialog
        const f = [...dialogRef.current.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null)
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => tabRefs.current.tax?.focus())
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      try { opener?.focus?.() } catch {}
    }
  }, [])

  useEffect(() => { bodyRef.current?.scrollTo?.({ top: 0 }) }, [tab])

  // ── Calculations ──
  const priceNum  = Number(price || 0)
  const incomeNum = Number(income || 0)
  const taxRes    = priceNum > 0 ? calcTax(priceNum, buyer === 'first' ? BRACKETS_FIRST : BRACKETS_SECOND) : null
  // Equity: either the ₪ amount the buyer typed, or a % from the slider. Never below the Bank of
  // Israel minimum for the purchase type (25% / 30% / 50%) — a shortfall is shown, not financed.
  const maxLtv    = LTV[ltvType]
  const minPct    = Math.round((1 - maxLtv) * 100)
  const cashNum   = Number(equityCash || 0)
  const cashMode  = cashNum > 0
  const minEquity = priceNum * (1 - maxLtv)
  const equity    = cashMode ? Math.max(minEquity, Math.min(cashNum, priceNum)) : priceNum * Math.max(equityPct, minPct) / 100
  const shortfall = cashMode && priceNum > 0 ? Math.max(0, minEquity - cashNum) : 0
  const loan      = Math.max(0, priceNum - equity)
  const ltvRatio  = priceNum > 0 ? loan / priceNum : 0
  const eqPctNow  = priceNum > 0 ? Math.round(equity / priceNum * 100) : (cashMode ? minPct : Math.max(equityPct, minPct))
  const r         = rate / 100 / 12
  const n         = years * 12
  const annuity   = r > 0 ? r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) : 1 / n
  const monthly   = loan > 0 ? loan * annuity : 0
  // No price yet but equity typed: the most the buyer can buy (equity at max LTV, and — with an
  // income — a loan whose repayment stays within 35% of it)
  const maxByEquity = cashMode ? cashNum / (1 - maxLtv) : 0
  const maxLoanInc  = incomeNum > 0 ? incomeNum * 0.35 / annuity : Infinity
  const maxPrice    = cashMode ? Math.min(maxByEquity, cashNum + maxLoanInc) : 0
  const maxByInc    = cashMode && cashNum + maxLoanInc < maxByEquity
  const ratio     = incomeNum > 0 ? monthly / incomeNum : 0
  const ratioHigh = ratio > 0.35
  const estTax    = priceNum > 0 ? calcTax(priceNum, ltvType === 'second' ? BRACKETS_SECOND : BRACKETS_FIRST).total : 0

  const aTax     = useCountUp(taxRes?.total || 0)
  const aLoan    = useCountUp(Math.round(loan))
  const aEquity  = useCountUp(Math.round(equity))
  const aMax     = useCountUp(Math.round(maxPrice))
  const aMonthly = useCountUp(Math.round(monthly))

  const onTabKey = e => {
    const i = TAB_IDS.indexOf(tab)
    const dir = e.key === 'ArrowLeft' ? (en ? -1 : 1) : e.key === 'ArrowRight' ? (en ? 1 : -1) : 0
    let next = null
    if (dir) next = TAB_IDS[(i + dir + TAB_IDS.length) % TAB_IDS.length]
    if (e.key === 'Home') next = TAB_IDS[0]
    if (e.key === 'End') next = TAB_IDS[TAB_IDS.length - 1]
    if (next) { e.preventDefault(); setTab(next); tabRefs.current[next]?.focus() }
  }

  const summary = tab === 'tax' && taxRes
    ? { label: t.summaryTax, value: taxRes.total ? money(aTax) : t.exempt, sub: taxRes.total ? `${(taxRes.total / priceNum * 100).toFixed(2)}%` : '' }
    : tab === 'ltv' && priceNum > 0 && monthly > 0
      ? { label: t.summaryLtv, value: money(aMonthly), sub: `${t.loanShare} ${money(loan)}` }
      : null

  const css = `
    .rcx, .rcx * { box-sizing: border-box; }
    .rcx { font-family: Rubik, Heebo, system-ui, sans-serif; }
    .rcx :focus { outline: none; }
    .rcx :focus-visible { outline: 3px solid ${P.brand}; outline-offset: 2px; border-radius: 10px; }
    .rcx-btn { font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .rcx-tab:hover { color: ${P.text} !important; background: ${P.brandSoft} !important; }
    .rcx-opt { transition: border-color .15s, background .15s; }
    .rcx-opt:hover { border-color: ${P.brandLine} !important; }
    .rcx-chip { transition: background .15s, border-color .15s, color .15s; }
    .rcx-chip:hover { border-color: ${P.brandLine} !important; color: ${P.text} !important; }
    .rcx-step:hover:not(:disabled) { background: ${P.brandSoft} !important; }
    .rcx-step:disabled { opacity: .4; cursor: default; }
    .rcx-field:focus-within { border-color: ${P.brand} !important; box-shadow: 0 0 0 3px ${P.brandSoft}; }
    .rcx-field input::placeholder { color: ${P.text3}; opacity: .75; }
    .rcx-close:hover { background: ${P.raised} !important; color: ${P.text} !important; }
    .rcx-link:hover { background: ${P.brandSoft} !important; }
    .rcx-acc:hover { background: ${P.raised} !important; }

    .rcx-range { -webkit-appearance: none; appearance: none; width: 100%; height: 28px; background: transparent; cursor: pointer; margin: 0; display: block; touch-action: pan-y; }
    .rcx-range::-webkit-slider-runnable-track { height: 8px; border-radius: 8px; background: var(--fill); }
    .rcx-range::-moz-range-track { height: 8px; border-radius: 8px; background: var(--fill); }
    .rcx-range::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; margin-top: -9px; border-radius: 50%; background: #fff; border: 3px solid var(--c); box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    .rcx-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 3px solid var(--c); box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    .rcx-range:focus-visible { outline: none; }
    .rcx-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 5px ${P.brandSoft}, 0 0 0 7px var(--c); }
    .rcx-range:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 5px ${P.brandSoft}, 0 0 0 7px var(--c); }

    @keyframes rcxIn { from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: none; } }
    @keyframes rcxFade { from { opacity: 0; } to { opacity: 1; } }
    .rcx-dialog { animation: rcxIn .28s cubic-bezier(.16,1,.3,1) both; }
    .rcx-pane { animation: rcxFade .2s ease both; }

    .rcx-grid { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(0, 1fr); gap: 28px; align-items: start; }
    .rcx-results { position: sticky; top: 0; }
    .rcx-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .rcx-summary { display: none; }
    @media (max-width: 760px) {
      .rcx-overlay { padding: 0 !important; align-items: stretch !important; }
      .rcx-dialog { max-width: none !important; max-height: none !important; height: 100% !important; border-radius: 0 !important; border: none !important; }
      .rcx-grid { grid-template-columns: 1fr; gap: 20px; }
      .rcx-results { position: static; }
      .rcx-two { grid-template-columns: 1fr; }
      .rcx-head { padding: 14px 16px 12px !important; }
      .rcx-tabs { padding: 0 8px !important; }
      .rcx-tab { min-width: 0 !important; padding: 10px 4px !important; }
      .rcx-tab span { font-size: 12.5px !important; white-space: normal !important; line-height: 1.2; text-align: center; }
      .rcx-body { padding: 16px 16px 84px !important; }   /* room above the site's accessibility button */
      .rcx-summary { display: flex; }
      .rcx-big { font-size: 34px !important; }
    }
    @media (prefers-reduced-motion: reduce) { .rcx-dialog, .rcx-pane { animation: none; } }
  `

  const tone = k => ({ green: [P.green, P.greenSoft, P.greenLine], brand: [P.brand, P.brandSoft, P.brandLine], amber: [P.amber, P.amberSoft, P.amberLine] }[k])

  // ── Tabs content ──
  const priceField = (
    <div style={{ marginBottom: 22 }}>
      <Label htmlFor={`${uid}-price`}>{t.price}</Label>
      <MoneyField id={`${uid}-price`} value={price} onChange={setPrice} placeholder={en ? '2,000,000' : '2,000,000'} describedBy={`${uid}-price-hint`}/>
      <div id={`${uid}-price-hint`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t.priceHint}</div>
      <Chips values={[1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000]} current={price} onPick={setPrice} label={t.priceHint}/>
    </div>
  )

  const taxPane = (
    <div className="rcx-grid">
      <div>
        <Intro>{t.taxIntro}</Intro>
        <Options name="buyer" label={t.buyer} value={buyer} onChange={setBuyer} options={[
          { v: 'first', t: t.buyerFirst, sub: t.buyerFirstSub },
          { v: 'second', t: t.buyerSecond, sub: t.buyerSecondSub },
        ]}/>
        {priceField}
      </div>
      <div className="rcx-results" ref={resultsRef} aria-live="polite">
        {taxRes ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Stat big label={t.taxTotal} value={taxRes.total ? money(aTax) : t.exempt}
              color={taxRes.total ? P.brand : P.green} soft={taxRes.total ? P.brandSoft : P.greenSoft} line={taxRes.total ? P.brandLine : P.greenLine}
              sub={taxRes.total ? `${t.effRate}: ${(taxRes.total / priceNum * 100).toFixed(2)}%` : null}/>
            <div style={{ background: P.panel, border: `1.5px solid ${P.line}`, borderRadius: 16, padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 10 }}>{t.brackets}</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {taxRes.details.map((d, i) => {
                  const free = d.rate === 0
                  const range = d.to === Infinity ? `${t.above} ${money(d.from)}` : `${money(d.from)} – ${money(Math.min(d.to, priceNum))}`
                  return (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: P.raised }}>
                      <span style={{ flexShrink: 0, minWidth: 54, textAlign: 'center', padding: '5px 8px', borderRadius: 8, fontSize: 14, fontWeight: 800, color: free ? P.green : P.brand, background: free ? P.greenSoft : P.brandSoft, border: `1px solid ${free ? P.greenLine : P.brandLine}` }}>
                        {+(d.rate * 100).toFixed(1)}%
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, color: P.text2, direction: 'ltr', textAlign: en ? 'left' : 'right' }}>{range}</span>
                        <span style={{ display: 'block', fontSize: 13, color: P.text3, marginTop: 2 }}>{money(d.taxable)} {t.taxable}</span>
                      </span>
                      <span style={{ flexShrink: 0, fontSize: 15.5, fontWeight: 800, color: free ? P.green : P.text, fontVariantNumeric: 'tabular-nums' }}>
                        {d.amount > 0 ? money(d.amount) : <FaCheck aria-label={t.exempt} size={13}/>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
            <Note>{t.taxNote}</Note>
          </div>
        ) : <Empty Icon={FaMoneyBill}/>}
      </div>
    </div>
  )

  const eqColor = shortfall > 0 ? P.amber : P.green
  const ltvPane = (
    <div className="rcx-grid">
      <div>
        <Intro>{t.ltvIntro}</Intro>
        <Options name="ltv" label={t.purchase} value={ltvType} onChange={setLtvType} options={[
          { v: 'first', t: t.ltvFirst, sub: t.ltvFirstNote },
          { v: 'replacement', t: t.ltvRepl, sub: t.ltvReplNote },
          { v: 'second', t: t.ltvSecond, sub: t.ltvSecondNote },
        ]}/>
        {priceField}
        <div style={{ marginBottom: 22 }}>
          <Label htmlFor={`${uid}-cash`}>{t.equityCash}</Label>
          <MoneyField id={`${uid}-cash`} value={cashEditing || cashMode ? equityCash : (priceNum > 0 ? String(Math.round(equity)) : '')}
            onChange={setEquityCash} placeholder="500,000" describedBy={`${uid}-cash-hint`}
            onFocus={() => { setCashEditing(true); if (!cashMode && priceNum > 0) setEquityCash(String(Math.round(equity))) }}
            onBlur={() => setCashEditing(false)}/>
          <div id={`${uid}-cash-hint`} style={{ fontSize: 13, color: P.text3, marginTop: 6, lineHeight: 1.5 }}>
            {cashMode && priceNum === 0 ? t.eqCanBuy(money(cashNum), money(maxByEquity), Math.round(maxLtv * 100)) : t.equityCashHint}
          </div>
        </div>
        <div>
          <Slider id={`${uid}-eq`} label={t.eqPct} value={eqPctNow} setValue={v => { setEquityCash(''); setEquityPct(v) }}
            min={minPct} max={Math.max(90, minPct + 10)} step={1} unit="%" color={eqColor}
            marks={[minPct, minPct + 5, minPct + 15, minPct + 25].filter(m => m <= 90)} format={v => v}/>
          <div style={{ marginTop: -10, marginBottom: 22 }}>
            <div aria-hidden="true" style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: P.track }}>
              <div style={{ width: `${100 - eqPctNow}%`, background: P.brandFill, transition: 'width .2s' }}/>
              <div style={{ width: `${eqPctNow}%`, background: eqColor, transition: 'width .2s' }}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginTop: 6 }}>
              <span style={{ color: P.brand }}>{t.loanShare} {100 - eqPctNow}%</span>
              <span style={{ color: eqColor }}>{t.equityShare} {eqPctNow}%</span>
            </div>
            <div role={shortfall > 0 ? 'alert' : undefined} style={{ fontSize: 13.5, color: shortfall > 0 ? P.amber : P.text2, marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-start', lineHeight: 1.5, fontWeight: shortfall > 0 ? 600 : 400 }}>
              {shortfall > 0
                ? <FaExclamationTriangle size={13} style={{ color: P.amber, marginTop: 3, flexShrink: 0 }} aria-hidden="true"/>
                : <FaCheck size={12} style={{ color: P.green, marginTop: 4, flexShrink: 0 }} aria-hidden="true"/>}
              {shortfall > 0 ? t.eqShort(money(shortfall), minPct)
                : priceNum > 0 && loan === 0 ? t.eqNoLoan
                : eqPctNow <= minPct ? t.eqAtMin(minPct) : t.eqGood}
            </div>
          </div>
        </div>
        <div className="rcx-two">
          <Slider id={`${uid}-rate`} label={t.rate} value={rate} setValue={setRate} min={1} max={10} step={0.1} unit="%" color={P.brand}
            marks={[4, 4.5, 5, 5.5]} format={v => Number(v).toFixed(1)}/>
          <Slider id={`${uid}-years`} label={t.years} value={years} setValue={setYears} min={5} max={30} step={1} unit={t.yearsUnit} color={P.green}
            marks={[15, 20, 25, 30]}/>
        </div>
        <div style={{ marginBottom: 6 }}>
          <Label htmlFor={`${uid}-inc`} extra={<span style={{ fontSize: 13, color: P.text3 }}>{t.optional}</span>}>{t.income}</Label>
          <MoneyField id={`${uid}-inc`} value={income} onChange={setIncome} placeholder="20,000"/>
          <Chips values={[15_000, 20_000, 25_000, 30_000]} current={income} onPick={setIncome} label={t.income}/>
        </div>
      </div>

      <div className="rcx-results" ref={resultsRef} aria-live="polite">
        {priceNum > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Stat big label={t.monthly} value={money(aMonthly)}
              color={ratioHigh ? P.amber : P.brand} soft={ratioHigh ? P.amberSoft : P.brandSoft} line={ratioHigh ? P.amberLine : P.brandLine}
              icon={incomeNum > 0 ? (ratioHigh ? <FaExclamationTriangle size={13} style={{ color: P.amber, flexShrink: 0 }} aria-hidden="true"/> : <FaCheck size={12} style={{ color: P.green, flexShrink: 0 }} aria-hidden="true"/>) : null}
              sub={incomeNum > 0 ? `${(ratio * 100).toFixed(1)}% ${t.ofIncome} — ${ratioHigh ? t.ratioHigh : t.ratioOk}` : `${years} ${t.yearsUnit} · ${Number(rate).toFixed(1)}%`}/>
            {incomeNum > 0 && (
              <div aria-hidden="true" style={{ position: 'relative', height: 10, borderRadius: 6, background: P.track, overflow: 'hidden', marginTop: -4 }}>
                <div style={{ position: 'absolute', insetBlock: 0, insetInlineStart: 0, width: `${Math.min(100, ratio / 0.5 * 100)}%`, background: ratioHigh ? P.amber : P.green, borderRadius: 6, transition: 'width .2s' }}/>
                <div style={{ position: 'absolute', insetBlock: -2, insetInlineStart: '70%', width: 2, background: P.text2 }} title="35%"/>
              </div>
            )}
            <div className="rcx-two" style={{ gap: 12 }}>
              <Stat label={t.loan} value={money(aLoan)} color={P.text} soft={P.panel} line={P.line}
                sub={`${Math.round(ltvRatio * 100)}% ${t.ofPrice}`}/>
              <Stat label={t.equityNeeded} value={money(aEquity)} color={P.green} soft={P.greenSoft} line={P.greenLine}
                sub={t.extraCosts}/>
            </div>
            <div style={{ background: P.panel, border: `1.5px solid ${P.line}`, borderRadius: 16, padding: '6px 16px' }}>
              {[
                [t.totalPaid, money(monthly * n)],
                [t.totalInterest, money(Math.max(0, monthly * n - loan))],
                [t.estTax, estTax ? money(estTax) : t.exempt],
              ].map(([k, v], i) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: i ? `1px solid ${P.line}` : 'none', fontSize: 14.5 }}>
                  <span style={{ color: P.text2 }}>{k}</span>
                  <span style={{ color: P.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                </div>
              ))}
            </div>
            <Note>{t.ltvNote}</Note>
          </div>
        ) : cashMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Stat big label={t.maxPrice} value={money(aMax)} color={P.green} soft={P.greenSoft} line={P.greenLine}
              sub={maxByInc ? t.byIncome : t.byEquity(Math.round(maxLtv * 100))}/>
            <div style={{ background: P.panel, border: `1.5px solid ${P.line}`, borderRadius: 16, padding: '6px 16px' }}>
              {[
                [t.equityShare, money(cashNum)],
                [t.loan, money(Math.max(0, maxPrice - cashNum))],
                [t.monthly, money(Math.max(0, maxPrice - cashNum) * annuity)],
              ].map(([k, v], i) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: i ? `1px solid ${P.line}` : 'none', fontSize: 14.5 }}>
                  <span style={{ color: P.text2 }}>{k}</span>
                  <span style={{ color: P.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                </div>
              ))}
            </div>
            <Note>{t.maxHint}. {t.extraCosts}.</Note>
          </div>
        ) : <Empty Icon={FaHome}/>}
      </div>
    </div>
  )

  const tabuPane = (
    <div>
      <Intro>{t.tabuIntro}</Intro>
      <div className="rcx-two" style={{ marginBottom: 16 }}>
        {[[t.tabuTitle, t.tabuItems, 'brand'], [t.ramiTitle, t.ramiItems, 'green']].map(([title, items, k]) => {
          const [c, soft, line] = tone(k)
          return (
            <section key={title} style={{ background: soft, border: `1.5px solid ${line}`, borderRadius: 16, padding: '18px 18px' }}>
              <h3 style={{ fontSize: 16.5, fontWeight: 800, color: c, margin: '0 0 12px' }}>{title}</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map(it => (
                  <li key={it} style={{ display: 'flex', gap: 10, fontSize: 15, color: P.text, lineHeight: 1.55 }}>
                    <FaCheck size={12} style={{ color: c, flexShrink: 0, marginTop: 5 }} aria-hidden="true"/>{it}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      <section style={{ background: P.amberSoft, border: `1.5px solid ${P.amberLine}`, borderRadius: 16, padding: '16px 18px', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: P.amber, margin: '0 0 6px' }}>{t.howTitle}</h3>
        <p style={{ fontSize: 15, color: P.text, lineHeight: 1.65, margin: 0 }}>{t.howText}</p>
      </section>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {t.links.map(([label, url]) => (
          <a key={url} className="rcx-link" href={url} target="_blank" rel="noopener noreferrer"
            style={{ minHeight: 44, padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 12, border: `1.5px solid ${P.brandLine}`, color: P.brand, fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>
            {label}<FaExternalLinkAlt size={11} aria-hidden="true"/><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t.newTab}</span>
          </a>
        ))}
      </div>
    </div>
  )

  const rentalPane = (
    <div>
      <Intro>{t.rentalIntro}</Intro>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {t.rental.map((g, gi) => {
          const [c, soft, line] = tone(g.tone)
          const open = openAcc === gi
          const panelId = `${uid}-acc-${gi}`
          return (
            <section key={g.title} style={{ border: `1.5px solid ${open ? line : P.line}`, borderRadius: 16, overflow: 'hidden', background: open ? soft : P.panel }}>
              <h3 style={{ margin: 0 }}>
                <button type="button" className="rcx-btn rcx-acc" aria-expanded={open} aria-controls={panelId} onClick={() => setOpenAcc(open ? -1 : gi)}
                  style={{ width: '100%', minHeight: 56, padding: '0 18px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, color: c, fontSize: 16, fontWeight: 800, textAlign: 'start' }}>
                  {g.title}
                  <FaChevronDown size={14} aria-hidden="true" style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}/>
                </button>
              </h3>
              {open && (
                <div id={panelId} style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {g.items.map(([h, d]) => (
                    <div key={h}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: P.text, marginBottom: 3 }}>{h}</div>
                      <div style={{ fontSize: 15, color: P.text2, lineHeight: 1.65 }}>{d}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )

  const panes = { tax: taxPane, ltv: ltvPane, tabu: tabuPane, rental: rentalPane }

  return (
    <CalcCtx.Provider value={ctx}>
    <div className="rcx rcx-overlay" dir={en ? 'ltr' : 'rtl'} lang={en ? 'en' : 'he'}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 10600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: P.overlay, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>
      <style>{css}</style>
      <div ref={dialogRef} className="rcx-dialog" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}
        style={{ width: '100%', maxWidth: 1000, maxHeight: 'min(92vh, 900px)', display: 'flex', flexDirection: 'column', background: P.bg, color: P.text, borderRadius: 22, border: `1px solid ${P.line}`, boxShadow: P.shadow, overflow: 'hidden' }}>

        {/* Header */}
        <header className="rcx-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 24px 14px', background: P.panel }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: P.brand, marginBottom: 4 }}>{t.kicker}</div>
            <h2 id={`${uid}-title`} style={{ margin: 0, fontSize: 22, fontWeight: 800, color: P.text, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {t.title}
              <span style={{ fontSize: 12.5, fontWeight: 700, color: P.green, background: P.greenSoft, border: `1px solid ${P.greenLine}`, borderRadius: 8, padding: '2px 8px' }}>2026</span>
            </h2>
          </div>
          <button type="button" className="rcx-btn rcx-close" onClick={onClose} aria-label={t.close}
            style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 12, border: `1.5px solid ${P.line}`, background: 'transparent', color: P.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FaTimes size={16}/>
          </button>
        </header>

        {/* Tabs */}
        <div className="rcx-tabs" role="tablist" aria-label={t.title} onKeyDown={onTabKey}
          style={{ display: 'flex', gap: 4, padding: '0 16px', background: P.panel, borderBottom: `1px solid ${P.line}` }}>
          {TAB_IDS.map(id => {
            const on = tab === id
            const Icon = TAB_ICONS[id]
            return (
              <button key={id} type="button" role="tab" id={`${uid}-tab-${id}`} aria-selected={on} aria-controls={`${uid}-pane`} tabIndex={on ? 0 : -1}
                ref={el => { tabRefs.current[id] = el }} onClick={() => setTab(id)}
                className="rcx-btn rcx-tab"
                style={{ flex: 1, minWidth: 110, minHeight: 56, padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, border: 'none', borderBottom: `3px solid ${on ? P.brand : 'transparent'}`, borderRadius: '10px 10px 0 0', background: on ? P.brandSoft : 'transparent', color: on ? P.brand : P.text2, fontWeight: on ? 800 : 600 }}>
                <Icon size={17} aria-hidden="true"/>
                <span style={{ fontSize: 14, whiteSpace: 'nowrap' }}>{t.tabs[id]}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div ref={bodyRef} className="rcx-body" id={`${uid}-pane`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '22px 24px 26px' }}>
          <div key={tab} className="rcx-pane">{panes[tab]}</div>
        </div>

        {/* Mobile: the key result stays in view while typing */}
        {summary && (
          <div className="rcx-summary" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', background: P.panel, borderTop: `1px solid ${P.line}`, boxShadow: '0 -8px 24px rgba(0,0,0,.12)' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: P.text2, fontWeight: 600 }}>{summary.label}{summary.sub ? ` · ${summary.sub}` : ''}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: P.brand, fontVariantNumeric: 'tabular-nums' }}>{summary.value}</div>
            </div>
            <button type="button" className="rcx-btn" onClick={() => resultsRef.current?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })}
              style={{ minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', background: P.brandFill, color: '#fff', fontSize: 14.5, fontWeight: 700, flexShrink: 0 }}>
              {t.toDetails}
            </button>
          </div>
        )}
      </div>
    </div>
    </CalcCtx.Provider>
  )
}
