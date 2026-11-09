// สร้างไอคอน PWA (PNG) จาก public/favicon.svg — รัน: node scripts/generate-icons.mjs
import sharp from 'sharp'
const src = 'public/favicon.svg'
for (const [name, size] of [['pwa-192x192.png', 192], ['pwa-512x512.png', 512], ['apple-touch-icon.png', 180]]) {
  await sharp(src).resize(size, size).png().toFile(`public/${name}`)
}
