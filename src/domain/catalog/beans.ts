import type { CatalogSource, OriginRef, SourceKind, VarietyRef } from './types'

/**
 * ฐานข้อมูลอ้างอิงของเมล็ด: สายพันธุ์ และแหล่งปลูก (ใช้เป็นคำแนะนำตอนกรอกฟอร์มเมล็ด)
 *
 * - สายพันธุ์อาราบิกาสากลอ้างอิง **World Coffee Research — Arabica Coffee Varieties catalog**
 *   (ใส่เฉพาะที่มีหน้าในแค็ตตาล็อกจริง)
 * - สายพันธุ์ไทยอ้างอิง **กรมวิชาการเกษตร (DOA)** ซึ่งเป็นผู้รับรองพันธุ์
 * - แหล่งปลูก: ประเทศผู้ผลิตอ้างอิงรายงาน USDA FAS / World Coffee Research; แหล่งปลูกในไทยอ้างอิง
 *   ทะเบียนสิ่งบ่งชี้ทางภูมิศาสตร์ (GI) ของกรมทรัพย์สินทางปัญญา และเอกสารของกรมวิชาการเกษตร
 * - **ไม่มีรายชื่อโรงคั่ว** — โรงคั่วและล็อตเมล็ดเปลี่ยนตลอดเวลา จึงยืนยันให้ถูกต้องระยะยาวไม่ได้
 *   ฟอร์มเมล็ดใช้รายชื่อโรงคั่วที่ผู้ใช้เคยกรอกเองแทน
 */

const VERIFIED = '2026-11-09'

const s = (kind: SourceKind, title: string, url: string, titleLocal?: string): CatalogSource =>
  titleLocal ? { kind, title, url, titleLocal } : { kind, title, url }

const wcr = (slug: string, name: string) =>
  s('institution', `World Coffee Research — ${name}`, `https://varieties.worldcoffeeresearch.org/varieties/${slug}`)

export const VARIETIES: readonly VarietyRef[] = [
  // --- Arabica (World Coffee Research) ---
  { id: 'typica', name: 'Typica', species: 'arabica', sources: [wcr('typica', 'Typica')], verifiedAt: VERIFIED },
  { id: 'bourbon', name: 'Bourbon', species: 'arabica', sources: [wcr('bourbon', 'Bourbon')], verifiedAt: VERIFIED },
  { id: 'caturra', name: 'Caturra', species: 'arabica', sources: [wcr('caturra', 'Caturra')], verifiedAt: VERIFIED },
  { id: 'catuai', name: 'Catuai', species: 'arabica', sources: [wcr('catuai', 'Catuai')], verifiedAt: VERIFIED },
  { id: 'mundo-novo', name: 'Mundo Novo', species: 'arabica', sources: [wcr('mundo-novo', 'Mundo Novo')], verifiedAt: VERIFIED },
  { id: 'pacas', name: 'Pacas', species: 'arabica', sources: [wcr('pacas', 'Pacas')], verifiedAt: VERIFIED },
  { id: 'pacamara', name: 'Pacamara', species: 'arabica', sources: [wcr('pacamara', 'Pacamara')], verifiedAt: VERIFIED },
  { id: 'villa-sarchi', name: 'Villa Sarchi', species: 'arabica', sources: [wcr('villa-sarchi', 'Villa Sarchi')], verifiedAt: VERIFIED },
  {
    id: 'geisha-panama',
    name: 'Geisha (Panama)',
    aliases: ['Gesha', 'Geisha'],
    species: 'arabica',
    sources: [wcr('geisha-panama', 'Geisha (Panama)')],
    verifiedAt: VERIFIED,
  },
  { id: 'sl28', name: 'SL28', species: 'arabica', sources: [wcr('sl28', 'SL28')], verifiedAt: VERIFIED },
  { id: 'sl34', name: 'SL34', species: 'arabica', sources: [wcr('sl34', 'SL34')], verifiedAt: VERIFIED },
  {
    id: 't8667',
    name: 'T8667 (Catimor)',
    aliases: ['Catimor'],
    species: 'arabica',
    sources: [wcr('t8667', 'T8667')],
    verifiedAt: VERIFIED,
  },

  // --- พันธุ์ไทย (กรมวิชาการเกษตร) ---
  {
    id: 'th-chiang-mai-80',
    name: 'Chiang Mai 80',
    localName: 'เชียงใหม่ 80',
    species: 'arabica',
    sources: [
      s(
        'institution',
        'Department of Agriculture (Thailand) — Growing and caring for arabica coffee, Chiang Mai 80',
        'https://www.doa.go.th/hort/wp-content/uploads/2021/10/%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9B%E0%B8%A5%E0%B8%B9%E0%B8%81%E0%B9%81%E0%B8%A5%E0%B8%B0%E0%B8%94%E0%B8%B9%E0%B9%81%E0%B8%A5%E0%B8%A3%E0%B8%B1%E0%B8%81%E0%B8%A9%E0%B8%B2%E0%B8%81%E0%B8%B2%E0%B9%81%E0%B8%9F%E0%B8%AD%E0%B8%B0%E0%B8%A3%E0%B8%B2%E0%B8%9A%E0%B8%B4%E0%B8%81%E0%B8%B2.pdf',
        'กรมวิชาการเกษตร — การปลูกและดูแลรักษากาแฟอะราบิกา พันธุ์เชียงใหม่ 80',
      ),
    ],
    verifiedAt: VERIFIED,
  },
  {
    id: 'th-doa-chiang-mai-1',
    name: 'DOA Chiang Mai 1',
    localName: 'กวก. เชียงใหม่ 1',
    species: 'arabica',
    sources: [s('institution', 'Department of Agriculture (Thailand) — Arabica variety DOA Chiang Mai 1', 'https://doaplant.doa.go.th/RecFront/PlantDetailPdf/475', 'กรมวิชาการเกษตร — กาแฟอะราบิกาพันธุ์ กวก. เชียงใหม่ 1')],
    verifiedAt: VERIFIED,
  },
  {
    id: 'th-chumphon-1',
    name: 'Chumphon 1',
    localName: 'ชุมพร 1',
    species: 'robusta',
    sources: [s('institution', 'Department of Agriculture (Thailand) — Robusta variety Chumphon 1', 'https://www.doa.go.th/hort/?page_id=53013', 'กรมวิชาการเกษตร — กาแฟโรบัสต้า พันธุ์ชุมพร 1')],
    verifiedAt: VERIFIED,
  },
  {
    id: 'th-chumphon-2',
    name: 'Chumphon 2',
    localName: 'ชุมพร 2',
    species: 'robusta',
    sources: [s('institution', 'Chumphon Horticultural Research Center (DOA) — Robusta variety Chumphon 2', 'https://www.doa.go.th/hc/chumphon/?p=617', 'ศูนย์วิจัยพืชสวนชุมพร — กาแฟโรบัสตา พันธุ์ชุมพร 2')],
    verifiedAt: VERIFIED,
  },
]

const USDA_COFFEE = s('institution', 'USDA FAS — Coffee: World Markets and Trade', 'https://apps.fas.usda.gov/psdonline/circulars/coffee.pdf')
const WCR_GLOBAL = s('institution', 'World Coffee Research — Varieties catalog goes global', 'https://worldcoffeeresearch.org/news/2018/varieties-catalog-goes-global')

const country = (code: string, name: string, sources: CatalogSource[] = [USDA_COFFEE]): OriginRef => ({
  id: code.toLowerCase(),
  country: code,
  countryName: name,
  sources,
  verifiedAt: VERIFIED,
})

const GI_REGISTER = s(
  'institution',
  'Department of Intellectual Property (Thailand) — Geographical Indication register',
  'https://www.ipthailand.go.th/images/26669/GI/Static/staticGIregistration20231102.pdf',
  'กรมทรัพย์สินทางปัญญา — ทะเบียนสิ่งบ่งชี้ทางภูมิศาสตร์ (GI)',
)

const CHUMPHON_2_PAGE = s(
  'institution',
  'Chumphon Horticultural Research Center (DOA) — Chumphon 2, suited to Chumphon and Ranong',
  'https://www.doa.go.th/hc/chumphon/?p=617',
  'ศูนย์วิจัยพืชสวนชุมพร — พันธุ์ชุมพร 2 (เหมาะกับชุมพรและระนอง)',
)

export const ORIGINS: readonly OriginRef[] = [
  // --- ประเทศผู้ผลิต (เรียงตามตัวอักษร) ---
  country('BR', 'Brazil'),
  country('CO', 'Colombia'),
  country('CR', 'Costa Rica', [USDA_COFFEE, wcr('villa-sarchi', 'Villa Sarchi (Costa Rica)')]),
  country('EC', 'Ecuador'),
  country('SV', 'El Salvador', [USDA_COFFEE, wcr('pacamara', 'Pacamara (El Salvador)')]),
  country('ET', 'Ethiopia'),
  country('GT', 'Guatemala'),
  country('HN', 'Honduras'),
  country('IN', 'India'),
  country('ID', 'Indonesia'),
  country('KE', 'Kenya', [USDA_COFFEE, wcr('sl28', 'SL28 (Kenya)')]),
  country('LA', 'Laos'),
  country('MW', 'Malawi', [WCR_GLOBAL]),
  country('MX', 'Mexico'),
  country('NI', 'Nicaragua'),
  country('PA', 'Panama', [wcr('geisha-panama', 'Geisha (Panama)')]),
  country('PG', 'Papua New Guinea'),
  country('PE', 'Peru'),
  country('PH', 'Philippines'),
  country('RW', 'Rwanda', [WCR_GLOBAL]),
  country('TZ', 'Tanzania'),
  country('TH', 'Thailand'),
  country('UG', 'Uganda'),
  country('VN', 'Vietnam'),
  country('ZM', 'Zambia', [WCR_GLOBAL]),
  country('ZW', 'Zimbabwe', [WCR_GLOBAL]),

  // --- แหล่งปลูกในไทย ---
  {
    id: 'th-chiang-rai-doi-chaang',
    country: 'TH',
    countryName: 'Thailand',
    region: 'Chiang Rai (Doi Chaang)',
    localRegion: 'เชียงราย (ดอยช้าง)',
    sources: [GI_REGISTER],
    verifiedAt: VERIFIED,
  },
  {
    id: 'th-chiang-rai-doi-tung',
    country: 'TH',
    countryName: 'Thailand',
    region: 'Chiang Rai (Doi Tung)',
    localRegion: 'เชียงราย (ดอยตุง)',
    sources: [GI_REGISTER],
    verifiedAt: VERIFIED,
  },
  {
    id: 'th-chiang-mai',
    country: 'TH',
    countryName: 'Thailand',
    region: 'Chiang Mai',
    localRegion: 'เชียงใหม่',
    sources: [
      s(
        'institution',
        'Chiang Mai Royal Agricultural Research Center (DOA) — Arabica production management manual',
        'https://www.doa.go.th/hc/cmrarc/wp-content/uploads/2025/08/%E0%B8%84%E0%B8%B9%E0%B9%88%E0%B8%A1%E0%B8%B7%E0%B8%AD%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%88%E0%B8%B1%E0%B8%94%E0%B8%81%E0%B8%B2%E0%B8%A3-%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9C%E0%B8%A5%E0%B8%B4%E0%B8%95%E0%B8%81%E0%B8%B2%E0%B9%81%E0%B8%9F%E0%B8%AD%E0%B8%B0%E0%B8%A3%E0%B8%B2%E0%B8%9A%E0%B8%B4%E0%B8%81%E0%B8%B2.pdf',
        'ศูนย์วิจัยเกษตรหลวงเชียงใหม่ — คู่มือการจัดการการผลิตกาแฟอะราบิกา',
      ),
    ],
    verifiedAt: VERIFIED,
  },
  {
    id: 'th-chumphon',
    country: 'TH',
    countryName: 'Thailand',
    region: 'Chumphon',
    localRegion: 'ชุมพร',
    sources: [CHUMPHON_2_PAGE],
    verifiedAt: VERIFIED,
  },
  {
    id: 'th-ranong',
    country: 'TH',
    countryName: 'Thailand',
    region: 'Ranong',
    localRegion: 'ระนอง',
    sources: [CHUMPHON_2_PAGE],
    verifiedAt: VERIFIED,
  },
]
