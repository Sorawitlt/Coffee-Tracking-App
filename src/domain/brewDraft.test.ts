import {
  buildDraft,
  changedVariables,
  dialInChangeCount,
  draftFromBrew,
  findReferenceBrew,
  latestBrew,
  pickDefaultBeanId,
  pickDefaultMethod,
} from './brewDraft'
import { getDefaultRecipe } from './recipes'
import type { Bean, Brew } from './types'

const T = '2026-11-01T00:00:00.000Z'

function brew(over: Partial<Brew> & Pick<Brew, 'id'>): Brew {
  return {
    brewedAt: '2026-11-05T08:00:00.000Z',
    method: 'v60',
    beanId: 'b1',
    doseG: 15,
    waterG: 240,
    flavorTags: [],
    isBest: false,
    createdAt: T,
    updatedAt: T,
    ...over,
  }
}

function bean(id: string): Bean {
  return {
    id, name: id, roaster: '', origin: '', roastLevel: 'light', roastDate: '2026-10-20',
    weightG: 250, remainingG: 250, category: 'coffee', archived: false, createdAt: T, updatedAt: T,
  }
}

describe('latestBrew', () => {
  it('เลือกตามเวลาที่ชง; เวลาเท่ากันใช้เวลาที่สร้างระเบียน', () => {
    const a = brew({ id: 'a', brewedAt: '2026-11-05T08:00:00.000Z' })
    const b = brew({ id: 'b', brewedAt: '2026-11-06T08:00:00.000Z' })
    const c = brew({ id: 'c', brewedAt: '2026-11-06T08:00:00.000Z', createdAt: '2026-11-07T00:00:00.000Z' })
    expect(latestBrew([a, b])?.id).toBe('b')
    expect(latestBrew([a, b, c])?.id).toBe('c')
    expect(latestBrew([])).toBeUndefined()
  })
})

describe('buildDraft', () => {
  it('เมล็ด+วิธีเดียวกัน → เติมจากครั้งล่าสุดของเมล็ดนั้น', () => {
    const brews = [
      brew({ id: 'old', brewedAt: '2026-11-01T08:00:00.000Z', doseG: 14, grindSetting: 20 }),
      brew({ id: 'new', brewedAt: '2026-11-04T08:00:00.000Z', doseG: 16, waterG: 256, grindSetting: 18, tempC: 93, grinderId: 'g1' }),
      brew({ id: 'other-bean', beanId: 'b2', brewedAt: '2026-11-08T08:00:00.000Z', doseG: 20 }),
      brew({ id: 'other-method', method: 'espresso', brewedAt: '2026-11-09T08:00:00.000Z' }),
    ]
    const r = buildDraft({ method: 'v60', beanId: 'b1', brews })
    expect(r.source).toBe('sameBean')
    expect(r.reference?.id).toBe('new')
    expect(r.draft).toMatchObject({ method: 'v60', doseG: 16, waterG: 256, grindSetting: 18, tempC: 93, grinderId: 'g1' })
  })

  it('เมล็ดใหม่ที่ยังไม่เคยชง → เติมจากครั้งล่าสุดของวิธีเดียวกัน', () => {
    const brews = [brew({ id: 'x', beanId: 'b1', doseG: 18, waterG: 288, grindSetting: 22 })]
    const r = buildDraft({ method: 'v60', beanId: 'b2', brews })
    expect(r.source).toBe('sameMethod')
    expect(r.reference?.id).toBe('x')
    expect(r.draft.doseG).toBe(18)
  })

  it('ยังไม่มีประวัติของวิธีนี้ → ใช้สูตรตั้งต้น ไม่มีตัวเทียบ', () => {
    const r = buildDraft({ method: 'espresso', beanId: 'b1', brews: [brew({ id: 'x' })] })
    expect(r.source).toBe('recipe')
    expect(r.reference).toBeUndefined()
    const rec = getDefaultRecipe('espresso')
    expect(r.draft).toEqual({ method: 'espresso', doseG: rec.doseG, waterG: rec.waterG, tempC: rec.tempC, recipeId: rec.id })
  })

  it('ส่งสูตรของผู้ใช้เองได้', () => {
    const recipe = { ...getDefaultRecipe('v60'), id: 'mine', doseG: 20, waterG: 320, tempC: 96 }
    const r = buildDraft({ method: 'v60', brews: [], recipe })
    expect(r.draft).toMatchObject({ doseG: 20, waterG: 320, tempC: 96, recipeId: 'mine' })
  })

  it('ไม่ได้เลือกเมล็ด → ข้ามการหาแบบเมล็ดเดียวกัน', () => {
    const r = buildDraft({ method: 'v60', brews: [brew({ id: 'x' })] })
    expect(r.source).toBe('sameMethod')
  })

  it('ไม่ติดค่าเวลาชงจากครั้งก่อน (เป็นผลลัพธ์ ไม่ใช่ค่าตั้ง)', () => {
    const r = buildDraft({ method: 'v60', beanId: 'b1', brews: [brew({ id: 'x', totalTimeSec: 180 })] })
    expect(r.draft).not.toHaveProperty('totalTimeSec')
  })
})

describe('draftFromBrew', () => {
  it('คัดลอกเฉพาะค่าตั้ง ไม่รวมผลชิม', () => {
    const d = draftFromBrew(brew({ id: 'x', rating: 5, notes: 'ดี', tds: 1.4, yieldG: 200, grindSetting: 18, brewerId: 'v1', recipeId: 'default-v60' }))
    expect(d).toEqual({
      method: 'v60', doseG: 15, waterG: 240, tempC: undefined, grindSetting: 18,
      grinderId: undefined, brewerId: 'v1', recipeId: 'default-v60',
    })
  })
})

describe('pickDefault*', () => {
  it('เมล็ดตั้งต้น = เมล็ดของการชงล่าสุด ถ้ายังใช้ได้', () => {
    const beans = [bean('b1'), bean('b2')]
    const brews = [brew({ id: 'x', beanId: 'b2' })]
    expect(pickDefaultBeanId(beans, brews)).toBe('b2')
  })

  it('เมล็ดของการชงล่าสุดถูก Archive/ไม่อยู่ในรายการ → ใช้เมล็ดแรก', () => {
    expect(pickDefaultBeanId([bean('b1')], [brew({ id: 'x', beanId: 'gone' })])).toBe('b1')
    expect(pickDefaultBeanId([bean('b1'), bean('b2')], [])).toBe('b1')
    expect(pickDefaultBeanId([], [])).toBeUndefined()
  })

  it('วิธีชงตั้งต้น = วิธีของการชงล่าสุด ไม่มีประวัติใช้ค่าสำรอง', () => {
    expect(pickDefaultMethod([brew({ id: 'x', method: 'aeropress' })], 'v60')).toBe('aeropress')
    expect(pickDefaultMethod([], 'chemex')).toBe('chemex')
  })
})

describe('changedVariables / dialInChangeCount', () => {
  const ref = { doseG: 15, waterG: 240, grindSetting: 18, tempC: 94, grinderId: 'g1' }

  it('เหมือนเดิมทุกค่า → ไม่มีอะไรเปลี่ยน', () => {
    expect(changedVariables(ref, { ...ref })).toEqual([])
    expect(dialInChangeCount(ref, { ...ref })).toBe(0)
  })

  it('บอกว่าค่าไหนเปลี่ยน', () => {
    expect(changedVariables(ref, { ...ref, grindSetting: 17 })).toEqual(['grindSetting'])
    expect(changedVariables(ref, { ...ref, tempC: 96, grinderId: 'g2' })).toEqual(['tempC', 'grinderId'])
  })

  it('ล้างค่าที่เคยมี หรือเพิ่มค่าที่เคยไม่มี ถือว่าเปลี่ยน; ไม่มีทั้งคู่ไม่เปลี่ยน', () => {
    expect(changedVariables(ref, { ...ref, tempC: undefined })).toEqual(['tempC'])
    expect(changedVariables({ doseG: 15, waterG: 240 }, { doseG: 15, waterG: 240, tempC: 93 })).toEqual(['tempC'])
    expect(changedVariables({ doseG: 15, waterG: 240 }, { doseG: 15, waterG: 240 })).toEqual([])
  })

  it('เปลี่ยนตัวเดียว = 1; หลายตัว = นับตามจริง', () => {
    expect(dialInChangeCount(ref, { ...ref, grindSetting: 17 })).toBe(1)
    expect(dialInChangeCount(ref, { ...ref, grindSetting: 17, tempC: 96 })).toBe(2)
  })

  it('ปรับกาแฟและน้ำพร้อมกันแต่อัตราส่วนเท่าเดิม (ชงเพิ่ม) = 1 การปรับ', () => {
    expect(dialInChangeCount(ref, { ...ref, doseG: 30, waterG: 480 })).toBe(1)
  })

  it('ปรับกาแฟและน้ำจนอัตราส่วนเปลี่ยน = 2 การปรับ', () => {
    expect(dialInChangeCount(ref, { ...ref, doseG: 16, waterG: 240 })).toBe(1) // น้ำเท่าเดิม → เปลี่ยนแค่กาแฟ
    expect(dialInChangeCount(ref, { ...ref, doseG: 16, waterG: 250 })).toBe(2)
  })
})

describe('findReferenceBrew', () => {
  const a = brew({ id: 'a', brewedAt: '2026-11-01T08:00:00.000Z' })
  const b = brew({ id: 'b', brewedAt: '2026-11-03T08:00:00.000Z' })
  const c = brew({ id: 'c', brewedAt: '2026-11-05T08:00:00.000Z' })
  const other = brew({ id: 'o', beanId: 'b2', brewedAt: '2026-11-04T08:00:00.000Z' })
  const all = [a, b, c, other]

  it('ไม่ส่ง before → ล่าสุดของเมล็ด+วิธีนั้น', () => {
    expect(findReferenceBrew(all, { beanId: 'b1', method: 'v60' })?.id).toBe('c')
    expect(findReferenceBrew(all, { beanId: 'b1', method: 'espresso' })).toBeUndefined()
  })

  it('ส่ง before → ก่อนหน้าการชงนั้น ไม่นับตัวมันเอง', () => {
    expect(findReferenceBrew(all, { beanId: 'b1', method: 'v60', before: b })?.id).toBe('a')
    expect(findReferenceBrew(all, { beanId: 'b1', method: 'v60', before: a })).toBeUndefined()
  })
})
