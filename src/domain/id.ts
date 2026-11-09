/**
 * สร้าง UUID v4 — ใช้ `crypto.randomUUID()` ถ้ามี
 * (ไม่มีในหน้าเว็บที่ไม่ใช่ HTTPS เช่น เปิด dev server ผ่าน IP ในวง LAN) จึงมีสำรองด้วย `getRandomValues`
 */
export function newId(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const b = c.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // variant RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`
}

/** เวลาปัจจุบันแบบ ISO 8601 UTC */
export const nowIso = (): string => new Date().toISOString()
