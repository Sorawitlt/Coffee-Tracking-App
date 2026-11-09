import { DEFAULT_RECIPES } from '../domain/recipes'
import type { Bean } from '../domain/types'
import { addBrew, deleteBrew, updateBrew, type BrewInput } from './brews'
import { db } from './db'
import { ensureDefaults } from './seed'
import { DEFAULT_SETTINGS, getSettings, updateSettings } from './settings'

const T = '2026-11-01T00:00:00.000Z'

function bean(id: string, remainingG = 250): Bean {
  return {
    id,
    name: `Bean ${id}`,
    roaster: 'Roaster',
    origin: 'Ethiopia',
    roastLevel: 'light',
    roastDate: '2026-10-26',
    weightG: 250,
    remainingG,
    priceTotal: 450,
    currency: 'THB',
    category: 'coffee',
    archived: false,
    createdAt: T,
    updatedAt: T,
  }
}

const brewInput = (beanId: string, doseG = 15): BrewInput => ({
  brewedAt: new Date(2026, 10, 9, 8).toISOString(),
  method: 'v60',
  beanId,
  doseG,
  waterG: 240,
})

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('schema', () => {
  it('เปิดฐานข้อมูลได้ และมีครบ 5 ตาราง', async () => {
    expect(db.isOpen()).toBe(true)
    expect(db.name).toBe('brew-log')
    expect(db.tables.map((t) => t.name).sort()).toEqual(['beans', 'brews', 'gear', 'recipes', 'settings'])
  })

  it('ค้นบันทึกการชงตามเมล็ด เรียงตามเวลาได้ (compound index)', async () => {
    await db.beans.add(bean('b1'))
    const a = await addBrew({ ...brewInput('b1'), brewedAt: '2026-11-08T08:00:00.000Z' })
    const b = await addBrew({ ...brewInput('b1'), brewedAt: '2026-11-09T08:00:00.000Z' })
    await addBrew({ ...brewInput('other'), brewedAt: '2026-11-10T08:00:00.000Z' })
    const rows = await db.brews
      .where('[beanId+brewedAt]')
      .between(['b1', ''], ['b1', '￿'])
      .reverse()
      .toArray()
    expect(rows.map((r) => r.id)).toEqual([b.id, a.id])
  })
})

describe('ensureDefaults', () => {
  it('เพิ่มสูตรตั้งต้น 8 แบบ + การตั้งค่า และเรียกซ้ำได้ไม่ซ้ำซ้อน', async () => {
    await ensureDefaults()
    await ensureDefaults()
    expect(await db.recipes.count()).toBe(DEFAULT_RECIPES.length)
    expect(await db.recipes.get('default-v60')).toEqual(DEFAULT_RECIPES.find((r) => r.method === 'v60'))
    expect(await db.settings.get('app')).toEqual(DEFAULT_SETTINGS)
  })

  it('ไม่ทับการตั้งค่าและสูตรของผู้ใช้', async () => {
    await updateSettings({ language: 'en' })
    await db.recipes.add({ ...DEFAULT_RECIPES[1], id: 'mine', isDefault: false, name: 'My V60' })
    await ensureDefaults()
    expect((await getSettings()).language).toBe('en')
    expect(await db.recipes.get('mine')).toBeDefined()
  })

  it('คืนค่าสูตรตั้งต้นที่ถูกแก้ไขให้เป็นค่าล่าสุดของแอป', async () => {
    await ensureDefaults()
    await db.recipes.update('default-v60', { doseG: 99 })
    await ensureDefaults()
    expect((await db.recipes.get('default-v60'))?.doseG).toBe(15)
  })
})

describe('settings', () => {
  it('ยังไม่มีข้อมูล → คืนค่าเริ่มต้น', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('อัปเดตเฉพาะฟิลด์ที่ส่งมา', async () => {
    await updateSettings({ units: 'imperial' })
    const s = await updateSettings({ theme: 'dark' })
    expect(s).toEqual({ ...DEFAULT_SETTINGS, units: 'imperial', theme: 'dark' })
    expect(await getSettings()).toEqual(s)
  })
})

describe('brews — หักเมล็ดคงเหลืออัตโนมัติ', () => {
  it('addBrew: สร้าง UUID + timestamps + ค่าเริ่มต้น และหักคงเหลือ', async () => {
    await db.beans.add(bean('b1', 250))
    const brew = await addBrew(brewInput('b1', 15))
    expect(brew.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(brew.createdAt).toBe(brew.updatedAt)
    expect(brew.flavorTags).toEqual([])
    expect(brew.isBest).toBe(false)
    expect(await db.brews.get(brew.id)).toEqual(brew)
    const b = await db.beans.get('b1')
    expect(b?.remainingG).toBe(235)
    expect(b?.updatedAt).toBe(brew.createdAt)
  })

  it('updateBrew: เปลี่ยนปริมาณกาแฟ → ปรับคงเหลือตามส่วนต่าง', async () => {
    await db.beans.add(bean('b1', 250))
    const brew = await addBrew(brewInput('b1', 15))
    const next = await updateBrew(brew.id, { doseG: 18, rating: 4 })
    expect(next.rating).toBe(4)
    expect(next.createdAt).toBe(brew.createdAt)
    expect((await db.beans.get('b1'))?.remainingG).toBe(232)
  })

  it('updateBrew: เปลี่ยนเมล็ด → คืนเมล็ดเดิม หักเมล็ดใหม่', async () => {
    await db.beans.bulkAdd([bean('b1', 250), bean('b2', 100)])
    const brew = await addBrew(brewInput('b1', 15))
    await updateBrew(brew.id, { beanId: 'b2', doseG: 20 })
    expect((await db.beans.get('b1'))?.remainingG).toBe(250)
    expect((await db.beans.get('b2'))?.remainingG).toBe(80)
  })

  it('updateBrew: แก้ผลชิมอย่างเดียว คงเหลือไม่เปลี่ยน', async () => {
    await db.beans.add(bean('b1', 250))
    const brew = await addBrew(brewInput('b1', 15))
    await updateBrew(brew.id, { balance: -1, notes: 'เปรี้ยวนิดหน่อย' })
    expect((await db.beans.get('b1'))?.remainingG).toBe(235)
  })

  it('updateBrew: ไม่พบบันทึก → error และไม่มีอะไรเปลี่ยน', async () => {
    await expect(updateBrew('missing', { doseG: 1 })).rejects.toThrow('Brew not found')
  })

  it('deleteBrew: คืนคงเหลือ; ลบซ้ำไม่คืนซ้ำ', async () => {
    await db.beans.add(bean('b1', 250))
    const brew = await addBrew(brewInput('b1', 15))
    await deleteBrew(brew.id)
    await deleteBrew(brew.id)
    expect(await db.brews.count()).toBe(0)
    expect((await db.beans.get('b1'))?.remainingG).toBe(250)
  })

  it('ทศนิยมไม่สะสมเศษ floating point', async () => {
    await db.beans.add(bean('b1', 250))
    for (let i = 0; i < 10; i++) await addBrew(brewInput('b1', 0.1))
    expect((await db.beans.get('b1'))?.remainingG).toBe(249)
  })

  it('ชงเกินคงเหลือได้ (ติดลบ) และย้อนกลับได้ตรงกรัม', async () => {
    await db.beans.add(bean('b1', 10))
    const brew = await addBrew(brewInput('b1', 15))
    expect((await db.beans.get('b1'))?.remainingG).toBe(-5)
    await deleteBrew(brew.id)
    expect((await db.beans.get('b1'))?.remainingG).toBe(10)
  })

  it('เมล็ดถูกลบไปแล้ว → บันทึกการชงได้ตามปกติ', async () => {
    const brew = await addBrew(brewInput('ghost', 15))
    expect(await db.brews.get(brew.id)).toBeDefined()
  })
})
