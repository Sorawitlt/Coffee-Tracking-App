/**
 * การตั้งค่าของผู้ช่วยชง (เก็บในเครื่องนี้เท่านั้น — เป็นความชอบของอุปกรณ์ ไม่ใช่ข้อมูลการชง)
 * ใช้ localStorage ที่อาจใช้ไม่ได้ (โหมดส่วนตัว/ถูกบล็อก) → ทุกจุดต้องไม่พัง
 */

export interface AssistantPrefs {
  /** เสียงเตือนตอนเปลี่ยนขั้นตอน */
  sound: boolean
  /** สั่นเตือน (ใช้ได้เฉพาะอุปกรณ์ที่รองรับ — iOS Safari ไม่รองรับ) */
  vibrate: boolean
}

export const DEFAULT_PREFS: AssistantPrefs = { sound: true, vibrate: true }

export const PREFS_KEY = 'brewlog.assistant.prefs'

export function loadPrefs(): AssistantPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<AssistantPrefs> | null
    return {
      sound: typeof raw?.sound === 'boolean' ? raw.sound : DEFAULT_PREFS.sound,
      vibrate: typeof raw?.vibrate === 'boolean' ? raw.vibrate : DEFAULT_PREFS.vibrate,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function savePrefs(prefs: AssistantPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // เก็บไม่ได้ก็ใช้ค่าในหน่วยความจำต่อไป
  }
}
