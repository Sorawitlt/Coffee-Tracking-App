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
    await user.type(screen.getByLabelText(/ชื่อเรียก/), 'Comandante C40')
    await user.type(screen.getByLabelText('ต่ำสุด'), '0')
    await user.type(screen.getByLabelText('สูงสุด'), '40')
    await user.type(screen.getByLabelText('ขั้นละ'), '1')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    // รอกลับหน้ารายการก่อน — ระหว่างฟอร์มยังเปิด ชื่อ "Comandante C40" ทำให้มีปุ่มแนะนำรุ่นจากฐานข้อมูลชื่อคล้ายกัน
    await screen.findByRole('button', { name: '+ เพิ่มอุปกรณ์' })
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
    await user.type(screen.getByLabelText(/ชื่อเรียก/), 'X')
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
    const name = await screen.findByLabelText(/ชื่อเรียก/)
    await user.clear(name)
    await user.type(name, 'Fellow Stagg')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await screen.findByRole('button', { name: '+ เพิ่มอุปกรณ์' }) // รอกลับรายการ (ฟอร์มมีปุ่มแนะนำ "Fellow Stagg EKG")
    await user.click(await screen.findByRole('button', { name: /Fellow Stagg/ }))

    await user.click(await screen.findByRole('button', { name: 'ลบอุปกรณ์นี้' }))
    await user.click(screen.getByRole('button', { name: 'ยืนยันลบ' }))
    expect(await screen.findByText('ยังไม่มีอุปกรณ์')).toBeInTheDocument()
    expect(await db.gear.count()).toBe(0)
  })
})

describe('ฐานข้อมูลอ้างอิงอุปกรณ์', () => {
  async function openAddGear() {
    const user = userEvent.setup()
    render(<BeansPage />)
    await user.click(screen.getByRole('button', { name: /อุปกรณ์/ }))
    await user.click(await screen.findByRole('button', { name: '+ เพิ่มอุปกรณ์' }))
    return user
  }

  it('ค้นหา "df 64" → เลือก → เติมชนิด/ยี่ห้อ/รุ่น/ชื่อ/สเกล + การ์ดสเปกและแหล่งอ้างอิง → บันทึกพร้อมรหัสฐานข้อมูล', async () => {
    const user = await openAddGear()
    await user.type(screen.getByRole('searchbox', { name: /ค้นหารุ่นจากฐานข้อมูล/ }), 'df 64')
    expect(screen.getByRole('status')).toHaveTextContent(/พบ \d+ รุ่น/)
    await user.click(screen.getByRole('button', { name: /DF Grinders DF64 Gen 2/ }))

    const card = screen.getByRole('region', { name: 'ข้อมูลจากฐานข้อมูลอ้างอิง' })
    expect(within(card).getByText('64 mm', { exact: false })).toBeInTheDocument()
    expect(within(card).getByText(/ชุมชนผู้ใช้ \(ผู้ผลิตไม่ได้ระบุ\)/)).toBeInTheDocument()
    const link = within(card).getByRole('link', { name: /DF Grinders — DF64 Gen 2 Coffee Grinder/ })
    expect(link).toHaveAttribute('href', 'https://dfgrinders.com/products/df64-coffee-grinder')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))

    expect(screen.getByLabelText(/ชื่อเรียก/)).toHaveValue('DF Grinders DF64 Gen 2')
    expect(screen.getByLabelText('ยี่ห้อ')).toHaveValue('DF Grinders')
    expect(screen.getByLabelText('รุ่น')).toHaveValue('DF64 Gen 2')
    expect(screen.getByLabelText('ต่ำสุด')).toHaveValue('0')
    expect(screen.getByLabelText('สูงสุด')).toHaveValue('90')
    expect(screen.getByLabelText('ขั้นละ')).toHaveValue('0.5')

    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await screen.findByRole('button', { name: '+ เพิ่มอุปกรณ์' })
    const row = await screen.findByRole('button', { name: /DF Grinders DF64 Gen 2/ })
    expect(within(row).getByText(/มีข้อมูลอ้างอิง/)).toBeInTheDocument()
    const [saved] = await db.gear.toArray()
    expect(saved).toMatchObject({
      type: 'grinder', brand: 'DF Grinders', model: 'DF64 Gen 2', catalogId: 'df-grinders-df64-gen-2',
      grindScale: { min: 0, max: 90, step: 0.5 },
    })
  })

  it('Flair 58 Plus 2 → ชนิดเปลี่ยนเป็นอุปกรณ์ชง และแสดงปริมาณกาแฟตามผู้ผลิต', async () => {
    const user = await openAddGear()
    await user.type(screen.getByRole('searchbox', { name: /ค้นหารุ่นจากฐานข้อมูล/ }), 'flair 58 plus 2')
    await user.click(screen.getByRole('button', { name: /Flair 58 Plus 2/ }))
    expect(screen.getByLabelText(/ชนิด/)).toHaveValue('brewer')
    expect(screen.queryByLabelText('ต่ำสุด')).not.toBeInTheDocument()
    const card = screen.getByRole('region', { name: 'ข้อมูลจากฐานข้อมูลอ้างอิง' })
    expect(within(card).getByText('16–20 g')).toBeInTheDocument()
    expect(within(card).getByText('58 mm')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    // ชื่ออัตโนมัติ = ชื่อรุ่น → ไม่แสดงบรรทัดยี่ห้อ/รุ่นซ้ำ
    await screen.findByRole('button', { name: '+ เพิ่มอุปกรณ์' })
    const row = await screen.findByRole('button', { name: /Flair 58 Plus 2/ })
    expect(within(row).queryByText(/Flair Espresso/)).not.toBeInTheDocument()
  })

  it('ไม่พบในฐานข้อมูล → บอกให้กรอกเอง', async () => {
    const user = await openAddGear()
    await user.type(screen.getByRole('searchbox', { name: /ค้นหารุ่นจากฐานข้อมูล/ }), 'ไม่มีรุ่นนี้แน่นอน')
    expect(screen.getByRole('status')).toHaveTextContent('ไม่พบในฐานข้อมูล')
  })

  it('อุปกรณ์เดิมชื่อ "DF64" → แอปเดารุ่นให้ → แตะเชื่อม: ชื่อที่ตั้งเองคงไว้ สเกลเติมให้ → ยกเลิกการเชื่อมได้', async () => {
    const user = userEvent.setup()
    await db.gear.add({ id: 'g1', type: 'grinder', name: 'DF64', createdAt: 't', updatedAt: 't' })
    render(<BeansPage />)
    await user.click(screen.getByRole('button', { name: /อุปกรณ์/ }))
    await user.click(await screen.findByRole('button', { name: /^DF64/ }))

    expect(await screen.findByText(/ใช่รุ่นนี้ไหม/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /DF Grinders DF64 Gen 2/ }))
    expect(screen.getByLabelText(/ชื่อเรียก/)).toHaveValue('DF64')
    expect(screen.getByLabelText('สูงสุด')).toHaveValue('90')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await waitFor(async () => expect((await db.gear.get('g1'))?.catalogId).toBe('df-grinders-df64-gen-2'))
    await screen.findByRole('button', { name: '+ เพิ่มอุปกรณ์' })
    // ชื่อที่ตั้งเองต่างจากรุ่น → แสดง "ยี่ห้อ รุ่น" ใต้ชื่อในรายการ
    expect(within(await screen.findByRole('button', { name: /^DF64/ })).getByText('DF Grinders DF64 Gen 2')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /^DF64/ }))
    await user.click(await screen.findByRole('button', { name: 'ยกเลิกการเชื่อมกับฐานข้อมูล' }))
    expect(screen.getByRole('searchbox', { name: /ค้นหารุ่นจากฐานข้อมูล/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await waitFor(async () => expect((await db.gear.get('g1'))?.catalogId).toBeUndefined())
    expect((await db.gear.get('g1'))?.model).toBe('DF64 Gen 2') // ยี่ห้อ/รุ่นที่เติมไว้ยังอยู่
  })
})

describe('ฐานข้อมูลอ้างอิงเมล็ด', () => {
  it('สายพันธุ์/แหล่งปลูกตรงกับฐานข้อมูล → แสดงลิงก์แหล่งอ้างอิง; โรงคั่วเสนอจากที่เคยกรอก', async () => {
    const user = userEvent.setup()
    await seedBean({ roaster: 'Roast Co' })
    render(<BeansPage />)
    await user.click(await screen.findByRole('button', { name: '+ เพิ่มเมล็ด' }))

    const roaster = screen.getByLabelText('โรงคั่ว')
    const roasterList = document.getElementById(roaster.getAttribute('list')!)!
    await waitFor(() => expect(within(roasterList).getByText('', { selector: 'option[value="Roast Co"]' })).toBeInTheDocument())

    await user.type(screen.getByLabelText('สายพันธุ์'), 'Gesha')
    const ref = screen.getByRole('link', { name: /World Coffee Research — Geisha \(Panama\)/ })
    expect(ref).toHaveAttribute('href', 'https://varieties.worldcoffeeresearch.org/varieties/geisha-panama')

    await user.type(screen.getByLabelText('แหล่งปลูก'), 'Thailand, Chiang Rai (Doi Chaang)')
    expect(screen.getByRole('link', { name: /ทะเบียนสิ่งบ่งชี้ทางภูมิศาสตร์/ })).toBeInTheDocument()
  })
})
