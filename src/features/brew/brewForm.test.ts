import type { Brew } from '../../domain/types'
import { tTh, type MessageKey } from '../../i18n'
import {
  brewToForm, draftToForm, formToDialValues, fromDateTimeLocal, toDateTimeLocal, validateBrewForm,
  type BrewFormValues,
} from './brewForm'

/** ข้อผิดพลาดเก็บเป็นคีย์ i18n — แปลเป็นภาษาไทยก่อนเทียบข้อความ */
const errorText = (key: MessageKey | undefined) => (key === undefined ? undefined : tTh(key))

const NOW = new Date(2026, 10, 9, 10, 0)

function form(over: Partial<BrewFormValues> = {}): BrewFormValues {
  return {
    ...draftToForm({ method: 'v60', doseG: 15, waterG: 240 }, 'b1', NOW),
    ...over,
  }
}

describe('วันที่-เวลา', () => {
  it('แปลง Date ↔ datetime-local ตามเวลาท้องถิ่นแบบไป-กลับได้', () => {
    const d = new Date(2026, 10, 9, 8, 5)
    expect(toDateTimeLocal(d)).toBe('2026-11-09T08:05')
    expect(fromDateTimeLocal('2026-11-09T08:05')?.getTime()).toBe(d.getTime())
  })

  it('รูปแบบผิดหรือไม่ใช่วันจริง → undefined', () => {
    expect(fromDateTimeLocal('')).toBeUndefined()
    expect(fromDateTimeLocal('2026-11-09')).toBeUndefined()
    expect(fromDateTimeLocal('2026-02-31T08:00')).toBeUndefined()
    expect(fromDateTimeLocal('2026-11-09T25:00')).toBeUndefined()
  })
})

describe('draftToForm / brewToForm', () => {
  it('draft → ฟอร์ม: ตัวเลขเป็นข้อความ, ช่องที่ไม่มีค่าเป็นว่าง, เวลา = ตอนนี้', () => {
    const f = draftToForm({ method: 'espresso', doseG: 18, waterG: 36, tempC: 93, grinderId: 'g1', recipeId: 'default-espresso' }, 'b1', NOW)
    expect(f).toMatchObject({
      method: 'espresso', beanId: 'b1', doseG: '18', waterG: '36', tempC: '93', grindSetting: '',
      grinderId: 'g1', brewerId: '', totalTimeSec: '', yieldG: '', tds: '', brewedAt: '2026-11-09T10:00',
      recipeId: 'default-espresso',
    })
  })

  it('brew → ฟอร์มแก้ไข: รวมเวลาชง/yield/TDS ด้วย', () => {
    const brew: Brew = {
      id: 'x', brewedAt: new Date(2026, 10, 8, 7, 30).toISOString(), method: 'v60', beanId: 'b1',
      doseG: 15, waterG: 240, grindSetting: 18, totalTimeSec: 175, yieldG: 205.5, tds: 1.35,
      flavorTags: [], isBest: false, createdAt: 't', updatedAt: 't',
    }
    expect(brewToForm(brew)).toMatchObject({
      brewedAt: '2026-11-08T07:30', grindSetting: '18', totalTimeSec: '175', yieldG: '205.5', tds: '1.35',
    })
  })
})

describe('formToDialValues', () => {
  it('แปลงเป็นตัวเลข; ว่างหรือไม่ใช่ตัวเลข = ไม่มีค่า', () => {
    expect(formToDialValues(form({ grindSetting: '18', tempC: '', grinderId: 'g1' }))).toEqual({
      doseG: 15, waterG: 240, grindSetting: 18, tempC: undefined, grinderId: 'g1',
    })
    expect(formToDialValues(form({ doseG: 'abc' })).doseG).toBeUndefined()
  })
})

describe('validateBrewForm', () => {
  it('กรอกแค่ที่จำเป็น (เมล็ด, กาแฟ, น้ำ) ก็บันทึกได้', () => {
    const r = validateBrewForm(form(), { now: NOW })
    expect(r).toEqual({
      ok: true,
      value: {
        brewedAt: NOW.toISOString(), method: 'v60', beanId: 'b1', recipeId: undefined, grinderId: undefined,
        brewerId: undefined, doseG: 15, waterG: 240, yieldG: undefined, grindSetting: undefined,
        tempC: undefined, totalTimeSec: undefined, tds: undefined,
      },
    })
  })

  it('ช่องจำเป็นว่าง → error ตรงช่อง', () => {
    const r = validateBrewForm(form({ beanId: '', doseG: '', waterG: '' }), { now: NOW })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect({ beanId: errorText(r.errors.beanId), doseG: errorText(r.errors.doseG), waterG: errorText(r.errors.waterG) }).toEqual({
        beanId: 'กรุณาเลือกเมล็ด',
        doseG: 'กรุณากรอกปริมาณกาแฟ (กรัม)',
        waterG: 'กรุณากรอกปริมาณน้ำ (กรัม)',
      })
    }
  })

  it('รับค่าทศนิยมแบบ "," และเก็บค่าเสริมครบ', () => {
    const r = validateBrewForm(
      form({ doseG: '15,5', grindSetting: '18', tempC: '94', totalTimeSec: '175', yieldG: '200', tds: '1.4', grinderId: 'g1', brewerId: 'v1', recipeId: 'default-v60' }),
      { now: NOW },
    )
    expect(r.ok && r.value).toMatchObject({
      doseG: 15.5, grindSetting: 18, tempC: 94, totalTimeSec: 175, yieldG: 200, tds: 1.4,
      grinderId: 'g1', brewerId: 'v1', recipeId: 'default-v60',
    })
  })

  it.each([
    ['doseG', '0', 'ปริมาณกาแฟต้องมากกว่า 0'],
    ['doseG', 'abc', 'ปริมาณกาแฟต้องมากกว่า 0'],
    ['waterG', '-5', 'ปริมาณน้ำต้องมากกว่า 0'],
    ['grindSetting', '-1', 'เบอร์บดต้องเป็นตัวเลข 0 ขึ้นไป'],
    ['tempC', '101', 'อุณหภูมิต้องอยู่ระหว่าง 0–100 °C'],
    ['totalTimeSec', '0', 'เวลาต้องมากกว่า 0 วินาที'],
    ['yieldG', '0', 'น้ำหนักเครื่องดื่มต้องมากกว่า 0'],
    ['tds', '31', 'TDS ต้องมากกว่า 0 และไม่เกิน 30 %'],
  ] as const)('ปฏิเสธ %s = "%s"', (key, text, message) => {
    const r = validateBrewForm(form({ [key]: text }), { now: NOW })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(errorText(r.errors[key])).toBe(message)
  })

  it('เวลาในอนาคตไม่ได้ (เผื่อ 5 นาที) และวันที่ผิดรูปแบบไม่ได้', () => {
    const future = validateBrewForm(form({ brewedAt: '2026-11-09T10:30' }), { now: NOW })
    expect(!future.ok && errorText(future.errors.brewedAt)).toBe('เวลาที่ชงต้องไม่เกินปัจจุบัน')
    expect(validateBrewForm(form({ brewedAt: '2026-11-09T10:04' }), { now: NOW }).ok).toBe(true)
    const bad = validateBrewForm(form({ brewedAt: '' }), { now: NOW })
    expect(!bad.ok && errorText(bad.errors.brewedAt)).toBe('วันและเวลาไม่ถูกต้อง')
  })
})
