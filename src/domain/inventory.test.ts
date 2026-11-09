import {
  LOW_STOCK_MIN_G,
  REFERENCE_DOSE_G,
  cupsRemaining,
  isValidGrindScale,
  remainingDisplayG,
  remainingFraction,
  stockLevel,
} from './inventory'

describe('remainingDisplayG', () => {
  it('ไม่แสดงค่าติดลบ', () => {
    expect(remainingDisplayG({ remainingG: -5 })).toBe(0)
    expect(remainingDisplayG({ remainingG: 120.5 })).toBe(120.5)
  })
})

describe('remainingFraction', () => {
  it('คิดสัดส่วนเทียบน้ำหนักถุง และจำกัดช่วง 0..1', () => {
    expect(remainingFraction({ remainingG: 125, weightG: 250 })).toBe(0.5)
    expect(remainingFraction({ remainingG: 300, weightG: 250 })).toBe(1)
    expect(remainingFraction({ remainingG: -10, weightG: 250 })).toBe(0)
  })
  it('น้ำหนักถุงเป็น 0 / ติดลบ → 0 (ไม่หารด้วยศูนย์)', () => {
    expect(remainingFraction({ remainingG: 10, weightG: 0 })).toBe(0)
    expect(remainingFraction({ remainingG: 10, weightG: -1 })).toBe(0)
  })
})

describe('stockLevel', () => {
  it('หมด / ใกล้หมด / ปกติ', () => {
    expect(stockLevel({ remainingG: 0, weightG: 250 })).toBe('empty')
    expect(stockLevel({ remainingG: -4, weightG: 250 })).toBe('empty')
    expect(stockLevel({ remainingG: 50, weightG: 250 })).toBe('low') // 20% พอดี
    expect(stockLevel({ remainingG: 51, weightG: 250 })).toBe('ok')
  })
  it('ถุงเล็ก: เหลือไม่เกิน 30 g ถือว่าใกล้หมดเสมอ', () => {
    expect(stockLevel({ remainingG: LOW_STOCK_MIN_G, weightG: 100 })).toBe('low')
    expect(stockLevel({ remainingG: LOW_STOCK_MIN_G + 1, weightG: 100 })).toBe('ok')
  })
})

describe('cupsRemaining', () => {
  it('ปัดลงเป็นแก้วเต็ม ที่ 15 g ตั้งต้น', () => {
    expect(REFERENCE_DOSE_G).toBe(15)
    expect(cupsRemaining({ remainingG: 250 })).toBe(16)
    expect(cupsRemaining({ remainingG: 14.9 })).toBe(0)
  })
  it('ใช้ปริมาณที่กำหนด; ปริมาณไม่ถูกต้อง → 0', () => {
    expect(cupsRemaining({ remainingG: 250 }, 18)).toBe(13)
    expect(cupsRemaining({ remainingG: 250 }, 0)).toBe(0)
    expect(cupsRemaining({ remainingG: -10 })).toBe(0)
  })
})

describe('isValidGrindScale', () => {
  it('ยอมรับสเกลปกติ (เช่น Comandante 0–40 ทีละ 1, Niche 0–50)', () => {
    expect(isValidGrindScale({ min: 0, max: 40, step: 1 })).toBe(true)
    expect(isValidGrindScale({ min: 1, max: 11, step: 0.5 })).toBe(true)
  })
  it('ปฏิเสธ min ≥ max, step ≤ 0, step เกินช่วง, ค่าไม่ใช่ตัวเลข', () => {
    expect(isValidGrindScale({ min: 5, max: 5, step: 1 })).toBe(false)
    expect(isValidGrindScale({ min: 10, max: 1, step: 1 })).toBe(false)
    expect(isValidGrindScale({ min: 0, max: 10, step: 0 })).toBe(false)
    expect(isValidGrindScale({ min: 0, max: 10, step: 11 })).toBe(false)
    expect(isValidGrindScale({ min: 0, max: Number.NaN, step: 1 })).toBe(false)
  })
})
