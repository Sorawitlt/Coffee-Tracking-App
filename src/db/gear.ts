import { GEAR_TYPES } from '../domain/inventory'
import { newId, nowIso } from '../domain/id'
import type { Gear } from '../domain/types'
import { db } from './db'
import { stripUndefined } from './util'

/**
 * Repository ของอุปกรณ์ (เครื่องบด, อุปกรณ์ชง, กาต้มน้ำ, ตาชั่ง, ฟิลเตอร์)
 *
 * การลบอุปกรณ์ไม่แตะประวัติการชง: `Brew.grinderId/brewerId` ยังเก็บ ID เดิมไว้
 * (UI ฝั่งประวัติต้องรับมือกรณีหาอุปกรณ์ไม่พบ เช่น แสดง "อุปกรณ์ที่ลบแล้ว")
 */

export type GearInput = Omit<Gear, 'id' | 'createdAt' | 'updatedAt'>
export type GearChanges = Partial<GearInput>

export async function addGear(input: GearInput): Promise<Gear> {
  const at = nowIso()
  const gear: Gear = stripUndefined({ ...input, id: newId(), createdAt: at, updatedAt: at })
  await db.gear.add(gear)
  return gear
}

export async function updateGear(id: string, changes: GearChanges): Promise<Gear> {
  return db.transaction('rw', db.gear, async () => {
    const prev = await db.gear.get(id)
    if (!prev) throw new Error(`Gear not found: ${id}`)
    const next: Gear = stripUndefined({ ...prev, ...changes, id, createdAt: prev.createdAt, updatedAt: nowIso() })
    // เปลี่ยนชนิดจากเครื่องบดเป็นอย่างอื่น → ทิ้งสเกลเบอร์บด
    if (next.type !== 'grinder') delete next.grindScale
    await db.gear.put(next)
    return next
  })
}

export async function deleteGear(id: string): Promise<void> {
  await db.gear.delete(id)
}

export function getGear(id: string): Promise<Gear | undefined> {
  return db.gear.get(id)
}

/** เรียงตามชนิด (ลำดับเดียวกับฟอร์ม) แล้วตามชื่อ; ส่ง `type` เพื่อกรองเฉพาะชนิด */
export async function listGear(options: { type?: Gear['type'] } = {}): Promise<Gear[]> {
  const all = await db.gear.toArray()
  return all
    .filter((g) => !options.type || g.type === options.type)
    .sort((a, b) => GEAR_TYPES.indexOf(a.type) - GEAR_TYPES.indexOf(b.type) || a.name.localeCompare(b.name))
}
