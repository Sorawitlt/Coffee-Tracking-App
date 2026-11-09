import type { PlanStep } from '../../domain/brewPlan'
import { formatGrams } from '../format'
import { STEP_ACTION_HINT, STEP_ACTION_LABEL } from '../labels'

/** ชื่อขั้นตอน: ข้อความอิสระของสูตรผู้ใช้ก่อน ไม่มีจึงใช้ชื่อมาตรฐานตาม action */
export function stepTitle(step: Pick<PlanStep, 'action' | 'label'>): string {
  return step.label?.trim() || STEP_ACTION_LABEL[step.action]
}

export function stepHint(step: Pick<PlanStep, 'action' | 'label'>): string {
  return step.label?.trim() ? '' : STEP_ACTION_HINT[step.action]
}

/**
 * เป้าหมายบนตาชั่งของขั้นนี้ เช่น "ถึง 150 g" · Espresso "ช็อตถึง 36 g"
 * ไม่มีเป้า = undefined (เช่น รอ/คน/กด)
 */
export function stepTarget(step: Pick<PlanStep, 'action' | 'targetWaterG'>): string | undefined {
  if (step.targetWaterG === undefined) return undefined
  return `${step.action === 'extract' ? 'ช็อตถึง' : 'ถึง'} ${formatGrams(step.targetWaterG)} g`
}

/** ปริมาณที่ต้องเทเพิ่มในขั้นนี้ เช่น "+105 g" — แสดงเมื่อมีน้ำเดิมอยู่บนตาชั่งแล้วเท่านั้น */
export function stepDelta(step: Pick<PlanStep, 'action' | 'targetWaterG' | 'pourG'>): string | undefined {
  if (step.pourG === undefined || step.targetWaterG === undefined) return undefined
  if (step.pourG <= 0 || step.pourG >= step.targetWaterG) return undefined
  return `+${formatGrams(step.pourG)} g`
}
