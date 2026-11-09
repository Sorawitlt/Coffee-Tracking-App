import { newId, nowIso } from '../domain/id'
import type { Bean } from '../domain/types'
import { db } from './db'
import { stripUndefined } from './util'

/**
 * Repository ของคลังเมล็ด (CRUD + Archive)
 * - คงเหลือ (`remainingG`) เริ่มต้น = น้ำหนักถุง และถูกหักอัตโนมัติโดย `brews.ts`
 * - ลบเมล็ดที่มีประวัติการชงไม่ได้ (กันประวัติกำพร้า) → ให้ Archive แทน
 */

export type BeanInput = Omit<Bean, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'remainingG'> &
  Partial<Pick<Bean, 'archived' | 'remainingG'>>

export type BeanChanges = Partial<Omit<Bean, 'id' | 'createdAt' | 'updatedAt'>>

/** ลบเมล็ดไม่ได้เพราะมีประวัติการชงอ้างอิงอยู่ */
export class BeanInUseError extends Error {
  readonly brewCount: number
  constructor(beanId: string, brewCount: number) {
    super(`Bean ${beanId} is used by ${brewCount} brew(s); archive it instead`)
    this.name = 'BeanInUseError'
    this.brewCount = brewCount
  }
}

export async function addBean(input: BeanInput): Promise<Bean> {
  const at = nowIso()
  const bean: Bean = stripUndefined({
    archived: false,
    ...input,
    remainingG: input.remainingG ?? input.weightG,
    id: newId(),
    createdAt: at,
    updatedAt: at,
  })
  await db.beans.add(bean)
  return bean
}

export async function updateBean(id: string, changes: BeanChanges): Promise<Bean> {
  return db.transaction('rw', db.beans, async () => {
    const prev = await db.beans.get(id)
    if (!prev) throw new Error(`Bean not found: ${id}`)
    // ค่า undefined ใน changes = ล้างฟิลด์นั้นออก (เช่น ลบสายพันธุ์)
    const next: Bean = stripUndefined({ ...prev, ...changes, id, createdAt: prev.createdAt, updatedAt: nowIso() })
    await db.beans.put(next)
    return next
  })
}

export function setBeanArchived(id: string, archived: boolean): Promise<Bean> {
  return updateBean(id, { archived })
}

export function countBrewsOfBean(id: string): Promise<number> {
  return db.brews.where('beanId').equals(id).count()
}

export async function deleteBean(id: string): Promise<void> {
  await db.transaction('rw', db.beans, db.brews, async () => {
    const brewCount = await countBrewsOfBean(id)
    if (brewCount > 0) throw new BeanInUseError(id, brewCount)
    await db.beans.delete(id)
  })
}

export function getBean(id: string): Promise<Bean | undefined> {
  return db.beans.get(id)
}

/** เรียงคั่วล่าสุดก่อน (สดสุดอยู่บน) แล้วตามชื่อ; ค่าเริ่มต้นไม่รวมที่ Archive */
export async function listBeans(options: { includeArchived?: boolean } = {}): Promise<Bean[]> {
  const all = await db.beans.toArray()
  return all
    .filter((b) => options.includeArchived || !b.archived)
    .sort((a, b) => b.roastDate.localeCompare(a.roastDate) || a.name.localeCompare(b.name))
}
