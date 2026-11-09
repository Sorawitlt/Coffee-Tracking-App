import {
  beverageG,
  brewMetrics,
  cToF,
  classifyRange,
  costPerCup,
  daysOffRoast,
  doseForWater,
  estimateBeverageG,
  extractionYield,
  formatRatio,
  freshness,
  fToC,
  gToOz,
  ozToG,
  ratio,
  roundTo,
  TARGET_RANGES,
  toLocalDate,
  waterForDose,
} from './calc'

describe('roundTo', () => {
  it('ปัดเศษถูกต้องแม้มีปัญหา floating point', () => {
    expect(roundTo(1.005, 2)).toBe(1.01)
    expect(roundTo(15.04)).toBe(15)
    expect(roundTo(15.05)).toBe(15.1)
    expect(roundTo(2.5, 0)).toBe(3)
  })
})

describe('อัตราส่วน (Ratio)', () => {
  it('ratio = น้ำ ÷ กาแฟ', () => {
    expect(ratio(15, 240)).toBe(16)
    expect(ratio(18, 36)).toBe(2)
    expect(ratio(30, 450)).toBe(15)
  })

  it('คืน undefined เมื่อข้อมูลไม่ถูกต้อง', () => {
    expect(ratio(0, 240)).toBeUndefined()
    expect(ratio(15, 0)).toBeUndefined()
    expect(ratio(-1, 240)).toBeUndefined()
    expect(ratio(Number.NaN, 240)).toBeUndefined()
  })

  it('formatRatio แสดงเป็น 1:x', () => {
    expect(formatRatio(16)).toBe('1:16')
    expect(formatRatio(15.5)).toBe('1:15.5')
    expect(formatRatio(240 / 15.3)).toBe('1:15.7')
    expect(formatRatio(undefined)).toBe('—')
  })

  it('waterForDose / doseForWater', () => {
    expect(waterForDose(15, 16)).toBe(240)
    expect(waterForDose(18, 2)).toBe(36)
    expect(doseForWater(240, 16)).toBe(15)
    expect(doseForWater(250, 15)).toBe(16.7)
  })
})

describe('น้ำกาแฟที่ได้ & Extraction Yield', () => {
  it('Filter: น้ำ − (กาแฟ × 2)', () => {
    expect(estimateBeverageG('v60', 15, 240)).toBe(210)
    expect(estimateBeverageG('frenchPress', 30, 450)).toBe(390)
  })

  it('Espresso: waterG คือน้ำหนักช็อตอยู่แล้ว', () => {
    expect(estimateBeverageG('espresso', 18, 36)).toBe(36)
  })

  it('ไม่ติดลบ', () => {
    expect(estimateBeverageG('v60', 100, 150)).toBe(0)
  })

  it('beverageG ใช้ค่าที่ชั่งจริงก่อน', () => {
    expect(beverageG({ method: 'v60', doseG: 15, waterG: 240, yieldG: 205 })).toBe(205)
    expect(beverageG({ method: 'v60', doseG: 15, waterG: 240 })).toBe(210)
    expect(beverageG({ method: 'v60', doseG: 15, waterG: 240, yieldG: 0 })).toBe(210)
  })

  it('EY = (เครื่องดื่ม × TDS%) ÷ กาแฟ', () => {
    expect(extractionYield(210, 1.35, 15)).toBeCloseTo(18.9, 5)
    expect(extractionYield(36, 10, 18)).toBeCloseTo(20, 5)
    expect(extractionYield(210, 0, 15)).toBeUndefined()
    expect(extractionYield(210, 1.35, 0)).toBeUndefined()
  })
})

describe('ช่วงเป้าหมาย SCA', () => {
  it('ตรงตาม PLAN ข้อ 5.2', () => {
    expect(TARGET_RANGES.filter).toEqual({ tds: [1.15, 1.45], ey: [18, 22] })
    expect(TARGET_RANGES.espresso).toEqual({ tds: [8, 12], ey: [18, 22] })
  })

  it('classifyRange รวมขอบเขต', () => {
    const r = TARGET_RANGES.filter.ey
    expect(classifyRange(17.9, r)).toBe('low')
    expect(classifyRange(18, r)).toBe('ok')
    expect(classifyRange(22, r)).toBe('ok')
    expect(classifyRange(22.1, r)).toBe('high')
  })
})

describe('วันหลังคั่ว', () => {
  it('toLocalDate ใช้เวลาท้องถิ่น', () => {
    expect(toLocalDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('นับตามวันปฏิทิน ไม่สนชั่วโมง', () => {
    expect(daysOffRoast('2026-11-01', new Date(2026, 10, 9, 0, 1))).toBe(8)
    expect(daysOffRoast('2026-11-01', new Date(2026, 10, 9, 23, 59))).toBe(8)
    expect(daysOffRoast('2026-11-09', new Date(2026, 10, 9, 7, 0))).toBe(0)
  })

  it('รับ ISO string ได้ และข้ามเดือน/ปี/ปีอธิกสุรทินถูกต้อง', () => {
    expect(daysOffRoast('2026-02-20', new Date(2026, 2, 1, 12).toISOString())).toBe(9)
    expect(daysOffRoast('2028-02-20', new Date(2028, 2, 1, 12))).toBe(10)
    expect(daysOffRoast('2025-12-25', new Date(2026, 0, 4, 12))).toBe(10)
  })

  it('คืน undefined เมื่อรูปแบบวันที่ผิด', () => {
    expect(daysOffRoast('09/11/2026', new Date())).toBeUndefined()
    expect(daysOffRoast('2026-11-01', 'not a date')).toBeUndefined()
  })

  it('freshness: < 4 วัน = สดเกิน, > 45 วัน = เก่า', () => {
    expect(freshness(0)).toBe('tooFresh')
    expect(freshness(3)).toBe('tooFresh')
    expect(freshness(4)).toBe('ok')
    expect(freshness(45)).toBe('ok')
    expect(freshness(46)).toBe('stale')
  })
})

describe('ต้นทุนต่อแก้ว', () => {
  it('(ราคาถุง ÷ น้ำหนักถุง) × กาแฟที่ใช้', () => {
    expect(costPerCup(450, 250, 15)).toBe(27)
    expect(costPerCup(0, 250, 15)).toBe(0)
  })

  it('คืน undefined เมื่อข้อมูลไม่ครบ', () => {
    expect(costPerCup(undefined, 250, 15)).toBeUndefined()
    expect(costPerCup(450, 0, 15)).toBeUndefined()
    expect(costPerCup(-1, 250, 15)).toBeUndefined()
  })
})

describe('แปลงหน่วย', () => {
  it('g ↔ oz', () => {
    expect(gToOz(28.349523125)).toBeCloseTo(1, 10)
    expect(ozToG(gToOz(240))).toBeCloseTo(240, 10)
  })

  it('°C ↔ °F', () => {
    expect(cToF(100)).toBe(212)
    expect(cToF(0)).toBe(32)
    expect(fToC(200)).toBeCloseTo(93.33, 2)
    expect(fToC(cToF(94))).toBeCloseTo(94, 10)
  })
})

describe('brewMetrics', () => {
  const brewedAt = new Date(2026, 10, 9, 8, 0).toISOString()
  const bean = { roastDate: '2026-10-26', priceTotal: 450, weightG: 250, currency: 'THB' }

  it('รวมค่าทั้งหมดของการชง Filter', () => {
    const m = brewMetrics({ method: 'v60', doseG: 15, waterG: 240, tds: 1.35, brewedAt }, bean)
    expect(m.ratio).toBe(16)
    expect(m.beverageG).toBe(210)
    expect(m.beverageEstimated).toBe(true)
    expect(m.ey).toBeCloseTo(18.9, 5)
    expect(m.tdsStatus).toBe('ok')
    expect(m.eyStatus).toBe('ok')
    expect(m.daysOffRoast).toBe(14)
    expect(m.freshness).toBe('ok')
    expect(m.costPerCup).toBe(27)
    expect(m.currency).toBe('THB')
  })

  it('Espresso ใช้เป้าหมาย Espresso', () => {
    const m = brewMetrics({ method: 'espresso', doseG: 18, waterG: 36, yieldG: 38, tds: 7.5, brewedAt })
    expect(m.beverageG).toBe(38)
    expect(m.beverageEstimated).toBe(false)
    expect(m.tdsStatus).toBe('low')
    expect(m.ey).toBeCloseTo(15.83, 2)
    expect(m.eyStatus).toBe('low')
  })

  it('ไม่มี TDS / ไม่มีเมล็ด → ค่าที่เกี่ยวข้องเป็น undefined', () => {
    const m = brewMetrics({ method: 'v60', doseG: 15, waterG: 240, brewedAt })
    expect(m.ey).toBeUndefined()
    expect(m.tdsStatus).toBeUndefined()
    expect(m.eyStatus).toBeUndefined()
    expect(m.daysOffRoast).toBeUndefined()
    expect(m.costPerCup).toBeUndefined()
  })

  it('Moka / Cold brew ไม่มีช่วงเป้าหมาย SCA', () => {
    const m = brewMetrics({ method: 'coldBrew', doseG: 100, waterG: 800, tds: 3, brewedAt })
    expect(m.ey).toBeDefined()
    expect(m.tdsStatus).toBeUndefined()
    expect(m.eyStatus).toBeUndefined()
  })
})
