import type { Bean } from '../domain/types'
import { addBrew, setBestBrew, updateBrew, type BrewInput } from './brews'
import { db } from './db'

const T = '2026-11-01T00:00:00.000Z'

const bean = (id: string): Bean => ({
  id, name: `Bean ${id}`, roaster: 'R', origin: 'TH', roastLevel: 'light', roastDate: '2026-10-26',
  weightG: 250, remainingG: 250, category: 'coffee', archived: false, createdAt: T, updatedAt: T,
})

const input = (beanId: string, over: Partial<BrewInput> = {}): BrewInput => ({
  brewedAt: new Date(2026, 10, 9, 8).toISOString(), method: 'v60', beanId, doseG: 15, waterG: 240, ...over,
})

const bestIds = async () => (await db.brews.toArray()).filter((b) => b.isBest).map((b) => b.id).sort()

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
  await db.beans.bulkAdd([bean('a'), bean('b')])
})

describe('สูตรที่ดีที่สุด (isBest) — 1 รายการต่อ เมล็ด + วิธีชง', () => {
  it('ตั้งรายการใหม่เป็นที่สุด → รายการเดิมของเมล็ด+วิธีเดียวกันถูกปลด', async () => {
    const first = await addBrew(input('a', { isBest: true }))
    const second = await addBrew(input('a', { isBest: true }))
    expect(await bestIds()).toEqual([second.id])
    expect((await db.brews.get(first.id))!.isBest).toBe(false)
  })

  it('ไม่กระทบเมล็ดอื่น หรือวิธีชงอื่นของเมล็ดเดียวกัน', async () => {
    const v60 = await addBrew(input('a', { isBest: true }))
    const espresso = await addBrew(input('a', { method: 'espresso', isBest: true }))
    const otherBean = await addBrew(input('b', { isBest: true }))
    expect(await bestIds()).toEqual([v60.id, espresso.id, otherBean.id].sort())
  })

  it('setBestBrew ติดดาว/ถอดดาว และย้ายดาวจากรายการเดิม', async () => {
    const x = await addBrew(input('a'))
    const y = await addBrew(input('a'))
    await setBestBrew(x.id, true)
    expect(await bestIds()).toEqual([x.id])
    await setBestBrew(y.id, true)
    expect(await bestIds()).toEqual([y.id])
    await setBestBrew(y.id, false)
    expect(await bestIds()).toEqual([])
  })

  it('แก้ไขย้ายเมล็ดหรือวิธีชงของรายการที่ติดดาว → ตรวจซ้ำในกลุ่มใหม่', async () => {
    const onB = await addBrew(input('b', { isBest: true }))
    const onA = await addBrew(input('a', { isBest: true }))
    await updateBrew(onA.id, { beanId: 'b' })
    expect(await bestIds()).toEqual([onA.id])
    expect((await db.brews.get(onB.id))!.isBest).toBe(false)
  })

  it('บันทึกที่ไม่ได้ติดดาวไม่ปลดดาวของรายการอื่น', async () => {
    const best = await addBrew(input('a', { isBest: true }))
    await addBrew(input('a'))
    expect(await bestIds()).toEqual([best.id])
  })
})
