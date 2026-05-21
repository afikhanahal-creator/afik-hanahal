import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FaTimes, FaHome, FaBalanceScale, FaHandshake,
  FaMoneyBill, FaExternalLinkAlt, FaChevronDown, FaChevronUp,
} from 'react-icons/fa'

// ── 2026 מדרגות מס רכישה ────────────────────────────────────────────────────
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

const LTV_RULES = {
  first:       { label: 'דירה ראשונה / יחידה',             ltv: 0.75, note: 'הכלל הנפוץ ביותר — 75% מימון מקסימלי' },
  replacement: { label: 'דירה חלופית (מוכרים את הראשונה)', ltv: 0.70, note: 'תנאי: הדירה הנוכחית תימכר תוך 18 חודש' },
  second:      { label: 'דירה שנייה / להשקעה',              ltv: 0.50, note: 'בנק ישראל מגביל ל-50% בלבד' },
}

const TABS = [
  { id: 'tax',    label: 'מס רכישה',    Icon: FaMoneyBill    },
  { id: 'ltv',    label: 'משכנתא',       Icon: FaHome         },
  { id: 'tabu',   label: 'טאבו / רמ"י', Icon: FaBalanceScale },
  { id: 'rental', label: 'זכויות שוכר', Icon: FaHandshake    },
]

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

const fmt  = n => Math.round(n).toLocaleString('he-IL')
const fmtR = r => +(r * 100).toFixed(1) + '%'

function useCountUp(end, duration = 750) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    if (!end) { setVal(0); return }
    const t0 = performance.now()
    const tick = now => {
      const p    = Math.min((now - t0) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(end * ease))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [end, duration])
  return val
}

// ── Animated gradient background (adapted from BackgroundGradientAnimation) ──
function CalcGradientBg() {
  const interRef = useRef(null)
  const curX = useRef(0), curY = useRef(0)
  const tgX  = useRef(0), tgY  = useRef(0)
  const rafId = useRef(null)

  useEffect(() => {
    const move = () => {
      curX.current += (tgX.current - curX.current) / 20
      curY.current += (tgY.current - curY.current) / 20
      if (interRef.current) {
        interRef.current.style.transform = `translate(${Math.round(curX.current)}px, ${Math.round(curY.current)}px)`
      }
      rafId.current = requestAnimationFrame(move)
    }
    rafId.current = requestAnimationFrame(move)
    return () => cancelAnimationFrame(rafId.current)
  }, [])

  const handleMouseMove = e => {
    const rect = e.currentTarget.getBoundingClientRect()
    tgX.current = e.clientX - rect.left
    tgY.current = e.clientY - rect.top
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'linear-gradient(40deg, rgb(10,4,38) 0%, rgb(4,2,24) 100%)',
        overflow: 'hidden', borderRadius: 24,
      }}>

      {/* Animated blobs */}
      <div style={{
        position: 'absolute', inset: 0,
        filter: 'url(#rc-goo) blur(32px)',
        width: '100%', height: '100%',
      }}>
        {/* blob 1 — purple */}
        <div style={{
          position: 'absolute',
          width: '80%', height: '80%',
          top: 'calc(50% - 40%)', left: 'calc(50% - 40%)',
          background: 'radial-gradient(circle at center, rgba(132,144,216,1) 0%, rgba(132,144,216,0) 50%) no-repeat',
          mixBlendMode: 'hard-light',
          transformOrigin: 'center center',
          animation: 'rcMoveVertical 30s ease infinite',
          opacity: 1,
        }}/>
        {/* blob 2 — green */}
        <div style={{
          position: 'absolute',
          width: '80%', height: '80%',
          top: 'calc(50% - 40%)', left: 'calc(50% - 40%)',
          background: 'radial-gradient(circle at center, rgba(130,246,127,0.8) 0%, rgba(130,246,127,0) 50%) no-repeat',
          mixBlendMode: 'hard-light',
          transformOrigin: 'calc(50% - 400px)',
          animation: 'rcMoveInCircle 20s reverse infinite',
          opacity: 0.75,
        }}/>
        {/* blob 3 — deep purple */}
        <div style={{
          position: 'absolute',
          width: '80%', height: '80%',
          top: 'calc(50% - 40%)', left: 'calc(50% - 40%)',
          background: 'radial-gradient(circle at center, rgba(90,50,210,0.8) 0%, rgba(90,50,210,0) 50%) no-repeat',
          mixBlendMode: 'hard-light',
          transformOrigin: 'calc(50% + 400px)',
          animation: 'rcMoveInCircle 40s linear infinite',
          opacity: 0.85,
        }}/>
        {/* blob 4 — navy */}
        <div style={{
          position: 'absolute',
          width: '80%', height: '80%',
          top: 'calc(50% - 40%)', left: 'calc(50% - 40%)',
          background: 'radial-gradient(circle at center, rgba(60,30,170,0.8) 0%, rgba(60,30,170,0) 50%) no-repeat',
          mixBlendMode: 'hard-light',
          transformOrigin: 'calc(50% - 200px)',
          animation: 'rcMoveHorizontal 40s ease infinite',
          opacity: 0.7,
        }}/>
        {/* blob 5 — violet */}
        <div style={{
          position: 'absolute',
          width: '80%', height: '80%',
          top: 'calc(50% - 40%)', left: 'calc(50% - 40%)',
          background: 'radial-gradient(circle at center, rgba(160,100,255,0.8) 0%, rgba(160,100,255,0) 50%) no-repeat',
          mixBlendMode: 'hard-light',
          transformOrigin: 'calc(50% - 800px) calc(50% + 800px)',
          animation: 'rcMoveInCircle 20s ease infinite',
          opacity: 0.9,
        }}/>
        {/* Interactive pointer blob */}
        <div
          ref={interRef}
          style={{
            position: 'absolute',
            width: '100%', height: '100%',
            top: '-50%', left: '-50%',
            background: 'radial-gradient(circle at center, rgba(132,144,216,0.8) 0%, rgba(132,144,216,0) 50%) no-repeat',
            mixBlendMode: 'hard-light',
            opacity: 0.7,
          }}
        />
      </div>

      {/* SVG goo filter */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="rc-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur"/>
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo"/>
            <feBlend in="SourceGraphic" in2="goo"/>
          </filter>
        </defs>
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RealEstateCalc({ onClose }) {
  const P   = '#8490D8'
  const G   = '#82F67F'
  const Y   = '#F7C948'
  const CRM = '#E8E4D8'

  const bauhausRef = useRef(null)
  const handleBauhausMove = e => {
    const el = bauhausRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    el.style.setProperty('--bh-rot', Math.atan2(-x, y) + 'rad')
  }

  const [tab,           setTab]           = useState('tax')
  const [taxPrice,      setTaxPrice]      = useState('')
  const [buyerType,     setBuyerType]     = useState('first')
  const [ltvPrice,      setLtvPrice]      = useState('')
  const [ltvType,       setLtvType]       = useState('first')
  const [firstEquityPct, setFirstEquityPct] = useState(25)
  const [income,        setIncome]        = useState('')
  const [rate,          setRate]          = useState('4.8')
  const [years,         setYears]         = useState('25')
  const [openFaq,       setOpenFaq]       = useState(null)

  // ── Swipe-to-close (mobile) ──
  const [dragX,    setDragX]    = useState(0)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const touchRef   = useRef({ x0: 0, y0: 0, dragging: false, isHoriz: false })
  const SWIPE_THRESHOLD = 55

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const onTouchStart = useCallback(e => {
    const tag = e.target.tagName
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'TEXTAREA') return
    touchRef.current = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, dragging: true, isHoriz: false }
    setDragX(0)
  }, [])

  const onTouchMove = useCallback(e => {
    if (!touchRef.current.dragging) return
    const dx = e.touches[0].clientX - touchRef.current.x0
    const dy = e.touches[0].clientY - touchRef.current.y0
    if (!touchRef.current.isHoriz && Math.abs(dy) > Math.abs(dx)) return // vertical scroll — ignore
    if (Math.abs(dx) > 8) {
      touchRef.current.isHoriz = true
      setDragX(dx)
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    touchRef.current.dragging = false
    if (Math.abs(dragX) > SWIPE_THRESHOLD) {
      onClose()
    } else {
      setDragX(0)
    }
  }, [dragX, onClose])

  const taxNum    = Number((taxPrice || '0').replace(/,/g, ''))
  const ltvNum    = Number((ltvPrice || '0').replace(/,/g, ''))
  const incomeNum = Number((income   || '0').replace(/,/g, ''))
  const rateVal   = parseFloat(rate) || 4.8
  const yearsVal  = parseInt(years)  || 25

  const effectiveLTV = ltvType === 'first' ? (1 - firstEquityPct / 100) : LTV_RULES[ltvType].ltv
  const taxResult  = taxNum > 0 ? calcTax(taxNum, buyerType === 'first' ? BRACKETS_FIRST : BRACKETS_SECOND) : null
  const ltvRule    = LTV_RULES[ltvType]
  const maxLoan    = ltvNum * effectiveLTV
  const minEquity  = ltvNum - maxLoan
  const r          = rateVal / 100 / 12
  const n          = yearsVal * 12
  const monthly    = maxLoan > 0 && r > 0 ? (maxLoan * r * Math.pow(1+r,n)) / (Math.pow(1+r,n) - 1) : 0
  const maxPayment = incomeNum * 0.35

  const aTax     = useCountUp(taxResult?.total || 0)
  const aLoan    = useCountUp(Math.round(maxLoan))
  const aEquity  = useCountUp(Math.round(minEquity))
  const aMonthly = useCountUp(Math.round(monthly))

  const parseNum = raw => raw.replace(/[^\d]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  const INP = {
    width: '100%', padding: '16px 20px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(132,144,216,0.25)',
    borderRadius: 14, color: CRM,
    fontSize: 11,
    fontFamily: 'Rubik,inherit',
    outline: 'none', boxSizing: 'border-box',
    transition: 'border-color .2s, box-shadow .2s',
  }

  const LABEL = {
    display: 'block', fontSize: 11, color: `${CRM}70`,
    fontWeight: 700, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: '.07em',
  }

  return (
    <div
      className="rc-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        padding: '24px 12px 40px',
        overflowY: 'auto', direction: 'rtl',
      }}
    >
      {/* ── Always-visible X (mobile only, fixed position) ── */}
      <button className="rc-float-close" onClick={onClose} aria-label="סגור">
        <FaTimes size={13}/> סגור
      </button>
      <style>{`
        @keyframes rcCalcIn {
          from { opacity:0; transform:scale(0.93) translateY(24px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes rcFadeUp {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes rcGlow {
          0%,100% { box-shadow:0 0 80px rgba(90,60,220,0.3), 0 40px 80px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.07); }
          50%     { box-shadow:0 0 140px rgba(110,80,240,0.5), 0 40px 80px rgba(0,0,0,.8), 0 0 200px rgba(90,60,200,0.2), inset 0 1px 0 rgba(255,255,255,.07); }
        }
        @keyframes rcMoveVertical {
          0%   { transform: translateY(-50%); }
          50%  { transform: translateY(50%); }
          100% { transform: translateY(-50%); }
        }
        @keyframes rcMoveInCircle {
          0%   { transform: rotate(0deg); }
          50%  { transform: rotate(180deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes rcMoveHorizontal {
          0%   { transform: translateX(-50%) translateY(-10%); }
          50%  { transform: translateX(50%) translateY(10%); }
          100% { transform: translateX(-50%) translateY(-10%); }
        }

        @media (min-height: 700px) and (min-width: 601px) {
          .rc-overlay { align-items: center !important; }
        }

        .rc-input:focus {
          border-color: rgba(132,144,216,0.75) !important;
          box-shadow: 0 0 0 4px rgba(132,144,216,0.14), 0 0 24px rgba(132,144,216,0.10) !important;
        }
        .rc-tab { transition: all .2s; }
        .rc-tab:hover:not(.rc-tab-on) {
          background: rgba(132,144,216,0.12) !important;
          color: rgba(232,228,216,.9) !important;
          transform: translateY(-1px);
        }
        .rc-tab:active { transform: scale(0.96) !important; }
        .rc-type:hover:not(.rc-type-on) {
          border-color: rgba(132,144,216,0.45) !important;
          background: rgba(132,144,216,0.1) !important;
          color: rgba(232,228,216,.9) !important;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(132,144,216,0.12) !important;
        }
        .rc-type:active { transform: scale(0.97) !important; }
        .rc-card { transition: transform .22s, border-color .22s, box-shadow .22s; }
        .rc-card:hover { transform: translateY(-4px); }
        .rc-card-p:hover { border-color: rgba(132,144,216,0.5) !important; box-shadow: 0 16px 40px rgba(132,144,216,0.18) !important; }
        .rc-card-g:hover { border-color: rgba(130,246,127,0.5) !important; box-shadow: 0 16px 40px rgba(130,246,127,0.14) !important; }
        .rc-card-y:hover { border-color: rgba(247,201,72,0.5) !important;  box-shadow: 0 16px 40px rgba(247,201,72,0.12) !important; }
        .rc-bracket { transition: background .16s, border-color .16s, transform .16s; }
        .rc-bracket:hover { transform: translateX(-3px); }
        .rc-bracket-free:hover { background: rgba(130,246,127,0.08) !important; border-color: rgba(130,246,127,0.32) !important; }
        .rc-bracket-tax:hover  { background: rgba(132,144,216,0.08) !important; border-color: rgba(132,144,216,0.32) !important; }
        .rc-col { transition: all .22s; }
        .rc-col:hover { transform: translateY(-5px); box-shadow: 0 18px 44px rgba(0,0,0,.35) !important; }
        .rc-col-p:hover { background: rgba(132,144,216,0.12) !important; border-color: rgba(132,144,216,0.4) !important; }
        .rc-col-g:hover { background: rgba(130,246,127,0.1) !important; border-color: rgba(130,246,127,0.4) !important; }
        .rc-acc { transition: all .18s; }
        .rc-acc:hover { background: rgba(132,144,216,0.08) !important; }
        .rc-link { transition: all .18s; }
        .rc-link:hover { background: rgba(132,144,216,0.25) !important; transform: translateY(-2px); box-shadow: 0 6px 18px rgba(132,144,216,0.15) !important; }
        .rc-link-g:hover { background: rgba(130,246,127,0.2) !important; border-color: rgba(130,246,127,0.55) !important; color: #82F67F !important; }
        .rc-close:hover { background: #8490D8 !important; color: #fff !important; border-color: #8490D8 !important; transform: scale(1.08) rotate(90deg); }
        .rc-close { transition: all .25s !important; }

        /* Range slider */
        .rc-range { -webkit-appearance:none; appearance:none; height:10px; border-radius:8px; outline:none; cursor:pointer; display:block; }
        .rc-range::-webkit-slider-runnable-track { height:10px; border-radius:8px; }
        .rc-range::-webkit-slider-thumb {
          -webkit-appearance:none; width:30px; height:30px; border-radius:50%;
          background:radial-gradient(circle at 38% 32%, #bbc5f8, #8490D8);
          cursor:grab; border:2px solid rgba(255,255,255,0.28);
          box-shadow:0 3px 14px rgba(132,144,216,0.65), 0 0 0 5px rgba(132,144,216,0.2);
          transition: box-shadow .18s, transform .18s;
        }
        .rc-range::-webkit-slider-thumb:hover {
          box-shadow:0 3px 22px rgba(132,144,216,0.85), 0 0 0 10px rgba(132,144,216,0.24);
          transform: scale(1.13);
        }
        .rc-range::-webkit-slider-thumb:active { cursor:grabbing; transform:scale(1.2); }
        .rc-range-g::-webkit-slider-thumb {
          background:radial-gradient(circle at 38% 32%, #c2fac0, #82F67F);
          box-shadow:0 3px 14px rgba(130,246,127,0.65), 0 0 0 5px rgba(130,246,127,0.2);
        }
        .rc-range-g::-webkit-slider-thumb:hover {
          box-shadow:0 3px 22px rgba(130,246,127,0.85), 0 0 0 10px rgba(130,246,127,0.24);
        }
        .rc-eq-btn { transition: all .18s cubic-bezier(.34,1.56,.64,1) !important; }
        .rc-eq-btn:hover:not(.rc-eq-on) {
          border-color: rgba(132,144,216,0.5) !important;
          background: rgba(132,144,216,0.12) !important;
          color: #8490D8 !important;
          transform: translateY(-2px) scale(1.04) !important;
        }
        .rc-eq-btn:active { transform: scale(0.95) !important; }

        .rc-scroll::-webkit-scrollbar { width: 5px; }
        .rc-scroll::-webkit-scrollbar-track { background: transparent; }
        .rc-scroll::-webkit-scrollbar-thumb { background: rgba(132,144,216,0.25); border-radius: 3px; }

        /* Always-visible floating X — mobile only */
        .rc-float-close { display:none; }
        @media (max-width: 768px) {
          .rc-float-close {
            display:flex !important;
            position:fixed; top:14px; left:12px; z-index:10001;
            height:44px; padding:0 18px; border-radius:22px;
            background:rgba(6,3,22,0.97);
            border:2px solid rgba(232,228,216,0.32);
            color:#E8E4D8; font-size:13px; font-weight:700;
            font-family:Rubik,sans-serif; letter-spacing:.03em;
            cursor:pointer;
            align-items:center; justify-content:center; gap:8px;
            backdrop-filter:blur(18px);
            box-shadow:0 4px 28px rgba(0,0,0,0.8), 0 0 0 1px rgba(132,144,216,0.18);
            transition:all .18s;
          }
          .rc-float-close:active { transform:scale(0.93) !important; }
        }

        .rc-swipe-hint {
          display:none;
          text-align:center; padding:4px 0 8px;
          font-size:11px; color:rgba(232,228,216,0.28);
          align-items:center; justify-content:center; gap:10px;
          letter-spacing:.06em;
        }
        @media (max-width:768px) { .rc-swipe-hint { display:flex !important; } }

        @media (max-width: 768px) {
          .rc-scroll { max-height: calc(100dvh - 88px) !important; overflow-y: auto !important; overflow-x: hidden !important; }
          .rc-overlay { padding-top: 66px !important; padding-bottom: 8px !important; padding-left: 8px !important; padding-right: 8px !important; align-items: flex-start !important; overflow-y: hidden !important; }
        }

        @media (max-width: 600px) {
          .rc-scroll { max-height: calc(100dvh - 84px) !important; }
          .rc-overlay      { padding: 64px 4px 6px !important; align-items: flex-start !important; }
          .rc-header       { padding: 11px 14px 9px !important; }
          .rc-tabs-wrap    { padding: 3px 6px 0 !important; gap: 2px !important; }
          .rc-modal-body   { padding: 8px 10px 10px !important; }
          .rc-grid         { grid-template-columns: 1fr !important; gap: 10px !important; }
          .rc-compare-grid { grid-template-columns: 1fr !important; gap: 8px !important; }
          .rc-tab-label    { font-size: 9px !important; }
          .rc-tab          { padding: 6px 3px 7px !important; min-width: 0 !important; }
          .rc-range        { height: 10px !important; }
          .rc-range::-webkit-slider-runnable-track { height: 10px !important; }
          .rc-range::-webkit-slider-thumb { width: 26px !important; height: 26px !important; }
          .rc-eq-btn       { padding: 7px 6px !important; font-size: 10px !important; }
        }

        @media (max-width: 380px) {
          .rc-overlay { padding: 60px 2px 4px !important; }
          .rc-scroll  { max-height: calc(100dvh - 72px) !important; }
          .rc-tab-label { display: none !important; }
          .rc-tab     { padding: 8px 6px !important; }
          .rc-header  { padding: 9px 12px 8px !important; }
          .rc-modal-body { padding: 6px 8px 8px !important; }
        }
      `}</style>

      {/* ── MODAL with bauhaus rotating border ─────────────────────── */}
      <div
        ref={bauhausRef}
        onMouseMove={handleBauhausMove}
        style={{
          width: '100%', maxWidth: 960,
          borderRadius: 26,
          padding: 2,
          '--bh-rot': '4.2rad',
          background: 'linear-gradient(calc(var(--bh-rot, 4.2rad)), #8490D8 0%, rgb(4,2,24) 32%, rgb(14,8,48) 65%, transparent 100%)',
          animation: 'rcCalcIn .42s cubic-bezier(0.16,1,0.3,1) both',
          flexShrink: 0,
          transform: `translateX(${dragX}px)`,
          opacity: Math.max(0.4, 1 - Math.abs(dragX) / 320),
          transition: touchRef.current?.dragging ? 'none' : 'transform .35s cubic-bezier(.34,1.56,.64,1), opacity .35s ease',
        }}
      >
      <div
        className="rc-scroll"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          position: 'relative',
          borderRadius: 24,
          animation: 'rcGlow 5s ease infinite .7s',
          fontFamily: 'Rubik, Heebo, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Animated gradient background */}
        <CalcGradientBg />

        {/* Glass overlay on top of gradient */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'rgba(6,4,20,0.72)',
          backdropFilter: 'blur(0px)',
          borderRadius: 24,
          pointerEvents: 'none',
        }}/>

        {/* Content layer */}
        <div style={{ position: 'relative', zIndex: 2 }}>

          {/* ── HEADER ─────────────────────────────────────────────── */}
          <div className="rc-header" style={{ padding:'16px 28px 13px', borderBottom:'1px solid rgba(132,144,216,0.12)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:14 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, letterSpacing:'3.5px', color:P, opacity:.8, textTransform:'uppercase', marginBottom:8 }}>
                כלי עזר לרוכשים ומשקיעים
              </div>
              <h2 style={{ margin:0, fontSize:24, fontWeight:900, color:CRM, letterSpacing:'-.3px', lineHeight:1.2 }}>
                מחשבון נדל״ן חכם
                <span style={{ fontSize:13, fontWeight:700, color:G, background:'rgba(130,246,127,0.14)', border:'1px solid rgba(130,246,127,0.28)', borderRadius:7, padding:'3px 10px', marginRight:12, verticalAlign:'middle', letterSpacing:'.04em' }}>2026</span>
              </h2>
            </div>
            <button className="rc-close" onClick={onClose} aria-label="סגור"
              style={{ width:46, height:46, borderRadius:'50%', flexShrink:0, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(132,144,216,0.22)', color:`${CRM}80`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <FaTimes size={16}/>
            </button>
          </div>

          {/* ── TABS ─────────────────────────────────────────────────── */}
          <div className="rc-tabs-wrap" style={{ padding:'14px 28px 0', borderBottom:'1px solid rgba(132,144,216,0.12)', display:'flex', gap:3, overflowX:'auto' }}>
            {TABS.map(({ id, label, Icon }) => {
              const on = tab === id
              return (
                <button key={id}
                  className={`rc-tab${on ? ' rc-tab-on' : ''}`}
                  onClick={() => setTab(id)}
                  style={{ flex:1, minWidth:90, padding:'13px 8px 16px', background: on ? 'rgba(132,144,216,0.16)' : 'transparent', border:'none', borderBottom:`3px solid ${on ? P : 'transparent'}`, color: on ? P : `${CRM}55`, fontFamily:'inherit', fontWeight: on ? 800 : 500, fontSize:14, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, borderRadius:'8px 8px 0 0' }}>
                  <Icon size={17}/>
                  <span className="rc-tab-label" style={{ fontSize:13, whiteSpace:'nowrap' }}>{label}</span>
                </button>
              )
            })}
          </div>

          {/* ── CONTENT ─────────────────────────────────────────────── */}
          <div className="rc-modal-body" style={{ padding:'16px 28px 22px' }}>

            {/* ══ TAB: מס רכישה ═══════════════════════════════════════ */}
            {tab === 'tax' && (
              <div style={{ animation:'rcFadeUp .28s ease both' }}>
                <div className="rc-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:32, alignItems:'start' }}>

                  {/* LEFT — inputs */}
                  <div>
                    <p style={{ fontSize:16, color:`${CRM}65`, margin:'0 0 24px', lineHeight:1.8 }}>
                      חישוב מס רכישה לפי מדרגות 2026 — דירה ראשונה, שנייה, או משקיע.
                    </p>

                    {/* Buyer type */}
                    <div style={{ marginBottom:22 }}>
                      <label style={LABEL}>סוג הרוכש</label>
                      <div style={{ display:'flex', gap:10 }}>
                        {[{ v:'first', t:'דירה ראשונה', sub:'מדרגות מופחתות' }, { v:'second', t:'דירה שנייה', sub:'משקיע / מרובה דירות' }].map(({ v, t, sub }) => (
                          <button key={v} className={`rc-type${buyerType===v?' rc-type-on':''}`} onClick={() => setBuyerType(v)}
                            style={{ flex:1, padding:'14px 12px', border:`1.5px solid ${buyerType===v ? P : 'rgba(132,144,216,0.2)'}`, borderRadius:13, background: buyerType===v ? 'rgba(132,144,216,0.2)' : 'rgba(255,255,255,0.03)', color: buyerType===v ? P : `${CRM}60`, fontFamily:'inherit', cursor:'pointer', transition:'all .2s', boxShadow: buyerType===v ? `0 0 24px rgba(132,144,216,0.22)` : 'none', textAlign:'center', position:'relative' }}>
                            {buyerType===v && <span style={{ position:'absolute', top:8, left:10, width:18, height:18, borderRadius:'50%', background:`${P}22`, border:`1px solid ${P}55`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10 }}>✓</span>}
                            <div style={{ fontWeight:800, fontSize:15, marginBottom:3 }}>{t}</div>
                            <div style={{ fontSize:11, color: buyerType===v ? `${P}AA` : `${CRM}35`, fontWeight:500 }}>{sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Price */}
                    <div style={{ marginBottom:0 }}>
                      <label style={LABEL}>מחיר הנכס</label>
                      <div style={{ position:'relative' }}>
                        <input className="rc-input" type="text" value={taxPrice}
                          onChange={e => setTaxPrice(parseNum(e.target.value))}
                          placeholder="1,500,000"
                          style={{ ...INP, paddingLeft:44, textAlign:'left', direction:'ltr' }}/>
                        <span style={{ position:'absolute', top:'50%', left:16, transform:'translateY(-50%)', color:`${CRM}40`, fontSize:18, pointerEvents:'none' }}>₪</span>
                      </div>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:8 }}>
                        {[500_000,1_000_000,1_500_000,2_000_000,3_000_000,5_000_000].map(n => (
                          <button key={n} onClick={() => setTaxPrice(parseNum(String(n)))}
                            style={{ padding:'4px 10px', borderRadius:7, border:'1px solid rgba(132,144,216,0.2)', background:'rgba(132,144,216,0.07)', color:`${CRM}58`, fontFamily:'Rubik,monospace', fontSize:11, fontWeight:700, cursor:'pointer', letterSpacing:'.02em', transition:'all .16s' }}
                            onMouseEnter={e => { e.currentTarget.style.background='rgba(132,144,216,0.18)'; e.currentTarget.style.color=P; e.currentTarget.style.borderColor='rgba(132,144,216,0.42)' }}
                            onMouseLeave={e => { e.currentTarget.style.background='rgba(132,144,216,0.07)'; e.currentTarget.style.color=`${CRM}58`; e.currentTarget.style.borderColor='rgba(132,144,216,0.2)' }}>
                            {n >= 1_000_000 ? `${n/1_000_000}M` : '500K'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Effective rate */}
                    {taxResult && (
                      <div style={{ marginTop:16, background: taxResult.total===0 ? 'rgba(130,246,127,0.09)' : 'rgba(132,144,216,0.08)', border:`1px solid ${taxResult.total===0 ? 'rgba(130,246,127,0.25)' : 'rgba(132,144,216,0.2)'}`, borderRadius:12, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', animation:'rcFadeUp .25s ease both' }}>
                        <span style={{ fontSize:15, color:`${CRM}65` }}>שיעור מס אפקטיבי</span>
                        <span style={{ fontSize:28, fontWeight:900, color: taxResult.total===0 ? G : P, fontFamily:'Rubik,monospace' }}>
                          {taxResult.total===0 ? 'פטור ✓' : ((taxResult.total / taxNum) * 100).toFixed(2)+'%'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* RIGHT — results */}
                  <div>
                    {taxResult ? (
                      <div style={{ animation:'rcFadeUp .32s ease .06s both' }}>
                        {/* Total card */}
                        <div className="rc-card rc-card-p" style={{ background:'linear-gradient(140deg,rgba(132,144,216,0.2) 0%,rgba(132,144,216,0.06) 100%)', border:'1px solid rgba(132,144,216,0.25)', borderRadius:16, padding:'24px 26px', marginBottom:14 }}>
                          <div style={{ fontSize:13, color:`${CRM}55`, marginBottom:8, textTransform:'uppercase', letterSpacing:'.07em' }}>סה"כ מס רכישה</div>
                          <div style={{ fontSize:46, fontWeight:900, color:P, fontFamily:'Rubik,monospace', letterSpacing:'-.5px', lineHeight:1.1 }}>
                            ₪{fmt(aTax)}
                          </div>
                        </div>

                        {/* Bracket breakdown */}
                        <div style={{ fontSize:13, color:`${CRM}45`, fontWeight:700, marginBottom:10, textTransform:'uppercase', letterSpacing:'.07em' }}>פירוט מדרגות</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {taxResult.details.map((d, i) => {
                            const free = d.rate === 0
                            return (
                              <div key={i} className={`rc-bracket ${free ? 'rc-bracket-free' : 'rc-bracket-tax'}`}
                                style={{ display:'flex', alignItems:'center', gap:12, background: free ? 'rgba(130,246,127,0.05)' : 'rgba(255,255,255,0.025)', border:`1px solid ${free ? 'rgba(130,246,127,0.18)' : 'rgba(132,144,216,0.14)'}`, borderRadius:11, padding:'11px 14px' }}>
                                <div style={{ width:46, height:46, borderRadius:'50%', flexShrink:0, background: free ? 'rgba(130,246,127,0.12)' : 'rgba(132,144,216,0.12)', border:`1px solid ${free ? 'rgba(130,246,127,0.35)' : 'rgba(132,144,216,0.3)'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  <span style={{ fontSize:13, fontWeight:900, color: free ? G : P }}>{fmtR(d.rate)}</span>
                                </div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:13, color:`${CRM}45`, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                    {d.to === Infinity ? `מעל ₪${fmt(d.from)}` : `₪${fmt(d.from)} – ₪${fmt(Math.min(d.to, taxNum))}`}
                                  </div>
                                  <div style={{ fontSize:14, color:`${CRM}80`, fontWeight:600, marginTop:3 }}>₪{fmt(d.taxable)} חייב</div>
                                </div>
                                <div style={{ fontSize:16, fontWeight:800, color: free ? G : CRM, fontFamily:'monospace', flexShrink:0, textAlign:'left', minWidth:70 }}>
                                  {d.amount > 0 ? `₪${fmt(d.amount)}` : '✓ פטור'}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ fontSize:12, color:`${CRM}28`, marginTop:12, textAlign:'center' }}>
                          * מדרגות 2026 — לצורך הערכה בלבד. אמת מול רשות המסים.
                        </div>
                      </div>
                    ) : (
                      <EmptyState icon={<FaMoneyBill size={26} color="rgba(132,144,216,0.22)"/>} text="הכנס מחיר נכס לחישוב"/>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══ TAB: משכנתא ═════════════════════════════════════════ */}
            {tab === 'ltv' && (
              <div style={{ animation:'rcFadeUp .28s ease both' }}>
                <p style={{ fontSize:13, color:`${CRM}65`, margin:'0 0 6px', lineHeight:1.4 }}>
                  חישוב מינוף מקסימלי לפי כללי בנק ישראל — גובה משכנתא, הון עצמי, והחזר חודשי.
                </p>
                <div className="rc-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:14, alignItems:'start' }}>

                  {/* LEFT */}
                  <div>
                    <label style={LABEL}>סוג הרכישה</label>
                    <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:8 }}>
                      {Object.entries(LTV_RULES).map(([v, { label, ltv }]) => (
                        <button key={v} className={`rc-type${ltvType===v?' rc-type-on':''}`} onClick={() => setLtvType(v)}
                          style={{ padding:'8px 16px', border:`1.5px solid ${ltvType===v ? P : 'rgba(132,144,216,0.18)'}`, borderRadius:11, background: ltvType===v ? 'rgba(132,144,216,0.18)' : 'rgba(255,255,255,0.025)', color: ltvType===v ? P : `${CRM}65`, fontFamily:'inherit', fontWeight:700, fontSize:15, cursor:'pointer', transition:'all .2s', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow: ltvType===v ? `0 0 22px rgba(132,144,216,0.2)` : 'none' }}>
                          <span>{label}</span>
                          <span style={{ background: ltvType===v ? P : 'rgba(255,255,255,0.08)', color: ltvType===v ? '#fff' : `${CRM}55`, borderRadius:20, padding:'3px 12px', fontSize:14, fontWeight:900, fontFamily:'monospace', flexShrink:0 }}>
                            {ltv * 100}%
                          </span>
                        </button>
                      ))}
                      <div style={{ fontSize:13, color:`${P}BB`, paddingRight:4, lineHeight:1.45 }}>{LTV_RULES[ltvType].note}</div>
                    </div>

                    {/* Equity % selector — shown only for first home */}
                    {ltvType === 'first' && (
                      <div style={{ marginBottom:10 }}>
                        {/* Header with live badge */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                          <label style={{ ...LABEL, marginBottom:0 }}>הון עצמי</label>
                          <span style={{ fontSize:20, fontWeight:900, color: firstEquityPct >= 25 ? G : Y, fontFamily:'Rubik,monospace', background: firstEquityPct >= 25 ? 'rgba(130,246,127,0.14)' : 'rgba(247,201,72,0.14)', border:`1px solid ${firstEquityPct >= 25 ? 'rgba(130,246,127,0.32)' : 'rgba(247,201,72,0.32)'}`, borderRadius:9, padding:'3px 14px', transition:'all .3s', lineHeight:1.3 }}>{firstEquityPct}%</span>
                        </div>

                        {/* Loan / Equity split bar */}
                        <div style={{ marginBottom:8 }}>
                          <div style={{ height:7, borderRadius:5, background:'rgba(255,255,255,0.07)', overflow:'hidden', display:'flex' }}>
                            <div style={{ height:'100%', width:`${100-firstEquityPct}%`, background:`linear-gradient(to left,${P},${P}77)`, transition:'width .35s ease', borderRadius:'5px 0 0 5px' }}/>
                            <div style={{ height:'100%', width:`${firstEquityPct}%`, background:`linear-gradient(to right,${firstEquityPct >= 25 ? G : Y}99,${firstEquityPct >= 25 ? G : Y})`, transition:'width .35s ease', borderRadius:'0 5px 5px 0' }}/>
                          </div>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginTop:4, fontWeight:700, fontFamily:'Rubik,monospace' }}>
                            <span style={{ color:`${P}99` }}>משכנתא {100-firstEquityPct}%</span>
                            <span style={{ color: firstEquityPct >= 25 ? `${G}99` : `${Y}99` }}>הון {firstEquityPct}%</span>
                          </div>
                        </div>

                        {/* Drag slider */}
                        <input type="range" className="rc-range" min="5" max="40" step="5" value={firstEquityPct}
                          onChange={e => setFirstEquityPct(Number(e.target.value))}
                          style={{ width:'100%', marginBottom:10, background:`linear-gradient(to left, rgba(132,144,216,0.65) ${(firstEquityPct-5)/35*100}%, rgba(255,255,255,0.1) ${(firstEquityPct-5)/35*100}%)` }}/>

                        {/* 3 key preset bookmarks */}
                        <div style={{ display:'flex', gap:8 }}>
                          {[{pct:25,note:'מינימום'}, {pct:30,note:'מומלץ'}, {pct:40,note:'בטוח'}].map(({pct, note}) => {
                            const active = firstEquityPct === pct
                            return (
                              <button key={pct} className={`rc-eq-btn${active ? ' rc-eq-on' : ''}`} onClick={() => setFirstEquityPct(pct)}
                                style={{ flex:1, padding:'9px 8px', border:`1.5px solid ${active ? P : 'rgba(132,144,216,0.2)'}`, borderRadius:11, background: active ? 'rgba(132,144,216,0.2)' : 'rgba(255,255,255,0.03)', color: active ? P : `${CRM}55`, fontFamily:'inherit', cursor:'pointer', boxShadow: active ? `0 0 16px rgba(132,144,216,0.22)` : 'none', textAlign:'center' }}>
                                <div style={{ fontWeight:900, fontSize:16, fontFamily:'monospace' }}>{pct}%</div>
                                <div style={{ fontSize:10, fontWeight:600, marginTop:2, opacity:.7 }}>{note}</div>
                              </button>
                            )
                          })}
                        </div>

                        {/* Status */}
                        {firstEquityPct < 25 ? (
                          <div style={{ marginTop:7, fontSize:12, color:'#f59e0bCC', lineHeight:1.55, display:'flex', gap:5, alignItems:'flex-start' }}>
                            <span style={{ flexShrink:0 }}>⚠️</span>
                            <span>בנק ישראל מחייב מינימום 25% הון עצמי לדירה ראשונה.</span>
                          </div>
                        ) : firstEquityPct === 25 ? (
                          <div style={{ marginTop:7, fontSize:12, color:`${P}99`, lineHeight:1.55 }}>✓ 25% — מינימום הנדרש לפי בנק ישראל.</div>
                        ) : (
                          <div style={{ marginTop:7, fontSize:12, color:`${G}99`, lineHeight:1.55 }}>✓ {firstEquityPct}% — מינוף נמוך, ביטחון גבוה.</div>
                        )}
                      </div>
                    )}

                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                      {/* Property price with quick presets */}
                      <div>
                        <label style={LABEL}>מחיר הנכס</label>
                        <div style={{ position:'relative' }}>
                          <input className="rc-input" type="text" value={ltvPrice}
                            onChange={e => setLtvPrice(parseNum(e.target.value))}
                            placeholder="2,000,000"
                            style={{ ...INP, paddingLeft:34, fontSize:17, textAlign:'left', direction:'ltr' }}/>
                          <span style={{ position:'absolute', top:'50%', left:12, transform:'translateY(-50%)', color:`${CRM}38`, fontSize:16, pointerEvents:'none' }}>₪</span>
                        </div>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:6 }}>
                          {[1_000_000,1_500_000,2_000_000,3_000_000,5_000_000].map(n => (
                            <button key={n} onClick={() => setLtvPrice(parseNum(String(n)))}
                              style={{ flex:1, minWidth:0, padding:'3px 4px', borderRadius:6, border:'1px solid rgba(132,144,216,0.18)', background:'rgba(132,144,216,0.06)', color:`${CRM}52`, fontFamily:'Rubik,monospace', fontSize:10, fontWeight:700, cursor:'pointer', transition:'all .16s', whiteSpace:'nowrap' }}
                              onMouseEnter={e => { e.currentTarget.style.background='rgba(132,144,216,0.18)'; e.currentTarget.style.color=P; e.currentTarget.style.borderColor='rgba(132,144,216,0.4)' }}
                              onMouseLeave={e => { e.currentTarget.style.background='rgba(132,144,216,0.06)'; e.currentTarget.style.color=`${CRM}52`; e.currentTarget.style.borderColor='rgba(132,144,216,0.18)' }}>
                              {n >= 1_000_000 ? `${n/1_000_000}M` : '500K'}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Net income */}
                      <div>
                        <label style={LABEL}>הכנסה נטו</label>
                        <div style={{ position:'relative' }}>
                          <input className="rc-input" type="text" value={income}
                            onChange={e => setIncome(parseNum(e.target.value))}
                            placeholder="20,000"
                            style={{ ...INP, paddingLeft:34, fontSize:17, textAlign:'left', direction:'ltr' }}/>
                          <span style={{ position:'absolute', top:'50%', left:12, transform:'translateY(-50%)', color:`${CRM}38`, fontSize:16, pointerEvents:'none' }}>₪</span>
                        </div>
                        <div style={{ display:'flex', gap:4, marginTop:6 }}>
                          {[15_000,20_000,25_000,30_000].map(n => (
                            <button key={n} onClick={() => setIncome(parseNum(String(n)))}
                              style={{ flex:1, minWidth:0, padding:'3px 4px', borderRadius:6, border:'1px solid rgba(130,246,127,0.18)', background:'rgba(130,246,127,0.06)', color:`${CRM}52`, fontFamily:'Rubik,monospace', fontSize:10, fontWeight:700, cursor:'pointer', transition:'all .16s', whiteSpace:'nowrap' }}
                              onMouseEnter={e => { e.currentTarget.style.background='rgba(130,246,127,0.16)'; e.currentTarget.style.color=G; e.currentTarget.style.borderColor='rgba(130,246,127,0.38)' }}
                              onMouseLeave={e => { e.currentTarget.style.background='rgba(130,246,127,0.06)'; e.currentTarget.style.color=`${CRM}52`; e.currentTarget.style.borderColor='rgba(130,246,127,0.18)' }}>
                              {n/1_000}K
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Rate slider */}
                    <div style={{ marginBottom:7 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                        <label style={{ ...LABEL, marginBottom:0 }}>ריבית שנתית</label>
                        <span style={{ fontSize:20, fontWeight:900, color:P, fontFamily:'Rubik,monospace', background:'rgba(132,144,216,0.16)', border:'1px solid rgba(132,144,216,0.32)', borderRadius:9, padding:'4px 14px', letterSpacing:'.02em', lineHeight:1.3 }}>{rateVal}%</span>
                      </div>
                      <input type="range" className="rc-range" min="1" max="12" step="0.1" value={rateVal}
                        onChange={e => setRate(e.target.value)}
                        style={{ width:'100%', background:`linear-gradient(to left, rgba(132,144,216,0.68) ${(rateVal-1)/11*100}%, rgba(255,255,255,0.1) ${(rateVal-1)/11*100}%)` }}/>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700, fontFamily:'Rubik,monospace', color:`${CRM}60`, marginTop:9 }}>
                        <span>1%</span><span>12%</span>
                      </div>
                    </div>

                    {/* Years slider */}
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
                        <label style={{ ...LABEL, marginBottom:0 }}>תקופה</label>
                        <span style={{ fontSize:20, fontWeight:900, color:G, fontFamily:'Rubik,monospace', background:'rgba(130,246,127,0.14)', border:'1px solid rgba(130,246,127,0.3)', borderRadius:9, padding:'4px 14px', lineHeight:1.3 }}>{yearsVal} שנים</span>
                      </div>
                      <input type="range" className="rc-range rc-range-g" min="5" max="30" step="1" value={yearsVal}
                        onChange={e => setYears(e.target.value)}
                        style={{ width:'100%', background:`linear-gradient(to left, rgba(130,246,127,0.62) ${(yearsVal-5)/25*100}%, rgba(255,255,255,0.1) ${(yearsVal-5)/25*100}%)` }}/>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700, fontFamily:'Rubik,monospace', color:`${CRM}60`, marginTop:9 }}>
                        <span>5</span><span>30 שנה</span>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT */}
                  <div>
                    {ltvNum > 0 ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:9, animation:'rcFadeUp .32s ease .06s both' }}>
                        <div className="rc-card rc-card-p" style={{ background:'rgba(132,144,216,0.12)', border:'1px solid rgba(132,144,216,0.22)', borderRadius:14, padding:'13px 18px' }}>
                          <div style={{ fontSize:11, color:`${CRM}55`, marginBottom:4, textTransform:'uppercase', letterSpacing:'.07em' }}>מקסימום משכנתא</div>
                          <div style={{ fontSize:34, fontWeight:900, color:P, fontFamily:'Rubik,monospace', lineHeight:1.1 }}>₪{fmt(aLoan)}</div>
                          <div style={{ fontSize:13, color:`${P}CC`, marginTop:4, fontWeight:600 }}>{(effectiveLTV * 100).toFixed(0)}% ממחיר הנכס</div>
                        </div>

                        <div className="rc-card rc-card-g" style={{ background:'rgba(130,246,127,0.08)', border:'1px solid rgba(130,246,127,0.2)', borderRadius:14, padding:'13px 18px' }}>
                          <div style={{ fontSize:11, color:`${CRM}55`, marginBottom:4, textTransform:'uppercase', letterSpacing:'.07em' }}>הון עצמי</div>
                          <div style={{ fontSize:28, fontWeight:900, color:G, fontFamily:'Rubik,monospace', lineHeight:1.1 }}>₪{fmt(aEquity)}</div>
                          <div style={{ fontSize:13, color:`${G}BB`, marginTop:4, fontWeight:600 }}>{(100 - effectiveLTV * 100).toFixed(0)}% — כולל מס רכישה ועו"ד</div>
                        </div>

                        {monthly > 0 && (() => {
                          const warn = incomeNum > 0 && monthly > maxPayment
                          const c = warn ? Y : G
                          return (
                            <div className={`rc-card rc-card-${warn ? 'y' : 'g'}`} style={{ background:`${c}0A`, border:`1px solid ${c}25`, borderRadius:14, padding:'13px 18px' }}>
                              <div style={{ fontSize:11, color:`${CRM}55`, marginBottom:4, textTransform:'uppercase', letterSpacing:'.07em' }}>החזר חודשי משוער</div>
                              <div style={{ fontSize:28, fontWeight:900, color:c, fontFamily:'Rubik,monospace', lineHeight:1.1 }}>₪{fmt(aMonthly)}</div>
                              {incomeNum > 0 && (
                                <div style={{ fontSize:13, color:c, marginTop:4, fontWeight:700 }}>
                                  {warn ? '⚠ ' : '✓ '}{((monthly / incomeNum) * 100).toFixed(1)}% מההכנסה {warn ? '— גבוה מ-35%' : '— תקין'}
                                </div>
                              )}
                            </div>
                          )
                        })()}

                        <div style={{ fontSize:13, color:`${CRM}30`, textAlign:'center' }}>
                          * לפי כללי בנק ישראל. תנאים בפועל נקבעים על ידי הבנק המלווה.
                        </div>
                      </div>
                    ) : (
                      <EmptyState icon={<FaHome size={26} color="rgba(132,144,216,0.22)"/>} text="הכנס מחיר נכס לחישוב"/>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══ TAB: טאבו vs רמ"י ═══════════════════════════════════ */}
            {tab === 'tabu' && (
              <div style={{ animation:'rcFadeUp .28s ease both' }}>
                <p style={{ fontSize:16, color:`${CRM}65`, margin:'0 0 22px', lineHeight:1.8 }}>
                  ההבדל בין נכס הרשום בטאבו לנכס בחכירה מרמ"י — קריטי לפני כל עסקה.
                </p>

                <div className="rc-compare-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14, marginBottom:18 }}>
                  {[
                    { title:'טאבו — פנקס המקרקעין', color:P, cls:'rc-col rc-col-p', items:['בעלות פרטית מלאה — רשומה על שם הקונה','זכות למכור / להוריש / לשעבד ללא הגבלה','אין דמי חכירה שנתיים למדינה','רישום בלשכת רישום המקרקעין','ניתן לבדוק נסח טאבו מקוון בחינם'] },
                    { title:'רמ"י — חכירה ממדינה',  color:G, cls:'rc-col rc-col-g', items:['הקרקע שייכת למדינת ישראל','הרוכש מקבל זכות חכירה ל-49/98 שנה','עשויים לחול דמי היתר בשינוי ייעוד','מכירה עשויה לדרוש אישור רמ"י','חלק מהחוזים כוללים דמי חכירה שנתיים'] },
                  ].map(({ title, color, cls, items }) => (
                    <div key={title} className={cls} style={{ background:`${color}07`, border:`1px solid ${color}20`, borderRadius:15, padding:'22px 20px' }}>
                      <div style={{ fontSize:16, fontWeight:800, color, marginBottom:14 }}>{title}</div>
                      {items.map((item, i) => (
                        <div key={i} style={{ display:'flex', gap:10, fontSize:15, color:`${CRM}88`, lineHeight:1.7, marginBottom:9 }}>
                          <span style={{ color, flexShrink:0, marginTop:2 }}>•</span>{item}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div style={{ background:'rgba(247,201,72,0.07)', border:'1px solid rgba(247,201,72,0.2)', borderRadius:13, padding:'16px 22px', marginBottom:18 }}>
                  <div style={{ fontWeight:700, color:Y, fontSize:16, marginBottom:8 }}>איך לבדוק — נסח טאבו</div>
                  <div style={{ fontSize:15, color:`${CRM}78`, lineHeight:1.8 }}>
                    פנה ללשכת רישום המקרקעין — בקש נסח טאבו (50 ₪). המסמך מראה: מי הבעלים הרשום,
                    האם יש משכנתאות / שעבודים / הערות אזהרה, ומה מצב הזכויות בנכס.
                  </div>
                </div>

                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {[
                    { label:'מאגר עסקאות — רשות המסים', url:'https://www.gov.il/he/service/real_estate_information',    g:false },
                    { label:'מחירי נדל"ן — מדלן',        url:'https://www.madlan.co.il',                                g:false },
                    { label:'הפקת נסח טאבו',             url:'https://www.gov.il/he/service/land_registration_extract', g:true },
                  ].map(({ label, url, g }) => (
                    <a key={label} className={`rc-link${g ? ' rc-link-g' : ''}`} href={url} target="_blank" rel="noopener noreferrer"
                      style={{ padding:'9px 16px', background: g ? 'rgba(130,246,127,0.09)' : `${P}12`, border:`1px solid ${g ? 'rgba(130,246,127,0.25)' : `${P}28`}`, borderRadius:10, color: g ? G : P, fontSize:14, fontWeight:700, textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
                      {label}<FaExternalLinkAlt size={11}/>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ══ TAB: זכויות שוכר ════════════════════════════════════ */}
            {tab === 'rental' && (
              <div style={{ animation:'rcFadeUp .28s ease both' }}>
                <p style={{ fontSize:16, color:`${CRM}65`, margin:'0 0 20px', lineHeight:1.8 }}>
                  בדיקת חוזה שכירות לפי חוק השכירות ההוגנת — זכויות וחובות שוכר ומשכיר.
                </p>

                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[
                    { title:'חובות המשכיר לפי חוק', color:G, items:[
                      ['מסירת הדירה במצב תקין', 'על המשכיר למסור דירה ראויה למגורים העומדת בתקני בטיחות ובריאות.'],
                      ['תיקון ליקויים מהותיים',  'כשל בתשתיות (חשמל, אינסטלציה, גג) — חובת המשכיר לתקן על חשבונו.'],
                      ['הודעה מוקדמת לפינוי',    'לפחות 90 יום מראש לסיום חוזה מעל שנה; 30 יום בחוזים קצרים יותר.'],
                    ]},
                    { title:'זכויות השוכר', color:P, items:[
                      ['הגנה מפני פינוי שרירותי',    'המשכיר לא יכול לפנות שוכר ללא הליך משפטי ופסיקת בית משפט.'],
                      ['הגבלת עליית שכ"ד באופציה',   'בחוזים עם אופציה — העלייה מוגבלת למדד המחירים לצרכן.'],
                      ['ביטחונות מוגבלים',            'לפי החוק — לא יותר מ-3 חודשי שכ"ד כסכום כולל ביטחונות.'],
                    ]},
                    { title:'רשימת בדיקה לפני חתימה', color:Y, items:[
                      ['בדוק בעלות',          'בקש נסח טאבו — ודא שהמשכיר הוא הבעלים הרשום (או מורשה בכתב).'],
                      ['מה כלול בשכ"ד',       'ארנונה / ועד / מים / גז — מי משלם? הגדרה ברורה בחוזה.'],
                      ['פרוטוקול מסירה',      'צלם כל ליקוי קיים לפני הכניסה, חתום על פרוטוקול עם המשכיר.'],
                    ]},
                  ].map(({ title, color, items }) => {
                    const isOpen = openFaq === title
                    return (
                      <div key={title} style={{ background:`${color}06`, border:`1px solid ${color}1A`, borderRadius:13, overflow:'hidden' }}>
                        <button className="rc-acc" onClick={() => setOpenFaq(isOpen ? null : title)}
                          style={{ width:'100%', padding:'17px 22px', background:'transparent', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'inherit' }}>
                          <span style={{ fontSize:16, fontWeight:800, color }}>{title}</span>
                          {isOpen ? <FaChevronUp size={14} color={color}/> : <FaChevronDown size={14} color={color}/>}
                        </button>
                        {isOpen && (
                          <div style={{ padding:'4px 22px 20px', display:'flex', flexDirection:'column', gap:14, animation:'rcFadeUp .2s ease both' }}>
                            {items.map(([t, d], i) => (
                              <div key={i}>
                                <div style={{ fontSize:15, fontWeight:700, color:CRM, marginBottom:4 }}>{t}</div>
                                <div style={{ fontSize:15, color:`${CRM}72`, lineHeight:1.7 }}>{d}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>

          {/* ── Swipe hint — mobile only ── */}
          <div className="rc-swipe-hint">
            <span style={{ opacity:.5 }}>←</span>
            החלק ימינה או שמאלה לסגירה
            <span style={{ opacity:.5 }}>→</span>
          </div>

        </div>
      </div>
      </div>{/* /bauhaus wrapper */}
    </div>
  )
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:'52px 0', textAlign:'center' }}>
      <div style={{ width:72, height:72, borderRadius:'50%', border:'1.5px dashed rgba(132,144,216,0.18)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {icon}
      </div>
      <div style={{ fontSize:16, color:'rgba(232,228,216,0.3)' }}>{text}</div>
    </div>
  )
}

