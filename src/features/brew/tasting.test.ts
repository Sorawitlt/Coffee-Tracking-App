import type { Brew } from '../../domain/types'
import { emptyTasting, hasTasting, tastingFromBrew, tastingToFields } from './tasting'

const brew: Brew = {
  id: 'b1', brewedAt: '2026-11-09T01:00:00.000Z', method: 'v60', beanId: 'x', doseG: 15, waterG: 240,
  rating: 4, balance: -1, body: 0, sweetness: 3, sourAndBitter: true, flavorTags: ['citrus'], notes: 'หอม',
  isBest: true, createdAt: '', updatedAt: '',
}

describe('ผลชิมในฟอร์ม', () => {
  it('ฟอร์มว่าง = ไม่ได้ชิม (ช่องที่ไม่แตะเป็น undefined ไม่ใช่ 0)', () => {
    const t = emptyTasting()
    expect(hasTasting(t)).toBe(false)
    expect(t.balance).toBeUndefined()
    expect(tastingToFields(t)).toEqual({
      rating: undefined, balance: undefined, body: undefined, sweetness: undefined, sourAndBitter: undefined,
      flavorTags: [], notes: undefined, isBest: false,
    })
  })

  it('ติดดาวสูตรที่ดีที่สุดอย่างเดียวไม่นับเป็นการชิม', () => {
    expect(hasTasting({ ...emptyTasting(), isBest: true })).toBe(false)
  })

  it('สมดุล (0) เป็นผลชิมที่ถูกต้อง ต่างจากไม่ได้เลือก', () => {
    expect(hasTasting({ ...emptyTasting(), balance: 0 })).toBe(true)
    expect(tastingToFields({ ...emptyTasting(), balance: 0 }).balance).toBe(0)
  })

  it('โน้ตว่าง/เว้นวรรคล้วน = ไม่มีโน้ต', () => {
    expect(hasTasting({ ...emptyTasting(), notes: '   ' })).toBe(false)
    expect(tastingToFields({ ...emptyTasting(), notes: '  หอม  ' }).notes).toBe('หอม')
  })

  it('แปลงไป-กลับจากบันทึกเดิมได้ครบ และไม่แชร์อาร์เรย์แท็กกับของเดิม', () => {
    const t = tastingFromBrew(brew)
    expect(t).toEqual({
      rating: 4, balance: -1, body: 0, sweetness: 3, sourAndBitter: true, flavorTags: ['citrus'], notes: 'หอม', isBest: true,
    })
    t.flavorTags.push('honey')
    expect(brew.flavorTags).toEqual(['citrus'])
    expect(tastingToFields(tastingFromBrew(brew))).toMatchObject({ rating: 4, sourAndBitter: true, notes: 'หอม' })
  })

  it('sourAndBitter ปิด → ไม่เก็บคีย์ (undefined)', () => {
    expect(tastingToFields({ ...emptyTasting(), sourAndBitter: false }).sourAndBitter).toBeUndefined()
  })
})
