import { advise, adviceToStore, adviseForBrew, dialInInputFromBrew, type DialInInput } from './dialIn'

const v60: DialInInput = { method: 'v60', doseG: 15, waterG: 240, tempC: 94, totalTimeSec: 180, grindSetting: 20 }
const espresso: DialInInput = { method: 'espresso', doseG: 18, waterG: 36, tempC: 93, grindSetting: 10 }

describe('Dial-in Advisor — กฎตามตาราง PLAN ข้อ 5.3', () => {
  it('เปรี้ยว/บาง → สกัดน้อยไป → บดละเอียดขึ้น 1 ขั้น (สำรอง: น้ำร้อนขึ้น 2 °C, เวลานานขึ้น)', () => {
    const a = advise({ ...v60, balance: -2 })
    expect(a.kind).toBe('underExtracted')
    expect(a.adjustment).toEqual({ variable: 'grind', direction: 'finer', steps: 1, from: 20, to: 19 })
    expect(a.alternatives).toEqual([
      { variable: 'temp', deltaC: 2, from: 94, to: 96 },
      { variable: 'time', deltaSec: 15, from: 180, to: 195 },
    ])
  })

  it('ขม/ฝาด → สกัดมากไป → บดหยาบขึ้น 1 ขั้น (สำรอง: น้ำเย็นลง 2 °C, เวลาสั้นลง)', () => {
    const a = advise({ ...v60, balance: 1 })
    expect(a.kind).toBe('overExtracted')
    expect(a.adjustment).toEqual({ variable: 'grind', direction: 'coarser', steps: 1, from: 20, to: 21 })
    expect(a.alternatives).toEqual([
      { variable: 'temp', deltaC: -2, from: 94, to: 92 },
      { variable: 'time', deltaSec: -15, from: 180, to: 165 },
    ])
  })

  it('สมดุลแต่จืด → เข้มน้อยไป → เพิ่มกาแฟ 1:16 → 1:15 (น้ำเท่าเดิม)', () => {
    const a = advise({ ...v60, balance: 0, body: -1 })
    expect(a.kind).toBe('tooWeak')
    expect(a.adjustment).toEqual({ variable: 'ratio', from: 16, to: 15, doseG: 16, waterG: 240 })
  })

  it('สมดุลแต่เข้มเกิน → เข้มมากไป → เพิ่มน้ำ 1:15 → 1:16', () => {
    const a = advise({ method: 'frenchPress', doseG: 30, waterG: 450, body: 2 })
    expect(a.kind).toBe('tooStrong')
    expect(a.adjustment).toEqual({ variable: 'ratio', from: 15, to: 16, doseG: 28.1, waterG: 450 })
  })

  it('ทั้งเปรี้ยวและขม → สกัดไม่สม่ำเสมอ → ปรับเทคนิค (มาก่อนเปรี้ยว/ขม)', () => {
    const a = advise({ ...v60, balance: -1, sourAndBitter: true })
    expect(a.kind).toBe('uneven')
    expect(a.adjustment).toEqual({ variable: 'technique' })
  })

  it('Espresso ไหลเร็ว < 20 s → บดละเอียดขึ้น', () => {
    const a = advise({ ...espresso, totalTimeSec: 19 })
    expect(a.kind).toBe('espressoFast')
    expect(a.adjustment).toEqual({ variable: 'grind', direction: 'finer', steps: 1, from: 10, to: 9 })
  })

  it('Espresso ไหลช้า > 35 s → บดหยาบขึ้น', () => {
    const a = advise({ ...espresso, totalTimeSec: 36 })
    expect(a.kind).toBe('espressoSlow')
    expect(a.adjustment).toMatchObject({ variable: 'grind', direction: 'coarser' })
  })

  it('Espresso 20 s และ 35 s พอดี ไม่ถือว่าผิดปกติ', () => {
    expect(advise({ ...espresso, totalTimeSec: 20, rating: 3 }).kind).toBe('balanced')
    expect(advise({ ...espresso, totalTimeSec: 35, rating: 3 }).kind).toBe('balanced')
  })

  it('เวลาไหล Espresso (วัดได้จริง) มาก่อนผลชิม', () => {
    expect(advise({ ...espresso, totalTimeSec: 15, balance: 2 }).kind).toBe('espressoFast')
  })

  it('เวลาไม่ใช่ Espresso ไม่ใช้กฎเวลาไหล', () => {
    expect(advise({ ...v60, totalTimeSec: 10, rating: 3 }).kind).toBe('balanced')
  })

  it('อร่อยแล้ว (≥ 4 ดาว, สมดุล) → best', () => {
    expect(advise({ ...v60, rating: 4, balance: 0, body: 0 }).kind).toBe('best')
    expect(advise({ ...v60, rating: 5 }).kind).toBe('best')
    expect(advise({ ...v60, rating: 5 }).adjustment).toBeUndefined()
  })

  it('4 ดาวแต่ยังเปรี้ยว → ยังแนะนำให้ปรับ', () => {
    expect(advise({ ...v60, rating: 4, balance: -1 }).kind).toBe('underExtracted')
  })

  it('สมดุลแต่ต่ำกว่า 4 ดาว → balanced (คงสูตร)', () => {
    const a = advise({ ...v60, rating: 3, balance: 0, body: 0 })
    expect(a.kind).toBe('balanced')
    expect(a.adjustment).toBeUndefined()
  })

  it('ยังไม่มีผลชิม → needTasting', () => {
    expect(advise(v60).kind).toBe('needTasting')
    expect(advise({ ...v60, sourAndBitter: false }).kind).toBe('needTasting')
  })
})

describe('Dial-in Advisor — ลำดับความสำคัญ & ขอบเขต', () => {
  it('ปรับระดับบดไม่ได้ → เลื่อนไปอุณหภูมิ', () => {
    const a = advise({ ...v60, canAdjustGrind: false, balance: -1 })
    expect(a.adjustment).toEqual({ variable: 'temp', deltaC: 2, from: 94, to: 96 })
    expect(a.alternatives).toEqual([{ variable: 'time', deltaSec: 15, from: 180, to: 195 }])
  })

  it('เบอร์บดชนขอบสเกล → ข้ามไปตัวแปรถัดไป', () => {
    const a = advise({ ...v60, grindSetting: 1, grindScale: { min: 1, max: 40, step: 1 }, balance: -1 })
    expect(a.adjustment).toMatchObject({ variable: 'temp' })
  })

  it('ใช้ step ของสเกลเครื่องบด (เช่น 0.5)', () => {
    const a = advise({ ...v60, grindSetting: 5, grindScale: { min: 1, max: 11, step: 0.5 }, balance: -1 })
    expect(a.adjustment).toEqual({ variable: 'grind', direction: 'finer', steps: 1, from: 5, to: 4.5 })
  })

  it('ไม่รู้เบอร์บดปัจจุบัน → แนะนำทิศทางโดยไม่มีตัวเลข', () => {
    const a = advise({ ...v60, grindSetting: undefined, balance: -1 })
    expect(a.adjustment).toEqual({ variable: 'grind', direction: 'finer', steps: 1 })
  })

  it('น้ำร้อนเกิน 100 °C ไม่ได้ → ข้ามไปเวลา', () => {
    const a = advise({ ...v60, canAdjustGrind: false, tempC: 99, balance: -1 })
    expect(a.adjustment).toEqual({ variable: 'time', deltaSec: 15, from: 180, to: 195 })
  })

  it('ไม่รู้อุณหภูมิ/เวลา → แนะนำเป็นค่าเปลี่ยนแปลง', () => {
    const a = advise({ method: 'v60', doseG: 15, waterG: 240, canAdjustGrind: false, balance: -1 })
    expect(a.adjustment).toEqual({ variable: 'temp', deltaC: 2 })
    expect(a.alternatives).toEqual([{ variable: 'time', deltaSec: 15 }])
  })

  it('Cold brew ไม่แนะนำปรับอุณหภูมิ → ปรับเวลาแช่ทีละ 2 ชม.', () => {
    const a = advise({ method: 'coldBrew', doseG: 100, waterG: 800, totalTimeSec: 15 * 3600, canAdjustGrind: false, balance: -1 })
    expect(a.adjustment).toEqual({ variable: 'time', deltaSec: 7200, from: 54000, to: 61200 })
    expect(a.alternatives).toEqual([])
  })

  it('Espresso ไม่แนะนำปรับเวลาโดยตรง (คุมด้วยระดับบด)', () => {
    const a = advise({ ...espresso, totalTimeSec: 28, balance: -1 })
    expect(a.kind).toBe('underExtracted')
    expect(a.adjustment).toMatchObject({ variable: 'grind', direction: 'finer' })
    expect(a.alternatives).toEqual([{ variable: 'temp', deltaC: 2, from: 93, to: 95 }])
  })

  it('Espresso ปรับความเข้มด้วยน้ำหนักช็อต (กาแฟเท่าเดิม) ครั้งละ 0.25', () => {
    const weak = advise({ ...espresso, totalTimeSec: 28, body: -1 })
    expect(weak.adjustment).toEqual({ variable: 'ratio', from: 2, to: 1.75, doseG: 18, waterG: 31.5 })
    const strong = advise({ ...espresso, totalTimeSec: 28, body: 1 })
    expect(strong.adjustment).toEqual({ variable: 'ratio', from: 2, to: 2.25, doseG: 18, waterG: 40.5 })
  })

  it('อัตราส่วนไม่กลมจะถูกปัดเข้าค่ากลม (1:15.7 → 1:15)', () => {
    const a = advise({ method: 'v60', doseG: 15.3, waterG: 240, body: -1 })
    expect(a.adjustment).toEqual({ variable: 'ratio', from: 15.69, to: 15, doseG: 16, waterG: 240 })
  })

  it('ข้อมูลอัตราส่วนไม่ถูกต้อง → ไม่มีคำแนะนำอัตราส่วน', () => {
    const a = advise({ method: 'v60', doseG: 0, waterG: 240, body: -1 })
    expect(a.kind).toBe('tooWeak')
    expect(a.adjustment).toBeUndefined()
  })
})

describe('Dial-in Advisor — ข้อความตามวันหลังคั่ว', () => {
  it('< 4 วัน → beanTooFresh', () => {
    expect(advise({ ...v60, rating: 5, daysOffRoast: 3 }).notes).toEqual(['beanTooFresh'])
  })
  it('> 45 วัน → beanStale', () => {
    expect(advise({ ...v60, balance: -1, daysOffRoast: 46 }).notes).toEqual(['beanStale'])
  })
  it('4–45 วัน หรือไม่ทราบ → ไม่มีข้อความ', () => {
    expect(advise({ ...v60, rating: 5, daysOffRoast: 4 }).notes).toEqual([])
    expect(advise({ ...v60, rating: 5, daysOffRoast: 45 }).notes).toEqual([])
    expect(advise({ ...v60, rating: 5 }).notes).toEqual([])
  })
  it('แสดงร่วมกับทุกผลวินิจฉัย รวมถึง needTasting และ Espresso', () => {
    expect(advise({ ...v60, daysOffRoast: 2 }).notes).toEqual(['beanTooFresh'])
    expect(advise({ ...espresso, totalTimeSec: 15, daysOffRoast: 60 }).notes).toEqual(['beanStale'])
  })
})

describe('adviseForBrew / dialInInputFromBrew', () => {
  const brew = {
    method: 'v60' as const,
    doseG: 15,
    waterG: 240,
    grindSetting: 20,
    tempC: 94,
    totalTimeSec: 180,
    balance: -1 as const,
    brewedAt: new Date(2026, 10, 9, 8).toISOString(),
    grinderId: 'g1',
  }

  it('คำนวณวันหลังคั่วจากเมล็ด และใช้สเกลของเครื่องบด', () => {
    const input = dialInInputFromBrew(brew, {
      bean: { roastDate: '2026-11-07' },
      grinder: { grindScale: { min: 0, max: 40, step: 2 } },
    })
    expect(input.daysOffRoast).toBe(2)
    expect(input.canAdjustGrind).toBe(true)
    const a = adviseForBrew(brew, { bean: { roastDate: '2026-11-07' }, grinder: { grindScale: { min: 0, max: 40, step: 2 } } })
    expect(a.adjustment).toEqual({ variable: 'grind', direction: 'finer', steps: 1, from: 20, to: 18 })
    expect(a.notes).toEqual(['beanTooFresh'])
  })

  it('ไม่มีเครื่องบดและเบอร์บด → ถือว่ากาแฟบดสำเร็จ → แนะนำอุณหภูมิแทน', () => {
    const a = adviseForBrew({ ...brew, grinderId: undefined, grindSetting: undefined })
    expect(a.adjustment).toMatchObject({ variable: 'temp' })
  })
})

describe('adviceToStore — คำแนะนำที่เก็บกับบันทึก', () => {
  const brew = {
    method: 'v60' as const, doseG: 15, waterG: 240, grindSetting: 20, tempC: 94, totalTimeSec: 180,
    brewedAt: '2026-11-09T01:00:00.000Z', grinderId: 'g1',
  }

  it('ยังไม่มีผลชิม → ไม่เก็บ (undefined)', () => {
    expect(adviceToStore(brew)).toBeUndefined()
  })

  it('มีผลชิม → เก็บคำแนะนำ (บดละเอียดขึ้นเมื่อเปรี้ยว)', () => {
    const a = adviceToStore({ ...brew, balance: -2 })
    expect(a?.kind).toBe('underExtracted')
    expect(a?.adjustment).toMatchObject({ variable: 'grind', direction: 'finer', from: 20, to: 19 })
  })

  it('Espresso ไหลเร็วเกินไป → เก็บคำแนะนำได้แม้ไม่ได้ชิม (เวลาเป็นค่าที่วัดจริง)', () => {
    const a = adviceToStore({ ...brew, method: 'espresso', waterG: 36, doseG: 18, totalTimeSec: 15 })
    expect(a?.kind).toBe('espressoFast')
  })
})
