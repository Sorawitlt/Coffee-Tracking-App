import { advise } from '../../domain/dialIn'
import type { Advice, AdviceKind } from '../../domain/types'
import { createT, tTh } from '../../i18n'
import { ADVICE_DIAGNOSIS_KEY, adjustmentText, describeAdvice, NO_ADJUSTMENT_KEY, NOTE_KEY } from './adviceText'

const v60 = { method: 'v60' as const, doseG: 15, waterG: 240, tempC: 94, totalTimeSec: 180, grindSetting: 20 }

describe('ข้อความการปรับ 1 อย่าง', () => {
  it('ระดับบด: ทิศทาง + จำนวนขั้น + เบอร์ก่อน/หลัง', () => {
    expect(adjustmentText({ variable: 'grind', direction: 'finer', steps: 1, from: 20, to: 19 }, 'v60'))
      .toBe('บดละเอียดขึ้น 1 ขั้น (เบอร์ 20 → 19)')
    expect(adjustmentText({ variable: 'grind', direction: 'coarser', steps: 1 }, 'v60')).toBe('บดหยาบขึ้น 1 ขั้น')
  })

  it('อัตราส่วน: เพิ่ม/ลดความเข้ม พร้อมปริมาณใหม่', () => {
    expect(adjustmentText({ variable: 'ratio', from: 16, to: 15, doseG: 16, waterG: 240 }, 'v60'))
      .toBe('เพิ่มความเข้ม: 1:16 → 1:15 (กาแฟ 16 g : น้ำ 240 g)')
    expect(adjustmentText({ variable: 'ratio', from: 15, to: 16, doseG: 15, waterG: 240 }, 'v60'))
      .toBe('ลดความเข้ม: 1:15 → 1:16 (กาแฟ 15 g : น้ำ 240 g)')
  })

  it('อุณหภูมิและเวลา', () => {
    expect(adjustmentText({ variable: 'temp', deltaC: 2, from: 94, to: 96 }, 'v60')).toBe('น้ำร้อนขึ้น 2 °C (94 → 96 °C)')
    expect(adjustmentText({ variable: 'temp', deltaC: -2 }, 'v60')).toBe('น้ำเย็นลง 2 °C')
    expect(adjustmentText({ variable: 'time', deltaSec: 15, from: 180, to: 195 }, 'v60'))
      .toBe('ชงนานขึ้น 15 วินาที (3:00 → 3:15)')
    expect(adjustmentText({ variable: 'time', deltaSec: -15 }, 'v60')).toBe('ชงสั้นลง 15 วินาที')
  })

  it('เทคนิค: Espresso เน้น Tamp, วิธีอื่นเน้นการเท/Swirl', () => {
    expect(adjustmentText({ variable: 'technique' }, 'espresso')).toContain('Tamp')
    expect(adjustmentText({ variable: 'technique' }, 'v60')).toContain('Swirl')
  })
})

describe('describeAdvice', () => {
  it('ทุก AdviceKind มีข้อความวินิจฉัย', () => {
    const kinds: AdviceKind[] = [
      'espressoFast', 'espressoSlow', 'uneven', 'underExtracted', 'overExtracted', 'tooWeak', 'tooStrong', 'best',
      'balanced', 'needTasting',
    ]
    for (const k of kinds) expect(tTh(ADVICE_DIAGNOSIS_KEY[k])).toBeTruthy()
  })

  it('เปรี้ยว → “บดละเอียดขึ้น” เป็นการปรับหลัก + ทางเลือกสำรอง', () => {
    const view = describeAdvice(advise({ ...v60, balance: -2 }), 'v60')
    expect(view.diagnosis).toContain('สกัดน้อยไป')
    expect(view.action).toBe('บดละเอียดขึ้น 1 ขั้น (เบอร์ 20 → 19)')
    expect(view.alternatives).toEqual(['น้ำร้อนขึ้น 2 °C (94 → 96 °C)', 'ชงนานขึ้น 15 วินาที (3:00 → 3:15)'])
    expect(view.positive).toBe(false)
  })

  it('อร่อยแล้ว (best) → ไม่มี action, โทนบวก, ชวนติดดาว', () => {
    const view = describeAdvice(advise({ ...v60, balance: 0, body: 0, rating: 5 }), 'v60')
    expect(view.action).toBeUndefined()
    expect(view.fallback).toContain('สูตรที่ดีที่สุด')
    expect(view.positive).toBe(true)
  })

  it('ต้องปรับแต่ไม่มีตัวแปรให้ปรับ → แจ้งเหตุผลแทนที่จะว่างเปล่า', () => {
    const advice: Advice = { kind: 'underExtracted', alternatives: [], notes: [] }
    expect(describeAdvice(advice, 'v60').fallback).toBe(tTh(NO_ADJUSTMENT_KEY))
  })

  it('ข้อความเมล็ดสด/เก่าตามวันหลังคั่ว (PLAN ข้อ 5.3)', () => {
    const view = describeAdvice(advise({ ...v60, balance: 1, daysOffRoast: 2 }), 'v60')
    expect(view.notes).toEqual([tTh(NOTE_KEY.beanTooFresh)])
    expect(describeAdvice(advise({ ...v60, balance: 1, daysOffRoast: 60 }), 'v60').notes).toEqual([tTh(NOTE_KEY.beanStale)])
  })
})

describe('ภาษาอังกฤษ', () => {
  const en = createT('en')

  it('การปรับ 1 อย่าง — พหูพจน์ถูกต้อง (1 step / 2 steps)', () => {
    expect(adjustmentText({ variable: 'grind', direction: 'finer', steps: 1, from: 20, to: 19 }, 'v60', en))
      .toBe('Grind 1 step finer (setting 20 → 19)')
    expect(adjustmentText({ variable: 'grind', direction: 'coarser', steps: 2 }, 'v60', en)).toBe('Grind 2 steps coarser')
    expect(adjustmentText({ variable: 'time', deltaSec: -1 }, 'v60', en)).toBe('Brew 1 second shorter')
    expect(adjustmentText({ variable: 'temp', deltaC: 2, from: 94, to: 96 }, 'v60', en)).toBe('Use water 2 °C hotter (94 → 96 °C)')
  })

  it('คำแนะนำทั้งชุดไม่มีภาษาไทยปน', () => {
    const view = describeAdvice(advise({ ...v60, balance: -2, daysOffRoast: 2 }), 'v60', en)
    const all = [view.diagnosis, view.action, ...view.alternatives, ...view.notes].join(' ')
    expect(all).not.toMatch(/[ก-๙]/)
    expect(view.diagnosis).toContain('under-extracted')
  })
})
