import type { BrewPlan, PlanStep } from '../../domain/brewPlan'
import { buildPlan } from '../../domain/brewPlan'
import type { BrewDraft } from '../../domain/brewDraft'
import { READY, elapsedMs, type TimerState } from '../../domain/timer'
import { METHODS, type Method, type Recipe, type StepAction } from '../../domain/types'
import { numberToText } from '../formUtil'
import { draftToForm, toDateTimeLocal, type BrewFormValues } from '../brew/brewForm'

/**
 * เซสชันการชงที่กำลังทำอยู่ — เก็บลง localStorage ทุกครั้งที่สถานะเปลี่ยน (เริ่ม/พัก/ต่อ/จบ)
 * เพื่อให้ปิด-เปิดแอปหรือเบราว์เซอร์ล้างหน้าระหว่างชงแล้ว "กลับมาชงต่อ" ได้ (โดยเฉพาะ Cold brew ที่ใช้เวลาเป็นชั่วโมง)
 *
 * เก็บ "แผนที่ปรับแล้ว" ไว้ในเซสชันเลย ไม่อ้างสูตรในฐานข้อมูลซ้ำ → แก้สูตรกลางทางไม่กระทบการชงที่กำลังทำ
 * ข้อมูลใน storage ไม่น่าเชื่อถือเสมอ (เวอร์ชันเก่า/ถูกแก้) → ตรวจรูปแบบทุกครั้ง ผิดรูปแบบ = ทิ้ง
 */

export const SESSION_KEY = 'brewlog.assistant.session'
export const SESSION_VERSION = 1

/** ค่าตั้งของการชงครั้งนี้ (ย่อจาก BrewInput) */
export interface SessionInput {
  method: Method
  beanId: string
  recipeId?: string
  grinderId?: string
  brewerId?: string
  grindSetting?: number
  doseG: number
  waterG: number
  tempC?: number
}

export interface AssistantSession {
  version: typeof SESSION_VERSION
  input: SessionInput
  plan: BrewPlan
  timer: TimerState
  /** เวลาที่กดเริ่มจับเวลาครั้งแรก (epoch ms) — ใช้เป็นเวลาที่ชงตอนบันทึก */
  startedAtMs?: number
}

export function newSession(input: SessionInput, recipe: Pick<Recipe, 'waterG' | 'steps' | 'totalTimeSec'>): AssistantSession {
  return { version: SESSION_VERSION, input, plan: buildPlan(recipe, { waterG: input.waterG }), timer: READY }
}

// ---------- เก็บ / อ่าน ----------

export function saveSession(session: AssistantSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // เก็บไม่ได้ (เต็ม/ถูกบล็อก) → ยังชงต่อได้ แต่กู้คืนหลังปิดแอปไม่ได้
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ไม่มีอะไรต้องทำ
  }
}

export function loadSession(): AssistantSession | undefined {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (raw === null) return undefined
    const session = parseSession(JSON.parse(raw))
    if (!session) clearSession() // ข้อมูลเสีย — ล้างทิ้งไม่ให้ค้างทุกครั้งที่เปิดแอป
    return session
  } catch {
    clearSession()
    return undefined
  }
}

// ---------- ตรวจรูปแบบ ----------

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isPositive = (v: unknown): v is number => isNum(v) && v > 0
const isOptional = (v: unknown, check: (x: unknown) => boolean): boolean => v === undefined || check(v)
const isStr = (v: unknown): v is string => typeof v === 'string'

const STEP_ACTIONS: readonly StepAction[] = [
  'bloom', 'pour', 'stir', 'swirl', 'steep', 'press', 'extract', 'drawdown', 'heat', 'removeFromHeat', 'filter', 'custom',
]

function parseStep(v: unknown, index: number): PlanStep | undefined {
  if (!isObject(v)) return undefined
  const ok =
    v.index === index &&
    STEP_ACTIONS.includes(v.action as StepAction) &&
    isNum(v.startSec) && v.startSec >= 0 &&
    isOptional(v.endSec, isNum) &&
    isOptional(v.targetWaterG, isNum) &&
    isOptional(v.pourG, isNum) &&
    isOptional(v.label, isStr)
  return ok ? (v as unknown as PlanStep) : undefined
}

function parseTimer(v: unknown): TimerState | undefined {
  if (!isObject(v)) return undefined
  switch (v.status) {
    case 'ready':
      return READY
    case 'running':
      return isNum(v.startedAtMs) && isNum(v.offsetMs) && v.offsetMs >= 0
        ? { status: 'running', startedAtMs: v.startedAtMs, offsetMs: v.offsetMs }
        : undefined
    case 'paused':
    case 'finished':
      return isNum(v.elapsedMs) && v.elapsedMs >= 0 ? { status: v.status, elapsedMs: v.elapsedMs } : undefined
    default:
      return undefined
  }
}

/** ตรวจ JSON ที่อ่านจาก storage — ผิดรูปแบบข้อใดข้อหนึ่ง = `undefined` */
export function parseSession(value: unknown): AssistantSession | undefined {
  if (!isObject(value) || value.version !== SESSION_VERSION) return undefined
  const { input, plan } = value
  if (!isObject(input) || !isObject(plan)) return undefined

  const inputOk =
    METHODS.includes(input.method as Method) &&
    isStr(input.beanId) && input.beanId !== '' &&
    isPositive(input.doseG) && isPositive(input.waterG) &&
    isOptional(input.tempC, isNum) &&
    isOptional(input.grindSetting, isNum) &&
    isOptional(input.recipeId, isStr) && isOptional(input.grinderId, isStr) && isOptional(input.brewerId, isStr)
  if (!inputOk || !isPositive(plan.totalTimeSec) || !Array.isArray(plan.steps)) return undefined

  const steps = plan.steps.map(parseStep)
  if (steps.some((s) => s === undefined)) return undefined

  const timer = parseTimer(value.timer)
  if (!timer || !isOptional(value.startedAtMs, isNum)) return undefined
  // เริ่มจับเวลาแล้วต้องมีเวลาเริ่ม (ใช้เป็น brewedAt)
  if (timer.status !== 'ready' && value.startedAtMs === undefined) return undefined

  return {
    version: SESSION_VERSION,
    input: input as unknown as SessionInput,
    plan: { totalTimeSec: plan.totalTimeSec, steps: steps as PlanStep[] },
    timer,
    ...(value.startedAtMs === undefined ? {} : { startedAtMs: value.startedAtMs as number }),
  }
}

// ---------- แปลงเป็นค่าในฟอร์ม ----------

const toDraft = (input: SessionInput): BrewDraft => ({
  method: input.method,
  doseG: input.doseG,
  waterG: input.waterG,
  tempC: input.tempC,
  grindSetting: input.grindSetting,
  grinderId: input.grinderId,
  brewerId: input.brewerId,
  recipeId: input.recipeId,
})

/** ค่าในฟอร์มตั้งค่าก่อนชง — ใช้ตอนกด "แก้ไขค่า" ย้อนกลับจากหน้าพร้อมชง */
export function sessionToSetupValues(session: AssistantSession, at: Date = new Date()): BrewFormValues {
  return draftToForm(toDraft(session.input), session.input.beanId, at)
}

/** เวลาที่ชงจริงเป็นวินาทีเต็ม (ไม่มี = 0) */
export function sessionDurationSec(session: AssistantSession, now: number): number {
  return Math.round(elapsedMs(session.timer, now) / 1000)
}

/**
 * ค่าในฟอร์มบันทึกหลังชงเสร็จ: ค่าที่ตั้งไว้ + เวลาชงจริงจากตัวจับเวลา + เวลาเริ่มชง
 * ที่เหลือ (น้ำหนักช็อตจริง, TDS) ผู้ใช้เติมในฟอร์มได้
 */
export function sessionToSaveValues(session: AssistantSession, now: number): BrewFormValues {
  const startedAt = new Date(session.startedAtMs ?? now)
  const seconds = sessionDurationSec(session, now)
  return {
    ...draftToForm(toDraft(session.input), session.input.beanId, startedAt),
    totalTimeSec: seconds > 0 ? numberToText(seconds) : '',
    brewedAt: toDateTimeLocal(startedAt),
  }
}
