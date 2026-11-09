import { parseBackup, type ParsedBackup } from '../domain/backup'
import { DEFAULT_RECIPES } from '../domain/recipes'
import type { Bean } from '../domain/types'
import { addBean } from './beans'
import { addBrew } from './brews'
import { countData, createBackup, markBackedUp, readTables, restoreBackup } from './backup'
import { db } from './db'
import { addGear } from './gear'
import { ensureDefaults } from './seed'
import { getSettings, updateSettings } from './settings'

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
  await ensureDefaults()
})

async function seedData() {
  const bean = await addBean({
    name: 'Ethiopia Guji', roaster: 'Roast Co', origin: 'Ethiopia', roastLevel: 'light', roastDate: '2026-10-30',
    weightG: 250, priceTotal: 500, currency: 'THB', category: 'coffee',
  })
  const grinder = await addGear({ type: 'grinder', name: 'Comandante', grindScale: { min: 0, max: 40, step: 1 } })
  const brew = await addBrew({
    brewedAt: '2026-11-09T01:30:00.000Z', method: 'v60', beanId: bean.id, grinderId: grinder.id, doseG: 15, waterG: 240,
    rating: 4, balance: -1, flavorTags: ['citrus'], isBest: true,
  })
  await db.recipes.add({
    id: 'mine', name: 'V60 ของฉัน', method: 'v60', category: 'coffee', isDefault: false, doseG: 15, waterG: 240,
    grindHint: 'medium', totalTimeSec: 180, steps: [{ atSec: 0, action: 'bloom', targetWaterG: 45 }],
    createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z',
  })
  await updateSettings({ language: 'en', theme: 'dark' })
  return { bean, grinder, brew }
}

async function snapshot() {
  return {
    beans: await db.beans.orderBy('id').toArray(),
    gear: await db.gear.orderBy('id').toArray(),
    recipes: await db.recipes.orderBy('id').toArray(),
    brews: await db.brews.orderBy('id').toArray(),
    settings: await db.settings.toArray(),
  }
}

const roundTrip = (backup: Awaited<ReturnType<typeof createBackup>>): ParsedBackup => {
  const result = parseBackup(JSON.stringify(backup))
  if (!result.ok) throw new Error(`parse failed: ${result.error.code}`)
  return result.backup
}

describe('createBackup', () => {
  it('รวมข้อมูลผู้ใช้ทุกตาราง แต่ไม่รวมสูตรตั้งต้น', async () => {
    const { bean, grinder, brew } = await seedData()
    const file = await createBackup('2026-11-09T03:00:00.000Z')
    expect(file.exportedAt).toBe('2026-11-09T03:00:00.000Z')
    expect(file.data.beans.map((b) => b.id)).toEqual([bean.id])
    expect(file.data.gear.map((g) => g.id)).toEqual([grinder.id])
    expect(file.data.brews.map((b) => b.id)).toEqual([brew.id])
    expect(file.data.recipes.map((r) => r.id)).toEqual(['mine'])
    expect(file.data.settings).toMatchObject({ language: 'en', theme: 'dark', units: 'metric' })
  })

  it('ไม่มีข้อมูลเลย → ไฟล์ว่างที่ยังถูกต้อง', async () => {
    const file = await createBackup()
    expect(roundTrip(file)).toMatchObject({ beans: [], gear: [], recipes: [], brews: [] })
  })
})

describe('markBackedUp / countData / readTables', () => {
  it('markBackedUp บันทึกเวลาและไม่แตะค่าตั้งอื่น', async () => {
    await updateSettings({ theme: 'dark' })
    await markBackedUp('2026-11-09T03:00:00.000Z')
    expect(await getSettings()).toMatchObject({ lastBackupAt: '2026-11-09T03:00:00.000Z', theme: 'dark' })
  })

  it('countData ไม่นับสูตรตั้งต้น', async () => {
    expect(await countData()).toEqual({ beans: 0, gear: 0, recipes: 0, brews: 0 })
    await seedData()
    expect(await countData()).toEqual({ beans: 1, gear: 1, recipes: 1, brews: 1 })
  })

  it('readTables คืนเมล็ด อุปกรณ์ และการชงทั้งหมด', async () => {
    await seedData()
    const t = await readTables()
    expect([t.beans.length, t.gear.length, t.brews.length]).toEqual([1, 1, 1])
  })
})

describe('restoreBackup', () => {
  it('Round-trip ครบ: สำรอง → ล้าง → Restore ได้ข้อมูลเหมือนเดิมทุกตาราง (รวมยอดคงเหลือเมล็ด)', async () => {
    await seedData()
    const before = await snapshot()
    const backup = roundTrip(await createBackup())

    await Promise.all(db.tables.map((t) => t.clear()))
    const counts = await restoreBackup(backup)

    expect(counts).toEqual({ beans: 1, gear: 1, recipes: 1, brews: 1 })
    expect(await snapshot()).toEqual(before)
    // ยอดคงเหลือ 250 − 15 ตามไฟล์ ไม่ถูกหักซ้ำจากประวัติการชง
    expect((await db.beans.toArray())[0].remainingG).toBe(235)
  })

  it('แทนที่ข้อมูลเดิมทั้งหมด ไม่ผสม', async () => {
    const mine = await seedData()
    const backup = roundTrip(await createBackup())
    // ข้อมูลที่เกิดหลังสำรอง ต้องหายหลัง Restore
    const extra = await addBean({
      name: 'ใหม่หลังสำรอง', roaster: 'X', origin: 'Y', roastLevel: 'dark', roastDate: '2026-11-01', weightG: 100, category: 'coffee',
    })
    await addBrew({ brewedAt: '2026-11-09T05:00:00.000Z', method: 'v60', beanId: extra.id, doseG: 10, waterG: 160 })

    await restoreBackup(backup)

    expect((await db.beans.toArray()).map((b) => b.id)).toEqual([mine.bean.id])
    expect(await db.brews.count()).toBe(1)
  })

  it('สูตรตั้งต้นถูก seed ใหม่ครบ และสูตรของผู้ใช้อยู่ด้วย', async () => {
    await seedData()
    const backup = roundTrip(await createBackup())
    await Promise.all(db.tables.map((t) => t.clear())) // ไม่มีสูตรตั้งต้นเหลือ
    await restoreBackup(backup)
    const ids = (await db.recipes.toArray()).map((r) => r.id)
    for (const d of DEFAULT_RECIPES) expect(ids).toContain(d.id)
    expect(ids).toContain('mine')
  })

  it('สูตรผู้ใช้ที่รหัสชนกับสูตรตั้งต้น → สูตรตั้งต้นของแอปชนะ ไม่ error', async () => {
    const backup: ParsedBackup = {
      exportedAt: '2026-11-09T03:00:00.000Z', beans: [], gear: [], brews: [], settings: {},
      recipes: [{ ...DEFAULT_RECIPES[0], isDefault: false, name: 'ปลอม' }],
    }
    await restoreBackup(backup)
    expect((await db.recipes.get(DEFAULT_RECIPES[0].id))?.name).toBe(DEFAULT_RECIPES[0].name)
  })

  it('ค่าตั้งตามไฟล์ ส่วนที่ไฟล์ไม่มีใช้ค่าเริ่มต้น และ lastBackupAt ของเครื่องนี้คงเดิม', async () => {
    await updateSettings({ theme: 'dark', units: 'imperial', lastBackupAt: '2026-11-08T00:00:00.000Z' })
    await restoreBackup({
      exportedAt: '2026-11-01T00:00:00.000Z', beans: [], gear: [], recipes: [], brews: [], settings: { language: 'en' },
    })
    expect(await getSettings()).toEqual({
      id: 'app', language: 'en', units: 'metric', theme: 'system', defaultMethod: 'v60', lastBackupAt: '2026-11-08T00:00:00.000Z',
    })
  })

  it('ไม่เคยสำรองมาก่อน → Restore ไม่ทำให้ lastBackupAt โผล่', async () => {
    await restoreBackup({ exportedAt: '2026-11-01T00:00:00.000Z', beans: [], gear: [], recipes: [], brews: [], settings: {} })
    expect('lastBackupAt' in (await db.settings.get('app'))!).toBe(false)
  })

  it('ล้มเหลวกลางทาง (รหัสซ้ำ) → ข้อมูลเดิมอยู่ครบ ไม่มีอะไรเปลี่ยน', async () => {
    await seedData()
    const before = await snapshot()
    const dup = { ...before.beans[0], name: 'ซ้ำ' } as Bean
    const broken: ParsedBackup = {
      exportedAt: '2026-11-09T03:00:00.000Z', gear: [], recipes: [], brews: [], settings: { language: 'th' },
      beans: [dup, dup], // รหัสเดียวกัน 2 รายการ → bulkAdd ชน
    }
    await expect(restoreBackup(broken)).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
  })
})
