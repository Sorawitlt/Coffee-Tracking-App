import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addBean, addBrew, addGear, db } from '../../db'
import { toLocalDate } from '../../domain/calc'
import LogPage from './LogPage'

function daysAgo(n: number): string {
  const d = new Date()
  return toLocalDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n))
}

const seedBean = (over: Partial<Parameters<typeof addBean>[0]> = {}) =>
  addBean({
    name: 'Ethiopia Guji', roaster: 'Roast Co', origin: 'Ethiopia', roastLevel: 'light',
    roastDate: daysAgo(10), weightG: 250, priceTotal: 500, currency: 'THB', category: 'coffee', ...over,
  })

const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString()

const setup = () => {
  const goToBeans = vi.fn()
  const user = userEvent.setup()
  render(<LogPage onGoToBeans={goToBeans} />)
  return { user, goToBeans }
}

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('รายการบันทึก', () => {
  it('ยังไม่มีบันทึก → แสดงสถานะว่าง', async () => {
    setup()
    expect(await screen.findByText('ยังไม่มีบันทึกการชง')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ บันทึกการชง' })).toBeInTheDocument()
  })

  it('แสดงการชงล่าสุดก่อน พร้อมอัตราส่วน, เบอร์บด, วันหลังคั่ว และต้นทุนต่อแก้ว', async () => {
    const bean = await seedBean()
    await addBrew({ brewedAt: hoursAgo(48), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240 })
    await addBrew({
      brewedAt: hoursAgo(1), method: 'espresso', beanId: bean.id, doseG: 18, waterG: 36,
      grindSetting: 12, tempC: 93, totalTimeSec: 28,
    })
    setup()
    const cards = await screen.findAllByRole('article')
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText(/Espresso · Ethiopia Guji/)).toBeInTheDocument()
    expect(within(cards[0]).getByText('1:2')).toBeInTheDocument()
    // 500 ÷ 250 × 18 = 36
    expect(within(cards[0]).getByText(/บด 12 · 93 °C · 0:28 · คั่วมา 10 วัน · ต้นทุน ฿36\.00/)).toBeInTheDocument()
    expect(within(cards[1]).getByText('1:16')).toBeInTheDocument()
  })

  it('เมล็ดถูกลบไปแล้ว → การ์ดยังแสดงได้', async () => {
    await addBrew({ brewedAt: hoursAgo(1), method: 'v60', beanId: 'gone', doseG: 15, waterG: 240 })
    setup()
    expect(await screen.findByText(/V60 · เมล็ดที่ลบแล้ว/)).toBeInTheDocument()
  })
})

describe('บันทึกการชงเร็ว', () => {
  it('ยังไม่มีเมล็ด → บอกให้ไปเพิ่มเมล็ดก่อน', async () => {
    const { user, goToBeans } = setup()
    await user.click(await screen.findByRole('button', { name: '+ บันทึกการชง' }))
    expect(await screen.findByText(/ต้องมีเมล็ดในคลังก่อน/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ไปเพิ่มเมล็ด' }))
    expect(goToBeans).toHaveBeenCalled()
  })

  it('ชงครั้งแรก: เติมจากสูตรตั้งต้น → กดบันทึกทีเดียว → หักน้ำหนักเมล็ด', async () => {
    const bean = await seedBean()
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: '+ บันทึกการชง' }))

    expect(await screen.findByText('เติมค่าจากสูตรตั้งต้น')).toBeInTheDocument()
    expect(screen.getByLabelText(/^กาแฟ \(g\)/)).toHaveValue('15')
    expect(screen.getByLabelText(/^น้ำ \(g\)/)).toHaveValue('240')
    expect(screen.getByText('อัตราส่วน 1:16')).toBeInTheDocument()
    // ครั้งแรกไม่มีอะไรให้เทียบ → ไม่ไฮไลต์
    expect(screen.queryByText(/ครั้งก่อน/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('✓ บันทึกการชงแล้ว')).toBeInTheDocument()

    const [saved] = await db.brews.toArray()
    expect(saved).toMatchObject({ method: 'v60', beanId: bean.id, doseG: 15, waterG: 240, tempC: 94, recipeId: 'default-v60' })
    expect(saved).not.toHaveProperty('grindSetting')
    expect((await db.beans.get(bean.id))!.remainingG).toBe(235)
    expect(await screen.findAllByRole('article')).toHaveLength(1)
  })

  it('ปุ่ม +/− ปรับค่าได้โดยไม่ต้องพิมพ์ และอัตราส่วนอัปเดตสด', async () => {
    await seedBean()
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: '+ บันทึกการชง' }))

    await user.click(await screen.findByRole('button', { name: 'เพิ่ม กาแฟ (g)' }))
    expect(screen.getByLabelText(/^กาแฟ \(g\)/)).toHaveValue('15.5')
    await user.click(screen.getByRole('button', { name: 'ลด น้ำ (g)' }))
    expect(screen.getByLabelText(/^น้ำ \(g\)/)).toHaveValue('235')
    expect(screen.getByText('อัตราส่วน 1:15.2')).toBeInTheDocument()

    // ช่องเบอร์บดว่าง (ไม่มีสเกล): เริ่มนับจาก 0 ทีละ 1
    await user.click(screen.getByRole('button', { name: 'เพิ่ม เบอร์บด' }))
    const grind = screen.getByLabelText('เบอร์บด')
    expect(grind).toHaveValue('1')
    await user.click(screen.getByRole('button', { name: 'เพิ่ม เบอร์บด' }))
    expect(grind).toHaveValue('2')
  })

  it('เติมอัตโนมัติจากครั้งล่าสุดของเมล็ดนี้ และไฮไลต์เฉพาะค่าที่เปลี่ยน', async () => {
    const bean = await seedBean()
    await addBrew({
      brewedAt: hoursAgo(24), method: 'v60', beanId: bean.id, doseG: 16, waterG: 256, grindSetting: 18, tempC: 94,
    })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: '+ บันทึกการชง' }))

    expect(await screen.findByText(/เติมค่าจากการชงครั้งล่าสุดของเมล็ดนี้/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^กาแฟ \(g\)/)).toHaveValue('16')
    expect(screen.getByLabelText('เบอร์บด')).toHaveValue('18')
    expect(screen.queryByText(/ครั้งก่อน/)).not.toBeInTheDocument()

    // ปรับเบอร์บดตัวเดียว → ไฮไลต์ช่องนั้นช่องเดียว
    await user.click(screen.getByRole('button', { name: 'ลด เบอร์บด' }))
    expect(screen.getByLabelText('เบอร์บด')).toHaveValue('17')
    expect(screen.getByText('▲ เปลี่ยน · ครั้งก่อน 18')).toBeInTheDocument()
    expect(screen.getByLabelText('เบอร์บด')).toHaveAttribute('data-changed', 'true')
    expect(screen.getByLabelText(/^กาแฟ \(g\)/)).not.toHaveAttribute('data-changed')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    // ปรับกลับเป็นค่าเดิม → ไฮไลต์หาย
    await user.click(screen.getByRole('button', { name: 'เพิ่ม เบอร์บด' }))
    expect(screen.queryByText(/ครั้งก่อน/)).not.toBeInTheDocument()
  })

  it('เปลี่ยนหลายตัวแปรพร้อมกัน → เตือนให้ปรับทีละอย่าง', async () => {
    const bean = await seedBean()
    await addBrew({
      brewedAt: hoursAgo(24), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240, grindSetting: 18, tempC: 94,
    })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: '+ บันทึกการชง' }))
    await screen.findByText(/เติมค่าจากการชงครั้งล่าสุด/)

    await user.click(screen.getByRole('button', { name: 'ลด เบอร์บด' }))
    await user.click(screen.getByRole('button', { name: 'เพิ่ม อุณหภูมิ (°C)' }))
    expect(await screen.findByRole('status')).toHaveTextContent('เปลี่ยน 2 ตัวแปรพร้อมกัน')
  })

  it('เปลี่ยนวิธีชงแล้วเติมค่าใหม่ตามวิธีนั้น (Espresso ใช้ 18 g → 36 g)', async () => {
    await seedBean()
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: '+ บันทึกการชง' }))
    await user.selectOptions(await screen.findByLabelText(/วิธีชง/), 'espresso')
    expect(screen.getByLabelText(/^กาแฟ \(g\)/)).toHaveValue('18')
    expect(screen.getByLabelText(/^น้ำ \(g\)/)).toHaveValue('36')
    expect(screen.getByText('อัตราส่วน 1:2')).toBeInTheDocument()
  })

  it('เมล็ดใหม่ที่ยังไม่เคยชง → ยืมค่าตั้งจากครั้งล่าสุดของวิธีเดียวกัน', async () => {
    const a = await seedBean({ name: 'Bean A', roastDate: daysAgo(20) })
    await seedBean({ name: 'Bean B', roastDate: daysAgo(5) })
    await addBrew({ brewedAt: hoursAgo(5), method: 'v60', beanId: a.id, doseG: 20, waterG: 320, grindSetting: 22 })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: '+ บันทึกการชง' }))
    // เมล็ดตั้งต้น = เมล็ดของการชงล่าสุด (A)
    expect(await screen.findByLabelText(/เมล็ด/)).toHaveDisplayValue('Bean A')
    await user.selectOptions(screen.getByLabelText(/เมล็ด/), 'Bean B')
    expect(await screen.findByText(/วิธีนี้ \(เมล็ดอื่น\)/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^กาแฟ \(g\)/)).toHaveValue('20')
  })

  it('กรอกค่าไม่ถูกต้อง → error ตรงช่อง และไม่บันทึก', async () => {
    await seedBean()
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: '+ บันทึกการชง' }))
    const dose = await screen.findByLabelText(/^กาแฟ \(g\)/)
    await user.clear(dose)
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(screen.getByText('กรุณากรอกปริมาณกาแฟ (กรัม)')).toBeInTheDocument()
    expect(dose).toHaveAttribute('aria-invalid', 'true')
    expect(await db.brews.count()).toBe(0)
    await user.type(dose, '15')
    expect(screen.queryByText('กรุณากรอกปริมาณกาแฟ (กรัม)')).not.toBeInTheDocument()
  })

  it('ใช้กาแฟมากกว่าที่เหลือ → เตือนแต่ยังบันทึกได้ ยอดคงเหลือไม่ต่ำกว่า 0 ในการแสดงผล', async () => {
    await seedBean({ remainingG: 10 })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: '+ บันทึกการชง' }))
    expect(await screen.findByText(/น้อยกว่าที่ใช้/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await waitFor(async () => expect(await db.brews.count()).toBe(1))
  })

  it('สเกลเครื่องบดกำหนดขั้นและช่วงของปุ่มเบอร์บด', async () => {
    await seedBean()
    await db.gear.add({
      id: 'g1', type: 'grinder', name: 'C40', grindScale: { min: 10, max: 12, step: 1 }, createdAt: 't', updatedAt: 't',
    })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: '+ บันทึกการชง' }))
    await user.selectOptions(await screen.findByLabelText('เครื่องบด'), 'C40')
    const inc = screen.getByRole('button', { name: 'เพิ่ม เบอร์บด' })
    await user.click(inc)
    expect(screen.getByLabelText('เบอร์บด')).toHaveValue('10')
    await user.click(inc)
    await user.click(inc)
    await user.click(inc)
    expect(screen.getByLabelText('เบอร์บด')).toHaveValue('12') // ไม่เกิน max
  })
})

describe('ชงซ้ำ', () => {
  it('กด "ชงซ้ำ" → ค่าตั้งถูกคัดลอกครบ (ไม่รวมผลชิม/เวลาชง) → บันทึกเป็นรายการใหม่ภายใน 2 คลิก', async () => {
    const bean = await seedBean()
    const original = await addBrew({
      brewedAt: hoursAgo(24), method: 'v60', beanId: bean.id, doseG: 16, waterG: 256, grindSetting: 18, tempC: 95,
      totalTimeSec: 180, rating: 5, notes: 'หอมมาก',
    })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /^ชงซ้ำ V60/ }))

    expect(await screen.findByRole('form', { name: 'ชงซ้ำ' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^กาแฟ \(g\)/)).toHaveValue('16')
    expect(screen.getByLabelText('เบอร์บด')).toHaveValue('18')
    expect(screen.getByLabelText(/^อุณหภูมิ/)).toHaveValue('95')
    expect(screen.getByLabelText(/^เวลาชง/)).toHaveValue('')
    expect(screen.queryByText(/ครั้งก่อน/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await waitFor(async () => expect(await db.brews.count()).toBe(2))
    const copy = (await db.brews.toArray()).find((b) => b.id !== original.id)!
    expect(copy).toMatchObject({ method: 'v60', beanId: bean.id, doseG: 16, waterG: 256, grindSetting: 18, tempC: 95 })
    expect(copy.rating).toBeUndefined()
    expect(copy.notes).toBeUndefined()
    expect(copy.totalTimeSec).toBeUndefined()
    expect(new Date(copy.brewedAt).getTime()).toBeGreaterThan(new Date(original.brewedAt).getTime())
    expect((await db.beans.get(bean.id))!.remainingG).toBe(250 - 16 - 16)
  })

  it('ชงซ้ำแล้วปรับตัวเดียว → ไฮไลต์เทียบกับการชงต้นทาง', async () => {
    const bean = await seedBean()
    await addBrew({ brewedAt: hoursAgo(24), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240, grindSetting: 18 })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /^ชงซ้ำ V60/ }))
    await user.click(await screen.findByRole('button', { name: 'ลด เบอร์บด' }))
    expect(screen.getByText('▲ เปลี่ยน · ครั้งก่อน 18')).toBeInTheDocument()
  })
})

describe('แก้ไข / ลบ', () => {
  it('แก้ปริมาณกาแฟ → ยอดเมล็ดคงเหลือปรับตาม; ล้างเบอร์บดได้ (ไม่ทิ้งคีย์ว่าง)', async () => {
    const bean = await seedBean()
    const brew = await addBrew({
      brewedAt: hoursAgo(2), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240, grindSetting: 18, rating: 4,
    })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /^แก้ไขบันทึก V60/ }))

    const dose = await screen.findByLabelText(/^กาแฟ \(g\)/)
    expect(dose).toHaveValue('15')
    await user.clear(dose)
    await user.type(dose, '18')
    await user.clear(screen.getByLabelText('เบอร์บด'))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('✓ แก้ไขบันทึกแล้ว')).toBeInTheDocument()

    const saved = (await db.brews.get(brew.id))!
    expect(saved).toMatchObject({ doseG: 18, rating: 4 }) // ผลชิมเดิมไม่หาย
    expect(saved).not.toHaveProperty('grindSetting')
    expect((await db.beans.get(bean.id))!.remainingG).toBe(250 - 18)
  })

  it('ลบบันทึกต้องยืนยัน และคืนน้ำหนักเมล็ด', async () => {
    const bean = await seedBean()
    await addBrew({ brewedAt: hoursAgo(2), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240 })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /^แก้ไขบันทึก V60/ }))
    await user.click(await screen.findByRole('button', { name: 'ลบบันทึกนี้' }))
    expect(await db.brews.count()).toBe(1) // ยังไม่ลบจนกว่าจะยืนยัน
    await user.click(screen.getByRole('button', { name: 'ไม่ลบ' }))
    await user.click(screen.getByRole('button', { name: 'ลบบันทึกนี้' }))
    await user.click(screen.getByRole('button', { name: 'ยืนยันลบ' }))

    expect(await screen.findByText('ยังไม่มีบันทึกการชง')).toBeInTheDocument()
    expect(await db.brews.count()).toBe(0)
    expect((await db.beans.get(bean.id))!.remainingG).toBe(250)
  })

  it('แก้ไขบันทึกเก่า → ไฮไลต์เทียบกับการชงก่อนหน้าของเมล็ด+วิธีเดียวกัน', async () => {
    const bean = await seedBean()
    await addBrew({ brewedAt: hoursAgo(48), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240, grindSetting: 20 })
    await addBrew({ brewedAt: hoursAgo(2), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240, grindSetting: 18 })
    const { user } = setup()
    const [newest] = await screen.findAllByRole('button', { name: /^แก้ไขบันทึก V60/ })
    await user.click(newest)
    expect(await screen.findByText('▲ เปลี่ยน · ครั้งก่อน 20')).toBeInTheDocument()
  })
})

describe('ชิม & ให้คะแนน → ครั้งหน้าลอง (Dial-in Advisor)', () => {
  const openNewForm = async (user: ReturnType<typeof userEvent.setup>) =>
    user.click(await screen.findByRole('button', { name: '+ บันทึกการชง' }))

  /** เมล็ด + เครื่องบด + การชงครั้งก่อน (เบอร์ 20) ให้ฟอร์มใหม่เติมเบอร์บดมาให้ */
  async function seedWithGrinder() {
    const bean = await seedBean()
    const grinder = await addGear({ type: 'grinder', name: 'Niche', grindScale: { min: 0, max: 50, step: 1 } })
    await addBrew({
      brewedAt: hoursAgo(24), method: 'v60', beanId: bean.id, grinderId: grinder.id, doseG: 15, waterG: 240,
      grindSetting: 20, tempC: 94,
    })
    return { bean, grinder }
  }

  it('ให้ดาว + เลือกรส 2 แตะ → บันทึก → ได้คำแนะนำ “บดละเอียดขึ้น 1 ขั้น” ตามกฎเปรี้ยว', async () => {
    const { bean } = await seedWithGrinder()
    const { user } = setup()
    await openNewForm(user)

    await user.click(await screen.findByRole('button', { name: '2 ดาว' }))
    await user.click(screen.getByRole('button', { name: 'เปรี้ยวมาก' }))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    const advice = await screen.findByRole('region', { name: 'คำแนะนำสำหรับครั้งหน้า' })
    expect(within(advice).getByText(/สกัดน้อยไป/)).toBeInTheDocument()
    expect(within(advice).getByText('บดละเอียดขึ้น 1 ขั้น (เบอร์ 20 → 19)')).toBeInTheDocument()
    // ทางเลือกสำรองตามลำดับ: อุณหภูมิ → เวลา (ยังไม่ได้จับเวลา จึงมีแค่อุณหภูมิ)
    expect(within(advice).getByText('น้ำร้อนขึ้น 2 °C (94 → 96 °C)')).toBeInTheDocument()

    const saved = (await db.brews.orderBy('brewedAt').last())!
    expect(saved).toMatchObject({ beanId: bean.id, rating: 2, balance: -2, isBest: false })
    expect(saved.advice).toMatchObject({ kind: 'underExtracted', adjustment: { variable: 'grind', direction: 'finer', to: 19 } })

    await user.click(screen.getByRole('button', { name: 'เสร็จสิ้น' }))
    const cards = await screen.findAllByRole('article')
    expect(within(cards[0]).getByRole('img', { name: '2 ดาว' })).toBeInTheDocument()
  })

  it('ไม่กรอกผลชิม → บันทึกตรงกลับรายการ (ไม่มีหน้าคำแนะนำ ไม่เก็บ advice)', async () => {
    await seedBean()
    const { user } = setup()
    await openNewForm(user)
    await user.click(await screen.findByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('✓ บันทึกการชงแล้ว')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'คำแนะนำสำหรับครั้งหน้า' })).not.toBeInTheDocument()
    expect(await db.brews.toArray()).toEqual([expect.not.objectContaining({ advice: expect.anything() })])
  })

  it('ให้ดาวอย่างเดียว: ช่องรสที่ไม่ได้แตะไม่ถูกบันทึกเป็น 0 (แยก “ไม่ได้ชิม” ออกจาก “สมดุล”)', async () => {
    await seedBean()
    const { user } = setup()
    await openNewForm(user)
    await user.click(await screen.findByRole('button', { name: '5 ดาว' }))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    // 5 ดาวโดยไม่บอกรส → ไม่มีอาการผิดปกติ จึงแนะนำคงสูตร
    expect(await screen.findByText(/อร่อยแล้ว/)).toBeInTheDocument()
    const saved = (await db.brews.toArray())[0]
    expect(saved.rating).toBe(5)
    expect(saved).not.toHaveProperty('balance')
    expect(saved).not.toHaveProperty('body')
  })

  it('ให้ 2 ดาวอย่างเดียว → ไม่ยืนยันว่า “สมดุล” แต่บอกให้เพิ่มรสชาติเพื่อแนะนำตรงขึ้น', async () => {
    await seedBean()
    const { user } = setup()
    await openNewForm(user)
    await user.click(await screen.findByRole('button', { name: '2 ดาว' }))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('ยังไม่พบอาการที่ต้องปรับ')).toBeInTheDocument()
    expect(screen.getByText(/บอกรสชาติ \(เปรี้ยว\/ขม\/บอดี้\) เพิ่ม/)).toBeInTheDocument()
    expect(screen.queryByText(/สมดุล/)).not.toBeInTheDocument()
  })

  it('แตะค่าที่เลือกอยู่ซ้ำ = ยกเลิกการเลือก', async () => {
    await seedBean()
    const { user } = setup()
    await openNewForm(user)
    const star = await screen.findByRole('button', { name: '4 ดาว' })
    await user.click(star)
    expect(star).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '2 ดาว' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(star)
    expect(star).toHaveAttribute('aria-pressed', 'false')
    const bitter = screen.getByRole('button', { name: 'ขมมาก' })
    await user.click(bitter)
    await user.click(bitter)
    expect(bitter).toHaveAttribute('aria-pressed', 'false')
  })

  it('อร่อยแล้ว → ติดดาวสูตรที่ดีที่สุดได้ในแตะเดียว และย้ายดาวจากรายการเดิมของเมล็ด+วิธีเดียวกัน', async () => {
    const { bean } = await seedWithGrinder()
    const older = await addBrew({
      brewedAt: hoursAgo(48), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240, rating: 4, isBest: true,
    })
    const { user } = setup()
    await openNewForm(user)
    await user.click(await screen.findByRole('button', { name: '5 ดาว' }))
    await user.click(screen.getByRole('button', { name: 'สมดุล' }))
    await user.click(screen.getByRole('button', { name: 'พอดี' }))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    expect(await screen.findByText(/อร่อยแล้ว/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '⭐ บันทึกเป็นสูตรที่ดีที่สุดของเมล็ดนี้' }))
    const unstar = await screen.findByRole('button', { name: /เป็นสูตรที่ดีที่สุดของเมล็ดนี้ \(กดเพื่อยกเลิก\)/ })
    expect(unstar).toHaveAttribute('aria-pressed', 'true')

    const best = (await db.brews.toArray()).filter((b) => b.isBest)
    expect(best).toHaveLength(1)
    expect(best[0].rating).toBe(5)
    expect((await db.brews.get(older.id))!.isBest).toBe(false)

    await user.click(screen.getByRole('button', { name: 'เสร็จสิ้น' }))
    expect(await screen.findByText('⭐ สูตรที่ดีที่สุด')).toBeInTheDocument()
  })

  it('ติดดาวสูตรที่ดีที่สุดจากช่องเลือกในฟอร์มก็ได้ (ตอนแก้ไขบันทึก)', async () => {
    const bean = await seedBean()
    const brew = await addBrew({ brewedAt: hoursAgo(2), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240 })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /^แก้ไขบันทึก V60/ }))
    await user.click(await screen.findByRole('checkbox', { name: /ติดดาวเป็นสูตรที่ดีที่สุด/ }))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('✓ แก้ไขบันทึกแล้ว')).toBeInTheDocument()
    expect((await db.brews.get(brew.id))!.isBest).toBe(true)
  })

  it('แท็กรสชาติ ความหวาน และโน้ต ถูกบันทึกและโหลดกลับมาตอนแก้ไข', async () => {
    await seedBean()
    const { user } = setup()
    await openNewForm(user)
    await user.click(await screen.findByText('ความหวาน แท็กรสชาติ และโน้ต'))
    await user.click(screen.getByRole('button', { name: 'ส้ม / ซิตรัส' }))
    await user.click(screen.getByRole('button', { name: 'น้ำผึ้ง' }))
    await user.click(screen.getByRole('button', { name: 'น้ำผึ้ง' })) // เอาออก
    await user.click(screen.getByRole('button', { name: 'หวานมาก' }))
    await user.type(screen.getByLabelText('โน้ต'), 'หอมดอกไม้')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('✓ บันทึกการชงแล้ว')).toBeInTheDocument()

    const saved = (await db.brews.toArray())[0]
    expect(saved).toMatchObject({ flavorTags: ['citrus'], sweetness: 4, notes: 'หอมดอกไม้' })

    await user.click(await screen.findByRole('button', { name: /^แก้ไขบันทึก V60/ }))
    expect(await screen.findByRole('button', { name: 'ส้ม / ซิตรัส' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'หวานมาก' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('โน้ต')).toHaveValue('หอมดอกไม้')
  })

  it('Espresso ไหลเร็ว < 20 วินาที → แนะนำบดละเอียดขึ้นแม้ยังไม่ได้ชิม', async () => {
    const bean = await seedBean()
    const grinder = await addGear({ type: 'grinder', name: 'Niche', grindScale: { min: 0, max: 50, step: 1 } })
    await addBrew({
      brewedAt: hoursAgo(24), method: 'espresso', beanId: bean.id, grinderId: grinder.id, doseG: 18, waterG: 36,
      grindSetting: 12,
    })
    const { user } = setup()
    await openNewForm(user)
    await user.clear(await screen.findByLabelText(/^เวลาชง/))
    await user.type(screen.getByLabelText(/^เวลาชง/), '15')
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))

    const advice = await screen.findByRole('region', { name: 'คำแนะนำสำหรับครั้งหน้า' })
    expect(within(advice).getByText(/ไหลเร็วเกินไป/)).toBeInTheDocument()
    expect(within(advice).getByText('บดละเอียดขึ้น 1 ขั้น (เบอร์ 12 → 11)')).toBeInTheDocument()
  })

  it('ชงซ้ำเริ่มจากผลชิมว่าง (ผลชิมเป็นของการชงครั้งนั้น ๆ)', async () => {
    const bean = await seedBean()
    await addBrew({
      brewedAt: hoursAgo(24), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240, rating: 5, balance: 0, isBest: true,
    })
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /^ชงซ้ำ V60/ }))
    expect(await screen.findByRole('button', { name: '5 ดาว' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'สมดุล' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('checkbox', { name: /ติดดาวเป็นสูตรที่ดีที่สุด/ })).not.toBeChecked()
  })

  it('แก้ไขโดยไม่เปลี่ยนคำแนะนำ → กลับรายการเลย; เปลี่ยนผลชิมจนคำแนะนำเปลี่ยน → แสดงหน้าคำแนะนำใหม่', async () => {
    await seedWithGrinder()
    const { user } = setup()
    await openNewForm(user)
    await user.click(await screen.findByRole('button', { name: 'เปรี้ยว' }))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    await user.click(await screen.findByRole('button', { name: 'เสร็จสิ้น' }))

    // แก้แค่ปริมาณกาแฟ — คำแนะนำ (บดละเอียดขึ้น) ไม่เปลี่ยน
    await user.click((await screen.findAllByRole('button', { name: /^แก้ไขบันทึก V60/ }))[0])
    await user.click(await screen.findByRole('button', { name: 'เพิ่ม กาแฟ (g)' }))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText('✓ แก้ไขบันทึกแล้ว')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'คำแนะนำสำหรับครั้งหน้า' })).not.toBeInTheDocument()

    // เปลี่ยนจากเปรี้ยวเป็นขม → คำแนะนำกลับทิศ
    await user.click((await screen.findAllByRole('button', { name: /^แก้ไขบันทึก V60/ }))[0])
    await user.click(await screen.findByRole('button', { name: 'ขม' }))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    const advice = await screen.findByRole('region', { name: 'คำแนะนำสำหรับครั้งหน้า' })
    expect(within(advice).getByText(/สกัดมากไป/)).toBeInTheDocument()
    expect(within(advice).getByText(/บดหยาบขึ้น 1 ขั้น/)).toBeInTheDocument()
  })

  it('เมล็ดเพิ่งคั่ว (< 4 วัน) → แสดงข้อความเตือนความสดใต้คำแนะนำ', async () => {
    await seedBean({ roastDate: daysAgo(2) })
    const { user } = setup()
    await openNewForm(user)
    await user.click(await screen.findByRole('button', { name: 'ขมมาก' }))
    await user.click(screen.getByRole('button', { name: 'บันทึก' }))
    expect(await screen.findByText(/เมล็ดยังสดมาก อาจมีก๊าซเยอะ ควรพักก่อน/)).toBeInTheDocument()
  })
})
