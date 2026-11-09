# Brew Log — Coffee Tracking App

แอป (PWA) สำหรับบันทึก ช่วยชง และปรับปรุงการชงกาแฟ — ใช้ได้ทุกอุปกรณ์ ทำงานออฟไลน์ และ Export ไป Excel / Google Sheets ได้

A local-first PWA to log, guide, and improve your coffee brewing. Works offline on any device; exports to Excel / Google Sheets.

## 🔗 เปิดใช้งาน · Open the app

**https://sorawitlt.github.io/Coffee-Tracking-App/**

- 📘 คู่มือผู้ใช้: [ภาษาไทย](docs/USER_GUIDE.md) · [English](docs/USER_GUIDE.en.md)
- 📋 แผนการพัฒนาและสเปก: [docs/PLAN.md](docs/PLAN.md)
- สถานะ: Phase 1 ครบทั้ง 11 ขั้น (ไทย/English, โหมดสว่าง/มืด, ผ่าน WCAG 2.2 AA, ใช้ออฟไลน์ได้, Deploy บน GitHub Pages)

## เริ่มใช้งาน (Development)

```bash
npm install
npm run dev      # เปิดแอปที่ http://localhost:5173
npm test         # รัน unit test (Vitest)
npm run build    # build + สร้าง PWA (service worker, manifest)
npm run audit    # (หลัง build) Lighthouse + axe WCAG 2.2 AA สว่าง/มืด + ทดสอบออฟไลน์ — ต้องมี Chrome ในเครื่อง
```

## Deploy (GitHub Pages)

Deploy อัตโนมัติด้วย [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) ทุกครั้งที่ push เข้า **default branch** — ผ่าน typecheck + test + audit ก่อนจึงขึ้นเว็บ

ตั้งค่าครั้งแรก (เจ้าของ repo ทำครั้งเดียว):

1. **Settings → Pages → Build and deployment → Source:** เลือก **GitHub Actions**
2. Merge งานเข้า default branch (หรือ **Actions → Deploy to GitHub Pages → Run workflow** โดยเลือก default branch)
3. รอ ~3 นาที แล้วเปิด `https://<owner>.github.io/<repo>/` (ลิงก์อยู่ในหน้า Settings → Pages และในผลรันของ workflow)

> Fork ไปใช้เองได้ทันที — base path คำนวณจากชื่อ repo / Custom domain อัตโนมัติ ไม่ต้องแก้โค้ด
