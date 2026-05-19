import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AccessibilityPage from './AccessibilityPage.jsx'
import LogRocket from 'logrocket'

LogRocket.init('tkrebw/afik-hanahal')

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

const isAccessibilityPage = window.location.pathname.replace(/\/$/, '') === '/accessibility'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {isAccessibilityPage ? <AccessibilityPage /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)
