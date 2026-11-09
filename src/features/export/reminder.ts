/**
 * "ไว้ทีหลัง" ของแบนเนอร์เตือนสำรองข้อมูล — เก็บในเครื่องนี้เท่านั้น (ความชอบของอุปกรณ์ ไม่ใช่ข้อมูลการชง)
 * localStorage อาจใช้ไม่ได้ (โหมดส่วนตัว/ถูกบล็อก) → ทุกจุดต้องไม่พัง
 */

export const SNOOZE_KEY = 'brewlog.backup.snoozeUntil'
/** กด "ไว้ทีหลัง" แล้วเงียบกี่วัน */
export const SNOOZE_DAYS = 3

const DAY_MS = 86_400_000

export function isSnoozed(now: Date = new Date()): boolean {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY))
    return Number.isFinite(until) && until > now.getTime()
  } catch {
    return false
  }
}

export function snoozeReminder(now: Date = new Date()): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(now.getTime() + SNOOZE_DAYS * DAY_MS))
  } catch {
    // เก็บไม่ได้ก็ซ่อนในหน่วยความจำของหน้านี้ต่อไป
  }
}
