import { roundTo } from './calc'
import type { Method, Recipe, RecipeStep, StepAction } from './types'

/**
 * แผนการชงของผู้ช่วยชง (PLAN ข้อ 3 โมดูล D) — Pure functions ไม่มี UI
 *
 * - `buildPlan`  : สูตร + น้ำที่ใช้จริง → ไทม์ไลน์ขั้นตอน (ปรับเป้าน้ำหนักตามสัดส่วนน้ำ)
 * - `stepIndexAt`: ตอนนี้อยู่ขั้นไหน
 * - `cuesBetween`: ช่วงเวลาที่ผ่านมามีสัญญาณเตือนอะไรถึงเวลาบ้าง (เสียง/สั่น)
 */

export interface PlanStep {
  index: number
  action: StepAction
  /** ข้อความอิสระของสูตรผู้ใช้ (สูตรตั้งต้นใช้ `action` แปลที่ UI) */
  label?: string
  /** เริ่มขั้นนี้ที่วินาทีที่เท่าไรนับจากเริ่มชง */
  startSec: number
  /**
   * จบขั้นนี้ที่วินาทีที่เท่าไร = เริ่มขั้นถัดไป · ขั้นสุดท้ายใช้เวลาชงเป้าหมาย
   * ไม่มี = ไม่รู้เวลาจบ (ผู้ใช้กด "เสร็จสิ้น" เอง เช่น น้ำหยดหมด)
   */
  endSec?: number
  /** น้ำหนักสะสมบนตาชั่งเมื่อจบขั้นนี้ (g) — Espresso คือน้ำหนักช็อต */
  targetWaterG?: number
  /** น้ำที่ต้องเทเพิ่มในขั้นนี้ (g) = เป้าขั้นนี้ − เป้าขั้นก่อนหน้า */
  pourG?: number
}

export interface BrewPlan {
  /** เวลาชงเป้าหมาย (วินาที) */
  totalTimeSec: number
  steps: PlanStep[]
}

// ---------- สร้างแผน ----------

/**
 * ปรับเป้าน้ำหนักของทุกขั้นตามน้ำที่ใช้จริง (`fromWaterG` → `toWaterG`)
 * - ขั้นที่เป้า = น้ำทั้งหมดของสูตร (เช่น เทครั้งสุดท้าย) จะได้ `toWaterG` ตรง ๆ ไม่ปัดเศษ
 * - ขั้นอื่นปัดเป็นกรัมเต็ม (ตาชั่งทั่วไปอ่านละเอียด 0.1–1 g) และไม่เกิน `toWaterG`
 * - เวลาไม่ถูกปรับ — จังหวะการเทขึ้นกับเทคนิค ไม่ใช่ปริมาณ
 */
export function scaleSteps(steps: readonly RecipeStep[], fromWaterG: number, toWaterG: number): RecipeStep[] {
  const valid = fromWaterG > 0 && toWaterG > 0 && Number.isFinite(fromWaterG) && Number.isFinite(toWaterG)
  const factor = valid ? toWaterG / fromWaterG : 1
  return steps.map((step) => {
    if (!valid || step.targetWaterG === undefined || factor === 1) return { ...step }
    const targetWaterG =
      step.targetWaterG >= fromWaterG ? toWaterG : Math.min(toWaterG, Math.round(step.targetWaterG * factor))
    return { ...step, targetWaterG }
  })
}

/** สร้างไทม์ไลน์จากสูตร ณ ปริมาณน้ำที่ผู้ใช้ตั้ง */
export function buildPlan(
  recipe: Pick<Recipe, 'waterG' | 'steps' | 'totalTimeSec'>,
  { waterG }: { waterG: number },
): BrewPlan {
  // sort เป็น stable → ขั้นที่เวลาเท่ากันคงลำดับเดิม
  const sorted = scaleSteps(recipe.steps, recipe.waterG, waterG)
    .filter((s) => Number.isFinite(s.atSec) && s.atSec >= 0)
    .sort((a, b) => a.atSec - b.atSec)

  let previousTarget = 0
  const steps = sorted.map((s, i): PlanStep => {
    const next = sorted[i + 1]
    const endSec = next ? next.atSec : recipe.totalTimeSec > s.atSec ? recipe.totalTimeSec : undefined
    const step: PlanStep = { index: i, action: s.action, startSec: s.atSec }
    if (s.label) step.label = s.label
    if (endSec !== undefined) step.endSec = endSec
    if (s.targetWaterG !== undefined) {
      step.targetWaterG = s.targetWaterG
      step.pourG = Math.max(0, roundTo(s.targetWaterG - previousTarget, 1))
      previousTarget = s.targetWaterG
    }
    return step
  })

  return { totalTimeSec: recipe.totalTimeSec, steps }
}

// ---------- ตำแหน่งบนไทม์ไลน์ ----------

/** ขั้นปัจจุบัน ณ เวลา `elapsedSec` — −1 = ยังไม่ถึงขั้นแรก (หรือแผนไม่มีขั้นตอน) */
export function stepIndexAt(plan: BrewPlan, elapsedSec: number): number {
  for (let i = plan.steps.length - 1; i >= 0; i--) {
    if (elapsedSec >= plan.steps[i].startSec) return i
  }
  return -1
}

/** เหลืออีกกี่วินาทีจะถึงขั้นถัดไป — ไม่มีขั้นถัดไป = undefined */
export function secondsUntilNextStep(plan: BrewPlan, elapsedSec: number): number | undefined {
  const next = plan.steps[stepIndexAt(plan, elapsedSec) + 1]
  return next ? Math.max(0, next.startSec - elapsedSec) : undefined
}

/** เหลืออีกกี่วินาทีจะจบขั้นปัจจุบัน — ไม่รู้เวลาจบ = undefined */
export function secondsLeftInStep(plan: BrewPlan, elapsedSec: number): number | undefined {
  const step = plan.steps[stepIndexAt(plan, elapsedSec)]
  return step?.endSec === undefined ? undefined : Math.max(0, step.endSec - elapsedSec)
}

// ---------- สัญญาณเตือน ----------

/**
 * - `tick`  : นับถอยหลังสั้น ๆ ก่อนเริ่มขั้นถัดไป (3-2-1) เสียงเบา
 * - `step`  : เริ่มขั้นใหม่
 * - `target`: ถึงเวลาชงเป้าหมายแล้ว (หลังขั้นสุดท้ายเริ่ม)
 */
export type CueKind = 'tick' | 'step' | 'target'

export interface PlanCue {
  atSec: number
  kind: CueKind
  stepIndex?: number
}

/** นับถอยหลังกี่วินาทีก่อนเริ่มขั้นถัดไป */
export const TICK_LEAD_SEC = 3

/** สัญญาณเตือนทั้งหมดของแผน เรียงตามเวลา */
export function planCues(plan: BrewPlan): PlanCue[] {
  const cues: PlanCue[] = []
  plan.steps.forEach((step, i) => {
    if (i > 0) {
      // tick ต้องอยู่หลังเวลาเริ่มขั้นก่อนหน้า ไม่งั้นซ้อนกับสัญญาณของขั้นนั้น
      for (let lead = TICK_LEAD_SEC; lead >= 1; lead--) {
        const at = step.startSec - lead
        if (at > 0 && at > plan.steps[i - 1].startSec) cues.push({ atSec: at, kind: 'tick', stepIndex: i })
      }
    }
    cues.push({ atSec: step.startSec, kind: 'step', stepIndex: i })
  })
  const last = plan.steps[plan.steps.length - 1]
  if (last && plan.totalTimeSec > last.startSec) cues.push({ atSec: plan.totalTimeSec, kind: 'target' })
  return cues.sort((a, b) => a.atSec - b.atSec)
}

/** สัญญาณที่ถึงเวลาในช่วง (fromSec, toSec] — ไม่รวมจุดเริ่ม รวมจุดสิ้นสุด */
export function cuesBetween(plan: BrewPlan, fromSec: number, toSec: number): PlanCue[] {
  return planCues(plan).filter((c) => c.atSec > fromSec && c.atSec <= toSec)
}

const CUE_PRIORITY: Record<CueKind, number> = { tick: 0, step: 1, target: 2 }

/** เลือกสัญญาณที่สำคัญที่สุด — ถ้าหลายอย่างถึงเวลาพร้อมกัน (เช่น กลับมาเปิดแอป) เล่นเสียงเดียวพอ */
export function strongestCue(cues: readonly PlanCue[]): PlanCue | undefined {
  let best: PlanCue | undefined
  for (const c of cues) if (!best || CUE_PRIORITY[c.kind] >= CUE_PRIORITY[best.kind]) best = c
  return best
}

// ---------- อัตราส่วนลัด ----------

/**
 * อัตราส่วน (ค่า x ใน 1 : x) ที่นิยมของแต่ละวิธี — ปุ่มลัดตอนตั้งค่าก่อนชง
 * อิงช่วงใน PLAN ข้อ 5.1 (Moka เป็นอัตราส่วนโดยประมาณ ~1 : 7–10)
 */
export const RATIO_PRESETS: Record<Method, readonly number[]> = {
  espresso: [1.5, 2, 2.5, 3],
  v60: [15, 16, 17, 18],
  kalita: [15, 16, 17, 18],
  chemex: [15, 16, 17, 18],
  aeropress: [13, 14, 15, 16],
  frenchPress: [12, 14, 15, 16],
  moka: [7, 8, 9, 10],
  coldBrew: [5, 8, 12, 15],
}
