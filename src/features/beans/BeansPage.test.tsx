import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addBean, addBrew, db } from '../../db'
import { toLocalDate } from '../../domain/calc'
import BeansPage from './BeansPage'

/** วันที่ท้องถิ่นย้อนหลัง n วัน (สร้างจากปฏิทิน ไม่ใช้ลบมิลลิวินาที เลี่ยง DST) */
function daysAgo(n: number): string {
  const d = new Date()
  return toLocalDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n))
}

const seedBean = (over: Partial<Parameters<typeof addBean>[0]> = {}) =>
  addBean({
    name: 'Ethiopia Guji', roaster: 'Roast Co', origin: 'Ethiopia', roastLevel: 'light',
    roastDate: daysAgo(10), weightG: 250, category: 'coffee', ...over,
  })

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('คลังเมล็ด', () => {
  it('ไม่มีเมล็ด → แสดงสถานะว่างพร้อมปุ่มเพิ่ม', async () => {
    render(<BeansPage />)
    expect(await screen.findByText('ยังไม่มีเมล็ดในคลัง')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ เพิ่มเมล็ด' })).toBeInTheDocument()
  })

  it('เพิ่มเมล็ด → ขึ้นในรายการพร้อมวันหลังคั่ว, น้ำหนักคงเหลือ และต้นทุนต่อแก้ว', async () => {
    const user = userEvent.setup()
    render(<BeansPage />)
    await user.click(await screen.findByRole('button', { name: '+ เพิ่มเมล็ด' }))

    await user.type(screen.getByLabelText(/ชื่อเมล็ด/), 'Kenya AA')
    await user.type(screen.getByLabelText(/วันที่คั่ว/), daysAgo(7))
    await user.type(screen.getByLabelText(/น้ำหนักถุง/), '250')
    await user.type(screen.getByLabelText(/ราคาทั้งถุง/), '500')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    const card = await screen.findByRole('button', { name: /Kenya AA/ })
    expect(within(card).getByText('คั่วมา 7 วัน')).toBeInTheDocument()
    expect(within(card).getByText('พร้อมชง')).toBeInTheDocument()
    expect(within(card).getByText(/250 g/)).toBeInTheDocument()
    expect(within(card).getByText(/ชงได้อีก ~16 แก้ว/)).toBeInTheDocument()
    // 500 ÷ 250 × 15 = 30
    expect(within(card).getByText(/ต้นทุน ≈ ฿30\.00/)).toBeInTheDocument()
    expect(await db.beans.count()).toBe(1)
  })

  it('กรอกไม่ครบ → แสดง error ตรงช่อง และไม่บันทึก', async () => {
    const user = userEvent.setup()
    render(<BeansPage />)
    await user.click(await screen.findByRole('button', { name: '+ เพิ่มเมล็ด' }))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    expect(screen.getByText('กรุณากรอกชื่อเมล็ด')).toBeInTheDocument()
    expect(screen.getByText('กรุณาเลือกวันที่คั่ว')).toBeInTheDocument()
    expect(screen.getByText(/กรุณากรอกน้ำหนักถุง/)).toBeInTheDocument()
    expect(screen.getByLabelText(/ชื่อเมล็ด/)).toHaveAttribute('aria-invalid', 'true')
    expect(await db.beans.count()).toBe(0)

    // พิมพ์แก้ → error ช่องนั้นหายทันที
    await user.type(screen.getByLabelText(/ชื่อเมล็ด/), 'A')
    expect(screen.queryByText('กรุณากรอกชื่อเมล็ด')).not.toBeInTheDocument()
  })

  it('เมล็ดสดมาก (< 4 วัน) ขึ้น "ควรพักก่อน"; เก่า (> 45 วัน) ขึ้น "ผ่านมานาน"', async () => {
    await seedBean({ name: 'Fresh', roastDate: daysAgo(2) })
    await seedBean({ name: 'Old', roastDate: daysAgo(60) })
    render(<BeansPage />)
    expect(within(await screen.findByRole('button', { name: /Fresh/ })).getByText('ควรพักก่อน')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /Old/ })).getByText('ผ่านมานาน')).toBeInTheDocument()
  })

  it('ใกล้หมด / หมดแล้ว แสดงสถานะ; คงเหลือติดลบแสดงเป็น 0', async () => {
    await seedBean({ name: 'Low', remainingG: 40 })
    await seedBean({ name: 'Empty', remainingG: -3 })
    render(<BeansPage />)
    expect(within(await screen.findByRole('button', { name: /Low/ })).getByText('ใกล้หมด')).toBeInTheDocument()
    const empty = screen.getByRole('button', { name: /Empty/ })
    expect(within(empty).getByText('หมดแล้ว')).toBeInTheDocument()
    expect(within(empty).getByText('0')).toBeInTheDocument()
  })

  it('แก้ไขเมล็ด (ชื่อ + คงเหลือ)', async () => {
    const user = userEvent.setup()
    await seedBean()
    render(<BeansPage />)
    await user.click(await screen.findByRole('button', { name: /Ethiopia Guji/ }))

    const name = await screen.findByLabelText(/ชื่อเมล็ด/)
    expect(name).toHaveValue('Ethiopia Guji')
    await user.clear(name)
    await user.type(name, 'Guji Natural')
    const remaining = screen.getByLabelText(/คงเหลือ/)
    await user.clear(remaining)
    await user.type(remaining, '180')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    const card = await screen.findByRole('button', { name: /Guji Natural/ })
    expect(within(card).getByText(/180/)).toBeInTheDocument()
    const [saved] = await db.beans.toArray()
    expect(saved).toMatchObject({ name: 'Guji Natural', remainingG: 180 })
  })

  it('Archive ซ่อนจากรายการ → เปิดดูได้ → กู้คืนได้', async () => {
    const user = userEvent.setup()
    await seedBean()
    render(<BeansPage />)
    await user.click(await screen.findByRole('button', { name: /Ethiopia Guji/ }))
    await user.click(await screen.findByRole('button', { name: /^Archive/ }))

    expect(await screen.findByText('ยังไม่มีเมล็ดในคลัง')).toBeInTheDocument()
    await user.click(await screen.findByLabelText(/แสดงที่ Archive \(1\)/))
    await user.click(await screen.findByRole('button', { name: /Ethiopia Guji/ }))
    await user.click(await screen.findByRole('button', { name: 'กู้คืนจาก Archive' }))

    await waitFor(async () => expect((await db.beans.toArray())[0].archived).toBe(false))
    expect(await screen.findByRole('button', { name: /Ethiopia Guji/ })).toBeInTheDocument()
  })

  it('ลบเมล็ดที่ไม่มีประวัติการชง ต้องกดยืนยัน', async () => {
    const user = userEvent.setup()
    await seedBean()
    render(<BeansPage />)
    await user.click(await screen.findByRole('button', { name: /Ethiopia Guji/ }))
    await user.click(await screen.findByRole('button', { name: 'ลบเมล็ดนี้' }))

    expect(await db.beans.count()).toBe(1) // ยังไม่ลบจนกว่าจะยืนยัน
    await user.click(screen.getByRole('button', { name: 'ไม่ลบ' }))
    expect(screen.getByRole('button', { name: 'ลบเมล็ดนี้' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ลบเมล็ดนี้' }))
    await user.click(screen.getByRole('button', { name: 'ยืนยันลบ' }))
    expect(await screen.findByText('ยังไม่มีเมล็ดในคลัง')).toBeInTheDocument()
    expect(await db.beans.count()).toBe(0)
  })

  it('เมล็ดที่มีประวัติการชง → ปุ่มลบถูกปิด และบอกให้ใช้ Archive', async () => {
    const user = userEvent.setup()
    const bean = await seedBean()
    await addBrew({ brewedAt: new Date().toISOString(), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240 })
    render(<BeansPage />)
    // การ์ดแสดงคงเหลือที่หักแล้ว 235 g
    const card = await screen.findByRole('button', { name: /Ethiopia Guji/ })
    expect(within(card).getByText('235')).toBeInTheDocument()

    await user.click(card)
    expect(await screen.findByText(/มีประวัติการชง 1 ครั้ง จึงลบไม่ได้/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ลบเมล็ดนี้' })).toBeDisabled()
  })
})

describe('อุปกรณ์', () => {
  it('สลับไปหมวดอุปกรณ์ → ว่าง → เพิ่มเครื่องบดพร้อมสเกล → แสดงในรายการ', async () => {
    const user = userEvent.setup()
    render(<BeansPage />)
    await user.click(screen.getByRole('button', { name: /อุปกรณ์/ }))
    expect(await screen.findByText('ยังไม่มีอุปกรณ์')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ เพิ่มอุปกรณ์' }))
    await user.type(screen.getByLabelText(/ชื่อ \/ รุ่น/), 'Comandante C40')
    await user.type(screen.getByLabelText('ต่ำสุด'), '0')
    await user.type(screen.getByLabelText('สูงสุด'), '40')
    await user.type(screen.getByLabelText('ขั้นละ'), '1')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    const row = await screen.findByRole('button', { name: /Comandante C40/ })
    expect(within(row).getByText(/เครื่องบด · เบอร์บด 0–40/)).toBeInTheDocument()
  })

  it('เปลี่ยนชนิดเป็นอย่างอื่น ช่องสเกลเบอร์บดหายไป', async () => {
    const user = userEvent.setup()
    render(<BeansPage />)
    await user.click(screen.getByRole('button', { name: /อุปกรณ์/ }))
    await user.click(await screen.findByRole('button', { name: '+ เพิ่มอุปกรณ์' }))
    expect(screen.getByLabelText('ต่ำสุด')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/ชนิด/), 'kettle')
    expect(screen.queryByLabelText('ต่ำสุด')).not.toBeInTheDocument()
  })

  it('สเกลผิด → error และไม่บันทึก', async () => {
    const user = userEvent.setup()
    render(<BeansPage />)
    await user.click(screen.getByRole('button', { name: /อุปกรณ์/ }))
    await user.click(await screen.findByRole('button', { name: '+ เพิ่มอุปกรณ์' }))
    await user.type(screen.getByLabelText(/ชื่อ \/ รุ่น/), 'X')
    await user.type(screen.getByLabelText('ต่ำสุด'), '10')
    await user.type(screen.getByLabelText('สูงสุด'), '5')
    await user.type(screen.getByLabelText('ขั้นละ'), '1')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(screen.getByText('เลขสูงสุดต้องมากกว่าเลขต่ำสุด')).toBeInTheDocument()
    expect(await db.gear.count()).toBe(0)
  })

  it('แก้ไขและลบอุปกรณ์', async () => {
    const user = userEvent.setup()
    await db.gear.add({ id: 'g1', type: 'kettle', name: 'Old kettle', createdAt: 't', updatedAt: 't' })
    render(<BeansPage />)
    await user.click(screen.getByRole('button', { name: /อุปกรณ์/ }))

    await user.click(await screen.findByRole('button', { name: /Old kettle/ }))
    const name = await screen.findByLabelText(/ชื่อ \/ รุ่น/)
    await user.clear(name)
    await user.type(name, 'Fellow Stagg')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await user.click(await screen.findByRole('button', { name: /Fellow Stagg/ }))

    await user.click(await screen.findByRole('button', { name: 'ลบอุปกรณ์นี้' }))
    await user.click(screen.getByRole('button', { name: 'ยืนยันลบ' }))
    expect(await screen.findByText('ยังไม่มีอุปกรณ์')).toBeInTheDocument()
    expect(await db.gear.count()).toBe(0)
  })
})
