import type { BrewInput } from '../../db/brews'
import type { Brew, Rating, Scale5 } from '../../domain/types'
import { optionalText } from '../formUtil'

/**
 * ผลชิมในฟอร์มบันทึกการชง (Pure TS) — ทุกช่อง "ไม่บังคับ"
 * ช่องที่ยังไม่แตะ = `undefined` (ไม่ใช่ 0) เพื่อให้ Dial-in Advisor แยกออกว่า "ไม่ได้ชิม" กับ "ชิมแล้วสมดุล"
 */
export interface TastingValues {
  rating?: Rating
  /** −2 เปรี้ยวแหลม … +2 ขมฝาด */
  balance?: Scale5
  /** −2 บาง/จืด … +2 หนัก/เข้มเกิน */
  body?: Scale5
  sweetness?: 0 | 1 | 2 | 3 | 4
  sourAndBitter: boolean
  flavorTags: string[]
  notes: string
  isBest: boolean
}

export const emptyTasting = (): TastingValues => ({ sourAndBitter: false, flavorTags: [], notes: '', isBest: false })

/** ผลชิมของบันทึกเดิม (ใช้ตอนแก้ไข) — "ชงซ้ำ" ไม่เรียกใช้ เพราะผลชิมเป็นของการชงครั้งนั้น ๆ */
export function tastingFromBrew(brew: Brew): TastingValues {
  return {
    rating: brew.rating,
    balance: brew.balance,
    body: brew.body,
    sweetness: brew.sweetness,
    sourAndBitter: brew.sourAndBitter ?? false,
    flavorTags: [...brew.flavorTags],
    notes: brew.notes ?? '',
    isBest: brew.isBest,
  }
}

/** กรอกผลชิมไว้อย่างน้อย 1 อย่างหรือไม่ (ไม่นับติดดาวสูตรที่ดีที่สุด) */
export function hasTasting(t: TastingValues): boolean {
  return (
    t.rating !== undefined ||
    t.balance !== undefined ||
    t.body !== undefined ||
    t.sweetness !== undefined ||
    t.sourAndBitter ||
    t.flavorTags.length > 0 ||
    t.notes.trim() !== ''
  )
}

export type TastingFields = Pick<
  BrewInput,
  'rating' | 'balance' | 'body' | 'sweetness' | 'sourAndBitter' | 'flavorTags' | 'notes' | 'isBest'
>

/** แปลงเป็นฟิลด์ของ `BrewInput` — ช่องว่างเป็น `undefined` (ตอนแก้ไข = ล้างค่าเดิม; ตอนเพิ่ม = ไม่เก็บคีย์) */
export function tastingToFields(t: TastingValues): TastingFields {
  return {
    rating: t.rating,
    balance: t.balance,
    body: t.body,
    sweetness: t.sweetness,
    sourAndBitter: t.sourAndBitter ? true : undefined,
    flavorTags: t.flavorTags,
    notes: optionalText(t.notes),
    isBest: t.isBest,
  }
}
