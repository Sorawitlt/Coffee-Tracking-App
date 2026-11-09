import { formatRatio } from '../../domain/calc'
import { METHOD_PROFILES } from '../../domain/methods'
import type { Adjustment, Advice, AdviceKind, AdviceNote, Method } from '../../domain/types'
import { tTh, type MessageKey, type TFunction } from '../../i18n'
import { formatDuration, formatGrams } from '../format'

/**
 * แปลงรหัสคำแนะนำจาก Dial-in Advisor เป็นข้อความตามภาษาที่เลือก (PLAN ข้อ 5.3)
 * ข้อความอยู่ใน i18n (`advice.*`) — ที่นี่เก็บแค่ "รหัสคำแนะนำ → คีย์ข้อความ"
 */

export const ADVICE_DIAGNOSIS_KEY: Record<AdviceKind, MessageKey> = {
  espressoFast: 'advice.diagnosis.espressoFast',
  espressoSlow: 'advice.diagnosis.espressoSlow',
  uneven: 'advice.diagnosis.uneven',
  underExtracted: 'advice.diagnosis.underExtracted',
  overExtracted: 'advice.diagnosis.overExtracted',
  tooWeak: 'advice.diagnosis.tooWeak',
  tooStrong: 'advice.diagnosis.tooStrong',
  best: 'advice.diagnosis.best',
  // ใช้ทั้งกรณีเลือก “สมดุล” แล้ว และกรณีให้แค่ดาว (ไม่ได้บอกรส) จึงไม่ยืนยันว่ารสสมดุล
  balanced: 'advice.diagnosis.balanced',
  needTasting: 'advice.diagnosis.needTasting',
}

/** ข้อความเสริมเมื่อไม่มีตัวแปรให้แนะนำปรับ (เช่น ไม่ได้ระบุเครื่องบด หรือเบอร์บดถึงขีดสุดแล้ว) */
export const NO_ADJUSTMENT_KEY: MessageKey = 'advice.noAdjustment'

/** ข้อความปิดท้ายของกรณีที่ไม่ต้องปรับอะไร */
export const KEEP_RECIPE_KEY: Partial<Record<AdviceKind, MessageKey>> = {
  best: 'advice.keep.best',
  balanced: 'advice.keep.balanced',
}

export const NOTE_KEY: Record<AdviceNote, MessageKey> = {
  beanTooFresh: 'advice.note.beanTooFresh',
  beanStale: 'advice.note.beanStale',
}

const arrow = (from: number | undefined, to: number | undefined, unit = '') =>
  from !== undefined && to !== undefined ? ` (${formatGrams(from)} → ${formatGrams(to)}${unit})` : ''

/** ข้อความการปรับ 1 อย่าง เช่น "บดละเอียดขึ้น 1 ขั้น (เบอร์ 20 → 19)" */
export function adjustmentText(adjustment: Adjustment, method: Method, t: TFunction = tTh): string {
  switch (adjustment.variable) {
    case 'grind': {
      const detail =
        adjustment.from !== undefined && adjustment.to !== undefined
          ? t('advice.adj.grindDetail', { from: formatGrams(adjustment.from), to: formatGrams(adjustment.to) })
          : ''
      return t(adjustment.direction === 'finer' ? 'advice.adj.grindFiner' : 'advice.adj.grindCoarser', { n: adjustment.steps, detail })
    }
    case 'ratio':
      return t(adjustment.to < adjustment.from ? 'advice.adj.ratioStronger' : 'advice.adj.ratioWeaker', {
        from: formatRatio(adjustment.from),
        to: formatRatio(adjustment.to),
        dose: formatGrams(adjustment.doseG),
        water: formatGrams(adjustment.waterG),
      })
    case 'temp':
      return t(adjustment.deltaC > 0 ? 'advice.adj.tempHotter' : 'advice.adj.tempColder', {
        c: Math.abs(adjustment.deltaC),
        detail: arrow(adjustment.from, adjustment.to, ' °C'),
      })
    case 'time': {
      const detail =
        adjustment.from !== undefined && adjustment.to !== undefined
          ? ` (${formatDuration(adjustment.from)} → ${formatDuration(adjustment.to)})`
          : ''
      return t(adjustment.deltaSec > 0 ? 'advice.adj.timeLonger' : 'advice.adj.timeShorter', { n: Math.abs(adjustment.deltaSec), detail })
    }
    case 'technique':
      return t(METHOD_PROFILES[method].style === 'espresso' ? 'advice.adj.techniqueEspresso' : 'advice.adj.techniqueFilter')
  }
}

export interface AdviceView {
  /** อาการ/การวินิจฉัย */
  diagnosis: string
  /** “ครั้งหน้าลอง” — การปรับหลัก 1 อย่าง (ไม่มี = ดู `fallback`) */
  action?: string
  /** ข้อความแทน `action` เมื่อไม่ต้องปรับ หรือไม่มีตัวแปรให้ปรับ */
  fallback?: string
  /** ทางเลือกสำรองเรียงตามลำดับความสำคัญ */
  alternatives: string[]
  notes: string[]
  /** true = ผลดี (best/balanced) → UI ใช้โทนบวก */
  positive: boolean
}

export function describeAdvice(advice: Advice, method: Method, t: TFunction = tTh): AdviceView {
  const action = advice.adjustment ? adjustmentText(advice.adjustment, method, t) : undefined
  const keepKey = KEEP_RECIPE_KEY[advice.kind]
  return {
    diagnosis: t(ADVICE_DIAGNOSIS_KEY[advice.kind]),
    action,
    fallback: action ? undefined : keepKey ? t(keepKey) : advice.kind === 'needTasting' ? undefined : t(NO_ADJUSTMENT_KEY),
    alternatives: advice.alternatives.map((a) => adjustmentText(a, method, t)),
    notes: advice.notes.map((n) => t(NOTE_KEY[n])),
    positive: advice.kind === 'best' || advice.kind === 'balanced',
  }
}
