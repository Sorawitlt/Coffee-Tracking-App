import { daysOffRoast, FRESH_MIN_DAYS, ratio as calcRatio, roundTo, STALE_AFTER_DAYS } from './calc'
import { ESPRESSO_FAST_SEC, ESPRESSO_SLOW_SEC, METHOD_PROFILES } from './methods'
import type { Adjustment, Advice, AdviceNote, Bean, Brew, Gear, GrindScale, Method } from './types'

/**
 * Dial-in Advisor (PLAN ข้อ 5.3) — กฎตัดสินใจแบบ Rule-based ทำงานออฟไลน์
 *
 * หลักการ
 * 1. แนะนำ "ปรับเพียง 1 อย่าง" (`adjustment`) + ทางเลือกสำรอง (`alternatives`)
 * 2. ลำดับความสำคัญของตัวแปร: ระดับบด → อัตราส่วน → อุณหภูมิ → เวลา/เทคนิค
 * 3. ลำดับการตรวจอาการ:
 *    Espresso เวลาไหลผิดปกติ (วัดได้จริง) → ไม่มีผลชิม → เปรี้ยวและขมพร้อมกัน
 *    → เปรี้ยว/ขม (การสกัด) → จืด/เข้ม (ความเข้ม) → อร่อยแล้ว / สมดุล
 * 4. ผลลัพธ์เป็น "รหัส" ไม่ใช่ข้อความ → UI แปลผ่าน i18n
 */

export interface DialInInput {
  method: Method
  doseG: number
  waterG: number
  grindSetting?: number
  grindScale?: GrindScale
  /** false = ปรับระดับบดไม่ได้ (เช่น ใช้กาแฟบดสำเร็จ) */
  canAdjustGrind?: boolean
  tempC?: number
  totalTimeSec?: number
  rating?: number
  /** −2 เปรี้ยว … +2 ขม */
  balance?: number
  /** −2 บาง/จืด … +2 หนัก/เข้ม */
  body?: number
  sourAndBitter?: boolean
  daysOffRoast?: number
}

/** ปรับอุณหภูมิครั้งละ 2 °C (PLAN ข้อ 5.3) */
export const TEMP_STEP_C = 2
/** ขอบเขตอุณหภูมิที่ยังแนะนำได้ */
export const MAX_TEMP_C = 100
export const MIN_TEMP_C = 80
/** คะแนนขั้นต่ำที่ถือว่า "อร่อยแล้ว" */
export const BEST_MIN_RATING = 4

type Direction = 'up' | 'down'

/** ระดับบด: up = ละเอียดขึ้น (เลขน้อยลง), down = หยาบขึ้น */
function grindAdjustment(input: DialInInput, finer: boolean): Adjustment | undefined {
  if (input.canAdjustGrind === false) return undefined
  const direction = finer ? 'finer' : 'coarser'
  const scale = input.grindScale
  const step = scale?.step && scale.step > 0 ? scale.step : 1
  const from = input.grindSetting
  if (from === undefined) return { variable: 'grind', direction, steps: 1 }
  const to = roundTo(finer ? from - step : from + step, 4)
  if (scale && (to < scale.min || to > scale.max)) return undefined
  return { variable: 'grind', direction, steps: 1, from, to }
}

function tempAdjustment(input: DialInInput, dir: Direction): Adjustment | undefined {
  if (!METHOD_PROFILES[input.method].tempRangeC) return undefined
  const deltaC = dir === 'up' ? TEMP_STEP_C : -TEMP_STEP_C
  const from = input.tempC
  if (from === undefined) return { variable: 'temp', deltaC }
  const to = from + deltaC
  if (to > MAX_TEMP_C || to < MIN_TEMP_C) return undefined
  return { variable: 'temp', deltaC, from, to }
}

function timeAdjustment(input: DialInInput, dir: Direction): Adjustment | undefined {
  const profile = METHOD_PROFILES[input.method]
  // Espresso คุมเวลาด้วยระดับบด ไม่ใช่ปรับเวลาโดยตรง
  if (profile.style === 'espresso') return undefined
  const deltaSec = dir === 'up' ? profile.timeStepSec : -profile.timeStepSec
  const from = input.totalTimeSec
  if (from === undefined) return { variable: 'time', deltaSec }
  const to = from + deltaSec
  if (to <= 0) return undefined
  return { variable: 'time', deltaSec, from, to }
}

/**
 * ปรับอัตราส่วนครั้งละ `ratioStep` แล้วปัดเข้าหาค่ากลม (เช่น 1:16 → 1:15, 1:15.7 → 1:15)
 * stronger = true → อัตราส่วนแคบลง (เข้มขึ้น)
 */
function ratioAdjustment(input: DialInInput, stronger: boolean): Adjustment | undefined {
  const from = calcRatio(input.doseG, input.waterG)
  if (from === undefined) return undefined
  const profile = METHOD_PROFILES[input.method]
  const step = profile.ratioStep
  const raw = stronger ? from - step : from + step
  const to = roundTo(Math.round(raw / step) * step, 2)
  if (to < 1 || to === roundTo(from, 2)) return undefined
  const fromRounded = roundTo(from, 2)
  if (profile.ratioAdjusts === 'water') {
    return { variable: 'ratio', from: fromRounded, to, doseG: input.doseG, waterG: roundTo(input.doseG * to, 1) }
  }
  return { variable: 'ratio', from: fromRounded, to, doseG: roundTo(input.waterG / to, 1), waterG: input.waterG }
}

function pick(candidates: (Adjustment | undefined)[]): Pick<Advice, 'adjustment' | 'alternatives'> {
  const valid = candidates.filter((c): c is Adjustment => c !== undefined)
  return { adjustment: valid[0], alternatives: valid.slice(1) }
}

function freshnessNotes(days: number | undefined): AdviceNote[] {
  if (days === undefined) return []
  if (days < FRESH_MIN_DAYS) return ['beanTooFresh']
  if (days > STALE_AFTER_DAYS) return ['beanStale']
  return []
}

export function advise(input: DialInInput): Advice {
  const notes = freshnessNotes(input.daysOffRoast)
  const isEspresso = METHOD_PROFILES[input.method].style === 'espresso'

  // 1) Espresso: เวลาไหลเป็นค่าที่วัดได้จริง → ตรวจก่อนผลชิม
  if (isEspresso && input.totalTimeSec !== undefined) {
    if (input.totalTimeSec < ESPRESSO_FAST_SEC) {
      return { kind: 'espressoFast', ...pick([grindAdjustment(input, true)]), notes }
    }
    if (input.totalTimeSec > ESPRESSO_SLOW_SEC) {
      return { kind: 'espressoSlow', ...pick([grindAdjustment(input, false)]), notes }
    }
  }

  const hasTasting =
    input.rating !== undefined || input.balance !== undefined || input.body !== undefined || input.sourAndBitter === true
  if (!hasTasting) return { kind: 'needTasting', alternatives: [], notes }

  const balance = input.balance ?? 0
  const body = input.body ?? 0

  // 2) เปรี้ยวและขมพร้อมกัน → ปรับเทคนิค
  if (input.sourAndBitter) {
    return { kind: 'uneven', adjustment: { variable: 'technique' }, alternatives: [], notes }
  }

  // 3) การสกัด: ระดับบด → อุณหภูมิ → เวลา
  if (balance < 0) {
    return {
      kind: 'underExtracted',
      ...pick([grindAdjustment(input, true), tempAdjustment(input, 'up'), timeAdjustment(input, 'up')]),
      notes,
    }
  }
  if (balance > 0) {
    return {
      kind: 'overExtracted',
      ...pick([grindAdjustment(input, false), tempAdjustment(input, 'down'), timeAdjustment(input, 'down')]),
      notes,
    }
  }

  // 4) ความเข้ม: อัตราส่วน
  if (body < 0) return { kind: 'tooWeak', ...pick([ratioAdjustment(input, true)]), notes }
  if (body > 0) return { kind: 'tooStrong', ...pick([ratioAdjustment(input, false)]), notes }

  // 5) สมดุลแล้ว
  if (input.rating !== undefined && input.rating >= BEST_MIN_RATING) {
    return { kind: 'best', alternatives: [], notes }
  }
  return { kind: 'balanced', alternatives: [], notes }
}

/** แปลงบันทึกการชง (+ เมล็ด/เครื่องบด ถ้ามี) เป็น input ของ Advisor */
export function dialInInputFromBrew(
  brew: Pick<
    Brew,
    | 'method'
    | 'doseG'
    | 'waterG'
    | 'grindSetting'
    | 'tempC'
    | 'totalTimeSec'
    | 'rating'
    | 'balance'
    | 'body'
    | 'sourAndBitter'
    | 'brewedAt'
    | 'grinderId'
  >,
  context: { bean?: Pick<Bean, 'roastDate'>; grinder?: Pick<Gear, 'grindScale'> } = {},
): DialInInput {
  return {
    method: brew.method,
    doseG: brew.doseG,
    waterG: brew.waterG,
    grindSetting: brew.grindSetting,
    grindScale: context.grinder?.grindScale,
    // ไม่ได้ระบุทั้งเครื่องบดและเบอร์บด → ถือว่าใช้กาแฟบดสำเร็จ ปรับระดับบดไม่ได้
    canAdjustGrind: brew.grinderId !== undefined || brew.grindSetting !== undefined,
    tempC: brew.tempC,
    totalTimeSec: brew.totalTimeSec,
    rating: brew.rating,
    balance: brew.balance,
    body: brew.body,
    sourAndBitter: brew.sourAndBitter,
    daysOffRoast: context.bean ? daysOffRoast(context.bean.roastDate, brew.brewedAt) : undefined,
  }
}

export function adviseForBrew(...args: Parameters<typeof dialInInputFromBrew>): Advice {
  return advise(dialInInputFromBrew(...args))
}

/**
 * คำแนะนำที่ควรเก็บไว้กับบันทึกการชง (snapshot ณ ตอนบันทึก)
 * ข้อมูลยังไม่พอวินิจฉัย (`needTasting`) = ไม่เก็บ → `undefined`
 */
export function adviceToStore(...args: Parameters<typeof dialInInputFromBrew>): Advice | undefined {
  const advice = adviseForBrew(...args)
  return advice.kind === 'needTasting' ? undefined : advice
}
