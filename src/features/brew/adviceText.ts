import { formatRatio } from '../../domain/calc'
import { METHOD_PROFILES } from '../../domain/methods'
import type { Adjustment, Advice, AdviceKind, AdviceNote, Method } from '../../domain/types'
import { formatDuration, formatGrams } from '../format'

/**
 * แปลงรหัสคำแนะนำจาก Dial-in Advisor เป็นข้อความภาษาไทย (PLAN ข้อ 5.3)
 * รวมข้อความไว้ที่เดียวเพื่อย้ายเข้า i18n ในขั้น 9 ได้ง่าย
 */

export const ADVICE_DIAGNOSIS: Record<AdviceKind, string> = {
  espressoFast: 'Espresso ไหลเร็วเกินไป (น้อยกว่า 20 วินาที) — บดหยาบไป',
  espressoSlow: 'Espresso ไหลช้าเกินไป (มากกว่า 35 วินาที) — บดละเอียดไป',
  uneven: 'ทั้งเปรี้ยวและขมพร้อมกัน — สกัดไม่สม่ำเสมอ (Channeling)',
  underExtracted: 'เปรี้ยวแหลม บาง จบสั้น — สกัดน้อยไป (Under-extracted)',
  overExtracted: 'ขม ฝาด แห้งปาก — สกัดมากไป (Over-extracted)',
  tooWeak: 'รสสมดุล แต่จืด/ใส — เข้มน้อยไป',
  tooStrong: 'รสสมดุล แต่หนัก/เข้มเกิน — เข้มมากไป',
  best: 'อร่อยแล้ว! คะแนนสูงและไม่มีอาการที่ต้องแก้',
  // ใช้ทั้งกรณีเลือก “สมดุล” แล้ว และกรณีให้แค่ดาว (ไม่ได้บอกรส) จึงไม่ยืนยันว่ารสสมดุล
  balanced: 'ยังไม่พบอาการที่ต้องปรับ',
  needTasting: 'ยังไม่มีผลชิมพอจะวินิจฉัย',
}

/** ข้อความเสริมเมื่อไม่มีตัวแปรให้แนะนำปรับ (เช่น ไม่ได้ระบุเครื่องบด หรือเบอร์บดถึงขีดสุดแล้ว) */
export const NO_ADJUSTMENT_TEXT =
  'ตอนนี้ยังไม่มีข้อเสนอที่ทำได้ (เช่น ไม่ได้ระบุเครื่องบด/เบอร์บด หรือเบอร์บดถึงขีดสุดของสเกลแล้ว) — ลองปรับด้วยตัวเองทีละอย่าง'

/** ข้อความปิดท้ายของกรณีที่ไม่ต้องปรับอะไร */
export const KEEP_RECIPE_TEXT: Partial<Record<AdviceKind, string>> = {
  best: 'คงสูตรนี้ไว้ — ติดดาวเป็น “สูตรที่ดีที่สุด” ของเมล็ดนี้ได้เลย',
  balanced: 'คงสูตรไว้ — บอกรสชาติ (เปรี้ยว/ขม/บอดี้) เพิ่มเพื่อให้แนะนำตรงขึ้น หรือลองปรับทีละอย่างถ้าอยากให้คะแนนสูงขึ้น',
}

export const NOTE_TEXT: Record<AdviceNote, string> = {
  beanTooFresh: 'เมล็ดยังสดมาก อาจมีก๊าซเยอะ ควรพักก่อน',
  beanStale: 'กลิ่นอาจลดลง ลองน้ำร้อนขึ้นเล็กน้อย',
}

const arrow = (from: number | undefined, to: number | undefined, unit = '') =>
  from !== undefined && to !== undefined ? ` (${formatGrams(from)} → ${formatGrams(to)}${unit})` : ''

/** ข้อความการปรับ 1 อย่าง เช่น "บดละเอียดขึ้น 1 ขั้น (เบอร์ 20 → 19)" */
export function adjustmentText(adjustment: Adjustment, method: Method): string {
  switch (adjustment.variable) {
    case 'grind': {
      const verb = adjustment.direction === 'finer' ? 'บดละเอียดขึ้น' : 'บดหยาบขึ้น'
      const detail = adjustment.from !== undefined && adjustment.to !== undefined
        ? ` (เบอร์ ${formatGrams(adjustment.from)} → ${formatGrams(adjustment.to)})`
        : ''
      return `${verb} ${adjustment.steps} ขั้น${detail}`
    }
    case 'ratio': {
      const verb = adjustment.to < adjustment.from ? 'เพิ่มความเข้ม' : 'ลดความเข้ม'
      return `${verb}: ${formatRatio(adjustment.from)} → ${formatRatio(adjustment.to)} (กาแฟ ${formatGrams(adjustment.doseG)} g : น้ำ ${formatGrams(adjustment.waterG)} g)`
    }
    case 'temp': {
      const verb = adjustment.deltaC > 0 ? 'น้ำร้อนขึ้น' : 'น้ำเย็นลง'
      return `${verb} ${Math.abs(adjustment.deltaC)} °C${arrow(adjustment.from, adjustment.to, ' °C')}`
    }
    case 'time': {
      const verb = adjustment.deltaSec > 0 ? 'ชงนานขึ้น' : 'ชงสั้นลง'
      const detail = adjustment.from !== undefined && adjustment.to !== undefined
        ? ` (${formatDuration(adjustment.from)} → ${formatDuration(adjustment.to)})`
        : ''
      return `${verb} ${Math.abs(adjustment.deltaSec)} วินาที${detail}`
    }
    case 'technique':
      return METHOD_PROFILES[method].style === 'espresso'
        ? 'ปรับเทคนิค: กระจายผงและ Tamp ให้เรียบเสมอกัน'
        : 'ปรับเทคนิค: เทน้ำให้นิ่งสม่ำเสมอ และ Swirl เบา ๆ ให้ผงเรียบ'
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

export function describeAdvice(advice: Advice, method: Method): AdviceView {
  const action = advice.adjustment ? adjustmentText(advice.adjustment, method) : undefined
  const keep = KEEP_RECIPE_TEXT[advice.kind]
  return {
    diagnosis: ADVICE_DIAGNOSIS[advice.kind],
    action,
    fallback: action ? undefined : (keep ?? (advice.kind === 'needTasting' ? undefined : NO_ADJUSTMENT_TEXT)),
    alternatives: advice.alternatives.map((a) => adjustmentText(a, method)),
    notes: advice.notes.map((n) => NOTE_TEXT[n]),
    positive: advice.kind === 'best' || advice.kind === 'balanced',
  }
}
