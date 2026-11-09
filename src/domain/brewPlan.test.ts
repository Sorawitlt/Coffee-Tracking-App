import {
  RATIO_PRESETS, TICK_LEAD_SEC, buildPlan, cuesBetween, planCues, scaleSteps, secondsLeftInStep, secondsUntilNextStep,
  stepIndexAt, strongestCue,
} from './brewPlan'
import { ratio } from './calc'
import { getDefaultRecipe } from './recipes'
import { METHODS, type Method, type RecipeStep } from './types'

const planOf = (method: Method, waterG = getDefaultRecipe(method).waterG) =>
  buildPlan(getDefaultRecipe(method), { waterG })

describe('scaleSteps', () => {
  const steps: RecipeStep[] = [
    { atSec: 0, action: 'bloom', targetWaterG: 45 },
    { atSec: 45, action: 'pour', targetWaterG: 150 },
    { atSec: 75, action: 'pour', targetWaterG: 240 },
    { atSec: 105, action: 'drawdown' },
  ]

  it('น้ำเท่าเดิม → ไม่เปลี่ยนค่า (แต่เป็นสำเนา)', () => {
    const out = scaleSteps(steps, 240, 240)
    expect(out).toEqual(steps)
    expect(out[0]).not.toBe(steps[0])
  })

  it('ปรับเป้าตามสัดส่วนน้ำ ปัดเป็นกรัมเต็ม และขั้นสุดท้ายได้น้ำทั้งหมดตรง ๆ', () => {
    const out = scaleSteps(steps, 240, 300) // ×1.25
    expect(out.map((s) => s.targetWaterG)).toEqual([56, 188, 300, undefined])
  })

  it('น้ำที่ผู้ใช้ตั้งเป็นทศนิยม → ขั้นสุดท้ายคงค่าไว้ ไม่ถูกปัด', () => {
    const out = scaleSteps(steps, 240, 247.5)
    expect(out[2].targetWaterG).toBe(247.5)
    expect(out[1].targetWaterG).toBe(155)
  })

  it('ลดน้ำ: เป้าลดลง ไม่เกินน้ำทั้งหมด และลำดับไม่ถอยหลัง', () => {
    const out = scaleSteps(steps, 240, 180)
    const targets = out.map((s) => s.targetWaterG).filter((t): t is number => t !== undefined)
    expect(targets).toEqual([34, 113, 180]) // 33.75→34, 112.5→113
    expect([...targets].sort((a, b) => a - b)).toEqual(targets)
  })

  it('ไม่แตะเวลา/action และขั้นที่ไม่มีเป้า', () => {
    const out = scaleSteps(steps, 240, 300)
    expect(out.map((s) => [s.atSec, s.action])).toEqual(steps.map((s) => [s.atSec, s.action]))
    expect(out[3]).not.toHaveProperty('targetWaterG')
  })

  it('ค่าน้ำไม่ถูกต้อง (0, NaN) → คืนค่าเดิม ไม่พัง', () => {
    expect(scaleSteps(steps, 240, 0)).toEqual(steps)
    expect(scaleSteps(steps, 240, Number.NaN)).toEqual(steps)
    expect(scaleSteps(steps, 0, 300)).toEqual(steps)
  })
})

describe('buildPlan', () => {
  it('V60 สูตรตั้งต้น: เวลาเริ่ม-จบ เป้าน้ำหนัก และปริมาณที่ต้องเทแต่ละขั้น', () => {
    const plan = planOf('v60')
    expect(plan.totalTimeSec).toBe(180)
    expect(plan.steps).toEqual([
      { index: 0, action: 'bloom', startSec: 0, endSec: 45, targetWaterG: 45, pourG: 45 },
      { index: 1, action: 'pour', startSec: 45, endSec: 75, targetWaterG: 150, pourG: 105 },
      { index: 2, action: 'pour', startSec: 75, endSec: 105, targetWaterG: 240, pourG: 90 },
      { index: 3, action: 'drawdown', startSec: 105, endSec: 180 },
    ])
  })

  it('ปรับน้ำเป็น 300 g → เป้าและปริมาณเทตามสัดส่วน ผลรวมการเท = น้ำทั้งหมด', () => {
    const plan = planOf('v60', 300)
    expect(plan.steps.map((s) => s.targetWaterG)).toEqual([56, 188, 300, undefined])
    const poured = plan.steps.reduce((sum, s) => sum + (s.pourG ?? 0), 0)
    expect(poured).toBe(300)
  })

  it('Espresso: ขั้นเดียว เป้า = น้ำหนักช็อต และจบที่เวลาเป้าหมาย', () => {
    expect(planOf('espresso').steps).toEqual([
      { index: 0, action: 'extract', startSec: 0, endSec: 28, targetWaterG: 36, pourG: 36 },
    ])
    expect(planOf('espresso', 40).steps[0].targetWaterG).toBe(40)
  })

  it('ขั้นสุดท้ายที่เริ่มพร้อมเวลาเป้าหมาย → ไม่มี endSec (รอผู้ใช้กดเสร็จ)', () => {
    const press = planOf('frenchPress').steps.at(-1)!
    expect(press).toMatchObject({ action: 'press', startSec: 240 })
    expect(press).not.toHaveProperty('endSec')
  })

  it('ขั้นที่ไม่ได้เรียงเวลา/เวลาผิดปกติ → เรียงให้ และตัดขั้นที่เวลาติดลบ', () => {
    const plan = buildPlan(
      {
        waterG: 100,
        totalTimeSec: 60,
        steps: [
          { atSec: 30, action: 'pour', targetWaterG: 100 },
          { atSec: -5, action: 'stir' },
          { atSec: 0, action: 'bloom', targetWaterG: 30 },
        ],
      },
      { waterG: 100 },
    )
    expect(plan.steps.map((s) => [s.index, s.action, s.startSec, s.pourG])).toEqual([
      [0, 'bloom', 0, 30],
      [1, 'pour', 30, 70],
    ])
  })

  it('สูตรผู้ใช้ที่มี label ข้อความอิสระ → เก็บ label ไว้', () => {
    const plan = buildPlan(
      { waterG: 100, totalTimeSec: 60, steps: [{ atSec: 0, action: 'custom', label: 'ล้างฟิลเตอร์' }] },
      { waterG: 100 },
    )
    expect(plan.steps[0]).toMatchObject({ action: 'custom', label: 'ล้างฟิลเตอร์' })
  })

  it('ทุกสูตรตั้งต้น: ไทม์ไลน์เรียงต่อเนื่อง เป้าน้ำไม่ถอยหลัง และสร้างจากน้ำที่ปรับได้', () => {
    for (const method of METHODS) {
      for (const water of [getDefaultRecipe(method).waterG, getDefaultRecipe(method).waterG * 1.5]) {
        const { steps } = planOf(method, water)
        expect(steps.length).toBeGreaterThan(0)
        let prevStart = -1
        let prevTarget = 0
        for (const s of steps) {
          expect(s.startSec).toBeGreaterThanOrEqual(prevStart)
          prevStart = s.startSec
          if (s.targetWaterG !== undefined) {
            expect(s.targetWaterG).toBeGreaterThanOrEqual(prevTarget)
            expect(s.targetWaterG).toBeLessThanOrEqual(water)
            prevTarget = s.targetWaterG
          }
        }
      }
    }
  })
})

describe('ตำแหน่งบนไทม์ไลน์', () => {
  const plan = planOf('v60')

  it('stepIndexAt: ตรงขอบเขตเข้าขั้นใหม่พอดี', () => {
    expect(stepIndexAt(plan, 0)).toBe(0)
    expect(stepIndexAt(plan, 44.999)).toBe(0)
    expect(stepIndexAt(plan, 45)).toBe(1)
    expect(stepIndexAt(plan, 104)).toBe(2)
    expect(stepIndexAt(plan, 105)).toBe(3)
    expect(stepIndexAt(plan, 9999)).toBe(3)
    expect(stepIndexAt(plan, -1)).toBe(-1)
    expect(stepIndexAt({ totalTimeSec: 10, steps: [] }, 5)).toBe(-1)
  })

  it('secondsUntilNextStep / secondsLeftInStep', () => {
    expect(secondsUntilNextStep(plan, 30)).toBe(15)
    expect(secondsLeftInStep(plan, 30)).toBe(15)
    // ขั้นสุดท้าย: ไม่มีขั้นถัดไป แต่ยังมีเวลาเป้าหมาย
    expect(secondsUntilNextStep(plan, 120)).toBeUndefined()
    expect(secondsLeftInStep(plan, 120)).toBe(60)
    // เกินเวลาเป้าหมายแล้ว → 0 ไม่ติดลบ
    expect(secondsLeftInStep(plan, 200)).toBe(0)
    // ไม่รู้เวลาจบ
    expect(secondsLeftInStep(planOf('frenchPress'), 250)).toBeUndefined()
  })
})

describe('สัญญาณเตือน', () => {
  it('V60: เสียงเริ่มทุกขั้น, นับถอยหลัง 3 วินาทีก่อนขั้นถัดไป, และเตือนครบเวลาเป้าหมาย', () => {
    const cues = planCues(planOf('v60'))
    expect(cues.filter((c) => c.kind === 'step').map((c) => c.atSec)).toEqual([0, 45, 75, 105])
    expect(cues.filter((c) => c.kind === 'tick').map((c) => c.atSec)).toEqual([42, 43, 44, 72, 73, 74, 102, 103, 104])
    expect(cues.filter((c) => c.kind === 'target').map((c) => c.atSec)).toEqual([180])
    // เรียงตามเวลา
    expect(cues.map((c) => c.atSec)).toEqual([...cues.map((c) => c.atSec)].sort((a, b) => a - b))
  })

  it('tick ผูกกับขั้นที่กำลังจะเริ่ม', () => {
    const tick = planCues(planOf('v60')).find((c) => c.kind === 'tick' && c.atSec === 44)
    expect(tick).toEqual({ atSec: 44, kind: 'tick', stepIndex: 1 })
    expect(TICK_LEAD_SEC).toBe(3)
  })

  it('Espresso: เตือนเมื่อถึงเวลาเป้าหมาย (28 วินาที) เพราะไม่มีขั้นถัดไป', () => {
    expect(planCues(planOf('espresso'))).toEqual([
      { atSec: 0, kind: 'step', stepIndex: 0 },
      { atSec: 28, kind: 'target' },
    ])
  })

  it('ไม่ซ้อนกัน: ขั้นที่ห่างกันน้อยกว่า 3 วินาทีจะไม่มี tick ที่ตกก่อนขั้นก่อนหน้า', () => {
    const plan = buildPlan(
      {
        waterG: 100,
        totalTimeSec: 60,
        steps: [
          { atSec: 10, action: 'pour' },
          { atSec: 12, action: 'stir' },
          { atSec: 30, action: 'steep' },
        ],
      },
      { waterG: 100 },
    )
    const ticks = planCues(plan).filter((c) => c.kind === 'tick')
    // ขั้นที่ 2 (12 s): lead 3→9, 2→10 (ไม่ใช่ > 10), 1→11 ✓  · ขั้นแรก (10 s) ไม่มี tick
    expect(ticks.filter((c) => c.stepIndex === 1).map((c) => c.atSec)).toEqual([11])
    expect(ticks.filter((c) => c.stepIndex === 2).map((c) => c.atSec)).toEqual([27, 28, 29])
  })

  it('ขั้นสุดท้ายเริ่มพร้อมเวลาเป้าหมาย (French Press) → ไม่มีสัญญาณ target ซ้ำ', () => {
    expect(planCues(planOf('frenchPress')).some((c) => c.kind === 'target')).toBe(false)
  })

  it('cuesBetween: ไม่รวมจุดเริ่ม รวมจุดสิ้นสุด — ไม่เตือนซ้ำเมื่อเรียกต่อเนื่อง', () => {
    const plan = planOf('v60')
    expect(cuesBetween(plan, 0, 41.9)).toEqual([])
    expect(cuesBetween(plan, 41.9, 42).map((c) => c.atSec)).toEqual([42])
    expect(cuesBetween(plan, 42, 45).map((c) => [c.atSec, c.kind])).toEqual([[43, 'tick'], [44, 'tick'], [45, 'step']])
    // ต่อเนื่องกันสองช่วง ไม่ซ้ำ ไม่ตก
    const a = cuesBetween(plan, 0, 50)
    const b = cuesBetween(plan, 50, 100)
    expect([...a, ...b]).toEqual(cuesBetween(plan, 0, 100))
  })

  it('strongestCue: target > step > tick; ว่าง → undefined', () => {
    expect(strongestCue([])).toBeUndefined()
    expect(strongestCue([{ atSec: 1, kind: 'tick' }, { atSec: 2, kind: 'step' }])?.kind).toBe('step')
    expect(strongestCue([{ atSec: 1, kind: 'target' }, { atSec: 2, kind: 'tick' }])?.kind).toBe('target')
  })
})

describe('อัตราส่วนลัด', () => {
  it('ทุกวิธีมีตัวเลือก เรียงจากน้อยไปมาก และมีอัตราส่วนของสูตรตั้งต้นรวมอยู่ (Moka โดยประมาณ)', () => {
    for (const method of METHODS) {
      const presets = RATIO_PRESETS[method]
      expect(presets.length).toBeGreaterThanOrEqual(3)
      expect([...presets].sort((a, b) => a - b)).toEqual([...presets])
      const recipe = getDefaultRecipe(method)
      const r = ratio(recipe.doseG, recipe.waterG)!
      expect(presets.some((p) => Math.abs(p - r) <= 0.25)).toBe(true)
    }
  })
})
