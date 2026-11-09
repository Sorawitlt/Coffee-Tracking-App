import { newId, nowIso } from '../domain/id'
import type { Brew } from '../domain/types'
import { db } from './db'
import { stripUndefined } from './util'

/**
 * Repository ของบันทึกการชง
 * รักษากติกา "น้ำหนักเมล็ดคงเหลือหักอัตโนมัติเมื่อชง" ภายใน Transaction เดียว
 * → เพิ่ม/แก้/ลบ บันทึกแล้วยอดคงเหลือถูกต้องเสมอ (ย้อนกลับได้ตรงกรัม)
 */

export type BrewInput = Omit<Brew, 'id' | 'createdAt' | 'updatedAt' | 'flavorTags' | 'isBest'> &
  Partial<Pick<Brew, 'flavorTags' | 'isBest'>>

export type BrewChanges = Partial<Omit<Brew, 'id' | 'createdAt' | 'updatedAt'>>

/** ปรับยอดคงเหลือของเมล็ด (deltaG ติดลบ = ใช้ไป) — ถ้าไม่พบเมล็ดจะข้าม */
async function adjustRemaining(beanId: string, deltaG: number, at: string): Promise<void> {
  if (deltaG === 0) return
  const bean = await db.beans.get(beanId)
  if (!bean) return
  // ปัดทศนิยม 1 ตำแหน่ง กันเศษ floating point สะสม (เช่น 249.99999)
  const remainingG = Math.round((bean.remainingG + deltaG) * 10) / 10
  await db.beans.update(beanId, { remainingG, updatedAt: at })
}

export async function addBrew(input: BrewInput): Promise<Brew> {
  const at = nowIso()
  const brew: Brew = { flavorTags: [], isBest: false, ...stripUndefined(input), id: newId(), createdAt: at, updatedAt: at }
  await db.transaction('rw', db.brews, db.beans, async () => {
    await db.brews.add(brew)
    await adjustRemaining(brew.beanId, -brew.doseG, at)
  })
  return brew
}

export async function updateBrew(id: string, changes: BrewChanges): Promise<Brew> {
  return db.transaction('rw', db.brews, db.beans, async () => {
    const prev = await db.brews.get(id)
    if (!prev) throw new Error(`Brew not found: ${id}`)
    const at = nowIso()
    // ค่า undefined ใน changes = ล้างฟิลด์นั้นออก (เช่น ลบอุณหภูมิ) — ฟิลด์ที่ไม่มีค่าไม่เก็บเป็นคีย์
    const next: Brew = stripUndefined({ ...prev, ...changes, id, createdAt: prev.createdAt, updatedAt: at })
    if (prev.beanId !== next.beanId) {
      await adjustRemaining(prev.beanId, prev.doseG, at)
      await adjustRemaining(next.beanId, -next.doseG, at)
    } else {
      await adjustRemaining(next.beanId, prev.doseG - next.doseG, at)
    }
    await db.brews.put(next)
    return next
  })
}

export async function deleteBrew(id: string): Promise<void> {
  await db.transaction('rw', db.brews, db.beans, async () => {
    const prev = await db.brews.get(id)
    if (!prev) return
    await db.brews.delete(id)
    await adjustRemaining(prev.beanId, prev.doseG, nowIso())
  })
}

export function getBrew(id: string): Promise<Brew | undefined> {
  return db.brews.get(id)
}

/** ประวัติการชงเรียงล่าสุดก่อน (ตามเวลาที่ชง) */
export function listBrews(): Promise<Brew[]> {
  return db.brews.orderBy('brewedAt').reverse().toArray()
}
