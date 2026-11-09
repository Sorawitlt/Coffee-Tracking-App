import { newId, nowIso } from './id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('สร้าง UUID v4 ไม่ซ้ำกัน', () => {
    const ids = new Set(Array.from({ length: 1000 }, newId))
    expect(ids.size).toBe(1000)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })

  it('ใช้ getRandomValues สำรองเมื่อไม่มี randomUUID (หน้าเว็บที่ไม่ใช่ HTTPS)', () => {
    const original = crypto.randomUUID
    try {
      Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
      expect(newId()).toMatch(UUID_V4)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })
})

describe('nowIso', () => {
  it('คืนเวลา ISO 8601 UTC', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})
