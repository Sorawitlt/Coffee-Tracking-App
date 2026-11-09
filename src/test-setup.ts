import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// jsdom ไม่มี layout/ResizeObserver — Recharts (ResponsiveContainer) จะไม่วาดอะไรถ้าวัดขนาดได้ 0
// จึงจำลองให้รายงานขนาด 320×240 ทันทีที่เริ่มสังเกต (ใช้ตรวจว่ากราฟถูกวาด ไม่ได้ตรวจพิกเซล)
globalThis.ResizeObserver ??= class {
  constructor(private cb: ResizeObserverCallback) {}
  observe(target: Element) {
    const box = { width: 320, height: 240 }
    queueMicrotask(() =>
      this.cb(
        [{ target, contentRect: box as DOMRectReadOnly, borderBoxSize: [], contentBoxSize: [{ inlineSize: 320, blockSize: 240 }], devicePixelContentBoxSize: [] }],
        this,
      ),
    )
  }
  unobserve() {}
  disconnect() {}
}
