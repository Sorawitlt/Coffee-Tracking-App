import type { BeanProcess, GearType, Method, RoastLevel, StepAction } from '../domain/types'

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

/** ชื่อขั้นตอนในผู้ช่วยชง (สูตรผู้ใช้ที่มี `label` ข้อความอิสระจะใช้ label แทน) */
export const STEP_ACTION_LABEL: Record<StepAction, string> = {
  bloom: 'บลูม',
  pour: 'เทน้ำ',
  stir: 'คน',
  swirl: 'หมุนเบา ๆ (Swirl)',
  steep: 'แช่ / รอ',
  press: 'กดลง',
  extract: 'สกัดช็อต',
  drawdown: 'รอน้ำหยดหมด',
  heat: 'ตั้งเตา',
  removeFromHeat: 'ยกลงจากเตา',
  filter: 'กรองแยกกาก',
  custom: 'ขั้นตอน',
}

/** คำแนะนำสั้น ๆ ใต้ชื่อขั้นตอน */
export const STEP_ACTION_HINT: Record<StepAction, string> = {
  bloom: 'เทน้ำเบา ๆ ให้ผงชุ่มทั่ว แล้วรอให้ก๊าซออก',
  pour: 'เทเป็นวงกลมช้า ๆ จากกลางออกนอก',
  stir: 'คนเบา ๆ ให้ผงกับน้ำเข้ากันทั่ว',
  swirl: 'หมุนอุปกรณ์เบา ๆ ให้ผงเรียบเสมอกัน',
  steep: 'วางทิ้งไว้ ไม่ต้องทำอะไร',
  press: 'กดลงช้า ๆ ให้สม่ำเสมอ',
  extract: 'เปิดปั๊มพร้อมจับเวลา หยุดเมื่อน้ำหนักช็อตถึงเป้า',
  drawdown: 'รอน้ำไหลผ่านจนหมด แล้วกด “เสร็จสิ้น”',
  heat: 'ตั้งบนไฟกลาง-อ่อน',
  removeFromHeat: 'ยกลงเมื่อกาแฟเริ่มมีเสียงฟู่ แช่ฐานในน้ำเย็นเพื่อหยุดสกัด',
  filter: 'กรองแยกกากออกจากน้ำกาแฟ',
  custom: '',
}
