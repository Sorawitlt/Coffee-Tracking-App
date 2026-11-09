import { axisDomain, axisTicks } from './ControlChart'

describe('axisDomain — ขอบแกนครอบทั้งข้อมูลและกรอบเป้าหมาย', () => {
  it('ไม่มีข้อมูล → ครอบกรอบเป้าหมายพอดีพร้อมระยะเผื่อ (ปัดตามขั้น)', () => {
    expect(axisDomain([], [1.15, 1.45], 0.1)).toEqual([1.1, 1.5])
    expect(axisDomain([], [18, 22], 2)).toEqual([16, 24])
  })

  it('ข้อมูลอยู่นอกกรอบ → ขยายไปครอบจุดนั้น', () => {
    expect(axisDomain([0.9], [1.15, 1.45], 0.1)).toEqual([0.8, 1.5])
    expect(axisDomain([25.4], [18, 22], 2)).toEqual([16, 28])
  })

  it('ข้อมูลอยู่ในกรอบ → ขอบแกนไม่เปลี่ยน', () => {
    expect(axisDomain([1.3], [1.15, 1.45], 0.1)).toEqual(axisDomain([], [1.15, 1.45], 0.1))
  })
})

describe('axisTicks', () => {
  it('เส้นแกนทุกขั้น รวมปลายทั้งสองด้าน ไม่มีเลขทศนิยมคลาดเคลื่อน', () => {
    expect(axisTicks([1.1, 1.5], 0.1)).toEqual([1.1, 1.2, 1.3, 1.4, 1.5])
    expect(axisTicks([16, 24], 2)).toEqual([16, 18, 20, 22, 24])
    expect(axisTicks([7, 13], 1)).toHaveLength(7)
  })
})
