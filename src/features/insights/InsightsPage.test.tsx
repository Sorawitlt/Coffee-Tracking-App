import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addBean, addBrew, db } from '../../db'
import InsightsPage from './InsightsPage'

const seedBean = (name: string, over: Partial<Parameters<typeof addBean>[0]> = {}) =>
  addBean({
    name, roaster: 'Roast Co', origin: 'Ethiopia', roastLevel: 'light', roastDate: '2026-10-01', weightG: 250,
    priceTotal: 500, currency: 'THB', category: 'coffee', ...over,
  })

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

type Input = Parameters<typeof addBrew>[0]
const brew = (beanId: string, over: Partial<Input> = {}) =>
  addBrew({ brewedAt: daysAgo(1), method: 'v60', beanId, doseG: 15, waterG: 240, ...over })

const setup = () => {
  const user = userEvent.setup()
  render(<InsightsPage />)
  return { user }
}

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('หน้าสรุป — ยังไม่มีข้อมูล', () => {
  it('ไม่มีการชงเลย → ชวนบันทึกก่อน ไม่แสดงตัวกรอง/กราฟ', async () => {
    setup()
    expect(await screen.findByText('ยังไม่มีข้อมูลให้สรุป')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'ช่วงเวลา' })).not.toBeInTheDocument()
  })
})

describe('หน้าสรุป — ตัวเลข สูตรที่ดีที่สุด และแนวโน้ม', () => {
  it('สรุปจำนวนครั้ง คะแนนเฉลี่ย และแนวโน้ม (4 ครั้งขึ้นไป)', async () => {
    const bean = await seedBean('Guji')
    const ratings = [2, 3, 4, 5] as const
    for (const [i, r] of ratings.entries()) await brew(bean.id, { brewedAt: daysAgo(10 - i), rating: r })
    setup()
    expect(await screen.findByText('ชงแล้ว')).toBeInTheDocument()
    const tiles = screen.getByText('ชงแล้ว').closest('dl')!
    expect(within(tiles).getByText('4')).toBeInTheDocument()
    expect(within(tiles).getByText('3.5')).toBeInTheDocument()
    // ล่าสุด 2 ครั้ง (4,5 = 4.5) เทียบ 2 ครั้งก่อนหน้า (2,3 = 2.5) → +2
    expect(within(tiles).getByText('▲ +2')).toBeInTheDocument()
    expect(within(tiles).getByText(/ดีขึ้น · เทียบ 2 ครั้งก่อน/)).toBeInTheDocument()
  })

  it('คะแนนไม่ถึง 4 ครั้ง → ยังไม่แสดงแนวโน้ม บอกเงื่อนไข', async () => {
    const bean = await seedBean('Guji')
    await brew(bean.id, { rating: 4 })
    setup()
    expect(await screen.findByText('ต้องมีคะแนน 4 ครั้ง')).toBeInTheDocument()
  })

  it('สูตรที่ดีที่สุดต่อเมล็ด: ติดดาวใช้ตามนั้น, ไม่ติดดาวใช้คะแนนสูงสุดและบอกว่ายังไม่ได้ติดดาว', async () => {
    const guji = await seedBean('Guji')
    const doi = await seedBean('Doi Chang')
    await brew(guji.id, { rating: 3, isBest: true, grindSetting: 20, tempC: 94, totalTimeSec: 171, flavorTags: ['citrus', 'honey'] })
    await brew(guji.id, { rating: 5, brewedAt: daysAgo(3) })
    await brew(doi.id, { rating: 4, method: 'espresso', doseG: 18, waterG: 36 })
    setup()

    const section = await screen.findByRole('region', { name: 'สูตรที่ดีที่สุดต่อเมล็ด' })
    const cards = within(section).getAllByRole('article')
    expect(cards).toHaveLength(2)
    const gujiCard = cards.find((c) => within(c).queryByText(/Guji · V60/))!
    expect(within(gujiCard).getByText('⭐ สูตรที่ดีที่สุด')).toBeInTheDocument()
    expect(within(gujiCard).getByText('1:16')).toBeInTheDocument()
    expect(within(gujiCard).getByText('บด 20 · 94 °C · 2:51')).toBeInTheDocument()
    expect(within(gujiCard).getByText('ส้ม / ซิตรัส · น้ำผึ้ง')).toBeInTheDocument()
    const doiCard = cards.find((c) => within(c).queryByText(/Doi Chang · Espresso/))!
    expect(within(doiCard).getByText('คะแนนสูงสุด (ยังไม่ได้ติดดาว)')).toBeInTheDocument()
  })

  it('ยังไม่มีการให้ดาวเลย → สูตรที่ดีที่สุดบอกให้ให้ดาว', async () => {
    const bean = await seedBean('Guji')
    await brew(bean.id)
    setup()
    expect(await screen.findByText(/ยังไม่มีสูตรให้สรุป/)).toBeInTheDocument()
  })
})

describe('หน้าสรุป — ตัวกรองคุมทุกส่วนพร้อมกัน', () => {
  it('กรองตามเมล็ด/วิธีชง/ช่วงเวลา → ตัวเลข สูตร และกราฟใช้ชุดข้อมูลเดียวกัน', async () => {
    const guji = await seedBean('Guji')
    const doi = await seedBean('Doi Chang')
    await brew(guji.id, { rating: 5, brewedAt: daysAgo(2) })
    await brew(doi.id, { rating: 3, brewedAt: daysAgo(2) })
    await brew(doi.id, { rating: 1, brewedAt: daysAgo(60), method: 'espresso' })
    const { user } = setup()
    const tile = (label: string) => screen.getByText(label).closest('div')!
    await screen.findByText('ชงแล้ว')
    expect(tile('ชงแล้ว')).toHaveTextContent('3ครั้ง')
    expect(tile('คะแนนเฉลี่ย')).toHaveTextContent('3ดาว') // (5+3+1)/3

    await user.click(screen.getByRole('button', { name: '30 วัน' }))
    await waitFor(() => expect(tile('ชงแล้ว')).toHaveTextContent('2ครั้ง'))
    expect(tile('คะแนนเฉลี่ย')).toHaveTextContent('4ดาว') // (5+3)/2

    await user.selectOptions(screen.getByLabelText('เมล็ด'), doi.id)
    await waitFor(() => expect(tile('ชงแล้ว')).toHaveTextContent('1ครั้ง'))
    expect(tile('คะแนนเฉลี่ย')).toHaveTextContent('3ดาว')
    expect(within(screen.getByRole('region', { name: 'สูตรที่ดีที่สุดต่อเมล็ด' })).getAllByRole('article')).toHaveLength(1)

    await user.selectOptions(screen.getByLabelText('วิธีชง'), 'espresso') // Doi + Espresso + 30 วัน = ไม่มี
    expect(await screen.findByText(/ไม่มีการชงตามตัวกรองนี้/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'คะแนนตามเวลา' })).not.toBeInTheDocument()
  })
})

describe('หน้าสรุป — กราฟและมุมมองตาราง', () => {
  it('กราฟคะแนน: วาดกราฟ และสลับเป็นตารางที่มีค่าทุกจุด (ใหม่ก่อน)', async () => {
    const bean = await seedBean('Guji')
    await brew(bean.id, { rating: 2, brewedAt: daysAgo(5) })
    await brew(bean.id, { rating: 4, brewedAt: daysAgo(1) })
    const { user } = setup()
    const card = await screen.findByRole('region', { name: 'คะแนนตามเวลา' })
    expect(within(card).getByRole('img', { name: /กราฟเส้นคะแนน 2 ครั้ง ล่าสุด 4 ดาว/ })).toBeInTheDocument()
    // ResponsiveContainer วาดหลังวัดขนาดเสร็จ (แบบ async)
    await waitFor(() => expect(card.querySelector('svg.recharts-surface')).not.toBeNull())

    await user.click(within(card).getByRole('button', { name: '▦ ดูตาราง' }))
    const rows = within(within(card).getByRole('table', { name: 'คะแนนของแต่ละครั้งที่ชง' })).getAllByRole('row')
    expect(rows).toHaveLength(3) // หัวตาราง + 2 แถว
    expect(within(rows[1]).getByText('4 ดาว')).toBeInTheDocument()
    expect(within(rows[2]).getByText('2 ดาว')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: '📈 ดูกราฟ' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('กราฟคะแนน: ยังไม่มีคะแนน → บอกวิธีทำให้มีข้อมูล', async () => {
    const bean = await seedBean('Guji')
    await brew(bean.id)
    setup()
    const card = await screen.findByRole('region', { name: 'คะแนนตามเวลา' })
    expect(within(card).getByText(/ยังไม่มีการชงที่ให้คะแนน/)).toBeInTheDocument()
  })

  it('Control Chart: ไม่มี TDS → อธิบายว่าเป็นข้อมูลเสริม; มี TDS → แสดงจุดและผลเทียบเป้า SCA ในตาราง', async () => {
    const bean = await seedBean('Guji')
    await brew(bean.id, { rating: 4 })
    const { user } = setup()
    const card = await screen.findByRole('region', { name: 'Brew Control Chart' })
    expect(within(card).getByText(/ต้องใช้ Refractometer/)).toBeInTheDocument()

    // ในเป้า: yield 225 × 1.35 ÷ 15 = 20.3 · นอกเป้า: TDS 1.0 / EY 14.7
    await brew(bean.id, { tds: 1.35, yieldG: 225, brewedAt: daysAgo(2) })
    await brew(bean.id, { tds: 1.0, yieldG: 220, brewedAt: daysAgo(3) })
    expect(await within(card).findByRole('img', { name: /แผนภาพกระจาย TDS กับ EY 2 ครั้ง อยู่ในเป้าหมาย 1 ครั้ง/ })).toBeInTheDocument()
    expect(within(card).getByText('ในเป้าหมาย (1)')).toBeInTheDocument()
    expect(within(card).getByText('นอกเป้าหมาย (1)')).toBeInTheDocument()

    await user.click(within(card).getByRole('button', { name: '▦ ดูตาราง' }))
    const table = within(card).getByRole('table')
    expect(within(table).getByText('อยู่ในเป้า')).toBeInTheDocument()
    expect(within(table).getByText('ความเข้มต่ำกว่าเป้า · การสกัดต่ำกว่าเป้า')).toBeInTheDocument()
    expect(within(table).getByText('20.3')).toBeInTheDocument()
  })

  it('Control Chart: สลับ Filter ↔ Espresso (ช่วงเป้าหมายต่างกัน, ไม่ปนกัน)', async () => {
    const bean = await seedBean('Guji')
    await brew(bean.id, { tds: 1.3, yieldG: 225 })
    await brew(bean.id, { method: 'espresso', doseG: 18, waterG: 36, yieldG: 36, tds: 9 })
    const { user } = setup()
    const card = await screen.findByRole('region', { name: 'Brew Control Chart' })
    expect(await within(card).findByRole('img', { name: /1 ครั้ง อยู่ในเป้าหมาย/ })).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Filter / Pour-over' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(card).getByRole('button', { name: 'Espresso' }))
    expect(within(card).getByRole('img', { name: /1 ครั้ง อยู่ในเป้าหมาย 1 ครั้ง/ })).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: '▦ ดูตาราง' }))
    expect(within(card).getByRole('table', { name: /Espresso/ })).toBeInTheDocument()
    expect(within(card).getByText('9')).toBeInTheDocument()
  })
})
