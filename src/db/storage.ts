/**
 * ที่เก็บข้อมูลถาวรของเบราว์เซอร์ (PLAN ข้อ 2 — ความเสี่ยง Safari/iOS ลบข้อมูลเว็บที่ไม่ได้ใช้)
 * ทุกฟังก์ชันไม่ throw: เบราว์เซอร์ที่ไม่รองรับ = ถือว่า "ไม่รับประกัน"
 */

/** ขอให้เบราว์เซอร์เก็บข้อมูลแบบถาวร — true = ถาวรแล้ว, false = ไม่ได้รับ/ไม่รองรับ */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** ตอนนี้ข้อมูลถูกเก็บแบบถาวรหรือไม่ (ไม่ขอสิทธิ์ใหม่) */
export async function isStoragePersistent(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false
  } catch {
    return false
  }
}
