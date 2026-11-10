import { ORIGINS, VARIETIES } from './beans'
import { GEAR_MODELS } from './gear'
import { gearModelName, originValue } from './search'
import type { CatalogSource, GearModel, GearSpecs, SourceKind } from './types'
import type { GearType } from '../types'

/**
 * สร้างเอกสาร `docs/CATALOG.md` จากข้อมูลจริง (เอกสารจึงตรงกับแอปเสมอ — test ตรวจให้)
 *
 * ข้อยกเว้นกติกา "domain ไม่มีข้อความภาษา": ไฟล์นี้เป็นตัวสร้างเอกสารสำหรับนักพัฒนา/ผู้ตรวจสอบ
 * ไม่ถูกเรียกจาก UI ของแอป
 */

const KIND_LABEL: Record<SourceKind, string> = {
  manufacturer: 'ผู้ผลิต / Manufacturer',
  institution: 'หน่วยงาน / Institution',
  retailer: 'ร้านค้า / Retailer',
  community: 'ชุมชนผู้ใช้ / Community',
}

const TYPE_HEADING: Record<GearType, string> = {
  grinder: 'เครื่องบด · Grinders',
  brewer: 'อุปกรณ์ชง & เครื่อง Espresso · Brewers & espresso',
  kettle: 'กาต้มน้ำ · Kettles',
  scale: 'ตาชั่ง · Scales',
  filter: 'ฟิลเตอร์ · Filters',
  other: 'อื่น ๆ · Other',
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const range = (r: { min: number; max: number }, unit = '') =>
  r.min === r.max ? `${r.min}${unit}` : `${r.min}–${r.max}${unit}`

function specText(sp: GearSpecs): string {
  const parts: string[] = []
  if (sp.drive) parts.push(sp.drive)
  if (sp.burrShape || sp.burrMm) parts.push([sp.burrShape, sp.burrMm ? `${sp.burrMm} mm` : ''].filter(Boolean).join(' ') + ' burr')
  if (sp.adjustment) parts.push(sp.adjustment)
  if (sp.settingsCount) parts.push(`${sp.settingsCount} settings`)
  if (sp.clicksPerRotation) parts.push(`${sp.clicksPerRotation} clicks/rotation`)
  if (sp.micronsPerClick) parts.push(`${sp.micronsPerClick} µm/click`)
  if (sp.methods) parts.push(`methods: ${sp.methods.join(', ')}`)
  if (sp.basketMm) parts.push(`basket ${sp.basketMm} mm`)
  if (sp.doseG) parts.push(`dose ${range(sp.doseG, ' g')}`)
  if (sp.capacity) parts.push(`capacity ${sp.capacity.value} ${sp.capacity.unit}`)
  if (sp.output) parts.push(`output ${sp.output.value} ${sp.output.unit}`)
  if (sp.cups) parts.push(`${range(sp.cups)} cups`)
  if (sp.pumpBar) parts.push(`pump ${sp.pumpBar} bar`)
  if (sp.opvBar) parts.push(`OPV ${sp.opvBar} bar`)
  if (sp.tempRangeC) parts.push(`${range(sp.tempRangeC, ' °C')}`)
  if (sp.maxG) parts.push(`max ${sp.maxG} g`)
  if (sp.resolutionG) parts.push(`${sp.resolutionG} g resolution`)
  if (sp.fits) parts.push(`fits: ${sp.fits.join(', ')}`)
  return parts.join(' · ')
}

function sourcesText(sources: readonly CatalogSource[]): string {
  return sources.map((src, i) => `[${i + 1}](${src.url}) ${src.kind}`).join('<br>')
}

function gearRow(m: GearModel): string {
  const extra = [
    m.features?.length ? `features: ${m.features.join(', ')}` : '',
    m.notes?.length ? `notes: ${m.notes.join(', ')}` : '',
  ].filter(Boolean)
  const scale = m.grindScale ? `${m.grindScale.min}–${m.grindScale.max} (step ${m.grindScale.step})` : '—'
  const guide = m.grindGuide?.map((g) => `${g.methods.join('/')}: ${g.min}–${g.max}`).join('<br>') ?? '—'
  return `| **${cell(gearModelName(m))}**<br><sub>\`${m.id}\`</sub> | ${cell([specText(m.specs), ...extra].filter(Boolean).join(' · '))} | ${scale} | ${guide} | ${sourcesText(m.sources)} |`
}

export function renderCatalogMarkdown(): string {
  const lines: string[] = []
  const dates = [...GEAR_MODELS, ...VARIETIES, ...ORIGINS].map((x) => x.verifiedAt).sort()
  const latest = dates[dates.length - 1]
  const kinds = new Map<SourceKind, number>()
  for (const x of [...GEAR_MODELS, ...VARIETIES, ...ORIGINS]) for (const src of x.sources) kinds.set(src.kind, (kinds.get(src.kind) ?? 0) + 1)

  lines.push(
    '# ฐานข้อมูลอ้างอิง · Reference Catalog',
    '',
    '> ⚙️ ไฟล์นี้**สร้างอัตโนมัติ**จาก `src/domain/catalog/` — ห้ามแก้มือ · Generated file, do not edit by hand.',
    '> อัปเดต: `UPDATE_CATALOG_DOC=1 npx vitest run src/domain/catalog` (ถ้าไม่อัปเดต `npm test` จะไม่ผ่าน)',
    '',
    `ตรวจสอบล่าสุด · Last verified: **${latest}** · อุปกรณ์ ${GEAR_MODELS.length} รุ่น · สายพันธุ์ ${VARIETIES.length} · แหล่งปลูก ${ORIGINS.length}`,
    '',
    '## หลักการความถูกต้อง · Accuracy rules',
    '',
    '1. ทุกรายการมีแหล่งอ้างอิงอย่างน้อย 1 แห่ง (https) และวันที่ตรวจสอบ — แหล่งแรกคือแหล่งหลัก',
    '2. ใส่เฉพาะค่าที่แหล่งอ้างอิงยืนยัน — **หาแหล่งยืนยันไม่ได้ = ไม่ใส่** (ปล่อยว่างดีกว่าเดา)',
    '3. "ช่วงที่ผู้ผลิตแนะนำ" (grind guide) มาจากผู้ผลิตเท่านั้น',
    '4. สเกลเบอร์บดที่มาจากชุมชนผู้ใช้ต้องมีหมายเหตุ `scaleFromCommunity` และแอปแสดงคำเตือนให้หาจุดศูนย์จริงก่อน',
    '5. สเปกอาจต่างตามรุ่นย่อย/ประเทศที่ขาย — ตรวจกับฉลากหรือคู่มือของเครื่องจริงเสมอ',
    '6. **ไม่มีรายชื่อโรงคั่ว** เพราะโรงคั่วและล็อตเมล็ดเปลี่ยนตลอดเวลา (ยืนยันระยะยาวไม่ได้) — ฟอร์มเมล็ดเสนอชื่อโรงคั่วที่ผู้ใช้เคยกรอกแทน',
    '',
    '| ชนิดแหล่งอ้างอิง · Source kind | จำนวนการอ้างอิง · Citations |',
    '|---|---|',
    ...(['manufacturer', 'institution', 'retailer', 'community'] as const).map((k) => `| ${KIND_LABEL[k]} | ${kinds.get(k) ?? 0} |`),
    '',
    '## อุปกรณ์ · Gear',
    '',
  )

  for (const type of ['grinder', 'brewer', 'kettle', 'scale', 'filter', 'other'] as const) {
    const models = GEAR_MODELS.filter((m) => m.type === type)
    if (models.length === 0) continue
    lines.push(
      `### ${TYPE_HEADING[type]} (${models.length})`,
      '',
      '| รุ่น · Model | สเปก · Specs | สเกลในแอป · App scale | ผู้ผลิตแนะนำ · Maker guide | อ้างอิง · Sources |',
      '|---|---|---|---|---|',
      ...models.map(gearRow),
      '',
    )
  }

  lines.push(
    '## สายพันธุ์ · Varieties',
    '',
    '| สายพันธุ์ · Variety | ชนิด · Species | อ้างอิง · Sources |',
    '|---|---|---|',
    ...VARIETIES.map(
      (v) =>
        `| **${cell(v.name)}**${v.localName ? ` (${cell(v.localName)})` : ''}${v.aliases?.length ? `<br><sub>aka ${cell(v.aliases.join(', '))}</sub>` : ''} | ${v.species} | ${sourcesText(v.sources)} |`,
    ),
    '',
    '## แหล่งปลูก · Origins',
    '',
    '| แหล่งปลูก · Origin | ISO | อ้างอิง · Sources |',
    '|---|---|---|',
    ...ORIGINS.map(
      (o) => `| ${cell(originValue(o))}${o.localRegion ? ` (${cell(o.localRegion)})` : ''} | ${o.country} | ${sourcesText(o.sources)} |`,
    ),
    '',
  )
  return lines.join('\n')
}
