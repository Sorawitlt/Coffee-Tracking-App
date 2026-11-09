/** ตัดคีย์ที่เป็น `undefined` ออก — ใช้ให้ข้อมูลในฐานข้อมูลสะอาด (ฟิลด์ที่ไม่มีค่า = ไม่มีคีย์) */
export function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}
