# Brew Log — Coffee Tracking App

แอป (PWA) สำหรับบันทึก ช่วยชง และปรับปรุงการชงกาแฟ — ใช้ได้ทุกอุปกรณ์ ทำงานออฟไลน์ และ Export ไป Excel / Google Sheets ได้

A local-first PWA to log, guide, and improve your coffee brewing. Works offline on any device; exports to Excel / Google Sheets.

- 📋 แผนการพัฒนาและสเปก: [docs/PLAN.md](docs/PLAN.md)
- สถานะ: ขั้นที่ 0–10 เสร็จแล้ว (ไทย/English, โหมดสว่าง/มืด, ผ่าน WCAG 2.2 AA, ใช้ออฟไลน์ได้) — ขั้นต่อไป: ขั้นที่ 11 Deploy GitHub Pages + คู่มือผู้ใช้

## เริ่มใช้งาน (Development)

```bash
npm install
npm run dev      # เปิดแอปที่ http://localhost:5173
npm test         # รัน unit test (Vitest)
npm run build    # build + สร้าง PWA (service worker, manifest)
npm run audit    # (หลัง build) Lighthouse + axe WCAG 2.2 AA สว่าง/มืด + ทดสอบออฟไลน์ — ต้องมี Chrome ในเครื่อง
```
