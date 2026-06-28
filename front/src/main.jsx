import './index.css'
import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App.jsx'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'Inter, sans-serif', maxWidth: 480, margin: '40px auto' }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Erreur de chargement</h1>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Rechargez la page (Ctrl+F5). Si le problème persiste, videz le cache du site.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '10px 16px', background: '#F5C518', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Recharger
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

const root = (
  <StrictMode>
    <ErrorBoundary>
      {googleClientId ? (
        <GoogleOAuthProvider clientId={googleClientId}>
          <App />
        </GoogleOAuthProvider>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>
)

createRoot(document.getElementById('root')).render(root)
