import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addBean, addBrew, db, ensureDefaults, getSettings } from '../../db'
import { buildBackup, parseBackup } from '../../domain/backup'
import DataPage from './DataPage'
import { readFileText } from './files'

const downloads: { name: string; blob: Blob }[] = []
let lastBlob: Blob

beforeEach(async () => {
  await db.open()
  await Promise.all(db.tables.map((t) => t.clear()))
  await ensureDefaults()
  downloads.length = 0
  URL.createObjectURL = vi.fn((blob: Blob) => {
    lastBlob = blob
    return 'blob:test'
  })
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, blob: lastBlob })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'storage')
})

async function seed() {
  const bean = await addBean({
    name: 'Ethiopia Guji', roaster: 'Roast Co', origin: 'Ethiopia', roastLevel: 'light', roastDate: '2026-10-30',
    weightG: 250, priceTotal: 500, currency: 'THB', category: 'coffee',
  })
  await addBrew({
    brewedAt: new Date(2026, 10, 9, 8, 30).toISOString(), method: 'v60', beanId: bean.id, doseG: 15, waterG: 240,
    rating: 4, notes: 'หอมดอกไม้',
  })
  return bean
}

const setup = () => {
  const onClose = vi.fn()
  const user = userEvent.setup()
  render(<DataPage onClose={onClose} />)
  return { user, onClose }
}

/** ไบต์จริงของไฟล์ (Blob.text() ตัด BOM ทิ้งตามสเปก จึงตรวจ BOM ผ่านไบต์) */
const readBytes = (blob: Blob) =>
  new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })

const jsonFile = (content: unknown, name = 'backup.json') =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], name, { type: 'application/json' })

describe('สำรองข้อมูล (JSON)', () => {
  it('ยังไม่เคยสำรอง → แสดง "ยังไม่เคย"', async () => {
    setup()
    expect(await screen.findByText('ยังไม่เคย')).toBeInTheDocument()
  })

  it('กดดาวน์โหลด → ได้ไฟล์ .json ที่อ่านกลับได้ครบ และบันทึกเวลาสำรองล่าสุด', async () => {
    await seed()
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /ดาวน์โหลดไฟล์สำรอง/ }))

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].name).toMatch(/^brew-log-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const parsed = parseBackup(await readFileText(downloads[0].blob))
    expect(parsed.ok && parsed.backup.beans).toHaveLength(1)
    expect(parsed.ok && parsed.backup.brews).toHaveLength(1)

    expect(await screen.findByRole('status')).toHaveTextContent('1 เมล็ด')
    expect((await getSettings()).lastBackupAt).toBeDefined()
    expect(screen.getByTestId('last-backup')).toHaveTextContent('วันนี้')
  })

  it('ตั้งเวลาสำรองล่าสุดหลังดาวน์โหลดเท่านั้น — เปิดหน้าเฉย ๆ ไม่ถือว่าสำรอง', async () => {
    setup()
    await screen.findByText('ยังไม่เคย')
    expect((await getSettings()).lastBackupAt).toBeUndefined()
  })
})

describe('ส่งออก CSV', () => {
  it('บันทึกการชง: UTF-8 BOM, หัวคอลัมน์ภาษาอังกฤษ, ข้อมูลภาษาไทยไม่เพี้ยน', async () => {
    await seed()
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /บันทึกการชง \(\.csv\)/ }))

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].name).toMatch(/^brew-log-brews-\d{4}-\d{2}-\d{2}\.csv$/)
    const text = await readFileText(downloads[0].blob)
    expect([...(await readBytes(downloads[0].blob)).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(text).toContain('brewed_at,method,bean_id')
    expect(text).toContain('2026-11-09 08:30,v60')
    expect(text).toContain('Ethiopia Guji')
    expect(text).toContain('หอมดอกไม้')
    expect(text.endsWith('\r\n')).toBe(true)
    // ส่งออก CSV ไม่นับเป็นการสำรอง
    expect((await getSettings()).lastBackupAt).toBeUndefined()
  })

  it('คลังเมล็ด: ไฟล์ .csv มีเมล็ดครบ', async () => {
    await seed()
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /คลังเมล็ด \(\.csv\)/ }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].name).toMatch(/^brew-log-beans-.*\.csv$/)
    const text = await readFileText(downloads[0].blob)
    expect(text).toContain('Ethiopia Guji')
    expect(text).toContain('remaining_g')
  })

  it('ไม่มีข้อมูล → ยังได้ไฟล์ที่มีแต่หัวคอลัมน์ (เปิดใน Excel ได้ ไม่ error)', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: /บันทึกการชง \(\.csv\)/ }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    expect((await readFileText(downloads[0].blob)).trim().split('\r\n')).toHaveLength(1)
  })
})

describe('นำข้อมูลกลับ (Restore)', () => {
  /** สร้างไฟล์สำรองของข้อมูลชุดหนึ่ง แล้วล้างเครื่อง เพื่อทดสอบนำกลับ */
  async function makeBackupThenWipe() {
    const bean = await seed()
    const tables = await Promise.all([db.beans.toArray(), db.gear.toArray(), db.recipes.toArray(), db.brews.toArray()])
    const file = buildBackup(
      { beans: tables[0], gear: tables[1], recipes: tables[2], brews: tables[3], settings: await getSettings() },
      '2026-11-09T03:00:00.000Z',
    )
    await Promise.all([db.beans.clear(), db.brews.clear()])
    return { bean, file }
  }

  it('เลือกไฟล์ → แสดงสรุปและขอยืนยัน → ยืนยันแล้วข้อมูลกลับมาครบ', async () => {
    const { bean, file } = await makeBackupThenWipe()
    // ข้อมูลที่จะถูกแทนที่
    await addBean({
      name: 'ข้อมูลเดิมในเครื่อง', roaster: 'R', origin: 'O', roastLevel: 'dark', roastDate: '2026-11-01', weightG: 100, category: 'coffee',
    })
    const { user } = setup()

    await user.upload(await screen.findByLabelText(/ไฟล์สำรอง/), jsonFile(file, 'my-backup.json'))

    const confirm = await screen.findByRole('group', { name: 'ยืนยันการนำข้อมูลกลับ' })
    expect(within(confirm).getByText(/my-backup\.json/)).toBeInTheDocument()
    expect(within(confirm).getByText('1 เมล็ด · 0 อุปกรณ์ · 0 สูตรของฉัน · 1 บันทึกการชง')).toBeInTheDocument() // ในไฟล์
    expect(await within(confirm).findByText('1 เมล็ด · 0 อุปกรณ์ · 0 สูตรของฉัน · 0 บันทึกการชง')).toBeInTheDocument() // ในเครื่อง
    // ยังไม่ได้ยืนยัน = ยังไม่แตะข้อมูล
    expect((await db.beans.toArray()).map((b) => b.name)).toEqual(['ข้อมูลเดิมในเครื่อง'])

    await user.click(within(confirm).getByRole('button', { name: 'ยืนยัน แทนที่ข้อมูล' }))

    expect(await screen.findByText(/นำข้อมูลกลับเรียบร้อย: 1 เมล็ด/)).toBeInTheDocument()
    expect((await db.beans.toArray()).map((b) => b.id)).toEqual([bean.id])
    expect(await db.brews.count()).toBe(1)
    expect(screen.queryByRole('group', { name: 'ยืนยันการนำข้อมูลกลับ' })).not.toBeInTheDocument()
  })

  it('ยกเลิก → ข้อมูลเดิมไม่ถูกแตะ', async () => {
    const { file } = await makeBackupThenWipe()
    const { user } = setup()
    await user.upload(await screen.findByLabelText(/ไฟล์สำรอง/), jsonFile(file))
    await user.click(await screen.findByRole('button', { name: 'ยกเลิก' }))
    expect(screen.queryByRole('group', { name: 'ยืนยันการนำข้อมูลกลับ' })).not.toBeInTheDocument()
    expect(await db.beans.count()).toBe(0)
  })

  it('ไฟล์ที่ไม่ใช่ไฟล์สำรอง → แจ้ง error และไม่แตะข้อมูล', async () => {
    await seed()
    const { user } = setup()
    await user.upload(await screen.findByLabelText(/ไฟล์สำรอง/), jsonFile({ hello: 'world' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ไม่ใช่ไฟล์สำรองของ Brew Log')
    expect(await db.beans.count()).toBe(1)
  })

  it('ไฟล์ JSON เสีย → แจ้ง error', async () => {
    const { user } = setup()
    await user.upload(await screen.findByLabelText(/ไฟล์สำรอง/), jsonFile('{ไม่ใช่ json'))
    expect(await screen.findByRole('alert')).toHaveTextContent('อ่านไฟล์ไม่ได้')
  })

  it('ระเบียนในไฟล์ผิด → บอกตำแหน่งและฟิลด์ที่ผิด และไม่นำเข้าอะไรเลย', async () => {
    const { file } = await makeBackupThenWipe()
    const broken = JSON.parse(JSON.stringify(file))
    broken.data.beans[0].weightG = 'หนักมาก'
    const { user } = setup()
    await user.upload(await screen.findByLabelText(/ไฟล์สำรอง/), jsonFile(broken))
    expect(await screen.findByRole('alert')).toHaveTextContent('เมล็ดรายการที่ 1 (ฟิลด์ weightG)')
    expect(await db.beans.count()).toBe(0)
  })

  it('ไฟล์จากเวอร์ชันใหม่กว่า → บอกให้อัปเดตแอป', async () => {
    const { file } = await makeBackupThenWipe()
    const { user } = setup()
    await user.upload(await screen.findByLabelText(/ไฟล์สำรอง/), jsonFile({ ...file, formatVersion: 99 }))
    expect(await screen.findByRole('alert')).toHaveTextContent('อัปเดตแอป')
  })

  it('"สำรองข้อมูลปัจจุบันก่อน" → ดาวน์โหลดไฟล์ของข้อมูลปัจจุบัน แล้วยังกดยืนยันต่อได้', async () => {
    const { file } = await makeBackupThenWipe()
    await addBean({
      name: 'ข้อมูลเดิม', roaster: 'R', origin: 'O', roastLevel: 'dark', roastDate: '2026-11-01', weightG: 100, category: 'coffee',
    })
    const { user } = setup()
    await user.upload(await screen.findByLabelText(/ไฟล์สำรอง/), jsonFile(file))
    await user.click(await screen.findByRole('button', { name: 'สำรองข้อมูลปัจจุบันก่อน' }))

    await waitFor(() => expect(downloads).toHaveLength(1))
    const saved = parseBackup(await readFileText(downloads[0].blob))
    expect(saved.ok && saved.backup.beans.map((b) => b.name)).toEqual(['ข้อมูลเดิม'])
    expect(await screen.findByText('ดาวน์โหลดไฟล์สำรองของข้อมูลปัจจุบันแล้ว')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ยืนยัน แทนที่ข้อมูล' })).toBeEnabled()
  })

  it('เลือกไฟล์เดิมซ้ำได้ (ล้างค่า input หลังอ่าน)', async () => {
    const { user } = setup()
    const input = await screen.findByLabelText<HTMLInputElement>(/ไฟล์สำรอง/)
    await user.upload(input, jsonFile('x'))
    await screen.findByRole('alert')
    expect(input.value).toBe('')
  })
})

describe('ที่เก็บข้อมูลในเครื่อง', () => {
  it('เบราว์เซอร์ไม่รองรับ → "ไม่รับประกัน" พร้อมคำแนะนำ ไม่ error', async () => {
    setup()
    expect(await screen.findByText('ไม่รับประกัน')).toBeInTheDocument()
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument()
  })

  it('กด "ขอเก็บข้อมูลถาวร" แล้วได้สิทธิ์ → สถานะเปลี่ยน', async () => {
    let persisted = false
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { persisted: async () => persisted, persist: async () => (persisted = true) },
    })
    const { user } = setup()
    expect(await screen.findByText('ไม่รับประกัน')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ขอเก็บข้อมูลถาวร' }))
    expect(await screen.findByText(/เก็บถาวร/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ขอเก็บข้อมูลถาวร' })).not.toBeInTheDocument()
  })

  it('เก็บถาวรอยู่แล้ว → ไม่แสดงปุ่มขอสิทธิ์', async () => {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: async () => true, persist: async () => true } })
    setup()
    expect(await screen.findByText(/เก็บถาวร/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ขอเก็บข้อมูลถาวร' })).not.toBeInTheDocument()
  })
})

describe('ปุ่มกลับ', () => {
  it('เรียก onClose', async () => {
    const { user, onClose } = setup()
    await user.click(await screen.findByRole('button', { name: 'กลับ' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
