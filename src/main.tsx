import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './app/App'
import { ensureDefaults } from './db/seed'
import { requestPersistentStorage } from './db/storage'

registerSW({ immediate: true })

// เตรียมสูตรตั้งต้น + การตั้งค่า (ไม่บล็อกการแสดงผล)
ensureDefaults().catch((err) => console.error('ensureDefaults failed', err))
// ขอที่เก็บข้อมูลถาวร ลดโอกาสที่เบราว์เซอร์ลบข้อมูลเองเมื่อพื้นที่ใกล้เต็ม (ไม่บล็อก ไม่ error)
void requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
