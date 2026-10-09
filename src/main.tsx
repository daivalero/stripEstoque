import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/App'
import { registrarServiceWorker } from '@/services/pwa'
import '@/index.css'

registrarServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
