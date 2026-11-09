import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '../db'
import { SNOOZE_KEY } from '../features/export/reminder'
import App from './App'

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
  localStorage.removeItem(SNOOZE_KEY)
})

const daysAgoIso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

/** เมล็ดที่สร้างมา n วันแล้ว (ข้อมูลชิ้นแรกของผู้ใช้) */
async function seedBeanCreated(daysOld: number) {
  const at = daysAgoIso(daysOld)
  await db.beans.add({
    id: 'b1', name: 'Kenya AA', roaster: 'R', origin: 'Kenya', roastLevel: 'light', roastDate: '2026-10-30', weightG: 250,
    remainingG: 250, category: 'coffee', archived: false, createdAt: at, updatedAt: at,
  })
}

describe('App', () => {
  it('แสดงแท็บหลัก 4 แท็บ และสลับได้', async () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'เมนูหลัก' })
    expect(within(nav).getAllByRole('button')).toHaveLength(4)
    await userEvent.click(within(nav).getByRole('button', { name: /เมล็ด/ }))
    expect(within(nav).getByRole('button', { name: /เมล็ด/ })).toHaveAttribute('aria-current', 'page')
  })

  it('แท็บเมล็ดแสดงคลังเมล็ดและอุปกรณ์', async () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'เมนูหลัก' })
    await userEvent.click(within(nav).getByRole('button', { name: /เมล็ด/ }))
    expect(await screen.findByRole('button', { name: '+ เพิ่มเมล็ด' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /อุปกรณ์/ })).toBeInTheDocument()
  })

  describe('หน้า "ข้อมูลของฉัน" และเตือนสำรองข้อมูล', () => {
    const nav = () => screen.getByRole('navigation', { name: 'เมนูหลัก' })
    const dataButton = () => screen.getByRole('button', { name: /ข้อมูลของฉัน: สำรอง/ })

    it('ปุ่ม 💾 เปิดหน้าข้อมูล, ไม่มีแท็บไหนถูกเลือก, กดแท็บอื่นแล้วปิดหน้า', async () => {
      render(<App />)
      await userEvent.click(dataButton())
      expect(await screen.findByRole('heading', { name: 'ข้อมูลของฉัน' })).toBeInTheDocument()
      expect(within(nav()).queryByRole('button', { current: 'page' })).not.toBeInTheDocument()

      await userEvent.click(within(nav()).getByRole('button', { name: /บันทึก/ }))
      expect(screen.queryByRole('heading', { name: 'ข้อมูลของฉัน' })).not.toBeInTheDocument()
      expect(within(nav()).getByRole('button', { name: /บันทึก/ })).toHaveAttribute('aria-current', 'page')
    })

    it('ปุ่ม "← กลับ" ปิดหน้าข้อมูล', async () => {
      render(<App />)
      await userEvent.click(dataButton())
      await userEvent.click(await screen.findByRole('button', { name: 'กลับ' }))
      expect(screen.queryByRole('heading', { name: 'ข้อมูลของฉัน' })).not.toBeInTheDocument()
    })

    it('ผู้ใช้ใหม่/ข้อมูลเพิ่งเริ่ม → ไม่เตือน', async () => {
      await seedBeanCreated(3)
      render(<App />)
      await userEvent.click(within(nav()).getByRole('button', { name: /เมล็ด/ }))
      await screen.findByRole('button', { name: '+ เพิ่มเมล็ด' })
      expect(screen.queryByRole('region', { name: 'เตือนสำรองข้อมูล' })).not.toBeInTheDocument()
      expect(dataButton().getAttribute('aria-label')).not.toContain('ถึงเวลา')
    })

    it('ใช้มา 20 วันยังไม่เคยสำรอง → แบนเนอร์บนแท็บอื่น + จุดแดงที่ปุ่ม แต่ไม่ดันแท็บ "ชง"', async () => {
      await seedBeanCreated(20)
      render(<App />)
      // แท็บ "ชง": ไม่มีแบนเนอร์ (ไม่รบกวนตัวจับเวลา) แต่ปุ่มข้อมูลบอกว่าถึงเวลาแล้ว
      await waitFor(() => expect(dataButton().getAttribute('aria-label')).toContain('ถึงเวลาสำรองข้อมูล'))
      expect(screen.queryByRole('region', { name: 'เตือนสำรองข้อมูล' })).not.toBeInTheDocument()

      await userEvent.click(within(nav()).getByRole('button', { name: /บันทึก/ }))
      const banner = await screen.findByRole('region', { name: 'เตือนสำรองข้อมูล' })
      expect(banner).toHaveTextContent('ยังไม่เคยสำรองข้อมูล')
      expect(banner).toHaveTextContent('20 วันที่แล้ว')

      // "สำรองเลย" → เปิดหน้าข้อมูล
      await userEvent.click(within(banner).getByRole('button', { name: 'สำรองเลย' }))
      expect(await screen.findByRole('heading', { name: 'ข้อมูลของฉัน' })).toBeInTheDocument()
      expect(screen.queryByRole('region', { name: 'เตือนสำรองข้อมูล' })).not.toBeInTheDocument()
    })

    it('"ไว้ทีหลัง" ซ่อนแบนเนอร์และจำไว้ (แต่จุดแดงยังอยู่)', async () => {
      await seedBeanCreated(20)
      render(<App />)
      await userEvent.click(within(nav()).getByRole('button', { name: /บันทึก/ }))
      await userEvent.click(await screen.findByRole('button', { name: 'ไว้ทีหลัง' }))
      expect(screen.queryByRole('region', { name: 'เตือนสำรองข้อมูล' })).not.toBeInTheDocument()
      expect(Number(localStorage.getItem(SNOOZE_KEY))).toBeGreaterThan(Date.now())
      expect(dataButton().getAttribute('aria-label')).toContain('ถึงเวลาสำรองข้อมูล')
    })

    it('เพิ่งสำรอง → ไม่เตือน แม้ข้อมูลเก่ามาก; สำรองไว้นานเกิน 14 วัน → เตือนว่า "สำรองล่าสุด"', async () => {
      await seedBeanCreated(90)
      await db.settings.put({ id: 'app', language: 'th', units: 'metric', theme: 'system', defaultMethod: 'v60', lastBackupAt: daysAgoIso(2) })
      const first = render(<App />)
      await userEvent.click(within(nav()).getByRole('button', { name: /บันทึก/ }))
      await screen.findByText('ยังไม่มีบันทึกการชง')
      expect(screen.queryByRole('region', { name: 'เตือนสำรองข้อมูล' })).not.toBeInTheDocument()
      first.unmount()

      await db.settings.update('app', { lastBackupAt: daysAgoIso(16) })
      render(<App />)
      await userEvent.click(within(nav()).getByRole('button', { name: /บันทึก/ }))
      expect(await screen.findByRole('region', { name: 'เตือนสำรองข้อมูล' })).toHaveTextContent('สำรองล่าสุด 16 วันที่แล้ว')
    })
  })
})
