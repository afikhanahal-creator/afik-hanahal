// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
// Split out of App.jsx so public visitors never download or parse it (~4,500 lines).
// App.jsx loads it on demand: const AdminPanel = lazyWithRetry(() => import('./AdminPanel.jsx'))
// Shared constants / helpers still live in App.jsx and are imported back from there — that is a
// dynamic→static cycle, which is safe: by the time this chunk evaluates, App.jsx already has.
import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { LAYERS_DEF as GM_LAYERS, BG_OPTIONS as GM_BG_OPTIONS, LAYER_CATS_DEF as GM_LAYER_CATS } from './govmapLayers.js'
import { FaEnvelope, FaFacebookF, FaInstagram, FaBed, FaRulerCombined, FaBuilding, FaTools, FaMapMarkerAlt, FaPhone, FaLeaf, FaCalendarAlt, FaTimes, FaWhatsapp, FaFileAlt, FaHome, FaSearch, FaBalanceScale, FaHandshake, FaLock, FaKey, FaGlobe, FaBolt, FaChartLine, FaEye, FaPlay, FaFire, FaShareAlt, FaHeart, FaCamera, FaUser, FaUsers, FaDesktop, FaMobileAlt, FaTabletAlt, FaRobot, FaExclamationTriangle, FaChartBar, FaThumbsUp, FaImage, FaPencilAlt, FaCrown, FaMousePointer, FaDollarSign, FaVideo, FaLink, FaCheckCircle, FaTrash, FaClipboardList } from 'react-icons/fa'
// Seller intake submissions (from the public /sell form) — lazy, admin-only
const SellerSubmissionsTab = lazy(() => import('./SellerSubmissionsTab.jsx'))
import { LeadsBoard, GreenAPIChat, MetaLeadsTab, SupermetricsTab, PropertyWizard, API_BASE, CONTACTS_API, ADMIN_TOKEN, DARK_C, useTheme, TEAM, G, Logo, LEADS_STORE, LEADS_DELETED, LEADS_TRASH, ANALYTICS_KEY, META_LEAD_PAGES_KEY, WA_DEFAULT_TEMPLATE, _cloudSettings, CATEGORIES, EMPTY_PROP, CONDITION_OPTIONS, ENTRY_OPTIONS, ADMIN_DRAFT_KEY, toMapsEmbed, imgFallback, thumbImg, TEAM_KEY, setCloudSettings } from './App.jsx'

// Tab ↔ URL deep-link mapping (module-level so both AdminPanel and main app can use it)
const ADMIN_TAB_TO_PATH = { overview:'', props:'properties', leads:'leads', sellers:'properties-intake', chats:'chats', meta:'lead-center', analytics:'analytics', supermetrics:'performance', team:'team', settings:'settings', counters:'counters', live:'live' }
const ADMIN_PATH_TO_TAB = Object.fromEntries(Object.entries(ADMIN_TAB_TO_PATH).map(([k,v])=>[v,k]))

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
        const MAX = 1600
        let w = img.width, h = img.height
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
        const cv = document.createElement('canvas')
        cv.width = w; cv.height = h
        cv.getContext('2d').drawImage(img, 0, 0, w, h)
        res(cv.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => res(null)
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })

  // Persist a photo optimally: upload the compressed copy to Supabase Storage and
  // keep only the short URL on the property. Storing base64 inline bloats the DB
  // row and every /api/properties payload (slower admin load + more egress). Falls
  // back to inline base64 only if the upload endpoint is unavailable, so saving
  // never breaks.
  const persist = async file => {
    const dataUrl = await compress(file)
    if (!dataUrl) return null
    if (API_BASE) {
      try {
        const blob = await (await fetch(dataUrl)).blob()
        const fd = new FormData()
        fd.append('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
        const r = await fetch(`${API_BASE}/api/upload/image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
          body: fd,
        })
        if (r.ok) {
          const data = await r.json().catch(() => null)
          if (data?.url) return data.url
        }
      } catch {}
    }
    return dataUrl // fallback — inline base64 (previous behaviour)
  }

  const MAX_IMAGES = 20
  const addFiles = async files => {
    const remaining = Math.max(0, MAX_IMAGES - images.length)
    const allowed = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, remaining)
    if (!allowed.length) return
    setLoading(true)
    const results = (await Promise.all(allowed.map(persist))).filter(Boolean)
    onChange([...images, ...results])
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
      {images.length < MAX_IMAGES && (
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
            <div style={{ fontSize:10, color:'rgba(232,228,216,.3)', marginTop:3 }}>עד {MAX_IMAGES - images.length} תמונות נוספות · JPEG/PNG/WEBP</div>
          </>
        )}
      </div>
      )}

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
    id:'Pixels: 1311196023271539 + 1341264237748951',
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
// Verified GA4 device snapshot — pulled live from the authenticated GA4 property
// "הנגר 24 הוד השרון" (536943897) via Supermetrics on 2026-06-03, last-30-days range.
// This is real data, not a placeholder. It is the trustworthy source the card shows
// whenever the live in-app pull is unavailable (e.g. SUPERMETRICS_API_KEY not yet
// set in Vercel), so the breakdown is never empty or based on localStorage guesses.
// Shape matches the live row parser: { device, sessions, activeUsers, newUsers, bounceRate, views, avgDuration }.
const GA4_DEVICE_VERIFIED_DATE = '03/06/2026'
const GA4_DEVICE_VERIFIED = [
  { device:'mobile',  sessions:198, activeUsers:104, newUsers:99, bounceRate:0.4495, views:408, avgDuration:615.42 },
  { device:'desktop', sessions:198, activeUsers:75,  newUsers:75, bounceRate:0.3081, views:734, avgDuration:1477.64 },
]

function AnalyticsDashboard({ leads }) {
  const { C, isDark } = useTheme()
  const [events, setEvents] = useState([])
  const [refreshTs, setRefreshTs] = useState(0)
  const [analyticsTab, setAnalyticsTab] = useState('site')
  const [ga4Devices, setGa4Devices] = useState(null)   // real GA4 device data
  const [ga4Source,  setGa4Source]  = useState(null)   // 'live' | 'verified'
  const [ga4Reason,  setGa4Reason]  = useState('')     // why live was unavailable (transparency)
  const [ga4UpdatedAt, setGa4UpdatedAt] = useState(null) // timestamp of last successful live pull
  const [ga4Loading, setGa4Loading] = useState(false)

  useEffect(() => {
    const load = () => {
      try { setEvents(JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]')) } catch {}
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [refreshTs])

  // Live GA4 device data from Supermetrics, kept near-real-time: an initial load
  // (with retries + verified-snapshot fallback) followed by an auto-refresh every
  // 2 minutes while the panel is open. A background refresh only updates on success
  // — it never downgrades good live data back to the fallback.
  useEffect(() => {
    let cancelled = false

    // rows: [deviceCategory, sessions, activeUsers, newUsers, bounceRate, views, avgDuration]
    const parseRows = rows => (rows || [])
      .filter(row => row[0])            // drop empty/placeholder device rows
      .map(row => ({
        device: String(row[0] || '').toLowerCase(),
        sessions: Number(row[1]) || 0,
        activeUsers: Number(row[2]) || 0,
        newUsers: Number(row[3]) || 0,
        bounceRate: Number(row[4]) || 0,
        views: Number(row[5]) || 0,
        avgDuration: Number(row[6]) || 0,
      }))

    // One live fetch. Returns { ok, parsed } or { ok:false, reason }.
    const fetchOnce = async () => {
      try {
        const r = await fetch(`/api/meta/supermetrics?source=device&range=last_30_days`, {
          headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        })
        const d = await r.json().catch(() => ({}))
        const parsed = parseRows(d.rows)
        if (parsed.length) return { ok: true, parsed }
        return { ok: false, reason: typeof d.error === 'string' ? d.error : !r.ok ? `HTTP ${r.status}` : 'אין עדיין שורות מ-Supermetrics' }
      } catch (e) {
        return { ok: false, reason: e?.message || 'שגיאת רשת' }
      }
    }

    const applyLive = parsed => {
      setGa4Devices(parsed)
      setGa4Source('live')
      setGa4Reason('')
      setGa4UpdatedAt(Date.now())
    }

    // Initial load: retry a few times (cold start), else show verified snapshot.
    const initialLoad = async (tries = 0) => {
      if (cancelled) return
      const res = await fetchOnce()
      if (cancelled) return
      if (res.ok) { applyLive(res.parsed); setGa4Loading(false); return }
      if (tries < 4) { setTimeout(() => initialLoad(tries + 1), 2500); return }
      setGa4Devices(GA4_DEVICE_VERIFIED)
      setGa4Source('verified')
      setGa4Reason(res.reason)
      setGa4Loading(false)
    }

    // Background refresh: update only when live succeeds; keep last data otherwise.
    const refresh = async () => {
      if (cancelled) return
      const res = await fetchOnce()
      if (cancelled || !res.ok) return
      applyLive(res.parsed)
    }

    setGa4Loading(true)
    initialLoad()
    const intervalId = setInterval(refresh, 120000) // auto-refresh every 2 min
    return () => { cancelled = true; clearInterval(intervalId) }
  }, []) // eslint-disable-line

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

      {/* ── Primary KPI Row ── */}
      <div className="admin-analytics-kpi" style={{ display:'grid', gap:12 }}>
        {[
          { label:'סשנים היום',  value:todaySess.length,  color:C.purple,      Icon:FaUser,         sub:'כניסות ייחודיות' },
          { label:'סשנים השבוע', value:weekSess.length,   color:C.green,       Icon:FaChartLine,    sub:'7 ימים אחרונים'  },
          { label:'צפיות נכסים', value:propViews.length,  color:'#F7C948',     Icon:FaHome,         sub:'סה"כ'             },
          { label:'המרות',       value:`${convRate}%`,    color:'#FF6B6B',     Icon:FaBalanceScale, sub:'פניות / סשנים'   },
        ].map((k,i) => (
          <div key={i} style={{ background:`linear-gradient(145deg,${k.color}1C 0%,${k.color}07 100%)`, border:`1px solid ${k.color}44`, borderRadius:18, padding:'20px 16px', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:-26, right:-26, width:96, height:96, background:k.color, opacity:.07, borderRadius:'50%', filter:'blur(28px)', pointerEvents:'none' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ width:40, height:40, borderRadius:12, background:`${k.color}22`, border:`1px solid ${k.color}44`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <k.Icon size={17} style={{ color:k.color }}/>
              </div>
              <span style={{ fontSize:9, fontWeight:800, letterSpacing:'.09em', background:`${k.color}18`, border:`1px solid ${k.color}28`, borderRadius:20, padding:'2px 9px', color:k.color }}>LIVE</span>
            </div>
            <div style={{ fontSize:34, fontWeight:900, color:k.color, lineHeight:1, letterSpacing:'-.01em' }}>{k.value}</div>
            <div style={{ fontSize:12, color:C.cream, marginTop:8, fontWeight:700 }}>{k.label}</div>
            <div style={{ fontSize:10, color:`${C.cream}44`, marginTop:2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Secondary KPI Row ── */}
      <div className="admin-analytics-kpi" style={{ display:'grid', gap:10 }}>
        {[
          { label:'טפסי יצירת קשר', value:contacts.length,    color:'#FF6B6B', Icon:FaEnvelope },
          { label:'קליקי WhatsApp',  value:waClicks.length,    color:'#25D366', Icon:FaWhatsapp },
          { label:'קליקי טלפון',     value:phoneClicks.length, color:C.green,   Icon:FaPhone },
          { label:'סה"כ לידים CRM',  value:leads.length,       color:C.purple,  Icon:FaUsers  },
        ].map((k,i) => (
          <div key={i} style={{ background:`${k.color}0D`, border:`1px solid ${k.color}30`, borderRadius:13, padding:'13px 14px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:11, background:`${k.color}20`, border:`1px solid ${k.color}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <k.Icon size={16} style={{ color:k.color }}/>
            </div>
            <div>
              <div style={{ fontSize:22, fontWeight:900, color:k.color, lineHeight:1 }}>{k.value}</div>
              <div style={{ fontSize:10.5, color:`${C.cream}66`, marginTop:3, fontWeight:600 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 7-day bar chart ── */}
      <div style={{ background: isDark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.02)', borderRadius:18, padding:'20px 22px', border:`1px solid ${C.purple}20`, boxShadow: isDark ? '0 4px 24px rgba(0,0,0,.22)' : '0 2px 10px rgba(0,0,0,.05)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:C.cream }}>ביקורים — 7 ימים אחרונים</div>
            <div style={{ fontSize:11, color:`${C.cream}44`, marginTop:2 }}>סשנים ייחודיים</div>
          </div>
          <div style={{ fontSize:11, fontWeight:700, color:C.purple, background:`${C.purple}14`, border:`1px solid ${C.purple}30`, borderRadius:20, padding:'4px 13px' }}>
            שבוע: {weekSess.length}
          </div>
        </div>
        <svg viewBox="0 0 490 128" style={{ width:'100%', height:128, direction:'ltr', overflow:'visible' }}>
          {/* Gridlines */}
          {[0,.33,.66,1].map((pct,gi) => {
            const y = 96 - pct * 76
            return <line key={gi} x1="0" y1={y} x2="490" y2={y} stroke={`${C.cream}${gi===0?'12':'07'}`} strokeWidth="1" strokeDasharray={gi===0?undefined:'3 5'}/>
          })}
          {days7.map((d,i) => {
            const bw = 50, gap = (490 - 7*bw) / 6
            const x  = i * (bw + gap)
            const bh = Math.max((d.cnt / maxCnt) * 76, d.cnt > 0 ? 5 : 0)
            const by = 96 - bh
            const isToday = i === 6
            return (
              <g key={i}>
                <defs>
                  <linearGradient id={`gb${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={isToday ? C.purple : `${C.purple}99`}/>
                    <stop offset="100%" stopColor={isToday ? `${C.purple}cc` : `${C.purple}2A`}/>
                  </linearGradient>
                </defs>
                {isToday && <rect x={x+5} y={by+6} width={bw-10} height={bh} rx={6} fill={C.purple} opacity=".12" style={{ filter:'blur(7px)' }}/>}
                <rect x={x} y={by} width={bw} height={bh} rx={6} fill={`url(#gb${i})`}
                  style={{ transition:'height .7s cubic-bezier(.34,1.56,.64,1), y .7s cubic-bezier(.34,1.56,.64,1)' }}/>
                {d.cnt > 0 && (
                  <text x={x+bw/2} y={by-5} textAnchor="middle"
                    fill={isToday ? C.purple : `${C.cream}77`}
                    fontSize="10" fontWeight="800" fontFamily="Rubik,sans-serif">{d.cnt}</text>
                )}
                <text x={x+bw/2} y={113} textAnchor="middle"
                  fill={isToday ? C.purple : `${C.cream}55`}
                  fontSize="10" fontWeight={isToday?'800':'500'} fontFamily="Rubik,sans-serif">{d.label}</text>
                {isToday && <circle cx={x+bw/2} cy={121} r={3} fill={C.purple}/>}
              </g>
            )
          })}
        </svg>
      </div>

      {/* ── Sources + Devices ── */}
      <div className="admin-overview-bottom" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

        {/* Traffic Sources */}
        <div style={{ background: isDark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.02)', borderRadius:18, padding:'20px 20px', border:`1px solid ${C.purple}20` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:800, color:C.cream }}>מקורות טראפיק</div>
            <span style={{ fontSize:10, color:`${C.cream}44`, background:`${C.purple}12`, borderRadius:20, padding:'2px 9px', border:`1px solid ${C.purple}20` }}>{sessions.length} סשנים</span>
          </div>
          {srcList.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {srcList.map(([src,cnt],i) => {
                const pct = sessions.length > 0 ? Math.round((cnt/sessions.length)*100) : 0
                return (
                  <div key={i}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <span style={{ width:9, height:9, borderRadius:'50%', background:src6Colors[i], flexShrink:0, boxShadow:`0 0 7px ${src6Colors[i]}88` }}/>
                        <span style={{ fontSize:12.5, color:C.cream, fontWeight:600 }}>{src}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:11, color:`${C.cream}44` }}>{cnt}</span>
                        <span style={{ fontSize:11, fontWeight:800, color:src6Colors[i], background:`${src6Colors[i]}18`, padding:'1px 8px', borderRadius:20, border:`1px solid ${src6Colors[i]}30` }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height:8, background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)', borderRadius:4 }}>
                      <div style={{ height:8, width:`${pct}%`, background:`linear-gradient(90deg,${src6Colors[i]},${src6Colors[i]}aa)`, borderRadius:4, transition:'width 1s cubic-bezier(.34,1.56,.64,1)', boxShadow:`0 0 8px ${src6Colors[i]}55` }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'28px 0' }}>
              <div style={{ fontSize:30, marginBottom:8, opacity:.25 }}>📊</div>
              <div style={{ color:`${C.cream}35`, fontSize:12, fontWeight:600 }}>אין נתונים עדיין</div>
              <div style={{ color:`${C.cream}25`, fontSize:10, marginTop:4 }}>יצטברו בביקורים הבאים</div>
            </div>
          )}
        </div>

        {/* Devices — real GA4 data */}
        <div style={{ background: isDark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.02)', borderRadius:18, padding:'20px 20px', border:`1px solid ${C.purple}20` }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ fontSize:13, fontWeight:800, color:C.cream }}>סוג מכשיר</div>
              {ga4Devices && (
                ga4Source === 'verified' ? (
                  <span title={`נתוני GA4 אמיתיים שנמשכו ואומתו בתאריך ${GA4_DEVICE_VERIFIED_DATE} (טווח 30 יום). מתעדכנים אוטומטית לנתון חי כשהמשיכה החיה מהשרת זמינה.`}
                    style={{ fontSize:10, color:'#22C55E', background:'rgba(34,197,94,.1)', padding:'2px 8px', borderRadius:20, border:'1px solid rgba(34,197,94,.25)', fontWeight:700 }}>
                    GA4 · 30 יום ✓ מאומת {GA4_DEVICE_VERIFIED_DATE}
                  </span>
                ) : (
                  <span title="נתונים חיים שנמשכו זה עתה מ-GA4 דרך השרת"
                    style={{ fontSize:10, color:'#4285F4', background:'rgba(66,133,244,.1)', padding:'2px 8px', borderRadius:20, border:'1px solid rgba(66,133,244,.25)', fontWeight:700 }}>
                    GA4 · 30 יום · live ●
                  </span>
                )
              )}
            </div>
            {ga4Loading
              ? <span style={{ fontSize:10, color:`${C.cream}44` }}>טוען מ-GA4...</span>
              : ga4Source === 'live' && ga4UpdatedAt && (
                <span title="הנתונים מתרעננים אוטומטית כל 2 דקות" style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:`${C.cream}44` }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 6px #22C55E', animation:'pulse 2s ease-in-out infinite' }}/>
                  עודכן {new Date(ga4UpdatedAt).toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' })} · מתעדכן אוטומטית
                </span>
              )}
          </div>

          {ga4Devices ? (
            <>
              {/* Real GA4 device data */}
              {(() => {
                const DEVICE_CONFIG = [
                  { key:'mobile',  label:'מובייל',  Icon:FaMobileAlt, color:'#60D4F7' },
                  { key:'desktop', label:'דסקטופ',  Icon:FaDesktop,   color:C.purple },
                  { key:'tablet',  label:'טאבלט',   Icon:FaTabletAlt, color:'#E17BFF' },
                ]
                const totalSessions = ga4Devices.reduce((s, d) => s + d.sessions, 0)
                return (
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    {DEVICE_CONFIG.map(dc => {
                      const row = ga4Devices.find(d => d.device === dc.key) || { sessions:0, activeUsers:0, bounceRate:0, views:0, avgDuration:0 }
                      const pct = totalSessions > 0 ? Math.round((row.sessions / totalSessions) * 100) : 0
                      const dur = row.avgDuration ? `${Math.floor(row.avgDuration/60)}:${String(Math.round(row.avgDuration%60)).padStart(2,'0')}` : null
                      return (
                        <div key={dc.key}>
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:32, height:32, borderRadius:9, background:`${dc.color}18`, border:`1px solid ${dc.color}33`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <dc.Icon size={14} style={{ color:dc.color }}/>
                              </div>
                              <div>
                                <div style={{ fontSize:13, color:C.cream, fontWeight:700 }}>{dc.label}</div>
                                {row.sessions > 0 && (
                                  <div style={{ fontSize:10, color:`${C.cream}44` }}>
                                    {row.activeUsers} פעילים · {row.views} צפיות · {row.bounceRate ? Math.round(row.bounceRate*100) : 0}% נטישה{dur ? ` · ${dur} ממוצע` : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign:'left' }}>
                              <div style={{ fontSize:20, fontWeight:900, color:dc.color, lineHeight:1 }}>{row.sessions}</div>
                              <div style={{ fontSize:11, fontWeight:800, color:`${dc.color}99` }}>{pct}%</div>
                            </div>
                          </div>
                          <div style={{ height:8, background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)', borderRadius:4 }}>
                            <div style={{ height:8, width:`${pct}%`, background:`linear-gradient(90deg,${dc.color},${dc.color}88)`, borderRadius:4, transition:'width 1s ease', boxShadow:`0 0 10px ${dc.color}44` }}/>
                          </div>
                        </div>
                      )
                    })}
                    {(() => {
                      const stats = [
                        { label:'סה"כ סשנים', value: ga4Devices.reduce((s,d)=>s+d.sessions,0), color:C.purple },
                        { label:'משתמשים פעילים', value: ga4Devices.reduce((s,d)=>s+(d.activeUsers||0),0), color:'#22C55E' },
                        { label:'צפיות סה"כ', value: ga4Devices.reduce((s,d)=>s+(d.views||0),0), color:'#F7C948' },
                      ]
                      return (
                    <div style={{ display:'grid', gridTemplateColumns:`repeat(${stats.length},1fr)`, gap:8, marginTop:4, paddingTop:12, borderTop:`1px solid ${C.purple}18` }}>
                      {stats.map((m,i) => (
                        <div key={i} style={{ textAlign:'center', padding:'10px 6px', background:`${m.color}0D`, borderRadius:10, border:`1px solid ${m.color}22` }}>
                          <div style={{ fontSize:18, fontWeight:900, color:m.color }}>{m.value}</div>
                          <div style={{ fontSize:10, color:`${C.cream}55`, marginTop:3, fontWeight:600 }}>{m.label}</div>
                        </div>
                      ))}
                    </div>
                      )
                    })()}
                    {/* Transparency footnote: exact source + (when applicable) why live was unavailable */}
                    <div style={{ fontSize:9.5, color:`${C.cream}40`, marginTop:10, lineHeight:1.5, textAlign:'center' }}>
                      {ga4Source === 'verified'
                        ? <>מקור: GA4 · נכס "הנגר 24 הוד השרון" · snapshot מאומת {GA4_DEVICE_VERIFIED_DATE}{ga4Reason ? ` · live לא זמין כעת (${ga4Reason})` : ''}</>
                        : <>מקור: GA4 · נכס "הנגר 24 הוד השרון" · נתונים חיים דרך Supermetrics</>}
                    </div>
                  </div>
                )
              })()}
            </>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { label:'מובייל',  key:'mobile',  Icon:FaMobileAlt, color:'#60D4F7' },
                { label:'דסקטופ',  key:'desktop', Icon:FaDesktop,   color:C.purple },
                { label:'טאבלט',   key:'tablet',  Icon:FaTabletAlt, color:'#E17BFF' },
              ].map(d => {
                const pct = sessions.length > 0 ? Math.round((devMap[d.key]/sessions.length)*100) : 0
                return (
                  <div key={d.key}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:30, height:30, borderRadius:9, background:`${d.color}18`, border:`1px solid ${d.color}33`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <d.Icon size={13} style={{ color:d.color }}/>
                        </div>
                        <span style={{ fontSize:12.5, color:C.cream, fontWeight:600 }}>{d.label}</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:11, color:`${C.cream}44` }}>{devMap[d.key]}</span>
                        <span style={{ fontSize:11, fontWeight:800, color:d.color, background:`${d.color}18`, padding:'1px 8px', borderRadius:20 }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height:8, background: isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)', borderRadius:4 }}>
                      <div style={{ height:8, width:`${pct}%`, background:`linear-gradient(90deg,${d.color},${d.color}aa)`, borderRadius:4, transition:'width 1s ease', boxShadow:`0 0 8px ${d.color}44` }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {sessions.length > 0 && (
            <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label:'WhatsApp', v:waClicks.length,    c:'#25D366', Icon:FaWhatsapp },
                { label:'טלפון',    v:phoneClicks.length, c:C.green,   Icon:FaPhone },
              ].map((d,i) => (
                <div key={i} style={{ background:`${d.c}0E`, border:`1px solid ${d.c}30`, borderRadius:11, padding:'11px 12px', textAlign:'center' }}>
                  <div style={{ width:30, height:30, borderRadius:9, background:`${d.c}20`, border:`1px solid ${d.c}40`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 7px' }}>
                    <d.Icon size={13} style={{ color:d.c }}/>
                  </div>
                  <div style={{ fontSize:20, fontWeight:900, color:d.c, lineHeight:1 }}>{d.v}</div>
                  <div style={{ fontSize:10, color:`${C.cream}44`, marginTop:3 }}>{d.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Top Properties ── */}
      {topProps.length > 0 && (
        <div style={{ background: isDark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.02)', borderRadius:18, padding:'20px 22px', border:`1px solid ${C.purple}20` }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.cream, marginBottom:14 }}>נכסים שנצפו הכי הרבה</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {topProps.map(([title,cnt],i) => {
              const maxV = topProps[0][1]
              const pct  = Math.round((cnt / maxV) * 100)
              const rankColors = [C.purple, C.green, '#F7C948', '#FF6B6B', '#60D4F7']
              const rc = rankColors[i] || C.purple
              return (
                <div key={i} style={{ position:'relative', borderRadius:11, overflow:'hidden', border:`1px solid ${rc}18` }}>
                  <div style={{ position:'absolute', inset:0, width:`${pct}%`, background:`${rc}10`, borderRadius:11, transition:'width .9s ease', pointerEvents:'none' }}/>
                  <div style={{ position:'relative', display:'flex', alignItems:'center', gap:12, padding:'11px 14px' }}>
                    <div style={{ width:30, height:30, borderRadius:9, background:`${rc}22`, border:`1px solid ${rc}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:12, fontWeight:900, color:rc }}>#{i+1}</span>
                    </div>
                    <span style={{ fontSize:13, color:C.cream, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{title}</span>
                    <span style={{ fontSize:12, color:rc, fontWeight:800, background:`${rc}18`, padding:'3px 12px', borderRadius:20, flexShrink:0, border:`1px solid ${rc}28` }}>{cnt} צפיות</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── External Platforms ── */}
      <div style={{ background: isDark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.02)', borderRadius:18, padding:'20px 22px', border:`1px solid ${C.purple}20` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:8 }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.cream }}>לוחות בקרה חיצוניים</div>
          <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
            {[
              { label:'Meta Pixel', color:'#1877F2' },
              { label:'GA4',        color:'#FF6B35' },
              { label:'LogRocket',  color:'#764ABC' },
            ].map((b,i) => (
              <span key={i} style={{ fontSize:10, color:b.color, background:`${b.color}12`, padding:'3px 10px', borderRadius:20, border:`1px solid ${b.color}30`, fontWeight:800 }}>✦ {b.label} פעיל</span>
            ))}
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {[
            { label:'Google Analytics',      sub:'G-X1S3XX7TRV',           Icon:FaChartBar,  color:'#FF6B35', url:'https://analytics.google.com' },
            { label:'Meta Business Suite',   sub:'Pixels 1311196023271539 + 1341264237748951',  Icon:FaFacebookF, color:'#1877F2', url:'https://business.facebook.com' },
            { label:'Meta Events Manager',   sub:'פיקסל ופרסומות',          Icon:FaBolt,      color:'#F7C948', url:'https://business.facebook.com/events_manager' },
            { label:'Facebook – אפיק הנחל',  sub:'Profile page',            Icon:FaThumbsUp,  color:'#1877F2', url:'https://www.facebook.com/profile.php?id=61573376818745' },
            { label:'Instagram – afik.hanahal', sub:'@afik.hanahal',        Icon:FaInstagram, color:'#E1306C', url:'https://www.instagram.com/afik.hanahal/' },
            { label:'LogRocket Sessions',    sub:'tkrebw/afik-hanahal',     Icon:FaVideo,     color:'#764ABC', url:'https://app.logrocket.com/tkrebw/afik-hanahal' },
          ].map((p,i) => (
            <a key={i} href={p.url} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', flexDirection:'column', gap:6, background:`${p.color}0D`, border:`1px solid ${p.color}30`, borderRadius:13, padding:'14px', textDecoration:'none', color:'inherit', transition:'all .2s', cursor:'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background=`${p.color}1C`; e.currentTarget.style.borderColor=`${p.color}60`; e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow=`0 8px 20px ${p.color}22` }}
              onMouseLeave={e => { e.currentTarget.style.background=`${p.color}0D`; e.currentTarget.style.borderColor=`${p.color}30`; e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow='' }}>
              <div style={{ width:34, height:34, borderRadius:10, background:`${p.color}20`, border:`1px solid ${p.color}44`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <p.Icon size={14} style={{ color:p.color }}/>
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:C.cream, lineHeight:1.3 }}>{p.label}</div>
              <div style={{ fontSize:10, color:`${C.cream}40`, direction:'ltr' }}>{p.sub}</div>
            </a>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'4px 0' }}>
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
  const { lang, logoNavSize, setLogoNavSize } = useTheme()
  // Admin panel is ALWAYS dark regardless of site theme
  const isDark = true
  const C      = DARK_C
  const initForm = () => {
    try { const d = JSON.parse(localStorage.getItem(ADMIN_DRAFT_KEY)); if (d) return { ...EMPTY_PROP, ...d } } catch {}
    return EMPTY_PROP
  }
  const [form, setForm]   = useState(initForm)
  const [editId, setEditId] = useState(null)
  const [err, setErr]     = useState('')
  const [tab, setTab]     = useState(() => {
    const seg = window.location.pathname.replace(/^\/admin-panel\/?/, '')
    return ADMIN_PATH_TO_TAB[seg] || 'props'
  })
  const [adminNavOpen, setAdminNavOpen] = useState(false)

  // Sync URL when tab changes (deep-link routing)
  useEffect(() => {
    const seg = ADMIN_TAB_TO_PATH[tab] ?? ''
    const target = '/admin-panel' + (seg ? '/' + seg : '')
    if (window.location.pathname !== target) history.pushState({}, '', target)
  }, [tab])
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

  const [tokenSaved, setTokenSaved]         = useState(false)
  const [settingsAllSaved, setSettingsAllSaved] = useState(false)
  const tokenSaveTimer   = useRef(null)
  const settingsSaveTimer = useRef(null)

  function saveAllSettings() {
    // Explicitly flush all settings to localStorage
    localStorage.setItem('govmap_token', govmapToken)
    localStorage.setItem('logoNavSize',  String(logoNavSize))
    localStorage.setItem('govmap_default_layers', JSON.stringify(gmLayers))
    localStorage.setItem('govmap_default_bg', gmBg)
    setSettingsAllSaved(true)
    clearTimeout(settingsSaveTimer.current)
    settingsSaveTimer.current = setTimeout(() => setSettingsAllSaved(false), 3000)
  }

  // GovMap management panel state
  const [gmTab,    setGmTab]    = useState('map')   // 'map' | 'layers' | 'bg'
  const [gmLayers, setGmLayers] = useState(() => {
    const d = _cloudSettings.gmLayers
    if (d && typeof d === 'object') return Object.fromEntries(GM_LAYERS.map(l => [l.id, d[l.id] ?? l.on]))
    return Object.fromEntries(GM_LAYERS.map(l => [l.id, l.on]))
  })
  const [gmBg,    setGmBg]    = useState(() => localStorage.getItem('govmap_default_bg') || '0')
  const [gmSaved, setGmSaved] = useState(false)
  const [tokenDraft,   setTokenDraft]   = useState(govmapToken)
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
    }).then(() => { setCloudSettings({ ..._cloudSettings, gmLayers, gmBg }) }).catch(() => {})
    setGmSaved(true); setTimeout(() => setGmSaved(false), 2000)
  }
  // Load cloud settings on mount and sync local state
  useEffect(() => {
    const base = API_BASE || ''
    fetch(`${base}/api/settings`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(cfg => {
        setCloudSettings(cfg)
        if (cfg.gmLayers && typeof cfg.gmLayers === 'object')
          setGmLayers(Object.fromEntries(GM_LAYERS.map(l => [l.id, cfg.gmLayers[l.id] ?? l.on])))
        if (cfg.gmBg) setGmBg(cfg.gmBg)
        if (cfg.waSettings) setWaSt(s => ({ ...s, ...cfg.waSettings }))
        if (typeof cfg.crmWebhook === 'string') setCrmWebhook(cfg.crmWebhook)
        // Mirror cloud Meta lead-source pages into localStorage so MetaLeadsTab's
        // sync picks them up on this device too (cross-device source of truth = cloud).
        if (Array.isArray(cfg.metaLeadSources))
          try { localStorage.setItem(META_LEAD_PAGES_KEY, JSON.stringify(cfg.metaLeadSources)) } catch {}
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

  // Viewport-width tracking was removed when the responsive KPI grid switched
  // to CSS media-queries; the lingering listener was calling a setter that no
  // longer exists, crashing the page render. Intentionally empty.

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
  const [leads, setLeads]           = useState(() => { try { return JSON.parse(localStorage.getItem(LEADS_STORE) || '[]') } catch { return [] } })
  const [trashedLeads, setTrashedLeads] = useState(() => { try { return JSON.parse(localStorage.getItem(LEADS_TRASH) || '[]') } catch { return [] } })
  const [crmWebhook, setCrmWebhook] = useState(() => localStorage.getItem('afik_crm_webhook') || '')
  const [webhookSaved, setWebhookSaved] = useState(false)
  const [waSt, setWaSt] = useState(() => ({ provider:'greenapi', delayMin:2, template:WA_DEFAULT_TEMPLATE, instanceId:'7107558519', apiUrl:'https://7107.api.greenapi.com', token:'', enabled:true, ...(_cloudSettings.waSettings || {}) }))
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
  const [chatsUnread, setChatsUnread] = useState(0)   // total unread WhatsApp msgs (for tab badge)
  const [metaNewLeads, setMetaNewLeads] = useState(0) // unseen new Meta leads (for tab badge)
  const appLoadRef = useRef(Date.now())               // baseline so old history isn't flagged
  const chatsRef = useRef({})                         // latest chats for on-demand recompute
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

  // ── Push notification system ────────────────────────────────────────────────
  const [toasts, setToasts]           = useState([])
  const [notifPerm, setNotifPerm]     = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  )
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false)
  const toastIdRef = useRef(0)

  const requestNotifPermission = useCallback(async () => {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotifPerm(result)
  }, [])

  const showBrowserNotification = useCallback((title, body, onClick) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    // Fire the OS notification regardless of tab focus — when Afik is *inside* the
    // admin tab on a different monitor (or windowed) the in-app toast still fires
    // but the OS banner is what actually catches the eye.
    const n = new Notification(title, { body, icon: '/favicon.ico', tag: 'afik-new-lead', renotify: true })
    if (onClick) n.onclick = () => { window.focus(); onClick(); n.close() }
  }, [])

  // Single short chime via WebAudio — no asset to host, no autoplay block.
  // Lazily allocated AudioContext so the first user gesture is what unlocks it.
  const audioCtxRef = useRef(null)
  const playLeadChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return
        audioCtxRef.current = new Ctx()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      const now = ctx.currentTime
      const tones = [880, 1320] // A5 → E6 — ascending two-note chime
      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, now + i * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.12 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.32)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now + i * 0.12)
        osc.stop(now + i * 0.12 + 0.34)
      })
    } catch {}
  }, [])

  // Document.title alerter — appends "(N) " when there's pending leads/messages
  // even when the admin tab is in the foreground but on a different monitor.
  const titleBaseRef = useRef(document.title)
  const titleCountRef = useRef(0)
  const bumpTitle = useCallback(() => {
    titleCountRef.current += 1
    document.title = `(${titleCountRef.current}) 🔔 ${titleBaseRef.current}`
  }, [])
  useEffect(() => {
    const reset = () => {
      titleCountRef.current = 0
      document.title = titleBaseRef.current
    }
    window.addEventListener('focus', reset)
    return () => window.removeEventListener('focus', reset)
  }, [])

  const addToast = useCallback((title, body, targetTab, icon = '🔔', durationMs = 6000) => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, title, body, targetTab, icon }])
    const timer = setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), durationMs)
    showBrowserNotification(title, body, targetTab ? () => setTab(targetTab) : undefined)
    playLeadChime()
    if (!document.hasFocus()) bumpTitle()
    return () => clearTimeout(timer)
  }, [showBrowserNotification, playLeadChime, bumpTitle]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (leadsSyncing) return
    setLeadsSyncing(true)
    fetch(`${CONTACTS_API}/api/contacts`, { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(serverLeads => {
        if (!Array.isArray(serverLeads)) return
        const deletedIds = new Set(
          JSON.parse(localStorage.getItem(LEADS_DELETED) || '[]').map(String)
        )
        setLeads(prev => {
          const localById = new Map(prev.map(l => [String(l.id), l]))
          // Pull in leads that exist on server but not locally (and weren't deleted)
          const newOnes = serverLeads
            .filter(s => !localById.has(String(s.id)) && !deletedIds.has(String(s.id)))
            .map(s => ({
              id:           String(s.id),
              name:         s.name         || '',
              phone:        s.phone        || '',
              email:        s.email        || '',
              msg:          s.message      || s.msg || '',
              propTitle:    s.prop_title   || s.propTitle   || '',
              propLocation: s.prop_location|| s.propLocation|| '',
              source:       s.source       || 'website',
              ts:           new Date(s.created_at || Date.now()).getTime(),
              ...(s.crm_data || {}),   // restore leadStatus, enrichment, notes, tags
            }))
          if (newOnes.length === 0) return prev
          const merged = [...newOnes, ...prev].sort((a, b) => b.ts - a.ts)
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
    const iv = setInterval(() => { if (!document.hidden) syncLeadsFromServer() }, 15000)
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

  // Count unread WhatsApp messages for the tab badge. Mirrors GreenAPIChat:
  // unread = incoming msgs newer than the last time that chat was opened
  // (tracked in the shared `wa_last_read` localStorage map). Chats never opened
  // are baselined to app load so old history isn't flagged.
  const recomputeChatsUnread = useCallback((chatsObj) => {
    let lastRead = {}
    try { lastRead = JSON.parse(localStorage.getItem('wa_last_read') || '{}') } catch {}
    let n = 0
    for (const p in chatsObj) {
      const base = lastRead[p] ? new Date(lastRead[p]).getTime() : appLoadRef.current
      for (const m of (chatsObj[p] || [])) {
        if (m.direction === 'in' && new Date(m.created_at).getTime() > base) n++
      }
    }
    setChatsUnread(n)
  }, [])

  // Recompute whenever the conversation store changes
  useEffect(() => { chatsRef.current = chats; recomputeChatsUnread(chats) }, [chats, recomputeChatsUnread])

  // Called by GreenAPIChat when a chat is opened/marked read → drop the badge
  const handleChatsRead = useCallback(() => recomputeChatsUnread(chatsRef.current), [recomputeChatsUnread])

  // Clear Meta new-leads badge whenever the Lead Center tab is active
  useEffect(() => { if (tab === 'meta') setMetaNewLeads(0) }, [tab])

  // Global Realtime: track incoming messages across ALL tabs (not just when the
  // chats tab is open) so the sidebar badge stays live even while you're elsewhere.
  useEffect(() => {
    let sb = null, channel = null, cancelled = false
    // Dynamic import keeps @supabase/supabase-js out of the initial bundle —
    // it only loads once the admin panel (this component) is actually mounted.
    import('./lib/supabaseClient').then(({ supabase }) => {
      if (cancelled || !supabase) return
      sb = supabase
      channel = supabase
        .channel('chats_rt_app')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, (payload) => {
          const msg = payload.new
          if (!msg?.id || !msg.phone) return
          const p = intlPhoneFmt(msg.phone)
          setChats(prev => {
            const existing = prev[p] || []
            if (existing.some(m => String(m.id) === String(msg.id))) return prev
            return { ...prev, [p]: [...existing, msg].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) }
          })
        })
        .subscribe()
    }).catch(() => {})
    return () => { cancelled = true; if (sb && channel) sb.removeChannel(channel) }
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
    // Skip polling while the tab is in the background — admins keep the dashboard
    // open for hours, and a hidden tab hammering the API is pure wasted egress.
    chatPollRef.current = setInterval(() => { if (!document.hidden) fetchChats(phone) }, 12000)
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current) }
  }, [selectedLead?.id, fetchChats])

  // Poll chats for selected contact in the dedicated chat tab (every 3s)
  useEffect(() => {
    if (tab !== 'chats' || !chatContact?.phone) return
    fetchChats(chatContact.phone)
    // 3s is plenty responsive for a chat view; the old 500ms fired ~2 req/sec
    // continuously. Also pause entirely while the tab is hidden.
    const interval = setInterval(() => { if (!document.hidden) fetchChats(chatContact.phone) }, 3000)
    return () => clearInterval(interval)
  }, [chatContact?.id, tab, fetchChats]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll all conversations list (sidebar last messages) every 8s when in chats tab
  useEffect(() => {
    if (tab !== 'chats') return
    fetchAllChats()
    const id = setInterval(() => { if (!document.hidden) fetchAllChats() }, 8000)
    return () => clearInterval(id)
  }, [tab, fetchAllChats]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch Green API status when chats tab opens
  useEffect(() => {
    if (tab !== 'chats') return
    fetchChatStatus()
    const id = setInterval(() => { if (!document.hidden) fetchChatStatus() }, 60000)
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
    }).then(() => { setCloudSettings({ ..._cloudSettings, waSettings: waSt }) }).catch(() => {})
    setWaSaved(true); setTimeout(() => setWaSaved(false), 2500)
  }
  const testWA = async () => {
    setWaTesting(true); setWaTestResult('')
    // Server-side send — the Green API token lives in Vercel env (WA_GREENAPI_TOKEN)
    try {
      const r = await fetch(`/api/contacts?action=test-wa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
        body: JSON.stringify({ phone: '0559811814' }),
        signal: AbortSignal.timeout(20000),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) console.error('[test-wa]', j.error)
      setWaTestResult(r.ok && j.ok ? 'ok' : 'err')
    } catch (e) {
      console.error('[test-wa] fetch failed:', e.message)
      setWaTestResult('err')
    }
    setWaTesting(false); setTimeout(() => setWaTestResult(''), 4000)
  }

  const testEmail = async () => {
    setEmailTesting(true); setEmailTestResult('')
    try {
      const r = await fetch(`/api/contacts?action=test-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
        signal: AbortSignal.timeout(20000),
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

  const tabBtn = (id, label, badge) => {
    const isAlert = id === 'meta'
    return (
      <button onClick={() => setTab(id)} style={{ padding:'10px 20px', border:'none', background:tab===id?`${C.purple}30`:'transparent', color:tab===id?C.purple:`${C.cream}65`, fontFamily:'inherit', cursor:'pointer', fontWeight:700, fontSize:14, borderRadius:9, transition:'all .15s', display:'flex', alignItems:'center', gap:7, boxShadow: tab===id ? `0 2px 10px ${C.purple}22` : 'none' }}>
        {label}
        {!!badge && <span style={{ background: isAlert ? '#E05252' : C.green, color: isAlert ? '#fff' : '#09090F', borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:900, lineHeight:1.6 }}>{badge}</span>}
      </button>
    )
  }

  const updateLead = (id, patch) => {
    setLeads(prev => {
      const next = prev.map(l => l.id === id ? { ...l, ...patch } : l)
      try { localStorage.setItem(LEADS_STORE, JSON.stringify(next)) } catch {}
      return next
    })
    fetch(`${CONTACTS_API}/api/contacts?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify(patch),
    }).catch(() => {})
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
    const lead = leads.find(l => l.id === id)
    const next = leads.filter(l => l.id !== id)
    setLeads(next)
    if (selectedLead?.id === id) setSelectedLead(null)
    try { localStorage.setItem(LEADS_STORE, JSON.stringify(next)) } catch {}
    // Track deleted ID to block re-sync from server
    try {
      const deleted = new Set(JSON.parse(localStorage.getItem(LEADS_DELETED) || '[]'))
      deleted.add(String(id))
      localStorage.setItem(LEADS_DELETED, JSON.stringify([...deleted]))
    } catch {}
    // Save full lead to trash for restore
    if (lead) {
      try {
        const trash = JSON.parse(localStorage.getItem(LEADS_TRASH) || '[]')
        trash.unshift({ ...lead, deletedAt: Date.now() })
        localStorage.setItem(LEADS_TRASH, JSON.stringify(trash.slice(0, 200)))
        setTrashedLeads(trash.slice(0, 200))
      } catch {}
    }
    fetch(`${CONTACTS_API}/api/contacts?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    }).catch(() => {})
  }
  const clearLeads = () => {
    if (!window.confirm('למחוק את כל הלידים לצמיתות?')) return
    try {
      const deleted = new Set(JSON.parse(localStorage.getItem(LEADS_DELETED) || '[]'))
      leads.forEach(l => deleted.add(String(l.id)))
      localStorage.setItem(LEADS_DELETED, JSON.stringify([...deleted]))
    } catch {}
    // Move all to trash
    try {
      const existing = JSON.parse(localStorage.getItem(LEADS_TRASH) || '[]')
      const now = Date.now()
      const newTrash = [...leads.map(l => ({ ...l, deletedAt: now })), ...existing].slice(0, 200)
      localStorage.setItem(LEADS_TRASH, JSON.stringify(newTrash))
      setTrashedLeads(newTrash)
    } catch {}
    setLeads([])
    setSelectedLead(null)
    try { localStorage.setItem(LEADS_STORE, '[]') } catch {}
    if (API_BASE) fetch(`${API_BASE}/api/contacts`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    }).then(r => {
      if (r.ok) {
        pendingDeletes.current.clear()
        try { localStorage.setItem(LEADS_DELETED, '[]') } catch {}
      }
    })
      .catch(() => {})
  }
  const restoreLead = id => {
    try {
      const trash = JSON.parse(localStorage.getItem(LEADS_TRASH) || '[]')
      const lead = trash.find(l => String(l.id) === String(id))
      if (!lead) return
      // Remove from trash
      const newTrash = trash.filter(l => String(l.id) !== String(id))
      localStorage.setItem(LEADS_TRASH, JSON.stringify(newTrash))
      setTrashedLeads(newTrash)
      // Remove from deleted set
      const deleted = new Set(JSON.parse(localStorage.getItem(LEADS_DELETED) || '[]'))
      deleted.delete(String(id))
      localStorage.setItem(LEADS_DELETED, JSON.stringify([...deleted]))
      // Restore to active leads (without deletedAt)
      // eslint-disable-next-line no-unused-vars
      const { deletedAt, ...leadData } = lead
      setLeads(prev => {
        const next = [leadData, ...prev.filter(l => String(l.id) !== String(id))]
          .sort((a, b) => b.ts - a.ts)
        try { localStorage.setItem(LEADS_STORE, JSON.stringify(next)) } catch {}
        return next
      })
      // Re-sync to server
      fetch(`${CONTACTS_API}/api/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
        body: JSON.stringify(leadData),
      }).catch(() => {})
    } catch {}
  }
  const permanentDeleteLead = id => {
    try {
      const trash = JSON.parse(localStorage.getItem(LEADS_TRASH) || '[]')
      const newTrash = trash.filter(l => String(l.id) !== String(id))
      localStorage.setItem(LEADS_TRASH, JSON.stringify(newTrash))
      setTrashedLeads(newTrash)
    } catch {}
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
    { id:'meta',     Icon:FaFacebookF,   label:'Lead Center', badge: metaNewLeads || undefined },
    { id:'live',     Icon:FaCheckCircle, label:'באוויר',      badge: publishedList.length, live:true },
    { id:'props',    Icon:FaBuilding,    label:'ניהול נכסים' },
    { id:'leads',    Icon:FaHandshake,   label:'לידים',       badge: leads.length },
    { id:'sellers',  Icon:FaClipboardList, label:'נכסים שנקלטו' },
    { id:'chats',    Icon:FaWhatsapp,    label:'צ\'אטים',     badge: chatsUnread },
    { id:'analytics',    Icon:FaChartLine,   label:'אנליטיקס' },
    { id:'supermetrics', Icon:FaChartBar,   label:'ביצועים' },
    { id:'team',         Icon:FaKey,         label:'צוות' },
    { id:'counters', Icon:FaBalanceScale,label:'מונים' },
    { id:'settings', Icon:FaTools,       label:'הגדרות' },
  ]
  const TAB_LABELS = { overview:'סקירה כללית', live:'נכסים באוויר', props:'ניהול נכסים', leads:'לידים', sellers:'נכסים שנקלטו', chats:'שיחות WhatsApp', meta:'מרכז מטא', analytics:'אנליטיקס', supermetrics:'ביצועים', team:'צוות', counters:'מונים', settings:'הגדרות' }

  return (
    <div className="admin-shell admin-scroll" style={standalone
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
                  {!!item.badge && <span style={{ background: isLive ? 'rgba(34,197,94,.2)' : item.id==='chats' ? '#075E54' : item.id==='meta' ? 'rgba(224,82,82,.18)' : `${C.purple}25`, color: isLive ? '#22C55E' : item.id==='chats' ? '#fff' : item.id==='meta' ? '#E05252' : C.purple, borderRadius:4, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{item.badge}</span>}
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
        : (tab==='chats'||tab==='leads'||tab==='meta')
          ? { background:C.card, border:`1px solid ${C.purple}33`, borderRadius:16, padding:0, width:'100%', maxWidth:'98vw', height:'94vh', overflow:'hidden', direction:'rtl', boxShadow:'0 32px 80px rgba(0,0,0,.7)', display:'flex', flexDirection:'column' }
          : { background:C.card, border:`1px solid ${C.purple}33`, borderRadius:16, padding:'28px 28px 0', width:'100%', maxWidth:1200, height:'94vh', overflow:'hidden', direction:'rtl', boxShadow:'0 32px 80px rgba(0,0,0,.7)', display:'flex', flexDirection:'column' }}>

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
              <div style={{ width:1, height:18, background:'rgba(132,144,216,.15)', flexShrink:0, marginRight:2 }}/>
              <button
                onClick={() => { setTab('meta'); setMetaNewLeads(0) }}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 14px', background: tab==='meta' ? 'rgba(132,144,216,.22)' : 'rgba(132,144,216,.08)', border:`1px solid ${tab==='meta' ? 'rgba(132,144,216,.5)' : 'rgba(132,144,216,.2)'}`, borderRadius:20, color: tab==='meta' ? '#A0ACFF' : 'rgba(132,144,216,.7)', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700, transition:'all .18s', position:'relative' }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(132,144,216,.18)'; e.currentTarget.style.borderColor='rgba(132,144,216,.45)'; e.currentTarget.style.color='#A0ACFF' }}
                onMouseLeave={e=>{ if(tab!=='meta'){ e.currentTarget.style.background='rgba(132,144,216,.08)'; e.currentTarget.style.borderColor='rgba(132,144,216,.2)'; e.currentTarget.style.color='rgba(132,144,216,.7)' }}}>
                <FaFacebookF size={11}/>
                <span>Lead Center</span>
                {metaNewLeads > 0 && (
                  <span style={{ background:'#E05252', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10, fontWeight:900, lineHeight:1.6, minWidth:18, textAlign:'center' }}>{metaNewLeads}</span>
                )}
              </button>
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
              <button onClick={onClose}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 15px', background:'rgba(224,82,82,.08)', border:'1px solid rgba(224,82,82,.28)', borderRadius:20, color:'rgba(224,82,82,.75)', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700, transition:'all .2s' }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(224,82,82,.2)'; e.currentTarget.style.borderColor='#E05252'; e.currentTarget.style.color='#E05252' }}
                onMouseLeave={e=>{ e.currentTarget.style.background='rgba(224,82,82,.08)'; e.currentTarget.style.borderColor='rgba(224,82,82,.28)'; e.currentTarget.style.color='rgba(224,82,82,.75)' }}>
                <FaTimes size={11}/> <span>יציאה</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal header */}
        {!standalone && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, paddingBottom:14, borderBottom:`1px solid ${C.purple}22`, flexShrink:0 }}>
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
          <div style={{ background:'rgba(224,82,82,.12)', border:'1px solid rgba(224,82,82,.35)', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10, direction:'rtl', flexShrink:0 }}>
            <FaExclamationTriangle size={15} style={{ color:'#E05252', flexShrink:0 }}/>
            <span style={{ fontSize:13, color:'#E05252', fontWeight:600 }}>{supabaseWarning}</span>
            <button onClick={() => setSupabaseWarning('')} style={{ marginRight:'auto', background:'none', border:'none', color:'rgba(224,82,82,.6)', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 4px' }}>×</button>
          </div>
        )}

        {/* Push notification permission banner */}
        {!notifBannerDismissed && notifPerm === 'default' && (
          <div style={{ background:'rgba(247,201,72,.09)', border:'1px solid rgba(247,201,72,.35)', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10, direction:'rtl', flexWrap:'wrap', flexShrink:0 }}>
            <span style={{ fontSize:18, flexShrink:0 }}>🔔</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#F7C948' }}>הפעל התראות דחיפה</div>
              <div style={{ fontSize:11, color:'rgba(247,201,72,.65)', marginTop:2 }}>Enable push notifications for new leads &amp; messages</div>
            </div>
            <button onClick={requestNotifPermission}
              style={{ background:'rgba(247,201,72,.18)', border:'1px solid rgba(247,201,72,.5)', borderRadius:8, padding:'6px 14px', color:'#F7C948', cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:700, flexShrink:0, whiteSpace:'nowrap', transition:'background .15s' }}
              onMouseEnter={e=>{ e.currentTarget.style.background='rgba(247,201,72,.32)' }}
              onMouseLeave={e=>{ e.currentTarget.style.background='rgba(247,201,72,.18)' }}>
              אשר הרשאה
            </button>
            <button onClick={() => setNotifBannerDismissed(true)} style={{ background:'none', border:'none', color:'rgba(247,201,72,.5)', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 4px', flexShrink:0 }}>×</button>
          </div>
        )}
        {!notifBannerDismissed && notifPerm === 'denied' && (
          <div style={{ background:'rgba(156,163,175,.07)', border:'1px solid rgba(156,163,175,.25)', borderRadius:10, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10, direction:'rtl', flexWrap:'wrap', flexShrink:0 }}>
            <span style={{ fontSize:18, flexShrink:0 }}>🔕</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'rgba(232,228,216,.7)' }}>התראות חסומות בדפדפן</div>
              <div style={{ fontSize:11, color:'rgba(232,228,216,.4)', marginTop:2 }}>Notifications blocked — open Chrome Settings → Site Settings → Notifications → allow this site</div>
            </div>
            <button onClick={() => setNotifBannerDismissed(true)} style={{ background:'none', border:'none', color:'rgba(156,163,175,.45)', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 4px', flexShrink:0 }}>×</button>
          </div>
        )}

        {/* Modal tabs */}
        {!standalone && (
          <div style={{ display:'flex', gap:4, marginBottom:12, background:'rgba(255,255,255,.04)', borderRadius:10, padding:4, flexWrap:'wrap', flexShrink:0 }}>
            {tabBtn('meta', 'Lead Center', metaNewLeads || undefined)}
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
            {tabBtn('supermetrics', 'ביצועים')}
            {tabBtn('team', 'צוות')}
            {tabBtn('counters', 'מונים')}
            {tabBtn('settings', 'הגדרות')}
          </div>
        )}

        {/* ── Scrollable content ─────────────────────────────────────── */}
        <div className="admin-content" style={(tab==='chats'||tab==='leads'||tab==='meta') ? { flex:1, minHeight:0, overflow:'hidden', position:'relative', display:'flex', flexDirection:'column' } : { flex:1, minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch', overscrollBehavior:'contain', scrollBehavior:'smooth', padding:'22px 26px 32px', direction:'rtl' }}>

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
                    {p.images?.[0]?<img src={thumbImg(p.images[0])} onError={imgFallback} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:<div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><FaBuilding size={12} style={{color:'rgba(132,144,216,.5)'}}/></div>}
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
                          <img src={thumbImg(p.images[0])} onError={imgFallback} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} alt="" loading="lazy" decoding="async"/>
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
        {tab==='supermetrics' && (
          <Suspense fallback={<AdminTabLoader label="טוען ביצועים…"/>}>
            <SupermetricsTab C={C} lang={lang}/>
          </Suspense>
        )}
        {tab==='sellers' && (
          <div style={{ height:'100%', minHeight:'calc(100vh - 180px)' }}>
            <Suspense fallback={<AdminTabLoader label="טוען נכסים שנקלטו…"/>}>
              <SellerSubmissionsTab C={C}/>
            </Suspense>
          </div>
        )}
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
          <div className="admin-board-dark" style={{ position:'absolute', inset:0, overflow:'hidden' }}>
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
                trashedLeads={trashedLeads}
                restoreLead={restoreLead}
                permanentDeleteLead={permanentDeleteLead}
                leadsSyncing={leadsSyncing}
                isDark={true}
                lang={lang}
                onOpenChat={lead => { setInitialChatLead(lead); setTab('chats') }}
              />
            </Suspense>
          </div>
        )}

        {tab==='chats' && (
          <Suspense fallback={<AdminTabLoader label="צ'אטים" />}>
            <GreenAPIChat
              leads={leads}
              lang={lang}
              initialContact={initialChatLead}
              onOpenLead={lead => { setInitialChatLead(null); setTab('leads') }}
              onDeleteLead={id => deleteLead(id)}
              onNewMessage={({ contactName, message }) => addToast(
                lang === 'en' ? `New message from ${contactName}` : `הודעה חדשה מ-${contactName}`,
                message, 'chats', '💬'
              )}
              onSentMessage={({ contactName, message }) => addToast(
                lang === 'en' ? `Sent to ${contactName}` : `נשלח ל-${contactName}`,
                message, 'chats', '✅', 3500
              )}
              onReadChange={handleChatsRead}
            />
          </Suspense>
        )}

        {tab==='meta' && (
          <Suspense fallback={<AdminTabLoader label="מרכז מטא" />}>
            <MetaLeadsTab C={DARK_C} lang={lang} isDark={true}
              onNewLead={({ name, campaign }) => {
                if (tab !== 'meta') setMetaNewLeads(v => v + 1)
                addToast(
                  lang === 'en' ? 'New Meta Lead!' : 'ליד חדש ממטא!',
                  (name || (lang === 'en' ? 'Unknown' : 'לא ידוע')) + (campaign ? ' • ' + campaign : ''),
                  'meta', '🎯'
                )
              }}
              onNewMetaMessage={({ leadName, message }) => addToast(
                lang === 'en' ? `Message from ${leadName}` : `הודעה מ-${leadName}`,
                message, 'meta', '💬'
              )}
              onSentMetaMessage={({ leadName, message }) => addToast(
                lang === 'en' ? `Sent to ${leadName}` : `נשלח ל-${leadName}`,
                message, 'meta', '✅', 3500
              )}
              onSaveToCRM={metaLead => {
                if (metaLead) {
                  const newId = 'meta_' + metaLead.id
                  setLeads(prev => {
                    if (prev.some(l => l.id === newId)) return prev
                    const next = [...prev, {
                      id: newId,
                      name: metaLead.name || '',
                      phone: metaLead.phone || '',
                      email: metaLead.email || '',
                      msg: metaLead.notes || '',
                      propTitle: metaLead.campaign_name || metaLead.form_name || 'מרכז מטא',
                      ts: new Date(metaLead.created_at).getTime() || Date.now(),
                      leadStatus: 'new',
                    }]
                    try { localStorage.setItem(LEADS_STORE, JSON.stringify(next)) } catch {}
                    return next
                  })
                }
                setTab('leads')
              }}
              onOpenChat={metaLead => {
                setInitialChatLead({ id: 'meta_' + metaLead.id, name: metaLead.name || '', phone: metaLead.phone || '', email: metaLead.email || '' })
                setTab('chats')
              }}
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

            {/* ── Settings header with auto-save indicator + save button ── */}
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', background:`${C.green}0D`, border:`1px solid ${C.green}28`, borderRadius:12, direction:'rtl', flexWrap:'wrap' }}>
              <span style={{ width:9, height:9, borderRadius:'50%', background:C.green, flexShrink:0, boxShadow:`0 0 8px ${C.green}` }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <span style={{ fontSize:13, color:C.green, fontWeight:700 }}>שמירה אוטומטית פעילה</span>
                <span style={{ fontSize:12, color:`${C.cream}44`, marginRight:8 }}>— כל שינוי נשמר מיידית לדפדפן</span>
              </div>
              <button onClick={saveAllSettings}
                style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 20px', background: settingsAllSaved ? `${C.green}22` : `${C.purple}22`, border:`1px solid ${settingsAllSaved ? C.green : `${C.purple}55`}`, borderRadius:9, color: settingsAllSaved ? C.green : C.purple, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', transition:'all .25s', flexShrink:0 }}>
                {settingsAllSaved ? '✓ כל ההגדרות נשמרו' : '💾 שמור הכל'}
              </button>
              <button onClick={onClose}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'rgba(224,82,82,.08)', border:'1px solid rgba(224,82,82,.28)', borderRadius:9, color:'rgba(224,82,82,.8)', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', transition:'all .2s', flexShrink:0 }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(224,82,82,.2)'; e.currentTarget.style.borderColor='#E05252'; e.currentTarget.style.color='#E05252' }}
                onMouseLeave={e=>{ e.currentTarget.style.background='rgba(224,82,82,.08)'; e.currentTarget.style.borderColor='rgba(224,82,82,.28)'; e.currentTarget.style.color='rgba(224,82,82,.8)' }}>
                <FaTimes size={11}/> יציאה
              </button>
            </div>

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
              <input
                type="text"
                value={govmapToken}
                onChange={e => {
                  setGovmapToken(e.target.value)
                  clearTimeout(tokenSaveTimer.current)
                  tokenSaveTimer.current = setTimeout(() => {
                    setTokenSaved(true)
                    setSettingsAllSaved(true)
                    setTimeout(() => { setTokenSaved(false); setSettingsAllSaved(false) }, 2500)
                  }, 500)
                }}
                placeholder="הדבק כאן את מפתח ה-API שקיבלת מ-GovMap"
                style={{ ...inp, direction:'ltr', fontFamily:'monospace', fontSize:12, marginBottom:10, border:`1px solid ${tokenSaved ? C.green : `${C.purple}33`}`, transition:'border-color .3s' }}
              />
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
                <button
                  onClick={() => { saveAllSettings(); setTokenSaved(true); setTimeout(() => setTokenSaved(false), 2500) }}
                  style={{ padding:'7px 18px', background: tokenSaved ? `${C.green}22` : `${C.purple}22`, border:`1px solid ${tokenSaved ? C.green : `${C.purple}44`}`, borderRadius:8, color: tokenSaved ? C.green : C.purple, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'all .25s', display:'flex', alignItems:'center', gap:6 }}>
                  {tokenSaved ? '✓ נשמר' : '💾 שמור מפתח'}
                </button>
                <span style={{ fontSize:11, color:`${C.cream}44`, display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background: C.green, display:'inline-block', flexShrink:0 }}/>
                  שמירה אוטומטית פעילה
                </span>
                {govmapToken && (
                  <button onClick={() => { setGovmapToken(''); setTokenSaved(false) }} style={{ background:'none', border:'none', color:`${C.cream}44`, cursor:'pointer', fontSize:11, textDecoration:'underline', fontFamily:'inherit', marginRight:'auto' }}>נקה מפתח</button>
                )}
              </div>
              <div style={{ background:`${C.purple}08`, border:`1px solid ${C.purple}22`, borderRadius:8, padding:'12px 14px', fontSize:12, color:`${C.cream}77`, lineHeight:1.8, direction:'rtl' }}>
                <strong style={{ color:C.purple }}>כיצד לקבל מפתח API:</strong><br/>
                1. כנס לאתר <a href="https://www.govmap.gov.il" target="_blank" rel="noopener noreferrer" style={{ color:C.purple }}>govmap.gov.il</a><br/>
                2. פנה לצוות GovMap בבקשה לרישום דומיין ומפתח API<br/>
                3. הזן כאן את המפתח שתקבל<br/>
                <span style={{ color:`${C.cream}44`, fontSize:11 }}>* המפתח נשמר אוטומטית בדפדפן ולא יועלה לשום שרת</span>
              </div>
              {govmapToken && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:10, fontSize:12 }}>
                  <span style={{ color:C.green, fontWeight:700 }}>✓ מפתח מוגדר</span>
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
                <strong style={{ color:C.purple }}>הגדרה נדרשת ב-Vercel (env vars):</strong><br/>
                1. כנס ל-<strong style={{ color:C.cream }}>vercel.com → הפרוייקט שלך → Settings → Environment Variables</strong><br/>
                2. הוסף: <code style={{ background:'rgba(0,0,0,.3)', borderRadius:4, padding:'1px 6px', fontFamily:'monospace', fontSize:11, color:'#EA4335' }}>GMAIL_USER</code> = <code style={{ fontFamily:'monospace', fontSize:11 }}>afik.hanahal@gmail.com</code><br/>
                3. הוסף: <code style={{ background:'rgba(0,0,0,.3)', borderRadius:4, padding:'1px 6px', fontFamily:'monospace', fontSize:11, color:'#EA4335' }}>GMAIL_APP_PASSWORD</code> = סיסמת אפליקציה (16 תווים מ-Google)<br/>
                4. לקבל סיסמת אפליקציה: <strong style={{ color:C.cream }}>Google Account → Security → 2-Step Verification → App Passwords</strong><br/>
                <span style={{ color:`${C.cream}44`, fontSize:11 }}>* לאחר הוספת env vars ב-Vercel — הפרוייקט יעלה מחדש אוטומטית. הכישלון הקודם היה כי ה-vars היו רק ב-Render.</span>
              </div>

              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <button onClick={testEmail} disabled={emailTesting}
                  style={{ padding:'9px 20px', background:'rgba(234,67,53,.1)', border:'1px solid rgba(234,67,53,.3)', borderRadius:8, color:'#EA4335', fontWeight:700, fontSize:12, cursor:emailTesting?'not-allowed':'pointer', fontFamily:'inherit' }}>
                  {emailTesting ? '⟳ שולח...' : '✉ שלח אימייל בדיקה'}
                </button>
                {emailTestResult === 'ok'  && <span style={{ fontSize:12, color:C.green, fontWeight:700 }}>✓ אימייל בדיקה נשלח ל-afik.hanahal@gmail.com</span>}
                {emailTestResult === 'err' && <span style={{ fontSize:12, color:'#E05252', fontWeight:700 }}>✕ שגיאה — בדוק GMAIL_USER ו-GMAIL_APP_PASSWORD ב-Vercel env vars</span>}
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
                <button onClick={testWA} disabled={waTesting}
                  style={{ padding:'9px 20px', background:'rgba(130,246,127,.1)', border:'1px solid rgba(130,246,127,.3)', borderRadius:8, color: C.green, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit', opacity: waTesting ? .45 : 1 }}>
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
                    }).then(() => { setCloudSettings({ ..._cloudSettings, crmWebhook }) }).catch(() => {})
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
                    }).then(() => { setCloudSettings({ ..._cloudSettings, crmWebhook: '' }) }).catch(() => {})
                  }} style={{ background:'none', border:'none', color:`${C.cream}55`, cursor:'pointer', fontSize:11, textDecoration:'underline', fontFamily:'inherit' }}>נקה</button>
                </div>
              )}
            </div>

            {/* ── Meta WhatsApp Business API Bot ─────────────────────────── */}
            <MetaWABotCard C={C} isDark={isDark}/>

            {/* ── Meta Accounts → Lead Sources ───────────────────────────── */}
            <MetaLeadSourcesCard C={C}/>

            {/* ── Meta Pixel ─────────────────────────────────────────────────── */}
            <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'rgba(24,119,242,.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <FaFacebookF size={14} style={{ color:'#1877F2' }}/>
                </div>
                <div>
                  <h3 style={{ fontSize:14, fontWeight:700, color:C.purple, margin:0 }}>Meta Pixel — פיקסלי מעקב</h3>
                  <div style={{ fontSize:11, color:`${C.cream}55`, marginTop:3 }}>שני פיקסלים פעילים באתר — עוקבים אחרי ביקורים, לידים ואירועי המרה (Pixel + CAPI)</div>
                </div>
              </div>

              {/* Status cards — both pixels fire on every event (Pixel + Conversions API) */}
              {[
                { id:'1311196023271539', name:'הפיקסל של אפיק הנחל' },
                { id:'1341264237748951', name:'פיקסל קודם (legacy)' },
              ].map(px => (
                <div key={px.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'rgba(34,197,94,.06)', border:'1px solid rgba(34,197,94,.25)', borderRadius:10, marginBottom:10 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 8px #22C55E', flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <span style={{ fontSize:13, color:'#22C55E', fontWeight:700 }}>פעיל</span>
                    <span style={{ fontSize:12, color:`${C.cream}44`, marginRight:8 }}>— {px.name}</span>
                  </div>
                  <code style={{ fontSize:12, color:'#1877F2', background:'rgba(24,119,242,.1)', padding:'3px 10px', borderRadius:6, fontFamily:'monospace', border:'1px solid rgba(24,119,242,.2)' }}>
                    {px.id}
                  </code>
                </div>
              ))}
              <div style={{ height:4 }}/>

              {/* Events tracked */}
              <div style={{ fontSize:11, color:`${C.cream}66`, marginBottom:12, fontWeight:700 }}>אירועים שנמדדים:</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
                {[
                  { label:'PageView',    color:'#8490D8', desc:'כל ביקור בדף' },
                  { label:'Lead',        color:'#22C55E', desc:'מילוי טופס ליד' },
                  { label:'ViewContent', color:'#F97316', desc:'צפייה בנכס' },
                  { label:'Contact',     color:'#3B82F6', desc:'יצירת קשר' },
                ].map(ev => (
                  <div key={ev.label} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background:`${ev.color}12`, border:`1px solid ${ev.color}30`, borderRadius:8 }}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:ev.color, flexShrink:0 }}/>
                    <span style={{ fontSize:11, fontWeight:700, color:ev.color }}>{ev.label}</span>
                    <span style={{ fontSize:10, color:`${C.cream}44` }}>— {ev.desc}</span>
                  </div>
                ))}
              </div>

              {/* UTM tip */}
              <div style={{ background:'rgba(24,119,242,.06)', border:'1px solid rgba(24,119,242,.2)', borderRadius:8, padding:'12px 14px', fontSize:12, color:`${C.cream}88`, lineHeight:1.8, direction:'rtl' }}>
                <strong style={{ color:'#1877F2' }}>טיפ — URL קמפיין עם UTM:</strong><br/>
                בקמפיין ב-Meta Ads Manager, הגדר Destination URL:
                <code style={{ display:'block', marginTop:6, padding:'8px 10px', background:'rgba(0,0,0,.25)', borderRadius:6, fontFamily:'monospace', fontSize:11, color:'#A0ACFF', wordBreak:'break-all', direction:'ltr' }}>
                  https://afikhanahal.co.il/?utm_source=facebook&utm_medium=paid&utm_campaign=<span style={{ color:'#22C55E' }}>שם_קמפיין</span>
                </code>
              </div>

              {/* Open Events Manager */}
              <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener noreferrer"
                style={{ display:'inline-flex', alignItems:'center', gap:7, marginTop:14, padding:'8px 16px', background:'rgba(24,119,242,.1)', border:'1px solid rgba(24,119,242,.3)', borderRadius:8, color:'#1877F2', fontSize:12, fontWeight:700, textDecoration:'none', transition:'all .15s' }}
                onMouseEnter={e=>{ e.currentTarget.style.background='rgba(24,119,242,.2)' }}
                onMouseLeave={e=>{ e.currentTarget.style.background='rgba(24,119,242,.1)' }}>
                <FaFacebookF size={11}/>
                פתח Meta Events Manager
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>

            {/* GovMap Management Panel */}
            {govmapToken ? (
              <div style={{ background:'rgba(255,255,255,.02)', borderRadius:12, border:`1px solid ${C.purple}22`, overflow:'hidden' }}>
                {/* Tab bar — map tab removed (not relevant in settings) */}
                <div style={{ display:'flex', borderBottom:`1px solid ${C.purple}22` }}>
                  {[
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
            <Suspense fallback={null}>
              <PropertyWizard
                onClose={() => setWizardOpen(false)}
                onPublish={(prop) => {
                  setProperties(prev => [...prev, prop])
                  saveProp(prop)
                  setWizardOpen(false)
                  setTab('props')
                }}
              />
            </Suspense>
          </div>
        )}

      </div>

      {/* ── Push notification toasts — bottom-right ──────────────────── */}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <div style={{ position:'fixed', bottom:24, right:24, zIndex:99999, display:'flex', flexDirection:'column-reverse', gap:10, pointerEvents:'none', maxWidth:340 }}>
        {toasts.map(toast => (
          <div key={toast.id}
            onClick={() => { setToasts(prev => prev.filter(t => t.id !== toast.id)); if (toast.targetTab) setTab(toast.targetTab) }}
            style={{ pointerEvents:'auto', background:'#1F2C33', border:'1px solid rgba(132,144,216,.35)', borderRadius:12, padding:'12px 14px 12px 16px', boxShadow:'0 6px 24px rgba(0,0,0,.55)', cursor:toast.targetTab?'pointer':'default', fontFamily:'Rubik,sans-serif', display:'flex', gap:10, alignItems:'flex-start', animation:'toastIn .25s ease', direction:'rtl' }}>
            <div style={{ fontSize:22, flexShrink:0, lineHeight:1 }}>{toast.icon || '🔔'}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#E9EDEF', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{toast.title}</div>
              <div style={{ fontSize:12, color:'#8696A0', lineHeight:1.45, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{toast.body}</div>
              {toast.targetTab && <div style={{ fontSize:11, color:'#8490D8', marginTop:4, fontWeight:600 }}>{lang==='en'?'Click to open →':'לחץ לפתיחה ←'}</div>}
            </div>
            <button onClick={e => { e.stopPropagation(); setToasts(prev => prev.filter(t => t.id !== toast.id)) }}
              style={{ background:'none', border:'none', color:'#8696A0', cursor:'pointer', fontSize:15, padding:0, lineHeight:1, flexShrink:0, marginTop:1 }}>✕</button>
          </div>
        ))}
      </div>

      {/* ── Mobile bottom tab bar — standalone only ──────────────────── */}
      {standalone && (
        <nav className="admin-bottom-nav">
          {DASH_TABS.slice(0,5).map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, border:'none', background:'transparent', color: tab===item.id ? '#8490D8' : 'rgba(232,228,216,.32)', cursor:'pointer', fontFamily:'inherit', padding:'8px 4px', position:'relative', transition:'color .15s', minWidth:0 }}>
              <item.Icon size={18}/>
              <span style={{ fontSize:9, fontWeight: tab===item.id ? 700 : 400, letterSpacing:'.02em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%' }}>{item.label}</span>
              {!!item.badge && <span style={{ position:'absolute', top:6, right:'50%', transform:'translateX(140%)', background: item.id==='chats' ? '#075E54' : '#8490D8', color:'#fff', borderRadius:8, padding:'1px 5px', fontSize:8, fontWeight:800, lineHeight:1.6 }}>{item.badge}</span>}
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

// ─── META LEAD SOURCES (ad accounts → lead pages) ─────────────────────────────
// The Lead Center pulls leads PER FACEBOOK PAGE (api/meta.js → /{pageId}/leadgen_forms).
// An ad account runs the campaigns, but the leads are collected on a Page. This card
// lets the admin register additional ad-account → page mappings; each enabled pageId
// is added to MetaLeadsTab's sync loop (alongside the hardcoded main page).
const META_MAIN_PAGE_ID = '591701444021114'

function MetaLeadSourcesCard({ C }) {
  const { lang } = useTheme()
  const en = lang === 'en'
  const [sources, setSources] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(META_LEAD_PAGES_KEY) || 'null')
      if (Array.isArray(raw) && raw.length) return raw
    } catch {}
    // Seed with the אפיק הנחל ad account + its lead page (afik.hanahal, 999391656594390 —
    // the page the campaigns and the site are connected to).
    return [{ id: 'src_afik_main', name: 'אפיק הנחל', adAccountId: '1130143728423686', pageId: '999391656594390', enabled: true }]
  })
  const [saved, setSaved] = useState(false)

  const update = (id, patch) => setSources(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  const remove = (id) => setSources(prev => prev.filter(s => s.id !== id))
  const add = () => setSources(prev => [...prev, { id: 'src_' + Date.now(), name: '', adAccountId: '', pageId: '', enabled: true }])

  const save = () => {
    const clean = sources.filter(s => s.name || s.adAccountId || s.pageId)
    try { localStorage.setItem(META_LEAD_PAGES_KEY, JSON.stringify(clean)) } catch {}
    const base = API_BASE || ''
    fetch(`${base}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_TOKEN}` },
      body: JSON.stringify({ metaLeadSources: clean }),
    }).then(() => { setCloudSettings({ ..._cloudSettings, metaLeadSources: clean }) }).catch(() => {})
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const inp = { width:'100%', padding:'9px 12px', background:'rgba(255,255,255,.05)', border:`1px solid ${C.purple}33`, borderRadius:8, color:C.cream, fontSize:13, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const lbl = { fontSize:10, color:`${C.cream}66`, display:'block', marginBottom:4, fontWeight:600 }

  return (
    <div style={{ background:'rgba(255,255,255,.03)', borderRadius:12, padding:20 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:'rgba(24,119,242,.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <FaFacebookF size={14} style={{ color:'#1877F2' }}/>
        </div>
        <div>
          <h3 style={{ fontSize:14, fontWeight:700, color:C.purple, margin:0 }}>{en ? 'Meta Accounts — Lead Sources' : 'חשבונות Meta — מקורות לידים'}</h3>
          <div style={{ fontSize:11, color:`${C.cream}55`, marginTop:3 }}>{en ? 'Ad accounts whose Lead Ads feed into the Lead Center' : 'חשבונות פרסום שהלידים שלהם מוזרמים למרכז הלידים'}</div>
        </div>
      </div>

      {/* Main connected page (read-only) */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', background:'rgba(34,197,94,.06)', border:'1px solid rgba(34,197,94,.25)', borderRadius:10, marginBottom:14 }}>
        <div style={{ width:9, height:9, borderRadius:'50%', background:'#22C55E', boxShadow:'0 0 8px #22C55E', flexShrink:0 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <span style={{ fontSize:13, color:'#22C55E', fontWeight:700 }}>{en ? 'Main page connected' : 'דף ראשי מחובר'}</span>
          <span style={{ fontSize:12, color:`${C.cream}44`, marginRight:8 }}>— {en ? 'always synced' : 'מסונכרן תמיד'}</span>
        </div>
        <code style={{ fontSize:12, color:'#1877F2', background:'rgba(24,119,242,.1)', padding:'3px 10px', borderRadius:6, fontFamily:'monospace', border:'1px solid rgba(24,119,242,.2)' }}>
          {META_MAIN_PAGE_ID}
        </code>
      </div>

      {/* Additional sources */}
      {sources.map(s => (
        <div key={s.id} style={{ border:`1px solid ${C.purple}22`, borderRadius:10, padding:14, marginBottom:12, background:'rgba(255,255,255,.02)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <div onClick={() => update(s.id, { enabled: !s.enabled })}
                style={{ width:40, height:22, borderRadius:11, background: s.enabled ? C.green : 'rgba(255,255,255,.12)', cursor:'pointer', position:'relative', transition:'background .2s', flexShrink:0 }}>
                <div style={{ position:'absolute', top:3, width:16, height:16, borderRadius:'50%', background:'#fff', left: s.enabled ? 21 : 3, transition:'left .2s', boxShadow:'0 1px 4px rgba(0,0,0,.4)' }}/>
              </div>
              <span style={{ fontSize:12, color:`${C.cream}88`, fontWeight:600 }}>{s.enabled ? (en ? 'Active' : 'פעיל') : (en ? 'Disabled' : 'כבוי')}</span>
            </label>
            <button onClick={() => remove(s.id)} style={{ background:'none', border:'none', color:'rgba(224,82,82,.7)', cursor:'pointer', fontSize:12, fontFamily:'inherit', display:'flex', alignItems:'center', gap:5 }}>
              <FaTrash size={11}/> {en ? 'Remove' : 'הסר'}
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={lbl}>{en ? 'Account name' : 'שם החשבון'}</label>
              <input type="text" value={s.name} onChange={e => update(s.id, { name: e.target.value })}
                placeholder={en ? 'e.g. Afik Hanahal' : 'לדוגמה: אפיק הנחל'} style={inp}/>
            </div>
            <div>
              <label style={lbl}>{en ? 'Ad account ID' : 'מזהה חשבון פרסום (Ad Account ID)'}</label>
              <input type="text" value={s.adAccountId} onChange={e => update(s.id, { adAccountId: e.target.value })}
                placeholder="1130143728423686" style={{ ...inp, direction:'ltr', fontFamily:'monospace', fontSize:12 }}/>
            </div>
            <div style={{ gridColumn:'1/-1' }}>
              <label style={lbl}>
                {en ? 'Facebook Page ID — required for lead sync' : 'מזהה דף פייסבוק (Page ID) — חובה לסנכרון לידים'}
              </label>
              <input type="text" value={s.pageId} onChange={e => update(s.id, { pageId: e.target.value })}
                placeholder={en ? 'The page the campaigns collect leads on' : 'הדף שעליו הקמפיינים אוספים לידים'}
                style={{ ...inp, direction:'ltr', fontFamily:'monospace', fontSize:12, borderColor: s.pageId ? `${C.purple}33` : 'rgba(247,201,72,.6)' }}/>
            </div>
          </div>
        </div>
      ))}

      {/* Actions */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginTop:4 }}>
        <button onClick={save}
          style={{ padding:'9px 20px', background:`${C.purple}22`, border:`1px solid ${C.purple}44`, borderRadius:8, color: saved ? C.green : C.purple, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          {saved ? (en ? '✓ Saved' : '✓ נשמר') : (en ? 'Save accounts' : 'שמור חשבונות')}
        </button>
        <button onClick={add}
          style={{ padding:'9px 16px', background:'transparent', border:`1px dashed ${C.purple}55`, borderRadius:8, color:C.purple, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          + {en ? 'Add account' : 'הוסף חשבון'}
        </button>
      </div>

      {/* How to find the Page ID */}
      <div style={{ background:'rgba(24,119,242,.06)', border:'1px solid rgba(24,119,242,.2)', borderRadius:8, padding:'12px 14px', fontSize:12, color:`${C.cream}88`, lineHeight:1.9, direction:'rtl', marginTop:14 }}>
        <strong style={{ color:'#1877F2' }}>{en ? 'How to find the Page ID:' : 'איך מוצאים את ה-Page ID:'}</strong><br/>
        {en ? (
          <>1. Open the Facebook Page → <strong style={{ color:C.cream }}>Settings → About / Page transparency</strong><br/>
          2. Copy the numeric <strong style={{ color:C.cream }}>Page ID</strong> shown there<br/>
          3. Paste it above and press “Save accounts”</>
        ) : (
          <>1. כנס לדף הפייסבוק של הקמפיין → <strong style={{ color:C.cream }}>הגדרות → פרטים / שקיפות הדף</strong><br/>
          2. העתק את ה-<strong style={{ color:C.cream }}>Page ID</strong> המספרי שמופיע שם<br/>
          3. הדבק אותו למעלה ולחץ "שמור חשבונות"</>
        )}
        <br/>
        <span style={{ color:`${C.cream}55`, fontSize:11 }}>
          {en
            ? '* If this account’s campaigns use the main page above, leads already flow — no Page ID needed.'
            : '* אם הקמפיינים של החשבון הזה רצים על הדף הראשי שלמעלה — הלידים כבר זורמים ואין צורך ב-Page ID.'}
        </span>
      </div>
    </div>
  )
}

// ─── PASSWORD PROMPT ──────────────────────────────────────────────────────────

export default AdminPanel
