import { db } from './db'
import { addGear, deleteGear, getGear, listGear, updateGear } from './gear'

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('gear repository', () => {
  it('เพิ่มเครื่องบดพร้อมสเกลเบอร์บด', async () => {
    const g = await addGear({ type: 'grinder', name: 'Comandante C40', grindScale: { min: 0, max: 40, step: 1 } })
    expect(g.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(await getGear(g.id)).toEqual(g)
  })

  it('แก้ไขชื่อ/โน้ต และล้างโน้ตได้', async () => {
    const g = await addGear({ type: 'kettle', name: 'Fellow Stagg', notes: 'ใหม่' })
    const next = await updateGear(g.id, { name: 'Fellow Stagg EKG', notes: undefined })
    expect(next.name).toBe('Fellow Stagg EKG')
    expect(Object.keys(next)).not.toContain('notes')
    expect(next.createdAt).toBe(g.createdAt)
  })

  it('เปลี่ยนชนิดจากเครื่องบดเป็นอย่างอื่น → ทิ้งสเกลเบอร์บด', async () => {
    const g = await addGear({ type: 'grinder', name: 'X', grindScale: { min: 1, max: 10, step: 1 } })
    const next = await updateGear(g.id, { type: 'other' })
    expect(Object.keys(next)).not.toContain('grindScale')
    expect(Object.keys((await getGear(g.id))!)).not.toContain('grindScale')
  })

  it('ไม่พบอุปกรณ์ → error', async () => {
    await expect(updateGear('missing', { name: 'x' })).rejects.toThrow('Gear not found')
  })

  it('ลบอุปกรณ์ได้ (ลบซ้ำไม่ error) และไม่แตะประวัติการชง', async () => {
    const g = await addGear({ type: 'scale', name: 'Acaia' })
    await db.brews.add({
      id: 'brew1', brewedAt: new Date().toISOString(), method: 'v60', beanId: 'b', grinderId: g.id,
      doseG: 15, waterG: 240, flavorTags: [], isBest: false, createdAt: 'x', updatedAt: 'x',
    })
    await deleteGear(g.id)
    await deleteGear(g.id)
    expect(await getGear(g.id)).toBeUndefined()
    expect((await db.brews.get('brew1'))?.grinderId).toBe(g.id)
  })

  it('listGear เรียงตามชนิด (เครื่องบดก่อน) แล้วตามชื่อ และกรองตามชนิดได้', async () => {
    await addGear({ type: 'kettle', name: 'Kettle' })
    await addGear({ type: 'grinder', name: 'B grinder' })
    await addGear({ type: 'grinder', name: 'A grinder' })
    expect((await listGear()).map((g) => g.name)).toEqual(['A grinder', 'B grinder', 'Kettle'])
    expect((await listGear({ type: 'grinder' })).map((g) => g.name)).toEqual(['A grinder', 'B grinder'])
  })
})
