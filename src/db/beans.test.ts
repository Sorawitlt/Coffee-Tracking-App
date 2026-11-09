import { addBrew } from './brews'
import { BeanInUseError, addBean, deleteBean, getBean, listBeans, setBeanArchived, updateBean, type BeanInput } from './beans'
import { db } from './db'

const input = (over: Partial<BeanInput> = {}): BeanInput => ({
  name: 'Ethiopia Guji',
  roaster: 'Roaster',
  origin: 'Ethiopia',
  roastLevel: 'light',
  roastDate: '2026-11-01',
  weightG: 250,
  category: 'coffee',
  ...over,
})

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('addBean', () => {
  it('สร้าง UUID + timestamps; คงเหลือเริ่มต้น = น้ำหนักถุง; ไม่ Archive', async () => {
    const bean = await addBean(input())
    expect(bean.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(bean.createdAt).toBe(bean.updatedAt)
    expect(bean.remainingG).toBe(250)
    expect(bean.archived).toBe(false)
    expect(await db.beans.get(bean.id)).toEqual(bean)
  })

  it('กำหนดคงเหลือเองได้ (เช่น ถุงที่เปิดใช้ไปแล้ว)', async () => {
    const bean = await addBean(input({ remainingG: 120 }))
    expect(bean.remainingG).toBe(120)
  })

  it('ฟิลด์ที่ไม่มีค่าไม่ถูกเก็บเป็นคีย์ undefined', async () => {
    const bean = await addBean(input({ variety: undefined, priceTotal: undefined }))
    expect(Object.keys(bean)).not.toContain('variety')
    expect(Object.keys(bean)).not.toContain('priceTotal')
  })
})

describe('updateBean', () => {
  it('แก้เฉพาะฟิลด์ที่ส่งมา คง createdAt เดิมและเลื่อน updatedAt', async () => {
    const bean = await addBean(input())
    await new Promise((r) => setTimeout(r, 5))
    const next = await updateBean(bean.id, { name: 'Ethiopia Yirgacheffe', priceTotal: 480, currency: 'THB' })
    expect(next).toMatchObject({ name: 'Ethiopia Yirgacheffe', priceTotal: 480, roaster: 'Roaster' })
    expect(next.createdAt).toBe(bean.createdAt)
    expect(next.updatedAt > bean.updatedAt).toBe(true)
    expect(await db.beans.get(bean.id)).toEqual(next)
  })

  it('ส่ง undefined = ล้างฟิลด์ออก', async () => {
    const bean = await addBean(input({ variety: 'Heirloom', priceTotal: 450, currency: 'THB' }))
    const next = await updateBean(bean.id, { variety: undefined })
    expect(Object.keys(next)).not.toContain('variety')
    expect(Object.keys((await db.beans.get(bean.id))!)).not.toContain('variety')
    expect(next.priceTotal).toBe(450)
  })

  it('ไม่พบเมล็ด → error', async () => {
    await expect(updateBean('missing', { name: 'x' })).rejects.toThrow('Bean not found')
  })
})

describe('archive', () => {
  it('Archive / กู้คืนได้ และ listBeans ซ่อนที่ Archive ตามค่าเริ่มต้น', async () => {
    const a = await addBean(input({ name: 'A' }))
    await addBean(input({ name: 'B' }))
    await setBeanArchived(a.id, true)
    expect((await listBeans()).map((b) => b.name)).toEqual(['B'])
    expect((await listBeans({ includeArchived: true })).map((b) => b.name).sort()).toEqual(['A', 'B'])
    await setBeanArchived(a.id, false)
    expect(await listBeans()).toHaveLength(2)
  })
})

describe('deleteBean', () => {
  it('ลบเมล็ดที่ยังไม่เคยชงได้', async () => {
    const bean = await addBean(input())
    await deleteBean(bean.id)
    expect(await getBean(bean.id)).toBeUndefined()
  })

  it('มีประวัติการชง → ลบไม่ได้ (BeanInUseError) และข้อมูลไม่เปลี่ยน', async () => {
    const bean = await addBean(input())
    await addBrew({ brewedAt: new Date().toISOString(), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240 })
    await addBrew({ brewedAt: new Date().toISOString(), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240 })
    const err = await deleteBean(bean.id).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BeanInUseError)
    expect((err as BeanInUseError).brewCount).toBe(2)
    expect(await getBean(bean.id)).toBeDefined()
    expect(await db.brews.count()).toBe(2)
  })

  it('ลบเมล็ดที่ไม่มีอยู่ ไม่เกิด error', async () => {
    await expect(deleteBean('missing')).resolves.toBeUndefined()
  })
})

describe('listBeans', () => {
  it('เรียงคั่วล่าสุดก่อน แล้วตามชื่อ', async () => {
    await addBean(input({ name: 'Old', roastDate: '2026-10-01' }))
    await addBean(input({ name: 'B new', roastDate: '2026-11-05' }))
    await addBean(input({ name: 'A new', roastDate: '2026-11-05' }))
    expect((await listBeans()).map((b) => b.name)).toEqual(['A new', 'B new', 'Old'])
  })
})
