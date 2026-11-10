import type { GearType, GrindScale, LocalDate, Method } from '../types'

/**
 * ฐานข้อมูลอ้างอิง (Reference catalog) — ข้อมูลรุ่นอุปกรณ์ / สายพันธุ์ / แหล่งปลูก ที่ติดมากับแอป
 *
 * กติกาความถูกต้อง (บังคับด้วย `catalog.test.ts`)
 * - ทุกรายการมี **แหล่งอ้างอิงอย่างน้อย 1 แห่ง** (URL https) และวันที่ตรวจสอบ (`verifiedAt`)
 * - ใส่เฉพาะค่าที่ยืนยันได้จากแหล่งอ้างอิง — ค่าที่หาแหล่งยืนยันไม่ได้ = ไม่ใส่ (ปล่อยว่างดีกว่าเดา)
 * - แหล่งแรกของรายการคือแหล่งหลัก; ระบุชนิดแหล่ง (`kind`) ให้ผู้ใช้เห็นน้ำหนักของข้อมูล
 * - ค่าที่มาจากชุมชนผู้ใช้ (ไม่ใช่ผู้ผลิต) ต้องมีหมายเหตุ `scaleFromCommunity` กำกับ
 * - ไม่มีข้อความภาษาใด ๆ ยกเว้นชื่อเฉพาะ (ยี่ห้อ/รุ่น/สายพันธุ์) — หมายเหตุเป็น "รหัส" แปลที่ UI
 * - `id` คงที่ตลอดไป (Gear.catalogId อ้างถึง) — เปลี่ยนชื่อรุ่นได้ แต่ห้ามเปลี่ยน/นำ id กลับมาใช้ใหม่
 */

/** ชนิดของแหล่งอ้างอิง เรียงจากน่าเชื่อถือมากไปน้อยสำหรับ "สเปกสินค้า" */
export type SourceKind =
  /** เว็บไซต์/คู่มือ/หน้าช่วยเหลือของผู้ผลิตหรือผู้จัดจำหน่ายทางการ */
  | 'manufacturer'
  /** หน่วยงานรัฐ องค์กรวิจัย หรือองค์กรมาตรฐาน (เช่น World Coffee Research, กรมวิชาการเกษตร) */
  | 'institution'
  /** ร้านค้าปลีก */
  | 'retailer'
  /** ชุมชนผู้ใช้ / คู่มือจากผู้ใช้ (ใช้เมื่อผู้ผลิตไม่ได้ระบุไว้ และต้องมีหมายเหตุกำกับ) */
  | 'community'

export interface CatalogSource {
  url: string
  kind: SourceKind
  /** ชื่อเว็บไซต์/เอกสาร เป็นภาษาอังกฤษ (ใช้ทุกภาษา) */
  title: string
  /** ชื่อเอกสารตามภาษาต้นฉบับ (เช่น เอกสารราชการไทย) — แสดงเมื่อ UI เป็นภาษาเดียวกับต้นฉบับ */
  titleLocal?: string
}

export interface NumRange {
  min: number
  max: number
}

/** ความจุตามที่ผู้ผลิตระบุ (เก็บหน่วยเดิม ไม่แปลงล่วงหน้า → ไม่เกิดความคลาดเคลื่อนจากการปัดเศษ) */
export interface Capacity {
  value: number
  unit: 'ml' | 'l' | 'oz'
}

/** สเปกที่แอปแสดงได้ — ใส่เฉพาะช่องที่มีแหล่งอ้างอิงยืนยัน */
export interface GearSpecs {
  // --- เครื่องบด ---
  drive?: 'manual' | 'electric'
  burrShape?: 'flat' | 'conical'
  burrMm?: number
  adjustment?: 'stepped' | 'stepless'
  clicksPerRotation?: number
  micronsPerClick?: number
  /** จำนวนเบอร์บดทั้งหมดตามที่ผู้ผลิตระบุ */
  settingsCount?: number
  // --- อุปกรณ์ชง / เครื่อง Espresso ---
  /** วิธีชงในแอปที่อุปกรณ์นี้ใช้ได้ */
  methods?: Method[]
  /** ขนาดตะกร้า/ด้ามชง (มม.) */
  basketMm?: number
  doseG?: NumRange
  /** ความจุน้ำ/ภาชนะ */
  capacity?: Capacity
  /** ปริมาณเครื่องดื่มที่ได้ (สูงสุด) ตามที่ผู้ผลิตระบุ */
  output?: Capacity
  /** จำนวนถ้วยตามที่ผู้ผลิตระบุ (ขนาดถ้วยของแต่ละผู้ผลิตต่างกัน) */
  cups?: NumRange
  /** แรงดันสูงสุดของปั๊ม */
  pumpBar?: number
  /** แรงดันชงที่ตั้งจากโรงงานด้วยวาล์ว OPV */
  opvBar?: number
  // --- กาต้มน้ำ ---
  tempRangeC?: NumRange
  // --- ตาชั่ง ---
  maxG?: number
  resolutionG?: number
  timer?: boolean
  // --- ฟิลเตอร์ ---
  /** ใช้กับอุปกรณ์รุ่นไหนในฐานข้อมูล (id) */
  fits?: string[]
}

/** ช่วงเบอร์บดที่ผู้ผลิตแนะนำต่อวิธีชง (ใช้แสดงคำใบ้ในฟอร์มบันทึกการชง) */
export interface GrindGuide {
  methods: Method[]
  min: number
  max: number
}

/** ความสามารถเด่นของรุ่น — เป็นรหัส แปลที่ UI (`catalog.feature.*`) */
export type GearFeature =
  | 'pressureGauge'
  | 'electricPreheat'
  | 'pid'
  | 'dualBoiler'
  | 'builtInGrinder'
  | 'timer'
  | 'holdTemp'

/** หมายเหตุสำคัญของรุ่น — เป็นรหัส แปลที่ UI (`catalog.note.*`) */
export type CatalogNote =
  /** เลขบนหน้าปัดเป็นแค่จุดอ้างอิง ต้องหาจุดศูนย์จริง (เฟืองแตะกัน) ก่อนเทียบกับคนอื่น */
  | 'findTrueZero'
  /** ช่วงสเกลเบอร์บดมาจากชุมชนผู้ใช้ ผู้ผลิตไม่ได้ระบุ */
  | 'scaleFromCommunity'
  /** ปรับแบบไม่มีขั้น — แอปตั้ง "ขั้นละ" ไว้เพื่อการบันทึก แก้ได้ */
  | 'steplessLogStep'
  /** สเกลเบอร์บดยังไม่ระบุ เพราะผู้ผลิตบอกเป็นคลิกต่อรอบ ให้ตั้งเองตามวิธีนับ */
  | 'countClicks'
  /** ผู้ผลิตระบุว่าไม่ได้ออกแบบมาสำหรับ Espresso */
  | 'notForEspresso'
  /** ช่วงสูงสุดของสเกลในแอปตั้งให้ครอบคลุมตารางของผู้ผลิต (ผู้ผลิตไม่ได้กำหนดค่าสูงสุด) */
  | 'scaleMaxCoversGuide'
  /** ใช้กับเตาแม่เหล็กไฟฟ้าต้องมีแผ่นรอง */
  | 'inductionAdapter'
  /** ความละเอียดของตาชั่งเปลี่ยนตามน้ำหนัก */
  | 'resolutionVaries'
  /** มีโหมดความละเอียดสูง 0.01 g */
  | 'highResMode'
  /** ถ้วยแบบยุโรป ≈ 4 oz */
  | 'europeanCup'
  /** เครื่องแบบคันโยก ควบคุมแรงดันเอง */
  | 'manualLever'
  /** ขนาดตะกร้าอนุมานจากแทมเปอร์ 58 มม. ที่ให้มา */
  | 'tamper58'

export interface GearModel {
  /** รหัสคงที่ เช่น `df-grinders-df64-gen-2` */
  id: string
  type: GearType
  brand: string
  model: string
  /** ชื่ออื่นที่ใช้ค้นหา (ชื่อขายในตลาดอื่น, ชื่อเล่น, รหัสรุ่น) */
  aliases?: string[]
  specs: GearSpecs
  /** สเกลเบอร์บดสำหรับเติมฟอร์มอุปกรณ์อัตโนมัติ (เฉพาะเครื่องบดที่มีหน้าปัดตัวเลขชัดเจน) */
  grindScale?: GrindScale
  /** ช่วงเบอร์บดที่ **ผู้ผลิต** แนะนำ (ไม่ใส่ค่าจากชุมชน) */
  grindGuide?: GrindGuide[]
  features?: GearFeature[]
  notes?: CatalogNote[]
  sources: CatalogSource[]
  verifiedAt: LocalDate
}

// ---------- เมล็ด: สายพันธุ์ / แหล่งปลูก ----------

export type CoffeeSpecies = 'arabica' | 'robusta'

export interface VarietyRef {
  id: string
  /** ชื่อสากลตามแหล่งอ้างอิง */
  name: string
  /** ชื่ออื่นที่พบบ่อย (ใช้ค้นหา) เช่น Gesha */
  aliases?: string[]
  /** ชื่อภาษาไทยทางการ (ถ้ามี เช่น พันธุ์ของกรมวิชาการเกษตร) — ใช้ค้นหาได้ทั้งสองแบบ */
  localName?: string
  species: CoffeeSpecies
  sources: CatalogSource[]
  verifiedAt: LocalDate
}

export interface OriginRef {
  id: string
  /** ISO 3166-1 alpha-2 */
  country: string
  /** ชื่อประเทศ (อังกฤษ ตาม ISO 3166) */
  countryName: string
  /** ภูมิภาค/จังหวัด/แหล่งปลูก (ถ้ามี) */
  region?: string
  /** ชื่อไทยของภูมิภาค (ใช้ค้นหา) */
  localRegion?: string
  sources: CatalogSource[]
  verifiedAt: LocalDate
}
