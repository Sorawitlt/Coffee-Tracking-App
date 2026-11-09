import { stepDelta, stepHint, stepTarget, stepTitle } from './stepText'

describe('ข้อความขั้นตอน', () => {
  it('ชื่อ: ใช้ label ของสูตรผู้ใช้ก่อน ไม่มีใช้ชื่อมาตรฐานตาม action', () => {
    expect(stepTitle({ action: 'bloom' })).toBe('บลูม')
    expect(stepTitle({ action: 'custom', label: ' ล้างฟิลเตอร์ ' })).toBe('ล้างฟิลเตอร์')
    expect(stepTitle({ action: 'custom' })).toBe('ขั้นตอน')
  })

  it('คำแนะนำ: สูตรที่ผู้ใช้ตั้งชื่อเองไม่ต้องมีคำแนะนำมาตรฐานซ้อน', () => {
    expect(stepHint({ action: 'drawdown' })).toContain('เสร็จสิ้น')
    expect(stepHint({ action: 'pour', label: 'เทวนช้า ๆ' })).toBe('')
  })

  it('เป้าหมาย: เทน้ำ "ถึง X g" / Espresso "ช็อตถึง X g" / ไม่มีเป้า = undefined', () => {
    expect(stepTarget({ action: 'pour', targetWaterG: 150 })).toBe('ถึง 150 g')
    expect(stepTarget({ action: 'extract', targetWaterG: 36 })).toBe('ช็อตถึง 36 g')
    expect(stepTarget({ action: 'pour', targetWaterG: 247.5 })).toBe('ถึง 247.5 g')
    expect(stepTarget({ action: 'stir' })).toBeUndefined()
  })

  it('ปริมาณที่เทเพิ่ม: แสดงเฉพาะเมื่อมีน้ำเดิมบนตาชั่งแล้ว', () => {
    expect(stepDelta({ action: 'pour', targetWaterG: 150, pourG: 105 })).toBe('+105 g')
    // ขั้นแรก เท่ากับเป้าอยู่แล้ว → ไม่ต้องบอกซ้ำ
    expect(stepDelta({ action: 'bloom', targetWaterG: 45, pourG: 45 })).toBeUndefined()
    expect(stepDelta({ action: 'drawdown' })).toBeUndefined()
    expect(stepDelta({ action: 'pour', targetWaterG: 150, pourG: 0 })).toBeUndefined()
  })
})
