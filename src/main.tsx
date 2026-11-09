import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './app/App'
import { ensureDefaults } from './db/seed'

registerSW({ immediate: true })

// เตรียมสูตรตั้งต้น + การตั้งค่า (ไม่บล็อกการแสดงผล)
ensureDefaults().catch((err) => console.error('ensureDefaults failed', err))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
