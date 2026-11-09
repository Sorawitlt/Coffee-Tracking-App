import type { Language } from '../domain/types'
import en from './en.json'
import th from './th.json'

/**
 * i18n แบบเบา ไม่พึ่งไลบรารี: พจนานุกรมแบบ "คีย์แบนราบ" (th.json / en.json) + แทนค่า `{ชื่อ}`
 *
 * - `th.json` เป็นต้นแบบของชนิดคีย์ (`MessageKey`) → พิมพ์คีย์ผิดแล้ว `tsc` ฟ้องทันที
 * - พหูพจน์ (อังกฤษ): ถ้าส่ง `{ n: 1 }` และมีคีย์ `<key>_one` จะใช้คีย์นั้น (ภาษาไทยไม่มีพหูพจน์ จึงไม่ต้องมี)
 * - คีย์ที่ภาษาปัจจุบันยังไม่มี → ถอยไปใช้ภาษาไทย แล้วค่อยถอยไปแสดงชื่อคีย์ (ไม่ทำให้หน้าจอพัง)
 * - ข้อมูลในฐานข้อมูล/CSV/JSON ไม่ขึ้นกับภาษา (เก็บเป็นรหัส) — ภาษาเกี่ยวกับการแสดงผลเท่านั้น
 */

export type MessageKey = keyof typeof th
export type MessageParams = Record<string, string | number>
export type TFunction = (key: MessageKey, params?: MessageParams) => string

export const LANGUAGES: readonly Language[] = ['th', 'en']
export const DEFAULT_LANGUAGE: Language = 'th'

/** ชื่อภาษาแต่ละภาษาในภาษาของตัวเอง (ใช้บนปุ่มสลับภาษา) */
export const LANGUAGE_NAME: Record<Language, string> = { th: 'ไทย', en: 'English' }

/** locale สำหรับ Intl (วันที่/เงิน) — อังกฤษใช้ en-GB เพื่อให้เป็น "9 Nov" และเวลา 24 ชม. เหมือนฝั่งไทย */
export const LOCALE: Record<Language, string> = { th: 'th-TH', en: 'en-GB' }

const DICTS: Record<Language, Record<string, string>> = { th, en }

export function isLanguage(value: unknown): value is Language {
  return value === 'th' || value === 'en'
}

export function createT(lang: Language): TFunction {
  const dict = DICTS[lang]
  return (key, params) => {
    let text: string | undefined
    if (params?.n === 1) text = dict[`${key}_one`]
    text ??= dict[key] ?? (th as Record<string, string>)[key] ?? key
    if (!params) return text
    return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole))
  }
}

/** ตัวแปลภาษาไทย — ค่าเริ่มต้นของฟังก์ชันล้วน (pure) ที่รับ `t` เป็นพารามิเตอร์ */
export const tTh: TFunction = createT('th')
