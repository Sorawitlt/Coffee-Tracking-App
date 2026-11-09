import type { FlavorGroup, FlavorTag } from '../domain/flavors'
import type { BeanProcess, GearType, Method, RoastLevel, StepAction } from '../domain/types'
import type { MessageKey } from '../i18n'

/**
 * ตัวเลือกต่าง ๆ → "คีย์ข้อความ" i18n (แปลตอนแสดงด้วย `t(...)`)
 * รวมไว้ที่เดียว: เพิ่มตัวเลือกใหม่แล้ว TypeScript บังคับให้ใส่คีย์ครบ
 */

export const ROAST_LEVEL_KEY: Record<RoastLevel, MessageKey> = {
  light: 'label.roast.light',
  mediumLight: 'label.roast.mediumLight',
  medium: 'label.roast.medium',
  mediumDark: 'label.roast.mediumDark',
  dark: 'label.roast.dark',
}

export const PROCESS_KEY: Record<BeanProcess, MessageKey> = {
  washed: 'label.process.washed',
  natural: 'label.process.natural',
  honey: 'label.process.honey',
  anaerobic: 'label.process.anaerobic',
  other: 'label.process.other',
}

export const GEAR_TYPE_KEY: Record<GearType, MessageKey> = {
  grinder: 'label.gear.grinder',
  brewer: 'label.gear.brewer',
  kettle: 'label.gear.kettle',
  scale: 'label.gear.scale',
  filter: 'label.gear.filter',
  other: 'label.gear.other',
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
export const STEP_ACTION_KEY: Record<StepAction, MessageKey> = {
  bloom: 'label.step.bloom',
  pour: 'label.step.pour',
  stir: 'label.step.stir',
  swirl: 'label.step.swirl',
  steep: 'label.step.steep',
  press: 'label.step.press',
  extract: 'label.step.extract',
  drawdown: 'label.step.drawdown',
  heat: 'label.step.heat',
  removeFromHeat: 'label.step.removeFromHeat',
  filter: 'label.step.filter',
  custom: 'label.step.custom',
}

/** คำแนะนำสั้น ๆ ใต้ชื่อขั้นตอน */
export const STEP_ACTION_HINT_KEY: Record<StepAction, MessageKey> = {
  bloom: 'label.stepHint.bloom',
  pour: 'label.stepHint.pour',
  stir: 'label.stepHint.stir',
  swirl: 'label.stepHint.swirl',
  steep: 'label.stepHint.steep',
  press: 'label.stepHint.press',
  extract: 'label.stepHint.extract',
  drawdown: 'label.stepHint.drawdown',
  heat: 'label.stepHint.heat',
  removeFromHeat: 'label.stepHint.removeFromHeat',
  filter: 'label.stepHint.filter',
  custom: 'label.stepHint.custom',
}

// ---------- ผลชิม (ขั้น 6) ----------

/** สมดุลรสชาติ −2..+2 (เรียงจากซ้ายไปขวา) */
export const BALANCE_OPTIONS = [
  { value: -2, labelKey: 'label.balance.verySour' },
  { value: -1, labelKey: 'label.balance.sour' },
  { value: 0, labelKey: 'label.balance.balanced' },
  { value: 1, labelKey: 'label.balance.bitter' },
  { value: 2, labelKey: 'label.balance.veryBitter' },
] as const satisfies readonly { value: number; labelKey: MessageKey }[]

/** ความเข้ม/บอดี้ −2..+2 */
export const BODY_OPTIONS = [
  { value: -2, labelKey: 'label.body.veryThin' },
  { value: -1, labelKey: 'label.body.thin' },
  { value: 0, labelKey: 'label.body.ok' },
  { value: 1, labelKey: 'label.body.heavy' },
  { value: 2, labelKey: 'label.body.veryHeavy' },
] as const satisfies readonly { value: number; labelKey: MessageKey }[]

/** ความหวาน 0..4 */
export const SWEETNESS_OPTIONS = [
  { value: 0, labelKey: 'label.sweet.none' },
  { value: 1, labelKey: 'label.sweet.low' },
  { value: 2, labelKey: 'label.sweet.medium' },
  { value: 3, labelKey: 'label.sweet.sweet' },
  { value: 4, labelKey: 'label.sweet.verySweet' },
] as const satisfies readonly { value: number; labelKey: MessageKey }[]

export const FLAVOR_GROUP_KEY: Record<FlavorGroup, MessageKey> = {
  fruity: 'label.flavorGroup.fruity',
  floral: 'label.flavorGroup.floral',
  sweet: 'label.flavorGroup.sweet',
  nutty: 'label.flavorGroup.nutty',
  spice: 'label.flavorGroup.spice',
  roasted: 'label.flavorGroup.roasted',
  other: 'label.flavorGroup.other',
}

export const FLAVOR_TAG_KEY: Record<FlavorTag, MessageKey> = {
  berry: 'label.flavor.berry',
  citrus: 'label.flavor.citrus',
  stoneFruit: 'label.flavor.stoneFruit',
  tropical: 'label.flavor.tropical',
  driedFruit: 'label.flavor.driedFruit',
  floral: 'label.flavor.floral',
  tea: 'label.flavor.tea',
  honey: 'label.flavor.honey',
  caramel: 'label.flavor.caramel',
  brownSugar: 'label.flavor.brownSugar',
  vanilla: 'label.flavor.vanilla',
  nutty: 'label.flavor.nutty',
  chocolate: 'label.flavor.chocolate',
  spice: 'label.flavor.spice',
  toasty: 'label.flavor.toasty',
  smoky: 'label.flavor.smoky',
  burnt: 'label.flavor.burnt',
  woody: 'label.flavor.woody',
  earthy: 'label.flavor.earthy',
  fermented: 'label.flavor.fermented',
  vegetal: 'label.flavor.vegetal',
}
