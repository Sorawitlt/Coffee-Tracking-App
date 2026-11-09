import type { BeanProcess, GearType, Method, RoastLevel } from '../domain/types'

/**
 * ป้ายข้อความภาษาไทยของตัวเลือกต่าง ๆ
 * (รวมไว้ที่เดียวเพื่อย้ายเข้า i18n ในขั้น 9 ได้ง่าย)
 */

export const ROAST_LEVEL_LABEL: Record<RoastLevel, string> = {
  light: 'คั่วอ่อน',
  mediumLight: 'คั่วอ่อน-กลาง',
  medium: 'คั่วกลาง',
  mediumDark: 'คั่วกลาง-เข้ม',
  dark: 'คั่วเข้ม',
}

export const PROCESS_LABEL: Record<BeanProcess, string> = {
  washed: 'Washed',
  natural: 'Natural',
  honey: 'Honey',
  anaerobic: 'Anaerobic',
  other: 'อื่น ๆ',
}

export const GEAR_TYPE_LABEL: Record<GearType, string> = {
  grinder: 'เครื่องบด',
  brewer: 'อุปกรณ์ชง',
  kettle: 'กาต้มน้ำ',
  scale: 'ตาชั่ง',
  filter: 'ฟิลเตอร์',
  other: 'อื่น ๆ',
}

export const GEAR_TYPE_ICON: Record<GearType, string> = {
  grinder: '⚙️',
  brewer: '☕',
  kettle: '🫖',
  scale: '⚖️',
  filter: '📄',
  other: '🔧',
}

/** สกุลเงินที่เลือกได้ในฟอร์มเมล็ด (THB เป็นค่าเริ่มต้น) */
export const CURRENCIES = ['THB', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD'] as const

export const METHOD_LABEL: Record<Method, string> = {
  espresso: 'Espresso',
  v60: 'V60',
  kalita: 'Kalita Wave',
  chemex: 'Chemex',
  aeropress: 'AeroPress',
  frenchPress: 'French Press',
  moka: 'Moka Pot',
  coldBrew: 'Cold Brew',
}
