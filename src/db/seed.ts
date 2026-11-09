import { DEFAULT_RECIPES } from '../domain/recipes'
import { db } from './db'
import { DEFAULT_SETTINGS } from './settings'

/**
 * เตรียมข้อมูลตั้งต้น — เรียกทุกครั้งที่เปิดแอป (idempotent)
 * - สูตรตั้งต้น: เขียนทับด้วยเวอร์ชันล่าสุดของแอปเสมอ (ID คงที่ จึงไม่เกิดข้อมูลซ้ำ)
 * - การตั้งค่า: สร้างเฉพาะเมื่อยังไม่มี ไม่ทับค่าที่ผู้ใช้ตั้งไว้
 */
export async function ensureDefaults(): Promise<void> {
  await db.transaction('rw', db.recipes, db.settings, async () => {
    await db.recipes.bulkPut([...DEFAULT_RECIPES])
    if (!(await db.settings.get('app'))) await db.settings.add(DEFAULT_SETTINGS)
  })
}
