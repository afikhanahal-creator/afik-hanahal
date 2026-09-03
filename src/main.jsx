import { StrictMode, Component, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AccessibilityPage from './AccessibilityPage.jsx'

// LogRocket (session recording) is heavy — ~18KB gzip plus significant main-thread
// instrumentation at init. Load and start it lazily, off the critical path, so it
// never delays first paint or interactivity. Dynamic import() also splits it into
// its own chunk that the initial page never has to download.
function startLogRocketWhenIdle() {
  const begin = () => import('logrocket')
    .then(({ default: LogRocket }) => { try { LogRocket.init('tkrebw/afik-hanahal') } catch {} })
    .catch(() => {})
  if ('requestIdleCallback' in window) requestIdleCallback(begin, { timeout: 4000 })
  else setTimeout(begin, 2500)
}
if (document.readyState === 'complete') startLogRocketWhenIdle()
else window.addEventListener('load', startLogRocketWhenIdle)

// Prefetch the heavy GovMap SDK (~786KB) during idle time, so when a visitor opens
// a property the parcel map appears almost instantly (it's already cached) instead
// of waiting on the download. Low priority — never competes with the initial load.
function prefetchGovMapSdk() {
  const begin = () => {
    if (document.querySelector('link[data-gm-prefetch]')) return
    const l = document.createElement('link')
    l.rel = 'prefetch'; l.as = 'script'
    l.href = 'https://www.govmap.gov.il/govmap/api/govmap.api.js'
    l.setAttribute('data-gm-prefetch', '1')
    document.head.appendChild(l)
  }
  if ('requestIdleCallback' in window) requestIdleCallback(begin, { timeout: 9000 })
  else setTimeout(begin, 6000)
}
if (document.readyState === 'complete') prefetchGovMapSdk()
else window.addEventListener('load', prefetchGovMapSdk)

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background:'#09090F', color:'#E8E4D8', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, padding:24, fontFamily:'monospace', direction:'rtl' }}>
          <div style={{ fontSize:22, fontWeight:700, color:'#E05252' }}>שגיאה בטעינת האתר</div>
          <pre style={{ background:'rgba(255,255,255,.05)', borderRadius:8, padding:'16px 20px', fontSize:13, color:'#E05252', maxWidth:700, overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{String(this.state.error)}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ padding:'10px 24px', background:'#8490D8', border:'none', borderRadius:6, color:'#fff', fontSize:14, cursor:'pointer' }}>נסה שוב</button>
        </div>
      )
    }
    return this.props.children
  }
}

const cleanPath = window.location.pathname.replace(/\/$/, '')
const isAccessibilityPage = cleanPath === '/accessibility'
// Property intake (Typeform-style) — direct link only, its own chunk, never loaded by the main site.
//   /newproperty            the intake form (also /sell, /seller-form)
//   /newproperty/<token>    public, shareable summary of a submitted property (noindex)
const isSellerForm = ['/newproperty', '/sell', '/seller-form'].includes(cleanPath)
const summaryToken = (cleanPath.match(/^\/newproperty\/([A-Za-z0-9]{16,64})$/) || [])[1] || null
const SellerForm = lazy(() => import('./SellerForm.jsx'))
const PropertySummary = lazy(() => import('./PropertySummary.jsx'))
if (isSellerForm || summaryToken) {
  const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex, nofollow'; document.head.appendChild(m)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {summaryToken
        ? <Suspense fallback={<div style={{ minHeight: '100vh', background: '#EFEFF1' }}/>}><PropertySummary token={summaryToken} /></Suspense>
        : isSellerForm
          ? <Suspense fallback={<div style={{ minHeight: '100vh', background: '#EFEFF1' }}/>}><SellerForm /></Suspense>
          : isAccessibilityPage ? <AccessibilityPage /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
