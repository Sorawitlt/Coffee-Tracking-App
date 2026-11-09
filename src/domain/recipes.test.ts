import { ratio } from './calc'
import { METHOD_PROFILES } from './methods'
import { DEFAULT_RECIPES, defaultRecipeId, getDefaultRecipe } from './recipes'
import { METHODS, type Method } from './types'

/** ค่าจากตาราง PLAN ข้อ 5.1 */
const PLAN: Record<Method, { ratio: [number, number]; dose: number; water: number; time: [number, number] }> = {
  espresso: { ratio: [2, 2], dose: 18, water: 36, time: [25, 30] },
  v60: { ratio: [16, 16], dose: 15, water: 240, time: [150, 210] },
  kalita: { ratio: [16, 16], dose: 20, water: 320, time: [180, 240] },
  chemex: { ratio: [16, 16], dose: 30, water: 480, time: [240, 300] },
  aeropress: { ratio: [15, 15], dose: 15, water: 225, time: [90, 150] },
  frenchPress: { ratio: [15, 15], dose: 30, water: 450, time: [240, 240] },
  moka: { ratio: [7, 10], dose: 17, water: 150, time: [240, 360] },
  coldBrew: { ratio: [8, 8], dose: 100, water: 800, time: [12 * 3600, 18 * 3600] },
}

describe('สูตรตั้งต้น (Default recipes)', () => {
  it('มีครบ 8 วิธีชง ไม่ซ้ำ และ ID คงที่', () => {
    expect(DEFAULT_RECIPES).toHaveLength(8)
    expect(DEFAULT_RECIPES.map((r) => r.method).sort()).toEqual([...METHODS].sort())
    expect(new Set(DEFAULT_RECIPES.map((r) => r.id)).size).toBe(8)
    for (const r of DEFAULT_RECIPES) expect(r.id).toBe(defaultRecipeId(r.method))
  })

  it('สร้างซ้ำได้ผลเหมือนเดิมทุกครั้ง (deterministic)', () => {
    expect(getDefaultRecipe('v60')).toEqual(DEFAULT_RECIPES.find((r) => r.method === 'v60'))
    expect(getDefaultRecipe('v60')).not.toBe(getDefaultRecipe('v60'))
  })

  describe.each(DEFAULT_RECIPES.map((r) => [r.method, r] as const))('%s', (method, r) => {
    const plan = PLAN[method]

    it('ปริมาณ อัตราส่วน และเวลา ตรงตาม PLAN', () => {
      expect(r.doseG).toBe(plan.dose)
      expect(r.waterG).toBe(plan.water)
      const x = ratio(r.doseG, r.waterG)!
      expect(x).toBeGreaterThanOrEqual(plan.ratio[0])
      expect(x).toBeLessThanOrEqual(plan.ratio[1])
      expect(r.totalTimeSec).toBeGreaterThanOrEqual(plan.time[0])
      expect(r.totalTimeSec).toBeLessThanOrEqual(plan.time[1])
    })

    it('อุณหภูมิอยู่ในช่วงของวิธีชง (หรือไม่ระบุถ้าไม่เกี่ยวข้อง)', () => {
      const range = METHOD_PROFILES[method].tempRangeC
      if (range) {
        expect(r.tempC).toBeGreaterThanOrEqual(range[0])
        expect(r.tempC).toBeLessThanOrEqual(range[1])
      } else {
        expect(r.tempC).toBeUndefined()
      }
    })

    it('ข้อมูลประกอบถูกต้อง', () => {
      expect(r.isDefault).toBe(true)
      expect(r.category).toBe('coffee')
      expect(r.grindHint).toBe(METHOD_PROFILES[method].grindHint)
      expect(r.name.length).toBeGreaterThan(0)
    })

    it('ขั้นตอนเริ่มที่ 0, เรียงตามเวลา, ไม่เกินเวลารวม', () => {
      expect(r.steps.length).toBeGreaterThan(0)
      expect(r.steps[0].atSec).toBe(0)
      for (let i = 1; i < r.steps.length; i++) {
        expect(r.steps[i].atSec).toBeGreaterThan(r.steps[i - 1].atSec)
      }
      expect(r.steps.at(-1)!.atSec).toBeLessThanOrEqual(r.totalTimeSec)
    })

    it('น้ำสะสมเพิ่มขึ้นเรื่อย ๆ และจบที่ปริมาณน้ำของสูตร', () => {
      const targets = r.steps.flatMap((s) => (s.targetWaterG === undefined ? [] : [s.targetWaterG]))
      for (let i = 1; i < targets.length; i++) expect(targets[i]).toBeGreaterThan(targets[i - 1])
      if (targets.length > 0) expect(targets.at(-1)).toBe(r.waterG)
    })
  })

  it('V60 ตรงตัวอย่างใน PLAN: Bloom 45 g → 0:45 ถึง 150 g → 1:15 ถึง 240 g', () => {
    const v60 = getDefaultRecipe('v60')
    expect(v60.steps.slice(0, 3)).toEqual([
      { atSec: 0, action: 'bloom', targetWaterG: 45 },
      { atSec: 45, action: 'pour', targetWaterG: 150 },
      { atSec: 75, action: 'pour', targetWaterG: 240 },
    ])
  })

  it('Bloom ประมาณ 2–3 เท่าของน้ำหนักกาแฟ', () => {
    for (const r of DEFAULT_RECIPES) {
      const bloom = r.steps.find((s) => s.action === 'bloom')
      if (!bloom?.targetWaterG) continue
      expect(bloom.targetWaterG / r.doseG).toBeGreaterThanOrEqual(2)
      expect(bloom.targetWaterG / r.doseG).toBeLessThanOrEqual(3)
    }
  })
})
