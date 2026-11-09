import { CSV_BOM, csvCell, toCsv, type CsvColumn } from './csv'

describe('csvCell', () => {
  it('ค่าว่าง/undefined/null → ช่องว่าง', () => {
    expect(csvCell(undefined)).toBe('')
    expect(csvCell(null)).toBe('')
    expect(csvCell('')).toBe('')
  })

  it('ตัวเลขใช้จุดทศนิยม, ค่าติดลบไม่ถูกแตะ, NaN/Infinity → ว่าง', () => {
    expect(csvCell(12.5)).toBe('12.5')
    expect(csvCell(-2)).toBe('-2')
    expect(csvCell(0)).toBe('0')
    expect(csvCell(Number.NaN)).toBe('')
    expect(csvCell(Number.POSITIVE_INFINITY)).toBe('')
  })

  it('boolean → TRUE/FALSE (Excel และ Sheets ตีความเป็นค่าตรรกะ)', () => {
    expect(csvCell(true)).toBe('TRUE')
    expect(csvCell(false)).toBe('FALSE')
  })

  it('ข้อความที่มี , " หรือขึ้นบรรทัดใหม่ → ครอบด้วย " และ escape " เป็น ""', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('บรรทัด1\nบรรทัด2')).toBe('"บรรทัด1\nบรรทัด2"')
    expect(csvCell('plain')).toBe('plain')
  })

  it('ข้อความภาษาไทยไม่ถูกแปลง', () => {
    expect(csvCell('เอธิโอเปีย กูจิ')).toBe('เอธิโอเปีย กูจิ')
  })

  it('ป้องกัน formula injection: ข้อความที่ขึ้นต้นด้วย = + - @ จะนำหน้าด้วย \'', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe('"\'=HYPERLINK(""http://evil"")"')
    expect(csvCell('+1+1')).toBe("'+1+1")
    expect(csvCell('-cmd')).toBe("'-cmd")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(csvCell('\t=1')).toBe("'\t=1")
    // เครื่องหมายที่อยู่กลางข้อความไม่เป็นอันตราย
    expect(csvCell('a=b')).toBe('a=b')
  })
})

describe('toCsv', () => {
  type Row = { n: string; q?: number }
  const columns: CsvColumn<Row>[] = [
    { header: 'name', value: (r) => r.n },
    { header: 'qty', value: (r) => r.q },
  ]

  it('ขึ้นต้นด้วย BOM, ใช้ CRLF และปิดท้ายด้วยขึ้นบรรทัดใหม่', () => {
    const csv = toCsv([{ n: 'กาแฟ', q: 1 }, { n: 'ชา' }], columns)
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    expect(csv).toBe(`${CSV_BOM}name,qty\r\nกาแฟ,1\r\nชา,\r\n`)
  })

  it('ไม่มีแถว → มีแต่หัวคอลัมน์', () => {
    expect(toCsv([], columns)).toBe(`${CSV_BOM}name,qty\r\n`)
  })

  it('เข้ารหัส UTF-8 พร้อม BOM (EF BB BF) ตามที่ Excel ภาษาไทยต้องการ', () => {
    const bytes = new TextEncoder().encode(toCsv([{ n: 'ก' }], columns))
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })
})
